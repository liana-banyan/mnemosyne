// elements/nest.ts -- E-NEST -- D-BP150-010/BISHOP/S10/seg-nest
//
// THE NEST METHOD's decomposition half. Ratified canon:
//   Asteroid-ProofVault/state/eblets/CANON/canon_the_nest_method_bp150.eblet.md
//
// Founder, BP150, verbatim (qid 92 walk): "Well, first the survey needs to define words and word
// relationships for nuanced meaning possibilities. Like what is Critical Security Studies to begin
// with? And then make sure we know that, within that context, what is a referent object, and what
// does it refer to? Then what is an object of security (to see if that's a thing) and then add in
// what is any referent object of security."
//
// FOUR LEVELS, IN THIS ORDER, PER CANON:
//   1. framework          -- the outer frame first: "what is Critical Security Studies to begin with?"
//   2. part                -- each part, inside that frame: "what is a referent object?"
//   3. existence-check     -- "what is an object of security (to see if that's a thing)"
//   4. whole-phrase        -- "what is any referent object of security"
//
// MECHANICAL RULES ONLY. NO MODEL. Per the governing ticket: "capitalized multi-word spans are
// framework candidates, 'within/in <Frame>' marks the frame, 'X of Y' splits into parts." Every
// level carries the rule that produced it in its `why` field, so a reader can audit the
// decomposition by inspection -- the same discipline aspect_tag.ts and demand_test.ts already keep.
//
// THIS FILE IS PURE. NO I/O. It does not call Google, does not call Gemma, does not touch
// MethodRunContext. `surveyAsk()` (elements/survey_ask.ts) is where each level's SENSE gets looked
// up; this file only says WHAT levels exist and WHY, never what they mean.
//
// WHAT THIS FILE DOES NOT DO, AND WHY:
//   - It does not decide whether the whole-phrase construct actually exists. That is what SURVEY
//     does with the existence-check level's text as its query -- see canon step 3's own language,
//     "to see if that's a thing", which is a question for the field (Google), not for a regex.
//   - It does not special-case qid 92 or any other bundled question id. The rules below (frame /
//     of-split / function-word guard) run the SAME way against every input; qid 92 happens to be
//     the case that taught them (see canon "THE CASE THAT TAUGHT IT") and is not privileged in the
//     code -- the ticket that built this module was explicit that tuning a rule to a benchmark
//     question destroys the measurement, so this file does not check `qid === 92` anywhere.
//   - It does not require a "what is" question shape. buildNest() strips a leading interrogative
//     prefix WHEN ONE IS PRESENT and otherwise works directly on the phrase it is given -- so it
//     accepts either a raw question string ("Within X, what is Y of Z?") or an already-isolated
//     phrase ("Y of Z within X"), the two forms this ticket's own examples use interchangeably, and
//     produces the same levels either way.
//   - It only tries the FIRST " of " boundary in the phrase. If that boundary's left side is pure
//     function words (e.g. "Which of the following...", X = "which"), the split is refused outright
//     -- it does NOT walk forward to try a later "of" that might have been meaningful ("...examples
//     of mitotic cell divisions"). That is a real limitation, not a hidden one; see this ticket's
//     return for how often it matters across the bundled corpus.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// D-BP150-012 FIX 3 -- STRUCTURAL REFUSAL GATE, PER THE KIND-CHECK CANON'S NONSENSE TEST:
//   Asteroid-ProofVault/state/eblets/CANON/canon_kind_check_first_and_the_types_are_finite_bp150.eblet.md
//
// THE DEFECT: measured across the bundled 140-question corpus, 47 of 91 depth>1 nests were garbage
// (D-BP150-010's own heuristic scan). qid 46's " of " split lands inside an embedded "a) ... b) ...
// c) ..." bundled-answer blob and produces "deal of the orange crop..." as a "part" level; qid 72's
// split lands on "analysis" and produces a truncated half-sentence. Both are long, multi-clause
// scenario/passage questions -- not the short definitional/framework ask (qid 92, one sentence, 11
// words) the Nest Method was taught on. THE SPLITTER ITSELF IS NOT MADE CLEVERER (per this ticket's
// explicit instruction) -- a step that cannot judge its own output well-formed must REFUSE rather
// than emit nonsense (canon R-2), so the gate runs on the INPUT, before decomposition is attempted.
//
// STRUCTURAL PRECONDITIONS ONLY -- no topical/lexical tuning, same discipline as
// FUNCTION_ONLY/FRAME_RE above:
//   1. more than one sentence in the input -- Nest was taught on a single-sentence ask; a
//      multi-sentence input is a passage or scenario stem.
//   2. an embedded lettered option marker ("a)", "b)", ...) -- a bundled multi-part answer, the
//      same shape kind_check.ts's LETTERED_SUBCLAUSE_RE reports as unrecognized on the option side.
//   3. more than WORD_COUNT_CEILING words (see that constant's own comment for how the number was
//      picked from the corpus).
//
// Any one of the three refuses the WHOLE decomposition: buildNest() returns a single whole-phrase
// level (the trimmed input, unsplit) plus a stated reason, and NestResult.refused is true. This is
// a PASS, not a gap (canon: "an unrecognized type is a gap in an enumeration, not a failure of the
// frame") -- see this ticket's return for the corpus-wide before/after count, including the honest
// report of which previously-garbage cases still do NOT trip this gate (the rule is not tuned to
// force every named example to refuse; see the ceiling's own comment).
// ─────────────────────────────────────────────────────────────────────────────────────────────
/** Capitalized multi-word span after a within/in/according-to/under preposition. Capitalization is
 *  load-bearing and matched WITHOUT the /i flag on the span itself, for the same reason
 *  demand_test.ts's LOCATE-IN-FRAMEWORK cue does it that way: it is what distinguishes a named
 *  framework ("Critical Security Studies") from an ordinary prepositional phrase ("in the following
 *  weeks", "in this passage"). */
const FRAME_RE = /\b(?:[Ww]ithin|[Ii]n|[Aa]ccording to|[Uu]nder)\s+([A-Z][\w'-]*(?:\s+[A-Z][\w'-]*)+)/;
const INTERROGATIVE_PREFIX_RE = /^(?:what|which|who|where|when|how)\s+(?:is|are|was|were)\s+(?:the\s+|a\s+|an\s+|any\s+)?/i;
const LEADING_ARTICLE_RE = /^(?:the|a|an|any)\s+/i;
/** Tokens with no denotation of their own -- the same non-circular filter catalyst_words.ts already
 *  applies to the ANSWERS (a word every option shares, or a bare function word, distinguishes
 *  nothing). Used here only to refuse an "X of Y" split whose X is nothing but one of these (e.g.
 *  "which of the following ..." -- X = "which", a pure function word, not a part worth nesting).
 *  Deliberately grammatical, not topical: it names no domain vocabulary, so it cannot be tuned
 *  toward any one question's answer key. */
const FUNCTION_ONLY = new Set([
    'which', 'what', 'who', 'any', 'some', 'each', 'both', 'all', 'none', 'it', 'this', 'that',
    'these', 'those', 'the', 'a', 'an',
]);
// ── D-BP150-012 FIX 3 -- structural refusal signals, see file header. Grammatical/structural only,
//    same curation discipline as FUNCTION_ONLY above: no domain vocabulary, nothing tuned to any
//    one question's content.
/** A sentence terminator (.!?) followed by whitespace and a capital letter -- the interior boundary
 *  between two sentences. A trailing terminator at the very end of the string is counted separately
 *  below (a single well-formed question ends with exactly one, and that one alone must not count as
 *  "more than one sentence"). */
const SENTENCE_INTERIOR_RE = /[.!?]+(?=\s+[A-Z])/g;
const TRAILING_TERMINATOR_RE = /[.!?]\s*$/;
function countSentences(text) {
    const interior = text.match(SENTENCE_INTERIOR_RE);
    const interiorCount = interior ? interior.length : 0;
    return interiorCount + (TRAILING_TERMINATOR_RE.test(text) ? 1 : 0);
}
/** An embedded lettered option marker ("a)", "b)", ...), preceded by punctuation/whitespace/start of
 *  string -- NOT by an open parenthesis. Measured against the bundled corpus (this ticket's own
 *  analysis script): requiring the punctuation/whitespace/start prefix (mirroring kind_check.ts's
 *  LETTERED_SUBCLAUSE_RE exactly) is what keeps this from false-firing on chemistry/physics notation
 *  that happens to look similar -- "SO_2 (g)" (gas-phase notation, qid 24/30) and "(D)" (the debye
 *  unit, qid 29) are all preceded by "(", not by whitespace/punctuation/start, and do not match. The
 *  one genuine hit in the bundled corpus is qid 46's " a) Cold weather..." -- a real bundled
 *  multi-part answer embedded in the question text. Paren-prefixed lists like qid 53/115's
 *  "(a) ... (b) ..." are not caught by this rule specifically, but both are also multi-sentence and
 *  therefore already refused by the sentence check above -- this rule does not need to catch every
 *  list shape on its own. */
const OPTION_MARKER_RE = /(?:^|[,;.\s])[a-jA-J]\)\s/;
/** D-BP150-012 FIX 3 -- word-count ceiling, picked from the bundled 140-question corpus (this
 *  ticket's own analysis script, not from the six locked benchmark qids -- see below). The corpus-
 *  wide median question length is 27 words. Restricting to single-sentence, no-option-marker
 *  questions (the ones the two checks above do NOT already catch), every verified-good short nest
 *  case tops out at 26 words (qid 23, "of"-split produces a sensible part/existence-check pair) and
 *  every case ABOVE 30 words is a multi-clause vignette, data table, or quoted passage (qid 7, 28,
 *  54, 104, 110, 130 -- six cases, none of them one of the six locked benchmark qids and none tuned
 *  to individually). 30 is a round number sitting a few words above the highest verified-good case
 *  and at the corpus median, so it excludes the six known-bad stragglers without touching the
 *  verified-good short end. NOT tuned to 46/66/72/85/92/98: none of those six sits in the 27-30 word
 *  band where this ceiling's exact value would matter (qid 92 is 11 words, qid 72 is 21 -- BELOW
 *  this ceiling, and remains un-refused by this rule specifically; see this ticket's return, which
 *  reports that honestly rather than lowering the ceiling to force qid 72 to refuse). */
const WORD_COUNT_CEILING = 30;
/** Checks the three structural preconditions, in the order they are cheapest/most decisive to
 *  evaluate. Returns the refusal reason string, or null when the input passes all three and
 *  decomposition may proceed. */
function checkStructuralPreconditions(text) {
    const t = text.trim();
    const words = t.split(/\s+/).filter(Boolean).length;
    if (OPTION_MARKER_RE.test(t)) {
        return 'input contains an embedded lettered option marker (e.g. "a)", "b)") -- a bundled '
            + 'multi-part answer/scenario, not a single decomposable ask-phrase';
    }
    const sentences = countSentences(t);
    if (sentences > 1) {
        return `input spans ${sentences} sentences -- Nest was taught on a single-sentence ask (qid 92, `
            + '11 words); a multi-sentence input is a passage or scenario stem, and mechanically splitting '
            + 'it on the first " of " produces mid-sentence garbage rather than a real decomposition';
    }
    if (words > WORD_COUNT_CEILING) {
        return `input is ${words} words, over the ${WORD_COUNT_CEILING}-word ceiling (corpus median 27 `
            + 'words; every verified-good short nest case in the bundled corpus sits at or below 26) -- too '
            + 'long to be the short definitional/framework ask Nest was taught on';
    }
    return null;
}
/**
 * Finds an outer-frame candidate: "within/in/according to/under <Capitalized Multi-Word Span>",
 * anywhere in `phrase`. Exported so substitution_search.ts reuses this exact rule rather than
 * re-deriving it -- "mix and match", per the governing canon's stated purpose for elements. One
 * frame-detection rule for the whole registry.
 */
export function findFrame(phrase) {
    const m = FRAME_RE.exec(phrase);
    if (!m)
        return null;
    return {
        frame: m[1].trim(),
        matched: m[0],
        why: `matched "${m[0].trim()}" -- a capitalized multi-word span after a within/in/according-to/`
            + 'under preposition names the outer framework (Founder: "what is X to begin with?")',
    };
}
/** Strips a leading interrogative prefix ("what is the ", "which are ", ...) if present, else a
 *  bare leading article ("the "/"a "/"an "/"any "). Never strips both -- the interrogative form
 *  already consumes any article that follows it. */
function stripLeadWords(phrase) {
    const interr = INTERROGATIVE_PREFIX_RE.exec(phrase);
    if (interr) {
        return { cleaned: phrase.slice(interr[0].length).trim(), stripped: interr[0].trim() };
    }
    const art = LEADING_ARTICLE_RE.exec(phrase);
    if (art) {
        return { cleaned: phrase.slice(art[0].length).trim(), stripped: art[0].trim() };
    }
    return { cleaned: phrase.trim(), stripped: null };
}
/**
 * E-NEST. Decomposes `phrase` into the ordered nest canon describes, outermost frame first.
 * Mechanical rules only -- see this file's header. Every level carries its `why`.
 *
 * Accepts either a raw question ("Within Critical Security Studies, what is the referent object of
 * security?") or an already-isolated phrase ("the referent object of security within Critical
 * Security Studies") -- both forms appear in this ticket and both produce the same four levels in
 * the same order, because frame-detection scans the whole input rather than assuming position.
 *
 * Depth-1 (a single whole-phrase level, nothing nested) is the correct, expected output for most
 * questions -- canon says the prior single-term signature "is a special case of the nest with depth
 * 1", not a failure of this function.
 *
 * D-BP150-012 FIX 3: before any of the above, the input is checked against three structural
 * preconditions (see checkStructuralPreconditions() and this file's header). Failing any one of
 * them REFUSES the decomposition outright -- `levels` is a single whole-phrase level (the trimmed
 * input, unsplit) and `refused` is true. This is the kind-check canon's nonsense test applied to
 * this element's own output: a step that cannot judge its result well-formed must refuse rather
 * than emit it.
 */
export function buildNest(phrase) {
    const input = String(phrase);
    const levels = [];
    // Strip a trailing "?" before any other processing -- it carries no content.
    let working = input.trim().replace(/\?+\s*$/, '').trim();
    const structuralRefusal = checkStructuralPreconditions(working);
    if (structuralRefusal) {
        const why = `REFUSED decomposition: ${structuralRefusal} -- returning a single whole-phrase `
            + 'level per D-BP150-012 FIX 3 (canon: a step that cannot judge its own output well-formed '
            + 'must refuse rather than emit nonsense)';
        return {
            input,
            levels: [{ label: 'whole-phrase', text: working, why }],
            refused: true,
            why,
        };
    }
    const frameMatch = findFrame(working);
    if (frameMatch) {
        levels.push({ label: 'framework', text: frameMatch.frame, why: frameMatch.why });
        // Remove the matched frame clause and whatever connective punctuation is left where it sat
        // ("<frame clause>, <rest>" or "<rest> <frame clause>").
        working = working.replace(frameMatch.matched, ' ').trim();
        working = working.replace(/^[,\s]+/, '').replace(/[,\s]+$/, '').trim();
    }
    const { cleaned, stripped } = stripLeadWords(working);
    const strippedWhy = stripped ? ` (dropped leading "${stripped}", carries no content)` : '';
    const ofIdx = cleaned.indexOf(' of ');
    let wholePhraseText = cleaned;
    let splitApplied = false;
    if (ofIdx > 0) {
        const x = cleaned.slice(0, ofIdx).trim();
        const y = cleaned.slice(ofIdx + 4).trim();
        const xTokens = x.toLowerCase().split(/\s+/).filter(Boolean);
        const xIsFunctionOnly = xTokens.length === 0 || xTokens.every((t) => FUNCTION_ONLY.has(t));
        if (!xIsFunctionOnly && y.length > 0) {
            splitApplied = true;
            levels.push({
                label: 'part',
                text: x,
                why: `"X of Y" split on the first " of "${strippedWhy}: the part inside the frame is `
                    + `"${x}" -- what is ${x}, and what does it refer to`,
            });
            const xParts = x.split(/\s+/).filter(Boolean);
            const head = xParts[xParts.length - 1];
            const existenceText = `${head} of ${y}`;
            if (xParts.length > 1 && existenceText.toLowerCase() !== x.toLowerCase()) {
                levels.push({
                    label: 'existence-check',
                    text: existenceText,
                    why: `drops "${x}"'s modifier down to its head noun ("${head}") before trusting the `
                        + `fuller phrase -- checks whether "${existenceText}" is a real construct at all `
                        + '(Founder: "to see if that\'s a thing")',
                });
            }
            wholePhraseText = `${x} of ${y}`;
        }
    }
    levels.push({
        label: 'whole-phrase',
        text: wholePhraseText,
        why: splitApplied
            ? `the whole phrase, now that ${frameMatch ? 'the frame, ' : ''}the part, and the existence `
                + 'check have each been named separately'
            : `no "X of Y" split found (or its X carried no content)${strippedWhy} -- treated as a single `
                + 'term; depth-1 is "a special case of the nest with depth 1" per canon',
    });
    const why = `${levels.length} level(s): ${levels.map((l) => l.label).join(' -> ')}`;
    return { input, levels, refused: false, why };
}
