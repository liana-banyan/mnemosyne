// compute_sidecar.ts -- BP137 Yoke v2b Stage A: a REAL deterministic compute path for questions
// answer_type_classifier.ts flags 'computable'.
//
// WHY THIS FILE EXISTS (R-MECHANISM-VERIFY): the Appendix wiring map (verified by direct read
// this Yoke) confirmed specialist_adapters.ts's fetchWolframAlpha (:243-283) is a TEXT
// specialist ONLY -- it calls Wolfram's v2/query full-results endpoint
// (format=plaintext&output=JSON), joins pod text into an 800-char RAG snippet, and feeds that
// snippet to the letter-voters exactly like every other specialist. It is never used as a
// solver: nothing in src/main ever parses a numeric result out of it or maps a value to an MC
// option. No calculator/code-exec of any kind exists anywhere in src/main (confirmed: zero
// hits for a sandboxed-eval/expression-parser pattern outside this new file). This file is that
// missing solver. Additive; its only wired caller as of this Yoke is
// plow_mc_answerer.ts's runCanonicalPlowMcAnswer, gated behind
// config.researchArmMode && config.researchArmComputeSidecar (both default false/absent).
//
// Three solvers, tried in order (offline/free first, per the Nexus "user's own resources first"
// principle), NEVER guessing:
//   1. Local sandboxed arithmetic evaluator -- fires only when the question embeds a literal
//      numeric expression (e.g. "(24 + 6) / 3 * 2"). $0, offline, deterministic. "VERIFY by
//      recompute" (the Yoke's explicit requirement) is satisfied by requiring TWO independently
//      implemented evaluators (a hand-rolled recursive-descent parser and a whitelisted-
//      character-set Function() evaluator) to agree within float epsilon -- see
//      evaluateArithmeticVerified(). Disagreement, or either implementation failing, returns
//      null; falls through to solver 2.
//   2. BP137 Stage A.2 (added this Yoke): model-derived-expression compute. Stage A's tier 1
//      is honest but inert on real MMLU-Pro questions -- they are word problems ("bank has
//      $250,000 deposits, 20% reserve ratio, actual reserves?") with no literal number-op-number
//      substring for extractArithmeticExpression to find. This tier lets the SAME local Ollama
//      model already in play (no new model dependency) do the COMBINATION step only -- pick the
//      formula, plug in the question's own numbers, emit ONE arithmetic expression -- while the
//      existing two-independent-evaluator recompute (evaluateArithmeticVerified, same function
//      solver 1 uses) does the VERIFICATION. The model is never trusted to compute, only to
//      propose; see computeViaModelExpression() below for the self-consistency (N=3,
//      agree-2-of-3) honesty gate on top of that per-expression recompute. This is "components +
//      combination, verified by recompute" per SPEC_RESEARCH_ARM_SPIDER_SCOUT_SPRITE_CARRY_BP136.
//      Offline, $0, no new external dependency -- tried before Wolfram (which needs a paid key)
//      per "user's own resources first." BP137 Stage A.3 (added this Yoke): the caller may also
//      pass `componentFacts` -- the SAME post-relevance-gate facts the voters see -- as optional
//      reference material (formulas/constants the question itself never spells out) for the
//      model's combination step. This does not weaken the honesty gates: a bad/irrelevant fact
//      just fails to help the model converge, or the resulting value still has to clear
//      matchValueToOption's tolerance, same as if no facts had been supplied at all.
//   3. Wolfram Alpha's Short Answers "compute" endpoint (api.wolframalpha.com/v1/result) --
//      genuinely DIFFERENT from fetchWolframAlpha's v2/query text endpoint above; v1/result is
//      Wolfram's own designated single-value-answer solver, not a text-RAG source. Requires an
//      appid passed in explicitly by the caller (plow_mc_answerer.ts reads
//      process.env.WOLFRAM_APP_ID -- NOT the same key as specialistKeys.wolframApiKey, which
//      index.ts's MC-benchmark responder never populates on this path; see plow_mc_answerer.ts's
//      Stage A block comment). VERIFIED ABSENT in this dev environment (no WOLFRAM_APP_ID set)
//      -- this branch is wired but untested here; it fails closed (returns null), never
//      fabricates, when no key is present.
// If no solver produces a value, computeAnswer() returns null and the caller falls through to the
// pre-existing swarm+voter path, byte-for-byte unchanged -- "if it cannot compute, do not guess"
// per the Yoke prompt verbatim.

import { callOllama } from './canonical_pipeline';

export interface ComputeSidecarResult {
  value: number;
  expression: string;
  method: 'local_arithmetic' | 'model_derived_expression' | 'wolfram_compute';
}

export interface McOption {
  letter: string;
  text: string;
}

/** Extracts "A) text" / "B) text" ... lines from the exact prompt shape
 *  wan_dispatch.ts:158-161's buildMcPrompt() produces (verified file:line this Yoke): letter,
 *  close-paren, space, option text to end of line. Works whether or not substrate context was
 *  prepended above it (applySubstrateToggle only ever prepends text before this block, never
 *  rewrites it). */
export function parseOptionsFromPrompt(prompt: string): McOption[] {
  const options: McOption[] = [];
  const re = /^([A-J])\)\s*(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(prompt)) !== null) {
    options.push({ letter: m[1] as string, text: (m[2] as string).trim() });
  }
  return options;
}

/** First clean numeric token in a string: handles leading $, thousands commas, %, decimals, a
 *  leading minus sign. Returns null when no number is present. */
export function extractNumber(text: string): number | null {
  const cleaned = text.replace(/,/g, '');
  const m = cleaned.match(/-?\$?\d+(?:\.\d+)?%?/);
  if (!m) return null;
  const raw = m[0].replace(/[$%]/g, '');
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

/** Finds the option whose numeric value is closest to `value`, accepted ONLY within a relative
 *  tolerance -- "map to the nearest option" per the spec, bounded so an off-base computed value
 *  can never be silently forced onto whichever option happens to be least-far-away. Returns
 *  null (no match -- caller must fall through, not guess) when no option clears the tolerance. */
export function matchValueToOption(
  value: number,
  options: McOption[],
  relTolerance = 0.02,
): { letter: string; optionValue: number } | null {
  let best: { letter: string; optionValue: number; diff: number } | null = null;
  for (const opt of options) {
    const optValue = extractNumber(opt.text);
    if (optValue === null) continue;
    const diff = Math.abs(optValue - value);
    const tolerance = Math.max(Math.abs(value) * relTolerance, 1e-6);
    if (diff <= tolerance && (!best || diff < best.diff)) {
      best = { letter: opt.letter, optionValue: optValue, diff };
    }
  }
  return best ? { letter: best.letter, optionValue: best.optionValue } : null;
}

// --- Local sandboxed arithmetic evaluator (two independent implementations, must agree) -------

const ARITHMETIC_WHITELIST_RE = /^[\d+\-*/^().%\s]+$/;

/** Extracts the longest substring of `question` that looks like a standalone arithmetic
 *  expression (two or more numbers joined by binary operators). Deliberately conservative: most
 *  MMLU-Pro word problems (bank discounts, reserve ratios, dipole moments, entropy changes) have
 *  NO such literal substring -- they require an external formula the question never spells out
 *  as a bare expression -- so this correctly returns null for them rather than mis-extracting
 *  prose fragments as fake arithmetic. */
export function extractArithmeticExpression(question: string): string | null {
  const re = /-?\(?-?\d+(?:\.\d+)?\)?(?:\s*[+\-*/^%]\s*\(?-?\d+(?:\.\d+)?\)?)+/g;
  let best: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(question)) !== null) {
    const candidate = m[0].trim();
    if (!best || candidate.length > best.length) best = candidate;
  }
  return best;
}

/** Implementation 1: hand-rolled recursive-descent evaluator. Supports + - * / ^ ( ) and unary
 *  +/-. No eval()/Function() involved at all. */
function evaluateRecursiveDescent(expr: string): number | null {
  const s = expr.replace(/%/g, '').trim();
  let i = 0;
  const peek = (): string => s[i] ?? '';
  const skipWs = (): void => { while (s[i] === ' ') i++; };

  function parseNumber(): number {
    skipWs();
    const start = i;
    while (/[\d.]/.test(s[i] ?? '')) i++;
    if (i === start) throw new Error('expected number');
    const n = parseFloat(s.slice(start, i));
    if (!Number.isFinite(n)) throw new Error('bad number');
    return n;
  }
  function parseFactor(): number {
    skipWs();
    if (peek() === '(') {
      i++;
      const v = parseExpr();
      skipWs();
      if (peek() !== ')') throw new Error('expected )');
      i++;
      return v;
    }
    if (peek() === '-') { i++; return -parseFactor(); }
    if (peek() === '+') { i++; return parseFactor(); }
    return parseNumber();
  }
  function parsePow(): number {
    const base = parseFactor();
    skipWs();
    if (peek() === '^') { i++; return Math.pow(base, parsePow()); }
    return base;
  }
  function parseTerm(): number {
    let v = parsePow();
    skipWs();
    while (peek() === '*' || peek() === '/') {
      const op = peek(); i++;
      const rhs = parsePow();
      v = op === '*' ? v * rhs : v / rhs;
      skipWs();
    }
    return v;
  }
  function parseExpr(): number {
    let v = parseTerm();
    skipWs();
    while (peek() === '+' || peek() === '-') {
      const op = peek(); i++;
      const rhs = parseTerm();
      v = op === '+' ? v + rhs : v - rhs;
      skipWs();
    }
    return v;
  }

  try {
    const result = parseExpr();
    skipWs();
    if (i !== s.length) return null; // trailing garbage -- not a clean expression
    return Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

/** Implementation 2: independent cross-check. The whitelist regex (ARITHMETIC_WHITELIST_RE) is
 *  enforced BEFORE this ever constructs a Function -- no non-arithmetic character (letters,
 *  semicolons, backticks, template syntax, etc.) can reach it. This is the standard
 *  safe-arithmetic-eval pattern (validate-then-evaluate), not a raw eval() of untrusted text. */
function evaluateSandboxedFunction(expr: string): number | null {
  const s = expr.replace(/%/g, '');
  if (!ARITHMETIC_WHITELIST_RE.test(s)) return null;
  try {
    // eslint-disable-next-line no-new-func -- validated against ARITHMETIC_WHITELIST_RE above
    const fn = new Function(`"use strict"; return (${s.replace(/\^/g, '**')});`);
    const result: unknown = fn();
    return typeof result === 'number' && Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

/** "VERIFY by recompute" (the Yoke's explicit requirement): two independently-implemented
 *  evaluators must agree within float epsilon before a local-arithmetic result is trusted.
 *  Disagreement, or either implementation failing outright, means the expression is not cleanly
 *  computable -- returns null so the caller falls through rather than guessing. */
function evaluateArithmeticVerified(expr: string): number | null {
  const a = evaluateRecursiveDescent(expr);
  const b = evaluateSandboxedFunction(expr);
  if (a === null || b === null) return null;
  if (Math.abs(a - b) > Math.max(Math.abs(a) * 1e-9, 1e-9)) return null;
  return a;
}

// --- BP137 Stage A.2: model-derived-expression compute (combination by model, verified by
// --- recompute) -----------------------------------------------------------------------------

/** Sampled 3x at low-but-nonzero temperature so the 3 samples can actually disagree when the
 *  model is genuinely unsure of the formula -- temperature 0 would just repeat the same (possibly
 *  wrong) derivation 3 times and always "agree with itself," defeating the self-consistency
 *  check's purpose. */
const MODEL_EXPR_SAMPLE_COUNT = 3;
const MODEL_EXPR_SAMPLE_TEMPERATURE = 0.3;
const MODEL_EXPR_NUM_PREDICT = 60; // one short expression, not prose

/** BP137 Stage A.3: `componentFacts` are the SAME post-relevance-gate
 *  `factsForArbitration.slice(0,3)` strings plow_mc_answerer.ts already builds for the voters'
 *  `factsContext` (identical `[Source i -- source]: content` formatting, passed through
 *  unchanged, not reformatted here) -- the Founder's "components, not answers" design: the
 *  relevance-gated swarm already fetched the formula/constant the question itself never spells
 *  out (e.g. the elementary charge for the dipole question, the Cv relation for the entropy
 *  question); this just hands the model those SAME facts as optional ingredients for the
 *  COMBINATION step, never as an answer to copy. Absent/empty -- the default for every call that
 *  predates this Yoke, and for any computable question where the swarm found nothing -- produces
 *  the byte-identical Stage-A.2 prompt (see the isEmpty guard below). */
function buildModelExpressionPrompt(researchQuery: string, componentFacts?: string[]): string {
  const facts = componentFacts?.filter((f) => f.trim().length > 0) ?? [];
  const problemLine = `Problem: ${researchQuery}`;
  if (facts.length === 0) {
    return (
      'Read the problem below. Output ONLY a single-line arithmetic expression using +, -, *, /, ^, ' +
      'and parentheses, built from the numeric values given in the problem, that computes the ' +
      'answer. No prose, no units, no variable names, no explanation of any kind -- just the bare ' +
      'expression on one line. If you cannot derive such an expression, output exactly: NONE\n\n' +
      problemLine
    );
  }
  return (
    'Reference facts you MAY use (formulas, constants). Use ONLY the numbers you need; still ' +
    'output ONLY one arithmetic expression:\n' +
    `${facts.join('\n\n')}\n\n` +
    'Read the problem below. Output ONLY a single-line arithmetic expression using +, -, *, /, ^, ' +
    'and parentheses, built from the numeric values given in the problem (and, if needed, a ' +
    'constant from the reference facts above), that computes the answer. No prose, no units, no ' +
    'variable names, no explanation of any kind -- just the bare expression on one line. If you ' +
    'cannot derive such an expression, output exactly: NONE\n\n' +
    problemLine
  );
}

/** Isolates a candidate expression from a model's raw completion. Deliberately stricter than
 *  extractArithmeticExpression() (which scans word-problem PROSE for an embedded substring): the
 *  model was explicitly instructed to emit ONLY the expression, so here the ENTIRE first non-empty
 *  line must pass the arithmetic whitelist (ARITHMETIC_WHITELIST_RE) after light punctuation
 *  stripping -- any stray prose, units, or explanation the model adds anyway is treated as a
 *  malformed sample (null), not partially salvaged. Rejects a bare number (no operator) too --
 *  that is not a "derivation," it is the model dodging the instruction. */
export function extractExpressionFromModelOutput(raw: string): string | null {
  const firstLine = raw
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!firstLine) return null;
  if (/^none$/i.test(firstLine)) return null;
  const candidate = firstLine
    .replace(/^`+|`+$/g, '')
    .replace(/[;.]+$/, '')
    .trim();
  if (!ARITHMETIC_WHITELIST_RE.test(candidate)) return null;
  if (!/[+\-*/^]/.test(candidate.replace(/^-/, ''))) return null; // require an actual operator
  return candidate;
}

/** BP137 Stage A.2: the model proposes (COMBINATION -- pick the formula, plug in the problem's own
 *  numbers, emit one expression); this function never trusts that proposal on its own. Two layers
 *  of verify-by-recompute, both required:
 *    (a) PER-SAMPLE: every returned expression is run through the EXISTING
 *        evaluateArithmeticVerified() -- the same two-independent-evaluator cross-check solver 1
 *        uses. A sample whose own expression fails that internal recompute is discarded outright.
 *    (b) ACROSS-SAMPLES (self-consistency): the model is sampled MODEL_EXPR_SAMPLE_COUNT (3) times
 *        at a low-but-nonzero temperature. A value is only trusted if at least 2 of the 3 verified
 *        samples land on the SAME final numeric value (within float epsilon) -- i.e. the model
 *        converged on the same derivation from more than one independent decode, not a one-off
 *        confabulation. Fewer than 2 agreeing -> null, caller falls through to Wolfram (if keyed)
 *        or the untouched swarm+voter path. NEVER guesses; a disagreement is reported as
 *        fall-through, not forced onto an option.
 *  Calls run SEQUENTIALLY (not Promise.all), matching the existing MC-voter discipline at
 *  plow_mc_answerer.ts:529-535 (concurrent single-GPU Ollama generations previously produced
 *  all-null responses on this codebase's target hardware).
 *  BP137 Stage A.3: `componentFacts`, when present, are prepended to the prompt as optional
 *  reference material (see buildModelExpressionPrompt) -- they widen what the model CAN combine,
 *  they never bypass layers (a)/(b) above. A bad or irrelevant retrieved fact cannot force a wrong
 *  answer: it either fails to help the model converge (self-consistency still rejects, same as no
 *  facts) or the resulting value still has to clear matchValueToOption's tolerance downstream. */
export async function computeViaModelExpression(
  researchQuery: string,
  ollamaBaseUrl: string,
  model: string,
  componentFacts?: string[],
): Promise<{ value: number; expression: string } | null> {
  const prompt = buildModelExpressionPrompt(researchQuery, componentFacts);
  const samples: Array<{ expression: string; value: number } | null> = [];
  for (let i = 0; i < MODEL_EXPR_SAMPLE_COUNT; i++) {
    const raw = await callOllama(prompt, ollamaBaseUrl, model, MODEL_EXPR_SAMPLE_TEMPERATURE, MODEL_EXPR_NUM_PREDICT);
    if (raw === null || raw.trim().length === 0) {
      samples.push(null);
      continue;
    }
    const expr = extractExpressionFromModelOutput(raw);
    if (expr === null) {
      samples.push(null);
      continue;
    }
    const value = evaluateArithmeticVerified(expr); // per-sample recompute, layer (a)
    samples.push(value === null ? null : { expression: expr, value });
  }

  const successes = samples.filter((s): s is { expression: string; value: number } => s !== null);
  for (const candidate of successes) {
    const agreeing = successes.filter(
      (s) => Math.abs(s.value - candidate.value) <= Math.max(Math.abs(candidate.value) * 1e-6, 1e-6),
    );
    if (agreeing.length >= 2) {
      return { value: candidate.value, expression: candidate.expression }; // self-consistency, layer (b)
    }
  }
  return null; // disagreement or too few valid samples -- fall through, never guess
}

// --- Wolfram Alpha Short Answers "compute" endpoint ---------------------------------------------

/** A short-answer response is only accepted as a verified compute result when it is a single,
 *  clean numeric token -- never a best-effort parse of a prose/range response. This IS the
 *  "verify" step for the Wolfram branch (there is no second independent implementation to
 *  cross-check against for an external API, so the check is strict acceptance criteria instead). */
function isCleanSingleNumericAnswer(text: string): boolean {
  const t = text.trim();
  if (t.length === 0 || t.length > 60) return false;
  if (/\bto\b|\bapprox|\babout\b|\baround\b|\.\.\./i.test(t)) return false;
  const numberTokens = t.match(/-?\d+(?:\.\d+)?/g) ?? [];
  // Allow up to 2 tokens to admit scientific-notation shapes like "1.2 x 10^19" (mantissa +
  // exponent) without admitting genuine multi-value/range answers.
  return numberTokens.length >= 1 && numberTokens.length <= 2;
}

async function computeViaWolframAlpha(
  question: string,
  appId: string,
): Promise<{ value: number; raw: string } | null> {
  try {
    const url = `https://api.wolframalpha.com/v1/result?appid=${encodeURIComponent(appId)}&i=${encodeURIComponent(question)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let resp: Response;
    try {
      resp = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    // Wolfram returns HTTP 501 when it has no short answer -- a normal "cannot compute", not an
    // error to log/retry.
    if (!resp.ok) return null;
    const text = (await resp.text()).trim();
    if (!isCleanSingleNumericAnswer(text)) return null;
    const n = extractNumber(text);
    if (n === null) return null;
    return { value: n, raw: text };
  } catch {
    return null;
  }
}

export interface ComputeAnswerOptions {
  /** Independent of specialistKeys.wolframApiKey -- see this file's header for why. */
  wolframAppId?: string;
  /** BP137 Stage A.2: the SAME local Ollama peer/model plow_mc_answerer.ts already has in
   *  `config` (no new model dependency). Both must be present for tier 2 (model-derived
   *  expression) to run; either missing skips straight to tier 3 (Wolfram, if keyed) or null. */
  ollamaBaseUrl?: string;
  model?: string;
  /** BP137 Stage A.3: the post-relevance-gate `factsForArbitration.slice(0,3)` text
   *  plow_mc_answerer.ts already builds for the voters, passed through unchanged as optional
   *  reference material for tier 2's model-derived expression. Absent/empty is the Stage-A.2
   *  behavior (question-only prompt) -- see buildModelExpressionPrompt's isEmpty guard. */
  componentFacts?: string[];
}

/** Top-level entry point. `researchQuery` is the bare question text (no MC options -- the same
 *  string plow_mc_answerer.ts already threads through as `researchQuery`, distinct from
 *  `mcPromptWithSubstrate` which carries the options block; see parseOptionsFromPrompt above for
 *  extracting those separately). Returns null (never throws, never guesses) when no solver
 *  produces a verified value. Tries, in order: (1) local literal arithmetic, (2) BP137 Stage A.2
 *  model-derived expression (offline, needs ollamaBaseUrl+model), (3) Wolfram v1/result (external,
 *  needs wolframAppId) -- see this file's header for the full rationale on ordering. */
export async function computeAnswer(
  researchQuery: string,
  opts: ComputeAnswerOptions = {},
): Promise<ComputeSidecarResult | null> {
  const expr = extractArithmeticExpression(researchQuery);
  if (expr) {
    const value = evaluateArithmeticVerified(expr);
    if (value !== null) {
      return { value, expression: expr, method: 'local_arithmetic' };
    }
  }
  if (opts.ollamaBaseUrl && opts.model) {
    const modelResult = await computeViaModelExpression(researchQuery, opts.ollamaBaseUrl, opts.model, opts.componentFacts);
    if (modelResult) {
      return { value: modelResult.value, expression: modelResult.expression, method: 'model_derived_expression' };
    }
  }
  if (opts.wolframAppId) {
    const result = await computeViaWolframAlpha(researchQuery, opts.wolframAppId);
    if (result) {
      return { value: result.value, expression: researchQuery, method: 'wolfram_compute' };
    }
  }
  return null;
}
