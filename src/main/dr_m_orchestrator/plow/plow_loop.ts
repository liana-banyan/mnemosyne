// plow_loop.ts -- Mountain 1b · I-C · PLOW LOOP Core
// KNIGHT MARATHON 7 · MOUNTAIN 1b · BP089
//
// Full iteration loop:
//   1. Classifies domain (classifyQueryDomain)
//   2. Plows domain advantage (plowDomainAdvantage)
//   3. Primes each Council member system prompt with domain bundle
//   4. Dispatches via Minor Star Chamber (minorCouncil)
//   5. Scores confidence
//   6. Iterates if confidence < threshold (max 3 iterations)
//
// Default maxIterations = 3 · confidenceThreshold = 0.75
//
// §3 Truth-Always: On Day 1, most domain bundles are empty. Empty bundles
//   produce zero context injection. Council fires on base substrate only.
//   is_empty=true is logged. Graceful degradation · never throws.
// MOUNTAIN_1b_ADDITION

import type { SubstrateReader, SubstrateContextBundle, DatabaseConfig } from '../substrate_reader';
import type { CouncilPackageName } from '../court_packages';
import type { MinorCouncilResult } from '../minor_star_chamber';
import { minorCouncil } from '../minor_star_chamber';
import { randomUUID, createHash } from 'node:crypto';

import { classifyQueryDomain } from './domain_classifier';
import type { DomainTag } from './domain_classifier';
import { plowDomainAdvantage, bundleToSystemContext } from './unfair_advantage';
import type { UnfairAdvantageBundle } from './unfair_advantage';

// ─── Types ────────────────────────────────────────────────────────────────────────

export interface PlowLoopOptions {
  maxIterations?: number;         // default 3
  confidenceThreshold?: number;   // default 0.75 · below this: iterate
  councilPackage?: CouncilPackageName;  // default: "composer_council"
  skipClassification?: boolean;   // if domain already known · skip classifier
  forceDomain?: DomainTag;        // override classifier · for testing
  db?: DatabaseConfig;            // optional · for plow_loop_log + domain_classifier_audit writes
}

export interface PlowLoopResult {
  answer: string;
  confidence: number;             // 0.0-1.0 · final scored confidence
  iterations: number;             // 1-3 · how many plow-dispatch cycles ran
  council_variance: number;       // variance from Minor Star Chamber final cycle
  escalated: boolean;             // true if flagship adjudication fired in any cycle
  advantage_used: UnfairAdvantageBundle;  // bundle that primed the final cycle
  domain: DomainTag;              // classified domain
  total_latency_ms: number;
}

// ─── Internal: Supabase fire-and-forget insert ───────────────────────────────────

async function supabaseInsert(
  db: DatabaseConfig,
  table: string,
  row: Record<string, unknown>
): Promise<void> {
  try {
    await fetch(`${db.supabaseUrl}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        apikey: db.anonKey,
        Authorization: `Bearer ${db.anonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Fire-and-forget logging · never throw
  }
}

// ─── Internal: scoreConfidence ───────────────────────────────────────────────────

function scoreConfidence(
  councilResult: MinorCouncilResult,
  bundle: UnfairAdvantageBundle
): number {
  // Base: convergence proxy (1 - variance)
  let confidence = 1.0 - councilResult.variance;

  // Boost: answer appears in qaPearls (canonical ground truth)
  if (bundle.qaPearls.length > 0) {
    const answerLower = councilResult.result.toLowerCase();
    const matchesPearl = bundle.qaPearls.some((pearl) =>
      answerLower.includes(pearl.toLowerCase().slice(0, 50))
    );
    if (matchesPearl) {
      confidence = Math.min(1.0, confidence + 0.15);
    }
  }

  // Slight penalty: escalation means local models diverged · some uncertainty remains
  if (councilResult.escalated) {
    confidence = Math.max(0.0, confidence - 0.05);
  }

  // Clamp to [0, 1]
  return Math.max(0.0, Math.min(1.0, confidence));
}

// ─── Internal: build primed SubstrateContextBundle ───────────────────────────────

function buildPrimedBundle(
  baseBundle: SubstrateContextBundle,
  advantage: UnfairAdvantageBundle
): SubstrateContextBundle {
  const primedContext = bundleToSystemContext(advantage);
  return {
    ...baseBundle,
    // MOUNTAIN_1b_ADDITION: primed_advantage_context carries domain-specific substrate
    // into brain adapters (ClaudeBrainAdapter + GemmaBrainAdapter) via buildSubstrateSystemPrompt
    primed_advantage_context: primedContext,
  } as SubstrateContextBundle;
}

// ─── runPlowLoop (primary entry point) ───────────────────────────────────────────

export async function runPlowLoop(
  query: string,
  councilPackage: CouncilPackageName,
  reader: SubstrateReader,
  options?: PlowLoopOptions
): Promise<PlowLoopResult> {
  const t0 = Date.now();
  const maxIterations = options?.maxIterations ?? 3;
  const confidenceThreshold = options?.confidenceThreshold ?? 0.75;
  const db = options?.db;

  // ─── Step 1: Classify domain ──────────────────────────────────────────────────

  let domain: DomainTag;
  let classifyModelUsed = 'skipped';
  let classifyFallbackReason: string | null = null;

  if (options?.forceDomain) {
    domain = options.forceDomain;
    classifyModelUsed = 'forced';
  } else if (options?.skipClassification && options.forceDomain) {
    domain = options.forceDomain;
    classifyModelUsed = 'skipped';
  } else {
    const classified = await classifyQueryDomain(query, true);
    domain = classified.domain;
    classifyModelUsed = classified.model_used;
    classifyFallbackReason = classified.fallback_reason;
  }

  // Fire-and-forget: log domain classifier result
  if (db) {
    const queryHash = createHash('sha256').update(query).digest('hex');
    setImmediate(() => {
      supabaseInsert(db, 'domain_classifier_audit', {
        id: randomUUID().replace(/-/g, ''),
        created_at: new Date().toISOString(),
        query_hash: queryHash,
        prompt_excerpt: query.slice(0, 300),
        classified_domain: domain,
        model_used: classifyModelUsed,
        fallback_reason: classifyFallbackReason,
        latency_ms: Date.now() - t0,
        status: classifyModelUsed === 'fallback_general' ? 'fallback_general' :
                classifyModelUsed === 'skipped' || classifyModelUsed === 'forced' ? 'ok' :
                classifyFallbackReason ? 'model_unavailable' : 'ok',
      }).catch(() => undefined);
    });
  }

  // ─── Iteration loop ───────────────────────────────────────────────────────────

  let lastCouncilResult: MinorCouncilResult | null = null;
  let lastAdvantage: UnfairAdvantageBundle | null = null;
  let finalConfidence = 0;
  let currentQuery = query;
  let anyEscalated = false;
  let iterationCount = 0;

  for (let iter = 1; iter <= maxIterations; iter++) {
    iterationCount = iter;

    // Step 2: Plow domain advantage (bypass cache on iteration 2+)
    const advantage = await plowDomainAdvantage(domain, reader, iter > 1);
    lastAdvantage = advantage;

    // Step 3: Build primed substrate context
    const baseBundle = await reader.read().catch((): SubstrateContextBundle => ({
      timestamp: new Date().toISOString(),
      peer_count: 0,
      recent_peers: [],
      recent_pearls: [],
      hot_eblets: [],
      active_pheromones: [],
      context_size_bytes: 0,
      query_latency_ms: 0,
    }));

    const primedBundle = buildPrimedBundle(baseBundle, advantage);

    // Step 4: Fire Minor Council
    const councilResult = await minorCouncil(currentQuery, councilPackage, {
      substrate_context: primedBundle,
      timeout_ms: 90000,
      min_members: 2,
    });

    lastCouncilResult = councilResult;
    if (councilResult.escalated) anyEscalated = true;

    // Step 5: Score confidence
    finalConfidence = scoreConfidence(councilResult, advantage);

    // Check threshold
    if (finalConfidence >= confidenceThreshold || iter >= maxIterations) {
      break;
    }

    // Low confidence: refine query for next iteration
    const answerExcerpt = councilResult.result.slice(0, 200);
    currentQuery = `${answerExcerpt}\n\nReconsider: ${query}`;
  }

  const totalLatencyMs = Date.now() - t0;

  const result: PlowLoopResult = {
    answer: lastCouncilResult!.result,
    confidence: finalConfidence,
    iterations: iterationCount,
    council_variance: lastCouncilResult!.variance,
    escalated: anyEscalated,
    advantage_used: lastAdvantage!,
    domain,
    total_latency_ms: totalLatencyMs,
  };

  // Fire-and-forget: log plow loop result
  if (db) {
    const queryHash = createHash('sha256').update(query).digest('hex');
    setImmediate(() => {
      supabaseInsert(db, 'plow_loop_log', {
        id: randomUUID().replace(/-/g, ''),
        created_at: new Date().toISOString(),
        query_hash: queryHash,
        prompt_excerpt: query.slice(0, 300),
        domain,
        council_package: councilPackage,
        iterations: iterationCount,
        max_iterations: maxIterations,
        final_confidence: finalConfidence,
        council_variance: result.council_variance,
        advantage_size: lastAdvantage?.bundle_size_bytes ?? 0,
        advantage_is_empty: (lastAdvantage?.is_empty ?? true) ? 1 : 0,
        escalated: anyEscalated ? 1 : 0,
        total_latency_ms: totalLatencyMs,
        answer_excerpt: result.answer.slice(0, 300),
        status: classifyModelUsed === 'fallback_general' ? 'classifier_fallback' : 'ok',
      }).catch(() => undefined);
    });
  }

  return result;
}
