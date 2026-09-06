// B83c — Saga Subscription (renderer-side polling)
// Polls Drekaskip saga state via IPC → main process → drekaskip_bridge
// Falls back to 3s polling if SSE not available
export const DEFAULT_SAGA_STATE = {
    active_saga: null,
    wave_count: 0,
    wave_instances: [],
    last_queried: '',
    loading: false,
    error: null,
};
export class SagaSubscription {
    constructor(pollMs = 3000) {
        this.timer = null;
        this.callbacks = new Set();
        this.current = { ...DEFAULT_SAGA_STATE };
        this.pollMs = pollMs;
    }
    subscribe(cb) {
        this.callbacks.add(cb);
        // Deliver current state immediately
        cb({ ...this.current });
        // Start polling if not already
        if (!this.timer)
            this._startPolling();
        return () => {
            this.callbacks.delete(cb);
            if (this.callbacks.size === 0)
                this._stopPolling();
        };
    }
    _startPolling() {
        this._poll(); // immediate first poll
        this.timer = setInterval(() => this._poll(), this.pollMs);
    }
    _stopPolling() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    async _poll() {
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
            }
            else {
                this.current = { ...this.current, loading: false };
            }
        }
        catch (err) {
            this.current = { ...this.current, loading: false, error: String(err) };
        }
        this._emit();
    }
    _emit() {
        const snap = { ...this.current };
        for (const cb of this.callbacks)
            cb(snap);
    }
    destroy() {
        this._stopPolling();
        this.callbacks.clear();
    }
}
// Singleton subscription (shared across panels)
export const sagaSubscription = new SagaSubscription(3000);
