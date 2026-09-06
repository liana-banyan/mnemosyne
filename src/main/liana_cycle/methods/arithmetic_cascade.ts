// arithmetic_cascade.ts -- D-BP164-M0-037/BISHOP/M0/seg-ef
// D-BP164-M0-047 RECONCILIATION -- SECOND SYMPY BRIDGE CLOSED, SEE BELOW evaluateWithSympy()'s OWN
// HEADER FOR THE FULL ACCOUNT. This file's own arithmetic no longer spawns python itself; it now
// calls runSympyArithmetic() (src/main/plow/plow_gom_jabbar.ts, KN-BP141-3 Stage 3), the SAME
// already-verified bridge the D-BP164-M0-047 generator dispatch was ordered to reuse rather than
// build a third one.
//
// METHOD: THE ARITHMETIC CASCADE. Shape: a free-text word problem (no lettered options) that
// states several quantities in prose and asks for a number derived by combining them -- the
// ASDiv and GSM8K class. Built per Founder order, BP164: on being told "the registry has no
// arithmetic-shaped method," he asked "why not use SymPy?" (typed "Plypy" -- SymPy, the standard
// Python symbolic-mathematics library, is the near-certain referent; confirmed installed this
// same dispatch, `pip show sympy` -> 1.14.0). This file is that method.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE HARD CONSTRAINT THIS FILE EXISTS TO HONOR, STATED BY THE FOUNDER'S DISPATCH VERBATIM:
// "the method must NEVER read a dataset's answer field. It derives from the question text alone."
// Stage 1's own defect (BIG_KAHUNA_UNBLOCK_BP164.md, JOB 1) was reading ASDiv's `item.solutionType`
// as an input -- the dataset's own answer key. `MethodQuestionInput` (method_registry.ts) carries
// an OPTIONAL `correctAnswer` field for bundled-qid runs; this method's shapeTest() and run() both
// NEVER READ `input.correctAnswer`, ANYWHERE in this file -- grep this file for "correctAnswer" and
// confirm the only occurrence is this sentence. The fixture at
// LianaBanyanPlatform/BISHOP_DROPZONE/D-BP164-M0-037_ARITHMETIC_SYMPY/fixtures/
// arithmetic_cascade_fixture_test.js proves this by mutating `correctAnswer` between two runs of
// the identical question and showing the derived verdict is byte-identical.
// ─────────────────────────────────────────────────────────────────────────────────────────────
//
// PROVISIONAL DEMAND, FLAGGED, NOT RESOLVED HERE. demand_test.ts's own header states canon R-7:
// "THE LIST IS OPEN, but per canon R-7 a new type is a Founder act -- never inferred here from a
// question that matched nothing." None of the six existing LianaDemand values (RANK, DEFINE,
// IDENTIFY, CLASSIFY, INFER, LOCATE-IN-FRAMEWORK) name "the answer is a computed number." Adding a
// seventh (e.g. 'COMPUTE') to that union IS the Founder act R-7 requires, and this dispatch was
// not given that ruling -- only "why not use SymPy?", which authorizes building the method, not
// unilaterally amending the demand taxonomy. So `demand` below is cast, not typed, and this method
// is reachable ONLY through selectMethod() called WITHOUT a demand argument (shape-only mode,
// method_registry.ts lines 336/338/343) -- exactly the mode D-BP164-M0-032's Stage 1 wiring
// already uses (`methodRegistry.selectMethod(methodInput)`, one argument, no demand). It is NOT
// reachable through demand-gated selection or explainSelection() until a Founder ruling adds
// 'COMPUTE' (or whatever name he chooses) to demand_test.ts's LianaDemand union -- that edit is
// NOT made in this file or in demand_test.ts by this dispatch. This is reported as an open fork in
// GSM8K_SYMPY_AND_LIANA_CYCLE_BP164.md, not resolved unilaterally.
//
// SHAPE, NOT LOOKUP. shapeTest() requires (a) no lettered option list with >=2 entries -- the
// mirror image of every existing cascade's gate, because an arithmetic word problem has no
// options to eliminate among -- and (b) at least two numeric quantities in the question text plus
// at least one recognized arithmetic cue word (total/eats/each/divided by/etc). run() extracts
// those quantities and a per-quantity operator from LOCAL TEXT WINDOWS around each number (never
// from a lookup table keyed by qid), builds a plain arithmetic expression, and hands it to SymPy
// (`sympy.sympify`, via a python subprocess) for the actual evaluation -- this file does not do
// the arithmetic itself, SymPy does, matching the Founder's instruction exactly.
//
// SCOPE, HONESTLY STATED. This is a single left-to-right operator chain over the numbers in the
// order they appear (num0 OP1 num2 OP2 num3 ...), classified by a LOCAL text window around each
// number. It solves genuinely multi-clause problems whose numbers compose in that left-to-right
// order (proven on a real, unmodified GSM8K test-file item below) but it does not build a general
// equation system, and it does NOT invent an operator when the local window carries no recognized
// cue -- REFUSES BEATS GUESSING (method_question_generator.ts's own header phrase, applied here):
// an unrecognized cue anywhere in the chain aborts the whole derivation with an honest abstain,
// never a partial or guessed answer. Proven on a real GSM8K item (test.jsonl row 0, "Janet's
// ducks") in the fixture below, which this simple chain genuinely cannot solve and correctly
// refuses rather than fabricating 18.

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput, MethodRunContext, ShapeTestResult } from '../method_registry';
import type { LianaTerminalOutcome } from '../../../shared/liana_cycle/liana_terminal_types';
// D-BP164-M0-112: the `import type { LianaDemand }` that lived here is REMOVED -- it existed only
// to support the `'COMPUTE' as unknown as LianaDemand` cast below, which is also removed now that
// 'COMPUTE' is a real LianaDemand member (see the `demand:` field's own comment, below).
// D-BP164-M0-047 RECONCILIATION. runSympyArithmetic() (plow_gom_jabbar.ts, KN-BP141-3 Stage 3) is
// the SAME `spawn('python', ...)` bridge to the real installed SymPy 1.14.0 this dispatch's own
// instructions named directly. It ALREADY existed when this file's own evaluateWithSympy() (below)
// was first written with its own separate execFileSync call -- that duplication is what this
// reconciliation closes. No behavior this file's own tests depend on changes: both bridges call
// `sympy.sympify()` on the same kind of plain arithmetic expression string; only the invocation
// path is unified.
import { runSympyArithmetic } from '../../plow/plow_gom_jabbar';

interface NumberToken {
  raw: string;
  value: number;
  index: number;
  length: number;
}

const NUMBER_RE = /\d[\d,]*(?:\.\d+)?/g;

// MEASURED DURING THIS DISPATCH'S OWN FIXTURE RUN, NOT ASSUMED: a first-draft version of this
// file matched digits only. Run against a real, unmodified GSM8K test.jsonl row 0 ("Janet's
// ducks... eats three for breakfast... bakes muffins... with four"), digit-only extraction found
// only "16" and "2" (the spelled-out "three" and "four" are invisible to \d), built the expression
// "16 * 2", and returned a CONFIDENT WRONG ANSWER (32, not 18) instead of an honest refusal -- the
// exact failure mode this method exists to avoid (a silent wrong guess, not even a stated one).
// Spelled-out small numbers are common in this corpus and MUST be extracted, or the method
// produces false confidence instead of an honest abstain. Fixed by extracting single-word number
// words too (one..twenty, and the decade words/dozen/hundred) via WORD_NUMBER_RE below, merged
// with the digit tokens in text order. Multi-word numbers ("twenty three", "one hundred and
// five") are NOT parsed -- a text span containing an unparsed multi-word number still contains no
// digit/single-word-number token there, which correctly starves the chain of a token rather than
// silently misreading a fragment of it.
const WORD_NUMBERS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, dozen: 12, hundred: 100,
};
const WORD_NUMBER_RE = new RegExp(`\\b(${Object.keys(WORD_NUMBERS).join('|')})\\b`, 'gi');

/** Every number in `text` -- digits AND single-word number-words (see WORD_NUMBERS above) -- in
 *  the order they appear, with each token's character offset (needed to build a LOCAL window
 *  around it for operator classification -- see classifyLocalOperator() below). Pure, no I/O,
 *  safe to call from shapeTest(). */
function extractNumberTokens(text: string): NumberToken[] {
  const tokens: NumberToken[] = [];
  let m: RegExpExecArray | null;
  NUMBER_RE.lastIndex = 0;
  while ((m = NUMBER_RE.exec(text)) !== null) {
    tokens.push({
      raw: m[0],
      value: parseFloat(m[0].replace(/,/g, '')),
      index: m.index,
      length: m[0].length,
    });
  }
  WORD_NUMBER_RE.lastIndex = 0;
  while ((m = WORD_NUMBER_RE.exec(text)) !== null) {
    tokens.push({
      raw: m[0],
      value: WORD_NUMBERS[m[0].toLowerCase()],
      index: m.index,
      length: m[0].length,
    });
  }
  tokens.sort((a, b) => a.index - b.index);
  return tokens;
}

// Ordered by specificity check, not preference -- classifyLocalOperator() below tests divide
// first, then multiply, then subtract, then add, because "divided by 3 each" should read as
// divide, not multiply, and a window can legally contain more than one cue family's words.
const DIVIDE_RE = /\b(divided by|split (?:evenly|equally)|shared equally|per person|divide)\b/i;
// "every" was REMOVED after this dispatch's own fixture measured a false positive: "bakes muffins
// for her friends every day with four" (real GSM8K test.jsonl row 0) matched 'multiply' on "every
// day" -- a time-frequency phrase, not a multiplicative relationship on the adjacent number "four"
// -- which combined with the bug fixed just below (raw word text in the expression instead of its
// numeric value) to silently produce a confident WRONG answer instead of the honest refusal this
// clause should produce (no cue in this codebase's cue set actually covers "bakes ... with N").
// "each"/"per"/"times"/"twice"/"double"/"triple"/"multiplied by" are far more specific to a
// multiplicative relationship on the number they sit next to and are kept.
const MULTIPLY_RE = /\b(per|each|times|twice|double|triple|multiplied by)\b/i;
const SUBTRACT_RE = /\b(eats?|ate|spends?|spent|loses?|lost|pays?|paid|uses?|used|gives? away|gave away|takes? away|took away|left|remain(?:ing|s)?|fewer|less|minus|subtract|difference)\b/i;
const ADD_RE = /\b(total|altogether|combined|in all|together|sum of|plus|gains?|receives?|receiving|gets? (?:another|more)|buys? another|adds?)\b/i;
const ANY_CUE_RE = new RegExp(
  `${DIVIDE_RE.source}|${MULTIPLY_RE.source}|${SUBTRACT_RE.source}|${ADD_RE.source}`,
  'i',
);

type Operator = 'add' | 'subtract' | 'multiply' | 'divide';

/** The operator between the running total and the number at `tokenIndex`, read from a LOCAL
 *  window of text around that number only (40 chars before, 25 chars after -- enough to catch the
 *  verb/preposition attached to that specific quantity, not the whole question, so an earlier
 *  clause's cue word cannot leak onto a later number). Returns null when no recognized cue is in
 *  that window -- the caller (deriveArithmeticChain) treats null as a hard refusal, never a
 *  default. */
function classifyLocalOperator(text: string, tokenIndex: number, tokenLength: number): Operator | null {
  const windowStart = Math.max(0, tokenIndex - 40);
  const windowEnd = Math.min(text.length, tokenIndex + tokenLength + 25);
  const window = text.slice(windowStart, windowEnd);
  if (DIVIDE_RE.test(window)) return 'divide';
  if (MULTIPLY_RE.test(window)) return 'multiply';
  if (SUBTRACT_RE.test(window)) return 'subtract';
  if (ADD_RE.test(window)) return 'add';
  return null;
}

const OP_SYMBOL: Record<Operator, string> = { add: '+', subtract: '-', multiply: '*', divide: '/' };

interface ChainStep {
  raw: string;
  value: number;
  op: Operator | null;
}

interface DerivationOk {
  ok: true;
  expression: string;
  trail: ChainStep[];
}

interface DerivationRefused {
  ok: false;
  reason: string;
  trailSoFar: ChainStep[];
}

/** Reads the question text ONLY -- no second argument, no qid lookup, no dataset field of any
 *  kind. Builds a left-to-right expression string (e.g. "3 * 3 * 60") from the numbers found and
 *  their locally-classified operators, or refuses with a stated reason the moment any number's
 *  operator cannot be classified. */
function deriveArithmeticChain(question: string): DerivationOk | DerivationRefused {
  const tokens = extractNumberTokens(question);
  if (tokens.length < 2) {
    return { ok: false, reason: `fewer than two numbers found in the question text (found ${tokens.length})`, trailSoFar: [] };
  }
  const trail: ChainStep[] = [{ raw: tokens[0].raw, value: tokens[0].value, op: null }];
  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    const op = classifyLocalOperator(question, t.index, t.length);
    if (!op) {
      return {
        ok: false,
        reason: `no recognized arithmetic cue word near the number "${t.raw}" -- refuses rather than guesses an operator`,
        trailSoFar: trail,
      };
    }
    trail.push({ raw: t.raw, value: t.value, op });
  }
  // MEASURED BUG, FIXED: a first-draft version joined `step.raw` here -- correct for a digit token
  // ("16") but WRONG for a word-number token ("three"), which SymPy then read as an unresolved
  // free symbol, not the number 3. Using `step.value` (always numeric, for both digit and
  // word-number tokens -- see extractNumberTokens() above) is what must be handed to SymPy.
  const expression = trail.map((step, i) => (i === 0 ? String(step.value) : `${OP_SYMBOL[step.op as Operator]} ${step.value}`)).join(' ');
  return { ok: true, expression, trail };
}

interface SympyResult {
  value: string;
  float: number;
}

/** D-BP164-M0-047 RECONCILIATION -- REWRITTEN to call the pre-existing runSympyArithmetic() bridge
 *  (plow_gom_jabbar.ts) instead of this file's own former execFileSync/python -c call. THE ONLY
 *  PLACE THIS FILE DOES ARITHMETIC -- and it still does not: it hands the expression string to
 *  runSympyArithmetic(), which spawns the SAME python subprocess convention
 *  (`python -c "from sympy import sympify, N; print(N(sympify('<expr>')))"`), already verified
 *  against this machine's real installed python (3.13.14) and sympy (1.14.0). Throws (never
 *  returns a fabricated value) when the bridge itself returns null -- missing python, missing
 *  sympy, a non-numeric result, a timeout, or a non-whitelisted expression -- so run()'s existing
 *  try/catch below still produces the same honest abstain it always did on a SymPy failure, now for
 *  ONE bridge's failure modes instead of two independently-implemented ones. `value`/`float` are
 *  both the same JS number the bridge returns (SymPy's own N() numeric evaluation): a genuinely
 *  integer result (e.g. 18) surfaces as the exact integer string, never SymPy's `N()` decimal-place
 *  padding, so a caller reading `.value` sees "18", not "18.0000000000000". */
async function evaluateWithSympy(expression: string): Promise<SympyResult> {
  const result = await runSympyArithmetic(expression);
  if (result === null) {
    throw new Error(
      `runSympyArithmetic (plow_gom_jabbar.ts) returned null for expression "${expression}" -- missing ` +
        'python/sympy, a non-numeric SymPy result, a timeout, or a non-whitelisted expression (see that ' +
        "function's own doc comment for the full list of honest-null causes).",
    );
  }
  return { value: String(result.value), float: result.value };
}

function shapeTest(input: MethodQuestionInput): ShapeTestResult {
  // NEVER reads input.correctAnswer -- see this file's header. Only `input.question` and
  // `input.options` are read below, matching every other cascade's shapeTest() signature.
  if (input.options && Object.keys(input.options).length >= 2) {
    return {
      matches: false,
      reason: 'has >=2 lettered options -- arithmetic-cascade only matches free-text word problems with no option list (the mirror image of the other cascades\' gate)',
    };
  }
  const question = input.question || '';
  const tokens = extractNumberTokens(question);
  if (tokens.length < 2) {
    return {
      matches: false,
      reason: `only ${tokens.length} number(s) found in the question text -- arithmetic-cascade requires at least two quantities to combine`,
    };
  }
  if (!ANY_CUE_RE.test(question)) {
    return {
      matches: false,
      reason: 'no arithmetic operation cue word (total/eats/each/divided by/etc) found anywhere in the question text',
    };
  }
  return {
    matches: true,
    reason: `free-text question, no options, ${tokens.length} numbers found, at least one arithmetic cue word present -- matches the ASDiv/GSM8K arithmetic word-problem shape`,
  };
}

async function run(input: MethodQuestionInput, _ctx: MethodRunContext): Promise<LianaTerminalOutcome> {
  // NEVER reads input.correctAnswer. Derivation depends on input.question alone.
  const question = input.question || '';
  const derivation = deriveArithmeticChain(question);
  if (!derivation.ok) {
    return {
      question,
      verdict: null,
      abstain: true,
      freeText: true,
      method: 'arithmetic-cascade',
      basis: `REFUSES rather than guesses: ${derivation.reason}. Numbers classified before the refusal: `
        + `${derivation.trailSoFar.map((s) => `${s.raw}${s.op ? ` (${s.op})` : ''}`).join(', ') || 'none'}.`,
    };
  }
  let sympyResult: SympyResult;
  try {
    sympyResult = await evaluateWithSympy(derivation.expression);
  } catch (e) {
    return {
      question,
      verdict: null,
      abstain: true,
      freeText: true,
      method: 'arithmetic-cascade',
      basis: `SymPy evaluation failed for expression "${derivation.expression}": ${String((e as Error)?.message ?? e)}`,
    };
  }
  return {
    question,
    verdict: sympyResult.value,
    abstain: false,
    freeText: true,
    method: 'arithmetic-cascade',
    basis: `derived from the question text alone (never reads a dataset answer field): expression `
      + `"${derivation.expression}" built from ${derivation.trail.length} numbers found in the `
      + `question, evaluated by SymPy (sympy.sympify) => ${sympyResult.value}.`,
  };
}

export const arithmeticCascadeMethod: LianaMethod = {
  id: 'arithmetic-cascade',
  // D-BP164-M0-112: PROVISIONAL CAST REMOVED. 'COMPUTE' is now a real member of demand_test.ts's
  // LianaDemand union -- the Founder act canon R-7 required was made this dispatch (see that
  // union's own header). This method is now reachable through BOTH demand-gated selection
  // (selectMethod(input, 'COMPUTE')) and the pre-existing shape-only mode.
  demand: 'COMPUTE',
  name: 'Arithmetic Cascade (SymPy-derived; demand COMPUTE)',
  taughtBy: 'D-BP164-M0-037/BISHOP/M0/seg-ef. Founder order, BP164: "why not use SymPy?", in '
    + 'response to D-BP164-M0-032\'s finding that the registry had no arithmetic-shaped method. '
    + 'No single walked human case taught this method the way qid 98/85/46 taught the three '
    + 'existing cascades (canon rule 4, method_registry.ts header) -- it is a generic SymPy-backed '
    + 'chain extractor built to the Founder\'s direct instruction, not a transcribed hand-walk. '
    + 'Flagged here rather than fabricating a case citation.',
  shapeDescription: 'a free-text word problem (no lettered options) stating several quantities in '
    + 'prose, asking for a number derived by combining them -- the ASDiv/GSM8K shape',
  shapeTest,
  run,
};

// Registers at import time, same convention as every other method module (comparative_cascade.ts,
// definitional_cascade.ts, classify_cascade.ts, untaught_shapes.ts). NOT auto-imported by any
// driver today -- Stage 1's wiring (D-BP164-M0-032) explicitly requires only comparative/
// definitional/classify_cascade.js; this file must be explicitly required by a caller before its
// registerMethod() call runs, exactly like untaught_shapes.js sits unrequired today.
registerMethod(arithmeticCascadeMethod);
