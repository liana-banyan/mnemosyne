// userdata_paths.ts -- D-BP223-BM04-X033S3-009 STEP 1
//
// Guarded {userData}/substrate/proveit/... path resolution. Mirrors the "guarded userData"
// pattern already established in src/main/mnem_eblet_store.ts (getElectronApp() / resolveUserDataPath())
// and the "_set...ForTests" test-isolation convention already established in
// src/main/scavenger_hunt.ts (_setScavengerHuntLogPathForTests) -- reused here rather than
// reinvented, per the brief's "extend what exists" instruction. Kept as its own small module
// (rather than importing the private helper out of mnem_eblet_store.ts) because that helper is
// not exported and this feature's directory layout (substrate/proveit/*) differs from that
// module's own (substrate/eblets, substrate/verified_eblets.jsonl).

import { existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

type ElectronAppShape = { getPath: (name: string) => string };

const USERDATA_APP_NAME = 'MnemosyneC'; // see mnem_eblet_store.ts's own comment for why this is
// the real running userData folder name, not package.json's "amplify-computer".

let _electronAppCache: ElectronAppShape | null = null;

function getElectronApp(): ElectronAppShape | null {
  if (_electronAppCache) return _electronAppCache;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = require('electron') as { app?: ElectronAppShape };
    if (electron && electron.app && typeof electron.app.getPath === 'function') {
      _electronAppCache = electron.app;
      return _electronAppCache;
    }
  } catch {
    // Not resolvable outside Electron's main process -- expected for vitest.
  }
  return null;
}

function fallbackUserDataPath(): string {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA;
    if (appData) return resolve(appData, USERDATA_APP_NAME);
    throw new Error('[ProveIt] non-Electron fallback: %APPDATA% is not set in this process\'s environment.');
  }
  throw new Error(
    `[ProveIt] non-Electron fallback: no verified userData computation for process.platform === "${process.platform}".`,
  );
}

let _testRoot: string | null = null;

/** Test-only override -- same convention as scavenger_hunt.ts's _setScavengerHuntLogPathForTests.
 *  Pass null to clear. */
export function _setProveItRootForTests(dir: string | null): void {
  _testRoot = dir;
}

function resolveUserDataPath(): string {
  if (_testRoot) return _testRoot;
  const electronApp = getElectronApp();
  if (electronApp) return electronApp.getPath('userData');
  return fallbackUserDataPath();
}

function proveItRoot(): string {
  const dir = resolve(resolveUserDataPath(), 'substrate', 'proveit');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function cardsStorePath(): string {
  return resolve(proveItRoot(), 'proveit_cards.jsonl');
}

/** Home-directory outbox path, spelled exactly as the brief's literal path
 *  ("~/.mnemosynec/proveit_outbox.jsonl") -- kept as its own root rather than under {userData},
 *  since the brief names it explicitly and a separate outbox root is what makes it recognizable
 *  as "not yet in the substrate" even to someone inspecting the filesystem by hand. */
export function outboxPath(): string {
  const home = _testRoot ? resolve(_testRoot, 'home') : (process.env.USERPROFILE || process.env.HOME || resolveUserDataPath());
  const dir = resolve(home, '.mnemosynec');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return resolve(dir, 'proveit_outbox.jsonl');
}

export function settingsPath(): string {
  return resolve(proveItRoot(), 'proveit_settings.json');
}

export function categorySuggestionsPath(): string {
  return resolve(proveItRoot(), 'proveit_category_suggestions.jsonl');
}

export function seedLoadedMarkerPath(): string {
  return resolve(proveItRoot(), 'seed_loaded.json');
}
