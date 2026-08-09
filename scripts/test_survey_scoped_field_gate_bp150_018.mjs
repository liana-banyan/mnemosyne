#!/usr/bin/env node
// test_survey_scoped_field_gate_bp150_018.mjs -- D-BP150-018/BISHOP/seg-scopedsurvey
//
// PROVES/MEASURES: after this ticket's fix, does qid 85's own survey surface a statistics-register
// denotation -- specifically the SAMPLING fold ("A sampling method is called biased if it
// systematically favors some outcomes over others")? BEFORE this ticket: 2 statistics denotations
// (the old D2-D4 collapse). AFTER D-BP150-016/017 but BEFORE this ticket: 0 (the regression this
// ticket exists to fix). This script measures what it is now.
//
// CANNOT make live Google calls through the app's own Electron+CDP bridge (this ticket's own
// instruction). This fake AskGoogleFn instead replays REAL captured text:
//   - Stage 1's box+organic(5) -- byte-for-byte from
//       LIANA_RUN_qid85_2026-08-09T03-14-02-291Z.json (BEFORE receipt), same content in the AFTER
//       receipt (Stage 1 is untouched by this ticket).
//   - "define bias" / "other meanings of bias" / "what field is bias in" / "what subject or field
//     does bias belong to" -- these ran in production before (both receipts show them), and their
//     RESULT TEXT was re-captured live via a real Google search (this session, ordinary web
//     browser, not the app's CDP bridge) because neither receipt's transcript prints the full
//     block text for these queries under the CURRENT code (survey_ask.ts's fact() line only logs
//     a block COUNT, not content -- only the BEFORE receipt's now-superseded D2 code printed full
//     text, and only for "define bias"). Where the live fetch differs slightly from a receipt's
//     block count (Google's result set drifts over time), that is disclosed below at each query,
//     not silently smoothed over.
//   - "what field or subject studies process results sample population sampling estimates
//     influence method" -- THIS QUERY NEVER RAN IN PRODUCTION BEFORE THIS TICKET (it is what FIX
//     A adds). There is no receipt to replay. Its real captured text is a live Google fetch taken
//     this session for the EXACT query string field_gate.ts's new deriveOptionVocabWords() +
//     fieldQueries() produce for qid 85's real option set (verified separately by running
//     findCatalystWords() against the real qid 85 options before writing this fixture -- see this
//     ticket's return for that derivation).
//
// EXCLUDED, ANSWER-KEY CONTAMINATION: the qid 85 receipt's Stage-1 organic block from
// crackap.com reproduces option J verbatim ("It describes a process that creates estimates that
// are too high on average or too low on average.") inside an AP-Statistics answer-key page. This
// script INCLUDES that block in the fake Stage-1 response (so the contamination-filter this
// ticket adds in definitional_cascade.ts is actually exercised, not just assumed) and asserts
// below that it gets excluded from Survey's reused material, not that it was never fetched.
//
// gemmaExtract() (comparative_cascade.ts, reused unchanged) is NOT mocked -- it hits the real
// local Ollama at OLLAMA_API_BASE (default 127.0.0.1:11434), model gemma4:12b, exactly as
// production does. Reachability is checked and reported plainly before the run.
//
//   node scripts\test_survey_scoped_field_gate_bp150_018.mjs

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const OLLAMA_API_BASE = process.env.OLLAMA_API_BASE ?? 'http://127.0.0.1:11434';

// ── qid 85, the real ten options and key, verbatim from both receipts ────────────────────────
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

// ── STAGE 1 -- box + 5 organic, byte-for-byte from LIANA_RUN_qid85_2026-08-09T03-14-02-291Z.json,
// INCLUDING the crackap.com block (answer-key contamination, deliberately included here so the
// new contamination filter is actually exercised) ────────────────────────────────────────────
const STAGE1_BOX =
  'A sampling method is called biased if it systematically favors some outcomes over others. '
  + 'Sampling bias is sometimes called ascertainment bias (especially in biological fields) or systematic bias.';
const STAGE1_ORGANIC = [
  {
    title: 'AP Statistics Question 176: Answer and Explanation',
    url: 'https://www.crackap.com/statistics/question-176-answer.html',
    snippet:
      'Web results AP Statistics Question 176: Answer and Explanation Crack AP 6. Which of these statements '
      + 'correctly explains bias? A. It describes a process that creates estimates that are too high on average '
      + 'or too low on average. Missing: meth',
  },
  {
    title: 'Biased Sampling and Extrapolation',
    url: '',
    snippet:
      'People also ask What is a biased sample called? What does it mean when a part of a population is under '
      + 'represented? What techniques used to select individuals to be in the sample favor one part of the '
      + 'population over another? What occurs when the results of the sample are not representative of the p',
  },
  {
    title: 'Ch 7 Inquizitive Flashcards',
    url: 'https://quizlet.com/ch-7-inquizitive-flash-cards',
    snippet:
      'Web results Ch 7 Inquizitive Flashcards Quizlet Correct using a representative sample (The best way to '
      + 'ensure external validity is to use an unbiased sample that represents the population of interest.)Read '
      + 'more 5.0(5) Missing: explains',
  },
  {
    title: 'Bias describes a process that results in a sample that does ...',
    url: 'https://homework.study.com/explanation/bias-describes-a-process-that-results-in-a-sample-that-does-not-represent-the-population-true-or-false.html',
    snippet:
      'Homework.Study.com Bias describes a process that results in a sample that does not represent the population. '
      + 'True or False? 1 answer · Top answer: The given statement is true: bias describes a process that '
      + 'results in a sample that does not re',
  },
  {
    title: '[Solved] Which of the following describes a biased sample ...',
    url: 'https://www.studocu.com/en-us/general-psychology/biased-sample',
    snippet:
      'Studocu Which of the following describes a biased sample? a. A sample that is not representative of a '
      + 'population b. A sample that accurately represents ... 1 answer · Top answer: The correct answer is: '
      + 'a. A sample that is not representative of a pop',
  },
];

// ── "define bias" -- live Google fetch this session, same 4 of 5 organic the BEFORE receipt's
// (now-superseded) D2 code printed in full (Merriam-Webster, Cambridge, UChicago, Psychology
// Today); the live fetch's 5th organic was Wikipedia's Bias article, not the quizlet flashcards
// block the AFTER receipt's discard note names -- Google's result set drifted over time between
// the real run and this fetch. Used what was actually captured, not fabricated quizlet text. ──
const DEFINE_BIAS_ORGANIC = [
  {
    title: 'BIAS Definition & Meaning',
    url: 'https://www.merriam-webster.com/dictionary/bias',
    snippet:
      'The meaning of BIAS is an inclination of temperament or outlook; especially : a personal and sometimes '
      + 'unreasoned judgment : prejudice. How to use bias in a ...',
  },
  {
    title: 'BIAS | definition in the Cambridge English Dictionary',
    url: 'https://dictionary.cambridge.org/dictionary/english/bias',
    snippet:
      '4 days ago — the action of supporting or opposing a particular person or thing in an unfair way, '
      + 'because of allowing personal opinions to influence your ...Read more',
  },
  {
    title: 'Defining Bias | UChicago HELP - The University of Chicago',
    url: 'https://help.uchicago.edu/bias',
    snippet:
      'Bias is a pre-formed negative opinion or attitude toward a group of persons who possess common '
      + 'characteristics, such as skin color, or cultural experiences,',
  },
  {
    title: 'Bias',
    url: 'https://www.psychologytoday.com/us/basics/bias',
    snippet:
      'Mar 31, 2026 — A bias is a tendency, inclination, or prejudice toward or against something or someone. '
      + 'Some biases are positive and helpful—like choosing ...',
  },
  {
    title: 'Bias',
    url: 'https://en.wikipedia.org/wiki/Bias',
    snippet:
      'Bias is a disproportionate weight in favor of or against an idea or thing, usually in a way that is '
      + 'inaccurate, closed-minded, prejudicial, or unfair. Biases ...',
  },
];

// ── "other meanings of bias" -- box + 5 organic. Box + Merriam/Collins/WordHippo match the AFTER
// receipt's denotations 5/6/7/8 verbatim; Thesaurus.com and up.edu match its two discards. ──────
const OTHER_MEANINGS_BOX =
  'Bias – Favoring of or against one person, group or thing compared with another, usually in a way '
  + 'considered to be unfair.';
const OTHER_MEANINGS_ORGANIC = [
  {
    title: 'BIAS Synonyms: 124 Similar and Opposite Words',
    url: 'https://www.merriam-webster.com/thesaurus/bias',
    snippet: 'Synonyms for BIAS: prejudice, tendency, partiality, partisanship, tendentiousness, one-sidedness, ply, favoritism;',
  },
  {
    title: 'BIAS Synonyms & Antonyms - 122 words',
    url: 'https://www.thesaurus.com/browse/bias',
    snippet: 'Synonyms STRONGEST bigotry favoritism inclination intolerance leaning preconceived idea preconceived notion tendency tilt unfairness STRONG bent chauvinism',
  },
  {
    title: 'Synonyms of BIAS | Collins American English Thesaurus',
    url: 'https://www.collinsdictionary.com/us/dictionary/english-thesaurus/bias',
    snippet: 'Synonyms for BIAS: prejudice, favoritism, inclination, leaning, partiality, tendency, prejudice, distort, influence, predispose,',
  },
  {
    title: 'What is another word for bias?',
    url: 'https://www.wordhippo.com/what-is/another-word-for/bias.html',
    snippet: 'prejudice · intolerance ; favouritism · partisanship ; unfairness · bigotry ; chauvinism · favoritism ; nonobjectivity · preference.',
  },
  {
    title: 'Bias Dictionary',
    url: 'https://www.up.edu/about-up/speak-up/bias-dictionary.html',
    snippet: 'Bias – Favoring of or against one person, group or thing compared with another, usually in a way considered to be unfair. Biases can be conscious or unconscious',
  },
];

// ── "what field is \"bias\" in" -- live Google fetch this session ────────────────────────────
const FIELD_Q1_ORGANIC = [
  { title: 'Types of Bias in Research | Definition & Examples', url: 'https://www.scribbr.com/category/research-bias/', snippet: 'Bias in research is any deviation from the truth which can cause distorted results and wrong conclusions.' },
  { title: 'Understanding different types of bias — Conscious inclusion', url: 'https://nshcs.hee.nhs.uk/equality-diversity-and-inclusion', snippet: 'A name bias occurs is when an individual is negatively discriminated against because of their name. Name bias in the workplace. Name bias can ...' },
  { title: 'Bias', url: 'https://www.psychologytoday.com/us/basics/bias', snippet: 'Mar 31, 2026 — A bias is a tendency, inclination, or prejudice toward or against something or someone. Some biases are positive and helpful—like choosing ...' },
  { title: 'Study Bias - StatPearls - NCBI Bookshelf - NIH', url: 'https://www.ncbi.nlm.nih.gov/books/NBK574513', snippet: "by A Popovic · 2023 · Cited by 139 — 24. Gorman DM. 'Everything works': the need to address confirmation bias in evaluations of drug misuse prevention interventions for adolescents. Addiction." },
  { title: 'Bias (statistics)', url: 'https://en.wikipedia.org/wiki/Bias_(statistics)', snippet: 'Other forms of human-based bias emerge in data collection as well such as response bias, in which participants give inaccurate responses to a question. Bias ...' },
  { title: 'What is Bias? [A Field Guide for Scientific Research]', url: 'https://imotions.com/blog/learning/research-fundamentals/what-is-bias/', snippet: 'Jan 1, 2020 — 3. Researcher Bias. There is also the often overlooked, and unfortunately, too frequent effects of researcher bias, in which the scientists ...' },
];

// ── "what subject or field does \"bias\" belong to" -- live Google fetch this session ────────
const FIELD_Q2_ORGANIC = [
  { title: 'Bias', url: 'https://en.wikipedia.org/wiki/Bias', snippet: 'Bias is a disproportionate weight in favor of or against an idea or thing, usually in a way that is inaccurate, closed-minded, prejudicial, or unfair.' },
  { title: 'Study Bias - StatPearls - NCBI Bookshelf - NIH', url: 'https://www.ncbi.nlm.nih.gov/books/NBK574513', snippet: 'by A Popovic · 2023 · Cited by 139 — Bias is colloquially defined as any tendency that limits impartial consideration of a question or issue. In academic research, bias refers to a type of ...' },
  { title: 'Bias', url: 'https://www.psychologytoday.com/us/basics/bias', snippet: 'Mar 31, 2026 — A bias is a tendency, inclination, or prejudice toward or against something or someone. Some biases are positive and helpful—like choosing ...' },
  { title: 'Bias', url: 'https://thedecisionlab.com/biases/bias', snippet: 'Bias is now widely studied in countless fields, including psychology, economics, and even technology. In recent years, bias has become a hot topic outside ...' },
  { title: 'What is Bias? [A Field Guide for Scientific Research]', url: 'https://imotions.com/blog/learning/research-fundamentals/what-is-bias/', snippet: 'Jan 1, 2020 — This article explores common biases like participant, selection, and researcher bias and provides actionable strategies to minimize them. Learn ...' },
];

// ── "what field or subject studies describes process results sample population sampling
// estimates influence" -- THE NEW QUERY, D-BP150-018 FIX A. Live Google fetch this session, for
// the EXACT query text field_gate.ts's deriveOptionVocabWords()+fieldQueries() actually produce
// for qid 85's real option set -- verified by RUNNING the real compiled findCatalystWords()
// against these exact options first (universal word "describes" leads, then the 7 highest-count
// catalyst words: process:8, results:4, sample:4, population:3, sampling:3, estimates:2,
// influence:2, capped at FIELD_VOCAB_QUERY_MAX_WORDS=8). An EARLIER version of this fixture used
// a hand-guessed query text that omitted "describes" and included "method" instead -- that
// mismatched the real code's output, silently fell through to this script's STAGE1 fallback, and
// corrupted the first run's field-gate candidates with Stage-1 content. Fixed by deriving the
// query mechanically (see the node one-liner in this ticket's return) before fetching. NEVER RAN
// IN PRODUCTION BEFORE THIS TICKET; no receipt exists to replay, so this is real captured text
// from a live web search rather than fabricated text. ────────────────────────────────────────
const FIELD_VOCAB_QUERY = 'what field or subject studies describes process results sample population sampling estimates influence';
const FIELD_VOCAB_ORGANIC = [
  { title: 'Statistics: Definition, Types, and Importance', url: 'https://www.investopedia.com/terms/s/statistics.asp', snippet: 'Descriptive statistics describes the properties of sample and population data. Inferential statistics uses those properties to test hypotheses and draw ...' },
  { title: 'What is statistics?', url: 'https://www.thebritishacademy.ac.uk/blog/what-is-statistics/', snippet: 'Oct 23, 2020 — Statistics is the technology of extracting information, illumination and understanding from data, often in the face of uncertainty.' },
  { title: 'Sampling: how to select participants in my research study?', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4938277', snippet: 'by J Martínez-Mesa · 2016 · Cited by 1404 — Sampling can be defined as the process through which individuals or sampling units are selected from the sample frame. The sampling strategy needs to be ...' },
  { title: 'What is Statistics?', url: 'https://www.mtu.edu/math/undergraduate/what/', snippet: 'samples from populations Use descriptive statistics to summarize data Apply bootstrapping, sampling, and estimation methods. In fields like health, business, ...' },
  { title: 'Why Study Statistics', url: 'https://www.bu.edu/stat/why-study-statistics/', snippet: 'As a discipline it is concerned with the collection, analysis, and interpretation of data, as well as the effective communication and presentation of results ...' },
  { title: 'Statistics', url: 'https://en.wikipedia.org/wiki/Statistics', snippet: 'Statistics is the discipline that concerns the collection, organization, analysis, interpretation, and presentation of data. In applying statistics to a ...' },
];

// ── "bias in statistics" -- D-BP150-018 (B)'s scoped query, IF "statistics" (or a name
// containing it) survives the field gate. Live Google fetch this session -- the closest available
// real analog to D3's old scoping query ("what is bias in statistics"), which this ticket's own
// evidence shows fetched the SAMPLING fold at that exact query shape before D-BP150-016 removed
// D3's collapse (not its scoping) along with it. ─────────────────────────────────────────────
const BIAS_IN_STATISTICS_ORGANIC = [
  { title: 'Bias (statistics)', url: 'https://en.wikipedia.org/wiki/Bias_(statistics)', snippet: 'bias is a systematic tendency in which the methods used to gather data and estimate a sample statistic present an inaccurate, skewed or distorted (biased) ...' },
  { title: '5 Types of Statistical Biases to Avoid in Your Analyses', url: 'https://online.hbs.edu/blog/post/types-of-statistical-bias', snippet: 'Jun 13, 2017 — Statistical bias is anything that leads to a systematic difference between the true parameters of a population and the statistics used to ...' },
  { title: '6 Types of Bias in Statistics', url: 'https://builtin.com/data-science/types-of-bias-in-statistics', snippet: 'Statistical bias is when a model or statistic is unrepresentative of the population. There are six main types of bias in statistics.' },
  { title: '4.3 - Statistical Biases | STAT 509', url: 'https://online.stat.psu.edu/stat509/lesson/4/4.3', snippet: 'For a point estimator, statistical bias is defined as the difference between the parameter to be estimated and the mathematical expectation of the estimator.' },
];

// ── fake AskGoogleFn, routed on the REAL query text the production code sends ────────────────
let callLog = [];
async function fakeAskGoogle(query) {
  callLog.push(query);
  if (query === 'define bias') {
    return { snippet: '', sourceUrl: '', authority: 'user_google', selectorUsed: 'test-fixture', results: DEFINE_BIAS_ORGANIC };
  }
  if (query === 'other meanings of bias') {
    return { snippet: OTHER_MEANINGS_BOX, sourceUrl: '', authority: 'user_google', selectorUsed: 'test-fixture', results: OTHER_MEANINGS_ORGANIC };
  }
  if (query === 'what field is "bias" in') {
    return { snippet: '', sourceUrl: '', authority: 'user_google', selectorUsed: 'test-fixture', results: FIELD_Q1_ORGANIC };
  }
  if (query === 'what subject or field does "bias" belong to') {
    return { snippet: '', sourceUrl: '', authority: 'user_google', selectorUsed: 'test-fixture', results: FIELD_Q2_ORGANIC };
  }
  if (query === FIELD_VOCAB_QUERY) {
    return { snippet: '', sourceUrl: '', authority: 'user_google', selectorUsed: 'test-fixture', results: FIELD_VOCAB_ORGANIC };
  }
  if (query.startsWith('Which of these statements correctly explains bias?')) {
    // Stage 1's own inverse-question query -- the real captured box+organic(5), including the
    // crackap.com contamination block on purpose (see this file's header).
    return { snippet: STAGE1_BOX, sourceUrl: '', authority: 'user_google', selectorUsed: 'test-fixture', results: STAGE1_ORGANIC };
  }
  if (query.startsWith('bias in ') && /statistics/i.test(query)) {
    return { snippet: '', sourceUrl: '', authority: 'user_google', selectorUsed: 'test-fixture', results: BIAS_IN_STATISTICS_ORGANIC };
  }
  if (query.startsWith('bias in ')) {
    // D-BP150-018 (B) per-survivor scoped queries for any OTHER surviving field name -- not
    // individually fetched (that would require knowing every field candidate in advance, which
    // depends on gemma's own extraction from the two queries above and is not deterministic
    // enough to hand-author real text for each possible survivor name). Honestly returns no
    // answer rather than fabricating scoped-query content -- this exercises the "no answer" path
    // of surveyAsk()'s loop, which is itself real production behavior, not faked.
    return null;
  }
  // Anything else is a routing gap in this fixture -- fail loudly rather than silently
  // substituting unrelated content (a real bug in an earlier version of this script: an
  // unmatched field-vocab query silently fell through to Stage 1 content and corrupted the
  // field-gate candidates without anyone noticing until the transcript was read closely).
  throw new Error(`UNROUTED fake Google query, fix the test fixture: "${query}"`);
}

// ── transcript capture ────────────────────────────────────────────────────────────────────────
const transcript = [];
function emit(ev) {
  transcript.push(ev);
  const tag = { header: '===', stage: '->', fact: '+', note: ' ', result: '###', error: '!!!' }[ev.kind] || '';
  console.log(`${tag} ${ev.text}`);
}

async function main() {
  console.log('── D-BP150-018 test: qid 85, scoped-plural field gate + survey, real captured text, replayed ──\n');
  console.log(`Expected new field-vocab query (from real findCatalystWords() on qid 85 options): "${FIELD_VOCAB_QUERY}"\n`);

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

  console.log('\n── QUERIES ACTUALLY SENT (deduped, in first-seen order) ──');
  const seenQ = new Set();
  for (const q of callLog) {
    if (seenQ.has(q)) continue;
    seenQ.add(q);
    console.log(`  - ${q}`);
  }

  console.log('\n── ASSERTIONS ──');
  const checks = [];
  checks.push(['abstain === true (qid 85 must still abstain, not answer)', outcome.abstain === true]);
  checks.push(['verdict === null (must not have picked E/J/anything else -- D5 stays unimplemented)', outcome.verdict === null]);
  checks.push(['the new field-vocab query was actually sent', callLog.includes(FIELD_VOCAB_QUERY)]);
  checks.push(['"statistics" appears among the field-gate candidates in the basis',
    /statistics/i.test(outcome.basis)]);
  checks.push(['the SAMPLING fold sentence reaches the denotation list (basis)',
    outcome.basis.includes('A sampling method is called biased if it systematically favors some outcomes over others')]);
  checks.push(['the crackap.com contamination block was excluded from Survey reuse, not silently kept',
    outcome.basis.includes('answer-key contamination') || transcript.some((e) => /reproduces option .+ text verbatim/.test(e.text || ''))]);
  checks.push(['basis mentions D-BP150-018 scoped-plural wiring',
    outcome.basis.includes('scoped to') || outcome.basis.includes('reused Stage-1')]);

  let allPass = true;
  for (const [label, pass] of checks) {
    console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${label}`);
    if (!pass) allPass = false;
  }

  console.log(`\nBASIS STRING VERBATIM:\n${outcome.basis}\n`);
  console.log(allPass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED (see above -- report honestly either way)');
  process.exit(0); // this script's job is to MEASURE and report, not gate a build -- exit 0 regardless
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});
