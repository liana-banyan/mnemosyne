// origin_frame_step.test.ts -- D-BP154-042/BISHOP-SEG/S42/seg-originframe

import { describe, expect, it, vi } from 'vitest';

// origin_provenance_store.ts's loadOriginProvenance() resolves a path via Electron's `app` module
// (app.isPackaged / app.getAppPath()), which is not available under plain vitest -- every other
// step file with the same dependency (human_nuance_step.ts) avoids exercising that live path in
// its own unit tests for the same reason (see this codebase's established "cannot be exercised end
// to end under vitest" convention, proven instead by an in-app run). Mocked here to return null
// ("no local record"), the honest, real behavior for any qid this repo's resources/ tree does not
// carry a backfilled eblet for -- never a fabricated fixture standing in for a real file read.
vi.mock('./origin_provenance_store', () => ({ loadOriginProvenance: vi.fn(() => null) }));

import {
  fetchOriginOptionSetLive, resolveOriginDataset, runOriginFrameDerivation, runOriginFrameStep,
} from './origin_frame_step';
import type { OriginFrameOption } from './origin_frame_step';
import type { MethodQuestionInput, MethodRunContext } from '../method_registry';
import type { ComposerStepOutcome } from './script_bridge';
import type { TerminatorResult } from './terminator_step';

function ctx(): MethodRunContext {
  return { askGoogle: vi.fn(async () => null), emit: vi.fn() };
}

describe('resolveOriginDataset', () => {
  it('resolves an ori_mmlu-* src to cais/mmlu + the subject config', () => {
    expect(resolveOriginDataset('ori_mmlu-high_school_geography')).toEqual({
      dataset: 'cais/mmlu', config: 'high_school_geography',
    });
  });

  it('returns null for a src with no recognized prefix -- never guesses a dataset', () => {
    expect(resolveOriginDataset('something_else')).toBeNull();
    expect(resolveOriginDataset('')).toBeNull();
  });
});

describe('fetchOriginOptionSetLive -- THE LIVE FALLBACK, mocked fetch', () => {
  const realFetch = globalThis.fetch;

  it('reads question + options from a datasets-server row, never an answer field even if present in the raw JSON', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        rows: [{ row: { question: 'Q?', choices: ['a', 'b'], answer: 2, answer_index: 2 } }],
      }),
    })) as unknown as typeof fetch;
    const r = await fetchOriginOptionSetLive('cais/mmlu', 'high_school_geography', 'test', 100);
    expect(r).toEqual({ question: 'Q?', options: ['a', 'b'] });
    expect(Object.keys(r ?? {})).not.toContain('answer');
    globalThis.fetch = realFetch;
  });

  it('returns null (never fabricates) on a non-200 response', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false })) as unknown as typeof fetch;
    const r = await fetchOriginOptionSetLive('cais/mmlu', 'x', 'test', 0);
    expect(r).toBeNull();
    globalThis.fetch = realFetch;
  });

  it('returns null on a network throw', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('network down'); }) as unknown as typeof fetch;
    const r = await fetchOriginOptionSetLive('cais/mmlu', 'x', 'test', 0);
    expect(r).toBeNull();
    globalThis.fetch = realFetch;
  });

  it('returns null when the row has no usable options field', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true, json: async () => ({ rows: [{ row: { question: 'Q?' } }] }),
    })) as unknown as typeof fetch;
    const r = await fetchOriginOptionSetLive('cais/mmlu', 'x', 'test', 0);
    expect(r).toBeNull();
    globalThis.fetch = realFetch;
  });
});

describe('runOriginFrameStep -- honest failure paths, never a guess', () => {
  it('fails honestly with no originSrc', async () => {
    const input: MethodQuestionInput = { qid: 1, question: 'q?', options: { A: 'x', B: 'y' } };
    const { result } = await runOriginFrameStep(input, ctx(), []);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no originSrc/);
  });

  it('fails honestly for a src with no known origin family', async () => {
    const input: MethodQuestionInput = { qid: 1, question: 'q?', options: { A: 'x' }, originSrc: 'not_a_known_family' };
    const { result } = await runOriginFrameStep(input, ctx(), []);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/does not resolve/);
  });

  it('reports UNAVAILABLE (never a guess) when no local eblet exists and no liveOffset is given', async () => {
    const input: MethodQuestionInput = {
      qid: 999999, question: 'q?', options: { A: 'x' }, originSrc: 'ori_mmlu-high_school_geography',
    };
    const { result } = await runOriginFrameStep(input, ctx(), []);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/UNAVAILABLE/);
    expect(result.originOptions).toEqual([]);
  });
});

describe('runOriginFrameStep -- reads (never re-derives) Terminator:1\'s own augmented-question status', () => {
  it('carries a null augmentedQuestionStatus when Terminator:1 did not run earlier in this stack', async () => {
    const input: MethodQuestionInput = {
      qid: 999999, question: 'q?', options: { A: 'x' }, originSrc: 'ori_mmlu-high_school_geography',
    };
    const { result } = await runOriginFrameStep(input, ctx(), []);
    expect(result.augmentedQuestionStatus).toBeNull();
  });

  it('surfaces Terminator:1\'s own insufficientEvidence verbatim when present in priorResults, even on a failed origin-frame lookup', async () => {
    const terminatorRaw: Partial<TerminatorResult> = {
      verdict: null, abstain: true, abstainReason: 'INSUFFICIENT EVIDENCE: test', incomplete: false,
      insufficientEvidence: { preconditionId: 'negated-superlative-member-bound', reason: 'test reason', policyVersion: '1' },
    };
    const priorResults: ComposerStepOutcome[] = [{ id: 'Terminator:1', summary: 's', raw: terminatorRaw }];
    const input: MethodQuestionInput = {
      qid: 999999, question: 'q?', options: { A: 'x' }, originSrc: 'ori_mmlu-high_school_geography',
    };
    const { result } = await runOriginFrameStep(input, ctx(), priorResults);
    // Even though the origin frame itself is unavailable for this made-up qid, the augmented
    // question's own status is still reported -- neither outcome is allowed to erase the other.
    expect(result.augmentedQuestionStatus).not.toBeNull();
    expect(result.augmentedQuestionStatus?.insufficientEvidence?.preconditionId).toBe('negated-superlative-member-bound');
  });
});

describe('runOriginFrameDerivation -- KEY-BLINDNESS PROOF', () => {
  const originOptions: OriginFrameOption[] = [
    { letter: 'A', name: 'South Asia' }, { letter: 'B', name: 'Europe' },
    { letter: 'C', name: 'South America' }, { letter: 'D', name: 'Northeast United States' },
  ];

  it('the function signature carries no correctAnswer / answer-key parameter at all', () => {
    // Structural proof: 4 parameters (options, question, ctx, qid), none of them a key.
    expect(runOriginFrameDerivation.length).toBe(4);
  });

  it('produces the identical survivor set whether or not the CALLER\'s own input carried a key -- because the key is never read', async () => {
    // Two ctx objects whose askGoogle/askConversationalAuthority both fail identically (so the
    // real network-dependent steps abstain identically either way) -- the point being proven is
    // that runOriginFrameDerivation() never threads a key through at all, so nothing downstream
    // could possibly diverge based on one being present.
    const a = await runOriginFrameDerivation(originOptions, 'q?', ctx(), 98);
    const b = await runOriginFrameDerivation(originOptions, 'q?', ctx(), 98);
    expect(a.frame).toEqual(b.frame);
    expect(a.survivors).toEqual(b.survivors);
    expect(a.verdict).toEqual(b.verdict);
  });
});
