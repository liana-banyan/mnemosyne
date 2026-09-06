// compute_select_cascade.ts -- D-BP165-M0-022/BISHOP-M0/SEG, THE MCQ-COMPUTE METHOD.
//
// FOUNDER ORDER, BP165, VERBATIM: "add a dedicated MCQ-compute method".
//
// WHY THIS FILE EXISTS, MEASURED BY THE DISPATCH THAT PRECEDED THIS ONE (D-BP165-M0-020): widening
// the structural COMPUTE demand detector took demand_unknown from 42 -> 21 (n=50, seed 42, dataset
// sha 51d7b60c...), and 14 of those newly-resolved items correctly land on demand COMPUTE -- then
// hit `no_method_matched`, because ALL THREE existing COMPUTE methods (arithmetic_cascade.ts,
// stage3_symbolic_cascade.ts, compute_gemma_cascade.ts) explicitly REFUSE any question carrying
// >=2 lettered options, deliberately, in their own shapeTest() gates. MMLU-Pro is multiple choice.
// Every COMPUTE method that existed before this dispatch is gated AGAINST multiple choice. That is
// the wall this file is the door through.
//
// WHY A NEW METHOD RATHER THAN WIDENING THE THREE (Founder's own deliberate choice, this dispatch):
// with an option pool present, the task is genuinely COMPUTE-THEN-SELECT, not compute -- a
// different operation, deserving its own method. THE THREE EXISTING COMPUTE METHODS' SHAPETESTS
// ARE UNTOUCHED BY THIS DISPATCH; their free-text-only gate stays exactly as it was. This file is
// an ADDITIVE sibling, never a widening of any of the three.
//
// THE CORE DISCIPLINE, INHERITED AND NON-NEGOTIABLE, REUSED BY IMPORT NOT REWRITTEN: the model
// derives ONE verifiable arithmetic expression and is NEVER trusted to compute it.
// compute_sidecar.ts's computeViaModelExpression() -- two independently-implemented evaluators
// recompute every sampled expression, N=3 samples, agree-2-of-3 self-consistency -- is imported
// and called directly, exactly as compute_gemma_cascade.ts already does. Nothing in that pipeline
// is copied, forked, or re-derived here.
//
// WHAT IS GENUINELY NEW HERE, AND IT IS ONLY THIS: THE SELECT STEP. Once compute_sidecar.ts hands
// back an independently-recomputed, self-consistent value, this file matches that value against
// the question's own lettered option pool and returns the matching letter -- see
// matchComputedValueToMcqOptions() below for the honesty gate (exactly one qualifying option, or
// abstain) and extractCandidateOptionValues() for why a bare first-numeric-token parse (the
// existing compute_sidecar.ts extractNumber()) is NOT reused for this: an MCQ option can embed a
// non-value numeric label ahead of its real value ("Policy 1: $52.00, Policy 2: $182.00" -- the
// bare-first-token parse would read "1", the list-item label, not either stated dollar amount).
// This is not a second arithmetic evaluator -- the arithmetic stays entirely inside
// compute_sidecar.ts, imported unchanged. This is the option-text parsing and matching logic the
// select step requires, and it did not exist anywhere in this codebase before this dispatch.
//
// THE NETWORK-CALLING ADAPTER BELOW (computeMcqCallModelInternal / computeMcqCallModel /
// computeMcqCallModelRich) IS A DELIBERATE, NAMED PARALLEL TO compute_gemma_cascade.ts's OWN
// ADAPTER, NOT A REUSE OF IT. compute_gemma_cascade.ts is one of the three siblings this dispatch
// is expressly forbidden to modify (its shapeTest, and by extension the whole file, is left
// exactly as it landed at D-BP164-M0-119/D-BP165-M0-006); its three call-adapter functions are
// module-private consts, never exported, so importing them would require touching that file. Per
// that file's own header, IT built its own adapter (rather than importing canonical_pipeline.ts's
// callOllama) for exactly the same reason THIS file builds its own here: think:false must be sent
// TOP-LEVEL, num_ctx must be capped at GEMMA_NUM_CTX_RUN_CAP, and every real round trip must be
// recorded through cost_instrument.ts's recordLlmCall() -- none of which the shared callOllama
// does. What IS reused by import, not duplicated, is everything upstream of the fetch() call
// itself: resolveGemmaModelDigest() and GEMMA_NUM_CTX_RUN_CAP (comparative_cascade.ts, both
// already exported for exactly this kind of reuse) and recordLlmCall() (cost_instrument.ts).
//
// THE HONESTY GATE (HARDWIRE-22): shapeTest() below claims ONLY a question carrying AT LEAST TWO
// lettered options, where a MAJORITY of those options carry a parseable numeric value, and the
// question text itself carries at least two numeric literals -- the same free-text numeric-literal
// minimum compute-gemma-cascade's own gate uses, applied here to the question portion only (the
// option list is not scanned for that count; it has its own separate majority-numeric check).
// Matching shapeTest() is NOT a promise of an answer: run() below still honestly abstains whenever
// (a) compute_sidecar.ts's own two-evaluator/self-consistency gate returns null (the DERIVATION
// step failed), or (b) the derived value fails to match EXACTLY ONE option within tolerance (the
// SELECT step failed -- zero options matched, or more than one did). Both failure classes are
// named individually in the outcome's `basis` string, never collapsed into one string.
//
// REGISTRATION ORDER (liana_terminal_engine.ts): imported LAST among the four COMPUTE-demand
// methods, after arithmetic_cascade.ts, stage3_symbolic_cascade.ts, and compute_gemma_cascade.ts.
// Per the Founder's BP165 ruling that selection now falls through on an internal abstain
// (method_registry.ts's selectEligibleMethods(), D-BP165-M0-006), registration order decides who
// is TRIED FIRST among methods whose shapeTest() both match the same question -- but that never
// actually happens here: this method's own shapeTest() requires >=2 lettered options, and all
// three siblings' shapeTest()s explicitly REFUSE any question carrying >=2 lettered options (their
// own free-text-only gate, unmodified by this dispatch). The two shape conditions are mutually
// exclusive by construction, so no COMPUTE-demand question can ever be eligible for both this
// method and one of the three siblings at once -- placement last is chronological (newest sibling
// added last, same convention compute_gemma_cascade.ts itself followed relative to the two SymPy
// methods before it), not a precedence decision that changes any outcome.

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput, MethodRunContext, ShapeTestResult } from '../method_registry';
import type { LianaTerminalOutcome } from '../../../shared/liana_cycle/liana_terminal_types';
import { computeViaModelExpression } from '../../plow/compute_sidecar';
import type { ModelCallFn, ModelCallFnRich, ModelExpressionSampleRecord } from '../../plow/compute_sidecar';
import { recordLlmCall } from '../cost_instrument';
import { resolveGemmaModelDigest, GEMMA_NUM_CTX_RUN_CAP } from './comparative_cascade';
import os from 'node:os';

const OLLAMA_API_BASE = process.env.OLLAMA_API_BASE ?? 'http://127.0.0.1:11434';
// SAME env-overridable model tag comparative_cascade.ts's/compute_gemma_cascade.ts's own MODEL
// constant uses -- no second, diverging model-selection convention.
const MODEL = process.env.CASCADE_MODEL ?? 'gemma4:12b';

function nowIso(): string {
  return new Date().toISOString();
}

// ─── THE NETWORK-CALLING ADAPTER -- SEE FILE HEADER FOR WHY THIS IS A NAMED PARALLEL TO
// ─── compute_gemma_cascade.ts's OWN ADAPTER, NOT A REUSE OF IT. ───────────────────────────────
interface GemmaCallInternalResult {
  ok: boolean;
  text: string | null;
  doneReason: string | null;
  failureKind?: 'transport_error' | 'http_error' | 'empty_response';
  detail?: string;
}

async function computeMcqCallModelInternal(
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

const computeMcqCallModel: ModelCallFn = async (prompt, ollamaBaseUrl, model, temperature, numPredict) => {
  const r = await computeMcqCallModelInternal(prompt, ollamaBaseUrl, model, temperature, numPredict);
  return r.ok ? (r.text as string) : null;
};

const computeMcqCallModelRich: ModelCallFnRich = async (prompt, ollamaBaseUrl, model, temperature, numPredict) => {
  const r = await computeMcqCallModelInternal(prompt, ollamaBaseUrl, model, temperature, numPredict);
  if (r.ok) return { ok: true, text: r.text as string, doneReason: r.doneReason };
  return { ok: false, failureKind: r.failureKind as 'transport_error' | 'http_error' | 'empty_response', detail: r.detail };
};

// ─── SHAPE GATE ─────────────────────────────────────────────────────────────────────────────────

// Same simple numeric-literal counter compute_gemma_cascade.ts's own shapeTest() uses, for the
// question-text half of this method's gate -- deliberately NOT the arithmetic evaluator (that
// logic lives, unduplicated, inside compute_sidecar.ts).
const NUMERIC_LITERAL_RE = /\d[\d,]*(?:\.\d+)?/g;
function countNumericLiterals(text: string): number {
  const matches = text.match(NUMERIC_LITERAL_RE);
  return matches ? matches.length : 0;
}
// Same minimum compute-gemma-cascade's own free-text gate uses: the fewest numeric literals a
// model could plausibly combine into a verifiable arithmetic expression at all.
const MIN_QUESTION_NUMERIC_LITERALS = 2;

/** Matches a numeric token that is either self-evidently a VALUE (carries a decimal point, a
 *  leading $/-, a trailing %, at least two digits, or is immediately followed by unit-looking
 *  letters -- "5 m/s", "600kg") or is the ENTIRE trimmed option text on its own (a bare
 *  single-digit option like "5" with nothing else in it is still a real value, just with no
 *  marker to distinguish it from a list-numbering label). A LONE single digit found ANYWHERE
 *  ELSE inside longer prose (e.g. the "1" in "Policy 1: $52.00") is deliberately EXCLUDED: it is
 *  far more often a list/sub-item label than a stated value, and admitting it would let a small
 *  integer computed value coincidentally "match" an unrelated label rather than a real quantity
 *  -- exactly the false-positive HARDWIRE-22 exists to prevent. This is why
 *  compute_sidecar.ts's own extractNumber() (a single-first-token parser, built for a bare
 *  option like "600" or "$103.11") is NOT reused verbatim here: an MC option can legitimately
 *  embed more than one numeric token, some of them labels, and extractNumber() has no way to
 *  tell them apart -- it would silently return whichever token happens to come first. */
const CANDIDATE_NUMBER_RE = /-?\$?(?:\d[\d,]*(?:\.\d+)?|\.\d+)%?/g;
export function extractCandidateOptionValues(text: string): number[] {
  const trimmed = text.trim();
  const values: number[] = [];
  CANDIDATE_NUMBER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CANDIDATE_NUMBER_RE.exec(trimmed)) !== null) {
    const raw = m[0];
    const numEnd = m.index + raw.length;
    const hasDecimal = raw.includes('.');
    const hasCurrency = raw.includes('$');
    const hasPercent = raw.endsWith('%');
    const digitCount = (raw.match(/\d/g) ?? []).length;
    const isWholeOption = m.index === 0 && numEnd === trimmed.length;
    const afterSlice = trimmed.slice(numEnd, numEnd + 2);
    const hasAdjacentUnitLetter = /^\s?[A-Za-z°µΩ]/.test(afterSlice);
    const qualifies = hasDecimal || hasCurrency || hasPercent || digitCount >= 2 || isWholeOption || hasAdjacentUnitLetter;
    if (!qualifies) continue;
    const cleaned = raw.replace(/,/g, '').replace(/[$%]/g, '');
    const n = parseFloat(cleaned);
    if (Number.isFinite(n)) values.push(n);
  }
  return values;
}

function countOptionsWithParseableValue(options: Record<string, string>): number {
  let n = 0;
  for (const text of Object.values(options)) {
    if (extractCandidateOptionValues(text).length > 0) n++;
  }
  return n;
}

function shapeTest(input: MethodQuestionInput): ShapeTestResult {
  // NEVER reads input.correctAnswer -- matches every other cascade's shapeTest() signature.
  const options = input.options;
  const optionCount = options ? Object.keys(options).length : 0;
  if (!options || optionCount < 2) {
    return {
      matches: false,
      reason: `${optionCount} lettered option(s) present -- compute-select-cascade only matches a `
        + 'question carrying >=2 lettered options (the INVERSE of arithmetic-cascade/'
        + 'stage3-symbolic-cascade/compute-gemma-cascade\'s free-text-only gate); a free-text '
        + 'question belongs to one of those three siblings instead, unmodified by this dispatch.',
    };
  }
  const numericOptionCount = countOptionsWithParseableValue(options);
  if (numericOptionCount * 2 <= optionCount) {
    return {
      matches: false,
      reason: `only ${numericOptionCount} of ${optionCount} options carry a parseable numeric `
        + 'value -- compute-select-cascade requires a MAJORITY of options to be numeric (this is a '
        + 'compute-THEN-select shape, not a text-classification one); refuses honestly rather than '
        + 'attempting a numeric select over a mostly non-numeric option pool.',
    };
  }
  const question = input.question || '';
  const numCount = countNumericLiterals(question);
  if (numCount < MIN_QUESTION_NUMERIC_LITERALS) {
    return {
      matches: false,
      reason: `only ${numCount} numeric literal(s) found in the question text -- `
        + `compute-select-cascade requires at least ${MIN_QUESTION_NUMERIC_LITERALS} for a model to `
        + 'plausibly derive a verifiable combining expression (HARDWIRE-22, same minimum '
        + 'compute-gemma-cascade\'s own free-text gate uses); refuses honestly rather than '
        + 'attempting a call with nothing in the question to combine.',
    };
  }
  return {
    matches: true,
    reason: `${optionCount} lettered options (${numericOptionCount} carry a parseable numeric `
      + `value, a majority), ${numCount} numeric literals in the question -- eligible for the model `
      + 'to attempt deriving one verifiable arithmetic expression, matched by VALUE against the '
      + 'option pool downstream. Still gated by compute_sidecar.ts\'s own two-evaluator recompute + '
      + 'N=3 agree-2-of-3 self-consistency check, AND by this method\'s own exactly-one-option-'
      + 'qualifies match rule (matchComputedValueToMcqOptions) -- matching here is not a promise of '
      + 'an answer.',
  };
}

// ─── THE SELECT STEP -- GENUINELY NEW, SEE FILE HEADER ─────────────────────────────────────────

/** Relative tolerance for matching a model-derived computed value to a stated MCQ option value.
 *  2% relative mirrors the tolerance already validated for MC option matching elsewhere in this
 *  codebase (compute_sidecar.ts's own matchValueToOption()/matchQuantityToOption(), both default
 *  relTolerance=0.02) -- published answer keys routinely round a computed value to 2-3 significant
 *  figures, and 2% is wide enough to absorb that rounding without being so wide it can straddle
 *  two distinct, legitimately different options. Exported as a named constant, never a magic
 *  number inline. NOT tuned by this dispatch to chase a higher match/accept rate -- the Founder's
 *  own order this dispatch is explicit: do not tune anything to improve accuracy or reduce
 *  abstains; this value is carried over unchanged from the codebase's own pre-existing precedent. */
export const MCQ_MATCH_REL_TOLERANCE = 0.02;
/** Absolute floor under the relative tolerance above, for a computed value near zero (where 2% of
 *  ~0 would otherwise collapse the tolerance band toward zero width and reject a legitimate
 *  rounding match). Same floor value compute_sidecar.ts's own matchValueToOption() already uses. */
export const MCQ_MATCH_ABS_TOLERANCE_FLOOR = 1e-6;

export type McqMatchResult =
  | { status: 'matched'; letter: string; optionValue: number }
  | { status: 'zero_match' }
  | { status: 'ambiguous_match'; letters: string[] };

/** THE HONESTY GATE (HARDWIRE-22). Exactly one qualifying option -> return it. Zero -> abstain,
 *  named 'zero_match' (the derivation likely does not correspond to any stated option -- NEVER
 *  silently mapped to the nearest option; "closest" is a guess wearing a verdict's clothes).
 *  More than one -> abstain, named 'ambiguous_match', carrying every qualifying letter so the
 *  transcript can name the ambiguity rather than silently picking the first. This is deliberately
 *  STRICTER than compute_sidecar.ts's own matchValueToOption() (which picks the single CLOSEST
 *  option among however many clear the tolerance band) -- that behavior is correct for its own
 *  callers but is exactly the "guess dressed as a verdict" this dispatch's honesty gate forbids
 *  for THIS method; matchQuantityToOption() already enforces the same exactly-one-qualifies rule
 *  this function does, but is unit-aware in a way that would reject a bare unitless computed
 *  value against a unit-bearing option ("5 m/s") that this method's own model-derived value
 *  (always a bare arithmetic result, never carrying a unit) should still be allowed to match by
 *  its numeric content -- so this function is written fresh rather than reused, per the dispatch's
 *  own framing that the SELECT step is the genuinely new part of this method. */
export function matchComputedValueToMcqOptions(
  value: number,
  options: Record<string, string>,
  relTolerance: number = MCQ_MATCH_REL_TOLERANCE,
): McqMatchResult {
  const tolerance = Math.max(Math.abs(value) * relTolerance, MCQ_MATCH_ABS_TOLERANCE_FLOOR);
  const qualifying: Array<{ letter: string; optionValue: number }> = [];
  for (const [letter, text] of Object.entries(options)) {
    const candidates = extractCandidateOptionValues(text);
    const best = candidates.find((c) => Math.abs(c - value) <= tolerance);
    if (best !== undefined) {
      qualifying.push({ letter, optionValue: best });
    }
  }
  if (qualifying.length === 0) return { status: 'zero_match' };
  if (qualifying.length > 1) {
    return { status: 'ambiguous_match', letters: qualifying.map((q) => q.letter).sort() };
  }
  return { status: 'matched', letter: qualifying[0]!.letter, optionValue: qualifying[0]!.optionValue };
}

// ─── run() ──────────────────────────────────────────────────────────────────────────────────────

async function run(input: MethodQuestionInput, ctx: MethodRunContext): Promise<LianaTerminalOutcome> {
  // NEVER reads input.correctAnswer. Derivation depends on input.question alone, exactly as
  // compute-gemma-cascade's own run() does -- the option pool is used ONLY downstream, for the
  // select step, never fed into the model's own derivation prompt.
  const question = input.question || '';
  const options = input.options ?? {};

  const sampleRecords: ModelExpressionSampleRecord[] = [];
  const onModelExpressionSample = (sample: ModelExpressionSampleRecord): void => {
    sampleRecords.push(sample);
    const rawPreview = sample.rawOutput
      ? `"${sample.rawOutput.text}"${sample.rawOutput.truncated ? ` (captured text truncated at display cap, real length ${sample.rawOutput.originalLength} chars)` : ''}`
      : '(no raw output captured for this sample)';
    ctx.emit({
      kind: 'note',
      text: `   compute-select-cascade sample ${sample.sampleIndex + 1}: ${sample.rejection}`
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
      computeMcqCallModel,
      onModelExpressionSample,
      computeMcqCallModelRich,
    );
  } catch (e) {
    return {
      question,
      verdict: null,
      abstain: true,
      freeText: false,
      method: 'compute-select-cascade',
      options,
      basis: `computeViaModelExpression (compute_sidecar.ts) threw: ${String((e as Error)?.message ?? e)}`,
    };
  }

  if (!modelResult) {
    // DERIVATION-STEP REFUSAL. Same per-sample naming discipline compute-gemma-cascade's own
    // run() uses -- named individually via sampleRecords, never collapsed into one string.
    const perSample = sampleRecords
      .map((s) => `sample ${s.sampleIndex + 1}: ${s.rejection}${s.doneReason ? ` (done_reason=${s.doneReason})` : ''}`)
      .join('; ');
    return {
      question,
      verdict: null,
      abstain: true,
      freeText: false,
      method: 'compute-select-cascade',
      options,
      basis: 'REFUSES at the DERIVATION step: no model-derived expression cleared '
        + 'compute_sidecar.ts\'s own two-evaluator recompute AND N=3 agree-2-of-3 self-consistency '
        + 'gate. ' + (perSample.length ? `Per-sample: ${perSample}.` : 'No sample records were captured (onSample never fired).'),
    };
  }

  // DERIVATION succeeded -- now the SELECT step, this method's own new logic.
  const match = matchComputedValueToMcqOptions(modelResult.value, options);
  const tolerance = Math.max(Math.abs(modelResult.value) * MCQ_MATCH_REL_TOLERANCE, MCQ_MATCH_ABS_TOLERANCE_FLOOR);

  if (match.status === 'zero_match') {
    return {
      question,
      verdict: null,
      abstain: true,
      freeText: false,
      method: 'compute-select-cascade',
      options,
      basis: `model (${MODEL}) derived expression "${modelResult.expression}" from the question `
        + 'text alone; two independent evaluators recomputed it and at least 2 of 3 sampled '
        + `derivations agreed on the value ${modelResult.value} (compute_sidecar.ts). REFUSES at `
        + `the SELECT step: ZERO of ${Object.keys(options).length} options carry a numeric value `
        + `within tolerance (+/- ${tolerance}) of ${modelResult.value}. Refusing rather than mapping `
        + 'to the nearest option (HARDWIRE-22) -- a computed value that matches nothing means the '
        + 'derivation most likely does not correspond to what this option set actually asks for.',
    };
  }
  if (match.status === 'ambiguous_match') {
    return {
      question,
      verdict: null,
      abstain: true,
      freeText: false,
      method: 'compute-select-cascade',
      options,
      basis: `model (${MODEL}) derived expression "${modelResult.expression}" from the question `
        + 'text alone; two independent evaluators recomputed it and at least 2 of 3 sampled '
        + `derivations agreed on the value ${modelResult.value} (compute_sidecar.ts). REFUSES at `
        + `the SELECT step: ${match.letters.length} options (${match.letters.join(', ')}) each carry `
        + `a numeric value within tolerance (+/- ${tolerance}) of ${modelResult.value} -- ambiguous, `
        + 'never picking the first (HARDWIRE-22).',
    };
  }
  return {
    question,
    verdict: match.letter,
    abstain: false,
    freeText: false,
    method: 'compute-select-cascade',
    options,
    basis: `model (${MODEL}) derived expression "${modelResult.expression}" from the question text `
      + 'alone (never reads a dataset answer field); two independent evaluators recomputed it and '
      + `at least 2 of 3 sampled derivations agreed on the value ${modelResult.value} `
      + `(compute_sidecar.ts). SELECT step: option ${match.letter} (stated value `
      + `${match.optionValue}) is the ONLY option within tolerance (+/- ${tolerance}) of `
      + `${modelResult.value} -- selected.`,
  };
}

export const computeSelectCascadeMethod: LianaMethod = {
  id: 'compute-select-cascade',
  demand: 'COMPUTE',
  name: 'Compute Select Cascade (model derives one arithmetic expression from the question text; '
    + 'two independent evaluators + N=3 self-consistency verify it -- compute_sidecar.ts, ported '
    + 'the same way compute-gemma-cascade already does -- then the derived value is matched, '
    + 'exactly-one-option-qualifies, against the question\'s own lettered MCQ option pool)',
  taughtBy: 'D-BP165-M0-022/BISHOP-M0/SEG. Founder order verbatim: "add a dedicated MCQ-compute '
    + 'method." Built because D-BP165-M0-020 measured 14 items resolving demand COMPUTE and then '
    + 'hitting no_method_matched, root-caused to all three pre-existing COMPUTE methods '
    + '(arithmetic_cascade.ts, stage3_symbolic_cascade.ts, compute_gemma_cascade.ts) explicitly '
    + 'refusing any question with >=2 lettered options -- MMLU-Pro is multiple choice, and no '
    + 'COMPUTE method before this one could ever run on it. Not a single walked human case (canon '
    + 'rule 4) -- flagged here, not hidden, same disclosure convention every generic Founder-'
    + 'ordered build in this registry already uses (see arithmetic_cascade.ts/'
    + 'stage3_symbolic_cascade.ts/compute_gemma_cascade.ts\'s own taughtBy fields).',
  shapeDescription: 'a question carrying >=2 lettered options, where a majority of those options '
    + 'state a parseable numeric value and the question text itself carries at least two numeric '
    + 'literals -- the model derives one verifiable arithmetic expression (never trusted to '
    + 'compute it; compute_sidecar.ts\'s two-evaluator recompute + N=3 self-consistency check '
    + 'verifies the value), then that value is matched against the option pool: exactly one '
    + 'qualifying option is required to answer, zero or more-than-one is an honest, named refusal.',
  shapeTest,
  run,
};

// Registers at import time, same convention as every other method module. Wired into
// liana_terminal_engine.ts's import list LAST among the four COMPUTE-demand methods -- see this
// file's own header for why that placement is chronological, not a precedence decision (the four
// methods' shape gates are mutually exclusive by construction).
registerMethod(computeSelectCascadeMethod);
