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

/** Capitalized multi-word span after a within/in/according-to/under preposition. Capitalization is
 *  load-bearing and matched WITHOUT the /i flag on the span itself, for the same reason
 *  demand_test.ts's LOCATE-IN-FRAMEWORK cue does it that way: it is what distinguishes a named
 *  framework ("Critical Security Studies") from an ordinary prepositional phrase ("in the following
 *  weeks", "in this passage"). */
const FRAME_RE = /\b(?:[Ww]ithin|[Ii]n|[Aa]ccording to|[Uu]nder)\s+([A-Z][\w'-]*(?:\s+[A-Z][\w'-]*)+)/;

const INTERROGATIVE_PREFIX_RE =
  /^(?:what|which|who|where|when|how)\s+(?:is|are|was|were)\s+(?:the\s+|a\s+|an\s+|any\s+)?/i;

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

export interface FrameMatch {
  /** The frame name, e.g. "Critical Security Studies" -- capitalization preserved as matched. */
  frame: string;
  /** The full matched span, e.g. "Within Critical Security Studies" -- for stripping from the
   *  working phrase. */
  matched: string;
  why: string;
}

/**
 * Finds an outer-frame candidate: "within/in/according to/under <Capitalized Multi-Word Span>",
 * anywhere in `phrase`. Exported so substitution_search.ts reuses this exact rule rather than
 * re-deriving it -- "mix and match", per the governing canon's stated purpose for elements. One
 * frame-detection rule for the whole registry.
 */
export function findFrame(phrase: string): FrameMatch | null {
  const m = FRAME_RE.exec(phrase);
  if (!m) return null;
  return {
    frame: m[1].trim(),
    matched: m[0],
    why: `matched "${m[0].trim()}" -- a capitalized multi-word span after a within/in/according-to/`
      + 'under preposition names the outer framework (Founder: "what is X to begin with?")',
  };
}

export interface NestLevel {
  label: 'framework' | 'part' | 'existence-check' | 'whole-phrase';
  text: string;
  /** Always present -- which mechanical rule produced this level and why it sits at this depth. */
  why: string;
}

export interface NestResult {
  input: string;
  /** Ordered outermost-first, per canon. Always at least one level (whole-phrase). */
  levels: NestLevel[];
  /** Always present -- the top-line honest summary for the transcript. */
  why: string;
}

/** Strips a leading interrogative prefix ("what is the ", "which are ", ...) if present, else a
 *  bare leading article ("the "/"a "/"an "/"any "). Never strips both -- the interrogative form
 *  already consumes any article that follows it. */
function stripLeadWords(phrase: string): { cleaned: string; stripped: string | null } {
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
 */
export function buildNest(phrase: string): NestResult {
  const input = String(phrase);
  const levels: NestLevel[] = [];

  // Strip a trailing "?" before any other processing -- it carries no content.
  let working = input.trim().replace(/\?+\s*$/, '').trim();

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
  return { input, levels, why };
}
