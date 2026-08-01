// verify_kn_bp141_6_answer_coroner.js
// KN-BP141 TASK 6 verification script. Requires the REAL compiled dist output directly (never
// source, never a hand-rolled reimplementation of the classification logic). Loads the REAL
// Mini029Run receipt exactly as-is (no hand-editing/tidying) and runs it through the real
// runAnswerCoronerOnLocalOutcomes(...) -- the same function index.ts's 'plow:run-answer-coroner-
// local' IPC handler calls -- to prove:
//   6a) question_id 33 (corroboration=deterministic_compute, sources=[deterministic_compute],
//       swarmFired=false) is classed 'compute', NOT 'sourced-fact', and the card names the
//       solver ("pseudocode_trace") that proved the answer.
//   6b) the raw plowTrace.gate_outcomes G1_FACT/G3_BMV FAILED reading for qid 33 is re-derived to
//       N/A on the card (never scored as if a deterministic proof were an under-corroborated
//       vote) -- shown as an explicit before(raw)/after(card) comparison.
'use strict';

const path = require('path');
const fs = require('fs');

const DIST_ANSWER_CORONER = path.join(__dirname, '..', 'dist', 'main', 'plow', 'answer_coroner.js');
const { runAnswerCoronerOnLocalOutcomes } = require(DIST_ANSWER_CORONER);

const RECEIPT_PATH = 'C:\\Users\\Administrator\\Downloads\\Mini029Runmnemo_mesh_test_receipt_2026-08-01T10-26-24-081Z.json';

function divider(title) {
  console.log('\n' + '='.repeat(78));
  console.log(title);
  console.log('='.repeat(78));
}

let allPass = true;
function check(label, actual, expected) {
  const pass = actual === expected;
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${label}: expected ${expected}, got ${actual}`);
  if (!pass) allPass = false;
  return pass;
}

async function main() {
  divider('LOADING REAL RECEIPT (unmodified, as-is)');
  console.log('Receipt path:', RECEIPT_PATH);
  const raw = fs.readFileSync(RECEIPT_PATH, 'utf8');
  const receipt = JSON.parse(raw);
  console.log('Receipt outcomes count:', receipt.outcomes.length);
  console.log('Receipt top-level config: substrateEnabled=' + receipt.substrateEnabled +
    ' plowEnabled=' + receipt.plowEnabled + ' researchArmMode=' + receipt.researchArmMode);

  const qid33Raw = receipt.outcomes.find((o) => o.question_id === 33);
  divider('RAW plowTrace.gate_outcomes FOR qid 33 (BEFORE -- straight from the receipt, untouched)');
  console.log(JSON.stringify(qid33Raw.plowTrace.gate_outcomes, null, 2));
  console.log('raw bmv_score:', qid33Raw.plowTrace.bmv_score);
  console.log('raw browserAuthorityCorroboration:', qid33Raw.plowTrace.browserAuthorityCorroboration);
  console.log('raw voter_diagnostics[0].rawPreview:', qid33Raw.plowTrace.voter_diagnostics[0].rawPreview);

  divider('RUNNING REAL runAnswerCoronerOnLocalOutcomes(...) FROM COMPILED dist/');
  const roundup = await runAnswerCoronerOnLocalOutcomes(receipt.outcomes, {
    onProgress: (msg) => console.log('[progress] ' + msg),
    runConfig: {
      substrateEnabled: receipt.substrateEnabled,
      plowEnabled: receipt.plowEnabled,
      researchArmMode: receipt.researchArmMode,
    },
  });

  divider('FULL ROUNDUP OBJECT (real classifier output)');
  console.log(JSON.stringify(roundup, (k, v) => (k === 'exemplars' ? undefined : v), 2));

  divider('PER-QUESTION CLASSIFICATION (from roundup.byClass)');
  for (const [cls, recs] of Object.entries(roundup.byClass)) {
    for (const rec of recs) {
      console.log(
        `  routeId=${rec.routeId}  outcome=${rec.outcome}  answerClass=${rec.answerClass}  ` +
        `correctable=${rec.correctable}  sealed=${rec.sealedLetter}  got=${rec.answeredLetter ?? 'null'}  ` +
        `solver=${rec.deterministicSolverName ?? 'null'}`,
      );
    }
  }

  const byRoute = {};
  for (const recs of Object.values(roundup.byClass)) {
    for (const rec of recs) byRoute[rec.routeId] = rec;
  }
  const rec33 = byRoute['local-33'];

  divider('ASSERTIONS (6a -- qid 33 classed compute/pseudocode_trace, not sourced-fact)');
  check('qid 33 answerClass', rec33 && rec33.answerClass, 'compute');
  check('qid 33 answerClass is NOT sourced-fact', rec33 && rec33.answerClass !== 'sourced-fact', true);
  check('qid 33 deterministicSolverName', rec33 && rec33.deterministicSolverName, 'pseudocode_trace');
  check('qid 33 outcome', rec33 && rec33.outcome, 'right');
  check('qid 33 correctable', rec33 && rec33.correctable, false);
  const anySourcedFactHoldsQid33 = !!(roundup.byClass['sourced-fact'] || []).find((r) => r.routeId === 'local-33');
  check('no sourced-fact bucket holds qid 33', anySourcedFactHoldsQid33, false);

  divider('BEFORE / AFTER -- G1_FACT / G3_BMV gate line for qid 33');
  const rawG1 = qid33Raw.plowTrace.gate_outcomes.find((g) => g.gate === 'G1_FACT');
  const rawG3 = qid33Raw.plowTrace.gate_outcomes.find((g) => g.gate === 'G3_BMV');
  console.log('  BEFORE (raw receipt) G1_FACT: passed=' + rawG1.passed + '  detail="' + rawG1.detail + '"');
  console.log('  BEFORE (raw receipt) G3_BMV:  passed=' + rawG3.passed + '  detail="' + rawG3.detail + '"');
  const cardG1 = (rec33.gateOutcomes || []).find((g) => g.gate === 'G1_FACT');
  const cardG3 = (rec33.gateOutcomes || []).find((g) => g.gate === 'G3_BMV');
  console.log('  AFTER  (Coroner card) G1_FACT: passed=' + (cardG1 && cardG1.passed) + '  detail="' + (cardG1 && cardG1.detail) + '"');
  console.log('  AFTER  (Coroner card) G3_BMV:  passed=' + (cardG3 && cardG3.passed) + '  detail="' + (cardG3 && cardG3.detail) + '"');

  divider('ASSERTIONS (6b -- G1_FACT/G3_BMV no longer read FAILED on the card for qid 33)');
  check('raw G1_FACT was FAILED (sanity check on the receipt itself)', rawG1.passed, false);
  check('raw G3_BMV was FAILED (sanity check on the receipt itself)', rawG3.passed, false);
  check('card G1_FACT is now N/A (passed=null), not FAILED', cardG1 && cardG1.passed, null);
  check('card G3_BMV is now N/A (passed=null), not FAILED', cardG3 && cardG3.passed, null);
  // G2_CONC/G4_LAT must be left untouched -- only G1_FACT/G3_BMV are de-confidenced
  const cardG2 = (rec33.gateOutcomes || []).find((g) => g.gate === 'G2_CONC');
  const cardG4 = (rec33.gateOutcomes || []).find((g) => g.gate === 'G4_LAT');
  check('card G2_CONC untouched (still passed=true)', cardG2 && cardG2.passed, true);
  check('card G4_LAT untouched (still passed=true)', cardG4 && cardG4.passed, true);

  divider('SUMMARY');
  console.log('qid 33 classed as compute/pseudocode_trace (not sourced-fact):',
    (rec33 && rec33.answerClass === 'compute' && rec33.deterministicSolverName === 'pseudocode_trace')
      ? 'CONFIRMED' : 'MISMATCH');
  console.log('G1_FACT/G3_BMV de-confidenced to N/A on the card for qid 33:',
    (cardG1 && cardG1.passed === null && cardG3 && cardG3.passed === null) ? 'CONFIRMED' : 'MISMATCH');
  console.log('\nOVERALL: ' + (allPass ? 'ALL CHECKS PASS' : 'SOME CHECKS FAILED'));
  process.exitCode = allPass ? 0 : 1;
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exitCode = 1;
});
