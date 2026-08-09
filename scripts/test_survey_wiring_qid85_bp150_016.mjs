#!/usr/bin/env node
// test_survey_wiring_qid85_bp150_016.mjs -- D-BP150-016/BISHOP/seg-twofold
//
// PROVES: definitional_cascade.ts's D2-D4 now ENUMERATE denotations via surveyAsk() (E-SURVEY-ASK)
// instead of collapsing to one, on the exact case that captured the defect live -- qid 85, "bias".
//
// CANNOT make live Google calls outside the Electron app + CDP (this ticket's own instruction).
// Instead this fake AskGoogleFn replays the REAL captured text from the receipt that caught the
// defect:
//   C:\Users\Administrator\Documents\LianaBanyanPlatform\HARDWIRE\LEDGER\LIANA_RUNS\
//     LIANA_RUN_qid85_2026-08-09T03-14-02-291Z.json
// -- both folds, verbatim, byte-for-byte copied out of that receipt's own transcript. It routes
// on the exact query text surveyAsk() sends (defineQuery/otherMeaningsQuery in survey_ask.ts),
// so the test is exercising the REAL production code path, not a reimplementation of it.
//
// gemmaExtract() (comparative_cascade.ts, reused unchanged by survey_ask.ts) is NOT mocked -- it
// hits the real local Ollama at OLLAMA_API_BASE (default 127.0.0.1:11434), model gemma4:12b,
// exactly as production does. Reachability is checked and reported plainly before the run, per
// this ticket's instruction not to fake it if unreachable.
//
//   node scripts\test_survey_wiring_qid85_bp150_016.mjs

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const OLLAMA_API_BASE = process.env.OLLAMA_API_BASE ?? 'http://127.0.0.1:11434';

// ── qid 85, the real ten options and key, verbatim from the receipt ──────────────────────────
const QUESTION = 'Which of these statements correctly explains bias?';
const OPTIONS = {
  A: 'It describes a process that results in a sample that does not represent the population.',
  B: 'It describes a process that results in a sample that is too large or too small.',
  C: 'It describes a process that uses a random sampling method.',
  D: 'It describes a process that results in a sample that perfectly represents the population.',
  E: 'It describes a sample that is not representative of the population.',
  F: 'It describes a process that always results in accurate estimates.',
  G: "It describes the influence of the researcher's personal beliefs on the outcome of the study.",
  H: 'It describes a lack of randomization in the sampling process.',
  I: 'It describes a process where the sampling method has no influence on the outcome of the study.',
  J: 'It describes a process that creates estimates that are too high on average or too low on average.',
};
const KEY = 'E';

// ── THE TWO FOLDS, VERBATIM FROM THE RECEIPT, 24 SECONDS APART IN THE REAL RUN ───────────────
// SAMPLING fold -- receipt ts 03:13:38.725Z, the Stage-1 "ask the inverse" Google box+organic(5).
const SAMPLING_FOLD_BOX =
  'A sampling method is called biased if it systematically favors some outcomes over others. ' +
  'Sampling bias is sometimes called ascertainment bias (especially in biological fields) or systematic bias.';
const SAMPLING_FOLD_ORGANIC = {
  title: 'Bias describes a process that results in a sample that does not represent the population.',
  url: 'https://homework.study.com/explanation/bias-describes-a-process-that-results-in-a-sample-that-does-not-represent-the-population-true-or-false.html',
  snippet:
    'Bias describes a process that results in a sample that does not represent the population. True or False? '
    + '1 answer \u00b7 Top answer: The given statement is true: bias describes a process that results in a sample that does not re',
};
// ESTIMATOR fold -- receipt ts 03:14:00.432Z, the D3 "what is bias in statistics" Statistics How To result.
const ESTIMATOR_FOLD_ORGANIC = {
  title: 'Definition, Selection Bias & Survivorship Bias',
  url: 'https://www.statisticshowto.com/what-is-bias',
  snippet:
    "More specifically, bias is the tendency of a statistic to overestimate or underestimate the population parameter you're trying to measure.",
};

// ── fake AskGoogleFn, routed on the REAL query text surveyAsk()/the cascade send ─────────────
// surveyAsk() (elements/survey_ask.ts) sends exactly two queries for term "bias":
//   defineQuery('bias')        -> "define bias"
//   otherMeaningsQuery('bias') -> "other meanings of bias"
// The cascade's own Stage 1 sends the full inverse question + options list.
let callLog = [];
async function fakeAskGoogle(query) {
  callLog.push(query);
  if (query === 'define bias') {
    // SAMPLING fold surfaces here -- this is the query the real run's box+organic(5) answered at
    // 03:13:38.725Z when it fetched (and then discarded) the sampling definition.
    return {
      snippet: SAMPLING_FOLD_BOX,
      sourceUrl: SAMPLING_FOLD_ORGANIC.url,
      authority: 'user_google',
      selectorUsed: 'test-fixture',
      results: [SAMPLING_FOLD_ORGANIC],
    };
  }
  if (query === 'other meanings of bias') {
    // ESTIMATOR fold surfaces here -- the sense the real run silently carried forward instead.
    return {
      snippet: '',
      sourceUrl: ESTIMATOR_FOLD_ORGANIC.url,
      authority: 'user_google',
      selectorUsed: 'test-fixture',
      results: [ESTIMATOR_FOLD_ORGANIC],
    };
  }
  // Stage 1 (ask the inverse) and anything else -- return the real captured box+organic verbatim
  // so the unchanged shared code (comparative_cascade.ts, untouched by this ticket) behaves as
  // close to the real qid 85 run as a replay can get.
  return {
    snippet: SAMPLING_FOLD_BOX,
    sourceUrl: SAMPLING_FOLD_ORGANIC.url,
    authority: 'user_google',
    selectorUsed: 'test-fixture',
    results: [SAMPLING_FOLD_ORGANIC, ESTIMATOR_FOLD_ORGANIC],
  };
}

// ── transcript capture ────────────────────────────────────────────────────────────────────────
const transcript = [];
function emit(ev) {
  transcript.push(ev);
  const tag = { header: '===', stage: '->', fact: '+', note: ' ', result: '###', error: '!!!' }[ev.kind] || '';
  console.log(`${tag} ${ev.text}`);
}

async function main() {
  console.log('── D-BP150-016 wiring test: qid 85, real captured two-fold text, replayed ──\n');

  // Ollama reachability -- checked plainly, not faked.
  let ollamaReachable = false;
  try {
    const r = await fetch(`${OLLAMA_API_BASE}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (r.ok) {
      const j = await r.json();
      const names = (j.models || []).map((m) => m.name);
      ollamaReachable = names.includes('gemma4:12b');
      console.log(`Ollama at ${OLLAMA_API_BASE}: reachable, gemma4:12b ${ollamaReachable ? 'present' : 'ABSENT (models: ' + names.join(', ') + ')'}\n`);
    } else {
      console.log(`Ollama at ${OLLAMA_API_BASE}: responded HTTP ${r.status}, treating as unreachable\n`);
    }
  } catch (e) {
    console.log(`Ollama at ${OLLAMA_API_BASE}: UNREACHABLE (${e.message}) -- gemmaExtract() calls below will honestly return null, not be faked\n`);
  }
  if (!ollamaReachable) {
    console.log('*** OLLAMA / gemma4:12b NOT REACHABLE -- reporting this plainly per the ticket instruction, not faking extraction. ***\n');
  }

  const { definitionalCascadeMethod } = require('../dist/main/liana_cycle/methods/definitional_cascade.js');

  const input = { qid: 85, question: QUESTION, options: OPTIONS, correctAnswer: KEY };
  const ctx = { askGoogle: fakeAskGoogle, emit };

  const t0 = Date.now();
  const outcome = await definitionalCascadeMethod.run(input, ctx);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`\n── OUTCOME (${elapsed}s, ${callLog.length} fake Google calls) ──`);
  console.log(JSON.stringify(outcome, null, 2));

  console.log('\n── ASSERTIONS ──');
  const checks = [];
  checks.push(['abstain === true (qid 85 must still abstain, not answer)', outcome.abstain === true]);
  checks.push(['verdict === null (must not have picked J or anything else)', outcome.verdict === null]);
  checks.push(['basis contains the SAMPLING fold sentence verbatim',
    outcome.basis.includes('A sampling method is called biased if it systematically favors some outcomes over others')]);
  checks.push(['basis contains the ESTIMATOR fold sentence verbatim',
    outcome.basis.includes("bias is the tendency of a statistic to overestimate or underestimate the population parameter you're trying to measure")]);
  checks.push(['basis mentions E-SURVEY-ASK (not the old D3 register-guess wording)',
    outcome.basis.includes('E-SURVEY-ASK')]);
  checks.push(['basis does NOT contain the old single "established register" collapse wording',
    !outcome.basis.includes('established register')]);

  let allPass = true;
  for (const [label, pass] of checks) {
    console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${label}`);
    if (!pass) allPass = false;
  }

  console.log(`\nBASIS STRING VERBATIM:\n${outcome.basis}\n`);
  console.log(allPass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED');
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});
