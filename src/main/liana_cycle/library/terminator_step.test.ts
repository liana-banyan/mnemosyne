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
import {
  computeFrameMatchBuckets, deriveTerminatorEliminations, registerTerminatorStep, runTerminatorStep,
} from './terminator_step';
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
  // D-BP154-026/BISHOP-SEG/S26/seg-subregion, ADDITIVE, optional (defaults to none): [letter,
  // span] pairs the source explicitly states are NOT the category in their own right (only a
  // subdivision within a larger region).
  subregionNonMembers: Array<[string, string]> = [],
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
    subregionNonMembers: subregionNonMembers.map(([letter, span]) => ({ letter, name: OPT[letter], span })),
    discardedSubregionNonMembers: 0,
    // D-BP154-027/BISHOP-SEG/S27/seg-register, ADDITIVE: this reducer never reads registerStatement
    // (it is display-only, never wired into any elimination) -- always null here, same discipline
    // as every other optional-default field above.
    registerStatement: null,
    registerStatementDiscarded: false,
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

  // D-BP154-024/BISHOP-SEG/S24/seg-unstated FIX -- THE LAW REVERSED, verbatim: "An option may
  // only be eliminated from the frame when the source's enumeration AFFIRMATIVELY places it
  // outside -- never because our matcher failed to find it. A failed match is UNSTATED, and an
  // UNSTATED option survives." This is FOUR STRAIGHT live defects of this exact shape
  // (ca92a439, d219bf2a, 44499f3b, and qid 98's own A dropped for stating its kind as a compound
  // phrase) -- so the rule below is now uniform: EVEN a kind that looks unambiguously different
  // ("a rainforest biome" vs "a continent-scale geographic region") is UNSTATED, not denied, via
  // this mechanism -- the only genuine denial in this estate is Softballs' own direct statement.
  test('Discriminator does NOT eliminate on a kind mismatch, however clean-looking -- UNSTATED, not denied (this is the D-BP154-024 fix, reversing the pre-fix behavior)', () => {
    const disc = discriminator(
      [
        ['A', 'a continent-scale geographic region', 'A) South America is a continent-scale geographic region.'],
        ['H', 'a rainforest biome', 'H) Amazon Rainforest is a rainforest biome.'],
      ],
      { kind: 'a continent-scale geographic region', span: 'the classification that denotes world regions is a continent-scale geographic region' },
    );
    const { eliminated } = deriveTerminatorEliminations(OPT, null, null, disc);
    expect(eliminated).toHaveLength(0);
    const buckets = computeFrameMatchBuckets(OPT, null, disc);
    expect(buckets.affirmedMember).toContain('A'); // matches the category-kind list -- reported, not gating
    expect(buckets.unstated).toContain('H'); // mismatched -- UNSTATED, survives, never eliminated
    expect(buckets.affirmedNonMember).toEqual([]); // no source ever directly denied anything here
  });

  test('Discriminator never eliminates on kind alone -- matching or not, reported via computeFrameMatchBuckets(), never via eliminated[]', () => {
    const disc = discriminator(
      [['A', 'a continent-scale geographic region', 'A) South America is a continent-scale geographic region.']],
      { kind: 'a continent-scale geographic region', span: 'x' },
    );
    const { eliminated } = deriveTerminatorEliminations(OPT, null, null, disc);
    expect(eliminated).toHaveLength(0);
    expect(computeFrameMatchBuckets(OPT, null, disc).affirmedMember).toContain('A');
  });

  // D-BP154-020/BISHOP-SEG/S20/seg-discriminator2 -- THE VOCABULARY MISMATCH FIX (list-split +
  // parenthetical-strip + singular/plural fold), still the right STRUCTURAL matching shape for
  // computeFrameMatchBuckets()'s own "affirmedMember" reporting -- D-BP154-024 only changed what
  // a NON-match does (UNSTATED, survives, instead of eliminated). Deliberately invented,
  // qid-98-UNRELATED words ("Alpha Grade"/"Beta Grade"/"Gamma Type") -- proves the mechanism,
  // never tuned to this question's real vocabulary (FD-BP153-06's own "would this rule survive
  // on a question whose answer we do not know" bar).
  test('a singular kind that IS one item of a compound (list) category-denoting kind reports as affirmedMember; one that is not reports as unstated, never eliminated', () => {
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
    // D-BP154-024: NOTHING is eliminated via kind matching anymore, matched or not.
    expect(eliminated).toHaveLength(0);
    const buckets = computeFrameMatchBuckets(OPT, null, disc);
    expect(buckets.affirmedMember).toEqual(expect.arrayContaining(['A', 'B']));
    expect(buckets.unstated).toContain('C'); // matches neither list item -- UNSTATED, not eliminated
  });

  // D-BP154-021/BISHOP-SEG/S21/seg-mortgagetrap FIX -- LIVE-MEASURED bug in D-BP154-020's own
  // stripParenthetical() (end-anchored only): a categoryKind with a parenthetical in the MIDDLE
  // of the string (not just at the end) had its own internal commas/"and" mis-read as additional
  // top-level list separators, corrupting the split. Still exercised here (via
  // computeFrameMatchBuckets()'s own reporting, since D-BP154-024 removed the elimination path
  // entirely) to prove the STRUCTURAL matcher itself stays correct. Invented vocabulary,
  // structurally identical to the real qid 98 shape that exposed it ("Geopolitical
  // Macro-Regions (such as South Asia, North Africa, and Central Asia) and Continents (such as
  // Europe and South America)") but with none of its real words.
  test('a categoryKind with a MIDDLE (non-trailing) parenthetical containing its own commas/"and" still splits correctly (reported, never eliminates)', () => {
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
    expect(eliminated).toHaveLength(0);
    const buckets = computeFrameMatchBuckets(OPT, null, disc);
    // A ("Alpha Grade") and B ("Beta Grade") each match one of the two REAL list items -- the
    // parenthetical examples inside each item must NOT be read as extra list separators.
    expect(buckets.affirmedMember).toEqual(expect.arrayContaining(['A', 'B']));
    expect(buckets.unstated).toContain('C');
  });

  // D-BP154-024/BISHOP-SEG/S24/seg-unstated -- THE EXACT LIVE DEFECT SHAPE, invented vocabulary.
  // qid 98's own A (South America) was eliminated for stating its kind as the COMPOUND phrase
  // "Continent / Macro-geographical region" against a category-kind list containing the bare
  // "Continent" -- a phrasing difference (compound vs simple), not a denial. Reproduced here with
  // wholly invented words to prove the fix is structural, not tuned to qid 98's real vocabulary.
  test('a COMPOUND per-option kind ("X / Y" shape) that does not exact-match a single list item is UNSTATED, never eliminated -- the exact live defect this ticket fixes', () => {
    const disc = discriminator(
      [['A', 'Alpha Grade / Zeta Classification', 'A) is Alpha Grade / Zeta Classification.']],
      { kind: 'Alpha Grades and Beta Grades', span: 'x' },
    );
    const { eliminated } = deriveTerminatorEliminations(OPT, null, null, disc);
    expect(eliminated).toHaveLength(0);
    const buckets = computeFrameMatchBuckets(OPT, null, disc);
    expect(buckets.unstated).toContain('A');
    expect(buckets.affirmedNonMember).toEqual([]);
  });

  test('a kind that genuinely matches NEITHER the whole category string NOR any of its list items is UNSTATED, never eliminated (post D-BP154-024)', () => {
    const disc = discriminator(
      [['A', 'Delta Class (an entirely different classification)', 'A) is Delta Class.']],
      { kind: 'Alpha Grades and Beta Grades', span: 'x' },
    );
    const { eliminated } = deriveTerminatorEliminations(OPT, null, null, disc);
    expect(eliminated).toHaveLength(0);
    expect(computeFrameMatchBuckets(OPT, null, disc).unstated).toContain('A');
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
    // D-BP154-024/BISHOP-SEG/S24/seg-unstated FIX -- THE LAW REVERSED, verbatim: "the source's
    // own enumeration does not contain [it]" used to eliminate; now it means UNSTATED, survives.
    // LIVE-MEASURED the very next dispatch after D-BP154-023 landed: qid 98's own A (South
    // America) genuinely IS named in a real enumeration a live run obtained, but the LOCAL
    // EXTRACTION failed to produce a verified span for it -- and the pre-fix rule below read
    // that EXTRACTION FAILURE as "the enumeration excludes A". Reproduced here with invented
    // vocabulary: an option absent from `categoryEnumerationMembers` is no longer eliminated,
    // full stop -- it is reported as `unstated` by computeFrameMatchBuckets() instead.
    test('an option NOT named by a productive enumeration is UNSTATED, never eliminated -- this is the D-BP154-024 fix', () => {
      const disc = discriminator(
        [], null, [],
        [['A', 'x'], ['C', 'y'], ['F', 'z']],
        'The Alpha Federation consists of exactly three member states: South America, North Africa, and Central Asia.',
      );
      const { eliminated } = deriveTerminatorEliminations(OPT, null, null, disc);
      // D-BP154-024: NOTHING is eliminated via enumeration-absence anymore -- not even the six
      // options this same enumeration never named.
      expect(eliminated).toHaveLength(0);
      const buckets = computeFrameMatchBuckets(OPT, null, disc);
      expect(buckets.affirmedMember).toEqual(expect.arrayContaining(['A', 'C', 'F']));
      for (const L of ['B', 'D', 'E', 'G', 'H', 'I']) {
        expect(buckets.unstated, `${L} should be UNSTATED (not named by the enumeration), never eliminated`).toContain(L);
      }
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

  // D-BP154-026/BISHOP-SEG/S26/seg-subregion -- THE SECOND AFFIRMATIVE-DENIAL SOURCE. Invented
  // vocabulary per FD-BP153-06: a source explicitly stating an option is a subdivision WITHIN a
  // larger region, not the region in its own right, is a legitimate elimination basis -- the exact
  // same status Softballs' own direct exclusion already has, never an inference from a kind label
  // or an enumeration's own nesting.
  describe('SUBREGION-NON-MEMBER FACTS -- D-BP154-026', () => {
    test('an option the source explicitly states is a subdivision, not the category in its own right, IS eliminated, sourced to Discriminator:1', () => {
      const disc = discriminator([], null, [], [], null, [['C', 'C) is a subdivision within a larger region, not a region on its own.']]);
      const { eliminated } = deriveTerminatorEliminations(OPT, null, null, disc);
      expect(eliminated).toHaveLength(1);
      expect(eliminated[0].letter).toBe('C');
      expect(eliminated[0].sourceStep).toBe('Discriminator:1');
      expect(eliminated[0].span).toContain('subdivision within a larger region');
    });

    test('an option the source never addresses this way is UNSTATED, never eliminated -- absence is omission', () => {
      const disc = discriminator([], null, [], [], null, [['C', 'C) is a subdivision within a larger region, not a region on its own.']]);
      const { eliminated } = deriveTerminatorEliminations(OPT, null, null, disc);
      expect(eliminated.some((e) => e.letter === 'A')).toBe(false);
      const buckets = computeFrameMatchBuckets(OPT, null, disc);
      expect(buckets.unstated).toContain('A');
    });

    test('folds into the SAME affirmedNonMember bucket as Softballs -- both answer the identical question via two independent sources', () => {
      const sb = softballs([['B', 'B) is not a world region at all.']]);
      const disc = discriminator([], null, [], [], null, [['C', 'C) is a subdivision within a larger region, not a region on its own.']]);
      const buckets = computeFrameMatchBuckets(OPT, sb, disc);
      expect(buckets.affirmedNonMember).toEqual(expect.arrayContaining(['B', 'C']));
    });

    test('CONTRADICTION: a subregion-non-member fact and a stated superlative-property member for the SAME option aborts publication', () => {
      const disc = discriminator(
        [], null,
        [['C', 'C) is explicitly one of the recognized primary clusters.']],
        [], null,
        [['C', 'C) is a subdivision within a larger region, not a region on its own.']],
      );
      const { contradiction } = deriveTerminatorEliminations(OPT, null, null, disc);
      expect(contradiction).not.toBeNull();
      expect(contradiction?.letter).toBe('C');
    });

    test('CONTRADICTION: a subregion-non-member fact and the enumeration naming the SAME option a member aborts publication', () => {
      const disc = discriminator(
        [], null, [],
        [['C', 'y']], 'The list consists of Alpha and Beta.',
        [['C', 'C) is a subdivision within a larger region, not a region on its own.']],
      );
      const { contradiction } = deriveTerminatorEliminations(OPT, null, null, disc);
      expect(contradiction).not.toBeNull();
      expect(contradiction?.letter).toBe('C');
    });

    test('NO RULE SELECTS A PARTICULAR LETTER: the identical fact eliminates identically regardless of which letter carries it', () => {
      const discA = discriminator([], null, [], [], null, [['A', 'A) is a subdivision within a larger region, not a region on its own.']]);
      const discH = discriminator([], null, [], [], null, [['H', 'H) is a subdivision within a larger region, not a region on its own.']]);
      expect(deriveTerminatorEliminations(OPT, null, null, discA).eliminated.map((e) => e.letter)).toEqual(['A']);
      expect(deriveTerminatorEliminations(OPT, null, null, discH).eliminated.map((e) => e.letter)).toEqual(['H']);
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
    // D-BP154-028/BISHOP-SEG/S28/seg-survivable: 'not run' is NOT incomplete -- a step the operator
    // never stacked was never expected to run.
    expect(result.incomplete).toBe(false);
  });

  // D-BP154-028/BISHOP-SEG/S28/seg-survivable. Founder's own rule, this dispatch: "A step that
  // failed must never be indistinguishable from a step that ran and found nothing... an ABSTAIN
  // from an incomplete run is a different animal from an ABSTAIN with all steps green, and today
  // they look identical." These tests prove the two are now distinguishable, structurally
  // (`incomplete`) and in the human-readable basis text (`summary`).
  describe('incomplete run detection -- a FAILED step is distinguishable from a clean one', () => {
    const failedSoftballs: SoftballsResult = {
      ok: false, category: null, query: null, excluded: [], discarded: 0, notExcluded: Object.keys(OPT),
      via: 'n/a', error: 'authority timed out',
    };

    test('a genuinely FAILED (ok:false) feeder step marks the run incomplete, on an ABSTAIN', async () => {
      const failedOutcome = { id: 'Softballs:1', summary: 's', raw: failedSoftballs };
      const { result, summary } = await runTerminatorStep(input, ctx, [failedOutcome]);
      expect(result.abstain).toBe(true);
      expect(result.stepsConsulted['Softballs:1']).toBe('failed');
      expect(result.incomplete).toBe(true);
      expect(summary).toContain('RUN INCOMPLETE');
      expect(summary).toContain('Softballs:1');
    });

    test('a genuinely FAILED (ok:false) feeder step marks the run incomplete even on a VERDICT', async () => {
      // NamedSet alone leaves exactly one survivor (A) -- a real verdict is reached even though
      // Softballs (which never contributed an elimination here) failed outright.
      const failedOutcome = { id: 'Softballs:1', summary: 's', raw: failedSoftballs };
      const namedSetOutcome = {
        id: 'NamedSet:1', summary: 's',
        raw: namedSet(Object.keys(OPT).filter((L) => L !== 'A').map((L) => [L, `${L}) is densely populated.`] as [string, string])),
      };
      const { result, summary } = await runTerminatorStep(input, ctx, [failedOutcome, namedSetOutcome]);
      expect(result.abstain).toBe(false);
      expect(result.verdict).toBe('A');
      expect(result.incomplete).toBe(true);
      expect(summary).toContain('VERDICT');
      expect(summary).toContain('RUN INCOMPLETE');
    });

    test('every consulted step green -> incomplete is false, and the summary says so plainly', async () => {
      const softballsOutcome = { id: 'Softballs:1', summary: 's', raw: softballs([['D', 'D) not a world region.']]) };
      const namedSetOutcome = {
        id: 'NamedSet:1', summary: 's',
        raw: namedSet(Object.keys(OPT).filter((L) => L !== 'A' && L !== 'D').map((L) => [L, `${L}) is densely populated.`] as [string, string])),
      };
      const { result, summary } = await runTerminatorStep(input, ctx, [softballsOutcome, namedSetOutcome]);
      expect(result.incomplete).toBe(false);
      expect(summary).not.toContain('RUN INCOMPLETE');
      expect(summary).toContain('run complete');
    });
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
