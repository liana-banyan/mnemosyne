// composer_step_evidence.ts -- D-BP154-014/BISHOP/S14/seg-milkthem
//
// SHARED "OWNED EVIDENCE -> GEMINI ANSWERS -> GOOGLE CORROBORATES" PLUMBING for the three Composer
// steps (softballs_step.ts, named_set_step.ts, discriminator_step.ts). Extracted here, rather than
// duplicated a third time, because all three steps now need the IDENTICAL priority order, the
// IDENTICAL corroboration discipline, and the IDENTICAL provenance tagging -- this is the same kind
// of shared, generic primitive comparative_cascade.ts's own exports already are for the pre-existing
// cascades. HARDWIRE-22 applies here exactly as it does there: extraction only, never judgment.
// classify_cascade.ts and comparative_cascade.ts themselves are read-only imports, never modified.
//
// THE ORDER, FD-BP153-04 + FD-BP154-02 (RULINGS_BP154.md), BOTH BINDING:
//   1. OWNED EVIDENCE FIRST. (a) THE MORTGAGE (D-BP154-008, cross_acquisition.ts, imported
//      read-only, unmodified -- that commit, 7d001cff, is LOCKED) -- has this run's EXACT query
//      text already been asked, by either authority, in a PRIOR acquisition on disk? Byte-for-byte
//      match, zero judgment. (b) THIS RUN'S OWN already-acquired passages (ctx.ownedPassages(),
//      when the caller wired it) -- excluding 'ambiguity'-kind passages, FD-BP153-07 FIX 1: "a
//      passage acquired to answer what is ambiguous here may never source a claim about what IS."
//   2. GEMINI ANSWERS (ctx.askConversationalAuthority) -- FD-BP154-02 verbatim: "use gemini to
//      answer, google to corroborate." The SAME query text the step already built, no judgment
//      prompt, no re-tuning.
//   3. Neither answers -> NOT_OBTAINED. This file does NOT fall back to asking Google the original
//      question -- the four mechanism classes FD-BP154-03 names have no "Google answers" slot, and
//      FD-BP154-02's ruling is that Google's job here is corroboration, not answering. A caller
//      that gets nothing from stages 1-2 reports a named failure; it does not invent a fourth path.
//
// CORROBORATION IS A SEPARATE ACT FROM ANSWERING (FD-BP154-02, corrected same session: "what
// corroborates is the DOCUMENT, not Google" -- Gemini and Google web search are ONE vendor, so
// Google agreeing with Gemini is not independent corroboration in the vendor sense; it is the
// qid-92 false-consensus shape ("four sources said B; one derivation path counted four times") if
// treated as a second opinion). `corroborateClaim()` below NEVER records "Google confirmed it" --
// it records a THIRD-PARTY document's own URL, title, and a verbatim span FROM THAT DOCUMENT'S OWN
// TEXT, or it records that corroboration was attempted and not obtained. An `answer_box`/no-URL
// block (not attributable to any one document) is never treated as a corroborating source.
//
// PROVENANCE IS BY MECHANISM, NOT BY SOURCE NAME (FD-BP154-03, canon BP143-144: "the independence
// unit is the derivation path, not the source name"). Every candidate/claim below carries a
// `ClaimProvenance` naming WHICH of the four mechanism classes produced it and a structural
// `sourceId` identifying the SPECIFIC underlying response/document/acquisition it came from -- a
// STRUCTURAL FACT the code already knows (which function ran, which record/URL it read), never
// inferred or asked of a model. `sameDerivationPath()` is the one place two provenances are
// compared, and it is a plain (mechanism, sourceId) equality check -- no similarity, no judgment.
//
// NO FUNCTION HERE MAY SELECT A PARTICULAR ANSWER LETTER (FD-BP153-06). Every function below
// treats every option/claim identically; nothing branches on which letter is which.
import { createHash } from 'node:crypto';
import { appearsIn, gemmaExtract, googleBlocks, } from '../methods/comparative_cascade';
import { describePriorAcquisitionProvenance, findPriorAcquisitionMatch, } from '../evidence/cross_acquisition';
import { timeAtomicQuery } from './measurement_receipts';
// ───────────────────────────────── span verification (shared) ─────────────────────────────────
/** Whitespace-normalized verbatim containment -- same discipline every step file already
 *  duplicates locally (softballs_step.ts / named_set_step.ts / discriminator_step.ts's own
 *  spanIsVerbatimInPassage(), FD-BP153-07 FIX 2). Shared here so the corroboration logic below
 *  does not become a fourth copy; the three step files keep their own copies for their own
 *  extraction passes, unchanged. */
export function spanIsVerbatimInPassage(passage, span) {
    const norm = (s) => s.replace(/\s+/g, ' ').trim();
    const s = norm(span);
    if (!s)
        return false;
    return norm(passage).includes(s);
}
/** THE ONE PLACE two provenances are compared. Plain (mechanism, sourceId) equality -- no
 *  similarity, no model judgment, HARDWIRE-22 safe. A 'NOT_OBTAINED' provenance never counts as
 *  sharing a path with anything (there is no response/document behind it to share). */
export function sameDerivationPath(a, b) {
    if (a.mechanism === 'NOT_OBTAINED' || b.mechanism === 'NOT_OBTAINED')
        return false;
    return a.mechanism === b.mechanism && a.sourceId === b.sourceId;
}
export function describeProvenance(p) {
    return `[${p.mechanism}: ${p.detail}]`;
}
/** Short, deterministic content identity for a live response text -- NOT a security hash, just a
 *  stable structural id so two claims extracted from the SAME live Gemini call (same text) share a
 *  sourceId, and a second, independent call (even with byte-identical text, which is the honest
 *  edge case: the model said the same thing twice) is treated as its own response per the `via`
 *  label carrying the call site, not merely the hash. */
function contentId(text) {
    return createHash('sha256').update(text).digest('hex').slice(0, 16);
}
/** Reads the TEXT out of a matched prior-acquisition record, schema-correct per authority -- the
 *  SAME logic cross_acquisition.ts's own (private, unexported) resolveReusedText() applies,
 *  reproduced here rather than exported from that file because cross_acquisition.ts is a LOCKED
 *  commit (D-BP154-008, `7d001cff`) this ticket does not touch. Still goes through the real,
 *  exported googleBlocks() for the 'google' branch -- never a second, independently-written reader
 *  of Google's results[] schema (cross_acquisition.ts's own header: response.snippet is empty on
 *  every real Google record; the content lives in results[]). */
async function resolveMatchText(m, askedText) {
    if (m.record.authority === 'conversational') {
        const r = m.record.response;
        return (r?.text ?? '').trim();
    }
    const stub = async () => m.record.response;
    const res = await googleBlocks(stub, askedText, 1);
    return res.ok ? res.text.trim() : '';
}
/** STAGE 1(a): THE MORTGAGE. Has THIS EXACT query text already been asked, by either authority, in
 *  a prior acquisition for this qid? 'conversational' is checked before 'google', mirroring
 *  cross_acquisition.ts's own buildPriorAcquisitionOwnedPassages() preference order. Returns []
 *  (never throws) when `qid` is absent (free-text input) or nothing matches -- an absent match is
 *  never fabricated into a candidate. */
export async function gatherMortgageCandidates(qid, query) {
    if (qid == null)
        return [];
    const out = [];
    for (const authority of ['conversational', 'google']) {
        const match = findPriorAcquisitionMatch(qid, authority, query);
        if (!match)
            continue;
        // eslint-disable-next-line no-await-in-loop -- one local disk record already in hand per
        // iteration, at most two iterations; not a fan-out worth parallelizing (same idiom
        // cross_acquisition.ts's own buildPriorAcquisitionOwnedPassages() already uses).
        const text = await resolveMatchText(match, query);
        if (!text)
            continue;
        out.push({
            text,
            via: `owned:prior-acquisition(${authority}, ${describePriorAcquisitionProvenance(match)})`,
            provenance: {
                mechanism: 'OWNED_EVIDENCE',
                sourceId: `acquisition:${match.acquisitionId}:${authority}`,
                detail: `prior acquisition ${match.acquisitionId} (${authority}), ${describePriorAcquisitionProvenance(match)}`,
            },
        });
    }
    return out;
}
/** STAGE 1(b): THIS RUN'S OWN already-acquired passages, when the caller wired
 *  `ctx.ownedPassages`. Excludes 'ambiguity'-kind passages (FD-BP153-07 FIX 1) -- every other kind
 *  (today: 'operation', plus any mortgaged reuse of either) is an eligible candidate. */
export function gatherThisRunCandidates(ctx) {
    if (!ctx.ownedPassages)
        return [];
    return ctx.ownedPassages()
        .filter((p) => p.kind !== 'ambiguity' && p.text && p.text.trim())
        .map((p) => ({
        text: p.text,
        via: `owned:${p.kind}${p.acquisitionId ? ` (prior acquisition ${p.acquisitionId})` : ' (this run)'}`,
        provenance: {
            mechanism: 'OWNED_EVIDENCE',
            sourceId: `owned:${p.kind}:${p.acquisitionId ?? 'this-run'}`,
            detail: `this run's own '${p.kind}' passage${p.acquisitionId ? ` (reused from acquisition ${p.acquisitionId})` : ''}`,
        },
    }));
}
/** STAGE 2: GEMINI ANSWERS (FD-BP154-02). The SAME query text the step already built, through
 *  `ctx.askConversationalAuthority` unmodified -- no judgment prompt, no re-tuning. `ok: false`
 *  covers every non-answer case alike (field undefined, `ok: false` reply, empty text) -- see
 *  ConversationalAuthorityResult's own header, method_registry.ts, for why that collapse is
 *  intentional there; this function just names it for the caller.
 *
 *  `mcOptions` (D-BP154-014, ADDITIVE/OPTIONAL) is passed straight through to
 *  `ctx.askConversationalAuthority` so webview_preload.ts's ALREADY-BUILT capture-hop gate
 *  (`mentionsAnyOption`, option_membership.ts/D-BP154-010) can actually run for this call --
 *  live-measured this ticket: without it, a page's UI chrome (the "Thinking..." status text,
 *  privacy banner) could be captured and returned `ok:true` even while the real, correct answer
 *  sat rendered elsewhere on the SAME page. This function does not itself inspect `cr.text` for
 *  option mentions a second time -- each caller (softballs_step.ts etc.) still runs its own
 *  `namesAnyOption` check exactly as before; this is a second, independent, upstream defense at
 *  the capture hop, not a replacement for the step's own check. */
export async function tryConversationalAuthority(ctx, query, mcOptions) {
    const notObtained = (detail) => ({
        ok: false,
        text: '',
        via: 'n/a',
        provenance: { mechanism: 'NOT_OBTAINED', sourceId: 'n/a', detail },
        error: detail,
    });
    if (!ctx.askConversationalAuthority) {
        return notObtained('no conversational authority is wired for this run');
    }
    // D-BP154-040/BISHOP-SEG/S40/seg-receipts, ADDITIVE. FD-BP154-15: "receipts are automatic... per
    // atomic query, tagged with mechanism." This IS one atomic query (never a bundled step) --
    // timeAtomicQuery() (measurement_receipts.ts) wraps it, mints a speed receipt on completion
    // (success or failure alike), and returns the call's own result/rejection completely unchanged.
    let cr = await timeAtomicQuery('CONVERSATIONAL_ANSWER', query, ctx.acquisitionId ?? null, () => ctx.askConversationalAuthority(query, mcOptions));
    // D-BP154-028/BISHOP-SEG/S28/seg-survivable FIX. Live-measured this dispatch (embedded_browser_
    // injection.jsonl, the actual failing dispatch): `streaming=true` from tick 9 through tick 43 (30s
    // straight) while the response-text selector matched `null` on EVERY tick -- the authority was
    // genuinely answering, this session's own poll simply never found the container that run. An
    // ADJACENT query 16 seconds earlier, in the SAME session, matched a real selector and completed
    // normally -- ruling out a systemic selector-list gap; this is transient per-dispatch DOM-render
    // variance on Gemini's own side, not a defect in any one query's text or length. Per this
    // dispatch's own rule ("a step that times out must be retryable within the run, and its failure
    // must not silently change the survivor set"): retry ONCE, a genuinely fresh dispatch, but ONLY
    // for a `ceiling` outcome specifically (`via` contains ':ceiling(') -- never for 'refused' (the
    // operator is engaged; retrying would re-interrupt them) and never for a structural failure (not
    // wired / disabled), where a second attempt cannot possibly help and would only cost time.
    if ((!cr.ok || !cr.text || !cr.text.trim()) && cr.via?.includes(':ceiling(')) {
        // A second, genuinely distinct atomic query (the retry) -- timed and receipted separately, not
        // folded into the first call's own figure.
        cr = await timeAtomicQuery('CONVERSATIONAL_ANSWER', `${query} (retry)`, ctx.acquisitionId ?? null, () => ctx.askConversationalAuthority(query, mcOptions));
    }
    if (!cr.ok || !cr.text || !cr.text.trim()) {
        return notObtained(`conversational authority returned no usable answer (${cr.via || cr.authority || 'unknown'})`);
    }
    return {
        ok: true,
        text: cr.text,
        via: `conversational:${cr.authority}`,
        provenance: {
            mechanism: 'CONVERSATIONAL_ANSWER',
            sourceId: `conversational:${cr.authority}:${contentId(cr.text)}`,
            detail: `live conversational authority (${cr.authority}, via ${cr.via})`,
        },
    };
}
/** STAGE 3: GOOGLE CORROBORATES A NAMED CLAIM -- FD-BP154-02, corrected: "what corroborates is the
 *  DOCUMENT, not Google." Issues ONE Google query for `claimQuery`, then looks only at ORGANIC
 *  result blocks that carry a real URL and body (an `answer_box`, or any block with no URL, is not
 *  attributable to a third-party document and is never a corroboration candidate -- Google is the
 *  channel to a document, never itself the corroborating voice). For each such block, in the order
 *  Google returned them, asks Gemma to extract a verbatim span FROM THAT ONE BLOCK'S OWN TEXT
 *  stating the claim -- never from the aggregated multi-block text, so a corroborating span can
 *  always be traced to the one document it came from. The first block that yields a verified span
 *  wins; corroboration is reported attempted-and-not-obtained (NEVER as an achieved corroboration)
 *  when no block does, or when Google itself returned nothing usable -- "we did not check" and "we
 *  checked and it held" must never look the same (Founder ruling, this ticket). */
export async function corroborateClaim(ctx, claimQuery, mustAppear, 
// D-BP154-024/BISHOP-SEG/S24/seg-unstated FIX -- LIVE-MEASURED DEFECT: a 19th-century zoology
// text (Gutenberg, "The Geographical Distribution of Animals", discussing which fauna are
// "common to Australia and South America") was accepted as corroborating a claim about world
// REGIONS purely because `mustAppear` ("South America") is a bare option name and appears in
// both. "A document with no bearing on the claim corroborates nothing." `mustAppear` alone is
// too weak a mechanical gate when it is just an option's own name -- it says nothing about
// whether the document is even discussing the right SUBJECT. `alsoMustAppear`, when given, is a
// SECOND, independent, purely structural substring check (same normalized-substring machinery
// as `mustAppear` via `appearsIn()`) run against the model-extracted SPAN itself (not the whole
// block body): the span must contain this string too, or the candidate is rejected. This is not
// a synonym table or a similarity score (HARDWIRE-22 unchanged) -- it is one more exact,
// structural containment check, mechanically narrowing what counts as "on topic". Optional and
// additive: existing 3-argument call sites are unaffected.
alsoMustAppear) {
    const notObtained = (via, error) => ({
        attempted: true,
        corroborated: false,
        sourceUrl: null,
        sourceTitle: null,
        span: null,
        via,
        provenance: { mechanism: 'NOT_OBTAINED', sourceId: 'n/a', detail: error },
        error,
    });
    // D-BP154-040/BISHOP-SEG/S40/seg-receipts, ADDITIVE. Same atomic-query timing discipline as
    // tryConversationalAuthority()'s own call above -- ONE atomic query, mechanism DOCUMENT_
    // CORROBORATION, timed and receipted, result/rejection unchanged.
    const res = await timeAtomicQuery('DOCUMENT_CORROBORATION', claimQuery, ctx.acquisitionId ?? null, () => googleBlocks(ctx.askGoogle, claimQuery));
    if (!res.ok) {
        return notObtained(res.via, `Google returned nothing usable to corroborate against (${res.via})`);
    }
    const candidates = res.blocks.filter((b) => b.kind === 'organic' && b.url && b.url.trim() && b.body && b.body.trim());
    if (!candidates.length) {
        return notObtained(res.via, 'Google returned no result attributable to a third-party document (no organic block with a URL)');
    }
    for (const block of candidates) {
        if (!appearsIn(block.body, mustAppear))
            continue;
        const rawOut = {};
        const instruction = `Does this passage state: ${claimQuery} If so, copy the exact verbatim `
            + `sentence or clause that states it. If the passage does not state it, say so.`;
        const shape = '{"corroborated": true or false, "span": "verbatim sentence or clause from the passage, or null"}';
        // eslint-disable-next-line no-await-in-loop -- extraction runs against each candidate
        // document's own text in turn, stopping at the first verified span; not a fan-out.
        const ex = await gemmaExtract(instruction, block.body, shape, rawOut);
        if (ex === null)
            continue;
        const span = typeof ex.span === 'string' ? ex.span.trim() : '';
        if (alsoMustAppear && !appearsIn(span, alsoMustAppear))
            continue;
        if (ex.corroborated === true && span && spanIsVerbatimInPassage(block.body, span)) {
            return {
                attempted: true,
                corroborated: true,
                sourceUrl: block.url,
                sourceTitle: block.title || null,
                span,
                via: res.via,
                provenance: {
                    mechanism: 'DOCUMENT_CORROBORATION',
                    sourceId: `document:${block.url}`,
                    detail: `${block.title || block.url} (${block.url})`,
                },
            };
        }
    }
    return notObtained(res.via, "no candidate document's own text corroborated the claim with a verifiable span");
}
export function summarizeCorroboration(c) {
    if (c.corroborated) {
        return `CORROBORATION: confirmed by "${c.sourceTitle || c.sourceUrl}" (${c.sourceUrl}) -- "${c.span}"  ${describeProvenance(c.provenance)}`;
    }
    return `CORROBORATION: attempted, not obtained -- ${c.error}`;
}
