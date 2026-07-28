// OneClickMeshTestPanel.tsx — BP132 Yoke #21 D9 / Yoke #22 "one-click staged test" /
// Yoke #23 WAN-distributed dispatch
//
// See src/main/mesh_test/one_click_mmlu_pro.ts for the full Truth-Always scope note.
// Short version shown to the user in this panel: real ground-truth-scored MMLU-Pro-format
// questions. "Auto" mode dispatches across live WAN mesh peers when any are online, and
// falls back to this machine's local Ollama when none are (peer_presence had 0 rows as
// of the last check this agent could perform — live multi-peer verification is still
// pending Bishop/Founder action, same flagging pattern as Yoke #21's peer_presence check).
//
// Writes its last result to localStorage so the Social tab's "Check My Math" card
// (CueDeckCardRenderer-based) can display the real number without prop-drilling
// across tabs — see LS_LAST_RESULT below.

import React, { useCallback, useEffect, useState } from 'react';
import type { AuthState } from '../amplify.d';

export const LS_LAST_RESULT = 'mnemo_last_mesh_test_result';

// BP135 YOKE_35 Phase 3: ported from GauntletTab.tsx (now cut from the shipped Help
// sub-tabs, see CleanShell.tsx) -- its two real side-effects (marks credit, Pioneer
// registry) must not silently regress just because the fake stage-sim around them is
// gone. GauntletTab.tsx itself stays in the tree, unrouted, per Rule 66.
const LS_FIRST_RUN_MARKS_CREDITED = 'mnemo_gauntlet_stage1_done';

interface PioneerBonusState {
  visible: boolean;
  modelName: string;
  position: number;
  multiplier: number;
  label: string;
}

// Mirrors GauntletTab.tsx's getPioneerPosition() verbatim -- optimistic client-side
// position estimate; server validates before writing to gauntlet_pioneer_registry.
function getPioneerPosition(existingCount: number): { position: number; multiplier: number; label: string } {
  const pos = existingCount + 1;
  if (pos === 1) return { position: 1, multiplier: 3.0,  label: 'First tested · Named · Permanent attribution · Pioneer #1' };
  if (pos === 2) return { position: 2, multiplier: 2.0,  label: 'Co-validator · Named · Pioneer #2' };
  if (pos === 3) return { position: 3, multiplier: 1.5,  label: 'Verifier · Named · Pioneer #3' };
  if (pos <= 10) return { position: pos, multiplier: 1.2, label: 'Early-adopter · cohort listing' };
  return { position: pos, multiplier: 1.0, label: 'Standard Gauntlet run' };
}

/** BP137 Honest-MMLU-Provenance Yoke, Step 2: mirrors ProvenanceReceipt in
 *  src/main/plow/plow_mc_answerer.ts -- one entry per fact actually shown to the plow's
 *  voters for this question. */
interface ProvenanceReceipt {
  source: string;
  contentHash: string;
  verified: boolean;
  provenanceUrl?: string;
}

interface QuestionOutcome {
  question_id: number;
  question: string;
  category: string;
  modelRawAnswer: string;
  parsedLetter: string | null;
  correctLetter: string;
  isCorrect: boolean;
  latencyMs: number;
  error?: string;
  peerId?: string;
  machineLabel?: string;
  timedOut?: boolean;
  isAbstain?: boolean;
  /** BP133 Yoke #24 Task 2: wan_mesh only -- which mechanism produced this outcome. */
  answeredBy?: 'plow' | 'minor_council' | 'single_shot';
  /** BP137 Honest-MMLU-Provenance Yoke: mirrors OneClickQuestionOutcome.plowTrace in
   *  one_click_mmlu_pro.ts -- present only when answeredBy === 'plow'. Only
   *  provenance_receipts is read directly by this panel; the rest passes through untyped. */
  plowTrace?: { provenance_receipts?: ProvenanceReceipt[]; [key: string]: unknown } | null;
}

/** BP137 Honest-MMLU-Provenance Yoke, Step 2: an outcome counts as "substrate-sourced" only
 *  when it was actually answered via the plow AND carries at least one named-source receipt.
 *  No receipt -> not counted as sourced, regardless of answeredBy -- Step 2's explicit rule. */
function isProvenanceSourced(o: QuestionOutcome): boolean {
  return o.answeredBy === 'plow' && (o.plowTrace?.provenance_receipts?.length ?? 0) > 0;
}

/** BP137 Honest-MMLU-Provenance Yoke, Step 2: renders the receipt row under a served answer
 *  ("Wikipedia, verified, hash a1b2c3d4e5f6...") or an explicit "no receipt" note when the
 *  outcome carries none -- never silently omits the row, since silence would look like an
 *  unsourced answer is sourced. */
function ProvenanceReceiptRow({ outcome }: { outcome: QuestionOutcome }): React.ReactElement | null {
  if (outcome.answeredBy !== 'plow') return null;
  const receipts = outcome.plowTrace?.provenance_receipts ?? [];
  if (receipts.length === 0) {
    return (
      <div style={{ fontSize: 9, color: '#64748b', marginLeft: 16, fontStyle: 'italic' }}>
        no provenance receipt -- not counted as substrate-sourced
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginLeft: 16 }}>
      {receipts.map((r, i) => (
        <span key={i} style={{ fontSize: 9, color: r.verified ? '#6ee7b7' : '#facc15', fontFamily: 'monospace' }}>
          [{r.source}{r.verified ? ' verified' : ' unverified'} hash:{r.contentHash.slice(0, 8)}]
        </span>
      ))}
    </div>
  );
}

interface PeerAccuracyBreakdown {
  peerId: string;
  machineLabel: string;
  total: number;
  scored: number;
  correct: number;
  accuracy: number | null;
}

/** BP135 Phase 2 (Layer A: consensus): the mesh's single answer for one question, alongside
 *  (never instead of) the per-peer QuestionOutcome rows for that same question. Mirrors
 *  ConsensusQuestionOutcome in src/main/mesh_test/one_click_mmlu_pro.ts. */
interface ConsensusQuestionOutcome {
  question_id: number;
  question: string;
  category: string;
  correctLetter: string;
  consensusLetter: string | null;
  isConsensusCorrect: boolean;
  confidenceVariance: number;
  andonTriggered: boolean;
}

export interface OneClickRunResult {
  startedAt: string;
  completedAt: string;
  total: number;
  scored: number;
  correct: number;
  accuracy: number | null;
  outcomes: QuestionOutcome[];
  dispatchMode: string;
  datasetLabel: string;
  questionSource?: 'full_corpus_live' | 'bundled_subset';
  peerBreakdown?: PeerAccuracyBreakdown[];
  livePeersFound?: number;
  wanError?: string;
  substrateEnabled?: boolean;
  /** BP133 Yoke #24 Task 2: whether the wan_mesh run requested the 12-Blade Column Plow. */
  plowEnabled?: boolean;
  /** BP134 Yoke #32 Phase F item 2: set when this run used the "Full 14x5 MMLU-Pro"
   *  exact-per-category sampling preset (value = questions per category). */
  exactPerCategory?: number;
  /** BP134 Yoke #32 Phase F item 3: sha256 of the bundled corpus manifest this run's
   *  questions were sourced from, when available. */
  corpusManifestSha256?: string;
  /** BP135 Phase 2 (Layer A: consensus), wan_mesh mode only -- one entry per question, the
   *  mesh's single consensus answer alongside (never instead of) peerBreakdown/outcomes. */
  consensusOutcomes?: ConsensusQuestionOutcome[];
  /** Aggregate accuracy of the mesh's single consensus answer, wan_mesh mode only. Scored
   *  over questions where a consensus letter was actually reached; null if none were. */
  consensusAccuracy?: number | null;
  /** BP135 Phase 3 (Layer B: federated substrate): whether pooled cross-peer substrate was
   *  requested for this run. */
  federatedSubstrateEnabled?: boolean;
}

type DispatchModeChoice = 'auto' | 'wan_mesh' | 'local_ollama';

type ProgressEvent =
  | { type: 'start'; total: number }
  | { type: 'peers-discovered'; count: number }
  | { type: 'question-start'; index: number; total: number; question: string; category: string }
  | { type: 'question-complete'; index: number; total: number; outcome: QuestionOutcome }
  | { type: 'complete'; result: OneClickRunResult };

export function loadLastMeshTestResult(): OneClickRunResult | null {
  try {
    const raw = localStorage.getItem(LS_LAST_RESULT);
    if (!raw) return null;
    return JSON.parse(raw) as OneClickRunResult;
  } catch {
    return null;
  }
}

/** BP134 Yoke #32 Phase F item 4: serialize the full OneClickRunResult (every outcome,
 *  every persisted plow_trace, the corpus manifest hash) to a downloadable .json file --
 *  third-party verifiability, so a result can be independently re-checked question by
 *  question rather than trusting only the on-screen aggregate percentage. */
export function downloadReceipt(result: OneClickRunResult): void {
  try {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mnemo_mesh_test_receipt_${result.startedAt.replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('[OneClickMeshTestPanel] receipt download failed:', e);
  }
}

export interface OneClickMeshTestPanelProps {
  onShareResult?: (result: OneClickRunResult) => void;
  /** BP135 YOKE_35 Phase 3: optional -- gates the ported Pioneer Bonus (membership-only,
   *  same rule as the original GauntletTab.tsx). Omitted callers simply never see it. */
  authState?: AuthState | null;
}

export function OneClickMeshTestPanel({ onShareResult, authState }: OneClickMeshTestPanelProps): React.ReactElement {
  const [state, setState] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
  const isMember = authState?.status === 'member' || authState?.status === 'trial_active';
  // BP135 YOKE_35 Phase 3: ported Pioneer Bonus modal state (see PioneerBonusModal below).
  const [pioneerBonus, setPioneerBonus] = useState<PioneerBonusState>({
    visible: false, modelName: '', position: 0, multiplier: 1, label: '',
  });
  const [mode, setMode] = useState<DispatchModeChoice>('auto');
  // BP133 Yoke #24 Task 1: explicit substrate on/off switch. Defaults to OFF so a run's
  // meaning never changes silently -- the Founder must opt in to substrate-assisted answers.
  const [substrateEnabled, setSubstrateEnabled] = useState(false);
  // BP133 Yoke #24 Task 2: explicit opt-in to the 12-Blade Column Plow (wan_mesh only --
  // has no effect in local_ollama mode, since the plow answerer runs on the RESPONDING
  // peer's machine). Off by default: the Founder must opt in, matching substrate's pattern.
  const [plowEnabled, setPlowEnabled] = useState(false);
  // Condition C (Andon retry loop) vs Condition B (single pass) -- only meaningful when
  // plowEnabled is true.
  const [plowAndonEnabled, setPlowAndonEnabled] = useState(false);
  // BP135 Yoke #34 Phase 5: explicit opt-in to pooled cross-peer substrate (federated
  // substrate layer). Only meaningful when substrateEnabled is true AND mode is wan_mesh --
  // ignored server-side otherwise (see one_click_mmlu_pro.ts config.federatedSubstrateEnabled
  // doc comment). Off by default, same pattern as substrateEnabled/plowEnabled/plowAndonEnabled:
  // the Founder must opt in, a run's meaning never changes silently.
  const [federatedSubstrateEnabled, setFederatedSubstrateEnabled] = useState(false);
  // BP133 Yoke #24 Task 4: question-count control. QUESTION_COUNT_PRESETS[0] (3) is the
  // one-click smoke test; F12 DevTools is unavailable in this build, so this replaces the
  // only prior way to change question count (a console workaround).
  const [maxTotalQuestions, setMaxTotalQuestions] = useState<number>(20);
  // BP134 Yoke #32 Phase F item 2: "Full 14x5 MMLU-Pro" preset -- exact 5-per-category
  // sampling across all 14 canonical domains (70 total), substrate+plow+andon forced ON.
  // Cleared by any manual change to the individual toggles/question-count below, since at
  // that point the run is no longer the untouched preset (Truth-Always: never let a result
  // silently claim "Full 14x5" when the Founder changed a setting after selecting it).
  const [fullPresetSelected, setFullPresetSelected] = useState(false);
  const [total, setTotal] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [peersDiscovered, setPeersDiscovered] = useState<number | null>(null);
  const [liveOutcomes, setLiveOutcomes] = useState<QuestionOutcome[]>([]);
  const [result, setResult] = useState<OneClickRunResult | null>(() => loadLastMeshTestResult());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // BP135 YOKE_35 Phase 3: the two real side-effects ported from GauntletTab.tsx's
  // stage-sim loop, now anchored to this panel's own (real) completion event instead of
  // a fake "Stage 1"/"Stage 3" boundary.
  const handleRealCompletionSideEffects = useCallback(async () => {
    // 1) First-ever proof-run marks credit (SAGA 13) -- reuses the exact same one-time
    // localStorage flag GauntletTab.tsx used, so a user who already earned this via the
    // old (now-cut) Gauntlet sub-tab is not credited twice.
    const firstRun = !localStorage.getItem(LS_FIRST_RUN_MARKS_CREDITED);
    if (firstRun) {
      localStorage.setItem(LS_FIRST_RUN_MARKS_CREDITED, 'true');
      window.amplify?.creditFirstInstallMarks?.();
    }

    // 2) Pioneer Bonus (SAGA 09) -- GauntletTab.tsx keyed this off a `selectedModel`
    // dropdown value that was never actually wired to any UI (dead code path). This port
    // keys it off the real active-brain identity instead (window.amplify.brainRegistry.
    // getActive(), a genuine IPC call, preload.ts:971) rather than fabricate a model
    // selector that doesn't exist in this panel -- "nothing that isn't real."
    if (!isMember) return;
    try {
      // brainRegistry is a real preload bridge (preload.ts:968-977) not yet declared in
      // amplify.d.ts -- cast via `(window as any).amplify`, matching this file's existing
      // pattern for onMeshTestProgress/meshTestRunOneClick above (same underlying drift).
      const brainResp = await (window as any).amplify?.brainRegistry?.getActive?.();
      const brainId: string | undefined = brainResp?.ok ? brainResp.brain_id : undefined;
      if (!brainId) return;
      const storageKey = `mnemo_pioneer_tested_${brainId}`;
      const existingCount = parseInt(localStorage.getItem(storageKey) ?? '0', 10);
      const pioneer = getPioneerPosition(existingCount);
      if (pioneer.multiplier > 1.0) {
        setPioneerBonus({
          visible: true,
          modelName: brainId,
          position: pioneer.position,
          multiplier: pioneer.multiplier,
          label: pioneer.label,
        });
        // Optimistic local record; server validates + writes to gauntlet_pioneer_registry.
        localStorage.setItem(storageKey, String(existingCount + 1));
      }
    } catch { /* non-fatal -- Pioneer Bonus is a bonus, never blocks the real test result */ }
  }, [isMember]);

  useEffect(() => {
    const unsub = (window as any).amplify?.onMeshTestProgress?.((payload: ProgressEvent) => {
      if (payload.type === 'start') {
        setTotal(payload.total);
        setDoneCount(0);
        setLiveOutcomes([]);
      } else if (payload.type === 'peers-discovered') {
        setPeersDiscovered(payload.count);
      } else if (payload.type === 'question-complete') {
        setDoneCount(payload.index + 1);
        setLiveOutcomes((prev) => [...prev, payload.outcome]);
      } else if (payload.type === 'complete') {
        setResult(payload.result);
        setState(payload.result.wanError ? 'error' : 'complete');
        if (payload.result.wanError) setErrorMsg(payload.result.wanError);
        try { localStorage.setItem(LS_LAST_RESULT, JSON.stringify(payload.result)); } catch { /* non-fatal */ }
        if (!payload.result.wanError) void handleRealCompletionSideEffects();
      }
    });
    return () => unsub?.();
  }, [handleRealCompletionSideEffects]);

  const handleRun = useCallback(async () => {
    setState('running');
    setErrorMsg(null);
    setPeersDiscovered(null);
    try {
      const resp = await (window as any).amplify?.meshTestRunOneClick?.({
        mode,
        substrateEnabled,
        maxTotalQuestions,
        plowEnabled,
        plowAndonEnabled,
        exactPerCategory: fullPresetSelected ? 5 : undefined,
        federatedSubstrateEnabled,
      });
      if (!resp?.ok) {
        setErrorMsg(resp?.error ?? 'Test run failed to start');
        setState('error');
      }
      // Completion is reported via the mesh-test:progress 'complete' event above.
    } catch (e) {
      setErrorMsg(String(e));
      setState('error');
    }
  }, [mode, substrateEnabled, maxTotalQuestions, plowEnabled, plowAndonEnabled, fullPresetSelected, federatedSubstrateEnabled]);

  const runningAccuracy = liveOutcomes.length > 0
    ? liveOutcomes.filter((o) => o.isCorrect).length / liveOutcomes.length
    : null;

  // BP137 Honest-MMLU-Provenance Yoke, Step 2+3: the provenance-backed subset of the
  // completed result's outcomes -- only outcomes with at least one named-source receipt
  // count here, per Step 2's explicit "no receipt -> not substrate-sourced" rule. This is
  // what Step 3 requires as the SINGLE headline number for this benchmark (never the raw
  // "all outcomes" percentage, which may include un-sourced single-shot/Minor-Council
  // answers that are pure model recall, not swarm-provenance).
  const sourcedOutcomes = result ? result.outcomes.filter(isProvenanceSourced) : [];
  const sourcedScored = sourcedOutcomes.filter((o) => o.parsedLetter !== null).length;
  const sourcedCorrect = sourcedOutcomes.filter((o) => o.isCorrect).length;
  const sourcedAccuracy = sourcedScored > 0 ? sourcedCorrect / sourcedScored : null;

  const modeButton = (choice: DispatchModeChoice, label: string) => (
    <button
      onClick={() => setMode(choice)}
      disabled={state === 'running'}
      style={{
        background: mode === choice ? '#10b981' : 'transparent',
        color: mode === choice ? '#0d1117' : '#94a3b8',
        border: `1px solid ${mode === choice ? '#10b981' : '#1e2a38'}`,
        borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600,
        cursor: state === 'running' ? 'default' : 'pointer', fontFamily: 'system-ui, sans-serif',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{
      background: '#0d1117',
      border: '1px solid #1e2a38',
      borderRadius: 10,
      padding: 16,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#f0fdf4', marginBottom: 4 }}>
        🧪 Sourced-Knowledge Benchmark (MMLU-Pro format, with provenance)
      </div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, lineHeight: 1.5 }}>
        Runs real MMLU-Pro-format multiple-choice questions (ground truth answers,
        not fabricated) across your live WAN mesh peers and scores every answer live.
      </div>
      {/* BP137 Honest-MMLU-Provenance Yoke, Step 3: explicit separation from any reasoning
          claim -- this benchmark measures whether a named, independent authority (fetched via
          the CSIA Spider swarm) happens to agree with the answer key, NOT whether the model
          reasoned its way there. The mesh null result already killed the reasoning claim
          elsewhere in this app; this label makes sure it is never implicitly resurrected here. */}
      <div style={{
        fontSize: 10, color: '#94a3b8', marginBottom: 10, lineHeight: 1.6,
        background: 'rgba(110,231,183,0.05)', border: '1px solid rgba(110,231,183,0.15)',
        borderRadius: 6, padding: '6px 10px',
      }}>
        This is a <b style={{ color: '#6ee7b7' }}>sourced-knowledge</b> claim, not a reasoning
        claim: "12-Blade Column Plow" mode (WAN Mesh only, checkbox below) answers by fetching
        facts from named independent authorities (Wikipedia, arXiv, OpenAlex, PubMed, etc.) and
        shows a receipt under each answer. Without Plow, the model answers from its own
        knowledge with no receipt -- those answers are shown but are never counted as
        substrate-sourced (see the headline below).
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {modeButton('auto', 'Auto (WAN if live)')}
        {modeButton('wan_mesh', 'WAN Mesh only')}
        {modeButton('local_ollama', 'Local Ollama only')}
      </div>

      {/* BP133 Yoke #24 Task 1: explicit substrate on/off switch, honored on both local and
          WAN dispatch (see src/main/mesh_test/substrate_toggle.ts). Off by default. */}
      <label
        style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
          fontSize: 12, color: '#94a3b8', cursor: state === 'running' ? 'default' : 'pointer',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <input
          type="checkbox"
          checked={substrateEnabled}
          disabled={state === 'running'}
          onChange={(e) => { setSubstrateEnabled(e.target.checked); setFullPresetSelected(false); }}
        />
        Substrate context {substrateEnabled ? 'ON' : 'OFF'}
        <span style={{ color: '#475569', fontSize: 10 }}>
          (ON injects related topical eblets into the prompt; OFF sends the bare question, no substrate call is made at all)
        </span>
      </label>

      {/* BP133 Yoke #24 Task 2: explicit opt-in to the 12-Blade Column Plow, WAN mode only.
          Combined with the substrate toggle above, these two switches select Condition
          A (plow OFF + substrate OFF = single-shot cold), B (plow ON + substrate ON, single
          pass), or C (plow ON + substrate ON + Andon loop) from Yoke #24's runnable milestone. */}
      <label
        style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
          fontSize: 12, color: mode === 'local_ollama' ? '#475569' : '#94a3b8',
          cursor: state === 'running' || mode === 'local_ollama' ? 'default' : 'pointer',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <input
          type="checkbox"
          checked={plowEnabled}
          disabled={state === 'running' || mode === 'local_ollama'}
          onChange={(e) => { setPlowEnabled(e.target.checked); setFullPresetSelected(false); }}
        />
        12-Blade Column Plow {plowEnabled ? 'ON' : 'OFF'} (WAN only)
        <span style={{ color: '#475569', fontSize: 10 }}>
          (ON: the answering peer runs the full specialist-swarm + Miner/Saladin/Furnace pipeline instead of a single Ollama call. Slower, per-question timeout auto-raised to 5min)
        </span>
      </label>
      {plowEnabled && (
        <label
          style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, marginLeft: 20,
            fontSize: 12, color: '#94a3b8', cursor: state === 'running' ? 'default' : 'pointer',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <input
            type="checkbox"
            checked={plowAndonEnabled}
            disabled={state === 'running'}
            onChange={(e) => { setPlowAndonEnabled(e.target.checked); setFullPresetSelected(false); }}
          />
          Andon retry loop {plowAndonEnabled ? 'ON (Condition C)' : 'OFF (Condition B, single pass)'}
        </label>
      )}

      {/* BP135 Yoke #34 Phase 5: explicit opt-in to the federated-substrate layer -- pools
          topical eblets across ALL live peers instead of each peer using only its own local
          substrate. Only meaningful when substrate is ON and dispatch mode is wan_mesh; greyed
          out and disabled otherwise (mirrors the plowEnabled/mode gating above). */}
      {(() => {
        const federatedGated = state === 'running' || mode !== 'wan_mesh' || !substrateEnabled;
        return (
          <label
            style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
              fontSize: 12, color: federatedGated ? '#475569' : '#94a3b8',
              cursor: federatedGated ? 'default' : 'pointer',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            <input
              type="checkbox"
              checked={federatedSubstrateEnabled}
              disabled={federatedGated}
              onChange={(e) => { setFederatedSubstrateEnabled(e.target.checked); setFullPresetSelected(false); }}
            />
            Federated substrate (pool eblets across peers) {federatedSubstrateEnabled ? 'ON' : 'OFF'}
            <span style={{ color: '#475569', fontSize: 10 }}>
              (WAN Mesh + Substrate ON only. ON: pools topical eblets from every live peer into
              one shared index before each question, instead of each peer using only its own
              local substrate. Requires all peers on 0.9.5.)
            </span>
          </label>
        );
      })()}

      {/* BP133 Yoke #24 Task 4: question-count control -- no DevTools console workaround
          needed, F12 dev-tools is unavailable in this build. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: '#64748b' }}>Questions:</span>
        {[3, 10, 20, 50].map((n) => (
          <button
            key={n}
            onClick={() => { setMaxTotalQuestions(n); setFullPresetSelected(false); }}
            disabled={state === 'running'}
            style={{
              background: !fullPresetSelected && maxTotalQuestions === n ? '#10b981' : 'transparent',
              color: !fullPresetSelected && maxTotalQuestions === n ? '#0d1117' : '#94a3b8',
              border: `1px solid ${!fullPresetSelected && maxTotalQuestions === n ? '#10b981' : '#1e2a38'}`,
              borderRadius: 6, padding: '3px 9px', fontSize: 11, fontWeight: 600,
              cursor: state === 'running' ? 'default' : 'pointer', fontFamily: 'system-ui, sans-serif',
            }}
          >
            {n}
          </button>
        ))}
        <input
          type="number"
          min={1}
          max={500}
          value={maxTotalQuestions}
          disabled={state === 'running'}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!Number.isNaN(v) && v > 0) { setMaxTotalQuestions(v); setFullPresetSelected(false); }
          }}
          style={{
            width: 52, background: '#0d1117', border: '1px solid #1e2a38', borderRadius: 6,
            color: '#e2e8f0', fontSize: 11, padding: '3px 6px', fontFamily: 'system-ui, sans-serif',
          }}
        />
      </div>

      {/* BP134 Yoke #32 Phase F item 2: "Full 14x5 MMLU-Pro" preset -- one click sets
          substrate+plow+andon ON and exact 5-per-category sampling (70 total, all 14
          canonical domains guaranteed present, sourced from the fixed bundled corpus). */}
      <div style={{ marginBottom: 12 }}>
        <button
          onClick={() => {
            setMaxTotalQuestions(70);
            setSubstrateEnabled(true);
            setPlowEnabled(true);
            setPlowAndonEnabled(true);
            setMode('auto');
            setFullPresetSelected(true);
          }}
          disabled={state === 'running'}
          style={{
            background: fullPresetSelected ? '#facc15' : 'transparent',
            color: fullPresetSelected ? '#0d1117' : '#facc15',
            border: `1px solid ${fullPresetSelected ? '#facc15' : '#4d3a0a'}`,
            borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700,
            cursor: state === 'running' ? 'default' : 'pointer', fontFamily: 'system-ui, sans-serif',
          }}
        >
          ⚡ 70 — Full 14x5 MMLU-Pro
        </button>
        <span style={{ marginLeft: 8, fontSize: 10, color: '#475569' }}>
          (exactly 5 questions from EACH of the 14 categories, substrate+plow+Andon forced ON --
          run this AFTER seeding the Chocolate Pack to see "hot" differ from "cold")
        </span>
      </div>

      {state !== 'running' && (
        <button
          onClick={() => void handleRun()}
          style={{
            background: '#10b981', color: '#fff', border: 'none', borderRadius: 6,
            padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          ▶ Run the Test
        </button>
      )}

      {state === 'running' && (
        <div>
          <div style={{ fontSize: 12, color: '#6ee7b7', marginBottom: 8, animation: 'mnemo-pulse 1.5s ease-in-out infinite' }}>
            ◌ {peersDiscovered !== null && peersDiscovered > 0
              ? `${peersDiscovered} live peer(s) — `
              : peersDiscovered === 0 ? 'no live peers — running locally — ' : ''}
            Question {doneCount}/{total || '?'}
            {runningAccuracy !== null && (
              <span style={{ marginLeft: 10, color: '#94a3b8' }}>
                running accuracy: {(runningAccuracy * 100).toFixed(0)}%
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {liveOutcomes.map((o, i) => (
              <div key={`${o.question_id}-${o.peerId ?? 'local'}-${i}`}>
                <div style={{ fontSize: 11, color: o.isCorrect ? '#4ade80' : '#f87171', display: 'flex', gap: 8 }}>
                  <span>{o.isCorrect ? '✓' : o.timedOut ? '⏱' : o.isAbstain ? '·' : '✗'}</span>
                  {o.machineLabel && <span style={{ color: '#38bdf8' }}>[{o.machineLabel}]</span>}
                  {o.answeredBy === 'plow' && <span style={{ color: '#facc15' }}>[plow]</span>}
                  <span style={{ color: '#64748b' }}>[{o.category}]</span>
                  <span style={{ color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {o.question}
                  </span>
                </div>
                <ProvenanceReceiptRow outcome={o} />
              </div>
            ))}
          </div>
        </div>
      )}

      {state === 'error' && (
        <div style={{ fontSize: 12, color: '#f87171', marginTop: 8 }}>✗ {errorMsg}</div>
      )}

      {(state === 'complete' || (state === 'idle' && result)) && result && (
        <div style={{ marginTop: state === 'complete' ? 12 : 0 }}>
          <div style={{
            background: '#111827', border: '1px solid #1e2d45', borderRadius: 8,
            padding: '10px 14px', marginBottom: 8,
          }}>
            {/* BP137 Honest-MMLU-Provenance Yoke, Step 3: the headline is the
                PROVENANCE-BACKED number (sourcedAccuracy), never the raw/legacy `result.accuracy`
                which may include un-sourced single-shot/Minor-Council answers that carry no
                receipt. When nothing in this run was provenance-sourced (Plow off, or WAN mesh
                not used, or the swarm returned zero usable facts), the headline says so plainly
                instead of presenting an unlabeled score that implies a reasoning claim. */}
            {sourcedAccuracy !== null ? (
              <div style={{ fontSize: 16, fontWeight: 700, color: '#6ee7b7' }}>
                {`${(sourcedAccuracy * 100).toFixed(0)}% sourced-knowledge accuracy`}
                <span style={{ fontSize: 10, color: '#475569', fontWeight: 400, marginLeft: 6 }}>
                  (provenance-backed, {sourcedCorrect}/{sourcedScored} of {sourcedOutcomes.length} sourced answers)
                </span>
              </div>
            ) : (
              <div style={{ fontSize: 14, fontWeight: 700, color: '#facc15' }}>
                Not provenance-sourced this run
                <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400, marginLeft: 6 }}>
                  (enable 12-Blade Plow on WAN Mesh for a sourced-knowledge headline)
                </span>
              </div>
            )}
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 3 }}>
              {result.accuracy !== null ? `${(result.accuracy * 100).toFixed(0)}% raw accuracy` : 'no scored answers'}
              {' (all answers incl. non-sourced fallback -- not substrate-provenance) · '}
              {result.correct}/{result.scored} correct (of {result.total} answers run) ·{' '}
              {result.dispatchMode === 'wan_mesh'
                ? `dispatched across ${result.livePeersFound ?? '?'} live WAN peer(s)`
                : result.dispatchMode === 'local_ollama' ? 'dispatched locally on this machine' : result.dispatchMode}
              {' · substrate '}
              <span style={{ color: result.substrateEnabled ? '#6ee7b7' : '#94a3b8', fontWeight: 700 }}>
                {result.substrateEnabled ? 'ON' : 'OFF'}
              </span>
              {result.dispatchMode === 'wan_mesh' && (
                <>
                  {' · answered by '}
                  <span style={{ color: result.plowEnabled ? '#facc15' : '#94a3b8', fontWeight: 700 }}>
                    {result.plowEnabled ? '12-Blade Plow' : 'single-shot'}
                  </span>
                </>
              )}
              {result.dispatchMode === 'wan_mesh' && (
                <>
                  {' · federated substrate '}
                  <span style={{ color: result.federatedSubstrateEnabled ? '#a78bfa' : '#94a3b8', fontWeight: 700 }}>
                    {result.federatedSubstrateEnabled ? 'ON' : 'OFF'}
                  </span>
                </>
              )}
            </div>
            <div style={{ fontSize: 10, color: '#475569', marginTop: 4, fontStyle: 'italic' }}>
              {result.datasetLabel}
              {result.exactPerCategory && ` · exact ${result.exactPerCategory}/category sampling (Full 14x${result.exactPerCategory})`}
            </div>
            {result.corpusManifestSha256 && (
              <div style={{ fontSize: 9, color: '#334155', marginTop: 2, fontFamily: 'monospace' }}>
                corpus manifest sha256: {result.corpusManifestSha256.slice(0, 16)}...
              </div>
            )}
          </div>

          {result.peerBreakdown && result.peerBreakdown.length > 0 && (
            <div style={{
              background: '#111827', border: '1px solid #1e2d45', borderRadius: 8,
              padding: '10px 14px', marginBottom: 8,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>
                Per-peer accuracy
              </div>
              {result.peerBreakdown.map((p) => (
                <div key={p.peerId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#cbd5e1', padding: '2px 0' }}>
                  <span style={{ color: '#38bdf8' }}>{p.machineLabel}</span>
                  <span>
                    {p.accuracy !== null ? `${(p.accuracy * 100).toFixed(0)}%` : 'unscored'} ({p.correct}/{p.scored} of {p.total})
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* BP135 Phase 2 (Layer A: consensus): the mesh's single consensus answer, shown
              ALONGSIDE (never replacing) the per-peer breakdown above -- a wan_mesh run always
              still shows what each individual peer answered. */}
          {result.consensusOutcomes && result.consensusOutcomes.length > 0 && (
            <div style={{
              background: '#111827', border: '1px solid #3b2d5f', borderRadius: 8,
              padding: '10px 14px', marginBottom: 8,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#c4b5fd', marginBottom: 6 }}>
                Mesh consensus
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#c4b5fd', marginBottom: 6 }}>
                {result.consensusAccuracy !== null && result.consensusAccuracy !== undefined
                  ? `${(result.consensusAccuracy * 100).toFixed(0)}% consensus accuracy`
                  : 'No scored consensus answers'}
                {' — '}
                {result.consensusOutcomes.filter((c) => c.isConsensusCorrect).length}/
                {result.consensusOutcomes.filter((c) => c.consensusLetter !== null).length} correct
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {result.consensusOutcomes.map((c) => (
                  <div key={c.question_id} style={{ display: 'flex', gap: 8, fontSize: 10, color: '#94a3b8' }}>
                    <span style={{ color: c.isConsensusCorrect ? '#4ade80' : '#f87171' }}>
                      {c.isConsensusCorrect ? '✓' : c.consensusLetter === null ? '·' : '✗'}
                    </span>
                    <span style={{ color: '#64748b' }}>[{c.category}]</span>
                    <span>
                      consensus {c.consensusLetter ?? '—'} (correct {c.correctLetter})
                    </span>
                    {c.andonTriggered && (
                      <span style={{ color: '#facc15', fontWeight: 700 }}>andon triggered</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            {onShareResult && (
              <button
                onClick={() => onShareResult(result)}
                style={{
                  background: 'none', color: '#6ee7b7', border: '1px solid #1e4038', borderRadius: 6,
                  padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'system-ui, sans-serif',
                }}
              >
                📤 Share your results
              </button>
            )}

            {/* BP134 Yoke #32 Phase F item 4: third-party verifiability -- serialize the FULL
                OneClickRunResult (every outcome, every plow_trace, corpus manifest hash) so
                anyone can independently re-check the scoring without trusting the on-screen
                percentage alone. */}
            <button
              onClick={() => downloadReceipt(result)}
              style={{
                background: 'none', color: '#93c5fd', border: '1px solid #1e3a5f', borderRadius: 6,
                padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              ⬇ Download receipt (.json)
            </button>
          </div>
        </div>
      )}

      {/* BP135 YOKE_35 Phase 3: ported Pioneer Bonus modal (see handleRealCompletionSideEffects
          above). Fires on this panel's own real completion event, membership-gated, keyed to
          the real active-brain identity -- not the phantom model-dropdown GauntletTab.tsx had. */}
      {pioneerBonus.visible && (
        <PioneerBonusModal
          modelName={pioneerBonus.modelName}
          position={pioneerBonus.position}
          multiplier={pioneerBonus.multiplier}
          label={pioneerBonus.label}
          onDismiss={() => setPioneerBonus((s) => ({ ...s, visible: false }))}
        />
      )}

      <div style={{ fontSize: 10, color: '#334155', marginTop: 12, lineHeight: 1.5 }}>
        Scope note: "Auto" picks WAN mesh dispatch when live peers are online (via the
        relay_routes/relay_route_replies bus, Supabase-relayed, never a raw LAN IP) and
        falls back to local Ollama otherwise. Live multi-peer verification of this exact
        flow is still pending Bishop/Founder confirming 2 or more peers online — see
        Yoke #23 Bishop handoff.
      </div>
    </div>
  );
}

// ─── BP135 YOKE_35 Phase 3: Pioneer Bonus Modal ───────────────────────────────
// Ported verbatim (styling + copy) from GauntletTab.tsx's PioneerBonusModal, which is
// now unrouted -- see handleRealCompletionSideEffects above for the wiring change.

function PioneerBonusModal({ modelName, position, multiplier, label, onDismiss }: {
  modelName: string;
  position: number;
  multiplier: number;
  label: string;
  onDismiss: () => void;
}) {
  const posEmoji = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '⭐';
  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.75)', zIndex: 9999,
    }}>
      <div style={{
        background: '#0f172a', border: '1px solid rgba(110,231,183,0.4)',
        borderRadius: 14, padding: '28px 30px', maxWidth: 360, width: '90%', textAlign: 'center',
        boxShadow: '0 0 48px rgba(110,231,183,0.12)',
      }}>
        <div style={{ fontSize: 42, marginBottom: 12 }}>{posEmoji}</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#6ee7b7', marginBottom: 6 }}>
          Pioneer Bonus!
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
          You are the <strong style={{ color: '#e2e8f0' }}>#{position} tester</strong> of
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 10 }}>
          {modelName}
        </div>
        <div style={{
          background: 'rgba(110,231,183,0.08)', border: '1px solid rgba(110,231,183,0.2)',
          borderRadius: 8, padding: '8px 12px', marginBottom: 14,
        }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#6ee7b7' }}>{multiplier}×</div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>marks multiplier</div>
        </div>
        <div style={{ fontSize: 10, color: '#475569', marginBottom: 18, lineHeight: 1.6 }}>
          {label}<br />
          Your attribution is permanent in the community Banyan Metric registry.
          <br />
          <span style={{ color: '#334155' }}>Server validates · IP Ledger stamp fires · marks credited on confirmation.</span>
        </div>
        <button
          onClick={onDismiss}
          style={{
            background: 'rgba(110,231,183,0.12)', border: '1px solid rgba(110,231,183,0.3)',
            color: '#6ee7b7', borderRadius: 8, padding: '8px 24px',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', width: '100%',
          }}
        >
          Claim my Pioneer marks →
        </button>
      </div>
    </div>
  );
}

export default OneClickMeshTestPanel;
