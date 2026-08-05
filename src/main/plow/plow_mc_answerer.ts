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
import { SPECIALIST_REGISTRY, isAuthorityEnabled, readAuthorityEnableOverridesFromSettings } from './specialist_adapters';
// BP139 browser-LLM authorities (ChatGPT/Gemini/Claude): PREMIUM, default-OFF, opt-in-only
// second opinions -- see specialist_adapters.ts's own "Browser-LLM PREMIUM authorities" section
// header for why these are a small parallel type family rather than SpecialistName entries.
import {
  type BrowserLlmAuthorityName,
  BROWSER_LLM_AUTHORITY_METADATA,
  isBrowserLlmAuthorityEnabled,
  readBrowserLlmAuthorityEnableOverridesFromSettings,
} from './specialist_adapters';
// BP139 Concordance Gate: user-tunable acceptance bar for a lone (uncorroborated) authority
// candidate on NO-COMPUTE questions -- see specialist_adapters.ts's own "BP139 Concordance Gate"
// section header, and resolveConcordanceAcceptance below, for the full design/honesty rationale.
import { type ConcordanceStrictness, readConcordanceStrictnessFromSettings } from './specialist_adapters';
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
import { isQaRelevant, writeVerifiedEblet, queryVerifiedEblets, computeHonestVerification, loadAllVerifiedEblets } from '../mnem_eblet_store';
// BP141 (this Yoke): mints a reusable FORMULA/TOOL eblet (class:'component') from a deterministic-
// compute success -- a NEW, independent write alongside the existing writeComputeMethodEblet()
// below, not a replacement for it. See formula_eblet_mint.ts's header for the full leak-safety
// argument (it reads ONLY `.method` off the compute result, never the question/expression/value).
import { mintFormulaEbletFromCompute } from './formula_eblet_mint';
// BP137 Yoke v2b Stage A: answer-type classifier + compute sidecar, both new/additive this Yoke.
import { classifyAnswerType, type AnswerType } from './answer_type_classifier';
import { computeAnswer, computeViaWolframOnly, parseOptionsFromPrompt, matchValueToOption, extractNumber, computeUnitAwareMatch, type ComputeSidecarResult, type McOption, type UnitAwareComputeResult } from './compute_sidecar';
// BP-SCHEDULE-SOLVER: a THIRD, independent deterministic compute tier -- see that file's header
// for the full rationale -- tried only after computeAnswer()/computeUnitAwareMatch() have both
// already returned null/no-match (see the call site inside `if (answerType === 'computable')`
// below). Never duplicates or modifies those two tiers.
import { solveScheduleProblem } from './plow_mc_schedule_solver';
import { solveDensityProblem } from './plow_mc_density_solver';
// BP-PHYSICS-SOLVER: a FIFTH, independent deterministic compute tier -- see that file's header
// for the full rationale (the double-star Kepler's-third-law benchmark miss) -- tried only after
// tiers (i)-(iv) have already returned null. Never duplicates or modifies those four tiers.
import { solvePhysicsRelationProblem } from './plow_mc_physics_solver';
// BP-PSEUDOCODE-TRACE-SOLVER: a SEVENTH, independent deterministic compute tier -- see that file's
// header for the full rationale (the AP-CSP "which code segment produces this output" question
// class, decided today by a vote+adjudicator that picked the wrong letter live) -- tried only after
// tiers (i)-(vi) have already returned null. Never duplicates or modifies those six tiers.
import { solvePseudocodeTraceProblem } from './plow_mc_pseudocode_trace_solver';
// BP141-2 Task B ("Disagreement as Evidence"): a NINTH independent deterministic compute tier --
// see that file's header for the full rationale and gate. Unlike every tier above, it does not
// derive from questionText+options alone -- it also requires the ensemble's own INDEPENDENT
// candidate scatter (IndependentSourceVote[], derivation-path-tagged via resolveCakeDerivationPath
// below), since the whole point is recognizing that genuine cross-derivation-path disagreement IS
// the evidence for a question's own "there is no single/specific answer" option.
import { solveNoConsensusFromScatter, type IndependentSourceVote } from './plow_mc_no_consensus_solver';
// BP-AIRCRAFT-SOLVER: a SIXTH, independent deterministic compute tier -- see that file's header
// for the full rationale (the airplane lift/drag/takeoff-power benchmark wobble) -- tried only
// after tiers (i)-(v) have already returned null. Never duplicates or modifies those five tiers.
import { solveAircraftLiftDragProblem } from './plow_mc_aircraft_solver';
// BP141-1: an EIGHTH, independent deterministic compute tier -- see that file's header for the
// full rationale (run 029, question_id 98: "which world region is NOT considered one of the
// world's most densely populated regions?") -- tried only after tiers (i)-(vii) have already
// returned null. Never duplicates or modifies those seven tiers. GroundedFactEblet imported
// alongside it: the caller (this file) is the one place that reads the live substrate and filters
// to genuinely Fact-typed entries -- the solver itself never touches the filesystem.
import { solveSetMembershipProblem, type GroundedFactEblet } from './plow_mc_set_membership_solver';
// KN-BP141-3 Stage 0 + Stage 1 wiring: question vetting (V1/V2/V3) and the semantic elimination
// chart (R1/R2/R3) both run BEFORE any solver tier below, purely on questionText+options, no I/O,
// no model call. Neither ever changes a letter -- vetQuestion emits advisory flags only, and
// runEliminationChart's own R1/R2/R3 were all measured (per this ticket's own MANDATORY
// false-negative-rate discipline, see scratchpad/commit_msg_bp141_3_stage1.txt) at false-negative
// rates far over the ~2% threshold (R1 33.333%, R2 17.647%, R3 0.000% but N=1, statistically
// insignificant) -- so none of the three rules is wired here as a hard eliminator. Both are
// attached to resolveDeterministicComputeOverride's own return value as `advisorySignals`
// (additive field, every pre-existing caller that destructures only finalLetter/overrideFired/
// deterministicOverride is byte-for-byte unaffected) for a future receipt/weighting consumer,
// never used inside this file to decide or override `deterministicOverride`/`finalLetter` itself.
import { vetQuestion, type QuestionVettingFlags } from './plow_mc_question_vetting';
import { runEliminationChart, type EliminationChartResult } from './plow_mc_elimination_chart';
// KN-BP141-7 P6 (Founder-directed BP141): wires KN-BP141-3 Stage 2 (plow_mc_elimination_cascade.ts,
// C4 bidirectional consistency) and Stage 3 (plow_gom_jabbar.ts, G5 tally-with-strike) into the
// live answerer for the FIRST time -- see runEliminationCascadeCandidateProducer's own doc comment
// (below, near runCakeMethodDisagreementResolution) for the honest scope of what could and could
// not be wired this pass, and this file's own KN-BP141-7 P6 header note for the full rationale.
import { checkBidirectionalConsistency, type BidirectionalConsistencyResult } from './plow_mc_elimination_cascade';
import { tallyVotesStrikingFailures, type GomJabbarVote } from './plow_gom_jabbar';
// KN-BP141-10 (Founder-directed BP141): "Wire the Elimination Cascade as the format-independent
// fallback." A TENTH independent deterministic compute tier inside resolveDeterministicComputeOverride
// -- see runEliminationCascadeFormatIndependentFallback's own doc comment (below, just above that
// tier's call site) for the full mechanism. Unlike KN-BP141-7 P6's cascade wiring (a Cake Method
// CANDIDATE only, reached solely when authorities already disagree), this tier is a genuine
// FALLBACK -- reached whenever every named parsing solver above it in resolveDeterministicComputeOverride
// has already returned null, regardless of whether any authority ensemble ever ran at all.
// evaluateFormatIndependentFallbackGate/extractNumericOptionValues/extractLetterRankingSequence/
// CascadeSourceCapture/buildCascadeSourceCapture are all NEW exports added to
// plow_mc_elimination_cascade.ts this ticket (additive only -- C1-C5's own pre-existing exports are
// unmodified). runSympyArithmetic (plow_gom_jabbar.ts G2) is reused here, never re-implemented, per
// this ticket's own C6 ("arithmetic is ours, always"). getRawBrowserAuthorityFact
// (browser_authority_adapter.ts) is reused for this ticket's own C7 (mandatory source capture) --
// see that call site's own comment for the honest scope of when it can and cannot fire.
import {
  evaluateFormatIndependentFallbackGate,
  extractLetterRankingSequence,
  buildCascadeSourceCapture,
  evaluateSignificantFigureAccept,
  buildInverseQueryFraming,
  type CascadeSourceCapture,
} from './plow_mc_elimination_cascade';
// KN-BP144-4 ("Constraint Beats Preference"): the register-resolution stage (KN-BP144-2 Phase 2,
// Founder's Excerpt 7 steps 2-6) is CALLED here for the first time -- it was previously buildable
// but never wired to anything, per that ticket's own commit message. Never edited (A5 refusal) --
// this file only ever calls it, with whatever caller-supplied verification lookup it can (or
// cannot) actually obtain. See the eliminator's own call site (below, inside the
// cascadeAdjudicatorEngaged block) for the full A1-A4 wiring.
import {
  runRegisterResolutionStage,
  type RegisterResolutionStageResult,
  type RegisterVerificationLookup,
} from './plow_mc_elimination_cascade';
import { runSympyArithmetic } from './plow_gom_jabbar';
import { getRawBrowserAuthorityFact } from './browser_authority_adapter';
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
  runBrowserAuthorityLookupObserved,
  type BrowserAuthorityBridge,
  type BrowserAuthorityLookupResult,
  type BrowserAuthorityRawExtraction,
} from './browser_authority_adapter';
// KN-BP144-7 T1-T4 ("Make The Silent Authorities Loud"): the closed attempt-outcome vocabulary
// + its default/normalize helpers, imported directly from the shared vocabulary module (never
// duplicated) -- see that file's own "KN-BP144-7" banner for the full rationale. PURELY
// ADDITIVE: nothing imported here is read by any answering/scoring/elimination decision in this
// file; it only feeds the new authorityOutcomes bookkeeping threaded through
// runAuthorityEnsemble/runCanonicalPlowMcAnswer below.
import {
  createDefaultAuthorityAttemptOutcomes,
  normalizeAuthorityAttemptOutcomes,
  truncateAuthorityPreview,
  type BrowserAuthorityAttemptOutcomes,
  type BrowserAuthorityAttemptRecord,
  type BrowserAuthorityDispatchOutcome,
} from '../../shared/plow/browser_authority_types';
// BP137 Yoke v2b Stage E: the distributed Star Chamber fan-out, fired ONLY at the single call
// site below (Stage D's final don't-know) -- see star_chamber_dispatch.ts's own header for the
// full wiring rationale (genuinely independent Google/Perplexity/Wolfram authorities, never
// model-voting) and minor_star_chamber.ts's header for why that previously-orphaned file's
// adjudication core (not its model-council path) is the real handler underneath this call.
import { runStageEDistributedStarChamber } from './star_chamber_dispatch';
// KN-BP144-1 Phase 2 (Amendment 1): the ONE place tier classification / the ROOTED predicate
// live (BP142, Founder-ratified) -- reused verbatim for the candidate-source cascade
// adjudicator's rule 2 ("proven beats concordant"), never a second, independently-drifting
// tier classifier. See runCandidateSourceCascadeAdjudicator's own doc comment for the exact,
// narrow way a per-candidate authority tag is mapped onto classifyCorroborationTier's existing
// corroboration-string input contract.
import { isRooted, classifyCorroborationTier } from '../rooting_rule';

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
   *  so this config object can be passed there directly with no adapter/mapping layer.
   *
   *  BP137 Yoke v2b Stage F2 (this Yoke): Integration-1 above called the browser authority
   *  AFTER the specialist swarm had already fired, and only for ONE authority
   *  (config.preferredAuthority ?? 'user_google'), then short-circuited past the voters
   *  entirely on a match. Stage F2 moves the call earlier (before the swarm's first fetch,
   *  see "Stage F2: browser-authority-FIRST routing" near the top of
   *  runCanonicalPlowMcAnswer), queries BOTH user_google AND user_perplexity sequentially, and
   *  -- on a match -- injects the result(s) as the TOP-priority fact(s) ahead of the (demoted,
   *  never dropped) encyclopedia facts, feeding them into the SAME existing MC voter pipeline
   *  instead of bypassing it (see "Stage F2 build item 2" injection block, right after the
   *  relevance gate). This flag's semantics (AND-gated with researchArmMode, unreachable/
   *  byte-unchanged when false) are otherwise unchanged. */
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
  /** BP137 Yoke v2b Stage F3 (mesh synergy), OPT-IN/DEFAULT FALSE, independent AND-gate on top
   *  of researchArmMode (both must be true) -- same convention as every other researchArm*
   *  sub-flag above. Makes the MESH itself synergistic: instead of every live peer redundantly
   *  running the identical full plow on the same question, the ASKER (one_click_mmlu_pro.ts /
   *  wan_dispatch.ts's dispatch loop) assigns each live peer a DIFFERENT authority-role for the
   *  same question (round-robin: user_google / user_perplexity / swarm) and pools the answers
   *  via adjudicateDistributedAuthorities (dr_m_orchestrator/minor_star_chamber.ts, promoted
   *  from Star-Chamber-only use to this normal cross-peer path too -- see wan_dispatch.ts's
   *  dispatchQuestionToWanPeers). When either researchArmMode or this flag is false/absent
   *  (every caller that predates Stage F3, including every existing wan_dispatch.ts payload),
   *  meshSynergyOn below is false and the one call site it gates is unreachable -- this
   *  function's chosenLetter/concordance/every other field stays byte-for-byte identical to
   *  pre-Stage-F3 behavior, provable by that single guard. */
  researchArmMeshSynergy?: boolean;
  /** BP137 Yoke v2b Stage F3, OPTIONAL/ADDITIVE. Present only when the asker's mesh-synergy
   *  dispatch loop assigned THIS peer a specific authority-role for THIS question (see
   *  wan_dispatch.ts's round-robin assignment, fed in via index.ts's responder-side
   *  `payload.assigned_authority` read). 'user_google' / 'user_perplexity' route this call
   *  through ONLY that one browser-authority lookup (see the meshSynergyOn block below) --
   *  the 9-specialist swarm/voters/Andon/Escalation/Star-Chamber machinery never runs for that
   *  call, so this peer contributes ONLY its assigned slice, per the Founder's "each peer
   *  contributes only its assigned slice" mesh-synergy directive. 'swarm' (or absent) means
   *  "run the existing full swarm+voter pipeline exactly as today" -- byte-identical to every
   *  pre-Stage-F3 caller. Never present on the wire payload at all when researchArmMeshSynergy
   *  is off (see wan_dispatch.ts's conditional-spread convention, matching every other
   *  opt-in-only payload field in that file), so an old/mesh-synergy-unaware peer never even
   *  sees this field. */
  assignedAuthority?: 'user_google' | 'user_perplexity' | 'swarm';
  /** BP138 Yoke Phase 2, OPT-IN/DEFAULT FALSE. Enables the Decompose-and-Eliminate engine
   *  (plow_mc_decompose.ts) BEFORE the full swarm runs. The engine breaks the question into
   *  per-option FOUNDATION FACTS, verifies each via browser authority, and eliminates options
   *  whose foundation fact is falsified by a real source. 1 survivor = deterministic answer.
   *  >1 survivors = Tactic 1 tie-break. 0 survivors / authority-empty = honest ABSTAIN and
   *  fall-through to the existing plow (never guess). researchArmMode AND researchArmDecompose
   *  must BOTH be true; when either is off the engine is unreachable and this function's
   *  behavior is byte-for-byte identical to pre-Phase-2. */
  researchArmDecompose?: boolean;
  /** BP139 Authority Ensemble, OPT-IN/DEFAULT FALSE, independent AND-gate on top of
   *  researchArmMode AND researchArmBrowserAuthority (all three must be true, matching the
   *  convention every researchArm* sub-flag uses above). Founder mandate: "if ANY free authority
   *  can find the answer, we find it" -- replaces Stage F2's old "Perplexity is queried with MC
   *  options, Google only gets a bare lookup and its result is never used to pick a letter"
   *  behavior with a genuine ensemble: BOTH Perplexity and Google are queried WITH the MC
   *  options embedded (see BrowserAuthorityQuery.embedOptionsForGoogle), and -- for computable
   *  questions -- Wolfram Alpha joins too when WOLFRAM_APP_ID is set (skipped silently
   *  otherwise). Two or more authorities agreeing on a letter = 'agree' (highest confidence,
   *  accepted immediately). Exactly one authority answering = 'single_<authority>' (accepted).
   *  Authorities disagreeing = 'disagree' -> ONE extra Perplexity ADJUDICATION call (question +
   *  options + every candidate letter/reasoning, asked to state which is correct) ->
   *  'adjudicated' on a resolved judge letter. No authority answering, or a disagreement the
   *  judge also can't resolve = 'none' -- honest fall-through (see researchArmDecompose above:
   *  decompose-and-eliminate becomes a FALLBACK, attempted only after this ensemble produced no
   *  sourced letter, for computable/reasoning questions -- see deferDecomposeToEnsembleFallback
   *  at this flag's one call site). When researchArmMode, researchArmBrowserAuthority, or this
   *  flag is false/absent (every caller that predates this Yoke), authorityEnsembleOn is false
   *  and Stage F2 runs its EXACT pre-existing "Perplexity preferred, Google bookkeeping-only"
   *  logic unchanged -- provable by the single `authorityEnsembleOn` guard at Stage F2's one
   *  branch point below. Never a paid API call: every authority here is the user's own free
   *  signed-in browser session (Google/Perplexity) or a free-tier Wolfram key, matching the
   *  Founder's "cheaper" requirement -- the one extra adjudication call fires ONLY on disagreement. */
  researchArmAuthorityEnsemble?: boolean;
  /** BP139 Concordance Gate, OPT-IN/DEFAULT UNDEFINED (treated as 'lenient'). Founder canon
   *  ("I want to tune it"): runAuthorityEnsemble's single-candidate accept path (the
   *  `candidates.length === 1` branch) currently accepts ANY lone authority/swarm answer
   *  outright for a NO-COMPUTE (answerType !== 'computable') question, with zero corroboration
   *  -- the Founder's identified root cause of the bias/CSS/geography misses (one uncorroborated
   *  source answered, and its letter was trusted without a second opinion). This field lets a
   *  caller/user require real corroboration before that lone answer is accepted:
   *    - undefined/'lenient' (DEFAULT): byte-identical to pre-gate behavior -- a single accepted
   *      candidate is accepted, exactly as today. Explicit hard requirement: NO regression.
   *    - 'require_two': a lone candidate on a NO-COMPUTE question is REJECTED (honest abstain,
   *      falls through to the existing 'none'/disagree handling) unless >=2 candidates agree.
   *    - 'require_majority': a lone candidate is REJECTED unless a strict majority of the
   *      candidates that returned a letter agree (see resolveConcordanceAcceptance below for the
   *      exact pure decision, including why a single respondent can never satisfy either
   *      stricter mode -- there is nothing to have a majority OF with just one voice).
   *  NEVER applied to a deterministic-compute result: resolveConcordanceAcceptance always
   *  returns true when answerType === 'computable', so the density/units-aware compute override
   *  (resolveDeterministicComputeOverride, fired by this function's caller immediately after the
   *  ensemble returns) keeps its unconditional chance to win the math regardless of strictness --
   *  this gate only ever touches the AUTHORITY-ensemble's acceptance of CONCEPTUAL answers.
   *  Explicit config value wins; when absent, runAuthorityEnsemble falls back to
   *  readConcordanceStrictnessFromSettings() (ai_dispatch_settings.json's `concordance_strictness`
   *  key, same settings-read-hook convention as researchArmAuthorityEnsemble's sibling browser-LLM
   *  overrides above), so a caller that never sets this field still gets the user's live app
   *  setting, and a caller that DOES set it (e.g. a unit test, or a mesh-test benchmark that must
   *  pin behavior regardless of the local machine's settings file) is never overridden by it. */
  concordanceStrictness?: ConcordanceStrictness;
  /** BP138 Yoke Phase 3, OPTIONAL/ADDITIVE. Present only when the WAN-mesh asker dispatched
   *  this question in option-fan-out mode and assigned THIS peer one specific answer option
   *  to verify (e.g. 'C'). When set AND researchArmOptionFanOut is true, this peer verifies
   *  ONLY that option's foundation fact and returns an option_verdict receipt -- the full
   *  swarm/voter pipeline does NOT run. Absent/undefined = normal full-plow behavior. */
  assignedOption?: string;
  /** BP138 Yoke Phase 3 flag, OPT-IN/DEFAULT FALSE. AND-gated with researchArmMode. Enables
   *  the option-fan-out mesh mode: when assignedOption is present and this flag is true, this
   *  peer verifies only its assigned option instead of answering the full question. */
  researchArmOptionFanOut?: boolean;
  /** PRODUCTION eblet read-back, NEW/OPT-IN, DEFAULT FALSE/UNDEFINED. Canon (Founder-ratified):
   *  recall is the PRODUCTION reward -- once a question has been genuinely, honestly verified,
   *  a later ask of the EXACT SAME question should not re-burn the swarm/voters/Andon/Escalation
   *  machinery. Independent of every researchArm* sub-flag above (no AND-gate on
   *  researchArmMode) -- this is its own standalone opt-in, checked ONCE at the very top of
   *  runCanonicalPlowMcAnswer, before Stage F3/Psionic/F2/ensemble/swarm ever run.
   *
   *  HARD-OFF ON THE SCORED PATH: callCanonicalPlowMcAnswererForMeshTest -- the ONE call site
   *  shared by every scored/benchmark run (index.ts's WAN relay-poll responder AND
   *  one_click_mmlu_pro.ts's local-mode benchmark) -- builds its CanonicalPlowMcConfig from
   *  named literal fields only and explicitly passes `productionReadbackEnabled: false`.
   *  PlowMcAnswererCallParams (that function's own params interface) does not expose this field
   *  at all, so no caller reaching runCanonicalPlowMcAnswer through that helper can ever set it
   *  true, structurally -- not just by convention. A direct caller of this function that bypasses
   *  that helper still defaults to false/absent/undefined, matching every other opt-in flag's
   *  fail-closed convention in this file. Canon: scoring must always RE-DERIVE, never replay the
   *  answer key.
   *
   *  SAFETY: a stored eblet's cosmetic `verified` field is NEVER trusted alone when deciding
   *  whether to recall it -- the live substrate carries legacy rows stamped verified:true from
   *  before the BP131 honesty fix (including lone single_authority/user_perplexity guesses).
   *  The read-back path re-derives verification at READ time via the SAME computeHonestVerification()
   *  the write path uses (mnem_eblet_store.ts) -- deterministic_compute / genuine 2+-source
   *  concordant / coroner_verified only; everything else (including "no corroboration field at
   *  all", the legacy-row shape) fails CLOSED and is never recalled. */
  productionReadbackEnabled?: boolean;
  /** KN-BP144-7 T1-T3, OPTIONAL/ADDITIVE, never read by any answering/scoring logic in this
   *  file. When a caller supplies this object, runCanonicalPlowMcAnswer mutates it IN PLACE
   *  (never reassigns it) as the Authority Ensemble genuinely reaches each of the five browser
   *  authorities plus the swarm, so the caller can read the SAME object reference after
   *  awaiting the call and attach it to a receipt. Absent/undefined (every pre-KN-BP144-7
   *  caller): a fresh all-'not_attempted' map is created internally and simply discarded --
   *  byte-identical behavior, zero new work, for every caller that does not opt in. */
  authorityOutcomesSink?: BrowserAuthorityAttemptOutcomes;
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
  /** KN-BP141-7 P5 (Founder-directed BP141, regression fix), OPTIONAL/ADDITIVE. True only when
   *  this answer came from decompose-and-eliminate (plow_mc_decompose.ts), which this ticket
   *  demotes to advisory-only -- concordance is forced to 'PARTIAL' (never 'CONCORDANT') and no
   *  substrate write-back occurs, regardless of decompose's own reported `basis`. See
   *  attemptDecomposeAndEliminate's own call-site comment for the full rationale (three live
   *  receipts showing elimination destroying correct answers; no measured false-negative rate
   *  exists against the ~2% bar other solvers were held to). Absent (not false) on every answer
   *  that did not come from decompose. */
  decomposeAdvisoryDemoted?: boolean;
  /** KN-BP142-2 Defect A (Founder-directed BP142), OPTIONAL/ADDITIVE. True only when this exact
   *  answer is decompose's advisory candidate AND it reached the caller through the function's
   *  final-fallthrough last-resort path -- meaning every other tier (Psionic, browser authority,
   *  authority ensemble, swarm+voters) ran its full course and reached its own natural end with
   *  chosenLetter still null. Absent (not false) on every other answer, including every decompose
   *  answer from BEFORE this fix that would have been returned directly (that early-return path
   *  no longer exists -- see attemptDecomposeAndEliminate's two call sites' own comments). This
   *  field is the receipt-level proof that "advisory" now structurally means "cannot preempt a
   *  real decision, only fill a genuine total absence of one" -- never present alongside a
   *  chosenLetter any other stage actually produced. */
  decomposeAdvisoryUsedAsLastResort?: boolean;
  /** BP137 Yoke v2b Stage A, OPTIONAL/ADDITIVE. Present only when researchArmMode &&
   *  researchArmComputeSidecar were both true for this call (absent -- not false -- on every
   *  pre-Stage-A call and on every call with the flag off, so old receipts and this new field
   *  never collide). */
  answerType?: AnswerType;
  /** BP137 Yoke v2b Stage A, OPTIONAL/ADDITIVE. Present only when the compute sidecar actually
   *  produced a verified value AND it matched an MC option (i.e. only on the early-return
   *  compute path below). Absent whenever the question fell through to the swarm+voter path,
   *  whether because it was not classified computable, or because compute/option-match failed. */
  computeSidecar?: {
    // BP-COMPUTE-UNITS / BP-COMPUTE-BARE: widened to admit UnitAwareComputeResult's own method
    // tags ('unit_expression' | 'unit_reasoning_extraction' | 'bare_value_match') alongside the
    // pre-existing ComputeSidecarResult tags -- additive union, every pre-existing writer/reader
    // of this field (which only ever produced the original three tags) is unaffected. Because
    // this field's type is derived directly from UnitAwareComputeResult['method'], adding
    // 'bare_value_match' to that union type (compute_sidecar.ts) required no edit here.
    // BP-SCHEDULE-SOLVER: 'schedule_amortization' added as a third, independent additive tag --
    // see plow_mc_schedule_solver.ts's ScheduleSolverResult.provenance
    // ('deterministic_compute:schedule_amortization') for the full string this short tag is
    // extracted from at the call site below.
    method: ComputeSidecarResult['method'] | UnitAwareComputeResult['method'] | 'schedule_amortization';
    expression: string;
    value: number;
    matchedOptionValue: number;
  };
  /** BP137 Yoke v2b Stage A.0, OPTIONAL/ADDITIVE. True only when researchArmRelevanceGate fired
   *  an abstain (swarm found candidates, none passed isQaRelevant). Absent otherwise. */
  relevanceGateAbstain?: boolean;
  /** BP137 Yoke v2b Stage F2, OPTIONAL/ADDITIVE. Present only when the early browser-authority-
   *  first block actually attempted a lookup for this question (classified 'lookup_fact' AND
   *  browserAuthorityOn) -- absent otherwise, so old receipts and this new field never collide.
   *  'agree'/'disagree' only when BOTH Google and Perplexity returned a matched fact; 'single_*'
   *  when exactly one did; 'none' when both returned null (honest not-signed-in/no-answer, see
   *  build item 4) or neither matched an MC option. Never a fabricated blended verdict -- see
   *  this file's Stage F2 injection block for why disagreement is left to the existing
   *  concordance/DISCORDANT machinery rather than merged here (legacy, non-ensemble path only).
   *  BP139 Authority Ensemble additions: 'single_wolfram' (Wolfram Alpha was the sole authority
   *  to answer, computable questions only) and 'adjudicated' (2+ authorities disagreed, the
   *  one-extra-Perplexity-call judge resolved it) -- both ONLY reachable when
   *  researchArmAuthorityEnsemble is on, see that flag's own doc comment for the full ensemble
   *  design. 'agree' under the ensemble means 2+ (not necessarily both) authorities concurred. */
  browserAuthorityCorroboration?:
    | 'agree'
    | 'disagree'
    | 'single_google'
    | 'single_perplexity'
    | 'single_wolfram'
    | 'single_specialist_swarm'
    | 'adjudicated'
    | 'none'
    // BP139 browser-LLM authorities (ChatGPT/Gemini/Claude): same "exactly one real candidate
    // total" label convention as single_wolfram/single_google above. Only reachable when the
    // corresponding authority is explicitly enabled (default off, see BROWSER_LLM_AUTHORITY_METADATA).
    | 'single_chatgpt'
    | 'single_gemini'
    | 'single_claude'
    // BP139 Concordance Gate: mirrors AuthorityEnsembleOutcome['corroboration']'s own
    // 'lone_rejected_by_strictness' addition -- only reachable when researchArmAuthorityEnsemble
    // is on AND concordanceStrictness is 'require_two'/'require_majority' AND exactly one
    // candidate answered a NO-COMPUTE question. See CanonicalPlowMcConfig.concordanceStrictness
    // and resolveConcordanceAcceptance for the full design.
    | 'lone_rejected_by_strictness'
    // BP1xx DETERMINISTIC-OVERRIDE-HOIST: mirrors AuthorityEnsembleOutcome['corroboration']'s own
    // 'deterministic_compute_override' addition -- the calculator answered before any authority
    // agreement was even evaluated. See runAuthorityEnsemble's pre-branch check.
    | 'deterministic_compute_override'
    // BP140 PSEUDOCODE-TRACE-ANSWER-TYPE-BYPASS: mirrors AuthorityEnsembleOutcome['corroboration']'s
    // own 'deterministic_compute' member. Set when a named solver PROVED the answer from the
    // question's own text before any authority was consulted -- specifically the pseudocode-trace
    // solver, which must run regardless of classifyAnswerType's verdict (a code-trace question
    // carries no numbers, so the classifier labels it 'reasoning' and would otherwise skip the
    // entire deterministic chain -- the silent-gate defect documented in the BP140 borrowed-
    // authority canon). Distinct from 'deterministic_compute_override' above, which is the
    // computable-path hoist.
    | 'deterministic_compute';
  /** BP1xx Authority-Ensemble-swarm-fold-in, OPTIONAL/ADDITIVE. Present only when
   *  researchArmAuthorityEnsemble was on for this call. True when the browser/Wolfram authority
   *  panel was NOT already a confident 2+ agreement and the specialist swarm (Miner -> Furnace
   *  -> 3-voters) fired as an extra corroborating candidate; false when 2+ browser/Wolfram
   *  authorities agreed immediately and the swarm never fired (the cheap fast path). Lets the
   *  Founder verify from the receipt alone that the swarm stayed skipped on agreement and fired
   *  only on the uncertain branch. */
  authorityEnsembleSwarmFired?: boolean;
  /** BP1xx STRUCTURED-CORROBORATOR GATE, OPTIONAL/ADDITIVE. Mirrors
   *  AuthorityEnsembleOutcome.structuredCorroborator -- see that field's own doc comment for the
   *  full Q85 rationale and the STRUCTURED/LLM-class/AMBIGUOUS authority classification. Present
   *  ONLY when this call's accepted answer came from an ensemble 'agree' verdict (present, not
   *  merely truthy, so `false` here is a real, meaningful "LLM-only concordance, de-confidence
   *  this" signal rather than absence). true = the accepted agreeing group had a non-LLM
   *  structured member (wolfram_alpha or a genuinely CONCORDANT specialist_swarm). false = every
   *  agreeing candidate was LLM-class (user_perplexity/user_google/user_chatgpt/user_gemini/
   *  user_claude) and the specialist swarm, fired specifically to try to corroborate it, either
   *  disagreed (in which case the accept never happens -- adjudication runs instead) or yielded
   *  nothing usable. Never causes an abstain by itself -- coverage is protected; this only ever
   *  de-confidences an accept that still happens. Absent on every other corroboration value
   *  (single_*, adjudicated, deterministic_compute_override, none, disagree,
   *  lone_rejected_by_strictness) and on every pre-this-Yoke call. */
  structuredCorroborator?: boolean;
  /** BP141 INDEPENDENCE-AWARE CORROBORATION FLAG, OPTIONAL/ADDITIVE. Mirrors
   *  AuthorityEnsembleOutcome.independentCorroboration -- see that field's own doc comment for
   *  the full rationale. Present only alongside an ensemble 'agree' accept (same presence gate as
   *  structuredCorroborator above); additive signal only, never changes chosenLetter/concordance/
   *  gateOutcomes/any accept-reject decision. */
  independentCorroboration?: boolean;
  /** BP141-1 SINGLE-SOURCE-NO-GROUNDING GATE, OPTIONAL/ADDITIVE. Mirrors
   *  AuthorityEnsembleOutcome.singleSourceUngroundedAccept -- see that field's own doc comment for
   *  the full run-029/question_id-98 rationale. Present only alongside a lone-candidate accept
   *  (single_google/single_perplexity/single_wolfram/single_chatgpt/single_gemini/single_claude/
   *  single_specialist_swarm), same "present, not merely truthy" convention as
   *  structuredCorroborator above so `false` here is a real, meaningful "this one voice DID have
   *  some grounding" signal rather than plain absence. Never changes chosenLetter/concordance/
   *  gateOutcomes/any accept-reject decision -- de-confidences visibly, never silently. */
  singleSourceUngroundedAccept?: boolean;
  /** BP141-2 THE CAKE METHOD -- mirrors AuthorityEnsembleOutcome's own field of the same name, see
   *  that interface's doc comment for the full rationale. Present only alongside a Cake-method run
   *  (the ensemble's authorities disagreed even with the swarm folded in). */
  cakeMethodUsed?: boolean;
  cutModels?: string[];
  cutDerivations?: string[];
  distinctDerivationCount?: number;
  cutScatter?: number;
  pickConvergence?: number;
  cakeQuadrant?: string;
  anonymizedOrderSeed?: number;
  cakeSelfPreferenceAudit?: {
    pickerKey: string;
    derivationPath: string;
    ownLetter: string | null;
    pickedOwnLetterWithSelfPresent: boolean | null;
    pickedSameLetterWithSelfAbsent: boolean | null;
    cutLetter: string | null;
    chosenLetter: string | null;
    judgeWasDisputant: boolean;
  }[];
  /** KN-BP141-7 P3 -- mirrors AuthorityEnsembleOutcome.cakeSelfPreferenceRate, see that field's
   *  own doc comment for the full rationale. */
  cakeSelfPreferenceRate?: number | null;
  cakeCuts?: { pickerKey: string; derivationPath: string; letter: string }[];
  cakePicks?: { pickerKey: string; derivationPath: string; pickedLetter: string | null }[];
  /** KN-BP141-7 P2 -- mirrors AuthorityEnsembleOutcome.minorityCutsOverridden, see that field's
   *  own doc comment for the full rationale. */
  minorityCutsOverridden?: { letter: string; derivationPath: string }[];
  /** KN-BP141-7 P1 -- mirrors AuthorityEnsembleOutcome.cakePickerCutterInvariant, see that field's
   *  own doc comment for the full rationale. */
  cakePickerCutterInvariant?: {
    cutterRoots: string[];
    pickerRoots: string[];
    cuttersWithNoPick: string[];
    pickersWithNoCut: string[];
  };
  /** KN-BP141-7 P6 -- mirrors AuthorityEnsembleOutcome.cascadeCandidateProducer, see that field's
   *  own doc comment for the full rationale. */
  cascadeCandidateProducer?: {
    attempted: boolean;
    consistent: boolean;
    mostToLeast: string[];
    leastToMost: string[];
    candidateAddedToCutPool: boolean;
    trace: string;
  };
  /** KN-BP141-7 P6 -- mirrors AuthorityEnsembleOutcome.gomJabbarG5Advisory, see that field's own
   *  doc comment for the full rationale. `applied` is always false; G5 stays disabled this pass. */
  gomJabbarG5Advisory?: {
    applied: false;
    wouldStrike: boolean;
    strickenSources: string[];
    admissibleSources: string[];
    tally: Record<string, number>;
    trace: string;
  };
  /** BP140 Yoke (Eblet-Learning Substrate / Liana Cycle), OPTIONAL/ADDITIVE. The full ensemble
   *  candidate set (winner AND every losing candidate), carried through so the Coroner -- the
   *  only place ground truth is actually available -- can persist a factVerdict-tagged eblet for
   *  EVERY candidate, not just the accepted letter. See answer_coroner.ts's deriveFactVerdict()/
   *  persistEnsembleCandidateFactVerdicts(). Present only on the authorityEnsembleOn accepted-
   *  candidate return path (mirrors authorityEnsembleSwarmFired's own presence gate); absent on
   *  every other return path (legacy non-ensemble browser-authority accept, mesh-synergy,
   *  decompose, swarm-only) and on every pre-BP140 receipt. */
  ensembleCandidates?: AuthorityEnsembleCandidate[];
  /** KN-BP144-7 T1-T4 ("Make The Silent Authorities Loud"), OPTIONAL/ADDITIVE. Present on the
   *  SAME return sites as ensembleCandidates immediately above (the ensemble genuinely ran),
   *  using the exact same outer-scope-capture convention (authorityOutcomesForTrace, set once
   *  right after runAuthorityEnsemble returns, read at every return site below). Absent on every
   *  return path where the ensemble never ran (flag off, legacy branch, mesh-synergy, decompose,
   *  every pre-KN-BP144-7 receipt) -- callCanonicalPlowMcAnswererForMeshTest normalizes this via
   *  normalizeAuthorityAttemptOutcomes() before attaching it to a receipt's plowTrace, so T3's "no
   *  key omitted anywhere" gate holds even when this field itself is absent here. */
  authorityOutcomes?: BrowserAuthorityAttemptOutcomes;
  /** KN-BP144-1 Phase 1 ("the letter does not come from where we thought"), OPTIONAL, CLOSED
   *  VOCABULARY, NO FREE TEXT. Answers "which code path actually produced chosenLetter", set AT
   *  the assignment site itself (never re-derived after the fact from other fields -- doing so
   *  would rebuild the exact defect this field exists to close: a receipt reader could not tell
   *  qid 66/72/79/85/105's local 3-temp self-vote fall-through from a genuine authority-ensemble
   *  accept, which is precisely how BP143 misattributed that fall-through's failures to
   *  specialist_swarm for a full day).
   *
   *  'deterministic_compute_override' -- a calculator proved the letter, not a vote: covers BOTH
   *    call sites of resolveDeterministicComputeOverride (the pre-branch hoist inside
   *    runAuthorityEnsemble, and the post-accept override in this function), AND
   *    runAuthorityEnsemble's own unconditional-on-answerType calculator bypasses (pseudocode_trace/
   *    set_membership/no_consensus_from_scatter, corroboration:'deterministic_compute') -- these are
   *    the SAME "the calculator answered, not a vote" bucket even though only the former is
   *    literally resolveDeterministicComputeOverride; see KN-BP144-1_REPORT.md for this
   *    interpretive choice. Also used for the legacy (pre-ensemble) Stage A.3 compute-sidecar
   *    tiers (computeUnitAwareMatch/computeAnswer/solveScheduleProblem called directly, not
   *    through resolveDeterministicComputeOverride) -- same rationale, flagged likewise.
   *  'ensemble_accept' -- runAuthorityEnsemble returned a truthy chosenLetter via a genuine
   *    authority-agreement path: 'agree', any 'single_*' lone accept, or
   *    'lone_rejected_by_strictness' never reaching this (that is a null-chosenLetter path).
   *  'cake_adjudicated' -- runCakeMethodDisagreementResolution converged on a plurality pick
   *    (ensembleOutcome.corroboration === 'adjudicated').
   *  'voter_concordance_fallthrough' -- the ensemble fell through with no letter (or never ran),
   *    and computeLetterConcordance(voterLetters) on the line-7286 local 3-temperature self-vote
   *    produced a non-null chosenLetter. THIS is the mechanism KN-BP144-1 Phase 1 exists to make
   *    legible. As of Phase 2 (Amendment 1), this value can no longer be produced for a question
   *    that reaches the candidate-source cascade adjudicator (corroboration==='disagree' with
   *    non-empty candidates) -- that question now either resolves as
   *    'cascade_adjudicated_unconstrained'/'cascade_adjudicated_constrained' or abstains before
   *    the self-vote ever runs. Still reachable for every other fall-through shape (corroboration
   *    'none'/'lone_rejected_by_strictness', or the ensemble never ran at all), unchanged.
   *  'cascade_adjudicated_unconstrained' -- KN-BP144-4: the candidate-SOURCE cascade adjudicator
   *    (runCandidateSourceCascadeAdjudicator) ran and exactly one letter survived its own
   *    elimination rules, AND the KN-BP144-4 register-resolution eliminator (see A1/A2 in
   *    KN-BP144-4_CONSTRAINT_BEATS_PREFERENCE.md) either did not apply, or applied and abstained
   *    -- no constraint was in force, so the adjudicator chose exactly as it did before this
   *    ticket (byte-identical to the pre-KN-BP144-4 'cascade_adjudicated' value this replaces).
   *  'cascade_adjudicated_constrained' -- KN-BP144-4: same as above, EXCEPT the eliminator DID
   *    produce a real surviving-option constraint, and it was applied as a filter on the
   *    adjudicator's admissible candidates BEFORE the adjudicator ran (A2) -- the returned letter
   *    is guaranteed to lie within that constraint by construction, never merely by luck.
   *  'abstain_constraint_excluded_all' -- KN-BP144-4 (A3, third bullet): the eliminator produced a
   *    real constraint and it excluded EVERY candidate the adjudicator would otherwise have
   *    considered -- honest ABSTAIN, reached BEFORE runCandidateSourceCascadeAdjudicator is even
   *    called, and never falling back to the local self-vote. Distinct from 'abstain' below (that
   *    is the adjudicator's OWN rule-5 ambiguity on whatever candidates DID survive the
   *    constraint, or the pre-existing no-eliminator case); this tag exists so a reader can tell
   *    "the constraint killed it" apart from "the adjudicator itself couldn't decide".
   *  'abstain' -- no letter, by any mechanism (relevance-gate/compute-fallthrough early abstains,
   *    the cascade adjudicator's own honest ABSTAIN per rule 5 -- whether unconstrained or
   *    operating on an eliminator-narrowed candidate pool -- or the voter loop's own concordance
   *    coming back null).
   *
   *  Deliberately left UNSET (absent) on a small number of legacy/gated-off-by-default paths this
   *  ticket's own 12-question gate set never exercises and that do not map onto this closed
   *  vocabulary without misrepresenting the mechanism: production readback (a cache recall, not a
   *  derivation), mesh-synergy single-authority-slice, the legacy (non-ensemble,
   *  authorityEnsembleOn===false) Stage F2 browser-authority accept, and decompose-and-eliminate's
   *  advisory-last-resort fallback (already flagged by its own decomposeAdvisoryUsedAsLastResort
   *  field). See KN-BP144-1_REPORT.md for the full list and rationale -- never fabricated to force
   *  a value onto a mechanism this vocabulary was not built to describe. */
  letterSource?:
    | 'deterministic_compute_override'
    | 'ensemble_accept'
    | 'cake_adjudicated'
    | 'voter_concordance_fallthrough'
    | 'cascade_adjudicated_unconstrained'
    | 'cascade_adjudicated_constrained'
    | 'abstain_constraint_excluded_all'
    | 'abstain';
  /** KN-BP144-1 Phase 2 (Amendment 1), OPTIONAL/ADDITIVE. Present ONLY when the candidate-source
   *  cascade adjudicator (runCandidateSourceCascadeAdjudicator) actually engaged for this
   *  question (corroboration==='disagree', non-empty ensembleCandidates) -- absent whenever the
   *  adjudicator's placement guard did not hold, so every question outside Phase 2's scope
   *  (including every one of the six negative-control proofs and qid 111) never carries this
   *  field at all. One human-readable line per elimination rule evaluated (rules 1-5, in order,
   *  even when a given rule was a no-op for this candidate set) -- see BP138's "the Founder must
   *  be able to watch this run live, question by question" requirement. */
  cascadeEliminationLog?: string[];
  /** KN-BP144-1 Phase 2 (Amendment 1), OPTIONAL/ADDITIVE. True only when the cascade adjudicator
   *  engaged AND abstained (rule 5: more than one distinct letter survived elimination, or none
   *  did). Mirrors relevanceGateAbstain/computeFallthroughAbstain's own presence convention --
   *  absent (not false) whenever the adjudicator did not engage or engaged and resolved a
   *  letter. letterSource is 'abstain' on this same result, same as every other honest no-letter
   *  outcome -- this field exists only to distinguish WHICH abstain mechanism fired, for the
   *  Founder's own live per-question audit. */
  cascadeAdjudicatorAbstain?: boolean;
  /** KN-BP144-4, OPTIONAL/ADDITIVE. Present whenever the cascade-adjudicator guard
   *  (cascadeAdjudicatorEngaged) held, regardless of whether the eliminator actually applied,
   *  abstained, or produced a real constraint -- the full human-readable trace from
   *  runRegisterResolutionStage (register inference, verification check, predicate derivation,
   *  per-option match/fail reasons), never a bare "filtered". See letterSource's own doc comment
   *  for the three-way vocabulary this trace explains. */
  eliminatorTrace?: string[];
  /** KN-BP144-4, OPTIONAL/ADDITIVE. Present ONLY when the eliminator produced a REAL constraint
   *  (applied && !abstained) -- the exact surviving-letter set that was used to filter the
   *  adjudicator's admissible candidates (A2). Absent (not empty-array) whenever no constraint
   *  was in force, so its mere presence already answers "was a constraint active" without
   *  needing to re-derive it from letterSource. */
  eliminatorConstraintSurvivors?: string[];
  /** KN-BP144-1 Phase 1, OPTIONAL/ADDITIVE. Verbatim ensembleOutcome.corroboration, captured
   *  UNCONDITIONALLY the moment the ensemble returns (accept AND every fall-through/disagree
   *  path alike, including 'disagree' itself) -- present ONLY when authorityEnsembleOn was true
   *  for this call, so its mere presence already answers "did the ensemble run at all", which
   *  browserAuthorityCorroboration cannot (that field defaults to the SAME literal 'none' string
   *  AuthorityEnsembleOutcome uses for "the ensemble ran and nobody answered", and is also
   *  overwritten by the LEGACY non-ensemble branch with its own narrower corroboration vocabulary
   *  -- see that field's own doc comment). Absent when authorityEnsembleOn was false/off. */
  ensembleOutcomeCorroboration?: AuthorityEnsembleOutcome['corroboration'];
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
  /** BP137 Yoke v2b Stage F3 (mesh synergy), OPTIONAL/ADDITIVE. Present ONLY when
   *  researchArmMode && researchArmMeshSynergy were both true for this call AND
   *  config.assignedAuthority was set -- absent on every pre-Stage-F3 call and on every call
   *  where the asker did not opt this peer into mesh-synergy dispatch. Truthful per-peer
   *  provenance receipt: 'user_google'/'user_perplexity' means this peer answered from ONLY
   *  that one authority (see the meshSynergyOn short-circuit below); 'swarm' means this peer
   *  ran the ordinary full pipeline (present here purely as an additive receipt annotation --
   *  it does not alter chosenLetter/concordance/gateOutcomes/any pre-existing field in any way,
   *  same non-mutating-receipt doctrine as psionicConcurred/browserAuthorityCorroboration
   *  above). This is what lets the asker's pooled adjudication show "which peer, which
   *  authority" for every contributor, per the Stage F3 truthful-provenance requirement. */
  meshSynergyAssigned?: 'user_google' | 'user_perplexity' | 'swarm';
  /** BP1xx Deterministic-Compute-Override ("let the calculator win the math"), OPTIONAL/
   *  ADDITIVE. Present ONLY when researchArmAuthorityEnsemble was on, the question classified
   *  'computable', the ensemble already accepted/was about to return a letter for it, AND
   *  computeUnitAwareMatch -- run against the accepted candidate's own reasoning text (plus the
   *  swarm's voter previews when it fired) -- found a real, exact-one-option unit-aware match.
   *  chosenLetter above is ALWAYS the deterministic letter in this case (ensembleLetter records
   *  what the ensemble had originally picked, for comparison -- chosenLetter === ensembleLetter
   *  means the compute corroborated the ensemble rather than overriding it; they differ exactly
   *  when a real override happened). Absent whenever the check never fires (not computable,
   *  ensemble had no letter) or computeUnitAwareMatch abstained/found nothing (kept the
   *  ensemble's original letter unchanged). Same honesty gate as the compute-sidecar's own
   *  UnitAwareComputeResult: never a guess, only a checked "exactly one option matches"
   *  computation. See runAuthorityEnsemble's Stage F2 accept-path call site for where this
   *  fires. */
  authorityEnsembleDeterministicOverride?: {
    ensembleLetter: string;
    // BP-DETERMINISTIC-OVERRIDE-3TIER: widened from UnitAwareComputeResult['method'] to `string`
    // -- resolveDeterministicComputeOverride() now reports one of three TIER tags
    // ('unit_aware' | 'bare_value' | 'schedule_amortization'), not just computeUnitAwareMatch's
    // own narrower internal method union, since the override can now also fire via
    // computeAnswer()+matchValueToOption() or solveScheduleProblem(). See
    // DeterministicComputeCandidate (defined just above resolveDeterministicComputeOverride).
    method: string;
    expression: string;
    computedValue: number;
    computedUnit: string | null;
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

/** KN-BP144-9 Phase 2 (BP144, this pass): a strictly higher score floor than
 *  PSIONIC_OPTION_MATCH_MIN_SCORE, applied ONLY when matchFreeTextAnswerToOption falls through to
 *  text-similarity carrying an incidental number the question's own options don't share (see that
 *  function's own doc comment for the full rationale and the qid-111 worked example this bar was
 *  derived from). 0.5 -- "at least half of the option's own distinctive words are echoed back" --
 *  chosen as a materially higher, round, self-justifying bar on its own terms (not fitted to
 *  separate two specific scores), comfortably clearing the genuine match this fallthrough exists
 *  to recover (0.80) while excluding the coincidental one that motivated adding this floor (0.43). */
const PSIONIC_OPTION_MATCH_MIN_SCORE_INCIDENTAL_NUMBER = 0.5;

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

/** KN-BP144-9 Phase 2 (BP144, this pass): whether this question's OWN option set is itself
 *  numeric-shaped -- i.e. at least one option's text contains an extractable number. Gates the
 *  numeric short-circuit in matchFreeTextAnswerToOption immediately below. Computed fresh per
 *  call (options arrays here are small, ~4-10 entries, this is not a hot loop) rather than
 *  cached, to keep this a pure function with no hidden state. */
function optionsContainNumericValue(options: McOption[]): boolean {
  return options.some((opt) => extractNumber(opt.text) !== null);
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
 *
 *  KN-BP144-9 Phase 2 fix (BP144, this pass -- Founder-approved after Phase 0's read-only
 *  investigation): strategy 1's numeric short-circuit is now gated on optionsContainNumericValue
 *  (immediately above) -- it only fires, and only ever returns null on a tolerance miss, when
 *  THIS QUESTION'S OWN OPTIONS are themselves numeric-shaped. Phase 0 found 10 of 32 receipt-041
 *  parse_failed rows were being intercepted by strategy 1 finding an INCIDENTAL number anywhere
 *  in the answer text (a date, a ratio component like "1:2:4", a population figure) on questions
 *  whose options were pure prose with no numbers at all -- the incidental number could never
 *  possibly match any option (none had one to match), so the old code's unconditional early
 *  `return null` was silently discarding the answer before strategy 2 (token-overlap) ever ran,
 *  even when strategy 2 would have cleared both its own thresholds cleanly (hand-verified: qid
 *  111's "Laplace resonance ... 1:2:4 ... keeping Io's orbit slightly elliptical" scores option
 *  I at 0.80, comfortably clearing PSIONIC_OPTION_MATCH_MIN_SCORE and its margin over the
 *  second-place option). This fix does NOT touch, lower, or bypass either threshold -- a
 *  question whose options ARE numeric (qids 27/53/59 in that same receipt) is completely
 *  unaffected, byte-for-byte, since optionsContainNumericValue is true for all of them and
 *  strategy 1 still runs exactly as before, including its own honest null on a genuine tolerance
 *  miss. Never widens a gate; only stops a non-numeric question's answer from being handed to
 *  the wrong strategy.
 */
export function matchFreeTextAnswerToOption(
  answerText: string,
  options: McOption[],
): { letter: string; score: number } | null {
  // KN-BP144-9 Phase 2 (BP144, this pass): tracks whether this call is falling through to the
  // text-similarity strategy carrying an INCIDENTAL number the answer text contained (a number
  // this question's own options don't share -- see optionsContainNumericValue above). A live
  // false-extraction check against the real 041 receipt's rawPreview text (verified against the
  // real compiled dist, not a hand copy) found that this specific fallthrough shape -- an
  // incidental number (a ratio, a date) sitting inside an otherwise weak token-overlap match --
  // can score just high enough to clear the ordinary PSIONIC_OPTION_MATCH_MIN_SCORE floor without
  // the match being genuinely unambiguous (qid 111, user_google, this receipt: scores option C at
  // 0.43 on "...a three-body MMR with a 1:2:4 orbital period ratio... ratio of orbits..." purely
  // because "with"/"the"/"orbits" happen to overlap C's wording -- NOT because the text identifies
  // option C). The SAME text, from user_claude, scores the genuinely correct option I at 0.80 --
  // a real, substantive match, not noise. A single higher floor cannot be tuned to split these two
  // per-question (forbidden -- "never tune to a specific question id"), so instead this fallthrough
  // path carries a strictly higher, uniformly-applied bar than the ordinary prose path: the
  // rationale is general, not row-specific -- an answer that mentions a number belonging to
  // NEITHER this question's options carries a demonstrated tendency (this receipt is the
  // demonstration) to still coincidentally share ordinary connector/topic words with some option,
  // so a merely-adequate overlap score is a weaker signal here than it is for a plain prose answer
  // with no incidental number at all, and must clear a materially higher bar before being treated
  // as unambiguous. This does NOT touch PSIONIC_OPTION_MATCH_MIN_SCORE/_MIN_MARGIN themselves --
  // the ordinary (no-incidental-number) path below is 100% unchanged.
  let requireStricterFloor = false;
  if (optionsContainNumericValue(options)) {
    const numeric = extractNumber(answerText);
    if (numeric !== null) {
      const numericMatch = matchValueToOption(numeric, options);
      if (numericMatch) return { letter: numericMatch.letter, score: 1 };
      // A numeric token was present, THIS QUESTION'S OPTIONS are themselves numeric, but the
      // token matched no option within tolerance -- do NOT fall through to the text-similarity
      // heuristic for this same answer (that would risk a false text-match papering over a real
      // numeric mismatch on a genuinely computable question). Honest null, unchanged from
      // before this pass.
      return null;
    }
  } else if (extractNumber(answerText) !== null) {
    // This question's OWN options are pure prose (no number anywhere), yet the answer text
    // contains a number -- an incidental digit (ratio, date, count) with nothing to match against.
    // Fall through to text-similarity, but only ever accept it under the stricter bar above.
    requireStricterFloor = true;
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
  const scoreFloor = requireStricterFloor
    ? PSIONIC_OPTION_MATCH_MIN_SCORE_INCIDENTAL_NUMBER
    : PSIONIC_OPTION_MATCH_MIN_SCORE;
  if (!top || top.score < scoreFloor) return null;
  if (second && top.score - second.score < PSIONIC_OPTION_MATCH_MIN_MARGIN) return null;
  return { letter: top.letter, score: top.score };
}

// ─── WIRE-THE-LOOP fix (Founder mandate): "authority picks the option" ─────────────────────
//
// THE BUG (DB-confirmed, Founder brief): matchFreeTextAnswerToOption() above is a bare
// token-overlap heuristic between the authority's distilled FACT snippet and each option's OWN
// wording. For a plain Google lookup snippet that never saw the option list, the snippet's
// wording routinely shares near-zero tokens with the option text even when the snippet is the
// correct answer in different words -- matchScore=0.00, matchedOption=none, honest-looking but
// actually a discarded correct answer. Real sourced answers were being thrown away.
//
// THE FIX: buildBrowserAuthorityQueryUrl() (browser_authority_types.ts) now sends Perplexity the
// question WITH its options embedded, asking it to reply "Answer: <letter>" first. This function
// is the extraction half -- an EXPLICIT-LETTER reader, tried BEFORE the token-overlap fallback.
// It only fires on a genuinely stated letter (the vendor's own pick), never a guess: an
// unanchored/ambiguous response returns null, same honest-null contract as
// matchFreeTextAnswerToOption. Google's plain lookup snippets (no options in the query, per
// buildBrowserAuthorityQueryUrl's user_google branch) will almost never contain this pattern by
// chance, so this stays a no-op there -- Google answers keep falling through to the existing
// token-overlap fallback (matchFreeTextAnswerToOption), unchanged.
// KN-BP144-9 Phase 2 (BP144, this pass): exported, along with matchFreeTextAnswerToOption above
// and resolveAuthorityLetterMatch immediately below, SOLELY so a scratchpad verification script
// can import these three from the real compiled dist and replay them against the real 041
// receipt's rawPreview text -- per this ticket's own "verify against the real compiled dist"
// mandate. Phase 0 had to hand-copy-reimplement all three for the same reason and flagged that
// as an honesty gap (a silent divergence between the copy and the real source could not be ruled
// out). No behavior changes from this export -- these three functions' bodies are otherwise
// byte-identical in control flow to before this pass except for the one gated line in
// matchFreeTextAnswerToOption documented on that function itself.
export function extractChosenLetterFromAuthorityText(
  answerText: string,
  options: McOption[],
): { letter: string; score: number } | null {
  const validLetters = new Set(options.map((o) => o.letter.toUpperCase()));
  const patterns: RegExp[] = [
    /\banswer\s*[:\-]?\s*\(?([A-J])\)?\b/i,
    /\bcorrect (?:option|answer|choice) is\s*\(?([A-J])\)?\b/i,
    /^\s*\(?([A-J])\)[\s.:\-]/, // leading "(B) ..." / "B) ..." / "B. ..."
    /\boption\s+\(?([A-J])\)?\s+is (?:correct|right)\b/i,
  ];
  for (const re of patterns) {
    const m = answerText.match(re);
    const letter = m?.[1]?.toUpperCase();
    if (letter && validLetters.has(letter)) {
      return { letter, score: 1 };
    }
  }
  return null;
}

/**
 * Tries the explicit-letter reader first (the authority stating its own pick), falling back to
 * the token-overlap/numeric matcher only when no explicit letter was found -- "fall back to the
 * local matcher only if the authority declines" per the Founder's design. Never returns a match
 * neither function would have honestly returned on its own.
 */
export function resolveAuthorityLetterMatch(
  answerText: string,
  options: McOption[],
): { letter: string; score: number; method: 'explicit_letter' | 'token_or_numeric_match' } | null {
  const explicit = extractChosenLetterFromAuthorityText(answerText, options);
  if (explicit) return { ...explicit, method: 'explicit_letter' };
  const fallback = matchFreeTextAnswerToOption(answerText, options);
  if (fallback) return { ...fallback, method: 'token_or_numeric_match' };
  return null;
}

// ─── BP139 Authority Ensemble: Google + Perplexity (+ Wolfram for computable), corroborated ──
//
// Founder mandate: "if ANY free authority can find the answer, we find it. Cheaper." Replaces
// Stage F2's old "Perplexity preferred, Google bookkeeping-only" behavior (see
// browserAuthorityCorroboration's pre-ensemble doc comment on CanonicalPlowMcResult) with a
// genuine multi-authority vote: query every free authority available for this answerType, WITH
// the MC options embedded so each one states its own letter + reasoning + source, then
// corroborate:
//   - 2+ browser/Wolfram authorities agree on a letter -> accept immediately, swarm NEVER fires
//     (highest confidence, fastest, cheapest, 'agree'). Unchanged from the original ensemble.
//   - otherwise (0 or 1 browser/Wolfram authority answered, or 2+ answered and ALL disagree) --
//     the browser panel is UNCERTAIN, so the existing 13-source specialist swarm (Miner ->
//     Saladin/Furnace -> 3-voter arbitration, see runSpecialistSwarmConsensus() just below,
//     REUSING that machinery, never a second swarm implementation) fires as ONE MORE
//     corroborating candidate, labeled authority:'specialist_swarm', but ONLY counts as a
//     candidate when it reached a genuine CONCORDANT 3-voter consensus (never a DISCORDANT/
//     partial/guessed swarm vote). The full candidate set (browser/Wolfram + swarm) is then
//     re-corroborated:
//       - adding the swarm creates a 2+ agreement -> accept, 'agree' (now cross-validated).
//       - exactly 1 candidate total (browser-only or swarm-only) -> accept it
//         ('single_google'/'single_perplexity'/'single_wolfram'/'single_specialist_swarm'), same
//         honesty bar as the pre-ensemble single-authority accept.
//       - 2+ candidates still ALL disagree (swarm included) -> ONE extra Perplexity ADJUDICATION
//         call (never more than one, never fired on agreement) -- the judge sees every
//         candidate's letter + reasoning (including the swarm's) and is asked to state which is
//         actually correct ('adjudicated').
//       - nobody answered at all (browser AND swarm both empty/inconclusive), or the judge also
//         can't resolve a letter -> 'none'/'disagree', honest fall-through.
// Every browser/Wolfram candidate carries a real sourceUrl: Perplexity/Google via
// distillExtraction's own non-negotiable non-null-sourceUrl requirement
// (browser_authority_types.ts), Wolfram via a reproducible wolframalpha.com query URL. The
// specialist_swarm candidate carries a non-web internal provenance marker instead (it is not a
// single fetchable page -- its "source" is the swarm's own independently-fired 13-adapter panel
// + Saladin's adversarial fence + 3-voter arbitration, an equally real but differently-shaped
// verification). This is the HONESTY firewall (BR-007): a letter is NEVER accepted without a
// genuinely corroborated authority (sourced browser/Wolfram fact OR a real CONCORDANT swarm
// vote) behind it, and this engine never reads the sealed answer key.

export interface AuthorityEnsembleCandidate {
  authority:
    | 'user_google' | 'user_perplexity' | 'wolfram_alpha' | 'user_perplexity_judge' | 'specialist_swarm'
    // BP139 browser-LLM authorities (PREMIUM, opt-in only -- see the gate at their call site
    // inside runAuthorityEnsemble below): general second opinions for conceptual/knowledge
    // questions the Perplexity/Google/specialist-swarm panel alone can miss.
    | 'user_chatgpt' | 'user_gemini' | 'user_claude'
    // BP1xx DETERMINISTIC-OVERRIDE-HOIST: the synthetic "candidate" runAuthorityEnsemble's own
    // pre-branch deterministic-compute check (see that function's header, right before the FAST
    // PATH block) fabricates ONLY to carry the calculator's own letter/reasoning/method through
    // the exact same acceptedCandidates shape the rest of this file's accept path already
    // expects -- never a guessed/authority-sourced answer, always backed by a real
    // DeterministicComputeCandidate whose `source` is 'question_expression' (or one of the
    // question-only named-solver tags) -- see 'deterministic_compute_reasoning_fact' below for
    // the sibling tag used when `source` is 'reasoning_fact'.
    | 'deterministic_compute'
    // BP-COMPUTE-HONEST-DEMOTE (superseded by BP-ECHO-NO-VOTE below -- kept here as a historical/
    // vestigial tag, see that note): the pre-branch hoist check (runAuthorityEnsemble, right
    // before the FAST PATH block) can find a DeterministicComputeCandidate whose
    // `source === 'reasoning_fact'` (compute_sidecar.ts's paths (a)/(c): the quantity was
    // extracted from an authority's own reasoning/fact text, not a literal expression in the
    // question). That result IS a real, checked unit-conversion/tolerance-match -- it is not a
    // guess -- but it has NO independent grounding of its own (it is a derived restatement of
    // whichever authority's text it was pulled from), so it may no longer pre-branch-override the
    // ensemble.
    // BP-ECHO-NO-VOTE (this pass): BP-COMPUTE-HONEST-DEMOTE originally pushed this result into
    // `candidates` as an "ordinary" candidate under THIS tag so it could still compete on 2+
    // agreement -- but because it always shares the letter of the authority its quantity was
    // extracted FROM, that let the same voice count twice toward "agree" (live receipt:
    // candidates ended up [user_perplexity, deterministic_compute_reasoning_fact], an echo read as
    // corroboration). It is NO LONGER ever pushed into `candidates` at all -- see
    // AuthorityEnsembleOutcome.reasoningFactComputeReceipt for where it is recorded instead (a
    // non-voting receipt/annotation only). This authority tag is kept in the union purely as a
    // historical/documentary marker (nothing in this file constructs a candidate under it any
    // more) -- safe to remove in a future pass once Bishop confirms nothing downstream still
    // switches on it.
    | 'deterministic_compute_reasoning_fact'
    // BP141-2 THE CAKE METHOD (N-Cut/N-Pick), Founder-directed, supersedes the single-Perplexity-
    // judge 'user_perplexity_judge' adjudication path below. This tag marks the SYNTHESIZED outcome
    // of the plurality-of-picks vote -- never a single authority's own answer, so it must never be
    // confused with (or substituted for) 'user_perplexity_judge', which specifically means "the one
    // extra Perplexity call was the judge" (no longer true: N participants cut AND pick now, see
    // runCakeMethodDisagreementResolution()). Kept as its own additive union member (Rule 66) rather
    // than repurposing an existing tag.
    | 'cake_pick_plurality'
    // KN-BP145-A: the format-independent elimination cascade fallback
    // (runEliminationCascadeFormatIndependentFallback, PAPER-15 sections 3-7), given its OWN
    // reachable entry point at the disagree-fallthrough site (cascadeAdjudicatorEngaged), gated
    // on that condition rather than on answerType === 'computable' -- see that call site's own
    // comment for the full rationale. Deliberately NOT tagged 'deterministic_compute': that tag
    // makes runCandidateSourceCascadeAdjudicator's RULE 2 (isRooted/"proven beats concordant")
    // treat a candidate as an automatic-win proof, which this mechanism's own model_derived
    // provenance (KN-BP143-1 Defect 2 / BP-ECHO-NO-VOTE, same file) explicitly does not deserve --
    // it composes and verifies its own query, which is real evidence, but it must corroborate and
    // compete as one more genuinely independent witness, never auto-override.
    | 'elimination_cascade_fallback';
  letter: string;
  reasoning: string;
  sourceUrl: string;
  method: string;
}

// ─── BP141-2 THE CAKE METHOD (N-Cut/N-Pick) -- Founder-directed, BP141 ──────────────────────────
//
// Supersedes the old single-Perplexity-judge adjudication path (buildAdjudicationPromptText,
// removed below) that fired when the ensemble's authorities disagreed even after the swarm was
// folded in. The judge in that path was often a DISPUTANT itself (it had already cast one of the
// disagreeing votes) and then adjudicated its own dispute with the candidate pool sitting right in
// its own prompt -- never genuinely blind. THE CAKE METHOD: one cuts, the other picks --
// generalized here to N participants (N=1 is the degenerate single-machine case).
//
// KN-BP141-7 P4 (Founder-directed BP141, regression investigation): THE TRIGGER CONDITION, STATED
// EXPLICITLY. runCakeMethodDisagreementResolution is called from exactly ONE call site (see
// runAuthorityEnsemble's own "Still all disagree even with the swarm folded in" log line, right
// before the call), reached only when BOTH of the following hold:
//   (1) answerType !== 'computable', OR it IS 'computable' but the pre-branch deterministic-
//       compute-override hoist (BP1xx DETERMINISTIC-OVERRIDE-HOIST, "the calculator wins the math,
//       every time") found nothing -- a genuine deterministic proof always short-circuits BEFORE
//       Cake ever gets a chance to run, per P2's own "a proof outranks a referee" requirement.
//   (2) the browser/Wolfram/LLM authority panel's FAST PATH did not already accept an agreement --
//       i.e. there was no single lone accepted candidate and no 2+ same-letter agreeing group
//       (structured OR LLM-only) -- AND, after the specialist swarm was folded in as one more
//       corroborating vote specifically to try to resolve that disagreement, the swarm EITHER also
//       disagreed with the LLM-only group's letter (swarmStructurallyDisagrees) OR still produced
//       no agreeing group at all.
// This is BY DESIGN, not an accident: Cake is the LAST resort inside the authority ensemble,
// reached only once every cheaper agreement path has been tried and failed. It is deliberately
// narrow -- most questions resolve at the fast-path agree/single-accept stage and never reach Cake
// at all. Empirically, on run 032's real 20-question set, Cake fired on exactly 3 of 20 questions
// (question_id 66, 98, 105 -- confirmed by grep for "cakeMethodUsed": true in that run's receipt);
// all three were genuine, persistent multi-source disagreements the swarm could not settle either,
// not a narrowing bug. See this ticket's own KN-BP141-7 report for the full count and per-question
// breakdown.
//
// A6 (ALL CUT): every available participant answers with NO candidate pool visible. In today's
// single-machine deployment this is realized two ways: (1) the EXISTING browser/Wolfram/swarm
// candidates gathered earlier in runAuthorityEnsemble already satisfy this -- each answered the
// bare question with no candidate pool in its prompt, so they are reused as cuts rather than
// re-asked; (2) the local orchestrator (this box's own Ollama model) casts its OWN cut(s), one per
// assigned derivation route (see A13/assignCakeRoutesRoundRobin below).
//
// A9 (REVISED, BP141-2 Founder Correction -- supersedes the first amendment's distinct-MODEL-count
// design in full): the independence unit for Task B is the DERIVATION PATH, not the model and not
// the machine. resolveCakeDerivationPath()/resolveCakeModelIdentity() below are the ONE place that
// maps an existing AuthorityEnsembleCandidate onto its derivation path + model identity, from the
// harness's own bookkeeping -- NEVER by asking the model what produced it.
//
// A10 (REVISED): "VARIANCE IS NOT INDEPENDENCE." A calculator is an instrument, not a witness -- the
// SAME model reaching an answer via genuinely different routes (a deterministic solver vs. a
// browser retrieval vs. a from-first-principles reasoning pass) IS independent evidence; the SAME
// model/prompt/path sampled N times is sampling variance and must never inflate the independence
// count. See plow_mc_no_consensus_solver.ts (Task B) for the gate this feeds.
//
// A2/A8 (fresh context, no provenance leakage): the CHOOSE/pick prompt is built ONLY from
// anonymized "Source 1".."Source N" labels + a normalized one-line rationale (never the raw
// authority name, never the cut prompt or its raw response verbatim) -- assertCakeChoosePromptIsBlind()
// below is the runtime, programmatic proof of this, not just a comment.
//
// A13 (mesh route diversity): assignCakeRoutesRoundRobin() is the real, pure, testable allocation
// function A13 calls for. HONEST GAP, reported explicitly (never fabricated, same convention as
// browser_authority_adapter.ts's own createNotWiredBridge()): the live MESH-PEER transport leg
// (dispatching a differently-routed cut to each of N>=2 live peers over wan_dispatch.ts) is NOT
// wired this pass -- no live peer is reachable/verifiable in this sandbox, and shipping an untested
// mesh integration would violate this ticket's own real-compiled-dist/real-data verification
// standard. This function stays deterministic/seeded (never Math.random()) so a future mesh caller
// can reuse it unchanged for real per-peer allocation once that transport leg lands -- today it is
// exercised for the single-machine case only ("with 1 machine, run the routes sequentially in one
// box", per A13's own text).

/** The DERIVATION PATH string vocabulary -- see A9(REVISED)'s doc comment above. Not a closed enum
 *  (kept as a plain string) because deterministic-solver-tagged paths are formatted as
 *  `deterministic_solver:<name>` for an open-ended, growing set of named solvers. */
export type CakeDerivationPath = string;

/** One CUT vote in the Cake Method's anonymization pool -- either an existing
 *  AuthorityEnsembleCandidate (browser/Wolfram/swarm, reused, not re-asked) or a fresh local-
 *  orchestrator cut (see runCakeMethodDisagreementResolution). `pickerKey` is the harness-internal
 *  identity used ONLY for self-removal in the blindness audit (A4) -- it is NEVER placed into any
 *  prompt text sent to a model; see buildCakeChoosePromptText/assertCakeChoosePromptIsBlind. */
export interface CakeCutCandidate {
  pickerKey: string;
  derivationPath: CakeDerivationPath;
  modelIdentity: string;
  letter: string;
  reasoning: string;
}

/** A9 (REVISED): the ONE place that maps an existing ensemble candidate onto its derivation path,
 *  from the harness's own bookkeeping -- NEVER by asking the model. Each browser vendor is its own
 *  distinct route (a different retrieval/reasoning mechanism), 'swarm' is the internal 13-adapter
 *  consensus (one route regardless of its own internal voter count -- see runSpecialistSwarmConsensus,
 *  those 3 voters are NOT separately counted here, they already collapsed to one CONCORDANT swarm
 *  candidate before reaching this file's `candidates` array), and a named deterministic solver is
 *  its own route (a calculator is an instrument, not a witness -- see A10). */
export function resolveCakeDerivationPath(candidate: AuthorityEnsembleCandidate): CakeDerivationPath {
  switch (candidate.authority) {
    case 'user_perplexity': return 'browser:user_perplexity';
    case 'user_google': return 'browser:user_google';
    case 'user_claude': return 'browser:user_claude';
    case 'user_chatgpt': return 'browser:user_chatgpt';
    case 'user_gemini': return 'browser:user_gemini';
    case 'wolfram_alpha': return 'deterministic_solver:wolfram_compute';
    case 'specialist_swarm': return 'swarm';
    case 'deterministic_compute': return `deterministic_solver:${candidate.method}`;
    // KN-BP145-A: the elimination cascade fallback composes and verifies its own query (see that
    // call site's own comment) -- real evidence, its own distinct route, but deliberately mapped to
    // a 'deterministic_solver:' path rather than left equal to 'deterministic_compute' itself, so it
    // never collides with (or is mistaken for) a literal-expression calculator tier in any trace or
    // downstream switch that keys specifically on candidate.authority === 'deterministic_compute'.
    case 'elimination_cascade_fallback': return 'deterministic_solver:elimination_cascade_fallback';
    // Legacy/synthesized tags -- should never actually appear in a CUT pool (the judge tag predates
    // Cake, the plurality tag is Cake's own OUTPUT, not an input cut), but mapped honestly rather
    // than left to fall through to 'unknown:' if a future caller ever passes one in.
    case 'user_perplexity_judge': return 'browser:user_perplexity';
    case 'cake_pick_plurality': return 'cake_pick_plurality';
    default: return `unknown:${candidate.authority}`;
  }
}

/** A9's model-identity sibling -- kept (per the Founder Correction's explicit "model identity is
 *  still recorded... but it is NOT the independence unit anymore") purely as an informational trace
 *  field, never consulted by Task B's gate. */
export function resolveCakeModelIdentity(candidate: AuthorityEnsembleCandidate): string {
  switch (candidate.authority) {
    case 'user_perplexity': case 'user_perplexity_judge': return 'perplexity';
    case 'user_google': return 'google_search';
    case 'user_claude': return 'claude';
    case 'user_chatgpt': return 'chatgpt';
    case 'user_gemini': return 'gemini';
    case 'wolfram_alpha': return 'wolfram_alpha';
    case 'specialist_swarm': return 'specialist_swarm_internal';
    case 'deterministic_compute': return `deterministic_solver:${candidate.method}`;
    default: return candidate.authority;
  }
}

/** Deterministic seed derived from the question text (A3/A5) -- so a receipt's shuffle/labeling is
 *  reproducible from the question alone, never from Math.random(). Pure/synchronous. */
export function computeAnonymizedOrderSeed(questionText: string): number {
  const digest = createHash('sha256').update(questionText.trim()).digest('hex');
  return parseInt(digest.slice(0, 8), 16);
}

function hashStringToUint32(s: string): number {
  const digest = createHash('sha256').update(s).digest('hex');
  return parseInt(digest.slice(0, 8), 16);
}

/** mulberry32 -- small, fast, deterministic PRNG. Not cryptographic (does not need to be); only
 *  needs to be reproducible from a given 32-bit seed, which createHash-derived seeds provide. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A3/A7 Shuffle: order seeded by a deterministic hash of the question text (`seed`), COMBINED with
 *  this specific picker's own identity (`pickerKey`) so each picker sees its own permutation
 *  ("per-picker-shuffled", A7) -- no picker's own candidate is pinned to a fixed slot across
 *  different questions OR across different pickers on the SAME question. Pure, reproducible. */
export function shuffleCakePoolForPicker<T>(pool: T[], seed: number, pickerKey: string): T[] {
  const pickerSeed = (seed ^ hashStringToUint32(pickerKey)) >>> 0;
  const rng = mulberry32(pickerSeed);
  const arr = pool.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!; arr[i] = arr[j]!; arr[j] = tmp;
  }
  return arr;
}

/** A3 Normalize prose: strips a candidate's reasoning down to its first clause (up to the first
 *  sentence-ending punctuation), collapsing whitespace, hard-truncated as a backstop. This is a
 *  REAL transformation, not a cosmetic label -- but it is NOT a style-transfer / paraphrase pass
 *  (this codebase has no cheap way to do that without another model call), so a determined model
 *  MAY still detect stylistic tells in the surviving clause on some questions. That limitation is
 *  reported honestly in this build's verification, not papered over -- see the blindness audit
 *  (A4/cakeSelfPreferenceAudit) for the empirical measurement of whether this is good enough. */
export function normalizeCakeRationale(reasoning: string, maxLen = 160): string {
  const collapsed = reasoning.replace(/\s+/g, ' ').trim();
  // Too short to usefully clip further, and this short a fragment carries no more information
  // than the letter the anonymized pool already displays next to it -- not a meaningful A2 leak.
  const TRIVIAL_LEN = 24;
  if (collapsed.length <= TRIVIAL_LEN) return collapsed;

  const sentenceMatch = collapsed.match(/^[^.!?\n]+[.!?]/);
  const clause = sentenceMatch ? sentenceMatch[0].trim() : null;
  // Only trust a sentence match that stops STRICTLY BEFORE the end of the raw text -- i.e. it
  // actually dropped a second sentence or trailing content. When the only punctuation in the
  // whole response sits at the very last character (a single already-terse sentence, or a
  // formatted one-liner like the specialist swarm's "...postFurnace=1)."), sentenceMatch swallows
  // the ENTIRE string and would return it byte-identical to the raw cut response -- which
  // assertCakeChoosePromptIsBlind (correctly) treats as a verbatim leak of the cut's own response
  // into the pick prompt (A2). Live-verified against run 030's own receipt (question_id 92,
  // specialist_swarm candidate: 150 raw chars, single terminal period, no other punctuation).
  if (clause && clause.length < collapsed.length) {
    return clause.length > maxLen ? `${clause.slice(0, maxLen - 1).trim()}...` : clause;
  }
  // No usable interior sentence boundary (no punctuation at all, or punctuation only at the very
  // last character). Force a proportional, visibly-shorter clip so the output can never be
  // byte-identical to (or a whole-string match of) the raw reasoning it was derived from.
  const target = Math.min(maxLen - 1, Math.floor(collapsed.length * 0.6));
  const clipTo = Math.max(TRIVIAL_LEN, target);
  return `${collapsed.slice(0, clipTo).trim()}...`;
}

/** A2/A3 CHOOSE prompt -- built ONLY from anonymized "Source K" labels + a normalized rationale.
 *  NEVER contains any provenance string (see assertCakeChoosePromptIsBlind, the programmatic proof
 *  this file's own header requires) and NEVER contains the raw, un-normalized reasoning text of any
 *  cut, so it cannot be the same request twice for two different pickers even though the underlying
 *  evidence pool is the same -- each picker's own per-picker shuffle (A7) also reorders the labels. */
export function buildCakeChoosePromptText(
  question: string,
  options: McOption[],
  anonymizedPool: { label: string; letter: string; rationale: string }[],
): string {
  const optionLines = options.map((o) => `${o.letter}) ${o.text}`).join('\n');
  const sourceLines = anonymizedPool.map((s) => `- ${s.label} says ${s.letter}: ${s.rationale}`).join('\n');
  return (
    `${question.trim()}\n\nOptions:\n${optionLines}\n\n` +
    `Several independent, anonymized research sources disagree on the answer to this question:\n${sourceLines}\n\n` +
    `Which option is actually correct? Reply starting with "Answer: <letter>" then a one-sentence reason.`
  );
}

const CAKE_PROVENANCE_MARKERS = [
  'user_perplexity', 'user_google', 'user_claude', 'user_chatgpt', 'user_gemini',
  'wolfram_alpha', 'specialist_swarm', 'deterministic_compute', 'local_orchestrator', 'ollama',
];

/** A2/A8's PROGRAMMATIC assertion, not just a comment: throws if the choose prompt leaks a
 *  provenance string (A3 anonymize requirement) OR contains the verbatim cut prompt/response text
 *  of any cut (A2 fresh-context requirement). Called before EVERY pick call, for EVERY picker
 *  (including the orchestrator's own pick, per A8's explicit "assert programmatically... including
 *  for itself"). A thrown error here is a genuine mechanism failure, never caught-and-ignored by its
 *  caller -- see runCakeMethodDisagreementResolution's call sites. */
export function assertCakeChoosePromptIsBlind(choosePrompt: string, cutTextsToExclude: string[]): void {
  const lower = choosePrompt.toLowerCase();
  for (const marker of CAKE_PROVENANCE_MARKERS) {
    if (lower.includes(marker.toLowerCase())) {
      throw new Error(
        `CAKE METHOD BLINDING VIOLATION (A3): choose prompt contains provenance marker "${marker}" -- ` +
        'the blind is cosmetic, not real.',
      );
    }
  }
  for (const cutText of cutTextsToExclude) {
    if (cutText && cutText.length > 0 && choosePrompt.includes(cutText)) {
      throw new Error(
        'CAKE METHOD BLINDING VIOLATION (A2): choose prompt contains a cut prompt/response verbatim ' +
        'as a substring -- A2 requires a genuinely fresh context, "forget what you said" is not enough.',
      );
    }
  }
}

/** KN-BP143-1 Defect 1 (CAKE SELF-PREFERENCE): an authority that is a DISPUTANT in this
 *  adjudication -- its own cut is present in the pool, i.e. `judgeWasDisputant === true` on its
 *  own cakeSelfPreferenceAudit entry -- is INELIGIBLE to judge/vote in the tally. Not
 *  down-weighted: excluded entirely. This is exactly the defect the Cake Method was built to fix
 *  in the first place (see runCakeMethodDisagreementResolution's own doc comment: "never a single
 *  disputant judging its own dispute") -- KN-BP141-7 P1's cutter-equals-picker invariant
 *  reintroduced it structurally, because every picker who can legally vote now always has a cut
 *  of its own sitting in the very pool it is judging. Matched by pickerKey (never by array index)
 *  so this stays correct even if a future edit decouples how `picks` and `audit` are built. Pure,
 *  synchronous, exported so it is directly testable against real receipt-shaped input -- see
 *  KN-BP143-1's own verification script. If EVERY picker turns out to be a disputant, the
 *  returned array is empty and the caller's tally (tallyCakePicksWithAbstain) honestly ABSTAINS --
 *  never widen this gate to force a pick. */
export function filterCakePicksToEligibleJudges<T extends { pickerKey: string }>(
  picks: T[],
  audit: { pickerKey: string; judgeWasDisputant: boolean }[],
): T[] {
  const disputantPickerKeys = new Set(audit.filter((a) => a.judgeWasDisputant).map((a) => a.pickerKey));
  return picks.filter((p) => !disputantPickerKeys.has(p.pickerKey));
}

/** A7: the final letter is the PLURALITY of picks. Ties fall through to abstain -- NEVER to
 *  whichever picker answered first (no positional/temporal tie-break of any kind). Pure. */
export function tallyCakePicksWithAbstain(
  pickedLetters: (string | null)[],
): { chosenLetter: string | null; pickConvergence: number } {
  const counts = new Map<string, number>();
  for (const l of pickedLetters) {
    if (!l) continue;
    counts.set(l, (counts.get(l) ?? 0) + 1);
  }
  if (counts.size === 0) return { chosenLetter: null, pickConvergence: 0 };
  let maxCount = 0;
  for (const c of counts.values()) maxCount = Math.max(maxCount, c);
  const leaders = [...counts.entries()].filter(([, c]) => c === maxCount);
  return { chosenLetter: leaders.length === 1 ? leaders[0]![0] : null, pickConvergence: counts.size };
}

/** A12: the cross-signal trace. cutScatter = distinct letters among the CUTS (before picking);
 *  pickConvergence = distinct letters among the PICKS (after picking). Pure. */
export function resolveCakeQuadrant(cutScatter: number, pickConvergence: number, pickCount: number): string {
  if (pickCount === 0) return 'no_picks_available';
  if (cutScatter <= 1) return 'no_real_cut_disagreement';
  if (pickConvergence === 1) return 'scatter_resolved_by_pick';
  return 'scatter_persists_after_pick';
}

/** A13: the mesh-diversity route allocator -- see this section's own header for the honest
 *  single-machine-only scope of this pass. Deterministic/seeded (never Math.random()) so it stays
 *  reproducible AND directly reusable, unchanged, by a future real mesh caller. */
export const CAKE_LOCAL_ROUTE_POOL: CakeDerivationPath[] = [
  'local_orchestrator:retrieval_first',
  'local_orchestrator:reasoning_first',
];
export function assignCakeRoutesRoundRobin(
  participantCount: number,
  questionRoundIndex: number,
  routePool: CakeDerivationPath[] = CAKE_LOCAL_ROUTE_POOL,
): CakeDerivationPath[] {
  if (participantCount <= 0 || routePool.length === 0) return [];
  if (participantCount >= routePool.length) return routePool.slice();
  const start = ((questionRoundIndex % routePool.length) + routePool.length) % routePool.length;
  const out: CakeDerivationPath[] = [];
  for (let i = 0; i < participantCount; i++) out.push(routePool[(start + i) % routePool.length]!);
  return out;
}

/** Local-orchestrator CUT prompt (A6) -- deliberately carries NO candidate pool, mirroring exactly
 *  what the existing browser/Wolfram/swarm cuts already did before this file ever saw them. */
function buildCakeCutPromptText(question: string, options: McOption[], route: CakeDerivationPath): string {
  const optionLines = options.map((o) => `${o.letter}) ${o.text}`).join('\n');
  const framing = route === 'local_orchestrator:reasoning_first'
    ? 'Without assuming any external facts, reason step by step from first principles or by process of elimination, then commit to one answer.'
    : 'Recall any facts you already know that are directly relevant to this question, list them briefly, then commit to one answer.';
  return `${question.trim()}\n\nOptions:\n${optionLines}\n\n${framing}\n\nReply starting with "Answer: <letter>" then a one-sentence reason.`;
}

// KN-BP141-7 P6 (Founder-directed BP141, regression fix, ONLY AFTER P1-P5): wires
// plow_mc_elimination_cascade.ts's C4 (checkBidirectionalConsistency) into the live answerer for the
// FIRST time, as a CANDIDATE PRODUCER, never an eliminator -- it contributes at most one additional cut
// to the Cake Method's cutPool (see its one call site inside runCakeMethodDisagreementResolution below),
// tagged with its own derivation path, and never removes or excludes any other participant's cut or
// pick. Rationale, per this ticket's own explicit instruction: three live receipts this ticket (run 032,
// qid 105, qid 111, qid 98) show elimination destroying correct answers -- adding a STRONGER eliminator
// to a stage that already over-eliminates, before that over-elimination is even measured and closed,
// would compound the exact defect this ticket exists to fix. That is why this wiring produces candidates
// only, and why plow_gom_jabbar.ts's G5 (wired further below, at its own call site after
// minorityCutsOverridden) stays disabled rather than being wired as a second eliminator alongside it.
//
// C4 needs no ground truth and no second model, only two live calls to the SAME model asking for its own
// ranking of every option letter in both directions (most-confident-first, then least-confident-first).
// This two-call sequence IS the "multi-turn dispatch harness" the ticket asks for -- nothing more
// elaborate was needed because C4's own admissibility test is defined purely on one source's own two
// rankings (see plow_mc_elimination_cascade.ts's C4 section header for the full "a source that cannot
// reverse its own ranking does not know" rationale). A candidate is produced ONLY when the two rankings
// are byte-for-byte reverses of each other (checkBidirectionalConsistency's own admissibility bar) -- an
// inconsistent source produces NO candidate at all (never a guessed one), and that inconsistency is still
// reported in the returned trace for the Coroner to see, never silently dropped.
//
// HONEST SCOPE NOTE (P6): plow_gom_jabbar.ts's G1 (reconcileDerivedQuantity) requires a caller-supplied
// set of DerivedQuantityFactor entries (independently-sourced numeric factors to reconcile against a
// claimed product/quotient) that nothing in this file currently extracts from a live question -- wiring
// G1 here would mean inventing a factor-extraction mechanism that does not exist yet, which is exactly
// the kind of decorative, non-integrated wiring this ticket asks NOT to build. G1 (and, transitively, G2
// evaluateSignificantFigureAccept's own SymPy-backed arithmetic check, which only has real callers when
// G1 has already produced factors to reconcile) are left UNWIRED this pass -- reported honestly here as
// an open gap rather than forced. Only G5 (tallyVotesStrikingFailures) is wired, and only advisory, at
// its own call site below.
async function runEliminationCascadeCandidateProducer(
  researchQuery: string,
  mcOptions: McOption[],
  config: CanonicalPlowMcConfig,
  log: (msg: string) => void,
): Promise<{
  candidate: { letter: string; derivationPath: CakeDerivationPath; reasoning: string } | null;
  consistency: BidirectionalConsistencyResult;
}> {
  const validLetters = new Set(mcOptions.map((o) => o.letter));
  // KN-BP141-7 P6: a deliberately simple first-appearance-order letter extraction, separate from
  // resolveAuthorityLetterMatch (which is built to find exactly ONE letter, not a full ranking).
  // Honest limitation, recorded rather than hidden: a model that mentions the same letter early in
  // unrelated prose before actually starting its ranking could pollute the sequence -- the two prompts
  // below ask for one letter per line, nothing else, specifically to keep this heuristic reliable in
  // practice, but this comment records the known edge case rather than papering over it.
  const extractLetterSequence = (raw: string | null): string[] => {
    if (!raw) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    const re = /\b([A-Z])\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
      const letter = m[1]!;
      if (validLetters.has(letter) && !seen.has(letter)) {
        seen.add(letter);
        out.push(letter);
      }
    }
    return out;
  };

  const optionLines = mcOptions.map((o) => `${o.letter}) ${o.text}`).join('\n');
  const mostToLeastPrompt =
    `${researchQuery.trim()}\n\nOptions:\n${optionLines}\n\nRank ALL of the option letters above from ` +
    'MOST confident correct to LEAST confident correct. Reply with exactly one letter per line, most ' +
    'confident first, every letter listed exactly once, nothing else.';
  const leastToMostPrompt =
    `${researchQuery.trim()}\n\nOptions:\n${optionLines}\n\nRank ALL of the option letters above from ` +
    'LEAST confident correct to MOST confident correct. Reply with exactly one letter per line, least ' +
    'confident first, every letter listed exactly once, nothing else.';

  let mostToLeast: string[] = [];
  let leastToMost: string[] = [];
  try {
    // Two live, sequential dispatch calls to the SAME model (multi-turn harness, KN-BP141-7 P6) --
    // deliberately sequential, not parallel, so this stays a true two-turn conversation-shaped
    // dispatch rather than two independent one-shot calls that happen to run concurrently.
    const rawMostToLeast = await callOllama(mostToLeastPrompt, config.ollamaBaseUrl, config.model, 0);
    mostToLeast = extractLetterSequence(rawMostToLeast);
    const rawLeastToMost = await callOllama(leastToMostPrompt, config.ollamaBaseUrl, config.model, 0);
    leastToMost = extractLetterSequence(rawLeastToMost);
  } catch (err) {
    log(`cascade-candidate-producer threw during dispatch (non-fatal, no candidate produced): ${err}`);
  }

  const consistency = checkBidirectionalConsistency('local_orchestrator:elimination_cascade', mostToLeast, leastToMost);
  log(`cascade-candidate-producer ${consistency.trace}`);

  if (!consistency.consistent || mostToLeast.length === 0) {
    return { candidate: null, consistency };
  }

  const topLetter = mostToLeast[0]!;
  return {
    candidate: {
      letter: topLetter,
      derivationPath: 'deterministic_solver:elimination_cascade_c4',
      reasoning:
        'Elimination cascade C4 candidate producer (KN-BP141-7 P6): bidirectional-consistent ranking ' +
        `most-to-least=[${mostToLeast.join(',')}] reverses cleanly to the same source's own ` +
        `least-to-most=[${leastToMost.join(',')}] -- top candidate ${topLetter}.`,
    },
    consistency,
  };
}

export interface AuthorityEnsembleOutcome {
  chosenLetter: string | null;
  corroboration:
    | 'agree' | 'disagree' | 'single_google' | 'single_perplexity' | 'single_wolfram'
    | 'single_specialist_swarm' | 'adjudicated' | 'none'
    // BP139 browser-LLM authorities: same "exactly one real candidate total" label convention.
    | 'single_chatgpt' | 'single_gemini' | 'single_claude'
    // BP139 Concordance Gate: a lone candidate existed (the single_* labels above would have
    // applied) but concordanceStrictness ('require_two'/'require_majority') rejected it for
    // lacking corroboration on a NO-COMPUTE question -- honest, distinct from 'none' (nobody
    // answered at all). See resolveConcordanceAcceptance's call site for the one place this is
    // ever set.
    | 'lone_rejected_by_strictness'
    // BP1xx DETERMINISTIC-OVERRIDE-HOIST: the calculator answered BEFORE any agree/disagree/
    // adjudicate/single-source branching below ever ran -- see this function's own pre-branch
    // check, right before the FAST PATH block. Distinct from every label above because none of
    // them apply: no authority-agreement question was ever even asked. Only reachable for
    // answerType==='computable'.
    | 'deterministic_compute_override'
    // BP-PSEUDOCODE-TRACE-ANSWER-TYPE-BYPASS: the pseudocode-trace solver proved a letter by
    // EXECUTING the question's own procedures against its own worked example, BEFORE even the
    // Perplexity/Google/browser-LLM calls at the top of this function ran -- reachable for ANY
    // answerType (that is the whole point of this bypass: the solver's own gate is strict enough
    // to be its own classifier). Distinct from 'deterministic_compute_override' (which only ever
    // fires for answerType==='computable', after Wolfram but before the agree/disagree branching)
    // even though both are calculator-proved: this one runs earlier still, and unconditionally.
    | 'deterministic_compute';
  candidates: AuthorityEnsembleCandidate[];
  acceptedCandidates: AuthorityEnsembleCandidate[];
  adjudicationAttempted: boolean;
  /** Populated ONLY alongside corroboration==='deterministic_compute_override' -- the real
   *  DeterministicComputeCandidate the pre-branch hoist check found, so the caller can report the
   *  SAME method/expression/computedValue provenance it already reports for the (unchanged)
   *  post-branch override path, without recomputing the six tiers a second time. Undefined for
   *  every other corroboration value. */
  deterministicOverride?: DeterministicComputeCandidate | null;
  /** BP-ECHO-NO-VOTE receipt/annotation, OPTIONAL/ADDITIVE. Populated ONLY when the pre-branch
   *  hoist check (right before the FAST PATH block below) found a DeterministicComputeCandidate
   *  that is `model_derived` (originally written for `source === 'reasoning_fact'` alone -- a
   *  real, checked compute whose input quantity was extracted from an authority's OWN reasoning/
   *  fact text rather than the question itself; see 'deterministic_compute_reasoning_fact' on
   *  AuthorityEnsembleCandidate's `authority` union for the full rationale. KN-BP143-1b: the
   *  field's NAME still says `reasoningFact` for source-compat with every existing reader, but its
   *  POPULATION condition is now `!isLiteralExpressionProvenance(det)`, which also catches
   *  no_consensus_from_scatter/elimination_cascade_fallback candidates reaching this site --
   *  neither is reasoning-fact-sourced in the original narrow sense, both are equally
   *  model_derived and equally disqualified from voting for the same reason). PRIOR behavior
   *  (BP-COMPUTE-HONEST-DEMOTE) pushed this into `candidates` as an ordinary voting entry -- but
   *  that entry is a DERIVED RESTATEMENT of whichever authority/scatter it was pulled from, so it
   *  always shares that source's letter, and letting it into `candidates` meant the same voice
   *  silently counted twice toward a 2+ "agree" (live receipt: candidates==[user_perplexity,
   *  deterministic_compute_reasoning_fact], the second derived FROM the first -- the ensemble read
   *  it as independent corroboration when it was an echo). THIS field is the fix: the model_derived
   *  compute result is recorded HERE (never pushed into `candidates`, so it can never enter
   *  concordance/agreement/adjudication counting, and STRUCTURED_AUTHORITIES/
   *  hasStructuredCorroborator never see it either), purely so the Coroner/trace can still see a
   *  compute ran and what it produced. See the log line at its one push-site (runAuthorityEnsemble,
   *  right after the pre-branch hoist check) for the human-readable equivalent of this same
   *  receipt. */
  reasoningFactComputeReceipt?: {
    letter: string;
    method: string;
    sourceExpression: string;
    computedValue: number;
    computedUnit: string | null;
  };
  /** True only when the browser/Wolfram panel was NOT already a confident 2+ agreement, so the
   *  specialist swarm (Miner -> Furnace -> 3-voters) fired as an extra corroborating candidate.
   *  False on the fast agree-immediately path -- this is the field that proves the swarm stays
   *  skipped (cheap) whenever the browser authorities already agreed. */
  swarmFired: boolean;
  /** Populated ONLY when swarmFired is true -- the swarm's real specialist/candidate counts and
   *  voter detail, regardless of whether its letter ended up counting as a candidate (a
   *  DISCORDANT swarm result still fills this in for trace visibility, per "record the swarm as
   *  a labeled candidate... so the trace shows it participated" -- see the honesty note above on
   *  why a non-CONCORDANT swarm result never becomes an actual voting candidate). */
  swarmReceipt?: {
    specialistsUsed: string[];
    candidatesRaw: number;
    candidatesPostMiner: number;
    candidatesPostFurnace: number;
    voterLetters: (string | null)[];
    voterDiagnostics: VoterDiagnostic[];
    concordance: ConcordanceClass;
  };
  /** BP1xx STRUCTURED-CORROBORATOR GATE, OPTIONAL/ADDITIVE. Populated ONLY when
   *  corroboration === 'agree' (the two authority-ensemble accept sites that finalize an
   *  'agree' verdict -- the fast path, before the swarm ever fires, and the swarm-augmented
   *  path further down). Absent for every other corroboration value (single_*, adjudicated,
   *  deterministic_compute_override, none, disagree, lone_rejected_by_strictness) -- those are
   *  either already structurally distinct from the failure mode this gate targets, or are not
   *  an "agreement" at all.
   *
   *  THE PROBLEM (empirical, live 90% mesh run, question Q85): user_perplexity and user_claude
   *  BOTH agreed on the wrong letter with NO structured (non-LLM) cross-check behind either of
   *  them -- it landed in the thin-evidence branch where no deterministic compute fired and the
   *  specialist swarm never got a chance (the fast path already accepted on "2 sources agree").
   *  Two confidently-wrong LLM opinions concurring is not corroboration; it is the SAME failure
   *  mode wearing a second face. Naive concordance ("N sources agree -> accept") cannot catch
   *  two LLMs that are wrong together.
   *
   *  true  = the accepted agreeing group contains at least one STRUCTURED (non-LLM) source --
   *          wolfram_alpha, or a specialist_swarm candidate (which by construction only ever
   *          enters `candidates` after its own 3 voters reached a genuine CONCORDANT consensus,
   *          see the HONESTY note at the swarm's push site above) -- OR the specialist swarm was
   *          fired specifically as this gate's required corroborator and it concurred.
   *  false = every member of the accepted agreeing group is LLM-class (user_perplexity,
   *          user_google, user_chatgpt, user_gemini, user_claude, user_perplexity_judge) -- an
   *          LLM-only concordance. This still gets ACCEPTED (coverage is protected, never an
   *          abstain purely for this reason) but is de-confidenced: the caller/Coroner/Liana
   *          Cycle should treat it as weaker evidence than a structurally-backed accept.
   *
   *  Authority classification for this gate (Bishop-reviewed, see this build's own report for
   *  the full rationale):
   *    STRUCTURED (sufficient on its own): wolfram_alpha, specialist_swarm-when-CONCORDANT,
   *      deterministic_compute (the pre-branch hoist override -- never reaches an 'agree' return
   *      at all, listed here only for completeness of the STRUCTURED_AUTHORITIES set below).
   *    LLM-class (opinion, no structured backing): user_perplexity, user_claude, user_chatgpt,
   *      user_gemini, user_perplexity_judge.
   *    AMBIGUOUS, treated as NOT sufficient (i.e. folded into the LLM-class bucket for this
   *      gate): user_google. It is an LLM-summarized search result, not a deterministic
   *      computation or a genuinely independent structured system -- and empirically 0/3 in the
   *      sample this gate was designed against. Flagged here explicitly for Bishop to revisit;
   *      see STRUCTURED_AUTHORITIES below for the one place this classification is encoded. */
  structuredCorroborator?: boolean;
  /** BP141 INDEPENDENCE-AWARE CORROBORATION FLAG, OPTIONAL/ADDITIVE, additive signal only -- does
   *  not alter accept/reject/abstain behavior anywhere. Populated ONLY alongside
   *  corroboration === 'agree' (the same two call sites that set structuredCorroborator above:
   *  the fast path, before the swarm ever fires, and the swarm-augmented path further down).
   *  true  = each agreeing candidate reached its letter with its own evidence -- a real sourced
   *          browser/Wolfram fetch, or a specialist_swarm candidate that (per the BP141
   *          echo-abstention fix at the swarm's push site above) only ever enters `candidates`
   *          when its own voters arbitrated over genuinely Furnace-verified facts
   *          (candidatesPostFurnace > 0).
   *  false = the only agreement is between LLM-class opinions with no structured, independently-
   *          grounded member behind any of them -- includes the case this flag exists to name:
   *          an LLM-class source agreeing with a specialist_swarm result that reached its letter
   *          WITHOUT its own grounding (echoing rather than corroborating). That specific swarm
   *          shape can no longer reach `candidates` at all after the BP141 push-site fix, so in
   *          practice this collapses to hasStructuredCorroborator's own value today -- kept as a
   *          separate, explicitly-named field (rather than reusing structuredCorroborator) because
   *          the Coroner's classifyCore (answer_coroner.ts) reads plowTrace keys by exact camelCase
   *          name with no fallback, and this is the name that signal is meant to be read under. */
  independentCorroboration?: boolean;
  /** KN-BP144-5 T1/T3, OPTIONAL/ADDITIVE. Populated ONLY at the swarm-augmented agree-branch call
   *  site (the ONE place `specialist_swarm` can ever appear inside an agreeing 2+ group -- the
   *  fast path, before the swarm fires, can never produce this field since every candidate there
   *  is on its own distinct browser/Wolfram derivation path by construction). Records
   *  `assessAgreeingGroupDerivationDiversity`'s own verdict for whichever agreeing group was
   *  found, WHETHER OR NOT that verdict changed the outcome (a `swarmStructurallyDisagrees` early
   *  decline never reaches this assessment at all, so its absence there is itself meaningful).
   *  `agree_multipath` = accepted as today, genuine corroboration across 2+ distinct paths.
   *  `agree_singlepath` = declined -- the agreeing group, once RULE 1's own swarm-duplicate
   *  elimination is applied, collapses to a single surviving derivation path, which per T1 "is
   *  not corroboration" -- falls through to adjudication exactly as if the candidates had
   *  disagreed. Never a bare count (T3's own requirement) -- `agreeGroupPathAssignments` below
   *  carries the full `authority:path` breakdown per original agreeing-group member. */
  agreeDerivationVerdict?: 'agree_multipath' | 'agree_singlepath';
  /** KN-BP144-5 T3: `authority:derivationPath` for every member of the agreeing group this
   *  assessment ran over, in original order -- present whenever agreeDerivationVerdict is. */
  agreeGroupPathAssignments?: string[];
  /** KN-BP144-6 T1/T3, OPTIONAL/ADDITIVE. Records the outcome of this ticket's own attempt of
   *  solveNoConsensusFromScatter (the deterministic scatter-class solver -- the only one of this
   *  shape in this file today; see this field's own push-site comment for why no sibling exists to
   *  attempt alongside it) run BEFORE the swarm-augmented accept-on-agreement branch is reached.
   *  Set exactly once, immediately after that attempt runs (fired or declined), then threaded
   *  UNCHANGED into every return this function can reach after that point (the multipath accept,
   *  KN-BP144-5's own singlepath-decline recheck firing, THE CAKE METHOD's accept, THE CAKE
   *  METHOD's no-plurality abstain, and the final disagree fallthrough) -- so any reader of the
   *  eventual outcome can always see whether the earlier attempt fired, declined (`detail` always
   *  names the EXACT B1-B4 gate that failed -- never a bare "declined", T3's own explicit
   *  requirement), or the question's own option set made the solver not applicable at all (B1).
   *  Absent only when this function returned BEFORE reaching that call site -- the pseudocode/
   *  set-membership/deterministic-override-hoist/pre-swarm-scatter bypasses, or the pre-swarm
   *  fast-path accept, all still return earlier, byte-identical to before this ticket. */
  preAgreeDeterministicScatterAttempt?: {
    verdict: 'deterministic_attempted_fired' | 'deterministic_attempted_declined' | 'deterministic_not_applicable';
    solver: 'no_consensus_from_scatter';
    detail: string;
  };
  /** BP141-1 SINGLE-SOURCE-NO-GROUNDING GATE (Task 3, run 029 receipt, question_id 98), OPTIONAL/
   *  ADDITIVE. Populated ONLY at the exactly-one-candidate accept site (corroboration one of
   *  single_google/single_perplexity/single_wolfram/single_chatgpt/single_gemini/single_claude/
   *  single_specialist_swarm) -- absent for every other corroboration value, same presence-gate
   *  convention as structuredCorroborator (which is instead gated on corroboration==='agree').
   *
   *  THE PROBLEM (empirical, run 029, question_id 98): sources=[user_perplexity],
   *  allCandidates=[user_perplexity:G], candidatesPostFurnace=0, adjudicationAttempted=false -- a
   *  single unverified LLM opinion, with the specialist swarm having already fired (per the
   *  UNCERTAIN branch above) and found ZERO Furnace-verified grounding, was accepted at full
   *  confidence anyway (concordanceStrictness defaults to 'lenient', which always accepts a lone
   *  candidate -- see resolveConcordanceAcceptance's own truth table). That gate decides WHETHER a
   *  lone candidate is accepted at all; it was never designed to also decide HOW MUCH confidence
   *  that accept deserves.
   *
   *  true  = the accepted lone candidate is LLM-class (not itself a structured authority per
   *          hasStructuredCorroborator) AND the specialist swarm (already fired as part of the
   *          UNCERTAIN branch, regardless of whether its own letter became a candidate) found ZERO
   *          Furnace-verified grounding (candidatesPostFurnace === 0, or no swarmReceipt was ever
   *          produced) -- the exact run-029 q98 shape. Never causes an abstain or a letter change by
   *          itself (coverage stays protected, the letter is never silently altered) -- it exists
   *          purely so the trace can carry an honest "this rests on one unverified voice with zero
   *          grounding" signal forward to plowTrace/the Coroner, composing with (never duplicating)
   *          the existing concordanceStrictness accept/reject decision and the existing
   *          hasStructuredCorroborator/candidatesPostFurnace signals it is built from.
   *  false = the lone candidate IS itself a structured authority (wolfram_alpha, or a
   *          specialist_swarm candidate that by construction only ever reaches `candidates` with
   *          its own Furnace-verified grounding behind it), OR the swarm found real Furnace-verified
   *          facts anyway even though it did not itself become the accepted candidate -- either way,
   *          the accepted letter is not resting on bare unverified opinion alone. */
  singleSourceUngroundedAccept?: boolean;
  /** BP141-2 THE CAKE METHOD, OPTIONAL/ADDITIVE. True only when the N-Cut/N-Pick mechanism
   *  (runCakeMethodDisagreementResolution) actually ran for this question -- i.e. the ensemble's
   *  authorities still disagreed even with the swarm folded in. Absent on every accept path that
   *  never reached disagreement ('agree', any 'single_' source, or a deterministic-compute accept).
   *  Present alongside corroboration==='adjudicated' or 'disagree' (a Cake run that could not resolve a plurality
   *  still sets this true -- "we ran the mechanism honestly and it abstained" is a different
   *  signal than "we never ran it"). */
  cakeMethodUsed?: boolean;
  /** A9 (REVISED): model identity per CUT, harness-recorded (resolveCakeModelIdentity), in the
   *  same order as cutDerivations below. Informational only -- NOT the independence unit (see
   *  cutDerivations/distinctDerivationCount). */
  cutModels?: string[];
  /** A9 (REVISED): DERIVATION PATH per CUT, harness-recorded (resolveCakeDerivationPath /
   *  local-orchestrator route tag) -- THIS is the independence unit Task B's no-consensus solver
   *  gates on, per A10 (REVISED): "VARIANCE IS NOT INDEPENDENCE." */
  cutDerivations?: string[];
  /** A10 (REVISED): count of DISTINCT entries in cutDerivations. Task B's gate requires >= 3;
   *  below that, Task B must abstain regardless of letter scatter. */
  distinctDerivationCount?: number;
  /** A12: distinct LETTERS among the CUTS (before picking). */
  cutScatter?: number;
  /** A12: distinct LETTERS among the PICKS (after picking, A7's plurality tally input). */
  pickConvergence?: number;
  /** A12: the resulting quadrant label from resolveCakeQuadrant(cutScatter, pickConvergence,
   *  pickCount) -- 'scatter_resolved_by_pick' | 'scatter_persists_after_pick' |
   *  'no_real_cut_disagreement' | 'no_picks_available'. */
  cakeQuadrant?: string;
  /** A3/A5: the deterministic seed (computeAnonymizedOrderSeed(researchQuery)) used to build every
   *  picker's own per-picker shuffle this run -- present so a receipt can be independently
   *  re-derived/audited, never a secret. */
  anonymizedOrderSeed?: number;
  /** A4 blindness audit, amended (first amendment) to report PER PARTICIPANT rather than only in
   *  aggregate -- one picker favoring its own cut is the exact failure this whole mechanism exists
   *  to prevent, and an aggregate number can hide that. Populated ONLY when cakeMethodUsed is true.
   *  `pickedOwnLetterWithSelfPresent`/`pickedSameLetterWithSelfAbsent` are null when this picker had
   *  no own cut in the pool to test (should not normally occur for a picker who also cut). A rate
   *  at or near 100% true for pickedOwnLetterWithSelfPresent, across many real runs, is the mechanism
   *  LEAKING -- see this build's own verification report for the honest empirical measurement, never
   *  claimed as passing without it. */
  cakeSelfPreferenceAudit?: {
    pickerKey: string;
    derivationPath: CakeDerivationPath;
    ownLetter: string | null;
    pickedOwnLetterWithSelfPresent: boolean | null;
    pickedSameLetterWithSelfAbsent: boolean | null;
    /** KN-BP141-7 P3: alias of `ownLetter`, named to match this ticket's own audit vocabulary --
     *  the letter this SAME participant cut (null when it never cut, e.g. user_claude on a
     *  question where only user_perplexity/local_orchestrator cut). Byte-identical value to
     *  `ownLetter`, kept as a distinct field per Rule 66 (additive, never repurposing an existing
     *  name) rather than renaming `ownLetter` and breaking every existing reader of that field. */
    cutLetter: string | null;
    /** KN-BP141-7 P3: the letter this participant PICKED (its full-pool, self-present pick --
     *  same value as the corresponding entry in `cakePicks` for this pickerKey, duplicated here so
     *  a single audit-entry row carries cut+pick+judge-status together without a second lookup). */
    chosenLetter: string | null;
    /** KN-BP141-7 P3: true iff this picker ALSO cut on this question (ownLetter !== null) -- i.e.
     *  the judge was itself one of the original disputants. This is the exact condition the old
     *  single-Perplexity-judge design could never avoid (the judge always was a disputant); the
     *  Cake Method's whole point is that a judge who WAS a disputant is still checked (via this
     *  audit) rather than trusted blindly. Never undefined once cakeMethodUsed is true -- always
     *  a real boolean for every entry in this array. */
    judgeWasDisputant: boolean;
  }[];
  /** KN-BP141-7 P3: aggregate self-preference rate across every picker THIS run who had an own
   *  cut in the pool to test (i.e. every audit entry with pickedOwnLetterWithSelfPresent !== null)
   *  -- fraction (0..1) of those pickers who picked their own cut's letter when their own cut was
   *  present. null when no picker this run had an own cut to test (cakeSelfPreferenceAudit exists
   *  but every entry's own fields are null, e.g. every cut on this question came from a
   *  non-promptable source like specialist_swarm/user_google/wolfram/elimination_cascade and no
   *  picker's own root ever appeared in cutPool). Computed directly from real per-run data, never
   *  a scripted stand-in -- this is the field this ticket's P3 requires exist and populate. */
  cakeSelfPreferenceRate?: number | null;
  /** Verification-addition (BP141-2 Founder Correction): "report cut agreement broken down BY
   *  derivation path, so we can see whether two routes that agree did so independently or because
   *  they collapsed onto the same underlying retrieval" -- and, symmetrically, WHO picked WHAT, so
   *  the same breakdown is possible for the pick phase. Every real cut and every real pick this run,
   *  with its derivation path attached. */
  cakeCuts?: { pickerKey: string; derivationPath: CakeDerivationPath; letter: string }[];
  cakePicks?: { pickerKey: string; derivationPath: CakeDerivationPath; pickedLetter: string | null }[];
  /** KN-BP141-7 P2 (Founder-directed BP141, regression fix): a cut whose letter no picker shares
   *  is real surviving minority evidence, not noise -- plurality removes it from the final letter
   *  deterministically (N picks reading ONE pool are correlated, not N independent votes), but it
   *  must never be silently discarded from the trace. One entry per cut (not per distinct letter)
   *  whose letter never appears among any real pick this run, alongside chosenLetter/cutScatter/
   *  pickConvergence above so the Coroner can see exactly how often a correct-but-outvoted cut
   *  existed. Always present (as [] when nothing was overridden) whenever cakeMethodUsed is true --
   *  "on every Cake row," per this ticket's own requirement, never omitted when empty. */
  minorityCutsOverridden?: { letter: string; derivationPath: CakeDerivationPath }[];
  /** KN-BP141-7 P1 (Founder-directed BP141, regression fix): the picker-set/cutter-set invariant
   *  this run, computed from real cutPool/pickers data (never asserted blind) -- see
   *  runCakeMethodDisagreementResolution's own A6/A7 doc comment for the full rationale. Emitted on
   *  every Cake row so a defect (were the gating below ever weakened) is visible in the trace
   *  itself, not just in a thrown exception. `cuttersWithNoPick` is EXPECTED to be non-empty on
   *  most real questions (specialist_swarm/user_google/wolfram_alpha/elimination_cascade have no
   *  conversational pick interface by design -- see A7's own doc comment) and is not itself a
   *  defect; `pickersWithNoCut` must always be empty -- a non-empty value here would mean the
   *  invariant-enforcing filter below has a bug (it would already have thrown before reaching this
   *  point, since the same check is asserted as a hard error first). */
  cakePickerCutterInvariant?: {
    cutterRoots: string[];
    pickerRoots: string[];
    cuttersWithNoPick: string[];
    pickersWithNoCut: string[];
  };
  /** KN-BP141-7 P6 (Founder-directed BP141): the elimination cascade's C4 bidirectional-consistency
   *  candidate-producer result this run -- see runEliminationCascadeCandidateProducer's own doc
   *  comment for the full rationale. `attempted` is false only if the producer itself threw before
   *  either dispatch call completed (network/process failure, non-fatal to the rest of Cake).
   *  `candidateAddedToCutPool` mirrors exactly whether a cutPool entry with
   *  derivationPath==='deterministic_solver:elimination_cascade_c4' exists in `cakeCuts` above this
   *  run -- true only when `consistent` is true AND a non-empty ranking existed. Always present (as
   *  attempted:false when not reached) whenever cakeMethodUsed is true. */
  cascadeCandidateProducer?: {
    attempted: boolean;
    consistent: boolean;
    mostToLeast: string[];
    leastToMost: string[];
    candidateAddedToCutPool: boolean;
    trace: string;
  };
  /** KN-BP141-7 P6 (Founder-directed BP141): Gom Jabbar G5 "failure strikes the vote" computed for
   *  real from this run's own cascadeCandidateProducer result, but `applied` is HARD-CODED false --
   *  G5 stays DISABLED this pass per this ticket's own explicit instruction. Nothing in cutPool,
   *  picks, or chosenLetter above is ever changed by this field; it exists purely so the Coroner can
   *  see what G5 WOULD have stricken, without G5 actually striking anything. */
  gomJabbarG5Advisory?: {
    applied: false;
    wouldStrike: boolean;
    strickenSources: string[];
    admissibleSources: string[];
    tally: Record<string, number>;
    trace: string;
  };
  /** KN-BP144-12 Part B ("THE ELIMINATOR ABOVE AGREEMENT"), OPTIONAL/ADDITIVE. Populated ONLY when
   *  checkEliminatorConstraintAboveAgreement found an ACTIVE constraint (applied && !abstained)
   *  that excludes the letter an accept-on-agreement branch (fast-path structured, or swarm-
   *  augmented multipath) was about to return, and that branch VOIDED the accept instead --
   *  corroboration is 'disagree' on every return this field accompanies, chosenLetter is always
   *  null. `letter` is the letter that would have been accepted absent this check; `survivorsOut`
   *  is the eliminator's own surviving-option set at the moment of the void; `trace` is the SAME
   *  runRegisterResolutionStage trace array (register inference, verification check, predicate
   *  derivation, per-option matched/failed reason) KN-BP144-4's below-agreement call site already
   *  surfaces as `eliminatorTrace` -- named distinctly here (never conflated with that field)
   *  because this one fires BEFORE accept-on-agreement, not after it, and the two can in principle
   *  both be present on the same question's full trace lineage (this one first, then the
   *  below-agreement one re-deriving/re-checking against the full candidate pool once this return's
   *  'disagree' reaches runCanonicalPlowMcAnswer's cascadeAdjudicatorEngaged block). Absent for
   *  every accept that was never challenged by this check (constraintActive was false, or the
   *  accepted letter already survived) -- the overwhelming majority of real questions, since this
   *  eliminator's own curated CONCEPT_REGISTER_SIGNALS table applies to a "bias"-concept stem only
   *  (see checkEliminatorConstraintAboveAgreement's own header for the measured scope). */
  eliminatorAboveAgreementVoided?: {
    letter: string;
    survivorsOut: string[];
    trace: string[];
  };
}

/** BP1xx STRUCTURED-CORROBORATOR GATE: the ONE place that encodes "which authorities count as a
 *  non-LLM structured corroborator" -- see AuthorityEnsembleOutcome.structuredCorroborator's own
 *  doc comment above for the full classification rationale (incl. user_google as AMBIGUOUS,
 *  folded into "not sufficient" here). A specialist_swarm entry is only ever present in
 *  `candidates` when its own 3 voters already reached a genuine CONCORDANT consensus (see the
 *  HONESTY note at its push site in runAuthorityEnsemble), so its mere presence here is always
 *  honest structured backing, never a guess. deterministic_compute is included for completeness
 *  (it never actually reaches an 'agree'-corroboration return -- it always short-circuits via its
 *  own earlier, separate return -- but a future caller of this helper should not have to
 *  rediscover that). */
// 'deterministic_compute_reasoning_fact' is deliberately ABSENT from this set -- see that
// authority tag's own doc comment on AuthorityEnsembleCandidate above. As of BP-ECHO-NO-VOTE this
// tag is never even constructed as a `candidates` entry any more (the compute result it used to
// describe is now carried only via AuthorityEnsembleOutcome.reasoningFactComputeReceipt, outside
// `candidates` entirely), so this exclusion is now belt-and-suspenders / defense-in-depth rather
// than the operative guard -- kept so hasStructuredCorroborator() stays honest even if a future
// change ever reintroduces a candidate under this tag.
const STRUCTURED_AUTHORITIES = new Set<AuthorityEnsembleCandidate['authority']>([
  'wolfram_alpha', 'specialist_swarm', 'deterministic_compute',
]);
function hasStructuredCorroborator(group: AuthorityEnsembleCandidate[]): boolean {
  return group.some((c) => STRUCTURED_AUTHORITIES.has(c.authority));
}

/** KN-BP144-1 Phase 2 (Amendment 1, scoped to qids 66/72/85/105). "The cascade adjudicates
 *  candidateSOURCES, not option letters" -- see this ticket's own header diagnosis for why
 *  `specialist_swarm` and the line-7410 local 3-temperature self-vote are the SAME derivation
 *  path (`resolveCakeDerivationPath` maps both to the local Ollama model), so letting the
 *  self-vote decide AFTER `specialist_swarm` has already cast a dissenting vote inside
 *  `runAuthorityEnsemble` is the local model outvoting a genuinely independent browser
 *  authority with its own echo, not a second witness. This function is called ONCE, at the ONE
 *  placement the ticket names (2.1): after `runAuthorityEnsemble` has honestly fallen through
 *  with `corroboration: 'disagree'` (2+ real candidates, genuinely disagreeing letters, the
 *  swarm already folded in and THE CAKE METHOD already tried and failed to converge), and
 *  BEFORE the self-vote loop is allowed to run at all. It is NOT `runEliminationCascadeFormat
 *  IndependentFallback` (that eliminates answer OPTIONS A-J trying to produce an answer; this
 *  eliminates candidate SOURCES trying to decide which source to trust) -- see 2.3's explicit
 *  "what you must NOT do" list. It never touches `runCakeMethodDisagreementResolution` (already
 *  ran, already abstained honestly, upstream of this call) and never widens
 *  `answerType === 'computable'`'s gate (adjudicating between sources has nothing to do with the
 *  question's type).
 *
 *  ELIMINATION RULES, canon per the ticket 2.2, evaluated IN ORDER, never reordered, never a
 *  sixth rule invented:
 *
 *   RULE 1 (duplicate derivation path is eliminated, not counted twice): any candidate whose
 *     `resolveCakeDerivationPath` is `'swarm'` (today, only ever `specialist_swarm` -- see that
 *     function's own switch) is eliminated from this cascade WHENEVER at least one candidate on
 *     a genuinely different derivation path also survives. `specialist_swarm`'s vote and the
 *     about-to-be-skipped self-vote are the SAME witness (same local model, same path); letting
 *     it stand as a competing "second voice" against a real browser authority would double-count
 *     that one witness. This is the rule that does the real elimination work on 66/72/85/105's
 *     actual candidate sets (verified against the named 038 receipt -- see KN-BP144-1_REPORT.md);
 *     it can never fire on a lone `specialist_swarm` candidate (single_specialist_swarm, qid
 *     111's shape) because a lone candidate never reaches this function at all -- that is the
 *     ensemble's own ACCEPT return, upstream of this call site, out of Phase 2's scope per
 *     Amendment 1.
 *   RULE 2 (proven beats concordant): any surviving candidate whose per-candidate rooting tier
 *     (via `classifyCorroborationTier`/`isRooted`, rooting_rule.ts, BP142 canon -- reused
 *     verbatim, never a second classifier) is Tier 1/2 beats every surviving candidate that is
 *     not. Only a candidate whose `authority === 'deterministic_compute'` can ever reach Tier 1
 *     here (rooting_rule.ts's tier map has no branch for a bare browser/LLM/swarm authority tag)
 *     -- a real, honest, structural NO-OP for every one of 66/72/85/105's actual candidate sets
 *     (none carry that tag at this decision point; a `deterministic_compute` candidate always
 *     resolves at an earlier accept/override return, never reaching 'disagree') -- kept, not
 *     skipped, because the rule is canon and a future candidate set may differ.
 *   RULE 3 (a structured corroborator counts as structured only if genuinely independent, same
 *     duplicate-path test as rule 1, applied to `hasStructuredCorroborator`): checked for
 *     completeness/logging on whatever survives rules 1-2. Rule 1 already removed the only
 *     `STRUCTURED_AUTHORITIES` member that can ever reach this function's candidate set on a
 *     genuine 'disagree' (`specialist_swarm`, whenever a non-swarm co-survivor exists) -- so this
 *     is also a structural NO-OP for 66/72/85/105 today, logged honestly as such, kept for the
 *     same forward-compatibility reason as rule 2.
 *   RULE 4 (if exactly one candidate survives, it is the letter): read as one surviving DISTINCT
 *     LETTER, not one surviving candidate object -- two candidates on genuinely different
 *     derivation paths that already independently agree on the same letter (66/72/85/105's own
 *     shape, once rule 1 removes the dissenting swarm entry: two of {perplexity, claude} left,
 *     already agreeing) collapse to that one letter here. This is an explicit, flagged
 *     interpretive choice, not a sixth invented rule: the ticket's own worked expectation
 *     ("Expected: H, E, E" for 66/72/105) is only reachable this way -- 72 and 105 both leave
 *     TWO surviving candidate objects (perplexity+claude) that agree, and a literal
 *     candidate-count reading of rule 4 would force an ABSTAIN there, contradicting the ticket's
 *     own stated expectation. See KN-BP144-1_REPORT.md for this call, argued from the ticket's
 *     own self-consistency.
 *   RULE 5 (if more than one survives, or none does, ABSTAIN): more than one distinct letter
 *     survives rules 1-4, or every candidate was eliminated -- honest ABSTAIN, never falling back
 *     to the local self-vote to break the tie (that fallback is exactly the mechanism this
 *     function exists to preempt).
 *
 *  Returns `chosenLetter: null` for an honest ABSTAIN (rule 5) -- the caller must never treat
 *  that as "adjudicator did not run"; `cascadeEliminationLog` is always non-empty (one entry per
 *  rule) whenever this function is called at all. This function has NO knowledge of whether its
 *  own output is correct against any ground truth -- it is a pure, honest elimination over the
 *  candidates it is given, same discipline as every other solver tier in this file: never guess,
 *  report what actually survived.
 *
 *  Exported (same "extract into a small pure helper and test that" convention as
 *  resolveConcordanceAcceptance above -- zero I/O, zero Ollama/browser dependency, a plain
 *  AuthorityEnsembleCandidate[] in, a plain result out) specifically so this ticket's own
 *  Phase 2 verification gate can call the REAL compiled function against the real named
 *  receipt's candidate data, rather than a hand-reimplementation that could silently drift from
 *  what actually ships. Purely additive -- no existing caller's behavior changes by this becoming
 *  reachable from outside the module. */
// KN-BP144-5 T1: "runCandidateSourceCascadeAdjudicator already implements duplicate-derivation-path
// elimination. Reuse that logic. Do not write a second, divergent copy of it... there must be
// exactly one definition of 'these two candidates are the same witness.'" Extracted verbatim from
// RULE 1 below (zero behavior change at that call site -- see the refactor immediately following)
// so the NEW accept-on-agreement diversity test (assessAgreeingGroupDerivationDiversity, this
// ticket's own agree-branch call site) and RULE 1 itself share the exact same elimination: any
// candidate whose resolveCakeDerivationPath is 'swarm' is eliminated from `pool` whenever at least
// one candidate on a genuinely different derivation path also survives. specialist_swarm's vote
// and the about-to-be-skipped local self-vote are the SAME witness (same local model, same path);
// letting it stand as a competing "second voice" would double-count that one witness.
export function eliminateDuplicateSwarmDerivationPath(
  pool: readonly AuthorityEnsembleCandidate[],
): { survivors: AuthorityEnsembleCandidate[]; eliminated: AuthorityEnsembleCandidate[] } {
  const nonSwarmSurvivorExists = pool.some((c) => resolveCakeDerivationPath(c) !== 'swarm');
  const swarmEntries = pool.filter((c) => resolveCakeDerivationPath(c) === 'swarm');
  if (nonSwarmSurvivorExists && swarmEntries.length > 0) {
    return { survivors: pool.filter((c) => resolveCakeDerivationPath(c) !== 'swarm'), eliminated: swarmEntries };
  }
  return { survivors: [...pool], eliminated: [] };
}

// KN-BP144-5 T1/T3: the accept-on-agreement branch's own derivation-path diversity test, reusing
// eliminateDuplicateSwarmDerivationPath (the SAME test RULE 1 above implements -- no second,
// divergent copy). "Before accepting on agreement, test whether the agreeing group spans more
// than one derivation path. Agreeing group spans two or more distinct derivation paths: accept as
// it does today... Agreeing group is a single derivation path: this is not corroboration." T3:
// "Log the path assignment of every candidate in the agreeing group. A bare count fails this
// ticket" -- `pathAssignments` below carries exactly that, `authority:path` per original member,
// never a bare number.
export interface AgreeingGroupDiversityAssessment {
  verdict: 'agree_multipath' | 'agree_singlepath';
  /** The agreeing group after RULE 1's own swarm-duplicate elimination -- what actually remains
   *  to test for path diversity. */
  dedupedGroup: AuthorityEnsembleCandidate[];
  /** Distinct resolveCakeDerivationPath values surviving in dedupedGroup. Path COUNT, not
   *  candidate count -- two candidates on the same path are one entry here. */
  distinctPaths: string[];
  /** `authority:derivationPath` for every member of the ORIGINAL (pre-dedup) agreeing group, so a
   *  reader can see exactly which candidate was assigned which path without re-deriving it. */
  pathAssignments: string[];
}

export function assessAgreeingGroupDerivationDiversity(
  agreeingGroup: readonly AuthorityEnsembleCandidate[],
): AgreeingGroupDiversityAssessment {
  const { survivors: dedupedGroup } = eliminateDuplicateSwarmDerivationPath(agreeingGroup);
  const distinctPaths = [...new Set(dedupedGroup.map((c) => resolveCakeDerivationPath(c)))];
  const pathAssignments = agreeingGroup.map((c) => `${c.authority}:${resolveCakeDerivationPath(c)}`);
  return {
    verdict: distinctPaths.length >= 2 ? 'agree_multipath' : 'agree_singlepath',
    dedupedGroup,
    distinctPaths,
    pathAssignments,
  };
}

export function runCandidateSourceCascadeAdjudicator(
  candidates: readonly AuthorityEnsembleCandidate[],
): { chosenLetter: string | null; eliminationLog: string[]; survivingCandidates: AuthorityEnsembleCandidate[] } {
  const eliminationLog: string[] = [];
  let pool: AuthorityEnsembleCandidate[] = [...candidates];
  const describe = (group: AuthorityEnsembleCandidate[]): string =>
    group.length > 0 ? group.map((c) => `${c.authority}:${c.letter}`).join(', ') : 'none';

  // RULE 1 -- duplicate derivation path (specialist_swarm === the about-to-be-skipped local
  // self-vote, same model, same path). KN-BP144-5 T1: now the SAME shared helper the new
  // agree-branch diversity test below also calls -- see eliminateDuplicateSwarmDerivationPath's
  // own doc comment. This refactor changes nothing about this call site's behavior.
  const { survivors: poolAfterRule1, eliminated: swarmEntries } = eliminateDuplicateSwarmDerivationPath(pool);
  if (swarmEntries.length > 0) {
    pool = poolAfterRule1;
    eliminationLog.push(
      `RULE 1 (duplicate derivation path): eliminated [${describe(swarmEntries)}] -- derivation ` +
      `path 'swarm' is the SAME local model as the about-to-be-skipped self-vote fallthrough, and ` +
      `a genuinely different-path candidate survives ([${describe(pool)}]); not counted as a ` +
      `second independent witness.`,
    );
  } else {
    eliminationLog.push(
      `RULE 1 (duplicate derivation path): no-op -- ${pool.every((c) => resolveCakeDerivationPath(c) !== 'swarm')
        ? 'no candidate on the \'swarm\' derivation path is present'
        : 'the \'swarm\'-path candidate has no non-swarm co-survivor to be a duplicate of'} ` +
      `(pool=[${describe(pool)}]).`,
    );
  }

  // RULE 2 -- proven (Tier 1/2, rooting_rule.ts) beats concordant. Only a candidate tagged
  // 'deterministic_compute' can ever classify to a rooting tier here -- see this function's own
  // header for why that is an honest, non-inventive reuse of classifyCorroborationTier's
  // existing corroboration-string input contract, never a second tier classifier.
  const rooted = pool.filter((c) =>
    isRooted(classifyCorroborationTier(c.authority === 'deterministic_compute' ? 'deterministic_compute' : undefined)),
  );
  if (rooted.length > 0 && rooted.length < pool.length) {
    const demoted = pool.filter((c) => !rooted.includes(c));
    pool = rooted;
    eliminationLog.push(
      `RULE 2 (proven beats concordant): eliminated [${describe(demoted)}] -- outranked by a ` +
      `Tier 1/2 (ROOTED) candidate [${describe(rooted)}].`,
    );
  } else {
    eliminationLog.push(
      `RULE 2 (proven beats concordant): no-op -- no surviving candidate reaches isRooted() ` +
      `(pool=[${describe(pool)}]).`,
    );
  }

  // RULE 3 -- a structured corroborator counts as structured only if genuinely independent
  // (same duplicate-path test as rule 1).
  const structuredSurvivors = pool.filter((c) => hasStructuredCorroborator([c]));
  if (structuredSurvivors.length === 0) {
    eliminationLog.push('RULE 3 (structured corroborator independence): no-op -- no STRUCTURED_AUTHORITIES candidate survives rules 1-2.');
  } else {
    const structuredPaths = new Set(structuredSurvivors.map((c) => resolveCakeDerivationPath(c)));
    const nonStructuredPaths = new Set(pool.filter((c) => !hasStructuredCorroborator([c])).map((c) => resolveCakeDerivationPath(c)));
    const genuinelyIndependent = [...structuredPaths].every((p) => !nonStructuredPaths.has(p));
    eliminationLog.push(
      `RULE 3 (structured corroborator independence): [${describe(structuredSurvivors)}] is ` +
      `structured (STRUCTURED_AUTHORITIES) and ${genuinelyIndependent ? 'genuinely independent -- no-op' : 'NOT independent of a co-surviving path'} ` +
      `(rule 1 already resolved any duplicate-path conflict among today's survivors: pool=[${describe(pool)}]).`,
    );
  }

  // RULES 4/5 -- collapse survivors to distinct letters (see this function's header for why
  // "candidate" is read as "distinct surviving letter", an explicit, flagged interpretive call).
  const distinctLetters = [...new Set(pool.map((c) => c.letter))];
  if (distinctLetters.length === 1 && pool.length > 0) {
    const letter = distinctLetters[0]!;
    eliminationLog.push(
      `RULE 4 (exactly one distinct letter survives): ${letter}, backed by [${describe(pool)}] -- ` +
      `letterSource: cascade_adjudicated_unconstrained or _constrained, per the caller's own ` +
      `KN-BP144-4 eliminator-constraint state (this function has no knowledge of that state).`,
    );
    return { chosenLetter: letter, eliminationLog, survivingCandidates: pool };
  }
  eliminationLog.push(
    `RULE 5 (${distinctLetters.length === 0 ? 'no candidate survives' : `${distinctLetters.length} distinct letters survive [${distinctLetters.join(',')}]`}): ` +
    `ABSTAIN -- never falling back to the local self-vote to break this tie.`,
  );
  return { chosenLetter: null, eliminationLog, survivingCandidates: pool };
}

/** BP139 CONCORDANCE GATE -- pure decision function, zero I/O, fully unit-testable in isolation
 *  (see the Founder-directed compiled proof script for exactly this). This is the ONE place that
 *  decides whether an ensemble candidate group should be accepted, given the caller's
 *  concordanceStrictness setting. Extracted as a standalone pure helper (rather than inlined at
 *  the single call site below) specifically so it can be exercised with plain
 *  AuthorityEnsembleOutcome-shaped inputs, no browser/Ollama/network dependency, per the Founder's
 *  "extract into a small pure helper and test that" instruction.
 *
 *  Truth table (this IS the full spec -- every case is one line):
 *    - answerType === 'computable'            -> ALWAYS true. Corroboration count is NEVER the
 *      authority for a computable question -- the deterministic units-aware compute override
 *      (resolveDeterministicComputeOverride, fired by this function's one caller immediately
 *      after the ensemble returns a chosenLetter) is that authority, and it must keep its
 *      unconditional chance to win the math regardless of strictness. This is the "never apply
 *      this gate to a deterministic-compute result" requirement, satisfied structurally: if this
 *      always returns true for computable, the gate can never turn a computable ensemble letter
 *      into a rejection, so the override call downstream always still gets to run exactly as it
 *      does today.
 *    - strictness === 'lenient' (default, including undefined treated as 'lenient' by the caller)
 *      -> ALWAYS true. This is the byte-identical-to-today path -- the gate is a complete no-op.
 *    - strictness === 'require_two' -> true iff agreeingCandidates >= 2. A lone candidate
 *      (totalCandidates === 1, agreeingCandidates === 1) is always false here: 1 is never >= 2.
 *    - strictness === 'require_majority' -> true iff totalCandidates >= 2 AND agreeingCandidates
 *      is a STRICT majority (> half) of totalCandidates. The `totalCandidates >= 2` guard exists
 *      because "1 out of 1" is arithmetically > half (1 > 0.5) yet represents ZERO corroboration
 *      -- a single respondent can never itself satisfy a majority requirement, so this is
 *      explicit rather than relying on the arithmetic alone (which would wrongly accept a lone
 *      candidate under 'require_majority').
 *  Both non-lenient modes therefore agree on the one case this build's single call site actually
 *  exercises (totalCandidates===1, agreeingCandidates===1 -> false, honest reject) -- they only
 *  diverge for larger candidate pools (e.g. 2 agreeing out of 4 total: require_two accepts,
 *  require_majority does not), which is why both are kept as distinct, independently meaningful
 *  settings even though today's one call site cannot yet exercise that divergence. */
export function resolveConcordanceAcceptance(params: {
  answerType: AnswerType;
  strictness: ConcordanceStrictness;
  /** Total number of real candidates in the group under consideration (e.g. candidates.length
   *  at the lone-candidate call site -- always 1 there). */
  totalCandidates: number;
  /** Size of the largest same-letter agreeing subgroup (e.g. 1 at the lone-candidate call site,
   *  since the sole candidate trivially "agrees" with itself). */
  agreeingCandidates: number;
}): boolean {
  const { answerType, strictness, totalCandidates, agreeingCandidates } = params;
  if (answerType === 'computable') return true;
  if (strictness === 'require_two') return agreeingCandidates >= 2;
  if (strictness === 'require_majority') {
    return totalCandidates >= 2 && agreeingCandidates > totalCandidates / 2;
  }
  return true; // 'lenient' (and any unrecognized/legacy value) -- no-op, today's exact behavior.
}

// KN-BP142-8 (Founder-directed BP142): the Cake Method's CUT (local_orchestrator, 2 routes) and
// PICK (local_orchestrator) calls both ran on canonical_pipeline.ts's default OLLAMA_TIMEOUT_MS
// (30_000ms), exactly the gap KN-BP142-7's own commit comment named out of scope ("the Cake
// Method cascade-candidate-producer" and, by the same 30s-default reasoning, its cut/pick
// siblings). Live-verified this ticket, real llama3.3:70b, real compiled dist, qid 105
// (philosophy/Aristotle-incontinence) and qid 98 (other/world-region-density): with candidates=[]
// so only the local_orchestrator cut/pick path ran, EVERY ONE of the 4 callOllama calls (2 cuts
// x 2 questions) aborted at the 30_000ms budget with AbortSignal.timeout's TimeoutError -- zero
// cuts survived on either question, chosenLetter came back ABSTAIN on both, and the BP141
// Coffee's "correct letter never cut by ANY participant" finding on these exact two qids is,
// AT LEAST IN PART, this transport starvation, not a reasoning failure (see this ticket's own
// YOKE_RETURN for the full per-participant table and the (A)/(B)/(C) verdict).
//
// SIZING (measured, not guessed): re-run with the timeout ceiling raised to 300_000ms purely for
// measurement (never applied to production) showed real completion times of 31.8s-165.4s across
// the 6 real cut/pick calls this ticket exercised (qid105 CUT retrieval_first=165.4s,
// reasoning_first=43.3s, PICK=44.9s; qid98 CUT retrieval_first=67.1s, reasoning_first=31.8s,
// PICK=32.7s) -- a WIDER and more variable range than KN-BP142-7's own 93-113s ranking-call
// ceiling, consistent with this same file's canonical_pipeline.ts comment about single-GPU-host
// queuing variance. Applying KN-BP142-7's own "~1.6x headroom over the observed ceiling" rule to
// THIS measured ceiling (165.4s x ~1.6 = ~264.6s) and rounding up to a clean number gives
// 270_000ms (4.5 minutes) -- sized to the measured work, not chosen to force any particular
// outcome, and not the same numeric value as ELIMINATION_CASCADE_RANKING_TIMEOUT_MS (180_000ms)
// because that constant was sized to a different, faster workload (two full-ranking generations,
// not a single recall-then-answer or choose-among-anonymized-sources generation).
//
// This constant affects ONLY the two callOllama call sites inside
// runCakeMethodDisagreementResolution that pass it explicitly below (the local_orchestrator CUT
// loop and the local_orchestrator PICK's askPick) -- see callOllama's own doc comment in
// canonical_pipeline.ts for the full enumeration of every other call site this change does NOT
// affect, all of which keep their original budget (OLLAMA_TIMEOUT_MS 30_000ms, or
// ELIMINATION_CASCADE_RANKING_TIMEOUT_MS 180_000ms for the two ranking calls that already pass
// it) byte-for-byte. A timeout is a transport budget, not an acceptance threshold: this change
// touches ONLY how long callOllama waits for a response, never what counts as a correct or
// admissible cut/pick once a response arrives -- the Cake blind, the self-preference audit, the
// N-Cut/N-Pick structure, and every acceptance threshold in this file are byte-identical to
// before this change.
const CAKE_METHOD_TIMEOUT_MS = 270_000;

/** BP141-2 THE CAKE METHOD's live orchestrator -- replaces the old single-Perplexity-judge
 *  adjudication call entirely (buildAdjudicationPromptText, removed). Called ONLY from
 *  runAuthorityEnsemble's disagreement branch (the swarm has already been folded in and the
 *  authorities STILL disagree). Implements A6-A13 for the single-machine case:
 *
 *  A6 (ALL CUT): `candidates` (already gathered by the caller with no candidate pool in any of
 *  their prompts) are reused as cuts, plus a fresh local-orchestrator cut per assigned route
 *  (assignCakeRoutesRoundRobin -- on 1 machine this returns the full route pool, run sequentially,
 *  per A13's own "with 1 machine, run the routes sequentially in one box").
 *
 *  A7 (ALL PICK): every reachable picker (Perplexity always attempted; Claude/ChatGPT/Gemini if
 *  opt-in enabled; the local orchestrator) receives the SAME anonymized pool, in ITS OWN
 *  per-picker shuffle, in a fresh context (a brand-new runBrowserAuthorityLookup/callOllama call
 *  that never contains the cut exchange). Final letter is the plurality; ties abstain (A7).
 *
 *  A8 (orchestrator is mechanical): the orchestrator (this function) collects/anonymizes/
 *  distributes/tallies and ALSO participates as a cutter+picker like everyone else -- its own pick
 *  call is asserted blind exactly like every other picker's (assertCakeChoosePromptIsBlind), no
 *  special-cased leniency for "itself".
 *
 *  A4 (blindness audit, amended to per-participant): for every picker whose own cut is present in
 *  the pool, ALSO fires a second, fresh-context pick call against the SAME pool with that picker's
 *  own cut removed, and records whether the picked letter changed. This doubles the pick-phase
 *  network cost but is what makes cakeSelfPreferenceRate auditable per REAL run, not just at
 *  build time (A4's explicit requirement).
 *
 *  A11 (phase-independent timeouts): CUT and PICK are structurally separate try/catch'd steps per
 *  participant -- a participant whose PICK call fails/throws still keeps its already-recorded CUT
 *  (it simply contributes no vote to the tally), never voiding the question. */
export async function runCakeMethodDisagreementResolution(params: {
  researchQuery: string;
  mcOptions: McOption[];
  candidates: AuthorityEnsembleCandidate[];
  config: CanonicalPlowMcConfig;
  bridge: BrowserAuthorityBridge;
  browserLlmOverrides: ReturnType<typeof readBrowserLlmAuthorityEnableOverridesFromSettings>;
  log: (msg: string) => void;
}): Promise<{
  chosenLetter: string | null;
  acceptedCandidate: AuthorityEnsembleCandidate | null;
  cakeMethodUsed: true;
  cutModels: string[];
  cutDerivations: string[];
  distinctDerivationCount: number;
  cutScatter: number;
  pickConvergence: number;
  cakeQuadrant: string;
  anonymizedOrderSeed: number;
  cakeSelfPreferenceAudit: AuthorityEnsembleOutcome['cakeSelfPreferenceAudit'];
  cakeSelfPreferenceRate: AuthorityEnsembleOutcome['cakeSelfPreferenceRate'];
  cakeCuts: AuthorityEnsembleOutcome['cakeCuts'];
  cakePicks: AuthorityEnsembleOutcome['cakePicks'];
  minorityCutsOverridden: AuthorityEnsembleOutcome['minorityCutsOverridden'];
  cakePickerCutterInvariant: AuthorityEnsembleOutcome['cakePickerCutterInvariant'];
  cascadeCandidateProducer: AuthorityEnsembleOutcome['cascadeCandidateProducer'];
  gomJabbarG5Advisory: AuthorityEnsembleOutcome['gomJabbarG5Advisory'];
}> {
  const { researchQuery, mcOptions, candidates, config, bridge, browserLlmOverrides, log } = params;
  const seed = computeAnonymizedOrderSeed(researchQuery);

  // ── A6: build the CUT pool -- reuse existing cuts, add the local orchestrator's own ─────────
  const cutPool: CakeCutCandidate[] = candidates.map((c) => ({
    pickerKey: c.authority,
    derivationPath: resolveCakeDerivationPath(c),
    modelIdentity: resolveCakeModelIdentity(c),
    letter: c.letter,
    reasoning: c.reasoning,
  }));
  const cutTranscripts: string[] = candidates.map((c) => c.reasoning);
  const localRoutes = assignCakeRoutesRoundRobin(CAKE_LOCAL_ROUTE_POOL.length, seed);
  for (const route of localRoutes) {
    try {
      const cutPrompt = buildCakeCutPromptText(researchQuery, mcOptions, route);
      // KN-BP142-8: widened from the 30s default to CAKE_METHOD_TIMEOUT_MS (see that constant's
      // own doc comment above for the measured rationale) -- numPredict stays the pre-existing
      // default (256, unchanged) since only the transport budget was under-sized, not the token
      // budget.
      const raw = await callOllama(cutPrompt, config.ollamaBaseUrl, config.model, 0, 256, CAKE_METHOD_TIMEOUT_MS);
      cutTranscripts.push(cutPrompt, raw ?? '');
      const resolved = raw ? resolveAuthorityLetterMatch(raw, mcOptions) : null;
      if (resolved && raw) {
        // KN-BP141-7 P1 FIX (doubled-prefix bug): `route` is already a fully-qualified
        // CAKE_LOCAL_ROUTE_POOL entry, e.g. 'local_orchestrator:retrieval_first' -- it already
        // carries the 'local_orchestrator:' prefix. The old code below re-prepended it
        // (`local_orchestrator:${route}`), producing the doubled pickerKey
        // "local_orchestrator:local_orchestrator:retrieval_first" visible verbatim in run 032's
        // own receipt (qid 98 and qid 105 cakeCuts[].pickerKey). `route` IS the correct pickerKey
        // as-is -- it still starts with 'local_orchestrator:' so ownsCut()'s
        // `cutPickerKey.startsWith(pickerRootKey + ':')` check below continues to match the
        // 'local_orchestrator' picker root exactly as before; only the literal doubling is fixed.
        cutPool.push({
          pickerKey: route,
          derivationPath: route,
          modelIdentity: config.model,
          letter: resolved.letter,
          reasoning: raw,
        });
      }
      log(`cake-cut ${route}=${resolved ? `${resolved.letter}(${resolved.method})` : 'no-letter'}`);
    } catch (err) {
      log(`cake-cut ${route} threw (non-fatal, cut skipped): ${err}`);
    }
  }

  // KN-BP141-7 P6: elimination cascade wired as a CANDIDATE PRODUCER (never an eliminator) -- see
  // runEliminationCascadeCandidateProducer's own doc comment above for the full rationale and honest
  // scope. Fires unconditionally alongside the local-orchestrator cuts above; contributes at most one
  // additional cut, gated ONLY on C4's own bidirectional-consistency admissibility bar, never on
  // anything this file decides for it. Its pickerKey/derivationPath ('deterministic_solver:
  // elimination_cascade_c4') has no colon-root matching any real picker (user_perplexity/user_claude/
  // user_chatgpt/user_gemini/local_orchestrator), so it is correctly CUT-only below, same structural
  // reason specialist_swarm/user_google/wolfram_alpha already are (see A7's own doc comment above).
  let cascadeConsistencyResult: BidirectionalConsistencyResult | null = null;
  try {
    const { candidate, consistency } = await runEliminationCascadeCandidateProducer(researchQuery, mcOptions, config, log);
    cascadeConsistencyResult = consistency;
    if (candidate) {
      cutPool.push({
        pickerKey: candidate.derivationPath,
        derivationPath: candidate.derivationPath,
        modelIdentity: config.model,
        letter: candidate.letter,
        reasoning: candidate.reasoning,
      });
      log(`cake-cut ${candidate.derivationPath}=${candidate.letter} (KN-BP141-7 P6 cascade candidate, C4-consistent)`);
    } else {
      log('cake-cut elimination_cascade_c4 produced NO candidate this question (C4 inconsistent or empty ranking -- see its own admissibility bar, never a guessed candidate).');
    }
  } catch (err) {
    log(`cake-cut elimination_cascade_c4 threw (non-fatal, cut skipped): ${err}`);
  }

  const cutModels = cutPool.map((c) => c.modelIdentity);
  const cutDerivations = cutPool.map((c) => c.derivationPath);
  const distinctDerivationCount = new Set(cutDerivations).size;
  const cutScatter = new Set(cutPool.map((c) => c.letter)).size;
  const cakeCuts = cutPool.map((c) => ({ pickerKey: c.pickerKey, derivationPath: c.derivationPath, letter: c.letter }));

  // ── A3: anonymize + normalize (labels/order assigned per-picker below, never fixed here) ────
  const poolForChoose = cutPool.map((c) => ({
    pickerKey: c.pickerKey,
    letter: c.letter,
    rationale: normalizeCakeRationale(c.reasoning),
  }));
  function ownsCut(cutPickerKey: string, pickerRootKey: string): boolean {
    return cutPickerKey === pickerRootKey || cutPickerKey.startsWith(`${pickerRootKey}:`);
  }
  // KN-BP141-7 P1: the picker-set/cutter-set invariant's own root-key extraction -- the FIRST
  // colon-delimited segment of a cut's pickerKey is its "root" identity (e.g.
  // 'local_orchestrator:retrieval_first' -> 'local_orchestrator', 'user_perplexity' -> unchanged,
  // since it has no colon). Deliberately the SAME shape ownsCut() already tests
  // (`cutPickerKey.startsWith(pickerRootKey + ':')`), extracted as its own pure function so the
  // cutter-root-set below and the picker-gating below both use one identical definition of "root."
  function cakePickerRootKey(pickerKey: string): string {
    const i = pickerKey.indexOf(':');
    return i === -1 ? pickerKey : pickerKey.slice(0, i);
  }
  function buildLabeledPool(pool: typeof poolForChoose, pickerKey: string, suffix: string) {
    const shuffled = shuffleCakePoolForPicker(pool, seed, `${pickerKey}${suffix}`);
    return shuffled.map((c, i) => ({ label: `Source ${i + 1}`, letter: c.letter, rationale: c.rationale }));
  }

  // KN-BP141-7 P1 (Founder-directed BP141, regression fix -- PRIMARY DEFECT): the set of cutter
  // ROOT identities actually present in cutPool THIS question. Amendment A6/A7 requires ALL CUT
  // then ALL PICK -- "the picker set MUST equal the cutter set. A participant that did not cut
  // does not pick." Live receipt evidence (run 032, qid 105 and qid 98): user_claude picked on
  // both questions despite never appearing in cutPool at all -- it held no independent position of
  // its own, yet its pick counted equally against a picker (user_perplexity) who both cut AND
  // picked. Computed here, BEFORE the pickers array below, so every pickers.push() can be gated on
  // it (never the reverse -- gating AFTER construction would just be the same bug with an extra
  // step).
  const cutterRootKeys = new Set(cutPool.map((c) => cakePickerRootKey(c.pickerKey)));

  // ── A7: pickers -- every reachable, promptable participant THAT ALSO CUT. Google/Wolfram/
  //    swarm/elimination_cascade are CUT-only (no natural single-turn conversational "pick"
  //    interface) and are correctly absent from cutterRootKeys-gated pickers below for that
  //    structural reason, same as the pre-Cake judge was always Perplexity, never Google -- that
  //    is the ticket's own explicitly-allowed case ("a participant that cut but is unavailable at
  //    pick time keeps its cut in the pool and simply casts no pick... never silently dropped");
  //    it is NOT a licence for a picker with no cut at all to pick, which is the actual bug fixed
  //    by the `cutterRootKeys.has(...)` guard on every push below. ──────────────────────────────
  type Picker = { pickerKey: string; derivationPath: CakeDerivationPath; askPick: (p: string) => Promise<string | null> };
  const pickers: Picker[] = [];
  if (cutterRootKeys.has('user_perplexity')) {
    pickers.push({
      pickerKey: 'user_perplexity',
      derivationPath: 'browser:user_perplexity',
      askPick: async (p) => {
        const r = await runBrowserAuthorityLookup(p, { ...config, preferredAuthority: 'user_perplexity' }, bridge);
        return r ? r.fact : null;
      },
    });
  } else {
    log('cake-pick user_perplexity SKIPPED (KN-BP141-7 P1: no corresponding cut this question -- a participant that did not cut does not pick).');
  }
  const llmPickerNames: BrowserLlmAuthorityName[] = ['user_claude', 'user_chatgpt', 'user_gemini'];
  for (const llmName of llmPickerNames) {
    if (!isBrowserLlmAuthorityEnabled(llmName, browserLlmOverrides)) continue;
    if (!cutterRootKeys.has(llmName)) {
      log(`cake-pick ${llmName} SKIPPED (KN-BP141-7 P1: no corresponding cut this question -- a participant that did not cut does not pick).`);
      continue;
    }
    pickers.push({
      pickerKey: llmName,
      derivationPath: `browser:${llmName}`,
      askPick: async (p) => {
        const r = await runBrowserAuthorityLookup(
          p, { researchArmMode: true, researchArmBrowserAuthority: true, preferredAuthority: llmName }, bridge,
        );
        return r ? r.fact : null;
      },
    });
  }
  if (cutterRootKeys.has('local_orchestrator')) {
    pickers.push({
      pickerKey: 'local_orchestrator',
      derivationPath: 'local_orchestrator:pick',
      // KN-BP142-8: widened from the 30s default to CAKE_METHOD_TIMEOUT_MS, same rationale as the
      // CUT call site above.
      askPick: async (p) => callOllama(p, config.ollamaBaseUrl, config.model, 0, 256, CAKE_METHOD_TIMEOUT_MS),
    });
  } else {
    log('cake-pick local_orchestrator SKIPPED (KN-BP141-7 P1: no corresponding cut this question -- a participant that did not cut does not pick).');
  }

  // KN-BP141-7 P1: defensive, hard assertion -- every pickers.push() above is already gated on
  // cutterRootKeys, so this can only ever fire if a future edit reintroduces an ungated push. A
  // real defect here is surfaced loudly (thrown), never papered over, per this ticket's own
  // "assert this invariant... if the sets diverge, that is a defect to surface, never to paper
  // over" instruction.
  const pickerRootKeysForInvariant = new Set(pickers.map((p) => cakePickerRootKey(p.pickerKey)));
  const pickersWithNoCut = [...pickerRootKeysForInvariant].filter((r) => !cutterRootKeys.has(r));
  if (pickersWithNoCut.length > 0) {
    throw new Error(
      `CAKE METHOD INVARIANT VIOLATION (KN-BP141-7 P1): picker root(s) [${pickersWithNoCut.join(', ')}] ` +
      'have no corresponding cut in cutPool this question -- a participant that did not cut must never pick.',
    );
  }
  const cuttersWithNoPick = [...cutterRootKeys].filter((r) => !pickerRootKeysForInvariant.has(r));
  const cakePickerCutterInvariant: NonNullable<AuthorityEnsembleOutcome['cakePickerCutterInvariant']> = {
    cutterRoots: [...cutterRootKeys],
    pickerRoots: [...pickerRootKeysForInvariant],
    cuttersWithNoPick,
    pickersWithNoCut,
  };

  const picks: { pickerKey: string; derivationPath: CakeDerivationPath; pickedLetter: string | null }[] = [];
  const cakeSelfPreferenceAudit: NonNullable<AuthorityEnsembleOutcome['cakeSelfPreferenceAudit']> = [];

  for (const picker of pickers) {
    try {
      // A2/A8 fresh-context pick, full pool.
      const labeledFull = buildLabeledPool(poolForChoose, picker.pickerKey, '::pick');
      const choosePromptFull = buildCakeChoosePromptText(researchQuery, mcOptions, labeledFull);
      assertCakeChoosePromptIsBlind(choosePromptFull, cutTranscripts);
      const responseFull = await picker.askPick(choosePromptFull);
      const resolvedFull = responseFull ? resolveAuthorityLetterMatch(responseFull, mcOptions) : null;
      const thisPickedLetter = resolvedFull?.letter ?? null;
      picks.push({ pickerKey: picker.pickerKey, derivationPath: picker.derivationPath, pickedLetter: thisPickedLetter });
      log(`cake-pick ${picker.pickerKey}=${resolvedFull ? resolvedFull.letter : 'no-letter'}`);

      // A4 blindness audit -- fresh-context pick, own cut(s) removed, for THIS picker only.
      const poolWithoutSelf = poolForChoose.filter((c) => !ownsCut(c.pickerKey, picker.pickerKey));
      const ownCut = cutPool.find((c) => ownsCut(c.pickerKey, picker.pickerKey));
      if (ownCut && poolWithoutSelf.length !== poolForChoose.length) {
        const labeledNoSelf = buildLabeledPool(poolWithoutSelf, picker.pickerKey, '::audit_no_self');
        const choosePromptNoSelf = buildCakeChoosePromptText(researchQuery, mcOptions, labeledNoSelf);
        assertCakeChoosePromptIsBlind(choosePromptNoSelf, cutTranscripts);
        const responseNoSelf = await picker.askPick(choosePromptNoSelf);
        const resolvedNoSelf = responseNoSelf ? resolveAuthorityLetterMatch(responseNoSelf, mcOptions) : null;
        cakeSelfPreferenceAudit.push({
          pickerKey: picker.pickerKey,
          derivationPath: picker.derivationPath,
          ownLetter: ownCut.letter,
          pickedOwnLetterWithSelfPresent: resolvedFull ? resolvedFull.letter === ownCut.letter : null,
          pickedSameLetterWithSelfAbsent: resolvedNoSelf ? resolvedNoSelf.letter === ownCut.letter : null,
          // KN-BP141-7 P3: real, live-run values (never a scripted stand-in) -- see this ticket's
          // own AuthorityEnsembleOutcome.cakeSelfPreferenceAudit doc comment for why these three
          // fields exist alongside ownLetter/pickedOwnLetterWithSelfPresent/pickedSameLetterWithSelfAbsent.
          cutLetter: ownCut.letter,
          chosenLetter: thisPickedLetter,
          judgeWasDisputant: true,
        });
      } else {
        cakeSelfPreferenceAudit.push({
          pickerKey: picker.pickerKey,
          derivationPath: picker.derivationPath,
          ownLetter: null,
          pickedOwnLetterWithSelfPresent: null,
          pickedSameLetterWithSelfAbsent: null,
          cutLetter: null,
          chosenLetter: thisPickedLetter,
          judgeWasDisputant: false,
        });
      }
    } catch (err) {
      // A11: this picker's PICK failed/threw -- it keeps its already-recorded CUT (still in
      // cutPool/cakeCuts above), it simply contributes no vote to the tally below.
      log(`cake-pick ${picker.pickerKey} threw (non-fatal, pick skipped, cut retained): ${err}`);
    }
  }

  // KN-BP141-7 P3: cakeSelfPreferenceRate, the aggregate this ticket requires populate from a REAL
  // run -- fraction of pickers who had their own cut present in the pool and picked that SAME
  // letter. Denominator is only pickers who actually had an own cut to test (pickedOwnLetterWithSelfPresent
  // !== null); null (not 0) when no such picker existed this question, an honest "not measurable
  // here" rather than a fabricated 0%.
  const eligibleSelfPreferenceAudits = cakeSelfPreferenceAudit.filter((a) => a.pickedOwnLetterWithSelfPresent !== null);
  const selfPreferringCount = eligibleSelfPreferenceAudits.filter((a) => a.pickedOwnLetterWithSelfPresent === true).length;
  const cakeSelfPreferenceRate = eligibleSelfPreferenceAudits.length > 0
    ? selfPreferringCount / eligibleSelfPreferenceAudits.length
    : null;

  // KN-BP143-1 Defect 1: exclude every disputant's vote from the tally -- see
  // filterCakePicksToEligibleJudges's own doc comment. eligiblePicks can legitimately be empty
  // (every real picker in the current architecture always cut too, per the P1 invariant above),
  // in which case tallyCakePicksWithAbstain([]) honestly returns {chosenLetter: null,
  // pickConvergence: 0} -- an ABSTAIN, never a forced pick.
  const eligiblePicks = filterCakePicksToEligibleJudges(picks, cakeSelfPreferenceAudit);
  if (eligiblePicks.length < picks.length) {
    log(
      `cake-method: ${picks.length - eligiblePicks.length} of ${picks.length} pick(s) EXCLUDED as ` +
      `disputant judges (KN-BP143-1 Defect 1 -- an authority may not judge an adjudication it is ` +
      `itself a party to) -- eligible voters: [${eligiblePicks.map((p) => p.pickerKey).join(', ') || 'NONE'}].`,
    );
  }
  const { chosenLetter, pickConvergence } = tallyCakePicksWithAbstain(eligiblePicks.map((p) => p.pickedLetter));
  const cakeQuadrant = resolveCakeQuadrant(cutScatter, pickConvergence, picks.length);
  log(
    `cake-method result: chosenLetter=${chosenLetter ?? 'ABSTAIN'} cutScatter=${cutScatter} ` +
    `pickConvergence=${pickConvergence} distinctDerivationCount=${distinctDerivationCount} quadrant=${cakeQuadrant} ` +
    `cakeSelfPreferenceRate=${cakeSelfPreferenceRate === null ? 'n/a' : cakeSelfPreferenceRate.toFixed(3)}`,
  );

  // KN-BP141-7 P2 (Founder-directed BP141, regression fix): a cut whose letter no real pick shares
  // is real surviving minority evidence that plurality removed BY CONSTRUCTION (N picks reading
  // ONE anonymized pool are correlated, never N independent votes) -- retained here rather than
  // silently discarded. This is exactly what happened on qid 105 (run 032): the correct cut E
  // (user_perplexity) was never picked by anyone once user_claude and local_orchestrator (neither
  // of which held an independent E position -- user_claude never even cut) both picked A.
  const pickedLetters = new Set(picks.map((p) => p.pickedLetter).filter((l): l is string => l !== null));
  const minorityCutsOverridden = cutPool
    .filter((c) => c.letter !== chosenLetter && !pickedLetters.has(c.letter))
    .map((c) => ({ letter: c.letter, derivationPath: c.derivationPath }));

  // KN-BP141-7 P6: the cascade candidate producer's own trace, summarized for the outer receipt --
  // see AuthorityEnsembleOutcome.cascadeCandidateProducer's own doc comment for field meanings.
  const cascadeCandidateProducer: NonNullable<AuthorityEnsembleOutcome['cascadeCandidateProducer']> = cascadeConsistencyResult
    ? {
        attempted: true,
        consistent: cascadeConsistencyResult.consistent,
        mostToLeast: cascadeConsistencyResult.mostToLeast,
        leastToMost: cascadeConsistencyResult.leastToMost,
        candidateAddedToCutPool: cascadeConsistencyResult.consistent && cascadeConsistencyResult.mostToLeast.length > 0,
        trace: cascadeConsistencyResult.trace,
      }
    : {
        attempted: false,
        consistent: false,
        mostToLeast: [],
        leastToMost: [],
        candidateAddedToCutPool: false,
        trace: 'cascade candidate producer threw before either dispatch call completed -- see cake-cut log line.',
      };

  // KN-BP141-7 P6: Gom Jabbar G5 advisory-only wiring -- tallyVotesStrikingFailures is REAL, wired,
  // and computes a REAL admissible/stricken partition, but its result is NEVER applied to
  // chosenLetter, picks, or cutPool above (G5's "failure strikes the vote" stays DISABLED this pass,
  // per this ticket's own explicit instruction; `applied` below is hard-coded false, not a runtime
  // flag that could ever drift to true). The one vote evaluated is the cascade candidate producer's
  // own C4 result, the only source in this pool with a bidirectional-consistency verdict available.
  // When C4 failed, the candidate was already never added to cutPool above (see
  // runEliminationCascadeCandidateProducer), so there is nothing left for a real G5 to strike in
  // practice on that path -- this still records what G5 WOULD have done, honestly, for the trace,
  // rather than omitting the wiring because its real-world effect on this one candidate is currently
  // a no-op.
  const gomJabbarG5Advisory: NonNullable<AuthorityEnsembleOutcome['gomJabbarG5Advisory']> = (() => {
    if (!cascadeConsistencyResult) {
      return {
        applied: false,
        wouldStrike: false,
        strickenSources: [],
        admissibleSources: [],
        tally: {},
        trace: 'G5 ADVISORY: elimination cascade candidate producer did not run or threw -- no vote to evaluate.',
      };
    }
    const votes: GomJabbarVote[] = [{
      source: cascadeConsistencyResult.source,
      letter: cascadeConsistencyResult.mostToLeast[0] ?? '',
      admissible: cascadeConsistencyResult.consistent,
      failureReason: cascadeConsistencyResult.consistent ? undefined : 'C4 bidirectional consistency failed',
    }];
    const tallyResult = tallyVotesStrikingFailures(votes);
    return {
      applied: false,
      wouldStrike: tallyResult.strickenSources.length > 0,
      strickenSources: tallyResult.strickenSources,
      admissibleSources: tallyResult.admissibleSources,
      tally: tallyResult.tally,
      trace:
        `${tallyResult.trace} (KN-BP141-7 P6: ADVISORY ONLY, applied=false -- G5's strike never ` +
        'actually excludes anything from the real cutPool/pick/tally above.)',
    };
  })();
  log(`gom-jabbar-g5-advisory ${gomJabbarG5Advisory.trace}`);

  const acceptedCandidate: AuthorityEnsembleCandidate | null = chosenLetter
    ? {
        authority: 'cake_pick_plurality',
        letter: chosenLetter,
        reasoning:
          `Cake Method plurality pick ${chosenLetter} across ${picks.length} picker(s) ` +
          `[${picks.map((p) => `${p.pickerKey}:${p.pickedLetter ?? 'abstain'}`).join(', ')}], ` +
          `derived from ${cutPool.length} independent cut(s) ` +
          `[${cutPool.map((c) => `${c.pickerKey}:${c.letter}(${c.derivationPath})`).join(', ')}].`,
        sourceUrl: '',
        method: 'cake_method_plurality',
      }
    : null;

  return {
    chosenLetter,
    acceptedCandidate,
    cakeMethodUsed: true,
    cutModels,
    cutDerivations,
    distinctDerivationCount,
    cutScatter,
    pickConvergence,
    cakeQuadrant,
    anonymizedOrderSeed: seed,
    cakeSelfPreferenceAudit,
    cakeSelfPreferenceRate,
    cakeCuts,
    cakePicks: picks,
    minorityCutsOverridden,
    cakePickerCutterInvariant,
    cascadeCandidateProducer,
    gomJabbarG5Advisory,
  };
}

/** BP1xx Authority-Ensemble-swarm-fold-in: reuses the EXACT same specialist-swarm-to-voter
 *  machinery the main (post-ensemble) swarm+voter block further down in
 *  runCanonicalPlowMcAnswer() uses -- SPECIALIST_REGISTRY's staggered firing,
 *  BACKUP_ADAPTER_REGISTRY widening, the Miner weight/length filter, runSaladin's adversarial
 *  Furnace, buildMcArbitrationPrompt, the 3-temperature voter loop via callOllama, and
 *  computeLetterConcordance -- NOT a new swarm, a second call site for the same functions. Called
 *  ONLY from runAuthorityEnsemble's uncertain branch (single/disagree/none), so this only ever
 *  fires when the browser/Wolfram authority panel is NOT already a confident 2+ agreement.
 *  Deliberately narrower than the main pipeline's inline block: no relevance gate, no compute
 *  sidecar, no browser-fact injection -- those are separate opt-in Stages of the primary path;
 *  this helper's one job is "what would the specialist swarm's own consensus letter be", to feed
 *  the ensemble corroboration as one more candidate. Returns chosenLetter: null whenever the
 *  voters end up anything other than CONCORDANT, or every voter came back empty/unparseable --
 *  never a guessed letter (BR-007). */
async function runSpecialistSwarmConsensus(params: {
  researchQuery: string;
  domain: string;
  mcPromptWithSubstrate: string;
  config: CanonicalPlowMcConfig;
  widenerOperators: SpecialistName[];
  widenerBackupOperators: BackupSpecialistName[];
  onProgress?: (stage: string) => void;
  log: (msg: string) => void;
}): Promise<{
  chosenLetter: string | null;
  concordance: ConcordanceClass;
  voterLetters: (string | null)[];
  voterDiagnostics: VoterDiagnostic[];
  specialistsUsed: string[];
  candidatesRaw: number;
  candidatesPostMiner: number;
  candidatesPostFurnace: number;
}> {
  const { researchQuery, domain, mcPromptWithSubstrate, config, widenerOperators, widenerBackupOperators, onProgress, log } = params;
  const { ollamaBaseUrl, model, choiceCount, specialistKeys = {}, deepHarvest, maxEbletsPerQuestion, reasoningMode = false } = config;

  const effectiveSpecialistKeys: SpecialistKeys = deepHarvest
    ? { ...specialistKeys, maxResultsPerAdapter: specialistKeys.maxResultsPerAdapter ?? maxEbletsPerQuestion ?? 8 }
    : specialistKeys;
  const baseOperators = getOperatorsForDomain(domain);
  const effectiveOperators = [...new Set([...baseOperators, ...widenerOperators])];
  const effectiveBackupOperators = [...new Set(widenerBackupOperators)];

  // ── same 9(+widened)-specialist staggered swarm as the main pipeline ─────────────────────
  const allCandidates: CandidateEblet[] = [];
  const specialistsUsed: string[] = [];
  for (let i = 0; i < effectiveOperators.length; i++) {
    const specialistName = effectiveOperators[i];
    if (!specialistName) continue;
    if (i > 0) await new Promise<void>((resolve) => setTimeout(resolve, FIREGUARD_STAGGER_MS));
    onProgress?.(`ensemble-swarm-fire:${specialistName}`);
    try {
      const fn = SPECIALIST_REGISTRY[specialistName];
      const found = await fn(researchQuery, domain, effectiveSpecialistKeys);
      allCandidates.push(...found);
      specialistsUsed.push(specialistName);
    } catch { /* adapter error -- non-fatal, continue */ }
  }
  for (const backupName of effectiveBackupOperators) {
    const fn = BACKUP_ADAPTER_REGISTRY[backupName];
    if (!fn) continue;
    onProgress?.(`ensemble-swarm-fire:${backupName}`);
    try {
      const found = await fn(researchQuery);
      allCandidates.push(...found);
      specialistsUsed.push(backupName);
    } catch { /* adapter error -- non-fatal, continue */ }
  }
  const candidatesRaw = allCandidates.length;

  // ── Miner + Saladin/Furnace, same constants/functions as the main pipeline ───────────────
  const postMiner = allCandidates.filter(
    (c) => c.weight >= MINER_MIN_WEIGHT && c.content.length >= MINER_MIN_CONTENT_LEN,
  );
  const postFurnaceCap = deepHarvest ? (maxEbletsPerQuestion ?? 20) : 6;
  const { passed: saladinPassed } = await runSaladin(postMiner, ollamaBaseUrl, model);
  const postFurnace = saladinPassed.sort((a, b) => b.weight - a.weight).slice(0, postFurnaceCap);

  const factsForArbitration = postFurnace.length > 0 ? postFurnace : postMiner.slice(0, 3);
  if (factsForArbitration.length === 0) {
    log('ensemble-swarm: zero candidates survived Miner/Furnace -- no facts for voters, honest no-letter');
    return {
      chosenLetter: null, concordance: 'DISCORDANT', voterLetters: [], voterDiagnostics: [],
      specialistsUsed, candidatesRaw, candidatesPostMiner: postMiner.length, candidatesPostFurnace: postFurnace.length,
    };
  }

  // ── same 3-voter MC arbitration as the main pipeline ──────────────────────────────────────
  const factsContext = factsForArbitration
    .slice(0, 3)
    .map((c, i) => `[Source ${i + 1} -- ${c.source}]: ${c.content.slice(0, 300)}`)
    .join('\n\n');
  const arbitrationPrompt = buildMcArbitrationPrompt(factsContext, mcPromptWithSubstrate);
  const voterPrompt = reasoningMode ? buildReasoningVoterPrompt(arbitrationPrompt, choiceCount) : arbitrationPrompt;
  const numPredictForVoter = reasoningMode ? MC_VOTER_NUM_PREDICT_REASONING : MC_VOTER_NUM_PREDICT_DEFAULT;

  const voterLetters: (string | null)[] = [];
  const voterDiagnostics: VoterDiagnostic[] = [];
  for (const temp of MC_VOTER_TEMPERATURES) {
    const raw = await callOllama(voterPrompt, ollamaBaseUrl, model, temp, numPredictForVoter);
    if (raw === null || raw.trim().length === 0) {
      voterLetters.push(null);
      voterDiagnostics.push({ temperature: temp, status: 'empty_response', responseChars: raw?.length ?? 0, rawPreview: raw ?? '' });
      continue;
    }
    const letter = reasoningMode ? parseLetterFromReasoning(raw, choiceCount) : parseLetterLocal(raw, choiceCount);
    voterLetters.push(letter);
    voterDiagnostics.push({
      temperature: temp,
      status: letter !== null ? 'parsed_ok' : 'parse_failed',
      responseChars: raw.length,
      rawPreview: raw.slice(0, 200),
    });
  }
  const { concordance, chosenLetter } = computeLetterConcordance(voterLetters);
  onProgress?.(`ensemble-swarm-done:${chosenLetter ?? 'none'}`);
  log(
    `ensemble-swarm voters=[${voterLetters.join(',')}] concordance=${concordance} ` +
    `chosenLetter=${chosenLetter ?? 'none'} specialists=[${specialistsUsed.join(',')}] ` +
    `raw=${candidatesRaw} postMiner=${postMiner.length} postFurnace=${postFurnace.length}`,
  );

  return {
    chosenLetter, concordance, voterLetters, voterDiagnostics,
    specialistsUsed, candidatesRaw, candidatesPostMiner: postMiner.length, candidatesPostFurnace: postFurnace.length,
  };
}

/**
 * (retained for reference / future authorities) Honest not-wired placeholder. As of BP140-K4,
 * NO current BrowserLlmAuthorityName reaches this function anymore -- user_claude has had a real
 * bridge since the prior build pass (queryClaudeBrowserAuthority below), and user_chatgpt/
 * user_gemini now have their own real bridges too (queryChatGptBrowserAuthority/
 * queryGeminiBrowserAuthority below, wired through webview_preload.ts's new generic interactive
 * driver). Left in place, unexported and now uncalled by runAuthorityEnsemble's loop, as the
 * honest fallback shape a FUTURE fourth browser-LLM authority should copy on day one (mirrors
 * browser_authority_adapter.ts's createNotWiredBridge() convention exactly: NEVER fabricates a
 * fact/sourceUrl, NEVER throws, always resolves null with a labeled console note).
 */
async function queryBrowserLlmAuthorityNotWired(
  authority: BrowserLlmAuthorityName,
  _question: string,
): Promise<{ fact: string; sourceUrl: string } | null> {
  console.warn(
    `[plow_mc_answerer] ${authority} is ENABLED (opt-in confirmed) but has no live ` +
    'browser-scraping bridge wired this pass -- see BROWSER_LLM_AUTHORITY_METADATA/' +
    'queryBrowserLlmAuthorityNotWired doc comments. Returning null, never a fabricated result.',
  );
  return null;
}

/**
 * WIRED (this build pass): user_claude's real interactive browser bridge. Unlike
 * queryBrowserLlmAuthorityNotWired above (still the honest placeholder for user_chatgpt/
 * user_gemini, which have no live driver yet), this function reaches the SAME
 * runBrowserAuthorityLookup/BrowserAuthorityBridge plumbing user_google/user_perplexity already
 * use elsewhere in this file (see the Perplexity/Google block right above this ensemble's
 * browser-LLM loop) -- passing `preferredAuthority: 'user_claude'` routes through
 * index.ts's runBrowserAuthorityQueryFromMain() to the INTERACTIVE type->submit->wait->scrape
 * flow (webview_preload.ts's 'browser-authority-run-interactive-query' handler,
 * isInteractiveBrowserAuthority() in browser_authority_types.ts), instead of the static
 * query-URL DOM-scrape user_google/user_perplexity use.
 *
 * `researchArmMode`/`researchArmBrowserAuthority` are force-enabled INSIDE this call's own config
 * object (not read from CanonicalPlowMcConfig / global settings) because reaching this function
 * at all already required the SEPARATE, stricter BP139 premium/opt-in gate
 * (isBrowserLlmAuthorityEnabled('user_claude', ...)) to resolve true at this loop's call site --
 * that gate is user_claude's real, user-facing on/off switch; the two booleans here are only
 * satisfying runBrowserAuthorityLookup's own internal "was this reached deliberately" plumbing
 * check, not a second independent enablement path a user could flip on its own.
 *
 * Never fabricates: returns null in every case runBrowserAuthorityLookup/
 * runInteractiveBrowserAuthorityQuery do -- not signed in to claude.ai, composer not found,
 * typing/submit failed, or the streamed reply never stabilized before its own timeout. Bridge
 * failures are caught and logged non-fatally by this loop's own try/catch at the call site below,
 * exactly like every other authority in this ensemble.
 */
async function queryClaudeBrowserAuthority(
  question: string,
  mcOptionTexts: string[],
  bridge: BrowserAuthorityBridge,
): Promise<{ fact: string; sourceUrl: string } | null> {
  const result = await runBrowserAuthorityLookup(
    question,
    {
      researchArmMode: true,
      researchArmBrowserAuthority: true,
      preferredAuthority: 'user_claude',
      ...(mcOptionTexts.length > 0 ? { mcOptions: mcOptionTexts } : {}),
    },
    bridge,
  );
  return result ? { fact: result.fact, sourceUrl: result.sourceUrl } : null;
}

/**
 * BP140-K4 WIRED: user_chatgpt's real interactive browser bridge. Byte-for-byte the same shape
 * as queryClaudeBrowserAuthority above, just with `preferredAuthority: 'user_chatgpt'` --
 * routes through index.ts's runBrowserAuthorityQueryFromMain() ->
 * isInteractiveBrowserAuthority('user_chatgpt') (now true, browser_authority_types.ts) ->
 * webview_preload.ts's generic interactive driver (runGenericInteractiveQuery +
 * CHATGPT_DRIVER_CONFIG) instead of the Claude-specific hand-written driver. Same
 * "researchArmMode/researchArmBrowserAuthority force-enabled inside this call's own config
 * object" rationale as queryClaudeBrowserAuthority's own doc comment -- reaching this function at
 * all already required the separate, stricter isBrowserLlmAuthorityEnabled('user_chatgpt', ...)
 * gate at this loop's call site to resolve true. Never fabricates: returns null in every case
 * runBrowserAuthorityLookup/the interactive driver do (not signed in to chatgpt.com, composer not
 * found, typing/submit failed, or the streamed reply never stabilized before its own timeout).
 */
async function queryChatGptBrowserAuthority(
  question: string,
  mcOptionTexts: string[],
  bridge: BrowserAuthorityBridge,
): Promise<{ fact: string; sourceUrl: string } | null> {
  const result = await runBrowserAuthorityLookup(
    question,
    {
      researchArmMode: true,
      researchArmBrowserAuthority: true,
      preferredAuthority: 'user_chatgpt',
      ...(mcOptionTexts.length > 0 ? { mcOptions: mcOptionTexts } : {}),
    },
    bridge,
  );
  return result ? { fact: result.fact, sourceUrl: result.sourceUrl } : null;
}

/**
 * BP140-K4 WIRED: user_gemini's real interactive browser bridge. Same shape as
 * queryChatGptBrowserAuthority above, `preferredAuthority: 'user_gemini'` routes through
 * webview_preload.ts's GEMINI_DRIVER_CONFIG instead. Never fabricates, same honest-null
 * contract as every other browser-authority bridge in this file.
 */
async function queryGeminiBrowserAuthority(
  question: string,
  mcOptionTexts: string[],
  bridge: BrowserAuthorityBridge,
): Promise<{ fact: string; sourceUrl: string } | null> {
  const result = await runBrowserAuthorityLookup(
    question,
    {
      researchArmMode: true,
      researchArmBrowserAuthority: true,
      preferredAuthority: 'user_gemini',
      ...(mcOptionTexts.length > 0 ? { mcOptions: mcOptionTexts } : {}),
    },
    bridge,
  );
  return result ? { fact: result.fact, sourceUrl: result.sourceUrl } : null;
}

// KN-BP144-7 T1/T2: dispatch-observed siblings of the three queryXBrowserAuthority functions
// just above. PURELY ADDITIVE -- NEW functions, called from NO pre-existing site (only the
// ensemble's browser-LLM loop below, updated this same ticket); the three functions above are
// left byte-for-byte untouched and remain fully reachable/correct on their own (nothing calls
// them any more after this ticket, but deleting dead-but-correct code is out of this ticket's
// blast radius). Each is the exact same shape as its non-observed sibling, just threading through
// runBrowserAuthorityLookupObserved instead of runBrowserAuthorityLookup so the ensemble can
// record what dispatch level actually saw.
interface BrowserLlmAuthorityObservation {
  result: { fact: string; sourceUrl: string } | null;
  dispatchOutcome: BrowserAuthorityDispatchOutcome;
  raw: BrowserAuthorityRawExtraction | null;
}

async function queryClaudeBrowserAuthorityObserved(
  question: string,
  mcOptionTexts: string[],
  bridge: BrowserAuthorityBridge,
): Promise<BrowserLlmAuthorityObservation> {
  const observed = await runBrowserAuthorityLookupObserved(
    question,
    {
      researchArmMode: true,
      researchArmBrowserAuthority: true,
      preferredAuthority: 'user_claude',
      ...(mcOptionTexts.length > 0 ? { mcOptions: mcOptionTexts } : {}),
    },
    bridge,
  );
  return {
    result: observed.result ? { fact: observed.result.fact, sourceUrl: observed.result.sourceUrl } : null,
    dispatchOutcome: observed.dispatchOutcome,
    raw: observed.raw,
  };
}

async function queryChatGptBrowserAuthorityObserved(
  question: string,
  mcOptionTexts: string[],
  bridge: BrowserAuthorityBridge,
): Promise<BrowserLlmAuthorityObservation> {
  const observed = await runBrowserAuthorityLookupObserved(
    question,
    {
      researchArmMode: true,
      researchArmBrowserAuthority: true,
      preferredAuthority: 'user_chatgpt',
      ...(mcOptionTexts.length > 0 ? { mcOptions: mcOptionTexts } : {}),
    },
    bridge,
  );
  return {
    result: observed.result ? { fact: observed.result.fact, sourceUrl: observed.result.sourceUrl } : null,
    dispatchOutcome: observed.dispatchOutcome,
    raw: observed.raw,
  };
}

async function queryGeminiBrowserAuthorityObserved(
  question: string,
  mcOptionTexts: string[],
  bridge: BrowserAuthorityBridge,
): Promise<BrowserLlmAuthorityObservation> {
  const observed = await runBrowserAuthorityLookupObserved(
    question,
    {
      researchArmMode: true,
      researchArmBrowserAuthority: true,
      preferredAuthority: 'user_gemini',
      ...(mcOptionTexts.length > 0 ? { mcOptions: mcOptionTexts } : {}),
    },
    bridge,
  );
  return {
    result: observed.result ? { fact: observed.result.fact, sourceUrl: observed.result.sourceUrl } : null,
    dispatchOutcome: observed.dispatchOutcome,
    raw: observed.raw,
  };
}

/** BP141-1: reads GROUNDED Fact eblets straight from the live substrate (via the SAME
 *  loadAllVerifiedEblets() reader every other consumer of verified_eblets.jsonl already uses) --
 *  never invented, never a search-result echo. Filters to entries whose provenance carries the
 *  EXACT `vault_export:fact:` prefix vault_eblet_export.ts's buildExportRecord() stamps on a
 *  curated, human-ratified Fact-typed Vault eblet (`type: fact` frontmatter) -- see that file's own
 *  CLASS GATE for the full allow-list. An ordinary `component`/`whole_answer`-class eblet (a plain
 *  LLM-answered Q&A pair, or a curated Tool/reasoning fragment) NEVER qualifies here, by design:
 *  this is the ONE filter plow_mc_set_membership_solver.ts's own GATE 2 depends on to guarantee it
 *  is never handed a search-result echo dressed up as a "fact." Returns [] (never throws) when the
 *  substrate file is empty/missing or nothing qualifies -- an empty return is exactly what makes
 *  the set-membership solver honestly abstain on every question today (0 Fact-typed eblets
 *  currently exist in the live substrate, per vault_eblet_export.ts's own dry-run report). */
async function loadGroundedSetMembershipFacts(): Promise<GroundedFactEblet[]> {
  try {
    const all = await loadAllVerifiedEblets();
    return all
      .filter((e) => typeof e.provenance === 'string' && e.provenance.startsWith('vault_export:fact:'))
      .map((e) => ({ title: e.question, body: e.answer }));
  } catch (err) {
    console.warn(
      '[plow_mc_answerer] loadGroundedSetMembershipFacts: substrate read failed (non-fatal, ' +
      'solver will see zero facts -- honest abstain):', err,
    );
    return [];
  }
}

// KN-BP144-6 T3: read-only diagnostic mirror of solveNoConsensusFromScatter's own B1-B4 gates
// (plow_mc_no_consensus_solver.ts). Built SOLELY so a decline can be reported with the EXACT gate
// it failed ("never a bare 'declined'" -- this ticket's own explicit requirement). This file is
// the one file this ticket may edit, and the solver's own NO_CONSENSUS_PATTERNS/
// isNoConsensusOptionText are not exported from that module, so this is a deliberate, kept-in-
// sync-by-hand duplicate of that same 7-pattern list, FOR TRACE ATTRIBUTION ONLY. It never gates
// any accept/decline decision anywhere in this file -- every call site below branches exclusively
// on the REAL solveNoConsensusFromScatter's own return value (null or a result); this function is
// consulted only AFTER that real call already returned null, purely to name why it declined. If
// this mirror ever silently drifts out of sync with the solver's own patterns, the only possible
// consequence is an imprecise HUMAN-READABLE gate name in a log line -- never a behavior change
// anywhere in this file (the UNRESOLVED fallback below reports exactly that risk honestly rather
// than asserting a gate name this mirror cannot actually confirm).
const NO_CONSENSUS_PATTERNS_MIRROR: RegExp[] = [
  /\bthere is no specific\b/i,
  /\bthere is no single\b/i,
  /\bno single (correct )?(answer|consensus)\b/i,
  /\bno specific (correct )?(answer|consensus)\b/i,
  /\bthere is no consensus\b/i,
  /\bno consensus (exists|has been reached)\b/i,
  /\bno (universally |generally )?agreed[- ]upon\b/i,
];

// Exported for the same reason eliminateDuplicateSwarmDerivationPath/assessAgreeingGroupDerivationDiversity
// are (see those functions' own doc comments) -- purely additive, so this ticket's own real-dist
// verification script can exercise the exact diagnostic this file's traces rely on, no second copy.
export function diagnoseNoConsensusScatterDecline(
  options: McOption[],
  independentSources: IndependentSourceVote[],
): { notApplicable: boolean; detail: string } {
  const noConsensusOptions = options.filter((o) => NO_CONSENSUS_PATTERNS_MIRROR.some((re) => re.test(o.text)));
  if (noConsensusOptions.length === 0) {
    return { notApplicable: true, detail: 'B1: no option in this question asserts no-single-answer/no-consensus -- solver not applicable to this question shape' };
  }
  if (noConsensusOptions.length >= 2) {
    return {
      notApplicable: true,
      detail: `B1: ${noConsensusOptions.length} options match the no-consensus phrasing (ambiguous which is "the" one: [${noConsensusOptions.map((o) => o.letter).join(',')}]) -- solver not applicable`,
    };
  }
  const noConsensusOption = noConsensusOptions[0]!;
  const votesByPath = new Map<string, string>();
  for (const s of independentSources) {
    if (!s.derivationPath || !s.letter) continue;
    if (!votesByPath.has(s.derivationPath)) votesByPath.set(s.derivationPath, s.letter);
  }
  const distinctDerivationCount = votesByPath.size;
  const votesDescription = [...votesByPath.entries()].map(([p, l]) => `${p}:${l}`).join(', ');
  if (distinctDerivationCount < 3) {
    return { notApplicable: false, detail: `B2: only ${distinctDerivationCount} distinct derivation path(s) among independent sources (need >=3) -- votes=[${votesDescription}]` };
  }
  const letterCounts = new Map<string, number>();
  for (const letter of votesByPath.values()) letterCounts.set(letter, (letterCounts.get(letter) ?? 0) + 1);
  const distinctLetterCount = letterCounts.size;
  if (distinctLetterCount < 3) {
    return { notApplicable: false, detail: `B3: only ${distinctLetterCount} distinct letter(s) survive [${[...letterCounts.keys()].join(',')}] (need >=3) -- votes=[${votesDescription}]` };
  }
  let maxCount = 0;
  for (const c of letterCounts.values()) maxCount = Math.max(maxCount, c);
  if (maxCount * 2 > distinctDerivationCount) {
    const leaders = [...letterCounts.entries()].filter(([, c]) => c === maxCount).map(([l]) => l);
    return { notApplicable: false, detail: `B3: letter(s) [${leaders.join(',')}] hold a strict majority (${maxCount} of ${distinctDerivationCount} distinct-path votes) -- votes=[${votesDescription}]` };
  }
  const pluralityLeaders = [...letterCounts.entries()].filter(([, c]) => c === maxCount).map(([l]) => l);
  if (pluralityLeaders.includes(noConsensusOption.letter)) {
    return {
      notApplicable: false,
      detail: `B4: no-consensus option's own letter ${noConsensusOption.letter} is itself among the plurality leader(s) [${pluralityLeaders.join(',')}] -- scatter corroborates that letter, not "no consensus"`,
    };
  }
  return {
    notApplicable: false,
    detail: `UNRESOLVED: this diagnostic mirror reads B1-B4 as all passing, but the real solveNoConsensusFromScatter call still returned null -- reporting the mismatch honestly rather than asserting a gate name this mirror cannot actually confirm (votes=[${votesDescription}], no_consensus_option=${noConsensusOption.letter})`,
  };
}

/** KN-BP144-7 T2: the ONE parse-level choke point that turns a dispatch-level observation plus
 *  "did resolveAuthorityLetterMatch find a letter" into the closed 7-value vocabulary, shared by
 *  every one of the five browser-authority call sites inside runAuthorityEnsemble below (never
 *  re-derived per-authority, so the classification logic cannot diverge the way T1's own
 *  rationale warns against). Pure, no I/O:
 *   - dispatchOutcome !== 'dispatched' (disabled/not_signed_in/timeout/no_result): that IS the
 *     final outcome, unchanged -- dispatch level already observed something more specific than
 *     this leg could ever re-derive, so it is passed through verbatim, never overwritten.
 *   - dispatchOutcome === 'dispatched' but `result` is null: a genuine raw extraction came back
 *     but distillExtraction() itself rejected it (empty/whitespace-only snippet, or no
 *     sourceUrl) -- "asked, returned successfully, produced nothing usable" is T1's own literal
 *     definition of 'no_result'.
 *   - dispatchOutcome === 'dispatched', `result` non-null, parsedOk true: 'answered'.
 *   - dispatchOutcome === 'dispatched', `result` non-null, parsedOk false: 'parse_failed', with
 *     T3's required first-200-chars preview of result.fact -- the genuinely-returned, genuinely-
 *     distilled text resolveAuthorityLetterMatch was unable to extract a letter from. */
function resolveEnsembleAttemptOutcome(
  observed: { dispatchOutcome: BrowserAuthorityDispatchOutcome; result: { fact: string } | null },
  parsedOk: boolean,
): BrowserAuthorityAttemptRecord {
  if (observed.dispatchOutcome !== 'dispatched') {
    return { outcome: observed.dispatchOutcome };
  }
  if (!observed.result) {
    return { outcome: 'no_result' };
  }
  if (parsedOk) {
    return { outcome: 'answered' };
  }
  return { outcome: 'parse_failed', rawPreview: truncateAuthorityPreview(observed.result.fact) };
}

// ── KN-BP144-12 Part B ("THE ELIMINATOR ABOVE AGREEMENT") ──────────────────────────────────────
//
// The rule (established KN-BP144-4, unchanged here): an eliminator produces a CONSTRAINT; an
// adjudicator produces a CHOICE; a choice that violates a constraint is invalid. Consensus is
// just a choice with more voices behind it -- it does not override a constraint.
//
// KN-BP144-4 already gave the register-resolution eliminator (runRegisterResolutionStage,
// KN-BP144-2 Phase 2, never edited -- called only, per that ticket's own A5 refusal, unchanged
// here) a reachable entry point BELOW accept-on-agreement: it only ever runs once
// runAuthorityEnsemble has already returned corroboration:'disagree' and control has reached
// runCanonicalPlowMcAnswer's cascadeAdjudicatorEngaged block, far downstream. By construction it
// can never see (or void) an agreement that was already accepted and returned upstream of that
// point. This function is the SAME eliminator (Stage 1 chaining via runEliminationChart, cheap
// sync Pass 1 first, live-verification Pass 2 only when Pass 1 finds a real registerCandidate --
// byte-identical two-pass convention to KN-BP144-4's own below-agreement call site, duplicated
// rather than hoisted so neither call site's behavior depends on the other ever having run),
// given a SECOND, EARLIER entry point -- called from INSIDE the accept-on-agreement branches
// below, BEFORE either one is allowed to return an accept.
//
// This function never decides an answer and never filters a candidate list itself -- it only
// ever produces (or withholds) a constraint, exactly like its below-agreement twin. Its callers
// (the two accept-on-agreement branches below) are the ones that decide whether the letter they
// are about to accept survives that constraint.
//
// MEASURED SCOPE (KN-BP144-12 Phase 0 + this ticket's own probe, scratchpad/kn_bp144_12_partB_
// probe_all20.mjs, all 20 real standing corpus questions): runRegisterResolutionStage's own
// CONCEPT_REGISTER_SIGNALS table (untouched, still curates "bias" only, per the refusal against
// editing plow_mc_elimination_cascade.ts) makes Pass 1 return applied:true for exactly ONE of the
// 20 real questions (qid 85, a "bias" definitional stem) and applied:false (a structural no-op,
// constraintActive always false) for the other 19 -- including qid 98, whose stem ("which world
// region is NOT considered densely populated") names no defect/virtue concept at all and so can
// never reach this eliminator's curated domain, regardless of where in the pipeline it is called
// from. This is reported honestly in this ticket's own report rather than papered over: this
// function is a correct, reachable, no-new-mechanism reuse of the existing eliminator, not a
// guarantee that the existing eliminator's narrow curated domain happens to cover every question
// this ticket named.
async function checkEliminatorConstraintAboveAgreement(
  researchQuery: string,
  mcOptions: McOption[],
): Promise<{ constraintActive: boolean; survivorsOut: string[]; trace: string[] }> {
  let stage1Survivors: string[] = mcOptions.map((o) => o.letter);
  try {
    stage1Survivors = runEliminationChart(researchQuery, mcOptions).survivors;
  } catch (err) {
    console.warn(
      '[plow_mc_answerer] KN-BP144-12 Part B: Stage 1 (runEliminationChart) threw ahead of the ' +
      'above-agreement eliminator check (non-fatal, falling back to the full option set):', err,
    );
  }
  const probe = runRegisterResolutionStage(researchQuery, mcOptions, stage1Survivors, null);
  let result: RegisterResolutionStageResult = probe;
  if (probe.applied && probe.registerCandidate) {
    // PASS 2: mirrors KN-BP144-4's own real-bridge-construction pattern verbatim (see that call
    // site, far below, for the identical dynamic-import mechanism) -- constructed locally here
    // because that call site's own browserBridge/Stage-F2 bridge is out of scope this early in
    // the pipeline. Never fabricated: a missing/failed bridge, or a lookup that returns nothing
    // usable, leaves liveVerification null and the second call abstains exactly as
    // runRegisterResolutionStage's own mandatory-verification-or-abstain contract requires.
    let liveVerification: RegisterVerificationLookup | null = null;
    const verificationQuery = `what is ${probe.concept!} in ${probe.registerCandidate.register}`;
    const eliminatorBridge: BrowserAuthorityBridge = {
      async runQueryInUserBrowser(query) {
        try {
          const mainModule = await import('../index');
          return await mainModule.runBrowserAuthorityQueryFromMain(query);
        } catch (err) {
          console.warn(
            '[plow_mc_answerer] KN-BP144-12 Part B above-agreement eliminator verification ' +
            'bridge call failed (non-fatal, honest null):', err,
          );
          return null;
        }
      },
    };
    try {
      const rawFact = await getRawBrowserAuthorityFact(
        verificationQuery,
        { researchArmMode: true, researchArmBrowserAuthority: true, preferredAuthority: 'user_perplexity' },
        eliminatorBridge,
      );
      if (rawFact && rawFact.fact) {
        liveVerification = {
          query: verificationQuery,
          definitionText: rawFact.fact,
          registerClaimed: probe.registerCandidate.register,
          source: rawFact.authority,
        };
      }
    } catch (err) {
      console.warn(
        '[plow_mc_answerer] KN-BP144-12 Part B above-agreement eliminator verification lookup ' +
        'threw (non-fatal, eliminator abstains):', err,
      );
    }
    result = runRegisterResolutionStage(researchQuery, mcOptions, stage1Survivors, liveVerification);
  }
  // Mirrors KN-BP144-4 A3's fourth bullet exactly: applied-and-abstained (or never applied) is NO
  // CONSTRAINT AT ALL -- only applied && !abstained is a real constraint worth checking a letter
  // against.
  const constraintActive = result.applied && !result.abstained;
  return { constraintActive, survivorsOut: result.survivorsOut, trace: result.trace };
}

/** Runs the full ensemble for one question: queries every free authority available for
 *  `answerType`, resolves each via resolveAuthorityLetterMatch (Wolfram via a direct computed-
 *  value match against the options instead, since it never returns free text), and corroborates
 *  per this section's own header doc. Sequential throughout (never Promise.all) --
 *  runBrowserAuthorityQueryFromMain() (index.ts) guards a single shared <webview>, the same
 *  discipline every other browser-authority call site in this file already follows. Never
 *  throws: every per-authority call is individually try/caught, a failure just means that
 *  authority contributes no candidate (honest, not fatal). When the browser/Wolfram panel is NOT
 *  already a confident 2+ agreement, fires runSpecialistSwarmConsensus() (above) as ONE MORE
 *  corroborating candidate before making its final accept/adjudicate/abstain decision -- see the
 *  section header comment above buildAdjudicationPromptText for the full corroboration policy. */
async function runAuthorityEnsemble(params: {
  researchQuery: string;
  mcOptions: McOption[];
  mcOptionTexts: string[];
  config: CanonicalPlowMcConfig;
  bridge: BrowserAuthorityBridge;
  answerType: AnswerType;
  domain: string;
  mcPromptWithSubstrate: string;
  widenerOperators: SpecialistName[];
  widenerBackupOperators: BackupSpecialistName[];
  onProgress?: (stage: string) => void;
  log: (msg: string) => void;
}): Promise<AuthorityEnsembleOutcome> {
  const {
    researchQuery, mcOptions, mcOptionTexts, config, bridge, answerType,
    domain, mcPromptWithSubstrate, widenerOperators, widenerBackupOperators, onProgress, log,
  } = params;
  const candidates: AuthorityEnsembleCandidate[] = [];
  // KN-BP144-7 T1-T3 ("Make The Silent Authorities Loud"): the per-question closed-vocabulary
  // attempt-outcome record for all five browser authorities plus the swarm. Uses the caller-
  // supplied sink (mutated IN PLACE, never reassigned, so the caller's own reference stays live
  // after this function returns) when config.authorityOutcomesSink is present; otherwise creates
  // a fresh all-'not_attempted' map that is simply discarded -- byte-identical extra work (six
  // cheap object-literal writes at most) for every pre-KN-BP144-7 caller that never sets that
  // field. PURELY ADDITIVE: `authorityOutcomes` is never read by any line below that decides
  // `candidates`, `chosenLetter`, or `corroboration` -- see each write site's own comment.
  const authorityOutcomes: BrowserAuthorityAttemptOutcomes =
    config.authorityOutcomesSink ?? createDefaultAuthorityAttemptOutcomes();
  // BP-ECHO-NO-VOTE: set ONLY inside the pre-branch hoist check below (det.source === 'reasoning_fact'
  // case) -- see AuthorityEnsembleOutcome.reasoningFactComputeReceipt's own doc comment for why
  // this is threaded through every return below INSTEAD OF being pushed into `candidates`.
  let reasoningFactComputeReceipt: AuthorityEnsembleOutcome['reasoningFactComputeReceipt'];

  // ── BP-PSEUDOCODE-TRACE-ANSWER-TYPE-BYPASS (root cause fix, run 028 receipt): the pseudocode-
  // trace solver (plow_mc_pseudocode_trace_solver.ts) is a registered tier INSIDE
  // resolveDeterministicComputeOverride below, but that function is only ever called from this
  // file when `answerType === 'computable'` (see the two gated call sites: the pre-branch hoist
  // just below this block, and the post-branch Stage F2 site in the caller). The AP-CSP "which
  // code segment produces newList" question class this solver targets contains no numbers at
  // all, so answer_type_classifier.ts files it as 'reasoning', not 'computable' -- the entire
  // deterministic-compute chain (including this solver) is skipped, the question goes to a vote,
  // and a conflicted adjudicator can pick the wrong letter even when the swarm already had the
  // right one (live receipt: candidates [user_perplexity:A, user_claude:A, specialist_swarm:C],
  // correct answer C, adjudicator picked A).
  //
  // FIX: this solver's own gate (ASK_RE + PROCEDURE_TABLE_RE + WORKED_EXAMPLE_RE + exact-procedure-
  // set + "every option parses and EXACTLY ONE evaluates to the worked example's own stated
  // output") is strict enough to BE its own classifier -- it is pure/synchronous, derives strictly
  // from `researchQuery` + `mcOptions` (never from any authority's reasoning), and cannot produce
  // a wrong answer on a non-matching question (any missing/ambiguous/multi-match piece is an
  // honest null). So it is invoked here, UNCONDITIONALLY on answerType, before ANY authority is
  // even consulted (before Perplexity/Google/browser-LLM below) -- a proved answer short-circuits
  // the whole ensemble; a null falls through to the EXISTING branching, byte-for-byte unchanged.
  // Never widens the solver's own gate, never touches the answer-type classifier itself.
  try {
    const pseudocodeTrace = solvePseudocodeTraceProblem(researchQuery, mcOptions);
    if (pseudocodeTrace) {
      log(
        `pseudocode_trace PROVED answer ${pseudocodeTrace.letter} by executing the question's own ` +
        `procedures -- ensemble not consulted (answerType=${answerType}, ${pseudocodeTrace.trace}).`,
      );
      return {
        chosenLetter: pseudocodeTrace.letter,
        corroboration: 'deterministic_compute',
        candidates,
        acceptedCandidates: [{
          authority: 'deterministic_compute',
          letter: pseudocodeTrace.letter,
          reasoning: pseudocodeTrace.trace,
          sourceUrl: '',
          method: 'pseudocode_trace',
        }],
        adjudicationAttempted: false,
        swarmFired: false,
        deterministicOverride: {
          letter: pseudocodeTrace.letter,
          optionValue: NaN,
          optionUnit: null,
          computedValue: NaN,
          computedUnit: null,
          sourceExpression: pseudocodeTrace.trace,
          source: 'question_expression',
          method: 'pseudocode_trace',
          // KN-BP143-1b: the procedures table, the worked example, AND every option's own code
          // segment are all stated verbatim in the question text (this solver's own gate --
          // ASK_RE + PROCEDURE_TABLE_RE + WORKED_EXAMPLE_RE -- requires all three to be present).
          // Execution is deterministic (no model call); the operands being executed are the
          // question's own procedures against the question's own worked example. literal_expression.
          computeProvenance: 'literal_expression',
          computeProvenanceDetail:
            'Procedure definitions, worked example, and every option\'s own code segment are all ' +
            'read verbatim from the question text; the answer is which option\'s procedures, ' +
            'executed exactly as stated, reproduce the worked example\'s own stated output -- no ' +
            'operand from any authority\'s reasoning or a model sample.',
        },
      };
    }
  } catch (err) {
    log(`pseudocode_trace threw (non-fatal, ensemble continues normally): ${err}`);
  }

  // ── BP141-1 SET-MEMBERSHIP-ANSWER-TYPE-BYPASS (run 029 receipt, question_id 98): mirrors the
  // pseudocode-trace bypass immediately above -- "which of the following X is/is NOT
  // considered/a member of/one of/included in/part of <SET>" carries no numbers at all, so
  // answer_type_classifier.ts files it 'reasoning', not 'computable', and the entire
  // deterministic-compute chain (including this solver, ALSO registered as a tier inside
  // resolveDeterministicComputeOverride below) would otherwise never even be consulted -- the
  // question goes straight to a vote, and a single unverified LLM authority (run 029: lone
  // user_perplexity, candidatesPostFurnace=0) can decide it at face value.
  //
  // THE FIX applied here is the same one BP-PSEUDOCODE-TRACE-ANSWER-TYPE-BYPASS already
  // established: this solver's own GATE (ASK_RE + a GROUNDED Fact eblet actually present in the
  // live substrate + every option resolving + exactly one option satisfying the asked polarity) is
  // strict enough to BE its own classifier -- it is pure/synchronous given its inputs, derives
  // strictly from `researchQuery` + `mcOptions` + the live substrate's own curated Fact eblets
  // (NEVER from any authority's reasoning, NEVER from a search-result echo), and cannot produce a
  // wrong answer on a non-matching question (any missing/ambiguous/multi-match/ungrounded piece is
  // an honest null). So it is invoked here, UNCONDITIONALLY on answerType, before ANY authority is
  // even consulted -- a proved answer short-circuits the whole ensemble; a null (the expected
  // outcome on TODAY's substrate -- zero Fact-typed eblets exist yet, see
  // loadGroundedSetMembershipFacts()'s own doc comment) falls through to the EXISTING branching,
  // byte-for-byte unchanged. Never widens the solver's own gate, never touches the answer-type
  // classifier itself.
  try {
    const groundedFactsForSetMembership = await loadGroundedSetMembershipFacts();
    const setMembership = solveSetMembershipProblem(researchQuery, mcOptions, groundedFactsForSetMembership);
    if (setMembership) {
      log(
        `set_membership PROVED answer ${setMembership.letter} against a grounded Fact eblet in the ` +
        `live substrate -- ensemble not consulted (answerType=${answerType}, ${setMembership.trace}).`,
      );
      // KN-BP143-1b CONSUMER AUDIT FINDING (gate 5, NOT fixed this pass): same shape of finding as
      // no_consensus_from_scatter's own early bypass elsewhere in this file -- a direct early
      // return outside resolveDeterministicComputeOverride's own pipeline, not reached by this
      // ticket's isLiteralExpressionProvenance demotion fix. This candidate's own
      // computeProvenance (below) is model_derived per this ticket's judgment call (the canonical
      // set is substrate-sourced, not question-verbatim); `corroboration: 'deterministic_compute'`
      // here would carry the same conflated label if this ever fires. Currently DORMANT on the
      // real substrate (loadGroundedSetMembershipFacts's own doc comment: zero `vault_export:fact:`
      // eblets exist as of this ticket), so unlike no_consensus_from_scatter this is a reported
      // structural gap, not yet an observed production mislabel.
      return {
        chosenLetter: setMembership.letter,
        corroboration: 'deterministic_compute',
        candidates,
        acceptedCandidates: [{
          authority: 'deterministic_compute',
          letter: setMembership.letter,
          reasoning: setMembership.trace,
          sourceUrl: '',
          method: 'set_membership',
        }],
        adjudicationAttempted: false,
        swarmFired: false,
        deterministicOverride: {
          letter: setMembership.letter,
          optionValue: NaN,
          optionUnit: null,
          computedValue: NaN,
          computedUnit: null,
          sourceExpression: setMembership.trace,
          source: 'question_expression',
          method: 'set_membership',
          // KN-BP143-1b JUDGMENT CALL (reported per this ticket's own "needs deciding rather than
          // assuming" discipline, same posture as gate 3's qid 33/qid 27 tracing): the deciding
          // operand here is the CANONICAL ENUMERATED SET, and that set is NOT verbatim in the
          // question text -- it comes from loadGroundedSetMembershipFacts(), a live-substrate read
          // of a `vault_export:fact:`-provenance eblet. This is NOT a stochastic model sample (the
          // read is deterministic and the fact was vault-curated, not freshly authority-extracted
          // per question) -- structurally a different, likely more trustworthy, flavor of
          // "not-question-derived" than qid 15's Ollama-sampled coincidence. The addendum's schema
          // is binary with no third tier (mirrors the Rooting Rule's own deliberate exclusion of a
          // middle tier), so this fails closed to model_derived: an operand traced to substrate/
          // authority state rather than the question text may corroborate but must not root as a
          // literal-expression proof under this taxonomy. Flagged for Bishop/Founder to ratify or
          // to mint a third tier for "grounded-fact-derived" if that distinction matters later.
          computeProvenance: 'model_derived',
          computeProvenanceDetail:
            'Canonical enumerated set (which options ARE/are NOT members) came from a vault-' +
            'curated Fact eblet already in the live substrate, not from the question text itself ' +
            '-- deterministic and vetted, but not question-verbatim, so it fails closed to ' +
            'model_derived under this ticket\'s binary schema (see the judgment-call note above).',
        },
      };
    }
  } catch (err) {
    log(`set_membership threw (non-fatal, ensemble continues normally): ${err}`);
  }

  // ── Perplexity, WITH options embedded (unchanged mechanism from the legacy path) ──────────
  try {
    // KN-BP144-7 T1/T2: runBrowserAuthorityLookupObserved is a byte-identical-result sibling of
    // runBrowserAuthorityLookup (see that function's own doc comment) -- `perplexityResult` below
    // is exactly what the pre-existing runBrowserAuthorityLookup(...) call would have produced
    // for this same query/config/bridge; `observed.dispatchOutcome`/`observed.raw` are the only
    // new information, consulted ONLY for authorityOutcomes.user_perplexity just below, never by
    // `resolved`/`candidates`.
    const observed = await runBrowserAuthorityLookupObserved(
      researchQuery, { ...config, preferredAuthority: 'user_perplexity', mcOptions: mcOptionTexts }, bridge,
    );
    const perplexityResult = observed.result;
    const resolved = perplexityResult ? resolveAuthorityLetterMatch(perplexityResult.fact, mcOptions) : null;
    if (resolved && perplexityResult) {
      candidates.push({
        authority: 'user_perplexity', letter: resolved.letter, reasoning: perplexityResult.fact,
        sourceUrl: perplexityResult.sourceUrl, method: resolved.method,
      });
    }
    authorityOutcomes.user_perplexity = resolveEnsembleAttemptOutcome(observed, resolved !== null);
    log(`perplexity=${resolved ? `${resolved.letter}(${resolved.method})` : 'no-letter'}`);
  } catch (err) {
    log(`perplexity threw (non-fatal): ${err}`);
  }

  // ── Google, NOW ALSO with options embedded (BP139 fix -- was bare-question-only before) ───
  try {
    const observed = await runBrowserAuthorityLookupObserved(
      researchQuery,
      { ...config, preferredAuthority: 'user_google', mcOptions: mcOptionTexts, embedOptionsForGoogle: true },
      bridge,
    );
    const googleResult = observed.result;
    const resolved = googleResult ? resolveAuthorityLetterMatch(googleResult.fact, mcOptions) : null;
    if (resolved && googleResult) {
      candidates.push({
        authority: 'user_google', letter: resolved.letter, reasoning: googleResult.fact,
        sourceUrl: googleResult.sourceUrl, method: resolved.method,
      });
    }
    authorityOutcomes.user_google = resolveEnsembleAttemptOutcome(observed, resolved !== null);
    log(`google=${resolved ? `${resolved.letter}(${resolved.method})` : 'no-letter'}`);
  } catch (err) {
    log(`google threw (non-fatal): ${err}`);
  }

  // ── BP139 browser-LLM authorities (ChatGPT/Gemini/Claude): PREMIUM, default-OFF, opt-in-only
  //    general second opinions -- fix the conceptual/knowledge questions (bias, Critical
  //    Security Studies, geography, etc.) a Perplexity-monoculture panel can miss. ────────────
  //
  // GATE (checked FIRST, before anything else, for EVERY authority in the loop): fires ONLY
  // when isBrowserLlmAuthorityEnabled() resolves true for that specific name -- overrides are
  // read ONCE per ensemble call (not per-authority) via readBrowserLlmAuthorityEnableOverridesFromSettings(),
  // the exact same "read once, resolve per-name" shape getOperatorsForDomain() already uses for
  // isAuthorityEnabled(). A disabled browser-LLM is skipped with a one-line log, no network/
  // webview/IPC side effect of any kind -- byte-identical to this loop not existing at all for
  // that name. Since every entry in BROWSER_LLM_AUTHORITY_METADATA is tier:'premium', the
  // default (no override present) is ALWAYS "disabled" -- see isBrowserLlmAuthorityEnabled()'s
  // own doc comment for why that is provable by inspection, not just by today's data.
  //
  // WIRING STATUS (honest, never fabricated -- same convention as browser_authority_adapter.ts's
  // own createNotWiredBridge()): BP140-K4 -- ALL THREE browser-LLM authorities now have a REAL
  // interactive bridge (queryClaudeBrowserAuthority / queryChatGptBrowserAuthority /
  // queryGeminiBrowserAuthority above, each routed through the SAME `bridge` this loop's caller
  // already threads through for user_google/user_perplexity, and each reaching its own per-vendor
  // selector config in webview_preload.ts's generic interactive driver). Every one of these still
  // requires isBrowserLlmAuthorityEnabled() to resolve true for that specific name (see that
  // function's own doc comment for why every entry's tier defaults to disabled) -- wiring a real
  // bridge here does NOT change the opt-in default-off gate at all, it only changes what happens
  // AFTER a user has explicitly opted in. queryBrowserLlmAuthorityNotWired() is no longer called
  // by this loop (kept, unexported, as the honest-placeholder template for a future 4th vendor).
  const browserLlmOverrides = readBrowserLlmAuthorityEnableOverridesFromSettings();
  const browserLlmNames: BrowserLlmAuthorityName[] = ['user_chatgpt', 'user_gemini', 'user_claude'];
  for (const llmName of browserLlmNames) {
    if (!isBrowserLlmAuthorityEnabled(llmName, browserLlmOverrides)) {
      log(`${llmName}=skipped (disabled, opt-in default-off -- see BROWSER_LLM_AUTHORITY_METADATA)`);
      // KN-BP144-7 T1: this IS T1's own literal 'disabled' definition -- "asked, authority is
      // switched off" -- observed directly from this loop's own pre-existing gate check, never
      // inferred from a later absence.
      authorityOutcomes[llmName] = { outcome: 'disabled' };
      continue;
    }
    try {
      // KN-BP144-7 T1/T2: the *Observed siblings return the exact same `result` shape their
      // non-observed counterparts (still defined above, now otherwise-uncalled) returned as
      // `llmResult` -- `resolved`/`candidates` below are therefore unchanged byte-for-byte.
      const observed = llmName === 'user_claude'
        ? await queryClaudeBrowserAuthorityObserved(researchQuery, mcOptionTexts, bridge)
        : llmName === 'user_chatgpt'
          ? await queryChatGptBrowserAuthorityObserved(researchQuery, mcOptionTexts, bridge)
          : await queryGeminiBrowserAuthorityObserved(researchQuery, mcOptionTexts, bridge);
      const llmResult = observed.result;
      const resolved = llmResult ? resolveAuthorityLetterMatch(llmResult.fact, mcOptions) : null;
      if (resolved && llmResult) {
        candidates.push({
          authority: llmName, letter: resolved.letter, reasoning: llmResult.fact,
          sourceUrl: llmResult.sourceUrl, method: resolved.method,
        });
      }
      authorityOutcomes[llmName] = resolveEnsembleAttemptOutcome(observed, resolved !== null);
      log(`${llmName}=${resolved ? `${resolved.letter}(${resolved.method})` : 'no-letter (enabled, wired-but-no-result)'}`);
    } catch (err) {
      log(`${llmName} threw (non-fatal): ${err}`);
    }
  }

  // ── Wolfram Alpha, computable questions only, ONLY when a free-tier appid is configured ───
  // "If a Wolfram authority is available, include it in the compute ensemble; if not, skip
  // silently" -- process.env.WOLFRAM_APP_ID is the SAME env var compute_sidecar.ts's Stage A.3
  // tier already reads (verified absent in this dev environment) -- absence here is silent, not
  // an error, matching that tier's own "fails closed" contract.
  if (answerType === 'computable') {
    const wolframAppId = process.env.WOLFRAM_APP_ID;
    if (wolframAppId) {
      try {
        const wolframResult = await computeViaWolframOnly(researchQuery, wolframAppId);
        if (wolframResult) {
          const matched = matchValueToOption(wolframResult.value, mcOptions);
          if (matched) {
            candidates.push({
              authority: 'wolfram_alpha',
              letter: matched.letter,
              reasoning: `Wolfram Alpha computed ${wolframResult.value} (matched option value ${matched.optionValue}).`,
              sourceUrl: `https://www.wolframalpha.com/input?i=${encodeURIComponent(researchQuery)}`,
              method: 'wolfram_compute',
            });
          }
        }
        log(`wolfram=${wolframResult ? `value=${wolframResult.value}` : 'no-result'}`);
      } catch (err) {
        log(`wolfram threw (non-fatal): ${err}`);
      }
    } else {
      log('wolfram=skipped (no WOLFRAM_APP_ID)');
    }
  }

  // ── BP1xx DETERMINISTIC-OVERRIDE-HOIST ("the calculator wins the math, every time") ─────────
  // THE BUG this closes: resolveDeterministicComputeOverride (defined below, six tiers --
  // unit_aware/bare_value/schedule_amortization/density/physics_kepler/aircraft_lift_drag) used
  // to be consulted ONLY after this function had already decided a chosenLetter via the agree/
  // single-candidate/adjudicated branches further down. A computable question whose authorities
  // DISAGREED, and whose one extra adjudication call also failed to resolve a letter, returns
  // chosenLetter:null (corroboration 'disagree'/'none') from those branches -- the override was
  // then never consulted at all, and the caller fell through to the older, narrower downstream
  // Stage A.3 compute-sidecar block (unit_aware/bare_value/schedule only -- it predates and never
  // learned the density/physics_kepler/aircraft_lift_drag tiers), then further still to ordinary
  // voter/fact arbitration -- letting a flubbed authority letter win a question the calculator
  // could have solved outright. Empirically observed across two live runs on the same build:
  // density with AGREEING authorities -> override fired, corrected B->C; the SAME density
  // question with DISAGREEING authorities -> override never ran, the wrong authority letter
  // stood; same split for an aircraft question resolved by a single (unagreed) authority.
  //
  // FIX: consult the SAME six-tier override HERE, unconditionally for every computable question,
  // BEFORE the fast-path/uncertain/single-candidate/adjudication branching below ever runs --
  // "regardless of authority agreement state" (the whole point). Uses whatever candidate
  // reasoning has been gathered so far (perplexity/google/browser-LLM/Wolfram -- the swarm has
  // not fired yet at this point in the function). The four newer tiers (schedule/density/
  // physics_kepler/aircraft_lift_drag) derive strictly from the question text, never from this
  // reasoning, so running them this early costs nothing and changes nothing about what they can
  // solve; the two older tiers (unit_aware/bare_value) simply see whatever componentFacts already
  // exist at this point, the identical contract their existing downstream call site already
  // honors. A confident single-option deterministic result short-circuits this entire function --
  // the swarm never fires and no agree/disagree/adjudicate branching runs at all -- matching this
  // file's own "cheap by design" doctrine (a real answer already found makes the swarm redundant
  // spend). A null result (every non-computable question, and any computable question none of the
  // six tiers can parse) falls through to the EXISTING branching below, byte-for-byte unchanged --
  // this block is purely additive and never mutates `candidates`.
  if (answerType === 'computable') {
    const hoistReasoningTexts = candidates.map((c) => c.reasoning);
    // BP141-2 Task B: real independent-source scatter, tagged with each candidate's derivation
    // path so the no-consensus tier inside resolveDeterministicComputeOverride can evaluate its
    // own gate on THIS ('computable'-classified) call path too, not just via its dedicated
    // unconditional bypass above.
    const hoistIndependentSources: IndependentSourceVote[] = candidates.map((c) => ({
      letter: c.letter,
      derivationPath: resolveCakeDerivationPath(c),
    }));
    const hoistDecision = await resolveDeterministicComputeOverride(
      researchQuery, mcOptions, '', hoistReasoningTexts,
      { ollamaBaseUrl: config.ollamaBaseUrl, model: config.model, wolframAppId: process.env.WOLFRAM_APP_ID },
      hoistIndependentSources,
      // KN-BP141-10: `bridge` is already in scope here (this whole block runs inside
      // runAuthorityEnsemble, which destructures `bridge` from its own params) -- threaded through
      // so the format-independent fallback's own C7 (mandatory source capture) can attempt a real
      // Perplexity lookup on this call path too, not just the post-branch site below.
      bridge,
    );
    if (hoistDecision.deterministicOverride) {
      const det = hoistDecision.deterministicOverride;
      // BP-COMPUTE-HONEST-DEMOTE (the actual fix, see this Yoke's build report): the pre-branch
      // override above only genuinely deserves its "the calculator answered before any vote"
      // status when the quantity it computed came from `source === 'question_expression'` --
      // either a literal expression in the QUESTION text (compute_sidecar.ts path (b)), or one of
      // the four named solvers (schedule/density/physics_kepler/aircraft_lift_drag), which by
      // their own doc comments derive strictly from the question text + options, NEVER from
      // `reasoningTexts` (confirmed by direct read this Yoke -- see resolveDeterministicComputeOverride
      // tiers (iii)-(vi) above). Those tiers all report a `source` value that is NEVER the literal
      // string 'reasoning_fact' (tier (ii)'s computeAnswer+matchValueToOption hardcodes
      // 'question_expression'; the four solvers report their own solver-name tags). ONLY tier (i)
      // (computeUnitAwareMatch) can report `source: 'reasoning_fact'` -- paths (a)/(c), a quantity
      // pulled out of an authority's own reasoning/fact text (`hoistReasoningTexts` above, i.e.
      // `candidates.map(c => c.reasoning)`) rather than the question itself. That value is a real,
      // checked (exactly-one-option-matches) computation -- not a guess -- but it is a DERIVED
      // RESTATEMENT of whichever authority it was extracted from, with no independent grounding of
      // its own, so it must never again be allowed to short-circuit the ensemble before any vote
      // is even evaluated (the live density-question bug this Yoke closes: the calculator
      // silently re-stated user_perplexity's own wrong number as a pre-branch "deterministic"
      // verdict, discarding user_claude's correct C).
      // KN-BP143-1b: widened from `det.source !== 'reasoning_fact'` to
      // isLiteralExpressionProvenance(det) -- the narrower string check only ever caught tier
      // (i)'s own reasoning-text-extraction path. It structurally could NOT catch
      // no_consensus_from_scatter or elimination_cascade_fallback (both hardcode
      // `source: 'question_expression'` even though neither derives from the question text --
      // see each tier's own computeProvenance doc comment above), so either one could reach this
      // branch and short-circuit-return as a pre-branch 'deterministic_compute_override' before
      // this ticket, structurally the SAME 1803828c-shaped miss the addendum's own trap section
      // warns about, one layer up. isLiteralExpressionProvenance closes that gap for every tier at
      // once, fails closed on any future tier this audit missed.
      if (isLiteralExpressionProvenance(det)) {
        log(
          `deterministic compute override fired PRE-BRANCH (${det.method}: ${det.sourceExpression} -> ` +
          `${det.computedValue}${det.computedUnit ? ' ' + det.computedUnit : ''}) -> ${det.letter} -- ` +
          `skipping agree/disagree/adjudicate/single-source branching entirely (candidates so far: ` +
          `[${candidates.map((c) => `${c.authority}:${c.letter}`).join(', ') || 'none'}]).`,
        );
        return {
          chosenLetter: det.letter,
          corroboration: 'deterministic_compute_override',
          candidates,
          acceptedCandidates: [{
            authority: 'deterministic_compute',
            letter: det.letter,
            reasoning: `${det.method}: ${det.sourceExpression} -> ${det.computedValue}${det.computedUnit ? ' ' + det.computedUnit : ''}`,
            sourceUrl: '',
            method: det.method,
          }],
          adjudicationAttempted: false,
          swarmFired: false,
          deterministicOverride: det,
        };
      }
      // BP-ECHO-NO-VOTE: !isLiteralExpressionProvenance(det) -- a real, checked compute, but at
      // least one deciding operand did not trace to the question text (originally this was
      // written for source === 'reasoning_fact' alone -- an authority's OWN reasoning/fact text,
      // `hoistReasoningTexts`, i.e. `candidates.map(c => c.reasoning)` -- but KN-BP143-1b widened
      // the check to isLiteralExpressionProvenance, which ALSO now catches no_consensus_from_scatter/
      // elimination_cascade_fallback candidates reaching this site with a misleadingly-hardcoded
      // `source: 'question_expression'` -- see each tier's own computeProvenance doc comment for
      // why `source` alone cannot be trusted here any more). Either way it is a DERIVED
      // RESTATEMENT of something else's output, not independent evidence. PRIOR behavior here
      // (BP-COMPUTE-HONEST-DEMOTE) pushed this into `candidates` as an "ordinary" voting entry --
      // but because it always shares the letter of the authority/scatter it was derived from, that
      // let the SAME voice count twice toward a 2+ "agree" (live receipt: candidates ended up
      // [user_perplexity, deterministic_compute_reasoning_fact], the second derived FROM the
      // first -- an echo counted as corroboration). FIX: record it in `reasoningFactComputeReceipt`
      // ONLY (see that field's own doc comment on AuthorityEnsembleOutcome) -- it never enters
      // `candidates`, so it can never participate in the byLetter/agreeingGroup grouping, the
      // fast-path 2+ check, hasStructuredCorroborator/STRUCTURED_AUTHORITIES, or adjudication's
      // candidate set below. It is still fully visible as a receipt (this log line + the returned
      // field) so the Coroner can see a compute ran and what it produced -- it just can no longer
      // cast a vote.
      log(
        `deterministic compute ran PRE-BRANCH (${det.method}: ${det.sourceExpression} -> ` +
        `${det.computedValue}${det.computedUnit ? ' ' + det.computedUnit : ''}) -> ${det.letter} but ` +
        `computeProvenance=model_derived (${det.computeProvenanceDetail}) -- recorded as a receipt ` +
        `ONLY, NOT pushed into the voting candidate list (candidates so far, unaffected: ` +
        `[${candidates.map((c) => `${c.authority}:${c.letter}`).join(', ') || 'none'}]).`,
      );
      reasoningFactComputeReceipt = {
        letter: det.letter,
        method: det.method,
        sourceExpression: det.sourceExpression,
        computedValue: det.computedValue,
        computedUnit: det.computedUnit,
      };
    }
  }

  // ── BP141-2 Task B NO-CONSENSUS-ANSWER-TYPE-BYPASS (mirrors BP-PSEUDOCODE-TRACE-ANSWER-TYPE-
  // BYPASS/BP141-1 SET-MEMBERSHIP-ANSWER-TYPE-BYPASS above): plow_mc_no_consensus_solver.ts's
  // solveNoConsensusFromScatter is ALSO a registered tier inside resolveDeterministicComputeOverride
  // below, but that function (like every tier inside it) is only ever reached when
  // answerType === 'computable' (see the gated hoist block just above). A question whose correct
  // answer IS "there is no single/specific answer" (run 030 receipt, question_id 92: Critical
  // Security Studies "referent object" question) carries no numbers at all, so
  // answer_type_classifier.ts files it 'reasoning', not 'computable' -- this solver would
  // otherwise never even be consulted. UNLIKE the pseudocode-trace/set-membership bypasses, this
  // one cannot run before ANY authority is consulted -- its entire gate depends on the ensemble's
  // own INDEPENDENT candidate scatter, which does not exist yet at the very top of this function.
  // It is placed HERE instead: unconditionally on answerType, using whatever candidates have been
  // gathered so far (perplexity/google/browser-LLM/Wolfram -- the swarm has not fired yet), each
  // tagged with its real derivation path via resolveCakeDerivationPath (the SAME independence-unit
  // mapper the Cake Method tiers use -- A9/A10 REVISED, "VARIANCE IS NOT INDEPENDENCE"). A
  // confident result short-circuits this entire function exactly like the deterministic-override
  // hoist above; a null falls through to the EXISTING branching below, byte-for-byte unchanged --
  // this block never mutates `candidates` and never widens solveNoConsensusFromScatter's own gate.
  try {
    const independentSourcesForNoConsensus: IndependentSourceVote[] = candidates.map((c) => ({
      letter: c.letter,
      derivationPath: resolveCakeDerivationPath(c),
    }));
    const noConsensus = solveNoConsensusFromScatter(researchQuery, mcOptions, independentSourcesForNoConsensus);
    if (noConsensus) {
      log(
        `no_consensus_from_scatter PROVED answer ${noConsensus.letter} from the ensemble's own ` +
        `independent-derivation-path scatter -- swarm/adjudication not consulted (answerType=${answerType}, ` +
        `${noConsensus.trace}).`,
      );
      // KN-BP143-1b CONSUMER AUDIT FINDING (gate 5, NOT fixed this pass, reported per the
      // addendum's own "report even if you do not change it" mandate): this is a direct early
      // return, structurally separate from resolveDeterministicComputeOverride's own
      // deterministicOverride pipeline -- it is NOT covered by this ticket's isLiteralExpressionProvenance
      // demotion fix at the pre-branch-hoist/Stage-F2 sites below, because it never reaches either
      // one. `corroboration: 'deterministic_compute'` here is the SAME conflated label this whole
      // ticket exists to split: this candidate's own computeProvenance (just above) is
      // model_derived (the deciding evidence is the ensemble's OWN candidate scatter, not the
      // question text), yet the string this function returns is byte-identical to a genuine
      // literal_expression proof's. NOT HYPOTHETICAL: answer_coroner.ts's own run-031 empirical
      // note (question_id 92) documents this exact path firing in production with
      // corroboration='deterministic_compute'. Restructuring this early-bypass's control flow (to
      // demote rather than short-circuit, mirroring BP-ECHO-NO-VOTE's own receipt-only pattern) is
      // out of scope for this ticket's blast radius -- it would also require coordinated changes
      // to rooting_rule.ts's classifyCorroborationTier and answer_coroner.ts's own
      // isDeterministicCompute check, neither of which this ticket's five verification gates
      // exercise. Recommend a dedicated follow-up ticket.
      return {
        chosenLetter: noConsensus.letter,
        corroboration: 'deterministic_compute',
        candidates,
        acceptedCandidates: [{
          authority: 'deterministic_compute',
          letter: noConsensus.letter,
          reasoning: noConsensus.trace,
          sourceUrl: '',
          method: 'no_consensus_from_scatter',
        }],
        adjudicationAttempted: false,
        swarmFired: false,
        deterministicOverride: {
          letter: noConsensus.letter,
          optionValue: NaN,
          optionUnit: null,
          computedValue: NaN,
          computedUnit: null,
          sourceExpression: noConsensus.trace,
          source: 'question_expression',
          method: 'no_consensus_from_scatter',
          // KN-BP143-1b (see the post-swarm-recheck no_consensus_from_scatter site below for the
          // fuller version of this same rationale -- kept in sync deliberately): the deciding
          // input is `independentSourcesForNoConsensus`, i.e. the ENSEMBLE'S OWN candidates
          // (perplexity/google/browser-LLM/Wolfram, each an authority or model output) scattering
          // across 3+ distinct letters -- not an operand read from the question text. `source:
          // 'question_expression'` above is honestly wrong for this tier (a pre-existing label the
          // ticket's own thesis names exactly this class of defect); computeProvenance is the
          // correction. This candidate may still corroborate/be recorded; per gate 2/isLiteral
          // ExpressionProvenance it may never independently root or override a settled answer.
          computeProvenance: 'model_derived',
          computeProvenanceDetail:
            'Deciding evidence is the ensemble\'s OWN scatter of independent-derivation-path ' +
            'candidates (other authorities\' and models\' own answers) reaching no majority on a ' +
            'question that also offers an explicit no-consensus option -- every operand here is ' +
            'another authority/model\'s output, not the question text.',
        },
      };
    }
  } catch (err) {
    log(`no_consensus_from_scatter threw (non-fatal, ensemble continues normally): ${err}`);
  }

  // ── FAST PATH: 2+ browser/Wolfram candidates already agree -- accept immediately, swarm never
  //    fires. This is the ONLY case that skips the swarm (highest confidence, cheapest). ────────
  if (candidates.length >= 2) {
    const byLetterFast = new Map<string, AuthorityEnsembleCandidate[]>();
    for (const c of candidates) {
      const arr = byLetterFast.get(c.letter) ?? [];
      arr.push(c);
      byLetterFast.set(c.letter, arr);
    }
    const agreeingGroupFast = [...byLetterFast.values()].find((group) => group.length >= 2);
    if (agreeingGroupFast) {
      if (hasStructuredCorroborator(agreeingGroupFast)) {
        // KN-BP144-12 Part B ("THE ELIMINATOR ABOVE AGREEMENT"): same check as the swarm-augmented
        // accept-on-agreement branch further below -- see checkEliminatorConstraintAboveAgreement's
        // own header comment for the full rationale. Applied here too for principled completeness
        // (this IS an accept-on-agreement return), even though this fast path additionally requires
        // a structured (wolfram_alpha) member, which in practice never co-occurs with the narrow
        // "bias"-concept domain this eliminator's curated CONCEPT_REGISTER_SIGNALS table covers.
        const letterAboutToAcceptFast = agreeingGroupFast[0]!.letter;
        const eliminatorAboveFast = await checkEliminatorConstraintAboveAgreement(researchQuery, mcOptions);
        if (eliminatorAboveFast.constraintActive && !eliminatorAboveFast.survivorsOut.includes(letterAboutToAcceptFast)) {
          log(
            `KN-BP144-12 Part B: fast-path structured agreement on ${letterAboutToAcceptFast} VOIDED -- ` +
            `above-agreement eliminator constraint survivors=[${eliminatorAboveFast.survivorsOut.join(',')}] ` +
            `EXCLUDE ${letterAboutToAcceptFast}. Falling through to the swarm-uncertain branch below ` +
            `exactly as if the fast path had declined for any other reason. Eliminator trace:\n  ${eliminatorAboveFast.trace.join('\n  ')}`,
          );
        } else {
          const constraintNote = eliminatorAboveFast.constraintActive
            ? `constrained to [${eliminatorAboveFast.survivorsOut.join(',')}] (does not exclude ${letterAboutToAcceptFast})`
            : 'no active constraint';
          log(`browser/wolfram authorities already agree on ${agreeingGroupFast[0]!.letter} (structurally corroborated) -- swarm skipped (fast path). KN-BP144-12 Part B above-agreement eliminator: ${constraintNote}.`);
          return {
            chosenLetter: agreeingGroupFast[0]!.letter, corroboration: 'agree', candidates,
            acceptedCandidates: agreeingGroupFast, adjudicationAttempted: false, swarmFired: false,
            structuredCorroborator: true,
            // BP141: fast path only reaches here when hasStructuredCorroborator already found a
            // structured member (wolfram_alpha -- the swarm has not fired yet at this point) among
            // the agreeing group, so each agreeing candidate has its own independent evidence.
            independentCorroboration: true,
          };
        }
      }
      // BP1xx STRUCTURED-CORROBORATOR GATE ("Q85"): every agreeing candidate here is LLM-class
      // (opinion, no structured backing behind either of them) -- e.g. user_perplexity and
      // user_claude both confidently wrong together, with no deterministic compute and no
      // specialist swarm ever consulted. Naive concordance cannot catch that. Do NOT fast-path
      // accept: decline the fast path and fall through into the uncertain branch immediately
      // below, which fires the specialist swarm (the required non-LLM structured corroborator)
      // as one more candidate before any accept/adjudicate decision is made. Coverage is never
      // dropped here -- this only ever delays the accept by one extra swarm call, never turns it
      // into an abstain.
      log(
        `browser authorities agree on ${agreeingGroupFast[0]!.letter} but EVERY agreeing candidate ` +
        `is LLM-class (${agreeingGroupFast.map((c) => c.authority).join(',')}) -- fast path DECLINED, ` +
        `firing the specialist swarm as the required structured corroborator before accepting.`,
      );
    }
  }

  // ── UNCERTAIN: 0 browser/Wolfram candidates, exactly 1, 2+ that all disagree, OR (BP1xx
  //    STRUCTURED-CORROBORATOR GATE) 2+ that agree but EVERY agreeing candidate is LLM-class
  //    (the fast path above declined for that reason). Fold the existing specialist swarm in as
  //    ONE MORE corroborating candidate before deciding. ─────────────────────────────────────
  log(
    `browser/wolfram authorities uncertain (candidates=[${candidates.map((c) => `${c.authority}:${c.letter}`).join(', ') || 'none'}]) ` +
    `-- firing the specialist swarm as one more candidate.`,
  );
  let swarmReceipt: AuthorityEnsembleOutcome['swarmReceipt'];
  // BP1xx STRUCTURED-CORROBORATOR GATE: hoisted out of the try block below (unlike swarmReceipt,
  // which is a receipt object copied field-by-field) so the swarm-augmented agreement check
  // further down can tell "did the structured corroborator we just fired actively DISAGREE with
  // an LLM-only agreeing group" apart from "it simply yielded nothing usable" -- see that check's
  // own comment for why the two cases route differently (adjudicate vs accept-but-flag).
  let swarmChosenLetterForGate: string | null = null;
  let swarmConcordanceForGate: ConcordanceClass | null = null;
  try {
    const swarmResult = await runSpecialistSwarmConsensus({
      researchQuery, domain, mcPromptWithSubstrate, config, widenerOperators, widenerBackupOperators, onProgress, log,
    });
    swarmReceipt = {
      specialistsUsed: swarmResult.specialistsUsed,
      candidatesRaw: swarmResult.candidatesRaw,
      candidatesPostMiner: swarmResult.candidatesPostMiner,
      candidatesPostFurnace: swarmResult.candidatesPostFurnace,
      voterLetters: swarmResult.voterLetters,
      voterDiagnostics: swarmResult.voterDiagnostics,
      concordance: swarmResult.concordance,
    };
    swarmChosenLetterForGate = swarmResult.chosenLetter;
    swarmConcordanceForGate = swarmResult.concordance;
    // HONESTY (BR-007, non-negotiable): the swarm's letter counts as a real candidate ONLY when
    // its own 3 voters reached a genuine CONCORDANT consensus -- a DISCORDANT/PARTIAL/no-letter
    // swarm result contributes NOTHING to the vote below (swarmReceipt above still records it
    // for trace visibility -- "the trace shows it participated" -- but it never becomes a
    // guessed/fabricated candidate).
    //
    // BP141 ECHO-ABSTENTION FIX (narrow, evidence-based -- see runSpecialistSwarmConsensus's own
    // `factsForArbitration = postFurnace.length > 0 ? postFurnace : postMiner.slice(0, 3)` line):
    // when NOTHING survived Furnace/Saladin's adversarial fence (candidatesPostFurnace === 0),
    // that function does not return early -- it falls back to arbitrating over raw, unverified
    // postMiner facts, and the 3 voters can still land on a CONCORDANT letter with ZERO
    // Furnace-verified grounding behind it. That is precisely the G1_FACT gate's own "no verified
    // facts" condition (see evaluateGates in canonical_pipeline.ts: G1_FACT passes iff
    // candidatesPostFurnace > 0). A CONCORDANT vote in that state is not corroboration -- it is
    // the voters echoing whatever letter they already lean toward (proven live: run 18mnemo, the
    // swarm never fired at all on this question, specialists_used empty, Furnace found no
    // verified facts; run 19mnemo, same question, the swarm returned a letter matching
    // perplexity's wrong answer with no grounding behind it). Requiring
    // candidatesPostFurnace > 0 here is the ONE added condition: it only ever downgrades an
    // already-CONCORDANT, already-no-grounding swarm result to "does not count as a candidate" --
    // it never forces an abstain on a swarm result that DOES have grounding, and never touches
    // any other candidate (browser/Wolfram/deterministic) or any other branch in this file. This
    // is deliberately narrower than YOKE #27/BP133 (which forced abstention broadly on any null
    // voter letter, causing over-abstention across the board) -- this condition fires only on the
    // provable zero-grounding state, never as a default and never on ambiguity.
    if (
      swarmResult.chosenLetter
      && swarmResult.concordance === 'CONCORDANT'
      && swarmResult.candidatesPostFurnace > 0
    ) {
      candidates.push({
        authority: 'specialist_swarm',
        letter: swarmResult.chosenLetter,
        reasoning:
          `specialist swarm consensus (${swarmResult.specialistsUsed.length} specialists: ` +
          `[${swarmResult.specialistsUsed.join(',')}], voters=[${swarmResult.voterLetters.join(',')}], ` +
          `concordance=${swarmResult.concordance}, postFurnace=${swarmResult.candidatesPostFurnace}).`,
        sourceUrl: 'specialist-swarm-internal-consensus',
        method: 'specialist_swarm_vote',
      });
      // KN-BP144-7 T1/T3: swarm's own closed-vocabulary subset is {not_attempted, no_result,
      // answered} -- see browser_authority_types.ts's own EnsembleAuthorityKey doc comment. This
      // branch is reached only when the swarm's letter was genuinely counted as a candidate above.
      authorityOutcomes.specialist_swarm = { outcome: 'answered' };
    } else if (swarmResult.chosenLetter && swarmResult.concordance === 'CONCORDANT') {
      log(
        `[plow_mc_answerer] specialist_swarm ABSTAINS (no verified grounding: postFurnace=0, ` +
        `arbitrated over ${swarmResult.candidatesPostMiner} unverified postMiner fallback fact(s)) ` +
        `-- letter ${swarmResult.chosenLetter} not counted as corroboration.`,
      );
      // Asked, returned successfully (a genuine CONCORDANT vote), but that vote was ruled
      // ungrounded and therefore never became a usable candidate -- T1's own 'no_result'.
      authorityOutcomes.specialist_swarm = { outcome: 'no_result' };
    } else {
      // DISCORDANT/PARTIAL/no-letter -- asked, returned, nothing usable.
      authorityOutcomes.specialist_swarm = { outcome: 'no_result' };
    }
    log(`swarm=${swarmResult.chosenLetter ? `${swarmResult.chosenLetter}(${swarmResult.concordance})` : `no-letter(${swarmResult.concordance})`}`);
  } catch (err) {
    log(`specialist swarm threw (non-fatal): ${err}`);
    // Genuinely asked (the try block was entered) but no usable outcome -- never left as the
    // default 'not_attempted', which would falsely say the swarm was never consulted at all.
    authorityOutcomes.specialist_swarm = { outcome: 'no_result' };
  }

  if (candidates.length === 0) {
    // Nobody -- browser, Wolfram, or swarm -- answered. Honest 'none'.
    return { chosenLetter: null, corroboration: 'none', candidates, acceptedCandidates: [], adjudicationAttempted: false, swarmFired: true, swarmReceipt, reasoningFactComputeReceipt };
  }

  if (candidates.length === 1) {
    // Exactly one real candidate total: either the browser/Wolfram panel had exactly one and the
    // swarm added nothing (unchanged honest single-authority behavior), or the browser panel had
    // nothing and the swarm alone reached a CONCORDANT consensus.
    const only = candidates[0]!;
    // BP-ECHO-NO-VOTE (supersedes the old BP-COMPUTE-HONEST-DEMOTE note that used to live here): a
    // 'deterministic_compute_reasoning_fact' candidate is NEVER pushed into `candidates` at all any
    // more (see reasoningFactComputeReceipt's own doc comment on AuthorityEnsembleOutcome, and its
    // one push-site in the pre-branch hoist above) -- it can no longer reach this branch, or any
    // other candidate-counting branch below, under any circumstance. It is carried separately, only
    // through the `reasoningFactComputeReceipt` field threaded into every return in this function.
    const corroboration: AuthorityEnsembleOutcome['corroboration'] =
      only.authority === 'user_google' ? 'single_google'
        : only.authority === 'user_perplexity' ? 'single_perplexity'
          : only.authority === 'wolfram_alpha' ? 'single_wolfram'
            : only.authority === 'user_chatgpt' ? 'single_chatgpt'
              : only.authority === 'user_gemini' ? 'single_gemini'
                : only.authority === 'user_claude' ? 'single_claude'
                  : 'single_specialist_swarm';
    // BP141-1 SINGLE-SOURCE-NO-GROUNDING GATE (Task 3, run 029 receipt, question_id 98): composes
    // with (never duplicates) the BP139 concordanceStrictness gate immediately below -- that gate
    // decides WHETHER a lone candidate is accepted at all (governed by the Founder-tunable
    // concordanceStrictness setting, default 'lenient' == always accept); THIS flag decides nothing
    // about accept/reject -- it only records, for the Coroner's benefit, whether an accepted lone
    // candidate had ANY independent backing at all. Composed from two signals already computed
    // elsewhere in this same function scope, never re-derived: hasStructuredCorroborator (the SAME
    // STRUCTURED_AUTHORITIES classification the 2+-candidate 'agree' path already uses above)
    // applied to this single candidate, and swarmReceipt.candidatesPostFurnace (the SAME
    // specialist-swarm grounding count the BP141 echo-abstention push-site check above already
    // reads). The swarm has ALWAYS already fired by this point (see the UNCERTAIN block above,
    // unconditional whenever candidates.length is 0/1/disagreeing), so swarmReceipt is populated
    // here except in the rare case its own try/catch threw before assignment -- treated as zero
    // grounding, fail-closed, never fail-open. See AuthorityEnsembleOutcome.singleSourceUngroundedAccept's
    // own doc comment for the full true/false meaning.
    const singleSourceUngroundedAccept =
      !hasStructuredCorroborator([only]) && (swarmReceipt?.candidatesPostFurnace ?? 0) === 0;
    // BP139 CONCORDANCE GATE (Founder canon: "I want to tune it"). Explicit config value wins;
    // absent that, falls back to the live ai_dispatch_settings.json reading (same "read once per
    // ensemble call" convention as browserLlmOverrides above) -- see CanonicalPlowMcConfig.
    // concordanceStrictness's own doc comment for the full override-vs-settings contract.
    const concordanceStrictness: ConcordanceStrictness =
      config.concordanceStrictness ?? readConcordanceStrictnessFromSettings();
    const loneAccepted = resolveConcordanceAcceptance({
      answerType, strictness: concordanceStrictness, totalCandidates: candidates.length, agreeingCandidates: 1,
    });
    if (!loneAccepted) {
      // Honest abstain: somebody DID answer (the trace still shows `candidates`), but
      // concordanceStrictness requires more than one voice before a NO-COMPUTE answer is trusted,
      // and only one voice spoke here. Never accepted, never fabricated -- falls through exactly
      // like the 'none'/'disagree' paths below (this function's caller only accepts on a
      // truthy chosenLetter, see runAuthorityEnsemble's call site).
      log(
        `lone candidate ${only.authority}:${only.letter} REJECTED by concordanceStrictness=` +
        `${concordanceStrictness} (answerType=${answerType}, NO-COMPUTE gate) -- honest abstain, ` +
        `no second corroborating source.`,
      );
      return {
        chosenLetter: null, corroboration: 'lone_rejected_by_strictness', candidates,
        acceptedCandidates: [], adjudicationAttempted: false, swarmFired: true, swarmReceipt, reasoningFactComputeReceipt,
      };
    }
    log(
      `lone candidate ${only.authority}:${only.letter} ACCEPTED (concordanceStrictness=` +
      `${concordanceStrictness}) -- singleSourceUngroundedAccept=${singleSourceUngroundedAccept} ` +
      `(candidatesPostFurnace=${swarmReceipt?.candidatesPostFurnace ?? 0}).`,
    );
    return {
      chosenLetter: only.letter, corroboration, candidates, acceptedCandidates: [only],
      adjudicationAttempted: false, swarmFired: true, swarmReceipt, reasoningFactComputeReceipt,
      singleSourceUngroundedAccept,
    };
  }

  // KN-BP143-1 Defect 4 (THE `agree` PATH HAS NO CORRECTNESS GATE): the no-consensus scatter
  // check earlier in this function (BP141-2 Task B NO-CONSENSUS-ANSWER-TYPE-BYPASS, above) only
  // ever saw the PRE-SWARM candidate set -- the swarm has not fired yet at that point in this
  // function, so its vote can never contribute to that computation, even though by THIS point it
  // already has. If too few independent sources existed pre-swarm to clear solveNoConsensusFromScatter's
  // own >=3-distinct-derivation-path gate (B2), that check trivially returned null and this
  // function moved on -- meaning the swarm's own vote, once it arrives, can never get a second look
  // from the SAME solver before a bare two-source concurrence (below) is allowed to accept.
  // Real receipt evidence (run 030, qid 92, Critical Security Studies "referent object" question,
  // correct answer E via its own explicit no-consensus option): the swarm-complete candidate set
  // [user_perplexity:B, user_google:F, user_claude:J, specialist_swarm:B] scatters across 3
  // distinct letters (B/F/J) with NO strict majority (B holds 2 of 4 -- exactly 50%, not >50%) --
  // solveNoConsensusFromScatter's own B3/B4 gates would correctly recognize this as genuine
  // no-consensus evidence for option E, but the code never gave it the chance: it fell straight
  // into the swarm-augmented "2+ agree" branch below on perplexity+swarm's bare concurrence,
  // discarding google's and claude's dissent entirely. Required behavior (this ticket): "two-source
  // concurrence must not preempt a deterministic path that would otherwise fire... evaluate
  // deterministic and scatter-fallback resolution BEFORE accepting bare concurrence." FIX: re-run
  // the SAME solver, SAME independence-unit convention (resolveCakeDerivationPath), against the
  // NOW-COMPLETE (swarm-included) candidate set, immediately BEFORE the swarm-augmented agreement
  // check below ever gets to accept a bare concurrence. A null result here changes nothing (falls
  // through to the existing branching, byte-for-byte); a non-null result is accepted with the SAME
  // 'deterministic_compute' shape the pre-swarm call site above already uses. This can only ever
  // ADD a correctly-gated deterministic accept ahead of a bare agree -- it never removes or weakens
  // any existing accept path, and it never widens solveNoConsensusFromScatter's own B1-B4 gates.
  //
  // KN-BP144-6 T1/T2 FIX ("THE SOLVER NEVER GOT TO SPEAK"): this call site already ran BEFORE the
  // swarm-augmented accept-on-agreement branch (KN-BP143-1 Defect 4 placed it here specifically for
  // that reason) -- T1's "move the attempt before accept-on-agreement" requirement was already
  // structurally true at this exact position. What was NOT yet true, and is the actual fix this
  // ticket makes: the input this call site fed the solver was the RAW, un-deduped `candidates`
  // list, counting specialist_swarm as a SEPARATE independent vote alongside whichever non-swarm
  // authority it agrees with -- inflating both the independence count (B2) and, more consequentially,
  // the majority arithmetic (B3), which reads specialist_swarm's own vote as one more distinct voice
  // for whatever letter the swarm landed on. T2 requires the SAME input construction KN-BP144-5's
  // own T2 already built for its own diversity-decline recheck below (eliminateDuplicateSwarmDerivationPath
  // applied to the full candidate list, never a set already collapsed by an agreement check) --
  // reused here verbatim, not a second divergent copy. This can only ever REMOVE a vote (swarm's,
  // and only when a genuinely different-path candidate survives to make it a duplicate witness), so
  // it can only ever make the majority/independence arithmetic MORE conservative, never invent scatter
  // that was not already present among the genuinely independent non-swarm authorities.
  let preAgreeScatterAttempt: AuthorityEnsembleOutcome['preAgreeDeterministicScatterAttempt'];
  try {
    const { survivors: dedupedForPreAgreeScatter } = eliminateDuplicateSwarmDerivationPath(candidates);
    const independentSourcesPostSwarm: IndependentSourceVote[] = dedupedForPreAgreeScatter.map((c) => ({
      letter: c.letter,
      derivationPath: resolveCakeDerivationPath(c),
    }));
    const noConsensusPostSwarm = solveNoConsensusFromScatter(researchQuery, mcOptions, independentSourcesPostSwarm);
    if (noConsensusPostSwarm) {
      log(
        `no_consensus_from_scatter PROVED answer ${noConsensusPostSwarm.letter} from the ` +
        `SWARM-COMPLETE, swarm-deduped independent-derivation-path scatter (KN-BP143-1 Defect 4 + ` +
        `KN-BP144-6 T1/T2: re-checked after the swarm fired, deduped, before bare two-source ` +
        `concurrence could preempt it) -- deterministic_attempted_fired -- ${noConsensusPostSwarm.trace}.`,
      );
      // KN-BP143-1b CONSUMER AUDIT FINDING (gate 5, NOT fixed this pass): same finding as this
      // solver's own pre-swarm bypass above -- a direct early return outside
      // resolveDeterministicComputeOverride's own pipeline, so this ticket's
      // isLiteralExpressionProvenance demotion fix does not reach it. `corroboration:
      // 'deterministic_compute'` here is the same conflated label the addendum exists to split;
      // see the pre-swarm bypass's own fuller note above (kept in sync deliberately).
      return {
        chosenLetter: noConsensusPostSwarm.letter,
        corroboration: 'deterministic_compute',
        candidates,
        acceptedCandidates: [{
          authority: 'deterministic_compute',
          letter: noConsensusPostSwarm.letter,
          reasoning: noConsensusPostSwarm.trace,
          sourceUrl: '',
          method: 'no_consensus_from_scatter',
        }],
        adjudicationAttempted: false,
        swarmFired: true,
        swarmReceipt,
        reasoningFactComputeReceipt,
        preAgreeDeterministicScatterAttempt: {
          verdict: 'deterministic_attempted_fired',
          solver: 'no_consensus_from_scatter',
          detail: noConsensusPostSwarm.trace,
        },
        deterministicOverride: {
          letter: noConsensusPostSwarm.letter,
          optionValue: NaN,
          optionUnit: null,
          computedValue: NaN,
          computedUnit: null,
          sourceExpression: noConsensusPostSwarm.trace,
          source: 'question_expression',
          method: 'no_consensus_from_scatter',
          // KN-BP143-1b: real receipt confirming this is not hypothetical -- answer_coroner.ts's
          // own run-031 empirical note (question_id 92) shows this exact tier firing with
          // corroboration='deterministic_compute' in production, structurally indistinguishable
          // from a genuine literal_expression proof in every existing receipt field. The deciding
          // input is `independentSourcesPostSwarm` -- the SWARM-COMPLETE, swarm-deduped candidate
          // scatter, i.e. other authorities'/models' own answers -- never the question text.
          // model_derived: may be recorded and may corroborate (this tier already only fires on
          // genuine 3+-distinct-derivation-path, no-majority scatter -- a real, meaningful signal),
          // but per gate 2 must never independently root or override through the
          // deterministic-override path.
          computeProvenance: 'model_derived',
          computeProvenanceDetail:
            'Deciding evidence is the SWARM-COMPLETE, swarm-deduped independent-derivation-path ' +
            'scatter -- other authorities\' and models\' own answers reaching no majority -- ' +
            're-checked after the swarm fired, never an operand read from the question text itself.',
        },
      };
    }
    const decline = diagnoseNoConsensusScatterDecline(mcOptions, independentSourcesPostSwarm);
    preAgreeScatterAttempt = {
      verdict: decline.notApplicable ? 'deterministic_not_applicable' : 'deterministic_attempted_declined',
      solver: 'no_consensus_from_scatter',
      detail: decline.detail,
    };
    log(
      `no_consensus_from_scatter (KN-BP143-1 Defect 4 + KN-BP144-6 T1/T2 pre-accept-on-agreement ` +
      `attempt, swarm-deduped survivors=[${dedupedForPreAgreeScatter.map((c) => `${c.authority}:${c.letter}`).join(', ')}]) ` +
      `${preAgreeScatterAttempt.verdict} -- ${decline.detail}.`,
    );
  } catch (err) {
    preAgreeScatterAttempt = {
      verdict: 'deterministic_attempted_declined',
      solver: 'no_consensus_from_scatter',
      detail: `threw non-fatally, treated as an honest decline: ${err}`,
    };
    log(`no_consensus_from_scatter (post-swarm recheck, KN-BP143-1 Defect 4 + KN-BP144-6 T1/T2) threw (non-fatal, ensemble continues normally): ${err}`);
  }

  // 2+ candidates (now possibly including the swarm) -- re-check for a 2+ agreement. Adding the
  // swarm's letter can turn a prior disagreement into a cross-validated accept.
  const byLetter = new Map<string, AuthorityEnsembleCandidate[]>();
  for (const c of candidates) {
    const arr = byLetter.get(c.letter) ?? [];
    arr.push(c);
    byLetter.set(c.letter, arr);
  }
  const agreeingGroup = [...byLetter.values()].find((group) => group.length >= 2);
  if (agreeingGroup) {
    const groupHasStructured = hasStructuredCorroborator(agreeingGroup);
    // BP1xx STRUCTURED-CORROBORATOR GATE: if the agreeing group is still all LLM-class (no
    // wolfram_alpha/specialist_swarm among them -- e.g. the swarm fired but landed on a
    // DIFFERENT letter, or on the SAME letter but non-CONCORDANT so it never became a candidate
    // at all, see the HONESTY push-site note above), and the swarm we just fired actually reached
    // its own genuine CONCORDANT consensus on a letter that DIFFERS from this group's -- that is
    // a real structured dissent, not silence. Do not accept: fall through to the adjudication
    // block below (over the full candidate set, swarm dissent included) exactly like any other
    // persisting disagreement.
    const swarmStructurallyDisagrees =
      !groupHasStructured
      && swarmChosenLetterForGate !== null
      && swarmConcordanceForGate === 'CONCORDANT'
      && swarmChosenLetterForGate !== agreeingGroup[0]!.letter;
    if (!swarmStructurallyDisagrees) {
      // KN-BP144-5 T1: "before accepting on agreement, test whether the agreeing group spans more
      // than one derivation path." Reuses RULE 1's exact swarm-duplicate-elimination test
      // (eliminateDuplicateSwarmDerivationPath, via assessAgreeingGroupDerivationDiversity) -- the
      // SAME logic runCandidateSourceCascadeAdjudicator's RULE 1 already implements, no second,
      // divergent copy. This is the ONLY place `specialist_swarm` can ever appear inside an
      // agreeing 2+ group (the fast path above, before the swarm fires, can never produce a
      // singlepath verdict -- every candidate there is on its own distinct browser/Wolfram path).
      const diversity = assessAgreeingGroupDerivationDiversity(agreeingGroup);
      if (diversity.verdict === 'agree_multipath') {
        // KN-BP144-12 Part B ("THE ELIMINATOR ABOVE AGREEMENT"): before this multipath agreement
        // is allowed to return an accept, give the SAME register-resolution eliminator KN-BP144-4
        // already wired BELOW accept-on-agreement a chance to see (and void) it HERE, ABOVE. See
        // checkEliminatorConstraintAboveAgreement's own header comment for the full rationale and
        // this ticket's own measured scope. "An eliminator produces a constraint; an adjudicator
        // produces a choice; a choice that violates a constraint is invalid" -- agreement is just
        // a choice with more voices behind it; it does not override a constraint.
        const letterAboutToAccept = agreeingGroup[0]!.letter;
        const eliminatorAbove = await checkEliminatorConstraintAboveAgreement(researchQuery, mcOptions);
        const eliminatorVoidsThisAgreement =
          eliminatorAbove.constraintActive && !eliminatorAbove.survivorsOut.includes(letterAboutToAccept);
        if (eliminatorVoidsThisAgreement) {
          log(
            `KN-BP144-12 Part B: swarm-augmented agreement on ${letterAboutToAccept} ` +
            `(candidates=[${agreeingGroup.map((c) => c.authority).join(',')}], agree_multipath, ` +
            `${diversity.distinctPaths.length} distinct derivation paths) VOIDED -- above-agreement ` +
            `eliminator constraint survivors=[${eliminatorAbove.survivorsOut.join(',')}] EXCLUDE ` +
            `${letterAboutToAccept}. Consensus does not override a constraint (KN-BP144-4's own ` +
            `rule, unchanged) -- honest fall-through to disagree/adjudication over the FULL candidate ` +
            `set, never a fabricated re-pick and never THE CAKE METHOD (this return exits before that ` +
            `block). Eliminator trace:\n  ${eliminatorAbove.trace.join('\n  ')}`,
          );
          return {
            chosenLetter: null,
            corroboration: 'disagree',
            candidates,
            acceptedCandidates: [],
            adjudicationAttempted: false,
            swarmFired: true,
            swarmReceipt,
            reasoningFactComputeReceipt,
            preAgreeDeterministicScatterAttempt: preAgreeScatterAttempt,
            eliminatorAboveAgreementVoided: {
              letter: letterAboutToAccept,
              survivorsOut: eliminatorAbove.survivorsOut,
              trace: eliminatorAbove.trace,
            },
          };
        }
        const constraintNoteSwarm = eliminatorAbove.constraintActive
          ? `constrained to [${eliminatorAbove.survivorsOut.join(',')}] (does not exclude ${letterAboutToAccept})`
          : 'no active constraint';
        log(
          `swarm-augmented agreement on ${agreeingGroup[0]!.letter} ` +
          `(candidates=[${agreeingGroup.map((c) => c.authority).join(',')}]) -- ` +
          `${groupHasStructured ? 'structurally corroborated' : 'LLM-ONLY concordance (swarm yielded nothing usable to corroborate or contest it)'}, ` +
          `agree_multipath (${diversity.distinctPaths.length} distinct derivation paths: ` +
          `[${diversity.pathAssignments.join(', ')}]), accepted. ` +
          `KN-BP144-12 Part B above-agreement eliminator: ${constraintNoteSwarm}.`,
        );
        return {
          chosenLetter: agreeingGroup[0]!.letter, corroboration: 'agree', candidates,
          acceptedCandidates: agreeingGroup, adjudicationAttempted: false, swarmFired: true, swarmReceipt,
          reasoningFactComputeReceipt,
          structuredCorroborator: groupHasStructured,
          // BP141: mirrors groupHasStructured here -- a specialist_swarm member can only be part of
          // `agreeingGroup` when it survived the BP141 echo-abstention push-site check (genuine
          // Furnace-verified grounding), so "has a structured member" and "each agreeing member has
          // its own independent evidence" are the same test at this call site.
          independentCorroboration: groupHasStructured,
          agreeDerivationVerdict: diversity.verdict,
          agreeGroupPathAssignments: diversity.pathAssignments,
          // KN-BP144-6 T3: the pre-accept-on-agreement scatter attempt above already declined (or
          // this branch could not have been reached -- a fire there returns early and never falls
          // through to here), threaded through so a reader can see BOTH signals on this one accept.
          preAgreeDeterministicScatterAttempt: preAgreeScatterAttempt,
        };
      }
      log(
        `swarm-augmented agreement on ${agreeingGroup[0]!.letter} is agree_singlepath -- ` +
        `[${diversity.pathAssignments.join(', ')}] collapse to a single surviving derivation path ` +
        `once RULE 1's own swarm-duplicate elimination is applied -- this is NOT corroboration ` +
        `(KN-BP144-5 T1). Declining the accept, falling through exactly as if the candidates had ` +
        `disagreed.`,
      );
      // KN-BP144-5 T2: "a single-path agreement must not suppress a deterministic solver... when
      // T1 declines to accept, the pipeline must reach the deterministic solvers in the same way
      // it would have on genuine scatter." Re-run the SAME no_consensus_from_scatter check the
      // post-swarm recheck above already ran (KN-BP143-1 Defect 4), this time over a
      // derivation-path-deduped candidate set (RULE 1's own swarm-duplicate elimination applied to
      // the FULL candidate list, not just the agreeing group) -- the manufactured majority T1 just
      // declined was inflating the exact scatter arithmetic this solver's own B2/B3 gates depend
      // on. A null result changes nothing (falls through to THE CAKE METHOD, byte-for-byte); a
      // non-null result is accepted with the SAME 'deterministic_compute' shape every other call
      // site of this solver already uses. This can only ever ADD a correctly-gated deterministic
      // accept ahead of a same-path agreement's fallthrough -- it never widens
      // solveNoConsensusFromScatter's own B1-B4 gates.
      try {
        const { survivors: dedupedForScatter } = eliminateDuplicateSwarmDerivationPath(candidates);
        const independentSourcesDeduped: IndependentSourceVote[] = dedupedForScatter.map((c) => ({
          letter: c.letter,
          derivationPath: resolveCakeDerivationPath(c),
        }));
        const noConsensusAfterSinglepathDecline = solveNoConsensusFromScatter(researchQuery, mcOptions, independentSourcesDeduped);
        if (noConsensusAfterSinglepathDecline) {
          log(
            `no_consensus_from_scatter PROVED answer ${noConsensusAfterSinglepathDecline.letter} from ` +
            `the derivation-path-deduped scatter (KN-BP144-5 T2: re-checked after a single-path ` +
            `agreement was declined, before THE CAKE METHOD could run) -- ${noConsensusAfterSinglepathDecline.trace}.`,
          );
          return {
            chosenLetter: noConsensusAfterSinglepathDecline.letter,
            corroboration: 'deterministic_compute',
            candidates,
            acceptedCandidates: [{
              authority: 'deterministic_compute',
              letter: noConsensusAfterSinglepathDecline.letter,
              reasoning: noConsensusAfterSinglepathDecline.trace,
              sourceUrl: '',
              method: 'no_consensus_from_scatter',
            }],
            adjudicationAttempted: false,
            swarmFired: true,
            swarmReceipt,
            reasoningFactComputeReceipt,
            agreeDerivationVerdict: diversity.verdict,
            agreeGroupPathAssignments: diversity.pathAssignments,
            // KN-BP144-6 T3: distinct from THIS return's own fire (KN-BP144-5's T2, a later, separate
            // attempt) -- carries forward what the EARLIER (KN-BP144-6 T1) pre-accept-on-agreement
            // attempt said, which must have been a decline/not-applicable for execution to have
            // reached this far (a T1 fire returns early and never falls through to here).
            preAgreeDeterministicScatterAttempt: preAgreeScatterAttempt,
            deterministicOverride: {
              letter: noConsensusAfterSinglepathDecline.letter,
              optionValue: NaN,
              optionUnit: null,
              computedValue: NaN,
              computedUnit: null,
              sourceExpression: noConsensusAfterSinglepathDecline.trace,
              source: 'question_expression',
              method: 'no_consensus_from_scatter',
              computeProvenance: 'model_derived',
              computeProvenanceDetail:
                'Deciding evidence is the derivation-path-deduped scatter, re-checked after ' +
                'KN-BP144-5 T1 declined a single-path agreement as non-corroborative -- never a ' +
                'literal expression read from the question text itself.',
            },
          };
        }
        log(
          `no_consensus_from_scatter (KN-BP144-5 T2 recheck) found no scatter proof either -- ` +
          `falling through to THE CAKE METHOD.`,
        );
      } catch (err) {
        log(`no_consensus_from_scatter (KN-BP144-5 T2 recheck) threw (non-fatal, ensemble continues normally): ${err}`);
      }
    } else {
      log(
        `swarm STRUCTURALLY DISAGREES with LLM-only agreement on ${agreeingGroup[0]!.letter} ` +
        `(swarm reached CONCORDANT consensus on ${swarmChosenLetterForGate} instead) -- ` +
        `declining the accept, routing to adjudication over the full candidate set.`,
      );
    }
  }

  // Still all disagree even with the swarm folded in -- BP141-2 THE CAKE METHOD (N-Cut/N-Pick)
  // resolves it: every reachable participant cuts (blind, no candidate pool) AND picks (blind,
  // anonymized+shuffled+normalized pool, fresh context) -- never a single disputant judging its
  // own dispute. See runCakeMethodDisagreementResolution's own doc comment for A6-A13.
  log(`disagreement persists among ${candidates.map((c) => `${c.authority}:${c.letter}`).join(', ')} (swarm included) -- firing THE CAKE METHOD`);
  try {
    const cake = await runCakeMethodDisagreementResolution({
      researchQuery, mcOptions, candidates, config, bridge, browserLlmOverrides, log,
    });
    if (cake.chosenLetter && cake.acceptedCandidate) {
      return {
        chosenLetter: cake.chosenLetter,
        corroboration: 'adjudicated',
        candidates,
        acceptedCandidates: [cake.acceptedCandidate],
        adjudicationAttempted: true,
        swarmFired: true,
        swarmReceipt,
        reasoningFactComputeReceipt,
        cakeMethodUsed: cake.cakeMethodUsed,
        cutModels: cake.cutModels,
        cutDerivations: cake.cutDerivations,
        distinctDerivationCount: cake.distinctDerivationCount,
        cutScatter: cake.cutScatter,
        pickConvergence: cake.pickConvergence,
        cakeQuadrant: cake.cakeQuadrant,
        anonymizedOrderSeed: cake.anonymizedOrderSeed,
        cakeSelfPreferenceAudit: cake.cakeSelfPreferenceAudit,
        cakeSelfPreferenceRate: cake.cakeSelfPreferenceRate,
        cakeCuts: cake.cakeCuts,
        cakePicks: cake.cakePicks,
        minorityCutsOverridden: cake.minorityCutsOverridden,
        cakePickerCutterInvariant: cake.cakePickerCutterInvariant,
        cascadeCandidateProducer: cake.cascadeCandidateProducer,
        gomJabbarG5Advisory: cake.gomJabbarG5Advisory,
        // KN-BP144-6 T3: threaded through to the final adjudicated accept too, so a reader can
        // confirm the pre-accept-on-agreement scatter attempt declined/was-not-applicable on this
        // path (a fire anywhere upstream returns early and never reaches THE CAKE METHOD at all).
        preAgreeDeterministicScatterAttempt: preAgreeScatterAttempt,
      };
    }
    log('cake method resolved no plurality letter -- honest fall-through (abstain)');
    return {
      chosenLetter: null, corroboration: 'disagree', candidates, acceptedCandidates: [],
      adjudicationAttempted: true, swarmFired: true, swarmReceipt, reasoningFactComputeReceipt,
      preAgreeDeterministicScatterAttempt: preAgreeScatterAttempt,
      cakeMethodUsed: cake.cakeMethodUsed,
      cutModels: cake.cutModels,
      cutDerivations: cake.cutDerivations,
      distinctDerivationCount: cake.distinctDerivationCount,
      cutScatter: cake.cutScatter,
      pickConvergence: cake.pickConvergence,
      cakeQuadrant: cake.cakeQuadrant,
      anonymizedOrderSeed: cake.anonymizedOrderSeed,
      cakeSelfPreferenceAudit: cake.cakeSelfPreferenceAudit,
      cakeSelfPreferenceRate: cake.cakeSelfPreferenceRate,
      cakeCuts: cake.cakeCuts,
      cakePicks: cake.cakePicks,
      minorityCutsOverridden: cake.minorityCutsOverridden,
      cakePickerCutterInvariant: cake.cakePickerCutterInvariant,
      cascadeCandidateProducer: cake.cascadeCandidateProducer,
      gomJabbarG5Advisory: cake.gomJabbarG5Advisory,
    };
  } catch (err) {
    log(`cake method threw (non-fatal): ${err}`);
  }

  return {
    chosenLetter: null, corroboration: 'disagree', candidates, acceptedCandidates: [], adjudicationAttempted: true,
    swarmFired: true, swarmReceipt, reasoningFactComputeReceipt,
    // KN-BP144-6 T3: threaded through to this final honest fallthrough too -- never silently absent.
    preAgreeDeterministicScatterAttempt: preAgreeScatterAttempt,
  };
}

// ─── BP1xx Deterministic-Compute-Override ("let the calculator win the math") ──────────────
//
// THE BUG this exists to fix: for a computable question, the deterministic units-aware compute
// (computeUnitAwareMatch, compute_sidecar.ts) already PROVES it can solve the density case
// standalone (600 kg/m^3 -> 0.60 g/cc -> option C) -- but in the real flow it never got a chance
// to run, because it only ever lived in the compute-sidecar block far downstream of
// runAuthorityEnsemble's own accept/return (Stage F2). For a computable question the ensemble
// accepts first (an LLM/browser authority can flub unit arithmetic -- reason its way to the right
// number yet state the wrong letter when the MC options are in a different unit) and RETURNS
// before the compute-sidecar block is ever reached, so the flubbed answer wins.
//
// This function is the fix's pure decision core: given the letter the ensemble already chose and
// the reasoning text it was chosen from, it runs the SAME deterministic compute tiers the
// downstream compute-sidecar block uses against that reasoning (which is now available -- the
// authority has already produced it) and reports whether a deterministic letter should override
// the ensemble's. Exported and factored out of the Stage F2 call site specifically so it can be
// exercised in isolation by a focused test without having to fake the whole browser-authority/
// swarm ensemble.
//
// BP-DETERMINISTIC-OVERRIDE-3TIER: originally this ran ONLY computeUnitAwareMatch, so a
// computable question whose correct method was actually computeAnswer()+matchValueToOption() (a
// bare-number compute, no units involved) or the loan/repayment schedule solver never got a
// chance to override the ensemble -- those two tiers only ever lived in the compute-sidecar block
// far downstream, reached only when the ensemble's early return above never fired (e.g. the
// Scaccio loan question: the ensemble accepted a Perplexity/Google letter that resolved wrong,
// and neither tier 2 nor tier 3 was ever consulted). Widened to run the SAME three tiers, in the
// SAME order, the compute-sidecar block already uses:
//   (i)   computeUnitAwareMatch            -- unit-bearing quantity, synchronous
//   (ii)  computeAnswer + matchValueToOption -- bare-number expression/model/Wolfram compute
//   (iii) solveScheduleProblem              -- loan/repayment amortization schedule, synchronous
// Each tier is tried ONLY after the previous one returned null -- first single-confident-option
// match wins, never guesses (every tier keeps its own existing "exactly one option qualifies"
// honesty gate unchanged). Tier (ii) is the only async one (may call ollama/Wolfram), which is
// why this function itself is now async -- callers must await it. Any tier throwing is caught and
// treated as "this tier found nothing" (falls through to the next tier / honest ensemble
// fall-through), never propagated.
// ─── KN-BP141-10 (Founder-directed BP141): THE FORMAT-INDEPENDENT FALLBACK ─────────────────────
//
// "Every deterministic solver in this engine PARSES a prompt somebody else wrote... The cascade
// does NOT parse the given prompt. It COMPOSES ITS OWN QUERIES and does the arithmetic locally."
// This function is that mechanism, wired as a live dispatch harness (the SAME kind of harness
// KN-BP141-7 P6 built for the Cake Method, reused here for a genuinely different call site).
//
// C1 (WIRING): called from inside resolveDeterministicComputeOverride, AFTER every named parsing
// solver (tiers (i) through the no-consensus tier) and BEFORE the generic reasoning-text extraction
// tier -- see that function's own call site, just below this one, for the exact position. This
// function contributes a CANDIDATE ONLY -- it never eliminates any option and never touches any
// other tier's result. Reached only via the same `if (!deterministicOverride)` gate every other
// tier already uses, so "every named parser already returned null" is enforced by POSITION, not by
// anything in this function.
//
// C2 (GATE): evaluateFormatIndependentFallbackGate (plow_mc_elimination_cascade.ts) decides whether
// this question offers a decidable quantity at all, without parsing this question's own specific
// prompt shape -- see that function's own header for the two-signal rationale (numeric options /
// superlative-or-negation language) and its honest limitation. Gate-miss costs zero dispatches.
//
// NUMBERING NOTE: this ticket's own C1-C8 list is DISTINCT from plow_mc_elimination_cascade.ts's
// own internal C1-C5 stage labels. Mapping used throughout this function's comments: ticket-C3's
// shortcut uses the file's own C5 (evaluateSignificantFigureAccept); ticket-C4 ("accept condition is
// significant figures") IS that same C5 function's own accept condition; ticket-C5 ("bidirectional
// consistency is a hard gate on the source") is the file's own C4 (checkBidirectionalConsistency).
//
// C3 (SHORTCUT FIRST, "C5 first, C1-C4 only if needed"): when the gate fired via NUMERIC OPTIONS,
// this function tries the direct-quantity shortcut FIRST -- one composed query asking a source to
// state ONLY the deciding numeric quantity, verified via SymPy (C6, never the source's own stated
// arithmetic), checked against the option set via evaluateSignificantFigureAccept. Only when that
// shortcut is not attempted (fewer than 2 distinct numeric option values) or abstains does this
// function fall through to the full ranking mechanism (C1's own inverse-query framing for negated
// stems + the bidirectional-consistency-gated ranking, ticket-C5).
//
// C7 (SOURCE CAPTURE): when `bridge` is supplied, this function ALSO attempts one real
// getRawBrowserAuthorityFact (Perplexity) lookup for the same composed quantity query -- the ONE
// channel in this mechanism capable of returning a real, citable URL (local Ollama has no web access
// and cites nothing). Every returned URL is captured via buildCascadeSourceCapture, regardless of
// whether that source's own quantity ends up deciding. HONEST GAP: getRawBrowserAuthorityFact
// requires a REAL BrowserAuthorityBridge (main-process IPC to a live, logged-in browser session
// inside the running Electron app) -- it cannot be exercised by a standalone CLI verification script
// the way the local Ollama leg can; see this ticket's own verification report for exactly which
// checks exercised the live browser leg vs. the local-only mechanism.
//
// C8 (GOM JABBAR STAYS ADVISORY): Gom Jabbar G5 (tallyVotesStrikingFailures) is computed from this
// mechanism's own consistency result on the ranking path, exactly like KN-BP141-7 P6's Cake Method
// wiring -- `applied` is hard-coded false, never a runtime flag that could drift to true. It never
// strikes anything from this function's own candidate decision.
//
// Never throws to its caller -- every dispatch leg is individually try/caught, matching every other
// tier's own error-handling convention in resolveDeterministicComputeOverride.
// KN-BP142-7 (Founder-directed BP142, "FIX MNEMOSYNEC to have the cascade working"): a transport
// budget, sized to the work, for the elimination cascade's two bidirectional ranking calls ONLY
// (mostToLeastPrompt / leastToMostPrompt, below). NOT an acceptance threshold, margin, or
// consistency rule -- C4/checkBidirectionalConsistency's own comparison logic in
// plow_mc_elimination_cascade.ts is completely untouched by this constant; this only controls how
// long callOllama waits for a response to arrive before giving up.
//
// MEASURED CAUSE (KN-BP141-10's own verification (b), reconfirmed this ticket): the two ranking
// calls below ask llama3.3:70b to produce a FULL ordering of every option letter, twice (once
// most-to-least, once least-to-most). At BP141, 5 of 15 real bidirectional ranking calls on
// llama3.3:70b took 93 to 110 seconds. The pre-existing default (canonical_pipeline.ts's
// OLLAMA_TIMEOUT_MS, 30_000ms) aborts the request before a 70B model finishes producing two full
// orderings, so `mostToLeast`/`leastToMost` come back empty and checkBidirectionalConsistency
// correctly reports `noData: true` (an honest abstain caused by transport timeout, not a real
// self-inconsistency finding).
//
// 180_000ms (3 minutes) gives roughly 1.6x headroom over the observed 110s ceiling, sized to the
// two-full-ordering workload actually being asked of the model, not chosen to force any particular
// outcome. This constant affects ONLY the two callOllama call sites inside
// runEliminationCascadeFormatIndependentFallback that pass it explicitly, below -- see callOllama's
// own doc comment in canonical_pipeline.ts for the full enumeration of every other call site this
// change does NOT affect (all of which keep the original 30_000ms default byte-for-byte).
const ELIMINATION_CASCADE_RANKING_TIMEOUT_MS = 180_000;

function extractArithmeticSubstring(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (/^[\d+\-*/^().eE\s]+$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/-?\d+(?:\.\d+)?(?:\s*[-+*/^]\s*-?\d+(?:\.\d+)?)+|-?\d+(?:\.\d+)?/);
  return m ? m[0] : null;
}

async function runEliminationCascadeFormatIndependentFallback(
  researchQueryForTiers: string,
  mcOptions: McOption[],
  computeOpts: { ollamaBaseUrl?: string; model?: string },
  bridge: BrowserAuthorityBridge | undefined,
  log: (msg: string) => void,
): Promise<{ candidate: DeterministicComputeCandidate | null; receipt: EliminationCascadeFallbackReceipt }> {
  const gate = evaluateFormatIndependentFallbackGate(researchQueryForTiers, mcOptions);
  log(`gate: ${gate.trace}`);
  if (!gate.fires) {
    return {
      candidate: null,
      receipt: {
        attempted: false,
        decided: false,
        gate,
        tierUsed: null,
        consistency: null,
        sourceCaptures: [],
        gomJabbarG5Advisory: null,
        trace: `NOT ATTEMPTED: ${gate.trace}`,
      },
    };
  }

  const sourceCaptures: CascadeSourceCapture[] = [];
  const validLetters = new Set(mcOptions.map((o) => o.letter));
  const model = computeOpts.model ?? '';
  const ollamaBaseUrl = computeOpts.ollamaBaseUrl ?? '';

  // ── ticket-C3 shortcut: direct-quantity identification, tried FIRST when numeric options exist ──
  const distinctNumericValues = new Set(gate.numericOptionValues.map((o) => o.value)).size;
  if (distinctNumericValues >= 2) {
    const quantityQuery =
      `${researchQueryForTiers.trim()}\n\nState ONLY the single numeric value (a plain number, or a ` +
      'simple arithmetic expression using + - * / and parentheses, e.g. 750/1.25) that is the ' +
      'deciding quantity for this question. No words, no units, no explanation -- the number or ' +
      'expression alone, nothing else.';

    // C7: attempt the ONE real, citable source first (Perplexity, via the caller-supplied bridge).
    let browserQuantity: number | null = null;
    let browserQuantitySympyVerified = false;
    if (bridge) {
      try {
        const rawFact = await getRawBrowserAuthorityFact(
          quantityQuery,
          { researchArmMode: true, researchArmBrowserAuthority: true, preferredAuthority: 'user_perplexity' },
          bridge,
        );
        if (rawFact && rawFact.fact) {
          const capture = buildCascadeSourceCapture(rawFact.sourceUrl, rawFact.fact, quantityQuery, rawFact.authority);
          if (capture) {
            sourceCaptures.push(capture);
            log(`C7 source capture: url=${capture.url} claim="${capture.claim}"`);
          }
          const extracted = extractArithmeticSubstring(rawFact.fact);
          if (extracted) {
            const sympyResult = await runSympyArithmetic(extracted);
            if (sympyResult) {
              browserQuantity = sympyResult.value;
              browserQuantitySympyVerified = true;
            }
          }
          if (browserQuantity === null) {
            const n = extractNumber(rawFact.fact);
            if (n !== null) browserQuantity = n; // honest fallback, NOT SymPy-verified
          }
        }
      } catch (err) {
        log(`C7 browser-authority quantity lookup threw (non-fatal): ${err}`);
      }
    }

    // Local self-consistency leg: always attempted (zero marginal cost, no bridge dependency), the
    // same config.model this whole answerer already uses elsewhere for local dispatch.
    let localQuantity: number | null = null;
    let localQuantitySympyVerified = false;
    try {
      const raw = await callOllama(quantityQuery, ollamaBaseUrl, model, 0);
      if (raw) {
        const extracted = extractArithmeticSubstring(raw);
        if (extracted) {
          const sympyResult = await runSympyArithmetic(extracted);
          if (sympyResult) {
            localQuantity = sympyResult.value;
            localQuantitySympyVerified = true;
          }
        }
        if (localQuantity === null) {
          const n = extractNumber(raw);
          if (n !== null) localQuantity = n;
        }
      }
    } catch (err) {
      log(`local-orchestrator quantity dispatch threw (non-fatal): ${err}`);
    }

    // Prefer the citable (browser-authority) quantity when available -- it carries a real source;
    // the local quantity is this mechanism's own fallback when no bridge was supplied or the
    // browser leg returned nothing usable.
    const chosenQuantity = browserQuantity !== null ? browserQuantity : localQuantity;
    const chosenSympyVerified = browserQuantity !== null ? browserQuantitySympyVerified : localQuantitySympyVerified;
    const chosenSourceLabel = browserQuantity !== null ? 'browser_authority:user_perplexity' : 'local_orchestrator';

    if (chosenQuantity !== null) {
      const acceptResult = evaluateSignificantFigureAccept(chosenQuantity, gate.numericOptionValues);
      log(
        `ticket-C3/C5 shortcut: quantity=${chosenQuantity} (source=${chosenSourceLabel}, ` +
        `sympyVerified=${chosenSympyVerified}) -- ${acceptResult.trace}`,
      );
      if (acceptResult.accept && acceptResult.letter) {
        const matchedOption = gate.numericOptionValues.find((o) => o.letter === acceptResult.letter);
        const sourceNote = sourceCaptures.length > 0
          ? ` | C7 captured ${sourceCaptures.length} source(s): ${sourceCaptures.map((c) => c.url).join(', ')}`
          : ' | C7: no source URL captured this question.';
        const trace =
          `${gate.trace} | ticket-C3/C5 SHORTCUT ACCEPTED: quantity=${chosenQuantity} ` +
          `(source=${chosenSourceLabel}, SymPy-verified=${chosenSympyVerified}) -> option ` +
          `${acceptResult.letter} | ${acceptResult.trace}${sourceNote}`;
        return {
          candidate: {
            letter: acceptResult.letter,
            optionValue: matchedOption ? matchedOption.value : NaN,
            optionUnit: null,
            computedValue: chosenQuantity,
            computedUnit: null,
            sourceExpression: trace,
            source: 'question_expression',
            method: 'elimination_cascade_fallback',
            cascadeFiredAfterParserMiss: true,
            // KN-BP143-1b: the deciding quantity (chosenQuantity) is COMPOSED and DISPATCHED --
            // either to a real browser authority (Perplexity, via bridge, C7) or to the local
            // Ollama model -- never read off the question text by this mechanism itself (that is
            // exactly why every NAMED parsing solver is tried first, per this tier's own position
            // documented above: those solvers derive from the question, this one asks someone/
            // something else). SymPy (runSympyArithmetic) verifies the RETURNED expression
            // evaluates correctly -- it verifies arithmetic, not truth, and never verifies that the
            // quantity itself is correct or that it came from the question. `source:
            // 'question_expression'` above is honestly wrong for this tier for the same reason as
            // no_consensus_from_scatter's own note elsewhere in this file; computeProvenance is
            // the correction. May corroborate; per gate 2 must never independently root/override.
            computeProvenance: 'model_derived',
            computeProvenanceDetail:
              `Deciding quantity ${chosenQuantity} was obtained by dispatching a FRESHLY COMPOSED ` +
              `query to ${chosenSourceLabel} (SymPy-verified=${chosenSympyVerified}, meaning ` +
              'arithmetic-checked, not truth-checked) -- never read off the question text, which ' +
              'is the entire reason every named parsing solver is tried first, ahead of this tier.',
          },
          receipt: {
            attempted: true,
            decided: true,
            gate,
            tierUsed: 'c5_shortcut',
            consistency: null,
            sourceCaptures,
            gomJabbarG5Advisory: null,
            trace,
          },
        };
      }
    } else {
      log('ticket-C3/C5 shortcut: neither the browser-authority leg nor the local leg produced a usable quantity -- falling through to ranking.');
    }
  }

  // ── full C1/ticket-C5 ranking mechanism (bidirectional-consistency-gated) ──────────────────────
  const stemForRanking = gate.negationSignal
    ? (buildInverseQueryFraming(researchQueryForTiers) ?? researchQueryForTiers)
    : researchQueryForTiers;
  const optionLines = mcOptions.map((o) => `${o.letter}) ${o.text}`).join('\n');
  const mostToLeastPrompt =
    `${stemForRanking.trim()}\n\nOptions:\n${optionLines}\n\nRank ALL of the option letters above from ` +
    'MOST confident correct to LEAST confident correct. Reply with exactly one letter per line, most ' +
    'confident first, every letter listed exactly once, nothing else.';
  const leastToMostPrompt =
    `${stemForRanking.trim()}\n\nOptions:\n${optionLines}\n\nRank ALL of the option letters above from ` +
    'LEAST confident correct to MOST confident correct. Reply with exactly one letter per line, least ' +
    'confident first, every letter listed exactly once, nothing else.';

  // C7 (EXTENDED, KN-BP142-3 Phase 2): the ranking mechanism above never had its own citable-
  // source attempt -- unlike the ticket-C3 shortcut leg above (which already calls
  // getRawBrowserAuthorityFact), the two Ollama ranking calls below have no web access and cite
  // nothing, so this path structurally guaranteed "no citable source" (see this function's own
  // sourceNote text further down, still the honest fallback when no capture is made here). Per
  // Founder mandate ("that needs to happen always," BP142, on the 13 sources his own manual
  // cascade surfaced that this capture was silently dropping): when a bridge IS supplied, attempt
  // ONE more real getRawBrowserAuthorityFact lookup here too, purely for C7 capture. Capture-only,
  // additive, never affects mostToLeast/leastToMost/candidateLetter below -- same try/caught,
  // non-blocking discipline as every other bridge call in this file, and the SAME sourceCaptures
  // array the shortcut leg above already pushes into, so a caller sees one combined list
  // regardless of which leg(s) actually captured something.
  if (bridge) {
    try {
      const rankingSourceQuery =
        `${stemForRanking.trim()}\n\nState the single most relevant fact, with its source, that helps ` +
        'decide this question.';
      const rawFact = await getRawBrowserAuthorityFact(
        rankingSourceQuery,
        { researchArmMode: true, researchArmBrowserAuthority: true, preferredAuthority: 'user_perplexity' },
        bridge,
      );
      if (rawFact && rawFact.fact) {
        const capture = buildCascadeSourceCapture(rawFact.sourceUrl, rawFact.fact, rankingSourceQuery, rawFact.authority);
        if (capture) {
          sourceCaptures.push(capture);
          log(`C7 source capture (ranking mechanism): url=${capture.url} claim="${capture.claim}"`);
        }
      }
    } catch (err) {
      log(`C7 browser-authority source capture (ranking mechanism) threw (non-fatal): ${err}`);
    }
  }

  let mostToLeast: string[] = [];
  let leastToMost: string[] = [];
  try {
    // KN-BP142-7: explicit widened timeout (ELIMINATION_CASCADE_RANKING_TIMEOUT_MS, see its own
    // doc comment above) on these two calls only -- numPredict stays the pre-existing default
    // (256, unchanged) since only the transport budget was under-sized, not the token budget.
    const rawMostToLeast = await callOllama(mostToLeastPrompt, ollamaBaseUrl, model, 0, 256, ELIMINATION_CASCADE_RANKING_TIMEOUT_MS);
    mostToLeast = extractLetterRankingSequence(rawMostToLeast, validLetters);
    const rawLeastToMost = await callOllama(leastToMostPrompt, ollamaBaseUrl, model, 0, 256, ELIMINATION_CASCADE_RANKING_TIMEOUT_MS);
    leastToMost = extractLetterRankingSequence(rawLeastToMost, validLetters);
  } catch (err) {
    log(`ranking dispatch threw (non-fatal, no candidate produced): ${err}`);
    return {
      candidate: null,
      receipt: {
        attempted: true,
        decided: false,
        gate,
        tierUsed: null,
        consistency: null,
        sourceCaptures,
        gomJabbarG5Advisory: null,
        trace: `${gate.trace} | ranking dispatch threw before both calls completed -- no candidate.`,
      },
    };
  }

  const consistency = checkBidirectionalConsistency(
    'local_orchestrator:elimination_cascade_format_independent_fallback',
    mostToLeast,
    leastToMost,
  );
  log(`ticket-C5 (bidirectional consistency): ${consistency.trace}`);

  const g5Vote: GomJabbarVote = {
    source: consistency.source,
    letter: mostToLeast[0] ?? '',
    admissible: consistency.consistent,
    failureReason: consistency.consistent ? undefined : 'bidirectional consistency failed',
  };
  const g5Tally = tallyVotesStrikingFailures([g5Vote]);
  const gomJabbarG5Advisory = {
    applied: false as const,
    wouldStrike: g5Tally.strickenSources.length > 0,
    strickenSources: g5Tally.strickenSources,
    admissibleSources: g5Tally.admissibleSources,
    tally: g5Tally.tally,
    trace: `${g5Tally.trace} (KN-BP141-10: ADVISORY ONLY, applied=false -- G5's strike never excludes this candidate.)`,
  };
  log(`gom-jabbar-g5-advisory: ${gomJabbarG5Advisory.trace}`);

  const sourceNote = sourceCaptures.length > 0
    ? ` | C7 captured ${sourceCaptures.length} source(s): ${sourceCaptures.map((c) => c.url).join(', ')}`
    : ' | C7: no source URL captured this question (local ranking mechanism only, no citable source).';

  if (!consistency.consistent || mostToLeast.length === 0) {
    return {
      candidate: null,
      receipt: {
        attempted: true,
        decided: false,
        gate,
        tierUsed: null,
        consistency,
        sourceCaptures,
        gomJabbarG5Advisory,
        trace:
          `${gate.trace} | ticket-C5 ranking mechanism ATTEMPTED, source INADMISSIBLE (bidirectional ` +
          `consistency failed or empty ranking) -- no candidate produced. ${consistency.trace}${sourceNote}`,
      },
    };
  }

  const candidateLetter = (gate.negationSignal ? mostToLeast[mostToLeast.length - 1] : mostToLeast[0]) as string;
  const trace =
    `${gate.trace} | ticket-C1/C5 RANKING ACCEPTED: source bidirectionally consistent ` +
    `(mostToLeast=[${mostToLeast.join(',')}]) -> option ${candidateLetter}` +
    `${gate.negationSignal ? ' (negated stem -- candidate is the LEAST-affirmed option, per C1 inverse-query framing)' : ''} ` +
    `| ${consistency.trace}${sourceNote}`;

  return {
    candidate: {
      letter: candidateLetter,
      optionValue: NaN,
      optionUnit: null,
      computedValue: NaN,
      computedUnit: null,
      sourceExpression: trace,
      source: 'question_expression',
      method: 'elimination_cascade_fallback',
      cascadeFiredAfterParserMiss: true,
      // KN-BP143-1b: same rationale as the C3/C5 shortcut leg above -- the deciding evidence here
      // is a most-to-least/least-to-most RANKING dispatched to a model (local Ollama, plus a C7
      // capture attempt to a real browser authority when a bridge is supplied), gated only on
      // BIDIRECTIONAL SELF-CONSISTENCY (the two orderings agreeing with each other), never on
      // agreement with anything read from the question text. Self-consistency is not truth --
      // model_derived: may corroborate, per gate 2 must never independently root/override.
      computeProvenance: 'model_derived',
      computeProvenanceDetail:
        `Deciding evidence is a most-to-least/least-to-most option RANKING dispatched to a model ` +
        `(bidirectionally self-consistent: ${consistency.trace}) -- ranking language and preference ` +
        'are supplied by the model, never read verbatim off the question text.',
    },
    receipt: { attempted: true, decided: true, gate, tierUsed: 'c1_c4_ranking', consistency, sourceCaptures, gomJabbarG5Advisory, trace },
  };
}

// KN-BP143-1b (Bishop ADDENDUM A, prompted by Knight's own gate 5 tracing on KN-BP143-1): the
// label conflation this ticket exists to close. `source`/`method` above answer "which tier
// produced this," never "were the operands this tier used actually verbatim in the question."
// qid 27 (wood density) and qid 15 (60-day sight-draft) both carried the IDENTICAL
// method='bare_value'/source='question_expression' label pre-KN-BP143-1 -- qid 15 flipped J-then-
// C 26 minutes apart on identical input (genuinely stochastic, tier (ii)'s model_derived_expression
// path), while qid 27's own pre-fix answer was ALSO riding that same stochastic path and only
// happened to land correctly, run after run, until it didn't have to any more (KN-BP143-1 Defect 3
// closed the tier (ii) leak; qid 27 now correctly falls through to density_solver). One label, two
// provenances, no receipt field able to tell them apart. Modeled on the Rooting Rule
// (rooting_rule.ts): exactly two values, deliberately no third "trust it anyway" tier.
//
// NAMING NOTE (deviation from the addendum's suggested field name, reported per this ticket's own
// gate 5 consumer-audit discipline): the addendum's own prose calls this `derivationPath`. This
// file ALREADY has a field of that exact name -- `IndependentSourceVote.derivationPath` /
// `CakeDerivationPath` (defined ~line 1207, consumed at 20+ call sites: resolveCakeDerivationPath,
// cakeCuts/cakePicks, minorityCutsOverridden, etc.) -- an entirely unrelated concept: WHICH
// independence-unit (browser:user_perplexity / local_orchestrator:pick / deterministic_solver:*)
// cast a given vote, for the Cake Method's own quorum/independence accounting. Reusing the same
// field name for a second, unrelated meaning on a different interface would recreate this exact
// ticket's own bug class one layer up -- a shared label covering two different things, this time
// at the field-name layer instead of the value layer. Named `computeProvenance` /
// `computeProvenanceDetail` instead; flagged here for Bishop/Founder to ratify or rename.
export type ComputeProvenance = 'literal_expression' | 'model_derived';

/** THE FIX, gate 4's fail-closed default lives here: literal_expression may root a
 *  deterministic-override decision (become finalLetter, earn verified:true, mint a formula/method
 *  eblet); model_derived may be recorded and may corroborate, but per this function's own
 *  ONLY-CALLER-SITES-BELOW discipline, must never independently decide/override through the
 *  deterministic-override path. Fails closed by construction: every consumer below tests
 *  `=== 'literal_expression'` (never `!== 'model_derived'`), so a third, future, unanticipated
 *  value -- or an absent field on some caller this audit missed -- reads as model_derived, never
 *  as literal_expression. Absence of proof is not proof (BP139 computeHonestVerification
 *  precedent, cited verbatim in the addendum). */
export function isLiteralExpressionProvenance(
  candidate: Pick<DeterministicComputeCandidate, 'computeProvenance'> | null | undefined,
): boolean {
  return !!candidate && candidate.computeProvenance === 'literal_expression';
}

/** Tier (i)/(viii)'s shared classifier: computeUnitAwareMatch (compute_sidecar.ts) reports
 *  `source: 'question_expression'` for its own path (b) (a unit-bearing expression literally
 *  contiguous in the QUESTION text -- every operand traced to the question, literal_expression) and
 *  `source: 'reasoning_fact'` for paths (a)/(c) (a quantity pulled out of an authority's own
 *  reasoning/fact text -- an operand supplied by an authority's output, model_derived, exactly
 *  pattern (b) in the addendum's own two-provenance framing). Derived dynamically off the REAL
 *  returned `source`, never assumed from which tier called it -- tier (viii) re-tries path (b)
 *  internally too (harmless dead code path per that tier's own doc comment), so a defensive dynamic
 *  check here is correct even though tier (viii) in practice only ever reaches path (a)/(c). */
function classifyUnitAwareComputeProvenance(source: string): { computeProvenance: ComputeProvenance; computeProvenanceDetail: string } {
  if (source === 'question_expression') {
    return {
      computeProvenance: 'literal_expression',
      computeProvenanceDetail:
        'Unit-bearing expression (computeUnitAwareMatch path (b)) was literally contiguous in the ' +
        'question text -- every operand traced verbatim to the question, none from an authority\'s ' +
        'reasoning or a model sample.',
    };
  }
  return {
    computeProvenance: 'model_derived',
    computeProvenanceDetail:
      `Deciding quantity was extracted from an authority's own reasoning/fact text ` +
      `(computeUnitAwareMatch source='${source}', paths (a)/(c)), not the question itself -- a ` +
      'derived restatement of whichever authority it was pulled from, not an independent literal ' +
      'expression.',
  };
}

export interface DeterministicComputeCandidate {
  letter: string;
  optionValue: number;
  optionUnit: string | null;
  computedValue: number;
  computedUnit: string | null;
  sourceExpression: string;
  source: string;
  /** Tier tag, one of 'unit_aware' | 'bare_value' | 'schedule_amortization' | 'density' |
   *  'physics_kepler' | 'aircraft_lift_drag' -- see the six tiers documented above (tier (v),
   *  physics_kepler, and tier (vi), aircraft_lift_drag, added subsequently -- see
   *  plow_mc_physics_solver.ts and plow_mc_aircraft_solver.ts). Deliberately `string` (not a
   *  narrow literal union) so this type can represent the result of any of the independently-typed
   *  underlying tiers without forcing them into a shared method-name vocabulary they don't
   *  actually share. */
  method: string;
  /** KN-BP141-10 (Founder-directed BP141), OPTIONAL/ADDITIVE. True ONLY on the one
   *  DeterministicComputeCandidate produced by runEliminationCascadeFormatIndependentFallback below
   *  -- absent (never false) on every other tier's candidate. Ticket's own C2: "so we can measure
   *  how often the fallback is what saved the answer" -- this field is that measurement's anchor;
   *  every candidate carrying it true is, by this tier's own position in
   *  resolveDeterministicComputeOverride (after every named parsing solver), a question where every
   *  named parser had already failed and this format-independent mechanism is what produced the
   *  final letter. */
  cascadeFiredAfterParserMiss?: boolean;
  /** KN-BP143-1b (Bishop ADDENDUM A): REQUIRED, not optional -- see this ticket's own "fail closed
   *  on a missing field" mandate. `source`/`method` above name WHICH tier answered; this names
   *  WHETHER that tier's operands were verbatim question text (`literal_expression`, may root) or
   *  drawn from a model/authority/substrate output (`model_derived`, may corroborate, may never
   *  root). See isLiteralExpressionProvenance() just above for the one predicate every consumer
   *  gates on, and ComputeProvenance's own doc comment for the naming-collision note. */
  computeProvenance: ComputeProvenance;
  /** KN-BP143-1b: REQUIRED. Human-readable, per-operand provenance note -- addendum's own point 4,
   *  "record which operands came from where." Never a fixed boilerplate string per tier: each call
   *  site states, in its own words, which concrete operand(s) this specific result depended on and
   *  why that does or does not satisfy literal_expression. */
  computeProvenanceDetail: string;
}
export interface EliminationCascadeFallbackReceipt {
  attempted: boolean;
  decided: boolean;
  gate: import('./plow_mc_elimination_cascade').FormatIndependentFallbackGate;
  tierUsed: 'c5_shortcut' | 'c1_c4_ranking' | null;
  consistency: BidirectionalConsistencyResult | null;
  sourceCaptures: CascadeSourceCapture[];
  gomJabbarG5Advisory: { applied: false; wouldStrike: boolean; strickenSources: string[]; admissibleSources: string[]; tally: Record<string, number>; trace: string } | null;
  trace: string;
}
/**
 * KN-BP143-1b CONSUMER-AUDIT WARNING, READ BEFORE CALLING THIS FUNCTION DIRECTLY:
 *
 * This function's own returned `overrideFired`/`finalLetter` are PRE-DEMOTION -- they reflect
 * ONLY "did some tier produce a candidate whose letter differs from ensembleChosenLetter," with
 * NO check of `deterministicOverride.computeProvenance` at all. A `model_derived` candidate (one
 * or more deciding operands came from a model/authority output, never the question text) can and
 * will set `overrideFired: true` here exactly as readily as a genuine `literal_expression` proof.
 *
 * The actual "is this candidate allowed to become the final answer" gate is NOT inside this
 * function -- it lives one layer up, at this file's own two call sites
 * (runAuthorityEnsemble's pre-branch hoist, tagged BP-ECHO-NO-VOTE; and runCanonicalPlowMcAnswer's
 * Stage F2, tagged BP-COMPUTE-DEMOTE-SITE-2), both of which independently re-check
 * `isLiteralExpressionProvenance(deterministicOverride)` on this function's own returned
 * candidate before trusting `overrideFired`/`finalLetter` for anything.
 *
 * ANY new caller of this function -- a script, a test, a future refactor -- MUST apply that same
 * check itself: call isLiteralExpressionProvenance(result.deterministicOverride) and decline to
 * let the candidate decide anything when it returns false, exactly as both existing call sites do.
 * Trusting `result.overrideFired` directly, without that check, reproduces the exact
 * commit-`1803828c`-shaped bug this ticket's own addendum warns about, one layer up: a
 * coincidence wearing a proof's label. See `isLiteralExpressionProvenance` (exported, just above
 * this function) for the one-line predicate to call.
 */
export async function resolveDeterministicComputeOverride(
  researchQuery: string,
  mcOptions: McOption[],
  ensembleChosenLetter: string,
  reasoningTexts: string[],
  computeOpts: { ollamaBaseUrl?: string; model?: string; wolframAppId?: string } = {},
  // BP141-2 Task B: OPTIONAL/ADDITIVE. Absent/empty on every pre-existing caller (byte-identical
  // behavior -- the tier below trivially fails its own >= 3 distinct-derivation-paths gate on an
  // empty array and returns null, same as any other tier's "missing piece" honest abstain). See
  // plow_mc_no_consensus_solver.ts's header for the full gate this feeds.
  independentSources: IndependentSourceVote[] = [],
  // KN-BP141-10: OPTIONAL/ADDITIVE, undefined on every pre-existing caller (both this file's own
  // two call sites are updated this ticket to pass their already-in-scope bridge; any OTHER caller,
  // e.g. scratchpad/verify_kn_bp141_3_wiring_advisory_signals.js, which calls this function directly
  // against the compiled dist without a bridge argument, is unaffected -- see this ticket's own C7
  // call site below for the honest "bridge absent -> zero source captures, never a fabricated one"
  // behavior). Enables C7 (mandatory source capture): when present, the format-independent fallback
  // ALSO attempts one real, citable browser-authority (Perplexity) lookup for the deciding quantity,
  // alongside its own local self-consistency mechanism, which never carries a citable URL.
  bridge?: BrowserAuthorityBridge,
): Promise<{
  finalLetter: string;
  overrideFired: boolean;
  deterministicOverride: DeterministicComputeCandidate | null;
  // KN-BP141-3: OPTIONAL/ADDITIVE, same "byte-identical for every pre-existing caller" contract as
  // `independentSources` above -- every existing call site that destructures only
  // finalLetter/overrideFired/deterministicOverride is unaffected. Populated unconditionally below
  // (Stage 0/1 never throw uncaught -- see the try/catch immediately after researchQueryForTiers),
  // never influences finalLetter/overrideFired/deterministicOverride itself.
  advisorySignals: { vettingFlags: QuestionVettingFlags | null; eliminationChart: EliminationChartResult | null };
  // KN-BP141-10: OPTIONAL/ADDITIVE, same contract as `advisorySignals` above -- every pre-existing
  // caller that destructures only finalLetter/overrideFired/deterministicOverride/advisorySignals is
  // byte-for-byte unaffected. null when the tier was never REACHED (a strictly earlier tier -- tiers
  // (i) through (ix, no-consensus) -- already produced a deterministicOverride, so per this tier's
  // own `if (!deterministicOverride)` gate it never ran at all). Non-null whenever the tier was
  // reached, whether or not its own gate fired, whether or not it decided -- see
  // EliminationCascadeFallbackReceipt's own field docs for the full attempted/decided distinction.
  cascadeFallback: EliminationCascadeFallbackReceipt | null;
  // KN-BP143-1 Defect 2: the cascade's own candidate, ALWAYS reported here when it decided one --
  // whether or not it was actually promoted into `deterministicOverride`/`finalLetter` (see the
  // advisory-only gate at this tier's own call site above). Lets a caller/receipt/test see "what
  // the eliminator would have said" even on a call where a real ensemble answer correctly kept it
  // from firing. null whenever the tier was never reached or never decided.
  cascadeAdvisoryCandidate: DeterministicComputeCandidate | null;
}> {
  let deterministicOverride: DeterministicComputeCandidate | null = null;

  // BP-DETERMINISTIC-OVERRIDE-DEGLUE: real MMLU-Pro question text sometimes ships with a
  // trigger keyword glued directly onto the preceding word with zero whitespace -- e.g. the
  // canonical Scaccio loan question's REAL text (verified against
  // resources/mmlu_pro/business/questions_raw.json this Yoke) is
  // "Mr.Scaccioborrows $100 from his credit union and agrees to pay back $20 a month with
  // interest of 1% per month on the unpaid balance..." -- "Scaccio" and "borrows" glued with no
  // space, an upstream dataset artifact, not something this app produced. Tier (iii)'s
  // plow_mc_schedule_solver.ts (PRESERVED UNCHANGED this Yoke) intentionally gates its whole
  // parse on `\b(borrows?|borrowed|loan|owes?)\b` -- a deliberate, conservative "never guess"
  // word-boundary requirement -- but a JS `\b` is a transition between a word char and a
  // non-word char, so it never fires inside "Scaccioborrows" (both neighboring chars are word
  // chars). The result: solveScheduleProblem() returns an honest null on the REAL Scaccio text
  // even though every other piece of loan structure (principal/payment/rate/period) is fully
  // present and unambiguous a few characters later in the very same sentence -- confirmed via
  // the decisive experiment (resolveDeterministicComputeOverride returned
  // {overrideFired:false, deterministicOverride:null} against the real parsed options until this
  // fix). Rather than loosening that solver's own regex (out of scope -- the file is preserved),
  // this call site inserts back the ONE missing space, and ONLY directly in front of one of that
  // solver's own trigger words, and ONLY when it is glued to a preceding lowercase letter with
  // zero whitespace. This can only ever CREATE a word boundary the solver's gate needs to even
  // begin considering the question -- a false-positive glue-split still has to separately clear
  // principal/payment/rate/matching-period/single-option-tolerance, all far more specific -- so
  // this never invents or changes any number, it only repairs one missing space. Applied to a
  // local copy fed to all three tiers (never mutates the caller's researchQuery/reasoning), so a
  // question with no such glue is byte-for-byte unaffected (the replace is a no-op).
  const researchQueryForTiers = researchQuery.replace(
    /([a-z])(borrows|borrowed|owes|owe|loans|loan)\b/gi,
    '$1 $2',
  );

  // KN-BP141-3 Stage 0 (question vetting, V1/V2/V3) + Stage 1 (semantic elimination chart,
  // R1/R2/R3) -- runs BEFORE every tier below, exactly per Stage 0's own "runs BEFORE any solver"
  // requirement. Both are pure/synchronous/no-I/O (see each module's own header); wrapped in a
  // non-fatal try/catch, matching every other tier's own error-handling convention in this
  // function, so a crash in either can never break the pre-existing override pipeline. NEITHER
  // touches `deterministicOverride` -- Stage 0 never answers by its own contract, and Stage 1's
  // three rules are ADVISORY ONLY in this commit (all three measured over the real 10,956-question
  // dataset at false-negative rates far over the ~2% threshold that would permit a hard gate; see
  // scratchpad/commit_msg_bp141_3_stage1.txt for the exact per-rule rates). Both results are
  // reported out via the new `advisorySignals` return field for a future receipt/weighting
  // consumer to use, never acted on here.
  let stage0VettingFlags: QuestionVettingFlags | null = null;
  let stage1EliminationChart: EliminationChartResult | null = null;
  try {
    stage0VettingFlags = vetQuestion(researchQueryForTiers, mcOptions);
    stage1EliminationChart = runEliminationChart(researchQueryForTiers, mcOptions);
    if (stage0VettingFlags.registerConflict || stage0VettingFlags.scaleMismatch || stage0VettingFlags.paraphraseCollisions.length > 0) {
      console.log(`[plow_mc_answerer] KN-BP141-3 Stage 0 advisory flags (never changes a letter): ${JSON.stringify(stage0VettingFlags)}`);
    }
    if (stage1EliminationChart.survivors.length < mcOptions.length) {
      console.log(`[plow_mc_answerer] KN-BP141-3 Stage 1 advisory elimination chart (ADVISORY ONLY, not a hard gate): survivors=[${stage1EliminationChart.survivors.join(',')}] eliminationsByRule=${JSON.stringify(stage1EliminationChart.eliminationsByRule)}`);
    }
  } catch (err) {
    console.warn('[plow_mc_answerer] resolveDeterministicComputeOverride: KN-BP141-3 Stage 0/Stage 1 threw (non-fatal, advisory only, override pipeline unaffected):', err);
  }

  // BP-SPECIFIC-BEFORE-GENERIC (this pass, Bishop-directed fix): the SEVEN tiers below are no
  // longer tried in their historical add-order. THE BUG this closes: computeUnitAwareMatch
  // (compute_sidecar.ts) is not just "tier (i), a unit-bearing quantity" -- internally it tries
  // THREE paths in order: (b) a unit-bearing expression literally contiguous in the QUESTION text,
  // then (a) a unit-bearing quantity pulled out of an authority's own REASONING/FACT text
  // (`componentFacts`, i.e. `reasoningTexts` below), then (c) a bare unitless number pulled out of
  // that SAME reasoning text. Paths (a)/(c) are GENERIC reasoning-text extraction -- they can
  // return a real, checked (exactly-one-option) match built from whatever an authority's reasoning
  // happened to state, which is exactly the failure mode the four named solvers (schedule/density/
  // physics_kepler/aircraft_lift_drag) exist to route AROUND. Because the old code called
  // computeUnitAwareMatch WITH componentFacts as literally the first thing tried, and a non-null
  // result short-circuits every `if (!deterministicOverride)` tier below it, paths (a)/(c) could
  // (and empirically did, live receipts this pass: density chose B via unit_aware instead of C via
  // density; aircraft chose G via unit_aware instead of E via aircraft_lift_drag, both tracking
  // user_perplexity's own letter) preempt the named solvers before they ever ran, even though the
  // named solvers derive strictly from the question text and WOULD have matched correctly given
  // the chance (verified this pass by direct read of solveDensityProblem/solveAircraftLiftDragProblem's
  // own gates against the two failing questions' real text). Checked git history (git log -S on
  // this function): the order was purely accretive -- computeUnitAwareMatch (with componentFacts
  // from day one) was added first, then bare_value/schedule/density/physics/aircraft were each
  // bolted on AFTER, always gated `if (!deterministicOverride)` i.e. "only if everything before me
  // failed" -- never a deliberate "generic reasoning-extraction must win first" design decision.
  // FIX: split computeUnitAwareMatch's call into TWO separate call sites -- tier (i), here, called
  // WITHOUT componentFacts (so only path (b), the genuine question-expression path, can fire), and
  // a NEW tier (vii) at the very end (after the four named solvers), called WITH componentFacts, so
  // paths (a)/(c) -- the generic reasoning-text extraction -- become the LAST resort, reached only
  // when no specific solver and no question-expression parse matched anything. No named solver's
  // own computation changes at all -- only the order attempted and this short-circuit behavior.
  //
  // Tier (i): units-aware compute, QUESTION TEXT ONLY (path (b) -- a unit-bearing expression
  // literally contiguous in the question). Synchronous, no I/O. Deliberately NOT passed
  // componentFacts here -- see the reasoning-extraction last-resort tier (vii) at the bottom of
  // this function for where an authority's reasoning text gets its own, now-demoted, chance.
  try {
    const unitAware = computeUnitAwareMatch(researchQueryForTiers, mcOptions, {});
    if (unitAware) {
      deterministicOverride = {
        letter: unitAware.letter,
        optionValue: unitAware.optionValue,
        optionUnit: unitAware.optionUnit,
        computedValue: unitAware.computedValue,
        computedUnit: unitAware.computedUnit,
        sourceExpression: unitAware.sourceExpression,
        source: unitAware.source,
        method: 'unit_aware',
        // KN-BP143-1b: componentFacts={} at this call site means only path (b) can ever fire here
        // (source is always 'question_expression' in practice) -- classified dynamically off the
        // real returned source anyway, defensively, rather than hardcoded, per
        // classifyUnitAwareComputeProvenance's own doc comment.
        ...classifyUnitAwareComputeProvenance(unitAware.source),
      };
    }
  } catch (err) {
    console.warn('[plow_mc_answerer] resolveDeterministicComputeOverride: computeUnitAwareMatch (question-only) threw (non-fatal, next tier tried):', err);
  }

  // Tier (ii): the pre-existing unit-UNAWARE compute_sidecar pair (computeAnswer +
  // matchValueToOption) -- the SAME two functions the downstream compute-sidecar block already
  // uses, tried here only after tier (i) found nothing. Always reports `source: 'question_expression'`
  // (compute_sidecar.ts hardcodes this -- confirmed by direct read), so it belongs alongside tier
  // (i)'s question-expression path, ahead of the four named solvers, unchanged from its historical
  // position.
  //
  // KN-BP143-1 Defect 3 ("DETERMINISTIC" COMPUTE IS NOT DETERMINISTIC): computeAnswer() is NOT one
  // tier internally -- it tries THREE, in order, and reports which one actually fired via its own
  // `computed.method`: (1) 'local_arithmetic' (extractArithmeticExpression + two independent
  // hand-rolled evaluators cross-checked against each other -- genuinely pure/deterministic, no
  // I/O), (2) 'model_derived_expression' (compute_sidecar.ts's computeViaModelExpression -- an
  // OLLAMA CALL sampled at MODEL_EXPR_SAMPLE_TEMPERATURE = 0.3, by that constant's own doc comment
  // "so the 3 samples can actually disagree" -- genuinely stochastic BY DESIGN), (3)
  // 'wolfram_compute' (an external HTTP API this process does not control). The code below used to
  // accept ALL THREE identically as `method: 'bare_value', source: 'question_expression'` -- i.e.
  // it asserted a temperature-0.3 model sample was "the calculator," the exact false claim the
  // public thesis ("computing gives you an answer that does not change overnight") depends on
  // being true. Real receipt proof (qid 15, runs 035/036, identical question/options 26 minutes
  // apart): 'bare_value'/'question_expression' returned J then C -- confirmed here that qid 15's
  // text ("Jane Morrow gave a 60-day sight-draft...") contains no literal contiguous arithmetic
  // expression at all (extractArithmeticExpression's own gate requires two-or-more numbers joined
  // directly by an operator), so 'local_arithmetic' can only ever fail on it -- the ONLY way this
  // tier could have produced a letter is via tier (2), the stochastic model sample. FIX: only
  // 'local_arithmetic' may populate `deterministicOverride` here -- it is the only one of the three
  // that is actually deterministic. A 'model_derived_expression' or 'wolfram_compute' result is
  // silently discarded at this call site (never guessed into a letter, never labeled deterministic)
  // -- the question correctly falls through to tier (iii) onward, and ultimately to the ensemble's
  // own (separately audited) vote if nothing else fires. This never touches computeAnswer() itself
  // (its self-consistency sampling still exists, still serves its own internal purpose) -- it only
  // stops THIS caller from trusting a stochastic sample as a deterministic override.
  if (!deterministicOverride) {
    try {
      const computed = await computeAnswer(researchQueryForTiers, {
        wolframAppId: computeOpts.wolframAppId,
        ollamaBaseUrl: computeOpts.ollamaBaseUrl,
        model: computeOpts.model,
        componentFacts: reasoningTexts,
      });
      if (computed && computed.method !== 'local_arithmetic') {
        console.log(
          `[plow_mc_answerer] resolveDeterministicComputeOverride: computeAnswer produced a value ` +
          `via '${computed.method}' (KN-BP143-1 Defect 3: NOT genuinely deterministic -- only ` +
          `'local_arithmetic' may become a deterministicOverride at this tier) -- discarded, next ` +
          `tier tried. value=${computed.value} expression=${JSON.stringify(computed.expression)}.`,
        );
      }
      if (computed && computed.method === 'local_arithmetic') {
        const matched = matchValueToOption(computed.value, mcOptions);
        if (matched) {
          deterministicOverride = {
            letter: matched.letter,
            optionValue: matched.optionValue,
            optionUnit: null,
            computedValue: computed.value,
            computedUnit: null,
            sourceExpression: computed.expression,
            source: 'question_expression',
            method: 'bare_value',
            // KN-BP143-1b: this is the ORIGINAL conflation the addendum was drafted about (qid 27
            // vs qid 15, both once labeled identically here). The KN-BP143-1 Defect 3 fix (the
            // `computed.method === 'local_arithmetic'` guard just above) already ensures ONLY the
            // genuinely-deterministic extractArithmeticExpression path can reach this assignment --
            // 'model_derived_expression' (temperature-0.3 Ollama sampling) and 'wolfram_compute'
            // are discarded before this line runs. Given that guard held, every operand here is an
            // arithmetic expression traced verbatim to the question text. literal_expression.
            computeProvenance: 'literal_expression',
            computeProvenanceDetail:
              `Arithmetic expression "${computed.expression}" was extracted directly from the ` +
              'question text via extractArithmeticExpression and evaluated by two independent ' +
              'hand-rolled evaluators cross-checked against each other (computeAnswer\'s own ' +
              '\'local_arithmetic\' method, the only one of its three internal paths that may ' +
              'reach this assignment per the KN-BP143-1 Defect 3 guard above) -- no model sample, ' +
              'no external API, no authority reasoning.',
          };
        }
      }
    } catch (err) {
      console.warn('[plow_mc_answerer] resolveDeterministicComputeOverride: computeAnswer threw (non-fatal, next tier tried):', err);
    }
  }

  // Tier (iii): the schedule-amortization solver -- a THIRD, independent deterministic compute
  // tier for loan/repayment word problems structurally out of reach of (i)/(ii) (see
  // plow_mc_schedule_solver.ts's header for the worked Scaccio example). Synchronous, no I/O.
  // Tried last, only after both tiers above returned null.
  if (!deterministicOverride) {
    try {
      const scheduled = solveScheduleProblem(researchQueryForTiers, mcOptions);
      if (scheduled) {
        deterministicOverride = {
          letter: scheduled.letter,
          optionValue: scheduled.optionValue,
          optionUnit: null,
          computedValue: scheduled.value,
          computedUnit: null,
          sourceExpression: scheduled.provenance,
          source: 'schedule_solver',
          method: 'schedule_amortization',
          // KN-BP143-1b: solveScheduleProblem derives strictly from the question text (principal/
          // payment/rate/period, all parsed off researchQueryForTiers) + mcOptions -- never from
          // reasoningTexts, never a model call (see this tier's own doc comment above). literal_expression.
          computeProvenance: 'literal_expression',
          computeProvenanceDetail:
            'Principal, payment amount, periodic rate, and period count were all parsed directly ' +
            'from the question text by solveScheduleProblem; the amortization projection is pure ' +
            'arithmetic over those question-derived values, no model call, no authority reasoning.',
        };
      }
    } catch (err) {
      console.warn('[plow_mc_answerer] resolveDeterministicComputeOverride: solveScheduleProblem threw (non-fatal, ensemble letter kept):', err);
    }
  }

  // Tier (iv): the mass/dimensions density solver -- a FOURTH, independent deterministic compute
  // tier for "density of a block ... weighs X ... dimensions A x B x C" word problems structurally
  // out of reach of tiers (i)-(iii): computeUnitAwareMatch's chain extractor only picks up a
  // unit-bearing expression that is already CONTIGUOUS in the question text, but this question
  // shape states the mass and the dimension product as two separate clauses (see
  // plow_mc_density_solver.ts's header for the full worked example and the real-dataset "kgand"
  // glue it repairs). Synchronous, no I/O, no model call. Tried last, only after tiers (i)-(iii)
  // above returned null; derives strictly from the question text + options, never from
  // `reasoningTexts`.
  if (!deterministicOverride) {
    try {
      const density = solveDensityProblem(researchQueryForTiers, mcOptions);
      if (density) {
        deterministicOverride = {
          letter: density.letter,
          optionValue: density.optionValue,
          optionUnit: null,
          computedValue: density.value,
          computedUnit: null,
          sourceExpression: density.trace,
          source: 'density_solver',
          method: 'density',
          // KN-BP143-1b GATE 1 (the finding that prompted this whole ticket): solveDensityProblem
          // derives strictly from the question text (mass + dimensions) + mcOptions -- never from
          // reasoningTexts, never a model call (see this tier's own doc comment above). This is
          // qid 27's real post-KN-BP143-1 resolution path -- genuinely literal_expression NOW,
          // unlike its pre-fix stochastic ride through tier (ii)'s model_derived_expression path.
          computeProvenance: 'literal_expression',
          computeProvenanceDetail:
            'Mass and the three linear dimensions were parsed directly from the question text by ' +
            'solveDensityProblem; density = mass / volume is pure arithmetic over those question-' +
            'derived values, unit-normalized, no model call, no authority reasoning.',
        };
      }
    } catch (err) {
      console.warn('[plow_mc_answerer] resolveDeterministicComputeOverride: solveDensityProblem threw (non-fatal, ensemble letter kept):', err);
    }
  }

  // Tier (v): the physics-relation (Kepler's third law) solver -- a FIFTH, independent
  // deterministic compute tier for the double-star mutual-orbit "period of revolution" word
  // problem structurally out of reach of tiers (i)-(iv): the question never spells out the
  // Kepler formula as a literal arithmetic chain (tier (i)'s requirement), and the model-derived-
  // expression tier (ii) is the exact mechanism that previously mis-grabbed a mid-derivation
  // coefficient out of an authority's own reasoning text as if it were the final answer (see
  // plow_mc_physics_solver.ts's header for the full worked example and the documented miss).
  // Synchronous, no I/O, no model call. Tried last, only after tiers (i)-(iv) above returned
  // null; derives strictly from the question text + options, never from `reasoningTexts`.
  if (!deterministicOverride) {
    try {
      const physics = solvePhysicsRelationProblem(researchQueryForTiers, mcOptions);
      if (physics) {
        deterministicOverride = {
          letter: physics.letter,
          optionValue: physics.optionValue,
          optionUnit: null,
          computedValue: physics.value,
          computedUnit: null,
          sourceExpression: physics.trace,
          source: 'physics_solver',
          method: 'physics_kepler',
          // KN-BP143-1b: solvePhysicsRelationProblem derives strictly from the question text
          // (separation + masses) + mcOptions -- never from reasoningTexts, never a model call
          // (see this tier's own doc comment above). literal_expression.
          computeProvenance: 'literal_expression',
          computeProvenanceDetail:
            'Separation and the two orbiting masses were parsed directly from the question text ' +
            'by solvePhysicsRelationProblem; Kepler\'s third law is solved algebraically over ' +
            'those question-derived values, no model call, no authority reasoning.',
        };
      }
    } catch (err) {
      console.warn('[plow_mc_answerer] resolveDeterministicComputeOverride: solvePhysicsRelationProblem threw (non-fatal, ensemble letter kept):', err);
    }
  }

  // Tier (vi): the aircraft lift/drag/takeoff-power solver -- a SIXTH, independent deterministic
  // compute tier for the "angle of attack + power required for takeoff" word problem structurally
  // out of reach of tiers (i)-(v): the question states five separate givens (weight, wing area,
  // takeoff speed, air density, two linear coefficient relations) and asks for a value reached
  // only by solving a linear equation for alpha first, never a single contiguous unit-bearing
  // chain (tier (i)'s requirement), and tier (v) is narrowly gated to the double-star Kepler case
  // (see plow_mc_aircraft_solver.ts's header for the full worked example). Synchronous, no I/O, no
  // model call. Tried last, only after tiers (i)-(v) above returned null; derives strictly from
  // the question text + options, never from `reasoningTexts`.
  if (!deterministicOverride) {
    try {
      const aircraft = solveAircraftLiftDragProblem(researchQueryForTiers, mcOptions);
      if (aircraft) {
        deterministicOverride = {
          letter: aircraft.letter,
          optionValue: aircraft.optionValue,
          optionUnit: null,
          computedValue: aircraft.value,
          computedUnit: null,
          sourceExpression: aircraft.trace,
          source: 'aircraft_solver',
          method: 'aircraft_lift_drag',
          // KN-BP143-1b: solveAircraftLiftDragProblem derives strictly from the question text
          // (weight, wing area, takeoff speed, air density, the two linear coefficient relations)
          // + mcOptions -- never from reasoningTexts, never a model call (see this tier's own doc
          // comment above). literal_expression.
          computeProvenance: 'literal_expression',
          computeProvenanceDetail:
            'Weight, wing area, takeoff speed, air density, and the two linear lift/drag-' +
            'coefficient relations were all parsed directly from the question text by ' +
            'solveAircraftLiftDragProblem; the angle-of-attack/power solve is algebra over those ' +
            'question-derived values, no model call, no authority reasoning.',
        };
      }
    } catch (err) {
      console.warn('[plow_mc_answerer] resolveDeterministicComputeOverride: solveAircraftLiftDragProblem threw (non-fatal, ensemble letter kept):', err);
    }
  }

  // Tier (vii): the pseudocode-trace solver -- a SEVENTH, independent deterministic compute tier
  // for "which of the following code segments will correctly create newList?" word problems
  // structurally out of reach of tiers (i)-(vi): the question defines named procedures by their
  // EXPLANATIONS (not a formula) and gives a worked example; the only way to know which option is
  // correct is to actually EXECUTE each candidate code segment against the worked example's own
  // inputs and compare to its own stated output -- there is no unit-bearing chain, no bare
  // arithmetic expression, no loan schedule, no mass/dimensions density, and no physics relation
  // anywhere in the text for tiers (i)-(vi) to find (see plow_mc_pseudocode_trace_solver.ts's
  // header for the full worked example, including the real question's OCR corruption -- garbled
  // "list1"/"list2" spellings and a missing closing quote -- and how it is tolerated). Synchronous,
  // no I/O, no model call. Tried last of the named solvers, only after tiers (i)-(vi) above
  // returned null; derives strictly from the question text + options, never from `reasoningTexts`.
  if (!deterministicOverride) {
    try {
      const pseudocode = solvePseudocodeTraceProblem(researchQueryForTiers, mcOptions);
      if (pseudocode) {
        deterministicOverride = {
          letter: pseudocode.letter,
          // DeterministicComputeCandidate's optionValue/computedValue are typed `number` because
          // every other tier compares a SCALAR quantity; this solver compares LISTS instead, so
          // there is no honest scalar to report here. NaN is the deliberate sentinel (never a
          // fabricated 0 or count) -- every consumer of these two fields downstream only ever
          // string-interpolates or hashes them (confirmed by direct read this pass: no arithmetic
          // is ever performed on computedValue/optionValue), so NaN renders as the literal text
          // "NaN" in logs/receipts rather than crashing or silently implying a real number. The
          // actual list data (list1/list2/expected/matched option's evaluated result) lives in
          // `sourceExpression` (== pseudocode.trace) below, which every receipt path also carries.
          optionValue: NaN,
          optionUnit: null,
          computedValue: NaN,
          computedUnit: null,
          sourceExpression: pseudocode.trace,
          source: 'question_expression',
          method: 'pseudocode_trace',
          // KN-BP143-1b: same rationale as this solver's own answer-type-bypass call site earlier
          // in this file -- procedures, worked example, and every option's code segment are all
          // stated verbatim in the question text; execution is deterministic. literal_expression.
          computeProvenance: 'literal_expression',
          computeProvenanceDetail:
            'Procedure definitions, worked example, and every option\'s own code segment are all ' +
            'read verbatim from the question text; the answer is which option\'s procedures, ' +
            'executed exactly as stated, reproduce the worked example\'s own stated output -- no ' +
            'operand from any authority\'s reasoning or a model sample.',
        };
      }
    } catch (err) {
      console.warn('[plow_mc_answerer] resolveDeterministicComputeOverride: solvePseudocodeTraceProblem threw (non-fatal, ensemble letter kept):', err);
    }
  }

  // Tier (set-membership, BP141-1) -- an EIGHTH independent deterministic compute tier for "which
  // of the following is/is NOT a member of a named canonical set" questions
  // (plow_mc_set_membership_solver.ts; run 029, question_id 98: "which world region is NOT
  // considered one of the world's most densely populated regions?"). Structurally out of reach of
  // tiers (i)-(vii): there is no arithmetic, no unit-bearing chain, no loan schedule, no
  // mass/dimensions density, no physics relation, and no code to execute anywhere in the question --
  // the only honest way to answer it is to already know the canonical enumerated set, which this
  // tier only ever accepts from a GROUNDED Fact eblet already present in the live substrate (never
  // a search-result echo, never invented -- see that solver's own header for the full discipline).
  // Registered here (ALSO reachable via the unconditional BP141-1 bypass at the top of
  // runAuthorityEnsemble, mirroring pseudocode_trace's own dual placement) so a
  // `computable`-classified question that also happens to match this solver's gate is covered too.
  // Involves ONE substrate read (loadGroundedSetMembershipFacts) -- the one deliberate exception to
  // every other tier's "no I/O" contract, unavoidable since this tier's entire reason to exist is
  // checking the live substrate. Tried last of the named solvers, only after tiers (i)-(vii) above
  // returned null; STRICTLY BEFORE the generic reasoning-text extraction tier below
  // (BP-SPECIFIC-BEFORE-GENERIC discipline: a specific solver's own strict gate must always get
  // first refusal ahead of the generic "read a number/entity out of an authority's reasoning text"
  // fallback).
  if (!deterministicOverride) {
    try {
      const groundedFactsForSetMembership = await loadGroundedSetMembershipFacts();
      const setMembership = solveSetMembershipProblem(researchQueryForTiers, mcOptions, groundedFactsForSetMembership);
      if (setMembership) {
        deterministicOverride = {
          letter: setMembership.letter,
          // Mirrors solvePseudocodeTraceProblem's own NaN-sentinel convention just above: this
          // solver compares a MEMBERSHIP VERDICT, not a scalar, so there is no honest numeric
          // optionValue/computedValue to report here. The actual verdict data (set title, polarity,
          // member list, every option's resolved status) lives in `sourceExpression` (==
          // setMembership.trace) below, which every receipt path already carries.
          optionValue: NaN,
          optionUnit: null,
          computedValue: NaN,
          computedUnit: null,
          sourceExpression: setMembership.trace,
          source: 'question_expression',
          method: 'set_membership',
          // KN-BP143-1b JUDGMENT CALL: same rationale as this solver's own answer-type-bypass call
          // site earlier in this file -- the canonical enumerated set is a live-substrate
          // (vault_export:fact:) read, not question-verbatim. Fails closed to model_derived under
          // this ticket's binary schema; see that call site's fuller note.
          computeProvenance: 'model_derived',
          computeProvenanceDetail:
            'Canonical enumerated set came from a vault-curated Fact eblet already in the live ' +
            'substrate, not from the question text itself -- deterministic and vetted, but not ' +
            'question-verbatim, so it fails closed to model_derived under this ticket\'s binary ' +
            'schema.',
        };
      }
    } catch (err) {
      console.warn('[plow_mc_answerer] resolveDeterministicComputeOverride: solveSetMembershipProblem threw (non-fatal, ensemble letter kept):', err);
    }
  }

  // Tier (no-consensus, BP141-2 Task B) -- a NINTH independent deterministic compute tier for
  // questions that offer an explicit "there is no single/specific answer" option
  // (plow_mc_no_consensus_solver.ts; run 030 receipt, question_id 92). Structurally different from
  // every tier above: it does not derive from questionText+options alone, it also requires the
  // ensemble's own INDEPENDENT candidate scatter (`independentSources`, derivation-path-tagged --
  // A9/A10 REVISED, "VARIANCE IS NOT INDEPENDENCE") -- genuine cross-derivation-path disagreement
  // across >= 3 distinct routes, with >= 3 distinct letters and no majority, and the no-consensus
  // option is itself NOT the plurality pick, is the evidence that option is correct. Registered
  // here ALSO reachable via its own unconditional answer-type bypass at the top of
  // runAuthorityEnsemble (mirroring pseudocode_trace's/set_membership's own dual placement), for
  // this gated (`answerType === 'computable'`) call path. Synchronous, no I/O, no model call.
  // Tried last of the named solvers, only after tiers (i)-(viii, set-membership) above returned
  // null; STRICTLY BEFORE the generic reasoning-text extraction tier below (BP-SPECIFIC-BEFORE-
  // GENERIC discipline, same as every other named solver here).
  if (!deterministicOverride) {
    try {
      const noConsensus = solveNoConsensusFromScatter(researchQueryForTiers, mcOptions, independentSources);
      if (noConsensus) {
        deterministicOverride = {
          letter: noConsensus.letter,
          // Mirrors solvePseudocodeTraceProblem's/solveSetMembershipProblem's own NaN-sentinel
          // convention above: this solver compares a SCATTER VERDICT, not a scalar, so there is
          // no honest numeric optionValue/computedValue to report here. The actual scatter data
          // (no-consensus option, distinct-derivation-path count, distinct-letter count,
          // plurality leaders, every independent vote) lives in `sourceExpression` (==
          // noConsensus.trace) below, which every receipt path already carries.
          optionValue: NaN,
          optionUnit: null,
          computedValue: NaN,
          computedUnit: null,
          sourceExpression: noConsensus.trace,
          source: 'question_expression',
          method: 'no_consensus_from_scatter',
          // KN-BP143-1b: same rationale as this tier's own two call sites elsewhere in this file
          // (runAuthorityEnsemble's early bypass and post-swarm recheck) -- deciding evidence is
          // `independentSources`, the ensemble's OWN scatter of other authorities'/models' answers,
          // never an operand read from the question text.
          computeProvenance: 'model_derived',
          computeProvenanceDetail:
            'Deciding evidence is the ensemble\'s OWN scatter of independent-derivation-path ' +
            'candidates (other authorities\' and models\' own answers) reaching no majority on a ' +
            'question that also offers an explicit no-consensus option -- every operand here is ' +
            'another authority/model\'s output, not the question text.',
        };
      }
    } catch (err) {
      console.warn('[plow_mc_answerer] resolveDeterministicComputeOverride: solveNoConsensusFromScatter threw (non-fatal, ensemble letter kept):', err);
    }
  }

  // Tier (cascade fallback, KN-BP141-10, Founder-directed BP141) -- a TENTH independent
  // deterministic compute tier, and the FIRST one in this whole function that does not derive from
  // parsing this question's own specific prompt shape at all. Every tier above (i)-(ix) PARSES a
  // prompt somebody else wrote -- a unit-bearing expression contiguous in the text, a Procedure/
  // Explanation table, an explicit "no consensus" option string, an entity list resolvable against
  // the substrate. This tier COMPOSES ITS OWN QUERIES and verifies the answer locally (SymPy, C6) --
  // see runEliminationCascadeFormatIndependentFallback's own doc comment, just above
  // DeterministicComputeCandidate's interface declaration, for the full C1-C8 mechanism. Tried last
  // of all named/structured tiers, only after tiers (i)-(ix) above returned null; STRICTLY BEFORE
  // the generic reasoning-text extraction tier below (BP-SPECIFIC-BEFORE-GENERIC discipline, same as
  // every other named tier here) -- this fallback still derives from the question text + options
  // (composed fresh, never parsed), so it correctly gets first refusal ahead of the generic
  // "read a number out of an authority's own reasoning text" last resort. `cascadeFallbackReceipt`
  // is reported unconditionally below (whether or not the gate fired, whether or not it decided) via
  // this function's own new `cascadeFallback` return field -- see that field's own doc comment.
  //
  // KN-BP143-1 Defect 2 (CASCADE FALLBACK CAN OVERRIDE A REAL ANSWER): unlike every OTHER tier in
  // this function, this one does not derive a specific number from THIS question's own text via a
  // named, checked solver -- it is elimination-by-ranking (C1-C8), and standing canon is explicit
  // that every eliminator ships ADVISORY ONLY: naive elimination discards the correct key in 61 of
  // 497 measured questions (12.3%). An advisory component that can silently overwrite an already-
  // computed real answer is a 12.3% random-damage generator, not a corroborator. THE FIX (mirrors
  // the shape already shipped for decomposeAdvisoryResult, commit 36c6c45a): the candidate is
  // STASHED into `cascadeAdvisoryCandidate`, never early-assigned into `deterministicOverride`
  // here. It is promoted into `deterministicOverride` ONLY at this function's own natural end,
  // gated on BOTH `!deterministicOverride` (no other tier already decided -- unchanged) AND
  // `!ensembleChosenLetter` (the caller had no real answer of its own either -- see the promotion
  // site below, just above `overrideFired`/`finalLetter`). A real ensemble answer's presence alone
  // now makes this tier advisory-only for that call: it can fill an absence, it can never overwrite
  // a result.
  let cascadeFallbackReceipt: EliminationCascadeFallbackReceipt | null = null;
  let cascadeAdvisoryCandidate: DeterministicComputeCandidate | null = null;
  if (!deterministicOverride) {
    try {
      const cascadeResult = await runEliminationCascadeFormatIndependentFallback(
        researchQueryForTiers,
        mcOptions,
        { ollamaBaseUrl: computeOpts.ollamaBaseUrl, model: computeOpts.model },
        bridge,
        (msg) => console.log(`[plow_mc_answerer] resolveDeterministicComputeOverride: cascade-fallback ${msg}`),
      );
      cascadeFallbackReceipt = cascadeResult.receipt;
      if (cascadeResult.candidate) {
        cascadeAdvisoryCandidate = cascadeResult.candidate;
      }
    } catch (err) {
      console.warn('[plow_mc_answerer] resolveDeterministicComputeOverride: runEliminationCascadeFormatIndependentFallback threw (non-fatal, ensemble letter kept):', err);
    }
  }
  // KN-BP143-1 Defect 2, the actual advisory-only promotion: consulted ONLY when the pipeline
  // reaches its natural end with no chosen letter -- i.e. no earlier tier already produced a
  // deterministicOverride (`!deterministicOverride`, unchanged gate) AND the caller itself had no
  // real ensemble answer to protect (`!ensembleChosenLetter`). Kept at this tier's original
  // position (immediately after its own call, still strictly before tier (viii)'s generic
  // reasoning-text extraction below) so the ONLY behavior change from this fix is "never overwrite
  // a real ensembleChosenLetter" -- every other ordering/priority relationship between tiers is
  // byte-for-byte unchanged.
  if (!deterministicOverride && cascadeAdvisoryCandidate && !ensembleChosenLetter) {
    deterministicOverride = cascadeAdvisoryCandidate;
  }

  // Tier (viii) -- LAST RESORT, generic reasoning-text extraction: computeUnitAwareMatch's paths
  // (a)/(c) (a unit-bearing or bare-numeric quantity pulled out of an authority's OWN reasoning/
  // fact text, `reasoningTexts`, rather than the question itself). See this function's
  // BP-SPECIFIC-BEFORE-GENERIC header above for the full rationale -- this is deliberately the
  // VERY LAST thing tried, only after tier (i)'s question-only unit expression, tier (ii)'s
  // question-expression bare-value compute, AND all five named solvers (schedule/density/
  // physics_kepler/aircraft_lift_drag/pseudocode_trace) have all already returned null. Re-invokes
  // computeUnitAwareMatch WITH componentFacts this time -- its own path (b) gets re-tried
  // internally too (harmless: tier (i) above already established it returns null for this
  // question, re-checking it costs one cheap regex pass and changes nothing), then paths (a)/(c)
  // get their turn. A non-null result here always carries `source: 'reasoning_fact'` (the only way
  // paths (a)/(c) resolve) -- the caller (runAuthorityEnsemble's pre-branch hoist, and the
  // post-branch Stage F2 site) already demotes/declines a reasoning_fact result's power to
  // silently decide or override an answer (see BP-ECHO-NO-VOTE / BP-COMPUTE-DEMOTE-SITE-2), so
  // this tier existing at all is purely "still give the honest last-resort check a chance," never
  // a path back to the preemption bug this reorder fixes.
  if (!deterministicOverride) {
    try {
      const unitAwareFromReasoning = computeUnitAwareMatch(researchQueryForTiers, mcOptions, { componentFacts: reasoningTexts });
      if (unitAwareFromReasoning) {
        deterministicOverride = {
          letter: unitAwareFromReasoning.letter,
          optionValue: unitAwareFromReasoning.optionValue,
          optionUnit: unitAwareFromReasoning.optionUnit,
          computedValue: unitAwareFromReasoning.computedValue,
          computedUnit: unitAwareFromReasoning.computedUnit,
          sourceExpression: unitAwareFromReasoning.sourceExpression,
          source: unitAwareFromReasoning.source,
          method: 'unit_aware',
          // KN-BP143-1b: tier (i) above already tried path (b) and returned null, so a hit HERE is
          // virtually always path (a)/(c) (source='reasoning_fact') -- but classified dynamically
          // off the real returned source anyway, defensively, per classifyUnitAwareComputeProvenance's
          // own doc comment, rather than assumed from this tier's position.
          ...classifyUnitAwareComputeProvenance(unitAwareFromReasoning.source),
        };
      }
    } catch (err) {
      console.warn('[plow_mc_answerer] resolveDeterministicComputeOverride: computeUnitAwareMatch (reasoning-extraction last resort) threw (non-fatal):', err);
    }
  }

  const overrideFired = !!deterministicOverride && deterministicOverride.letter !== ensembleChosenLetter;
  const finalLetter = deterministicOverride ? deterministicOverride.letter : ensembleChosenLetter;
  return {
    finalLetter,
    overrideFired,
    deterministicOverride,
    advisorySignals: { vettingFlags: stage0VettingFlags, eliminationChart: stage1EliminationChart },
    cascadeFallback: cascadeFallbackReceipt,
    cascadeAdvisoryCandidate,
  };
}

// ─── WIRE-THE-LOOP fix: writeback + replication for EVERY solved answer ────────────────────
//
// Founder mandate parts 2+3: on every solved answer, write {question, answer, reasoning,
// sourceUrl, authority} back to the local substrate (so future questions can serve it, $0,
// zero network) AND stamp it into ip_ledger_entries (mesh_replicated:false) so the EXISTING
// mesh_diff_loop.ts 15-minute Merkle-diff sweep (previously starved -- "no unreplicated
// entries" -- because nothing solved by the plow ever landed in that table) actually has rows
// to find and push to peers. Both writes are individually try/caught and fully non-fatal: a
// failed write here must never turn a correct answer into an error for the caller.
/** KN-BP141-6 FIX A (bare-letter writer bug): this is the exact writer that produced the one
 *  false positive found in KN-BP141-5's mandatory shape-quarantine check -- provenance
 *  'plow_mc_answerer:solved:wikipedia:...', verified:true, answer field exactly "H) " for the
 *  birthday-paradox question. Root cause confirmed by direct read of every call site of
 *  writeAndReplicateSolvedAnswer below (all four, at this file's ~4030/~4166/~4619/~5797 lines):
 *  several build `optionText` via `.find(...)?.text ?? ''`, so a failed option-text lookup
 *  silently produces an EMPTY string, and `answer: \`${chosenLetter}) ${optionText}\`` then
 *  degenerates into a bare option letter with trailing punctuation and nothing else -- an answer
 *  key for a question we got right, carrying zero reusable knowledge.
 *
 *  Per the ticket: fix the WRITER, never loosen the reader's shape-quarantine predicate
 *  (isAnswerKeyShapedEblet, mnem_eblet_store.ts, KN-BP141-5) -- that predicate stays exactly as
 *  specified; this is the other half of the fix, at the source.
 *
 *  THRESHOLD IMPLEMENTED: `optionText.trim().length > 0` -- substantive content is "anything
 *  beyond an empty/whitespace-only string," checked on the RAW optionText input BEFORE it is
 *  concatenated with the letter and punctuation. This deliberately imposes NO minimum length
 *  beyond non-empty: a short-but-real value ("42", "0", "-1", a single word) is still genuine
 *  information distinct from "which letter was chosen" and must not be refused -- the ticket's
 *  own "H) 42" example (letter prefix plus real content) is exactly this case, and passes this
 *  check because `optionText` itself is "42", not empty. Only the ACTUAL observed bug shape
 *  (optionText === '' or whitespace-only) is refused.
 *
 *  Extracted to a small, pure, named, exported function (rather than inlined) so it can be
 *  verified directly against the real compiled dist without invoking the side-effecting write --
 *  same convention as KN-BP141-5's isRgbyLedgerWrite() in mnem_eblet_store.ts. */
export function hasSubstantiveAnswerContent(optionText: string): boolean {
  return optionText.trim().length > 0;
}

async function writeAndReplicateSolvedAnswer(params: {
  researchQuery: string;
  domain: string;
  chosenLetter: string;
  optionText: string;
  reasoning: string;
  sourceUrl?: string;
  authority: string;
  // BP131 honesty fix: caller-supplied hint about WHY this answer is being offered, forwarded
  // verbatim to writeVerifiedEblet()'s own `corroboration` field -- computeHonestVerification()
  // (mnem_eblet_store.ts) is the single place that turns this into verified:true/false, this
  // function no longer decides it locally. Omitted (undefined) at a call site fails CLOSED to
  // verified:false/verdict:'unverified' -- e.g. a lone single_google/single_perplexity accept,
  // which is exactly the "Scaccio E) $106.00 wrong answer stored as verified:true" bug class
  // this Yoke closes. Only pass 'concordant'/'deterministic_compute' where the caller can show
  // genuine 2+-source agreement or a deterministic-compute result.
  // BP-COMPUTE-HONEST-DEMOTE addition: 'authority_extracted_compute' -- a real, checked
  // unit-conversion/tolerance-match ran (never a guess), but its input quantity was extracted
  // from an authority's own reasoning/fact text (compute_sidecar.ts `source: 'reasoning_fact'`),
  // not a literal expression in the question -- see mnem_eblet_store.ts's
  // computeHonestVerification(), which deliberately does NOT grant this value verified:true the
  // way 'deterministic_compute' does (no independent grounding).
  corroboration?: 'concordant' | 'single_authority' | 'deterministic_compute' | 'authority_extracted_compute';
}): Promise<void> {
  const now = Date.now();
  const hasSubstantiveOptionText = hasSubstantiveAnswerContent(params.optionText);
  if (hasSubstantiveOptionText) {
    try {
      await writeVerifiedEblet({
        question: params.researchQuery,
        answer: `${params.chosenLetter}) ${params.optionText}`,
        provenance: `plow_mc_answerer:solved:${params.authority}${params.sourceUrl ? ':' + params.sourceUrl : ''}`,
        // BP131 honesty fix: this literal is now advisory only -- writeVerifiedEblet() re-derives
        // the real verified/verdict pair via computeHonestVerification() from `provenance` and
        // `corroboration` below, so it can never again disagree with the verdict written alongside
        // it (the old bug: this was hardcoded `true` while `verdict` right below was honestly
        // 'unverified' in the very same object literal).
        verified: false,
        sha256: '',
        timestamp: now,
        class: 'whole_answer',
        reasoning: params.reasoning,
        corroboration: params.corroboration,
      });
    } catch (err) {
      console.warn('[plow_mc_answerer] writeAndReplicateSolvedAnswer: local eblet write failed (non-fatal):', err);
    }
  } else {
    // KN-BP141-6 FIX A: refuse the local eblet write outright rather than persist a bare-letter
    // answer key -- "if only a letter is available, do not write the record at all." Scoped to
    // ONLY the writeVerifiedEblet call above; the ip_ledger replication stamp below is a
    // separate subsystem/data model (out of this ticket's stated scope) and still fires
    // unconditionally, same as before this fix.
    console.warn(
      `[plow_mc_answerer] writeAndReplicateSolvedAnswer: refused local eblet write for question=` +
      `${JSON.stringify(params.researchQuery.slice(0, 80))} chosenLetter=${params.chosenLetter} -- ` +
      `optionText was empty/whitespace-only, the resulting answer would carry no substantive ` +
      `content beyond the option letter itself (KN-BP141-6 FIX A, not written, not an error)`,
    );
  }
  try {
    // Dynamic import (same convention this file already uses for cross-module main-process
    // calls, e.g. `await import('../index')` above) -- keeps this module decoupled from the
    // ip_ledger subsystem at load time and avoids any import-cycle risk.
    const { stampCertify } = await import('../ip_ledger/stamp_certify');
    const result = await stampCertify({
      contribution_type: 'plow_mc_answer_solved',
      payload: JSON.stringify({
        question: params.researchQuery,
        domain: params.domain,
        chosenLetter: params.chosenLetter,
        answer: params.optionText,
        reasoning: params.reasoning,
        sourceUrl: params.sourceUrl ?? null,
        authority: params.authority,
        solvedAt: now,
      }),
      payload_url: params.sourceUrl,
    });
    if (!result.ok) {
      console.warn('[plow_mc_answerer] writeAndReplicateSolvedAnswer: replication stamp reported not-ok (non-fatal):', result.error);
    } else {
      console.log(`[plow_mc_answerer] writeAndReplicateSolvedAnswer: replicated entry_id=${result.entry_id}`);
    }
  } catch (err) {
    console.warn('[plow_mc_answerer] writeAndReplicateSolvedAnswer: replication stamp threw (non-fatal):', err);
  }
}

// ─── BP-COMPUTE-UNITS: eblet the METHOD, not just the answer ────────────────────────────────
//
// Founder mandate (BUILD step 3): "Eblet the method... a question-class signature, the formula,
// and the unit handling -- via the same writeVerifiedEblet path already used." This writes a
// class:'component' eblet on every successful units-aware compute match, distinct from
// writeAndReplicateSolvedAnswer's whole_answer write above (that one records THIS question's own
// answer letter; this one records the reusable METHOD -- "density = mass / volume, unit-
// normalized: convert the computed quantity into the option's own unit via mathjs, then compare"
// -- so a future question in the same class is "known like times tables" rather than re-derived
// from scratch). Uses a fixed non-servable question sentinel per method-kind (same convention as
// writeRoundEblets' '[component:non-servable]' above) so this can never collide with a future
// real serve/exact-match. Fully non-fatal: a failed write here must never affect the caller's
// returned answer -- returns whether the write succeeded purely for the caller's ebletsWritten
// bookkeeping field, nothing else depends on it.
// BP-CONTAMINATION-FIX (this pass, Bishop-verified defect): process-lifetime cache of
// `plow_mc_answerer:compute_method:<method>` provenance prefixes already confirmed present in
// the store, same convention as formula_eblet_mint.ts's mintedOrCheckedMethods -- avoids
// re-scanning the whole verified_eblets.jsonl on every single compute success within one long
// benchmark run. Deliberately NOT persisted/shared across processes; a cold-started process
// re-checks the store once per method the first time it sees that method.
const computeMethodEbletCheckedProvenance = new Set<string>();

async function writeComputeMethodEblet(params: {
  // BP-CONTAMINATION-FIX: researchQuery is still accepted (byte-compatible call-site signature,
  // both existing call sites pass { researchQuery, result }) but is DELIBERATELY NEVER read
  // below any more -- see the root-cause writeup at this function's git-blamed prior version:
  // this field used to be sliced into the persisted `reasoning`, which is exactly what turned a
  // reusable-tool eblet into a leaked answer key (the live benchmark question text paired with
  // an explicit answer letter). class:'component' is the class eligible for injection during
  // scored runs (tools ON, answer-keys OFF) -- nothing question-specific may ever reach the
  // fields written to the store from this function again.
  researchQuery: string;
  // BP-DETERMINISTIC-OVERRIDE-3TIER: widened from UnitAwareComputeResult to
  // DeterministicComputeCandidate (a structural superset-compatible shape -- every existing
  // UnitAwareComputeResult caller, e.g. the compute-sidecar block's own `unitAware` result,
  // still satisfies it unchanged) so the override call site can also report a tier-(ii)/tier-
  // (iii) result through this same writer without forcing them into UnitAwareComputeResult's
  // narrower method/source literal unions, which they don't share.
  result: DeterministicComputeCandidate;
}): Promise<boolean> {
  const { result } = params;
  try {
    const classSignature =
      result.computedUnit && result.optionUnit
        ? `unit-normalized compute: ${result.computedUnit} -> ${result.optionUnit}`
        : 'unit-normalized compute (unitless)';
    // BP-CONTAMINATION-FIX: provenance no longer carries a Date.now() suffix (the prior write
    // minted a brand-new record on every single call, no dedup, which is also what made the 28
    // contaminated records pile up in the first place) -- dedupable by method, same as
    // formula_eblet_mint.ts's `${PROVENANCE_PREFIX}${method}` convention.
    const provenance = `plow_mc_answerer:compute_method:${result.method}`;

    // Dedup check, same pattern as formula_eblet_mint.ts's mintFormulaEbletFromCompute(): one
    // component eblet per method, not per question -- otherwise a benchmark run of hundreds of
    // density questions would mint hundreds of byte-identical method records.
    if (computeMethodEbletCheckedProvenance.has(provenance)) {
      return true;
    }
    const existing = await loadAllVerifiedEblets();
    const alreadyWritten = existing.some(
      (e) => e.class === 'component' && typeof e.provenance === 'string' && e.provenance.startsWith(provenance),
    );
    if (alreadyWritten) {
      computeMethodEbletCheckedProvenance.add(provenance);
      return true;
    }

    await writeVerifiedEblet({
      question: `[method:compute-units-aware:${result.method}]`,
      // BP-CONTAMINATION-FIX: the prior "Worked example this write" clause (sourceExpression,
      // computedValue, and -- worst of all -- `matched option ${result.letter}`) is REMOVED
      // entirely. Everything below is a general, question-independent method description: no
      // question text, no computed values, no option letter.
      answer:
        `Method: obtain a quantity WITH ITS UNIT (source=${result.source} -- either an expression ` +
        `cleanly present in the question, or the final "value unit" stated in the authority/swarm's ` +
        `reasoning), then convert it into each MC option's OWN unit via mathjs and compare within ` +
        `tolerance -- accept only when exactly one option matches, never a bare numeric guess. ` +
        `Class signature: ${classSignature}.`,
      provenance,
      // BP131 honesty fix: this write genuinely IS deterministic compute (computeUnitAwareMatch
      // already proved "exactly one option matches" before this function is ever called) -- the
      // literal below is advisory only (see writeAndReplicateSolvedAnswer's own doc comment for
      // why); `corroboration` below is what actually earns this write its honest
      // verified:true/verdict:'verified' via computeHonestVerification().
      // BP-COMPUTE-HONEST-DEMOTE: `corroboration: 'deterministic_compute'` is only honest when the
      // quantity's operands are all traced to the QUESTION itself (or one of the four named
      // solvers, which are equally question-only). KN-BP143-1b: widened from
      // `result.source === 'reasoning_fact'` to `!isLiteralExpressionProvenance(result)` -- the
      // narrower string check only ever caught tier (i)'s reasoning-text-extraction path; it
      // could not catch no_consensus_from_scatter or elimination_cascade_fallback results reaching
      // this writer (both hardcode `source: 'question_expression'` even though neither derives
      // from the question text -- see each tier's own computeProvenance doc comment). When
      // computeProvenance is model_derived, the unit-conversion/tolerance-match (or ranking/
      // scatter-check) still genuinely ran -- it is not a guess -- but it has no independent
      // grounding of its own, so it earns the distinct, honest 'authority_extracted_compute' label
      // instead, which computeHonestVerification() deliberately does NOT treat as a verified
      // accept class.
      verified: true,
      sha256: '',
      timestamp: Date.now(),
      class: 'component',
      // BP-CONTAMINATION-FIX: no more `question="${researchQuery...}"` -- that was the leak.
      // `result.source` is a short generic tag, never raw question text, so this stays
      // method-general. KN-BP143-1b: `result.computeProvenance` is equally general/safe to log
      // (a two-value enum, no question content) -- added alongside source for the same "record
      // which operands came from where" reason as the eblet's own class-signature above.
      reasoning:
        `General derivation note: identify the quantity's source (source=${result.source}, ` +
        `computeProvenance=${result.computeProvenance}), unit-convert it into each option's own ` +
        `unit, and accept only a single tolerance-matching option. Class signature: ${classSignature}.`,
      corroboration: isLiteralExpressionProvenance(result) ? 'deterministic_compute' : 'authority_extracted_compute',
    });
    computeMethodEbletCheckedProvenance.add(provenance);
    return true;
  } catch (err) {
    console.warn('[plow_mc_answerer] writeComputeMethodEblet failed (non-fatal):', err);
    return false;
  }
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
  // BP139 gate-closure fix: runDetectiveTeam's rootCause->additionalOperators table
  // (canonical_pipeline.ts) can suggest a PREMIUM, default-off specialist (e.g. 'wolfram' for a
  // math_dead_end rootCause) with no awareness of isAuthorityEnabled()'s tier gate -- confirmed
  // by direct read: additionalOperators is a hardcoded per-rootCause name list, never filtered
  // through the enable resolver. Without this filter, a disabled premium source could get added
  // to widenerOperators here and then fire unconditionally at its actual dispatch site
  // (SPECIALIST_REGISTRY[specialistName] in both runSpecialistSwarmConsensus and the main
  // pipeline's own swarm loop index effectiveOperators with no per-item enable check of its
  // own) -- i.e. the escalation-widen retry path bypassing the same gate getOperatorsForDomain()
  // already enforces for the BASE roster. Filtering additionalOperators through the identical
  // isAuthorityEnabled() resolver here closes that gap at its one true source (this is also
  // where BP139's new browser-LLM authorities are STRUCTURALLY immune to this exact gap: they
  // are not SpecialistName values at all, so they can never appear in report.additionalOperators
  // in the first place -- see specialist_adapters.ts's "Browser-LLM PREMIUM authorities" header).
  const specialistEnableOverrides = readAuthorityEnableOverridesFromSettings();
  const newSpecialistOperators = report.additionalOperators.filter((op) =>
    isAuthorityEnabled(op, specialistEnableOverrides),
  );
  const suppressedByGate = report.additionalOperators.filter((op) => !newSpecialistOperators.includes(op));
  if (suppressedByGate.length > 0) {
    console.log(
      `[plow_mc_answerer] Stage D escalation-widen: suppressed disabled premium operator(s) ` +
      `[${suppressedByGate.join(',')}] from widening (gate closed, BP139) -- never dispatched.`,
    );
  }

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

  // ── PRODUCTION eblet read-back: deterministic recall of a previously-verified answer ────────
  // NEW, OPT-IN via config.productionReadbackEnabled (see that field's own doc comment on
  // CanonicalPlowMcConfig for the full hard-off-on-scoring guarantee + honesty-safety rationale).
  // Checked FIRST, before Stage F3/Psionic/F2/ensemble/swarm ever run -- a genuine recall must
  // never burn a single specialist/voter/Ollama call. Default false/undefined: this whole block
  // is unreachable and byte-for-byte skipped for every pre-existing caller/config.
  if (config.productionReadbackEnabled === true) {
    try {
      const readbackHits = await queryVerifiedEblets(researchQuery, 3);
      const qNormForReadback = researchQuery.trim().toLowerCase();
      // queryVerifiedEblets() already reorders exact-question-text matches with non-component
      // entries first (see that function's own doc comment) -- this still explicitly re-checks
      // BOTH exact-match and class here rather than trusting hits[0] blindly: a topical/keyword
      // fallback hit (no exact match at all) must never be recalled as this question's own
      // answer, and a class:'component' fragment (a reusable METHOD note, not a whole answer)
      // must never be read back as a chosen letter either.
      const readbackExact = readbackHits.find(
        (e) => e.question.trim().toLowerCase() === qNormForReadback && e.class !== 'component',
      );
      if (readbackExact) {
        // CRITICAL SAFETY: never trust the stored `verified` flag alone -- legacy rows carry a
        // cosmetic verified:true from before the BP131 honesty fix. Re-derive at READ time via
        // the SAME computeHonestVerification() the write path uses; an entry with no qualifying
        // corroboration/provenance signal (including a bare single_authority/user_perplexity
        // legacy row, or one simply missing the fields needed to prove honest verification)
        // fails CLOSED here exactly as it does at write time, and is never recalled.
        const { verified: readbackHonestVerified } = computeHonestVerification(readbackExact);
        if (readbackHonestVerified) {
          const readbackOptions = parseOptionsFromPrompt(mcPromptWithSubstrate);
          const readbackMatch = resolveAuthorityLetterMatch(readbackExact.answer, readbackOptions);
          if (readbackMatch) {
            const readbackLatencyMs = Date.now() - startMs;
            const readbackConcordance: ConcordanceClass = 'CONCORDANT';
            const readbackBmv = computeBmvScore(0, 0, 0, 0, readbackConcordance, 0, readbackLatencyMs);
            onProgress?.('production-readback-hit');
            console.log(
              `[plow_mc_answerer] PRODUCTION READBACK hit: recalled letter=${readbackMatch.letter} ` +
              `from original provenance="${readbackExact.provenance}" -- swarm never fired.`,
            );
            return {
              questionId,
              domain,
              chosenLetter: readbackMatch.letter,
              voterLetters: [readbackMatch.letter],
              voterDiagnostics: [{
                temperature: 0,
                status: 'parsed_ok',
                responseChars: readbackExact.answer.length,
                rawPreview: `substrate_readback: ${readbackExact.answer.slice(0, 200)}`,
              }],
              concordance: readbackConcordance,
              bmvScore: readbackBmv,
              // Swarm/voters/Andon never ran on this path -- 0 candidates/0 specialists is the
              // HONEST count; this is a recall of an already-verified answer, not a fresh solve.
              gateOutcomes: evaluateGates(0, readbackBmv, readbackConcordance, readbackLatencyMs),
              specialistsUsed: [],
              candidatesRaw: 0,
              candidatesPostMiner: 0,
              candidatesPostFurnace: 0,
              andonTriggered: false,
              andonRetries: andonRetry,
              ebletsWritten: 0,
              latencyMs: readbackLatencyMs,
              traceSummary:
                `substrate_readback:${readbackExact.provenance} chosenLetter=${readbackMatch.letter} ` +
                `matchScore=${readbackMatch.score.toFixed(2)} andonRetries=${andonRetry}`,
              provenanceReceipts: [{
                source: `substrate_readback:${readbackExact.provenance}`,
                contentHash: (readbackExact.sha256 || createHash('sha256').update(readbackExact.question + readbackExact.answer).digest('hex')).slice(0, 16),
                verified: true,
              }],
              // KN-BP144-1 Phase 1: letterSource deliberately left UNSET -- a cache recall of an
              // already-verified answer is not a derivation this ticket's closed vocabulary
              // describes (not a vote, not a calculator, not the ensemble). Gated off by default
              // (config.productionReadbackEnabled) and not exercised by this ticket's 12 gate
              // questions. See KN-BP144-1_REPORT.md.
            };
          }
        }
      }
    } catch (err) {
      // Truth-Always: a read-back failure must fall through to the normal derivation path,
      // never silently fabricate a recall or crash the whole answer attempt.
      console.warn('[plow_mc_answerer] production readback lookup failed (non-fatal, falling through to full derivation):', err);
    }
  }

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

  // ── BP137 Yoke v2b Stage F3: mesh-synergy assigned-authority short-circuit ─────────────────
  // OPT-IN via researchArmMode && researchArmMeshSynergy, both default false/absent -- see
  // CanonicalPlowMcConfig.researchArmMeshSynergy's own doc comment. meshSynergyOn is declared
  // here (byte-identical AND-gate pattern to computeSidecarOn/browserAuthorityOn/psionicOn just
  // above) so it is provably the ONE guard this whole block depends on.
  //
  // PLACEMENT (R-MECHANISM-VERIFY): this sits BEFORE Psionic and BEFORE the swarm -- earlier
  // than Stage F2's browser-authority-first block below -- because an assigned single-authority
  // peer must contribute ONLY that authority's slice for this question (Founder's explicit
  // "each peer contributes only its assigned slice" mesh-synergy directive). It must not also
  // burn Psionic/swarm/compute cycles answering the same question a second, redundant way.
  //
  // GATING: unreachable whenever meshSynergyOn is false, OR config.assignedAuthority is
  // absent, OR config.assignedAuthority === 'swarm' -- in every one of those cases this `if`
  // is skipped entirely and every line below (Psionic through the swarm/voter/Escalation/
  // Star-Chamber machinery) runs completely unchanged. This is the literal, provable
  // "assigned 'swarm' (or flag off) behaves exactly like today" requirement from the Stage F3
  // spec: a peer assigned 'swarm' takes NO different code path than a peer that never heard of
  // mesh synergy at all.
  const meshSynergyOn = !!(config.researchArmMode && config.researchArmMeshSynergy);
  const assignedAuthority = config.assignedAuthority;
  if (meshSynergyOn && assignedAuthority && assignedAuthority !== 'swarm') {
    onProgress?.(`mesh-synergy-assigned:${assignedAuthority}`);
    console.log(
      `[plow_mc_answerer] Stage F3 mesh-synergy: this peer was assigned authority=` +
      `${assignedAuthority} for this question -- skipping the full swarm, using ONLY that ` +
      `authority's slice.`,
    );
    // REAL bridge (not createNotWiredBridge()): reaches index.ts's
    // runBrowserAuthorityQueryFromMain() via a dynamic import -- same dynamic-import rationale
    // as Stage F2's own bridge above (index.ts already dynamically imports THIS module, so a
    // static top-level import in this direction would be a circular top-level require).
    const meshSynergyBridge: BrowserAuthorityBridge = {
      async runQueryInUserBrowser(query) {
        try {
          const mainModule = await import('../index');
          return await mainModule.runBrowserAuthorityQueryFromMain(query);
        } catch (err) {
          console.warn('[plow_mc_answerer] Stage F3 mesh-synergy bridge call failed (non-fatal, honest null):', err);
          return null;
        }
      },
    };
    let meshSynergyResult: BrowserAuthorityLookupResult | null = null;
    const meshSynergyOptions = parseOptionsFromPrompt(mcPromptWithSubstrate);
    // WIRE-THE-LOOP fix part 1: this is THE exact trace shape (resultFound=yes / matchScore=0.00
    // / matchedOption=none) the Founder's bug report quoted -- a mesh-synergy peer assigned
    // user_perplexity got a bare-question lookup with no options in the query, then the old
    // bare matchFreeTextAnswerToOption() call below silently discarded a genuinely correct
    // sourced answer as DISCORDANT. Fix: embed the MC options into the Perplexity query (same
    // mcOptions mechanism as Stage F2) so it states its own pick, and read that first.
    const meshSynergyOptionTexts = meshSynergyOptions.map((o) => `${o.letter}) ${o.text}`);
    try {
      // Force researchArmBrowserAuthority:true for THIS call only -- being assigned a browser
      // authority role by the asker's mesh-synergy dispatch IS the intent-to-use-browser-
      // authority signal; requiring a caller to ALSO separately flip researchArmBrowserAuthority
      // on top of researchArmMeshSynergy would be a redundant third gate the Stage F3 spec never
      // asks for. This does NOT bypass the real safety gate: runBrowserAuthorityQueryFromMain()
      // (index.ts) still independently checks the human's own persisted Settings > Authorities
      // toggle (ensureNexusAuthoritySession()'s isNexusAuthorityBrowserEnabled(), a GLOBAL flag
      // fully independent of this per-call config object) plus a live sign-in probe before ever
      // touching a real browser session -- see that function's own "HONEST NULL PATHS" doc.
      meshSynergyResult = await runBrowserAuthorityLookup(
        researchQuery,
        { ...config, researchArmBrowserAuthority: true, preferredAuthority: assignedAuthority, mcOptions: meshSynergyOptionTexts },
        meshSynergyBridge,
      );
    } catch (err) {
      console.warn(`[plow_mc_answerer] Stage F3 mesh-synergy ${assignedAuthority} lookup threw (non-fatal, honest null):`, err);
      meshSynergyResult = null;
    }
    const meshSynergyResolved = meshSynergyResult
      ? resolveAuthorityLetterMatch(meshSynergyResult.fact, meshSynergyOptions)
      : null;
    const meshSynergyMatch = meshSynergyResolved;
    const meshSynergyLatencyMs = Date.now() - startMs;
    const meshSynergyChosenLetter = meshSynergyMatch?.letter ?? null;
    // WIRE-THE-LOOP fix parts 2+3: a genuinely resolved mesh-synergy slice is a solved answer --
    // write it back + replicate it, same as every other solved-answer path in this file.
    if (meshSynergyChosenLetter && meshSynergyResult) {
      const meshSynergyOptionText = meshSynergyOptions.find((o) => o.letter === meshSynergyChosenLetter)?.text ?? '';
      try {
        await writeAndReplicateSolvedAnswer({
          researchQuery,
          domain,
          chosenLetter: meshSynergyChosenLetter,
          optionText: meshSynergyOptionText,
          reasoning: meshSynergyResult.fact,
          sourceUrl: meshSynergyResult.sourceUrl,
          authority: assignedAuthority,
          // BP131 honesty fix: exactly one peer/authority (assignedAuthority) was ever queried
          // for this slice -- a lone accept, not 2+-source agreement -- so this must NOT earn
          // verified:true (see writeAndReplicateSolvedAnswer's own doc comment).
          corroboration: 'single_authority',
        });
      } catch (err) {
        console.warn('[plow_mc_answerer] mesh-synergy writeback/replicate failed (non-fatal):', err);
      }
    }
    // Honesty firewall: a lookup that returned nothing usable, or returned a fact that matched
    // no MC option, is a genuine NO-ANSWER for this peer's assigned slice -- never guessed,
    // never silently defaulted to a letter. DISCORDANT (not a fabricated CONCORDANT) mirrors
    // how the rest of this file treats "swarm found nothing usable" (see the relevance-gate /
    // compute-fallthrough abstains above).
    const meshSynergyConcordance: ConcordanceClass = meshSynergyChosenLetter ? 'CONCORDANT' : 'DISCORDANT';
    const meshSynergyBmv = computeBmvScore(0, 0, 0, 0, meshSynergyConcordance, 0, meshSynergyLatencyMs);
    const meshSynergyTraceSummary =
      `meshSynergyAssignedAuthority=${assignedAuthority} resultFound=${meshSynergyResult ? 'yes' : 'no'} ` +
      `matchedOption=${meshSynergyChosenLetter ?? 'none'} matchScore=${meshSynergyMatch?.score.toFixed(2) ?? '0.00'} ` +
      `sourceUrl=${meshSynergyResult?.sourceUrl ?? 'n/a'} andonRetries=${andonRetry}`;
    console.log(
      `[plow_mc_answerer] Stage F3 mesh-synergy RESOLVED authority=${assignedAuthority} ` +
      `chosenLetter=${meshSynergyChosenLetter ?? 'NONE'} at t=${meshSynergyLatencyMs}ms -- swarm never fired.`,
    );
    return {
      questionId,
      domain,
      chosenLetter: meshSynergyChosenLetter,
      voterLetters: [meshSynergyChosenLetter],
      voterDiagnostics: [{
        temperature: 0,
        status: meshSynergyResult ? 'parsed_ok' : 'empty_response',
        responseChars: meshSynergyResult?.fact.length ?? 0,
        rawPreview: `mesh-synergy assigned=${assignedAuthority}: ${(meshSynergyResult?.fact ?? '(no usable result)').slice(0, 200)}`,
      }],
      concordance: meshSynergyConcordance,
      bmvScore: meshSynergyBmv,
      // Swarm never ran on this path -- 0 candidates/0 specialists is the HONEST count, this
      // peer's whole point is to contribute ONE authority's slice, not the swarm's.
      gateOutcomes: evaluateGates(0, meshSynergyBmv, meshSynergyConcordance, meshSynergyLatencyMs),
      specialistsUsed: [],
      candidatesRaw: 0,
      candidatesPostMiner: 0,
      candidatesPostFurnace: 0,
      andonTriggered: andonRetry > 0,
      andonRetries: andonRetry,
      ebletsWritten: 0,
      latencyMs: meshSynergyLatencyMs,
      traceSummary: meshSynergyTraceSummary,
      provenanceReceipts: meshSynergyResult ? [{
        source: `mesh_synergy:${assignedAuthority}`,
        contentHash: createHash('sha256').update(meshSynergyResult.fact).digest('hex').slice(0, 16),
        verified: meshSynergyResult.verified,
        ...(meshSynergyResult.sourceUrl ? { provenanceUrl: meshSynergyResult.sourceUrl } : {}),
      }] : [],
      meshSynergyAssigned: assignedAuthority,
      // KN-BP144-1 Phase 1: letterSource deliberately left UNSET -- a single assigned-authority
      // slice is not one of this ticket's 5 mechanisms. Gated off by default
      // (config.researchArmMeshSynergy) and not exercised by this ticket's 12 gate questions.
    };
  }

  // ── BP138 Yoke Phase 2: Decompose-and-Eliminate engine ──────────────────────
  // OPT-IN via researchArmMode && researchArmDecompose, both default false/absent. When either
  // is off, decomposeOn is false and runDecomposeAndEliminate is NEVER imported -- provable by
  // the single guard below. Every caller that predates this Phase sees zero behavioral change
  // (same byte-identical code path through Psionic/browser-authority/swarm/voters as before).
  //
  // PLACEMENT: after mesh-synergy (which already returns early) and before Psionic/F2/swarm so
  // that the engine can provide a deterministic answer before any network specialist fires.
  // If the engine returns null (authority-empty / all-unresolved / decompose-failed), execution
  // falls through to the EXISTING plow pipeline unchanged -- this is the honest escalation path.
  //
  // BP139 Authority Ensemble REORDERING: the body below is byte-identical to the pre-Yoke
  // inline block, just wrapped in a closure (attemptDecomposeAndEliminate) so it can be invoked
  // from TWO call sites instead of one -- see deferDecomposeToEnsembleFallback just below. The
  // Founder's mandate ("route compute to the authority, not decompose-eliminate") means a
  // computable/reasoning question, when researchArmAuthorityEnsemble is also on, must NOT run
  // decompose here; it runs decompose only as a FALLBACK after Stage F2's ensemble produced no
  // sourced letter (see the second call site right after Stage F2, below). Every other case
  // (ensemble off, or this question is lookup_fact) calls it HERE, at this exact pre-Yoke
  // position -- unchanged ordering, unchanged behavior.
  const decomposeOn = !!(config.researchArmMode && config.researchArmDecompose);
  const attemptDecomposeAndEliminate = async (): Promise<CanonicalPlowMcResult | null> => {
    try {
      const { runDecomposeAndEliminate } = await import('./plow_mc_decompose');
      const { runBrowserAuthorityQueryFromMain } = await import('../index');
      const decomposeBridge: BrowserAuthorityBridge = {
        async runQueryInUserBrowser(query) {
          try { return await runBrowserAuthorityQueryFromMain(query); } catch { return null; }
        },
      };
      const decomposeResult = await runDecomposeAndEliminate({
        questionId,
        question: researchQuery,
        options: parseOptionsFromPrompt(mcPromptWithSubstrate).map((o) => o.text),
        ollamaBaseUrl: config.ollamaBaseUrl ?? 'http://127.0.0.1:11434',
        model: config.model,
        bridge: decomposeBridge,
        config: {
          researchArmMode: true,
          researchArmDecompose: true,
          researchArmBrowserAuthority: true,
        },
        onProgress,
      });
      if (decomposeResult && decomposeResult.chosenLetter !== null) {
        // Deterministic answer from decompose -- build a CanonicalPlowMcResult receipt
        onProgress?.(`decompose-conclusion:${decomposeResult.chosenLetter}`);
        const decomposeLatencyMs = decomposeResult.latencyMs;
        // BP138 Fix A honesty invariant (superseded by KN-BP141-7 P5 immediately below): only a
        // genuinely sourced basis was ever eligible for full confidence -- 'sole-survivor-
        // elimination' (every other option falsified by a real sourced fact) or 'verified-true-
        // fact' (the surviving option's own foundation fact was independently verified-true).
        // Still computed and logged (never silently dropped, Rule 66 spirit) even though it no
        // longer gates concordance or the write-back below -- both are now unconditional per P5.
        const decomposeHasSourcedBasis =
          decomposeResult.basis === 'sole-survivor-elimination' ||
          decomposeResult.basis === 'verified-true-fact';
        console.log(
          `[plow_mc_answerer] KN-BP141-7 P5: decompose-and-eliminate fired (basis=${decomposeResult.basis}, ` +
          `hadSourcedBasis=${decomposeHasSourcedBasis}) -- ADVISORY-DEMOTED per this ticket (concordance ` +
          'forced to PARTIAL, substrate write-back skipped, regardless of basis).',
        );
        // KN-BP141-7 P5 (Founder-directed BP141, regression fix): DEMOTED TO ADVISORY. Three live
        // receipts this ticket (run 032) show elimination destroying correct answers (qid 105,
        // qid 111, qid 98) -- qid 111 specifically is THIS mechanism: decompose-and-eliminate
        // killed 8 of 9 options via Google-search-based elimination, kept option C, wrong (correct
        // answer was I, which run 031 found correctly via the authority ensemble before decompose
        // ever got a chance to run on that question). Decompose-and-eliminate has never been
        // measured against the ~2% false-negative-rate bar R1/R2/R3 (KN-BP141-3 Stage 1) were held
        // to on the full 10,956-question corpus -- no such measurement exists as of this ticket,
        // and this ticket does NOT run that corpus itself (Founder-run only). Per this ticket's own
        // explicit instruction ("demote... to advisory UNLESS it can show a measured false-negative
        // rate below ~2%... report that no such measurement currently exists"): decomposeConcordance
        // is now UNCONDITIONALLY 'PARTIAL', never 'CONCORDANT', regardless of decomposeHasSourcedBasis
        // -- a real, measured demotion (lower BMV/gate confidence downstream), not a cosmetic label.
        // This is a genuine behavior change from the pre-KN-BP141-7 code (which granted full
        // CONCORDANT confidence on a sourced basis) -- never widened back to CONCORDANT here to
        // force a pass; if this demotion changes a previously-passing question's gate outcome,
        // that is the honest, correct result of an unmeasured mechanism no longer claiming
        // certainty it has not earned.
        const decomposeConcordance: ConcordanceClass = 'PARTIAL';
        const decomposeAdvisoryDemoted = true;
        const decomposeBmv = computeBmvScore(0, 0, 0, 0, decomposeConcordance, 0, decomposeLatencyMs);
        // KN-BP141-7 P5: the substrate write-back (writeAndReplicateSolvedAnswer) is now SKIPPED
        // UNCONDITIONALLY for decompose-sourced answers, even on a nominally "sourced" basis --
        // teaching the mesh an unmeasured, over-elimination-prone mechanism's answer as verified
        // truth would compound this exact defect across every future question that reads the
        // substrate, not just this one. The decompose result itself is still returned below (it
        // remains the best available answer when nothing else in the pipeline produced one -- an
        // advisory guess is still better than a guaranteed abstain when it is the ONLY source) but
        // it no longer self-teaches. Per Rule 66, nothing is deleted here -- this is a change to
        // what gets written GOING FORWARD, never a rewrite/removal of anything already on disk.
        return {
          questionId,
          domain,
          chosenLetter: decomposeResult.chosenLetter,
          voterLetters: [decomposeResult.chosenLetter],
          voterDiagnostics: [{
            temperature: 0,
            status: 'parsed_ok',
            responseChars: decomposeResult.traceSummary.length,
            rawPreview: `decompose-and-eliminate (KN-BP141-7 P5: ADVISORY, demoted, no substrate write-back): ${decomposeResult.traceSummary.slice(0, 200)}`,
          }],
          concordance: decomposeConcordance,
          decomposeAdvisoryDemoted,
          bmvScore: decomposeBmv,
          gateOutcomes: evaluateGates(0, decomposeBmv, decomposeConcordance, decomposeLatencyMs),
          specialistsUsed: [],
          candidatesRaw: 0,
          candidatesPostMiner: 0,
          candidatesPostFurnace: 0,
          andonTriggered: false,
          andonRetries: 0,
          ebletsWritten: 0,
          latencyMs: decomposeLatencyMs,
          traceSummary: decomposeResult.traceSummary,
          provenanceReceipts: decomposeResult.receipts
            .filter((r) => r.verdict === 'kill' && r.sourceUrl)
            .map((r) => ({
              source: `decompose-eliminate:${r.option}@${r.sourceUrl!.slice(0, 60)}`,
              contentHash: createHash('sha256').update(r.fact ?? r.foundationQuery).digest('hex').slice(0, 16),
              verified: true,
              ...(r.sourceUrl ? { provenanceUrl: r.sourceUrl } : {}),
            })),
          // KN-BP144-1 Phase 1: letterSource deliberately left UNSET -- decompose-and-eliminate is
          // not one of this ticket's 5 mechanisms (it eliminates OPTIONS, not candidate SOURCES;
          // see the ticket's own Phase 2 framing). This result is only ever used as an ADVISORY
          // stash (attemptDecomposeAndEliminate's own contract) -- if it becomes the served
          // answer, it does so via the last-resort return, which is separately flagged by
          // decomposeAdvisoryUsedAsLastResort. Not exercised by this ticket's 12 gate questions.
        };
      }
      // decomposeResult is null OR chosenLetter is null (honest ABSTAIN / authority-empty):
      // fall through to existing Psionic/browser-authority/swarm pipeline unchanged.
      return null;
    } catch (err) {
      // Non-fatal -- fall through to existing plow
      console.warn('[plow_mc_answerer] Phase 2 decompose threw (non-fatal, falling through):', err);
      return null;
    }
  };
  // BP139 Authority Ensemble: authorityEnsembleOn is the three-way AND (researchArmMode +
  // researchArmBrowserAuthority + researchArmAuthorityEnsemble) -- see that flag's own doc
  // comment on CanonicalPlowMcConfig. earlyAnswerTypeForOrdering is a SECOND (cheap, pure,
  // deterministic, zero-I/O) classifyAnswerType() call, used ONLY to decide decompose's ordering
  // before Stage F2 runs its own (also duplicate, also harmless) classification below -- both
  // calls always agree, see answer_type_classifier.ts's own determinism guarantee.
  const authorityEnsembleOn = !!(config.researchArmMode && config.researchArmBrowserAuthority && config.researchArmAuthorityEnsemble);
  const earlyAnswerTypeForOrdering = authorityEnsembleOn ? classifyAnswerType(researchQuery) : undefined;
  const deferDecomposeToEnsembleFallback =
    authorityEnsembleOn && (earlyAnswerTypeForOrdering === 'computable' || earlyAnswerTypeForOrdering === 'reasoning');
  // KN-BP142-2 Defect A (Founder-directed BP142): "Advisory must mean CANNOT DECIDE. Not decides
  // with a weaker label." Prior to this fix, BOTH decompose call sites (this one and the second,
  // just after Stage F2 below) did `if (decomposeEarlyResult) return decomposeEarlyResult;` --
  // an UNCONDITIONAL early return the instant decompose produced any letter at all. That made
  // decompose (KN-BP141-7 P5: demoted to PARTIAL concordance, no substrate write-back, an
  // unmeasured mechanism with no false-negative-rate bar) structurally EQUIVALENT in priority to
  // every stronger downstream mechanism it runs BEFORE -- Psionic, browser-authority Stage F2, the
  // authority ensemble, and swarm+voters never got a chance to even attempt a question decompose
  // happened to answer wrong. Live receipts: qid 111 (Jupiter moon-resonance question, correct
  // answer I) -- run 031's authority ensemble found I correctly; run 032 AND run 033 both let
  // decompose fire FIRST at this exact call site (before the ensemble ever ran), kill 8 of 9
  // options via Google-search-based elimination, keep wrong option C, and return it as the FINAL
  // answer in over two minutes -- costing the point both times, with the correct mechanism never
  // even consulted.
  //
  // THE FIX: `decomposeAdvisoryResult` (declared just below) is a STASH, never an early return.
  // Every downstream tier gets the exact same unobstructed chance to decide this question that it
  // would have had if decompose had abstained outright -- byte-identical control flow to
  // decomposeOn===false from this point through the rest of the pipeline. The stash is consulted
  // in EXACTLY ONE place: this function's own final fallthrough return, far below, and ONLY when
  // the entire rest of the pipeline (Psionic, browser authority, authority ensemble, swarm+voters)
  // reaches ITS OWN natural end with chosenLetter still null -- i.e. only as the last resort when
  // the alternative is a guaranteed abstain, never as a substitute for a real decision. This is
  // NOT a change to elimination's own strength or to any gate (per this ticket's explicit "do NOT
  // fix this by making elimination stronger or by widening any gate" instruction) -- it is a
  // change to WHO gets to decide first, nothing else.
  let decomposeAdvisoryResult: CanonicalPlowMcResult | null = null;
  if (decomposeOn && !deferDecomposeToEnsembleFallback) {
    const decomposeEarlyResult = await attemptDecomposeAndEliminate();
    if (decomposeEarlyResult) {
      decomposeAdvisoryResult = decomposeEarlyResult;
      console.log(
        `[plow_mc_answerer] KN-BP142-2 Defect A: decompose-and-eliminate produced an ADVISORY ` +
        `candidate (letter=${decomposeEarlyResult.chosenLetter}, basis trace in traceSummary) at ` +
        `the pre-ensemble call site -- STASHED, not returned. The full pipeline (Psionic/browser-` +
        `authority/ensemble/swarm+voters) runs exactly as if decompose had abstained; this ` +
        `candidate can only become the final answer if every one of those stages also abstains.`,
      );
    }
  }

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
          // KN-BP144-1 Phase 1: letterSource deliberately left UNSET -- Psionic's own predictive
          // short-circuit is not one of this ticket's 5 mechanisms (already distinctly flagged by
          // psionicShortCircuit above). Gated off by default; not exercised by this ticket's 12
          // gate questions.
        };
      }
    }
  }

  // ── BP137 Yoke v2b Stage F2: browser-authority-FIRST routing for fact-shaped questions ────
  // WHY HERE (R-MECHANISM-VERIFY): the prior pass (Integration-1/Stage C, see the receipt-only
  // remnant comment near componentFactsList below) called the browser authority AFTER the
  // 9-specialist swarm had already fired its network calls -- confirmed by direct read: that
  // call site lived inside the `if (computeSidecarOn || browserAuthorityOn)` block below,
  // itself positioned AFTER the swarm loop a few lines down. The Founder's explicit F2
  // directive is "ask Google FIRST" -- so this block sits HERE, before the swarm loop's first
  // specialist fetch, and is fully awaited (sequential, not fire-and-forget) before any code
  // below it runs. This is the literal, provable "no swarm network call fires before the
  // browser-authority calls resolve" guarantee build item 1 asks for.
  //
  // Classification is intentionally duplicated (cheap, pure, zero I/O -- see
  // answer_type_classifier.ts) rather than sharing state with the `classifiedAnswerType`
  // variable assigned later below: that variable is only set inside the `if (computeSidecarOn
  // || browserAuthorityOn)` block further down (unchanged from Integration-1 -- the one and
  // only site that populates CanonicalPlowMcResult.answerType, so every existing return path's
  // reference to classifiedAnswerType stays untouched by this Stage). Calling
  // classifyAnswerType() a second time here has ZERO behavioral difference (deterministic,
  // side-effect-free) and keeps this block fully self-contained.
  //
  // GATING: this whole block is `if (browserAuthorityOn)` -- browserAuthorityOn is already
  // `!!(config.researchArmMode && config.researchArmBrowserAuthority)` (declared above,
  // unchanged). When either is false/absent (every caller that predates this Yoke, including
  // every existing computeSidecarOn-only or plain swarm+voter caller), this entire block is
  // unreachable and browserGoogleResult/browserPerplexityResult/browserAuthorityCorroboration
  // stay at their initial null/'none' values -- which the injection block further below (right
  // after the relevance gate) treats as "nothing to inject", making the rest of this function
  // byte-for-byte unchanged for the flag-off case. This is build item 4's "zero behavior change
  // on the fallback path" requirement, provable by inspection.
  let browserGoogleResult: BrowserAuthorityLookupResult | null = null;
  let browserPerplexityResult: BrowserAuthorityLookupResult | null = null;
  let browserGoogleMatch: { letter: string; score: number } | null = null;
  let browserPerplexityMatch: { letter: string; score: number } | null = null;
  let browserAuthorityAttempted = false;
  let browserAuthorityCorroboration: CanonicalPlowMcResult['browserAuthorityCorroboration'] = 'none';
  // BP1xx Authority-Ensemble-swarm-fold-in: captured OUTSIDE the `if (authorityEnsembleOn)`
  // block below so the fall-through path (right before the specialist-swarm loop further down)
  // can tell whether the ensemble already fired the swarm as a corroborating candidate -- if so,
  // that same swarm must NOT fire a second time; re-running it would double the network/model
  // cost for a question the ensemble already tried its best on, defeating the "stays cheap"
  // requirement. Stays false/undefined for every case where the ensemble is off or never reached
  // the uncertain branch (2+ authorities agreed immediately).
  let ensembleSwarmAlreadyFired = false;
  let ensembleSwarmReceipt: AuthorityEnsembleOutcome['swarmReceipt'];
  // KN-BP143-2 B1a: captured OUTSIDE the `if (authorityEnsembleOn)` block below, same
  // outer-scope convention as ensembleSwarmAlreadyFired/ensembleSwarmReceipt just above, so the
  // browserAuthorityTrace line far below (which runs unconditionally on every browserAuthorityOn
  // question, regardless of which branch resolved it) can report the ENSEMBLE's own real
  // candidate list instead of browserGoogleResult/browserPerplexityResult -- those two variables
  // are only ever written inside the LEGACY (else) branch a few hundred lines down and are
  // provably dead reads whenever authorityEnsembleOn is true (which is every scored-path call,
  // since researchArmAuthorityEnsemble is fanned in from the same researchArmMode flag as
  // researchArmBrowserAuthority itself -- see callCanonicalPlowMcAnswererForMeshTest). Stays
  // undefined when the ensemble never runs (flag off, or the legacy branch was taken), which the
  // trace line below treats as "fall back to the pre-existing legacy variables", so the flag-off/
  // legacy-branch case is byte-for-byte unchanged.
  let ensembleCandidatesForTrace: AuthorityEnsembleCandidate[] | undefined;
  // KN-BP144-7 T1-T4: mirrors ensembleCandidatesForTrace's own outer-scope-capture pattern
  // immediately below/above -- created fresh (all 'not_attempted') right before the ensemble is
  // invoked, threaded into runAuthorityEnsemble via config.authorityOutcomesSink, then mutated IN
  // PLACE by that call (see runAuthorityEnsemble's own authorityOutcomes doc comment). Stays
  // undefined when the ensemble never runs, exactly like ensembleCandidatesForTrace.
  let authorityOutcomesForTrace: BrowserAuthorityAttemptOutcomes | undefined;
  // KN-BP144-1 Phase 1: mirrors ensembleCandidatesForTrace's own outer-scope-capture pattern
  // (KN-BP143-2 B1a) -- captured unconditionally the moment the ensemble returns, so every
  // downstream return site (accept, decompose-last-resort, and the final voter-concordance
  // fall-through) can carry the SAME real ensembleOutcome.corroboration through to the receipt,
  // never recomputed or inferred from other fields. See CanonicalPlowMcResult.
  // ensembleOutcomeCorroboration's own doc comment for why this is not redundant with
  // browserAuthorityCorroboration (that variable is shared with, and overwritten by, the LEGACY
  // non-ensemble branch below with a narrower vocabulary).
  let ensembleOutcomeCorroborationForTrace: AuthorityEnsembleOutcome['corroboration'] | undefined;
  // WIRE-THE-LOOP fix part 5 (compute/reasoning routing): earlyAnswerTypeForBrowserAuthority is
  // read once here (was already computed inside the old lookup_fact-only branch) so both the
  // lookup and the widened compute/reasoning gate below share one classification call.
  let earlyAnswerTypeForBrowserAuthority: AnswerType | undefined;
  if (browserAuthorityOn) {
    earlyAnswerTypeForBrowserAuthority = classifyAnswerType(researchQuery);
    // WIRE-THE-LOOP fix part 5: a computable/reasoning question (e.g. the density calc -- 750
    // kg / (0.25m x 0.10m x 50.0m) = 600 kg/m3) must route to Perplexity (which reasons AND
    // computes), never to Google/the wikipedia-style specialist swarm, which cannot solve it.
    // isLookupType keeps Google in play ONLY for genuine lookup_fact questions (its existing,
    // unchanged role); isComputeOrReasoningType is the NEW gate that fires Perplexity-only for
    // the other two answer types -- Google is never called on this branch.
    const isLookupType = earlyAnswerTypeForBrowserAuthority === 'lookup_fact';
    const isComputeOrReasoningType = earlyAnswerTypeForBrowserAuthority === 'computable' || earlyAnswerTypeForBrowserAuthority === 'reasoning';
    if (isLookupType || isComputeOrReasoningType) {
      browserAuthorityAttempted = true;
      onProgress?.('browser-authority-lookup-first');
      console.log(`[plow_mc_answerer] Stage F2 seq=1 browser-authority-first: firing BEFORE swarm at t=${Date.now() - startMs}ms (answerType=${earlyAnswerTypeForBrowserAuthority}).`);
      // REAL bridge (not createNotWiredBridge()): reaches index.ts's
      // runBrowserAuthorityQueryFromMain() via a dynamic import -- same dynamic-import
      // rationale as Integration-1's own bridge (index.ts already dynamically imports THIS
      // module, so a static top-level import in this direction would be a circular require).
      const browserBridge: BrowserAuthorityBridge = {
        async runQueryInUserBrowser(query) {
          try {
            const mainModule = await import('../index');
            return await mainModule.runBrowserAuthorityQueryFromMain(query);
          } catch (err) {
            console.warn('[plow_mc_answerer] Stage F2 browser-authority bridge call failed (non-fatal, honest null):', err);
            return null;
          }
        },
        // KN-BP144-7 T1/T2, OPTIONAL/ADDITIVE (BrowserAuthorityBridge.runQueryInUserBrowserObserved
        // is an optional interface member -- see that field's own doc comment): reaches THE SAME
        // single shared wrapper (runBrowserAuthorityQueryFromMainObserved, index.ts) T1 requires,
        // and reports its dispatch-level classification back to runBrowserAuthorityLookupObserved
        // (browser_authority_adapter.ts), which is what lets the Authority Ensemble distinguish
        // disabled/not_signed_in/timeout/no_result for real instead of falling back to this
        // bridge's own coarsest classification. Never a second, divergent call: exactly one
        // runBrowserAuthorityQueryFromMainObserved invocation per query, same as
        // runQueryInUserBrowser above always was for runBrowserAuthorityQueryFromMain.
        async runQueryInUserBrowserObserved(query) {
          try {
            const mainModule = await import('../index');
            return await mainModule.runBrowserAuthorityQueryFromMainObserved(query);
          } catch (err) {
            console.warn('[plow_mc_answerer] Stage F2 browser-authority bridge (observed) call failed (non-fatal, honest no_result):', err);
            return { raw: null, dispatchOutcome: 'no_result' };
          }
        },
      };
      // WIRE-THE-LOOP fix part 1: the MC options this question actually has, embedded into
      // Perplexity's prompt (buildMcAwareQueryText, via BrowserAuthorityAdapterConfig.mcOptions)
      // so IT picks a letter and states its reasoning + source, instead of a bare lookup snippet
      // that a token-overlap matcher then has to guess against.
      const mcOptionsForBrowserAuthority = parseOptionsFromPrompt(mcPromptWithSubstrate);
      const mcOptionTextsForQuery = mcOptionsForBrowserAuthority.map((o) => `${o.letter}) ${o.text}`);

      // BP139 Authority Ensemble branch point: authorityEnsembleOn (computed above, before the
      // decompose block) is the ONLY thing that decides which of the two mutually-exclusive
      // paths below runs. false/absent (every pre-Yoke caller) takes the ELSE branch, which is
      // the EXACT pre-ensemble logic, byte-for-byte unchanged from before this Yoke.
      if (authorityEnsembleOn) {
        // KN-BP144-7 T1-T4: a fresh all-'not_attempted' sink, threaded into runAuthorityEnsemble
        // below via a shallow-cloned config (never mutates the caller's own `config` object) so
        // that function can mutate it IN PLACE as it genuinely reaches each authority. Read back
        // into authorityOutcomesForTrace immediately after the call returns.
        const authorityOutcomesSinkForEnsemble = createDefaultAuthorityAttemptOutcomes();
        const ensembleOutcome = await runAuthorityEnsemble({
          researchQuery,
          mcOptions: mcOptionsForBrowserAuthority,
          mcOptionTexts: mcOptionTextsForQuery,
          config: { ...config, authorityOutcomesSink: authorityOutcomesSinkForEnsemble },
          bridge: browserBridge,
          // Non-null: this branch only runs inside `if (browserAuthorityOn)`, right after the
          // unconditional `earlyAnswerTypeForBrowserAuthority = classifyAnswerType(...)` assignment
          // above -- always set by this point.
          answerType: earlyAnswerTypeForBrowserAuthority!,
          domain,
          mcPromptWithSubstrate,
          widenerOperators,
          widenerBackupOperators,
          onProgress,
          log: (msg) => console.log(`[plow_mc_answerer] Stage F2 ensemble ${msg}`),
        });
        browserAuthorityCorroboration = ensembleOutcome.corroboration;
        ensembleSwarmAlreadyFired = ensembleOutcome.swarmFired;
        ensembleSwarmReceipt = ensembleOutcome.swarmReceipt;
        // KN-BP143-2 B1a: ensembleOutcome.candidates is ALWAYS populated on every return path of
        // runAuthorityEnsemble (the accept branches AND every fall-through-to-disagree/adjudicate
        // branch alike -- confirmed by direct read of every return statement in that function),
        // unlike CanonicalPlowMcResult.ensembleCandidates further below (which this ticket's own
        // Part A report found is only attached on the accept branch). Capturing the OUTCOME's own
        // candidates here, unconditionally, is what lets the trace line below report real
        // per-authority participation even on a disagree/fallthrough question like qid 66.
        ensembleCandidatesForTrace = ensembleOutcome.candidates;
        ensembleOutcomeCorroborationForTrace = ensembleOutcome.corroboration;
        // KN-BP144-7 T1-T4: authorityOutcomesSinkForEnsemble was mutated in place by the call
        // above -- this is simply reading that same object back, never re-deriving it.
        authorityOutcomesForTrace = authorityOutcomesSinkForEnsemble;
        console.log(
          `[plow_mc_answerer] Stage F2 ensemble RESOLVED at t=${Date.now() - startMs}ms ` +
          `corroboration=${ensembleOutcome.corroboration} swarmFired=${ensembleOutcome.swarmFired} ` +
          `candidates=[${ensembleOutcome.candidates.map((c) => `${c.authority}:${c.letter}`).join(', ') || 'none'}] ` +
          `chosen=${ensembleOutcome.chosenLetter ?? 'NONE'}.`,
        );
        // ── BP1xx Deterministic-Compute-Override ("let the calculator win the math") ──────────
        // For a computable question the ensemble above just settled on a letter from an LLM/
        // browser authority (or the swarm) -- but that authority can flub unit arithmetic (the
        // density case: reasons its way to "600 kg/m^3" yet states the WRONG letter because the
        // MC options are stated in g/cc). The deterministic units-aware compute
        // (computeUnitAwareMatch, compute_sidecar.ts) already proves it can solve that case
        // standalone; the bug was that it only ever lived in the compute-sidecar block far
        // downstream of this accept/return, so it never got a chance to run. Firing it HERE --
        // against the reasoning text the ensemble already has -- lets it run AFTER the authority
        // has produced reasoning but BEFORE the ensemble's letter is finalized/returned. Gated on
        // the SAME researchArmAuthorityEnsemble flag as the rest of this branch (we are already
        // inside `if (authorityEnsembleOn)`) -- off = unchanged, byte-for-byte. Only fires for
        // 'computable' (this whole branch is under isComputeOrReasoningType/isLookupType, but the
        // extra `=== 'computable'` check keeps 'reasoning' and lookup_fact questions untouched,
        // exactly per spec). Honesty: computeUnitAwareMatch itself already abstains (returns
        // null) on 0/2+/dimensionally-incompatible matches -- that exact-one-option gate is
        // reused unchanged here, so this can only ever REPLACE one checked letter with another
        // checked letter, never fabricate one.
        let deterministicOverride: DeterministicComputeCandidate | null = null;
        let overrideFired = false;
        // finalChosenLetter is truthy iff ensembleOutcome.chosenLetter was truthy (the decision
        // call below is only ever made when that held) -- the accept condition further below is
        // unchanged in shape.
        let finalChosenLetter = ensembleOutcome.chosenLetter;
        // BP1xx DETERMINISTIC-OVERRIDE-HOIST: the ensemble already ran the SAME six-tier override
        // BEFORE any agree/disagree/adjudicate/single-source branching (see runAuthorityEnsemble's
        // own pre-branch check, right before its FAST PATH block) and short-circuited straight to
        // this letter. There is no separate "ensemble letter" to compare against here -- this is
        // always the override result, never a mere corroboration of some other pick -- so the
        // second resolveDeterministicComputeOverride call below is skipped entirely: it would just
        // recompute the identical six tiers a second time for the same question, wasted spend.
        if (ensembleOutcome.corroboration === 'deterministic_compute_override' && ensembleOutcome.deterministicOverride) {
          deterministicOverride = ensembleOutcome.deterministicOverride;
          overrideFired = true;
          finalChosenLetter = ensembleOutcome.chosenLetter;
          console.log(
            `[plow_mc_answerer] Stage F2 DETERMINISTIC OVERRIDE (pre-branch hoist): ` +
            `${deterministicOverride.method} -> ${deterministicOverride.letter} -- calculator ` +
            `answered before any authority agreement was even evaluated.`,
          );
        } else if (ensembleOutcome.chosenLetter && earlyAnswerTypeForBrowserAuthority === 'computable') {
          // The accepted candidate(s)' own reasoning text is the primary source (e.g.
          // Perplexity's fact text stating "... = 600 kg/m^3 ..."); when the swarm fired, its
          // voters' raw previews are folded in too as extra candidate quantity sources -- same
          // "componentFacts" contract computeUnitAwareMatch already accepts for the downstream
          // compute-sidecar call site at ~Stage A.3.
          // BP139 fix: feed ALL candidates' reasoning, not just the accepted one. On the
          // adjudication path the accepted candidate is the JUDGE, whose "the answer is X" text
          // does not restate the computed quantity ("600 kg/m^3") -- that value lives in the
          // ORIGINAL candidate (Perplexity) reasoning in ensembleOutcome.candidates. Feeding only
          // acceptedCandidates meant the override never saw the number and could not fire (density
          // kept missing via the judge's wrong letter). candidates first (where the worked value
          // lives), then accepted (the judge, in case it restates), then swarm voters.
          const overrideReasoningTexts = [
            ...ensembleOutcome.candidates.map((c) => c.reasoning),
            ...ensembleOutcome.acceptedCandidates.map((c) => c.reasoning),
            ...(ensembleOutcome.swarmReceipt?.voterDiagnostics.map((v) => v.rawPreview) ?? []),
          ];
          // BP-DETERMINISTIC-OVERRIDE-3TIER: now awaited -- tier (ii) inside
          // resolveDeterministicComputeOverride (computeAnswer) is async (may call ollama/
          // Wolfram). ollamaBaseUrl/model are the SAME config values already destructured at
          // this function's top (unchanged dependency, no new config surface); wolframAppId
          // mirrors the SAME process.env.WOLFRAM_APP_ID the downstream compute-sidecar block's
          // own computeAnswer() call already reads independently of specialistKeys (see that
          // call site's own comment).
          // BP141-2 Task B: same real independent-source scatter contract as the pre-branch hoist
          // site above, built from the FULLER post-ensemble candidate list (includes the swarm's
          // own vote, unlike the pre-branch hoist which runs before the swarm fires).
          const overrideIndependentSources: IndependentSourceVote[] = ensembleOutcome.candidates.map((c) => ({
            letter: c.letter,
            derivationPath: resolveCakeDerivationPath(c),
          }));
          const decision = await resolveDeterministicComputeOverride(
            researchQuery, mcOptionsForBrowserAuthority, ensembleOutcome.chosenLetter, overrideReasoningTexts,
            { ollamaBaseUrl, model, wolframAppId: process.env.WOLFRAM_APP_ID },
            overrideIndependentSources,
            // KN-BP141-10: `browserBridge` is already in scope here (constructed a few lines above,
            // same real bridge the Stage F2 ensemble call above it already uses) -- threaded through
            // for the SAME C7 reason as the pre-branch hoist site above.
            browserBridge,
          );
          deterministicOverride = decision.deterministicOverride;
          overrideFired = decision.overrideFired;
          finalChosenLetter = decision.finalLetter;
          // BP-COMPUTE-DEMOTE-SITE-2 (Bishop-ratified, same rule as the pre-branch hoist site).
          // KN-BP143-1b: widened from `deterministicOverride.source === 'reasoning_fact'` to
          // `!isLiteralExpressionProvenance(deterministicOverride)` -- the narrower string check
          // only ever caught tier (i)'s own reasoning-text-extraction path; it structurally could
          // NOT catch no_consensus_from_scatter or the elimination-cascade fallback reaching this
          // site via `decision.deterministicOverride` (both hardcode `source: 'question_expression'`
          // even though neither derives from the question text -- see each tier's own
          // computeProvenance doc comment), so either could have reached
          // `overrideFired && deterministicOverride` here, overturned a settled ensemble consensus,
          // and tripped the KN-BP141-7 P2 hard invariant below as if it were a genuine proof.
          // isLiteralExpressionProvenance closes that gap for every tier at once, and is BYTE-
          // IDENTICAL for the reasoning_fact case this site already handled (source='reasoning_fact'
          // classifies to computeProvenance='model_derived' 1:1, see classifyUnitAwareComputeProvenance).
          // Every one of the non-literal sources named in the comment historically here
          // (question_expression / schedule_solver / density_solver / physics_solver /
          // aircraft_solver) are the genuine deterministic floor and keep their veto UNCHANGED
          // below -- only a model_derived candidate is declined here BEFORE the finalChosenLetter
          // it would otherwise have produced (decision.finalLetter) is allowed to stick, by
          // reverting finalChosenLetter to the ensemble's own letter and forcing overrideFired
          // false -- every downstream field gated on `overrideFired && deterministicOverride` (the
          // eblet writeback's reasoning/authority/sourceUrl/corroboration, traceSummary,
          // provenanceReceipts) then honestly falls back to its own no-override path, i.e. the
          // ensemble's genuine accepted-candidate authority/reasoning/sourceUrl, exactly as if no
          // compute had run. `deterministicOverride` itself is left populated (not nulled) so
          // nothing downstream that merely reads its fields (none do outside the
          // overrideFired-gated branches today) is surprised by a null -- the compute's own result
          // is still visible right here in this log line, it simply loses its veto.
          if (overrideFired && deterministicOverride && !isLiteralExpressionProvenance(deterministicOverride)) {
            console.log(
              `[plow_mc_answerer] ${deterministicOverride.method} (model_derived: ` +
              `${deterministicOverride.computeProvenanceDetail}) declined to override settled ` +
              `ensemble answer ${ensembleOutcome.chosenLetter} -- no independent grounding, ` +
              `ensemble result stands.`,
            );
            finalChosenLetter = ensembleOutcome.chosenLetter;
            overrideFired = false;
          } else if (overrideFired && deterministicOverride) {
            console.log(
              `[plow_mc_answerer] Stage F2 DETERMINISTIC OVERRIDE: ensemble picked ` +
              `${ensembleOutcome.chosenLetter}, deterministic compute (${deterministicOverride.method}, ` +
              `source=${deterministicOverride.source}, ` +
              `${deterministicOverride.computedValue}${deterministicOverride.computedUnit ? ' ' + deterministicOverride.computedUnit : ''}) ` +
              `says ${deterministicOverride.letter} -- calculator wins the math, overriding.`,
            );
          } else if (deterministicOverride) {
            console.log(
              `[plow_mc_answerer] Stage F2 deterministic compute (${deterministicOverride.method}, ` +
              `source=${deterministicOverride.source}) corroborates the ensemble's own letter ` +
              `${ensembleOutcome.chosenLetter} -- no override needed.`,
            );
          }
          // KN-BP141-7 P2 (Founder-directed BP141): "A DETERMINISTIC PROOF OUTRANKS EVERY PICK,
          // ABSOLUTELY... a referee must not be allowed to overrule one." This is a defensive,
          // belt-and-suspenders hard assertion on top of the assignment above (which already
          // guarantees this by construction: `finalChosenLetter = decision.finalLetter` a few
          // lines up, for the exact literal_expression case checked here) -- it exists so the
          // invariant is AUDITED, not merely believed. KN-BP143-1b: widened from
          // `source !== 'reasoning_fact'` to `isLiteralExpressionProvenance(deterministicOverride)`
          // for the SAME reason as the demotion check just above -- a genuine literal_expression
          // proof that fired must never end up losing to ensembleOutcome.chosenLetter, whether that
          // letter came from plain agreement, a lone accept, OR the Cake Method's own pick-stage
          // plurality (ensembleOutcome.corroboration === 'adjudicated'). Throws loudly rather than
          // silently accepting a violated invariant, per this ticket's own "never widen a gate to
          // force a pass" discipline.
          if (overrideFired && deterministicOverride && isLiteralExpressionProvenance(deterministicOverride)) {
            if (finalChosenLetter !== deterministicOverride.letter) {
              throw new Error(
                'DETERMINISTIC PROOF OVERRULED BY A PICK (KN-BP141-7 P2 INVARIANT VIOLATION): ' +
                `deterministic compute (${deterministicOverride.method}, source=${deterministicOverride.source}) ` +
                `proved letter ${deterministicOverride.letter}, but finalChosenLetter is ` +
                `${finalChosenLetter ?? 'null'} -- a referee (ensemble/Cake pick-stage result ` +
                `${ensembleOutcome.chosenLetter ?? 'null'}) must never be allowed to overrule a proof.`,
              );
            }
          }
        }
        // BP-COMPUTE-HONEST-DEMOTE: the ONE place this override's honesty label is decided,
        // reused for both the `authority` provenance string and the `corroboration` field below
        // (writeAndReplicateSolvedAnswer / writeComputeMethodEblet / mintFormulaEbletFromCompute
        // all read `deterministicOverride.source`/`.method` directly, so they self-adjust; this
        // const only covers the two string literals built inline at this call site). Neither the
        // pre-branch hoist path (ensembleOutcome.corroboration === 'deterministic_compute_override')
        // nor the post-branch override above can reach `overrideFired && deterministicOverride`
        // with a model_derived candidate any more (BP-COMPUTE-DEMOTE-SITE-2 declines it before
        // overrideFired is ever set true for that case) -- so this const can still evaluate true
        // for a model_derived result, but every consumer below is itself gated on
        // `overrideFired && deterministicOverride`, which is false in that case, so the label is
        // computed but never actually used to describe an override that didn't happen.
        // KN-BP143-1b: widened from `deterministicOverride.source === 'reasoning_fact'` to
        // `!isLiteralExpressionProvenance(deterministicOverride)`, same rationale as above.
        const overrideIsAuthorityExtracted = !!deterministicOverride && !isLiteralExpressionProvenance(deterministicOverride);
        const overrideComputeLabel: 'deterministic_compute' | 'authority_extracted_compute' =
          overrideIsAuthorityExtracted ? 'authority_extracted_compute' : 'deterministic_compute';
        if (finalChosenLetter && ensembleOutcome.acceptedCandidates.length > 0) {
          const primary = ensembleOutcome.acceptedCandidates[0]!;
          const acceptedOptionText = mcOptionsForBrowserAuthority.find((o) => o.letter === finalChosenLetter)?.text ?? '';
          onProgress?.(`browser-authority-accepted:${finalChosenLetter}`);
          const acceptLatencyMs = Date.now() - startMs;
          // HONESTY (build item 4): CONCORDANT here ALWAYS means "backed by at least one real
          // sourced authority with a provenance URL, OR a specialist_swarm candidate that itself
          // only exists because its own 3 voters reached a genuine CONCORDANT consensus" -- see
          // runAuthorityEnsemble's own header doc; there is no code path to this branch with a
          // fabricated/guessed acceptedCandidate.
          const acceptConcordance: ConcordanceClass = 'CONCORDANT';
          // BP1xx: when the swarm fired (uncertain branch), report its REAL specialist/candidate
          // counts instead of the honest-zero the old always-short-circuit branch used -- the
          // swarm genuinely ran, so 0s here would be dishonest bookkeeping even though it never
          // reached this line's own separate accept path before.
          const swarmReceiptForAccept = ensembleOutcome.swarmReceipt;
          const acceptSpecialistsUsed = swarmReceiptForAccept?.specialistsUsed ?? [];
          const acceptCandidatesRaw = swarmReceiptForAccept?.candidatesRaw ?? 0;
          const acceptCandidatesPostMiner = swarmReceiptForAccept?.candidatesPostMiner ?? 0;
          const acceptCandidatesPostFurnace = swarmReceiptForAccept?.candidatesPostFurnace ?? 0;
          const acceptBmv = computeBmvScore(
            acceptCandidatesRaw, acceptCandidatesPostMiner, acceptCandidatesPostFurnace,
            acceptCandidatesPostFurnace, acceptConcordance, acceptSpecialistsUsed.length, acceptLatencyMs,
          );
          // KN-BP144-1 Phase 1: set HERE, at the accept assignment itself, not re-derived later
          // from corroboration/overrideFired by some downstream reader. Both
          // ensembleOutcome.corroboration values that mean "a calculator proved it" -- the actual
          // resolveDeterministicComputeOverride winner (pre-branch hoist OR the post-accept
          // override just computed above) AND runAuthorityEnsemble's own unconditional-on-
          // answerType calculator bypasses (pseudocode_trace/set_membership/
          // no_consensus_from_scatter, which report corroboration:'deterministic_compute' without
          // ever calling resolveDeterministicComputeOverride) -- are bucketed together here; see
          // this field's own doc comment on CanonicalPlowMcResult for why that is an honest
          // reading of the closed vocabulary, not a widening of it.
          const letterSourceForAccept: CanonicalPlowMcResult['letterSource'] =
            ensembleOutcome.corroboration === 'deterministic_compute_override'
            || ensembleOutcome.corroboration === 'deterministic_compute'
            || (overrideFired && !!deterministicOverride)
              ? 'deterministic_compute_override'
              : ensembleOutcome.corroboration === 'adjudicated'
                ? 'cake_adjudicated'
                : 'ensemble_accept';
          // When the deterministic compute overrode the ensemble's letter, the eblet writeback
          // must say so honestly -- "solved by user_perplexity" would be a lie once the calculator
          // has replaced that letter. writeComputeMethodEblet (the SAME writer the downstream
          // compute-sidecar block already uses) records the worked units-aware method separately;
          // this writeback's own authority/reasoning/sourceUrl reflect the deterministic source
          // whenever overrideFired, and the original authority/reasoning otherwise (unchanged).
          let overrideEbletWritten = false;
          if (overrideFired && deterministicOverride) {
            overrideEbletWritten = await writeComputeMethodEblet({ researchQuery, result: deterministicOverride });
            // BP141 (this Yoke): additionally shelve the reusable formula/tool for this method
            // (dedup'd, one per method) -- independent of, and never blocking, the write above.
            await mintFormulaEbletFromCompute(deterministicOverride);
          }
          try {
            await writeAndReplicateSolvedAnswer({
              researchQuery,
              domain,
              chosenLetter: finalChosenLetter,
              optionText: acceptedOptionText,
              reasoning: overrideFired && deterministicOverride
                ? ensembleOutcome.corroboration === 'deterministic_compute_override'
                  // BP1xx DETERMINISTIC-OVERRIDE-HOIST: there is no prior "ensemble pick" to
                  // describe as overridden here -- the calculator answered before any authority
                  // agreement was even evaluated (see runAuthorityEnsemble's pre-branch check) --
                  // so this honestly says so instead of the misleading "ensemble had originally
                  // picked X ... overridden" phrasing the post-branch case below uses (accurate
                  // only when a real, different ensemble pick actually existed first).
                  ? `deterministic-compute (pre-branch hoist, ${deterministicOverride.method}): ` +
                    `${deterministicOverride.sourceExpression} -> ${deterministicOverride.computedValue}` +
                    `${deterministicOverride.computedUnit ? ' ' + deterministicOverride.computedUnit : ''} ` +
                    `-> matched option ${deterministicOverride.letter}; no authority-agreement branching ` +
                    `ran -- the calculator answered directly.`
                  : `deterministic-compute-override (${deterministicOverride.method}): ` +
                    `${deterministicOverride.sourceExpression} -> ${deterministicOverride.computedValue}` +
                    `${deterministicOverride.computedUnit ? ' ' + deterministicOverride.computedUnit : ''} ` +
                    `-> matched option ${deterministicOverride.letter}; ensemble had originally picked ` +
                    `${ensembleOutcome.chosenLetter} via [${ensembleOutcome.acceptedCandidates.map((c) => c.authority).join(',')}] ` +
                    `-- overridden. Original reasoning: ` +
                    ensembleOutcome.acceptedCandidates.map((c) => `${c.authority}: ${c.reasoning}`).join(' | ')
                : ensembleOutcome.acceptedCandidates.map((c) => `${c.authority}: ${c.reasoning}`).join(' | '),
              sourceUrl: overrideFired ? undefined : primary.sourceUrl,
              // BP-COMPUTE-HONEST-DEMOTE: `overrideComputeLabel` is 'authority_extracted_compute'
              // (never 'deterministic_compute') whenever `deterministicOverride.source ===
              // 'reasoning_fact'` -- see that const's own doc comment just above. This keeps the
              // PROVENANCE string itself free of the literal substring 'deterministic_compute' in
              // that case, which matters: mnem_eblet_store.ts's computeHonestVerification() also
              // grants verified:true on `provenance.includes('deterministic_compute')` alone, so a
              // mislabeled authority string here would silently defeat the corroboration fix below.
              authority: overrideFired && deterministicOverride ? `${overrideComputeLabel}:${deterministicOverride.method}` : primary.authority,
              // BP131 honesty fix: a real calculator override earns deterministic_compute; an
              // ensemble 'agree' (2 independent authorities matched the same letter) earns
              // concordant; every other ensembleOutcome.corroboration value here ('single_google'/
              // 'single_perplexity'/'single_wolfram'/'single_specialist_swarm'/'adjudicated') is a
              // lone accept (adjudication is a single tie-breaking judge call, not 2+ agreement)
              // and must NOT earn verified:true.
              // BP-COMPUTE-HONEST-DEMOTE: overrideComputeLabel downgrades this to
              // 'authority_extracted_compute' when the override's source has no independent
              // grounding (see the const's own doc comment above) -- computeHonestVerification()
              // does not treat that label as a verified accept class.
              corroboration: overrideFired && deterministicOverride
                ? overrideComputeLabel
                : ensembleOutcome.corroboration === 'agree' ? 'concordant' : 'single_authority',
            });
          } catch (err) {
            console.warn('[plow_mc_answerer] ensemble-accepted writeback/replicate failed (non-fatal):', err);
          }
          return {
            questionId,
            domain,
            chosenLetter: finalChosenLetter,
            // Swarm's own voter letters are folded in (when it fired) alongside the accepted
            // browser/Wolfram/judge candidates -- one diagnostic entry per real vote actually
            // cast for this question, not a single synthetic entry per accepted authority.
            voterLetters: [finalChosenLetter, ...(swarmReceiptForAccept?.voterLetters ?? [])],
            voterDiagnostics: [
              ...ensembleOutcome.acceptedCandidates.map((c) => ({
                temperature: 0,
                status: 'parsed_ok' as const,
                responseChars: c.reasoning.length,
                rawPreview: `${c.authority} (${c.method}): ${c.reasoning.slice(0, 200)}`,
              })),
              ...(swarmReceiptForAccept?.voterDiagnostics ?? []),
              ...(overrideFired && deterministicOverride ? [{
                temperature: 0,
                status: 'parsed_ok' as const,
                responseChars: deterministicOverride.sourceExpression.length,
                rawPreview:
                  `deterministic-compute-override (${deterministicOverride.method}): ` +
                  `${deterministicOverride.sourceExpression} -> ${deterministicOverride.computedValue}` +
                  `${deterministicOverride.computedUnit ? ' ' + deterministicOverride.computedUnit : ''}`,
              }] : []),
            ],
            concordance: acceptConcordance,
            bmvScore: acceptBmv,
            gateOutcomes: evaluateGates(acceptCandidatesPostFurnace, acceptBmv, acceptConcordance, acceptLatencyMs),
            specialistsUsed: acceptSpecialistsUsed,
            candidatesRaw: acceptCandidatesRaw,
            candidatesPostMiner: acceptCandidatesPostMiner,
            candidatesPostFurnace: acceptCandidatesPostFurnace,
            andonTriggered: andonRetry > 0,
            andonRetries: andonRetry,
            ebletsWritten: 1 + (overrideEbletWritten ? 1 : 0),
            latencyMs: acceptLatencyMs,
            traceSummary:
              `authorityEnsembleAccepted=true corroboration=${ensembleOutcome.corroboration} ` +
              `matchedOption=${finalChosenLetter} swarmFired=${ensembleOutcome.swarmFired} ` +
              `sources=[${ensembleOutcome.acceptedCandidates.map((c) => c.authority).join(',')}] ` +
              `allCandidates=[${ensembleOutcome.candidates.map((c) => `${c.authority}:${c.letter}`).join(', ')}] ` +
              `adjudicationAttempted=${ensembleOutcome.adjudicationAttempted} andonRetries=${andonRetry}` +
              (overrideFired && deterministicOverride
                ? ` deterministicComputeOverride=true ensembleLetter=${ensembleOutcome.chosenLetter} ` +
                  `computeMethod=${deterministicOverride.method} computeSource=${deterministicOverride.source} ` +
                  // KN-BP143-1b: the field this whole ticket exists to make legible in a receipt
                  // without tracing code -- computeMethod/computeSource above name WHICH tier and
                  // HOW, this names whether that tier's operands were question-verbatim. Only ever
                  // reaches this string when overrideFired, i.e. already isLiteralExpressionProvenance
                  // per the P2 invariant just above -- always 'literal_expression' here today; kept
                  // dynamic (never hardcoded) so a future gap this audit missed still surfaces honestly.
                  `computeProvenance=${deterministicOverride.computeProvenance} ` +
                  `computeLabel=${overrideComputeLabel}`
                : ''),
            // BP-COMPUTE-HONEST-DEMOTE: `verified: !overrideIsAuthorityExtracted` -- a
            // reasoning_fact-sourced override ran a real, checked computation (not a guess), but
            // it has no independent grounding of its own (see overrideComputeLabel's own doc
            // comment above), so this receipt must not claim `verified: true` for it either.
            provenanceReceipts: overrideFired && deterministicOverride
              ? [{
                  source: `${overrideComputeLabel}:${deterministicOverride.method}`,
                  contentHash: createHash('sha256')
                    .update(`${deterministicOverride.sourceExpression}=${deterministicOverride.computedValue}${deterministicOverride.computedUnit ?? ''}`)
                    .digest('hex')
                    .slice(0, 16),
                  verified: !overrideIsAuthorityExtracted,
                }]
              : ensembleOutcome.acceptedCandidates.map((c) => ({
                  source: c.authority,
                  contentHash: createHash('sha256').update(c.reasoning).digest('hex').slice(0, 16),
                  verified: true,
                  provenanceUrl: c.sourceUrl,
                })),
            answerType: earlyAnswerTypeForBrowserAuthority,
            browserAuthorityCorroboration,
            authorityEnsembleSwarmFired: ensembleOutcome.swarmFired,
            structuredCorroborator: ensembleOutcome.structuredCorroborator,
            independentCorroboration: ensembleOutcome.independentCorroboration,
            singleSourceUngroundedAccept: ensembleOutcome.singleSourceUngroundedAccept,
            // BP141-2 THE CAKE METHOD: mirrors ensembleOutcome's own fields of the same name --
            // present only when the disagreement branch actually ran the Cake mechanism.
            cakeMethodUsed: ensembleOutcome.cakeMethodUsed,
            cutModels: ensembleOutcome.cutModels,
            cutDerivations: ensembleOutcome.cutDerivations,
            distinctDerivationCount: ensembleOutcome.distinctDerivationCount,
            cutScatter: ensembleOutcome.cutScatter,
            pickConvergence: ensembleOutcome.pickConvergence,
            cakeQuadrant: ensembleOutcome.cakeQuadrant,
            anonymizedOrderSeed: ensembleOutcome.anonymizedOrderSeed,
            cakeSelfPreferenceAudit: ensembleOutcome.cakeSelfPreferenceAudit,
            cakeSelfPreferenceRate: ensembleOutcome.cakeSelfPreferenceRate,
            cakeCuts: ensembleOutcome.cakeCuts,
            cakePicks: ensembleOutcome.cakePicks,
            minorityCutsOverridden: ensembleOutcome.minorityCutsOverridden,
            cakePickerCutterInvariant: ensembleOutcome.cakePickerCutterInvariant,
            cascadeCandidateProducer: ensembleOutcome.cascadeCandidateProducer,
            gomJabbarG5Advisory: ensembleOutcome.gomJabbarG5Advisory,
            // BP140 Yoke: the full candidate set (winner AND losers), for the Coroner's
            // per-candidate factVerdict persist -- see CanonicalPlowMcResult.ensembleCandidates.
            ensembleCandidates: ensembleOutcome.candidates,
            letterSource: letterSourceForAccept,
            ensembleOutcomeCorroboration: ensembleOutcome.corroboration,
            // KN-BP144-7 T1-T4: same outer-scope capture as ensembleCandidatesForTrace's own
            // sibling sites below -- guaranteed set by this point (this whole block is reached
            // only after the `if (authorityEnsembleOn)` branch above already ran the ensemble).
            authorityOutcomes: authorityOutcomesForTrace,
            ...(deterministicOverride ? {
              authorityEnsembleDeterministicOverride: {
                ensembleLetter: ensembleOutcome.chosenLetter!,
                method: deterministicOverride.method,
                expression: deterministicOverride.sourceExpression,
                computedValue: deterministicOverride.computedValue,
                computedUnit: deterministicOverride.computedUnit,
              },
            } : {}),
          };
        }
        // ensembleOutcome.chosenLetter is null -- 'none' (nobody, including the swarm, answered)
        // or 'disagree' (the adjudication judge also failed to resolve a letter). Honest
        // fall-through: falls to the decompose fallback (if deferred, see the call site right
        // after this block). The specialist-swarm loop further below is SKIPPED when
        // ensembleSwarmAlreadyFired is true (see that guard) so a question the ensemble already
        // gave the swarm a shot at never fires it a second, redundant time.
      } else {
        // ── LEGACY (pre-ensemble) Stage F2 logic, byte-for-byte unchanged ──────────────────
        // Sequential, not Promise.all: runBrowserAuthorityQueryFromMain() (index.ts) guards a
        // single shared <webview> with browserAuthorityMainCallInFlight -- a concurrent second
        // call would resolve null immediately rather than genuinely querying Perplexity, per
        // that function's own documented "already in flight" honest-null path. This also happens
        // to match the F2 spec's own "sequential-first is the safer/clearer read" note.
        if (isLookupType) {
          try {
            browserGoogleResult = await runBrowserAuthorityLookup(
              researchQuery, { ...config, preferredAuthority: 'user_google' }, browserBridge,
            );
          } catch (err) {
            console.warn('[plow_mc_answerer] Stage F2 google lookup threw (non-fatal, honest null):', err);
            browserGoogleResult = null;
          }
        }
        try {
          browserPerplexityResult = await runBrowserAuthorityLookup(
            researchQuery, { ...config, preferredAuthority: 'user_perplexity', mcOptions: mcOptionTextsForQuery }, browserBridge,
          );
        } catch (err) {
          console.warn('[plow_mc_answerer] Stage F2 perplexity lookup threw (non-fatal, honest null):', err);
          browserPerplexityResult = null;
        }
        console.log(
          `[plow_mc_answerer] Stage F2 seq=2 browser-authority-first RESOLVED at t=${Date.now() - startMs}ms ` +
          `(google=${browserGoogleResult ? 'fact' : 'null'} perplexity=${browserPerplexityResult ? 'fact' : 'null'}) ` +
          `-- swarm has NOT fired yet.`,
        );

        // WIRE-THE-LOOP fix part 1: explicit-letter-first, token/numeric-match fallback -- see
        // resolveAuthorityLetterMatch()'s own doc comment for why this replaces the bare
        // matchFreeTextAnswerToOption() call that was silently discarding real sourced answers.
        const googleResolved = browserGoogleResult
          ? resolveAuthorityLetterMatch(browserGoogleResult.fact, mcOptionsForBrowserAuthority)
          : null;
        const perplexityResolved = browserPerplexityResult
          ? resolveAuthorityLetterMatch(browserPerplexityResult.fact, mcOptionsForBrowserAuthority)
          : null;
        browserGoogleMatch = googleResolved ? { letter: googleResolved.letter, score: googleResolved.score } : null;
        browserPerplexityMatch = perplexityResolved ? { letter: perplexityResolved.letter, score: perplexityResolved.score } : null;

        // Build item 3 -- corroboration bookkeeping ONLY (never a fabricated blended answer): both
        // matched facts (when present) are injected as SEPARATE candidates below, and the
        // pre-existing 3-voter concordance/DISCORDANT machinery is what actually decides the
        // outcome when they disagree -- this marker is purely informational/trace.
        if (browserGoogleMatch && browserPerplexityMatch) {
          browserAuthorityCorroboration = browserGoogleMatch.letter === browserPerplexityMatch.letter ? 'agree' : 'disagree';
        } else if (browserGoogleMatch) {
          browserAuthorityCorroboration = 'single_google';
        } else if (browserPerplexityMatch) {
          browserAuthorityCorroboration = 'single_perplexity';
        } else {
          browserAuthorityCorroboration = 'none';
        }
        console.log(
          `[plow_mc_answerer] Stage F2 browser-authority-first corroboration=${browserAuthorityCorroboration} ` +
          `googleMatch=${browserGoogleMatch?.letter ?? 'null'}(${googleResolved?.method ?? '-'}) ` +
          `perplexityMatch=${browserPerplexityMatch?.letter ?? 'null'}(${perplexityResolved?.method ?? '-'}).`,
        );

        // ── WIRE-THE-LOOP fix part 1: NEVER abstain when the authority actually answered ──────
        // This is the Founder-mandated short-circuit: a real resultFound=yes answer with a
        // resolvable letter is ACCEPTED immediately -- it does not need to survive the swarm's
        // 3-voter arbitration to count (the old behavior: inject as a candidate, hope the voters
        // pick up on it, silently abstain when the relevance gate or DISCORDANT voters threw it
        // away downstream). Prefer Perplexity's resolution when both fired and disagree -- it was
        // asked to reason over the actual options; a corroborating Google agreement is logged via
        // browserAuthorityCorroboration either way, never silently dropped.
        const acceptedResolution = perplexityResolved ?? googleResolved;
        const acceptedResult = perplexityResolved ? browserPerplexityResult : browserGoogleResult;
        const acceptedAuthorityName = perplexityResolved ? 'user_perplexity' : 'user_google';
        if (acceptedResolution && acceptedResult) {
          const acceptedOptionText = mcOptionsForBrowserAuthority.find((o) => o.letter === acceptedResolution.letter)?.text ?? '';
          onProgress?.(`browser-authority-accepted:${acceptedResolution.letter}`);
          const acceptLatencyMs = Date.now() - startMs;
          const acceptConcordance: ConcordanceClass = 'CONCORDANT';
          const acceptBmv = computeBmvScore(0, 0, 0, 0, acceptConcordance, 0, acceptLatencyMs);
          try {
            await writeAndReplicateSolvedAnswer({
              researchQuery,
              domain,
              chosenLetter: acceptedResolution.letter,
              optionText: acceptedOptionText,
              reasoning: acceptedResult.fact,
              sourceUrl: acceptedResult.sourceUrl,
              authority: acceptedAuthorityName,
              // BP131 honesty fix: browserAuthorityCorroboration is already computed above --
              // 'agree' means BOTH Google and Perplexity independently matched the same letter
              // (genuine 2-source concordance); 'single_google'/'single_perplexity'/'disagree'/
              // 'none' all mean only one authority's match is actually being accepted here
              // (Perplexity's resolution wins on disagreement, per the comment above) -- a lone
              // accept, not concordance. This exact branch (a lone single_perplexity accept
              // written as verified:true) is the empirically-observed bug this Yoke fixes.
              corroboration: browserAuthorityCorroboration === 'agree' ? 'concordant' : 'single_authority',
            });
          } catch (err) {
            console.warn('[plow_mc_answerer] browser-authority-accepted writeback/replicate failed (non-fatal):', err);
          }
          return {
            questionId,
            domain,
            chosenLetter: acceptedResolution.letter,
            voterLetters: [acceptedResolution.letter],
            voterDiagnostics: [{
              temperature: 0,
              status: 'parsed_ok',
              responseChars: acceptedResult.fact.length,
              rawPreview: `${acceptedAuthorityName} (${acceptedResolution.method}): ${acceptedResult.fact.slice(0, 200)}`,
            }],
            concordance: acceptConcordance,
            bmvScore: acceptBmv,
            gateOutcomes: evaluateGates(0, acceptBmv, acceptConcordance, acceptLatencyMs),
            specialistsUsed: [],
            candidatesRaw: 0,
            candidatesPostMiner: 0,
            candidatesPostFurnace: 0,
            andonTriggered: andonRetry > 0,
            andonRetries: andonRetry,
            ebletsWritten: 1,
            latencyMs: acceptLatencyMs,
            traceSummary:
              `browserAuthorityAccepted=true authority=${acceptedAuthorityName} method=${acceptedResolution.method} ` +
              `matchedOption=${acceptedResolution.letter} matchScore=${acceptedResolution.score.toFixed(2)} ` +
              `corroboration=${browserAuthorityCorroboration} andonRetries=${andonRetry}`,
            provenanceReceipts: [{
              source: acceptedAuthorityName,
              contentHash: createHash('sha256').update(acceptedResult.fact).digest('hex').slice(0, 16),
              verified: acceptedResult.verified,
              ...(acceptedResult.sourceUrl ? { provenanceUrl: acceptedResult.sourceUrl } : {}),
            }],
            answerType: earlyAnswerTypeForBrowserAuthority,
            browserAuthorityCorroboration,
            // KN-BP144-1 Phase 1: letterSource deliberately left UNSET -- this is the LEGACY
            // (authorityEnsembleOn===false) browser-authority accept path, a genuinely different
            // mechanism from runAuthorityEnsemble despite the structural similarity; labeling it
            // 'ensemble_accept' would misrepresent that the ensemble never ran. Not reachable in
            // this ticket's diagnosis (which is specifically about the authorityEnsembleOn===true
            // branch) and not exercised by this ticket's 12 gate questions.
          };
        }
      }
    }
  }

  // BP139 Authority Ensemble fallback: decompose-and-eliminate, attempted HERE (after Stage F2)
  // ONLY when it was deferred above (computable/reasoning + ensemble on) AND the ensemble just
  // fell through without returning (no sourced letter) -- "keep decompose ONLY as a last-resort
  // fallback when the ensemble produced no sourced letter" per the Founder's mandate. Every
  // other case already resolved decompose at its original pre-Psionic/pre-F2 position above (or
  // never runs decompose at all, when researchArmDecompose is off).
  // KN-BP142-2 Defect A: same fix as the pre-ensemble call site above -- STASH, never return.
  // This is the deferred position (computable/reasoning + ensemble on, ensemble itself already
  // ran to completion above and produced no sourced letter) -- decompose here still must not
  // preempt the swarm+voters stage that runs after this point. Overwrites decomposeAdvisoryResult
  // only if it was still null (the pre-ensemble call site above is mutually exclusive with this
  // one via the same deferDecomposeToEnsembleFallback gate, so in practice at most one of the two
  // ever fires for a given question -- this `??=`-equivalent guard is defensive, not load-bearing).
  if (deferDecomposeToEnsembleFallback && decomposeOn) {
    const decomposeFallbackResult = await attemptDecomposeAndEliminate();
    if (decomposeFallbackResult && !decomposeAdvisoryResult) {
      decomposeAdvisoryResult = decomposeFallbackResult;
      console.log(
        `[plow_mc_answerer] KN-BP142-2 Defect A: decompose-and-eliminate produced an ADVISORY ` +
        `candidate (letter=${decomposeFallbackResult.chosenLetter}) at the post-ensemble fallback ` +
        `call site -- STASHED, not returned. Swarm+voters below still run exactly as if decompose ` +
        `had abstained; this candidate can only become the final answer if swarm+voters also abstain.`,
      );
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
  // BP1xx Authority-Ensemble-swarm-fold-in: when the ensemble above already fired this EXACT
  // swarm (Miner->Furnace->3-voters via runSpecialistSwarmConsensus) as a corroborating candidate
  // and still fell through without an accepted letter, firing it AGAIN here would double the
  // 13-adapter network cost for a question already conclusively uncertain -- defeats the
  // Founder's "stays cheap" requirement. Skip the (expensive) specialist fetch loop in that case;
  // allCandidates/specialistsUsed stay [], and every existing downstream stage (Miner/Furnace on
  // an empty set, compute sidecar with empty componentFacts, the pre-existing compute-fallthrough
  // -no-facts / relevance-gate abstains, or -- worst case -- the voters arbitrating a bare-question
  // prompt) already handles a "swarm found nothing" empty allCandidates honestly; none of that
  // logic needed duplicating.
  if (ensembleSwarmAlreadyFired) {
    console.log(
      `[plow_mc_answerer] specialist swarm SKIPPED here -- already fired inside the authority ` +
      `ensemble for this question (swarmConcordance=${ensembleSwarmReceipt?.concordance ?? 'unknown'} ` +
      `specialists=[${(ensembleSwarmReceipt?.specialistsUsed ?? []).join(',')}]); not re-firing ` +
      `(cheap-by-design).`,
    );
  } else {
    for (let i = 0; i < effectiveOperators.length; i++) {
      const specialistName = effectiveOperators[i];
      if (!specialistName) continue;
      if (i > 0) await new Promise<void>((resolve) => setTimeout(resolve, FIREGUARD_STAGGER_MS));
      onProgress?.(`specialist-fire:${specialistName}`);
      try {
        const fnCandidates = SPECIALIST_REGISTRY[specialistName];
        const candidates = await fnCandidates(researchQuery, domain, effectiveSpecialistKeys);
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

  // ── BP137 Yoke v2b Stage F2 build item 2: browser-authority fact(s) as the TOP-priority
  //    component(s), encyclopedia-swarm facts demoted (never dropped) to the remaining slot(s)
  //    ─────────────────────────────────────────────────────────────────────────────────────────
  // Deliberately placed AFTER the relevance gate above (never fed through isQaRelevant/semantic
  // similarity itself) -- a genuinely scraped Google/Perplexity answer to THIS EXACT question is
  // definitionally on-topic; running it back through a relevance filter tuned for encyclopedia
  // extracts would only risk a false negative on the one fact this Stage exists to surface.
  // Prepending (spread at the front) is what makes it TOP: componentFactsList and
  // provenanceReceipts below both `.slice(0, 3)` from the FRONT of factsForArbitration, so a
  // browser fact injected here is always the first thing the voters see and the first receipt
  // in the list -- literally "TOP provenance component" (build item 2). Encyclopedia facts
  // already sitting in factsForArbitration are pushed to the remaining slot(s), not spliced out
  // -- "demoted to supporting/fallback evidence... never dropped entirely" (build item 2/4).
  // browserFactCandidateSet (referenced later, at the provenanceReceipts map) lets that later
  // code mark ONLY these candidates verified:true + a real provenanceUrl, without touching the
  // pre-existing arbitrationFactsVerified logic for encyclopedia candidates.
  //
  // When browserAuthorityOn is false/absent, or the question isn't lookup_fact, or both
  // authorities returned null/unmatched (the honest not-signed-in/no-answer case, build item
  // 4), browserGoogleMatch/browserPerplexityMatch are both null, browserFactCandidates stays
  // [], and factsForArbitration is left as the EXACT SAME reference the relevance gate above
  // produced -- byte-identical to pre-F2 behavior for every one of those cases.
  const browserFactCandidates: CandidateEblet[] = [];
  if (browserGoogleMatch && browserGoogleResult) {
    browserFactCandidates.push({
      source: 'user_google',
      content: browserGoogleResult.fact,
      weight: 1,
      sid: createHash('sha256').update(`user_google:${browserGoogleResult.fact}`).digest('hex').slice(0, 16),
      provenance_url: browserGoogleResult.sourceUrl,
    });
  }
  if (browserPerplexityMatch && browserPerplexityResult) {
    browserFactCandidates.push({
      source: 'user_perplexity',
      content: browserPerplexityResult.fact,
      weight: 1,
      sid: createHash('sha256').update(`user_perplexity:${browserPerplexityResult.fact}`).digest('hex').slice(0, 16),
      provenance_url: browserPerplexityResult.sourceUrl,
    });
  }
  const browserFactCandidateSet = new Set<CandidateEblet>(browserFactCandidates);
  if (browserFactCandidates.length > 0) {
    factsForArbitration = [...browserFactCandidates, ...factsForArbitration];
    console.log(
      `[plow_mc_answerer] Stage F2 seq=3 browser fact(s) injected as TOP provenance ` +
      `(count=${browserFactCandidates.length}, corroboration=${browserAuthorityCorroboration}) ` +
      `at t=${Date.now() - startMs}ms -- swarm already ran above; encyclopedia facts demoted, not dropped.`,
    );
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
      // BP-COMPUTE-UNITS: units-aware attempt FIRST, before the existing unit-UNAWARE
      // computeAnswer()+matchValueToOption tiers below. Synchronous, no I/O, no model call --
      // strictly more informed than a bare-number match because it can resolve a question whose
      // computed quantity and its MC options are stated in DIFFERENT but convertible units (the
      // Founder's "times tables" density example: compute lands on 600 kg/m^3, the options are
      // stated in g/cc -- matchValueToOption(600, options) finds nothing near 600 and honestly
      // abstains; computeUnitAwareMatch converts 600 kg/m^3 -> 0.60 g/cc via mathjs and matches
      // option C). Reuses mcOptionsForUnits/componentFactsList already built above. Falls through
      // to the unchanged computeAnswer()+matchValueToOption path on any null (no unit-bearing
      // quantity found, or found but ambiguous/dimensionally-incompatible against every option --
      // see compute_sidecar.ts's matchQuantityToOption doc comment for the exact-one-option
      // honesty gate) -- never guesses, identical discipline to every other tier here.
      const mcOptionsForUnits = parseOptionsFromPrompt(mcPromptWithSubstrate);
      const unitAware = computeUnitAwareMatch(researchQuery, mcOptionsForUnits, {
        componentFacts: componentFactsList,
      });
      if (unitAware) {
        onProgress?.(`compute-sidecar:${unitAware.method}`);
        // KN-BP143-1b: this legacy (non-ensemble, Stage A.3) compute-sidecar path constructs its
        // own DeterministicComputeCandidate-shaped record purely to satisfy writeComputeMethodEblet/
        // mintFormulaEbletFromCompute's now-required computeProvenance field, reusing the SAME
        // classifyUnitAwareComputeProvenance classifier tier (i)/(viii) already use -- one
        // classification rule for computeUnitAwareMatch's source, never a second, divergent one.
        const unitComputeResult: DeterministicComputeCandidate = {
          ...unitAware,
          ...classifyUnitAwareComputeProvenance(unitAware.source),
        };
        const unitEbletWritten = await writeComputeMethodEblet({ researchQuery, result: unitComputeResult });
        // BP141 (this Yoke): additionally shelve the reusable formula/tool for this method
        // (dedup'd, one per method) -- independent of, and never blocking, the write above.
        await mintFormulaEbletFromCompute(unitComputeResult);
        const unitLatencyMs = Date.now() - startMs;
        const unitConcordance: ConcordanceClass = 'CONCORDANT';
        const unitBmv = computeBmvScore(1, 1, 1, 0, unitConcordance, 1, unitLatencyMs);
        // BP-COMPUTE-HONEST-DEMOTE: this legacy (non-ensemble, Stage A.3) compute-sidecar path
        // still returns `unitAware.letter` directly on any match, regardless of source -- that
        // early-return behavior is UNCHANGED this pass (out of scope, flagged for Bishop below).
        // KN-BP143-1b CONSUMER AUDIT FINDING (gate 5): this is a THIRD site (beyond the two
        // resolveDeterministicComputeOverride demote sites this ticket fixes) where a
        // model_derived result can still unconditionally decide the final answer -- structurally
        // the SAME gap the addendum's rule 2 exists to close, already named out-of-scope by a
        // prior ticket rather than newly discovered here. Reported per this ticket's own "report
        // even if you do not change it" mandate; NOT fixed this pass, to keep this ticket's own
        // blast radius to the ensemble-path demotion sites the five verification gates actually
        // exercise. The one thing fixed here (still true, still BP-COMPUTE-HONEST-DEMOTE's
        // original scope) is the receipt's own `verified` claim: a model_derived match has no
        // independent grounding and must not claim `verified: true`. Re-expressed off
        // computeProvenance (isLiteralExpressionProvenance) rather than the bare
        // `source === 'reasoning_fact'` string -- byte-identical outcome for this tier today (the
        // only two sources computeUnitAwareMatch ever returns are question_expression/
        // reasoning_fact, mapped 1:1 by classifyUnitAwareComputeProvenance above), but no longer a
        // second, independently-drifting copy of that same classification rule.
        const unitIsLiteral = isLiteralExpressionProvenance(unitComputeResult);
        const unitReceipt: ProvenanceReceipt = {
          source: `${unitIsLiteral ? 'deterministic_compute' : 'authority_extracted_compute'}:${unitAware.method}`,
          contentHash: createHash('sha256')
            .update(`${unitAware.sourceExpression}=${unitAware.computedValue}${unitAware.computedUnit ?? ''}`)
            .digest('hex')
            .slice(0, 16),
          verified: unitIsLiteral,
        };
        const unitTraceSummary =
          `researchArmComputeSidecar=true answerType=computable method=${unitAware.method} ` +
          `unitAware=true computedValue=${unitAware.computedValue}${unitAware.computedUnit ? ' ' + unitAware.computedUnit : ''} ` +
          `matchedOption=${unitAware.letter}(${unitAware.optionValue}${unitAware.optionUnit ? ' ' + unitAware.optionUnit : ''}) ` +
          `source=${unitAware.source} componentFactsUsed=${componentFactsList.length} bmv=${unitBmv} andonRetries=${andonRetry}` +
          `${relevanceGateMethodTrace}`;
        return {
          questionId,
          domain,
          chosenLetter: unitAware.letter,
          voterLetters: [unitAware.letter, unitAware.letter, unitAware.letter],
          voterDiagnostics: [{
            temperature: 0,
            status: 'parsed_ok',
            responseChars: unitAware.sourceExpression.length,
            rawPreview:
              `units-aware compute (${unitAware.method}): ${unitAware.sourceExpression} -> ` +
              `${unitAware.computedValue}${unitAware.computedUnit ? ' ' + unitAware.computedUnit : ''}`,
          }],
          concordance: unitConcordance,
          bmvScore: unitBmv,
          gateOutcomes: evaluateGates(postFurnace.length, unitBmv, unitConcordance, unitLatencyMs),
          specialistsUsed,
          candidatesRaw,
          candidatesPostMiner: postMiner.length,
          candidatesPostFurnace: postFurnace.length,
          andonTriggered: andonRetry > 0,
          andonRetries: andonRetry,
          ebletsWritten: unitEbletWritten ? 1 : 0,
          latencyMs: unitLatencyMs,
          traceSummary: unitTraceSummary,
          provenanceReceipts: [unitReceipt],
          answerType,
          computeSidecar: {
            method: unitAware.method,
            expression: unitAware.sourceExpression,
            value: unitAware.computedValue,
            matchedOptionValue: unitAware.optionValue,
          },
          // KN-BP144-1 Phase 1: legacy (pre-ensemble) Stage A.3 tier -- computeUnitAwareMatch
          // called directly here, never through resolveDeterministicComputeOverride. Bucketed as
          // 'deterministic_compute_override' anyway (a calculator, not a vote, decided this) --
          // see CanonicalPlowMcResult.letterSource's own doc comment for that interpretive call.
          // Not exercised by any of KN-BP144-1's 12 gate questions (confirmed against the named
          // 038 receipt); see KN-BP144-1_REPORT.md.
          letterSource: 'deterministic_compute_override',
          ...(ensembleOutcomeCorroborationForTrace ? { ensembleOutcomeCorroboration: ensembleOutcomeCorroborationForTrace } : {}),
        };
      }
      // Units-aware attempt found nothing unambiguous -- fall through to the pre-existing
      // unit-UNAWARE compute tiers below, byte-for-byte unchanged.
      //
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
            // KN-BP144-1 Phase 1: same legacy-tier rationale as the computeUnitAwareMatch site
            // just above -- see that site's own comment.
            letterSource: 'deterministic_compute_override',
            ...(ensembleOutcomeCorroborationForTrace ? { ensembleOutcomeCorroboration: ensembleOutcomeCorroborationForTrace } : {}),
          };
        }
      }
      // Cannot compute, or computed value matched no option within tolerance -- fall through
      // to the unchanged swarm+voter path below (relevance-gate abstain check, then voters).
      // Never guess.

      // BP-SCHEDULE-SOLVER: a THIRD, independent deterministic compute tier, tried ONLY after
      // both computeUnitAwareMatch() above and computeAnswer()+matchValueToOption just above
      // have already returned null/no-match. Solves loan/repayment "word problems" that are
      // structurally out of reach for a single-expression compute engine -- a fixed periodic
      // payment against a balance that accrues interest each period and terminates in a
      // smaller final payment (the Founder's canonical Mr. Scaccio case: computes $103.11,
      // matches an MC option stated as "$103.00" via the wide-enough max($0.50, 1%) tolerance --
      // see plow_mc_schedule_solver.ts's header for the full worked example). Synchronous, no
      // I/O, no model call -- reuses mcOptionsForUnits already parsed above. Never guesses: see
      // that file's parseLoanStructure/matchToSingleOption docs for the exact-one-option honesty
      // gate this tier uses, identical in spirit to every other compute tier in this file.
      const scheduleResult = solveScheduleProblem(researchQuery, mcOptionsForUnits);
      if (scheduleResult) {
        onProgress?.(`compute-sidecar:schedule_amortization`);
        const scheduleLatencyMs = Date.now() - startMs;
        const scheduleConcordance: ConcordanceClass = 'CONCORDANT';
        const scheduleBmv = computeBmvScore(1, 1, 1, 0, scheduleConcordance, 1, scheduleLatencyMs);
        const scheduleReceipt: ProvenanceReceipt = {
          source: `computed:schedule_amortization`,
          contentHash: createHash('sha256')
            .update(`${scheduleResult.provenance}=${scheduleResult.value}`)
            .digest('hex')
            .slice(0, 16),
          verified: true,
        };
        const scheduleTraceSummary =
          `researchArmComputeSidecar=true answerType=computable method=schedule_amortization ` +
          `value=${scheduleResult.value} matchedOption=${scheduleResult.letter} ` +
          `componentFactsUsed=${componentFactsList.length} bmv=${scheduleBmv} andonRetries=${andonRetry}` +
          `${relevanceGateMethodTrace} trace=${scheduleResult.trace}`;
        return {
          questionId,
          domain,
          chosenLetter: scheduleResult.letter,
          voterLetters: [scheduleResult.letter, scheduleResult.letter, scheduleResult.letter],
          voterDiagnostics: [{
            temperature: 0,
            status: 'parsed_ok',
            responseChars: scheduleResult.trace.length,
            rawPreview: `schedule-solver compute (schedule_amortization): ${scheduleResult.trace.slice(0, 300)}`,
          }],
          concordance: scheduleConcordance,
          bmvScore: scheduleBmv,
          gateOutcomes: evaluateGates(postFurnace.length, scheduleBmv, scheduleConcordance, scheduleLatencyMs),
          specialistsUsed,
          candidatesRaw,
          candidatesPostMiner: postMiner.length,
          candidatesPostFurnace: postFurnace.length,
          andonTriggered: andonRetry > 0,
          andonRetries: andonRetry,
          ebletsWritten: 0,
          latencyMs: scheduleLatencyMs,
          traceSummary: scheduleTraceSummary,
          provenanceReceipts: [scheduleReceipt],
          answerType,
          computeSidecar: {
            method: 'schedule_amortization',
            expression: scheduleResult.provenance,
            value: scheduleResult.value,
            matchedOptionValue: scheduleResult.optionValue,
          },
          // KN-BP144-1 Phase 1: same legacy-tier rationale as the computeUnitAwareMatch site
          // above -- see that site's own comment.
          letterSource: 'deterministic_compute_override',
          ...(ensembleOutcomeCorroborationForTrace ? { ensembleOutcomeCorroboration: ensembleOutcomeCorroborationForTrace } : {}),
        };
      }
      // Schedule solver found no confident loan structure, or a structure that didn't converge,
      // or converged but matched zero/2+ options -- fall through UNCHANGED to the pre-existing
      // swarm+voter path below, exactly like every other compute tier's null case. Never guess.
    }

    // BP137 Yoke v2b Stage F2: the lookup_fact -> browser-authority routing that used to live
    // here (Integration-1/Stage C) now happens BEFORE the swarm loop far above (see "Stage F2:
    // browser-authority-FIRST routing"), queries BOTH user_google AND user_perplexity, and
    // injects the result(s) into factsForArbitration (see "Stage F2 build item 2" above, right
    // after the relevance gate) instead of short-circuiting this function with its own early
    // return -- see those two blocks' comments for the full rationale (feed into the existing
    // MC voter pipeline as the primary fact, rather than bypass it). `answerType` here still
    // legitimately reaches 'lookup_fact' for a fact-shaped question with browserAuthorityOn
    // false (browser routing never ran, browserFactCandidates stayed empty above) -- that case
    // still falls through to the unchanged swarm+voter path below exactly as it always has.
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
      letterSource: 'abstain',
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
      letterSource: 'abstain',
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
    // BP137 Yoke v2b Stage F2 build item 5: a browser-sourced candidate (source exactly
    // 'user_google'/'user_perplexity', tracked by OBJECT REFERENCE in browserFactCandidateSet,
    // never by re-matching the source string) is always verified:true -- it is a real,
    // genuinely scraped extraction (see distillExtraction()'s own verified bit upstream),
    // independent of whether THIS question's encyclopedia swarm happened to survive Saladin.
    // Every other candidate keeps the pre-existing arbitrationFactsVerified (postFurnace-
    // survival) rule, byte-unchanged from pre-F2 behavior -- browserFactCandidateSet is always
    // empty when browserAuthorityOn is false/absent or no browser fact matched, so `.has(c)` is
    // always false and this ternary always takes the pre-existing branch for that case.
    verified: browserFactCandidateSet.has(c) ? true : arbitrationFactsVerified,
    ...(c.provenance_url ? { provenanceUrl: c.provenance_url } : {}),
  }));
  const arbitrationPrompt = buildMcArbitrationPrompt(factsContext, mcPromptWithSubstrate);
  const debugPromptLoggingEnabled = process.env.MNEMO_DEBUG_LOG_PROMPTS === '1';

  // ── KN-BP144-1 Phase 2 (Amendment 1, scoped to qids 66/72/85/105) -- candidate-SOURCE cascade
  //    adjudicator, placed HERE per ticket 2.1: after the authority ensemble has already fully
  //    resolved (fast path, single-accept, swarm-augmented agreement, THE CAKE METHOD -- all
  //    upstream of this line, all untouched) and honestly fallen through with
  //    corroboration:'disagree', and BEFORE the local self-vote loop just below is allowed to
  //    decide anything. Guard is exactly the ticket's own placement condition: ensemble
  //    corroboration is literally 'disagree' AND ensembleCandidatesForTrace is non-empty --
  //    false for every other case (ensemble off, ensemble never reached 'disagree', or 'disagree'
  //    with zero real candidates, which cannot actually occur per runAuthorityEnsemble's own
  //    return shapes but is checked defensively rather than assumed). qid 111
  //    (corroboration:'single_specialist_swarm') and all six negative-control proofs
  //    (corroboration: deterministic_compute_override/deterministic_compute, all ACCEPT-branch
  //    returns far above this line) NEVER reach this guard true -- they return before this
  //    function body is even entered, so they are unaffected by construction, not merely by
  //    intent. ─────────────────────────────────────────────────────────────────────────────────
  const cascadeAdjudicatorEngaged =
    ensembleOutcomeCorroborationForTrace === 'disagree'
    && !!ensembleCandidatesForTrace
    && ensembleCandidatesForTrace.length > 0;
  if (cascadeAdjudicatorEngaged) {
    // ── KN-BP144-4 A1 ("give the eliminator its own reachable entry point"): the
    //    register-resolution stage (plow_mc_elimination_cascade.ts's runRegisterResolutionStage,
    //    added KN-BP144-2 Phase 2, never edited here per A5) is called HERE, gated ONLY on
    //    cascadeAdjudicatorEngaged above -- the SAME 'disagree'-fall-through-with-real-candidates
    //    guard the adjudicator itself keys on, and deliberately NOT on `answerType`. The
    //    `answerType === 'computable'` gates at resolveDeterministicComputeOverride's two call
    //    sites are left untouched (they guard deterministic compute override, a wholly different
    //    concern) -- eliminating OPTIONS has nothing to do with whether a question is computable,
    //    and every failure this ticket exists to fix classifies as 'reasoning', which those gates
    //    never reach.
    //
    //    PASS 1 (verification: null, pure/sync/no I/O): learns whether this question even has a
    //    curated concept + inferable register at all. An eliminator that never applies, or
    //    applies and abstains on pass 1, needs no live lookup -- "no constraint at all" (A3's
    //    fourth bullet) is already the honest answer, and skipping the dispatch entirely is
    //    strictly cheaper. Only a real registerCandidate on pass 1 makes a live verification
    //    lookup worth attempting at all.
    //
    //    PHASE B FIX (KN-BP144-4 Phase B verification finding): Phase A fed this stage the FULL
    //    option-letter set as `survivors`, not Stage 1's (runEliminationChart, R1/R2/R3) own
    //    narrowed output -- contradicting the prior-art chaining convention this same repo's own
    //    scratchpad/kn_bp144_2_gate_qid85.mjs and gate_fn_sweep.mjs already established
    //    (runEliminationChart(...).survivors feeding into runRegisterResolutionStage(...) as ITS
    //    OWN survivors input). Verified against the real compiled dist this Phase B
    //    (scratchpad/kn_bp144_4_phaseB_gate_stage1_chaining.mjs, all 20 real run-038 questions):
    //    feeding the full 10-option set let qid 85's real corpus text produce {A,D,E} -- option D
    //    ("results in a sample that perfectly represents the population") sneaks back in as a
    //    coincidental predicate-referent match that Stage 1 had ALREADY screened out -- whereas
    //    chaining Stage 1's own survivors ({A,E,J} for qid 85) into this call produces exactly
    //    {A,E}, matching the ticket's own explicitly-stated expected narrowing byte-for-byte. Zero
    //    false-negative-rate change across the full 20-question sweep either way (E always
    //    survives in both variants), but the chained variant is the one the ticket's own WHY
    //    section describes and the one that actually completes KN-BP144-2's intended two-stage
    //    design -- this is completing that design, not a threshold nudge, so per this ticket's own
    //    Phase B instruction it does not violate "never widen a gate to force a pass." Wrapped in
    //    the SAME non-fatal try/catch convention resolveDeterministicComputeOverride's own Stage
    //    0/1 call site uses (a throw here must never break the eliminator path -- fails back to
    //    the full option set, honest and no worse than Phase A's own original behavior).
    const eliminatorOptions = parseOptionsFromPrompt(mcPromptWithSubstrate);
    let eliminatorStage1Survivors: string[] = eliminatorOptions.map((o) => o.letter);
    try {
      eliminatorStage1Survivors = runEliminationChart(researchQuery, eliminatorOptions).survivors;
    } catch (err) {
      console.warn('[plow_mc_answerer] KN-BP144-4 Phase B: Stage 1 (runEliminationChart) threw ahead of the eliminator (non-fatal, falling back to the full option set):', err);
    }
    const eliminatorSurvivorsIn = eliminatorStage1Survivors;
    const eliminatorProbe = runRegisterResolutionStage(researchQuery, eliminatorOptions, eliminatorSurvivorsIn, null);
    let eliminatorResult: RegisterResolutionStageResult = eliminatorProbe;
    if (eliminatorProbe.applied && eliminatorProbe.registerCandidate) {
      // PASS 2: a real live verification lookup, attempted so the mandatory-verification-or-
      // abstain contract inside runRegisterResolutionStage (KN-BP144-2 Phase 2's own gate) has a
      // real caller-supplied lookup to check, instead of always hitting its null-verification
      // abstain branch. Mirrors the SAME real-bridge-construction pattern this file already uses
      // for the format-independent fallback's own C7 source capture (see that call site, above,
      // for the identical dynamic-import mechanism) -- constructed locally here because the
      // Stage-F2 `browserBridge` above is scoped to that block and is not reachable at this later
      // point in the function. Never fabricated: a missing/failed bridge, or a lookup that
      // returns nothing usable, leaves `liveVerification` null and the second call abstains
      // exactly as the stage's own contract requires.
      let liveVerification: RegisterVerificationLookup | null = null;
      const verificationQuery = `what is ${eliminatorProbe.concept!} in ${eliminatorProbe.registerCandidate.register}`;
      const eliminatorBridge: BrowserAuthorityBridge = {
        async runQueryInUserBrowser(query) {
          try {
            const mainModule = await import('../index');
            return await mainModule.runBrowserAuthorityQueryFromMain(query);
          } catch (err) {
            console.warn('[plow_mc_answerer] KN-BP144-4 eliminator verification bridge call failed (non-fatal, honest null):', err);
            return null;
          }
        },
      };
      try {
        const rawFact = await getRawBrowserAuthorityFact(
          verificationQuery,
          { researchArmMode: true, researchArmBrowserAuthority: true, preferredAuthority: 'user_perplexity' },
          eliminatorBridge,
        );
        if (rawFact && rawFact.fact) {
          liveVerification = {
            query: verificationQuery,
            definitionText: rawFact.fact,
            registerClaimed: eliminatorProbe.registerCandidate.register,
            source: rawFact.authority,
          };
        }
      } catch (err) {
        console.warn('[plow_mc_answerer] KN-BP144-4 eliminator verification lookup threw (non-fatal, eliminator abstains):', err);
      }
      eliminatorResult = runRegisterResolutionStage(researchQuery, eliminatorOptions, eliminatorSurvivorsIn, liveVerification);
    }
    // A3, fourth bullet: applied-and-abstained (or never applied at all) is NO CONSTRAINT AT ALL
    // -- structurally distinct from an empty survivor set (which would silently kill every
    // candidate). Only `applied && !abstained` is a real constraint worth filtering on.
    const eliminatorConstraintActive = eliminatorResult.applied && !eliminatorResult.abstained;
    const eliminatorConstraintSet = eliminatorConstraintActive ? new Set(eliminatorResult.survivorsOut) : null;
    console.log(
      `[plow_mc_answerer] KN-BP144-4 eliminator ${
        eliminatorConstraintActive
          ? `CONSTRAINED survivorsIn=[${eliminatorResult.survivorsIn.join(',')}] -> survivorsOut=[${eliminatorResult.survivorsOut.join(',')}]`
          : eliminatorResult.applied ? 'ABSTAINED (no constraint -- adjudicator proceeds unfiltered)' : 'NO-OP (no constraint -- adjudicator proceeds unfiltered)'
      }. Trace:\n  ${eliminatorResult.trace.join('\n  ')}`,
    );

    // ── KN-BP145-A: give runEliminationCascadeFormatIndependentFallback (PAPER-15 sections 3-7,
    //    this file, defined above -- C1-C8, "the cascade never parses option text; it composes its
    //    own verification queries") its OWN reachable entry point here, gated ONLY on
    //    cascadeAdjudicatorEngaged (the SAME 'disagree'-fall-through-with-real-candidates guard the
    //    register-resolution eliminator just above and the adjudicator below both already key on),
    //    deliberately NOT on `answerType`. Ticket diagnosis, confirmed by Phase 0 (this ticket's own
    //    report, KN-BP145-A_REPORT.md): this mechanism was previously reachable ONLY from inside
    //    resolveDeterministicComputeOverride (two call sites, both gated
    //    `answerType === 'computable'`), so a 'reasoning'-classified question -- 12 of run 043's 20,
    //    including every one of qids 66/72/79/85/92/98/105/111 this ticket concerns -- could never
    //    reach it, regardless of what its own internal gate (evaluateFormatIndependentFallbackGate)
    //    would have said. This call site bypasses resolveDeterministicComputeOverride entirely; the
    //    OTHER nine compute tiers inside that function (unit_aware/bare_value/schedule/density/
    //    physics/aircraft/pseudocode/set_membership/no_consensus) are untouched and stay exactly as
    //    computable-gated as before -- only this one mechanism gets a second, independent door. The
    //    `answerType === 'computable'` gate itself is never widened, here or anywhere else in this
    //    file. `eliminatorOptions` (line above) is the FULL presented option set A-J parsed from
    //    this same prompt -- passed straight through, never a candidate-sources list -- so this
    //    tier's own internal gate and both its ranking/quantity legs operate over real options, and
    //    any candidate it produces can name a letter no authority ever proposed (PAPER-15's own
    //    format-independence claim). Wrapped in the SAME non-fatal try/catch convention every other
    //    call site of this function already uses (a throw here must never break the adjudicator
    //    path -- falls back to no cascade candidate, honest and no worse than pre-KN-BP145-A
    //    behavior).
    let cascadeFallbackCandidateForAdjudication: AuthorityEnsembleCandidate | null = null;
    try {
      const cascadeFallbackBridge: BrowserAuthorityBridge = {
        async runQueryInUserBrowser(query) {
          try {
            const mainModule = await import('../index');
            return await mainModule.runBrowserAuthorityQueryFromMain(query);
          } catch (err) {
            console.warn('[plow_mc_answerer] KN-BP145-A cascade-fallback bridge call failed (non-fatal, honest null):', err);
            return null;
          }
        },
      };
      const cascadeFallbackResult = await runEliminationCascadeFormatIndependentFallback(
        researchQuery,
        eliminatorOptions,
        { ollamaBaseUrl, model },
        cascadeFallbackBridge,
        (msg) => console.log(`[plow_mc_answerer] KN-BP145-A cascade-fallback (disagree-fallthrough entry): ${msg}`),
      );
      console.log(
        `[plow_mc_answerer] KN-BP145-A cascade-fallback receipt: attempted=${cascadeFallbackResult.receipt.attempted} ` +
        `decided=${cascadeFallbackResult.receipt.decided} -- ${cascadeFallbackResult.receipt.trace}`,
      );
      if (cascadeFallbackResult.candidate) {
        const det = cascadeFallbackResult.candidate;
        cascadeFallbackCandidateForAdjudication = {
          authority: 'elimination_cascade_fallback',
          letter: det.letter,
          reasoning:
            `elimination cascade format-independent fallback (KN-BP145-A entry point, method=${det.method}): ` +
            `${det.sourceExpression}`,
          sourceUrl: cascadeFallbackResult.receipt.sourceCaptures[0]?.url ?? '',
          method: det.method,
        };
        console.log(
          `[plow_mc_answerer] KN-BP145-A cascade-fallback produced candidate letter=${det.letter} -- added as a ` +
          `genuinely independent witness (derivation path 'deterministic_solver:elimination_cascade_fallback'), ` +
          `never auto-rooted (runCandidateSourceCascadeAdjudicator's RULE 2 keys literally on ` +
          `authority === 'deterministic_compute', which this candidate is deliberately NOT tagged as).`,
        );
      }
    } catch (err) {
      console.warn('[plow_mc_answerer] KN-BP145-A cascade-fallback threw (non-fatal, adjudicator proceeds without it):', err);
    }

    // A2: the eliminator's surviving option set FILTERS the adjudicator's ADMISSIBLE CANDIDATES
    // before it ever runs -- so whatever the adjudicator returns (if anything) already satisfies
    // the constraint by construction, never merely by luck. When there is no active constraint,
    // `admissibleCandidates` is the exact same array as `ensembleCandidatesForTrace`, byte-
    // identical to pre-KN-BP144-4 behavior.
    // KN-BP145-A: `candidatesIncludingCascadeFallback` is `ensembleCandidatesForTrace` plus the new
    // cascade-fallback candidate (if one fired) appended -- `ensembleCandidatesForTrace` itself is
    // left untouched so every OTHER trace string in this file that reads it (the "allCandidates="
    // log lines below, the receipt's own `ensembleCandidates` field) keeps meaning exactly what it
    // always meant: what the authority ensemble itself returned. The cascade fallback is a LATER,
    // separate stage; it is folded in only at this admissibility-filtering step, subject to the
    // SAME eliminator constraint as every authority-sourced candidate, never given a bypass.
    const candidatesIncludingCascadeFallback = cascadeFallbackCandidateForAdjudication
      ? [...ensembleCandidatesForTrace!, cascadeFallbackCandidateForAdjudication]
      : ensembleCandidatesForTrace!;
    const admissibleCandidates = eliminatorConstraintSet
      ? candidatesIncludingCascadeFallback.filter((c) => eliminatorConstraintSet.has(c.letter))
      : candidatesIncludingCascadeFallback;

    // KN-BP144-1 Phase 2: cascadeReported* mirrors the SAME ensembleSwarmAlreadyFired-aware
    // honest-bookkeeping pattern this file's own final return uses further below (see that
    // block's own comment) -- duplicated rather than hoisted, so this early return touches zero
    // existing lines. The swarm ran once, inside the ensemble, above; this return never re-fires
    // it and never fabricates a second count. Hoisted above the adjudicator call (KN-BP144-4) so
    // the A3-third-bullet abstain path below can reuse it too.
    const cascadeReportedSpecialistsUsed = ensembleSwarmAlreadyFired && ensembleSwarmReceipt
      ? ensembleSwarmReceipt.specialistsUsed : specialistsUsed;
    const cascadeReportedCandidatesRaw = ensembleSwarmAlreadyFired && ensembleSwarmReceipt
      ? ensembleSwarmReceipt.candidatesRaw : candidatesRaw;
    const cascadeReportedCandidatesPostMiner = ensembleSwarmAlreadyFired && ensembleSwarmReceipt
      ? ensembleSwarmReceipt.candidatesPostMiner : postMiner.length;
    const cascadeReportedCandidatesPostFurnace = ensembleSwarmAlreadyFired && ensembleSwarmReceipt
      ? ensembleSwarmReceipt.candidatesPostFurnace : postFurnace.length;
    const cascadeLatencyMs = Date.now() - startMs;

    // A3, third bullet: the constraint excluded EVERY candidate the adjudicator would otherwise
    // have considered -- honest ABSTAIN, reached BEFORE runCandidateSourceCascadeAdjudicator is
    // even called, and never falling back to the local self-vote below.
    if (eliminatorConstraintActive && admissibleCandidates.length === 0) {
      const exclusionConcordance: ConcordanceClass = 'DISCORDANT';
      console.log(
        `[plow_mc_answerer] KN-BP144-4 abstain_constraint_excluded_all: constraint=[${eliminatorResult.survivorsOut.join(',')}] ` +
        `excluded every candidate in allCandidates=[${ensembleCandidatesForTrace!.map((c) => `${c.authority}:${c.letter}`).join(', ')}] -- ` +
        `honest ABSTAIN, adjudicator never reached.`,
      );
      return {
        questionId,
        domain,
        chosenLetter: null,
        voterLetters: [],
        voterDiagnostics: [],
        concordance: exclusionConcordance,
        bmvScore: 0,
        gateOutcomes: evaluateGates(cascadeReportedCandidatesPostFurnace, 0, exclusionConcordance, cascadeLatencyMs),
        specialistsUsed: cascadeReportedSpecialistsUsed,
        candidatesRaw: cascadeReportedCandidatesRaw,
        candidatesPostMiner: cascadeReportedCandidatesPostMiner,
        candidatesPostFurnace: cascadeReportedCandidatesPostFurnace,
        andonTriggered: andonRetry > 0,
        andonRetries: andonRetry,
        ebletsWritten: 0,
        latencyMs: cascadeLatencyMs,
        traceSummary:
          `KN-BP144-4 abstainConstraintExcludedAll=true eliminatorConstraint=[${eliminatorResult.survivorsOut.join(',')}] ` +
          `allCandidates=[${ensembleCandidatesForTrace!.map((c) => `${c.authority}:${c.letter}`).join(', ')}] ` +
          `andonRetries=${andonRetry}`,
        provenanceReceipts: [],
        ...(classifiedAnswerType ? { answerType: classifiedAnswerType } : {}),
        ensembleCandidates: ensembleCandidatesForTrace,
        ensembleOutcomeCorroboration: ensembleOutcomeCorroborationForTrace,
        authorityOutcomes: authorityOutcomesForTrace,
        letterSource: 'abstain_constraint_excluded_all',
        eliminatorTrace: eliminatorResult.trace,
        eliminatorConstraintSurvivors: eliminatorResult.survivorsOut,
      };
    }

    const cascade = runCandidateSourceCascadeAdjudicator(admissibleCandidates);
    console.log(
      `[plow_mc_answerer] KN-BP144-1 Phase 2 cascade adjudicator ENGAGED (ensemble fell through ` +
      `disagree, admissibleCandidates=[${admissibleCandidates.map((c) => `${c.authority}:${c.letter}`).join(', ')}]` +
      `${eliminatorConstraintActive ? ` -- KN-BP144-4 filtered by constraint=[${eliminatorResult.survivorsOut.join(',')}] from allCandidates=[${ensembleCandidatesForTrace!.map((c) => `${c.authority}:${c.letter}`).join(', ')}]` : ' -- KN-BP144-4 no constraint active'}) ` +
      `-> ${cascade.chosenLetter ?? 'ABSTAIN'}. Elimination log:\n  ${cascade.eliminationLog.join('\n  ')}`,
    );
    if (cascade.chosenLetter) {
      // RULE 4 WIN: exactly one letter survived. CONCORDANT is the honest concordance label here
      // -- see runCandidateSourceCascadeAdjudicator's own header: this is either 2+ genuinely
      // independent derivation-path candidates already agreeing (66/72/85/105's own shape once
      // the dissenting swarm entry is eliminated), or, when only one candidate ever existed after
      // elimination, a lone but source-adjudicated accept -- never a guess, never a self-vote echo.
      const cascadeConcordance: ConcordanceClass = 'CONCORDANT';
      const cascadeBmv = computeBmvScore(
        cascadeReportedCandidatesRaw, cascadeReportedCandidatesPostMiner, cascadeReportedCandidatesPostFurnace,
        1, cascadeConcordance, cascadeReportedSpecialistsUsed.length, cascadeLatencyMs,
      );
      const cascadeOptionText = parseOptionsFromPrompt(mcPromptWithSubstrate).find((o) => o.letter === cascade.chosenLetter)?.text ?? '';
      const cascadeSourced = cascade.survivingCandidates.find((c) => !!c.sourceUrl && c.sourceUrl !== 'specialist-swarm-internal-consensus') ?? cascade.survivingCandidates[0]!;
      try {
        await writeAndReplicateSolvedAnswer({
          researchQuery,
          domain,
          chosenLetter: cascade.chosenLetter,
          optionText: cascadeOptionText,
          reasoning: cascade.survivingCandidates.map((c) => `${c.authority}: ${c.reasoning}`).join(' | '),
          sourceUrl: cascadeSourced.sourceUrl && cascadeSourced.sourceUrl !== 'specialist-swarm-internal-consensus' ? cascadeSourced.sourceUrl : undefined,
          authority: cascadeSourced.authority,
          // Honest per the SAME BP131/BP141 corroboration vocabulary writeAndReplicateSolvedAnswer
          // already enforces: 2+ surviving candidates that independently agree earn 'concordant';
          // exactly one surviving candidate (e.g. qid 66's shape, swarm eliminated, Perplexity the
          // sole survivor) earns 'single_authority' -- never 'concordant' for a lone survivor.
          corroboration: cascade.survivingCandidates.length >= 2 ? 'concordant' : 'single_authority',
        });
      } catch (err) {
        console.warn('[plow_mc_answerer] KN-BP144-1 Phase 2 cascade-adjudicated writeback/replicate failed (non-fatal):', err);
      }
      return {
        questionId,
        domain,
        chosenLetter: cascade.chosenLetter,
        voterLetters: [cascade.chosenLetter],
        voterDiagnostics: [{
          temperature: 0,
          status: 'parsed_ok',
          responseChars: cascade.eliminationLog.join(' ').length,
          rawPreview: `cascade adjudicator (candidate-source elimination, KN-BP144-1 Phase 2): ${cascade.eliminationLog.join(' | ').slice(0, 300)}`,
        }],
        concordance: cascadeConcordance,
        bmvScore: cascadeBmv,
        gateOutcomes: evaluateGates(cascadeReportedCandidatesPostFurnace, cascadeBmv, cascadeConcordance, cascadeLatencyMs),
        specialistsUsed: cascadeReportedSpecialistsUsed,
        candidatesRaw: cascadeReportedCandidatesRaw,
        candidatesPostMiner: cascadeReportedCandidatesPostMiner,
        candidatesPostFurnace: cascadeReportedCandidatesPostFurnace,
        andonTriggered: andonRetry > 0,
        andonRetries: andonRetry,
        ebletsWritten: 1,
        latencyMs: cascadeLatencyMs,
        traceSummary:
          `KN-BP144-1 Phase 2 cascadeAdjudicated=true matchedOption=${cascade.chosenLetter} ` +
          `survivingCandidates=[${cascade.survivingCandidates.map((c) => `${c.authority}:${c.letter}`).join(',')}] ` +
          `allCandidates=[${ensembleCandidatesForTrace!.map((c) => `${c.authority}:${c.letter}`).join(', ')}] ` +
          `${eliminatorConstraintActive ? `KN-BP144-4 eliminatorConstraint=[${eliminatorResult.survivorsOut.join(',')}] ` : 'KN-BP144-4 eliminatorConstraint=none '}` +
          `andonRetries=${andonRetry}`,
        provenanceReceipts: cascade.survivingCandidates.map((c) => ({
          source: c.authority,
          contentHash: createHash('sha256').update(c.reasoning).digest('hex').slice(0, 16),
          verified: true,
          ...(c.sourceUrl && c.sourceUrl !== 'specialist-swarm-internal-consensus' ? { provenanceUrl: c.sourceUrl } : {}),
        })),
        ...(classifiedAnswerType ? { answerType: classifiedAnswerType } : {}),
        ensembleCandidates: ensembleCandidatesForTrace,
        ensembleOutcomeCorroboration: ensembleOutcomeCorroborationForTrace,
        authorityOutcomes: authorityOutcomesForTrace,
        letterSource: eliminatorConstraintActive ? 'cascade_adjudicated_constrained' : 'cascade_adjudicated_unconstrained',
        cascadeEliminationLog: cascade.eliminationLog,
        eliminatorTrace: eliminatorResult.trace,
        ...(eliminatorConstraintActive ? { eliminatorConstraintSurvivors: eliminatorResult.survivorsOut } : {}),
      };
    }
    // RULE 5 ABSTAIN: more than one distinct letter survived, or none did. Honest no-letter --
    // never falls back to the local self-vote below (that fallback is exactly what this
    // adjudicator exists to preempt). Mirrors the compute-fallthrough-no-facts/relevance-gate
    // abstain returns' own shape just above in this file (voterLetters/voterDiagnostics empty,
    // no writeback, DISCORDANT).
    const cascadeAbstainConcordance: ConcordanceClass = 'DISCORDANT';
    return {
      questionId,
      domain,
      chosenLetter: null,
      voterLetters: [],
      voterDiagnostics: [],
      concordance: cascadeAbstainConcordance,
      bmvScore: 0,
      gateOutcomes: evaluateGates(cascadeReportedCandidatesPostFurnace, 0, cascadeAbstainConcordance, cascadeLatencyMs),
      specialistsUsed: cascadeReportedSpecialistsUsed,
      candidatesRaw: cascadeReportedCandidatesRaw,
      candidatesPostMiner: cascadeReportedCandidatesPostMiner,
      candidatesPostFurnace: cascadeReportedCandidatesPostFurnace,
      andonTriggered: andonRetry > 0,
      andonRetries: andonRetry,
      ebletsWritten: 0,
      latencyMs: cascadeLatencyMs,
      traceSummary:
        `KN-BP144-1 Phase 2 cascadeAdjudicated=true cascadeAbstain=true ` +
        `admissibleCandidates=[${admissibleCandidates.map((c) => `${c.authority}:${c.letter}`).join(', ')}] ` +
        `allCandidates=[${ensembleCandidatesForTrace!.map((c) => `${c.authority}:${c.letter}`).join(', ')}] ` +
        `${eliminatorConstraintActive ? `KN-BP144-4 eliminatorConstraint=[${eliminatorResult.survivorsOut.join(',')}] ` : 'KN-BP144-4 eliminatorConstraint=none '}` +
        `andonRetries=${andonRetry}`,
      provenanceReceipts: [],
      ...(classifiedAnswerType ? { answerType: classifiedAnswerType } : {}),
      ensembleCandidates: ensembleCandidatesForTrace,
      ensembleOutcomeCorroboration: ensembleOutcomeCorroborationForTrace,
      authorityOutcomes: authorityOutcomesForTrace,
      letterSource: 'abstain',
      cascadeEliminationLog: cascade.eliminationLog,
      cascadeAdjudicatorAbstain: true,
      eliminatorTrace: eliminatorResult.trace,
      ...(eliminatorConstraintActive ? { eliminatorConstraintSurvivors: eliminatorResult.survivorsOut } : {}),
    };
  }

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
    // BP139 gate-closure fix (same rationale as attemptEscalationWidenAndRetry's own comment
    // above): report.additionalOperators is a hardcoded per-rootCause suggestion list with no
    // awareness of isAuthorityEnabled()'s premium tier gate (e.g. a math_dead_end rootCause can
    // suggest 'wolfram', which is tier:'premium'/default-off). Filter through the SAME resolver
    // getOperatorsForDomain() already uses for the base roster before this Condition-C retry
    // ever widens with it -- a disabled premium specialist can no longer reach effectiveOperators
    // via THIS recursive call site either.
    const andonEnableOverrides = readAuthorityEnableOverridesFromSettings();
    const andonAllowedAdditional = report.additionalOperators.filter((op) =>
      isAuthorityEnabled(op, andonEnableOverrides),
    );
    if (report.wideningApplied && andonAllowedAdditional.length > 0) {
      return runCanonicalPlowMcAnswer(
        mcPromptWithSubstrate, researchQuery, config, writeEbletFn, onProgress,
        andonRetry + 1, andonAllowedAdditional,
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

  // WIRE-THE-LOOP fix parts 2+3: the swarm+voter path's own genuinely-solved answer (CONCORDANT,
  // a real chosenLetter, at least one fact actually shown to the voters) also gets written back
  // + replicated -- runScribe above writes per-candidate COMPONENT facts (unchanged, pre-existing
  // behavior), this is the missing WHOLE-ANSWER write for this path, same as the browser-
  // authority short-circuit and decompose-and-eliminate paths above.
  if (concordance === 'CONCORDANT' && chosenLetter && factsForArbitration.length > 0) {
    const solvedOptionText = parseOptionsFromPrompt(mcPromptWithSubstrate).find((o) => o.letter === chosenLetter)?.text ?? '';
    const sourcedCandidate = factsForArbitration.find((c) => !!c.provenance_url) ?? factsForArbitration[0];
    try {
      await writeAndReplicateSolvedAnswer({
        researchQuery,
        domain,
        chosenLetter,
        optionText: solvedOptionText,
        reasoning: reasoningForLedger ?? sourcedCandidate.content,
        sourceUrl: sourcedCandidate.provenance_url,
        authority: sourcedCandidate.source,
      });
    } catch (err) {
      console.warn('[plow_mc_answerer] swarm-voter writeback/replicate failed (non-fatal):', err);
    }
  }

  const psionicMarkerTrace = psionicConcurred ? ' psionicConcurred=true' : psionicDiscorded ? ' psionicDiscorded=true' : '';
  // BP137 Yoke v2b Stage F2: only appended when the early browser-authority-first block
  // actually attempted a lookup (classified 'lookup_fact' AND browserAuthorityOn) -- empty
  // string, byte-unchanged trace, for every other case.
  // KN-BP143-2 B1a (Part A finding A1): googleFact/perplexityFact used to read
  // browserGoogleResult/browserPerplexityResult unconditionally -- those two variables are only
  // ever written by the LEGACY (else) branch above, never by the Authority Ensemble branch
  // (authorityEnsembleOn), so this line reported a hardcoded "no/no" for every ensemble question
  // regardless of what Google/Perplexity actually returned (qid 66, receipt 037: corroboration=
  // disagree -- which requires 2+ REAL resolved candidates -- yet googleFact=no perplexityFact=no
  // in the SAME line). Read the ensemble's own real candidate list when it ran; fall back to the
  // pre-existing legacy variables only when it did not (ensembleCandidatesForTrace stays
  // undefined for the legacy branch and for every flag-off caller) -- byte-identical trace for
  // both of those cases, honest for the ensemble case.
  const googleAnsweredForTrace = ensembleCandidatesForTrace
    ? ensembleCandidatesForTrace.some((c) => c.authority === 'user_google')
    : !!browserGoogleResult;
  const perplexityAnsweredForTrace = ensembleCandidatesForTrace
    ? ensembleCandidatesForTrace.some((c) => c.authority === 'user_perplexity')
    : !!browserPerplexityResult;
  const browserAuthorityTrace = browserAuthorityAttempted
    ? ` browserAuthorityFirst=true corroboration=${browserAuthorityCorroboration} ` +
      `googleFact=${googleAnsweredForTrace ? 'yes' : 'no'} perplexityFact=${perplexityAnsweredForTrace ? 'yes' : 'no'} ` +
      `injectedAsTopFacts=${browserFactCandidates.length}`
    : '';

  // KN-BP142-3 Phase 0b (carried over from KN-BP142-2 Defect B, diagnosed there, fixed here):
  // when ensembleSwarmAlreadyFired is true, the swarm loop above deliberately did not re-fire
  // (cheap-by-design guard, correct and untouched), so specialistsUsed/candidatesRaw/postMiner/
  // postFurnace are all genuinely [] / 0 -- no NEW fetch happened in THIS function call.
  // bmvScore and gateOutcomes just above are computed from those genuinely-empty numbers and
  // are DELIBERATELY LEFT UNCHANGED here -- the voters really did arbitrate over zero freshly-
  // fetched facts, and that score must stay honest; this fix never touches a decision or a gate.
  //
  // But 9 real specialists DID run for this exact question, inside the authority ensemble
  // above, and ensembleSwarmReceipt already carries their real names and candidate counts
  // (captured at `ensembleSwarmReceipt = ensembleOutcome.swarmReceipt` near the top of this
  // function) -- that data was previously read only for one console.log line in the
  // ensembleSwarmAlreadyFired branch and then discarded. Reporting `specialists=[] raw=0` on
  // the receipt when 9 specialists genuinely ran is a bookkeeping discard, not a decision --
  // this block ONLY changes what the RECEIPT/TRACE SAYS ran; allCandidates/postMiner/postFurnace
  // themselves are never mutated, so nothing that actually decided anything above (Miner,
  // Saladin/Furnace, factsForArbitration, bmvScore, gateOutcomes, the voters) is touched, and
  // the swarm is still not re-fired -- exactly the guard's own "cheap-by-design" intent.
  const reportedSpecialistsUsed = ensembleSwarmAlreadyFired && ensembleSwarmReceipt
    ? ensembleSwarmReceipt.specialistsUsed
    : specialistsUsed;
  const reportedCandidatesRaw = ensembleSwarmAlreadyFired && ensembleSwarmReceipt
    ? ensembleSwarmReceipt.candidatesRaw
    : candidatesRaw;
  const reportedCandidatesPostMiner = ensembleSwarmAlreadyFired && ensembleSwarmReceipt
    ? ensembleSwarmReceipt.candidatesPostMiner
    : postMiner.length;
  const reportedCandidatesPostFurnace = ensembleSwarmAlreadyFired && ensembleSwarmReceipt
    ? ensembleSwarmReceipt.candidatesPostFurnace
    : postFurnace.length;
  const swarmReusedFromEnsembleTrace = ensembleSwarmAlreadyFired && ensembleSwarmReceipt
    ? ' swarmReusedFromEnsemble=true (specialists ran inside the authority ensemble above, not re-fired here)'
    : '';

  const traceSummary =
    `specialists=[${reportedSpecialistsUsed.join(',')}] raw=${reportedCandidatesRaw} ` +
    `postMiner=${reportedCandidatesPostMiner} postFurnace=${reportedCandidatesPostFurnace} ` +
    `voters=[${voterLetters.map((l) => l ?? '-').join(',')}] ` +
    `voterStatus=[${voterDiagnostics.map((v) => v.status).join(',')}] ` +
    `concordance=${concordance} bmv=${bmvScore} andonRetries=${andonRetry} latencyGateAdvisoryOnly=true` +
    `${relevanceGateMethodTrace}${psionicMarkerTrace}${browserAuthorityTrace}${swarmReusedFromEnsembleTrace}`;

  // KN-BP142-2 Defect A: THE ONLY place decompose's stashed advisory candidate can become the
  // final answer. Reached only after Psionic, browser authority Stage F2, the authority ensemble,
  // AND this function's own swarm+voters arbitration (chosenLetter/concordance finalized at
  // computeLetterConcordance(voterLetters) above, never reassigned after) have ALL run to
  // completion -- every one of those was given the exact same chance to decide this question that
  // it would have had if decompose had abstained outright, because it WAS structurally treated as
  // an abstain (stashed, not returned) at both call sites above. This branch fires ONLY when the
  // real pipeline's own chosenLetter is still null/empty: a genuine, guaranteed abstain is the
  // only condition under which "an advisory guess is still better than a guaranteed abstain" (the
  // pre-existing P5 rationale) applies. A real chosenLetter -- CONCORDANT, PARTIAL, or even a weak
  // DISCORDANT-but-non-null vote -- ALWAYS wins over the advisory candidate; decompose can fill an
  // absence, it can never override a presence. Never widens elimination, never touches a gate.
  if (!chosenLetter && decomposeAdvisoryResult) {
    console.log(
      `[plow_mc_answerer] KN-BP142-2 Defect A: full pipeline reached its own natural end with ` +
      `chosenLetter=null (concordance=${concordance}) -- falling back to the stashed ADVISORY ` +
      `decompose candidate (letter=${decomposeAdvisoryResult.chosenLetter}) as the LAST resort. ` +
      `This is the only path by which decompose's output can be the final answer, and it happened ` +
      `only because every stronger mechanism (Psionic/browser-authority/ensemble/swarm+voters) ` +
      `already tried and produced nothing of its own.`,
    );
    return {
      ...decomposeAdvisoryResult,
      decomposeAdvisoryUsedAsLastResort: true,
      // KN-BP143-2 B1b: this is a fall-through path too (chosenLetter=null reached the function's
      // natural end) -- the ensemble still ran and produced real candidates before decompose's
      // advisory letter won as last resort; carry them for the Coroner's per-candidate
      // factVerdict persist, same as every other path below.
      ...(ensembleCandidatesForTrace ? { ensembleCandidates: ensembleCandidatesForTrace } : {}),
      ...(ensembleOutcomeCorroborationForTrace ? { ensembleOutcomeCorroboration: ensembleOutcomeCorroborationForTrace } : {}),
      ...(authorityOutcomesForTrace ? { authorityOutcomes: authorityOutcomesForTrace } : {}),
      // KN-BP144-1 Phase 1: deliberately left UNSET here, not inherited from
      // decomposeAdvisoryResult (which never set it) and not force-mapped onto this closed
      // vocabulary -- the real pipeline's own mechanism produced no letter at all (that is
      // literally this branch's guard, `!chosenLetter`, which by itself would read 'abstain');
      // the letter actually being returned came from decompose-and-eliminate, a mechanism this
      // ticket's 5-value vocabulary was not built to describe and that decomposeAdvisoryUsedAsLastResort
      // above already flags distinctly. See KN-BP144-1_REPORT.md.
      traceSummary:
        `${decomposeAdvisoryResult.traceSummary} | KN-BP142-2 Defect A: used as LAST-RESORT ` +
        `fallback -- full pipeline's own result was chosenLetter=null concordance=${concordance} ` +
        `(realPipelineTrace: ${traceSummary})`,
    };
  }

  return {
    questionId,
    domain,
    chosenLetter,
    voterLetters,
    voterDiagnostics,
    concordance,
    bmvScore,
    gateOutcomes,
    specialistsUsed: reportedSpecialistsUsed,
    candidatesRaw: reportedCandidatesRaw,
    candidatesPostMiner: reportedCandidatesPostMiner,
    candidatesPostFurnace: reportedCandidatesPostFurnace,
    andonTriggered: andonRetry > 0,
    andonRetries: andonRetry,
    ebletsWritten,
    latencyMs: Date.now() - startMs,
    traceSummary,
    provenanceReceipts,
    // KN-BP143-2 B1b: ensembleOutcome.candidates is populated on every return path of
    // runAuthorityEnsemble (accept AND disagree/fall-through alike), unlike this field which
    // was previously only attached on the accept branch above (~line 6437). This is the
    // ordinary swarm/voter-arbitration fall-through result (qid 66/72/85/105/111's shape) --
    // carry the same captured candidates through here too, using the outer-scoped
    // ensembleCandidatesForTrace from B1a (undefined when the ensemble never ran).
    ...(ensembleCandidatesForTrace ? { ensembleCandidates: ensembleCandidatesForTrace } : {}),
    ...(ensembleOutcomeCorroborationForTrace ? { ensembleOutcomeCorroboration: ensembleOutcomeCorroborationForTrace } : {}),
    ...(authorityOutcomesForTrace ? { authorityOutcomes: authorityOutcomesForTrace } : {}),
    // KN-BP144-1 Phase 1: this is THE fall-through site the ticket exists to instrument -- the
    // ensemble either never ran, or ran and fell through with no letter (disagree/none/lone-
    // rejected), and chosenLetter above is computeLetterConcordance(voterLetters)'s own verdict
    // on the line-7286 local 3-temperature self-vote. A truthy chosenLetter here means that self-
    // vote produced the served answer; a null chosenLetter means it did not either, i.e. a
    // genuine abstain. Set from chosenLetter itself (already finalized above, never reassigned
    // after computeLetterConcordance), never inferred from a different field.
    letterSource: chosenLetter ? 'voter_concordance_fallthrough' : 'abstain',
    ...(classifiedAnswerType ? { answerType: classifiedAnswerType } : {}),
    ...(psionicConcurred ? { psionicConcurred } : {}),
    ...(psionicDiscorded ? { psionicDiscorded } : {}),
    ...(starChamberReceipt ? { starChamber: starChamberReceipt } : {}),
    ...(browserAuthorityAttempted ? { browserAuthorityCorroboration } : {}),
    // BP137 Yoke v2b Stage F3: purely additive receipt annotation -- present only when this
    // peer was genuinely opted into mesh-synergy dispatch (never mutates chosenLetter/
    // concordance/gateOutcomes/anything above; see meshSynergyAssigned's own doc comment on
    // CanonicalPlowMcResult). Only reached with assignedAuthority==='swarm' (the
    // 'user_google'/'user_perplexity' cases already returned early, above) -- i.e. this line
    // only ever contributes `meshSynergyAssigned: 'swarm'` to the receipt, truthfully recording
    // that this peer ran the ordinary full pipeline for its mesh-synergy slot.
    ...(meshSynergyOn && assignedAuthority ? { meshSynergyAssigned: assignedAuthority } : {}),
  };
}

// ─── WIRE-THE-LOOP fix (single-box local plow, M0 goal) ──────────────────────────────────────
//
// index.ts's startRelayRoutePoll() (the WAN relay-route responder) had ONE inline call site
// that builds a CanonicalPlowMcConfig from the research-arm flag set and turns the resulting
// CanonicalPlowMcResult into a persistable plowTrace object. one_click_mmlu_pro.ts's new
// "Local -- full plow on THIS machine" mode (runLocalMode, plowEnabled branch) needs the
// EXACT same call -- not a second, independently-typed-out copy that can silently drift from
// the WAN responder's version over time. This function is that call site, extracted verbatim
// (same field-for-field config construction, same plowTrace key-for-key mapping) so BOTH
// callers -- index.ts's responder (rewired to call this, see that file's own comment at its
// call site) and one_click_mmlu_pro.ts's runLocalMode -- share exactly one place that invokes
// runCanonicalPlowMcAnswer for a mesh-test MC question. Every field below is byte-identical in
// meaning to the pre-extraction inline block; only the per-field "why" comments were condensed
// (the full rationale for each researchArm* sub-flag fan-in still lives on CanonicalPlowMcConfig
// itself, above, and is not repeated here to avoid duplicating documentation two places).

export interface PlowMcAnswererCallParams {
  /** Already substrate-gated (applySubstrateToggle already ran, or substrate was off) --
   *  passed straight to runCanonicalPlowMcAnswer as mcPromptWithSubstrate, exactly like the
   *  pre-extraction inline call. */
  effectivePrompt: string;
  researchQuery: string;
  domain: string;
  ollamaBaseUrl: string;
  model: string;
  choiceCount: number;
  /** Used only for the plowTrace.condition label (A_cold / B_warm_single_pass / C_warm_andon),
   *  matching the pre-extraction inline call's own condition derivation. */
  substrateEnabled: boolean;
  plowAndonEnabled: boolean;
  reasoningMode: boolean;
  testModeCorrectAnswerLetter: string | null;
  researchArmMode: boolean;
  researchArmMeshSynergy: boolean;
  assignedAuthority?: 'user_google' | 'user_perplexity' | 'swarm';
  researchArmDecompose: boolean;
  /** Short label prepended to every console.log line for this call, e.g.
   *  'relay-poll route=abcd1234' (index.ts) or 'oneclick-local q=42' (one_click_mmlu_pro.ts) --
   *  lets a terminal watcher tell which caller/question a given plow-stage line belongs to.
   *  Purely cosmetic, changes no behavior. */
  logLabel: string;
}

// KN-BP144-11 T0 ("the one that got skipped") -- CanonicalPlowMcResult.letterSource (set at
// eleven call sites inside runCanonicalPlowMcAnswer, see that interface's own doc comment) and
// CanonicalPlowMcResult.ensembleOutcomeCorroboration (captured unconditionally the moment the
// ensemble returns) were both producing correctly and neither was ever added to the plowTrace
// object below -- the receipt's allow-list simply never listed them, so they vanished silently
// with no error and no empty value. "Absent" and "never-listed" were the same shape; that is
// the entire defect this section closes.
//
// T1 fixes the seam (both fields are now assigned into the plowTrace object below, from the
// SAME plowResult fields the rest of this function already reads -- their computation is
// untouched). T2 is the jig, so the next additive field gets this guarantee for free instead of
// silently repeating T0:
//   1. letterSource/ensembleOutcomeCorroboration are REQUIRED on PlowTraceReceipt (this function's
//      own return type) -- the compiler refuses to type a receipt object literal that omits them,
//      even though both stay OPTIONAL on CanonicalPlowMcResult itself (correctly -- see that
//      interface's doc comment for the legacy/gated-off paths that genuinely never compute a
//      value, which this ticket does not touch).
//   2. 'unset' is added to each field's vocabulary AT THIS BOUNDARY ONLY, for exactly those
//      legacy paths -- never a bare absent key.
//   3. buildPlowTraceReceipt() is the one function every return path in
//      callCanonicalPlowMcAnswererForMeshTest routes through; it performs that 'unset' coercion
//      and, if a required key is still absent on the raw fields it was handed (defensive --
//      should be structurally unreachable given point 2, but "should be unreachable" is the exact
//      description that fit letterSource before this ticket), records the violation INSIDE the
//      returned receipt's own `jigViolations` array rather than letting the key vanish a second
//      time.

/** KN-BP144-11 T2: the closed vocabulary for `PlowTraceReceipt.letterSource`, widened by exactly
 *  one sentinel ('unset') beyond CanonicalPlowMcResult['letterSource']'s own vocabulary --
 *  CanonicalPlowMcResult's field stays optional/untouched (some legacy paths genuinely never
 *  compute it); this receipt-facing type is where "never computed" becomes an honest, present,
 *  non-fabricated value instead of an absent key. */
export type PlowTraceLetterSource = NonNullable<CanonicalPlowMcResult['letterSource']> | 'unset';

/** KN-BP144-11 T3: same required+sentinel treatment as PlowTraceLetterSource above, for the
 *  sibling field added in the SAME commit (518d8af2) that had the identical defect -- produced on
 *  CanonicalPlowMcResult, never carried into the receipt's plowTrace until this ticket. */
export type PlowTraceEnsembleOutcomeCorroboration = NonNullable<CanonicalPlowMcResult['ensembleOutcomeCorroboration']> | 'unset';

/** KN-BP144-11 T2: the receipt-facing trace type. Every OTHER plowTrace key keeps its pre-existing
 *  untyped `Record<string, unknown>` shape (widening this interface's index signature to type
 *  every one of those ~35 keys individually is the "cascades beyond this file" risk the ticket
 *  warns against and is explicitly out of this ticket's scope -- named as a follow-on below, not
 *  chased here); only the two fields this ticket's defect concerns are pulled out and made
 *  required. Structurally still assignable to `Record<string, unknown>` (the index signature
 *  guarantees that), so no external consumer of `PlowMcAnswererCallResult.plowTrace` needs to
 *  change -- confirmed by inspection of every current caller (index.ts, one_click_mmlu_pro.ts,
 *  OneClickMeshTestPanel.tsx, wan_dispatch.ts, answer_coroner.ts), all of which read/pass this
 *  field through their own `Record<string, unknown> | null` typed fields. */
export interface PlowTraceReceipt {
  [key: string]: unknown;
  letterSource: PlowTraceLetterSource;
  ensembleOutcomeCorroboration: PlowTraceEnsembleOutcomeCorroboration;
  /** KN-BP144-11 T2: populated by buildPlowTraceReceipt ONLY when a required key below was
   *  actually absent on the raw fields it was given -- see that function's own doc comment.
   *  Absent (not an empty array) on every receipt where the jig found nothing to report. */
  jigViolations?: string[];
}

/** KN-BP144-11 T2: every key a persisted plowTrace must never silently omit. Add to this array,
 *  not to the object literal in callCanonicalPlowMcAnswererForMeshTest directly, the next time a
 *  producer/consumer seam like this one needs closing -- that is what makes this a jig and not a
 *  one-time patch. */
const REQUIRED_PLOW_TRACE_KEYS = ['letterSource', 'ensembleOutcomeCorroboration'] as const;

/** KN-BP144-11 T2: THE single boundary function every plowTrace object must pass through before
 *  it is returned from callCanonicalPlowMcAnswererForMeshTest (both the success path and the
 *  crash/error path below) -- never a second, independently-typed-out assembly. Any
 *  REQUIRED_PLOW_TRACE_KEYS entry that is `undefined` on the raw fields it is given is (1) logged
 *  as a violation, verbatim, inside the returned receipt's own `jigViolations` array, and (2)
 *  coerced to the explicit 'unset' sentinel -- never a bare absent key. This is deliberately a
 *  runtime check, not only a compile-time one: TypeScript's structural typing cannot stop a caller
 *  from building a `Record<string, unknown>` that happens to omit these keys before handing it
 *  here (that is exactly what the pre-T0 object literal did), so the jig has to catch it at the
 *  one place every such object is required to pass through, not merely declare it required and
 *  hope every future writer remembers.
 *
 *  Exported (additive, non-required-by-the-ticket visibility change, same convention this file
 *  already uses for resolveConcordanceAcceptance/runCandidateSourceCascadeAdjudicator) so this
 *  ticket's own far-end verification calls the REAL compiled function directly, never a
 *  hand-reimplementation. */
export function buildPlowTraceReceipt(fields: Record<string, unknown>): PlowTraceReceipt {
  const receipt: Record<string, unknown> = { ...fields };
  const jigViolations: string[] = [];
  for (const key of REQUIRED_PLOW_TRACE_KEYS) {
    if (receipt[key] === undefined) {
      jigViolations.push(`required plowTrace key "${key}" was absent at receipt assembly -- defaulted to 'unset', never a bare missing key`);
      receipt[key] = 'unset';
    }
  }
  if (jigViolations.length > 0) {
    receipt.jigViolations = jigViolations;
  }
  return receipt as PlowTraceReceipt;
}

export interface PlowMcAnswererCallResult {
  /** null = genuine no-answer (DISCORDANT or all-voters-empty, or a plow crash) -- the caller
   *  must preserve this distinction rather than coercing null to a guessed letter, same
   *  Truth-Always doctrine as CanonicalPlowMcResult.chosenLetter itself. */
  answer: string | null;
  plowTrace: PlowTraceReceipt;
}

/** THE single call site for "answer this MC question via the 12-Blade Column Plow" shared by
 *  the WAN relay-route responder and the local-mode full-plow path. See the module note above
 *  for why this exists -- reuse this, do not re-type another inline call to
 *  runCanonicalPlowMcAnswer elsewhere. */
export async function callCanonicalPlowMcAnswererForMeshTest(
  params: PlowMcAnswererCallParams,
): Promise<PlowMcAnswererCallResult> {
  const {
    effectivePrompt, researchQuery, domain, ollamaBaseUrl, model, choiceCount,
    substrateEnabled, plowAndonEnabled, reasoningMode, testModeCorrectAnswerLetter,
    researchArmMode, researchArmMeshSynergy, assignedAuthority, researchArmDecompose, logLabel,
  } = params;
  try {
    const writeEbletFn = async (eblet: {
      question: string; answer: string; provenance: string;
      verified: true; sha256: string; timestamp: number;
    }): Promise<void> => { await writeVerifiedEblet(eblet); };
    const plowResult = await runCanonicalPlowMcAnswer(
      effectivePrompt,
      researchQuery,
      {
        domain,
        ollamaBaseUrl,
        model,
        choiceCount,
        andonEnabled: plowAndonEnabled,
        reasoningMode,
        testModeCorrectAnswerLetter,
        // BP137 Yoke v2b (Research Arm): the ONE flag fans out into all sub-flags together --
        // see CanonicalPlowMcConfig's own per-field doc comments above for the full rationale
        // of each (unchanged from the pre-extraction inline call).
        researchArmMode,
        researchArmRelevanceGate: researchArmMode,
        researchArmComputeSidecar: researchArmMode,
        researchArmEscalation: researchArmMode,
        researchArmPsionic: researchArmMode,
        researchArmBrowserAuthority: researchArmMode,
        // BP139 Authority Ensemble: fanned in alongside its sibling researchArm* sub-flags
        // above -- the ONE shared mesh-test call site (this function), used by both the WAN
        // relay-route responder and one_click_mmlu_pro.ts's local-mode benchmark path, so a
        // Founder benchmark run with researchArmMode:true automatically exercises the new
        // Google+Perplexity(+Wolfram) corroborated ensemble, matching every other sub-flag's
        // existing fan-out convention here. A direct runCanonicalPlowMcAnswer() caller that
        // builds its own CanonicalPlowMcConfig (bypassing this helper) still defaults this flag
        // to false/absent -- byte-identical for them.
        researchArmAuthorityEnsemble: researchArmMode,
        researchArmStarChamber: researchArmMode,
        researchArmMeshSynergy,
        ...(assignedAuthority ? { assignedAuthority } : {}),
        ...(researchArmDecompose ? { researchArmDecompose: true } : {}),
        // PRODUCTION READBACK HARD-OFF: this is THE single shared call site for every scored/
        // benchmark run (index.ts's WAN relay-poll responder AND one_click_mmlu_pro.ts's
        // local-mode benchmark both go through here, never a second copy). Explicit `false`
        // (not merely "absent") so a scored run can never recall/replay a previously-verified
        // answer-key letter -- scoring must always re-derive. PlowMcAnswererCallParams (this
        // function's own params interface) does not expose a productionReadbackEnabled field at
        // all, so there is structurally no way for a caller of this helper to override this.
        productionReadbackEnabled: false,
      },
      writeEbletFn,
      (stage) => console.log(`[${logLabel}] plow-stage: ${stage}`),
    );
    const answer = plowResult.chosenLetter; // null = genuine no-answer, handled by abstain logic below
    const rawPlowTraceFields: Record<string, unknown> = {
      // KN-BP144-11 T1/T3: both fields are produced correctly by runCanonicalPlowMcAnswer above
      // (eleven letterSource call sites, one unconditional ensembleOutcomeCorroboration capture --
      // see CanonicalPlowMcResult's own doc comments; neither field's computation is touched by
      // this ticket) and were never added to this allow-list until now -- see the module note
      // above PlowMcAnswererCallResult for the full defect. Both are optional/absent-capable on
      // CanonicalPlowMcResult (documented legacy paths); buildPlowTraceReceipt below coerces an
      // absent value to the 'unset' sentinel rather than letting either key vanish silently.
      letterSource: plowResult.letterSource,
      ensembleOutcomeCorroboration: plowResult.ensembleOutcomeCorroboration,
      concordance: plowResult.concordance,
      bmv_score: plowResult.bmvScore,
      gate_outcomes: plowResult.gateOutcomes,
      specialists_used: plowResult.specialistsUsed,
      candidates_raw: plowResult.candidatesRaw,
      candidates_post_miner: plowResult.candidatesPostMiner,
      // BP140 Coroner-classification fix: this key and compute_sidecar below were written in
      // snake_case, but classifyCore (answer_coroner.ts) reads them camelCase with NO fallback --
      // so substrate-hit / compute / substrate-gap / compute-wrong answerClasses were structurally
      // unreachable since 0.9.16 (commit 3922fe88), silently mislabeling those misses as
      // plow-majority / plow-discordant and corrupting the Coroner's prioritizedFixList. Renamed to
      // camelCase to match the reader; verified no other consumer reads these two keys in snake_case.
      // (provenance_receipts DELIBERATELY stays snake_case -- OneClickMeshTestPanel.tsx + wan_dispatch.ts depend on that casing.)
      candidatesPostFurnace: plowResult.candidatesPostFurnace,
      andon_triggered: plowResult.andonTriggered,
      andon_retries: plowResult.andonRetries,
      eblets_written: plowResult.ebletsWritten,
      voter_letters: plowResult.voterLetters,
      voter_diagnostics: plowResult.voterDiagnostics,
      latency_ms: plowResult.latencyMs,
      trace_summary: plowResult.traceSummary,
      condition: plowAndonEnabled ? 'C_warm_andon' : (substrateEnabled ? 'B_warm_single_pass' : 'A_cold'),
      reasoning_mode: reasoningMode,
      provenance_receipts: plowResult.provenanceReceipts,
      research_arm_mode: researchArmMode || undefined,
      answer_type: plowResult.answerType,
      computeSidecar: plowResult.computeSidecar,
      relevance_gate_abstain: plowResult.relevanceGateAbstain,
      star_chamber: plowResult.starChamber,
      mesh_synergy_assigned: plowResult.meshSynergyAssigned,
      // BP140 Yoke (Eblet-Learning Substrate / Liana Cycle): additive, undefined on every
      // pre-BP140 caller and every non-ensemble-accept return path (see
      // CanonicalPlowMcResult.ensembleCandidates doc comment). This is the ONE seam that carries
      // the full ensemble candidate set through to the Coroner (answer_coroner.ts), which is the
      // only place ground truth is available to derive a per-candidate factVerdict.
      ensemble_candidates: plowResult.ensembleCandidates,
      // BP140 Yoke bugfix-in-passing: this key was previously MISSING from this object entirely,
      // even though answer_coroner.ts's classifyCore has always read
      // `plowTrace.browserAuthorityCorroboration` (camelCase, unlike every other key here which
      // was snake_case -- that sibling mismatch, candidatesPostFurnace/computeSidecar, is now
      // fixed above this same session) to fill CoronerRecord.browserAuthorityCorroboration. Without this key, the
      // local-run Coroner path's disagreement/'adjudicated' signal -- which
      // persistEnsembleCandidateFactVerdicts needs to ever emit an 'O' (conflicting) factVerdict
      // -- always read back as null/'none', silently. Adding it here (camelCase, matching what
      // classifyCore already reads) is required for the O verdict to be reachable at all; every
      // other consumer of this plowTrace object either already ignored this absent key or gains
      // a previously-missing signal, never loses one.
      browserAuthorityCorroboration: plowResult.browserAuthorityCorroboration,
      // BP1xx STRUCTURED-CORROBORATOR GATE: camelCase, matching browserAuthorityCorroboration's
      // own casing convention immediately above (this is the key classifyCore/the Coroner would
      // read as `plowTrace.structuredCorroborator` were it wired to consume it -- see this
      // build's own report for the open question of whether classifyCore should be updated in a
      // follow-up pass to fold `structuredCorroborator === false` into its answerClass logic,
      // e.g. de-confidencing 'sourced-fact'/'plow-majority' on a wrong-but-LLM-only-concordant
      // accept). Present only when plowResult.structuredCorroborator is present (see that field's
      // own doc comment for exactly when).
      structuredCorroborator: plowResult.structuredCorroborator,
      // BP141 INDEPENDENCE-AWARE CORROBORATION FLAG: camelCase, same not-yet-consumed-by-
      // classifyCore convention as structuredCorroborator immediately above -- classifyCore
      // (answer_coroner.ts) is deliberately left unmodified this pass; this key is present in
      // plowTrace so a future pass can read `plowTrace.independentCorroboration` the same way it
      // already reads `plowTrace.browserAuthorityCorroboration`/`plowTrace.candidatesPostFurnace`
      // (camelCase, no snake_case fallback). Present only when plowResult.independentCorroboration
      // is present (see AuthorityEnsembleOutcome.independentCorroboration's own doc comment).
      independentCorroboration: plowResult.independentCorroboration,
      // BP141-1 SINGLE-SOURCE-NO-GROUNDING GATE (Task 3, run 029 receipt, question_id 98):
      // camelCase, same not-yet-consumed-by-classifyCore convention as structuredCorroborator/
      // independentCorroboration immediately above -- present only when
      // plowResult.singleSourceUngroundedAccept is present (a lone-candidate accept). true means
      // the accepted letter rests on one unverified LLM-class voice with zero post-Furnace
      // grounding behind it (see AuthorityEnsembleOutcome.singleSourceUngroundedAccept's own doc
      // comment for the full rationale) -- the letter itself is never changed by this flag; it
      // exists purely so the Coroner can see and de-confidence a thin-evidence accept.
      singleSourceUngroundedAccept: plowResult.singleSourceUngroundedAccept,
      // BP141-2 THE CAKE METHOD (N-Cut/N-Pick), same not-yet-consumed-by-classifyCore convention
      // as structuredCorroborator/independentCorroboration above -- present only when
      // plowResult.cakeMethodUsed is true (the ensemble's authorities disagreed even with the
      // swarm folded in, and the Cake mechanism ran to resolve it). See
      // AuthorityEnsembleOutcome's own doc comments (A6-A13) for the full field-by-field rationale.
      cakeMethodUsed: plowResult.cakeMethodUsed,
      cutModels: plowResult.cutModels,
      cutDerivations: plowResult.cutDerivations,
      distinctDerivationCount: plowResult.distinctDerivationCount,
      cutScatter: plowResult.cutScatter,
      pickConvergence: plowResult.pickConvergence,
      cakeQuadrant: plowResult.cakeQuadrant,
      anonymizedOrderSeed: plowResult.anonymizedOrderSeed,
      cakeSelfPreferenceAudit: plowResult.cakeSelfPreferenceAudit,
      // KN-BP141-7 P2/P3 (regression fix): cakeSelfPreferenceRate/minorityCutsOverridden/
      // cakePickerCutterInvariant are the three measurements this ticket requires exist and
      // populate from a real run (see AuthorityEnsembleOutcome's own doc comments on each field
      // for the full rationale) -- camelCase, same not-yet-consumed-by-classifyCore convention as
      // cakeMethodUsed/cutModels/etc. immediately above. Present only when cakeMethodUsed is true.
      cakeSelfPreferenceRate: plowResult.cakeSelfPreferenceRate,
      cakeCuts: plowResult.cakeCuts,
      cakePicks: plowResult.cakePicks,
      minorityCutsOverridden: plowResult.minorityCutsOverridden,
      cakePickerCutterInvariant: plowResult.cakePickerCutterInvariant,
      // KN-BP141-7 P6: present only when cakeMethodUsed is true -- see
      // AuthorityEnsembleOutcome.cascadeCandidateProducer / gomJabbarG5Advisory's own doc comments.
      cascadeCandidateProducer: plowResult.cascadeCandidateProducer,
      gomJabbarG5Advisory: plowResult.gomJabbarG5Advisory,
      // KN-BP141-7 P5: present only when this answer came from decompose-and-eliminate -- see
      // CanonicalPlowMcResult.decomposeAdvisoryDemoted's own doc comment.
      decomposeAdvisoryDemoted: plowResult.decomposeAdvisoryDemoted,
      // KN-BP144-7 T1-T3 ("Make The Silent Authorities Loud"): normalizeAuthorityAttemptOutcomes
      // is the ONE choke point that guarantees ALL SIX keys (five browser authorities + swarm)
      // are present on every single question's trace, always -- filling in 'not_attempted' for
      // any key plowResult.authorityOutcomes did not itself set (including the case where that
      // field is entirely undefined, e.g. authorityEnsembleOn was somehow false). This is this
      // ticket's own T3 gate, enforced unconditionally at THE single shared call site every
      // scored/benchmark run funnels through (this function -- see its own header comment).
      authorityOutcomes: normalizeAuthorityAttemptOutcomes(plowResult.authorityOutcomes),
    };
    // KN-BP144-11 T2: THE one boundary every plowTrace object routes through -- see
    // buildPlowTraceReceipt's own doc comment above PlowMcAnswererCallResult.
    const plowTrace = buildPlowTraceReceipt(rawPlowTraceFields);
    console.log(`[${logLabel}] plow-answered letter=${answer ?? 'NONE'} ${plowResult.traceSummary}`);
    return { answer, plowTrace };
  } catch (plowErr) {
    // Truth-Always: a plow crash must surface as an honest abstain, never silently fall back
    // to single-shot and misreport itself as a plow answer. Routed through the same
    // buildPlowTraceReceipt boundary (KN-BP144-11 T2) as the success path above, so even a crash
    // receipt carries an honest 'unset' letterSource/ensembleOutcomeCorroboration rather than
    // omitting both keys.
    console.error(`[${logLabel}] plow-answerer error:`, plowErr);
    return { answer: null, plowTrace: buildPlowTraceReceipt({ error: String(plowErr) }) };
  }
}
