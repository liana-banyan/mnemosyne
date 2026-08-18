// cross_acquisition.ts -- D-BP154-008/BISHOP/S8/seg-mortgage
//
// LIFTS FD-BP153-04 BOUNDARY 4, EXACTLY AS THIS TICKET AUTHORIZES.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// FD-BP153-03, Founder verbatim: "we don't pay rent on answers, we pay the mortgage to own them."
// FD-BP153-05: "the zero-query derivation IS the process." method_registry.ts's own doc comment
// on `MethodRunContext.ownedPassages` says, verbatim: "OWNED MEANS THIS RUN ONLY... never the
// evidence store on disk, never a prior acquisition; a caller must not reach across acquisitions
// to populate this." Bishop wrote that boundary (FD-BP153-04). TICKET_D-BP154-008_THE_MORTGAGE.md
// names it explicitly: "FD-BP153-04 boundary 4 is the thing being lifted... This ticket
// authorizes reaching across acquisitions, with the provenance requirement... as the price of
// it." This file is that lift, and the provenance it prices.
//
// NOT A SECOND READER. Every byte read off disk here goes through evidence_store.ts's own
// `listAcquisitions()`/`loadAcquisition()` -- this file adds no file I/O of its own, only the
// exact-query-text lookup and provenance bookkeeping those two functions do not already do.
// `findPriorAcquisitionMatch()` below is the ONE place that walks acquisitions looking for a
// match; nothing else in this ticket re-derives that search.
//
// WHY EXACT QUERY TEXT, NOTHING FUZZIER. A reused passage must answer the SAME question, byte for
// byte, as the one this run is about to ask -- matched by `deriveQueryKey(authority, query)`, the
// SAME content-address evidence_store.ts's own replay path already trusts (evidence_authority.ts,
// buildReplay()). Extraction only, never judgment (HARDWIRE-22 UNRELAXED): this file selects no
// passage by what it says, only by whether it is the recorded answer to the LITERAL text about to
// be asked. It never reads `correctAnswer` and cannot be tuned toward a letter (FD-BP153-06's own
// test: "would this rule survive on a question whose answer we do not know?" -- yes, unchanged:
// the match is keyed on query text and authority alone).
//
// GOOGLE'S SCHEMA IS NOT CONVERTED HERE. `EvidenceRecord.response` for a 'google' record is a
// `BrowserAuthorityRawExtraction` (shared/plow/browser_authority_types.ts) whose content lives in
// `response.results[]` (an array of `{rank, url, title, snippet}`) -- `response.snippet` itself is
// EMPTY on every one of the 363 Google records measured for this ticket. The ONLY function that
// already knows how to turn that raw shape into usable text is `googleBlocks()`
// (methods/comparative_cascade.ts, FORBIDDEN to modify by this ticket) -- so this file never
// reimplements that read. `resolveReusedText()` below hands `googleBlocks()` a one-shot stub
// `askGoogle` that returns the STORED response once (tries=1, no retry/sleep, no network), which
// makes this an extraction over evidence already in hand through the SAME parser a live query
// would use, never a second, independently-written one.
//
// NO STALENESS POLICY. THIS TICKET DOES NOT AUTHORIZE ONE (WHAT TO BUILD, section 5). `ageMs` is
// computed and reported so a transcript names the age of every reused passage; nothing here
// compares it to a cutoff, prefers a newer acquisition over an older one, or discards a passage
// for being old. `listAcquisitions()`'s own order (oldest acquisition id first) is used only as a
// DETERMINISTIC tie-break when more than one prior acquisition holds the same query -- not a
// recency preference, and not something a caller should read meaning into beyond "reproducible".
import { deriveQueryKey, listAcquisitions, loadAcquisition } from './evidence_store';
// FORBIDDEN FILE, IMPORT ONLY -- comparative_cascade.ts itself is not modified anywhere by this
// ticket (HARD BOUNDARIES, TICKET_D-BP154-008_THE_MORTGAGE.md: "comparative_cascade.ts is
// FORBIDDEN"). classify_cascade.ts already imports `googleBlocks` from this same file the
// identical way (see classify_cascade.ts's own "SHARED PREFIX" header) -- reusing an EXPORTED
// function is not touching the file that exports it.
import { googleBlocks } from '../methods/comparative_cascade';
/**
 * Searches every acquisition on disk for `qid` for the first record whose (authority, query)
 * queryKey matches, in `listAcquisitions()`'s own stable order (oldest acquisition id first --
 * a deterministic tie-break, not a recency preference; see this file's header). Returns null when
 * none is found -- an absent match is never fabricated into an empty-but-truthy result.
 *
 * `excludeAcquisitionId` -- the acquisition THIS run is currently writing, if any, so a run never
 * "reuses" the record it is itself in the middle of producing (that is not reaching across
 * acquisitions, it is reading your own hand mid-write, and would mislabel a live, this-run answer
 * as a prior-acquisition one). Passing undefined excludes nothing beyond what `qid` and the query
 * already select.
 *
 * `now` is injectable so a test can pin `ageMs` to an exact value rather than racing the clock.
 */
export function findPriorAcquisitionMatch(qid, authority, query, opts) {
    const dir = opts?.dir;
    const nowIso = opts?.now ? opts.now() : new Date().toISOString();
    const key = deriveQueryKey(authority, query);
    const ids = listAcquisitions(qid, dir);
    for (const acquisitionId of ids) {
        if (acquisitionId === opts?.excludeAcquisitionId)
            continue;
        const { acquisition } = loadAcquisition(qid, acquisitionId, dir);
        if (!acquisition)
            continue;
        const hit = acquisition.records.find((r) => r.queryKey === key && r.authority === authority);
        if (hit) {
            const ageMs = Math.max(0, new Date(nowIso).getTime() - new Date(hit.ts).getTime());
            return { record: hit, acquisitionId, ts: hit.ts, ageMs };
        }
    }
    return null;
}
/** Reads the TEXT out of a matched record, schema-correct per authority. 'conversational' is
 *  `response.text` (method_registry.ts's own ConversationalAuthorityResult). 'google' is read
 *  through `googleBlocks()` (see this file's header for why) via a one-shot stub `askGoogle` that
 *  returns the stored response and nothing else -- `tries=1` means no retry, no `sleep()`, and no
 *  network reachable from this call. Returns '' (never throws, never fabricates) when the stored
 *  response carries no usable content -- an empty result here simply means this candidate does
 *  not answer the question, exactly as a live query that came back empty would. */
async function resolveReusedText(m, askedText) {
    if (m.record.authority === 'conversational') {
        const r = m.record.response;
        return (r?.text ?? '').trim();
    }
    const stub = async () => m.record.response;
    const res = await googleBlocks(stub, askedText, 1);
    return res.ok ? res.text.trim() : '';
}
/** One line, safe to hand straight to a transcript `note()`, naming exactly what this ticket's
 *  provenance requirement (WHAT TO BUILD, section 5) demands: acquisition id, timestamp, and age
 *  AT TIME OF USE. No cutoff is ever computed or compared here -- age is reported, never judged. */
export function describePriorAcquisitionProvenance(m) {
    const ageMinutes = Math.round(m.ageMs / 60000);
    const ageDesc = ageMinutes < 60
        ? `${ageMinutes} minute${ageMinutes === 1 ? '' : 's'}`
        : `${(ageMinutes / 60).toFixed(1)} hour(s)`;
    return `acquisition ${m.acquisitionId}, recorded ${m.ts}, age ${ageDesc} at time of use`;
}
/**
 * Builds OwnedPassage[] entries sourced from PRIOR acquisitions, for the SAME meta-questions
 * `MethodRunContext.ownedPassages` already carries THIS RUN's own answers for ('ambiguity',
 * 'operation' -- liana_terminal_engine.ts's own ownedPassages() builder). Scoped to exactly these
 * two named questions, never a broader "any prior query" search: their query text is static and
 * deterministic per qid (survey_stage.ts's `getQueryText()`), so an exact match against a prior
 * acquisition genuinely answers the SAME question this run is asking, not a merely similar one.
 *
 * Tried for BOTH authorities per question ('conversational' first, mirroring
 * obtainMetaQuestionPassage()'s own preference order in survey_stage.ts) -- a prior run may have
 * been answered by either. At most ONE prior-acquisition passage is added per meta-question (the
 * first authority that yields usable text): two owned passages both claiming to be "the"
 * ambiguity reuse for one query would be redundant and would double the FIX-1/FIX-3 rejection
 * notes filterUsableOwnedPassages() (classify_cascade.ts) already emits for one, for no benefit.
 *
 * Every returned entry carries `acquisitionId`/`acquiredAt`/`ageMsAtUse` (OwnedPassage,
 * method_registry.ts, D-BP154-008 ADDITIVE fields) -- the marker liana_terminal_engine.ts and
 * classify_cascade.ts's own QUERY BILL use to tell "this run's own" and "a PRIOR acquisition"
 * apart without a second, parallel bookkeeping structure.
 */
export async function buildPriorAcquisitionOwnedPassages(qid, asks, opts) {
    const out = [];
    for (const ask of asks) {
        if (!ask.askedText || !ask.askedText.trim())
            continue;
        const askedText = ask.askedText;
        // eslint-disable-next-line no-restricted-syntax -- sequential by design: 'conversational' is
        // tried, and only checked for usable text, before 'google' is even looked up, mirroring
        // obtainMetaQuestionPassage()'s own authority order; a for-of with an early `break` reads
        // clearer here than a .find()-with-side-effects would.
        for (const authority of ['conversational', 'google']) {
            const match = findPriorAcquisitionMatch(qid, authority, askedText, opts);
            if (!match)
                continue;
            // eslint-disable-next-line no-await-in-loop -- each lookup is a local disk read plus, on the
            // Google branch, ONE pass of googleBlocks()'s own text assembly over a response already in
            // hand (tries=1, no network) -- nothing here is a fan-out worth parallelizing.
            const text = await resolveReusedText(match, askedText);
            if (!text)
                continue;
            out.push({
                text,
                kind: ask.kind,
                sourceQuery: askedText,
                acquisitionId: match.acquisitionId,
                acquiredAt: match.ts,
                ageMsAtUse: match.ageMs,
            });
            break;
        }
    }
    return out;
}
