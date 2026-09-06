// method_registry.ts -- D-BP149-041/BISHOP/S41/seg-methodregistry
//
// THE METHOD REGISTRY. Ratified canon:
//   Asteroid-ProofVault/state/eblets/CANON/
//     canon_the_liana_cycle_is_a_method_registry_taught_by_humans_bp149.eblet.md
// Founder, BP149, verbatim: "put this engine behind the terminal, so I just type the
// question... exactly. Because that is the basis of the Liana Cycle -- where we then do the
// next question -- qid 85, using the other method I used to solve it... I guide, I train, I
// give the Human Nuance, and you record (through Mnemosynec) and learn and apply... the POINT
// is that that won't cover EVERY question. But I will. And so will other human operators,
// which will teach the Substrate in the Cooperative."
//
// THE RULING THIS FILE IMPLEMENTS (five points, canon section "THE ARCHITECTURE THIS
// REQUIRES"):
//   1. Methods are named, recorded objects -- not branches inside one function. Each entry
//      below is data (id/name/taughtBy) plus two functions (shapeTest, run), never a case
//      label in a switch.
//   2. The terminal SELECTS, it never guesses. selectMethod() runs every registered method's
//      shapeTest() and returns the first one that matches. If none match, it returns null and
//      the caller (liana_terminal_engine.ts) must say so plainly rather than running anything.
//   3. An unmatched question is a teaching prompt, not a failure -- see
//      liana_terminal_engine.ts's no-match transcript text.
//   4. The human is the generator. Nothing in this file invents a new method; every entry here
//      was taught by a human operator working a real case by hand (see each method's
//      `taughtBy` field for the citation).
//   5. Methods accumulate across operators -- this registry is the single append point. A
//      method taught once (registered here) is available to every future question of that
//      shape, for every operator.
//
// A method may be REGISTERED with no RUNNER (`run: null`) -- that is deliberate, not a bug.
// METHOD 2 ("definitional-cascade") ships this way in this ticket: its shape is known (the
// Founder's qid 85 walkthrough taught it), but its stages are not yet built. The registry must
// be able to hold a known-but-unimplemented method so the terminal can say "this is a
// recognized shape, not yet taught" instead of the less honest "no method matches" -- those are
// different findings and the transcript must not conflate them.

import type { LianaTerminalEvent, LianaTerminalOutcome } from '../../shared/liana_cycle/liana_terminal_types';
import type { BrowserAuthorityRawExtraction } from '../../shared/plow/browser_authority_types';
import type { LianaDemand } from './demand_test';
// D-BP152-049 STAGE 4/4 -- see this file's own STAGE 4/4 section, below explainSelection(), for
// why these three additional imports now live here (they were library/method_registry.ts's own,
// moved verbatim as part of the registry unification).
import { formatMethodId, parseMethodId } from './library/method_identity';
import type { MethodIdentity } from './library/method_identity';
import type { StepDeclaration } from './library/step_declaration';
import { listOrphanSteps } from './library/orphan_catalog';

export type { LianaDemand };

// Defined HERE (not in liana_terminal_engine.ts) so this file and every method module can
// import it with no dependency on the engine module -- the engine imports methods, so a method
// importing a type back from the engine would be a circular import. liana_terminal_engine.ts
// re-exports this same type so index.ts's existing `AskGoogleFn`-shaped closure (unchanged by
// this ticket) still type-checks against exactly one definition.
export type AskGoogleFn = (question: string) => Promise<BrowserAuthorityRawExtraction | null>;

export type EmitFn = (event: LianaTerminalEvent) => void;

/** D-BP152-044/BISHOP/seg-last-mile-gemini, ADDITIVE. Founder, BP152, verbatim ruling: "fix the
 *  last mile - let the liana cycle ask gemini". What a conversational-authority call (Gemini, via
 *  the machine-driven Nexus path, D-BP152-033 -- `runMachineDrivenNexusQueryFromMain`, index.ts)
 *  returns to a caller that chose to try it. Deliberately NOT `BrowserAuthorityRawExtraction`
 *  (`AskGoogleFn`'s own return shape, above): this is consumed directly by survey_stage.ts's
 *  askAmbiguity()/askOperation(), never routed through `googleBlocks()` (methods/
 *  comparative_cascade.ts, FORBIDDEN to modify) -- that function's own 3-try/backoff retry loop is
 *  tuned for a flaky Google fetch, not for "the operator is looking at the window" or "the window
 *  isn't open", which should fall back to Google immediately, not retry the same refusal 3 times.
 *  `ok: false` covers EVERY non-answer case alike (window unavailable, operator visibly using it,
 *  ceiling reached with no text, any other machine-driven failure) -- the caller (survey_stage.ts)
 *  treats every `ok: false` identically: fall back to the existing Google path. `via` and
 *  `authority` are diagnostic only (Law 5, HARDWIRE-23: the receipt names which surface answered),
 *  never load-bearing for control flow. */
export interface ConversationalAuthorityResult {
  ok: boolean;
  text: string;
  citations: string[];
  via: string;
  authority: string;
}

/** D-BP152-044, ADDITIVE. One conversational-authority query: the FOUNDER'S OWN QUESTION TEXT
 *  VERBATIM in (HARDWIRE-22 still binds -- this asks a source his question, exactly as his browser
 *  did, never a rate/judge/decide prompt), a real answer or an honest refusal out. Never a second
 *  askGoogle-shaped channel -- see ConversationalAuthorityResult's own header for why the return
 *  shape differs from AskGoogleFn.
 *
 *  D-BP154-014, ADDITIVE/OPTIONAL: `mcOptions`, same "L) option text" shape
 *  comparative_cascade.ts's own `list()` / browser_authority_types.ts's `buildMcAwareQueryText`
 *  already produce. Undefined on every pre-existing call site (byte-identical behavior --
 *  `buildAskConversationalAuthority()`'s own existing closure, index.ts, ignores a 2nd arg it
 *  does not read). MEASURED live this ticket: webview_preload.ts's capture-hop gate
 *  (`mentionsAnyOption`, option_membership.ts/D-BP154-010) already exists and already fires on
 *  the INTERACTIVE-QUERY IPC payload's own `mcOptions` field -- but `buildAskConversationalAuthority`
 *  never had a way to SUPPLY it (this type took only `question`), so the gate was silently a
 *  no-op for every Composer-step conversational call: a captured passage of pure Gemini UI chrome
 *  ("Thinking... Your lianabanyan.com chats aren't used to improve our models...") passed straight
 *  through as `ok:true`, live-verified 2026-08-14 (CDP body-text read of the same conversation
 *  showed Gemini's real, correct answer had in fact rendered -- the capture just was never gated
 *  on mentioning an option, so a chrome string sitting elsewhere on the page was accepted first).
 *  Passing `mcOptions` here is what lets that ALREADY-BUILT gate actually run for this caller. */
export type ConversationalAuthorityFn = (question: string, mcOptions?: string[]) => Promise<ConversationalAuthorityResult>;

/** What every method's shapeTest() and run() receive. `options` is null for a free-text
 *  question typed with no lettered option list -- most methods (which eliminate AMONG options)
 *  will correctly refuse to match that shape; a future free-text-only method could still match
 *  on `options === null`. `correctAnswer` is present only when the input resolved to a bundled
 *  qid (loadQuestion() found it); a Founder-typed free-text question with typed options has no
 *  known key, and outcomes built from it simply omit `correct`/`ok`. */
export interface MethodQuestionInput {
  qid?: number;
  question: string;
  options: Record<string, string> | null;
  correctAnswer?: string;
  /** D-BP154-030/BISHOP-SEG/S30/seg-humannuance, ADDITIVE/OPTIONAL -- undefined on every
   *  pre-existing MethodQuestionInput construction site, so every existing caller keeps compiling
   *  and behaving identically. The bundled corpus row's own stated `origin_src` field (e.g.
   *  "ori_mmlu-high_school_geography"), backfilled offline by scripts/backfill_mmlu_pro_origin_src.mjs
   *  -- see that script's header and resources/mmlu_pro_bundled/origin_provenance/ for the full
   *  provenance record this is only a fast pointer into (Law 9: the index is not the thing it
   *  indexes). Present only for the standing-20 campaign qids that pass has enriched; absent for
   *  every other question (free-text input, or a bundled qid not yet backfilled) -- absence is
   *  read as "artifact class not established", never guessed. Only human_nuance_step.ts reads
   *  this field; every other step ignores it unchanged. NEVER the `answer`/`answer_index` field --
   *  those are not present on BundledQuestion at all (D-BP153-003, runtime stays blind). */
  originSrc?: string;
  /** D-BP154-041/BISHOP-SEG/S41/seg-purpose, ADDITIVE/OPTIONAL -- same discipline as `originSrc`
   *  just above: undefined on every pre-existing construction site. The bundled corpus row's own
   *  stated `category` field (liana_terminal_engine.ts's BundledQuestion.category), threaded
   *  through ParsedInput.category unchanged. Only purpose_step.ts reads this field. */
  category?: string;
}

export interface ShapeTestResult {
  matches: boolean;
  /** ALWAYS present, matched or not -- this is what the transcript prints for every method it
   *  checked (BP149: "I DESPISE SUMMARIES", stream everything). A bare boolean tells the
   *  Founder nothing about WHY a method was skipped. */
  reason: string;
}

/** D-BP153-016, FIX 1 -- THE FOUNDER'S RULING (FD-BP153-07): "type the passages." Before this
 *  ticket `MethodRunContext.ownedPassages` returned bare `string[]`, and the live 2026-08-12T20:39Z
 *  run pointed classify_cascade.ts's extractors at the AMBIGUITY passage -- acquired to answer
 *  "what is ambiguous here", by construction full of counterfactuals -- and mined a counterfactual
 *  clause as an assertion (Amazon Rainforest, "the world's most densely populated regions"). A bare
 *  string carries no signal of WHICH QUESTION a passage was acquired to answer, so nothing could
 *  refuse it structurally.
 *
 *  `kind` names that question, truthfully, at the point the passage is banked (today:
 *  liana_terminal_engine.ts, where `baseCtx` is built from Survey's own step2 results) -- 'ambiguity'
 *  for the ambiguity meta-question's own passage, 'operation' for the operation meta-question's own
 *  passage. `sourceQuery` is the literal query text this passage answers, when the caller has it
 *  (Survey's own `askedText`), carried through for audit -- optional because not every future
 *  producer of an owned passage will have a clean single query string to hand back.
 *
 *  D-BP154-008, ADDITIVE/OPTIONAL -- THE MORTGAGE. FD-BP153-04 boundary 4 ("owned means acquired
 *  THIS RUN, for now... reaching across acquisitions is not authorized by this ruling") is LIFTED
 *  by TICKET_D-BP154-008_THE_MORTGAGE.md, per FD-BP153-03 ("we don't pay rent on answers, we pay
 *  the mortgage to own them") -- see cross_acquisition.ts's own header for the full ruling this
 *  authorizes and the provenance price it names. `acquisitionId`/`acquiredAt`/`ageMsAtUse` are
 *  present ONLY when a passage was reused from a PRIOR acquisition on disk rather than fetched
 *  live this run; absent (undefined) on every passage acquired live, this run, exactly as every
 *  OwnedPassage before this ticket -- an absent field is never a fabricated "this run" claim, it
 *  is simply the pre-existing shape for a live passage. `ageMsAtUse` is reported, never compared
 *  to a cutoff anywhere in this estate: this ticket authorizes reaching across acquisitions, not a
 *  staleness/TTL/expiry policy, which remains an unauthorized, undecided Founder ruling. */
export interface OwnedPassage {
  text: string;
  kind: string;
  sourceQuery?: string;
  /** D-BP154-008, ADDITIVE/OPTIONAL. The acquisition this passage was reused from, when it was NOT
   *  acquired live this run. See this interface's own D-BP154-008 paragraph, above. */
  acquisitionId?: string;
  /** D-BP154-008, ADDITIVE/OPTIONAL. That acquisition's own wall-clock (ISO 8601 UTC), i.e. when
   *  the reused passage was ORIGINALLY acquired -- not when it was reused. */
  acquiredAt?: string;
  /** D-BP154-008, ADDITIVE/OPTIONAL. Age of the reused passage, milliseconds, AT THE MOMENT this
   *  run looked it up (now - acquiredAt). Mechanical and answer-independent; never a cutoff. */
  ageMsAtUse?: number;
}

export interface MethodRunContext {
  askGoogle: AskGoogleFn;
  emit: EmitFn;
  /** D-BP152-044, ADDITIVE/OPTIONAL -- undefined on every pre-existing MethodRunContext
   *  construction site (`{ askGoogle, emit }`, byte-identical elsewhere in this estate), so every
   *  existing caller keeps compiling and behaving identically. Only survey_stage.ts's
   *  askAmbiguity()/askOperation() (the Founder's own two META-questions -- "what words or phrases
   *  in this question could be understood with a different meaning", "what operation does this
   *  question require") ever read this field, and only try it BEFORE falling back to `askGoogle`
   *  for those two queries specifically -- every other Survey/method query (denotation surveys,
   *  constraint/threshold questions, the cascades) keeps going to Google exactly as before,
   *  because nothing else in this estate reads this field. */
  askConversationalAuthority?: ConversationalAuthorityFn;
  /** FD-BP153-04, ADDITIVE/OPTIONAL -- undefined on every pre-existing MethodRunContext
   *  construction site (`{ askGoogle, emit }`, byte-identical elsewhere in this estate, same
   *  pattern D-BP152-044's `askConversationalAuthority` above already established), so every
   *  existing caller keeps compiling and behaving identically.
   *
   *  THE FOUNDER'S RULING, BP153, verbatim: "Before a step issues a new query, it must first try
   *  to answer that query by EXTRACTING from passages this run has already acquired. A new query
   *  is spent only when the owned evidence does not contain the answer." Measured live, qid 98,
   *  2026-08-12T16:04Z: the OPERATION query's own passage already stated the frame partition a
   *  later step spent 62 more queries to re-derive, because nothing asked what this run already
   *  had in hand before asking Google again.
   *
   *  When present, calling it returns the raw text of every passage THIS RUN has already fetched
   *  (today: Survey's ambiguity/operation passages -- survey_stage.ts's own INSTRUMENT-ONLY
   *  `rawGooglePassage` fields, D-BP152-004/005, unmodified -- populated by
   *  liana_terminal_engine.ts where `baseCtx` is built, immediately after Survey returns). Non-
   *  empty strings only; an empty array means nothing has been acquired yet, never a fabricated
   *  placeholder.
   *
   *  D-BP154-008, BOUNDARY 4 LIFTED -- "OWNED MEANS THIS RUN ONLY" (the sentence that stood here
   *  before this ticket: "never the evidence store on disk, never a prior acquisition; a caller
   *  must not reach across acquisitions to populate this") is NO LONGER the rule. Founder ruling
   *  FD-BP153-03 ("we don't pay rent on answers, we pay the mortgage to own them"), applied by
   *  TICKET_D-BP154-008_THE_MORTGAGE.md: liana_terminal_engine.ts's own `ownedPassages()` builder
   *  now ALSO appends passages reused from PRIOR acquisitions on disk for the SAME two named
   *  questions (ambiguity, operation), via cross_acquisition.ts's `buildPriorAcquisitionOwnedPassages()`
   *  -- see that file's own header for the exact-query-text matching rule and the provenance this
   *  authorization is priced at. A reused entry is marked, never silently indistinguishable from a
   *  live one: `OwnedPassage.acquisitionId` (this interface, above) is set on it and absent on
   *  every live-this-run entry. Still ADDITIVE ONLY: this run's own live passages are always pushed
   *  first by liana_terminal_engine.ts's builder, so every existing owned-passage loop below tries
   *  a live, this-run answer before a reused one -- reaching across acquisitions only ever adds a
   *  candidate, never displaces this run's own.
   *
   *  classify_cascade.ts's establishFrame(), extractNamedSetMembers(), and runDiscriminator() read
   *  this field (D-BP153-04, extended D-BP153-016). Every other Survey/method query keeps going to
   *  Google exactly as before, because nothing else in this estate reads this field.
   *
   *  D-BP153-016, FIX 1, TYPED: returns `OwnedPassage[]` (text + kind + optional sourceQuery), not
   *  bare `string[]` -- see OwnedPassage's own doc comment, just above, for why. */
  ownedPassages?: () => OwnedPassage[];
  /** D-BP154-017, ADDITIVE/OPTIONAL -- undefined on every pre-existing MethodRunContext
   *  construction site (`{ askGoogle, emit }` and its variants elsewhere in this estate), so every
   *  existing caller keeps compiling and behaving identically. Only script_bridge.ts's
   *  runComposedStack() sets it (from runScratchComposer()'s own `currentAcquisitionId`
   *  parameter, THE PAIL's evidenceSession.acquisitionId, D-BP154-010) -- the same acquisition id
   *  that already tags every EvidenceRecord this run writes. A Composer step reads it only to tag
   *  its OWN persisted classification record (composer_claims_store.ts) with the acquisition it
   *  belongs to, never as a decision input. */
  acquisitionId?: string;
  /** D-BP154-044/BISHOP-SEG/S44/seg-acquire, ADDITIVE/OPTIONAL -- undefined on every pre-existing
   *  MethodRunContext construction site, so every existing caller keeps compiling and behaving
   *  identically. FD-BP154-19: "you can use claude or perplexity as facts gathering" -- widens
   *  ACQUISITION (never corroboration, which stays document-only, FD-BP154-02/03) to any of the
   *  five signed-in authorities, named explicitly rather than always defaulting to Gemini
   *  (`askConversationalAuthority`, above, is UNCHANGED and remains what every pre-existing step
   *  uses). Only magnitude_step.ts's attemptFrozenDensitySource() (D-BP154-044) reads this field.
   *  Built the SAME way as `askConversationalAuthority` -- through THE PAIL's own recording
   *  wrapper (index.ts's 'liana-script-run' handler), so a query issued through this field lands
   *  in the evidence store exactly like every other query, query verbatim, span, mechanism tag,
   *  timestamp -- never an out-of-band fetch. */
  askConversationalAuthorityAs?: (
    authority: 'user_gemini' | 'user_perplexity' | 'user_claude' | 'user_google' | 'user_chatgpt',
    question: string,
    mcOptions?: string[],
  ) => Promise<ConversationalAuthorityResult>;
  /** D-BP164-M0-122/BISHOP-SEG-SILO, ADDITIVE/OPTIONAL -- undefined on every pre-existing
   *  MethodRunContext construction site (`{ askGoogle, emit }` and every variant elsewhere in
   *  this estate), so every existing caller keeps compiling and behaving identically. Behind
   *  LIANA_CONNECTOR_SILO_ENABLED='1' (default OFF) -- see liana_terminal_engine.ts's own
   *  isConnectorSiloEnabled(). When present, returns the two-step CONNECTOR celpanes
   *  (connector_celpane.ts's own MintOutcome, one per {kind, askedText} pair `ownedPassages()`
   *  already tries via full-text reuse) alongside the full-text `ownedPassages()` array above --
   *  ADDITIVE, never a replacement. A method MAY call fetchConnectorCelpaneFullText(celpane)
   *  itself if its own logic decides the detail behind a celpane is needed; nothing in this
   *  estate calls this field yet. This is plumbing only, not an automatic selection condition --
   *  FD-BP164-08 STEP 4 (the gating condition for when a fresh question surveys/selects
   *  automatically) remains reserved and is NOT decided by this field's mere presence. */
  ownedConnectors?: () => import('./evidence/connector_celpane').MintOutcome[];
  /** D-BP164-M0-126/BISHOP-SEG-WIDEN, ADDITIVE/OPTIONAL -- undefined on every pre-existing
   *  MethodRunContext construction site, so every existing caller keeps compiling and behaving
   *  identically. Same convention as `ownedConnectors` immediately above, but keyed by DEMAND TAG
   *  (method_silo.ts's own LianaDemand partition) rather than by qid -- Founder's own order, this
   *  ticket: "it's only a Silo by Tag - so ALL text queries will be allocated and tagged and
   *  categorized." `ownedConnectors` above reuses THIS RUN'S prior-acquisition evidence, which
   *  genuinely requires a qid to relocate; this field instead asks the durable METHOD_SILO
   *  (facts/methods/algorithms, never answers -- method_silo.ts's own no-answer guarantee) for
   *  whatever has been deposited under the demand tag this run resolved, which needs no qid at
   *  all and therefore works identically for a bundled qid or free text. Behind
   *  LIANA_CONNECTOR_SILO_ENABLED='1' (default OFF, same isConnectorSiloEnabled() gate
   *  `ownedConnectors` uses). `null` means either the flag-gated mint was never attempted (no
   *  demand tag resolved this run) or it was attempted and found nothing (a correct, honest empty
   *  result, not an error -- see method_silo.ts's own mintSiloCelpane() header); a caller cannot
   *  distinguish those two from this field alone and must not need to, since both mean "nothing to
   *  read here". This is plumbing only, not an automatic selection condition -- FD-BP164-08 STEP 4
   *  remains reserved and is NOT decided by this field's mere presence. Nothing in this estate
   *  calls this field yet. */
  ownedSilo?: () => import('./evidence/method_silo').SiloMintOutcome | null;
}

export interface LianaMethod {
  /** Stable, lowercase-hyphenated id. Never reused for a different method once registered. */
  id: string;
  /** D-BP150-003 -- THE OPERATION THIS METHOD PERFORMS. Canon R-3: every method DECLARES the
   *  demand it serves, and canon R-4: a method whose declared demand does not match the question's
   *  demand MUST NOT RUN, even if its shape heuristics would have passed. This is the enforceable
   *  form of the Founder's "so we DON'T use it wrongly". See
   *  canon_the_demand_test_selects_by_operation_not_by_regex_bp150. */
  demand: LianaDemand;
  /** Human-readable name for the transcript. */
  name: string;
  /** The case that taught this method, cited plainly -- canon rule 4 above. */
  taughtBy: string;
  /** One-line description of the shape this method answers, for the "no method matches"
   *  listing (must be readable without opening this file). */
  shapeDescription: string;
  /** Pure function: does this method's shape fit this question? Must not perform any I/O --
   *  shape testing is a pre-flight check the registry runs for EVERY method on EVERY question,
   *  and doing network/model calls here would mean paying for a query before knowing whether
   *  it's even the right method. */
  shapeTest: (input: MethodQuestionInput) => ShapeTestResult;
  /** null = registered but not yet taught (a stub). The registry allows this on purpose; see
   *  this file's header. Never call run() without checking it is non-null first. */
  run: ((input: MethodQuestionInput, ctx: MethodRunContext) => Promise<LianaTerminalOutcome>) | null;
  /** D-BP220-BM0-006/BISHOP-SEG, ADDITIVE/OPTIONAL, 2026-09-05 -- undefined (falsy) on every
   *  pre-existing LianaMethod object, so every existing method keeps compiling and behaving
   *  identically. QUARANTINE FENCE: when true, this method's shapeTest() may still fire (shape
   *  matching is measurement, not trust), but it must NEVER be selected to actually RUN by
   *  selectMethod()/selectEligibleMethods() below -- see those functions' own quarantine check,
   *  added the same dispatch, and each quarantined method's own file header for the measured
   *  reason (first quarantined method: methods/set_equivalence_match.ts, 2026-09-05 -- its
   *  shapeTest() never reads the question stem, so its 273/12,032 measured coverage is
   *  accidental breadth, and 50 of those 273 would suppress the keyed correct answer if taught).
   *  A method's own `run`, when quarantined, should ALSO refuse loudly if called directly
   *  (defense in depth against a caller that bypasses selectMethod/selectEligibleMethods) -- that
   *  refusal is the quarantined method's own responsibility, this flag only gates SELECTION. */
  quarantined?: boolean;
  /** D-BP220-BM0-006/BISHOP-SEG, ADDITIVE/OPTIONAL, 2026-09-05 -- undefined on every pre-existing
   *  LianaMethod object. The full, human-readable reason a quarantined method is fenced, quoted
   *  verbatim from that method's own exported reason constant (e.g.
   *  SET_EQUIVALENCE_MATCH_QUARANTINE_REASON) so explainSelection() below can print it without
   *  importing every method module's own constant by name. Present only when `quarantined` is
   *  true; absent otherwise. */
  quarantineReason?: string;
}

/** Average option length in words -- the one cheap, generic signal every shapeTest() below uses
 *  to tell "options are short members of one category" (comparative shape, e.g. region names)
 *  apart from "options are full competing statements" (definitional shape, e.g. "It describes a
 *  process that..."). Calibrated against the six real BP149 questions in the canon's own
 *  comparison table (qid 98 comparative avg ~2.0 words/option; qid 85 definitional avg ~11
 *  words/option; qid 92/72/66/46 -- neither shape -- fall in between and are additionally
 *  screened out by each method's own cue-word test). Exported so both methods (and any future
 *  ones) share one measurement instead of each re-deriving it slightly differently. */
export function avgOptionWordCount(options: Record<string, string>): number {
  const texts = Object.values(options);
  if (!texts.length) return 0;
  const total = texts.reduce((sum, t) => sum + t.trim().split(/\s+/).filter(Boolean).length, 0);
  return total / texts.length;
}

const REGISTRY: LianaMethod[] = [];

/** Append-only. Called once per method module at import time (see comparative_cascade.ts /
 *  definitional_cascade.ts's bottom-of-file registerMethod() call, and
 *  liana_terminal_engine.ts's import of both). Registering the same id twice is a programming
 *  error, not a runtime condition to handle gracefully -- it throws immediately so it is caught
 *  at build/first-run time, not silently shadowed. */
export function registerMethod(method: LianaMethod): void {
  if (REGISTRY.some((m) => m.id === method.id)) {
    throw new Error(`method_registry: duplicate method id "${method.id}" -- ids must be unique`);
  }
  REGISTRY.push(method);
}

export function listMethods(): LianaMethod[] {
  return REGISTRY.slice();
}

/** Runs every registered method's shapeTest() in registration order and returns the FIRST
 *  match, plus that match's own ShapeTestResult (so the caller can print the reason without
 *  re-running the test). Returns null when nothing matches -- the caller (
 *  liana_terminal_engine.ts) must treat that as "ask the human", never as license to run the
 *  first method anyway. This function itself performs no I/O (shapeTest() contracts are pure),
 *  so calling it to print a full per-method report costs nothing. */
export function selectMethod(
  input: MethodQuestionInput,
  /** D-BP150-003. The question's DEMAND, determined once by the caller (so the transcript can
   *  print it) and passed in. `null` means it could not be determined -- and per canon R-4/R-5
   *  that means NO METHOD MAY RUN. A question whose operation is unknown is a teaching prompt; a
   *  method run against an unknown operation is exactly the "used wrongly" case this guards.
   *  OPTIONAL so a pre-demand caller keeps compiling; omitting it skips the demand gate entirely
   *  and restores the old shape-only behavior. */
  demand?: LianaDemand | null,
): { method: LianaMethod; shape: ShapeTestResult } | null {
  const demandGated = demand !== undefined;
  for (const method of REGISTRY) {
    // D-BP220-BM0-006, 2026-09-05 -- QUARANTINE GATE, checked FIRST (cheapest, most decisive: a
    // quarantined method must never be selected to run, regardless of demand or shape). See
    // LianaMethod['quarantined'] above for what setting this true means and the first method
    // (set_equivalence_match.ts) it was added for.
    if (method.quarantined) continue;
    // R-6: demand PRECEDES shape. Shape asks "can this machinery operate on this option set";
    // demand asks "is this method's operation the one the question wants". Both must pass, and
    // demand is checked first because it is the cheaper and more decisive of the two.
    if (demandGated && method.demand !== demand) continue;
    const shape = method.shapeTest(input);
    if (shape.matches) return { method, shape };
  }
  return null;
}

/** D-BP165-M0-006/BISHOP-SEG/seg-fallthrough-on-abstain -- RULING 1 (Founder, BP165, verbatim:
 *  "1. yes", answering "does compute-gemma-cascade get a turn when a cheaper method claims and
 *  then abstains?"). Runs every registered method's shapeTest() in registration order and returns
 *  EVERY match, in order, each paired with its own ShapeTestResult -- unlike selectMethod() just
 *  above, which stops and returns only the FIRST match. Same demand-gating rule (R-6: demand
 *  precedes shape) and the same `demand` convention as selectMethod() (omitting it skips the
 *  demand gate entirely). Performs no I/O, exactly like selectMethod() -- every shapeTest()
 *  contract is pure, so calling this instead costs nothing extra.
 *
 *  WHY THIS EXISTS: the measured BP164 defect (item 2642, terminal.ts) was `arithmetic-cascade`
 *  and `compute-gemma-cascade` both reporting ELIGIBLE for the same question; `arithmetic-cascade`
 *  won on registration order, then abstained INSIDE its own run() (not in shapeTest()) --
 *  selectMethod()'s "first match wins" contract has no way to express "try the next one instead",
 *  because it only ever looks at shapeTest(), never at what run() actually does. This function is
 *  the plumbing the caller (liana_terminal_engine.ts) needs to try the next eligible method when
 *  that happens; it makes no decision about WHEN to fall through itself -- see the engine's own
 *  fallthrough loop for that.
 *
 *  ADDITIVE ONLY: registration order still decides who is tried FIRST (REGISTRY itself is never
 *  reordered by this function); selectMethod() itself, its signature, and its return shape are
 *  completely UNCHANGED -- every existing call site of selectMethod() keeps compiling and
 *  behaving identically. */
export function selectEligibleMethods(
  input: MethodQuestionInput,
  demand?: LianaDemand | null,
): Array<{ method: LianaMethod; shape: ShapeTestResult }> {
  const demandGated = demand !== undefined;
  const out: Array<{ method: LianaMethod; shape: ShapeTestResult }> = [];
  for (const method of REGISTRY) {
    // D-BP220-BM0-006, 2026-09-05 -- same QUARANTINE GATE as selectMethod() above, same reason:
    // a quarantined method must never be returned as eligible to run.
    if (method.quarantined) continue;
    if (demandGated && method.demand !== demand) continue;
    const shape = method.shapeTest(input);
    if (shape.matches) out.push({ method, shape });
  }
  return out;
}

/** Why each method was or was not eligible, for the transcript. Separated from selectMethod so the
 *  engine can print a full per-method report without re-running selection. Founder, BP149: "I
 *  DESPISE SUMMARIES" -- a method skipped on demand must say so, not silently vanish from the
 *  listing the way a shape-test failure never did. */
export function explainSelection(
  input: MethodQuestionInput,
  demand: LianaDemand | null,
): Array<{ method: LianaMethod; eligible: boolean; reason: string }> {
  return REGISTRY.map((method) => {
    // D-BP220-BM0-006, 2026-09-05 -- QUARANTINE, reported explicitly rather than silently falling
    // through to the demand/shape checks below. Founder, BP149: "I DESPISE SUMMARIES" -- a
    // quarantined method must say so in the transcript, by name, with the reason, never silently
    // vanish from the listing the way a shape-test failure never did either.
    if (method.quarantined) {
      return {
        method,
        eligible: false,
        reason: method.quarantineReason ?? `QUARANTINED -- ${method.id} is fenced and will never be selected to run; see its own file header for the measured reason.`,
      };
    }
    if (method.demand !== demand) {
      return {
        method,
        eligible: false,
        reason: `serves ${method.demand}, this question demands ${demand ?? 'UNKNOWN'} -- not run (canon R-4)`,
      };
    }
    const shape = method.shapeTest(input);
    return { method, eligible: shape.matches, reason: `demand ${method.demand} matches; shape: ${shape.reason}` };
  });
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// D-BP152-049 STAGE 4/4 -- THE NAMENUMBERED DECLARATION REGISTRY, UNIFIED INTO THIS FILE.
//
// Founder, BP152, verbatim: "I want the three cascades' run() functions resolved, don't I? But
// they need to be in one place, right? Advise and if that is correct, then do." Bishop advised
// yes; ruled to do it.
//
// Everything below this line WAS library/method_registry.ts (D-BP152-040/BISHOP/
// seg-method-identity-registry), moved here UNCHANGED -- same function bodies, same declaration
// objects, same doc comments -- so there is exactly ONE file holding both the NameNumbered
// DECLARATION registry (RegisteredMethod / registerNameNumbered / lookupById / listAllEntries /
// listIterationsOfName / latestNumberOfName / registerKnownMethods, below) and the EXECUTABLE
// registry above (LianaMethod / registerMethod / selectMethod / listMethods / explainSelection)
// that already lived in this file -- the two things script_bridge.ts always had to resolve
// against EACH OTHER (its own CASCADE_LIVE_ID lookup table) to make a NameNumbered id actually
// runnable now sit in the same module. library/method_registry.ts itself now RE-EXPORTS
// everything from here (`export * from '../method_registry'`) rather than being deleted outright
// -- see that file's own header for exactly why it remains, as a pure shim with no logic of its
// own, and which callers still resolve through it unchanged.
//
// ONLY RENAME: the Map below was called `REGISTRY` in library/method_registry.ts -- renamed here
// to `NAMENUMBERED_REGISTRY` ONLY to avoid colliding with this file's own pre-existing
// module-private `REGISTRY` (the LianaMethod array, above, D-BP149-041). No exported name changed;
// this is a module-private identifier, invisible to every caller either way.
//
// BEHAVIOR MUST NOT CHANGE, AND DOES NOT: every function below is copied verbatim (only the one
// internal Map variable name differs, and only because of the collision just described); every
// import path was adjusted from './x' to './library/x' to match this file's new location one
// directory up from where these three modules (method_identity.ts, step_declaration.ts,
// orphan_catalog.ts) actually live -- the modules themselves are untouched.
//
// [ORIGINAL library/method_registry.ts HEADER FOLLOWS, VERBATIM, UNCHANGED:]
//
// THE REGISTRY THAT HOLDS NAMENUMBERED METHODS. Founder ruling, BP152, verbatim
// (RULINGS_BP152.md FD-BP152-20): "I want to use it to stack methods in whatever order I want -
// I don't need the lego shapes, I just want them NameNumbered (so that we can have iterations
// galore) as methods so that I can mix and match as I please."
//
// This is an in-memory map from a MethodIdentity's canonical `Name:Number` id (method_identity.ts)
// to a StepDeclaration (library/step_declaration.ts, D-BP152-018 -- the SAME declaration shape
// orphan_catalog.ts already uses; this file does not invent a second one).
//
// A concurrent ticket, D-BP152-041, owns script.ts/script_runner.ts in this same directory --
// the format for STACKING registered methods into an ordered, runnable sequence, and the runner
// that executes one. Neither is built here. This file only holds WHAT can be named and looked
// up; it does not order, run, or persist anything.
//
// REGISTRATION IS INERT, THE SAME WAY orphan_catalog.ts's IS (see that file's own header and its
// own "registration is inert" test, orphan_catalog.test.ts). Every declaration below is a plain
// string/number/plain-object description written by hand from reading the cited source -- this
// file imports NOTHING from methods/comparative_cascade.ts, methods/definitional_cascade.ts,
// methods/classify_cascade.ts, or survey_stage.ts, so importing this module cannot execute any
// of the code those declarations describe (no Google query, no Gemma call, no cascade run()).
// The only import besides library/method_identity.ts and library/step_declaration.ts is
// library/orphan_catalog.ts's own already-inert listOrphanSteps() -- reused rather than
// re-transcribed, per this ticket's instruction not to invent a second declaration shape.

export interface RegisteredMethod {
  identity: MethodIdentity;
  declaration: StepDeclaration;
}

const NAMENUMBERED_REGISTRY = new Map<string, RegisteredMethod>();

/** Registers `declaration` under the canonical `Name:Number` identity built from `name`/`number`.
 *  A duplicate `Name:Number` is an error, not an overwrite -- per this ticket's instruction and
 *  Rule 66 ("version, never overwrite"): the same name at a different number is a new iteration,
 *  registered independently and freely; the same name at the SAME number that already exists is
 *  a programming error, thrown immediately rather than silently replacing the earlier
 *  registration. This is the public "register" capability of the registry -- the operator's own
 *  "stack methods NameNumbered" mechanism, not limited to the ten pre-existing entries
 *  registerKnownMethods() below installs. */
export function registerNameNumbered(name: string, number: number, declaration: StepDeclaration): MethodIdentity {
  const identity = parseMethodId(formatMethodId(name, number));
  if (NAMENUMBERED_REGISTRY.has(identity.id)) {
    throw new Error(`method_registry: duplicate method id "${identity.id}" -- Name:Number is the canonical identity and is never overwritten (Rule 66); register a new number for a new iteration`);
  }
  NAMENUMBERED_REGISTRY.set(identity.id, { identity, declaration });
  return identity;
}

/** Looks up a registered method by its canonical `Name:Number` id. Returns `undefined` if no
 *  such id was registered -- never throws on a miss. */
export function lookupById(id: string): RegisteredMethod | undefined {
  return NAMENUMBERED_REGISTRY.get(id);
}

/** Every registered method, in registration order. Returns a fresh array each call -- callers
 *  cannot mutate the registry by reference (same discipline as orphan_catalog.ts's
 *  listOrphanSteps()). */
export function listAllEntries(): RegisteredMethod[] {
  return Array.from(NAMENUMBERED_REGISTRY.values());
}

/** Every registered iteration of one `name`, sorted ascending by `number`. */
export function listIterationsOfName(name: string): RegisteredMethod[] {
  return listAllEntries()
    .filter((entry) => entry.identity.name === name)
    .sort((a, b) => a.identity.number - b.identity.number);
}

/** The highest registered `number` for `name`, or `null` if `name` has no registered iteration
 *  at all. This is a lookup over what is already registered -- it does not reserve, predict, or
 *  allocate the next number for a caller that wants to register a new iteration. */
export function latestNumberOfName(name: string): number | null {
  const iterations = listIterationsOfName(name);
  if (iterations.length === 0) return null;
  return iterations[iterations.length - 1].identity.number;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// WHAT IS REGISTERED. Ten entries: the three cascade methods (comparative-cascade serves RANK,
// definitional-cascade serves DEFINE, classify-cascade serves CLASSIFY), the Survey stage, and
// the 6 verified orphans already catalogued in orphan_catalog.ts. Every declaration below was
// written from reading the cited source file directly (sourceFile/sourceLine/exportName/
// exportKind checked against the file at the time of writing), not guessed.
//
// `attribution` on these four is NO_DECISION_RULE: registering a method under a Name:Number
// identity adds no decision rule of its own -- it is a lookup key pointing at code whose own
// decision rules (terminators, gates, thresholds) already carry their own ATTRIBUTED/TARE markers
// at their own call sites inside the cited file, per HARDWIRE-23 Law 4. This entry does not
// re-derive, quote out of context, or alter any of those; see the cited sourceFile for the real
// attribution of what the method actually decides.

const COMPARATIVE_CASCADE_DECLARATION: StepDeclaration = {
  id: 'methods.comparative_cascade.comparativeCascadeMethod',
  version: '1',
  sourceFile: 'src/main/liana_cycle/methods/comparative_cascade.ts',
  sourceLine: 1235,
  exportName: 'comparativeCascadeMethod',
  exportKind: 'const',
  // D-BP152-045/BISHOP/seg-composer-ui-fixes -- rewritten to plain, operator-facing language.
  // Founder, live report: he should never see "LianaMethod object" or a field list. This is a
  // description-only change to a registry declaration string; comparativeCascadeMethod() itself
  // (comparative_cascade.ts) is untouched.
  whatItDoes:
    'Answers questions that ask you to rank a short list of similar items by some property, like '
    + 'size or population -- it looks up a number for each option and gives you the one that '
    + 'ranks highest or lowest, or says it cannot tell.',
  inputs: 'MethodQuestionInput (question, options, qid?, correctAnswer?) to shapeTest(); the same input plus MethodRunContext (askGoogle, emit) to run().',
  outputs: 'ShapeTestResult { matches, reason } from shapeTest(); Promise<LianaTerminalOutcome> from run().',
  decidesOrReports: 'DECIDES_AND_REFUSES',
  queryText: {
    issuesQuery: true,
    description:
      'Forms and sends Google queries per stage (register gate, inverse, order-both-ways, Cake '
      + 'Cut Half, hard number) via the injected askGoogle(); templates are hardcoded inline in '
      + 'this file, not loaded from a runtime resource. Full stage order in the file header.',
    loadedFromQueryResource: false,
  },
  attribution: {
    kind: 'NO_DECISION_RULE',
    why:
      'Registering this method under a Name:Number identity adds no decision rule. The method\'s '
      + 'own decision rules (the terminator\'s value-convergence/votes/abstain order, the sole-'
      + 'survivor removal) are already ATTRIBUTED at their own call sites inside '
      + 'comparative_cascade.ts (see its header, lines 31-58, and evaluateComparativeTerminator()) '
      + '-- this entry does not re-derive or restate them.',
  },
  orphanEvidence:
    'N/A -- not an orphan. Live: registered into the pre-existing method registry via '
    + 'registerMethod(comparativeCascadeMethod) (comparative_cascade.ts:1247), demand RANK, '
    + 'selectable by method_registry.ts\'s selectMethod() whenever a question\'s demand is RANK. '
    + 'This field is populated only because StepDeclaration requires it; no orphan claim is made.',
};

const DEFINITIONAL_CASCADE_DECLARATION: StepDeclaration = {
  id: 'methods.definitional_cascade.definitionalCascadeMethod',
  version: '1',
  sourceFile: 'src/main/liana_cycle/methods/definitional_cascade.ts',
  sourceLine: 408,
  exportName: 'definitionalCascadeMethod',
  exportKind: 'const',
  // D-BP152-045: rewritten to plain language, description-only (see ComparativeCascade:1 above).
  whatItDoes:
    'Answers questions that ask what a term means, where the options are competing definitions -- '
    + 'it looks up every verified meaning of the term, but honestly says it does not know rather '
    + 'than guessing when it cannot match a meaning to one of the options.',
  inputs: 'MethodQuestionInput (question, options, qid?, correctAnswer?) to shapeTest(); the same input plus MethodRunContext (askGoogle, emit) to run().',
  outputs: 'ShapeTestResult { matches, reason } from shapeTest(); Promise<LianaTerminalOutcome> from run().',
  decidesOrReports: 'DECIDES_AND_REFUSES',
  queryText: {
    issuesQuery: true,
    description:
      'Forms and sends Google queries via the shared comparative_cascade.ts stage-0/1/2 helpers '
      + 'plus surveyAsk()/fieldGate(); templates are hardcoded inline in this file and its '
      + 'imports, not loaded from a runtime resource.',
    loadedFromQueryResource: false,
  },
  attribution: {
    kind: 'NO_DECISION_RULE',
    why:
      'Registering this method under a Name:Number identity adds no decision rule. The method\'s '
      + 'own decision rules (D1 clustering, the D2-D4 survey-not-collapse replacement, D5\'s '
      + 'deliberate non-implementation) are already documented and attributed at their own sites '
      + 'inside definitional_cascade.ts (see its header, lines 23-51) -- this entry does not '
      + 're-derive or restate them.',
  },
  orphanEvidence:
    'N/A -- not an orphan. Live: registered into the pre-existing method registry via '
    + 'registerMethod(definitionalCascadeMethod) (definitional_cascade.ts:420), demand DEFINE, '
    + 'selectable by method_registry.ts\'s selectMethod() whenever a question\'s demand is DEFINE. '
    + 'This field is populated only because StepDeclaration requires it; no orphan claim is made.',
};

const CLASSIFY_CASCADE_DECLARATION: StepDeclaration = {
  id: 'methods.classify_cascade.classifyCascadeMethod',
  version: '1',
  sourceFile: 'src/main/liana_cycle/methods/classify_cascade.ts',
  sourceLine: 1606,
  exportName: 'classifyCascadeMethod',
  exportKind: 'const',
  // D-BP152-045: rewritten to plain language, description-only (see ComparativeCascade:1 above).
  whatItDoes:
    'Answers questions that ask which category something belongs to -- it rules out options that '
    + 'clearly fail a test, keeps checking with more tests until only one is left, and only gives '
    + 'an answer once it is confident; it never guesses on a tie.',
  inputs: 'MethodQuestionInput (question, options, qid?, correctAnswer?) to shapeTest(); the same input plus MethodRunContext (askGoogle, emit) to run().',
  outputs: 'ShapeTestResult { matches, reason } from shapeTest(); Promise<LianaTerminalOutcome> from run().',
  decidesOrReports: 'DECIDES_AND_REFUSES',
  queryText: {
    issuesQuery: true,
    description:
      'Sends one Google query per criterion per option via evaluateCriterionForOption(); the '
      + 'query text is formed from the question\'s own structurally-extracted candidate terms, '
      + 'not loaded from a runtime resource.',
    loadedFromQueryResource: false,
  },
  attribution: {
    kind: 'NO_DECISION_RULE',
    why:
      'Registering this method under a Name:Number identity adds no decision rule. The '
      + 'terminator itself (Occam elimination, the litmus-strip loop, the Banyan-Metric publish/ '
      + 'abstain rule) is ATTRIBUTED to the Founder\'s membership terminator ruling, quoted '
      + 'verbatim in classify_cascade.ts\'s own header (lines 18-42, RULINGS_BP152.md FD-BP152-19) '
      + '-- this entry does not re-derive or restate that quote.',
  },
  orphanEvidence:
    'N/A -- not an orphan. Live: registered into the pre-existing method registry via '
    + 'registerMethod(classifyCascadeMethod) (classify_cascade.ts:1619), demand CLASSIFY, '
    + 'selectable by method_registry.ts\'s selectMethod() whenever a question\'s demand is '
    + 'CLASSIFY. This field is populated only because StepDeclaration requires it; no orphan '
    + 'claim is made.',
};

const SURVEY_DECLARATION: StepDeclaration = {
  id: 'liana_cycle.survey_stage.runSurveyStage',
  version: '1',
  sourceFile: 'src/main/liana_cycle/survey_stage.ts',
  sourceLine: 1729,
  exportName: 'runSurveyStage',
  exportKind: 'function',
  // D-BP152-045: rewritten to plain language, description-only (see ComparativeCascade:1 above).
  whatItDoes:
    'Does the groundwork before any answer is picked: looks up what the key term in the question '
    + 'means, sorts the answer options into groups, checks whether that meaning is well '
    + 'established, and rules out any option a source directly contradicts.',
  inputs: 'askText: string; options: Record<string,string> | null; ctx: MethodRunContext; opts: SurveyStageOpts (term hints, jarSourceGroups, ambiguityQueryTransport, etc).',
  outputs: 'Promise<SurveyStageResult>.',
  decidesOrReports: 'DECIDES_AND_REFUSES',
  queryText: {
    issuesQuery: true,
    description:
      'Issues Google (or Gemma, per ambiguityQueryTransport) queries across steps 2/3/4/6; some '
      + 'of its composed elements (e.g. survey_ask.ts, field_gate.ts) load query text from '
      + 'resources/liana_survey_queries.json via query_text_loader.ts, the D-BP152-008 '
      + 'runtime-editable resource.',
    loadedFromQueryResource: true,
  },
  attribution: {
    kind: 'NO_DECISION_RULE',
    why:
      'Registering this step under a Name:Number identity adds no decision rule. The two '
      + 'Founder-ordered decision rules this file itself owns (step 3\'s grouping model call, '
      + 'step 6\'s direction-driven elimination) are already ATTRIBUTED at their own call sites '
      + 'inside survey_stage.ts, per this file\'s own doc comment above runSurveyStage() -- this '
      + 'entry does not re-derive or restate them.',
  },
  orphanEvidence:
    'N/A -- not an orphan. runSurveyStage() is a complete, tested, exported function '
    + '(survey_stage.ts:1729); its own doc comment (lines 1714-1728) states it is "ready to be '
    + 'called by whichever future ticket resolves that wiring decision." Whether any caller '
    + 'currently invokes it is a fact about liana_terminal_engine.ts, a file this ticket does not '
    + 'touch and makes no claim about either way -- this field is populated only because '
    + 'StepDeclaration requires it; no orphan claim is made.',
};

// D-BP164-M0-114/BISHOP/M0/seg-resume -- THE TOOLBOX ARGUMENT, APPLIED TO THIS CATALOG TOO.
// liana_terminal_engine.ts (lines 97-123) imports six method files and produces 8 LianaMethod
// entries in the EXECUTABLE registry above (registerMethod/selectMethod): comparativeCascadeMethod,
// definitionalCascadeMethod, classifyCascadeMethod, identifyUntaught, inferUntaught,
// locateInFrameworkUntaught, arithmeticCascadeMethod, stage3SymbolicCascadeMethod. Before this
// dispatch, registerKnownMethods() below only carried NameNumbered entries for 3 of those 8
// (ComparativeCascade/DefinitionalCascade/ClassifyCascade) plus Survey (a step that is NOT one of
// the 8 -- runSurveyStage() is not registered via registerMethod() at all) and the 6 orphan.ts
// elements. That is a real gap in THIS catalog specifically: the Founder's BP164 toolbox ruling
// ("Wire them all to this entry point so that we can mix and match at will") was executed for the
// EXECUTABLE registry (D-BP164-M0-112) but never carried into this NameNumbered/StepDeclaration
// catalog, so five real, live, wired methods had no Name:Number identity here.
//
// WHAT THIS CATALOG IS FOR, READ FROM ITS OWN HEADER ABOVE (BP152, FD-BP152-20) AND CONFIRMED
// BEFORE TOUCHING IT: a documentation/description catalog keyed by Name:Number, for the operator
// to "stack methods in whatever order I want... mix and match as I please" -- distinct from, and
// layered on top of, the executable LianaMethod registry (selectMethod/registerMethod above), which
// is what liana_terminal_engine.ts actually calls at runtime to decide which method's shapeTest()
// runs. REGISTERING A NAME:NUMBER IDENTITY HERE DOES NOT MAKE A METHOD RUNNABLE AND DOES NOT
// CHANGE SELECTION -- selectMethod() (line 328 above) is untouched by this addition, still iterates
// the module-private REGISTRY array populated by registerMethod() calls at import time, in that
// same order, matching the FIRST shapeTest() that returns true. Adding a Name:Number entry below
// is purely descriptive -- exactly the "registration is inert" discipline this file's own header
// (lines 418-426) already states for every existing entry.
//
// THE FIVE NEW ENTRIES, EACH FROM A FILE ALREADY IMPORTED BY liana_terminal_engine.ts (confirmed by
// direct read, not assumed): untaught_shapes.ts exports THREE separate LianaMethod consts, not one
// -- identifyUntaught (line 63), inferUntaught (line 76), locateInFrameworkUntaught (line 87) --
// each already `registerMethod()`-ed individually in the executable registry (untaught_shapes.ts:
// 98-100), so each gets its own Name:Number identity here too, for the same reason every other
// entry in this catalog is one export, not one file. arithmetic_cascade.ts:325 and
// stage3_symbolic_cascade.ts:209 are the other two.
//
// Both untaught_shapes.ts methods ship `run: null` (a KNOWN, deliberately unimplemented shape --
// this file's own header, lines 27-30, already covers this case) and are labeled as such below,
// never claiming a run behavior they do not have. arithmetic_cascade.ts and
// stage3_symbolic_cascade.ts DO run (SymPy-derived), but both their own file headers flag their
// `taughtBy` as a generic Founder-ordered build rather than a single walked human case (canon rule
// 4) -- that flag is carried into each entry's `taughtBy` field below verbatim, not softened.

const IDENTIFY_UNTAUGHT_DECLARATION: StepDeclaration = {
  id: 'methods.untaught_shapes.identifyUntaught',
  version: '1',
  sourceFile: 'src/main/liana_cycle/methods/untaught_shapes.ts',
  sourceLine: 63,
  exportName: 'identifyUntaught',
  exportKind: 'const',
  whatItDoes:
    'Recognizes a question whose demand is IDENTIFY (the answer is a member or instance) and '
    + 'reports that this is a KNOWN, RECOGNIZED shape with NO TAUGHT METHOD YET -- it never '
    + 'attempts an answer. `run` is null. Registered so the transcript says "not yet taught" '
    + 'instead of the less honest "no method matches" (this file\'s own header, lines 20-30).',
  inputs: 'MethodQuestionInput (question, options, qid?, correctAnswer?) to shapeTest(). No run().',
  outputs: 'ShapeTestResult { matches: true whenever demand is IDENTIFY, reason }. run is null.',
  decidesOrReports: 'REPORTS',
  queryText: { issuesQuery: false, description: null, loadedFromQueryResource: false },
  attribution: {
    kind: 'NO_DECISION_RULE',
    why:
      'Registering this method under a Name:Number identity adds no decision rule. shapeTest() '
      + 'here is an unconditional match-on-demand-alone report, not a branch; and run being null '
      + 'means no answer is ever decided. The file\'s own header states plainly this shape has NO '
      + 'walked human case yet (nominated: qid 66) -- that is disclosed in taughtBy, not hidden.',
  },
  orphanEvidence:
    'N/A -- not an orphan. Live: registered into the pre-existing method registry via '
    + 'registerMethod(identifyUntaught) (untaught_shapes.ts:98), demand IDENTIFY, imported by '
    + 'liana_terminal_engine.ts. This field is populated only because StepDeclaration requires it.',
};

const INFER_UNTAUGHT_DECLARATION: StepDeclaration = {
  id: 'methods.untaught_shapes.inferUntaught',
  version: '1',
  sourceFile: 'src/main/liana_cycle/methods/untaught_shapes.ts',
  sourceLine: 76,
  exportName: 'inferUntaught',
  exportKind: 'const',
  whatItDoes:
    'Recognizes a question whose demand is INFER (the answer is a conclusion drawn from evidence, '
    + 'not stated by any single source) and reports that this is a KNOWN, RECOGNIZED shape with NO '
    + 'TAUGHT METHOD YET -- it never attempts an answer. `run` is null.',
  inputs: 'MethodQuestionInput (question, options, qid?, correctAnswer?) to shapeTest(). No run().',
  outputs: 'ShapeTestResult { matches: true whenever demand is INFER, reason }. run is null.',
  decidesOrReports: 'REPORTS',
  queryText: { issuesQuery: false, description: null, loadedFromQueryResource: false },
  attribution: {
    kind: 'NO_DECISION_RULE',
    why:
      'Registering this method under a Name:Number identity adds no decision rule, for the same '
      + 'reason as identify-untaught above. The file\'s own header states plainly this shape has '
      + 'NO walked human case yet (nominated: qid 72) -- disclosed in taughtBy, not hidden.',
  },
  orphanEvidence:
    'N/A -- not an orphan. Live: registered into the pre-existing method registry via '
    + 'registerMethod(inferUntaught) (untaught_shapes.ts:99), demand INFER, imported by '
    + 'liana_terminal_engine.ts. This field is populated only because StepDeclaration requires it.',
};

const LOCATE_IN_FRAMEWORK_UNTAUGHT_DECLARATION: StepDeclaration = {
  id: 'methods.untaught_shapes.locateInFrameworkUntaught',
  version: '1',
  sourceFile: 'src/main/liana_cycle/methods/untaught_shapes.ts',
  sourceLine: 87,
  exportName: 'locateInFrameworkUntaught',
  exportKind: 'const',
  whatItDoes:
    'Recognizes a question whose demand is LOCATE-IN-FRAMEWORK (the answer is a term\'s role '
    + 'inside a named theory or framework) and reports that this is a KNOWN, RECOGNIZED shape with '
    + 'NO TAUGHT METHOD YET -- it never attempts an answer. `run` is null.',
  inputs: 'MethodQuestionInput (question, options, qid?, correctAnswer?) to shapeTest(). No run().',
  outputs: 'ShapeTestResult { matches: true whenever demand is LOCATE-IN-FRAMEWORK, reason }. run is null.',
  decidesOrReports: 'REPORTS',
  queryText: { issuesQuery: false, description: null, loadedFromQueryResource: false },
  attribution: {
    kind: 'NO_DECISION_RULE',
    why:
      'Registering this method under a Name:Number identity adds no decision rule, for the same '
      + 'reason as identify-untaught above. The file\'s own header states plainly this shape has '
      + 'NO walked human case yet (nominated: qid 92) -- disclosed in taughtBy, not hidden.',
  },
  orphanEvidence:
    'N/A -- not an orphan. Live: registered into the pre-existing method registry via '
    + 'registerMethod(locateInFrameworkUntaught) (untaught_shapes.ts:100), demand '
    + 'LOCATE-IN-FRAMEWORK, imported by liana_terminal_engine.ts. This field is populated only '
    + 'because StepDeclaration requires it.',
};

const ARITHMETIC_CASCADE_DECLARATION: StepDeclaration = {
  id: 'methods.arithmetic_cascade.arithmeticCascadeMethod',
  version: '1',
  sourceFile: 'src/main/liana_cycle/methods/arithmetic_cascade.ts',
  sourceLine: 325,
  exportName: 'arithmeticCascadeMethod',
  exportKind: 'const',
  whatItDoes:
    'Answers a free-text word problem (no lettered options) that states several quantities in '
    + 'prose and asks for a number derived by combining them (the ASDiv/GSM8K shape) -- extracts a '
    + 'left-to-right operator chain from local text windows around each number and hands it to '
    + 'SymPy for the actual evaluation; refuses (abstains) rather than guessing when a number\'s '
    + 'local window carries no recognized operator cue.',
  inputs: 'MethodQuestionInput (question, options, qid?, correctAnswer?) to shapeTest(); the same input plus MethodRunContext to run(). Never reads correctAnswer (file\'s own header, confirmed by direct read).',
  outputs: 'ShapeTestResult { matches, reason } from shapeTest(); Promise<LianaTerminalOutcome> from run(), backed by a SymPy subprocess via runSympyArithmetic() (plow_gom_jabbar.ts).',
  decidesOrReports: 'DECIDES_AND_REFUSES',
  queryText: { issuesQuery: false, description: 'Issues no Google/web query; derives entirely from the question text plus a local SymPy subprocess call.', loadedFromQueryResource: false },
  attribution: {
    kind: 'NO_DECISION_RULE',
    why:
      'Registering this method under a Name:Number identity adds no decision rule. The method\'s '
      + 'own operator-cue rules are in arithmetic_cascade.ts directly. That file\'s own taughtBy '
      + 'field is explicit that no single walked human case taught this method the way qid 98/85/46 '
      + 'taught the three original cascades -- it is a generic SymPy-backed extractor built to the '
      + 'Founder\'s direct "why not use SymPy?" order (BP164), flagged there rather than fabricating '
      + 'a case citation; that flag is carried here, not hidden.',
  },
  orphanEvidence:
    'N/A -- not an orphan. Live: registered into the pre-existing method registry via '
    + 'registerMethod(arithmeticCascadeMethod) (arithmetic_cascade.ts:350), demand COMPUTE (a real '
    + 'LianaDemand member as of D-BP164-M0-112, demand_test.ts), imported by '
    + 'liana_terminal_engine.ts. This field is populated only because StepDeclaration requires it.',
};

const STAGE3_SYMBOLIC_CASCADE_DECLARATION: StepDeclaration = {
  id: 'methods.stage3_symbolic_cascade.stage3SymbolicCascadeMethod',
  version: '1',
  sourceFile: 'src/main/liana_cycle/methods/stage3_symbolic_cascade.ts',
  sourceLine: 209,
  exportName: 'stage3SymbolicCascadeMethod',
  exportKind: 'const',
  whatItDoes:
    'Answers a free-text problem (no lettered options) matching one of two exact templates '
    + '("Solve for x: {a}x [+|-] b = c" or a polynomial-derivative-at-a-point template) emitted by '
    + '../elements/stage3_problem_generator.ts -- extracts the coefficients structurally and hands '
    + 'them to SymPy (solve-for-x or differentiate-and-evaluate); refuses (abstains) on anything '
    + 'that does not match one of the two templates exactly, rather than attempting a looser parse.',
  inputs: 'MethodQuestionInput (question, options, qid?, correctAnswer?) to shapeTest(); the same input plus MethodRunContext to run(). Never reads correctAnswer or any Stage3GroundTruthRecord field (file\'s own header, confirmed by direct read).',
  outputs: 'ShapeTestResult { matches, reason } from shapeTest(); Promise<LianaTerminalOutcome> from run(), backed by runSympySolveForX()/runSympyDerivativeAtPoint() (plow_gom_jabbar.ts).',
  decidesOrReports: 'DECIDES_AND_REFUSES',
  queryText: { issuesQuery: false, description: 'Issues no Google/web query; derives entirely from the problem-statement text plus a local SymPy subprocess call.', loadedFromQueryResource: false },
  attribution: {
    kind: 'NO_DECISION_RULE',
    why:
      'Registering this method under a Name:Number identity adds no decision rule. The template-'
      + 'match/refuse rules are in stage3_symbolic_cascade.ts directly. That file\'s own taughtBy '
      + 'field is explicit that no single walked human case taught this method (canon rule 4) -- it '
      + 'is a generic SymPy-backed template solver built to the Founder\'s direct BP164 order, '
      + 'flagged there rather than fabricating a case citation; that flag is carried here, not '
      + 'hidden.',
  },
  orphanEvidence:
    'N/A -- not an orphan. Live: registered into the pre-existing method registry via '
    + 'registerMethod(stage3SymbolicCascadeMethod) (stage3_symbolic_cascade.ts:232), demand COMPUTE '
    + '(a real LianaDemand member as of D-BP164-M0-112, demand_test.ts), imported by '
    + 'liana_terminal_engine.ts. This field is populated only because StepDeclaration requires it.',
};

// D-BP165-M0-022/BISHOP-M0/SEG -- CLOSING A DRIFT FOUND WHILE WIRING THIS DISPATCH'S OWN METHOD.
// Per this dispatch's own order ("registerKnownMethods() ... drifted out of sync once already at
// BP164 and knew only 4 of 8 live methods -- CHECK IT, do not assume"), the check was made: as of
// this dispatch's start, the EXECUTABLE registry above (registerMethod) held NINE LianaMethod
// entries -- comparativeCascadeMethod, definitionalCascadeMethod, classifyCascadeMethod,
// identifyUntaught, inferUntaught, locateInFrameworkUntaught, arithmeticCascadeMethod,
// stage3SymbolicCascadeMethod, computeGemmaCascadeMethod (compute_gemma_cascade.ts, added
// D-BP164-M0-119, imported into liana_terminal_engine.ts at D-BP165-M0-006) -- but this
// NameNumbered catalog, immediately below, only registered EIGHT of those nine
// (registerKnownMethods() had no entry for computeGemmaCascadeMethod at all). The SAME drift the
// D-BP164-M0-114 comment above already found once, recurring. Closed here, additively, alongside
// registering this dispatch's own new tenth method (computeSelectCascadeMethod,
// compute_select_cascade.ts) so the catalog does not fall behind again the moment it is touched.
const COMPUTE_GEMMA_CASCADE_DECLARATION: StepDeclaration = {
  id: 'methods.compute_gemma_cascade.computeGemmaCascadeMethod',
  version: '1',
  sourceFile: 'src/main/liana_cycle/methods/compute_gemma_cascade.ts',
  sourceLine: 340,
  exportName: 'computeGemmaCascadeMethod',
  exportKind: 'const',
  whatItDoes:
    'Answers a free-text word problem (no lettered options) carrying at least two numeric '
    + 'literals -- lets the local Gemma model derive ONE arithmetic expression from the question '
    + 'text (the combination step only; it is never trusted to compute the result), then '
    + 'independently recomputes that expression with two separate evaluators and requires at '
    + 'least 2 of 3 sampled derivations to agree before trusting the value; refuses honestly '
    + 'otherwise.',
  inputs: 'MethodQuestionInput (question, options, qid?, correctAnswer?) to shapeTest(); the same input plus MethodRunContext to run(). Never reads correctAnswer (file\'s own header, confirmed by direct read).',
  outputs: 'ShapeTestResult { matches, reason } from shapeTest(); Promise<LianaTerminalOutcome> from run(), backed by computeViaModelExpression() (plow/compute_sidecar.ts) and a purpose-built Ollama caller that records every real call through cost_instrument.ts.',
  decidesOrReports: 'DECIDES_AND_REFUSES',
  queryText: {
    issuesQuery: false,
    description: 'Issues no Google/web query; sends the question text to a local Ollama model '
      + '(default gemma4:12b) via computeGemmaCallModel(Rich)(), a local network call, not a web '
      + 'search.',
    loadedFromQueryResource: false,
  },
  attribution: {
    kind: 'NO_DECISION_RULE',
    why:
      'Registering this method under a Name:Number identity adds no decision rule. The '
      + 'derive-then-recompute-then-self-consistency rules are in compute_sidecar.ts and this '
      + 'file directly. That file\'s own taughtBy field is explicit that no single walked human '
      + 'case taught this method (canon rule 4) -- it is a generic Founder-ordered build ("Build '
      + 'the COMPUTE+gemma method and rerun those 2"), flagged there rather than fabricating a '
      + 'case citation; that flag is carried here, not hidden.',
  },
  orphanEvidence:
    'N/A -- not an orphan. Live: registered into the pre-existing method registry via '
    + 'registerMethod(computeGemmaCascadeMethod) (compute_gemma_cascade.ts:366), demand COMPUTE, '
    + 'imported by liana_terminal_engine.ts (D-BP165-M0-006). This entry closes a catalog-only '
    + 'gap (see the D-BP165-M0-022 comment immediately above) -- the method itself has been live '
    + 'and wired since before this dispatch; only its NameNumbered catalog entry was missing.',
};

const COMPUTE_SELECT_CASCADE_DECLARATION: StepDeclaration = {
  id: 'methods.compute_select_cascade.computeSelectCascadeMethod',
  version: '1',
  sourceFile: 'src/main/liana_cycle/methods/compute_select_cascade.ts',
  sourceLine: 1,
  exportName: 'computeSelectCascadeMethod',
  exportKind: 'const',
  whatItDoes:
    'Answers a lettered multiple-choice question whose options are mostly numeric values -- lets '
    + 'the local Gemma model derive ONE arithmetic expression from the question text (never '
    + 'trusted to compute it; the same compute_sidecar.ts two-evaluator recompute + N=3 '
    + 'self-consistency check compute-gemma-cascade already uses), then matches the resulting '
    + 'value against the option pool: answers only when EXACTLY ONE option carries a numeric '
    + 'value within tolerance, and honestly refuses -- naming whether zero options matched or '
    + 'more than one did -- otherwise. Never picks the nearest option as a guess.',
  inputs: 'MethodQuestionInput (question, options, qid?, correctAnswer?) to shapeTest(); the same input plus MethodRunContext to run(). Never reads correctAnswer.',
  outputs: 'ShapeTestResult { matches, reason } from shapeTest(); Promise<LianaTerminalOutcome> from run(), backed by computeViaModelExpression() (plow/compute_sidecar.ts) for derivation and this file\'s own matchComputedValueToMcqOptions() for selection.',
  decidesOrReports: 'DECIDES_AND_REFUSES',
  queryText: {
    issuesQuery: false,
    description: 'Issues no Google/web query; sends the question text (options withheld from the '
      + 'derivation prompt) to a local Ollama model via this file\'s own computeMcqCallModel(Rich)().',
    loadedFromQueryResource: false,
  },
  attribution: {
    kind: 'NO_DECISION_RULE',
    why:
      'Registering this method under a Name:Number identity adds no decision rule. The '
      + 'derivation rules live in compute_sidecar.ts (imported, unchanged); the SELECT-step '
      + 'exactly-one-option-qualifies rule (matchComputedValueToMcqOptions) is this file\'s own new '
      + 'logic, documented and attributed at its own definition site inside '
      + 'compute_select_cascade.ts -- this entry does not re-derive or restate it.',
  },
  orphanEvidence:
    'N/A -- not an orphan. Live: registered into the pre-existing method registry via '
    + 'registerMethod(computeSelectCascadeMethod) (compute_select_cascade.ts), demand COMPUTE, '
    + 'imported by liana_terminal_engine.ts (D-BP165-M0-022). This field is populated only because '
    + 'StepDeclaration requires it; no orphan claim is made.',
};

// D-BP168-M0-113/BISHOP-M0/seg-composer-methods -- CLOSING THE SAME DRIFT A THIRD TIME. Founder
// order, BP168, task t-8138911d: "MORE METHODS FOR THE COMPOSER -- once you see how Compose works
// you understand we seriously need to make more methods." method_selection_probe_report_D-BP168-
// M0-100.json (674 real OlympiadBench solutions, stage3_math_protocol_impl.js's own unmodified
// extractMethodStatementFromSolution()) measured 17 distinct method phrases named in real solution
// text; "pythagorean theorem" (14, joint-highest) and "quadratic formula" (12, third-highest) had
// no registered COMPUTE method naming or teaching either. Two new LianaMethod entries close that
// gap (methods/pythagorean_theorem_cascade.ts, methods/quadratic_formula_cascade.ts) -- both
// registered into the executable registry AND given a Name:Number identity here in the same
// dispatch, so this catalog does not fall behind a third time the way the D-BP164-M0-114 and
// D-BP165-M0-022 comments above each already found once.
const PYTHAGOREAN_THEOREM_CASCADE_DECLARATION: StepDeclaration = {
  id: 'methods.pythagorean_theorem_cascade.pythagoreanTheoremCascadeMethod',
  version: '1',
  sourceFile: 'src/main/liana_cycle/methods/pythagorean_theorem_cascade.ts',
  sourceLine: 1,
  exportName: 'pythagoreanTheoremCascadeMethod',
  exportKind: 'const',
  whatItDoes:
    'Answers a free-text question (no lettered options) naming a right triangle / hypotenuse / '
    + 'right angle / the Pythagorean theorem and carrying at least two numeric literals -- teaches '
    + 'the local Gemma model the relationship c^2=a^2+b^2 as a FACT (compute_sidecar.ts\'s '
    + 'componentFacts, BP137 Stage A.3), never the answer, then lets it derive ONE arithmetic '
    + 'expression (never trusted to compute it); two independently-implemented evaluators recompute '
    + 'that expression and require at least 2 of 3 sampled derivations to agree before trusting the '
    + 'value; refuses honestly otherwise.',
  inputs: 'MethodQuestionInput (question, options, qid?, correctAnswer?) to shapeTest(); the same input plus MethodRunContext to run(). Never reads correctAnswer (file\'s own header, confirmed by direct read).',
  outputs: 'ShapeTestResult { matches, reason } from shapeTest(); Promise<LianaTerminalOutcome> from run(), backed by computeViaModelExpression() (plow/compute_sidecar.ts) and a purpose-built Ollama caller that records every real call through cost_instrument.ts.',
  decidesOrReports: 'DECIDES_AND_REFUSES',
  queryText: {
    issuesQuery: false,
    description: 'Issues no Google/web query; sends the question text plus the taught Pythagorean '
      + 'fact to a local Ollama model (default gemma4:12b) via this file\'s own '
      + 'pythagoreanCallModel(Rich)(), a local network call, not a web search.',
    loadedFromQueryResource: false,
  },
  attribution: {
    kind: 'NO_DECISION_RULE',
    why:
      'Registering this method under a Name:Number identity adds no decision rule. The '
      + 'derive-then-recompute-then-self-consistency rules are in compute_sidecar.ts (imported, '
      + 'unchanged); the taught-fact content itself is documented at its own definition site '
      + '(PYTHAGOREAN_FACT, pythagorean_theorem_cascade.ts) -- this entry does not re-derive or '
      + 'restate it.',
  },
  orphanEvidence:
    'N/A -- not an orphan. Live: registered into the pre-existing method registry via '
    + 'registerMethod(pythagoreanTheoremCascadeMethod) (pythagorean_theorem_cascade.ts), demand '
    + 'COMPUTE, imported by liana_terminal_engine.ts (D-BP168-M0-113). This field is populated '
    + 'only because StepDeclaration requires it; no orphan claim is made.',
};

const QUADRATIC_FORMULA_CASCADE_DECLARATION: StepDeclaration = {
  id: 'methods.quadratic_formula_cascade.quadraticFormulaCascadeMethod',
  version: '1',
  sourceFile: 'src/main/liana_cycle/methods/quadratic_formula_cascade.ts',
  sourceLine: 1,
  exportName: 'quadraticFormulaCascadeMethod',
  exportKind: 'const',
  whatItDoes:
    'Answers a free-text question (no lettered options) naming a quadratic (the word "quadratic" '
    + 'or a literal x^2/x**2/x² term) AND naming which single root/sum/product/discriminant '
    + 'quantity is wanted -- teaches the local Gemma model the quadratic formula as a FACT '
    + '(compute_sidecar.ts\'s componentFacts, BP137 Stage A.3), never the answer, then lets it '
    + 'derive ONE arithmetic expression for that specific named quantity (never trusted to compute '
    + 'it); two independently-implemented evaluators recompute that expression and require at '
    + 'least 2 of 3 sampled derivations to agree before trusting the value; refuses honestly '
    + 'otherwise, including a bare "solve for x" with no disambiguation of which of the two roots '
    + 'is wanted.',
  inputs: 'MethodQuestionInput (question, options, qid?, correctAnswer?) to shapeTest(); the same input plus MethodRunContext to run(). Never reads correctAnswer (file\'s own header, confirmed by direct read).',
  outputs: 'ShapeTestResult { matches, reason } from shapeTest(); Promise<LianaTerminalOutcome> from run(), backed by computeViaModelExpression() (plow/compute_sidecar.ts) and a purpose-built Ollama caller that records every real call through cost_instrument.ts.',
  decidesOrReports: 'DECIDES_AND_REFUSES',
  queryText: {
    issuesQuery: false,
    description: 'Issues no Google/web query; sends the question text plus the taught quadratic-'
      + 'formula fact to a local Ollama model (default gemma4:12b) via this file\'s own '
      + 'quadraticCallModel(Rich)(), a local network call, not a web search.',
    loadedFromQueryResource: false,
  },
  attribution: {
    kind: 'NO_DECISION_RULE',
    why:
      'Registering this method under a Name:Number identity adds no decision rule. The '
      + 'derive-then-recompute-then-self-consistency rules are in compute_sidecar.ts (imported, '
      + 'unchanged); the root-disambiguation gate and the taught-fact content are documented at '
      + 'their own definition sites (ROOT_DISAMBIGUATION_CUE_RE / QUADRATIC_FACT, '
      + 'quadratic_formula_cascade.ts) -- this entry does not re-derive or restate them.',
  },
  orphanEvidence:
    'N/A -- not an orphan. Live: registered into the pre-existing method registry via '
    + 'registerMethod(quadraticFormulaCascadeMethod) (quadratic_formula_cascade.ts), demand '
    + 'COMPUTE, imported by liana_terminal_engine.ts (D-BP168-M0-113). This field is populated '
    + 'only because StepDeclaration requires it; no orphan claim is made.',
};

// D-BP168-M0-126/BISHOP-M0/seg-composer-methods -- CLOSING THE SAME DRIFT A FOURTH TIME. Founder
// order, BP168, dispatch D-BP168-M0-126: "BUILD THE HIGHEST-FREQUENCY ONES ... QUALITY OVER COUNT."
// Two more LianaMethod entries close the next two gaps in method_selection_probe_report_D-BP168-M0-
// 100.json's 17 distinct phrases (permutation+combination combined 25, second-highest; law of
// cosines 9, fourth-highest) -- both registered into the executable registry AND given a Name:Number
// identity here in the same dispatch, so this catalog does not fall behind a fourth time.
const PERMUTATION_COMBINATION_CASCADE_DECLARATION: StepDeclaration = {
  id: 'methods.permutation_combination_cascade.permutationCombinationCascadeMethod',
  version: '1',
  sourceFile: 'src/main/liana_cycle/methods/permutation_combination_cascade.ts',
  sourceLine: 1,
  exportName: 'permutationCombinationCascadeMethod',
  exportKind: 'const',
  whatItDoes:
    'Answers a free-text question (no lettered options) naming a permutation/combination concept '
    + '(permutation, combination, choose, nPr, nCr) and carrying at least two numeric literals -- '
    + 'teaches the local Gemma model nPr = n*(n-1)*...*(n-r+1) and nCr = nPr/(r*(r-1)*...*1) as '
    + 'FACTS (compute_sidecar.ts\'s componentFacts, BP137 Stage A.3), explicitly forbidding '
    + 'factorial notation, never the answer, then lets it derive ONE arithmetic expression (never '
    + 'trusted to compute it); two independently-implemented evaluators recompute that expression '
    + 'and require at least 2 of 3 sampled derivations to agree before trusting the value; refuses '
    + 'honestly otherwise.',
  inputs: 'MethodQuestionInput (question, options, qid?, correctAnswer?) to shapeTest(); the same input plus MethodRunContext to run(). Never reads correctAnswer (file\'s own header, confirmed by direct read).',
  outputs: 'ShapeTestResult { matches, reason } from shapeTest(); Promise<LianaTerminalOutcome> from run(), backed by computeViaModelExpression() (plow/compute_sidecar.ts) and a purpose-built Ollama caller that records every real call through cost_instrument.ts.',
  decidesOrReports: 'DECIDES_AND_REFUSES',
  queryText: {
    issuesQuery: false,
    description: 'Issues no Google/web query; sends the question text plus the taught nPr/nCr fact '
      + 'to a local Ollama model (default gemma4:12b) via this file\'s own permCombCallModel(Rich)(), '
      + 'a local network call, not a web search.',
    loadedFromQueryResource: false,
  },
  attribution: {
    kind: 'NO_DECISION_RULE',
    why:
      'Registering this method under a Name:Number identity adds no decision rule. The '
      + 'derive-then-recompute-then-self-consistency rules are in compute_sidecar.ts (imported, '
      + 'unchanged); the taught-fact content itself is documented at its own definition site '
      + '(PERMUTATION_COMBINATION_FACT, permutation_combination_cascade.ts) -- this entry does not '
      + 're-derive or restate it.',
  },
  orphanEvidence:
    'N/A -- not an orphan. Live: registered into the pre-existing method registry via '
    + 'registerMethod(permutationCombinationCascadeMethod) (permutation_combination_cascade.ts), '
    + 'demand COMPUTE, imported by liana_terminal_engine.ts (D-BP168-M0-126). This field is '
    + 'populated only because StepDeclaration requires it; no orphan claim is made.',
};

const LAW_OF_COSINES_CASCADE_DECLARATION: StepDeclaration = {
  id: 'methods.law_of_cosines_cascade.lawOfCosinesCascadeMethod',
  version: '1',
  sourceFile: 'src/main/liana_cycle/methods/law_of_cosines_cascade.ts',
  sourceLine: 1,
  exportName: 'lawOfCosinesCascadeMethod',
  exportKind: 'const',
  whatItDoes:
    'Answers a free-text question (no lettered options) naming "law of cosines", a standard-degree '
    + 'angle (0/30/45/60/90/120/135/150/180), and a side-finding cue (never an angle-finding one), '
    + 'carrying at least three numeric literals -- teaches the local Gemma model c^2=a^2+b^2-2ab*'
    + 'cos(C) plus a nine-value nice-angle cosine table as FACTS (compute_sidecar.ts\'s '
    + 'componentFacts, BP137 Stage A.3), never the answer, then lets it derive ONE arithmetic '
    + 'expression for the side length (never trusted to compute it); two independently-implemented '
    + 'evaluators recompute that expression and require at least 2 of 3 sampled derivations to '
    + 'agree before trusting the value; refuses honestly otherwise, including any question asking '
    + 'for an angle rather than a side (would need arccos, unsupported by the whitelisted '
    + 'evaluator).',
  inputs: 'MethodQuestionInput (question, options, qid?, correctAnswer?) to shapeTest(); the same input plus MethodRunContext to run(). Never reads correctAnswer (file\'s own header, confirmed by direct read).',
  outputs: 'ShapeTestResult { matches, reason } from shapeTest(); Promise<LianaTerminalOutcome> from run(), backed by computeViaModelExpression() (plow/compute_sidecar.ts) and a purpose-built Ollama caller that records every real call through cost_instrument.ts.',
  decidesOrReports: 'DECIDES_AND_REFUSES',
  queryText: {
    issuesQuery: false,
    description: 'Issues no Google/web query; sends the question text plus the taught law-of-'
      + 'cosines fact and cosine table to a local Ollama model (default gemma4:12b) via this file\'s '
      + 'own lawOfCosinesCallModel(Rich)(), a local network call, not a web search.',
    loadedFromQueryResource: false,
  },
  attribution: {
    kind: 'NO_DECISION_RULE',
    why:
      'Registering this method under a Name:Number identity adds no decision rule. The '
      + 'derive-then-recompute-then-self-consistency rules are in compute_sidecar.ts (imported, '
      + 'unchanged); the nice-angle gate and taught-fact content are documented at their own '
      + 'definition sites (NICE_ANGLE_RE / LAW_OF_COSINES_FACT, law_of_cosines_cascade.ts) -- this '
      + 'entry does not re-derive or restate them.',
  },
  orphanEvidence:
    'N/A -- not an orphan. Live: registered into the pre-existing method registry via '
    + 'registerMethod(lawOfCosinesCascadeMethod) (law_of_cosines_cascade.ts), demand COMPUTE, '
    + 'imported by liana_terminal_engine.ts (D-BP168-M0-126). This field is populated only because '
    + 'StepDeclaration requires it; no orphan claim is made.',
};

/** Registers the SEVENTEEN pre-existing entries this catalog now carries: the three original
 *  cascade methods, the Survey stage, the 6 verified orphans from orphan_catalog.ts (all D-BP152-
 *  era), (D-BP164-M0-114) the 5 methods that closed the gap between this catalog and the 8
 *  LianaMethod entries the executable registry then held -- identifyUntaught, inferUntaught,
 *  locateInFrameworkUntaught, arithmeticCascadeMethod, stage3SymbolicCascadeMethod -- and
 *  (D-BP165-M0-022) 2 more closing a SECOND recurrence of the same drift: computeGemmaCascadeMethod
 *  (live since D-BP164-M0-119, wired D-BP165-M0-006, but never given a catalog entry) and
 *  computeSelectCascadeMethod (built this dispatch). Every one of the executable registry's now-10
 *  LianaMethod entries has a Name:Number identity here; Survey and the 6 orphans remain the only
 *  entries with no executable-registry counterpart (by design -- see their own declarations
 *  above). NOT called at module load -- a caller invokes this explicitly. Calling it twice throws
 *  on the second call (every id it registers would already be present), the same "duplicate is an
 *  error" behavior registerNameNumbered() gives every caller. THIS COMMENT WILL DRIFT AGAIN THE
 *  NEXT TIME A METHOD IS ADDED TO THE EXECUTABLE REGISTRY WITHOUT ALSO BEING ADDED HERE -- a
 *  future dispatch adding method #11 should CHECK this function against liana_terminal_engine.ts's
 *  own import list rather than assume this count is current, per the same instruction this
 *  dispatch was given. */
export function registerKnownMethods(): MethodIdentity[] {
  const identities: MethodIdentity[] = [
    registerNameNumbered('ComparativeCascade', 1, COMPARATIVE_CASCADE_DECLARATION),
    registerNameNumbered('DefinitionalCascade', 1, DEFINITIONAL_CASCADE_DECLARATION),
    registerNameNumbered('ClassifyCascade', 1, CLASSIFY_CASCADE_DECLARATION),
    registerNameNumbered('Survey', 1, SURVEY_DECLARATION),
    registerNameNumbered('IdentifyUntaught', 1, IDENTIFY_UNTAUGHT_DECLARATION),
    registerNameNumbered('InferUntaught', 1, INFER_UNTAUGHT_DECLARATION),
    registerNameNumbered('LocateInFrameworkUntaught', 1, LOCATE_IN_FRAMEWORK_UNTAUGHT_DECLARATION),
    registerNameNumbered('ArithmeticCascade', 1, ARITHMETIC_CASCADE_DECLARATION),
    registerNameNumbered('Stage3SymbolicCascade', 1, STAGE3_SYMBOLIC_CASCADE_DECLARATION),
    // D-BP165-M0-022: the two entries closing the catalog drift found this dispatch (see the
    // comment above COMPUTE_GEMMA_CASCADE_DECLARATION for the full account).
    registerNameNumbered('ComputeGemmaCascade', 1, COMPUTE_GEMMA_CASCADE_DECLARATION),
    registerNameNumbered('ComputeSelectCascade', 1, COMPUTE_SELECT_CASCADE_DECLARATION),
    // D-BP168-M0-113: the two entries closing the catalog drift found this dispatch (see the
    // comment above PYTHAGOREAN_THEOREM_CASCADE_DECLARATION for the full account).
    registerNameNumbered('PythagoreanTheoremCascade', 1, PYTHAGOREAN_THEOREM_CASCADE_DECLARATION),
    registerNameNumbered('QuadraticFormulaCascade', 1, QUADRATIC_FORMULA_CASCADE_DECLARATION),
    // D-BP168-M0-126: the two entries closing the catalog drift found this dispatch (see the
    // comment above PERMUTATION_COMBINATION_CASCADE_DECLARATION for the full account).
    registerNameNumbered('PermutationCombinationCascade', 1, PERMUTATION_COMBINATION_CASCADE_DECLARATION),
    registerNameNumbered('LawOfCosinesCascade', 1, LAW_OF_COSINES_CASCADE_DECLARATION),
  ];
  for (const orphan of listOrphanSteps()) {
    identities.push(registerNameNumbered(orphan.exportName, 1, orphan));
  }
  return identities;
}
