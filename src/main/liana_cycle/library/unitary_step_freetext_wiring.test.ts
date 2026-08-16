// unitary_step_freetext_wiring.test.ts -- D-BP155-035/BISHOP/seg-freetext-all-steps
//
// PROVES FD-BP155-01 OPTION B IS WIRED INTO A LIVE 'Unitary:1' RUN, NOT MERELY PRESENT. Same
// discipline as boundary_step_freetext_wiring.test.ts/softballs_step_freetext_wiring.test.ts --
// see boundary_step_freetext_wiring.test.ts's own header for the full ruling this one shortens.
// Unitary:1 shares boundary_step.ts's/softballs_step.ts's own single "gather owned candidates,
// credit the first that names an option" shape (no STAGE1-vs-STAGE2 mortgage-trap retry logic).
//
// (a)/(b)/(c)/(d): identical structure and discipline to the two prior wiring proofs -- a live call
//     with full provenance, the removal test (P12/Borromean's principle applied one level below
//     Composer-step granularity), the two null gates untouched and not re-pinned here, and
//     LB_EVIDENCE_DIR contamination discipline.

import {
  describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runUnitaryStep } from './unitary_step';
import type { MethodQuestionInput, MethodRunContext } from '../method_registry';
import type { BrowserAuthorityRawExtraction } from '../../../shared/plow/browser_authority_types';
import { recordAmbientBrowserCapture, type AmbientCapturePayload } from '../evidence/ambient_capture';

vi.mock('../methods/comparative_cascade', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../methods/comparative_cascade')>();
  return {
    ...actual,
    gemmaExtract: vi.fn(async (_instruction: string, passage: string) => {
      if (passage.includes('Turkestan')) {
        return {
          classifications: [
            { name: 'Central Asia', classification: 'conglomerate', span: passage },
            { name: 'South America', classification: 'unitary', span: passage },
          ],
        };
      }
      return {
        classifications: [
          { name: 'South America', classification: 'unitary', span: passage },
        ],
      };
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
  dir = mkdtempSync(join(tmpdir(), 'lb-unitary-freetext-wiring-'));
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

describe('D-BP155-035: a live Unitary:1 run CALLS the free-text reader and the candidate ARRIVES', () => {
  test('a relevant free-text capture in LB_EVIDENCE_DIR is credited as the step\'s own answered passage', async () => {
    const payload: AmbientCapturePayload = {
      query: 'is Central Asia a single unitary region or a conglomerate',
      answer: 'Central Asia is a conglomerate/grouping of the five former Soviet republics -- Kazakhstan, '
        + 'Kyrgyzstan, Tajikistan, Turkmenistan, and Uzbekistan (sometimes called Turkestan) -- rather than '
        + 'a single unitary region. South America is a single unitary region.',
      surface: 'gemini.google.com',
      url: 'https://gemini.google.com/app/unitary-freetext-wiring-proof',
      capturedAt: T,
    };
    const written = recordAmbientBrowserCapture(payload, payload, 0, dir);
    expect(written.ok).toBe(true);
    if (!written.ok) throw new Error('setup failed: the real capture path rejected this payload');
    expect(written.record.qid).toBeNull();

    const ctx: MethodRunContext = { askGoogle: instantHaltAskGoogle(), emit: vi.fn() };
    const { result } = await runUnitaryStep(INPUT, ctx);

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
  test('WITH free-text evidence: Central Asia is found excluded (source-stated conglomerate)', async () => {
    const payload: AmbientCapturePayload = {
      query: 'is Central Asia a single unitary region or a conglomerate',
      answer: 'Central Asia is a conglomerate/grouping of the five former Soviet republics, sometimes '
        + 'called Turkestan, rather than a single unitary region. South America is a single unitary region.',
      surface: 'gemini.google.com',
      url: 'https://gemini.google.com/app/unitary-removal-with',
      capturedAt: T,
    };
    recordAmbientBrowserCapture(payload, payload, 0, dir);

    const ctx: MethodRunContext = { askGoogle: instantHaltAskGoogle(), emit: vi.fn() };
    const { result } = await runUnitaryStep(INPUT, ctx);

    expect(result.ok).toBe(true);
    expect(result.excluded.map((e) => e.letter)).toEqual(['F']); // Central Asia
    expect(result.via).toContain('owned:free-text(');
  });

  test('WITHOUT free-text evidence (withheld, everything else held equal): Central Asia is no longer found -- the finding does NOT survive removal', async () => {
    const ctx: MethodRunContext = {
      askGoogle: instantHaltAskGoogle(),
      emit: vi.fn(),
      askConversationalAuthority: vi.fn(async () => ({
        ok: true,
        text: 'South America is a single unitary region, used consistently in world-regional practice.',
        citations: [],
        via: 'user_gemini:answered(mock)',
        authority: 'user_gemini',
      })),
    };

    const { result } = await runUnitaryStep(INPUT, ctx);

    expect(result.ok).toBe(true);
    expect(result.excluded).toEqual([]); // Central Asia's conglomerate finding is GONE
    expect(result.notExcluded).toContain('F'); // never eliminated, never fabricated -- simply unstated
    expect(result.via).not.toContain('owned:free-text(');
    expect(result.via).toContain('conversational');
  });
});
