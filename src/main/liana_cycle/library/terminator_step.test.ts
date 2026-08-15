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
import type { HumanNuanceResult } from './human_nuance_step';
import { CORPUS_META_TRUTH } from './human_nuance_step';
import type { UnitaryResult } from './unitary_step';
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

/** D-BP154-033/BISHOP-SEG/S30-continuation/seg-wire-humannuance, ADDITIVE. `excluded` is
 *  [letter, reason, span] triples -- HumanNuanceResult's own shape (a stated exclusion reason,
 *  distinct from Softballs'/NamedSet's own two-field entries). */
function humanNuance(excluded: Array<[string, string, string]>): HumanNuanceResult {
  return {
    ok: true, artifactClassEstablished: true, src: 'ori_mmlu-test', corpusMetaTruth: null,
    cowGuard: { applies: true, reason: 'test' }, category: 'world regions',
    frame: Object.keys(OPT).filter((L) => !excluded.some(([l]) => l === L)),
    nonParticipants: excluded.map(([l]) => l),
    originStratum: 'sand', singleAnswerPropertySurvived: null, answerDerivableFromQuestionTermsAlone: null,
    query: 'q',
    excluded: excluded.map(([letter, reason, span]) => ({ letter, name: OPT[letter], reason, span })),
    // D-BP154-036/BISHOP-SEG/S36/seg-wireit, ADDITIVE: HumanNuanceResult gained three fields
    // (declared-feature classification, FD-BP154-11) -- this fixture predates that ticket and
    // builds entries by hand rather than through verifyAndClassifyHumanNuanceKinds(), so it has no
    // real feature data to report; empty/default values are correct here, not a shortcut.
    insufficientEvidence: [], consistent: [], featureRuleVersion: 'test',
    discarded: 0, unresolved: [], via: 'test',
  };
}

/** D-BP154-043/BISHOP-SEG/S43/seg-unitary. The REAL shape runHumanNuanceStep() produces when the
 *  artifact class is genuinely established -- `corpusMetaTruth` set to the real, exported
 *  CORPUS_META_TRUTH constant (never a hand-invented value), since humanNuance()'s own fixture,
 *  above, predates this amendment and deliberately leaves it null (proving the amendment does NOT
 *  fire for that pre-existing fixture -- see this file's own test below). */
function humanNuanceWithArtifactClassEstablished(): HumanNuanceResult {
  return { ...humanNuance([]), corpusMetaTruth: CORPUS_META_TRUTH };
}

function unitary(excluded: Array<[string, string]>): UnitaryResult {
  return {
    ok: true, query: 'q',
    excluded: excluded.map(([letter, span]) => ({ letter, name: OPT[letter], span })),
    confirmedUnitary: [],
    discarded: 0,
    notExcluded: Object.keys(OPT).filter((L) => !excluded.some(([l]) => l === L)),
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

  // D-BP154-014/BISHOP-SEG/S40/seg-magnitude-gate, NEW. FD-BP154-14 (RULINGS_BP154.md): "Magnitude
  // should not run once membership is settled - ruled." Reproduces the LIVE DEFECT this ruling
  // fixes (LIANA_COMPOSER_RUN_qid98_2026-08-14T21-59-51-048Z.json: NamedSet:1 found one stated
  // property member, eliminating it; the remaining survivors -- ALL non-members by construction --
  // were then ranked by Magnitude:1 and a "least dense of several equally-correct answers" was
  // published as a confident verdict) with INVENTED vocabulary (FD-BP153-06 discipline, this
  // file's own header), not qid 98's real words.
  describe('FD-BP154-14: Magnitude:1 does not run once the membership test has already partitioned the options', () => {
    // Softballs leaves {A, B, C} as the frame (D-I eliminated as not-the-category-at-all).
    const threeSurvivorSoftballs = softballs(
      ['D', 'E', 'F', 'G', 'H', 'I'].map((L) => [L, `${L}) not a Zorblatt cluster.`] as [string, string]),
    );
    const threeSurvivorOutcome = { id: 'Softballs:1', summary: 's', raw: threeSurvivorSoftballs };

    test('NamedSet:1 found ONE stated property member (now eliminated) -- the remaining survivors are non-members by construction; Magnitude:1, even fully-ranked and frame-matched, is NOT consulted -- ABSTAIN, not a ranking', async () => {
      const ns = namedSet([['C', 'C) is explicitly one of the galaxy\'s most luminous Zorblatt clusters.']]);
      const namedSetOutcome = { id: 'NamedSet:1', summary: 's', raw: ns };
      // A CLEAN, fully-ranked, frame-matched Magnitude:1 over the ACTUAL survivors {A, B} (C was
      // just eliminated by NamedSet above) -- exactly the shape that, before this ruling, would
      // have been trusted and published as a verdict.
      const mag = magnitude(['A', 'B'], 'least', 'luminosity', [['A', 'A is more luminous than B.'], ['B', 'B is less luminous than A.']]);
      const magOutcome = { id: 'Magnitude:1', summary: 's', raw: mag };
      const { result, summary } = await runTerminatorStep(input, ctx, [threeSurvivorOutcome, namedSetOutcome, magOutcome]);
      expect(result.abstain).toBe(true);
      expect(result.verdict).toBeNull();
      expect(result.magnitudeBasis).toBeNull(); // magnitude contributed NOTHING to this outcome
      expect(result.abstainReason).toContain('FD-BP154-14');
      expect(result.abstainReason).toContain('Magnitude:1 not consulted');
      expect(result.abstainReason).toContain('C) North Africa'); // names the stated member that caused the partition (this file's own OPT)
      expect(summary).toContain('FD-BP154-14');
    });

    test('Discriminator:1\'s own propertyMembers (not NamedSet) also triggers the gate -- either source of a stated property member counts', async () => {
      const disc = discriminator([], null, [['B', 'B) is explicitly a member of the property.']]);
      const discOutcome = { id: 'Discriminator:1', summary: 's', raw: disc };
      const mag = magnitude(['A', 'C'], 'most', 'luminosity', [['A', 'A is most luminous.'], ['C', 'C is less luminous.']]);
      const magOutcome = { id: 'Magnitude:1', summary: 's', raw: mag };
      const { result } = await runTerminatorStep(input, ctx, [threeSurvivorOutcome, discOutcome, magOutcome]);
      expect(result.abstain).toBe(true);
      expect(result.verdict).toBeNull();
      expect(result.abstainReason).toContain('FD-BP154-14');
    });

    test('AMENDS, DOES NOT REPLACE, FD-BP153-01: when NEITHER NamedSet:1 nor Discriminator:1 ever found a stated property member (a genuine "which is the extreme" question, no partition), Magnitude:1 still resolves the verdict exactly as before this ruling', async () => {
      const ns = namedSet([]); // ran, found nothing -- ok:true, included: [] -- NOT a partition
      const namedSetOutcome = { id: 'NamedSet:1', summary: 's', raw: ns };
      const mag = magnitude(['A', 'B', 'C'], 'least', 'luminosity', [
        ['A', 'A is most luminous.'], ['B', 'B is next.'], ['C', 'C is least luminous.'],
      ]);
      const magOutcome = { id: 'Magnitude:1', summary: 's', raw: mag };
      const { result } = await runTerminatorStep(input, ctx, [threeSurvivorOutcome, namedSetOutcome, magOutcome]);
      expect(result.abstain).toBe(false);
      expect(result.verdict).toBe('C'); // magnitude legitimately decides -- no membership partition occurred
      expect(result.magnitudeBasis).not.toBeNull();
    });

    // THE EXACT LIVE SHAPE, qid 98's own real words, reproducing LIANA_COMPOSER_RUN_qid98_
    // 2026-08-14T21-59-51-048Z.json's own mechanism precisely (this ONE test deliberately breaks
    // the invented-vocabulary convention, matching D-BP154-029's own "the exact live shape" test
    // immediately above it in this file) -- proves the gate fires on the REAL defect, not only an
    // analogous invented one.
    test('THE EXACT LIVE DEFECT THIS RULING FIXES: qid 98\'s own real shape -- NamedSet finds South Asia a member, Magnitude ranks the rest and would have published F -- now ABSTAINS instead', async () => {
      const qid98Softballs = softballs([
        ['D', 'D) Northeast United States is a subnational region, not a world region.'],
        ['G', 'G) Arctic Circle is a line of latitude, not a world region.'],
        ['H', 'H) Amazon Rainforest is a biome, not a world region.'],
        ['I', 'I) Sahara Desert is a desert, not a world region.'],
      ]);
      const qid98NamedSet = namedSet([['B', 'B) South Asia is explicitly one of the world\'s most densely populated regions.']]);
      const qid98Magnitude = magnitude(['A', 'C', 'E', 'F'], 'least', "world's most densely populated regions", [
        ['E', 'Europe > North Africa > South America > Central Asia'],
        ['C', 'Europe > North Africa > South America > Central Asia'],
        ['A', 'Europe > North Africa > South America > Central Asia'],
        ['F', 'Europe > North Africa > South America > Central Asia'],
      ]);
      const { result } = await runTerminatorStep(input, ctx, [
        { id: 'Softballs:1', summary: 's', raw: qid98Softballs },
        { id: 'NamedSet:1', summary: 's', raw: qid98NamedSet },
        { id: 'Magnitude:1', summary: 's', raw: qid98Magnitude },
      ]);
      expect(result.abstain).toBe(true);
      expect(result.verdict).toBeNull();
      expect(result.verdict).not.toBe('F'); // the confident-wrong letter this ruling exists to stop
      expect(result.abstainReason).toContain('FD-BP154-14');
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

    // D-BP154-029/BISHOP-SEG/S29/seg-withhold FIX, REVERSING this test's own pre-fix expectation.
    // Founder's own rule, verbatim, this dispatch: "An incomplete run may not publish a verdict...
    // A flag that records a problem while the system proceeds as if there were none is not a fix."
    // The dispatch's own live receipt caught EXACTLY this shape (NamedSet:1 failed, Magnitude:1
    // ranked the wrong survivor set, Terminator published F anyway with incomplete:true recorded
    // but ignored) -- this test now proves the withhold, not the publish.
    test('a genuinely FAILED (ok:false) feeder step WITHHOLDS what would otherwise be a unique-survivor VERDICT -- never published', async () => {
      // NamedSet alone would leave exactly one survivor (A) -- but Softballs (which never
      // contributed an elimination here) failed outright, so the run is incomplete and the
      // would-be verdict must be withheld, not published.
      const failedOutcome = { id: 'Softballs:1', summary: 's', raw: failedSoftballs };
      const namedSetOutcome = {
        id: 'NamedSet:1', summary: 's',
        raw: namedSet(Object.keys(OPT).filter((L) => L !== 'A').map((L) => [L, `${L}) is densely populated.`] as [string, string])),
      };
      const { result, summary } = await runTerminatorStep(input, ctx, [failedOutcome, namedSetOutcome]);
      expect(result.abstain).toBe(true);
      expect(result.verdict).toBeNull();
      expect(result.incomplete).toBe(true);
      expect(result.abstainReason).toContain('WITHHELD');
      expect(result.abstainReason).toContain('A) South America'); // names what WOULD have published
      expect(result.abstainReason).toContain('Softballs:1 failed');
      expect(summary).toContain('WITHHELD');
      expect(summary).toContain('RUN INCOMPLETE');
    });

    // D-BP154-029, NEW. The EXACT live shape the dispatch's own receipt caught: a clean,
    // fully-ranked, frame-matched Magnitude:1 verdict, withheld because a DIFFERENT feeder step
    // (NamedSet:1) failed -- Magnitude:1 itself did nothing wrong; the survivor set it ranked was
    // built from a partial elimination basis, so its own otherwise-honest ranking cannot be
    // trusted either.
    test('a FAILED NamedSet:1 withholds an otherwise-clean Magnitude:1 verdict too -- the exact live shape this ticket fixes', async () => {
      const failedNamedSet: NamedSetResult = {
        ok: false, property: null, query: null, included: [], discarded: 0, notIncluded: Object.keys(OPT), via: 'n/a', error: 'authority timed out',
      };
      const failedOutcome = { id: 'NamedSet:1', summary: 's', raw: failedNamedSet };
      const twoSurvivorSoftballsOutcome = {
        id: 'Softballs:1', summary: 's',
        raw: softballs(['C', 'D', 'E', 'F', 'G', 'H', 'I'].map((L) => [L, `${L}) not a world region.`] as [string, string])),
      };
      const mag = magnitude(['A', 'B'], 'least', 'Alpha Grade', [['A', 'A is more Alpha than B.'], ['B', 'B is less Alpha than A.']]);
      const magOutcome = { id: 'Magnitude:1', summary: 's', raw: mag };
      const { result, summary } = await runTerminatorStep(input, ctx, [twoSurvivorSoftballsOutcome, failedOutcome, magOutcome]);
      expect(result.abstain).toBe(true);
      expect(result.verdict).toBeNull();
      expect(result.incomplete).toBe(true);
      expect(result.magnitudeBasis).toBeNull(); // withheld, not credited as a real basis
      expect(result.abstainReason).toContain('WITHHELD');
      expect(result.abstainReason).toContain('B) South Asia'); // names what Magnitude:1 WOULD have named
      expect(result.abstainReason).toContain('NamedSet:1 failed');
      expect(summary).toContain('WITHHELD');
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

describe('D-BP154-033: HumanNuance:1 is wired into deriveTerminatorEliminations() -- ACTIVE, not just BUILT', () => {
  const input: MethodQuestionInput = {
    qid: 98,
    question: "Which of the following world regions is NOT considered one of the world's most densely populated regions?",
    options: OPT,
  };
  const ctx: MethodRunContext = { askGoogle: async () => null, emit: () => {} };

  test('a HumanNuance:1 exclusion, alone, eliminates that option and changes the survivor set', () => {
    const { eliminated, contradiction } = deriveTerminatorEliminations(
      OPT, null, null, null,
      humanNuance([['G', 'lacks usual human settlement', 'G) Arctic Circle lacks usual human settlement.']]),
    );
    expect(contradiction).toBeNull();
    expect(eliminated).toHaveLength(1);
    expect(eliminated[0]).toMatchObject({ letter: 'G', sourceStep: 'HumanNuance:1' });
  });

  test('runTerminatorStep(): stacking HumanNuance:1 alongside Softballs:1 narrows the survivors further than Softballs alone would', async () => {
    const softballsOutcome = { id: 'Softballs:1', summary: 's', raw: softballs([['H', 'H) not a world region.']]) };
    const humanNuanceOutcome = {
      id: 'HumanNuance:1', summary: 's',
      raw: humanNuance([['G', 'lacks usual human settlement', 'G) Arctic Circle lacks usual human settlement.'], ['I', 'sparsely settled', 'I) Sahara Desert is sparsely settled.']]),
    };
    const { result } = await runTerminatorStep(input, ctx, [softballsOutcome, humanNuanceOutcome]);
    expect(result.stepsConsulted['HumanNuance:1']).toBe('ok');
    expect(result.survivors).not.toContain('G');
    expect(result.survivors).not.toContain('I');
    expect(result.survivors).not.toContain('H');
    expect(result.eliminated.some((e) => e.sourceStep === 'HumanNuance:1' && e.letter === 'G')).toBe(true);
  });

  test('a HumanNuance:1 exclusion contradicting NamedSet:1 membership ABSTAINS rather than publishing', () => {
    const { contradiction } = deriveTerminatorEliminations(
      OPT, null, namedSet([['B', 'B) densely populated.']]), null,
      humanNuance([['B', 'excluded for testing', 'B) is excluded for testing.']]),
    );
    expect(contradiction).not.toBeNull();
    expect(contradiction?.letter).toBe('B');
  });

  test('a step this file does not stack is "not run", never conflated with "ran and abstained"', async () => {
    const softballsOutcome = { id: 'Softballs:1', summary: 's', raw: softballs([['H', 'H) not a world region.']]) };
    const { result } = await runTerminatorStep(input, ctx, [softballsOutcome]);
    expect(result.stepsConsulted['HumanNuance:1']).toBe('not run');
  });

  // D-BP154-041 PART 2/3, FD-BP154-17 -- THE ACCEPTANCE TEST. Purpose:1 found the evidence class
  // structurally incapable (qid 98's own nine-option shape) -- the Terminator must withhold BEFORE
  // even looking at Softballs/NamedSet/Discriminator, report a DISTINCT insufficientEvidence field,
  // and never mark the run incomplete (nothing failed; the query-issuing steps were never asked).
  test('Purpose:1 INSUFFICIENT -> Terminator withholds with a distinct insufficientEvidence, incomplete stays false', async () => {
    const purposeOutcome = {
      id: 'Purpose:1', summary: 's',
      raw: {
        ok: true, purposeType: 'NEGATED_SUPERLATIVE_MEMBERSHIP', candidates: [], survivors: [], eliminated: [],
        sufficiency: {
          purposeType: 'NEGATED_SUPERLATIVE_MEMBERSHIP', preconditionId: 'negated-superlative-member-bound',
          preconditionDescription: 'test', sufficient: false, reason: 'INSUFFICIENT EVIDENCE -- test reason',
          policyVersion: '1',
        },
        via: 'test',
      },
    };
    const { result, summary } = await runTerminatorStep(input, ctx, [purposeOutcome]);
    expect(result.ok).toBe(true);
    expect(result.abstain).toBe(true);
    expect(result.verdict).toBeNull();
    expect(result.insufficientEvidence).not.toBeNull();
    expect(result.insufficientEvidence?.preconditionId).toBe('negated-superlative-member-bound');
    expect(result.abstainReason).toMatch(/INSUFFICIENT EVIDENCE/);
    expect(result.incomplete).toBe(false);
    // D-BP154-046 FIX 1: Purpose:1 ran (ok:true) but stated zero survivors in this fixture --
    // formally successful, substantively hollow -- the antonymic canon's third state.
    expect(result.stepsConsulted['Purpose:1']).toBe('ok-but-unproductive');
    expect(result.eliminated).toEqual([]);
    expect(summary).toMatch(/INSUFFICIENT EVIDENCE/);
  });

  test('Purpose:1 SUFFICIENT -> the normal elimination path runs unaffected', async () => {
    const purposeOutcome = {
      id: 'Purpose:1', summary: 's',
      raw: {
        ok: true, purposeType: 'NEGATED_SUPERLATIVE_MEMBERSHIP', candidates: [], survivors: [], eliminated: [],
        sufficiency: {
          purposeType: 'NEGATED_SUPERLATIVE_MEMBERSHIP', preconditionId: 'negated-superlative-member-bound',
          preconditionDescription: 'test', sufficient: true, reason: 'sufficient', policyVersion: '1',
        },
        via: 'test',
      },
    };
    const softballsOutcome = { id: 'Softballs:1', summary: 's', raw: softballs([['D', 'D) not a world region.']]) };
    const namedSetOutcome = {
      id: 'NamedSet:1', summary: 's',
      raw: namedSet(Object.keys(OPT).filter((L) => L !== 'A' && L !== 'D').map((L) => [L, `${L}) is densely populated.`] as [string, string])),
    };
    const { result } = await runTerminatorStep(input, ctx, [purposeOutcome, softballsOutcome, namedSetOutcome]);
    expect(result.insufficientEvidence).toBeNull();
    expect(result.verdict).toBe('A');
  });

  // D-BP154-041 PART 3/3 -- QUALIFIER 1: "SKIPPED-AS-MOOT is not FAILED... must NOT mark the run
  // incomplete." A skip marker (the SAME shape script_bridge.ts's computeStepSkip() produces) sits
  // in `priorResults` as Magnitude:1's own raw result -- proves stepStatus() reports the THIRD
  // status 'skipped-moot' (never 'failed') and `incomplete` stays false.
  test('a Magnitude:1 SKIPPED-AS-MOOT marker reports "skipped-moot", never "failed", and never marks incomplete', async () => {
    const softballsOutcome = { id: 'Softballs:1', summary: 's', raw: softballs([['D', 'D) not a world region.']]) };
    const namedSetOutcome = {
      id: 'NamedSet:1', summary: 's',
      raw: namedSet(Object.keys(OPT).filter((L) => L !== 'A' && L !== 'D').map((L) => [L, `${L}) is densely populated.`] as [string, string])),
    };
    const magnitudeSkipMarker = { id: 'Magnitude:1', summary: 'skipped', raw: { ok: false, skipped: true, skipReason: 'SKIPPED-AS-MOOT (test)' } };
    const { result } = await runTerminatorStep(input, ctx, [softballsOutcome, namedSetOutcome, magnitudeSkipMarker]);
    expect(result.stepsConsulted['Magnitude:1']).toBe('skipped-moot');
    expect(result.incomplete).toBe(false);
    expect(result.verdict).toBe('A');
  });
});

describe('D-BP154-043: Unitary:1 is wired into deriveTerminatorEliminations() -- FD-BP154-16 unitary-vs-conglomerate factor', () => {
  test('a Unitary:1 exclusion eliminates the named option with its own sourceStep and span', () => {
    const un = unitary([['F', 'F) Central Asia is not considered a single world region, but a conglomerate of multiple countries.']]);
    const { eliminated, contradiction } = deriveTerminatorEliminations(OPT, null, null, null, null, un);
    expect(contradiction).toBeNull();
    const entry = eliminated.find((e) => e.letter === 'F');
    expect(entry).toBeDefined();
    expect(entry?.sourceStep).toBe('Unitary:1');
    expect(entry?.span).toContain('conglomerate');
  });

  test('an unstated option is never eliminated by Unitary:1 -- absence is omission', () => {
    const un = unitary([]);
    const { eliminated } = deriveTerminatorEliminations(OPT, null, null, null, null, un);
    expect(eliminated).toEqual([]);
  });

  test('a Unitary:1 exclusion contradicting NamedSet:1 membership ABSTAINS rather than publishing', () => {
    const { contradiction } = deriveTerminatorEliminations(
      OPT, null, namedSet([['F', 'F) densely populated.']]), null, null,
      unitary([['F', 'F) is a conglomerate, not a single region.']]),
    );
    expect(contradiction).not.toBeNull();
    expect(contradiction?.letter).toBe('F');
  });
});

describe('D-BP154-043: FD-BP154-14 AMENDMENT -- Magnitude permitted as a tie-break when membership PARTITIONS but does not RESOLVE, and the artifact class is a single-answer item', () => {
  const input: MethodQuestionInput = {
    qid: 98,
    question: "Which of the following world regions is NOT considered one of the world's most densely populated regions?",
    options: OPT,
  };
  const ctx: MethodRunContext = { askGoogle: async () => null, emit: () => {} };

  test('REGRESSION PROOF: with artifact class NOT established (corpusMetaTruth null, the pre-existing humanNuance() fixture), a partitioned multi-survivor frame still ABSTAINS immediately -- the amendment does not fire', async () => {
    const namedSetOutcome = { id: 'NamedSet:1', summary: 's', raw: namedSet([['B', 'B) is densely populated.']]) };
    const humanNuanceOutcome = { id: 'HumanNuance:1', summary: 's', raw: humanNuance([]) };
    const magOutcome = {
      id: 'Magnitude:1', summary: 's',
      raw: magnitude(['A', 'C', 'D', 'E', 'F', 'G', 'H', 'I'], 'least', 'densely populated', [['A', 'A) least dense.']]),
    };
    const { result } = await runTerminatorStep(input, ctx, [namedSetOutcome, humanNuanceOutcome, magOutcome]);
    expect(result.abstain).toBe(true);
    expect(result.verdict).toBeNull();
    expect(result.abstainReason).toMatch(/FD-BP154-14/);
    expect(result.magnitudeBasis).toBeNull();
  });

  test('with artifact class ESTABLISHED AND the category frame SUBSTANTIVELY established (D-BP154-046 FIX 2), Magnitude:1 is permitted as the tie-break and its verdict is published, labeled ANSWERED (no frozen source)', async () => {
    const softballsOutcome = { id: 'Softballs:1', summary: 's', raw: softballs([['D', 'D) not a world region.'], ['G', 'G) not a world region.'], ['H', 'H) not a world region.'], ['I', 'I) not a world region.']]) };
    const namedSetOutcome = { id: 'NamedSet:1', summary: 's', raw: namedSet([['B', 'B) is densely populated.']]) };
    // D-BP154-046 FIX 2: nonParticipants (the augmentation deltas) are EXACTLY the four letters
    // Softballs:1 above eliminated -- every known addition is caught, so the category frame is
    // SUBSTANTIVE, not merely formally partitioned.
    const humanNuanceOutcome = {
      id: 'HumanNuance:1', summary: 's',
      raw: { ...humanNuanceWithArtifactClassEstablished(), nonParticipants: ['D', 'G', 'H', 'I'] },
    };
    const survivorFrame = Object.keys(OPT).filter((L) => L !== 'B' && !['D', 'G', 'H', 'I'].includes(L));
    const magOutcome = {
      id: 'Magnitude:1', summary: 's',
      raw: magnitude(
        survivorFrame, 'least', 'densely populated',
        [...survivorFrame].reverse().map((L) => [L, `${L}) has a stated relative density position.`] as [string, string]),
      ),
    };
    const { result } = await runTerminatorStep(input, ctx, [softballsOutcome, namedSetOutcome, humanNuanceOutcome, magOutcome]);
    expect(result.abstain).toBe(false);
    expect(result.verdict).not.toBeNull();
    expect(result.magnitudeBasis?.tieBreakKind).toBe('partitioned-membership-tiebreak');
    expect(result.magnitudeBasis?.sourceGrade).toBe('ANSWERED -- not proven by a unified frozen dataset');
  });

  test('D-BP154-046 FIX 2 REGRESSION PROOF: artifact class established but the category frame is NOT substantive (a live-measured shape: Softballs ok but only excludes ONE of several known augmentation additions) -- license WITHHELD, ABSTAIN, never a wrong verdict', async () => {
    // LIVE-MEASURED shape (D-BP154-046 dispatch): Softballs:1 returns ok:true while excluding only
    // D -- G/H/I (three more known augmentation additions) survive uncaught.
    const softballsOutcome = { id: 'Softballs:1', summary: 's', raw: softballs([['D', 'D) not a world region.']]) };
    const namedSetOutcome = { id: 'NamedSet:1', summary: 's', raw: namedSet([['B', 'B) is densely populated.']]) };
    const humanNuanceOutcome = {
      id: 'HumanNuance:1', summary: 's',
      raw: { ...humanNuanceWithArtifactClassEstablished(), nonParticipants: ['D', 'G', 'H', 'I'] },
    };
    const survivorFrame = Object.keys(OPT).filter((L) => L !== 'B' && L !== 'D');
    const magOutcome = {
      id: 'Magnitude:1', summary: 's',
      raw: magnitude(
        survivorFrame, 'least', 'densely populated',
        [...survivorFrame].reverse().map((L) => [L, `${L}) has a stated relative density position.`] as [string, string]),
      ),
    };
    const { result } = await runTerminatorStep(input, ctx, [softballsOutcome, namedSetOutcome, humanNuanceOutcome, magOutcome]);
    expect(result.abstain).toBe(true);
    expect(result.verdict).toBeNull();
    expect(result.magnitudeBasis).toBeNull();
    expect(result.abstainReason).toMatch(/NOT substantive/);
    expect(result.abstainReason).toMatch(/G\) Arctic Circle|H\) Amazon Rainforest|I\) Sahara Desert/);
    // Softballs:1 is legitimately 'ok' in isolation (it DID exclude something, D-BP154-046 FIX 1's
    // own per-step productivity check) -- proving FIX 1 and FIX 2 are complementary, not
    // redundant: a step can be honestly productive on its OWN terms while the cross-step
    // substantive-frame check (FIX 2, categoryFrameSubstantive) still correctly finds the overall
    // category frame hollow, because known augmentation additions survived uncaught regardless.
    expect(result.stepsConsulted['Softballs:1']).toBe('ok');
  });

  test('a GENUINE superlative ranking (no prior membership partition) is still labeled genuine-superlative, unchanged from before this amendment', async () => {
    const magOutcome = {
      id: 'Magnitude:1', summary: 's',
      raw: magnitude(
        Object.keys(OPT), 'least', 'densely populated',
        Object.keys(OPT).slice().reverse().map((L) => [L, `${L}) has a stated relative density position.`] as [string, string]),
      ),
    };
    // No NamedSet:1/Discriminator:1 in priorResults at all -- membershipPartitioned is false, so
    // this is the pre-existing genuine-ranking path, unaffected by the amendment.
    const { result } = await runTerminatorStep(input, ctx, [magOutcome]);
    expect(result.magnitudeBasis?.tieBreakKind).toBe('genuine-superlative');
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
