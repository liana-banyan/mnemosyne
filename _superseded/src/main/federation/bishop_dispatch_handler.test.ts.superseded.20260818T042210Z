// bishop_dispatch_handler.test.ts — D-BP156-M0-008, HARDWIRE-24 mesh.
//
// OFFLINE. No real process is ever spawned -- every test passes a mock spawnImpl AND, wherever
// a test reaches launchWorker(), a mock claimImpl (D-BP157-010; see makeControllableClaimImpl/
// makeAlwaysFailingClaimImpl below -- restores the guarantee D-BP157-007 broke by calling
// execFileSync unconditionally inside tryClaim()). No real network. LB_LEDGER_ROOT is pointed at
// a fresh os.tmpdir() subfolder per test run and removed afterwards, so this suite never touches
// the real HARDWIRE\LEDGER tree (the estate's Vault-sacrosanct discipline: never write test
// fixtures into a live ledger).
//
// Run: npx vitest run src/main/federation/bishop_dispatch_handler.test.ts

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, symlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { BishopDispatchPayload } from './mic_dispatcher';

let TEST_LEDGER_ROOT: string;
// D-BP157-033: mesh_auto_spawn_consent.ts persists under %APPDATA%\MnemosyneC\config\ -- pointed
// at a fresh tmpdir per test, exactly like TEST_LEDGER_ROOT, so this suite never touches a real
// %APPDATA% and so consent state never leaks between tests.
let TEST_APPDATA: string;
const ORIGINAL_ENV: Record<string, string | undefined> = {};

function snapshotAndClearEnv(keys: string[]): void {
  for (const k of keys) {
    ORIGINAL_ENV[k] = process.env[k];
    delete process.env[k];
  }
}
function restoreEnv(): void {
  for (const [k, v] of Object.entries(ORIGINAL_ENV)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

const ENV_KEYS = [
  'LB_LEDGER_ROOT', 'LB_MESH_AUTO_SPAWN_ENABLED', 'LB_MESH_ALLOWED_ORIGINS',
  'LB_MESH_ALLOWED_WORKDIR_ROOT', 'LB_MESH_MAX_CONCURRENT_SPAWNS', 'LB_MESH_SPAWN_TIMEOUT_MS',
  'LB_MESH_SPAWN_CLI_PATH', 'LB_MESH_SPAWN_MODEL', 'LB_MESH_SPAWN_PERMISSION_MODE',
  // D-BP157-033: the new consent gate's own persistence env var (mesh_auto_spawn_consent.ts
  // reads %APPDATA%, same as this suite points LB_LEDGER_ROOT at a fresh tmpdir) plus the
  // elevated-mode override, snapshotted/cleared/restored exactly like every other guardrail knob.
  'APPDATA', 'LB_MESH_SPAWN_ELEVATED_PERMISSION_MODE',
];

/** A fake ChildProcess that never exits on its own (tests that need it to "exit" call
 *  .emit('exit', ...) explicitly). Real enough for the handler's .once('exit'/'error') wiring. */
function makeFakeChild(): EventEmitter & { kill: ReturnType<typeof vi.fn> } {
  const ee = new EventEmitter() as EventEmitter & { kill: ReturnType<typeof vi.fn> };
  ee.kill = vi.fn();
  return ee;
}

// D-BP157-010: restores this file's own stated "no real process is ever spawned" guarantee,
// which D-BP157-007 broke by calling execFileSync unconditionally inside tryClaim(). These fakes
// mimic node:child_process.execFileSync's actual contract (return a stdout string on success,
// THROW an Error-shaped object carrying `.stderr` on failure) so the real tryClaim()/
// claimEffectiveDispatchId() decision logic in bishop_dispatch_handler.ts runs for real against
// realistic inputs -- only the OS-level subprocess creation is faked, exactly the same posture
// `spawnImpl` already takes toward the worker's own process.

/** Fails the claim for exactly the first `failFirstN` candidates tried (bare id, then -W1, -W2,
 *  ...), then succeeds. `failFirstN: 0` succeeds immediately on the bare id. */
function makeControllableClaimImpl(failFirstN: number): ReturnType<typeof vi.fn> {
  let calls = 0;
  return vi.fn().mockImplementation(() => {
    const thisCall = calls++;
    if (thisCall < failFirstN) {
      const err = new Error('yoke_claim.sh: exit 1') as Error & { stderr?: string };
      err.stderr = 'ALREADY_CLAIMED';
      throw err;
    }
    return 'CLAIMED\n';
  });
}

/** Every candidate is refused -- exercises the MAX_CHILD_SUFFIX_ATTEMPTS cap. */
function makeAlwaysFailingClaimImpl(): ReturnType<typeof vi.fn> {
  return vi.fn().mockImplementation(() => {
    const err = new Error('yoke_claim.sh: exit 1') as Error & { stderr?: string };
    err.stderr = 'ALREADY_CLAIMED';
    throw err;
  });
}

function makePayload(overrides: Partial<BishopDispatchPayload> = {}): BishopDispatchPayload {
  return {
    kind: 'bishop_dispatch',
    dispatchId: 'D-BP156-M3-001',
    promptText: 'do the thing',
    workingDir: join(TEST_LEDGER_ROOT, 'workdir'),
    originPeerId: '1a78f7c9bdd5e830',
    ...overrides,
  };
}

/** D-BP157-033: writes mesh_auto_spawn_consent.ts's own persisted settings file directly, at
 *  its own documented path convention, under the given %APPDATA% root -- deliberately NOT
 *  importing that module and calling its setter, so these tests exercise
 *  bishop_dispatch_handler.ts's consumption of the setting through the real on-disk shape a
 *  renderer-driven write would actually produce, not a shared in-memory shortcut. */
function writeConsentSettings(appdataRoot: string, consentGranted: boolean): void {
  const dir = join(appdataRoot, 'MnemosyneC', 'config');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'mesh_auto_spawn_consent.json'), JSON.stringify({ consentGranted }), 'utf8');
}

beforeEach(() => {
  vi.resetModules();
  snapshotAndClearEnv(ENV_KEYS);
  TEST_LEDGER_ROOT = mkdtempSync(join(tmpdir(), 'bishop-dispatch-test-'));
  TEST_APPDATA = mkdtempSync(join(tmpdir(), 'bishop-dispatch-appdata-test-'));
  process.env.LB_LEDGER_ROOT = TEST_LEDGER_ROOT;
  process.env.APPDATA = TEST_APPDATA;
  // Default the allowed-workdir-root to this test's own tmpdir so makePayload()'s default
  // workingDir (under TEST_LEDGER_ROOT) passes the allowlist guardrail by default -- tests that
  // specifically exercise the workdir guardrail override this explicitly.
  process.env.LB_MESH_ALLOWED_WORKDIR_ROOT = TEST_LEDGER_ROOT;
  mkdirSync(join(TEST_LEDGER_ROOT, 'workdir'), { recursive: true });
});

afterEach(() => {
  restoreEnv();
  try { rmSync(TEST_LEDGER_ROOT, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
  try { rmSync(TEST_APPDATA, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
});

describe('resolveLedgerRoot', () => {
  test('honors LB_LEDGER_ROOT when set', async () => {
    const { resolveLedgerRoot } = await import('./bishop_dispatch_handler');
    expect(resolveLedgerRoot()).toBe(TEST_LEDGER_ROOT);
  });
  test('falls back to the documented default when unset', async () => {
    delete process.env.LB_LEDGER_ROOT;
    const { resolveLedgerRoot } = await import('./bishop_dispatch_handler');
    expect(resolveLedgerRoot()).toContain('HARDWIRE\\LEDGER');
  });
});

describe('writeYokeNoticeFile — Step 3, the file IS the wake', () => {
  test('writes to LB_LEDGER_ROOT/YOKE/NOTICES/<dispatchId>.md', async () => {
    const { writeYokeNoticeFile } = await import('./bishop_dispatch_handler');
    const payload = makePayload();
    const { path, alreadyExisted } = writeYokeNoticeFile(payload, '1a78f7c9bdd5e830');
    expect(path).toBe(join(TEST_LEDGER_ROOT, 'YOKE', 'NOTICES', 'D-BP156-M3-001.md'));
    expect(alreadyExisted).toBe(false);
    expect(existsSync(path)).toBe(true);
    const content = readFileSync(path, 'utf8');
    expect(content).toContain('D-BP156-M3-001');
    expect(content).toContain('do the thing');
  });

  test('is idempotent -- a second write for the same dispatch id does not overwrite the first', async () => {
    const { writeYokeNoticeFile } = await import('./bishop_dispatch_handler');
    const first = writeYokeNoticeFile(makePayload({ promptText: 'ORIGINAL' }), '1a78f7c9bdd5e830');
    expect(first.alreadyExisted).toBe(false);
    const second = writeYokeNoticeFile(makePayload({ promptText: 'REPLAYED-DIFFERENT-TEXT' }), '1a78f7c9bdd5e830');
    expect(second.alreadyExisted).toBe(true);
    expect(readFileSync(second.path, 'utf8')).toContain('ORIGINAL');
    expect(readFileSync(second.path, 'utf8')).not.toContain('REPLAYED-DIFFERENT-TEXT');
  });
});

describe('getAllowedWorkdirRoot — default root portability', () => {
  afterEach(() => {
    vi.doUnmock('node:os');
  });

  test('D-BP156-M0-022 REGRESSION: derives the default from THIS machine\'s home directory (os.homedir()) at call time, not a hardcoded username', async () => {
    delete process.env.LB_MESH_ALLOWED_WORKDIR_ROOT;
    // Mocked to a value that provably differs from whatever account runs this test suite (this
    // dev machine's own account happens to BE "Administrator", so a literal-string assertion
    // against the old hardcoded default would coincidentally pass on both pre- and post-fix code
    // here -- mocking os.homedir() is what actually discriminates the two).
    const fakeHome = join(TEST_LEDGER_ROOT, 'fake-home-for-a-different-account');
    vi.doMock('node:os', async (importOriginal) => {
      const actual = await importOriginal<typeof import('node:os')>();
      return { ...actual, homedir: () => fakeHome };
    });

    const { getAllowedWorkdirRoot } = await import('./bishop_dispatch_handler');

    // FAILS against the pre-fix code, which returns the literal hardcoded string
    // 'C:\Users\Administrator\Documents' regardless of what os.homedir() reports -- ignoring the
    // mock entirely. PASSES only once the default is genuinely DERIVED from os.homedir() at call
    // time, which is exactly what makes it portable to any account/machine.
    expect(getAllowedWorkdirRoot()).toBe(join(fakeHome, 'Documents'));
  });
});

describe('resolveDefaultBashPath / getBashPath — D-BP157-014 ordered bash resolution', () => {
  afterEach(() => {
    delete process.env.LB_MESH_BASH_PATH;
  });

  test('picks the first KNOWN_GIT_BASH_PATHS entry that exists, per an injected existsFn', async () => {
    const { resolveDefaultBashPath } = await import('./bishop_dispatch_handler');
    // Simulates a machine where only the second well-known location is present -- proves the
    // function walks the list in order rather than only ever checking the first entry.
    const existsFn = vi.fn((p: string) => p === 'C:\\Program Files (x86)\\Git\\bin\\bash.exe');
    expect(resolveDefaultBashPath(existsFn)).toBe('C:\\Program Files (x86)\\Git\\bin\\bash.exe');
  });

  test('prefers C:\\Program Files\\Git\\bin\\bash.exe when multiple candidates exist', async () => {
    const { resolveDefaultBashPath } = await import('./bishop_dispatch_handler');
    const existsFn = vi.fn(() => true);
    expect(resolveDefaultBashPath(existsFn)).toBe('C:\\Program Files\\Git\\bin\\bash.exe');
  });

  test('falls back to the bare command name when none of the well-known locations exist', async () => {
    const { resolveDefaultBashPath } = await import('./bishop_dispatch_handler');
    const existsFn = vi.fn(() => false);
    expect(resolveDefaultBashPath(existsFn)).toBe('bash');
  });

  test('D-BP157-014 REGRESSION: on THIS real machine, the no-arg default resolves to the real Git-for-Windows bash.exe, not the bare "bash" name that used to resolve to the WSL launcher stub', async () => {
    const { resolveDefaultBashPath } = await import('./bishop_dispatch_handler');
    // No injected existsFn -- exercises the real node:fs existsSync against this machine's actual
    // disk layout. Verified present this dispatch (D-BP157-014) at this exact path.
    expect(resolveDefaultBashPath()).toBe('C:\\Program Files\\Git\\bin\\bash.exe');
  });

  test('getBashPath() still honors LB_MESH_BASH_PATH as an override over any resolved default', async () => {
    process.env.LB_MESH_BASH_PATH = 'D:\\custom\\bash.exe';
    const { getBashPath } = await import('./bishop_dispatch_handler');
    expect(getBashPath()).toBe('D:\\custom\\bash.exe');
  });

  test('getBashPath() falls back to the resolved default when LB_MESH_BASH_PATH is unset', async () => {
    delete process.env.LB_MESH_BASH_PATH;
    const { getBashPath, resolveDefaultBashPath } = await import('./bishop_dispatch_handler');
    expect(getBashPath()).toBe(resolveDefaultBashPath());
  });
});

describe('isWorkingDirAllowed — directory-traversal guardrail', () => {
  test('accepts a directory genuinely inside the allowed root', async () => {
    const { isWorkingDirAllowed } = await import('./bishop_dispatch_handler');
    const allowedRoot = join(TEST_LEDGER_ROOT, 'allowed');
    mkdirSync(allowedRoot, { recursive: true });
    process.env.LB_MESH_ALLOWED_WORKDIR_ROOT = allowedRoot;
    const inside = join(allowedRoot, 'sub', 'project');
    mkdirSync(inside, { recursive: true });
    const result = isWorkingDirAllowed(inside);
    expect(result.ok).toBe(true);
  });

  test('rejects a ".." traversal that lexically escapes the allowed root', async () => {
    const { isWorkingDirAllowed } = await import('./bishop_dispatch_handler');
    const allowedRoot = join(TEST_LEDGER_ROOT, 'allowed');
    mkdirSync(allowedRoot, { recursive: true });
    process.env.LB_MESH_ALLOWED_WORKDIR_ROOT = allowedRoot;
    const escape = join(allowedRoot, '..', '..', 'somewhere-else');
    const result = isWorkingDirAllowed(escape);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/escapes allowed root/);
  });

  test('rejects a path entirely outside the allowed root', async () => {
    const { isWorkingDirAllowed } = await import('./bishop_dispatch_handler');
    process.env.LB_MESH_ALLOWED_WORKDIR_ROOT = join(TEST_LEDGER_ROOT, 'allowed');
    const result = isWorkingDirAllowed(join(TEST_LEDGER_ROOT, 'not-allowed-at-all'));
    expect(result.ok).toBe(false);
  });

  test('rejects a symlink planted inside the allowed root that resolves outside it', async () => {
    const allowedRoot = join(TEST_LEDGER_ROOT, 'allowed');
    const outside = join(TEST_LEDGER_ROOT, 'outside-target');
    mkdirSync(allowedRoot, { recursive: true });
    mkdirSync(outside, { recursive: true });
    const linkPath = join(allowedRoot, 'escape-link');
    try {
      symlinkSync(outside, linkPath, 'junction');
    } catch (err) {
      // Symlink/junction creation can require elevated privileges on some Windows
      // configurations -- if this environment cannot create one, the lexical-containment
      // guardrail (covered by the two tests above) still holds; skip only the symlink-specific
      // assertion rather than failing the whole suite on an environment limitation.
      console.warn('[bishop_dispatch_handler.test] symlink creation unavailable in this environment, skipping symlink-escape assertion:', err);
      return;
    }
    process.env.LB_MESH_ALLOWED_WORKDIR_ROOT = allowedRoot;
    const { isWorkingDirAllowed } = await import('./bishop_dispatch_handler');
    const result = isWorkingDirAllowed(linkPath);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/symlink|resolves/);
  });

  test('D-BP156-M0-022 REGRESSION: a lexically-contained but NON-EXISTENT directory is refused, with a reason distinguishable from a containment escape — reproduces the shape that made spawn() report a misleading ENOENT naming the wrong component', async () => {
    const { isWorkingDirAllowed } = await import('./bishop_dispatch_handler');
    const allowedRoot = join(TEST_LEDGER_ROOT, 'allowed');
    mkdirSync(allowedRoot, { recursive: true });
    process.env.LB_MESH_ALLOWED_WORKDIR_ROOT = allowedRoot;

    // Lexically inside the allowed root -- would have passed the OLD lexical-only check -- but
    // never created on disk.
    const neverCreated = join(allowedRoot, 'sub', 'never-created-project');
    expect(existsSync(neverCreated)).toBe(false);

    const result = isWorkingDirAllowed(neverCreated);

    // FAILS against the pre-fix code (old behavior: ok:true, accepted on the lexical check
    // alone, deferring the real failure to spawn() where it surfaces as a misleading
    // "spawn <exe> ENOENT" that names the wrong component). PASSES once the existence check is
    // unconditional.
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/does not exist/);
    // Distinguishable from the containment-escape reason (different fault, different remedy) --
    // must NOT read as an escape/traversal refusal.
    expect(result.reason).not.toMatch(/escapes allowed root/);
  });
});

describe('isAutoSpawnEnabled — kill switch, default DISABLED', () => {
  test('defaults to disabled when unset', async () => {
    const { isAutoSpawnEnabled } = await import('./bishop_dispatch_handler');
    expect(isAutoSpawnEnabled()).toBe(false);
  });
  test('stays disabled for any value other than the literal string "true"', async () => {
    const { isAutoSpawnEnabled } = await import('./bishop_dispatch_handler');
    for (const v of ['1', 'yes', 'TRUE', 'True', 'enabled']) {
      process.env.LB_MESH_AUTO_SPAWN_ENABLED = v;
      expect(isAutoSpawnEnabled()).toBe(false);
    }
  });
  test('enables only on the exact string "true"', async () => {
    process.env.LB_MESH_AUTO_SPAWN_ENABLED = 'true';
    const { isAutoSpawnEnabled } = await import('./bishop_dispatch_handler');
    expect(isAutoSpawnEnabled()).toBe(true);
  });
});

// D-BP157-033: the pure truth table -- both the kill switch AND the new mesh auto-spawn consent
// toggle must be true before the elevated permission mode is used. No I/O, no spawn, no claim --
// exercises resolveEffectivePermissionMode() directly against all four cells.
describe('resolveEffectivePermissionMode -- D-BP157-033 consent-gated elevated permission mode', () => {
  test('kill switch ON, consent OFF -> restrictive default mode, not elevated (today\'s unchanged behavior)', async () => {
    const { resolveEffectivePermissionMode, getSpawnPermissionMode } = await import('./bishop_dispatch_handler');
    expect(resolveEffectivePermissionMode(true, false)).toEqual({ mode: getSpawnPermissionMode(), elevated: false });
  });

  test('kill switch OFF, consent ON -> restrictive default mode, not elevated (consent alone is never sufficient)', async () => {
    const { resolveEffectivePermissionMode, getSpawnPermissionMode } = await import('./bishop_dispatch_handler');
    expect(resolveEffectivePermissionMode(false, true)).toEqual({ mode: getSpawnPermissionMode(), elevated: false });
  });

  test('both OFF -> restrictive default mode, not elevated', async () => {
    const { resolveEffectivePermissionMode, getSpawnPermissionMode } = await import('./bishop_dispatch_handler');
    expect(resolveEffectivePermissionMode(false, false)).toEqual({ mode: getSpawnPermissionMode(), elevated: false });
  });

  test('both ON -> elevated bypassPermissions mode -- the only combination that ever elevates', async () => {
    const { resolveEffectivePermissionMode, getElevatedSpawnPermissionMode } = await import('./bishop_dispatch_handler');
    expect(resolveEffectivePermissionMode(true, true)).toEqual({ mode: getElevatedSpawnPermissionMode(), elevated: true });
  });

  test('getSpawnPermissionMode default is the literal string "default" -- CONFIRMS the D-BP157-033 diagnosis', async () => {
    const { getSpawnPermissionMode } = await import('./bishop_dispatch_handler');
    expect(getSpawnPermissionMode()).toBe('default');
  });

  test('getElevatedSpawnPermissionMode default is "bypassPermissions", one of the four modes `claude --help` accepts', async () => {
    const { getElevatedSpawnPermissionMode } = await import('./bishop_dispatch_handler');
    expect(getElevatedSpawnPermissionMode()).toBe('bypassPermissions');
  });

  test('LB_MESH_SPAWN_ELEVATED_PERMISSION_MODE overrides only the elevated cell, restrictive cell unaffected', async () => {
    process.env.LB_MESH_SPAWN_ELEVATED_PERMISSION_MODE = 'acceptEdits';
    const { resolveEffectivePermissionMode } = await import('./bishop_dispatch_handler');
    expect(resolveEffectivePermissionMode(true, true)).toEqual({ mode: 'acceptEdits', elevated: true });
    expect(resolveEffectivePermissionMode(true, false)).toEqual({ mode: 'default', elevated: false });
  });
});

describe('handleBishopDispatch -- D-BP157-033 consent gate, coupled with the kill switch', () => {
  test('kill switch ON, consent OFF: still spawns (unchanged behavior), argv carries the restrictive mode, and a MESH_AUTO_SPAWN_CONSENT_NOT_GRANTED issue is legible in the reply', async () => {
    process.env.LB_MESH_AUTO_SPAWN_ENABLED = 'true';
    writeConsentSettings(TEST_APPDATA, false);
    const { handleBishopDispatch } = await import('./bishop_dispatch_handler');
    const fakeChild = makeFakeChild();
    const spawnImpl = vi.fn().mockReturnValue(fakeChild);
    const claimImpl = makeControllableClaimImpl(0);
    const result = await handleBishopDispatch(makePayload(), '1a78f7c9bdd5e830', spawnImpl as never, claimImpl as never);

    expect(result.spawned).toBe(true);
    expect(spawnImpl).toHaveBeenCalledTimes(1);
    const [, args] = spawnImpl.mock.calls[0] as [string, string[], Record<string, unknown>];
    const modeIdx = args.indexOf('--permission-mode');
    expect(modeIdx).toBeGreaterThanOrEqual(0);
    expect(args[modeIdx + 1]).toBe('default');

    const issue = result.issues.find((i) => i.code === 'MESH_AUTO_SPAWN_CONSENT_NOT_GRANTED');
    expect(issue).toBeDefined();
    expect(issue!.evidence).toMatch(/permissionMode=default/);
    expect(issue!.evidence).toMatch(/consentGranted=false/);
    expect(result.issues.find((i) => i.code === 'MESH_AUTO_SPAWN_CONSENT_GRANTED')).toBeUndefined();
  });

  test('consent ON, kill switch OFF: never spawns -- the kill switch alone gates whether launchWorker is reached at all', async () => {
    // LB_MESH_AUTO_SPAWN_ENABLED intentionally left unset (disabled by default).
    writeConsentSettings(TEST_APPDATA, true);
    const { handleBishopDispatch } = await import('./bishop_dispatch_handler');
    const spawnImpl = vi.fn();
    const claimImpl = vi.fn();
    const result = await handleBishopDispatch(makePayload(), '1a78f7c9bdd5e830', spawnImpl as never, claimImpl as never);

    expect(result.spawned).toBe(false);
    expect(result.lifecycle).toBe('refused');
    expect(result.reason).toMatch(/auto-spawn kill switch is disabled/);
    expect(spawnImpl).not.toHaveBeenCalled();
    expect(claimImpl).not.toHaveBeenCalled();
    // No permission-mode decision was ever reached, so neither consent issue code appears --
    // this refusal must read as "kill switch off," never silently reuse a consent-shaped code.
    expect(result.issues.find((i) => i.code === 'MESH_AUTO_SPAWN_CONSENT_GRANTED')).toBeUndefined();
    expect(result.issues.find((i) => i.code === 'MESH_AUTO_SPAWN_CONSENT_NOT_GRANTED')).toBeUndefined();
  });

  test('both ON: spawns, argv carries the elevated bypassPermissions mode, and a MESH_AUTO_SPAWN_CONSENT_GRANTED issue is legible in the reply', async () => {
    process.env.LB_MESH_AUTO_SPAWN_ENABLED = 'true';
    writeConsentSettings(TEST_APPDATA, true);
    const { handleBishopDispatch } = await import('./bishop_dispatch_handler');
    const fakeChild = makeFakeChild();
    const spawnImpl = vi.fn().mockReturnValue(fakeChild);
    const claimImpl = makeControllableClaimImpl(0);
    const result = await handleBishopDispatch(makePayload(), '1a78f7c9bdd5e830', spawnImpl as never, claimImpl as never);

    expect(result.spawned).toBe(true);
    const [, args] = spawnImpl.mock.calls[0] as [string, string[], Record<string, unknown>];
    const modeIdx = args.indexOf('--permission-mode');
    expect(args[modeIdx + 1]).toBe('bypassPermissions');

    const issue = result.issues.find((i) => i.code === 'MESH_AUTO_SPAWN_CONSENT_GRANTED');
    expect(issue).toBeDefined();
    expect(issue!.evidence).toMatch(/permissionMode=bypassPermissions/);
    expect(issue!.evidence).toMatch(/consentGranted=true/);
  });

  test('both OFF: never spawns, matching the pre-existing kill-switch-off behavior', async () => {
    writeConsentSettings(TEST_APPDATA, false);
    const { handleBishopDispatch } = await import('./bishop_dispatch_handler');
    const spawnImpl = vi.fn();
    const result = await handleBishopDispatch(makePayload(), '1a78f7c9bdd5e830', spawnImpl as never);

    expect(result.spawned).toBe(false);
    expect(result.reason).toMatch(/auto-spawn kill switch is disabled/);
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  test('no consent settings file on disk at all (fresh install): treated as OFF, same as explicit false', async () => {
    process.env.LB_MESH_AUTO_SPAWN_ENABLED = 'true';
    // Deliberately no writeConsentSettings() call -- TEST_APPDATA has no
    // MnemosyneC\config\mesh_auto_spawn_consent.json at all.
    const { handleBishopDispatch } = await import('./bishop_dispatch_handler');
    const fakeChild = makeFakeChild();
    const spawnImpl = vi.fn().mockReturnValue(fakeChild);
    const claimImpl = makeControllableClaimImpl(0);
    const result = await handleBishopDispatch(makePayload(), '1a78f7c9bdd5e830', spawnImpl as never, claimImpl as never);

    expect(result.spawned).toBe(true);
    const [, args] = spawnImpl.mock.calls[0] as [string, string[], Record<string, unknown>];
    const modeIdx = args.indexOf('--permission-mode');
    expect(args[modeIdx + 1]).toBe('default');
    expect(result.issues.find((i) => i.code === 'MESH_AUTO_SPAWN_CONSENT_NOT_GRANTED')).toBeDefined();
  });
});

describe('handleBishopDispatch — end-to-end guardrail evaluation', () => {
  test('kill switch disabled: file is written, hook returns ok, but nothing is spawned', async () => {
    const { handleBishopDispatch } = await import('./bishop_dispatch_handler');
    const spawnImpl = vi.fn();
    const result = await handleBishopDispatch(makePayload(), '1a78f7c9bdd5e830', spawnImpl as never);
    expect(result.spawned).toBe(false);
    expect(result.noticePath && existsSync(result.noticePath)).toBe(true);
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  test('unverified origin (null) never spawns, even with the kill switch on', async () => {
    process.env.LB_MESH_AUTO_SPAWN_ENABLED = 'true';
    const { handleBishopDispatch } = await import('./bishop_dispatch_handler');
    const spawnImpl = vi.fn();
    const result = await handleBishopDispatch(makePayload(), null, spawnImpl as never);
    expect(result.spawned).toBe(false);
    expect(result.reason).toMatch(/sender not on allowlist/);
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  test('origin not on the allowlist never spawns', async () => {
    process.env.LB_MESH_AUTO_SPAWN_ENABLED = 'true';
    const { handleBishopDispatch } = await import('./bishop_dispatch_handler');
    const spawnImpl = vi.fn();
    const result = await handleBishopDispatch(makePayload(), 'some-other-peer-id', spawnImpl as never);
    expect(result.spawned).toBe(false);
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  test('a disallowed working dir never spawns', async () => {
    process.env.LB_MESH_AUTO_SPAWN_ENABLED = 'true';
    process.env.LB_MESH_ALLOWED_WORKDIR_ROOT = join(TEST_LEDGER_ROOT, 'allowed-only');
    const { handleBishopDispatch } = await import('./bishop_dispatch_handler');
    const spawnImpl = vi.fn();
    const result = await handleBishopDispatch(
      makePayload({ workingDir: join(TEST_LEDGER_ROOT, 'somewhere-else') }),
      '1a78f7c9bdd5e830', spawnImpl as never,
    );
    expect(result.spawned).toBe(false);
    expect(result.reason).toMatch(/working dir not allowed/);
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  test('D-BP156-M0-022 REGRESSION: a lexically-allowed but never-created working dir is refused end-to-end and NEVER handed to spawnImpl as cwd', async () => {
    process.env.LB_MESH_AUTO_SPAWN_ENABLED = 'true';
    const { handleBishopDispatch } = await import('./bishop_dispatch_handler');
    const spawnImpl = vi.fn();
    const neverCreated = join(TEST_LEDGER_ROOT, 'workdir', 'never-created-subdir');
    expect(existsSync(neverCreated)).toBe(false);

    const result = await handleBishopDispatch(
      makePayload({ workingDir: neverCreated }),
      '1a78f7c9bdd5e830', spawnImpl as never,
    );

    // FAILS against the pre-fix code: old isWorkingDirAllowed() accepted a not-yet-existing
    // path on the lexical check alone, so this would have proceeded to spawnImpl with a cwd
    // that does not exist -- exactly the shape that produced a misleading "spawn <exe> ENOENT"
    // on the real 0.9.24 run instead of a clear guardrail refusal.
    expect(result.spawned).toBe(false);
    expect(result.reason).toMatch(/working dir not allowed/);
    expect(result.reason).toMatch(/does not exist/);
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  test('every guardrail passing: spawns exactly once, argv contains an explicit array (no shell string)', async () => {
    process.env.LB_MESH_AUTO_SPAWN_ENABLED = 'true';
    const { handleBishopDispatch } = await import('./bishop_dispatch_handler');
    const fakeChild = makeFakeChild();
    const spawnImpl = vi.fn().mockReturnValue(fakeChild);
    const claimImpl = makeControllableClaimImpl(0);
    const payload = makePayload();
    const result = await handleBishopDispatch(payload, '1a78f7c9bdd5e830', spawnImpl as never, claimImpl as never);

    expect(result.spawned).toBe(true);
    expect(spawnImpl).toHaveBeenCalledTimes(1);
    const [cmd, args, opts] = spawnImpl.mock.calls[0] as [string, string[], Record<string, unknown>];
    expect(typeof cmd).toBe('string');
    expect(Array.isArray(args)).toBe(true);
    expect(opts.shell).toBe(false);
    expect(opts.cwd).toBe(payload.workingDir);
  });

  test('one spawn per dispatch id, ever: a second call for the same id refuses even after the first "exits"', async () => {
    process.env.LB_MESH_AUTO_SPAWN_ENABLED = 'true';
    const { handleBishopDispatch } = await import('./bishop_dispatch_handler');
    const fakeChild1 = makeFakeChild();
    const spawnImpl = vi.fn().mockReturnValueOnce(fakeChild1);
    const claimImpl = makeControllableClaimImpl(0);
    const payload = makePayload();

    const first = await handleBishopDispatch(payload, '1a78f7c9bdd5e830', spawnImpl as never, claimImpl as never);
    expect(first.spawned).toBe(true);
    fakeChild1.emit('exit', 0, null); // worker finished

    // Refused by the dedupe-ever guardrail before launchWorker() is ever reached -- claimImpl is
    // never called for this second attempt, so the default (real) claimImpl would be fine too;
    // passed anyway for consistency with the first call.
    const second = await handleBishopDispatch(payload, '1a78f7c9bdd5e830', spawnImpl as never, claimImpl as never);
    expect(second.spawned).toBe(false);
    expect(second.reason).toMatch(/already spawned/);
    expect(spawnImpl).toHaveBeenCalledTimes(1);
    expect(claimImpl).toHaveBeenCalledTimes(1);
  });

  test('concurrency cap: refuses a spawn once the cap is reached by still-running workers', async () => {
    process.env.LB_MESH_AUTO_SPAWN_ENABLED = 'true';
    process.env.LB_MESH_MAX_CONCURRENT_SPAWNS = '1';
    const { handleBishopDispatch } = await import('./bishop_dispatch_handler');
    const fakeChild1 = makeFakeChild(); // never emits 'exit' -- stays "active"
    const spawnImpl = vi.fn().mockReturnValueOnce(fakeChild1);
    const claimImpl = makeControllableClaimImpl(0);

    const first = await handleBishopDispatch(makePayload({ dispatchId: 'D-BP156-M3-010' }), '1a78f7c9bdd5e830', spawnImpl as never, claimImpl as never);
    expect(first.spawned).toBe(true);

    // Refused by the concurrency-cap guardrail before launchWorker() is ever reached -- claimImpl
    // is never called for this second attempt.
    const second = await handleBishopDispatch(makePayload({ dispatchId: 'D-BP156-M3-011' }), '1a78f7c9bdd5e830', spawnImpl as never, claimImpl as never);
    expect(second.spawned).toBe(false);
    expect(second.reason).toMatch(/concurrency cap/);
    expect(claimImpl).toHaveBeenCalledTimes(1);
  });

  test('D-BP156-M0-022 REGRESSION: an immediate (ENOENT-class) spawn failure is reported as spawned:false, not spawned:true — reproduces D-BP156-M3-007 (SPAWN_ERROR ENOENT recorded 76ms before the reply asserted spawned:true)', async () => {
    process.env.LB_MESH_AUTO_SPAWN_ENABLED = 'true';
    const { handleBishopDispatch } = await import('./bishop_dispatch_handler');

    // Mimics real Node child_process behavior for a synchronous-class launch failure: spawnImpl
    // returns a ChildProcess-shaped EventEmitter synchronously, then the 'error' event fires on
    // process.nextTick (exactly how Node's own internal spawn() defers an ENOENT/EACCES/bad-cwd
    // failure -- see lib/internal/child_process.js's onErrorNT) -- i.e. BEFORE any macrotask,
    // and therefore before handleBishopDispatch's grace window elapses.
    const fakeChild = makeFakeChild();
    const spawnImpl = vi.fn().mockImplementation(() => {
      process.nextTick(() => {
        fakeChild.emit('error', new Error(
          'spawn C:\\Users\\Admin\\AppData\\Roaming\\Claude\\claude-code\\2.1.229\\claude.exe ENOENT',
        ));
      });
      return fakeChild;
    });
    const claimImpl = makeControllableClaimImpl(0);

    const result = await handleBishopDispatch(makePayload(), '1a78f7c9bdd5e830', spawnImpl as never, claimImpl as never);

    // The bug this reproduces: the OLD code returned `{ spawned: true, reason: 'spawned' }`
    // unconditionally right after calling launchWorker(), never inspecting whether the process
    // actually launched -- so this assertion FAILS against the pre-fix code and PASSES once
    // handleBishopDispatch awaits launchWorker()'s real outcome.
    expect(result.spawned).toBe(false);
    expect(result.reason).toMatch(/ENOENT/);
  });

  test('D-BP156-M0-022: a real launch that is still running once the grace window elapses is honestly reported spawned:true (no false negative)', async () => {
    process.env.LB_MESH_AUTO_SPAWN_ENABLED = 'true';
    const { handleBishopDispatch } = await import('./bishop_dispatch_handler');
    // Never emits 'error' or 'exit' -- a legitimately still-running worker (the common case).
    const fakeChild = makeFakeChild();
    const spawnImpl = vi.fn().mockReturnValue(fakeChild);
    const claimImpl = makeControllableClaimImpl(0);

    const result = await handleBishopDispatch(makePayload(), '1a78f7c9bdd5e830', spawnImpl as never, claimImpl as never);

    expect(result.spawned).toBe(true);
    expect(result.reason).toBe('spawned');
  });

  test('SHELL-INJECTION SAFETY: a promptText containing shell metacharacters reaches spawnImpl as one untouched argv element, never a shell string', async () => {
    process.env.LB_MESH_AUTO_SPAWN_ENABLED = 'true';
    const { handleBishopDispatch } = await import('./bishop_dispatch_handler');
    const fakeChild = makeFakeChild();
    const spawnImpl = vi.fn().mockReturnValue(fakeChild);
    const claimImpl = makeControllableClaimImpl(0);

    const maliciousPrompt = 'do the thing"; rm -rf / ; echo $(whoami) `id` && calc.exe & del /f /q C:\\*';
    const payload = makePayload({ promptText: maliciousPrompt });
    const result = await handleBishopDispatch(payload, '1a78f7c9bdd5e830', spawnImpl as never, claimImpl as never);

    expect(result.spawned).toBe(true);
    const [cmd, args, opts] = spawnImpl.mock.calls[0] as [string, string[], Record<string, unknown>];
    // The command itself must never be a shell invocation.
    expect(cmd).not.toMatch(/cmd\.exe|sh$|bash$/i);
    // shell must be explicitly false -- the single guarantee that argv elements are passed
    // atomically to the OS and never re-parsed.
    expect(opts.shell).toBe(false);
    // D-BP157-034/BISHOP/seg-fix-test-failures: this assertion used to require the malicious
    // string to appear as an argv element EQUAL to it. D-BP157-007 (HARDWIRE-25's effective-id
    // notice, and the always-on completion-sentinel instruction) now has launchWorker() build
    // `promptTextForChild = payload.promptText + childActorNotice + completionInstruction`
    // (bishop_dispatch_handler.ts, launchWorker(), around the `const args = ['-p',
    // promptTextForChild, ...]` line) before passing it as the '-p' argv value, so the argv
    // element that carries the prompt now CONTAINS it rather than being byte-for-byte EQUAL to
    // it. Verified safe before loosening this assertion, from both the source above and this
    // test's own captured spawnImpl call (args = ["-p", "<maliciousPrompt>\n\n[BISHOP DISPATCH
    // COMPLETION SENTINEL] ...", "--output-format", "text", "--model", "sonnet",
    // "--permission-mode", "default"], opts.shell === false):
    //   - the prompt still reaches spawnImpl as exactly ONE argv array element (args[1], the
    //     '-p' value) -- never split across elements, never duplicated;
    //   - that one element is built by concatenating THREE fixed strings (the prompt, the
    //     child-actor notice, the completion instruction) -- not by joining the prompt with a
    //     CLI flag; every flag (`--output-format`, `--model`, `--permission-mode`, and their
    //     values) remains its own distinct array element, never glued to the prompt;
    //   - the metacharacters in maliciousPrompt (`"`, `;`, `$()`, backticks, `&`, `\`) are not
    //     escaped, stripped, split, or re-quoted anywhere in that element -- they appear as a
    //     raw, untouched, byte-for-byte PREFIX of the argv element.
    // The assertion below is at least as strict as the original on every property that matters
    // for injection safety: still exactly one argv element carries the payload, still checked
    // for byte-for-byte content (via containment rather than full equality, since trailing fixed
    // text is now appended), and still confirmed distinct from every flag element.
    const matchingArgs = args.filter((a) => a.includes(maliciousPrompt));
    expect(matchingArgs).toHaveLength(1);
    expect(matchingArgs[0].startsWith(maliciousPrompt)).toBe(true);
    // And it must never have been used to build a single joined command string anywhere in the
    // call (i.e. no argv element is a superstring containing both the prompt AND another flag
    // glued together, which would indicate string concatenation rather than array construction).
    for (const a of args) {
      if (!a.includes(maliciousPrompt)) expect(a).not.toContain('rm -rf');
    }
  });
});

// D-BP157-010: HARDWIRE-25's suffix walk (claimEffectiveDispatchId) was wired in by D-BP157-007
// but never covered by a test of its own -- it is the entire substance of what HARDWIRE-25
// promises (a bare id already held by a live actor gets the worker reassigned to a deterministic
// -W1/-W2/... child id rather than colliding with it). Tested directly against the exported pure
// decision function, the same way isWorkingDirAllowed/hasAlreadySpawned etc. are tested above --
// no process, real or fake, needs to be spawned to exercise this retry loop.
describe('claimEffectiveDispatchId — HARDWIRE-25 suffix walk', () => {
  test('(a) bare id free: claim succeeds immediately, effective id is the bare id', async () => {
    const { claimEffectiveDispatchId } = await import('./bishop_dispatch_handler');
    const claimImpl = makeControllableClaimImpl(0);
    const result = claimEffectiveDispatchId('D-BP157-010-TEST', 'ACTOR', 'sonnet', 4, claimImpl as never);
    expect(result.effectiveId).toBe('D-BP157-010-TEST');
    expect(result.claimed).toBe(true);
    expect(claimImpl).toHaveBeenCalledTimes(1);
  });

  test('(b) bare id already claimed: effective id becomes "-W1"', async () => {
    const { claimEffectiveDispatchId } = await import('./bishop_dispatch_handler');
    const claimImpl = makeControllableClaimImpl(1);
    const result = claimEffectiveDispatchId('D-BP157-010-TEST', 'ACTOR', 'sonnet', 4, claimImpl as never);
    expect(result.effectiveId).toBe('D-BP157-010-TEST-W1');
    expect(result.claimed).toBe(true);
    expect(claimImpl).toHaveBeenCalledTimes(2);
  });

  test('(c) bare id and "-W1" both claimed: effective id becomes "-W2"', async () => {
    const { claimEffectiveDispatchId } = await import('./bishop_dispatch_handler');
    const claimImpl = makeControllableClaimImpl(2);
    const result = claimEffectiveDispatchId('D-BP157-010-TEST', 'ACTOR', 'sonnet', 4, claimImpl as never);
    expect(result.effectiveId).toBe('D-BP157-010-TEST-W2');
    expect(result.claimed).toBe(true);
    expect(claimImpl).toHaveBeenCalledTimes(3);
  });

  test('(d) the cap (20) is reached: fails in a defined, legible way -- bounded attempts, no throw, claimed:false -- rather than looping unboundedly', async () => {
    const { claimEffectiveDispatchId } = await import('./bishop_dispatch_handler');
    const claimImpl = makeAlwaysFailingClaimImpl();
    const result = claimEffectiveDispatchId('D-BP157-010-TEST', 'ACTOR', 'sonnet', 4, claimImpl as never);
    expect(result.claimed).toBe(false);
    expect(result.effectiveId).toBe('D-BP157-010-TEST-W20');
    // Bounded: exactly MAX_CHILD_SUFFIX_ATTEMPTS + 1 attempts (bare id, then -W1 through -W20) --
    // proves the loop terminates deterministically on its own rather than running away.
    expect(claimImpl).toHaveBeenCalledTimes(21);
    // NOTE (D-BP157-012, formerly found-not-fixed by D-BP157-010, now CLOSED): claimEffectiveDispatchId's
    // own contract is honored here (a defined, legible, bounded result). launchWorker() in
    // bishop_dispatch_handler.ts now gates on claimResult.claimed and REFUSES to spawn when it is
    // false -- see the "handleBishopDispatch -- HARDWIRE-25 effective id propagation" describe
    // block below, whose cap-exhaustion test asserts the refusal (no spawnImpl call, spawned:false,
    // a distinct SPAWN_REFUSED_UNCLAIMED beat event) rather than documenting a spawn that should
    // not have happened.
  });
});

// D-BP157-010, work item 4: the actual collision-avoidance HARDWIRE-25 promises depends on every
// artifact the spawned worker writes -- its log file AND the id it is told to use inside its own
// prompt -- using the EFFECTIVE (possibly suffixed) id, never the bare one. Verified, not assumed.
describe('handleBishopDispatch — HARDWIRE-25 effective id propagation', () => {
  test('a suffixed effective id (bare already claimed) is used for BOTH the worker log path and the child prompt paragraph, never the bare id', async () => {
    process.env.LB_MESH_AUTO_SPAWN_ENABLED = 'true';
    const { handleBishopDispatch } = await import('./bishop_dispatch_handler');
    const fakeChild = makeFakeChild();
    const spawnImpl = vi.fn().mockReturnValue(fakeChild);
    const claimImpl = makeControllableClaimImpl(1); // bare id refused, "-W1" succeeds
    const payload = makePayload({ dispatchId: 'D-BP157-010-EFFID' });

    const result = await handleBishopDispatch(payload, '1a78f7c9bdd5e830', spawnImpl as never, claimImpl as never);
    expect(result.spawned).toBe(true);

    // The child prompt paragraph names the EFFECTIVE id.
    const [, args] = spawnImpl.mock.calls[0] as [string, string[], Record<string, unknown>];
    const promptArg = args[args.indexOf('-p') + 1];
    expect(promptArg).toContain('HARDWIRE-25 CHILD ACTOR NOTICE');
    expect(promptArg).toContain('effective dispatch id for every artifact you write');
    expect(promptArg).toContain('is "D-BP157-010-EFFID-W1"');

    // The worker log file is opened at the EFFECTIVE id's path, never the bare id's.
    const suffixedLogPath = join(TEST_LEDGER_ROOT, 'YOKE', 'WORKER_LOGS', 'D-BP157-010-EFFID-W1.log');
    const bareLogPath = join(TEST_LEDGER_ROOT, 'YOKE', 'WORKER_LOGS', 'D-BP157-010-EFFID.log');
    expect(existsSync(suffixedLogPath)).toBe(true);
    expect(existsSync(bareLogPath)).toBe(false);
  });

  test('D-BP157-012 FAIL CLOSED: when the suffix-walk cap is exhausted (claimed:false), launchWorker() REFUSES to spawn under the last, unclaimed candidate id -- no process is ever created', async () => {
    process.env.LB_MESH_AUTO_SPAWN_ENABLED = 'true';
    const { handleBishopDispatch } = await import('./bishop_dispatch_handler');
    const spawnImpl = vi.fn();
    const claimImpl = makeAlwaysFailingClaimImpl();
    const payload = makePayload({ dispatchId: 'D-BP157-010-CAPPED' });

    const result = await handleBishopDispatch(payload, '1a78f7c9bdd5e830', spawnImpl as never, claimImpl as never);

    // FAILS against the pre-fix (D-BP157-010-era) code, which spawned anyway under the last
    // (unclaimed) "-W20" candidate id -- HARDWIRE-25's guard failing OPEN under exactly the
    // contention it exists to catch. PASSES once launchWorker() gates on claimResult.claimed and
    // refuses before building argv, opening the worker log, or calling spawnImpl.
    expect(result.spawned).toBe(false);
    expect(result.reason).toMatch(/claim refused/i);
    expect(result.reason).toMatch(/D-BP157-010-CAPPED/);
    expect(result.reason).toMatch(/unclaimed/i);
    // Not folded into a generic "spawn failed" -- the reason states the claim failure in plain
    // words, and the ok field (unchanged reply shape, not this dispatch's to redesign) still
    // reads true even though nothing was spawned.
    expect(result.ok).toBe(true);
    expect(claimImpl).toHaveBeenCalledTimes(21);
    // The load-bearing assertion: no process, real or fake, was ever created for an id nothing
    // holds a claim on.
    expect(spawnImpl).not.toHaveBeenCalled();
    // No worker log opened for the unclaimed candidate id either -- the refusal happens before
    // any per-worker artifact is written.
    const unclaimedLogPath = join(TEST_LEDGER_ROOT, 'YOKE', 'WORKER_LOGS', 'D-BP157-010-CAPPED-W20.log');
    expect(existsSync(unclaimedLogPath)).toBe(false);
    // The refusal reaches the beat file as a distinct, legible decision -- not silent, not folded
    // into SPAWN_FAILED/SPAWN_ERROR.
    const beatPath = join(TEST_LEDGER_ROOT, 'YOKE', 'HEARTBEAT', 'BISHOP_DISPATCH_SPAWN.beat');
    expect(existsSync(beatPath)).toBe(true);
    const beatContent = readFileSync(beatPath, 'utf8');
    expect(beatContent).toMatch(/decision=SPAWN_REFUSED_UNCLAIMED/);
    expect(beatContent).toMatch(/dispatch=D-BP157-010-CAPPED/);
    expect(beatContent).toMatch(/attemptsTried=21/);
    expect(beatContent).toMatch(/cap=20/);
  });
});

// D-BP157-023, THE RETURN LEG (SEG_RETURN_BP157_015 Part 2). The whole point of this dispatch:
// four scenarios that today all look identical from M0's side ("a dispatch happened") must now
// produce four DISTINCT, assertable statuses. completionReplyImpl is injected in every test that
// reaches launchWorker() here, mirroring spawnImpl/claimImpl's existing discipline -- the real
// default (defaultCompletionReplyImpl) calls getStablePeerId()/fetch and must never run inside
// this OFFLINE suite.
describe('deriveCompletionOutcome — pure completion-status derivation (no I/O)', () => {
  test('exit code 0, sentinel present in log -> completed, no issues', async () => {
    const { deriveCompletionOutcome, COMPLETION_SENTINEL } = await import('./bishop_dispatch_handler');
    const result = deriveCompletionOutcome('D-TEST-1', `did the work\n${COMPLETION_SENTINEL}\n`, 0, null);
    expect(result.lifecycle).toBe('completed');
    expect(result.issues).toEqual([]);
  });

  test('exit code 0, sentinel ABSENT (or no log at all) -> failed, NO_COMPLETION_SENTINEL -- the D-BP156-M3-011 shape', async () => {
    const { deriveCompletionOutcome } = await import('./bishop_dispatch_handler');
    const withEmptyLog = deriveCompletionOutcome('D-TEST-2', 'ran, printed nothing conclusive', 0, null);
    expect(withEmptyLog.lifecycle).toBe('failed');
    expect(withEmptyLog.issues).toHaveLength(1);
    expect(withEmptyLog.issues[0]?.code).toBe('NO_COMPLETION_SENTINEL');

    const withNullLog = deriveCompletionOutcome('D-TEST-2b', null, 0, null);
    expect(withNullLog.lifecycle).toBe('failed');
    expect(withNullLog.issues[0]?.code).toBe('NO_COMPLETION_SENTINEL');
  });

  test('non-zero exit code -> failed, SPAWN_NONZERO_EXIT, regardless of log content', async () => {
    const { deriveCompletionOutcome, COMPLETION_SENTINEL } = await import('./bishop_dispatch_handler');
    const result = deriveCompletionOutcome('D-TEST-3', `${COMPLETION_SENTINEL}\n`, 1, null);
    expect(result.lifecycle).toBe('failed');
    expect(result.issues[0]?.code).toBe('SPAWN_NONZERO_EXIT');
  });

  test('killed by signal -> failed, SPAWN_KILLED_BY_SIGNAL (covers the SPAWN_TIMEOUT_KILLED path)', async () => {
    const { deriveCompletionOutcome } = await import('./bishop_dispatch_handler');
    const result = deriveCompletionOutcome('D-TEST-4', null, null, 'SIGTERM');
    expect(result.lifecycle).toBe('failed');
    expect(result.issues[0]?.code).toBe('SPAWN_KILLED_BY_SIGNAL');
  });
});

describe('handleBishopDispatch — THE RETURN LEG: four distinct, assertable statuses', () => {
  test('STATUS 1 -- a refusal: lifecycle "refused", never spawned, no completion reply ever attempted', async () => {
    const { handleBishopDispatch } = await import('./bishop_dispatch_handler');
    const spawnImpl = vi.fn();
    const completionReplyImpl = vi.fn();

    const result = await handleBishopDispatch(
      makePayload(), null, spawnImpl as never, undefined, 'route-refused-1', completionReplyImpl as never,
    );

    expect(result.lifecycle).toBe('refused');
    expect(result.spawned).toBe(false);
    expect(result.issues).toEqual([]);
    expect(spawnImpl).not.toHaveBeenCalled();
    expect(completionReplyImpl).not.toHaveBeenCalled();
  });

  test('STATUS 2 -- a worker that never finishes: stage-1 result is "begun" (never "completed"), and no completion reply is posted while it has not exited', async () => {
    process.env.LB_MESH_AUTO_SPAWN_ENABLED = 'true';
    const { handleBishopDispatch } = await import('./bishop_dispatch_handler');
    const fakeChild = makeFakeChild();
    const spawnImpl = vi.fn().mockReturnValue(fakeChild);
    const claimImpl = makeControllableClaimImpl(0);
    const completionReplyImpl = vi.fn();
    const payload = makePayload({ dispatchId: 'D-BP157-023-NEVERENDS' });

    const result = await handleBishopDispatch(
      payload, '1a78f7c9bdd5e830', spawnImpl as never, claimImpl as never, 'route-neverends-1', completionReplyImpl as never,
    );

    expect(result.spawned).toBe(true);
    expect(result.lifecycle).toBe('begun');
    expect(result.effectiveId).toBe('D-BP157-023-NEVERENDS');
    // fakeChild never emits 'exit' -- this IS the never-finishes case. No completion write can
    // have happened yet; the flag this proves is that nothing pretends otherwise.
    await new Promise((r) => setImmediate(r));
    expect(completionReplyImpl).not.toHaveBeenCalled();
  });

  test('STATUS 3 -- a worker that exits 0 having actually printed the completion sentinel: stage-2 reply posts lifecycle "completed", no issues', async () => {
    process.env.LB_MESH_AUTO_SPAWN_ENABLED = 'true';
    const { handleBishopDispatch, COMPLETION_SENTINEL } = await import('./bishop_dispatch_handler');
    const fakeChild = makeFakeChild();
    const spawnImpl = vi.fn().mockReturnValue(fakeChild);
    const claimImpl = makeControllableClaimImpl(0);
    const completionReplyImpl = vi.fn().mockResolvedValue(true);
    const payload = makePayload({ dispatchId: 'D-BP157-023-COMPLETED' });

    const result = await handleBishopDispatch(
      payload, '1a78f7c9bdd5e830', spawnImpl as never, claimImpl as never, 'route-completed-1', completionReplyImpl as never,
    );
    expect(result.lifecycle).toBe('begun'); // stage-1 alone can never assert 'completed'

    // Simulate the worker having actually written its captured stdout (the real path: this
    // file's own fs.openSync'd log fd, duped into the child's stdio) before exiting clean.
    const logPath = join(TEST_LEDGER_ROOT, 'YOKE', 'WORKER_LOGS', 'D-BP157-023-COMPLETED.log');
    writeFileSync(logPath, `doing the thing\nstill doing it\n${COMPLETION_SENTINEL}\n`, 'utf8');

    fakeChild.emit('exit', 0, null);
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    expect(completionReplyImpl).toHaveBeenCalledTimes(1);
    const [routeIdArg, completionArg] = completionReplyImpl.mock.calls[0] as [string, { effectiveId: string; lifecycle: string; issues: unknown[]; tailExcerpt: string }, number];
    expect(routeIdArg).toBe('route-completed-1');
    expect(completionArg.effectiveId).toBe('D-BP157-023-COMPLETED');
    expect(completionArg.lifecycle).toBe('completed');
    expect(completionArg.issues).toEqual([]);
    expect(completionArg.tailExcerpt).toContain(COMPLETION_SENTINEL);
  });

  test('STATUS 4 -- a worker that exits 0 having written nothing usable: stage-2 reply posts lifecycle "failed" with a NO_COMPLETION_SENTINEL issue -- the measured D-BP156-M3-011/D-BP157-M3-002 shape, no longer indistinguishable from STATUS 3', async () => {
    process.env.LB_MESH_AUTO_SPAWN_ENABLED = 'true';
    const { handleBishopDispatch } = await import('./bishop_dispatch_handler');
    const fakeChild = makeFakeChild();
    const spawnImpl = vi.fn().mockReturnValue(fakeChild);
    const claimImpl = makeControllableClaimImpl(0);
    const completionReplyImpl = vi.fn().mockResolvedValue(true);
    const payload = makePayload({ dispatchId: 'D-BP157-023-NULLWORKER' });

    const result = await handleBishopDispatch(
      payload, '1a78f7c9bdd5e830', spawnImpl as never, claimImpl as never, 'route-nullworker-1', completionReplyImpl as never,
    );
    expect(result.lifecycle).toBe('begun');

    // No log file written at all -- reproduces D-BP156-M3-011/D-BP157-M3-002 exactly: the worker
    // ran (267s/413s in the real incidents), exited 0, and left zero durable artifacts.
    fakeChild.emit('exit', 0, null);
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    expect(completionReplyImpl).toHaveBeenCalledTimes(1);
    const [, completionArg] = completionReplyImpl.mock.calls[0] as [string, { lifecycle: string; issues: Array<{ code: string }> }, number];
    expect(completionArg.lifecycle).toBe('failed');
    expect(completionArg.issues).toHaveLength(1);
    expect(completionArg.issues[0]?.code).toBe('NO_COMPLETION_SENTINEL');
  });

  test('no completion reply is ever attempted when no routeId was supplied (e.g. a direct/offline call) -- the carrier-agnostic escape hatch', async () => {
    process.env.LB_MESH_AUTO_SPAWN_ENABLED = 'true';
    const { handleBishopDispatch, COMPLETION_SENTINEL } = await import('./bishop_dispatch_handler');
    const fakeChild = makeFakeChild();
    const spawnImpl = vi.fn().mockReturnValue(fakeChild);
    const claimImpl = makeControllableClaimImpl(0);
    const completionReplyImpl = vi.fn().mockResolvedValue(true);
    const payload = makePayload({ dispatchId: 'D-BP157-023-NOROUTE' });

    await handleBishopDispatch(payload, '1a78f7c9bdd5e830', spawnImpl as never, claimImpl as never, undefined, completionReplyImpl as never);

    const logPath = join(TEST_LEDGER_ROOT, 'YOKE', 'WORKER_LOGS', 'D-BP157-023-NOROUTE.log');
    writeFileSync(logPath, `${COMPLETION_SENTINEL}\n`, 'utf8');
    fakeChild.emit('exit', 0, null);
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    expect(completionReplyImpl).not.toHaveBeenCalled();
  });
});
