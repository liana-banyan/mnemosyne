// classify_cascade.invalid_draw.test.ts -- D-BP154-001/BISHOP/seg-invaliddraw
//
// TICKET_D-BP154-001_THE_INVALID_DRAW.md (Asteroid-ProofVault/BISHOP_DROPZONE). THE RULE, verbatim:
// "A draw whose passage names NONE of the question's options is an INVALID draw, not a disagreeing
// one. Discard it, say so out loud, and take another in its place. It must never veto a good draw."
// And its other half: "draws that all extract NOTHING are not in agreement. Agreement on an empty
// result is not corroboration."
//
// MEASURED ON HARDWIRE\LEDGER\LIANA_RUNS\LIANA_RUN_qid98_2026-08-13T19-24-50-420Z.json
// (D-BP153-034, commit 1ee72b8d): draw 1 was a failed browser capture ("no option named"); draw 2
// was a perfect, verbatim-sourced extraction naming all nine kinds. Before this ticket,
// drawWithAgreement() (classify_cascade.ts) compared the two byte-for-byte and reported a
// DISAGREEMENT -- one failed capture vetoed a correct answer. This file proves the fix, via
// establishFrame() (THE SOFTBALLS), the SAME call site the receipt's own transcript names.
//
// SAME OFFLINE CONVENTION every classify_cascade.*.test.ts sibling already uses: askGoogle is a
// local stub, global.fetch (gemmaExtract()'s own Ollama channel) is monkey-patched per test,
// nothing live anywhere in this file. THIS FILE DOES NOT PIN LB_DRAW_REPEATS -- every test below
// runs under the REAL default (2), same reasoning as classify_cascade.repeated_draws.test.ts's own
// header: D-BP154-001 is built ON the D-BP153-031 repeat loop ("wherever it is used"), and at
// LB_DRAW_REPEATS=1 there is no repeat loop for it to apply to (see drawWithAgreement()'s own
// repeats<=1 pass-through, classify_cascade.ts).

import { describe, test, expect, vi } from 'vitest';
import { establishFrame } from './classify_cascade';
import type { MethodRunContext } from '../method_registry';

// qid 98's option letters -- same fixture every sibling classify_cascade.*.test.ts file uses.
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

/** Same convention every sibling classify_cascade.*.test.ts file already establishes: queues canned
 *  Ollama /api/generate JSON responses, one per gemmaExtract() call, in order. */
function queuedFetch(responses: string[]): typeof fetch {
  let i = 0;
  return vi.fn(async () => {
    if (i >= responses.length) throw new Error(`queuedFetch: no more queued responses (called ${i + 1} times)`);
    const r = responses[i];
    i++;
    return { json: async () => ({ response: r }) };
  }) as unknown as typeof fetch;
}

// A passage naming NONE of the nine option labels -- the ticket's own measured shape ("197
// characters of Gemini UI chrome, naming no option at all, mined anyway"). Deliberately built with
// no overlap with any OPT value above.
const NO_LABEL_PASSAGE = 'Interpreting the Prompt Gemini said Answer now Thinking about the request '
  + 'momentarily please wait for the response to load in this window.';

// A passage that states a kind for all nine options plus the category's own denotation -- the SAME
// shape classify_cascade.repeated_draws.test.ts's own BOUNDARY fixture uses, reused here so a
// second, independent draw of it can be built to AGREE.
const FULL_KINDS_PASSAGE = 'For EACH of these: South America is a continent, South Asia is a '
  + 'continent, Northeast United States is a sub-national zone, Europe is a continent, North Africa '
  + 'is a colloquial area, Central Asia is a colloquial area, Arctic Circle is a biome, Amazon '
  + 'Rainforest is a biome, Sahara Desert is a biome. Continent properly denotes a world region.';
const fullKindsJson = () => JSON.stringify({
  kinds: [
    { name: 'South America', kind: 'continent', span: FULL_KINDS_PASSAGE },
    { name: 'South Asia', kind: 'continent', span: FULL_KINDS_PASSAGE },
    { name: 'Northeast United States', kind: 'sub-national zone', span: FULL_KINDS_PASSAGE },
    { name: 'Europe', kind: 'continent', span: FULL_KINDS_PASSAGE },
    { name: 'North Africa', kind: 'colloquial area', span: FULL_KINDS_PASSAGE },
    { name: 'Central Asia', kind: 'colloquial area', span: FULL_KINDS_PASSAGE },
    { name: 'Arctic Circle', kind: 'biome', span: FULL_KINDS_PASSAGE },
    { name: 'Amazon Rainforest', kind: 'biome', span: FULL_KINDS_PASSAGE },
    { name: 'Sahara Desert', kind: 'biome', span: FULL_KINDS_PASSAGE },
  ],
  category_kind: 'continent',
  category_kind_span: FULL_KINDS_PASSAGE,
  stated_in_passage: true,
});

// A passage that DOES name an option (so passageMentionsAnyLabel() passes, not an INVALID draw) but
// from which NOTHING is ever extracted -- THE RULE's "other half", the MEASURED shape from runs
// 2026-08-13T16-29-46-988Z/16-59-33-658Z: `kinds {A:null...I:null}` on every draw. A grouped-heading
// passage naming every option but stating no per-item kind is the real-world cause (D-BP153-033's
// own header); reproduced here directly via the gemmaExtract() response rather than re-deriving that
// specific parsing gap.
const NAMES_BUT_EXTRACTS_NOTHING_PASSAGE = 'Category 1: Macro-Geographic Regions -- A) South America '
  + 'B) South Asia C) North Africa D) Northeast United States E) Europe F) Central Asia G) Arctic '
  + 'Circle H) Amazon Rainforest I) Sahara Desert.';
const nothingExtractedJson = () => JSON.stringify({ kinds: [], category_kind: null, stated_in_passage: false });

describe('TEST 1 (THE RULE, headline): an INVALID draw is discarded, replaced, and never vetoes a good draw', () => {
  test('FAIL-BEFORE / PASS-AFTER shape, the exact measured receipt (LIANA_RUN_qid98_2026-08-13T19-24-50-420Z.json): draw 1 names no option, draw 2 is a perfect nine-kind extraction -- the frame is established from the valid draws, never draw-disagreement', async () => {
    const originalFetch = global.fetch;
    // Only TWO gemmaExtract() calls: draw 1 (NO_LABEL_PASSAGE) is INVALID and never reaches
    // extraction at all (passageMentionsAnyLabel() rejects it before gemmaExtract() is called,
    // exactly as D-BP153-016 FIX 3 already does for owned passages) -- so the two queued responses
    // below serve draw 2 and its own REPLACEMENT (draw 3), both FULL_KINDS_PASSAGE, agreeing.
    global.fetch = queuedFetch([fullKindsJson(), fullKindsJson()]);
    const askGoogle = vi.fn()
      .mockResolvedValueOnce({ snippet: NO_LABEL_PASSAGE })
      .mockResolvedValueOnce({ snippet: FULL_KINDS_PASSAGE })
      .mockResolvedValueOnce({ snippet: FULL_KINDS_PASSAGE });
    try {
      const { note, log } = notes();
      const result = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, ALL, OPT, note,
      );

      // THREE draws issued: the original invalid one, plus ONE replacement, plus the second of the
      // two VALID draws LB_DRAW_REPEATS=2 still requires before it will trust an agreement.
      expect(askGoogle).toHaveBeenCalledTimes(3);
      expect(result.drawsIssued).toBe(3);
      expect(result.drawRepeats).toBe(2);

      // THE POINT: never draw-disagreement, never a capture failure -- the frame IS established,
      // from the two VALID, agreeing draws, exactly as THE RULE requires ("it must never veto a
      // good draw").
      expect(result.available).toBe(true);
      expect(result.via).not.toBe('draw-disagreement');
      expect(result.via).not.toBe('draw-capture-failure');

      // THE DISCARD IS SAID OUT LOUD (THE RULE, rule 5): draw number, INVALID, the transport, and a
      // passage preview.
      const discardLine = log.find((l) => /draw 1 DISCARDED as INVALID/.test(l));
      expect(discardLine).toBeDefined();
      expect(discardLine).toMatch(/D-BP154-001/);
      expect(discardLine).toMatch(/passage preview/);
      expect(discardLine).toMatch(/taking a REPLACEMENT draw/);
      // A silent discard is indistinguishable from a draw that never happened -- it is not silent.
      expect(log.some((l) => /REPLACEMENT draw 1 of/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('TEST 2 (THE RULE, other half): draws that all extract NOTHING are not in agreement', () => {
  test('two VALID draws (each names an option) but extract nothing -- NOT recorded as agreeing; abstain reason is CAPTURE FAILURE, never disagreement, never a trusted empty frame', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([nothingExtractedJson(), nothingExtractedJson()]);
    const askGoogle = vi.fn(async () => ({ snippet: NAMES_BUT_EXTRACTS_NOTHING_PASSAGE }));
    try {
      const { note, log } = notes();
      const result = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, ALL, OPT, note,
      );
      // Exactly LB_DRAW_REPEATS (2) draws -- neither draw was INVALID (the passage names every
      // option), so no replacement was ever taken.
      expect(askGoogle).toHaveBeenCalledTimes(2);
      expect(result.drawsIssued).toBe(2);
      expect(result.available).toBe(false);
      expect(result.via).toBe('draw-capture-failure');
      expect(result.via).not.toBe('draw-disagreement');
      expect(result.reconciliationWhy).toMatch(/CAPTURE FAILURE/);
      expect(result.reconciliationWhy).toMatch(/D-BP154-001/);
      expect(result.reconciliationWhy).not.toMatch(/disagreed/i);
      const emptyLine = log.find((l) => /extracted\s+NOTHING/.test(l));
      expect(emptyLine).toBeDefined();
      expect(emptyLine).toMatch(/agreement on an empty result is not corroboration/i);
      expect(emptyLine).toMatch(/CAPTURE FAILURE/);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('TEST 3 (SCOPE GUARD, unchanged): two VALID draws that genuinely conflict still ABSTAIN via draw-disagreement', () => {
  // Not re-tested here in full -- classify_cascade.repeated_draws.test.ts's own TEST 1 and its
  // BOUNDARY describe block already prove this exhaustively and continue to pass unmodified by this
  // ticket (see this file's own fail-before/pass-after run). Restated as one direct assertion here
  // so this file alone demonstrates the full six-point TESTS list the ticket names, without
  // duplicating that file's own fixtures wholesale.
  test('neither draw is invalid or empty -- disagreement is reported exactly as before this ticket', async () => {
    const originalFetch = global.fetch;
    const DRAW1 = 'For EACH of these: South America is a continent, South Asia is a continent, '
      + 'Northeast United States is a sub-national zone, Europe is a continent, North Africa is a '
      + 'colloquial area, Central Asia is a colloquial area, Arctic Circle is a biome, Amazon '
      + 'Rainforest is a biome, Sahara Desert is a biome.';
    const DRAW2 = 'For EACH of these: South America is a biome, South Asia is a continent, '
      + 'Northeast United States is a sub-national zone, Europe is a continent, North Africa is a '
      + 'continent, Central Asia is a colloquial area, Arctic Circle is a biome, Amazon Rainforest '
      + 'is a biome, Sahara Desert is a biome.';
    global.fetch = queuedFetch([
      JSON.stringify({
        kinds: [
          { name: 'South America', kind: 'continent', span: DRAW1 },
          { name: 'South Asia', kind: 'continent', span: DRAW1 },
          { name: 'Northeast United States', kind: 'sub-national zone', span: DRAW1 },
          { name: 'Europe', kind: 'continent', span: DRAW1 },
          { name: 'North Africa', kind: 'colloquial area', span: DRAW1 },
          { name: 'Central Asia', kind: 'colloquial area', span: DRAW1 },
          { name: 'Arctic Circle', kind: 'biome', span: DRAW1 },
          { name: 'Amazon Rainforest', kind: 'biome', span: DRAW1 },
          { name: 'Sahara Desert', kind: 'biome', span: DRAW1 },
        ],
        category_kind: 'continent', category_kind_span: DRAW1, stated_in_passage: true,
      }),
      JSON.stringify({
        kinds: [
          { name: 'South America', kind: 'biome', span: DRAW2 },
          { name: 'South Asia', kind: 'continent', span: DRAW2 },
          { name: 'Northeast United States', kind: 'sub-national zone', span: DRAW2 },
          { name: 'Europe', kind: 'continent', span: DRAW2 },
          { name: 'North Africa', kind: 'continent', span: DRAW2 },
          { name: 'Central Asia', kind: 'colloquial area', span: DRAW2 },
          { name: 'Arctic Circle', kind: 'biome', span: DRAW2 },
          { name: 'Amazon Rainforest', kind: 'biome', span: DRAW2 },
          { name: 'Sahara Desert', kind: 'biome', span: DRAW2 },
        ],
        category_kind: 'continent', category_kind_span: DRAW2, stated_in_passage: true,
      }),
    ]);
    const askGoogle = vi.fn()
      .mockResolvedValueOnce({ snippet: DRAW1 })
      .mockResolvedValueOnce({ snippet: DRAW2 });
    try {
      const { note } = notes();
      const result = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, ALL, OPT, note,
      );
      expect(askGoogle).toHaveBeenCalledTimes(2); // no replacement -- neither draw was invalid
      expect(result.available).toBe(false);
      expect(result.via).toBe('draw-disagreement');
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('TEST 4: invalid draws beyond the cap -> abstain, the cap named in the transcript', () => {
  test('every attempt (through the replacement cap) is INVALID -- CAPTURE FAILURE, cap named, never draw-disagreement', async () => {
    const originalFetch = global.fetch;
    // No gemmaExtract() call is EVER reached -- every draw is rejected by passageMentionsAnyLabel()
    // before extraction is attempted.
    global.fetch = queuedFetch([]);
    const askGoogle = vi.fn(async () => ({ snippet: NO_LABEL_PASSAGE }));
    try {
      const { note, log } = notes();
      const result = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, ALL, OPT, note,
      );
      // LB_DRAW_REPEATS (2) + LB_DRAW_MAX_INVALID_REPLACEMENTS (2) = 4 TOTAL attempts, never more.
      expect(askGoogle).toHaveBeenCalledTimes(4);
      expect(result.drawsIssued).toBe(4);
      expect(result.available).toBe(false);
      expect(result.via).toBe('draw-capture-failure');
      expect(result.via).not.toBe('draw-disagreement');
      // THE CAP IS NAMED IN THE TRANSCRIPT.
      expect(log.some((l) => /LB_DRAW_MAX_INVALID_REPLACEMENTS=2/.test(l))).toBe(true);
      expect(log.some((l) => /CAPTURE FAILURE/.test(l) && /D-BP154-001/.test(l))).toBe(true);
      // Exactly 4 discard notes -- every attempt, none silent.
      expect(log.filter((l) => /DISCARDED as INVALID/.test(l))).toHaveLength(4);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('TEST 5: a VALID draw is never discarded', () => {
  test('an invalid draw in the MIDDLE of the sequence is replaced; the valid draws on either side of it both survive into the trusted comparison', async () => {
    const originalFetch = global.fetch;
    // draw 1: VALID (FULL_KINDS_PASSAGE). draw 2: INVALID (NO_LABEL_PASSAGE), discarded, replaced.
    // draw 3 (the replacement): VALID (FULL_KINDS_PASSAGE), agreeing with draw 1.
    global.fetch = queuedFetch([fullKindsJson(), fullKindsJson()]);
    const askGoogle = vi.fn()
      .mockResolvedValueOnce({ snippet: FULL_KINDS_PASSAGE })
      .mockResolvedValueOnce({ snippet: NO_LABEL_PASSAGE })
      .mockResolvedValueOnce({ snippet: FULL_KINDS_PASSAGE });
    try {
      const { note, log } = notes();
      const result = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, ALL, OPT, note,
      );
      expect(askGoogle).toHaveBeenCalledTimes(3);
      expect(result.available).toBe(true);
      // draw 1's own VALID result (kinds stated) survives into the trusted, agreed frame -- it was
      // never discarded, only draw 2 (the invalid one) was. FULL_KINDS_PASSAGE states categoryKind
      // "continent"; applyFrameKindElimination() excludes every OTHER stated kind (sub-national
      // zone, colloquial area x2, biome x3) and keeps only the three continents.
      expect(result.excluded.sort()).toEqual(['C', 'D', 'F', 'G', 'H', 'I']);
      expect(result.included.sort()).toEqual(['A', 'B', 'E']);
      expect(log.filter((l) => /DISCARDED as INVALID/.test(l))).toHaveLength(1);
      expect(log.some((l) => /draw 2 DISCARDED as INVALID/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('TEST 6: the replacement count is visible without reading the ledger', () => {
  test('drawsIssued exceeds drawRepeats by exactly the number of replacement draws actually taken', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([fullKindsJson(), fullKindsJson()]);
    const askGoogle = vi.fn()
      .mockResolvedValueOnce({ snippet: NO_LABEL_PASSAGE }) // draw 1: INVALID
      .mockResolvedValueOnce({ snippet: FULL_KINDS_PASSAGE }) // replacement 1: VALID
      .mockResolvedValueOnce({ snippet: FULL_KINDS_PASSAGE }); // draw 2 (still owed): VALID, agrees
    try {
      const { note } = notes();
      const result = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, ALL, OPT, note,
      );
      expect(result.available).toBe(true);
      expect(result.drawRepeats).toBe(2);
      expect(result.drawsIssued).toBe(3);
      // THE RECONCILIATION runSuperlativeByMagnitude()'s own QUERY BILL performs
      // (replacementDrawsOf(), classify_cascade.ts): drawsIssued - drawRepeats is exactly the
      // number of replacement draws taken -- here, 1 -- with no need to read the ledger.
      expect((result.drawsIssued ?? 0) - (result.drawRepeats ?? 0)).toBe(1);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
