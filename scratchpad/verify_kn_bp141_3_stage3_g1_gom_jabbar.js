// verify_kn_bp141_3_stage3_g1_gom_jabbar.js -- KN-BP141-3 Stage 3, verification requirement (e).
//
// "Stage 3 G1 end to end on qid 98 using SymPy for the arithmetic (real factors, real
// independently-sourced check value, real multiplication via SymPy, not hand-computed)."
//
// qid 98 (other/source_id 5723) asks which world region is NOT one of the world's most densely
// populated -- its own subject matter is regional population density, so this G1 demonstration
// reconciles THREE independently-sourced real-world facts about South America (one of qid 98's own
// options, letter A) using exactly the density x area = population shape the ticket's own G1
// description worked through:
//   FACTOR A (density):        21.4 people/km^2  -- commonly cited ~2015-era estimate for South
//                               America (this same figure is already cited, independently of this
//                               script, in this repo's Stage 0 vetting empirical-basis comment for
//                               V2 scaleMismatch on this exact question).
//   FACTOR B (land area):      17,840,000 km^2   -- standard published land-area figure for the
//                               South American continent.
//   INDEPENDENT CHECK VALUE:   382,000,000 people -- a commonly cited ~2015-era South American
//                               population estimate, sourced from demographic figures, NOT derived
//                               from multiplying the two factors above by this script or anyone
//                               else in this repo.
// Real SymPy subprocess multiplication (via the actual compiled dist's runSympyMultiplication),
// never hand-computed in this script or in JavaScript anywhere in the reconciliation path itself.
//
// NOTE on the answer-key discipline: this script reads other/questions.json's correct_answer field
// ONLY to print qid 98's own context for the report below (local console output, never sent
// anywhere). No external source, model, or API is queried anywhere in this script -- G1's own
// mechanism here is a fully local SymPy subprocess call, so the "never leak correct_answer into an
// external query" prohibition does not apply to this particular verification (there is no external
// query at all), but the correct_answer value is still never used to construct the reconciliation
// itself -- the density/area/population figures above are real-world facts about South America,
// independent of whichever letter this MC question's own key happens to be.
'use strict';

const path = require('path');
const fs = require('fs');

const DIST_GOM_JABBAR = path.join(__dirname, '..', 'dist', 'main', 'plow', 'plow_gom_jabbar.js');
const { reconcileDerivedQuantity, runSympyMultiplication } = require(DIST_GOM_JABBAR);

const DATASET_ROOT = 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\lb-reproducibility-pack\\datasets\\mmlu_pro_per_domain';

function divider(title) {
  console.log('\n' + '='.repeat(78));
  console.log(title);
  console.log('='.repeat(78));
}

async function main() {
  divider('LOADING REAL DATASET RECORD FOR CONTEXT: other/source_id 5723 (qid 98)');
  const arr = JSON.parse(fs.readFileSync(path.join(DATASET_ROOT, 'other', 'questions.json'), 'utf8'));
  const rec = arr.find((q) => q.source_id === '5723');
  if (!rec) {
    console.error('FATAL: could not find source_id 5723 in other/questions.json');
    process.exit(1);
  }
  console.log('Question:', rec.question);
  console.log('Options:', rec.options.join(' | '));
  console.log('(correct_answer read locally for report context only, never sent to any external');
  console.log(' source in this script -- this script makes zero external/model/API calls):');
  console.log('  correct_answer =', rec.correct_answer);

  divider('G2 SANITY CHECK: raw SymPy subprocess call, independent of G1');
  const sanity = await runSympyMultiplication(6, 7);
  console.log('runSympyMultiplication(6, 7) ->', JSON.stringify(sanity));
  if (!sanity || sanity.value !== 42) {
    console.error('FATAL: SymPy sanity check failed -- expected 42, got', sanity);
    process.exit(1);
  }
  console.log('SymPy subprocess bridge confirmed live on this machine (python + sympy).');

  divider('G1 DERIVED-QUANTITY RECONCILIATION: South America (qid 98 option A)');
  const factorA = { label: 'density (people/km^2)', value: 21.4 };
  const factorB = { label: 'land area (km^2)', value: 17840000 };
  const independentCheckValue = 382000000;
  console.log('Factor A (density):', factorA.value, factorA.label);
  console.log('Factor B (area):   ', factorB.value, factorB.label);
  console.log('Independent check value (population, sourced separately):', independentCheckValue);

  const result = await reconcileDerivedQuantity(factorA, factorB, independentCheckValue, 0.05);
  console.log('\nRaw G1 result object:', JSON.stringify(result, null, 2));
  console.log('\n' + result.trace);

  divider('G1 NEGATIVE CONTROL: a fabricated factor should NOT reconcile');
  const fabricatedFactorA = { label: 'density (FABRICATED, people/km^2)', value: 21.4 };
  const fabricatedFactorB = { label: 'land area (FABRICATED, km^2)', value: 9000000 }; // wrong area
  const negativeResult = await reconcileDerivedQuantity(
    fabricatedFactorA,
    fabricatedFactorB,
    independentCheckValue,
    0.05,
  );
  console.log('Raw negative-control result object:', JSON.stringify(negativeResult, null, 2));
  console.log('\n' + negativeResult.trace);

  divider('SUMMARY (real result, no tidying)');
  console.log('Real-facts reconciliation (South America):', result.consistent ? 'PASS' : 'FAIL');
  console.log('Fabricated-factor negative control:       ', negativeResult.consistent ? 'PASS (unexpected -- gate too loose)' : 'FAIL (expected -- gate correctly rejects a mismatched factor)');
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
