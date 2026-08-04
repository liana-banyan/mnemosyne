// KN-BP144-2 gate: negative control. qids 20, 27, 33, 59, 92, 118 resolve deterministically and the
// ticket requires confirming the cascade never reaches them. Extracted as its own dedicated script
// (rather than only living inside the false-negative sweep) so the negative-control result is a
// clean, standalone, re-runnable artifact.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);

const chart = require('../dist/main/plow/plow_mc_elimination_chart.js');
const cascade = require('../dist/main/plow/plow_mc_elimination_cascade.js');
const corpus = JSON.parse(fs.readFileSync('kn_bp144_2_run038_full_corpus.json', 'utf8'));

const NEGATIVE_CONTROL_QIDS = [20, 27, 33, 59, 92, 118];
const LETTERS = 'ABCDEFGHIJ';

console.log('=== KN-BP144-2 negative control: qids 20, 27, 33, 59, 92, 118 ===\n');
let allNeverReached = true;
for (const qid of NEGATIVE_CONTROL_QIDS) {
  const rec = corpus[String(qid)];
  const options = rec.options.map((text, i) => ({ letter: LETTERS[i], text }));
  const stemText = rec.question;

  const chartResult = chart.runEliminationChart(stemText, options);
  const full = cascade.runRegisterResolutionStage(stemText, options, options.map(o => o.letter), null);
  const chained = cascade.runRegisterResolutionStage(stemText, options, chartResult.survivors, null);

  const neverReached = full.applied === false && chained.applied === false;
  if (!neverReached) allNeverReached = false;

  console.log(
    `qid ${qid}: stem="${stemText.slice(0, 70)}..." ` +
    `full-option-set: applied=${full.applied} | after-Stage1(${chartResult.survivors.join(',')}): applied=${chained.applied} ` +
    `=> NEVER REACHED: ${neverReached}`,
  );
}
console.log(`\nALL SIX NEGATIVE-CONTROL QUESTIONS NEVER REACHED BY THE NEW STAGE: ${allNeverReached}`);
