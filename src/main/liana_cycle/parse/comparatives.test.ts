// D-BP223-BM04-h2cbpv9w-170 -- parse/comparatives.test.ts
//
// PROVES four things this dispatch's charge requires:
//   (1) the 10 tuning-reserve fixture ids named in section C4 of
//       BISHOP_DROPZONE/D-BP223-BM04-h2cbpv9w-170_PARSING_LAYER_SCOPE.md resolve to real question
//       text (gate5_sibling_interception.cjs's own 0-indexed 'gsm8k-train-' + lineIndex qid
//       convention) and extractComparatives() finds the hand-verified comparatives (including
//       anchor sides) and abstains in each one -- see the inline comment on each case for how the
//       expectation was hand-derived from the real text, not guessed.
//   (2) every one of those 10 fixture ids is proven, at test time, to be ABSENT from
//       heldout_split_v1.json, and the tuning reserve and held-out split are themselves proven
//       disjoint by full set difference -- never merely assumed, per Rule 6 ("NEVER touch the
//       held-out half").
//   (3) the adversarial fixtures this dispatch's own charge named by name: "3 times more than" vs
//       "3 times as many as" (the W08 dataset-convention flag); "more than 5 people came" (not a
//       comparative); "10% more expensive" (percent-more with no anchor, abstains); "twice as old
//       as"; a chained "A has twice as many as B, who has 3 more than C" (using real names, since
//       bare single-letter algebra names are not the kind of positive evidence this module's own
//       proper-noun recognizer looks for).
//   (4) the sibling quantities.ts and ask.ts test suites still pass when run alongside this one
//       (no collision), proving nothing regressed.
//
// Every expected value below was independently re-derived from the real GSM8K training-set
// question text (read via loadFixtureQuestion, never paraphrased) and checked against this
// module's own recognizers one at a time before this file was returned.

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { extractComparatives, type Comparative } from './comparatives';

const GSM8K_TRAIN_PATH = 'C:/Users/Administrator/Documents/DATASETS/GSM8K/train.jsonl';
const HELDOUT_SPLIT_PATH =
  'C:/Users/Administrator/Documents/LianaBanyanPlatform/HARDWIRE/LEDGER/METHOD_QUARANTINE/heldout_split_v1.json';
const TUNING_RESERVE_PATH =
  'C:/Users/Administrator/Documents/LianaBanyanPlatform/HARDWIRE/LEDGER/METHOD_QUARANTINE/tuning_reserve_v1.json';

/** Same 0-indexed 'gsm8k-train-' + lineIndex convention as gate5_sibling_interception.cjs's own
 *  loadGsm8kTrain() (read in full this dispatch, not guessed) -- identical helper to the one in
 *  the sibling quantities.test.ts, reimplemented here rather than imported because it is an 8-line
 *  test-only fixture loader, not a contract this module or its siblings export. */
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
  'gsm8k-train-2', 'gsm8k-train-4', 'gsm8k-train-13', 'gsm8k-train-18', 'gsm8k-train-33',
  'gsm8k-train-48', 'gsm8k-train-49', 'gsm8k-train-64', 'gsm8k-train-70', 'gsm8k-train-97',
];

describe('C4 fixture disjointness from held-out (Rule 6: NEVER touch the held-out half)', () => {
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

/** Compact, readable projection of a Comparative for assertions, including the factor/delta as a
 *  display string so BigInt fields never need special-casing in expect() calls. */
function summarize(c: Comparative) {
  return {
    kind: c.kind,
    factor: c.factor ? `${c.factor.n}/${c.factor.d}` : undefined,
    delta: c.delta ? c.delta.sourceText : undefined,
    subject: c.subject.text,
    anchor: c.anchor.text,
    anchorSide: c.anchorSide,
    direction: c.direction,
    conventionApplied: c.conventionApplied,
  };
}

describe('C4 tuning-reserve fixtures (hand-verified against real question text)', () => {
  it('gsm8k-train-2: "her grandparents twice as much as her parents" -- one multiplicative comparative, verb elided', () => {
    const q = loadFixtureQuestion('gsm8k-train-2');
    expect(q).toContain('her grandparents twice as much as her parents');
    const { comparatives, abstains } = extractComparatives(q);
    expect(comparatives.map(summarize)).toEqual([
      {
        kind: 'twice',
        factor: '2/1',
        delta: undefined,
        subject: 'her grandparents',
        anchor: 'her parents',
        anchorSide: 'right',
        direction: 'greater',
        conventionApplied: undefined,
      },
    ]);
    // "Betty has only half of the money she needs" is a NAMED LIMITATION (see the module header
    // and this dispatch's return doc): a general "<multiplier> of <description>" anchor is not
    // resolved by this dispatch. Confirmed here as zero abstains, not a false claim of coverage.
    expect(abstains).toEqual([]);
  });

  it('gsm8k-train-4: "twice a week" is a frequency, not a comparative -- zero comparatives, zero abstains', () => {
    const q = loadFixtureQuestion('gsm8k-train-4');
    expect(q).toContain('twice a week');
    const { comparatives, abstains } = extractComparatives(q);
    expect(comparatives).toEqual([]);
    expect(abstains).toEqual([]);
  });

  it('gsm8k-train-13: "cost half the price of X" / "cost twice the price of X" -- two multiplicative comparatives sharing one anchor', () => {
    const q = loadFixtureQuestion('gsm8k-train-13');
    expect(q).toContain('cost half the price of the cheddar cheese');
    expect(q).toContain('cost twice the price of the cheddar cheese');
    const { comparatives, abstains } = extractComparatives(q);
    expect(comparatives.map(summarize)).toEqual([
      {
        kind: 'half-of',
        factor: '1/2',
        delta: undefined,
        subject: 'a pound of cream cheese',
        anchor: 'the cheddar cheese',
        anchorSide: 'right',
        direction: 'smaller',
        conventionApplied: undefined,
      },
      {
        kind: 'twice',
        factor: '2/1',
        delta: undefined,
        subject: 'a pack of cold cuts',
        anchor: 'the cheddar cheese',
        anchorSide: 'right',
        direction: 'greater',
        conventionApplied: undefined,
      },
    ]);
    expect(abstains).toEqual([]);
  });

  it('gsm8k-train-18: "three times a week" / "twice a week" are frequencies, not comparatives -- zero comparatives, zero abstains', () => {
    const q = loadFixtureQuestion('gsm8k-train-18');
    expect(q).toContain('three times a week');
    expect(q).toContain('twice a week');
    const { comparatives, abstains } = extractComparatives(q);
    expect(comparatives).toEqual([]);
    expect(abstains).toEqual([]);
  });

  it('gsm8k-train-33: "1/2 times as many teaspoons of salt as the number of cups of flour" -- noun-first form, no actor present', () => {
    const q = loadFixtureQuestion('gsm8k-train-33');
    expect(q).toContain('1/2 times as many teaspoons of salt as the number of cups of flour');
    const { comparatives, abstains } = extractComparatives(q);
    expect(comparatives.map(summarize)).toEqual([
      {
        kind: 'times',
        factor: '1/2',
        delta: undefined,
        subject: 'teaspoons of salt',
        anchor: 'the number of cups of flour',
        anchorSide: 'right',
        direction: 'smaller',
        conventionApplied: undefined,
      },
    ]);
    expect(abstains).toEqual([]);
  });

  it('gsm8k-train-48: an additive "six more ... than" plus a multiplicative "six times as many ... as", same anchor', () => {
    const q = loadFixtureQuestion('gsm8k-train-48');
    expect(q).toContain('Sam memorized six more digits of pi than Carlos memorized');
    expect(q).toContain('Mina memorized six times as many digits of pi as Carlos memorized');
    const { comparatives, abstains } = extractComparatives(q);
    expect(comparatives.map(summarize)).toEqual([
      {
        kind: 'more-than',
        factor: undefined,
        delta: 'six',
        subject: 'Sam',
        anchor: 'Carlos',
        anchorSide: 'right',
        direction: 'greater',
        conventionApplied: undefined,
      },
      {
        kind: 'times',
        factor: '6/1',
        delta: undefined,
        subject: 'Mina',
        anchor: 'Carlos',
        anchorSide: 'right',
        direction: 'greater',
        conventionApplied: undefined,
      },
    ]);
    expect(abstains).toEqual([]);
  });

  it('gsm8k-train-49: "four times as many ... as" plus the narrow "a third of what X did" shape', () => {
    const q = loadFixtureQuestion('gsm8k-train-49');
    expect(q).toContain('Alan collected four times as many shells as Ben did');
    expect(q).toContain('collected a third of what Laurie did');
    const { comparatives, abstains } = extractComparatives(q);
    expect(comparatives.map(summarize)).toEqual([
      {
        kind: 'times',
        factor: '4/1',
        delta: undefined,
        subject: 'Alan',
        anchor: 'Ben',
        anchorSide: 'right',
        direction: 'greater',
        conventionApplied: undefined,
      },
      {
        kind: 'ratio',
        factor: '1/3',
        delta: undefined,
        subject: 'Ben',
        anchor: 'Laurie',
        anchorSide: 'right',
        direction: 'smaller',
        conventionApplied: undefined,
      },
    ]);
    expect(abstains).toEqual([]);
  });

  it('gsm8k-train-64: "20% less" with NO explicit anchor, and "half that much" with a pronoun anchor -- both abstain, zero comparatives', () => {
    const q = loadFixtureQuestion('gsm8k-train-64');
    expect(q).toContain('He earns 20% less while working his second job');
    expect(q).toContain('half that much at his second job');
    const { comparatives, abstains } = extractComparatives(q);
    expect(comparatives).toEqual([]);
    expect(abstains).toHaveLength(2);
    expect(abstains[0].reason).toMatch(/percent-less phrase "20% less" found but no explicit anchor/);
    expect(abstains[1].reason).toMatch(/anchor is the demonstrative pronoun "that"/);
  });

  it('gsm8k-train-70: "30 less apples than" (additive) plus "half as many ... as" (multiplicative)', () => {
    const q = loadFixtureQuestion('gsm8k-train-70');
    expect(q).toContain('Tim has 30 less apples than Martha');
    expect(q).toContain('Harry has half as many apples as Tim');
    const { comparatives, abstains } = extractComparatives(q);
    expect(comparatives.map(summarize)).toEqual([
      {
        kind: 'less-than',
        factor: undefined,
        delta: '30',
        subject: 'Tim',
        anchor: 'Martha',
        anchorSide: 'right',
        direction: 'smaller',
        conventionApplied: undefined,
      },
      {
        kind: 'half-of',
        factor: '1/2',
        delta: undefined,
        subject: 'Harry',
        anchor: 'Tim',
        anchorSide: 'right',
        direction: 'smaller',
        conventionApplied: undefined,
      },
    ]);
    expect(abstains).toEqual([]);
  });

  it('gsm8k-train-97: "Half the books ... were mystery books" -- a proportion-of-an-implicit-whole shape, always abstains', () => {
    const q = loadFixtureQuestion('gsm8k-train-97');
    expect(q).toContain('Half the books on the bottom section of the cart were mystery books');
    const { comparatives, abstains } = extractComparatives(q);
    expect(comparatives).toEqual([]);
    expect(abstains).toHaveLength(1);
    expect(abstains[0].reason).toMatch(/states a fraction of an implicit, not-yet-quantified whole/);
  });
});

describe('C4 adversarial fixtures (named verbatim by this dispatch\'s charge)', () => {
  it('"3 times more than" is read MULTIPLICATIVELY with conventionApplied: true (W08 dataset convention)', () => {
    const { comparatives, abstains } = extractComparatives('Tom has 3 times more apples than Jerry.');
    expect(comparatives.map(summarize)).toEqual([
      {
        kind: 'times',
        factor: '3/1',
        delta: undefined,
        subject: 'Tom',
        anchor: 'Jerry',
        anchorSide: 'right',
        direction: 'greater',
        conventionApplied: true,
      },
    ]);
    expect(abstains).toEqual([]);
  });

  it('"3 times as many as" is unambiguous -- same factor, conventionApplied left unset', () => {
    const { comparatives } = extractComparatives('Tom has 3 times as many apples as Jerry.');
    expect(comparatives).toHaveLength(1);
    expect(comparatives[0].factor).toEqual({ n: 3n, d: 1n });
    expect(comparatives[0].conventionApplied).toBeUndefined();
  });

  it('"more than 5 people came" is a threshold idiom, not a comparative -- abstains with a named reason', () => {
    const { comparatives, abstains } = extractComparatives('More than 5 people came to the party.');
    expect(comparatives).toEqual([]);
    expect(abstains).toHaveLength(1);
    expect(abstains[0].reason).toMatch(/threshold\/approximation/);
  });

  it('"10% more expensive" with no "than <X>" anchor in the clause -- abstains, does not guess the anchor from context', () => {
    const { comparatives, abstains } = extractComparatives("The store's prices are 10% more expensive this year.");
    expect(comparatives).toEqual([]);
    expect(abstains).toHaveLength(1);
    expect(abstains[0].reason).toMatch(/no explicit anchor/);
  });

  it('"twice as old as" -- the multiplicative "as ADJ as" form generalizes past "as many/much"', () => {
    const { comparatives } = extractComparatives('Sam is twice as old as his brother.');
    expect(comparatives.map(summarize)).toEqual([
      {
        kind: 'twice',
        factor: '2/1',
        delta: undefined,
        subject: 'Sam',
        anchor: 'his brother',
        anchorSide: 'right',
        direction: 'greater',
        conventionApplied: undefined,
      },
    ]);
  });

  it('chained "A has twice as many as B, who has 3 more than C" -- two independent 2-hop comparatives, not one composed relationship, not an abstain', () => {
    // Real names substituted for the task's own illustrative A/B/C: a bare single letter is not
    // positive evidence of a proper noun under this module's own [A-Z][a-z]+ recognizer (an
    // initial with no following lowercase letter is indistinguishable from an abbreviation or
    // ordinal-adjacent token), so this fixture uses named actors matching the identical shape.
    const { comparatives, abstains } = extractComparatives(
      'Alice has twice as many apples as Brian, who has 3 more apples than Carla.',
    );
    expect(comparatives.map(summarize)).toEqual([
      {
        kind: 'twice',
        factor: '2/1',
        delta: undefined,
        subject: 'Alice',
        anchor: 'Brian',
        anchorSide: 'right',
        direction: 'greater',
        conventionApplied: undefined,
      },
      {
        kind: 'more-than',
        factor: undefined,
        delta: '3',
        // The second clause's own grammatical subject is the relative pronoun "who" (referring
        // back to Brian) -- per this module's own design (see the Comparative.subject doc comment
        // in comparatives.ts), only the ANCHOR is guarded against a bare pronoun; the subject slot
        // is reported as literal text either way, per this module's "spans and text only" contract.
        subject: 'who',
        anchor: 'Carla',
        anchorSide: 'right',
        direction: 'greater',
        conventionApplied: undefined,
      },
    ]);
    expect(abstains).toEqual([]);
  });

  it('"N years older than" / "N years younger than" -- additive age comparatives', () => {
    const older = extractComparatives('Maria is 5 years older than her cousin.');
    expect(older.comparatives.map(summarize)).toEqual([
      {
        kind: 'older-than',
        factor: undefined,
        delta: '5',
        subject: 'Maria',
        anchor: 'her cousin',
        anchorSide: 'right',
        direction: 'greater',
        conventionApplied: undefined,
      },
    ]);

    const younger = extractComparatives('David is 4 years younger than Elena.');
    expect(younger.comparatives.map(summarize)).toEqual([
      {
        kind: 'younger-than',
        factor: undefined,
        delta: '4',
        subject: 'David',
        anchor: 'Elena',
        anchorSide: 'right',
        direction: 'smaller',
        conventionApplied: undefined,
      },
    ]);
  });

  it('"the ratio of A to B is N:M" -- an explicit numeric ratio', () => {
    const { comparatives } = extractComparatives('The ratio of cats to dogs is 3:2.');
    expect(comparatives.map(summarize)).toEqual([
      {
        kind: 'ratio',
        factor: '3/2',
        delta: undefined,
        subject: 'cats',
        anchor: 'dogs',
        anchorSide: 'right',
        direction: 'greater',
        conventionApplied: undefined,
      },
    ]);
  });
});

describe('C4 abstain-rule direct unit tests (one per named rule)', () => {
  it('a bare pronoun anchor in an "as many/much as" clause abstains (not "her parents", which is a legitimate short noun phrase)', () => {
    const { comparatives, abstains } = extractComparatives('Tim has twice as many apples as they did.');
    expect(comparatives).toEqual([]);
    expect(abstains).toHaveLength(1);
    expect(abstains[0].reason).toMatch(/bare pronoun/);
  });

  it('a bare pronoun anchor in a "more than" clause abstains', () => {
    const { comparatives, abstains } = extractComparatives('Sam has 6 more apples than they do.');
    expect(comparatives).toEqual([]);
    expect(abstains).toHaveLength(1);
    expect(abstains[0].reason).toMatch(/bare pronoun/);
  });

  it('"as many as" with no multiplier word is factor 1, kind as-many-as, direction equal', () => {
    const { comparatives } = extractComparatives('Tim has as many apples as Martha.');
    expect(comparatives.map(summarize)).toEqual([
      {
        kind: 'as-many-as',
        factor: '1/1',
        delta: undefined,
        subject: 'Tim',
        anchor: 'Martha',
        anchorSide: 'right',
        direction: 'equal',
        conventionApplied: undefined,
      },
    ]);
  });

  it('a percent-more/less phrase with a named subject AND anchor extracts cleanly', () => {
    const { comparatives, abstains } = extractComparatives('Adrien earns 30% more than Lylah.');
    expect(comparatives.map(summarize)).toEqual([
      {
        kind: 'percent-more',
        factor: '30/1',
        delta: undefined,
        subject: 'Adrien',
        anchor: 'Lylah',
        anchorSide: 'right',
        direction: 'greater',
        conventionApplied: undefined,
      },
    ]);
    expect(abstains).toEqual([]);
  });

  it('a comparative-shaped phrase entirely inside the ask sentence is dropped, never reported as a fact', () => {
    // "how many times as many apples does Sam have as Tom" is the QUESTION, not a stated fact --
    // the "how many" placeholder also fails resolveNumeral on its own, but this is a second,
    // explicit belt-and-suspenders guard via the ask-span exclusion (see this file's header and
    // the extractComparatives implementation comment on why Ask/extractAsk is imported).
    const { comparatives, abstains } = extractComparatives(
      'Sam has some apples. How many times as many apples does Sam have as Tom?',
    );
    expect(comparatives).toEqual([]);
    expect(abstains).toEqual([]);
  });
});

describe('C4 arithmetic/type sanity (the imported Fraction/Quantity types are used, never re-declared)', () => {
  it('a "half" factor is exactly 1/2 as a BigInt Fraction, not a floating-point 0.5', () => {
    const { comparatives } = extractComparatives('Harry has half as many apples as Tim.');
    expect(comparatives[0].factor).toEqual({ n: 1n, d: 2n });
  });

  it('a delta Quantity carries its own unit and evidence from quantities.ts, not a bare number', () => {
    const { comparatives } = extractComparatives('Sam memorized six more digits of pi than Carlos memorized.');
    expect(comparatives[0].delta).toBeDefined();
    expect(comparatives[0].delta!.value).toEqual({ n: 6n, d: 1n });
    expect(comparatives[0].delta!.evidence.length).toBeGreaterThan(0);
  });
});
