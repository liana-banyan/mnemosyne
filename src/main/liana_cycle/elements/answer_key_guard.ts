// elements/answer_key_guard.ts -- E-ANSWER-KEY-GUARD -- D-BP150-019/BISHOP/seg-contamination
//
// THE MEASURED FAILURE THIS CLOSES. LIANA_RUN_qid85_2026-08-09T06-24-55-611Z.json (this ticket's
// governing evidence) carried two denotations into the evidence pool that are leaked answer-key
// text, not genuine definitions of "bias":
//
//   denotation 33 [General Psychology], source studocu.com: "The correct answer is: a. A sample
//   that is not representative of a pop" -- reproduces option E ("It describes a sample that is
//   not representative of the population.") and states outright that it IS the answer.
//
//   denotation 32 [unstated], source homework.study.com: "Bias describes a process that results in
//   a sample that does not represent the population." -- reproduces option A ("It describes a
//   process that results in a sample that does not represent the population.") near-verbatim; the
//   surrounding passage (not the extracted sentence itself) reads "...True or False? 1 answer --
//   Top answer: The given statement is true: bias describes a process that results in a sample
//   that does not represent the population" -- a True/False quiz page confirming the option is
//   correct, with the marker phrase falling OUTSIDE the sentence Gemma would cleanly extract.
//
// The pre-existing filter (definitional_cascade.ts's Stage-1 reuse guard) only ever ran appearsIn()
// -- an EXACT substring test -- against the block that fed Stage 1, and only for reused blocks.
// It fired once, correctly, on qid 85's crackap.com block (verbatim option J inside an AP Statistics
// "Answer and Explanation" page). It did NOT fire on studocu.com or homework.study.com because
// neither reproduces an option's FULL text byte-for-byte: studocu paraphrases the frame ("a sample"
// vs option E's "It describes a sample"), and homework.study.com swaps the frame's subject ("Bias"
// vs option A's "It describes a process that"). Two independent, mechanical hardenings close both
// gaps, applied to EVERY denotation from EVERY source (survey_ask.ts's extractDenotationFromBlock,
// the single choke point every query-derived AND reused block passes through -- see that file):
//
//   (a) findAnswerKeyMarker() -- rejects the whole PASSAGE, before any extraction is attempted,
//       when it contains a phrase that DECLARES an answer rather than DEFINES a term. Checked at
//       the passage level (not just the extracted sentence) because extraction can cleanly strip a
//       marker's own wording while still laundering a sentence lifted from an answer-key page --
//       exactly the homework.study.com case above, where the marker is in the passage but not in
//       what Gemma would copy.
//   (b) isNearVerbatimOptionMatch() -- rejects an extracted SENTENCE that reproduces one of the
//       question's own options with only a leading frame ("It describes ", "It refers to ") and
//       articles (a/an/the) differing. Exact substring match on a stripped/normalized text, per
//       HARDWIRE-22 ("similarity is not identity, never fuzzy") -- this is appearsIn() with one
//       extra, generic normalization pass on both sides, not a similarity score.
//
// Every exclusion is returned with a reason naming the marker phrase or the option letter it
// reproduced (survey_ask.ts's existing discarded[]/note() plumbing prints it with the source URL --
// this file does not do its own transcript I/O, it is a pure predicate module).
//
// WHAT THIS FILE DOES NOT DO:
//   - It does not author domain vocabulary. Every marker below is a FORM phrase ("the correct
//     answer is", "top answer:") that declares an answer exists, never a topical word (contrast the
//     "organs/drains" incident this ticket's own dispatch cites as the failure mode to avoid).
//   - It does not fuzz-match. Both checks are exact substring tests on normalized text -- no bigram
//     score, no embedding distance, no threshold that trades precision for recall by degrees.

import { norm } from '../methods/comparative_cascade';

// ─────────────────────────── (a) answer-key marker phrases ───────────────────────────

export interface AnswerKeyMarker {
  /** Human-readable label, used in discard reasons and this file's own header quotes. */
  label: string;
  re: RegExp;
  /** True when this session's own corpus search (LIANA_RUN_qid85_2026-08-09T06-24-55-611Z.json and
   *  Downloads *mnemo_mesh_test_receipt_*.json) independently turned up this exact phrase. False
   *  means the phrase is included because the governing ticket named it directly as an example of
   *  the SAME form-shape as the observed ones -- included on instruction, not on independent
   *  discovery, and flagged here rather than silently presented as observed. */
  observed: boolean;
  /** Where `observed: true` markers were actually found, quoted, for audit. */
  observedIn?: string;
}

export const ANSWER_KEY_MARKERS: AnswerKeyMarker[] = [
  {
    label: 'the correct answer is',
    re: /\bcorrect answer\s+is\b/i,
    observed: true,
    observedIn: 'studocu.com block, LIANA_RUN_qid85_2026-08-09T06-24-55-611Z.json: "1 answer · '
      + 'Top answer: The correct answer is: a. A sample that is not representative of a pop"; also '
      + '021/022/023/026mnemo_mesh_test_receipt_*.json: "Detailed Solution. The correct answer is '
      + 'South-east Asia." and "The correct answer is determined by the following calculations"',
  },
  {
    label: 'top answer:',
    re: /\btop answer\s*:/i,
    observed: true,
    observedIn: 'studocu.com AND homework.study.com blocks, same receipt: "1 answer · Top answer: ..."',
  },
  {
    label: 'answer and explanation',
    re: /\banswer and explanation\b/i,
    observed: true,
    observedIn: 'crackap.com block title, same receipt: "AP Statistics Question 176: Answer and Explanation"',
  },
  {
    label: 'detailed solution',
    re: /\bdetailed solution\b/i,
    observed: true,
    observedIn: '021/022/023mnemo_mesh_test_receipt_*.json: "Detailed Solution. The correct answer is South-east Asia."',
  },
  {
    label: 'solution:',
    re: /\bsolution\s*:/i,
    observed: true,
    observedIn: '032mnemo_mesh_test_receipt_2026-08-01T23-09-21-469Z.json: "...this matches the classic solution: 256 levels requires..."',
  },
  // The three below are the ticket's own explicit examples ("the correct answer is", "correct
  // answer:", "answer:", "answer and explanation", "explanation:", "solution:"). This session's
  // grep did not independently turn up a bare instance of these three; included per direct
  // instruction because they are the identical form-shape as the observed markers above (a labeled
  // declaration that an answer/explanation follows), not because this session proved they occur.
  { label: 'correct answer:', re: /\bcorrect answer\s*:/i, observed: false },
  { label: 'explanation:', re: /\bexplanation\s*:/i, observed: false },
  { label: 'answer:', re: /\banswer\s*:/i, observed: false },
];

/** Returns the first marker found in `passage`, or null. Checked against the FULL passage
 *  (title -- body), not just a sentence -- see this file's header for why. */
export function findAnswerKeyMarker(passage: string): { label: string } | null {
  const text = String(passage ?? '');
  for (const m of ANSWER_KEY_MARKERS) {
    if (m.re.test(text)) return { label: m.label };
  }
  return null;
}

// ─────────────────────────── (b) near-verbatim option match ───────────────────────────

/** Structural, sentence-initial pronoun+verb frame -- "It describes...", "It refers to...", "This
 *  means...". Generic English grammar (subject pronoun + copula/verb), not option-specific content;
 *  the exact two examples the governing ticket names ("It describes ", "It refers to ") are covered,
 *  plus the same shape for the small closed set of verbs a definitional option realistically uses. */
const LEADING_FRAME_RE = /^\s*(it|this|that)\s+(describes|refers\s+to|explains?|means|denotes|represents|is)\s+(that\s+)?/i;

/** Whole-word article removal -- grammar, not content, the same discipline field_gate.ts's own
 *  FIELD_GATE_STOPWORDS documents for a different purpose. */
const ARTICLE_RE = /\b(a|an|the)\b/gi;

function stripLeadingFrame(s: string): string {
  return String(s ?? '').replace(LEADING_FRAME_RE, '');
}

function stripArticles(s: string): string {
  return String(s ?? '').replace(ARTICLE_RE, ' ');
}

/** Minimum normalized length (characters) the frame+article-stripped OPTION text must reach before
 *  it is even attempted as a near-verbatim needle -- guards against a short coincidental fragment
 *  counting as "reproduction." MEASURED against qid 85's real ten options, the only full
 *  "It describes..." competing-statement option set this session had real text for: stripped
 *  lengths ranged from option C ("process that uses random sampling method", 43 chars) and option H
 *  ("lack of randomization in sampling process", 44 chars) at the SHORT end, up to option J's 85
 *  chars. 20 is set at roughly HALF the measured floor (43) -- long enough to require several
 *  content words in a row (never a one- or two-word coincidence), with a wide safety margin below
 *  every option this session actually observed, so raising the bar to 20 does not risk excluding a
 *  real option's own clause. */
export const MIN_NEAR_VERBATIM_CHARS = 20;

export function nearVerbatimNeedle(optionText: string): string {
  return norm(stripArticles(stripLeadingFrame(optionText)));
}

/** Detects whether `text` (an extracted denotation sentence, or a fuller passage) reproduces
 *  `optionText` near-verbatim -- same words, same order, differing only in a stripped leading frame
 *  and articles. Exact substring match on the stripped/normalized text on BOTH sides (the passage
 *  side is also article-stripped, so a "the"/"a" the option's stripping removed cannot break
 *  contiguity) -- not a similarity score. */
export function isNearVerbatimOptionMatch(text: string, optionText: string): boolean {
  const needle = nearVerbatimNeedle(optionText);
  if (needle.length < MIN_NEAR_VERBATIM_CHARS) return false;
  const haystack = norm(stripArticles(String(text ?? '')));
  return haystack.includes(needle);
}

/** Checks `text` against every option in `options` (letter order), returns the first option it
 *  near-verbatim reproduces, or null when `options` is not supplied (callers with no option set in
 *  scope -- e.g. surveyAskNested()'s per-level calls -- simply skip this check, exactly as before
 *  this ticket). */
export function findNearVerbatimOptionMatch(
  text: string,
  options: Record<string, string> | null | undefined,
): { letter: string; optionText: string } | null {
  if (!options) return null;
  for (const [L, optionText] of Object.entries(options)) {
    if (isNearVerbatimOptionMatch(text, optionText)) return { letter: L, optionText };
  }
  return null;
}
