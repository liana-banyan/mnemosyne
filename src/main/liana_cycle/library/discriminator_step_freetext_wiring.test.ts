// discriminator_step_freetext_wiring.test.ts -- D-BP155-035/BISHOP/seg-freetext-all-steps
//
// PROVES FD-BP155-01 OPTION B IS WIRED INTO A LIVE 'Discriminator:1' RUN, NOT MERELY PRESENT, AND
// that this step's own PER-ASK STAGE-1-vs-STAGE-2 retry logic (fetchAndExtract(), five independent
// asks, "try harder before abstain") still behaves correctly with a free-text candidate present in
// EACH ask's own owned-evidence pool. This is the SECOND step the dispatch names explicitly as
// carrying real risk ("its own history of live-measured defects, D-BP154-018/021/029") -- wired
// last, with the most scrutiny, per the dispatch's own "wire one at a time, run a removal test
// after each" instruction.
//
// gatherFreeTextCandidates() is wired into fetchAndExtract()'s own `owned` array, PARAMETERIZED BY
// askQuery -- each of the five independent asks (KIND/ENUMERATION/PROPERTY/SUBREGION/REGISTER)
// only ever sees free-text evidence judged relevant to THAT ask's own query text. This file's own
// scope: THE KIND ASK (ASK 1/5) -- the ask fetchAndExtract() is FIRST called for, and the one
// `primary` credits when it is productive. Proving the wiring and the retry-safety on this one ask
// is representative of the identical, parameterized call site every one of the other four asks
// shares (the mechanism is IDENTICAL across all five -- only askQuery/instruction/shape differ,
// none of which this ticket touches).
//
// (a)/(b)/(c)/(d): identical structure and discipline to every prior wiring proof in this dispatch.

import {
  describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runDiscriminatorStep } from './discriminator_step';
import type { MethodQuestionInput, MethodRunContext } from '../method_registry';
import type { BrowserAuthorityRawExtraction } from '../../../shared/plow/browser_authority_types';
import { recordAmbientBrowserCapture, type AmbientCapturePayload } from '../evidence/ambient_capture';

const DECISIVE_PHRASE = 'South Asia is a demographic region defined by very high population density';

vi.mock('../methods/comparative_cascade', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../methods/comparative_cascade')>();
  return {
    ...actual,
    gemmaExtract: vi.fn(async (_instruction: string, passage: string) => {
      if (passage.includes(DECISIVE_PHRASE)) {
        return {
          kinds: [{ name: 'South Asia', kind: 'demographic region', span: `${DECISIVE_PHRASE}.` }],
          categoryKind: null,
        };
      }
      // Every other ask (ENUMERATION/PROPERTY/SUBREGION/REGISTER) and every unproductive candidate
      // for the KIND ask itself gets this honest "nothing stated" shape -- never fabricated.
      return { kinds: [], categoryKind: null, subregionNonMembers: [], propertyMembers: [], categoryEnumeration: null, categoryEnumerationMembers: [], registerStatement: null };
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
  dir = mkdtempSync(join(tmpdir(), 'lb-discriminator-freetext-wiring-'));
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

describe('D-BP155-035: a live Discriminator:1 run CALLS the free-text reader and the candidate ARRIVES (KIND ask)', () => {
  test('a relevant free-text capture in LB_EVIDENCE_DIR is credited as the KIND ask\'s own answered passage', async () => {
    const payload: AmbientCapturePayload = {
      query: 'what kind of thing is South Asia',
      answer: `${DECISIVE_PHRASE}. South America is a continental landmass.`,
      surface: 'gemini.google.com',
      url: 'https://gemini.google.com/app/discriminator-freetext-wiring-proof',
      capturedAt: T,
    };
    const written = recordAmbientBrowserCapture(payload, payload, 0, dir);
    expect(written.ok).toBe(true);
    if (!written.ok) throw new Error('setup failed: the real capture path rejected this payload');
    expect(written.record.qid).toBeNull();

    const ctx: MethodRunContext = { askGoogle: instantHaltAskGoogle(), emit: vi.fn() };
    const { result } = await runDiscriminatorStep(INPUT, ctx);

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
  test('WITH free-text evidence: South Asia\'s kind is found stated ("demographic region")', async () => {
    const payload: AmbientCapturePayload = {
      query: 'what kind of thing is South Asia',
      answer: `${DECISIVE_PHRASE}.`,
      surface: 'gemini.google.com',
      url: 'https://gemini.google.com/app/discriminator-removal-with',
      capturedAt: T,
    };
    recordAmbientBrowserCapture(payload, payload, 0, dir);

    const ctx: MethodRunContext = { askGoogle: instantHaltAskGoogle(), emit: vi.fn() };
    const { result } = await runDiscriminatorStep(INPUT, ctx);

    expect(result.ok).toBe(true);
    expect(result.kinds.map((e) => e.letter)).toContain('B'); // South Asia
    expect(result.kinds.find((e) => e.letter === 'B')?.kind).toBe('demographic region');
    expect(result.via).toContain('owned:free-text(');
  });

  test('WITHOUT free-text evidence (withheld, everything else held equal): South Asia\'s kind is no longer found -- the finding does NOT survive removal', async () => {
    const ctx: MethodRunContext = {
      askGoogle: instantHaltAskGoogle(),
      emit: vi.fn(),
      // Names no option at all (this discriminator's five asks all abstain on this input, but the
      // structural point -- the credited South-Asia-as-demographic-region finding is GONE without
      // the free-text source -- is what this test asserts).
      askConversationalAuthority: vi.fn(async () => ({
        ok: false, text: '', citations: [], via: 'user_gemini:ceiling(timeout)', authority: 'user_gemini',
      })),
    };

    const { result } = await runDiscriminatorStep(INPUT, ctx);

    const kindLetters = result.kinds.map((e) => e.letter);
    expect(kindLetters).not.toContain('B');
    expect(result.via).not.toContain('owned:free-text(');
  });
});

describe('D-BP155-035: THE MORTGAGE TRAP, WITH a free-text candidate specifically in the KIND ask\'s pool (D-BP154-018 "try harder before abstain")', () => {
  test('a free-text candidate that NAMES an option but proves UNPRODUCTIVE for the KIND ask still lets STAGE 2 (conversational) be tried and credited', async () => {
    // Mentions South Asia (gathered, passes namesAnyOption for the KIND ask) but does not contain
    // DECISIVE_PHRASE -- extraction from it yields kinds:[], exactly the "found a source but it
    // proved nothing" shape D-BP154-018 exists to recover from.
    const payload: AmbientCapturePayload = {
      query: 'tell me about South Asia',
      answer: 'South Asia is a subregion of Asia comprising several countries.',
      surface: 'gemini.google.com',
      url: 'https://gemini.google.com/app/discriminator-mortgagetrap-freetext',
      capturedAt: T,
    };
    recordAmbientBrowserCapture(payload, payload, 0, dir);

    const ctx: MethodRunContext = {
      askGoogle: instantHaltAskGoogle(),
      emit: vi.fn(),
      askConversationalAuthority: vi.fn(async () => ({
        ok: true,
        text: `${DECISIVE_PHRASE}.`,
        citations: [],
        via: 'user_gemini:answered(mock-stage2)',
        authority: 'user_gemini',
      })),
    };

    const { result } = await runDiscriminatorStep(INPUT, ctx);

    expect(result.ok).toBe(true);
    expect(result.kinds.map((e) => e.letter)).toContain('B'); // South Asia, found via STAGE 2
    expect(result.kinds.find((e) => e.letter === 'B')?.kind).toBe('demographic region');
    // Credited via the conversational authority, NOT the unproductive free-text candidate.
    expect(result.via).toContain('conversational');
    expect(result.via).not.toContain('owned:free-text(');
  });
});
