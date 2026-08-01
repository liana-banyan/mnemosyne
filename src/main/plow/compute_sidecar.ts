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

import { create, all, type Unit } from 'mathjs';
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

/** Extracts "A) text" / "B) text" ... options from the exact prompt shape
 *  wan_dispatch.ts's buildMcPrompt() produces (verified file:line this Yoke): letter,
 *  close-paren, space, option text -- which is NOT necessarily confined to one line. Works whether
 *  or not substrate context was prepended above it (applySubstrateToggle only ever prepends text
 *  before this block, never rewrites it).
 *
 *  BP141 MULTI-LINE OPTION TRUNCATION FIX (the pseudocode-solver abstain, root-caused here rather
 *  than in the solver). The old body was a single `/^([A-J])\)\s*(.+)$/gm` sweep. JavaScript's `.`
 *  does not match `\n`, so an option whose text spans multiple lines was silently cut down to its
 *  FIRST LINE and every continuation line was dropped on the floor (no error, no warning -- a
 *  SILENT GATE in the Coffee's own sense). buildMcPrompt joins options with `\n`, so a multi-line
 *  option's continuation lines sit in the block carrying no `X)` prefix of their own and were
 *  simply never matched by anything.
 *
 *  Empirically proven this Yoke against the REAL compiled dist and the REAL dataset entry
 *  (mmlu_pro_per_domain\computer_science\questions.json, source_id 10442 -- the AP-CSP list-merge
 *  question): 4 of its 8 options are multi-statement code segments, and they lost 94 / 64 / 94 /
 *  112 characters each. The correct answer C ("Combine, then Sort, then RemoveDup1icates") was
 *  reduced to just "newList <- Combine (listl, list2)", making it byte-identical in meaning to the
 *  wrong option A -- so solvePseudocodeTraceProblem found ZERO options matching the worked
 *  example's expected output and honestly abstained. Its gate and its arithmetic were right all
 *  along; it was handed mutilated inputs. Against the untruncated options the very same compiled
 *  solver selects C, the dataset's own key.
 *
 *  This truncation was never solver-specific: EVERY consumer of this function saw the mutilated
 *  text, including plow_mc_answerer.ts's `mcOptionTexts`, i.e. the option list actually shown to
 *  Perplexity / Claude / ChatGPT / Gemini, and `resolveAuthorityLetterMatch`'s text matching.
 *
 *  THE FIX, deliberately narrow: locate each `^([A-J])\)` header, then take that option's text as
 *  everything from the header to the start of the NEXT header. The final option ends at the first
 *  BLANK line after it (buildMcPrompt separates the options block from its trailer with `\n\n`,
 *  while multi-line option bodies use single newlines throughout), or at end-of-string when there
 *  is no blank line left. A single-line option is byte-for-byte unaffected: its "everything up to
 *  the next header" IS the remainder of its own line, and the same `.trim()` is applied as before.
 *  Nothing is invented and nothing new is discarded -- previously-lost characters are restored. */
export function parseOptionsFromPrompt(prompt: string): McOption[] {
  const headerRe = /^([A-J])\)[ \t]*/gm;
  const headers: Array<{ letter: string; bodyStart: number; headerStart: number }> = [];
  let hm: RegExpExecArray | null;
  while ((hm = headerRe.exec(prompt)) !== null) {
    headers.push({
      letter: hm[1] as string,
      headerStart: hm.index,
      bodyStart: hm.index + hm[0].length,
    });
  }

  const options: McOption[] = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i] as { letter: string; bodyStart: number; headerStart: number };
    const next = headers[i + 1];
    let end: number;
    if (next) {
      end = next.headerStart;
    } else {
      // Last option: stop at the first blank line (the options block's own terminator in
      // buildMcPrompt), else run to the end of the prompt.
      const blank = prompt.slice(h.bodyStart).search(/\r?\n[ \t]*\r?\n/);
      end = blank === -1 ? prompt.length : h.bodyStart + blank;
    }
    const text = prompt.slice(h.bodyStart, end).trim();
    if (text.length === 0) continue; // an empty option body is not an option -- same as before
    options.push({ letter: h.letter, text });
  }
  return options;
}

/** First clean numeric token in a string: handles leading $, thousands commas, %, decimals, a
 *  leading minus sign. Returns null when no number is present. */
export function extractNumber(text: string): number | null {
  const cleaned = text.replace(/,/g, '');
  // BUG (BP1xx leading-dot-decimal miss): MMLU-Pro option text sometimes omits the leading zero
  // ("`.60 g/cc`" instead of "`0.60 g/cc`"). The old digit-first pattern (`\d+(?:\.\d+)?`) cannot
  // match at the leading `.`, so the regex engine slid forward and matched the bare "60" --
  // silently dropping the decimal point and turning 0.60 into 60 (a 100x error). The added
  // `|\.\d+` alternative matches a dot-led decimal as a whole token when no leading digit is
  // present; the original digit-first alternative is tried first and unchanged, so every
  // already-working format (123, 1,234.5, 0.60, $100, 50%) still matches exactly as before.
  const m = cleaned.match(/-?\$?(?:\d+(?:\.\d+)?|\.\d+)%?/);
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

// --- BP-COMPUTE-UNITS: units-aware value->option matching (mathjs) -----------------------------
//
// WHY THIS EXISTS (Founder "times tables" insight): matchValueToOption() above is unit-UNAWARE --
// it compares bare numeric tokens. That is exactly the gap that loses questions like "density of
// a block of wood, 750 kg, 25 cm x 0.10 m x 50.0 m": the correct computed quantity is
// 600 kg/m^3, but the MC options are stated in g/cc (0.60 g/cc). matchValueToOption(600, options)
// finds no option near 600 and abstains -- not wrong, but not smart enough to see that 600 kg/m^3
// and 0.60 g/cc are the SAME quantity in different units. mathjs (already a well-maintained,
// widely-used library; verified present at package.json:55 -- "mathjs": "^15.2.0" -- after this
// Yoke added it) supplies real unit algebra (parsing, dimensional-compatibility checks, and
// conversion) so this file never has to hand-roll a fragile unit-conversion table.
//
// Empirically verified against the installed mathjs (15.2.0) in this repo, this Yoke, via a
// throwaway Node script (deleted after use, per instructions -- not committed):
//   math.evaluate('750 kg / (25 cm * 0.10 m * 50.0 m)') -> Unit "600 kg / m^3"
//   thatUnit.to('g/cc').toNumber('g/cc') -> 0.6
//   math.evaluate('600 kg/m^3').to('g/mol')  -> throws "Units do not match" (dimensional
//     mismatch correctly rejected, never silently forced)
// Two API details this code depends on (both confirmed empirically, not from memory of the
// mathjs docs, since exact behavior varies by version):
//   1. Unit#toNumber() with NO argument returns the value in mathjs's internal SI-derived base
//      representation (e.g. 6, not 600, for "600 kg/m^3") -- every call in this file passes an
//      EXPLICIT target-unit string, never a bare `.toNumber()`.
//   2. Unit#to(unit) requires a "valueless" unit (a bare unit specifier, not a Unit carrying its
//      own numeric value) -- pass a unit STRING (`optionQuantity.unit.formatUnits()`), never the
//      option's own valued Unit object directly (that throws "Cannot convert to a unit with a
//      value").

const math = create(all, {});

export interface Quantity {
  value: number;
  /** A mathjs Unit instance when the quantity carries a unit (e.g. "600 kg/m^3"); null for a
   *  bare/unitless number, in which case callers fall back to plain numeric comparison --
   *  identical discipline to matchValueToOption above. */
  unit: Unit | null;
}

/** Validate-then-evaluate, same "no non-arithmetic character reaches an evaluator" discipline as
 *  evaluateSandboxedFunction() below -- mathjs's own expression parser is not a raw eval(), but
 *  this repo's existing convention (and simple defense in depth) is to whitelist BEFORE handing
 *  text to any evaluator, so this file keeps doing that here too. Allows letters (unit names),
 *  the handful of unit-symbol punctuation marks mathjs unit names use (degree, ohm, micro), and
 *  the same arithmetic characters ARITHMETIC_WHITELIST_RE already allows. */
const UNIT_EXPR_WHITELIST_RE = /^[\d+\-*/^().%\s A-Za-z°µΩ]+$/;

/** English short-words that ARE, empirically (verified this Yoke against the installed mathjs),
 *  also valid mathjs unit symbols -- "5 in", "5 at", "5 as" all parse successfully as inches /
 *  technical-atmospheres / attoseconds. Excluded as a UNIT token (not as a plain number) to cut
 *  false-positive quantity extraction from ordinary prose ("... increase in the ...", "evaluated
 *  at 5 ..."); legitimate single-letter physics units used constantly in MMLU-Pro prose (g, m, s,
 *  N, W, A, T, C, F, h) are deliberately NOT excluded. This is a precision guard only -- even an
 *  unfiltered false-positive quantity is harmless downstream because matchQuantityToOption's
 *  strict "exactly one option qualifies" gate almost never coincidentally matches a stray parse. */
const AMBIGUOUS_ENGLISH_UNIT_WORDS = new Set(['in', 'at', 'as']);

/** Unwraps a mathjs evaluate() result into a Quantity, honestly (never guesses at a shape it
 *  doesn't recognize -- e.g. a Matrix/Complex/BigNumber result from a stray expression returns
 *  null here so the caller falls through rather than mishandling it). */
function unwrapMathResult(result: unknown): Quantity | null {
  if (typeof result === 'number') {
    return Number.isFinite(result) ? { value: result, unit: null } : null;
  }
  if (result instanceof math.Unit) {
    // No target unit yet -- `.toNumber()` here is only used as a finiteness/sanity probe (see
    // this file's header re: bare toNumber() returning the SI-derived internal value, not a
    // meaningful display value); real comparisons downstream always pass an explicit unit.
    const probe = result.toNumber();
    return Number.isFinite(probe) ? { value: probe, unit: result } : null;
  }
  return null;
}

/** Evaluates a self-contained arithmetic expression that may carry units (e.g.
 *  "750 kg / (25 cm * 0.10 m * 50.0 m)"), via mathjs, when such an expression is cleanly present
 *  as a literal substring (goal spec path (b): "evaluating an extracted expression via mathjs
 *  when one is cleanly present"). Returns null (never throws, never guesses) on any parse/
 *  evaluation failure or non-numeric/non-Unit result. */
export function evaluateUnitExpression(expr: string): Quantity | null {
  const s = expr.trim();
  if (s.length === 0 || s.length > 200) return null;
  if (!UNIT_EXPR_WHITELIST_RE.test(s)) return null;
  try {
    return unwrapMathResult(math.evaluate(s));
  } catch {
    return null;
  }
}

/** Normalizes the common word-problem dimension-list idiom ("25 cm x 0.10 m x 50.0 m") to
 *  explicit multiplication before expression extraction. Only touches a standalone lowercase 'x'
 *  or '×' sitting directly between a number/unit token and a following digit (lookahead requires
 *  a digit next), so ordinary words containing 'x' ("x-ray", "next", "Xerox") are never touched --
 *  the preceding-group pattern anchors on a digit, so 'x' only fires right after a number or a
 *  short unit-word immediately after a number. */
function normalizeDimensionMultiply(text: string): string {
  return text.replace(/(\d(?:\.\d+)?\s*[A-Za-z]*)\s*[x×]\s*(?=\d)/g, '$1 * ');
}

const UNIT_NUM_TOKEN =
  '-?\\(?-?\\d+(?:\\.\\d+)?\\)?(?:\\s*[A-Za-z]+(?:\\^-?\\d+)?(?:\\s*/\\s*[A-Za-z]+(?:\\^-?\\d+)?)*)?';
const UNIT_EXPR_CHAIN_RE = new RegExp(
  `${UNIT_NUM_TOKEN}(?:\\s*[+\\-*/]\\s*${UNIT_NUM_TOKEN})+`,
  'g',
);

/** Extracts the longest unit-bearing arithmetic chain from `question` -- the units-aware sibling
 *  of extractArithmeticExpression() above. Deliberately requires at least one operator AND at
 *  least one unit letter in the match (a pure-number chain is that function's job, not this
 *  one) -- most MMLU-Pro word problems still won't have a literal "mass / volume"-shaped
 *  substring (the FORMULA is nowhere in the prose, only the raw quantities are), so this
 *  correctly returns null for them; it only fires when the question itself already spells out
 *  the arithmetic (e.g. a dimension list joined by "x", or a reasoning/fact string that already
 *  wrote the calculation out). */
export function extractUnitExpression(question: string): string | null {
  const normalized = normalizeDimensionMultiply(question);
  let best: string | null = null;
  UNIT_EXPR_CHAIN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = UNIT_EXPR_CHAIN_RE.exec(normalized)) !== null) {
    const candidate = m[0].trim();
    if (!/[A-Za-z]/.test(candidate)) continue; // no unit anywhere -- leave to extractArithmeticExpression
    if (!best || candidate.length > best.length) best = candidate;
  }
  return best;
}

// BUG 2 FIX (BP1xx density-unit-miss diagnosis): the unit-component alternatives originally
// required an explicit caret before an exponent digit (`kg/m^3` parsed, `kg/m3` did not -- the
// bare trailing "3" fell OFF the unit token entirely, leaving a dimensionally-wrong "kg/m" that
// can never match a g/cc-style option). "m3"/"cm3"/"ft2" (caret-less exponent, letter directly
// touching a trailing digit, no space) is extremely common shorthand in plain-text model output
// where superscript/caret notation isn't used -- empirically verified against the installed
// mathjs (15.2.0) that IT already parses "kg/m3" as cubic-meter-denominated kg (dimensionally
// identical to "kg/m^3") when given the clean text directly; the miss was purely this file's OWN
// tokenizer dropping the exponent digit before mathjs ever saw it. `(?:\^-?\d+|\d+)?` admits
// both spellings; the no-space requirement (digit must directly touch the letters, no `\s*`)
// keeps this from swallowing an unrelated adjacent number ("5 kg 3 times" still tokenizes as
// "5 kg" only -- "3" is not glued to "kg").
// BUG (BP1xx leading-dot-decimal miss): same root cause as extractNumber's leading-digit gap
// above, applied consistently here since this constant duplicates that number-shape assumption
// in its own capture group. Density-style MMLU-Pro options are frequently written without a
// leading zero ("`.60 g/cc`", "`.70 g/cc`"): the old group 1 (`\d[\d,]*(?:\.\d+)?`) cannot match
// at a leading `.`, so the scan slid forward and captured "60" alone (dropping the decimal point
// entirely, a 100x error) with "g/cc" still captured correctly as the unit -- a correctly
// computed 0.60 g/cc could then never match option text stated as ".60 g/cc". The added
// `|\.\d+` alternative lets a dot-led decimal match as one whole numeric token; the digit-first
// alternative is tried first and is byte-identical to the old pattern, so every already-working
// numeric shape (123, 1,234.5, 0.60, 600) still matches exactly as before.
const QUANTITY_TOKEN_RE =
  /(-?\$?(?:\d[\d,]*(?:\.\d+)?|\.\d+))\s*((?:%|°|[A-Za-z]+(?:\^-?\d+|\d+)?)(?:\s*[/*]\s*[A-Za-z]+(?:\^-?\d+|\d+)?)*)?/g;

/** Scans free text (an authority's/swarm's stated reasoning, or a short MC option string) for
 *  unit-bearing quantities and returns the LAST one that parses cleanly through mathjs -- "final
 *  stated result" convention (a worked derivation states intermediate quantities first and the
 *  answer last, e.g. "... = 750 kg / (25 cm x 0.10 m x 50.0 m) ... = 600 kg/m^3."). Goal spec
 *  path (a): "extracting the final 'value unit' from the authority's/swarm's reasoning". Returns
 *  null when no unit-bearing quantity parses -- bare numbers are extractNumber()'s job, not this
 *  function's; callers needing a unitless fallback should try extractNumber() separately (see
 *  parseOptionQuantity below for that composition). */
export function extractQuantityFromText(text: string): Quantity | null {
  let best: Quantity | null = null;
  QUANTITY_TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = QUANTITY_TOKEN_RE.exec(text)) !== null) {
    const numRaw = (m[1] ?? '').replace(/,/g, '').replace(/\$/g, '');
    const unitRaw = m[2]?.trim();
    if (!unitRaw) continue;
    if (AMBIGUOUS_ENGLISH_UNIT_WORDS.has(unitRaw.toLowerCase())) continue;
    const combined = `${numRaw} ${unitRaw}`;
    if (!UNIT_EXPR_WHITELIST_RE.test(combined)) continue;
    try {
      const q = unwrapMathResult(math.evaluate(combined));
      if (q && q.unit) best = q; // keep scanning -- LAST valid unit-bearing quantity wins
    } catch {
      continue;
    }
  }
  return best;
}

/** Composition used for MC option text specifically: try the unit-bearing extractor first (an
 *  option like "0.60 g/cc"), fall back to the pre-existing bare-number extractNumber() (an
 *  option like "600" with no unit at all) so unit-aware matching degrades gracefully to the old
 *  numeric-only behavior per option, rather than an all-or-nothing switch across the whole
 *  option set. */
function parseOptionQuantity(text: string): Quantity | null {
  const withUnit = extractQuantityFromText(text);
  if (withUnit) return withUnit;
  const n = extractNumber(text);
  return n === null ? null : { value: n, unit: null };
}

/** Units-aware sibling of matchValueToOption() above. For each option, parses its own value +
 *  unit and, when both the computed quantity and the option carry a unit, converts the computed
 *  quantity INTO the option's unit via mathjs (handling cross-unit matching, e.g. compute in
 *  kg/m^3 while options are stated in g/cc) before comparing within `relTolerance`. Dimensional
 *  mismatches (e.g. a mass-per-volume computed value against a mass-per-mole option) are treated
 *  as "this option doesn't qualify," never forced.
 *
 *  HONESTY (non-negotiable, same bar as matchValueToOption): accepted ONLY when EXACTLY ONE
 *  option qualifies within tolerance. Unlike matchValueToOption (which picks the single closest
 *  option among however many clear the tolerance band), this function requires the qualifying
 *  set to have size exactly 1 -- zero qualifiers is an honest "can't map it," and two-or-more
 *  qualifiers is an honest "ambiguous, don't force one" -- both return null so the caller falls
 *  through rather than guessing. */
export function matchQuantityToOption(
  computed: Quantity,
  options: McOption[],
  relTolerance = 0.02,
): { letter: string; optionValue: number; optionUnit: string | null } | null {
  const qualifying: Array<{ letter: string; optionValue: number; optionUnit: string | null }> = [];
  for (const opt of options) {
    const optQ = parseOptionQuantity(opt.text);
    if (!optQ) continue;

    let compareValue: number;
    let optionOwnValue: number;
    let optionUnitLabel: string | null;

    if (computed.unit && optQ.unit) {
      const targetUnitStr = optQ.unit.formatUnits();
      let converted: Unit;
      try {
        converted = computed.unit.to(targetUnitStr);
      } catch {
        continue; // dimensionally incompatible -- never force a cross-dimension match
      }
      compareValue = converted.toNumber(targetUnitStr);
      optionOwnValue = optQ.unit.toNumber(targetUnitStr);
      optionUnitLabel = targetUnitStr;
    } else if (!computed.unit && !optQ.unit) {
      compareValue = computed.value;
      optionOwnValue = optQ.value;
      optionUnitLabel = null;
    } else {
      continue; // one side carries a unit, the other doesn't -- ambiguous, skip rather than guess
    }

    const tolerance = Math.max(Math.abs(optionOwnValue) * relTolerance, 1e-9);
    if (Math.abs(compareValue - optionOwnValue) <= tolerance) {
      qualifying.push({ letter: opt.letter, optionValue: optionOwnValue, optionUnit: optionUnitLabel });
    }
  }
  return qualifying.length === 1 ? qualifying[0]! : null;
}

// --- BP-COMPUTE-BARE: bare-number (unit-less) extraction + matching ----------------------------
//
// WHY THIS EXISTS (Founder Scaccio case, real miss): extractQuantityFromText/computeUnitAwareMatch
// above only catch UNIT-bearing quantities (kg/m^3, g/cc, etc.) -- they are blind to bare numeric
// answers with no physical unit at all: money ("$103.11"), counts, percentages, plain numbers.
// "Mr. Scaccio borrows $100, pays back $20/month with 1% monthly interest on the unpaid balance.
// How much does he pay?" is exactly this shape: the authority reasons its way to "$103.11 total"
// but states the wrong letter, and extractQuantityFromText requires a mathjs unit token so
// "$103.11" (currency, no mathjs unit) is skipped -- nothing ever matches. This section is the
// bare-number sibling, tried ONLY after both unit-aware paths in computeUnitAwareMatch return
// null, so a genuinely unit-bearing question is never short-circuited by a coincidental
// bare-number hit.

/** Number-then-framing-word ("$103.11 in total", "20 altogether") and framing-word-then-number
 *  ("total of $103.11", "the answer is 20", "he pays 20", "so 20", "therefore 20") shapes both
 *  occur in worked reasoning prose; both are tried so whichever order the authority happened to
 *  write in is caught.
 *
 *  BUG 1 REGRESSION FIX (tightened precision over recall, per Founder spec): a bare "=" was
 *  REMOVED as a standalone framing trigger. The orbital-period miss (question_id 118 in the real
 *  008 receipt) was caused exactly by this: the reasoning contained the FORMULA
 *  "T = 2 pi (d/2)^3 / (G(2M))" -- the old `=` alternative matched the "=" in "T =" and grabbed
 *  the very next bare digit ("2", a coefficient mid-derivation) as if it were the stated final
 *  answer, which then flipped a correct swarm letter to a wrong one via matchValueToOption. A
 *  literal "=" sign is exactly as common inside an intermediate formula as inside a genuine final
 *  answer, so it is not a safe signal on its own. "= X total" style final answers are still
 *  caught -- they clear BARE_NUMBER_THEN_FRAME_RE's own suffix-framing check regardless of
 *  whatever precedes the number (e.g. "... = $103.11 in total"). "so"/"therefore" were ADDED as
 *  framing words (word-bounded, so they don't match inside "also"/"reasonable" etc.) per the
 *  Founder's explicit tightened-framing list. A leading `\b` keeps "total"/"answer"/"result" from
 *  matching as a substring of an unrelated longer word (e.g. "subtotal"). */
const BARE_NUMBER_THEN_FRAME_RE =
  /(-?\$?\d[\d,]*(?:\.\d+)?%?)\s+(?:in\s+total|total|altogether|overall)\b/gi;
const BARE_FRAME_THEN_NUMBER_RE =
  /\b(?:total(?:\s+of)?|answer(?:\s+is)?|answer\s*:|result(?:\s+is)?|result\s*:|pays?|owes?|equals?|therefore|so)\s*:?\s*(-?\$?\d[\d,]*(?:\.\d+)?%?)/gi;

/** BUG 1 REGRESSION FIX, second layer: even a framed match is rejected when the matched number
 *  sits directly against formula/expression punctuation -- an operator, an exponent/pi/summation
 *  symbol, or a formula function name (sin/cos/sqrt/etc) immediately before or after it (within a
 *  short window, ignoring intervening whitespace). This is deliberately independent of which
 *  framing word matched: "so 2 pi r" or "= 2 * (x+1)" must never fire even if a framing keyword
 *  happens to sit nearby, because the number itself is still visibly mid-expression, not a
 *  standalone concluding value. Defense in depth on top of the `=`-removal above, not a
 *  replacement for it. */
const FORMULA_CONTEXT_WINDOW = 16;
const FORMULA_ADJACENT_CHAR_RE = /[+\-*/^=πΠ𝜋√∑∫]/;
const FORMULA_WORD_RE = /\b(?:sin|cos|tan|log|ln|sqrt|exp|pi)\b/i;

function isFormulaAdjacent(text: string, numStart: number, numLen: number): boolean {
  const numEnd = numStart + numLen;
  const before = text.slice(Math.max(0, numStart - FORMULA_CONTEXT_WINDOW), numStart);
  const after = text.slice(numEnd, numEnd + FORMULA_CONTEXT_WINDOW);
  const lastBeforeChar = before.replace(/\s+$/, '').slice(-1);
  const firstAfterChar = after.replace(/^\s+/, '').slice(0, 1);
  if (lastBeforeChar && FORMULA_ADJACENT_CHAR_RE.test(lastBeforeChar)) return true;
  if (firstAfterChar && FORMULA_ADJACENT_CHAR_RE.test(firstAfterChar)) return true;
  if (FORMULA_WORD_RE.test(before) || FORMULA_WORD_RE.test(after)) return true;
  return false;
}

/** Pulls the final/most-salient bare numeric value out of free text (an authority's reasoning, a
 *  swarm voter's raw preview, etc.) -- unit-unaware sibling of extractQuantityFromText above.
 *  Fires ONLY when a value is explicitly framed as the answer/total ("... $103.11 in total ...",
 *  "the answer is 20", "total of $5.00", "so $20", "therefore 20") AND that value is not sitting
 *  directly against formula/expression punctuation (see isFormulaAdjacent above), in TEXT-
 *  POSITION order (last qualifying framed mention wins -- same "final stated result" convention
 *  extractQuantityFromText already uses).
 *
 *  BUG 1 REGRESSION FIX: the old unframed "last bare numeric token anywhere in the text" fallback
 *  has been REMOVED ENTIRELY. It was the single biggest source of false overrides -- any stray
 *  number anywhere in a worked derivation (a coefficient, an intermediate value, a formula
 *  constant) could get picked up as if it were the final answer. Per the honesty bar this whole
 *  file operates under (a false override is strictly worse than no override), an unframed number
 *  is no longer trusted at all: no framing keyword anywhere in the text means this function
 *  returns null and the caller falls through to the ensemble/swarm letter untouched, never a
 *  guess. Reuses extractNumber's own cleaning/parsing (leading $, thousands commas, %, leading
 *  minus) on every captured token -- never a second independent numeric parser. */
export function extractBareValueFromText(text: string): number | null {
  const framed: Array<{ index: number; value: number }> = [];

  BARE_NUMBER_THEN_FRAME_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BARE_NUMBER_THEN_FRAME_RE.exec(text)) !== null) {
    const numStart = m.index;
    const numLen = (m[1] as string).length;
    if (isFormulaAdjacent(text, numStart, numLen)) continue;
    const n = extractNumber(m[1] as string);
    if (n !== null) framed.push({ index: m.index, value: n });
  }
  BARE_FRAME_THEN_NUMBER_RE.lastIndex = 0;
  while ((m = BARE_FRAME_THEN_NUMBER_RE.exec(text)) !== null) {
    const numLen = (m[1] as string).length;
    const numStart = m.index + m[0].length - numLen;
    if (isFormulaAdjacent(text, numStart, numLen)) continue;
    const n = extractNumber(m[1] as string);
    if (n !== null) framed.push({ index: m.index, value: n });
  }
  if (framed.length === 0) return null; // no unambiguous final-answer framing -- honest null, never a guess
  framed.sort((a, b) => a.index - b.index);
  return framed[framed.length - 1]!.value;
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

// BP139 Authority Ensemble: Wolfram-ONLY entry point (no local-arithmetic/model-expression
// tiers) -- used by plow_mc_answerer.ts's authority ensemble to add a genuine Wolfram Alpha
// candidate to the compute ensemble without conflating it with the local_arithmetic tier (which
// already has its own place in the existing Stage A.3 compute-sidecar fallback further down the
// plow). Returns null (never fabricates) when Wolfram has no short answer for this question, per
// computeViaWolframAlpha's own honesty contract above -- callers must skip this candidate
// silently on null, same "if not available, skip silently" contract as every other tier here.
export async function computeViaWolframOnly(
  question: string,
  appId: string,
): Promise<ComputeSidecarResult | null> {
  const result = await computeViaWolframAlpha(question, appId);
  if (!result) return null;
  return { value: result.value, expression: question, method: 'wolfram_compute' };
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

// --- BP-COMPUTE-UNITS: top-level units-aware orchestration -------------------------------------

export interface UnitAwareComputeResult {
  letter: string;
  optionValue: number;
  optionUnit: string | null;
  computedValue: number;
  /** mathjs's own canonical rendering of the computed quantity's unit (e.g. "kg / m^3"), or null
   *  for a unitless computed value. */
  computedUnit: string | null;
  /** The literal expression (path (b)) or reasoning/fact snippet (path (a)) the quantity was
   *  pulled from -- carried through so the caller can eblet the method with a real example. */
  sourceExpression: string;
  source: 'question_expression' | 'reasoning_fact';
  method: 'unit_expression' | 'unit_reasoning_extraction' | 'bare_value_match';
}

/** Top-level units-aware entry point. Synchronous and pure (no I/O, no model call) -- all three
 *  paths it tries are deterministic local computation, tried IN ORDER, each only attempted after
 *  the previous one returns null:
 *   (b) FIRST: is a unit-bearing arithmetic expression cleanly present in the question text
 *       itself (e.g. a dimension list "25 cm x 0.10 m x 50.0 m")? Extract + evaluate via mathjs.
 *   (a) THEN: does any supplied `componentFacts` string (the SAME post-relevance-gate swarm/
 *       authority fact snippets plow_mc_answerer.ts already threads into computeAnswer's
 *       `componentFacts`, see ComputeAnswerOptions.componentFacts) state a unit-bearing final
 *       quantity (e.g. "... = 600 kg/m^3")? Extract the LAST such quantity per fact.
 *   (c) FINALLY (BP-COMPUTE-BARE, Founder Scaccio case): does any `componentFacts` string state a
 *       BARE numeric answer with no physical unit at all (money, counts, percentages, plain
 *       numbers -- e.g. "... about $103.11 in total ...")? extractBareValueFromText() pulls the
 *       most-salient bare number; matched via matchQuantityToOption's own unitless-vs-unitless
 *       branch (unit: null on both sides), the SAME tolerance + exact-one-option gate as (a)/(b).
 *       Tried LAST specifically so a genuinely unit-bearing question is never short-circuited by a
 *       coincidental bare-number hit -- (b) and (a) always get first crack at it.
 *  Every path's candidate quantity is matched against the options via matchQuantityToOption --
 *  the SAME strict "exactly one option qualifies" honesty gate for all three. Returns null (never
 *  guesses) when no path produces an unambiguous match; callers should fall through to
 *  computeAnswer()/matchValueToOption's existing unit-UNAWARE path unchanged, exactly as before
 *  this function existed. */
export function computeUnitAwareMatch(
  researchQuery: string,
  mcOptions: McOption[],
  opts: { componentFacts?: string[] } = {},
): UnitAwareComputeResult | null {
  const expr = extractUnitExpression(researchQuery);
  if (expr) {
    const q = evaluateUnitExpression(expr);
    if (q) {
      const matched = matchQuantityToOption(q, mcOptions);
      if (matched) {
        return {
          letter: matched.letter,
          optionValue: matched.optionValue,
          optionUnit: matched.optionUnit,
          computedValue: q.value,
          computedUnit: q.unit ? q.unit.formatUnits() : null,
          sourceExpression: expr,
          source: 'question_expression',
          method: 'unit_expression',
        };
      }
    }
  }

  for (const fact of opts.componentFacts ?? []) {
    const q = extractQuantityFromText(fact);
    if (!q || !q.unit) continue; // unit-bearing only -- a unitless fact adds nothing matchValueToOption didn't already have
    const matched = matchQuantityToOption(q, mcOptions);
    if (matched) {
      return {
        letter: matched.letter,
        optionValue: matched.optionValue,
        optionUnit: matched.optionUnit,
        computedValue: q.value,
        computedUnit: q.unit.formatUnits(),
        sourceExpression: fact,
        source: 'reasoning_fact',
        method: 'unit_reasoning_extraction',
      };
    }
  }

  // (c) BARE-NUMBER fallback (BP-COMPUTE-BARE, Founder Scaccio case) -- see
  // extractBareValueFromText's header comment. Tried LAST, only after both unit-aware paths above
  // return null, so a question that DOES carry units is never short-circuited by a coincidental
  // bare-number hit. Matched via matchQuantityToOption's OWN unitless-vs-unitless branch
  // (computed.unit === null && optQ.unit === null) -- the SAME tolerance + exact-one-option
  // honesty gate the unit-aware paths above already use (0/2+ qualifying options -> null, never
  // forced); this is not a weaker/parallel gate, it is the identical one, reused unchanged.
  for (const fact of opts.componentFacts ?? []) {
    const bareValue = extractBareValueFromText(fact);
    if (bareValue === null) continue;
    const matched = matchQuantityToOption({ value: bareValue, unit: null }, mcOptions);
    if (matched) {
      return {
        letter: matched.letter,
        optionValue: matched.optionValue,
        optionUnit: matched.optionUnit,
        computedValue: bareValue,
        computedUnit: null,
        sourceExpression: fact,
        source: 'reasoning_fact',
        method: 'bare_value_match',
      };
    }
  }

  return null;
}
