// wan_dispatch.ts — BP132 Yoke #23 Task 1: WAN-distributed one-click MMLU-Pro dispatch.
//
// R-MECHANISM-VERIFY (2026-07-23): before writing this module, the actual live mechanism
// was verified directly against the production Supabase tables (anon key, read + a
// cleaned-up dry-run write), not assumed from source alone:
//
//   - relay_routes / relay_route_replies is a REAL, PROVEN, already-working request/reply
//     bus. Found two real historical rows from a 2026-07-06 run (session_id
//     'bp106-1q-v0829'): a relay_routes row targeting a live peer with an MMLU-Pro
//     multiple-choice prompt + payload_json.correct_answer_letter='D', and the matching
//     relay_route_replies row where that peer's answer_json.answer was ALSO 'D' -- i.e.
//     this exact mechanism has ALREADY produced one real, honest, ground-truth-correct
//     WAN answer before, just never as a repeatable in-app one-click flow.
//   - The RESPONDER side already exists and is production-hardened: index.ts's
//     startRelayRoutePoll() (already wired, not part of the Yoke #21 A1 gap) reads
//     relay_routes.payload_json.prompt, runs it through Ollama (optionally an iterative
//     "Plow Council" of gemma4:12b samples), extracts an A-J letter with several regex
//     fallbacks, and POSTs {answer, ...} or {answer:'ABSTAIN', abstain_reason, ...} into
//     relay_route_replies -- all via the anon key, no service-role key involved anywhere
//     in the real working path.
//   - By contrast, src/main/plow/mesh_plow_dispatcher.ts (also found during this
//     investigation, also never imported/wired anywhere) reads the WRONG reply columns
//     (row.hex_frame / row.payload_json) -- the real relay_route_replies table has NEITHER
//     of those columns, only answer_json + hex_reply (hex_reply is always null in every
//     real row sampled). It also requires a Supabase SERVICE ROLE key for its
//     wan-relay-route POST, which a real distributed client app cannot safely ship to
//     every user's machine. That module is left as-is (out of scope to rewrite this yoke)
//     but is flagged here and in the Yoke-return as unproven/broken dead code, not adopted.
//   - Anon-key write access was verified directly: a scoped dry-run insert into
//     relay_routes (fake target_peer_id, immediately marked status='expired' since DELETE
//     silently affected 0 rows under RLS) confirmed the anon key can INSERT rows with the
//     exact schema below, matching the real 2026-07-06 rows byte-for-byte in shape.
//
// This module builds the ASKER side of that already-proven mechanism as a real, reusable
// function instead of an ad-hoc uncommitted script (no trace of whatever script produced
// the 2026-07-06 rows was found in either this repo or LianaBanyanPlatform).

import { getStablePeerId } from '../federation/peer-discovery';
import { getAnonKey, getSupabaseUrl } from '../shared/anon_key';
import type { MmluProQuestion } from './one_click_mmlu_pro';
// BP137 Yoke v2b Stage F3 (mesh synergy): promotes adjudicateDistributedAuthorities() from
// Star-Chamber-only use (star_chamber_dispatch.ts's runStageEDistributedStarChamber) to this
// NORMAL cross-peer mesh path too, per the Stage F3 spec's explicit "promote it" instruction --
// reused verbatim (pure function, no I/O), never duplicated. See computeMeshSynergyAdjudication()
// below for the one adaptation needed (MC letters, not prose facts) and why it is done via
// input-encoding rather than touching that shared function.
import { adjudicateDistributedAuthorities, type AuthorityAnswer } from '../dr_m_orchestrator/minor_star_chamber';

export interface WanPeerInfo {
  peerId: string;
  machineLabel: string;
}

export interface WanPeerAnswer {
  peerId: string;
  machineLabel: string;
  routeId: string | null;
  answerLetter: string | null;
  isAbstain: boolean;
  isCorrect: boolean;
  timedOut: boolean;
  processingMs: number | null;
  error?: string;
  /** BP133 Yoke #24 Task 2: Truth-Always -- which mechanism actually produced answerLetter.
   *  Undefined only for legacy replies from before this field existed. */
  answeredBy?: 'plow' | 'minor_council' | 'single_shot';
  /** BP133 Yoke #24 Task 2.3: the plow's full trace (concordance, BMV, gates, specialists
   *  used, voter letters, Andon retries) verbatim from the responder, present only when
   *  answeredBy === 'plow'. This is what makes the persisted receipt auditable. */
  plowTrace?: Record<string, unknown> | null;
  /** BP137 Yoke v2b Stage F3 (mesh synergy), OPTIONAL/ADDITIVE. Present only when THIS
   *  dispatch's researchArmMeshSynergy was true -- the authority-role the ASKER's own
   *  round-robin loop assigned this peer for this question (see assignMeshSynergyAuthority()
   *  below). This is asker-side ground truth (computed here, before dispatch, never trusted
   *  from the peer's reply) -- kept alongside (never instead of) the peer's own echoed
   *  plowTrace.mesh_synergy_assigned receipt, so a caller can cross-check what was ASKED for
   *  against what the peer says it actually DID. Absent for every pre-Stage-F3 dispatch. */
  assignedAuthority?: 'user_google' | 'user_perplexity' | 'swarm';
}

// BP135 Phase 2 (Layer A: consensus). See computeConsensus() below for the full design note.
export interface WanConsensusResult {
  consensusLetter: string | null;
  confidenceVariance: number;
  andonTriggered: boolean;
}

export interface WanQuestionOutcome {
  question_id: number;
  question: string;
  category: string;
  correctLetter: string;
  peerAnswers: WanPeerAnswer[];
  /** BP135 Phase 2: the mesh's single consensus answer for this question, computed purely
   *  from peerAnswers (see computeConsensus()). Always present, even for a 1-peer outcome
   *  (degenerate case: consensusLetter mirrors that one peer's answer, variance is 0). */
  consensus: WanConsensusResult;
  /** BP137 Yoke v2b Stage F3 (mesh synergy), OPTIONAL/ADDITIVE. Present ONLY when this
   *  dispatch's researchArmMeshSynergy was true -- the pooled cross-peer adjudication over
   *  DIFFERENT per-peer authorities (never the same-answer voting `consensus` field above,
   *  which is computed from peers that each ran the IDENTICAL full plow). See
   *  computeMeshSynergyAdjudication() below. Absent for every pre-Stage-F3 dispatch, and also
   *  absent when zero peers had a usable answer to pool (nothing to adjudicate). */
  meshSynergyPooled?: MeshSynergyPooledResult;
}

/** BP137 Yoke v2b Stage F3 (mesh synergy): the pooled result of adjudicating this question's
 *  per-peer, per-assigned-authority answers. Truthful per-peer provenance chain (requirement 4
 *  of the Stage F3 spec): `perPeerChain` names which peer, which authority it was assigned,
 *  what letter it returned (or null), and the real source URL when the peer's answer was
 *  browser-sourced (threaded through from that peer's own plowTrace.provenance_receipts, never
 *  fabricated here). */
export interface MeshSynergyPooledResult {
  perPeerChain: Array<{
    peerId: string;
    machineLabel: string;
    assignedAuthority: 'user_google' | 'user_perplexity' | 'swarm';
    answerLetter: string | null;
    sourceUrl?: string;
  }>;
  peerAuthorities: string[];
  answeredAuthorities: string[];
  consensusReached: boolean;
  hScore: number;
  confidenceVariance: number;
  /** The pooled MC letter the distinct authorities agreed on -- populated ONLY when
   *  consensusReached is true. Never populated on disagreement (honesty firewall, same
   *  doctrine as star_chamber_dispatch.ts's DistributedStarChamberResult.answer). */
  pooledLetter: string | null;
  /** Honest "peer X (assigned Y) said A vs peer Z (assigned W) said B" verdict, populated ONLY
   *  when consensusReached is false (or zero peers answered at all). Null when consensus was
   *  reached. */
  disagreementSummary: string | null;
}

interface SupabaseConfig {
  url: string;
  anonKey: string;
}

function resolveSupabaseConfig(): SupabaseConfig | null {
  // BP132 Yoke #23 Task 6: use the shared getAnonKey()/getSupabaseUrl() helpers so WAN
  // dispatch works on a stranger's install with no WORKING_KEYS.env, not just a dev machine.
  const url = getSupabaseUrl();
  const anonKey = getAnonKey();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

// Matches this peer's own presence heartbeat cadence (relay poll every 5s, presence
// patch roughly every 30s -- see index.ts startRelayRoutePoll). A peer_presence row with
// state='active' but a last_seen_at older than this is treated as stale/gone, not live.
const PRESENCE_STALE_MS = 5 * 60 * 1000;

/**
 * Queries peer_presence directly (not the LAN-only constellation_discovery.ts, which is
 * a different, saved-peer-list + UDP-beacon mechanism unrelated to the WAN relay bus).
 * Returns the empty array whenever Supabase is unreachable/unconfigured or genuinely no
 * peer_presence rows are both state='active' and recently seen -- callers must treat an
 * empty result as "no live WAN peers right now", not as an error.
 *
 * BP133 Yoke #26: the production table's column is `state`, not `status` -- this query used
 * to read status=eq.active, which does not exist on peer_presence (HTTP 400,
 * code 42703). That silently made this function return [] on every single call, so the
 * in-app one-click WAN test always found zero peers even when peers were live.
 */
export async function discoverLiveWanPeers(): Promise<WanPeerInfo[]> {
  const cfg = resolveSupabaseConfig();
  if (!cfg) return [];
  const selfId = getStablePeerId();
  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/peer_presence?state=eq.active&select=peer_id,machine_label,last_seen_at`,
      {
        headers: { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}` },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) {
      console.error(`[wan_dispatch] peer_presence query failed: HTTP ${res.status}`);
      return [];
    }
    const rows = (await res.json()) as Array<{ peer_id: string; machine_label: string | null; last_seen_at: string | null }>;
    const now = Date.now();
    return rows
      .filter((r) => r.peer_id !== selfId)
      .filter((r) => {
        if (!r.last_seen_at) return false;
        const age = now - new Date(r.last_seen_at).getTime();
        return age >= 0 && age <= PRESENCE_STALE_MS;
      })
      .map((r) => ({ peerId: r.peer_id, machineLabel: r.machine_label || r.peer_id.slice(0, 8) }));
  } catch (e) {
    console.error('[wan_dispatch] discoverLiveWanPeers failed:', e);
    return [];
  }
}

function letterFromIndex(i: number): string {
  return String.fromCharCode(65 + i);
}

/**
 * Prompt template matches the proven 2026-07-06 format byte-for-byte in style (verified
 * against the real relay_routes.payload_json.prompt of the two rows that both produced
 * correct answers) -- the production responder in index.ts's startRelayRoutePoll() has
 * several regexes tuned to parse exactly this "single letter only" instruction shape.
 */
export function buildMcPrompt(q: MmluProQuestion): string {
  const lastLetter = letterFromIndex(q.options.length - 1);
  const optionsBlock = q.options.map((opt, i) => `${letterFromIndex(i)}) ${opt}`).join('\n');
  return `You must reply with ONLY the single letter of your answer (A through ${lastLetter}). Do not include any reasoning, explanation, or text other than the single letter.\n\nQuestion: ${q.question}\n\n${optionsBlock}\n\nYour answer (one letter only):`;
}

/** BP135 Phase 3 (Layer B: federated substrate). A topical eblet hit pooled from one live
 *  peer, tagged with which peer it came from -- structurally the same shape substrate_toggle.ts
 *  expects (PooledSubstrateHit there), defined separately here to keep this asker-side module
 *  decoupled from the responder-side substrate_toggle.ts (asymmetric dependency direction:
 *  index.ts already imports substrate_toggle.ts; this file is imported by one_click_mmlu_pro.ts
 *  only, never by index.ts). */
export interface PooledSubstrateHit {
  question: string;
  answer: string;
  provenance: string;
  peerId?: string;
  /** BP135 Yoke #34 (0.9.7) argument-ledger: additive, optional -- mirrors substrate_toggle.ts's
   *  PooledSubstrateHit fields (kept deliberately duplicated, not imported, per this file's own
   *  asymmetric-dependency-direction convention noted above). Absent means 'unverified', same
   *  treatment as an eblet written before this Yoke existed. */
  verdict?: 'correct' | 'wrong' | 'unverified';
  reasoning?: string;
}

const EBLET_TOPICAL_TIMEOUT_MS = 20_000;

/**
 * BP135 Phase 3 (Layer B: federated substrate). Queries EVERY peer in `peers` for its OWN
 * local topical (never exact-match) eblets related to `question`, via the SAME proven
 * relay_routes/relay_route_replies bus this file already uses for MC questions --
 * `query_type:'eblet_topical'`, handled responder-side in index.ts's startRelayRoutePoll
 * (which calls queryVerifiedEbletsTopical() locally on that peer's own store and never
 * leaks the exact-match answer-key store, per its own doc comment). Does NOT stand up any
 * new WAN endpoint and does NOT touch the :47213 installer server -- reuses the exact bus
 * that already solves NAT/discovery via Supabase (see this file's own header note).
 *
 * Runs BOUNDED and SEQUENTIAL (one peer at a time, each capped at perPeerTimeoutMs) per the
 * BP135 Yoke's explicit latency note: this adds round-trips on top of an already
 * multi-minute plow run, so it must never fan out unboundedly wide. A peer that times out,
 * errors, or has nothing topical simply contributes zero hits -- it never fails the pool for
 * the other peers, and it never blocks the real MC-question round that follows.
 */
export async function queryTopicalEbletsFromPeers(
  question: MmluProQuestion,
  peers: WanPeerInfo[],
  sessionId: string,
  perPeerTimeoutMs: number = EBLET_TOPICAL_TIMEOUT_MS,
): Promise<PooledSubstrateHit[]> {
  const cfg = resolveSupabaseConfig();
  if (!cfg) return [];
  const merged: PooledSubstrateHit[] = [];
  const seen = new Set<string>();

  for (const peer of peers) {
    try {
      const ttlSeconds = Math.ceil(perPeerTimeoutMs / 1000) + 30;
      const res = await fetch(`${cfg.url}/rest/v1/relay_routes`, {
        method: 'POST',
        headers: {
          apikey: cfg.anonKey,
          Authorization: `Bearer ${cfg.anonKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          target_peer_id: peer.peerId,
          // hex_frame is a NOT NULL legacy column (see insertRelayRoute below) -- the
          // responder for this query_type reads payload_json exclusively.
          hex_frame: Buffer.from(question.question, 'utf8').toString('base64'),
          payload_json: {
            query_type: 'eblet_topical',
            question_text: question.question,
            domain: question.category,
            top_k: 3,
            batch_purpose: `oneclick_eblet_topical_${sessionId}`,
          },
          status: 'pending',
          session_id: sessionId,
          ttl_seconds: ttlSeconds,
          wire_format: 'json-legacy',
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) continue;
      const rows = (await res.json()) as Array<{ id: string }>;
      const routeId = rows[0]?.id;
      if (!routeId) continue;

      const reply = await pollForReply(cfg, routeId, perPeerTimeoutMs);
      const eblets = (reply?.answerJson?.eblets as
        Array<{
          question: string; answer: string; provenance: string;
          verdict?: 'correct' | 'wrong' | 'unverified'; reasoning?: string;
        }> | undefined) ?? [];
      for (const e of eblets) {
        const key = peer.peerId + '::' + e.question.trim().toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push({
          question: e.question, answer: e.answer, provenance: e.provenance, peerId: peer.peerId,
          verdict: e.verdict, reasoning: e.reasoning,
        });
      }
    } catch (err) {
      console.warn(`[wan_dispatch] eblet_topical query to peer=${peer.peerId} failed (non-fatal):`, err);
    }
  }
  return merged;
}

// ─── BP137 Yoke v2b Stage F3: mesh synergy -- round-robin authority assignment ──────────────
//
// Today every live peer runs the IDENTICAL full plow on the same question -- 2 peers = 2
// redundant copies of the same lookup, not synergy. This makes the ASKER assign each live peer
// a DIFFERENT authority-role for the SAME question, round-robin, so N peers cover N distinct
// authorities instead of duplicating one.

/** The exact 3-role cycle the Stage F3 spec names explicitly: peer 0 -> its own browser
 *  Google, peer 1 -> its own browser Perplexity, peer 2 (if present) -> compute + encyclopedia
 *  swarm (the existing default full-swarm path). A 4th+ peer wraps back around ('round-robin'),
 *  matching this constant's own name -- there is no 4th genuinely-different LOCAL authority
 *  this build wires (dispatchStarChamberQuestionToPeer's remote-peer-authority delegation leg
 *  in star_chamber_dispatch.ts is a separate, not-yet-exercised-live capability, out of scope
 *  for this cycle), so cycling back to 'user_google' is the honest choice over inventing a 4th
 *  role that does not exist. */
export const MESH_SYNERGY_AUTHORITY_ROLES = ['user_google', 'user_perplexity', 'swarm'] as const;

/** Pure, deterministic, zero-I/O -- given this peer's 0-based index among the live peers being
 *  dispatched to FOR THIS QUESTION, returns which authority-role the asker assigns it. Exported
 *  standalone (not inlined into dispatchQuestionToWanPeers below) specifically so it is
 *  independently verifiable without needing a live network/peer/Supabase round trip -- see the
 *  Stage F3 Yoke-return's diagnostic verification of this exact function. */
export function assignMeshSynergyAuthority(peerIndex: number): 'user_google' | 'user_perplexity' | 'swarm' {
  return MESH_SYNERGY_AUTHORITY_ROLES[peerIndex % MESH_SYNERGY_AUTHORITY_ROLES.length];
}

/** BP137 Yoke v2b Stage F3: scoreConvergence() (dr_m_orchestrator/minor_star_chamber.ts, called
 *  internally by adjudicateDistributedAuthorities()) tokenizes its word-overlap Jaccard
 *  fallback on `\W+` and DROPS tokens of length <=2 -- a bare MC letter ("A") always collapses
 *  to an EMPTY token set, so two peers with genuinely DIFFERENT letters would score
 *  jaccard(emptySet,emptySet)=1 (that function's own explicit "union===0 ? 1" convention for
 *  "nothing to compare, call it agreement") -- a FALSE 100% overlap / 0 variance that would
 *  misreport a real N-way letter disagreement as consensus. (This fallback is only reached when
 *  scoreConvergence's EARLIER exact-text majority/unanimity branch does NOT already resolve the
 *  case -- i.e. only for genuine "every peer answered a different letter" total disagreement,
 *  exactly the case honesty most requires getting right.) Padding each letter into a single
 *  underscore-joined token (`_` is a `\w` character, so `\W+` never splits it) long enough to
 *  clear the length>2 filter sidesteps this WITHOUT touching scoreConvergence/
 *  adjudicateDistributedAuthorities themselves (reused verbatim, per Stage E's own "pure
 *  function, do not fork" doctrine) -- any real per-letter majority or full unanimity is still
 *  caught by scoreConvergence's EARLIER exact-match branch before this encoding matters at all;
 *  it only changes the outcome for the genuine all-different-letters case, where it now
 *  correctly reports full disagreement instead of a fabricated consensus. */
function encodeMcLetterForAdjudication(letter: string): string {
  return `mc_answer_letter_${letter.toLowerCase()}`;
}

function decodeMcLetterFromAdjudication(encoded: string): string | null {
  const m = encoded.match(/^mc_answer_letter_([a-j])$/i);
  return m ? m[1]!.toUpperCase() : null;
}

/** BP137 Yoke v2b Stage F3, build item 3: promotes adjudicateDistributedAuthorities()
 *  (dr_m_orchestrator/minor_star_chamber.ts, Stage E) from Star-Chamber-only use to this normal
 *  cross-peer mesh path. Pure function (no I/O) -- takes the per-peer answers this question's
 *  WAN dispatch already collected and pools them; the caller (dispatchQuestionToWanPeers below)
 *  decides whether to invoke this at all (only when researchArmMeshSynergy was true for this
 *  dispatch). A peer with no assignedAuthority (mesh synergy was off, or this peer predates
 *  Stage F3) is excluded from the pool entirely -- it is not silently coerced into 'swarm'. */
export function computeMeshSynergyAdjudication(peerAnswers: WanPeerAnswer[]): MeshSynergyPooledResult | null {
  const assigned = peerAnswers.filter((pa): pa is WanPeerAnswer & { assignedAuthority: 'user_google' | 'user_perplexity' | 'swarm' } =>
    pa.assignedAuthority !== undefined);
  if (assigned.length === 0) return null;

  const perPeerChain = assigned.map((pa) => {
    const provenanceReceipts = pa.plowTrace?.provenance_receipts as
      Array<{ source?: string; provenanceUrl?: string }> | undefined;
    const sourceUrl = Array.isArray(provenanceReceipts)
      ? provenanceReceipts.find((r) => typeof r.source === 'string' && r.source.startsWith('mesh_synergy:'))?.provenanceUrl
      : undefined;
    return {
      peerId: pa.peerId,
      machineLabel: pa.machineLabel,
      assignedAuthority: pa.assignedAuthority,
      answerLetter: pa.answerLetter,
      ...(sourceUrl ? { sourceUrl } : {}),
    };
  });

  const authorityAnswers: AuthorityAnswer[] = assigned.map((pa) => ({
    // Truthful per-peer chain: "which authority, which peer" folded into one name, so two
    // peers independently assigned the SAME role (e.g. peer 3 wrapping back to 'user_google')
    // are never conflated into a single authority slot.
    authority: `${pa.assignedAuthority}@peer:${pa.peerId.slice(0, 8)}`,
    answer: pa.answerLetter ? encodeMcLetterForAdjudication(pa.answerLetter) : '',
    verified: pa.answerLetter !== null && !pa.isAbstain && !pa.timedOut,
    latency_ms: pa.processingMs ?? 0,
  }));

  const adjudication = adjudicateDistributedAuthorities(authorityAnswers);
  const pooledLetter = adjudication.consensusReached && adjudication.answer
    ? decodeMcLetterFromAdjudication(adjudication.answer)
    : null;

  return {
    perPeerChain,
    peerAuthorities: adjudication.peerAuthorities,
    answeredAuthorities: adjudication.answered.map((a) => a.authority),
    consensusReached: adjudication.consensusReached,
    hScore: adjudication.hScore,
    confidenceVariance: adjudication.variance,
    pooledLetter,
    // disagreementSummary is built from the SAME encoded answers adjudicateDistributedAuthorities
    // already produced (never re-derived/guessed) -- decode each authority's own encoded letter
    // back out for a human-readable summary instead of leaking the internal mc_answer_letter_
    // encoding into a receipt a human/Bishop will read.
    disagreementSummary: adjudication.disagreementSummary
      ? assigned
          .map((pa) => `${pa.assignedAuthority}@${pa.machineLabel} says "${pa.answerLetter ?? 'no answer'}"`)
          .join(' vs ')
      : null,
  };
}

// BP137 Yoke v2b Stage E: exported (was module-private) so star_chamber_dispatch.ts can reuse
// the SAME proven relay_routes insert primitive for an optional remote-peer delegation leg,
// instead of duplicating the wire-format/schema knowledge in a second file. Exporting a
// previously-private function changes zero behavior for every existing caller in this module
// (dispatchQuestionToWanPeers, below) -- it is purely an added export declaration plus one new
// trailing optional parameter (default false, see isStarChamber below).
export async function insertRelayRoute(
  cfg: SupabaseConfig,
  targetPeerId: string,
  question: MmluProQuestion,
  sessionId: string,
  ttlSeconds: number,
  substrateEnabled: boolean,
  // BP133 Yoke #24 Task 2: explicit opt-in fields. Both default false in the caller so an
  // ordinary substrate-toggle-only run's payload shape is unchanged from Task 1.
  plowEnabled: boolean,
  plowAndonEnabled: boolean,
  // BP135 Phase 3 (Layer B: federated substrate): pooled eblets already gathered from ALL
  // live peers via queryTopicalEbletsFromPeers(), threaded into THIS peer's own question
  // payload so its responder's applySubstrateToggle() call uses the pooled index instead of
  // (or as well as) its own local-only query. undefined/empty preserves prior behavior.
  pooledEblets?: PooledSubstrateHit[],
  // BP137 Yoke v2b (Research Arm): explicit opt-in, defaults false. Ignored by the responder
  // unless plowEnabled is also true (see index.ts's startRelayRoutePoll + plow_mc_answerer.ts's
  // researchArmMode doc).
  researchArmMode: boolean = false,
  // BP137 Yoke v2b Stage E: explicit opt-in, DEFAULT FALSE. When true, sets `is_star_chamber:
  // true` in payload_json -- the field index.ts's startRelayRoutePoll already reads
  // (`payload.is_star_chamber === true`, ~line 6188) and echoes back verbatim in its reply
  // (~line 6690), but that NO caller before this Yoke ever set true (confirmed by grep: this
  // was the only call site in the whole repo that constructs payload_json for a relay_routes
  // insert, and it never included this key at all -- not merely `false`). When false/absent
  // (every pre-Stage-E call, including dispatchQuestionToWanPeers below, which never passes
  // this argument), the spread below contributes NOTHING to payload_json -- the emitted JSON
  // body is byte-identical to pre-Stage-E behavior, not merely "is_star_chamber: false" where
  // the key was previously absent entirely.
  isStarChamber: boolean = false,
  // BP137 Yoke v2b Stage F3 (mesh synergy): explicit opt-in, DEFAULT FALSE. When true, sets
  // `research_arm_mesh_synergy: true` in payload_json -- see index.ts's responder read of
  // `payload.research_arm_mesh_synergy`. When false/absent (every pre-Stage-F3 call, including
  // dispatchQuestionToWanPeers below when its own researchArmMeshSynergy is false), the spread
  // below contributes NOTHING to payload_json, matching isStarChamber's own established
  // omit-not-false convention (see that param's doc comment above).
  researchArmMeshSynergy: boolean = false,
  // BP137 Yoke v2b Stage F3: which authority (if any) the asker's round-robin loop assigned
  // THIS peer for THIS question (see assignMeshSynergyAuthority() above). Omitted from
  // payload_json entirely (not merely absent-as-undefined) unless BOTH this is set AND
  // researchArmMeshSynergy is true -- an old/mesh-synergy-unaware responder build must never
  // see this key at all, matching every other opt-in-only field in this payload.
  assignedAuthority?: 'user_google' | 'user_perplexity' | 'swarm',
): Promise<string | null> {
  const prompt = buildMcPrompt(question);
  // hex_frame is a NOT NULL legacy column (verified via a live dry-run insert 2026-07-23);
  // the modern responder path reads payload_json.prompt exclusively, so this is populated
  // for schema compatibility only, matching the real 2026-07-06 rows' own convention of
  // storing a base64 copy of the prompt there under wire_format:'json-legacy'.
  const hexFrame = Buffer.from(prompt, 'utf8').toString('base64');
  const body = {
    target_peer_id: targetPeerId,
    hex_frame: hexFrame,
    payload_json: {
      domain: question.category,
      prompt,
      // BP133 Yoke #24 Task 2: plain question text (no options/instructions) for the plow's
      // specialist research queries -- separate from `prompt` so specialist adapters search
      // on the actual question rather than the MC-formatting boilerplate. Ignored by the
      // single-shot/Minor Council branches, which continue to use `prompt` as before.
      question_text: question.question,
      question_id: `mmlu-pro-wan-${question.question_id}`,
      wire_format: 'json-legacy',
      choice_count: question.options.length,
      batch_purpose: `oneclick_${sessionId}`,
      source_question_id: question.question_id,
      // Asker-side bookkeeping only. Verified by source read that startRelayRoutePoll()
      // (the responder) never reads correct_answer_letter -- it only reads payload.prompt,
      // payload.plow_max_iterations, payload.allotted_timeout_ms, payload.is_star_chamber,
      // payload.is_tiebreaker/tiebreaker_model. The peer cannot see or use the answer key.
      correct_answer_letter: question.answer,
      plow_max_iterations: 0, // bedrock/single-shot mode -- fast per-question turnaround
      // BP133 Yoke #24 Task 1: single authoritative substrate flag, honored by the
      // responder (index.ts's startRelayRoutePoll -- see substrate_toggle.ts). The asker
      // cannot inject substrate itself here because the answering model call happens on
      // the PEER's machine against the PEER's own local substrate, not this machine's.
      substrate_enabled: substrateEnabled,
      // BP133 Yoke #24 Task 2: explicit opt-in to the 12-Blade Column Plow as the answering
      // mechanism, mutually exclusive with plow_max_iterations>0 (Minor Council) in the
      // responder's branch order -- plowEnabled takes priority when both are somehow set.
      plow_enabled: plowEnabled,
      plow_andon_enabled: plowAndonEnabled,
      // BP137 Yoke v2b (Research Arm): explicit opt-in, bundles Stage A.0 (relevance gate
      // upstream of the MC voters) + Stage A (answer-type classifier + compute sidecar) behind
      // one wire flag -- see plow_mc_answerer.ts's CanonicalPlowMcConfig for the underlying
      // independently-gateable sub-flags this expands into on the responder side.
      research_arm_mode: researchArmMode,
      // BP135 Phase 3 (Layer B: federated substrate): pooled topical eblets from ALL live
      // peers (see queryTopicalEbletsFromPeers()), threaded so THIS peer's responder can
      // inject the pooled index via applySubstrateToggle()'s pooledHits branch instead of
      // just its own local-only substrate. Omitted (not merely empty) when not gathered, so
      // an old responder build sees no new field at all -- matches this file's existing
      // convention of only adding opt-in fields the responder explicitly checks for.
      ...(pooledEblets && pooledEblets.length > 0 ? { pooled_substrate_eblets: pooledEblets } : {}),
      // BP137 Yoke v2b Stage E: see isStarChamber param doc above -- omitted entirely (not
      // `false`) unless a Stage E caller explicitly opts in, preserving byte-identical
      // payload_json for every existing caller.
      ...(isStarChamber ? { is_star_chamber: true } : {}),
      // BP137 Yoke v2b Stage F3 (mesh synergy): see researchArmMeshSynergy/assignedAuthority
      // param docs above -- both omitted entirely (not `false`/`undefined`) unless a Stage F3
      // caller explicitly opts in, preserving byte-identical payload_json for every existing
      // caller (dispatchStarChamberQuestionToPeer above, and dispatchQuestionToWanPeers's own
      // pre-Stage-F3 call shape).
      ...(researchArmMeshSynergy ? { research_arm_mesh_synergy: true } : {}),
      ...(assignedAuthority ? { assigned_authority: assignedAuthority } : {}),
    },
    status: 'pending',
    session_id: sessionId,
    ttl_seconds: ttlSeconds,
    wire_format: 'json-legacy',
  };
  try {
    const res = await fetch(`${cfg.url}/rest/v1/relay_routes`, {
      method: 'POST',
      headers: {
        apikey: cfg.anonKey,
        Authorization: `Bearer ${cfg.anonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(`[wan_dispatch] relay_routes insert failed: HTTP ${res.status}`);
      return null;
    }
    const rows = (await res.json()) as Array<{ id: string }>;
    return rows[0]?.id ?? null;
  } catch (e) {
    console.error('[wan_dispatch] relay_routes insert error:', e);
    return null;
  }
}

// BP137 Yoke v2b Stage E: exported (was module-private), same rationale as insertRelayRoute
// above -- zero behavior change for existing callers, purely an added export declaration.
export async function pollForReply(
  cfg: SupabaseConfig,
  routeId: string,
  timeoutMs: number,
): Promise<{ answerJson: Record<string, unknown> | null; processingMs: number } | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    try {
      const res = await fetch(
        `${cfg.url}/rest/v1/relay_route_replies?route_id=eq.${routeId}&select=answer_json,processing_ms&limit=1`,
        {
          headers: { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}` },
          signal: AbortSignal.timeout(8_000),
        },
      );
      if (!res.ok) continue;
      const rows = (await res.json()) as Array<{ answer_json: Record<string, unknown> | null; processing_ms: number }>;
      if (rows.length > 0 && rows[0]) {
        return { answerJson: rows[0].answer_json, processingMs: rows[0].processing_ms };
      }
    } catch {
      // transient poll error -- keep trying until deadline, matching the tolerant
      // polling style already used in plow/mesh_plow_dispatcher.ts
    }
  }
  return null;
}

function extractLetter(answerJson: Record<string, unknown> | null): { letter: string | null; isAbstain: boolean } {
  const raw = answerJson?.answer;
  if (typeof raw !== 'string') return { letter: null, isAbstain: false };
  if (raw.toUpperCase() === 'ABSTAIN') return { letter: null, isAbstain: true };
  const m = raw.trim().toUpperCase().match(/^([A-J])/);
  return { letter: m ? m[1] : null, isAbstain: false };
}

// BP133 Yoke #24 Task 2: pulls the Truth-Always answered_by/plow_trace fields the responder
// now writes into every answer_json (see index.ts's startRelayRoutePoll). Tolerant of legacy
// replies that predate these fields -- answeredBy comes back undefined, not a guess.
function extractPlowFields(answerJson: Record<string, unknown> | null): {
  answeredBy: WanPeerAnswer['answeredBy'];
  plowTrace: Record<string, unknown> | null | undefined;
} {
  const answeredByRaw = answerJson?.answered_by;
  const answeredBy = answeredByRaw === 'plow' || answeredByRaw === 'minor_council' || answeredByRaw === 'single_shot'
    ? answeredByRaw : undefined;
  const plowTrace = (answerJson?.plow_trace as Record<string, unknown> | null | undefined) ?? undefined;
  return { answeredBy, plowTrace };
}

/** Ported near-verbatim from mesh_plow_dispatcher.ts's computeVariance() (lines 126-132) --
 *  that dead dispatcher's arithmetic was sound, only its schema/auth were broken (see the
 *  module header note at the top of this file). Population variance of a numeric array. */
function computeVariance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sq = values.reduce((sum, v) => sum + (v - mean) ** 2, 0);
  return sq / values.length;
}

/** BP135 Phase 2 Layer A: default Andon threshold on the 0/100 agreement-variance scale
 *  documented below. For an N-peer mesh, unanimous agreement always produces variance 0;
 *  any single dissenting peer (or an abstain/timeout/no-letter peer) produces a variance
 *  well above 1000 (e.g. a 3-peer 2-1 split scores 2222 -- see the worked example in the
 *  computeConsensus() doc comment). 1000 therefore means "Andon fires on ANY disagreement
 *  in the mesh, not just a near-even split" -- deliberately sensitive, tunable per caller. */
const DEFAULT_ANDON_THRESHOLD = 1000;

/**
 * BP135 Phase 2 (Layer A: consensus over the fan-out wan_dispatch already proves). Plurality
 * vote + variance + Andon trigger, ported near-verbatim from mesh_plow_dispatcher.ts's dead
 * dispatch logic (letterCounts/maxVotes loop at lines 438-453, computeVariance() at lines
 * 126-132/456, Andon threshold check at lines 456-457) -- that ALGORITHM was never wrong, only
 * the schema/auth around it (see module header + WanPeerAnswer doc comment).
 *
 * DELIBERATELY DOES NOT use WanPeerAnswer.isCorrect (or any answer-key-derived signal) as the
 * variance source: correctness requires the sealed answer key, which the plow/responder never
 * sees, so any confidence/Andon signal built from correctness would be circular and would
 * contaminate the very thing this mesh test measures (see the BP135 Yoke doc, Phase 2).
 * mesh_plow_dispatcher.ts's original variance source -- a peer-self-reported numeric
 * `confidence` field -- does not exist on WanPeerAnswer at all (Bishop-verified: only
 * answerLetter/isAbstain/isCorrect/timedOut/processingMs/answeredBy/plowTrace, see the
 * WanPeerAnswer doc comment above).
 *
 * PRIMARY variance source chosen here (answer-key-blind, needs no responder change): the
 * spread of the peers' answer LETTERS themselves. Cross-peer agreement IS the natural
 * mesh-consensus variance -- three peers landing on the same letter is a real low-variance
 * signal about the mesh's convergence, independent of whether that letter happens to be
 * right. Each peer contributes an agreement score of 100 (its answerLetter equals the
 * plurality winner) or 0 (it disagrees, abstained, timed out, or produced no parseable
 * letter -- an absent vote is not agreement). computeVariance() over those 0/100 scores is
 * a Bernoulli variance p*(1-p)*100^2 where p is the agreeing fraction: unanimous agreement
 * -> 0; a 3-peer 2-1 split -> (2/3)(1/3)*10000 ~= 2222; total 3-way disagreement -> also
 * ~2222 by the same symmetric formula. This needs no change to the responder (index.ts) or
 * to what a peer reports -- it is computed entirely from data wan_dispatch already collects.
 *
 * SECONDARY variance source (not wired as the Andon trigger here, but available to a future
 * caller without further plumbing): each peer's own plowTrace.concordance when
 * answeredBy === 'plow' (see extractPlowFields() above) -- also answer-key-blind, since
 * concordance measures agreement among the plow's internal specialist voters, not correctness
 * against the sealed key. Left as a documented option rather than the default because it is
 * only present for plow-answered outcomes (undefined for single_shot/minor_council), whereas
 * the letter-spread source above is always computable for any WanPeerAnswer shape.
 */
export function computeConsensus(
  peerAnswers: WanPeerAnswer[],
  andonThreshold: number = DEFAULT_ANDON_THRESHOLD,
): WanConsensusResult {
  const letterCounts = new Map<string, number>();
  for (const pa of peerAnswers) {
    if (pa.answerLetter) {
      letterCounts.set(pa.answerLetter, (letterCounts.get(pa.answerLetter) ?? 0) + 1);
    }
  }

  let consensusLetter: string | null = null;
  let maxVotes = 0;
  for (const [letter, count] of letterCounts.entries()) {
    if (count > maxVotes) { maxVotes = count; consensusLetter = letter; }
  }

  const agreementScores = peerAnswers.map((pa) =>
    pa.answerLetter !== null && pa.answerLetter === consensusLetter ? 100 : 0,
  );
  const confidenceVariance = computeVariance(agreementScores);
  const andonTriggered = confidenceVariance > andonThreshold;

  return { consensusLetter, confidenceVariance, andonTriggered };
}

/**
 * Dispatches a single question to every peer in `peers` in parallel via relay_routes,
 * waits (bounded by perQuestionTimeoutMs) for each peer's relay_route_replies row, and
 * scores each peer's answer against question.answer independently. Consensus/voting across
 * peer answers IS computed here (see computeConsensus() above) and returned alongside the
 * per-peer outcomes -- per-peer honesty is preserved so the caller can show both per-peer
 * and aggregate accuracy without collapsing disagreement into a single synthetic answer.
 */
export async function dispatchQuestionToWanPeers(
  question: MmluProQuestion,
  peers: WanPeerInfo[],
  sessionId: string,
  perQuestionTimeoutMs: number = 90_000,
  // BP133 Yoke #24 Task 1: explicit, defaults to false (existing behavior preserved).
  // Threaded into payload_json.substrate_enabled -- see insertRelayRoute above.
  substrateEnabled: boolean = false,
  // BP133 Yoke #24 Task 2: explicit opt-in, both default false (existing single-shot
  // behavior preserved for every caller that does not pass these).
  plowEnabled: boolean = false,
  plowAndonEnabled: boolean = false,
  // BP135 Phase 3 (Layer B: federated substrate): explicit opt-in, defaults false. Ignored
  // (has no effect, no extra round-trips) when substrateEnabled is false -- nothing to pool.
  // When true, pools topical eblets from ALL of `peers` via queryTopicalEbletsFromPeers()
  // BEFORE the answer round, then threads the pooled index into every peer's own question
  // payload (see insertRelayRoute's pooledEblets param above).
  federatedSubstrateEnabled: boolean = false,
  // BP137 Yoke v2b (Research Arm): explicit opt-in, defaults false. See insertRelayRoute above.
  researchArmMode: boolean = false,
  // BP137 Yoke v2b Stage F3 (mesh synergy): explicit opt-in, defaults false. When true, each
  // peer in `peers` is assigned a DIFFERENT authority-role round-robin (see
  // assignMeshSynergyAuthority above) instead of every peer redundantly running the identical
  // full plow, and the peers' answers are pooled via computeMeshSynergyAdjudication() (Stage E's
  // adjudicateDistributedAuthorities, promoted to this normal path) into the returned
  // WanQuestionOutcome.meshSynergyPooled. When false/absent (every pre-Stage-F3 caller,
  // including every existing call to this function), no peer is ever assigned an authority,
  // no `assigned_authority`/`research_arm_mesh_synergy` key is ever added to any payload_json
  // (see insertRelayRoute's own conditional-spread), and meshSynergyPooled stays absent from
  // the returned outcome -- this function's behavior for that case is byte-for-byte unchanged.
  researchArmMeshSynergy: boolean = false,
): Promise<WanQuestionOutcome> {
  const correctLetter = question.answer.toUpperCase();
  const cfg = resolveSupabaseConfig();
  if (!cfg) {
    const peerAnswers: WanPeerAnswer[] = peers.map((p) => ({
      peerId: p.peerId, machineLabel: p.machineLabel, routeId: null, answerLetter: null,
      isAbstain: false, isCorrect: false, timedOut: false, processingMs: null,
      error: 'Supabase URL/anon key not configured',
    }));
    return {
      question_id: question.question_id,
      question: question.question,
      category: question.category,
      correctLetter,
      peerAnswers,
      consensus: computeConsensus(peerAnswers),
    };
  }

  const pooledEblets = (substrateEnabled && federatedSubstrateEnabled)
    ? await queryTopicalEbletsFromPeers(question, peers, sessionId)
    : undefined;

  const ttlSeconds = Math.ceil(perQuestionTimeoutMs / 1000) + 60;
  const peerAnswers = await Promise.all(peers.map(async (peer, peerIndex): Promise<WanPeerAnswer> => {
    // BP137 Yoke v2b Stage F3: round-robin assignment computed PER QUESTION, PER PEER-SLOT --
    // peer 0 always gets 'user_google' for every question in this run, matching the spec's
    // literal "peer 0 -> Google, peer 1 -> Perplexity, peer 2 -> swarm" example. Undefined
    // (not merely 'swarm') when researchArmMeshSynergy is off, so insertRelayRoute's own
    // conditional spread never adds the field at all -- see that function's doc.
    const assignedAuthority = researchArmMeshSynergy ? assignMeshSynergyAuthority(peerIndex) : undefined;
    const routeId = await insertRelayRoute(
      cfg, peer.peerId, question, sessionId, ttlSeconds, substrateEnabled, plowEnabled, plowAndonEnabled, pooledEblets,
      researchArmMode, false, researchArmMeshSynergy, assignedAuthority,
    );
    if (!routeId) {
      return {
        peerId: peer.peerId, machineLabel: peer.machineLabel, routeId: null, answerLetter: null,
        isAbstain: false, isCorrect: false, timedOut: false, processingMs: null,
        error: 'relay_routes insert failed',
        ...(assignedAuthority ? { assignedAuthority } : {}),
      };
    }
    const reply = await pollForReply(cfg, routeId, perQuestionTimeoutMs);
    if (!reply) {
      return {
        peerId: peer.peerId, machineLabel: peer.machineLabel, routeId, answerLetter: null,
        isAbstain: false, isCorrect: false, timedOut: true, processingMs: null,
        ...(assignedAuthority ? { assignedAuthority } : {}),
      };
    }
    const { letter, isAbstain } = extractLetter(reply.answerJson);
    const { answeredBy, plowTrace } = extractPlowFields(reply.answerJson);
    return {
      peerId: peer.peerId,
      machineLabel: peer.machineLabel,
      routeId,
      answerLetter: letter,
      isAbstain,
      isCorrect: letter !== null && letter === correctLetter,
      timedOut: false,
      processingMs: reply.processingMs,
      answeredBy,
      plowTrace,
      ...(assignedAuthority ? { assignedAuthority } : {}),
    };
  }));

  // BP137 Yoke v2b Stage F3, build item 3: pool + adjudicate the per-peer, per-assigned-
  // authority answers. Only attempted when this dispatch actually opted into mesh synergy --
  // computeMeshSynergyAdjudication() itself also degrades to null gracefully if, for any
  // reason, zero peerAnswers ended up with an assignedAuthority (e.g. all peers failed before
  // routeId was even created), so this is defense-in-depth, not the only guard.
  const meshSynergyPooled = researchArmMeshSynergy
    ? computeMeshSynergyAdjudication(peerAnswers) ?? undefined
    : undefined;

  return {
    question_id: question.question_id,
    question: question.question,
    category: question.category,
    correctLetter,
    peerAnswers,
    consensus: computeConsensus(peerAnswers),
    ...(meshSynergyPooled ? { meshSynergyPooled } : {}),
  };
}
