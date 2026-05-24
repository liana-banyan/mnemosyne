// SAGA 4 BP041 — Conjunction State (React context)
// Provides shared conjunction state to ConjunctionPanel + HearthConjunctionWindow
// Extended: agent probe map, tier choice map, API key status, plugin agents

import { createContext, useContext } from 'react';
import type {
  ConjunctionAgentId,
  ConjunctionMode,
  ConjunctionPanelState,
  ConjunctionResult,
  BackendAvailability,
  AgentProbeResult,
  TierChoiceMap,
  ApiKeyStatusMap,
  InConjunctionAgent,
} from './types';

// Re-export for consumers who import from this module
export type { ConjunctionMode };

export interface ConjunctionContextValue {
  panelState: ConjunctionPanelState;
  availability: BackendAvailability;
  lastResult: ConjunctionResult | null;
  /** All registered agents (builtins + loaded plugins) */
  agents: InConjunctionAgent[];
  /** Per-agent probe results (status dots) */
  probeMap: Record<string, AgentProbeResult>;
  /** Per-agent selected tier */
  tierChoices: TierChoiceMap;
  /** Whether each agent's API key is configured (R16: values never here) */
  apiKeyStatus: ApiKeyStatusMap;
  selectMode: (mode: ConjunctionAgentId) => Promise<void>;
  dispatch: (prompt: string, mode_override?: ConjunctionAgentId) => Promise<ConjunctionResult | null>;
  refreshAvailability: () => Promise<void>;
  /** Trigger a live probe for a specific agent */
  probeAgent: (agentId: ConjunctionAgentId) => Promise<AgentProbeResult>;
  /** Set tier choice for an agent (persisted) */
  setTierChoice: (agentId: ConjunctionAgentId, tierId: string) => void;
  /** Open Settings → API Keys section */
  openApiKeySettings: (agentId?: ConjunctionAgentId) => void;
}

export const ConjunctionContext = createContext<ConjunctionContextValue | null>(null);

export function useConjunction(): ConjunctionContextValue {
  const ctx = useContext(ConjunctionContext);
  if (!ctx) throw new Error('useConjunction must be used inside ConjunctionProvider');
  return ctx;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_PANEL_STATE: ConjunctionPanelState = {
  selected: 'cpu_only',
  per_request_override: null,
  last_dispatch: null,
  in_flight: null,
};

export const DEFAULT_AVAILABILITY: BackendAvailability = {
  cpu_only: true,
  hearth: false,
  pawn: false,
  rook: false,
  bishop: false,
  knight: false,
  browser_ai: true,
  all_in_conjunction: true,
};

export const DEFAULT_PROBE_MAP: Record<string, AgentProbeResult> = {
  cpu_only: { agentId: 'cpu_only', status: 'available' },
  hearth: { agentId: 'hearth', status: 'unknown' },
  pawn: { agentId: 'pawn', status: 'unknown' },
  rook: { agentId: 'rook', status: 'unknown' },
  bishop: { agentId: 'bishop', status: 'unknown' },
  knight: { agentId: 'knight', status: 'unknown' },
  browser_ai: { agentId: 'browser_ai', status: 'available' },
  all_in_conjunction: { agentId: 'all_in_conjunction', status: 'available' },
};
