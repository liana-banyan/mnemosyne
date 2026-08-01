// plow_gom_jabbar.ts -- KN-BP141-3 Stage 3: The Gom Jabbar Test.
//
// Founder-directed, BP141. Stage 3 of four (Stage 0: plow_mc_question_vetting.ts, Stage 1:
// plow_mc_elimination_chart.ts, Stage 2: plow_mc_elimination_cascade.ts). Not a harder question
// about the answer -- a test of whether anything stands behind the answer. An echo emits the right
// shape with nothing underneath; this file's job is to catch that echo.
//
// HONEST GAP, checked and closed this commit (R-MECHANISM-VERIFY): the ticket instructed reusing
// an existing SymPy invocation path if one exists in this repo, falling back to inventing one only
// if it genuinely does not. Verified this Yoke: compute_sidecar.ts's arithmetic (solver 1,
// evaluateArithmeticVerified) is two independently-implemented JAVASCRIPT evaluators (a hand-rolled
// recursive-descent parser and a whitelisted Function() evaluator) -- neither is SymPy, and no
// Python/SymPy subprocess bridge exists anywhere in src/main. Two pre-existing `spawn('python', ...)`
// call sites exist (src/main/index.ts:4553, a mesh-test condition script; catacombs/
// contribute_to_category.ts:148, a catacombs staging script) but neither does numeric evaluation or
// SymPy of any kind -- they are the "spawn python as a subprocess" CONVENTION this file reuses, not
// code this file could import. runSympyArithmetic() below is therefore a genuinely new, narrow
// bridge, verified against this machine's real installed python (3.13.14) and sympy (1.14.0) via
// the actual compiled dist -- see scratchpad/verify_kn_bp141_3_stage3_g1_gom_jabbar.js.
//
// Rule 66: no em-dashes anywhere in this file or its comments -- "--" used throughout.

import { spawn } from 'child_process';

// ─── G2: WE DO THE ARITHMETIC ───────────────────────────────────────────────────────────────────
//
// SymPy locally (free, exact, no API, no rate limit); Wolfram only when SymPy cannot. NEVER let
// the tested source compute its own check -- that lets a wrong factor launder itself through a
// plausible product. Placed first in this file (ahead of G1) because G1's own reconciliation
// depends on this bridge, not because the ticket's own G1/G2 numbering changes.

export interface SympyEvalResult {
  value: number;
  raw: string;
}

// Whitelists the expression BEFORE it ever reaches the python subprocess argument list, same
// validate-then-evaluate discipline compute_sidecar.ts's ARITHMETIC_WHITELIST_RE already applies to
// its own JS evaluators. Every caller in this file builds the expression itself out of
// already-validated finite numbers (never raw external text), so this whitelist is defense in
// depth, not the only thing standing between untrusted text and a subprocess argv.
const SYMPY_EXPR_WHITELIST_RE = /^[\d+\-*/^().eE\s]+$/;

/** Runs a single arithmetic expression through a real local SymPy subprocess and returns its
 *  evaluated numeric value. Never invents a value on any failure path (missing python, missing
 *  sympy, a non-numeric SymPy result, a timeout, a non-whitelisted expression) -- every one of
 *  those returns null so a caller falls through to Wolfram (if keyed) or abstains, exactly per the
 *  ticket's own stated precedence ("Wolfram only when SymPy cannot"). Spawns
 *  `python -c "from sympy import sympify, N; print(N(sympify('<expr>')))"`, matching this repo's
 *  existing `spawn('python', [...])` convention (src/main/index.ts:4553,
 *  catacombs/contribute_to_category.ts:148) rather than inventing a new process-invocation style. */
export function runSympyArithmetic(expression: string, timeoutMs = 10_000): Promise<SympyEvalResult | null> {
  const expr = expression.trim();
  if (expr.length === 0 || expr.length > 300) return Promise.resolve(null);
  if (!SYMPY_EXPR_WHITELIST_RE.test(expr)) return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: SympyEvalResult | null): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    let proc: ReturnType<typeof spawn>;
    try {
      proc = spawn('python', [
        '-c',
        `from sympy import sympify, N\nprint(N(sympify(${JSON.stringify(expr)})))`,
      ]);
    } catch {
      finish(null);
      return;
    }

    const stdout: string[] = [];
    const stderr: string[] = [];
    const timer = setTimeout(() => {
      try {
        proc.kill();
      } catch {
        // process may have already exited -- nothing further to do
      }
      finish(null);
    }, timeoutMs);

    proc.stdout?.on('data', (d: Buffer) => stdout.push(d.toString()));
    proc.stderr?.on('data', (d: Buffer) => stderr.push(d.toString()));
    proc.on('error', () => {
      clearTimeout(timer);
      finish(null); // e.g. MISSING_PYTHON_RUNTIME -- honest null, never a guessed value
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        finish(null);
        return;
      }
      const raw = stdout.join('').trim();
      const n = Number.parseFloat(raw);
      if (!Number.isFinite(n)) {
        finish(null); // SymPy produced a non-numeric result (symbolic, complex, etc.) -- honest null
        return;
      }
      finish({ value: n, raw });
    });
  });
}

/** Convenience wrapper for G1's own "one multiplication" step -- both factors must already be
 *  finite numbers (never raw strings), so the expression this function builds is always a clean
 *  `a*b` literal, never text that needed sanitizing on its own. */
export function runSympyMultiplication(a: number, b: number): Promise<SympyEvalResult | null> {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Promise.resolve(null);
  return runSympyArithmetic(`(${a})*(${b})`);
}

// ─── G1: DERIVED-QUANTITY RECONCILIATION ────────────────────────────────────────────────────────
//
// Ask the source for FACTORS, never products. Get density, separately get land area, then check
// density x area against an INDEPENDENTLY sourced population. Three facts, two searches, one
// multiplication. A source can fabricate a plausible density. It cannot fabricate a density and an
// area whose product lands on a third number it never saw.

export interface DerivedQuantityFactor {
  label: string;
  value: number;
}

export interface GomJabbarG1Result {
  consistent: boolean;
  computedProduct: number | null;
  independentCheckValue: number;
  relativeDifference: number | null;
  trace: string;
}

/** The reconciliation itself. `factorA`/`factorB` are the two SEPARATELY sourced factors (e.g.
 *  density, land area); `independentCheckValue` is the THIRD fact, sourced independently of both
 *  (e.g. population from a demographic source, never derived from the same density/area figures).
 *  The multiplication is done via runSympyMultiplication (G2) -- this function NEVER computes the
 *  product itself in JS, so a caller cannot accidentally let a hand-computed product launder a
 *  wrong factor past the very check meant to catch it. When the SymPy subprocess itself fails
 *  (missing runtime, missing sympy, timeout), this returns an honest inconclusive result
 *  (consistent=false, computedProduct=null) rather than silently falling back to a local JS
 *  multiplication -- falling back would defeat G2's entire stated purpose ("NEVER let the tested
 *  source compute its own check"; a silent local-JS fallback is not the tested source, but it is
 *  also not the independent SymPy check the ticket specifically mandated, so this file does not
 *  pretend it is one). */
export async function reconcileDerivedQuantity(
  factorA: DerivedQuantityFactor,
  factorB: DerivedQuantityFactor,
  independentCheckValue: number,
  relTolerance = 0.05,
): Promise<GomJabbarG1Result> {
  const product = await runSympyMultiplication(factorA.value, factorB.value);
  if (product === null) {
    return {
      consistent: false,
      computedProduct: null,
      independentCheckValue,
      relativeDifference: null,
      trace:
        `G1 INCONCLUSIVE: SymPy subprocess did not return a usable product for ` +
        `${factorA.label}=${factorA.value} x ${factorB.label}=${factorB.value} -- no local JS ` +
        `fallback attempted (that would defeat G2's own purpose). Cannot reconcile against the ` +
        `independent check value ${independentCheckValue}.`,
    };
  }

  const relativeDifference = Math.abs(product.value - independentCheckValue) / Math.abs(independentCheckValue);
  const consistent = relativeDifference <= relTolerance;
  const trace = consistent
    ? `G1 PASS: ${factorA.label}=${factorA.value} x ${factorB.label}=${factorB.value} = ` +
      `${product.value} (via SymPy) reconciles with the independently sourced check value ` +
      `${independentCheckValue} (relative difference ${(relativeDifference * 100).toFixed(3)}%, ` +
      `within tolerance ${(relTolerance * 100).toFixed(1)}%).`
    : `G1 FAIL: ${factorA.label}=${factorA.value} x ${factorB.label}=${factorB.value} = ` +
      `${product.value} (via SymPy) does NOT reconcile with the independently sourced check value ` +
      `${independentCheckValue} (relative difference ${(relativeDifference * 100).toFixed(3)}%, ` +
      `exceeds tolerance ${(relTolerance * 100).toFixed(1)}%) -- the three facts disagree with each ` +
      `other, exactly the shape a fabricated factor would produce.`;

  return { consistent, computedProduct: product.value, independentCheckValue, relativeDifference, trace };
}

// ─── G3: ONE-SIDED BOUND ─────────────────────────────────────────────────────────────────────────
//
// Do not verify every claim. Let the source elaborate, tally only the claims that are cheap to
// bound, and stop the moment the lower bound exceeds the known ceiling. Fabrication has no budget,
// so it overshoots.

export interface OneSidedBoundClaim {
  description: string;
  lowerBound: number;
}

export interface OneSidedBoundResult {
  exceeded: boolean;
  cumulativeLowerBound: number;
  stoppedAtClaimIndex: number | null;
  consideredClaims: number;
  trace: string;
}

/** Accumulates claims' own lower bounds IN ORDER, stopping the instant the running total exceeds
 *  `knownCeiling` -- exceeded=true is the fabrication signal (a source that overshoots a known
 *  ceiling could not have been bounding its claims against reality as it went). Never tallies past
 *  the claim that triggers the overshoot -- "stop the moment," not "keep going for a bigger
 *  margin." Returns exceeded=false (an honest non-signal, not a pass/fail verdict on TRUTH of the
 *  claims) when the full claim list never overshoots; this function only ever detects overshoot,
 *  it does not certify accuracy. */
export function evaluateOneSidedBound(claims: OneSidedBoundClaim[], knownCeiling: number): OneSidedBoundResult {
  let cumulative = 0;
  for (let i = 0; i < claims.length; i++) {
    const claim = claims[i] as OneSidedBoundClaim;
    cumulative += claim.lowerBound;
    if (cumulative > knownCeiling) {
      return {
        exceeded: true,
        cumulativeLowerBound: cumulative,
        stoppedAtClaimIndex: i,
        consideredClaims: i + 1,
        trace:
          `G3 OVERSHOOT at claim ${i} ("${claim.description}"): cumulative lower bound ` +
          `${cumulative} exceeds the known ceiling ${knownCeiling} after considering ${i + 1} of ` +
          `${claims.length} claims -- stopped immediately, no further claims tallied.`,
      };
    }
  }
  return {
    exceeded: false,
    cumulativeLowerBound: cumulative,
    stoppedAtClaimIndex: null,
    consideredClaims: claims.length,
    trace:
      `G3 NO OVERSHOOT: cumulative lower bound ${cumulative} across all ${claims.length} claims ` +
      `stayed at or under the known ceiling ${knownCeiling} -- no fabrication signal from this ` +
      `check (this does not certify the claims are true, only that they did not overshoot).`,
  };
}

// ─── G4: INDISTINGUISHABLE FROM A NORMAL QUERY ──────────────────────────────────────────────────
//
// The subject must not be able to tell which query is the probe, or it can behave differently for
// it. Same channel, same shape, no framing.

/** Substitutes `content` into `templateShape` (a template string containing exactly one
 *  `{content}` placeholder) with no added wrapper text -- the mechanical half of G4. This
 *  guarantees a probe query is BUILT the same way as a normal query would be from the same
 *  template; it cannot by itself guarantee the CONTENT is unframed (that is verifyNoProbeFraming's
 *  job, immediately below), since a caller could still write probe-revealing language into
 *  `content` itself. Returns the template unchanged (with the placeholder left in place) when
 *  `templateShape` does not contain the placeholder at all -- an honest signal of caller error,
 *  never a silent partial substitution. */
export function buildIndistinguishableQuery(templateShape: string, content: string): string {
  if (!templateShape.includes('{content}')) return templateShape;
  return templateShape.replace('{content}', content);
}

export interface ProbeFramingCheck {
  clean: boolean;
  matchedMarkers: string[];
}

// Deliberately a short, literal, curated list -- this is a defense-in-depth linter against the
// most obvious self-sabotaging phrasings a caller might accidentally leave in a probe (e.g. a
// leftover internal label), not a claim to detect every conceivable framing tell. A caller passing
// this check should still independently confirm the query template matches its normal-query
// sibling's shape (buildIndistinguishableQuery above covers the mechanical part of that).
const PROBE_FRAMING_MARKERS = [
  'gom jabbar',
  'this is a probe',
  'this is a test question',
  'this is a verification check',
  'benchmark question',
  'trap question',
  'is this fabricated',
  'reconciliation check',
];

/** Scans `queryText` (the FULLY BUILT query about to be sent to a source) for any of a short,
 *  curated list of probe-revealing marker phrases, case-insensitive. Returns every marker found
 *  (not just the first), so a caller sees the complete picture rather than fixing one leak and
 *  missing a second. clean=true means none of the curated markers were found -- an honest signal
 *  about THIS checklist, not a guarantee the query is truly indistinguishable in every respect a
 *  sophisticated source might notice. */
export function verifyNoProbeFraming(queryText: string): ProbeFramingCheck {
  const lower = queryText.toLowerCase();
  const matchedMarkers = PROBE_FRAMING_MARKERS.filter((marker) => lower.includes(marker));
  return { clean: matchedMarkers.length === 0, matchedMarkers };
}

// ─── G5: FAILURE STRIKES THE VOTE ───────────────────────────────────────────────────────────────
//
// Failure strikes the vote, it does not discount it. A discounted echo is still an echo in the
// tally. An inadmissible source's vote must be excluded ENTIRELY, never counted at partial weight.

export interface GomJabbarVote {
  source: string;
  letter: string;
  admissible: boolean;
  failureReason?: string;
}

export interface GomJabbarTallyResult {
  tally: Record<string, number>;
  admissibleSources: string[];
  strickenSources: string[];
  trace: string;
}

/** Tallies votes by letter, counting ONLY admissible sources' votes -- a stricken (inadmissible)
 *  source's vote contributes ZERO to the tally, never a fractional/discounted weight ("a
 *  discounted echo is still an echo in the tally," per the Founder's own framing, is exactly the
 *  failure mode this function refuses to produce). Reports every stricken source and its own
 *  stated reason (when supplied) alongside the tally, so a caller can see which sources were
 *  excluded and why, never a silently-shrunk vote count. */
export function tallyVotesStrikingFailures(votes: GomJabbarVote[]): GomJabbarTallyResult {
  const tally: Record<string, number> = {};
  const admissibleSources: string[] = [];
  const strickenSources: string[] = [];

  for (const vote of votes) {
    if (!vote.admissible) {
      strickenSources.push(vote.failureReason ? `${vote.source} (${vote.failureReason})` : vote.source);
      continue;
    }
    admissibleSources.push(vote.source);
    tally[vote.letter] = (tally[vote.letter] ?? 0) + 1;
  }

  const trace =
    `G5 TALLY: ${admissibleSources.length} admissible source(s) counted, ${strickenSources.length} ` +
    `stricken source(s) excluded entirely (zero weight, not discounted) -- tally: ` +
    `${JSON.stringify(tally)}.`;

  return { tally, admissibleSources, strickenSources, trace };
}
