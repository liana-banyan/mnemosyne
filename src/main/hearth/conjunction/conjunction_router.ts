// B83a/B83e — Conjunction Router (main-process)
// Receives renderer dispatch via IPC; routes to chosen backend(s)
// "In Conjunction" — Founder-coined term for multi-backend selectable mode

import { randomUUID } from 'crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import type {
  ConjunctionMode,
  ConjunctionPanelState,
  ConjunctionResult,
  AdapterReceipt,
  SynthesizerMode,
} from './types';
import { writeConjunctionReceipt, LB_HEARTH_DIR } from './conjunction_receipts';
import { synthesize } from './fan_in_synthesizer';
import { cpuOnlyAvailable, cpuOnlyDispatch } from './backend_adapters/cpu_only_adapter';
import { ollamaAvailable, ollamaDispatch } from './backend_adapters/ollama_adapter';
import { knightCursorAvailable, knightCursorDispatch } from './backend_adapters/knight_cursor_adapter';
import { opusClaudeAvailable, opusClaudeDispatch } from './backend_adapters/opus_claude_adapter';

const STATE_PATH = resolve(LB_HEARTH_DIR, 'conjunction_state.json');

const DEFAULT_STATE: ConjunctionPanelState = {
  selected: 'cpu_only',
  per_request_override: null,
  last_dispatch: null,
  in_flight: null,
};

// ─── State persistence ────────────────────────────────────────────────────────

function loadState(): ConjunctionPanelState {
  try {
    if (existsSync(STATE_PATH)) {
      const raw = readFileSync(STATE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as Partial<ConjunctionPanelState>;
      return {
        ...DEFAULT_STATE,
        ...parsed,
        in_flight: null, // never persist in-flight across restart
      };
    }
  } catch {
    /* corrupt state — fall back to default */
  }
  return { ...DEFAULT_STATE };
}

function saveState(state: ConjunctionPanelState): void {
  try {
    if (!existsSync(LB_HEARTH_DIR)) mkdirSync(LB_HEARTH_DIR, { recursive: true });
    writeFileSync(STATE_PATH, JSON.stringify({ ...state, in_flight: null }, null, 2), 'utf8');
  } catch {
    /* non-fatal */
  }
}

// ─── ConjunctionRouter class ─────────────────────────────────────────────────

export class ConjunctionRouter {
  private state: ConjunctionPanelState;

  constructor() {
    this.state = loadState();
  }

  getState(): ConjunctionPanelState {
    return { ...this.state };
  }

  selectMode(mode: ConjunctionMode): { ok: boolean; previous: ConjunctionMode } {
    const previous = this.state.selected;
    this.state = { ...this.state, selected: mode, per_request_override: null };
    saveState(this.state);
    return { ok: true, previous };
  }

  async getAvailability(): Promise<Record<ConjunctionMode, boolean>> {
    const [cpu, ollama, knight, opus] = await Promise.all([
      cpuOnlyAvailable(),
      ollamaAvailable(),
      knightCursorAvailable(),
      opusClaudeAvailable(),
    ]);
    return {
      cpu_only: cpu.ok,
      ollama: ollama.ok,
      knight_cursor: knight.ok,
      opus_claude: opus.ok,
      all_in_conjunction: true, // always shown; individual backends may degrade
    };
  }

  async dispatch(
    prompt: string,
    mode_override?: ConjunctionMode,
    synthesizer_mode: SynthesizerMode = 'composite_with_provenance',
  ): Promise<ConjunctionResult> {
    const effective_mode: ConjunctionMode = mode_override ?? this.state.per_request_override ?? this.state.selected;
    const dispatch_id = randomUUID();
    const started_at = new Date().toISOString();
    const overall_start = Date.now();

    // Clear per-request override
    if (this.state.per_request_override !== null && !mode_override) {
      this.state = { ...this.state, per_request_override: null };
    }

    // Set in-flight
    this.state = { ...this.state, in_flight: { mode: effective_mode, started_at } };

    let receipts: AdapterReceipt[] = [];
    let routed_to: ConjunctionMode[] = [];

    try {
      if (effective_mode === 'all_in_conjunction') {
        // Parallel fan-out to all 4 backends
        routed_to = ['cpu_only', 'ollama', 'knight_cursor', 'opus_claude'];
        receipts = await Promise.all([
          cpuOnlyDispatch(prompt, { timeout_ms: 5_000 }),
          ollamaDispatch(prompt, { timeout_ms: 30_000 }),
          knightCursorDispatch(prompt, { timeout_ms: 90_000, dispatch_id }),
          opusClaudeDispatch(prompt, { timeout_ms: 30_000 }),
        ]);
      } else {
        routed_to = [effective_mode];
        receipts = [await this._dispatchSingle(prompt, effective_mode, dispatch_id)];
      }
    } catch (err) {
      receipts = [{
        name: effective_mode,
        result: null,
        error: `Dispatch error: ${String(err)}`,
        latency_ms: Date.now() - overall_start,
      }];
    }

    const fan_in = synthesize(receipts, effective_mode === 'all_in_conjunction' ? synthesizer_mode : 'single');
    const total_latency_ms = Date.now() - overall_start;
    const success = receipts.some((r) => r.result !== null);

    // Persist receipt
    writeConjunctionReceipt(dispatch_id, effective_mode, prompt, receipts, fan_in.mode, fan_in.synthesized);

    // Update state
    this.state = {
      ...this.state,
      in_flight: null,
      last_dispatch: { mode: effective_mode, ts: started_at, latency_ms: total_latency_ms, success },
    };
    saveState(this.state);

    return {
      dispatch_id,
      routed_to,
      receipts,
      synthesized: fan_in.synthesized,
      synthesizer_mode: fan_in.mode,
      total_latency_ms,
    };
  }

  private async _dispatchSingle(
    prompt: string,
    mode: ConjunctionMode,
    dispatch_id: string,
  ): Promise<AdapterReceipt> {
    switch (mode) {
      case 'cpu_only':
        return cpuOnlyDispatch(prompt, { timeout_ms: 5_000 });
      case 'ollama':
        return ollamaDispatch(prompt, { timeout_ms: 30_000 });
      case 'knight_cursor':
        return knightCursorDispatch(prompt, { timeout_ms: 90_000, dispatch_id });
      case 'opus_claude':
        return opusClaudeDispatch(prompt, { timeout_ms: 30_000 });
      default:
        return {
          name: mode,
          result: null,
          error: `Unknown mode: ${mode}`,
          latency_ms: 0,
        };
    }
  }
}

// Singleton — shared across IPC handlers
export const conjunctionRouter = new ConjunctionRouter();
