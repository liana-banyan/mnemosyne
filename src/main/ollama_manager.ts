// AMPLIFY Computer — Ollama Lifecycle Manager
// B37 Phase 2 — Ollama process spawn, health check, model pull, graceful shutdown
// Handles: pre-installed Ollama detection, bundled binary fallback, model management

import { spawn, ChildProcess, execSync } from 'child_process';
import { existsSync, statSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';

const OLLAMA_API_BASE = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.1:8b-instruct-q4_K_M';
const HEALTH_CHECK_INTERVAL_MS = 30_000;
const STARTUP_TIMEOUT_MS = 15_000;

export interface OllamaStatus {
  running: boolean;
  model: string | null;
  version?: string;
  pid?: number;
  source: 'pre-installed' | 'bundled' | 'none';
}

export interface ModelPullProgress {
  status: 'pulling' | 'verifying' | 'complete' | 'error';
  bytesDownloaded?: number;
  totalBytes?: number;
  percentComplete?: number;
  error?: string;
}

export class OllamaManager {
  private process: ChildProcess | null = null;
  private status: OllamaStatus = { running: false, model: null, source: 'none' };
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private onProgress?: (progress: ModelPullProgress) => void;

  setProgressCallback(cb: (progress: ModelPullProgress) => void): void {
    this.onProgress = cb;
  }

  async init(): Promise<void> {
    // 1. Check if Ollama is already running (most common case — user has it installed)
    const alreadyRunning = await this.isReachable();
    if (alreadyRunning) {
      const version = await this._getVersion();
      this.status = { running: true, model: DEFAULT_MODEL, source: 'pre-installed', version };
      console.log(`[Ollama] Pre-installed Ollama detected (${version})`);
      this._startHealthMonitor();
      return;
    }

    // 2. Try to start pre-installed Ollama binary
    const preInstalled = this._findPreInstalledBinary();
    if (preInstalled) {
      await this._spawnOllama(preInstalled);
      if (await this._waitForStartup()) {
        const version = await this._getVersion();
        this.status = { running: true, model: null, source: 'pre-installed', version };
        console.log(`[Ollama] Started pre-installed Ollama from ${preInstalled}`);
        this._startHealthMonitor();
        return;
      }
    }

    // 3. Try bundled binary (Phase 2: bundled with AMPLIFY Computer installer)
    const bundledBinary = this._findBundledBinary();
    if (bundledBinary) {
      await this._spawnOllama(bundledBinary);
      if (await this._waitForStartup()) {
        const version = await this._getVersion();
        this.status = { running: true, model: null, source: 'bundled', version };
        console.log(`[Ollama] Started bundled Ollama from ${bundledBinary}`);
        this._startHealthMonitor();
        return;
      }
    }

    // 4. Ollama not available — record not-running state
    console.warn('[Ollama] Not available. Local inference disabled until Ollama is installed.');
    this.status = { running: false, model: null, source: 'none' };
  }

  private _findPreInstalledBinary(): string | null {
    const candidates = process.platform === 'win32'
      ? [
          join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe'),
          join(process.env.ProgramFiles || 'C:\\Program Files', 'Ollama', 'ollama.exe'),
          'ollama', // PATH
        ]
      : process.platform === 'darwin'
      ? [
          '/usr/local/bin/ollama',
          '/opt/homebrew/bin/ollama',
          join(process.env.HOME || '', '.ollama', 'ollama'),
          'ollama',
        ]
      : [
          '/usr/bin/ollama',
          '/usr/local/bin/ollama',
          join(process.env.HOME || '', '.ollama', 'ollama'),
          'ollama',
        ];

    for (const candidate of candidates) {
      try {
        if (!candidate.includes('/') && !candidate.includes('\\')) {
          // PATH-based check
          execSync(`${candidate} --version`, { stdio: 'ignore', timeout: 2000 });
          return candidate;
        } else if (existsSync(candidate)) {
          return candidate;
        }
      } catch {
        // Try next candidate
      }
    }
    return null;
  }

  private _findBundledBinary(): string | null {
    const resourcesPath = app.isPackaged
      ? process.resourcesPath
      : join(__dirname, '../../resources');

    const candidates = process.platform === 'win32'
      ? [join(resourcesPath, 'ollama', 'ollama.exe')]
      : [join(resourcesPath, 'ollama', 'ollama')];

    return candidates.find((p) => existsSync(p)) ?? null;
  }

  private async _spawnOllama(binary: string): Promise<void> {
    this.process = spawn(binary, ['serve'], {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        OLLAMA_HOST: '0.0.0.0:11434',
        OLLAMA_ORIGINS: 'http://localhost:5173,http://localhost:3000',
      },
    });

    this.process.stdout?.on('data', (d: Buffer) => {
      console.log(`[Ollama stdout] ${d.toString().trim()}`);
    });

    this.process.stderr?.on('data', (d: Buffer) => {
      const msg = d.toString().trim();
      if (msg) console.warn(`[Ollama stderr] ${msg}`);
    });

    this.process.on('exit', (code, signal) => {
      console.warn(`[Ollama] Process exited (code=${code} signal=${signal})`);
      this.status.running = false;
      this.process = null;
    });
  }

  private _waitForStartup(): Promise<boolean> {
    return new Promise((resolve) => {
      const deadline = Date.now() + STARTUP_TIMEOUT_MS;
      const poll = async () => {
        if (await this.isReachable()) {
          resolve(true);
          return;
        }
        if (Date.now() > deadline) {
          resolve(false);
          return;
        }
        setTimeout(poll, 500);
      };
      poll();
    });
  }

  async isReachable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`${OLLAMA_API_BASE}/api/tags`, {
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));
      return res.ok;
    } catch {
      return false;
    }
  }

  private async _getVersion(): Promise<string> {
    try {
      const res = await fetch(`${OLLAMA_API_BASE}/api/version`);
      const data = await res.json() as { version?: string };
      return data.version ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const res = await fetch(`${OLLAMA_API_BASE}/api/tags`);
      const data = await res.json() as { models: Array<{ name: string }> };
      return data.models?.map((m) => m.name) ?? [];
    } catch {
      return [];
    }
  }

  async hasModel(modelName: string = DEFAULT_MODEL): Promise<boolean> {
    const models = await this.listModels();
    return models.some((m) => m === modelName || m.startsWith(modelName.split(':')[0]));
  }

  async pullModel(
    modelName: string = DEFAULT_MODEL,
    progressCb?: (progress: ModelPullProgress) => void,
  ): Promise<void> {
    const cb = progressCb ?? this.onProgress;

    cb?.({ status: 'pulling', percentComplete: 0 });

    const res = await fetch(`${OLLAMA_API_BASE}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true }),
    });

    if (!res.ok || !res.body) {
      cb?.({ status: 'error', error: `Pull request failed: ${res.statusText}` });
      throw new Error(`Ollama pull failed: ${res.statusText}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let lastPercent = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value).split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const event = JSON.parse(line) as {
            status: string;
            completed?: number;
            total?: number;
          };

          if (event.total && event.completed) {
            const pct = Math.round((event.completed / event.total) * 100);
            if (pct !== lastPercent) {
              lastPercent = pct;
              cb?.({
                status: 'pulling',
                bytesDownloaded: event.completed,
                totalBytes: event.total,
                percentComplete: pct,
              });
            }
          } else if (event.status === 'verifying sha256 digest') {
            cb?.({ status: 'verifying', percentComplete: 99 });
          } else if (event.status === 'success') {
            cb?.({ status: 'complete', percentComplete: 100 });
          }
        } catch {
          // Non-JSON line — ignore
        }
      }
    }

    this.status.model = modelName;
  }

  async checkDiskSpace(requiredGB: number = 6): Promise<boolean> {
    if (process.platform !== 'win32') {
      try {
        const output = execSync('df -BG --output=avail / 2>/dev/null || df -k / | tail -1', {
          encoding: 'utf8',
        });
        const match = output.match(/(\d+)/);
        if (match) {
          const availGB = parseInt(match[1]);
          return availGB >= requiredGB;
        }
      } catch {
        // Can't determine disk space — allow
      }
    }
    // Windows: use Node statfs when available (Node 18+) — fallback: allow
    return true;
  }

  getStatus(): OllamaStatus {
    return { ...this.status };
  }

  private _startHealthMonitor(): void {
    this.healthTimer = setInterval(async () => {
      const alive = await this.isReachable();
      if (alive !== this.status.running) {
        this.status.running = alive;
        console.log(`[Ollama] Health status changed: running=${alive}`);
      }
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  async shutdown(): Promise<void> {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
    if (this.process) {
      this.process.kill('SIGTERM');
      // Wait up to 3s for graceful exit
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          this.process?.kill('SIGKILL');
          resolve();
        }, 3000);
        this.process?.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
      this.process = null;
    }
    this.status = { running: false, model: null, source: 'none' };
  }
}
