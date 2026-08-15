// category_parse_gate.test.ts -- D-BP154-063/BISHOP-SEG/S52/seg-wiregate
//
// FAIL-BEFORE / PASS-AFTER for THE ONE SHARED CATEGORY-PARSE GATE. Every qid-shaped test below
// reproduces the EXACT stem text read live from resources/mmlu_pro_bundled/questions.jsonl this
// dispatch (never retyped from memory) -- these are the fail-before cases: before this file
// existed, softballs_step.ts's/discriminator_step.ts's/human_nuance_step.ts's own THREE DUPLICATE
// regexes (`/following\s+([a-z][a-z\s]*?)\s+(?:is|are)\b/i`) either matched garbage (qid 79,
// crossing into an embedded quoted passage) or returned null for a stem an honest reader can see
// has a real category (qid 46, qid 124).
//
// MECHANISM TEST THROUGHOUT (FD-BP153-06/HARDWIRE-22): the invented-vocabulary block proves no
// rule keys on a specific question's real words -- same standard human_nuance_step.test.ts's own
// Zorblatt/Fignorp fixtures already hold this session to.

import { describe, test, expect } from 'vitest';
import { parseFollowingCategory } from './category_parse_gate';

describe('parseFollowingCategory -- the already-working shape (qid 98), no regression', () => {
  test('verb-anchored "following X is" -- unchanged from the old regex', () => {
    const r = parseFollowingCategory("Which of the following world regions is NOT considered one of the world's most densely populated regions?");
    expect(r.category).toBe('world regions');
  });
});

describe('parseFollowingCategory -- the 15-of-20 case: no "following" clause at all is honest INAPPLICABLE', () => {
  test('qid 20 shape -- a word problem, no "following" anywhere', () => {
    const r = parseFollowingCategory('Mr.Scaccioborrows $100 from his credit union and agrees to pay back $20 a month with interest of 1% per month on the unpaid balance. How much does he pay?');
    expect(r.category).toBeNull();
    expect(r.reason).toMatch(/INAPPLICABLE -- no "following" clause/);
  });

  test('qid 105 shape -- direct recall, no "following" anywhere', () => {
    const r = parseFollowingCategory('In Aristotle’s terminology, incontinence is when:');
    expect(r.category).toBeNull();
    expect(r.reason).toMatch(/INAPPLICABLE -- no "following" clause/);
  });

  test('a plain control question (pre-existing fixture every sibling test file already used)', () => {
    const r = parseFollowingCategory('What is the capital of France?');
    expect(r.category).toBeNull();
    expect(r.reason).toMatch(/INAPPLICABLE -- no "following" clause/);
  });
});

describe('parseFollowingCategory -- the 4 genuine near-misses, reproduced from the real corpus text', () => {
  test('qid 1 -- FAIL-BEFORE: old regex found no match (no is/are anywhere). PASS-AFTER: still correctly INAPPLICABLE -- "following" is followed immediately by "would", an auxiliary, not a noun; there is no category to capture, this was never a parser bug', () => {
    const r = parseFollowingCategory('Which of the following would most likely provide examples of mitotic cell divisions?');
    expect(r.category).toBeNull();
    expect(r.reason).toMatch(/no identifiable category noun/);
  });

  test('qid 46 -- FAIL-BEFORE: old regex found no match ("represent" is not is|are). PASS-AFTER: widened linking-verb set finds "economic events"', () => {
    const r = parseFollowingCategory("Indicate whether the following economic events represent a change in supply or a change in quantity supplied. a) Cold weather in Florida destroys a great deal of the orange crop. Therefore there are fewer oranges in the country's supermarkets. b) The cost of limes increase. As a result, bar owners raise the price of gin and tonics. c) The price of leather shoes goes up. This induces manufacturers of leather shoes to increase production.");
    expect(r.category).toBe('economic events');
  });

  test('qid 79 -- FAIL-BEFORE: old regex found no match at all (measured -- its char class cannot cross the period after "information", so it never reaches "are" in the Bacon quote either). PASS-AFTER: the question\'s own LAST "following" clause ("...following changes?") is tried first and succeeds, so the earlier "the following information" reference preamble is never even reached', () => {
    const r = parseFollowingCategory('This question refers to the following information.\n"XI. As the present sciences are useless for the discovery of effects, so the present system of logic is useless for the discovery of the sciences.\nXIX. There are and can exist but two ways of investigating and discovering truth."\nFrancis Bacon, English philosopher and essayist, Novum Organum, 1620\nBy the 1800s, the method of empirical reasoning reflected in the passage had undergone which of the following changes?');
    expect(r.category).toBe('changes');
  });

  test('qid 124 -- FAIL-BEFORE: old regex found no match (no is/are at all). PASS-AFTER: the verb-less, clause-final branch captures the noun phrase, "of ..." tail included for free', () => {
    const r = parseFollowingCategory('People who are able to be hypnotized easily are likely to score high on which of the following dimensions of the big five personality traits?');
    expect(r.category).toBe('dimensions of the big five personality traits');
  });

  test('qid 33 (found by the live standing-20 sweep itself, not the hand-reproduced 4) -- the verb-less branch must truncate at a MID-PHRASE clause-verb marker ("will"), not just check the head word, or the category becomes a run-on including the verb phrase', () => {
    const r = parseFollowingCategory('Two lists, list1 and list2, contain the names of books found in two different collections. The following procedures are available to create newList. Which of the following code segments will correctly create newList?');
    expect(r.category).toBe('code segments');
  });
});

describe('parseFollowingCategory -- "following information" must still FAIL as a category on its own (D-BP154-063 bullet 3: getting this wrong IS widening a gate to force a pass)', () => {
  test('a reference preamble that is the ONLY "following" clause in the question is still rejected, not accepted as a category', () => {
    const r = parseFollowingCategory('This item refers to the following information. Read it carefully before answering.');
    expect(r.category).toBeNull();
  });

  test('"following passage"/"following text"/"following data" -- the whole blocklist, not just "information"', () => {
    expect(parseFollowingCategory('Refer to the following passage before answering.').category).toBeNull();
    expect(parseFollowingCategory('Study the following text.').category).toBeNull();
    expect(parseFollowingCategory('Consider the following data.').category).toBeNull();
  });
});

describe('parseFollowingCategory -- invented vocabulary (FD-BP153-06/HARDWIRE-22: no rule keys on a real question)', () => {
  test('verb-anchored, widened verb ("represent") on invented nouns', () => {
    const r = parseFollowingCategory('Indicate whether the following Zorblatt readings represent a Fignorp surge or a Quexil decline.');
    expect(r.category).toBe('Zorblatt readings');
  });

  test('verb-less, clause-final, "of"-extended noun on invented nouns', () => {
    const r = parseFollowingCategory('A subject prone to Wibbleism is likely to score high on which of the following facets of the Drenvale taxonomy?');
    expect(r.category).toBe('facets of the Drenvale taxonomy');
  });

  test('invented reference-preamble decoy is still rejected, invented real category clause still wins', () => {
    const r = parseFollowingCategory('This item refers to the following information. "Some invented passage full of is and are and represent words that must never be captured." Which of the following Zabbrik clusters is NOT considered a Fignorp cluster?');
    expect(r.category).toBe('Zabbrik clusters');
  });

  test('invented auxiliary-headed decoy ("following would...") stays INAPPLICABLE -- no noun to capture, same as qid 1', () => {
    const r = parseFollowingCategory('Which of the following would most likely trigger a Wobsy resonance?');
    expect(r.category).toBeNull();
  });
});
