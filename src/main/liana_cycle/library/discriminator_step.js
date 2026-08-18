// discriminator_step.ts -- D-BP154-013/BISHOP/S13/seg-composerstep, STEP 3/3
//
// THE DISCRIMINATOR AS A COMPOSER STEP. FD-BP153-07's canonical shape of a run, ratified "YES
// THIS": "3. THE DISCRIMINATOR. What kind is each survivor, and what kind does `<category>`
// denote? Breaks A from C and F on a STATED distinction."
//
// SAME BOUNDARY AS softballs_step.ts / named_set_step.ts (see those files' own headers, not
// repeated in full here): classify_cascade.ts is FORBIDDEN to edit or depend on in this ticket.
// This file imports nothing from it -- only the same generic, already-shared primitives
// comparative_cascade.ts exports (googleBlocks/gemmaExtract/appearsIn/list/toLetters), read-only,
// unmodified. classify_cascade.ts's own establishFrame()/extractDiscriminatorKinds() ask a
// SIMILAR question in service of the pipeline's own terminator machinery; this file is a
// separate, self-contained implementation for the Composer, built fresh rather than reused, per
// the ticket's own instruction that this ticket's steps must not depend on the pipeline they are
// meant to eventually replace.
//
// ONE QUERY, TWO THINGS ASKED IN IT (FD-BP153-07 point 3, and FD-BP153-01 consequence 4, "one
// query, not one per option"): what kind/classification each option is, AND which one of those
// kinds properly denotes the category the question names. Both are asked in the SAME query text,
// never as two separate round trips.
//
// EXTRACTION ONLY, NEVER JUDGMENT (HARDWIRE-22). Absence is omission: an option the passage does
// not classify is left with no stated kind -- never guessed, never left silently indistinguishable
// from "the source said it has no kind". Every stated kind carries the verbatim span it was read
// from; anything without one is discarded and the discard is counted. Every failure path is
// NAMED, never a silent empty result.
//
// NO RULE HERE MAY SELECT A PARTICULAR LETTER (FD-BP153-06) -- every option letter is treated
// identically by every function below; which kind properly denotes the category is read from the
// source's own words, never decided by this file.
//
// OUT OF SCOPE (this ticket's dispatch, D-BP154-013): ranking, magnitude, any verdict, and the
// doublecheck. This file reports ONLY the stated kinds and the stated category-denoting kind,
// each with its span -- it does NOT eliminate, rank, or answer the question.
import { appearsIn, gemmaExtract, list, toLetters, } from '../methods/comparative_cascade';
import { registerNameNumbered } from './method_registry';
// D-BP154-014/BISHOP/S14/seg-milkthem -- FD-BP154-02 ("use gemini to answer, google to
// corroborate") + FD-BP153-04 ("consult what you already own before you spend a query") +
// FD-BP154-03 (mechanism provenance). See composer_step_evidence.ts's own header for the full
// ruling this shared module implements; softballs_step.ts, named_set_step.ts and
// discriminator_step.ts all use it identically rather than each re-deriving the same ordering.
import { corroborateClaim, gatherMortgageCandidates, gatherThisRunCandidates, spanIsVerbatimInPassage, summarizeCorroboration, tryConversationalAuthority, } from './composer_step_evidence';
// D-BP154-063/BISHOP-SEG/S52/seg-wiregate, WIRING. THE ONE SHARED CATEGORY-PARSE GATE replaces
// this file's own local "following X is/are" regex (previously duplicated, byte-identical, from
// softballs_step.ts -- the Founder's own explicit instruction this dispatch: "extract it; every
// step calls the one", superseding the earlier "steps stay self-contained" discipline for this ONE
// mechanical helper). See category_parse_gate.ts's own header for the full derivation.
// deriveDiscriminatorSuperlativeProperty() below is UNRELATED (a different shape, "one of.../
// considered...") and was not touched.
import { parseFollowingCategory } from './category_parse_gate';
// ───────────────────── pure parts (unit-testable without a live Ollama/browser) ─────────────────────
/** Reads the category noun phrase the question itself names ("Which of the following world
 *  regions is NOT..." -> "world regions"). Pure text-structure parsing of the question's OWN
 *  wording, never a judgment -- returns null (never a guess) when parseFollowingCategory()
 *  (category_parse_gate.ts, THE ONE SHARED GATE, D-BP154-063) finds no category. Kept as a named
 *  export -- signature unchanged -- for existing callers/tests. */
export function deriveDiscriminatorCategory(question) {
    return parseFollowingCategory(question).category;
}
/** D-BP154-021/BISHOP-SEG/S21/seg-mortgagetrap, ADDITIVE. Founder's own correction (D-BP154-021
 *  dispatch): FD-BP153-07 point 3 is about the SUPERLATIVE PROPERTY, not only the bare category --
 *  for qid 98 the phrase that decides the answer is "the world's most densely populated regions",
 *  not merely "world regions". Byte-identical logic to named_set_step.ts's own
 *  deriveNamedSetProperty() -- DUPLICATED, not imported, same "no Composer step depends on another
 *  step's internals" discipline this file's own deriveDiscriminatorCategory() above already
 *  states (drift between the two copies is a real cost accepted for that discipline, same as
 *  named_set_step.ts's own comment on its twin). Pure text-structure parsing of the question's OWN
 *  wording, never a judgment -- returns null (never a guess) when the question does not fit this
 *  shape (many questions have a bare category with no superlative phrase at all). */
export function deriveDiscriminatorSuperlativeProperty(question) {
    const m1 = question.match(/\bone of\s+(?:the\s+)?([a-z0-9][^?]*?)\??$/i);
    if (m1 && m1[1].trim())
        return m1[1].trim();
    const m2 = question.match(/\bconsidered\s+(?:the\s+)?([a-z0-9][^?]*?)\??$/i);
    if (m2 && m2[1].trim())
        return m2[1].trim();
    return null;
}
// D-BP154-027/BISHOP-SEG/S27/seg-split FIX, REVERSING D-BP154-021/023/026's own drift. Founder's
// own rule, verbatim: "we got rid of four answers with ONE google search" -- ONE QUESTION, ONE JOB.
// buildDiscriminatorQuery() USED TO bolt every new ask onto the SAME query text until it became a
// six-part interrogation (kind + denote + enumeration + property + subregion). LIVE-MEASURED this
// dispatch: 2 of 3 live runs against qid 98 timed out on that one compound query
// (user_gemini:ceiling(timeout)) -- and in the SAME run, Softballs:1 and NamedSet:1 (whose own
// queries stayed short and single-purpose the whole time, see softballs_step.ts's/
// named_set_step.ts's own buildXQuery()) ALSO failed, taking B and E (eliminated two tickets ago on
// stated sources) back to UNSTATED survivors. The machine regressed without any rule changing --
// pure architectural drift. FIVE separate, single-job builders below replace the one compound
// builder; each is issued as its OWN round trip (runDiscriminatorStep, below), so a failure on one
// ask no longer costs the other four. FD-BP153-01 consequence 4 ("one query, not one per OPTION")
// is untouched -- these are legitimately different QUESTIONS, not the same question asked nine times.
/** ASK 1/5, THE KIND ASK -- FD-BP153-07 point 3's own two-part shape, UNCHANGED from before this
 *  ticket (this is the one genuinely single-job pairing: "what is each thing" and "which of those
 *  kinds denotes the category" are the same classification act, not two different facts).
 *
 *  D-BP154-020/BISHOP-SEG/S20/seg-discriminator2: the trailing "-- rather than merely whether it
 *  is or is not `<category>`" clause is kept, matching the KNOWN-WORKING phrasing on record in
 *  LIANA_RUN_qid98_2026-08-13T19-24-50-420Z.json (draw 2, all nine options correctly classified
 *  live) -- without it, this wording still invites the model to answer the CATEGORY-MEMBERSHIP
 *  question instead of stating an actual classification. Plain wording, applies identically
 *  regardless of which category, property, or option is named -- never a letter-specific or
 *  answer-specific change (FD-BP153-06). */
export function buildDiscriminatorKindQuery(category, all, OPT) {
    return `For EACH of the following, state exactly what it is -- its actual classification or `
        + `type -- rather than merely whether it is or is not ${category}. Answer for every one, in `
        + `order, and do not skip any. ${list(all, OPT)} Then, separately and last, state which one `
        + `of those classifications properly denotes "${category}".`;
}
/** ASK 2/5, THE ENUMERATION ASK (FD-BP154-06, "the narrow reading is obtainable from a source we
 *  can cite") -- ONE job: does the category name a specific, closed, enumerable set, and if so
 *  which options does it name. Split out of the old compound query (D-BP154-023) into its own
 *  round trip. ALWAYS asked (the bare category is always present). */
export function buildDiscriminatorEnumerationQuery(category, all, OPT) {
    return `Does "${category}" refer to a specific, enumerable, closed set of things (not an `
        + `open-ended kind)? If so, state the complete list of what it consists of, exhaustively -- `
        + `do not give examples, give the actual list. Then, separately, state explicitly which of `
        + `the following are named members of that list. ${list(all, OPT)}`;
}
/** ASK 3/5, THE PROPERTY ASK (D-BP154-021) -- ONE job: which options ARE the superlative property.
 *  Split out of the old compound query into its own round trip; only asked when the question names
 *  a property distinct from the bare category. Same simple, single-job shape softballs_step.ts's/
 *  named_set_step.ts's own buildXQuery() already use for an identical kind of ask -- this is
 *  exactly the "short, single-purpose query" shape that stayed reliable while the compound
 *  Discriminator query drifted away from it. */
export function buildDiscriminatorPropertyQuery(property, all, OPT) {
    return `Which of the following, if any, ARE ${property}? Answer plainly and directly -- name `
        + `each one explicitly and state clearly that it is ${property}. Do not guess about ones you `
        + `are not sure of; simply do not mention those. ${list(all, OPT)}`;
}
/** ASK 4/5, THE SUBREGION ASK (D-BP154-026) -- ONE job: which options does the source explicitly
 *  state are a subdivision WITHIN a larger region, not the category in its own right. Split out of
 *  the old compound query into its own round trip. Symmetric across every option (FD-BP153-06) --
 *  never singles out any one option by name or letter. */
export function buildDiscriminatorSubregionQuery(category, all, OPT) {
    return `For each of the following, if it is itself a subdivision or part WITHIN a larger region `
        + `rather than ${category} in its own right, state that explicitly. Do not guess about ones `
        + `you are not sure of; simply do not mention those. ${list(all, OPT)}`;
}
/** ASK 5/5, THE REGISTER ASK -- D-BP154-027/BISHOP-SEG/S27/seg-register, NEW this ticket.
 *  BP141 rule 13, Founder's own: determine the question's REGISTER. The pipeline's own Survey step
 *  names this ("SURVEY STEP 4 -- determine the register: guess out loud, then check it") but has
 *  never been applied here (that step lives in the forbidden classify_cascade.ts pipeline; THIS is
 *  a fresh, self-contained application of the SAME NAMED RULE to the Composer, not a dependency on
 *  that file). The Discriminator's own taxonomy ask (buildDiscriminatorKindQuery/Enumeration above)
 *  has been asked twice and returned the WIDE (formal/statistical, UN-geoscheme) reading both
 *  times. This is a DIFFERENT KIND of question -- usage, not taxonomy -- asked about the CATEGORY
 *  ONLY, naming no option (never steering toward any specific letter, FD-BP153-06). Extraction
 *  only (HARDWIRE-22): this file never interprets the answer as "narrow" or "wide" and never wires
 *  it into any elimination -- it is captured verbatim and reported, for a human (or a future,
 *  separately-authorized ticket) to read and act on. */
export function buildDiscriminatorRegisterQuery(category) {
    return `In ordinary, common usage -- not a formal or statistical taxonomy -- does "${category}" `
        + `refer only to continent-scale or macro-level divisions of the world, or does it also `
        + `include smaller subregional entries within a continent? Answer plainly and directly, `
        + `describing the ordinary usage.`;
}
/** THE ONE CORROBORATION QUERY (FD-BP154-02): re-asks whether the category is properly denoted by
 *  the single stated category-denoting kind. Preferred corroboration target when the passage
 *  stated one (this is THE decisive discriminator fact -- what breaks the winning option from the
 *  others). */
export function buildDiscriminatorCategoryKindCorroborationQuery(category, ck) {
    return `Does "${category}" denote ${ck.kind}? Answer plainly and directly, stating clearly `
        + `whether it does or does not.`;
}
/** Fallback corroboration target when no category-denoting kind was stated but at least one
 *  per-option kind was: corroborates the first verified per-option kind instead. */
export function buildDiscriminatorKindCorroborationQuery(entry) {
    return `Is ${entry.name} ${entry.kind}? Answer plainly and directly, stating clearly whether it `
        + `is or is not ${entry.kind}.`;
}
/** D-BP154-023/BISHOP-SEG/S23/seg-enumerate. THE ONE CORROBORATION QUERY for the decisive
 *  enumeration-absence fact (FD-BP154-06's own decisive claim, when present): re-asks whether the
 *  named option is genuinely absent from -- i.e. not a member of -- the category's own stated
 *  enumeration. Preferred over the categoryKind corroboration target when a productive
 *  enumeration exists (this IS the ruling's own decisive fact, the same priority categoryKind
 *  already held for the kind-mismatch rule). */
export function buildDiscriminatorEnumerationCorroborationQuery(category, name) {
    return `Is ${name} one of the things that "${category}" enumerates or consists of? Answer `
        + `plainly and directly, stating clearly whether it is or is not.`;
}
// D-BP154-046 SWEEP, LAW 11 FIX. D-BP154-015's own fix (softballs_step.ts) -- gemma4:12b's `name`
// field sometimes echoes the passage's OWN "L) text" list()-formatting -- was applied only where
// it was first measured and left latent here. Same mechanical strip (a leading "<letter>) " token
// the SOURCE'S OWN formatting put there, never a new equivalence) applied identically to both
// extraction choke points below.
function stripListLetterPrefix(name) {
    return name.replace(/^[A-Za-z]\)\s*/, '');
}
/** THE VERIFY-THE-SPAN CHOKE POINT for the per-option kinds (FD-BP153-07 FIX 2), same four-part
 *  discipline as softballs_step.ts's verifyExcludedEntries()/named_set_step.ts's
 *  verifyIncludedEntries(): (a) non-empty `name`, (b) non-empty `kind`, (c) non-empty `span`, (d)
 *  span VERBATIM in `passage`, (e) span itself ABOUT the named option (appearsIn(span, OPT[L])).
 *  Any failure of (b)/(c)/(d)/(e) is a DISCARD and is counted. A `name` mapping to no known
 *  option letter is simply not a match -- not a candidate value, not a discard. */
export function verifyDiscriminatorKinds(raw, passage, OPT) {
    const entries = Array.isArray(raw) ? raw : [];
    const kinds = [];
    const seen = new Set();
    let discarded = 0;
    for (const entry of entries) {
        const name = typeof entry?.name === 'string' ? entry.name.trim() : '';
        const kind = typeof entry?.kind === 'string' ? entry.kind.trim() : '';
        const span = typeof entry?.span === 'string' ? entry.span.trim() : '';
        if (!name)
            continue; // nothing named -- not a candidate value, not a discard
        let matched = toLetters([name], OPT);
        if (matched.length === 0) {
            const stripped = stripListLetterPrefix(name);
            if (stripped !== name)
                matched = toLetters([stripped], OPT);
        }
        if (matched.length === 0)
            continue; // names no known option -- not a candidate value here
        const L = matched[0];
        if (!kind || !span || !spanIsVerbatimInPassage(passage, span) || !appearsIn(span, OPT[L])) {
            discarded++;
            continue;
        }
        if (seen.has(L))
            continue; // one entry per option; a repeat is neither kept nor double-counted
        seen.add(L);
        kinds.push({ letter: L, name: OPT[L], kind, span });
    }
    return { kinds, discarded };
}
/** THE VERIFY-THE-SPAN CHOKE POINT for the category-denoting kind. Only verbatim-span
 *  verification applies here (there is no option name to cross-check against -- this is a
 *  statement about the CATEGORY, not about any one option). A missing or unverifiable span
 *  discards the candidate; the caller treats a discard here as "not stated", never a guess. */
export function verifyCategoryKind(raw, passage) {
    const entry = raw;
    const kind = typeof entry?.kind === 'string' ? entry.kind.trim() : '';
    const span = typeof entry?.span === 'string' ? entry.span.trim() : '';
    if (!kind || !span || !spanIsVerbatimInPassage(passage, span)) {
        return { categoryKind: null, discarded: Boolean(kind || span) };
    }
    return { categoryKind: { kind, span }, discarded: false };
}
/** D-BP154-023/BISHOP-SEG/S23/seg-enumerate. THE VERIFY-THE-SPAN CHOKE POINT for the category's
 *  own stated enumeration (FD-BP154-06). Only verbatim-span verification applies here (there is
 *  no option name to cross-check against -- this is a statement about the CATEGORY as a whole,
 *  mirroring verifyCategoryKind()'s own identical discipline immediately above). A missing or
 *  unverifiable span discards the candidate; the caller treats a discard here as "no enumeration
 *  stated", never a guess. */
export function verifyCategoryEnumeration(raw, passage) {
    const entry = raw;
    const span = typeof entry?.span === 'string' ? entry.span.trim() : '';
    if (!span || !spanIsVerbatimInPassage(passage, span)) {
        return { categoryEnumeration: null, discarded: Boolean(span) };
    }
    return { categoryEnumeration: { span }, discarded: false };
}
/** THE VERIFY-THE-SPAN CHOKE POINT for the superlative-property membership list (D-BP154-021,
 *  ADDITIVE), mirrored exactly from named_set_step.ts's own verifyIncludedEntries() four-part
 *  discipline: (a) non-empty `name`, (b) non-empty `span`, (c) span VERBATIM in `passage`, (d)
 *  span itself ABOUT the named option (appearsIn(span, OPT[L])). Any failure of (b)/(c)/(d) is a
 *  DISCARD and is counted. A `name` mapping to no known option letter is simply not a match -- not
 *  a candidate value, not a discard. */
export function verifyDiscriminatorPropertyMembers(raw, passage, OPT) {
    const entries = Array.isArray(raw) ? raw : [];
    const propertyMembers = [];
    const seen = new Set();
    let discarded = 0;
    for (const entry of entries) {
        const name = typeof entry?.name === 'string' ? entry.name.trim() : '';
        const span = typeof entry?.span === 'string' ? entry.span.trim() : '';
        if (!name)
            continue; // nothing named -- not a candidate value, not a discard
        let matched = toLetters([name], OPT);
        if (matched.length === 0) {
            const stripped = stripListLetterPrefix(name);
            if (stripped !== name)
                matched = toLetters([stripped], OPT);
        }
        if (matched.length === 0)
            continue; // names no known option -- not a candidate value here
        const L = matched[0];
        if (!span || !spanIsVerbatimInPassage(passage, span) || !appearsIn(span, OPT[L])) {
            discarded++;
            continue;
        }
        if (seen.has(L))
            continue; // one entry per option; a repeat is neither kept nor double-counted
        seen.add(L);
        propertyMembers.push({ letter: L, name: OPT[L], span });
    }
    return { propertyMembers, discarded };
}
function summaryLine(OPT, r) {
    if (!r.ok)
        return `DISCRIMINATOR: FAILED -- ${r.error}`;
    const kindsText = r.kinds.length
        ? r.kinds.map((e) => `${e.letter}) ${e.name} = "${e.kind}" [source: "${e.span}"]`).join('  |  ')
        : '(none stated)';
    const noKindText = r.noKindStated.length
        ? r.noKindStated.map((L) => `${L}) ${OPT[L]}`).join(', ')
        : '(none)';
    const categoryKindText = r.categoryKind
        ? `"${r.categoryKind.kind}" [source: "${r.categoryKind.span}"]`
        : r.categoryKindDiscarded
            ? '(source attempted an answer but it had no verifiable span -- discarded)'
            : '(not stated)';
    const discardNote = r.discardedKinds ? ` -- discarded ${r.discardedKinds} candidate(s) with no verifiable span` : '';
    const provenanceNote = r.answerProvenance ? `  ||  ANSWERED VIA ${r.answerProvenance.mechanism}: ${r.answerProvenance.detail}` : '';
    const corrobNote = r.corroboration ? `  ||  ${summarizeCorroboration(r.corroboration)}` : '';
    const propertyMembersNote = r.property
        ? `  ||  MEMBERS OF "${r.property}" (source-stated, verified): ${r.propertyMembers.length
            ? r.propertyMembers.map((e) => `${e.letter}) ${e.name} [source: "${e.span}"]`).join('  |  ')
            : '(none stated)'}${r.discardedPropertyMembers ? ` -- discarded ${r.discardedPropertyMembers} candidate(s) with no verifiable span` : ''}`
        : '';
    // D-BP154-023/BISHOP-SEG/S23/seg-enumerate.
    const enumerationText = r.categoryEnumeration
        ? `stated -- "${r.categoryEnumeration.span}"`
        : r.categoryEnumerationDiscarded
            ? '(source attempted an answer but it had no verifiable span -- discarded)'
            : '(not stated)';
    const enumerationMembersText = r.categoryEnumerationMembers.length
        ? r.categoryEnumerationMembers.map((e) => `${e.letter}) ${e.name} [source: "${e.span}"]`).join('  |  ')
        : '(none stated)';
    const enumerationNote = `  ||  ENUMERATION OF "${r.category}": ${enumerationText}  ||  `
        + `NAMED MEMBERS OF THAT ENUMERATION: ${enumerationMembersText}`
        + `${r.discardedCategoryEnumerationMembers ? ` -- discarded ${r.discardedCategoryEnumerationMembers} candidate(s) with no verifiable span` : ''}`;
    const enumerationDisagreementNote = r.enumerationDisagreement
        ? `  ||  ENUMERATION DISAGREEMENT: ${r.enumerationDisagreement.detailA} vs ${r.enumerationDisagreement.detailB}`
        : '';
    // D-BP154-026/BISHOP-SEG/S26/seg-subregion.
    const subregionNonMembersNote = `  ||  STATED NOT "${r.category}" IN ITS OWN RIGHT (subdivision within a larger region): ${r.subregionNonMembers.length
        ? r.subregionNonMembers.map((e) => `${e.letter}) ${e.name} [source: "${e.span}"]`).join('  |  ')
        : '(none stated)'}${r.discardedSubregionNonMembers ? ` -- discarded ${r.discardedSubregionNonMembers} candidate(s) with no verifiable span` : ''}`;
    // D-BP154-027/BISHOP-SEG/S27/seg-register, NEW. Captured verbatim, never labeled "narrow"/"wide"
    // by this file -- a human (or a future, separately-authorized ticket) reads this and decides.
    const registerNote = `  ||  REGISTER (ordinary usage of "${r.category}"): ${r.registerStatement
        ? `stated -- "${r.registerStatement.span}"`
        : r.registerStatementDiscarded
            ? '(source attempted an answer but it had no verifiable span -- discarded)'
            : '(not stated)'}`;
    return `DISCRIMINATOR -- query: "${r.query}"  ||  KINDS (source-stated, verified): ${kindsText}`
        + `${discardNote}  ||  NO KIND STATED (source silent -- omission, not "no kind"): ${noKindText}`
        + `  ||  WHICH KIND DENOTES "${r.category}": ${categoryKindText}${enumerationNote}${enumerationDisagreementNote}${subregionNonMembersNote}${registerNote}${propertyMembersNote}${provenanceNote}${corrobNote}`;
}
// ───────────────── the live step (owned evidence -> conversational -> corroboration; needs a real run to verify) ─────────────────
/**
 * Runs THE DISCRIMINATOR as one Composer step: owned evidence tried first (zero new queries),
 * then the conversational authority (Gemini) answers the one Discriminator question -- what kind
 * each option is, AND which stated kind denotes the category -- (FD-BP154-02), then -- when there
 * is a decisive claim -- ONE Google corroboration pass names a third-party document that
 * independently states the same thing. Every value produced carries its mechanism (FD-BP154-03).
 * Cannot be exercised end to end under vitest -- same boundary softballs_step.ts's/
 * named_set_step.ts's own headers state. The pure parts above carry the real unit tests; this
 * function is verified by a live in-app run (this ticket's own return).
 */
/** D-BP154-023, ADDITIVE: the fields common to every early/failure DiscriminatorResult return
 *  below -- factored out so the growing field list (now 4 extraction asks) does not have to be
 *  hand-copied at each of the six return sites, a real drift risk this ticket's own predecessors
 *  (D-BP154-020/021) already hand-copied through twice. */
function emptyDiscriminatorFields() {
    return {
        kinds: [], discardedKinds: 0, categoryKind: null, categoryKindDiscarded: false,
        propertyMembers: [], discardedPropertyMembers: 0,
        categoryEnumeration: null, categoryEnumerationDiscarded: false,
        categoryEnumerationMembers: [], discardedCategoryEnumerationMembers: 0,
        subregionNonMembers: [], discardedSubregionNonMembers: 0,
        registerStatement: null, registerStatementDiscarded: false,
        enumerationDisagreement: null,
    };
}
export async function runDiscriminatorStep(input, ctx) {
    const OPT = input.options;
    if (!OPT || Object.keys(OPT).length === 0) {
        const result = {
            ok: false, category: null, property: null, query: null, noKindStated: [], via: 'n/a',
            ...emptyDiscriminatorFields(),
            error: 'this question has no lettered options -- THE DISCRIMINATOR classifies options and cannot run without them',
        };
        return { result, summary: summaryLine({}, result) };
    }
    const optSafe = OPT;
    const all = Object.keys(optSafe);
    const categoryParse = parseFollowingCategory(input.question);
    const category = categoryParse.category;
    if (!category) {
        const result = {
            ok: false, inapplicable: true, category: null, property: null, query: null, noKindStated: all, via: 'n/a',
            ...emptyDiscriminatorFields(),
            error: categoryParse.reason ?? 'could not determine the category this question names -- refusing rather than guessing a category',
        };
        return { result, summary: summaryLine(OPT, result) };
    }
    const property = deriveDiscriminatorSuperlativeProperty(input.question);
    const namesAnyOption = (t) => all.some((L) => appearsIn(t, OPT[L]));
    const mcOptions = all.map((L) => `${L}) ${OPT[L]}`);
    // D-BP154-027/BISHOP-SEG/S27/seg-split. THE GENERIC PER-ASK FETCH+EXTRACT -- STAGE 1 (owned
    // evidence for THIS ask's own short query) then STAGE 2 (a fresh live query, only when STAGE 1
    // was unproductive -- D-BP154-018/020's mortgage-trap fix, preserved per ask, not dropped by the
    // split). Both `stage1Value`/`stage2Value` are returned (not just the credited final `value`) so
    // a caller that needs to compare the two independently (the enumeration ask's own disagreement
    // check, below) still can.
    async function fetchAndExtract(askQuery, instruction, shape, verify, isProductive) {
        const owned = [...(await gatherMortgageCandidates(input.qid, askQuery)), ...gatherThisRunCandidates(ctx)];
        let text = '';
        let via = '';
        let provenance;
        for (const c of owned) {
            if (namesAnyOption(c.text)) {
                text = c.text;
                via = c.via;
                provenance = c.provenance;
                break;
            }
        }
        const describeFailure = (rawOut) => (rawOut.truncated
            ? 'the local extraction model truncated its output before finishing'
            : rawOut.failureCause
                ? `the local extraction model failed (${rawOut.failureCause}${rawOut.failureDetail ? `: ${rawOut.failureDetail}` : ''})`
                : 'the local extraction model failed for an unclassified reason');
        let stage1Value = null;
        let extractionError;
        if (text) {
            const rawOut = {};
            const ex = await gemmaExtract(instruction, text, shape, rawOut);
            if (ex === null)
                extractionError = describeFailure(rawOut);
            else
                stage1Value = verify(ex, text);
        }
        let value = stage1Value;
        let stage2Value = null;
        let stage2Via;
        const stage1Productive = stage1Value !== null && isProductive(stage1Value);
        if (!text || !stage1Productive) {
            const cr = await tryConversationalAuthority(ctx, askQuery, mcOptions);
            if (cr.ok && namesAnyOption(cr.text)) {
                const rawOut2 = {};
                const ex2 = await gemmaExtract(instruction, cr.text, shape, rawOut2);
                if (ex2 !== null) {
                    stage2Value = verify(ex2, cr.text);
                    stage2Via = cr.via;
                    if (isProductive(stage2Value) || !text) {
                        text = cr.text;
                        via = cr.via;
                        provenance = cr.provenance;
                        value = stage2Value;
                        extractionError = undefined;
                    }
                }
                else if (!text) {
                    extractionError = describeFailure(rawOut2);
                }
            }
            else if (!text) {
                return {
                    value: null, productive: false, via: 'n/a', text: '',
                    fetchError: cr.error ?? 'conversational authority answered but named none of the options',
                    stage1Value: null, stage2Value: null,
                };
            }
        }
        return {
            value, productive: value !== null && isProductive(value), via: via || 'n/a', provenance, text, extractionError,
            stage1Value, stage2Value, stage2Via,
        };
    }
    const askLog = [];
    // ASK 1/5 -- THE KIND ASK (FD-BP153-07 point 3, unchanged single-job shape).
    const kindQuery = buildDiscriminatorKindQuery(category, all, OPT);
    const kindInstruction = `From the passage, for EACH option below, copy its stated classification `
        + `or kind (exactly what the passage says it is), and the exact verbatim sentence or clause `
        + `that states it. Do not include an option the passage does not classify -- an omission is `
        + `not a statement. Then, separately, copy which ONE classification the passage states `
        + `properly denotes "${category}", and the verbatim sentence or clause that states so. `
        + `Options: ${all.map((L) => `${L}) ${OPT[L]}`).join('; ')}`;
    const kindShape = '{"kinds":[{"name":"exact option name from the list","kind":"the stated classification","span":"verbatim sentence or clause"}],"categoryKind":{"kind":"the classification that denotes the category, or null","span":"verbatim sentence or clause, or null"}}';
    const verifyKind = (raw, passage) => {
        const r = raw;
        const { kinds, discarded } = verifyDiscriminatorKinds(r.kinds, passage, optSafe);
        const { categoryKind, discarded: categoryKindDiscarded } = verifyCategoryKind(r.categoryKind, passage);
        return { kinds, discardedKinds: discarded, categoryKind, categoryKindDiscarded };
    };
    const kindOutcome = await fetchAndExtract(kindQuery, kindInstruction, kindShape, verifyKind, (v) => v.kinds.length > 0 || !!v.categoryKind);
    askLog.push(`KIND (${kindQuery.length} chars): ${kindOutcome.productive ? `ok via ${kindOutcome.via}` : kindOutcome.fetchError ? `FAILED -- ${kindOutcome.fetchError}` : kindOutcome.extractionError ? `FAILED -- ${kindOutcome.extractionError}` : 'answered, nothing usable'}`);
    // ASK 2/5 -- THE ENUMERATION ASK (D-BP154-023/FD-BP154-06). Keeps its own STAGE1-vs-STAGE2
    // disagreement check (unchanged rule, now scoped to this one short ask instead of the whole
    // former compound query).
    const enumerationQuery = buildDiscriminatorEnumerationQuery(category, all, OPT);
    const enumerationInstruction = `From the passage, if it gives an exhaustive enumerated list of `
        + `what "${category}" consists of, copy the exact verbatim sentence or clause that gives that `
        + `list. Then, separately, list every option below that the passage's own enumeration `
        + `explicitly names as a member of it, each with its own verbatim span. Do not include an `
        + `option the enumeration does not name -- an omission is not a statement. If the passage `
        + `gives no such enumeration, state null for it. Options: ${all.map((L) => `${L}) ${OPT[L]}`).join('; ')}`;
    const enumerationShape = '{"categoryEnumeration":{"span":"verbatim sentence or clause giving the enumerated list, or null"},"categoryEnumerationMembers":[{"name":"exact option name from the list","span":"verbatim sentence or clause naming it as a member of the enumeration"}]}';
    const verifyEnumeration = (raw, passage) => {
        const r = raw;
        const { categoryEnumeration, discarded: categoryEnumerationDiscarded } = verifyCategoryEnumeration(r.categoryEnumeration, passage);
        const { propertyMembers: categoryEnumerationMembers, discarded: discardedCategoryEnumerationMembers } = verifyDiscriminatorPropertyMembers(r.categoryEnumerationMembers, passage, optSafe);
        return { categoryEnumeration, categoryEnumerationDiscarded, categoryEnumerationMembers, discardedCategoryEnumerationMembers };
    };
    const enumerationOutcome = await fetchAndExtract(enumerationQuery, enumerationInstruction, enumerationShape, verifyEnumeration, (v) => !!v.categoryEnumeration || v.categoryEnumerationMembers.length > 0);
    // D-BP154-023 disagreement check, PRESERVED, unchanged rule: a genuine cross-source ENUMERATION
    // disagreement is reported and refused outright, never silently resolved by preferring either
    // one -- pure set-equality comparison, no interpretation.
    if (enumerationOutcome.stage1Value && enumerationOutcome.stage2Value
        && enumerationOutcome.stage1Value.categoryEnumerationMembers.length > 0
        && enumerationOutcome.stage2Value.categoryEnumerationMembers.length > 0) {
        const s1 = new Set(enumerationOutcome.stage1Value.categoryEnumerationMembers.map((e) => e.letter));
        const s2 = new Set(enumerationOutcome.stage2Value.categoryEnumerationMembers.map((e) => e.letter));
        const disagree = s1.size !== s2.size || [...s1].some((L) => !s2.has(L));
        if (disagree) {
            const result = {
                ok: false, category, property, query: kindQuery, noKindStated: all, via: enumerationOutcome.via,
                ...emptyDiscriminatorFields(),
                enumerationDisagreement: { detailA: enumerationOutcome.via, detailB: enumerationOutcome.stage2Via ?? 'n/a' },
                error: `the category's own enumeration is CONTRADICTED across independent sources (${enumerationOutcome.via}: `
                    + `{${[...s1].join(', ')}} vs ${enumerationOutcome.stage2Via}: {${[...s2].join(', ')}}) -- `
                    + `reported as a disagreement, never resolved by force (FD-BP154-06)`,
            };
            return { result, summary: summaryLine(OPT, result) };
        }
    }
    askLog.push(`ENUMERATION (${enumerationQuery.length} chars): ${enumerationOutcome.productive ? `ok via ${enumerationOutcome.via}` : enumerationOutcome.fetchError ? `FAILED -- ${enumerationOutcome.fetchError}` : enumerationOutcome.extractionError ? `FAILED -- ${enumerationOutcome.extractionError}` : 'answered, nothing usable'}`);
    // ASK 3/5 -- THE PROPERTY ASK (D-BP154-021) -- only when the question names a superlative
    // property distinct from the bare category. Same short, single-job shape softballs_step.ts's/
    // named_set_step.ts's own buildXQuery() already use.
    let propertyOutcome = null;
    if (property) {
        const propertyQuery = buildDiscriminatorPropertyQuery(property, all, OPT);
        const propertyInstruction = `From the passage, list every option below that it explicitly `
            + `and directly states IS ${property}. For each one, copy the exact verbatim sentence or `
            + `clause that states it. Do not include an option the passage merely does not mention -- `
            + `an omission is not a statement. Options: ${all.map((L) => `${L}) ${OPT[L]}`).join('; ')}`;
        const propertyShape = '{"propertyMembers":[{"name":"exact option name from the list","span":"verbatim sentence or clause stating it is the superlative property"}]}';
        propertyOutcome = await fetchAndExtract(propertyQuery, propertyInstruction, propertyShape, (raw, passage) => {
            const r = raw;
            const { propertyMembers, discarded } = verifyDiscriminatorPropertyMembers(r.propertyMembers, passage, optSafe);
            return { propertyMembers, discardedPropertyMembers: discarded };
        }, (v) => v.propertyMembers.length > 0);
        askLog.push(`PROPERTY (${propertyQuery.length} chars): ${propertyOutcome.productive ? `ok via ${propertyOutcome.via}` : propertyOutcome.fetchError ? `FAILED -- ${propertyOutcome.fetchError}` : propertyOutcome.extractionError ? `FAILED -- ${propertyOutcome.extractionError}` : 'answered, nothing usable'}`);
    }
    // ASK 4/5 -- THE SUBREGION ASK (D-BP154-026). Symmetric across every option (FD-BP153-06).
    const subregionQuery = buildDiscriminatorSubregionQuery(category, all, OPT);
    const subregionInstruction = `From the passage, list every option below that it explicitly `
        + `states is NOT "${category}" in its own right -- because it is instead a subdivision or `
        + `part WITHIN a larger region. For each one, copy the exact verbatim sentence or clause that `
        + `says so. Do not include an option the passage does not address this way -- an omission is `
        + `not a statement. Options: ${all.map((L) => `${L}) ${OPT[L]}`).join('; ')}`;
    const subregionShape = '{"subregionNonMembers":[{"name":"exact option name from the list","span":"verbatim sentence or clause stating it is a subdivision within a larger region, not a region in its own right"}]}';
    const subregionOutcome = await fetchAndExtract(subregionQuery, subregionInstruction, subregionShape, (raw, passage) => {
        const r = raw;
        const { propertyMembers: subregionNonMembers, discarded } = verifyDiscriminatorPropertyMembers(r.subregionNonMembers, passage, optSafe);
        return { subregionNonMembers, discardedSubregionNonMembers: discarded };
    }, (v) => v.subregionNonMembers.length > 0);
    askLog.push(`SUBREGION (${subregionQuery.length} chars): ${subregionOutcome.productive ? `ok via ${subregionOutcome.via}` : subregionOutcome.fetchError ? `FAILED -- ${subregionOutcome.fetchError}` : subregionOutcome.extractionError ? `FAILED -- ${subregionOutcome.extractionError}` : 'answered, nothing usable'}`);
    // ASK 5/5 -- THE REGISTER ASK -- D-BP154-027, NEW (see buildDiscriminatorRegisterQuery()'s own
    // header for the full ruling). Never names an option (FD-BP153-06) -- asks about the CATEGORY's
    // ordinary usage only.
    const registerQuery = buildDiscriminatorRegisterQuery(category);
    const registerInstruction = `From the passage, copy the exact verbatim sentence or clause that `
        + `states whether "${category}", in ordinary usage, includes subregional entries or refers `
        + `only to continent-scale divisions. If the passage does not address this, state null.`;
    const registerShape = '{"registerStatement":{"span":"verbatim sentence or clause, or null"}}';
    const registerOutcome = await fetchAndExtract(registerQuery, registerInstruction, registerShape, (raw, passage) => {
        const r = raw;
        // verifyCategoryEnumeration() is the SAME "one verbatim span, no option name to cross-check"
        // shape a register statement needs -- reused rather than a near-duplicate fifth function
        // (same discipline D-BP154-023's own comment already applies to categoryEnumerationMembers).
        const { categoryEnumeration: statementAsEnumeration, discarded } = verifyCategoryEnumeration(r.registerStatement, passage);
        return { registerStatement: statementAsEnumeration, registerStatementDiscarded: discarded };
    }, (v) => !!v.registerStatement);
    askLog.push(`REGISTER (${registerQuery.length} chars): ${registerOutcome.productive ? `ok via ${registerOutcome.via}` : registerOutcome.fetchError ? `FAILED -- ${registerOutcome.fetchError}` : registerOutcome.extractionError ? `FAILED -- ${registerOutcome.extractionError}` : 'answered, nothing usable'}`);
    // AGGREGATE. ok:true if ANY of the five independent asks was productive -- the whole point of
    // splitting: one ask timing out no longer costs the other four (D-BP154-027's own live finding:
    // 2 of 3 runs against the OLD compound query timed out completely; a split query degrades
    // gracefully instead of failing atomically).
    const kindValue = kindOutcome.value ?? { kinds: [], discardedKinds: 0, categoryKind: null, categoryKindDiscarded: false };
    const enumerationValue = enumerationOutcome.value ?? { categoryEnumeration: null, categoryEnumerationDiscarded: false, categoryEnumerationMembers: [], discardedCategoryEnumerationMembers: 0 };
    const propertyValue = propertyOutcome?.value ?? { propertyMembers: [], discardedPropertyMembers: 0 };
    const subregionValue = subregionOutcome.value ?? { subregionNonMembers: [], discardedSubregionNonMembers: 0 };
    const registerValue = registerOutcome.value ?? { registerStatement: null, registerStatementDiscarded: false };
    const anyProductive = kindOutcome.productive || enumerationOutcome.productive || (propertyOutcome?.productive ?? false)
        || subregionOutcome.productive || registerOutcome.productive;
    const combinedQuery = `KIND: "${kindQuery}"  ||  ENUMERATION: "${enumerationQuery}"`
        + (property ? `  ||  PROPERTY: "${buildDiscriminatorPropertyQuery(property, all, OPT)}"` : '')
        + `  ||  SUBREGION: "${subregionQuery}"  ||  REGISTER: "${registerQuery}"`;
    if (!anyProductive) {
        const result = {
            ok: false, category, property, query: combinedQuery, noKindStated: all,
            via: kindOutcome.via !== 'n/a' ? kindOutcome.via : 'n/a',
            ...emptyDiscriminatorFields(),
            discardedKinds: kindValue.discardedKinds, categoryKindDiscarded: kindValue.categoryKindDiscarded,
            discardedPropertyMembers: propertyValue.discardedPropertyMembers,
            categoryEnumerationDiscarded: enumerationValue.categoryEnumerationDiscarded,
            discardedCategoryEnumerationMembers: enumerationValue.discardedCategoryEnumerationMembers,
            discardedSubregionNonMembers: subregionValue.discardedSubregionNonMembers,
            registerStatementDiscarded: registerValue.registerStatementDiscarded,
            error: `no usable answer from any of the five independent asks -- THE DISCRIMINATOR is `
                + `UNAVAILABLE, not "no kinds stated". ${askLog.join('  |  ')}`,
        };
        return { result, summary: summaryLine(OPT, result) };
    }
    const { kinds, discardedKinds: discarded, categoryKind, categoryKindDiscarded } = kindValue;
    const { categoryEnumeration, categoryEnumerationDiscarded, categoryEnumerationMembers, discardedCategoryEnumerationMembers } = enumerationValue;
    const { propertyMembers, discardedPropertyMembers } = propertyValue;
    const { subregionNonMembers, discardedSubregionNonMembers } = subregionValue;
    const { registerStatement, registerStatementDiscarded } = registerValue;
    const statedLetters = new Set(kinds.map((e) => e.letter));
    const noKindStated = all.filter((L) => !statedLetters.has(L));
    // STAGE 3: GOOGLE CORROBORATES A NAMED CLAIM -- ONE query, for the single decisive claim only.
    // Unchanged priority (D-BP154-023/024): the category's own enumeration when productive, else the
    // category-denoting kind, else the first per-option kind.
    const enumeratedLetters = new Set(categoryEnumerationMembers.map((e) => e.letter));
    const firstEnumerationExcluded = categoryEnumerationMembers.length > 0
        ? all.find((L) => !enumeratedLetters.has(L))
        : undefined;
    let corroboration;
    if (firstEnumerationExcluded) {
        corroboration = await corroborateClaim(ctx, buildDiscriminatorEnumerationCorroborationQuery(category, optSafe[firstEnumerationExcluded]), optSafe[firstEnumerationExcluded], category);
    }
    else if (categoryKind) {
        corroboration = await corroborateClaim(ctx, buildDiscriminatorCategoryKindCorroborationQuery(category, categoryKind), categoryKind.kind, category);
    }
    else if (kinds.length) {
        corroboration = await corroborateClaim(ctx, buildDiscriminatorKindCorroborationQuery(kinds[0]), kinds[0].name, category);
    }
    // Credited overall via/provenance: whichever ask actually produced the primary classification
    // (kind), falling back to the first productive ask in order -- an approximation, since five
    // independent asks may now carry five different mechanisms; the FULL per-ask picture is in
    // `askLog`, folded into `query` above and available in the live transcript/receipt.
    const primary = kindOutcome.productive ? kindOutcome
        : enumerationOutcome.productive ? enumerationOutcome
            : (propertyOutcome?.productive ? propertyOutcome : null)
                ?? (subregionOutcome.productive ? subregionOutcome : null)
                ?? (registerOutcome.productive ? registerOutcome : null)
                ?? kindOutcome;
    const result = {
        ok: true, category, property, query: combinedQuery, kinds, discardedKinds: discarded, noKindStated,
        categoryKind, categoryKindDiscarded, propertyMembers, discardedPropertyMembers,
        categoryEnumeration, categoryEnumerationDiscarded, categoryEnumerationMembers, discardedCategoryEnumerationMembers,
        subregionNonMembers, discardedSubregionNonMembers,
        registerStatement, registerStatementDiscarded,
        enumerationDisagreement: null,
        via: primary.via, answerProvenance: primary.provenance, corroboration,
    };
    return { result, summary: summaryLine(OPT, result) };
}
// ───────────────────────── registration (inert until stacked and run) ─────────────────────────
const DISCRIMINATOR_DECLARATION = {
    id: 'liana_cycle.discriminator_step.runDiscriminatorStep',
    version: '1',
    sourceFile: 'src/main/liana_cycle/library/discriminator_step.ts',
    sourceLine: 1,
    exportName: 'runDiscriminatorStep',
    exportKind: 'function',
    whatItDoes: 'Asks ONE question -- what kind or classification each option is, and which one of those '
        + 'kinds properly denotes the category the question names -- tried against owned evidence '
        + 'first, then the conversational authority (Gemini), which answers it (FD-BP154-02); shows '
        + 'exactly what the source stated for each, with the verbatim sentence it said so in, plus ONE '
        + 'Google corroboration naming a third-party document for the decisive claim. Never guesses a '
        + 'kind for an option the source did not classify.',
    inputs: 'MethodQuestionInput (question, options, qid) plus MethodRunContext (askGoogle, askConversationalAuthority, ownedPassages, emit) to runDiscriminatorStep().',
    outputs: 'Promise<{ result: DiscriminatorResult, summary: string }> -- per-option stated kinds with verbatim spans, discard counts, the stated category-denoting kind, the answer mechanism, and a document corroboration attempt.',
    decidesOrReports: 'DECIDES_AND_REFUSES',
    queryText: {
        issuesQuery: true,
        description: 'One primary question per run -- owned evidence tried first, then both the per-option kind and the category-denoting kind (FD-BP153-07 THE DISCRIMINATOR, FD-BP154-02) put to the conversational authority -- plus at most one Google corroboration query for a single decisive claim, hardcoded inline in this file.',
        loadedFromQueryResource: false,
    },
    attribution: {
        kind: 'ATTRIBUTED',
        founderRuling: 'BP153',
        quote: 'THE DISCRIMINATOR. What kind is each survivor, and what kind does `<category>` denote? '
            + 'Breaks A from C and F on a STATED distinction.',
        citedAt: 'LianaBanyanPlatform/BISHOP_DROPZONE/RULINGS_BP153.md FD-BP153-07',
    },
    orphanEvidence: 'N/A -- not an orphan. Live: registered via registerDiscriminatorStep() (this file), executed '
        + 'by script_bridge.ts\'s runOneStep() for id "Discriminator:1", the same wiring pattern '
        + 'Softballs:1, NamedSet:1, Survey:1 and StateTheQuestion:1 already use.',
};
/** Registers 'Discriminator:1'. Called from script_bridge.ts's ensureRegistryPopulated(),
 *  idempotently -- same try/catch shape as the other Composer step registrations there. */
export function registerDiscriminatorStep() {
    return registerNameNumbered('Discriminator', 1, DISCRIMINATOR_DECLARATION);
}
