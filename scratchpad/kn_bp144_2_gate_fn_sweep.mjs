// KN-BP144-2 gate: false-negative sweep. Runs the new register-resolution stage against every one
// of the 20 real questions in run 038 (the 6 failures AND the 14 already-correct ones), using the
// REAL corpus option text for each (resources/mmlu_pro_bundled/questions.jsonl). Reports every case
// where the stage's survivorsOut drops the corpus-verified correct letter. Also chains after the
// real Stage 1 (elimination_chart R1/R2/R3) survivors, to report the end-to-end (Stage1+Stage2)
// false-negative rate as well as this stage's own standalone rate (run against the FULL, unfiltered
// 10-option set, which is the more stringent/adversarial test since it gives the stage maximum
// exposure to every option, not just what Stage 1 already narrowed).
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);

const chart = require('../dist/main/plow/plow_mc_elimination_chart.js');
const cascade = require('../dist/main/plow/plow_mc_elimination_cascade.js');

const corpus = JSON.parse(fs.readFileSync('kn_bp144_2_run038_full_corpus.json', 'utf8'));
const receipt = JSON.parse(fs.readFileSync('C:/Users/Administrator/Downloads/038mnemo_mesh_test_receipt_2026-08-03T21-28-38-365Z.json', 'utf8'));

const LETTERS = 'ABCDEFGHIJ';
function toOptions(rec) {
  return rec.options.map((text, i) => ({ letter: LETTERS[i], text }));
}

// The one real verification this session actually performed (bias/statistics). Every other concept
// (there are none among run 038's 20 questions besides qid 85's "bias") would need its own real
// lookup before this stage could ever act on it -- and since CONCEPT_REGISTER_SIGNALS only curates
// "bias" today, every other question abstains at the concept-gate before verification even matters.
const REAL_VERIFICATION_BIAS = {
  query: 'what is bias in statistics',
  definitionText:
    "In statistics, bias is a systematic tendency for a statistical estimator to produce results that " +
    "differ from the true value of the population parameter. It occurs when data collection, " +
    "measurement, or analysis methods cause estimates to skew consistently in one direction, such as " +
    "always overestimating or underestimating a value. Mathematically, bias is defined as the " +
    "difference between the estimator's expected value and the true parameter value. Unlike random " +
    "sampling error, bias cannot be reduced simply by increasing the sample size, as it is an inherent " +
    "property of the estimation procedure.",
  registerClaimed: 'statistics',
  source: 'live web search performed this session (KN-BP144-2)',
};

const rows = [];
let fn = 0;
let total = 0;

for (const outcome of receipt.outcomes) {
  const qid = outcome.question_id;
  const rec = corpus[String(qid)];
  if (!rec) { console.error('MISSING CORPUS RECORD for qid', qid); continue; }
  const options = toOptions(rec);
  const correctLetter = rec.answer; // corpus-verified key, ground truth -- not the receipt's parsed/voted letter
  const stemText = rec.question;

  // Standalone stress test: full unfiltered option set as "survivors" (max exposure).
  const verification = /\bbias\b/i.test(stemText) ? REAL_VERIFICATION_BIAS : null;
  const standalone = cascade.runRegisterResolutionStage(stemText, options, options.map(o => o.letter), verification);

  // End-to-end: chained after the real Stage 1 (R1/R2/R3) survivors.
  const chartResult = chart.runEliminationChart(stemText, options);
  const chained = cascade.runRegisterResolutionStage(stemText, options, chartResult.survivors, verification);

  total++;
  const standaloneDropped = !standalone.survivorsOut.includes(correctLetter);
  const chainedDropped = !chained.survivorsOut.includes(correctLetter);
  if (standaloneDropped || chainedDropped) fn++;

  rows.push({
    qid,
    stemPreview: stemText.slice(0, 60),
    correctLetter,
    stage1Survivors: chartResult.survivors.join(','),
    standaloneApplied: standalone.applied,
    standaloneAbstained: standalone.abstained,
    standaloneSurvivorsOut: standalone.survivorsOut.join(','),
    standaloneDroppedCorrectKey: standaloneDropped,
    chainedApplied: chained.applied,
    chainedAbstained: chained.abstained,
    chainedSurvivorsOut: chained.survivorsOut.join(','),
    chainedDroppedCorrectKey: chainedDropped,
  });
}

console.log('=== KN-BP144-2 false-negative sweep, all 20 run-038 questions ===\n');
for (const r of rows) {
  console.log(
    `qid ${r.qid} [${r.stemPreview}...] correct=${r.correctLetter} ` +
    `stage1Survivors=[${r.stage1Survivors}] ` +
    `standalone(applied=${r.standaloneApplied},abstained=${r.standaloneAbstained},out=[${r.standaloneSurvivorsOut}],DROPPED=${r.standaloneDroppedCorrectKey}) ` +
    `chained(applied=${r.chainedApplied},abstained=${r.chainedAbstained},out=[${r.chainedSurvivorsOut}],DROPPED=${r.chainedDroppedCorrectKey})`,
  );
}
console.log(`\nTOTAL QUESTIONS: ${total}`);
console.log(`FALSE-NEGATIVE COUNT (correct key dropped by standalone OR chained run): ${fn}`);
console.log(`FALSE-NEGATIVE RATE: ${((fn / total) * 100).toFixed(1)}%`);
console.log(`BASELINE (naive-elimination, measured, per ticket): 12.3%`);
console.log(`NET LOSS vs baseline: ${fn / total > 0.123 ? 'YES -- EXCEEDS BASELINE, NET LOSS' : 'NO -- at or below baseline'}`);

fs.writeFileSync('kn_bp144_2_fn_sweep_rows.json', JSON.stringify(rows, null, 2));
