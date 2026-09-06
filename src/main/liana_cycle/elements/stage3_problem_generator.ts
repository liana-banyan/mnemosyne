// elements/stage3_problem_generator.ts -- A SYMPY-BACKED PROBLEM GENERATOR FOR STAGE 3
// D-BP164-M0-054/BISHOP-M0/seg-eu
//
// THE ORDER THIS FILE ANSWERS. Founder, BP164, verbatim, in response to BISHOP-M0 reporting Stage 3
// blocked on the Hendrycks MATH dataset's active DMCA takedown: "I said, USE SymPy or whatever it is
// called, and USE THE LIANA CYCLE WHICH ALREADY DOES ALL OF THIS." The insight: SymPy can GENERATE a
// problem AND hold its ground truth, because a problem is constructed FROM a known answer -- no
// copyrighted dataset is needed to obtain a problem/ground-truth pair of the MATH-benchmark CLASS
// (algebra, symbolic manipulation). This file is that generator. The DERIVATION half (the Liana
// Cycle actually solving a generated problem without ever touching the generator's own ground truth)
// is `methods/stage3_symbolic_cascade.ts`, a sibling file, following `arithmetic_cascade.ts`'s own
// established LianaMethod pattern rather than inventing a new integration shape.
//
// REUSE, NOT A THIRD BRIDGE. This file emits problem TEXT and holds ground-truth NUMBERS; it does
// not itself spawn python or call SymPy for anything. The two SymPy-backed operations a solver needs
// to check this file's own problems (`solve` and `differentiate-then-evaluate`) are
// `runSympySolveForX` / `runSympyDerivativeAtPoint`, both added THIS dispatch to
// `../../plow/plow_gom_jabbar.ts` -- the SAME file, SAME `spawn('python', ...)` convention, as
// `runSympyArithmetic` (KN-BP141-3 Stage 3, previously measured against real data: caught a
// fabricated density at 122.5% error). `arithmetic_cascade.ts`'s own D-BP164-M0-047 reconciliation
// already established the rule this file follows: extend the one proven bridge, never build a new
// one. See `stage3_symbolic_cascade.ts` for where those two functions are actually called.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// HARD CONSTRAINT 1 -- GROUND TRUTH IS HELD SEPARATELY FROM WHAT THE SOLVER SEES, STRUCTURALLY.
// `Stage3GeneratedProblem` (the type a solver's `run()` ever receives, via `MethodQuestionInput
// .question`) carries NO answer field of any kind -- not `answer`, not `correctAnswer`, not
// `groundTruth`. The numeric answer lives ONLY in `Stage3GroundTruthRecord`, a SEPARATE type,
// returned in a SEPARATE top-level property (`groundTruthSet`, never merged into `problemSet`) by
// `generateStage3Pair()` below. This mirrors the exact defect this dispatch was told to avoid:
// Stage 1's ASDiv driver read `item.solutionType`, the dataset's own answer key, as an input --
// `answer_key_guard.ts`'s own header names the same family of defect for denotation text. A caller
// that wants to grade a solver's answer must explicitly cross-reference `problem.id` against
// `groundTruthSet.truths` AFTER the solver has already returned its verdict -- there is no code path
// in this file or in `stage3_symbolic_cascade.ts` that hands a `Stage3GroundTruthRecord` (or any of
// its fields) to a `run()` function. Proven two ways in this dispatch's own fixture test (see
// `BISHOP_DROPZONE\D-BP164-M0-054_STAGE3_SYMPY_GENERATOR\fixtures\`): (1) a static, comment-stripped
// grep of `stage3_symbolic_cascade.ts`'s executable code for `GroundTruth`/`.answer` (0 occurrences
// required), and (2) a runtime mutation test -- solve the SAME generated problem twice, mutating the
// ground-truth record's own `.answer` field between the two calls, and confirm the derived verdict is
// byte-identical (the same technique `arithmetic_cascade_fixture_test.js` already established for
// `input.correctAnswer`, applied here to a ground-truth object that is not even part of the same
// object graph the solver receives).
// ─────────────────────────────────────────────────────────────────────────────────────────────
//
// HARD CONSTRAINT 2 -- DIFFICULTY IS CONTROLLED AND STATED, INCLUDING WHAT IS NOT COVERED.
// Two problem classes are generated, both real symbolic-manipulation shapes MATH/Hendrycks covers,
// deliberately narrow rather than an attempt at general coverage:
//
//   LINEAR_EQUATION_SOLVE_FOR_X   "Solve for x: {a}x + {b} = {c}."   Single-variable linear equation,
//                                  integer coefficients, exactly one integer solution by construction.
//                                  MATH `type` overlap: a narrow slice of "Algebra"/"Prealgebra".
//
//   POLYNOMIAL_DERIVATIVE_AT_POINT "Let p(x) = {A}x^2 + {B}x + {C}. What is p'({x0})?"  A single
//                                  differentiation of a degree-2 polynomial, evaluated at one point.
//                                  MATH `type` overlap: a narrow slice of "Precalculus"/calculus-
//                                  adjacent content; MATH itself does not carry a dedicated
//                                  "Calculus" type, so this is reported as adjacent, not a match.
//
// NOT COVERED, STATED PLAINLY, PER FD-BP164-06 (name the negative space): multi-variable systems,
// inequalities, non-linear equations with irrational/complex roots, quadratic-formula problems,
// geometry, number theory, counting & probability, proof-shaped problems, word problems requiring
// natural-language quantity extraction (that shape is `arithmetic_cascade.ts`'s own job, not this
// file's), trigonometric/logarithmic/exponential functions, integrals, limits, series, and matrices.
// Within "Algebra" and "Precalculus" themselves, only a thin slice (one linear-equation shape, one
// polynomial-derivative shape) is generated -- this is not a general MATH-class item generator, and
// no claim to the contrary should be inferred from the two classes it does cover.
//
// HARD CONSTRAINT 3 -- DETERMINISM. A seeded PRNG (mulberry32, a small, well-known, deterministic
// generator -- not cryptographic, not needed to be) drives every random draw in this file. No
// `Math.random` call appears anywhere in this file (grep-checked in this dispatch's own fixture).
// The seed is recorded on both `Stage3ProblemSet` and `Stage3GroundTruthSet`, and the SAME seed
// produces a byte-identical (`JSON.stringify`-equal) problem set and ground-truth set on every call,
// proven in the fixture by generating twice from the same seed and diffing the JSON.
//
// HARD CONSTRAINT 4 -- NO DEMAND TYPE ADDED HERE. This file emits plain data (problems, ground
// truth) -- it registers no `LianaMethod` and touches no `LianaDemand` value. The solver sibling file
// (`stage3_symbolic_cascade.ts`) follows `arithmetic_cascade.ts`'s own established, PROVISIONAL cast
// (`'COMPUTE' as unknown as LianaDemand`) rather than inventing a fresh fork -- see that file's own
// header for the full account. Canon R-7 (a new demand type is a Founder act) is not touched by
// either file.
//
// Rule 66: version, never overwrite -- new file, no supersede needed. No em-dashes anywhere in this
// file (or its comments) -- "--" used throughout, matching plow_gom_jabbar.ts's own convention.

/** mulberry32 -- a small, well-known, deterministic 32-bit PRNG. Not cryptographic; does not need to
 *  be, since its only job here is REPRODUCIBLE pseudo-randomness from a recorded integer seed, never
 *  security. Returns a function that yields floats in [0, 1) on each call, advancing its own closed-
 *  over state -- the same seed, called the same number of times in the same order, always yields the
 *  same sequence. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function nextFloat(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Inclusive integer draw in [min, max], from an already-seeded generator function (mulberry32's
 *  return value, or any 0..1 float generator). Pure given its inputs -- no hidden state beyond the
 *  generator closure the caller already owns. */
function randIntInclusive(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Same as randIntInclusive, but rerolls a single time if the first draw lands on 0 -- used only
 *  where a zero coefficient would make the generated problem-statement text read oddly (e.g. "+ 0x"),
 *  never used where zero is a mathematically meaningful outcome to preserve. Rerolls toward `max` if
 *  the reroll would still be zero (min<=0<=max case only reachable when the caller's own range spans
 *  zero, which every call site below does), so this never loops unboundedly. */
function randNonZeroIntInclusive(rng: () => number, min: number, max: number): number {
  const first = randIntInclusive(rng, min, max);
  if (first !== 0) return first;
  const second = randIntInclusive(rng, min, max);
  return second !== 0 ? second : max === 0 ? min || 1 : max;
}

export type Stage3ProblemClass = 'LINEAR_EQUATION_SOLVE_FOR_X' | 'POLYNOMIAL_DERIVATIVE_AT_POINT';

/** THE ONLY THING A SOLVER EVER SEES. Deliberately has no answer/groundTruth field of any kind --
 *  see this file's header, Hard Constraint 1. `classId` is included because it is a SHAPE label
 *  (which kind of problem this is), not the ANSWER -- the same distinction MATH's own `type` field
 *  draws for a solver reading `problem`/`type` without `solution` (REPLICATION_PROTOCOL_BP159.md,
 *  Stage 3 section, on `type` being coarser than a per-problem method label). */
export interface Stage3GeneratedProblem {
  id: string;
  classId: Stage3ProblemClass;
  problemStatement: string;
  /** The seed THIS PROBLEM's own generation run used -- carried per-problem (not just once per set)
   *  so a single problem can be cited/reproduced on its own without needing the whole set's context. */
  seed: number;
}

/** THE GROUND TRUTH. Never passed to a solver's `run()` anywhere in this file or in
 *  `stage3_symbolic_cascade.ts` -- see this file's header, Hard Constraint 1. `constructionTrace` is
 *  audit-only (how the generator itself built this problem from its own random draws), for a human
 *  reviewer checking the generator's own correctness, not for any solver code path. */
export interface Stage3GroundTruthRecord {
  id: string;
  classId: Stage3ProblemClass;
  answer: number;
  constructionTrace: string;
}

export interface Stage3ProblemSet {
  seed: number;
  problems: Stage3GeneratedProblem[];
}

export interface Stage3GroundTruthSet {
  seed: number;
  truths: Stage3GroundTruthRecord[];
}

export interface Stage3GeneratedPair {
  problemSet: Stage3ProblemSet;
  groundTruthSet: Stage3GroundTruthSet;
}

/** Formats a signed coefficient term for display, e.g. (5, 'x') -> "+ 5x", (-3, 'x') -> "- 3x". Pure
 *  string formatting only -- no randomness, no I/O. */
function signedTerm(value: number, suffix: string): string {
  const sign = value < 0 ? '-' : '+';
  return `${sign} ${Math.abs(value)}${suffix}`;
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/** Builds one LINEAR_EQUATION_SOLVE_FOR_X problem: draws integer coefficient `a` (2..12, never 0),
 *  a true solution `xTrue` (-20..20, never 0 so the problem never degenerates to "ax + b = b"), and
 *  an offset `b` (-30..30, may be 0 -- zero is a legitimate offset and prints cleanly as "+ 0" is
 *  avoided by formatting only non-zero offsets, see below), then computes `c = a*xTrue + b` -- the
 *  problem is built FROM the known solution, never the reverse. */
function generateLinearEquationProblem(rng: () => number, seed: number): { problem: Stage3GeneratedProblem; truth: Stage3GroundTruthRecord } {
  const a = randNonZeroIntInclusive(rng, 2, 12);
  const xTrue = randNonZeroIntInclusive(rng, -20, 20);
  const b = randIntInclusive(rng, -30, 30);
  const c = a * xTrue + b;
  const id = nextId('linear');
  const bTerm = b === 0 ? '' : ` ${signedTerm(b, '')}`;
  const problemStatement = `Solve for x: ${a}x${bTerm} = ${c}. What is x?`;
  return {
    problem: { id, classId: 'LINEAR_EQUATION_SOLVE_FOR_X', problemStatement, seed },
    truth: {
      id,
      classId: 'LINEAR_EQUATION_SOLVE_FOR_X',
      answer: xTrue,
      constructionTrace: `a=${a}, xTrue=${xTrue}, b=${b} => c = a*xTrue + b = ${c}. Equation: ${a}x + ${b} = ${c}.`,
    },
  };
}

/** Builds one POLYNOMIAL_DERIVATIVE_AT_POINT problem: draws integer quadratic coefficients A (1..9,
 *  never 0, so the polynomial is genuinely degree 2), B (-15..15), C (-15..15), and an evaluation
 *  point x0 (-10..10, never 0 so p'(x0) genuinely depends on both A and B rather than collapsing to
 *  B alone). Ground truth is p'(x0) = 2*A*x0 + B, computed here ONLY to build the problem and to
 *  record ground truth -- the solver must independently re-derive this via SymPy from the problem
 *  TEXT alone (`stage3_symbolic_cascade.ts`), never by reading this computation's result. */
function generateDerivativeProblem(rng: () => number, seed: number): { problem: Stage3GeneratedProblem; truth: Stage3GroundTruthRecord } {
  const A = randNonZeroIntInclusive(rng, 1, 9);
  const B = randIntInclusive(rng, -15, 15);
  const C = randIntInclusive(rng, -15, 15);
  const x0 = randNonZeroIntInclusive(rng, -10, 10);
  const answer = 2 * A * x0 + B;
  const id = nextId('deriv');
  const bTerm = ` ${signedTerm(B, 'x')}`;
  const cTerm = ` ${signedTerm(C, '')}`;
  const problemStatement = `Let p(x) = ${A}x^2${bTerm}${cTerm}. What is p'(${x0}), the derivative of p(x) evaluated at x = ${x0}?`;
  return {
    problem: { id, classId: 'POLYNOMIAL_DERIVATIVE_AT_POINT', problemStatement, seed },
    truth: {
      id,
      classId: 'POLYNOMIAL_DERIVATIVE_AT_POINT',
      answer,
      constructionTrace: `A=${A}, B=${B}, C=${C}, x0=${x0} => p'(x) = ${2 * A}x + ${B}; p'(${x0}) = ${2 * A}*${x0} + ${B} = ${answer}.`,
    },
  };
}

/** Generates `countPerClass` problems of EACH class (so `2 * countPerClass` problems total),
 *  deterministically from `seed`. The SAME seed always produces byte-identical output -- see this
 *  file's header, Hard Constraint 3, and the fixture's own same-seed/different-seed proof. Returns
 *  the problem set and ground-truth set as two SEPARATE top-level objects (never merged) -- see this
 *  file's header, Hard Constraint 1. `idCounter` is reset per call so output is a pure function of
 *  `seed` alone, not of how many times this module has been called before in the same process. */
export function generateStage3Pair(seed: number, countPerClass = 5): Stage3GeneratedPair {
  idCounter = 0;
  const rng = mulberry32(seed);
  const problems: Stage3GeneratedProblem[] = [];
  const truths: Stage3GroundTruthRecord[] = [];

  for (let i = 0; i < countPerClass; i++) {
    const { problem, truth } = generateLinearEquationProblem(rng, seed);
    problems.push(problem);
    truths.push(truth);
  }
  for (let i = 0; i < countPerClass; i++) {
    const { problem, truth } = generateDerivativeProblem(rng, seed);
    problems.push(problem);
    truths.push(truth);
  }

  return {
    problemSet: { seed, problems },
    groundTruthSet: { seed, truths },
  };
}

/** The negative-space statement itself, as data (not just comments) so a caller/report can print it
 *  without transcribing this file's header by hand. Kept in sync with the header prose above by
 *  convention, not by codegen -- a future edit to the covered/uncovered classes should update both. */
export const STAGE3_GENERATOR_COVERAGE = {
  covers: [
    'LINEAR_EQUATION_SOLVE_FOR_X -- single-variable linear equations, integer coefficients (MATH type overlap: narrow slice of Algebra/Prealgebra)',
    'POLYNOMIAL_DERIVATIVE_AT_POINT -- derivative of a degree-2 polynomial, evaluated at one point (MATH type overlap: narrow slice of Precalculus/calculus-adjacent; MATH has no dedicated Calculus type)',
  ],
  doesNotCover: [
    'multi-variable systems of equations',
    'inequalities',
    'non-linear equations with irrational or complex roots (e.g. general quadratics via the quadratic formula)',
    'geometry',
    'number theory',
    'counting & probability',
    'proof-shaped problems',
    'natural-language word problems requiring quantity extraction (arithmetic_cascade.ts\'s own job, not this generator\'s)',
    'trigonometric, logarithmic, or exponential functions',
    'integrals, limits, series',
    'matrices',
  ],
} as const;
