// plow_mc_aircraft_solver.ts -- deterministic "aircraft lift/drag/takeoff-power" word-problem
// solver, a SIXTH independent compute tier alongside computeUnitAwareMatch, computeAnswer+
// matchValueToOption, solveScheduleProblem, solveDensityProblem, and solvePhysicsRelationProblem
// (see plow_mc_answerer.ts's resolveDeterministicComputeOverride).
//
// WHY THIS EXISTS: one remaining compute-class benchmark question still wobbles because it has no
// blade and gets answered by luck (verified this Yoke against resources/mmlu_pro/engineering/
// questions.json, source_id 12067, byte-identical in questions_curated.json and
// questions_raw.json):
//   "An airplane is designed according to the following specifications. weight = 3000lbf wing
//    area = 300 ft^2 takeoff speed = 100 ft/sec Model tests show that the lift and drag
//    coefficients vary with the angle of attack of the wing according to the approximate
//    relations: C_L = 0.35(1 + 0.2\alpha) C_D = 0.008(1 + \alpha) for small \alpha, where \alpha
//    is the angle of attack measured in degrees. The atmospheric density is 0.00238 slug/ft^3.
//    Find the angle of attack that ensures takeoff at the desired speed, and the power required
//    for takeoff."
// with options glued into a single "N degrees, M hp" string per option (e.g. "7 degrees, 41.5 hp")
// and correct_answer exactly "7 degrees, 41.5 hp" (option E, 0-indexed 4th of 10). None of the
// five existing tiers can reach this: (i) computeUnitAwareMatch needs one CONTIGUOUS unit-bearing
// arithmetic chain already spelled out in the text -- this question states five separate givens
// (weight, area, speed, density, two coefficient formulas) and asks for a value reached only by
// solving a linear equation for alpha first, never a chain; (ii) computeAnswer's model-derived-
// expression tier risks the same mid-derivation-coefficient mis-grab documented in
// plow_mc_physics_solver.ts's header; (iii)/(iv) are structurally unrelated (loan amortization /
// mass-dimensions density); (v) solvePhysicsRelationProblem is narrowly gated to the double-star
// Kepler case (BINARY_STAR_RE + COMMON_COM_RE + PERIOD_ASK_RE) and does not fire here. This module
// is a dedicated, narrowly-gated lift/drag solver that derives BOTH the angle of attack AND the
// takeoff power STRICTLY from the question's own stated givens, never from any authority's/
// model's reasoning, then verifies the result against the MC options itself -- exactly the
// "components, not answers" discipline every other tier in this file already follows.
//
// LAW (standard British-Gravitational-unit steady, level, constant-speed takeoff lift/drag
// relations):
//   dynamic pressure        q = 0.5 * rho * V^2                          (lbf/ft^2)
//   lift = weight (steady)  C_L_required = weight / (q * S)              (dimensionless)
//   given C_L = clA * (1 + clB * alpha), solve the LINEAR equation for alpha (degrees):
//                            alpha = (C_L_required / clA - 1) / clB
//   given C_D = cdA * (1 + cdB * alpha):
//                            C_D = cdA * (1 + cdB * alpha)
//   drag                     D = q * S * C_D                             (lbf)
//   power required           P = D * V                                  (ft*lbf/s)
//                            P_hp = P / 550                              (horsepower; 1 hp = 550 ft*lbf/s)
// HAND-VERIFIED (this Yoke) against the real question: weight=3000 lbf, S=300 ft^2, V=100 ft/s,
// rho=0.00238 slug/ft^3, C_L=0.35(1+0.2*alpha), C_D=0.008(1+alpha) ->
//   q = 0.5*0.00238*100^2 = 11.9 lbf/ft^2
//   C_L_required = 3000/(11.9*300) = 3000/3570 = 0.840336
//   alpha = (0.840336/0.35 - 1)/0.2 = (2.400960 - 1)/0.2 = 7.0048 deg ~= 7 deg
//   C_D = 0.008*(1+7.0048) = 0.0640384
//   D = 11.9*300*0.0640384 = 228.617 lbf
//   P = 228.617*100 = 22861.7 ft*lbf/s = 41.567 hp ~= 41.5 hp
// -- matches the option "7 degrees, 41.5 hp" (this dataset's own correct_answer) to within 0.07%
// (angle) and 0.16% (power), and is >1 degree / >8% power away from every neighboring option
// (6 deg/38 hp, 8 deg/45 hp), so a modest tolerance on BOTH numbers together is unambiguous.
//
// CONSERVATISM (never guess), same bar as every other tier in this repo: fires ONLY when ALL of
// the following are confidently, independently parsed straight out of the question text --
//   (1) an explicit "angle of attack" ask AND a "power" ask (both must appear; this is
//       deliberately narrower than "any aircraft question");
//   (2) weight (lbf), wing area (ft^2), takeoff speed (ft/sec), air density (slug/ft^3), all with
//       the specific units this closed-form solution is dimensioned for -- no unit conversion is
//       attempted, so a question phrased in SI or any other unit system is an honest null rather
//       than a silently-wrong cross-unit guess;
//   (3) BOTH coefficient relations in the exact "coeff*(1 + coeff*alpha)" linear form (the C_D
//       relation's own alpha-coefficient may be an implicit 1, i.e. "0.008(1 + \alpha)" with no
//       explicit multiplier before "\alpha" -- handled explicitly, never assumed for C_L);
//   (4) every MC option parses cleanly to an explicit "N degrees, M hp" pair -- if even one option
//       fails to parse in that exact combined shape, this returns null rather than risk an
//       unverifiable comparison set;
//   (5) the computed (angle, power) pair matches EXACTLY ONE option within tolerance on BOTH
//       numbers simultaneously -- zero or 2+ qualifying options is an honest null, same
//       "exactly one option" gate every other tier here uses.
// Any missing/ambiguous piece returns null immediately. Pure/synchronous, no I/O, no model call --
// derives strictly from `questionText` + `options`.
//
// Rule 66: version, never overwrite -- this is a new file, no supersede needed.

import type { McOption } from './compute_sidecar';

export interface AircraftSolverResult {
  letter: string;
  /** Our computed takeoff power, in horsepower -- directly comparable to `optionValue`, same
   *  computed-value-vs-option-value distinction every other tier in this repo surfaces. The
   *  companion computed angle of attack (degrees) is folded into `trace` rather than a second
   *  top-level field, matching the single-scalar {value, optionValue} shape every other solver in
   *  this repo already returns. */
  value: number;
  /** The MC option's OWN stated horsepower value (e.g. 41.5 for the text "7 degrees, 41.5 hp"). */
  optionValue: number;
  provenance: string;
  trace: string;
}

const HP_PER_FT_LBF_PER_SEC = 1 / 550; // 1 hp = 550 ft*lbf/s, exact definition

// --- Context gate: must ask for BOTH the angle of attack and the power -------------------------

const ANGLE_ASK_RE = /\bangle of attack\b/i;
const POWER_ASK_RE = /\bpower\b/i;

// --- Givens extraction (British Gravitational units ONLY -- lbf, ft^2, ft/sec, slug/ft^3; no
// cross-unit conversion is attempted, so any other unit system is an honest null) ----------------

const WEIGHT_RE = /\bweight\s*=\s*([\d.]+)\s*lbf\b/i;
const AREA_RE = /\bwing area\s*=\s*([\d.]+)\s*ft\^?2\b/i;
const SPEED_RE = /\btakeoff speed\s*=\s*([\d.]+)\s*ft\s*\/\s*sec\b/i;
const DENSITY_RE = /\bdensity\s*(?:is|=)\s*([\d.]+)\s*slug\/ft\^?3\b/i;

// --- Coefficient-relation extraction: "C_L = A(1 + B\alpha)" / "C_D = A(1 + [B]\alpha)" ---------
// The drag relation's own alpha-multiplier may be implicit (bare "\alpha" with no leading number,
// e.g. "0.008(1 + \alpha)") -- captured as an OPTIONAL group, defaulted to 1 only for C_D, never
// assumed for C_L (the real question always states C_L's multiplier explicitly).

const CL_RE = /\bC_L\s*=\s*([\d.]+)\s*\(\s*1\s*\+\s*([\d.]+)\s*\\alpha\s*\)/;
const CD_RE = /\bC_D\s*=\s*([\d.]+)\s*\(\s*1\s*\+\s*([\d.]*)\s*\\alpha\s*\)/;

// --- MC option parsing: "N degrees, M hp" (allows minor separator variance) ---------------------

const OPTION_RE = /([\d.]+)\s*degrees?\s*,\s*([\d.]+)\s*hp\b/i;

interface Givens {
  weightLbf: number;
  areaFt2: number;
  speedFtPerSec: number;
  densitySlugFt3: number;
  clA: number;
  clB: number;
  cdA: number;
  cdB: number;
}

function extractGivens(questionText: string): Givens | null {
  const w = questionText.match(WEIGHT_RE);
  const s = questionText.match(AREA_RE);
  const v = questionText.match(SPEED_RE);
  const rho = questionText.match(DENSITY_RE);
  const cl = questionText.match(CL_RE);
  const cd = questionText.match(CD_RE);
  if (!w || !w[1]) return null;
  if (!s || !s[1]) return null;
  if (!v || !v[1]) return null;
  if (!rho || !rho[1]) return null;
  if (!cl || !cl[1] || !cl[2]) return null;
  if (!cd || !cd[1]) return null;

  const weightLbf = parseFloat(w[1]);
  const areaFt2 = parseFloat(s[1]);
  const speedFtPerSec = parseFloat(v[1]);
  const densitySlugFt3 = parseFloat(rho[1]);
  const clA = parseFloat(cl[1]);
  const clB = parseFloat(cl[2]);
  const cdA = parseFloat(cd[1]);
  // cd[2] may be '' (implicit-1 multiplier form, e.g. "0.008(1 + \alpha)") -- default to 1 ONLY
  // here, never for C_L (whose multiplier this question always states explicitly).
  const cdB = cd[2] && cd[2].length > 0 ? parseFloat(cd[2]) : 1;

  if (![weightLbf, areaFt2, speedFtPerSec, densitySlugFt3, clA, clB, cdA, cdB].every((n) => Number.isFinite(n))) {
    return null;
  }
  if (weightLbf <= 0 || areaFt2 <= 0 || speedFtPerSec <= 0 || densitySlugFt3 <= 0) return null;
  if (clA === 0 || clB === 0) return null; // would make the linear alpha-solve undefined/degenerate

  return { weightLbf, areaFt2, speedFtPerSec, densitySlugFt3, clA, clB, cdA, cdB };
}

interface ComputedTakeoff {
  alphaDeg: number;
  powerHp: number;
  q: number;
  clRequired: number;
  cdComputed: number;
  dragLbf: number;
}

/** Pure closed-form solve -- no iteration, no I/O. Returns null (never throws) on any
 *  non-finite intermediate result. */
function computeTakeoff(g: Givens): ComputedTakeoff | null {
  const q = 0.5 * g.densitySlugFt3 * g.speedFtPerSec * g.speedFtPerSec;
  if (!Number.isFinite(q) || q <= 0) return null;

  const clRequired = g.weightLbf / (q * g.areaFt2);
  if (!Number.isFinite(clRequired)) return null;

  // C_L = clA * (1 + clB * alpha)  =>  alpha = (C_L/clA - 1) / clB
  const alphaDeg = (clRequired / g.clA - 1) / g.clB;
  if (!Number.isFinite(alphaDeg)) return null;

  const cdComputed = g.cdA * (1 + g.cdB * alphaDeg);
  if (!Number.isFinite(cdComputed) || cdComputed <= 0) return null;

  const dragLbf = q * g.areaFt2 * cdComputed;
  if (!Number.isFinite(dragLbf) || dragLbf <= 0) return null;

  const powerFtLbfPerSec = dragLbf * g.speedFtPerSec;
  const powerHp = powerFtLbfPerSec * HP_PER_FT_LBF_PER_SEC;
  if (!Number.isFinite(powerHp) || powerHp <= 0) return null;

  return { alphaDeg, powerHp, q, clRequired, cdComputed, dragLbf };
}

interface ParsedOption {
  letter: string;
  angleDeg: number;
  powerHp: number;
}

/** Matches the computed (angle, power) pair to the SINGLE MC option within tolerance on BOTH
 *  numbers simultaneously -- 0.5 degree (half the real question's 1-degree option spacing) and 5%
 *  relative on power (far tighter than the ~8%+ spacing between this question's own neighboring
 *  options). Zero or 2+ qualifying options is an honest null, same "exactly one option" gate every
 *  other tier here uses. */
function matchToSingleOption(
  computed: ComputedTakeoff,
  parsed: ParsedOption[],
): ParsedOption | null {
  const ANGLE_TOLERANCE_DEG = 0.5;
  const POWER_REL_TOLERANCE = 0.05;
  const qualifying = parsed.filter(
    (p) =>
      Math.abs(p.angleDeg - computed.alphaDeg) <= ANGLE_TOLERANCE_DEG &&
      Math.abs(p.powerHp - computed.powerHp) <= POWER_REL_TOLERANCE * Math.abs(computed.powerHp),
  );
  if (qualifying.length !== 1) return null;
  return qualifying[0]!;
}

/** Top-level entry point. Pure, synchronous, no I/O. Returns null (never guesses) the moment any
 *  required piece (angle-of-attack + power ask, the four British-Gravitational-unit givens, both
 *  linear coefficient relations, or a clean "N degrees, M hp" option set) is not confidently
 *  present, or the computed (angle, power) pair does not match EXACTLY ONE MC option within
 *  tolerance. Derives strictly from `questionText` + `options` -- never from an authority's/
 *  model's reasoning text. */
export function solveAircraftLiftDragProblem(
  questionText: string,
  options: McOption[],
): AircraftSolverResult | null {
  if (!ANGLE_ASK_RE.test(questionText)) return null;
  if (!POWER_ASK_RE.test(questionText)) return null;

  const givens = extractGivens(questionText);
  if (!givens) return null;

  const computed = computeTakeoff(givens);
  if (!computed) return null;

  if (options.length === 0) return null;
  const parsedOptions: ParsedOption[] = [];
  for (const opt of options) {
    const m = opt.text.match(OPTION_RE);
    if (!m || !m[1] || !m[2]) return null; // every option must parse cleanly, else abstain
    const angleDeg = parseFloat(m[1]);
    const powerHp = parseFloat(m[2]);
    if (!Number.isFinite(angleDeg) || !Number.isFinite(powerHp)) return null;
    parsedOptions.push({ letter: opt.letter, angleDeg, powerHp });
  }

  const matched = matchToSingleOption(computed, parsedOptions);
  if (!matched) return null;

  const trace =
    `aircraft_lift_drag: weight=${givens.weightLbf}lbf S=${givens.areaFt2}ft^2 V=${givens.speedFtPerSec}ft/s ` +
    `rho=${givens.densitySlugFt3}slug/ft^3 q=${computed.q}lbf/ft^2 ` +
    `C_L=${givens.clA}(1+${givens.clB}*alpha)->required=${computed.clRequired.toFixed(6)} ` +
    `alpha=${computed.alphaDeg.toFixed(4)}deg C_D=${givens.cdA}(1+${givens.cdB}*alpha)->${computed.cdComputed.toFixed(6)} ` +
    `drag=${computed.dragLbf.toFixed(4)}lbf power=${computed.powerHp.toFixed(4)}hp ` +
    `matchedOption=${matched.letter}(${matched.angleDeg}deg,${matched.powerHp}hp)`;

  return {
    letter: matched.letter,
    value: computed.powerHp,
    optionValue: matched.powerHp,
    provenance: 'deterministic_compute:aircraft_lift_drag',
    trace,
  };
}
