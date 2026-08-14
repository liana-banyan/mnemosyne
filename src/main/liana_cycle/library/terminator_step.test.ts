// terminator_step.test.ts -- D-BP154-018/BISHOP-SEG/S18/seg-terminator
//
// FAIL-BEFORE / PASS-AFTER for THE TERMINATOR as a Composer step. deriveTerminatorEliminations()
// is pure and synchronous (no live Ollama/browser needed, unlike the three feeder steps) so it
// carries the real unit tests here; runTerminatorStep()'s own wiring (reading priorResults,
// registration, script_bridge.ts's EXECUTABLE_IDS) is proven by an in-app run instead (this
// ticket's own return -- see the dispatch's own "prove it runs live" requirement).
//
// FAIL-BEFORE: every test below FAILS on main before this ticket, because terminator_step.ts did
// not exist -- the import at the top of this file alone throws "Cannot find module
// './terminator_step'".

import { describe, test, expect } from 'vitest';
import { deriveTerminatorEliminations, registerTerminatorStep, runTerminatorStep } from './terminator_step';
import { listComposerRegistry } from './script_bridge';
import type { SoftballsResult } from './softballs_step';
import type { NamedSetResult } from './named_set_step';
import type { DiscriminatorResult } from './discriminator_step';
import type { MagnitudeResult, MagnitudeOrderEntry } from './magnitude_step';
import type { MethodQuestionInput, MethodRunContext } from '../method_registry';

// qid 98's real option letters, from resources/mmlu_pro_bundled/questions.jsonl (question_id 98) --
// used here only as a REALISTIC option set for the reducer's own logic; this file's assertions
// never reference which letter is "correct" (D-BP153-003, runtime stays structurally blind).
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

function softballs(excluded: Array<[string, string]>): SoftballsResult {
  return {
    ok: true, category: 'world regions', query: 'q',
    excluded: excluded.map(([letter, span]) => ({ letter, name: OPT[letter], span })),
    discarded: 0,
    notExcluded: Object.keys(OPT).filter((L) => !excluded.some(([l]) => l === L)),
    via: 'test',
  };
}

function namedSet(included: Array<[string, string]>): NamedSetResult {
  return {
    ok: true, property: "world's most densely populated regions", query: 'q',
    included: included.map(([letter, span]) => ({ letter, name: OPT[letter], span })),
    discarded: 0,
    notIncluded: Object.keys(OPT).filter((L) => !included.some(([l]) => l === L)),
    via: 'test',
  };
}

/** D-BP154-022/BISHOP-SEG/S22/seg-magnitude, ADDITIVE. `order` is [letter, span] pairs, MOST to
 *  LEAST -- caller supplies them already in the intended sequence, mirroring how
 *  runMagnitudeStep() itself trusts an extraction's own stated array order. */
function magnitude(
  frame: string[],
  targetExtreme: 'most' | 'least',
  property: string,
  order: Array<[string, string]>,
  unranked: string[] = [],
): MagnitudeResult {
  const orderEntries: MagnitudeOrderEntry[] = order.map(([letter, span]) => ({ letter, name: OPT[letter], span }));
  return {
    ok: true, frame, property, targetExtreme, query: 'q', order: orderEntries, discarded: 0,
    unranked, via: 'test', disagreement: null,
  };
}

function discriminator(
  kinds: Array<[string, string, string]>,
  categoryKind: { kind: string; span: string } | null,
  // D-BP154-021/BISHOP-SEG/S21/seg-mortgagetrap, ADDITIVE, optional (defaults to none so every
  // pre-existing call site below compiles and behaves unchanged): [letter, span] pairs the source
  // explicitly states ARE the superlative property.
  propertyMembers: Array<[string, string]> = [],
  // D-BP154-023/BISHOP-SEG/S23/seg-enumerate, ADDITIVE, optional (defaults to none): [letter,
  // span] pairs the source's own CATEGORY enumeration names as members, plus the enumeration
  // statement's own span (null when no enumeration was stated at all).
  categoryEnumerationMembers: Array<[string, string]> = [],
  categoryEnumerationSpan: string | null = null,
): DiscriminatorResult {
  return {
    ok: true, category: 'world regions', property: null, query: 'q',
    kinds: kinds.map(([letter, kind, span]) => ({ letter, name: OPT[letter], kind, span })),
    discardedKinds: 0,
    noKindStated: Object.keys(OPT).filter((L) => !kinds.some(([l]) => l === L)),
    categoryKind,
    categoryKindDiscarded: false,
    propertyMembers: propertyMembers.map(([letter, span]) => ({ letter, name: OPT[letter], span })),
    discardedPropertyMembers: 0,
    categoryEnumeration: categoryEnumerationSpan ? { span: categoryEnumerationSpan } : null,
    categoryEnumerationDiscarded: false,
    categoryEnumerationMembers: categoryEnumerationMembers.map(([letter, span]) => ({ letter, name: OPT[letter], span })),
    discardedCategoryEnumerationMembers: 0,
    enumerationDisagreement: null,
    via: 'test',
  };
}

describe('deriveTerminatorEliminations -- FD-BP152-19 UNIQUE OR ABSTAIN, pure reducer', () => {
  test('Softballs excludes non-regions; NamedSet includes densely-populated members; the ONE remaining option is not eliminated', () => {
    const sb = softballs([
      ['D', 'D) Northeast United States is a subnational region, not a world region.'],
      ['G', 'G) Arctic Circle is a line of latitude, not a world region.'],
      ['H', 'H) Amazon Rainforest is a biome, not a world region.'],
      ['I', 'I) Sahara Desert is a desert, not a world region.'],
    ]);
    const ns = namedSet([
      ['B', 'B) South Asia is one of the most densely populated regions.'],
      ['C', 'C) North Africa is one of the most densely populated regions.'],
      ['E', 'E) Europe is one of the most densely populated regions.'],
      ['F', 'F) Central Asia is one of the most densely populated regions.'],
    ]);
    const { eliminated, contradiction } = deriveTerminatorEliminations(OPT, sb, ns, null);
    expect(contradiction).toBeNull();
    const eliminatedLetters = new Set(eliminated.map((e) => e.letter));
    expect(eliminatedLetters).toEqual(new Set(['D', 'G', 'H', 'I', 'B', 'C', 'E', 'F']));
    expect(eliminatedLetters.has('A')).toBe(false); // the sole survivor, never asserted to be "the answer" by this test
    // every elimination names its own source step and carries a real span, never a bare letter.
    for (const e of eliminated) {
      expect(e.span.length).toBeGreaterThan(0);
      expect(['Softballs:1', 'NamedSet:1']).toContain(e.sourceStep);
    }
  });

  test('a null/absent feeder step contributes ZERO eliminations -- never "confirmed nothing to eliminate"', () => {
    const { eliminated, contradiction } = deriveTerminatorEliminations(OPT, null, null, null);
    expect(eliminated).toEqual([]);
    expect(contradiction).toBeNull();
  });

  test('Discriminator eliminates an option whose stated kind differs from the category-denoting kind (FD-BP153-06 passing example)', () => {
    const disc = discriminator(
      [
        ['A', 'a continent-scale geographic region', 'A) South America is a continent-scale geographic region.'],
        ['H', 'a rainforest biome', 'H) Amazon Rainforest is a rainforest biome.'],
      ],
      { kind: 'a continent-scale geographic region', span: 'the classification that denotes world regions is a continent-scale geographic region' },
    );
    const { eliminated } = deriveTerminatorEliminations(OPT, null, null, disc);
    expect(eliminated).toHaveLength(1);
    expect(eliminated[0].letter).toBe('H');
    expect(eliminated[0].sourceStep).toBe('Discriminator:1');
  });

  test('Discriminator does NOT eliminate an option whose stated kind MATCHES the category-denoting kind', () => {
    const disc = discriminator(
      [['A', 'a continent-scale geographic region', 'A) South America is a continent-scale geographic region.']],
      { kind: 'a continent-scale geographic region', span: 'x' },
    );
    const { eliminated } = deriveTerminatorEliminations(OPT, null, null, disc);
    expect(eliminated).toHaveLength(0);
  });

  // D-BP154-020/BISHOP-SEG/S20/seg-discriminator2 -- THE VOCABULARY MISMATCH FIX. Deliberately
  // uses invented, qid-98-UNRELATED words ("Alpha Grade"/"Beta Grade"/"Gamma Type") so this
  // asserts the MECHANISM (list-split + parenthetical-strip + singular/plural fold), never
  // anything tuned to this specific question's real vocabulary (FD-BP153-06's own "would this
  // rule survive on a question whose answer we do not know" bar).
  test('Discriminator does NOT eliminate an option whose singular kind is ONE ITEM of a compound (list) category-denoting kind', () => {
    const disc = discriminator(
      [
        ['A', 'Alpha Grade (a top-tier classification)', 'A) is Alpha Grade (a top-tier classification).'],
        ['B', 'Beta Grade (a mid-tier classification)', 'B) is Beta Grade (a mid-tier classification).'],
        ['C', 'Gamma Type (an unrelated classification)', 'C) is Gamma Type (an unrelated classification).'],
      ],
      {
        kind: 'Alpha Grades and Beta Grades',
        span: 'the classifications that properly denote the category are Alpha Grades and Beta Grades',
      },
    );
    const { eliminated } = deriveTerminatorEliminations(OPT, null, null, disc);
    const eliminatedLetters = new Set(eliminated.map((e) => e.letter));
    // A and B each match ONE item of the compound list (after singular/plural fold + parenthetical
    // strip) -- neither is eliminated. C matches neither list item -- it IS eliminated. Before this
    // fix, byte-identity against the WHOLE compound string would have wrongly eliminated all three.
    expect(eliminatedLetters.has('A')).toBe(false);
    expect(eliminatedLetters.has('B')).toBe(false);
    expect(eliminatedLetters.has('C')).toBe(true);
  });

  // D-BP154-021/BISHOP-SEG/S21/seg-mortgagetrap FIX -- LIVE-MEASURED bug in D-BP154-020's own
  // stripParenthetical() (end-anchored only): a categoryKind with a parenthetical in the MIDDLE
  // of the string (not just at the end) had its own internal commas/"and" mis-read as additional
  // top-level list separators, corrupting the split and wrongly eliminating options that genuinely
  // matched. Invented vocabulary, structurally identical to the real qid 98 shape that exposed it
  // ("Geopolitical Macro-Regions (such as South Asia, North Africa, and Central Asia) and
  // Continents (such as Europe and South America)") but with none of its real words.
  test('a categoryKind with a MIDDLE (non-trailing) parenthetical containing its own commas/"and" still splits correctly', () => {
    const disc = discriminator(
      [
        ['A', 'Alpha Grade', 'A) is Alpha Grade.'],
        ['B', 'Beta Grade', 'B) is Beta Grade.'],
        ['C', 'Gamma Type', 'C) is Gamma Type.'],
      ],
      {
        kind: 'Alpha Grades (such as Delta, Epsilon, and Zeta) and Beta Grades (such as Eta and Theta)',
        span: 'x',
      },
    );
    const { eliminated } = deriveTerminatorEliminations(OPT, null, null, disc);
    const eliminatedLetters = new Set(eliminated.map((e) => e.letter));
    // A ("Alpha Grade") and B ("Beta Grade") each match one of the two REAL list items -- the
    // parenthetical examples inside each item must NOT be read as extra list separators. Before
    // this fix, A and B were wrongly eliminated (the exact live defect).
    expect(eliminatedLetters.has('A')).toBe(false);
    expect(eliminatedLetters.has('B')).toBe(false);
    expect(eliminatedLetters.has('C')).toBe(true);
  });

  test('Discriminator STILL eliminates when the stated kind genuinely matches NEITHER the whole category string NOR any of its list items', () => {
    const disc = discriminator(
      [['A', 'Delta Class (an entirely different classification)', 'A) is Delta Class.']],
      { kind: 'Alpha Grades and Beta Grades', span: 'x' },
    );
    const { eliminated } = deriveTerminatorEliminations(OPT, null, null, disc);
    expect(eliminated).toHaveLength(1);
    expect(eliminated[0].letter).toBe('A');
  });

  // D-BP154-021/BISHOP-SEG/S21/seg-mortgagetrap -- FD-BP153-07 point 3 is about the SUPERLATIVE
  // PROPERTY, not only the bare category. Deliberately invented vocabulary (not qid 98's real
  // "world's most densely populated regions") -- proves the mechanism generalizes, per FD-BP153-06's
  // "would this rule survive on a question whose answer we do not know" bar.
  test('Discriminator eliminates an option its OWN query states IS the superlative property', () => {
    const disc = discriminator(
      [],
      null,
      [['B', 'B) is explicitly one of the recognized primary clusters.']],
    );
    const { eliminated } = deriveTerminatorEliminations(OPT, null, null, disc);
    expect(eliminated).toHaveLength(1);
    expect(eliminated[0].letter).toBe('B');
    expect(eliminated[0].sourceStep).toBe('Discriminator:1');
  });

  test('Discriminator does NOT eliminate an option no source ever states is the superlative property -- absence is omission', () => {
    const disc = discriminator([], null, []);
    const { eliminated } = deriveTerminatorEliminations(OPT, null, null, disc);
    expect(eliminated).toHaveLength(0);
  });

  // D-BP154-023/BISHOP-SEG/S23/seg-enumerate -- FD-BP154-06, Founder verbatim: "the narrow
  // reading is obtainable from a source we can cite... An option the source's own enumeration
  // does not contain is not a member of the frame." Deliberately invented vocabulary throughout
  // (never qid 98's real "world regions" or real option names) -- proves the mechanism
  // generalizes, per FD-BP153-06's own "would this rule survive on a question whose answer we do
  // not know" bar.
  describe('THE CATEGORY ENUMERATION -- FD-BP154-06', () => {
    test('an option NOT named by a productive enumeration is eliminated, sourced to the enumeration span', () => {
      const disc = discriminator(
        [], null, [],
        [['A', 'x'], ['C', 'y'], ['F', 'z']],
        'The Alpha Federation consists of exactly three member states: South America, North Africa, and Central Asia.',
      );
      const { eliminated } = deriveTerminatorEliminations(OPT, null, null, disc);
      const eliminatedLetters = new Set(eliminated.map((e) => e.letter));
      // A, C, F are named -- not eliminated. Every OTHER option (B, D, E, G, H, I) is eliminated,
      // sourced to Discriminator:1 with the enumeration's own span as evidence.
      expect(eliminatedLetters.has('A')).toBe(false);
      expect(eliminatedLetters.has('C')).toBe(false);
      expect(eliminatedLetters.has('F')).toBe(false);
      for (const L of ['B', 'D', 'E', 'G', 'H', 'I']) {
        expect(eliminatedLetters.has(L), `${L} should be eliminated (not named by the enumeration)`).toBe(true);
      }
      const bElim = eliminated.find((e) => e.letter === 'B');
      expect(bElim?.sourceStep).toBe('Discriminator:1');
      expect(bElim?.span).toContain('The Alpha Federation consists of');
    });

    test('NO enumeration stated at all -> zero eliminations via this mechanism -- absence is omission, not denial', () => {
      const disc = discriminator([], null, [], [], null);
      const { eliminated } = deriveTerminatorEliminations(OPT, null, null, disc);
      expect(eliminated).toHaveLength(0);
    });

    test('an enumeration span exists but names ZERO of our options -- never trusted to eliminate everyone (the real live risk this gate closes)', () => {
      // categoryEnumerationSpan is non-null (a genuine enumeration WAS given) but
      // categoryEnumerationMembers is EMPTY (none of it verifiably mapped to our option set --
      // e.g. the source enumerated in different-granularity words). Must NOT collapse every
      // option to eliminated.
      const disc = discriminator([], null, [], [], 'The Federation consists of Redland, Blueland, and Greenland.');
      const { eliminated } = deriveTerminatorEliminations(OPT, null, null, disc);
      expect(eliminated).toHaveLength(0);
    });

    test('CONTRADICTION: Softballs excludes an option the enumeration explicitly names as a member', () => {
      const sb = softballs([['C', 'C) is not a world region.']]);
      const disc = discriminator([], null, [], [['A', 'x'], ['C', 'y']], 'The list consists of South America and North Africa.');
      const { contradiction } = deriveTerminatorEliminations(OPT, sb, null, disc);
      expect(contradiction).not.toBeNull();
      expect(contradiction?.letter).toBe('C');
    });
  });

  test('CONTRADICTION: the same letter excluded by Softballs and included by NamedSet aborts publication', () => {
    const sb = softballs([['B', 'B) South Asia is not a world region.']]);
    const ns = namedSet([['B', 'B) South Asia is one of the most densely populated regions.']]);
    const { contradiction } = deriveTerminatorEliminations(OPT, sb, ns, null);
    expect(contradiction).not.toBeNull();
    expect(contradiction?.letter).toBe('B');
  });

  test('CONTRADICTION: the same letter excluded by Softballs and stated a superlative-property member by Discriminator aborts publication', () => {
    const sb = softballs([['B', 'B) South Asia is not a world region.']]);
    const disc = discriminator([], null, [['B', 'B) is explicitly one of the recognized primary clusters.']]);
    const { contradiction } = deriveTerminatorEliminations(OPT, sb, null, disc);
    expect(contradiction).not.toBeNull();
    expect(contradiction?.letter).toBe('B');
  });

  test('a failed (ok:false) feeder step is treated as not-run, not as "confirmed nothing"', () => {
    const failedSoftballs: SoftballsResult = {
      ok: false, category: null, query: null, excluded: [], discarded: 0, notExcluded: Object.keys(OPT),
      via: 'n/a', error: 'no usable answer from any authority',
    };
    // runTerminatorStep()'s own caller (script_bridge.ts) passes null in place of a failed
    // (ok:false) step's raw result -- deriveTerminatorEliminations() itself only ever receives an
    // ok:true result or null, so this test documents that contract at the boundary the real
    // caller enforces, using the pure function directly.
    const { eliminated } = deriveTerminatorEliminations(OPT, failedSoftballs.ok ? failedSoftballs : null, null, null);
    expect(eliminated).toEqual([]);
  });
});

describe('runTerminatorStep -- UNIQUE OR ABSTAIN end to end over the pure reducer', () => {
  const input: MethodQuestionInput = {
    qid: 98,
    question: "Which of the following world regions is NOT considered one of the world's most densely populated regions?",
    options: OPT,
  };
  const ctx: MethodRunContext = { askGoogle: async () => null, emit: () => {} };

  test('exactly one survivor -> a verdict is returned, with a full elimination basis', async () => {
    const softballsOutcome = { id: 'Softballs:1', summary: 's', raw: softballs([['D', 'D) not a world region.']]) };
    const namedSetOutcome = {
      id: 'NamedSet:1', summary: 's',
      raw: namedSet(Object.keys(OPT).filter((L) => L !== 'A' && L !== 'D').map((L) => [L, `${L}) is densely populated.`] as [string, string])),
    };
    const { result } = await runTerminatorStep(input, ctx, [softballsOutcome, namedSetOutcome]);
    expect(result.ok).toBe(true);
    expect(result.abstain).toBe(false);
    expect(result.verdict).toBe('A');
    expect(result.contradiction).toBeNull();
  });

  test('more than one survivor -> ABSTAIN naming the blocker, never a guess among them', async () => {
    const softballsOutcome = { id: 'Softballs:1', summary: 's', raw: softballs([['D', 'not a region']]) };
    const { result } = await runTerminatorStep(input, ctx, [softballsOutcome]);
    expect(result.ok).toBe(true);
    expect(result.abstain).toBe(true);
    expect(result.verdict).toBeNull();
    expect(result.survivors.length).toBeGreaterThan(1);
  });

  // D-BP154-022/BISHOP-SEG/S22/seg-magnitude -- FD-BP153-01, "magnitude decides only among the
  // survivors". Softballs leaves exactly {A, B} as the frame (7 of 9 eliminated) so these tests
  // isolate the extreme-picking mechanism itself, independent of the real qid 98 property words.
  describe('Magnitude:1 breaks a multi-survivor tie -- FD-BP153-01', () => {
    const twoSurvivorSoftballs = softballs(
      ['C', 'D', 'E', 'F', 'G', 'H', 'I'].map((L) => [L, `${L}) not a world region.`] as [string, string]),
    );
    const twoSurvivorOutcome = { id: 'Softballs:1', summary: 's', raw: twoSurvivorSoftballs };

    test('a fully-ranked, frame-matched, LEAST-targeting Magnitude:1 picks the LAST (least) entry as verdict', async () => {
      const mag = magnitude(['A', 'B'], 'least', 'Alpha Grade', [['A', 'A is more Alpha than B.'], ['B', 'B is less Alpha than A.']]);
      const magOutcome = { id: 'Magnitude:1', summary: 's', raw: mag };
      const { result } = await runTerminatorStep(input, ctx, [twoSurvivorOutcome, magOutcome]);
      expect(result.abstain).toBe(false);
      expect(result.verdict).toBe('B'); // the LAST (least) entry of a most-to-least order
      expect(result.magnitudeBasis).not.toBeNull();
      expect(result.magnitudeBasis?.targetExtreme).toBe('least');
      expect(result.magnitudeBasis?.span).toBe('B is less Alpha than A.');
    });

    test('a fully-ranked, frame-matched, MOST-targeting Magnitude:1 picks the FIRST (most) entry as verdict', async () => {
      const mag = magnitude(['A', 'B'], 'most', 'Alpha Grade', [['A', 'A is more Alpha than B.'], ['B', 'B is less Alpha than A.']]);
      const magOutcome = { id: 'Magnitude:1', summary: 's', raw: mag };
      const { result } = await runTerminatorStep(input, ctx, [twoSurvivorOutcome, magOutcome]);
      expect(result.abstain).toBe(false);
      expect(result.verdict).toBe('A'); // the FIRST (most) entry of a most-to-least order
    });

    test('Magnitude:1 ranking a DIFFERENT frame than this reduction computed is refused, not trusted', async () => {
      // Magnitude ranked {A, C} -- not the {A, B} this Softballs basis actually leaves.
      const mag = magnitude(['A', 'C'], 'least', 'Alpha Grade', [['A', 'x'], ['C', 'y']]);
      const magOutcome = { id: 'Magnitude:1', summary: 's', raw: mag };
      const { result } = await runTerminatorStep(input, ctx, [twoSurvivorOutcome, magOutcome]);
      expect(result.abstain).toBe(true);
      expect(result.verdict).toBeNull();
      expect(result.abstainReason).toContain('DIFFERENT frame');
    });

    test('a PARTIAL ranking (an unranked frame survivor) is refused -- cannot honestly name the true extreme', async () => {
      const mag = magnitude(['A', 'B'], 'least', 'Alpha Grade', [['A', 'A is more Alpha than B.']], ['B']);
      const magOutcome = { id: 'Magnitude:1', summary: 's', raw: mag };
      const { result } = await runTerminatorStep(input, ctx, [twoSurvivorOutcome, magOutcome]);
      expect(result.abstain).toBe(true);
      expect(result.verdict).toBeNull();
      expect(result.abstainReason).toContain('unranked');
    });

    test('a FAILED Magnitude:1 (ok:false) is treated as unavailable, ABSTAIN as before this ticket', async () => {
      const failedMag: MagnitudeResult = {
        ok: false, frame: [], property: null, targetExtreme: null, query: null, order: [], discarded: 0,
        unranked: [], via: 'n/a', disagreement: null, error: 'no usable answer from any authority',
      };
      const magOutcome = { id: 'Magnitude:1', summary: 's', raw: failedMag };
      const { result } = await runTerminatorStep(input, ctx, [twoSurvivorOutcome, magOutcome]);
      expect(result.abstain).toBe(true);
      expect(result.verdict).toBeNull();
      expect(result.abstainReason).toContain('did not succeed');
    });

    test('no Magnitude:1 in the stack at all -> the pre-existing plain multi-survivor ABSTAIN, unchanged', async () => {
      const { result } = await runTerminatorStep(input, ctx, [twoSurvivorOutcome]);
      expect(result.abstain).toBe(true);
      expect(result.verdict).toBeNull();
      expect(result.magnitudeBasis).toBeNull();
    });
  });

  test('no feeder steps run at all -> every option survives -> ABSTAIN, never a fabricated verdict', async () => {
    const { result } = await runTerminatorStep(input, ctx, []);
    expect(result.ok).toBe(true);
    expect(result.abstain).toBe(true);
    expect(result.survivors).toHaveLength(Object.keys(OPT).length);
    expect(result.stepsConsulted['Softballs:1']).toBe('not run');
    expect(result.stepsConsulted['NamedSet:1']).toBe('not run');
    expect(result.stepsConsulted['Discriminator:1']).toBe('not run');
  });

  test('a contradictory basis ABSTAINS rather than publishing, even if it would otherwise leave one survivor', async () => {
    // Contrive every OTHER option eliminated by NamedSet so B would be the sole non-contradictory
    // survivor by count alone -- the contradiction on B must still block publication.
    const othersIncluded = Object.keys(OPT).filter((L) => L !== 'B').map((L) => [L, `${L}) densely populated.`] as [string, string]);
    const softballsOutcome = { id: 'Softballs:1', summary: 's', raw: softballs([['B', 'B) not a world region.']]) };
    const namedSetOutcome = { id: 'NamedSet:1', summary: 's', raw: namedSet([...othersIncluded, ['B', 'B) densely populated.']]) };
    const { result } = await runTerminatorStep(input, ctx, [softballsOutcome, namedSetOutcome]);
    expect(result.abstain).toBe(true);
    expect(result.contradiction).not.toBeNull();
    expect(result.contradiction?.letter).toBe('B');
  });
});

describe('registerTerminatorStep / listComposerRegistry -- Terminator:1 is a real, visible, reorderable Composer entry', () => {
  test('registers under the expected id and appears in the composer registry listing', () => {
    try { registerTerminatorStep(); } catch { /* already registered by an earlier test file in this run */ }
    const entries = listComposerRegistry();
    const entry = entries.find((e) => e.id === 'Terminator:1');
    expect(entry).toBeDefined();
    expect(entry?.executable).toBe(true);
  });
});
