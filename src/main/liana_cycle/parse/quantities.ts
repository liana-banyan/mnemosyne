// D-BP223-BM04-h2cbpv9w-170 -- parse/quantities.ts (module C1 of the shared parsing layer scope
// at BISHOP_DROPZONE/D-BP223-BM04-h2cbpv9w-170_PARSING_LAYER_SCOPE.md).
//
// WHY THIS FILE EXISTS. The scope document measured, by grep, that word-number parsing
// (`wordOrDigit`) is independently reimplemented in 54 of ~107 method files, that a hand-rolled
// BigInt fraction class (gcdBig/addFrac/subFrac/mulFrac/toFraction/exactInt) is reimplemented in
// 5+ files with two mutually incompatible return shapes for a "ratio phrase" ({num,den} vs a
// {n,d} Frac), and that zero method files import a shared extraction helper of any kind. This
// module is the ONE canonical exact-rational `Fraction` type and the ONE canonical quantity
// extractor those files are meant to replace, per section C1 of the scope document.
//
// CONTRACT (per section C1 and the dispatch that scoped it). `extractQuantities(text)` returns
// only quantities with POSITIVE EVIDENCE at their exact text span -- a literal digit run, a
// literal number word, a literal money/percent/fraction marker. It never invents a quantity from
// context and it never guesses past an ambiguous case; every abstain condition below is named and
// reasoned, not silent. Every value is an exact rational (`Fraction = { n: bigint; d: bigint }`),
// never a floating-point number -- this is the single most consequential design point per the
// BP221 memory ruling ("use SymPy for math always" -- exact arithmetic, never a model's or a
// language runtime's own floating output) even though this module makes no model call and no
// SymPy call itself: it is deterministic regex-and-bigint code, matching HARDWIRE-22's boundary
// that nothing in this layer asks a model to judge anything.
//
// PER THE BP222 MEMORY RULING ("a hand-copied contract is the defect, not bad types"): every type
// exported here is meant to be IMPORTED by consuming methods, never re-declared locally. A method
// that copies `Fraction`'s shape by hand instead of importing it reintroduces the exact disease
// this module exists to cure.
//
// SCOPE BOUNDARY, STATED EXPLICITLY. This module answers "what number is this text saying,"
// never "what does the question want done with it" (the cross-cutting design point of section C
// of the scope doc). It does NOT resolve comparative/multiplicative phrases such as "twice as
// many X as Y" or "N times more than" into a relationship between two quantities -- that
// composition is `parse/comparatives.ts` (C4)'s job, not built by this dispatch. This module does,
// however, parse the CARDINAL value of a standalone comparative-shaped word ("twice" -> 2,
// "double" -> 2, "triple" -> 3, "half" -> 1/2, "dozen" -> 12) when it appears as a plain numeral,
// because that is itself positive evidence of a literal number in the text, not a judgment about
// how it relates to anything else. It also widens beyond the scope document's original one-word-
// only number-word proposal to compound cardinal number words ("twenty-three," "one thousand two
// hundred fifty") per this dispatch's own explicit build instruction -- this is still parsing
// "what number is this," not resolving a comparative relationship, so it does not encroach on
// C4's territory.
//
// Rule 66: no em-dashes anywhere in this file or its comments -- "--" is used throughout.

// ─── EXACT-RATIONAL Fraction TYPE ───────────────────────────────────────────────────────────────
//
// The ONE canonical replacement for the 5+ independently hand-rolled BigInt fraction classes found
// in methods/*.ts (gcdBig, simplify, toFraction, fromNumber, addFrac, subFrac, mulFrac, exactInt).
// Always kept in lowest terms with a positive denominator by `makeFraction`.

export interface Fraction {
  readonly n: bigint;
  readonly d: bigint;
}

function gcdBig(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

/** Builds a Fraction in lowest terms with a positive denominator. Throws only on a zero
 *  denominator, which every caller in this file guards against before construction. */
export function makeFraction(n: bigint, d: bigint): Fraction {
  if (d === 0n) throw new Error('makeFraction: zero denominator');
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcdBig(n, d) || 1n;
  return { n: n / g, d: d / g };
}

export function addFraction(a: Fraction, b: Fraction): Fraction {
  return makeFraction(a.n * b.d + b.n * a.d, a.d * b.d);
}

export function subFraction(a: Fraction, b: Fraction): Fraction {
  return makeFraction(a.n * b.d - b.n * a.d, a.d * b.d);
}

export function mulFraction(a: Fraction, b: Fraction): Fraction {
  return makeFraction(a.n * b.n, a.d * b.d);
}

/** Returns null on division by zero instead of throwing -- every arithmetic entry point in this
 *  estate abstains rather than throws on an undefined result, per the estate's own convention
 *  (see e.g. subtract-then-multiply-then-add-remaining-v1's `exactInt` returning null, never
 *  raising). */
export function divFraction(a: Fraction, b: Fraction): Fraction | null {
  if (b.n === 0n) return null;
  return makeFraction(a.n * b.d, a.d * b.n);
}

export function negateFraction(a: Fraction): Fraction {
  return { n: -a.n, d: a.d };
}

export function fractionEquals(a: Fraction, b: Fraction): boolean {
  return a.n === b.n && a.d === b.d;
}

/** -1 / 0 / 1, matching Array.prototype.sort's comparator contract. */
export function compareFraction(a: Fraction, b: Fraction): number {
  const lhs = a.n * b.d;
  const rhs = b.n * a.d;
  if (lhs < rhs) return -1;
  if (lhs > rhs) return 1;
  return 0;
}

export function isIntegerFraction(f: Fraction): boolean {
  return f.d === 1n;
}

/** Returns the exact integer value, or null if the fraction is not integral. Never rounds -- the
 *  estate's own binding rule (BP221: "must not be asked to FINISH" an inexact computation) is that
 *  an inexact result is an abstain, not a rounded guess. */
export function exactIntegerOfFraction(f: Fraction): bigint | null {
  return f.d === 1n ? f.n : null;
}

export function fractionFromBigInt(n: bigint): Fraction {
  return { n, d: 1n };
}

/** Parses a plain decimal numeral string (already stripped of commas and any unit/currency
 *  marker) into an exact Fraction -- e.g. "1000.50" -> 2001/2. Returns null on anything that is
 *  not a bare unsigned decimal numeral, never on a caller's typo silently producing a wrong value. */
export function fractionFromDecimalString(raw: string): Fraction | null {
  const s = raw.trim();
  if (!/^\d+(?:\.\d+)?$/.test(s)) return null;
  const [intPart, fracPart = ''] = s.split('.');
  const d = 10n ** BigInt(fracPart.length);
  const n = BigInt((intPart || '0') + fracPart);
  return makeFraction(n, d);
}

/** Renders a Fraction back to a decimal string when it terminates exactly in base 10 (denominator
 *  a product of only 2s and 5s), otherwise falls back to "n/d". Used only for evidence strings and
 *  test assertions in this module -- never for arithmetic, which stays exact-rational throughout. */
export function fractionToDisplayString(f: Fraction): string {
  if (f.d === 1n) return f.n.toString();
  let d = f.d;
  let twos = 0;
  let fives = 0;
  while (d % 2n === 0n) {
    d /= 2n;
    twos++;
  }
  while (d % 5n === 0n) {
    d /= 5n;
    fives++;
  }
  if (d !== 1n) return `${f.n}/${f.d}`;
  const scale = Math.max(twos, fives);
  const scaledN = f.n * 2n ** BigInt(Math.max(0, scale - twos)) * 5n ** BigInt(Math.max(0, scale - fives));
  const neg = scaledN < 0n;
  const digits = (neg ? -scaledN : scaledN).toString().padStart(scale + 1, '0');
  const whole = digits.slice(0, digits.length - scale) || '0';
  const frac = scale > 0 ? '.' + digits.slice(digits.length - scale) : '';
  return (neg ? '-' : '') + whole + frac;
}

// ─── NUMBER-WORD TABLES ─────────────────────────────────────────────────────────────────────────
//
// The ONE canonical number-word table, replacing the byte-identical ONES_WORDS/TENS_WORDS/
// NUMBER_WORDS block confirmed duplicated in at least 54 method files (byte-identical in
// two_hop_multiple_chain_difference.ts and subtract_then_multiply_then_add_remaining.ts, read in
// full this dispatch).

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const ONES: Record<string, number> = {};
ONES_WORDS.forEach((w, i) => { ONES[w] = i; });

const TENS_WORDS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const TENS: Record<string, number> = {};
TENS_WORDS.forEach((w, i) => { TENS[w] = (i + 2) * 10; });

const SCALE_WORDS: Record<string, bigint> = { hundred: 100n, thousand: 1000n };

const DOZEN_VALUE = 12n;

// numerator word -> value, for word fractions ("two-thirds", "a third"). "a"/"an" resolve to 1.
const FRACTION_NUMERATOR_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

// denominator word (singular or plural) -> value.
const FRACTION_DENOMINATOR_WORDS: Record<string, number> = {
  half: 2, halves: 2,
  third: 3, thirds: 3,
  fourth: 4, fourths: 4, quarter: 4, quarters: 4,
  fifth: 5, fifths: 5,
  sixth: 6, sixths: 6,
  seventh: 7, sevenths: 7,
  eighth: 8, eighths: 8,
  ninth: 9, ninths: 9,
  tenth: 10, tenths: 10,
};

// word ordinal -> position value. Only consulted when the caller opts in via includeOrdinals.
const ORDINAL_WORDS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9,
  tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15,
  sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20,
};

// Pronoun compounds that happen to contain the standalone word "one" as their second token but are
// never a numeral in this position -- "no one", "any one", "every one", "some one", "each one".
// Positive-evidence guard: a "one" token is not extracted when the immediately preceding token is
// one of these, case-insensitive. Documented in full in this dispatch's return doc under ABSTAIN
// RULES, including a NAMED, MEASURED gap this guard does not close: an adjective-plus-"one"
// anaphor with no fixed determiner ("the previous one", "the other one") is not caught by this
// bounded list -- found by this dispatch's own coverage script against gsm8k-train-43 ("since the
// previous one" -- "one" there refers back to "earthquake," not a numeral) and recorded as a known
// limitation rather than silently shipped, per the estate's own "record the wrong answers too"
// doctrine, rather than papering over it with an unbounded (and therefore judgment-laden) rule.
const ONE_PRONOUN_GUARD_PRECEDERS = new Set(['no', 'any', 'every', 'some', 'each']);

// ─── UNIT WORDS, BY CATEGORY (for adjacency-based unit attachment) ─────────────────────────────

const TIME_UNIT_WORDS = new Set([
  'second', 'seconds', 'minute', 'minutes', 'hour', 'hours', 'day', 'days', 'week', 'weeks',
  'month', 'months', 'year', 'years',
]);
const LENGTH_UNIT_WORDS = new Set([
  'inch', 'inches', 'foot', 'feet', 'yard', 'yards', 'mile', 'miles', 'meter', 'meters', 'metre',
  'metres', 'kilometer', 'kilometers', 'centimeter', 'centimeters',
]);
const WEIGHT_UNIT_WORDS = new Set([
  'ounce', 'ounces', 'pound', 'pounds', 'gram', 'grams', 'kilogram', 'kilograms',
]);
const VOLUME_UNIT_WORDS = new Set([
  'gallon', 'gallons', 'liter', 'liters', 'litre', 'litres', 'cup', 'cups', 'pint', 'pints',
  'quart', 'quarts',
]);
const MONEY_UNIT_WORDS = new Set(['dollar', 'dollars', 'cent', 'cents']);

// The bounded whitelist governing when a bare "a"/"an" is extracted as a numeral (value 1) rather
// than abstained as an indefinite article. See ABSTAIN RULES in the return doc.
const A_AN_UNIT_WHITELIST = new Set<string>([
  ...TIME_UNIT_WORDS, ...LENGTH_UNIT_WORDS, ...WEIGHT_UNIT_WORDS, ...VOLUME_UNIT_WORDS,
  ...MONEY_UNIT_WORDS,
]);

// Abbreviated units glued directly to a digit with NO space ("100cm", "28cm", "5kg", "3ft") --
// found as a genuine miss by this dispatch's own coverage script (gsm8k-train-5899, "a 100cm
// length of rope", "the longer sides ... were 28cm long", the only one of 3,685 tuning-reserve
// items with zero quantities extracted before this recognizer was added). A plain `\b\d+\b` regex
// cannot match here: digits and letters are both \w characters, so there is no word boundary
// between "100" and "cm" for `\b` to anchor on -- the same reason a digit ordinal ("2nd") never
// matches `\b\d+\b` either. Longest-abbreviation-first ordering in the alternation below matters:
// "mm"/"cm"/"km" must be tried before the bare "m", and "lbs" before "lb", or the shorter
// abbreviation would win and leave a dangling letter unmatched.
const UNIT_ABBREVIATIONS: Record<string, { unit: string; kind: QuantityKind }> = {
  mm: { unit: 'mm', kind: 'length' },
  cm: { unit: 'cm', kind: 'length' },
  km: { unit: 'km', kind: 'length' },
  ft: { unit: 'ft', kind: 'length' },
  in: { unit: 'in', kind: 'length' },
  kg: { unit: 'kg', kind: 'weight' },
  lbs: { unit: 'lbs', kind: 'weight' },
  lb: { unit: 'lb', kind: 'weight' },
  hrs: { unit: 'hrs', kind: 'time' },
  hr: { unit: 'hr', kind: 'time' },
  mins: { unit: 'mins', kind: 'time' },
  min: { unit: 'min', kind: 'time' },
  secs: { unit: 'secs', kind: 'time' },
  sec: { unit: 'sec', kind: 'time' },
  m: { unit: 'm', kind: 'length' },
  g: { unit: 'g', kind: 'weight' },
};
// Longest-first so the alternation cannot stop at a shorter prefix of a longer abbreviation.
const UNIT_ABBREVIATION_ALT = Object.keys(UNIT_ABBREVIATIONS).sort((a, b) => b.length - a.length).join('|');

function unitCategoryKind(unit: string): QuantityKind | null {
  const u = unit.toLowerCase();
  if (TIME_UNIT_WORDS.has(u)) return 'time';
  if (LENGTH_UNIT_WORDS.has(u)) return 'length';
  if (WEIGHT_UNIT_WORDS.has(u)) return 'weight';
  if (VOLUME_UNIT_WORDS.has(u)) return 'volume';
  if (MONEY_UNIT_WORDS.has(u)) return 'money';
  return null;
}

// ─── Quantity TYPE ──────────────────────────────────────────────────────────────────────────────

export type QuantityKind =
  | 'count'
  | 'money'
  | 'percent'
  | 'fraction'
  | 'time'
  | 'length'
  | 'weight'
  | 'volume'
  | 'multiplier'
  | 'ordinal';

export interface Quantity {
  /** The exact rational value. For 'percent', this is the literal number stated before the '%'
   *  or 'percent' marker (e.g. 40 for "40%"), NOT pre-divided by 100 -- dividing by 100 is a
   *  computation a consuming method performs, not something this extraction layer decides for it,
   *  per the section C cross-cutting rule ("the parsing layer answers what the text is saying,
   *  never what the caller should do with it"). */
  value: Fraction;
  /** The unit word exactly as matched (lowercased), or null when no unit was attached. */
  unit: string | null;
  kind: QuantityKind;
  /** [start, end) character offsets into the original input text. */
  span: [number, number];
  /** text.slice(span[0], span[1]) -- provided directly so callers never need to re-slice. */
  sourceText: string;
  /** Human-readable positive-evidence trail: which pattern matched, what it matched, and any
   *  unit-attachment or normalization performed. Never empty. */
  evidence: string[];
}

export interface ExtractQuantitiesOptions {
  /** When true, also returns ordinal words/numerals ("2nd", "third") as kind 'ordinal'. Default
   *  false, per the abstain rule: "ordinals excluded from counts unless the caller asks." */
  includeOrdinals?: boolean;
}

// ─── TOKENIZATION (for word-number and phrase recognizers) ─────────────────────────────────────

interface WordToken {
  text: string;
  start: number;
  end: number;
}

function tokenizeWords(text: string): WordToken[] {
  const tokens: WordToken[] = [];
  const re = /[A-Za-z]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    tokens.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return tokens;
}

/** Resolves a single cardinal token (a bare digit run, or one number word, or a hyphenated
 *  two-word compound like "twenty-three") to its bigint value. Returns null if it resolves to
 *  nothing recognized. Deliberately narrow -- callers needing a longer word-number run use
 *  wordNumberRunAt below instead. */
function resolveCardinalToken(tok: string): bigint | null {
  const t = tok.trim();
  if (/^\d+$/.test(t)) return BigInt(t);
  const lower = t.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(ONES, lower)) return BigInt(ONES[lower]);
  if (Object.prototype.hasOwnProperty.call(TENS, lower)) return BigInt(TENS[lower]);
  const hyphen = /^([a-z]+)-([a-z]+)$/.exec(lower);
  if (
    hyphen &&
    Object.prototype.hasOwnProperty.call(TENS, hyphen[1]) &&
    Object.prototype.hasOwnProperty.call(ONES, hyphen[2])
  ) {
    return BigInt(TENS[hyphen[1]] + ONES[hyphen[2]]);
  }
  return null;
}

/** Consumes a maximal run of number words starting exactly at tokens[startIdx] (which must itself
 *  be a ONES or TENS word -- a run can never start on a bare "hundred", "thousand", or "and").
 *  Handles hundreds/thousands grouping and an "and" connector ("one hundred and fifty"), matching
 *  the standard words-to-number algorithm. Requires every consumed token to be contiguous in the
 *  ORIGINAL TEXT (only whitespace or a single hyphen between them) so "twenty, three cats appear"
 *  is never merged into "twenty-three" across a comma. Returns null if tokens[startIdx] is not a
 *  ONES/TENS word. */
function wordNumberRunAt(
  text: string,
  tokens: WordToken[],
  startIdx: number,
): { value: bigint; endIdx: number; endOffset: number } | null {
  const first = tokens[startIdx].text.toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(ONES, first) && !Object.prototype.hasOwnProperty.call(TENS, first)) {
    return null;
  }
  // "one" is never the start of a word-number run when it is really the pronoun compound
  // "no one"/"any one"/"every one"/"some one" -- see ONE_PRONOUN_GUARD_PRECEDERS.
  if (first === 'one' && startIdx > 0) {
    const prev = tokens[startIdx - 1].text.toLowerCase();
    if (ONE_PRONOUN_GUARD_PRECEDERS.has(prev) && isAdjacent(text, tokens[startIdx - 1].end, tokens[startIdx].start)) {
      return null;
    }
  }

  let current = 0n;
  let total = 0n;
  let i = startIdx;
  let lastEnd = tokens[startIdx].end;
  let consumedAny = false;

  while (i < tokens.length) {
    if (i > startIdx && !isAdjacent(text, lastEnd, tokens[i].start)) break;
    const w = tokens[i].text.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(ONES, w)) {
      current += BigInt(ONES[w]);
      lastEnd = tokens[i].end;
      i++;
      consumedAny = true;
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(TENS, w)) {
      current += BigInt(TENS[w]);
      lastEnd = tokens[i].end;
      i++;
      consumedAny = true;
      continue;
    }
    if (w === 'hundred') {
      current = (current === 0n ? 1n : current) * SCALE_WORDS.hundred;
      lastEnd = tokens[i].end;
      i++;
      consumedAny = true;
      continue;
    }
    if (w === 'thousand') {
      total += (current === 0n ? 1n : current) * SCALE_WORDS.thousand;
      current = 0n;
      lastEnd = tokens[i].end;
      i++;
      consumedAny = true;
      continue;
    }
    if (w === 'and') {
      const next = tokens[i + 1];
      const nextIsNumber =
        next &&
        isAdjacent(text, tokens[i].end, next.start) &&
        (Object.prototype.hasOwnProperty.call(ONES, next.text.toLowerCase()) ||
          Object.prototype.hasOwnProperty.call(TENS, next.text.toLowerCase()));
      if (!nextIsNumber) break;
      lastEnd = tokens[i].end;
      i++;
      continue;
    }
    break;
  }

  if (!consumedAny) return null;
  total += current;
  return { value: total, endIdx: i - 1, endOffset: lastEnd };
}

/** True when the only characters between two offsets are whitespace and/or a single hyphen --
 *  i.e. the two tokens are "adjacent" in the sense a compound number word or phrase requires. */
function isAdjacent(text: string, endOfPrev: number, startOfNext: number): boolean {
  if (startOfNext < endOfPrev) return false;
  const between = text.slice(endOfPrev, startOfNext);
  return /^[\s-]*$/.test(between);
}

// ─── CANDIDATE MODEL AND OVERLAP RESOLUTION ────────────────────────────────────────────────────

interface Candidate {
  start: number;
  end: number;
  value: Fraction;
  kind: QuantityKind;
  unit: string | null;
  evidence: string[];
  priority: number;
}

const DOUBLE_QUOTE_SPAN_RE = /"[^"]*"/g;

function findQuotedSpans(text: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  let m: RegExpExecArray | null;
  DOUBLE_QUOTE_SPAN_RE.lastIndex = 0;
  while ((m = DOUBLE_QUOTE_SPAN_RE.exec(text)) !== null) {
    spans.push([m.index, m.index + m[0].length]);
  }
  return spans;
}

function isInsideAnySpan(start: number, end: number, spans: Array<[number, number]>): boolean {
  return spans.some(([s, e]) => start >= s && end <= e);
}

// ─── RECOGNIZERS ────────────────────────────────────────────────────────────────────────────────
// Each returns raw candidates for one pattern family. Priority is the tie-break used by overlap
// resolution: a higher number wins when two candidates' spans overlap.

const PRIORITY = {
  compoundTime: 100,
  mixedNumberDigit: 95,
  mixedNumberWord: 90,
  money: 85,
  percent: 80,
  slashFraction: 75,
  wordFraction: 70,
  dozenPhrase: 65,
  multiplierWord: 60,
  ordinal: 55,
  abbreviatedUnit: 52,
  wordNumber: 50,
  digitNumber: 40,
} as const;

/** "N hours [and] M minutes" -> one compound time quantity, normalized to total minutes.
 *  Positive evidence: both an hours-quantity and a minutes-quantity textually adjacent in that
 *  order. This is the one compound form the scope document names by example; a further
 *  minutes-and-seconds tier is not implemented (documented limitation, not a silent gap). */
function recognizeCompoundTime(text: string): Candidate[] {
  const out: Candidate[] = [];
  const re = /\b(\d+|[a-zA-Z]+(?:-[a-zA-Z]+)?)\s+hours?\s+(?:and\s+)?(\d+|[a-zA-Z]+(?:-[a-zA-Z]+)?)\s+minutes?\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const hours = resolveCardinalToken(m[1]);
    const minutes = resolveCardinalToken(m[2]);
    if (hours === null || minutes === null) continue;
    const totalMinutes = hours * 60n + minutes;
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      value: fractionFromBigInt(totalMinutes),
      kind: 'time',
      unit: 'minutes',
      evidence: [
        `compound time "${m[0]}" = ${hours} hour(s) + ${minutes} minute(s), normalized to ${totalMinutes} minutes`,
      ],
      priority: PRIORITY.compoundTime,
    });
  }
  return out;
}

/** "3 1/2" -> a mixed number, exact rational 7/2. Digit-form only (see recognizeMixedNumberWord
 *  for "three and a half"). */
function recognizeMixedNumberDigit(text: string): Candidate[] {
  const out: Candidate[] = [];
  const re = /\b(\d+)\s+(\d+)\/(\d+)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const whole = BigInt(m[1]);
    const num = BigInt(m[2]);
    const den = BigInt(m[3]);
    if (den === 0n) continue;
    const value = addFraction(fractionFromBigInt(whole), makeFraction(num, den));
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      value,
      kind: 'fraction',
      unit: null,
      evidence: [`mixed number "${m[0]}" = ${whole} + ${num}/${den} = ${fractionToDisplayString(value)}`],
      priority: PRIORITY.mixedNumberDigit,
    });
  }
  return out;
}

/** "three and a half", "twenty-three and a half" -> N + 1/2, exact rational. */
function recognizeMixedNumberWord(text: string): Candidate[] {
  const out: Candidate[] = [];
  const re = /\b(\d+|[a-zA-Z]+(?:-[a-zA-Z]+)?)\s+and\s+a\s+half\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const whole = resolveCardinalToken(m[1]);
    if (whole === null) continue;
    const value = addFraction(fractionFromBigInt(whole), makeFraction(1n, 2n));
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      value,
      kind: 'fraction',
      unit: null,
      evidence: [`mixed number "${m[0]}" = ${whole} + 1/2 = ${fractionToDisplayString(value)}`],
      priority: PRIORITY.mixedNumberWord,
    });
  }
  return out;
}

/** "$1,000.50", "$12", "12 dollars", "50 cents". Comma-grouped thousands and decimals both
 *  supported; the numeral itself always resolves via fractionFromDecimalString, never
 *  parseFloat, so precision is exact even for amounts with cents. */
function recognizeMoney(text: string): Candidate[] {
  const out: Candidate[] = [];

  // NOTE the comma-group repetition is `+` (one or more), never `*`: with `*` a greedy `\d{1,3}`
  // can succeed on just the first 1-3 digits of a longer, comma-less run (e.g. "2000" would
  // wrongly match only "200") because the empty `(?:,\d{3})*` alternative always succeeds and JS
  // regex alternation does not backtrack to try the longer second branch once the first succeeds.
  // Requiring at least one comma group in the first branch forces a comma-less run to fall through
  // to the second, fully-greedy `\d+` branch instead. Caught by this module's own selftest against
  // a real "$2000" fixture (gsm8k-train-15) before this file was returned.
  const dollarSignRe = /\$\s*(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = dollarSignRe.exec(text)) !== null) {
    const digits = m[1].replace(/,/g, '');
    const value = fractionFromDecimalString(digits);
    if (!value) continue;
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      value,
      kind: 'money',
      unit: 'dollars',
      evidence: [`"$" + "${m[1]}" matched as a money literal, value ${fractionToDisplayString(value)} dollars`],
      priority: PRIORITY.money,
    });
  }

  // Same one-or-more comma-group fix as dollarSignRe above.
  const wordUnitRe = /\b(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(dollars?|cents?)\b/gi;
  while ((m = wordUnitRe.exec(text)) !== null) {
    const digits = m[1].replace(/,/g, '');
    const value = fractionFromDecimalString(digits);
    if (!value) continue;
    const unit = m[2].toLowerCase();
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      value,
      kind: 'money',
      unit: unit.startsWith('dollar') ? 'dollars' : 'cents',
      evidence: [`"${m[0]}" matched as a money literal with an explicit unit word`],
      priority: PRIORITY.money,
    });
  }

  return out;
}

/** "40%", "40 percent", "12.5%". */
function recognizePercent(text: string): Candidate[] {
  const out: Candidate[] = [];
  const re = /\b(\d+(?:\.\d+)?)\s*(%|percent\b)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const value = fractionFromDecimalString(m[1]);
    if (!value) continue;
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      value,
      kind: 'percent',
      unit: 'percent',
      evidence: [
        `"${m[0]}" matched as a percent literal, value ${fractionToDisplayString(value)} (not pre-divided by 100)`,
      ],
      priority: PRIORITY.percent,
    });
  }
  return out;
}

/** "3/4", "1/2" as a bare digit fraction (not already consumed as a mixed number). */
function recognizeSlashFraction(text: string): Candidate[] {
  const out: Candidate[] = [];
  const re = /\b(\d+)\/(\d+)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const num = BigInt(m[1]);
    const den = BigInt(m[2]);
    if (den === 0n) continue;
    const value = makeFraction(num, den);
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      value,
      kind: 'fraction',
      unit: null,
      evidence: [`"${m[0]}" matched as a literal a/b fraction, value ${fractionToDisplayString(value)}`],
      priority: PRIORITY.slashFraction,
    });
  }
  return out;
}

/** "two-thirds", "a third", "one half", "three fourths". */
function recognizeWordFraction(text: string): Candidate[] {
  const out: Candidate[] = [];
  const numeratorAlt = Object.keys(FRACTION_NUMERATOR_WORDS).join('|');
  const denominatorAlt = Object.keys(FRACTION_DENOMINATOR_WORDS).join('|');
  const re = new RegExp(`\\b(${numeratorAlt})[\\s-]+(${denominatorAlt})\\b`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const numerator = FRACTION_NUMERATOR_WORDS[m[1].toLowerCase()];
    const denominator = FRACTION_DENOMINATOR_WORDS[m[2].toLowerCase()];
    if (numerator === undefined || denominator === undefined) continue;
    const value = makeFraction(BigInt(numerator), BigInt(denominator));
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      value,
      kind: 'fraction',
      unit: null,
      evidence: [`"${m[0]}" matched as a word fraction, value ${fractionToDisplayString(value)}`],
      priority: PRIORITY.wordFraction,
    });
  }
  return out;
}

/** "a dozen" -> 12, "two dozen" -> 24. */
function recognizeDozenPhrase(text: string): Candidate[] {
  const out: Candidate[] = [];
  const re = /\b(a|an|\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+dozen\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const tok = m[1].toLowerCase();
    const multiplier = tok === 'a' || tok === 'an' ? 1n : resolveCardinalToken(m[1]);
    if (multiplier === null) continue;
    const value = fractionFromBigInt(multiplier * DOZEN_VALUE);
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      value,
      kind: 'count',
      unit: null,
      evidence: [`"${m[0]}" matched as ${multiplier} x 12 = ${multiplier * DOZEN_VALUE}`],
      priority: PRIORITY.dozenPhrase,
    });
  }
  return out;
}

/** Standalone "twice", "double", "triple" as literal multiplier numerals (2, 2, 3). Does not
 *  resolve what they multiply -- that composition is parse/comparatives.ts's job (C4). */
function recognizeMultiplierWords(text: string): Candidate[] {
  const out: Candidate[] = [];
  const re = /\b(twice|double|triple)\b(?!-)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const w = m[1].toLowerCase();
    const n = w === 'triple' ? 3n : 2n;
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      value: fractionFromBigInt(n),
      kind: 'multiplier',
      unit: null,
      evidence: [`"${m[0]}" recognized as a literal multiplier word, value ${n}`],
      priority: PRIORITY.multiplierWord,
    });
  }
  return out;
}

/** Bare "half" as a standalone fraction word (1/2), only when NOT already consumed by
 *  recognizeWordFraction ("a half", "one half") or recognizeMixedNumberWord ("... and a half") --
 *  overlap resolution handles that de-duplication, this recognizer simply offers the candidate. */
function recognizeBareHalf(text: string): Candidate[] {
  const out: Candidate[] = [];
  const re = /\bhalf\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      value: makeFraction(1n, 2n),
      kind: 'fraction',
      unit: null,
      evidence: [`"${m[0]}" recognized as the standalone fraction word, value 1/2`],
      priority: PRIORITY.multiplierWord,
    });
  }
  return out;
}

function digitOrdinalCandidates(text: string): Candidate[] {
  const out: Candidate[] = [];
  const re = /\b(\d+)(st|nd|rd|th)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      value: fractionFromBigInt(BigInt(m[1])),
      kind: 'ordinal',
      unit: null,
      evidence: [`"${m[0]}" matched as a digit ordinal, position ${m[1]}`],
      priority: PRIORITY.ordinal,
    });
  }
  return out;
}

function wordOrdinalCandidates(text: string, tokens: WordToken[]): Candidate[] {
  const out: Candidate[] = [];
  for (const tok of tokens) {
    const w = tok.text.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(ORDINAL_WORDS, w)) {
      out.push({
        start: tok.start,
        end: tok.end,
        value: fractionFromBigInt(BigInt(ORDINAL_WORDS[w])),
        kind: 'ordinal',
        unit: null,
        evidence: [`"${tok.text}" matched as a word ordinal, position ${ORDINAL_WORDS[w]}`],
        priority: PRIORITY.ordinal,
      });
    }
  }
  return out;
}

/** "a dollar", "an hour", "a mile" -> value 1, per the bounded whitelist in A_AN_UNIT_WHITELIST.
 *  A bare "a"/"an" NOT followed by a whitelisted unit word is never extracted -- see ABSTAIN
 *  RULES in the return doc for why the whitelist exists (an unbounded "a/an + any noun" rule would
 *  turn "a store", "a boy", "a garden" into false quantities). */
function recognizeAAnPlusUnit(text: string, tokens: WordToken[]): Candidate[] {
  const out: Candidate[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    const w = tokens[i].text.toLowerCase();
    if (w !== 'a' && w !== 'an') continue;
    if (!isAdjacent(text, tokens[i].end, tokens[i + 1].start)) continue;
    const nextWord = tokens[i + 1].text.toLowerCase();
    if (!A_AN_UNIT_WHITELIST.has(nextWord)) continue;
    const kind = unitCategoryKind(nextWord) ?? 'count';
    out.push({
      start: tokens[i].start,
      end: tokens[i + 1].end,
      value: fractionFromBigInt(1n),
      kind,
      unit: nextWord,
      evidence: [
        `"${tokens[i].text} ${tokens[i + 1].text}" matched via the bounded a/an-plus-unit whitelist, value 1 ${nextWord}`,
      ],
      priority: PRIORITY.wordNumber + 1,
    });
  }
  return out;
}

/** Word-number runs: "twenty-three", "one thousand two hundred fifty", and plain one-word numbers
 *  ("twelve"). Skips the pronoun-compound guard for bare "one" inside wordNumberRunAt. */
function recognizeWordNumber(text: string, tokens: WordToken[]): Candidate[] {
  const out: Candidate[] = [];
  const consumedUntil = new Set<number>();
  for (let i = 0; i < tokens.length; i++) {
    if (consumedUntil.has(i)) continue;
    const run = wordNumberRunAt(text, tokens, i);
    if (!run) continue;
    for (let k = i; k <= run.endIdx; k++) consumedUntil.add(k);
    const wordsUsed = tokens.slice(i, run.endIdx + 1).map((t) => t.text).join(' ');
    out.push({
      start: tokens[i].start,
      end: run.endOffset,
      value: fractionFromBigInt(run.value),
      kind: 'count',
      unit: null,
      evidence: [`word-number run "${wordsUsed}" = ${run.value}`],
      priority: PRIORITY.wordNumber,
    });
    i = run.endIdx;
  }
  return out;
}

/** "100cm", "28cm", "5kg", "3ft" -- a digit immediately followed (no space) by a recognized unit
 *  abbreviation. See UNIT_ABBREVIATIONS above for why this needs its own recognizer rather than
 *  relying on the plain digit regex plus adjacency attachment. */
function recognizeAbbreviatedUnit(text: string): Candidate[] {
  const out: Candidate[] = [];
  const re = new RegExp(`\\b(\\d+(?:\\.\\d+)?)(${UNIT_ABBREVIATION_ALT})\\b`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const value = fractionFromDecimalString(m[1]);
    if (!value) continue;
    const abbrev = UNIT_ABBREVIATIONS[m[2]];
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      value,
      kind: abbrev.kind,
      unit: abbrev.unit,
      evidence: [`"${m[0]}" matched as a digit glued to the unit abbreviation "${m[2]}", no space between them`],
      priority: PRIORITY.abbreviatedUnit,
    });
  }
  return out;
}

/** Plain digit numbers: "12", "1,000", "1,000.50", "0.5". The lowest-priority, most general
 *  recognizer -- every more specific recognizer above is expected to win any overlap. */
function recognizeDigitNumber(text: string): Candidate[] {
  const out: Candidate[] = [];
  const re = /\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b|\b\d+(?:\.\d+)?\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const digits = m[0].replace(/,/g, '');
    const value = fractionFromDecimalString(digits);
    if (!value) continue;
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      value,
      kind: 'count',
      unit: null,
      evidence: [`digit literal "${m[0]}" = ${fractionToDisplayString(value)}`],
      priority: PRIORITY.digitNumber,
    });
  }
  return out;
}

// ─── UNIT ATTACHMENT ────────────────────────────────────────────────────────────────────────────

// Includes MONEY_UNIT_WORDS so a word-number quantity ("one thousand two hundred fifty") followed
// by "dollars" is refined to kind 'money' by adjacency the same way a digit quantity is -- the
// recognizeMoney() regexes only catch a DIGIT numeral immediately before "dollars"/"cents", so a
// spelled-out amount depends on this general adjacency pass instead.
const ALL_UNIT_WORDS = new Set<string>([
  ...TIME_UNIT_WORDS, ...LENGTH_UNIT_WORDS, ...WEIGHT_UNIT_WORDS, ...VOLUME_UNIT_WORDS,
  ...MONEY_UNIT_WORDS,
]);

/** For a candidate that has no unit yet (bare count/fraction/multiplier), looks immediately ahead
 *  (skipping only whitespace) for a recognized unit word and, if found, extends the candidate's
 *  span to include it, sets `unit`, and refines `kind` from the unit's category. Never looks
 *  backward and never crosses a sentence-ending period -- adjacency is forward-only, matching the
 *  contract's "units attached by adjacency" requirement without inventing a unit the text does not
 *  literally show right there. */
function attachAdjacentUnit(text: string, tokens: WordToken[], c: Candidate): Candidate {
  if (c.unit !== null) return c;
  if (c.kind !== 'count' && c.kind !== 'fraction' && c.kind !== 'multiplier') return c;

  // Find the first word token starting at or after c.end.
  let idx = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].start >= c.end) {
      idx = i;
      break;
    }
  }
  if (idx === -1) return c;
  const tok = tokens[idx];
  if (!isAdjacent(text, c.end, tok.start)) return c;
  const word = tok.text.toLowerCase();
  if (!ALL_UNIT_WORDS.has(word)) return c;

  const refinedKind = unitCategoryKind(word) ?? c.kind;
  return {
    ...c,
    end: tok.end,
    unit: word,
    kind: refinedKind,
    evidence: [...c.evidence, `adjacent unit "${tok.text}" attached, kind refined to '${refinedKind}'`],
  };
}

// ─── OVERLAP RESOLUTION ─────────────────────────────────────────────────────────────────────────

/** Greedy interval scheduling: sort by (priority desc, length desc, start asc), accept a candidate
 *  iff it does not overlap any already-accepted span, then return accepted candidates sorted by
 *  start ascending for a stable left-to-right result. */
function resolveOverlaps(candidates: Candidate[]): Candidate[] {
  const ranked = [...candidates].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const lenA = a.end - a.start;
    const lenB = b.end - b.start;
    if (lenB !== lenA) return lenB - lenA;
    return a.start - b.start;
  });
  const accepted: Candidate[] = [];
  for (const cand of ranked) {
    const overlaps = accepted.some((a) => cand.start < a.end && a.start < cand.end);
    if (!overlaps) accepted.push(cand);
  }
  return accepted.sort((a, b) => a.start - b.start);
}

// ─── PUBLIC API ─────────────────────────────────────────────────────────────────────────────────

/** Extracts every quantity mention in `text` with positive textual evidence at its exact span.
 *  Never invents a quantity from context; every value is an exact rational Fraction, never a
 *  floating-point number. See the module header for the full contract, scope boundary against
 *  parse/comparatives.ts, and this dispatch's return doc for the complete abstain-rule writeup. */
export function extractQuantities(text: string, options: ExtractQuantitiesOptions = {}): Quantity[] {
  if (typeof text !== 'string' || text.length === 0) return [];

  const tokens = tokenizeWords(text);
  const quotedSpans = findQuotedSpans(text);

  let candidates: Candidate[] = [
    ...recognizeCompoundTime(text),
    ...recognizeMixedNumberDigit(text),
    ...recognizeMixedNumberWord(text),
    ...recognizeMoney(text),
    ...recognizePercent(text),
    ...recognizeSlashFraction(text),
    ...recognizeWordFraction(text),
    ...recognizeDozenPhrase(text),
    ...recognizeMultiplierWords(text),
    ...recognizeBareHalf(text),
    ...recognizeAAnPlusUnit(text, tokens),
    ...recognizeAbbreviatedUnit(text),
    ...recognizeWordNumber(text, tokens),
    ...recognizeDigitNumber(text),
  ];

  if (options.includeOrdinals) {
    candidates = [...candidates, ...digitOrdinalCandidates(text), ...wordOrdinalCandidates(text, tokens)];
  }

  // Ordinals are excluded by default -- filter before overlap resolution so a default call never
  // lets an ordinal's span block a real quantity from being selected, and so a default call's
  // output never contains one even if some recognizer above produced it defensively.
  if (!options.includeOrdinals) {
    candidates = candidates.filter((c) => c.kind !== 'ordinal');
  } else {
    // With ordinals requested, a digit ordinal ("2nd") and a plain digit run must not both claim
    // the same span; digit ordinals already win on priority (55 > 40) so no extra step is needed
    // beyond normal overlap resolution.
  }

  // Abstain on any candidate whose span falls entirely inside a double-quoted "title" span.
  candidates = candidates.filter((c) => !isInsideAnySpan(c.start, c.end, quotedSpans));

  const resolved = resolveOverlaps(candidates);
  const withUnits = resolved.map((c) => attachAdjacentUnit(text, tokens, c));

  // Unit attachment can extend a span forward; re-run overlap resolution once more so an extended
  // span that now overlaps its own right neighbor is resolved the same principled way (higher
  // priority first). This second pass only ever removes accidental double-claims introduced by
  // extension, never a whole new set of candidates.
  const final = resolveOverlaps(withUnits);

  return final.map((c) => ({
    value: c.value,
    unit: c.unit,
    kind: c.kind,
    span: [c.start, c.end] as [number, number],
    sourceText: text.slice(c.start, c.end),
    evidence: c.evidence,
  }));
}
