// D-BP223-BM04-h2cbpv9w-170 / PARSE_ASK / seat BM04 -- tests for parse/ask.ts (module C5).
//
// FIXTURE PROVENANCE. The 10 tuning-reserve fixture ids below are the exact 10 named in
// PLATFORM/BISHOP_DROPZONE/D-BP223-BM04-h2cbpv9w-170_PARSING_LAYER_SCOPE.md section C5:
// gsm8k-train-{1,2,4,5,6,13,15,16,18,21}. Question text is resolved from
// DATASETS/GSM8K/train.jsonl by the SAME `qid = 'gsm8k-train-' + lineIndex` convention
// gate5_sibling_interception.cjs's own loadGsm8kTrain() uses (0-indexed line number = the
// trailing id number), read directly from that file this dispatch -- never guessed or
// paraphrased. DISJOINTNESS FROM THE HELD-OUT SPLIT: gate5_sibling_interception.cjs computes
// heldout vs. tuning by hashing each item's OWN qid through splitCorpus(HELDOUT_SPLIT_SEED,
// HELDOUT_RATIO) -- membership depends only on the qid string and the frozen seed/ratio, not on
// which ids a caller happens to ask for. This dispatch's own scratchpad coverage run (see the
// PARSE_ASK return doc) loaded PLATFORM/HARDWIRE/LEDGER/METHOD_QUARANTINE/tuning_reserve_v1.json
// directly and confirmed all 10 of these ids are present in that reserve file's own id list
// (never in heldout_split_v1.json, which was not read for this dispatch, per Rule 6 -- "NEVER
// touch the held-out half"), so disjointness rests on the frozen split file itself, not on an
// assertion made here.
//
// Every expected value below was hand-verified by a human-equivalent reading of the question
// text (not derived from the module under test), per this dispatch's "hand-verified expected Ask
// values" instruction.

import { describe, test, expect } from 'vitest';
import { extractAsk, explainAbstain } from './ask';

describe('extractAsk -- 10 tuning-reserve fixtures (parse/ask.ts, module C5)', () => {
  test('gsm8k-train-1: "How much did she earn?" -- how-much, actor "she", no entity named', () => {
    const text = 'Weng earns $12 an hour for babysitting. Yesterday, she just did 50 minutes of babysitting. How much did she earn?';
    const ask = extractAsk(text);
    expect(ask).not.toBeNull();
    expect(ask!.sentence).toBe('How much did she earn?');
    expect(text.slice(ask!.span[0], ask!.span[1])).toBe(ask!.sentence);
    expect(ask!.askType).toBe('how-much');
    expect(ask!.targetActor?.text).toBe('she');
    expect(ask!.otherAsks).toBeUndefined();
  });

  test('gsm8k-train-2: "How much more money does Betty need..." -- what-difference, entity "money", actor "Betty"', () => {
    const text = "Betty is saving money for a new wallet which costs $100. Betty has only half of the money she needs. Her parents decided to give her $15 for that purpose, and her grandparents twice as much as her parents. How much more money does Betty need to buy the wallet?";
    const ask = extractAsk(text);
    expect(ask).not.toBeNull();
    expect(ask!.sentence).toBe('How much more money does Betty need to buy the wallet?');
    expect(text.slice(ask!.span[0], ask!.span[1])).toBe(ask!.sentence);
    expect(ask!.askType).toBe('what-difference');
    expect(ask!.targetEntity?.text).toBe('money');
    expect(ask!.targetActor?.text).toBe('Betty');
  });

  test('gsm8k-train-4: "How many pages does he write a year?" -- how-many, entity "pages", actor "he", timeframe "a year"', () => {
    const text = 'James writes a 3-page letter to 2 different friends twice a week.  How many pages does he write a year?';
    const ask = extractAsk(text);
    expect(ask).not.toBeNull();
    expect(ask!.sentence).toBe('How many pages does he write a year?');
    expect(text.slice(ask!.span[0], ask!.span[1])).toBe(ask!.sentence);
    expect(ask!.askType).toBe('how-many');
    expect(ask!.targetEntity?.text).toBe('pages');
    expect(ask!.targetActor?.text).toBe('he');
    expect(ask!.timeframeHint).toBe('a year');
  });

  test('gsm8k-train-5: "How many flowers does Mark have in his garden?" -- how-many, entity "flowers", actor "Mark"', () => {
    const text = 'Mark has a garden with flowers. He planted plants of three different colors in it. Ten of them are yellow, and there are 80% more of those in purple. There are only 25% as many green flowers as there are yellow and purple flowers. How many flowers does Mark have in his garden?';
    const ask = extractAsk(text);
    expect(ask).not.toBeNull();
    expect(ask!.sentence).toBe('How many flowers does Mark have in his garden?');
    expect(ask!.askType).toBe('how-many');
    expect(ask!.targetEntity?.text).toBe('flowers');
    expect(ask!.targetActor?.text).toBe('Mark');
  });

  test('gsm8k-train-6: rhetorical "how much" mid-text is NOT the ask; the real ask is the closing question', () => {
    const text = 'Albert is wondering how much pizza he can eat in one day. He buys 2 large pizzas and 2 small pizzas. A large pizza has 16 slices and a small pizza has 8 slices. If he eats it all, how many pieces does he eat that day?';
    const ask = extractAsk(text);
    expect(ask).not.toBeNull();
    // The narration sentence ends in "." and does not open with an imperative verb, so it is
    // never an ask candidate at all -- confirmed by requiring the selected sentence, and every
    // recorded otherAsk (there are none here), to be the real closing question only.
    expect(ask!.sentence).toBe('If he eats it all, how many pieces does he eat that day?');
    expect(ask!.sentence).not.toContain('wondering');
    expect(ask!.askType).toBe('how-many');
    expect(ask!.targetEntity?.text).toBe('pieces');
    expect(ask!.targetActor?.text).toBe('he');
    expect(ask!.timeframeHint).toBe('that day');
    expect(ask!.otherAsks).toBeUndefined();
  });

  test('gsm8k-train-13: "How much does he spend on the ingredients?" -- how-much, actor "he"', () => {
    const text = 'Jasper will serve charcuterie at his dinner party. He buys 2 pounds of cheddar cheese for $10, a pound of cream cheese that cost half the price of the cheddar cheese, and a pack of cold cuts that cost twice the price of the cheddar cheese. How much does he spend on the ingredients?';
    const ask = extractAsk(text);
    expect(ask).not.toBeNull();
    expect(ask!.sentence).toBe('How much does he spend on the ingredients?');
    expect(ask!.askType).toBe('how-much');
    expect(ask!.targetActor?.text).toBe('he');
  });

  test('gsm8k-train-15: "How much profit does he make in 20 weeks?" -- how-much, entity "profit", actor "he", timeframe "in 20 weeks"', () => {
    const text = 'James creates a media empire.  He creates a movie for $2000.  Each DVD cost $6 to make.  He sells it for 2.5 times that much.  He sells 500 movies a day for 5 days a week.  How much profit does he make in 20 weeks?';
    const ask = extractAsk(text);
    expect(ask).not.toBeNull();
    expect(ask!.sentence).toBe('How much profit does he make in 20 weeks?');
    expect(text.slice(ask!.span[0], ask!.span[1])).toBe(ask!.sentence);
    expect(ask!.askType).toBe('how-much');
    expect(ask!.targetEntity?.text).toBe('profit');
    expect(ask!.targetActor?.text).toBe('he');
    expect(ask!.timeframeHint).toBe('in 20 weeks');
  });

  test('gsm8k-train-16: "how much will Mike have..." -- how-much, actor "Mike" (also proves the "2.5"-style decimal-adjacent sentence splitter is not confused by "2:5" ratio notation)', () => {
    const text = 'The profit from a business transaction is shared among 2 business partners, Mike and Johnson in the ratio 2:5 respectively. If Johnson got $2500, how much will Mike have after spending some of his share on a shirt that costs $200?';
    const ask = extractAsk(text);
    expect(ask).not.toBeNull();
    expect(ask!.sentence).toBe('If Johnson got $2500, how much will Mike have after spending some of his share on a shirt that costs $200?');
    expect(ask!.askType).toBe('how-much');
    expect(ask!.targetActor?.text).toBe('Mike');
  });

  test('gsm8k-train-18: "How many hours in total does he take..." -- how-many, entity "hours" with "in total" split into unitHint, actor "he", timeframe "a week"', () => {
    const text = 'It takes Roque two hours to walk to work and one hour to ride his bike to work. Roque walks to and from work three times a week and rides his bike to and from work twice a week. How many hours in total does he take to get to and from work a week with walking and biking?';
    const ask = extractAsk(text);
    expect(ask).not.toBeNull();
    expect(ask!.askType).toBe('how-many');
    expect(ask!.targetEntity?.text).toBe('hours');
    expect(ask!.unitHint).toBe('in total');
    expect(ask!.targetActor?.text).toBe('he');
    expect(ask!.timeframeHint).toBe('a week');
  });

  test('gsm8k-train-21: passive "how many beetles are eaten each day?" -- how-many, entity "beetles", NO actor (passive voice names none), unitHint "each"', () => {
    const text = 'Each bird eats 12 beetles per day, each snake eats 3 birds per day, and each jaguar eats 5 snakes per day. If there are 6 jaguars in a forest, how many beetles are eaten each day?';
    const ask = extractAsk(text);
    expect(ask).not.toBeNull();
    expect(ask!.sentence).toBe('If there are 6 jaguars in a forest, how many beetles are eaten each day?');
    expect(ask!.askType).toBe('how-many');
    expect(ask!.targetEntity?.text).toBe('beetles');
    expect(ask!.targetActor).toBeUndefined();
    expect(ask!.unitHint).toBe('each');
    expect(ask!.timeframeHint).toBe('each day');
  });
});

describe('extractAsk -- adversarial fixtures (self-authored, not tuning-reserve)', () => {
  test('two questions in one text: returns the LAST ask, records the first in otherAsks', () => {
    const text = 'How many apples does Sam have? How many oranges does Tom have?';
    const ask = extractAsk(text);
    expect(ask).not.toBeNull();
    expect(ask!.sentence).toBe('How many oranges does Tom have?');
    expect(ask!.targetEntity?.text).toBe('oranges');
    expect(ask!.targetActor?.text).toBe('Tom');
    expect(ask!.otherAsks).toHaveLength(1);
    expect(ask!.otherAsks![0].sentence).toBe('How many apples does Sam have?');
    expect(ask!.otherAsks![0].askType).toBe('how-many');
  });

  test('imperative with no question mark is a valid ask', () => {
    const text = 'Calculate how many apples remain after the sale.';
    const ask = extractAsk(text);
    expect(ask).not.toBeNull();
    expect(ask!.sentence).toBe('Calculate how many apples remain after the sale.');
    expect(ask!.askType).toBe('how-many');
    expect(ask!.sentence.endsWith('?')).toBe(false);
  });

  test('a rhetorical question mid-text is recorded as an EARLIER ask, never chosen as the ask itself', () => {
    const text = "Isn't it obvious? Tom has 5 apples. How many apples does Sam have?";
    const ask = extractAsk(text);
    expect(ask).not.toBeNull();
    expect(ask!.sentence).toBe('How many apples does Sam have?');
    expect(ask!.askType).toBe('how-many');
    expect(ask!.otherAsks).toHaveLength(1);
    expect(ask!.otherAsks![0].sentence).toBe("Isn't it obvious?");
    expect(ask!.otherAsks![0].askType).toBe('yes-no');
  });

  test('an ask about a percent classifies as what-percent, not how-much', () => {
    const text = 'A store had 200 items. 50 were sold. What percent of the items were sold?';
    const ask = extractAsk(text);
    expect(ask).not.toBeNull();
    expect(ask!.sentence).toBe('What percent of the items were sold?');
    expect(ask!.askType).toBe('what-percent');
  });

  test('an ask about "how many more" classifies as what-difference, not plain how-many', () => {
    const text = 'Sam has 5 apples. Tom has 8 apples. How many more apples does Tom have than Sam?';
    const ask = extractAsk(text);
    expect(ask).not.toBeNull();
    expect(ask!.sentence).toBe('How many more apples does Tom have than Sam?');
    expect(ask!.askType).toBe('what-difference');
    expect(ask!.targetActor?.text).toBe('Tom');
  });

  test('no interrogative and no imperative anywhere in the text: abstain with a reason', () => {
    const text = 'Sam has 5 apples. Tom has 8 apples. They are both happy.';
    const ask = extractAsk(text);
    expect(ask).toBeNull();
    const reason = explainAbstain(text);
    expect(reason).not.toBeNull();
    expect(reason).toContain('abstain');
  });

  test('empty/non-string input abstains rather than throwing', () => {
    expect(extractAsk('')).toBeNull();
    expect(extractAsk('   ')).toBeNull();
    // @ts-expect-error -- deliberately passing a non-string to prove the guard, matching the
    // defensive `typeof rawQuestion !== 'string'` check every existing method file opens with.
    expect(extractAsk(undefined)).toBeNull();
  });

  test('yes-no question is classified correctly and abstains on entity/actor beyond the subject', () => {
    const text = 'Sam has 5 apples. Does Sam have more than 3 apples?';
    const ask = extractAsk(text);
    expect(ask).not.toBeNull();
    expect(ask!.sentence).toBe('Does Sam have more than 3 apples?');
    expect(ask!.askType).toBe('yes-no');
    expect(ask!.targetActor?.text).toBe('Sam');
  });

  test('a question ending in a closing quote ("...full face?"") is still recognized as a question, not merged into narration', () => {
    const text = 'Wendy has 5 facial products she puts on in the morning and she waits 5 minutes between each product.  She also spends an additional 30 minutes putting on her make-up.  How much time does it take her to put on her "full face?"';
    const ask = extractAsk(text);
    expect(ask).not.toBeNull();
    expect(ask!.sentence).toBe('How much time does it take her to put on her "full face?"');
    expect(text.slice(ask!.span[0], ask!.span[1])).toBe(ask!.sentence);
    expect(ask!.askType).toBe('how-much');
  });

  test('a "how many" question missing its terminal "?" (a real GSM8K typo shape) is still recognized, not abstained on', () => {
    const text = 'Sidney has 4 kittens and 3 adult cats.  She has 7 cans of cat food.  Each adult cat eats 1 can of food per day.  Each kitten eats 3/4 of a can per day.  How many additional cans of food does Sidney need to buy to feed all of her animals for 7 days.';
    const ask = extractAsk(text);
    expect(ask).not.toBeNull();
    expect(ask!.sentence).toBe('How many additional cans of food does Sidney need to buy to feed all of her animals for 7 days.');
    expect(ask!.askType).toBe('how-many');
    expect(ask!.targetActor?.text).toBe('Sidney');
  });

  test('narration that only INDIRECTLY names an ask ("Parker wants to find out what X is"), with no real question or imperative anywhere, abstains -- same discipline as the mid-text rhetorical-narration case above', () => {
    const text = 'Parker wants to find out what the average percentage of kernels that pop in a bag is. In the first bag he makes, 60 kernels pop and the bag has 75 kernels.';
    const ask = extractAsk(text);
    expect(ask).toBeNull();
  });

  test('a title abbreviation ("Mr.", "Mrs.", "Ms.", "Dr.") never triggers a false sentence split, even mid-ask', () => {
    const text = 'A concert ticket costs $40. Mr. Benson bought 12 tickets and received a 5% discount for every ticket bought that exceeds 10. How much did Mr. Benson pay in all?';
    const ask = extractAsk(text);
    expect(ask).not.toBeNull();
    expect(ask!.sentence).toBe('How much did Mr. Benson pay in all?');
    expect(text.slice(ask!.span[0], ask!.span[1])).toBe(ask!.sentence);
    expect(ask!.askType).toBe('how-much');
    expect(ask!.otherAsks).toBeUndefined();
  });

  test('a decimal number ("2.5 times") inside a sentence never triggers a false sentence split', () => {
    const text = 'He sells it for 2.5 times that much. How much profit does he make?';
    const ask = extractAsk(text);
    expect(ask).not.toBeNull();
    expect(ask!.sentence).toBe('How much profit does he make?');
    expect(ask!.otherAsks).toBeUndefined();
  });
});
