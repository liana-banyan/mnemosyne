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

// BP138 Yoke: one-click HOT/COLD substrate lift -- see runHotColdLiftTest() in
// src/main/mesh_test/one_click_mmlu_pro.ts for the full design note. Persisted separately
// from LS_LAST_RESULT so the standalone single-run result and the last lift result never
// clobber each other.
export const LS_LAST_LIFT_RESULT = 'mnemo_last_hotcold_lift_result';

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

/** BP138 Yoke: mirrors HotColdLiftResult in src/main/mesh_test/one_click_mmlu_pro.ts. */
export interface HotColdLiftResult {
  startedAt: string;
  completedAt: string;
  cold: OneClickRunResult;
  hot: OneClickRunResult;
  coldLabel: string;
  hotLabel: string;
  coldAccuracy: number | null;
  hotAccuracy: number | null;
  coldScored: number;
  hotScored: number;
  coldCorrect: number;
  hotCorrect: number;
  n: number;
  liftPp: number | null;
  belowMinN: boolean;
  minMeaningfulN: number;
  cancelled: boolean;
}

type HotColdProgressEvent =
  | { type: 'arm-start'; arm: 'cold' | 'hot'; label: string }
  | { type: 'arm-complete'; arm: 'cold' | 'hot'; result: OneClickRunResult }
  | { type: 'start'; total: number }
  | { type: 'peers-discovered'; count: number }
  | { type: 'question-start'; index: number; total: number; question: string; category: string }
  | { type: 'question-complete'; index: number; total: number; outcome: QuestionOutcome }
  | { type: 'complete'; result: HotColdLiftResult }
  | { type: 'cancelled'; result: HotColdLiftResult };

export function loadLastMeshTestResult(): OneClickRunResult | null {
  try {
    const raw = localStorage.getItem(LS_LAST_RESULT);
    if (!raw) return null;
    return JSON.parse(raw) as OneClickRunResult;
  } catch {
    return null;
  }
}

export function loadLastLiftResult(): HotColdLiftResult | null {
  try {
    const raw = localStorage.getItem(LS_LAST_LIFT_RESULT);
    if (!raw) return null;
    return JSON.parse(raw) as HotColdLiftResult;
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

// ─── BP138 Yoke 0.9.14: shared results/receipt view ───────────────────────────
// Extracted verbatim from this panel's own completed-result JSX so the new Proof tab (Phase 1
// of the nav-reorg) can show the same aggregate + receipt without a second, independently
// drifting copy of this block -- Power/Diagnostics (this panel, unmodified below) and Proof
// both render exactly this component, fed by the same persisted OneClickRunResult.

export interface MeshTestResultSummaryProps {
  result: OneClickRunResult;
  onShareResult?: (result: OneClickRunResult) => void;
  /** BP138 Yoke 0.9.14: Proof tab passes true to additionally render a collapsible
   *  per-question list (each question + its provenance receipt row) -- this is the "how this
   *  answer was assembled" detail the Proof tab asks for, built entirely from data already
   *  present on `result.outcomes` (no new IPC, no fabricated numbers). Power/Diagnostics's
   *  own inline use of this component (below) omits this flag, matching its pre-existing
   *  on-screen output exactly. */
  showPerQuestionDetail?: boolean;
}

export function MeshTestResultSummary({ result, onShareResult, showPerQuestionDetail }: MeshTestResultSummaryProps): React.ReactElement {
  // BP137 Honest-MMLU-Provenance Yoke, Step 2+3: the provenance-backed subset of this result's
  // outcomes -- only outcomes with at least one named-source receipt count here, per Step 2's
  // explicit "no receipt -> not substrate-sourced" rule. This is the SINGLE headline number for
  // this benchmark (never the raw "all outcomes" percentage, which may include un-sourced
  // single-shot/Minor-Council answers that are pure model recall, not swarm-provenance).
  const sourcedOutcomes = result.outcomes.filter(isProvenanceSourced);
  const sourcedScored = sourcedOutcomes.filter((o) => o.parsedLetter !== null).length;
  const sourcedCorrect = sourcedOutcomes.filter((o) => o.isCorrect).length;
  const sourcedAccuracy = sourcedScored > 0 ? sourcedCorrect / sourcedScored : null;
  const [detailOpen, setDetailOpen] = useState(false);

  return (
    <div>
      <div style={{
        background: '#111827', border: '1px solid #1e2d45', borderRadius: 8,
        padding: '10px 14px', marginBottom: 8,
      }}>
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
              (enable 12-Blade Plow, Local or WAN Mesh, for a sourced-knowledge headline)
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
          {/* WIRE-THE-LOOP fix (single-box local plow): plowEnabled is now meaningful in
              local_ollama results too (see one_click_mmlu_pro.ts), so this label shows for
              either dispatch mode, not just wan_mesh. */}
          {(result.dispatchMode === 'wan_mesh' || result.plowEnabled) && (
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

      {/* BP138 Yoke 0.9.14: Proof tab's "how this answer was assembled" detail -- one row per
          question, reusing the exact same ProvenanceReceiptRow this panel already shows during
          a live run. Collapsed by default since a 70-question run would otherwise dump a wall
          of text into the Proof tab. */}
      {showPerQuestionDetail && result.outcomes.length > 0 && (
        <div style={{
          background: '#111827', border: '1px solid #1e2d45', borderRadius: 8,
          padding: '10px 14px', marginBottom: 8,
        }}>
          <button
            onClick={() => setDetailOpen((v) => !v)}
            style={{
              background: 'none', border: 'none', color: '#94a3b8', fontSize: 11, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'system-ui, sans-serif', padding: 0,
            }}
          >
            {detailOpen ? '▼' : '▶'} How this answer was assembled -- {result.outcomes.length} question(s)
          </button>
          {detailOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {result.outcomes.map((o, i) => (
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
          )}
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
  );
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
  // BP137 Yoke v2b (Research Arm): explicit opt-in, only meaningful when plowEnabled is true.
  // Bundles Stage A.0 (relevance gate moved upstream of the MC voters -- fixes the Bush/Biden
  // off-topic-citation failure mode) + Stage A (answer-type classifier + real compute sidecar
  // for computable questions) together. Off by default, same opt-in pattern as every other
  // toggle here.
  const [researchArmMode, setResearchArmMode] = useState(false);
  // BP138 Yoke 0.9.13 F3: explicit opt-in to mesh-synergy dispatch (asker's round-robin
  // distribution of DIFFERENT authorities -- user_google/user_perplexity/swarm -- across live
  // peers for the SAME question, instead of every peer redundantly running the identical full
  // plow). Only meaningful when plowEnabled + researchArmMode are also true AND mode is
  // wan_mesh with 2+ live peers (see one_click_mmlu_pro.ts's researchArmMeshSynergy doc comment
  // for the exact AND-gate). Off by default, same opt-in pattern as every toggle above.
  const [researchArmMeshSynergy, setResearchArmMeshSynergy] = useState(false);
  // BP138 Yoke Phase 2: explicit opt-in to the Decompose-and-Eliminate engine. AND-gated with
  // researchArmMode at the back-end (one_click_mmlu_pro.ts). Only meaningful in wan_mesh +
  // plowEnabled + researchArmMode. Off by default -- all pre-Phase-2 behavior unchanged.
  const [researchArmDecompose, setResearchArmDecompose] = useState(false);
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

  // BP138 Yoke: one-click HOT/COLD substrate lift -- separate run/progress/result state
  // from the standalone single-run state above so the two features never clobber each
  // other (see LS_LAST_LIFT_RESULT / 'mesh-test:hotcold-progress' channel notes).
  const [liftState, setLiftState] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
  const [liftArm, setLiftArm] = useState<'cold' | 'hot' | null>(null);
  const [liftDoneCount, setLiftDoneCount] = useState(0);
  const [liftTotal, setLiftTotal] = useState(0);
  const [liftPeersDiscovered, setLiftPeersDiscovered] = useState<number | null>(null);
  const [liftResult, setLiftResult] = useState<HotColdLiftResult | null>(() => loadLastLiftResult());
  const [liftErrorMsg, setLiftErrorMsg] = useState<string | null>(null);

  // BP138 Phase 1 Answer Coroner state
  const [coronerState, setCoronerState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [coronerLog, setCoronerLog] = useState<string[]>([]);
  const [coronerRoundup, setCoronerRoundup] = useState<Record<string, unknown> | null>(null);
  const [coronerError, setCoronerError] = useState<string | null>(null);
  // gates config controls so both actions can't
  // race each other and silently produce a confusing mixed-config result.
  const busy = state === 'running' || liftState === 'running';

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
        researchArmMode,
        researchArmMeshSynergy,
        researchArmDecompose,
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
  }, [mode, substrateEnabled, maxTotalQuestions, plowEnabled, plowAndonEnabled, researchArmMode, researchArmMeshSynergy, researchArmDecompose, fullPresetSelected, federatedSubstrateEnabled]);

  // BP138 Yoke: 'mesh-test:hotcold-progress' listener -- a dedicated channel (see
  // one_click_mmlu_pro.ts's opts.progressChannel) so a lift run's two inner
  // runOneClickMmluProTest() calls never emit onto 'mesh-test:progress' and disturb the
  // standalone single-run state/effect above.
  useEffect(() => {
    const unsub = (window as any).amplify?.onMeshTestHotColdProgress?.((payload: HotColdProgressEvent) => {
      if (payload.type === 'arm-start') {
        setLiftArm(payload.arm);
        setLiftDoneCount(0);
        setLiftTotal(0);
        setLiftPeersDiscovered(null);
      } else if (payload.type === 'start') {
        setLiftTotal(payload.total);
        setLiftDoneCount(0);
      } else if (payload.type === 'peers-discovered') {
        setLiftPeersDiscovered(payload.count);
      } else if (payload.type === 'question-complete') {
        setLiftDoneCount(payload.index + 1);
      } else if (payload.type === 'complete' || payload.type === 'cancelled') {
        setLiftResult(payload.result);
        setLiftArm(null);
        setLiftState('complete');
        try { localStorage.setItem(LS_LAST_LIFT_RESULT, JSON.stringify(payload.result)); } catch { /* non-fatal */ }
      }
    });
    return () => unsub?.();
  }, []);

  const handleRunLift = useCallback(async () => {
    setLiftState('running');
    setLiftErrorMsg(null);
    setLiftArm(null);
    setLiftPeersDiscovered(null);
    try {
      // Same config shape/values as "Run the Test" above -- this IS the HOT arm's exact
      // config. The main-process handler runs a COLD arm first with substrate/plow forced
      // off using this same mode/question-count, then this exact config unmodified as HOT.
      const resp = await (window as any).amplify?.meshTestRunHotColdLift?.({
        mode,
        substrateEnabled,
        maxTotalQuestions,
        plowEnabled,
        plowAndonEnabled,
        researchArmMode,
        researchArmMeshSynergy,
        exactPerCategory: fullPresetSelected ? 5 : undefined,
        federatedSubstrateEnabled,
      });
      if (!resp?.ok) {
        setLiftErrorMsg(resp?.error ?? 'HOT/COLD lift run failed to start');
        setLiftState('error');
      }
      // Completion is reported via the mesh-test:hotcold-progress 'complete' event above.
    } catch (e) {
      setLiftErrorMsg(String(e));
      setLiftState('error');
    }
  }, [mode, substrateEnabled, maxTotalQuestions, plowEnabled, plowAndonEnabled, researchArmMode, researchArmMeshSynergy, fullPresetSelected, federatedSubstrateEnabled]);

  // BP138 Phase 1: Answer Coroner -- run autopsy over existing benchmark data in Supabase.
  const handleRunCoroner = useCallback(async () => {
    setCoronerState('running');
    setCoronerLog([]);
    setCoronerRoundup(null);
    setCoronerError(null);
    // subscribe to progress messages
    const unsub = (window as any).amplify?.onCoronerProgress?.((msg: string) => {
      setCoronerLog((prev) => [...prev.slice(-199), msg]);
    });
    try {
      const resp = await (window as any).amplify?.runAnswerCoroner?.({ limit: 500 });
      if (resp?.ok) {
        setCoronerRoundup(resp.roundup as Record<string, unknown>);
        setCoronerState('done');
      } else {
        setCoronerError(resp?.error ?? 'Coroner failed');
        setCoronerState('error');
      }
    } catch (e) {
      setCoronerError(String(e));
      setCoronerState('error');
    } finally {
      unsub?.();
    }
  }, []);

  const runningAccuracy = liveOutcomes.length > 0
    ? liveOutcomes.filter((o) => o.isCorrect).length / liveOutcomes.length
    : null;

  const modeButton = (choice: DispatchModeChoice, label: string) => (
    <button
      onClick={() => setMode(choice)}
      disabled={busy}
      style={{
        background: mode === choice ? '#10b981' : 'transparent',
        color: mode === choice ? '#0d1117' : '#94a3b8',
        border: `1px solid ${mode === choice ? '#10b981' : '#1e2a38'}`,
        borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600,
        cursor: busy ? 'default' : 'pointer', fontFamily: 'system-ui, sans-serif',
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
        claim: "12-Blade Column Plow" mode (checkbox below, works in Local or WAN Mesh) answers
        by fetching facts from named independent authorities (Wikipedia, arXiv, OpenAlex,
        PubMed, browser-authority Google/Perplexity, etc.) and shows a receipt under each
        answer. Without Plow, the model answers from its own knowledge with no receipt -- those
        answers are shown but are never counted as substrate-sourced (see the headline below).
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {modeButton('auto', 'Auto (WAN if live)')}
        {modeButton('wan_mesh', 'WAN Mesh only')}
        {modeButton('local_ollama', 'Local -- full plow (this machine)')}
      </div>
      {/* WIRE-THE-LOOP fix (single-box local plow, M0 goal): Local mode now runs the SAME
          Plow / Research Arm / Browser Authority / Decompose pipeline as WAN mesh, entirely on
          this machine (this machine's own signed-in Perplexity/Google via browser authority,
          no WAN peers needed) -- see one_click_mmlu_pro.ts's answerQuestionLocallyViaPlow. Mesh
          Synergy and federated substrate remain WAN-only (they need 2+ live peers by
          definition) and stay greyed out below when this mode is selected. */}
      {mode === 'local_ollama' && (
        <div style={{ fontSize: 10, color: '#475569', marginBottom: 10, marginTop: -6 }}>
          Local mode now runs the full plow (Research Arm, Browser Authority, Decompose) on this
          machine using your own signed-in Perplexity + Google sessions -- no WAN peers required.
          Mesh Synergy and federated substrate stay WAN-only below.
        </div>
      )}

      {/* BP133 Yoke #24 Task 1: explicit substrate on/off switch, honored on both local and
          WAN dispatch (see src/main/mesh_test/substrate_toggle.ts). Off by default. */}
      <label
        style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
          fontSize: 12, color: '#94a3b8', cursor: busy ? 'default' : 'pointer',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <input
          type="checkbox"
          checked={substrateEnabled}
          disabled={busy}
          onChange={(e) => { setSubstrateEnabled(e.target.checked); setFullPresetSelected(false); }}
        />
        Substrate context {substrateEnabled ? 'ON' : 'OFF'}
        <span style={{ color: '#475569', fontSize: 10 }}>
          (ON injects related topical eblets into the prompt; OFF sends the bare question, no substrate call is made at all)
        </span>
      </label>

      {/* BP133 Yoke #24 Task 2: explicit opt-in to the 12-Blade Column Plow. Combined with the
          substrate toggle above, these two switches select Condition A (plow OFF + substrate
          OFF = single-shot cold), B (plow ON + substrate ON, single pass), or C (plow ON +
          substrate ON + Andon loop) from Yoke #24's runnable milestone. WIRE-THE-LOOP fix
          (single-box local plow, M0 goal): no longer WAN-only -- in local_ollama mode this
          machine runs the full plow itself instead of a single Ollama call (see
          one_click_mmlu_pro.ts's answerQuestionLocallyViaPlow). */}
      <label
        style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
          fontSize: 12, color: '#94a3b8',
          cursor: busy ? 'default' : 'pointer',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <input
          type="checkbox"
          checked={plowEnabled}
          disabled={busy}
          onChange={(e) => { setPlowEnabled(e.target.checked); setFullPresetSelected(false); }}
        />
        12-Blade Column Plow {plowEnabled ? 'ON' : 'OFF'}
        <span style={{ color: '#475569', fontSize: 10 }}>
          (ON: the answering machine -- this machine in Local mode, the responding peer in WAN
          Mesh mode -- runs the full specialist-swarm + Miner/Saladin/Furnace pipeline instead of
          a single Ollama call. Slower; WAN Mesh per-question timeout auto-raised to 5min)
        </span>
      </label>
      {plowEnabled && (
        <label
          style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, marginLeft: 20,
            fontSize: 12, color: '#94a3b8', cursor: busy ? 'default' : 'pointer',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <input
            type="checkbox"
            checked={plowAndonEnabled}
            disabled={busy}
            onChange={(e) => { setPlowAndonEnabled(e.target.checked); setFullPresetSelected(false); }}
          />
          Andon retry loop {plowAndonEnabled ? 'ON (Condition C)' : 'OFF (Condition B, single pass)'}
        </label>
      )}
      {plowEnabled && (
        <label
          style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, marginLeft: 20,
            fontSize: 12, color: '#94a3b8', cursor: busy ? 'default' : 'pointer',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <input
            type="checkbox"
            checked={researchArmMode}
            disabled={busy}
            onChange={(e) => { setResearchArmMode(e.target.checked); setFullPresetSelected(false); }}
          />
          Research Arm (Stage A.0+A) {researchArmMode ? 'ON' : 'OFF'}
          <span style={{ color: '#475569', fontSize: 10 }}>
            (ON: relevance gate moved upstream of the MC voters -- abstains rather than voting on off-topic sources -- plus a classifier + deterministic compute sidecar for computable questions)
          </span>
        </label>
      )}
      {/* BP138 Yoke 0.9.13 F3: Mesh Synergy checkbox -- mirrors the Research Arm checkbox
          immediately above. Gated WAN-mesh + plow + research-arm-only: this is an asker-side
          decision about distributing DIFFERENT authorities across live peers for the SAME
          question, which only makes sense with 2+ live WAN peers actually dispatched to.
          Rendering follows the same plowEnabled-nested pattern as researchArmMode above;
          additionally greyed out/disabled (never hidden) when mode isn't wan_mesh or
          researchArmMode is off, same convention as the federated-substrate gating below. */}
      {plowEnabled && researchArmMode && (() => {
        const meshSynergyGated = busy || mode !== 'wan_mesh';
        return (
          <label
            style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, marginLeft: 20,
              fontSize: 12, color: meshSynergyGated ? '#475569' : '#94a3b8',
              cursor: meshSynergyGated ? 'default' : 'pointer',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            <input
              type="checkbox"
              checked={researchArmMeshSynergy}
              disabled={meshSynergyGated}
              onChange={(e) => { setResearchArmMeshSynergy(e.target.checked); setFullPresetSelected(false); }}
            />
            Mesh Synergy {researchArmMeshSynergy ? 'ON' : 'OFF'} (requires 2+ peers)
            <span style={{ color: '#475569', fontSize: 10 }}>
              (ON: distributes DIFFERENT authorities -- Google/Perplexity/swarm -- round-robin
              across live WAN peers for the SAME question, then pools their answers, instead of
              every peer redundantly running the identical full plow. WAN Mesh mode only.)
            </span>
          </label>
        );
      })()}

      {/* BP138 Yoke Phase 2: Decompose-and-Eliminate engine checkbox. Nested under
          plowEnabled + researchArmMode. WIRE-THE-LOOP fix (single-box local plow, M0 goal):
          no longer WAN-mesh-gated -- the decompose engine (plow_mc_decompose.ts) needs no WAN
          peer at all, it runs on whichever machine answers the question (this machine in Local
          mode, via browser authority reaching this machine's own signed-in sessions). Only
          `busy` disables it now; unlike Mesh Synergy (which genuinely needs 2+ peers), this
          toggle is fully functional in every dispatch mode. */}
      {plowEnabled && researchArmMode && (
        <label
          style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, marginLeft: 20,
            fontSize: 12, color: busy ? '#475569' : '#94a3b8',
            cursor: busy ? 'default' : 'pointer',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <input
            type="checkbox"
            checked={researchArmDecompose}
            disabled={busy}
            onChange={(e) => { setResearchArmDecompose(e.target.checked); setFullPresetSelected(false); }}
          />
          Decompose+Eliminate {researchArmDecompose ? 'ON' : 'OFF'}
          <span style={{ color: '#475569', fontSize: 10 }}>
            (ON: breaks each option into an atomic foundation-fact query, verifies it via
            browser authority, and eliminates options whose fact verifies false -- deterministic
            conclude or honest abstain. Requires Plow + Research Arm; works in both Local and WAN
            Mesh mode. BP138 Phase 2.)
          </span>
        </label>
      )}

      {/* BP135 Yoke #34 Phase 5: explicit opt-in to the federated-substrate layer -- pools
          topical eblets across ALL live peers instead of each peer using only its own local
          substrate. Only meaningful when substrate is ON and dispatch mode is wan_mesh; greyed
          out and disabled otherwise (mirrors the plowEnabled/mode gating above). */}
      {(() => {
        const federatedGated = busy || mode !== 'wan_mesh' || !substrateEnabled;
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
            disabled={busy}
            style={{
              background: !fullPresetSelected && maxTotalQuestions === n ? '#10b981' : 'transparent',
              color: !fullPresetSelected && maxTotalQuestions === n ? '#0d1117' : '#94a3b8',
              border: `1px solid ${!fullPresetSelected && maxTotalQuestions === n ? '#10b981' : '#1e2a38'}`,
              borderRadius: 6, padding: '3px 9px', fontSize: 11, fontWeight: 600,
              cursor: busy ? 'default' : 'pointer', fontFamily: 'system-ui, sans-serif',
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
          disabled={busy}
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
          disabled={busy}
          style={{
            background: fullPresetSelected ? '#facc15' : 'transparent',
            color: fullPresetSelected ? '#0d1117' : '#facc15',
            border: `1px solid ${fullPresetSelected ? '#facc15' : '#4d3a0a'}`,
            borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700,
            cursor: busy ? 'default' : 'pointer', fontFamily: 'system-ui, sans-serif',
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
          disabled={busy}
          style={{
            background: '#10b981', color: '#fff', border: 'none', borderRadius: 6,
            padding: '8px 16px', fontSize: 13, fontWeight: 700,
            cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
            fontFamily: 'system-ui, sans-serif', marginRight: 8,
          }}
        >
          ▶ Run the Test
        </button>
      )}

      {/* BP138 Yoke: one-click HOT/COLD substrate lift -- runs the SAME question set/config
          TWICE (substrate+plow forced off, then exactly what's currently toggled above) and
          shows COLD/HOT/LIFT/n in one action instead of a human running twice and subtracting
          by hand. See runHotColdLiftTest() in one_click_mmlu_pro.ts. */}
      {liftState !== 'running' && (
        <button
          onClick={() => void handleRunLift()}
          disabled={busy}
          title="Runs the same question set twice: once with substrate+plow OFF (COLD baseline), once with your current toggles above (HOT) -- then shows the lift."
          style={{
            background: 'transparent', color: '#facc15', border: '1px solid #4d3a0a', borderRadius: 6,
            padding: '8px 16px', fontSize: 13, fontWeight: 700,
            cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          🔥❄️ Run HOT/COLD Lift
        </button>
      )}

      {liftState === 'running' && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: '#facc15', animation: 'mnemo-pulse 1.5s ease-in-out infinite' }}>
            ◌ Running {liftArm === 'cold' ? 'COLD' : liftArm === 'hot' ? 'HOT' : '...'} arm
            {liftPeersDiscovered !== null && liftPeersDiscovered > 0
              ? ` — ${liftPeersDiscovered} live peer(s)`
              : liftPeersDiscovered === 0 ? ' — no live peers, running locally' : ''}
            {liftTotal > 0 && ` — question ${liftDoneCount}/${liftTotal}`}
          </div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
            {liftArm === 'cold'
              ? 'COLD baseline: substrate+plow forced OFF, everything else identical to your current settings'
              : liftArm === 'hot'
                ? 'HOT: your current settings above, unmodified'
                : ''}
          </div>
        </div>
      )}

      {liftState === 'error' && (
        <div style={{ fontSize: 12, color: '#f87171', marginTop: 8 }}>✗ {liftErrorMsg}</div>
      )}

      {(liftState === 'complete' || (liftState === 'idle' && liftResult)) && liftResult && (
        <div style={{
          marginTop: 12, background: '#111827', border: '1px solid #4d3a0a', borderRadius: 8,
          padding: '10px 14px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#facc15', marginBottom: 6 }}>
            🔥❄️ HOT/COLD Lift
          </div>
          {liftResult.hotScored === 0 && liftResult.cancelled ? (
            <div style={{ fontSize: 12, color: '#facc15' }}>
              Stopped during the COLD arm — no HOT run was attempted, no lift to report.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>
                COLD {liftResult.coldAccuracy != null ? `${(liftResult.coldAccuracy * 100).toFixed(0)}%` : 'n/a'}
                {' / '}
                HOT {liftResult.hotAccuracy != null ? `${(liftResult.hotAccuracy * 100).toFixed(0)}%` : 'n/a'}
                {' / '}
                LIFT {liftResult.liftPp != null
                  ? `${liftResult.liftPp >= 0 ? '+' : ''}${liftResult.liftPp.toFixed(1)}pp`
                  : 'n/a'}
                <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400, marginLeft: 6 }}>
                  (n={liftResult.n})
                </span>
              </div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 5 }}>
                COLD: <span style={{ color: '#94a3b8' }}>{liftResult.coldLabel}</span>
                {' — '}{liftResult.coldCorrect}/{liftResult.coldScored} scored correct
              </div>
              <div style={{ fontSize: 10, color: '#64748b' }}>
                HOT: <span style={{ color: '#94a3b8' }}>{liftResult.hotLabel}</span>
                {' — '}{liftResult.hotCorrect}/{liftResult.hotScored} scored correct
              </div>
              {liftResult.cancelled && (
                <div style={{ fontSize: 10, color: '#facc15', marginTop: 4 }}>
                  ⚠ HOT arm was stopped early (cancelled) — numbers above reflect only the
                  questions answered before stop.
                </div>
              )}
              {liftResult.belowMinN && (
                <div style={{ fontSize: 10, color: '#facc15', marginTop: 4 }}>
                  ⚠ n={liftResult.n} is below this app's {liftResult.minMeaningfulN}-question
                  floor for a meaningful lift number — treat this delta as noisy, not
                  conclusive. Re-run with more questions for a trustworthy result.
                </div>
              )}
            </>
          )}
        </div>
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

      {/* BP138 Yoke 0.9.14: the completed-result summary is now the shared MeshTestResultSummary
          component (defined below, exported) instead of inline JSX here -- the Proof tab reuses
          the SAME component (fed by the same persisted LS_LAST_RESULT) so the aggregate/receipt
          view never has two independently-maintained copies of this JSX. */}
      {(state === 'complete' || (state === 'idle' && result)) && result && (
        <div style={{ marginTop: state === 'complete' ? 12 : 0 }}>
          <MeshTestResultSummary result={result} onShareResult={onShareResult} />
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
        flow is still pending Bishop/Founder confirming 2 or more peers online -- see
        Yoke #23 Bishop handoff.
      </div>

      {/* BP138 Phase 1 -- Answer Coroner autopsy panel */}
      <div style={{ marginTop: 18, borderTop: '1px solid #1e2a38', paddingTop: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 8 }}>
          Answer Coroner (BP138 Phase 1) -- autopsy over existing benchmark data
        </div>
        <button
          onClick={() => void handleRunCoroner()}
          disabled={coronerState === 'running' || busy}
          style={{
            background: coronerState === 'running' ? '#1e2a38' : '#0f766e',
            color: '#e2e8f0', border: 'none', borderRadius: 6,
            padding: '5px 14px', fontSize: 11, fontWeight: 600,
            cursor: (coronerState === 'running' || busy) ? 'default' : 'pointer',
            fontFamily: 'system-ui, sans-serif', marginBottom: 8,
          }}
        >
          {coronerState === 'running' ? 'Running autopsy...' : 'Run Answer Coroner'}
        </button>
        {coronerState === 'running' && coronerLog.length > 0 && (
          <div style={{
            background: '#0a0f17', border: '1px solid #1e2a38', borderRadius: 6,
            padding: '6px 10px', maxHeight: 100, overflowY: 'auto',
            fontSize: 10, color: '#64748b', fontFamily: 'monospace', marginBottom: 8,
          }}>
            {coronerLog.slice(-10).map((msg, i) => <div key={i}>{msg}</div>)}
          </div>
        )}
        {coronerError && (
          <div style={{ fontSize: 11, color: '#f87171', marginBottom: 8 }}>Error: {coronerError}</div>
        )}
        {coronerRoundup && (() => {
          // Real CoronerRoundup shape (answer_coroner.ts / amplify.d.ts runAnswerCoroner) --
          // NOT totalAnalyzed/classCounts/baselineSession, which never existed on this type.
          const r = coronerRoundup as {
            totalRecords?: number;
            correctableWrongs?: number;
            honestAbstains?: number;
            byClass?: Record<string, unknown[]>;
            prioritizedFixList?: Array<{
              answerClass: string;
              count: number;
              exemplars?: Array<{ question?: string; answeredLetter?: string | null; sealedLetter?: string | null }>;
            }>;
          };
          return (
            <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.7 }}>
              <div style={{ marginBottom: 4 }}>
                <span style={{ color: '#f0fdf4', fontWeight: 700 }}>Analyzed:</span> {r.totalRecords ?? '?'} answers
              </div>
              <div style={{ display: 'flex', gap: 18, marginBottom: 8 }}>
                <div>
                  <span style={{ color: '#f87171', fontWeight: 700 }}>Correctable wrongs:</span>{' '}
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#fca5a5' }}>{r.correctableWrongs ?? '?'}</span>
                  <span style={{ color: '#475569', fontSize: 9 }}> -- drive to 0</span>
                </div>
                <div>
                  <span style={{ color: '#6ee7b7', fontWeight: 700 }}>Honest abstains:</span>{' '}
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#a7f3d0' }}>{r.honestAbstains ?? '?'}</span>
                  <span style={{ color: '#475569', fontSize: 9 }}> -- leave honest</span>
                </div>
              </div>
              {r.byClass && (
                <div style={{ marginBottom: 6 }}>
                  <span style={{ color: '#cbd5e1' }}>Class breakdown: </span>
                  {Object.entries(r.byClass).map(([cls, records]) => (
                    <span key={cls} style={{ marginRight: 8 }}>
                      <span style={{ color: '#64748b' }}>{cls}: </span>
                      <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{records.length}</span>
                    </span>
                  ))}
                </div>
              )}
              {r.prioritizedFixList && r.prioritizedFixList.length > 0 && (
                <div>
                  <div style={{ color: '#cbd5e1', marginBottom: 2 }}>Prioritized fix list:</div>
                  {r.prioritizedFixList.slice(0, 5).map((item, i) => (
                    <div key={i} style={{ marginLeft: 8, fontSize: 10, color: '#94a3b8' }}>
                      {i + 1}. {item.answerClass} ({item.count})
                      {item.exemplars && item.exemplars.length > 0 && (
                        <div style={{ marginLeft: 12, color: '#475569' }}>
                          {item.exemplars.slice(0, 3).map((ex, j) => (
                            <div key={j}>
                              -- {(ex.question ?? '').slice(0, 80)}
                              {' '}[answered: {ex.answeredLetter ?? '?'}, correct: {ex.sealedLetter ?? '?'}]
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
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
