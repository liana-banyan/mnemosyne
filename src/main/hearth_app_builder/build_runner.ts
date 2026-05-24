// AMPLIFY Computer — Hearth App Builder — Build Runner
// B69b — Spawns npm install + npm run build in a generated app dir.
// Streams stdout/stderr to renderer via IPC `hearth-app-build-progress`.
// Emits `hearth-app-build-complete` (success) or `hearth-app-build-error` (failure).

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { BrowserWindow } from 'electron';
import { BuildProgress } from './types';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface BuildRunnerOptions {
  appDir: string;
  appUuid: string;
  appName: string;
  /** Windows for IPC broadcast */
  windows: Array<BrowserWindow | null>;
}

export interface BuildRunnerResult {
  ok: boolean;
  installerPath?: string;
  error?: string;
  buildDurationMs: number;
}

// ─── IPC channel names ────────────────────────────────────────────────────────

export const IPC_BUILD_PROGRESS = 'hearth-app-build-progress';
export const IPC_BUILD_COMPLETE = 'hearth-app-build-complete';
export const IPC_BUILD_ERROR = 'hearth-app-build-error';

// ─── Build Runner ─────────────────────────────────────────────────────────────

export class BuildRunner {
  private opts: BuildRunnerOptions;
  private stderrLines: string[] = [];
  private t0 = 0;

  constructor(opts: BuildRunnerOptions) {
    this.opts = opts;
  }

  private broadcast(event: string, payload: unknown): void {
    for (const win of this.opts.windows) {
      if (win && !win.isDestroyed()) {
        win.webContents.send(event, payload);
      }
    }
  }

  private progress(status: BuildProgress): void {
    this.broadcast(IPC_BUILD_PROGRESS, status);
  }

  private spawnStep(
    cmd: string,
    args: string[],
    label: string,
    percentStart: number,
    percentEnd: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(cmd, args, {
        cwd: this.opts.appDir,
        shell: process.platform === 'win32',
        env: { ...process.env, ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES: 'true' },
      });

      proc.stdout.on('data', (chunk: Buffer) => {
        const line = chunk.toString().trimEnd();
        if (line) {
          this.progress({
            status: label === 'npm install' ? 'installing_deps' : 'building',
            message: `[${label}] ${line.slice(0, 200)}`,
            percent: percentStart,
            appUuid: this.opts.appUuid,
          });
        }
      });

      proc.stderr.on('data', (chunk: Buffer) => {
        const line = chunk.toString().trimEnd();
        if (line) this.stderrLines.push(line);
        // Broadcast stderr as progress too (npm often writes to stderr)
        this.progress({
          status: label === 'npm install' ? 'installing_deps' : 'building',
          message: `[${label}] ${line.slice(0, 200)}`,
          percent: Math.floor((percentStart + percentEnd) / 2),
          appUuid: this.opts.appUuid,
        });
      });

      proc.on('close', (code) => {
        if (code === 0) {
          this.progress({
            status: label === 'npm install' ? 'installing_deps' : 'building',
            message: `[${label}] Complete`,
            percent: percentEnd,
            appUuid: this.opts.appUuid,
          });
          resolve();
        } else {
          const last50 = this.stderrLines.slice(-50).join('\n');
          reject(new Error(`${label} exited with code ${code}\n${last50}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn ${label}: ${err.message}`));
      });
    });
  }

  private detectInstallerPath(): string | undefined {
    const releaseDir = join(this.opts.appDir, 'release');
    if (!existsSync(releaseDir)) return undefined;

    // Detect platform-specific output
    const { readdirSync } = require('fs') as typeof import('fs');
    try {
      const files = readdirSync(releaseDir);
      const installer = files.find((f) => {
        const lower = f.toLowerCase();
        return (
          lower.endsWith('.exe') ||
          lower.endsWith('.dmg') ||
          lower.endsWith('.appimage') ||
          lower.endsWith('.deb')
        );
      });
      return installer ? join(releaseDir, installer) : undefined;
    } catch {
      return undefined;
    }
  }

  async run(): Promise<BuildRunnerResult> {
    this.t0 = Date.now();
    this.stderrLines = [];

    this.progress({
      status: 'installing_deps',
      message: `Installing dependencies for ${this.opts.appName}…`,
      percent: 0,
      appUuid: this.opts.appUuid,
    });

    try {
      // Step 1: npm install (0-40%)
      await this.spawnStep('npm', ['install'], 'npm install', 0, 40);

      // Step 2: npm run build → Vite + electron-builder (40-95%)
      await this.spawnStep('npm', ['run', 'dist'], 'npm run dist', 40, 95);

      // Detect installer
      const installerPath = this.detectInstallerPath();
      const buildDurationMs = Date.now() - this.t0;

      this.progress({
        status: 'complete',
        message: installerPath ? `Build complete! Installer: ${installerPath}` : 'Build complete!',
        percent: 100,
        appUuid: this.opts.appUuid,
        installerPath,
      });

      this.broadcast(IPC_BUILD_COMPLETE, {
        appUuid: this.opts.appUuid,
        appName: this.opts.appName,
        installerPath,
        buildDurationMs,
      });

      return { ok: true, installerPath, buildDurationMs };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const buildDurationMs = Date.now() - this.t0;

      this.progress({
        status: 'error',
        message: `Build failed: ${error.slice(0, 300)}`,
        percent: 0,
        appUuid: this.opts.appUuid,
        error,
      });

      this.broadcast(IPC_BUILD_ERROR, {
        appUuid: this.opts.appUuid,
        appName: this.opts.appName,
        error,
        lastStderr: this.stderrLines.slice(-50).join('\n'),
      });

      return { ok: false, error, buildDurationMs };
    }
  }
}

// ─── Error classification (for G11 failure mode documentation) ────────────────

export type BuildFailureClass =
  | 'codegen_tsc_fail'
  | 'npm_install_network_fail'
  | 'electron_builder_signing_fail'
  | 'sqlite3_native_rebuild_fail'
  | 'unknown';

export function classifyBuildFailure(error: string): { class: BuildFailureClass; suggestion: string } {
  const lower = error.toLowerCase();

  if (lower.includes('tsc') || lower.includes('typescript') || lower.includes('type error')) {
    return {
      class: 'codegen_tsc_fail',
      suggestion: 'The generated TypeScript has type errors. Try regenerating the app with a simpler spec, or contact Hearth support.',
    };
  }
  if (lower.includes('network') || lower.includes('enotfound') || lower.includes('etimedout') || lower.includes('npm err! code')) {
    return {
      class: 'npm_install_network_fail',
      suggestion: 'npm install failed due to network issues. Check your internet connection and try again.',
    };
  }
  if (lower.includes('signing') || lower.includes('certificate') || lower.includes('codesign') || lower.includes('smartscreen')) {
    return {
      class: 'electron_builder_signing_fail',
      suggestion: 'Code signing failed. The app will still run — Windows may show a SmartScreen warning. Click "More info → Run anyway".',
    };
  }
  if (lower.includes('better-sqlite3') || lower.includes('sqlite') || lower.includes('node-gyp') || lower.includes('prebuild')) {
    return {
      class: 'sqlite3_native_rebuild_fail',
      suggestion: 'SQLite native module rebuild failed. Ensure Python 3 and Visual Studio Build Tools are installed (Windows), or Xcode Command Line Tools (macOS).',
    };
  }

  return {
    class: 'unknown',
    suggestion: 'An unexpected build error occurred. Check the error output above for details.',
  };
}
