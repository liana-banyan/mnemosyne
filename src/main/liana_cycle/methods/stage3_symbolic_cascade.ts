// methods/stage3_symbolic_cascade.ts -- THE LIANA CYCLE DERIVING STAGE 3 GENERATED PROBLEMS
// D-BP164-M0-054/BISHOP-M0/seg-eu
//
// Sibling of `../elements/stage3_problem_generator.ts` (read that file's header first -- it states
// the generator's covered/uncovered classes and the ground-truth-separation contract this file must
// honor). THIS file is the DERIVATION half: a `LianaMethod`, registered in `method_registry.ts`
// exactly like `arithmetic_cascade.ts`, whose `run()` solves a generated problem from its
// `problemStatement` TEXT ALONE -- via the SAME SymPy bridge convention `arithmetic_cascade.ts`
// already reuses (`runSympyArithmetic`, `plow_gom_jabbar.ts`), extended this dispatch with
// `runSympySolveForX` / `runSympyDerivativeAtPoint` in that SAME file (see that file's own D-BP164-
// M0-054 EXTENSION header). No new SymPy bridge is written here.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE HARD CONSTRAINT THIS FILE EXISTS TO HONOR, SAME AS arithmetic_cascade.ts'S OWN: this method
// NEVER reads a ground-truth field. `MethodQuestionInput.correctAnswer` is never read anywhere in
// this file's executable code (grep this file for "correctAnswer" -- the only occurrence is this
// sentence), and no `Stage3GroundTruthRecord` (or any of its fields, including `.answer`) is ever
// imported, referenced, or passed into `shapeTest()` or `run()` below -- this file imports ONLY the
// `Stage3ProblemClass` type from `../elements/stage3_problem_generator` (a label, not an answer; see
// that file's own header on why `classId` is not ground truth) and never imports
// `Stage3GroundTruthRecord`, `Stage3GroundTruthSet`, or `generateStage3Pair` at all. The fixture at
// `BISHOP_DROPZONE\D-BP164-M0-054_STAGE3_SYMPY_GENERATOR\fixtures\stage3_generator_fixture_test.js`
// proves this two ways: a comment-stripped static grep for `GroundTruth`/`.answer` (0 occurrences
// required) and a runtime mutation test (see that fixture's own header).
// ─────────────────────────────────────────────────────────────────────────────────────────────
//
// SHAPE, NOT LOOKUP, exactly like every other cascade's own gate. Two independent shapes are
// recognized, both free-text (no lettered options), by structural regex against the EXACT template
// `stage3_problem_generator.ts` emits -- this is deliberately a narrow, template-matched extractor
// (not a general natural-language equation parser), stated plainly rather than overclaimed:
//   "Solve for x: {a}x [+ b | - b] = {c}. What is x?"
//   "Let p(x) = {A}x^2 [+ B | - B]x [+ C | - C]. What is p'({x0}), the derivative of p(x)
//    evaluated at x = {x0}?"
// A problem statement that does not match either template EXACTLY refuses (abstain), it does not
// attempt a looser match -- "refuses beats guessing" (method_question_generator.ts's own doctrine,
// already cited by arithmetic_cascade.ts for the same reason).
//
// PROVISIONAL DEMAND, FLAGGED, NOT RESOLVED HERE -- SAME FORK arithmetic_cascade.ts ALREADY NAMED,
// NOT A NEW ONE. `demand` below is cast (`'COMPUTE' as unknown as LianaDemand`), not typed, for the
// exact reason arithmetic_cascade.ts's own header states: canon R-7 makes adding a demand type a
// Founder act, and this dispatch was ordered to build a generator/solver pair, not to rule on the
// demand taxonomy. Reachable only through `selectMethod()` called WITHOUT a demand argument (shape-
// only mode), same as arithmetic_cascade.ts and same as Stage 1's own existing wiring.
//
// Rule 66: new file, no supersede needed. No em-dashes -- "--" used throughout.

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput, MethodRunContext, ShapeTestResult } from '../method_registry';
import type { LianaTerminalOutcome } from '../../../shared/liana_cycle/liana_terminal_types';
// D-BP164-M0-112: the `import type { LianaDemand }` that lived here is REMOVED -- see
// arithmetic_cascade.ts's own identical note; same cast, same reason, same removal.
import type { Stage3ProblemClass } from '../elements/stage3_problem_generator';
import { runSympySolveForX, runSympyDerivativeAtPoint } from '../../plow/plow_gom_jabbar';

const LINEAR_RE = /^Solve for x:\s*(-?\d+)x\s*(?:([+-])\s*(\d+)\s*)?=\s*(-?\d+)\.\s*What is x\?$/;
const DERIVATIVE_RE = /^Let p\(x\) = (-?\d+)x\^2\s*([+-])\s*(\d+)x\s*([+-])\s*(\d+)\.\s*What is p'\((-?\d+)\), the derivative of p\(x\) evaluated at x = (-?\d+)\?$/;

interface ClassifiedShape {
  classId: Stage3ProblemClass;
  match: RegExpMatchArray;
}

/** Reads the question TEXT ONLY (no second argument, no id lookup, no ground-truth field of any
 *  kind) and classifies it against the two template regexes above. Returns null when neither
 *  matches -- the caller (shapeTest/run) treats null as a hard refusal. */
function classifyShape(question: string): ClassifiedShape | null {
  const linear = question.match(LINEAR_RE);
  if (linear) return { classId: 'LINEAR_EQUATION_SOLVE_FOR_X', match: linear };
  const derivative = question.match(DERIVATIVE_RE);
  if (derivative) return { classId: 'POLYNOMIAL_DERIVATIVE_AT_POINT', match: derivative };
  return null;
}

function shapeTest(input: MethodQuestionInput): ShapeTestResult {
  // NEVER reads input.correctAnswer -- see this file's header. Only input.question/input.options
  // are read below, matching every other cascade's shapeTest() signature.
  if (input.options && Object.keys(input.options).length >= 2) {
    return {
      matches: false,
      reason: 'has >=2 lettered options -- stage3-symbolic-cascade only matches free-text problems with no option list',
    };
  }
  const question = (input.question || '').trim();
  const classified = classifyShape(question);
  if (!classified) {
    return {
      matches: false,
      reason: 'question text does not match either recognized Stage 3 template (linear-equation-solve-for-x or polynomial-derivative-at-point)',
    };
  }
  return {
    matches: true,
    reason: `matches the ${classified.classId} template exactly`,
  };
}

async function run(input: MethodQuestionInput, _ctx: MethodRunContext): Promise<LianaTerminalOutcome> {
  // NEVER reads input.correctAnswer. Derivation depends on input.question alone.
  const question = (input.question || '').trim();
  const classified = classifyShape(question);
  if (!classified) {
    return {
      question,
      verdict: null,
      abstain: true,
      freeText: true,
      method: 'stage3-symbolic-cascade',
      basis: 'REFUSES rather than guesses: question text does not match either recognized Stage 3 template.',
    };
  }

  if (classified.classId === 'LINEAR_EQUATION_SOLVE_FOR_X') {
    const [, aStr, sign, bAbsStr, cStr] = classified.match;
    const a = Number(aStr);
    const b = sign && bAbsStr ? (sign === '-' ? -Number(bAbsStr) : Number(bAbsStr)) : 0;
    const c = Number(cStr);
    // Build "a*x + b - c" (set to zero) ENTIRELY from numbers parsed out of the question text --
    // never a lookup, never a stored value from generation time.
    const equationExprEqualsZero = `${a}*x + (${b}) - (${c})`;
    let solved;
    try {
      solved = await runSympySolveForX(equationExprEqualsZero);
    } catch (e) {
      return {
        question,
        verdict: null,
        abstain: true,
        freeText: true,
        method: 'stage3-symbolic-cascade',
        basis: `SymPy solve failed for "${equationExprEqualsZero}": ${String((e as Error)?.message ?? e)}`,
      };
    }
    if (solved === null || solved.solutions.length !== 1) {
      return {
        question,
        verdict: null,
        abstain: true,
        freeText: true,
        method: 'stage3-symbolic-cascade',
        basis: solved === null
          ? `runSympySolveForX (plow_gom_jabbar.ts) returned null for "${equationExprEqualsZero}" -- honest abstain.`
          : `SymPy returned ${solved.solutions.length} solutions for a problem this template guarantees exactly one for -- honest abstain rather than guessing which one. raw="${solved.raw}"`,
      };
    }
    return {
      question,
      verdict: solved.solutions[0],
      abstain: false,
      freeText: true,
      method: 'stage3-symbolic-cascade',
      basis: `derived from the question text alone (never reads a ground-truth field): parsed a=${a}, b=${b}, c=${c} from the template, built equation "${a}x + ${b} = ${c}", solved via SymPy (sympy.solve) => x = ${solved.solutions[0]}.`,
    };
  }

  // POLYNOMIAL_DERIVATIVE_AT_POINT
  const [, aStr, signB, bAbsStr, signC, cAbsStr, x0AStr, x0BStr] = classified.match;
  const A = Number(aStr);
  const B = signB === '-' ? -Number(bAbsStr) : Number(bAbsStr);
  const C = signC === '-' ? -Number(cAbsStr) : Number(cAbsStr);
  // The template states x0 twice (inside p'(x0) and again in "evaluated at x = x0") -- both parses
  // must agree, or the question text is internally inconsistent and this method refuses rather than
  // picking one arbitrarily.
  const x0A = Number(x0AStr);
  const x0B = Number(x0BStr);
  if (x0A !== x0B) {
    return {
      question,
      verdict: null,
      abstain: true,
      freeText: true,
      method: 'stage3-symbolic-cascade',
      basis: `REFUSES: the question states two different evaluation points (${x0A} vs ${x0B}) -- internally inconsistent, not guessed past.`,
    };
  }
  const expressionInX = `${A}*x^2 + (${B})*x + (${C})`;
  let derivative;
  try {
    derivative = await runSympyDerivativeAtPoint(expressionInX, x0A);
  } catch (e) {
    return {
      question,
      verdict: null,
      abstain: true,
      freeText: true,
      method: 'stage3-symbolic-cascade',
      basis: `SymPy differentiation failed for "${expressionInX}" at x=${x0A}: ${String((e as Error)?.message ?? e)}`,
    };
  }
  if (derivative === null) {
    return {
      question,
      verdict: null,
      abstain: true,
      freeText: true,
      method: 'stage3-symbolic-cascade',
      basis: `runSympyDerivativeAtPoint (plow_gom_jabbar.ts) returned null for "${expressionInX}" at x=${x0A} -- honest abstain.`,
    };
  }
  return {
    question,
    verdict: String(derivative.value),
    abstain: false,
    freeText: true,
    method: 'stage3-symbolic-cascade',
    basis: `derived from the question text alone (never reads a ground-truth field): parsed A=${A}, B=${B}, C=${C}, x0=${x0A} from the template, built p(x) = ${expressionInX}, differentiated and evaluated via SymPy (sympy.diff, .subs, N) => p'(${x0A}) = ${derivative.value}.`,
  };
}

export const stage3SymbolicCascadeMethod: LianaMethod = {
  id: 'stage3-symbolic-cascade',
  // PROVISIONAL, CAST NOT TYPED -- same fork arithmetic_cascade.ts already named (canon R-7), not a
  // new one. Reachable only via selectMethod() called with no demand argument (shape-only mode).
  demand: 'COMPUTE',
  name: 'Stage 3 Symbolic Cascade (SymPy-derived; solves generated linear-equation and polynomial-derivative problems; demand PROVISIONAL, needs Founder ruling)',
  taughtBy: 'D-BP164-M0-054/BISHOP-M0/seg-eu. Founder order, BP164: "USE SymPy or whatever it is '
    + 'called, and USE THE LIANA CYCLE WHICH ALREADY DOES ALL OF THIS", in response to Stage 3 being '
    + 'blocked on the Hendrycks MATH DMCA takedown. Like arithmetic_cascade.ts, no single walked '
    + 'human case taught this method (canon rule 4, method_registry.ts header) -- it is a generic '
    + 'SymPy-backed template solver built to direct Founder instruction, flagged here rather than '
    + 'fabricating a case citation.',
  shapeDescription: 'a free-text problem (no lettered options) matching either the '
    + 'LINEAR_EQUATION_SOLVE_FOR_X or POLYNOMIAL_DERIVATIVE_AT_POINT template emitted by '
    + '../elements/stage3_problem_generator.ts',
  shapeTest,
  run,
};

// Registers at import time, same convention as arithmetic_cascade.ts and every other method module.
// NOT auto-imported by any driver today -- explicitly out of scope for this dispatch to wire into
// Stage 1-4's shared drivers (that is a separate wiring decision, same boundary arithmetic_cascade.ts
// itself already drew).
registerMethod(stage3SymbolicCascadeMethod);
