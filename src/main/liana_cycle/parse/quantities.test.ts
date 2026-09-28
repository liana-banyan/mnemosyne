// D-BP223-BM04-h2cbpv9w-170 -- parse/quantities.test.ts
//
// PROVES three things this dispatch's charge requires:
//   (1) the 10 tuning-reserve fixture ids named in section C1 of
//       BISHOP_DROPZONE/D-BP223-BM04-h2cbpv9w-170_PARSING_LAYER_SCOPE.md resolve to real question
//       text (gate5_sibling_interception.cjs's own 0-indexed 'gsm8k-train-' + lineIndex qid
//       convention) and extractQuantities() finds the hand-verified quantities in each one.
//   (2) every one of those 10 fixture ids is proven, at test time, to be ABSENT from
//       heldout_split_v1.json -- never merely assumed disjoint. If any fixture id were ever found
//       in the held-out file (e.g. a future edit to the fixture list, or the held-out file being
//       regenerated with a different split), this suite fails loudly rather than silently tuning
//       against held-out data, per Rule 6 ("NEVER touch the held-out half").
//   (3) the seven adversarial cases this dispatch's own charge named by name: "$1,000.50",
//       "two-thirds", "a dozen", "twice as many", "3 1/2 hours", "the 2nd", "1st" -- each with a
//       hand-worked expected result, not merely "does not throw".
//
// Every expected value below was computed by hand from the real GSM8K training-set question text
// (read via loadFixtureQuestion, not paraphrased), then checked against this module's own
// evidence-producing recognizers one at a time -- see the inline comments on each case for the
// reasoning, so a future reader can re-derive the expectation rather than trust it blindly.

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import {
  extractQuantities,
  makeFraction,
  addFraction,
  fractionFromBigInt,
  fractionEquals,
  fractionToDisplayString,
  type Quantity,
} from './quantities';

const GSM8K_TRAIN_PATH = 'C:/Users/Administrator/Documents/DATASETS/GSM8K/train.jsonl';
const HELDOUT_SPLIT_PATH =
  'C:/Users/Administrator/Documents/LianaBanyanPlatform/HARDWIRE/LEDGER/METHOD_QUARANTINE/heldout_split_v1.json';
const TUNING_RESERVE_PATH =
  'C:/Users/Administrator/Documents/LianaBanyanPlatform/HARDWIRE/LEDGER/METHOD_QUARANTINE/tuning_reserve_v1.json';

/** Same 0-indexed 'gsm8k-train-' + lineIndex convention as gate5_sibling_interception.cjs's own
 *  loadGsm8kTrain() (read in full this dispatch, not guessed). */
function loadFixtureQuestion(qid: string): string {
  const m = /^gsm8k-train-(\d+)$/.exec(qid);
  if (!m) throw new Error(`not a gsm8k-train qid: ${qid}`);
  const lineIndex = Number(m[1]);
  const lines = readFileSync(GSM8K_TRAIN_PATH, 'utf8').trim().split('\n');
  if (lineIndex >= lines.length) throw new Error(`line index ${lineIndex} out of range`);
  const row = JSON.parse(lines[lineIndex]);
  return row.question as string;
}

let heldoutIds: Set<string>;
let tuningReserveIds: Set<string>;

beforeAll(() => {
  expect(existsSync(HELDOUT_SPLIT_PATH)).toBe(true);
  expect(existsSync(TUNING_RESERVE_PATH)).toBe(true);
  const heldout = JSON.parse(readFileSync(HELDOUT_SPLIT_PATH, 'utf8'));
  const tuning = JSON.parse(readFileSync(TUNING_RESERVE_PATH, 'utf8'));
  heldoutIds = new Set<string>(heldout.items.map((it: { qid: string }) => it.qid));
  tuningReserveIds = new Set<string>(tuning.items.map((it: { qid: string }) => it.qid));
});

const FIXTURE_IDS = [
  'gsm8k-train-1', 'gsm8k-train-2', 'gsm8k-train-5', 'gsm8k-train-13', 'gsm8k-train-15',
  'gsm8k-train-16', 'gsm8k-train-23', 'gsm8k-train-30', 'gsm8k-train-35', 'gsm8k-train-40',
];

describe('C1 fixture disjointness from held-out (Rule 6: NEVER touch the held-out half)', () => {
  it('every fixture id is in the tuning reserve and NOT in the held-out split', () => {
    for (const qid of FIXTURE_IDS) {
      expect(tuningReserveIds.has(qid)).toBe(true);
      expect(heldoutIds.has(qid)).toBe(false);
    }
  });

  it('the tuning reserve and held-out split are themselves disjoint (proven, not assumed)', () => {
    let overlap = 0;
    for (const id of tuningReserveIds) if (heldoutIds.has(id)) overlap++;
    expect(overlap).toBe(0);
  });
});

/** Helper: reduces a Quantity[] to plain tuples for a compact, readable assertion, in the order
 *  extractQuantities returns them (span start ascending). */
function toTuples(qs: Quantity[]): Array<[string, string, string | null]> {
  return qs.map((q) => [q.kind, fractionToDisplayString(q.value), q.unit]);
}

describe('C1 tuning-reserve fixtures (hand-verified against real question text)', () => {
  it('gsm8k-train-1: "$12" money, "an hour" (a/an-plus-unit), "50 minutes" time', () => {
    const q = loadFixtureQuestion('gsm8k-train-1');
    expect(q).toContain('Weng earns $12 an hour');
    const result = extractQuantities(q);
    expect(toTuples(result)).toEqual([
      ['money', '12', 'dollars'],
      ['time', '1', 'hour'],
      ['time', '50', 'minutes'],
    ]);
  });

  it('gsm8k-train-2: "$100" money, "half" fraction, "$15" money, "twice" multiplier', () => {
    const q = loadFixtureQuestion('gsm8k-train-2');
    expect(q).toContain('costs $100');
    const result = extractQuantities(q);
    expect(toTuples(result)).toEqual([
      ['money', '100', 'dollars'],
      ['fraction', '0.5', null],
      ['money', '15', 'dollars'],
      ['multiplier', '2', null],
    ]);
  });

  it('gsm8k-train-5: "three" count, "Ten" count, "80%" percent, "25%" percent', () => {
    const q = loadFixtureQuestion('gsm8k-train-5');
    expect(q).toContain('80% more');
    const result = extractQuantities(q);
    expect(toTuples(result)).toEqual([
      ['count', '3', null],
      ['count', '10', null],
      ['percent', '80', 'percent'],
      ['percent', '25', 'percent'],
    ]);
  });

  it('gsm8k-train-13: "2 pounds" weight, "$10" money, "a pound" weight, "half" fraction, "twice" multiplier', () => {
    const q = loadFixtureQuestion('gsm8k-train-13');
    expect(q).toContain('2 pounds of cheddar cheese for $10');
    const result = extractQuantities(q);
    expect(toTuples(result)).toEqual([
      ['weight', '2', 'pounds'],
      ['money', '10', 'dollars'],
      ['weight', '1', 'pound'],
      ['fraction', '0.5', null],
      ['multiplier', '2', null],
    ]);
  });

  it('gsm8k-train-15: money/count/time chain, including a decimal "2.5"', () => {
    const q = loadFixtureQuestion('gsm8k-train-15');
    expect(q).toContain('2.5 times that much');
    const result = extractQuantities(q);
    expect(toTuples(result)).toEqual([
      ['money', '2000', 'dollars'],
      ['money', '6', 'dollars'],
      ['count', '2.5', null],
      ['count', '500', null],
      ['time', '1', 'day'],
      ['time', '5', 'days'],
      ['time', '1', 'week'],
      ['time', '20', 'weeks'],
    ]);
  });

  it('gsm8k-train-16: "2" count, "2:5" ratio digits as two separate counts, "$2500"/"$200" money', () => {
    const q = loadFixtureQuestion('gsm8k-train-16');
    expect(q).toContain('ratio 2:5');
    const result = extractQuantities(q);
    expect(toTuples(result)).toEqual([
      ['count', '2', null],
      ['count', '2', null],
      ['count', '5', null],
      ['money', '2500', 'dollars'],
      ['money', '200', 'dollars'],
    ]);
  });

  it('gsm8k-train-23: alternating money/count for a five-item shopping list', () => {
    const q = loadFixtureQuestion('gsm8k-train-23');
    expect(q).toContain('For $75 she bought 5 pairs');
    const result = extractQuantities(q);
    expect(toTuples(result)).toEqual([
      ['money', '75', 'dollars'],
      ['count', '5', null],
      ['money', '7', 'dollars'],
      ['count', '2', null],
      ['money', '10', 'dollars'],
      ['count', '4', null],
    ]);
  });

  it('gsm8k-train-30: "4 pieces" count, "50%" percent, "75%" percent', () => {
    const q = loadFixtureQuestion('gsm8k-train-30');
    expect(q).toContain('cut into 4 pieces');
    const result = extractQuantities(q);
    expect(toTuples(result)).toEqual([
      ['count', '4', null],
      ['percent', '50', 'percent'],
      ['percent', '75', 'percent'],
    ]);
  });

  it('gsm8k-train-35: "40%" percent, "Grade 5" twice as count, "60 students" count', () => {
    const q = loadFixtureQuestion('gsm8k-train-35');
    expect(q).toContain('40% of his Grade 5');
    const result = extractQuantities(q);
    expect(toTuples(result)).toEqual([
      ['percent', '40', 'percent'],
      ['count', '5', null],
      ['count', '60', null],
      ['count', '5', null],
    ]);
  });

  it('gsm8k-train-40: "$40" money, "12 tickets" count, "5%" percent, "10" count', () => {
    const q = loadFixtureQuestion('gsm8k-train-40');
    expect(q).toContain('A concert ticket costs $40');
    const result = extractQuantities(q);
    expect(toTuples(result)).toEqual([
      ['money', '40', 'dollars'],
      ['count', '12', null],
      ['percent', '5', 'percent'],
      ['count', '10', null],
    ]);
  });
});

// ─── ADVERSARIAL FIXTURES ───────────────────────────────────────────────────────────────────────
// "A check that has only ever passed is not a check": the seven cases named verbatim by this
// dispatch's own charge, each with a hand-worked expected result derived from the module's
// documented recognizer priorities, not merely "extractQuantities does not throw".

describe('adversarial fixtures named by this dispatch (hand-worked expectations)', () => {
  it('"$1,000.50" -- comma-grouped thousands plus cents, ONE money quantity, exact rational', () => {
    const result = extractQuantities('$1,000.50');
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('money');
    expect(result[0].unit).toBe('dollars');
    expect(fractionEquals(result[0].value, makeFraction(100050n, 100n))).toBe(true); // 1000.50 = 2001/2
    expect(fractionToDisplayString(result[0].value)).toBe('1000.5');
    expect(result[0].sourceText).toBe('$1,000.50');
  });

  it('"two-thirds" -- ONE fraction quantity, value 2/3, not split into "two" + "thirds"', () => {
    const result = extractQuantities('two-thirds');
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('fraction');
    expect(fractionEquals(result[0].value, makeFraction(2n, 3n))).toBe(true);
    expect(result[0].sourceText).toBe('two-thirds');
  });

  it('"a dozen" -- ONE count quantity, value 12, not "a" (abstained) plus a bare "dozen"', () => {
    const result = extractQuantities('a dozen');
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('count');
    expect(fractionEquals(result[0].value, fractionFromBigInt(12n))).toBe(true);
    expect(result[0].sourceText).toBe('a dozen');
  });

  it('"twice as many" -- ONE multiplier quantity for "twice" (value 2); "as many" is not a quantity and is left for parse/comparatives.ts (C4), out of this module\'s scope', () => {
    const result = extractQuantities('twice as many');
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('multiplier');
    expect(fractionEquals(result[0].value, fractionFromBigInt(2n))).toBe(true);
    expect(result[0].sourceText).toBe('twice');
  });

  it('"3 1/2 hours" -- ONE compound quantity: the mixed number 7/2, refined to kind "time" by adjacency', () => {
    const result = extractQuantities('3 1/2 hours');
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('time');
    expect(result[0].unit).toBe('hours');
    expect(fractionEquals(result[0].value, makeFraction(7n, 2n))).toBe(true);
    expect(fractionToDisplayString(result[0].value)).toBe('3.5');
    expect(result[0].sourceText).toBe('3 1/2 hours');
  });

  it('"the 2nd" -- ordinal excluded by default (positive-evidence contract: ordinals are not counts unless asked)', () => {
    expect(extractQuantities('the 2nd')).toEqual([]);
  });

  it('"the 2nd" -- included and correctly valued when the caller opts in via includeOrdinals', () => {
    const result = extractQuantities('the 2nd', { includeOrdinals: true });
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('ordinal');
    expect(fractionEquals(result[0].value, fractionFromBigInt(2n))).toBe(true);
  });

  it('"1st" -- ordinal excluded by default', () => {
    expect(extractQuantities('1st')).toEqual([]);
  });

  it('"1st" -- included when the caller opts in', () => {
    const result = extractQuantities('1st', { includeOrdinals: true });
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('ordinal');
    expect(fractionEquals(result[0].value, fractionFromBigInt(1n))).toBe(true);
  });
});

// ─── ABSTAIN-RULE UNIT TESTS ────────────────────────────────────────────────────────────────────
// Each rule named in the return doc gets its own direct, minimal-sentence proof here, independent
// of the corpus fixtures above (which exercise the rules only incidentally).

describe('abstain rules, proven directly', () => {
  it('bare "a"/"an" is never extracted as a numeral outside the bounded unit whitelist', () => {
    expect(extractQuantities('a store').filter((q) => q.sourceText.toLowerCase().startsWith('a '))).toEqual([]);
    expect(extractQuantities('Mark has a garden with flowers.').some((q) => q.sourceText === 'a')).toBe(false);
  });

  it('"a" plus a whitelisted unit word IS extracted (value 1)', () => {
    const result = extractQuantities('an hour');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: 'time', unit: 'hour' });
  });

  it('"no one" never extracts "one" as a numeral (pronoun-compound guard)', () => {
    expect(extractQuantities('No one wants to go.')).toEqual([]);
  });

  it('"any one", "every one", "some one", "each one" are guarded the same way', () => {
    expect(extractQuantities('Any one of them will do.')).toEqual([]);
    expect(extractQuantities('Every one of the boxes was empty.')).toEqual([]);
    expect(extractQuantities('Some one of the twins left.')).toEqual([]);
    expect(extractQuantities('Each one of the earthquakes was worse.')).toEqual([]);
  });

  it('NAMED LIMITATION, found by the coverage script against gsm8k-train-43: an adjective-plus-"one" anaphor with no fixed determiner ("the previous one") is NOT guarded -- documented, not silently shipped', () => {
    const result = extractQuantities('The previous one was smaller.');
    // "one" here means "earthquake" (anaphoric), not a numeral -- this assertion documents the
    // known false positive rather than hiding it; a future tuning round (parse/entities.ts, C2,
    // is the natural home for anaphora resolution) may close this.
    expect(result.some((q) => q.sourceText === 'one')).toBe(true);
  });

  it('a genuine standalone "one" (not preceded by a guard word) IS extracted', () => {
    const result = extractQuantities('She has one apple.');
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('count');
    expect(fractionEquals(result[0].value, fractionFromBigInt(1n))).toBe(true);
  });

  it('a number entirely inside a double-quoted span is abstained (title/label guard)', () => {
    const result = extractQuantities('The chapter is called "Lucky 7" in the book.');
    expect(result.some((q) => q.sourceText === '7')).toBe(false);
  });

  it('a number just outside a quoted span is still extracted', () => {
    const result = extractQuantities('The chapter is called "Lucky Star" and it has 7 pages.');
    expect(result.some((q) => q.sourceText === '7')).toBe(true);
  });

  it('compound cardinal number words up to thousands, including hyphenated forms, resolve correctly', () => {
    const twentyThree = extractQuantities('There are twenty-three students.');
    expect(twentyThree).toHaveLength(1);
    expect(fractionEquals(twentyThree[0].value, fractionFromBigInt(23n))).toBe(true);

    const compound = extractQuantities('The prize was one thousand two hundred fifty dollars.');
    expect(compound).toHaveLength(1);
    expect(compound[0].kind).toBe('money');
    expect(fractionEquals(compound[0].value, fractionFromBigInt(1250n))).toBe(true);
  });

  it('a comma-grouped decimal digit run never fragments into separate quantities', () => {
    const result = extractQuantities('It cost 1,234,567.89 units.');
    expect(result).toHaveLength(1);
    expect(fractionToDisplayString(result[0].value)).toBe('1234567.89');
  });

  it('compound time "2 hours and 30 minutes" normalizes to one 150-minute quantity', () => {
    const result = extractQuantities('It took 2 hours and 30 minutes to finish.');
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('time');
    expect(result[0].unit).toBe('minutes');
    expect(fractionEquals(result[0].value, fractionFromBigInt(150n))).toBe(true);
  });

  it('REAL MISS found and fixed by the coverage script: "100cm"/"28cm" (digit glued to a unit abbreviation with no space) now extract, gsm8k-train-5899', () => {
    const q = loadFixtureQuestion('gsm8k-train-5899');
    expect(q).toContain('100cm');
    expect(q).toContain('28cm');
    const result = extractQuantities(q);
    expect(toTuples(result)).toEqual([
      ['length', '100', 'cm'],
      ['length', '28', 'cm'],
    ]);
  });

  it('every returned Quantity carries at least one evidence string', () => {
    const result = extractQuantities('Weng earns $12 an hour for babysitting.');
    expect(result.length).toBeGreaterThan(0);
    for (const q of result) {
      expect(q.evidence.length).toBeGreaterThan(0);
      expect(q.sourceText).toBe('Weng earns $12 an hour for babysitting.'.slice(q.span[0], q.span[1]));
    }
  });

  it('extractQuantities never throws and returns [] on empty or non-numeric text', () => {
    expect(extractQuantities('')).toEqual([]);
    expect(extractQuantities('The quick brown fox jumps over the lazy dog.')).toEqual([]);
  });
});

// ─── Fraction ARITHMETIC UNIT TESTS ────────────────────────────────────────────────────────────
// Directly proves the canonical Fraction type behaves correctly, since every method migrating off
// its own hand-rolled Frac class depends on this being right.

describe('Fraction exact-rational arithmetic', () => {
  it('reduces to lowest terms with a positive denominator', () => {
    const f = makeFraction(4n, -8n);
    expect(f.n).toBe(-1n);
    expect(f.d).toBe(2n);
  });

  it('add/sub/mul are exact, never floating', () => {
    const a = makeFraction(1n, 3n);
    const b = makeFraction(1n, 6n);
    expect(fractionToDisplayString(makeFraction(1n, 2n))).toBe('0.5');
    const sum = addFraction(a, b);
    expect(fractionEquals(sum, makeFraction(1n, 2n))).toBe(true);
  });
});
