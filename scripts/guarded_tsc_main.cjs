#!/usr/bin/env node
/**
 * guarded_tsc_main.cjs -- D-BP200-XO-040/BISHOP-M0/SEG. The wrapper "build:main" / "dev:main" /
 * "dev:main:cdp" now call instead of running "tsc -p tsconfig.main.json" directly. It refuses
 * loudly, before touching dist at all, when a measurement run holds the dist-emit lock.
 *
 * WHY THIS EXISTS: measured last night, a SEG rebuilt dist/ here while another SEG was mid-sweep
 * against that same dist -- the sweep's own freshness check (assertPlowDistFresh() in
 * BISHOP_DROPZONE/D-BP165-M0-019_MMLU_PRO_SWEEP/mmlu_pro_plow_sweep.cjs) only checks ONCE, at
 * start, so nothing caught a rebuild mid-run and the run's own output said nothing about it. `tsc`
 * itself has no notion of this lock -- this wrapper is the only place the check can live without
 * patching TypeScript.
 *
 * LOCK PRIMITIVE: HARDWIRE/tools/controls/dist_emit_lock.js, this dispatch's thin wrapper around
 * the estate's own yoke_claim.sh (HARDWIRE/tools/yoke_claim.sh). See that file's header for the
 * full mechanism (fixed lock id DIST-EMIT-LOCK-mnemosyne, TTL+age-based takeover). This wrapper
 * only ever calls "check" (read-only) -- it never acquires or releases the lock itself; that is
 * the measurement harness's job, via run_with_dist_lock.js in the same controls directory.
 *
 * USAGE (matches the tsc -p invocation it replaces)
 *   node scripts/guarded_tsc_main.cjs tsconfig.main.json
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const MNEMOSYNE_ROOT = path.resolve(__dirname, '..');
const LB = process.env.LB_LEDGER_ROOT || 'C:/Users/Administrator/Documents/LianaBanyanPlatform';
const LOCK_TOOL = path.join(LB, 'HARDWIRE', 'tools', 'controls', 'dist_emit_lock.js');

const tsconfigArg = process.argv[2] || 'tsconfig.main.json';

console.log('[guarded_tsc_main] checking dist-emit lock before "npx tsc -p ' + tsconfigArg + '" ...');
const check = spawnSync(process.execPath, [LOCK_TOOL, 'check'], { cwd: MNEMOSYNE_ROOT, stdio: 'inherit' });
if (check.status !== 0) {
  console.error('[guarded_tsc_main] BUILD REFUSED (dist-emit-lock) -- see message above. Emitting dist now '
    + 'while a measurement run is in flight would corrupt that run\'s binary mid-sweep (D-BP200-XO-040). '
    + 'Refusing "npx tsc -p ' + tsconfigArg + '".');
  process.exit(check.status || 1);
}

// ─── SECOND, OBSERVATIONAL CHECK.  D-BP200-M0-h2cbp8qg-051, extending D-BP200-XO-040. ──────────
//
// THE HOLE THIS CLOSES IS ONE D-BP200-XO-040 DOCUMENTED ITSELF, under "What was NOT fixed":
// mmlu_pro_plow_sweep.cjs was never wired to ACQUIRE the lock, because a live scoped claim on
// that directory made editing it the two-Bishops-same-airplane hazard. So the lock is COOPERATIVE
// -- it only protects against harnesses that opted in, and a sweep launched the ordinary way holds
// no lock at all.
//
// MEASURED CONSEQUENCE, on this very build wrapper's watch: at 2026-08-27T14:09Z the XO emitted
// dist while believing it had checked for a sweep. The lock said FREE and it was telling the
// truth -- no one had claimed it. A cooperative lock cannot see an uncooperative process.
//
// SO ASK THE PROCESS TABLE TOO. sweep_in_flight.js matches an INVOCATION SHAPE rather than a
// substring, and reports UNKNOWN rather than CLEAR when it cannot read the table, so a check that
// did not complete can never be mistaken for a clean board.
//
// THE TWO CHECKS ARE DELIBERATELY DIFFERENT IN KIND. The lock is a DECLARATION (a harness saying
// "I am running"); this is an OBSERVATION (a process actually running). Either one alone has a
// blind spot the other covers: the lock catches a harness that has claimed but not yet spawned,
// and the observation catches every harness that never claims. Requiring BOTH to be clear is why
// this is belt and suspenders rather than a second copy of the same idea.
//
// FAILS OPEN ON ABSENCE, ON PURPOSE. If sweep_in_flight.js is missing, this warns and proceeds --
// a build tool must not become the reason nobody can build. A held lock still refuses.
const SWEEP_CHECK = path.join(LB, 'HARDWIRE', 'tools', 'controls', 'sweep_in_flight.js');
if (fs.existsSync(SWEEP_CHECK)) {
  console.log('[guarded_tsc_main] lock is free -- now asking the process table whether a sweep is actually running...');
  const observed = spawnSync(process.execPath, [SWEEP_CHECK], { cwd: MNEMOSYNE_ROOT, stdio: 'inherit' });
  if (observed.status !== 0) {
    console.error('[guarded_tsc_main] BUILD REFUSED (sweep observed in flight) -- see above. No lock was held, '
      + 'but a sweep IS running, and the plow dist-freshness check is a start-of-run snapshot. '
      + 'Emitting now would leave that run comparing across two builds while its report still claims fresh.');
    process.exit(1);
  }
} else {
  console.warn('[guarded_tsc_main] WARNING: ' + SWEEP_CHECK + ' not found. '
    + 'Proceeding on the cooperative lock ALONE -- a sweep that never claimed the lock is invisible to this build.');
}

console.log('[guarded_tsc_main] lock is free -- proceeding: npx tsc -p ' + tsconfigArg);
const build = spawnSync('npx', ['tsc', '-p', tsconfigArg], { cwd: MNEMOSYNE_ROOT, stdio: 'inherit', shell: true });
process.exit(build.status == null ? 1 : build.status);
