// method_silo_backfill_D-BP221-BM04-031.mjs -- D-BP221-BM04-031/BISHOP-SEG-SILO/BM04
//
// THE DRIFT THIS CLOSES (measured by the prior recon this dispatch inherited, D-BP221-BM0-044):
// 18 method objects are LIVE in the running Liana Cycle engine, registered at import time from
// src/main/liana_cycle/methods/*.ts (15 real solving methods + 3 deliberate run:null "recognized,
// not yet taught" stubs). The METHOD_SILO on disk held exactly ONE deposited eblet
// (DEFINE/definitional_cascade.eblet.md, a BP164 demo deposit). Methods get authored and wired
// live in code but were never deposited into the silo meant to accumulate them. This script closes
// that gap using the ESTATE'S OWN EXISTING WRITE PATH -- depositMethodologyEblet() in
// src/main/liana_cycle/evidence/method_silo.ts -- never a second deposit mechanism or schema.
//
// WHY THIS IS A PLAIN SCRIPT, NOT A TS SOURCE CHANGE: per this dispatch's own hard constraint
// ("prefer not modifying mnemosyne source at all... do not touch the method .ts files or
// liana_terminal_engine.ts"), this file touches NO existing source. It requires the ALREADY-BUILT
// dist/main/liana_cycle CommonJS output (same convention as the existing precedent script
// scripts/test_survey_wiring_qid85_bp150_016.mjs, which already requires
// '../dist/main/liana_cycle/methods/definitional_cascade.js' the same way) so that every method
// module's own registerMethod() side effect fires exactly as it does in the live engine, then reads
// the REAL LianaMethod objects back out of the registry -- id, demand, name, taughtBy,
// shapeDescription, run, quarantined -- and passes them, VERBATIM where the dispatch requires
// verbatim, into the real depositMethodologyEblet() function. Run `npm run build:main` first if
// dist/main is stale relative to src/main (this script does not rebuild for you).
//
// METHOD ID CONVENTION: reuses the EXACT dotted id shape the sole pre-existing deposit already
// used ('methods.<file-stem>.<exportName>', see method_silo.ts's own methodSlug() doc comment and
// method_silo.demo.test.ts's own 'methods.definitional_cascade.definitionalCascadeMethod') rather
// than inventing a second id shape from LianaMethod.id's own short hyphenated form -- this is what
// makes the definitional-cascade deposit below land on the SAME slug as the existing file
// (DEFINE/definitional_cascade.eblet.md) so Rule 66 (version, never overwrite) actually exercises
// its supersede path instead of silently creating a second, differently-named file for the same
// method.
//
// QID PROVENANCE, NEVER GUESSED: MethodSiloDepositInput.qid is "the qid whose human walkthrough
// TAUGHT this method, or null" -- never a qid merely MENTIONED in taughtBy for some other reason.
// QID_BY_METHOD_ID below was read by a human (this dispatch), one taughtBy string at a time, and
// is deliberately conservative: comparative-cascade (98), definitional-cascade (85),
// withheld-curve-shift-guard (46), set-equivalence-match (66), umbrella-or-school-check (92) and
// convention-locked-recompute (20) each cite an actual walked/Didasko teaching case with an
// explicit qid; every other method's own taughtBy text EITHER says outright "Not a single walked
// human case" / "NOT YET TAUGHT" (the four generic SymPy/compute-sidecar builds, the three
// untaught-shape stubs; the untaught stubs' "nominated" qids 66/72/92 are proposals for FUTURE
// work, never a teaching case, so they stay null) OR, for classify-cascade, mentions qid 98 only in
// the context of a SEPARATE Founder ruling that qid 98 itself carries demand CLASSIFY -- its own
// taughtBy text says plainly "this is a BUILD, not an extraction," so qid stays null rather than
// borrowing comparative-cascade's number for an unrelated citation.
//
// STUB AND QUARANTINE MARKING (dispatch hard constraints 3 and an honesty finding made this
// dispatch): the 3 run:null methods are marked "[STUB -- NO SOLVING LOGIC]" in their own
// whatItDoes text, verbatim-appended, never silently deposited as if equivalent to a working
// method. ADDITIONALLY, this dispatch measured that set-equivalence-match, though it HAS a run()
// function, carries `quarantined: true` in the live registry (D-BP220-BM0-006) -- its run() now
// REFUSES rather than deriving a verdict, and it can never be SELECTED by selectMethod() /
// selectEligibleMethods(). That was not named in this dispatch's own brief (which named only the
// 3 run:null stubs) but is the same "cannot tell a working method from a stub" risk the brief
// warns against, so it is marked "[QUARANTINED]" the same honest way.
//
// THE GUARD MAY REFUSE MOST OF THESE, AND THAT IS THE MEASUREMENT, NOT A BUG IN THIS SCRIPT.
// depositMethodologyEblet()'s own scanForAnswerLeakage() runs a VALUE-SHAPED guard (D-BP165-M0-010)
// that refuses any bare 2+-digit integer or decimal ANYWHERE in whatItDoes/taughtBy, with narrow
// carve-outs only for dispatch ids, bare BP numbers, qid citations, and ISO timestamps
// (SAFE_NUMERIC_IDENTIFIER_PATTERNS). Real taughtBy prose in this registry is full of OTHER
// legitimate numbers the guard cannot distinguish from a leaked answer value -- dataset
// question_ids, percentage/count citations from measurement reports, angle-degree lists. Per this
// dispatch's own hard constraint ("carry taughtBy verbatim... never a guessed or placeholder
// value"), this script does NOT rephrase taughtBy to dodge the guard -- a refusal is reported
// as-is, with the real leaks[] the function returned, for the Founder to rule on (loosen the guard,
// or accept a smaller silo, or something else). Faking a pass would be worse than an honest
// refusal count.
//
// USAGE: node scripts/method_silo_backfill_D-BP221-BM04-031.mjs [--dir <path>]
// Default target dir is method_silo.ts's own resolveMethodSiloDir() (the real, live
// HARDWIRE\LEDGER\EBLETS\METHOD_SILO on disk) -- pass --dir to redirect into a scratch dir for a
// dry run instead of touching the real silo.

import { createRequire } from 'module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_LIANA_CYCLE = path.join(__dirname, '..', 'dist', 'main', 'liana_cycle');

const registry = require(path.join(DIST_LIANA_CYCLE, 'method_registry.js'));
const siloMod = require(path.join(DIST_LIANA_CYCLE, 'evidence', 'method_silo.js'));

// Every live import in src/main/liana_cycle/liana_terminal_engine.ts that registers a method,
// reproduced here so this script's own registry state matches the running engine's exactly --
// confirmed this dispatch by grepping liana_terminal_engine.ts's own import list (anchored_lookup_
// guard.ts is DELIBERATELY EXCLUDED -- its own import is commented out in the live engine,
// replaced by withheld_curve_shift_guard.ts; it is not one of the 18 live methods).
const METHOD_MODULES = [
  'comparative_cascade', 'definitional_cascade', 'classify_cascade', 'untaught_shapes',
  'arithmetic_cascade', 'stage3_symbolic_cascade', 'compute_gemma_cascade', 'compute_select_cascade',
  'pythagorean_theorem_cascade', 'quadratic_formula_cascade', 'permutation_combination_cascade',
  'law_of_cosines_cascade', 'withheld_curve_shift_guard', 'set_equivalence_match',
  'umbrella_or_school_check', 'convention_locked_recompute',
];
for (const m of METHOD_MODULES) require(path.join(DIST_LIANA_CYCLE, 'methods', `${m}.js`));

const METHOD_ID_BY_LIANA_ID = {
  'comparative-cascade': 'methods.comparative_cascade.comparativeCascadeMethod',
  'definitional-cascade': 'methods.definitional_cascade.definitionalCascadeMethod',
  'classify-cascade': 'methods.classify_cascade.classifyCascadeMethod',
  'identify-untaught': 'methods.untaught_shapes.identifyUntaught',
  'infer-untaught': 'methods.untaught_shapes.inferUntaught',
  'locate-in-framework-untaught': 'methods.untaught_shapes.locateInFrameworkUntaught',
  'arithmetic-cascade': 'methods.arithmetic_cascade.arithmeticCascadeMethod',
  'stage3-symbolic-cascade': 'methods.stage3_symbolic_cascade.stage3SymbolicCascadeMethod',
  'compute-gemma-cascade': 'methods.compute_gemma_cascade.computeGemmaCascadeMethod',
  'compute-select-cascade': 'methods.compute_select_cascade.computeSelectCascadeMethod',
  'pythagorean-theorem-cascade': 'methods.pythagorean_theorem_cascade.pythagoreanTheoremCascadeMethod',
  'quadratic-formula-cascade': 'methods.quadratic_formula_cascade.quadraticFormulaCascadeMethod',
  'permutation-combination-cascade': 'methods.permutation_combination_cascade.permutationCombinationCascadeMethod',
  'law-of-cosines-cascade': 'methods.law_of_cosines_cascade.lawOfCosinesCascadeMethod',
  'withheld-curve-shift-guard': 'methods.withheld_curve_shift_guard.withheldCurveShiftGuardMethod',
  'set-equivalence-match': 'methods.set_equivalence_match.setEquivalenceMatchMethod',
  'umbrella-or-school-check': 'methods.umbrella_or_school_check.umbrellaOrSchoolCheckMethod',
  'convention-locked-recompute': 'methods.convention_locked_recompute.conventionLockedRecomputeMethod',
};

// Read by a human, one taughtBy string at a time -- see file header. null means "no walked
// teaching case is honestly extractable from this method's own taughtBy text," never "not found."
const QID_BY_LIANA_ID = {
  'comparative-cascade': 98,
  'definitional-cascade': 85,
  'classify-cascade': null,
  'identify-untaught': null,
  'infer-untaught': null,
  'locate-in-framework-untaught': null,
  'arithmetic-cascade': null,
  'stage3-symbolic-cascade': null,
  'compute-gemma-cascade': null,
  'compute-select-cascade': null,
  'pythagorean-theorem-cascade': null,
  'quadratic-formula-cascade': null,
  'permutation-combination-cascade': null,
  'law-of-cosines-cascade': null,
  'withheld-curve-shift-guard': 46,
  'set-equivalence-match': 66,
  'umbrella-or-school-check': 92,
  'convention-locked-recompute': 20,
};

const DISPATCH_ID = 'D-BP221-BM04-031';
const RUN_ID = 'D-BP221-BM04-031-method-silo-backfill';
const SESSION_LABEL = 'BP221';
const MODEL = 'claude-sonnet-5';
const FILED_BY = 'D-BP221-BM04-031/SEG-SILO, model claude-sonnet-5';
const HEX_CONNECTOR = 'PROOF';
const HEX_JUSTIFICATION = 'PROOF\'s keeper (keeper_proof_and_measurement.md, cited from MEMORY.md) '
  + 'holds cascade and method measurement discipline; a demand-kind-to-method mapping read off the '
  + 'live Liana Cycle method registry is exactly that -- not a standing RULE (RULES), not campaign '
  + 'STATE, and not HARDWIRE ledger or mesh protocol.';

function argDir() {
  const i = process.argv.indexOf('--dir');
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function buildWhatItDoes(m) {
  let text = m.shapeDescription;
  if (m.run === null) {
    text = '[STUB -- NO SOLVING LOGIC. This method\'s run field is null in the live registry; it is '
      + 'registered so the demand shape is recognized, never so a question is actually resolved.] '
      + text;
  } else if (m.quarantined) {
    text = '[QUARANTINED -- run() exists but refuses to derive a verdict rather than answering; this '
      + 'method is NOT selectable by the live registry\'s own selectMethod()/selectEligibleMethods(). '
      + 'See this method\'s own quarantineReason field in method_registry.ts for the measured '
      + 'coverage and accuracy sweep this fence is based on.] '
      + text;
  }
  return text;
}

function main() {
  const dir = argDir();
  const methods = registry.listMethods();
  console.log(`[${DISPATCH_ID}] live methods read from registry: ${methods.length}`);

  const results = [];
  for (const m of methods) {
    const methodId = METHOD_ID_BY_LIANA_ID[m.id];
    if (!methodId) {
      results.push({ lianaId: m.id, ok: false, reason: 'no methodId mapping in this script -- refusing rather than guessing one', leaks: null });
      continue;
    }
    const qid = Object.prototype.hasOwnProperty.call(QID_BY_LIANA_ID, m.id) ? QID_BY_LIANA_ID[m.id] : null;
    const input = {
      demandKind: m.demand,
      methodId,
      whatItDoes: buildWhatItDoes(m),
      taughtBy: m.taughtBy, // VERBATIM, per this dispatch's hard constraint
      qid,
      runId: RUN_ID,
      dispatchId: DISPATCH_ID,
      hexConnector: HEX_CONNECTOR,
      hexConnectorJustification: HEX_JUSTIFICATION,
      sessionLabel: SESSION_LABEL,
      model: MODEL,
      filedBy: FILED_BY,
      ...(dir ? { dir } : {}),
    };
    const outcome = siloMod.depositMethodologyEblet(input);
    results.push({
      lianaId: m.id,
      demand: m.demand,
      runIsNull: m.run === null,
      quarantined: !!m.quarantined,
      qid,
      ok: outcome.ok,
      path: outcome.ok ? outcome.path : null,
      bytes: outcome.ok ? outcome.bytes : null,
      supersededPath: outcome.ok ? (outcome.supersededPath ?? null) : null,
      reason: outcome.ok ? null : outcome.reason,
      leaks: outcome.ok ? null : outcome.leaks,
    });
  }

  console.log(JSON.stringify(results, null, 2));
  const deposited = results.filter((r) => r.ok);
  const refused = results.filter((r) => !r.ok);
  console.log('---SUMMARY---');
  console.log(`deposited: ${deposited.length} / ${results.length}`);
  console.log(`refused: ${refused.length} / ${results.length}`);
  console.log(`silo dir used: ${dir || '(default, resolveMethodSiloDir())'}`);
}

main();
