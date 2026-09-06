// withheld_curve_shift_guard.test.ts -- D-BP213-XO-47/BISHOP-XO/seg-liana-cycle-methods
//
// KORSAIKOFF GATE, ANSWERED. The only name-token match is withheld_curve_shift_guard.ts itself,
// the SUBJECT of this suite -- no existing test covers its shapeTest() at all.
// D-BP213-XO-36_LEG1_BLIND_TEST.md and D-BP213-XO-46_LEG1_DETERMINISM.md are one-off standalone
// diagnostic scripts run against a scratch compile, never wired into this repo's own vitest suite,
// so nothing catches a regression here automatically. That gap is exactly what let the SAME bug
// (SUBPART_LABEL_RE requiring a literal opening paren) survive a full re-aim of this file: XO-41
// copied the regex from the disabled anchored_lookup_guard.ts verbatim while its own header
// claimed the helpers were independently written, and nothing ran to catch it until XO-46
// diagnosed it by hand days later. This file exists so that can never happen silently again.
//
// THE GUARD THIS FILE ADDS: shapeTest() MUST return matches:true on this method's own founding
// example -- dataset question_id 46 (bundled mnemosyne corpus) / source_id "7260" (full MMLU-Pro
// curated corpus), answer key G. A method that cannot fire on the question it was carved from is
// broken, full stop; this is the literal case D-BP213-XO-46_LEG1_DETERMINISM.md found failing
// before the D-BP213-XO-47 fix below.
//
// electron is mocked on the same pattern as method_tree_switch.test.ts / auto_update_scheduler.
// trust_root.test.ts. It is never actually reached by shapeTest() (a pure, no-I/O function) -- the
// mock throws if anything ever does reach it, so a regression that pulls Electron into this code
// path fails loudly instead of silently.

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('electron', () => ({
  app: { getPath: () => { throw new Error('app.getPath must never be reached by shapeTest()'); }, isPackaged: false },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: class {},
}));

import { withheldCurveShiftGuardMethod, __xo48TestHooks } from './withheld_curve_shift_guard';
import type { MethodQuestionInput } from '../method_registry';

const { findCausalSplit, CAUSAL_CONNECTORS } = __xo48TestHooks;

const letter = (i: number): string => String.fromCharCode(65 + i);

function loadQuestionId46(): MethodQuestionInput {
  const bundlePath = join(__dirname, '..', '..', '..', '..', 'resources', 'mmlu_pro_bundled', 'questions.jsonl');
  const rows = readFileSync(bundlePath, 'utf-8')
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as { question_id: number; source_id: string; question: string; options: string[]; answer: string });
  const row = rows.find((r) => r.question_id === 46);
  if (!row) throw new Error('question_id 46 not found in resources/mmlu_pro_bundled/questions.jsonl -- fixture missing, cannot run this guard');
  expect(row.source_id).toBe('7260');
  expect(row.answer).toBe('G');
  const options: Record<string, string> = {};
  row.options.forEach((o, i) => { options[letter(i)] = o; });
  return { question: row.question, options, qid: row.question_id, correctAnswer: row.answer };
}

describe('withheld_curve_shift_guard.ts shapeTest() -- founding example regression guard', () => {
  it('matches its own founding example, dataset question_id 46 / source_id 7260', () => {
    const input = loadQuestionId46();
    const result = withheldCurveShiftGuardMethod.shapeTest(input);
    expect(result.matches, `shapeTest refused on its own founding example: ${result.reason}`).toBe(true);
  });

  it('rejects a same-shaped question whose stem lacks sub-part labels entirely', () => {
    const input: MethodQuestionInput = {
      question: 'Indicate whether the following economic events represent a change in supply or a change in quantity supplied, with no sub-parts stated at all.',
      options: {
        A: 'Change in supply, Change in supply',
        B: 'Change in quantity supplied, Change in quantity supplied',
      },
      qid: -1,
      correctAnswer: 'A',
    };
    const result = withheldCurveShiftGuardMethod.shapeTest(input);
    expect(result.matches).toBe(false);
  });

  it('rejects a compound stem whose option vocabulary is not a clean supply/demand family (no widening)', () => {
    const input: MethodQuestionInput = {
      question: 'a) Something happens to a good. b) Something else happens to the same good.',
      options: {
        A: 'a) 5 dollars, b) 10 dollars',
        B: 'a) 10 dollars, b) 5 dollars',
      },
      qid: -2,
      correctAnswer: 'A',
    };
    const result = withheldCurveShiftGuardMethod.shapeTest(input);
    expect(result.matches).toBe(false);
  });
});

// D-BP213-XO-58 -- causal-connector antecedent/consequent split, unit-tested in isolation (pure, no
// model call, no I/O). See D-BP213-XO-54_ABSTENTION_FORENSICS.md for the diagnosis this closes: the
// CHANGE gate abstained 11/20 on sub-part (b) of this method's own founding example because it asked
// gemma2:2b to judge which of two named price events was causally primary -- a HARDWIRE-22 violation.
// findCausalSplit() replaces that judgment with a literal, closed-list connector search.
describe('withheld_curve_shift_guard.ts findCausalSplit() -- D-BP213-XO-58 causal-connector split', () => {
  it('splits sub-part (a) of the founding example on "Therefore," (question_id 7260 / internal qid 46)', () => {
    const clause = "a) Cold weather in Florida destroys a great deal of the orange crop. Therefore there are fewer oranges in the country's supermarkets.";
    const result = findCausalSplit(clause);
    expect(result).not.toBeNull();
    expect(result).not.toBe('ambiguous');
    const split = result as { connector: string; antecedent: string; consequent: string };
    expect(split.connector).toBe('therefore');
    expect(split.antecedent).toBe('a) Cold weather in Florida destroys a great deal of the orange crop');
    expect(split.consequent.toLowerCase().startsWith('therefore')).toBe(true);
  });

  it('splits sub-part (b) of the founding example on "As a result," -- the exact gate that stalled 11/20 in XO-54', () => {
    const clause = 'b) The cost of limes increase. As a result, bar owners raise the price of gin and tonics.';
    const result = findCausalSplit(clause);
    expect(result).not.toBeNull();
    expect(result).not.toBe('ambiguous');
    const split = result as { connector: string; antecedent: string; consequent: string };
    expect(split.connector).toBe('as a result');
    expect(split.antecedent).toBe('b) The cost of limes increase');
    expect(split.consequent.toLowerCase().startsWith('as a result')).toBe(true);
    expect(split.consequent.toLowerCase()).toContain('gin and tonics');
  });

  it('splits sub-part (c) of the founding example on "This induces"', () => {
    const clause = 'c) The price of leather shoes goes up. This induces manufacturers of leather shoes to increase production.';
    const result = findCausalSplit(clause);
    expect(result).not.toBeNull();
    expect(result).not.toBe('ambiguous');
    const split = result as { connector: string; antecedent: string; consequent: string };
    expect(split.connector).toBe('this induces');
    expect(split.antecedent).toBe('c) The price of leather shoes goes up');
  });

  it('returns null (fall back to the pre-existing model-menu CHANGE flow) when no connector is present', () => {
    const clause = 'd) The price of widgets goes up because demand rose sharply last quarter.';
    expect(findCausalSplit(clause)).toBeNull();
  });

  it('does NOT false-trigger on an ordinary possessive apostrophe with no real connector present', () => {
    // Regression guard: a naive quote-character counter that treats a bare apostrophe as a quote
    // mark would see the apostrophe in "country's" and could misfire. There is no connector in this
    // clause at all, so this must return null, not 'ambiguous'.
    const clause = "The country's supermarkets raised prices last month.";
    expect(findCausalSplit(clause)).toBeNull();
  });

  it('abstains (returns "ambiguous") when two distinct connectors both match the same clause', () => {
    const clause = 'The cost of limes rises. Therefore bar prices rise. As a result, sales fall.';
    expect(findCausalSplit(clause)).toBe('ambiguous');
  });

  it('abstains (returns "ambiguous") when the same connector appears twice in one clause', () => {
    const clause = 'Costs rise. Therefore prices rise. Wages also rise. Therefore demand falls.';
    expect(findCausalSplit(clause)).toBe('ambiguous');
  });

  it('abstains (returns "ambiguous") when the one connector match sits inside an opened double-quote', () => {
    const clause = 'The report states "costs rose. As a result, prices rose" according to the analyst.';
    expect(findCausalSplit(clause)).toBe('ambiguous');
  });

  it('does not treat a connector as inside a quote when the clause carries balanced (closed) double quotes entirely before it', () => {
    const clause = 'The analyst said "costs rose sharply". Therefore prices rose.';
    const result = findCausalSplit(clause);
    expect(result).not.toBe('ambiguous');
    expect(result).not.toBeNull();
  });
});

// D-BP213-XO-65 -- "so that" REMOVED from CAUSAL_CONNECTORS. XO-63's whole-corpus detection sweep
// (BISHOP_DROPZONE\D-BP213-XO-63_connector_sweep_results.json) flagged question_id 179 and
// question_id 121 (both business) as clean false positives: in both, "so that" is the mathematical
// "such that" sense, not causation, and a causal antecedent/consequent split on either is nonsense.
// This dispatch re-pulled all 103 "so that" single-connector rows in the full corpus and found no
// literal structural rule (adjacent equation, preceding comma, category) that reliably separates
// that sense from the genuine purpose/causal sense ("gave warning so that nobody would be injured")
// also present in the same 103 rows -- so the connector was removed outright rather than guarded.
// These two tests are the negative-case regression: findCausalSplit() must return null (no
// connector match at all) on the exact clause text from both flagged questions, so the pre-existing
// model-menu CHANGE flow runs unchanged on them rather than a code-resolved nonsense split.
describe('withheld_curve_shift_guard.ts findCausalSplit() -- D-BP213-XO-65 "so that" removed, question_id 179/121 negative cases', () => {
  it('does NOT match "so that" as a causal connector on question_id 179 (mathematical "such that": "P =ar+bW")', () => {
    const clause = 'It has been found that hours of recreation (r) and wages (W) have a direct effect on productivity (P), so that : P =ar+bW.';
    expect(findCausalSplit(clause)).toBeNull();
  });

  it('does NOT match "so that" as a causal connector on question_id 121 (mathematical "such that": "the desired change is 100")', () => {
    const clause = 'Suppose that full employment level of income is 600, so that the desired change is 100.';
    expect(findCausalSplit(clause)).toBeNull();
  });

  it('CAUSAL_CONNECTORS no longer contains "so that"', () => {
    expect(CAUSAL_CONNECTORS).not.toContain('so that');
  });

  it('CAUSAL_CONNECTORS still contains "this induces" (kept -- unambiguous causal verb, not polysemous like "so that", despite appearing exactly once in the full 12,032-row corpus)', () => {
    expect(CAUSAL_CONNECTORS).toContain('this induces');
  });
});
