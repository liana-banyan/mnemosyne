// comparative_cascade.gemma_extract_failure_causes.test.ts -- D-BP154-006/BISHOP-SEG/S6/seg-gemmafail
//
// Authorized by FD-BP154-01 (RULINGS_BP154.md, Founder, BP154, verbatim: "lift the fence, fix
// gemmaExtract too") -- the fence on comparative_cascade.ts is lifted ONLY for gemmaExtract()'s
// failure reporting and the minimal caller changes that fix requires. This file tests gemmaExtract()
// itself, directly, against source (never dist) -- vitest resolves the relative import fine; the
// LEGACY comparative_cascade.test.ts sibling's own dist-require convention (its own header explains
// why) is untouched and unrelated.
//
// THE MEASURED DEFECT (BISHOP_DROPZONE\BP154_LOSSY_HOP_AUDIT.md, SILENT hop 3,
// `comparative_cascade.ts` old `catch { return null; }`): every failure cause -- Ollama unreachable,
// an HTTP error status (never even checked), a non-truncation JSON parse failure -- returned `null`,
// indistinguishable from D-BP153-034's OWN measured defect (a truncated read) and from an honest,
// genuinely empty extraction. D-BP153-034 closed exactly the truncation cause (`rawOut.truncated`);
// this ticket closes the rest of the class via three NEW, additive `rawOut` fields:
// `failureCause: 'transport' | 'http-error' | 'parse-error'` and `failureDetail`.
//
// TEST 1-3: each of the three NEW causes is distinguishable from honest-empty (TEST 5) and from each
// other. TEST 4: truncation is UNCHANGED (D-BP153-034 intact, never double-labeled as a generic
// parse-error too). TEST 6: the SUCCESS path is byte-identical -- a passage that extracts cleanly
// returns the exact same parsed value as before this ticket, proving no behavior change there.

import { describe, test, expect } from 'vitest';
import { gemmaExtract } from './comparative_cascade';

type RawOut = {
  text?: string;
  truncated?: boolean;
  failureCause?: 'transport' | 'http-error' | 'parse-error';
  failureDetail?: string;
};

describe('D-BP154-006 TEST 1: TRANSPORT FAILURE (fetch() itself throws) is named, never silent', () => {
  test('Ollama unreachable (fetch rejects) -> failureCause "transport", null return, rawOut.text never set', async () => {
    const originalFetch = global.fetch;
    global.fetch = (async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:11434');
    }) as unknown as typeof fetch;
    try {
      const rawOut: RawOut = {};
      const result = await gemmaExtract('extract something', 'a passage', '{"x":"y"}', rawOut);
      expect(result).toBeNull();
      expect(rawOut.failureCause).toBe('transport');
      expect(rawOut.failureDetail).toMatch(/ECONNREFUSED/);
      expect(rawOut.text).toBeUndefined(); // the round trip never completed -- there is no text to carry
      expect(rawOut.truncated).toBeUndefined(); // never conflated with the truncation signal
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP154-006 TEST 2: HTTP ERROR STATUS is named, never read as a 200 would be', () => {
  test('a 500 response (previously NEVER CHECKED -- res.ok had no guard at all) -> failureCause "http-error"', async () => {
    const originalFetch = global.fetch;
    global.fetch = (async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'model not found' }),
    })) as unknown as typeof fetch;
    try {
      const rawOut: RawOut = {};
      const result = await gemmaExtract('extract something', 'a passage', '{"x":"y"}', rawOut);
      expect(result).toBeNull();
      expect(rawOut.failureCause).toBe('http-error');
      expect(rawOut.failureDetail).toBe('HTTP 500');
      expect(rawOut.text).toBeUndefined(); // res.json() on the error body was never even attempted
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP154-006 TEST 3: JSON PARSE FAILURE (non-truncation) is named, distinctly from truncation', () => {
  test('the model wraps its JSON in explanatory prose the fence-strips do not catch -> failureCause "parse-error", rawOut.text carries the raw text', async () => {
    const originalFetch = global.fetch;
    global.fetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({ response: 'Sure, here is the answer: {"x":"y"} -- hope that helps!', done_reason: 'stop' }),
    })) as unknown as typeof fetch;
    try {
      const rawOut: RawOut = {};
      const result = await gemmaExtract('extract something', 'a passage', '{"x":"y"}', rawOut);
      expect(result).toBeNull(); // JSON.parse() throws on the prose-wrapped text
      expect(rawOut.failureCause).toBe('parse-error');
      expect(rawOut.failureDetail).toBeTruthy();
      expect(rawOut.text).toContain('hope that helps'); // D-BP152-004's own instrument, unchanged
      expect(rawOut.truncated).toBe(false); // done_reason was "stop", not "length" -- genuinely NOT truncation
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('res.json() itself throws (the body was not JSON at all) -> ALSO collapses into "parse-error" (the two sub-causes this function cannot cheaply distinguish further, named explicitly in this file\'s own header)', async () => {
    const originalFetch = global.fetch;
    global.fetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('Unexpected token < in JSON'); },
    })) as unknown as typeof fetch;
    try {
      const rawOut: RawOut = {};
      const result = await gemmaExtract('extract something', 'a passage', '{"x":"y"}', rawOut);
      expect(result).toBeNull();
      expect(rawOut.failureCause).toBe('parse-error');
      expect(rawOut.text).toBeUndefined(); // never reached the point where `t` is assigned
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP154-006 TEST 4 (NO REGRESSION): truncation (done_reason=length) is UNCHANGED, D-BP153-034 intact', () => {
  test('a truncated read sets truncated:true and does NOT also set failureCause (never double-labeled)', async () => {
    const originalFetch = global.fetch;
    global.fetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({ response: '{"kinds": [{"name": "A", "kind": "Continent"', done_reason: 'length' }),
    })) as unknown as typeof fetch;
    try {
      const rawOut: RawOut = {};
      const result = await gemmaExtract('extract something', 'a passage', '{"x":"y"}', rawOut);
      expect(result).toBeNull(); // cut mid-object, JSON.parse throws
      expect(rawOut.truncated).toBe(true);
      // THE POINT: truncation already names itself more precisely than a generic parse failure --
      // this must never ALSO be reported as failureCause:'parse-error'.
      expect(rawOut.failureCause).toBeUndefined();
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP154-006 TEST 5 (SCOPE GUARD): honest-empty is NOT a failure -- a clean parse with null/empty fields returns non-null, no failureCause', () => {
  test('the model genuinely states nothing: valid JSON, every field null -- gemmaExtract() returns the parsed object, not null; failureCause is never set on a success', async () => {
    const originalFetch = global.fetch;
    const emptyReply = { kinds: [], category_kind: null, category_kind_span: '', stated_in_passage: false };
    global.fetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({ response: JSON.stringify(emptyReply), done_reason: 'stop' }),
    })) as unknown as typeof fetch;
    try {
      const rawOut: RawOut = {};
      const result = await gemmaExtract('extract something', 'a passage', '{"x":"y"}', rawOut);
      expect(result).not.toBeNull(); // a SUCCESSFUL parse -- this is the crucial distinction
      expect(result).toEqual(emptyReply);
      expect(rawOut.failureCause).toBeUndefined();
      expect(rawOut.truncated).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP154-006 TEST 6 (SUCCESS PATH UNCHANGED): a clean extraction returns byte-identical values', () => {
  test('a normal, successful call returns the parsed object exactly, and rawOut.text/truncated are set exactly as D-BP153-034 already established', async () => {
    const originalFetch = global.fetch;
    const cleanReply = { kinds: [{ name: 'South America', kind: 'Continent', span: 'South America: Continent.' }], category_kind: 'Continent', category_kind_span: 'A world region is a Continent.', stated_in_passage: true };
    let capturedBody: string | undefined;
    global.fetch = (async (_url: unknown, init: { body?: string }) => {
      capturedBody = init?.body;
      return {
        ok: true,
        status: 200,
        json: async () => ({ response: JSON.stringify(cleanReply), done_reason: 'stop' }),
      };
    }) as unknown as typeof fetch;
    try {
      const rawOut: RawOut = {};
      const result = await gemmaExtract('copy the stated kind', 'South America: Continent. A world region is a Continent.', '{"kinds":[]}', rawOut);
      expect(result).toEqual(cleanReply);
      expect(rawOut.text).toBe(JSON.stringify(cleanReply));
      expect(rawOut.truncated).toBe(false);
      expect(rawOut.failureCause).toBeUndefined();
      // The request body construction itself (model, prompt, options) is untouched by this ticket.
      const parsedBody = JSON.parse(capturedBody!);
      expect(parsedBody.model).toBeTruthy();
      expect(parsedBody.options).toEqual({ temperature: 0, num_predict: 1024 });
      expect(parsedBody.prompt).toContain('copy the stated kind');
      expect(parsedBody.prompt).toContain('South America: Continent.');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
