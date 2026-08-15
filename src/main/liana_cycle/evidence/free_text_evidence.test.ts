// free_text_evidence.test.ts -- D-BP155-007/BISHOP/seg-freetext-reader
//
// Deterministic and offline: every write in this file goes through LB_EVIDENCE_DIR pointed at an
// OS temp directory (mkdtempSync), never the real HARDWIRE\LEDGER tree -- same discipline
// evidence_store.test.ts / ambient_capture.test.ts already hold to, earned the hard way (BP148:
// 49 of 123 test files once wrote synthetic records into live stores with no cleanup).
//
// Covers, per this dispatch's own acceptance list:
//   (a) NEGATIVE case -- a genuinely irrelevant free-text capture is rejected, reason recorded.
//   (b) a RELEVANT free-text passage becomes usable, full provenance chain carried to the consumer
//       (toStepCandidates()' StepPassageCandidate output).
//   (c) the two existing null gates (liana_terminal_engine.ts:899, composer_step_evidence.ts:150)
//       are still intact and unmodified -- both a source-text pin and a live behavioral call.
//   (d) an end-to-end proof against the REAL appendEvidence()/evidence_store.ts path, written into
//       a TEMP dir via LB_EVIDENCE_DIR, read back through this file's own reader.

import {
  describe, test, expect, beforeEach, afterEach,
} from 'vitest';
import {
  mkdtempSync, rmSync, readFileSync, appendFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  judgeFreeTextRecord,
  readFreeTextEvidence,
  toStepCandidates,
  type FreeTextPassage,
} from './free_text_evidence';
import { appendEvidence, type EvidenceRecord } from './evidence_store';
import { recordAmbientBrowserCapture, type AmbientCapturePayload } from './ambient_capture';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'lb-freetext-evidence-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const T = '2026-08-15T12:00:00.000Z';

function freeTextRecord(overrides?: Partial<{
  query: string; answer: string; surface: string; url: string; capturedAt: string; seq: number;
}>): EvidenceRecord {
  const o = {
    query: 'What is the capital of Australia',
    answer: 'The capital of Australia is Canberra, not Sydney as many assume.',
    surface: 'gemini.google.com',
    url: 'https://gemini.google.com/app/abc123',
    capturedAt: T,
    seq: 0,
    ...overrides,
  };
  return {
    schema: 'liana-evidence/1',
    address: 'addr',
    queryKey: 'key',
    authority: 'ambient_browser',
    query: o.query,
    response: {
      mechanism: 'AMBIENT_BROWSER_CAPTURE', answer: o.answer, surface: o.surface, url: o.url, capturedAt: o.capturedAt,
    },
    ts: o.capturedAt,
    acquisitionId: 'ambient_test_acq',
    qid: null,
    seq: o.seq,
  };
}

// ───────────────────────── (a) judgeFreeTextRecord: the negative case, and its siblings ─────────────────────────

describe('judgeFreeTextRecord -- every outcome is NAMED, never a bare null', () => {
  test('RELEVANT: a passage whose answer names the derivation question\'s own significant terms', () => {
    const record = freeTextRecord();
    const j = judgeFreeTextRecord('What is the capital city of Australia?', record, 'acq1');
    expect(j.outcome).toBe('relevant');
    if (j.outcome !== 'relevant') throw new Error('expected relevant');
    expect(j.passage.text).toBe('The capital of Australia is Canberra, not Sydney as many assume.');
    expect(j.passage.relevanceReason).toMatch(/significant term/);
    expect(j.passage.relevanceReason).toMatch(/capital|australia/);
    expect(j.passage.provenance).toEqual({
      authority: 'ambient_browser',
      surface: 'gemini.google.com',
      url: 'https://gemini.google.com/app/abc123',
      capturedAt: T,
      acquisitionId: 'acq1',
      capturedQuery: 'What is the capital of Australia',
      seq: 0,
    });
  });

  test('REJECTED (negative case): a genuinely irrelevant capture -- reason recorded and inspectable', () => {
    const record = freeTextRecord({
      query: 'best pizza toppings',
      answer: 'Pepperoni and mushroom are the most popular pizza toppings in most surveys.',
    });
    const j = judgeFreeTextRecord('What is the boiling point of water at sea level?', record, 'acq1');
    expect(j.outcome).toBe('rejected');
    if (j.outcome !== 'rejected') throw new Error('expected rejected');
    expect(j.reason).toMatch(/names none of the question's own significant terms/);
    expect(j.reason).toMatch(/boiling|water|level/);
    expect(j.acquisitionId).toBe('acq1');
    expect(j.seq).toBe(0);
  });

  test('UNJUDGEABLE, distinct from REJECTED: a record that still carries a real qid is not free-text at all', () => {
    const record = { ...freeTextRecord(), qid: 98 };
    const j = judgeFreeTextRecord('What is the capital of Australia?', record, 'acq1');
    expect(j.outcome).toBe('unjudgeable');
    if (j.outcome !== 'unjudgeable') throw new Error('expected unjudgeable');
    expect(j.reason).toMatch(/qid 98, not free-text/);
  });

  test('UNJUDGEABLE: response missing required provenance fields -- anonymous text must not be usable', () => {
    const record: EvidenceRecord = {
      ...freeTextRecord(),
      response: { mechanism: 'AMBIENT_BROWSER_CAPTURE', answer: 'Canberra is the capital.' }, // no surface/url/capturedAt
    };
    const j = judgeFreeTextRecord('What is the capital of Australia?', record, 'acq1');
    expect(j.outcome).toBe('unjudgeable');
    if (j.outcome !== 'unjudgeable') throw new Error('expected unjudgeable');
    expect(j.reason).toMatch(/missing required provenance field\(s\): surface, url, capturedAt/);
  });

  test('UNJUDGEABLE: a recorded-null response (authority asked, got nothing) has no text to judge', () => {
    const record: EvidenceRecord = { ...freeTextRecord(), response: null };
    const j = judgeFreeTextRecord('What is the capital of Australia?', record, 'acq1');
    expect(j.outcome).toBe('unjudgeable');
    if (j.outcome !== 'unjudgeable') throw new Error('expected unjudgeable');
    expect(j.reason).toMatch(/response is empty/);
  });

  test('UNJUDGEABLE, not a silent pass: a question with no significant (4+ char) terms cannot be positively checked', () => {
    const record = freeTextRecord({ answer: 'anything at all, page chrome, whatever' });
    const j = judgeFreeTextRecord('who is he', record, 'acq1'); // "who"=3, "is"=2, "he"=2 -- all < 4 chars
    expect(j.outcome).toBe('unjudgeable');
    if (j.outcome !== 'unjudgeable') throw new Error('expected unjudgeable');
    expect(j.reason).toMatch(/no significant .* terms to test relevance against/);
    expect(j.reason).toMatch(/positive test/);
  });
});

// ───────────────────────── (b) readFreeTextEvidence + toStepCandidates: full provenance to the consumer ─────────────────────────

describe('readFreeTextEvidence -- scans every free-text acquisition, judges each record', () => {
  test('separates relevant / rejected / unjudgeable across multiple acquisitions, counts scanned + malformed', () => {
    // Acquisition 1: one relevant, one rejected record.
    appendEvidence({
      authority: 'ambient_browser',
      query: 'What is the capital of Australia',
      response: {
        mechanism: 'AMBIENT_BROWSER_CAPTURE',
        answer: 'The capital of Australia is Canberra.',
        surface: 'gemini.google.com',
        url: 'https://gemini.google.com/app/1',
        capturedAt: T,
      },
      acquisitionId: 'ambient_gemini_a',
      qid: null,
      seq: 0,
      ts: T,
      dir,
    });
    appendEvidence({
      authority: 'ambient_browser',
      query: 'best pizza toppings',
      response: {
        mechanism: 'AMBIENT_BROWSER_CAPTURE',
        answer: 'Pepperoni is the most popular pizza topping.',
        surface: 'gemini.google.com',
        url: 'https://gemini.google.com/app/2',
        capturedAt: T,
      },
      acquisitionId: 'ambient_gemini_a',
      qid: null,
      seq: 1,
      ts: T,
      dir,
    });
    // Acquisition 2: one relevant record, a different surface.
    appendEvidence({
      authority: 'ambient_browser',
      query: 'capital city of Australia',
      response: {
        mechanism: 'AMBIENT_BROWSER_CAPTURE',
        answer: 'Canberra, the capital of Australia, was chosen as a compromise between Sydney and Melbourne.',
        surface: 'perplexity.ai',
        url: 'https://perplexity.ai/search/xyz',
        capturedAt: '2026-08-15T13:00:00.000Z',
      },
      acquisitionId: 'ambient_perplexity_b',
      qid: null,
      seq: 0,
      ts: '2026-08-15T13:00:00.000Z',
      dir,
    });
    // A qid-bearing record in a DIFFERENT file (never scanned by this reader).
    appendEvidence({
      authority: 'google', query: 'unrelated', response: { snippet: 'x' }, acquisitionId: 'qidacq', qid: 98, seq: 0, ts: T, dir,
    });

    const result = readFreeTextEvidence('What is the capital of Australia?', { dir });
    expect(result.acquisitionsScanned).toBe(2); // only the two free-text acquisitions
    expect(result.malformedLines).toBe(0);
    expect(result.relevant).toHaveLength(2);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reason).toMatch(/names none of the question's own significant terms/);

    const surfaces = result.relevant.map((p) => p.provenance.surface).sort();
    expect(surfaces).toEqual(['gemini.google.com', 'perplexity.ai']);
  });

  test('a malformed line is counted, never silently dropped', () => {
    appendEvidence({
      authority: 'ambient_browser',
      query: 'capital of Australia',
      response: {
        mechanism: 'AMBIENT_BROWSER_CAPTURE', answer: 'The capital of Australia is Canberra.', surface: 'gemini.google.com', url: 'https://x', capturedAt: T,
      },
      acquisitionId: 'ambient_gemini_c',
      qid: null,
      seq: 0,
      ts: T,
      dir,
    });
    const filePath = join(dir, 'EVIDENCE_free-text_ambient_gemini_c.jsonl');
    appendFileSync(filePath, 'not valid json at all\n', 'utf8');

    const result = readFreeTextEvidence('capital of Australia', { dir });
    expect(result.malformedLines).toBeGreaterThanOrEqual(1);
    expect(result.relevant.length).toBeGreaterThanOrEqual(1);
  });
});

describe('toStepCandidates -- full provenance chain carried through to the consumer', () => {
  test('a relevant passage becomes a StepPassageCandidate carrying authority/surface/url/capturedAt/reason', () => {
    const passages: FreeTextPassage[] = [{
      text: 'The capital of Australia is Canberra.',
      relevanceReason: 'answer text contains 2 of the question\'s own significant term(s): capital, australia',
      provenance: {
        authority: 'ambient_browser',
        surface: 'gemini.google.com',
        url: 'https://gemini.google.com/app/abc123',
        capturedAt: T,
        acquisitionId: 'ambient_gemini_a',
        capturedQuery: 'What is the capital of Australia',
        seq: 0,
      },
    }];
    const [candidate] = toStepCandidates(passages);
    expect(candidate.text).toBe('The capital of Australia is Canberra.');
    expect(candidate.provenance.mechanism).toBe('OWNED_EVIDENCE');
    expect(candidate.provenance.sourceId).toBe('free-text:ambient_gemini_a:0');
    // Every field the ruling's non-negotiable 3 requires, inspectable in the consumer-facing shape:
    expect(candidate.provenance.detail).toContain('ambient_browser');
    expect(candidate.provenance.detail).toContain('gemini.google.com');
    expect(candidate.provenance.detail).toContain('https://gemini.google.com/app/abc123');
    expect(candidate.provenance.detail).toContain(T);
    expect(candidate.provenance.detail).toContain('significant term');
    expect(candidate.via).toContain('gemini.google.com');
    expect(candidate.via).toContain('significant term');
  });
});

// ───────────────────────── (c) the two existing null gates are still intact and unmodified ─────────────────────────

describe('the two existing null gates are UNTOUCHED by this ticket', () => {
  test('liana_terminal_engine.ts:899 still excludes qid:null from the mortgage path, source unmodified', () => {
    const src = readFileSync(
      resolve(__dirname, '..', 'liana_terminal_engine.ts'),
      'utf8',
    );
    expect(src).toContain('const priorAcquisitionPassages = parsed.qid != null');
    expect(src).toContain('SCOPED TO A BUNDLED QID ONLY');
  });

  test('composer_step_evidence.ts:150 still returns [] for qid:null, source unmodified', () => {
    const src = readFileSync(
      resolve(__dirname, '..', 'library', 'composer_step_evidence.ts'),
      'utf8',
    );
    expect(src).toContain('if (qid == null) return [];');
  });

  test('behavioral: gatherMortgageCandidates(null, ...) still resolves to [] -- the gate fires, live', async () => {
    const { gatherMortgageCandidates } = await import('../library/composer_step_evidence');
    const out = await gatherMortgageCandidates(undefined, 'What is the capital of Australia?');
    expect(out).toEqual([]);
  });
});

// ───────────────────────── (d) end-to-end against the REAL appendEvidence()/recordAmbientBrowserCapture() path ─────────────────────────

describe('end-to-end: a real ambient capture, written through the real recordAmbientBrowserCapture() path into a TEMP dir, read back through this reader with full provenance', () => {
  test('write -> read -> usable, with provenance intact, all against a TEMP dir (never the real ledger)', () => {
    const payload: AmbientCapturePayload = {
      query: 'What is the capital of Australia',
      answer: 'The capital of Australia is Canberra, chosen as a compromise between Sydney and Melbourne.',
      surface: 'gemini.google.com',
      url: 'https://gemini.google.com/app/real-e2e',
      capturedAt: T,
    };
    // THE REAL WRITE PATH, unmodified: recordAmbientBrowserCapture() -> appendEvidence() -> disk.
    const written = recordAmbientBrowserCapture(payload, payload, 0, dir);
    expect(written.ok).toBe(true);
    if (!written.ok) throw new Error('expected the real capture path to accept this payload');
    expect(written.record.qid).toBeNull(); // honest qid:null, never invented -- non-negotiable 1

    // THE READER, reading the SAME temp dir back.
    const result = readFreeTextEvidence('What is the capital of Australia, and why was it chosen?', { dir });
    expect(result.relevant.length).toBe(1);
    const [passage] = result.relevant;
    expect(passage.text).toBe(payload.answer);
    expect(passage.provenance.authority).toBe('ambient_browser');
    expect(passage.provenance.surface).toBe('gemini.google.com');
    expect(passage.provenance.url).toBe('https://gemini.google.com/app/real-e2e');
    expect(passage.provenance.capturedAt).toBe(T);

    // THE CONSUMER SHAPE, provenance chain intact end to end.
    const [candidate] = toStepCandidates(result.relevant);
    expect(candidate.provenance.mechanism).toBe('OWNED_EVIDENCE');
    expect(candidate.provenance.detail).toContain('gemini.google.com');
    expect(candidate.provenance.detail).toContain('real-e2e');
  });
});
