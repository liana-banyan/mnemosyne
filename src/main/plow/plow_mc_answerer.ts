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
// BP-AIRCRAFT-SOLVER: a SIXTH, independent deterministic compute tier -- see that file's header
// for the full rationale (the airplane lift/drag/takeoff-power benchmark wobble) -- tried only
// after tiers (i)-(v) have already returned null. Never duplicates or modifies those five tiers.
import { solveAircraftLiftDragProblem } from './plow_mc_aircraft_solver';
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
  /** BP140 Yoke (Eblet-Learning Substrate / Liana Cycle), OPTIONAL/ADDITIVE. The full ensemble
   *  candidate set (winner AND every losing candidate), carried through so the Coroner -- the
   *  only place ground truth is actually available -- can persist a factVerdict-tagged eblet for
   *  EVERY candidate, not just the accepted letter. See answer_coroner.ts's deriveFactVerdict()/
   *  persistEnsembleCandidateFactVerdicts(). Present only on the authorityEnsembleOn accepted-
   *  candidate return path (mirrors authorityEnsembleSwarmFired's own presence gate); absent on
   *  every other return path (legacy non-ensemble browser-authority accept, mesh-synergy,
   *  decompose, swarm-only) and on every pre-BP140 receipt. */
  ensembleCandidates?: AuthorityEnsembleCandidate[];
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
function extractChosenLetterFromAuthorityText(
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
function resolveAuthorityLetterMatch(
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
    | 'deterministic_compute_reasoning_fact';
  letter: string;
  reasoning: string;
  sourceUrl: string;
  method: string;
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
   *  whose `source === 'reasoning_fact'` -- a real, checked compute, but one whose input quantity
   *  was extracted from an authority's OWN reasoning/fact text rather than the question itself
   *  (see 'deterministic_compute_reasoning_fact' on AuthorityEnsembleCandidate's `authority` union
   *  for the full rationale). PRIOR behavior (BP-COMPUTE-HONEST-DEMOTE) pushed this into
   *  `candidates` as an ordinary voting entry -- but that entry is a DERIVED RESTATEMENT of
   *  whichever authority's text it was pulled from, so it always shares that authority's letter,
   *  and letting it into `candidates` meant the same voice silently counted twice toward a 2+
   *  "agree" (live receipt: candidates==[user_perplexity, deterministic_compute_reasoning_fact],
   *  the second derived FROM the first -- the ensemble read it as independent corroboration when
   *  it was an echo). THIS field is the fix: the reasoning_fact compute result is recorded HERE
   *  (never pushed into `candidates`, so it can never enter concordance/agreement/adjudication
   *  counting, and STRUCTURED_AUTHORITIES/hasStructuredCorroborator never see it either), purely
   *  so the Coroner/trace can still see a compute ran and what it produced. See the log line at
   *  its one push-site (runAuthorityEnsemble, right after the pre-branch hoist check) for the
   *  human-readable equivalent of this same receipt. */
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

/** Judge prompt for the ONE extra Perplexity call fired only when the ensemble's authorities
 *  disagree -- "if anyone found it, the judge recognizes it" per the Founder's design. Asks for
 *  the letter FIRST (same "Answer: <letter>" sentinel resolveAuthorityLetterMatch's explicit
 *  extractor already looks for) so the judge's own pick is unambiguous, never guessed from
 *  prose. Passed as the bare `question` to runBrowserAuthorityLookup (no mcOptions field) so
 *  buildBrowserAuthorityQueryUrl's bare-question branch sends this text VERBATIM -- it already
 *  contains the full question, options, and candidate breakdown, so it needs no further
 *  wrapping by buildMcAwareQueryText. */
function buildAdjudicationPromptText(
  question: string,
  options: McOption[],
  candidates: AuthorityEnsembleCandidate[],
): string {
  const optionLines = options.map((o) => `${o.letter}) ${o.text}`).join('\n');
  const candidateLines = candidates
    .map((c) => `- ${c.authority} says ${c.letter}: ${c.reasoning.slice(0, 200)}`)
    .join('\n');
  return (
    `${question.trim()}\n\nOptions:\n${optionLines}\n\n` +
    `Independent research assistants disagree on the answer to this question:\n${candidateLines}\n\n` +
    `Which option is actually correct? Reply starting with "Answer: <letter>" then a one-sentence reason.`
  );
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
        },
      };
    }
  } catch (err) {
    log(`pseudocode_trace threw (non-fatal, ensemble continues normally): ${err}`);
  }

  // ── Perplexity, WITH options embedded (unchanged mechanism from the legacy path) ──────────
  try {
    const perplexityResult = await runBrowserAuthorityLookup(
      researchQuery, { ...config, preferredAuthority: 'user_perplexity', mcOptions: mcOptionTexts }, bridge,
    );
    const resolved = perplexityResult ? resolveAuthorityLetterMatch(perplexityResult.fact, mcOptions) : null;
    if (resolved && perplexityResult) {
      candidates.push({
        authority: 'user_perplexity', letter: resolved.letter, reasoning: perplexityResult.fact,
        sourceUrl: perplexityResult.sourceUrl, method: resolved.method,
      });
    }
    log(`perplexity=${resolved ? `${resolved.letter}(${resolved.method})` : 'no-letter'}`);
  } catch (err) {
    log(`perplexity threw (non-fatal): ${err}`);
  }

  // ── Google, NOW ALSO with options embedded (BP139 fix -- was bare-question-only before) ───
  try {
    const googleResult = await runBrowserAuthorityLookup(
      researchQuery,
      { ...config, preferredAuthority: 'user_google', mcOptions: mcOptionTexts, embedOptionsForGoogle: true },
      bridge,
    );
    const resolved = googleResult ? resolveAuthorityLetterMatch(googleResult.fact, mcOptions) : null;
    if (resolved && googleResult) {
      candidates.push({
        authority: 'user_google', letter: resolved.letter, reasoning: googleResult.fact,
        sourceUrl: googleResult.sourceUrl, method: resolved.method,
      });
    }
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
      continue;
    }
    try {
      const llmResult = llmName === 'user_claude'
        ? await queryClaudeBrowserAuthority(researchQuery, mcOptionTexts, bridge)
        : llmName === 'user_chatgpt'
          ? await queryChatGptBrowserAuthority(researchQuery, mcOptionTexts, bridge)
          : await queryGeminiBrowserAuthority(researchQuery, mcOptionTexts, bridge);
      const resolved = llmResult ? resolveAuthorityLetterMatch(llmResult.fact, mcOptions) : null;
      if (resolved && llmResult) {
        candidates.push({
          authority: llmName, letter: resolved.letter, reasoning: llmResult.fact,
          sourceUrl: llmResult.sourceUrl, method: resolved.method,
        });
      }
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
    const hoistDecision = await resolveDeterministicComputeOverride(
      researchQuery, mcOptions, '', hoistReasoningTexts,
      { ollamaBaseUrl: config.ollamaBaseUrl, model: config.model, wolframAppId: process.env.WOLFRAM_APP_ID },
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
      if (det.source !== 'reasoning_fact') {
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
      // BP-ECHO-NO-VOTE: source === 'reasoning_fact' -- a real, checked compute, but its input
      // quantity was extracted from an authority's OWN reasoning/fact text (`hoistReasoningTexts`,
      // i.e. `candidates.map(c => c.reasoning)`), so it is a DERIVED RESTATEMENT of whichever
      // authority it was pulled from, not independent evidence. PRIOR behavior here (BP-COMPUTE-
      // HONEST-DEMOTE) pushed this into `candidates` as an "ordinary" voting entry -- but because
      // it always shares the letter of the authority it was extracted from, that let the SAME
      // voice count twice toward a 2+ "agree" (live receipt: candidates ended up
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
        `source=reasoning_fact (extracted from an authority's own reasoning text, not the question -- ` +
        `no independent grounding) -- recorded as a receipt ONLY, NOT pushed into the voting candidate ` +
        `list (candidates so far, unaffected: [${candidates.map((c) => `${c.authority}:${c.letter}`).join(', ') || 'none'}]).`,
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
        log(`browser/wolfram authorities already agree on ${agreeingGroupFast[0]!.letter} (structurally corroborated) -- swarm skipped (fast path).`);
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
    } else if (swarmResult.chosenLetter && swarmResult.concordance === 'CONCORDANT') {
      log(
        `[plow_mc_answerer] specialist_swarm ABSTAINS (no verified grounding: postFurnace=0, ` +
        `arbitrated over ${swarmResult.candidatesPostMiner} unverified postMiner fallback fact(s)) ` +
        `-- letter ${swarmResult.chosenLetter} not counted as corroboration.`,
      );
    }
    log(`swarm=${swarmResult.chosenLetter ? `${swarmResult.chosenLetter}(${swarmResult.concordance})` : `no-letter(${swarmResult.concordance})`}`);
  } catch (err) {
    log(`specialist swarm threw (non-fatal): ${err}`);
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
    return { chosenLetter: only.letter, corroboration, candidates, acceptedCandidates: [only], adjudicationAttempted: false, swarmFired: true, swarmReceipt, reasoningFactComputeReceipt };
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
      log(
        `swarm-augmented agreement on ${agreeingGroup[0]!.letter} ` +
        `(candidates=[${agreeingGroup.map((c) => c.authority).join(',')}]) -- ` +
        `${groupHasStructured ? 'structurally corroborated' : 'LLM-ONLY concordance (swarm yielded nothing usable to corroborate or contest it)'}, accepted.`,
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
      };
    }
    log(
      `swarm STRUCTURALLY DISAGREES with LLM-only agreement on ${agreeingGroup[0]!.letter} ` +
      `(swarm reached CONCORDANT consensus on ${swarmChosenLetterForGate} instead) -- ` +
      `declining the accept, routing to adjudication over the full candidate set.`,
    );
  }

  // Still all disagree even with the swarm folded in -- ADJUDICATE with ONE extra Perplexity
  // call, never more than one, over the FULL candidate set (browser/Wolfram + swarm).
  // "If anyone found it, the judge recognizes it."
  log(`disagreement persists among ${candidates.map((c) => `${c.authority}:${c.letter}`).join(', ')} (swarm included) -- firing adjudication`);
  try {
    const judgePrompt = buildAdjudicationPromptText(researchQuery, mcOptions, candidates);
    const judgeResult = await runBrowserAuthorityLookup(
      judgePrompt, { ...config, preferredAuthority: 'user_perplexity' }, bridge,
    );
    const judgeResolved = judgeResult ? resolveAuthorityLetterMatch(judgeResult.fact, mcOptions) : null;
    if (judgeResolved && judgeResult) {
      const judgeCandidate: AuthorityEnsembleCandidate = {
        authority: 'user_perplexity_judge', letter: judgeResolved.letter, reasoning: judgeResult.fact,
        sourceUrl: judgeResult.sourceUrl, method: judgeResolved.method,
      };
      log(`adjudicated=${judgeCandidate.letter}(${judgeCandidate.method})`);
      return {
        chosenLetter: judgeCandidate.letter,
        corroboration: 'adjudicated',
        candidates,
        acceptedCandidates: [judgeCandidate],
        adjudicationAttempted: true,
        swarmFired: true,
        swarmReceipt,
        reasoningFactComputeReceipt,
      };
    }
    log('adjudication returned no resolvable letter -- honest fall-through');
  } catch (err) {
    log(`adjudication threw (non-fatal): ${err}`);
  }

  return { chosenLetter: null, corroboration: 'disagree', candidates, acceptedCandidates: [], adjudicationAttempted: true, swarmFired: true, swarmReceipt, reasoningFactComputeReceipt };
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
}
export async function resolveDeterministicComputeOverride(
  researchQuery: string,
  mcOptions: McOption[],
  ensembleChosenLetter: string,
  reasoningTexts: string[],
  computeOpts: { ollamaBaseUrl?: string; model?: string; wolframAppId?: string } = {},
): Promise<{ finalLetter: string; overrideFired: boolean; deterministicOverride: DeterministicComputeCandidate | null }> {
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
  if (!deterministicOverride) {
    try {
      const computed = await computeAnswer(researchQueryForTiers, {
        wolframAppId: computeOpts.wolframAppId,
        ollamaBaseUrl: computeOpts.ollamaBaseUrl,
        model: computeOpts.model,
        componentFacts: reasoningTexts,
      });
      if (computed) {
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
        };
      }
    } catch (err) {
      console.warn('[plow_mc_answerer] resolveDeterministicComputeOverride: solvePseudocodeTraceProblem threw (non-fatal, ensemble letter kept):', err);
    }
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
        };
      }
    } catch (err) {
      console.warn('[plow_mc_answerer] resolveDeterministicComputeOverride: computeUnitAwareMatch (reasoning-extraction last resort) threw (non-fatal):', err);
    }
  }

  const overrideFired = !!deterministicOverride && deterministicOverride.letter !== ensembleChosenLetter;
  const finalLetter = deterministicOverride ? deterministicOverride.letter : ensembleChosenLetter;
  return { finalLetter, overrideFired, deterministicOverride };
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
      // BP-COMPUTE-HONEST-DEMOTE: `corroboration: 'deterministic_compute'` is only honest when
      // `result.source === 'question_expression'` -- the quantity came from a literal expression
      // in the QUESTION itself (or one of the four named solvers, which are equally
      // question-only). When `result.source === 'reasoning_fact'` (compute_sidecar.ts paths
      // (a)/(c): the quantity was extracted from an authority's own reasoning/fact text), the
      // unit-conversion/tolerance-match still genuinely ran -- it is not a guess -- but it has no
      // independent grounding of its own, so it earns the distinct, honest
      // 'authority_extracted_compute' label instead, which computeHonestVerification()
      // deliberately does NOT treat as a verified accept class.
      verified: true,
      sha256: '',
      timestamp: Date.now(),
      class: 'component',
      // BP-CONTAMINATION-FIX: no more `question="${researchQuery...}"` -- that was the leak.
      // `result.source` is a short generic tag ('question_expression' | 'reasoning_fact', see
      // compute_sidecar.ts), never raw question text, so this stays method-general.
      reasoning:
        `General derivation note: identify the quantity's source (source=${result.source}), unit-` +
        `convert it into each option's own unit, and accept only a single tolerance-matching ` +
        `option. Class signature: ${classSignature}.`,
      corroboration: result.source === 'reasoning_fact' ? 'authority_extracted_compute' : 'deterministic_compute',
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
        // BP138 Fix A honesty invariant: only a genuinely sourced basis earns CONCORDANT --
        // 'sole-survivor-elimination' (every other option falsified by a real sourced fact) or
        // 'verified-true-fact' (the surviving option's own foundation fact was independently
        // verified-true). Any other/absent basis alongside a non-null chosenLetter would be an
        // undisclosed pick and must NOT be reported at full confidence -- demote to PARTIAL so
        // downstream BMV/gates treat it as less certain. The per-option `tactic` field on each
        // receipt is left untouched either way for audit.
        const decomposeHasSourcedBasis =
          decomposeResult.basis === 'sole-survivor-elimination' ||
          decomposeResult.basis === 'verified-true-fact';
        const decomposeConcordance: ConcordanceClass = decomposeHasSourcedBasis ? 'CONCORDANT' : 'PARTIAL';
        const decomposeBmv = computeBmvScore(0, 0, 0, 0, decomposeConcordance, 0, decomposeLatencyMs);
        // WIRE-THE-LOOP fix parts 2+3: this is a genuinely SOLVED answer (sourced elimination or
        // a verified-true foundation fact) -- write it back + replicate it. Only on the sourced-
        // basis branch (never the undisclosed-basis PARTIAL demotion) -- an unsourced pick must
        // never be taught to the mesh as if it were a confirmed fact.
        if (decomposeHasSourcedBasis) {
          const decomposeSourceUrl = decomposeResult.receipts.find((r) => r.option === decomposeResult.chosenLetter && r.sourceUrl)?.sourceUrl
            ?? decomposeResult.receipts.find((r) => r.sourceUrl)?.sourceUrl;
          const decomposeOptionText = decomposeResult.receipts.find((r) => r.option === decomposeResult.chosenLetter)?.optionText ?? '';
          try {
            await writeAndReplicateSolvedAnswer({
              researchQuery,
              domain,
              chosenLetter: decomposeResult.chosenLetter,
              optionText: decomposeOptionText,
              reasoning: decomposeResult.traceSummary,
              sourceUrl: decomposeSourceUrl,
              authority: 'decompose-and-eliminate',
              // BP131 honesty fix: a sourced elimination/verified-true-foundation basis is a real
              // finding, but it is still ONE method's own single-threaded reasoning, not 2+
              // independent authorities agreeing -- honestly single_authority, not concordant.
              corroboration: 'single_authority',
            });
          } catch (err) {
            console.warn('[plow_mc_answerer] decompose writeback/replicate failed (non-fatal):', err);
          }
        }
        return {
          questionId,
          domain,
          chosenLetter: decomposeResult.chosenLetter,
          voterLetters: [decomposeResult.chosenLetter],
          voterDiagnostics: [{
            temperature: 0,
            status: 'parsed_ok',
            responseChars: decomposeResult.traceSummary.length,
            rawPreview: `decompose-and-eliminate: ${decomposeResult.traceSummary.slice(0, 200)}`,
          }],
          concordance: decomposeConcordance,
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
  if (decomposeOn && !deferDecomposeToEnsembleFallback) {
    const decomposeEarlyResult = await attemptDecomposeAndEliminate();
    if (decomposeEarlyResult) return decomposeEarlyResult;
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
        const ensembleOutcome = await runAuthorityEnsemble({
          researchQuery,
          mcOptions: mcOptionsForBrowserAuthority,
          mcOptionTexts: mcOptionTextsForQuery,
          config,
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
          const decision = await resolveDeterministicComputeOverride(
            researchQuery, mcOptionsForBrowserAuthority, ensembleOutcome.chosenLetter, overrideReasoningTexts,
            { ollamaBaseUrl, model, wolframAppId: process.env.WOLFRAM_APP_ID },
          );
          deterministicOverride = decision.deterministicOverride;
          overrideFired = decision.overrideFired;
          finalChosenLetter = decision.finalLetter;
          // BP-COMPUTE-DEMOTE-SITE-2 (Bishop-ratified, same rule as the pre-branch hoist site):
          // this POST-branch override can still carry `source === 'reasoning_fact'` here (the
          // quantity was extracted from an authority's own reasoning text, not the question or a
          // named solver) -- unlike the non-reasoning_fact sources (question_expression /
          // schedule_solver / density_solver / physics_solver / aircraft_solver), which are the
          // genuine deterministic floor and keep their veto UNCHANGED below, a reasoning_fact
          // result has no independent grounding and must not be allowed to overturn a settled
          // ensemble consensus. Declined here BEFORE the finalChosenLetter it would otherwise have
          // produced (decision.finalLetter) is allowed to stick, by reverting finalChosenLetter to
          // the ensemble's own letter and forcing overrideFired false -- every downstream field
          // gated on `overrideFired && deterministicOverride` (the eblet writeback's
          // reasoning/authority/sourceUrl/corroboration, traceSummary, provenanceReceipts) then
          // honestly falls back to its own no-override path, i.e. the ensemble's genuine
          // accepted-candidate authority/reasoning/sourceUrl, exactly as if no compute had run.
          // `deterministicOverride` itself is left populated (not nulled) so nothing downstream
          // that merely reads its fields (none do outside the overrideFired-gated branches today)
          // is surprised by a null -- the compute's own result is still visible right here in this
          // log line, it simply loses its veto.
          if (overrideFired && deterministicOverride && deterministicOverride.source === 'reasoning_fact') {
            console.log(
              `[plow_mc_answerer] authority_extracted_compute declined to override settled ` +
              `ensemble answer ${ensembleOutcome.chosenLetter} (source=reasoning_fact, no ` +
              `independent grounding) -- ensemble result stands.`,
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
        }
        // BP-COMPUTE-HONEST-DEMOTE: the ONE place this override's honesty label is decided,
        // reused for both the `authority` provenance string and the `corroboration` field below
        // (writeAndReplicateSolvedAnswer / writeComputeMethodEblet / mintFormulaEbletFromCompute
        // all read `deterministicOverride.source`/`.method` directly, so they self-adjust; this
        // const only covers the two string literals built inline at this call site). Neither the
        // pre-branch hoist path (ensembleOutcome.corroboration === 'deterministic_compute_override')
        // nor the post-branch override above can reach `overrideFired && deterministicOverride`
        // with source==='reasoning_fact' any more (BP-COMPUTE-DEMOTE-SITE-2 declines it before
        // overrideFired is ever set true for that case) -- so this const can still evaluate true
        // for a reasoning_fact result, but every consumer below is itself gated on
        // `overrideFired && deterministicOverride`, which is false in that case, so the label is
        // computed but never actually used to describe an override that didn't happen.
        const overrideIsAuthorityExtracted = !!deterministicOverride && deterministicOverride.source === 'reasoning_fact';
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
            // BP140 Yoke: the full candidate set (winner AND losers), for the Coroner's
            // per-candidate factVerdict persist -- see CanonicalPlowMcResult.ensembleCandidates.
            ensembleCandidates: ensembleOutcome.candidates,
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
  if (deferDecomposeToEnsembleFallback && decomposeOn) {
    const decomposeFallbackResult = await attemptDecomposeAndEliminate();
    if (decomposeFallbackResult) return decomposeFallbackResult;
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
        const unitEbletWritten = await writeComputeMethodEblet({ researchQuery, result: unitAware });
        // BP141 (this Yoke): additionally shelve the reusable formula/tool for this method
        // (dedup'd, one per method) -- independent of, and never blocking, the write above.
        await mintFormulaEbletFromCompute(unitAware);
        const unitLatencyMs = Date.now() - startMs;
        const unitConcordance: ConcordanceClass = 'CONCORDANT';
        const unitBmv = computeBmvScore(1, 1, 1, 0, unitConcordance, 1, unitLatencyMs);
        // BP-COMPUTE-HONEST-DEMOTE: this legacy (non-ensemble, Stage A.3) compute-sidecar path
        // still returns `unitAware.letter` directly on any match, regardless of source -- that
        // early-return behavior is UNCHANGED this pass (out of scope, flagged for Bishop below).
        // The one thing fixed here is the receipt's own `verified` claim: a reasoning_fact-sourced
        // match (unitAware.source, see compute_sidecar.ts paths (a)/(c)) is a real, checked
        // computation but has no independent grounding, so it must not claim `verified: true`.
        const unitReceipt: ProvenanceReceipt = {
          source: `${unitAware.source === 'reasoning_fact' ? 'authority_extracted_compute' : 'deterministic_compute'}:${unitAware.method}`,
          contentHash: createHash('sha256')
            .update(`${unitAware.sourceExpression}=${unitAware.computedValue}${unitAware.computedUnit ?? ''}`)
            .digest('hex')
            .slice(0, 16),
          verified: unitAware.source !== 'reasoning_fact',
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
  const browserAuthorityTrace = browserAuthorityAttempted
    ? ` browserAuthorityFirst=true corroboration=${browserAuthorityCorroboration} ` +
      `googleFact=${browserGoogleResult ? 'yes' : 'no'} perplexityFact=${browserPerplexityResult ? 'yes' : 'no'} ` +
      `injectedAsTopFacts=${browserFactCandidates.length}`
    : '';
  const traceSummary =
    `specialists=[${specialistsUsed.join(',')}] raw=${candidatesRaw} postMiner=${postMiner.length} ` +
    `postFurnace=${postFurnace.length} voters=[${voterLetters.map((l) => l ?? '-').join(',')}] ` +
    `voterStatus=[${voterDiagnostics.map((v) => v.status).join(',')}] ` +
    `concordance=${concordance} bmv=${bmvScore} andonRetries=${andonRetry} latencyGateAdvisoryOnly=true` +
    `${relevanceGateMethodTrace}${psionicMarkerTrace}${browserAuthorityTrace}`;

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

export interface PlowMcAnswererCallResult {
  /** null = genuine no-answer (DISCORDANT or all-voters-empty, or a plow crash) -- the caller
   *  must preserve this distinction rather than coercing null to a guessed letter, same
   *  Truth-Always doctrine as CanonicalPlowMcResult.chosenLetter itself. */
  answer: string | null;
  plowTrace: Record<string, unknown>;
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
    const plowTrace: Record<string, unknown> = {
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
    };
    console.log(`[${logLabel}] plow-answered letter=${answer ?? 'NONE'} ${plowResult.traceSummary}`);
    return { answer, plowTrace };
  } catch (plowErr) {
    // Truth-Always: a plow crash must surface as an honest abstain, never silently fall back
    // to single-shot and misreport itself as a plow answer.
    console.error(`[${logLabel}] plow-answerer error:`, plowErr);
    return { answer: null, plowTrace: { error: String(plowErr) } };
  }
}
