// substrate_publish.ts -- D-BP223-BM04-X033S3-009 STEP 1c; LIVE PATH WIRED by X039, D-BP223-PQ004-006 (2026-09-25)
//
// "Add to the Substrate" (spec Section 5). proveit.substrateLive (settings.ts) defaults TRUE since
// 0.9.35. When false: the card goes to the local outbox (~/.mnemosynec/proveit_outbox.jsonl) and the
// UI says "queued for the substrate". When true: the card is published through the SECURITY DEFINER
// RPC public.publish_question (migration platform/supabase/migrations/
// 20260925223000_bp223_x039_001_proof2_publish_question_rpc.sql, applied live 2026-09-25T22:39:28Z),
// the SAME function mnemosynec.org/asked/publish/ calls. Direct table writes are no longer granted to
// anyone, so the RPC is the only way in. It checks that the caller is signed in, that the persona is
// the caller's, the category, who answered, the lengths and the sources, and it RECOMPUTES THE CARD
// ADDRESS from the card's own bytes and refuses a mismatch. The address rule is card_store.ts's
// computeCardAddress(), byte-identical in Postgres (tested with emoji, CJK, control characters).
//
// IDENTITY: the member's own Liana Banyan session from lb_auth.ts (email sign-in link ->
// mnemo://auth/callback -> safeStorage). Tokens are never logged (Blood Rule R16). The card is
// published under a PERSONA, never under the account: the request may name personaId; otherwise the
// member's only persona is used, and with none or several the publish is refused with a clear reason
// (a persona picker in the renderer is the follow-up; personas can be made at mnemosynec.org/asked/publish/).
//
// FAILS SOFT: any refusal or network failure queues the card to the outbox with the reason, so the
// person's contribution is never lost, and the result says queued, never "published".
// lb_auth is imported LAZILY: it pulls in electron, which the vitest run must never load.

import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'fs';
import { dirname } from 'path';
import { loadProveItSettings } from './settings';
import { appendToOutbox } from './outbox';
import { updateCard, findCardByAddress, computeCardAddress } from './card_store';
import { emitTicker, newRunId } from './ticker';
import type { ProveItCard } from '../../shared/proveit_contract';
import { seedLoadedMarkerPath } from './userdata_paths';

const UNLOCK_EVENT_PATH = () => seedLoadedMarkerPath().replace(/seed_loaded\.json$/, 'unlock_events.json');

export interface AddToSubstrateResult {
  ok: boolean;
  card: ProveItCard | null;
  queued: boolean;
  error?: string;
  /** substrate_questions.id when the card went live. */
  substrateId?: string;
}

export interface LivePublishOutcome {
  ok: boolean;
  error?: string;
  substrateId?: string;
  publishedAt?: string;
  personaSlug?: string;
}

/** Everything the live path needs from the outside world, injectable so tests never touch the
 *  network, electron or a real session. */
export interface LivePublishDeps {
  getSession: () => Promise<{ access_token: string } | null>;
  supabaseUrl: () => string;
  anonKey: () => string;
  fetchFn: typeof fetch;
}

async function defaultDeps(): Promise<LivePublishDeps> {
  // A test must never reach a real session: this machine may hold a linked member session, and a
  // test card published under it would be a real publication. Tests inject fakes instead.
  if (process.env.VITEST) throw new Error('live publish disabled under vitest; inject deps with _setLivePublishDepsForTests');
  const auth = await import('../lb_auth');
  const keys = await import('../shared/anon_key');
  return {
    getSession: () => auth.getValidLBSession(),
    supabaseUrl: () => keys.getSupabaseUrl(),
    anonKey: () => keys.getAnonKey(),
    fetchFn: fetch,
  };
}

let _depsOverride: LivePublishDeps | null = null;
/** Tests only: replace the live dependencies (null restores the real ones). */
export function _setLivePublishDepsForTests(deps: LivePublishDeps | null): void {
  _depsOverride = deps;
}

async function getDeps(): Promise<LivePublishDeps> {
  return _depsOverride ?? (await defaultDeps());
}

function rpcMessage(res: { status: number; data: any }): string {
  return res.data && typeof res.data === 'object' && 'message' in res.data ? String(res.data.message) : `HTTP ${res.status}`;
}

/** The signed-in member's personas, for the renderer's picker. Never throws; never logs a token. */
export async function listMyPersonasLive(): Promise<{ ok: boolean; signedIn: boolean; personas: Array<{ id: string; displayName: string; slug: string }>; error?: string }> {
  try {
    const deps = await getDeps();
    const session = await deps.getSession();
    if (!session) return { ok: true, signedIn: false, personas: [] };
    const res = await rpc(deps, session.access_token, 'list_my_personas', {});
    if (res.status !== 200 || !Array.isArray(res.data)) return { ok: false, signedIn: true, personas: [], error: rpcMessage(res) };
    return {
      ok: true,
      signedIn: true,
      personas: res.data.map((p: any) => ({ id: String(p.id), displayName: String(p.display_name), slug: String(p.slug) })),
    };
  } catch (err) {
    return { ok: false, signedIn: false, personas: [], error: `UNAVAILABLE: ${String(err)}` };
  }
}

const ANSWERED_BY_PUBLISHABLE = new Set(['claude', 'chatgpt', 'gemini', 'perplexity', 'google', 'by_hand']);
const ISO_MS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

async function rpc(deps: LivePublishDeps, token: string, fn: string, body: unknown): Promise<{ status: number; data: any }> {
  const r = await deps.fetchFn(`${deps.supabaseUrl()}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: deps.anonKey(), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let data: any = text;
  try { data = JSON.parse(text); } catch { /* keep text */ }
  return { status: r.status, data };
}

/** Publishes one card through public.publish_question. Never throws; never logs a token. */
export async function insertIntoSubstrateQuestionsLive(card: ProveItCard, opts: { personaId?: string } = {}): Promise<LivePublishOutcome> {
  const settings = loadProveItSettings();
  if (!settings.substrateLive) return { ok: false, error: 'REFUSED: proveit.substrateLive is false' };
  if (card.isSeed) return { ok: false, error: 'REFUSED: seed cards are already on the substrate and are not republished' };
  if (!ANSWERED_BY_PUBLISHABLE.has(card.answeredBy)) return { ok: false, error: `REFUSED: answered_by ${card.answeredBy} cannot be published by a member` };
  if (!ISO_MS.test(card.madeAt)) return { ok: false, error: 'REFUSED: madeAt is not in toISOString form' };
  // The database recomputes this too; checking here first gives a clear local reason.
  const recomputed = computeCardAddress({ question: card.question, answer: card.answer, category: card.category, answeredBy: card.answeredBy, madeAt: card.madeAt });
  if (recomputed !== card.address) return { ok: false, error: 'REFUSED: this card was changed after it was made; its address no longer matches its content' };

  let deps: LivePublishDeps;
  try {
    deps = await getDeps();
  } catch (err) {
    return { ok: false, error: `UNAVAILABLE: ${String(err)}` };
  }
  try {
    const session = await deps.getSession();
    if (!session) return { ok: false, error: 'NOT_SIGNED_IN: sign in to your Liana Banyan account to publish' };

    let personaId = opts.personaId;
    if (!personaId) {
      const list = await rpc(deps, session.access_token, 'list_my_personas', {});
      if (list.status !== 200 || !Array.isArray(list.data)) return { ok: false, error: `PERSONAS_UNAVAILABLE: HTTP ${list.status}` };
      if (list.data.length === 0) return { ok: false, error: 'NO_PERSONA: make a persona first (mnemosynec.org/asked/publish/); cards are published under a persona, never under your account' };
      if (list.data.length > 1) return { ok: false, error: 'CHOOSE_PERSONA: you have more than one persona; choose which one publishes this card' };
      personaId = list.data[0].id as string;
    }

    const sources = (card.sources ?? [])
      .filter((s) => s && typeof s.url === 'string' && /^https?:\/\/[^\s<>"]+$/.test(s.url))
      .slice(0, 8)
      .map((s) => ({ label: String(s.label ?? s.url).slice(0, 300), url: s.url }));

    const pub = await rpc(deps, session.access_token, 'publish_question', {
      p_persona_id: personaId,
      p_category: card.category,
      p_question: card.question,
      p_answer: card.answer,
      p_answered_by: card.answeredBy,
      p_sources: sources,
      p_made_at: card.madeAt,
      p_address: card.address,
      p_valid_until: card.validUntil,
    });
    const row = Array.isArray(pub.data) ? pub.data[0] : null;
    if (pub.status !== 200 || !row) return { ok: false, error: `REFUSED_BY_SUBSTRATE: ${rpcMessage(pub)}` };
    if (row.address !== card.address) return { ok: false, error: 'MISMATCH: the substrate returned a different address' };
    return { ok: true, substrateId: row.id, publishedAt: row.published_at, personaSlug: row.persona_slug };
  } catch (err) {
    return { ok: false, error: `NETWORK: ${String(err)}` };
  }
}

export async function addCardToSubstrate(
  address: string,
  asker: { memberDisplay?: string; guestDisplay?: string },
  opts: { personaId?: string } = {},
): Promise<AddToSubstrateResult> {
  const runId = newRunId();
  const card = findCardByAddress(address);
  if (!card) {
    return { ok: false, card: null, queued: false, error: `no card at address ${address}` };
  }

  const settings = loadProveItSettings();
  const now = new Date().toISOString();

  // Local state is written BEFORE any network wait, so the card reads as published (queued) at once
  // and nothing the person did is lost if the app closes mid-request.
  const queuedCard = updateCard(address, { publishedAt: now, queuedForSubstrate: true });

  if (!settings.substrateLive) {
    appendToOutbox({ kind: 'add_to_substrate', address, queuedAt: now, payload: { asker } });
    emitTicker(runId, 'published', `queued for the substrate . address hex:${address} . will publish once the substrate is live`);
    recordUnlockEvent(address);
    return { ok: true, card: queuedCard, queued: true };
  }

  const live = await insertIntoSubstrateQuestionsLive(card, opts);
  if (!live.ok) {
    appendToOutbox({ kind: 'add_to_substrate', address, queuedAt: now, payload: { asker, liveAttemptError: live.error } });
    emitTicker(runId, 'published', `queued for the substrate (not published yet: ${live.error}) . address hex:${address}`);
    return { ok: true, card: queuedCard, queued: true, error: live.error };
  }
  const updated = updateCard(address, { publishedAt: live.publishedAt ?? now, queuedForSubstrate: false, substrateId: live.substrateId ?? null });
  emitTicker(runId, 'published', `published under ${live.personaSlug ?? 'your persona'} . address hex:${address} . now reachable by anyone`);
  recordUnlockEvent(address);
  return { ok: true, card: updated, queued: false, substrateId: live.substrateId };
}

/** "Take it back" from the app (spec Section 5, 10 minutes). A LIVE card (it has a substrateId) is
 *  taken back on the shared substrate through rpc/unpublish_own_substrate_question, which checks
 *  that the caller asked it and that the window is open; the local copy is marked only after the
 *  substrate agrees. A card that was only QUEUED is taken back locally. Never throws. */
export async function takeBackCard(address: string): Promise<{ ok: boolean; card?: ProveItCard; error?: string }> {
  const card = findCardByAddress(address);
  if (!card) return { ok: false, error: `no card at address ${address}` };
  if (!card.publishedAt) return { ok: false, error: 'not published' };
  if (card.unpublishedAt) return { ok: false, error: 'already taken back' };

  if (!card.substrateId) {
    const local = unpublishOwnCard(address);
    return local.ok ? { ok: true, card: findCardByAddress(address) ?? undefined } : local;
  }

  try {
    const deps = await getDeps();
    const session = await deps.getSession();
    if (!session) return { ok: false, error: 'NOT_SIGNED_IN: sign in to your Liana Banyan account to take a card back' };
    const res = await rpc(deps, session.access_token, 'unpublish_own_substrate_question', { p_question_id: card.substrateId });
    if (res.status !== 200) return { ok: false, error: rpcMessage(res) };
    if (res.data !== true) return { ok: false, error: 'the substrate says this card was not published, or was already taken back' };
    const updated = updateCard(address, { unpublishedAt: new Date().toISOString() });
    emitTicker(newRunId(), 'published', `taken back . address hex:${address} . nobody else can see it now`);
    return { ok: true, card: updated ?? undefined };
  } catch (err) {
    return { ok: false, error: `NETWORK: ${String(err)}` };
  }
}

/** Self-unpublish within 10 minutes (spec Section 5). After the window, only a supersede is ever
 *  used again (provenance law) -- this function refuses rather than flipping unpublishedAt past
 *  the window, mirroring unpublish_own_substrate_question()'s own 10-minute check. LOCAL ONLY: a
 *  live card goes through takeBackCard() above. */
export function unpublishOwnCard(address: string): { ok: boolean; error?: string } {
  const card = findCardByAddress(address);
  if (!card) return { ok: false, error: `no card at address ${address}` };
  if (!card.publishedAt) return { ok: false, error: 'not published' };
  const elapsedMs = Date.now() - Date.parse(card.publishedAt);
  if (elapsedMs > 10 * 60 * 1000) {
    return { ok: false, error: 'the 10-minute self-unpublish window has closed; this card can only be superseded now' };
  }
  updateCard(address, { unpublishedAt: new Date().toISOString() });
  return { ok: true };
}

/** Records that region D's one-time "unlocked" highlight is owed on the next listSomebodyElse()
 *  call after a first-ever publish -- a small file rather than in-memory state so it survives a
 *  renderer reload between the publish and the next region D read. */
function recordUnlockEvent(address: string): void {
  const path = UNLOCK_EVENT_PATH();
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  appendFileSync(path.replace(/\.json$/, '.jsonl'), JSON.stringify({ address, at: new Date().toISOString() }) + '\n', 'utf-8');
}

export function _readUnlockEventsForTests(): Array<{ address: string; at: string }> {
  const path = UNLOCK_EVENT_PATH().replace(/\.json$/, '.jsonl');
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf-8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}
