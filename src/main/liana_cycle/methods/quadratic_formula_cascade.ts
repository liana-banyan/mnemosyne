// methods/quadratic_formula_cascade.ts -- D-BP168-M0-113/BISHOP-M0/seg-composer-methods
//
// FOUNDER ORDER, BP168, task t-8138911d, verbatim: "MORE METHODS FOR THE COMPOSER -- once you see
// how Compose works you understand we seriously need to make more methods."
//
// THE GAP THIS CLOSES, MEASURED, NOT GUESSED. Sibling of pythagorean_theorem_cascade.ts -- read
// that file's header first, its full account of the measured gap and the four pre-existing
// COMPUTE-demand methods applies here unchanged. method_selection_probe_report_D-BP168-M0-100.json
// (674 real OlympiadBench solutions) found "quadratic formula" named in 12 real solutions, the
// third-highest-frequency of the 17 distinct phrases found (after "by induction"+"induction" at
// 32 combined and "permutation"+"combination" at 25 combined -- both proof-technique/counting
// shapes, not single-formula shapes, and out of scope for this dispatch's quality-over-count
// instruction; see the RETURN file for why those are named but not built here). No registered
// COMPUTE method names or teaches the quadratic formula -- confirmed by direct read of all four
// pre-existing methods' shapeTest()/run() bodies, same as pythagorean_theorem_cascade.ts's own
// confirmation.
//
// A METHOD IS TAUGHT, NOT INVENTED -- same canon citation as pythagorean_theorem_cascade.ts. This
// method teaches the quadratic formula to the model as a FACT via compute_sidecar.ts's own
// `componentFacts` parameter (BP137 Stage A.3), never the answer to any question. The whitelisted
// evaluator grammar (`ARITHMETIC_WHITELIST_RE = /^[\d+\-*/^().%\s]+$/`) already expresses the
// formula's square root as `^0.5` -- the taught fact says so explicitly, exactly as
// pythagorean_theorem_cascade.ts's own fact does.
//
// SCOPE, HONESTLY STATED. A quadratic has TWO roots in general; compute_sidecar.ts's own
// computeViaModelExpression() returns exactly ONE numeric value per run (a single verified
// expression). This method is therefore gated to the shape that has a single well-defined numeric
// answer: the question asks for ONE specific named root (e.g. "the positive root", "the larger
// root", "the sum of the roots", "the product of the roots") or the discriminant itself -- never a
// bare "solve for x" with no disambiguation of which root is wanted, which this method's shapeTest()
// deliberately refuses rather than arbitrarily picking the + branch. This is narrower than a
// general quadratic solver and is stated plainly, not overclaimed, matching stage3_symbolic_
// cascade.ts's own "SHAPE, NOT LOOKUP" discipline.
//
// THE NETWORK-CALLING ADAPTER BELOW IS A DELIBERATE, NAMED PARALLEL TO compute_gemma_cascade.ts's,
// compute_select_cascade.ts's, AND pythagorean_theorem_cascade.ts's OWN ADAPTERS, NOT A REUSE OF
// ANY OF THEM -- same reason stated in each of those files' own headers: none of their adapters are
// exported, and this dispatch does not touch any of those three files.
//
// SHAPE, NOT LOOKUP. shapeTest() requires (a) no lettered option list (free-text only, same gate
// every COMPUTE-demand method uses), (b) a quadratic cue -- the word "quadratic" or a literal
// squared term ("x^2", "x²", or "x**2") -- and (c) a root-disambiguation cue naming WHICH single
// value is wanted (positive/negative/larger/smaller/greater/least root, sum of the roots, product
// of the roots, or the discriminant) so run() never has to guess which of two roots to report.
// Refuses honestly when the disambiguation cue is absent.
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
const MODEL = process.env.CASCADE_MODEL ?? 'gemma4:12b';

// THE TAUGHT FACT (BP137 Stage A.3 componentFacts) -- a formula, never the answer to this or any
// question. Names both roots and the two derived quantities (sum, product) this method's
// shapeTest() can disambiguate to, and the whitelisted-grammar way to express a square root.
const QUADRATIC_FACT =
  'Quadratic formula: for a*x^2 + b*x + c = 0 with a not equal to 0, the two roots are '
  + 'x = (-b + (b^2 - 4*a*c)^0.5) / (2*a) and x = (-b - (b^2 - 4*a*c)^0.5) / (2*a). The '
  + 'discriminant is b^2 - 4*a*c. The sum of the two roots is -b/a. The product of the two roots '
  + 'is c/a. Express a square root as a power of 0.5 (e.g. write (25)^0.5, never sqrt(25)).';

function nowIso(): string {
  return new Date().toISOString();
}

const QUADRATIC_CUE_RE = /\bquadratic\b|x\s*\^\s*2|x\s*\*\*\s*2|x\s*²/i;
const ROOT_DISAMBIGUATION_CUE_RE =
  /\bpositive\s+root\b|\bnegative\s+root\b|\blarger\s+root\b|\bsmaller\s+root\b|\bgreater\s+root\b|\bleast\s+root\b|\bsmallest\s+root\b|\bsum\s+of\s+the\s+roots\b|\bproduct\s+of\s+the\s+roots\b|\bdiscriminant\b/i;
const NUMERIC_LITERAL_RE = /\d[\d,]*(?:\.\d+)?/g;
function countNumericLiterals(text: string): number {
  const matches = text.match(NUMERIC_LITERAL_RE);
  return matches ? matches.length : 0;
}

interface QuadraticCallInternalResult {
  ok: boolean;
  text: string | null;
  doneReason: string | null;
  failureKind?: 'transport_error' | 'http_error' | 'empty_response';
  detail?: string;
}

async function quadraticCallModelInternal(
  prompt: string,
  ollamaBaseUrl: string,
  model: string,
  temperature: number,
  numPredict: number,
): Promise<QuadraticCallInternalResult> {
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

const quadraticCallModel: ModelCallFn = async (prompt, ollamaBaseUrl, model, temperature, numPredict) => {
  const r = await quadraticCallModelInternal(prompt, ollamaBaseUrl, model, temperature, numPredict);
  return r.ok ? (r.text as string) : null;
};

const quadraticCallModelRich: ModelCallFnRich = async (prompt, ollamaBaseUrl, model, temperature, numPredict) => {
  const r = await quadraticCallModelInternal(prompt, ollamaBaseUrl, model, temperature, numPredict);
  if (r.ok) return { ok: true, text: r.text as string, doneReason: r.doneReason };
  return { ok: false, failureKind: r.failureKind as 'transport_error' | 'http_error' | 'empty_response', detail: r.detail };
};

function shapeTest(input: MethodQuestionInput): ShapeTestResult {
  // NEVER reads input.correctAnswer -- matches every sibling cascade's shapeTest() signature.
  if (input.options && Object.keys(input.options).length >= 2) {
    return {
      matches: false,
      reason: 'has >=2 lettered options -- quadratic-formula-cascade only matches free-text questions with no option list (same gate as every free-text COMPUTE-demand method).',
    };
  }
  const question = input.question || '';
  if (!QUADRATIC_CUE_RE.test(question)) {
    return {
      matches: false,
      reason: 'no quadratic cue found (the word "quadratic" or a literal squared term x^2/x**2/x²) -- refuses rather than guessing this shape.',
    };
  }
  if (!ROOT_DISAMBIGUATION_CUE_RE.test(question)) {
    return {
      matches: false,
      reason: 'quadratic cue found, but no root-disambiguation cue (positive/negative/larger/smaller root, sum of the roots, product of the roots, or discriminant) -- a bare "solve for x" has two roots and this method refuses to arbitrarily pick one rather than guessing which the question wants.',
    };
  }
  const numCount = countNumericLiterals(question);
  if (numCount < 1) {
    return {
      matches: false,
      reason: 'quadratic and root-disambiguation cues found but no numeric literal (coefficient) is present in the question text -- refuses honestly rather than guessing a coefficient.',
    };
  }
  return {
    matches: true,
    reason: `quadratic cue, root-disambiguation cue, and ${numCount} numeric literal(s) present -- eligible to be taught the quadratic formula as a componentFact and attempt a verified derivation of the specific named quantity.`,
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
      text: `   quadratic-formula-cascade sample ${sample.sampleIndex + 1}: ${sample.rejection}`
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
      [QUADRATIC_FACT],
      quadraticCallModel,
      onModelExpressionSample,
      quadraticCallModelRich,
    );
  } catch (e) {
    return {
      question,
      verdict: null,
      abstain: true,
      freeText: true,
      method: 'quadratic-formula-cascade',
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
      method: 'quadratic-formula-cascade',
      basis: 'REFUSES rather than guesses: no model-derived expression, taught the quadratic '
        + "formula as a fact, cleared compute_sidecar.ts's own two-evaluator recompute AND N=3 "
        + 'agree-2-of-3 self-consistency gate. '
        + (perSample.length ? `Per-sample: ${perSample}.` : 'No sample records were captured (onSample never fired).'),
    };
  }
  return {
    question,
    verdict: String(modelResult.value),
    abstain: false,
    freeText: true,
    method: 'quadratic-formula-cascade',
    basis: `model (${MODEL}) was taught the quadratic formula as a fact (never the answer) and derived `
      + `expression "${modelResult.expression}" from the question text alone (never reads a dataset `
      + 'answer field); two independently-implemented evaluators (evaluateArithmeticVerified, '
      + 'compute_sidecar.ts) recomputed it and at least 2 of 3 sampled derivations agreed on the same '
      + `value within float epsilon => ${modelResult.value}.`,
  };
}

export const quadraticFormulaCascadeMethod: LianaMethod = {
  id: 'quadratic-formula-cascade',
  demand: 'COMPUTE',
  name: 'Quadratic Formula Cascade (model is taught x=(-b+-sqrt(b^2-4ac))/2a as a fact, never the '
    + 'answer; derives one verified expression for a specifically-named root/sum/product/'
    + 'discriminant -- reuses compute_sidecar.ts\'s BP137 Stage A.2/A.3 machinery unchanged)',
  taughtBy: 'D-BP168-M0-113/BISHOP-M0/seg-composer-methods. Gap measured directly from '
    + 'method_selection_probe_report_D-BP168-M0-100.json (674 real OlympiadBench solutions): '
    + '"quadratic formula" named in 12, the third-highest-frequency of 17 distinct phrases found, '
    + 'with no registered COMPUTE method naming or teaching it. Founder order (task t-8138911d): '
    + '"MORE METHODS FOR THE COMPOSER." Not a single walked human case (canon rule 4) -- flagged '
    + 'here, not hidden, same disclosure convention pythagorean_theorem_cascade.ts (this same '
    + 'dispatch) and its earlier siblings already use; this one also TEACHES a named formula via '
    + 'componentFacts (BP137 Stage A.3), same discipline as pythagorean_theorem_cascade.ts.',
  shapeDescription: 'a free-text question (no lettered options) naming a quadratic (the word '
    + '"quadratic" or a literal x^2/x**2/x² term) AND naming which single quantity is wanted '
    + '(positive/negative/larger/smaller root, sum of the roots, product of the roots, or the '
    + 'discriminant) -- refuses a bare "solve for x" with no disambiguation, and refuses honestly '
    + '(HARDWIRE-22) when no numeric coefficient is present; the model is taught the formula as a '
    + 'fact and its derived expression is still independently recomputed and self-consistency-'
    + 'checked before ever being trusted as an answer.',
  shapeTest,
  run,
};

// Registers at import time, same convention as every other method module. Wired into
// liana_terminal_engine.ts's import list alongside the other COMPUTE-demand methods.
registerMethod(quadraticFormulaCascadeMethod);
