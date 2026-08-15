// ambient_capture.test.ts -- D-BP154-074/BISHOP-SEG/S74/seg-ambient
//
// Covers recordAmbientBrowserCapture() -- the recording leg's new caller into the existing,
// unmodified appendEvidence() store. Deterministic and offline: writes only into an OS temp
// directory (never the real HARDWIRE\LEDGER tree), same discipline as evidence_store.test.ts.

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  recordAmbientBrowserCapture,
  failsQueryTermOverlap,
  looksLikeEchoedPrompt,
  type AmbientCapturePayload,
} from './ambient_capture';
import { loadAcquisition } from './evidence_store';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'lb-ambient-capture-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const T = '2026-08-15T12:00:00.000Z';

function basePayload(overrides?: Partial<AmbientCapturePayload>): AmbientCapturePayload {
  return {
    query: 'What is the capital of Australia',
    answer: 'The capital of Australia is Canberra, not Sydney as many assume.',
    surface: 'gemini.google.com',
    url: 'https://gemini.google.com/app/abc123',
    capturedAt: T,
    ...overrides,
  };
}

describe('failsQueryTermOverlap -- the rejection rule', () => {
  test('accepts (does not fail) when the answer names a significant query term', () => {
    expect(failsQueryTermOverlap('What is the capital of Australia', 'Canberra is the capital city.')).toBe(false);
  });
  test('rejects when the answer names none of the query\'s significant terms', () => {
    expect(failsQueryTermOverlap('What is the capital of Australia', 'Please sign in to continue.')).toBe(true);
  });
  test('never rejects on a query with no significant (>=4 char) terms -- cannot check, so does not fail it', () => {
    expect(failsQueryTermOverlap('who is he', 'anything at all')).toBe(false);
  });
});

describe('looksLikeEchoedPrompt', () => {
  test('true when answer is whitespace-normalized identical to query', () => {
    expect(looksLikeEchoedPrompt('what is the capital of Australia', '  what is the capital of Australia  ')).toBe(true);
  });
  test('false for a genuinely different answer', () => {
    expect(looksLikeEchoedPrompt('what is the capital of Australia', 'Canberra.')).toBe(false);
  });
});

describe('recordAmbientBrowserCapture', () => {
  test('accepts a real capture and writes it to the append-only ledger, readable back off disk', () => {
    const result = recordAmbientBrowserCapture(basePayload(), basePayload(), 0, dir);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.record.authority).toBe('ambient_browser');
    expect(result.record.query).toBe('What is the capital of Australia');
    expect(result.record.qid).toBeNull();

    // Read it back OFF DISK, not from the in-memory return value -- the acceptance-test standard
    // this ticket itself is held to ("read back off disk to confirm").
    const { acquisition } = loadAcquisition(null, result.record.acquisitionId, dir);
    expect(acquisition).not.toBeNull();
    expect(acquisition!.records.length).toBe(1);
    const onDisk = acquisition!.records[0];
    expect(onDisk.query).toBe('What is the capital of Australia');
    const resp = onDisk.response as Record<string, unknown>;
    expect(resp.mechanism).toBe('AMBIENT_BROWSER_CAPTURE');
    expect(resp.answer).toBe('The capital of Australia is Canberra, not Sydney as many assume.');
    expect(resp.surface).toBe('gemini.google.com');
    expect(resp.url).toBe('https://gemini.google.com/app/abc123');

    // Byte-level confirmation straight from the file, bypassing loadAcquisition() too.
    const raw = readFileSync(join(dir, `EVIDENCE_free-text_${result.record.acquisitionId}.jsonl`), 'utf8');
    expect(raw).toContain('"mechanism":"AMBIENT_BROWSER_CAPTURE"');
    expect(raw).toContain('"authority":"ambient_browser"');
  });

  test('rejects an echoed prompt (page chrome / self-echo defect) and writes nothing', () => {
    const payload = basePayload({ answer: 'What is the capital of Australia' });
    const result = recordAmbientBrowserCapture(payload, payload, 0, dir);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected rejection');
    expect(result.reason).toMatch(/echoed prompt/);
  });

  test('rejects a passage naming none of the query\'s terms (chrome banner / unrelated capture)', () => {
    const payload = basePayload({ answer: 'Sign in to save your activity across Google services.' });
    const result = recordAmbientBrowserCapture(payload, payload, 0, dir);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected rejection');
    expect(result.reason).toMatch(/none of the query/);
  });

  test('rejects a payload whose own keys name a credential field, belt-and-suspenders', () => {
    const payload = basePayload();
    const raw = { ...payload, password: 'hunter2' };
    const result = recordAmbientBrowserCapture(payload, raw, 0, dir);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected rejection');
    expect(result.reason).toMatch(/credential/);
  });

  test('rejects an empty answer', () => {
    const payload = basePayload({ answer: '' });
    const result = recordAmbientBrowserCapture(payload, payload, 0, dir);
    expect(result.ok).toBe(false);
  });

  test('two captures for the same surface/time get distinct seq numbers and both land, append-only', () => {
    const payload = basePayload();
    const r1 = recordAmbientBrowserCapture(payload, payload, 0, dir);
    const r2 = recordAmbientBrowserCapture(
      basePayload({ answer: 'Canberra, the capital of Australia, was a compromise between Sydney and Melbourne.' }),
      payload,
      1,
      dir,
    );
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) throw new Error('expected both ok');
    // Same capturedAt -> same acquisitionId -> both records append to the SAME file, never
    // overwriting -- the Rule 66 / append-only claim, proven, not merely stated.
    const { acquisition } = loadAcquisition(null, r1.record.acquisitionId, dir);
    expect(acquisition!.records.length).toBe(2);
    expect(acquisition!.records[0].seq).toBe(0);
    expect(acquisition!.records[1].seq).toBe(1);
  });
});
