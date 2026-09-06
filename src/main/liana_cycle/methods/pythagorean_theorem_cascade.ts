// methods/pythagorean_theorem_cascade.ts -- D-BP168-M0-113/BISHOP-M0/seg-composer-methods
//
// FOUNDER ORDER, BP168, task t-8138911d, verbatim: "MORE METHODS FOR THE COMPOSER -- once you see
// how Compose works you understand we seriously need to make more methods."
//
// THE GAP THIS CLOSES, MEASURED, NOT GUESSED. method_selection_probe_report_D-BP168-M0-100.json
// (BISHOP_DROPZONE/D-BP163-M0-013_STAGES_2_3_4/stage3_math/olympiadbench/, 674 real OlympiadBench
// solutions, run through stage3_math_protocol_impl.js's own unmodified
// extractMethodStatementFromSolution()) found the phrase "pythagorean theorem" named in 14 real
// solutions -- the joint-highest-frequency of the 17 distinct method phrases that report found
// (tied with "permutation"). None of the four registered COMPUTE-demand methods names or teaches
// this relationship: arithmetic_cascade.ts is a local-cue-word word-problem chain (ASDiv/GSM8K
// shape, no geometry); stage3_symbolic_cascade.ts matches two narrow SYNTHETIC-GENERATOR templates
// ("Solve for x: ax+b=c", a polynomial-derivative-at-a-point) that no real OlympiadBench prose will
// ever match; compute_gemma_cascade.ts and compute_select_cascade.ts both let the model derive ANY
// single arithmetic expression with no technique-specific steering at all -- confirmed by direct
// read of all four files' own shapeTest()/run() bodies, not assumed. This file is that method.
//
// A METHOD IS TAUGHT, NOT INVENTED (canon_the_liana_cycle_is_a_method_registry_taught_by_humans_
// bp149: "the human is the generator... a method taught once is available to everyone thereafter").
// This method teaches the Pythagorean relationship to the model as a FACT via compute_sidecar.ts's
// own `componentFacts` parameter (BP137 Stage A.3, "reference facts you MAY use") -- the SAME
// mechanism the standing rule "ask a flagship once for facts/sources/methods, NEVER the answer key"
// already names. It is the first COMPUTE-demand method in this estate to actually use that
// parameter; every sibling built before it (arithmetic-cascade, stage3-symbolic-cascade,
// compute-gemma-cascade, compute-select-cascade) leaves it undefined and teaches nothing.
//
// REUSE, NOT REINVENT. This method never re-derives or forks compute_sidecar.ts's verified
// machinery: it imports computeViaModelExpression() UNCHANGED (the same two-independent-evaluator
// per-sample recompute plus N=3 agree-2-of-3 self-consistency gate every COMPUTE-gemma method in
// this estate already relies on) and hands it exactly one new ingredient its own signature already
// supported and no live caller had used yet -- `componentFacts`. compute_sidecar.ts's whitelisted
// evaluator grammar (`ARITHMETIC_WHITELIST_RE = /^[\d+\-*/^().%\s]+$/`) already expresses a square
// root as `^0.5` -- no sqrt() function is needed, added, or assumed; the taught fact says so
// explicitly so the model does not reach for a function name the evaluator would reject.
//
// THE NETWORK-CALLING ADAPTER BELOW IS A DELIBERATE, NAMED PARALLEL TO compute_gemma_cascade.ts's
// AND compute_select_cascade.ts's OWN ADAPTERS, NOT A REUSE OF EITHER -- same reason
// compute_select_cascade.ts's own header states for building its own rather than importing
// compute_gemma_cascade.ts's: those adapters are module-private consts, never exported, and this
// dispatch was not asked to touch (and does not touch) comparative_cascade.ts, compute_gemma_
// cascade.ts, or compute_select_cascade.ts. Same fetch shape, same cost-recording discipline
// (recordLlmCall, `think:false` TOP-LEVEL, num_ctx capped at GEMMA_NUM_CTX_RUN_CAP) -- reused BY
// IMPORT from comparative_cascade.ts's already-exported resolveGemmaModelDigest/
// GEMMA_NUM_CTX_RUN_CAP, not re-derived.
//
// SHAPE, NOT LOOKUP -- same discipline as every existing cascade. shapeTest() requires (a) no
// lettered option list (free-text only, the same gate every COMPUTE-demand method uses -- an MCQ
// right-triangle question is out of scope for this file, exactly as compute_gemma_cascade.ts is
// out of scope for MCQ and compute_select_cascade.ts exists as its own separate sibling for that
// shape), (b) at least one right-triangle cue phrase (hypotenuse / right triangle / right angle /
// "pythagorean"), and (c) at least two numeric literals -- the minimum needed to name two known
// quantities (two legs, or a leg and the hypotenuse). A question naming the theorem but carrying
// fewer than two numbers is refused honestly at the shape gate, never guessed.
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
// question. States the relationship, names the whitelisted-grammar way to express a square root
// (^0.5, since compute_sidecar.ts's evaluator has no sqrt() function), and nothing else.
const PYTHAGOREAN_FACT =
  'Pythagorean theorem: in a right triangle, if the two legs have lengths a and b and the '
  + 'hypotenuse has length c, then c^2 = a^2 + b^2. So the hypotenuse is (a^2 + b^2)^0.5, a leg is '
  + '(c^2 - a^2)^0.5 when the hypotenuse and the other leg are known, and a leg is (c^2 - b^2)^0.5 '
  + 'when the hypotenuse and the other leg are known. Express a square root as a power of 0.5 '
  + '(e.g. write (25)^0.5, never sqrt(25)).';

function nowIso(): string {
  return new Date().toISOString();
}

const RIGHT_TRIANGLE_CUE_RE = /\bhypotenuse\b|\bright\s+triangle\b|\bright\s+angle\b|\bpythagorean\b/i;
const NUMERIC_LITERAL_RE = /\d[\d,]*(?:\.\d+)?/g;
function countNumericLiterals(text: string): number {
  const matches = text.match(NUMERIC_LITERAL_RE);
  return matches ? matches.length : 0;
}

/** Same internal-result/adapter-splitting shape compute_gemma_cascade.ts and compute_select_
 *  cascade.ts each independently already use (see this file's own header for why this is a
 *  deliberate parallel, not a shared import). */
interface PythagoreanCallInternalResult {
  ok: boolean;
  text: string | null;
  doneReason: string | null;
  failureKind?: 'transport_error' | 'http_error' | 'empty_response';
  detail?: string;
}

async function pythagoreanCallModelInternal(
  prompt: string,
  ollamaBaseUrl: string,
  model: string,
  temperature: number,
  numPredict: number,
): Promise<PythagoreanCallInternalResult> {
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

const pythagoreanCallModel: ModelCallFn = async (prompt, ollamaBaseUrl, model, temperature, numPredict) => {
  const r = await pythagoreanCallModelInternal(prompt, ollamaBaseUrl, model, temperature, numPredict);
  return r.ok ? (r.text as string) : null;
};

const pythagoreanCallModelRich: ModelCallFnRich = async (prompt, ollamaBaseUrl, model, temperature, numPredict) => {
  const r = await pythagoreanCallModelInternal(prompt, ollamaBaseUrl, model, temperature, numPredict);
  if (r.ok) return { ok: true, text: r.text as string, doneReason: r.doneReason };
  return { ok: false, failureKind: r.failureKind as 'transport_error' | 'http_error' | 'empty_response', detail: r.detail };
};

function shapeTest(input: MethodQuestionInput): ShapeTestResult {
  // NEVER reads input.correctAnswer -- matches every sibling cascade's shapeTest() signature.
  if (input.options && Object.keys(input.options).length >= 2) {
    return {
      matches: false,
      reason: 'has >=2 lettered options -- pythagorean-theorem-cascade only matches free-text questions with no option list (same gate as every free-text COMPUTE-demand method).',
    };
  }
  const question = input.question || '';
  if (!RIGHT_TRIANGLE_CUE_RE.test(question)) {
    return {
      matches: false,
      reason: 'no right-triangle cue phrase found (hypotenuse / right triangle / right angle / pythagorean) -- refuses rather than guessing this shape from bare numbers alone.',
    };
  }
  const numCount = countNumericLiterals(question);
  if (numCount < 2) {
    return {
      matches: false,
      reason: `right-triangle cue phrase found but only ${numCount} numeric literal(s) in the question text -- applying the theorem needs at least two known quantities; refuses honestly rather than guessing a missing one.`,
    };
  }
  return {
    matches: true,
    reason: `right-triangle cue phrase found and ${numCount} numeric literals present -- eligible to be taught the Pythagorean relationship (c^2 = a^2 + b^2) as a componentFact and attempt a verified derivation.`,
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
      text: `   pythagorean-theorem-cascade sample ${sample.sampleIndex + 1}: ${sample.rejection}`
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
      [PYTHAGOREAN_FACT],
      pythagoreanCallModel,
      onModelExpressionSample,
      pythagoreanCallModelRich,
    );
  } catch (e) {
    return {
      question,
      verdict: null,
      abstain: true,
      freeText: true,
      method: 'pythagorean-theorem-cascade',
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
      method: 'pythagorean-theorem-cascade',
      basis: 'REFUSES rather than guesses: no model-derived expression, taught the Pythagorean '
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
    method: 'pythagorean-theorem-cascade',
    basis: `model (${MODEL}) was taught c^2 = a^2 + b^2 as a fact (never the answer) and derived expression `
      + `"${modelResult.expression}" from the question text alone (never reads a dataset answer field); two `
      + 'independently-implemented evaluators (evaluateArithmeticVerified, compute_sidecar.ts) recomputed it '
      + `and at least 2 of 3 sampled derivations agreed on the same value within float epsilon => ${modelResult.value}.`,
  };
}

export const pythagoreanTheoremCascadeMethod: LianaMethod = {
  id: 'pythagorean-theorem-cascade',
  demand: 'COMPUTE',
  name: 'Pythagorean Theorem Cascade (model is taught c^2=a^2+b^2 as a fact, never the answer; '
    + 'derives one verified expression using ^0.5 for the square root -- reuses compute_sidecar.ts\'s '
    + 'BP137 Stage A.2/A.3 machinery unchanged)',
  taughtBy: 'D-BP168-M0-113/BISHOP-M0/seg-composer-methods. Gap measured directly from '
    + 'method_selection_probe_report_D-BP168-M0-100.json (674 real OlympiadBench solutions): '
    + '"pythagorean theorem" named in 14, the joint-highest-frequency of 17 distinct phrases found, '
    + 'with no registered COMPUTE method naming or teaching it. Founder order (task t-8138911d): '
    + '"MORE METHODS FOR THE COMPOSER." Not a single walked human case (canon rule 4) -- flagged '
    + 'here, not hidden, same disclosure convention arithmetic_cascade.ts/stage3_symbolic_cascade.ts/'
    + 'compute_gemma_cascade.ts already use for their own Founder-ordered, non-single-case builds; '
    + 'this one additionally TEACHES a named formula via componentFacts (BP137 Stage A.3), the first '
    + 'COMPUTE method in this estate to use that parameter -- its three siblings teach nothing.',
  shapeDescription: 'a free-text question (no lettered options) naming a right triangle / '
    + 'hypotenuse / right angle / the Pythagorean theorem and carrying at least two numeric '
    + 'literals -- refuses honestly (HARDWIRE-22) otherwise; the model is taught the formula as a '
    + 'fact and its derived expression is still independently recomputed and self-consistency-'
    + 'checked before ever being trusted as an answer.',
  shapeTest,
  run,
};

// Registers at import time, same convention as every other method module. Wired into
// liana_terminal_engine.ts's import list alongside the other COMPUTE-demand methods.
registerMethod(pythagoreanTheoremCascadeMethod);
