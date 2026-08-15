// boundary_step_freetext_wiring.LIVE.test.ts -- D-BP155-013/BISHOP/seg-gemma-live-proof
//
// LIVE COUNTERPART to boundary_step_freetext_wiring.test.ts (D-BP155-010, unmodified, unmocked
// baseline still stands). That file mocks gemmaExtract() (comparative_cascade.ts) so the removal
// test is reproducible offline. This file removes the mock entirely -- every export of
// comparative_cascade.ts, including the real gemmaExtract(), is the REAL implementation, and it
// makes a REAL HTTP call to a local Ollama daemon (OLLAMA_API_BASE, comparative_cascade.ts:80,
// default http://127.0.0.1:11434) running MODEL (comparative_cascade.ts:81, default
// 'gemma4:12b'). Gadget-verified this dispatch: the daemon answers /api/tags and a real
// /api/generate call against gemma4:12b returns a real, non-canned response.
//
// SKIPPED BY DEFAULT -- runs ONLY when RUN_LIVE_OLLAMA=1 is set in the environment. Under a bare
// `npx vitest run` (the command TEST_BASELINE-style regression counts are measured with, per this
// dispatch's stated baseline 37 failed / 83 passed files, 31 failed / 1014 passed tests) every
// test in this file is skipped, contributes zero to both the failed and passed test counts, and
// this file itself does not become a new failure. This file is therefore SAFE to leave in the
// tree without disturbing the regression baseline; it exists so the live measurement this
// dispatch produced is REPRODUCIBLE (run again with RUN_LIVE_OLLAMA=1 set) rather than a one-off
// terminal transcript with no artifact behind it.
//
// EACH ARM RUNS 6 TIMES, EACH AS ITS OWN test(), so a run's own PASS/FAIL and console output is
// individually visible in vitest's own report -- not folded into one big loop whose per-run detail
// only exists in a side-channel log. Every run ALSO appends one line of JSON to LIVE_LOG (a file
// in the OS temp dir, never inside LB_EVIDENCE_DIR and never inside the repo) so the dispatch that
// invoked this file can build a table afterward without re-deriving it from console scrollback.
//
// CONTAMINATION DISCIPLINE, same as the mocked sibling: every write in every run goes through
// LB_EVIDENCE_DIR pointed at a fresh mkdtempSync temp dir, removed in this test's own afterEach.
// Never the live HARDWIRE\LEDGER\LIANA_EVIDENCE store.

import {
  describe, test, expect, beforeEach, afterEach,
} from 'vitest';
import {
  mkdtempSync, rmSync, appendFileSync, mkdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runBoundaryStep } from './boundary_step';
import type { MethodQuestionInput, MethodRunContext } from '../method_registry';
import type { BrowserAuthorityRawExtraction } from '../../../shared/plow/browser_authority_types';
import { recordAmbientBrowserCapture, type AmbientCapturePayload } from '../evidence/ambient_capture';

const RUN_LIVE = process.env.RUN_LIVE_OLLAMA === '1';

const LIVE_LOG_DIR = join(tmpdir(), 'lb-gemma-live-proof-bp155');
const LIVE_LOG = join(LIVE_LOG_DIR, 'live_results.jsonl');
function logRun(rec: Record<string, unknown>) {
  mkdirSync(LIVE_LOG_DIR, { recursive: true });
  appendFileSync(LIVE_LOG, `${JSON.stringify(rec)}\n`);
}

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
  dir = mkdtempSync(join(tmpdir(), 'lb-boundary-freetext-LIVE-'));
  savedEvidenceDir = process.env.LB_EVIDENCE_DIR;
  process.env.LB_EVIDENCE_DIR = dir;
});

afterEach(() => {
  if (savedEvidenceDir === undefined) delete process.env.LB_EVIDENCE_DIR;
  else process.env.LB_EVIDENCE_DIR = savedEvidenceDir;
  rmSync(dir, { recursive: true, force: true });
});

function instantHaltAskGoogle() {
  return async () => ({
    snippet: '', sourceUrl: null, selectorUsed: null, challengeDetected: true,
  } as unknown as BrowserAuthorityRawExtraction);
}

async function runWithArm(runIndex: number) {
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

  const ctx: MethodRunContext = { askGoogle: instantHaltAskGoogle(), emit: () => {} };
  const t0 = Date.now();
  const { result } = await runBoundaryStep(INPUT, ctx);
  const durationMs = Date.now() - t0;

  const record = {
    dispatch: 'D-BP155-013', arm: 'WITH', runIndex, ts: new Date().toISOString(), durationMs,
    ok: result.ok,
    unstableLetters: result.unstable.map((e) => e.letter),
    unstableDefinitions: result.unstable.map((e) => e.definitions ?? []),
    confirmedStableLetters: result.confirmedStable.map((e) => e.letter),
    insufficientEnumerationLetters: result.insufficientEnumeration.map((e) => e.letter),
    notAddressed: result.notAddressed,
    via: result.via,
    error: result.error ?? null,
  };
  logRun(record);
  return { result, record };
}

async function runWithoutArm(runIndex: number) {
  // No free-text capture written -- LB_EVIDENCE_DIR is a fresh, empty temp dir (beforeEach).
  const ctx: MethodRunContext = {
    askGoogle: instantHaltAskGoogle(),
    emit: () => {},
    askConversationalAuthority: async () => ({
      ok: true,
      text: 'South America has one settled definition, used consistently in world-regional practice.',
      citations: [],
      via: 'user_gemini:answered(live-proof-mock-conversational-authority)',
      authority: 'user_gemini',
    }),
  };
  const t0 = Date.now();
  const { result } = await runBoundaryStep(INPUT, ctx);
  const durationMs = Date.now() - t0;

  const record = {
    dispatch: 'D-BP155-013', arm: 'WITHOUT', runIndex, ts: new Date().toISOString(), durationMs,
    ok: result.ok,
    unstableLetters: result.unstable.map((e) => e.letter),
    unstableDefinitions: result.unstable.map((e) => e.definitions ?? []),
    confirmedStableLetters: result.confirmedStable.map((e) => e.letter),
    insufficientEnumerationLetters: result.insufficientEnumeration.map((e) => e.letter),
    notAddressed: result.notAddressed,
    via: result.via,
    error: result.error ?? null,
  };
  logRun(record);
  return { result, record };
}

const RUNS = 6;
const ARM_TIMEOUT_MS = 120_000;

describe.skipIf(!RUN_LIVE)('D-BP155-013 LIVE: WITH free-text evidence (real Ollama, no mock)', () => {
  for (let i = 1; i <= RUNS; i += 1) {
    test(`WITH run ${i}/${RUNS}`, async () => {
      const { result, record } = await runWithArm(i);
      // eslint-disable-next-line no-console
      console.log(`[LIVE WITH ${i}/${RUNS}]`, JSON.stringify(record));
      expect(result.ok).toBe(true);
    }, ARM_TIMEOUT_MS);
  }
});

describe.skipIf(!RUN_LIVE)('D-BP155-013 LIVE: WITHOUT free-text evidence (real Ollama, no mock)', () => {
  for (let i = 1; i <= RUNS; i += 1) {
    test(`WITHOUT run ${i}/${RUNS}`, async () => {
      const { result, record } = await runWithoutArm(i);
      // eslint-disable-next-line no-console
      console.log(`[LIVE WITHOUT ${i}/${RUNS}]`, JSON.stringify(record));
      expect(result.ok).toBe(true);
    }, ARM_TIMEOUT_MS);
  }
});
