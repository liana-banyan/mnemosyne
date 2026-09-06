// methods/law_of_cosines_cascade.ts -- D-BP168-M0-126/BISHOP-M0/seg-composer-methods
//
// FOUNDER ORDER, BP168, dispatch D-BP168-M0-126: "BUILD THE HIGHEST-FREQUENCY ONES ... then the rest
// of the seventeen." Read pythagorean_theorem_cascade.ts and quadratic_formula_cascade.ts (D-BP168-
// M0-113) first -- this file follows their shape exactly, per this dispatch's own instruction.
//
// THE GAP THIS CLOSES, MEASURED, NOT GUESSED. method_selection_probe_report_D-BP168-M0-100.json (674
// real OlympiadBench solutions) found "law of cosines" named in 9 real solutions -- the
// fourth-highest-frequency single phrase of the 17 found (after "by induction"+"induction" combined
// 32, "permutation"+"combination" combined 25, and "quadratic formula" 12; "pythagorean theorem" 14
// and "quadratic formula" 12 were already closed by D-BP168-M0-113, "permutation"/"combination" by
// this dispatch's own permutation_combination_cascade.ts, sibling file). No registered COMPUTE
// method names or teaches it -- confirmed by direct read of all seven pre-existing COMPUTE methods'
// shapeTest()/run() bodies.
//
// SCOPE, HONESTLY STATED, NARROWER THAN THE GENERAL LAW. The law of cosines relates a side to the
// other two sides plus the INCLUDED ANGLE's cosine: c^2 = a^2 + b^2 - 2ab*cos(C).
// compute_sidecar.ts's whitelisted evaluator grammar (ARITHMETIC_WHITELIST_RE =
// /^[\d+\-*\/^().%\s]+$/) has no cos()/trig function at all -- a general angle cannot be evaluated.
// This method is therefore gated to the ONLY sub-shape that reduces to a clean numeric expression:
// the angle is one of the standard "nice" degree values (0/30/45/60/90/120/135/150/180) whose cosine
// is a known rational or simple-radical constant, AND the question asks to find the SIDE opposite
// that angle (never an angle itself, which would require arccos -- also unsupported, and this
// method's shapeTest() deliberately refuses that direction rather than guessing). This mirrors
// quadratic_formula_cascade.ts's own "narrower than a general solver, stated plainly" discipline.
//
// A METHOD IS TAUGHT, NOT INVENTED (canon_the_liana_cycle_is_a_method_registry_taught_by_humans_
// bp149). Teaches the law of cosines AND a lookup table of the nine nice-angle cosine values to the
// model as FACTS via compute_sidecar.ts's own `componentFacts` parameter (BP137 Stage A.3), never
// the answer -- same discipline as this dispatch's other two methods.
//
// OUTPUT-CONTRACT DEFECT DESIGNED AROUND (KNOWN, NOT REDISCOVERED). D-BP168-M0-113 measured gemma4:
// 12b emit Python-style `**` where a taught method said `^` (t-e85c0467, evaluator rejected an
// otherwise-correct derivation on notation alone). The taught fact below states the expected output
// form explicitly, in its own sentence: use `^` for exponents, never `**`; square roots are `^0.5`.
//
// SHAPE, NOT LOOKUP. shapeTest() requires (a) no lettered option list (free-text only, same gate
// every COMPUTE-demand method uses), (b) the phrase "law of cosines", (c) one of the nine nice
// angle-degree values written with a degree marker, (d) a side-finding cue (the question asks for
// the length of a/the (third) side, never a bare "solve the triangle" or "find angle"), and (e) at
// least three numeric literals total (the angle plus the two known side lengths). Any question
// missing one of these is refused honestly, never guessed.
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

// THE TAUGHT FACT (BP137 Stage A.3 componentFacts) -- a formula plus a constant lookup table, never
// the answer to this or any question. Names the nine nice-angle cosine values as exact expressions
// the whitelisted evaluator CAN compute (rationals, or a radical written as ^0.5), a worked example,
// and the expected output notation.
const LAW_OF_COSINES_FACT =
  'Law of cosines: in a triangle with sides a, b, c, where c is opposite angle C, '
  + 'c^2 = a^2 + b^2 - 2*a*b*cos(C). Use these exact values for cos(C) when angle C, in degrees, is '
  + 'one of: cos(0)=1, cos(30)=(3^0.5)/2, cos(45)=(2^0.5)/2, cos(60)=0.5, cos(90)=0, cos(120)=-0.5, '
  + 'cos(135)=-((2^0.5)/2), cos(150)=-((3^0.5)/2), cos(180)=-1. To find side c: substitute the two '
  + 'known side lengths for a and b and the matching value above for cos(C), then take the square '
  + 'root by raising the whole right-hand side to the power 0.5. Use ^ for exponents (never ** or a '
  + 'superscript). Example: a=5, b=7, angle C=60 degrees, so c = (5^2 + 7^2 - 2*5*7*0.5)^0.5.';

function nowIso(): string {
  return new Date().toISOString();
}

const LAW_OF_COSINES_CUE_RE = /\blaw\s+of\s+cosines\b/i;
const NICE_ANGLE_RE = /\b(?:0|30|45|60|90|120|135|150|180)\s*(?:°|degrees?|deg\b|\\circ)/i;
const SIDE_FIND_CUE_RE =
  /\bthird\s+side\b|\blength\s+of\s+(?:the\s+)?(?:third\s+)?side\b|\bfind\s+(?:the\s+)?side\b|\bfind\s+c\b|\bvalue\s+of\s+c\b|\bside\s+c\b/i;
const NUMERIC_LITERAL_RE = /\d[\d,]*(?:\.\d+)?/g;
function countNumericLiterals(text: string): number {
  const matches = text.match(NUMERIC_LITERAL_RE);
  return matches ? matches.length : 0;
}

/** Same internal-result/adapter-splitting shape every sibling COMPUTE method in this estate already
 *  uses independently -- see pythagorean_theorem_cascade.ts's own header for why this is a
 *  deliberate parallel, not a shared import; unchanged reasoning applies here. */
interface LawOfCosinesCallInternalResult {
  ok: boolean;
  text: string | null;
  doneReason: string | null;
  failureKind?: 'transport_error' | 'http_error' | 'empty_response';
  detail?: string;
}

async function lawOfCosinesCallModelInternal(
  prompt: string,
  ollamaBaseUrl: string,
  model: string,
  temperature: number,
  numPredict: number,
): Promise<LawOfCosinesCallInternalResult> {
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

const lawOfCosinesCallModel: ModelCallFn = async (prompt, ollamaBaseUrl, model, temperature, numPredict) => {
  const r = await lawOfCosinesCallModelInternal(prompt, ollamaBaseUrl, model, temperature, numPredict);
  return r.ok ? (r.text as string) : null;
};

const lawOfCosinesCallModelRich: ModelCallFnRich = async (prompt, ollamaBaseUrl, model, temperature, numPredict) => {
  const r = await lawOfCosinesCallModelInternal(prompt, ollamaBaseUrl, model, temperature, numPredict);
  if (r.ok) return { ok: true, text: r.text as string, doneReason: r.doneReason };
  return { ok: false, failureKind: r.failureKind as 'transport_error' | 'http_error' | 'empty_response', detail: r.detail };
};

function shapeTest(input: MethodQuestionInput): ShapeTestResult {
  // NEVER reads input.correctAnswer -- matches every sibling cascade's shapeTest() signature.
  if (input.options && Object.keys(input.options).length >= 2) {
    return {
      matches: false,
      reason: 'has >=2 lettered options -- law-of-cosines-cascade only matches free-text questions with no option list (same gate as every free-text COMPUTE-demand method).',
    };
  }
  const question = input.question || '';
  if (!LAW_OF_COSINES_CUE_RE.test(question)) {
    return {
      matches: false,
      reason: 'no "law of cosines" cue phrase found -- refuses rather than guessing this shape from a bare triangle question.',
    };
  }
  if (!NICE_ANGLE_RE.test(question)) {
    return {
      matches: false,
      reason: 'law-of-cosines cue found, but no nice-angle degree value (0/30/45/60/90/120/135/150/180) is named -- the whitelisted evaluator has no cos() function for an arbitrary angle, so this method refuses rather than guessing a cosine value.',
    };
  }
  if (!SIDE_FIND_CUE_RE.test(question)) {
    return {
      matches: false,
      reason: 'law-of-cosines cue and a nice angle found, but no side-finding cue (e.g. "third side", "length of the side", "find c") -- this method only derives a SIDE, never an angle (that direction needs arccos, unsupported by the whitelisted evaluator); refuses rather than guessing the question is asking for a side.',
    };
  }
  const numCount = countNumericLiterals(question);
  if (numCount < 3) {
    return {
      matches: false,
      reason: `law-of-cosines, nice-angle, and side-finding cues all found but only ${numCount} numeric literal(s) present -- computing the side needs the angle plus two known side lengths (>=3 numbers); refuses honestly rather than guessing a missing one.`,
    };
  }
  return {
    matches: true,
    reason: `law-of-cosines cue, nice angle, side-finding cue, and ${numCount} numeric literals all present -- eligible to be taught c^2=a^2+b^2-2ab*cos(C) plus the nice-angle cosine table as componentFacts and attempt a verified derivation.`,
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
      text: `   law-of-cosines-cascade sample ${sample.sampleIndex + 1}: ${sample.rejection}`
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
      [LAW_OF_COSINES_FACT],
      lawOfCosinesCallModel,
      onModelExpressionSample,
      lawOfCosinesCallModelRich,
    );
  } catch (e) {
    return {
      question,
      verdict: null,
      abstain: true,
      freeText: true,
      method: 'law-of-cosines-cascade',
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
      method: 'law-of-cosines-cascade',
      basis: 'REFUSES rather than guesses: no model-derived expression, taught the law of cosines '
        + "and the nice-angle cosine table as facts, cleared compute_sidecar.ts's own two-evaluator "
        + 'recompute AND N=3 agree-2-of-3 self-consistency gate. '
        + (perSample.length ? `Per-sample: ${perSample}.` : 'No sample records were captured (onSample never fired).'),
    };
  }
  return {
    question,
    verdict: String(modelResult.value),
    abstain: false,
    freeText: true,
    method: 'law-of-cosines-cascade',
    basis: `model (${MODEL}) was taught c^2=a^2+b^2-2ab*cos(C) plus the nice-angle cosine table as `
      + `facts (never the answer) and derived expression "${modelResult.expression}" from the `
      + 'question text alone (never reads a dataset answer field); two independently-implemented '
      + 'evaluators (evaluateArithmeticVerified, compute_sidecar.ts) recomputed it and at least 2 of '
      + `3 sampled derivations agreed on the same value within float epsilon => ${modelResult.value}.`,
  };
}

export const lawOfCosinesCascadeMethod: LianaMethod = {
  id: 'law-of-cosines-cascade',
  demand: 'COMPUTE',
  name: 'Law of Cosines Cascade (model is taught c^2=a^2+b^2-2ab*cos(C) plus a nine-value nice-angle '
    + 'cosine table as facts, never the answer; derives one verified side-length expression for a '
    + 'named standard-degree angle -- reuses compute_sidecar.ts\'s BP137 Stage A.2/A.3 machinery '
    + 'unchanged)',
  taughtBy: 'D-BP168-M0-126/BISHOP-M0/seg-composer-methods. Gap measured directly from '
    + 'method_selection_probe_report_D-BP168-M0-100.json (674 real OlympiadBench solutions): "law of '
    + 'cosines" named in 9, the fourth-highest-frequency single phrase of 17 distinct phrases found, '
    + 'with no registered COMPUTE method naming or teaching it. Founder order, BP168, dispatch '
    + 'D-BP168-M0-126: "then the rest of the seventeen." Deliberately narrower than the general law '
    + '(side-finding only, standard-degree angles only) because the whitelisted evaluator has no '
    + 'trig function -- stated plainly here, not overclaimed, same discipline quadratic_formula_'
    + 'cascade.ts already uses for its own root-disambiguation narrowing. Not a single walked human '
    + 'case (canon rule 4) -- flagged, not hidden, same disclosure convention every prior '
    + 'Founder-ordered non-single-case COMPUTE method in this estate uses; teaches the law and the '
    + 'cosine table via componentFacts (BP137 Stage A.3), same discipline as its two BP168 siblings.',
  shapeDescription: 'a free-text question (no lettered options) naming "law of cosines", a standard '
    + 'degree angle (0/30/45/60/90/120/135/150/180), and a side-finding cue (never an angle-finding '
    + 'one), carrying at least three numeric literals -- refuses honestly (HARDWIRE-22) otherwise; '
    + 'the model is taught the law and the nice-angle cosine table as facts and its derived '
    + 'expression is still independently recomputed and self-consistency-checked before ever being '
    + 'trusted as an answer.',
  shapeTest,
  run,
};

// Registers at import time, same convention as every other method module. Wired into
// liana_terminal_engine.ts's import list alongside the other COMPUTE-demand methods.
registerMethod(lawOfCosinesCascadeMethod);
