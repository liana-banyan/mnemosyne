/**
 * mesh_plow_dispatcher.ts — BP087 MAMBA-α
 *
 * Plow-on-mesh integration layer. Dispatches a single MMLU-Pro question to one
 * or more peers via wan-relay-route (Supabase relay bus), waits for replies via
 * relay_route_replies, and aggregates responses using Ascending Andon discipline.
 *
 * Architecture:
 *   M0 orchestrator picks peer pool via Wrasse Quartermaster (MAMBA-γ/β4).
 *   For each selected peer, M0 encodes the question as a hex-mcode frame (MAMBA-δ)
 *   and POSTs to wan-relay-route. Peer's relay-poll loop receives the frame,
 *   runs its local Plow blade (or Ollama directly as v1 baseline), and INSERT into
 *   relay_route_replies. M0 polls relay_route_replies until all peers respond or
 *   timeout expires. Ascending Andon fires when peer-confidence variance exceeds
 *   threshold — escalates to Star Chamber (MAMBA-ε).
 *
 * Canon ref: canon_plow_on_mesh_integration_distributed_12_blade_bp087
 */

import { encodeFrame, decodeFrame } from '../wire/hex-encode';
import { randomUUID, createHash } from 'crypto';
import { signFrame, verifyFrame } from '../thorax/sign_verify';
import { fetchPearlFromMesh } from '../pearl/pearl_mesh_sync';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface MeshPeerTarget {
  peer_id: string;
  /** Optional domain affinity score for this peer on the question domain (0-1) */
  domain_affinity?: number;
  /** MAMBA-beta3: Ed25519 public key hex for Thorax frame verification */
  public_key_hex?: string;
}

export interface MeshPlowQuestion {
  question: string;
  options: string[];
  domain: string;
  /** Sealed answer letter (A-J) — used for correctness scoring, NOT sent to peers */
  sealed_letter?: string;
}

export interface MeshPeerResponse {
  peer_id: string;
  answer_letter: string | null;
  confidence: number;
  latency_ms: number;
  blade_id: string;
  hex_frame: string;
  /** Byte size of hex_frame for δ6 receipt logging */
  hex_byte_size: number;
  /** Byte size of equivalent JSON payload for δ6 comparison */
  json_byte_size: number;
  raw_payload: Record<string, unknown>;
}

export interface MeshPlowResult {
  dispatch_id: string;
  domain: string;
  question: string;
  peers_queried: number;
  peers_responded: number;
  consensus_letter: string | null;
  /** Variance across peer confidence scores (0-100). H = Variance / 100 for Andon. */
  confidence_variance: number;
  /** True when Ascending Andon threshold triggered (Variance > andon_threshold) */
  andon_triggered: boolean;
  /** Peer responses keyed by peer_id */
  peer_responses: MeshPeerResponse[];
  elapsed_ms: number;
  /** δ6 receipt: hex bytes vs json bytes delta */
  wire_format_receipt: {
    total_hex_bytes: number;
    total_json_bytes: number;
    byte_delta: number;
    delta_pct: number;
  };
  /** Routing mode used */
  routing: 'domain-affinity' | 'round-robin';
}

export interface MeshPlowConfig {
  supabase_url: string;
  supabase_anon_key: string;
  supabase_service_key: string;
  peers: MeshPeerTarget[];
  /** Ascending Andon threshold: 0-100. Default 15 (15% variance). */
  andon_threshold?: number;
  /** Per-peer timeout in ms. Default 120_000. */
  peer_timeout_ms?: number;
  routing?: 'domain-affinity' | 'round-robin';
  /** If set, only dispatch to peers with top-N affinity scores */
  pool_size?: number;
  /** REST base URLs for peer nodes used during MAMBA-beta2 pearl mesh fan-out */
  pearl_peer_endpoints?: string[];
  /** MAMBA-beta3: local Ed25519 private key hex for signing outbound frames (PKCS8 DER) */
  local_private_key_hex?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function sha256hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

function buildBladeId(dispatchId: string, peerId: string): string {
  return sha256hex(dispatchId + ':' + peerId).slice(0, 12);
}

/** Compute variance of a number array */
function computeVariance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sq = values.reduce((sum, v) => sum + (v - mean) ** 2, 0);
  return sq / values.length;
}

/** Extract answer letter from peer raw_payload */
function extractPeerAnswer(payload: Record<string, unknown>): {
  letter: string | null;
  confidence: number;
} {
  const letter = typeof payload['answer_letter'] === 'string'
    ? (payload['answer_letter'] as string).toUpperCase().trim().charAt(0)
    : null;
  const confidence = typeof payload['confidence'] === 'number'
    ? Math.max(0, Math.min(100, payload['confidence'] as number))
    : letter !== null ? 70 : 0; // default 70 if peer answered but didn't report confidence
  return { letter: /^[A-J]$/.test(letter ?? '') ? letter : null, confidence };
}

// ─── Core dispatcher ───────────────────────────────────────────────────────────

/**
 * Dispatch a single question to a pool of mesh peers.
 * Returns when all peers respond or per-peer timeout expires.
 */
export async function dispatchQuestionToMesh(
  question: MeshPlowQuestion,
  config: MeshPlowConfig,
): Promise<MeshPlowResult> {
  const t0 = Date.now();
  const dispatchId = randomUUID();
  const andonThreshold = config.andon_threshold ?? 15;
  const peerTimeoutMs = config.peer_timeout_ms ?? 120_000;
  const routing = config.routing ?? 'round-robin';

  // Select peer pool
  let peerPool = [...config.peers];
  if (routing === 'domain-affinity') {
    peerPool = [...config.peers].sort((a, b) =>
      (b.domain_affinity ?? 0) - (a.domain_affinity ?? 0)
    );
  }
  if (config.pool_size && config.pool_size > 0) {
    peerPool = peerPool.slice(0, config.pool_size);
  }

  // MAMBA-beta2: pearl resolution -- local substrate first, then attested 2-attempt mesh fan-out
  const pearlId = sha256hex(question.domain + ':' + question.question).slice(0, 16);
  let pearlContext: string | null = null;

  // 1. Attempt local substrate pearl lookup
  try {
    const localRes = await fetch(
      `${config.supabase_url}/rest/v1/pearl_share?pearl_id=eq.${pearlId}&select=payload_b64&limit=1`,
      {
        headers: {
          'apikey': config.supabase_anon_key,
          'Authorization': `Bearer ${config.supabase_anon_key}`,
        },
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (localRes.ok) {
      const rows = (await localRes.json()) as Array<{ payload_b64: string }>;
      if (rows.length > 0 && rows[0]) {
        pearlContext = rows[0].payload_b64;
      }
    }
  } catch {
    // local lookup failed -- fall through to mesh fan-out
  }

  // 2. On null: attested 2-attempt fan-out from peer nodes
  if (pearlContext === null) {
    const peerEndpoints = config.pearl_peer_endpoints ?? [];
    pearlContext = await fetchPearlFromMesh(pearlId, peerEndpoints);
    if (pearlContext !== null) {
      // MAMBA-beta2: pearl resolved from mesh peer
      console.log(`[MeshPlow] MAMBA-beta2: pearl resolved from mesh peer pearl_id=${pearlId}`);
    } else {
      // MAMBA-beta2: pearl null after attested 2-attempt fan-out -- pearl_id=${pearlId}
      console.log(`[MeshPlow] MAMBA-beta2: pearl null after attested 2-attempt fan-out -- pearl_id=${pearlId}`);
    }
  }

  // Build question payload (peer sees options + domain, NOT sealed_letter)
  // pearl_id is included regardless of resolution result; pearl_context is null if unresolved
  const questionPayload: Record<string, unknown> = {
    question: question.question,
    options: question.options,
    domain: question.domain,
    dispatch_id: dispatchId,
    requested_at: new Date().toISOString(),
    frame_version: 'hex-mcode-v1',
    pearl_id: pearlId,
    pearl_context: pearlContext,
  };

  const jsonPayload = JSON.stringify(questionPayload);
  const jsonByteSize = Buffer.byteLength(jsonPayload, 'utf8');

  // Encode as hex-mcode frame (MAMBA-delta)
  const rawHexFrame = encodeFrame(dispatchId, 'question', questionPayload);
  // MAMBA-beta3: Ed25519 sign -- sign outbound frame with local private key (noop if key absent)
  const hexFrame = config.local_private_key_hex
    ? signFrame(rawHexFrame, config.local_private_key_hex)
    : rawHexFrame;
  const hexByteSize = Buffer.byteLength(hexFrame, 'ascii'); // each char is 1 byte of ASCII hex

  // Dispatch to each peer via wan-relay-route
  const routeIds: Map<string, string> = new Map(); // peer_id -> route_id
  let totalHexBytes = 0;
  let totalJsonBytes = 0;

  for (const peer of peerPool) {
    try {
      const resp = await fetch(`${config.supabase_url}/functions/v1/wan-relay-route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.supabase_service_key}`,
          'apikey': config.supabase_service_key,
        },
        body: JSON.stringify({
          target_peer_id: peer.peer_id,
          hex_frame: hexFrame,
          payload_json: jsonPayload,
          session_id: dispatchId,
          ttl_seconds: Math.ceil(peerTimeoutMs / 1000),
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (resp.ok) {
        const data = (await resp.json()) as { route_id?: string; ok?: boolean };
        if (data.route_id) {
          routeIds.set(peer.peer_id, data.route_id);
          totalHexBytes += hexByteSize;
          totalJsonBytes += jsonByteSize;
        } else {
          console.warn(`[MeshPlow] wan-relay-route returned no route_id for peer=${peer.peer_id}`);
        }
      } else {
        const errText = await resp.text().catch(() => '');
        console.warn(`[MeshPlow] wan-relay-route HTTP ${resp.status} for peer=${peer.peer_id}: ${errText.slice(0, 200)}`);
      }
    } catch (err) {
      console.warn(`[MeshPlow] dispatch to peer=${peer.peer_id} failed:`, err);
    }
  }

  if (routeIds.size === 0) {
    const elapsed = Date.now() - t0;
    console.warn(`[MeshPlow] dispatch_id=${dispatchId} — no peers accepted the route.`);
    return {
      dispatch_id: dispatchId,
      domain: question.domain,
      question: question.question,
      peers_queried: peerPool.length,
      peers_responded: 0,
      consensus_letter: null,
      confidence_variance: 0,
      andon_triggered: false,
      peer_responses: [],
      elapsed_ms: elapsed,
      wire_format_receipt: {
        total_hex_bytes: 0,
        total_json_bytes: 0,
        byte_delta: 0,
        delta_pct: 0,
      },
      routing,
    };
  }

  // Poll relay_route_replies for each routed peer
  const peerResponses: MeshPeerResponse[] = [];
  const pollDeadline = Date.now() + peerTimeoutMs;
  const pending = new Set(routeIds.keys());

  while (pending.size > 0 && Date.now() < pollDeadline) {
    await new Promise<void>((resolve) => setTimeout(resolve, 2_000)); // 2s poll cadence

    for (const peerId of [...pending]) {
      const routeId = routeIds.get(peerId);
      if (!routeId) { pending.delete(peerId); continue; }

      try {
        const replyRes = await fetch(
          `${config.supabase_url}/rest/v1/relay_route_replies` +
          `?route_id=eq.${routeId}&select=*&limit=1`,
          {
            headers: {
              'apikey': config.supabase_anon_key,
              'Authorization': `Bearer ${config.supabase_anon_key}`,
            },
            signal: AbortSignal.timeout(8_000),
          }
        );

        if (!replyRes.ok) continue;
        const rows = (await replyRes.json()) as Array<{
          route_id: string;
          hex_frame?: string;
          payload_json?: string;
          created_at: string;
        }>;

        if (rows.length === 0) continue;

        const row = rows[0]!;
        pending.delete(peerId);

        // Decode reply frame (hex-mcode or plain JSON fallback -- delta5 bi-directional)
        let replyPayload: Record<string, unknown> = {};
        let replyHexFrame = '';
        let replyHexBytes = 0;
        let replyJsonBytes = 0;

        if (row.hex_frame && row.hex_frame.length > 0) {
          // MAMBA-beta3: Ed25519 verify -- verify inbound frame signature before processing
          const senderPeer = peerPool.find((p) => p.peer_id === peerId);
          const senderPubKey = senderPeer?.public_key_hex;
          let verifiedHexFrame = row.hex_frame;

          if (senderPubKey) {
            const verifyResult = verifyFrame(row.hex_frame, senderPubKey);
            if (!verifyResult.valid) {
              console.warn(
                `[Thorax] VIOLATION: invalid signature from peer=${peerId} ` +
                `frame_prefix=${row.hex_frame.slice(0, 32)} dispatch_id=${dispatchId}`
              );
              // Insert thorax_violation row (fire-and-forget)
              fetch(
                `${config.supabase_url}/rest/v1/thorax_violations`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.supabase_service_key}`,
                    'apikey': config.supabase_service_key,
                    'Prefer': 'return=minimal',
                  },
                  body: JSON.stringify({
                    peer_id: peerId,
                    frame_hex_prefix: row.hex_frame.slice(0, 64),
                    violation_type: 'invalid_signature',
                    detected_at: new Date().toISOString(),
                  }),
                  signal: AbortSignal.timeout(5_000),
                }
              ).catch((err) => {
                console.warn('[Thorax] thorax_violations insert failed:', err);
              });
              // Drop the frame
              pending.delete(peerId);
              continue;
            }
            // Signature valid -- use unsigned frame for decoding
            verifiedHexFrame = verifyResult.frameHex;
          }

          try {
            const decoded = decodeFrame(verifiedHexFrame);
            replyPayload = decoded.payload;
            replyHexFrame = row.hex_frame;
            replyHexBytes = Buffer.byteLength(row.hex_frame, 'ascii');
          } catch {
            // Fallback: parse payload_json
            if (row.payload_json) {
              try {
                replyPayload = JSON.parse(row.payload_json) as Record<string, unknown>;
              } catch { /* empty */ }
            }
          }
        } else if (row.payload_json) {
          try {
            replyPayload = JSON.parse(row.payload_json) as Record<string, unknown>;
          } catch { /* empty */ }
        }

        replyJsonBytes = Buffer.byteLength(JSON.stringify(replyPayload), 'utf8');

        const { letter, confidence } = extractPeerAnswer(replyPayload);
        const bladeId = buildBladeId(dispatchId, peerId);
        const replyTs = new Date(row.created_at).getTime();
        const latencyMs = replyTs - t0;

        peerResponses.push({
          peer_id: peerId,
          answer_letter: letter,
          confidence,
          latency_ms: Math.max(0, latencyMs),
          blade_id: bladeId,
          hex_frame: replyHexFrame,
          hex_byte_size: replyHexBytes,
          json_byte_size: replyJsonBytes,
          raw_payload: replyPayload,
        });

        totalHexBytes += replyHexBytes;
        totalJsonBytes += replyJsonBytes;

      } catch (err) {
        console.warn(`[MeshPlow] poll reply for peer=${peerId} route=${routeId} failed:`, err);
      }
    }
  }

  // Aggregate responses — plurality vote for consensus
  const letterCounts: Map<string, number> = new Map();
  const confidences: number[] = [];

  for (const r of peerResponses) {
    if (r.answer_letter) {
      letterCounts.set(r.answer_letter, (letterCounts.get(r.answer_letter) ?? 0) + 1);
    }
    confidences.push(r.confidence);
  }

  let consensusLetter: string | null = null;
  let maxVotes = 0;
  for (const [letter, count] of letterCounts.entries()) {
    if (count > maxVotes) { maxVotes = count; consensusLetter = letter; }
  }

  // Ascending Andon: variance / 100 = H
  const varianceRaw = computeVariance(confidences);
  const andonTriggered = varianceRaw > andonThreshold;

  if (andonTriggered) {
    console.log(
      `[MeshPlow] ANDON dispatch_id=${dispatchId} domain=${question.domain} ` +
      `confidence_variance=${varianceRaw.toFixed(1)} > threshold=${andonThreshold} ` +
      `— escalate to Star Chamber (MAMBA-ε)`
    );
  }

  // δ6: wire format receipt
  const byteDelta = totalHexBytes - totalJsonBytes;
  const deltaPct = totalJsonBytes > 0
    ? ((byteDelta / totalJsonBytes) * 100)
    : 0;

  const elapsed = Date.now() - t0;

  console.log(
    `[MeshPlow] dispatch_id=${dispatchId} domain=${question.domain} ` +
    `peers=${peerPool.length} responded=${peerResponses.length} ` +
    `consensus=${consensusLetter ?? 'null'} andon=${andonTriggered} ` +
    `elapsed=${elapsed}ms δ6: hex=${totalHexBytes}B json=${totalJsonBytes}B delta=${byteDelta > 0 ? '+' : ''}${byteDelta}B (${deltaPct.toFixed(1)}%)`
  );

  return {
    dispatch_id: dispatchId,
    domain: question.domain,
    question: question.question,
    peers_queried: peerPool.length,
    peers_responded: peerResponses.length,
    consensus_letter: consensusLetter,
    confidence_variance: varianceRaw,
    andon_triggered: andonTriggered,
    peer_responses: peerResponses,
    elapsed_ms: elapsed,
    wire_format_receipt: {
      total_hex_bytes: totalHexBytes,
      total_json_bytes: totalJsonBytes,
      byte_delta: byteDelta,
      delta_pct: deltaPct,
    },
    routing,
  };
}

/**
 * Run an N-question MMLU-Pro benchmark through the mesh.
 * Iterates domains in staggered order, dispatches each question to the configured
 * peer pool, collects results, logs per-domain affinity update signals.
 *
 * Called by run-plow-on-mesh.mjs CLI entry point.
 */
export async function runPlowOnMesh(
  questions: MeshPlowQuestion[],
  config: MeshPlowConfig,
  onProgress?: (event: {
    type: 'question-start' | 'question-done' | 'domain-done' | 'complete';
    questionIndex: number;
    totalQuestions: number;
    domain?: string;
    result?: MeshPlowResult;
    andon_count?: number;
    star_chamber_fires?: number;
  }) => void,
): Promise<{
  results: MeshPlowResult[];
  total_correct: number | null;
  total_questions: number;
  andon_count: number;
  elapsed_ms: number;
}> {
  const t0 = Date.now();
  const results: MeshPlowResult[] = [];
  let andonCount = 0;
  let totalCorrect = 0;
  let scoredCount = 0;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]!;

    onProgress?.({
      type: 'question-start',
      questionIndex: i,
      totalQuestions: questions.length,
      domain: q.domain,
    });

    const result = await dispatchQuestionToMesh(q, config);
    results.push(result);

    if (result.andon_triggered) andonCount++;
    if (q.sealed_letter && result.consensus_letter) {
      scoredCount++;
      if (result.consensus_letter === q.sealed_letter) totalCorrect++;
    }

    onProgress?.({
      type: 'question-done',
      questionIndex: i,
      totalQuestions: questions.length,
      domain: q.domain,
      result,
      andon_count: andonCount,
    });
  }

  const elapsed = Date.now() - t0;

  onProgress?.({
    type: 'complete',
    questionIndex: questions.length - 1,
    totalQuestions: questions.length,
    andon_count: andonCount,
  });

  return {
    results,
    total_correct: scoredCount > 0 ? totalCorrect : null,
    total_questions: questions.length,
    andon_count: andonCount,
    elapsed_ms: elapsed,
  };
}
