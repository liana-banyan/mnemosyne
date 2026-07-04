// minor_star_chamber.ts -- Mountain 1 · I-E · Minor Star Chamber Core Dispatcher
// KNIGHT MARATHON 4 · BP089 · BLACK MAMBA
//
// Canon refs:
//   canon_star_chamber_multi_agent_consensus_verification_product_bp086
//   canon_minor_council_star_chamber_free_local_multi_model_consensus_requires_mountain_1_substrate_priming_bp089
//
// INHERENT to Dr. M's core dispatch architecture. Not a bolt-on. Not a separate Mountain.
//
// Fans a task to N local-model instances in parallel (default 3-5 per Court Package),
// primes each with SubstrateContextBundle, scores convergence, and escalates to
// flagship Sonnet 4.6 ONLY when variance exceeds the package threshold.
//
// Escalation threshold per canon: 15% default for composer_council. Varies by Package.
// Free local models bear full load until divergence is detected.
//
// §3 Truth-Always: Minor Star Chamber is NOT operational in v0.5.7.
// Mountain 1 makes it operational. The paid flagship Star Chamber (SCaaS at Cost+20%
// 9-track · Beyond Colossus engine) is a distinct product
// (canon_star_chamber_multi_agent_consensus_verification_product_bp086).
// Minor Council is the free-local substrate-primed version used internally by Dr. M.

import type { SubstrateContextBundle } from './substrate_reader';
import type { CCI, CCIResponse } from './brain_swap';
import { ClaudeBrainAdapter } from './brain_swap';
import { createCourtPackageLibrary } from './court_packages';
import type { CourtPackage, CouncilPackageName } from './court_packages';
import { createBrainFromMember } from './brain_swap';

// ─── Types ────────────────────────────────────────────────────────────────────────

export interface MinorCouncilOptions {
  substrate_context: SubstrateContextBundle;
  timeout_ms?: number;
  min_members?: number;
}

export interface MemberAnswer {
  brain_id: string;
  answer: string;
  tokens_used: number;
  latency_ms: number;
}

export interface ConvergenceScore {
  variance: number;
  aggregate: string;
  method: 'majority' | 'overlap' | 'semantic';
}

export interface AdjudicationResult {
  answer: string;
  brain_id: string;
  council_answers_provided: number;
  latency_ms: number;
  tokens_used: number;
}

export interface MinorCouncilResult {
  result: string;
  variance: number;
  escalated: boolean;
  member_answers: MemberAnswer[];
  council_package: string;
  members_fired: number;
  latency_ms: number;
}

// ─── Module-level package cache (lazy, cached after first load) ───────────────────

const _library = createCourtPackageLibrary();

// ─── Exported: loadCouncilPackage ─────────────────────────────────────────────────

/**
 * Lazy-loads a Court Package on first reference · cached in memory after first load.
 */
export async function loadCouncilPackage(
  packageName: CouncilPackageName
): Promise<CourtPackage> {
  return _library.get(packageName);
}

// ─── scoreConvergence ────────────────────────────────────────────────────────────

/**
 * Scores convergence across N member answers.
 * Returns variance 0.0-1.0 and aggregate consensus text.
 *
 * Method: majority (most-common answer) for short/identical-ish answers.
 * Falls back to overlap (Jaccard word similarity) for longer answers.
 */
export function scoreConvergence(answers: MemberAnswer[]): ConvergenceScore {
  if (answers.length === 0) {
    return { variance: 1.0, aggregate: '', method: 'majority' };
  }
  if (answers.length === 1) {
    return { variance: 0.0, aggregate: answers[0].answer, method: 'majority' };
  }

  const texts = answers.map((a) => a.answer.trim());

  // ─── Majority vote on normalized text ──────────────────────────────────────────

  const normalized = texts.map((t) => t.toLowerCase().replace(/\s+/g, ' ').trim());
  const freq = new Map<string, { count: number; original: string }>();
  for (let i = 0; i < normalized.length; i++) {
    const k = normalized[i];
    const existing = freq.get(k);
    if (existing) {
      existing.count++;
    } else {
      freq.set(k, { count: 1, original: texts[i] });
    }
  }

  // If there's a clear majority (>1 agreement on same text), use it
  const sorted = [...freq.entries()].sort((a, b) => b[1].count - a[1].count);
  const top = sorted[0];
  const uniqueCount = freq.size;

  if (top[1].count > 1 || uniqueCount === 1) {
    // Majority agreement found
    const variance = (uniqueCount - 1) / Math.max(answers.length - 1, 1);
    return {
      variance: Math.min(1.0, variance),
      aggregate: top[1].original,
      method: 'majority',
    };
  }

  // ─── All answers unique: use word-overlap Jaccard to find most-central answer ──

  function tokenize(s: string): Set<string> {
    return new Set(s.toLowerCase().split(/\W+/).filter((t) => t.length > 2));
  }

  function jaccard(a: Set<string>, b: Set<string>): number {
    let intersection = 0;
    for (const w of a) if (b.has(w)) intersection++;
    const union = a.size + b.size - intersection;
    return union === 0 ? 1 : intersection / union;
  }

  const tokenSets = texts.map(tokenize);

  // Find the answer with highest average overlap to all others (most central)
  let bestIdx = 0;
  let bestAvgOverlap = -1;
  for (let i = 0; i < tokenSets.length; i++) {
    let totalOverlap = 0;
    for (let j = 0; j < tokenSets.length; j++) {
      if (i !== j) totalOverlap += jaccard(tokenSets[i], tokenSets[j]);
    }
    const avgOverlap = totalOverlap / (tokenSets.length - 1);
    if (avgOverlap > bestAvgOverlap) {
      bestAvgOverlap = avgOverlap;
      bestIdx = i;
    }
  }

  // Variance: 1 - average pairwise Jaccard similarity
  let totalPairOverlap = 0;
  let pairCount = 0;
  for (let i = 0; i < tokenSets.length; i++) {
    for (let j = i + 1; j < tokenSets.length; j++) {
      totalPairOverlap += jaccard(tokenSets[i], tokenSets[j]);
      pairCount++;
    }
  }
  const avgPairOverlap = pairCount > 0 ? totalPairOverlap / pairCount : 0;
  const variance = Math.max(0, Math.min(1.0, 1 - avgPairOverlap));

  return {
    variance,
    aggregate: texts[bestIdx],
    method: 'overlap',
  };
}

// ─── escalateToFlagship ───────────────────────────────────────────────────────────

/**
 * Fires ONLY when variance > package threshold.
 * Passes all member answers to flagship (claude-sonnet-4-6) as Council context.
 * Flagship adjudicates and returns a definitive answer.
 */
export async function escalateToFlagship(
  question: string,
  councilAnswers: MemberAnswer[],
  substrateContext: SubstrateContextBundle
): Promise<AdjudicationResult> {
  const t0 = Date.now();
  const flagship = new ClaudeBrainAdapter();

  const councilSummary = councilAnswers
    .map((a, i) => `Council Member ${i + 1} (${a.brain_id}):\n${a.answer}`)
    .join('\n\n---\n\n');

  const adjudicationPrompt = [
    `A Minor Council of ${councilAnswers.length} local models was asked:`,
    `"${question}"`,
    '',
    'The council diverged. Their answers:',
    '',
    councilSummary,
    '',
    'As the flagship adjudicator, review the council answers and provide the definitive answer.',
    'Be concise and decisive. Synthesize the best elements from the council or override if clearly wrong.',
  ].join('\n');

  const response = await flagship.reason(adjudicationPrompt, substrateContext);

  return {
    answer: response.content,
    brain_id: response.brain_id,
    council_answers_provided: councilAnswers.length,
    latency_ms: Date.now() - t0,
    tokens_used: response.tokens_used,
  };
}

// ─── minorCouncil (PRIMARY entry point) ──────────────────────────────────────────

/**
 * Routes through Court Package, fans out to N local-model instances in parallel,
 * primes each with SubstrateContextBundle, scores convergence, escalates if needed.
 */
export async function minorCouncil(
  question: string,
  councilType: CouncilPackageName,
  options: MinorCouncilOptions
): Promise<MinorCouncilResult> {
  const t0 = Date.now();
  const timeout = options.timeout_ms ?? 90000;
  const minMembers = options.min_members ?? 2;

  const pkg = await loadCouncilPackage(councilType);
  const brains: CCI[] = pkg.members.map(createBrainFromMember);

  // ─── Fan-out to N members in parallel with timeout ────────────────────────────

  const memberPromises = brains.map(async (brain): Promise<MemberAnswer> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      const response: CCIResponse = await brain.reason(question, options.substrate_context);
      return {
        brain_id: response.brain_id,
        answer: response.content,
        tokens_used: response.tokens_used,
        latency_ms: response.latency_ms,
      };
    } catch (err) {
      return {
        brain_id: brain.brain_id,
        answer: `[timeout or error: ${err instanceof Error ? err.message : String(err)}]`,
        tokens_used: 0,
        latency_ms: timeout,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  });

  const settled = await Promise.allSettled(memberPromises);
  const memberAnswers: MemberAnswer[] = settled
    .map((r) => r.status === 'fulfilled' ? r.value : null)
    .filter((r): r is MemberAnswer => r !== null);

  // ─── Check minimum member requirement ────────────────────────────────────────

  if (memberAnswers.length < minMembers) {
    return {
      result: memberAnswers[0]?.answer ?? '[minor council: insufficient members responded]',
      variance: 1.0,
      escalated: false,
      member_answers: memberAnswers,
      council_package: pkg.name,
      members_fired: memberAnswers.length,
      latency_ms: Date.now() - t0,
    };
  }

  // ─── Score convergence ────────────────────────────────────────────────────────

  const convergence = scoreConvergence(memberAnswers);

  // ─── Escalate if variance exceeds threshold ──────────────────────────────────

  if (convergence.variance > pkg.variance_threshold) {
    const adjudication = await escalateToFlagship(
      question,
      memberAnswers,
      options.substrate_context
    );
    return {
      result: adjudication.answer,
      variance: convergence.variance,
      escalated: true,
      member_answers: memberAnswers,
      council_package: pkg.name,
      members_fired: memberAnswers.length,
      latency_ms: Date.now() - t0,
    };
  }

  return {
    result: convergence.aggregate,
    variance: convergence.variance,
    escalated: false,
    member_answers: memberAnswers,
    council_package: pkg.name,
    members_fired: memberAnswers.length,
    latency_ms: Date.now() - t0,
  };
}
