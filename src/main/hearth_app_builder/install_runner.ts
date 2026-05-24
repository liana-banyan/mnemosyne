// AMPLIFY Computer — Hearth App Builder — Install Runner
// B69b — Spawns the platform installer + writes to registry.json
// Registry: ~/.lb_hearth_apps/registry.json

import { spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { HearthApp, HearthRegistry, AppSpec } from './types';

const HEARTH_APPS_DIR = join(homedir(), '.lb_hearth_apps');
const REGISTRY_PATH = join(HEARTH_APPS_DIR, 'registry.json');

// ─── Registry helpers ─────────────────────────────────────────────────────────

export function loadRegistry(): HearthRegistry {
  if (!existsSync(REGISTRY_PATH)) {
    return { apps: [], schemaVersion: 1 };
  }
  try {
    const raw = readFileSync(REGISTRY_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<HearthRegistry>;
    return { apps: parsed.apps ?? [], schemaVersion: parsed.schemaVersion ?? 1 };
  } catch {
    return { apps: [], schemaVersion: 1 };
  }
}

function saveRegistry(registry: HearthRegistry): void {
  if (!existsSync(HEARTH_APPS_DIR)) mkdirSync(HEARTH_APPS_DIR, { recursive: true });
  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf8');
}

export function appendToRegistry(app: HearthApp): void {
  const registry = loadRegistry();
  // Remove any prior entry with the same uuid (upgrade path)
  registry.apps = registry.apps.filter((a) => a.uuid !== app.uuid);
  registry.apps.push(app);
  saveRegistry(registry);
}

export function removeFromRegistry(uuid: string): void {
  const registry = loadRegistry();
  registry.apps = registry.apps.filter((a) => a.uuid !== uuid);
  saveRegistry(registry);
}

// ─── Install Runner ───────────────────────────────────────────────────────────

export interface InstallRunnerOptions {
  uuid: string;
  appName: string;
  description: string;
  appDir: string;
  installerPath: string;
  spec: AppSpec;
}

export interface InstallRunnerResult {
  ok: boolean;
  error?: string;
}

export async function runInstaller(opts: InstallRunnerOptions): Promise<InstallRunnerResult> {
  const { uuid, appName, description, appDir, installerPath, spec } = opts;

  if (!existsSync(installerPath)) {
    return { ok: false, error: `Installer not found: ${installerPath}` };
  }

  const platform = process.platform;

  try {
    await spawnInstaller(installerPath, platform);

    const app: HearthApp = {
      uuid,
      appName,
      description,
      appDir,
      installerPath,
      installedAt: new Date().toISOString(),
      os: platform,
      spec,
      buildStatus: 'installed',
    };

    appendToRegistry(app);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function spawnInstaller(installerPath: string, platform: NodeJS.Platform): Promise<void> {
  return new Promise((resolve, reject) => {
    let cmd: string;
    let args: string[];

    if (platform === 'win32') {
      // NSIS installer — run with /S for silent or without for UI
      cmd = installerPath;
      args = [];
    } else if (platform === 'darwin') {
      // DMG — open via macOS open command
      cmd = 'open';
      args = [installerPath];
    } else {
      // Linux AppImage — make executable and run
      cmd = 'chmod';
      args = ['+x', installerPath];
    }

    const proc = spawn(cmd, args, { shell: platform === 'win32' });

    proc.on('close', (code) => {
      if (platform === 'linux' && cmd === 'chmod') {
        // After chmod, launch the AppImage
        const run = spawn(installerPath, [], { detached: true, stdio: 'ignore' });
        run.unref();
        resolve();
      } else if (code === 0 || code === null) {
        resolve();
      } else {
        reject(new Error(`Installer exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to launch installer: ${err.message}`));
    });
  });
}

// ─── Register built-but-not-installed app ─────────────────────────────────────
// Called after successful codegen+build, before user clicks Install.

export function registerBuiltApp(opts: {
  uuid: string;
  appName: string;
  description: string;
  appDir: string;
  installerPath?: string;
  spec: AppSpec;
}): void {
  const app: HearthApp = {
    uuid: opts.uuid,
    appName: opts.appName,
    description: opts.description,
    appDir: opts.appDir,
    installerPath: opts.installerPath,
    installedAt: new Date().toISOString(),
    os: process.platform,
    spec: opts.spec,
    buildStatus: 'built',
  };
  appendToRegistry(app);
}

// ─── Library query ────────────────────────────────────────────────────────────

export function queryLibrary(memberId?: string): HearthApp[] {
  const registry = loadRegistry();
  // For v1, all apps are member-local — memberId filter is reserved for future multi-user
  return registry.apps;
}

// ─── Uninstall ────────────────────────────────────────────────────────────────

export interface UninstallResult {
  ok: boolean;
  error?: string;
}

export async function uninstallApp(uuid: string): Promise<UninstallResult> {
  const registry = loadRegistry();
  const app = registry.apps.find((a) => a.uuid === uuid);

  if (!app) {
    return { ok: false, error: `App ${uuid} not found in registry` };
  }

  // Remove from registry (the installed app itself is left in place — user deletes manually)
  removeFromRegistry(uuid);

  return { ok: true };
}
