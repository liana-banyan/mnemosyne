// D-BP223-BM04-h2cbpv9w-170 / PARSE_ASK / seat BM04, module C5 of the shared parsing layer.
// Spec: PLATFORM/BISHOP_DROPZONE/D-BP223-BM04-h2cbpv9w-170_PARSING_LAYER_SCOPE.md, section C5.
//
// PURE DETERMINISTIC CODE. No model call of any kind, per HARDWIRE-22 (the Extraction Blood Rule)
// and this dispatch's own instruction ("this layer must remain 100% deterministic code with no
// model in the loop, now or in any later iteration, without a fresh Founder ruling"). This module
// answers exactly one question -- "what is this text ASKING FOR" -- never "what should be done
// with the answer" (that judgment stays in each method's own shapeTest, per the scope doc's own
// cross-cutting design point in section C). It returns spans and raw text, never a parsed
// Quantity, so it has zero dependency on parse/quantities.ts (built by a separate, concurrent SEG
// dispatch against the same scope doc) -- matching this dispatch's own instruction to keep ask.ts
// independent rather than hand-copy a type (BP222 ruling: "a hand-copied contract is the defect,
// not bad types" -- NEVER re-declare another module's type locally).
//
// CONSOLIDATES the "cut the text at the interrogative" pattern that is duplicated, with several
// mutually-incompatible regexes and zero shared import, across the methods read for this build
// (grep -li "how many\|how much" methods/*.ts: 65 of 105 files). The five richest read in full:
//   - total_minus_known_parts_backsolve.ts        /how (many|much)|what (is|was|will)/i, splits
//     the question at the match into a declarative BODY and a discarded interrogative tail.
//   - two_actor_distance_rate_time_difference.ts  /how (long|many|much)|what (is|was|will)/i,
//     identical cut-the-tail approach, then re-splits the BODY into sentences.
//   - sum_of_independent_rate_count_products.ts   /how (many|much)|what (is|was|will|does)/i,
//     own comment: "cut off the interrogative tail so its numbers are never scanned as terms."
//   - ratio_chain_backsolve_no_sum.ts             a DIFFERENT approach: cuts at the LAST COMMA
//     (not a regex match), then requires the target item's noun to stem-match inside that
//     trailing clause and rejects if the OTHER item's noun also appears there (ambiguous target).
//   - age_multiple_then_project_forward.ts        same last-comma-clause approach, checks which
//     of two actor names the trailing clause names to decide which one the question is about.
// Every one of the five hand-rolls its own notion of "the ask clause." This module is the single
// shared, tested, positive-evidence version: it isolates the real ask (the LAST interrogative or
// imperative sentence -- an earlier "how much"-shaped sentence embedded in narration, e.g. "Albert
// is wondering how much pizza he can eat," is declarative narration, not a question, and is never
// picked), reports what it can verify about that ask, and abstains (returns null) rather than
// guessing when no interrogative or imperative ask exists at all.

/** The eleven ask shapes this module recognizes. `'unknown'` means an ask sentence WAS found (so
 *  the return value is a real `Ask`, not an abstain) but its shape did not positive-match any of
 *  the other ten -- still real evidence, just untyped. */
export type AskType =
  | 'how-many'
  | 'how-much'
  | 'how-long'
  | 'how-old'
  | 'what-total'
  | 'what-difference'
  | 'what-percent'
  | 'what-fraction'
  | 'which-more'
  | 'yes-no'
  | 'unknown';

/** A short span of text with its exact [start, end) character offset into the ORIGINAL input
 *  string handed to `extractAsk`. `end` is exclusive, so `text === original.slice(start, end)`. */
export interface AskSpan {
  text: string;
  span: [number, number];
}

/** One OTHER ask found in a multi-question text, earliest first. Deliberately narrower than
 *  `Ask` (no nested `otherAsks`, no entity/actor/hint fields) -- this module never recurses past
 *  one level, per the scope doc's own "return the LAST ask and record the others" instruction. */
export interface OtherAsk {
  sentence: string;
  span: [number, number];
  askType: AskType;
}

export interface Ask {
  /** The full ask sentence/clause, verbatim from the source text (trimmed, punctuation intact). */
  sentence: string;
  /** [start, end) character offsets of `sentence` into the ORIGINAL input text. */
  span: [number, number];
  askType: AskType;
  /** The noun phrase the ask names ("how many PAGES", "how much MONEY"), when the ask clause
   *  itself names one. Positive-evidence only -- never inferred from earlier in the text; that
   *  resolution (matching this against a quantity/entity established elsewhere) is a job for a
   *  method's own logic or a future parse/entities.ts, not this module. */
  targetEntity?: AskSpan;
  /** The actor/subject the ask names ("does SHE earn", "does HE eat", "will MIKE have"), when the
   *  ask clause itself names one -- may be a bare pronoun. This module does NOT resolve pronouns
   *  to an earlier-named actor (that is parse/entities.ts's job); it only reports what the ask
   *  clause's own subject position names. */
  targetActor?: AskSpan;
  /** A unit/aggregation cue drawn from the ask clause's own wording: one of "in total",
   *  "altogether", "combined", "left", "remaining", "more than", "per", "each", "average", or a
   *  bare unit/noun captured immediately after the interrogative when no aggregation cue fired. */
  unitHint?: string;
  /** A timeframe cue drawn from the ask clause's own wording ("a year", "a week", "each day",
   *  "in 20 weeks"), when named directly in the ask clause. */
  timeframeHint?: string;
  /** Every positive-evidence reason this Ask was built the way it was -- which pattern matched,
   *  why this sentence was chosen over another candidate, which fields could not be populated and
   *  why. Never empty on a non-null return. */
  evidence: string[];
  /** Present only when the text contains more than one interrogative/imperative ask -- every
   *  OTHER ask found, earliest first. Absent (not an empty array) when this is the only ask. */
  otherAsks?: OtherAsk[];
}

// ---------------------------------------------------------------------------------------------
// Sentence splitting, with exact spans into the original text.
// ---------------------------------------------------------------------------------------------

interface SentenceSpan {
  text: string;
  span: [number, number];
}

// A period directly after one of these title abbreviations ("Mr. Benson", "Mrs. Wilsborough",
// "Ms. Watson", "Dr. Lee") is NEVER a sentence boundary -- confirmed a real, measured defect this
// dispatch: an earlier version of this splitter cut "How much did Mr. Benson pay in all?" into
// "How much did Mr." + "Benson pay in all?", handing the trailing fragment back as the ask
// (losing its own "how much" wording and turning a clean how-much/actor-named ask into an
// unclassifiable 'unknown' with no actor). Found by manually inspecting 'unknown'-askType and
// otherAsks samples from the full 3,685-item gsm8k-train tuning-reserve coverage run, not
// guessed. The list is deliberately short and GSM8K-specific rather than a general abbreviation
// dictionary, per this module's own positive-evidence discipline.
const TITLE_ABBREVIATIONS = 'Mr|Mrs|Ms|Dr|Jr|Sr|Prof';
const ABBREVIATION_GUARD = `(?<!\\b(?:${TITLE_ABBREVIATIONS}))`;

/** Splits `text` into sentence-shaped spans on runs of . ! ? (optionally followed by a closing
 *  quote/paren, e.g. a question ending `face?"`) that are themselves followed by whitespace or
 *  end-of-string. A decimal point such as "2.5" is never followed by whitespace at that position
 *  (the digits sit hard against the period on both sides), so it is never mistaken for a sentence
 *  boundary -- confirmed against every numeric-decimal fixture this dispatch used. A period right
 *  after "Mr"/"Mrs"/"Ms"/"Dr"/"Jr"/"Sr"/"Prof" is likewise never a boundary (see
 *  TITLE_ABBREVIATIONS above). Each returned span is trimmed of surrounding whitespace, with the
 *  trim folded into the reported offsets so `text === original.slice(span[0], span[1])` always
 *  holds exactly. */
function splitSentences(text: string): SentenceSpan[] {
  const out: SentenceSpan[] = [];
  const boundary = new RegExp(`${ABBREVIATION_GUARD}[.!?]+["')\\]]*(?=\\s|$)`, 'g');
  let cursor = 0;
  let m: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((m = boundary.exec(text))) {
    const end = m.index + m[0].length;
    pushTrimmed(out, text, cursor, end);
    cursor = end;
  }
  if (cursor < text.length) {
    pushTrimmed(out, text, cursor, text.length);
  }
  return out;
}

function pushTrimmed(out: SentenceSpan[], text: string, start: number, end: number): void {
  const raw = text.slice(start, end);
  const leadingWs = raw.length - raw.replace(/^\s+/, '').length;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return;
  const realStart = start + leadingWs;
  out.push({ text: trimmed, span: [realStart, realStart + trimmed.length] });
}

// ---------------------------------------------------------------------------------------------
// Ask-candidate detection: a sentence is a candidate ask if it is a real question (ends in "?")
// or an imperative asking for a computation ("Find...", "Calculate...", "Determine..."), even
// without a question mark. A sentence that merely CONTAINS interrogative wording inside narration
// ("Albert is wondering how much pizza he can eat") is neither -- it ends in "." and does not
// start with an imperative verb, so it is correctly never a candidate.
// ---------------------------------------------------------------------------------------------

// Matches an imperative computation verb either at the very start of the sentence ("Calculate
// how many...") OR right after a comma ("If she sells them all, calculate how much..."). The
// comma form is the dominant shape in GSM8K-style word problems -- measured this dispatch: of the
// first 20 abstains found scanning the full 3,685-item gsm8k-train tuning reserve with an
// earlier, start-only version of this pattern, the overwhelming majority were a comma-introduced
// "If <condition>, calculate/determine/find <the ask>." clause the start-anchored pattern missed
// entirely. Requiring the comma (rather than matching the verb anywhere) keeps this a positive-
// evidence match -- it does not fire on "the calculated total" or "she calculates her total"
// appearing mid-clause with no preceding comma.
const IMPERATIVE_RE = /(?:^|,\s*)(?:find|calculate|compute|determine|work out|figure out|express|give|state|report)\b/i;

/** True when `sentenceText` ends with "?" -- tolerating a trailing closing quote/paren the
 *  splitter's own boundary regex already allows (e.g. a question ending `full face?"`), so a
 *  quoted question is never missed just because the quote mark, not the "?", is the last
 *  character in the trimmed sentence text. */
function isQuestionSentence(sentenceText: string): boolean {
  return /\?["')\]]*$/.test(sentenceText);
}

// A sentence that OPENS with an unambiguous wh-interrogative word/phrase is a real question even
// when its own terminal "?" was dropped -- a measured, real typo shape in this corpus (e.g. "How
// many ... after 5 days." with a trailing period, confirmed against 2 of the 4 items that
// remained unmatched after the comma-imperative fix above, out of the full 3,685-item gsm8k-train
// tuning reserve). Anchored to the SENTENCE START (never matched mid-sentence) so it stays
// positive evidence and does not fire on narration that merely CONTAINS "how much" mid-clause
// ("Albert is wondering how much pizza..." starts with "Albert", not "how much", so it is
// correctly never swept in by this rule).
const WH_INTERROGATIVE_START_RE = /^(?:how\s+(?:many|much|long|old)|what(?:'s)?\s+(?:is|was|are|were|percent|percentage|fraction|the)|which\b)/i;

function isAskCandidate(s: SentenceSpan): boolean {
  if (isQuestionSentence(s.text)) return true;
  if (IMPERATIVE_RE.test(s.text)) return true;
  return WH_INTERROGATIVE_START_RE.test(s.text);
}

// ---------------------------------------------------------------------------------------------
// askType classification, most-specific pattern first so e.g. "how many more" is read as a
// difference ask rather than a plain count ask, and "what percent ... more" is read as a percent
// ask rather than a difference ask.
// ---------------------------------------------------------------------------------------------

const ASK_TYPE_RULES: Array<[AskType, RegExp]> = [
  ['what-percent', /\bwhat\s+(?:percent|percentage)\b/i],
  ['what-fraction', /\bwhat\s+fraction\b/i],
  // "the difference" allows ONE modifier word ("the HEIGHT difference", "the PRICE difference"),
  // added after finding "What is the height difference between Bella and Anne's sister?" fall
  // through to 'unknown' in the full coverage run -- the bare "the difference" phrasing was too
  // narrow to catch the corpus's own "the <noun> difference" variant.
  ['what-difference', /\bhow\s+(?:many|much)\s+(?:more|fewer|less)\b|\bwhat(?:'s|\s+is|\s+was)\s+the\s+(?:\w+\s+)?difference\b/i],
  // how-many/how-much/how-long/how-old are checked BEFORE the generic what-total/which-more
  // patterns below: "how many hours IN TOTAL does he take" must stay 'how-many' (the interrogative
  // word is the stronger, more specific signal), so a bare "in total"/"altogether" cue never
  // steals classification away from an explicit how-many/how-much ask that happens to also use
  // aggregation wording.
  ['how-many', /\bhow\s+many\b|\bcalculate\s+the\s+number\s+of\b/i],
  ['how-much', /\bhow\s+much\b/i],
  // "how far" is the corpus's own distance-ask phrasing and has no dedicated AskType in this
  // module's fixed contract; "how-long" (a physical-extent ask, like duration) is the closest of
  // the ten named types, so it is grouped there rather than left 'unknown' -- found via the same
  // coverage-run inspection ("how far did it have to travel after the 3rd turn?").
  ['how-long', /\bhow\s+long\b|\bhow\s+far\b/i],
  // "what will/is/was ... age" catches the corpus's "What will be Matt's age 10 years from now?"
  // phrasing that bare "how old" alone misses.
  ['how-old', /\bhow\s+old\b|\bwhat\s+(?:is|was|are|were|will\s+be)\b[^.?!]*\bage\b/i],
  // Covers a real interrogative ("What is/What's the total...?", allowing "combined"/"total" as
  // synonyms), and the comma-imperative shape this corpus uses heavily ("If <condition>,
  // calculate the [combined] total number of X.") when no how-many/how-much/how-long/how-old
  // wording is present to classify it more specifically.
  ['what-total', /\bwhat(?:'s|\s+is|\s+was|\s+are|\s+were)\s+the\s+(?:combined\s+)?total\b|\bcalculate\s+the\s+(?:combined\s+)?total\b|\baltogether\b/i],
  ['which-more', /\bwhich\b[^?]*\b(?:more|greater|larger|bigger|higher|taller|older|younger|smaller|less|fewer)\b/i],
];

const YES_NO_START_RE = /^(is|are|was|were|does|do|did|can|could|will|would|has|have|had|should|must|isn't|aren't|wasn't|weren't|doesn't|don't|didn't|can't|couldn't|won't|wouldn't|hasn't|haven't|hadn't|shouldn't|mustn't)\b/i;
const WH_WORD_RE = /\b(how|what|which|who|when|where|why)\b/i;

function classifyAskType(sentenceText: string): { askType: AskType; reason: string } {
  for (const [type, re] of ASK_TYPE_RULES) {
    if (re.test(sentenceText)) {
      return { askType: type, reason: `askType '${type}' matched pattern ${re}` };
    }
  }
  if (isQuestionSentence(sentenceText) && YES_NO_START_RE.test(sentenceText) && !WH_WORD_RE.test(sentenceText)) {
    return { askType: 'yes-no', reason: 'askType \'yes-no\': starts with an auxiliary/modal verb, no wh-word present' };
  }
  return { askType: 'unknown', reason: 'askType \'unknown\': ask sentence found but no shape pattern matched' };
}

// ---------------------------------------------------------------------------------------------
// targetEntity: the noun phrase named directly after the interrogative trigger, up to (but not
// including) the next auxiliary/modal verb -- "how many PAGES does he write", "how much MONEY
// does Betty need". Positive evidence only: if no clean noun-then-verb shape is found, targetEntity
// stays undefined rather than guessing.
// ---------------------------------------------------------------------------------------------

const AUX_WORDS = 'do|does|did|is|are|was|were|will|would|can|could|should|must|has|have|had|shall|might|need|needs';
const ENTITY_AFTER_TRIGGER_RE = new RegExp(
  `\\b(?:how\\s+(?:many|much)|what\\s+is|what\\s+was|what\\s+are)\\s+([a-z][a-z-]*(?:\\s+[a-z][a-z-]*){0,3}?)\\s+(?:${AUX_WORDS})\\b`,
  'i',
);

const UNIT_HINT_PHRASES = ['in total', 'altogether', 'combined', 'left', 'remaining', 'more than', 'per', 'each', 'average'];

function extractTargetEntity(sentenceText: string, sentenceSpan: [number, number]): { entity?: AskSpan; unitHintFromEntity?: string; reason?: string } {
  const m = ENTITY_AFTER_TRIGGER_RE.exec(sentenceText);
  if (!m || !m[1]) return {};
  let raw = m[1].trim();
  let rawStartInSentence = sentenceText.indexOf(raw, m.index);
  if (rawStartInSentence < 0) return {};

  // Strip a leading comparative modifier ("more money", "fewer apples", "less time") -- the
  // comparison itself is already carried by askType ('what-difference'); the entity should stay
  // the bare noun, matching how the how-many/how-much cases report a bare noun with no modifier.
  const comparativeMatch = /^(more|fewer|less)\s+(.+)$/i.exec(raw);
  if (comparativeMatch && comparativeMatch[2].trim().length > 0) {
    const stripped = comparativeMatch[1].length + 1; // the word plus one space
    rawStartInSentence += stripped;
    raw = comparativeMatch[2].trim();
  }

  // Split off a trailing unit-hint phrase ("hours IN TOTAL", "cost LEFT") so the entity itself
  // stays the bare noun and the hint is reported separately, matching the Ask contract's split
  // between `targetEntity` and `unitHint`.
  let unitHintFromEntity: string | undefined;
  const lowerRaw = raw.toLowerCase();
  for (const phrase of UNIT_HINT_PHRASES) {
    if (lowerRaw === phrase) continue; // the whole capture IS the hint phrase, not a noun -- skip
    if (lowerRaw.endsWith(' ' + phrase)) {
      const core = raw.slice(0, raw.length - phrase.length - 1).trim();
      if (core.length > 0) {
        unitHintFromEntity = phrase;
        raw = core;
      }
      break;
    }
  }

  const absoluteStart = sentenceSpan[0] + rawStartInSentence;
  return {
    entity: { text: raw, span: [absoluteStart, absoluteStart + raw.length] },
    unitHintFromEntity,
    reason: `targetEntity '${raw}' captured between the interrogative trigger and the next auxiliary verb`,
  };
}

// ---------------------------------------------------------------------------------------------
// targetActor: the subject named right after an auxiliary/modal verb -- "does SHE earn", "does
// MARK have", "will MIKE have". A bare pronoun (he/she/it/they/we/you/I) or a capitalized proper
// noun both count as positive evidence; any other word (e.g. "does THE total cost") does not.
// ---------------------------------------------------------------------------------------------

const ACTOR_AFTER_AUX_RE = new RegExp(`\\b(?:${AUX_WORDS})\\s+(?:not\\s+)?([A-Za-z]+)\\b`, 'i');
const PRONOUN_RE = /^(he|she|it|they|we|you|i)$/i;
const PROPER_NOUN_RE = /^[A-Z][a-z]+$/;

function extractTargetActor(sentenceText: string, sentenceSpan: [number, number]): { actor?: AskSpan; reason?: string } {
  const m = ACTOR_AFTER_AUX_RE.exec(sentenceText);
  if (!m || !m[1]) return {};
  const word = m[1];
  const isPronoun = PRONOUN_RE.test(word);
  const isProperNoun = !isPronoun && PROPER_NOUN_RE.test(word);
  if (!isPronoun && !isProperNoun) return {};
  const wordStartInSentence = m.index + m[0].length - word.length;
  const absoluteStart = sentenceSpan[0] + wordStartInSentence;
  const kind = isPronoun ? 'pronoun' : 'proper noun';
  return {
    actor: { text: word, span: [absoluteStart, absoluteStart + word.length] },
    reason: `targetActor '${word}' captured as a ${kind} immediately after an auxiliary verb`,
  };
}

// ---------------------------------------------------------------------------------------------
// unitHint (full-sentence scan, used when the entity capture did not already split one off) and
// timeframeHint. Both are pure cue-word scans over the ask sentence's own text.
// ---------------------------------------------------------------------------------------------

function scanUnitHint(sentenceText: string): string | undefined {
  const lower = sentenceText.toLowerCase();
  for (const phrase of UNIT_HINT_PHRASES) {
    const re = new RegExp(`\\b${phrase.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (re.test(lower)) return phrase;
  }
  return undefined;
}

const TIMEFRAME_RE = /\b(?:in\s+\d+\s+(?:years?|weeks?|days?|months?|hours?|minutes?)|(?:a|an|each|per|this|that|next|last)\s+(?:year|week|day|month|hour|minute)s?)\b/i;

function scanTimeframeHint(sentenceText: string): string | undefined {
  const m = TIMEFRAME_RE.exec(sentenceText);
  return m ? m[0] : undefined;
}

// ---------------------------------------------------------------------------------------------
// extractAsk / explainAbstain
// ---------------------------------------------------------------------------------------------

interface Resolved {
  ask: Ask | null;
  reason: string | null;
}

function resolve(text: string): Resolved {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return { ask: null, reason: 'abstain: input is not a non-empty string' };
  }

  const sentences = splitSentences(text);
  const candidates = sentences.filter(isAskCandidate);

  if (candidates.length === 0) {
    return {
      ask: null,
      reason: 'abstain: no interrogative sentence (ending in "?" or opening with an unambiguous wh-interrogative phrase) and no imperative computation cue (Find/Calculate/Determine/...) found in the text',
    };
  }

  const last = candidates[candidates.length - 1];
  const earlier = candidates.slice(0, -1);

  const evidence: string[] = [];
  evidence.push(
    candidates.length > 1
      ? `selected the LAST of ${candidates.length} ask candidates as the ask; ${earlier.length} earlier candidate(s) recorded in otherAsks`
      : 'selected the only ask candidate found in the text',
  );
  let qualifyReason: string;
  if (isQuestionSentence(last.text)) {
    qualifyReason = 'candidate qualifies as an ask: sentence ends with "?"';
  } else if (IMPERATIVE_RE.test(last.text)) {
    qualifyReason = 'candidate qualifies as an ask: sentence opens with (or has a comma-introduced) imperative computation verb (Find/Calculate/Determine/...)';
  } else {
    qualifyReason = 'candidate qualifies as an ask: sentence opens with an unambiguous wh-interrogative phrase (how many/how much/how long/how old/what/which) despite lacking a terminal "?"';
  }
  evidence.push(qualifyReason);

  const { askType, reason: typeReason } = classifyAskType(last.text);
  evidence.push(typeReason);

  const entityResult = extractTargetEntity(last.text, last.span);
  if (entityResult.reason) evidence.push(entityResult.reason);

  const actorResult = extractTargetActor(last.text, last.span);
  if (actorResult.reason) evidence.push(actorResult.reason);

  const unitHint = entityResult.unitHintFromEntity ?? scanUnitHint(last.text);
  if (unitHint) {
    evidence.push(
      entityResult.unitHintFromEntity
        ? `unitHint '${unitHint}' split off the trailing end of the captured targetEntity`
        : `unitHint '${unitHint}' matched a cue word/phrase scanned over the full ask sentence`,
    );
  }

  const timeframeHint = scanTimeframeHint(last.text);
  if (timeframeHint) evidence.push(`timeframeHint '${timeframeHint}' matched a timeframe cue in the ask sentence`);

  if (!entityResult.entity) evidence.push('targetEntity left unset: no noun-then-auxiliary-verb shape found in the ask clause');
  if (!actorResult.actor) evidence.push('targetActor left unset: no pronoun or capitalized proper noun found immediately after an auxiliary verb');

  const ask: Ask = {
    sentence: last.text,
    span: last.span,
    askType,
    evidence,
  };
  if (entityResult.entity) ask.targetEntity = entityResult.entity;
  if (actorResult.actor) ask.targetActor = actorResult.actor;
  if (unitHint) ask.unitHint = unitHint;
  if (timeframeHint) ask.timeframeHint = timeframeHint;
  if (earlier.length > 0) {
    ask.otherAsks = earlier.map((s) => ({
      sentence: s.text,
      span: s.span,
      askType: classifyAskType(s.text).askType,
    }));
  }

  return { ask, reason: null };
}

/** Isolates the ask in `text`: the LAST interrogative sentence (ends in "?") or imperative
 *  computation cue ("Find...", "Calculate...", "Determine..."), positive-evidence only. Returns
 *  `null` when no interrogative or imperative ask exists anywhere in the text -- call
 *  `explainAbstain` on the same input to get the reason, since this signature (matching the
 *  dispatch's own contract) has no room for one. Deterministic, no model call, exact spans into
 *  the original `text`. */
export function extractAsk(text: string): Ask | null {
  return resolve(text).ask;
}

/** Returns a human-readable reason `extractAsk(text)` returned `null`, or `null` when
 *  `extractAsk(text)` would return a real `Ask` (i.e. this and `extractAsk` never both return a
 *  non-null-ish "found something" pair, and never both abstain). */
export function explainAbstain(text: string): string | null {
  return resolve(text).reason;
}
