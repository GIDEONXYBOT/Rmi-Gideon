import React, { createContext, useState, useEffect } from 'react';

export const ChickenFightContext = createContext();

export function ChickenFightProvider({ children }) {
  const [fights, setFights] = useState([]);
  const [fightNumber, setFightNumber] = useState(0);
  const [entries, setEntries] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [historyDates, setHistoryDates] = useState([]);
  const [historyFights, setHistoryFights] = useState([]);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(null);

  const today = new Date().toISOString().split('T')[0];

  // Load fights from localStorage on mount
  useEffect(() => {
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
  }, [today]);

  // Save fights to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(`chicken-fight-${today}`, JSON.stringify(fights));
    localStorage.setItem(`chicken-fight-number-${today}`, fightNumber.toString());
  }, [fights, fightNumber, today]);

  // Load history dates on mount
  useEffect(() => {
    loadHistoryDates();
  }, []);

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

  const loadHistoryForDate = (date) => {
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
    loadHistoryDates,
    loadHistoryForDate,
    resetToday,
    addFight,
    updateFight,
    removeFight,
  };

  return (
    <ChickenFightContext.Provider value={value}>
      {children}
    </ChickenFightContext.Provider>
  );
}
