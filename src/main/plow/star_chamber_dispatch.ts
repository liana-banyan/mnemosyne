// star_chamber_dispatch.ts -- BP137 Yoke v2b Stage E: distributed Star Chamber fan-out.
//
// WHY THIS FILE EXISTS: this is the wiring seam between (a) plow_mc_answerer.ts's Stage D
// exhaustion point (the ONLY call site -- see that file's `researchArmStarChamber` block,
// which fires this ONLY on a final don't-know, never on a confident answer), (b) the three
// genuinely INDEPENDENT real-world authorities already built by earlier Stage C/A passes
// (browser_authority_adapter.ts's user_google/user_perplexity lookups, compute_sidecar.ts's
// deterministic/Wolfram compute), and (c) minor_star_chamber.ts's newly-additive
// adjudicateDistributedAuthorities() (pure convergence math, reused not duplicated) and
// star_chamber_edge_client.ts's recordStarChamberMeshFire() (the ONLY write path into
// `star_chamber_mesh_fires`, via the existing star-chamber-analyze edge function/service_role
// -- never a direct client-key insert).
//
// This is explicitly NOT model-voting: every "peer" below queries a DIFFERENT real-world
// authority (Google via the user's own logged-in browser session, Perplexity via the same,
// a deterministic-arithmetic/model-derived-expression/Wolfram compute solver) -- never another
// local or flagship LLM. See minor_star_chamber.ts's Stage E header for the full rationale on
// why minorCouncil()/escalateToFlagship() in that same file are correctly NOT called here.
//
// "Seeded warm": each authority's query is prefixed with the round's own +/- eblets (the SAME
// factsForArbitration/postMiner-minus-factsForArbitration slices plow_mc_answerer.ts's Stage D.4
// already threads into writeRoundEblets()) so every authority starts with the same context the
// local swarm had already gathered, instead of a cold bare question.

import {
  adjudicateDistributedAuthorities,
  type AuthorityAnswer,
  type DistributedStarChamberResult,
  STAR_CHAMBER_CONSENSUS_VARIANCE_THRESHOLD,
} from '../dr_m_orchestrator/minor_star_chamber';
import {
  runBrowserAuthorityLookup,
  createNotWiredBridge,
  type BrowserAuthorityBridge,
} from './browser_authority_adapter';
import { computeAnswer } from './compute_sidecar';
import { writeVerifiedEblet } from '../mnem_eblet_store';
import {
  recordStarChamberMeshFire,
  type StarChamberMeshFirePayload,
  type StarChamberMeshFireRecordResult,
} from './star_chamber_edge_client';
// BP137 Yoke v2b Stage E: optional remote-peer delegation leg (see dispatchStarChamberQuestion
// ToPeer below) -- reuses the SAME proven relay_routes primitive dispatchQuestionToWanPeers
// already calls, now exported for this purpose (see wan_dispatch.ts's own doc comment on why
// exporting a previously-private function is zero-behavior-change for every existing caller).
import { insertRelayRoute, pollForReply } from '../mesh_test/wan_dispatch';
import type { MmluProQuestion } from '../mesh_test/one_click_mmlu_pro';

export interface StarChamberDispatchParams {
  dispatchId: string;
  domain: string;
  question: string;
  /** PLUS eblets: facts already confirmed/shown to the voters this round (Stage D's own +/-
   *  ledger convention -- see plow_mc_answerer.ts's factsForArbitration). Seeded into each
   *  authority's query so it starts "warm" rather than cold. */
  plusEblets: string[];
  /** MINUS eblets: candidates this round already ruled out (postMiner survivors that never
   *  reached the voters). Also seeded, so an authority does not re-surface an already-rejected
   *  lead. */
  minusEblets: string[];
  /** The Andon threshold this dispatch fired against (for the mesh-fires receipt only --
   *  matches wan_dispatch.ts's DEFAULT_ANDON_THRESHOLD convention/units when the caller has one;
   *  plow_mc_answerer.ts's own MAX_ANDON_RETRIES-based exhaustion has no single numeric
   *  threshold, so that caller passes MAX_ANDON_RETRIES itself -- see call site doc). */
  andonThreshold: number;
  ollamaBaseUrl?: string;
  model?: string;
  /** Independent of specialistKeys.wolframApiKey -- same convention as compute_sidecar.ts's
   *  ComputeAnswerOptions.wolframAppId (process.env.WOLFRAM_APP_ID, verified absent in this dev
   *  environment -- the compute authority fails closed, never fabricates, when unset). */
  wolframAppId?: string;
  /** Caller-injected browser bridge (dependency injection, same pattern
   *  browser_authority_adapter.ts's runBrowserAuthorityLookup already requires). Defaults to
   *  createNotWiredBridge() -- the HONEST placeholder documented in that file's header as the
   *  correct stand-in until the main<->renderer-webview IPC leg lands; never fabricates a
   *  result, always resolves null when not wired. */
  browserBridge?: BrowserAuthorityBridge;
}

export interface StarChamberFireOutcome extends DistributedStarChamberResult {
  meshFire: StarChamberMeshFireRecordResult;
}

/** Builds the "start warm" context prefix from this round's +/- eblets. Empty when both are
 *  empty (first-ever Stage D round with nothing yet confirmed/ruled-out) -- never fabricates
 *  seed context that was not actually gathered this round. */
function buildWarmSeed(plusEblets: string[], minusEblets: string[]): string {
  const parts: string[] = [];
  if (plusEblets.length > 0) {
    parts.push(`Already confirmed this round: ${plusEblets.slice(0, 3).map((f) => f.slice(0, 200)).join(' | ')}`);
  }
  if (minusEblets.length > 0) {
    parts.push(`Already ruled out this round: ${minusEblets.slice(0, 3).map((f) => f.slice(0, 200)).join(' | ')}`);
  }
  return parts.length > 0 ? `${parts.join('\n')}\n\nQuestion: ` : '';
}

async function queryBrowserAuthority(
  authority: 'user_google' | 'user_perplexity',
  question: string,
  seed: string,
  bridge: BrowserAuthorityBridge,
): Promise<AuthorityAnswer> {
  const t0 = Date.now();
  try {
    const result = await runBrowserAuthorityLookup(
      `${seed}${question}`,
      { researchArmMode: true, researchArmBrowserAuthority: true, preferredAuthority: authority },
      bridge,
    );
    return {
      authority,
      answer: result?.fact ?? '',
      sourceUrl: result?.sourceUrl,
      verified: result?.verified ?? false,
      latency_ms: Date.now() - t0,
    };
  } catch (err) {
    console.warn(`[star_chamber_dispatch] ${authority} lookup threw (non-fatal, honest empty):`, err);
    return { authority, answer: '', verified: false, latency_ms: Date.now() - t0 };
  }
}

async function queryComputeAuthority(
  question: string,
  seed: string,
  ollamaBaseUrl: string | undefined,
  model: string | undefined,
  wolframAppId: string | undefined,
): Promise<AuthorityAnswer> {
  const t0 = Date.now();
  try {
    // computeAnswer already never guesses -- returns null (never a fabricated value) when no
    // solver produces a verified result. `seed` is intentionally NOT concatenated into the
    // bare arithmetic question here (it would corrupt extractArithmeticExpression's literal-
    // number-op-number scan); it IS threaded through as componentFacts so the model-derived-
    // expression tier (tier 2) can still use it as reference material, same convention
    // plow_mc_answerer.ts's own Stage A.3 call already uses for factsForArbitration.
    const componentFacts = [seed.trim(), ...seedToFacts(seed)].filter((s) => s.length > 0);
    const result = await computeAnswer(question, { wolframAppId, ollamaBaseUrl, model, componentFacts });
    // Named per the tier that actually produced a verified value ('local_arithmetic' /
    // 'model_derived_expression' / 'wolfram_compute', see compute_sidecar.ts's
    // ComputeSidecarResult['method']) -- 'wolfram_compute' is the stable slot name used only
    // when NO tier produced a value (nothing to name it after), so the peer-authorities list
    // still always names this slot deterministically. Never fabricated: `result` is only
    // non-null when computeAnswer's own two-independent-evaluator / self-consistency / strict-
    // numeric-acceptance gates already verified it (see that file's header).
    const authority = result ? `compute_${result.method}` : 'wolfram_compute';
    return {
      authority,
      answer: result ? String(result.value) : '',
      verified: result !== null,
      latency_ms: Date.now() - t0,
    };
  } catch (err) {
    console.warn('[star_chamber_dispatch] compute authority threw (non-fatal, honest empty):', err);
    return { authority: 'wolfram_compute', answer: '', verified: false, latency_ms: Date.now() - t0 };
  }
}

function seedToFacts(seed: string): string[] {
  return seed.split('\n').map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith('Question:'));
}

/**
 * BP137 Yoke v2b Stage E, optional remote-peer delegation leg. Delegates ONE authority-slot's
 * question to a live mesh peer over the SAME relay_routes/relay_route_replies mechanism
 * wan_dispatch.ts's dispatchQuestionToWanPeers already proves works, with `is_star_chamber:
 * true` set on the dispatch object (insertRelayRoute's new isStarChamber param -- see that
 * file). The target peer's own startRelayRoutePoll() reads payload.is_star_chamber === true
 * (index.ts ~line 6188) and echoes it back verbatim in its reply (~line 6690), giving the
 * origin an auditable, wire-level marker that this specific reply was a Star-Chamber-tagged
 * sub-question, not an ordinary benchmark answer.
 *
 * NOT exercised against a live peer in this pass (no live Supabase-registered peer + network
 * path available in this sandbox) -- this function is real, compiled, reachable code (a genuine
 * additive capability for a future pass where Stage E needs to reach an authority only a
 * DIFFERENT peer has, e.g. that peer's own WOLFRAM_APP_ID or its own logged-in browser), but the
 * default Stage E fan-out (runStageEDistributedStarChamber below) uses the three LOCAL
 * authorities (this box's own browser-bridge scaffold + compute sidecar) because those are the
 * legs actually wired end-to-end and testable in this repo today. Honesty firewall preserved
 * either way: a timed-out/failed remote peer degrades to verified:false, never a fabricated
 * answer.
 */
export async function dispatchStarChamberQuestionToPeer(
  targetPeerId: string,
  question: string,
  domain: string,
  dispatchId: string,
  timeoutMs: number = 60_000,
): Promise<AuthorityAnswer> {
  const t0 = Date.now();
  const authority = `remote_peer:${targetPeerId}`;
  const cfg = { url: (await import('../shared/anon_key')).getSupabaseUrl(), anonKey: (await import('../shared/anon_key')).getAnonKey() };
  if (!cfg.url || !cfg.anonKey) {
    return { authority, answer: '', verified: false, latency_ms: Date.now() - t0 };
  }
  // Star Chamber sub-questions are fact-lookups, not graded MC questions -- fit them into the
  // MmluProQuestion shape insertRelayRoute requires with an empty option set/answer key (the
  // responder's plow/single-shot path never requires options to be non-empty to attempt an
  // answer; a benchmark-scoring caller would, but this caller only reads answer_json.answer
  // back, never scores against question.answer).
  const pseudoQuestion: MmluProQuestion = {
    question_id: Number(dispatchId.replace(/\D/g, '').slice(0, 9)) || Date.now(),
    question,
    options: [],
    answer: '',
    answer_index: -1,
    category: domain,
    src: 'star_chamber_distributed',
  };
  try {
    const routeId = await insertRelayRoute(
      cfg, targetPeerId, pseudoQuestion, dispatchId, Math.ceil(timeoutMs / 1000), false,
      false, false, undefined, false, /* isStarChamber */ true,
    );
    if (!routeId) return { authority, answer: '', verified: false, latency_ms: Date.now() - t0 };
    const reply = await pollForReply(cfg, routeId, timeoutMs);
    const answerText = typeof reply?.answerJson?.answer === 'string' ? (reply.answerJson.answer as string) : '';
    const isAbstain = answerText === 'ABSTAIN' || answerText === '';
    return {
      authority,
      answer: isAbstain ? '' : answerText,
      verified: !isAbstain,
      latency_ms: Date.now() - t0,
    };
  } catch (err) {
    console.warn(`[star_chamber_dispatch] remote peer delegation to ${targetPeerId} failed (non-fatal, honest empty):`, err);
    return { authority, answer: '', verified: false, latency_ms: Date.now() - t0 };
  }
}

/**
 * The Stage E entry point. Fans the question out to 3 independent authorities in parallel
 * (Google/browser, Perplexity/browser, Wolfram/compute), adjudicates via
 * adjudicateDistributedAuthorities() (minor_star_chamber.ts, reused not duplicated), preserves
 * a verified consensus "in salt" (writeVerifiedEblet, full argument chain), and ALWAYS records
 * the fire (consensus or honest disagreement) to `star_chamber_mesh_fires` via the
 * star-chamber-analyze edge function (service_role write path; see star_chamber_edge_client.ts).
 * Never throws -- every internal step is individually guarded so a single authority's failure
 * degrades that one slot to verified:false rather than aborting the whole adjudication.
 */
export async function runStageEDistributedStarChamber(
  params: StarChamberDispatchParams,
): Promise<StarChamberFireOutcome> {
  const seed = buildWarmSeed(params.plusEblets, params.minusEblets);
  const bridge = params.browserBridge ?? createNotWiredBridge();

  const [google, perplexity, compute] = await Promise.all([
    queryBrowserAuthority('user_google', params.question, seed, bridge),
    queryBrowserAuthority('user_perplexity', params.question, seed, bridge),
    queryComputeAuthority(params.question, seed, params.ollamaBaseUrl, params.model, params.wolframAppId),
  ]);

  const answers: AuthorityAnswer[] = [google, perplexity, compute];
  const adjudication = adjudicateDistributedAuthorities(answers);

  // "Preserve in salt": write the verified eblet + full argument chain ONLY on genuine
  // consensus -- honesty firewall, never write a fabricated/disagreed answer as verified:true.
  if (adjudication.consensusReached && adjudication.answer) {
    try {
      await writeVerifiedEblet({
        question: `[star-chamber:distributed] ${params.question}`,
        answer: adjudication.answer,
        provenance: `star_chamber_distributed:${params.dispatchId}`,
        verified: true,
        sha256: '',
        timestamp: Date.now(),
        class: 'whole_answer',
        confidence: adjudication.hScore,
        reasoning: answers
          .map((a) => `[${a.authority}] verified=${a.verified} -> ${a.answer || '(no usable result)'}`)
          .join('\n'),
        tic: {
          known: adjudication.answered.map((a) => `${a.authority}: ${a.answer}`),
          theories_open: [],
          eliminated: params.minusEblets.map((m) => m.slice(0, 300)),
          dependencies_upstream: params.plusEblets,
          applications_downstream: [],
        },
      });
    } catch (err) {
      console.warn('[star_chamber_dispatch] preserve-in-salt write failed (non-fatal):', err);
    }
  }

  const firePayload: StarChamberMeshFirePayload = {
    dispatch_id: params.dispatchId,
    domain: params.domain,
    question: params.question,
    confidence_variance: adjudication.variance,
    andon_threshold: params.andonThreshold,
    peer_answers_json: answers.map((a) => ({
      authority: a.authority, answer: a.answer, verified: a.verified, source_url: a.sourceUrl,
    })),
    star_chamber_answer: adjudication.answer,
    judge_answers: Object.fromEntries(answers.map((a) => [a.authority, a.answer || null])),
    judge_confidences: Object.fromEntries(
      answers.map((a) => [a.authority, a.verified ? Math.max(0, 1 - adjudication.variance) : 0]),
    ),
    h_score: adjudication.hScore,
    consensus_reached: adjudication.consensusReached,
    falsification_criteria: {
      disagreement_summary: adjudication.disagreementSummary,
      consensus_variance_threshold: STAR_CHAMBER_CONSENSUS_VARIANCE_THRESHOLD,
      never_fabricate: true,
      peer_authorities_dispatched: adjudication.peerAuthorities,
    },
  };

  const meshFire = await recordStarChamberMeshFire(firePayload);

  return { ...adjudication, meshFire };
}
