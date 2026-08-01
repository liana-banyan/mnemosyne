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
//
// BP139 Founder Yoke: split into a shared classifyCore(...) plus two thin adapters --
// classifyRecord (Supabase relay_routes/relay_route_replies rows, the WAN-history path) and
// classifyLocalOutcome (the renderer's own in-memory/persisted QuestionOutcome[] from the run
// the Founder just did). One classifier, no drift between "WAN history autopsy" and
// "just-ran benchmark autopsy" -- see runAnswerCoronerOnLocalOutcomes below.

function classifyCore(params: {
  routeId: string;
  peerId: string;
  sessionId: string | null;
  domain: string;
  question: string;
  sealedLetter: string | null;
  answeredLetter: string | null;
  isAbstain: boolean;
  isCorrect: boolean;
  plowTrace: Record<string, unknown>;
  abstainReason: string | null;
  answeredBy: string | null;
  processingMs: number | null;
}): CoronerRecord {
  const {
    routeId, peerId, sessionId, domain, question, sealedLetter, answeredLetter,
    isAbstain, isCorrect, plowTrace, abstainReason, answeredBy, processingMs,
  } = params;

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
    routeId,
    peerId,
    sessionId,
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
    processingMs,
  };
}

/** Supabase relay_routes/relay_route_replies row pair -> CoronerRecord (WAN-history path). */
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

  return classifyCore({
    routeId: route.id,
    peerId: reply.peer_id,
    sessionId: route.session_id,
    domain,
    question,
    sealedLetter,
    answeredLetter,
    isAbstain,
    isCorrect,
    plowTrace,
    abstainReason,
    answeredBy,
    processingMs: reply.processing_ms ?? null,
  });
}

// ─── Local-run classification (BP139 Founder Yoke) ───────────────────────────
//
// Classifies the CURRENT benchmark run's own QuestionOutcome[] -- the data already sitting in
// the renderer's memory/localStorage from the run the Founder just did -- instead of requiring
// a round-trip through Supabase relay_routes/relay_route_replies (the 500-row WAN dump).
// Reuses classifyCore verbatim, so a "current run" autopsy and a "WAN history" autopsy can never
// silently drift into two different definitions of correctable-wrong / honest-abstain.

export interface LocalCoronerOutcomeInput {
  question_id: number;
  question: string;
  category: string;
  correctLetter: string;
  parsedLetter: string | null;
  isCorrect: boolean;
  isAbstain?: boolean;
  answeredBy?: string | null;
  peerId?: string | null;
  machineLabel?: string | null;
  latencyMs?: number | null;
  plowTrace?: Record<string, unknown> | null;
}

/** One QuestionOutcome (renderer shape, OneClickMeshTestPanel.tsx) -> CoronerRecord. */
export function classifyLocalOutcome(o: LocalCoronerOutcomeInput): CoronerRecord {
  const sealedLetter = o.correctLetter ? o.correctLetter.toUpperCase().trim() : null;
  const isAbstain = !!o.isAbstain || o.parsedLetter === null;
  const answeredLetter = isAbstain ? null : (o.parsedLetter ? o.parsedLetter.toUpperCase().trim() : null);
  const isCorrect = !isAbstain && sealedLetter !== null && answeredLetter === sealedLetter;

  return classifyCore({
    routeId: `local-${o.question_id}`,
    peerId: o.peerId ?? o.machineLabel ?? 'local',
    sessionId: null,
    domain: o.category || 'unknown',
    question: o.question,
    sealedLetter,
    answeredLetter,
    isAbstain,
    isCorrect,
    // No abstain_reason field exists on the local run's outcomes (only the WAN wire format
    // populates it) -- classifyCore's own traceSummary-pattern fallback (relevanceGateAbstain=
    // true / computeFallthroughAbstain=true) still classifies honest vs over-conservative
    // abstains correctly when plowTrace carries a traceSummary; a bare single-shot/minor_council
    // abstain with no plowTrace at all falls to the same "honest-abstain" default the WAN path
    // already uses for that case.
    plowTrace: (o.plowTrace ?? {}) as Record<string, unknown>,
    abstainReason: null,
    answeredBy: o.answeredBy ?? null,
    processingMs: o.latencyMs ?? null,
  });
}

// ─── RGBY fact-verdict taxonomy (BP140 Yoke: Eblet-Learning Substrate / Liana Cycle) ─────────
//
// The taxonomy itself (canon_eblet_fact_verdict_color_taxonomy_rgby_bp139) lives on
// VerifiedEbletEntry.factVerdict's own doc comment in mnem_eblet_store.ts -- restated here only
// as the one-line reminder each branch below cites:
//   G = right, R = wrong, B = undetermined, Y = unknowable, O = conflicting/unresolved.
//
// WHY CORONER TIME: factVerdict needs GROUND TRUTH, which only exists here (classifyCore has
// sealedLetter) -- runAuthorityEnsemble (plow_mc_answerer.ts) never sees the sealed letter and
// structurally cannot compute this itself. The full candidate set (winner AND losers) is
// threaded from there to here via CanonicalPlowMcResult.ensembleCandidates ->
// callCanonicalPlowMcAnswererForMeshTest's plowTrace.ensemble_candidates -> this file's
// LocalCoronerOutcomeInput.plowTrace -- see plow_mc_answerer.ts's own doc comments on that field
// for the full thread. Today only the local-run Coroner path (runAnswerCoronerOnLocalOutcomes)
// calls persistEnsembleCandidateFactVerdicts -- the WAN-history path (runAnswerCoroner /
// classifyRecord) does NOT, to avoid double-writing the same real answer's candidates once at
// "just ran" time and again on a later WAN autopsy of the same rows; see this Yoke's build
// report for that call and why it is left to Bishop to decide whether the WAN path should also
// persist (e.g. for rows that predate this Yoke and were never scored locally).

/** Minimal shape this module needs from an AuthorityEnsembleCandidate (plow_mc_answerer.ts) --
 *  duplicated rather than imported to avoid a cross-module type dependency for a plain-data
 *  shape that crosses an IPC boundary as untyped JSON by the time it reaches here (renderer ->
 *  preload -> index.ts -> this file). Structurally compatible with AuthorityEnsembleCandidate;
 *  any additional fields on the real type are simply ignored. */
export interface EnsembleCandidateForFactVerdict {
  authority: string;
  letter: string;
  reasoning: string;
  sourceUrl?: string;
  method?: string;
}

/** Defensive extraction of plowTrace.ensemble_candidates (see the thread-doc above) -- plowTrace
 *  is `Record<string, unknown>` because it crosses an IPC boundary as JSON, so this never trusts
 *  the shape blindly. Returns [] (never throws) on anything malformed, absent, or from a
 *  pre-BP140 receipt that never had this field at all. */
export function extractEnsembleCandidates(
  plowTrace: Record<string, unknown> | null | undefined,
): EnsembleCandidateForFactVerdict[] {
  const raw = plowTrace?.ensemble_candidates;
  if (!Array.isArray(raw)) return [];
  const out: EnsembleCandidateForFactVerdict[] = [];
  for (const item of raw) {
    if (
      item && typeof item === 'object' &&
      typeof (item as Record<string, unknown>).authority === 'string' &&
      typeof (item as Record<string, unknown>).letter === 'string' &&
      typeof (item as Record<string, unknown>).reasoning === 'string'
    ) {
      const c = item as Record<string, unknown>;
      out.push({
        authority: c.authority as string,
        letter: c.letter as string,
        reasoning: c.reasoning as string,
        sourceUrl: typeof c.sourceUrl === 'string' ? c.sourceUrl : undefined,
        method: typeof c.method === 'string' ? c.method : undefined,
      });
    }
  }
  return out;
}

/** Pure, unit-testable rule that maps one candidate's outcome to the RGBY letter. This is the
 *  ONE place the taxonomy's semantics live -- see the module header above for the verbatim
 *  4-line reminder and mnem_eblet_store.ts's VerifiedEbletEntry.factVerdict doc comment for the
 *  full canon definitions this must stay consistent with.
 *
 *  Precedence (checked in this order):
 *   1. `unanswerable` -> Y. No caller in this build sets this yet -- there is no existing signal
 *      in this codebase for "the question itself has no determinable fact of the matter" (as
 *      opposed to "our engine gave up", which is B below). Wired honestly for a future caller
 *      (e.g. a benchmark that flags a contested/no-consensus answer key) rather than fabricated
 *      from abstainReason strings that do not actually mean that.
 *   2. `candidateLetter === null` (this authority abstained / produced no parseable letter) or
 *      `sealedLetter === null` (no ground truth exists yet, "nobody has confirmed it") -> B.
 *   3. `candidateLetter === sealedLetter` -> G, unconditionally -- right is right even if the
 *      vote that produced it was contested.
 *   4. Otherwise this candidate is wrong vs ground truth. If `disagreement` is true (the
 *      ENSEMBLE's own corroboration for this question was an active, unresolved disagreement --
 *      AuthorityEnsembleOutcome.corroboration/CoronerRecord.browserAuthorityCorroboration ===
 *      'disagree' | 'adjudicated' -- a property of the vote, never derived by comparing letters
 *      after the fact), tag O instead of plain R: this candidate was on the losing side of a
 *      genuine authority conflict, a go-INVESTIGATE signal distinct from an ordinary lone-
 *      authority miss. Otherwise plain R. */
export function deriveFactVerdict(params: {
  candidateLetter: string | null;
  sealedLetter: string | null;
  disagreement?: boolean;
  unanswerable?: boolean;
}): 'G' | 'R' | 'B' | 'Y' | 'O' {
  if (params.unanswerable) return 'Y';

  const candidate = params.candidateLetter ? params.candidateLetter.toUpperCase().trim() : null;
  const sealed = params.sealedLetter ? params.sealedLetter.toUpperCase().trim() : null;

  if (candidate === null || candidate === '') return 'B';
  if (sealed === null || sealed === '') return 'B';

  if (candidate === sealed) return 'G';
  return params.disagreement ? 'O' : 'R';
}

/** Persists ONE factVerdict-tagged eblet per ensemble candidate (winner AND losers) for a single
 *  graded question -- the whole point per the Yoke's design intent: "keep the reasoning we paid
 *  for", so the Liana Cycle can learn methods from G, study R, and investigate O, not just the
 *  one letter that happened to win the vote. Each write is individually try/caught and non-
 *  fatal -- one bad candidate must never abort the rest of the batch or the caller's own scoring
 *  loop. Returns the count of eblets actually written (for caller bookkeeping/logging only).
 *
 *  Dynamic-imports writeVerifiedEblet (mnem_eblet_store.ts), the same cross-module convention
 *  plow_mc_answerer.ts already uses for its own main-process imports (e.g. '../index',
 *  '../ip_ledger/stamp_certify') -- keeps this module decoupled from the eblet-store subsystem
 *  at load time and avoids any import-cycle risk. */
export async function persistEnsembleCandidateFactVerdicts(params: {
  /** UNTRUNCATED question text -- deliberately NOT CoronerRecord.question, which classifyCore
   *  truncates to 300 chars for its own trace-record purposes; truncating here would corrupt the
   *  eblet's own sha256(question+answer) provenance and question-similarity matching for any
   *  question longer than 300 chars (routine for MMLU-Pro). */
  question: string;
  sealedLetter: string | null;
  disagreement: boolean;
  candidates: EnsembleCandidateForFactVerdict[];
}): Promise<number> {
  const { question, sealedLetter, disagreement, candidates } = params;
  if (candidates.length === 0) return 0;

  let written = 0;
  try {
    const { writeVerifiedEblet } = await import('../mnem_eblet_store');
    const now = Date.now();
    for (const candidate of candidates) {
      const factVerdict = deriveFactVerdict({
        candidateLetter: candidate.letter,
        sealedLetter,
        disagreement,
      });
      try {
        await writeVerifiedEblet({
          question,
          answer: candidate.letter,
          provenance: `answer_coroner:ensemble_candidate:${candidate.authority}`,
          // Advisory only -- writeVerifiedEblet() re-derives verified/verdict from provenance/
          // corroboration via computeHonestVerification(), same as every other caller. factVerdict
          // is an ORTHOGONAL axis (Coroner-graded, ground-truth-backed) and is never used to
          // synthesize a corroboration claim this writer has no independent basis for.
          verified: false,
          sha256: '',
          timestamp: now,
          reasoning: candidate.reasoning,
          class: 'whole_answer',
          factVerdict,
        });
        written++;
      } catch (err) {
        console.warn(
          `[answer_coroner] persistEnsembleCandidateFactVerdicts: write failed for candidate ` +
          `authority=${candidate.authority} (non-fatal, skipping):`, err,
        );
      }
    }
  } catch (err) {
    console.warn('[answer_coroner] persistEnsembleCandidateFactVerdicts: mnem_eblet_store import failed (non-fatal):', err);
  }
  return written;
}

/** Shared aggregation: CoronerRecord[] -> CoronerRoundup. Used by both the Supabase/WAN path
 *  and the local-outcomes path so the byClass/correctableWrongs/prioritizedFixList math is
 *  computed exactly once. */
function buildRoundupFromRecords(records: CoronerRecord[]): CoronerRoundup {
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

  return {
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
}

/** Classifies the CURRENT run's outcomes (in-memory/persisted, no network call) and returns
 *  the SAME CoronerRoundup shape runAnswerCoroner returns -- the renderer's existing roundup
 *  display JSX needs no branching to show either source.
 *
 *  BP140 Yoke: now genuinely async (previously "synchronous, but fine to await either way") --
 *  each outcome's classification is still the same synchronous classifyLocalOutcome() call as
 *  before, but immediately after, this now also persists a factVerdict-tagged eblet for every
 *  ensemble candidate the outcome's plowTrace carries (via persistEnsembleCandidateFactVerdicts,
 *  see that function's doc comment) -- a local disk append, never a network call, so the
 *  "no fetch" property of the doc comment above still holds; only "synchronous" no longer does.
 *  Every existing caller already either awaits this function's return value or (per the old
 *  comment) treats a non-Promise return as fine-to-await, so this is a safe widening -- see
 *  index.ts's 'plow:run-answer-coroner-local' handler, which now `await`s it. */
export async function runAnswerCoronerOnLocalOutcomes(
  outcomes: LocalCoronerOutcomeInput[],
  opts: { onProgress?: (msg: string) => void } = {},
): Promise<CoronerRoundup> {
  const log = (msg: string) => {
    console.log(`[coroner:local] ${msg}`);
    opts.onProgress?.(msg);
  };

  log(`classifying ${outcomes.length} outcome(s) from the current run...`);
  const records: CoronerRecord[] = [];
  let factVerdictsWritten = 0;
  for (const outcome of outcomes) {
    const record = classifyLocalOutcome(outcome);
    records.push(record);

    // BP140 Yoke: persist every ensemble candidate's RGBY factVerdict now that ground truth
    // (record.sealedLetter) is known -- see the module header's "WHY CORONER TIME" note. Only
    // fires when this outcome's plowTrace actually carries a candidate set (ensemble branch,
    // post-BP140 receipts); every pre-BP140/non-ensemble outcome extracts [] and is a no-op.
    const candidates = extractEnsembleCandidates(outcome.plowTrace);
    if (candidates.length > 0) {
      const disagreement =
        record.browserAuthorityCorroboration === 'disagree' ||
        record.browserAuthorityCorroboration === 'adjudicated';
      factVerdictsWritten += await persistEnsembleCandidateFactVerdicts({
        question: outcome.question,
        sealedLetter: record.sealedLetter,
        disagreement,
        candidates,
      });
    }
  }
  const roundup = buildRoundupFromRecords(records);

  log(`factVerdict eblets written this run: ${factVerdictsWritten}`);
  log('');
  log('╔══════════════════════════════════════════════════════════════');
  log('║  ANSWER CORONER ROUNDUP (current run)');
  log(`║  ${records.length} records`);
  log('╠══════════════════════════════════════════════════════════════');
  if (records.length > 0) {
    log(`║  RIGHT:   ${roundup.rightTotal.toString().padStart(4)}   (${((roundup.rightTotal / records.length) * 100).toFixed(1)}%)`);
    log(`║  WRONG:   ${roundup.wrongTotal.toString().padStart(4)}   (${((roundup.wrongTotal / records.length) * 100).toFixed(1)}%)`);
    log(`║  ABSTAIN: ${roundup.abstainTotal.toString().padStart(4)}   (${((roundup.abstainTotal / records.length) * 100).toFixed(1)}%)`);
  }
  log('╠══════════════════════════════════════════════════════════════');
  log(`║  HEADLINE 1 -- CORRECTABLE WRONGS: ${roundup.correctableWrongs}`);
  log(`║  HEADLINE 2 -- HONEST ABSTAINS:    ${roundup.honestAbstains}  (leave honest -- not a failure)`);
  log('╚══════════════════════════════════════════════════════════════');

  return roundup;
}

// ─── Main coroner function (Supabase/WAN-history path) ───────────────────────

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

  // BP139: shared aggregation (byClass/correctableWrongs/prioritizedFixList) -- same helper
  // runAnswerCoronerOnLocalOutcomes uses, so the two paths can never silently diverge.
  const roundup = buildRoundupFromRecords(records);

  // Print a human-readable summary to the terminal (satisfies Phase 4 "live visible" requirement)
  log('');
  log('╔══════════════════════════════════════════════════════════════');
  log('║  ANSWER CORONER ROUNDUP');
  log(`║  ${records.length} records  |  ${routes.length} routes  |  ${allReplies.length} replies`);
  log('╠══════════════════════════════════════════════════════════════');
  log(`║  RIGHT:   ${roundup.rightTotal.toString().padStart(4)}   (${((roundup.rightTotal / records.length) * 100).toFixed(1)}%)`);
  log(`║  WRONG:   ${roundup.wrongTotal.toString().padStart(4)}   (${((roundup.wrongTotal / records.length) * 100).toFixed(1)}%)`);
  log(`║  ABSTAIN: ${roundup.abstainTotal.toString().padStart(4)}   (${((roundup.abstainTotal / records.length) * 100).toFixed(1)}%)`);
  log('╠══════════════════════════════════════════════════════════════');
  log(`║  HEADLINE 1 -- CORRECTABLE WRONGS: ${roundup.correctableWrongs}`);
  log(`║  HEADLINE 2 -- HONEST ABSTAINS:    ${roundup.honestAbstains}  (leave honest -- not a failure)`);
  log('╠══════════════════════════════════════════════════════════════');
  log('║  PRIORITIZED FIX LIST (correctable classes):');
  for (const item of roundup.prioritizedFixList) {
    log(`║    [${item.count.toString().padStart(3)}] ${item.answerClass}`);
    for (const ex of item.exemplars) {
      log(`║        exemplar: q="${ex.question.slice(0, 60)}..." sealed=${ex.sealedLetter} got=${ex.answeredLetter ?? 'ABSTAIN'}`);
    }
  }
  log('╚══════════════════════════════════════════════════════════════');

  return roundup;
}
