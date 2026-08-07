// plow_derived_quantity_reconciler.ts -- D-BP148-003 M2: DERIVED-QUANTITY RECONCILIATION.
//
// SEG: D-BP148-003/BISHOP/M2/seg-graceful-degrade
// Run under Bishop's own authority per HARDWIRE-12 graceful degradation: the Knight CLI worker for
// this dispatch cannot start (provider usage limit exhausted until 2026-09-02). NOT the Knight
// actor -- this file is Bishop's own work, signed as such.
//
// TWO PREMISES CORRECTED MID-FLIGHT ON THIS TICKET. BOTH RECORDED HERE FOR THE ANSWER'S OWN SAKE,
// NOT JUST THE REPORT (do not re-litigate either):
//
// (1) FIRST CORRECTION (from Bishop, believed true at ticket start): "compute_sidecar.ts uses
//     mathjs, no Python sidecar exists anywhere in the tree." Verified TRUE for compute_sidecar.ts
//     specifically (it imports only `create, all, type Unit` from 'mathjs', package.json:55 --
//     "mathjs": "^15.2.0" -- and never shells out to Python).
//
// (2) SECOND CORRECTION (from Bishop, mid-flight, sourced to a sibling SEG working M1 of this same
//     dispatch): premise (1)'s SECOND HALF was false as a claim about the whole tree.
//     `plow_gom_jabbar.ts` (KN-BP141-3 Stage 3, this ticket's file-disjoint sibling, NOT edited by
//     this file) contains a genuine `runSympyArithmetic`/`runSympyMultiplication` bridge
//     (child_process.spawn('python', ['-c', ...])) and its own `reconcileDerivedQuantity(factorA,
//     factorB, independentCheckValue, relTolerance)` -- i.e. THIS TICKET'S EXACT MECHANISM,
//     ALREADY IMPLEMENTED, one file over. VERIFIED THIS TICKET, directly on this machine, not taken
//     on anyone's word: `python --version` -> `Python 3.13.14`;
//     `python -c "from sympy import sympify, N; print(N(sympify('(25)*(17840000)')))"` ->
//     `446000000.000000`. Both the runtime and the library are real, installed, and answer.
//
// WHAT THIS MEANS FOR THIS FILE'S DESIGN: plow_gom_jabbar.ts's `reconcileDerivedQuantity` already
// does the VERIFIED MULTIPLICATION + TOLERANCE COMPARISON half of the Founder's rule 8 ("Derived-
// quantity reconciliation", HARDWIRE-13 rule 8 /
// FounderCascadeWorkedByHand.txt Excerpt 6) via real SymPy -- but it takes three ALREADY-PARSED
// NUMBERS (DerivedQuantityFactor.value: number), never raw text. Every other pure module in this
// dispatch (plow_generator_cascade.ts's own G1-G5, plow_mc_elimination_cascade.ts's C1-C5) draws the
// same line: "the caller dispatches the real query and hands this file the raw response TEXT; this
// file only ever parses what it is given." That parsing layer -- turning three SEPARATELY dispatched
// real search responses (density, area, independently-sourced population) into the three clean
// numbers plow_gom_jabbar.ts's G1 already knows how to reconcile -- is the genuinely missing piece,
// and it is what this file builds. It does NOT reimplement the multiplication or the SymPy bridge;
// it IMPORTS and calls plow_gom_jabbar.ts's existing `reconcileDerivedQuantity` (aliased below to
// avoid a same-name collision with this file's own top-level export), per this repo's own "reuse,
// never duplicate" discipline (M1 imports from plow_mc_elimination_cascade rather than
// reimplementing; plow_gom_jabbar.ts's own G1 delegates to its G2 rather than computing the product
// in JS). plow_gom_jabbar.ts is read-only from this file -- not in this ticket's OWNS block.
//
// WHERE THIS FILE ACTUALLY USES mathjs, AND WHY (per this ticket's explicit "state what the tool
// could and could not do" instruction): AREA UNIT CONVERSION ONLY. Real search text states land
// area in whatever unit the source used; mathjs's own unit system (verified empirically this ticket
// via a throwaway node -e probe, not committed, matching compute_sidecar.ts's own stated
// verification discipline) parses "17840000 km2" correctly and converts cleanly via
// `Unit#toNumber('km^2')`, but does NOT parse "mi2" without a caret (`Undefined symbol mi2`) and has
// no built-in "people"/population-count unit at all (`Undefined symbol people`) -- confirmed by
// direct empirical test, not assumed from documentation. Because of that second gap, density here is
// parsed as a bare people-per-km2 RATIO via compute_sidecar.ts's own extractNumber (reused, not
// duplicated), never as a mathjs Unit. mathjs earns its place in this file for area conversion only;
// it is not asked to do anything else, and the actual verified arithmetic (the multiplication and
// the tolerance check against the independent population figure) is SymPy's job via the import
// below, exactly as the work dispatch doc originally specified.
//
// SAME CONTRACT AS THIS DISPATCH'S OTHER PURE MODULES: every function in this file is synchronous
// text-parsing except the top-level orchestrator (async only because it awaits
// plow_gom_jabbar.ts's real subprocess call). Nothing here queries a model or a browser. A missing or
// unparseable input ABSTAINS -- never fabricates a verdict. NEVER WIDEN A GATE TO FORCE A PASS.
//
// Rule 66: version, never overwrite -- new file, no supersede needed. No em-dashes anywhere in this
// file (or its comments) -- "--" used throughout per Rule 66.

import { extractNumber, extractQuantityFromText } from './compute_sidecar';
import {
  reconcileDerivedQuantity as reconcileParsedFactors,
  type DerivedQuantityFactor,
  type GomJabbarG1Result,
} from './plow_gom_jabbar';

// ─── TEXT SEGMENTATION (find the sentence/line that actually names the referent) ────────────────
//
// A real dispatched response (see this file's own report for the far-end proof) may discuss more
// than one referent in one reply -- the Founder's own captured "hard number" searches
// (FounderCascadeWorkedByHand.txt Excerpt 2) return ALL regions in a single response. This function
// locates the segment that actually names the referent this reconciliation is about, so a
// multi-referent response is read correctly rather than grabbing the first number in the blob
// regardless of which referent it belongs to. Independently written for this file's own
// single-referent-per-call shape (not a copy of plow_generator_cascade.ts's private
// splitIntoSegments -- that function is unexported and belongs to a file this ticket does not
// touch).

function splitIntoSegments(text: string): string[] {
  return text
    .split(/\r?\n|(?<=[.;])\s+(?=[A-Z(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Returns the first segment whose text contains `referentLabel` (case-insensitive substring), or
 *  the WHOLE text when the referent appears somewhere but no single split segment happened to
 *  contain it (a segmentation artifact, not a content gap), or null when the referent is not found
 *  anywhere -- an honest "this response was never actually about the thing I asked for," never a
 *  guess at which unlabeled number might belong to it. */
export function findReferentSegment(text: string, referentLabel: string): string | null {
  const needle = referentLabel.trim().toLowerCase();
  if (needle.length === 0) return null;
  const segments = splitIntoSegments(text);
  for (const seg of segments) {
    if (seg.toLowerCase().includes(needle)) return seg;
  }
  return text.toLowerCase().includes(needle) ? text : null;
}

// ─── SCALED-NUMBER EXTRACTION (population figures use "million"/"billion", which neither of
// ─── compute_sidecar.ts's own extractNumber/extractQuantityFromText understands) ──────────────────
//
// Verified this ticket by direct reading of compute_sidecar.ts in full: extractNumber has no concept
// of a trailing scale word at all, and extractQuantityFromText's unit-token path tries to hand
// "million"/"billion" to mathjs as if they were unit symbols, which fails (mathjs has no such unit),
// so a text like "441 million people" silently returns either null or, worse, the BARE "441" with
// the x1,000,000 multiplier dropped entirely -- a 1,000,000x error, not a rounding error. This is a
// genuinely new, narrow piece of parsing this file owns because it is specific to population-count
// text, not general arithmetic or unit conversion (neither compute_sidecar.ts's mathjs path nor
// plow_gom_jabbar.ts's SymPy path is the right place for it -- SymPy is asked to multiply two ALREADY
// -clean numbers, not parse English scale words out of prose).

const SCALE_WORD_MULTIPLIERS: Record<string, number> = {
  thousand: 1e3,
  million: 1e6,
  billion: 1e9,
  trillion: 1e12,
};

// (?<!\d) BUG FIX, found by this file's own far-end test against real range-shaped text ("105-110
// million people"): without this lookbehind, the bare `-?` leading-minus-sign allowance reads a
// RANGE's separating hyphen ("105-110") as if it were a negative sign glued to the second number,
// silently turning +110 into -110 -- a sign-flip bug, not a rounding error. The lookbehind requires
// a real minus sign to NOT be immediately preceded by a digit, so a genuine negative figure
// ("-5 million people displaced", preceded by whitespace/start-of-string) still parses correctly,
// while a range hyphen sitting directly against the previous number's last digit no longer does.
const SCALED_NUMBER_RE =
  /(?<!\d)(-?\$?(?:\d[\d,]*(?:\.\d+)?|\.\d+))\s*(thousand|million|billion|trillion)?/gi;

/** Extracts the LAST qualifying (number, optional scale word) pair in `text` -- same "final stated
 *  result" convention compute_sidecar.ts's extractQuantityFromText/extractBareValueFromText already
 *  use (a worked answer states intermediate figures first and its real conclusion last). Returns
 *  null when no numeric token is present at all. Every base numeric parse is delegated to
 *  compute_sidecar.ts's own extractNumber (reused, not duplicated) -- this function only adds the
 *  scale-word multiplier on top of that existing, already-tested parse. */
export function extractScaledNumber(text: string): number | null {
  const re = new RegExp(SCALED_NUMBER_RE.source, SCALED_NUMBER_RE.flags);
  let best: number | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const base = extractNumber(m[1] as string);
    if (base === null) continue;
    const scaleWord = m[2]?.toLowerCase();
    const multiplier = scaleWord ? (SCALE_WORD_MULTIPLIERS[scaleWord] ?? 1) : 1;
    best = base * multiplier;
  }
  return best;
}

// ─── AREA EXTRACTION (the one genuine mathjs use in this file: unit-aware, converts to km^2) ──────

/** Common plain-English spellings of "square kilometers" that mathjs's own unit parser does NOT
 *  recognize as a single token (mathjs wants "km2"/"km^2", not a two/three-word English phrase) --
 *  normalized to "km2" BEFORE the text reaches compute_sidecar.ts's extractQuantityFromText, so
 *  mathjs's own verified km2 parsing (this file's header, and compute_sidecar.ts's own m3/cm3
 *  finding) still does the actual unit recognition. This is a text-normalization step for spellings
 *  mathjs cannot tokenize, not a unit-algebra reimplementation -- the conversion arithmetic itself
 *  is entirely mathjs's, via the reused extractQuantityFromText/Unit#toNumber path. */
function normalizeAreaUnitSpelling(text: string): string {
  return text.replace(/\bsq(?:uare)?\s*km(?:s)?\b|\bsq(?:uare)?\s*kilomet(?:er|re)s?\b/gi, 'km2');
}

/** Extracts a land-area figure from `segment`, converted to km^2 via mathjs (the reused
 *  extractQuantityFromText / mathjs Unit#toNumber path -- see this file's header for the empirical
 *  verification of what that path can and cannot parse). Returns null (honest abstain, never a
 *  guessed unit) in two distinct cases this function keeps separate on purpose:
 *   - mathjs found and converted a real unit-bearing quantity, but the conversion is dimensionally
 *     impossible (e.g. the text was actually a density or a mass) -- Unit#toNumber('km^2') throws in
 *     this case, caught here, never forced.
 *   - mathjs found NO unit token it recognizes as an area AT ALL, and the segment still carries
 *     unresolved unit-looking letters directly after a digit (e.g. "6.9 million sq mi" after
 *     normalization still has "mi" attached, or "million" itself) -- this is the case a naive
 *     "just take the bare number" fallback would silently mis-treat as km^2. Only when the segment
 *     is a genuinely bare figure with NO unit letters touching any digit at all (e.g. a caller-side
 *     convention response of plain "17,840,000", already agreed to mean km^2 by how the query itself
 *     was phrased) does this function fall back to extractNumber. */
export function extractAreaValueKm2(segment: string): number | null {
  const normalized = normalizeAreaUnitSpelling(segment);
  const q = extractQuantityFromText(normalized);
  if (q && q.unit) {
    try {
      return q.unit.toNumber('km^2');
    } catch {
      return null; // dimensionally incompatible -- never force, honest abstain
    }
  }
  const hasUnresolvedUnitLetters = /\d\s*[A-Za-z]/.test(normalized);
  if (hasUnresolvedUnitLetters) return null; // an unrecognized unit must never be silently treated as km^2
  return extractNumber(normalized);
}

// BUG FOUND BY THIS FILE'S OWN FAR-END TEST (real data, not synthetic): a plain extractNumber(segment)
// silently grabs the FIRST number in the segment, which is WRONG when the segment states a
// population figure ALONGSIDE the density in the same sentence -- exactly the real shape
// FounderCascadeWorkedByHand.txt's own captured answers repeatedly use ("A) South America: ~441
// million people; Density: 25/km2"): extractNumber(segment) returns 441, not 25, a wrong-referent
// error, not a rounding error. DENSITY_FRAMED_RE anchors on the "per km2"/"/km2" marker that is
// consistently present in every real density figure this file has seen, and is tried FIRST; only a
// segment with no such marker at all (a genuinely density-only, single-number response) falls back
// to the previous plain extractNumber behavior.
const DENSITY_FRAMED_RE =
  /(-?\$?\d[\d,]*(?:\.\d+)?|\.\d+)\s*(?:people\s*)?(?:per\s*km\^?2|per\s*square\s*kilomet(?:er|re)s?|\/\s*km\^?2)/i;

/** Extracts a bare population-density figure (people per km^2) from `segment`. Density is
 *  deliberately NOT run through mathjs's unit path -- "people" is not a mathjs unit (verified this
 *  ticket, "Undefined symbol people") -- so the underlying numeric parse is compute_sidecar.ts's own
 *  extractNumber (reused, not duplicated), reading the density as a plain people-per-km2 ratio,
 *  exactly as FounderCascadeWorkedByHand.txt's own captured search results state it ("~25 people per
 *  km2"). See DENSITY_FRAMED_RE's own comment for why a framed match is tried first. */
export function extractDensityValue(segment: string): number | null {
  const framed = DENSITY_FRAMED_RE.exec(segment);
  if (framed) {
    const n = extractNumber(framed[1] as string);
    if (n !== null) return n;
  }
  return extractNumber(segment);
}

// ─── TOP-LEVEL ORCHESTRATOR ─────────────────────────────────────────────────────────────────────

export interface DerivedQuantityReconciliationInput {
  /** The referent this reconciliation is about, e.g. "South America" -- used to locate the right
   *  segment in each response when a response discusses more than one referent (see
   *  findReferentSegment above). */
  referentLabel: string;
  /** The CALLER's real, separately dispatched response to a density query for `referentLabel`
   *  (e.g. "what is the population density of South America?"). Never fabricated by this file. */
  densityResponseText: string | null | undefined;
  /** The CALLER's real, separately dispatched response to an area query for `referentLabel` (e.g.
   *  "what is the land area of South America, in square kilometers?"). Never fabricated. */
  areaResponseText: string | null | undefined;
  /** The CALLER's real, separately dispatched response to an INDEPENDENT population query for
   *  `referentLabel` -- independently sourced from the density/area queries above, per the
   *  Founder's own "a third number it never saw" framing. Never fabricated. */
  populationResponseText: string | null | undefined;
  /** Relative tolerance passed straight through to plow_gom_jabbar.ts's reconcileDerivedQuantity
   *  (default there: 0.05 = 5%). NOT overridden by this file's own default -- see this file's report
   *  for why 5% is too tight for real geography source data (the Founder's own captured density
   *  figures for the SAME region spread by roughly 20-30% across different searches in
   *  FounderCascadeWorkedByHand.txt Excerpt 2) and the tolerance this file's own demo actually uses
   *  to stay honest about that spread without loosening the gate that catches genuine fabrication. */
  relTolerance?: number;
}

export interface DerivedQuantityReconciliationResult {
  verdict: 'CORROBORATED' | 'FABRICATED' | 'ABSTAIN';
  densityValue: number | null;
  areaValueKm2: number | null;
  statedPopulation: number | null;
  sympyResult: GomJabbarG1Result | null;
  trace: string;
}

function abstain(reason: string): DerivedQuantityReconciliationResult {
  return {
    verdict: 'ABSTAIN',
    densityValue: null,
    areaValueKm2: null,
    statedPopulation: null,
    sympyResult: null,
    trace: `ABSTAIN: ${reason} -- honest abstain, never a guess.`,
  };
}

/** Parses three real, separately dispatched response texts (density, area, independently-sourced
 *  population) for `input.referentLabel`, then hands the three resulting clean numbers to
 *  plow_gom_jabbar.ts's existing, real-SymPy-backed `reconcileDerivedQuantity` (imported above,
 *  never reimplemented here) for the actual verified multiplication and tolerance check. Returns
 *  ABSTAIN (never a guessed verdict) when any of the three texts is missing, does not mention the
 *  referent, or yields no extractable numeric value -- this function never calls the SymPy bridge
 *  with a value it is not confident it parsed correctly. When the SymPy subprocess itself is
 *  unavailable (missing python/sympy, timeout), plow_gom_jabbar.ts's own result reports
 *  computedProduct=null; this function surfaces that as ABSTAIN too (SymPy being unreachable is not
 *  evidence of fabrication, it is evidence this file could not check) -- 'FABRICATED' is reserved
 *  for the case SymPy actually computed a product and it does not reconcile with the independently
 *  sourced population within tolerance. */
export async function reconcileDerivedQuantityFromText(
  input: DerivedQuantityReconciliationInput,
): Promise<DerivedQuantityReconciliationResult> {
  if (!input.densityResponseText || input.densityResponseText.trim().length === 0) {
    return abstain('no density response was supplied');
  }
  if (!input.areaResponseText || input.areaResponseText.trim().length === 0) {
    return abstain('no area response was supplied');
  }
  if (!input.populationResponseText || input.populationResponseText.trim().length === 0) {
    return abstain('no independently sourced population response was supplied');
  }

  const densitySeg = findReferentSegment(input.densityResponseText, input.referentLabel);
  if (densitySeg === null) {
    return abstain(`referent "${input.referentLabel}" not found in the density response`);
  }
  const areaSeg = findReferentSegment(input.areaResponseText, input.referentLabel);
  if (areaSeg === null) {
    return abstain(`referent "${input.referentLabel}" not found in the area response`);
  }
  const popSeg = findReferentSegment(input.populationResponseText, input.referentLabel);
  if (popSeg === null) {
    return abstain(`referent "${input.referentLabel}" not found in the population response`);
  }

  const densityValue = extractDensityValue(densitySeg);
  if (densityValue === null) {
    return abstain(`no extractable numeric density value in the matched segment: "${densitySeg}"`);
  }
  const areaValueKm2 = extractAreaValueKm2(areaSeg);
  if (areaValueKm2 === null) {
    return abstain(`no extractable, unit-resolvable area value in the matched segment: "${areaSeg}"`);
  }
  const statedPopulation = extractScaledNumber(popSeg);
  if (statedPopulation === null) {
    return abstain(`no extractable population figure in the matched segment: "${popSeg}"`);
  }

  const factorA: DerivedQuantityFactor = { label: 'density_people_per_km2', value: densityValue };
  const factorB: DerivedQuantityFactor = { label: 'area_km2', value: areaValueKm2 };
  const sympyResult = await reconcileParsedFactors(
    factorA,
    factorB,
    statedPopulation,
    input.relTolerance ?? 0.05,
  );

  if (sympyResult.computedProduct === null) {
    return {
      verdict: 'ABSTAIN',
      densityValue,
      areaValueKm2,
      statedPopulation,
      sympyResult,
      trace:
        `ABSTAIN: parsed density=${densityValue}, area=${areaValueKm2} km^2, independently-sourced ` +
        `population=${statedPopulation}, but plow_gom_jabbar.ts's real SymPy subprocess did not ` +
        `return a usable product (${sympyResult.trace}) -- not evidence of fabrication, evidence ` +
        `this file could not check.`,
    };
  }

  const verdict: 'CORROBORATED' | 'FABRICATED' = sympyResult.consistent ? 'CORROBORATED' : 'FABRICATED';
  return {
    verdict,
    densityValue,
    areaValueKm2,
    statedPopulation,
    sympyResult,
    trace:
      `${verdict}: parsed density=${densityValue} people/km2 (referent "${input.referentLabel}"), ` +
      `area=${areaValueKm2} km^2 (mathjs unit-converted), independently-sourced population=` +
      `${statedPopulation}. ${sympyResult.trace}`,
  };
}
