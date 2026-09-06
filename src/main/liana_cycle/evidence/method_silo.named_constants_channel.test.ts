// method_silo.named_constants_channel.test.ts -- D-BP165-M0-025/BISHOP-SEG/seg-flagship-harvest
//
// PROVES THE COLLISION THIS DISPATCH WAS GIVEN, AND THE FIX, BOTH DIRECTIONS:
//
// THE COLLISION (measured against the D-BP165-M0-010 guard, unchanged by this dispatch): a bare
// decimal ("g = 9.81 m/s^2") or a bare 2+ digit integer ("a 360-day year") in a free-text field
// (whatItDoes/taughtBy) is refused by VALUE_SHAPED_LEAK_PATTERNS -- even though both are the
// Founder's own worked examples of a LEGITIMATE method constant, not an answer.
//
// THE FIX: a new, separate, structured `constants` field (NamedConstant[]) on
// MethodSiloDepositInput, validated by validateNamedConstant() -- never scanned by the free-text
// regexes, never a loosening of those regexes (proved unchanged, block 1 below).
//
// FOUR THINGS PROVED HERE, DIRECTLY:
//   1. The free-text guard is UNCHANGED: g=9.81 and a 360-day year, written directly into
//      whatItDoes as prose (not through the new channel), are STILL refused exactly as before.
//   2. The SAME two facts, submitted through the new `constants` field with a real citation, ARE
//      accepted -- deposit succeeds, and auditSiloForAnswerLeakage() re-scans the resulting file
//      clean.
//   3. A computed, item-specific value (the shape a real leaked MMLU-Pro answer would take, e.g.
//      the exact dollar balance a loan-payoff question's answer key states) is REFUSED whether
//      offered as prose OR disguised as a "constant" with a denylisted or uncited symbol.
//   4. MAX_CONSTANTS_PER_DEPOSIT and audit-side re-validation are enforced independently of the
//      write path (a hand-authored file with a malformed constants block is still flagged).
//
// ISOLATED: temp dirs only, same discipline as every other test in this file's siblings.

import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  auditSiloForAnswerLeakage,
  depositMethodologyEblet,
  validateNamedConstant,
  MAX_CONSTANTS_PER_DEPOSIT,
} from './method_silo';

describe('D-BP165-M0-025 named-constants channel -- admits real method constants, still refuses computed answers', () => {
  it('BLOCK 1 (UNCHANGED GUARD, MUST NOT REGRESS): g=9.81 and a 360-day year written as free-text prose are STILL refused -- the collision is real and the existing guard is untouched', () => {
    const dir = mkdtempSync(join(tmpdir(), 'method-silo-collision-decimal-'));
    try {
      const outcome = depositMethodologyEblet({
        demandKind: 'COMPUTE',
        methodId: 'methods.arithmetic_cascade.arithmeticCascadeMethod',
        whatItDoes: 'Applies free-fall kinematics using g = 9.81 m/s^2 for standard gravity.',
        taughtBy: 'test fixture',
        qid: null,
        runId: 'test', dispatchId: 'D-BP165-M0-025',
        hexConnector: 'PROOF', hexConnectorJustification: 'test fixture',
        sessionLabel: 'BP165', model: 'test-model', filedBy: 'D-BP165-M0-025',
        dir,
      });
      expect(outcome.ok).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }

    const dir2 = mkdtempSync(join(tmpdir(), 'method-silo-collision-year-'));
    try {
      const outcome2 = depositMethodologyEblet({
        demandKind: 'COMPUTE',
        methodId: 'methods.arithmetic_cascade.arithmeticCascadeMethod',
        whatItDoes: 'Converts an annual rate to a daily rate using a 360-day year convention.',
        taughtBy: 'test fixture',
        qid: null,
        runId: 'test', dispatchId: 'D-BP165-M0-025',
        hexConnector: 'PROOF', hexConnectorJustification: 'test fixture',
        sessionLabel: 'BP165', model: 'test-model', filedBy: 'D-BP165-M0-025',
        dir: dir2,
      });
      expect(outcome2.ok).toBe(false);
    } finally {
      rmSync(dir2, { recursive: true, force: true });
    }
  });

  it('BLOCK 2 (DIRECTION A -- DEPOSITS): the SAME two constants, through the structured channel with a real citation, deposit successfully and audit clean', () => {
    const dir = mkdtempSync(join(tmpdir(), 'method-silo-constants-deposit-'));
    try {
      const outcome = depositMethodologyEblet({
        demandKind: 'COMPUTE',
        methodId: 'methods.arithmetic_cascade.arithmeticCascadeMethod',
        whatItDoes: 'Applies free-fall kinematics: distance fallen equals one half times the '
          + 'gravitational acceleration constant times time squared, and separately converts an '
          + 'annual interest rate to a daily rate using a standard banking-year day-count constant.',
        taughtBy: 'Standard kinematics and banking day-count conventions -- not a per-item derivation.',
        qid: null,
        runId: 'test', dispatchId: 'D-BP165-M0-025',
        hexConnector: 'PROOF', hexConnectorJustification: 'test fixture',
        sessionLabel: 'BP165', model: 'test-model', filedBy: 'D-BP165-M0-025',
        constants: [
          { symbol: 'g', value: 9.81, unit: 'm/s^2', source: 'CODATA standard gravity, physical constant' },
          { symbol: 'days_per_year', value: 360, unit: 'days', source: 'standard 360-day banking-year convention' },
        ],
        dir,
      });
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;
      const raw = readFileSync(outcome.path, 'utf8');
      expect(raw).toContain('**g** = 9.81 m/s^2');
      expect(raw).toContain('**days_per_year** = 360 days');
      expect(raw).toContain('NAMED-CONSTANTS-BEGIN');

      const audit = auditSiloForAnswerLeakage({ dir });
      expect(audit.scanned).toBe(1);
      expect(audit.flagged).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('BLOCK 3 (DIRECTION B -- REFUSED): a computed, item-specific value is refused whether offered as prose or disguised as a constant', () => {
    // Prose: exactly the shape a leaked MMLU-Pro answer key value would take (a specific dollar
    // balance), embedded in ordinary sentence, no phrase-shaped "the answer is" wording at all.
    const dirProse = mkdtempSync(join(tmpdir(), 'method-silo-answer-prose-'));
    try {
      const outcome = depositMethodologyEblet({
        demandKind: 'COMPUTE',
        methodId: 'methods.arithmetic_cascade.arithmeticCascadeMethod',
        whatItDoes: 'Working the amortization formula through for this loan gives a remaining balance of 104761.48.',
        taughtBy: 'test fixture',
        qid: null,
        runId: 'test', dispatchId: 'D-BP165-M0-025',
        hexConnector: 'PROOF', hexConnectorJustification: 'test fixture',
        sessionLabel: 'BP165', model: 'test-model', filedBy: 'D-BP165-M0-025',
        dir: dirProse,
      });
      expect(outcome.ok).toBe(false);
    } finally {
      rmSync(dirProse, { recursive: true, force: true });
    }

    // Disguised as a "constant" with a denylisted symbol name -- refused on symbol alone.
    const denylistCheck = validateNamedConstant({ symbol: 'balance', value: 104761.48, source: 'standard formula result' });
    expect(denylistCheck.ok).toBe(false);
    expect(denylistCheck.reasons.some((r) => r.includes('denylist'))).toBe(true);

    // Disguised as a "constant" with an innocuous symbol but NO recognized authority citation --
    // refused for lacking a real, checkable source, which a genuine constant always has.
    const uncitedCheck = validateNamedConstant({ symbol: 'k', value: 104761.48, source: 'computed for this loan' });
    expect(uncitedCheck.ok).toBe(false);
    expect(uncitedCheck.reasons.some((r) => r.includes('authority/convention keyword'))).toBe(true);

    // Full deposit attempt through the constants channel with the denylisted symbol -- refused,
    // nothing written to disk.
    const dirConst = mkdtempSync(join(tmpdir(), 'method-silo-answer-as-constant-'));
    try {
      const outcome = depositMethodologyEblet({
        demandKind: 'COMPUTE',
        methodId: 'methods.arithmetic_cascade.arithmeticCascadeMethod',
        whatItDoes: 'Applies the amortization formula to a fixed-rate loan.',
        taughtBy: 'test fixture',
        qid: null,
        runId: 'test', dispatchId: 'D-BP165-M0-025',
        hexConnector: 'PROOF', hexConnectorJustification: 'test fixture',
        sessionLabel: 'BP165', model: 'test-model', filedBy: 'D-BP165-M0-025',
        constants: [{ symbol: 'balance', value: 104761.48, source: 'standard formula result' }],
        dir: dirConst,
      });
      expect(outcome.ok).toBe(false);
      if (outcome.ok) return;
      expect(outcome.leaks && outcome.leaks.some((l) => l.includes('denylist'))).toBe(true);
    } finally {
      rmSync(dirConst, { recursive: true, force: true });
    }
  });

  it('BLOCK 4: MAX_CONSTANTS_PER_DEPOSIT is enforced at write time, and audit re-validates a malformed hand-written constants block independent of the write path', () => {
    const dirTooMany = mkdtempSync(join(tmpdir(), 'method-silo-too-many-constants-'));
    try {
      const constants = Array.from({ length: MAX_CONSTANTS_PER_DEPOSIT + 1 }, (_, i) => ({
        symbol: `k${i}`, value: i + 1, source: 'standard formula constant',
      }));
      const outcome = depositMethodologyEblet({
        demandKind: 'COMPUTE',
        methodId: 'methods.arithmetic_cascade.arithmeticCascadeMethod',
        whatItDoes: 'Applies a formula with many constants.',
        taughtBy: 'test fixture',
        qid: null,
        runId: 'test', dispatchId: 'D-BP165-M0-025',
        hexConnector: 'PROOF', hexConnectorJustification: 'test fixture',
        sessionLabel: 'BP165', model: 'test-model', filedBy: 'D-BP165-M0-025',
        constants,
        dir: dirTooMany,
      });
      expect(outcome.ok).toBe(false);
    } finally {
      rmSync(dirTooMany, { recursive: true, force: true });
    }

    const dirHand = mkdtempSync(join(tmpdir(), 'method-silo-hand-authored-'));
    try {
      const tagDir = join(dirHand, 'COMPUTE');
      require('node:fs').mkdirSync(tagDir, { recursive: true });
      const path = join(tagDir, 'hand-authored.eblet.md');
      writeFileSync(path, [
        '---',
        'name: hand-authored',
        'metadata:',
        '  type: methodology',
        'hex_connector: PROOF',
        '---',
        '',
        '## NAMED CONSTANTS',
        '',
        '<!-- NAMED-CONSTANTS-BEGIN -->',
        '- **balance** = 104761.48 (source: computed for this loan)',
        '<!-- NAMED-CONSTANTS-END -->',
        '',
      ].join('\n'), 'utf8');

      const audit = auditSiloForAnswerLeakage({ dir: dirHand });
      expect(audit.flagged.length).toBe(1);
      expect(audit.flagged[0].hits.some((h) => h.includes('denylist') || h.includes('authority'))).toBe(true);
    } finally {
      rmSync(dirHand, { recursive: true, force: true });
    }
  });
});

// ── D-BP167-M0-057: PERMANENT REGRESSION COVERAGE FOR THE CITATION-AUTHORITY GAP ────────────────
//
// THIS GAP SAT AS A CODE COMMENT (method_silo.ts's own "A sufficiently disguised item-specific
// value, given an innocuous symbol and a fabricated authority-sounding source, could still pass.
// Documented here, not papered over.") FOR MONTHS AND WAS NEVER REPRODUCED UNTIL BP167. It took
// two dispatches to find its exact shape and close it, and until this block there was still NO
// PERMANENT TEST for any of it -- only one-off scratch harnesses that no longer exist on disk:
//   - D-BP167-M0-050 reproduced the gap against the real compiled function for the first time:
//     {symbol:'x', value:52500, source:'standard convention value for this problem'} was ACCEPTED
//     when it should not have been.
//   - D-BP167-M0-055 closed it with ITEM_SCOPE_PHRASE_DENYLIST in method_silo.ts (see that
//     constant's own doc comment above, and validateNamedConstant()'s unconditional
//     ITEM_SCOPE_PHRASE_DENYLIST check), and proved exactly one case flipped (case 5, ACCEPTED ->
//     REJECTED) while all six neighboring cases were unaffected.
// A guard whose only proof lives in a one-off scratch harness is a guard with no memory. The block
// below is that memory: it covers the FULL seven-case table both dispatches measured, REJECTS and
// ACCEPTS alike, so a future refactor that silently reopens this gap (or over-tightens the
// denylist until legitimate constants stop getting through and the silos quietly starve) fails a
// real, named, permanent test instead of waiting for another accident. This block adds tests
// only -- it does not touch guard logic, does not touch the real METHOD_SILO directory, and every
// test below writes only to its own isolated mkdtempSync scratch directory.
describe('D-BP167-M0-057 permanent regression coverage -- the full seven-case answer-leak-guard table (D-BP167-M0-050 reproduced it, D-BP167-M0-055 closed it, this is its memory)', () => {
  it('accepts_gravitational_constant_via_structured_constants_channel_with_codata_citation', () => {
    // MUST STILL BE ACCEPTED. Case 2 of the seven-case table. A real physical constant, cited to a
    // real standards body, deposited through the structured `constants` channel (never free prose)
    // -- this is the sanctioned way a legitimate method constant enters the silo. If this test ever
    // starts failing, the denylist/keyword tightening that broke it is starving the silo of real
    // constants, not closing a leak.
    const dir = mkdtempSync(join(tmpdir(), 'bp167-057-accept-gravity-'));
    try {
      const outcome = depositMethodologyEblet({
        demandKind: 'COMPUTE',
        methodId: 'methods.arithmetic_cascade.arithmeticCascadeMethod',
        whatItDoes: 'Applies free-fall kinematics using the standard gravitational acceleration constant.',
        taughtBy: 'Standard kinematics, not a per-item derivation.',
        qid: null,
        runId: 'test', dispatchId: 'D-BP167-M0-057',
        hexConnector: 'PROOF', hexConnectorJustification: 'test fixture',
        sessionLabel: 'BP167', model: 'test-model', filedBy: 'D-BP167-M0-057',
        constants: [
          { symbol: 'g', value: 9.81, unit: 'm/s^2', source: 'CODATA standard gravitational acceleration constant' },
        ],
        dir,
      });
      expect(outcome.ok).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('accepts_pythagorean_relation_with_no_computed_values', () => {
    // MUST STILL BE ACCEPTED. Case 3b of the seven-case table. A genuine formula stated with only
    // single-letter variables and single-digit exponents, no computed values, no adjacent
    // digit-operator-digit shape, no decimal, no bare 2+ digit integer. If this starts failing, the
    // value-shaped guard has been widened past formulas into refusing algebra itself.
    const dir = mkdtempSync(join(tmpdir(), 'bp167-057-accept-pythagorean-'));
    try {
      const outcome = depositMethodologyEblet({
        demandKind: 'COMPUTE',
        methodId: 'methods.arithmetic_cascade.arithmeticCascadeMethod',
        whatItDoes: 'Uses the Pythagorean relation a^2 + b^2 = c^2 to resolve a COMPUTE demand for a right triangle side.',
        taughtBy: 'Standard Euclidean geometry, not a per-item derivation.',
        qid: null,
        runId: 'test', dispatchId: 'D-BP167-M0-057',
        hexConnector: 'PROOF', hexConnectorJustification: 'test fixture',
        sessionLabel: 'BP167', model: 'test-model', filedBy: 'D-BP167-M0-057',
        dir,
      });
      expect(outcome.ok).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects_explicit_answer_key_passage', () => {
    // MUST BE REJECTED. Case 1 of the seven-case table. An obvious answer-key-shaped statement --
    // "the correct answer is ..." -- must never be admitted through whatItDoes, no matter how it
    // is dressed up. This is the guard's most basic job; it must never regress.
    const dir = mkdtempSync(join(tmpdir(), 'bp167-057-reject-answer-key-'));
    try {
      const outcome = depositMethodologyEblet({
        demandKind: 'COMPUTE',
        methodId: 'methods.arithmetic_cascade.arithmeticCascadeMethod',
        whatItDoes: 'The correct answer is 250000 * 0.21, which equals 52500.',
        taughtBy: 'test fixture',
        qid: null,
        runId: 'test', dispatchId: 'D-BP167-M0-057',
        hexConnector: 'PROOF', hexConnectorJustification: 'test fixture',
        sessionLabel: 'BP167', model: 'test-model', filedBy: 'D-BP167-M0-057',
        dir,
      });
      expect(outcome.ok).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects_bare_arithmetic_in_free_prose', () => {
    // MUST BE REJECTED. Case 3 of the seven-case table -- the value-shaped gap D-BP165-M0-010
    // closed. No answer-declaring phrase at all, just a bare arithmetic expression sitting in
    // ordinary prose. A phrase-only guard would miss this; the value-shaped guard must not.
    const dir = mkdtempSync(join(tmpdir(), 'bp167-057-reject-bare-arithmetic-'));
    try {
      const outcome = depositMethodologyEblet({
        demandKind: 'COMPUTE',
        methodId: 'methods.arithmetic_cascade.arithmeticCascadeMethod',
        whatItDoes: 'Applies the formula 250000 * 0.21 to resolve a percentage-of-total demand shape.',
        taughtBy: 'test fixture',
        qid: null,
        runId: 'test', dispatchId: 'D-BP167-M0-057',
        hexConnector: 'PROOF', hexConnectorJustification: 'test fixture',
        sessionLabel: 'BP167', model: 'test-model', filedBy: 'D-BP167-M0-057',
        dir,
      });
      expect(outcome.ok).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects_named_constant_with_item_shaped_denylisted_symbol', () => {
    // MUST BE REJECTED. Case 4 of the seven-case table. A "constant" whose symbol is on
    // ITEM_SHAPED_SYMBOL_DENYLIST (answer/result/total/balance/verdict/solution/outcome/payoff/
    // amount/sum/value/price/cost) is refused regardless of its value or its citation -- the
    // symbol alone is the tell.
    const dir = mkdtempSync(join(tmpdir(), 'bp167-057-reject-denylisted-symbol-'));
    try {
      const outcome = depositMethodologyEblet({
        demandKind: 'COMPUTE',
        methodId: 'methods.arithmetic_cascade.arithmeticCascadeMethod',
        whatItDoes: 'Applies a standard percentage-of-total demand resolution method.',
        taughtBy: 'test fixture',
        qid: null,
        runId: 'test', dispatchId: 'D-BP167-M0-057',
        hexConnector: 'PROOF', hexConnectorJustification: 'test fixture',
        sessionLabel: 'BP167', model: 'test-model', filedBy: 'D-BP167-M0-057',
        constants: [{ symbol: 'answer', value: 42, source: 'standard convention value' }],
        dir,
      });
      expect(outcome.ok).toBe(false);
      if (outcome.ok) return;
      expect(outcome.leaks && outcome.leaks.some((l) => l.includes('denylist'))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects_real_constant_written_into_free_prose_over_block_by_design', () => {
    // MUST BE REJECTED. Case 6 of the seven-case table -- the deliberate over-block. A real
    // constant (g = 9.81 m/s^2) written directly into free prose, NOT through the structured
    // `constants` channel, is still refused. This is BY DESIGN ("either the formulation is made
    // smarter, or the deposit is withheld and reported -- never weaken"): the sanctioned way to
    // admit a real constant is the constants channel (see the accept test above), never free text.
    // If this test starts failing, the prose guard has been loosened, not sharpened.
    const dir = mkdtempSync(join(tmpdir(), 'bp167-057-reject-constant-in-prose-'));
    try {
      const outcome = depositMethodologyEblet({
        demandKind: 'COMPUTE',
        methodId: 'methods.arithmetic_cascade.arithmeticCascadeMethod',
        whatItDoes: 'Applies free-fall kinematics using g = 9.81 m/s^2 as the standard gravitational acceleration.',
        taughtBy: 'test fixture',
        qid: null,
        runId: 'test', dispatchId: 'D-BP167-M0-057',
        hexConnector: 'PROOF', hexConnectorJustification: 'test fixture',
        sessionLabel: 'BP167', model: 'test-model', filedBy: 'D-BP167-M0-057',
        dir,
      });
      expect(outcome.ok).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects_bare_multidigit_convention_number_in_free_prose', () => {
    // MUST BE REJECTED. Case 7 of the seven-case table -- the same deliberate over-block as case 6,
    // for a named-convention integer instead of a decimal constant. "A 360-day year" written
    // directly into free prose is still refused; the constants channel is the sanctioned way in.
    const dir = mkdtempSync(join(tmpdir(), 'bp167-057-reject-convention-number-'));
    try {
      const outcome = depositMethodologyEblet({
        demandKind: 'COMPUTE',
        methodId: 'methods.arithmetic_cascade.arithmeticCascadeMethod',
        whatItDoes: 'Uses a 360-day year banking convention to convert an annual rate to a daily rate.',
        taughtBy: 'test fixture',
        qid: null,
        runId: 'test', dispatchId: 'D-BP167-M0-057',
        hexConnector: 'PROOF', hexConnectorJustification: 'test fixture',
        sessionLabel: 'BP167', model: 'test-model', filedBy: 'D-BP167-M0-057',
        dir,
      });
      expect(outcome.ok).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects_authority_sounding_source_with_per_item_scope_phrase', () => {
    // MUST BE REJECTED. Case 5 of the seven-case table -- THE FLAGSHIP CASE THIS WHOLE DISPATCH
    // EXISTS FOR. A "constant" with an innocuous symbol and a source string that contains a
    // recognized authority/convention keyword ("standard", "convention") ALSO contains a
    // per-item-scope phrase ("for this problem"). Before D-BP167-M0-055 this was ACCEPTED on the
    // strength of the keyword alone -- a disguised per-item computed value could enter the silo
    // through the constants channel specifically. D-BP167-M0-055 closed it with
    // ITEM_SCOPE_PHRASE_DENYLIST, checked unconditionally regardless of authority-keyword
    // presence. This test is the permanent proof that flip stays flipped.
    const dir = mkdtempSync(join(tmpdir(), 'bp167-057-reject-authority-scope-phrase-'));
    try {
      const outcome = depositMethodologyEblet({
        demandKind: 'COMPUTE',
        methodId: 'methods.arithmetic_cascade.arithmeticCascadeMethod',
        whatItDoes: 'Applies a percentage-of-total demand resolution method.',
        taughtBy: 'test fixture',
        qid: null,
        runId: 'test', dispatchId: 'D-BP167-M0-057',
        hexConnector: 'PROOF', hexConnectorJustification: 'test fixture',
        sessionLabel: 'BP167', model: 'test-model', filedBy: 'D-BP167-M0-057',
        constants: [{ symbol: 'x', value: 52500, source: 'standard convention value for this problem' }],
        dir,
      });
      expect(outcome.ok).toBe(false);
      if (outcome.ok) return;
      expect(outcome.leaks && outcome.leaks.some((l) => l.includes('per-item-scope phrase'))).toBe(true);

      // Also assert directly against validateNamedConstant() -- the unit under test D-BP167-M0-055
      // actually changed -- so a future refactor of depositMethodologyEblet()'s wiring cannot mask
      // a regression in the validator itself.
      const direct = validateNamedConstant({ symbol: 'x', value: 52500, source: 'standard convention value for this problem' });
      expect(direct.ok).toBe(false);
      expect(direct.reasons.some((r) => r.includes('per-item-scope phrase'))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
