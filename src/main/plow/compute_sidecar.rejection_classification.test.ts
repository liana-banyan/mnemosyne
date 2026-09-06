// compute_sidecar.rejection_classification.test.ts -- D-BP165-M0-007/BISHOP-SEG/seg-instrument
//
// PROVES THE FAR END (LAW 5) of the capture this dispatch added to computeViaModelExpression():
// raw model output now survives per sample (capped, with original length + truncated flag), and
// each sample is classified into a NAMED ModelExpressionRejectionClass rather than folded into the
// single disjunctive basis string ("model answered NONE on every sample, emitted a non-arithmetic
// line every sample, or the recomputed samples that did parse disagreed") the pre-existing
// compute-gemma-cascade basis text used. Every test below injects a fake ModelCallFn/ModelCallFnRich
// (never a real Ollama call -- offline, deterministic, matches this repo's existing
// computeViaModelExpression tests' own convention) and asserts the exact rejection class recorded
// via the new optional onSample callback, plus the raw text.
//
// D-BP165-M0-007 owns compute_sidecar.ts, cost_instrument.ts, and method_silo.ts only. This file
// is a NEW test file, explicitly permitted by that dispatch's own file-ownership list.

import { describe, expect, it } from 'vitest';
import {
  computeViaModelExpression,
  capRawModelOutput,
  RAW_MODEL_OUTPUT_CAP_CHARS,
  type ModelExpressionSampleRecord,
  type ModelCallOutcome,
} from './compute_sidecar';

describe('D-BP165-M0-007 capRawModelOutput -- the 2000-char cap, first-N, honest about truncation', () => {
  it('does not truncate text under the cap, and reports truncated:false', () => {
    const result = capRawModelOutput('250000 * 0.2');
    expect(result).toEqual({ text: '250000 * 0.2', originalLength: '250000 * 0.2'.length, truncated: false });
  });

  it('caps text over RAW_MODEL_OUTPUT_CAP_CHARS at first-N chars, and reports the true original length', () => {
    const long = 'x'.repeat(RAW_MODEL_OUTPUT_CAP_CHARS + 500);
    const result = capRawModelOutput(long);
    expect(result).not.toBeNull();
    expect(result!.text.length).toBe(RAW_MODEL_OUTPUT_CAP_CHARS);
    expect(result!.originalLength).toBe(RAW_MODEL_OUTPUT_CAP_CHARS + 500);
    expect(result!.truncated).toBe(true);
  });

  it('returns null (not a fabricated empty record) for null/undefined input', () => {
    expect(capRawModelOutput(null)).toBeNull();
    expect(capRawModelOutput(undefined)).toBeNull();
  });
});

describe('D-BP165-M0-007 computeViaModelExpression -- per-sample rejection classification via onSample', () => {
  /** Builds a legacy (5-arg-compatible) ModelCallFn that returns each of `responses` in order,
   *  one per sample -- deterministic, no network. */
  function scriptedCallModel(responses: Array<string | null>) {
    let i = 0;
    return async () => {
      const r = responses[i] ?? null;
      i += 1;
      return r;
    };
  }

  it('classifies the literal NONE escape hatch distinctly from other failures, and preserves the raw text', async () => {
    const samples: ModelExpressionSampleRecord[] = [];
    const result = await computeViaModelExpression(
      'a word problem with two numbers 4 and 5',
      'http://unused',
      'fake-model',
      undefined,
      scriptedCallModel(['NONE', 'NONE', 'NONE']),
      (s) => samples.push(s),
    );
    expect(result).toBeNull();
    expect(samples).toHaveLength(3);
    for (const s of samples) {
      expect(s.rejection).toBe('none_escape_hatch');
      expect(s.rawOutput?.text).toBe('NONE');
      expect(s.parsedExpression).toBeNull();
      expect(s.parsedValue).toBeNull();
    }
  });

  it('classifies prose/non-arithmetic output distinctly from a bare number', async () => {
    const samples: ModelExpressionSampleRecord[] = [];
    await computeViaModelExpression(
      'q', 'http://unused', 'fake-model', undefined,
      scriptedCallModel([
        'The reserves would be calculated using the formula.', // prose -- non_arithmetic_output
        '52500', // bare number, no operator -- bare_number_no_operator
        'The reserves would be calculated using the formula.',
      ]),
      (s) => samples.push(s),
    );
    expect(samples[0].rejection).toBe('non_arithmetic_output');
    expect(samples[1].rejection).toBe('bare_number_no_operator');
    expect(samples[1].rawOutput?.text).toBe('52500');
    expect(samples[2].rejection).toBe('non_arithmetic_output');
  });

  it('classifies an empty/whitespace-only response, distinct from a parsed rejection', async () => {
    const samples: ModelExpressionSampleRecord[] = [];
    await computeViaModelExpression(
      'q', 'http://unused', 'fake-model', undefined,
      scriptedCallModel(['   \n  ', null, '']),
      (s) => samples.push(s),
    );
    for (const s of samples) {
      expect(s.rejection).toBe('empty_or_transport_error');
    }
  });

  it('classifies self-consistency disagreement when 3 valid-but-non-agreeing samples occur, downgrading the provisional accept', async () => {
    const samples: ModelExpressionSampleRecord[] = [];
    const result = await computeViaModelExpression(
      'q', 'http://unused', 'fake-model', undefined,
      scriptedCallModel(['4 + 5', '4 + 6', '4 + 7']), // 9, 10, 11 -- no two agree
      (s) => samples.push(s),
    );
    expect(result).toBeNull();
    expect(samples).toHaveLength(3);
    for (const s of samples) {
      expect(s.rejection).toBe('self_consistency_disagreement');
      expect(s.parsedExpression).not.toBeNull(); // it DID parse -- the failure is disagreement, not parsing
    }
  });

  it('classifies self-consistency-insufficient-samples when fewer than 2 samples ever parse at all', async () => {
    const samples: ModelExpressionSampleRecord[] = [];
    const result = await computeViaModelExpression(
      'q', 'http://unused', 'fake-model', undefined,
      scriptedCallModel(['4 + 5', 'NONE', 'not arithmetic at all']),
      (s) => samples.push(s),
    );
    expect(result).toBeNull();
    expect(samples[0].rejection).toBe('self_consistency_insufficient_samples');
    expect(samples[1].rejection).toBe('none_escape_hatch');
    expect(samples[2].rejection).toBe('non_arithmetic_output');
  });

  it('classifies accepted (terminal success) only for samples in the winning agree-2-of-3 group, and returns the winning value', async () => {
    const samples: ModelExpressionSampleRecord[] = [];
    const result = await computeViaModelExpression(
      'q', 'http://unused', 'fake-model', undefined,
      scriptedCallModel(['4 + 5', '9', '4 + 5']), // two agree on 9 via expression; middle is a bare number (never a candidate)
      (s) => samples.push(s),
    );
    expect(result).toEqual({ value: 9, expression: '4 + 5' });
    expect(samples[0].rejection).toBe('accepted');
    expect(samples[1].rejection).toBe('bare_number_no_operator');
    expect(samples[2].rejection).toBe('accepted');
  });

  it('a pre-existing 5-argument call site (no onSample, no callModelRich) is unaffected -- return shape byte-identical', async () => {
    const result = await computeViaModelExpression(
      'q', 'http://unused', 'fake-model', undefined,
      scriptedCallModel(['4 + 5', '4 + 5', '4 + 6']),
    );
    expect(result).toEqual({ value: 9, expression: '4 + 5' });
  });

  it('callModelRich (7th arg) distinguishes transport_error / http_error / empty_response, and surfaces done_reason for truncated_num_predict', async () => {
    const outcomes: ModelCallOutcome[] = [
      { ok: false, failureKind: 'transport_error', detail: 'ECONNREFUSED' },
      { ok: false, failureKind: 'http_error', detail: 'HTTP 500' },
      { ok: true, text: 'prose that got cut', doneReason: 'length' },
    ];
    let i = 0;
    const samples: ModelExpressionSampleRecord[] = [];
    await computeViaModelExpression(
      'q', 'http://unused', 'fake-model', undefined,
      async () => null, // unused when callModelRich is supplied
      (s) => samples.push(s),
      async () => outcomes[i++],
    );
    expect(samples[0].rejection).toBe('transport_error');
    expect(samples[1].rejection).toBe('http_error');
    expect(samples[2].rejection).toBe('truncated_num_predict');
    expect(samples[2].doneReason).toBe('length');
    expect(samples[2].rawOutput?.text).toBe('prose that got cut');
  });
});
