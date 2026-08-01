// verify_kn_bp141_5_answer_coroner.js
// KN-BP141 TASK 5 verification script. Requires the REAL compiled dist output directly (never
// source, never a hand-rolled reimplementation of the classification logic). Loads BOTH real
// receipts exactly as-is (no hand-editing/tidying) and runs them through the real
// runAnswerCoronerOnLocalOutcomes(...) -- the same function index.ts's 'plow:run-answer-coroner-
// local' IPC handler calls -- to prove:
//   5a) question_id 92 (strongest acceptance path: structuredCorroborator=true,
//       independentCorroboration=true, unanimous voter_letters) gets its own 'contested-key'
//       class and is EXCLUDED from correctableWrongs (even though it is a real wrongTotal member).
//   5b) classifyCore now reads structuredCorroborator/independentCorroboration from plowTrace,
//       and question_id 98 (adjudicated pick, candidatesPostFurnace=0, both flags undefined) is
//       NOT read the same as question_id 92's fully-corroborated accept.
//   5c) 'matched-wrong-option' is split into its three actual failure modes:
//       coverage-gap (qid 85 on Mini30Also), contested-key (qid 92), ungrounded-adjudication
//       (qid 98) -- no row anywhere lands in a residual undifferentiated 'matched-wrong-option'.
'use strict';

const path = require('path');
const fs = require('fs');

const DIST_ANSWER_CORONER = path.join(__dirname, '..', 'dist', 'main', 'plow', 'answer_coroner.js');
const { runAnswerCoronerOnLocalOutcomes } = require(DIST_ANSWER_CORONER);

const RECEIPTS = [
  {
    label: '029',
    path: 'C:\\Users\\Administrator\\Downloads\\029mnemo_mesh_test_receipt_2026-08-01T09-50-03-191Z.json',
  },
  {
    label: 'Mini30Also',
    path: 'C:\\Users\\Administrator\\Downloads\\Mini30Alsomnemo_mesh_test_receipt_2026-08-01T10-19-17-254Z.json',
  },
];

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

async function runOne(receiptDef) {
  divider(`LOADING REAL RECEIPT (unmodified, as-is) -- ${receiptDef.label}`);
  console.log('Receipt path:', receiptDef.path);
  const raw = fs.readFileSync(receiptDef.path, 'utf8');
  const receipt = JSON.parse(raw);
  console.log('Receipt outcomes count:', receipt.outcomes.length);
  console.log('Receipt top-level config: substrateEnabled=' + receipt.substrateEnabled +
    ' plowEnabled=' + receipt.plowEnabled + ' researchArmMode=' + receipt.researchArmMode);

  divider(`RUNNING REAL runAnswerCoronerOnLocalOutcomes(...) FROM COMPILED dist/ -- ${receiptDef.label}`);
  const roundup = await runAnswerCoronerOnLocalOutcomes(receipt.outcomes, {
    onProgress: (msg) => console.log('[progress] ' + msg),
    runConfig: {
      substrateEnabled: receipt.substrateEnabled,
      plowEnabled: receipt.plowEnabled,
      researchArmMode: receipt.researchArmMode,
    },
  });

  divider(`FULL ROUNDUP OBJECT (real classifier output) -- ${receiptDef.label}`);
  console.log(JSON.stringify(roundup, (k, v) => (k === 'exemplars' ? undefined : v), 2));

  divider(`PER-QUESTION CLASSIFICATION (from roundup.byClass) -- ${receiptDef.label}`);
  for (const [cls, recs] of Object.entries(roundup.byClass)) {
    for (const rec of recs) {
      console.log(
        `  routeId=${rec.routeId}  outcome=${rec.outcome}  answerClass=${rec.answerClass}  ` +
        `correctable=${rec.correctable}  sealed=${rec.sealedLetter}  got=${rec.answeredLetter ?? 'null'}`,
      );
    }
  }

  return { receiptDef, receipt, roundup };
}

async function main() {
  const results = {};
  for (const receiptDef of RECEIPTS) {
    const r = await runOne(receiptDef);
    results[receiptDef.label] = r;
  }

  // ── 5a/5b/5c: qid-level assertions on BOTH receipts (both carry qid 92/98 with the same
  // empirical signature per the ticket; 029 additionally carries qid 85 via a different path than
  // Mini30Also, so the Mini30Also breakdown below is the one with a mandated exact count). ──
  for (const label of ['029', 'Mini30Also']) {
    divider(`ASSERTIONS (Task 5a/5b -- qid 92 contested-key, qid 98 ungrounded-adjudication) -- ${label}`);
    const { roundup } = results[label];
    const byRoute = {};
    for (const recs of Object.values(roundup.byClass)) {
      for (const rec of recs) byRoute[rec.routeId] = rec;
    }
    const rec92 = byRoute[`local-92`];
    const rec98 = byRoute[`local-98`];
    check(`${label}: qid 92 answerClass`, rec92 && rec92.answerClass, 'contested-key');
    check(`${label}: qid 92 correctable (must be false -- excluded from correctableWrongs)`, rec92 && rec92.correctable, false);
    check(`${label}: qid 92 outcome (still an honest wrongTotal member)`, rec92 && rec92.outcome, 'wrong');
    check(`${label}: qid 98 answerClass`, rec98 && rec98.answerClass, 'ungrounded-adjudication');
    check(`${label}: qid 98 correctable (still a fixable defect)`, rec98 && rec98.correctable, true);

    divider(`ASSERTIONS (Task 5c -- no residual 'matched-wrong-option' bucket) -- ${label}`);
    const anyMatchedWrongOption = !!(roundup.byClass['matched-wrong-option'] && roundup.byClass['matched-wrong-option'].length > 0);
    check(`${label}: zero rows carry the superseded 'matched-wrong-option' class`, anyMatchedWrongOption, false);
  }

  // ── Mandated exact breakdown on Mini30Also ──
  divider('ASSERTIONS (Mini30Also mandated breakdown: 1 coverage-gap, 1 contested-key, 1 ungrounded-adjudication, 0 honest abstains)');
  const mini30 = results['Mini30Also'].roundup;
  const coverageGapCount = (mini30.byClass['coverage-gap'] || []).length;
  const contestedKeyCount = (mini30.byClass['contested-key'] || []).length;
  const ungroundedAdjCount = (mini30.byClass['ungrounded-adjudication'] || []).length;
  check('Mini30Also: coverage-gap count', coverageGapCount, 1);
  check('Mini30Also: contested-key count', contestedKeyCount, 1);
  check('Mini30Also: ungrounded-adjudication count', ungroundedAdjCount, 1);
  check('Mini30Also: contestedKeyTotal (roundup headline)', mini30.contestedKeyTotal, 1);
  check('Mini30Also: honestAbstains', mini30.honestAbstains, 0);
  const coverageGapRec = (mini30.byClass['coverage-gap'] || [])[0];
  check('Mini30Also: coverage-gap row is qid 85', coverageGapRec && coverageGapRec.routeId, 'local-85');
  const contestedKeyRec = (mini30.byClass['contested-key'] || [])[0];
  check('Mini30Also: contested-key row is qid 92', contestedKeyRec && contestedKeyRec.routeId, 'local-92');
  const ungroundedAdjRec = (mini30.byClass['ungrounded-adjudication'] || [])[0];
  check('Mini30Also: ungrounded-adjudication row is qid 98', ungroundedAdjRec && ungroundedAdjRec.routeId, 'local-98');
  // correctableWrongs must include coverage-gap + ungrounded-adjudication (2) but NOT contested-key
  check('Mini30Also: correctableWrongs excludes contested-key (2, not 3)', mini30.correctableWrongs, 2);
  check('Mini30Also: wrongTotal includes contested-key too (3)', mini30.wrongTotal, 3);

  divider('SUMMARY');
  console.log('Mini30Also: 1 coverage-gap / 1 contested-key / 1 ungrounded-adjudication / 0 honest abstains:',
    (coverageGapCount === 1 && contestedKeyCount === 1 && ungroundedAdjCount === 1 && mini30.honestAbstains === 0)
      ? 'CONFIRMED' : 'MISMATCH');
  console.log('\nOVERALL: ' + (allPass ? 'ALL CHECKS PASS' : 'SOME CHECKS FAILED'));
  process.exitCode = allPass ? 0 : 1;
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exitCode = 1;
});
