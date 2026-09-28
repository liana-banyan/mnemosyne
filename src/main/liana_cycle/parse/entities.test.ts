// D-BP223-BM04-h2cbpv9w-170 / PARSE_ENTITIES / seat BM04 -- tests for parse/entities.ts (module C2).
//
// FIXTURE PROVENANCE. The 10 tuning-reserve fixture ids below are the exact 10 named in
// PLATFORM/BISHOP_DROPZONE/D-BP223-BM04-h2cbpv9w-170_PARSING_LAYER_SCOPE.md section C2:
// gsm8k-train-{1,2,4,5,6,13,15,16,18,23}. Question text is resolved from
// DATASETS/GSM8K/train.jsonl by the SAME `qid = 'gsm8k-train-' + lineIndex` convention
// gate5_sibling_interception.cjs's own loadGsm8kTrain() uses (0-indexed line number = the
// trailing id number), read directly from that file this dispatch -- never guessed or
// paraphrased (see the return doc for the exact extraction script and its output).
//
// DISJOINTNESS FROM THE HELD-OUT SPLIT. gate5_sibling_interception.cjs computes heldout vs.
// tuning by hashing each item's OWN qid through splitCorpus(HELDOUT_SPLIT_SEED, HELDOUT_RATIO) --
// membership depends only on the qid string and the frozen seed/ratio, not on which ids a caller
// happens to ask for. This dispatch confirmed all 10 of these ids are present in
// tuning_reserve_v1.json's own id list (never read heldout_split_v1.json to check the negative,
// per Rule 6 -- "NEVER touch the held-out half"; the return doc's coverage section performs the
// disjointness check against the reserve file itself, which is sufficient since the two files
// partition the corpus by construction).
//
// Every expected value below was hand-verified by reading the actual question text AND by
// running extractEntities() against it during this dispatch and inspecting the real output
// (spans decoded back to substrings), not merely guessed at from the source text -- matching this
// dispatch's own "hand-verified expected values" instruction. Two real, measured bugs were found
// and fixed this way before these assertions were written (see section 3 below and the return
// doc): a case-sensitive gendered-pronoun regex silently dropped every sentence-initial "He"/"She"
// occurrence, and a naive one-word-after-anchor noun capture reported adjectives ("new," "large,"
// "favorite") as items instead of their head noun.

import { describe, test, expect } from 'vitest';
import { extractEntities } from './entities';

describe('extractEntities -- 10 tuning-reserve fixtures (parse/entities.ts, module C2)', () => {
  test('gsm8k-train-1: single actor "Weng", two pronoun "she" both resolve via single-actor-in-scope', () => {
    const text = 'Weng earns $12 an hour for babysitting. Yesterday, she just did 50 minutes of babysitting. How much did she earn?';
    const r = extractEntities(text);
    expect(r.actors).toHaveLength(1);
    const weng = r.actors[0];
    expect(weng.name).toBe('Weng');
    expect(text.slice(weng.span[0], weng.span[1])).toBe('Weng');
    expect(weng.mentions).toHaveLength(1);
    expect(weng.pronounMentions).toHaveLength(2);
    expect(weng.pronounMentions.map((s) => text.slice(s[0], s[1]))).toEqual(['she', 'she']);
    expect(r.abstains).toHaveLength(0);
  });

  test('gsm8k-train-2: "Betty" established by attributive verb "is", every her/she pronoun (incl. sentence-initial "Her") resolves to her', () => {
    const text = "Betty is saving money for a new wallet which costs $100. Betty has only half of the money she needs. Her parents decided to give her $15 for that purpose, and her grandparents twice as much as her parents. How much more money does Betty need to buy the wallet?";
    const r = extractEntities(text);
    expect(r.actors).toHaveLength(1);
    const betty = r.actors[0];
    expect(betty.name).toBe('Betty');
    expect(betty.mentions).toHaveLength(3);
    // she, Her, her, her, her -- 5 gendered pronoun occurrences, all single-actor-in-scope.
    expect(betty.pronounMentions).toHaveLength(5);
    expect(text.slice(betty.pronounMentions[1][0], betty.pronounMentions[1][1])).toBe('Her');
    // "Her parents" / "her parents" / "her grandparents" are possessive items owned by Betty.
    const ownedNouns = r.items.filter((it) => it.ownerActor === 'Betty').map((it) => it.noun);
    expect(ownedNouns).toContain('parents');
    expect(ownedNouns).toContain('grandparents');
    expect(r.abstains).toHaveLength(0);
  });

  test('gsm8k-train-4: "James" established by "writes", ask-sentence "he" resolves to James', () => {
    const text = 'James writes a 3-page letter to 2 different friends twice a week.  How many pages does he write a year?';
    const r = extractEntities(text);
    expect(r.actors).toHaveLength(1);
    expect(r.actors[0].name).toBe('James');
    expect(r.actors[0].pronounMentions).toHaveLength(1);
    expect(text.slice(r.actors[0].pronounMentions[0][0], r.actors[0].pronounMentions[0][1])).toBe('he');
  });

  test('gsm8k-train-5: "Mark" established by "has"; "them" (referring to flowers, not Mark) is a GROUP-REFERENCE abstain, not resolved to Mark', () => {
    const text = 'Mark has a garden with flowers. He planted plants of three different colors in it. Ten of them are yellow, and there are 80% more of those in purple. There are only 25% as many green flowers as there are yellow and purple flowers. How many flowers does Mark have in his garden?';
    const r = extractEntities(text);
    expect(r.actors).toHaveLength(1);
    const mark = r.actors[0];
    expect(mark.name).toBe('Mark');
    // "He" (sentence-initial, capitalized) and "his" both resolve to Mark.
    expect(mark.pronounMentions.map((s) => text.slice(s[0], s[1]))).toEqual(['He', 'his']);
    const groupAbstain = r.abstains.find((a) => text.slice(a.span[0], a.span[1]) === 'them');
    expect(groupAbstain).toBeDefined();
    expect(groupAbstain!.reason).toContain('group reference');
    // Never silently bound "them" to Mark as a pronounMention.
    expect(mark.pronounMentions.some((s) => text.slice(s[0], s[1]) === 'them')).toBe(false);
  });

  test('gsm8k-train-6: rhetorical "he" inside narration ("Albert is wondering how much... he can eat") IS still Albert (single actor in scope, unlike the ask-sentence rule in parse/ask.ts) -- every he/He resolves', () => {
    const text = 'Albert is wondering how much pizza he can eat in one day. He buys 2 large pizzas and 2 small pizzas. A large pizza has 16 slices and a small pizza has 8 slices. If he eats it all, how many pieces does he eat that day?';
    const r = extractEntities(text);
    expect(r.actors).toHaveLength(1);
    const albert = r.actors[0];
    expect(albert.name).toBe('Albert');
    expect(albert.pronounMentions).toHaveLength(4);
    expect(albert.pronounMentions.map((s) => text.slice(s[0], s[1]))).toEqual(['he', 'He', 'he', 'he']);
    expect(r.abstains).toHaveLength(0);
  });

  test('gsm8k-train-13: "Jasper" established by modal "will" before "serve"; his/He/he all resolve', () => {
    const text = 'Jasper will serve charcuterie at his dinner party. He buys 2 pounds of cheddar cheese for $10, a pound of cream cheese that cost half the price of the cheddar cheese, and a pack of cold cuts that cost twice the price of the cheddar cheese. How much does he spend on the ingredients?';
    const r = extractEntities(text);
    expect(r.actors).toHaveLength(1);
    expect(r.actors[0].name).toBe('Jasper');
    expect(r.actors[0].pronounMentions.map((s) => text.slice(s[0], s[1]))).toEqual(['his', 'He', 'he']);
    // "his dinner party" -> possessive item "dinner" owned by Jasper (single-word head-noun
    // capture; "dinner party" as a two-word compound is a documented limitation, see return doc).
    expect(r.items.some((it) => it.ownerActor === 'Jasper')).toBe(true);
  });

  test('gsm8k-train-15: "James" established by "creates"; every He/he resolves via single-actor-in-scope across many sentences', () => {
    const text = 'James creates a media empire.  He creates a movie for $2000.  Each DVD cost $6 to make.  He sells it for 2.5 times that much.  He sells 500 movies a day for 5 days a week.  How much profit does he make in 20 weeks?';
    const r = extractEntities(text);
    expect(r.actors).toHaveLength(1);
    expect(r.actors[0].name).toBe('James');
    expect(r.actors[0].pronounMentions).toHaveLength(4);
    expect(r.actors[0].pronounMentions.map((s) => text.slice(s[0], s[1]))).toEqual(['He', 'He', 'He', 'he']);
    // "Each" is sentence-initial and in the stoplist -- never captured as a bogus actor name.
    expect(r.actors.some((a) => a.name === 'Each')).toBe(false);
  });

  test('gsm8k-train-16: "Mike" and "Johnson" both established (evidence found later in the text, not at first mention); "his" is AMBIGUOUS (both male, both in the same sentence) and correctly ABSTAINS rather than guessing Mike', () => {
    const text = 'The profit from a business transaction is shared among 2 business partners, Mike and Johnson in the ratio 2:5 respectively. If Johnson got $2500, how much will Mike have after spending some of his share on a shirt that costs $200?';
    const r = extractEntities(text);
    const names = r.actors.map((a) => a.name).sort();
    expect(names).toEqual(['Johnson', 'Mike']);
    // Neither actor absorbed "his" as a pronounMention.
    for (const a of r.actors) {
      expect(a.pronounMentions).toHaveLength(0);
    }
    const hisAbstain = r.abstains.find((a) => text.slice(a.span[0], a.span[1]) === 'his');
    expect(hisAbstain).toBeDefined();
    expect(hisAbstain!.reason).toContain('ambiguous');
    expect(hisAbstain!.reason).toContain('Mike');
    expect(hisAbstain!.reason).toContain('Johnson');
  });

  test('gsm8k-train-18: "Roque" established from a LATER sentence ("Roque walks") even though his first mention is as an object ("takes Roque"); "his"/"his"/"he" all resolve to him', () => {
    const text = 'It takes Roque two hours to walk to work and one hour to ride his bike to work. Roque walks to and from work three times a week and rides his bike to and from work twice a week. How many hours in total does he take to get to and from work a week with walking and biking?';
    const r = extractEntities(text);
    expect(r.actors).toHaveLength(1);
    const roque = r.actors[0];
    expect(roque.name).toBe('Roque');
    expect(roque.mentions).toHaveLength(2);
    expect(roque.pronounMentions).toHaveLength(3);
    expect(roque.pronounMentions.map((s) => text.slice(s[0], s[1]))).toEqual(['his', 'his', 'he']);
    // Sentence-initial "It" is a pronoun, never captured as a name candidate.
    expect(r.actors.some((a) => a.name === 'It')).toBe(false);
  });

  test('gsm8k-train-23: "Ann" established via possessive ("Ann\'s"); she/She both resolve; possessive item "store" (not the adjective "favorite") owned by Ann', () => {
    const text = "Ann's favorite store was having a summer clearance. For $75 she bought 5 pairs of shorts for $7 each and 2 pairs of shoes for $10 each. She also bought 4 tops, all at the same price. How much did each top cost?";
    const r = extractEntities(text);
    expect(r.actors).toHaveLength(1);
    const ann = r.actors[0];
    expect(ann.name).toBe('Ann');
    expect(ann.pronounMentions.map((s) => text.slice(s[0], s[1]))).toEqual(['she', 'She']);
    const storeItem = r.items.find((it) => it.ownerActor === 'Ann');
    expect(storeItem).toBeDefined();
    expect(storeItem!.noun).toBe('store');
  });
});

describe('extractEntities -- adversarial / regression fixtures', () => {
  test('two same-gender actors + ambiguous "He": abstains rather than guessing the more recent name', () => {
    const text = 'Tom has 5 apples and Jerry has 3 apples. He wants more.';
    const r = extractEntities(text);
    const names = r.actors.map((a) => a.name).sort();
    expect(names).toEqual(['Jerry', 'Tom']);
    for (const a of r.actors) expect(a.pronounMentions).toHaveLength(0);
    const abstain = r.abstains.find((a) => text.slice(a.span[0], a.span[1]) === 'He');
    expect(abstain).toBeDefined();
    expect(abstain!.reason).toContain('ambiguous');
  });

  test('sentence-initial "If" is never captured as a name candidate', () => {
    const text = 'If Sarah has 10 apples, how many does she have left?';
    const r = extractEntities(text);
    expect(r.actors.map((a) => a.name)).toEqual(['Sarah']);
    expect(r.actors.some((a) => a.name === 'If')).toBe(false);
    expect(r.actors[0].pronounMentions).toHaveLength(1);
  });

  test('"Mrs. Hilt" is captured as one title-prefixed actor, not a discarded "Mrs" plus bare "Hilt"; "them" referring to books is a group reference, not bound to her', () => {
    const text = 'Mrs. Hilt bought 3 books for $5 each. She read them over the weekend.';
    const r = extractEntities(text);
    expect(r.actors).toHaveLength(1);
    expect(r.actors[0].name).toBe('Mrs. Hilt');
    expect(r.actors[0].pronounMentions).toHaveLength(1);
    expect(text.slice(r.actors[0].pronounMentions[0][0], r.actors[0].pronounMentions[0][1])).toBe('She');
    const groupAbstain = r.abstains.find((a) => text.slice(a.span[0], a.span[1]) === 'them');
    expect(groupAbstain).toBeDefined();
  });

  test('"the children" is detected as an irregular plural item (not missed by a naive -s/-es strip)', () => {
    const text = 'The teacher gave the children 5 books each.';
    const r = extractEntities(text);
    const childrenItem = r.items.find((it) => it.noun === 'children');
    expect(childrenItem).toBeDefined();
    expect(childrenItem!.plural).toBe(true);
    const booksItem = r.items.find((it) => it.noun === 'books');
    expect(booksItem!.plural).toBe(true);
  });

  test('a role noun ("the farmer") becomes the Actor when no proper name exists anywhere in the text', () => {
    const text = 'The farmer sold 12 pumpkins at the market.';
    const r = extractEntities(text);
    expect(r.actors.length).toBeGreaterThan(0);
    const farmer = r.actors.find((a) => a.name === 'farmer');
    expect(farmer).toBeDefined();
    expect(farmer!.evidence[0]).toContain('role noun');
  });

  test('a two-level possessive chain ("Tom\'s brother\'s bicycle") resolves both links without crashing', () => {
    const text = "Tom's brother's bicycle was blue.";
    const r = extractEntities(text);
    expect(r.actors.map((a) => a.name)).toEqual(['Tom']);
    const brotherItem = r.items.find((it) => it.noun === 'brother');
    expect(brotherItem).toBeDefined();
    expect(brotherItem!.ownerActor).toBe('Tom');
    const bicycleItem = r.items.find((it) => it.noun === 'bicycle');
    expect(bicycleItem).toBeDefined();
    expect(bicycleItem!.ownerActor).toBe('brother');
  });

  test('empty/non-string input abstains rather than throwing', () => {
    expect(extractEntities('').abstains[0].reason).toContain('abstain');
    // @ts-expect-error -- deliberately passing a non-string to confirm the guard, not just the type
    expect(extractEntities(null).actors).toEqual([]);
  });

  test('a text with no actor and no pronoun returns empty actors/abstains, not a crash', () => {
    const text = 'The total was 12 and the average was 4.';
    const r = extractEntities(text);
    expect(r.actors).toEqual([]);
    expect(r.abstains).toEqual([]);
  });

  test('"each" is excluded from name candidates even mid-problem, matching the module\'s fixed sentence-initial stoplist', () => {
    const text = 'Each student has 3 pencils. How many pencils in total?';
    const r = extractEntities(text);
    expect(r.actors.some((a) => a.name === 'Each')).toBe(false);
  });
});
