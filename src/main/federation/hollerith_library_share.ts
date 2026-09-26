/**
 * hollerith_library_share.ts -- D-BP223-BM0-X029-007-MESH-CARDS-M2
 *
 * THE ALEXANDRIAN LIBRARY COPY, OVER THE MESH, FOR HOLLERITH CARDS.
 *
 * Founder (2026-09-16 ~19:05Z, verbatim): "Hollerith Cards through the Mesh ... those are literally just the Code Mazes
 * hardcoded into Eblets, which we reference by Hex Connector in the Data Silo of Data Crystals ... searchable by M2 by
 * Tag and Keyword, and therefore can be PULLED by Copying via Alexandrian Library Copy Method into the Data Silos that
 * M2 stores with it's own Chocolates etc to run Mnemosynec THERE". Pick 1 = A (k/cffd74b0): the REAL MnemosyneC share
 * route, not the WinRM courier. Earlier ruling (k/eabeb154): "any request COPIES your Data Silo Tagged Eblet Crystals
 * to the requesting NODE, such that they then have a LIBRARY CACHE".
 *
 * PRIOR-WORK CHECK (Law 4): the build gate's only name-token match was this dispatch's own export crystal json.
 * mcp_server.ts mnem_share_eblet_to_peer was an explicit not_implemented stub (KN-BP147-M1); peer_server.ts had no
 * eblet route (7 routes); peer_artifact_server.ts serves only installer .exe files. This module fills that named gap.
 *
 * WHAT THIS EXTENDS (nothing here is a second scheme):
 *   - Eblets: plain `*.eblet.md` with YAML frontmatter; `tags:` in the flow-list form mnem_eblet_store.ts
 *     parseTagsFromFrontmatter() already reads. The silo is `{userData}\eblets\hollerith`, inside the `{userData}\eblets`
 *     root mnem_eblet_store.ts already walks recursively -- so a pulled card is in the requesting node's own substrate.
 *   - Hex connector: the estate's Soccerball address, re-derived exactly as the librarian's soccerball_emit mints it:
 *     sha256(JSON.stringify(sortedPearls)).slice(0, 32). Measured 2026-09-16T19:12Z (probe bf9366ba..., card qid 70
 *     a73d4f6c..., 190-card library crystal 9fff285b... all minted by soccerball_emit and re-derived identically).
 *   - Peer trust: the SAME signed hex-mcode frame (announce_frame.ts: encodeFrame + Thorax Ed25519) and the SAME key
 *     resolution order peer_server.ts already uses for /api/plow-domain and /api/diagnosis/*: enrolled registry key
 *     first, then a previously-known key, then (only if the caller's context allows it) the key self-declared inside the
 *     frame. A signature that is present and fails is ALWAYS refused. Unsigned requests are refused (content-bearing).
 *   - Integrity back to the requester: the publisher SIGNS the manifest (connector -> sha256) with its own Thorax key;
 *     the requester verifies that signature, then refuses to write any file whose sha256 differs from the signed manifest.
 *   - Rule 66 on the receiving side: an existing different file is copied to a `.superseded.<UTC>.md` sibling first.
 *
 * WHAT IS SHAREABLE: only files that say so. A silo file is listed or served ONLY when its frontmatter carries
 * `mesh_share: true`, a `leak_scan:` value beginning with `clean`, a 32-hex `hex_connector` that re-derives from its
 * `connector_pearl`, and a body whose sha256 equals `card_text_sha256`. Anything else in the directory is invisible to
 * peers. Nothing outside the silo directory can be named (basename-only file names, no path segments).
 *
 * This module is PURE (fs, path, crypto, the wire + Thorax verify helpers). Electron-specific wiring (userData path,
 * the node's own keypair, the enrollment registry path) is injected by peer_server.ts / mcp_server.ts, which is what
 * lets the scratch pair run the identical code in two plain Node processes.
 */

import { createHash, randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { peekAnnouncePayload, verifyAnnounceFrame } from './announce_frame';
// D-BP223-BM0-X030-207: ORIGIN + TRAIL provenance tags travel with a copied card; the requester appends its signed TRAIL hop.
import { acceptSharedProvenance, provenanceForShare, type TagSigner } from './eblet_provenance_tags';

export const LIBRARY_SEARCH_PATH = '/api/library/search';
export const LIBRARY_FETCH_PATH = '/api/library/fetch';
/** D-BP223-PQ005-012-X041 (Founder 2026-09-26 ~03:35Z: "Make WORK the one-click share-to-a-peer"): the PUSH. One verified card,
 *  offered by its holder to ONE peer, accepted only on that peer's consent, answered with a receipt the receiver signs. */
export const LIBRARY_OFFER_PATH = '/api/library/offer';
export const LIBRARY_PROTOCOL = 'lb.hollerith_library.v1';
/** A request frame older (or newer) than this is refused as a replay. */
export const LIBRARY_REQUEST_MAX_SKEW_MS = 10 * 60_000;
export const LIBRARY_MAX_FETCH_PER_REQUEST = 60;
/** D-BP223-BM0-X029-022: the source kinds a shared card may declare (card_source_contract/1.0.0). */
export const SHARE_SOURCE_KINDS: readonly string[] = ['url', 'doi', 'isbn', 'edition_page', 'statute', 'standard', 'flagship_cited_source', 'none_found'];
/**
 * D-BP223-BM0-X030-067 PICK B (Founder k/dc99f6ff, 2026-09-17T00:07Z, verbatim: "B, but backfill as able, and don't let it fall
 * to the wayside."):
 *   - a card WITHOUT a checkable source (source_status source_pending, source_kind none_found) MAY be shared between the SAME
 *     OWNER'S OWN machines, and every such card is served with source_status + the visible label "source pending";
 *   - a source is still REQUIRED to seal a card (canSealSharedCard refuses source_pending) and to share with OTHER people's nodes
 *     (other-owner requests never list or fetch a source_pending card).
 * SAME OWNER is decided by the PERSON-LEVEL mesh identity (memory reference_mesh_identity_is_person_level_and_all_machines_are_wan
 * _bp148: identity is the person, never IP, hostname, LAN or physical location). Concretely: the requester's signature verified
 * against an ENROLLED key (TOTP-gated enrollment order, never TOFU / self-declared / known), AND that enrollment record's owner_id
 * equals this node's own owner_id (the LB session email hash, the same value presence publishes as email_hash). An owner id the
 * requester merely CLAIMS in its frame never grants same-owner; if the claim disagrees with the enrollment record it downgrades to
 * other-owner. Every machine is treated as WAN: nothing here reads a socket address.
 */
export const SOURCE_PENDING_LABEL = 'source pending';
/** not_a_card: package support files (executor code, manifest, no-gold questions, the contract) that are not Hollerith cards. */
export const SHARE_SOURCE_STATUSES: readonly string[] = ['sourced', 'source_pending', 'not_a_card'];
export type ShareSourceStatus = 'sourced' | 'source_pending' | 'not_a_card';
export type SharePolicy = 'same_owner' | 'other_owner';
const OWNER_ID_RE = /^[0-9a-f]{16,64}$/;
const SAFE_NAME = /^[A-Za-z0-9._-]+\.eblet\.md$/;

const sha256Hex = (s: string | Buffer): string => createHash('sha256').update(s).digest('hex');

/** The estate's Soccerball address rule (see header). */
export function soccerballAddress(pearls: string[]): string {
  return sha256Hex(JSON.stringify([...pearls].sort())).slice(0, 32);
}

// ─── Frontmatter + silo index ────────────────────────────────────────────────────────────────

export interface ParsedLibraryEblet {
  fields: Record<string, string>;
  tags: string[];
  keywords: string[];
  body: string;
}

function unquote(v: string): string {
  const t = v.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  return t;
}
function flowList(v: string | undefined): string[] {
  if (!v) return [];
  const m = v.trim().match(/^\[(.*)\]$/);
  const inner = m ? m[1] : v;
  return inner.split(',').map((x) => unquote(x).trim().toLowerCase()).filter(Boolean);
}

/** Parses the `---` frontmatter this dispatch's exporter writes. Returns null when there is no frontmatter. */
export function parseLibraryEblet(text: string): ParsedLibraryEblet | null {
  const norm = text.replace(/^﻿/, '');
  if (!norm.startsWith('---\n') && !norm.startsWith('---\r\n')) return null;
  const end = norm.indexOf('\n---', 3);
  if (end === -1) return null;
  const fmText = norm.slice(norm.indexOf('\n') + 1, end);
  let bodyStart = end + 4;
  if (norm[bodyStart] === '\r') bodyStart++;
  if (norm[bodyStart] === '\n') bodyStart++;
  const fields: Record<string, string> = {};
  for (const line of fmText.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (m) fields[m[1]] = m[2];
  }
  return { fields, tags: flowList(fields.tags), keywords: flowList(fields.keywords), body: norm.slice(bodyStart) };
}

export interface LibraryConnector {
  connector: string;
  file: string;
  sha256: string;
  bytes: number;
  qid: number | null;
  title: string;
  kind: string;
  tags: string[];
  keywords: string[];
  provenance: string | null;
  cardTextSha256: string;
  /** X030-067: sourced | source_pending | not_a_card */
  sourceStatus: ShareSourceStatus;
  sourceKind: string;
  /** X030-067: "source pending" for a source_pending card (the visible label), otherwise null */
  sourceLabel: string | null;
  /** X030-067: only a sourced card can be sealed */
  sealable: boolean;
}

/** X030-067: a file that is (or belongs to) a Hollerith card can never claim not_a_card. */
function isCardLike(f: Record<string, string>, tags: string[]): boolean {
  if (unquote(f.kind ?? '') === 'hollerith_card') return true;
  if (unquote(f.qid ?? '') !== '') return true;
  if (tags.some((t) => /^qid-\d+$/.test(t) || t === 'code-maze-card' || t === 'card-addendum' || t === 'hollerith-card' || t === 'source-addendum')) return true;
  const p = unquote(f.pkg_path ?? '');
  return /^(cards|source_addenda)\//.test(p);
}

/** X030-067 pick B: a source_pending card is shared only with the same owner; sourced cards and support files go to anyone allowed. */
export function shareableUnderPolicy(entry: Pick<LibraryConnector, 'sourceStatus'>, policy: SharePolicy): boolean {
  return entry.sourceStatus !== 'source_pending' || policy === 'same_owner';
}

/** X030-067: sealing still REQUIRES a source. Refuses source_pending (and not_a_card, which is not a card). */
export function canSealSharedCard(entry: Pick<LibraryConnector, 'sourceStatus' | 'sourceKind'>): { ok: true } | { ok: false; reason: string } {
  if (entry.sourceStatus === 'source_pending') return { ok: false, reason: 'CARD_SOURCE_REFUSED: source pending, a checkable source is required to seal (Founder k/dc99f6ff pick B)' };
  if (entry.sourceStatus !== 'sourced') return { ok: false, reason: 'not a Hollerith card, nothing to seal' };
  if (!SHARE_SOURCE_KINDS.includes(entry.sourceKind) || entry.sourceKind === 'none_found') return { ok: false, reason: 'CARD_SOURCE_REFUSED: source_kind invalid for a seal' };
  return { ok: true };
}

export interface SiloIndex {
  siloDir: string;
  connectors: LibraryConnector[];
  skipped: { file: string; reason: string }[];
}

/** Validates ONE silo file against the shareability rule in the header. */
export function validateShareableEblet(file: string, content: string): { ok: true; entry: LibraryConnector } | { ok: false; reason: string } {
  const parsed = parseLibraryEblet(content);
  if (!parsed) return { ok: false, reason: 'no frontmatter' };
  const f = parsed.fields;
  if (unquote(f.mesh_share ?? '') !== 'true') return { ok: false, reason: 'mesh_share is not true' };
  if (!/^clean/.test(unquote(f.leak_scan ?? ''))) return { ok: false, reason: 'leak_scan is not clean' };
  // D-BP223-BM0-X029-022 SOURCE REQUIRED (Founder k/cc4cb690: a source "MUST BE REQUIRED for EVERY CARD"). The same contract as
  // HARDWIRE/tools/facts/card_source/card_source_contract.cjs: the exporter writes source_status (sourced | source_pending) and
  // source_kind (url|doi|isbn|edition_page|statute|standard|flagship_cited_source | none_found). A card without them is not served.
  const sourceStatus = unquote(f.source_status ?? '');
  const sourceKind = unquote(f.source_kind ?? '');
  if (!SHARE_SOURCE_STATUSES.includes(sourceStatus)) return { ok: false, reason: 'source_status missing or invalid: every Hollerith card must carry a source (sourced) or none_found (source_pending)' };
  if (sourceStatus === 'not_a_card') {
    // X030-067: package support files only. A card, a card addendum or a source addendum can never opt out of the source rule.
    if (sourceKind !== 'not_applicable') return { ok: false, reason: 'source_kind must be not_applicable for not_a_card' };
    if (isCardLike(f, parsed.tags)) return { ok: false, reason: 'a Hollerith card (or its addendum) cannot be marked not_a_card' };
  } else {
    if (!SHARE_SOURCE_KINDS.includes(sourceKind)) return { ok: false, reason: 'source_kind missing or invalid' };
    if ((sourceKind === 'none_found') !== (sourceStatus === 'source_pending')) return { ok: false, reason: 'source_kind and source_status disagree' };
  }
  const connector = unquote(f.hex_connector ?? '');
  if (!/^[0-9a-f]{32}$/.test(connector)) return { ok: false, reason: 'hex_connector missing or not 32 hex' };
  const pearl = unquote(f.connector_pearl ?? '');
  if (!pearl || soccerballAddress([pearl]) !== connector) return { ok: false, reason: 'hex_connector does not re-derive from connector_pearl' };
  const cardTextSha256 = unquote(f.card_text_sha256 ?? '');
  if (sha256Hex(parsed.body) !== cardTextSha256) return { ok: false, reason: 'body sha256 does not equal card_text_sha256' };
  const qidNum = Number(unquote(f.qid ?? ''));
  return {
    ok: true,
    entry: {
      connector, file, sha256: sha256Hex(content), bytes: Buffer.byteLength(content), qid: Number.isFinite(qidNum) && f.qid ? qidNum : null,
      title: unquote(f.title ?? file), kind: unquote(f.kind ?? ''), tags: parsed.tags, keywords: parsed.keywords,
      provenance: f.provenance ? unquote(f.provenance) : null, cardTextSha256,
      sourceStatus: sourceStatus as ShareSourceStatus, sourceKind,
      sourceLabel: sourceStatus === 'source_pending' ? SOURCE_PENDING_LABEL : null,
      sealable: sourceStatus === 'sourced',
    },
  };
}

export function buildSiloIndex(siloDir: string): SiloIndex {
  const out: SiloIndex = { siloDir, connectors: [], skipped: [] };
  if (!existsSync(siloDir)) return out;
  for (const name of readdirSync(siloDir)) {
    if (!SAFE_NAME.test(name) || /\.superseded\./.test(name)) continue;
    const p = join(siloDir, name);
    try { if (!statSync(p).isFile()) continue; } catch { continue; }
    const v = validateShareableEblet(name, readFileSync(p, 'utf8'));
    if (v.ok) out.connectors.push(v.entry); else out.skipped.push({ file: name, reason: v.reason });
  }
  out.connectors.sort((a, b) => a.file.localeCompare(b.file));
  return out;
}

export interface LibraryQuery {
  /** every tag listed must be present (case-insensitive) */
  tags?: string[];
  /** any keyword matching a tag, keyword or title word (case-insensitive substring) */
  keywords?: string[];
  /** exact hex connectors */
  connectors?: string[];
  limit?: number;
}

export function searchSilo(connectors: LibraryConnector[], q: LibraryQuery): LibraryConnector[] {
  const tags = (q.tags ?? []).map((t) => String(t).toLowerCase());
  const kws = (q.keywords ?? []).map((k) => String(k).toLowerCase()).filter(Boolean);
  const ids = new Set((q.connectors ?? []).map((c) => String(c).toLowerCase()));
  const hits = connectors.filter((c) => {
    if (ids.size && !ids.has(c.connector)) return false;
    if (tags.length && !tags.every((t) => c.tags.includes(t))) return false;
    if (kws.length) {
      const hay = [...c.tags, ...c.keywords, c.title.toLowerCase()];
      if (!kws.some((k) => hay.some((h) => h.includes(k)))) return false;
    }
    return true;
  });
  const limit = q.limit && q.limit > 0 ? Math.floor(q.limit) : hits.length;
  return hits.slice(0, limit);
}

// ─── Server side ─────────────────────────────────────────────────────────────────────────────

export type SenderTrust = 'enrolled' | 'known' | 'self_declared';

export interface LibraryRouteContext {
  siloDir: string;
  selfPeerId: string;
  /** enrolled registry first, then a previously-known key; null when neither exists */
  resolveSenderKey(peerId: string): { key: string; trust: 'enrolled' | 'known' } | null;
  /** whether a key self-declared inside the frame (trust on first use) may verify it; the diagnosis routes allow this */
  allowSelfDeclaredKey: boolean;
  /** signs a payload with THIS node's Thorax key; returns the signed hex frame, or null if no key is available */
  signPayload(seed: string, payload: Record<string, unknown>): string | null;
  now?: () => number;
  /** X030-067: THIS node's person-level owner id (LB session email hash). null/absent = unknown owner = never same-owner. */
  selfOwnerId?: string | null;
  /** X030-067: the owner_id bound to an ENROLLED peer by its (TOTP-gated) enrollment record; null when none is recorded. */
  resolveSenderOwnerId?(peerId: string): string | null;
  /** X030-207: this node's eblet tag ledger dir; when set, fetch serves each card's ORIGIN + TRAIL lines beside it. */
  tagsDir?: string | null;
  /** X041 push: decides what happens to an OFFERED card (accept into the silo, hold in the inbox for a person to accept, or
   *  refuse). Absent = defaultOfferConsent (same owner accepts; an enrolled or known stranger is held; a self-declared key is
   *  refused). The decision is signed into the receipt, so the sender always learns which one it got. */
  offerConsent?(input: OfferConsentInput): OfferConsentDecision;
  /** X041 push: where held offers wait for consent. Absent = offers that would be held are refused instead (nothing is kept). */
  inboxDir?: string | null;
  /** X041 push: signs this node's TRAIL hop when an accepted card lands (same signer the pull uses on the requester side). */
  tagSigner?: TagSigner | null;
}

export type OfferDecision = 'accept' | 'hold' | 'refuse';
export interface OfferConsentInput { senderPeerId: string; trust: SenderTrust; policy: SharePolicy; entry: LibraryConnector }
export interface OfferConsentDecision { decision: OfferDecision; reason: string }

/** The consent rule when the node supplies none: FD-BP156-04 "proximity must never imply consent" applied to a push. */
export function defaultOfferConsent(input: OfferConsentInput): OfferConsentDecision {
  if (input.policy === 'same_owner') return { decision: 'accept', reason: 'same owner (enrolled key bound to this node\'s owner id)' };
  if (input.trust === 'enrolled' || input.trust === 'known') return { decision: 'hold', reason: `${input.trust} peer, not this owner: held in the inbox until a person accepts it` };
  return { decision: 'refuse', reason: 'self-declared key only: no relationship with this node, nothing is kept' };
}

export interface LibraryRouteResult { status: number; body: Record<string, unknown> }

const normOwner = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return OWNER_ID_RE.test(s) ? s : null;
};

/**
 * X030-067 pick B: decide same_owner vs other_owner for a VERIFIED request. Person-level only (see SOURCE_PENDING_LABEL header):
 * enrolled key + enrollment-record owner_id === this node's owner_id. Never IP / host / LAN.
 */
export function resolveSharePolicy(
  trust: SenderTrust, senderPeerId: string, payload: Record<string, unknown>, ctx: Pick<LibraryRouteContext, 'selfOwnerId' | 'resolveSenderOwnerId'>,
): { policy: SharePolicy; reason: string } {
  const self = normOwner(ctx.selfOwnerId);
  if (!self) return { policy: 'other_owner', reason: 'this node has no owner id (not signed in)' };
  if (trust !== 'enrolled') return { policy: 'other_owner', reason: `requester trust is ${trust}; same-owner needs an enrolled key` };
  const bound = normOwner(ctx.resolveSenderOwnerId ? ctx.resolveSenderOwnerId(senderPeerId) : null);
  if (!bound) return { policy: 'other_owner', reason: 'enrollment record carries no owner_id' };
  if (bound !== self) return { policy: 'other_owner', reason: 'enrolled to a different owner' };
  const claimed = payload.requester_owner_id;
  if (claimed !== undefined && claimed !== null && normOwner(claimed) !== bound) {
    return { policy: 'other_owner', reason: 'requester_owner_id claimed in the frame disagrees with its enrollment record' };
  }
  return { policy: 'same_owner', reason: 'enrolled key bound to this node\'s owner id' };
}

export function resolveSignedLibraryRequest(
  body: string,
  ctx: LibraryRouteContext,
): { ok: true; payload: Record<string, unknown>; senderPeerId: string; trust: SenderTrust } | { ok: false; status: number; error: string } {
  let outer: { signed_frame?: unknown };
  try { outer = JSON.parse(body); } catch { return { ok: false, status: 400, error: 'request body is not valid JSON' }; }
  if (typeof outer.signed_frame !== 'string') {
    return { ok: false, status: 403, error: 'refused: library routes serve content and accept signed_frame requests only' };
  }
  const peeked = peekAnnouncePayload(outer.signed_frame);
  if (!peeked) return { ok: false, status: 400, error: 'signed_frame present but malformed (failed to decode)' };
  const senderPeerId = typeof peeked.payload.sender_peer_id === 'string' ? peeked.payload.sender_peer_id : '';
  if (!senderPeerId) return { ok: false, status: 400, error: 'signed_frame carries no sender_peer_id' };
  const resolved = ctx.resolveSenderKey(senderPeerId);
  let key: string | undefined = resolved?.key;
  let trust: SenderTrust | null = resolved?.trust ?? null;
  if (!key && ctx.allowSelfDeclaredKey && peeked.claimedPublicKeyHex) { key = peeked.claimedPublicKeyHex; trust = 'self_declared'; }
  if (!key || !trust) return { ok: false, status: 403, error: `refused: no enrolled or known key for "${senderPeerId}" and self-declared keys are not allowed here` };
  const verified = verifyAnnounceFrame(outer.signed_frame, key);
  if (!verified.valid || !verified.payload) return { ok: false, status: 403, error: `refused: ${verified.reason}` };
  if (verified.payload.protocol !== LIBRARY_PROTOCOL) return { ok: false, status: 400, error: `refused: protocol must be ${LIBRARY_PROTOCOL}` };
  const ts = Date.parse(String(verified.payload.ts ?? ''));
  const now = (ctx.now ?? Date.now)();
  if (!Number.isFinite(ts) || Math.abs(now - ts) > LIBRARY_REQUEST_MAX_SKEW_MS) {
    return { ok: false, status: 403, error: 'refused: request ts missing or outside the replay window' };
  }
  if (typeof verified.payload.nonce !== 'string' || verified.payload.nonce.length < 16) {
    return { ok: false, status: 400, error: 'refused: request nonce missing' };
  }
  return { ok: true, payload: verified.payload, senderPeerId, trust };
}

/** Returns null when the url/method is not a library route (the caller falls through to its own 404). */
export async function handleLibraryRoute(
  url: string,
  method: string,
  readBody: () => Promise<string>,
  ctx: LibraryRouteContext,
): Promise<LibraryRouteResult | null> {
  if (method !== 'POST' || (url !== LIBRARY_SEARCH_PATH && url !== LIBRARY_FETCH_PATH && url !== LIBRARY_OFFER_PATH)) return null;
  const req = resolveSignedLibraryRequest(await readBody(), ctx);
  if (!req.ok) return { status: req.status, body: { ok: false, error: req.error } };
  if (url === LIBRARY_OFFER_PATH) return handleOfferRequest(req.payload, req.senderPeerId, req.trust, ctx);
  const index = buildSiloIndex(ctx.siloDir);
  const share = resolveSharePolicy(req.trust, req.senderPeerId, req.payload, ctx);
  const allowed = index.connectors.filter((c) => shareableUnderPolicy(c, share.policy));
  const withheldAll = index.connectors.length - allowed.length;

  if (url === LIBRARY_SEARCH_PATH) {
    const q = (req.payload.query ?? {}) as LibraryQuery;
    const empty = !(q.tags?.length || q.keywords?.length || q.connectors?.length);
    if (empty) return { status: 400, body: { ok: false, error: 'query needs at least one of tags, keywords, connectors' } };
    const matchedAll = searchSilo(index.connectors, { ...q, limit: undefined });
    const hits = searchSilo(allowed, q);
    const withheldPending = matchedAll.filter((c) => !shareableUnderPolicy(c, share.policy)).length;
    const manifestPayload: Record<string, unknown> = {
      protocol: LIBRARY_PROTOCOL, kind: 'hollerith_library_manifest', publisher_peer_id: ctx.selfPeerId,
      requester_peer_id: req.senderPeerId, request_nonce: req.payload.nonce, issued_utc: new Date((ctx.now ?? Date.now)()).toISOString(),
      share_policy: share.policy,
      library_connector: soccerballAddress(hits.map((h) => h.connector)),
      connectors: hits.map((h) => ({ connector: h.connector, file: h.file, sha256: h.sha256, bytes: h.bytes, source_status: h.sourceStatus, source_label: h.sourceLabel })),
    };
    const signed = ctx.signPayload(String(req.payload.nonce), manifestPayload);
    return {
      status: 200,
      body: {
        ok: true, requester_trust: req.trust, publisher_peer_id: ctx.selfPeerId, count: hits.length,
        share_policy: share.policy, share_policy_reason: share.reason,
        source_pending_served: hits.filter((h) => h.sourceStatus === 'source_pending').length,
        source_pending_withheld: withheldPending,
        silo_listed: index.connectors.length, silo_withheld_by_policy: withheldAll, silo_not_shareable: index.skipped.length,
        connectors: hits, signed_manifest: signed,
      },
    };
  }

  const wanted = Array.isArray(req.payload.connectors) ? (req.payload.connectors as unknown[]).map(String) : [];
  if (!wanted.length) return { status: 400, body: { ok: false, error: 'fetch needs connectors[]' } };
  if (wanted.length > LIBRARY_MAX_FETCH_PER_REQUEST) {
    return { status: 400, body: { ok: false, error: `at most ${LIBRARY_MAX_FETCH_PER_REQUEST} connectors per fetch` } };
  }
  const byId = new Map(allowed.map((c) => [c.connector, c]));
  const pendingIds = new Set(index.connectors.filter((c) => !shareableUnderPolicy(c, share.policy)).map((c) => c.connector));
  const files: { connector: string; file: string; sha256: string; content: string; source_status: ShareSourceStatus; source_label: string | null; provenance?: string[] | null }[] = [];
  const missing: string[] = [];
  const withheld: string[] = [];
  for (const id of wanted) {
    const c = byId.get(id);
    if (!c) { if (pendingIds.has(id)) withheld.push(id); else missing.push(id); continue; }
    const content = readFileSync(join(ctx.siloDir, c.file), 'utf8');
    files.push({ connector: c.connector, file: c.file, sha256: sha256Hex(content), content, source_status: c.sourceStatus, source_label: c.sourceLabel, provenance: provenanceForShare(ctx.tagsDir, c.connector) });
  }
  return {
    status: 200,
    body: {
      ok: true, requester_trust: req.trust, publisher_peer_id: ctx.selfPeerId, share_policy: share.policy, share_policy_reason: share.reason,
      files, missing, withheld_source_pending: withheld,
    },
  };
}

// ─── Requester side (the PULL) ───────────────────────────────────────────────────────────────

export interface PullOptions {
  /** e.g. http://192.168.86.45:7474 */
  peerBaseUrl: string;
  senderPeerId: string;
  /** signs with THIS node's Thorax key; peer_server/mcp wiring passes signAnnouncePayload */
  signPayload(seed: string, payload: Record<string, unknown>): string | null;
  query: LibraryQuery;
  destDir: string;
  /** the publisher's Thorax public key as this node already knows it (enrolled / known). If absent, the key
   *  self-declared inside the signed manifest is used and the receipt says so (publisherKeyTrust: self_declared). */
  expectedPublisherKeyHex?: string | null;
  fetchImpl?: typeof fetch;
  batchSize?: number;
  /** X030-067: this node's person-level owner id, sent as requester_owner_id. Informational only: the publisher decides
   *  same-owner from its own enrollment record, never from this claim. */
  ownerId?: string | null;
  /** X030-207: when set, each copied card's served provenance is verified and kept, and this copy appends a signed TRAIL hop. */
  tags?: { tagsDir: string; signer: TagSigner } | null;
}

export interface PullFileReceipt {
  connector: string;
  file: string;
  sha256Manifest: string;
  sha256Received: string | null;
  action: 'written' | 'already_present' | 'replaced_with_superseded_sibling' | 'refused';
  reason?: string;
  /** X030-067: sourced | source_pending | not_a_card, from the received eblet (checked against the signed manifest) */
  sourceStatus?: ShareSourceStatus;
  /** X030-067: "source pending" when the card has no checkable source yet (visible label) */
  sourceLabel?: string | null;
  /** X030-067: SEALABLE only for sourced cards; source_pending is UNSEALABLE */
  sealState?: 'SEALABLE' | 'UNSEALABLE' | 'NOT_A_CARD';
  /** X030-207: hop_appended | no_provenance | refused (the card copy itself is unaffected by a tag refusal) */
  trail?: { action: string; reason?: string; trail_length?: number };
}

export interface PullReceipt {
  protocol: string;
  startedUtc: string;
  finishedUtc: string;
  peerBaseUrl: string;
  requesterPeerId: string;
  publisherPeerId: string | null;
  publisherKeyTrust: 'expected_key' | 'self_declared' | 'unverified';
  requesterTrustAtPublisher: string | null;
  query: LibraryQuery;
  listed: number;
  written: number;
  alreadyPresent: number;
  refused: number;
  libraryConnector: string | null;
  destDir: string;
  files: PullFileReceipt[];
  /** X030-067: the policy the publisher applied (signed inside its manifest) */
  sharePolicy: SharePolicy | null;
  sourced: number;
  sourcePending: number;
  notACard: number;
  /** X030-207: TRAIL hops appended for this pull */
  trailHops: number;
  error?: string;
}

function stampUtc(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}

type SignedPostOptions = Pick<PullOptions, 'peerBaseUrl' | 'senderPeerId' | 'signPayload' | 'ownerId' | 'fetchImpl'>;
async function postSigned(
  opts: SignedPostOptions, path: string, inner: Record<string, unknown>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const nonce = randomBytes(16).toString('hex');
  const payload: Record<string, unknown> = { ...inner, protocol: LIBRARY_PROTOCOL, sender_peer_id: opts.senderPeerId, nonce, ts: new Date().toISOString() };
  if (opts.ownerId) payload.requester_owner_id = opts.ownerId;
  const signed = opts.signPayload(nonce, payload);
  if (!signed) throw new Error('this node has no Thorax signing key available; refusing to send an unsigned library request');
  const f = opts.fetchImpl ?? fetch;
  const res = await f(opts.peerBaseUrl.replace(/\/+$/, '') + path, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ signed_frame: signed }),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try { json = JSON.parse(text); } catch { json = { ok: false, error: 'non-JSON response: ' + text.slice(0, 200) }; }
  return { status: res.status, json: { ...json, __nonce: nonce } };
}

export async function pullLibraryFromPeer(opts: PullOptions): Promise<PullReceipt> {
  const receipt: PullReceipt = {
    protocol: LIBRARY_PROTOCOL, startedUtc: new Date().toISOString(), finishedUtc: '', peerBaseUrl: opts.peerBaseUrl,
    requesterPeerId: opts.senderPeerId, publisherPeerId: null, publisherKeyTrust: 'unverified', requesterTrustAtPublisher: null,
    query: opts.query, listed: 0, written: 0, alreadyPresent: 0, refused: 0, libraryConnector: null, destDir: opts.destDir, files: [],
    sharePolicy: null, sourced: 0, sourcePending: 0, notACard: 0, trailHops: 0,
  };
  const done = (error?: string): PullReceipt => { if (error) receipt.error = error; receipt.finishedUtc = new Date().toISOString(); return receipt; };

  const search = await postSigned(opts, LIBRARY_SEARCH_PATH, { query: opts.query });
  if (search.status !== 200 || search.json.ok !== true) return done(`search refused: HTTP ${search.status} ${String(search.json.error ?? '')}`);
  receipt.requesterTrustAtPublisher = String(search.json.requester_trust ?? '');

  // Verify the publisher's signed manifest BEFORE trusting any listed sha256.
  const signedManifest = search.json.signed_manifest;
  if (typeof signedManifest !== 'string') return done('publisher returned no signed manifest; refusing to copy unsigned content');
  const peeked = peekAnnouncePayload(signedManifest);
  if (!peeked) return done('signed manifest malformed');
  const key = opts.expectedPublisherKeyHex || peeked.claimedPublicKeyHex;
  if (!key) return done('signed manifest carries no public key and none is expected');
  const verified = verifyAnnounceFrame(signedManifest, key);
  if (!verified.valid || !verified.payload) return done(`signed manifest failed verification: ${verified.reason}`);
  receipt.publisherKeyTrust = opts.expectedPublisherKeyHex ? 'expected_key' : 'self_declared';
  const man = verified.payload;
  if (man.request_nonce !== search.json.__nonce) return done('signed manifest answers a different request (nonce mismatch)');
  if (man.requester_peer_id !== opts.senderPeerId) return done('signed manifest names a different requester');
  receipt.publisherPeerId = String(man.publisher_peer_id ?? '');
  receipt.sharePolicy = man.share_policy === 'same_owner' || man.share_policy === 'other_owner' ? man.share_policy : null;
  const listed = Array.isArray(man.connectors) ? (man.connectors as { connector: string; file: string; sha256: string; source_status?: string }[]) : [];
  receipt.listed = listed.length;

  mkdirSync(opts.destDir, { recursive: true });
  const batch = Math.min(opts.batchSize ?? 40, LIBRARY_MAX_FETCH_PER_REQUEST);
  // X030-207: one signed TRAIL hop per card copied (from the publisher to this node), package = the signed manifest's library connector.
  const tagHop = (r: PullFileReceipt, lines: string[] | null | undefined): void => {
    if (!opts.tags) return;
    r.trail = acceptSharedProvenance(opts.tags.tagsDir, r.connector, lines, { from_node: String(receipt.publisherPeerId || ''), to_node: opts.senderPeerId, package_id: typeof man.library_connector === 'string' ? man.library_connector : null }, opts.tags.signer);
    if (r.trail.action === 'hop_appended') receipt.trailHops++;
  };
  const present: string[] = [];
  for (let i = 0; i < listed.length; i += batch) {
    const slice = listed.slice(i, i + batch);
    const fetched = await postSigned(opts, LIBRARY_FETCH_PATH, { connectors: slice.map((s) => s.connector) });
    const got = new Map<string, { file: string; sha256: string; content: string; provenance?: string[] | null }>();
    if (fetched.status === 200 && fetched.json.ok === true && Array.isArray(fetched.json.files)) {
      for (const f of fetched.json.files as { connector: string; file: string; sha256: string; content: string; provenance?: string[] | null }[]) got.set(f.connector, f);
    }
    for (const m of slice) {
      const r: PullFileReceipt = { connector: m.connector, file: m.file, sha256Manifest: m.sha256, sha256Received: null, action: 'refused' };
      receipt.files.push(r);
      const g = got.get(m.connector);
      if (!g) { r.reason = `not returned by fetch (HTTP ${fetched.status})`; receipt.refused++; continue; }
      const name = basename(String(m.file));
      if (name !== m.file || !SAFE_NAME.test(name)) { r.reason = 'unsafe file name'; receipt.refused++; continue; }
      r.sha256Received = sha256Hex(g.content);
      if (r.sha256Received !== m.sha256) { r.reason = 'content sha256 differs from the signed manifest'; receipt.refused++; continue; }
      const v = validateShareableEblet(name, g.content);
      if (!v.ok || v.entry.connector !== m.connector) { r.reason = 'received eblet failed shareability check: ' + (v.ok ? 'connector mismatch' : v.reason); receipt.refused++; continue; }
      // X030-067: the source status travels inside the signed manifest; the eblet's own frontmatter must agree with it.
      if (m.source_status !== undefined && m.source_status !== v.entry.sourceStatus) { r.reason = 'source_status differs from the signed manifest'; receipt.refused++; continue; }
      // X030-067: a publisher that says other_owner must never have sent a source_pending card; refuse it rather than keep it.
      if (receipt.sharePolicy !== 'same_owner' && v.entry.sourceStatus === 'source_pending') { r.reason = 'source pending card received outside a same-owner share'; receipt.refused++; continue; }
      r.sourceStatus = v.entry.sourceStatus;
      r.sourceLabel = v.entry.sourceLabel;
      r.sealState = v.entry.sourceStatus === 'sourced' ? 'SEALABLE' : v.entry.sourceStatus === 'source_pending' ? 'UNSEALABLE' : 'NOT_A_CARD';
      const dest = join(opts.destDir, name);
      if (existsSync(dest)) {
        const old = readFileSync(dest, 'utf8');
        if (old === g.content) { r.action = 'already_present'; receipt.alreadyPresent++; present.push(m.connector); tagHop(r, g.provenance); continue; }
        copyFileSync(dest, dest.replace(/\.eblet\.md$/, `.superseded.${stampUtc()}.md`));
        writeFileSync(dest, g.content, 'utf8');
        r.action = 'replaced_with_superseded_sibling';
      } else {
        writeFileSync(dest, g.content, 'utf8');
        r.action = 'written';
      }
      receipt.written++;
      present.push(m.connector);
      tagHop(r, g.provenance);
      if (v.entry.sourceStatus === 'sourced') receipt.sourced++; else if (v.entry.sourceStatus === 'source_pending') receipt.sourcePending++; else receipt.notACard++;
    }
  }
  receipt.libraryConnector = present.length ? soccerballAddress(present) : null;
  return done();
}

// ─── X041 PUSH: offer ONE card to ONE peer, on that peer's consent, with a receipt the receiver signs ───────────────────
//
// Founder 2026-09-26 ~03:35Z (D-BP223-PQ005-012-X041): "Make WORK the one-click share-to-a-peer as not an honest stub but
// actual code that works? That way the site's mesh proof page won't need to say coming soon, it'll say working."
// The PULL above copies a peer's library into this node. The PUSH below is the inverse: this node OFFERS one of its own
// mesh-shareable cards to a peer. The same signed frame, the same key tiers, the same shareability rule, the same Rule 66.
// What is new is CONSENT on the receiving side (nothing lands in a silo because a stranger sent it) and a SIGNED RECEIPT
// back to the sender (the receiver signs what it did with the card, so the sender's receipt is checkable by anyone).

export type OfferAction = 'written' | 'already_present' | 'replaced_with_superseded_sibling' | 'held_for_consent' | 'refused';

export interface HeldOffer {
  senderPeerId: string;
  file: string;
  connector: string;
  sha256: string;
  trust: SenderTrust;
  policy: SharePolicy;
  receivedUtc: string;
  sourceStatus: ShareSourceStatus;
  title: string;
  provenance: string[] | null;
}

const heldDir = (inboxDir: string, senderPeerId: string): string => join(inboxDir, senderPeerId.replace(/[^A-Za-z0-9._-]/g, '_'));

function offerReceipt(
  ctx: LibraryRouteContext, senderPeerId: string, trust: SenderTrust, nonce: unknown, fields: Record<string, unknown>,
): { receipt: Record<string, unknown>; signed: string | null } {
  const receipt: Record<string, unknown> = {
    protocol: LIBRARY_PROTOCOL, kind: 'hollerith_share_receipt', receiver_peer_id: ctx.selfPeerId, sender_peer_id: senderPeerId,
    sender_trust: trust, request_nonce: nonce, issued_utc: new Date((ctx.now ?? Date.now)()).toISOString(), ...fields,
  };
  return { receipt, signed: ctx.signPayload(String(nonce ?? ''), receipt) };
}

/** Server side of the PUSH. Reached only with a verified signed frame (resolveSignedLibraryRequest). */
export function handleOfferRequest(
  payload: Record<string, unknown>, senderPeerId: string, trust: SenderTrust, ctx: LibraryRouteContext,
): LibraryRouteResult {
  const nonce = payload.nonce;
  const refuse = (status: number, reason: string, extra: Record<string, unknown> = {}): LibraryRouteResult => {
    const r = offerReceipt(ctx, senderPeerId, trust, nonce, { action: 'refused', reason, ...extra });
    return { status, body: { ok: false, error: reason, action: 'refused', receiver_peer_id: ctx.selfPeerId, receipt: r.receipt, signed_receipt: r.signed } };
  };
  const offer = (payload.offer ?? null) as { file?: unknown; content?: unknown; sha256?: unknown; connector?: unknown; provenance?: unknown } | null;
  if (!offer || typeof offer !== 'object') return refuse(400, 'offer missing: expected payload.offer {file, content, sha256, connector}');
  const file = typeof offer.file === 'string' ? offer.file : '';
  const content = typeof offer.content === 'string' ? offer.content : '';
  if (!file || basename(file) !== file || !SAFE_NAME.test(file)) return refuse(400, 'unsafe or missing file name (basename *.eblet.md only)');
  if (!content) return refuse(400, 'offer carries no content');
  if (sha256Hex(content) !== offer.sha256) return refuse(400, 'content sha256 does not equal the offered sha256');
  const v = validateShareableEblet(file, content);
  if (!v.ok) return refuse(400, 'offered eblet failed the shareability check: ' + v.reason);
  if (v.entry.connector !== offer.connector) return refuse(400, 'offered connector does not equal the connector the eblet re-derives');
  const share = resolveSharePolicy(trust, senderPeerId, payload, ctx);
  if (!shareableUnderPolicy(v.entry, share.policy)) return refuse(403, 'source pending card offered outside a same-owner share (Founder k/dc99f6ff pick B)', { share_policy: share.policy });
  const provenance = Array.isArray(offer.provenance) ? (offer.provenance as unknown[]).map(String) : null;
  const decision = (ctx.offerConsent ?? defaultOfferConsent)({ senderPeerId, trust, policy: share.policy, entry: v.entry });
  const common = { connector: v.entry.connector, file, sha256: v.entry.sha256, share_policy: share.policy, share_policy_reason: share.reason, consent: decision.decision, consent_reason: decision.reason, source_status: v.entry.sourceStatus };

  if (decision.decision === 'refuse') return refuse(403, 'refused by this node\'s consent rule: ' + decision.reason, common);

  if (decision.decision === 'hold') {
    if (!ctx.inboxDir) return refuse(403, 'this node holds no inbox for offers awaiting consent: ' + decision.reason, common);
    const dir = heldDir(ctx.inboxDir, senderPeerId);
    mkdirSync(dir, { recursive: true });
    const dest = join(dir, file);
    if (existsSync(dest) && readFileSync(dest, 'utf8') !== content) copyFileSync(dest, dest.replace(/\.eblet\.md$/, `.superseded.${stampUtc()}.md`));
    writeFileSync(dest, content, 'utf8');
    const held: HeldOffer = { senderPeerId, file, connector: v.entry.connector, sha256: v.entry.sha256, trust, policy: share.policy, receivedUtc: new Date((ctx.now ?? Date.now)()).toISOString(), sourceStatus: v.entry.sourceStatus, title: v.entry.title, provenance };
    writeFileSync(dest + '.offer.json', JSON.stringify(held, null, 2), 'utf8');
    const r = offerReceipt(ctx, senderPeerId, trust, nonce, { action: 'held_for_consent', ...common });
    return { status: 202, body: { ok: true, action: 'held_for_consent', receiver_peer_id: ctx.selfPeerId, reason: decision.reason, receipt: r.receipt, signed_receipt: r.signed } };
  }

  // accept: the same landing the pull performs on the requester side (Rule 66, then the signed TRAIL hop).
  const landed = landOfferedCard(ctx.siloDir, file, content);
  let trail: { action: string; reason?: string; trail_length?: number } | null = null;
  if (ctx.tagsDir && ctx.tagSigner) {
    trail = acceptSharedProvenance(ctx.tagsDir, v.entry.connector, provenance, { from_node: senderPeerId, to_node: ctx.selfPeerId, package_id: null }, ctx.tagSigner);
  }
  const r = offerReceipt(ctx, senderPeerId, trust, nonce, { action: landed, ...common, trail });
  return { status: 200, body: { ok: true, action: landed, receiver_peer_id: ctx.selfPeerId, reason: decision.reason, trail, receipt: r.receipt, signed_receipt: r.signed } };
}

/** Writes an accepted card into the silo: identical = already_present; different = Rule 66 sibling first; new = written. */
export function landOfferedCard(siloDir: string, file: string, content: string): Exclude<OfferAction, 'held_for_consent' | 'refused'> {
  mkdirSync(siloDir, { recursive: true });
  const dest = join(siloDir, file);
  if (existsSync(dest)) {
    if (readFileSync(dest, 'utf8') === content) return 'already_present';
    copyFileSync(dest, dest.replace(/\.eblet\.md$/, `.superseded.${stampUtc()}.md`));
    writeFileSync(dest, content, 'utf8');
    return 'replaced_with_superseded_sibling';
  }
  writeFileSync(dest, content, 'utf8');
  return 'written';
}

/** The inbox: offers held for a person's consent. Listing never reads card bodies, only the sidecars. */
export function listHeldOffers(inboxDir: string | null | undefined): HeldOffer[] {
  if (!inboxDir || !existsSync(inboxDir)) return [];
  const out: HeldOffer[] = [];
  for (const sender of readdirSync(inboxDir)) {
    const dir = join(inboxDir, sender);
    try { if (!statSync(dir).isDirectory()) continue; } catch { continue; }
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.offer.json')) continue;
      try { out.push(JSON.parse(readFileSync(join(dir, name), 'utf8')) as HeldOffer); } catch { /* unreadable sidecar: not listed */ }
    }
  }
  return out.sort((a, b) => a.receivedUtc.localeCompare(b.receivedUtc));
}

/** A person accepts a held offer: the card is re-validated from its held bytes, landed with Rule 66, the hop appended, the inbox entry removed. */
export function acceptHeldOffer(
  inboxDir: string, siloDir: string, senderPeerId: string, file: string, selfPeerId: string,
  tags?: { tagsDir: string; signer: TagSigner } | null,
): { ok: true; action: OfferAction; connector: string; trail: { action: string; reason?: string; trail_length?: number } | null } | { ok: false; reason: string } {
  const dir = heldDir(inboxDir, senderPeerId);
  const src = join(dir, file);
  if (basename(file) !== file || !SAFE_NAME.test(file) || !existsSync(src) || !existsSync(src + '.offer.json')) return { ok: false, reason: 'no such held offer' };
  const content = readFileSync(src, 'utf8');
  let held: HeldOffer;
  try { held = JSON.parse(readFileSync(src + '.offer.json', 'utf8')) as HeldOffer; } catch { return { ok: false, reason: 'held offer sidecar unreadable' }; }
  const v = validateShareableEblet(file, content);
  if (!v.ok) return { ok: false, reason: 'held card no longer passes the shareability check: ' + v.reason };
  if (sha256Hex(content) !== held.sha256 || v.entry.connector !== held.connector) return { ok: false, reason: 'held card bytes differ from the offer that was recorded' };
  const action = landOfferedCard(siloDir, file, content);
  let trail: { action: string; reason?: string; trail_length?: number } | null = null;
  if (tags) trail = acceptSharedProvenance(tags.tagsDir, v.entry.connector, held.provenance, { from_node: senderPeerId, to_node: selfPeerId, package_id: null }, tags.signer);
  rmSync(src, { force: true });
  rmSync(src + '.offer.json', { force: true });
  return { ok: true, action, connector: v.entry.connector, trail };
}

export function rejectHeldOffer(inboxDir: string, senderPeerId: string, file: string): { ok: boolean; reason?: string } {
  const src = join(heldDir(inboxDir, senderPeerId), file);
  if (basename(file) !== file || !existsSync(src + '.offer.json')) return { ok: false, reason: 'no such held offer' };
  rmSync(src, { force: true });
  rmSync(src + '.offer.json', { force: true });
  return { ok: true };
}

// ─── Sender side (the PUSH) ───────────────────────────────────────────────────────────────────

export interface PushOptions {
  /** e.g. http://192.168.86.45:7474 */
  peerBaseUrl: string;
  senderPeerId: string;
  signPayload(seed: string, payload: Record<string, unknown>): string | null;
  /** this node's Hollerith silo; the card is read from here and never from anywhere else */
  siloDir: string;
  /** the card, by 32-hex connector or by basename; one of the two */
  connector?: string;
  file?: string;
  /** the receiver's Thorax public key as this node already knows it; absent = the key self-declared in the signed receipt */
  expectedReceiverKeyHex?: string | null;
  fetchImpl?: typeof fetch;
  ownerId?: string | null;
  /** when set, the card's ORIGIN + TRAIL lines travel with the offer so the receiver can extend the chain */
  tagsDir?: string | null;
}

export interface PushReceipt {
  protocol: string;
  kind: 'hollerith_share_push_receipt';
  startedUtc: string;
  finishedUtc: string;
  peerBaseUrl: string;
  senderPeerId: string;
  receiverPeerId: string | null;
  receiverKeyTrust: 'expected_key' | 'self_declared' | 'unverified';
  senderTrustAtReceiver: string | null;
  sharePolicy: SharePolicy | null;
  connector: string | null;
  file: string | null;
  sha256: string | null;
  action: OfferAction | 'error';
  reason?: string;
  /** the receiver's signed receipt, verbatim, so anyone can re-verify it against the receiver's key */
  signedReceipt: string | null;
  receiptVerified: boolean;
  receipt: Record<string, unknown> | null;
  httpStatus: number | null;
  error?: string;
}

export async function pushEbletToPeer(opts: PushOptions): Promise<PushReceipt> {
  const r: PushReceipt = {
    protocol: LIBRARY_PROTOCOL, kind: 'hollerith_share_push_receipt', startedUtc: new Date().toISOString(), finishedUtc: '', peerBaseUrl: opts.peerBaseUrl,
    senderPeerId: opts.senderPeerId, receiverPeerId: null, receiverKeyTrust: 'unverified', senderTrustAtReceiver: null, sharePolicy: null,
    connector: null, file: null, sha256: null, action: 'error', signedReceipt: null, receiptVerified: false, receipt: null, httpStatus: null,
  };
  const done = (error?: string): PushReceipt => { if (error) r.error = error; r.finishedUtc = new Date().toISOString(); return r; };

  // 1. the card must be this node's own, in its silo, and shareable by the same rule the pull serves under. Nothing else is sent.
  const index = buildSiloIndex(opts.siloDir);
  const entry = opts.connector
    ? index.connectors.find((c) => c.connector === String(opts.connector).toLowerCase())
    : index.connectors.find((c) => c.file === opts.file);
  if (!entry) {
    const skipped = opts.file ? index.skipped.find((s) => s.file === opts.file) : null;
    return done(skipped ? `card is in the silo but not shareable: ${skipped.reason}` : 'card not found in this node\'s Hollerith silo (by connector or file name)');
  }
  r.connector = entry.connector; r.file = entry.file;
  const content = readFileSync(join(opts.siloDir, entry.file), 'utf8');
  r.sha256 = sha256Hex(content);
  const provenance = provenanceForShare(opts.tagsDir, entry.connector);

  // 2. one signed offer, one answer.
  let res: { status: number; json: Record<string, unknown> };
  try {
    res = await postSigned(opts, LIBRARY_OFFER_PATH, { offer: { file: entry.file, content, sha256: r.sha256, connector: entry.connector, provenance } });
  } catch (e) {
    return done('offer could not be sent: ' + (e instanceof Error ? e.message : String(e)));
  }
  r.httpStatus = res.status;
  const bodyAction = typeof res.json.action === 'string' ? (res.json.action as OfferAction) : null;
  r.reason = typeof res.json.reason === 'string' ? res.json.reason : typeof res.json.error === 'string' ? res.json.error : undefined;

  // 3. the receiver's receipt is the truth of what happened, and only a receipt that verifies counts.
  const signed = res.json.signed_receipt;
  if (typeof signed !== 'string') { r.action = bodyAction ?? 'error'; return done('receiver returned no signed receipt (HTTP ' + res.status + ')'); }
  r.signedReceipt = signed;
  const peeked = peekAnnouncePayload(signed);
  if (!peeked) { r.action = bodyAction ?? 'error'; return done('signed receipt malformed'); }
  const key = opts.expectedReceiverKeyHex || peeked.claimedPublicKeyHex;
  if (!key) { r.action = bodyAction ?? 'error'; return done('signed receipt carries no public key and none is expected'); }
  const verified = verifyAnnounceFrame(signed, key);
  if (!verified.valid || !verified.payload) { r.action = bodyAction ?? 'error'; return done(`signed receipt failed verification: ${verified.reason}`); }
  r.receiverKeyTrust = opts.expectedReceiverKeyHex ? 'expected_key' : 'self_declared';
  const rec = verified.payload;
  if (rec.kind !== 'hollerith_share_receipt') return done('signed receipt is not a share receipt');
  if (rec.request_nonce !== res.json.__nonce) return done('signed receipt answers a different offer (nonce mismatch)');
  if (rec.sender_peer_id !== opts.senderPeerId) return done('signed receipt names a different sender');
  if (rec.connector !== undefined && rec.connector !== entry.connector) return done('signed receipt names a different connector');
  if (rec.sha256 !== undefined && rec.sha256 !== r.sha256) return done('signed receipt names different bytes');
  r.receipt = rec;
  r.receiptVerified = true;
  r.receiverPeerId = typeof rec.receiver_peer_id === 'string' ? rec.receiver_peer_id : null;
  r.senderTrustAtReceiver = typeof rec.sender_trust === 'string' ? rec.sender_trust : null;
  r.sharePolicy = rec.share_policy === 'same_owner' || rec.share_policy === 'other_owner' ? rec.share_policy : null;
  r.action = typeof rec.action === 'string' ? (rec.action as OfferAction) : (bodyAction ?? 'error');
  if (typeof rec.reason === 'string') r.reason = rec.reason;
  return done();
}
