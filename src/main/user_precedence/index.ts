// user_precedence/index.ts -- D-BP223-BM0-X029-018-USER-HAS-PRECEDENCE
//
// "You come first" (default ON). The one place every background model-work path asks
// "may I start now?". Callers wired in this dispatch:
//   - relay_answer/index.ts (answers the forked worker's 'precedence_query' over IPC)
//   - relay_answer/worker.ts (WAN mesh route answering: leaves routes pending while yielding)
//   - federation/peer_server.ts handlePlowDomainRequestBody (LAN plow work for a peer: 503 + retry)
//   - index.ts MIC broadcast 'fleet_warmup' (remote-triggered model load: acks 'deferred')
//   - homework/homework_runner.ts (Gate 5)
// Light file serving (peer_server GET routes, hollerith library share) is deliberately NOT gated.
//
// Settings live in the SAME ai_dispatch_settings.json every other toggle uses (ai_dispatch_ipc.ts
// owns writes). `you_come_first` undefined = ON. Only an explicit false turns it off.

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  decideYield,
  type ForegroundState,
  type VramReading,
  type YieldDecision,
  type YieldSettings,
  DEFAULT_ACTIVE_WITHIN_SECONDS,
} from './yield_decision';

export * from './yield_decision';

export interface PrecedenceProbes {
  readSettings(): YieldSettings;
  readIdleSeconds(): number | null;
  readForegroundState(): Promise<ForegroundState>;
  modelNeedMiB(model: string): number | null;
  isModelResident(model: string, ollamaUrl: string): Promise<boolean>;
  readVramFreeMiB(): Promise<VramReading>;
  now(): number;
}

export interface PrecedenceCheckOptions {
  /** Model the pending work would run; null/undefined for model-free work. */
  model?: string | null;
  ollamaUrl?: string;
}

export interface PrecedenceMonitor {
  check(opts?: PrecedenceCheckOptions): Promise<YieldDecision>;
  last(): YieldDecision | null;
  /** How many probe spawns (foreground + VRAM) this monitor has made; tests use it to prove the
   *  short-circuit keeps probing off an active desktop. */
  probeCount(): number;
}

const CACHE_MS = 15_000;

export function createPrecedenceMonitor(probes: PrecedenceProbes, log: (m: string) => void = () => {}): PrecedenceMonitor {
  let cached: { key: string; at: number; decision: YieldDecision } | null = null;
  let lastDecision: YieldDecision | null = null;
  let spawns = 0;

  async function compute(opts: PrecedenceCheckOptions): Promise<YieldDecision> {
    const settings = probes.readSettings();
    const on = settings.youComeFirst !== false;
    const activeWithin = settings.activeWithinSeconds && settings.activeWithinSeconds > 0
      ? settings.activeWithinSeconds : DEFAULT_ACTIVE_WITHIN_SECONDS;
    const idleSeconds = probes.readIdleSeconds();
    const model = opts.model ?? null;

    // SHORT-CIRCUIT: recent input already decides both the yield (when ON) and the label. Spawning
    // probes against a desktop someone is actively using would itself be the load we promise to avoid.
    const activeByInput = idleSeconds === null || idleSeconds < activeWithin;
    let foreground: ForegroundState = 'unknown';
    if (!activeByInput) {
      spawns++;
      foreground = await probes.readForegroundState();
    }

    let modelResident = false;
    let modelNeed: number | null = null;
    let vram: VramReading | null = null;
    const alreadyYielding = on && (activeByInput || ['fullscreen', 'd3d_fullscreen', 'presentation', 'immersive_app'].includes(foreground));
    if (on && model && !alreadyYielding) {
      modelNeed = probes.modelNeedMiB(model);
      modelResident = await probes.isModelResident(model, opts.ollamaUrl ?? 'http://127.0.0.1:11434');
      if (!modelResident && modelNeed !== null) {
        spawns++;
        vram = await probes.readVramFreeMiB();
      }
    }

    return decideYield(
      { idleSeconds, foreground, model, modelNeedMiB: modelNeed, modelResident, vram },
      settings,
    );
  }

  return {
    async check(opts: PrecedenceCheckOptions = {}): Promise<YieldDecision> {
      const key = `${opts.model ?? ''}|${opts.ollamaUrl ?? ''}`;
      const t = probes.now();
      // Only cache a YIELD. A "go" is re-checked every time so work never starts on stale permission.
      if (cached && cached.key === key && t - cached.at < CACHE_MS && cached.decision.yield) {
        return cached.decision;
      }
      const decision = await compute(opts);
      cached = { key, at: t, decision };
      if (!lastDecision || lastDecision.yield !== decision.yield) {
        log(decision.yield ? `[you-come-first] PAUSED: ${decision.explanation}` : `[you-come-first] RESUMED: ${decision.explanation}`);
      }
      lastDecision = decision;
      return decision;
    },
    last: () => lastDecision,
    probeCount: () => spawns,
  };
}

// ─── Default (real) instance ──────────────────────────────────────────────────

function readYouComeFirstSettings(): YieldSettings {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require('electron') as typeof import('electron');
    const p = join(app.getPath('userData'), 'ai_dispatch_settings.json');
    if (!existsSync(p)) return {};
    const j = JSON.parse(readFileSync(p, 'utf-8')) as { you_come_first?: boolean; you_come_first_active_seconds?: number };
    return { youComeFirst: j.you_come_first, activeWithinSeconds: j.you_come_first_active_seconds };
  } catch {
    return {}; // unreadable settings -> the default, which is ON
  }
}

let _default: PrecedenceMonitor | null = null;

export function getPrecedenceMonitor(): PrecedenceMonitor {
  if (_default) return _default;
  // Lazy requires so importing this module (e.g. from a test) never pulls Electron or spawns anything.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const p = require('./probes') as typeof import('./probes');
  let totalGbCache: number | null | undefined;
  _default = createPrecedenceMonitor({
    readSettings: readYouComeFirstSettings,
    readIdleSeconds: p.readIdleSeconds,
    readForegroundState: () => p.readForegroundState(),
    modelNeedMiB: (model) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { requiredVramGb } = require('../hardware/ram_detector') as typeof import('../hardware/ram_detector');
        const gb = requiredVramGb(model);
        return gb === null ? null : Math.round(gb * 1024);
      } catch { return null; }
    },
    isModelResident: (model, url) => p.isModelResident(model, url),
    readVramFreeMiB: async () => {
      if (totalGbCache === undefined) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { detectVramGbDetailed } = require('../hardware/ram_detector') as typeof import('../hardware/ram_detector');
          totalGbCache = detectVramGbDetailed().vramGb;
        } catch { totalGbCache = null; }
      }
      return p.readVramFreeMiB(totalGbCache ?? null);
    },
    now: () => Date.now(),
  }, (m) => console.log(m));
  return _default;
}

/** Convenience for callers: resolves the decision, never throws. On an internal failure it
 *  returns a NON-yield with desktopInUse true (work is not blocked forever by a bug, and the
 *  result is still labeled honestly). */
export async function checkUserPrecedence(opts: PrecedenceCheckOptions = {}): Promise<YieldDecision> {
  try {
    return await getPrecedenceMonitor().check(opts);
  } catch (e) {
    return {
      yield: false,
      reasons: [],
      desktopInUse: true,
      youComeFirst: true,
      explanation: `precedence check failed (${(e as Error).message}); proceeding, result labeled desktop in use`,
    };
  }
}
