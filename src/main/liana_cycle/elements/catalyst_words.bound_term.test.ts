// elements/catalyst_words.bound_term.test.ts -- D-BP151-046/BISHOP/seg-bound-term-catalyst
//
// Manual assert() + console output + process.exit(1) on failure, same prior-art convention as
// survey_stage.test.ts and comparative_cascade.test.ts: requires the COMPILED
// dist/main/liana_cycle/elements/catalyst_words.js.
//
// Run (after `npm run build:main`):
//   node src\main\liana_cycle\elements\catalyst_words.bound_term.test.ts
//
// WHAT THIS TESTS. The Founder's live qid 98 run measured that catalyst-word picking split every
// multi-word option into its first-most-discriminating single token, surveying a fragment with a
// DIFFERENT referent than the option itself ("South America" -> surveyed "america"; "Northeast
// United States" -> surveyed "northeast"). The coordinator's follow-up widened this to ALL SEVEN
// options in that live option set, confirmed the mechanism is catalyst_words.ts's own count+
// alphabetical ranking over single-word tokens (NOT kind_check.ts's separately-inverted head
// detection, which is unused by the catalyst picker -- see the SEG return for the full trace), and
// asked for confirmation that the fix surveys the WHOLE phrase for every multi-word option. This
// test uses the real seven-option set plus the control (Europe, single word, must be unaffected).

import { findCatalystWords } from './catalyst_words';

let failures = 0;
function assert(cond: unknown, msg: string, extra?: unknown): void {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${msg}${extra !== undefined ? ` -- ${JSON.stringify(extra)}` : ''}`);
  } else {
    console.log(`PASS: ${msg}`);
  }
}

/** Mirrors survey_answers.ts's own toSurvey selection exactly (maxCatalystWordsPerOption default
 *  1): the top of catalystResult.catalysts filtered to this option's own letters, most-
 *  discriminating (lowest count, then alpha) first. */
function topCatalystFor(options: Record<string, string>, letter: string): string | null {
  const { catalysts } = findCatalystWords(options);
  const own = catalysts.filter((c) => c.letters.includes(letter)).map((c) => c.word);
  return own[0] ?? null;
}

// ── 1. THE REAL SEVEN-OPTION SET FROM THE FOUNDER'S LIVE qid 98 RUN ─────────────────────────────
{
  const options = {
    A: 'South America',
    B: 'South Asia',
    C: 'North Africa',
    D: 'Northeast United States',
    E: 'Europe',
    F: 'Central Asia',
    G: 'Arctic Circle',
  };

  assert(topCatalystFor(options, 'A') === 'south america', 'A) "South America" surveys the whole phrase, not the fragment "america"', topCatalystFor(options, 'A'));
  assert(topCatalystFor(options, 'B') === 'south asia', 'B) "South Asia" surveys the whole phrase, not the fragment "asia"', topCatalystFor(options, 'B'));
  assert(topCatalystFor(options, 'C') === 'north africa', 'C) "North Africa" surveys the whole phrase, not the fragment "africa"', topCatalystFor(options, 'C'));
  assert(topCatalystFor(options, 'D') === 'northeast united states', 'D) "Northeast United States" surveys the whole phrase, not the fragment "northeast"', topCatalystFor(options, 'D'));
  assert(topCatalystFor(options, 'F') === 'central asia', 'F) "Central Asia" surveys the whole phrase, not the fragment "central"', topCatalystFor(options, 'F'));
  assert(topCatalystFor(options, 'G') === 'arctic circle', 'G) "Arctic Circle" surveys the whole phrase, not the fragment "arctic"', topCatalystFor(options, 'G'));

  // CONTROL -- a genuinely single-word option must be unaffected.
  assert(topCatalystFor(options, 'E') === 'europe', 'E) "Europe" (control, single word) is unaffected', topCatalystFor(options, 'E'));

  // No two options collapse to the same catalyst -- each region is its own referent.
  const { catalysts } = findCatalystWords(options);
  const words = catalysts.map((c) => c.word);
  assert(new Set(words).size === words.length, 'no duplicate catalyst words across the seven-option set', words);
}

// ── 2. THE TWO ORIGINALLY-CITED CASES, IN ISOLATION (smaller option sets) ───────────────────────
{
  const options = { A: 'South America', B: 'North Africa' };
  assert(topCatalystFor(options, 'A') === 'south america', '"South America" alone with one distractor still surveys the whole phrase', topCatalystFor(options, 'A'));
}
{
  const options = { A: 'Northeast United States', B: 'Europe' };
  assert(topCatalystFor(options, 'A') === 'northeast united states', '"Northeast United States" surveys the whole phrase, not "northeast"', topCatalystFor(options, 'A'));
  assert(topCatalystFor(options, 'B') === 'europe', '"Europe" (control) unaffected in this pairing too', topCatalystFor(options, 'B'));
}

// ── 3. A SENTENCE-INITIAL CAPITAL IS NOT PART OF THE BOUND PHRASE ───────────────────────────────
// "The United States" -- "The" is capitalized only because it starts the option text, not because
// it names anything. FUNCTION_WORDS (already used elsewhere in this file for the same purpose)
// trims it so the surveyed phrase is "united states", not "the united states".
{
  const options = { A: 'The United States is a country.', B: 'Canada is a country.' };
  const { catalysts } = findCatalystWords(options);
  const aWords = catalysts.filter((c) => c.letters.includes('A')).map((c) => c.word);
  assert(aWords.includes('united states'), 'sentence-initial "The" is trimmed from the bound phrase -- "united states", not "the united states"', aWords);
  assert(!aWords.includes('the united states'), 'the untrimmed form never appears as a catalyst word', aWords);
}

if (failures > 0) {
  console.error(`\n${failures} FAILURE(S)`);
  process.exit(1);
}
console.log('\nALL PASS');
