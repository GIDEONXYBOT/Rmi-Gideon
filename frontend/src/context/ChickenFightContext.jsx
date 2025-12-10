import React, { createContext, useState, useEffect, useRef } from 'react';
import axios from 'axios';
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
  const pollIntervalRef = useRef(null);
  const lastSyncRef = useRef(null);

  const today = new Date().toISOString().split('T')[0];
  const API_URL = getApiUrl();

  // Load fights from backend on mount
  useEffect(() => {
    loadTodaysFights();
    // Start polling for updates every 2 seconds
    startPolling();

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [today]);

  // Save fights to backend whenever they change
  useEffect(() => {
    if (fights.length > 0 || fightNumber > 0) {
      saveFightsToBackend();
    }
  }, [fights, fightNumber]);

  const startPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(() => {
      checkForUpdates();
    }, 2000); // Poll every 2 seconds
  };

  const checkForUpdates = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('No auth token found for chicken fight sync');
        return;
      }

      const response = await axios.get(`${API_URL}/api/chicken-fight/fights/today`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.data.success) {
        const serverFights = response.data.fights || [];
        const serverFightNumber = response.data.fightNumber || 0;

        // Only update if data is different (to avoid unnecessary re-renders)
        if (JSON.stringify(serverFights) !== JSON.stringify(fights) || 
            serverFightNumber !== fightNumber) {
          console.log('🔄 Syncing chicken fight data from server...');
          setFights(serverFights);
          setFightNumber(serverFightNumber);
          lastSyncRef.current = new Date().getTime();
        }
      }
    } catch (error) {
      // Silent fail on polling errors
      console.debug('Polling update check failed (this is normal):', error.message);
    }
  };

  const loadTodaysFights = async () => {
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
      // Fallback to localStorage if backend fails
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
  };

  const saveFightsToBackend = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.warn('No token available for saving fights');
        // Still save to localStorage as backup
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
  };

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
