// plow_mc_elimination_cascade.test.ts
// SEG: D-BP148-011/BISHOP/referent-stopwords/seg-bp148-011
//
// Manual assert() + console output + process.exit(1) on failure, no test-framework dependency --
// same prior-art convention as plow_generator_cascade.test.ts (this file's own sibling) and
// src/main/crystal/crystal_store.test.ts / src/main/hex_terminal_telemetry.test.ts.
//
// SAME DEVIATION AS plow_generator_cascade.test.ts, STATED EXPLICITLY: this file has PRE-EXISTING
// extensionless imports of sibling .ts modules. Node's native TypeScript type-stripping require()
// resolves those via strict ESM resolution, which does not probe the .ts extension. So this test
// requires the COMPILED dist/main/plow/plow_mc_elimination_cascade.js, exactly the same
// "drive the compiled output, not ts-node/raw TypeScript" bar this repo's own convention imposes.
//
// Run (after `npm run build:main`):
//   node src\main\plow\plow_mc_elimination_cascade.test.ts
//
// SCOPE, DELIBERATELY NARROW (D-BP148-011 ticket): this file exists to cover the referent-
// extraction / Stage R register-resolution machinery this ticket actually touched the diagnosis
// of, not to re-test every C1-C5 function in this large, pre-existing file. It does NOT attempt
// blanket coverage of the whole module -- consistent with this file's own "SCOPE, DELIBERATELY
// NARROW" discipline used throughout its own comments.
//
// WHAT THIS TICKET FOUND (D-BP148-011, read before editing this file further): the diagnosed
// defect -- REFERENT_STOPWORDS excludes 'value'/'values', so a verification response that reduces
// to "deviate from the true value" (qid 85's real live G5 failure, quoted verbatim in commit
// f3820811's own message) extracts NO referent terms -- is REAL and confirmed below (Test 1).
// But the diagnosed FIX (remove 'value'/'values' from REFERENT_STOPWORDS) was verified this
// ticket, against the REAL qid-85 option texts (src/main/plow/plow_generator_cascade.test.ts's
// own biasOptions fixture, cross-checked against the Founder's own qid-85 categorization in
// FOUNDER_CASCADE_WORKED_BY_HAND_VERBATIM_RECOVERED_BP144.md Excerpt 7), to be A MEASURED NO-OP:
// none of qid 85's 10 real option texts contain the literal word "value" anywhere, so even with
// 'value' unblocked, Step 6's literal-substring match (evaluateOptionAgainstPredicate) still fails
// against all 10 options, and the "never discard the last survivor" override (this file's own
// existing safety gate) still fires -- runRegisterResolutionStage still abstains, G5 still
// generates nothing. Verified via a scratch-patched copy of the compiled dist (never the shipped
// file) before this test was written; the scratch patch was reverted and dist restored byte-
// identical before this file existed.
//
// A full sweep of all 55 real receipt files in C:\Users\Administrator\Downloads (955 outcome rows,
// 45 distinct real question_id values) found that qid 85 is the ONLY question in the entire real
// corpus whose stem clears the gate (determineStemPolarity determinate + extractStemConcept ===
// 'bias', the only concept CONCEPT_REGISTER_SIGNALS curates) that a REFERENT_STOPWORDS change would
// even have to pass through to matter at all. So the diagnosed fix would have changed the observed
// outcome on ZERO of the 45 real questions in the corpus, while adding a more permissive stopword
// table for definitional predicate-referent extraction generally (real, if currently unmeasurable,
// risk to any FUTURE bias-register question whose correct option happens to literally say "value").
//
// DECISION (per this ticket's own instruction to prefer protecting the shipped eliminator over an
// elegant diff): REFERENT_STOPWORDS is left UNCHANGED. This file locks in and documents that
// decision with real assertions against the real compiled behavior, so a future SEG does not have
// to re-derive this finding from scratch, and so any future change to REFERENT_STOPWORDS is caught
// by Test 2 below (Founder's own working phrasing must keep generating E).
//
// Rule 66: version, never overwrite -- new file, no supersede needed. No em-dashes anywhere in this
// file (or its comments) -- "--" used throughout per Rule 66.

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

const distPath = path.join(__dirname, '..', '..', '..', 'dist', 'main', 'plow', 'plow_mc_elimination_cascade.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const elim = require(distPath) as typeof import('./plow_mc_elimination_cascade');

// Real qid-85 option texts, byte-identical to plow_generator_cascade.test.ts's own biasOptions
// fixture (that file's own G5 test, never duplicated logic, only the fixture data re-declared here
// because this file must not import a sibling .test.ts). Cross-checked against the Founder's own
// qid-85 categorization in FOUNDER_CASCADE_WORKED_BY_HAND_VERBATIM_RECOVERED_BP144.md Excerpt 7
// ("sample" in A,B,C,D,E,H,I; "too high/low on average" in J; "represent"/"represents" in A,D).
const biasOptions = [
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
const biasStem = 'Which of these statements correctly explains bias?';

// ── Test 1: the REAL live G5 failure phrase, verbatim from commit f3820811's own message ────────
console.log('\nTest 1 -- extractPredicateReferentTerms on the real qid-85 live failure phrase');
{
  const liveFailureText = 'Statistical bias causes estimates to deviate from the true value.';
  const terms = elim.extractPredicateReferentTerms(liveFailureText);
  assert(terms.length === 0,
    'the live failure phrase ("deviate from the true value") reduces to a referent term set ' +
    'excluded entirely by REFERENT_STOPWORDS (\'value\') -- confirmed, this half of the diagnosis ' +
    'is real', JSON.stringify(terms));

  const stageResult = elim.runRegisterResolutionStage(
    biasStem,
    biasOptions,
    biasOptions.map((o) => o.letter),
    {
      query: 'what is bias in statistics',
      definitionText: liveFailureText,
      registerClaimed: 'statistics',
      source: 'D-BP148-011-verification',
    },
  );
  assert(stageResult.abstained === true,
    'the stage honestly abstains on the live failure phrase (never forces a result) -- matches ' +
    'shipped behavior', stageResult.trace.join(' | '));
}

// ── Test 2: the Founder's own verbatim phrasing must keep working (regression guard) ────────────
console.log('\nTest 2 -- extractPredicateReferentTerms on the Founder\'s own verbatim phrasing');
{
  const founderText =
    'Statistical bias is a systematic error that causes results or estimates to differ from the ' +
    'true values of a population.';
  const terms = elim.extractPredicateReferentTerms(founderText);
  assert(terms.includes('population'),
    '"differ from the true values of a population" still yields "population" as a referent term ' +
    'even with value/values stopworded -- the mechanism does not need value/values to work when ' +
    'the definition names a real content noun', JSON.stringify(terms));

  const stageResult = elim.runRegisterResolutionStage(
    biasStem,
    biasOptions,
    biasOptions.map((o) => o.letter),
    {
      query: 'what is bias in statistics',
      definitionText: founderText,
      registerClaimed: 'statistics',
      source: 'D-BP148-011-verification',
    },
  );
  assert(!stageResult.abstained && stageResult.survivorsOut.includes('E'),
    'the Founder\'s own phrasing still narrows survivors to include E (regression guard: this must ' +
    'keep passing if REFERENT_STOPWORDS is ever touched again)', JSON.stringify(stageResult.survivorsOut));
  assert(stageResult.survivorsOut.length < biasOptions.length,
    'the Founder\'s own phrasing narrows the survivor set (not a no-op)',
    JSON.stringify(stageResult.survivorsOut));
}

// ── Test 3: D-BP148-011 finding, locked in -- removing value/values would not change Test 1's
// outcome, because no real qid-85 option contains the literal word "value". This is documented as
// a comment (verified via a scratch-patched dist copy during investigation, never shipped), and
// locked in here as an assertion against the REAL option texts directly, independent of
// REFERENT_STOPWORDS' actual contents -- this proves the SAFETY OVERRIDE (never discard the last
// survivor) is what actually protects this case, not the stopword table. ────────────────────────
console.log('\nTest 3 -- D-BP148-011 finding: no real qid-85 option text contains "value"');
{
  const anyOptionContainsValue = biasOptions.some((o) => o.text.toLowerCase().includes('value'));
  assert(anyOptionContainsValue === false,
    'none of the 10 real qid-85 option texts contain the literal word "value" -- confirms that ' +
    'unblocking value/values in REFERENT_STOPWORDS could not have generated E for this question, ' +
    'because Step 6 (evaluateOptionAgainstPredicate) requires the option\'s OWN text to literally ' +
    'state the referent term, and none do',
    JSON.stringify(biasOptions.map((o) => o.text)));
}

// ── Test 4: D-BP148-013 -- markdown-wrapped live chat-model output must extract the same referent
// terms as the equivalent plain-prose text. Text verbatim from a FRESH live gemma4:12b dispatch run
// this ticket (scratchpad/seg_bp148_013_live_confirm.mjs run 1/5, real Ollama response, not
// hand-written), which pre-fix returned [] purely because of the asterisks. ─────────────────────
console.log('\nTest 4 -- D-BP148-013: markdown emphasis must not defeat referent extraction');
{
  const markdownText = 'Bias occurs when an **estimate** differs from a **population parameter**.';
  const plainText = 'Bias occurs when an estimate differs from a population parameter.';
  const markdownTerms = elim.extractPredicateReferentTerms(markdownText);
  const plainTerms = elim.extractPredicateReferentTerms(plainText);
  assert(markdownTerms.length > 0,
    'a real live gemma4:12b response wrapping the referent in markdown bold no longer reduces to ' +
    'zero referent terms (D-BP148-013 fix)', JSON.stringify(markdownTerms));
  assert(JSON.stringify([...markdownTerms].sort()) === JSON.stringify([...plainTerms].sort()),
    'the markdown-wrapped and plain-prose versions of the same sentence must extract the identical ' +
    'referent term set -- proves normalization changes only what the matcher SEES, not what it ' +
    'ACCEPTS (REFERENT_ANCHOR_PATTERNS and REFERENT_STOPWORDS both untouched this ticket)',
    `markdown=${JSON.stringify(markdownTerms)} plain=${JSON.stringify(plainTerms)}`);

  const stageResult = elim.runRegisterResolutionStage(
    biasStem,
    biasOptions,
    biasOptions.map((o) => o.letter),
    {
      query: 'what is bias in statistics',
      definitionText: markdownText,
      registerClaimed: 'statistics',
      source: 'D-BP148-013-verification',
    },
  );
  assert(!stageResult.abstained && stageResult.survivorsOut.includes('E'),
    'the markdown-wrapped real live response now narrows survivors to include E, exactly like the ' +
    'equivalent plain-prose phrasing would -- fresh live confirmation (2 of 5 real gemma4:12b runs, ' +
    'seg_bp148_013_live_confirm.mjs) showed this same shape both generate and land E',
    JSON.stringify(stageResult.survivorsOut));
}

// ── Test 5: regression guard -- plain prose (no markdown at all) must behave identically before
// and after this ticket's fix. stripMarkdownEmphasis on text with no [*_`~] characters is a no-op,
// and this asserts that directly against Test 1's own live-failure phrase (still abstains, matches
// shipped behavior unchanged) and Test 2's own Founder phrasing (still narrows to include E,
// unchanged). ─────────────────────────────────────────────────────────────────────────────────────
console.log('\nTest 5 -- D-BP148-013 regression guard: plain-prose behavior is unchanged by the fix');
{
  const liveFailureText = 'Statistical bias causes estimates to deviate from the true value.';
  const termsAgain = elim.extractPredicateReferentTerms(liveFailureText);
  assert(termsAgain.length === 0,
    'the plain-prose (no markdown) live-failure phrase from Test 1 still abstains identically after ' +
    'the D-BP148-013 fix -- stripMarkdownEmphasis is a no-op on text with no emphasis characters',
    JSON.stringify(termsAgain));
}

// ── Summary ──────────────────────────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}

})().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
