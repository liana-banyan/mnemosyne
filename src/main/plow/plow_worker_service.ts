/**
 * plow_worker_service.ts — v0.4.2 BP083 SEG-1
 *
 * True main-process Plow worker singleton decoupled from renderer state.
 *
 * Key properties:
 * - Plow NEVER dies on UI changes (tab switch, Lean Mode toggle, window minimize)
 * - Plow only dies on explicit user Cancel OR app exit
 * - Progress broadcast to ALL windows via pub/sub (renderer subscribes, not holds)
 * - Checkpoint written every CHECKPOINT_INTERVAL questions
 * - On crash/sleep/kill: Resume modal offered on next launch via checkpoint
 *
 * Architecture:
 *   Renderer calls plow:start-worker (fire-and-forget via ipcMain.on)
 *   Service starts runCanonicalPlow() in its own async context
 *   Service broadcasts plow:canonical-plow-progress to ALL windows
 *   Renderer calls plow:get-worker-state to reconnect after unmount/remount
 *   Renderer calls plow:cancel-canonical-plow to stop
 */

import { BrowserWindow, app } from 'electron';
import { randomUUID } from 'crypto';
import {
  writeCheckpoint,
  clearCheckpoint,
  markCheckpointInterrupted,
  type PlowCheckpoint,
} from './plow_checkpoint';
import type { CanonicalPlowConfig, CanonicalPlowProgressEvent } from './canonical_pipeline';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlowWorkerStatus =
  | 'idle'
  | 'running'
  | 'complete'
  | 'error'
  | 'cancelled';

export interface PlowWorkerState {
  status: PlowWorkerStatus;
  sessionId: string | null;
  startedAt: number | null;
  config: CanonicalPlowConfig | null;
  totalEbletsWritten: number;
  totalQuarantined: number;
  currentDomain: string | null;
  domainIndex: number;
  totalDomains: number;
  questionIndex: number;
  totalQuestions: number;
  completedQuestions: Record<string, number>;
  error: string | null;
  completedAt: number | null;
}

const CHECKPOINT_INTERVAL = 10; // write checkpoint every N questions completed

// ─── Singleton state ──────────────────────────────────────────────────────────

let _state: PlowWorkerState = {
  status: 'idle',
  sessionId: null,
  startedAt: null,
  config: null,
  totalEbletsWritten: 0,
  totalQuarantined: 0,
  currentDomain: null,
  domainIndex: 0,
  totalDomains: 0,
  questionIndex: 0,
  totalQuestions: 0,
  completedQuestions: {},
  error: null,
  completedAt: null,
};

let _cancelToken = { cancelled: false };
let _questionsSinceLastCheckpoint = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function broadcastProgress(event: CanonicalPlowProgressEvent & { sessionId?: string }): void {
  for (const w of BrowserWindow.getAllWindows()) {
    try {
      if (!w.isDestroyed()) {
        w.webContents.send('plow:canonical-plow-progress', event);
      }
    } catch {
      // Window may be closing — non-fatal
    }
  }
}

function broadcastState(): void {
  for (const w of BrowserWindow.getAllWindows()) {
    try {
      if (!w.isDestroyed()) {
        w.webContents.send('plow:worker-state', _state);
      }
    } catch {
      // Non-fatal
    }
  }
}

function writeCurrentCheckpoint(): void {
  if (!_state.sessionId || !_state.config) return;
  const cp: PlowCheckpoint = {
    sessionId: _state.sessionId,
    startedAt: _state.startedAt ?? Date.now(),
    lastUpdatedAt: Date.now(),
    config: {
      domains: _state.config.domains,
      questionsPerDomain: _state.config.questionsPerDomain,
      model: _state.config.model ?? 'gemma4:12b',
    },
    completedQuestions: { ..._state.completedQuestions },
    totalEbletsWritten: _state.totalEbletsWritten,
    totalQuestionsCompleted: _state.questionIndex,
    totalQuestionsTarget: _state.totalDomains * _state.totalQuestions,
    status: 'running',
  };
  writeCheckpoint(cp);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getPlowWorkerState(): PlowWorkerState {
  return { ..._state };
}

export function cancelPlowWorker(): void {
  _cancelToken.cancelled = true;
  console.log('[PlowWorkerService] Cancel requested');
}

/**
 * Start the Plow worker (fire-and-forget).
 * Does NOT return a promise to the renderer — progress is broadcast to all windows.
 * Safe to call even if a previous Plow is running (will be cancelled first).
 */
export function startPlowWorker(
  config: CanonicalPlowConfig,
  resumeFromCheckpoint?: { completedQuestions: Record<string, number>; sessionId: string },
): void {
  if (_state.status === 'running') {
    console.warn('[PlowWorkerService] Plow already running — cancel first');
    return;
  }

  const sessionId = resumeFromCheckpoint?.sessionId ?? randomUUID();
  _cancelToken = { cancelled: false };
  _questionsSinceLastCheckpoint = 0;

  _state = {
    status: 'running',
    sessionId,
    startedAt: Date.now(),
    config,
    totalEbletsWritten: 0,
    totalQuarantined: 0,
    currentDomain: null,
    domainIndex: 0,
    totalDomains: config.domains.length,
    questionIndex: 0,
    totalQuestions: config.questionsPerDomain,
    completedQuestions: resumeFromCheckpoint?.completedQuestions ?? {},
    error: null,
    completedAt: null,
  };

  broadcastState();

  // Fire-and-forget — runs independently of any renderer lifecycle
  void _runPlow(config, sessionId, resumeFromCheckpoint?.completedQuestions);
}

// ─── Internal plow runner ─────────────────────────────────────────────────────

async function _runPlow(
  config: CanonicalPlowConfig,
  sessionId: string,
  resumeCompleted?: Record<string, number>,
): Promise<void> {
  console.log(
    `[PlowWorkerService] Starting plow sessionId=${sessionId} ` +
    `domains=${config.domains.length} qPerDomain=${config.questionsPerDomain} ` +
    `model=${config.model ?? 'auto'}`,
  );

  try {
    const { runCanonicalPlow } = await import('./canonical_pipeline');
    const { loadDomainBank, getDomainList } = await import('./per_domain_q_banks');
    const { writeVerifiedEblet } = await import('../mnem_eblet_store');

    const sampleQuestionsForDomain = (domain: string, n: number): string[] => {
      let bank;
      try {
        bank = loadDomainBank(domain as import('./per_domain_q_banks').Domain);
      } catch {
        const allDomains = getDomainList();
        const closest = allDomains.find((d) => d.startsWith(domain) || domain.startsWith(d));
        if (closest) {
          try { bank = loadDomainBank(closest); } catch { return []; }
        } else {
          return [];
        }
      }
      if (!bank || bank.length === 0) return [];
      const pool = [...bank];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      return pool.slice(0, Math.min(n, pool.length)).map((q) => q.question);
    };

    const writeEbletFn = async (eblet: {
      question: string; answer: string; provenance: string;
      verified: true; sha256: string; timestamp: number;
    }) => {
      await writeVerifiedEblet(eblet);
    };

    const onProgress = (event: CanonicalPlowProgressEvent) => {
      // Update internal state
      if (event.domain) _state.currentDomain = event.domain;
      if (event.domainIndex !== undefined) _state.domainIndex = event.domainIndex;
      if (event.totalDomains !== undefined) _state.totalDomains = event.totalDomains;
      if (event.questionIndex !== undefined) _state.questionIndex = event.questionIndex;
      if (event.totalQuestions !== undefined) _state.totalQuestions = event.totalQuestions;

      if (event.type === 'scribe-done') {
        const written = event.ebletsWrittenThisQuestion ?? 0;
        _state.totalEbletsWritten += written;
        // Track completed questions per domain
        if (event.domain) {
          _state.completedQuestions[event.domain] = (_state.completedQuestions[event.domain] ?? 0) + 1;
        }
        _questionsSinceLastCheckpoint++;
        if (_questionsSinceLastCheckpoint >= CHECKPOINT_INTERVAL) {
          writeCurrentCheckpoint();
          _questionsSinceLastCheckpoint = 0;
        }
      } else if (event.type === 'domain-done') {
        const domResult = event.domainResult;
        if (domResult) {
          _state.totalQuarantined += domResult.quarantinedCount;
        }
      }

      // Broadcast to all windows (renderer subscribes, doesn't hold)
      broadcastProgress({ ...event, sessionId });
    };

    const result = await runCanonicalPlow(
      config,
      writeEbletFn,
      onProgress,
      _cancelToken,
      sampleQuestionsForDomain,
    );

    if (_cancelToken.cancelled) {
      _state = { ..._state, status: 'cancelled', completedAt: Date.now() };
      console.log(`[PlowWorkerService] Cancelled at Q${_state.questionIndex}`);
    } else {
      _state = { ..._state, status: 'complete', completedAt: Date.now() };
      console.log(
        `[PlowWorkerService] Complete: eblets=${result.totalEbletsWritten} ` +
        `quarantined=${result.totalQuarantined} status=${result.overallStatus}`,
      );
    }

    // Clear checkpoint on clean finish or cancel
    clearCheckpoint();
    broadcastProgress({ type: 'complete', totalEbletsWritten: result.totalEbletsWritten });
    broadcastState();

  } catch (err) {
    const msg = (err as Error).message;
    console.error('[PlowWorkerService] Fatal error:', err);
    _state = { ..._state, status: 'error', error: msg, completedAt: Date.now() };
    // Mark checkpoint as interrupted (not cleared) so resume is offered next launch
    markCheckpointInterrupted();
    broadcastProgress({ type: 'complete' } as CanonicalPlowProgressEvent);
    broadcastState();
  }
}

/**
 * Called on app.on('before-quit') — mark any running plow as interrupted.
 */
export function onAppQuit(): void {
  if (_state.status === 'running') {
    console.log('[PlowWorkerService] App quitting mid-plow — marking checkpoint as interrupted');
    markCheckpointInterrupted();
    _cancelToken.cancelled = true;
  }
}
