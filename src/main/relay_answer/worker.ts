// relay_answer/worker.ts — BP099→BP100 K20 supervised child process worker
// Spawned by relay_answer/index.ts supervisor via child_process.fork().
// Receives init config via IPC, runs the poll loop, sends status messages back.
// Module 2: Ollama health-check before every inference call.
// canon: canon_fix_as_we_go_build_for_the_long_haul_always_convenient_immutables_bp053
// canon: canon_designed_to_be_copied_autonomous_propagation_doctrine_bp051

// floor-model fallback (no shared import — worker is a standalone Node.js child)
// BP101 K21 + Founder directive: gemma4:12b LOCKED across M0/M2/M3 (Founder verbatim BP101: "Here is the only configuration I want you to work on: M0 M2 and M3 working on gemma 4:12b. That's it.")
// Doctrine canon: BP089 "EAT OUR OWN COOKING · gemma4:12b first" + BP097 "cb4ef450 gemma swap + Tier2 gemma".
// Model held constant; THIS yoke fixes the unbounded-fetch + supervisor bugs instead of swapping the model.
const FLOOR_MODEL = 'gemma4:12b';
const PHANTOM_PREFIX = '49f3e597';

// BP101 K21: fetch timeouts. All three fetches (fetchPendingRoutes, runOllama, submitReplyViaEdgeFunction)
// were unbounded in K20 v0.8.13 → Ollama queue stalls (incl. CPU-mode offload when VRAM tight on gemma4:12b)
// hung tick() forever → inflight=true latched permanent → no replies written. Empirically reproduced T29 canary 0/1.
const OLLAMA_FETCH_TIMEOUT_MS = 180_000;   // 3 min for inference — accommodates CPU-mode offload on tight-VRAM machines
const SUPABASE_FETCH_TIMEOUT_MS = 10_000;   // 10s for DB writes (PostgREST + edge fn)

export interface WorkerConfig {
  peerId: string;
  supabaseUrl: string;
  anonKey: string;
  model?: string;
  pollIntervalMs?: number;
  ollamaUrl?: string;
}

interface RelayRoute {
  id: string;
  payload_json: { prompt?: string; question?: string } | null;
  target_peer_id: string;
}

interface OllamaGenerateResponse {
  response?: string;
}

const ts = () => new Date().toISOString().slice(11, 23);
const log = (msg: string) => console.log(`[relay_worker] [${ts()}] ${msg}`);

// ─── Telemetry helper ─────────────────────────────────────────────────────────

function writeTelemetryEvent(
  supabaseUrl: string,
  anonKey: string,
  peerId: string,
  eventType: string,
  eventData: object,
): void {
  fetch(`${supabaseUrl}/functions/v1/record-poller-health-event`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ peer_id: peerId, event_type: eventType, event_data: eventData }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => { /* non-fatal telemetry write */ });
}

// ─── Ollama health-check (Module 2) ───────────────────────────────────────────

// BP099→BP100 K20 Module 2: Ollama health-check before every inference call.
// Ollama-down mode: skip route polling, retry health-check with 10s×2^N backoff (max 60s).
// Ollama-up: reset counter, resume immediately, write telemetry.
// Fixes M2/M0 silent-Ollama failure mode observed BP100 T27/T28/T28B.
// canon: canon_fix_as_we_go_build_for_the_long_haul_always_convenient_immutables_bp053

let ollamaDownCount = 0;
let ollamaDown = false;
let ollamaDownSince: number | null = null;

async function checkOllamaHealth(ollamaUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${ollamaUrl}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Heartbeat ────────────────────────────────────────────────────────────────

function writePollerHeartbeat(
  supabaseUrl: string,
  anonKey: string,
  peerId: string,
  pollCount: number,
): void {
  const heartbeatAt = new Date().toISOString();
  // BP102 fix: tell the supervisor the worker is alive BEFORE attempting the network write.
  // Liveness (process alive) must not depend on Supabase reachability.
  process.send?.({ type: 'heartbeat', heartbeatAt, pollCount });
  fetch(`${supabaseUrl}/rest/v1/peer_presence?peer_id=eq.${encodeURIComponent(peerId)}`, {
    method: 'PATCH',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      relay_poller_heartbeat_at: heartbeatAt,
      relay_poller_poll_count: pollCount,
    }),
    signal: AbortSignal.timeout(5000),
  }).catch((e: unknown) => {
    process.stderr.write(`[relay_worker] heartbeat PATCH failed (DB write only — liveness already reported): ${(e as Error).message}\n`);
  });
}

// ─── Route fetch + process ────────────────────────────────────────────────────

async function fetchPendingRoutes(
  supabaseUrl: string,
  anonKey: string,
  peerId: string,
): Promise<RelayRoute[]> {
  const url =
    `${supabaseUrl}/rest/v1/relay_routes` +
    `?status=eq.pending&target_peer_id=eq.${encodeURIComponent(peerId)}` +
    `&select=id,payload_json,target_peer_id&order=created_at.asc&limit=5`;
  try {
    const res = await fetch(url, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      signal: AbortSignal.timeout(SUPABASE_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      log(`fetch routes FAILED: HTTP ${res.status}`);
      return [];
    }
    return ((await res.json()) as RelayRoute[]) ?? [];
  } catch (e: unknown) {
    log(`fetch routes network error: ${(e as Error).message}`);
    return [];
  }
}

async function runOllama(
  ollamaUrl: string,
  model: string,
  prompt: string,
): Promise<{ answer: string; elapsed: number }> {
  const t0 = Date.now();
  const res = await fetch(`${ollamaUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
    signal: AbortSignal.timeout(OLLAMA_FETCH_TIMEOUT_MS),
  });
  const elapsed = Date.now() - t0;
  if (!res.ok) {
    throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as OllamaGenerateResponse;
  return { answer: data?.response ?? '', elapsed };
}

async function submitReplyViaEdgeFunction(
  supabaseUrl: string,
  anonKey: string,
  routeId: string,
  peerId: string,
  answer: string,
  processingMs: number,
): Promise<boolean> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/submit-relay-route-reply`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ route_id: routeId, peer_id: peerId, answer_json: { answer }, processing_ms: processingMs }),
      signal: AbortSignal.timeout(SUPABASE_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      log(`submit reply FAILED route=${routeId.slice(0, 8)}: HTTP ${res.status}`);
      return false;
    }
    return true;
  } catch (e: unknown) {
    log(`submit reply network error route=${routeId.slice(0, 8)}: ${(e as Error).message}`);
    return false;
  }
}

// ─── Main tick ────────────────────────────────────────────────────────────────

async function tick(config: Required<WorkerConfig>, pollCount: number): Promise<void> {
  // Module 2: health-check before every Ollama call
  const ollamaHealthy = await checkOllamaHealth(config.ollamaUrl);

  if (!ollamaHealthy) {
    if (!ollamaDown) {
      ollamaDown = true;
      ollamaDownSince = Date.now();
      const eventData = { timestamp: new Date().toISOString(), error: 'ECONNREFUSED or timeout' };
      log(`Ollama is DOWN — entering down mode (count=${ollamaDownCount})`);
      process.send?.({ type: 'ollama_down', ...eventData });
      writeTelemetryEvent(config.supabaseUrl, config.anonKey, config.peerId, 'ollama_down', eventData);
    }
    ollamaDownCount++;
    // BP102 fix: emit local liveness ping even while Ollama is down so supervisor's
    // 120s liveness watchdog does not SIGKILL a worker that is correctly backing off.
    process.send?.({ type: 'heartbeat', heartbeatAt: new Date().toISOString(), pollCount, ollamaDown: true });
    const backoffMs = Math.min(10000 * Math.pow(2, ollamaDownCount - 1), 60000);
    log(`Ollama down — skip tick, retry in ${backoffMs}ms (count=${ollamaDownCount})`);
    await new Promise(r => setTimeout(r, backoffMs));
    return;
  }

  if (ollamaDown) {
    const downtimeSeconds = ollamaDownSince ? Math.round((Date.now() - ollamaDownSince) / 1000) : 0;
    ollamaDown = false;
    ollamaDownCount = 0;
    ollamaDownSince = null;
    const eventData = { timestamp: new Date().toISOString(), downtime_seconds: downtimeSeconds };
    log(`Ollama is UP — resuming (downtime=${downtimeSeconds}s)`);
    process.send?.({ type: 'ollama_up', ...eventData });
    writeTelemetryEvent(config.supabaseUrl, config.anonKey, config.peerId, 'ollama_up', eventData);
  }

  // Fetch and process routes
  const routes = await fetchPendingRoutes(config.supabaseUrl, config.anonKey, config.peerId);
  writePollerHeartbeat(config.supabaseUrl, config.anonKey, config.peerId, pollCount);

  if (routes.length === 0) {
    if (pollCount % 20 === 0) {
      log(`poll #${pollCount}: idle (no pending routes for peer ${config.peerId.slice(0, 8)})`);
    }
    return;
  }

  log(`poll #${pollCount}: ${routes.length} pending route(s) for peer ${config.peerId.slice(0, 8)}`);
  for (const route of routes) {
    const prompt =
      route.payload_json?.prompt ?? route.payload_json?.question ?? JSON.stringify(route.payload_json);
    try {
      const { answer, elapsed } = await runOllama(config.ollamaUrl, config.model, prompt);
      const submitted = await submitReplyViaEdgeFunction(
        config.supabaseUrl, config.anonKey, route.id, config.peerId, answer, elapsed,
      );
      if (submitted) {
        const processedAt = new Date().toISOString();
        log(`route ${route.id.slice(0, 8)} answered in ${elapsed}ms`);
        process.send?.({ type: 'route_processed', routeId: route.id, processedAt });
      }
    } catch (e: unknown) {
      log(`route ${route.id.slice(0, 8)} error: ${(e as Error).message}`);
    }
  }
}

// ─── Worker bootstrap ─────────────────────────────────────────────────────────

process.on('message', (msg: { type: string; config?: WorkerConfig }) => {
  if (msg.type !== 'init' || !msg.config) return;

  const cfg = msg.config;
  if (cfg.peerId.startsWith(PHANTOM_PREFIX)) {
    process.stderr.write(`[relay_worker] PHANTOM peer — no-op\n`);
    return;
  }

  const resolved: Required<WorkerConfig> = {
    peerId: cfg.peerId,
    supabaseUrl: (cfg.supabaseUrl ?? '').replace(/\/$/, ''),
    anonKey: cfg.anonKey,
    model: cfg.model ?? FLOOR_MODEL,
    pollIntervalMs: cfg.pollIntervalMs ?? 3000,
    ollamaUrl: (cfg.ollamaUrl ?? 'http://127.0.0.1:11434').replace(/\/$/, ''),
  };

  log(`starting — peer=${resolved.peerId.slice(0, 8)} model=${resolved.model} interval=${resolved.pollIntervalMs}ms`);
  process.send?.({ type: 'started' });

  let inflight = false;
  let pollCount = 0;
  let bootHealthLogged = false;

  async function runTick(): Promise<void> {
    if (inflight) return;
    inflight = true;
    pollCount++;
    try {
      if (!bootHealthLogged) {
        bootHealthLogged = true;
        // BP102 instrumentation: log first Ollama health-check result at boot
        const firstOllamaResult = await checkOllamaHealth(resolved.ollamaUrl);
        log(`boot: first checkOllamaHealth() → ${firstOllamaResult ? 'HEALTHY' : 'UNHEALTHY'} at ${new Date().toISOString()}`);
      }
      await tick(resolved, pollCount);
    } catch (e: unknown) {
      process.send?.({ type: 'tick_error', message: (e as Error).message });
    } finally {
      inflight = false;
    }
  }

  runTick();
  const intervalId = setInterval(() => { runTick(); }, resolved.pollIntervalMs);

  // Graceful shutdown on 'stop' message
  process.on('message', (inner: { type: string }) => {
    if (inner.type === 'stop') {
      clearInterval(intervalId);
      log('worker stopping gracefully');
      process.exit(0);
    }
  });
});

// Handle uncaught errors — let supervisor detect the exit
process.on('uncaughtException', (err) => {
  process.stderr.write(`[relay_worker] uncaughtException: ${err.message}\n`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  process.stderr.write(`[relay_worker] unhandledRejection: ${String(reason)}\n`);
  process.exit(1);
});
