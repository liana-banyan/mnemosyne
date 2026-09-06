// SAGA 4 BP041 — Conjunction State (React context)
// Provides shared conjunction state to ConjunctionPanel + HearthConjunctionWindow
// Extended: agent probe map, tier choice map, API key status, plugin agents
import { createContext, useContext } from 'react';
export const ConjunctionContext = createContext(null);
export function useConjunction() {
    const ctx = useContext(ConjunctionContext);
    if (!ctx)
        throw new Error('useConjunction must be used inside ConjunctionProvider');
    return ctx;
}
// ─── Defaults ────────────────────────────────────────────────────────────────
export const DEFAULT_PANEL_STATE = {
    selected: 'cpu_only',
    per_request_override: null,
    last_dispatch: null,
    in_flight: null,
};
export const DEFAULT_AVAILABILITY = {
    cpu_only: true,
    hearth: false,
    pawn: false,
    rook: false,
    bishop: false,
    knight: false,
    browser_ai: true,
    all_in_conjunction: true,
};
export const DEFAULT_PROBE_MAP = {
    cpu_only: { agentId: 'cpu_only', status: 'available' },
    hearth: { agentId: 'hearth', status: 'unknown' },
    pawn: { agentId: 'pawn', status: 'unknown' },
    rook: { agentId: 'rook', status: 'unknown' },
    bishop: { agentId: 'bishop', status: 'unknown' },
    knight: { agentId: 'knight', status: 'unknown' },
    browser_ai: { agentId: 'browser_ai', status: 'available' },
    all_in_conjunction: { agentId: 'all_in_conjunction', status: 'available' },
};
