import { defineConfig } from 'vite';

// D-BP155-006 / BISHOP / seg-shadow-fix
// vitest has no config of its own in this repo (confirmed: vitest's config
// discovery only matches vite.config.* / vitest.config.* filenames, and
// vite.renderer.config.ts does not match either pattern, so vitest was
// running with vite's unmodified DEFAULT_EXTENSIONS, which tries .js before
// .ts/.tsx). This file exists solely to pin resolve.extensions so a stale
// same-basename .js file can never shadow its .ts/.tsx sibling under
// `vitest run`. It intentionally sets nothing else, to avoid changing any
// other existing test behavior.
// D-BP207-SEG-A / BISHOP-M0 / card t-5dc6d4f0. THE 11 LEGACY MANUAL-ASSERT FILES, found by
// D-BP168-M0-114 ("the single largest contributor to the failing count and they are not tests at
// all -- the glob is picking up files that were never written to be run by vitest"). CONFIRMED
// this dispatch, two independent checks, not guessed: (1) none of the 11 imports `from 'vitest'`
// (every real vitest suite in this tree does); (2) each one's own file header states, verbatim,
// "Manual assert() + console output + process.exit(1) on failure, no test-framework dependency"
// and gives its own `node <path>` run instruction, meant to be executed directly, never through
// vitest's runner.
//
// FIX IS THE GLOB, PER THE CARD'S OWN INSTRUCTION ("fix the glob OR rename the files -- do NOT
// delete them"): `test.exclude` below is additive to vitest's own built-in default exclude list
// (node_modules, dist, .git, etc. -- untouched, vitest merges rather than replaces when `exclude`
// is provided in most versions, but the defaults are re-listed here too so this stays correct even
// if that assumption is ever wrong for this vitest version) and removes exactly these 11 paths
// from the run, and nothing else. They are NOT renamed and NOT deleted -- their own `node <path>`
// invocation continues to work unchanged, and every other `*.test.ts` file (including real vitest
// suites with adjacent names, e.g. `classify_cascade.*.test.ts`) is unaffected.
const LEGACY_MANUAL_ASSERT_FILES = [
  'src/main/liana_cycle/elements/answer_key_exclusion_reask.test.ts',
  'src/main/liana_cycle/elements/banyan_metric_standard.test.ts',
  'src/main/liana_cycle/elements/catalyst_words.bound_term.test.ts',
  'src/main/liana_cycle/elements/method_question_generator.test.ts',
  'src/main/liana_cycle/liana_terminal_engine.contingency_operator.test.ts',
  'src/main/liana_cycle/liana_terminal_engine.PERIMETER_gate_and_cost.test.ts',
  'src/main/liana_cycle/liana_terminal_engine.sc01_crash_safety.test.ts',
  'src/main/liana_cycle/methods/comparative_cascade.test.ts',
  'src/main/liana_cycle/methods/compute_select_cascade.test.ts',
  'src/main/liana_cycle/stepped_audible.test.ts',
  'src/main/liana_cycle/survey_stage.test.ts',
];

export default defineConfig({
  resolve: {
    extensions: ['.mts', '.ts', '.tsx', '.mjs', '.js', '.jsx', '.json'],
  },
  test: {
    exclude: [
      // vitest's own built-in defaults, re-listed explicitly rather than assumed, so setting
      // `exclude` here cannot silently un-ignore node_modules/dist/etc. on any vitest version.
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
      ...LEGACY_MANUAL_ASSERT_FILES,
    ],
  },
});
