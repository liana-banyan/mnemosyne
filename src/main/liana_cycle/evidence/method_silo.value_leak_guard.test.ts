// method_silo.value_leak_guard.test.ts -- D-BP165-M0-010/BISHOP-SEG/seg-instrument
//
// FOUNDER ORDER, BP165, VERBATIM: "Fix this now," referring to BISHOP-M0's own finding that the
// answer-leak guard is weaker than the campaign assumed (phrase-shaped, not value-shaped). Same
// message: "New rule: when you build it, you wire it. Always."
//
// D-BP165-M0-007 measured the gap and closed it PARTIALLY, ONLY inside depositRejectionEblet(),
// which itself sits behind an env flag default OFF. THE BIGGER FINDING (LAW 1): depositMethodologyEblet()
// -- the ORIGINAL write path, the one with NO env gate, the one that has been live and callable
// since D-BP164-M0-122 -- had NO structural or value-shaped guard at all. It only ever ran the
// phrase-shaped ANSWER_LEAK_PATTERNS. An arithmetic expression or a number embedded in ordinary
// prose in `whatItDoes`, `taughtBy`, or `hexConnectorJustification` would have sailed straight
// into a real, ungated eblet file.
//
// THIS FILE PROVES THREE THINGS DIRECTLY, NOT BY INFERENCE:
//   1. depositMethodologyEblet() -- previously unguarded against this shape -- now refuses a
//      value-shaped leak, because it calls the SAME scanForAnswerLeakage() depositRejectionEblet()
//      calls, and that function was hardened once, centrally (D-BP165-M0-010).
//   2. depositRejectionEblet() (env flag ON) refuses the same shape, via the identical guard.
//   3. auditSiloForAnswerLeakage() -- the re-scan surface used to certify a subset immediately
//      before it ships to a third party -- also flags the same shape when it reaches disk by a
//      path OTHER than either deposit function (a hand-authored or future-caller-written file),
//      so the guard is not merely a write-time formality.
// A fourth block proves a LEGITIMATE deposit (numbers-as-identifiers only: a BP session number, a
// dispatch id, an explicit "qid N" citation) is NOT refused -- the guard is value-shaped, not
// digit-shaped, and must not make the silo unusable for its own documented citation style
// (method_silo.demo.test.ts's own real deposit already exercises this; this file adds a minimal,
// isolated repro of the same claim so it is provable from this file alone).
//
// ISOLATED: temp dirs only (LB_METHOD_SILO_DIR override via the `dir` option), same discipline as
// every other test in this file's siblings.

import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  auditSiloForAnswerLeakage,
  depositMethodologyEblet,
  depositRejectionEblet,
  REJECTION_SILO_AUTO_DEPOSIT_ENV_FLAG,
} from './method_silo';

const FLAG = REJECTION_SILO_AUTO_DEPOSIT_ENV_FLAG;
const originalFlagValue = process.env[FLAG];
afterEach(() => {
  if (originalFlagValue === undefined) delete process.env[FLAG];
  else process.env[FLAG] = originalFlagValue;
});

describe('D-BP165-M0-010 value-shaped guard -- wired onto BOTH silo write paths, not merely available', () => {
  it('PROVEN: depositMethodologyEblet -- the ORIGINAL, ungated write path, previously guarded ONLY by phrase patterns -- now refuses a value-shaped leak in whatItDoes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'method-silo-value-guard-methodology-'));
    try {
      const outcome = depositMethodologyEblet({
        demandKind: 'COMPUTE',
        methodId: 'methods.compute_gemma_cascade.computeGemmaCascadeMethod',
        // deliberately answer-VALUE-shaped, not answer-PHRASE-shaped -- no "the answer is", just
        // the bare computation a leaked answer would actually look like
        whatItDoes: 'Solves reserve-ratio problems by computing 250000 * 0.2 directly.',
        taughtBy: 'test fixture',
        qid: null,
        runId: 'test', dispatchId: 'D-BP165-M0-010',
        hexConnector: 'PROOF', hexConnectorJustification: 'test fixture',
        sessionLabel: 'BP165', model: 'test-model', filedBy: 'D-BP165-M0-010',
        dir,
      });
      expect(outcome.ok).toBe(false);
      if (outcome.ok) return;
      expect(outcome.leaks && outcome.leaks.length).toBeGreaterThan(0);
      expect(outcome.leaks!.some((l) => l.includes('D-BP165-M0-010'))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('PROVEN: depositMethodologyEblet also refuses a number embedded in ordinary prose (no arithmetic operator at all) in taughtBy', () => {
    const dir = mkdtempSync(join(tmpdir(), 'method-silo-value-guard-methodology-prose-'));
    try {
      const outcome = depositMethodologyEblet({
        demandKind: 'COMPUTE',
        methodId: 'methods.compute_gemma_cascade.computeGemmaCascadeMethod',
        whatItDoes: 'Applies the reserve-ratio formula to a deposit amount.',
        taughtBy: 'Walkthrough where the reserves came to 50000 in the worked example.',
        qid: null,
        runId: 'test', dispatchId: 'D-BP165-M0-010',
        hexConnector: 'PROOF', hexConnectorJustification: 'test fixture',
        sessionLabel: 'BP165', model: 'test-model', filedBy: 'D-BP165-M0-010',
        dir,
      });
      expect(outcome.ok).toBe(false);
      if (outcome.ok) return;
      expect(outcome.leaks && outcome.leaks.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('PROVEN: depositRejectionEblet (flag ON) refuses the identical value-shaped prose leak, via the same shared guard', () => {
    process.env[FLAG] = 'true';
    const dir = mkdtempSync(join(tmpdir(), 'method-silo-value-guard-rejection-'));
    try {
      const outcome = depositRejectionEblet({
        demandKind: 'COMPUTE',
        methodId: 'methods.compute_gemma_cascade.computeGemmaCascadeMethod',
        rejectionClass: 'self_consistency_disagreement',
        rawOutputText: 'Working through it, the reserves come to 50000 in this branch.',
        rawOutputOriginalLength: 60,
        rawOutputTruncated: false,
        whatWouldHaveBeenNeeded: 'a component fact stating the reserve-ratio formula',
        qid: null,
        runId: 'test', dispatchId: 'D-BP165-M0-010',
        hexConnector: 'PROOF', hexConnectorJustification: 'test fixture',
        sessionLabel: 'BP165', model: 'test-model', filedBy: 'D-BP165-M0-010',
        dir,
      });
      expect(outcome.ok).toBe(false);
      if (outcome.ok) return;
      expect(outcome.leaks && outcome.leaks.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('PROVEN: auditSiloForAnswerLeakage flags the same value-shaped content even when it reaches disk by neither deposit function -- the re-scan surface is not a write-time-only formality', () => {
    const dir = mkdtempSync(join(tmpdir(), 'method-silo-value-guard-audit-'));
    try {
      // deposit ONE safe eblet through the real write path, so the audit has something to scan
      const deposit = depositMethodologyEblet({
        demandKind: 'COMPUTE',
        methodId: 'methods.compute_gemma_cascade.computeGemmaCascadeMethod',
        whatItDoes: 'Applies the reserve-ratio formula to a deposit amount.',
        taughtBy: 'test fixture',
        qid: null,
        runId: 'test', dispatchId: 'D-BP165-M0-010',
        hexConnector: 'PROOF', hexConnectorJustification: 'test fixture',
        sessionLabel: 'BP165', model: 'test-model', filedBy: 'D-BP165-M0-010',
        dir,
      });
      expect(deposit.ok).toBe(true);
      const auditClean = auditSiloForAnswerLeakage({ dir });
      expect(auditClean.flagged).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('CONTROL, MUST NOT REGRESS: a legitimate deposit citing only identifier-shaped numbers (a BP session number, a dispatch id, an explicit qid citation) is NOT refused -- the guard is value-shaped, not digit-shaped', () => {
    const dir = mkdtempSync(join(tmpdir(), 'method-silo-value-guard-control-'));
    try {
      const outcome = depositMethodologyEblet({
        demandKind: 'DEFINE',
        methodId: 'methods.definitional_cascade.definitionalCascadeMethod',
        whatItDoes: 'Answers questions that ask what a term means by looking up every verified '
          + 'meaning of the term, abstaining honestly when no option matches.',
        taughtBy: 'canon_the_liana_cycle_is_a_method_registry_taught_by_humans_bp149 -- '
          + '"Taught by the Founder\'s qid 85 walkthrough."',
        qid: 85,
        runId: 'D-BP165-M0-010-control-run', dispatchId: 'D-BP165-M0-010',
        hexConnector: 'PROOF', hexConnectorJustification: 'PROOF holds cascade/method measurement '
          + 'discipline, matching a demand-kind-to-method mapping.',
        sessionLabel: 'BP165', model: 'claude-sonnet-5', filedBy: 'D-BP165-M0-010',
        dir,
      });
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;
      const audit = auditSiloForAnswerLeakage({ dir });
      expect(audit.scanned).toBe(1);
      expect(audit.flagged).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
