// classify_cascade.property_not_membership.test.ts -- D-BP153-018/BISHOP/seg-classify-018
//
// THE MEASURED FAILURE (live run 2026-08-12T22:32Z, receipt
// LIANA_RUN_qid98_2026-08-12T22-32-08-512Z.json). THE SOFTBALLS (establishFrame(), QUESTION 1 --
// "which options are legitimate members of the category at all?") extracted its exclusion set from
// this sentence:
//   "Options A, C, F, G, H, I are all NOT considered among the world's most densely populated
//   regions."
// That sentence answers QUESTION 2 (THE NAMED SET -- "which options SCORE as densely populated?"),
// not QUESTION 1 (what a thing IS). Both questions returned the SAME set, legitimate-regions MINUS
// named-set-members left ZERO, the terminator fell through to the magnitude route, and the run
// burned 53 queries reaching an ordering disagreement.
//
// THE RULE UNDER TEST: a span that asserts the SUPERLATIVE PROPERTY is not evidence about CATEGORY
// MEMBERSHIP. extractNamedSetMembers() only COUNTS and NOTES the symmetric case (report, not
// enforce -- a source may state membership without repeating the property phrase) -- UNTOUCHED by
// D-BP153-032, see TEST 4, below.
//
// D-BP153-032, RESHAPED FOR ESTABLISHFRAME() ONLY. THE SOFTBALLS no longer extract a direct/
// complement EXCLUSION pair (frameExtractionInstruction()/frameComplementExtractionInstruction(),
// RETIRED) -- they extract a STATED KIND per option plus a STATED category denotation
// (extractFrameKinds(), classify_cascade.ts), then compare the two IN PURE CODE
// (applyFrameKindElimination()). D-BP153-018's rule is now applied to the KIND read: a span
// asserting the SUPERLATIVE PROPERTY is not evidence of a stated KIND either -- same rule, same
// reason, guarding a different extraction shape. TESTS 1/2/3/5 (below) are rewritten against that
// shape; the underlying invariant (a property-only span never produces a trusted category-membership
// claim) is unchanged and still directly asserted.
//
// THE PROPERTY STRING IS DERIVED, NEVER HARDCODED IN THIS FILE AS A TEST-ONLY LITERAL: it is read
// off the Founder's own qid-98 question text via extractSuperlativeMatch(), the exact function
// classify_cascade.ts's own run() already uses to route this class of question -- same convention
// classify_cascade.membership_terminator.test.ts and classify_cascade.discriminator.test.ts already
// use for `match`.

import {
  describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest';
// D-BP153-031, TEST ISOLATION: this file's own fixtures each mock exactly ONE response per base
// question -- pinning LB_DRAW_REPEATS=1 keeps every existing assertion in this file (call counts,
// single-draw extraction) valid. drawWithAgreement()'s own repeats===1 path is a pure pass-through,
// BYTE-IDENTICAL to this file's pre-D-BP153-031 behavior (see classify_cascade.ts's own D-BP153-031
// section header and resolveDrawRepeats()). The channel-variance repeat/disagreement behavior itself
// is covered by classify_cascade.repeated_draws.test.ts, not here.
beforeEach(() => { process.env.LB_DRAW_REPEATS = '1'; });
afterEach(() => { delete process.env.LB_DRAW_REPEATS; });
import { establishFrame, extractNamedSetMembers, extractSuperlativeMatch } from './classify_cascade';
import type { MethodRunContext, OwnedPassage } from '../method_registry';

const QUESTION = "Which of the following world regions is NOT considered one of the world's most densely populated regions?";
const MATCH = extractSuperlativeMatch(QUESTION)!;
const PROPERTY = MATCH.property; // derived from the question's own grammar -- expected "densely populated"

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
const CATEGORY = 'world regions';

// THE SOFTBALLS' own tests (1/2/3/5, below) deliberately use a SMALL, fully-covered option subset --
// D-BP153-032's stated-kind shape requires COMPLETE per-option coverage before establishFrame()
// terminates at owned evidence (D-BP153-023, restated for the new shape: a passage that leaves any
// option's kind unaccounted-for falls through, exactly as an incomplete direct/complement partition
// did before this ticket). Using the full nine-option ALL here would make every fixture also cover
// the other five options' kinds for no reason relevant to what THIS file tests -- property
// contamination -- so a minimal, fully-specified subset is used instead, same convention
// classify_cascade.discriminator.test.ts already uses for STAGE D's own narrowed candidate sets.
const FRAME_OPT: Record<string, string> = {
  A: 'South America', B: 'South Asia', C: 'North Africa', D: 'Northeast United States',
};
const FRAME_ALL = Object.keys(FRAME_OPT);

const owned = (text: string): OwnedPassage => ({ text, kind: 'operation' });

function notes(): { note: (text: string) => void; log: string[] } {
  const log: string[] = [];
  return { note: (text: string) => log.push(text), log };
}

// Same convention every classify_cascade.*.test.ts sibling uses -- queues canned Ollama
// /api/generate JSON responses, one per gemmaExtract() call, in order.
function queuedFetch(responses: string[]): typeof fetch {
  let i = 0;
  return vi.fn(async () => {
    if (i >= responses.length) throw new Error(`queuedFetch: no more queued responses (called ${i + 1} times)`);
    const r = responses[i];
    i++;
    return { json: async () => ({ response: r }) };
  }) as unknown as typeof fetch;
}

describe('D-BP153-018 sanity: the property is derived, not hardcoded here', () => {
  test('extractSuperlativeMatch() on the real qid-98 question yields "densely populated"', () => {
    expect(MATCH).not.toBeNull();
    expect(PROPERTY).toBe('densely populated');
  });
});

describe('D-BP153-018 TEST 1 (HEADLINE): a span asserting the property is not evidence of a stated KIND either', () => {
  test('establishFrame() never trusts a property-tainted "kind" as a category exclusion -- the option stays UNACCOUNTED, not excluded', async () => {
    const originalFetch = global.fetch;
    // THE EXACT MEASURED SHAPE, reworded for a stated-kind read: A and C's ONLY "kind" statement in
    // this passage is really a claim about the SUPERLATIVE PROPERTY, not a category classification --
    // exactly the live bug's own sentence, still naming the property verbatim.
    const propertySentence = `South America and North Africa are NOT considered among the world's most ${PROPERTY} regions.`;
    const categorySentence = 'South Asia and Northeast United States are recognized as Continents, the proper denotation of a world region.';
    const passage = `${propertySentence} ${categorySentence}`;
    // `kind` here is the literal PROPERTY string, verbatim-contained in `propertySentence` -- exactly
    // the shape appearsIn(span, kindText) requires (D-BP153-016, FIX 2), and exactly what a real
    // extraction attempt would copy out of a sentence that only ever talks about the property.
    const kindsResponse = JSON.stringify({
      kinds: [
        { name: 'South America', kind: PROPERTY, span: propertySentence },
        { name: 'North Africa', kind: PROPERTY, span: propertySentence },
        { name: 'South Asia', kind: 'Continent', span: categorySentence },
        { name: 'Northeast United States', kind: 'Continent', span: categorySentence },
      ],
      category_kind: 'Continent',
      category_kind_span: categorySentence,
      stated_in_passage: true,
    });
    // Two calls: the fresh query's own extraction, then D-BP153-026's one completion follow-up
    // (A and C's kind is discarded EVERY time it is asked -- the property taint is not a fluke of a
    // single read -- so the follow-up finds nothing new for them either, and the terminal safety net
    // leaves them UNACCOUNTED rather than ever excluding them from a property-only span).
    global.fetch = queuedFetch([kindsResponse, kindsResponse]);
    const askGoogle = vi.fn(async () => ({ snippet: passage }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, FRAME_ALL, FRAME_OPT, note, undefined, PROPERTY,
      );
      expect(askGoogle).toHaveBeenCalledTimes(2); // fresh query + D-BP153-026 completion follow-up
      expect(frame.available).toBe(true);
      // THE HEADLINE ASSERTION: A and C are NEVER excluded -- their only "kind" statement was a
      // property claim, discarded, never trusted as evidence of category membership.
      expect(frame.excluded).not.toContain('A');
      expect(frame.excluded).not.toContain('C');
      expect(new Set(frame.included)).toEqual(new Set(['B', 'D']));
      expect(frame.partitionComplete).toBe(false); // A and C stayed unaccounted -- never guessed
      // The note names each discard and quotes the offending span (D-BP153-018).
      expect(log.some((l) => l.includes('DISCARDED A)') && l.includes('D-BP153-018') && l.includes(propertySentence))).toBe(true);
      expect(log.some((l) => l.includes('DISCARDED C)') && l.includes('D-BP153-018') && l.includes(propertySentence))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-018 TEST 2: a genuine category exclusion (no property phrase) still works', () => {
  test('a span stating what a thing IS INSTEAD, with no property language, is kept, not discarded', async () => {
    const originalFetch = global.fetch;
    const biomeSentence = 'The Amazon Rainforest is a biome, not a world region.';
    const categorySentence = 'South America is recognized as a Continent, the proper denotation of a world region.';
    const passage = `${biomeSentence} ${categorySentence}`;
    const smallOpt: Record<string, string> = { A: 'South America', H: 'Amazon Rainforest' };
    const smallAll = Object.keys(smallOpt);
    global.fetch = queuedFetch([JSON.stringify({
      kinds: [
        { name: 'South America', kind: 'Continent', span: categorySentence },
        { name: 'Amazon Rainforest', kind: 'Biome', span: biomeSentence },
      ],
      category_kind: 'Continent',
      category_kind_span: categorySentence,
      stated_in_passage: true,
    })]);
    const askGoogle = vi.fn(async () => ({ snippet: 'must never be reached' }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, smallAll, smallOpt, note,
        () => [owned(passage)], PROPERTY,
      );
      expect(askGoogle).not.toHaveBeenCalled();
      expect(frame.available).toBe(true);
      expect(frame.answeredFrom).toBe('owned-passage');
      expect(frame.excluded).toEqual(['H']);
      expect(log.some((l) => /DISCARDED H\)/.test(l))).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-018 TEST 3: mixed passage -- only the property-based span is discarded, the category one survives', () => {
  test('one candidate exclusion sourced from a property span is discarded; the other, sourced from a category span, is kept', async () => {
    const originalFetch = global.fetch;
    const propertySpan = `Arctic Circle is NOT considered among the world's most ${PROPERTY} regions.`;
    const categorySpan = 'The Amazon Rainforest is a biome, not a world region. South America is a Continent, the proper denotation of a world region.';
    const passage = `${propertySpan} ${categorySpan}`;
    const smallOpt: Record<string, string> = { A: 'South America', G: 'Arctic Circle', H: 'Amazon Rainforest' };
    const smallAll = Object.keys(smallOpt);
    const kindsResponse = JSON.stringify({
      kinds: [
        { name: 'South America', kind: 'Continent', span: categorySpan },
        { name: 'Arctic Circle', kind: PROPERTY, span: propertySpan },
        { name: 'Amazon Rainforest', kind: 'Biome', span: categorySpan },
      ],
      category_kind: 'Continent',
      category_kind_span: categorySpan,
      stated_in_passage: true,
    });
    // G's discarded kind leaves it unaccounted, which is INCOMPLETE (D-BP153-023's own rule,
    // restated for the stated-kind shape) -- falls through past this one owned passage (1 call) to a
    // fresh query (2nd call), then its one completion follow-up (D-BP153-026, 3rd call), all three
    // fed the SAME idempotent reply: the property taint is not a fluke of a single read.
    global.fetch = queuedFetch([kindsResponse, kindsResponse, kindsResponse]);
    const askGoogle = vi.fn(async () => ({ snippet: passage }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, smallAll, smallOpt, note,
        () => [owned(passage)], PROPERTY,
      );
      expect(askGoogle).toHaveBeenCalledTimes(2); // fresh query + D-BP153-026 completion follow-up
      expect(frame.available).toBe(true);
      expect(frame.excluded).toEqual(['H']);
      expect(frame.excluded).not.toContain('G');
      expect(log.some((l) => l.includes('DISCARDED G)') && l.includes(propertySpan))).toBe(true);
      expect(log.some((l) => l.includes('DISCARDED H)'))).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-018 TEST 4: the symmetric named-set check REPORTS, never rejects', () => {
  test('extractNamedSetMembers() counts and notes members whose span omits the property, but keeps them as members', async () => {
    const originalFetch = global.fetch;
    const memberSpan = 'Only B (South Asia) and D (Northeast United States) are recognized as major population clusters.';
    const nonMemberSpan = 'Options A (South America) and C (North Africa) are not among them.';
    const passage = `${memberSpan} ${nonMemberSpan}`;
    const subset = ['A', 'B', 'C', 'D'];
    const subOPT: Record<string, string> = {
      A: OPT.A, B: OPT.B, C: OPT.C, D: OPT.D,
    };
    global.fetch = queuedFetch([
      // Call 1: namedSetExtractionInstruction() (direct member read) -- neither span mentions
      // "densely populated" at all, even though B and D genuinely ARE the named set's members.
      JSON.stringify({
        members: [
          { name: 'South Asia', span: memberSpan },
          { name: 'Northeast United States', span: memberSpan },
        ],
        stated_in_passage: true,
      }),
      // Call 2: namedSetComplementExtractionInstruction() (non-member read).
      JSON.stringify({
        not_members: [
          { name: 'South America', span: nonMemberSpan },
          { name: 'North Africa', span: nonMemberSpan },
        ],
        stated_in_passage: true,
      }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'must never be reached' }));
    try {
      const { note, log } = notes();
      const namedSet = await extractNamedSetMembers(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, MATCH.direction, PROPERTY, subset, subOPT, note,
        () => [owned(passage)],
      );
      expect(askGoogle).not.toHaveBeenCalled();
      expect(namedSet.available).toBe(true);
      // REPORT, NEVER ENFORCE: B and D are still members despite their span never mentioning the
      // property -- the symmetric check must never remove them.
      expect(namedSet.members).toContain('B');
      expect(namedSet.members).toContain('D');
      expect(log.some((l) => /REPORT ONLY/.test(l) && /D-BP153-018/.test(l) && l.includes('B) South Asia') && l.includes('D) Northeast United States'))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-018 TEST 5: zero exclusions after discarding is a legitimate outcome, not an error', () => {
  test('when discarding empties the frame entirely via the FRESH-QUERY path, the run proceeds exactly as an ordinary empty-exclusion frame would', async () => {
    const originalFetch = global.fetch;
    // EVERY option's only "kind" statement is a property claim -- after discard, nothing survives on
    // EITHER side, so no categoryKind claim is trustworthy to compare against either (there is
    // nothing left to compare); the frame is UNAVAILABLE, not "answered with zero exclusions" --
    // D-BP153-032's own "never guess" rule, restated: an entirely property-tainted passage is
    // functionally the same as a passage that never discussed the category at all.
    const propertySentence = `South America and North Africa are NOT considered among the world's most ${PROPERTY} regions.`;
    const kindsResponse = JSON.stringify({
      kinds: [
        { name: 'South America', kind: PROPERTY, span: propertySentence },
        { name: 'North Africa', kind: PROPERTY, span: propertySentence },
      ],
      category_kind: PROPERTY, // the ONLY denotation this passage ever states is itself a property claim
      category_kind_span: propertySentence,
      stated_in_passage: true,
    });
    // Fresh query, then D-BP153-026's one completion follow-up (still nothing new -- the same
    // property-only passage is all this source has).
    global.fetch = queuedFetch([kindsResponse, kindsResponse]);
    const smallOpt: Record<string, string> = { A: 'South America', C: 'North Africa' };
    const smallAll = Object.keys(smallOpt);
    const askGoogle = vi.fn(async () => ({ snippet: propertySentence }));
    try {
      const { note, log } = notes();
      // No ownedPassages accessor at all -- forces the fresh-query path, not the owned-passage loop,
      // to prove the same discard-to-nothing handling holds there too.
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, smallAll, smallOpt, note, undefined, PROPERTY,
      );
      expect(askGoogle).toHaveBeenCalledTimes(2); // fresh query + D-BP153-026 completion follow-up
      expect(frame.answeredFrom).toBe('new-query');
      expect(frame.excluded).toEqual([]);
      expect(frame.available).toBe(false); // the category-kind claim was ITSELF property-tainted and discarded -- never guessed
      expect(log.some((l) => /does not state which kind properly denotes/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
