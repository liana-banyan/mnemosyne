// compass/SwappableTerminalPanes.tsx -- D-M3004-023/BISHOP-M0/prove-it-button
//
// ADDITIVE ONLY. Does not import, render, or modify OneClickMeshTestPanel.tsx, ProofTab.tsx,
// or ProveItWorksTab.tsx -- the Founder's own words on the existing "Prove It Now" surface:
// "don't mess up what we already have, I like it." This is a NEW, separate surface, reached
// from More > Terminal Panes, that puts the button he asked for ("a button that runs one
// question and shows one receipt landing in the other pane") directly in MnemosyneC instead
// of a standalone node script beside it.
//
// THE SEAM, STATED EXPLICITLY (per M0's ask -- build against this, not today's answering
// internals):
//   This file calls ONLY the existing, already-shipped renderer<->main IPC contract:
//     - window.amplify.meshTestRunOneClick(config)   -- fires one scored run, optionally
//       scoped to a single question via `questionIds: [id]` (BP140-K6's existing subset
//       scoping -- this file adds no new IPC channel, no new main-process handler).
//     - window.amplify.onMeshTestProgress(cb)         -- the existing live progress stream
//       ('mesh-test:progress'): start / peers-discovered / question-start / question-complete
//       (carries the real per-question outcome incl. plowTrace) / complete (carries the full
//       OneClickRunResult).
//   Both are the SAME two calls OneClickMeshTestPanel.tsx and MeshTestTerminalTab.tsx already
//   use in production. This file does not import plow_mc_answerer.ts, one_click_mmlu_pro.ts,
//   or any Liana Cycle internals directly, and does not know or care what backend those IPC
//   handlers route through. Per BISHOP-M0: hex connectors are not yet wired into the Liana
//   Cycle execution path as of this dispatch and that wiring is in progress elsewhere -- this
//   button is deliberately built against the STABLE IPC CONTRACT, not against any specific
//   backend file, so it requires zero changes when that wiring lands underneath it.
//
// PANES ARE MULTI-PURPOSE, PER THE FOUNDER'S OWN INSTRUCTION ("those terminal panes are
// multi-purpose btw, don't forget that - they have dropdowns or buttons to decide what they
// are being used for... you can run all of them, and switch, if you have enough swappable
// brains to go around"): every pane carries a role dropdown (PaneRole below); the smallest
// working default is 2 panes (Run Proof / Receipts), but panes can be added, removed, or
// re-roled freely -- N panes, not 2 fixed ones. The practical number of panes usefully
// running AT ONCE is bounded by this codebase's existing single-flight lock on the full
// pipeline driver (`running` singleton in one_click_mmlu_pro.ts, confirmed by direct read
// during this dispatch's recon) -- two panes both set to "Run Proof" will queue rather than
// run concurrently. That is an honest architectural fact, documented inline below at the
// trigger button, not hidden.
//
// "The receipts are the real work-receipt JSON, not a prettified summary": the Receipts pane
// renders the exact outcome object (and the exact final OneClickRunResult) the IPC stream
// delivered, via JSON.stringify(..., null, 2) -- no field is dropped, renamed, or summarized
// before display. A best-effort clickable provenance layer sits ALONGSIDE that raw JSON (see
// ProvenanceChips below), because this dispatch's recon found the existing
// OneClickMeshTestPanel.tsx's own ProvenanceReceiptRow renders `source`/`verified`/
// `contentHash` but never renders or links `provenanceUrl` even though the type carries it --
// a real gap between the Founder's memory of "provenance to click and see the sources" and
// what ships today. This file does not touch that existing component; it adds the missing
// click-through independently, on the same outcome shape, in this new surface only.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MeshTestTerminalTab } from '../MeshTestTerminalTab';

// Mirrors QuestionOutcome / OneClickRunResult shapes from OneClickMeshTestPanel.tsx closely
// enough to render safely; kept intentionally loose (most fields optional/unknown) because
// this file must not depend on that file's internal types -- an independent, additive reader
// of the same wire shape, not a shared import.
interface ProvenanceReceiptLike {
  source?: string;
  contentHash?: string;
  verified?: boolean;
  provenanceUrl?: string;
}

interface QuestionOutcomeLike {
  question_id?: number | string;
  question?: string;
  category?: string;
  correctLetter?: string;
  parsedLetter?: string | null;
  isCorrect?: boolean;
  latencyMs?: number;
  answeredBy?: string;
  plowTrace?: { provenance_receipts?: ProvenanceReceiptLike[]; [k: string]: unknown } | null;
  [k: string]: unknown;
}

type ProgressEvent =
  | { type: 'start'; total: number }
  | { type: 'peers-discovered'; count: number }
  | { type: 'question-start'; index: number; total: number; question: string; category: string }
  | { type: 'question-complete'; index: number; total: number; outcome: QuestionOutcomeLike }
  | { type: 'complete'; result: { outcomes?: QuestionOutcomeLike[]; [k: string]: unknown } };

// HARDWIRE-01's standing 20-id scored set (confirmed by this dispatch's recon of
// KN-BP144-18's own citation) -- offered as quick picks; free-text entry remains available so
// this is never the only way to pick a question.
const STANDING_20_IDS = [1, 7, 14, 20, 27, 33, 40, 46, 53, 59, 66, 72, 79, 85, 92, 98, 105, 111, 118, 124];

type PaneRole = 'idle' | 'run-proof' | 'receipts' | 'diagnostic-terminal';

const ROLE_LABELS: Record<PaneRole, string> = {
  idle: 'Idle (unassigned)',
  'run-proof': 'Run Proof (one question)',
  receipts: 'Receipts (live JSON)',
  'diagnostic-terminal': 'Diagnostic Terminal (existing)',
};

interface PaneState {
  id: number;
  role: PaneRole;
}

let paneIdSeq = 0;
function nextPaneId(): number {
  paneIdSeq += 1;
  return paneIdSeq;
}

const MONO = 'ui-monospace, SFMono-Regular, "Cascadia Code", Consolas, monospace';

function tsNow(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

// ─── Shared live-run engine, hoisted once above all panes ─────────────────────────────────
// One subscription to the existing 'mesh-test:progress' stream, fed to every pane that wants
// it (any number of "Run Proof" and "Receipts" panes can watch the SAME run) -- this is what
// "swappable" means in practice: the panes are views onto one shared feed, not independently
// wired pipes.

interface RunLogLine { id: number; ts: string; text: string; kind: 'info' | 'ok' | 'err' | 'sys'; }
interface ReceiptEntry { id: number; ts: string; label: string; json: string; outcome?: QuestionOutcomeLike; }

function useSharedProofRun() {
  const [running, setRunning] = useState(false);
  const [runLog, setRunLog] = useState<RunLogLine[]>([]);
  const [receipts, setReceipts] = useState<ReceiptEntry[]>([]);
  const seqRef = useRef(0);

  const appendLog = useCallback((text: string, kind: RunLogLine['kind'] = 'info') => {
    seqRef.current += 1;
    setRunLog((prev) => [...prev.slice(-299), { id: seqRef.current, ts: tsNow(), text, kind }]);
  }, []);

  const appendReceipt = useCallback((label: string, payload: unknown, outcome?: QuestionOutcomeLike) => {
    seqRef.current += 1;
    setReceipts((prev) => [
      ...prev.slice(-49),
      { id: seqRef.current, ts: tsNow(), label, json: JSON.stringify(payload, null, 2), outcome },
    ]);
  }, []);

  useEffect(() => {
    const amplify = (window as any).amplify;
    const unsub = amplify?.onMeshTestProgress?.((payload: ProgressEvent) => {
      if (payload.type === 'start') {
        setRunning(true);
        appendLog(`RUN START -- ${payload.total} question(s) queued`, 'sys');
      } else if (payload.type === 'peers-discovered') {
        appendLog(`peer discovery: ${payload.count} live peer(s)`, 'info');
      } else if (payload.type === 'question-start') {
        appendLog(`-> Q[${payload.index + 1}/${payload.total}] [${payload.category}] ${payload.question.slice(0, 90)}`, 'info');
      } else if (payload.type === 'question-complete') {
        const o = payload.outcome;
        const verdict = o.isCorrect ? 'CORRECT' : o.parsedLetter == null ? 'NO ANSWER' : 'WRONG';
        appendLog(`<- reply: ${o.parsedLetter ?? '(none)'} vs key ${o.correctLetter} -- ${verdict} (${o.latencyMs ?? '?'}ms)`, o.isCorrect ? 'ok' : 'err');
        appendReceipt(`question-complete qid=${o.question_id ?? '?'}`, o, o);
      } else if (payload.type === 'complete') {
        setRunning(false);
        appendLog('RUN COMPLETE', 'sys');
        appendReceipt('complete (full OneClickRunResult)', payload.result);
      }
    });
    return () => unsub?.();
  }, [appendLog, appendReceipt]);

  const runOne = useCallback((questionId: string) => {
    const amplify = (window as any).amplify;
    if (!amplify?.meshTestRunOneClick) {
      appendLog('window.amplify.meshTestRunOneClick is not available in this build -- cannot run.', 'err');
      return;
    }
    appendLog(`$ run proof -- question_id ${questionId}`, 'sys');
    // Mirrors OneClickMeshTestPanel.tsx's own RECOMMENDED_DEFAULTS (local_ollama, substrate +
    // plow + andon + research-arm all on) so a single-question run through this seam produces
    // an outcome shaped the same way the Proof tab's own runs are -- this file does not import
    // that constant (it is not exported), so it is mirrored here by value; if that panel's
    // defaults change, revisit this comment.
    void amplify.meshTestRunOneClick({
      mode: 'local_ollama',
      substrateEnabled: true,
      plowEnabled: true,
      plowAndonEnabled: true,
      researchArmMode: true,
      questionIds: [questionId],
    }).then((resp: { ok: boolean; error?: string }) => {
      if (!resp?.ok) appendLog(`run failed to start: ${resp?.error ?? 'unknown error'}`, 'err');
    }).catch((e: unknown) => appendLog(`run error: ${String(e)}`, 'err'));
  }, [appendLog]);

  const clear = useCallback(() => {
    setRunLog([]);
    setReceipts([]);
  }, []);

  return { running, runLog, receipts, runOne, clear };
}

// ─── Provenance click-through (the gap this dispatch's recon found and this file fills,
//     additively, without touching OneClickMeshTestPanel.tsx's own ProvenanceReceiptRow) ────

function ProvenanceChips({ outcome }: { outcome?: QuestionOutcomeLike }): React.ReactElement | null {
  const receipts = outcome?.plowTrace?.provenance_receipts ?? [];
  if (!outcome || receipts.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
      {receipts.map((r, i) => {
        const clickable = !!r.provenanceUrl;
        const openIt = () => { if (r.provenanceUrl) (window as any).amplify?.openExternal?.(r.provenanceUrl); };
        return (
          <span
            key={i}
            role={clickable ? 'link' : undefined}
            tabIndex={clickable ? 0 : undefined}
            onClick={openIt}
            onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') openIt(); }}
            title={clickable ? r.provenanceUrl : 'no source URL on this receipt'}
            style={{
              fontSize: 9, fontFamily: MONO, padding: '1px 6px', borderRadius: 4,
              border: `1px solid ${r.verified ? '#1e4038' : '#3a2f0a'}`,
              color: r.verified ? '#6ee7b7' : '#facc15',
              textDecoration: clickable ? 'underline' : 'none',
              cursor: clickable ? 'pointer' : 'default',
            }}
          >
            [{r.source ?? 'unknown'} {r.verified ? 'verified' : 'unverified'}
            {r.contentHash ? ` hash:${r.contentHash.slice(0, 8)}` : ''}]
          </span>
        );
      })}
    </div>
  );
}

// ─── Pane bodies, one per role ──────────────────────────────────────────────────────────────

function RunProofPane({ engine }: { engine: ReturnType<typeof useSharedProofRun> }): React.ReactElement {
  const [questionId, setQuestionId] = useState<string>(String(STANDING_20_IDS[0]));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: 6, padding: '8px 10px', borderBottom: '1px solid #1e2a38', flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={STANDING_20_IDS.includes(Number(questionId)) ? questionId : ''}
          onChange={(e) => { if (e.target.value) setQuestionId(e.target.value); }}
          style={{ background: '#0d1117', color: '#e2e8f0', border: '1px solid #1e2a38', borderRadius: 4, fontSize: 11, padding: '3px 6px' }}
        >
          <option value="">standing 20 id...</option>
          {STANDING_20_IDS.map((id) => <option key={id} value={id}>qid {id}</option>)}
        </select>
        <input
          value={questionId}
          onChange={(e) => setQuestionId(e.target.value)}
          placeholder="question_id"
          style={{ width: 90, background: '#0d1117', color: '#e2e8f0', border: '1px solid #1e2a38', borderRadius: 4, fontSize: 11, padding: '3px 6px', fontFamily: MONO }}
        />
        <button
          onClick={() => engine.runOne(questionId.trim())}
          disabled={engine.running || !questionId.trim()}
          style={{
            background: 'rgba(100,200,150,0.15)', border: '1px solid rgba(100,200,150,0.5)',
            borderRadius: 4, color: '#8bc8a0', fontSize: 11, fontWeight: 700,
            padding: '4px 12px', cursor: engine.running ? 'wait' : 'pointer',
          }}
        >
          {engine.running ? 'Running...' : 'Run Proof ▶'}
        </button>
        <span style={{ fontSize: 9, color: '#64748b' }}>
          {engine.running ? '[RUNNING]' : 'idle'} -- shared run; visible in every pane on this role or "Receipts"
        </span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', fontSize: 11, lineHeight: 1.6, fontFamily: MONO }}>
        {engine.runLog.length === 0 && (
          <div style={{ color: '#475569', fontStyle: 'italic' }}>No run yet. Pick a question id and press Run Proof.</div>
        )}
        {engine.runLog.map((l) => (
          <div key={l.id} style={{ color: l.kind === 'ok' ? '#4ade80' : l.kind === 'err' ? '#f87171' : l.kind === 'sys' ? '#facc15' : '#94a3b8', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            <span style={{ color: '#334155' }}>[{l.ts}]</span> {l.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReceiptsPane({ engine }: { engine: ReturnType<typeof useSharedProofRun> }): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '8px 10px', borderBottom: '1px solid #1e2a38', flexShrink: 0, fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>
        Receipts -- real work-receipt JSON, landing as it arrives (not a summary)
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {engine.receipts.length === 0 && (
          <div style={{ color: '#475569', fontStyle: 'italic', fontSize: 11 }}>No receipts yet.</div>
        )}
        {engine.receipts.map((r) => (
          <div key={r.id} style={{ border: '1px solid #1e2a38', borderRadius: 6, padding: 8 }}>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>
              <span style={{ color: '#334155' }}>[{r.ts}]</span> {r.label}
            </div>
            <ProvenanceChips outcome={r.outcome} />
            <pre style={{ margin: '6px 0 0', fontSize: 10, fontFamily: MONO, color: '#cbd5e1', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 220, overflowY: 'auto' }}>
              {r.json}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}

function IdlePane({ onPick }: { onPick: (role: PaneRole) => void }): React.ReactElement {
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, color: '#475569' }}>Unassigned pane -- pick a role above.</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {(['run-proof', 'receipts', 'diagnostic-terminal'] as PaneRole[]).map((r) => (
          <button key={r} onClick={() => onPick(r)} style={{ fontSize: 10, background: 'none', border: '1px solid #1e2a38', color: '#64748b', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}>
            {ROLE_LABELS[r]}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── One pane: header (role dropdown) + body dispatched by role ───────────────────────────

function Pane({ pane, onRoleChange, onRemove, canRemove, engine }: {
  pane: PaneState;
  onRoleChange: (id: number, role: PaneRole) => void;
  onRemove: (id: number) => void;
  canRemove: boolean;
  engine: ReturnType<typeof useSharedProofRun>;
}): React.ReactElement {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', flex: '1 1 320px', minWidth: 320,
      background: '#050a0f', border: '1px solid #1e2a38', borderRadius: 10,
      height: 420, overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderBottom: '1px solid #1e2a38', flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: '#4ade80' }}>●</span>
        <select
          value={pane.role}
          onChange={(e) => onRoleChange(pane.id, e.target.value as PaneRole)}
          style={{ flex: 1, background: '#0d1117', color: '#e2e8f0', border: '1px solid #1e2a38', borderRadius: 4, fontSize: 11, padding: '3px 6px' }}
        >
          {(Object.keys(ROLE_LABELS) as PaneRole[]).map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        {canRemove && (
          <button onClick={() => onRemove(pane.id)} title="Remove pane" style={{ background: 'none', border: '1px solid #1e2a38', color: '#64748b', borderRadius: 4, fontSize: 11, padding: '2px 7px', cursor: 'pointer' }}>
            ✕
          </button>
        )}
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {pane.role === 'idle' && <IdlePane onPick={(r) => onRoleChange(pane.id, r)} />}
        {pane.role === 'run-proof' && <RunProofPane engine={engine} />}
        {pane.role === 'receipts' && <ReceiptsPane engine={engine} />}
        {pane.role === 'diagnostic-terminal' && <MeshTestTerminalTab />}
      </div>
    </div>
  );
}

const MAX_PANES = 6;

export function SwappableTerminalPanes(): React.ReactElement {
  const engine = useSharedProofRun();
  const [panes, setPanes] = useState<PaneState[]>(() => [
    { id: nextPaneId(), role: 'run-proof' },
    { id: nextPaneId(), role: 'receipts' },
  ]);

  const setRole = useCallback((id: number, role: PaneRole) => {
    setPanes((prev) => prev.map((p) => (p.id === id ? { ...p, role } : p)));
  }, []);
  const addPane = useCallback(() => {
    setPanes((prev) => (prev.length >= MAX_PANES ? prev : [...prev, { id: nextPaneId(), role: 'idle' }]));
  }, []);
  const removePane = useCallback((id: number) => {
    setPanes((prev) => (prev.length <= 1 ? prev : prev.filter((p) => p.id !== id)));
  }, []);

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '16px 20px', background: '#0a0f1a', color: '#f0fdf4', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ marginBottom: 4, fontSize: 16, fontWeight: 700, color: '#f0fdf4' }}>Terminal Panes</div>
      <div style={{ marginBottom: 12, fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>
        A separate, additive surface -- does not touch the existing Proof tab. Each pane below is
        multi-purpose: pick its role from its own dropdown. Default: left runs one question
        through the real pipeline, right shows the real receipt JSON landing live as it arrives.
        Add panes and re-role them freely; two panes both running the full pipeline at once will
        queue rather than overlap (the app has one active-run lock today -- see this file's header
        comment).
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          onClick={addPane}
          disabled={panes.length >= MAX_PANES}
          style={{ background: 'none', border: '1px solid rgba(148,163,184,0.3)', color: '#94a3b8', borderRadius: 6, fontSize: 11, padding: '5px 12px', cursor: panes.length >= MAX_PANES ? 'default' : 'pointer', opacity: panes.length >= MAX_PANES ? 0.5 : 1 }}
        >
          + Add pane ({panes.length}/{MAX_PANES})
        </button>
        <button
          onClick={engine.clear}
          style={{ background: 'none', border: '1px solid rgba(148,163,184,0.3)', color: '#94a3b8', borderRadius: 6, fontSize: 11, padding: '5px 12px', cursor: 'pointer' }}
        >
          Clear run log &amp; receipts
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {panes.map((p) => (
          <Pane key={p.id} pane={p} onRoleChange={setRole} onRemove={removePane} canRemove={panes.length > 1} engine={engine} />
        ))}
      </div>
    </div>
  );
}

export default SwappableTerminalPanes;
