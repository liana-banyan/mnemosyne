// softballs_step_freetext_wiring.test.ts -- D-BP155-035/BISHOP/seg-freetext-all-steps
//
// PROVES FD-BP155-01 OPTION B IS WIRED INTO A LIVE 'Softballs:1' RUN, NOT MERELY PRESENT. Same
// discipline as boundary_step_freetext_wiring.test.ts (D-BP155-010, the FIRST step this was wired
// into) -- see that file's own header for the full ruling this one shortens. Softballs:1 shares
// boundary_step.ts's own single "gather owned candidates, credit the first that names an option"
// shape (no STAGE1-vs-STAGE2 mortgage-trap retry logic, unlike named_set_step.ts/
// discriminator_step.ts), so this is the SECOND step wired, immediately after Boundary:1.
//
// (a) "a live step run CALLS the reader": a REAL free-text capture, written through the REAL
//     recordAmbientBrowserCapture()/appendEvidence() path into a temp LB_EVIDENCE_DIR, is read back
//     by the REAL runSoftballsStep() and becomes the step's own credited answer.
//
// (b) THE REMOVAL TEST -- P12/Borromean's own principle, applied one level below Composer-step
//     granularity (see boundary_step_freetext_wiring.test.ts's own header for the full citation):
//     runSoftballsStep() run twice with everything else held constant, once with the free-text
//     capture present, once withheld.
//
// (c) the two existing null gates (liana_terminal_engine.ts:899, composer_step_evidence.ts:157) are
//     NOT touched by this ticket and are NOT re-pinned here -- free_text_evidence.test.ts already
//     carries that proof.
//
// (d) CONTAMINATION DISCIPLINE: every write goes through LB_EVIDENCE_DIR pointed at an mkdtempSync
//     temp dir, removed in afterEach.
//
// gemmaExtract() (comparative_cascade.ts) is mocked HERE ONLY (vi.mock is file-scoped), same
// reproducible-offline discipline as boundary_step_freetext_wiring.test.ts; every other export of
// that module is the REAL implementation, via vi.importActual.

import {
  describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runSoftballsStep } from './softballs_step';
import type { MethodQuestionInput, MethodRunContext } from '../method_registry';
import type { BrowserAuthorityRawExtraction } from '../../../shared/plow/browser_authority_types';
import { recordAmbientBrowserCapture, type AmbientCapturePayload } from '../evidence/ambient_capture';

vi.mock('../methods/comparative_cascade', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../methods/comparative_cascade')>();
  return {
    ...actual,
    gemmaExtract: vi.fn(async (_instruction: string, passage: string) => {
      if (passage.includes('Sahara Desert')) {
        return {
          excluded: [
            {
              name: 'Sahara Desert',
              span: 'The Sahara Desert is not considered one of the world regions at all -- it is a desert biome, not a demographic region.',
            },
          ],
        };
      }
      return { excluded: [] };
    }),
  };
});

const OPT: Record<string, string> = {
  A: 'South America', B: 'South Asia', C: 'North Africa', D: 'Northeast United States', E: 'Europe',
  F: 'Central Asia', G: 'Arctic Circle', H: 'Amazon Rainforest', I: 'Sahara Desert',
};
const INPUT: MethodQuestionInput = {
  question: "Which of the following world regions is NOT considered one of the world's most densely populated regions?",
  options: OPT,
};

const T = '2026-08-15T12:00:00.000Z';

let dir: string;
let savedEvidenceDir: string | undefined;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'lb-softballs-freetext-wiring-'));
  savedEvidenceDir = process.env.LB_EVIDENCE_DIR;
  process.env.LB_EVIDENCE_DIR = dir;
});

afterEach(() => {
  if (savedEvidenceDir === undefined) delete process.env.LB_EVIDENCE_DIR;
  else process.env.LB_EVIDENCE_DIR = savedEvidenceDir;
  rmSync(dir, { recursive: true, force: true });
  vi.clearAllMocks();
});

function instantHaltAskGoogle() {
  return vi.fn(async () => ({
    snippet: '', sourceUrl: null, selectorUsed: null, challengeDetected: true,
  } as unknown as BrowserAuthorityRawExtraction));
}

describe('D-BP155-035: a live Softballs:1 run CALLS the free-text reader and the candidate ARRIVES', () => {
  test('a relevant free-text capture in LB_EVIDENCE_DIR is credited as the step\'s own answered passage', async () => {
    const payload: AmbientCapturePayload = {
      query: 'is the Sahara Desert one of the world regions',
      answer: 'The Sahara Desert is not considered one of the world regions at all -- it is a desert '
        + 'biome, not a demographic region. South America is one of the world regions.',
      surface: 'gemini.google.com',
      url: 'https://gemini.google.com/app/softballs-freetext-wiring-proof',
      capturedAt: T,
    };
    const written = recordAmbientBrowserCapture(payload, payload, 0, dir);
    expect(written.ok).toBe(true);
    if (!written.ok) throw new Error('setup failed: the real capture path rejected this payload');
    expect(written.record.qid).toBeNull();

    const ctx: MethodRunContext = { askGoogle: instantHaltAskGoogle(), emit: vi.fn() };
    const { result } = await runSoftballsStep(INPUT, ctx);

    expect(result.ok).toBe(true);
    expect(result.via).toContain('owned:free-text(');
    expect(result.via).toContain('gemini.google.com');
    expect(result.answerProvenance?.mechanism).toBe('OWNED_EVIDENCE');
    expect(result.answerProvenance?.sourceId).toMatch(/^free-text:/);
    expect(result.answerProvenance?.detail).toContain('ambient_browser');
    expect(result.answerProvenance?.detail).toContain('significant term');
  });
});

describe('D-BP155-035: THE REMOVAL TEST (Borromean P12 principle, applied one level below Composer-step granularity)', () => {
  test('WITH free-text evidence: Sahara Desert is found excluded (source-stated, not a world region)', async () => {
    const payload: AmbientCapturePayload = {
      query: 'is the Sahara Desert one of the world regions',
      answer: 'The Sahara Desert is not considered one of the world regions at all -- it is a desert '
        + 'biome, not a demographic region.',
      surface: 'gemini.google.com',
      url: 'https://gemini.google.com/app/softballs-removal-with',
      capturedAt: T,
    };
    recordAmbientBrowserCapture(payload, payload, 0, dir);

    const ctx: MethodRunContext = { askGoogle: instantHaltAskGoogle(), emit: vi.fn() };
    const { result } = await runSoftballsStep(INPUT, ctx);

    expect(result.ok).toBe(true);
    expect(result.excluded.map((e) => e.letter)).toEqual(['I']); // Sahara Desert
    expect(result.via).toContain('owned:free-text(');
  });

  test('WITHOUT free-text evidence (withheld, everything else held equal): Sahara Desert is no longer found -- the finding does NOT survive removal', async () => {
    const ctx: MethodRunContext = {
      askGoogle: instantHaltAskGoogle(),
      emit: vi.fn(),
      askConversationalAuthority: vi.fn(async () => ({
        ok: true,
        text: 'South America is one of the world regions, used consistently in world-regional practice.',
        citations: [],
        via: 'user_gemini:answered(mock)',
        authority: 'user_gemini',
      })),
    };

    const { result } = await runSoftballsStep(INPUT, ctx);

    expect(result.ok).toBe(true);
    expect(result.excluded).toEqual([]); // Sahara Desert's exclusion finding is GONE
    expect(result.notExcluded).toContain('I'); // never eliminated, never fabricated -- simply not stated
    expect(result.via).not.toContain('owned:free-text(');
    expect(result.via).toContain('conversational');
  });
});
