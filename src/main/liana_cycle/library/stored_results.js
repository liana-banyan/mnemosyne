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
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// D-BP152-049 STAGE 2/4 -- A BARE PLACEHOLDER ON A BOTH-APPLY STEP REFUSES.
//
// Founder, BP152, verbatim: "when a bare placeholder is used on a both-apply step, I want it to
// refuse and make me say which, for the test runs and then we can make it one or the other as
// results recommend." D-BP152-046 (STAGE 2/2, commit caf7b873) resolved a bare
// `[insert stored result from <ref>.]` referencing a bothApply step to the Cascade's own result --
// a documented interpretation, never his ruling. This ticket REMOVES that default: a bare
// reference to a bothApply step's stored result is now refused, names the step, and states the
// two explicit forms he must choose between:
//   `[insert stored result from <ref> (source).]`   -- the source's own application (e.g. Google)
//   `[insert stored result from <ref> (cascade).]`  -- the Cascade's own application
// Neither is a default; both are typed choices. A qualifier on a step that was NOT bothApply is
// likewise refused (rather than silently ignored) -- the same fail-loud discipline this file
// already uses everywhere else (a false match never silently misreads, HARDWIRE-22).
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
    constructor() {
        this.byPosition = new Map();
        this.byId = new Map();
    }
    store(entry) {
        this.byPosition.set(entry.position, entry);
        this.byId.set(entry.id, entry);
    }
    getByPosition(position) {
        return this.byPosition.get(position);
    }
    getById(id) {
        return this.byId.get(id);
    }
    /** Every stored result, in position order -- for a run's own final receipt. */
    all() {
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
// D-BP152-051/BISHOP/seg-assisted-mode, ADDITIVE. Founder ruling, BP152: "a query carrying a
// placeholder depends on an earlier step; a query with no placeholder depends on nothing."
// query_batch_planner.ts needs to know WHICH refs a queryText names, WITHOUT resolving them
// against a live ResultStore (batch planning happens before any step has run, so there is nothing
// to resolve yet) -- this is that lookup, reusing PLACEHOLDER_RE (the SAME regex
// substitutePlaceholders() above uses) rather than a second pattern. Pure text scan: no model, no
// inference (HARDWIRE-22). Returns the BASE ref only (a "(source)"/"(cascade)" qualifier, when
// present, names which SIDE of a bothApply step's result to use -- it does not change WHICH STEP
// the dependency points at, so it is stripped here the same way parseRef() strips it above).
// Duplicate refs in the same queryText are returned once each (a step depending on step 2 twice
// still only waits on step 2 once).
export function extractPlaceholderRefs(queryText) {
    const refs = new Set();
    // Reset lastIndex defensively -- PLACEHOLDER_RE carries the module-level `g` flag and matchAll()
    // below takes its own copy per call, but this keeps the function safe even if that changes.
    for (const m of queryText.matchAll(PLACEHOLDER_RE)) {
        const { baseRef } = parseRef(m[1].trim());
        refs.add(baseRef);
    }
    return [...refs];
}
/** Resolves one <ref> token (already trimmed) against the store -- a bare non-negative integer is
 *  a position, anything else (including a Name:Number id, which always contains ":") is an id. */
function resolveRef(ref, store) {
    if (/^\d+$/.test(ref)) {
        return store.getByPosition(Number(ref));
    }
    return store.getById(ref);
}
/** D-BP152-049 STAGE 2/4. Matches an optional trailing `(source)`/`(cascade)` qualifier on a
 *  reference, e.g. "2 (source)" or "DefineTheTerm:2 (cascade)" -- case-insensitive, same as the
 *  outer PLACEHOLDER_RE. Group 1 is the base ref (still resolved exactly as before, by position
 *  or by Name:Number id); group 2, when present, is 'source' or 'cascade' (lowercased below). */
const QUALIFIER_RE = /^(.*?)\s*\((source|cascade)\)$/i;
function parseRef(ref) {
    const m = ref.match(QUALIFIER_RE);
    if (!m)
        return { baseRef: ref, qualifier: undefined };
    return { baseRef: m[1].trim(), qualifier: m[2].toLowerCase() };
}
/** D-BP152-049 STAGE 2/4. The two explicit forms an operator must choose between on a both-apply
 *  step -- built here, once, so the refusal message and any future caller state the SAME syntax,
 *  never two slightly-different renderings of it. */
function explicitBothApplySyntax(baseRef) {
    return `"[insert stored result from ${baseRef} (source).]" for the source's result, or `
        + `"[insert stored result from ${baseRef} (cascade).]" for the Cascade's result`;
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
export function substitutePlaceholders(queryText, store, maxLength = DEFAULT_MAX_SUBSTITUTED_QUERY_LENGTH, warnLength = DEFAULT_WARN_SUBSTITUTED_QUERY_LENGTH) {
    let firstError = null;
    const after = queryText.replace(PLACEHOLDER_RE, (whole, refRaw) => {
        if (firstError)
            return whole; // an earlier reference in this same text already failed
        const ref = refRaw.trim();
        const { baseRef, qualifier } = parseRef(ref);
        const entry = resolveRef(baseRef, store);
        if (!entry) {
            firstError = `placeholder "${whole}" references "${baseRef}", which has not run yet or does `
                + 'not exist in this run -- refusing to substitute an empty string, skip the step, or guess';
            return whole;
        }
        if (entry.bothApply) {
            // D-BP152-049 STAGE 2/4, Founder BP152 verbatim: "when a bare placeholder is used on a
            // both-apply step, I want it to refuse and make me say which." A bare reference (no
            // qualifier) refuses outright, naming the step and both explicit forms; a qualified
            // reference resolves to exactly the named side, never a blend or a default.
            if (!qualifier) {
                firstError = `placeholder "${whole}" bare-references step ${entry.position} `
                    + `("${entry.id}"), which was a both-apply step -- both the source's and the Cascade's `
                    + 'results were stored, and a bare reference is refused rather than silently picking '
                    + 'one. Specify which result you want: use '
                    + `${explicitBothApplySyntax(baseRef)}.`;
                return whole;
            }
            return qualifier === 'source' ? entry.bothApply.sourceResult : entry.bothApply.cascadeResult;
        }
        if (qualifier) {
            firstError = `placeholder "${whole}" specifies "(${qualifier})" but step ${entry.position} `
                + `("${entry.id}") was not a both-apply step -- only a both-apply step has separate `
                + `source/cascade results; use "[insert stored result from ${baseRef}.]" instead`;
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
export function formatParserInstrumentLines(stepLabel, sub) {
    const lines = [
        `   PARSER INSTRUMENT [${stepLabel}] query text BEFORE substitution (untruncated, verbatim)="${sub.before}"`,
    ];
    if (sub.ok) {
        lines.push(`   PARSER INSTRUMENT [${stepLabel}] query text AFTER substitution (untruncated, verbatim)="${sub.after}"`);
        if (sub.warning) {
            lines.push(`   PARSER INSTRUMENT [${stepLabel}] WARNING: ${sub.warning}`);
        }
    }
    else {
        lines.push(`   PARSER INSTRUMENT [${stepLabel}] substitution FAILED: ${sub.error}`);
    }
    return lines;
}
