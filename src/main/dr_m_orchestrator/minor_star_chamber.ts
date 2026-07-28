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

// ─── BP137 Yoke v2b Stage E: distributed Star Chamber (genuine multi-authority) ──────────────
//
// R-MECHANISM-VERIFY: this file was, until this Yoke, imported NOWHERE in src/ (confirmed by
// direct grep) -- the "council-with-escalation" logic above (minorCouncil/escalateToFlagship)
// is real but is MODEL-VOTING (N local Ollama instances + a flagship Claude adjudicator via
// brain_swap.ts's CCI abstraction) -- exactly the mechanism the Stage E spec says already
// FAILED and must NOT be reintroduced for the distributed don't-know case. So Stage E does NOT
// call minorCouncil()/escalateToFlagship() above; it reuses ONLY scoreConvergence() (pure,
// authority-agnostic convergence math -- it has never cared whether a MemberAnswer came from a
// model or a web search) for a NEW kind of council whose "members" are independent real-world
// AUTHORITIES (Google via the user's own browser session, Perplexity via the same, a
// deterministic compute/Wolfram solver) -- adversarial multi-authority adjudication, not
// multi-model voting. This is what makes minor_star_chamber.ts a genuine REAL HANDLER for the
// Stage E flow (its adjudication core is now imported and exercised) without resurrecting the
// failed model-voting pattern.
//
// Caller: src/main/plow/star_chamber_dispatch.ts's runStageEDistributedStarChamber(), invoked
// ONLY from plow_mc_answerer.ts's Stage D exhaustion call site (see that file's
// `researchArmStarChamber` block) -- i.e. ONLY on a FINAL don't-know, never on a confident
// answer. See that dispatch file for the actual per-authority fan-out (Google/Perplexity/
// Wolfram); this module supplies only the adjudication math + result shape.

/** One independent real-world authority's answer to the Star Chamber's question. Distinct from
 *  `MemberAnswer` above (which is model-council vocabulary: `brain_id`) -- `authority` names a
 *  genuinely different information source (e.g. 'user_google', 'user_perplexity',
 *  'wolfram_compute', 'local_arithmetic'), never a model identifier. */
export interface AuthorityAnswer {
  authority: string;
  /** Distilled fact / computed value as text. Empty string means this authority was queried but
   *  produced nothing usable -- see `verified`. */
  answer: string;
  sourceUrl?: string;
  /** True only when this authority genuinely produced a checkable, non-fabricated result
   *  (mirrors the "never fake a result" honesty firewall already enforced upstream by
   *  browser_authority_types.ts's distillExtraction() and compute_sidecar.ts's solvers -- this
   *  field is never set true here independently of those upstream checks). */
  verified: boolean;
  latency_ms: number;
}

/** Result of adjudicating N independent AuthorityAnswers. `fired: true` always (this type is
 *  only ever constructed on the Stage E path, which by definition means the distributed Star
 *  Chamber DID fire -- see plow_mc_answerer.ts's gate for the "only on a final don't-know"
 *  guarantee upstream of this function). */
export interface DistributedStarChamberResult {
  fired: true;
  /** Every authority slot that was DISPATCHED, even ones that returned nothing usable -- so a
   *  caller/report can always say "3 peers dispatched: google, perplexity, wolfram" regardless
   *  of how many actually answered. */
  peerAuthorities: string[];
  /** Subset of peerAuthorities that returned a verified, non-empty answer. */
  answered: AuthorityAnswer[];
  variance: number;
  /** Agreement score, 0-1 (== 1 - variance). Named to match the `h_score` column on
   *  star_chamber_mesh_fires (Bishop-gadgeted schema, BP137). */
  hScore: number;
  consensusReached: boolean;
  /** The served answer -- populated ONLY when consensusReached is true. Never populated on a
   *  disagreement (honesty firewall: never fabricate a single confident answer when independent
   *  authorities conflict). */
  answer: string | null;
  /** Honest "sources say X vs Y" verdict, populated ONLY when consensusReached is false (or zero
   *  authorities answered at all). Null when consensus was reached. */
  disagreementSummary: string | null;
}

/** Maximum agreement-variance (0-1 scale, same units scoreConvergence() already returns) for the
 *  distributed authorities to be treated as having reached "authoritative agreement." Looser
 *  than minorCouncil's model-council thresholds on purpose: independent real-world sources
 *  (a Google snippet vs. a Perplexity snippet vs. a computed number) are never going to be
 *  byte-identical the way two temperature-sampled local model completions sometimes are --
 *  requiring near-zero variance here would make consensus nearly unreachable and push every
 *  distributed fire into a disagreement verdict regardless of whether the sources actually
 *  agree in substance. 0.35 was chosen to admit "same fact, different phrasing" while still
 *  rejecting genuinely conflicting numeric/factual answers (see scoreConvergence's Jaccard
 *  overlap for prose, exact-value comparison is left to the caller for numeric facts).
 */
export const STAR_CHAMBER_CONSENSUS_VARIANCE_THRESHOLD = 0.35;

/**
 * Adjudicates independent per-authority answers to a single don't-know question. Pure function
 * (no I/O) -- the actual per-authority network/browser/compute calls happen in the caller
 * (star_chamber_dispatch.ts); this function only decides what the RESULTS mean. Reuses
 * scoreConvergence() above verbatim (never duplicated) -- the only difference from the
 * model-council path is the SHAPE of the input (AuthorityAnswer, mapped to MemberAnswer's shape
 * with `brain_id` repurposed to carry the authority name) and the threshold used to call it
 * "agreement" (STAR_CHAMBER_CONSENSUS_VARIANCE_THRESHOLD, above, vs. each Court Package's own
 * variance_threshold for the model council).
 *
 * Honesty firewall: if zero authorities answered, or if they disagree past the threshold, this
 * NEVER returns a non-null `answer` -- it returns a null answer plus a `disagreementSummary`
 * naming every authority's own (non-fabricated) answer, so the caller can honestly report
 * "sources say X vs Y" instead of forcing a guess.
 */
export function adjudicateDistributedAuthorities(
  answers: AuthorityAnswer[],
): DistributedStarChamberResult {
  const peerAuthorities = answers.map((a) => a.authority);
  const respondingAnswers = answers.filter((a) => a.verified && a.answer.trim().length > 0);

  if (respondingAnswers.length === 0) {
    return {
      fired: true,
      peerAuthorities,
      answered: [],
      variance: 1.0,
      hScore: 0,
      consensusReached: false,
      answer: null,
      disagreementSummary:
        'No authority returned a usable result (honest abstain -- never fabricated). ' +
        `Dispatched: ${peerAuthorities.join(', ')}.`,
    };
  }

  if (respondingAnswers.length === 1) {
    // A single independent authority is corroboration of exactly one source -- genuinely
    // different from N>=2 authorities AGREEING. Reported as consensus (variance 0, nothing to
    // disagree with) but the caller's receipt should show answered.length === 1 so this is never
    // misread as multi-authority agreement.
    const only = respondingAnswers[0];
    return {
      fired: true,
      peerAuthorities,
      answered: respondingAnswers,
      variance: 0,
      hScore: 1,
      consensusReached: true,
      answer: only.answer,
      disagreementSummary: null,
    };
  }

  const memberShaped: MemberAnswer[] = respondingAnswers.map((a) => ({
    brain_id: a.authority,
    answer: a.answer,
    tokens_used: 0,
    latency_ms: a.latency_ms,
  }));
  const convergence = scoreConvergence(memberShaped);
  const hScore = Math.max(0, Math.min(1, 1 - convergence.variance));
  const consensusReached = convergence.variance <= STAR_CHAMBER_CONSENSUS_VARIANCE_THRESHOLD;

  if (consensusReached) {
    return {
      fired: true,
      peerAuthorities,
      answered: respondingAnswers,
      variance: convergence.variance,
      hScore,
      consensusReached: true,
      answer: convergence.aggregate,
      disagreementSummary: null,
    };
  }

  const summary =
    'sources disagree: ' +
    respondingAnswers
      .map((a) => `${a.authority} says "${a.answer.slice(0, 100)}"`)
      .join(' vs ');
  return {
    fired: true,
    peerAuthorities,
    answered: respondingAnswers,
    variance: convergence.variance,
    hScore,
    consensusReached: false,
    answer: null,
    disagreementSummary: summary,
  };
}
