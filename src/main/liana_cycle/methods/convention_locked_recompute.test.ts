// convention_locked_recompute.test.ts -- D-BP213-XO-56/BISHOP-XO/seg-liana-cycle-methods
//
// KORSAIKOFF GATE, ANSWERED. The only name-token match is convention_locked_recompute.ts itself,
// the SUBJECT of this suite -- no existing test covers its shapeTest() at all.
//
// THE GUARD THIS FILE ADDS, per the LEG 4 dispatch order ("ADD A VITEST ASSERTING shapeTest FIRES
// ON question_id 791 (internal qid 20)"): shapeTest() MUST return matches:true on this method's
// own founding example -- dataset question_id 791 (bundled mnemosyne corpus internal qid 20),
// answer key J, $103.00. withheld_curve_shift_guard.ts shipped broken twice for want of exactly
// this regression guard (see that file's own test header); this file exists so the same class of
// silent breakage cannot happen here.
//
// electron is mocked on the same pattern as withheld_curve_shift_guard.test.ts / set_equivalence_
// match.test.ts. It is never actually reached by shapeTest() or the pure arithmetic helpers (no
// I/O) -- the mock throws if anything ever does reach it, so a regression that pulls Electron into
// this code path fails loudly instead of silently.

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('electron', () => ({
  app: { getPath: () => { throw new Error('app.getPath must never be reached by shapeTest() or the pure arithmetic helpers'); }, isPackaged: false },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: class {},
}));

import { conventionLockedRecomputeMethod, __xo56TestHooks } from './convention_locked_recompute';
import type { MethodQuestionInput } from '../method_registry';

const {
  findConventionLockSentence,
  extractDollarClauses,
  extractRateClauses,
  firstDollarAmount,
  firstRatePercent,
  buildDecliningBalanceSchedule,
  scheduleTotal,
  independentRecompute,
  normalizeMoney,
} = __xo56TestHooks;

const letter = (i: number): string => String.fromCharCode(65 + i);

function loadQuestionId791(): MethodQuestionInput {
  const bundlePath = join(__dirname, '..', '..', '..', '..', 'resources', 'mmlu_pro_bundled', 'questions.jsonl');
  const rows = readFileSync(bundlePath, 'utf-8')
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as { question_id: number; source_id: string; question: string; options: string[]; answer: string });
  const row = rows.find((r) => r.question_id === 20);
  if (!row) throw new Error('internal qid 20 not found in resources/mmlu_pro_bundled/questions.jsonl -- fixture missing, cannot run this guard');
  expect(row.source_id).toBe('791');
  expect(row.answer).toBe('J');
  const options: Record<string, string> = {};
  row.options.forEach((o, i) => { options[letter(i)] = o; });
  return { question: row.question, options, qid: row.question_id, correctAnswer: row.answer };
}

describe('convention_locked_recompute.ts shapeTest() -- founding example regression guard', () => {
  it('matches its own founding example, dataset question_id 791 / internal qid 20', () => {
    const input = loadQuestionId791();
    const result = conventionLockedRecomputeMethod.shapeTest(input);
    expect(result.matches, `shapeTest refused on its own founding example: ${result.reason}`).toBe(true);
  });

  it('rejects a rate mention with no declining-balance cue at all', () => {
    const input: MethodQuestionInput = {
      question: 'A savings account earns 5% interest per year. What is the balance after 3 years?',
      options: { A: '$100.00', B: '$110.00' },
      qid: -1,
    };
    const result = conventionLockedRecomputeMethod.shapeTest(input);
    expect(result.matches).toBe(false);
  });

  it('rejects a declining-balance cue with no rate/percentage token in the same sentence', () => {
    const input: MethodQuestionInput = {
      question: 'He pays down the loan on the unpaid balance. Later, a fee of 2% is charged separately.',
      options: { A: '$100.00', B: '$110.00' },
      qid: -1,
    };
    const result = conventionLockedRecomputeMethod.shapeTest(input);
    expect(result.matches).toBe(false);
  });

  it('rejects when no lettered options are present', () => {
    const input: MethodQuestionInput = {
      question: 'Mr.Scaccioborrows $100 from his credit union and agrees to pay back $20 a month with interest of 1% per month on the unpaid balance. How much does he pay?',
      options: null,
      qid: -1,
    };
    const result = conventionLockedRecomputeMethod.shapeTest(input);
    expect(result.matches).toBe(false);
  });

  it('matches the "declining balance method" wording variant (question_id 539 shape)', () => {
    const input: MethodQuestionInput = {
      question: 'A firm charges depreciation on its typewriters at the rate of 15% per year on the declining balance method.',
      options: { A: '$100.00', B: '$110.00' },
      qid: -1,
    };
    const result = conventionLockedRecomputeMethod.shapeTest(input);
    expect(result.matches, result.reason).toBe(true);
  });
});

describe('convention_locked_recompute.ts pure helpers -- deterministic, no I/O', () => {
  it('findConventionLockSentence locates the exact clause on the founding example', () => {
    const q = 'Mr.Scaccioborrows $100 from his credit union and agrees to pay back $20 a month with interest of 1% per month on the unpaid balance. How much does he pay?';
    const sentence = findConventionLockSentence(q);
    expect(sentence).not.toBeNull();
    expect(sentence).toContain('on the unpaid balance');
  });

  it('extractDollarClauses and extractRateClauses only return literal substrings containing the right token', () => {
    const q = 'Mr.Scaccioborrows $100 from his credit union and agrees to pay back $20 a month with interest of 1% per month on the unpaid balance. How much does he pay?';
    const dollarClauses = extractDollarClauses(q);
    expect(dollarClauses.length).toBeGreaterThan(0);
    for (const c of dollarClauses) {
      expect(q.toLowerCase().replace(/\s+/g, ' ')).toContain(c.toLowerCase().replace(/\s+/g, ' '));
      expect(/\$/.test(c)).toBe(true);
    }
    const rateClauses = extractRateClauses(q);
    expect(rateClauses.length).toBeGreaterThan(0);
    for (const c of rateClauses) {
      expect(q.toLowerCase().replace(/\s+/g, ' ')).toContain(c.toLowerCase().replace(/\s+/g, ' '));
      expect(/%/.test(c) || /percent/i.test(c)).toBe(true);
    }
  });

  it('firstDollarAmount and firstRatePercent parse literal spans correctly', () => {
    expect(firstDollarAmount('borrows $100 from his credit union')).toBe(100);
    expect(firstDollarAmount('pay back $20 a month')).toBe(20);
    expect(firstDollarAmount('nothing here')).toBeNull();
    expect(firstRatePercent('interest of 1% per month')).toBeCloseTo(0.01, 10);
    expect(firstRatePercent('a rate of 15 percent')).toBeCloseTo(0.15, 10);
    expect(firstRatePercent('no rate here')).toBeNull();
  });

  it('buildDecliningBalanceSchedule reproduces BM0\'s real sealed schedule exactly for the founding example', () => {
    // D-BP213-XO-56 CONVENTION CORRECTION (found live, checked against the primary record before
    // trusting it): "$20 a month" is a FIXED PRINCIPAL REDUCTION per period, interest computed on
    // the pre-reduction balance and added on top -- BM0's real sealed schedule
    // (DIDASKO_ROUND04_qid791_BM0_HALF_SEALED.md), not the spec's own flawed illustration flagged
    // in this file's header. Five clean $20 principal steps, no stub period, total $103.00 exactly.
    const rows = buildDecliningBalanceSchedule(100, 0.01, 20);
    expect(rows).not.toBeNull();
    const r = rows as NonNullable<typeof rows>;
    expect(r.length).toBe(5);
    expect(r[0].interest).toBeCloseTo(1.00, 2);
    expect(r[0].payment).toBeCloseTo(21.00, 2);
    expect(r[0].newBalance).toBeCloseTo(80.00, 2);
    expect(r[4].interest).toBeCloseTo(0.20, 2);
    expect(r[4].payment).toBeCloseTo(20.20, 2);
    expect(r[4].newBalance).toBeCloseTo(0, 2);
    expect(scheduleTotal(r)).toBeCloseTo(103.00, 2);
  });

  it('independentRecompute agrees with the schedule on the founding example (both correct)', () => {
    const rows = buildDecliningBalanceSchedule(100, 0.01, 20);
    expect(rows).not.toBeNull();
    const total = scheduleTotal(rows as NonNullable<typeof rows>);
    const independent = independentRecompute(100, 0.01, 20);
    expect(independent).not.toBeNull();
    expect(independent as number).toBeCloseTo(total, 2);
    expect(independent as number).toBeCloseTo(103.00, 2);
  });

  it('independentRecompute abstains (returns null) when principal does not divide evenly by the per-period principal step', () => {
    // A genuinely different, unresolved shape under this convention -- CANNOT DECIDE, not a guess.
    expect(independentRecompute(105, 0.01, 20)).toBeNull();
  });

  it('THE PROOF: a naive same-schedule "step 7" check is a tautology (always agrees, even when wrong); the independent recompute this file ships is not', () => {
    // The spec's own proposed step 7 (sum the schedule's own interest, confirm principal + total
    // interest = the schedule's own payment sum) is NOT implemented in production -- this test
    // proves why, using the production schedule builder itself rather than a hand-rolled example.
    // Under THIS convention, payment_i = principalPortion_i + interest_i BY CONSTRUCTION, and
    // sum(principalPortion_i) telescopes to exactly `principal` whenever the schedule resolves --
    // so sum(payment_i) = principal + sum(interest_i) ALWAYS, for ANY interest values, correct or
    // not. Inject a plausible one-line bug (a miscomputed final-period interest figure, the same
    // failure shape the historical flagship record describes) and confirm the tautology still
    // holds on the BUGGED schedule, while the REAL independent recompute (a structurally different
    // closed-form derivation, reading only principal/rate/step, never a schedule row) disagrees.
    const correctRows = buildDecliningBalanceSchedule(100, 0.01, 20) as NonNullable<ReturnType<typeof buildDecliningBalanceSchedule>>;
    const buggedFinal = { ...correctRows[4] };
    buggedFinal.interest = Math.round((buggedFinal.interest + 3.51) * 100) / 100; // a one-line slip
    buggedFinal.payment = Math.round((buggedFinal.payment + 3.51) * 100) / 100;
    const buggedSchedule = [...correctRows.slice(0, 4), buggedFinal];
    const buggedTotal = scheduleTotal(buggedSchedule);
    expect(buggedTotal).toBeCloseTo(106.51, 2); // a plausible wrong total, not even an option

    const principalPlusInterest = 100 + buggedSchedule.reduce((s, r) => s + r.interest, 0);
    expect(Math.abs(principalPlusInterest - buggedTotal)).toBeLessThan(0.01); // TAUTOLOGY: always agrees, bug included

    const independent = independentRecompute(100, 0.01, 20) as number;
    expect(Math.abs(independent - buggedTotal)).toBeGreaterThan(1); // the REAL check catches it
    expect(independent).toBeCloseTo(103.00, 2);
  });

  it('normalizeMoney parses option text the same way for the exact-match lookup', () => {
    expect(normalizeMoney('$103.00')).toBe(103.00);
    expect(normalizeMoney('$105.00')).toBe(105.00);
    expect(normalizeMoney('not a number')).toBeNull();
  });

  it('the founding example\'s computed total matches the published key exactly, never the flat-interest trap $105.00 (option G) or a near-miss', () => {
    const rows = buildDecliningBalanceSchedule(100, 0.01, 20) as NonNullable<ReturnType<typeof buildDecliningBalanceSchedule>>;
    const total = scheduleTotal(rows);
    expect(total).toBeCloseTo(103.00, 2); // matches option J exactly
    expect(Math.abs(total - 105.00)).toBeGreaterThan(1); // and is nowhere near the flat-interest trap
  });
});
