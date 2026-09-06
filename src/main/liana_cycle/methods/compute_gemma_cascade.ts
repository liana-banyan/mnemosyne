// compute_gemma_cascade.ts -- D-BP164-M0-119/BISHOP-SEG/seg-compute
//
// FOUNDER ORDER, VERBATIM: "Build the COMPUTE+gemma method and rerun those 2."
//
// WHY THIS FILE EXISTS, MEASURED BY THE DISPATCH THAT PRECEDED THIS ONE (D-BP164-M0-118): gemma
// has NEVER answered a single question through the Liana Cycle. Only classify_cascade.ts and
// comparative_cascade.ts ever reach a model at all, both via the same gemmaExtract(), both gated
// to demands CLASSIFY and RANK. OlympiadBench items resolve to demand COMPUTE (demand_test.ts,
// D-BP164-M0-112), and BOTH pre-existing COMPUTE methods -- arithmetic_cascade.ts and
// stage3_symbolic_cascade.ts -- contain ZERO model-call code of any kind (both are pure SymPy
// solvers over locally-extracted structure). There was no gemma leg to unblock for COMPUTE; this
// file is that leg.
//
// THE PATTERN, PORTED NOT REINVENTED: src/main/plow/compute_sidecar.ts's
// computeViaModelExpression() (BP137 Yoke Stage A.2) is the already-battle-tested "model derives
// ONE arithmetic expression, is NEVER trusted to compute it" pattern -- two independently-
// implemented evaluators (evaluateArithmeticVerified, private to that file) recompute every
// sampled expression, and the model is sampled N=3, trusted only on agree-2-of-3 across samples.
// This file imports that function DIRECTLY rather than copying its logic -- the only change made
// to compute_sidecar.ts itself is a minimal, additive refactor: computeViaModelExpression() grew
// an OPTIONAL 5th parameter (`callModel: ModelCallFn = callOllama`), so a caller here can inject
// a DIFFERENT model-calling function (one that sends `think:false` top-level, caps `num_ctx` at
// 4096, and records every real round trip through cost_instrument.ts) without a second, diverging
// copy of the verified two-evaluator/self-consistency logic ever existing. Every pre-existing call
// site of computeViaModelExpression() (plow_mc_answerer.ts via computeAnswer(), every existing
// test) passes 4 or fewer arguments and is therefore byte-identical to before this dispatch --
// confirmed by direct read of compute_sidecar.ts's own diff, not assumed.
//
// WHY A NEW callModel INSTEAD OF THE PRE-EXISTING callOllama (canonical_pipeline.ts): that
// function sends `options: { temperature, num_predict }` only -- no `num_ctx` field at all, and no
// token-count return value -- so it cannot honor the Founder's num_ctx=4096 ruling (D-BP164-M0-116)
// or feed cost_instrument.ts's recordLlmCall() real prompt_eval_count/eval_count numbers.
// computeGemmaCallModel() below is a thin, purpose-built Ollama caller that mirrors
// comparative_cascade.ts's gemmaExtract() network/cost-recording discipline (think:false
// TOP-LEVEL not nested in options, explicit num_ctx, every real call -- ok, HTTP error, or
// transport failure -- recorded via recordLlmCall(), never silently skipped) so the SAME cost
// instrument the Founder ordered reused actually fires here too. It reuses
// resolveGemmaModelDigest() and GEMMA_NUM_CTX_RUN_CAP directly from comparative_cascade.ts
// (both already exported for exactly this kind of reuse) rather than re-deriving either.
//
// COST RECEIPTS: NO SECOND COST PATH. Every real round trip made by computeGemmaCallModel() below
// calls cost_instrument.ts's recordLlmCall() -- the SAME function, SAME LlmCallCostRecord shape,
// SAME per-run AsyncLocalStorage ledger (runWithLlmCostLedger()) comparative_cascade.ts's
// gemmaExtract() already uses. A caller (teach_by_hand_cli.ts) that already wraps a run in
// runWithLlmCostLedger() gets this method's calls in the SAME ledger/summary for free.
//
// THE HONESTY GATE (HARDWIRE-22): shapeTest() below claims ONLY a free-text question (no lettered
// option pool -- the same free-text gate arithmetic_cascade.ts and stage3_symbolic_cascade.ts
// already use for demand COMPUTE) carrying AT LEAST TWO numeric literals -- the minimum a model
// could plausibly combine into a verifiable arithmetic expression at all. This is deliberately
// LOOSER than arithmetic_cascade.ts's own gate (which additionally requires a recognized local
// cue word like "total"/"each"/"divided by") -- that additional requirement is exactly what a
// LOCAL-REGEX solver needs and a MODEL-COMBINATION solver does not: the whole point of this tier
// is to attempt exactly the word problems whose formula is not spelled out as a literal cue-word
// pattern. Matching shapeTest() is NOT a promise of an answer -- run() below still honestly
// abstains whenever computeViaModelExpression() returns null (model said NONE on every sample,
// emitted a non-arithmetic line, or the sampled derivations disagreed). This is deliberately NOT
// a catch-all: a question with fewer than two numeric literals (e.g. a pure geometric-relation
// problem stating only one integer constraint) is refused at the shape gate itself, honestly,
// before any model call is ever made.
//
// REGISTRATION ORDER (liana_terminal_engine.ts): imported AFTER arithmetic_cascade.ts and
// stage3_symbolic_cascade.ts, alongside them, never replacing them. selectMethod() matches the
// FIRST registered method whose shapeTest() passes (method_registry.ts), so the two cheaper,
// purely-symbolic SymPy methods keep their existing first chance to claim a question their own
// shape legitimately covers; this method only runs when both of those have already refused.

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput, MethodRunContext, ShapeTestResult } from '../method_registry';
import type { LianaTerminalOutcome } from '../../../shared/liana_cycle/liana_terminal_types';
import { computeViaModelExpression } from '../../plow/compute_sidecar';
import type { ModelCallFn, ModelCallFnRich, ModelExpressionSampleRecord } from '../../plow/compute_sidecar';
import { recordLlmCall } from '../cost_instrument';
import { resolveGemmaModelDigest, GEMMA_NUM_CTX_RUN_CAP } from './comparative_cascade';
import os from 'node:os';

const OLLAMA_API_BASE = process.env.OLLAMA_API_BASE ?? 'http://127.0.0.1:11434';
// SAME env-overridable model tag comparative_cascade.ts's own MODEL constant uses -- no second,
// diverging model-selection convention.
const MODEL = process.env.CASCADE_MODEL ?? 'gemma4:12b';

function nowIso(): string {
  return new Date().toISOString();
}

/** D-BP165-M0-006/BISHOP-SEG, WIRING ADDITION (Founder order, BP165, verbatim: "when you build it,
 *  you wire it. Always."). Sibling dispatch D-BP165-M0-007 grew compute_sidecar.ts's
 *  computeViaModelExpression() two OPTIONAL parameters -- `onSample` (per-sample diagnostic,
 *  including the CAPTURED RAW MODEL OUTPUT) and `callModelRich` (a richer model-call contract that
 *  can distinguish 'empty_response' / 'transport_error' / 'http_error' apart, and can carry
 *  Ollama's own `done_reason` for truncation detection) -- but building that machinery in
 *  compute_sidecar.ts does not, by itself, make THIS file's live gemma path use it. This is that
 *  wire.
 *
 *  ONE NETWORK CALL, TWO CALLERS. The exact fetch/cost-recording logic below is UNCHANGED from
 *  before this dispatch (same URL, same body shape -- `think:false` TOP-LEVEL, `num_ctx` capped at
 *  GEMMA_NUM_CTX_RUN_CAP -- same three recordLlmCall() sites for transport failure / HTTP error /
 *  success). It is factored into ONE shared internal caller so the network code exists exactly
 *  once, never as two diverging copies: `computeGemmaCallModel` (the pre-existing, byte-identical-
 *  behavior legacy `ModelCallFn` -- still the 5th argument, still what a caller with no rich
 *  contract gets) and `computeGemmaCallModelRich` (the NEW `ModelCallFnRich`, 7th argument, wired
 *  into run() below) are now both THIN ADAPTERS over `computeGemmaCallModelInternal`, differing
 *  only in which parts of the same underlying result they keep or discard. */
interface GemmaCallInternalResult {
  ok: boolean;
  text: string | null;
  doneReason: string | null;
  failureKind?: 'transport_error' | 'http_error' | 'empty_response';
  detail?: string;
}

async function computeGemmaCallModelInternal(
  prompt: string,
  ollamaBaseUrl: string,
  model: string,
  temperature: number,
  numPredict: number,
): Promise<GemmaCallInternalResult> {
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
    // `done_reason` parsed the SAME way comparative_cascade.ts's own gemmaExtract() already does
    // (that file's own line ~922, D-BP153-034) -- reused convention, not a second one invented.
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
    // Not a network transport failure and not an HTTP error status -- the response WAS 200 OK; its
    // body simply did not parse as JSON. Closest of ModelCallOutcome's three named failureKinds:
    // there is no text to report either way, so this is classified alongside 'empty_response'
    // rather than inventing a fourth kind compute_sidecar.ts's own type does not have.
    return { ok: false, text: null, doneReason: null, failureKind: 'empty_response', detail };
  }
}

/** Legacy `ModelCallFn` adapter -- BYTE-IDENTICAL BEHAVIOR to before this dispatch: `ok:true`
 *  collapses to its text, every `ok:false` case collapses to `null`, exactly what the pre-existing
 *  inline implementation did. Still the 5th argument to computeViaModelExpression() below, so any
 *  future caller of THIS function directly (there is none today) sees no change. */
const computeGemmaCallModel: ModelCallFn = async (prompt, ollamaBaseUrl, model, temperature, numPredict) => {
  const r = await computeGemmaCallModelInternal(prompt, ollamaBaseUrl, model, temperature, numPredict);
  return r.ok ? (r.text as string) : null;
};

/** THE NEW WIRE. `ModelCallFnRich` adapter (compute_sidecar.ts's `ModelCallOutcome` shape) --
 *  passed as the 7th argument to computeViaModelExpression() in run() below, so every sample this
 *  method's own live gemma calls make is classified into 'empty_response' / 'transport_error' /
 *  'http_error' (instead of collapsing into the vague 'empty_or_transport_error') and carries
 *  Ollama's real `done_reason` for 'truncated_num_predict' detection. */
const computeGemmaCallModelRich: ModelCallFnRich = async (prompt, ollamaBaseUrl, model, temperature, numPredict) => {
  const r = await computeGemmaCallModelInternal(prompt, ollamaBaseUrl, model, temperature, numPredict);
  if (r.ok) return { ok: true, text: r.text as string, doneReason: r.doneReason };
  return { ok: false, failureKind: r.failureKind as 'transport_error' | 'http_error' | 'empty_response', detail: r.detail };
};

// Deliberately simple: counts numeric literals only, for the SHAPE gate (see file header). Not
// the arithmetic evaluator -- that logic lives, unduplicated, inside compute_sidecar.ts and is
// never reimplemented here.
const NUMERIC_LITERAL_RE = /\d[\d,]*(?:\.\d+)?/g;
function countNumericLiterals(text: string): number {
  const matches = text.match(NUMERIC_LITERAL_RE);
  return matches ? matches.length : 0;
}

function shapeTest(input: MethodQuestionInput): ShapeTestResult {
  // NEVER reads input.correctAnswer -- matches every other cascade's shapeTest() signature.
  if (input.options && Object.keys(input.options).length >= 2) {
    return {
      matches: false,
      reason: 'has >=2 lettered options -- compute-gemma-cascade only matches free-text questions with no option list (same gate as arithmetic-cascade/stage3-symbolic-cascade for demand COMPUTE).',
    };
  }
  const question = input.question || '';
  const numCount = countNumericLiterals(question);
  if (numCount < 2) {
    return {
      matches: false,
      reason: `only ${numCount} numeric literal(s) found in the question text -- compute-gemma-cascade requires at least two for a model to plausibly derive a verifiable combining expression (HARDWIRE-22); refuses honestly rather than attempting a call with nothing to combine.`,
    };
  }
  return {
    matches: true,
    reason: `free-text question, no options, ${numCount} numeric literals found -- eligible for the model to attempt deriving one verifiable arithmetic expression (still gated downstream by compute_sidecar.ts's two-evaluator recompute + N=3 agree-2-of-3 self-consistency check; matching here is not a promise of an answer).`,
  };
}

async function run(input: MethodQuestionInput, ctx: MethodRunContext): Promise<LianaTerminalOutcome> {
  // NEVER reads input.correctAnswer. Derivation depends on input.question alone -- componentFacts
  // is deliberately omitted (undefined) here: the permitted inference inputs for this dispatch's
  // run are id/question/context only, and this method's shapeTest() never saw a context field
  // worth threading through (OlympiadBench's own `context` column is empty for both rerun items).
  const question = input.question || '';
  // D-BP165-M0-006, THE WIRE. `onSample` streams EVERY sample's specific rejection class and its
  // captured (capped) raw model output into this run's own transcript, as it happens -- so a
  // 12k-item sweep's per-item transcript shows WHY a sample was rejected instead of only the final
  // disjunctive `empty_or_transport_error`-shaped basis string this file's own header (D-BP164-
  // M0-119) already flagged as the gap this closes. `computeGemmaCallModelRich` (the 7th argument)
  // is what lets `onSample`'s own `rejection`/`doneReason` fields ever be more specific than that
  // legacy collapse -- see both functions' own doc comments, above.
  const sampleRecords: ModelExpressionSampleRecord[] = [];
  const onModelExpressionSample = (sample: ModelExpressionSampleRecord): void => {
    sampleRecords.push(sample);
    const rawPreview = sample.rawOutput
      ? `"${sample.rawOutput.text}"${sample.rawOutput.truncated ? ` (captured text truncated at display cap, real length ${sample.rawOutput.originalLength} chars)` : ''}`
      : '(no raw output captured for this sample)';
    ctx.emit({
      kind: 'note',
      text: `   compute-gemma-cascade sample ${sample.sampleIndex + 1}: ${sample.rejection}`
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
      undefined,
      computeGemmaCallModel,
      onModelExpressionSample,
      computeGemmaCallModelRich,
    );
  } catch (e) {
    return {
      question,
      verdict: null,
      abstain: true,
      freeText: true,
      method: 'compute-gemma-cascade',
      basis: `computeViaModelExpression (compute_sidecar.ts) threw: ${String((e as Error)?.message ?? e)}`,
    };
  }
  if (!modelResult) {
    // D-BP165-M0-006, THE WIRE: name the SPECIFIC rejection class each sample actually hit, not
    // only the generic gate description -- `sampleRecords` is populated by `onModelExpressionSample`
    // above, one entry per sample, in order, regardless of whether `callModelRich` distinguished a
    // network failure precisely or the legacy path collapsed one to `empty_or_transport_error`.
    const perSample = sampleRecords
      .map((s) => `sample ${s.sampleIndex + 1}: ${s.rejection}${s.doneReason ? ` (done_reason=${s.doneReason})` : ''}`)
      .join('; ');
    return {
      question,
      verdict: null,
      abstain: true,
      freeText: true,
      method: 'compute-gemma-cascade',
      basis: 'REFUSES rather than guesses: no model-derived expression cleared compute_sidecar.ts\'s '
        + 'own two-evaluator recompute AND N=3 agree-2-of-3 self-consistency gate. '
        + (perSample.length ? `Per-sample: ${perSample}.` : 'No sample records were captured (onSample never fired).'),
    };
  }
  return {
    question,
    verdict: String(modelResult.value),
    abstain: false,
    freeText: true,
    method: 'compute-gemma-cascade',
    basis: `model (${MODEL}) derived expression "${modelResult.expression}" from the question text `
      + 'alone (never reads a dataset answer field); two independently-implemented evaluators '
      + '(evaluateArithmeticVerified, compute_sidecar.ts) recomputed it and at least 2 of 3 sampled '
      + `derivations agreed on the same value within float epsilon => ${modelResult.value}.`,
  };
}

export const computeGemmaCascadeMethod: LianaMethod = {
  id: 'compute-gemma-cascade',
  demand: 'COMPUTE',
  name: 'Compute Gemma Cascade (model derives one arithmetic expression from the question text; '
    + 'two independent evaluators + N=3 self-consistency verify it -- ported from compute_sidecar.ts '
    + "'s BP137 Stage A.2)",
  taughtBy: 'D-BP164-M0-119/BISHOP-SEG/seg-compute. Founder order verbatim: "Build the COMPUTE+gemma '
    + 'method and rerun those 2." Ports the already battle-tested BP137 Yoke Stage A.2 pattern '
    + '(compute_sidecar.ts computeViaModelExpression) into the Liana Cycle for the first time -- '
    + 'built because both prior COMPUTE methods (arithmetic_cascade.ts, stage3_symbolic_cascade.ts) '
    + 'contain zero model-call code, and gemma had never answered a single Liana Cycle question '
    + '(D-BP164-M0-118 measurement). Not a single walked human case (canon rule 4) -- flagged here, '
    + 'not hidden, same disclosure convention arithmetic_cascade.ts and stage3_symbolic_cascade.ts '
    + 'already use for their own generic, Founder-ordered builds.',
  shapeDescription: 'a free-text question (no lettered options) carrying at least two numeric '
    + 'literals, for which the model may be able to derive a single verifiable arithmetic '
    + 'expression -- refuses honestly (HARDWIRE-22) when fewer than two numeric literals are '
    + "present; the model's own proposal is still independently recomputed and self-consistency-"
    + 'checked before ever being trusted as an answer.',
  shapeTest,
  run,
};

// Registers at import time, same convention as every other method module. Wired into
// liana_terminal_engine.ts's import list AFTER arithmetic_cascade/stage3_symbolic_cascade -- see
// this file's header for why that order is deliberate.
registerMethod(computeGemmaCascadeMethod);
