// method_tree_switch.test.ts -- D-BP211-BM0-h2cbpq8k-017 / BM0-20260902T1732Z
//
// KORSAIKOFF GATE, ANSWERED. Four candidates, all checked, none a test:
//   method_tree_switch.ts                 MINE, minutes old. The SUBJECT of this suite.
//   _bp211_method_tree_switch_wire.js     MINE, minutes old. A patch applier. Asserts edits match
//                                         once; evaluates no switch behavior.
//   BP211_WO_HAS_THE_METHOD_TREE_EVER_RUN.md / ORDER_...   prose, read in full this session.
// No existing test covers this. Re-written to the same path.
//
// PROVES THE ONE PROPERTY THE FOUNDER ORDERED: the two engines have OPPOSITE defaults.
//
// Founder, 2026-09-02T19:03:06Z: "the two engines don't get the same switch, and yes have
// opposite defaults."
//
// THE DECISIVE CASE IS THE FIRST ONE. Every other assertion here is hygiene; "no settings file
// means ON" is the whole reason this switch exists in the shape it does. If that case ever flips,
// adding a safety feature silently turns off the half of the campaign that already works, on any
// fresh machine or cleared userData, with no error for anyone to read.
//
// electron is mocked on the same pattern as auto_update_scheduler.trust_root.test.ts. It is never
// actually reached: LB_METHOD_TREE_SETTINGS_DIR is set for every case, and settingsDir() prefers
// it over app.getPath() -- the mock throws if anything ever does reach it, so a regression that
// bypasses the seam fails loudly instead of silently reading a real user directory.

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The factory is HOISTED above every top-level statement in this file, so it must not close over
// a `const` declared here -- that is a TDZ ReferenceError, not a mocking problem, and it cost this
// suite one run. Everything the factory needs is therefore declared INSIDE it.
vi.mock('electron', () => ({
  app: { getPath: () => { throw new Error('app.getPath must never be reached in this suite'); } },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: class {},
}));

import {
  readMethodTreeEnabledFromSettings,
  writeMethodTreeEnabledToSettings,
  methodTreeSettingsPath,
} from './method_tree_switch';

const roots: string[] = [];
function freshDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'bp211-methodtree-'));
  roots.push(d);
  process.env.LB_METHOD_TREE_SETTINGS_DIR = d;
  return d;
}
function writeSettings(dir: string, raw: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'method_tree_settings.json'), raw, 'utf-8');
}

afterAll(() => {
  delete process.env.LB_METHOD_TREE_SETTINGS_DIR;
  for (const d of roots) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
});

describe('method tree switch -- FAILS OPEN', () => {
  let dir: string;
  beforeEach(() => { dir = freshDir(); });

  it('NO SETTINGS FILE MEANS ON. This is the decisive case and the reason the file exists.', () => {
    expect(existsSync(join(dir, 'method_tree_settings.json'))).toBe(false);
    expect(readMethodTreeEnabledFromSettings()).toBe(true);
  });

  it('an explicit "enabled": false is the ONLY thing that turns it off', () => {
    writeSettings(dir, JSON.stringify({ enabled: false }));
    expect(readMethodTreeEnabledFromSettings()).toBe(false);
  });

  it('an explicit "enabled": true is on', () => {
    writeSettings(dir, JSON.stringify({ enabled: true }));
    expect(readMethodTreeEnabledFromSettings()).toBe(true);
  });

  it('malformed JSON stays ON rather than reading a parse error as an instruction to stop', () => {
    writeSettings(dir, '{ this is not json');
    expect(readMethodTreeEnabledFromSettings()).toBe(true);
  });

  it('an empty object stays ON -- a missing key is not a decision', () => {
    writeSettings(dir, '{}');
    expect(readMethodTreeEnabledFromSettings()).toBe(true);
  });

  it('the STRING "false" does NOT turn it off -- only the boolean does', () => {
    // A hand-edited settings file is the likely way this lands wrong. Treating a truthy string as
    // "off" would stop the engine on a typo; treating it as "on" leaves the engine running, which
    // is the safe direction for THIS engine specifically.
    writeSettings(dir, JSON.stringify({ enabled: 'false' }));
    expect(readMethodTreeEnabledFromSettings()).toBe(true);
  });

  it('null and 0 do not turn it off either', () => {
    writeSettings(dir, JSON.stringify({ enabled: null }));
    expect(readMethodTreeEnabledFromSettings()).toBe(true);
    writeSettings(dir, JSON.stringify({ enabled: 0 }));
    expect(readMethodTreeEnabledFromSettings()).toBe(true);
  });
});

describe('method tree switch -- writing', () => {
  let dir: string;
  beforeEach(() => { dir = freshDir(); });

  it('write(false) then read is false, and write(true) then read is true', () => {
    writeMethodTreeEnabledToSettings(false);
    expect(readMethodTreeEnabledFromSettings()).toBe(false);
    writeMethodTreeEnabledToSettings(true);
    expect(readMethodTreeEnabledFromSettings()).toBe(true);
  });

  it('writing creates the directory if it does not exist yet', () => {
    const nested = join(dir, 'does', 'not', 'exist');
    process.env.LB_METHOD_TREE_SETTINGS_DIR = nested;
    writeMethodTreeEnabledToSettings(false);
    expect(readMethodTreeEnabledFromSettings()).toBe(false);
  });

  it('a toggle PRESERVES other keys instead of replacing the file', () => {
    writeSettings(dir, JSON.stringify({ enabled: true, someFutureSetting: 'keep me' }));
    writeMethodTreeEnabledToSettings(false);
    const back = JSON.parse(readFileSync(join(dir, 'method_tree_settings.json'), 'utf-8'));
    expect(back.enabled).toBe(false);
    expect(back.someFutureSetting).toBe('keep me');
  });

  it('methodTreeSettingsPath() names the file the refusal message points a human at', () => {
    expect(methodTreeSettingsPath()).toBe(join(dir, 'method_tree_settings.json'));
  });
});

describe('THE OPPOSITE-DEFAULTS INVARIANT -- the actual order', () => {
  // THIS IS A SOURCE-LEVEL ASSERTION AND THAT IS DELIBERATE, NOT LAZINESS.
  // Importing plow/liana_cycle_scheduler.ts to call its reader would drag that module's top-level
  // side effects (an idle-check interval and IPC registration) into a unit suite. The property
  // under test is a DEFAULT written in one line, so the honest cheap check is that the line still
  // says what it says. If someone changes the plow side to fail open, this fails and makes them
  // come read this comment.
  it('the plow-side engine still FAILS CLOSED, so the two defaults remain opposite', () => {
    const plow = readFileSync(join(__dirname, '..', 'plow', 'liana_cycle_scheduler.ts'), 'utf-8');
    const fn = plow.slice(plow.indexOf('export function readLianaCycleEnabledFromSettings'));
    const body = fn.slice(0, fn.indexOf('export function writeLianaCycleEnabledToSettings'));
    expect(body).toContain('if (!existsSync(p)) return false;');
    expect(body).toContain('parsed?.enabled === true');
  });

  it('and the two engines read DIFFERENT files, so neither can ever answer for the other', () => {
    const plow = readFileSync(join(__dirname, '..', 'plow', 'liana_cycle_scheduler.ts'), 'utf-8');
    expect(plow).toContain("'liana_cycle_settings.json'");
    const mine = readFileSync(join(__dirname, 'method_tree_switch.ts'), 'utf-8');
    expect(mine).toContain("const METHOD_TREE_SETTINGS_FILE = 'method_tree_settings.json'");
  });
});
