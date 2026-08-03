// liana_cycle_scheduler.ts -- KN-BP142-5: give liana_cycle_runner.ts's runLianaCycleTurn a real
// caller inside the main process (canon: canon_liana_cycle_engine_continuous_self_improving_
// substrate_bp139.eblet.md).
//
// THE GAP THIS FILE CLOSES: KN-BP142-3 Phase 1 built liana_cycle_runner.ts (runLianaCycleTurn,
// consultMethodBank, classifyMissType, shouldMintLedgerMark, mintLedgerMark), a correct, verified
// Layer A implementation with no caller anywhere in the application. This file is that caller,
// plus the trigger policy, the progress/receipt visibility surface, and the kill switch the
// ticket asks for. It does NOT change any decision liana_cycle_runner.ts already makes (consult
// matching, TYPE classification, or the ledger-honesty mark-mint gate) -- see that file for the
// decision logic; this file only decides WHEN to call it, WHAT bank to feed it, HOW to surface
// what happened, and WHETHER it is allowed to run at all.
//
// ─── TRIGGER POLICY (documented plainly, per the ticket's explicit requirement) ─────────────────
//
// CHOSEN POLICY: idle-triggered automatic turns (primary, "always-on" in the canon sense) PLUS a
// manual IPC trigger (secondary, Founder-initiated on demand). Both are gated by the SAME kill
// switch (readLianaCycleEnabledFromSettings) and the SAME concurrency guards below.
//
// WHY idle, not a fixed timer and not event-driven-after-mesh-test:
//   - A fixed timer (e.g. "every 2 hours") has no way to know whether the Founder is actively
//     driving a foreground benchmark right now -- it would need the SAME isOneClickRunActive()
//     check this file already applies, so it buys nothing a timer-with-idle-check does not also
//     give, while risking a turn firing mid-foreground-session on a machine under load.
//   - Event-driven-after-mesh-test-run-lands would require hooking a callback into
//     one_click_mmlu_pro.ts's own run-completion path -- a second file this ticket would have to
//     touch, widening the diff for no scope benefit; it would also fire every time the Founder
//     runs ANY benchmark (including the scored 20 itself), which is the wrong cadence entirely
//     for a background self-improvement loop and risks looking like the Engine is reacting to a
//     scored run, which BP134 says it must never appear to be doing.
//   - Idle detection (Electron's own powerMonitor.getSystemIdleTime(), no extra permission or
//     dependency) is the one signal that directly answers "is anyone actively using this machine
//     right now" without touching any other file, and composes naturally with the existing
//     isOneClickRunActive() guard (belt-and-suspenders: idle usually implies no foreground
//     benchmark, but the explicit check is kept regardless, since idle-but-a-benchmark-was-left-
//     running is a real scenario on a machine with plow_worker_service.ts background dispatch).
//
// WHAT IT COSTS (measured, not guessed): KN-BP142-3 Phase 1's own verification
// (scratchpad/verify_kn_bp142_3_phase1_cycle_turn_output.txt) measured ONE real turn over a
// 2-question held-out bank, real local Ollama (llama3.1:8b), browser authority stubbed to an
// honest null (no live browser session required), at 27782ms wall-clock -- roughly 14s/question.
// DEFAULT_QUESTIONS_PER_TURN below is 3, so an automatic turn is expected to cost on the rough
// order of 45-85 seconds of real local Ollama wall-clock time (CPU/GPU load on the Founder's own
// machine, no metered API dollar cost since this targets local Ollama, not a paid authority).
// IDLE_THRESHOLD_SECONDS (10 minutes) and TURN_COOLDOWN_MS (60 minutes) below exist SPECIFICALLY
// so a machine left idle overnight does not turn into a hot loop: idle time alone would otherwise
// stay above threshold continuously for hours, so a per-turn cooldown is load-bearing, not
// decorative.
//
// WHY THE KILL SWITCH DEFAULTS OFF: this is the Engine's first-ever caller. Shipping it
// default-on would mean the very next app launch after this update starts consuming a Founder's
// machine's compute without an explicit opt-in, on a mechanism that has never run end-to-end in
// production before this ticket. That is the same "fail-closed to a behavior-preserving default"
// discipline specialist_adapters.ts's readConcordanceStrictnessFromSettings and every
// researchArm* flag in plow_mc_answerer.ts already use in this codebase (default false/absent,
// explicit opt-in required) -- mirrored here rather than invented fresh. The Founder turns the
// Engine on once via the same IPC toggle this file exposes; from then on the settings file
// persists that choice across restarts.
//
// SCOPE-HONESTY NOTE: this file feeds runLianaCycleTurn a small, deterministic, documented-as-
// NOT-the-scored-20 held-out sample drawn from the SAME bundled MMLU-Pro corpus
// one_click_mmlu_pro.ts's loadBundledQuestions() already ships and already uses for ordinary
// (non-scored-20) benchmark runs -- see buildHeldOutBank() below. This file never imports, reads,
// or references whatever question set the Founder's own "scored 20" benchmark uses, and never
// calls the scored-20 harness. Per BP134, the Founder is the only one who runs scored tests; this
// file's own turn summary is never presented as a scored benchmark result (see the receipt/
// progress payload shapes below -- they carry Cycle-turn language, "consult"/"missType"/
// "marksMinted", never "benchmark accuracy" or "score").

import { app, powerMonitor, ipcMain, BrowserWindow } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { CanonicalPlowAnswerFn, CycleTurnSummary, HeldOutQuestion } from './liana_cycle_runner';
import { runLianaCycleTurn } from './liana_cycle_runner';

// ─── Kill switch (settings-file convention, mirrors specialist_adapters.ts's
//     readConcordanceStrictnessFromSettings: read once per check, fail-closed-to-default, never
//     throws) ────────────────────────────────────────────────────────────────────────────────────

const LIANA_CYCLE_SETTINGS_FILE = 'liana_cycle_settings.json';

interface LianaCycleSettings {
  enabled?: boolean;
}

/** Fail-closed default: OFF. See the module header's "WHY THE KILL SWITCH DEFAULTS OFF" note. */
export function readLianaCycleEnabledFromSettings(): boolean {
  try {
    const p = join(app.getPath('userData'), LIANA_CYCLE_SETTINGS_FILE);
    if (!existsSync(p)) return false;
    const parsed = JSON.parse(readFileSync(p, 'utf-8')) as LianaCycleSettings;
    return parsed?.enabled === true;
  } catch (err) {
    console.warn('[liana_cycle_scheduler] readLianaCycleEnabledFromSettings failed (fail-closed, OFF):', err);
    return false;
  }
}

export function writeLianaCycleEnabledToSettings(enabled: boolean): void {
  try {
    const dir = app.getPath('userData');
    mkdirSync(dir, { recursive: true });
    const p = join(dir, LIANA_CYCLE_SETTINGS_FILE);
    const current: LianaCycleSettings = existsSync(p)
      ? (JSON.parse(readFileSync(p, 'utf-8')) as LianaCycleSettings)
      : {};
    current.enabled = enabled;
    writeFileSync(p, JSON.stringify(current, null, 2), 'utf-8');
  } catch (err) {
    console.error('[liana_cycle_scheduler] writeLianaCycleEnabledToSettings failed:', err);
  }
}

// ─── Held-out bank (explicitly NOT the scored 20, see module header) ────────────────────────────

const HELD_OUT_BANK_PROGRESS_CHANNEL = 'liana-cycle:progress';
export const DEFAULT_QUESTIONS_PER_TURN = 3;

/**
 * Draws a small, deterministic sample from the bundled MMLU-Pro corpus (the same 140-question
 * bundle one_click_mmlu_pro.ts's loadBundledQuestions() ships in every install and already uses
 * for ordinary benchmark runs) -- one question per category, in the bundle's own fixed category
 * order, taking the first `count` categories. Deterministic (no randomness) so a given `count`
 * always yields the same questions run to run, which matters for the method-bank consult story
 * (a repeat run over the SAME questions is what actually exercises "the Substrate stops
 * re-deriving" -- canon's own stated purpose for the consult half).
 */
async function buildHeldOutBank(count: number): Promise<HeldOutQuestion[]> {
  const { loadBundledQuestions, sampleExactPerCategory } = await import('../mesh_test/one_click_mmlu_pro');
  const all = loadBundledQuestions();
  if (all.length === 0) {
    console.warn('[liana_cycle_scheduler] bundled MMLU-Pro corpus is empty/missing, held-out bank is empty this turn');
    return [];
  }
  const onePerCategory = sampleExactPerCategory(all, 1).slice(0, Math.max(1, count));
  return onePerCategory.map((q) => ({
    id: q.question_id,
    domain: q.category,
    question: q.question,
    options: q.options,
    correctLetter: q.answer,
  }));
}

// ─── Receipt (visibility, persisted-file half -- mirrors index.ts's writeReceipt/writeMeshReceipt
//     convention: timestamped file under a dedicated userData subdirectory) ─────────────────────

export interface LianaCycleTurnReceipt {
  turnId: string;
  triggerReason: 'idle' | 'manual';
  startedAt: string;
  completedAt: string;
  elapsedMs: number;
  peerId: string;
  questionCount: number;
  summary: CycleTurnSummary;
}

function writeLianaCycleReceipt(receipt: LianaCycleTurnReceipt): string | null {
  try {
    const dir = join(app.getPath('userData'), 'liana_cycle_receipts');
    mkdirSync(dir, { recursive: true });
    const filename = `liana_cycle_turn_${receipt.turnId}.json`;
    const fullPath = join(dir, filename);
    writeFileSync(fullPath, JSON.stringify(receipt, null, 2), 'utf-8');
    console.log('[liana_cycle_scheduler] Receipt written:', fullPath);
    return fullPath;
  } catch (err) {
    console.error('[liana_cycle_scheduler] writeLianaCycleReceipt failed (non-fatal):', err);
    return null;
  }
}

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

// ─── Status (in-memory, renderer-queryable via IPC -- visibility, live half) ────────────────────

interface LianaCycleStatus {
  enabled: boolean;
  turnInFlight: boolean;
  turnsRunThisSession: number;
  lastTurnAt: string | null;
  lastTurnTriggerReason: 'idle' | 'manual' | null;
  lastTurnSummary: CycleTurnSummary | null;
  lastReceiptPath: string | null;
  lastError: string | null;
}

let turnInFlight = false;
let turnsRunThisSession = 0;
let lastTurnAtMs: number | null = null;
let lastTurnTriggerReason: 'idle' | 'manual' | null = null;
let lastTurnSummary: CycleTurnSummary | null = null;
let lastReceiptPath: string | null = null;
let lastError: string | null = null;

function getStatus(): LianaCycleStatus {
  return {
    enabled: readLianaCycleEnabledFromSettings(),
    turnInFlight,
    turnsRunThisSession,
    lastTurnAt: lastTurnAtMs !== null ? new Date(lastTurnAtMs).toISOString() : null,
    lastTurnTriggerReason,
    lastTurnSummary,
    lastReceiptPath,
    lastError,
  };
}

// ─── The turn itself: real answerer, real Coroner (inside runLianaCycleTurn), real store write,
//     real progress broadcast, real receipt ────────────────────────────────────────────────────

/**
 * Runs exactly one Cycle turn through the REAL wired path: the real compiled
 * runCanonicalPlowMcAnswer (dynamically imported, same lazy-import convention every other
 * plow_mc_answerer.ts caller in this codebase already uses for a module this large), a real
 * writeEbletFn that calls the real writeVerifiedEblet (mirrors plow_mc_answerer.ts's own
 * callCanonicalPlowMcAnswererForMeshTest helper's writeEbletFn -- "reuse this, do not re-type
 * another inline call" -- honored here by reusing runCanonicalPlowMcAnswer directly with the
 * identical real-write-through pattern, not by touching that helper or plow_mc_answerer.ts
 * itself), and the real method-bank eblets loaded off the live store via loadAllVerifiedEblets().
 *
 * Never runs when readLianaCycleEnabledFromSettings() is false (kill switch), and never runs
 * concurrently with itself or with a foreground one-click mesh-test run (both checked here,
 * fail-closed: any doubt about either condition skips the turn rather than risking a race).
 */
export async function runOneLianaCycleTurn(
  triggerReason: 'idle' | 'manual',
): Promise<{ ok: true; summary: CycleTurnSummary; receiptPath: string | null } | { ok: false; error: string }> {
  if (!readLianaCycleEnabledFromSettings()) {
    return { ok: false, error: 'liana_cycle_engine_disabled (kill switch is off)' };
  }
  if (turnInFlight) {
    return { ok: false, error: 'a_liana_cycle_turn_is_already_in_flight' };
  }
  const { isOneClickRunActive } = await import('../mesh_test/one_click_mmlu_pro');
  if (isOneClickRunActive()) {
    return { ok: false, error: 'a_foreground_mesh_test_run_is_active_skipping_to_avoid_contention' };
  }

  turnInFlight = true;
  lastError = null;
  const turnId = `${Date.now()}_${triggerReason}`;
  const startedAt = new Date().toISOString();
  const t0 = Date.now();

  const log = (msg: string) => {
    console.log(`[liana_cycle_scheduler] ${msg}`);
    broadcast(HELD_OUT_BANK_PROGRESS_CHANNEL, { type: 'log', turnId, triggerReason, message: msg });
  };

  try {
    broadcast(HELD_OUT_BANK_PROGRESS_CHANNEL, { type: 'start', turnId, triggerReason, startedAt });

    const questions = await buildHeldOutBank(DEFAULT_QUESTIONS_PER_TURN);
    if (questions.length === 0) {
      throw new Error('held-out bank was empty (bundled MMLU-Pro corpus missing or unreadable)');
    }

    const { runCanonicalPlowMcAnswer } = await import('./plow_mc_answerer');
    const { loadAllVerifiedEblets, writeVerifiedEblet } = await import('../mnem_eblet_store');

    const methodBankEblets = await loadAllVerifiedEblets();

    // Real write-through to the real live store, mirroring plow_mc_answerer.ts's own
    // callCanonicalPlowMcAnswererForMeshTest helper's writeEbletFn (same shape, same call). Cast
    // for the same intentional Record<string, unknown> vs. concrete-shape type gap as the
    // answerFn cast above -- liana_cycle_runner.ts's RunLianaCycleTurnOpts.writeEbletFn is typed
    // loosely so this module owns zero import-time coupling to VerifiedEbletEntry's full shape.
    const writeEbletFn = (async (eblet: {
      question: string; answer: string; provenance: string;
      verified: true; sha256: string; timestamp: number;
    }): Promise<void> => {
      await writeVerifiedEblet(eblet);
    }) as unknown as (params: Record<string, unknown>) => Promise<void>;

    // Conservative, local-only config: researchArmMode left false/absent on purpose for the
    // automatic (idle-triggered) path -- an unattended turn should not depend on a live,
    // signed-in browser authority session that may not exist while the machine is idle. A
    // manual turn (Founder present at the keyboard to trigger it) uses this exact same config
    // today too, for one honest, single, auditable code path rather than two divergent ones;
    // widening the manual path to opt into research-arm authorities is left as a follow-up, not
    // done here, so this ticket's diff stays scoped to wiring the caller.
    const config = {
      domain: 'liana_cycle',
      ollamaBaseUrl: 'http://127.0.0.1:11434',
      model: 'gemma4:12b',
      choiceCount: 10,
      andonEnabled: false,
    };

    const summary = await runLianaCycleTurn(
      questions,
      config,
      methodBankEblets,
      // liana_cycle_runner.ts's CanonicalPlowAnswerFn deliberately types `config` as
      // Record<string, unknown> so this module (its ONLY intended consumer today) carries zero
      // import-time dependency on plow_mc_answerer.ts's full CanonicalPlowMcConfig shape (see
      // that type's own doc comment). runCanonicalPlowMcAnswer's real signature is strictly
      // narrower (it requires the specific CanonicalPlowMcConfig fields config above already
      // supplies in full) -- this cast bridges that intentional type gap; the actual object
      // passed above is a complete, valid CanonicalPlowMcConfig, never a partial one.
      runCanonicalPlowMcAnswer as unknown as CanonicalPlowAnswerFn,
      {
        peerId: 'liana_cycle_scheduler',
        onProgress: (msg) => log(msg),
        writeEbletFn,
      },
    );

    const completedAt = new Date().toISOString();
    const elapsedMs = Date.now() - t0;

    const receipt: LianaCycleTurnReceipt = {
      turnId,
      triggerReason,
      startedAt,
      completedAt,
      elapsedMs,
      peerId: 'liana_cycle_scheduler',
      questionCount: questions.length,
      summary,
    };
    const receiptPath = writeLianaCycleReceipt(receipt);

    turnsRunThisSession += 1;
    lastTurnAtMs = Date.now();
    lastTurnTriggerReason = triggerReason;
    lastTurnSummary = summary;
    lastReceiptPath = receiptPath;

    broadcast(HELD_OUT_BANK_PROGRESS_CHANNEL, { type: 'complete', turnId, triggerReason, summary, receiptPath, elapsedMs });

    return { ok: true, summary, receiptPath };
  } catch (err) {
    const message = (err as Error).message ?? String(err);
    lastError = message;
    console.error('[liana_cycle_scheduler] Turn failed:', err);
    broadcast(HELD_OUT_BANK_PROGRESS_CHANNEL, { type: 'error', turnId, triggerReason, message });
    return { ok: false, error: message };
  } finally {
    turnInFlight = false;
  }
}

// ─── Idle-triggered automatic scheduler (primary trigger, see module header) ────────────────────

const IDLE_THRESHOLD_SECONDS = 10 * 60; // 10 minutes with no user input.
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // Poll idle time every 5 minutes -- cheap, no I/O.
const TURN_COOLDOWN_MS = 60 * 60 * 1000; // At most one automatic turn per hour, even if idle the whole hour.

let idleCheckTimer: ReturnType<typeof setInterval> | null = null;

async function idleCheckTick(): Promise<void> {
  if (!readLianaCycleEnabledFromSettings()) return; // kill switch off -- no automatic turn.
  if (turnInFlight) return;
  if (lastTurnAtMs !== null && Date.now() - lastTurnAtMs < TURN_COOLDOWN_MS) return; // cooldown.
  let idleSeconds: number;
  try {
    idleSeconds = powerMonitor.getSystemIdleTime();
  } catch (err) {
    console.warn('[liana_cycle_scheduler] getSystemIdleTime failed, skipping this tick:', err);
    return;
  }
  if (idleSeconds < IDLE_THRESHOLD_SECONDS) return; // Founder is actively using the machine.
  console.log(`[liana_cycle_scheduler] idle for ${idleSeconds}s (>= ${IDLE_THRESHOLD_SECONDS}s threshold), firing an automatic turn`);
  await runOneLianaCycleTurn('idle');
}

/** Call once, at app startup (after registerIPCHandlers()). Starts the idle-check poll AND
 *  registers this Engine's own IPC handlers. Safe to call at most once per process (idempotent
 *  guard below matches the codebase's own safeHandle duplicate-registration discipline). */
export function initLianaCycleScheduler(): void {
  if (idleCheckTimer !== null) {
    console.warn('[liana_cycle_scheduler] initLianaCycleScheduler called twice, ignoring second call');
    return;
  }
  idleCheckTimer = setInterval(() => {
    idleCheckTick().catch((err) => console.error('[liana_cycle_scheduler] idleCheckTick threw:', err));
  }, CHECK_INTERVAL_MS);

  try {
    ipcMain.handle('liana-cycle:run-now', async () => {
      return runOneLianaCycleTurn('manual');
    });
    ipcMain.handle('liana-cycle:get-status', async () => {
      return getStatus();
    });
    ipcMain.handle('liana-cycle:set-enabled', async (_event, enabled: boolean) => {
      writeLianaCycleEnabledToSettings(enabled === true);
      return { ok: true, enabled: readLianaCycleEnabledFromSettings() };
    });
  } catch (err) {
    console.error('[liana_cycle_scheduler] IPC handler registration failed:', err);
  }

  console.log(
    `[liana_cycle_scheduler] initialized. enabled=${readLianaCycleEnabledFromSettings()} ` +
    `idleThresholdSeconds=${IDLE_THRESHOLD_SECONDS} checkIntervalMs=${CHECK_INTERVAL_MS} ` +
    `cooldownMs=${TURN_COOLDOWN_MS}`,
  );
}
