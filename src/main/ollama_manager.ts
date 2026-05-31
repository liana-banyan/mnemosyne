// AMPLIFY Computer — Ollama Lifecycle Manager
// B37 Phase 2 — Ollama process spawn, health check, model pull, graceful shutdown
// Handles: pre-installed Ollama detection, bundled binary fallback, model management

import { spawn, ChildProcess, execSync } from 'child_process';
import { cpSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { app } from 'electron';
import {
  FLOOR_MODEL,
  FLOOR_MODEL_ALIASES,
  isFloorModel,
} from '../shared/floor-model';

const OLLAMA_API_BASE = 'http://localhost:11434';
const DEFAULT_MODEL = FLOOR_MODEL;
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

/** BP067 — transparent install progress (real steps, plain language). */
export type EngineSetupStep =
  | 'checking'
  | 'found_existing'
  | 'starting_engine'
  | 'importing_bundled'
  | 'pulling_floor'
  | 'ready'
  | 'error';

export interface EngineSetupProgress {
  step: EngineSetupStep;
  message: string;
  detail?: string;
  percentComplete?: number;
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

  async hasFloorModel(): Promise<boolean> {
    const models = await this.listModels();
    return models.some((m) => isFloorModel(m));
  }

  private _resourcesOllamaPath(): string {
    return app.isPackaged
      ? join(process.resourcesPath, 'ollama')
      : join(__dirname, '../../resources/ollama');
  }

  private _bundledModelsPath(): string {
    return join(this._resourcesOllamaPath(), 'bundled', 'models');
  }

  /** Copy pre-built Ollama model tree from installer bundle into user store. */
  private _importBundledModels(): boolean {
    const bundled = this._bundledModelsPath();
    if (!existsSync(bundled)) return false;

    const userModels = join(homedir(), '.ollama', 'models');
    mkdirSync(userModels, { recursive: true });

    const copyTree = (src: string, dest: string) => {
      for (const entry of readdirSync(src, { withFileTypes: true })) {
        const s = join(src, entry.name);
        const d = join(dest, entry.name);
        if (entry.isDirectory()) {
          mkdirSync(d, { recursive: true });
          copyTree(s, d);
        } else if (!existsSync(d)) {
          cpSync(s, d);
        }
      }
    };

    try {
      copyTree(bundled, userModels);
      console.log('[Ollama] Imported bundled floor model from installer resources');
      return true;
    } catch (err) {
      console.warn('[Ollama] Bundled model import failed:', err);
      return false;
    }
  }

  /**
   * BP067 — ensure private AI floor is ready: bundled import first, then pull.
   */
  async ensureFloorModel(
    onProgress?: (p: EngineSetupProgress) => void,
    pullProgress?: (p: ModelPullProgress) => void,
  ): Promise<{ ok: boolean; error?: string }> {
    const emit = (step: EngineSetupStep, message: string, extra?: Partial<EngineSetupProgress>) => {
      onProgress?.({ step, message, ...extra });
    };

    emit('checking', 'Checking your computer for an AI engine…');

    if (!(await this.isReachable())) {
      emit('starting_engine', 'Starting your private AI engine…');
      await this.init();
    }

    if (!(await this.isReachable())) {
      emit('error', 'Could not start a local AI engine.', {
        detail: 'Install Ollama from ollama.com or re-run the MnemosyneC installer.',
      });
      return { ok: false, error: 'Ollama not reachable' };
    }

    if (this.status.source === 'pre-installed') {
      emit('found_existing', '✓ You already have Ollama — using it.');
    }

    if (await this.hasFloorModel()) {
      this.status.model = FLOOR_MODEL;
      emit('ready', '✓ Your private AI is ready.');
      return { ok: true };
    }

    emit('importing_bundled', 'Setting up your AI model…');
    if (this._importBundledModels() && (await this.hasFloorModel())) {
      this.status.model = FLOOR_MODEL;
      emit('ready', '✓ Your private AI is ready.');
      return { ok: true };
    }

    emit('pulling_floor', `Downloading your AI model (${FLOOR_MODEL})… one time, stays on your computer.`);
    try {
      await this.pullModel(FLOOR_MODEL, pullProgress);
      emit('ready', '✓ Your private AI is ready.');
      return { ok: true };
    } catch (err) {
      const msg = String(err);
      emit('error', 'Could not download the AI model.', { detail: msg });
      return { ok: false, error: msg };
    }
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

  /** BP067 — direct floor-model answer for first-run instant payoff (bypasses Normal-mode substrate-only path). */
  async askFloorModel(prompt: string): Promise<{ ok: boolean; text?: string; error?: string }> {
    if (!(await this.isReachable())) {
      return { ok: false, error: 'Local AI engine not running' };
    }
    const model = (await this.hasFloorModel())
      ? (await this.listModels()).find((m) => isFloorModel(m)) ?? FLOOR_MODEL
      : FLOOR_MODEL;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);
      const res = await fetch(`${OLLAMA_API_BASE}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          options: { num_predict: 256, temperature: 0.7 },
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (!res.ok) {
        return { ok: false, error: `Model request failed (${res.status})` };
      }
      const data = await res.json() as { response?: string };
      const text = data.response?.trim();
      if (!text) return { ok: false, error: 'Empty response from local model' };
      this.status.model = model;
      return { ok: true, text };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
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
