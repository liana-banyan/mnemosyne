// boundary_step_freetext_wiring.test.ts -- D-BP155-010/BISHOP/seg-freetext-wire
//
// PROVES FD-BP155-01 OPTION B IS WIRED INTO A LIVE 'BoundaryStability:1' RUN, NOT MERELY PRESENT.
// D-BP155-007 built readFreeTextEvidence()/toStepCandidates() (free_text_evidence.ts) and reported
// them uncalled by any Composer step. This ticket wires gatherFreeTextCandidates()
// (composer_step_evidence.ts, additive, does not touch gatherMortgageCandidates()'s own
// `if (qid == null) return [];` gate) into runBoundaryStep() (boundary_step.ts) -- see that file's
// own D-BP155-010 header note for why BoundaryStability:1 was the step chosen.
//
// (a) "a live step run CALLS the reader": a REAL free-text capture, written through the REAL
//     recordAmbientBrowserCapture()/appendEvidence() path into a temp LB_EVIDENCE_DIR, is read
//     back by the REAL runBoundaryStep() and becomes the step's own credited answer -- asserted on
//     the step's ACTUAL output (via/answerProvenance), never a spy standing in for behavior.
//
// (b) THE REMOVAL TEST -- P12/Borromean's own principle (borromean_test.ts, D-BP154-072: "remove
//     it and re-derive; if the conclusion survives the removal, you did not have convergence").
//     Borromean:1 itself (runBorromeanTest()) operates at COMPOSER-STEP granularity -- it withholds
//     one whole step's own entry from priorResults (TerminatorEliminationEntry.sourceStep) and
//     re-runs the Terminator. That instrument cannot itself answer "is free-text evidence,
//     specifically, load-bearing WITHIN one step" -- withholding BoundaryStability:1 entirely would
//     conflate "this step ran" with "this step's free-text source mattered". This file applies the
//     SAME remove-and-re-derive discipline one level lower, at the evidence-SOURCE granularity
//     inside the one step it is wired into, using the REAL runBoundaryStep() (never a
//     reimplementation of its logic) run twice with everything else held constant: once with the
//     free-text capture present, once withheld. This is a purpose-built harness following
//     Borromean's own principle, honestly distinguished here from a literal Borromean:1 call --
//     not claimed to be one.
//
//     gemmaExtract() (comparative_cascade.ts) is the one live-Ollama call runBoundaryStep() makes;
//     it is mocked HERE ONLY (vi.mock is file-scoped) so the comparison is reproducible offline,
//     the same boundary every sibling step's own test file already documents ("needs a live
//     Ollama instance, proven by an in-app run instead") -- every other export of that module
//     (appearsIn/list/toLetters/googleBlocks) is the REAL implementation, via vi.importActual.
//
// (c) the two existing null gates (liana_terminal_engine.ts:899, composer_step_evidence.ts:150)
//     are NOT touched by this ticket and are NOT re-pinned here -- free_text_evidence.test.ts
//     (D-BP155-007, unmodified) already carries that proof; duplicating it here would be a second,
//     driftable copy of the same assertion.
//
// (d) CONTAMINATION DISCIPLINE: every write in this file goes through LB_EVIDENCE_DIR pointed at
//     an mkdtempSync temp dir, restored/removed in afterEach -- same discipline
//     free_text_evidence.test.ts / evidence_store.test.ts already hold to.

import {
  describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runBoundaryStep } from './boundary_step';
import type { MethodQuestionInput, MethodRunContext } from '../method_registry';
import type { BrowserAuthorityRawExtraction } from '../../../shared/plow/browser_authority_types';
import { recordAmbientBrowserCapture, type AmbientCapturePayload } from '../evidence/ambient_capture';

// D-BP155-010, FILE-SCOPED MOCK. Deterministic, offline stand-in for the one live-Ollama call this
// step makes. Reads only the ACTUAL passage text the real runBoundaryStep() hands it -- the mock is
// never told in advance which run (WITH/WITHOUT free-text) is under way, so its branching is a
// faithful (if simplified) model of "report only what the passage states" (the same instruction the
// real prompt gives the real model, comparative_cascade.ts:507). Every other export of this module
// (appearsIn/list/toLetters/googleBlocks) is the REAL implementation, via vi.importActual.
vi.mock('../methods/comparative_cascade', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../methods/comparative_cascade')>();
  return {
    ...actual,
    gemmaExtract: vi.fn(async (_instruction: string, passage: string) => {
      if (passage.includes('Turkestan')) {
        return {
          classifications: [
            {
              name: 'Central Asia',
              classification: 'multiple',
              definitions: ['the five former Soviet republics', 'Turkestan'],
              span: passage,
            },
            { name: 'South America', classification: 'single', span: passage },
          ],
        };
      }
      return {
        classifications: [
          { name: 'South America', classification: 'single', span: passage },
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
  dir = mkdtempSync(join(tmpdir(), 'lb-boundary-freetext-wiring-'));
  savedEvidenceDir = process.env.LB_EVIDENCE_DIR;
  process.env.LB_EVIDENCE_DIR = dir;
});

afterEach(() => {
  if (savedEvidenceDir === undefined) delete process.env.LB_EVIDENCE_DIR;
  else process.env.LB_EVIDENCE_DIR = savedEvidenceDir;
  rmSync(dir, { recursive: true, force: true });
  vi.clearAllMocks();
});

// A Google corroboration call, when it happens (unstable.length > 0), must not actually retry with
// real sleeps (googleBlocks()'s own 3-try/backoff loop, comparative_cascade.ts:363-401) -- returning
// challengeDetected:true is the one path that halts on attempt 1 with zero retries, so this test
// file stays fast and offline without touching that (unmodified, FORBIDDEN-to-edit) retry logic.
function instantHaltAskGoogle() {
  return vi.fn(async () => ({
    snippet: '', sourceUrl: null, selectorUsed: null, challengeDetected: true,
  } as unknown as BrowserAuthorityRawExtraction));
}

describe('D-BP155-010: a live BoundaryStability:1 run CALLS the free-text reader and the candidate ARRIVES', () => {
  test('a relevant free-text capture in LB_EVIDENCE_DIR is credited as the step\'s own answered passage', async () => {
    const payload: AmbientCapturePayload = {
      query: 'does Central Asia have one settled definition or more than one',
      answer: 'Central Asia carries multiple materially different definitions in standard '
        + 'world-regional usage: the five former Soviet republics, or Turkestan, or a broader area '
        + 'including Afghanistan. South America, by contrast, has one settled definition used '
        + 'consistently.',
      surface: 'gemini.google.com',
      url: 'https://gemini.google.com/app/freetext-wiring-proof',
      capturedAt: T,
    };
    const written = recordAmbientBrowserCapture(payload, payload, 0, dir);
    expect(written.ok).toBe(true);
    if (!written.ok) throw new Error('setup failed: the real capture path rejected this payload');
    expect(written.record.qid).toBeNull(); // honest qid:null, FD-BP155-01 non-negotiable 1

    const ctx: MethodRunContext = { askGoogle: instantHaltAskGoogle(), emit: vi.fn() };
    const { result } = await runBoundaryStep(INPUT, ctx);

    expect(result.ok).toBe(true);
    // THE CALL HAPPENED, and THE CANDIDATE ARRIVED -- not merely "the function exists".
    expect(result.via).toContain('owned:free-text(');
    expect(result.via).toContain('gemini.google.com');
    expect(result.answerProvenance?.mechanism).toBe('OWNED_EVIDENCE');
    expect(result.answerProvenance?.sourceId).toMatch(/^free-text:/);
    // Every field non-negotiable 3 requires, inspectable in the consumer-facing shape:
    expect(result.answerProvenance?.detail).toContain('ambient_browser');
    expect(result.answerProvenance?.detail).toContain('gemini.google.com');
    expect(result.answerProvenance?.detail).toContain('freetext-wiring-proof');
    expect(result.answerProvenance?.detail).toContain(T);
    expect(result.answerProvenance?.detail).toContain('significant term'); // the stated reason
  });
});

describe('D-BP155-010: THE REMOVAL TEST (Borromean P12 principle, applied one level below Composer-step granularity)', () => {
  test('WITH free-text evidence: Central Asia is found to carry >=2 named rival definitions (a NOT_COMPARABLE candidate)', async () => {
    const payload: AmbientCapturePayload = {
      query: 'does Central Asia have one settled definition or more than one',
      answer: 'Central Asia carries multiple materially different definitions in standard '
        + 'world-regional usage: the five former Soviet republics, or Turkestan, or a broader area '
        + 'including Afghanistan. South America has one settled definition.',
      surface: 'gemini.google.com',
      url: 'https://gemini.google.com/app/removal-with',
      capturedAt: T,
    };
    recordAmbientBrowserCapture(payload, payload, 0, dir);

    const ctx: MethodRunContext = { askGoogle: instantHaltAskGoogle(), emit: vi.fn() };
    const { result } = await runBoundaryStep(INPUT, ctx);

    expect(result.ok).toBe(true);
    expect(result.unstable.map((e) => e.letter)).toEqual(['F']); // Central Asia
    expect(result.unstable[0].definitions).toEqual(['the five former Soviet republics', 'Turkestan']);
    expect(result.via).toContain('owned:free-text(');
  });

  test('WITHOUT free-text evidence (withheld, everything else held equal): Central Asia is no longer found -- the finding does NOT survive removal', async () => {
    // LB_EVIDENCE_DIR is the SAME fresh, empty temp dir (beforeEach) -- no free-text capture is
    // written in this test. A conversational authority IS wired here (unlike the WITH-evidence run
    // above, which never needed one) so the step still reaches extraction and this stays a genuine
    // A/B on the ONE variable under test (free-text evidence present vs absent), never merely "the
    // step had nothing to say at all".
    const ctx: MethodRunContext = {
      askGoogle: instantHaltAskGoogle(),
      emit: vi.fn(),
      askConversationalAuthority: vi.fn(async () => ({
        ok: true,
        text: 'South America has one settled definition, used consistently in world-regional practice.',
        citations: [],
        via: 'user_gemini:answered(mock)',
        authority: 'user_gemini',
      })),
    };

    const { result } = await runBoundaryStep(INPUT, ctx);

    expect(result.ok).toBe(true);
    expect(result.unstable).toEqual([]); // Central Asia's multiple-definitions finding is GONE
    expect(result.notAddressed).toContain('F'); // never eliminated, never fabricated -- simply unaddressed
    expect(result.via).not.toContain('owned:free-text(');
    expect(result.via).toContain('conversational');
  });
});
