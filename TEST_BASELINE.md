# TEST_BASELINE.md -- D-BP152-047/BISHOP/seg-wire-survey-parts-and-baseline, STAGE 2/2

**Measured at:** commit `7e35bd40` (this ticket's own stage 1) with the working tree also
carrying D-BP152-046's then-uncommitted stage-2 edits to `script.ts`/`script_runner.ts`/
`script_bridge.ts`(none)/tests -- that concurrent dispatch committed those same bytes as
`caf7b873` moments after this run started. **HEAD is now `caf7b873`, and `git status --porcelain`
is clean** (only the pre-existing `release/latest.yml` diff and the pre-existing untracked
`scripts/kn_bp147_003_m1_evidence_mechanism_retroreplay.mjs` remain) -- so this baseline is valid
against current HEAD, not just the moment it was captured.

**Date:** 2026-08-11.

**Command:** `npx vitest run` (full suite, default config, no filters).

**Do NOT fix, skip, or delete any test to change these numbers.** This file records what is true
today. A later run is compared against it per the "HOW TO COMPARE" section at the bottom.

---

## HEADLINE COUNTS (vitest's own summary line, verbatim)

```
 Test Files  89 failed | 18 passed (107)
      Tests  29 failed | 220 passed (249)
     Errors  6 errors
   Duration  60.79s
```

**Read this carefully before trusting "89 failed":** 89 is a *file* count, not a *test* count.
Of those 89 failing files, **only 7 ever got as far as running a real vitest test** (and between
them contributed all 29 failed tests). The other **82 failing files collected zero tests** --
vitest reports the whole file as 1 failure because it either found no `describe`/`test` call, hit
`process.exit()` before returning control, or could not even be `require()`d. Those 82 are not 82
separate broken features; they resolve to a small number of **systemic causes**, below.

---

## SYSTEMIC CAUSE 1 -- `dist/` is a compiled CommonJS build output, and vitest's default include
glob picks it up alongside `src/`. 50 of the 89 failing files.

`dist/` (the `tsc -p tsconfig.main.json` output, CommonJS target) contains a `.test.js` next to
every `.test.ts` under `src/main` and `src/shared` that has ever been built. Nothing in this repo's
`.test.ts` convention -- neither a real vitest suite nor the manual-assert-harness convention
(Systemic Cause 2, below) -- is written to be *executed as compiled CommonJS output under vitest*.
Running the full suite therefore fails every `dist/**/*.test.js` file it finds, via three symptom
shapes of the one cause:

- **"Vitest cannot be imported in a CommonJS module using require()."** -- the compiled file still
  contains `require('vitest')` (from `import { describe, test, ... } from 'vitest'` in the
  source), and vitest's own package is ESM-only. 28 files, e.g.
  `dist/main/liana_cycle/library/method_registry.test.js`,
  `dist/main/liana_cycle/library/script_bridge.test.js`,
  `dist/main/liana_cycle/library/survey_steps.test.js` (all three of whose **`src/` originals pass
  cleanly** -- proof this is a `dist/`-only artifact, not a real regression; see Stage 1's own
  targeted run of exactly these three files, 27/27 passed).
- **"Cannot find module './xxx.ts'"** -- the manual-harness convention's own files
  (`require('./crystal_store.ts')` etc., see Systemic Cause 2) keep their `.ts`-suffixed
  `require()` verbatim through compilation (tsc does not rewrite `require()` string literals), so
  the compiled `.js` copy requires a sibling that was never emitted with a `.ts` extension. 4 files.
- **"No test suite found in file dist/...test.js"** / **`process.exit` mid-run** -- the compiled
  copy of a Systemic-Cause-2 manual-harness file, same shape as its `src/` original, just compiled.
  18 files.

**Full list of the 50 (path only -- see above for which of the three shapes each hits):**
```
dist/main/ai_dispatch_ipc_escalation_ladder.test.js
dist/main/battery_dispatch_plugin_endpoint.test.js
dist/main/cdp_guard.test.js
dist/main/hex_terminal_telemetry.test.js
dist/main/mnem_eblet_store.test.js
dist/main/mnem_eblet_store_serve_ranking.test.js
dist/main/nexus_lookup_authority_routing.test.js
dist/main/rooting_rule.test.js
dist/shared/plow/browser_authority_types.run_thread_context.test.js
dist/shared/plow/browser_authority_types.thread.test.js
dist/main/board/board_alarm_actions.test.js
dist/main/crystal/crystal_store.test.js
dist/main/homework/homework_runner.test.js
dist/main/keys_engines/peer_artifact_verify.test.js
dist/main/liana_cycle/demand_test.six_demand_types.test.js
dist/main/liana_cycle/liana_terminal_engine.ask_google_this.test.js
dist/main/liana_cycle/liana_terminal_engine.contingency_operator.test.js
dist/main/liana_cycle/liana_terminal_engine.nexus_capture.test.js
dist/main/liana_cycle/liana_terminal_engine.pause_at_step_zero.test.js
dist/main/liana_cycle/liana_terminal_engine.sc01_crash_safety.test.js
dist/main/liana_cycle/liana_terminal_engine.step_zero.test.js
dist/main/liana_cycle/stepped_audible.test.js
dist/main/liana_cycle/survey_stage.test.js
dist/main/query_capture/query_capture_store.test.js
dist/main/plow/nexus_authority_bookmarks_store.test.js
dist/main/plow/nexus_authority_persistent_session.browser_bar.test.js
dist/main/plow/nexus_authority_persistent_session.machine_driven.test.js
dist/main/plow/nexus_authority_persistent_session.open_from_pause.test.js
dist/main/plow/plow_derived_quantity_reconciler.test.js
dist/main/plow/plow_generator_cascade.test.js
dist/main/plow/plow_mc_answerer.adjudication_always.test.js
dist/main/plow/plow_mc_answerer_generator_wiring.test.js
dist/main/plow/plow_mc_elimination_cascade.test.js
dist/main/stripe/substrate-market-stripe.test.js
dist/main/wire/hex-encode.test.js
dist/main/army_ants/__tests__/posse_decompose.test.js
dist/main/liana_cycle/elements/answer_key_exclusion_reask.test.js
dist/main/liana_cycle/elements/banyan_metric_standard.test.js
dist/main/liana_cycle/elements/catalyst_words.bound_term.test.js
dist/main/liana_cycle/elements/method_question_generator.test.js
dist/main/liana_cycle/methods/comparative_cascade.test.js
dist/main/liana_cycle/library/laboratory_store.test.js
dist/main/liana_cycle/library/method_identity.test.js
dist/main/liana_cycle/library/method_registry.test.js
dist/main/liana_cycle/library/orphan_catalog.test.js
dist/main/liana_cycle/library/script.test.js
dist/main/liana_cycle/library/script_bridge.test.js
dist/main/liana_cycle/library/script_runner.test.js
dist/main/liana_cycle/library/survey_script.test.js
dist/main/liana_cycle/library/survey_steps.test.js
```
This ticket did **not** write to `dist\` and did **not** touch vitest's config to exclude it --
that would be a fix, and Stage 2's own instruction is to capture, not fix. Flagged here as a real,
actionable finding for a future ticket: `dist/` should be excluded from vitest's test glob (or
never receive a `.test.js` at all).

---

## SYSTEMIC CAUSE 2 -- pre-existing "manual assert() + `process.exit()`" test files are not real
vitest suites. 28 `src/` files + 3 of the 4 "other path" files (below), all with **zero tests
collected**, none of them a regression.

Documented, pre-existing convention -- see the file header of
`src/main/plow/plow_generator_cascade.test.ts` (D-BP148-003/007 lineage): these files use
`(async function main() {...})()`, hand-rolled `assert()`, `console.log`, and `process.exit(0/1/2)`
instead of `describe`/`test`. Their own header says outright: run via
`node src\main\plow\plow_generator_cascade.test.ts` (Node's native TS type-stripping) or against
the **compiled `dist\` output** -- never via vitest. Under vitest they fail one of two ways:
- **"No test suite found in file ..."** -- vitest finds zero `describe`/`test` calls (20 files).
- **"process.exit unexpectedly called with N"** -- the harness's own env-var/scratch-dir guard
  fires and calls `process.exit()` (even `process.exit(0)` on success still trips vitest), or the
  harness's normal end-of-run `process.exit(failed>0?1:0)` fires (8 files + `scripts/register_gate.test.mjs`).

**Full list of the 28 `src/` files (all "No test suite found" unless marked otherwise):**
```
src/main/ai_dispatch_ipc_escalation_ladder.test.ts
src/main/battery_dispatch_plugin_endpoint.test.ts
src/main/cdp_guard.test.ts
src/main/hex_terminal_telemetry.test.ts                 -- process.exit(2): "set MNEM_HEX_TELEMETRY_DIR to a scratch directory before running"
src/main/mnem_eblet_store.test.ts
src/main/mnem_eblet_store_serve_ranking.test.ts
src/main/nexus_lookup_authority_routing.test.ts
src/main/rooting_rule.test.ts
src/main/board/board_alarm_actions.test.ts
src/main/crystal/crystal_store.test.ts                  -- process.exit(1): "Refusing to run against an unspecified/shared [store]"
src/main/homework/homework_runner.test.ts
src/main/keys_engines/peer_artifact_verify.test.ts
src/main/liana_cycle/liana_terminal_engine.contingency_operator.test.ts
src/main/liana_cycle/liana_terminal_engine.sc01_crash_safety.test.ts
src/main/liana_cycle/stepped_audible.test.ts
src/main/liana_cycle/survey_stage.test.ts
src/main/plow/plow_derived_quantity_reconciler.test.ts
src/main/plow/plow_generator_cascade.test.ts
src/main/plow/plow_mc_answerer.adjudication_always.test.ts
src/main/plow/plow_mc_elimination_cascade.test.ts
src/main/query_capture/query_capture_store.test.ts
src/main/stripe/substrate-market-stripe.test.ts
src/main/wire/hex-encode.test.ts
src/main/liana_cycle/elements/answer_key_exclusion_reask.test.ts
src/main/liana_cycle/elements/banyan_metric_standard.test.ts
src/main/liana_cycle/elements/catalyst_words.bound_term.test.ts
src/main/liana_cycle/elements/method_question_generator.test.ts
src/main/liana_cycle/methods/comparative_cascade.test.ts
```
Note: `src/main/liana_cycle/methods/comparative_cascade.test.ts` is on this list (harness
mismatch, zero tests collected) -- **not** the same file as the FORBIDDEN
`methods/comparative_cascade.ts`, which this ticket proved byte-identical (see VERIFY section
below). The `.test.ts` is a pre-existing manual-harness file this ticket never touched.

---

## THE 4 "OTHER PATH" FAILURES (not `src/main` or `dist/`)

```
scripts/register_gate.test.mjs                                              -- Systemic Cause 2 shape: process.exit(0) at its own normal successful end, still trips vitest
scratchpad/seg_bp148_012_ATTEMPTED_NOT_VALIDATED_plow_generator_cascade.test.ts -- Systemic Cause 2 shape: "No test suite found" (a scratch script, own filename says ATTEMPTED_NOT_VALIDATED)
caithedral-core/tests/smoke.test.ts                                         -- Systemic Cause 2 shape: "No test suite found" (separate sub-project, own test runner, swept up by root vitest's glob)
test/four-frame-helena.test.ts                                              -- DIFFERENT cause: uses Playwright's test.describe() (@playwright/test), which throws "Playwright Test did not expect test.describe() to be called here" when collected by vitest instead of the Playwright runner -- a test-runner mismatch, not a code defect.
```

---

## THE 7 REAL FAILURES -- files that ran as genuine vitest suites and had genuine failing
assertions. **29 failed tests, 3 causes.**

### Cause A -- Survey's splice gate removal (`bc1e9632`, D-BP152-039) makes Survey run
unconditionally on the default path; these tests' mocked `askGoogle`/network harness does not
cover Survey's real (live-network) code path, so the run hangs until vitest's 5000ms default
`testTimeout`. **5 files, 25 tests, ALL "Test timed out in 5000ms."** Stated as the most likely
cause given the timing match and the commit's own description ("Survey doesn't need the env var" /
"no modes and no flags" -- Survey now always runs); not independently re-diagnosed line-by-line in
this ticket, per Stage 2's own scope ("capture, not fix").

- `src/main/liana_cycle/liana_terminal_engine.step_zero.test.ts` (3 failed):
  - `qid input: Step 0 is the FIRST STEP of the run, fires exactly once, and carries qid+corpus as source, verbatim question, verbatim options, optionsExist=true`
  - `free-text input WITH inline lettered options: Step 0 carries them verbatim, optionsExist=true`
  - `(c) free-text input with NO option list: Step 0 handles the no-options case as first-class -- flag false, no throw, no silently empty list`
- `src/main/liana_cycle/liana_terminal_engine.ask_google_this.test.ts` (7 failed):
  - `(a) the query reaching askGoogle is byte-identical to what was typed, except whitespace at the very ends`
  - `(b) the raw response is captured untruncated in the transcript -- no length cap, no truncation marker`
  - `(c) the run pauses again after the result rather than advancing`
  - `(d) Correct and Redirect behave exactly as before -- exactly one pause, run proceeds past STEP 0 unchanged, no Google call`
  - `(e) with Call an Audible OFF, nothing changes at all -- byte-identical to the pre-ticket baseline, askGoogle/emit/options never touched`
  - `(f) the contamination flag fires when the typed text contains an option string, and does not fire when it does not -- never blocks either way`
  - `an empty typed query sends nothing to Google and re-pauses honestly, rather than calling Google on an empty string`
- `src/main/liana_cycle/liana_terminal_engine.nexus_capture.test.ts` (7 failed):
  - `(a) captured text round-trips byte-identical from page to run state -- no length cap, no truncation`
  - `(b) surface identity and URL are recorded with EVERY capture, including an empty one`
  - `(c) capture only ever fires on the explicit nexus_capture action -- approve/ask_google never produce a capture line`
  - `(d) the existing askGoogle path is byte-unchanged: ask_google and nexus_capture can interleave in the same run without affecting each other`
  - `(e) the run pauses again after a capture rather than advancing`
  - `(f) the contamination flag fires when captured text contains an option string, and does not fire when it does not -- never blocks`
  - `citations captured alongside a Nexus answer are recorded as APPEARANCES: new domain on first sight, appended on the next`
- `src/main/liana_cycle/liana_terminal_engine.pause_at_step_zero.test.ts` (4 failed):
  - `(a)+(b) Call an Audible ON: a pause fires at STEP 0, before any query is issued, carrying the question, options, options-exist flag and source`
  - `(c) Call an Audible OFF: no pause fires, run is byte-identical to the dfb891d7 baseline`
  - `(d) every pause that fired before (per-step pauses once a method runs) still fires, in the same order, with the STEP 0 pause first`
  - `(e) a STEP 0 pause has no timeout -- it waits for the channel to resolve, however long that takes, and is not resolved by any internal timer`
- `src/main/liana_cycle/library/survey_script.test.ts` (4 failed):
  - `assertion (c) [quoted/cued-term path]: explicit term supplied -- step2 takes the single-call branch, gate trivially true, all four steps run identically`
  - `assertion (c) [no-term path]: no quoted/cued term, no live Google -- ambiguity/operation both refuse, step2 refuses, gate runs step3 as the fallback`
  - `assertion (d): omitting JarMethod:1 leaves step2/step3/step4 populated and step6 absent from the run -- nothing else changes`
  - `assertion (e): running DetermineRegister:1 before Categorize:1 changes the recorded run order`

### Cause B -- `laboratory_store.test.ts`'s own structural regression-guard string was not updated
when `nexus_capture` was added to `LianaSteppedAction`. **1 file, 1 test.**
- `src/main/liana_cycle/library/laboratory_store.test.ts`:
  - `(e) "keep" never touches the stepped-pause action union -- structural regression guard`
  - Received `'approve' | 'correct' | 'redirect' | 'abandon' | 'ask_google' | 'nexus_capture'`,
    expected the same string without `| 'nexus_capture'`. The type itself is presumably correct
    (nexus_capture is a real, shipped action per D-BP152-025); the test's own hardcoded expected
    string is what's stale. Not touched by this ticket -- `laboratory_store.ts`/`.test.ts` are
    outside this ticket's scope and FORBIDDEN files list does not cover them, but they were also
    never edited here.

### Cause C -- requires a live Supabase connection this environment does not have. **1 file, 3
tests.**
- `src/main/army_ants/__tests__/posse_decompose.test.ts`:
  - `decomposeQuestion > returns 3 sub-claims from valid LLM JSON response`
  - `decomposeQuestion > falls back to single sub-claim on malformed LLM response`
  - `decomposeQuestion > handles timeout gracefully (no replies)`
  - Error: `posse_decompose: relay_routes INSERT returned no id` at
    `src/main/army_ants/posse_decompose.ts:161` -- `decomposeViaRelay()` posts to a live Supabase
    `relay_routes` table and the insert comes back with no id, consistent with no reachable/
    configured Supabase instance in this sandbox.

---

## `--noEmit` TSC BASELINE (measured this same session, same commit)

- `npx tsc -p tsconfig.main.json --noEmit` -- **0 errors** (matches the `b53f8942` baseline of 0).
- `npx tsc -p tsconfig.renderer.json --noEmit` -- **93 errors** (matches the `b53f8942` baseline of
  93; none of the 93 error lines mention `script_bridge`, `survey_steps`, or `method_registry` --
  confirmed by grep against this ticket's own Stage 1 change).

---

## HOW TO COMPARE A LATER RUN AGAINST THIS BASELINE

1. Run `npx vitest run` in full (do not filter to a subdirectory -- the systemic causes above are
   only visible at full-suite scope).
2. Take the summary line (`Test Files N failed | M passed`, `Tests N failed | M passed`).
3. **A file/test disappearing from this baseline's lists is GOOD** (something got fixed) and worth
   noting, but is not itself cause for alarm.
4. **A file/test appearing that is NOT in this baseline's lists is a NEW failure** -- compare its
   name against Systemic Cause 1 (path starts `dist/`) and Systemic Cause 2 (own file header says
   "manual assert" / no `describe`/`test` in the file) before concluding it is a real regression.
   If it is a genuine new vitest-suite failure not listed under "THE 7 REAL FAILURES" above, that
   is the one thing this baseline exists to catch.
5. **The dist/ list (Systemic Cause 1) will regenerate wholesale** any time `npm run build:main` is
   run and the source has diverged further from what was last built -- an unchanged *set* of
   dist/-path failures is not evidence of no regression; a *shrinking* set (fewer of the 50) most
   likely means files were deleted from `dist/`, not that anything was fixed, unless `dist/` is
   also excluded from vitest's glob (the real fix, out of this ticket's scope).
6. If the Founder or a future ticket fixes Systemic Cause 1 (exclude `dist/` from vitest's test
   glob) or Systemic Cause 2 (exclude the manual-harness files, or give vitest an `exclude` for
   them), this file's counts will drop sharply and should be **re-captured, not edited** -- write a
   fresh `TEST_BASELINE.md` (or a versioned sibling per Rule 66) rather than hand-editing this one.
