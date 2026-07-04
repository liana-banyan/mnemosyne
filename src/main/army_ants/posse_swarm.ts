/**
 * posse_swarm.ts — Army Ants Swarm Dispatch
 * BP091 HARD CANON · BP092 HOTFIX Round-Up Implementation
 * Caithedral™
 *
 * Fan-out each sub-claim to a tier-appropriate peer via Supabase relay.
 * Aggregate weighted vote. Recurse on contested sub-claims (max depth 2).
 * Persists run rows to posse_swarm_runs (§15 BLOOD: pre-applied by Bishop).
 */

import { randomUUID } from 'crypto';
import { type PosseSubClaim } from './posse_decompose';

export interface SwarmSubResult {
  sub_claim_id: string;
  sub_claim_text: string;
  peer_id: string;
  answer: string | null;
  confidence: number;
  completed_at: string;
  depth: number;
}

export interface SwarmAggregateResult {
  run_id: string;
  parent_question_id: string;
  aggregate_answer: string | null;
  aggregate_confidence: number;
  per_sub_claim: SwarmSubResult[];
  contested_after_swarm: boolean;
  elapsed_ms: number;
}

export interface SwarmConfig {
  supabaseUrl: string;
  serviceKey: string;
  sessionId: string;
  domain: string;
  wireFormat: string;
  tierPeerMap: Record<string, string[]>;
  peerTierMap: Record<string, string>;
  peers: Array<{ peer_id: string }>;
  timeoutMs: number;
  maxDepth?: number;
  varianceThreshold?: number;
}

const DIFFICULTY_TO_TIER: Record<string, string[]> = {
  HARD: ['ultra', 'full'],
  MEDIUM: ['ultra', 'full', 'core'],
  SHORT: ['ultra', 'full', 'core'],
};

export async function swarmDispatch(
  subClaims: PosseSubClaim[],
  parentQuestionId: string,
  originalQuestion: string,
  originalOptions: string[],
  config: SwarmConfig,
  currentDepth = 0,
): Promise<SwarmAggregateResult> {
  const t0 = Date.now();
  const runId = randomUUID();
  const maxDepth = config.maxDepth ?? 2;

  const subResults: SwarmSubResult[] = [];

  const dispatchPromises = subClaims.flatMap((sc) => {
    const targetPeers = selectTierPeers(sc.difficulty_class, config);
    const subPrompt = buildSubClaimPrompt(sc, originalQuestion, originalOptions, config.domain);
    return targetPeers.map(async (targetPeer) => {
      try {
        const answer = await dispatchSubClaim(
          sc, subPrompt, targetPeer, parentQuestionId, runId, config, currentDepth
        );
        subResults.push({
          sub_claim_id: sc.sub_claim_id,
          sub_claim_text: sc.sub_claim_text,
          peer_id: targetPeer,
          answer,
          confidence: answer !== null ? 0.8 : 0.2,
          completed_at: new Date().toISOString(),
          depth: currentDepth,
        });
      } catch {
        subResults.push({
          sub_claim_id: sc.sub_claim_id,
          sub_claim_text: sc.sub_claim_text,
          peer_id: targetPeer,
          answer: null,
          confidence: 0.0,
          completed_at: new Date().toISOString(),
          depth: currentDepth,
        });
      }
    });
  });

  await Promise.all(dispatchPromises);

  for (const sr of subResults) {
    try {
      await supabasePost(config.supabaseUrl, config.serviceKey, 'posse_swarm_runs', {
        run_id: runId,
        parent_question_id: parentQuestionId,
        sub_claim_id: sr.sub_claim_id,
        peer_id: sr.peer_id,
        answer: sr.answer,
        confidence: sr.confidence,
        depth: sr.depth,
        completed_at: sr.completed_at,
      });
    } catch { /* non-fatal */ }
  }

  const answerVotes: Record<string, number> = {};
  for (const sr of subResults) {
    if (sr.answer) {
      answerVotes[sr.answer] = (answerVotes[sr.answer] ?? 0) + sr.confidence;
    }
  }

  const entries = Object.entries(answerVotes).sort((a, b) => b[1] - a[1]);
  const aggregateAnswer: string | null = entries[0]?.[0] ?? null;
  const topScore = entries[0]?.[1] ?? 0;
  const secondScore = entries[1]?.[1] ?? 0;
  const contestedAfterSwarm = entries.length > 1 && topScore === secondScore;
  const aggregateConfidence = topScore / (subResults.length || 1);

  if (currentDepth < maxDepth) {
    const contestedSubClaims = subResults.filter(sr => sr.answer === null || sr.confidence < 0.4);
    if (contestedSubClaims.length > 0) {
      const contestedScs = subClaims.filter(sc =>
        contestedSubClaims.some(cs => cs.sub_claim_id === sc.sub_claim_id)
      );
      const recursiveResult = await swarmDispatch(
        contestedScs, parentQuestionId, originalQuestion, originalOptions,
        { ...config, timeoutMs: Math.floor(config.timeoutMs * 0.7) },
        currentDepth + 1
      );
      for (const rsr of recursiveResult.per_sub_claim) {
        const existingIdx = subResults.findIndex(s => s.sub_claim_id === rsr.sub_claim_id);
        if (existingIdx >= 0 && rsr.confidence > subResults[existingIdx].confidence) {
          subResults[existingIdx] = rsr;
        }
      }
    }
  }

  // BP094 Session 9 BLOCK D: guard against negative elapsed_ms (clock skew / async drift)
  const rawElapsedMs = Date.now() - t0;
  const elapsedMs = rawElapsedMs >= 0 ? rawElapsedMs : 0;
  if (rawElapsedMs < 0) {
    console.warn(`[WARN] negative delay corrected to 0 (raw=${rawElapsedMs}ms) in swarmDispatch — clock skew or async drift detected`);
  }

  return {
    run_id: runId,
    parent_question_id: parentQuestionId,
    aggregate_answer: aggregateAnswer,
    aggregate_confidence: aggregateConfidence,
    per_sub_claim: subResults,
    contested_after_swarm: contestedAfterSwarm,
    elapsed_ms: elapsedMs,
  };
}

function selectTierPeer(difficultyClass: string, config: SwarmConfig): string | null {
  return selectTierPeers(difficultyClass, config)[0] ?? null;
}

/** Returns ALL peers whose tier matches the difficulty class (multi-peer fan-out). */
function selectTierPeers(difficultyClass: string, config: SwarmConfig): string[] {
  const allowedTiers = DIFFICULTY_TO_TIER[difficultyClass] ?? ['ultra', 'full', 'core'];
  const matched: string[] = [];
  for (const tier of allowedTiers) {
    const prefixes = config.tierPeerMap[tier] ?? [];
    for (const p of config.peers) {
      if (prefixes.some(prefix => p.peer_id.startsWith(prefix))) {
        matched.push(p.peer_id);
      }
    }
  }
  // Fallback: use all known peers if no tier mapping matched
  return matched.length > 0 ? matched : config.peers.map(p => p.peer_id);
}

function buildSubClaimPrompt(
  sc: PosseSubClaim,
  originalQuestion: string,
  options: string[],
  domain: string,
): string {
  const optText = options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('\n');
  return `Domain: ${domain}

Context (original question): ${originalQuestion}
Options:
${optText}

Your specific sub-task: ${sc.sub_claim_text}

Based on this sub-task, which answer letter (A–${String.fromCharCode(64 + options.length)}) is best supported?
Reply with ONLY the letter. No explanation.`;
}

async function dispatchSubClaim(
  sc: PosseSubClaim,
  prompt: string,
  targetPeerId: string,
  parentQuestionId: string,
  runId: string,
  config: SwarmConfig,
  depth: number,
): Promise<string | null> {
  const routePayload = {
    target_peer_id: targetPeerId,
    hex_frame: Buffer.from(prompt, 'utf8').toString('base64'),
    payload_json: {
      prompt,
      question_id: `${parentQuestionId}-posse-swarm-${sc.sub_claim_index}-d${depth}`,
      wire_format: config.wireFormat,
      domain: config.domain,
      session_id: config.sessionId,
      plow: 'mesh-12-blade',
      plow_max_iterations: 4,
      allotted_timeout_ms: config.timeoutMs,
      is_posse_swarm: true,
      posse_run_id: runId,
      sub_claim_index: sc.sub_claim_index,
    },
    status: 'pending',
    session_id: config.sessionId,
    ttl_seconds: Math.ceil(config.timeoutMs / 1000) + 30,
  };

  const inserted = await supabasePost(config.supabaseUrl, config.serviceKey, 'relay_routes', routePayload);
  const routeId = inserted?.id;
  if (!routeId) return null;

  // BP094 Session 9 BLOCK D: clamp timeoutMs to minimum 5000ms to prevent negative deadline
  const effectiveTimeoutMs = Math.max(5000, config.timeoutMs);
  if (config.timeoutMs < 0) {
    console.warn(`[WARN] negative delay corrected to 0 (raw=${config.timeoutMs}ms) in dispatchSubClaim — question deadline already elapsed`);
  }
  const deadline = Date.now() + effectiveTimeoutMs;
  while (Date.now() < deadline) {
    const rows = await supabaseGet(
      config.supabaseUrl, config.serviceKey,
      `relay_route_replies?select=route_id,answer_json,hex_reply&route_id=eq.${routeId}`
    );
    if (rows && rows.length > 0) {
      const r = rows[0];
      let raw: string | null = null;
      if (r.hex_reply) try { raw = Buffer.from(r.hex_reply, 'base64').toString('utf8'); } catch { raw = r.hex_reply; }
      if (!raw && r.answer_json) {
        const aj = r.answer_json;
        raw = typeof aj === 'string' ? aj : (aj.response ?? aj.answer ?? null);
      }
      if (raw) {
        const letters = 'ABCDEFGHIJ';
        const m = raw.match(new RegExp(`^\\s*([${letters}])\\b`, 'i'));
        return m ? m[1].toUpperCase() : null;
      }
      return null;
    }
    await sleep(2000);
  }
  return null;
}

async function supabasePost(url: string, key: string, table: string, body: object): Promise<any> {
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST ${table} HTTP ${res.status}`);
  const rows = JSON.parse(text);
  return Array.isArray(rows) ? rows[0] : rows;
}

async function supabaseGet(url: string, key: string, path: string): Promise<any[]> {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return [];
  return JSON.parse(await res.text()) ?? [];
}

function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }

export function healthCheck(): { ok: boolean; module: string } {
  return { ok: true, module: 'army_ants/posse_swarm' };
}
