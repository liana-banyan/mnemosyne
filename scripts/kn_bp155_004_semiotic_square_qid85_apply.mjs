#!/usr/bin/env node
// kn_bp155_004_semiotic_square_qid85_apply.mjs -- D-BP155-004/BISHOP-SEG/S4/seg-semiotic-square
//
// APPLIES SemioticSquare:1 (semiotic_square_step.ts, this dispatch) to qid 85, the dispatch's own
// target. Runs it at least 4 times and reports EVERY run verbatim (never a single-run receipt --
// the noise floor the dispatch itself names, 44% average pairwise drift measured on three prior
// identical zero-change runs of a DIFFERENT, browser-driven multi-authority pipeline).
//
// CANNOT make a live browser call outside the Electron app + CDP -- same boundary
// scripts/test_survey_wiring_qid85_bp150_016.mjs's own header states for this exact question. This
// script replays REAL captured text instead of fabricating anything:
//   - The SAMPLING fold and ESTIMATOR fold are copied VERBATIM from
//     scripts/test_survey_wiring_qid85_bp150_016.mjs, which itself cites them as copied verbatim
//     from LIANA_RUN_qid85_2026-08-09T03-14-02-291Z.json, a real prior receipt.
//   - gemmaExtract() (comparative_cascade.ts, reused unchanged) is NOT mocked -- it hits the real
//     local Ollama at OLLAMA_API_BASE (default 127.0.0.1:11434), model gemma4:12b, temperature 0,
//     exactly as production does. Reachability is checked and reported plainly, per this ticket's
//     instruction not to fake it if unreachable.
//
// STAGE 1 (owned evidence / THE MORTGAGE) is expected to find nothing -- this step's own query text
// is novel (never asked before in any prior acquisition on disk), so gatherMortgageCandidates()
// will not match, and no ownedPassages() is wired here. STAGE 2 (the conversational authority) is
// therefore where the real work happens; the fake ctx.askConversationalAuthority below returns the
// REAL captured passages, and the REAL local model extracts from them.
//
//   node scripts/kn_bp155_004_semiotic_square_qid85_apply.mjs

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const OLLAMA_API_BASE = process.env.OLLAMA_API_BASE ?? 'http://127.0.0.1:11434';

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

// ── THE TWO REAL CAPTURED FOLDS, VERBATIM FROM scripts/test_survey_wiring_qid85_bp150_016.mjs ──
const SAMPLING_FOLD_BOX =
  'A sampling method is called biased if it systematically favors some outcomes over others. '
  + 'Sampling bias is sometimes called ascertainment bias (especially in biological fields) or systematic bias.';
const SAMPLING_FOLD_ORGANIC = {
  title: 'Bias describes a process that results in a sample that does not represent the population.',
  url: 'https://homework.study.com/explanation/bias-describes-a-process-that-results-in-a-sample-that-does-not-represent-the-population-true-or-false.html',
  snippet:
    'Bias describes a process that results in a sample that does not represent the population. True or False? '
    + '1 answer · Top answer: The given statement is true: bias describes a process that results in a sample that does not re',
};
const ESTIMATOR_FOLD_ORGANIC = {
  title: 'Definition, Selection Bias & Survivorship Bias',
  url: 'https://www.statisticshowto.com/what-is-bias',
  snippet:
    "More specifically, bias is the tendency of a statistic to overestimate or underestimate the population parameter you're trying to measure.",
};

async function fakeAskGoogle(query) {
  return {
    snippet: SAMPLING_FOLD_BOX,
    sourceUrl: SAMPLING_FOLD_ORGANIC.url,
    authority: 'user_google',
    selectorUsed: 'test-fixture',
    results: [SAMPLING_FOLD_ORGANIC, ESTIMATOR_FOLD_ORGANIC],
  };
}

// STAGE 2's own text: the SAMPLING fold's organic TITLE is, itself, option A's own wording almost
// verbatim ("Bias describes a process that results in a sample that does not represent the
// population.") -- the SAME real captured evidence this estate already has on file for qid 85, not
// invented for this script. Combined with the box text so the passage carries both the general
// definition and the specific negated-pole statement.
const REPLAYED_PASSAGE = `${SAMPLING_FOLD_BOX} ${SAMPLING_FOLD_ORGANIC.title} ${ESTIMATOR_FOLD_ORGANIC.snippet}`;

async function fakeAskConversationalAuthority(query, mcOptions) {
  return {
    ok: true,
    text: REPLAYED_PASSAGE,
    citations: [SAMPLING_FOLD_ORGANIC.url],
    via: 'conversational:user_gemini(replayed-real-capture)',
    authority: 'user_gemini',
  };
}

async function main() {
  console.log('== D-BP155-004: SemioticSquare:1 applied to qid 85, real corpus text ==\n');

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
    console.log('*** OLLAMA / gemma4:12b NOT REACHABLE -- reporting this plainly, not faking extraction. ***\n');
  }

  const { runSemioticSquareStep } = require('../dist/main/liana_cycle/library/semiotic_square_step.js');

  const input = { qid: 85, question: QUESTION, options: OPTIONS, correctAnswer: KEY };
  const RUNS = 4;
  const outcomes = [];
  for (let n = 1; n <= RUNS; n += 1) {
    const transcript = [];
    const emit = (ev) => transcript.push(ev);
    const ctx = { askGoogle: fakeAskGoogle, askConversationalAuthority: fakeAskConversationalAuthority, emit };
    const t0 = Date.now();
    // eslint-disable-next-line no-await-in-loop -- each run must be a genuinely separate,
    // sequential invocation (the dispatch's own instruction: run at least 4 times, report every
    // run), not a parallel fan-out that could share state.
    const { result, summary } = await runSemioticSquareStep(input, ctx);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    outcomes.push({ n, elapsed, result, summary });
    console.log(`── RUN ${n}/${RUNS} (${elapsed}s) ──`);
    console.log(summary);
    console.log('');
  }

  console.log('── CROSS-RUN COMPARISON (never citing a single run) ──');
  for (const o of outcomes) {
    console.log(`RUN ${o.n}: ok=${o.result.ok} confirmedPole=${o.result.confirmedPole} `
      + `eliminated=[${o.result.eliminatedByContradiction.map((m) => m.letter).join(',')}] `
      + `axisStem=${o.result.axisStem}`);
  }
  const allIdentical = outcomes.every((o) => JSON.stringify(o.result.eliminatedByContradiction.map((m) => m.letter))
    === JSON.stringify(outcomes[0].result.eliminatedByContradiction.map((m) => m.letter))
    && o.result.confirmedPole === outcomes[0].result.confirmedPole);
  console.log(`\nAll ${RUNS} runs agree on confirmedPole and eliminated set: ${allIdentical}`);

  const eliminatedLetters = outcomes[0].result.eliminatedByContradiction.map((m) => m.letter);
  const survivorsAfterSquare = Object.keys(OPTIONS).filter((L) => !eliminatedLetters.includes(L));
  console.log(`\nOptions eliminated by THE SEMIOTIC SQUARE'S own contradiction relation: [${eliminatedLetters.join(', ')}]`);
  console.log(`Options NOT eliminated by the square (S1 + UNSTATED): [${survivorsAfterSquare.join(', ')}]`);
  console.log(`Correct key: ${KEY}`);
  console.log(`Did the square resolve qid 85 to a UNIQUE verdict on its own? ${survivorsAfterSquare.length === 1 ? 'YES -- ' + survivorsAfterSquare[0] : 'NO -- ' + survivorsAfterSquare.length + ' options remain (' + survivorsAfterSquare.join(', ') + '), reported plainly, not softened'}`);
  console.log(`Is the correct key among the square's own survivors? ${survivorsAfterSquare.includes(KEY) ? 'YES (E was not eliminated)' : 'NO -- the square eliminated the correct answer, which would be a real defect'}`);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});
