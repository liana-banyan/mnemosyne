// plow_mc_answerer.ts — BP133 Yoke #24 Task 2: the 12-Blade Column Plow, adapted to answer a
// single graded multiple-choice question instead of doing open-ended knowledge-building.
//
// WHY THIS FILE EXISTS (R-MECHANISM-VERIFY, 2026-07-24): canonical_pipeline.ts's exported
// runCanonicalPlow() operates on free-text research QUESTIONS per domain and never returns a
// letter answer anywhere in CanonicalPlowQuestionResult -- confirmed by direct read of every
// stage. Its Three Fates arbitration (runThreeFates) asks 3 voters to "give a precise, factual
// answer" in prose; there is no MC-option-aware prompt anywhere in that file. So there was no
// existing function to call for "make the plow answer an MMLU-Pro letter" -- this file is that
// function, built by REUSING (not duplicating) every stage of the real pipeline: the same
// SPECIALIST_REGISTRY 9-specialist staggered swarm, the same Miner/Saladin/Furnace filters, the
// same Andon/Detective-Team widening-and-retry cord, and the same Scribe eblet-writing
// convention -- all imported directly from canonical_pipeline.ts (see the exports added there
// for this Yoke). Only the FINAL arbitration stage differs: instead of 3 free-text voters, this
// runs 3 MC-letter voters and takes a plurality vote, because that is the one stage that
// fundamentally cannot be reused unchanged (free text has no "correct letter" to grade).
//
// SUBSTRATE TOGGLE REUSE (Task 1 continuity): this file does NOT implement its own local-store
// gating. The caller (index.ts's startRelayRoutePoll) already computes `effectivePrompt` via
// substrate_toggle.ts's applySubstrateToggle() ONCE, before branching into single-shot / Minor
// Council / plow -- see that file's own comment for why that is the single authoritative
// injection site for this whole Yoke. This function receives that already-gated prompt and
// treats it as opaque; when substrate is OFF, mcPromptWithSubstrate is byte-identical to the
// raw MC prompt (zero eblet-store calls happened upstream), and this file makes no additional
// eblet-store read of its own for the final-answer prompt. This is what makes Condition A
// (plow, substrate OFF) genuinely cold: the ONLY substrate-shaped input this function ever sees
// is whatever applySubstrateToggle already decided to inject, never more.
//
// Rule 66: version, never overwrite -- this is a new file, no supersede needed.

import { createHash } from 'crypto';
import type { CandidateEblet, SpecialistKeys, SpecialistName } from './specialist_adapters';
import { SPECIALIST_REGISTRY } from './specialist_adapters';
import { getOperatorsForDomain } from './domain_operator_map';
// BP137 Yoke v2b Stage D.3: the backup-adapter registry (real-but-thin adapters + several
// literal no-op stubs, see the widenBeyondDetectivePool() header below for the live-verified
// breakdown of which is which) -- imported alongside the existing domain-operator helper, never
// touching domain_operator_map.ts itself.
import { BACKUP_ADAPTER_REGISTRY, type BackupSpecialistName } from './domain_operator_map';
import {
  callOllama,
  computeArgumentConfidence,
  computeBmvScore,
  evaluateGates,
  generateQuestionId,
  runDetectiveTeam,
  runSaladin,
  runScribe,
  FIREGUARD_STAGGER_MS,
  MAX_ANDON_RETRIES,
  MINER_MIN_CONTENT_LEN,
  MINER_MIN_WEIGHT,
  type ConcordanceClass,
  type GateOutcome,
} from './canonical_pipeline';
// BP137 Yoke v2b Stage A.0: the SAME relevance gate the free-text pipeline already applies at
// WRITE time (canonical_pipeline.ts:518, via mnem_eblet_store.ts:648's isQaRelevant) -- imported
// directly, never duplicated, and applied a second time here, UPSTREAM of the voter prompt. See
// the researchArmRelevanceGate block below for why write-time-only was the Bush/Biden root cause.
// BP137 Yoke v2b Stage D.4: writeVerifiedEblet imported DIRECTLY (same module, same relative
// path already used for isQaRelevant above) so the per-round +/- ledger writes below can use
// the FULL VerifiedEbletEntry shape (class/tic), which the writeEbletFn callback parameter
// (index.ts:6174-6177's fixed-shape wrapper) does not expose -- see this file's Stage D report
// for the full writeEbletFn-vs-writeVerifiedEblet investigation. Same import convention as
// csia_research.ts:38's `import { writeVerifiedEblet, isQaRelevant } from './mnem_eblet_store'`,
// just one directory deeper (`../` instead of `./`).
import { isQaRelevant, writeVerifiedEblet } from '../mnem_eblet_store';
// BP137 Yoke v2b Stage A: answer-type classifier + compute sidecar, both new/additive this Yoke.
import { classifyAnswerType, type AnswerType } from './answer_type_classifier';
import { computeAnswer, parseOptionsFromPrompt, matchValueToOption, extractNumber, type ComputeSidecarResult, type McOption } from './compute_sidecar';
// BP137 Yoke v2b Stage A.0.1: semantic-cosine upgrade to the relevance TEST used inside the
// gate below (the gating FLAG and abstain logic are unchanged -- see semantic_relevance_gate.ts
// header for the full reuse rationale). ollamaManager imported directly (same module already
// used by semantic_soccerball.ts:24) so the question-embedding can be computed ONCE here and
// reused across all candidates via semanticRelevanceFromVector, instead of once per candidate.
import { ollamaManager } from '../ollama_manager';
import { semanticRelevanceFromVector, SEMANTIC_RELEVANCE_THRESHOLD } from './semantic_relevance_gate';
// BP137 Yoke v2b Stage D.1: Psionic (Blade 10) zero-LLM, zero-network keyword-overlap predictor
// -- reused verbatim, never duplicated. PSIONIC_FAST_PATH_THRESHOLD/PSIONIC_MIN_CORROBORATION_
// FOR_FAST_PATH are the SAME tuning constants ai_dispatch_ipc.ts's Ask-path caller already uses
// (ai_dispatch_ipc.ts:774-777) -- reused here, not reinvented, per the Yoke's explicit
// requirement.
import { predictViaPsionic, PSIONIC_FAST_PATH_THRESHOLD, PSIONIC_MIN_CORROBORATION_FOR_FAST_PATH, type PsionicPrediction } from '../psionic_predictor';
// BP137 Yoke v2b Integration-1 (Stage C wiring): the lookup_fact branch's real bridge to the
// user's own logged-in browser session. runBrowserAuthorityLookup/BrowserAuthorityBridge/
// BrowserAuthorityLookupResult are imported directly (never duplicated) from the Stage C module;
// this file constructs the REAL bridge implementation (below, at the call site) whose
// runQueryInUserBrowser reaches index.ts's runBrowserAuthorityQueryFromMain() via a dynamic
// import -- see that call site's own comment for why dynamic (not static) import is required
// here (index.ts already dynamically imports THIS file; a static import in the other direction
// would be a circular top-level require).
import {
  runBrowserAuthorityLookup,
  type BrowserAuthorityBridge,
  type BrowserAuthorityLookupResult,
} from './browser_authority_adapter';
// BP137 Yoke v2b Stage E: the distributed Star Chamber fan-out, fired ONLY at the single call
// site below (Stage D's final don't-know) -- see star_chamber_dispatch.ts's own header for the
// full wiring rationale (genuinely independent Google/Perplexity/Wolfram authorities, never
// model-voting) and minor_star_chamber.ts's header for why that previously-orphaned file's
// adjudication core (not its model-council path) is the real handler underneath this call.
import { runStageEDistributedStarChamber } from './star_chamber_dispatch';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlowMcCondition = 'A_cold' | 'B_warm_single_pass' | 'C_warm_andon';

export interface CanonicalPlowMcConfig {
  domain: string;
  ollamaBaseUrl: string;
  model: string;
  choiceCount: number;
  /** Condition C only. Condition A/B both pass false -- a single pass, win or lose. */
  andonEnabled: boolean;
  specialistKeys?: SpecialistKeys;
  /** BP134 Yoke #32 Phase C: field-sowing-only deep-harvest mode. Undefined/false leaves the
   *  postFurnace cap (6, below) and every adapter cap byte-identical to the live A/B/C button's
   *  measured behavior -- this flag must never be set by that path. Field-sowing (Phase D) is
   *  the only intended caller that ever passes deepHarvest:true. */
  deepHarvest?: boolean;
  /** Cap for the postFurnace slice when deepHarvest is true. Ignored when deepHarvest is falsy. */
  maxEbletsPerQuestion?: number;
  /** BP135 Yoke #34 Phase (0.9.6): OPT-IN, DEFAULT FALSE. Empirically proven this session --
   *  gemma4:12b answers engineering/51 WRONG ("J") under the bare-letter voter prompt (the
   *  entire num_predict budget is spent on the letter itself, no room to reason), but CORRECT
   *  ("Answer: C") when allowed to show its work with a larger token budget. When false/absent,
   *  every voter call is BYTE-IDENTICAL to pre-0.9.6 behavior: same prompt, same num_predict
   *  (256), same parseLetterLocal parsing, no `reasoning` field on voter_diagnostics. When true,
   *  see buildReasoningVoterPrompt()/parseLetterFromReasoning() below for the full opt-in path. */
  reasoningMode?: boolean;
  /** BP135 Yoke #34 (0.9.7) argument-ledger, OPT-IN/OPTIONAL. Ground-truth letter for LOCAL,
   *  POST-HOC verdict tagging ONLY -- never fed into any prompt or voter call, never seen by
   *  the model. The only current caller of this whole MC answerer is the mesh-test relay
   *  responder path (index.ts's startRelayRoutePoll), which already receives
   *  payload.correct_answer_letter unconditionally on every plow-enabled dispatch (both
   *  wan_dispatch.ts and run_mesh_together.mjs send it for their OWN local scoring, per those
   *  files' own doc comments that the responder never previously read it). Presence of this
   *  field is therefore synonymous with "this is a test/eval run", never a production Ask --
   *  undefined/null means verdict is always written as 'unverified' (production default). */
  testModeCorrectAnswerLetter?: string | null;
  /** BP137 Yoke v2b (Research Arm), OPT-IN/DEFAULT FALSE master switch. Every sub-flag below
   *  requires researchArmMode true as well (AND-gated) -- a bare accidental sub-flag flip can
   *  never activate new behavior on its own. When false/absent (every caller that predates this
   *  Yoke, including today's live benchmark responder at index.ts:6168-6180), every line gated
   *  on researchArmMode is unreachable and this function is byte-for-byte identical to its
   *  pre-Stage-A/A.0 behavior. */
  researchArmMode?: boolean;
  /** Stage A.0: move the isQaRelevant check UPSTREAM into factsForArbitration, before the MC
   *  voters ever see a fact, instead of only at Scribe's write-time gate (which fires AFTER
   *  voting). Abstains (chosenLetter: null, no Ollama voter calls made) when the swarm found
   *  candidates but NONE pass isQaRelevant against researchQuery. */
  researchArmRelevanceGate?: boolean;
  /** Stage A: classify the question (computable/lookup_fact/reasoning); for 'computable',
   *  attempt the deterministic compute sidecar BEFORE the specialist swarm fires at all. On a
   *  verified compute + a matching MC option, returns immediately (swarm/voters/Andon never
   *  run for that question). On failure to compute or to match an option, falls through to the
   *  unchanged swarm+voter path below -- never guesses. */
  researchArmComputeSidecar?: boolean;
  /** BP137 Yoke v2b Stage D.2/D.3/D.4, OPT-IN/DEFAULT FALSE, independent AND-gate on top of
   *  researchArmMode (both must be true). Fully independent of config.andonEnabled (Condition
   *  C) -- does NOT change Condition C's existing trigger condition or meaning in any way, per
   *  the Yoke's explicit "do not touch andonEnabled's existing meaning" constraint. When either
   *  researchArmMode or this flag is false/absent (every caller that predates Stage D,
   *  including today's live benchmark responder, which never sets this field), none of the
   *  three new D.2 trigger sites (the compute-fallthrough-abstain escalation attempt, the
   *  relevance-gate-abstain escalation attempt, and the bottom DISCORDANT-independent-of-
   *  andonEnabled trigger) can execute their widen-and-retry branch -- provable by the single
   *  `config.researchArmMode && config.researchArmEscalation` guard shared by all three call
   *  sites into attemptEscalationWidenAndRetry() below. */
  researchArmEscalation?: boolean;
  /** BP137 Yoke v2b Stage D.1, OPT-IN/DEFAULT FALSE, AND-gated with researchArmMode. Enables
   *  the Psionic zero-LLM accelerator call (predictViaPsionic) at all -- both the (informational
   *  -only, never answer-altering) post-voter "concurred/discorded" trace marker AND the
   *  short-circuit path below are unreachable when this is false/absent, regardless of
   *  researchArmMode. */
  researchArmPsionic?: boolean;
  /** BP137 Yoke v2b Stage D.1, OPT-IN/DEFAULT FALSE, its OWN opt-in ON TOP OF researchArmPsionic
   *  (both AND researchArmMode must all be true) -- deliberately NOT folded into the
   *  always-on-when-researchArmPsionic behavior, per the Yoke's explicit "this must be its OWN
   *  opt-in ... and OFF by default" requirement. Only this flag being true lets a high-
   *  confidence, well-corroborated Psionic prediction skip the specialist swarm/voters entirely
   *  (the $0 short-circuit) -- with it false (the default even when researchArmPsionic is on),
   *  Psionic still runs and its prediction is still compared against the voters' chosenLetter
   *  post-hoc (informational psionicConcurred/psionicDiscorded marker only), but it can never
   *  itself decide the served answer. */
  researchArmPsionicShortCircuit?: boolean;
  /** BP137 Yoke v2b Integration-1 (Stage C wiring), OPT-IN/DEFAULT FALSE, AND-gated with
   *  researchArmMode (same convention as every sub-flag above). Enables the lookup_fact branch
   *  below to route through the user's own logged-in Google/Perplexity browser session (via
   *  browser_authority_adapter.ts's runBrowserAuthorityLookup + a REAL BrowserAuthorityBridge
   *  that reaches index.ts's runBrowserAuthorityQueryFromMain()) BEFORE falling through to the
   *  swarm+voter path. When either researchArmMode or this flag is false/absent (every caller
   *  that predates this Integration-1 pass), the whole block is unreachable -- provable by the
   *  single `browserAuthorityOn` guard at its one call site below -- and this function stays
   *  byte-for-byte unchanged for that (default) case. Structurally compatible with
   *  browser_authority_types.ts's BrowserAuthorityAdapterConfig (same two field names/types),
   *  so this config object can be passed there directly with no adapter/mapping layer. */
  researchArmBrowserAuthority?: boolean;
  /** BP137 Yoke v2b Stage E, OPT-IN/DEFAULT FALSE, independent AND-gate on top of
   *  researchArmMode (both must be true) -- same convention as every other researchArm* sub-flag
   *  above. Fires the DISTRIBUTED Star Chamber (star_chamber_dispatch.ts's
   *  runStageEDistributedStarChamber(), which itself reuses minor_star_chamber.ts's
   *  adjudicateDistributedAuthorities()) ONLY at the single call site below, which itself only
   *  runs when `concordance === 'DISCORDANT'` AND Stage D.2's escalation attempt (just above)
   *  either never ran (researchArmEscalation off, or andonRetry already >= MAX_ANDON_RETRIES) or
   *  ran and returned null (no further widening possible) -- i.e. ONLY on Stage D's FINAL
   *  don't-know for this call, never on a confident answer, and never racing ahead of Stage D.
   *  When either researchArmMode or this flag is false/absent (every caller that predates Stage
   *  E, including today's live benchmark responder unless index.ts explicitly fans this flag
   *  in), the one call site below is unreachable -- provable by the single guard there -- and
   *  this function's chosenLetter/concordance/every pre-existing field is byte-for-byte
   *  unchanged. This is genuinely NOT model-voting (which already failed per the Stage E spec):
   *  each of the 3 fanned-out "peers" queries a DIFFERENT independent real-world authority
   *  (Google/browser, Perplexity/browser, Wolfram/compute), never another local or flagship LLM. */
  researchArmStarChamber?: boolean;
}

/** BP133 Yoke #27: per-voter diagnostic detail, always computed (cheap: just string lengths
 *  and a status tag) so the trace can always say WHY a voter came back null instead of just
 *  showing "null" -- Truth-Always per Yoke #27's explicit requirement. Raw response TEXT is
 *  only included when MNEMO_DEBUG_LOG_PROMPTS=1 (same debug flag as Task 1's outbound-prompt
 *  logging) to avoid ballooning every persisted receipt with full Ollama output by default. */
export interface VoterDiagnostic {
  temperature: number;
  status: 'empty_response' | 'parsed_ok' | 'parse_failed';
  responseChars: number;
  /** BP134: first ~200 chars of the raw model text, always populated (not gated behind the
   *  debug flag) so future plow traces show WHAT a voter returned instead of just its status
   *  -- this is what let us tell "empty because thinking ate the budget" apart from "empty
   *  because the model was unreachable" apart from "non-empty but unparseable". */
  rawPreview: string;
  rawResponse?: string; // full text, present only when MNEMO_DEBUG_LOG_PROMPTS=1
  /** BP135 Yoke #34 Phase (0.9.6): the voter's FULL working (step-by-step derivation + final
   *  "Answer: X" line), present ONLY when config.reasoningMode is true -- absent (not empty
   *  string) in the default bare-letter path so old receipts and this new field never collide.
   *  Not gated behind MNEMO_DEBUG_LOG_PROMPTS like rawResponse -- reasoning mode is itself an
   *  explicit opt-in, so its own diagnostic payload is always captured when it runs, per the
   *  Yoke's "capture the FULL working string" requirement (this is what lets the mesh/arbiter
   *  and receipts compare reasoning across nodes later). */
  reasoning?: string;
}

/** BP137 Honest-MMLU-Provenance Yoke, Step 2: the receipt a served answer must carry to be
 *  countable as "substrate-sourced" -- named authority, whether that fact survived Saladin's
 *  adversarial fence (verified), and a content hash so the exact fact text is auditable
 *  without re-fetching the source. Built from the SAME `factsForArbitration` slice the voters
 *  actually saw (see buildMcArbitrationPrompt() below) -- never fabricated after the fact. */
export interface ProvenanceReceipt {
  /** Specialist adapter name, e.g. 'wikipedia', 'arxiv', 'wolfram_alpha' (see
   *  specialist_adapters.ts's CandidateEblet.source -- one of the 9-adapter roster). */
  source: string;
  /** First 16 hex chars of sha256(fact content) -- enough to be a stable, collision-resistant
   *  fingerprint of the exact text the voters were shown, without ballooning the receipt. */
  contentHash: string;
  /** True only when this fact survived runSaladin()'s adversarial-fence challenge (i.e. it is
   *  drawn from postFurnace, not the unchallenged postMiner fallback). False means the swarm
   *  found candidates but Saladin never got to pass judgment on them (fallback path) -- still
   *  independently-sourced, but NOT adversarially verified, and must be labeled as such. */
  verified: boolean;
  /** Direct source URL when the adapter provided one (e.g. Wikipedia page, arXiv abstract). */
  provenanceUrl?: string;
}

export interface CanonicalPlowMcResult {
  questionId: string;
  domain: string;
  /** null = the plow reached no majority letter (DISCORDANT or all-voters-empty). This is a
   *  NO-ANSWER, per the K32-mesh provenance finding (BP103) that a blank must be scored as its
   *  own category, never folded into "wrong" -- the caller (index.ts) must preserve that
   *  distinction rather than coercing null to a random/default letter. */
  chosenLetter: string | null;
  voterLetters: (string | null)[];
  /** BP133 Yoke #27: makes a null voterLetter diagnosable -- was Ollama's response empty (OOM/
   *  concurrency hypothesis) or non-empty-but-unparseable (format-instruction/prompt-length
   *  hypothesis)? See runCanonicalPlowMcAnswer's voter loop. */
  voterDiagnostics: VoterDiagnostic[];
  concordance: ConcordanceClass;
  bmvScore: number;
  gateOutcomes: GateOutcome[];
  specialistsUsed: string[];
  candidatesRaw: number;
  candidatesPostMiner: number;
  candidatesPostFurnace: number;
  andonTriggered: boolean;
  andonRetries: number;
  ebletsWritten: number;
  latencyMs: number;
  /** Human-readable one-line trace for the persisted receipt (Task 2.3) -- audits HOW the
   *  answer was reached without dumping the full candidate corpus into every receipt row. */
  traceSummary: string;
  /** BP137 Honest-MMLU-Provenance Yoke, Step 2: one receipt per fact actually shown to the
   *  3 MC voters (the same slice buildMcArbitrationPrompt() used), so the Prove It UI can
   *  display "answered via Wikipedia/arXiv/etc, verified, hash X" under this served answer.
   *  Empty array means the swarm returned nothing usable for this question -- the caller
   *  must treat that as NOT substrate-sourced (see plow_mc_answerer.ts header + Step 2 spec),
   *  never silently count chosenLetter as provenance-backed when this is empty. */
  provenanceReceipts: ProvenanceReceipt[];
  /** BP137 Yoke v2b Stage A, OPTIONAL/ADDITIVE. Present only when researchArmMode &&
   *  researchArmComputeSidecar were both true for this call (absent -- not false -- on every
   *  pre-Stage-A call and on every call with the flag off, so old receipts and this new field
   *  never collide). */
  answerType?: AnswerType;
  /** BP137 Yoke v2b Stage A, OPTIONAL/ADDITIVE. Present only when the compute sidecar actually
   *  produced a verified value AND it matched an MC option (i.e. only on the early-return
   *  compute path below). Absent whenever the question fell through to the swarm+voter path,
   *  whether because it was not classified computable, or because compute/option-match failed. */
  computeSidecar?: { method: ComputeSidecarResult['method']; expression: string; value: number; matchedOptionValue: number };
  /** BP137 Yoke v2b Stage A.0, OPTIONAL/ADDITIVE. True only when researchArmRelevanceGate fired
   *  an abstain (swarm found candidates, none passed isQaRelevant). Absent otherwise. */
  relevanceGateAbstain?: boolean;
  /** BP137 Yoke v2b Stage D, extra requirement, OPTIONAL/ADDITIVE. True only when the new
   *  compute-fallthrough-no-facts abstain fired (classified computable, compute sidecar
   *  attempted and failed/no-match, AND zero facts were available for the voters -- whether
   *  that emptiness came from the relevance gate or a pure swarm-miss). Distinct from
   *  relevanceGateAbstain above (never both true on the same result -- see the code-ordering
   *  note at this field's call site). Absent otherwise. */
  computeFallthroughAbstain?: boolean;
  /** BP137 Yoke v2b Stage D.1, OPTIONAL/ADDITIVE. True ONLY on the $0 Psionic short-circuit
   *  return path (researchArmMode && researchArmPsionic && researchArmPsionicShortCircuit all
   *  true, plus Psionic cleared its own confidence/corroboration bar and its answer matched an
   *  MC option). Absent on every other return, including every pre-Stage-D call. */
  psionicShortCircuit?: boolean;
  /** BP137 Yoke v2b Stage D.1, OPTIONAL/ADDITIVE, purely informational. Present (true) only
   *  when Psionic ran (researchArmMode && researchArmPsionic), produced a prediction, that
   *  prediction matched an MC option, the short-circuit did NOT fire for this call (or fired-
   *  but-declined -- see call site), AND the voters' own chosenLetter agrees with Psionic's
   *  matched option. NEVER present when it would be false -- absence means either Psionic did
   *  not run, produced no usable match, or disagreed (see psionicDiscorded below). Per the
   *  Yoke's explicit doctrine, this can NEVER change chosenLetter/concordance/gateOutcomes --
   *  it is written strictly AFTER those are already finalized. */
  psionicConcurred?: boolean;
  /** BP137 Yoke v2b Stage D.1, OPTIONAL/ADDITIVE, purely informational, mutually exclusive with
   *  psionicConcurred above. True only when Psionic produced a matched-option prediction that
   *  DISAGREES with the voters' finalized chosenLetter. Same doctrine as psionicConcurred: this
   *  can never alter the served answer, it is observed strictly after the fact. */
  psionicDiscorded?: boolean;
  /** BP137 Yoke v2b Stage E, OPTIONAL/ADDITIVE. Present ONLY when researchArmMode &&
   *  researchArmStarChamber were both true AND the Stage D exhaustion gate (below) actually
   *  fired the distributed Star Chamber for this call -- absent on every pre-Stage-E call and on
   *  every call that never reached a final don't-know. Never changes chosenLetter/concordance
   *  (see the call site's own doc comment) -- this is a transparent receipt of what the
   *  distributed adjudication did, never a silent answer override. */
  starChamber?: {
    peerAuthorities: string[];
    answeredAuthorities: string[];
    consensusReached: boolean;
    hScore: number;
    confidenceVariance: number;
    /** The consensus fact/value the authorities agreed on -- populated ONLY when
     *  consensusReached is true. Never populated on disagreement (honesty firewall). */
    starChamberAnswer: string | null;
    /** Honest "sources say X vs Y" verdict -- populated ONLY when consensusReached is false. */
    disagreementSummary: string | null;
    /** True only when the mesh-fires write to `star_chamber_mesh_fires` (via the
     *  star-chamber-analyze edge function) was confirmed live with a real row id. False means
     *  the attempt degraded to a simulated/dry-run report (see star_chamber_edge_client.ts). */
    meshFireRecorded: boolean;
    meshFireId?: string;
  };
}

// ─── MC-specific final-arbitration prompt ────────────────────────────────────

const MC_VOTER_TEMPERATURES = [0.0, 0.2, 0.4];
// BP135 Yoke #34 Phase (0.9.6): num_predict for a voter call. 256 is the pre-0.9.6 value, used
// on EVERY call unless reasoningMode is true -- discipline requirement: "do NOT add num_predict
// to the non-reasoning path" is satisfied by this being the same literal 256 already hardcoded
// in canonical_pipeline.ts's callOllama default, just named here for the reasoning branch below.
const MC_VOTER_NUM_PREDICT_DEFAULT = 256;
const MC_VOTER_NUM_PREDICT_REASONING = 1024;

function buildMcArbitrationPrompt(factsContext: string, mcPromptWithSubstrate: string): string {
  if (factsContext.length === 0) return mcPromptWithSubstrate;
  return `Additional research context gathered by independent specialists (Wikipedia, Wikidata, arXiv, etc. -- may or may not be directly relevant, use judgment):\n${factsContext}\n\n${mcPromptWithSubstrate}`;
}

function letterFromIndexLocal(i: number): string {
  return String.fromCharCode(65 + i);
}

/** Same parsing convention as one_click_mmlu_pro.ts's parseLetterFromModelText, duplicated
 *  (not imported) to keep this plow module import-graph-independent of the mesh_test/ folder --
 *  canonical_pipeline.ts and its siblings never import from mesh_test/ today, and this file
 *  should not be the first to create that cross-dependency for a one-line regex. */
function parseLetterLocal(text: string, choiceCount: number): string | null {
  const validLetters = Array.from({ length: choiceCount }, (_, i) => letterFromIndexLocal(i));
  const trimmed = text.trim();
  if (validLetters.includes(trimmed.toUpperCase()) && trimmed.length <= 2) return trimmed.toUpperCase();
  const labeled = trimmed.match(/(?:answer|correct answer)\s*(?:is|:)?\s*\(?([A-J])\)?/i);
  if (labeled && validLetters.includes(labeled[1].toUpperCase())) return labeled[1].toUpperCase();
  const paren = trimmed.match(/\(([A-J])\)/);
  if (paren && validLetters.includes(paren[1].toUpperCase())) return paren[1].toUpperCase();
  const bare = trimmed.match(/\b([A-J])\b/);
  if (bare && validLetters.includes(bare[1].toUpperCase())) return bare[1].toUpperCase();
  return null;
}

/** BP135 Yoke #34 Phase (0.9.6): reasoning-mode voter prompt. Deliberately does NOT rebuild the
 *  question/options from scratch (mcPromptWithSubstrate/arbitrationPrompt stay opaque to this
 *  module, per the file's existing substrate-injection-site convention) -- instead it APPENDS an
 *  explicit override after the existing bare-letter-instructed prompt, since models reliably
 *  weight the most recent instruction highest. The override tells the voter to ignore the
 *  earlier "single letter only" instruction, show its work, and end with a fixed "Answer: X"
 *  sentinel line that parseLetterFromReasoning() below can find deterministically even inside a
 *  multi-paragraph derivation. `think` stays false (unchanged in canonical_pipeline.ts's
 *  callOllama) -- this is a bigger VISIBLE completion budget, not internal chain-of-thought. */
function buildReasoningVoterPrompt(basePrompt: string, choiceCount: number): string {
  const lastLetter = letterFromIndexLocal(choiceCount - 1);
  return `${basePrompt}

---
OVERRIDE: ignore the "reply with ONLY the single letter" instruction above. Instead, work through this question step by step, showing your calculation or reasoning explicitly. When you have determined the answer, end your response with one final line, and ONLY that line, written in exactly this format: "Answer: X" (X = the correct option letter, A through ${lastLetter}).`;
}

/** BP135 Yoke #34 Phase (0.9.6): parses the LAST "Answer: X" occurrence in a full reasoning
 *  derivation (a model may say "the answer choices are A, B, C..." mid-derivation before its
 *  real final answer -- the first match would be wrong; the sentinel line requested by
 *  buildReasoningVoterPrompt() is always the LAST one that matters). Falls back to the LAST
 *  bare A-J token anywhere in the text if no "Answer: X" line parses, per the Yoke's explicit
 *  fallback requirement. Never used on the default (non-reasoning) path, which keeps using
 *  parseLetterLocal()'s first-match convention unchanged. */
function parseLetterFromReasoning(text: string, choiceCount: number): string | null {
  const validLetters = Array.from({ length: choiceCount }, (_, i) => letterFromIndexLocal(i));
  const trimmed = text.trim();

  const answerLineRegex = /(?:answer|correct answer)\s*(?:is|:)?\s*\(?([A-J])\)?/gi;
  let match: RegExpExecArray | null;
  let lastAnswerLetter: string | null = null;
  while ((match = answerLineRegex.exec(trimmed)) !== null) {
    const candidate = match[1]!.toUpperCase();
    if (validLetters.includes(candidate)) lastAnswerLetter = candidate;
  }
  if (lastAnswerLetter) return lastAnswerLetter;

  const bareRegex = /\b([A-J])\b/g;
  let lastBare: string | null = null;
  while ((match = bareRegex.exec(trimmed)) !== null) {
    const candidate = match[1]!.toUpperCase();
    if (validLetters.includes(candidate)) lastBare = candidate;
  }
  return lastBare;
}

function computeLetterConcordance(letters: (string | null)[]): { concordance: ConcordanceClass; chosenLetter: string | null } {
  const valid = letters.filter((l): l is string => l !== null);
  if (valid.length === 0) return { concordance: 'DISCORDANT', chosenLetter: null };

  const counts: Record<string, number> = {};
  for (const l of valid) counts[l] = (counts[l] ?? 0) + 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [topLetter, topCount] = sorted[0]!;

  // 3-voter semantics: 3/3 or 2/3 agreement on a letter = usable answer. 1/3 or a 3-way split
  // (topCount === 1 with 3 valid voters) is genuinely discordant -- no real majority exists.
  if (topCount >= 2) {
    return { concordance: topCount === valid.length ? 'CONCORDANT' : 'PARTIAL', chosenLetter: topLetter };
  }
  return { concordance: 'DISCORDANT', chosenLetter: null };
}

// ─── BP137 Yoke v2b Stage D.1: Psionic free-text-answer <-> MC-option matcher ───────────────

/** Minimum fraction of an option's own (stopword-length-filtered) tokens that must be covered
 *  by Psionic's predicted answer text for that option to be considered a candidate match at
 *  all. Deliberately conservative (a bare majority of the option's own wording, not just any
 *  overlap) since a false MATCH here (not a false abstain) is the dangerous direction -- an
 *  incorrect match could feed the $0 short-circuit an outright wrong letter. */
const PSIONIC_OPTION_MATCH_MIN_SCORE = 0.34;

/** The top-scoring option must beat the second-best by at least this much, or the match is
 *  treated as ambiguous (null) rather than guessed. Protects against MC option sets whose
 *  text is itself repetitive/overlapping (e.g. numeric-only options where Psionic's answer
 *  text shares no tokens with any of them and every option scores equally near zero). */
const PSIONIC_OPTION_MATCH_MIN_MARGIN = 0.08;

/** Same lightweight tokenizer convention as computeLetterConcordance's neighbors in this file
 *  (lowercase, strip non-alphanumeric, split on whitespace) -- deliberately NOT importing
 *  psionic_predictor.ts's private tokenize()/STOP_WORDS (module-internal, not exported) or
 *  mnem_eblet_store.ts's tokenizer, to keep this match function's behavior self-contained and
 *  auditable on its own, consistent with this file's existing parseLetterLocal()-style
 *  "duplicated, not imported" convention documented above. */
function tokenizeForOptionMatch(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/** BP137 Yoke v2b Stage D.1: matches Psionic's free-text `answer` against this question's MC
 *  options. Two strategies, tried in order (documented in the Stage D report as the "option-
 *  matching approach" the Yoke asked to be explicit about):
 *   1. Numeric: if Psionic's answer text contains a clean numeric token, reuse (not duplicate)
 *      compute_sidecar.ts's own extractNumber()/matchValueToOption() -- the SAME tolerance-
 *      bounded nearest-option logic the compute sidecar already uses, so a numeric Psionic
 *      answer is held to the identical honesty bar as a computed value.
 *   2. Text-similarity fallback for free-text (non-numeric) answers: token-overlap score of
 *      "what fraction of THIS option's own words appear in Psionic's answer", picking the top
 *      scorer only if it clears both PSIONIC_OPTION_MATCH_MIN_SCORE (absolute floor) AND
 *      PSIONIC_OPTION_MATCH_MIN_MARGIN over the second-best (relative floor) -- an ambiguous or
 *      weak match returns null (no short-circuit, no answer forced), never a best-effort guess.
 */
function matchFreeTextAnswerToOption(
  answerText: string,
  options: McOption[],
): { letter: string; score: number } | null {
  const numeric = extractNumber(answerText);
  if (numeric !== null) {
    const numericMatch = matchValueToOption(numeric, options);
    if (numericMatch) return { letter: numericMatch.letter, score: 1 };
    // A numeric token was present but matched no option within tolerance -- do NOT fall
    // through to the text-similarity heuristic for this same answer (that would risk a
    // false text-match papering over a real numeric mismatch). Honest null.
    return null;
  }

  const answerTokens = new Set(tokenizeForOptionMatch(answerText));
  if (answerTokens.size === 0 || options.length === 0) return null;

  const scored = options
    .map((opt) => {
      const optTokens = tokenizeForOptionMatch(opt.text);
      if (optTokens.length === 0) return { letter: opt.letter, score: 0 };
      const hits = optTokens.filter((t) => answerTokens.has(t)).length;
      return { letter: opt.letter, score: hits / optTokens.length };
    })
    .sort((a, b) => b.score - a.score);

  const top = scored[0];
  const second = scored[1];
  if (!top || top.score < PSIONIC_OPTION_MATCH_MIN_SCORE) return null;
  if (second && top.score - second.score < PSIONIC_OPTION_MATCH_MIN_MARGIN) return null;
  return { letter: top.letter, score: top.score };
}

// ─── BP137 Yoke v2b Stage D.4: per-round +/- eblet ledger writes ────────────────────────────

/** BP137 Yoke v2b Stage D.4: reference pattern is csia_research.ts's runCsiaConcordanceGateAnd
 *  Store (csia_research.ts:229-287) -- ONE class:'whole_answer' eblet carrying `tic.eliminated`
 *  (the MINUS side for this round) plus one class:'component' eblet per surviving/confirmed
 *  fact (the PLUS side), same structurally non-servable placeholder question
 *  ('[component:non-servable]') so a component write can never collide with future exact-
 *  match/serve logic. DIFFERENCE from that reference: this is a PER-ROUND marker, not a final
 *  answer -- there is no `finalAnswer` to write as `tic.known` yet (the round is escalating
 *  BECAUSE no confident answer exists), so the whole_answer eblet's `question`/`answer` fields
 *  are a round-record ("what was tried and why we're widening"), not a servable Q/A pair; its
 *  own question text is intentionally NOT the bare researchQuery (to avoid it ever colliding
 *  with a future real serve/exact-match for that question) -- see the Stage D report for the
 *  full rationale on this field-shape choice. Gated by the caller (attemptEscalationWidenAnd
 *  Retry below) on researchArmMode && researchArmEscalation; never invoked otherwise. Fully
 *  non-fatal -- every write is individually try/caught, matching runScribe's/csia_research.ts's
 *  own non-fatal-write discipline; a failed write here must never affect the answer returned. */
async function writeRoundEblets(
  researchQuery: string,
  domain: string,
  andonRetry: number,
  triggerReason: string,
  rootCause: string,
  plusCandidates: CandidateEblet[],
  minusCandidates: CandidateEblet[],
): Promise<{ written: number }> {
  let written = 0;
  const now = Date.now();

  try {
    await writeVerifiedEblet({
      question: `[round-marker:escalation:${triggerReason}] ${researchQuery.slice(0, 100)}`,
      answer:
        `Stage D escalation round ${andonRetry + 1} (trigger=${triggerReason}): ${rootCause}. ` +
        `${plusCandidates.length} fact(s) confirmed, ${minusCandidates.length} fact(s) eliminated this round.`,
      provenance: `plow_mc_answerer:escalation:${domain}:round${andonRetry + 1}:${now}`,
      verified: true,
      sha256: '',
      timestamp: now,
      class: 'whole_answer',
      tic: {
        known: [],
        theories_open: [],
        eliminated: minusCandidates.map((c) => c.content.slice(0, 300)),
        dependencies_upstream: [],
        applications_downstream: [],
      },
    });
    written++;
  } catch (err) {
    console.warn('[plow_mc_answerer] Stage D round-marker eblet write failed (non-fatal):', err);
  }

  for (const fact of plusCandidates) {
    try {
      await writeVerifiedEblet({
        question: '[component:non-servable]',
        answer: fact.content,
        provenance: `plow_mc_answerer:escalation:component:${fact.source}:round${andonRetry + 1}:${Date.now()}`,
        verified: true,
        sha256: '',
        timestamp: now,
        class: 'component',
        tic: {
          known: [fact.content],
          theories_open: [],
          eliminated: [],
          dependencies_upstream: [fact.provenance_url ?? fact.source],
          applications_downstream: [],
        },
      });
      written++;
    } catch (err) {
      console.warn('[plow_mc_answerer] Stage D component eblet write failed (non-fatal):', err);
    }
  }

  return { written };
}

// ─── BP137 Yoke v2b Stage D.2/D.3: escalation trigger + widen-beyond-the-9-adapter-pool ─────

/** BP137 Yoke v2b Stage D.3: names in domain_operator_map.ts's BACKUP_ADAPTER_REGISTRY that are
 *  literal no-op stubs (`return []` with no HTTP call at all) as of a fresh direct read this
 *  session -- verified by reading every fetch* function backing the registry, not assumed from
 *  the Yoke brief. DISCREPANCY FLAGGED (see this file's Stage D report): the brief named only
 *  pubchem_scaffold/medlineplus_scaffold as "literal return [] stubs" and characterized the
 *  rest ("cornell_lii, sec_edgar, fred, plus...") as "real, thin adapters" -- direct read of
 *  domain_operator_map.ts:143-190 shows fetchCornellLii, fetchFred, fetchSepScaffold, AND
 *  fetchApaScaffold are ALSO unconditional `return []` stubs (only fetchInternetArchive,
 *  fetchSecEdgar, and fetchNcbiBookshelf make a real HTTP call). Per the brief's EXPLICIT
 *  instruction ("skip those two explicitly"), only the two named ones are excluded from the
 *  widened candidate set below -- the other 4-known-stubs are left IN (harmless: they just cost
 *  a wasted round-trip and contribute 0 candidates, same as if they were "real" and simply
 *  found nothing) rather than silently second-guessing the brief's literal instruction. */
const SKIP_BACKUP_ADAPTERS: ReadonlySet<BackupSpecialistName> = new Set(['pubchem_scaffold', 'medlineplus_scaffold']);

interface EscalationWidenParams {
  config: CanonicalPlowMcConfig;
  mcPromptWithSubstrate: string;
  researchQuery: string;
  writeEbletFn: (eblet: {
    question: string; answer: string; provenance: string;
    verified: true; sha256: string; timestamp: number;
  }) => Promise<void>;
  onProgress?: (stage: string) => void;
  andonRetry: number;
  effectiveOperators: SpecialistName[];
  effectiveBackupOperators: BackupSpecialistName[];
  gateOutcomes: GateOutcome[];
  candidatesRaw: number;
  postMinerLen: number;
  postFurnaceLen: number;
  plusCandidates: CandidateEblet[];
  minusCandidates: CandidateEblet[];
  triggerReason: string;
}

/** BP137 Yoke v2b Stage D.2/D.3: the shared widen-and-retry attempt used by all THREE new
 *  escalation trigger sites (the compute-fallthrough-no-facts abstain, the relevance-gate
 *  abstain, and the bottom DISCORDANT-independent-of-andonEnabled trigger) -- one function, so
 *  the three sites cannot drift out of sync with each other. AND-gated on
 *  `config.researchArmMode && config.researchArmEscalation` (checked FIRST, before any other
 *  work) -- when either is false/absent, this returns null immediately and touches nothing
 *  else (no Detective call, no eblet write, no recursion), so every caller's own flag-off path
 *  is provably unaffected.
 *
 *  Composes runDetectiveTeam's existing suggestion (the same "same 9 adapters" pool the free-
 *  text pipeline also draws from, via canonical_pipeline.ts's own call to this same function --
 *  UNMODIFIED here) with a SEPARATE Stage D.3 widening pass over BACKUP_ADAPTER_REGISTRY,
 *  composed AFTER calling runDetectiveTeam (never mutating that shared function's contract, per
 *  the Yoke's explicit "compose, don't mutate" instruction) -- so canonical_pipeline.ts's own
 *  free-text runCanonicalQuestion() (which also calls runDetectiveTeam) is completely
 *  unaffected by this widening.
 *
 *  Returns the RECURSIVE call's result when widening was possible (new specialist and/or backup
 *  operators were found), or null when no genuinely new authority exists to try (caller must
 *  fall through to its own honest abstain/return). D.4's per-round eblet writes happen ONLY on
 *  the branch that is actually about to recurse ("before recursing", per the Yoke's literal
 *  wording) -- a round that discovers "nothing left to try" returns null without writing a
 *  ledger entry for a retry that never happens. */
async function attemptEscalationWidenAndRetry(
  p: EscalationWidenParams,
): Promise<CanonicalPlowMcResult | null> {
  if (!(p.config.researchArmMode && p.config.researchArmEscalation)) return null;
  if (p.andonRetry >= MAX_ANDON_RETRIES) return null;

  const report = runDetectiveTeam(
    p.gateOutcomes, p.candidatesRaw, p.postMinerLen, p.postFurnaceLen, p.effectiveOperators,
  );

  const newBackupOperators = (Object.keys(BACKUP_ADAPTER_REGISTRY) as BackupSpecialistName[]).filter(
    (b) => !SKIP_BACKUP_ADAPTERS.has(b) && !p.effectiveBackupOperators.includes(b),
  );
  const newSpecialistOperators = report.additionalOperators;

  p.onProgress?.(`escalation-trigger:${p.triggerReason}:${p.andonRetry + 1}`);

  const canWiden = newSpecialistOperators.length > 0 || newBackupOperators.length > 0;
  if (!canWiden) {
    p.onProgress?.('escalation-exhausted');
    return null;
  }

  // Stage D.4: fires ONLY now that widening is confirmed possible and a recursive retry is
  // actually about to happen -- "before recursing", non-fatal (try/caught individually inside
  // writeRoundEblets itself; this outer try/catch is defense-in-depth against the function
  // call itself throwing).
  try {
    await writeRoundEblets(
      p.researchQuery, p.config.domain, p.andonRetry, p.triggerReason, report.rootCause,
      p.plusCandidates, p.minusCandidates,
    );
  } catch (err) {
    console.warn('[plow_mc_answerer] Stage D writeRoundEblets threw (non-fatal, swallowed):', err);
  }

  console.log(
    `[plow_mc_answerer] Stage D escalation trigger=${p.triggerReason} retry=${p.andonRetry + 1}/${MAX_ANDON_RETRIES} ` +
    `rootCause="${report.rootCause}" newSpecialists=${JSON.stringify(newSpecialistOperators)} ` +
    `newBackupAdapters=${JSON.stringify(newBackupOperators)}`,
  );

  // Cumulative (not replace-per-round) on purpose -- unlike the pre-existing Condition-C
  // recursive call (which passes ONLY report.additionalOperators as the next widenerOperators,
  // relying on baseOperators ∪ that single round's additions), this Stage D path threads the
  // FULL accumulated set forward so round N+2's effectiveOperators/effectiveBackupOperators are
  // still supersets of round N+1's, making the "round 2 has genuinely new names vs round 1"
  // acceptance check meaningful across more than one retry. This is a new, independent
  // recursion lineage (Stage D's own trigger sites) and does not alter Condition C's own
  // pre-existing recursive call below in any way.
  const cumulativeSpecialists = [...new Set([...p.effectiveOperators, ...newSpecialistOperators])];
  const cumulativeBackups = [...new Set([...p.effectiveBackupOperators, ...newBackupOperators])];

  return runCanonicalPlowMcAnswer(
    p.mcPromptWithSubstrate, p.researchQuery, p.config, p.writeEbletFn, p.onProgress,
    p.andonRetry + 1, cumulativeSpecialists, cumulativeBackups,
  );
}

// ─── Top-level MC answerer (single question, opt-in Andon retry) ────────────

export async function runCanonicalPlowMcAnswer(
  mcPromptWithSubstrate: string,
  researchQuery: string,
  config: CanonicalPlowMcConfig,
  writeEbletFn: (eblet: {
    question: string; answer: string; provenance: string;
    verified: true; sha256: string; timestamp: number;
  }) => Promise<void>,
  onProgress?: (stage: string) => void,
  andonRetry = 0,
  widenerOperators: SpecialistName[] = [],
  // BP137 Yoke v2b Stage D.3, ADDITIVE 8th param, DEFAULT []. Every pre-Stage-D call site
  // (index.ts's live relay-poll responder, and the existing Condition-C recursive self-call a
  // few hundred lines below, which is UNCHANGED and still calls with only 7 args) omits this
  // entirely -- effectiveBackupOperators is therefore always [] on those paths, the new backup-
  // adapter loop below never executes an iteration, and this function is byte-for-byte
  // unchanged on those paths. Only attemptEscalationWidenAndRetry()'s OWN recursive call
  // (reachable only via researchArmMode && researchArmEscalation, see that function) ever
  // passes a non-empty array here.
  widenerBackupOperators: BackupSpecialistName[] = [],
): Promise<CanonicalPlowMcResult> {
  const startMs = Date.now();
  const { domain, ollamaBaseUrl, model, choiceCount, andonEnabled, specialistKeys = {}, deepHarvest, maxEbletsPerQuestion, reasoningMode = false, testModeCorrectAnswerLetter = null } = config;
  const questionId = generateQuestionId(researchQuery, domain);

  // ── BP137 Yoke v2b Stage A / A.2 / A.3: answer-type classifier + compute sidecar ──────────
  // OPT-IN via researchArmMode && researchArmComputeSidecar, both default false/absent. When
  // either is off, computeSidecarOn is false and neither classifyAnswerType nor computeAnswer is
  // ever invoked anywhere in this function -- every line below (the pre-existing specialist
  // swarm through the voter path) is byte-for-byte unchanged from pre-Stage-A behavior, provable
  // by the single guard on computeSidecarOn at the one call site below.
  // BP137 Stage A.3 (this Yoke): the actual compute ATTEMPT used to live here, before the swarm,
  // so it could only ever see the bare question. It now runs AFTER factsForArbitration below (see
  // that block) so it can be handed the SAME relevance-gated facts the voters see -- the
  // question's own formula/constant the swarm already fetched, per the Founder's "components, not
  // answers" design (Bishop-verified this session: NaCl D_e needs the Coulomb constant, the
  // dipole question needs elementary charge `e`, entropy needs the Cv relation -- none of which
  // the bare question text contains). Only the flag + classification bookkeeping stays this
  // early (pure, no network/model call happens until the real attempt below).
  const computeSidecarOn = !!(config.researchArmMode && config.researchArmComputeSidecar);
  // BP137 Yoke v2b Integration-1: same AND-gate convention, gating the lookup_fact branch's
  // browser-authority attempt (see the classification hoist + call site further below, after
  // the swarm). Declared here (alongside computeSidecarOn/psionicOn) purely for readability --
  // it is not read again until after the swarm runs.
  const browserAuthorityOn = !!(config.researchArmMode && config.researchArmBrowserAuthority);
  // Carried through to every return path (abstain, compute-success, and the bottom fallthrough
  // return) so a receipt can always show what the classifier decided even when compute never ran
  // or fell through -- see each return site below.
  let classifiedAnswerType: AnswerType | undefined;

  // ── BP137 Yoke v2b Stage D.1: Psionic zero-LLM accelerator ────────────────────────────────
  // OPT-IN via researchArmMode && researchArmPsionic, both default false/absent. When either is
  // off, psionicOn is false and predictViaPsionic is never invoked anywhere in this function --
  // provable by the single guard on psionicOn below -- so every line from the specialist swarm
  // through the voter path remains byte-for-byte unchanged from pre-Stage-D behavior for every
  // caller that predates this Yoke (including today's live benchmark responder, which never
  // sets researchArmPsionic). Deliberately placed HERE (before the swarm even starts) per the
  // Yoke's explicit "cheap, safe to call early... should not depend on anything the swarm
  // produces" instruction -- predictViaPsionic reads only the local verified-eblet substrate,
  // never the swarm's output.
  const psionicOn = !!(config.researchArmMode && config.researchArmPsionic);
  // Stage D.1's $0 short-circuit is its OWN opt-in on top of psionicOn (never silently folded
  // into the always-on-when-psionicOn behavior) -- see this flag's doc comment on
  // CanonicalPlowMcConfig for the full rationale. Default false even when psionicOn is true.
  const psionicShortCircuitOn = !!(psionicOn && config.researchArmPsionicShortCircuit);
  // Declared `let` (not `const`) so the post-voter concur/discord check far below (after
  // chosenLetter is finalized) can still read whatever this block computed, without a second
  // predictViaPsionic call -- ONE call per question, reused for both the short-circuit decision
  // AND the post-hoc informational marker.
  let psionicPrediction: PsionicPrediction | null = null;
  let psionicMatchedLetter: string | null = null;
  if (psionicOn) {
    try {
      psionicPrediction = await predictViaPsionic(researchQuery);
    } catch (err) {
      // Fail-soft, matching ai_dispatch_ipc.ts's own `catch (err) { console.warn(...) }`
      // pattern around its predictViaPsionic call (ai_dispatch_ipc.ts:707-708) -- Psionic's own
      // doc says it fails soft internally (never throws), this is defense-in-depth only.
      console.warn('[plow_mc_answerer] predictViaPsionic failed (non-fatal, no prediction):', err);
      psionicPrediction = null;
    }
    if (psionicPrediction) {
      const psionicOptions = parseOptionsFromPrompt(mcPromptWithSubstrate);
      const matched = matchFreeTextAnswerToOption(psionicPrediction.answer, psionicOptions);
      psionicMatchedLetter = matched?.letter ?? null;
      const psionicHighConfidence =
        psionicPrediction.confidence >= PSIONIC_FAST_PATH_THRESHOLD &&
        psionicPrediction.corroboratingCount >= PSIONIC_MIN_CORROBORATION_FOR_FAST_PATH;
      if (psionicShortCircuitOn && psionicHighConfidence && psionicMatchedLetter && matched) {
        // $0 SHORT CIRCUIT: Psionic's own zero-LLM graph-walk cleared its fast-path confidence
        // bar AND its predicted answer maps cleanly onto one of THIS question's MC options --
        // the swarm/voters/Andon never run for this call at all, matching the existing
        // compute-sidecar early-return block's style one section below.
        onProgress?.('psionic-short-circuit');
        const psionicLatencyMs = Date.now() - startMs;
        const psionicConcordance: ConcordanceClass = 'CONCORDANT';
        const psionicBmv = computeBmvScore(0, 0, 0, 0, psionicConcordance, 0, psionicLatencyMs);
        const psionicTraceSummary =
          `psionicShortCircuit=true confidence=${psionicPrediction.confidence.toFixed(2)} ` +
          `corroborating=${psionicPrediction.corroboratingCount} hops=${psionicPrediction.hops} ` +
          `matchedOption=${psionicMatchedLetter} matchScore=${matched.score.toFixed(2)} ` +
          `andonRetries=${andonRetry} psionicTrace="${psionicPrediction.traceSummary}"`;
        return {
          questionId,
          domain,
          chosenLetter: psionicMatchedLetter,
          voterLetters: [psionicMatchedLetter],
          voterDiagnostics: [{
            temperature: 0,
            status: 'parsed_ok',
            responseChars: psionicPrediction.answer.length,
            rawPreview: `psionic (zero-LLM): ${psionicPrediction.answer.slice(0, 200)}`,
          }],
          concordance: psionicConcordance,
          bmvScore: psionicBmv,
          // Swarm never ran on this path -- 0 candidates/0 specialists is the HONEST count, not
          // a placeholder; G1_FACT will show failed in gateOutcomes, which correctly reflects
          // that this answer is Psionic-substrate-sourced, not swarm-fact-sourced.
          gateOutcomes: evaluateGates(0, psionicBmv, psionicConcordance, psionicLatencyMs),
          specialistsUsed: [],
          candidatesRaw: 0,
          candidatesPostMiner: 0,
          candidatesPostFurnace: 0,
          andonTriggered: andonRetry > 0,
          andonRetries: andonRetry,
          ebletsWritten: 0,
          latencyMs: psionicLatencyMs,
          traceSummary: psionicTraceSummary,
          provenanceReceipts: [{
            source: `psionic:${psionicPrediction.corroboratingCount}-source-convergence`,
            contentHash: createHash('sha256').update(psionicPrediction.answer).digest('hex').slice(0, 16),
            verified: false,
          }],
          psionicShortCircuit: true,
        };
      }
    }
  }

  // BP134 Yoke #32 Phase C: deepHarvest is opt-in per call (field-sowing only, see config
  // JSDoc). When false/undefined, effectiveSpecialistKeys is byte-identical to the caller's
  // specialistKeys object -- no new field is even present -- so the live A/B/C button's
  // adapter behavior is provably unchanged.
  const effectiveSpecialistKeys: SpecialistKeys = deepHarvest
    ? { ...specialistKeys, maxResultsPerAdapter: specialistKeys.maxResultsPerAdapter ?? maxEbletsPerQuestion ?? 8 }
    : specialistKeys;

  const baseOperators = getOperatorsForDomain(domain);
  const effectiveOperators = [...new Set([...baseOperators, ...widenerOperators])];
  // BP137 Yoke v2b Stage D.3: widenerBackupOperators defaults to [] for every pre-Stage-D call
  // (see this param's own doc comment above) -- effectiveBackupOperators is therefore [] on
  // every such call, and the backup-adapter loop just below never runs an iteration.
  const effectiveBackupOperators = [...new Set(widenerBackupOperators)];

  // ── 9 Specialists in parallel staggered swarm (FireGuard 1.0s stagger) ────
  const allCandidates: CandidateEblet[] = [];
  const specialistsUsed: string[] = [];
  for (let i = 0; i < effectiveOperators.length; i++) {
    const specialistName = effectiveOperators[i];
    if (!specialistName) continue;
    if (i > 0) await new Promise<void>((resolve) => setTimeout(resolve, FIREGUARD_STAGGER_MS));
    onProgress?.(`specialist-fire:${specialistName}`);
    try {
      const fn = SPECIALIST_REGISTRY[specialistName];
      const candidates = await fn(researchQuery, domain, effectiveSpecialistKeys);
      allCandidates.push(...candidates);
      specialistsUsed.push(specialistName);
    } catch { /* adapter error -- non-fatal, continue */ }
  }
  // BP137 Yoke v2b Stage D.3: NEW-tier widening beyond the 9-adapter SPECIALIST_REGISTRY pool.
  // BackupAdapterFn's signature (domain_operator_map.ts:227) is `(question) => Promise<
  // CandidateEblet[]>` -- deliberately narrower than SPECIALIST_REGISTRY's `(question, domain,
  // specialistKeys)` -- so this is its own small loop rather than folded into the swarm loop
  // above (bridging the signature difference with a loop, not a mismatched-args call). Only
  // ever non-empty when attemptEscalationWidenAndRetry() below recursed with backup names.
  for (const backupName of effectiveBackupOperators) {
    const fn = BACKUP_ADAPTER_REGISTRY[backupName];
    if (!fn) continue;
    onProgress?.(`specialist-fire:${backupName}`);
    try {
      const candidates = await fn(researchQuery);
      allCandidates.push(...candidates);
      specialistsUsed.push(backupName);
    } catch { /* adapter error -- non-fatal, continue */ }
  }
  const candidatesRaw = allCandidates.length;

  // ── Miner — anti-popularity filter ────────────────────────────────────────
  const postMiner = allCandidates.filter(
    (c) => c.weight >= MINER_MIN_WEIGHT && c.content.length >= MINER_MIN_CONTENT_LEN,
  );
  onProgress?.('miner-done');

  // ── Saladin — Adversarial Fence ────────────────────────────────────────────
  // BP134 Yoke #32 Phase C: postFurnaceCap defaults to the live button's unchanged 6. Only
  // field-sowing's deepHarvest:true raises it (to maxEbletsPerQuestion, default 20 if unset).
  const postFurnaceCap = deepHarvest ? (maxEbletsPerQuestion ?? 20) : 6;
  const { passed: saladinPassed } = await runSaladin(postMiner, ollamaBaseUrl, model);
  const postFurnace = saladinPassed.sort((a, b) => b.weight - a.weight).slice(0, postFurnaceCap);
  onProgress?.('furnace-done');

  // ── MC Three Fates — 3-voter LETTER arbitration (the one stage that cannot be reused
  //    unchanged from the free-text pipeline; everything upstream/downstream of this is
  //    identical machinery to canonical_pipeline.ts) ─────────────────────────
  // BP133 Yoke #27 Task 27.1 secondary mitigation: hard-trimmed from 5 sources x 400 chars to
  // 3 x 300. A long facts block prepended before the question can push gemma4:12b to ignore
  // the trailing "reply with ONLY the single letter" instruction, and every char here adds to
  // per-question latency (Task 27.2). Not the confirmed root cause (that was the concurrency
  // bug above), but a real secondary risk called out in the Yoke, cheap to fix at the same time.
  const factsForArbitrationUnfiltered = postFurnace.length > 0 ? postFurnace : postMiner.slice(0, 3);
  // ── BP137 Yoke v2b Stage A.0: relevance gate moved UPSTREAM of the voters ────────────────
  // OPT-IN via researchArmMode && researchArmRelevanceGate, both default false/absent. When
  // either is off, relevanceGateOn is false and factsForArbitration is the exact same reference
  // as factsForArbitrationUnfiltered -- a byte-identical no-op passthrough, provably unchanged.
  //
  // THIS IS THE FIX for the root cause the Appendix wiring map identified: isQaRelevant already
  // existed (mnem_eblet_store.ts:648) and worked, but only ever fired at Scribe WRITE time
  // (canonical_pipeline.ts:518's runScribe, called from THIS file at the bottom, well AFTER the
  // voters below have already voted). That is exactly how the sight-draft question's voters saw
  // "George W. Bush"/"Joe Biden" and the chemistry question's voters saw "Tuatara"/"Sati" --
  // Miner (weight/length) and Saladin (adversarial plausibility) never check topicality, so a
  // wholly off-topic Wikipedia page can sail through both filters and land in
  // factsForArbitration. Applying the SAME check (imported, not duplicated) here means an
  // irrelevant candidate can never reach factsContext/arbitrationPrompt in the first place.
  const relevanceGateOn = !!(config.researchArmMode && config.researchArmRelevanceGate);
  // BP137 Yoke v2b Stage A.0.1: the relevance TEST inside this gate is now embedding cosine
  // similarity (semantic_relevance_gate.ts), replacing the token-overlap isQaRelevant() test
  // that used to run directly in this filter. `isQaRelevant` stays imported above and is used
  // as the FALLBACK when embeddings are unavailable for this run (see below) -- per the Yoke's
  // explicit fallback-discipline requirement, never crash/silently-drop, always degrade to the
  // pre-existing token-overlap behavior.
  //
  // relevanceGateMethod records which mechanism actually fired, surfaced in the trace strings
  // below (traceSummary / abstainTraceSummary) as `relevanceGateMethod=semantic` or
  // `relevanceGateMethod=token-fallback`, consistent with this file's existing trace-string
  // convention. Stays null when relevanceGateOn is false (nothing ran).
  //
  // `factsForArbitration` is declared `let` (was `const`) ONLY so the true-branch below can
  // reassign it -- the flag-off path below still assigns nothing new and `factsForArbitration`
  // remains the exact same object reference as `factsForArbitrationUnfiltered`, byte-identical
  // no-op passthrough, unchanged from pre-Stage-A.0.1 behavior.
  let relevanceGateMethod: 'semantic' | 'token-fallback' | null = null;
  let factsForArbitration = factsForArbitrationUnfiltered;
  if (relevanceGateOn) {
    // Embed the researchQuery ONCE (not once per candidate) so N candidates cost N+1 embed
    // calls total instead of 2N -- avoids an unnecessary embed call per candidate per the
    // Yoke's efficiency requirement. ollamaManager.embed is fail-soft (ollama_manager.ts:343):
    // returns null, never throws, if Ollama's embed path is down or the model is missing.
    const questionVec = await ollamaManager.embed(researchQuery);
    if (questionVec) {
      relevanceGateMethod = 'semantic';
      const scored = await Promise.all(
        factsForArbitrationUnfiltered.map(async (c) => {
          const sim = await semanticRelevanceFromVector(questionVec, c.content);
          // A null per-candidate fact-embed (question embed already succeeded, so this would
          // only happen on a transient per-call failure) falls back to the token check for
          // just that one candidate -- same fail-soft discipline, finest-grained fallback.
          const passes = sim !== null
            ? sim >= SEMANTIC_RELEVANCE_THRESHOLD
            : isQaRelevant(researchQuery, c.content);
          return { c, passes };
        }),
      );
      factsForArbitration = scored.filter((s) => s.passes).map((s) => s.c);
    } else {
      // Embeddings unavailable for this run (Ollama's embed path is down/missing model) --
      // fall back to the EXISTING token-based isQaRelevant() check for every candidate, per
      // the Yoke's explicit fallback-discipline requirement. Never throws, never drops
      // everything silently.
      relevanceGateMethod = 'token-fallback';
      factsForArbitration = factsForArbitrationUnfiltered.filter((c) => isQaRelevant(researchQuery, c.content));
    }
  }
  // Appended to trace strings below only when the gate actually ran (relevanceGateMethod is
  // null, not a string, when relevanceGateOn is false) -- flag-off traces are byte-unchanged.
  const relevanceGateMethodTrace = relevanceGateMethod ? ` relevanceGateMethod=${relevanceGateMethod}` : '';
  // BP137 Stage A.3: extracted once here (was previously inlined only at factsContext below) so
  // the EXACT SAME formatted strings can be handed to the compute sidecar as componentFacts AND
  // to the voters as factsContext -- one array, two consumers, never reformatted or diverged
  // between them. Computing this here (even on calls where computeSidecarOn is false) is a pure,
  // cheap array map with no observable side effect -- factsContext below is now just
  // `.join('\n\n')` of this same list, so the flag-OFF value of factsContext is unchanged.
  const componentFactsList = factsForArbitration
    .slice(0, 3)
    .map((c, i) => `[Source ${i + 1} -- ${c.source}]: ${c.content.slice(0, 300)}`);

  // ── BP137 Yoke v2b Stage A + A.2 + A.3: the actual compute ATTEMPT ────────────────────────
  // Moved to here (Stage A.3) from before the swarm (Stage A/A.2's position) specifically so
  // componentFactsList -- the SAME post-relevance-gate facts the voters are about to see -- can
  // be threaded into computeViaModelExpression as optional reference material. Runs BEFORE the
  // relevance-gate abstain check below on purpose: a computable question (business/economics-
  // style) may need zero facts to solve, so it still deserves an attempt even when the abstain
  // condition (swarm found candidates, none passed isQaRelevant) would otherwise fire for the
  // VOTER path -- componentFactsList is simply empty in that case, identical to Stage A.2's
  // question-only prompt.
  // BP137 Yoke v2b Integration-1: widened from `if (computeSidecarOn)` to
  // `if (computeSidecarOn || browserAuthorityOn)` so the (cheap, pure, no I/O) classification
  // call also runs for a browserAuthorityOn-only caller -- for every pre-Integration-1 caller
  // (both flags false/absent, including today's live benchmark responder before this Yoke),
  // this condition is unchanged (`false || false` === the old `false`), so classification still
  // never runs and this function stays byte-for-byte unchanged for that default case. When
  // computeSidecarOn is true (regardless of browserAuthorityOn), classification runs at the
  // exact same point it always did -- unchanged for every existing computeSidecarOn caller too.
  if (computeSidecarOn || browserAuthorityOn) {
    const answerType = classifyAnswerType(researchQuery);
    classifiedAnswerType = answerType;
    if (answerType === 'computable') {
      // BP137 Yoke v2b Stage A: process.env.WOLFRAM_APP_ID is INDEPENDENT of
      // config.specialistKeys.wolframApiKey -- the Stage 0 audit confirmed index.ts's MC
      // benchmark responder (index.ts:6168-6180) never populates specialistKeys at all, so that
      // field is always {} on this path regardless of this flag. Verified ABSENT in this dev
      // environment (no WOLFRAM_APP_ID set) -- see compute_sidecar.ts header.
      // BP137 Stage A.2: ollamaBaseUrl + model are the SAME local peer/model already destructured
      // from config above (line 326) for the specialist swarm/voters -- no new model dependency.
      // BP137 Stage A.3: componentFacts is componentFactsList above -- may be empty (Stage-A.2
      // behavior, question-only) when the swarm found nothing relevant for this question.
      const computed = await computeAnswer(researchQuery, {
        wolframAppId: process.env.WOLFRAM_APP_ID,
        ollamaBaseUrl,
        model,
        componentFacts: componentFactsList,
      });
      if (computed) {
        const mcOptions = parseOptionsFromPrompt(mcPromptWithSubstrate);
        const matched = matchValueToOption(computed.value, mcOptions);
        if (matched) {
          onProgress?.(`compute-sidecar:${computed.method}`);
          const computedLatencyMs = Date.now() - startMs;
          const computedConcordance: ConcordanceClass = 'CONCORDANT';
          const computedBmv = computeBmvScore(1, 1, 1, 0, computedConcordance, 1, computedLatencyMs);
          const computeReceipt: ProvenanceReceipt = {
            source: `computed:${computed.method}`,
            contentHash: createHash('sha256').update(`${computed.expression}=${computed.value}`).digest('hex').slice(0, 16),
            verified: true,
          };
          const traceSummary =
            `researchArmComputeSidecar=true answerType=computable method=${computed.method} ` +
            `expr="${computed.expression}" value=${computed.value} matchedOption=${matched.letter}(${matched.optionValue}) ` +
            `componentFactsUsed=${componentFactsList.length} bmv=${computedBmv} andonRetries=${andonRetry}` +
            `${relevanceGateMethodTrace}`;
          // BP137 Stage A.3: the swarm ABOVE this block already ran (unlike Stage A/A.2, where
          // compute pre-empted it entirely) -- these are the REAL specialist/candidate counts for
          // this question, not hardcoded zeros, so the receipt honestly reflects that the swarm
          // fired even though its facts ended up feeding the compute step rather than a vote.
          return {
            questionId,
            domain,
            chosenLetter: matched.letter,
            voterLetters: [matched.letter, matched.letter, matched.letter],
            voterDiagnostics: [{
              temperature: 0,
              status: 'parsed_ok',
              responseChars: computed.expression.length,
              rawPreview: `computed via ${computed.method}: ${computed.expression} = ${computed.value}`,
            }],
            concordance: computedConcordance,
            bmvScore: computedBmv,
            // BP137 Stage A.3 correction: evaluateGates' 1st param is candidatesPostFurnace
            // (see canonical_pipeline.ts:354-355's G1_FACT gate), not candidatesRaw -- Stage
            // A/A.2 passed a literal 1 here (no real furnace stage existed on the pre-swarm
            // compute-only path); now that the swarm has genuinely run, postFurnace.length is
            // the honest real value, consistent with the normal swarm+voter path's own call
            // to evaluateGates(postFurnace.length, ...) further below.
            gateOutcomes: evaluateGates(postFurnace.length, computedBmv, computedConcordance, computedLatencyMs),
            specialistsUsed,
            candidatesRaw,
            candidatesPostMiner: postMiner.length,
            candidatesPostFurnace: postFurnace.length,
            andonTriggered: andonRetry > 0,
            andonRetries: andonRetry,
            ebletsWritten: 0,
            latencyMs: computedLatencyMs,
            traceSummary,
            provenanceReceipts: [computeReceipt],
            answerType,
            computeSidecar: {
              method: computed.method,
              expression: computed.expression,
              value: computed.value,
              matchedOptionValue: matched.optionValue,
            },
          };
        }
      }
      // Cannot compute, or computed value matched no option within tolerance -- fall through
      // to the unchanged swarm+voter path below (relevance-gate abstain check, then voters).
      // Never guess.
    }

    // ── BP137 Yoke v2b Integration-1 (Stage C wiring): lookup_fact -> browser authority ──────
    // Gated on browserAuthorityOn (== researchArmMode && researchArmBrowserAuthority, both
    // default false/absent) AND answerType === 'lookup_fact' -- unreachable for every caller
    // that predates this Integration-1 pass, and mutually exclusive with the computable branch
    // above (a question is classified exactly one of computable/lookup_fact/reasoning). Reuses
    // Stage A.3's positioning choice (after the swarm already ran, before the fallthrough-
    // abstain checks below) for consistency with the computable branch, not a new architectural
    // decision -- see this block's own trade-off note below.
    if (browserAuthorityOn && answerType === 'lookup_fact') {
      onProgress?.('browser-authority-lookup');
      // REAL bridge (not createNotWiredBridge()): reaches index.ts's
      // runBrowserAuthorityQueryFromMain() via a dynamic import. Dynamic (not static) because
      // index.ts already dynamically imports THIS module (see index.ts's plow-enabled branch,
      // `await import('./plow/plow_mc_answerer')`) -- a static top-level import in this
      // direction would be a circular require. This only ever executes mid-request, well after
      // index.ts's own module-level code has finished running, so Node's require cache returns
      // the fully-initialized module every time -- safe, and the only place in this file that
      // needs this pattern.
      const bridge: BrowserAuthorityBridge = {
        async runQueryInUserBrowser(query) {
          try {
            const mainModule = await import('../index');
            return await mainModule.runBrowserAuthorityQueryFromMain(query);
          } catch (err) {
            console.warn('[plow_mc_answerer] browser-authority bridge call failed (non-fatal, honest null):', err);
            return null;
          }
        },
      };
      let lookupResult: BrowserAuthorityLookupResult | null = null;
      try {
        lookupResult = await runBrowserAuthorityLookup(researchQuery, config, bridge);
      } catch (err) {
        console.warn('[plow_mc_answerer] runBrowserAuthorityLookup threw (non-fatal, falling through to swarm):', err);
        lookupResult = null;
      }
      if (lookupResult) {
        const mcOptions = parseOptionsFromPrompt(mcPromptWithSubstrate);
        const matched = matchFreeTextAnswerToOption(lookupResult.fact, mcOptions);
        if (matched) {
          onProgress?.(`browser-authority-matched:${lookupResult.authority}`);
          const browserLatencyMs = Date.now() - startMs;
          const browserConcordance: ConcordanceClass = 'CONCORDANT';
          const browserBmv = computeBmvScore(1, 1, 1, 0, browserConcordance, 1, browserLatencyMs);
          const browserReceipt: ProvenanceReceipt = {
            source: `browser_authority:${lookupResult.authority}`,
            contentHash: createHash('sha256').update(lookupResult.fact).digest('hex').slice(0, 16),
            verified: lookupResult.verified,
            provenanceUrl: lookupResult.sourceUrl,
          };
          const traceSummary =
            `researchArmBrowserAuthority=true answerType=lookup_fact authority=${lookupResult.authority} ` +
            `sourceUrl=${lookupResult.sourceUrl} matchedOption=${matched.letter}(score=${matched.score.toFixed(2)}) ` +
            `bmv=${browserBmv} andonRetries=${andonRetry}${relevanceGateMethodTrace}`;
          // Same honest-swarm-counts rationale as the compute-sidecar receipt above: the swarm
          // ran unconditionally before this block, so specialistsUsed/candidatesRaw/etc. are the
          // REAL counts for this question, even though its facts went unused on this return path.
          return {
            questionId,
            domain,
            chosenLetter: matched.letter,
            voterLetters: [matched.letter, matched.letter, matched.letter],
            voterDiagnostics: [{
              temperature: 0,
              status: 'parsed_ok',
              responseChars: lookupResult.fact.length,
              rawPreview: `browser authority (${lookupResult.authority}): ${lookupResult.fact.slice(0, 200)}`,
            }],
            concordance: browserConcordance,
            bmvScore: browserBmv,
            gateOutcomes: evaluateGates(postFurnace.length, browserBmv, browserConcordance, browserLatencyMs),
            specialistsUsed,
            candidatesRaw,
            candidatesPostMiner: postMiner.length,
            candidatesPostFurnace: postFurnace.length,
            andonTriggered: andonRetry > 0,
            andonRetries: andonRetry,
            ebletsWritten: 0,
            latencyMs: browserLatencyMs,
            traceSummary,
            provenanceReceipts: [browserReceipt],
            answerType,
          };
        }
      }
      // Bridge unavailable (no hearth window / not on the browser tab / extraction failed) or no
      // option matched within tolerance -- fall through to the unchanged swarm+voter path below.
      // Never guess.
    }
  }

  // ── Extra requirement (Stage D, Bishop/Founder verbal refinement this session): compute-
  //    fallthrough-no-facts abstain ──────────────────────────────────────────────────────────
  // Gated on computeSidecarOn (== researchArmMode && researchArmComputeSidecar, already
  // established above) && classifiedAnswerType === 'computable' -- both false/undefined for
  // every caller that predates this Yoke, so this whole block is unreachable and this function
  // stays byte-for-byte unchanged for the default (researchArmMode false) path. Deliberately
  // checked BEFORE the pre-existing relevanceGateOn abstain below (not after) so it takes
  // precedence for a computable question with zero facts REGARDLESS of whether that emptiness
  // came from the relevance gate or a pure swarm-miss -- exactly the "regardless of ... cause"
  // wording in the extra requirement. A computable question whose relevance gate zeroed out
  // its facts therefore now reports computeFallthroughAbstain (this block), not
  // relevanceGateAbstain (the next block) -- the two markers are mutually exclusive by
  // construction, never both true on the same result.
  const computeFallthroughNoFacts =
    computeSidecarOn && classifiedAnswerType === 'computable' && factsForArbitration.length === 0;
  if (computeFallthroughNoFacts) {
    const fallthroughLatencyMsForGates = Date.now() - startMs;
    const fallthroughGateOutcomes = evaluateGates(postFurnace.length, 0, 'DISCORDANT', fallthroughLatencyMsForGates);
    // D.2/D.3: attempt ONE widened retry first (researchArmEscalation-gated) -- returns null
    // immediately (zero side effects) when researchArmEscalation is off/absent, so the
    // honest-abstain return below is reached unchanged for that (default) case.
    const escalationResult = await attemptEscalationWidenAndRetry({
      config, mcPromptWithSubstrate, researchQuery, writeEbletFn, onProgress, andonRetry,
      effectiveOperators, effectiveBackupOperators, gateOutcomes: fallthroughGateOutcomes,
      candidatesRaw, postMinerLen: postMiner.length, postFurnaceLen: postFurnace.length,
      plusCandidates: [], // factsForArbitration is empty by this block's own trigger condition
      minusCandidates: factsForArbitrationUnfiltered,
      triggerReason: 'compute_fallthrough_no_facts',
    });
    if (escalationResult) return escalationResult;

    onProgress?.('compute-fallthrough-abstain');
    const abstainLatencyMs = Date.now() - startMs;
    const abstainConcordance: ConcordanceClass = 'DISCORDANT';
    const fallthroughTraceSummary =
      `specialists=[${specialistsUsed.join(',')}] raw=${candidatesRaw} postMiner=${postMiner.length} ` +
      `postFurnace=${postFurnace.length} computeFallthroughAbstain=true answerType=computable ` +
      `(compute sidecar attempted, no verified value or no matching option; 0 facts available ` +
      `for the voters -- swarm-miss or relevance-filtered, never guessing blind) ` +
      `andonRetries=${andonRetry}${relevanceGateMethodTrace}`;
    return {
      questionId,
      domain,
      chosenLetter: null,
      voterLetters: [],
      voterDiagnostics: [],
      concordance: abstainConcordance,
      bmvScore: 0,
      gateOutcomes: evaluateGates(postFurnace.length, 0, abstainConcordance, abstainLatencyMs),
      specialistsUsed,
      candidatesRaw,
      candidatesPostMiner: postMiner.length,
      candidatesPostFurnace: postFurnace.length,
      andonTriggered: andonRetry > 0,
      andonRetries: andonRetry,
      ebletsWritten: 0,
      latencyMs: abstainLatencyMs,
      traceSummary: fallthroughTraceSummary,
      provenanceReceipts: [],
      answerType: classifiedAnswerType,
      computeFallthroughAbstain: true,
    };
  }

  // Abstain (per the Yoke's explicit "abstain if nothing relevant" requirement) only when the
  // swarm DID return candidates but NONE passed the relevance check -- feeding the voters a
  // fact block that is confidently wrong is worse than the pre-existing zero-candidates case
  // (bare prompt, no injected "sources" to mislead them), which is left alone here since that is
  // not a relevance failure, it is a swarm-miss (Stage D's escalation territory, not this stage).
  if (relevanceGateOn && factsForArbitrationUnfiltered.length > 0 && factsForArbitration.length === 0) {
    // BP137 Yoke v2b Stage D.2: attempt ONE widened retry first (researchArmEscalation-gated),
    // mirroring the compute-fallthrough-abstain block above -- returns null immediately (zero
    // side effects) when researchArmEscalation is off/absent, so every existing abstain-
    // semantics caller (flag off) reaches the unchanged return below exactly as before.
    const relevanceAbstainGateOutcomes = evaluateGates(postFurnace.length, 0, 'DISCORDANT', Date.now() - startMs);
    const escalationResult = await attemptEscalationWidenAndRetry({
      config, mcPromptWithSubstrate, researchQuery, writeEbletFn, onProgress, andonRetry,
      effectiveOperators, effectiveBackupOperators, gateOutcomes: relevanceAbstainGateOutcomes,
      candidatesRaw, postMinerLen: postMiner.length, postFurnaceLen: postFurnace.length,
      plusCandidates: [], // factsForArbitration is empty by this block's own trigger condition
      minusCandidates: factsForArbitrationUnfiltered,
      triggerReason: 'relevance_gate_abstain',
    });
    if (escalationResult) return escalationResult;

    onProgress?.('relevance-gate-abstain');
    const abstainLatencyMs = Date.now() - startMs;
    const abstainConcordance: ConcordanceClass = 'DISCORDANT';
    const abstainTraceSummary =
      `specialists=[${specialistsUsed.join(',')}] raw=${candidatesRaw} postMiner=${postMiner.length} ` +
      `postFurnace=${postFurnace.length} relevanceGateAbstain=true ` +
      `(0/${factsForArbitrationUnfiltered.length} candidates passed relevance check against researchQuery) ` +
      `andonRetries=${andonRetry}${relevanceGateMethodTrace}`;
    return {
      questionId,
      domain,
      chosenLetter: null,
      voterLetters: [],
      voterDiagnostics: [],
      concordance: abstainConcordance,
      bmvScore: 0,
      gateOutcomes: evaluateGates(postFurnace.length, 0, abstainConcordance, abstainLatencyMs),
      specialistsUsed,
      candidatesRaw,
      candidatesPostMiner: postMiner.length,
      candidatesPostFurnace: postFurnace.length,
      andonTriggered: andonRetry > 0,
      andonRetries: andonRetry,
      ebletsWritten: 0,
      latencyMs: abstainLatencyMs,
      traceSummary: abstainTraceSummary,
      provenanceReceipts: [],
      ...(classifiedAnswerType ? { answerType: classifiedAnswerType } : {}),
      relevanceGateAbstain: true,
    };
  }
  // BP137 Stage A.3: reuses componentFactsList (defined above, before the compute attempt) --
  // same array, same formatting, never recomputed/diverged. Byte-identical value to before this
  // Yoke for every call (the map/slice logic itself is unchanged, just hoisted one block up).
  const factsContext = componentFactsList.join('\n\n');
  // BP137 Honest-MMLU-Provenance Yoke, Step 2: receipts for the EXACT facts the voters were
  // shown above (same .slice(0,3) of the same array) -- verified=true only when this slice
  // came from postFurnace (survived runSaladin's adversarial fence); false when it fell back
  // to unchallenged postMiner candidates (still independently-sourced, just not adversarially
  // verified). Empty when factsForArbitration is empty (no usable swarm hit for this question).
  const arbitrationFactsVerified = postFurnace.length > 0;
  const provenanceReceipts: ProvenanceReceipt[] = factsForArbitration.slice(0, 3).map((c) => ({
    source: c.source,
    contentHash: createHash('sha256').update(c.content).digest('hex').slice(0, 16),
    verified: arbitrationFactsVerified,
    ...(c.provenance_url ? { provenanceUrl: c.provenance_url } : {}),
  }));
  const arbitrationPrompt = buildMcArbitrationPrompt(factsContext, mcPromptWithSubstrate);
  const debugPromptLoggingEnabled = process.env.MNEMO_DEBUG_LOG_PROMPTS === '1';

  // BP133 Yoke #27 Task 27.1: SEQUENTIAL, not Promise.all. Root cause confirmed by Bishop's
  // read of the first live A/C/B run's plow_trace: 3 CONCURRENT gemma4:12b generations on a
  // single 6GB-VRAM GPU produced voter_letters:[null,null,null] on every question (specialists
  // upstream already stagger sequentially via FIREGUARD_STAGGER_MS; this was the one stage that
  // did not). One gemma4:12b call at a time is exactly what the single-shot WAN path already
  // proves works on this hardware -- so the 3 voters now run one after another, same as that
  // proven path, just 3 times at different temperatures.
  // BP135 Yoke #34 Phase (0.9.6): opt-in reasoning-mode voter prompt/budget/parse. When
  // reasoningMode is false (the default for every caller that predates this Yoke), voterPrompt
  // === arbitrationPrompt, numPredictForVoter === 256, and letter parsing uses the original
  // parseLetterLocal() -- byte-identical to pre-0.9.6 behavior, per the Yoke's explicit
  // requirement that the default path must be unchanged.
  const voterPrompt = reasoningMode ? buildReasoningVoterPrompt(arbitrationPrompt, choiceCount) : arbitrationPrompt;
  const numPredictForVoter = reasoningMode ? MC_VOTER_NUM_PREDICT_REASONING : MC_VOTER_NUM_PREDICT_DEFAULT;

  const voterLetters: (string | null)[] = [];
  const voterDiagnostics: VoterDiagnostic[] = [];
  for (const temp of MC_VOTER_TEMPERATURES) {
    const raw = await callOllama(voterPrompt, ollamaBaseUrl, model, temp, numPredictForVoter);
    if (raw === null || raw.trim().length === 0) {
      voterLetters.push(null);
      voterDiagnostics.push({
        temperature: temp,
        status: 'empty_response',
        responseChars: raw?.length ?? 0,
        rawPreview: raw ?? '',
        ...(debugPromptLoggingEnabled ? { rawResponse: raw ?? '' } : {}),
        ...(reasoningMode ? { reasoning: raw ?? '' } : {}),
      });
      continue;
    }
    const letter = reasoningMode ? parseLetterFromReasoning(raw, choiceCount) : parseLetterLocal(raw, choiceCount);
    voterLetters.push(letter);
    voterDiagnostics.push({
      temperature: temp,
      status: letter !== null ? 'parsed_ok' : 'parse_failed',
      responseChars: raw.length,
      rawPreview: raw.slice(0, 200),
      ...(debugPromptLoggingEnabled ? { rawResponse: raw } : {}),
      ...(reasoningMode ? { reasoning: raw } : {}),
    });
  }
  const { concordance, chosenLetter } = computeLetterConcordance(voterLetters);
  onProgress?.('three-fates-mc-done');
  if (debugPromptLoggingEnabled) {
    console.log(
      `[plow_mc_answerer] arbitration prompt (${arbitrationPrompt.length} chars): ${arbitrationPrompt}`,
    );
  }

  // ── BP137 Yoke v2b Stage D.1: Psionic post-hoc concur/discord marker (informational ONLY) ──
  // Computed strictly AFTER concordance/chosenLetter above are already finalized -- this block
  // reads them, never writes them, matching the Yoke's explicit "Psionic ACCELERATES agreement,
  // it NEVER overrides/outvotes a model's own discordant result" doctrine (psionic_predictor.ts
  // :352 and this file's own D.1 header). Unreachable (both stay undefined) whenever psionicOn
  // is false or Psionic produced no matched-option prediction -- see psionicPrediction/
  // psionicMatchedLetter's own declarations above.
  let psionicConcurred: boolean | undefined;
  let psionicDiscorded: boolean | undefined;
  if (psionicOn && psionicPrediction && psionicMatchedLetter && chosenLetter) {
    if (psionicMatchedLetter === chosenLetter) psionicConcurred = true;
    else psionicDiscorded = true;
  }

  // ── Gates + BMV (same formula as the free-text pipeline for apples-to-apples receipts) ──
  const latencyMs = Date.now() - startMs;
  const bmvScore = computeBmvScore(
    candidatesRaw, postMiner.length, postFurnace.length,
    postFurnace.length, concordance, specialistsUsed.length, latencyMs,
  );
  const gateOutcomes = evaluateGates(postFurnace.length, bmvScore, concordance, latencyMs);
  // BP133 Yoke #27 Task 27.2: G4_LAT is recorded (still visible in gateOutcomes/the receipt,
  // still contributes to the free-text pipeline's shared evaluateGates() output verbatim) but
  // is advisory-only HERE -- it never by itself triggers an Andon retry. The plow legitimately
  // takes ~150-220s per question; retrying widened-operators solely because a question was
  // slow would only make it slower with zero accuracy benefit, and a correct-but-slow answer
  // must not be treated as a failure to fix. Note: G4_LAT was never the actual cause of
  // abstention (chosenLetter comes only from voter concordance, not from gates) -- this change
  // only stops it from wastefully triggering Andon widening on an otherwise-healthy pass.
  const anyGateFailedExcludingLatency = gateOutcomes.some((g) => g.gate !== 'G4_LAT' && !g.passed);

  // ── Andon retry (Condition C only). Condition A/B pass andonEnabled=false and take
  //    whatever this single pass produced, win, lose, or abstain -- per Task 2.2's Truth-
  //    Always requirement, a loss here must be returned honestly, not silently retried away
  //    under conditions the Founder asked to measure as single-pass. ─────────────────────
  if (anyGateFailedExcludingLatency && andonEnabled && andonRetry < MAX_ANDON_RETRIES) {
    const report = runDetectiveTeam(gateOutcomes, candidatesRaw, postMiner.length, postFurnace.length, effectiveOperators);
    onProgress?.(`andon-trigger:${andonRetry + 1}`);
    if (report.wideningApplied && report.additionalOperators.length > 0) {
      return runCanonicalPlowMcAnswer(
        mcPromptWithSubstrate, researchQuery, config, writeEbletFn, onProgress,
        andonRetry + 1, report.additionalOperators,
      );
    }
    onProgress?.('andon-exhausted');
  }

  // ── BP137 Yoke v2b Stage D.2: escalation trigger INDEPENDENT of Condition C ───────────────
  // OPT-IN via researchArmMode && researchArmEscalation, fully independent of andonEnabled
  // (Condition C) -- this is a SEPARATE `if`, evaluated regardless of whether the Condition-C
  // block above fired (and if it DID recurse, this line is never reached at all for this stack
  // frame, since that block already returned). Does not read, set, or otherwise touch
  // config.andonEnabled anywhere -- Condition C's own trigger condition/meaning above is
  // completely untouched by this addition, per the Yoke's explicit constraint. Fires on
  // `concordance === 'DISCORDANT'` specifically (the Yoke's literal "the outcome is
  // DISCORDANT" trigger (a)) -- this also covers trigger (c) ("a compute-fallthrough occurred
  // ... and that fallthrough then also failed to produce a confident answer"): a compute-
  // fallthrough that proceeded to the voters (factsForArbitration was non-empty, so it did not
  // hit the compute-fallthrough-no-facts abstain above) and then landed DISCORDANT satisfies
  // this same check, with classifiedAnswerType==='computable' still visible on the receipt.
  if (concordance === 'DISCORDANT' && config.researchArmMode && config.researchArmEscalation && andonRetry < MAX_ANDON_RETRIES) {
    // D.4 PLUS/MINUS for this round: PLUS = facts actually shown to the voters (survived
    // Saladin + the relevance gate, even though the vote itself came back discordant) --
    // referential membership check against factsForArbitration (same CandidateEblet object
    // instances throughout this function, never cloned, so `!==` reference comparison below is
    // reliable). MINUS = postMiner survivors that never reached the voters (Saladin-rejected,
    // or relevance-gate-rejected).
    const factsForArbitrationSet = new Set(factsForArbitration);
    const minusForDiscordant = postMiner.filter((c) => !factsForArbitrationSet.has(c));
    const escalationResult = await attemptEscalationWidenAndRetry({
      config, mcPromptWithSubstrate, researchQuery, writeEbletFn, onProgress, andonRetry,
      effectiveOperators, effectiveBackupOperators, gateOutcomes,
      candidatesRaw, postMinerLen: postMiner.length, postFurnaceLen: postFurnace.length,
      plusCandidates: factsForArbitration,
      minusCandidates: minusForDiscordant,
      triggerReason: 'discordant',
    });
    if (escalationResult) return escalationResult;
  }

  // ── BP137 Yoke v2b Stage E: distributed Star Chamber, fired ONLY on Stage D's FINAL
  //    don't-know ─────────────────────────────────────────────────────────────────────────────
  // Reached only when concordance is STILL 'DISCORDANT' after the Stage D.2 block directly
  // above -- which means one of: (a) researchArmEscalation/researchArmMode was off (Stage D
  // never attempted), (b) andonRetry had already exhausted MAX_ANDON_RETRIES (Stage D's own
  // exhaustion guard, so its `if` above never entered), or (c) Stage D DID attempt widening via
  // attemptEscalationWidenAndRetry and it returned null (genuinely nothing left to widen with --
  // "escalation-exhausted", see that function). In every one of those cases this is Stage D's
  // FINAL don't-know for this call stack -- never a confident answer (concordance would not be
  // 'DISCORDANT' otherwise) and never a race against Stage D (this line is only reached AFTER
  // Stage D's own block above has already run to completion or been skipped by its own guard).
  // AND-gated on config.researchArmMode && config.researchArmStarChamber (both default
  // false/absent) -- when either is false, this entire block is unreachable, provable by the
  // single guard below; chosenLetter/concordance/every other field stays exactly what Stage
  // A-D already finalized, byte-for-byte identical to pre-Stage-E behavior.
  //
  // Deliberately NEVER overrides chosenLetter/concordance (the graded MC answer) -- this block
  // is a transparent, additive receipt of what independent multi-authority adjudication found,
  // never a silent re-grading of the benchmark answer. See CanonicalPlowMcResult.starChamber's
  // own doc comment for why: forcing a prose fact from Google/Perplexity onto one of this
  // question's A-J options without a verified numeric/exact match would itself be a fabrication
  // risk the honesty firewall is built to prevent.
  let starChamberReceipt: CanonicalPlowMcResult['starChamber'];
  if (concordance === 'DISCORDANT' && config.researchArmMode && config.researchArmStarChamber) {
    onProgress?.('star-chamber-fire');
    try {
      const factsForArbitrationSet = new Set(factsForArbitration);
      const minusForStarChamber = postMiner.filter((c) => !factsForArbitrationSet.has(c));
      const dispatchId = `${questionId}:sc:${Date.now()}`;
      const fireOutcome = await runStageEDistributedStarChamber({
        dispatchId,
        domain,
        question: researchQuery,
        plusEblets: factsForArbitration.map((c) => c.content),
        minusEblets: minusForStarChamber.map((c) => c.content),
        andonThreshold: MAX_ANDON_RETRIES,
        ollamaBaseUrl,
        model,
        wolframAppId: process.env.WOLFRAM_APP_ID,
      });
      starChamberReceipt = {
        peerAuthorities: fireOutcome.peerAuthorities,
        answeredAuthorities: fireOutcome.answered.map((a) => a.authority),
        consensusReached: fireOutcome.consensusReached,
        hScore: fireOutcome.hScore,
        confidenceVariance: fireOutcome.variance,
        starChamberAnswer: fireOutcome.answer,
        disagreementSummary: fireOutcome.disagreementSummary,
        meshFireRecorded: fireOutcome.meshFire.ok,
        ...(fireOutcome.meshFire.id ? { meshFireId: fireOutcome.meshFire.id } : {}),
      };
      onProgress?.(
        fireOutcome.consensusReached ? 'star-chamber-consensus' : 'star-chamber-disagreement',
      );
      console.log(
        `[plow_mc_answerer] Stage E star-chamber dispatch=${dispatchId} ` +
        `authorities=[${fireOutcome.peerAuthorities.join(',')}] ` +
        `consensus=${fireOutcome.consensusReached} hScore=${fireOutcome.hScore.toFixed(2)} ` +
        `meshFireRecorded=${fireOutcome.meshFire.ok} simulated=${fireOutcome.meshFire.simulated}`,
      );
    } catch (err) {
      // Truth-Always: a Stage E crash must never silently swallow the abstain -- log and leave
      // starChamberReceipt undefined (absent from the receipt), never fabricate a partial result.
      console.error('[plow_mc_answerer] Stage E star-chamber dispatch error (non-fatal, honest omission):', err);
    }
  }

  // ── Scribe — write surviving facts to substrate (knowledge growth side-effect; this is
  //    externally-researched FACT content, never the MC answer/letter itself, so it carries
  //    none of Task 1's answer-key-cache risk regardless of substrate on/off for this run) ──
  // BP135 Yoke #34 (0.9.7) argument-ledger: reasoning is the FULL voter working captured by
  // 0.9.6 reasoning-mode (joined across voters when more than one produced text), NEVER a bare
  // answer-key letter -- this is the METHOD/derivation, per the Yoke's explicit requirement.
  // verdict compares the plow's OWN chosenLetter (already finalized above, by voters that never
  // saw testModeCorrectAnswerLetter) against that local ground truth ONLY when one was supplied
  // -- production Asks (no ground truth) always write 'unverified'.
  const reasoningForLedger = reasoningMode
    ? voterDiagnostics.map((v) => v.reasoning).filter((r): r is string => !!r).join('\n---\n') || undefined
    : undefined;
  const verdictForLedger: 'correct' | 'wrong' | 'unverified' =
    testModeCorrectAnswerLetter && chosenLetter
      ? (chosenLetter.toUpperCase() === testModeCorrectAnswerLetter.toUpperCase() ? 'correct' : 'wrong')
      : 'unverified';
  const { ebletsWritten } = await runScribe(
    domain, researchQuery, questionId, postFurnace, bmvScore, concordance, gateOutcomes,
    andonRetry > 0, andonRetry, writeEbletFn,
    {
      reasoning: reasoningForLedger,
      verdict: verdictForLedger,
      confidence: computeArgumentConfidence(bmvScore, concordance),
    },
  );

  const psionicMarkerTrace = psionicConcurred ? ' psionicConcurred=true' : psionicDiscorded ? ' psionicDiscorded=true' : '';
  const traceSummary =
    `specialists=[${specialistsUsed.join(',')}] raw=${candidatesRaw} postMiner=${postMiner.length} ` +
    `postFurnace=${postFurnace.length} voters=[${voterLetters.map((l) => l ?? '-').join(',')}] ` +
    `voterStatus=[${voterDiagnostics.map((v) => v.status).join(',')}] ` +
    `concordance=${concordance} bmv=${bmvScore} andonRetries=${andonRetry} latencyGateAdvisoryOnly=true` +
    `${relevanceGateMethodTrace}${psionicMarkerTrace}`;

  return {
    questionId,
    domain,
    chosenLetter,
    voterLetters,
    voterDiagnostics,
    concordance,
    bmvScore,
    gateOutcomes,
    specialistsUsed,
    candidatesRaw,
    candidatesPostMiner: postMiner.length,
    candidatesPostFurnace: postFurnace.length,
    andonTriggered: andonRetry > 0,
    andonRetries: andonRetry,
    ebletsWritten,
    latencyMs: Date.now() - startMs,
    traceSummary,
    provenanceReceipts,
    ...(classifiedAnswerType ? { answerType: classifiedAnswerType } : {}),
    ...(psionicConcurred ? { psionicConcurred } : {}),
    ...(psionicDiscorded ? { psionicDiscorded } : {}),
    ...(starChamberReceipt ? { starChamber: starChamberReceipt } : {}),
  };
}
