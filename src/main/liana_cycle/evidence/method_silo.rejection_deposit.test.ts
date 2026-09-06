// method_silo.rejection_deposit.test.ts -- D-BP165-M0-007/BISHOP-SEG/seg-instrument
//
// THE ABSOLUTE CONSTRAINT UNDER TEST: NO ANSWER MAY EVER ENTER THE SILO. The existing
// scanForAnswerLeakage() guard (reused by the new depositRejectionEblet() in method_silo.ts) is
// PHRASE-SHAPED (ANSWER_LEAK_PATTERNS: "the correct answer is X", "verdict: X", "qid N is option
// A"). This file proves, by direct measurement rather than assumption:
//   1. That guard DOES refuse a prose-shaped answer statement (matches BP164's own proof for
//      depositMethodologyEblet -- method_silo.demo.test.ts's own leak test).
//   2. That guard, ALONE, does NOT refuse a bare numeric/arithmetic-expression completion --
//      exactly the shape compute_sidecar.ts's rejected/disagreeing COMPUTE samples most often
//      carry, and exactly the shape a genuine leaked answer would ALSO carry for demand COMPUTE.
//   3. depositRejectionEblet()'s NEW structural guard (added this dispatch specifically to close
//      that gap) DOES refuse that bare-numeric shape.
//   4. The auto-deposit env flag defaults OFF -- a call with the flag unset is refused before any
//      guard even runs, so no run silently starts writing into the substrate.
//   5. A full round trip (deposit -> mint -> fetch) succeeds for content that clears every guard.
//
// ISOLATED: uses a temp dir (LB_METHOD_SILO_DIR override via the `dir` option), never touches the
// real HARDWIRE\LEDGER\EBLETS\METHOD_SILO on disk -- same isolation discipline
// method_silo.demo.test.ts already applies.

import { describe, expect, it, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  depositRejectionEblet,
  mintSiloCelpane,
  fetchSiloCelpaneFullText,
  auditSiloForAnswerLeakage,
  REJECTION_SILO_AUTO_DEPOSIT_ENV_FLAG,
} from './method_silo';

const FLAG = REJECTION_SILO_AUTO_DEPOSIT_ENV_FLAG;
const originalFlagValue = process.env[FLAG];

afterEach(() => {
  if (originalFlagValue === undefined) delete process.env[FLAG];
  else process.env[FLAG] = originalFlagValue;
});

function baseInput(overrides: Partial<Parameters<typeof depositRejectionEblet>[0]> = {}) {
  return {
    demandKind: 'COMPUTE' as const,
    methodId: 'methods.compute_gemma_cascade.computeGemmaCascadeMethod',
    rejectionClass: 'self_consistency_disagreement',
    rawOutputText: 'placeholder',
    rawOutputOriginalLength: 11,
    rawOutputTruncated: false,
    whatWouldHaveBeenNeeded: 'a component fact stating the reserve-ratio formula',
    qid: null,
    runId: 'test-run',
    dispatchId: 'D-BP165-M0-007',
    hexConnector: 'PROOF' as const,
    hexConnectorJustification: 'test fixture',
    sessionLabel: 'TEST',
    model: 'test-model',
    filedBy: 'test',
    ...overrides,
  };
}

describe('D-BP165-M0-007 depositRejectionEblet -- env flag default OFF', () => {
  it('refuses (ok:false) when the env flag is unset, before any content guard runs -- proves no run silently deposits', () => {
    delete process.env[FLAG];
    const dir = mkdtempSync(join(tmpdir(), 'method-silo-rejection-flagoff-'));
    try {
      const outcome = depositRejectionEblet(baseInput({ dir, rawOutputText: 'NONE' }));
      expect(outcome.ok).toBe(false);
      if (outcome.ok) return;
      expect(outcome.reason).toContain(FLAG);
      expect(outcome.reason).toContain('default OFF');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('refuses when the env flag is set to anything other than the literal string "true"', () => {
    process.env[FLAG] = '1';
    const dir = mkdtempSync(join(tmpdir(), 'method-silo-rejection-flagbad-'));
    try {
      const outcome = depositRejectionEblet(baseInput({ dir, rawOutputText: 'NONE' }));
      expect(outcome.ok).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('D-BP165-M0-007 depositRejectionEblet -- THE ABSOLUTE CONSTRAINT, measured both ways', () => {
  it('MEASURED: the existing phrase-shaped scanForAnswerLeakage guard DOES refuse a prose answer statement', () => {
    process.env[FLAG] = 'true';
    const dir = mkdtempSync(join(tmpdir(), 'method-silo-rejection-prose-leak-'));
    try {
      const outcome = depositRejectionEblet(baseInput({
        dir,
        rawOutputText: 'After working through the problem, the correct answer is 52500.',
      }));
      expect(outcome.ok).toBe(false);
      if (outcome.ok) return;
      expect(outcome.leaks && outcome.leaks.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('D-BP165-M0-010 CLOSED: auditSiloForAnswerLeakage now flags a bare arithmetic expression (the actual shape compute_sidecar.ts produces) via its NEW value-shaped scan -- the phrase-only guard alone still would not have caught it', () => {
    // ORIGINAL MEASUREMENT (D-BP165-M0-007, historical, still true today): a bare expression
    // written straight to a file (bypassing depositRejectionEblet()'s own structural guard
    // entirely) scanned CLEAN under the phrase-only ANSWER_LEAK_PATTERNS check -- proving that
    // guard alone is not sufficient for this content shape. That fact does not change here.
    //
    // WHAT CHANGED (D-BP165-M0-010, Founder order "Fix this now"): auditSiloForAnswerLeakage()
    // was hardened to ALSO run VALUE_SHAPED_LEAK_PATTERNS, folded in specifically so a file
    // reaching the silo by ANY means (not just through depositRejectionEblet()'s own guards) is
    // still caught on re-audit. MEASURED below: the same fixture now flags, and the hit is
    // attributable to the NEW value-shaped pattern set, not the pre-existing phrase set --
    // proving the gap this test originally demonstrated is now closed at the audit layer too.
    const dir = mkdtempSync(join(tmpdir(), 'method-silo-rejection-bare-numeric-gap-'));
    try {
      const tagDir = join(dir, 'COMPUTE');
      mkdirSync(tagDir, { recursive: true });
      writeFileSync(
        join(tagDir, 'raw-bare-expression-fixture.eblet.md'),
        '---\nname: fixture\n---\n\n250000 * 0.2\n',
        'utf8',
      );
      const audit = auditSiloForAnswerLeakage({ dir });
      expect(audit.scanned).toBe(1);
      expect(audit.flagged.length).toBe(1);
      expect(audit.flagged[0].path).toContain('raw-bare-expression-fixture.eblet.md');
      // every hit must be attributed to the D-BP165-M0-010 value-shaped guard -- proves it is the
      // NEW scan, not a coincidental phrase-pattern match, that closed this specific gap
      expect(audit.flagged[0].hits.every((h) => h.includes('D-BP165-M0-010 value-shaped'))).toBe(true);
      expect(audit.flagged[0].hits.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('PROVEN: depositRejectionEblet\'s new structural guard REFUSES that same bare-arithmetic shape, closing the measured gap', () => {
    process.env[FLAG] = 'true';
    const dir = mkdtempSync(join(tmpdir(), 'method-silo-rejection-bare-numeric-refused-'));
    try {
      const outcome = depositRejectionEblet(baseInput({ dir, rawOutputText: '250000 * 0.2' }));
      expect(outcome.ok).toBe(false);
      if (outcome.ok) return;
      expect(outcome.reason).toContain('bare digits/arithmetic-operators');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('D-BP165-M0-010 CLOSED, converted honestly (was ok:true / RESIDUAL RISK at D-BP165-M0-007, now ok:false): a numeric value stated in free-form prose is now refused, via the NEW value-shaped guard folded into scanForAnswerLeakage', () => {
    // HISTORY (D-BP165-M0-007): this exact input deposited successfully (ok:true). Neither the
    // phrase guard nor the bare-numeric-FIRST-LINE structural guard caught a number embedded in
    // ordinary prose that did not match one of ANSWER_LEAK_PATTERNS's specific phrasings. That was
    // reported as an open residual risk, not a claim of safety.
    //
    // WHAT CHANGED (D-BP165-M0-010, Founder order "Fix this now"): scanForAnswerLeakage() -- called
    // by depositRejectionEblet() at the SAME call site, unedited -- now also runs
    // VALUE_SHAPED_LEAK_PATTERNS, which flags any bare integer of two or more digits anywhere in
    // the field ("50000" here), not only a whole bare line. MEASURED below: this same input is now
    // refused (ok:false), and the reported leak is attributable to the new value-shaped pattern.
    process.env[FLAG] = 'true';
    const dir = mkdtempSync(join(tmpdir(), 'method-silo-rejection-residual-risk-'));
    try {
      const outcome = depositRejectionEblet(baseInput({
        dir,
        rawOutputText: 'So the reserves come to 50000, which falls short of the requirement.',
      }));
      expect(outcome.ok).toBe(false);
      if (outcome.ok) return;
      expect(outcome.leaks && outcome.leaks.length).toBeGreaterThan(0);
      expect(outcome.leaks!.some((l) => l.includes('D-BP165-M0-010'))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('RESIDUAL RISK, STILL OPEN AND DISCLOSED (D-BP165-M0-010): a single-digit-only arithmetic shape embedded in prose is still NOT caught -- the value-shaped guard requires a 2+ digit bare integer, a decimal point, an arithmetic/equation shape, or a LaTeX fraction; "4 times 3" style single-digit values slip through both guards', () => {
    process.env[FLAG] = 'true';
    const dir = mkdtempSync(join(tmpdir(), 'method-silo-rejection-residual-risk-single-digit-'));
    try {
      const outcome = depositRejectionEblet(baseInput({
        dir,
        rawOutputText: 'The count works out to 4, one short of the requirement.',
      }));
      // MEASURED, NOT ASSUMED: this still deposits (ok:true). A lone single digit is common enough
      // in legitimate methodology prose (a formula coefficient, an option count) that the guard
      // does not flag every digit -- only a 2+ digit bare integer, a decimal, an arithmetic shape,
      // or a LaTeX fraction. If a single-digit value were ever the actual leaked answer, this
      // would be a real miss. Documented here, not papered over, same discipline this file already
      // applies to every other guard.
      expect(outcome.ok).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('PROVEN: the structural guard also refuses a bare number with no operator at all', () => {
    process.env[FLAG] = 'true';
    const dir = mkdtempSync(join(tmpdir(), 'method-silo-rejection-bare-number-refused-'));
    try {
      const outcome = depositRejectionEblet(baseInput({ dir, rawOutputText: '52500' }));
      expect(outcome.ok).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('D-BP165-M0-007 depositRejectionEblet -- round trip for content that clears every guard', () => {
  it('deposits, mints a silo celpane, and fetches the full text back, for a safe (non-answer-shaped) rejection', async () => {
    process.env[FLAG] = 'true';
    const dir = mkdtempSync(join(tmpdir(), 'method-silo-rejection-roundtrip-'));
    try {
      const deposit = depositRejectionEblet(baseInput({
        dir,
        rejectionClass: 'none_escape_hatch',
        rawOutputText: 'NONE',
        rawOutputOriginalLength: 4,
        rawOutputTruncated: false,
        whatWouldHaveBeenNeeded: 'a component fact naming the compounding-interest formula, absent from the question text',
      }));
      expect(deposit.ok).toBe(true);
      if (!deposit.ok) return;
      expect(deposit.bytes).toBeGreaterThan(0);

      const mintOutcome = mintSiloCelpane('COMPUTE', { dir });
      expect(mintOutcome.ok).toBe(true);
      if (!mintOutcome.ok) return;
      expect(mintOutcome.celpane.n).toBe(1);

      const fetchOutcome = await fetchSiloCelpaneFullText(mintOutcome.celpane, { dir });
      expect(fetchOutcome.ok).toBe(true);
      if (!fetchOutcome.ok) return;
      expect(fetchOutcome.text).toContain('NONE');
      expect(fetchOutcome.text).toContain('none_escape_hatch');
      expect(fetchOutcome.text).toContain('compounding-interest formula');

      const audit = auditSiloForAnswerLeakage({ dir });
      expect(audit.flagged).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('Rule 66: a second deposit with the identical content-address key supersedes rather than overwrites silently', () => {
    process.env[FLAG] = 'true';
    const dir = mkdtempSync(join(tmpdir(), 'method-silo-rejection-supersede-'));
    try {
      const input = baseInput({
        dir,
        rejectionClass: 'none_escape_hatch',
        rawOutputText: 'NONE',
        now: () => '2026-08-24T00:00:00.000Z',
      });
      const first = depositRejectionEblet(input);
      expect(first.ok).toBe(true);
      const second = depositRejectionEblet({ ...input, now: () => '2026-08-24T00:00:01.000Z' });
      expect(second.ok).toBe(true);
      if (!first.ok || !second.ok) return;
      expect(second.path).toBe(first.path); // same content-address slug -- Rule 66 renames the old one aside
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
