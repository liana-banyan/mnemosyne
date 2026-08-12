// classify_cascade.owned_evidence_frame.test.ts -- D-BP153-011/BISHOP/seg-frame-consults-owned-
// evidence-first
//
// THE RULING THIS TESTS (FD-BP153-04, RULINGS_BP153.md, Founder, verbatim): "Before a step issues
// a new query, it must first try to answer that query by EXTRACTING from passages this run has
// already acquired. A new query is spent only when the owned evidence does not contain the
// answer."
//
// THE MEASUREMENT BEHIND IT (do not re-derive -- see establishFrame()'s own header,
// classify_cascade.ts). Live run 2026-08-12T16:04Z, qid 98: the OPERATION query's own response
// already contained the frame partition verbatim. establishFrame() used to go straight to a fresh
// googleBlocks() call without ever looking at what the run already had, and the run then spent 62
// more queries before hitting google.com/sorry.
//
// WHAT IS UNDER TEST HERE. establishFrame() itself (exported by this same ticket for exactly this
// purpose), called directly with a mocked askGoogle and a mocked Ollama fetch -- offline
// throughout, same convention survey_stage.meta_query_options_and_incomplete_input.test.ts already
// uses: `askGoogle` is a local stub, `global.fetch` (gemmaExtract()'s own Ollama channel) is
// monkey-patched per test, and no live network or Ollama call happens anywhere in this file.
//
// classify_cascade.frame.test.ts (this file's sibling) already covers the FRAME'S ARITHMETIC
// (restriction-only, D-BP153-010's empty-passage rule) against the Founder's real BP153 evidence,
// and states plainly that it does not exercise establishFrame() end to end. This file is the
// end-to-end coverage that sibling test named as still needed, scoped to exactly the one behavior
// this ticket adds: consult owned evidence before spending a query.

import { describe, test, expect, vi } from 'vitest';
import { establishFrame } from './classify_cascade';
import type { MethodRunContext } from '../method_registry';

// qid 98's option letters, same fixture classify_cascade.frame.test.ts already uses.
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

function notes(): { note: (text: string) => void; log: string[] } {
  const log: string[] = [];
  return { note: (text: string) => log.push(text), log };
}

/** Queues canned Ollama /api/generate JSON responses -- gemmaExtract() posts one prompt per call
 *  and this hands back the next queued `response` string in order, mirroring the shape
 *  gemmaExtract() itself parses (`{ response: "...json..." }`). Throws if the queue runs out, so a
 *  test that expects fewer gemmaExtract() calls than it queues for is caught rather than silently
 *  passing on a stale mock. */
// D-BP153-012 -- the return is cast to `typeof fetch`. THE CAST IS THE POINT, and it is narrow:
// gemmaExtract() reads exactly one thing off this object, `.json()`, so a stub that implements
// only that is honest about what it stands in for. Building a full Response (headers, ok, status,
// redirected, and 11 more members) would be ceremony that tests nothing.
//
// WHY IT WAS NEEDED, recorded so the next person does not re-learn it: without the cast this file
// type-checked fine under `tsconfig.json` (what vitest and a plain `tsc --noEmit` use) and FAILED
// under `tsconfig.main.json` (what `npm run build:main` uses, which includes test files and is
// stricter). The two configs disagree, so "tsc is clean" from the wrong one is not evidence the
// BUILD is clean. That gap silently produced a `dist:win` run that emitted no installer at all.
function queuedFetch(responses: string[]): typeof fetch {
  let i = 0;
  return vi.fn(async () => {
    if (i >= responses.length) throw new Error(`queuedFetch: no more queued responses (called ${i + 1} times)`);
    const r = responses[i];
    i++;
    return { json: async () => ({ response: r }) };
  }) as unknown as typeof fetch;
}

describe('FD-BP153-04: establishFrame() consults owned evidence BEFORE issuing a new query', () => {
  test('an owned passage containing an explicit exclusion answers the frame with ZERO queries issued', async () => {
    const originalFetch = global.fetch;
    // The exact shape of passage the live measurement found sitting in the OPERATION query's own
    // answer -- states the exclusion explicitly, in prose, never as a pre-parsed list.
    const ownedPassage = "Options A (South America), C (North Africa), F (Central Asia), G (Arctic Circle), "
      + "H (Amazon Rainforest), and I (Sahara Desert) are all NOT considered among the world's most "
      + 'densely populated regions. Only B (South Asia), D (Northeast United States), and E (Europe) are '
      + 'recognized in human geography as major global population clusters.';
    global.fetch = queuedFetch([
      JSON.stringify({ not_members: ['South America', 'North Africa', 'Central Asia', 'Arctic Circle', 'Amazon Rainforest', 'Sahara Desert'], stated_in_passage: true }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'this must never be reached' }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY,
        ALL,
        OPT,
        note,
        () => [ownedPassage],
      );

      expect(askGoogle).not.toHaveBeenCalled(); // THE POINT OF THE RULING: no new query issued
      expect(frame.available).toBe(true);
      expect(frame.answeredFrom).toBe('owned-passage');
      expect(frame.ownedPassageIndex).toBe(0);
      expect(new Set(frame.excluded)).toEqual(new Set(['A', 'C', 'F', 'G', 'H', 'I']));

      // THE RECEIPT SAYS WHICH -- the transcript must name the source, not just carry a typed field
      // no reader will see live.
      expect(log.some((l) => /FROM OWNED EVIDENCE/.test(l) && /passage 1 of 1/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('absent ownedPassages (no accessor at all) falls through to the query path, unchanged from before this ticket', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      JSON.stringify({ not_members: ['Arctic Circle'], stated_in_passage: true }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'Arctic Circle is a climatic zone, not a world region.' }));
    try {
      const { note, log } = notes();
      // No sixth argument at all -- the exact call shape every pre-existing call site (before this
      // ticket) used.
      const frame = await establishFrame(askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note);

      expect(askGoogle).toHaveBeenCalledTimes(1); // the only query path available was used
      expect(frame.available).toBe(true);
      expect(frame.answeredFrom).toBe('new-query');
      expect(frame.ownedPassageIndex).toBeNull();
      expect(frame.excluded).toEqual(['G']);
      expect(log.some((l) => /FROM A NEW QUERY/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('empty ownedPassages() (Survey ran but acquired nothing usable) falls through to the query path identically', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      JSON.stringify({ not_members: ['Arctic Circle'], stated_in_passage: true }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'Arctic Circle is a climatic zone, not a world region.' }));
    try {
      const { note } = notes();
      const frameWithEmptyAccessor = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note, () => [],
      );
      expect(askGoogle).toHaveBeenCalledTimes(1);
      expect(frameWithEmptyAccessor.answeredFrom).toBe('new-query');
      expect(frameWithEmptyAccessor.excluded).toEqual(['G']);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('owned passages that are empty/whitespace-only are never sent to extraction -- D-BP153-010 extends to owned evidence', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      // Only ONE response queued -- if the empty/whitespace passages were (wrongly) sent to
      // gemmaExtract() too, queuedFetch() throws on the second/third call and the test fails loudly
      // rather than silently passing.
      JSON.stringify({ not_members: ['Arctic Circle'], stated_in_passage: true }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'must never be reached -- the real owned passage answers it' }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY,
        ALL,
        OPT,
        note,
        () => ['', '   \n  ', 'The Arctic Circle is a polar climatic zone, not a world region.'],
      );
      expect(askGoogle).not.toHaveBeenCalled();
      expect(frame.answeredFrom).toBe('owned-passage');
      // The real passage was the THIRD element, but the first index the extractor actually tried
      // (empty ones filtered out before extraction) -- so its own index within the filtered array.
      expect(frame.ownedPassageIndex).toBe(0);
      expect(frame.excluded).toEqual(['G']);
      expect(log.some((l) => /FROM OWNED EVIDENCE/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('an extracted name NOT actually present in the owned passage text is rejected by appearsIn(), never trusted', async () => {
    const originalFetch = global.fetch;
    // The owned passage names Arctic Circle as excluded, but the model hallucinates an ADDITIONAL
    // name ("Europe") the passage never states -- gemmaExtract()'s own JSON says so, but the
    // passage text does not contain the word "Europe" anywhere.
    const ownedPassage = 'The Arctic Circle is a polar climatic zone, not a world region.';
    global.fetch = queuedFetch([
      JSON.stringify({ not_members: ['Arctic Circle', 'Europe'], stated_in_passage: true }),
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'must never be reached' }));
    try {
      const { note } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note, () => [ownedPassage],
      );
      expect(askGoogle).not.toHaveBeenCalled();
      expect(frame.answeredFrom).toBe('owned-passage');
      // Europe (E) never appears in the owned text -- appearsIn() must strip it. Only G survives.
      expect(frame.excluded).toEqual(['G']);
      expect(frame.excluded).not.toContain('E');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('an owned passage that yields NOTHING extractable is inconclusive, not "excluded nothing" -- tries the next passage, then the query path', async () => {
    const originalFetch = global.fetch;
    // First owned passage is real text but never addresses the category at all (e.g. it answered a
    // different question this run also asked) -- gemmaExtract() honestly returns an empty list for
    // it. A second owned passage DOES contain the answer.
    const offTopicPassage = 'Population density is measured in people per square kilometer worldwide.';
    const onTopicPassage = 'The Sahara Desert is a desert biome, not a world region, and is excluded from the count.';
    global.fetch = queuedFetch([
      JSON.stringify({ not_members: [], stated_in_passage: false }), // passage 1: nothing extractable
      JSON.stringify({ not_members: ['Sahara Desert'], stated_in_passage: true }), // passage 2: answers it
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'must never be reached -- passage 2 answers it' }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, ALL, OPT, note,
        () => [offTopicPassage, onTopicPassage],
      );
      expect(askGoogle).not.toHaveBeenCalled();
      expect(frame.answeredFrom).toBe('owned-passage');
      expect(frame.ownedPassageIndex).toBe(1); // the SECOND owned passage is the one that answered
      expect(frame.excluded).toEqual(['I']);
      expect(log.some((l) => /FROM OWNED EVIDENCE/.test(l) && /passage 2 of 2/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('NONE of the owned passages contain the answer -- falls through to the query path, and the query still runs exactly as before', async () => {
    const originalFetch = global.fetch;
    const offTopicPassage1 = 'Population density is measured in people per square kilometer worldwide.';
    const offTopicPassage2 = 'The question asks about geographic classification generally.';
    global.fetch = queuedFetch([
      JSON.stringify({ not_members: [], stated_in_passage: false }), // owned passage 1: nothing
      JSON.stringify({ not_members: [], stated_in_passage: false }), // owned passage 2: nothing
      JSON.stringify({ not_members: ['Arctic Circle'], stated_in_passage: true }), // the fresh query
    ]);
    const askGoogle = vi.fn(async () => ({ snippet: 'Arctic Circle is a climatic zone, not a world region.' }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, ALL, OPT, note,
        () => [offTopicPassage1, offTopicPassage2],
      );
      expect(askGoogle).toHaveBeenCalledTimes(1); // owned evidence was tried FIRST, but exhausted
      expect(frame.answeredFrom).toBe('new-query');
      expect(frame.ownedPassageIndex).toBeNull();
      expect(frame.excluded).toEqual(['G']);
      expect(log.some((l) => /did not contain a usable frame partition -- falling through to a NEW QUERY/.test(l))).toBe(true);
      expect(log.some((l) => /FROM A NEW QUERY/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  // D-BP153-014/BISHOP/seg-classify-recall-fix, BUG-2. establishFrame()'s own D-BP153-010 fix
  // (dc94891e) has only ever been exercised as a pure boolean lambda
  // (classify_cascade.frame.test.ts's own "D-BP153-010" test) -- never as an end-to-end call to
  // establishFrame() itself with a mocked googleBlocks() response, the way
  // classify_cascade.membership_terminator.test.ts's sibling test for extractNamedSetMembers()
  // already does ("D-BP153-010, mirrored: an EMPTY passage from a fresh query is UNAVAILABLE").
  // That asymmetry is the gap this closes: the SAME reproduction (an askGoogle payload whose only
  // organic result has empty title/snippet -- googleBlocks() joins that into a whitespace-only
  // `text`, ok:true, per comparative_cascade.ts's own `parts.push()` which runs unconditionally for
  // every organic result regardless of content) run against establishFrame() itself, not a lambda.
  test('D-BP153-014 BUG-2 regression: an EMPTY passage from a fresh query is UNAVAILABLE, never "excluded nothing" -- establishFrame() end to end', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([]); // must not even be reached -- the guard fires before gemmaExtract()
    // Same reproduction classify_cascade.membership_terminator.test.ts's own D-BP153-010 mirror
    // uses: an organic result with empty title/snippet makes googleBlocks() return ok:true with a
    // blank-after-trim `text` in ONE attempt (no retry backoff needed here).
    const askGoogle = vi.fn(async () => ({ results: [{ title: '', snippet: '' }] }));
    try {
      const { note } = notes();
      const frame = await establishFrame(askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note);
      expect(frame.available).toBe(false);
      expect(frame.excluded).toEqual([]);
      expect(frame.via).toMatch(/empty passage/);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
