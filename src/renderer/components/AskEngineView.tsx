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
// KN-BP144-8 Phase 1 (2026-08-04) AMENDMENT: the line above was true when D5 landed -- Ask
// did not go through canonical_pipeline.ts at all. It now does, via the NEW
// window.amplify.aiDispatch.queryEngine channel (ai-dispatch:query-engine, separate from the
// plain-chat `query` channel this file's badges above were originally built for). The new
// `stages`/`receipt` fields on AskEngineState below carry that path's real substrate-tier /
// concordance / specialist-outcome / abstain data -- additive, never touching a single
// existing field or stage id above, and absent entirely on a plain-chat turn.
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
//   engine:specialist:<name>           — KN-BP144-8 Phase 1: one live-status row per specialist
//                                         the free-text engine's roster includes for this turn
//   engine:substrate-tier               — badge, only when receipt.servedFromSubstrate === true
//   engine:concordance                  — badge, only when receipt.concordance is present
//   engine:bmv                          — badge, only when receipt.bmvScore is a real number
//   engine:andon                        — badge, only when receipt.andonTriggered === true
//   engine:abstained                    — the abstention banner, only when receipt.abstained

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

/** KN-BP144-8 Phase 1: one live-status row per specialist the free-text engine's roster
 *  includes for this turn, built up incrementally by LeanAskTab.tsx from real
 *  'ask-engine-progress' events (CanonicalPlowProgressEvent's specialist-fire/specialist-done)
 *  -- never a fabricated/simulated list. 'pending' is the honest starting state for every
 *  roster member before its own specialist-fire event has arrived. */
export interface AskEngineSpecialistStage {
  name: string;
  status: 'pending' | 'firing' | 'done';
  candidateCount?: number;
}

/** KN-BP144-8 Phase 1: the free-text engine's own receipt, read verbatim off the
 *  onAskTokenComplete payload's additive `engine` field (see preload.ts's aiDispatch.
 *  onAskTokenComplete type) -- populated by canonical_pipeline.ts's
 *  runCanonicalFreeTextQuestion(), never synthesized by this view. Absent entirely on a
 *  plain-chat (non-engine) turn. */
export interface AskEngineReceipt {
  abstained: boolean;
  abstainReason?: string;
  servedFromSubstrate: boolean;
  substrateTier?: string | null;
  concordance?: string;
  bmvScore?: number;
  gateOutcomes?: Array<{ gate: string; passed: boolean; detail: string }>;
  specialistOutcomes?: Array<{ name: string; fired: boolean; candidateCount: number }>;
  andonTriggered?: boolean;
  andonRetries?: number;
  ebletsWritten?: number;
}

/** Per-message engine state, accumulated live by LeanAskTab.tsx as real events arrive,
 *  then frozen on the message once the turn concludes (replay-able forever after). */
export interface AskEngineState {
  coldStart?: boolean;
  streaming?: boolean;
  completion?: AskEngineCompletion;
  nexus?: AskEngineNexus;
  /** KN-BP144-8 Phase 1, ADDITIVE. Live per-specialist status while the free-text engine's
   *  swarm is running; stays on the message afterward as a record of what actually fired. */
  stages?: AskEngineSpecialistStage[];
  /** KN-BP144-8 Phase 1, ADDITIVE. Set once the engine call resolves. */
  receipt?: AskEngineReceipt;
  /** KN-BP144-8 Phase 1, ADDITIVE: true while the substrate-first check is running, before
   *  the engine has decided whether to short-circuit or fall through to the specialist swarm. */
  substrateChecking?: boolean;
  /** D-BP223-X043-002-A (0.9.40), ADDITIVE. Founder ruling: a near match becomes a SUGGESTION,
   *  never the served answer. Present only when ai-dispatch:query found a stored question that
   *  was similar but NOT identical; this turn's own answer came from the normal answer path.
   *  Read off the query result's `nearMatchSuggestion` field by LeanAskTab.tsx. */
  nearMatchSuggestion?: AskNearMatchSuggestion;
}

export interface AskNearMatchSuggestion {
  question: string;
  answer: string;
  similarity: number;
  ebletId?: string;
  provenance?: string;
  verified?: boolean;
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
  const receipt = engine?.receipt;
  const stages = engine?.stages;
  const done = Boolean(completion) || Boolean(nexus) || Boolean(receipt);
  const coldStart = Boolean(engine?.coldStart);
  const substrateChecking = Boolean(engine?.substrateChecking) && !done;
  const streaming = (Boolean(engine?.streaming) || Boolean(stages && stages.length > 0)) && !done;

  let phaseLabel = 'waiting';
  let phaseColor = '#64748b';
  if (done) {
    phaseLabel = receipt?.abstained ? 'abstained' : 'complete';
    phaseColor = receipt?.abstained ? '#f87171' : '#38bdf8';
  } else if (substrateChecking) {
    phaseLabel = 'checking substrate';
    phaseColor = '#a78bfa';
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
  if (receipt) {
    if (receipt.servedFromSubstrate === true) {
      badges.push({
        stageId: 'engine:substrate-tier',
        color: '#10b981',
        node: <>🎯 Substrate hit — ROOTED ({receipt.substrateTier ?? 'unknown tier'})</>,
      });
    }
    if (receipt.concordance) {
      const concordanceColor = receipt.concordance === 'CONCORDANT' ? '#6ee7b7'
        : receipt.concordance === 'PARTIAL' ? '#fbbf24' : '#f87171';
      badges.push({ stageId: 'engine:concordance', color: concordanceColor, node: <>⚖ {receipt.concordance}</> });
    }
    if (typeof receipt.bmvScore === 'number' && !Number.isNaN(receipt.bmvScore)) {
      badges.push({ stageId: 'engine:bmv', color: '#a78bfa', node: <>BMV {receipt.bmvScore}</> });
    }
    if (receipt.andonTriggered === true) {
      badges.push({
        stageId: 'engine:andon',
        color: '#fbbf24',
        node: <>🔁 Andon retried ({receipt.andonRetries ?? 0}x)</>,
      });
    }
    if (typeof receipt.ebletsWritten === 'number' && receipt.ebletsWritten > 0) {
      badges.push({ stageId: 'engine:eblets-written', color: '#6ee7b7', node: <>+{receipt.ebletsWritten} eblet{receipt.ebletsWritten === 1 ? '' : 's'} written</> });
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

      {/* KN-BP144-8 Phase 1, ticket 1.5: an honest abstention renders as an abstention, never
          a blank bubble or a plain-model answer with the receipt quietly omitted. */}
      {receipt?.abstained === true && (
        <div
          data-stage-id="engine:abstained"
          style={{
            marginTop: 6,
            padding: '6px 10px',
            borderRadius: 6,
            background: 'rgba(248,113,113,0.08)',
            border: '1px solid rgba(248,113,113,0.35)',
            color: '#fca5a5',
            fontSize: 11,
          }}
        >
          ⚠ The engine could not produce an honest answer to this question.
          {receipt.abstainReason ? <> {receipt.abstainReason}</> : null}
        </div>
      )}

      {/* KN-BP144-8 Phase 1: live per-specialist status, ticket 1.3 -- stage by stage, which
          authority fired, which returned nothing, real completion badges, not a spinner. */}
      {stages && stages.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 4, marginTop: 6 }}>
          {stages.map((s) => {
            const dot = s.status === 'done' ? (s.candidateCount && s.candidateCount > 0 ? '🟢' : '⚪')
              : s.status === 'firing' ? '◌' : '⚪';
            const color = s.status === 'done'
              ? (s.candidateCount && s.candidateCount > 0 ? '#6ee7b7' : '#64748b')
              : s.status === 'firing' ? '#fbbf24' : '#334155';
            return (
              <div
                key={s.name}
                data-stage-id={`engine:specialist:${s.name}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 10.5,
                  color,
                  padding: '2px 4px',
                }}
              >
                <span>{dot} {s.name}</span>
                <span>
                  {s.status === 'pending' && 'pending'}
                  {s.status === 'firing' && 'firing…'}
                  {s.status === 'done' && `${s.candidateCount ?? 0} candidate${s.candidateCount === 1 ? '' : 's'}`}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {badges.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginTop: 6 }}>
          {badges.map((b) => (
            <Pill key={b.stageId} stageId={b.stageId} color={b.color}>{b.node}</Pill>
          ))}
        </div>
      )}

      {engine?.nearMatchSuggestion && <NearMatchSuggestionBox suggestion={engine.nearMatchSuggestion} />}
    </div>
  );
}

/** D-BP223-X043-002-A: "A similar question was answered before: open it?" The stored answer is
 *  hidden until the user opens it, and is labeled as the answer to THAT question, never this one. */
function NearMatchSuggestionBox({ suggestion }: { suggestion: AskNearMatchSuggestion }): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <div
      data-stage-id="completion:near-match-suggestion"
      style={{
        marginTop: 6,
        padding: '6px 10px',
        borderRadius: 6,
        background: 'rgba(56,189,248,0.06)',
        border: '1px solid rgba(56,189,248,0.35)',
        color: '#bae6fd',
        fontSize: 11,
      }}
    >
      <div>
        A similar question was answered before: <em>{suggestion.question}</em>{' '}
        <span style={{ color: '#64748b' }}>({formatConfidence(suggestion.similarity)} similar)</span>{' '}
        <button
          type="button"
          data-stage-id="completion:near-match-suggestion:toggle"
          onClick={() => setOpen((v) => !v)}
          style={{
            background: 'none',
            border: '1px solid rgba(56,189,248,0.5)',
            borderRadius: 4,
            color: '#7dd3fc',
            fontSize: 10,
            padding: '1px 6px',
            cursor: 'pointer',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          {open ? 'Close it' : 'Open it?'}
        </button>
      </div>
      {open && (
        <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' as const, color: '#cbd5e1' }}>
          <div style={{ color: '#64748b', fontSize: 10, marginBottom: 2 }}>
            Stored answer to that question (not an answer to yours)
            {suggestion.provenance ? <>. Provenance: {suggestion.provenance}</> : null}
            {suggestion.ebletId ? <>. Card: {suggestion.ebletId.slice(0, 12)}</> : null}
          </div>
          {suggestion.answer}
        </div>
      )}
    </div>
  );
}
