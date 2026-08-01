'use strict';

// KN-BP141-2 Task A verification (d): A4 blindness audit, run against
// runCakeMethodDisagreementResolution (real compiled dist code, not a reimplementation).
//
// HONEST LIMITATION (same class as the mesh-peer-transport gap already documented in
// plow_mc_answerer.ts's own header comment above runCakeMethodDisagreementResolution): this
// sandbox has no live browser session and no live LLM behind it, so we cannot measure REAL
// browser-LLM self-preference here. What CAN be verified with real compiled code and no
// fabrication is the AUDIT MECHANISM ITSELF: does cakeSelfPreferenceAudit correctly detect and
// report a DELIBERATELY, KNOWABLY scripted self-preference bias per participant, and correctly
// report a participant that does NOT exhibit it? The stub bridge below scripts exactly that --
// two "rigged" participants (user_perplexity, user_claude) that pick their OWN cut's letter
// whenever it is present in the anonymized pool and something else whenever it is absent, and one
// "clean" participant (user_chatgpt) that always targets a THIRD PARTY's (google's) letter
// regardless of whether its own cut is present or absent. Every candidate/letter/prompt below is
// real data flowing through the real assertCakeChoosePromptIsBlind/shuffleCakePoolForPicker/
// tallyCakePicksWithAbstain code paths -- only the "browser response" side is scripted, and it is
// scripted openly, not disguised as a live measurement.

const path = require('path');
const distAnswerer = path.join(__dirname, '..', 'dist', 'main', 'plow', 'plow_mc_answerer.js');
const { runCakeMethodDisagreementResolution } = require(distAnswerer);

let failures = 0;
function check(label, cond) {
  console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${label}`);
  if (!cond) failures++;
}

function findMarkerLetter(promptText, marker) {
  const re = new RegExp('says (\\w): ' + marker);
  const m = promptText.match(re);
  return m ? m[1] : null;
}

function stubBridge() {
  const calls = [];
  return {
    calls,
    async runQueryInUserBrowser(query) {
      calls.push({ authority: query.authority, question: query.question });
      let pickedLetter = null;
      if (query.authority === 'user_perplexity') {
        pickedLetter = findMarkerLetter(query.question, 'PPLX_OWN_MARKER') || findMarkerLetter(query.question, 'GOOGLE_TARGET_MARKER');
      } else if (query.authority === 'user_claude') {
        pickedLetter = findMarkerLetter(query.question, 'CLAUDE_OWN_MARKER') || findMarkerLetter(query.question, 'GOOGLE_TARGET_MARKER');
      } else if (query.authority === 'user_chatgpt') {
        // Clean/negative-control participant: ALWAYS targets google's (third-party) letter,
        // regardless of whether its own cut is present or absent in the pool.
        pickedLetter = findMarkerLetter(query.question, 'GOOGLE_TARGET_MARKER');
      }
      if (!pickedLetter) return null;
      return {
        snippet: `Answer: ${pickedLetter}. Synthetic stub rationale for A4 blindness-audit mechanism test.`,
        sourceUrl: `https://stub.invalid/${query.authority}`,
        authority: query.authority,
        selectorUsed: 'stub',
      };
    },
  };
}

const mcOptions = [
  { letter: 'A', text: 'Option A -- thermodynamic explanation.' },
  { letter: 'B', text: 'Option B -- photosynthesis-reversal explanation.' },
  { letter: 'C', text: 'Option C -- top-search-result explanation.' },
  { letter: 'D', text: 'Option D -- constraint-satisfaction explanation.' },
];

const candidates = [
  {
    authority: 'user_perplexity',
    letter: 'B',
    reasoning: 'PPLX_OWN_MARKER The answer is Beta because of reasoning about photosynthesis process being reversed under condition described in the prompt statement text.',
    sourceUrl: 'https://perplexity.ai/search?q=stub',
    method: 'browser_authority',
  },
  {
    authority: 'user_google',
    letter: 'C',
    reasoning: 'GOOGLE_TARGET_MARKER Google top result snippet says answer C is correct per the summary text expanded slightly for length so it clears the trivial-length floor.',
    sourceUrl: 'https://www.google.com/search?q=stub',
    method: 'browser_authority',
  },
  {
    authority: 'user_claude',
    letter: 'A',
    reasoning: 'CLAUDE_OWN_MARKER Claude reasons the correct choice is option A based on thermodynamic principles explained across several extra clauses for length.',
    sourceUrl: 'https://claude.ai/new',
    method: 'browser_authority',
  },
  {
    authority: 'user_chatgpt',
    letter: 'D',
    reasoning: 'CHATGPT_OWN_MARKER ChatGPT concludes D is correct given the constraints described in the prompt statement across several extra clauses for length.',
    sourceUrl: 'https://chatgpt.com/',
    method: 'browser_authority',
  },
];

const config = {
  domain: 'test',
  ollamaBaseUrl: 'http://127.0.0.1:1', // deliberately unreachable -- local-orchestrator cut/pick
  model: 'stub-model',                  // calls must fail gracefully (A11), never fabricate.
  choiceCount: 4,
  andonEnabled: false,
  researchArmMode: true,
  researchArmBrowserAuthority: true,
};

const browserLlmOverrides = { user_claude: true, user_chatgpt: true, user_gemini: false };

const logLines = [];
const log = (msg) => logLines.push(msg);

(async () => {
  console.log('KN-BP141-2 Task A verification (d): A4 blindness audit, per participant');
  console.log('='.repeat(78));

  const result = await runCakeMethodDisagreementResolution({
    researchQuery: 'Stub question for A4 blindness-audit mechanism verification (not a real MMLU-Pro item).',
    mcOptions,
    candidates,
    config,
    bridge: stubBridge(),
    browserLlmOverrides,
    log,
  });

  console.log('\n--- harness log ---');
  for (const l of logLines) console.log('  ' + l);

  console.log('\n--- cakeCuts (A6/A9 REVISED, real cutPool including own-letter markers) ---');
  for (const c of result.cakeCuts) console.log(`  ${c.pickerKey} -> ${c.letter} (${c.derivationPath})`);

  console.log('\n--- cakePicks (A7) ---');
  for (const p of result.cakePicks) console.log(`  ${p.pickerKey} -> ${p.pickedLetter} (${p.derivationPath})`);

  console.log('\n--- cakeSelfPreferenceAudit (A4, PER PARTICIPANT) ---');
  for (const a of result.cakeSelfPreferenceAudit) {
    console.log(
      `  ${a.pickerKey}: ownLetter=${a.ownLetter} ` +
      `pickedOwnLetterWithSelfPresent=${a.pickedOwnLetterWithSelfPresent} ` +
      `pickedSameLetterWithSelfAbsent=${a.pickedSameLetterWithSelfAbsent}`,
    );
  }

  console.log(`\ndistinctDerivationCount=${result.distinctDerivationCount} cutScatter=${result.cutScatter} ` +
    `pickConvergence=${result.pickConvergence} cakeQuadrant=${result.cakeQuadrant} chosenLetter=${result.chosenLetter}`);

  console.log('\n' + '='.repeat(78));
  console.log('CHECKS');

  const byKey = Object.fromEntries(result.cakeSelfPreferenceAudit.map((a) => [a.pickerKey, a]));

  check('audit has an entry for user_perplexity', !!byKey.user_perplexity);
  check('audit has an entry for user_claude', !!byKey.user_claude);
  check('audit has an entry for user_chatgpt', !!byKey.user_chatgpt);

  check(
    'RIGGED user_perplexity: picked its OWN letter when self present (scripted 100% self-preference)',
    byKey.user_perplexity && byKey.user_perplexity.pickedOwnLetterWithSelfPresent === true,
  );
  check(
    'RIGGED user_perplexity: did NOT pick same letter when self absent (own letter unreachable once removed)',
    byKey.user_perplexity && byKey.user_perplexity.pickedSameLetterWithSelfAbsent === false,
  );
  check(
    'RIGGED user_claude: picked its OWN letter when self present (scripted 100% self-preference)',
    byKey.user_claude && byKey.user_claude.pickedOwnLetterWithSelfPresent === true,
  );
  check(
    'RIGGED user_claude: did NOT pick same letter when self absent',
    byKey.user_claude && byKey.user_claude.pickedSameLetterWithSelfAbsent === false,
  );
  check(
    'CLEAN user_chatgpt: did NOT pick its own letter when self present (targets google both times)',
    byKey.user_chatgpt && byKey.user_chatgpt.pickedOwnLetterWithSelfPresent === false,
  );
  check(
    'CLEAN user_chatgpt: consistent, did not pick own letter when self absent either',
    byKey.user_chatgpt && byKey.user_chatgpt.pickedSameLetterWithSelfAbsent === false,
  );

  check('local_orchestrator cut/pick failed gracefully (A11), never fabricated (unreachable ollama)',
    result.cakeCuts.every((c) => !c.pickerKey.startsWith('local_orchestrator')) &&
    !result.cakePicks.find((p) => p.pickerKey === 'local_orchestrator' && p.pickedLetter !== null));

  const perParticipantRates = result.cakeSelfPreferenceAudit
    .filter((a) => a.pickedOwnLetterWithSelfPresent !== null)
    .map((a) => ({ pickerKey: a.pickerKey, selfPreferring: a.pickedOwnLetterWithSelfPresent === true }));
  const overallRate = perParticipantRates.filter((r) => r.selfPreferring).length / perParticipantRates.length;

  console.log('\n--- headline (per Founder amendment: report PER PARTICIPANT, never only aggregate) ---');
  for (const r of perParticipantRates) console.log(`  ${r.pickerKey}: self-preferring=${r.selfPreferring}`);
  console.log(`  AGGREGATE (informational only, not the reporting unit): ${(overallRate * 100).toFixed(0)}% of ${perParticipantRates.length} tested participants self-preferred in this scripted run.`);
  console.log('  NOTE: this is a scripted mechanism test (2 rigged + 1 clean participant), NOT a live');
  console.log('  empirical measurement of real browser-LLM self-preference -- no live browser/LLM bridge');
  console.log('  is reachable in this sandbox. The mechanism correctly distinguished rigged from clean.');

  console.log('\n' + '='.repeat(78));
  console.log(`SUMMARY (blindness-audit mechanism checks): Failures: ${failures}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((err) => {
  console.error('UNCAUGHT ERROR:', err);
  process.exit(1);
});
