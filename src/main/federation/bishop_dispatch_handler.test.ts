// bishop_dispatch_handler.test.ts — D-BP156-M0-008, HARDWIRE-24 mesh.
//
// OFFLINE. No real process is ever spawned -- every test passes a mock spawnImpl. No real
// network. LB_LEDGER_ROOT is pointed at a fresh os.tmpdir() subfolder per test run and removed
// afterwards, so this suite never touches the real HARDWIRE\LEDGER tree (the estate's Vault-
// sacrosanct discipline: never write test fixtures into a live ledger).
//
// Run: npx vitest run src/main/federation/bishop_dispatch_handler.test.ts

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync, existsSync, readFileSync, symlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { BishopDispatchPayload } from './mic_dispatcher';

let TEST_LEDGER_ROOT: string;
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
];

/** A fake ChildProcess that never exits on its own (tests that need it to "exit" call
 *  .emit('exit', ...) explicitly). Real enough for the handler's .once('exit'/'error') wiring. */
function makeFakeChild(): EventEmitter & { kill: ReturnType<typeof vi.fn> } {
  const ee = new EventEmitter() as EventEmitter & { kill: ReturnType<typeof vi.fn> };
  ee.kill = vi.fn();
  return ee;
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

beforeEach(() => {
  vi.resetModules();
  snapshotAndClearEnv(ENV_KEYS);
  TEST_LEDGER_ROOT = mkdtempSync(join(tmpdir(), 'bishop-dispatch-test-'));
  process.env.LB_LEDGER_ROOT = TEST_LEDGER_ROOT;
  // Default the allowed-workdir-root to this test's own tmpdir so makePayload()'s default
  // workingDir (under TEST_LEDGER_ROOT) passes the allowlist guardrail by default -- tests that
  // specifically exercise the workdir guardrail override this explicitly.
  process.env.LB_MESH_ALLOWED_WORKDIR_ROOT = TEST_LEDGER_ROOT;
  mkdirSync(join(TEST_LEDGER_ROOT, 'workdir'), { recursive: true });
});

afterEach(() => {
  restoreEnv();
  try { rmSync(TEST_LEDGER_ROOT, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
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

  test('every guardrail passing: spawns exactly once, argv contains an explicit array (no shell string)', async () => {
    process.env.LB_MESH_AUTO_SPAWN_ENABLED = 'true';
    const { handleBishopDispatch } = await import('./bishop_dispatch_handler');
    const fakeChild = makeFakeChild();
    const spawnImpl = vi.fn().mockReturnValue(fakeChild);
    const payload = makePayload();
    const result = await handleBishopDispatch(payload, '1a78f7c9bdd5e830', spawnImpl as never);

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
    const payload = makePayload();

    const first = await handleBishopDispatch(payload, '1a78f7c9bdd5e830', spawnImpl as never);
    expect(first.spawned).toBe(true);
    fakeChild1.emit('exit', 0, null); // worker finished

    const second = await handleBishopDispatch(payload, '1a78f7c9bdd5e830', spawnImpl as never);
    expect(second.spawned).toBe(false);
    expect(second.reason).toMatch(/already spawned/);
    expect(spawnImpl).toHaveBeenCalledTimes(1);
  });

  test('concurrency cap: refuses a spawn once the cap is reached by still-running workers', async () => {
    process.env.LB_MESH_AUTO_SPAWN_ENABLED = 'true';
    process.env.LB_MESH_MAX_CONCURRENT_SPAWNS = '1';
    const { handleBishopDispatch } = await import('./bishop_dispatch_handler');
    const fakeChild1 = makeFakeChild(); // never emits 'exit' -- stays "active"
    const spawnImpl = vi.fn().mockReturnValueOnce(fakeChild1);

    const first = await handleBishopDispatch(makePayload({ dispatchId: 'D-BP156-M3-010' }), '1a78f7c9bdd5e830', spawnImpl as never);
    expect(first.spawned).toBe(true);

    const second = await handleBishopDispatch(makePayload({ dispatchId: 'D-BP156-M3-011' }), '1a78f7c9bdd5e830', spawnImpl as never);
    expect(second.spawned).toBe(false);
    expect(second.reason).toMatch(/concurrency cap/);
  });

  test('SHELL-INJECTION SAFETY: a promptText containing shell metacharacters reaches spawnImpl as one untouched argv element, never a shell string', async () => {
    process.env.LB_MESH_AUTO_SPAWN_ENABLED = 'true';
    const { handleBishopDispatch } = await import('./bishop_dispatch_handler');
    const fakeChild = makeFakeChild();
    const spawnImpl = vi.fn().mockReturnValue(fakeChild);

    const maliciousPrompt = 'do the thing"; rm -rf / ; echo $(whoami) `id` && calc.exe & del /f /q C:\\*';
    const payload = makePayload({ promptText: maliciousPrompt });
    const result = await handleBishopDispatch(payload, '1a78f7c9bdd5e830', spawnImpl as never);

    expect(result.spawned).toBe(true);
    const [cmd, args, opts] = spawnImpl.mock.calls[0] as [string, string[], Record<string, unknown>];
    // The command itself must never be a shell invocation.
    expect(cmd).not.toMatch(/cmd\.exe|sh$|bash$/i);
    // shell must be explicitly false -- the single guarantee that argv elements are passed
    // atomically to the OS and never re-parsed.
    expect(opts.shell).toBe(false);
    // The malicious string must appear as EXACTLY ONE argv element, byte-for-byte unmodified --
    // never split on its embedded metacharacters, never concatenated into a longer string.
    const matchingArgs = args.filter((a) => a === maliciousPrompt);
    expect(matchingArgs).toHaveLength(1);
    // And it must never have been used to build a single joined command string anywhere in the
    // call (i.e. no argv element is a superstring containing both the prompt AND another flag
    // glued together, which would indicate string concatenation rather than array construction).
    for (const a of args) {
      if (a !== maliciousPrompt) expect(a).not.toContain('rm -rf');
    }
  });
});
