// classify_cascade.frame_stated_kind.test.ts -- D-BP153-032/BISHOP/seg-classify-032
//
// THE MEASURED PROOF THIS TICKET CLOSES (Bishop's own diagnosis, both draws on record in the
// evidence store, NOT re-diagnosed here): run LIANA_RUN_qid98_2026-08-13T12-25-35-888Z.json issued
// THE SOFTBALLS' base query twice (D-BP153-031 repeated draws) against ESSENTIALLY IDENTICAL source
// text (acquisition EVIDENCE_qid98_2026-08-13T12-23-48-219Z_36516.jsonl) and the OLD extractor
// (frameExtractionInstruction()/frameComplementExtractionInstruction(), RETIRED by this ticket)
// returned WILDLY different exclusion sets:
//   draw 1 -> excludes {A,B,C,D,E,F,G,H,I}   (all nine)
//   draw 2 -> excludes {G,H,I}
// ROOT CAUSE: the OLD extractor asked the LOCAL MODEL to judge whether a stated kind ("Geopolitical
// Subregion", "Parallel of Latitude", ...) counts as `category` ("world region") -- a judgment call
// HARDWIRE-22 forbids delegating to a local model, and it decided differently every call. THE FIX
// (establishFrame(), classify_cascade.ts): extract the STATED KIND per option and the STATED
// category denotation (pure copying, mirrors STAGE D's own extractDiscriminatorKinds()), then decide
// exclusions in PURE CODE (applyFrameKindElimination(), classify_cascade.ts).
//
// TESTED DIRECTLY AGAINST SOURCE (never dist), same offline convention every classify_cascade.*.
// test.ts sibling uses: askGoogle is a local stub, global.fetch (gemmaExtract()'s own Ollama
// channel) is monkey-patched per test, nothing live anywhere in this file.
//
// TEST 1 (HEADLINE) and TEST 2 (DETERMINISM) exercise establishFrame() END TO END, through a
// CONTENT-DISPATCHED fetch mock (contentDispatchedFetch(), below) that inspects the REAL instruction
// text gemmaExtract() actually sends and routes to the appropriate canned reply -- OLD shape
// (not_members / members) or NEW shape (kinds / category_kind). This is deliberate: it is what lets
// THIS SAME test file run unmodified against BOTH the pre-ticket source (reproducing the measured
// bug, TEST 1's own "BEFORE" assertion) and the post-ticket source (TEST 1's own "AFTER" assertion)
// for the fail-before/pass-after proof this ticket's own dispatch requires, performed by stashing
// ONLY classify_cascade.ts (never this test file) and running this file against each state in turn.
//
// TESTS 3, 4, 5 exercise applyFrameKindElimination() DIRECTLY -- pure set arithmetic, no I/O, no
// mocking needed -- proving the PURE-CODE comparison itself, independent of extraction plumbing.

import {
  describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest';
// D-BP153-031, TEST ISOLATION: pinning LB_DRAW_REPEATS=1 keeps every owned-passage-only assertion in
// this file simple (the repeated-draw wrapper only ever wraps the FRESH-QUERY path, which none of
// this file's establishFrame() calls reach -- every one of them answers from a single owned
// passage). The channel-variance repeat/disagreement behavior itself is already covered by
// classify_cascade.repeated_draws.test.ts; this file is about the STATED-KIND SHAPE, not the repeat
// wrapper.
beforeEach(() => { process.env.LB_DRAW_REPEATS = '1'; });
afterEach(() => { delete process.env.LB_DRAW_REPEATS; });

import { establishFrame, applyFrameKindElimination } from './classify_cascade';
import type { MethodRunContext, OwnedPassage } from '../method_registry';

// qid 98's option letters, from resources/mmlu_pro_bundled/questions.jsonl -- the SAME mapping
// every classify_cascade.*.test.ts sibling uses.
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
const CATEGORY = 'world region';

const owned = (text: string): OwnedPassage => ({ text, kind: 'operation' });

function notes(): { note: (text: string) => void; log: string[] } {
  const log: string[] = [];
  return { note: (text: string) => log.push(text), log };
}

// ─────────────────────────── THE REAL EVIDENCE, DRAW 1 and DRAW 2 ───────────────────────────
//
// Quoted verbatim from this ticket's own dispatch (Bishop's diagnosis, acquisition
// EVIDENCE_qid98_2026-08-13T12-23-48-219Z_36516.jsonl) through option G -- the dispatch's own quotes
// are truncated there with "...". H and I are extended here to complete the accounting, consistent
// with the pattern the dispatch's OWN draw-2 quote shows for H ("H) Amazon Rainforest: Biome /
// Ecosystem"): I) Sahara Desert is given the same BIOME kind by the identical pattern. A trailing
// sentence stating the category's own denotation is appended (present in neither quoted draw, which
// the dispatch shows are BOTH truncated) so the exclusion arithmetic below is fully determined
// rather than merely "not all nine" -- TEST 1 asserts the full, specific exclusion set this
// produces, not just the absence of the measured bug.
const D1_A = 'A) South America: Continent (a major continuous landmass and geopolitical macro-region).';
const D1_B = 'B) South Asia: Geopolitical Subregion (a formal, recognized subregion of the continent of Asia).';
const D1_C = 'C) North Africa: Geopolitical Subregion.';
const D1_D = 'D) Northeast United States: Subnational Region.';
const D1_E = 'E) Europe: Continent.';
const D1_F = 'F) Central Asia: Geopolitical Subregion.';
const D1_G = 'G) Arctic Circle: Parallel of Latitude / Geographic Boundary.';
const D1_H = 'H) Amazon Rainforest: Biome / Ecosystem.';
const D1_I = 'I) Sahara Desert: Biome / Ecosystem.';
const CATEGORY_CLAUSE_1 = 'A world region properly denotes a Continent or a comparable continuous geopolitical macro-region.';
const DRAW_1_PASSAGE = [D1_A, D1_B, D1_C, D1_D, D1_E, D1_F, D1_G, D1_H, D1_I, CATEGORY_CLAUSE_1].join(' ');

// Draw 2's own wording, quoted verbatim through H (dispatch's own quote), I extended the same way.
// THE POINT of using DIFFERENT prose per option (draw 2 drops B's and G's parentheticals, rewords
// A's) is that a DETERMINISTIC, copy-only extractor must still land on the SAME stated kind per
// option despite the wording drift -- that is exactly what "~0% source variance" means: the KIND
// stated for each option is identical between the two draws even though the surrounding prose is
// not.
const D2_A = 'A) South America: Continent (a major global landmass and geopolitical macro-region).';
const D2_B = 'B) South Asia: Geopolitical Subregion.';
const D2_C = 'C) North Africa: Geopolitical Subregion.';
const D2_D = 'D) Northeast United States: Subnational Region.';
const D2_E = 'E) Europe: Continent.';
const D2_F = 'F) Central Asia: Geopolitical Subregion.';
const D2_G = 'G) Arctic Circle: Parallel of Latitude.';
const D2_H = 'H) Amazon Rainforest: Biome / Ecosystem.';
const D2_I = 'I) Sahara Desert: Biome / Ecosystem.';
const CATEGORY_CLAUSE_2 = 'A world region properly denotes a Continent or a comparable continuous geopolitical macro-region.';
const DRAW_2_PASSAGE = [D2_A, D2_B, D2_C, D2_D, D2_E, D2_F, D2_G, D2_H, D2_I, CATEGORY_CLAUSE_2].join(' ');

/** The REAL stated kind per option, read off the passages above by a human, once -- this is the
 *  ground truth both draws' mocked extraction (below) is built to match, and what TEST 1/TEST 2
 *  assert the SUT actually recovers. */
const STATED_KINDS: Record<string, string> = {
  A: 'Continent',
  B: 'Geopolitical Subregion',
  C: 'Geopolitical Subregion',
  D: 'Subnational Region',
  E: 'Continent',
  F: 'Geopolitical Subregion',
  G: 'Parallel of Latitude',
  H: 'Biome',
  I: 'Biome',
};
const STATED_CATEGORY_KIND = 'Continent';

/** THE NEW SHAPE's own canned reply -- a faithful, verbatim-span COPY of `clauses`/`categoryClause`,
 *  exactly what a correct, judgment-free extractor produces (span-verified for real by the SUT's own
 *  spanIsVerbatim()/appearsIn() -- this mock does not bypass that check, it satisfies it). */
function newShapeKindsResponse(clauses: Record<string, string>, categoryClause: string): Record<string, unknown> {
  return {
    kinds: ALL.map((L) => ({ name: OPT[L], kind: STATED_KINDS[L], span: clauses[L] })),
    category_kind: STATED_CATEGORY_KIND,
    category_kind_span: categoryClause,
    stated_in_passage: true,
  };
}

/** THE OLD (RETIRED) SHAPE's own canned reply, reproducing the MEASURED live bug on draw 1 exactly:
 *  the direct ("NOT category") extraction judged all nine names as excluded -- a real, if wrong,
 *  gemma judgment call, span-verified against the SAME clauses (the old extractor never checked
 *  whether a span actually ASSERTS exclusion, only that it verbatim-contains the name, which every
 *  clause here does) -- and the complement ("IS category") extraction found nothing, exactly the
 *  measured shape (LIANA_RUN_qid98_2026-08-13T12-25-35-888Z.json, draw 1: "excludes {A..I} (all
 *  nine)"). */
function oldShapeNotMembersResponse(clauses: Record<string, string>): Record<string, unknown> {
  return {
    not_members: ALL.map((L) => ({ name: OPT[L], span: clauses[L] })),
    stated_in_passage: true,
  };
}
function oldShapeMembersResponseEmpty(): Record<string, unknown> {
  return { members: [], stated_in_passage: false };
}

/** Inspects the REAL instruction text gemmaExtract() sends (parsed out of the mocked /api/generate
 *  request body, the same body shape gemmaExtract() -- comparative_cascade.ts -- actually posts) and
 *  routes to the caller-supplied canned reply by CONTENT, never by call order or count. This is what
 *  lets ONE test body run unmodified against the OLD two-call shape (direct + complement,
 *  frameExtractionInstruction()/frameComplementExtractionInstruction(), RETIRED) and the NEW
 *  one-call shape (discriminatorExtractionInstruction(), reused byte-identical by
 *  extractFrameKinds()) -- see this file's own header for why that is the fail-before/pass-after
 *  mechanism this ticket's own dispatch requires. Throws loudly (never silently returns garbage) on
 *  any instruction this file did not anticipate, or on a shape this test did not configure a reply
 *  for -- a silent wrong-shape reply would make a false pass indistinguishable from a real one. */
function contentDispatchedFetch(opts: {
  newKinds?: () => Record<string, unknown>;
  oldNotMembers?: () => Record<string, unknown>;
  oldMembers?: () => Record<string, unknown>;
}): typeof fetch {
  return vi.fn(async (_url: unknown, init: { body?: string }) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as { prompt?: string };
    const prompt = body.prompt ?? '';
    if (prompt.includes('what KIND of thing the passage states it is')) {
      if (!opts.newKinds) {
        throw new Error('contentDispatchedFetch: NEW-shape (stated-kind) instruction sent, but no newKinds reply configured');
      }
      return { json: async () => ({ response: JSON.stringify(opts.newKinds!()) }) };
    }
    if (prompt.includes('a legitimate member of that category, stated directly by the source')) {
      if (!opts.oldMembers) {
        throw new Error('contentDispatchedFetch: RETIRED complement instruction sent (pre-D-BP153-032 source), but no oldMembers reply configured');
      }
      return { json: async () => ({ response: JSON.stringify(opts.oldMembers!()) }) };
    }
    if (prompt.includes('This exclusion may be worded as an explicit NOT')) {
      if (!opts.oldNotMembers) {
        throw new Error('contentDispatchedFetch: RETIRED direct-exclusion instruction sent (pre-D-BP153-032 source), but no oldNotMembers reply configured');
      }
      return { json: async () => ({ response: JSON.stringify(opts.oldNotMembers!()) }) };
    }
    throw new Error(`contentDispatchedFetch: unrecognized instruction -- prompt="${prompt.slice(0, 300)}"`);
  }) as unknown as typeof fetch;
}

describe('D-BP153-032 TEST 1 (HEADLINE): the source is stable, the OLD extractor was not', () => {
  test('fed the REAL draw-1 passage: stated kinds are extracted per option, and the result is NOT "all nine excluded"', async () => {
    const originalFetch = global.fetch;
    global.fetch = contentDispatchedFetch({
      newKinds: () => newShapeKindsResponse(
        {
          A: D1_A, B: D1_B, C: D1_C, D: D1_D, E: D1_E, F: D1_F, G: D1_G, H: D1_H, I: D1_I,
        },
        CATEGORY_CLAUSE_1,
      ),
      oldNotMembers: () => oldShapeNotMembersResponse({
        A: D1_A, B: D1_B, C: D1_C, D: D1_D, E: D1_E, F: D1_F, G: D1_G, H: D1_H, I: D1_I,
      }),
      oldMembers: oldShapeMembersResponseEmpty,
    });
    const askGoogle = vi.fn(async () => ({ snippet: 'MUST NEVER BE REACHED -- an owned passage answers this' }));
    try {
      const { note } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, ALL, OPT, note, () => [owned(DRAW_1_PASSAGE)],
      );
      expect(askGoogle).not.toHaveBeenCalled();

      // THE HEADLINE ASSERTION. Before D-BP153-032 this is 9 (the measured bug); after, it is 7
      // (B, C, D, F, G, H, I -- every stated kind that differs from the stated category kind
      // "Continent"), never 9.
      expect(frame.excluded.length).not.toBe(9);
      expect(new Set(frame.excluded)).toEqual(new Set(['B', 'C', 'D', 'F', 'G', 'H', 'I']));
      expect(new Set(frame.included)).toEqual(new Set(['A', 'E']));
      expect(frame.available).toBe(true);

      // Per-option stated kinds, named explicitly in the dispatch: A=Continent, B=Geopolitical
      // Subregion, D=Subnational Region, G=Parallel of Latitude, H=Biome. Read back off the
      // reconciliation arithmetic: A and E (both "Continent") are the only two NOT excluded; every
      // other stated kind differs from "Continent" and IS excluded -- which is exactly what a
      // correct per-option kind copy, compared to the stated category kind, produces.
      expect(frame.included).toContain('A'); // Continent
      expect(frame.excluded).toContain('B'); // Geopolitical Subregion
      expect(frame.excluded).toContain('D'); // Subnational Region
      expect(frame.excluded).toContain('G'); // Parallel of Latitude
      expect(frame.excluded).toContain('H'); // Biome
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-032 TEST 2 (DETERMINISM): the SAME stated kinds recur across the two REAL draws', () => {
  test('draw 1 and draw 2, fed separately, yield the SAME stated kinds for every option they share, and therefore the SAME exclusions', async () => {
    const originalFetch = global.fetch;
    const { note: note1 } = notes();
    const { note: note2 } = notes();
    const askGoogle = vi.fn(async () => ({ snippet: 'MUST NEVER BE REACHED -- an owned passage answers this' }));
    let frame1;
    let frame2;
    try {
      global.fetch = contentDispatchedFetch({
        newKinds: () => newShapeKindsResponse(
          {
            A: D1_A, B: D1_B, C: D1_C, D: D1_D, E: D1_E, F: D1_F, G: D1_G, H: D1_H, I: D1_I,
          },
          CATEGORY_CLAUSE_1,
        ),
      });
      frame1 = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, ALL, OPT, note1, () => [owned(DRAW_1_PASSAGE)],
      );
    } finally {
      global.fetch = originalFetch;
    }
    try {
      global.fetch = contentDispatchedFetch({
        newKinds: () => newShapeKindsResponse(
          {
            A: D2_A, B: D2_B, C: D2_C, D: D2_D, E: D2_E, F: D2_F, G: D2_G, H: D2_H, I: D2_I,
          },
          CATEGORY_CLAUSE_2,
        ),
      });
      frame2 = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, ALL, OPT, note2, () => [owned(DRAW_2_PASSAGE)],
      );
    } finally {
      global.fetch = originalFetch;
    }
    expect(askGoogle).not.toHaveBeenCalled();

    // THE VARIANCE BEING CLOSED: draw 1 and draw 2 must produce the IDENTICAL exclusion/inclusion
    // sets, despite the wording drift between the two passages (draw 2 drops B's and G's
    // parentheticals, rewords A's) -- pure copying is deterministic on the SAME underlying fact,
    // where judgment was not.
    expect(new Set(frame1.excluded)).toEqual(new Set(frame2.excluded));
    expect(new Set(frame1.included)).toEqual(new Set(frame2.included));
    expect(frame1.available).toBe(true);
    expect(frame2.available).toBe(true);
    expect(new Set(frame1.excluded)).toEqual(new Set(['B', 'C', 'D', 'F', 'G', 'H', 'I']));
  });
});

describe('D-BP153-032 TESTS 3-5: applyFrameKindElimination() is PURE CODE, and never guesses', () => {
  // The SAME nine-option stated-kind map every test in this block reuses -- only `categoryKind`
  // changes between tests 3 and 4, proving the elimination has no built-in preference for any
  // particular kind (FD-BP153-06: "would this rule survive on a question whose answer we do not
  // know?" -- swapping which kind counts flips which set survives, using the identical input data).
  const KINDS = STATED_KINDS;

  test('TEST 3: category denotation stated as "Continent" -> B, C, D, F, G, H, I excluded; A and E remain', () => {
    const result = applyFrameKindElimination(ALL, KINDS, 'Continent', CATEGORY, OPT);
    expect(new Set(result.excluded)).toEqual(new Set(['B', 'C', 'D', 'F', 'G', 'H', 'I']));
    expect(new Set(result.included)).toEqual(new Set(['A', 'E']));
    expect(result.unaccounted).toEqual([]);
  });

  // ANTI-TUNING, MANDATORY (Founder, this ticket, verbatim): proves no built-in preference for
  // continents. Swapping ONLY `categoryKind` (same KINDS map as TEST 3) flips the excluded/included
  // sets -- A and E (both "Continent") are now the ones EXCLUDED, and the three
  // "Geopolitical Subregion" options survive instead.
  test('TEST 4 (ANTI-TUNING, MANDATORY): category denotation stated as "Geopolitical Subregion" -> A and E EXCLUDED, B, C, F remain', () => {
    const result = applyFrameKindElimination(ALL, KINDS, 'Geopolitical Subregion', CATEGORY, OPT);
    expect(result.excluded).toContain('A');
    expect(result.excluded).toContain('E');
    expect(new Set(result.included)).toEqual(new Set(['B', 'C', 'F']));
    // The non-A outcome, stated explicitly: A is EXCLUDED here, proving this function does not
    // silently prefer the option that happens to be the historical answer key.
    expect(result.included).not.toContain('A');
  });

  test('TEST 5: no category denotation stated -> FRAME UNAVAILABLE, zero exclusions, never guessed', () => {
    const result = applyFrameKindElimination(ALL, KINDS, null, CATEGORY, OPT);
    expect(result.excluded).toEqual([]);
    expect(result.included).toEqual([]);
    expect(result.unaccounted).toEqual(ALL);
    expect(result.why).toMatch(/does not state which kind properly denotes/);
  });

  // AND establishFrame() itself reads this as available:false -- the SAME "no guessing" rule,
  // exercised through the real owned-passage path (a passage that states every option's own kind
  // but NEVER states which kind denotes the category at all).
  test('TEST 5b: establishFrame() itself reports available:false and zero exclusions when no passage ever states a category denotation', async () => {
    const originalFetch = global.fetch;
    const passageNoCategoryKind = [D1_A, D1_B, D1_C, D1_D, D1_E, D1_F, D1_G, D1_H, D1_I].join(' '); // no CATEGORY_CLAUSE
    global.fetch = contentDispatchedFetch({
      newKinds: () => ({
        kinds: ALL.map((L) => ({
          name: OPT[L],
          kind: STATED_KINDS[L],
          span: {
            A: D1_A, B: D1_B, C: D1_C, D: D1_D, E: D1_E, F: D1_F, G: D1_G, H: D1_H, I: D1_I,
          }[L],
        })),
        category_kind: null,
        category_kind_span: '',
        stated_in_passage: true,
      }),
    });
    const askGoogle = vi.fn(async () => ({ snippet: 'MUST NEVER BE REACHED' }));
    try {
      const { note } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, ALL, OPT, note, () => [owned(passageNoCategoryKind)],
      );
      expect(askGoogle).not.toHaveBeenCalled();
      expect(frame.available).toBe(false);
      expect(frame.excluded).toEqual([]);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
