// B83c — Saga Subscription (renderer-side polling)
// Polls Drekaskip saga state via IPC → main process → drekaskip_bridge
// Falls back to 3s polling if SSE not available

export interface WaveInstance {
  id: string;
  status: 'in_flight' | 'complete' | 'error';
  started_at: string;
  completed_at?: string;
  saga: string;
}

export interface SagaState {
  active_saga: string | null;
  wave_count: number;
  wave_instances: WaveInstance[];
  last_queried: string;
  loading: boolean;
  error: string | null;
}

export const DEFAULT_SAGA_STATE: SagaState = {
  active_saga: null,
  wave_count: 0,
  wave_instances: [],
  last_queried: '',
  loading: false,
  error: null,
};

type SagaCallback = (state: SagaState) => void;

export class SagaSubscription {
  private timer: ReturnType<typeof setInterval> | null = null;
  private callbacks: Set<SagaCallback> = new Set();
  private current: SagaState = { ...DEFAULT_SAGA_STATE };
  private readonly pollMs: number;

  constructor(pollMs = 3000) {
    this.pollMs = pollMs;
  }

  subscribe(cb: SagaCallback): () => void {
    this.callbacks.add(cb);
    // Deliver current state immediately
    cb({ ...this.current });
    // Start polling if not already
    if (!this.timer) this._startPolling();
    return () => {
      this.callbacks.delete(cb);
      if (this.callbacks.size === 0) this._stopPolling();
    };
  }

  private _startPolling(): void {
    this._poll(); // immediate first poll
    this.timer = setInterval(() => this._poll(), this.pollMs);
  }

  private _stopPolling(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async _poll(): Promise<void> {
    this.current = { ...this.current, loading: true };
    this._emit();

    try {
      const state = await window.amplify.drekaskipQuery?.() ?? null;
      if (state) {
        this.current = {
          active_saga: state.active_saga,
          wave_count: state.wave_count,
          wave_instances: state.wave_instances ?? [],
          last_queried: new Date().toISOString(),
          loading: false,
          error: null,
        };
      } else {
        this.current = { ...this.current, loading: false };
      }
    } catch (err) {
      this.current = { ...this.current, loading: false, error: String(err) };
    }

    this._emit();
  }

  private _emit(): void {
    const snap = { ...this.current };
    for (const cb of this.callbacks) cb(snap);
  }

  destroy(): void {
    this._stopPolling();
    this.callbacks.clear();
  }
}

// Singleton subscription (shared across panels)
export const sagaSubscription = new SagaSubscription(3000);
