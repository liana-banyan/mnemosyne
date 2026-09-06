// methods/convention_locked_recompute.ts -- D-BP213-XO-56, LEG 4 of the four Didasko rounds.
//
// FOUNDER ORDER, 2026-09-03T19:04Z-20:xxZ (LEG 4 dispatch, following D-BP213-XO-32_FOUR_METHOD_
// SPECS.md METHOD 4 "CONVENTION-LOCKED RECOMPUTE"). Founding case: question_id 791 (internal qid
// 20), category business, src stemez-Business -- "Mr.Scaccioborrows $100 from his credit union and
// agrees to pay back $20 a month with interest of 1% per month on the unpaid balance. How much
// does he pay?" Answer key J, $103.00.
//
// THE DEFECT THIS FIXES. Two stacked failures, both real, both recorded in
// DIDASKO_ROUND04_qid791_COMPARED.md: (a) a short qualifying clause in the stem ("on the unpaid
// balance") settles which of several standard interest conventions governs, and a reader can read
// past it; (b) a CORRECTLY DECLARED convention can still be destroyed by arithmetic that silently
// drifts from what was declared. The Founder's flagship (Perplexity) declared the right convention
// verbatim, then computed a final payment of ~$6.62 instead of the correct $3.11 -- a total of
// $106.62, not even an option on the list, off by exactly $3.51 -- because nothing recomputed the
// method independently before the number was reported.
//
// D-BP213-XO-32_FOUR_METHOD_SPECS.md's own proposed "step 7" recompute check (sum the schedule's
// own per-row interest, confirm principal + total-interest = the schedule's own payment sum) is
// NOT USED HERE. It was proven, not merely suspected, to be a mathematical tautology: for ANY
// schedule obeying the stated recurrence (newBalance = balance + interest - payment) with a final
// balance of zero, summing the recurrence over all periods gives sum(payment) = principal +
// sum(interest) BY CONSTRUCTION, for any interest values at all, correct or not, because payment is
// DERIVED FROM interest in the very same recurrence the check re-sums. A standalone proof script
// (BISHOP_DROPZONE scratchpad, D-BP213-XO-56) reconstructed the flagship's exact $106.62 error from
// a single one-line interest miscalculation and confirmed the spec's step 7 passes it every time.
// Founder ruling, same dispatch, verbatim: "A CHECK THAT PASSES THE EXACT ERROR IT WAS DESIGNED TO
// CATCH IS WORSE THAN NO CHECK, BECAUSE IT MANUFACTURES CONFIDENCE." The spec is overruled; this
// file ships the replacement below.
//
// THE REPLACEMENT: an independent recompute driven ONLY from the three literal-extracted scalar
// inputs (principal, rate-per-period, fixed principal-per-period -- see the CONVENTION CORRECTION
// note on buildDecliningBalanceSchedule() below for exactly what that third input means and why)
// -- never from any row of the primary schedule. It is implemented via a DIFFERENT mathematical
// route: a closed-form sum over the arithmetic sequence of period-start balances, computed once
// from `principal`/`rate`/the per-period principal step directly, never by repeatedly subtracting
// from a running balance -- rather than a second pass over the same iterative subtraction loop the
// schedule builder uses -- so a bug in the schedule builder's own accumulation logic (an
// off-by-one, a wrong operand order, a dropped rounding step) is very unlikely to be reproduced
// identically in the closed-form computation. Stated honestly,
// not oversold: this is OPERATIONAL independence (a separately written function, a structurally
// different derivation, zero shared intermediate state) rather than a formal proof of independence
// across every conceivable bug class -- a bug in the shared UNDERSTANDING of the recurrence itself
// (e.g. both authored by the same mistaken reading of "on the unpaid balance") would not be caught
// by this or any other same-inputs check. What it demonstrably does catch, because the Founder
// ordered it proved rather than assumed: exactly the flagship's historical failure class, per the
// proof script referenced above.
//
// A STRUCTURAL NOTE THAT MATTERS FOR HOW THIS CHECK SHOULD BE READ. HARDWIRE-22 keeps ALL
// arithmetic in code -- gemma2:2b in this file NEVER computes anything, it only ever picks an
// index off a code-built menu of literal spans already present in the question text. That means
// the SPECIFIC failure mode that motivated step 7 in the record (an LLM's freeform, unconstrained
// arithmetic drifting from its own declared method) cannot occur in this method's production path
// at all -- Perplexity was allowed to compute; gemma2:2b here is not. The independent recompute
// below is retained anyway, as a software-correctness safeguard against a bug in THIS file's own
// TypeScript, not as a claim that it is still defending against the historical failure mode
// verbatim. Both facts are true and neither substitutes for the other; stating this plainly rather
// than implying the original motivation still applies unchanged.
//
// TRIGGER SCOPE, NARROWED DELIBERATELY. A zero-model-call scan of all 12,032 MMLU-Pro rows
// (BISHOP_DROPZONE scratchpad leg4_trigger_precision.mjs) found a broad "rate token + attached
// clause" reading matches 14-22 rows depending on tier, but only 7 to 9 of those are the real
// target shape on manual read: a business loan/depreciation item whose governing convention is
// explicitly named as "on the (unpaid|declining|remaining|outstanding) balance". The remaining
// matches (bare "compounded annually/quarterly" lump-sum future-value problems) are a DIFFERENT,
// unambiguous shape with no competing convention to lock -- and this file has no verified,
// worked-and-checked computation path for a flat-interest or compound-interest TOTAL-REPAID
// formula, only for declining-balance amortization (the one the record actually verifies). Rather
// than invent an unverified formula for those other conventions under time pressure, shapeTest()
// below is scoped ONLY to the declining-balance cue family. Founder-accepted verdict on this scope,
// same dispatch: "FIT... RARE AND COHERENT IS FINE... Leg 1 fires on one question in 12,032 and it
// is the only fully solved question we have."
//
// NON-NEGOTIABLE MACHINERY, carried forward unchanged from withheld_curve_shift_guard.ts (D-BP213-
// XO-41/-47/-48/-51/-58/-65), which this file was read in full before being written, specifically
// to copy its conventions rather than reinvent them: index-off-a-code-built-menu plus mandatory
// NONE, never free text; Ollama `format` grammar-constrained decoding; `num_predict` cut to 6 for
// every menu call; `think: false` top-level, no silent fallback; one ask per call, fully
// serialized; literal-substring verification on every extracted span; shapeTest() PURE, no I/O,
// never reads input.correctAnswer; abstain as the default at every decision point.

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput, MethodRunContext, ShapeTestResult } from '../method_registry';
import type { LianaTerminalOutcome } from '../../../shared/liana_cycle/liana_terminal_types';
import { recordLlmCall } from '../cost_instrument';
import { resolveGemmaModelDigest, GEMMA_NUM_CTX_RUN_CAP } from './comparative_cascade';
import os from 'node:os';

const OLLAMA_API_BASE = process.env.OLLAMA_API_BASE ?? 'http://127.0.0.1:11434';

// FOUNDER ORDER, LEG 4 dispatch, verbatim: "N=20 max, gemma2:2b local only, no sweep." This
// method's default is gemma2:2b, NOT withheld_curve_shift_guard.ts's gemma4:12b default -- a
// deliberate divergence, not a copy-paste miss.
const MODEL = process.env.CASCADE_MODEL ?? 'gemma2:2b';

function nowIso(): string {
  return new Date().toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// SHAPE DETECTION -- pure, no I/O. Shared by shapeTest() and run() so the two can never disagree
// about what counts as the convention-lock clause.
// ─────────────────────────────────────────────────────────────────────────────────────────────

const RATE_TOKEN_RE = /(\d+(?:\.\d+)?\s*%|\d+(?:\.\d+)?\s*percent\b)/i;

// The taught convention-cue table, narrowed to the ONE convention this file has a verified
// computation path for (declining-balance amortization) -- see the header note above for why
// "compounded X" and bare "flat"/"simple interest" cues are deliberately NOT matched here.
const DECLINING_BALANCE_CUE_RE =
  /\bon\s+(?:the|a|an)\s+(?:unpaid|declining|remaining|outstanding|reducing)\s+balance(?:\s+method)?\b/i;

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.?!])\s+/).filter((s) => s.length > 0);
}

/** Returns the first sentence that carries BOTH a rate/percentage token and the declining-balance
 *  convention-lock cue, or null. Pure string matching against a small, fixed, disclosed table --
 *  HARDWIRE-22 step-4 "a lookup", not a judgment -- so this runs in CODE, never sent to the model. */
function findConventionLockSentence(question: string): string | null {
  for (const sentence of splitSentences(question)) {
    if (RATE_TOKEN_RE.test(sentence) && DECLINING_BALANCE_CUE_RE.test(sentence)) {
      return sentence;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// shapeTest -- THE TRIGGER. Pure, no I/O, never reads input.correctAnswer.
// ─────────────────────────────────────────────────────────────────────────────────────────────

function shapeTest(input: MethodQuestionInput): ShapeTestResult {
  if (!input.options || Object.keys(input.options).length < 2) {
    return {
      matches: false,
      reason: 'no lettered option list with >=2 rows -- this method needs the option list for the ' +
        'final exact-dollar-amount lookup after the total is computed by code.',
    };
  }

  const question = input.question || '';
  const lockSentence = findConventionLockSentence(question);
  if (!lockSentence) {
    return {
      matches: false,
      reason: 'no sentence carries both a rate/percentage token and the declining-balance ' +
        'convention-lock cue ("on the unpaid/declining/remaining/outstanding balance[, method]") -- ' +
        'this method is deliberately narrowed to that one verified convention (see file header), ' +
        'not a general interest-word-problem solver.',
    };
  }

  return {
    matches: true,
    reason: `convention-lock sentence found: "${lockSentence}" -- declining-balance amortization ` +
      'convention confirmed by code lookup against a fixed cue table; eligible for masked ' +
      'principal/payment/rate extraction, schedule build, and independent closed-form recompute, ' +
      'options revealed only for the final exact-dollar-amount lookup.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Literal-substring helpers, same discipline as withheld_curve_shift_guard.ts.
// ─────────────────────────────────────────────────────────────────────────────────────────────

function isLiteralQuoteOf(quote: string, sourceText: string): boolean {
  const q = quote.toLowerCase().replace(/\s+/g, ' ').trim().replace(/^["'‘’“”]+|["'‘’“”]+$/g, '');
  const src = sourceText.toLowerCase().replace(/\s+/g, ' ');
  if (q.length === 0) return false;
  return src.includes(q);
}

function trimSpanPunctuation(raw: string): string {
  return raw.trim().replace(/^[."'‘’“”(]+|[.,;:"'‘’“”)]+$/g, '').trim();
}

/** Mechanically enumerates candidate literal clauses from `text`: a sentence-boundary split plus a
 *  comma/semicolon clause split, capped at 10 so the `format` enum handed to Ollama stays small.
 *  Every entry is, by construction, a literal substring of `text` -- this never invents or
 *  paraphrases, it only slices. Same "slice, never invent" discipline as
 *  withheld_curve_shift_guard.ts's extractCandidateSpans(). */
function extractCandidateClauses(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (raw: string): void => {
    const t = trimSpanPunctuation(raw);
    if (t.length === 0 || t.length > 200) return;
    const key = t.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) return;
    seen.add(key);
    out.push(t);
  };
  for (const part of text.split(/(?<=[.!?])\s+/)) add(part);
  for (const part of text.split(/[,;]/)) add(part);
  // D-BP213-XO-56 FIX (found live, before trusting a result -- see file header on this dispatch's
  // own discipline of proving rather than assuming): this method's founding example has NEITHER a
  // comma NOR multiple sentences before the question mark, so the two splits above produced only
  // TWO near-duplicate whole-sentence candidates, each containing BOTH the principal and the
  // payment dollar figures together -- an ill-posed menu no model could cleanly answer "which one
  // is JUST the principal" against, and gemma2:2b correctly (if unhelpfully) abstained to NONE on
  // it every time in a live N=20 run rather than guess. Fixed the same way withheld_curve_shift_
  // guard.ts's extractCandidateSpans() already solves this (see that file's own D-BP213-XO-48 fix
  // note): add a conjunction split and a preposition-boundary split, per sentence, so shorter,
  // targeted fragments ("$100 from his credit union", "pay back $20 a month") become their own
  // candidates instead of only ever appearing bundled inside the whole sentence.
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    for (const part of sentence.split(/\band\b/i)) add(part);
    for (const part of sentence.split(/\b(?:in|of|to|from|with|for)\b/i)) add(part);
  }
  add(text);
  return out.slice(0, 10);
}

// Shortest-first ordering: pairs with the "prefer the SHORTEST clause" instruction wording so the
// most specific, single-fact candidates land at the lowest (most salient) menu indices instead of
// being buried after several longer, multi-fact candidates. Found live to matter: without this,
// PAYMENT resolved to a long whole-sentence candidate that happened to ALSO contain the principal
// figure first, and firstDollarAmount() then read the wrong number out of it.
function shortestFirst(candidates: string[]): string[] {
  return [...candidates].sort((a, b) => a.length - b.length);
}

/** Candidate clauses restricted to ones that literally contain a dollar amount ($ followed by
 *  digits) -- the menu shown for PRINCIPAL and PAYMENT extraction. Still pure slicing of `text`. */
function extractDollarClauses(text: string): string[] {
  const DOLLAR_RE = /\$\s?\d[\d,]*(?:\.\d+)?/;
  return shortestFirst(extractCandidateClauses(text).filter((c) => DOLLAR_RE.test(c)));
}

/** Candidate clauses restricted to ones that literally contain a rate/percentage token -- the menu
 *  shown for RATE extraction. Still pure slicing of `text`. */
function extractRateClauses(text: string): string[] {
  return shortestFirst(extractCandidateClauses(text).filter((c) => RATE_TOKEN_RE.test(c)));
}

function buildMenuPrompt(instruction: string, candidates: string[], noneLabel: string): string {
  const lines = candidates.map((c, i) => `${i}: ${c}`);
  const noneIndex = candidates.length;
  lines.push(`${noneIndex}: ${noneLabel}`);
  return `${instruction}\n\nOptions:\n${lines.join('\n')}\n\n` +
    'Respond with ONLY the number of the option you choose. No words, no punctuation, no ' +
    'explanation -- a single integer and nothing else.';
}

function menuFormatSchema(candidateCount: number): { type: 'integer'; enum: number[] } {
  const values: number[] = [];
  for (let i = 0; i <= candidateCount; i += 1) values.push(i);
  return { type: 'integer', enum: values };
}

function parseMenuIndex(text: string, maxIndex: number): number | null {
  const trimmed = text.trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n) || n < 0 || n > maxIndex) return null;
  return n;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// The masked extraction calls -- pure copy-out (index selection), never a computation, never
// shown the option list. One call per field, all serial (never bundled). Same
// think:false/format/num_predict discipline as withheld_curve_shift_guard.ts's callModelExtraction.
// ─────────────────────────────────────────────────────────────────────────────────────────────

interface ModelCallResult {
  ok: boolean;
  text: string | null;
  detail?: string;
}

async function callModelExtraction(
  prompt: string,
  callOpts?: { format?: { type: 'integer'; enum: number[] }; numPredict?: number },
): Promise<ModelCallResult> {
  const tsStart = nowIso();
  const t0 = Date.now();
  const modelDigest = await resolveGemmaModelDigest(MODEL);
  let res: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    res = await fetch(`${OLLAMA_API_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false,
        think: false,
        ...(callOpts?.format ? { format: callOpts.format } : {}),
        options: {
          temperature: 0.2,
          num_predict: callOpts?.numPredict ?? 6,
          num_ctx: GEMMA_NUM_CTX_RUN_CAP,
        },
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
  } catch (err) {
    const detail = `transport failure, no HTTP response received: ${err instanceof Error ? err.message : String(err)}`;
    recordLlmCall({
      model: MODEL, modelDigest, machineId: os.hostname(), ts_start: tsStart, ts_end: nowIso(),
      latency_ms: Date.now() - t0, tokens: { measured: false, reason: detail },
    });
    return { ok: false, text: null, detail };
  }
  if (res.ok === false) {
    const detail = `HTTP ${res.status} error response from Ollama`;
    recordLlmCall({
      model: MODEL, modelDigest, machineId: os.hostname(), ts_start: tsStart, ts_end: nowIso(),
      latency_ms: Date.now() - t0, tokens: { measured: false, reason: detail },
    });
    return { ok: false, text: null, detail };
  }
  try {
    const j = (await res.json()) as { response?: string; prompt_eval_count?: number; eval_count?: number };
    const hasCounts = typeof j.prompt_eval_count === 'number' && typeof j.eval_count === 'number';
    recordLlmCall({
      model: MODEL, modelDigest, machineId: os.hostname(), ts_start: tsStart, ts_end: nowIso(),
      latency_ms: Date.now() - t0,
      tokens: hasCounts
        ? { measured: true, input_tokens: j.prompt_eval_count as number, output_tokens: j.eval_count as number }
        : { measured: false, reason: 'Ollama response body did not include prompt_eval_count/eval_count fields' },
    });
    const text = (j.response ?? '').trim();
    if (text.length === 0) return { ok: false, text: null, detail: 'Ollama returned an empty response field' };
    return { ok: true, text };
  } catch (err) {
    const detail = `res.json() itself threw, body was not JSON: ${err instanceof Error ? err.message : String(err)}`;
    recordLlmCall({
      model: MODEL, modelDigest, machineId: os.hostname(), ts_start: tsStart, ts_end: nowIso(),
      latency_ms: Date.now() - t0, tokens: { measured: false, reason: detail },
    });
    return { ok: false, text: null, detail };
  }
}

// D-BP213-XO-56 FIX, found live (before trusting a result): the first wording of these three
// instructions let the model pick a LONGER option that happened to also mention the right fact
// among others, rather than the SHORT option stating only that fact -- on a live run this made
// PAYMENT resolve to the whole-sentence candidate (which starts with the PRINCIPAL's $100, not the
// $20 payment), and this file's firstDollarAmount() then read the wrong number out of it. Fixed
// the same way withheld_curve_shift_guard.ts's changeInstruction() already avoids this ("the
// SHORTEST phrase naming...") -- both add the same explicit shortest-match instruction and this
// file additionally warns against a longer option that only happens to mention the fact.
function principalInstruction(): string {
  return 'Below is a loan/interest word problem. Which numbered option is the SHORTEST clause ' +
    'stating the ORIGINAL PRINCIPAL -- the amount borrowed or loaned at the very start, before any ' +
    'payments? Prefer a short option naming ONLY the principal over a longer option that merely ' +
    'also mentions it alongside other information. If no such amount is literally stated, choose ' +
    'the NONE option. Pick the single best match; do not combine options.';
}
function paymentInstruction(): string {
  return 'Below is a loan/interest word problem. Which numbered option is the SHORTEST clause ' +
    'stating the FIXED PERIODIC PAYMENT -- the amount paid back each period (e.g. each month)? ' +
    'Prefer a short option naming ONLY the payment over a longer option that merely also mentions ' +
    'it alongside other information (such as the principal). If no such amount is literally ' +
    'stated, choose the NONE option. Pick the single best match; do not combine options.';
}
// D-BP213-XO-56 FIX, found live: RATE does NOT need the "prefer SHORTEST" framing that PRINCIPAL
// and PAYMENT need above -- this question's stem only ever names ONE rate/percentage figure, so
// any candidate clause containing it (long or short) yields the same correctly-parsed number via
// firstRatePercent()'s first-match extraction; there is no multi-fact ambiguity to break a tie on.
// Direct probes against the live Ollama endpoint (curl, both a minimal 2-option framing and the
// real 5-option production menu) showed gemma2:2b consistently prefers a LONGER, more complete-
// sentence-shaped option over a short fragment for this kind of pick -- the opposite bias from
// what PRINCIPAL/PAYMENT needed -- and adding "prefer SHORTEST" here fought that natural
// preference and pushed the model to NONE instead of resolving it. Plain wording, no shortest
// bias, resolves correctly and consistently on direct probe.
function rateInstruction(): string {
  return 'Below is a loan/interest word problem. Which numbered option is the clause stating the ' +
    'INTEREST RATE PER PERIOD -- the percentage charged each period? If no such rate is literally ' +
    'stated, choose the NONE option. Pick the single best match.';
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Numeric parsing of an already-verified literal clause. Deterministic regex extraction of the
// FIRST dollar amount / percentage inside a clause CODE and the MODEL have already jointly agreed
// names that field -- this is not a second decision, it is reading the number out of a span
// already committed to.
// ─────────────────────────────────────────────────────────────────────────────────────────────

function firstDollarAmount(clause: string): number | null {
  const m = clause.match(/\$\s?(\d[\d,]*(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number.parseFloat(m[1].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function firstRatePercent(clause: string): number | null {
  // FIX (caught by convention_locked_recompute.test.ts before any live run): the trailing `\b`
  // must apply only to the "percent" word alternative -- a bare "%" sign is not a word character,
  // so `\b` right after it never matches when "%" is followed by a space (as in "1% per month"),
  // and the whole regex silently failed on the founding example's own exact phrasing.
  const m = clause.match(/(\d+(?:\.\d+)?)\s*(?:%|percent\b)/i);
  if (!m) return null;
  const n = Number.parseFloat(m[1]);
  return Number.isFinite(n) ? n / 100 : null;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ARITHMETIC -- 100% CODE, NEVER THE MODEL. HARDWIRE-22: "THE CODE DECIDES. ALWAYS." Two
// INDEPENDENT implementations, deliberately structured differently (see header note), cross-
// checked before any total is trusted.
// ─────────────────────────────────────────────────────────────────────────────────────────────

interface ScheduleRow {
  period: number;
  balance: number;
  interest: number;
  payment: number;
  newBalance: number;
}

const MAX_PERIODS = 1200; // safety cap; a real loan resolving this method's shape resolves in single digits.

/** PRIMARY: iterative declining-balance schedule, one row at a time, exactly the procedure named
 *  in D-BP213-XO-32_FOUR_METHOD_SPECS.md METHOD 4 steps 5-6 (never a one-shot closed-form
 *  shortcut for the schedule itself -- the record's own case shows that diverging). */
// D-BP213-XO-56 CONVENTION CORRECTION, found live and checked against the primary record before
// trusting it (not assumed). The first version of this function treated the extracted "$20 a
// month" figure as a FIXED TOTAL PAYMENT (interest paid first, principal absorbing the rest, a
// final smaller "stub" period clearing whatever remains) -- a legitimate declining-balance reading
// in general, but it lands on $103.11 for the founding example, not the published key's $103.00,
// and requires a 6th irregular period the record's own primary source (BM0's actual SEALED
// schedule, DIDASKO_ROUND04_qid791_BM0_HALF_SEALED.md, re-verified here, NOT the flawed spec
// illustration flagged in this file's header) does not use. BM0's real, correct, key-matching
// schedule treats "$20 a month" as a FIXED PRINCIPAL REDUCTION per period, with interest computed
// on the balance BEFORE that period's principal reduction and ADDED on top as extra cash paid that
// period -- five clean $20 principal steps, no stub period, total $103.00 exactly, matching option
// J. This is the convention actually verified against a real answer key in this campaign, so it is
// the one this file ships; the level-total-payment convention above is a DIFFERENT interpretation
// of the same English sentence, disclosed here as a real, present ambiguity but not the one this
// method resolves to.
function buildDecliningBalanceSchedule(
  principal: number,
  ratePerPeriod: number,
  fixedPrincipalPerPeriod: number,
): ScheduleRow[] | null {
  if (fixedPrincipalPerPeriod <= 0) return null;
  const rows: ScheduleRow[] = [];
  let balance = principal;
  let period = 0;
  while (balance > 0.005) {
    period += 1;
    if (period > MAX_PERIODS) return null;
    const interest = Math.round(balance * ratePerPeriod * 100) / 100;
    const principalPortion = Math.round(Math.min(fixedPrincipalPerPeriod, balance) * 100) / 100;
    const payment = Math.round((principalPortion + interest) * 100) / 100;
    const newBalance = Math.round((balance - principalPortion) * 100) / 100;
    rows.push({ period, balance, interest, payment, newBalance });
    balance = newBalance;
  }
  return rows;
}

function scheduleTotal(rows: ScheduleRow[]): number {
  return Math.round(rows.reduce((s, r) => s + r.payment, 0) * 100) / 100;
}

/** INDEPENDENT RECOMPUTE, THE STEP-7 REPLACEMENT. Computed ONLY from (principal, ratePerPeriod,
 *  fixedPrincipalPerPeriod) -- never reads a ScheduleRow. Under the fixed-principal-per-period
 *  convention above, the balance at the START of period i (0-indexed) is simply
 *  principal - i*fixedPrincipalPerPeriod -- an ARITHMETIC sequence, not the geometric-compounding
 *  identity the level-total-payment convention would need. That is a genuinely different
 *  mathematical shape from the iterative subtraction loop above (a closed-form sum over an
 *  arithmetic series, computed once, rather than repeated per-period subtraction), so a bug in the
 *  loop's running-balance bookkeeping does not propagate here. See the file header for what
 *  "independent" does and does not mean. Returns null if principal is not an exact multiple of
 *  fixedPrincipalPerPeriod (this convention's schedule does not resolve evenly -- CANNOT DECIDE,
 *  not a guess) or if the rate is non-positive. */
function independentRecompute(
  principal: number,
  ratePerPeriod: number,
  fixedPrincipalPerPeriod: number,
): number | null {
  if (ratePerPeriod <= 0 || fixedPrincipalPerPeriod <= 0) return null;
  const n = Math.round(principal / fixedPrincipalPerPeriod);
  if (n <= 0 || n > MAX_PERIODS) return null;
  if (Math.abs(n * fixedPrincipalPerPeriod - principal) > 0.005) return null; // does not divide evenly
  // Closed-form sum of the arithmetic sequence of period-start balances: principal, principal-Δ,
  // principal-2Δ, ..., principal-(n-1)Δ, where Δ = fixedPrincipalPerPeriod.
  const sumOfPeriodStartBalances = n * principal - fixedPrincipalPerPeriod * (n * (n - 1)) / 2;
  const totalInterest = ratePerPeriod * sumOfPeriodStartBalances;
  return Math.round((principal + totalInterest) * 100) / 100;
}

function normalizeMoney(text: string): number | null {
  const m = text.match(/\$?\s?(\d[\d,]*(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number.parseFloat(m[1].replace(/,/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// run() -- masked extraction, code-only schedule + independent recompute, THEN reveal options for
// an exact-dollar-amount lookup only.
// ─────────────────────────────────────────────────────────────────────────────────────────────

async function run(input: MethodQuestionInput, ctx: MethodRunContext): Promise<LianaTerminalOutcome> {
  const question = input.question || '';
  const options = input.options;

  try {
    const shape = shapeTest(input);
    if (!shape.matches || !options) {
      return {
        question, verdict: null, abstain: true, freeText: false, method: 'convention-locked-recompute',
        basis: 'shapeTest should have refused before run() was ever called; defensive re-check ' +
          `failed: ${shape.reason}`,
      };
    }

    const lockSentence = findConventionLockSentence(question);
    if (!lockSentence) {
      return {
        question, verdict: null, abstain: true, freeText: false, method: 'convention-locked-recompute',
        basis: 'INTERNAL INVARIANT FAILURE: shapeTest matched but findConventionLockSentence ' +
          'returned null on re-run inside run() -- both call the same pure function, this should ' +
          'be impossible; refusing rather than guessing.',
      };
    }

    ctx.emit({
      kind: 'stage',
      text: `   convention-locked-recompute: convention lock sentence = "${lockSentence}" -- ` +
        'declining-balance amortization confirmed by CODE lookup (no model call for this decision)',
      ts: nowIso(),
    });

    // ---- PRINCIPAL extraction ----
    const principalCandidates = extractDollarClauses(question);
    ctx.emit({
      kind: 'stage',
      text: '   convention-locked-recompute: extracting PRINCIPAL via numbered menu (options ' +
        'masked, one call, serialized)',
      ts: nowIso(),
    });
    const principalMenuText = buildMenuPrompt(principalInstruction(), principalCandidates, 'NONE / NOT STATED');
    ctx.emit({ kind: 'fact', text: `   PRINCIPAL MENU:\n${principalMenuText}`, ts: nowIso() });
    const principalResp = await callModelExtraction(principalMenuText, {
      format: menuFormatSchema(principalCandidates.length), numPredict: 6,
    });
    if (!principalResp.ok || principalResp.text === null) {
      return {
        question, verdict: null, abstain: true, freeText: false, method: 'convention-locked-recompute',
        basis: `PRINCIPAL menu call failed: ${principalResp.detail ?? 'unknown failure'}`,
      };
    }
    const principalIdx = parseMenuIndex(principalResp.text, principalCandidates.length);
    if (principalIdx === null) {
      return {
        question, verdict: null, abstain: true, freeText: false, method: 'convention-locked-recompute',
        basis: `PRINCIPAL menu response "${principalResp.text}" was not a single in-range integer ` +
          `(0..${principalCandidates.length}) despite format-constrained decoding, refused.`,
      };
    }
    if (principalIdx === principalCandidates.length) {
      return {
        question, verdict: null, abstain: true, freeText: false, method: 'convention-locked-recompute',
        basis: 'model selected NONE for PRINCIPAL -- cannot build a schedule without it, honest abstain.',
      };
    }
    const principalClause = principalCandidates[principalIdx];
    if (!isLiteralQuoteOf(principalClause, question)) {
      return {
        question, verdict: null, abstain: true, freeText: false, method: 'convention-locked-recompute',
        basis: `INTERNAL INVARIANT FAILURE: PRINCIPAL candidate "${principalClause}" (index ` +
          `${principalIdx}) is not a literal substring of the question -- extraction bug, not a ` +
          'model error.',
      };
    }
    const principal = firstDollarAmount(principalClause);
    if (principal === null || principal <= 0) {
      return {
        question, verdict: null, abstain: true, freeText: false, method: 'convention-locked-recompute',
        basis: `PRINCIPAL clause "${principalClause}" chosen by the model contains no parseable, ` +
          'positive dollar amount -- honest abstain rather than guessing a number.',
      };
    }

    // ---- PAYMENT extraction ----
    ctx.emit({
      kind: 'stage',
      text: '   convention-locked-recompute: extracting PAYMENT via numbered menu (options masked, ' +
        'one call, serialized)',
      ts: nowIso(),
    });
    const paymentMenuText = buildMenuPrompt(paymentInstruction(), principalCandidates, 'NONE / NOT STATED');
    ctx.emit({ kind: 'fact', text: `   PAYMENT MENU:\n${paymentMenuText}`, ts: nowIso() });
    const paymentResp = await callModelExtraction(paymentMenuText, {
      format: menuFormatSchema(principalCandidates.length), numPredict: 6,
    });
    if (!paymentResp.ok || paymentResp.text === null) {
      return {
        question, verdict: null, abstain: true, freeText: false, method: 'convention-locked-recompute',
        basis: `PAYMENT menu call failed: ${paymentResp.detail ?? 'unknown failure'}`,
      };
    }
    const paymentIdx = parseMenuIndex(paymentResp.text, principalCandidates.length);
    if (paymentIdx === null) {
      return {
        question, verdict: null, abstain: true, freeText: false, method: 'convention-locked-recompute',
        basis: `PAYMENT menu response "${paymentResp.text}" was not a single in-range integer ` +
          `(0..${principalCandidates.length}) despite format-constrained decoding, refused.`,
      };
    }
    if (paymentIdx === principalCandidates.length) {
      return {
        question, verdict: null, abstain: true, freeText: false, method: 'convention-locked-recompute',
        basis: 'model selected NONE for PAYMENT -- cannot build a schedule without it, honest abstain.',
      };
    }
    const paymentClause = principalCandidates[paymentIdx];
    if (!isLiteralQuoteOf(paymentClause, question)) {
      return {
        question, verdict: null, abstain: true, freeText: false, method: 'convention-locked-recompute',
        basis: `INTERNAL INVARIANT FAILURE: PAYMENT candidate "${paymentClause}" (index ` +
          `${paymentIdx}) is not a literal substring of the question -- extraction bug, not a ` +
          'model error.',
      };
    }
    const fixedPayment = firstDollarAmount(paymentClause);
    if (fixedPayment === null || fixedPayment <= 0) {
      return {
        question, verdict: null, abstain: true, freeText: false, method: 'convention-locked-recompute',
        basis: `PAYMENT clause "${paymentClause}" chosen by the model contains no parseable, ` +
          'positive dollar amount -- honest abstain rather than guessing a number.',
      };
    }
    if (paymentIdx === principalIdx) {
      return {
        question, verdict: null, abstain: true, freeText: false, method: 'convention-locked-recompute',
        basis: 'model selected the SAME clause for both PRINCIPAL and PAYMENT -- structurally ' +
          `implausible (clause: "${principalClause}"), honest abstain rather than trusting a ` +
          'collapsed extraction.',
      };
    }

    // ---- RATE extraction ----
    const rateCandidates = extractRateClauses(question);
    ctx.emit({
      kind: 'stage',
      text: '   convention-locked-recompute: extracting RATE PER PERIOD via numbered menu (options ' +
        'masked, one call, serialized)',
      ts: nowIso(),
    });
    const rateMenuText = buildMenuPrompt(rateInstruction(), rateCandidates, 'NONE / NOT STATED');
    ctx.emit({ kind: 'fact', text: `   RATE MENU:\n${rateMenuText}`, ts: nowIso() });
    const rateResp = await callModelExtraction(rateMenuText, {
      format: menuFormatSchema(rateCandidates.length), numPredict: 6,
    });
    if (!rateResp.ok || rateResp.text === null) {
      return {
        question, verdict: null, abstain: true, freeText: false, method: 'convention-locked-recompute',
        basis: `RATE menu call failed: ${rateResp.detail ?? 'unknown failure'}`,
      };
    }
    const rateIdx = parseMenuIndex(rateResp.text, rateCandidates.length);
    if (rateIdx === null) {
      return {
        question, verdict: null, abstain: true, freeText: false, method: 'convention-locked-recompute',
        basis: `RATE menu response "${rateResp.text}" was not a single in-range integer ` +
          `(0..${rateCandidates.length}) despite format-constrained decoding, refused.`,
      };
    }
    if (rateIdx === rateCandidates.length) {
      return {
        question, verdict: null, abstain: true, freeText: false, method: 'convention-locked-recompute',
        basis: 'model selected NONE for RATE -- cannot build a schedule without it, honest abstain.',
      };
    }
    const rateClause = rateCandidates[rateIdx];
    if (!isLiteralQuoteOf(rateClause, question)) {
      return {
        question, verdict: null, abstain: true, freeText: false, method: 'convention-locked-recompute',
        basis: `INTERNAL INVARIANT FAILURE: RATE candidate "${rateClause}" (index ${rateIdx}) is ` +
          'not a literal substring of the question -- extraction bug, not a model error.',
      };
    }
    const ratePerPeriod = firstRatePercent(rateClause);
    if (ratePerPeriod === null || ratePerPeriod <= 0 || ratePerPeriod >= 1) {
      return {
        question, verdict: null, abstain: true, freeText: false, method: 'convention-locked-recompute',
        basis: `RATE clause "${rateClause}" chosen by the model contains no parseable, plausible ` +
          '(0-100%) rate -- honest abstain rather than guessing a number.',
      };
    }

    ctx.emit({
      kind: 'fact',
      text: `   convention-locked-recompute extracted, all as verified literal spans: PRINCIPAL=` +
        `$${principal.toFixed(2)} (from "${principalClause}") PAYMENT=$${fixedPayment.toFixed(2)} ` +
        `(from "${paymentClause}") RATE=${(ratePerPeriod * 100).toFixed(4)}% per period (from ` +
        `"${rateClause}")`,
      ts: nowIso(),
    });

    // ---- CODE-ONLY ARITHMETIC: schedule + independent recompute ----
    const rows = buildDecliningBalanceSchedule(principal, ratePerPeriod, fixedPayment);
    if (rows === null) {
      return {
        question, verdict: null, abstain: true, freeText: false, method: 'convention-locked-recompute',
        basis: `schedule did not terminate within ${MAX_PERIODS} periods -- refusing rather than ` +
          'returning a partial or runaway result.',
      };
    }
    const primaryTotal = scheduleTotal(rows);

    ctx.emit({
      kind: 'fact',
      text: '   PRIMARY SCHEDULE (code-only, model never computes):\n' +
        rows.map((r) => `     period ${r.period}: balance ${r.balance.toFixed(2)}  interest ` +
          `${r.interest.toFixed(2)}  payment ${r.payment.toFixed(2)}  new balance ${r.newBalance.toFixed(2)}`).join('\n') +
        `\n     TOTAL (schedule sum) = $${primaryTotal.toFixed(2)}`,
      ts: nowIso(),
    });

    const independentTotal = independentRecompute(principal, ratePerPeriod, fixedPayment);
    if (independentTotal === null) {
      return {
        question, verdict: null, abstain: true, freeText: false, method: 'convention-locked-recompute',
        basis: 'independent closed-form recompute did not resolve (rate<=0 or exceeded the period ' +
          'cap) -- refusing rather than trusting the unchecked schedule total alone.',
      };
    }

    ctx.emit({
      kind: 'fact',
      text: `   INDEPENDENT RECOMPUTE (separate closed-form derivation from principal/rate/payment ` +
        `alone, never reads a schedule row) = $${independentTotal.toFixed(2)}`,
      ts: nowIso(),
    });

    if (Math.abs(primaryTotal - independentTotal) > 0.005) {
      return {
        question, verdict: null, abstain: true, freeText: false, method: 'convention-locked-recompute',
        basis: `EXECUTION MISMATCH: primary schedule total $${primaryTotal.toFixed(2)} disagrees ` +
          `with independent closed-form recompute $${independentTotal.toFixed(2)}. Per the ` +
          'method\'s own founding lesson, reporting either number when they disagree is exactly ' +
          'the failure this file exists to prevent -- stopping instead.',
      };
    }

    ctx.emit({
      kind: 'stage',
      text: `   convention-locked-recompute: both totals agree exactly ($${primaryTotal.toFixed(2)}) ` +
        '-- revealing option list now for the exact-dollar-amount lookup only',
      ts: nowIso(),
    });

    // ---- Reveal options, exact-match lookup only ----
    const matchedLetters: string[] = [];
    for (const [letter, optionText] of Object.entries(options)) {
      const optionValue = normalizeMoney(optionText);
      const isMatch = optionValue !== null && Math.abs(optionValue - primaryTotal) < 0.005;
      if (isMatch) matchedLetters.push(letter);
      ctx.emit({
        kind: 'note',
        text: `   option ${letter}: "${optionText}" (parsed ${optionValue === null ? 'UNPARSEABLE' : `$${optionValue.toFixed(2)}`}) ` +
          `vs computed total $${primaryTotal.toFixed(2)} -- ${isMatch ? 'MATCH' : 'no match'}`,
        ts: nowIso(),
      });
    }

    if (matchedLetters.length === 0) {
      return {
        question, verdict: null, abstain: true, freeText: false, method: 'convention-locked-recompute',
        options,
        basis: `NONE MATCH: computed total $${primaryTotal.toFixed(2)} (agreed by both independent ` +
          'computations) matches no option row exactly. Not snapping to the nearest option -- the ' +
          'record\'s own finding is that doing so is precisely how an arithmetic error gets ' +
          'laundered into a confident wrong answer.',
      };
    }
    if (matchedLetters.length > 1) {
      return {
        question, verdict: null, abstain: true, freeText: false, method: 'convention-locked-recompute',
        options,
        basis: `AMBIGUOUS MATCH: computed total $${primaryTotal.toFixed(2)} matches ` +
          `${matchedLetters.length} option rows (${matchedLetters.join(', ')}) -- duplicate or ` +
          'near-duplicate options, refusing to pick arbitrarily.',
      };
    }

    return {
      question,
      verdict: matchedLetters[0],
      ok: true,
      abstain: false,
      freeText: false,
      method: 'convention-locked-recompute',
      options,
      basis: `computed total $${primaryTotal.toFixed(2)}, confirmed by an independent closed-form ` +
        `recompute in agreement, matches option ${matchedLetters[0]} exactly. Convention locked by ` +
        `code from the stem clause "${lockSentence}"; principal/payment/rate extracted as verified ` +
        'literal spans; the model performed zero arithmetic.',
    };
  } catch (e) {
    return {
      question, verdict: null, abstain: true, freeText: false, method: 'convention-locked-recompute',
      basis: `convention-locked-recompute threw: ${String((e as Error)?.message ?? e)}`,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE LianaMethod OBJECT
// ─────────────────────────────────────────────────────────────────────────────────────────────

export const conventionLockedRecomputeMethod: LianaMethod = {
  id: 'convention-locked-recompute',
  demand: 'COMPUTE',
  name: 'Convention-Locked Recompute (extracts principal/payment/rate as literal spans, locks the ' +
    'declining-balance convention by a code-only cue-table lookup, builds the amortization ' +
    'schedule in code, cross-checks it against an independently-derived closed-form total before ' +
    'ever revealing options -- the model performs zero arithmetic at any step)',
  taughtBy: 'D-BP213-XO-32_FOUR_METHOD_SPECS.md METHOD 4 (Didasko Round 4, question_id 791, ' +
    'internal qid 20), with its own proposed step-7 recompute check PROVEN a tautology and ' +
    'OVERRULED per Founder order 2026-09-03 (LEG 4 dispatch): "A CHECK THAT PASSES THE EXACT ' +
    'ERROR IT WAS DESIGNED TO CATCH IS WORSE THAN NO CHECK, BECAUSE IT MANUFACTURES CONFIDENCE." ' +
    'Replaced with an independent closed-form recompute, proven (not assumed) to catch the ' +
    'flagship\'s historical $106.62-vs-$103.00 error via a standalone reconstruction script ' +
    '(D-BP213-XO-56, BISHOP_DROPZONE). See the file header for the full account.',
  shapeDescription: 'a lettered MCQ COMPUTE question whose stem states a loan/interest-payment ' +
    'schedule and names its governing convention with an explicit "on the (unpaid|declining|' +
    'remaining|outstanding) balance[, method]" clause -- deliberately narrowed to ONLY this one ' +
    'verified convention (declining-balance amortization); refuses honestly on flat-interest, ' +
    'compound-interest, or any stem lacking that exact cue family rather than guessing an ' +
    'unverified formula for a shape this file has not proven.',
  shapeTest,
  run,
};

// Registers at import time, same convention as every other method module. The registerMethod()
// call alone is NOT sufficient to make this method reachable -- liana_terminal_engine.ts's own
// side-effect import block must ALSO import this file (added in the same dispatch, see that
// file's diff).
registerMethod(conventionLockedRecomputeMethod);

// Test hooks, additive only, same rationale as withheld_curve_shift_guard.ts's __xo48TestHooks --
// exposes the real production primitives so a standalone test/proof harness exercises actual
// production code instead of reimplementing it (reimplementing would risk silent drift).
export const __xo56TestHooks = {
  findConventionLockSentence,
  extractCandidateClauses,
  extractDollarClauses,
  extractRateClauses,
  firstDollarAmount,
  firstRatePercent,
  buildDecliningBalanceSchedule,
  scheduleTotal,
  independentRecompute,
  normalizeMoney,
  buildMenuPrompt,
  menuFormatSchema,
  parseMenuIndex,
};
