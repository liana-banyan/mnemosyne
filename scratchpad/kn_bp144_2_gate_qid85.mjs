// KN-BP144-2 gate: run the REAL compiled dist against the REAL qid 85 question/options recovered
// from C:\Users\Administrator\Downloads\038mnemo_mesh_test_receipt_2026-08-03T21-28-38-365Z.json's
// companion corpus (resources/mmlu_pro_bundled/questions.jsonl, question_id 85). Not a tidied smoke
// test -- the option text below is the literal glued string from the corpus, byte for byte, and the
// verification lookup below is a REAL web search performed this session for the exact query the
// Founder issued in Excerpt 7 ("what is bias in statistics"), not a fabricated/paraphrased stand-in.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const chart = require('../dist/main/plow/plow_mc_elimination_chart.js');
const cascade = require('../dist/main/plow/plow_mc_elimination_cascade.js');

const stemText = 'Which of these statements correctly explains bias?';
const options = [
  { letter: 'A', text: 'It describes a process that results in a sample that does not represent the population.' },
  { letter: 'B', text: 'It describes a process that results in a sample that is too large or too small.' },
  { letter: 'C', text: 'It describes a process that uses a random sampling method.' },
  { letter: 'D', text: 'It describes a process that results in a sample that perfectly represents the population.' },
  { letter: 'E', text: 'It describes a sample that is not representative of the population.' },
  { letter: 'F', text: 'It describes a process that always results in accurate estimates.' },
  { letter: 'G', text: "It describes the influence of the researcher's personal beliefs on the outcome of the study." },
  { letter: 'H', text: 'It describes a lack of randomization in the sampling process.' },
  { letter: 'I', text: 'It describes a process where the sampling method has no influence on the outcome of the study.' },
  { letter: 'J', text: 'It describes a process that creates estimates that are too high on average or too low on average.' },
];
const CORRECT_KEY = 'E';

console.log('=== KN-BP144-2 qid 85 real gate run ===\n');

// --- Prior arms: Stage 1 (plow_mc_elimination_chart.ts, R1/R2/R3), real compiled code ---
const chartResult = chart.runEliminationChart(stemText, options);
console.log('--- Stage 1 (elimination_chart R1/R2/R3) ---');
for (const t of chartResult.trace) console.log('  ' + t);
console.log('  survivors after Stage 1:', chartResult.survivors.join(','));
console.log('  eliminationsByRule:', JSON.stringify(chartResult.eliminationsByRule));
console.log();

// --- Stage 2 (this ticket): register-resolution stage, real compiled code ---
// Real verification lookup, performed live this session via WebSearch for the exact query the
// Founder issued in Excerpt 7. Verbatim synthesis text (not paraphrased by this harness):
const REAL_VERIFICATION = {
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
  source: 'live web search performed this session, synthesized from en.wikipedia.org/wiki/Statistical_bias, ' +
    'statisticshowto.com/what-is-bias, statcan.gc.ca, en.wikipedia.org/wiki/Bias_of_an_estimator, ' +
    'encyclopediaofmath.org/wiki/Biased_estimator',
};

const stageResult = cascade.runRegisterResolutionStage(stemText, options, chartResult.survivors, REAL_VERIFICATION);
console.log('--- Stage 2 (register-resolution stage, KN-BP144-2) ---');
for (const t of stageResult.trace) console.log('  ' + t);
console.log();
console.log('applied:', stageResult.applied, ' abstained:', stageResult.abstained);
console.log('concept:', stageResult.concept);
console.log('registerCandidate:', JSON.stringify(stageResult.registerCandidate));
console.log('registerCounts:', JSON.stringify(stageResult.registerCounts));
console.log('derivedPredicateReferentTerms:', JSON.stringify(stageResult.derivedPredicateReferentTerms));
console.log('matches:', JSON.stringify(stageResult.matches, null, 2));
console.log('survivorsIn:', stageResult.survivorsIn.join(','));
console.log('survivorsOut:', stageResult.survivorsOut.join(','));
console.log();
console.log('CORRECT KEY:', CORRECT_KEY);
console.log('REACHES SINGLE CORRECT KEY:', stageResult.survivorsOut.length === 1 && stageResult.survivorsOut[0] === CORRECT_KEY);
console.log('CORRECT KEY STILL SURVIVING:', stageResult.survivorsOut.includes(CORRECT_KEY));
console.log('FINAL SURVIVOR SET:', JSON.stringify(stageResult.survivorsOut));

// --- Also run WITHOUT verification, to prove the mandatory-verification-abstain path fires ---
console.log('\n--- Control: same inputs, verification=null (must abstain) ---');
const noVerify = cascade.runRegisterResolutionStage(stemText, options, chartResult.survivors, null);
for (const t of noVerify.trace) console.log('  ' + t);
console.log('applied:', noVerify.applied, ' abstained:', noVerify.abstained, ' survivorsOut:', noVerify.survivorsOut.join(','));
