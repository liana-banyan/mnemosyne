// stored_results.ts -- D-BP152-046/BISHOP/seg-stored-results-and-both-apply, STAGE 1/2
//
// STORED STEP RESULTS AND LITERAL PLACEHOLDER SUBSTITUTION. Ratified ruling:
//   LianaBanyanPlatform\BISHOP_DROPZONE\RULINGS_BP152.md FD-BP152-21.
//
// Founder, BP152, FD-BP152-21, verbatim: "build the stored results... on your point about step 4,
// I want both - I want to be able to ask Google, and I also want the Cascade to apply, as a check
// on each other, so just make both results stored."
//
// His own worked stack, verbatim, which fixes the placeholder syntax chosen below (RULINGS_BP152.md
// FD-BP152-21): "2. Ask Google '...' and store the result as the answer to 2. 3. What factors or
// words or concepts in this question affect the [insert stored result from 2.]? Then store the
// result as the answer to 3. 4. Ask Google 'which of these answers qualify as or are affected by or
// can be eliminated from [insert stored result from 3.]' and store the result as the answer to 4."
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// PLACEHOLDER SYNTAX CHOSEN, AND WHY.
//
// `[insert stored result from <ref>.]` -- his own literal phrase, copy-pasted rather than invented.
// <ref> is either a step's 1-based POSITION in the run's execution order ("2") or a step's
// canonical Name:Number id ("DefineTheTerm:2"), so a reference works whichever way an operator
// naturally thinks of "step 2" -- by where it sits, or by what it is named.
//
// WHY THIS SATISFIES "a non-programmer can type it and it cannot collide with ordinary English"
// (this ticket's own requirement 2): it is not a new notation at all -- it is exactly what the
// Founder typed, unprompted, before this ticket existed. A human would have to type the literal
// bracketed phrase "insert stored result from N." as ordinary prose for a false match to occur,
// which is vanishingly unlikely in a query about a multiple-choice question. And per requirement 4
// below, even a false match only ever produces a loud, named error (never a silent misread) when
// its <ref> does not resolve -- so an accidental collision fails safe rather than fails silent.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// SUBSTITUTION IS LITERAL TEXT REPLACEMENT. NOTHING INTERPRETS IT (HARDWIRE-22).
//
// substitutePlaceholders() below does exactly one thing: find the bracketed span, splice the
// stored result's raw text in verbatim. No model call, no summarizing, no rewriting of either the
// query text or the stored result. This module imports nothing that could call a model or issue a
// network request -- confirmed by this file's own "inert" test.

/** One step's result, stored for the rest of the run. `position` is this step's 1-based place in
 *  the RUN'S OWN execution order (a single, global, flattened counter -- see script_runner.ts's
 *  header for why nested-script steps still share one counter with their parent run). `id` is the
 *  step's canonical Name:Number id. Both are populated on every store() -- "addressable by its
 *  position in the stack and by its Name:Number id" is this ticket's own requirement 1, verbatim. */
export interface StoredStepResult {
  position: number;
  id: string;
  /** The literal, untruncated result text (requirement 6: "do not truncate it on storage"). */
  result: string;
}

/**
 * Holds every step's stored result for one run, addressable both ways. NOT persisted to disk --
 * this ticket adds no persistence (see the dispatch's own FORBIDDEN list) -- lives only in memory
 * for the duration of one runScript() call, threaded through by script_runner.ts.
 *
 * If the same step id runs more than once in a run (a script reused via the FD-BP152-09 nesting
 * recursion, or simply repeated in `steps`), the by-id lookup returns the MOST RECENT run of that
 * id -- by-position lookup is never ambiguous either way, since every execution gets its own
 * position. Documented here rather than silently decided, per HARDWIRE-23.
 */
export class ResultStore {
  private readonly byPosition = new Map<number, StoredStepResult>();
  private readonly byId = new Map<string, StoredStepResult>();

  store(entry: StoredStepResult): void {
    this.byPosition.set(entry.position, entry);
    this.byId.set(entry.id, entry);
  }

  getByPosition(position: number): StoredStepResult | undefined {
    return this.byPosition.get(position);
  }

  getById(id: string): StoredStepResult | undefined {
    return this.byId.get(id);
  }

  /** Every stored result, in position order -- for a run's own final receipt. */
  all(): StoredStepResult[] {
    return [...this.byPosition.values()].sort((a, b) => a.position - b.position);
  }
}

/** Matches his own literal phrase. Captures whatever sits between "from " and the closing "]",
 *  with an optional trailing period (his own example ends the reference "from 2." before the
 *  bracket) -- so both "[insert stored result from 2.]" and "[insert stored result from 2]" match
 *  the same way. Case-insensitive: an operator typing "Insert Stored Result" should not silently
 *  fail to match. */
const PLACEHOLDER_RE = /\[insert stored result from ([^\]]+?)\.?\]/gi;

/** ATTRIBUTED: Founder, BP152, verbatim: "Make the 4,000-character ceiling into 20,000, and then
 *  log if it goes over 10,000, on an oversized substitution." Supersedes the D-BP152-046 TARE
 *  that set this ceiling to 4000 with no Founder order behind it (see that commit, 38416c66) --
 *  this number is now his own, not a reused convention. Kept as an overridable default (same
 *  pattern as script_runner.ts's own injectable Clock) so a caller can still override it, but the
 *  DEFAULT itself is his own stated number, not invented. */
export const DEFAULT_MAX_SUBSTITUTED_QUERY_LENGTH = 20000;

/** ATTRIBUTED: Founder, BP152, verbatim, same sentence as DEFAULT_MAX_SUBSTITUTED_QUERY_LENGTH
 *  above: "...and then log if it goes over 10,000, on an oversized substitution." A substitution
 *  strictly over this length, but at or under the 20,000-char ceiling, still SUCCEEDS -- it is
 *  logged (via formatParserInstrumentLines()'s WARNING line, the same "PARSER INSTRUMENT"
 *  convention this file already uses for every other logged fact) rather than refused. Only going
 *  over DEFAULT_MAX_SUBSTITUTED_QUERY_LENGTH itself is refused (requirement 6, unchanged). */
export const DEFAULT_WARN_SUBSTITUTED_QUERY_LENGTH = 10000;

export type SubstitutionResult =
  | { ok: true; before: string; after: string; warning?: string }
  | { ok: false; error: string; before: string };

/** Resolves one <ref> token (already trimmed) against the store -- a bare non-negative integer is
 *  a position, anything else (including a Name:Number id, which always contains ":") is an id. */
function resolveRef(ref: string, store: ResultStore): StoredStepResult | undefined {
  if (/^\d+$/.test(ref)) {
    return store.getByPosition(Number(ref));
  }
  return store.getById(ref);
}

/**
 * Substitutes every `[insert stored result from <ref>.]` placeholder in `queryText` with the
 * literal stored result it names. Per this ticket's requirements:
 *   (4) a reference to a step that has not run, or does not exist, is an ERROR that stops the run
 *       and names the reference -- never an empty-string substitution, never a skip, never a guess.
 *   (6) a substitution that would produce an unusably long query is reported and refused, never
 *       silently truncated.
 * A `queryText` with no placeholder at all round-trips unchanged (`before === after`), so a step
 * may carry plain, non-referencing query text with zero cost.
 */
export function substitutePlaceholders(
  queryText: string,
  store: ResultStore,
  maxLength: number = DEFAULT_MAX_SUBSTITUTED_QUERY_LENGTH,
  warnLength: number = DEFAULT_WARN_SUBSTITUTED_QUERY_LENGTH,
): SubstitutionResult {
  let firstError: string | null = null;
  const after = queryText.replace(PLACEHOLDER_RE, (whole, refRaw: string) => {
    if (firstError) return whole; // an earlier reference in this same text already failed
    const ref = refRaw.trim();
    const entry = resolveRef(ref, store);
    if (!entry) {
      firstError = `placeholder "${whole}" references "${ref}", which has not run yet or does not `
        + 'exist in this run -- refusing to substitute an empty string, skip the step, or guess';
      return whole;
    }
    return entry.result;
  });
  if (firstError) {
    return { ok: false, error: firstError, before: queryText };
  }
  if (after.length > maxLength) {
    return {
      ok: false,
      error: `substituted query is ${after.length} chars, over the ${maxLength}-char limit -- `
        + 'reporting rather than silently truncating; the stored result this pulled in was not '
        + 'truncated on storage, only this substitution is being refused',
      before: queryText,
    };
  }
  // ATTRIBUTED: Founder, BP152 -- "log if it goes over 10,000, on an oversized substitution".
  // Still a success (`ok: true`): only the ceiling above refuses; this only flags for review.
  if (after.length > warnLength) {
    return {
      ok: true,
      before: queryText,
      after,
      warning: `substituted query is ${after.length} chars, over the ${warnLength}-char `
        + `warning threshold (ceiling is ${maxLength} chars) -- proceeding, flagged for review`,
    };
  }
  return { ok: true, before: queryText, after };
}

/** Formats `sub` using the SAME "PARSER INSTRUMENT"-labeled, bracket-tagged style survey_stage.ts
 *  already established for "log the exact input before any parsing touches it" (that file's own
 *  header comment, cited verbatim in this file's own header). Returned as plain strings rather than
 *  emitted directly -- this module has no MethodRunContext / ctx.emit of its own (script_runner.ts
 *  is generic over `S` and unwired, per its header) -- a future wiring ticket forwards these lines
 *  to a real ctx.emit() unchanged. Satisfies this ticket's requirement 5: "a reader must see what
 *  was inserted."
 */
export function formatParserInstrumentLines(stepLabel: string, sub: SubstitutionResult): string[] {
  const lines: string[] = [
    `   PARSER INSTRUMENT [${stepLabel}] query text BEFORE substitution (untruncated, verbatim)="${sub.before}"`,
  ];
  if (sub.ok) {
    lines.push(
      `   PARSER INSTRUMENT [${stepLabel}] query text AFTER substitution (untruncated, verbatim)="${sub.after}"`,
    );
    if (sub.warning) {
      lines.push(`   PARSER INSTRUMENT [${stepLabel}] WARNING: ${sub.warning}`);
    }
  } else {
    lines.push(`   PARSER INSTRUMENT [${stepLabel}] substitution FAILED: ${sub.error}`);
  }
  return lines;
}
