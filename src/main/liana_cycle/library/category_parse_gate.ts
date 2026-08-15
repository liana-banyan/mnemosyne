// category_parse_gate.ts -- D-BP154-063/BISHOP-SEG/S52/seg-wiregate
//
// THE ONE SHARED "following X ..." CATEGORY-PARSE GATE. Was a byte-identical regex duplicated in
// THREE places -- softballs_step.ts's own deriveSoftballsCategory(), discriminator_step.ts's own
// deriveDiscriminatorCategory(), human_nuance_step.ts's own deriveHumanNuanceCategory() -- the
// same defect CLASS this session has been sweeping all day (entity_resolution.ts's own
// resolveNameToOption(), D-BP154-052, was the letter-prefix-strip version of the identical
// problem: a mechanical helper living in N places instead of one). Extracted here; the three
// files above now call this and nothing else parses this shape.
//
// CORRECTION, VERIFIED AGAINST THE ACTUAL CODE (not the dispatch's own recollection of it):
// named_set_step.ts's deriveNamedSetProperty() and discriminator_step.ts's own
// deriveDiscriminatorSuperlativeProperty() do NOT use this regex at all -- they parse a
// DIFFERENT shape ("one of the ..."/"considered the ...", the SUPERLATIVE PROPERTY, not the bare
// CATEGORY) and were not touched. Read before writing, not assumed from the dispatch text.
//
// WHAT THE FOUNDER'S OWN 20-QUESTION RUN ESTABLISHED (D-BP154-061/062 dispatch, quoted verbatim
// where marked): of the 20 standing MMLU-Pro ids (HARDWIRE-01 line 242), 15 have no "following"
// clause at all -- word problems, direct-recall items, a different stem shape entirely. THESE ARE
// HONEST INAPPLICABLE, NOT PARSER BUGS, and this file says so structurally (see
// CategoryParseResult.reason) rather than returning the same generic null a real bug would.
//
// The remaining 4 are genuine near-misses, each independently reproduced against the bundled
// MMLU-Pro corpus (resources/mmlu_pro_bundled/questions.jsonl) before writing a line of fix:
//   qid 1   "Which of the following would most likely provide examples of mitotic cell
//            divisions?" -- "following" is followed immediately by "would", an auxiliary, not a
//            noun. STAYS inapplicable on purpose after this fix too (see CLAUSE_VERB_MARKERS/
//            truncateAtClauseVerb() below) -- "no captured noun" was never a parser bug, it is
//            what the sentence actually says.
//   qid 46  "Indicate whether the following economic events represent a change in supply or a
//            change in quantity supplied." -- right shape ("following NOUN VERB"), wrong verb
//            (this file's old regex only accepted is|are). Fixed by widening the accepted verb
//            set (LINKING_VERBS below).
//   qid 79  "This question refers to the following information. ... By the 1800s, the method of
//            empirical reasoning reflected in the passage had undergone which of the following
//            changes?" -- TWO "following" clauses. MEASURED (not assumed) against the OLD regex:
//            it does NOT match at all here (its `[a-z\s]*?` capture cannot cross the period right
//            after "information", so it never reaches any later is/are) -- so this qid's old
//            failure mode is the same bare null as the others, not a garbage cross-passage
//            capture (an earlier draft of this comment claimed the latter without having actually
//            run the old regex against it; corrected after testing). What DOES need fixing here:
//            "the following information" is a reference preamble (names WHAT WAS SUPPLIED, not
//            the category being asked about) and must never be allowed to parse as a category on
//            its own once the gate is widened enough to reach it -- getting that wrong is exactly
//            "widening a gate to force a pass" (the Founder's own words, this dispatch). Handled
//            by (a) trying the question's own LAST "following" clause first (MMLU-Pro's own
//            convention: reference material precedes the actual question), which finds "...
//            following changes?" before ever considering the preamble, and (b) an explicit
//            REFERENCE_PREAMBLE_HEADS blocklist as a second, independent guard in case a preamble
//            clause is ever the ONLY "following" clause in a question (proven by the invented-
//            vocabulary test in this file's own .test.ts sibling).
//   qid 124 "People who are able to be hypnotized easily are likely to score high on which of the
//            following dimensions of the big five personality traits?" -- category present
//            ("dimensions of the big five personality traits"), no linking verb at all (the bare,
//            un-copula'd "which of the following X?" shape). Fixed by a second extraction branch
//            (the verb-less, clause-final noun phrase, which the "of ..." tail rides along with
//            for free -- no separate handling needed for "a category noun that may sit after of").
//
// A FIFTH CASE, FOUND BY THE STANDING-20 LIVE SWEEP ITSELF (not named in the dispatch, but the
// SAME general mechanism catching a shape nobody had reproduced by hand): qid 33 "... Which of
// the following code segments will correctly create newList?" -- the verb-less branch's FIRST
// version captured the WHOLE remainder of the clause, "code segments will correctly create
// newList", because it only checked the phrase's own HEAD word against a modal/auxiliary
// blocklist -- "will" sits in the MIDDLE of the phrase, past the head, and was never checked.
// This is exactly the same defect class as qid 79's "following information" (a widened gate
// accepting something it should not), just discovered by the live run rather than a hand
// reproduction. Fixed by truncateAtClauseVerb(): the capture is cut at the FIRST clause-verb
// marker found ANYWHERE in it, not only at the head, so the category becomes "code segments" and
// the verb phrase that follows it is correctly excluded.
//
// WIDENED WITHOUT LOOSENED (the Founder's own instruction, this dispatch, verbatim: "widen what
// it ACCEPTS without loosening what it VALIDATES"). Two independent widenings, both still
// MECHANICAL parsing of the question's OWN wording, never a judgment call, never keyed to a
// specific qid (HARDWIRE-22/FD-BP153-06 -- proven in this file's own .test.ts with invented
// vocabulary, not qid 98's or qid 46's real words):
//   (a) linking verbs beyond is|are: represent(s), would, describe(s)/describe, constitutes/
//       constitute.
//   (b) a verb-less shape, "following NOUN_PHRASE[?]", anchored at the END of its own clause --
//       accepted ONLY when the phrase's own HEAD WORD is not itself a stand-in for a verb (a
//       modal/auxiliary -- "would", "is", "are", etc. -- signals this is a VERB phrase, not a
//       NOUN phrase; qid 1's own shape) and is not a generic reference-preamble noun ("the
//       following information/passage/text/..."; qid 79's own decoy).
//
// SCOPE, WHY CLAUSE-SPLITTING STILL MATTERS even though the OLD regex happened not to cross
// qid 79's own period after "information" (measured above -- its character class stops at any
// punctuation outside [a-z\s], so THAT specific decoy never triggered a cross-passage garbage
// match in practice). It is still the right general fix: `[a-z\s]*?` DOES match newlines (`\s`
// includes them), so any passage using only letters, spaces and newlines between two "following"
// occurrences -- plausible corpus text -- COULD cross into an unrelated later "is"/"are" clause
// under the old unrestricted scan. Splitting into clause-like segments on [.?!\n] first and only
// ever matching WITHIN one segment makes that structurally impossible regardless of punctuation,
// and is what lets "the last following-clause wins" rule (below) work at all -- a reference-
// preamble clause and the real question clause can never merge into one capture. A clause that
// yields no valid category is simply skipped, never force-matched; if NO clause containing
// "following" yields one, the question is INAPPLICABLE and the specific reason is returned
// (D-BP154-063 bullet 4: "make the receipt say which").

const LINKING_VERBS = ['is', 'are', 'represent', 'represents', 'would', 'describes', 'describe', 'constitutes', 'constitute'];

const VERB_ANCHORED_PATTERN = new RegExp(`following\\s+([a-z][a-z\\s]*?)\\s+(?:${LINKING_VERBS.join('|')})\\b`, 'i');

// A modal auxiliary or copula anywhere in a branch-2 (verb-less) capture marks the boundary
// between the NOUN PHRASE and the VERB PHRASE that follows it -- "following code segments WILL
// correctly create newList" is a category ("code segments"), not "code segments will correctly
// create newList" (qid 33's own decoy, live-measured this dispatch: the standing-20 sweep, run
// BEFORE this truncation existed, produced exactly that run-on as Softballs:1's/Discriminator:1's/
// HumanNuance:1's own `category`). Checked in TWO ways: (a) as the phrase's own HEAD word, which
// disqualifies the match entirely (qid 1's own shape -- "following would...", there is no noun
// before the marker at all, nothing to truncate TO); (b) as a marker occurring LATER in the
// phrase, which truncates the capture to everything strictly before it (qid 33's own fix).
const CLAUSE_VERB_MARKERS = new Set([
  'would', 'could', 'should', 'will', 'shall', 'might', 'may', 'must', 'can',
  'do', 'does', 'did', 'is', 'are', 'was', 'were', 'has', 'have', 'had', 'being', 'been',
]);

/** Truncates a branch-2 capture at the first CLAUSE_VERB_MARKERS token found anywhere in it --
 *  the noun phrase never includes the verb phrase that follows it (qid 33's own fix, above).
 *  Returns '' when the marker IS the first word (qid 1's own shape -- nothing before it to keep). */
function truncateAtClauseVerb(phrase: string): string {
  const words = phrase.trim().split(/\s+/);
  const markerIdx = words.findIndex((w) => CLAUSE_VERB_MARKERS.has(w.toLowerCase()));
  if (markerIdx === -1) return phrase.trim();
  return words.slice(0, markerIdx).join(' ').trim();
}

// Generic reference-preamble nouns -- "the following information/passage/..." names WHAT WAS
// SUPPLIED to the reader, not the category the item is asking about. A head word in this set is
// rejected as a category candidate under EITHER extraction branch, regardless of what follows it
// (qid 79's own decoy, kept failing on purpose).
const REFERENCE_PREAMBLE_HEADS = new Set([
  'information', 'passage', 'passages', 'text', 'excerpt', 'excerpts', 'data', 'statement',
  'statements', 'scenario', 'scenarios', 'chart', 'charts', 'table', 'tables', 'figure', 'figures',
  'article', 'articles', 'quote', 'quotes', 'quotation', 'quotations', 'list', 'lists',
  'paragraph', 'paragraphs', 'diagram', 'diagrams', 'image', 'images', 'graph', 'graphs',
]);

function headWord(phrase: string): string {
  return phrase.trim().toLowerCase().split(/\s+/)[0] ?? '';
}

/** Splits the question's full text into clause-like segments -- never crossed by either
 *  extraction branch below, which is what keeps a reference-preamble sentence and the real
 *  question clause from ever merging into one capture (see this file's own header). */
function clauseSegments(question: string): string[] {
  return question.split(/[.?!\n]+/).map((s) => s.trim()).filter(Boolean);
}

export interface CategoryParseResult {
  category: string | null;
  /** Present only when category is null -- WHY no category was found, distinguishing "this
   *  question shape does not have a 'following' clause at all" (honest INAPPLICABLE, the 15-of-20
   *  case) from "'following' is present but no identifiable category noun could be isolated"
   *  (also INAPPLICABLE, never a forced guess) -- both are legitimate reach statements, neither
   *  is a defect (D-BP154-063 bullet 4). */
  reason?: string;
}

/** THE ONE PARSE. Pure text-structure parsing of the question's OWN wording, never a judgment
 *  about the world -- returns a null category (with a reason) rather than ever guessing. See this
 *  file's own header for the full derivation of both extraction branches and the qid-by-qid
 *  reproduction that motivated each. */
export function parseFollowingCategory(question: string): CategoryParseResult {
  const segs = clauseSegments(question).filter((s) => /\bfollowing\b/i.test(s));
  if (segs.length === 0) {
    return {
      category: null,
      reason: 'INAPPLICABLE -- no "following" clause anywhere in this question (a different stem '
        + 'shape entirely -- word problem, direct-recall item, etc.); this method does not apply '
        + 'to this question shape, which is not a defect in it',
    };
  }
  // Last-occurring "following" clause first -- MMLU-Pro's own convention: reference material (if
  // any) precedes the actual question, so the real category is found before a reference-preamble
  // clause is ever even tried.
  for (let i = segs.length - 1; i >= 0; i--) {
    const seg = segs[i];
    const verbMatch = seg.match(VERB_ANCHORED_PATTERN);
    if (verbMatch) {
      const cat = verbMatch[1].trim();
      if (cat && !REFERENCE_PREAMBLE_HEADS.has(headWord(cat))) return { category: cat };
    }
    const verbLessMatch = seg.match(/following\s+([a-z][a-z\s]*)$/i);
    if (verbLessMatch) {
      // D-BP154-063, LIVE-MEASURED FIX (the standing-20 sweep this dispatch, qid 33): truncate at
      // the first clause-verb marker BEFORE checking the head word, so "code segments will
      // correctly create newList" becomes the category "code segments", not the whole run-on --
      // see truncateAtClauseVerb()'s own header.
      const cat = truncateAtClauseVerb(verbLessMatch[1]);
      const head = headWord(cat);
      if (cat && !REFERENCE_PREAMBLE_HEADS.has(head)) {
        return { category: cat };
      }
    }
  }
  return {
    category: null,
    reason: 'INAPPLICABLE -- "following" appears but no identifiable category noun could be '
      + 'mechanically isolated (every candidate was a verb-phrase head, a reference-preamble '
      + 'placeholder, or an unrecognized shape); refusing rather than guessing a category',
  };
}
