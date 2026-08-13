// classify_cascade.gemma_extract_failure_naming.test.ts -- D-BP154-006/BISHOP-SEG/S6/seg-gemmafail
//
// THE MINIMAL CALLER CHANGE FD-BP154-01 authorizes (RULINGS_BP154.md): extractDiscriminatorKinds()
// (classify_cascade.ts) now passes gemmaExtract()'s new `failureCause`/`failureDetail` (
// comparative_cascade.ts, D-BP154-006) straight through, and extractFrameKinds() (THE SOFTBALLS' own
// stated-kind read, the function establishFrame() calls) names a non-truncation extraction failure
// out loud, exactly the way it already names truncation (D-BP153-034).
//
// TEST 1: a TRANSPORT FAILURE (Ollama unreachable) on the owned-passage read is NAMED in the
// transcript, distinctly from truncation and from an honest empty passage.
// TEST 2 (THE POINT, ticket's own item 4): the failure is NEVER consumed as evidence -- it falls
// through to a fresh query exactly as an INCOMPLETE or empty read already does, never becomes a
// stated fact ("this option is excluded") about the passage. This is D-BP154-005's own connection,
// named explicitly in TICKET_D-BP154-006_GEMMAEXTRACT_NAMES_ITS_FAILURE.md ("a failed extraction
// that reads as 'nothing stated' can become a frame that excludes everything").
// TEST 3 (NO REGRESSION): truncation is still named exactly as D-BP153-034 built it, never relabeled
// as a generic extraction failure.

import {
  describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest';
beforeEach(() => { process.env.LB_DRAW_REPEATS = '1'; });
afterEach(() => { delete process.env.LB_DRAW_REPEATS; });

import { establishFrame } from './classify_cascade';
import type { MethodRunContext, OwnedPassage } from '../method_registry';

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

const owned = (text: string): OwnedPassage => ({ text, kind: 'operation' });

function notes(): { note: (text: string) => void; log: string[] } {
  const log: string[] = [];
  return { note: (text: string) => log.push(text), log };
}

const PASSAGE = 'A) South America: Continent. B) South Asia: Continent. C) North Africa: Continent. '
  + 'D) Northeast United States: Subnational Region. E) Europe: Continent. F) Central Asia: Continent. '
  + 'G) Arctic Circle: Biome. H) Amazon Rainforest: Biome. I) Sahara Desert: Biome. '
  + 'A world region properly denotes a Continent.';

function cleanResponse(): Record<string, unknown> {
  const kindFor: Record<string, string> = {
    A: 'Continent', B: 'Continent', C: 'Continent', D: 'Subnational Region', E: 'Continent', F: 'Continent',
    G: 'Biome', H: 'Biome', I: 'Biome',
  };
  const spanFor: Record<string, string> = {
    A: 'A) South America: Continent.',
    B: 'B) South Asia: Continent.',
    C: 'C) North Africa: Continent.',
    D: 'D) Northeast United States: Subnational Region.',
    E: 'E) Europe: Continent.',
    F: 'F) Central Asia: Continent.',
    G: 'G) Arctic Circle: Biome.',
    H: 'H) Amazon Rainforest: Biome.',
    I: 'I) Sahara Desert: Biome.',
  };
  return {
    kinds: ALL.map((L) => ({ name: OPT[L], kind: kindFor[L], span: spanFor[L] })),
    category_kind: 'Continent',
    category_kind_span: 'A world region properly denotes a Continent.',
    stated_in_passage: true,
  };
}

describe('D-BP154-006 TEST 1: a TRANSPORT FAILURE on the owned-passage read is NAMED, distinctly from truncation/empty', () => {
  test('Ollama unreachable while reading the OWNED passage: the transcript names EXTRACTION FAILED (transport, D-BP154-006), never silent', async () => {
    const originalFetch = global.fetch;
    // Call 1 (owned-passage attempt): transport failure. Call 2 (fresh-query fallthrough): a clean
    // read, so the run recovers and we can also assert the failure was never trusted as data.
    let call = 0;
    global.fetch = vi.fn(async () => {
      call++;
      if (call === 1) throw new Error('connect ECONNREFUSED 127.0.0.1:11434');
      return { json: async () => ({ response: JSON.stringify(cleanResponse()) }) };
    }) as unknown as typeof fetch;
    const askGoogle = vi.fn(async () => ({ snippet: PASSAGE }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, ALL, OPT, note, () => [owned(PASSAGE)],
      );
      // THE NAMING ASSERTION.
      expect(log.some((l) => /EXTRACTION FAILED \(transport, D-BP154-006\)/.test(l))).toBe(true);
      expect(log.some((l) => /ECONNREFUSED/.test(l))).toBe(true);
      expect(log.some((l) => /NOT because the passage stated nothing/.test(l))).toBe(true);
      // Never conflated with truncation's own, more specific note.
      expect(log.some((l) => /TOKEN CEILING/.test(l))).toBe(false);
      // THE SAFETY ASSERTION (D-BP154-006 item 4, connects to D-BP154-005): the failed owned-passage
      // read was NEVER trusted as "the passage names no members" -- it fell through to the fresh
      // query, which recovered correctly.
      expect(askGoogle).toHaveBeenCalledTimes(1);
      expect(frame.answeredFrom).toBe('new-query');
      expect(frame.available).toBe(true);
      expect(new Set(frame.excluded)).toEqual(new Set(['D', 'G', 'H', 'I']));
      expect(new Set(frame.included)).toEqual(new Set(['A', 'B', 'C', 'E', 'F']));
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP154-006 TEST 2 (THE POINT): a failed extraction is never consumed as a stated fact about the passage', () => {
  test('an HTTP error on EVERY attempt (owned passage AND the fresh query) never becomes a false exclusion -- the run correctly reports the frame as UNAVAILABLE, never "excludes every option, none stated"', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({ error: 'service unavailable' }),
    })) as unknown as typeof fetch;
    const askGoogle = vi.fn(async () => ({ snippet: PASSAGE }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, ALL, OPT, note, () => [owned(PASSAGE)],
      );
      // Named on the owned-passage attempt.
      expect(log.some((l) => /EXTRACTION FAILED \(http-error, D-BP154-006\)/.test(l) && /HTTP 503/.test(l))).toBe(true);
      // THE POINT: a total extraction failure NEVER becomes "the source excludes these options" --
      // it is UNAVAILABLE (D-BP153-032's own "no categoryKind ever stated" rule), never a false,
      // silent exclusion. This is exactly what D-BP154-005's own degenerate-frame guard depends on:
      // a failure must fall through/abstain, never masquerade as a finding about the passage.
      expect(frame.available).toBe(false);
      expect(frame.excluded).toEqual([]);
      expect(frame.included).toEqual([]);
      expect(frame.degenerate).toBeFalsy(); // this is NOT the D-BP154-005 vocabulary-mismatch shape -- nothing was ever stated at all
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP154-006 TEST 3 (NO REGRESSION): truncation is still named exactly as D-BP153-034 built it', () => {
  test('a truncated owned-passage read still reports THE MODEL HIT ITS TOKEN CEILING, never relabeled as a generic extraction failure', async () => {
    const originalFetch = global.fetch;
    let call = 0;
    global.fetch = vi.fn(async () => {
      call++;
      if (call === 1) {
        return {
          json: async () => ({ response: '{"kinds": [{"name": "South America", "kind": "Continent"', done_reason: 'length' }),
        };
      }
      return { json: async () => ({ response: JSON.stringify(cleanResponse()) }) };
    }) as unknown as typeof fetch;
    const askGoogle = vi.fn(async () => ({ snippet: PASSAGE }));
    try {
      const { note, log } = notes();
      await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, ALL, OPT, note, () => [owned(PASSAGE)],
      );
      expect(log.some((l) => /THE MODEL HIT ITS TOKEN CEILING/.test(l) && /D-BP153-034/.test(l))).toBe(true);
      expect(log.some((l) => /EXTRACTION FAILED \(parse-error/.test(l))).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
