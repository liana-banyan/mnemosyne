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

interface HeartbeatWorkerData {
  supabaseUrl: string;
  supabaseAnonKey: string;
  peerId: string;
  version: string;
  /** Relay base URL for wan-relay-publish */
  relayBase: string;
  relayBaseFallback: string;
  intervalMs: number;
}

const config = workerData as HeartbeatWorkerData;
const { supabaseUrl, supabaseAnonKey, peerId, version, relayBase, relayBaseFallback, intervalMs } = config;

let stopped = false;

async function sendHeartbeat(): Promise<void> {
  if (stopped) return;

  const body = JSON.stringify({
    peer_id: peerId,
    version,
    last_seen_at: new Date().toISOString(),
    // Minimal presence payload — full identity fields already published by parent
    relay_poller_poll_count: null,
  });

  const tryPublish = async (base: string): Promise<boolean> => {
    try {
      const res = await fetch(`${base}/wan-relay-publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': supabaseAnonKey, 'Authorization': `Bearer ${supabaseAnonKey}` },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const ok = await tryPublish(relayBase) || await tryPublish(relayBaseFallback);
  if (!ok) {
    // Also try direct Supabase REST upsert as secondary path
    try {
      await fetch(`${supabaseUrl}/rest/v1/peer_presence?peer_id=eq.${encodeURIComponent(peerId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ last_seen_at: new Date().toISOString() }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      /* non-fatal — heartbeat is best-effort */
    }
  }
}

// Graceful shutdown on parent message
parentPort?.on('message', (msg: { type: string }) => {
  if (msg?.type === 'stop') {
    stopped = true;
    clearInterval(timer);
    process.exit(0);
  }
});

// Send first heartbeat immediately, then on interval
sendHeartbeat().catch(() => { /* non-fatal */ });
const timer = setInterval(() => {
  sendHeartbeat().catch(() => { /* non-fatal */ });
}, intervalMs);

// Keep process alive
