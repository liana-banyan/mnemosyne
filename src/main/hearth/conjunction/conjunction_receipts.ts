// B83e — Conjunction Receipt Logger (SE-4 conformant)
// Appends to ~/.lb_hearth/conjunction_receipts.jsonl
// Feeds Sweat Scribe (effort-class) + Tears Scribe (loss-after-effort)

import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createHash } from 'crypto';
import type { ConjunctionReceiptEnvelope, AdapterReceipt, ConjunctionMode, SynthesizerMode } from './types';

const LB_HEARTH_DIR = resolve(
  process.env.APPDATA || process.env.HOME || '.',
  'AMPLIFY Computer',
  'hearth_conjunction',
);

const RECEIPTS_PATH = resolve(LB_HEARTH_DIR, 'conjunction_receipts.jsonl');
const SWEAT_PENDING_PATH = resolve(LB_HEARTH_DIR, 'hearth_conjunction_effort_signals_pending.jsonl');
const TEARS_PENDING_PATH = resolve(LB_HEARTH_DIR, 'hearth_conjunction_loss_signals_pending.jsonl');

// Lamport clock — monotonically increasing per process lifetime
let lamportClock = Date.now();
const SESSION_ID = `B83_${Date.now().toString(36)}`;

function ensureDir(): void {
  if (!existsSync(LB_HEARTH_DIR)) {
    mkdirSync(LB_HEARTH_DIR, { recursive: true });
  }
}

function bumpLamport(): number {
  lamportClock = Math.max(lamportClock + 1, Date.now());
  return lamportClock;
}

export function hashPrompt(prompt: string): string {
  return createHash('sha256').update(prompt).digest('hex');
}

export function writeConjunctionReceipt(
  dispatch_id: string,
  mode: ConjunctionMode,
  prompt: string,
  receipts: AdapterReceipt[],
  synthesizer_mode: SynthesizerMode,
  synthesized: string | null,
): void {
  ensureDir();
  const envelope: ConjunctionReceiptEnvelope = {
    ts: new Date().toISOString(),
    dispatch_id,
    mode,
    prompt_hash: hashPrompt(prompt),
    adapters: receipts.map((r) => ({
      name: String(r.name),
      result_present: r.result !== null,
      latency_ms: r.latency_ms,
      error: r.error,
      cost_usd: r.cost_usd ?? 0,
    })),
    synthesizer_mode: String(synthesizer_mode),
    synthesized_present: synthesized !== null,
    lamport_clock: bumpLamport(),
    session_id: SESSION_ID,
  };

  try {
    appendFileSync(RECEIPTS_PATH, JSON.stringify(envelope) + '\n', 'utf8');
  } catch (err) {
    console.warn('[ConjunctionReceipts] write failed:', String(err));
  }

  // Emit Sweat signals (effort-per-adapter) to pending file
  for (const r of receipts) {
    const sweat = {
      ts: envelope.ts,
      source: 'hearth_conjunction',
      adapter: r.name,
      dispatch_id,
      effort_ms: r.latency_ms,
      cost_usd: r.cost_usd ?? 0,
      tokens: r.tokens ?? null,
    };
    try {
      appendFileSync(SWEAT_PENDING_PATH, JSON.stringify(sweat) + '\n', 'utf8');
    } catch {
      /* non-fatal */
    }

    // Emit Tears signal if adapter errored (loss-after-effort per B81)
    if (r.error !== null) {
      const tears = {
        ts: envelope.ts,
        source: 'hearth_conjunction',
        adapter: r.name,
        dispatch_id,
        error: r.error,
        effort_ms: r.latency_ms,
        loss_type: 'adapter_error',
      };
      try {
        appendFileSync(TEARS_PENDING_PATH, JSON.stringify(tears) + '\n', 'utf8');
      } catch {
        /* non-fatal */
      }
    }
  }
}

export { LB_HEARTH_DIR, SESSION_ID };
