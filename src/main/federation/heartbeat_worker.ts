/**
 * heartbeat_worker.ts — D6b · BP105 · truly-independent peer presence heartbeat
 *
 * Runs in a worker_threads Worker with a completely separate V8 isolate and event
 * loop from the relay-poll main thread. When the relay-poll thread hangs awaiting
 * ollama, this worker continues to send peer_presence upserts autonomously.
 *
 * Anti-pattern eliminated: "heartbeat looks fine but peer can't answer anything"
 * (empirically observed BP105 · M2 + M3 had fresh last_seen_at while poll_count froze).
 *
 * Wire: the parent spawns this Worker from peer_server.ts, passing config via workerData.
 * parentPort message { type: 'stop' } triggers graceful shutdown.
 */

import { workerData, parentPort } from 'worker_threads';

export interface HeartbeatWorkerData {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** D-BP223-X043-010-RB: presence owner secret, in memory only, never logged. */
  ownerSecret: string;
  peerId: string;
  version: string;
  /** Relay base URL for wan-relay-publish */
  relayBase: string;
  relayBaseFallback: string;
  intervalMs: number;
}

const config = (workerData ?? {}) as HeartbeatWorkerData;
const { intervalMs } = config;

let stopped = false;

/**
 * D-BP223-X043-010-RB. One presence_put_own call (Phase A RPC) proven with the owner secret the
 * parent handed over in workerData (a worker thread cannot reach safeStorage). The server stamps
 * last_seen_at = now() on every accepted call, which is all this heartbeat ever carried.
 *
 * The old body posted a bare {peer_id, version, last_seen_at} to wan-relay-publish (never a valid
 * PeanutRoll, so the function refused it with 400) and then PATCHed peer_presence directly with
 * the anon key; that direct PATCH is refused once Phase B is applied. The secret goes only into
 * the JSON body of this one POST; it is never logged.
 */
export async function sendHeartbeatOnce(
  cfg: Pick<HeartbeatWorkerData, 'supabaseUrl' | 'supabaseAnonKey' | 'peerId' | 'version' | 'ownerSecret'>,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!cfg.ownerSecret) return false;
  try {
    const res = await fetchImpl(`${cfg.supabaseUrl}/rest/v1/rpc/presence_put_own`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': cfg.supabaseAnonKey,
        'Authorization': `Bearer ${cfg.supabaseAnonKey}`,
      },
      body: JSON.stringify({ p_peer_id: cfg.peerId, p_secret: cfg.ownerSecret, p_fields: { version: cfg.version } }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false; /* non-fatal: heartbeat is best-effort */
  }
}

async function sendHeartbeat(): Promise<void> {
  if (stopped) return;
  await sendHeartbeatOnce(config);
}

// Graceful shutdown on parent message
parentPort?.on('message', (msg: { type: string }) => {
  if (msg?.type === 'stop') {
    stopped = true;
    if (timer) clearInterval(timer);
    process.exit(0);
  }
});

// Send first heartbeat immediately, then on interval. Only inside a real worker thread
// (parentPort set): importing this module from a test must not start timers.
let timer: ReturnType<typeof setInterval> | undefined;
if (parentPort) {
  sendHeartbeat().catch(() => { /* non-fatal */ });
  timer = setInterval(() => {
    sendHeartbeat().catch(() => { /* non-fatal */ });
  }, intervalMs);
}

// Keep process alive
