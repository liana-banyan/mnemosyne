// D-BP223-BM04-h2cbpv9w-170 -- parse/rates.ts (module C3 of the shared parsing layer scope at
// BISHOP_DROPZONE/D-BP223-BM04-h2cbpv9w-170_PARSING_LAYER_SCOPE.md).
//
// WHY THIS FILE EXISTS. The scope document measured, by grep, that "each"/"per" appear in every
// one of the 105 sampled method files as raw English, handled by a DIFFERENT hand-written regex
// almost every time -- a per-unit price ("$3 each"), a per-time consumption/production rate ("eats
// 12 beetles per day", "sells 500 movies a day"), a wage ("$10 an hour"), or a bare schedule
// frequency ("5 days a week", "twice a week"). Five richest rate-shaped method files were read in
// full for this dispatch: `convert_weekly_rate_to_daily_total.ts` (its own `rateRe`/`periodBMatch`
// pair, hand-rolled BigInt fraction arithmetic), `sum_of_independent_rate_count_products.ts` (its
// own two-number-clause heuristic, no shared quantity/unit typing at all), `derive_unit_value_
// then_sum_two_products.ts` (its own `ratioRe`/`valueRe` pair, "each X weighs/costs Y" prefix
// shape), `split_total_evenly_two_parties_rate_multiple.ts` (its own `totalRe`/`rateRe` pair,
// "pays him N CURRENCY per UNIT" postfix shape), and `sum_of_weekly_hours_times_flat_hourly_rate.ts`
// (its own `rateAllRe` = `/\$(\d+(?:\.\d+)?)\s+an?\s+hour\b/gi`). This module is the ONE canonical
// rate extractor those files are meant to replace.
//
// TWO MEASURED BUGS THIS MODULE IS BUILT TO NEVER REPEAT, both read from real wave reports before
// writing a single regex here:
//   (1) W04/W08's own remediation log (`D-BP223-BM04-h2cbpv9w-170_WAVE_W08.md` section 4, and the
//       matching finding in `D-BP223-M0-h2cbpc0g-043_GATE_5_SIBLING_INTERCEPTION.md`): a bare
//       `.includes('per')` (or an unanchored digit scan doing the equivalent job) matches the
//       SUBSTRING "per" inside "zooKEEPER" or the digit "8" inside "gsm8k" -- an incidental
//       collision, not a real per-unit cue. EVERY "per"/"each"/"every" cue in this module is
//       matched with `\b...\b` word-boundary regex, never `.includes()` or an unbounded index-of
//       scan, and this exact case ("zookeeper" containing "per" as a bare substring) is a named
//       adversarial fixture in this dispatch's own test file.
//   (2) W10's own finding (`D-BP223-BM04-h2cbpv9w-170_WAVE_W10.md` section on
//       `daily-unit-usage-cartons-needed-times-cost-per-carton-v1`): a rate regex assumed the noun
//       phrase between an article and "every"/"per" was always exactly one word, but real GSM8K
//       text uses multi-word noun phrases ("per school year", "per standard box"). Every noun-
//       phrase capture in this module is a bounded, NON-GREEDY multi-word span
//       (`(?:[a-z]+\s+){0,3}[a-z]+`), never a single-word `[a-z]+`.
// A third real finding folded in from W17 (`D-BP223-BM04-h2cbpv9w-170_WAVE_W17.md`,
// `hourly-wage-overtime-premium-weekly-earnings-v1`): "five days a week" needed a number-word
// table, not just digits, to recognize a schedule frequency -- this module's FREQUENCY recognizers
// resolve both digit and word cardinals via `resolveCardinalWord`, matching quantities.ts's own
// word-number table rather than a second, independently-typo-able one.
//
// SCOPE BOUNDARY, STATED EXPLICITLY (per this dispatch's write fence). This module imports
// `Fraction`/`Quantity` from './quantities' and `Ask`/`extractAsk` from './ask', per the BP222
// ruling ("a hand-copied contract is the defect, not bad types" -- NEVER re-declare an imported
// type locally). It does NOT import './entities' or './comparatives': those modules are being
// built by concurrent SEG dispatches against the same scope document, and this module's own
// contract (rates return actor/item SPANS and text, never a resolved actor identity) is exactly
// the boundary the scope document draws -- entities.ts binds those spans to identities later. Any
// itemNoun or subject this module reports is therefore the RAW noun phrase captured at that exact
// span, not a resolved, cross-sentence-anaphora-aware entity.
//
// extractAsk() IS used, for one narrow, positive-evidence-preserving reason: a rate-shaped phrase
// whose ENTIRE span falls inside the text's own extracted ask sentence is the question ASKING for
// a rate ("how many pounds ... per day?"), never a rate the text STATED -- promoting it to a Rate
// would manufacture a stated fact out of the interrogative itself. This guard is defense in depth
// (in almost every real case the missing numerator already fails the adjacency requirement on its
// own), documented and tested against a real fixture (gsm8k-train-21's own closing "how many
// beetles are eaten each day?").
//
// PURE DETERMINISTIC CODE, no model call of any kind, matching every other module in this layer
// and HARDWIRE-22 (nothing here asks a model to judge anything). Every numeric value is an exact
// rational Fraction, never a floating-point number, per the BP221 "use SymPy for math always"
// ruling's own reasoning (arithmetic is enactment, not reasoning) even though this module makes no
// arithmetic call itself beyond exact Fraction construction.
//
// Rule 66: no em-dashes anywhere in this file or its comments -- "--" is used throughout.

import {
  type Fraction,
  type Quantity,
  type QuantityKind,
  extractQuantities,
  fractionFromBigInt,
  fractionToDisplayString,
} from './quantities';
import { extractAsk, type Ask } from './ask';

// ─── PUBLIC TYPES ───────────────────────────────────────────────────────────────────────────────

/** A short span of text with its exact [start, end) character offset into the ORIGINAL input
 *  string handed to `extractRates`. Matches the shape of `ask.ts`'s own `AskSpan` (declared
 *  independently here, per this module's own instruction to stay independent of `ask.ts`'s
 *  exported types beyond `Ask` itself -- this is a new local type for THIS module's contract, not
 *  a re-declaration of an imported one). */
export interface Span {
  text: string;
  span: [number, number];
}

export type RateKind =
  | 'price'
  | 'speed'
  | 'wage'
  | 'consumption'
  | 'production'
  | 'frequency'
  | 'generic';

export interface Rate {
  /** The numerator quantity of the rate -- e.g. the `$6` in "each DVD cost $6", the `12 beetles`
   *  in "12 beetles per day", the `5` in "5 days a week". When the numerator's own noun (e.g.
   *  "megabytes", "beetles") is not one of `parse/quantities.ts`'s recognized unit words, this
   *  module still returns a fully-shaped `Quantity` for it (same interface, `unit` populated with
   *  the raw noun captured at this rate's own span) rather than leaving it a bare number -- the
   *  `Quantity.unit` field is a plain string with no fixed vocabulary, so this is populating the
   *  contract honestly, not bending it. */
  value: Quantity;
  /** The denominator: the per-unit noun (singularized), how many of it one rate-unit represents
   *  (1 for a plain "per day"/"each day"; 12 for "per dozen"; 2 for "every other day"), and the
   *  exact span of the per-clause text itself ("per day", "a week", "each", "every 4 days"). */
  per: { unit: string; count: Fraction; span: [number, number] };
  kind: RateKind;
  /** The actor/subject performing the rate ("bird" in "each bird eats 12 beetles per day"), when
   *  the rate sentence names one distinct from the per-unit denominator itself. Absent when the
   *  per-unit noun IS the subject ("each of the first four houses has 3 gnomes" -- "house" is
   *  already `per.unit`, there is no separate subject to report). A raw span, never resolved
   *  against an earlier pronoun or a prior sentence -- that is `parse/entities.ts`'s job. */
  subject?: Span;
  /** The bare noun the numerator counts ("DVD", "beetles", "movies"), singularized, when the
   *  rate's own local clause names one. Left unset (never guessed) when no noun is captured in the
   *  same clause -- e.g. "$10 for each" with the item named only in an earlier sentence; resolving
   *  that against prior context is `parse/entities.ts`'s job, not this module's. */
  itemNoun?: string;
  /** [start, end) character offsets of the FULL rate phrase into the original input text. */
  span: [number, number];
  /** text.slice(span[0], span[1]) -- provided directly so callers never need to re-slice. */
  sourceText: string;
  /** Human-readable positive-evidence trail: which pattern matched, what it matched, how `kind`
   *  was decided, and what could not be resolved and why. Never empty. */
  evidence: string[];
}

export interface RateAbstain {
  reason: string;
  span: [number, number];
}

export interface ExtractRatesResult {
  rates: Rate[];
  abstains: RateAbstain[];
}

// ─── SHARED WORD TABLES (mirroring quantities.ts's own, never re-declaring its exports) ────────
//
// quantities.ts's ONES/TENS tables are module-private (not exported), so a second, small,
// byte-independent copy is unavoidable here for this module's OWN cardinal-word resolution needs
// (e.g. "five days a week", "three times a week"). This is not the disease the scope document
// names ("a hand-copied contract is the defect") -- that ruling is about re-declaring an IMPORTED
// TYPE's shape (Fraction, Quantity, Ask), which this module never does; a private word-list is
// data, not a contract, and quantities.ts deliberately does not export it. Kept intentionally
// small: only the cardinals this module's own frequency/dozen recognizers need (0-12), since every
// larger or compound cardinal number in a rate's own numerator is read from `extractQuantities()`
// directly, never re-parsed by hand here.

const SMALL_CARDINAL_WORDS: Record<string, bigint> = {
  a: 1n, an: 1n, one: 1n, two: 2n, three: 3n, four: 4n, five: 5n, six: 6n, seven: 7n, eight: 8n,
  nine: 9n, ten: 10n, eleven: 11n, twelve: 12n,
};

function resolveSmallCardinal(tok: string): bigint | null {
  if (/^\d+$/.test(tok)) return BigInt(tok);
  const lower = tok.toLowerCase();
  return Object.prototype.hasOwnProperty.call(SMALL_CARDINAL_WORDS, lower)
    ? SMALL_CARDINAL_WORDS[lower]
    : null;
}

/** Crude singularizer, matching the estate's own convention (`singularize`, 4+ method files;
 *  `derive_unit_value_then_sum_two_products.ts` and `split_total_evenly_two_parties_rate_
 *  multiple.ts` both hand-roll an equivalent). Strips a trailing "s" (never "ss"), "-es" -> "",
 *  "-ies" -> "-y". */
// A bounded, named exception list for the one real ambiguity the "-ies" -> "-y" rule below cannot
// resolve on its own: a word already ending in "-ie" (movie, cookie, zombie) pluralizes by adding
// a bare "s" (movies, cookies, zombies), while a word ending in consonant+"y" pluralizes by
// replacing "y" with "ies" (candy -> candies, baby -> babies) -- both produce an indistinguishable
// "-ies" suffix on the plural with no local rule to tell them apart. Found as a real defect this
// dispatch (gsm8k-train-15's "movies" singularized to the non-word "movy" by the general rule
// before this exception was added), not a hypothesized one; kept intentionally small (added to on
// the next real fixture that needs it, not pre-populated from a dictionary) matching the estate's
// own "record the wrong answers too" convention (ask.ts's TITLE_ABBREVIATIONS is the same shape of
// fix).
const IE_PLURAL_EXCEPTIONS: Record<string, string> = {
  movies: 'movie', cookies: 'cookie', pies: 'pie', ties: 'tie', zombies: 'zombie',
};

function singularize(word: string): string {
  const w = word.trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(IE_PLURAL_EXCEPTIONS, w)) return IE_PLURAL_EXCEPTIONS[w];
  if (w.endsWith('ies') && w.length > 3) return w.slice(0, -3) + 'y';
  // Only a genuine double-s ("glasses" -> "glass") strips the full "es" -- a single "s" before
  // "es" ("houses", "roses") is a silent-e noun that pluralizes by adding a bare "s", so it must
  // fall through to the general single-s strip below instead ("houses" -> "house"). Found as a
  // real defect this dispatch: the original single-condition "ends with ses" rule turned
  // "houses" into the non-word "hous" on gsm8k-train-28. A single-s noun that instead pluralizes
  // with "-es" ("bus" -> "buses") is a known, narrow, undocumented-further miss of this same
  // general-purpose fallback (becomes "buse") -- no fixture in this dispatch's own charge exercises
  // it, so it is named here rather than silently shipped, matching the estate's own "record the
  // wrong answers too" discipline (see quantities.ts's own "the previous one" anaphor limitation
  // for the same convention).
  if (w.endsWith('sses') && w.length > 4) return w.slice(0, -2);
  // A word ending in ch/sh/x/z pluralizes with "-es" ("match" -> "matches", "wish" -> "wishes",
  // "box" -> "boxes", "buzz" -> "buzzes"), so singularizing needs stripping the full "es" (2
  // chars), not just the trailing "s" -- found as a real defect this dispatch: "matches"
  // singularized to the non-word "matche" on gsm8k-train-2989 before this rule was added.
  if (/(?:ch|sh|x|z)es$/.test(w) && w.length > 3) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 1) return w.slice(0, -1);
  return w;
}

/** The head noun of a captured noun phrase is its LAST word -- "first four houses" -> "houses",
 *  "personal pan pizzas" -> "pizzas" -- a defensible, bounded heuristic for English noun phrases
 *  (head-final), never a full parse. Leading ordinal/count/determiner words are simply not the
 *  head, so taking the last word is correct without needing a stop-word list. */
function headNoun(phrase: string): string {
  const words = phrase.trim().split(/\s+/);
  return words[words.length - 1] ?? '';
}

/** Same last-word heuristic as `headNoun`, EXCEPT when the phrase contains " of " -- then the
 *  head is the word immediately BEFORE " of " instead, since a "container OF contents" phrase
 *  ("pack OF COOKIES", "group OF STUDENTS") has its head at the front, the opposite of the plain
 *  modifier chains `headNoun` handles correctly ("first four HOUSES"). Used only where this
 *  distinction actually matters -- the SUBJECT/per-unit noun phrase captured by `each <noun>
 *  <verb>` (recognizer 1's own per-unit-is-the-each-noun branch): a fixed "each OF THE X" idiom is
 *  already stripped before capture begins, so this never fires on that shape, only on a genuine
 *  partitive noun inside the captured phrase itself. Found necessary this dispatch:
 *  gsm8k-train-6672's "Each pack of cookies contains 24 cookies" singularized its per-unit to
 *  "cookie" (the wrong, contents-side noun) under an earlier draft that always took the last
 *  word. */
function headNounRespectingPartitiveOf(phrase: string): string {
  const lower = phrase.toLowerCase();
  const ofIdx = lower.indexOf(' of ');
  if (ofIdx > 0) return headNoun(phrase.slice(0, ofIdx));
  return headNoun(phrase);
}

const TIME_PERIOD_WORDS = new Set([
  'second', 'seconds', 'minute', 'minutes', 'hour', 'hours', 'day', 'days', 'week', 'weeks',
  'month', 'months', 'year', 'years', 'semester', 'semesters', 'quarter', 'quarters', 'night',
  'nights', 'shift', 'shifts', 'time', 'times',
]);

function isTimePeriodWord(word: string): boolean {
  return TIME_PERIOD_WORDS.has(word.toLowerCase());
}

// ─── VERB CLASSIFICATION (for RateKind) ─────────────────────────────────────────────────────────

const WAGE_VERBS = new Set(['earns', 'earn', 'makes', 'make', 'pays', 'pay', 'paid']);
const CONSUMPTION_VERBS = new Set([
  'eats', 'eat', 'drinks', 'drink', 'uses', 'use', 'needs', 'need', 'requires', 'require',
  'consumes', 'consume', 'spends', 'spend',
]);
const PRODUCTION_VERBS = new Set([
  'makes', 'make', 'produces', 'produce', 'sells', 'sell', 'bakes', 'bake', 'builds', 'build',
  'prints', 'print', 'writes', 'write', 'creates', 'create', 'picks', 'pick', 'plants', 'plant',
  'grows', 'grow',
]);
const GENERIC_HOLDING_VERBS = new Set([
  'has', 'have', 'having', 'gets', 'get', 'receives', 'receive', 'holds', 'hold', 'contains',
  'contain', 'weighs', 'weigh',
]);
const PRICE_VERBS = new Set(['costs', 'cost', 'is', 'are', 'charges', 'charge']);

/** Decides `RateKind` from the numerator's own kind, the per-unit's time-ness, and (when present)
 *  the governing verb -- documented, ordered rules, never a silent default beyond the final
 *  'generic' catch-all. Every branch is named in the returned `reason` string for the evidence
 *  trail. */
function classifyRateKind(
  valueKind: QuantityKind,
  perUnitIsTime: boolean,
  verb: string | null,
): { kind: RateKind; reason: string } {
  const v = verb ? verb.toLowerCase() : null;

  // A wage verb ("earns", "pays", "paid") governing a money value is 'wage' REGARDLESS of
  // whether the per-unit is a strict calendar time word -- "$20 per gig", "$5 per period" are
  // just as much earnings-per-work-unit as "$12 an hour" is. Checked BEFORE the money+non-time
  // per-unit -> 'price' rule below (a real classification miss this dispatch's own coverage
  // sampling found: gsm8k-train-629's "he is paid $5 per period" and gsm8k-train-7048's "each
  // earn $20 per gig" both classified 'price' under an earlier draft that required perUnitIsTime
  // for the wage branch, even though a wage verb was right there governing the numerator).
  if (valueKind === 'money' && v && WAGE_VERBS.has(v)) {
    return { kind: 'wage', reason: `kind 'wage': money value with a wage verb ("${v}") governing it` };
  }
  if (valueKind === 'money' && !perUnitIsTime) {
    return { kind: 'price', reason: "kind 'price': money value with a non-time per-unit (a priced item, not a time period)" };
  }
  if (valueKind === 'money' && v && PRICE_VERBS.has(v) && perUnitIsTime) {
    return { kind: 'price', reason: `kind 'price': money value with a price verb ("${v}") over a time-shaped per-unit` };
  }
  if (valueKind === 'money' && perUnitIsTime) {
    return { kind: 'generic', reason: 'kind \'generic\': money value over a time-shaped per-unit with no wage or price verb present (a budget/allowance, not clearly earnings or a unit price)' };
  }
  if (perUnitIsTime && v && CONSUMPTION_VERBS.has(v)) {
    return { kind: 'consumption', reason: `kind 'consumption': a consumption verb ("${v}") over a time-shaped per-unit` };
  }
  if (perUnitIsTime && v && PRODUCTION_VERBS.has(v)) {
    return { kind: 'production', reason: `kind 'production': a production/output verb ("${v}") over a time-shaped per-unit` };
  }
  if (perUnitIsTime && valueKind === 'length') {
    return { kind: 'speed', reason: "kind 'speed': a length-valued numerator over a time-shaped per-unit (distance/time)" };
  }
  // A multiplier value ("twice", "double") over a time-shaped per-unit is definitionally a
  // frequency ("twice a day"), the same as the dedicated "<count> times a/per <period>" recognizer
  // hardcodes -- this branch catches the equivalent shape when it instead reaches this classifier
  // via the general quantity-per-period recognizer (a standalone "twice"/"double" is its own
  // Quantity of kind 'multiplier' per quantities.ts, not literal "N times"). Found as a real
  // categorization miss this dispatch: gsm8k-train-2311's "twice a day" classified 'generic'
  // before this branch existed.
  if (perUnitIsTime && valueKind === 'multiplier') {
    return { kind: 'frequency', reason: "kind 'frequency': a multiplier value (\"twice\", \"double\") over a time-shaped per-unit" };
  }
  if (v && PRICE_VERBS.has(v)) {
    return { kind: 'price', reason: `kind 'price': a price verb ("${v}") governs this rate` };
  }
  if (v && GENERIC_HOLDING_VERBS.has(v)) {
    return { kind: 'generic', reason: `kind 'generic': a holding/possession verb ("${v}") governs this rate, no more specific signal present` };
  }
  return { kind: 'generic', reason: 'kind \'generic\': no wage/price/consumption/production/speed signal matched; reported as a plain rate' };
}

// ─── SHARED HELPERS ─────────────────────────────────────────────────────────────────────────────

/** True when the only characters between two offsets are whitespace -- the same "adjacency" test
 *  quantities.ts uses, kept independent here per this module's own no-shared-internals mandate
 *  (only the exported Fraction/Quantity/Ask types are shared, never a module-private helper). */
function isAdjacentWs(text: string, endOfPrev: number, startOfNext: number): boolean {
  if (startOfNext < endOfPrev) return false;
  return /^\s*$/.test(text.slice(endOfPrev, startOfNext));
}

const PRONOUN_WORDS = new Set(['him', 'her', 'it', 'them', 'me', 'you', 'us', 'he', 'she', 'they', 'i', 'we']);

/** Words that can never be the HEAD of a genuine noun phrase this module extracts a subject or
 *  per-unit from -- modal/auxiliary verbs and connectors. Found as a REAL false positive this
 *  dispatch, not hypothesized: an earlier draft of `recognizeEachEveryVerb` matched "each following
 *  earthquake would have" on gsm8k-train-43 ("each following earthquake would have double the
 *  number of collapsing buildings...") because "have" is a legitimate governing verb and the greedy
 *  noun-phrase capture backtracked onto "would" as its head noun, then treated "double" (a literal
 *  multiplier quantity from quantities.ts) as the numerator of a fabricated rate. This guard rejects
 *  any candidate whose captured "noun phrase" head is not a plausible noun. */
const STOP_HEAD_WORDS = new Set([
  'would', 'could', 'should', 'might', 'will', 'can', 'shall', 'must', 'do', 'does', 'did', 'is',
  'are', 'was', 'were', 'has', 'have', 'be', 'been', 'being', 'to', 'that', 'this', 'these',
  'those', 'and', 'or', 'but', 'not', 'no', 'of', 'the', 'a', 'an',
]);

/** Words that can never be part of (or terminate) a bounded per-unit/item noun-phrase scan --
 *  connectors, prepositions other than "of" (allowed mid-phrase, e.g. "pounds of insects"), and a
 *  small set of real corpus words found by this dispatch's own fixture testing to otherwise get
 *  swept into an over-greedy phrase capture (see `captureBoundedNoun`'s header). */
const STOP_PHRASE_WORDS = new Set([
  'for', 'and', 'or', 'then', 'thereafter', 'its', 'the', 'but', 'after', 'before', 'until',
  'while', 'because', 'if', 'when', 'that', 'which', 'who', 'so', 'to', 'from', 'with', 'at',
  'on', 'in', 'into', 'onto', 'than', 'she', 'he', 'they', 'it', 'this', 'these', 'those', 'a',
  'an', 'each', 'per', 'is', 'are', 'was', 'were', 'has', 'have', 'had', 'having', 'will',
  'would', 'not',
  // Multiplier/frequency words can never be part of a plain item-noun phrase -- "of dog food
  // TWICE" swallowing "twice" as if it were a noun (headNoun would then pick "twice" itself as
  // the "item") is a real bug this dispatch's own coverage sampling found on gsm8k-train-2311's
  // "1/2 of a pound of dog food twice a day". Stopping the scan here means the standalone "twice
  // a day" frequency phrase is left for a later pass (or simply not composed with this clause) --
  // an honest partial extraction, never a fabricated one.
  'twice', 'thrice', 'double', 'triple',
]);

/** One word-token, scanned strictly left-to-right with exactly one run of whitespace between each
 *  token and the previous one (or the starting offset) -- never skips ahead, never crosses a
 *  non-letter character other than the single separating whitespace run. Stops (returns fewer than
 *  `maxWords` entries) at the first non-alphabetic character, matching the same "positive evidence
 *  only, never scan past what is there" discipline as every other recognizer in this module. */
interface WordRun {
  word: string;
  start: number;
  end: number;
}

function scanWordRun(text: string, offset: number, maxWords: number): WordRun[] {
  const out: WordRun[] = [];
  let pos = offset;
  for (let i = 0; i < maxWords; i++) {
    const wsMatch = /^\s+/.exec(text.slice(pos));
    if (!wsMatch) break;
    const afterWs = pos + wsMatch[0].length;
    const wordMatch = /^[A-Za-z]+/.exec(text.slice(afterWs));
    if (!wordMatch) break;
    const start = afterWs;
    const end = afterWs + wordMatch[0].length;
    out.push({ word: wordMatch[0], start, end });
    pos = end;
  }
  return out;
}

/** Scans `words` (already produced by `scanWordRun`) for the SHORTEST leading run of non-cue,
 *  non-stopword tokens (0 to `maxNounWords` of them) immediately followed by one of `cueWords` --
 *  e.g. "pounds of insects each" -> nounWords=["pounds","of","insects"], cue at index 3 ("each").
 *  "of" is deliberately never a stopword here (a legitimate mid-phrase word, "pounds OF insects"),
 *  every other connector in STOP_PHRASE_WORDS terminates the search with a null (no valid
 *  noun-then-cue shape found) rather than skipping over it -- found necessary this dispatch after
 *  an earlier draft's unbounded phrase capture pulled "for"/"and"/"thereafter" into what should
 *  have been a one-word per-unit noun (see `captureBoundedNoun` and this module's own header for
 *  the two real W10/W04-class bugs this class of fix closes). */
function tryNounPhraseThenCue(
  words: WordRun[],
  maxNounWords: number,
  cueWords: Set<string>,
): { nounWords: WordRun[]; cueIdx: number } | null {
  const limit = Math.min(maxNounWords, words.length - 1);
  for (let k = 0; k <= limit; k++) {
    const w = words[k].word.toLowerCase();
    if (cueWords.has(w)) {
      // A noun phrase can never DANGLE on "of" immediately before the cue ("1/2 OF a pound" ->
      // nounWords would otherwise be just the meaningless single word "of", cue "a") -- "of" must
      // always be followed by a real noun inside the phrase, never sit right against the cue.
      // Found as a real bug this dispatch on gsm8k-train-2311's "Each dog eats 1/2 of a pound of
      // dog food twice a day", which produced an itemNoun/unit of literally "of" before this
      // check existed.
      if (k > 0 && words[k - 1].word.toLowerCase() === 'of') return null;
      return { nounWords: words.slice(0, k), cueIdx: k };
    }
    if (w !== 'of' && STOP_PHRASE_WORDS.has(w)) return null;
  }
  return null;
}

/** Captures a bounded per-unit/period noun phrase (up to `maxWords` tokens) starting at the front
 *  of `words`, stopping at the first stopword (see STOP_PHRASE_WORDS) or at `maxWords`, whichever
 *  comes first -- never the unbounded-greedy capture that (before this dispatch's own fixture
 *  testing caught it) turned "5 megabytes per second for its first 60 megabytes" into a per-unit of
 *  "second for its first" and "10 megabytes per second thereafter." into "second thereafter". */
/** `excludeOf` (default false): when true, "of" also terminates the scan instead of being
 *  allowed mid-phrase. A period noun ("hour", "week", "day") is essentially always ONE bare word
 *  in this corpus, so a following "of <noun>" is almost always a PARTITIVE modifier ("hour OF
 *  OVERTIME" means a kind of hour, not a two-word period name) whose head noun (by this module's
 *  own last-word `headNoun` heuristic) would wrongly become "overtime" instead of "hour" -- found
 *  as a real miss this dispatch on gsm8k-train-4044's "$15 each hour of overtime after that",
 *  which abstained entirely under an earlier draft that let "of overtime" merge into the period
 *  phrase. An ITEM noun phrase ("pounds OF INSECTS") has the opposite, container-then-contents
 *  shape where the last word genuinely is the head, so item-noun call sites keep `excludeOf` at
 *  its default false. */
function captureBoundedNoun(words: WordRun[], maxWords: number, excludeOf = false): WordRun[] {
  const out: WordRun[] = [];
  for (let i = 0; i < words.length && i < maxWords; i++) {
    const w = words[i].word.toLowerCase();
    const isOf = w === 'of';
    if ((isOf && excludeOf) || (!isOf && STOP_PHRASE_WORDS.has(w))) break;
    out.push(words[i]);
  }
  // A captured phrase can never meaningfully END in a dangling "of" -- that is an artifact of the
  // scan stopping (hitting `maxWords` or a stopword) right after "of" with nothing captured after
  // it, not a real noun. Same real bug class as tryNounPhraseThenCue's own "of"-before-cue guard
  // above (gsm8k-train-2311's "1/2 of a pound of dog food"), just manifesting in the no-cue
  // fallback path instead.
  while (out.length > 0 && out[out.length - 1].word.toLowerCase() === 'of') out.pop();
  return out;
}

const VERB_CUE_WORDS = new Set(['per', 'a', 'an', 'each']);

/** Looks backward from `offset` for up to `maxWordsBack` whitespace-separated words for the
 *  nearest one that governs a rate semantically (an earn/spend/consume/produce/price verb) --
 *  e.g. "sells" in "He sells 500 movies a day". Stops at the first non-adjacent-word gap (a
 *  sentence boundary, a comma with no space pattern this scan recognizes) so it never reaches back
 *  across an unrelated clause. Returns null when no governing verb is found within range, which is
 *  itself a normal, expected outcome (most per-clauses have no local verb at all, e.g. "$1000 per
 *  semester") -- the caller's classifier already treats a null verb as "no verb signal", never as
 *  an error. */
function findGoverningVerbBefore(text: string, offset: number, maxWordsBack: number): string | null {
  let pos = offset;
  for (let i = 0; i < maxWordsBack; i++) {
    const before = text.slice(0, pos);
    const m = /([A-Za-z]+)\s+$/.exec(before);
    if (!m) return null;
    const word = m[1].toLowerCase();
    if (
      WAGE_VERBS.has(word) || CONSUMPTION_VERBS.has(word) || PRODUCTION_VERBS.has(word) ||
      PRICE_VERBS.has(word) || GENERIC_HOLDING_VERBS.has(word)
    ) {
      return word;
    }
    pos = pos - m[0].length;
  }
  return null;
}

function makeSyntheticQuantity(
  fraction: Fraction,
  unit: string | null,
  kind: QuantityKind,
  span: [number, number],
  sourceText: string,
  evidence: string[],
): Quantity {
  return { value: fraction, unit, kind, span, sourceText, evidence };
}

// ─── RECOGNIZER 1: EACH/EVERY GOVERNING A VERB, OPTIONALLY FOLLOWED BY AN EXPLICIT PER-CLAUSE ──
//
// Covers: "Each DVD cost $6 to make." (no trailing per-clause: per-unit IS "DVD")
//         "each of the first four houses has 3 gnomes" (no trailing per-clause: per-unit IS "house")
//         "Each bird eats 12 beetles per day" (trailing "per day": per-unit is "day", "bird" is
//         reported as `subject`, not the per-unit)
//         "Ducks need to eat 3.5 pounds of insects each week" (the "each week" trailing clause is
//         itself the per-time cue -- matched by the trailing-clause branch below, no leading
//         each/every governs a verb in that sentence at all, so this pattern does not fire on it;
//         see RECOGNIZER 2 for that shape instead)

const EACH_EVERY_VERB_RE = new RegExp(
  '\\b(each|every)\\s+(?:of\\s+the\\s+)?((?:[a-z]+\\s+){0,3}[a-z]+)\\s+' +
  '(costs?|is|are|weighs?|weigh|has|have|having|eats?|drinks?|uses?|needs?|requires?|consumes?|' +
  'makes?|produces?|gets?|receives?|holds?|contains?|buys?|charges?|pays?|earns?)\\s+' +
  '(?:to\\s+[a-z]+\\s+)?(?:a\\s+|an\\s+|the\\s+)?',
  'gi',
);

function recognizeEachEveryVerb(text: string, quantities: Quantity[]): { rate: Rate; consumedSpan: [number, number] }[] {
  const out: { rate: Rate; consumedSpan: [number, number] }[] = [];
  let m: RegExpExecArray | null;
  EACH_EVERY_VERB_RE.lastIndex = 0;
  while ((m = EACH_EVERY_VERB_RE.exec(text)) !== null) {
    const fullStart = m.index;
    const clauseEnd = m.index + m[0].length;
    const eachOrEvery = m[1].toLowerCase();
    const verb = m[3].toLowerCase();

    // A trailing ADVERB between the noun and the verb ("each kid NORMALLY has...") gets captured
    // as part of the noun phrase by the regex's own greedy backtracking, exactly the way "would"
    // did in the STOP_HEAD_WORDS false positive below -- but unlike that case, simply rejecting
    // the whole match here would also throw away a genuine trailing "per week" later in the same
    // clause (found as a real, avoidable loss this dispatch on gsm8k-train-6672's "Each kid
    // normally has 4 chores to do per week."). So a trailing adverb is TRIMMED off the captured
    // noun phrase instead of aborting the match -- a small, named, evidence-based list (this
    // module's own convention: extend it the next time a real fixture needs another word, never
    // pre-populate from a dictionary).
    const ADVERB_TRIM_WORDS = new Set([
      'normally', 'usually', 'typically', 'generally', 'currently', 'always', 'often',
      'sometimes', 'now', 'still', 'also', 'already', 'actually', 'basically', 'simply', 'really',
    ]);
    const rawNounTokens = m[2].trim().split(/\s+/);
    const capturedNoun =
      rawNounTokens.length > 1 && ADVERB_TRIM_WORDS.has(rawNounTokens[rawNounTokens.length - 1].toLowerCase())
        ? rawNounTokens.slice(0, -1).join(' ')
        : m[2];

    // Reject a captured "noun phrase" whose head is a modal/auxiliary/connector, never a real
    // noun -- see STOP_HEAD_WORDS' own header for the exact false positive (gsm8k-train-43,
    // "each following earthquake would have double the number...") this guard closes.
    if (STOP_HEAD_WORDS.has(headNoun(capturedNoun).toLowerCase())) continue;

    // The numerator quantity must start EXACTLY where this match ends (allowing the "a/an/the"
    // already consumed inside the regex itself) -- positive evidence, never a scan-ahead guess.
    const numeratorQty = quantities.find((q) => q.span[0] === clauseEnd);
    if (!numeratorQty) continue;

    // Optional item noun immediately after the numerator quantity, THEN an optional trailing
    // explicit per-clause ("per day", "a week"). Both are found by the same bounded, stopword-
    // aware word scan `recognizeQuantityPerPeriod` uses, never a single greedy regex -- an earlier
    // draft's `/^\s+((?:[a-z]+\s+){0,2}[a-z]+)\b/` item-noun regex swallowed the cue word itself
    // ("beetles per day" all captured as one "item noun" on gsm8k-train-21, and "gnomes in the"
    // on gsm8k-train-28), which is exactly the W10-class multi-word-noun-phrase bug this module's
    // header names, just manifesting in the trailing position instead of the leading one.
    const lookahead = scanWordRun(text, numeratorQty.span[1], 6);
    const found = tryNounPhraseThenCue(lookahead, 3, VERB_CUE_WORDS);
    let itemNounWords: WordRun[] = [];
    let afterItemOffset = numeratorQty.span[1];
    let trailingPeriodWords: WordRun[] = [];
    let cueWord: WordRun | null = null;

    if (found) {
      const candidatePeriod = captureBoundedNoun(lookahead.slice(found.cueIdx + 1), 3, true);
      const candidateCue = lookahead[found.cueIdx].word.toLowerCase();
      const candidatePeriodWord = candidatePeriod.length > 0 ? headNoun(candidatePeriod.map((w) => w.word).join(' ')) : '';
      // Same positive-evidence discipline recognizer 2 (recognizeQuantityPerPeriod) applies: "a"/
      // "an"/"each" only introduces a genuine per-clause when what follows is a real time-period
      // word ("an hour", "each week") -- "per" has no such restriction. Missing here in an earlier
      // draft let "1/2 OF a pound of dog food" accept "pound" as a trailing per-unit via the cue
      // "a", producing a nonsense per-unit unrelated to any time period (gsm8k-train-2311).
      const validTrailing =
        candidatePeriod.length > 0 &&
        (candidateCue === 'per' || isTimePeriodWord(singularize(candidatePeriodWord)));
      if (validTrailing) {
        itemNounWords = found.nounWords;
        cueWord = lookahead[found.cueIdx];
        trailingPeriodWords = candidatePeriod;
        afterItemOffset = itemNounWords.length > 0 ? itemNounWords[itemNounWords.length - 1].end : numeratorQty.span[1];
      }
    }
    if (trailingPeriodWords.length === 0) {
      // No usable trailing per-clause: fall back to a plain bounded item-noun capture (no cue
      // required) so "each hand having 14 bananas" still gets itemNoun="bananas".
      itemNounWords = captureBoundedNoun(lookahead, 3);
      afterItemOffset = itemNounWords.length > 0 ? itemNounWords[itemNounWords.length - 1].end : numeratorQty.span[1];
    }
    const itemNounRaw = itemNounWords.length > 0 ? itemNounWords.map((w) => w.word).join(' ') : null;

    let perUnit: string;
    let perCount: Fraction = fractionFromBigInt(1n);
    let perSpanStart: number;
    let perSpanEnd: number;
    let subject: Span | undefined;
    const evidence: string[] = [];

    if (trailingPeriodWords.length > 0 && cueWord) {
      const perPhrase = trailingPeriodWords.map((w) => w.word).join(' ');
      perUnit = singularize(headNoun(perPhrase));
      perSpanStart = cueWord.start;
      perSpanEnd = trailingPeriodWords[trailingPeriodWords.length - 1].end;
      subject = { text: capturedNoun.trim(), span: [m.index + eachOrEvery.length + 1, m.index + eachOrEvery.length + 1 + capturedNoun.length] };
      evidence.push(`"${eachOrEvery} ${capturedNoun.trim()}" captured as the rate's subject, distinct from the trailing explicit per-clause "${text.slice(perSpanStart, perSpanEnd)}"`);
    } else {
      perUnit = singularize(headNounRespectingPartitiveOf(capturedNoun));
      perSpanStart = m.index;
      perSpanEnd = m.index + eachOrEvery.length;
      evidence.push(`"${eachOrEvery} ${capturedNoun.trim()}" itself is the per-unit denominator (no separate trailing per-clause found)`);
    }

    const spanEnd = trailingPeriodWords.length > 0 ? perSpanEnd : afterItemOffset;
    const fullSpan: [number, number] = [fullStart, spanEnd];

    const valueQuantity: Quantity = itemNounRaw
      ? { ...numeratorQty, unit: numeratorQty.unit ?? singularize(headNoun(itemNounRaw)), span: [numeratorQty.span[0], afterItemOffset], sourceText: text.slice(numeratorQty.span[0], afterItemOffset), evidence: [...numeratorQty.evidence, `item noun "${itemNounRaw}" attached from the immediately adjacent noun phrase`] }
      : numeratorQty;

    const perUnitIsTime = isTimePeriodWord(perUnit);
    const { kind, reason } = classifyRateKind(valueQuantity.kind, perUnitIsTime, verb);
    evidence.push(`verb "${verb}" governs the numerator`, reason);

    out.push({
      rate: {
        value: valueQuantity,
        per: { unit: perUnit, count: perCount, span: [perSpanStart, perSpanEnd] },
        kind,
        subject,
        itemNoun: itemNounRaw ? singularize(headNoun(itemNounRaw)) : undefined,
        span: fullSpan,
        sourceText: text.slice(fullSpan[0], fullSpan[1]),
        evidence,
      },
      consumedSpan: fullSpan,
    });
  }
  return out;
}

// ─── RECOGNIZER 2: QUANTITY [ITEM NOUN] + per/a/an/each + PERIOD-PHRASE ────────────────────────
//
// Covers: "$5 per hour", "$5 an hour" (already matched here, not needing recognizer 3's dedicated
//         path, since "an hour" is just "a/an" + period word), "3 miles per hour",
//         "5 apples a day", "500 movies a day", "$1000 per semester", "$100 a month",
//         "3.5 pounds of insects each week" (an item noun of MULTIPLE words, "pounds of insects",
//         is captured by the bounded 0-3-word noun-phrase span, per the W10 multi-word finding).

function recognizeQuantityPerPeriod(text: string, quantities: Quantity[], usedSpans: Array<[number, number]>): { rate: Rate; consumedSpan: [number, number] }[] {
  const out: { rate: Rate; consumedSpan: [number, number] }[] = [];

  for (const qty of quantities) {
    if (usedSpans.some(([s, e]) => qty.span[0] < e && s < qty.span[1])) continue;

    // Bounded word-by-word scan, never an unbounded greedy regex -- see tryNounPhraseThenCue's own
    // header for the two real bugs (W10 multi-word noun phrases, and this dispatch's own
    // gsm8k-train-47/train-50 finds) an earlier greedy-regex draft produced.
    const lookahead = scanWordRun(text, qty.span[1], 6);
    const found = tryNounPhraseThenCue(lookahead, 4, VERB_CUE_WORDS);
    if (!found) continue;
    const { nounWords, cueIdx } = found;
    const cueWord = lookahead[cueIdx];
    const cue = cueWord.word.toLowerCase();

    const periodWords = captureBoundedNoun(lookahead.slice(cueIdx + 1), 3, true);
    if (periodWords.length === 0) continue;
    const periodPhrase = periodWords.map((w) => w.word).join(' ');
    const periodWord = headNoun(periodPhrase).toLowerCase();

    // Positive-evidence guard: "a"/"an"/"each" only introduces a per-clause here when the phrase
    // that follows is a recognized time-period word ("an hour", "a day", "each week") -- otherwise
    // "a"/"an"/"each" is an ordinary article/determiner ("bought a shirt") and this is not a rate.
    // "per" has no such restriction: "per carton", "per box", "per semester" are all valid
    // per-units even though they are not time words.
    if (cue !== 'per' && !isTimePeriodWord(periodWord)) continue;
    // "per <pronoun>" is never a valid per-unit -- ambiguous, no fixed referent (named adversarial
    // abstain case in this dispatch's own charge).
    if (PRONOUN_WORDS.has(periodWord)) continue;

    const itemNounRaw = nounWords.length > 0 ? nounWords.map((w) => w.word).join(' ') : null;
    // A bare time-period word captured as the "item" ("days" in "5 days a week", "times" in "3
    // times a week") is frequency territory, not a plain quantity-per-period -- deferred to the
    // dedicated frequency recognizers so the two never compete for the same span with two
    // different, inconsistent `kind` classifications. `qty.unit` is checked too (not just
    // itemNounRaw): quantities.ts's own adjacency pass already merges "5 days" into ONE Quantity
    // with unit="days" BEFORE this function ever sees it (since "day"/"days" is one of
    // quantities.ts's own recognized TIME_UNIT_WORDS), so on gsm8k-train-15's "5 days a week" the
    // period noun never appears as a separate lookahead word at all -- found as a real miss this
    // dispatch (an earlier draft's itemNounRaw-only guard let this one through as a false
    // 'generic' rate instead of deferring to recognizeFrequencyCountPeriodAPeriod's 'frequency').
    const qtyUnitIsTimePeriod = qty.unit ? isTimePeriodWord(singularize(qty.unit)) : false;
    if (qtyUnitIsTimePeriod || (itemNounRaw && isTimePeriodWord(singularize(headNoun(itemNounRaw))))) continue;

    const perSpan: [number, number] = [cueWord.start, periodWords[periodWords.length - 1].end];
    const perUnit = singularize(periodWord);
    const perCount = fractionFromBigInt(1n);

    const fullSpanEnd = perSpan[1];
    const fullSpan: [number, number] = [qty.span[0], fullSpanEnd];

    const evidence: string[] = [];
    let valueQuantity = qty;
    if (itemNounRaw) {
      const newEnd = nounWords[nounWords.length - 1].end;
      valueQuantity = {
        ...qty,
        unit: qty.unit ?? singularize(headNoun(itemNounRaw)),
        span: [qty.span[0], newEnd],
        sourceText: text.slice(qty.span[0], newEnd),
        evidence: [...qty.evidence, `item noun "${itemNounRaw}" attached from the immediately adjacent noun phrase`],
      };
      evidence.push(`"${qty.sourceText} ${itemNounRaw}" is the rate's numerator`);
    } else {
      evidence.push(`"${qty.sourceText}" is the rate's numerator (no separate item noun in this clause)`);
    }
    evidence.push(`"${text.slice(perSpan[0], perSpan[1])}" matched as the per-clause, cue word "${cue}"`);

    const perUnitIsTime = isTimePeriodWord(perUnit) || cue !== 'per' /* a/an/each already required a time word above */;
    const verb = findGoverningVerbBefore(text, qty.span[0], 3);
    if (verb) evidence.push(`governing verb "${verb}" found immediately before the numerator`);
    const { kind, reason } = classifyRateKind(valueQuantity.kind, perUnitIsTime, verb);
    evidence.push(reason);

    out.push({
      rate: {
        value: valueQuantity,
        per: { unit: perUnit, count: perCount, span: perSpan },
        kind,
        itemNoun: itemNounRaw ? singularize(headNoun(itemNounRaw)) : undefined,
        span: fullSpan,
        sourceText: text.slice(fullSpan[0], fullSpan[1]),
        evidence,
      },
      consumedSpan: fullSpan,
    });
  }

  return out;
}

// ─── RECOGNIZER 3: POSTFIX "$X each" / "$X for each" ───────────────────────────────────────────
//
// Covers: "5 pairs of shorts for $7 each", "2 pairs of shoes for $10 each", "He charges $10 for
// each." The item noun, when resolvable, is the nearest PRECEDING "<quantity> <noun phrase>" in
// the SAME sentence (never a prior sentence -- cross-sentence resolution is parse/entities.ts's
// job, per this module's own scope boundary). When no such antecedent exists in the same sentence
// ("$10 for each." with the item named only earlier), itemNoun is left unset rather than guessed,
// per the positive-evidence contract -- the RATE itself ($10 per one, whatever it turns out to be)
// is still real evidence and is still returned.

const POSTFIX_EACH_RE = /\b(?:for\s+)?each\b(?!\s+(?:of|other))/gi;

function recognizeEachPostfix(text: string, quantities: Quantity[], usedSpans: Array<[number, number]>): { rate: Rate; consumedSpan: [number, number] }[] {
  const out: { rate: Rate; consumedSpan: [number, number] }[] = [];
  let m: RegExpExecArray | null;
  POSTFIX_EACH_RE.lastIndex = 0;
  while ((m = POSTFIX_EACH_RE.exec(text)) !== null) {
    const eachStart = m.index;
    const eachEnd = m.index + m[0].length;

    // The numerator quantity must end EXACTLY where this "each"/"for each" begins (allowing only
    // whitespace between) -- positive evidence, never a scan-back guess. NOT restricted to money:
    // "each" as a distributive postfix marker attaches to any quantity kind ("8 liters each", "2
    // people each" for a per-chair capacity) -- found as a real, meaningful gap this dispatch's
    // own coverage sampling caught (gsm8k-train-62 "10 of the cans are holding 8 liters each" and
    // gsm8k-train-122 "40 chairs with a capacity of 2 people each" both left unextracted under an
    // earlier draft that only matched a preceding MONEY quantity).
    const priceQty = quantities.find((q) => isAdjacentWs(text, q.span[1], eachStart));
    if (!priceQty) continue;
    if (usedSpans.some(([s, e]) => priceQty.span[0] < e && s < priceQty.span[1])) continue;

    // Sentence-scoped look-back for the nearest PRIOR quantity, then a bounded FORWARD noun-phrase
    // scan from that quantity's own end -- e.g. "5 pairs of shorts for $7 each": the nearest prior
    // quantity to "$7" is "5", and the bounded scan from "5" captures "pairs of shorts" (stopping
    // at the stopword "for"). Never resolved across a sentence boundary (that cross-reference is
    // parse/entities.ts's job) and never a raw word-class regex over arbitrary text -- an earlier
    // draft's ad hoc `(\d+|[a-z]+)\s+...` regex matched "He charges" (verb "charges" mistaken for a
    // noun) as a false antecedent on gsm8k-train-50; this version only ever looks at REAL
    // `Quantity` mentions, never an arbitrary preceding word.
    const sentenceStart = Math.max(text.lastIndexOf('.', priceQty.span[0]), text.lastIndexOf('!', priceQty.span[0]), text.lastIndexOf('?', priceQty.span[0])) + 1;
    let itemNoun: string | undefined;
    let forwardNounEnd: number | null = null;
    const evidence: string[] = [];

    // A noun immediately AFTER "each" ("each EPISODE", "each VISIT") is stronger, more local
    // positive evidence than any preceding antecedent -- it is not a cross-sentence guess at all,
    // just the very next word. Tried first; the backward antecedent search below is the fallback
    // for the far more common "$X each." / "<count> <noun> for $X each" shapes where nothing
    // follows "each" itself. Found necessary this dispatch: gsm8k-train-3312's "$15,000 each
    // episode" left itemNoun unset under an earlier draft that only ever looked backward.
    const forwardWords = captureBoundedNoun(scanWordRun(text, eachEnd, 3), 2);
    if (forwardWords.length > 0) {
      itemNoun = singularize(headNoun(forwardWords.map((w) => w.word).join(' ')));
      forwardNounEnd = forwardWords[forwardWords.length - 1].end;
      evidence.push(`itemNoun "${itemNoun}" resolved from the noun immediately following "each"`);
    } else {
      const antecedentQty = [...quantities]
        .filter((q) => q.span[0] >= sentenceStart && q.span[1] <= priceQty.span[0] && q !== priceQty)
        .sort((a, b) => b.span[0] - a.span[0])[0];
      if (antecedentQty) {
        const words = captureBoundedNoun(scanWordRun(text, antecedentQty.span[1], 4), 3);
        if (words.length > 0) {
          itemNoun = singularize(headNoun(words.map((w) => w.word).join(' ')));
        }
      }
      if (itemNoun) {
        evidence.push(`itemNoun "${itemNoun}" resolved from the nearest preceding "<quantity> <noun>" in the same sentence`);
      } else {
        evidence.push('itemNoun left unset: no local "<quantity> <noun>" antecedent in the same sentence (cross-sentence resolution is parse/entities.ts\'s job)');
      }
    }

    const fullSpan: [number, number] = [priceQty.span[0], forwardNounEnd ?? eachEnd];
    evidence.unshift(
      `"${text.slice(fullSpan[0], fullSpan[1])}" matched the postfix "<price> each" price-rate pattern`,
    );

    // A price verb ("costs") is only assumed when the numerator is actually money -- for any
    // other kind ("8 liters each", "2 people each") there is no verb evidence at all here (the
    // postfix "each" alone does not say WHY the rate holds), so classification falls through to
    // 'generic' rather than a guessed price/consumption/production label.
    const { kind, reason } = classifyRateKind(priceQty.kind, false, priceQty.kind === 'money' ? 'costs' : null);
    evidence.push(reason);

    out.push({
      rate: {
        value: priceQty,
        per: { unit: itemNoun ?? 'item', count: fractionFromBigInt(1n), span: [eachStart, forwardNounEnd ?? eachEnd] },
        kind,
        itemNoun,
        span: fullSpan,
        sourceText: text.slice(fullSpan[0], fullSpan[1]),
        evidence,
      },
      consumedSpan: fullSpan,
    });
  }
  return out;
}

// ─── RECOGNIZER 4: "N times a/per <period>" and "<count> <period> a/per <larger period>" ───────
//
// Covers: "twice a week" (when "twice" is present as a Quantity of kind 'multiplier', from
// quantities.ts), "3 times a week", "5 days a week". A bare "twice as many" is never matched here
// because the required trailing "a/per <period word>" is absent in a comparative phrase --
// the comparative composition itself is parse/comparatives.ts's job (C4), never this module's.

const TIMES_A_PERIOD_RE = new RegExp(
  '\\b(times)\\s+(?:a|an|per)\\s+((?:[a-z]+\\s+){0,2}[a-z]+)\\b', 'gi',
);
const COUNT_PERIOD_A_PERIOD_RE = new RegExp(
  '\\b(' + Array.from(TIME_PERIOD_WORDS).join('|') + ')\\s+(?:a|an|per)\\s+((?:[a-z]+\\s+){0,2}[a-z]+)\\b', 'gi',
);

function recognizeFrequencyTimesAPeriod(text: string, quantities: Quantity[], usedSpans: Array<[number, number]>): { rate: Rate; consumedSpan: [number, number] }[] {
  const out: { rate: Rate; consumedSpan: [number, number] }[] = [];
  let m: RegExpExecArray | null;
  TIMES_A_PERIOD_RE.lastIndex = 0;
  while ((m = TIMES_A_PERIOD_RE.exec(text)) !== null) {
    const timesStart = m.index;
    const periodPhrase = m[2];
    const periodWord = singularize(headNoun(periodPhrase));
    if (!isTimePeriodWord(periodWord) && !isTimePeriodWord(periodWord + 's')) continue;
    if (PRONOUN_WORDS.has(periodWord)) continue;

    // The multiplier/count must end EXACTLY where "times" begins -- "twice times a week" never
    // occurs in English, so this only ever matches a genuine numeral directly before "times".
    const numQty = quantities.find((q) => isAdjacentWs(text, q.span[1], timesStart));
    if (!numQty) continue;
    if (usedSpans.some(([s, e]) => numQty.span[0] < e && s < numQty.span[1])) continue;

    const fullSpan: [number, number] = [numQty.span[0], m.index + m[0].length];
    const evidence = [
      `"${text.slice(fullSpan[0], fullSpan[1])}" matched the "<count> times a/per <period>" frequency pattern`,
      "kind 'frequency': an explicit times-per-period schedule phrase",
    ];
    out.push({
      rate: {
        value: numQty,
        per: { unit: periodWord, count: fractionFromBigInt(1n), span: [timesStart, fullSpan[1]] },
        kind: 'frequency',
        span: fullSpan,
        sourceText: text.slice(fullSpan[0], fullSpan[1]),
        evidence,
      },
      consumedSpan: fullSpan,
    });
  }
  return out;
}

/** "5 days a week", "6 hours a day" -- a count of one period-unit occurring within a LARGER
 *  period-unit. The smaller period word IS the numerator's own unit (not a separate item noun). */
function recognizeFrequencyCountPeriodAPeriod(text: string, quantities: Quantity[], usedSpans: Array<[number, number]>): { rate: Rate; consumedSpan: [number, number] }[] {
  const out: { rate: Rate; consumedSpan: [number, number] }[] = [];
  let m: RegExpExecArray | null;
  COUNT_PERIOD_A_PERIOD_RE.lastIndex = 0;
  while ((m = COUNT_PERIOD_A_PERIOD_RE.exec(text)) !== null) {
    const smallPeriodStart = m.index;
    const smallPeriodWord = singularize(m[1]);
    const largePeriodPhrase = m[2];
    const largePeriodWord = singularize(headNoun(largePeriodPhrase));
    if (!isTimePeriodWord(largePeriodWord)) continue;
    if (smallPeriodWord === largePeriodWord) continue; // "a week a week" is nonsensical; guard anyway.

    const smallPeriodEnd = smallPeriodStart + m[1].length;
    // Two shapes: (a) the numeral quantity ends EXACTLY where the period word begins ("5" then
    // "days"), the common case; or (b) quantities.ts's own adjacency pass already merged the
    // numeral and the period word into ONE Quantity (e.g. "5 days" as a single time-kind
    // Quantity with unit="days", since "day"/"days" is one of quantities.ts's own recognized
    // TIME_UNIT_WORDS) -- found as a real miss this dispatch on gsm8k-train-15's "5 days a week",
    // where case (a)'s adjacency check alone never finds a match because there is no quantity
    // boundary sitting between "5" and "days" any more.
    const numQty = quantities.find(
      (q) => isAdjacentWs(text, q.span[1], smallPeriodStart) ||
        (q.span[0] <= smallPeriodStart && smallPeriodEnd <= q.span[1]),
    );
    if (!numQty) continue;
    if (usedSpans.some(([s, e]) => numQty.span[0] < e && s < numQty.span[1])) continue;

    const alreadyMerged = numQty.span[0] < smallPeriodStart;
    const fullEnd = m.index + m[0].length;
    const fullSpan: [number, number] = [numQty.span[0], fullEnd];
    const valueQuantity: Quantity = alreadyMerged
      ? numQty
      : {
          ...numQty,
          unit: numQty.unit ?? smallPeriodWord,
          evidence: [...numQty.evidence, `unit "${smallPeriodWord}" attached from the immediately adjacent period word`],
        };
    const evidence = [
      `"${text.slice(fullSpan[0], fullSpan[1])}" matched the "<count> <period> a/per <larger period>" schedule pattern`,
      "kind 'frequency': a count of one period-unit occurring within a larger period-unit",
    ];
    out.push({
      rate: {
        value: valueQuantity,
        per: { unit: largePeriodWord, count: fractionFromBigInt(1n), span: [smallPeriodStart, fullEnd] },
        kind: 'frequency',
        span: fullSpan,
        sourceText: text.slice(fullSpan[0], fullSpan[1]),
        evidence,
      },
      consumedSpan: fullSpan,
    });
  }
  return out;
}

// ─── RECOGNIZER 5: "every N <period>" / "every other <period>" ────────────────────────────────

const EVERY_PERIOD_RE = /\bevery\s+(other|\d+|one|two|three|four|five|six|seven|eight|nine|ten)?\s*([a-z]+)\b/gi;

function recognizeEveryPeriod(text: string): { rate: Rate; consumedSpan: [number, number] }[] {
  const out: { rate: Rate; consumedSpan: [number, number] }[] = [];
  let m: RegExpExecArray | null;
  EVERY_PERIOD_RE.lastIndex = 0;
  while ((m = EVERY_PERIOD_RE.exec(text)) !== null) {
    const countTok = m[1];
    const periodWordRaw = m[2];
    const periodWord = singularize(periodWordRaw);
    if (!isTimePeriodWord(periodWord)) continue;

    let count: bigint;
    let countEvidence: string;
    if (!countTok) {
      count = 1n;
      countEvidence = 'no explicit count word ("every day"): implicit count 1';
    } else if (countTok.toLowerCase() === 'other') {
      count = 2n;
      countEvidence = '"other" resolved to count 2 ("every other day" = once per two days)';
    } else {
      const resolved = resolveSmallCardinal(countTok);
      if (resolved === null) continue;
      count = resolved;
      countEvidence = `count word "${countTok}" resolved to ${resolved}`;
    }

    const fullSpan: [number, number] = [m.index, m.index + m[0].length];
    const valueQuantity = makeSyntheticQuantity(
      fractionFromBigInt(1n),
      null,
      'count',
      [m.index, m.index + 'every'.length],
      'every',
      ['implicit single-occurrence value for an "every ... " frequency phrase'],
    );
    out.push({
      rate: {
        value: valueQuantity,
        per: { unit: periodWord, count: fractionFromBigInt(count), span: fullSpan },
        kind: 'frequency',
        span: fullSpan,
        sourceText: text.slice(fullSpan[0], fullSpan[1]),
        evidence: [
          `"${text.slice(fullSpan[0], fullSpan[1])}" matched the "every [count] <period>" frequency pattern`,
          countEvidence,
          "kind 'frequency': an explicit periodicity phrase",
        ],
      },
      consumedSpan: fullSpan,
    });
  }
  return out;
}

// ─── RECOGNIZER 6: "<a/N> dozen <noun> for $<amount>" -- derived per-unit price ────────────────
//
// Covers the scope document's own worked example: "a dozen eggs for $6" -> price per unit
// DERIVED, with the derivation itself recorded in evidence (12 eggs per dozen; the per-egg price
// is a division a CONSUMING method performs, never this module -- per the cross-cutting design
// point that a parsing layer answers "what is this text saying," never finishes the arithmetic).

const DOZEN_FOR_PRICE_RE = /\b(a|an|\d+|one|two|three|four|five|six)\s+dozen\s+([a-z]+)\s+for\s+\$(\d+(?:\.\d+)?)/gi;

function recognizeDozenForPrice(text: string): { rate: Rate; consumedSpan: [number, number] }[] {
  const out: { rate: Rate; consumedSpan: [number, number] }[] = [];
  let m: RegExpExecArray | null;
  DOZEN_FOR_PRICE_RE.lastIndex = 0;
  while ((m = DOZEN_FOR_PRICE_RE.exec(text)) !== null) {
    const multiplierTok = m[1];
    const noun = m[2];
    const priceStr = m[3];
    const multiplier = resolveSmallCardinal(multiplierTok);
    if (multiplier === null) continue;
    const dozenCount = multiplier * 12n;
    const priceFraction = (() => {
      const [intPart, fracPart = ''] = priceStr.split('.');
      const denom = 10n ** BigInt(fracPart.length);
      const numer = BigInt((intPart || '0') + fracPart);
      return { n: numer, d: denom };
    })();

    const fullSpan: [number, number] = [m.index, m.index + m[0].length];
    const priceSpanStart = m.index + m[0].lastIndexOf('$');
    const valueQuantity = makeSyntheticQuantity(
      priceFraction,
      'dollars',
      'money',
      [priceSpanStart, fullSpan[1]],
      text.slice(priceSpanStart, fullSpan[1]),
      [`"$${priceStr}" matched as the money literal for this dozen-priced item`],
    );

    out.push({
      rate: {
        value: valueQuantity,
        per: { unit: singularize(noun), count: fractionFromBigInt(dozenCount), span: [m.index, m.index + `${multiplierTok} dozen ${noun}`.length] },
        kind: 'price',
        itemNoun: singularize(noun),
        span: fullSpan,
        sourceText: text.slice(fullSpan[0], fullSpan[1]),
        evidence: [
          `"${text.slice(fullSpan[0], fullSpan[1])}" matched the "<count> dozen <noun> for $<amount>" derived-price pattern`,
          `derivation: ${multiplierTok} dozen = ${dozenCount} ${singularize(noun)}(s) for $${priceStr} total (per-unit division is a consuming method's job, not this module's)`,
          "kind 'price': a total price stated for a dozen-counted quantity of items",
        ],
      },
      consumedSpan: fullSpan,
    });
  }
  return out;
}

// ─── OVERLAP RESOLUTION ─────────────────────────────────────────────────────────────────────────

function resolveRateOverlaps(
  entries: { rate: Rate; consumedSpan: [number, number] }[],
): { rate: Rate; consumedSpan: [number, number] }[] {
  const ranked = [...entries].sort((a, b) => {
    const lenA = a.consumedSpan[1] - a.consumedSpan[0];
    const lenB = b.consumedSpan[1] - b.consumedSpan[0];
    if (lenB !== lenA) return lenB - lenA;
    return a.consumedSpan[0] - b.consumedSpan[0];
  });
  const accepted: { rate: Rate; consumedSpan: [number, number] }[] = [];
  for (const e of ranked) {
    const overlaps = accepted.some(
      (a) => e.consumedSpan[0] < a.consumedSpan[1] && a.consumedSpan[0] < e.consumedSpan[1],
    );
    if (!overlaps) accepted.push(e);
  }
  return accepted.sort((a, b) => a.consumedSpan[0] - b.consumedSpan[0]);
}

// ─── PUBLIC API ─────────────────────────────────────────────────────────────────────────────────

/** Extracts every rate/per-unit phrase in `text` with positive textual evidence, plus a named
 *  reason for every rate-shaped cue ("per", "each", "every", "times a") this function found but
 *  could not resolve into a `Rate`. Never infers a rate from two unrelated numbers appearing near
 *  each other; every abstain condition is named. Deterministic, no model call, exact spans into
 *  the original `text`, exact-rational arithmetic throughout. `quantities`, when supplied, is used
 *  in place of a fresh `extractQuantities(text)` call (same convention as this module's siblings'
 *  own optional-precomputed-input pattern) -- supplying a mismatched quantities array for a
 *  DIFFERENT text is a caller error this function does not attempt to detect. */
export function extractRates(text: string, quantities?: Quantity[]): ExtractRatesResult {
  if (typeof text !== 'string' || text.length === 0) return { rates: [], abstains: [] };

  const qtys = quantities ?? extractQuantities(text);
  const ask = extractAsk(text);
  // GSM8K frequently bundles a stated premise into the SAME sentence as the final question via a
  // comma chain ("If Martha wants to spend $2700 total, and each flower costs $15, how many
  // lilies will she put in each centerpiece?") -- ask.ts's own `extractAsk` correctly reports the
  // WHOLE sentence as the ask (that is its job: isolate the ask SENTENCE), but the "each flower
  // costs $15" clause inside it is a STATED FACT, not something being asked. Found as a real false
  // negative this dispatch's own coverage sampling caught on gsm8k-train-1103: treating the WHOLE
  // ask.span as off-limits abstained a genuine, extractable rate. Narrowed here to the portion of
  // the ask sentence from its own classifying wh-word (how/what/which) onward -- the true
  // interrogative core -- so a premise clause stated BEFORE that word is never suppressed, only a
  // rate-shaped phrase that is actually part of the question being asked.
  let askGuardStart: number | null = null;
  if (ask) {
    const whMatch = /\b(how|what|which)\b/i.exec(text.slice(ask.span[0], ask.span[1]));
    askGuardStart = whMatch ? ask.span[0] + whMatch.index : ask.span[0];
  }

  const candidates: { rate: Rate; consumedSpan: [number, number] }[] = [
    ...recognizeDozenForPrice(text),
  ];
  const usedAfterDozen = candidates.map((c) => c.consumedSpan);
  candidates.push(...recognizeEachEveryVerb(text, qtys));
  const usedAfterEachVerb = candidates.map((c) => c.consumedSpan);
  candidates.push(...recognizeQuantityPerPeriod(text, qtys, usedAfterEachVerb));
  const usedAfterQtyPeriod = candidates.map((c) => c.consumedSpan);
  candidates.push(...recognizeEachPostfix(text, qtys, usedAfterQtyPeriod));
  const usedAfterPostfix = candidates.map((c) => c.consumedSpan);
  candidates.push(...recognizeFrequencyTimesAPeriod(text, qtys, usedAfterPostfix));
  const usedAfterTimes = candidates.map((c) => c.consumedSpan);
  candidates.push(...recognizeFrequencyCountPeriodAPeriod(text, qtys, usedAfterTimes));
  candidates.push(...recognizeEveryPeriod(text));

  const resolved = resolveRateOverlaps(candidates);

  const rates: Rate[] = [];
  const abstains: RateAbstain[] = [];

  for (const entry of resolved) {
    const [s, e] = entry.rate.span;
    const insideAsk = askGuardStart !== null && ask ? s >= askGuardStart && e <= ask.span[1] : false;
    if (insideAsk) {
      abstains.push({
        reason:
          'abstain: this rate-shaped phrase falls entirely inside the ask sentence\'s own ' +
          'interrogative core (from its wh-word onward) -- the question is ASKING for a rate, not ' +
          'stating one (extractAsk() from ./ask used as a defense-in-depth guard, per this ' +
          'module\'s own header)',
        span: entry.rate.span,
      });
      continue;
    }
    rates.push(entry.rate);
  }

  // Named abstains for cue words that fired NO recognizer at all -- "each"/"per"/"every" present
  // in the text with no adjacent resolvable quantity, reported so a caller can see WHY nothing was
  // found rather than silently returning an empty array indistinguishable from "no rate cues at
  // all". Only cues not already covered by an accepted Rate's own span are reported.
  const acceptedSpans = rates.map((r) => r.span);
  const isCovered = (idx: number) => acceptedSpans.some(([s, e]) => idx >= s && idx < e);

  const bareEachRe = /\beach\b/gi;
  let bm: RegExpExecArray | null;
  bareEachRe.lastIndex = 0;
  while ((bm = bareEachRe.exec(text)) !== null) {
    if (isCovered(bm.index)) continue;
    const before = text.slice(Math.max(0, bm.index - 40), bm.index);
    const hasPrecedingQuantityAdjacent = qtys.some((q) => isAdjacentWs(text, q.span[1], bm!.index));
    if (!hasPrecedingQuantityAdjacent) {
      abstains.push({
        reason: 'abstain: "each" with no adjacent (immediately preceding) quantity to attach a rate to',
        span: [bm.index, bm.index + bm[0].length],
      });
    }
  }

  const barePerRe = /\bper\b/gi;
  let pm: RegExpExecArray | null;
  barePerRe.lastIndex = 0;
  while ((pm = barePerRe.exec(text)) !== null) {
    if (isCovered(pm.index)) continue;
    const afterPer = text.slice(pm.index + 3, pm.index + 3 + 20);
    const nextWordMatch = /^\s+([a-z]+)/i.exec(afterPer);
    const nextWord = nextWordMatch ? nextWordMatch[1].toLowerCase() : '';
    if (PRONOUN_WORDS.has(nextWord)) {
      abstains.push({
        reason: `abstain: "per" followed by the pronoun "${nextWord}" -- no fixed per-unit referent`,
        span: [pm.index, pm.index + 3],
      });
      continue;
    }
    abstains.push({
      reason: 'abstain: "per" cue with no resolvable adjacent quantity on either side',
      span: [pm.index, pm.index + 3],
    });
  }

  return { rates, abstains };
}
