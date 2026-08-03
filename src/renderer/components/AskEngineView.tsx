// MnemosyneC · KN-BP143-3 D5 (amended, scoped to real data) · 2026-08-03
// §2 Truth-Always · Founder-ratified
//
// AskEngineView — per-message "live engine view" for the Ask tab (LeanAskTab.tsx).
// Renders a color-coded terminal-style panel that mirrors the REAL token feed for one
// assistant message (cold-start heartbeat → streaming assembled text → final content),
// plus a strip of badges that pop in OUTSIDE the terminal as each real completion/nexus
// field actually arrives. Every terminal line and every badge carries a stable, unique,
// semantic `data-stage-id` (see STAGE IDS below) so each is individually addressable.
//
// HARD CONSTRAINT (Truth-Always, restated per this Yoke): no placeholder stages, no
// simulated progress, no spinner pretending to be work. Every field rendered here is read
// directly off real IPC payloads (onAskTokenProgress / onAskTokenComplete / nexusAskLookupFact)
// that LeanAskTab.tsx already receives — this component fabricates nothing and invents no
// additional stages beyond what those real events actually carry. If a field is absent,
// undefined, null, or false-in-a-non-meaningful-way, nothing renders for it.
//
// There is NO plow tier/authority/abstain data on this path (Ask does not go through
// plow_mc_answerer.ts) — deliberately not represented here. See LeanAskTab.tsx header notes.
//
// STAGE IDS (React keys + data-stage-id, per this Yoke's addressability requirement):
//   cold-start                         — badge, only when this turn's coldStart flag fired
//   token-stream                       — the terminal's live/frozen assembled-text line
//   completion:served-from-substrate   — badge, only when servedFromSubstrate === true
//   completion:provenance              — badge, only when provenance is a non-empty string
//   completion:verified                — badge, only when verified === true
//   completion:cost                    — badge, only when cost_usd is a real number
//   completion:latency                 — badge, only when latency_ms is a real number
//   completion:hot-hits                — badge, only when hotHits > 0
//   completion:self-context            — badge, only when selfContextLoaded === true
//   nexus:authority                    — badge, only when the Nexus browser-authority
//                                         short-circuit actually fired and resolved usable
//   engine-view:toggle / engine-view:collapsed — the expand/collapse control itself

import React, { useState } from 'react';

// ─── Types (shared with LeanAskTab.tsx's per-message state) ─────────────────────────────

/** Fields read verbatim off the real onAskTokenComplete payload — see amplify.d.ts's
 *  aiDispatch.onAskTokenComplete contract, plus the two additive-but-untyped fields
 *  (selfContextLoaded) LeanAskTab.tsx already reads via an `as any` cast at runtime. */
export interface AskEngineCompletion {
  hotHits?: number;
  servedFromSubstrate?: boolean;
  cost_usd?: number;
  latency_ms?: number;
  provenance?: string;
  verified?: boolean;
  selfContextLoaded?: boolean;
}

/** Present only when the Nexus researchArmMode + researchArmBrowserAuthority short-circuit
 *  (window.amplify.nexusAskLookupFact) actually resolved usable:true for this turn. */
export interface AskEngineNexus {
  authority: 'user_google' | 'user_perplexity';
  sourceUrl: string;
  confidence?: number;
}

/** Per-message engine state, accumulated live by LeanAskTab.tsx as real events arrive,
 *  then frozen on the message once the turn concludes (replay-able forever after). */
export interface AskEngineState {
  coldStart?: boolean;
  streaming?: boolean;
  completion?: AskEngineCompletion;
  nexus?: AskEngineNexus;
}

// ─── Formatting helpers ───────────────────────────────────────────────────────────────────

function formatCost(v: number): string {
  return `$${v.toFixed(4)}`;
}

function formatLatency(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`;
}

function formatConfidence(v: number): string {
  return `${Math.round(v * 100)}%`;
}

// ─── Badge pill ───────────────────────────────────────────────────────────────────────────

function Pill({ stageId, color, children }: { stageId: string; color: string; children: React.ReactNode }) {
  return (
    <span
      data-stage-id={stageId}
      style={{
        fontSize: 10,
        fontWeight: 600,
        padding: '3px 8px',
        borderRadius: 4,
        background: `${color}22`,
        border: `1px solid ${color}`,
        color,
        whiteSpace: 'nowrap' as const,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {children}
    </span>
  );
}

// ─── AskEngineView ──────────────────────────────────────────────────────────────────────

interface AskEngineViewProps {
  messageId: string;
  /** The message's current/final content (same text LeanAskTab.tsx's MsgBubble already
   *  shows) — the terminal is a color-coded terminal-style PRESENTATION of this exact real
   *  text, not a fabricated parallel stream. */
  liveText: string;
  engine?: AskEngineState;
  onOpenExternal?: (url: string) => void;
}

export function AskEngineView({ messageId, liveText, engine, onOpenExternal }: AskEngineViewProps): React.ReactElement {
  const [expanded, setExpanded] = useState(true);

  const completion = engine?.completion;
  const nexus = engine?.nexus;
  const done = Boolean(completion) || Boolean(nexus);
  const coldStart = Boolean(engine?.coldStart);
  const streaming = Boolean(engine?.streaming) && !done;

  let phaseLabel = 'waiting';
  let phaseColor = '#64748b';
  if (done) {
    phaseLabel = 'complete';
    phaseColor = '#38bdf8';
  } else if (streaming) {
    phaseLabel = 'streaming';
    phaseColor = '#34d399';
  } else if (coldStart) {
    phaseLabel = 'cold-start';
    phaseColor = '#f59e0b';
  }

  const badges: Array<{ stageId: string; color: string; node: React.ReactNode }> = [];

  if (coldStart) {
    badges.push({ stageId: 'cold-start', color: '#f59e0b', node: <>❄ Cold start</> });
  }
  if (completion) {
    if (completion.servedFromSubstrate === true) {
      badges.push({ stageId: 'completion:served-from-substrate', color: '#10b981', node: <>🎯 Served free (substrate)</> });
    }
    if (completion.provenance) {
      badges.push({ stageId: 'completion:provenance', color: '#94a3b8', node: <>Provenance: {completion.provenance}</> });
    }
    if (completion.verified === true) {
      badges.push({ stageId: 'completion:verified', color: '#6ee7b7', node: <>✓ Verified / corroborated</> });
    }
    if (typeof completion.cost_usd === 'number' && !Number.isNaN(completion.cost_usd)) {
      badges.push({ stageId: 'completion:cost', color: '#a78bfa', node: <>💰 {formatCost(completion.cost_usd)}</> });
    }
    if (typeof completion.latency_ms === 'number' && !Number.isNaN(completion.latency_ms)) {
      badges.push({ stageId: 'completion:latency', color: '#60a5fa', node: <>⏱ {formatLatency(completion.latency_ms)}</> });
    }
    if (typeof completion.hotHits === 'number' && completion.hotHits > 0) {
      badges.push({ stageId: 'completion:hot-hits', color: '#fbbf24', node: <>🔥 {completion.hotHits} hot hit{completion.hotHits === 1 ? '' : 's'}</> });
    }
    if (completion.selfContextLoaded === true) {
      badges.push({ stageId: 'completion:self-context', color: '#6ee7b7', node: <>🧠 Self-Context loaded</> });
    }
  }
  if (nexus) {
    badges.push({
      stageId: 'nexus:authority',
      color: '#c4b5fd',
      node: (
        <>
          🔗 {nexus.authority === 'user_perplexity' ? 'Perplexity' : 'Google'} (your session)
          {typeof nexus.confidence === 'number' && <> · {formatConfidence(nexus.confidence)}</>}
          {' · '}
          <a
            href={nexus.sourceUrl}
            onClick={(e) => { e.preventDefault(); onOpenExternal?.(nexus.sourceUrl); }}
            style={{ color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}
          >
            source
          </a>
        </>
      ),
    });
  }

  if (!expanded) {
    return (
      <div style={{ marginTop: 6 }} data-message-id={messageId}>
        <button
          type="button"
          data-stage-id="engine-view:collapsed"
          onClick={() => setExpanded(true)}
          style={{
            background: 'none',
            border: '1px solid #1e2a38',
            borderRadius: 5,
            color: '#64748b',
            fontSize: 10,
            padding: '2px 8px',
            cursor: 'pointer',
            fontFamily: 'system-ui, sans-serif',
            outline: 'none',
          }}
        >
          ▶ Engine View{badges.length > 0 ? ` (${badges.length})` : ''}
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 6, maxWidth: '78%' }} data-message-id={messageId}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: '#475569', fontWeight: 700, letterSpacing: 0.4 }}>
          ENGINE VIEW
        </span>
        <button
          type="button"
          data-stage-id="engine-view:toggle"
          onClick={() => setExpanded(false)}
          style={{
            background: 'none',
            border: 'none',
            color: '#64748b',
            fontSize: 10,
            cursor: 'pointer',
            padding: 0,
            fontFamily: 'system-ui, sans-serif',
            outline: 'none',
          }}
        >
          ▲ collapse
        </button>
      </div>

      <div
        data-stage-id="token-stream"
        style={{
          background: '#05070a',
          border: '1px solid #1e2a38',
          borderRadius: 6,
          padding: '8px 10px',
          fontFamily: "'SF Mono', 'Cascadia Code', Consolas, monospace",
          fontSize: 11.5,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap' as const,
          wordBreak: 'break-word' as const,
          maxHeight: 220,
          overflowY: 'auto' as const,
        }}
      >
        <span style={{ color: phaseColor, fontWeight: 700 }}>[{phaseLabel}]</span>{' '}
        <span style={{ color: done ? '#94a3b8' : phaseColor }}>{liveText}</span>
        {!done && <span style={{ opacity: 0.6, color: phaseColor }}>▋</span>}
      </div>

      {badges.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginTop: 6 }}>
          {badges.map((b) => (
            <Pill key={b.stageId} stageId={b.stageId} color={b.color}>{b.node}</Pill>
          ))}
        </div>
      )}
    </div>
  );
}
