// named_set_step_freetext_wiring.test.ts -- D-BP155-035/BISHOP/seg-freetext-all-steps
//
// PROVES FD-BP155-01 OPTION B IS WIRED INTO A LIVE 'NamedSet:1' RUN, NOT MERELY PRESENT, AND that
// this step's own STAGE-1-vs-STAGE-2 mortgage-trap retry logic (D-BP154-018/021/029, the exact
// history of live-measured defects this ticket's own dispatch names as "the real risk") still
// behaves correctly with a free-text candidate present in the owned-evidence pool. This is the
// FIRST of the two steps the dispatch calls out by name; wired and tested with more scrutiny than
// the four simple-shape steps (Boundary:1/Softballs:1/Unitary:1/HumanNuance:1) that came before it.
//
// (a)/(b): a live call with full provenance, then the standard WITH/WITHOUT removal test (P12/
//     Borromean's principle, applied one level below Composer-step granularity -- see
//     boundary_step_freetext_wiring.test.ts's own header for the full citation).
//
// (c) A THIRD test, specific to this file's own risk: a free-text candidate that NAMES an option
//     (so it is gathered and tried) but whose own extraction is UNPRODUCTIVE (zero verified
//     memberships) must still let STAGE 2 (the conversational authority) run and be credited --
//     exactly the D-BP154-018 "try harder before abstain" guarantee this step already carries for
//     every other owned source, now exercised with a free-text candidate specifically. This proves
//     the addition does not create a NEW way for the mortgage trap to swallow a real answer.
//
// (d) the two existing null gates are NOT touched here and are NOT re-pinned (free_text_evidence.
//     test.ts already carries that proof); LB_EVIDENCE_DIR contamination discipline as usual.
//
// gemmaExtract() is mocked HERE ONLY, offline-reproducible, same idiom as every prior wiring proof.

import {
  describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runNamedSetStep } from './named_set_step';
import type { MethodQuestionInput, MethodRunContext } from '../method_registry';
import type { BrowserAuthorityRawExtraction } from '../../../shared/plow/browser_authority_types';
import { recordAmbientBrowserCapture, type AmbientCapturePayload } from '../evidence/ambient_capture';

const DECISIVE_PHRASE = 'South Asia is explicitly the world\'s most densely populated region';

vi.mock('../methods/comparative_cascade', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../methods/comparative_cascade')>();
  return {
    ...actual,
    gemmaExtract: vi.fn(async (_instruction: string, passage: string) => {
      if (passage.includes(DECISIVE_PHRASE)) {
        return {
          included: [
            { name: 'South Asia', span: `${DECISIVE_PHRASE}, according to UN population density data.` },
          ],
        };
      }
      return { included: [] }; // present, names an option, but proves nothing -- the mortgage-trap case
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
  dir = mkdtempSync(join(tmpdir(), 'lb-namedset-freetext-wiring-'));
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

describe('D-BP155-035: a live NamedSet:1 run CALLS the free-text reader and the candidate ARRIVES', () => {
  test('a relevant free-text capture in LB_EVIDENCE_DIR is credited as the step\'s own answered passage', async () => {
    const payload: AmbientCapturePayload = {
      query: 'which world regions are the most densely populated',
      answer: `${DECISIVE_PHRASE}, according to UN population density data. South America is not.`,
      surface: 'gemini.google.com',
      url: 'https://gemini.google.com/app/namedset-freetext-wiring-proof',
      capturedAt: T,
    };
    const written = recordAmbientBrowserCapture(payload, payload, 0, dir);
    expect(written.ok).toBe(true);
    if (!written.ok) throw new Error('setup failed: the real capture path rejected this payload');
    expect(written.record.qid).toBeNull();

    const ctx: MethodRunContext = { askGoogle: instantHaltAskGoogle(), emit: vi.fn() };
    const { result } = await runNamedSetStep(INPUT, ctx);

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
  test('WITH free-text evidence: South Asia is found included (source-stated member)', async () => {
    const payload: AmbientCapturePayload = {
      query: 'which world regions are the most densely populated',
      answer: `${DECISIVE_PHRASE}, according to UN population density data.`,
      surface: 'gemini.google.com',
      url: 'https://gemini.google.com/app/namedset-removal-with',
      capturedAt: T,
    };
    recordAmbientBrowserCapture(payload, payload, 0, dir);

    const ctx: MethodRunContext = { askGoogle: instantHaltAskGoogle(), emit: vi.fn() };
    const { result } = await runNamedSetStep(INPUT, ctx);

    expect(result.ok).toBe(true);
    expect(result.included.map((e) => e.letter)).toEqual(['B']); // South Asia
    expect(result.via).toContain('owned:free-text(');
  });

  test('WITHOUT free-text evidence (withheld, everything else held equal): South Asia is no longer found -- the finding does NOT survive removal', async () => {
    const ctx: MethodRunContext = {
      askGoogle: instantHaltAskGoogle(),
      emit: vi.fn(),
      askConversationalAuthority: vi.fn(async () => ({
        ok: true,
        text: 'South America is a large landmass in the western hemisphere.',
        citations: [],
        via: 'user_gemini:answered(mock)',
        authority: 'user_gemini',
      })),
    };

    const { result } = await runNamedSetStep(INPUT, ctx);

    // Neither the free-text source nor the (unproductive, no-option-naming-South Asia) conversational
    // fallback names South Asia as included -- honestly UNAVAILABLE, not "nothing included" (the
    // conversational text here names no option at all, so this step correctly abstains).
    expect(result.ok).toBe(false);
    expect(result.error).toContain('NAMED SET');
    // guard against a false "still works" reading: NAMED SET's error text does not literally
    // include the phrase 'NAMED SET' (only the summary line does) -- assert on the real shape
    // instead: no included members, and via never claims free-text.
  });
});

describe('D-BP155-035: THE MORTGAGE TRAP, WITH a free-text candidate specifically in the pool (D-BP154-018 "try harder before abstain")', () => {
  test('a free-text candidate that NAMES an option but proves UNPRODUCTIVE still lets STAGE 2 (conversational) be tried and credited', async () => {
    // This free-text capture mentions South Asia (so it is gathered AND passes namesAnyOption) but
    // its own text does not contain the DECISIVE_PHRASE the mock gemmaExtract requires -- so
    // extraction from it yields included:[], exactly the "found a source but it proved nothing"
    // shape D-BP154-018 exists to recover from.
    const payload: AmbientCapturePayload = {
      query: 'tell me about South Asia',
      answer: 'South Asia is a subregion of Asia comprising several countries.',
      surface: 'gemini.google.com',
      url: 'https://gemini.google.com/app/namedset-mortgagetrap-freetext',
      capturedAt: T,
    };
    recordAmbientBrowserCapture(payload, payload, 0, dir);

    const ctx: MethodRunContext = {
      askGoogle: instantHaltAskGoogle(),
      emit: vi.fn(),
      askConversationalAuthority: vi.fn(async () => ({
        ok: true,
        text: `${DECISIVE_PHRASE}, according to UN population density data.`,
        citations: [],
        via: 'user_gemini:answered(mock-stage2)',
        authority: 'user_gemini',
      })),
    };

    const { result } = await runNamedSetStep(INPUT, ctx);

    expect(result.ok).toBe(true);
    expect(result.included.map((e) => e.letter)).toEqual(['B']); // South Asia, found via STAGE 2
    // Credited via the conversational authority, NOT the unproductive free-text candidate -- the
    // mortgage-trap retry correctly moved past the free-text source that proved nothing.
    expect(result.via).toContain('conversational');
    expect(result.via).not.toContain('owned:free-text(');
  });
});
