// useDeckCue.ts — Shared Deck Cue Card hook · BP067 Phase 3A
// Manages the bottom-sheet pullup state and cue card queue.
// Shared by BatteryDispatchTab (T15) and BroadcastScheduleTab (T16).

import { useState, useCallback } from 'react';
import { getHenNarration, type HenContext } from '../lib/little_red_hen';

export interface CueCard {
  id: string;
  title: string;
  body: string;
  context: HenContext;
}

export function useDeckCue() {
  const [cards, setCards] = useState<CueCard[]>([]);
  const [isPullupOpen, setIsPullupOpen] = useState(false);

  /** Show a cue card for the given context. Opens the pullup automatically. */
  const showCard = useCallback((context: HenContext, title?: string) => {
    const card: CueCard = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: title ?? contextTitle(context),
      body: getHenNarration(context),
      context,
    };
    setCards((prev) => {
      const trimmed = prev.slice(-2); // keep max 3 cards at once
      return [...trimmed, card];
    });
    setIsPullupOpen(true);
  }, []);

  /** Dismiss a single card by id. Closes the pullup when no cards remain. */
  const dismissCard = useCallback((id: string) => {
    setCards((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (next.length === 0) setIsPullupOpen(false);
      return next;
    });
  }, []);

  /** Dismiss all cards and close the pullup. */
  const closePullup = useCallback(() => {
    setCards([]);
    setIsPullupOpen(false);
  }, []);

  const openPullup = useCallback(() => setIsPullupOpen(true), []);

  return { cards, showCard, dismissCard, isPullupOpen, openPullup, closePullup };
}

function contextTitle(ctx: HenContext): string {
  switch (ctx) {
    case 'dispatch':     return '⚡ Dispatch recorded';
    case 'broadcast':    return '📡 Broadcast scheduled';
    case 'schedule':     return '📅 Meal scheduled';
    case 'join':         return '🌐 Join the cooperative';
    case 'folder_added': return '📂 Folder indexed';
  }
}
