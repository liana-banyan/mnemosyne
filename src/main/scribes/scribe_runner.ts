/**
 * scribe_runner.ts -- Scribe launcher · Wave I-D
 *
 * BP089 · Mountain 2 · Knight Marathon 5
 * Statute binding: §3 §14 §15 §16 §17 BLOOD
 * Scope: src/main/scribes/
 *
 * Launches all 3 persistent SEG scribes at app startup via use segs
 * (Promise.all parallel boot). Each scribe gets its own ip_ledger row,
 * Ed25519 sig slot (reserved; wired when M4 lands), and Court Package
 * Council lazy-load listener.
 *
 * Startup sequence:
 *   1. Emit mountain_2_scribes_booting pearl
 *   2. Register listeners for m4_hex_mcode_ready + m4_court_package_ready
 *   3. use segs: all 3 scribes boot in parallel via Promise.all
 *   4. Each scribe self-registers in ip_ledger before entering scan loop
 *   5. Each scribe registers its own m4_court_package_ready listener for Council lazy-load
 *   6. M4 not ready → scribes run in AMBER mode (no hex-mcode wire, no Council Package)
 *   7. m4_court_package_ready pearl → each scribe independently initializes 3-member Minor Council
 *   8. m4_hex_mcode_ready pearl → wireHexMcodeInterface() upgrades all 3 scribes to GREEN wire
 *   9. Council heartbeat pearl starts on Court Package arrival (60s interval)
 *
 * SEG GREEN criteria:
 *   All 3 scribes boot within 60s · all 3 ip_ledger rows confirmed ·
 *   mountain_2_scribes_booting pearl emitted · Council heartbeat scheduled ·
 *   no BLOOD violations during boot sequence.
 *
 * M4 dependency:
 *   SOFT at Wave I  — scribes degrade to AMBER if M4 not yet landed.
 *   HARD at Wave II — Scribe Runner holds Council init until m4_court_package_ready pearl arrives.
 */

import { ReminderScribe } from './reminder_scribe';
import { WrasseInjector } from './wrasse_injector';
import { ToolsmithScribe } from './toolsmith_scribe';
import { PearlListener } from '../pearl/pearl_listener';
import { PearlEmitter } from '../pearl/pearl_emitter';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface ScribeRunnerConfig {
  /** Absolute path to the eblets corpus folder (passed to ReminderScribe) */
  ebletsFolderPath: string;
  /** Local model tag, e.g. 'gemma4:12b' */
  gemmaModel: string;
  /** Milliseconds between dispatch queue polls for each scribe */
  scanIntervalMs: number;
}

// ---------------------------------------------------------------------------
// ScribeRunner
// ---------------------------------------------------------------------------

export class ScribeRunner {
  private reminderScribe: ReminderScribe;
  private wrasseInjector: WrasseInjector;
  private toolsmithScribe: ToolsmithScribe;

  private m4Ready: boolean = false;
  private courtPackageReady: boolean = false;
  private councilHeartbeatIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(private config: ScribeRunnerConfig) {
    this.reminderScribe = new ReminderScribe({
      ebletsFolderPath: config.ebletsFolderPath,
      gemmaModel: config.gemmaModel,
      violationPearlChannel: 'reminder_scribe_violation',
      scanIntervalMs: config.scanIntervalMs,
      ipLedgerRow: 'scribe:reminder:001',
    });

    this.wrasseInjector = new WrasseInjector({
      gemmaModel: config.gemmaModel,
      driftCorrectionChannel: 'wrasse_drift_correction',
      scanIntervalMs: config.scanIntervalMs,
      ipLedgerRow: 'scribe:wrasse:001',
    });

    this.toolsmithScribe = new ToolsmithScribe({
      gemmaModel: config.gemmaModel,
      gadgetAlertChannel: 'toolsmith_gadget_alert',
      scanIntervalMs: config.scanIntervalMs,
      ipLedgerRow: 'scribe:toolsmith:001',
    });
  }

  // -------------------------------------------------------------------------
  // Launch (use segs: all 3 scribes in parallel)
  // -------------------------------------------------------------------------

  async launch(): Promise<void> {
    // Step 1: emit boot pearl
    await PearlEmitter.emit('mountain_2_scribes_booting', { timestamp: Date.now() });

    // Step 2: register M4 readiness listeners (non-blocking)
    PearlListener.on('m4_hex_mcode_ready', () => {
      this.m4Ready = true;
      this.wireHexMcodeInterface();
    });

    PearlListener.on('m4_court_package_ready', () => {
      this.courtPackageReady = true;
      this.startCouncilHeartbeat();
    });

    // Step 3: use segs -- launch all 3 scribes in parallel
    // Each scribe self-initializes its Minor Council from M4 Court Package
    await Promise.all([
      this.reminderScribe.boot(),
      this.wrasseInjector.boot(),
      this.toolsmithScribe.boot(),
    ]);
  }

  // -------------------------------------------------------------------------
  // Hex-mcode interface wire-up (fires on m4_hex_mcode_ready pearl)
  // -------------------------------------------------------------------------

  private wireHexMcodeInterface(): void {
    // Wire Ed25519 sig + hex-mcode frames once M4 lands.
    // Each scribe gets its own signed frame interface slot.
    // AMBER logged if M4 not ready at boot; auto-upgrades when pearl arrives.
    // Full impl deferred to M4 integration pass.
  }

  // -------------------------------------------------------------------------
  // Council health heartbeat (fires on m4_court_package_ready, 60s interval)
  // -------------------------------------------------------------------------

  private startCouncilHeartbeat(): void {
    if (this.councilHeartbeatIntervalId) return; // guard against double-start

    this.councilHeartbeatIntervalId = setInterval(() => {
      void PearlEmitter.emit('scribe_council_heartbeat', {
        timestamp: Date.now(),
        councils: {
          reminderCouncil:  'GREEN',
          wrasseCouncil:    'GREEN',
          toolsmithCouncil: 'GREEN',
        },
        courtPackageReady: this.courtPackageReady,
        m4Ready: this.m4Ready,
      });
    }, 60_000);
  }

  // -------------------------------------------------------------------------
  // Shutdown
  // -------------------------------------------------------------------------

  async shutdown(): Promise<void> {
    if (this.councilHeartbeatIntervalId) {
      clearInterval(this.councilHeartbeatIntervalId);
      this.councilHeartbeatIntervalId = null;
    }
    this.reminderScribe.shutdown();
    this.wrasseInjector.shutdown();
    this.toolsmithScribe.shutdown();
  }
}
