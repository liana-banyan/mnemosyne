// answer_coroner.ts -- BP138 Yoke Phase 1: per-question benchmark answer autopsy loop.
//
// WHY THIS FILE EXISTS: the existing operational Coroner Scribe (librarian-mcp/coroner/)
// tracks system-level failure signals. This module is a SEPARATE instrument for
// per-question MMLU-Pro benchmark answer autopsies. It does NOT write into the operational
// Coroner. Governed by BR-007: empirical ground truth only, no circular validation.
//
// DATA SOURCE: Supabase relay_route_replies.answer_json + relay_routes.payload_json (Bishop
// blood BP087). correct_answer_letter lives in payload_json.correct_answer_letter (confirmed
// via source read of wan_dispatch.ts:511 -- the asker writes it there; confirmed the
// responder never reads it in startRelayRoutePoll, so it is never circularly available to
// the answering peer).
//
// HEADLINE NUMBERS (never conflate):
//   correctable-wrongs: authority-empty + matched-wrong-option + plow-discordant + etc. (drive to 0)
//   honest-abstains:    atom genuinely unverifiable -- CORRECT behavior, NOT a failure
//
// Rule 66: version, never overwrite -- this is a new file, no supersede needed.

import { getAnonKey, getSupabaseUrl } from '../shared/anon_key';

// ─── Classification enums ───────────────────────────────────────────────────

export type WrongClass =
  | 'authority-empty'       // authority was assigned (answered_by includes browser), resultFound=no
  | 'matched-wrong-option'  // browser authority ran but mapped to wrong MC choice
  | 'plow-discordant'       // no voter majority (concordance=DISCORDANT), fell to abstain or guessed
  | 'substrate-gap'         // swarm ran, zero candidates survived miner+furnace
  | 'compute-wrong'         // compute sidecar ran and returned the wrong letter
  | 'bad-decomposition';    // [Phase 2] decompose engine generated wrong foundation queries

export type AbstainClass =
  | 'honest-abstain'            // atom genuinely unverifiable -- CORRECT, leave as-is
  | 'over-conservative-abstain'; // had the means but bailed (relevance gate over-fired, etc.)

export type RightClass =
  | 'substrate-hit'   // plow voters had relevant substrate candidates
  | 'sourced-fact'    // browser authority confirmed and the agreement produced a correct answer
  | 'plow-majority'   // standard CONCORDANT plow with no substrate or browser hit
  | 'compute';        // compute sidecar was correct

export type AnswerClass = WrongClass | AbstainClass | RightClass;

// ─── Record / roundup types ─────────────────────────────────────────────────

export interface CoronerRecord {
  routeId: string;
  peerId: string;
  sessionId: string | null;
  domain: string;
  question: string;
  sealedLetter: string | null;
  answeredLetter: string | null;
  outcome: 'right' | 'wrong' | 'abstain';
  correctable: boolean;
  answerClass: AnswerClass;
  traceSummary: string;
  abstainReason: string | null;
  answeredBy: string | null;
  browserAuthorityCorroboration: string | null;
  concordance: string | null;
  candidatesPostFurnace: number | null;
  processingMs: number | null;
}

export interface FixItem {
  answerClass: string;
  count: number;
  exemplars: CoronerRecord[];
}

export interface CoronerRoundup {
  runAt: string;
  totalRecords: number;
  correctableWrongs: number;  // HEADLINE 1 -- drive to 0
  honestAbstains: number;     // HEADLINE 2 -- leave honest (not a failure)
  wrongTotal: number;
  rightTotal: number;
  abstainTotal: number;
  byClass: Record<string, CoronerRecord[]>;
  prioritizedFixList: FixItem[];  // correctable classes only, sorted by count desc
}

// ─── Raw Supabase row shapes ─────────────────────────────────────────────────

interface RelayRouteRow {
  id: string;
  session_id: string | null;
  payload_json: Record<string, unknown> | null;
  status: string;
}

interface RelayRouteReplyRow {
  id: string;
  route_id: string;
  peer_id: string;
  answer_json: Record<string, unknown> | null;
  processing_ms: number | null;
}

// ─── Classification logic ────────────────────────────────────────────────────

function classifyRecord(
  route: RelayRouteRow,
  reply: RelayRouteReplyRow,
): CoronerRecord {
  const payload = route.payload_json ?? {};
  const answerJson = reply.answer_json ?? {};

  const domain = typeof payload.domain === 'string' ? payload.domain : 'unknown';
  const question = typeof payload.question_text === 'string'
    ? payload.question_text
    : typeof payload.prompt === 'string' ? payload.prompt.slice(0, 200) : '';
  const sealedLetter = typeof payload.correct_answer_letter === 'string'
    ? payload.correct_answer_letter.toUpperCase().trim()
    : null;

  const answeredLetter = typeof answerJson.answer === 'string'
    ? (answerJson.answer === 'ABSTAIN' ? null : answerJson.answer.toUpperCase().trim())
    : null;

  const isAbstain = answerJson.answer === 'ABSTAIN' || answeredLetter === null;
  const isCorrect = !isAbstain && sealedLetter !== null && answeredLetter === sealedLetter;

  const plowTrace = (answerJson.plow_trace ?? {}) as Record<string, unknown>;
  const abstainReason = typeof answerJson.abstain_reason === 'string' ? answerJson.abstain_reason : null;
  const answeredBy = typeof answerJson.answered_by === 'string' ? answerJson.answered_by : null;
  const browserCorroboration = typeof plowTrace.browserAuthorityCorroboration === 'string'
    ? plowTrace.browserAuthorityCorroboration
    : null;
  const concordance = typeof plowTrace.concordance === 'string' ? plowTrace.concordance : null;
  const candidatesPostFurnace = typeof plowTrace.candidatesPostFurnace === 'number'
    ? plowTrace.candidatesPostFurnace
    : null;
  const traceSummary = typeof plowTrace.traceSummary === 'string'
    ? plowTrace.traceSummary
    : (typeof plowTrace.trace_summary === 'string' ? plowTrace.trace_summary : '');

  let outcome: 'right' | 'wrong' | 'abstain';
  let correctable: boolean;
  let answerClass: AnswerClass;

  if (isAbstain) {
    outcome = 'abstain';
    // Determine honest vs over-conservative:
    // Honest: atom was genuinely unverifiable (abstain_reason signals a real limit)
    // Over-conservative: we had the means but our heuristics bailed
    const overConservativeReasons = new Set([
      'plow_discordant_no_majority',
      'council_did_not_converge',
      'model_empty_response',
      'max_iterations_reached',
    ]);
    const genuineReasons = new Set([
      'plow_error',
      'relevance_gate_abstain',
      'compute_fallthrough_abstain',
    ]);
    if (abstainReason && overConservativeReasons.has(abstainReason)) {
      answerClass = 'over-conservative-abstain';
      correctable = true;
    } else if (abstainReason && genuineReasons.has(abstainReason)) {
      answerClass = 'honest-abstain';
      correctable = false;
    } else {
      // Default: if relev gate fired or browser returned nothing -> honest
      // If discordant -> over-conservative
      const hasRelevanceAbstain = traceSummary.includes('relevanceGateAbstain=true');
      const hasComputeFallthrough = traceSummary.includes('computeFallthroughAbstain=true');
      if (hasRelevanceAbstain || hasComputeFallthrough) {
        answerClass = 'over-conservative-abstain';
        correctable = true;
      } else {
        answerClass = 'honest-abstain';
        correctable = false;
      }
    }
  } else if (isCorrect) {
    outcome = 'right';
    correctable = false;
    // Determine what carried it
    if (browserCorroboration && browserCorroboration !== 'none') {
      answerClass = 'sourced-fact';
    } else if (plowTrace.computeSidecar !== undefined && plowTrace.computeSidecar !== null) {
      answerClass = 'compute';
    } else if (candidatesPostFurnace !== null && candidatesPostFurnace > 0) {
      answerClass = 'substrate-hit';
    } else {
      answerClass = 'plow-majority';
    }
  } else {
    // WRONG
    outcome = 'wrong';
    correctable = true;

    // Determine the failure class
    const wasDecompose = traceSummary.includes('strategy=decompose-and-eliminate');
    if (wasDecompose) {
      answerClass = 'bad-decomposition';
    } else if (plowTrace.computeSidecar !== undefined && plowTrace.computeSidecar !== null) {
      answerClass = 'compute-wrong';
    } else if (browserCorroboration !== null && browserCorroboration !== 'none') {
      // Browser ran and matched something, but it was wrong
      answerClass = 'matched-wrong-option';
    } else if (browserCorroboration === 'none' || (traceSummary.includes('browserAuthority') && !browserCorroboration)) {
      // Browser authority was attempted but returned nothing
      answerClass = 'authority-empty';
    } else if (concordance === 'DISCORDANT') {
      answerClass = 'plow-discordant';
    } else if (candidatesPostFurnace !== null && candidatesPostFurnace === 0) {
      answerClass = 'substrate-gap';
    } else {
      // Default wrong class: plow ran but chose the wrong letter (voters disagreed less loudly)
      answerClass = 'plow-discordant';
    }
  }

  return {
    routeId: route.id,
    peerId: reply.peer_id,
    sessionId: route.session_id,
    domain,
    question: question.slice(0, 300),
    sealedLetter,
    answeredLetter,
    outcome,
    correctable,
    answerClass,
    traceSummary: traceSummary.slice(0, 500),
    abstainReason,
    answeredBy,
    browserAuthorityCorroboration: browserCorroboration,
    concordance,
    candidatesPostFurnace,
    processingMs: reply.processing_ms ?? null,
  };
}

// ─── Main coroner function ───────────────────────────────────────────────────

export async function runAnswerCoroner(opts: {
  supabaseUrl?: string;
  supabaseKey?: string;
  sessionFilter?: string;   // filter to a specific session_id prefix
  limit?: number;           // max rows to analyze (default 500)
  onProgress?: (msg: string) => void;
}): Promise<CoronerRoundup> {
  const supabaseUrl = opts.supabaseUrl ?? getSupabaseUrl();
  const supabaseKey = opts.supabaseKey ?? getAnonKey();
  const limit = opts.limit ?? 500;
  const log = (msg: string) => {
    console.log(`[coroner] ${msg}`);
    opts.onProgress?.(msg);
  };

  const headers: Record<string, string> = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
  };

  log('fetching relay_routes (answered)...');

  // Fetch answered relay_routes, filtered by session if requested
  let routesUrl = `${supabaseUrl}/rest/v1/relay_routes?status=eq.answered&select=id,session_id,payload_json&limit=${limit}&order=created_at.desc`;
  if (opts.sessionFilter) {
    routesUrl += `&session_id=like.${encodeURIComponent(opts.sessionFilter + '*')}`;
  }

  const routesRes = await fetch(routesUrl, { headers, signal: AbortSignal.timeout(20_000) });
  if (!routesRes.ok) {
    const txt = await routesRes.text().catch(() => '');
    throw new Error(`relay_routes fetch failed: HTTP ${routesRes.status} ${txt.slice(0, 200)}`);
  }
  const routes = (await routesRes.json()) as RelayRouteRow[];
  log(`fetched ${routes.length} routes`);

  if (routes.length === 0) {
    return {
      runAt: new Date().toISOString(),
      totalRecords: 0,
      correctableWrongs: 0,
      honestAbstains: 0,
      wrongTotal: 0,
      rightTotal: 0,
      abstainTotal: 0,
      byClass: {},
      prioritizedFixList: [],
    };
  }

  // Fetch replies for all these routes in batches (Supabase IN clause)
  const routeIds = routes.map((r) => r.id);
  const batchSize = 50;
  const allReplies: RelayRouteReplyRow[] = [];

  for (let i = 0; i < routeIds.length; i += batchSize) {
    const batch = routeIds.slice(i, i + batchSize);
    const inClause = batch.map((id) => encodeURIComponent(id)).join(',');
    const repliesUrl = `${supabaseUrl}/rest/v1/relay_route_replies?route_id=in.(${batch.join(',')})&select=id,route_id,peer_id,answer_json,processing_ms`;
    const repliesRes = await fetch(repliesUrl, { headers, signal: AbortSignal.timeout(20_000) });
    if (repliesRes.ok) {
      const batch_replies = (await repliesRes.json()) as RelayRouteReplyRow[];
      allReplies.push(...batch_replies);
    } else {
      log(`WARN: replies batch ${i}-${i + batchSize} fetch failed: HTTP ${repliesRes.status}`);
    }
  }

  log(`fetched ${allReplies.length} replies`);

  // Index routes by id for fast lookup
  const routeById = new Map<string, RelayRouteRow>(routes.map((r) => [r.id, r]));

  // Classify each reply
  const records: CoronerRecord[] = [];
  for (const reply of allReplies) {
    const route = routeById.get(reply.route_id);
    if (!route) continue;
    // Skip routes with no correct_answer_letter (not MMLU-Pro benchmark rows)
    if (!route.payload_json?.correct_answer_letter) continue;
    try {
      records.push(classifyRecord(route, reply));
    } catch (err) {
      log(`WARN: classify failed for route ${reply.route_id.slice(0, 8)}: ${err}`);
    }
  }

  log(`classified ${records.length} records`);

  // Build class buckets
  const byClass: Record<string, CoronerRecord[]> = {};
  let correctableWrongs = 0;
  let honestAbstains = 0;
  let wrongTotal = 0;
  let rightTotal = 0;
  let abstainTotal = 0;

  for (const rec of records) {
    const cls = rec.answerClass;
    if (!byClass[cls]) byClass[cls] = [];
    byClass[cls].push(rec);

    if (rec.outcome === 'wrong') {
      wrongTotal++;
      if (rec.correctable) correctableWrongs++;
    } else if (rec.outcome === 'right') {
      rightTotal++;
    } else {
      abstainTotal++;
      if (!rec.correctable) honestAbstains++;
    }
  }

  // Prioritized fix list: only correctable classes, sorted by count desc
  const correctableClasses: WrongClass[] = [
    'authority-empty',
    'matched-wrong-option',
    'plow-discordant',
    'substrate-gap',
    'compute-wrong',
    'bad-decomposition',
  ];
  const overConservativeClass: AbstainClass = 'over-conservative-abstain';

  const prioritizedFixList: FixItem[] = [
    ...correctableClasses,
    overConservativeClass,
  ]
    .map((cls) => ({
      answerClass: cls,
      count: byClass[cls]?.length ?? 0,
      exemplars: (byClass[cls] ?? []).slice(0, 3),
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);

  const roundup: CoronerRoundup = {
    runAt: new Date().toISOString(),
    totalRecords: records.length,
    correctableWrongs,
    honestAbstains,
    wrongTotal,
    rightTotal,
    abstainTotal,
    byClass,
    prioritizedFixList,
  };

  // Print a human-readable summary to the terminal (satisfies Phase 4 "live visible" requirement)
  log('');
  log('╔══════════════════════════════════════════════════════════════');
  log('║  ANSWER CORONER ROUNDUP');
  log(`║  ${records.length} records  |  ${routes.length} routes  |  ${allReplies.length} replies`);
  log('╠══════════════════════════════════════════════════════════════');
  log(`║  RIGHT:   ${rightTotal.toString().padStart(4)}   (${((rightTotal / records.length) * 100).toFixed(1)}%)`);
  log(`║  WRONG:   ${wrongTotal.toString().padStart(4)}   (${((wrongTotal / records.length) * 100).toFixed(1)}%)`);
  log(`║  ABSTAIN: ${abstainTotal.toString().padStart(4)}   (${((abstainTotal / records.length) * 100).toFixed(1)}%)`);
  log('╠══════════════════════════════════════════════════════════════');
  log(`║  HEADLINE 1 -- CORRECTABLE WRONGS: ${correctableWrongs}`);
  log(`║  HEADLINE 2 -- HONEST ABSTAINS:    ${honestAbstains}  (leave honest -- not a failure)`);
  log('╠══════════════════════════════════════════════════════════════');
  log('║  PRIORITIZED FIX LIST (correctable classes):');
  for (const item of prioritizedFixList) {
    log(`║    [${item.count.toString().padStart(3)}] ${item.answerClass}`);
    for (const ex of item.exemplars) {
      log(`║        exemplar: q="${ex.question.slice(0, 60)}..." sealed=${ex.sealedLetter} got=${ex.answeredLetter ?? 'ABSTAIN'}`);
    }
  }
  log('╚══════════════════════════════════════════════════════════════');

  return roundup;
}
