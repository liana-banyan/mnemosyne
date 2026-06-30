// relay_answer/index.ts — BP099→BP100 K20: Supervised child process pattern for answer-poller.
// Exponential backoff restart: min(5s × 2^N, 120s). Crash-loop guard at 30 crashes / 5 min.
// consecutive_crash_count resets after 60s stable run.
// canon: canon_fix_as_we_go_build_for_the_long_haul_always_convenient_immutables_bp053
// canon: canon_designed_to_be_copied_autonomous_propagation_doctrine_bp051

import { fork, type ChildProcess } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync } from 'fs';

const MNEMOSYNE_HOME = join(homedir(), '.mnemosyne');
const CRASH_LOG_FILE = join(MNEMOSYNE_HOME, 'poller_crash_log.json');
// BP101 K21: singleton PID-file lock — refuses double-spawn of the poller worker.
const POLLER_PID_FILE = join(MNEMOSYNE_HOME, 'relay_worker.pid');
// BP101 K21: supervisor liveness watchdog — detects wedged-but-alive worker (inflight latched true forever).
const LIVENESS_CHECK_INTERVAL_MS = 30_000;
const LIVENESS_STALE_THRESHOLD_MS = 120_000;

const ts = () => new Date().toISOString().slice(11, 23);
const log = (msg: string) => console.log(`[relay_supervisor] [${ts()}] ${msg}`);

// ─── Exported state (consumed by Module 4 IPC handler) ───────────────────────

/** True once the child process has sent its first 'started' message */
export let relayPollerStarted = false;
export let relayPollerLastHeartbeat: string | null = null;
export let relayPollerLastError: string | null = null;

// Module 4 state
export let pollerProcess: ChildProcess | null = null;
export let pollerStartedAt: number | null = null;
export let lastRouteProcessedAt: string | null = null;
export let lastRouteId: string | null = null;
export let totalRestartCount = 0;
export let ollamaCurrentlyDown = false;
export let consecutiveCrashCount = 0;

// Module 5: track last heartbeat timestamp for split-brain detector
export let lastHeartbeatEmittedAt: number = Date.now();

export interface RelayAnswerPollerConfig {
  peerId: string;
  supabaseUrl: string;
  anonKey: string;
  model?: string;
  pollIntervalMs?: number;
  ollamaUrl?: string;
}

// ─── Crash log ────────────────────────────────────────────────────────────────

interface CrashLogEntry {
  event: string;
  exit_code: number | null;
  signal: string | null;
  timestamp: string;
  restart_count: number;
}

function appendCrashLog(entry: CrashLogEntry): void {
  try {
    mkdirSync(MNEMOSYNE_HOME, { recursive: true });
    let entries: CrashLogEntry[] = [];
    if (existsSync(CRASH_LOG_FILE)) {
      try { entries = JSON.parse(readFileSync(CRASH_LOG_FILE, 'utf-8')) as CrashLogEntry[]; } catch { /* corrupt — reset */ }
    }
    entries.push(entry);
    // Keep last 500 entries
    if (entries.length > 500) entries = entries.slice(-500);
    writeFileSync(CRASH_LOG_FILE, JSON.stringify(entries, null, 2), 'utf-8');
  } catch (e: unknown) {
    process.stderr.write(`[relay_supervisor] crash log write failed: ${(e as Error).message}\n`);
  }
}

// ─── Crash-loop tracking ──────────────────────────────────────────────────────

const recentCrashTimestamps: number[] = [];
const CRASH_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const CRASH_LOOP_THRESHOLD = 30;

function recordCrash(): boolean {
  const now = Date.now();
  // Prune timestamps outside window
  while (recentCrashTimestamps.length > 0 && recentCrashTimestamps[0] < now - CRASH_WINDOW_MS) {
    recentCrashTimestamps.shift();
  }
  recentCrashTimestamps.push(now);
  return recentCrashTimestamps.length >= CRASH_LOOP_THRESHOLD;
}

let pollerHaltedUntilUserAction = false;
let stableRunTimer: ReturnType<typeof setTimeout> | null = null;
let _config: RelayAnswerPollerConfig | null = null;

function scheduleStableReset(): void {
  if (stableRunTimer) clearTimeout(stableRunTimer);
  stableRunTimer = setTimeout(() => {
    if (consecutiveCrashCount > 0) {
      log(`stable for 60s — resetting consecutiveCrashCount from ${consecutiveCrashCount} to 0`);
      consecutiveCrashCount = 0;
    }
  }, 60_000);
}

// ─── Singleton PID-file lock (BP101 K21) ──────────────────────────────────────

/**
 * Returns true if a worker may be spawned (no live conflicting process holds the lock).
 * Stale (dead-PID) lock files are cleaned up automatically. Reversible: any failure here
 * is logged and treated as "lock not held" so a write/read glitch never blocks spawning.
 */
function acquirePollerLock(): boolean {
  try {
    if (existsSync(POLLER_PID_FILE)) {
      const raw = readFileSync(POLLER_PID_FILE, 'utf-8').trim();
      const existingPid = parseInt(raw, 10);
      if (!Number.isNaN(existingPid) && existingPid !== process.pid) {
        try {
          process.kill(existingPid, 0); // signal 0 = liveness probe, throws if dead
          log(`REFUSING double-spawn — relay_worker.pid (${existingPid}) is alive`);
          return false;
        } catch {
          log(`stale PID file (pid ${existingPid} not alive) — clearing and proceeding`);
        }
      }
    }
  } catch (e: unknown) {
    process.stderr.write(`[relay_supervisor] PID-lock read failed (non-fatal, proceeding): ${(e as Error).message}\n`);
  }
  return true;
}

function writePollerLock(pid: number): void {
  try {
    mkdirSync(MNEMOSYNE_HOME, { recursive: true });
    writeFileSync(POLLER_PID_FILE, String(pid), 'utf-8');
  } catch (e: unknown) {
    process.stderr.write(`[relay_supervisor] PID-lock write failed (non-fatal): ${(e as Error).message}\n`);
  }
}

function clearPollerLock(): void {
  try {
    if (existsSync(POLLER_PID_FILE)) {
      const raw = readFileSync(POLLER_PID_FILE, 'utf-8').trim();
      // Only clear if it's still our own PID (avoid clobbering a newer lock holder's file)
      if (parseInt(raw, 10) === process.pid || raw === '') {
        unlinkSync(POLLER_PID_FILE);
      }
    }
  } catch (e: unknown) {
    process.stderr.write(`[relay_supervisor] PID-lock clear failed (non-fatal): ${(e as Error).message}\n`);
  }
}

// ─── Spawn + supervise ────────────────────────────────────────────────────────

function spawnWorker(config: RelayAnswerPollerConfig): void {
  if (pollerHaltedUntilUserAction) {
    log('HALTED — crash-loop guard active; poller will not restart until user action');
    return;
  }

  // BP101 K21: singleton lock — refuse to spawn a second worker if one is already alive.
  if (!acquirePollerLock()) {
    return;
  }

  // Resolve path to compiled worker.js
  const workerPath = join(__dirname, 'worker.js');
  log(`spawning worker at ${workerPath}`);

  const child = fork(workerPath, [], {
    silent: false,
    execArgv: [],
  });

  pollerProcess = child;
  pollerStartedAt = Date.now();
  scheduleStableReset();
  writePollerLock(child.pid ?? process.pid);

  // Send config to child
  child.send({ type: 'init', config });

  // Handle messages from child
  child.on('message', (msg: Record<string, unknown>) => {
    switch (msg.type) {
      case 'started':
        relayPollerStarted = true;
        log('worker started');
        break;
      case 'heartbeat':
        relayPollerLastHeartbeat = msg.heartbeatAt as string;
        lastHeartbeatEmittedAt = Date.now();
        break;
      case 'route_processed':
        lastRouteProcessedAt = msg.processedAt as string;
        lastRouteId = msg.routeId as string;
        break;
      case 'ollama_down':
        ollamaCurrentlyDown = true;
        break;
      case 'ollama_up':
        ollamaCurrentlyDown = false;
        break;
      case 'tick_error':
        relayPollerLastError = msg.message as string;
        break;
    }
  });

  child.on('error', (err) => {
    log(`worker process error: ${err.message}`);
    relayPollerLastError = err.message;
  });

  child.on('exit', (code, signal) => {
    if (pollerHaltedUntilUserAction) return;

    const unexpectedExit = code !== 0 || signal !== null;
    if (!unexpectedExit) {
      log('worker exited cleanly');
      clearPollerLock();
      return;
    }

    consecutiveCrashCount++;
    totalRestartCount++;
    const entry: CrashLogEntry = {
      event: 'crash',
      exit_code: code,
      signal: signal as string | null,
      timestamp: new Date().toISOString(),
      restart_count: totalRestartCount,
    };
    log(`worker crashed (exit_code=${code} signal=${signal}) — restart #${totalRestartCount}`);
    appendCrashLog(entry);
    relayPollerLastError = `crash exit_code=${code} signal=${signal}`;

    const isCrashLoop = recordCrash();
    if (isCrashLoop) {
      pollerHaltedUntilUserAction = true;
      log('CRASH-LOOP GUARD: 30+ crashes in 5 min — halting poller until user action');
      // Electron notification would go here; imported lazily to avoid circular dep
      try {
        const { Notification } = require('electron') as typeof import('electron');
        new Notification({
          title: 'MnemosyneC — Poller Halted',
          body: 'Answer-poller crash-looped (30+ crashes / 5 min). Restart the app to recover.',
        }).show();
      } catch { /* non-fatal */ }
      return;
    }

    const backoffMs = Math.min(5000 * Math.pow(2, consecutiveCrashCount - 1), 120_000);
    log(`backoff ${backoffMs}ms before respawn (consecutiveCrashCount=${consecutiveCrashCount})`);
    setTimeout(() => {
      if (_config && !pollerHaltedUntilUserAction) {
        spawnWorker(_config);
      }
    }, backoffMs);
  });
}

// ─── Supervisor liveness watchdog (BP101 K21) ─────────────────────────────────

let livenessIntervalHandle: ReturnType<typeof setInterval> | null = null;

function startLivenessWatchdog(): void {
  if (livenessIntervalHandle) return;
  livenessIntervalHandle = setInterval(() => {
    if (pollerHaltedUntilUserAction) return;
    if (!pollerProcess || pollerProcess.killed) return;
    const gapMs = Date.now() - lastHeartbeatEmittedAt;
    if (gapMs > LIVENESS_STALE_THRESHOLD_MS) {
      log(`wedged worker detected: heartbeat stale > ${LIVENESS_STALE_THRESHOLD_MS}ms (gap=${gapMs}ms) — force-kill + respawn`);
      try {
        pollerProcess.kill('SIGKILL');
      } catch (e: unknown) {
        process.stderr.write(`[relay_supervisor] liveness force-kill failed: ${(e as Error).message}\n`);
      }
      // existing child.on('exit', ...) backoff handler will respawn naturally
    }
  }, LIVENESS_CHECK_INTERVAL_MS);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function startRelayAnswerPoller(config: RelayAnswerPollerConfig): () => void {
  _config = config;
  spawnWorker(config);
  startLivenessWatchdog();

  return () => {
    log('stop requested — sending SIGTERM to worker');
    if (pollerProcess && !pollerProcess.killed) {
      try {
        pollerProcess.send({ type: 'stop' });
        // Give 2s for graceful shutdown, then force kill
        setTimeout(() => {
          if (pollerProcess && !pollerProcess.killed) {
            pollerProcess.kill('SIGTERM');
          }
        }, 2000);
      } catch { /* ignore */ }
    }
    if (stableRunTimer) { clearTimeout(stableRunTimer); stableRunTimer = null; }
    if (livenessIntervalHandle) { clearInterval(livenessIntervalHandle); livenessIntervalHandle = null; }
    clearPollerLock();
  };
}
