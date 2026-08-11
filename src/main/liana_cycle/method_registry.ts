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
 *  shape differs from AskGoogleFn. */
export type ConversationalAuthorityFn = (question: string) => Promise<ConversationalAuthorityResult>;

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
}

export interface ShapeTestResult {
  matches: boolean;
  /** ALWAYS present, matched or not -- this is what the transcript prints for every method it
   *  checked (BP149: "I DESPISE SUMMARIES", stream everything). A bare boolean tells the
   *  Founder nothing about WHY a method was skipped. */
  reason: string;
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
