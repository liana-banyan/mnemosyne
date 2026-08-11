// query_batch_planner.ts -- D-BP152-051/BISHOP/seg-assisted-mode, STAGE 2/2
//
// BATCH THE INDEPENDENT QUERIES, ROUND-TRIP ONLY ON REAL DEPENDENCIES. Founder ruling, BP152
// (RULINGS_BP152.md, this ticket's own dispatch, D-BP152-051):
//
//   "A query carrying a placeholder ([insert stored result from <ref>.], D-BP152-046) DEPENDS on
//   an earlier step and must wait. A query with no placeholder depends on nothing and can be
//   issued in any order... Compute the dependency structure from the placeholders alone -- no
//   model, no inference, pure text (HARDWIRE-22)... Present every currently-independent query as
//   ONE batch, numbered, so he can run them in a single browser sitting and paste the answers
//   back together... Only a genuine placeholder dependency forces a new round."
//
// WHAT THIS FILE DOES. Given an already-validated Script (script.ts, D-BP152-041), computes the
// ROUND STRUCTURE its query-bearing steps would need under assisted-mode batching: which steps
// can be issued together (a round/batch) and which must wait for an earlier round's answers to
// be stored first. PURE TEXT ANALYSIS ONLY -- reads stored_results.ts's own
// extractPlaceholderRefs() (the SAME regex substitutePlaceholders() uses to actually resolve a
// placeholder at run time, not a second pattern) and does nothing else: no model call, no
// network call, no I/O. This is exactly the "no model, no inference, pure text" instrument the
// ruling itself names.
//
// SCOPE, DISCLOSED RATHER THAN SILENTLY ASSUMED: TOP-LEVEL steps only. A ScriptStepRef that
// resolves to a NESTED SCRIPT (FD-BP152-09's own recursion) is treated as one opaque structural
// step here -- this file does not descend into it, because doing so correctly requires a live
// ScriptResolver (to know whether an id is a nested script at all) and this function is
// deliberately resolver-free so it stays a pure, no-lookup, text-only computation, matching
// HARDWIRE-22's own "no model, no inference" instrument requirement literally. A script containing
// a nested-script step still plans correctly for its OWN top-level steps; the nested script's
// internal rounds are simply not expanded into this plan (recorded on BatchPlan.opaqueNestedIds).
//
// A STEP WITH NO queryText IS NOT A QUERY -- it is a structural/method step (e.g.
// 'StateTheQuestion:1', a bothApply-only step with nothing to compose) that the ordinary
// script_runner.ts executor already runs; it is never placed into a round, but it DOES satisfy
// any LATER step's placeholder reference to it (its stored result becomes available once it runs,
// exactly as stored_results.ts's ResultStore already models). A non-query step's own POSITION IN
// DECLARED ORDER also forces a round boundary: because a placeholder can only ever reference an
// EARLIER step's stored result (script.ts's own doc comment on `queryText`; a forward reference
// can never resolve at real run time, stored_results.ts's substitutePlaceholders() proves this by
// construction -- ResultStore only ever contains what has already run), this planner never lets a
// batch's membership imply an execution order the real runner would not itself produce: every
// structural step closes whatever batch was accumulating before it, since nothing after a
// structural step in declared order may be assumed independent of its (unknown until it runs)
// effect. This is Bishop's own reading of an otherwise-underspecified interleaving rule, disclosed
// here rather than installed silently (HARDWIRE-23 LAW 2) -- see this ticket's own deliverable,
// "THINGS I NOTICED AND DID NOT DO".

import type { MethodIdentity, Script, ScriptStepRef } from './script';
import { extractPlaceholderRefs } from './stored_results';

/** One query-bearing step, as planned -- not yet run. */
export interface PlannedQuery {
  /** 1-based position in `script.steps` (top-level array index + 1) -- the SAME numbering
   *  script_runner.ts's own `position.next` counter would assign to this step AT RUN TIME,
   *  provided the script contains no nested-script step before it (see this file's header,
   *  "SCOPE"). Disclosed, not silently assumed correct on a script that nests. */
  position: number;
  id: string;
  queryText: string;
  /** The base refs this step's queryText names (qualifiers like "(source)"/"(cascade)" stripped --
   *  a dependency is on the STEP, not on which side of a bothApply result). */
  dependsOn: string[];
}

export interface BatchRound {
  /** 1-based round number -- round 1 is the first batch presentable with no waiting at all. */
  round: number;
  queries: PlannedQuery[];
}

/** A query whose dependency can never be satisfied by this script -- refers to a position/id that
 *  is not an EARLIER top-level step in this same script (either it does not exist here at all, or
 *  it names itself/a later step, which stored_results.ts's own ResultStore can never satisfy at
 *  real run time either -- see this file's header). Reported rather than silently placed in a
 *  round it can never actually run in. */
export interface UnresolvablePlannedQuery {
  step: PlannedQuery;
  missingRefs: string[];
}

export interface BatchPlan {
  /** Every top-level step that carries `queryText`, grouped into rounds. A step whose dependency
   *  is unresolvable (see above) is EXCLUDED from `rounds` and listed in `unresolvable` instead --
   *  it is never silently placed in a round it cannot actually satisfy. */
  rounds: BatchRound[];
  unresolvable: UnresolvablePlannedQuery[];
  /** Top-level steps with no `queryText` at all -- not queries, never batched, run via the
   *  ordinary script_runner.ts executor. Listed for completeness/transcript display only. */
  structuralStepIds: string[];
  /** Nested-script step ids this plan did not expand -- see this file's header, "SCOPE". Empty on
   *  a script with no nested steps (qid 98's default run has none -- see this ticket's own
   *  deliverable). Populated only if `resolveKind` is supplied and reports 'script' for an id;
   *  when `resolveKind` is omitted, every step is treated as a leaf (never listed here), which is
   *  the ONLY way this file stays resolver-free by default -- see planBatches()'s own doc comment. */
  opaqueNestedIds: string[];
}

/** Total number of rounds this plan requires -- what the deliverable/transcript reports as "how
 *  many rounds a given stack requires". 0 for a script with no query-bearing steps at all (this
 *  ticket's own honest finding for qid 98's default run, which is not an authored Script and so
 *  has no queryText-bearing steps to batch -- see the deliverable). */
export function roundCount(plan: BatchPlan): number {
  return plan.rounds.length;
}

/**
 * Computes the round/batch structure for `script`'s top-level query-bearing steps.
 *
 * `resolveKind` is OPTIONAL and, when supplied, is consulted ONLY to tell a nested-script step
 * apart from a primitive method (so it can be reported honestly in `opaqueNestedIds` rather than
 * mis-planned as a structural leaf) -- it is never used to look up a query's ANSWER, a model, or
 * any live state, so this remains a pure, no-network, no-inference computation either way
 * (HARDWIRE-22). Omitting it (the default) means every step is planned as a leaf; correct for any
 * script with no nested-script steps, which is every script this ticket's own deliverable
 * measures (qid 98's default run is not an authored script at all -- see there).
 */
export function planBatches(
  script: Script,
  resolveKind?: (id: string) => 'method' | 'script' | 'unresolved',
): BatchPlan {
  const steps = script.steps;

  // First pass: every top-level step's declared index (0-based) and both ref forms it can be
  // addressed by (position-as-string, and its own Name:Number id) -- needed up front so a
  // dependency check can tell "an earlier real step" from "does not exist in this script at all
  // / names itself or something later", per this file's header.
  const declaredIndexByRef = new Map<string, number>();
  steps.forEach((stepRef, i) => {
    declaredIndexByRef.set(String(i + 1), i);
    declaredIndexByRef.set(stepRef.id, i);
  });

  const structuralStepIds: string[] = [];
  const opaqueNestedIds: string[] = [];
  const rounds: BatchRound[] = [];
  const unresolvable: UnresolvablePlannedQuery[] = [];

  // Refs (position-as-string and id) whose stored result is available -- i.e. the step has
  // either already run structurally (in declared-order processing, below) or was placed in an
  // EARLIER round. Never includes a ref still sitting in the batch currently being built.
  const resolvedRefs = new Set<string>();

  let currentBatch: PlannedQuery[] = [];

  const closeBatch = () => {
    if (currentBatch.length === 0) return;
    rounds.push({ round: rounds.length + 1, queries: currentBatch });
    for (const q of currentBatch) {
      resolvedRefs.add(String(q.position));
      resolvedRefs.add(q.id);
    }
    currentBatch = [];
  };

  steps.forEach((stepRef: ScriptStepRef, i) => {
    const position = i + 1;
    const kind = resolveKind ? resolveKind(stepRef.id) : 'method';

    if (kind === 'script') {
      // A nested script is opaque here (see this file's header, "SCOPE") -- treated the SAME as
      // a structural step for round-boundary purposes (its own internal queries are not this
      // plan's concern), and its result becomes available to LATER top-level steps once it runs,
      // exactly like any other structural step.
      closeBatch();
      opaqueNestedIds.push(stepRef.id);
      resolvedRefs.add(String(position));
      resolvedRefs.add(stepRef.id);
      return;
    }

    if (stepRef.queryText === undefined) {
      // A structural/method step with no query text -- forces a round boundary (see header) and
      // becomes available to later references once past this point.
      closeBatch();
      structuralStepIds.push(stepRef.id);
      resolvedRefs.add(String(position));
      resolvedRefs.add(stepRef.id);
      return;
    }

    const dependsOn = extractPlaceholderRefs(stepRef.queryText);
    const planned: PlannedQuery = { position, id: stepRef.id, queryText: stepRef.queryText, dependsOn };

    // A ref this script cannot ever satisfy -- does not exist here, or names itself/a later step
    // (stored_results.ts's own ResultStore can never contain a not-yet-run step's result at real
    // run time -- see this file's header). Reported, never silently batched.
    const missingRefs = dependsOn.filter((ref) => {
      const declaredAt = declaredIndexByRef.get(ref);
      return declaredAt === undefined || declaredAt >= i;
    });
    if (missingRefs.length > 0) {
      unresolvable.push({ step: planned, missingRefs });
      return;
    }

    const allSatisfied = dependsOn.every((ref) => resolvedRefs.has(ref));
    if (!allSatisfied) {
      // Depends on something still in the batch currently being built (a real, earlier step, but
      // not yet resolved because ITS round has not closed) -- forces this batch closed first, so
      // the dependency is satisfied by the time this step's own round opens.
      closeBatch();
    }
    currentBatch.push(planned);
  });

  closeBatch();

  return { rounds, unresolvable, structuralStepIds, opaqueNestedIds };
}

// ─────────────────────────────── matching answers back to a batch ───────────────────────────────
//
// Founder ruling, BP152, this ticket's own dispatch: "Answers must be matched to their queries
// unambiguously -- if he pastes them out of order or misses one, the run must say which query is
// unanswered rather than mis-binding a result. A silently mis-bound answer is the worst possible
// failure here, because every downstream elimination would cite the wrong source."
//
// An answer is matched by its REF (a position-as-string, e.g. "3", or a Name:Number id, e.g.
// "Q:3") -- never by the order it happens to arrive in. This is what makes mis-binding
// structurally impossible rather than merely unlikely: pasting answers in a scrambled order still
// binds each one to the query it names, and an answer whose ref does not belong to this round is
// reported as unrecognized rather than silently applied to the nearest unanswered query.

/** One answer the operator supplied for a batch -- `ref` is either the query's 1-based position
 *  (as a string, e.g. "3") or its Name:Number id (e.g. "Q:3"), exactly the same two ref forms
 *  stored_results.ts's own placeholder syntax already accepts. */
export interface BatchAnswer {
  ref: string;
  text: string;
}

export interface MatchedBatchAnswer {
  query: PlannedQuery;
  text: string;
}

export interface BatchMatchResult {
  matched: MatchedBatchAnswer[];
  /** Queries in this round that received no answer at all -- named explicitly, never silently
   *  skipped or left for a caller to notice is missing from `matched`. */
  missing: PlannedQuery[];
  /** Answers supplied whose `ref` does not name any query in THIS round -- e.g. a stale answer
   *  from a previous round, a typo, or a ref belonging to a later round. Never guessed into the
   *  nearest empty slot; reported by its own ref string so the operator can see exactly what did
   *  not bind. */
  unrecognizedRefs: string[];
}

/**
 * Binds a batch of pasted-back answers to the round's own queries, by ref -- never by array
 * position of the pasted answers, which is what makes an out-of-order paste safe rather than a
 * silent mis-bind. An answer naming the SAME query twice keeps the LAST one (matching
 * stored_results.ts's own ResultStore "most recent by-id" convention, documented there rather than
 * silently decided) -- flagged nowhere further because it is the operator correcting himself
 * within one sitting, not a missing/ambiguous case.
 */
export function matchBatchAnswers(round: BatchRound, answers: BatchAnswer[]): BatchMatchResult {
  const byPosition = new Map<number, PlannedQuery>();
  const byId = new Map<string, PlannedQuery>();
  for (const q of round.queries) {
    byPosition.set(q.position, q);
    byId.set(q.id, q);
  }

  const boundByPosition = new Map<number, string>();
  const unrecognizedRefs: string[] = [];

  for (const answer of answers) {
    const ref = answer.ref.trim();
    const q = /^\d+$/.test(ref) ? byPosition.get(Number(ref)) : byId.get(ref);
    if (!q) {
      unrecognizedRefs.push(answer.ref);
      continue;
    }
    boundByPosition.set(q.position, answer.text);
  }

  const matched: MatchedBatchAnswer[] = [];
  const missing: PlannedQuery[] = [];
  for (const q of round.queries) {
    const text = boundByPosition.get(q.position);
    if (text === undefined) {
      missing.push(q);
    } else {
      matched.push({ query: q, text });
    }
  }

  return { matched, missing, unrecognizedRefs };
}

// Re-exported for callers that only need the identity type for a resolveKind() they build
// themselves (e.g. wiring this against library/method_registry.ts's own lookupById()).
export type { MethodIdentity };
