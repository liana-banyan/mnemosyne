// auto_update_scheduler.stale_ready.test.ts -- D-BP223-X043-002-C
//
// Replays the 2026-09-27 00:41Z incident: on quit, the updater installed the readdir-last
// *.exe.ready with no version check, so stale 0.9.38, 0.9.37, 0.9.36 installers ran in a chain
// and downgraded Program Files. These tests prove the new rule: max semver, strictly newer than
// the running app, everything else quarantined (moved, never deleted), one install per quit.
//
// OFFLINE, MOCKED. os.homedir() is redirected to a throwaway temp dir; the real ~/.mnemosynec is
// never read or written. child_process.spawn is stubbed; no installer is ever executed.
//
// Run: npx vitest run src/main/auto_update_scheduler.stale_ready.test.ts

import { describe, test, expect, vi, beforeEach, afterAll } from 'vitest';
import * as fsReal from 'node:fs';
import * as osReal from 'node:os';
import * as pathReal from 'node:path';

const fakeHome = vi.hoisted(() => {
  const fs = require('fs') as typeof fsReal;
  const os = require('os') as typeof osReal;
  const path = require('path') as typeof pathReal;
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aus-stale-ready-test-'));
});

vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os');
  return { ...actual, homedir: () => fakeHome };
});

const spawnMock = vi.hoisted(() => vi.fn(() => ({ unref: () => undefined })));
vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process');
  return { ...actual, spawn: spawnMock };
});

const mockApp = vi.hoisted(() => ({
  getPath: vi.fn(() => fakeHome),
  getVersion: vi.fn(() => '0.9.39'),
  on: vi.fn(),
  quit: vi.fn(),
}));
vi.mock('electron', () => ({
  app: mockApp,
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: class {},
  Notification: class {
    static isSupported() { return false; }
    show() { /* noop */ }
  },
}));

vi.mock('./keys_engines/mesh_update_propagation', () => ({
  findNewerPeers: vi.fn(async () => []),
  pullAndVerifyFromPeers: vi.fn(async () => ({ ok: false, error: 'not used' })),
  seedLocalArtifactCache: vi.fn(),
}));

const UPDATES = pathReal.join(fakeHome, '.mnemosynec', 'updates');
const QUAR = pathReal.join(UPDATES, 'quarantine');

type Mod = typeof import('./auto_update_scheduler');

// Fresh module per test so the once-per-process guards start clean.
async function load(running: string): Promise<Mod> {
  vi.resetModules();
  mockApp.getVersion.mockImplementation(() => running);
  const mod = await import('./auto_update_scheduler');
  mod.setAutoUpdateConfig({ autoUpdates: true, installTiming: 'quit' });
  return mod;
}

function stage(...versions: string[]): void {
  fsReal.mkdirSync(UPDATES, { recursive: true });
  for (const v of versions) {
    fsReal.writeFileSync(pathReal.join(UPDATES, `MnemosyneC-Setup-${v}.exe.ready`), `fake ${v}`);
  }
}

function beforeQuitHandlers(): Array<() => void> {
  return mockApp.on.mock.calls.filter((c) => c[0] === 'before-quit').map((c) => c[1] as () => void);
}

function history(): Record<string, unknown>[] {
  const p = pathReal.join(fakeHome, '.mnemosynec', 'update-history.jsonl');
  if (!fsReal.existsSync(p)) return [];
  return fsReal.readFileSync(p, 'utf-8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

beforeEach(() => {
  fsReal.rmSync(pathReal.join(fakeHome, '.mnemosynec'), { recursive: true, force: true });
  spawnMock.mockClear();
  mockApp.on.mockClear();
  mockApp.quit.mockClear();
});

afterAll(() => {
  fsReal.rmSync(fakeHome, { recursive: true, force: true });
});

describe('compareSemver / parseInstallerVersion / selectPendingInstaller (pure)', () => {
  test('0.9.10 > 0.9.9 (numeric, not string)', async () => {
    const m = await load('0.9.0');
    expect(m.compareSemver('0.9.10', '0.9.9')).toBe(1);
    expect(m.compareSemver('0.9.9', '0.9.10')).toBe(-1);
    expect(m.compareSemver('0.9.39', '0.9.39')).toBe(0);
    expect(m.compareSemver('1.0.0', '0.99.99')).toBe(1);
  });

  test('parses both installer names the site ships', async () => {
    const m = await load('0.9.0');
    expect(m.parseInstallerVersion('MnemosyneC-Setup-0.9.38.exe.ready')).toEqual({ version: '0.9.38', ready: true });
    expect(m.parseInstallerVersion('MnemosyneC-Lean-Setup-0.9.39.exe.ready')).toEqual({ version: '0.9.39', ready: true });
    expect(m.parseInstallerVersion('MnemosyneC-Setup-0.9.38.exe')).toEqual({ version: '0.9.38', ready: false });
    expect(m.parseInstallerVersion('MnemosyneC-Setup-0.9.38.exe.staged')).toBeNull();
    expect(m.parseInstallerVersion('evil.exe.ready')).toBeNull();
  });

  test('selection picks 0.9.10 over 0.9.9 even though readdir order puts 0.9.9 last', async () => {
    const m = await load('0.9.8');
    const files = ['MnemosyneC-Setup-0.9.10.exe.ready', 'MnemosyneC-Setup-0.9.9.exe.ready'];
    const sel = m.selectPendingInstaller(files, '0.9.8');
    expect(sel.install?.version).toBe('0.9.10');
    expect(sel.superseded.map((s) => s.version)).toEqual(['0.9.9']);
    expect(sel.stale).toEqual([]);
  });

  test('equal version is stale, never installed', async () => {
    const m = await load('0.9.39');
    const sel = m.selectPendingInstaller(['MnemosyneC-Lean-Setup-0.9.39.exe.ready'], '0.9.39');
    expect(sel.install).toBeNull();
    expect(sel.stale.map((s) => s.version)).toEqual(['0.9.39']);
  });
});

describe('incident replay (installTiming quit)', () => {
  test('running 0.9.39 with .ready 0.9.34 to 0.9.38: installs nothing, quarantines all five', async () => {
    stage('0.9.34', '0.9.35', '0.9.36', '0.9.37', '0.9.38');
    const m = await load('0.9.39');
    await m.checkAndTriggerPendingInstall();

    expect(beforeQuitHandlers()).toHaveLength(0);
    for (const h of beforeQuitHandlers()) h();
    expect(spawnMock).not.toHaveBeenCalled();

    expect(fsReal.readdirSync(UPDATES).filter((f) => f.endsWith('.ready'))).toEqual([]);
    const q = fsReal.readdirSync(QUAR);
    expect(q).toHaveLength(5);
    for (const v of ['0.9.34', '0.9.35', '0.9.36', '0.9.37', '0.9.38']) {
      expect(q.some((f) => f.startsWith(`MnemosyneC-Setup-${v}.exe.ready.stale.`))).toBe(true);
    }
    const qEvents = history().filter((e) => e.event === 'ready_quarantined');
    expect(qEvents).toHaveLength(5);
    expect(qEvents.every((e) => e.running_version === '0.9.39')).toBe(true);
    expect(history().some((e) => e.event === 'install_scheduled')).toBe(false);
  });

  test('running 0.9.38 with 0.9.39 and 0.9.36: installs only 0.9.39 once, quarantines 0.9.36', async () => {
    stage('0.9.39', '0.9.36');
    const m = await load('0.9.38');
    await m.checkAndTriggerPendingInstall();
    // A second check in the same process must not register a second handler.
    await m.checkAndTriggerPendingInstall();

    const handlers = beforeQuitHandlers();
    expect(handlers).toHaveLength(1);

    // First before-quit installs; triggerInstall's own app.quit() fires before-quit again.
    handlers[0]();
    handlers[0]();

    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [exe, args] = spawnMock.mock.calls[0] as unknown as [string, string[]];
    expect(pathReal.basename(exe)).toBe('MnemosyneC-Setup-0.9.39.exe');
    expect(args).toEqual(['/SILENT']);
    expect(mockApp.quit).toHaveBeenCalledTimes(1);

    // Consumed: no .ready left to run on the next quit.
    expect(fsReal.existsSync(pathReal.join(UPDATES, 'MnemosyneC-Setup-0.9.39.exe.ready'))).toBe(false);
    expect(fsReal.readdirSync(UPDATES).filter((f) => f.endsWith('.ready'))).toEqual([]);

    const q = fsReal.readdirSync(QUAR);
    expect(q).toHaveLength(1);
    expect(q[0].startsWith('MnemosyneC-Setup-0.9.36.exe.ready.stale.')).toBe(true);

    const h = history();
    expect(h.filter((e) => e.event === 'install_scheduled')).toHaveLength(1);
    expect(h.some((e) => e.event === 'install_error')).toBe(false); // the old benign ENOENT is gone
  });

  test('after the upgrade, the next launch (now 0.9.39) archives the consumed .exe and runs nothing', async () => {
    stage('0.9.39', '0.9.36');
    let m = await load('0.9.38');
    await m.checkAndTriggerPendingInstall();
    beforeQuitHandlers()[0]();
    expect(spawnMock).toHaveBeenCalledTimes(1);

    spawnMock.mockClear();
    mockApp.on.mockClear();
    m = await load('0.9.39');
    await m.checkAndTriggerPendingInstall();
    expect(beforeQuitHandlers()).toHaveLength(0);
    expect(spawnMock).not.toHaveBeenCalled();
    expect(fsReal.existsSync(pathReal.join(UPDATES, 'MnemosyneC-Setup-0.9.39.exe'))).toBe(false);
    const installed = fsReal.readdirSync(pathReal.join(UPDATES, 'installed'));
    expect(installed.some((f) => f.startsWith('MnemosyneC-Setup-0.9.39.exe.consumed.'))).toBe(true);
  });

  test('Lean installer name is honored, and the max version wins across both names', async () => {
    fsReal.mkdirSync(UPDATES, { recursive: true });
    fsReal.writeFileSync(pathReal.join(UPDATES, 'MnemosyneC-Lean-Setup-0.9.40.exe.ready'), 'x');
    fsReal.writeFileSync(pathReal.join(UPDATES, 'MnemosyneC-Setup-0.9.39.exe.ready'), 'x');
    const m = await load('0.9.38');
    await m.checkAndTriggerPendingInstall();
    beforeQuitHandlers()[0]();
    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(pathReal.basename((spawnMock.mock.calls[0] as unknown as [string])[0])).toBe('MnemosyneC-Lean-Setup-0.9.40.exe');
  });

  test('installTiming launch with only stale files: nothing spawned, app not quit', async () => {
    stage('0.9.36', '0.9.37');
    const m = await load('0.9.39');
    m.setAutoUpdateConfig({ installTiming: 'launch' });
    await m.checkAndTriggerPendingInstall();
    expect(spawnMock).not.toHaveBeenCalled();
    expect(mockApp.quit).not.toHaveBeenCalled();
    expect(fsReal.readdirSync(QUAR)).toHaveLength(2);
  });
});
