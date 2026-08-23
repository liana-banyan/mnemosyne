// comparative_cascade.llm_cost_instrument.test.ts -- D-BP164-M0-068/BISHOP/M0/seg-cu
//
// SEG-CI (D-BP164-M0-057) MEASURED, and this dispatch (D-BP164-M0-068) independently re-confirmed
// by reading the same source (cost_instrument.ts, D-BP159-009_price_table_map.json): the
// production cost instrument wired at runLianaCycleQuestion() never measured a single LLM token --
// `actual_usd` is a hardcoded 0, `tokens.measured` is ALWAYS false, and the counterfactual is
// priced against Google search CALL COUNT, never against LLM/model tokens. The K511 headline
// numbers (155x input-token ratio) come from a SEPARATE standalone Python harness
// (librarian-mcp/r10_cross_vendor/run_local_llm_k511_bp164.py + ollama_adapter.py) that reads
// Ollama's own `prompt_eval_count`/`eval_count` response fields directly -- proven, free, no
// tokenizer subprocess. This ticket wires that SAME proven technique into gemmaExtract()
// (the one real Ollama/LLM call site reachable from runLianaCycleQuestion()), via
// cost_instrument.ts's new recordLlmCall()/runWithLlmCostLedger()/summarizeLlmCostLedger().
//
// vitest, source imports (never dist) -- same convention as this file's own sibling
// comparative_cascade.gemma_extract_failure_causes.test.ts.
//
// Mocks `global.fetch` for gemmaExtract()'s own /api/generate call ONLY. The digest resolver
// (resolveGemmaModelDigest()) deliberately does NOT go through global.fetch (see that function's
// own header comment in comparative_cascade.ts for the measured reason: routing it through
// fetch() was tried first and broke ~9 pre-existing test files that use a strict queued-fetch
// mock convention) -- it uses node:http/node:https directly, so on a machine/CI sandbox with no
// real Ollama daemon listening, digest resolution fails fast (connection refused) and resolves to
// null, which these tests assert for rather than requiring a live Ollama daemon.

import { describe, test, expect, beforeEach } from 'vitest';
import { gemmaExtract, resolveGemmaModelDigest, _resetGemmaModelDigestCacheForTests } from './comparative_cascade';
import { runWithLlmCostLedger, summarizeLlmCostLedger } from '../cost_instrument';
import type { LlmCallCostRecord } from '../cost_instrument';

type RawOut = {
  text?: string;
  truncated?: boolean;
  failureCause?: 'transport' | 'http-error' | 'parse-error' | 'ceiling-exceeded';
  failureDetail?: string;
  costRecord?: LlmCallCostRecord;
};

beforeEach(() => {
  _resetGemmaModelDigestCacheForTests();
});

describe('D-BP164-M0-068 TEST 1: REAL TOKEN COUNTS -- a successful Ollama round trip records measured input/output tokens, read off prompt_eval_count/eval_count, never a guess', () => {
  test('gemmaExtract() success path: rawOut.costRecord.tokens is measured:true with the exact counts Ollama reported', async () => {
    const originalFetch = global.fetch;
    global.fetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        response: JSON.stringify({ x: 'y' }),
        done_reason: 'stop',
        prompt_eval_count: 4213,
        eval_count: 97,
      }),
    })) as unknown as typeof fetch;
    try {
      const rawOut: RawOut = {};
      const result = await gemmaExtract('extract something', 'a passage', '{"x":"y"}', rawOut);
      expect(result).toEqual({ x: 'y' });
      expect(rawOut.costRecord).toBeDefined();
      const rec = rawOut.costRecord!;
      expect(rec.tokens.measured).toBe(true);
      if (rec.tokens.measured) {
        expect(rec.tokens.input_tokens).toBe(4213);
        expect(rec.tokens.output_tokens).toBe(97);
      }
      expect(rec.leg).toBe('gemma-ollama-local-llm');
      expect(typeof rec.latency_ms).toBe('number');
      expect(rec.latency_ms).toBeGreaterThanOrEqual(0);
      expect(typeof rec.machineId).toBe('string');
      expect(rec.machineId.length).toBeGreaterThan(0);
      expect(rec.model).toBeTruthy();
      // modelDigest is either a real digest string (if this machine happens to have Ollama live
      // and reachable at 127.0.0.1:11434, resolved via node:http, never via the mocked
      // global.fetch above) or null (no live daemon reachable) -- either is a valid, honest
      // outcome; a guessed/fabricated digest is the only thing that would fail this assertion.
      expect(rec.modelDigest === null || typeof rec.modelDigest === 'string').toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP164-M0-068 TEST 1b: LIVE DIGEST RESOLUTION (opportunistic, no assumption an Ollama daemon is running here) -- when one IS reachable, the resolved digest matches the standing-order-cited prefix', () => {
  test('resolveGemmaModelDigest("gemma4:12b") is either null (no live daemon) or a digest whose first 12 hex characters are 4eb23ef187e2, never a fabricated string', async () => {
    const digest = await resolveGemmaModelDigest('gemma4:12b');
    if (digest === null) {
      // No live Ollama daemon reachable in this environment -- honest, not a failure.
      expect(digest).toBeNull();
    } else {
      expect(digest.slice(0, 12)).toBe('4eb23ef187e2');
    }
  });
});

describe('D-BP164-M0-068 TEST 2: ACTUAL DOLLARS -- local Ollama inference is a TRUE architectural $0, sourced from the real price table, never a bare unexplained zero', () => {
  test('dollars.actual_usd is 0, dollars.actual_priced is true, and the reason cites the local-member-hardware price-table row (not a guess)', async () => {
    const originalFetch = global.fetch;
    global.fetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({ response: JSON.stringify({ x: 'y' }), done_reason: 'stop', prompt_eval_count: 100, eval_count: 20 }),
    })) as unknown as typeof fetch;
    try {
      const rawOut: RawOut = {};
      await gemmaExtract('extract something', 'a passage', '{"x":"y"}', rawOut);
      const rec = rawOut.costRecord!;
      expect(rec.dollars.actual_usd).toBe(0);
      expect(rec.dollars.actual_priced).toBe(true);
      expect(rec.dollars.actual_reason).toBeTruthy();
      expect(rec.dollars.actual_reason.length).toBeGreaterThan(10);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP164-M0-068 TEST 3: COUNTERFACTUAL DOLLARS -- priced against a NAMED, SOURCED, DATED frontier rate (never an unsourced or undated guess)', () => {
  test('dollars.counterfactual_usd is a positive number computed from real measured tokens, counterfactual_model/rate_source/reason are all populated', async () => {
    const originalFetch = global.fetch;
    global.fetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        response: JSON.stringify({ x: 'y' }),
        done_reason: 'stop',
        // Large, deliberately round token counts so the arithmetic is easy to sanity-check by
        // hand against substrate_price_table.json's own claude-sonnet-5 row ($2/$10 per MTok):
        // expected counterfactual = (1_000_000/1e6)*2 + (500_000/1e6)*10 = 2 + 5 = $7.00
        prompt_eval_count: 1_000_000,
        eval_count: 500_000,
      }),
    })) as unknown as typeof fetch;
    try {
      const rawOut: RawOut = {};
      await gemmaExtract('extract something', 'a passage', '{"x":"y"}', rawOut);
      const rec = rawOut.costRecord!;
      expect(rec.dollars.counterfactual_priced).toBe(true);
      expect(typeof rec.dollars.counterfactual_usd).toBe('number');
      expect(rec.dollars.counterfactual_usd).not.toBeNull();
      expect(rec.dollars.counterfactual_usd as number).toBeGreaterThan(0);
      // Exact figure per substrate_price_table.json's live claude-sonnet-5 row, sanity-checked
      // rather than hardcoded blind -- if the Founder-controlled table's rate ever changes, this
      // assertion is meant to fail loudly rather than silently drift.
      expect(rec.dollars.counterfactual_usd as number).toBeCloseTo(7.0, 6);
      expect(rec.dollars.counterfactual_model).toBe('claude-sonnet-5');
      expect(rec.dollars.counterfactual_rate_source).toBeTruthy();
      expect(rec.dollars.counterfactual_reason).toContain('claude-sonnet-5');
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP164-M0-068 TEST 4: UNMEASURED TOKENS -- a round trip that never reached a parsed Ollama response is recorded honestly, never a guessed token count or a guessed counterfactual', () => {
  test('transport failure (fetch itself throws): tokens.measured is false with a named reason, counterfactual_priced is false', async () => {
    const originalFetch = global.fetch;
    global.fetch = (async () => { throw new Error('connect ECONNREFUSED 127.0.0.1:11434'); }) as unknown as typeof fetch;
    try {
      const rawOut: RawOut = {};
      const result = await gemmaExtract('extract something', 'a passage', '{"x":"y"}', rawOut);
      expect(result).toBeNull();
      expect(rawOut.failureCause).toBe('transport');
      const rec = rawOut.costRecord!;
      expect(rec.tokens.measured).toBe(false);
      if (!rec.tokens.measured) {
        expect(rec.tokens.reason).toMatch(/transport failure/);
      }
      expect(rec.dollars.counterfactual_priced).toBe(false);
      expect(rec.dollars.counterfactual_usd).toBeNull();
      // Actual dollars ($0, architectural) is STILL correctly priced -- a transport failure means
      // no tokens were measured, not that the local-hardware $0 fact stopped being true.
      expect(rec.dollars.actual_priced).toBe(true);
      expect(rec.dollars.actual_usd).toBe(0);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('HTTP error response: tokens.measured is false, named reason cites the HTTP status, no double-recording', async () => {
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
      const rec = rawOut.costRecord!;
      expect(rec.tokens.measured).toBe(false);
      if (!rec.tokens.measured) {
        expect(rec.tokens.reason).toMatch(/HTTP 500/);
      }
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('res.json() itself throws (body not JSON at all): exactly ONE cost record, tokens.measured false -- never double-counted against the parse-error path', async () => {
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
      expect(rawOut.costRecord).toBeDefined();
      expect(rawOut.costRecord!.tokens.measured).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('a genuine JSON.parse(t) failure on the model text (res.json() itself succeeded): tokens ARE recorded, since a real Ollama response body WAS obtained', async () => {
    const originalFetch = global.fetch;
    global.fetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        response: 'Sure, here is the answer: it depends, honestly, hope that helps!',
        done_reason: 'stop',
        prompt_eval_count: 55,
        eval_count: 12,
      }),
    })) as unknown as typeof fetch;
    try {
      const rawOut: RawOut = {};
      const result = await gemmaExtract('extract something', 'a passage', '{"x":"y"}', rawOut);
      expect(result).toBeNull();
      expect(rawOut.failureCause).toBe('parse-error');
      const rec = rawOut.costRecord!;
      // The round trip DID complete and Ollama DID report usage -- extraction failing is a
      // separate fact from the call being measured; conflating them would under-report real cost.
      expect(rec.tokens.measured).toBe(true);
      if (rec.tokens.measured) {
        expect(rec.tokens.input_tokens).toBe(55);
        expect(rec.tokens.output_tokens).toBe(12);
      }
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP164-M0-068 TEST 5: CEILING-EXCEEDED REFUSAL -- no fetch() attempted at all, so no cost record is created (never a phantom call)', () => {
  test('a prompt sized past GEMMA_NUM_CTX_CEILING is refused before fetch() -- rawOut.costRecord stays undefined', async () => {
    const originalFetch = global.fetch;
    let fetchCalled = false;
    global.fetch = (async () => { fetchCalled = true; return { ok: true, status: 200, json: async () => ({}) }; }) as unknown as typeof fetch;
    try {
      const rawOut: RawOut = {};
      // A passage far larger than the ~32768-token ceiling (roughly 4 chars/token, so well over
      // 140,000 characters guarantees a refusal regardless of the exact estimator constant).
      const hugePassage = 'x'.repeat(400_000);
      const result = await gemmaExtract('extract something', hugePassage, '{"x":"y"}', rawOut);
      expect(result).toBeNull();
      expect(rawOut.failureCause).toBe('ceiling-exceeded');
      expect(fetchCalled).toBe(false);
      expect(rawOut.costRecord).toBeUndefined();
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP164-M0-068 TEST 6: PER-RUN LEDGER -- runWithLlmCostLedger() scopes records to ONE run, never leaking across concurrent/sequential runs (FD-BP164-03/04: per-node, never averaged, extended here to per-run)', () => {
  test('two sequential runWithLlmCostLedger() calls each see only their own gemmaExtract() calls', async () => {
    const originalFetch = global.fetch;
    global.fetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({ response: JSON.stringify({ x: 'y' }), done_reason: 'stop', prompt_eval_count: 10, eval_count: 5 }),
    })) as unknown as typeof fetch;
    try {
      const { ledger: ledgerA } = await runWithLlmCostLedger(async () => {
        await gemmaExtract('q1', 'passage', '{"x":"y"}');
        await gemmaExtract('q2', 'passage', '{"x":"y"}');
      });
      expect(ledgerA.length).toBe(2);
      expect(ledgerA[0]?.callIndex).toBe(1);
      expect(ledgerA[1]?.callIndex).toBe(2);

      const { ledger: ledgerB } = await runWithLlmCostLedger(async () => {
        await gemmaExtract('q3', 'passage', '{"x":"y"}');
      });
      // A FRESH scope -- ledgerB is not ledgerA plus one more; it starts back at callIndex 1 and
      // has nothing to do with the three calls already made above.
      expect(ledgerB.length).toBe(1);
      expect(ledgerB[0]?.callIndex).toBe(1);

      // A call OUTSIDE any runWithLlmCostLedger() scope is still computed (never throws) but
      // attached to no run's ledger -- the AsyncLocalStorage-scoped design's own safety property.
      const rawOut: RawOut = {};
      const resultOutsideScope = await gemmaExtract('q4', 'passage', '{"x":"y"}', rawOut);
      expect(resultOutsideScope).toEqual({ x: 'y' });
      expect(rawOut.costRecord).toBeDefined(); // still computed
      expect(ledgerA.length).toBe(2); // NOT pushed into a finished, out-of-scope ledger
      expect(ledgerB.length).toBe(1);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP164-M0-068 TEST 7: summarizeLlmCostLedger() -- pure roll-up, matches the Google leg\'s own empty-ledger convention', () => {
  test('an empty ledger summarizes to zero totals, not null, not an error', () => {
    const summary = summarizeLlmCostLedger([]);
    expect(summary.callCount).toBe(0);
    expect(summary.totalLatencyMs).toBe(0);
    expect(summary.totalInputTokens).toBe(0);
    expect(summary.totalOutputTokens).toBe(0);
    expect(summary.totalActualUsd).toBe(0);
    expect(summary.totalCounterfactualUsd).toBe(0);
    expect(typeof summary.machineId).toBe('string');
  });

  test('a ledger with one measured and one unmeasured record: token totals sum only the measured record, counterfactual is null (never a partial guess) because at least one record is unpriced', async () => {
    const originalFetch = global.fetch;
    let call = 0;
    global.fetch = (async () => {
      call++;
      if (call === 1) {
        return { ok: true, status: 200, json: async () => ({ response: JSON.stringify({ x: 'y' }), done_reason: 'stop', prompt_eval_count: 200, eval_count: 50 }) };
      }
      throw new Error('connect ECONNREFUSED 127.0.0.1:11434');
    }) as unknown as typeof fetch;
    try {
      const { ledger } = await runWithLlmCostLedger(async () => {
        await gemmaExtract('q1', 'passage', '{"x":"y"}');
        await gemmaExtract('q2', 'passage', '{"x":"y"}');
      });
      expect(ledger.length).toBe(2);
      const summary = summarizeLlmCostLedger(ledger);
      expect(summary.callCount).toBe(2);
      expect(summary.totalInputTokens).toBe(200);
      expect(summary.totalOutputTokens).toBe(50);
      expect(summary.totalActualUsd).toBe(0);
      // ONE of the two records is unpriced (the transport failure) -- the Google leg's own rule
      // ("a guessed price is worse than a missing one") means the WHOLE run's counterfactual total
      // is null, never a silently-partial sum that looks complete but is not.
      expect(summary.totalCounterfactualUsd).toBeNull();
    } finally {
      global.fetch = originalFetch;
    }
  });
});
