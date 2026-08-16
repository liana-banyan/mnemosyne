// human_nuance_step_freetext_wiring.test.ts -- D-BP155-035/BISHOP/seg-freetext-all-steps
//
// PROVES FD-BP155-01 OPTION B IS WIRED INTO A LIVE 'HumanNuance:1' RUN, NOT MERELY PRESENT. Same
// discipline as boundary_step_freetext_wiring.test.ts/softballs_step_freetext_wiring.test.ts/
// unitary_step_freetext_wiring.test.ts -- see boundary_step_freetext_wiring.test.ts's own header
// for the full ruling this one shortens. HumanNuance:1's owned-evidence stage 1 is the SAME single
// "gather owned candidates, credit the first that ADDRESSES a non-participant option" shape (its
// own addressedCount() check replaces namesAnyOption(), but the STRUCTURE -- one array, first
// productive candidate wins -- is identical; no STAGE1-vs-STAGE2 mortgage-trap retry logic).
//
// origin_provenance_store.ts is mocked HERE (same pattern origin_frame_step.test.ts's own file-
// scoped `vi.mock('./origin_provenance_store', ...)` already establishes) so PART 1 (artifact
// class)/PART 4 (the origin-derived frame) can run without a real backfilled eblet on disk -- this
// is setup, not a relaxation of anything this step's own null gates or extraction discipline do.
//
// (a)/(b)/(c)/(d): identical structure and discipline to the three prior wiring proofs.

import {
  describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runHumanNuanceStep } from './human_nuance_step';
import type { MethodQuestionInput, MethodRunContext } from '../method_registry';
import type { BrowserAuthorityRawExtraction } from '../../../shared/plow/browser_authority_types';
import { recordAmbientBrowserCapture, type AmbientCapturePayload } from '../evidence/ambient_capture';

vi.mock('../methods/comparative_cascade', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../methods/comparative_cascade')>();
  return {
    ...actual,
    gemmaExtract: vi.fn(async (_instruction: string, passage: string) => {
      if (passage.includes('Sahara Desert') && passage.includes('desert biome')) {
        return {
          excluded: [
            {
              name: 'Sahara Desert',
              kind: 'desert',
              span: 'The Sahara Desert is a desert biome, not usually considered part of the world regions category.',
            },
          ],
        };
      }
      return { excluded: [] };
    }),
  };
});

// Same mocking idiom origin_frame_step.test.ts already establishes for this store.
vi.mock('./origin_provenance_store', () => ({
  loadOriginProvenance: vi.fn(() => ({
    qid: 98,
    stratum: 'test',
    origin: {
      options: ['South America', 'South Asia', 'North Africa', 'Northeast United States', 'Europe', 'Central Asia'],
      question: 'origin question text',
    },
    singleAnswerPropertySurvived: null,
    answerDerivableFromQuestionTermsAlone: null,
  })),
}));

const OPT: Record<string, string> = {
  A: 'South America', B: 'South Asia', C: 'North Africa', D: 'Northeast United States', E: 'Europe',
  F: 'Central Asia', G: 'Arctic Circle', H: 'Amazon Rainforest', I: 'Sahara Desert',
};
const INPUT: MethodQuestionInput = {
  qid: 98, // required so loadOriginProvenance() is even called (input.qid != null gate)
  question: "Which of the following world regions is NOT considered one of the world's most densely populated regions?",
  options: OPT,
  originSrc: 'test_source', // required for the cow guard to apply (PART 3)
};

const T = '2026-08-15T12:00:00.000Z';

let dir: string;
let savedEvidenceDir: string | undefined;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'lb-humannuance-freetext-wiring-'));
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

describe('D-BP155-035: a live HumanNuance:1 run CALLS the free-text reader and the candidate ARRIVES', () => {
  test('a relevant free-text capture in LB_EVIDENCE_DIR is credited as the step\'s own answered passage', async () => {
    const payload: AmbientCapturePayload = {
      query: 'what kind of thing is the Sahara Desert as it relates to world regions',
      answer: 'The Sahara Desert is a desert biome, not usually considered part of the world regions category.',
      surface: 'gemini.google.com',
      url: 'https://gemini.google.com/app/humannuance-freetext-wiring-proof',
      capturedAt: T,
    };
    const written = recordAmbientBrowserCapture(payload, payload, 0, dir);
    expect(written.ok).toBe(true);
    if (!written.ok) throw new Error('setup failed: the real capture path rejected this payload');
    expect(written.record.qid).toBeNull();

    const ctx: MethodRunContext = { askGoogle: instantHaltAskGoogle(), emit: vi.fn() };
    const { result } = await runHumanNuanceStep(INPUT, ctx);

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
  test('WITH free-text evidence: Sahara Desert is found EXCLUDED (declared feature: desert biome)', async () => {
    const payload: AmbientCapturePayload = {
      query: 'what kind of thing is the Sahara Desert as it relates to world regions',
      answer: 'The Sahara Desert is a desert biome, not usually considered part of the world regions category.',
      surface: 'gemini.google.com',
      url: 'https://gemini.google.com/app/humannuance-removal-with',
      capturedAt: T,
    };
    recordAmbientBrowserCapture(payload, payload, 0, dir);

    const ctx: MethodRunContext = { askGoogle: instantHaltAskGoogle(), emit: vi.fn() };
    const { result } = await runHumanNuanceStep(INPUT, ctx);

    expect(result.ok).toBe(true);
    expect(result.excluded.map((e) => e.letter)).toEqual(['I']); // Sahara Desert
    expect(result.via).toContain('owned:free-text(');
  });

  test('WITHOUT free-text evidence (withheld, everything else held equal): Sahara Desert is no longer excluded -- the finding does NOT survive removal', async () => {
    const ctx: MethodRunContext = {
      askGoogle: instantHaltAskGoogle(),
      emit: vi.fn(),
      askConversationalAuthority: vi.fn(async () => ({
        ok: true,
        text: 'Amazon Rainforest is a large tropical rainforest region in South America.',
        citations: [],
        via: 'user_gemini:answered(mock)',
        authority: 'user_gemini',
      })),
    };

    const { result } = await runHumanNuanceStep(INPUT, ctx);

    expect(result.ok).toBe(true);
    expect(result.excluded).toEqual([]); // Sahara Desert's exclusion finding is GONE
    expect(result.unresolved).toContain('I'); // never eliminated, never fabricated -- simply unresolved
    expect(result.via).not.toContain('owned:free-text(');
    expect(result.via).toContain('conversational');
  });
});
