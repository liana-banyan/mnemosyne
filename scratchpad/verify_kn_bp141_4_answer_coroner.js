// verify_kn_bp141_4_answer_coroner.js
// KN-BP141 TASK 4 verification script. Requires the REAL compiled dist output directly (never
// source, never a hand-rolled reimplementation of the classification logic). Loads the REAL
// Mini030 receipt exactly as-is (no hand-editing/tidying) and runs it through the real
// runAnswerCoronerOnLocalOutcomes(...) -- the same function index.ts's 'plow:run-answer-coroner-
// local' IPC handler calls -- to prove:
//   4a) timedOut/error rows (question_id 92, 98) are NOT classified as honest abstains
//   4b) they land in their own 'no-response' bucket, never folded into wrong or abstain
//   4c) the wrong row (question_id 85, answeredBy=single_shot, plowTrace=null) gets a
//       'single-shot-wrong' class, never an invented 'plow-discordant'
//   4d) the roundup card states substrateEnabled/plowEnabled/researchArmMode from the receipt
'use strict';

const path = require('path');
const fs = require('fs');

const DIST_ANSWER_CORONER = path.join(__dirname, '..', 'dist', 'main', 'plow', 'answer_coroner.js');
const { runAnswerCoronerOnLocalOutcomes } = require(DIST_ANSWER_CORONER);

const RECEIPT_PATH = 'C:\\Users\\Administrator\\Downloads\\Mini030mnemo_mesh_test_receipt_2026-08-01T10-12-33-904Z.json';

function divider(title) {
  console.log('\n' + '='.repeat(78));
  console.log(title);
  console.log('='.repeat(78));
}

async function main() {
  divider('LOADING REAL RECEIPT (unmodified, as-is)');
  console.log('Receipt path:', RECEIPT_PATH);
  const raw = fs.readFileSync(RECEIPT_PATH, 'utf8');
  const receipt = JSON.parse(raw);
  console.log('Receipt outcomes count:', receipt.outcomes.length);
  console.log('Receipt top-level config: substrateEnabled=' + receipt.substrateEnabled +
    ' plowEnabled=' + receipt.plowEnabled + ' researchArmMode=' + receipt.researchArmMode);
  console.log('\nRaw outcomes (verbatim from receipt, no editing):');
  console.log(JSON.stringify(receipt.outcomes, null, 2));

  divider('RUNNING REAL runAnswerCoronerOnLocalOutcomes(...) FROM COMPILED dist/');
  const roundup = await runAnswerCoronerOnLocalOutcomes(receipt.outcomes, {
    onProgress: (msg) => console.log('[progress] ' + msg),
    // BP141 Yoke Task 4d: threading the receipt's own top-level run config into the card, exactly
    // as a real caller (index.ts's IPC handler, once wired) would.
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
        `correctable=${rec.correctable}  sealed=${rec.sealedLetter}  got=${rec.answeredLetter ?? 'null'}`,
      );
    }
  }

  divider('ASSERTIONS (mandatory breakdown: 1 right, 1 correctable wrong, 0 honest abstains, 2 no-response)');
  let allPass = true;
  function check(label, actual, expected) {
    const pass = actual === expected;
    console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${label}: expected ${expected}, got ${actual}`);
    if (!pass) allPass = false;
  }

  check('rightTotal', roundup.rightTotal, 1);
  check('wrongTotal', roundup.wrongTotal, 1);
  check('correctableWrongs', roundup.correctableWrongs, 1);
  check('abstainTotal', roundup.abstainTotal, 0);
  check('honestAbstains', roundup.honestAbstains, 0);
  check('noResponseTotal', roundup.noResponseTotal, 2);

  divider('ASSERTIONS (Task 4c -- no invented plow classification when plowTrace is empty)');
  const wrongRecord = (roundup.byClass['single-shot-wrong'] || [])[0];
  check('question_id 85 classified as single-shot-wrong (not plow-discordant)', !!wrongRecord, true);
  if (wrongRecord) {
    console.log('  wrong-row answerClass:', wrongRecord.answerClass, '(routeId=' + wrongRecord.routeId + ')');
  }
  const anyPlowDiscordant = !!(roundup.byClass['plow-discordant'] && roundup.byClass['plow-discordant'].length > 0);
  check('zero rows carry an invented plow-discordant class', anyPlowDiscordant, false);

  divider('ASSERTIONS (Task 4d -- card states run configuration from the receipt)');
  check('roundup.substrateEnabled', roundup.substrateEnabled, false);
  check('roundup.plowEnabled', roundup.plowEnabled, false);
  check('roundup.researchArmMode', roundup.researchArmMode, false);

  divider('SUMMARY');
  console.log('1 right / 1 correctable wrong / 0 honest abstains / 2 no-response:',
    (roundup.rightTotal === 1 && roundup.correctableWrongs === 1 && roundup.honestAbstains === 0 && roundup.noResponseTotal === 2)
      ? 'CONFIRMED' : 'MISMATCH');
  console.log('Card surfaces substrateEnabled/plowEnabled/researchArmMode:',
    (roundup.substrateEnabled === false && roundup.plowEnabled === false && roundup.researchArmMode === false)
      ? 'CONFIRMED' : 'MISMATCH');
  console.log('\nOVERALL: ' + (allPass ? 'ALL CHECKS PASS' : 'SOME CHECKS FAILED'));
  process.exitCode = allPass ? 0 : 1;
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exitCode = 1;
});
