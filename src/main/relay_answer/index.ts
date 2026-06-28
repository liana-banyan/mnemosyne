// relay_answer/index.ts — BP099 K13
// Permanent relay-answer poller for MnemosyneC Electron main process.
// Translated from tools/mesh-validation/relay-answer-worker.mjs (Bishop-authored 2026-06-28).
//
// Polls relay_routes for status='pending' rows matching this peer_id,
// calls local Ollama for inference, submits result via submit-relay-route-reply edge function.
// Returns a stop() function to halt polling on app quit.

// floor-model.ts does not exist in shared — use hardcoded floor model
const FLOOR_MODEL = 'qwen2.5:0.5b';

const PHANTOM_PREFIX = '49f3e597';

export interface RelayAnswerPollerConfig {
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
const log = (msg: string) => console.log(`[relay_answer] [${ts()}] ${msg}`);
const warn = (msg: string) => console.warn(`[relay_answer] [${ts()}] WARN ${msg}`);

async function fetchPendingRoutes(
  supabaseUrl: string,
  anonKey: string,
  peerId: string,
): Promise<RelayRoute[]> {
  const url =
    `${supabaseUrl}/rest/v1/relay_routes` +
    `?status=eq.pending&target_peer_id=eq.${encodeURIComponent(peerId)}` +
    `&select=id,payload_json,target_peer_id&order=created_at.asc&limit=5`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    });
  } catch (e: unknown) {
    log(`fetch routes network error: ${(e as Error).message}`);
    return [];
  }
  if (!res.ok) {
    log(`fetch routes FAILED: HTTP ${res.status} ${await res.text()}`);
    return [];
  }
  return ((await res.json()) as RelayRoute[]) ?? [];
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
  });
  const elapsed = Date.now() - t0;
  if (!res.ok) {
    throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as OllamaGenerateResponse;
  const answer = data?.response ?? '';
  return { answer, elapsed };
}

async function submitReplyViaEdgeFunction(
  supabaseUrl: string,
  anonKey: string,
  routeId: string,
  peerId: string,
  answer: string,
  processingMs: number,
): Promise<boolean> {
  let res: Response;
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/submit-relay-route-reply`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        route_id: routeId,
        peer_id: peerId,
        answer_json: { answer },
        processing_ms: processingMs,
      }),
    });
  } catch (e: unknown) {
    log(`submit reply network error route=${routeId.slice(0, 8)}: ${(e as Error).message}`);
    return false;
  }
  if (!res.ok) {
    const body = await res.text();
    log(`submit reply FAILED route=${routeId.slice(0, 8)}: HTTP ${res.status} ${body}`);
    return false;
  }
  return true;
}

async function processOneRoute(
  route: RelayRoute,
  config: Required<RelayAnswerPollerConfig>,
): Promise<void> {
  const prompt =
    route.payload_json?.prompt ??
    route.payload_json?.question ??
    JSON.stringify(route.payload_json);

  try {
    log(`route ${route.id.slice(0, 8)} → Ollama (${config.model})...`);
    const { answer, elapsed } = await runOllama(config.ollamaUrl, config.model, prompt);
    const submitted = await submitReplyViaEdgeFunction(
      config.supabaseUrl,
      config.anonKey,
      route.id,
      config.peerId,
      answer,
      elapsed,
    );
    if (submitted) {
      log(`route ${route.id.slice(0, 8)} answered in ${elapsed}ms`);
    }
  } catch (e: unknown) {
    log(`route ${route.id.slice(0, 8)} error: ${(e as Error).message}`);
  }
}

export function startRelayAnswerPoller(config: RelayAnswerPollerConfig): () => void {
  if (config.peerId.startsWith(PHANTOM_PREFIX)) {
    warn(`PHANTOM peer excluded: ${config.peerId.slice(0, 8)} — relay-answer poller is a no-op`);
    return () => {};
  }

  const resolved: Required<RelayAnswerPollerConfig> = {
    peerId: config.peerId,
    supabaseUrl: config.supabaseUrl.replace(/\/$/, ''),
    anonKey: config.anonKey,
    model: config.model ?? FLOOR_MODEL,
    pollIntervalMs: config.pollIntervalMs ?? 3000,
    ollamaUrl: (config.ollamaUrl ?? 'http://127.0.0.1:11434').replace(/\/$/, ''),
  };

  let inflight = false;
  let pollCount = 0;

  async function tick(): Promise<void> {
    if (inflight) return;
    inflight = true;
    pollCount++;
    try {
      const routes = await fetchPendingRoutes(
        resolved.supabaseUrl,
        resolved.anonKey,
        resolved.peerId,
      );
      if (routes.length > 0) {
        log(
          `poll #${pollCount}: ${routes.length} pending route(s) for peer ${resolved.peerId.slice(0, 8)}`,
        );
        for (const route of routes) {
          await processOneRoute(route, resolved);
        }
      } else if (pollCount % 20 === 0) {
        log(`poll #${pollCount}: idle (no pending routes for peer ${resolved.peerId.slice(0, 8)})`);
      }
    } catch (e: unknown) {
      log(`tick error: ${(e as Error).message}`);
    } finally {
      inflight = false;
    }
  }

  log(
    `starting — peer=${resolved.peerId.slice(0, 8)} model=${resolved.model} interval=${resolved.pollIntervalMs}ms`,
  );

  // Fire immediately on startup, then on interval
  tick().catch((e: unknown) => log(`initial tick error: ${(e as Error).message}`));
  const intervalId = setInterval(
    () => tick().catch((e: unknown) => log(`interval tick error: ${(e as Error).message}`)),
    resolved.pollIntervalMs,
  );

  return () => {
    clearInterval(intervalId);
    log('poller stopped');
  };
}
