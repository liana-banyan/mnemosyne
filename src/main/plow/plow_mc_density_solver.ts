// plow_mc_density_solver.ts -- deterministic mass/dimensions "density" word-problem solver, a
// FOURTH independent compute tier alongside computeUnitAwareMatch, computeAnswer+matchValueToOption,
// and solveScheduleProblem (see plow_mc_answerer.ts's resolveDeterministicComputeOverride).
//
// WHY THIS EXISTS: computeUnitAwareMatch's extractUnitExpression (compute_sidecar.ts) only finds a
// unit-bearing arithmetic CHAIN that is already contiguous in the question text -- consecutive
// number-unit tokens joined directly by +-*/ with nothing else between them. The canonical density
// case ("Calculate the density of a block of wood which weighs 750 kg and has the dimensions
// 25 cm x 0.10 m x 50.0 m") states the MASS and the DIMENSION PRODUCT as two separate clauses
// ("weighs 750 kg" ... "and has the dimensions 25 cm x 0.10 m x 50.0 m"), so the chain regex only
// ever picks up the dimension product ("25 cm * 0.10 m * 50.0 m" -> 1.25 m^3) and never combines
// it with the mass -- confirmed empirically this Yoke (computeUnitAwareMatch returns null on the
// real glued question text). This module independently parses BOTH clauses (mass value+unit, and
// a 2+-length dimension chain) and synthesizes the combined mass/volume expression itself, then
// reuses compute_sidecar.ts's own evaluateUnitExpression (mathjs unit algebra) + matchQuantityToOption
// (the SAME "exactly one option qualifies" honesty gate every other compute tier in this repo uses)
// to do the actual arithmetic and option-matching -- no new unit-conversion table, no duplicated
// evaluator.
//
// REAL DATASET ARTIFACTS handled (verified against resources/mmlu_pro/chemistry/questions_raw.json
// source_id 4212, this Yoke):
//   - "kgand" glue: the real question text is "...weighs 750 kgand has the dimensions..." (a
//     dataset-authoring artifact, zero whitespace between the mass unit and the next word) --
//     deglueMassUnit() below inserts back the ONE missing space, ONLY directly after a recognized
//     mass-unit word and ONLY when immediately followed by one of a short list of common connector
//     words ("and", "has", "with", "is"), mirroring plow_mc_schedule_solver.ts's own targeted
//     "repair one missing space, never invent a number" deglue discipline.
//   - leading-dot options (".60 g/cc" instead of "0.60 g/cc"): NOT this file's concern -- already
//     fixed at HEAD in compute_sidecar.ts's extractNumber/QUANTITY_TOKEN_RE (both used internally by
//     matchQuantityToOption, which this file calls unmodified), so this file needs no leading-dot
//     handling of its own.
//
// CONSERVATISM (never guess), same bar as plow_mc_schedule_solver.ts: fires ONLY when ALL THREE are
// confidently present -- (1) a "density" ask, (2) a mass value+unit, (3) a 2+-length dimension
// product joined by x/*/times/by. Any missing piece returns null immediately. The final
// option-match step is matchQuantityToOption's existing exact-one-option gate (relTolerance=0.01,
// i.e. ~1% of the option's own value) -- zero or 2+ qualifying options is an honest null, never a
// forced guess. Pure/synchronous, no I/O, no model/authority input -- derives strictly from the
// question text + the MC options.
//
// Rule 66: version, never overwrite -- this is a new file, no supersede needed.

import type { McOption } from './compute_sidecar';
import { evaluateUnitExpression, matchQuantityToOption } from './compute_sidecar';

export interface DensitySolverResult {
  letter: string;
  /** Our computed density, expressed in the SAME unit as the matched option (e.g. 0.6 for a
   *  "0.60 g/cc" option) -- directly comparable to `optionValue`, unlike the raw mathjs internal
   *  probe value. */
  value: number;
  /** The MC option's OWN stated numeric value (e.g. 0.60 for the text ".60 g/cc") -- same
   *  computed-value-vs-option-value distinction the schedule solver and unit-aware tier surface. */
  optionValue: number;
  provenance: string;
  trace: string;
}

// --- Density-ask gate ---------------------------------------------------------------------------

const DENSITY_ASK_RE = /\bdensit(?:y|ies)\b/i;

// --- Mass extraction (value + unit, tolerant of glued "kgand") ----------------------------------

const MASS_UNIT_ALT = '(?:kilograms?|kgs?|grams?|g|milligrams?|mgs?|pounds?|lbs?)';

/** Repairs the real-dataset "kgand"-style glue: a mass unit word directly touching a following
 *  connector word with zero whitespace. Only ever INSERTS the one missing space in front of a
 *  short, fixed list of connector words -- it can never invent or alter a number, and a question
 *  with no such glue is byte-for-byte unaffected (the replace is a no-op). */
function deglueMassUnit(text: string): string {
  return text.replace(
    new RegExp(`\\b(${MASS_UNIT_ALT.slice(3, -1)})(and|has|with|is)\\b`, 'gi'),
    '$1 $2',
  );
}

const MASS_CUE = '(?:weighs?|weighing|weight\\s+of|mass\\s+of)';
const MASS_RE = new RegExp(
  `\\b${MASS_CUE}\\s+\\$?([\\d,]+(?:\\.\\d+)?)\\s*${MASS_UNIT_ALT}\\b`,
  'i',
);
// Separate capturing version to recover the matched unit word itself (MASS_RE above only needs to
// confirm presence for the combined regex; this one captures group 2 for normalization).
const MASS_CAP_RE = new RegExp(
  `\\b${MASS_CUE}\\s+\\$?([\\d,]+(?:\\.\\d+)?)\\s*(${MASS_UNIT_ALT})\\b`,
  'i',
);

function normalizeMassUnit(word: string): string {
  const w = word.toLowerCase();
  if (w.startsWith('kilogram') || w.startsWith('kg')) return 'kg';
  if (w.startsWith('milligram') || w.startsWith('mg')) return 'mg';
  if (w.startsWith('gram') || w === 'g') return 'g';
  if (w.startsWith('pound') || w.startsWith('lb')) return 'lb';
  return w;
}

// --- Dimension-product extraction (2+ lengths joined by x / * / times / by) ---------------------

const LENGTH_UNIT_ALT =
  '(?:centimeters?|millimeters?|cm|mm|meters?|m|inch(?:es)?|in|feet|foot|ft)';
const LEN_TOKEN_NC = `\\d+(?:\\.\\d+)?\\s*${LENGTH_UNIT_ALT}\\b`;
const JOIN = '\\s*(?:x|\u00d7|\\*|times|by)\\s*';
const CHAIN_SRC = `${LEN_TOKEN_NC}(?:${JOIN}${LEN_TOKEN_NC})+`;
const LEN_TOKEN_CAP_RE = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${LENGTH_UNIT_ALT})\\b`, 'gi');

function normalizeLengthUnit(word: string): string {
  const w = word.toLowerCase();
  if (w.startsWith('centimeter') || w === 'cm') return 'cm';
  if (w.startsWith('millimeter') || w === 'mm') return 'mm';
  if (w.startsWith('meter') || w === 'm') return 'm';
  if (w.startsWith('inch') || w === 'in') return 'in';
  if (w.startsWith('foot') || w.startsWith('feet') || w === 'ft') return 'ft';
  return w;
}

/** Longest matching dimension chain in the text (mirrors extractUnitExpression's own
 *  longest-match convention in compute_sidecar.ts) -- picks the fullest "A x B x C"-style run
 *  rather than a partial prefix. */
function findLongestChain(text: string): string | null {
  const re = new RegExp(CHAIN_SRC, 'gi');
  let best: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (!best || m[0].length > best.length) best = m[0];
  }
  return best;
}

function extractLengthTokens(chainText: string): Array<{ value: number; unit: string }> {
  const tokens: Array<{ value: number; unit: string }> = [];
  LEN_TOKEN_CAP_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = LEN_TOKEN_CAP_RE.exec(chainText)) !== null) {
    const value = parseFloat(m[1] as string);
    if (!Number.isFinite(value) || value <= 0) continue;
    tokens.push({ value, unit: normalizeLengthUnit(m[2] as string) });
  }
  return tokens;
}

// --- Top-level entry point -----------------------------------------------------------------------

/** Pure, synchronous, no I/O. Returns null (never guesses) the moment any required piece
 *  (density ask, mass, 2+-length dimension product) is not confidently present, or the computed
 *  density does not match EXACTLY ONE MC option within matchQuantityToOption's tolerance. Derives
 *  strictly from `questionText` + `options` -- never reads a number out of an authority's/model's
 *  reasoning text. */
export function solveDensityProblem(questionText: string, options: McOption[]): DensitySolverResult | null {
  if (!DENSITY_ASK_RE.test(questionText)) return null;

  const deglued = deglueMassUnit(questionText);

  const massMatch = deglued.match(MASS_CAP_RE);
  if (!massMatch || !massMatch[1] || !massMatch[2]) return null;
  if (!MASS_RE.test(deglued)) return null; // redundant confirmatory check, cheap and explicit
  const massValue = parseFloat(massMatch[1].replace(/,/g, ''));
  if (!Number.isFinite(massValue) || massValue <= 0) return null;
  const massUnit = normalizeMassUnit(massMatch[2]);

  const chain = findLongestChain(deglued);
  if (!chain) return null;
  const lengths = extractLengthTokens(chain);
  if (lengths.length < 2) return null;

  const volumeExprPart = lengths.map((l) => `${l.value} ${l.unit}`).join(' * ');
  const expr = `${massValue} ${massUnit} / (${volumeExprPart})`;

  const quantity = evaluateUnitExpression(expr);
  if (!quantity || !quantity.unit) return null;

  // relTolerance=0.01 -- "~1% of the option's own value" per this file's conservatism contract;
  // matchQuantityToOption's own internal floor (1e-9) covers the degenerate near-zero case.
  // Exactly one qualifying option is required (matchQuantityToOption's own honesty gate) -- zero
  // or 2+ qualifiers is an honest null, never a forced guess.
  const matched = matchQuantityToOption(quantity, options, 0.01);
  if (!matched || !matched.optionUnit) return null;

  let computedInOptionUnit: number;
  try {
    computedInOptionUnit = quantity.unit.to(matched.optionUnit).toNumber(matched.optionUnit);
  } catch {
    return null; // dimensionally incompatible after all -- never force a cross-dimension value
  }

  const trace =
    `density: mass=${massValue}${massUnit} volume=(${volumeExprPart}) expr="${expr}" ` +
    `computed=${computedInOptionUnit}${matched.optionUnit} ` +
    `matchedOption=${matched.letter}(${matched.optionValue}${matched.optionUnit})`;

  return {
    letter: matched.letter,
    value: computedInOptionUnit,
    optionValue: matched.optionValue,
    provenance: 'deterministic_compute:density',
    trace,
  };
}
