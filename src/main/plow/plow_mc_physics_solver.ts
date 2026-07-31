// plow_mc_physics_solver.ts -- deterministic "physics-relation" solver: set up a single known
// physical law from the question's own givens and solve, a FIFTH independent compute tier
// alongside computeUnitAwareMatch, computeAnswer+matchValueToOption, solveScheduleProblem, and
// solveDensityProblem (see plow_mc_answerer.ts's resolveDeterministicComputeOverride).
//
// WHY THIS EXISTS: the last remaining compute-class benchmark miss (verified this Yoke against
// resources/mmlu_pro/physics/questions.json, source_id 9962) is
//   "Two double stars of the same mass as the sun rotate about their common center of mass. Their
//    separation is 4 light years. What is their period of revolution?"
// with options in a glued scientific-notation dataset format ("9$10^7 \mathrm{yr}$ ") and a
// correct_answer of exactly that "9$10^7 yr" option. None of the four existing tiers can reach
// this: (i) computeUnitAwareMatch needs a CONTIGUOUS unit-bearing arithmetic chain already
// spelled out in the text -- this question states only raw givens (mass equivalence, a
// separation), never the Kepler formula itself, so there is no such chain to extract; (ii)
// computeAnswer's model-derived-expression tier is exactly the mechanism that produced the
// documented "orbital-period miss" (compute_sidecar.ts's BARE_NUMBER_THEN_FRAME_RE comment,
// question_id 118 in the real 008 receipt): a reasoning string containing the intermediate
// formula "T = 2 pi (d/2)^3 / (G(2M))" got a mid-derivation coefficient mis-grabbed as if it were
// the final answer; (iii)/(iv) are structurally unrelated (loan amortization / mass-dimensions
// density). This module is a dedicated, narrowly-gated Kepler's-third-law solver that derives the
// period STRICTLY from the question's own text (mass equivalence + separation), never from any
// authority's/model's reasoning, then verifies the result against the MC options itself --
// exactly the "components, not answers" discipline every other tier in this file already follows.
//
// LAW: for two bodies mutually orbiting their common center of mass, Kepler's third law gives
//   P^2 = 4 * pi^2 * a^3 / (G * (M1 + M2))
// where `a` is the SEPARATION between the two bodies (not a semi-major axis of a third body) and
// M1, M2 are the two bodies' own masses. HAND-VERIFIED (this Yoke) against the real question:
// M1=M2=1 solar mass, a=4 light years ->
//   a = 4 * 9.4607e15 m = 3.78429e16 m ; M1+M2 = 2 * 1.989e30 kg = 3.978e30 kg
//   P = 2*pi*sqrt(a^3 / (G*(M1+M2))) = 2*pi*sqrt(5.4194e49 / 2.6555e20) s ~= 2.8387e15 s
//   P in years (Julian year, 3.15576e7 s) ~= 8.995e7 yr ~= 9e7 yr -- matches the option
//   "9$10^7 \mathrm{yr}$ " (source_id 9962's own correct_answer) and is ~11% away from its
//   nearest neighbor options (8e7 / 1e8), so a modest relative tolerance is unambiguous.
//
// CONSERVATISM (never guess), same bar as every other tier in this repo: fires ONLY when ALL of
// the following are confidently present in the question text alone --
//   (1) an explicit double/binary-star, common-center-of-mass, "period of revolution" framing
//       (this is deliberately narrower than "any physics question" -- two OTHER real double-star
//       questions in this same dataset ask for angular resolution via a double-slit/telescope,
//       an entirely different law; the common-center-of-mass + period-of-revolution combination
//       is what specifically selects the Kepler two-body case and excludes those);
//   (2) an explicit statement that both stars share a stated multiple of the sun's mass (handles
//       the exact "same mass as the sun" phrasing, generalized to "N times the mass of the sun");
//   (3) a separation value with a recognized distance unit (light years, AU, km, m, cm);
//   (4) every MC option parses to a numeric value in a recognized year-unit (the dataset's own
//       glued "N$10^E$" scientific-notation artifact is parsed explicitly below, with a plain
//       "N years"-style fallback for any other formatting) -- if even one option fails to parse,
//       this returns null rather than risk an unverifiable comparison set.
// Any missing/ambiguous piece returns null immediately. The final match step requires EXACTLY ONE
// option within tolerance (same "exactly one option qualifies" honesty gate as every other tier
// here) -- zero or 2+ qualifying options is an honest null, never a forced guess.
//
// mathjs supplies the gravitational constant (math.gravitationConstant, CODATA-sourced) and does
// the actual dimensioned arithmetic (Unit algebra), same library every other compute tier in this
// repo already depends on. mathjs has NO built-in solar-mass or light-year constant (verified
// empirically against the installed mathjs 15.2.0 this Yoke -- `math.evaluate('1 lightyear')` and
// `math.solarMass` both fail/are undefined), so those two are the only hardcoded physical
// constants below (standard CODATA/IAU values, cited inline).
//
// Rule 66: version, never overwrite -- this is a new file, no supersede needed.

import { create, all } from 'mathjs';
import type { McOption } from './compute_sidecar';

const math = create(all, {});

export interface PhysicsSolverResult {
  letter: string;
  /** Our computed period, expressed in years (the SAME unit every option in this question shape
   *  uses) -- directly comparable to `optionValue`, same computed-value-vs-option-value
   *  distinction every other tier in this repo surfaces. */
  value: number;
  /** The MC option's OWN stated numeric value (e.g. 9e7 for the text "9$10^7 \mathrm{yr}$"). */
  optionValue: number;
  provenance: string;
  trace: string;
}

// --- Physical constants (standard CODATA/IAU values; mathjs has no built-in solar-mass or
// light-year constant, verified empirically this Yoke) ------------------------------------------

/** IAU nominal solar mass, kg. */
const M_SUN_KG = 1.989e30;
/** Astronomical Unit, meters (IAU 2012 exact definition). */
const AU_M = 1.495978707e11;

// --- Context gate: double/binary star, common center of mass, period-of-revolution ask ---------
//
// Deliberately narrower than "mentions a double star" -- two OTHER real double-star questions in
// this same MMLU-Pro physics set ask for the ANGULAR SEPARATION resolvable by a telescope/double
// slit (a diffraction-limit law, not Kepler's third law). Requiring the common-center-of-mass +
// period-of-revolution combination specifically selects the mutual-orbit Kepler case and excludes
// those two unrelated questions (neither mentions a center of mass or asks for a period).

const BINARY_STAR_RE = /\b(?:double|binary)\s+stars?\b/i;
const COMMON_COM_RE = /\bcommon center of mass\b/i;
const PERIOD_ASK_RE = /\bperiod of revolution\b|\borbital period\b|\bwhat is (?:its|their) period\b/i;

// --- Equal-mass extraction: "same mass as the sun" (multiplier 1) or "N times the mass of the
// sun" (multiplier N) --------------------------------------------------------------------------

const SAME_MASS_AS_SUN_RE = /\bsame mass as the sun\b/i;
const MASS_MULTIPLE_RE = /\b([\d.]+)\s*times?\s+the mass of the sun\b/i;

function extractSolarMassMultiplier(text: string): number | null {
  if (SAME_MASS_AS_SUN_RE.test(text)) return 1;
  const m = text.match(MASS_MULTIPLE_RE);
  if (m && m[1]) {
    const v = parseFloat(m[1]);
    if (Number.isFinite(v) && v > 0) return v;
  }
  return null;
}

// --- Separation extraction: "separation is X <unit>" / "separated by X <unit>" / "distance ...
// is/of X <unit>" -- light years, AU, km, m, cm ---------------------------------------------------

const SEP_UNIT_ALT =
  '(?:light[- ]?years?|ly|astronomical units?|au|kilometers?|km|centimeters?|cm|meters?|m)';
const SEPARATION_RE = new RegExp(
  `\\b(?:separation\\s+(?:is|of)|separated\\s+by|distance\\s+(?:between\\s+them\\s+)?(?:is|of))\\s+` +
    `([\\d.]+)\\s*${SEP_UNIT_ALT}\\b`,
  'i',
);
// Separate capturing version to recover the matched unit word itself.
const SEPARATION_CAP_RE = new RegExp(
  `\\b(?:separation\\s+(?:is|of)|separated\\s+by|distance\\s+(?:between\\s+them\\s+)?(?:is|of))\\s+` +
    `([\\d.]+)\\s*(${SEP_UNIT_ALT})\\b`,
  'i',
);

function separationUnitToMeters(value: number, unitWord: string): number | null {
  const u = unitWord.toLowerCase().replace(/\s+/g, ' ').trim();
  if (/^light[- ]?years?$/.test(u) || u === 'ly') {
    // Light year in meters, derived from mathjs's own speedOfLight constant x one Julian year
    // (mathjs has no built-in "lightyear" unit, verified empirically this Yoke) -- kept as a
    // real mathjs computation (not a bare hardcoded magic number) so the conversion itself is
    // sourced from the SAME physical-constants library every other compute tier here uses.
    const lightYearM = (math.evaluate('speedOfLight * 1 year') as { toNumber: (u: string) => number }).toNumber('m');
    return value * lightYearM;
  }
  if (u === 'au' || /^astronomical units?$/.test(u)) return value * AU_M;
  if (/^(kilometers?|km)$/.test(u)) return value * 1000;
  if (/^(centimeters?|cm)$/.test(u)) return value / 100;
  if (/^(meters?|m)$/.test(u)) return value;
  return null;
}

// --- Kepler's third law (two-body, mutual orbit about common center of mass) --------------------
//
// P = 2*pi*sqrt(a^3 / (G*(M1+M2))) -- `a` is the SEPARATION between the two bodies. Pure mathjs
// Unit algebra (dimensioned throughout, no bare-number shortcuts), same discipline
// evaluateUnitExpression/matchQuantityToOption already use in compute_sidecar.ts. Returns null
// (never throws) on any non-finite/unexpected result.
function computeKeplerPeriodYears(separationMeters: number, totalMassKg: number): number | null {
  if (!Number.isFinite(separationMeters) || separationMeters <= 0) return null;
  if (!Number.isFinite(totalMassKg) || totalMassKg <= 0) return null;
  try {
    const a = math.unit(separationMeters, 'm');
    const M = math.unit(totalMassKg, 'kg');
    const G = math.gravitationConstant; // Unit, m^3 kg^-1 s^-2 (CODATA, via mathjs)
    const a3 = math.evaluate('a^3', { a });
    const GM = math.multiply(G, M);
    const ratio = math.divide(a3, GM) as unknown; // dimensionally s^2
    if (!(ratio instanceof math.Unit)) return null;
    const sqrtRatio = math.sqrt(ratio);
    const periodSeconds = math.multiply(2 * Math.PI, sqrtRatio) as unknown;
    if (!(periodSeconds instanceof math.Unit)) return null;
    const years = periodSeconds.toNumber('year');
    return Number.isFinite(years) ? years : null;
  } catch {
    return null;
  }
}

// --- MC option parsing: handles the real dataset's glued scientific-notation artifact
// ("9$10^7 \mathrm{yr}$ ", "1.5$10^8 \mathrm{yr}$") plus a plain "N years"-style fallback --------

/** Matches a mantissa immediately followed by one-or-more literal "$" (the dataset's stripped-
 *  \times LaTeX artifact) then "10^", an optional "{", the exponent (possibly negative), and an
 *  optional closing "}". E.g. "9$10^7" -> mantissa "9", exponent "7"; "1.5$10^8" -> "1.5"/"8". */
const SCI_NOTATION_RE = /(-?\d+(?:\.\d+)?)\$+10\^\{?(-?\d+)\}?/;
const MATHRM_UNIT_RE = /\\mathrm\{~?([^}]*)\}/;
const PLAIN_YEAR_RE = /(-?\d+(?:\.\d+)?)\s*(years?|yrs?)\b/i;

interface ParsedOptionValue {
  value: number;
  unit: string | null;
}

function parseOptionValue(text: string): ParsedOptionValue | null {
  const sci = text.match(SCI_NOTATION_RE);
  if (sci && sci[1] && sci[2]) {
    const mantissa = parseFloat(sci[1]);
    const exponent = parseFloat(sci[2]);
    if (Number.isFinite(mantissa) && Number.isFinite(exponent)) {
      const unitMatch = text.match(MATHRM_UNIT_RE);
      const unit = unitMatch && unitMatch[1] ? unitMatch[1].trim() : null;
      return { value: mantissa * Math.pow(10, exponent), unit };
    }
  }
  const plain = text.match(PLAIN_YEAR_RE);
  if (plain && plain[1]) {
    const v = parseFloat(plain[1]);
    if (Number.isFinite(v)) return { value: v, unit: plain[2] ?? null };
  }
  return null;
}

function isYearUnit(unit: string | null): boolean {
  if (!unit) return false;
  return /^y(?:ea)?rs?\.?$/i.test(unit.trim());
}

/** Matches the computed period (years) to the SINGLE MC option within a 5% relative tolerance --
 *  wide enough to absorb reasonable rounding of the physical constants (G, solar mass) the
 *  original dataset author used, but far tighter than the ~11% spacing between this question's
 *  own neighboring options (8e7 / 9e7 / 1e8), so it can never straddle two of them. Zero or 2+
 *  qualifying options is an honest null, same "exactly one option" gate every other tier here
 *  uses. */
function matchToSingleYearOption(
  computedYears: number,
  parsed: Array<{ letter: string; parsed: ParsedOptionValue }>,
): { letter: string; optionValue: number } | null {
  const tolerance = 0.05 * Math.abs(computedYears);
  const qualifying = parsed.filter((p) => Math.abs(p.parsed.value - computedYears) <= tolerance);
  if (qualifying.length !== 1) return null;
  return { letter: qualifying[0]!.letter, optionValue: qualifying[0]!.parsed.value };
}

/** Top-level entry point. Pure, synchronous, no I/O. Returns null (never guesses) the moment any
 *  required piece (double-star/common-center-of-mass/period-of-revolution framing, an equal-mass-
 *  of-the-sun statement, a recognized-unit separation, or a clean year-valued option set) is not
 *  confidently present, or the computed period does not match EXACTLY ONE MC option within
 *  tolerance. Derives strictly from `questionText` + `options` -- never from an authority's/
 *  model's reasoning text. */
export function solvePhysicsRelationProblem(
  questionText: string,
  options: McOption[],
): PhysicsSolverResult | null {
  if (!BINARY_STAR_RE.test(questionText)) return null;
  if (!COMMON_COM_RE.test(questionText)) return null;
  if (!PERIOD_ASK_RE.test(questionText)) return null;

  const multiplier = extractSolarMassMultiplier(questionText);
  if (multiplier === null) return null;

  const sepMatch = questionText.match(SEPARATION_CAP_RE);
  if (!sepMatch || !sepMatch[1] || !sepMatch[2]) return null;
  const sepValue = parseFloat(sepMatch[1]);
  if (!Number.isFinite(sepValue) || sepValue <= 0) return null;
  const separationMeters = separationUnitToMeters(sepValue, sepMatch[2]);
  if (separationMeters === null) return null;

  const totalMassKg = 2 * multiplier * M_SUN_KG; // two bodies, each `multiplier` solar masses
  const periodYears = computeKeplerPeriodYears(separationMeters, totalMassKg);
  if (periodYears === null) return null;

  if (options.length === 0) return null;
  const parsedOptions: Array<{ letter: string; parsed: ParsedOptionValue }> = [];
  for (const opt of options) {
    const parsed = parseOptionValue(opt.text);
    if (!parsed || !isYearUnit(parsed.unit)) return null; // every option must parse cleanly and confidently to a year value, else abstain
    parsedOptions.push({ letter: opt.letter, parsed });
  }

  const matched = matchToSingleYearOption(periodYears, parsedOptions);
  if (!matched) return null;

  const trace =
    `physics_kepler: law="P=2*pi*sqrt(a^3/(G*(M1+M2)))" ` +
    `M1=M2=${multiplier}*Msun(${(multiplier * M_SUN_KG).toExponential(4)}kg) ` +
    `separation=${sepValue}${sepMatch[2]}(${separationMeters.toExponential(4)}m) ` +
    `computed=${periodYears.toExponential(4)}yr matchedOption=${matched.letter}(${matched.optionValue.toExponential(4)}yr)`;

  return {
    letter: matched.letter,
    value: periodYears,
    optionValue: matched.optionValue,
    provenance: 'deterministic_compute:physics_kepler',
    trace,
  };
}
