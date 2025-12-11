import React, { createContext, useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { getApiUrl } from '../utils/apiConfig';

export const ChickenFightContext = createContext();

export function ChickenFightProvider({ children }) {
  const [fights, setFights] = useState([]);
  const [fightNumber, setFightNumber] = useState(0);
  const [entries, setEntries] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [historyDates, setHistoryDates] = useState([]);
  const [historyFights, setHistoryFights] = useState([]);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const socketRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const lastSyncRef = useRef(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;

  const today = new Date().toISOString().split('T')[0];
  const API_URL = getApiUrl();

  // Helper functions (define before useEffect)
  const resetRetry = () => {
    retryCountRef.current = 0;
  };

  const getRetryDelay = () => {
    return 1000 * Math.pow(2, retryCountRef.current);
  };

  const handleRetry = async () => {
    if (retryCountRef.current < MAX_RETRIES) {
      retryCountRef.current++;
      console.log(`Retry ${retryCountRef.current}/${MAX_RETRIES}`);
      return true;
    }
    return false;
  };

  // Define load functions before Socket.io setup
  const loadTodaysFights = useCallback(async () => {
    try {
      setSyncing(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.error('No authentication token found');
        setSyncing(false);
        return;
      }

      const response = await axios.get(`${API_URL}/api/chicken-fight/fights/today`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.data.success) {
        setFights(response.data.fights || []);
        setFightNumber(response.data.fightNumber || 0);
        lastSyncRef.current = new Date().getTime();
      }
    } catch (error) {
      console.error('Error loading today\'s fights:', error);
      const savedFights = localStorage.getItem(`chicken-fight-${today}`);
      const savedFightNumber = localStorage.getItem(`chicken-fight-number-${today}`);
      if (savedFights) {
        try {
          setFights(JSON.parse(savedFights));
        } catch (e) {
          console.error('Error parsing saved fights:', e);
        }
      }
      if (savedFightNumber) {
        setFightNumber(parseInt(savedFightNumber) || 0);
      }
    } finally {
      setSyncing(false);
    }
  }, [API_URL, today]);

  const saveFightsToBackend = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.warn('No token available for saving fights');
        localStorage.setItem(`chicken-fight-${today}`, JSON.stringify(fights));
        localStorage.setItem(`chicken-fight-number-${today}`, fightNumber.toString());
        return;
      }

      const response = await axios.post(`${API_URL}/api/chicken-fight/fights/save`, 
        { fights, fightNumber },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        console.log('✅ Fights saved to server');
        lastSyncRef.current = new Date().getTime();
        
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('fightsUpdated', {
            gameDate: today,
            fights,
            fightNumber
          });
          console.log('📡 Socket event emitted to other clients');
        }
      }
      
      localStorage.setItem(`chicken-fight-${today}`, JSON.stringify(fights));
      localStorage.setItem(`chicken-fight-number-${today}`, fightNumber.toString());
    } catch (error) {
      console.error('Error saving fights to backend:', error);
      localStorage.setItem(`chicken-fight-${today}`, JSON.stringify(fights));
      localStorage.setItem(`chicken-fight-number-${today}`, fightNumber.toString());
    }
  }, [fights, fightNumber, today, API_URL]);

  const loadEntries = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await axios.get(`${API_URL}/api/chicken-fight/entries`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.data.success) {
        setEntries(response.data.entries || []);
      }
    } catch (error) {
      console.error('Error loading entries:', error);
    }
  }, [API_URL]);

  const loadRegistrations = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await axios.get(
        `${API_URL}/api/chicken-fight-registration/registrations?gameDate=${today}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (response.data.success) {
        setRegistrations(response.data.registrations || []);
      }
    } catch (error) {
      console.error('Error loading registrations:', error);
    }
  }, [API_URL, today]);

  // Initialize Socket.IO connection
  useEffect(() => {
    const socketUrl = API_URL.replace('/api', '');
    socketRef.current = io(socketUrl, {
      namespace: '/chicken-fight',
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    socketRef.current.on('connect', () => {
      console.log('✅ Connected to Chicken Fight socket');
      // Join room for today's fights
      socketRef.current.emit('joinTodaysFights', { gameDate: today });
    });

    socketRef.current.on('disconnect', () => {
      console.log('❌ Disconnected from Chicken Fight socket');
    });

    // Listen for real-time updates
    socketRef.current.on('fightsUpdated', (data) => {
      console.log('🔄 Fights updated via socket:', data);
      setFights(data.fights);
      setFightNumber(data.fightNumber);
      resetRetry();
    });

    socketRef.current.on('resultsRecorded', (data) => {
      console.log('🏆 Results recorded via socket:', data);
      // Reload fights to get updated results
      loadTodaysFights();
      resetRetry();
    });

    socketRef.current.on('entriesUpdated', (data) => {
      console.log('✏️ Entries updated via socket:', data);
      loadEntries();
      resetRetry();
    });

    socketRef.current.on('registrationsUpdated', (data) => {
      console.log('📝 Registrations updated via socket:', data);
      loadRegistrations();
      resetRetry();
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [today, API_URL, loadTodaysFights, loadEntries, loadRegistrations]);

  // Auto-save fights whenever they change (with debounce to prevent too many saves)
  useEffect(() => {
    if (fights.length === 0 && fightNumber === 0) return;
    
    const debounceTimer = setTimeout(() => {
      console.log('💾 Auto-saving fights...');
      saveFightsToBackend();
    }, 1000); // Wait 1 second after last change before saving
    
    return () => clearTimeout(debounceTimer);
  }, [fights, fightNumber, saveFightsToBackend]);

  // Exponential backoff retry logic
  const setupPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    if (!document.hidden) {
      pollIntervalRef.current = setInterval(() => {
        checkForUpdates();
      }, 5000);
    }
  };

  const checkForUpdates = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('No auth token found for chicken fight sync');
        return;
      }

      const response = await axios.get(`${API_URL}/api/chicken-fight/fights/today`, {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: 10000
      });

      if (response.data.success) {
        resetRetry();
        const serverFights = response.data.fights || [];
        const serverFightNumber = response.data.fightNumber || 0;

        if (JSON.stringify(serverFights) !== JSON.stringify(fights) || 
            serverFightNumber !== fightNumber) {
          console.log('🔄 Syncing chicken fight data from server...');
          setFights(serverFights);
          setFightNumber(serverFightNumber);
          lastSyncRef.current = new Date().getTime();
        }
      }
      }
    } catch (error) {
      if (error.response?.status === 429) {
        console.warn('⏱️ Rate limited - backing off requests');
        // Pause polling on rate limit
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
        // Retry with exponential backoff
        if (await handleRetry()) {
          setTimeout(setupPolling, getRetryDelay());
        }
      } else if (error.response?.status === 401) {
        console.warn('🔐 Auth token issue for chicken fight sync');
        resetRetry();
      } else if (error.response?.status === 500) {
        console.error('❌ Server error:', error.response?.data?.message);
        resetRetry();
      } else if (error.code === 'ECONNABORTED') {
        console.warn('⏱️ Request timeout - checking connectivity');
      } else {
        console.debug('Sync check issue:', error.message);
        resetRetry();
      }
    }
  };

  const handleRetry = async () => {
    if (retryCountRef.current < MAX_RETRIES) {
      retryCountRef.current++;
      console.log(`Retry ${retryCountRef.current}/${MAX_RETRIES}`);
      return true;
    }
    return false;
  };

  // Page visibility listener
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('📴 Page hidden - pausing polling');
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      } else {
        console.log('📱 Page visible - resuming polling');
        setupPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const saveFightsToBackend = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.warn('No token available for saving fights');
        localStorage.setItem(`chicken-fight-${today}`, JSON.stringify(fights));
        localStorage.setItem(`chicken-fight-number-${today}`, fightNumber.toString());
        return;
      }

      const response = await axios.post(`${API_URL}/api/chicken-fight/fights/save`, 
        { fights, fightNumber },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        console.log('✅ Fights saved to server');
        lastSyncRef.current = new Date().getTime();
        
        // 🔄 Emit socket event to notify other clients
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('fightsUpdated', {
            gameDate: today,
            fights,
            fightNumber
          });
          console.log('📡 Socket event emitted to other clients');
        }
      }
      
      // Also save to localStorage as backup
      localStorage.setItem(`chicken-fight-${today}`, JSON.stringify(fights));
      localStorage.setItem(`chicken-fight-number-${today}`, fightNumber.toString());
    } catch (error) {
      console.error('Error saving fights to backend:', error);
      // Still save to localStorage if backend fails
      localStorage.setItem(`chicken-fight-${today}`, JSON.stringify(fights));
      localStorage.setItem(`chicken-fight-number-${today}`, fightNumber.toString());
    }
  }, [fights, fightNumber, today, API_URL]);

  const loadHistoryDates = () => {
    const dates = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('chicken-fight-') && !key.includes('number')) {
        const date = key.replace('chicken-fight-', '');
        if (date !== today && !dates.includes(date)) {
          dates.push(date);
        }
      }
    }
    setHistoryDates(dates.sort().reverse());
  };

  const loadHistoryForDate = async (date) => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.warn('No token available for loading history');
        // Fallback to localStorage
        const savedFights = localStorage.getItem(`chicken-fight-${date}`);
        if (savedFights) {
          try {
            setHistoryFights(JSON.parse(savedFights));
            setSelectedHistoryDate(date);
          } catch (e) {
            console.error('Error parsing history fights:', e);
          }
        }
        return;
      }

      const response = await axios.get(`${API_URL}/api/chicken-fight/fights/${date}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.data.success) {
        setHistoryFights(response.data.fights || []);
        setSelectedHistoryDate(date);
        return;
      }
    } catch (error) {
      console.error('Error loading history fights from backend:', error);
    }

    // Fallback to localStorage
    const savedFights = localStorage.getItem(`chicken-fight-${date}`);
    if (savedFights) {
      try {
        setHistoryFights(JSON.parse(savedFights));
        setSelectedHistoryDate(date);
      } catch (e) {
        console.error('Error parsing history fights:', e);
      }
    }
  };

  const resetToday = () => {
    setFights([]);
    setFightNumber(0);
    setRegistrations([]);
    localStorage.removeItem(`chicken-fight-${today}`);
    localStorage.removeItem(`chicken-fight-number-${today}`);
    saveFightsToBackend();
  };

  const addFight = (fight) => {
    const newFights = [...fights, fight];
    setFights(newFights);
    setFightNumber(fightNumber + 1);
  };

  const updateFight = (index, updatedFight) => {
    const newFights = [...fights];
    newFights[index] = updatedFight;
    setFights(newFights);
  };

  const removeFight = (index) => {
    const newFights = fights.filter((_, i) => i !== index);
    setFights(newFights);
  };

  const value = {
    fights,
    setFights,
    fightNumber,
    setFightNumber,
    entries,
    setEntries,
    registrations,
    setRegistrations,
    historyDates,
    setHistoryDates,
    historyFights,
    setHistoryFights,
    selectedHistoryDate,
    setSelectedHistoryDate,
    today,
    syncing,
    loadHistoryDates,
    loadHistoryForDate,
    resetToday,
    addFight,
    updateFight,
    removeFight,
    loadTodaysFights,
    checkForUpdates,
  };

  return (
    <ChickenFightContext.Provider value={value}>
      {children}
    </ChickenFightContext.Provider>
  );
}
