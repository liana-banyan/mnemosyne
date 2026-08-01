// formula_eblet_mint.ts -- BP141 (this Yoke): mints a REUSABLE FORMULA/TOOL eblet (class:
// 'component') from a deterministic-compute SUCCESS, distinct from writeAndReplicateSolvedAnswer
// (which records THIS question's own answer letter, class:'whole_answer') and from the existing
// writeComputeMethodEblet() in plow_mc_answerer.ts (which is left byte-for-byte unchanged this
// Yoke -- see that function's own doc comment; it embeds a truncated slice of the live
// researchQuery in its `reasoning` field, which is fine for its own narrower "class-signature +
// worked example" purpose but is NOT the strict method-only shape this Yoke's governing
// distinction requires).
//
// THE GOVERNING DISTINCTION (canon:
// canon_eblet_taxonomy_tool_fact_wholeanswer_component_rgbyo_revisable_context_scoped_bp140):
//   - A WHOLE_ANSWER eblet is "the answer to THIS question" -- an answer key. Gated OFF during
//     scored runs.
//   - A TOOL/FORMULA/FACT eblet is a reusable instrument, question-independent: e.g.
//     "density = mass / volume". Legitimate to reason WITH during scoring, because using a
//     formula is deriving, not memorizing.
// The line is absolute: a tool eblet must contain NO reference to a specific benchmark question
// and NO answer letter. If it could be used to look up an answer, it is a key, not a tool.
//
// HOW THIS MODULE STAYS ON THE SAFE SIDE OF THAT LINE: mintFormulaEbletFromCompute() below reads
// EXACTLY ONE field off the caller-supplied compute result -- `.method` (a short tag like
// 'density' or 'schedule_amortization') -- and uses it purely as a KEY into the FORMULA_SPECS
// table below. It never reads, forwards, truncates, or otherwise touches sourceExpression,
// computedValue, computedUnit, optionValue, optionUnit, letter, source, or the live
// researchQuery/reasoningTexts that produced this particular compute success. Every question/
// answer/reasoning string actually written to the store is a FIXED, hand-authored, general
// statement of the method -- authored once below, identical on every mint of that method,
// forever. There is structurally no code path by which a specific benchmark question's text or
// its correct-option letter can reach this module's output, because this module never receives
// them as inputs in the first place (not "omits them," "does not accept them").
//
// DEDUPLICATION (Rule 66: append-only store, never delete/overwrite): one component eblet per
// method, not per question -- otherwise a benchmark run of hundreds of density questions would
// mint hundreds of byte-identical "density = mass / volume" eblets. Matched on the
// `deterministic_compute:formula:<methodName>` provenance prefix against the existing store,
// checked once per method per process lifetime (mintedOrCheckedMethods cache below) so a long
// benchmark run doesn't re-scan the whole JSONL file on every single compute success.
//
// Fully non-fatal by construction (internal try/catch, never throws) -- a failed or skipped mint
// must never affect the caller's returned answer. Call sites in plow_mc_answerer.ts fire this
// AFTER the existing writeComputeMethodEblet() call, as an additional, independent write; neither
// call depends on the other's outcome.

import { writeVerifiedEblet, loadAllVerifiedEblets } from '../mnem_eblet_store';

/** Minimal structural shape this module actually reads from a compute-success result. Any of
 *  DeterministicComputeCandidate (plow_mc_answerer.ts) / ComputeSidecarResult / UnitAwareComputeResult
 *  (compute_sidecar.ts) already satisfy this -- callers pass the real result object directly, no
 *  adapter needed, and this module simply ignores every field on it other than `method`. */
export interface ComputeSuccessMethodOnly {
  method: string;
}

interface FormulaSpec {
  /** The METHOD as a general, question-independent question. Never the benchmark question text. */
  question: string;
  /** The general formula/relation and units convention. Never a specific numeric answer or an
   *  MC answer letter. */
  answer: string;
  /** The derivation pattern -- how to apply the formula/method in general. No concrete numbers
   *  from any specific question; every quantity here is a variable name, never a value. */
  reasoning: string;
}

// Shared spec for the units-aware compute family (tier (i) in
// resolveDeterministicComputeOverride, and the direct compute-sidecar unitAware path): these
// three/four method tags are all the SAME general procedure -- obtain a quantity (with or without
// an explicit unit), unit-convert it into each MC option's own unit via mathjs, and accept only
// when exactly one option matches within tolerance. General on its face: it names no domain
// formula and no specific question.
const UNIT_AWARE_SPEC: FormulaSpec = {
  question:
    'How do you match a computed quantity to a multiple-choice option when the quantity and the ' +
    'options may be stated in different (but convertible) units?',
  answer:
    'Convert the computed quantity into each option’s own unit (e.g. via a unit-aware ' +
    'conversion library) before comparing, rather than comparing raw numbers -- a computed value ' +
    'of 600 kg/m^3 and an option of 0.60 g/cc can be the same quantity in different units.',
  reasoning:
    'Identify the quantity to compute, either from an arithmetic expression stated directly in ' +
    'the question or from the final "value unit" stated in a prior derivation. Convert that ' +
    'quantity into the unit each option is stated in, then accept a match only when exactly one ' +
    'option agrees within tolerance -- never guess when zero or multiple options match.',
};

const BARE_VALUE_SPEC: FormulaSpec = {
  question:
    'How do you match a computed numeric result to a multiple-choice option when neither the ' +
    'result nor the options carry units?',
  answer:
    'Evaluate the arithmetic expression stated in (or derivable from) the question to a bare ' +
    'number, then accept the one option whose numeric value matches within tolerance.',
  reasoning:
    'Extract or derive a single arithmetic expression, evaluate it, and compare the result ' +
    'against each option’s numeric value. Accept only when exactly one option matches within ' +
    'tolerance -- never guess when zero or multiple options match.',
};

const DENSITY_SPEC: FormulaSpec = {
  question: 'How is density computed from a mass and a volume (or a set of dimensions)?',
  answer:
    'density = mass / volume. When only linear dimensions are given, first compute ' +
    'volume = length * width * height, unit-normalizing all three to a common length unit.',
  reasoning:
    'Unit-normalize the mass and the volume (or the dimensions used to derive the volume) into a ' +
    'common, consistent unit system, then divide mass by volume to obtain density. Convert the ' +
    'result into each option’s own density unit before comparing, and accept only the one ' +
    'option that matches within tolerance.',
};

const SCHEDULE_AMORTIZATION_SPEC: FormulaSpec = {
  question:
    'How is a loan/installment repayment schedule (amortization) advanced one period at a time?',
  answer:
    'Per period: interest = unpaid_balance * period_rate; principal_paid = payment - interest; ' +
    'new_unpaid_balance = unpaid_balance - principal_paid.',
  reasoning:
    'Starting from the stated principal, payment amount, periodic interest rate, and period ' +
    'count, apply the per-period interest-then-principal-reduction formula repeatedly (or solve ' +
    'algebraically for a requested period) to project the balance, total interest paid, or number ' +
    'of periods to payoff. Compare the computed value against each option, accepting only a ' +
    'single tolerance-matching option.',
};

const PHYSICS_KEPLER_SPEC: FormulaSpec = {
  question:
    'How does Kepler’s third law relate an orbital period to the orbital separation and the ' +
    'masses of two mutually orbiting bodies?',
  answer:
    'General two-body form: T^2 = 4*pi^2*a^3 / (G*(m1+m2)), where T is the orbital period, a is ' +
    'the semi-major axis (separation), G is the gravitational constant, and m1+m2 is the total ' +
    'system mass.',
  reasoning:
    'Given the separation (or semi-major axis) and the masses of the two orbiting bodies, ' +
    'substitute into T^2 = 4*pi^2*a^3/(G*(m1+m2)) and solve algebraically for the requested ' +
    'quantity (typically the period). Unit-convert the result to each option’s unit before ' +
    'comparing, and accept only a single tolerance-matching option.',
};

const AIRCRAFT_LIFT_DRAG_SPEC: FormulaSpec = {
  question:
    'How is aerodynamic lift or drag force computed from air density, velocity, a reference area, ' +
    'and a lift/drag coefficient?',
  answer:
    'General form: F = 0.5 * rho * v^2 * S * C, where rho is air density, v is velocity, S is a ' +
    'reference area (e.g. wing area), and C is the relevant lift or drag coefficient (itself ' +
    'sometimes derived from a stated linear relation to angle of attack).',
  reasoning:
    'Given air density, velocity, reference area, and either a stated coefficient or a linear ' +
    'relation used to derive one (e.g. from angle of attack), substitute into ' +
    'F = 0.5*rho*v^2*S*C and solve for the requested force or power quantity. Unit-convert the ' +
    'result to each option’s unit before comparing, and accept only a single tolerance-' +
    'matching option.',
};

// Keyed by every `method` tag actually observed across DeterministicComputeCandidate.method
// (plow_mc_answerer.ts's resolveDeterministicComputeOverride: 'unit_aware' | 'bare_value' |
// 'schedule_amortization' | 'density' | 'physics_kepler' | 'aircraft_lift_drag') and
// UnitAwareComputeResult.method (compute_sidecar.ts: 'unit_expression' |
// 'unit_reasoning_extraction' | 'bare_value_match'). A method with NO entry here is deliberately
// left unmapped -- mintFormulaEbletFromCompute() SKIPS (and logs) any such method rather than
// guess at a general formula string for it, per this module's hard leak-boundary above.
const FORMULA_SPECS: Record<string, FormulaSpec> = {
  unit_aware: UNIT_AWARE_SPEC,
  unit_expression: UNIT_AWARE_SPEC,
  unit_reasoning_extraction: UNIT_AWARE_SPEC,
  bare_value: BARE_VALUE_SPEC,
  bare_value_match: BARE_VALUE_SPEC,
  density: DENSITY_SPEC,
  schedule_amortization: SCHEDULE_AMORTIZATION_SPEC,
  physics_kepler: PHYSICS_KEPLER_SPEC,
  aircraft_lift_drag: AIRCRAFT_LIFT_DRAG_SPEC,
};

// BP-COMPUTE-HONEST-DEMOTE: these two method tags are, by construction, the ONLY two that
// compute_sidecar.ts's computeUnitAwareMatch ever stamps with `source: 'reasoning_fact'` --
// 'unit_reasoning_extraction' is path (a) (compute_sidecar.ts:889-905) and 'bare_value_match' is
// path (c) (compute_sidecar.ts:914-930); every OTHER method tag in FORMULA_SPECS above is either
// 'unit_expression'/'unit_aware' (path (b), always `source: 'question_expression'`) or one of the
// four named solvers, which derive strictly from the question text + options and never carry a
// 'reasoning_fact' source at all (see resolveDeterministicComputeOverride's tiers (iii)-(vi) in
// plow_mc_answerer.ts). Encoding the check this way -- purely off `method`, a fixed 1:1 mapping --
// means this module still never has to read (and this file's own leak-safety argument above still
// never has to claim it reads) anything beyond `result.method`.
const AUTHORITY_EXTRACTED_METHODS = new Set(['unit_reasoning_extraction', 'bare_value_match']);

const PROVENANCE_PREFIX = 'deterministic_compute:formula:';
// Sibling prefix for the two AUTHORITY_EXTRACTED_METHODS above -- deliberately does NOT contain
// the substring 'deterministic_compute', because mnem_eblet_store.ts's computeHonestVerification()
// grants verified:true on `provenance.includes('deterministic_compute')` alone, independent of the
// `corroboration` field. Using this prefix for those two methods is what makes the `corroboration:
// 'authority_extracted_compute'` fix below actually stick, rather than being silently overridden
// by the provenance-substring check.
const AUTHORITY_EXTRACTED_PROVENANCE_PREFIX = 'authority_extracted_compute:formula:';

/** Process-lifetime cache of method names already confirmed present in the store (either found
 *  pre-existing on the first check, or just written by this process) -- avoids re-scanning the
 *  whole verified_eblets.jsonl file on every single compute success within one long benchmark
 *  run. Deliberately NOT persisted/shared across processes; a cold-started process re-checks the
 *  store once per method the first time it sees that method, which is the correct/safe behavior
 *  (the store is the source of truth, this is purely a within-run optimization). */
const mintedOrCheckedMethods = new Set<string>();

export type FormulaMintOutcome = 'minted' | 'duplicate' | 'skipped_no_spec' | 'error';

/**
 * Given a successful deterministic-compute result, mint ONE reusable formula/tool eblet
 * (class:'component', corroboration:'deterministic_compute') for that result's `method`, unless
 * one already exists for that method or no safe general formula spec is registered for it.
 *
 * Reads ONLY `result.method` -- see this file's header for why that is the entire leak-safety
 * argument. Never throws; every failure mode (no spec, dedup hit, or a write/read error) resolves
 * to a returned outcome string, logged, with the caller's answer path completely unaffected.
 */
export async function mintFormulaEbletFromCompute(
  result: ComputeSuccessMethodOnly,
): Promise<FormulaMintOutcome> {
  const method = result?.method;
  try {
    if (!method) {
      return 'skipped_no_spec';
    }
    if (mintedOrCheckedMethods.has(method)) {
      return 'duplicate';
    }
    const spec = FORMULA_SPECS[method];
    if (!spec) {
      console.warn(
        `[formula_eblet_mint] no general formula spec registered for method="${method}" -- ` +
        'skipping rather than risk an ungeneralized write (Bishop: add a FORMULA_SPECS entry ' +
        'for this method if it should be shelved).',
      );
      return 'skipped_no_spec';
    }

    // BP-COMPUTE-HONEST-DEMOTE: `isAuthorityExtracted` is a pure lookup on `method` (see
    // AUTHORITY_EXTRACTED_METHODS's own doc comment above) -- still reads nothing off `result`
    // beyond `.method`, preserving this module's leak-safety argument unchanged.
    const isAuthorityExtracted = AUTHORITY_EXTRACTED_METHODS.has(method);
    const provenance = `${isAuthorityExtracted ? AUTHORITY_EXTRACTED_PROVENANCE_PREFIX : PROVENANCE_PREFIX}${method}`;

    const existing = await loadAllVerifiedEblets();
    const alreadyMinted = existing.some(
      (e) =>
        e.class === 'component' &&
        typeof e.provenance === 'string' &&
        e.provenance.startsWith(provenance),
    );
    if (alreadyMinted) {
      mintedOrCheckedMethods.add(method);
      return 'duplicate';
    }

    await writeVerifiedEblet({
      question: spec.question,
      answer: spec.answer,
      provenance,
      // Advisory only -- writeVerifiedEblet() re-derives verified/verdict from corroboration/
      // provenance via computeHonestVerification(); `corroboration` below is what genuinely earns
      // (or, for the authority-extracted methods, honestly withholds) this write's
      // verified:true/verdict:'verified'.
      verified: true,
      sha256: '',
      timestamp: Date.now(),
      class: 'component',
      reasoning: spec.reasoning,
      // BP-COMPUTE-HONEST-DEMOTE: 'unit_reasoning_extraction'/'bare_value_match' are always
      // reasoning_fact-sourced (see AUTHORITY_EXTRACTED_METHODS above) -- the general
      // unit-conversion/tolerance-match TECHNIQUE this mints is still true and reusable, but it
      // must not wear the 'deterministic_compute' label a real question-derived compute earns.
      corroboration: isAuthorityExtracted ? 'authority_extracted_compute' : 'deterministic_compute',
    });

    mintedOrCheckedMethods.add(method);
    console.log(`[formula_eblet_mint] minted formula/tool eblet for method="${method}"`);
    return 'minted';
  } catch (err) {
    console.warn('[formula_eblet_mint] mintFormulaEbletFromCompute failed (non-fatal):', err);
    return 'error';
  }
}
