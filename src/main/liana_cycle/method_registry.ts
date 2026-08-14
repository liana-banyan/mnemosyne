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
    // R-6: demand PRECEDES shape. Shape asks "can this machinery operate on this option set";
    // demand asks "is this method's operation the one the question wants". Both must pass, and
    // demand is checked first because it is the cheaper and more decisive of the two.
    if (demandGated && method.demand !== demand) continue;
    const shape = method.shapeTest(input);
    if (shape.matches) return { method, shape };
  }
  return null;
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

/** Registers the ten pre-existing entries this ticket was asked to register: the three cascade
 *  methods, the Survey stage, and the 6 verified orphans from orphan_catalog.ts. NOT called at
 *  module load -- a caller invokes this explicitly. Calling it twice throws on the second call
 *  (every id it registers would already be present), the same "duplicate is an error" behavior
 *  registerNameNumbered() gives every caller. */
export function registerKnownMethods(): MethodIdentity[] {
  const identities: MethodIdentity[] = [
    registerNameNumbered('ComparativeCascade', 1, COMPARATIVE_CASCADE_DECLARATION),
    registerNameNumbered('DefinitionalCascade', 1, DEFINITIONAL_CASCADE_DECLARATION),
    registerNameNumbered('ClassifyCascade', 1, CLASSIFY_CASCADE_DECLARATION),
    registerNameNumbered('Survey', 1, SURVEY_DECLARATION),
  ];
  for (const orphan of listOrphanSteps()) {
    identities.push(registerNameNumbered(orphan.exportName, 1, orphan));
  }
  return identities;
}
