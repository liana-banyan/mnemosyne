// SAGA 4 BP041 — In Conjunction 8-Agent Panel
// Replaces fixed 4-mode roster with extensible InConjunctionAgent[] array.
// 8 built-in agents: CPU Only / Hearth / Pawn / Rook / Bishop / Knight / Browser AI / All In Conjunction
// Per-row: icon + name (Helena subtitle) + tier dropdown + availability dot
// R-FOUNDER-NAMING-PROVENANCE: Bishop/Knight/Pawn/Rook names locked.
// 8-dim accessibility from minute one: aria-pressed, aria-disabled, role, title.

import { useState, useCallback, useMemo } from 'react';
import type {
  ConjunctionAgentId,
  ConjunctionPanelState,
  AgentProbeResult,
  AgentProbeStatus,
  InConjunctionAgent,
  TierChoiceMap,
  ApiKeyStatusMap,
} from './types';
import { TierSelect } from './TierSelect';

// ─── Built-in agent roster (order = display order) ───────────────────────────

export const BUILTIN_AGENTS: InConjunctionAgent[] = [
  {
    id: 'cpu_only',
    displayName: 'CPU Only',
    subtitle: 'Rule-based · substrate lookup · zero model spend',
    icon: '⚙️',
    alwaysAvailable: true,
    source: 'builtin',
  },
  {
    id: 'hearth',
    displayName: 'Hearth',
    subtitle: 'Local Ollama on your machine · zero marginal cost',
    icon: '🔥',
    tiers: [
      { id: 'hearth_1b', label: 'llama3.2:1b', tierClass: 'cheap', modelId: 'llama3.2:1b' },
      { id: 'hearth_3b', label: 'llama3.2:3b', tierClass: 'balanced', modelId: 'llama3.2:3b' },
      { id: 'hearth_8b', label: 'llama3.1:8b', tierClass: 'flagship', modelId: 'llama3.1:8b' },
    ],
    source: 'builtin',
  },
  {
    id: 'pawn',
    displayName: 'Pawn',
    subtitle: 'Perplexity Models · search-grounded reasoning',
    icon: '♟',
    tiers: [
      { id: 'pawn_flagship', label: '🔥 Sonar Pro', tierClass: 'flagship', modelId: 'sonar-pro' },
      { id: 'pawn_balanced', label: '⚖️ Sonar', tierClass: 'balanced', modelId: 'sonar' },
      { id: 'pawn_cheap', label: '💰 Sonar-small', tierClass: 'cheap', modelId: 'sonar-small' },
    ],
    requiresKey: 'PERPLEXITY_API_KEY',
    source: 'builtin',
  },
  {
    id: 'rook',
    displayName: 'Rook',
    subtitle: 'Gemini Models · multi-surface stanchion',
    icon: '♜',
    tiers: [
      { id: 'rook_flagship', label: '🔥 2.5 Pro', tierClass: 'flagship', modelId: 'gemini-2.5-pro' },
      { id: 'rook_balanced', label: '⚖️ 2.5 Flash', tierClass: 'balanced', modelId: 'gemini-2.5-flash' },
      { id: 'rook_cheap', label: '💰 2.5 Flash-Lite', tierClass: 'cheap', modelId: 'gemini-2.5-flash-lite' },
    ],
    requiresKey: 'GOOGLE_API_KEY',
    source: 'builtin',
  },
  {
    id: 'bishop',
    displayName: 'Bishop',
    subtitle: 'Claude Models · architectural class',
    icon: '♝',
    tiers: [
      { id: 'bishop_flagship', label: '🔥 Opus 4.7', tierClass: 'flagship', modelId: 'claude-opus-4-7' },
      { id: 'bishop_balanced', label: '⚖️ Sonnet 4.7', tierClass: 'balanced', modelId: 'claude-sonnet-4-7' },
      { id: 'bishop_cheap', label: '💰 Haiku 4.7', tierClass: 'cheap', modelId: 'claude-haiku-4-7' },
    ],
    requiresKey: 'ANTHROPIC_API_KEY',
    source: 'builtin',
  },
  {
    id: 'knight',
    displayName: 'Knight',
    subtitle: 'Cursor · routes via Yoke async bridge',
    icon: '♞',
    tiers: [
      { id: 'knight_flagship', label: '🔥 Flagship', tierClass: 'flagship', modelId: 'cursor-flagship' },
      { id: 'knight_balanced', label: '⚖️ Balanced', tierClass: 'balanced', modelId: 'cursor-balanced' },
      { id: 'knight_cheap', label: '💰 Cheap', tierClass: 'cheap', modelId: 'cursor-cheap' },
    ],
    source: 'builtin',
  },
  {
    id: 'browser_ai',
    displayName: 'Browser AI',
    subtitle: 'Use what you already have · ChatGPT / Claude.ai / Gemini / Comet',
    icon: '🌐',
    alwaysAvailable: true,
    source: 'builtin',
  },
  {
    id: 'all_in_conjunction',
    displayName: 'All In Conjunction',
    subtitle: 'Parallel fan-out to all enabled + composite synthesis',
    icon: '🔀',
    alwaysAvailable: true,
    source: 'builtin',
  },
];

// ─── Default tier selections ─────────────────────────────────────────────────

export const DEFAULT_TIER_CHOICES: TierChoiceMap = {
  hearth: 'hearth_8b',
  pawn: 'pawn_balanced',
  rook: 'rook_balanced',
  bishop: 'bishop_balanced',
  knight: 'knight_balanced',
};

// ─── Probe status helpers ─────────────────────────────────────────────────────

function probeStatusDot(status: AgentProbeStatus): { color: string; label: string } {
  switch (status) {
    case 'available':   return { color: '#22c55e', label: 'ready' };
    case 'probing':     return { color: '#f6ad55', label: 'probing…' };
    case 'unavailable': return { color: '#ef4444', label: 'unavailable' };
    case 'missing_key': return { color: '#f6ad55', label: 'missing API key' };
    default:            return { color: '#4a5568', label: 'unchecked' };
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ConjunctionPanelProps {
  panelState: ConjunctionPanelState;
  agents?: InConjunctionAgent[];         // builtins + plugins; defaults to BUILTIN_AGENTS
  probeMap?: Record<string, AgentProbeResult>;
  tierChoices?: TierChoiceMap;
  apiKeyStatus?: ApiKeyStatusMap;
  onSelect: (mode: ConjunctionAgentId) => Promise<void>;
  onShiftClick?: (mode: ConjunctionAgentId) => void;
  onProbeAgent?: (agentId: ConjunctionAgentId) => Promise<AgentProbeResult>;
  onTierChange?: (agentId: ConjunctionAgentId, tierId: string) => void;
  onOpenApiKeySettings?: (agentId?: ConjunctionAgentId) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ConjunctionPanel({
  panelState,
  agents = BUILTIN_AGENTS,
  probeMap = {},
  tierChoices = DEFAULT_TIER_CHOICES,
  apiKeyStatus = {},
  onSelect,
  onShiftClick,
  onProbeAgent,
  onTierChange,
  onOpenApiKeySettings,
}: ConjunctionPanelProps) {
  const [selecting, setSelecting] = useState<ConjunctionAgentId | null>(null);
  const [tooltip, setTooltip] = useState<string | null>(null);

  const effectiveAgents = useMemo(() => agents, [agents]);

  const getProbeStatus = useCallback(
    (agent: InConjunctionAgent): AgentProbeStatus => {
      if (agent.alwaysAvailable) return 'available';
      if (agent.requiresKey && apiKeyStatus[agent.id] === false) return 'missing_key';
      return probeMap[agent.id]?.status ?? 'unknown';
    },
    [probeMap, apiKeyStatus],
  );

  const isClickable = useCallback(
    (agent: InConjunctionAgent): boolean => {
      const status = getProbeStatus(agent);
      return status === 'available' || agent.alwaysAvailable === true;
    },
    [getProbeStatus],
  );

  const handleClick = useCallback(
    async (e: React.MouseEvent, agent: InConjunctionAgent) => {
      const status = getProbeStatus(agent);

      if (status === 'missing_key') {
        onOpenApiKeySettings?.(agent.id);
        return;
      }

      if (!isClickable(agent)) {
        if (onProbeAgent) {
          await onProbeAgent(agent.id);
        }
        return;
      }

      if (e.shiftKey && onShiftClick) {
        onShiftClick(agent.id);
        return;
      }

      setSelecting(agent.id);
      await onSelect(agent.id);
      setSelecting(null);
    },
    [getProbeStatus, isClickable, onSelect, onShiftClick, onProbeAgent, onOpenApiKeySettings],
  );

  return (
    <div style={styles.panel} role="region" aria-label="In Conjunction agent selector">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={styles.header}>
        <span style={styles.headerIcon} aria-hidden="true">🔀</span>
        <span style={styles.headerTitle}>In Conjunction</span>
        {panelState.in_flight && (
          <span style={styles.inflight} role="status" aria-live="polite">
            ● {panelState.in_flight.mode}…
          </span>
        )}
      </div>

      {/* ── Agent list ─────────────────────────────────────────────── */}
      <div style={styles.agentList} role="listbox" aria-label="Select an agent mode">
        {effectiveAgents.map((agent) => {
          const selected = panelState.selected === agent.id;
          const override = panelState.per_request_override === agent.id;
          const busy = selecting === agent.id;
          const probeStatus = getProbeStatus(agent);
          const { color: dotColor, label: dotLabel } = probeStatusDot(probeStatus);
          const clickable = isClickable(agent);
          const isMissingKey = probeStatus === 'missing_key';
          const selectedTierId = tierChoices[agent.id] ?? agent.tiers?.[0]?.id ?? '';

          return (
            <button
              key={agent.id}
              role="option"
              aria-selected={selected}
              aria-pressed={selected}
              aria-disabled={busy || (!clickable && !isMissingKey)}
              aria-describedby={`agent-desc-${agent.id}`}
              style={{
                ...styles.agentBtn,
                ...(selected ? styles.agentBtnSelected : {}),
                ...(override ? styles.agentBtnOverride : {}),
                ...(busy ? styles.agentBtnBusy : {}),
                opacity: (clickable || isMissingKey) ? 1 : 0.45,
                cursor: clickable ? 'pointer' : isMissingKey ? 'pointer' : 'default',
              }}
              onClick={(e) => handleClick(e, agent)}
              onMouseEnter={() =>
                setTooltip(
                  isMissingKey
                    ? `${agent.displayName}: Missing API key — click to open Settings`
                    : probeMap[agent.id]?.reason ?? dotLabel,
                )
              }
              onMouseLeave={() => setTooltip(null)}
              disabled={busy}
            >
              {/* Top row: icon + name + dot + tier dropdown */}
              <div style={styles.agentBtnTop}>
                <span style={styles.agentIcon} aria-hidden="true">{agent.icon}</span>
                <span style={styles.agentName}>{agent.displayName}</span>

                {/* Tier dropdown (inline, stops click propagation) */}
                {agent.tiers && agent.tiers.length > 0 && (
                  <span onClick={(e) => e.stopPropagation()}>
                    <TierSelect
                      agentId={agent.id}
                      tiers={agent.tiers}
                      selectedTierId={selectedTierId}
                      onSelect={(tierId) => onTierChange?.(agent.id, tierId)}
                      disabled={!clickable && !isMissingKey}
                    />
                  </span>
                )}

                {/* Status dot */}
                <span
                  style={{ ...styles.statusDot, background: dotColor }}
                  title={dotLabel}
                  aria-label={`Status: ${dotLabel}`}
                />
              </div>

              {/* Subtitle row */}
              <div id={`agent-desc-${agent.id}`} style={styles.agentSubtitle}>
                {isMissingKey
                  ? <span style={styles.missingKeyHint}>⚠ Missing API key — click to configure</span>
                  : agent.subtitle}
              </div>

              {/* One-shot override badge */}
              {override && (
                <div style={styles.overrideTag} aria-label="One-shot override active">ONCE</div>
              )}

              {/* Plugin badge */}
              {agent.source === 'plugin' && (
                <div style={styles.pluginTag} aria-label="Community plugin">PLUGIN</div>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tooltip ────────────────────────────────────────────────── */}
      {tooltip && (
        <div style={styles.tooltip} role="tooltip" aria-live="polite">{tooltip}</div>
      )}

      {/* ── Last dispatch ──────────────────────────────────────────── */}
      {panelState.last_dispatch && (
        <div style={styles.lastDispatch} role="status" aria-live="polite">
          <span style={{ color: panelState.last_dispatch.success ? '#22c55e' : '#ef4444' }}>
            {panelState.last_dispatch.success ? '✓' : '✗'}
          </span>
          {' '}Last: {panelState.last_dispatch.mode} · {panelState.last_dispatch.latency_ms}ms
        </div>
      )}

      {/* ── Footer hint ────────────────────────────────────────────── */}
      <div style={styles.hint}>
        Shift+click = one-shot override · missing key row opens Settings
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  panel: {
    background: '#1a1a2e',
    color: '#e2e8f0',
    borderRadius: '12px',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    height: '100%',
    boxSizing: 'border-box',
    border: '1px solid #2d3748',
    overflowY: 'auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.25rem',
    flexShrink: 0,
  },
  headerIcon: { fontSize: '1.1rem' },
  headerTitle: {
    fontWeight: 700,
    fontSize: '0.95rem',
    color: '#f6ad55',
    letterSpacing: '0.03em',
    flex: 1,
  },
  inflight: {
    fontSize: '0.7rem',
    color: '#68d391',
  },
  agentList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    flex: 1,
  },
  agentBtn: {
    background: '#2d3748',
    border: '1px solid #4a5568',
    borderRadius: '8px',
    padding: '0.45rem 0.65rem',
    color: '#e2e8f0',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'background 0.15s, border-color 0.15s',
    position: 'relative',
    width: '100%',
  },
  agentBtnSelected: {
    background: '#2c5282',
    borderColor: '#63b3ed',
  },
  agentBtnOverride: {
    background: '#3d2c00',
    borderColor: '#f6ad55',
  },
  agentBtnBusy: {
    background: '#1a2744',
    borderColor: '#90cdf4',
  },
  agentBtnTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
  },
  agentIcon: {
    fontSize: '0.9rem',
    flexShrink: 0,
  },
  agentName: {
    fontWeight: 600,
    fontSize: '0.85rem',
    flex: 1,
  },
  statusDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  agentSubtitle: {
    fontSize: '0.68rem',
    color: '#a0aec0',
    marginTop: '0.18rem',
    lineHeight: 1.35,
    paddingLeft: '1.4rem',
  },
  missingKeyHint: {
    color: '#f6ad55',
    fontStyle: 'italic',
  },
  overrideTag: {
    position: 'absolute',
    top: '4px',
    right: '6px',
    fontSize: '0.58rem',
    background: '#f6ad55',
    color: '#1a202c',
    borderRadius: '3px',
    padding: '1px 4px',
    fontWeight: 700,
  },
  pluginTag: {
    position: 'absolute',
    bottom: '4px',
    right: '6px',
    fontSize: '0.56rem',
    background: '#553c9a',
    color: '#e9d8fd',
    borderRadius: '3px',
    padding: '1px 4px',
    fontWeight: 700,
  },
  tooltip: {
    background: '#4a5568',
    color: '#e2e8f0',
    borderRadius: '6px',
    padding: '0.35rem 0.55rem',
    fontSize: '0.7rem',
    lineHeight: 1.4,
    flexShrink: 0,
  },
  lastDispatch: {
    fontSize: '0.7rem',
    color: '#718096',
    borderTop: '1px solid #2d3748',
    paddingTop: '0.35rem',
    flexShrink: 0,
  },
  hint: {
    fontSize: '0.62rem',
    color: '#4a5568',
    textAlign: 'right',
    flexShrink: 0,
  },
};
