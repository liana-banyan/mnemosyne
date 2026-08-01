// verify_kn_bp141_3_wiring_advisory_signals.js -- KN-BP141-3 wiring commit verification.
//
// Confirms Stage 0 (vetQuestion) and Stage 1 (runEliminationChart) are actually reachable through
// the real production entry point, resolveDeterministicComputeOverride(), via its new
// `advisorySignals` return field -- not just directly imported and called in isolation (that was
// already covered by Stage 0/Stage 1's own smoketest_stage0.js/smoketest_stage1.js). This is the
// wiring-specific check: does the ACTUAL wired call path expose the same real result.
//
// Uses math/source_id 8230 (the bias-definition question) with a fabricated `ensembleChosenLetter`
// ('Z', not a real option letter) so any behavior change in `finalLetter`/`overrideFired` would be
// obvious -- this run expects the compute tiers to find nothing computable in this
// definitional-not-arithmetic question and fall through to `finalLetter === 'Z'`, proving the
// Stage 0/1 wiring is purely additive and never touches the override pipeline.
'use strict';

const path = require('path');
const fs = require('fs');

const DIST_ANSWERER = path.join(__dirname, '..', 'dist', 'main', 'plow', 'plow_mc_answerer.js');
const { resolveDeterministicComputeOverride } = require(DIST_ANSWERER);

const DATASET_ROOT = 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\lb-reproducibility-pack\\datasets\\mmlu_pro_per_domain';

function letterFromIndex(i) {
  return String.fromCharCode(65 + i);
}

function divider(title) {
  console.log('\n' + '='.repeat(78));
  console.log(title);
  console.log('='.repeat(78));
}

async function main() {
  divider('LOADING REAL DATASET RECORD: math/source_id 8230');
  const arr = JSON.parse(fs.readFileSync(path.join(DATASET_ROOT, 'math', 'questions.json'), 'utf8'));
  const rec = arr.find((q) => q.source_id === '8230');
  if (!rec) {
    console.error('FATAL: could not find source_id 8230 in math/questions.json');
    process.exit(1);
  }
  const mcOptions = rec.options.map((text, i) => ({ letter: letterFromIndex(i), text }));
  console.log('Question:', rec.question);
  console.log('Options:', mcOptions.map((o) => `${o.letter}) ${o.text}`).join('\n'));

  divider('CALLING THE REAL WIRED resolveDeterministicComputeOverride()');
  const decision = await resolveDeterministicComputeOverride(
    rec.question,
    mcOptions,
    'Z', // fabricated sentinel letter, not a real option -- proves the override pipeline is untouched
    [], // reasoningTexts
    {}, // computeOpts -- no ollama/wolfram configured, tiers needing them will honestly abstain
    [], // independentSources
  );
  console.log('\nRaw decision object:', JSON.stringify(decision, null, 2));

  divider('SUMMARY (real result, no tidying)');
  console.log('finalLetter:', decision.finalLetter, '(expected "Z" -- sentinel unchanged, proving Stage 0/1 wiring is purely additive)');
  console.log('overrideFired:', decision.overrideFired, '(expected false)');
  console.log('deterministicOverride:', decision.deterministicOverride, '(expected null)');
  console.log('\nadvisorySignals.vettingFlags:', JSON.stringify(decision.advisorySignals.vettingFlags, null, 2));
  console.log('\nadvisorySignals.eliminationChart.survivors:', decision.advisorySignals.eliminationChart.survivors);
  console.log('advisorySignals.eliminationChart.eliminationsByRule:', JSON.stringify(decision.advisorySignals.eliminationChart.eliminationsByRule));

  const survivorsOk = JSON.stringify([...decision.advisorySignals.eliminationChart.survivors].sort()) === JSON.stringify(['A', 'E', 'J']);
  const registerConflictOk =
    decision.advisorySignals.vettingFlags.registerConflict &&
    decision.advisorySignals.vettingFlags.registerConflict.intro === 'E' &&
    decision.advisorySignals.vettingFlags.registerConflict.expert === 'J';
  const pipelineUntouched = decision.finalLetter === 'Z' && decision.overrideFired === false && decision.deterministicOverride === null;

  console.log('\nCHECK survivors === {A,E,J} via the wired path:', survivorsOk ? 'PASS' : 'FAIL');
  console.log('CHECK registerConflict {intro:E, expert:J} via the wired path:', registerConflictOk ? 'PASS' : 'FAIL');
  console.log('CHECK override pipeline untouched (finalLetter stayed at sentinel "Z"):', pipelineUntouched ? 'PASS' : 'FAIL');

  if (!survivorsOk || !registerConflictOk || !pipelineUntouched) {
    console.error('\nFATAL: wiring verification FAILED -- see checks above.');
    process.exit(1);
  }
  console.log('\nAll wiring checks PASS.');
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
