// AMPLIFY Computer — Ollama Lifecycle Manager
// B37 Phase 2 — Ollama process spawn, health check, model pull, graceful shutdown
// Handles: pre-installed Ollama detection, bundled binary fallback, model management

import { spawn, ChildProcess, execSync } from 'child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { app } from 'electron';
import {
  FLOOR_MODEL,
  FLOOR_MODEL_ALIASES,
  isFloorModel,
} from '../shared/floor-model';

const OLLAMA_API_BASE = 'http://127.0.0.1:11434';
const DEFAULT_MODEL = FLOOR_MODEL;
const HEALTH_CHECK_INTERVAL_MS = 30_000;
const STARTUP_TIMEOUT_MS = 30_000;
const HEARTBEAT_INTERVAL_MS = 2_000;

export interface OllamaStatus {
  running: boolean;
  model: string | null;
  version?: string;
  pid?: number;
  source: 'pre-installed' | 'bundled' | 'none';
  /** SEG-V0148-P2: resolved Ollama binary path (null for PRE_INSTALLED_RUNNING). */
  resolvedBinaryPath?: string | null;
  /** SEG-V0148-P2: which init() branch was taken. */
  resolvedBranch?: 'PRE_INSTALLED_RUNNING' | 'PRE_INSTALLED_SPAWN' | 'BUNDLED_SPAWN' | 'NONE';
}

export interface ModelPullProgress {
  status: string;
  phase: 'manifest' | 'downloading' | 'verifying' | 'writing' | 'success' | 'error';
  completed?: number;
  total?: number;
  layerIndex?: number;
  layerCount?: number;
  digest?: string;
  percentComplete?: number;
  error?: string;
  // Legacy fields (kept for backward compatibility)
  bytesDownloaded?: number;
  totalBytes?: number;
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

/** SEG-V0147-FIX-1: Status update event payload for IPC heartbeat. */
export interface OllamaStatusUpdate {
  branch: 'PRE_INSTALLED_RUNNING' | 'PRE_INSTALLED_SPAWN' | 'BUNDLED_SPAWN' | 'NONE';
  message: string;
  elapsedMs?: number;
  /** SEG-V0147-FIX-4: true when exit code 0xC0000135 (STATUS_DLL_NOT_FOUND) detected — VC++ runtime missing. */
  vcredistRequired?: boolean;
}

export class OllamaManager {
  private process: ChildProcess | null = null;
  private status: OllamaStatus = { running: false, model: null, source: 'none' };
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private onProgress?: (progress: ModelPullProgress) => void;
  /** SEG-V0147-FIX-1: callback for IPC status updates to renderer */
  private onStatusUpdate?: (update: OllamaStatusUpdate) => void;
  /** SEG-V0148-P2: resolved binary path and branch from last init() */
  private _resolvedBinaryPath: string | null = null;
  private _resolvedBranch: OllamaStatusUpdate['branch'] = 'NONE';
  /** SEG-1 v0.1.56: best available Gemma family model, resolved at init time. */
  private _selectedModel: string | null = null;

  setProgressCallback(cb: (progress: ModelPullProgress) => void): void {
    this.onProgress = cb;
  }

  /** SEG-V0147-FIX-1: Register IPC status callback (called by index.ts after init). */
  setStatusUpdateCallback(cb: (update: OllamaStatusUpdate) => void): void {
    this.onStatusUpdate = cb;
  }

  private _emitStatus(branch: OllamaStatusUpdate['branch'], message: string, elapsedMs?: number): void {
    console.log(`[Ollama] branch=${branch} ${message}${elapsedMs !== undefined ? ` (${(elapsedMs / 1000).toFixed(1)}s elapsed)` : ''}`);
    this.onStatusUpdate?.({ branch, message, elapsedMs });
  }

  async init(): Promise<void> {
    // 1. Check if Ollama is already running (most common case — user has it installed)
    this._emitStatus('PRE_INSTALLED_RUNNING', 'Trying pre-installed Ollama on port 11434…');
    const alreadyRunning = await this.isReachable();
    if (alreadyRunning) {
      const version = await this._getVersion();
      this._resolvedBranch = 'PRE_INSTALLED_RUNNING';
      this._resolvedBinaryPath = null;
      this.status = { running: true, model: DEFAULT_MODEL, source: 'pre-installed', version, resolvedBranch: 'PRE_INSTALLED_RUNNING', resolvedBinaryPath: null };
      this._emitStatus('PRE_INSTALLED_RUNNING', `Pre-installed Ollama detected (${version}) — connecting…`);
      await this.selectBestGemmaModel();
      this._startHealthMonitor();
      return;
    }

    // 2. Try to start pre-installed Ollama binary
    const preInstalled = this._findPreInstalledBinary();
    if (preInstalled) {
      this._emitStatus('PRE_INSTALLED_SPAWN', `Starting pre-installed Ollama from ${preInstalled}…`);
      await this._spawnOllama(preInstalled, 'PRE_INSTALLED_SPAWN');
      if (await this._waitForStartup('PRE_INSTALLED_SPAWN')) {
        const version = await this._getVersion();
        this._resolvedBranch = 'PRE_INSTALLED_SPAWN';
        this._resolvedBinaryPath = preInstalled;
        this.status = { running: true, model: null, source: 'pre-installed', version, resolvedBranch: 'PRE_INSTALLED_SPAWN', resolvedBinaryPath: preInstalled };
        this._emitStatus('PRE_INSTALLED_SPAWN', `Ollama port 11434 ready (pre-installed ${version})`);
        await this.selectBestGemmaModel();
        this._startHealthMonitor();
        return;
      }
      this._emitStatus('PRE_INSTALLED_SPAWN', 'Pre-installed Ollama did not start — falling back to bundled…');
    }

    // 3. Try bundled binary (Phase 2: bundled with MnemosyneC installer)
    const bundledBinary = this._findBundledBinary();
    if (bundledBinary) {
      this._emitStatus('BUNDLED_SPAWN', `Bundled Ollama spawned — waiting for port 11434… (${bundledBinary})`);
      await this._spawnOllama(bundledBinary, 'BUNDLED_SPAWN');
      if (await this._waitForStartup('BUNDLED_SPAWN')) {
        const version = await this._getVersion();
        this._resolvedBranch = 'BUNDLED_SPAWN';
        this._resolvedBinaryPath = bundledBinary;
        this.status = { running: true, model: null, source: 'bundled', version, resolvedBranch: 'BUNDLED_SPAWN', resolvedBinaryPath: bundledBinary };
        this._emitStatus('BUNDLED_SPAWN', `Ollama port 11434 ready (bundled ${version})`);
        await this.selectBestGemmaModel();
        this._startHealthMonitor();
        return;
      }
      this._emitStatus('BUNDLED_SPAWN', 'Ollama init failed: bundled binary did not respond on port 11434');
    }

    // 4. Ollama not available — record not-running state
    this._emitStatus('NONE', 'Ollama init failed: no working Ollama found. Local inference disabled.');
    console.warn('[Ollama] Not available. Local inference disabled until Ollama is installed.');
    this._resolvedBranch = 'NONE';
    this._resolvedBinaryPath = null;
    this.status = { running: false, model: null, source: 'none', resolvedBranch: 'NONE', resolvedBinaryPath: null };
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

    // Check both extraResources path (resources/ollama/) and asarUnpack path
    // (resources/app.asar.unpacked/resources/ollama/) depending on how
    // electron-builder included the binary in this build.
    const candidates = process.platform === 'win32'
      ? [
          join(resourcesPath, 'ollama', 'ollama.exe'),
          join(resourcesPath, 'app.asar.unpacked', 'resources', 'ollama', 'ollama.exe'),
        ]
      : [
          join(resourcesPath, 'ollama', 'ollama'),
          join(resourcesPath, 'app.asar.unpacked', 'resources', 'ollama', 'ollama'),
        ];

    return candidates.find((p) => existsSync(p)) ?? null;
  }

  /** SEG-2 v0.1.55: respect installer/system OLLAMA_HOST (LAN binding); explicit OLLAMA_MODELS path. */
  private async _spawnOllama(binary: string, branch: OllamaStatusUpdate['branch']): Promise<void> {
    // SEG-V0147-FIX-2: OLLAMA_MODELS must point to the bundled model store, NOT ~/.ollama/models.
    // This prevents the bundled Ollama from accidentally reading the user's pre-installed model store
    // and failing silently when running from a packaged build without those models.
    const resourcesOllamaPath = this._resourcesOllamaPath();
    const bundledModelsPath = join(resourcesOllamaPath, 'bundled', 'models');

    this.process = spawn(binary, ['serve'], {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // SEG-2 v0.1.55: NSIS sets system OLLAMA_HOST=0.0.0.0:11434; inherit when present
        OLLAMA_HOST: process.env.OLLAMA_HOST || '0.0.0.0:11434',
        OLLAMA_ORIGINS: 'http://localhost:5173,http://localhost:3000,app://.',
        // SEG-V0147-FIX-2: explicit model path so bundled Ollama uses bundled models
        OLLAMA_MODELS: bundledModelsPath,
      },
    });

    this.process.stdout?.on('data', (d: Buffer) => {
      const msg = d.toString().trim();
      if (msg) {
        console.log(`[Ollama stdout] ${msg}`);
        this._emitStatus(branch, msg);
      }
    });

    this.process.stderr?.on('data', (d: Buffer) => {
      const msg = d.toString().trim();
      if (msg) {
        console.warn(`[Ollama stderr] ${msg}`);
        this._emitStatus(branch, msg);
      }
    });

    this.process.on('exit', (code, signal) => {
      console.warn(`[Ollama] Process exited (code=${code} signal=${signal})`);
      this.status.running = false;
      this.process = null;

      // SEG-V0147-FIX-4: 0xC0000135 = STATUS_DLL_NOT_FOUND — VC++ 2019 x64 runtime missing.
      // Node reports this as either the unsigned NTSTATUS (3221225781) or signed 32-bit (-1073741515).
      const DLL_NOT_FOUND_UNSIGNED = 0xc0000135; // 3221225781
      const DLL_NOT_FOUND_SIGNED   = -1073741515;
      if (code === DLL_NOT_FOUND_UNSIGNED || code === DLL_NOT_FOUND_SIGNED) {
        const vcMsg =
          'Ollama failed to start — VC++ 2019 x64 runtime may be missing. ' +
          'Reinstall MnemosyneC to repair (the installer includes vc_redist.x64.exe), ' +
          'or run vc_redist.x64.exe from the install directory: ' +
          '%LOCALAPPDATA%\\Programs\\MnemosyneC\\resources\\vcredist\\vc_redist.x64.exe';
        console.error(`[Ollama] ${vcMsg}`);
        this.onStatusUpdate?.({ branch, message: vcMsg, vcredistRequired: true });
      }
    });
  }

  /** SEG-V0147-FIX-1: heartbeat every 2s while waiting for port 11434 — never silent >3s. */
  private _waitForStartup(branch: OllamaStatusUpdate['branch']): Promise<boolean> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const deadline = startTime + STARTUP_TIMEOUT_MS;

      const poll = async () => {
        if (await this.isReachable()) {
          resolve(true);
          return;
        }
        const now = Date.now();
        if (now > deadline) {
          resolve(false);
          return;
        }
        const elapsedMs = now - startTime;
        // Heartbeat: emit IPC status every HEARTBEAT_INTERVAL_MS so UI never goes silent
        if (elapsedMs > 0 && elapsedMs % HEARTBEAT_INTERVAL_MS < 600) {
          this._emitStatus(branch, `Waiting for Ollama…`, elapsedMs);
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

  /**
   * SEG-1 v0.1.56: Family-match algorithm for Gemma-family models.
   * Queries /api/tags, filters by 'gemma' prefix, ranks by size then version.
   * Primary size preference: 12b > 13b/27b > other sizes.
   * Tiebreaker: higher version number (gemma4 > gemma2 > gemma).
   * Caches result in _selectedModel. Returns null if no gemma model found.
   */
  async selectBestGemmaModel(): Promise<string | null> {
    try {
      const models = await this.listModels();
      const gemmaModels = models.filter((m) =>
        m.split(':')[0].toLowerCase().startsWith('gemma'),
      );

      if (gemmaModels.length === 0) {
        console.log('[OllamaManager] no gemma family models found in ollama list');
        this._selectedModel = null;
        return null;
      }

      const sizeScore = (tag: string): number => {
        const m = tag.match(/(\d+)b/i);
        if (!m) return 0;
        const n = parseInt(m[1]);
        if (n === 12) return 1000;
        if (n === 13) return 900;
        if (n === 27) return 850;
        if (n >= 7) return 600 + n;
        return n; // smaller is lower priority
      };

      const versionScore = (modelName: string): number => {
        const base = modelName.split(':')[0].toLowerCase();
        const m = base.match(/gemma(\d+)/);
        return m ? parseInt(m[1]) : 0; // gemma=0, gemma2=2, gemma3=3, gemma4=4
      };

      const ranked = [...gemmaModels].sort((a, b) => {
        const aTag = a.includes(':') ? a.split(':')[1] : '';
        const bTag = b.includes(':') ? b.split(':')[1] : '';
        const sizeDiff = sizeScore(bTag) - sizeScore(aTag);
        if (sizeDiff !== 0) return sizeDiff;
        return versionScore(b) - versionScore(a);
      });

      const selected = ranked[0];
      this._selectedModel = selected;
      console.log(`[OllamaManager] selected model: ${selected}`);
      return selected;
    } catch (err) {
      console.warn('[OllamaManager] selectBestGemmaModel failed:', err);
      this._selectedModel = null;
      return null;
    }
  }

  /** SEG-1 v0.1.56: Returns the cached best Gemma family model, or null if none was found. */
  getSelectedModel(): string | null {
    return this._selectedModel;
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
    if (!app.isPackaged) return join(__dirname, '../../resources/ollama');
    // Check extraResources path first (resources/ollama/), then asarUnpack path
    const extraResourcesPath = join(process.resourcesPath, 'ollama');
    if (existsSync(extraResourcesPath)) return extraResourcesPath;
    // asarUnpack path: resources/app.asar.unpacked/resources/ollama/
    return join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'ollama');
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
    } else {
      this.status.source = 'pre-installed';
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

    // Track layer progress
    const layerDigests = new Set<string>();
    const layerProgress = new Map<string, { completed: number; total: number }>();

    cb?.({
      status: 'pulling manifest',
      phase: 'manifest',
      percentComplete: 0,
    });

    const res = await fetch(`${OLLAMA_API_BASE}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true }),
    });

    if (!res.ok || !res.body) {
      cb?.({
        status: 'error',
        phase: 'error',
        error: `Pull request failed: ${res.statusText}`,
      });
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
            digest?: string;
          };

          // Determine phase from status
          let phase: ModelPullProgress['phase'] = 'downloading';
          if (event.status.includes('pulling manifest')) {
            phase = 'manifest';
          } else if (event.status.includes('verifying')) {
            phase = 'verifying';
          } else if (event.status.includes('writing manifest')) {
            phase = 'writing';
          } else if (event.status === 'success') {
            phase = 'success';
          } else if (event.status.includes('downloading') || event.status.includes('pulling')) {
            phase = 'downloading';
          }

          // Track layers by digest
          if (event.digest && event.total) {
            layerDigests.add(event.digest);
            layerProgress.set(event.digest, {
              completed: event.completed ?? 0,
              total: event.total,
            });
          }

          // Build progress payload
          const progress: ModelPullProgress = {
            status: event.status,
            phase,
          };

          if (event.total && event.completed !== undefined) {
            const pct = Math.round((event.completed / event.total) * 100);
            progress.completed = event.completed;
            progress.total = event.total;
            progress.bytesDownloaded = event.completed;
            progress.totalBytes = event.total;
            progress.percentComplete = pct;

            if (event.digest) {
              progress.digest = event.digest;
              // Calculate layer index (1-based)
              const layerArray = Array.from(layerDigests);
              progress.layerIndex = layerArray.indexOf(event.digest) + 1;
              progress.layerCount = layerDigests.size;
            }

            if (pct !== lastPercent) {
              lastPercent = pct;
              cb?.(progress);
            }
          } else if (phase === 'verifying') {
            progress.percentComplete = 99;
            cb?.(progress);
          } else if (phase === 'success') {
            progress.percentComplete = 100;
            cb?.(progress);
          } else if (phase === 'manifest' || phase === 'writing') {
            cb?.(progress);
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

  /** SEG-V0148-P2: path of the Ollama binary that was spawned (null if pre-installed was already running). */
  getResolvedBinaryPath(): string | null {
    return this._resolvedBinaryPath;
  }

  /** SEG-V0148-P2: which init() branch was taken. */
  getResolvedBranch(): OllamaStatusUpdate['branch'] {
    return this._resolvedBranch;
  }

  /**
   * SEG-V0148-P0-SKU-MODEL: Promote to the full-tier model if SKU says 'full' and model is available.
   * Emits diagnostic log lines: activeModel=<x> targetModel=<y>.
   * MISMATCH line is visually distinct so future regressions are immediately identifiable.
   */
  async resolveActiveModel(): Promise<{
    activeModel: string;
    targetModel: string;
    promoted: boolean;
    mismatch: boolean;
  }> {
    // SEG-1 v0.1.56: use family-matched model instead of hard-coded 'gemma4:12b'.
    // Ensures machines with gemma2:12b, gemma:12b, etc. are correctly promoted.
    const familySelected = this._selectedModel ?? await this.selectBestGemmaModel();
    const FULL_TIER_MODEL = familySelected ?? 'gemma4:12b';

    let tier = 'floor';
    try {
      const skuPath = join(app.getPath('userData'), 'sku_tier.json');
      if (existsSync(skuPath)) {
        const raw = readFileSync(skuPath, 'utf-8');
        const sku = JSON.parse(raw) as { tier?: string };
        tier = sku.tier ?? 'floor';
      } else if (familySelected && /12b/i.test(familySelected)) {
        // Back-fill: a 12b gemma is present — treat as full tier
        tier = 'full';
        try {
          writeFileSync(skuPath, JSON.stringify({ tier: 'full', model: familySelected }), 'utf-8');
          console.log(`[Ollama/SKU] Back-filled sku_tier.json from family-matched model: ${familySelected}`);
        } catch { /* non-fatal */ }
      }
    } catch { /* non-fatal */ }

    const targetModel = tier === 'full' ? FULL_TIER_MODEL : DEFAULT_MODEL;

    if (tier === 'full') {
      if (familySelected) {
        this.status.model = familySelected;
        console.log(
          `[Ollama/SKU] ✓ MATCH  activeModel=${familySelected} targetModel=${FULL_TIER_MODEL}`,
        );
        return { activeModel: familySelected, targetModel: FULL_TIER_MODEL, promoted: true, mismatch: false };
      } else {
        const activeModel = this.status.model ?? DEFAULT_MODEL;
        console.warn(
          `[Ollama/SKU] ⚠ MISMATCH  activeModel=${activeModel} targetModel=${FULL_TIER_MODEL}` +
          ` ← full-tier model not in ollama list — verify model installation`,
        );
        this.onStatusUpdate?.({
          branch: this._resolvedBranch,
          message:
            `Full-tier model ${FULL_TIER_MODEL} not found on disk. ` +
            `Serving floor model instead. Check model installation.`,
        });
        return { activeModel, targetModel: FULL_TIER_MODEL, promoted: false, mismatch: true };
      }
    }

    const activeModel = this.status.model ?? DEFAULT_MODEL;
    console.log(`[Ollama/SKU] activeModel=${activeModel} targetModel=${targetModel}`);
    return { activeModel, targetModel, promoted: false, mismatch: false };
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

/** SEG-1 v0.1.55 — single process-wide instance; all IPC/settings/Ask paths share one health-check + model state. */
export const ollamaManager = new OllamaManager();
