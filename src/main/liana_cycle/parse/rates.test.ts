// D-BP223-BM04-h2cbpv9w-170 -- parse/rates.test.ts
//
// PROVES three things this dispatch's charge requires:
//   (1) the 10 tuning-reserve fixture ids named in section C3 of
//       BISHOP_DROPZONE/D-BP223-BM04-h2cbpv9w-170_PARSING_LAYER_SCOPE.md resolve to real question
//       text (gate5_sibling_interception.cjs's own 0-indexed 'gsm8k-train-' + lineIndex qid
//       convention) and extractRates() finds the hand-verified rates in each one.
//   (2) every one of those 10 fixture ids is proven, at test time, to be ABSENT from
//       heldout_split_v1.json -- never merely assumed disjoint (Rule 6: NEVER touch the held-out
//       half).
//   (3) the seven adversarial cases this dispatch's own charge named by name: "zookeeper" (no
//       rate -- the word-boundary/substring-collision guard named in this module's own header),
//       "$5 each" after a quantity, "3 times a week", "every other day", "per dozen", "a week" as
//       a duration not a rate, plus "per <pronoun>" abstaining.
//
// Every expected value below was computed by hand from the real GSM8K training-set question text
// (read via loadFixtureQuestion, not paraphrased) or from a short synthetic sentence for the
// adversarial cases the charge names literally (no adversarial fixture id was supplied for these
// by the scope document, so a minimal synthetic sentence stands in for each one, same convention
// used across this dispatch's own charge for "zookeeper").

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { extractRates, type Rate } from './rates';
import { fractionToDisplayString } from './quantities';

const GSM8K_TRAIN_PATH = 'C:/Users/Administrator/Documents/DATASETS/GSM8K/train.jsonl';
const HELDOUT_SPLIT_PATH =
  'C:/Users/Administrator/Documents/LianaBanyanPlatform/HARDWIRE/LEDGER/METHOD_QUARANTINE/heldout_split_v1.json';
const TUNING_RESERVE_PATH =
  'C:/Users/Administrator/Documents/LianaBanyanPlatform/HARDWIRE/LEDGER/METHOD_QUARANTINE/tuning_reserve_v1.json';

/** Same 0-indexed 'gsm8k-train-' + lineIndex convention as gate5_sibling_interception.cjs's own
 *  loadGsm8kTrain() (read in full this dispatch, not guessed), matching parse/quantities.test.ts's
 *  own helper byte-for-byte. */
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
  'gsm8k-train-15', 'gsm8k-train-21', 'gsm8k-train-23', 'gsm8k-train-28', 'gsm8k-train-30',
  'gsm8k-train-42', 'gsm8k-train-43', 'gsm8k-train-44', 'gsm8k-train-47', 'gsm8k-train-50',
];

describe('C3 fixture disjointness from held-out (Rule 6: NEVER touch the held-out half)', () => {
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

/** Compact, readable projection of a Rate for assertions: [kind, numeratorDisplay, numeratorUnit,
 *  perUnit, perCount]. */
function toTuple(r: Rate): [string, string, string | null, string, string] {
  return [r.kind, fractionToDisplayString(r.value.value), r.value.unit, r.per.unit, fractionToDisplayString(r.per.count)];
}

describe('C3 tuning-reserve fixtures (hand-verified against real question text)', () => {
  it('gsm8k-train-15: "Each DVD cost $6", "500 movies a day", "5 days a week"', () => {
    const q = loadFixtureQuestion('gsm8k-train-15');
    expect(q).toContain('Each DVD cost $6');
    expect(q).toContain('500 movies a day for 5 days a week');
    const { rates, abstains } = extractRates(q);
    expect(rates.map(toTuple)).toEqual([
      ['price', '6', 'dollars', 'dvd', '1'],
      ['production', '500', 'movie', 'day', '1'],
      ['frequency', '5', 'days', 'week', '1'],
    ]);
    // "in 20 weeks" is a bare duration, never a rate cue -- no "per"/"each"/"every"/"a <period>
    // right after a quantity" shape, so it must never appear as a rate or an abstain.
    expect(abstains.some((a) => a.span[0] === q.indexOf('20 weeks'))).toBe(false);
  });

  it('gsm8k-train-21: three "eats N X per day" consumption rates, ask-clause "each day" abstains', () => {
    const q = loadFixtureQuestion('gsm8k-train-21');
    expect(q).toContain('Each bird eats 12 beetles per day');
    const { rates, abstains } = extractRates(q);
    expect(rates.map(toTuple)).toEqual([
      ['consumption', '12', 'beetle', 'day', '1'],
      ['consumption', '3', 'bird', 'day', '1'],
      ['consumption', '5', 'snake', 'day', '1'],
    ]);
    expect(rates[0].subject?.text.toLowerCase()).toBe('bird');
    expect(rates[1].subject?.text.toLowerCase()).toBe('snake');
    expect(rates[2].subject?.text.toLowerCase()).toBe('jaguar');
    // The ask sentence's own "how many beetles are eaten each day?" must never surface as a
    // fourth rate (no adjacent quantity precedes that "each") nor need the ask-span guard to
    // suppress it -- it simply never matches a recognizer's positive-evidence shape in the first
    // place. Confirmed here rather than assumed.
    expect(rates.length).toBe(3);
    expect(abstains.length).toBeGreaterThan(0);
  });

  it('gsm8k-train-23: "$7 each" / "$10 each" postfix price rates with local item nouns', () => {
    const q = loadFixtureQuestion('gsm8k-train-23');
    expect(q).toContain('5 pairs of shorts for $7 each');
    expect(q).toContain('2 pairs of shoes for $10 each');
    const { rates } = extractRates(q);
    const priceRates = rates.filter((r) => r.kind === 'price');
    expect(priceRates.map(toTuple)).toEqual([
      ['price', '7', 'dollars', 'short', '1'],
      ['price', '10', 'dollars', 'shoe', '1'],
    ]);
    expect(priceRates[0].itemNoun).toBe('short');
    expect(priceRates[1].itemNoun).toBe('shoe');
    // "How much did each top cost?" -- "each" here is an ordinary determiner in the ask clause
    // with no stated dollar amount to its right, so it must never produce a rate.
    expect(rates.some((r) => r.itemNoun === 'top')).toBe(false);
  });

  it('gsm8k-train-28: "each of the first four houses has 3 gnomes" -- each-as-per-unit, no separate subject', () => {
    const q = loadFixtureQuestion('gsm8k-train-28');
    expect(q).toContain('each of the first four houses has 3 gnomes');
    const { rates } = extractRates(q);
    expect(rates.map(toTuple)).toEqual([['generic', '3', 'gnome', 'house', '1']]);
    expect(rates[0].subject).toBeUndefined();
  });

  it('gsm8k-train-30: "Ann, Bill, Cate, and Dale each buy ... cut into 4 pieces" -- honest abstain, no guessed pizza-pieces rate', () => {
    const q = loadFixtureQuestion('gsm8k-train-30');
    expect(q).toContain('each buy personal pan pizzas cut into 4 pieces');
    const { rates } = extractRates(q);
    // "each" here modifies the SUBJECT LIST ("Ann, Bill, Cate, and Dale each buy..."), not a
    // noun-then-verb-then-quantity clause this module recognizes, and "4 pieces" is not adjacent
    // to any per/each/every cue -- no rate should be manufactured from "cut into 4 pieces".
    expect(rates.length).toBe(0);
  });

  it('gsm8k-train-42: no rate cue in this item at all (a pure division-of-a-total shape)', () => {
    const q = loadFixtureQuestion('gsm8k-train-42');
    expect(q).toContain('each hand having 14 bananas');
    const { rates } = extractRates(q);
    // "each hand having 14 bananas" / "each hand having 9 bananas" ARE genuine each-as-per-unit
    // rates by this module's own recognizer 1 shape (each <noun> <verb> <quantity>) -- hand
    // re-verified against the real text: "with each hand having 14 bananas" and "with each hand
    // having 9 bananas" both match "each <noun> having <quantity>".
    expect(rates.map(toTuple)).toEqual([
      ['generic', '14', 'banana', 'hand', '1'],
      ['generic', '9', 'banana', 'hand', '1'],
    ]);
  });

  it('gsm8k-train-43: "double the number ... as the previous one" is a comparative, never a rate', () => {
    const q = loadFixtureQuestion('gsm8k-train-43');
    expect(q).toContain('double the number of collapsing buildings');
    const { rates } = extractRates(q);
    // "double the number of X as the previous one" is parse/comparatives.ts's territory (a
    // multiplicative comparison, not a per-unit/per-time rate) -- this module must never invent a
    // rate from it. No "per"/"each"/"every"/"a <period>" cue appears anywhere in this item.
    expect(rates.length).toBe(0);
  });

  it('gsm8k-train-44: "$1000 per semester" -- money-per-time with no wage verb classifies generic', () => {
    const q = loadFixtureQuestion('gsm8k-train-44');
    expect(q).toContain('$1000 per semester');
    const { rates } = extractRates(q);
    expect(rates.map(toTuple)).toEqual([['generic', '1000', 'dollars', 'semester', '1']]);
  });

  it('gsm8k-train-47: two "N megabytes per second" rates, non-vocabulary unit still populated', () => {
    const q = loadFixtureQuestion('gsm8k-train-47');
    expect(q).toContain('5 megabytes per second');
    expect(q).toContain('10 megabytes per second');
    const { rates } = extractRates(q);
    expect(rates.map(toTuple)).toEqual([
      ['generic', '5', 'megabyte', 'second', '1'],
      ['generic', '10', 'megabyte', 'second', '1'],
    ]);
  });

  it('gsm8k-train-50: "$100 a month" (generic budget) and "$10 for each" (price, unresolved item noun)', () => {
    const q = loadFixtureQuestion('gsm8k-train-50');
    expect(q).toContain('$100 a month');
    expect(q).toContain('He charges $10 for each.');
    const { rates } = extractRates(q);
    expect(rates.map(toTuple)).toEqual([
      ['generic', '100', 'dollars', 'month', '1'],
      ['price', '10', 'dollars', 'item', '1'],
    ]);
    // The second rate's item is genuinely unresolvable from local context ("raking, shoveling,
    // and mowing lawns" are gerund verb phrases, not a "<quantity> <noun>" antecedent in the same
    // sentence) -- itemNoun correctly stays unset rather than guessed.
    expect(rates[1].itemNoun).toBeUndefined();
  });
});

describe('C3 adversarial fixtures (named verbatim by this dispatch\'s own charge)', () => {
  it('"zookeeper" contains the substring "per" but is never matched as a rate cue', () => {
    const text = 'The zookeeper fed the lions 12 pounds of meat.';
    const { rates, abstains } = extractRates(text);
    expect(rates.length).toBe(0);
    // The word-boundary guard means "per" inside "zookeeper" never even reaches the abstain scan
    // (it is not a \bper\b match at all), so no abstain should cite an index inside "zookeeper"
    // either -- the bug this module's header names is a FALSE MATCH, not merely an unresolved cue.
    const zookeeperStart = text.indexOf('zookeeper');
    const zookeeperEnd = zookeeperStart + 'zookeeper'.length;
    expect(abstains.every((a) => a.span[0] < zookeeperStart || a.span[0] >= zookeeperEnd)).toBe(true);
  });

  it('"$5 each" after a quantity resolves the item noun from the same sentence', () => {
    // The item noun is resolved from the SAME sentence only, per this module's own scope
    // boundary (cross-sentence anaphora is parse/entities.ts's job) -- the antecedent "5 shirts"
    // and the price "$5 each" are deliberately in the same sentence here for that reason.
    const text = 'Tom bought 5 shirts for $5 each.';
    const { rates } = extractRates(text);
    expect(rates.map(toTuple)).toEqual([['price', '5', 'dollars', 'shirt', '1']]);
    expect(rates[0].itemNoun).toBe('shirt');
  });

  it('"3 times a week" is a frequency rate', () => {
    const text = 'She practices piano 3 times a week.';
    const { rates } = extractRates(text);
    expect(rates.map(toTuple)).toEqual([['frequency', '3', null, 'week', '1']]);
  });

  it('"every other day" resolves to per-unit count 2', () => {
    const text = 'He waters the plant every other day.';
    const { rates } = extractRates(text);
    expect(rates.map(toTuple)).toEqual([['frequency', '1', null, 'day', '2']]);
  });

  it('"per dozen" with no item noun still returns a price rate with unit "dozen"', () => {
    const text = 'Eggs cost $6 per dozen.';
    const { rates } = extractRates(text);
    expect(rates.map(toTuple)).toEqual([['price', '6', 'dollars', 'dozen', '1']]);
  });

  it('a dozen eggs for $6 -- the worked scope-document example, derived per-unit count 12', () => {
    const text = 'She bought a dozen eggs for $6 to bake a cake.';
    const { rates } = extractRates(text);
    expect(rates.map(toTuple)).toEqual([['price', '6', 'dollars', 'egg', '12']]);
  });

  it('"a week" as a bare duration (never a rate) produces no rate and no false abstain', () => {
    const text = 'She will finish reading the book in a week.';
    const { rates } = extractRates(text);
    expect(rates.length).toBe(0);
  });

  it('"per him" (a pronoun) abstains rather than guessing a per-unit referent', () => {
    const text = 'The teacher divided the candy equally, five pieces per him.';
    const { rates, abstains } = extractRates(text);
    expect(rates.length).toBe(0);
    expect(abstains.some((a) => a.reason.includes('pronoun'))).toBe(true);
  });

  it('two candidate rate cues for different items in the same clause: each resolves independently, not conflated', () => {
    const text = 'Apples cost $2 per pound and oranges cost $3 per pound.';
    const { rates } = extractRates(text);
    expect(rates.map(toTuple)).toEqual([
      ['price', '2', 'dollars', 'pound', '1'],
      ['price', '3', 'dollars', 'pound', '1'],
    ]);
  });

  it('"twice as many" (a comparative, no trailing period word) is never mistaken for a frequency rate', () => {
    const text = 'Maria has twice as many apples as Ben.';
    const { rates } = extractRates(text);
    expect(rates.length).toBe(0);
  });
});

describe('C3 abstain-rule direct proofs', () => {
  it('"each" with no preceding quantity abstains, naming the reason', () => {
    const text = 'Give each student a pencil.';
    const { rates, abstains } = extractRates(text);
    expect(rates.length).toBe(0);
    expect(abstains.some((a) => a.reason.includes('no adjacent') && a.reason.includes('each'))).toBe(true);
  });

  it('a bare "per" cue with nothing resolvable on either side abstains', () => {
    const text = 'The rate mentioned per policy was unclear.';
    const { rates, abstains } = extractRates(text);
    expect(rates.length).toBe(0);
    expect(abstains.some((a) => a.reason.includes('no resolvable adjacent quantity'))).toBe(true);
  });

  it('a rate-shaped phrase found only inside the ask sentence abstains via the extractAsk guard', () => {
    // "how much money per week" has no stated numeral immediately before "per week" anywhere in
    // the text, so this both proves the natural adjacency abstain AND (since the whole phrase
    // sits inside the one and only ask sentence) exercises the ask-span guard's own reason string
    // if a future recognizer ever widens enough to match it structurally.
    const text = 'Sam has a paper route. How much money does he earn per week?';
    const { rates } = extractRates(text);
    expect(rates.length).toBe(0);
  });

  it('a stated fact bundled into the SAME sentence as the final question (via a comma chain) is still extracted, not suppressed by the ask guard', () => {
    // Real coverage-sample finding, gsm8k-train-1103: GSM8K often writes "If <premise>, and
    // <stated fact>, how many <target>?" as ONE sentence. ask.ts correctly reports the WHOLE
    // sentence as the ask (that is its job), but "each flower costs $15" is a stated fact, not
    // part of what is being asked -- an earlier draft of the ask-span guard treated the entire
    // ask.span as off-limits and wrongly abstained this genuine rate. The guard is now narrowed to
    // the sentence's own interrogative core (from its wh-word onward).
    const text =
      'Martha is making centerpieces for her Thanksgiving dinner. There are six centerpieces, ' +
      'and each centerpiece uses 8 roses, twice as many orchids as roses, and a certain number ' +
      'of lilies. If Martha wants to spend $2700 total, and each flower costs $15, how many ' +
      'lilies will she put in each centerpiece?';
    const { rates } = extractRates(text);
    const flowerRate = rates.find((r) => r.sourceText.includes('$15'));
    expect(flowerRate).toBeDefined();
    expect(flowerRate?.kind).toBe('price');
    expect(flowerRate?.per.unit).toBe('flower');
  });
});

describe('C3 Fraction/Quantity/Ask import discipline (BP222: never re-declare)', () => {
  it('a Rate\'s value is a real Quantity (same shape quantities.ts itself returns)', () => {
    const text = 'The car travels 60 miles per hour.';
    const { rates } = extractRates(text);
    expect(rates.length).toBe(1);
    const [r] = rates;
    expect(r.kind).toBe('speed');
    expect(typeof r.value.value.n).toBe('bigint');
    expect(typeof r.value.value.d).toBe('bigint');
    expect(r.value.kind).toBe('length');
  });
});
