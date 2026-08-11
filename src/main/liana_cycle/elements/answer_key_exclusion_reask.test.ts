// elements/answer_key_exclusion_reask.test.ts -- D-BP152-032/BISHOP/seg-auto-method-and-key-exclusion
//
// Manual assert() + console output + process.exit(1) on failure, same prior-art convention as
// survey_stage.test.ts / method_question_generator.test.ts -- requires the COMPILED
// dist/main/liana_cycle/elements/answer_key_exclusion_reask.js.
//
// Run (after `npm run build:main`):
//   node src\main\liana_cycle\elements\answer_key_exclusion_reask.test.ts
//
// WHAT THIS TESTS, per D-BP152-032's own VERIFY section:
//   (d) detection reuses elements/answer_key_guard.ts's findAnswerKeyMarker() -- no new detector.
//   (e) all three comparison outcomes are recorded correctly, including exclusion-not-honored.
//   (f) the first answer is never silently replaced -- it survives, byte-identical, in every
//       outcome, alongside (never in place of) the second answer.
// `askGoogle` is a fake in every case below -- no Google/internet network is reached. `fetch`
// (gemmaExtract()'s own Ollama call) is likewise stubbed per-case to return a fixed JSON answer --
// no live Ollama instance is required for this file to run, same convention comparative_cascade's
// own no-network unit tests already use.

(async function main(): Promise<void> {

const path = require('path');

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    console.log(`  [PASS] ${label}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${label}${detail ? ` -- ${detail}` : ''}`);
    failed++;
  }
}

const distPath = path.join(__dirname, '..', '..', '..', '..', 'dist', 'main', 'liana_cycle', 'elements', 'answer_key_exclusion_reask.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mod = require(distPath) as typeof import('./answer_key_exclusion_reask');
const { detectAnswerKeySource, buildExclusionReaskQuery, runAnswerKeyExclusionTest } = mod;

console.log('answer_key_exclusion_reask.test.ts -- D-BP152-032 STAGE 2\n');

const ORIGINAL_QUERY = 'What is bias in the context of a statistical sample?';

type TerminalEvent = { kind: string; text: string; ts: string };
function fakeEmit(events: TerminalEvent[]) {
  return (e: TerminalEvent) => { events.push(e); };
}

// ── (d) detection reuses answer_key_guard.ts, no new detector ──────────────────────────────────
{
  const withMarker = {
    originalQuery: ORIGINAL_QUERY,
    answerText: 'a sample that is not representative of a population',
    sourcePassage: '1 answer -- Top answer: The correct answer is: a. A sample that is not representative of a pop',
    citations: ['https://studocu.com/some-quiz-page'],
  };
  const det = detectAnswerKeySource(withMarker);
  assert(det !== null, '(d) marker detected via findAnswerKeyMarker(), reused unmodified from answer_key_guard.ts');
  assert(!!det && det.sourceCitation === 'https://studocu.com/some-quiz-page', '(d) source citation picked (first citation, source order, no invented ranking)');

  const noMarker = { originalQuery: ORIGINAL_QUERY, answerText: 'a plain answer', sourcePassage: 'an ordinary passage, no answer-key phrase anywhere', citations: ['https://example.com'] };
  assert(detectAnswerKeySource(noMarker) === null, '(d) no marker present -> detection returns null');

  const markerNoCitation = { originalQuery: ORIGINAL_QUERY, answerText: 'solution: 42', sourcePassage: 'Detailed Solution. solution: 42', citations: [] as string[] };
  const det2 = detectAnswerKeySource(markerNoCitation);
  assert(det2 !== null && det2.sourceCitation === null, '(d) marker found but no citations captured -> sourceCitation is null (honest, not fabricated)');
}

// ── query builder, Founder's own phrasing shape ─────────────────────────────────────────────────
{
  const q = buildExclusionReaskQuery(ORIGINAL_QUERY, 'https://studocu.com/some-quiz-page');
  assert(
    q === "What is bias in the context of a statistical sample?, but this time don't include information from https://studocu.com/some-quiz-page.",
    "exclusion query matches the Founder's own phrasing shape, verbatim, term-substituted only",
    q,
  );
}

// ── (e) all three comparison outcomes + exclusion-not-honored, (f) first answer never replaced ──
{
  const events: TerminalEvent[] = [];
  const captured = {
    originalQuery: ORIGINAL_QUERY,
    answerText: 'a sample that is not representative of a population',
    sourcePassage: 'Top answer: a sample that is not representative of a population',
    citations: ['https://studocu.com/quiz'],
  };
  (global as any).fetch = async () => ({ json: async () => ({ response: JSON.stringify({ answer: 'a sample that is not representative of a population' }) }) });
  const askGoogle = async () => ({
    snippet: 'a sample that is not representative of a population',
    results: [{ title: '', snippet: '', url: 'https://studocu.com/quiz' }],
    citations: [{ url: 'https://studocu.com/quiz' }],
  } as any);
  const r = await runAnswerKeyExclusionTest(captured, { emit: fakeEmit(events), askGoogle }, 'google');
  assert(r.outcome === 'EXCLUSION_NOT_HONORED', '(e) same answer + same source still cited on re-ask -> EXCLUSION_NOT_HONORED', r.outcome);
  assert(r.firstAnswer.text === captured.answerText, '(f) firstAnswer is exactly the input, unchanged');
  assert(r.secondAnswer !== null, '(f) secondAnswer is recorded alongside firstAnswer, never in place of it');
}

{
  const events: TerminalEvent[] = [];
  const captured = {
    originalQuery: ORIGINAL_QUERY,
    answerText: 'a sample that is not representative of a population',
    sourcePassage: 'Top answer: a sample that is not representative of a population',
    citations: ['https://studocu.com/quiz'],
  };
  (global as any).fetch = async () => ({ json: async () => ({ response: JSON.stringify({ answer: 'a systematic error introduced during data collection' }) }) });
  const askGoogle = async () => ({
    snippet: 'a systematic error introduced during data collection',
    results: [{ title: '', snippet: '', url: 'https://reputable-stats-site.example/glossary' }],
    citations: [{ url: 'https://reputable-stats-site.example/glossary' }],
  } as any);
  const r = await runAnswerKeyExclusionTest(captured, { emit: fakeEmit(events), askGoogle }, 'google');
  assert(r.outcome === 'ANSWER_CHANGED', '(e) answer differs on re-ask -> ANSWER_CHANGED (measured contamination finding)', r.outcome);
  assert(r.firstAnswer.text === captured.answerText, '(f) firstAnswer still exactly the input after ANSWER_CHANGED');
}

{
  const events: TerminalEvent[] = [];
  const captured = {
    originalQuery: ORIGINAL_QUERY,
    answerText: 'a systematic error introduced during data collection',
    sourcePassage: 'Top answer: a systematic error introduced during data collection',
    citations: ['https://studocu.com/quiz'],
  };
  (global as any).fetch = async () => ({ json: async () => ({ response: JSON.stringify({ answer: 'a systematic error introduced during data collection' }) }) });
  const askGoogle = async () => ({
    snippet: 'a systematic error introduced during data collection',
    results: [{ title: '', snippet: '', url: 'https://reputable-stats-site.example/glossary' }],
    citations: [{ url: 'https://reputable-stats-site.example/glossary' }],
  } as any);
  const r = await runAnswerKeyExclusionTest(captured, { emit: fakeEmit(events), askGoogle }, 'google');
  assert(r.outcome === 'ANSWER_SURVIVED_WITHOUT_KEY', '(e) same answer + source/marker gone on re-ask -> ANSWER_SURVIVED_WITHOUT_KEY', r.outcome);
  assert(r.firstAnswer.text === captured.answerText, '(f) firstAnswer still exactly the input after ANSWER_SURVIVED_WITHOUT_KEY');
}

{
  const captured = { originalQuery: ORIGINAL_QUERY, answerText: 'a plain answer', sourcePassage: 'nothing answer-key-like here', citations: ['https://example.com'] };
  const r = await runAnswerKeyExclusionTest(captured, { emit: () => {}, askGoogle: async () => null }, 'google');
  assert(r.outcome === 'NOT_RUN_NO_MARKER' && r.ran === false, 'no marker -> NOT_RUN_NO_MARKER, ran=false, never fabricates a test that did not happen');
}

{
  // 'gemma' transport refuses, same rule as every other ask*() function in this estate's survey path.
  const captured = { originalQuery: ORIGINAL_QUERY, answerText: 'solution: 42', sourcePassage: 'Detailed Solution. solution: 42', citations: ['https://example.com/quiz'] };
  const r = await runAnswerKeyExclusionTest(captured, { emit: () => {}, askGoogle: async () => null }, 'gemma');
  assert(r.outcome === 'NOT_RUN_TRANSPORT_REFUSED', "'gemma' transport refuses (HARDWIRE-22), does not fall back to google", r.outcome);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

})();
