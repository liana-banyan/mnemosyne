// board_alarm_actions.test.ts -- BP148 D-BP148-031
//
// Test harness for the alarm-key stability/extraction logic (src/shared/board/alarm_key.ts) and
// the safety GUARDS in board_alarm_actions.ts (empty-file refusal, unconfirmed-discard refusal).
// Mirrors this tree's own prior-art convention for same-process-runnable main-module tests
// (src/main/crystal/crystal_store.test.ts, src/main/rooting_rule.test.ts): manual assert() +
// console output + process.exit(1) on failure, no test-framework dependency, runnable directly
// via `node` (Node 24's built-in TypeScript type-stripping, commonjs mode).
//
// Run:
//   node src\main\board\board_alarm_actions.test.ts
//
// SCOPE NOTE: this harness deliberately does NOT exercise commitUnownedFiles/parkUnownedFiles's
// or discardUnownedFiles's REAL git paths (add/commit/checkout -b/reset/unlink) -- doing so
// against the live mnemosyne working tree during a test run would itself create the exact kind
// of stray commit/branch/deleted-file this ticket's own safety discipline exists to prevent, and
// this repo has no disposable scratch git fixture wired up for board_alarm_actions.ts to target
// instead (unlike crystal_store.test.ts's MNEM_CRYSTAL_DIR env-var indirection). What IS tested
// here is every GUARD that runs before any git/filesystem mutation would happen: empty-file
// refusal (requireNonEmptyFiles, exercised via the three exported action functions) and the
// unconfirmed-discard refusal, both of which return before touching git and are therefore safe
// to call for real, even against this actual repo.
//
// DEVIATION FROM THE crystal_store.test.ts/rooting_rule.test.ts raw-.ts convention, STATED
// EXPLICITLY (mirrors mnem_eblet_store.test.ts's own documented reason -- do not "fix" this by
// re-trying the raw-.ts require path, it was tried and empirically fails): board_alarm_actions.ts
// has a PRE-EXISTING extensionless sibling import (`from './board_state_reader'`), and that file
// in turn imports nothing extra problematic, but Node's require-time type-stripping resolves
// extensionless specifiers via strict ESM resolution, which does NOT probe the `.ts` extension
// the way tsc's own moduleResolution does -- confirmed by direct repro this session:
//   node -e "require('./src/main/board/board_alarm_actions.ts')"
//   -> Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...\board_state_reader'
// So this test requires the COMPILED dist/main/board/*.js (run `npm run build:main` first),
// exactly like mnem_eblet_store.test.ts. src/shared/board/alarm_key.ts has NO sibling imports of
// its own, so it is still required from its raw .ts source -- only board_alarm_actions.ts needs
// the compiled path.
//
// Run (after `npm run build:main`):
//   node src\main\board\board_alarm_actions.test.ts
//
// Tests:
//   1. canonicalizeAlarmKey is STABLE across the exact volatility board_state_reader.ts's own
//      computeBoardSnapshot() documents (elapsed minutes on STALLED, ticket-count on IDLE) --
//      the whole reason this function exists: a dismissal must not un-dismiss itself on the next
//      15s poll tick just because the minute counter advanced.
//   2. canonicalizeAlarmKey DOES change when the real-world subject changes (different ticket ids
//      / files / worker) -- it must not be so loose that two genuinely different alarms collide
//      onto the same dismissal.
//   3. extractLeadingTicketId / extractStalledTarget / extractIdleQueuedIds / extractUnownedFiles
//      against the EXACT message shapes board_state_reader.ts's alarms array construction uses
//      (copied verbatim from that file, not paraphrased).
//   4. discardUnownedFiles refuses without confirm:true, before any fs/git call.
//   5. commitUnownedFiles / parkUnownedFiles / discardUnownedFiles all refuse an empty file list
//      (the wildcard-shaped no-op guard) rather than silently succeeding at nothing.

(function main(): void {

const {
  canonicalizeAlarmKey,
  extractLeadingTicketId,
  extractStalledTarget,
  extractIdleQueuedIds,
  extractUnownedFiles,
} = require('../../shared/board/alarm_key.ts');

// Compiled path -- see this file's header for why the raw .ts require fails for this
// particular module (extensionless sibling import of board_state_reader.ts).
const {
  commitUnownedFiles,
  parkUnownedFiles,
  discardUnownedFiles,
} = require('../../../dist/main/board/board_alarm_actions.js');

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}${detail ? ' -- ' + detail : ''}`);
    failed++;
  }
}

// ── Test 1: stable across volatile wording ───────────────────────────────────
console.log('\nTest 1: canonicalizeAlarmKey is stable across volatile re-wording');
{
  const stalledEarly = { kind: 'STALLED', message: 'KN-BP144-10 dispatched 13m ago, no activity on src/main/board/board_ipc.ts.' };
  const stalledLater = { kind: 'STALLED', message: 'KN-BP144-10 dispatched 47m ago, no activity on src/main/board/board_ipc.ts.' };
  assert(
    canonicalizeAlarmKey(stalledEarly) === canonicalizeAlarmKey(stalledLater),
    'STALLED key unchanged when only elapsed minutes changes (13m -> 47m)',
  );

  const idleThree = { kind: 'IDLE', message: 'nothing is running and 3 ticket(s) are written and undispatched: KN-BP148-1, KN-BP148-2, KN-BP148-3' };
  const idleThreeReordered = { kind: 'IDLE', message: 'nothing is running and 3 ticket(s) are written and undispatched: KN-BP148-3, KN-BP148-1, KN-BP148-2' };
  assert(
    canonicalizeAlarmKey(idleThree) === canonicalizeAlarmKey(idleThreeReordered),
    'IDLE key unchanged when the same 3 ids are listed in a different order',
  );

  const unownedA = { kind: 'UNOWNED', message: 'uncommitted changes with no dispatched ticket: src/a.ts, src/b.ts' };
  const unownedAReordered = { kind: 'UNOWNED', message: 'uncommitted changes with no dispatched ticket: src/b.ts, src/a.ts' };
  assert(
    canonicalizeAlarmKey(unownedA) === canonicalizeAlarmKey(unownedAReordered),
    'UNOWNED key unchanged when the same file list is listed in a different order',
  );
}

// ── Test 2: genuinely different alarms get genuinely different keys ─────────
console.log('\nTest 2: canonicalizeAlarmKey differs for genuinely different subjects');
{
  const orphanA = { kind: 'ORPHANED', message: 'KN-BP148-1 has a report claiming code work and no commit. Verify before believing it.' };
  const orphanB = { kind: 'ORPHANED', message: 'KN-BP148-2 has a report claiming code work and no commit. Verify before believing it.' };
  assert(canonicalizeAlarmKey(orphanA) !== canonicalizeAlarmKey(orphanB), 'ORPHANED key differs for a different ticket id');

  const stalledX = { kind: 'STALLED', message: 'KN-BP148-1 dispatched 20m ago, no activity on src/a.ts.' };
  const stalledY = { kind: 'STALLED', message: 'KN-BP148-1 dispatched 20m ago, no activity on src/b.ts.' };
  assert(canonicalizeAlarmKey(stalledX) !== canonicalizeAlarmKey(stalledY), 'STALLED key differs for a different target file, same ticket');

  const unownedX = { kind: 'UNOWNED', message: 'uncommitted changes with no dispatched ticket: src/a.ts' };
  const unownedY = { kind: 'UNOWNED', message: 'uncommitted changes with no dispatched ticket: src/a.ts, src/c.ts' };
  assert(canonicalizeAlarmKey(unownedX) !== canonicalizeAlarmKey(unownedY), 'UNOWNED key differs when the file set actually differs');
}

// ── Test 3: per-kind subject extraction against real message shapes ─────────
console.log('\nTest 3: subject extraction matches board_state_reader.ts\'s real message shapes');
{
  assert(
    extractLeadingTicketId('KN-BP148-1 has a report claiming code work and no commit. Verify before believing it.') === 'KN-BP148-1',
    'extractLeadingTicketId: ORPHANED shape',
  );
  assert(
    extractLeadingTicketId('KN-BP144-1 dispatched 13m ago, no activity on its target.') === 'KN-BP144-1',
    'extractLeadingTicketId: does not cross-match KN-BP144-1 vs KN-BP144-11',
  );
  assert(
    extractLeadingTicketId('KN-BP144-11 dispatched 13m ago, no activity on its target.') === 'KN-BP144-11',
    'extractLeadingTicketId: KN-BP144-11 still matches its own full id',
  );

  assert(
    extractStalledTarget('KN-BP148-1 dispatched 13m ago, no activity on src/main/board/board_ipc.ts.') === 'src/main/board/board_ipc.ts',
    'extractStalledTarget: real target path shape',
  );
  assert(
    extractStalledTarget('KN-BP148-1 dispatched 13m ago, no activity on its target.') === null,
    'extractStalledTarget: "its target" fallback (no real path known) returns null, not the literal words',
  );

  const idleIds = extractIdleQueuedIds('nothing is running and 2 ticket(s) are written and undispatched: KN-BP148-5, KN-BP148-6');
  assert(idleIds.length === 2 && idleIds[0] === 'KN-BP148-5' && idleIds[1] === 'KN-BP148-6', 'extractIdleQueuedIds: preserves message order (first = next to dispatch)');

  const unownedFiles = extractUnownedFiles('uncommitted changes with no dispatched ticket: src/main/plow/plow_mc_answerer.ts, src/main/plow/plow_mc_answerer_generator_wiring.test.ts');
  assert(
    unownedFiles.length === 2 &&
    unownedFiles[0] === 'src/main/plow/plow_mc_answerer.ts' &&
    unownedFiles[1] === 'src/main/plow/plow_mc_answerer_generator_wiring.test.ts',
    'extractUnownedFiles: matches the Founder\'s own worked-example UNOWNED alarm text',
  );
}

// ── Test 4/5: guards run before any git/filesystem mutation ─────────────────
async function runGuardTests(): Promise<void> {
  console.log('\nTest 4: discardUnownedFiles refuses without confirm:true');
  {
    const result = await discardUnownedFiles(['src/does-not-matter.ts'], false);
    assert(result.ok === false, 'discard without confirm:true returns ok:false');
    assert(!!result.error && /confirm/i.test(result.error), 'discard without confirm:true names the reason', result.error);
    assert(result.results.length === 0, 'discard without confirm:true never touched a single file');
  }

  console.log('\nTest 5: commit/park/discard all refuse an empty file list');
  {
    const c = await commitUnownedFiles([], 'irrelevant message');
    assert(c.ok === false && c.sha === null, 'commitUnownedFiles([]) refuses rather than committing nothing');

    const p = await parkUnownedFiles([], 'irrelevant-branch-name', 'irrelevant message');
    assert(p.ok === false && p.branch === null, 'parkUnownedFiles([]) refuses rather than creating an empty branch');

    const d = await discardUnownedFiles([], true);
    assert(d.ok === false && d.results.length === 0, 'discardUnownedFiles([], true) refuses even WITH confirm -- an empty list is never a valid destructive call');
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void runGuardTests();

})();
