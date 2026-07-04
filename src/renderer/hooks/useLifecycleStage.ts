// BP078 Lifecycle Stage Tracker -- v0.1.35 foundation

import { useState, useCallback } from 'react';

export type LifecycleStage = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface LifecycleHistoryEntry {
  stage: LifecycleStage;
  timestamp: string;
}

// Stage transition event name for C->D (first_successful_round_trip)
// Handling of D transition is deferred to v0.1.36
export const FIRST_ROUND_TRIP_EVENT = 'first_successful_round_trip';

export const LS_STAGE_KEY = 'mnemosynec_lifecycle_stage';
export const LS_HISTORY_KEY = 'mnemosynec_lifecycle_history';

export function useLifecycleStage() {
  const [stage, setStage] = useState<LifecycleStage>(() => {
    return (localStorage.getItem(LS_STAGE_KEY) as LifecycleStage) || 'A';
  });

  const [history, setHistory] = useState<LifecycleHistoryEntry[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_HISTORY_KEY) || '[]');
    } catch {
      return [];
    }
  });

  const advanceTo = useCallback((newStage: LifecycleStage) => {
    const entry: LifecycleHistoryEntry = { stage: newStage, timestamp: new Date().toISOString() };
    const newHistory = [...history, entry];
    localStorage.setItem(LS_STAGE_KEY, newStage);
    localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(newHistory));
    setStage(newStage);
    setHistory(newHistory);
  }, [history]);

  const resetToWelcome = useCallback(() => {
    localStorage.setItem(LS_STAGE_KEY, 'A');
    localStorage.setItem(LS_HISTORY_KEY, '[]');
    setStage('A');
    setHistory([]);
  }, []);

  return { stage, advanceTo, history, resetToWelcome };
}
