// B83c — Drekaskip Bridge (main-process)
// Polls Drekaskip saga state via substrate API HTTP endpoint
// R-MECHANISM-VERIFY: B61A commit 42ecdcd — Drekaskip Wave Generator LANDED
// Tool names expected: mcp__drekaskip__saga_query, mcp__drekaskip__wave_dispatch
// HTTP endpoint fallback: http://127.0.0.1:11480/drekaskip/*

const SUBSTRATE_API = 'http://127.0.0.1:11480';

export interface WaveInstance {
  id: string;
  status: 'in_flight' | 'complete' | 'error';
  started_at: string;
  completed_at?: string;
  saga: string;
}

export interface DrekaskipSagaState {
  active_saga: string | null;
  wave_count: number;
  wave_instances: WaveInstance[];
  last_queried: string;
}

let cachedState: DrekaskipSagaState = {
  active_saga: null,
  wave_count: 0,
  wave_instances: [],
  last_queried: new Date(0).toISOString(),
};

export async function querySagaState(): Promise<DrekaskipSagaState> {
  // Try Drekaskip-specific endpoint first
  try {
    const res = await fetch(`${SUBSTRATE_API}/drekaskip/saga`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json() as Partial<DrekaskipSagaState>;
      cachedState = {
        active_saga: data.active_saga ?? null,
        wave_count: data.wave_count ?? 0,
        wave_instances: data.wave_instances ?? [],
        last_queried: new Date().toISOString(),
      };
      return { ...cachedState };
    }
  } catch {
    /* endpoint not exposed — fall back to substrate query */
  }

  // Fallback: query substrate for Drekaskip state markers
  try {
    const res = await fetch(`${SUBSTRATE_API}/substrate/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'drekaskip wave saga hearth_conjunction', degraded: false }),
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json() as { hit?: boolean; record?: { text?: string; id?: string } };
      if (data.hit && data.record) {
        cachedState = {
          active_saga: 'hearth_conjunction',
          wave_count: cachedState.wave_count,
          wave_instances: cachedState.wave_instances,
          last_queried: new Date().toISOString(),
        };
      }
    }
  } catch {
    /* substrate not responding */
  }

  cachedState.last_queried = new Date().toISOString();
  return { ...cachedState };
}

// Called by conjunction router when a wave is dispatched
export function recordWaveDispatch(dispatchId: string, saga: string): void {
  const wave: WaveInstance = {
    id: dispatchId,
    status: 'in_flight',
    started_at: new Date().toISOString(),
    saga,
  };
  cachedState = {
    ...cachedState,
    active_saga: saga,
    wave_count: cachedState.wave_count + 1,
    wave_instances: [wave, ...cachedState.wave_instances].slice(0, 50),
  };
}

// Called when a conjunction dispatch completes
export function recordWaveComplete(dispatchId: string, error?: string): void {
  cachedState = {
    ...cachedState,
    wave_instances: cachedState.wave_instances.map((w) =>
      w.id === dispatchId
        ? { ...w, status: error ? 'error' : 'complete', completed_at: new Date().toISOString() }
        : w,
    ),
  };
}

export function getCachedState(): DrekaskipSagaState {
  return { ...cachedState };
}
