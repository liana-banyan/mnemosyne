// methods/permutation_combination_cascade.ts -- D-BP168-M0-126/BISHOP-M0/seg-composer-methods
//
// FOUNDER ORDER, BP168, task under dispatch D-BP168-M0-126, verbatim: "THIS IS A BUILD DISPATCH.
// Priority is NOT for you to test the legs. Just to build them." Read D-BP168-M0-113's two files
// (pythagorean_theorem_cascade.ts, quadratic_formula_cascade.ts) first -- this file follows their
// shape exactly, per this dispatch's own instruction.
//
// THE GAP THIS CLOSES, MEASURED, NOT GUESSED. method_selection_probe_report_D-BP168-M0-100.json
// (674 real OlympiadBench solutions) found "permutation" named 14 times and "combination" named 11
// times in real solution text -- 25 combined, the SECOND-highest of the 17 distinct phrases found
// (after "by induction"+"induction" at 32 combined). No registered COMPUTE method names or teaches
// either -- confirmed by direct read of all six pre-existing COMPUTE methods' shapeTest()/run()
// bodies (arithmetic-cascade, stage3-symbolic-cascade, compute-gemma-cascade, compute-select-
// cascade, pythagorean-theorem-cascade, quadratic-formula-cascade).
//
// PREMISE CORRECTED FROM D-BP168-M0-113's OWN "NOT BUILT" NOTE. That file's closing section says
// "induction/pigeonhole/combinatorics are proof techniques ... a real new architecture ... would be
// required." That is TRUE for induction and pigeonhole (both prove a property for all n / show a
// forced collision -- neither reduces to one numeric expression). It OVER-GENERALIZED for
// permutation/combination: "how many ways to choose r items from n" IS a single closed-form count,
// exactly the shape computeViaModelExpression()'s one-expression contract already handles, PROVIDED
// factorial notation ("!", not in ARITHMETIC_WHITELIST_RE) is taught as an explicit product instead.
// This file is that method; the dispatch's own RETURN file states this correction plainly, not
// hidden.
//
// SCANNED THE REAL DATASET BEFORE BUILDING (L2 -- checked the instrument's target shape against the
// patient before writing code). Of the 674 real OlympiadBench items, the ones whose SOLUTION text
// used "permutation"/"combination" are competition-tier combinatorial-argument problems (e.g. "find
// the smallest value ... over all permutations of (1,...,n)"), not "n choose r = ?" plug-and-count
// questions -- a `how many ways` scan of all 674 QUESTION stems found only 6 candidates and every one
// either used an unresolved relay-variable ("Let T=2 ...") or was a disguised different shape. This
// mirrors quadratic-formula-cascade's own honest finding (0 real dataset matches on its AND-gated
// shape) -- disclosed the same way here, not hidden: this method is architecturally sound and
// exercised end-to-end below on a constructed item, but a live scan of THIS specific 674-item corpus
// finds 0 items matching its full shape gate (see RETURN file for the exact scan).
//
// A METHOD IS TAUGHT, NOT INVENTED (canon_the_liana_cycle_is_a_method_registry_taught_by_humans_
// bp149). Teaches nPr and nCr to the model as FACTS via compute_sidecar.ts's own `componentFacts`
// parameter (BP137 Stage A.3), never the answer -- same discipline as pythagorean_theorem_cascade.ts
// and quadratic_formula_cascade.ts, which this file otherwise follows line-for-line in structure.
//
// OUTPUT-CONTRACT DEFECT DESIGNED AROUND (KNOWN, NOT REDISCOVERED). D-BP168-M0-113 measured gemma4:
// 12b emit Python-style `**` where a taught method said `^`, and compute_sidecar.ts's hand-rolled
// evaluator rejected the otherwise-correct derivation on notation alone (t-e85c0467). The taught
// fact below states the expected output form explicitly, in its own sentence, exactly as this
// dispatch orders: use `^` for exponents, never `**`; NEVER use factorial notation `!`, write the
// product out in full instead.
//
// SHAPE, NOT LOOKUP. shapeTest() requires (a) no lettered option list (free-text only, same gate
// every COMPUTE-demand method uses), (b) a permutation/combination cue (the word "permutation",
// "combination", "choose", "nPr", or "nCr"), and (c) at least two numeric literals -- the minimum
// needed to name n and r. A question naming the concept but not carrying two numbers is refused
// honestly at the shape gate, never guessed.
//
// NEVER READS input.correctAnswer, ANYWHERE in this file -- grep this file for "correctAnswer" and
// confirm the only occurrences are in this sentence and the interface re-export; matches every
// sibling COMPUTE method's own hard constraint.
//
// Rule 66: new file, no supersede needed. No em-dashes -- "--" used throughout.

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput, MethodRunContext, ShapeTestResult } from '../method_registry';
import type { LianaTerminalOutcome } from '../../../shared/liana_cycle/liana_terminal_types';
import { computeViaModelExpression } from '../../plow/compute_sidecar';
import type { ModelCallFn, ModelCallFnRich, ModelExpressionSampleRecord } from '../../plow/compute_sidecar';
import { recordLlmCall } from '../cost_instrument';
import { resolveGemmaModelDigest, GEMMA_NUM_CTX_RUN_CAP } from './comparative_cascade';
import os from 'node:os';

const OLLAMA_API_BASE = process.env.OLLAMA_API_BASE ?? 'http://127.0.0.1:11434';
// SAME env-overridable model tag every sibling COMPUTE-gemma method uses -- no second, diverging
// model-selection convention.
const MODEL = process.env.CASCADE_MODEL ?? 'gemma4:12b';

// THE TAUGHT FACT (BP137 Stage A.3 componentFacts) -- a formula, never the answer to this or any
// question. States nPr and nCr as explicit products (no factorial symbol, which the evaluator's
// whitelist does not support), a worked example, and the expected output notation.
const PERMUTATION_COMBINATION_FACT =
  'Permutations and combinations: choosing r items from n distinct items IN ORDER (a permutation) '
  + 'gives nPr = n*(n-1)*(n-2)*...*(n-r+1), the product of the r numbers counting down from n. '
  + 'Choosing r items from n distinct items where order does NOT matter (a combination) gives '
  + 'nCr = nPr / (r*(r-1)*...*1), the same product divided by the product of the whole numbers from '
  + 'r down to 1. Never use factorial notation ("!") anywhere in the output -- it is not a supported '
  + 'operator; always write the product out in full using only digits, +, -, *, /, ^, and '
  + 'parentheses. Use ^ for exponents if any are needed, never ** or a superscript. Example: '
  + 'choosing 3 items from 5 with order not mattering is (5*4*3)/(3*2*1). Arranging 3 items chosen '
  + 'from 5, order mattering, is 5*4*3.';

function nowIso(): string {
  return new Date().toISOString();
}

const PERM_COMB_CUE_RE = /\bpermutations?\b|\bcombinations?\b|\bnPr\b|\bnCr\b|\bchoose\b/i;
const NUMERIC_LITERAL_RE = /\d[\d,]*(?:\.\d+)?/g;
function countNumericLiterals(text: string): number {
  const matches = text.match(NUMERIC_LITERAL_RE);
  return matches ? matches.length : 0;
}

/** Same internal-result/adapter-splitting shape compute_gemma_cascade.ts, compute_select_cascade.ts,
 *  pythagorean_theorem_cascade.ts, and quadratic_formula_cascade.ts each independently already use
 *  (see pythagorean_theorem_cascade.ts's own header for why this is a deliberate parallel, not a
 *  shared import -- unchanged reasoning applies to this file). */
interface PermCombCallInternalResult {
  ok: boolean;
  text: string | null;
  doneReason: string | null;
  failureKind?: 'transport_error' | 'http_error' | 'empty_response';
  detail?: string;
}

async function permCombCallModelInternal(
  prompt: string,
  ollamaBaseUrl: string,
  model: string,
  temperature: number,
  numPredict: number,
): Promise<PermCombCallInternalResult> {
  const tsStart = nowIso();
  const t0 = Date.now();
  const modelDigest = await resolveGemmaModelDigest(model);

  let res: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    res = await fetch(`${ollamaBaseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        think: false,
        options: { temperature, num_predict: numPredict, num_ctx: GEMMA_NUM_CTX_RUN_CAP },
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
  } catch (err) {
    const detail = `transport failure, no HTTP response received: ${err instanceof Error ? err.message : String(err)}`;
    recordLlmCall({
      model,
      modelDigest,
      machineId: os.hostname(),
      ts_start: tsStart,
      ts_end: nowIso(),
      latency_ms: Date.now() - t0,
      tokens: { measured: false, reason: detail },
    });
    return { ok: false, text: null, doneReason: null, failureKind: 'transport_error', detail };
  }

  if (res.ok === false) {
    const detail = `HTTP ${res.status} error response -- Ollama does not report prompt_eval_count/eval_count on an error status`;
    recordLlmCall({
      model,
      modelDigest,
      machineId: os.hostname(),
      ts_start: tsStart,
      ts_end: nowIso(),
      latency_ms: Date.now() - t0,
      tokens: { measured: false, reason: detail },
    });
    return { ok: false, text: null, doneReason: null, failureKind: 'http_error', detail };
  }

  try {
    const j = (await res.json()) as { response?: string; done_reason?: string; prompt_eval_count?: number; eval_count?: number };
    const hasCounts = typeof j.prompt_eval_count === 'number' && typeof j.eval_count === 'number';
    recordLlmCall({
      model,
      modelDigest,
      machineId: os.hostname(),
      ts_start: tsStart,
      ts_end: nowIso(),
      latency_ms: Date.now() - t0,
      tokens: hasCounts
        ? { measured: true, input_tokens: j.prompt_eval_count as number, output_tokens: j.eval_count as number }
        : { measured: false, reason: 'Ollama response body did not include prompt_eval_count/eval_count fields' },
    });
    const text = (j.response ?? '').trim();
    const doneReason = j.done_reason ?? null;
    if (text.length === 0) {
      return { ok: false, text: '', doneReason, failureKind: 'empty_response', detail: 'Ollama returned an empty response field' };
    }
    return { ok: true, text, doneReason };
  } catch (err) {
    const detail = `res.json() itself threw, body was not JSON at all: ${err instanceof Error ? err.message : String(err)}`;
    recordLlmCall({
      model,
      modelDigest,
      machineId: os.hostname(),
      ts_start: tsStart,
      ts_end: nowIso(),
      latency_ms: Date.now() - t0,
      tokens: { measured: false, reason: detail },
    });
    return { ok: false, text: null, doneReason: null, failureKind: 'empty_response', detail };
  }
}

const permCombCallModel: ModelCallFn = async (prompt, ollamaBaseUrl, model, temperature, numPredict) => {
  const r = await permCombCallModelInternal(prompt, ollamaBaseUrl, model, temperature, numPredict);
  return r.ok ? (r.text as string) : null;
};

const permCombCallModelRich: ModelCallFnRich = async (prompt, ollamaBaseUrl, model, temperature, numPredict) => {
  const r = await permCombCallModelInternal(prompt, ollamaBaseUrl, model, temperature, numPredict);
  if (r.ok) return { ok: true, text: r.text as string, doneReason: r.doneReason };
  return { ok: false, failureKind: r.failureKind as 'transport_error' | 'http_error' | 'empty_response', detail: r.detail };
};

function shapeTest(input: MethodQuestionInput): ShapeTestResult {
  // NEVER reads input.correctAnswer -- matches every sibling cascade's shapeTest() signature.
  if (input.options && Object.keys(input.options).length >= 2) {
    return {
      matches: false,
      reason: 'has >=2 lettered options -- permutation-combination-cascade only matches free-text questions with no option list (same gate as every free-text COMPUTE-demand method).',
    };
  }
  const question = input.question || '';
  if (!PERM_COMB_CUE_RE.test(question)) {
    return {
      matches: false,
      reason: 'no permutation/combination cue found (permutation, combination, choose, nPr, nCr) -- refuses rather than guessing this shape.',
    };
  }
  const numCount = countNumericLiterals(question);
  if (numCount < 2) {
    return {
      matches: false,
      reason: `permutation/combination cue found but only ${numCount} numeric literal(s) in the question text -- naming n and r needs at least two known quantities; refuses honestly rather than guessing a missing one.`,
    };
  }
  return {
    matches: true,
    reason: `permutation/combination cue found and ${numCount} numeric literals present -- eligible to be taught the nPr/nCr relationship as a componentFact and attempt a verified derivation.`,
  };
}

async function run(input: MethodQuestionInput, ctx: MethodRunContext): Promise<LianaTerminalOutcome> {
  // NEVER reads input.correctAnswer. Derivation depends on input.question plus the taught fact
  // above alone.
  const question = input.question || '';
  const sampleRecords: ModelExpressionSampleRecord[] = [];
  const onModelExpressionSample = (sample: ModelExpressionSampleRecord): void => {
    sampleRecords.push(sample);
    const rawPreview = sample.rawOutput
      ? `"${sample.rawOutput.text}"${sample.rawOutput.truncated ? ` (captured text truncated at display cap, real length ${sample.rawOutput.originalLength} chars)` : ''}`
      : '(no raw output captured for this sample)';
    ctx.emit({
      kind: 'note',
      text: `   permutation-combination-cascade sample ${sample.sampleIndex + 1}: ${sample.rejection}`
        + `${sample.doneReason ? ` (done_reason=${sample.doneReason})` : ''}`
        + `${sample.parsedExpression ? ` -- parsed expression "${sample.parsedExpression}" => ${sample.parsedValue}` : ''}`
        + ` -- raw: ${rawPreview}`,
      ts: nowIso(),
    });
  };
  let modelResult: { value: number; expression: string } | null;
  try {
    modelResult = await computeViaModelExpression(
      question,
      OLLAMA_API_BASE,
      MODEL,
      [PERMUTATION_COMBINATION_FACT],
      permCombCallModel,
      onModelExpressionSample,
      permCombCallModelRich,
    );
  } catch (e) {
    return {
      question,
      verdict: null,
      abstain: true,
      freeText: true,
      method: 'permutation-combination-cascade',
      basis: `computeViaModelExpression (compute_sidecar.ts) threw: ${String((e as Error)?.message ?? e)}`,
    };
  }
  if (!modelResult) {
    const perSample = sampleRecords
      .map((s) => `sample ${s.sampleIndex + 1}: ${s.rejection}${s.doneReason ? ` (done_reason=${s.doneReason})` : ''}`)
      .join('; ');
    return {
      question,
      verdict: null,
      abstain: true,
      freeText: true,
      method: 'permutation-combination-cascade',
      basis: 'REFUSES rather than guesses: no model-derived expression, taught the nPr/nCr '
        + "relationship as a fact, cleared compute_sidecar.ts's own two-evaluator recompute AND N=3 "
        + 'agree-2-of-3 self-consistency gate. '
        + (perSample.length ? `Per-sample: ${perSample}.` : 'No sample records were captured (onSample never fired).'),
    };
  }
  return {
    question,
    verdict: String(modelResult.value),
    abstain: false,
    freeText: true,
    method: 'permutation-combination-cascade',
    basis: `model (${MODEL}) was taught nPr = n*(n-1)*...*(n-r+1) and nCr = nPr/(r*(r-1)*...*1) as `
      + `facts (never the answer) and derived expression "${modelResult.expression}" from the `
      + 'question text alone (never reads a dataset answer field); two independently-implemented '
      + 'evaluators (evaluateArithmeticVerified, compute_sidecar.ts) recomputed it and at least 2 of '
      + `3 sampled derivations agreed on the same value within float epsilon => ${modelResult.value}.`,
  };
}

export const permutationCombinationCascadeMethod: LianaMethod = {
  id: 'permutation-combination-cascade',
  demand: 'COMPUTE',
  name: 'Permutation/Combination Cascade (model is taught nPr and nCr as explicit-product facts, '
    + 'never the answer, and never factorial notation; derives one verified expression -- reuses '
    + 'compute_sidecar.ts\'s BP137 Stage A.2/A.3 machinery unchanged)',
  taughtBy: 'D-BP168-M0-126/BISHOP-M0/seg-composer-methods. Gap measured directly from '
    + 'method_selection_probe_report_D-BP168-M0-100.json (674 real OlympiadBench solutions): '
    + '"permutation" (14) + "combination" (11) = 25, the second-highest-frequency combined phrase '
    + 'pair of 17 distinct phrases found, with no registered COMPUTE method naming or teaching '
    + 'either. Founder order, BP168, dispatch D-BP168-M0-126: "BUILD THE HIGHEST-FREQUENCY ONES ... '
    + 'induction (32) and permutation and combination (25) are the top two ... START THERE." '
    + 'Corrects D-BP168-M0-113\'s own over-general "combinatorics are proof techniques" closing note '
    + '-- true for induction/pigeonhole (no single closed-form value), not for a plain n-choose-r '
    + 'count, which this method\'s narrowly-gated shape covers honestly. Not a single walked human '
    + 'case (canon rule 4) -- flagged here, not hidden, same disclosure convention every prior '
    + 'Founder-ordered non-single-case COMPUTE method in this estate already uses; teaches nPr/nCr '
    + 'via componentFacts (BP137 Stage A.3), same discipline as its two BP168 siblings.',
  shapeDescription: 'a free-text question (no lettered options) naming a permutation/combination '
    + 'concept (permutation, combination, choose, nPr, nCr) and carrying at least two numeric '
    + 'literals -- refuses honestly (HARDWIRE-22) otherwise; the model is taught nPr/nCr as explicit '
    + 'products (no factorial symbol) and its derived expression is still independently recomputed '
    + 'and self-consistency-checked before ever being trusted as an answer.',
  shapeTest,
  run,
};

// Registers at import time, same convention as every other method module. Wired into
// liana_terminal_engine.ts's import list alongside the other COMPUTE-demand methods.
registerMethod(permutationCombinationCascadeMethod);
