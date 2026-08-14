// discriminator_step.test.ts -- D-BP154-013/BISHOP/S13/seg-composerstep, STEP 3/3
//
// FAIL-BEFORE / PASS-AFTER for THE DISCRIMINATOR as a Composer step. Same boundary as
// softballs_step.test.ts's / named_set_step.test.ts's own headers: the pure parts (category
// derivation, query text, span verification) are exercised directly; runDiscriminatorStep()
// itself needs a live browser authority and a live Ollama instance, proven by an in-app run
// instead (this ticket's own return).
//
// FAIL-BEFORE: every test below FAILS on main before this ticket, because discriminator_step.ts,
// its registration, and its wiring into script_bridge.ts did not exist -- the import at the top
// of this file alone throws "Cannot find module './discriminator_step'".

import { describe, test, expect, vi } from 'vitest';
import {
  buildDiscriminatorQuery, deriveDiscriminatorCategory, deriveDiscriminatorSuperlativeProperty,
  registerDiscriminatorStep, runDiscriminatorStep,
  verifyCategoryEnumeration, verifyCategoryKind, verifyDiscriminatorKinds, verifyDiscriminatorPropertyMembers,
} from './discriminator_step';
import { listComposerRegistry, runScratchComposer } from './script_bridge';
import type { MethodQuestionInput, MethodRunContext } from '../method_registry';

// qid 98's real option letters, from resources/mmlu_pro_bundled/questions.jsonl (question_id 98).
const OPT: Record<string, string> = {
  A: 'South America',
  B: 'South Asia',
  C: 'North Africa',
  D: 'Northeast United States',
  E: 'Europe',
  F: 'Central Asia',
  G: 'Arctic Circle',
  H: 'Amazon Rainforest',
  I: 'Sahara Desert',
};
const ALL = Object.keys(OPT);
const QID98_QUESTION = "Which of the following world regions is NOT considered one of the world's most densely populated regions?";

describe('deriveDiscriminatorCategory -- reads the category the question itself names, never guesses', () => {
  test('qid 98: "following world regions is" -> "world regions"', () => {
    expect(deriveDiscriminatorCategory(QID98_QUESTION)).toBe('world regions');
  });

  test('a question with no "following X is/are" shape returns null, not a fabricated category', () => {
    expect(deriveDiscriminatorCategory('What is the capital of France?')).toBeNull();
  });
});

describe('buildDiscriminatorQuery -- ONE query asking BOTH things, never split into two round trips', () => {
  test('the query names the category once, asks for a kind per option, and lists every option once', () => {
    const q = buildDiscriminatorQuery('world regions', null, ALL, OPT);
    expect(q).toContain('For EACH of the following, state exactly what it is');
    expect(q).toContain('properly denotes "world regions"');
    for (const L of ALL) expect(q).toContain(OPT[L]);
    // ONE query -- the category phrase appears exactly once, not once per option.
    expect(q.match(/properly denotes/g)?.length).toBe(1);
  });

  // D-BP154-021/BISHOP-SEG/S21/seg-mortgagetrap, ADDITIVE.
  test('a null property asks nothing about it -- no third clause appended', () => {
    const q = buildDiscriminatorQuery('world regions', null, ALL, OPT);
    expect(q).not.toContain('ARE');
  });

  test('a non-null property adds a third ask, in the SAME query, asking which options ARE it', () => {
    const q = buildDiscriminatorQuery('world regions', "the world's most densely populated regions", ALL, OPT);
    expect(q).toContain('properly denotes "world regions"');
    expect(q).toContain("ARE the world's most densely populated regions");
    expect(q).toContain("that it is the world's most densely populated regions");
  });

  // D-BP154-023/BISHOP-SEG/S23/seg-enumerate, ADDITIVE (FD-BP154-06).
  test('the query ALWAYS asks for a category enumeration, even with no property -- exhaustiveness demanded explicitly', () => {
    const q = buildDiscriminatorQuery('world regions', null, ALL, OPT);
    expect(q).toContain('enumerable, closed set');
    expect(q).toContain('exhaustively');
    expect(q).toContain('do not give examples');
  });

  test('the enumeration ask still appears, and still comes before the property ask, when a property is also present', () => {
    const q = buildDiscriminatorQuery('world regions', "the world's most densely populated regions", ALL, OPT);
    const enumIdx = q.indexOf('enumerable, closed set');
    const propIdx = q.indexOf("ARE the world's most densely populated regions");
    expect(enumIdx).toBeGreaterThan(-1);
    expect(propIdx).toBeGreaterThan(enumIdx);
  });
});

describe("deriveDiscriminatorSuperlativeProperty -- reads the SUPERLATIVE PROPERTY (FD-BP153-07 point 3 is about this, not only the bare category), never guesses", () => {
  test("qid 98: '...one of the world's most densely populated regions?' -> \"world's most densely populated regions\"", () => {
    expect(deriveDiscriminatorSuperlativeProperty(QID98_QUESTION)).toBe("world's most densely populated regions");
  });

  test('a bare-category question with no superlative phrase returns null, not a fabricated property', () => {
    expect(deriveDiscriminatorSuperlativeProperty('Which of the following is NOT a mammal?')).toBeNull();
  });
});

describe('verifyDiscriminatorPropertyMembers -- extraction only, verified span or discarded (HARDWIRE-22)', () => {
  // Invented vocabulary (not qid 98's real property) -- proves the mechanism, not tuned to this question.
  const passage = 'Alpha is explicitly one of the recognized primary clusters. Beta is explicitly '
    + 'one of the recognized primary clusters. Gamma is a different kind of thing entirely.';
  const OPT2: Record<string, string> = { A: 'Alpha', B: 'Beta', C: 'Gamma' };

  test('an option the source explicitly states IS the property is kept, verbatim span required', () => {
    const raw = [
      { name: 'Alpha', span: 'Alpha is explicitly one of the recognized primary clusters.' },
      { name: 'Beta', span: 'Beta is explicitly one of the recognized primary clusters.' },
    ];
    const { propertyMembers, discarded } = verifyDiscriminatorPropertyMembers(raw, passage, OPT2);
    expect(propertyMembers.map((e) => e.letter).sort()).toEqual(['A', 'B']);
    expect(discarded).toBe(0);
  });

  test('an option the source never affirms is NOT included -- absence is omission, not membership', () => {
    const raw = [{ name: 'Alpha', span: 'Alpha is explicitly one of the recognized primary clusters.' }];
    const { propertyMembers } = verifyDiscriminatorPropertyMembers(raw, passage, OPT2);
    expect(propertyMembers.map((e) => e.letter)).toEqual(['A']);
    expect(propertyMembers.some((e) => e.letter === 'C')).toBe(false);
  });

  test('a span that does not verbatim-match the passage is discarded, not silently kept', () => {
    const raw = [{ name: 'Gamma', span: 'Gamma is one of the recognized primary clusters (fabricated span).' }];
    const { propertyMembers, discarded } = verifyDiscriminatorPropertyMembers(raw, passage, OPT2);
    expect(propertyMembers).toHaveLength(0);
    expect(discarded).toBe(1);
  });
});

describe('verifyDiscriminatorKinds / verifyCategoryKind -- extraction only, verified span or discarded (HARDWIRE-22, FD-BP153-07 FIX 2)', () => {
  // Mirrors the real BP153 categorization evidence quoted in classify_cascade.frame.test.ts's own
  // header (FD-BP153-01): continental/subcontinental divisions (South Asia, Europe, South
  // America), a sub-national geographic zone (Northeast United States), and biomes/climatic areas
  // (Amazon Rainforest, Sahara Desert, Arctic Circle).
  const passage = 'South Asia is a continental or subcontinental division. Europe is a '
    + 'continental or subcontinental division. South America is a continental or subcontinental '
    + 'division. Northeast United States is a sub-national geographic zone, not a world region '
    + 'in the same sense. Amazon Rainforest is a biome, not a world region. Arctic Circle is a '
    + 'line of latitude, not a world region. A continental or subcontinental division is the '
    + 'classification that properly denotes a world region.';

  test('THE LOCK: kinds are read per option with verbatim spans, and the category-denoting kind is read separately', () => {
    const rawKinds = [
      { name: 'South Asia', kind: 'continental or subcontinental division', span: 'South Asia is a continental or subcontinental division.' },
      { name: 'Europe', kind: 'continental or subcontinental division', span: 'Europe is a continental or subcontinental division.' },
      { name: 'South America', kind: 'continental or subcontinental division', span: 'South America is a continental or subcontinental division.' },
      { name: 'Northeast United States', kind: 'sub-national geographic zone', span: 'Northeast United States is a sub-national geographic zone, not a world region in the same sense.' },
      { name: 'Amazon Rainforest', kind: 'biome', span: 'Amazon Rainforest is a biome, not a world region.' },
      { name: 'Arctic Circle', kind: 'line of latitude', span: 'Arctic Circle is a line of latitude, not a world region.' },
    ];
    const { kinds, discarded } = verifyDiscriminatorKinds(rawKinds, passage, OPT);
    expect(kinds.map((e) => e.letter).sort()).toEqual(['A', 'B', 'D', 'E', 'H', 'G'].sort());
    expect(discarded).toBe(0);
    for (const e of kinds) {
      expect(passage).toContain(e.span);
      expect(e.span).toContain(e.name);
    }

    const rawCategoryKind = { kind: 'continental or subcontinental division', span: 'A continental or subcontinental division is the classification that properly denotes a world region.' };
    const { categoryKind, discarded: catDiscarded } = verifyCategoryKind(rawCategoryKind, passage);
    expect(categoryKind?.kind).toBe('continental or subcontinental division');
    expect(passage).toContain(categoryKind!.span);
    expect(catDiscarded).toBe(false);
  });

  test('a kind with a span not verbatim in the passage is discarded and counted', () => {
    const raw = [{ name: 'South Asia', kind: 'a region', span: 'South Asia is obviously a region, everyone knows that.' }];
    const { kinds, discarded } = verifyDiscriminatorKinds(raw, passage, OPT);
    expect(kinds).toHaveLength(0);
    expect(discarded).toBe(1);
  });

  test('a missing kind (span present, kind empty) is discarded and counted', () => {
    const raw = [{ name: 'South Asia', kind: '', span: 'South Asia is a continental or subcontinental division.' }];
    const { kinds, discarded } = verifyDiscriminatorKinds(raw, passage, OPT);
    expect(kinds).toHaveLength(0);
    expect(discarded).toBe(1);
  });

  test('ABSENCE IS OMISSION: an option the passage never classifies has no kind, and is not counted as a discard', () => {
    const { kinds, discarded } = verifyDiscriminatorKinds([], passage, OPT);
    expect(kinds).toHaveLength(0);
    expect(discarded).toBe(0);
  });

  test('a category-kind span not verbatim in the passage is discarded, never trusted as stated', () => {
    const { categoryKind, discarded } = verifyCategoryKind({ kind: 'a fake kind', span: 'this sentence is not in the passage' }, passage);
    expect(categoryKind).toBeNull();
    expect(discarded).toBe(true);
  });

  test('no category-kind offered at all is "not stated", never a discard (nothing was attempted)', () => {
    const { categoryKind, discarded } = verifyCategoryKind(undefined, passage);
    expect(categoryKind).toBeNull();
    expect(discarded).toBe(false);
  });

  test('NO RULE MAY SELECT A PARTICULAR LETTER: the same check accepts or discards identically regardless of which letter is under test', () => {
    const rawForA = [{ name: 'South America', kind: 'x', span: 'South America is obviously x, everyone knows.' }];
    const rawForH = [{ name: 'Amazon Rainforest', kind: 'x', span: 'Amazon Rainforest is obviously x, everyone knows.' }];
    expect(verifyDiscriminatorKinds(rawForA, passage, OPT).discarded).toBe(1);
    expect(verifyDiscriminatorKinds(rawForH, passage, OPT).discarded).toBe(1);
  });
});

// D-BP154-023/BISHOP-SEG/S23/seg-enumerate -- FD-BP154-06, Founder verbatim: "the narrow reading
// is obtainable from a source we can cite." Deliberately invented category/option vocabulary
// throughout (never qid 98's real "world regions"/real option names) -- proves the mechanism
// generalizes, per FD-BP153-06's own "would this rule survive on a question whose answer we do
// not know" bar.
describe('verifyCategoryEnumeration -- extraction only, verified span or discarded (HARDWIRE-22, FD-BP154-06)', () => {
  const passage = 'The Alpha Federation consists of exactly three member states: Redland, '
    + 'Blueland, and Greenland. Yellowland is a separate, unrelated territory.';

  test('a genuine enumeration statement, verbatim in the passage, is kept', () => {
    const raw = { span: 'The Alpha Federation consists of exactly three member states: Redland, Blueland, and Greenland.' };
    const { categoryEnumeration, discarded } = verifyCategoryEnumeration(raw, passage);
    expect(categoryEnumeration).not.toBeNull();
    expect(categoryEnumeration?.span).toContain('Redland');
    expect(discarded).toBe(false);
  });

  test('an enumeration span not verbatim in the passage is discarded, never trusted as stated', () => {
    const raw = { span: 'This exact sentence never appeared in the passage at all.' };
    const { categoryEnumeration, discarded } = verifyCategoryEnumeration(raw, passage);
    expect(categoryEnumeration).toBeNull();
    expect(discarded).toBe(true);
  });

  test('no enumeration offered at all is "not stated", never a discard (nothing was attempted)', () => {
    const { categoryEnumeration, discarded } = verifyCategoryEnumeration(undefined, passage);
    expect(categoryEnumeration).toBeNull();
    expect(discarded).toBe(false);
  });

  test('null is treated identically to undefined -- both are "not stated"', () => {
    const { categoryEnumeration, discarded } = verifyCategoryEnumeration(null, passage);
    expect(categoryEnumeration).toBeNull();
    expect(discarded).toBe(false);
  });
});

describe('verifyDiscriminatorPropertyMembers reused for CATEGORY enumeration membership -- the same generic four-part discipline, no letter preference', () => {
  const passage = 'The Alpha Federation consists of exactly three member states: Redland, '
    + 'Blueland, and Greenland. Yellowland is a separate, unrelated territory.';
  const OPT2: Record<string, string> = { A: 'Redland', B: 'Blueland', C: 'Greenland', D: 'Yellowland' };

  test('options the enumeration explicitly names are kept, each with its own verbatim span', () => {
    const raw = [
      { name: 'Redland', span: 'The Alpha Federation consists of exactly three member states: Redland, Blueland, and Greenland.' },
      { name: 'Blueland', span: 'The Alpha Federation consists of exactly three member states: Redland, Blueland, and Greenland.' },
      { name: 'Greenland', span: 'The Alpha Federation consists of exactly three member states: Redland, Blueland, and Greenland.' },
    ];
    const { propertyMembers, discarded } = verifyDiscriminatorPropertyMembers(raw, passage, OPT2);
    expect(propertyMembers.map((e) => e.letter).sort()).toEqual(['A', 'B', 'C']);
    expect(discarded).toBe(0);
  });

  test('an option NOT named by the enumeration is never included -- absence from the extraction, not a false membership', () => {
    const raw = [{ name: 'Redland', span: 'The Alpha Federation consists of exactly three member states: Redland, Blueland, and Greenland.' }];
    const { propertyMembers } = verifyDiscriminatorPropertyMembers(raw, passage, OPT2);
    expect(propertyMembers.map((e) => e.letter)).toEqual(['A']);
    expect(propertyMembers.some((e) => e.letter === 'D')).toBe(false);
  });

  test('NO RULE MAY SELECT A PARTICULAR LETTER: a fabricated span is discarded identically regardless of which letter is under test', () => {
    const rawForA = [{ name: 'Redland', span: 'a sentence that never appeared anywhere' }];
    const rawForD = [{ name: 'Yellowland', span: 'a sentence that never appeared anywhere' }];
    expect(verifyDiscriminatorPropertyMembers(rawForA, passage, OPT2).discarded).toBe(1);
    expect(verifyDiscriminatorPropertyMembers(rawForD, passage, OPT2).discarded).toBe(1);
  });
});

describe('runDiscriminatorStep -- named failures, never a silent empty result', () => {
  test('no options at all -> ok:false with a named reason, not kinds:[] read as "no kinds stated"', async () => {
    const input: MethodQuestionInput = { question: 'free text, no options', options: null };
    const ctx: MethodRunContext = { askGoogle: vi.fn(), emit: vi.fn() };
    const { result } = await runDiscriminatorStep(input, ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('no lettered options');
  });

  test('no derivable category -> ok:false with a named reason, never a guessed category', async () => {
    const input: MethodQuestionInput = { question: 'Pick the best one.', options: { A: 'x', B: 'y' } };
    const ctx: MethodRunContext = { askGoogle: vi.fn(), emit: vi.fn() };
    const { result } = await runDiscriminatorStep(input, ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('could not determine the category');
  });

  test('askGoogle unavailable -> ok:false, named, never "no kinds stated"', async () => {
    // googleBlocks() (comparative_cascade.ts, reused unmodified) retries a null/absent answer up
    // to 3 times with a settling sleep between attempts -- see softballs_step.test.ts's own
    // identical note. Timeout widened accordingly.
    const input: MethodQuestionInput = { question: QID98_QUESTION, options: OPT };
    const askGoogle = vi.fn().mockResolvedValue(null);
    const ctx: MethodRunContext = { askGoogle, emit: vi.fn() };
    const { result, summary } = await runDiscriminatorStep(input, ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('no usable answer');
    expect(summary).toContain('FAILED');
  }, 20000);
});

describe('THE STEP REGISTERS -- same wiring path Survey:1/Softballs:1/NamedSet:1 already use', () => {
  test('Discriminator:1 is listed in the Composer registry and marked executable', () => {
    expect(typeof registerDiscriminatorStep).toBe('function');
    const entries = listComposerRegistry();
    const entry = entries.find((e) => e.id === 'Discriminator:1');
    expect(entry, 'Discriminator:1 should be listed').toBeTruthy();
    expect(entry?.executable).toBe(true);
  });

  test('stacking Discriminator:1 through runScratchComposer() reaches runDiscriminatorStep(), never a "no runner wired" failure', async () => {
    const freeText = `${QID98_QUESTION} ${ALL.map((L) => `${L}) ${OPT[L]}`).join(' ')}`;
    const askGoogle = vi.fn().mockResolvedValue(null); // unavailable -- proves the step RAN, not that it succeeded
    const emit = vi.fn();
    const response = await runScratchComposer(freeText, ['Discriminator:1'], askGoogle, emit);
    expect(response.mode).toBe('stack');
    if (response.mode === 'stack') {
      expect(response.result.ok).toBe(true);
      expect(response.result.error).toBeUndefined();
      expect(response.result.results).toHaveLength(1);
      expect(response.result.results[0].summary).toContain('DISCRIMINATOR');
      const raw = response.result.results[0].raw as { ok: boolean; error?: string };
      expect(raw.ok).toBe(false);
      expect(raw.error).toContain('no usable answer');
    }
  }, 20000);

  test('stacking all three steps together runs them in order, each independently, over the same full option set', async () => {
    const freeText = `${QID98_QUESTION} ${ALL.map((L) => `${L}) ${OPT[L]}`).join(' ')}`;
    const askGoogle = vi.fn().mockResolvedValue(null);
    const emit = vi.fn();
    const response = await runScratchComposer(freeText, ['Softballs:1', 'NamedSet:1', 'Discriminator:1'], askGoogle, emit);
    expect(response.mode).toBe('stack');
    if (response.mode === 'stack') {
      expect(response.result.results.map((r) => r.id)).toEqual(['Softballs:1', 'NamedSet:1', 'Discriminator:1']);
    }
  }, 40000);
});
