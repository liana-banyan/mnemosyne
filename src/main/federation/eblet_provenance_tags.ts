/**
 * eblet_provenance_tags.ts -- D-BP223-BM0-X030-207-EBLET-PROVENANCE-TRAIL-SAVINGS-TAGS
 *
 * ORIGIN, TRAIL and USE tags for Hollerith card eblets: where a card came from, where it went, and how many tokens each
 * reuse saved, as signed, hash-chained, append-only rows. Founder k/44977015 (2026-09-17T05:02Z), verbatim: "keeps track of
 * not only provenance, but where it came from and where it's going. Socceri Style, of course, but also how many tokens were
 * saved, using our algorithm ... So we can always have a verifiable proof, not guessing, as to consumption and value."
 * k/ac61e4c2 + k/5d99c4e9: "YES BUILD IT" "and wire it, and test it. and ship it."
 *
 * THIS IS THE TS TWIN of HARDWIRE/tools/facts/eblet_tags/eblet_tags.cjs (the card executor and the mint path run there, in
 * plain Node). Both produce byte-identical row hashes; eblet_provenance_tags.test.ts verifies a ledger the CJS twin wrote.
 * NOTHING HERE IS A NEW SCHEME:
 *   - Socceri signing: keys_engines/key_signer.ts socceriHash + signSocceriHash (imported), the verify mirror of
 *     key_verifier.ts, and the sorted-key canonicalize() of BISHOP_DROPZONE/MIC_CHANNEL/mic_channel_crypto.js (ported below,
 *     same bytes). row_hash = socceriHash(canonicalize(row minus row_hash and sig)); sig = Ed25519 over that hex string.
 *   - Card key: soccerballAddress() from hollerith_library_share.ts. A silo eblet's card_key IS its hex_connector.
 *   - Billable tokens: barrel_sand.cjs tokensOf (X029-008), ported: input + output + Anthropic cache input + reasoning only
 *     for Google and xAI (they report it separately; OpenAI and DeepSeek already count it inside output).
 *   - Signer: in MnemosyneC the Thorax Ed25519 keypair (ed25519_keypair.ts) through an injected TagSigner, so this module
 *     stays pure (no electron import) and the tests run with ephemeral keys.
 *
 * FILES, per card, never inside the card itself (Addendum never Deletion):
 *   <tagsDir>/<card_key>.provenance.jsonl   ORIGIN (once) + TRAIL hops; travels with a copy over the library share
 *   <tagsDir>/<card_key>.uses.jsonl         USE rows; stays on the node that used the card; genesis = ORIGIN row_hash
 * GUARDS: sealed baseline (baseline_hash) never editable; second ORIGIN refused; every append verifies the chain first
 * (TAMPER_REFUSED); saved = baseline - actual, signed, never clipped; no receipt = "unmeasured" with null savings; rows
 * carry counts and hashes only (PRIVACY_REFUSED).
 */

import { createHash, createPublicKey, verify as cryptoVerify } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { socceriHash as socceriHashBytes, signSocceriHash } from '../keys_engines/key_signer';
import { soccerballAddress } from './hollerith_library_share';

export const EBLET_TAG_SCHEMA = 'lb.eblet_tag.v1';
const HEX32 = /^[0-9a-f]{32}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const sha256Hex = (s: string | Buffer): string => createHash('sha256').update(s).digest('hex');

// ─── socceri primitives ──────────────────────────────────────────────────────────────────────
/** Byte-identical port of mic_channel_crypto.js canonicalize(): sorted keys, arrays in order, no whitespace. */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) as string;
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  const obj = value as Record<string, unknown>;
  return '{' + Object.keys(obj).sort().map((k) => JSON.stringify(k) + ':' + canonicalize(obj[k])).join(',') + '}';
}
export const socceriHash = (s: string): string => socceriHashBytes(Buffer.from(s, 'utf8'));
/** Verify mirror of signSocceriHash (Ed25519 over the UTF-8 bytes of the hex string). Never throws. */
export function verifySocceriSignature(hash: string, signatureHex: string, publicKeyHex: string): boolean {
  try {
    const pub = createPublicKey({ key: Buffer.from(publicKeyHex, 'hex'), format: 'der', type: 'spki' });
    return cryptoVerify(null, Buffer.from(hash, 'utf8'), pub, Buffer.from(signatureHex, 'hex'));
  } catch {
    return false;
  }
}

export interface TagSigner { peer_id: string; public_key_hex: string; signHash(hash: string): string }
/** A signer from DER hex keys (Thorax getOrCreateKeypair() shape). The private key stays in the closure. */
export function signerFromKeypair(peerId: string, publicKeyHex: string, privateKeyHex: string): TagSigner {
  return { peer_id: peerId, public_key_hex: publicKeyHex, signHash: (h) => signSocceriHash(h, privateKeyHex) };
}

// ─── card reference and paths ────────────────────────────────────────────────────────────────
export interface CardRef { card_id: string; content_sha256: string; pearl: string; card_key: string }
export function cardRef(input: { card_id?: string; content_sha256: string; pearl?: string }): CardRef {
  if (!HEX64.test(String(input.content_sha256 || ''))) throw new Error('CARD_REF_INVALID: content_sha256 must be 64 hex');
  const pearl = input.pearl || `eblet_card:${input.card_id}:sha256:${input.content_sha256}`;
  return { card_id: String(input.card_id || ''), content_sha256: input.content_sha256, pearl, card_key: soccerballAddress([pearl]) };
}
export function ledgerPaths(tagsDir: string, cardKey: string): { provenance: string; uses: string } {
  if (!HEX32.test(String(cardKey))) throw new Error('CARD_KEY_INVALID');
  return { provenance: join(tagsDir, `${cardKey}.provenance.jsonl`), uses: join(tagsDir, `${cardKey}.uses.jsonl`) };
}

// ─── privacy ─────────────────────────────────────────────────────────────────────────────────
const FORBIDDEN_KEYS = new Set(['question', 'questions', 'options', 'choices', 'prompt', 'reply', 'answer', 'answer_value', 'text', 'content', 'body', 'method', 'email', 'licensee_id', 'org_id']);
const MAX_STRING = 200;
export function privacyViolation(obj: unknown, where: string): string | null {
  if (obj === null || obj === undefined) return null;
  if (typeof obj === 'string') return obj.length > MAX_STRING ? `${where}: string longer than ${MAX_STRING} chars` : null;
  if (typeof obj !== 'object') return null;
  if (Array.isArray(obj)) { for (let i = 0; i < obj.length; i++) { const v = privacyViolation(obj[i], `${where}[${i}]`); if (v) return v; } return null; }
  for (const k of Object.keys(obj as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(k.toLowerCase())) return `${where}.${k}: key not allowed in a tag row (counts and hashes only)`;
    const v = privacyViolation((obj as Record<string, unknown>)[k], `${where}.${k}`); if (v) return v;
  }
  return null;
}
export const licenseeHash = (id: string): string => sha256Hex('lb.licensee:' + String(id).trim().toLowerCase());

// ─── rows ────────────────────────────────────────────────────────────────────────────────────
export type TagRow = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export function rowHashOf(row: TagRow): string {
  const { row_hash: _h, sig: _s, ...rest } = row; // eslint-disable-line @typescript-eslint/no-unused-vars
  return socceriHash(canonicalize(rest));
}
function signRow(body: TagRow, signer: TagSigner): TagRow {
  const row: TagRow = { schema: EBLET_TAG_SCHEMA, ...body, signer_peer_id: signer.peer_id, signer_public_key_hex: signer.public_key_hex };
  const v = privacyViolation(row, String(row.type));
  if (v) throw new Error('PRIVACY_REFUSED: ' + v);
  row.row_hash = rowHashOf(row);
  row.sig = signer.signHash(row.row_hash);
  return row;
}
export function readJsonl(file: string): TagRow[] {
  if (!existsSync(file)) return [];
  const out: TagRow[] = [];
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { out.push({ __unparseable: line.slice(0, 80) }); }
  }
  return out;
}
const round6 = (x: number): number => Math.round(x * 1e6) / 1e6;
const nonNegInt = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 0;

export interface BaselineModelInput {
  vendor?: string; cash_basis?: 'vendor_billed' | 'local_zero_cash';
  billable_input_tokens: number; billable_output_tokens: number; usd: number;
  price_basis?: { price_in_per_mtok?: number | null; price_out_per_mtok?: number | null; source?: string } | null;
  receipt?: { file?: string; file_sha256?: string | null; row_started_utc?: string | null; http_status?: number | null };
}
export type BaselineInput = { status: 'measured'; measured_utc?: string; per_model: Record<string, BaselineModelInput> } | { status: 'unmeasured'; reason?: string } | null;

export function normalizeModelBaseline(model: string, m: BaselineModelInput): TagRow {
  if (!m || !nonNegInt(m.billable_input_tokens) || !nonNegInt(m.billable_output_tokens)) throw new Error('BASELINE_INVALID: token counts for ' + model);
  if (!(typeof m.usd === 'number' && m.usd >= 0)) throw new Error('BASELINE_INVALID: usd for ' + model);
  return {
      vendor: String(m.vendor || ''), cash_basis: m.cash_basis === 'local_zero_cash' ? 'local_zero_cash' : 'vendor_billed',
      billable_input_tokens: m.billable_input_tokens, billable_output_tokens: m.billable_output_tokens,
      billable_tokens: m.billable_input_tokens + m.billable_output_tokens, usd: round6(m.usd),
      price_basis: m.price_basis ? { price_in_per_mtok: m.price_basis.price_in_per_mtok ?? null, price_out_per_mtok: m.price_basis.price_out_per_mtok ?? null, source: String(m.price_basis.source || '').slice(0, 180) } : null,
      receipt: { file: String(m.receipt?.file || '').slice(0, 180), file_sha256: m.receipt?.file_sha256 || null, row_started_utc: m.receipt?.row_started_utc || null, http_status: m.receipt?.http_status ?? null },
  };
}
export function normalizeBaseline(b: BaselineInput): TagRow {
  if (!b || b.status !== 'measured') return { status: 'unmeasured', reason: String((b && 'reason' in b && b.reason) || 'no receipt for the answering call').slice(0, 200), per_model: {} };
  const per: TagRow = {};
  for (const model of Object.keys(b.per_model || {}).sort()) per[model] = normalizeModelBaseline(model, b.per_model[model]);
  if (!Object.keys(per).length) return { status: 'unmeasured', reason: 'measured baseline had no model rows', per_model: {} };
  return { status: 'measured', measured_utc: b.measured_utc || new Date().toISOString(), rule: 'billable tokens per barrel_sand.cjs tokensOf (input + output + separately reported thinking + cache input); usd = vendor billed trueTotalUsd else estimatedUsd', per_model: per };
}

export function sealOrigin(
  tagsDir: string,
  o: { card_ref: CardRef; minted_by?: string; member_mark?: string | null; source?: { kind?: string | null; status?: string | null; verification?: string | null; value?: string | null } | null; baseline: BaselineInput; minted_utc?: string | null },
  signer: TagSigner,
): TagRow {
  const p = ledgerPaths(tagsDir, o.card_ref.card_key);
  if (existsSync(p.provenance)) throw new Error(`ORIGIN_EXISTS: baseline is sealed once and never edited (${o.card_ref.card_key})`);
  const sealed = normalizeBaseline(o.baseline);
  const s = o.source;
  const row = signRow({
    type: 'origin', seq: 0, prev_hash: null, card_key: o.card_ref.card_key,
    card_ref: { card_id: o.card_ref.card_id, content_sha256: o.card_ref.content_sha256, pearl: o.card_ref.pearl },
    minted_by: String(o.minted_by || signer.peer_id), member_mark: o.member_mark || null,
    source: s ? { kind: s.kind || null, status: s.status || null, verification: s.verification || null, value: s.value ? String(s.value).slice(0, 200) : null } : null,
    minted_utc: o.minted_utc || null, sealed_utc: new Date().toISOString(),
    sealed_baseline: sealed, baseline_hash: socceriHash(canonicalize(sealed)),
  }, signer);
  mkdirSync(tagsDir, { recursive: true });
  writeFileSync(p.provenance, JSON.stringify(row) + '\n', { flag: 'wx' });
  return row;
}

// ─── verification ────────────────────────────────────────────────────────────────────────────
function verifyRowSelf(row: TagRow): string | null {
  if (!row || row.__unparseable) return 'unparseable line';
  if (row.schema !== EBLET_TAG_SCHEMA) return 'schema';
  if (rowHashOf(row) !== row.row_hash) return 'row_hash does not recompute (row edited)';
  if (!verifySocceriSignature(row.row_hash, String(row.sig || ''), String(row.signer_public_key_hex || ''))) return 'signature does not verify';
  return null;
}
function expectedSavings(bm: TagRow | null, actual: TagRow): { status: 'measured' | 'unmeasured'; tokens: number | null; usd: number | null } {
  if (!bm) return { status: 'unmeasured', tokens: null, usd: null };
  return { status: 'measured', tokens: bm.billable_tokens - actual.billable_tokens, usd: actual.usd == null ? null : round6(bm.usd - actual.usd) };
}

export interface LedgerVerification { ok: boolean; card_key: string; errors: string[]; origin: TagRow | null; trail: TagRow[]; addenda: TagRow[]; uses: TagRow[] }

// ─── baseline addendum (X031H) ────────────────────────────────────────────────────────────────
// FOUNDER RULING 2026-09-17, verbatim: "Allow a signed add-on row that only fills a missing model and never changes an existing
// figure." One signed, chained row in the provenance ledger (travels with the card). Adds a baseline for a model the sealed
// baseline lacks; refused when the model already has a figure (seal or earlier addendum); never edits ORIGIN, the seal or any use
// row; must carry its receipt (source run file + sha256). Byte-identical twin of eblet_tags.cjs appendBaselineAddendum.
export const ADDENDUM_RULING = 'Founder 2026-09-17: signed add-on row that only fills a missing model and never changes an existing figure';
export const addendumHashOf = (model: string, baseline: TagRow): string => socceriHash(canonicalize({ model, addendum_baseline: baseline }));
function addendumErrors(r: TagRow, before: TagRow[]): string[] {
  const errs: string[] = [];
  const origin = before[0] || {};
  if (r.origin_hash !== origin.row_hash) errs.push('baseline addendum bound to a different ORIGIN');
  if (!r.model || typeof r.model !== 'string') errs.push('baseline addendum has no model');
  const sealed = origin.sealed_baseline || {};
  if (sealed.status === 'measured' && sealed.per_model && sealed.per_model[r.model]) errs.push('baseline addendum for ' + r.model + ' but the sealed baseline already has that model');
  if (before.some((p) => p.type === 'baseline_addendum' && p.model === r.model)) errs.push('second baseline addendum for ' + r.model);
  if (!r.addendum_baseline || addendumHashOf(r.model, r.addendum_baseline) !== r.addendum_hash) errs.push('addendum_baseline does not match addendum_hash');
  const rc = r.addendum_baseline && r.addendum_baseline.receipt;
  if (!rc || !rc.file || !HEX64.test(String(rc.file_sha256 || ''))) errs.push('baseline addendum carries no receipt (source run file + sha256)');
  return errs;
}
function lastProvenanceRow(v: LedgerVerification): TagRow {
  const rows = [v.origin as TagRow].concat(v.trail, v.addenda);
  return rows.reduce((a, b) => (b.seq > a.seq ? b : a));
}

/** Verifies an in-memory provenance chain (used for a ledger received over the share before it is written). */
export function verifyProvenanceRows(cardKey: string, prov: TagRow[]): string[] {
  const errors: string[] = [];
  if (!prov.length) return ['no provenance ledger (no ORIGIN)'];
  prov.forEach((r, i) => {
    const e = verifyRowSelf(r); if (e) errors.push(`provenance line ${i + 1}: ${e}`);
    if (r.card_key !== cardKey) errors.push(`provenance line ${i + 1}: card_key mismatch`);
    if (r.seq !== i) errors.push(`provenance line ${i + 1}: seq ${r.seq} expected ${i}`);
    if (i === 0) {
      if (r.type !== 'origin' || r.prev_hash !== null) errors.push('line 1 is not an ORIGIN');
      else if (socceriHash(canonicalize(r.sealed_baseline)) !== r.baseline_hash) errors.push('sealed_baseline does not match baseline_hash');
    } else {
      if (r.type !== 'trail_hop' && r.type !== 'baseline_addendum') errors.push(`provenance line ${i + 1}: only trail_hop or baseline_addendum may follow ORIGIN (a second ORIGIN is refused)`);
      if (r.prev_hash !== prov[i - 1].row_hash) errors.push(`provenance line ${i + 1}: prev_hash chain broken`);
      if (r.type === 'baseline_addendum') for (const e of addendumErrors(r, prov.slice(0, i))) errors.push(`provenance line ${i + 1}: ${e}`);
    }
  });
  return errors;
}

export function verifyLedger(tagsDir: string, cardKey: string, opts: { provenanceOnly?: boolean } = {}): LedgerVerification {
  const res: LedgerVerification = { ok: false, card_key: cardKey, errors: [], origin: null, trail: [], addenda: [], uses: [] };
  let p: { provenance: string; uses: string };
  try { p = ledgerPaths(tagsDir, cardKey); } catch (e) { res.errors.push((e as Error).message); return res; }
  const prov = readJsonl(p.provenance);
  res.errors.push(...verifyProvenanceRows(cardKey, prov));
  if (!prov.length) return res;
  res.origin = prov[0];
  res.trail = prov.slice(1).filter((r) => r.type === 'trail_hop');
  res.addenda = prov.slice(1).filter((r) => r.type === 'baseline_addendum');
  if (opts.provenanceOnly) { res.ok = res.errors.length === 0; return res; }
  const uses = readJsonl(p.uses);
  const originHash = prov[0].row_hash;
  const sealed = prov[0].sealed_baseline || { per_model: {} };
  uses.forEach((r, i) => {
    const e = verifyRowSelf(r); if (e) res.errors.push(`uses line ${i + 1}: ${e}`);
    if (r.type !== 'use') res.errors.push(`uses line ${i + 1}: not a use row`);
    if (r.card_key !== cardKey) res.errors.push(`uses line ${i + 1}: card_key mismatch`);
    if (r.seq !== i) res.errors.push(`uses line ${i + 1}: seq ${r.seq} expected ${i}`);
    if (r.prev_hash !== (i === 0 ? originHash : uses[i - 1].row_hash)) res.errors.push(`uses line ${i + 1}: prev_hash chain broken`);
    if (r.origin_hash !== originHash || r.baseline_hash !== prov[0].baseline_hash) res.errors.push(`uses line ${i + 1}: bound to a different ORIGIN or baseline`);
    const sealedBm = sealed.status === 'measured' ? (sealed.per_model[r.model_spared] || null) : null;
    let bm: TagRow | null = sealedBm;
    if (r.baseline_addendum_hash !== undefined) {
      const add = res.addenda.find((a) => a.row_hash === r.baseline_addendum_hash && a.model === r.model_spared);
      if (sealedBm || !add || r.baseline_source !== 'addendum') { res.errors.push(`uses line ${i + 1}: names a baseline addendum that is not on this card for this model (or the sealed baseline already has the model)`); bm = null; }
      else bm = add.addendum_baseline;
    } else if (r.baseline_source !== undefined) res.errors.push(`uses line ${i + 1}: baseline_source without baseline_addendum_hash`);
    if ((bm ? bm.billable_tokens : null) !== r.baseline_tokens || (bm ? bm.usd : null) !== r.baseline_usd) res.errors.push(`uses line ${i + 1}: baseline figures differ from the sealed baseline or its addendum`);
    const exp = expectedSavings(bm, r.actual || {});
    if (exp.status !== r.savings_status || exp.tokens !== r.saved_tokens || exp.usd !== r.saved_usd) res.errors.push(`uses line ${i + 1}: saved figures do not recompute from baseline minus actual`);
  });
  res.uses = uses;
  res.ok = res.errors.length === 0;
  return res;
}

// ─── appends ─────────────────────────────────────────────────────────────────────────────────
export function appendTrailHop(tagsDir: string, cardKey: string, hop: { from_node: string; to_node: string; package_id?: string | null; hop_utc?: string }, signer: TagSigner): TagRow {
  const v = verifyLedger(tagsDir, cardKey, { provenanceOnly: true });
  if (!v.ok || !v.origin) throw new Error('TAMPER_REFUSED: ' + v.errors.join('; '));
  const last = lastProvenanceRow(v);
  const row = signRow({ type: 'trail_hop', seq: last.seq + 1, prev_hash: last.row_hash, card_key: cardKey,
    from_node: String(hop.from_node || ''), to_node: String(hop.to_node || ''), package_id: hop.package_id ? String(hop.package_id) : null, hop_utc: hop.hop_utc || new Date().toISOString() }, signer);
  appendFileSync(ledgerPaths(tagsDir, cardKey).provenance, JSON.stringify(row) + '\n');
  return row;
}

const REASONING_SEPARATE_VENDORS = new Set(['Google', 'xAI']);
export interface ActualInput {
  model_calls?: number; measured_by?: string; vendor?: string;
  usage?: { input?: number; output?: number; reasoning?: number; raw?: Record<string, unknown> };
  trueTotalUsd?: number | null; estimatedUsd?: number | null;
}
export function measureActual(a: ActualInput = {}, bm: TagRow | null): TagRow {
  const calls = Number.isInteger(a.model_calls) ? (a.model_calls as number) : null;
  if (calls === 0) return { model_calls: 0, billable_input_tokens: 0, billable_output_tokens: 0, billable_tokens: 0, usd: 0, measured_by: String(a.measured_by || 'executor model_calls counter').slice(0, 120) };
  const u = a.usage;
  if (!u) throw new Error('ACTUAL_UNMEASURED: a use with model calls needs its usage receipt; savings are never guessed');
  const i = Number.isFinite(u.input) ? (u.input as number) : null;
  const o = Number.isFinite(u.output) ? (u.output as number) : null;
  if (i === null && o === null) throw new Error('ACTUAL_UNMEASURED: usage carries no token counts');
  const raw = (u.raw || {}) as Record<string, unknown>;
  const cache = (Number.isFinite(raw.cache_creation_input_tokens) ? (raw.cache_creation_input_tokens as number) : 0) + (Number.isFinite(raw.cache_read_input_tokens) ? (raw.cache_read_input_tokens as number) : 0);
  let total = (i || 0) + (o || 0) + cache;
  if (REASONING_SEPARATE_VENDORS.has(String(a.vendor || '').split(' ')[0]) && Number.isFinite(u.reasoning)) total += u.reasoning as number;
  const input = (i || 0) + cache;
  let usd: number | null = null;
  if (a.trueTotalUsd != null) usd = round6(Number(a.trueTotalUsd));
  else if (a.estimatedUsd != null) usd = round6(Number(a.estimatedUsd));
  else if (bm && bm.cash_basis === 'local_zero_cash') usd = 0;
  else if (bm && bm.price_basis && bm.price_basis.price_in_per_mtok != null) usd = round6((input / 1e6) * bm.price_basis.price_in_per_mtok + ((total - input) / 1e6) * bm.price_basis.price_out_per_mtok);
  return { model_calls: calls == null ? 1 : calls, billable_input_tokens: input, billable_output_tokens: total - input, billable_tokens: total, usd, measured_by: 'barrel_sand.cjs tokensOf on the call receipt' };
}

export function appendUse(
  tagsDir: string, cardKey: string,
  u: { model_spared: string; actual: ActualInput; licensee_id?: string; licensee_hash?: string; executor?: string; at_utc?: string; recall_ms?: number },
  signer: TagSigner,
): TagRow {
  const v = verifyLedger(tagsDir, cardKey);
  if (!v.ok || !v.origin) throw new Error('TAMPER_REFUSED: ' + v.errors.join('; '));
  const model = String(u.model_spared || '');
  if (!model) throw new Error('USE_INVALID: model_spared is required');
  const sealed = v.origin.sealed_baseline;
  const sealedBm = sealed.status === 'measured' ? (sealed.per_model[model] || null) : null;
  // X031H: sealed baseline first; only when the seal has no figure for this model, its signed BASELINE ADDENDUM.
  const add = sealedBm ? null : (v.addenda.find((a) => a.model === model) || null);
  const bm = sealedBm || (add ? add.addendum_baseline : null);
  const act = measureActual(u.actual, bm);
  const exp = expectedSavings(bm, act);
  const lh = u.licensee_hash || (u.licensee_id != null ? licenseeHash(u.licensee_id) : null);
  if (lh !== null && !HEX64.test(lh)) throw new Error('USE_INVALID: licensee_hash must be 64 hex');
  const last = v.uses.length ? v.uses[v.uses.length - 1] : null;
  const row = signRow({
    type: 'use', seq: last ? last.seq + 1 : 0, prev_hash: last ? last.row_hash : v.origin.row_hash, card_key: cardKey,
    origin_hash: v.origin.row_hash, baseline_hash: v.origin.baseline_hash,
    model_spared: model, ...(add ? { baseline_source: 'addendum', baseline_addendum_hash: add.row_hash } : {}), baseline_tokens: bm ? bm.billable_tokens : null, baseline_usd: bm ? bm.usd : null,
    cash_basis: bm ? bm.cash_basis : null, actual: act,
    savings_status: exp.status, saved_tokens: exp.tokens, saved_usd: exp.usd,
    valuation: bm ? (bm.cash_basis === 'local_zero_cash' ? 'local model: $0 cash; the saving is tokens' : 'avoided price at the spared model\'s own sealed billed cost') : 'unmeasured: the sealed baseline has no receipt for this model',
    unmeasured_reason: bm ? null : (sealed.status === 'measured' ? 'no sealed baseline for model ' + model : sealed.reason),
    licensee_hash: lh, executor: u.executor ? String(u.executor).slice(0, 120) : null, recall_ms: typeof u.recall_ms === 'number' ? Math.round(u.recall_ms * 1000) / 1000 : null,
    at_utc: u.at_utc || new Date().toISOString(),
  }, signer);
  appendFileSync(ledgerPaths(tagsDir, cardKey).uses, JSON.stringify(row) + '\n');
  return row;
}

/** Appends one signed BASELINE ADDENDUM for a model the sealed baseline lacks. ADDENDUM_REFUSED when the model already has a figure;
 *  ADDENDUM_INVALID without a receipt file and sha256. Verifies the whole ledger first. */
export function appendBaselineAddendum(tagsDir: string, cardKey: string, a: { model: string; baseline: BaselineModelInput; added_utc?: string }, signer: TagSigner): TagRow {
  const v = verifyLedger(tagsDir, cardKey);
  if (!v.ok || !v.origin) throw new Error('TAMPER_REFUSED: ' + v.errors.join('; '));
  const m = String(a.model || '');
  if (!m) throw new Error('ADDENDUM_INVALID: model is required');
  const sealed = v.origin.sealed_baseline;
  if (sealed.status === 'measured' && sealed.per_model[m]) throw new Error('ADDENDUM_REFUSED: the sealed baseline already has a figure for ' + m + '; an addendum never changes an existing figure');
  if (v.addenda.some((x) => x.model === m)) throw new Error('ADDENDUM_REFUSED: a baseline addendum for ' + m + ' already exists on this card');
  const nb = normalizeModelBaseline(m, a.baseline);
  if (!nb.receipt.file || !HEX64.test(String(nb.receipt.file_sha256 || ''))) throw new Error('ADDENDUM_INVALID: a receipt (source run file and its sha256) is required');
  const last = lastProvenanceRow(v);
  const row = signRow({ type: 'baseline_addendum', seq: last.seq + 1, prev_hash: last.row_hash, card_key: cardKey, origin_hash: v.origin.row_hash,
    model: m, addendum_baseline: nb, addendum_hash: addendumHashOf(m, nb), ruling: ADDENDUM_RULING, added_utc: a.added_utc || new Date().toISOString() }, signer);
  appendFileSync(ledgerPaths(tagsDir, cardKey).provenance, JSON.stringify(row) + '\n');
  return row;
}

// ─── the share path (library copy) ───────────────────────────────────────────────────────────
/** Publisher side: the provenance lines (ORIGIN + TRAIL) that travel with a served card. null when the card has no tags. */
export function provenanceForShare(tagsDir: string | null | undefined, cardKey: string): string[] | null {
  if (!tagsDir || !HEX32.test(cardKey)) return null;
  const file = ledgerPaths(tagsDir, cardKey).provenance;
  if (!existsSync(file)) return null;
  return readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l.trim());
}

/**
 * Requester side, after the card itself was verified and written: verify the received provenance chain, keep the longer
 * valid chain (never shorten a local chain; a received chain must EXTEND the local one or equal it), then append this
 * copy's signed TRAIL hop. Returns what happened; never throws.
 */
export function acceptSharedProvenance(
  tagsDir: string, cardKey: string, receivedLines: string[] | null | undefined,
  hop: { from_node: string; to_node: string; package_id?: string | null }, signer: TagSigner,
): { action: 'hop_appended' | 'no_provenance' | 'refused'; reason?: string; trail_length?: number } {
  try {
    const localFile = ledgerPaths(tagsDir, cardKey).provenance;
    const localRows = readJsonl(localFile);
    if (receivedLines && receivedLines.length) {
      const rows: TagRow[] = [];
      for (const l of receivedLines) { try { rows.push(JSON.parse(l)); } catch { return { action: 'refused', reason: 'received provenance line is not JSON' }; } }
      const errs = verifyProvenanceRows(cardKey, rows);
      if (errs.length) return { action: 'refused', reason: 'received provenance failed verification: ' + errs.slice(0, 2).join('; ') };
      if (localRows.length) {
        const localErrs = verifyProvenanceRows(cardKey, localRows);
        if (localErrs.length) return { action: 'refused', reason: 'local provenance failed verification: ' + localErrs.slice(0, 2).join('; ') };
        const localIsPrefix = localRows.every((r, i) => rows[i] && rows[i].row_hash === r.row_hash);
        const receivedIsPrefix = rows.every((r, i) => localRows[i] && localRows[i].row_hash === r.row_hash);
        if (!localIsPrefix && !receivedIsPrefix) return { action: 'refused', reason: 'received chain forks from the local chain (same card, different history)' };
        // Rule 66: the shorter local chain is kept as a superseded sibling before the longer received chain replaces it.
        if (localIsPrefix && rows.length > localRows.length) {
          writeFileSync(localFile.replace(/\.jsonl$/, `.superseded.${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}.jsonl`), readFileSync(localFile));
          writeFileSync(localFile, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
        }
      } else {
        mkdirSync(tagsDir, { recursive: true });
        writeFileSync(localFile, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', { flag: 'wx' });
      }
    } else if (!localRows.length) {
      return { action: 'no_provenance', reason: 'publisher served no ORIGIN for this card; nothing to hop from' };
    }
    const row = appendTrailHop(tagsDir, cardKey, hop, signer);
    return { action: 'hop_appended', trail_length: row.seq };
  } catch (e) {
    return { action: 'refused', reason: (e as Error).message };
  }
}

// ─── green barrel and billing (read-only) ────────────────────────────────────────────────────
export function listCardKeys(tagsDir: string): string[] {
  if (!existsSync(tagsDir)) return [];
  return [...new Set(readdirSync(tagsDir).map((f) => (/^([0-9a-f]{32})\.(provenance|uses)\.jsonl$/.exec(f) || [])[1]).filter(Boolean) as string[])].sort();
}
export interface SandStratum { model: string; uses: number; measured_uses: number; unmeasured_uses: number; negative_uses: number; baseline_tokens: number; actual_tokens: number; tokens_saved: number; usd_saved: number; usd_unvalued_uses: number; local_zero_cash_uses: number }
export interface GreenBarrel { rule: string; ledgers: number; ledgers_rejected: { dir: string; card_key: string; errors: string[] }[]; rows_counted: number; strata: SandStratum[]; faces: { tokens_saved: number; usd_saved: number; measured_uses: number; unmeasured_uses: number } }

export function greenBarrel(tagsDirs: string[], filter: { licensee_hash?: string; from?: string; to?: string } = {}): GreenBarrel {
  const strata = new Map<string, SandStratum>();
  const out: GreenBarrel = { rule: 'green sand = sealed baseline minus actual billable spend, per model spared, from signed use rows; negative kept; unmeasured counted not summed', ledgers: 0, ledgers_rejected: [], rows_counted: 0, strata: [], faces: { tokens_saved: 0, usd_saved: 0, measured_uses: 0, unmeasured_uses: 0 } };
  for (const dir of tagsDirs) {
    for (const key of listCardKeys(dir)) {
      const v = verifyLedger(dir, key);
      out.ledgers++;
      if (!v.ok) { out.ledgers_rejected.push({ dir, card_key: key, errors: v.errors.slice(0, 3) }); continue; }
      for (const r of v.uses) {
        if (filter.licensee_hash && r.licensee_hash !== filter.licensee_hash) continue;
        if (filter.from && r.at_utc < filter.from) continue;
        if (filter.to && r.at_utc >= filter.to) continue;
        const s = strata.get(r.model_spared) || { model: r.model_spared, uses: 0, measured_uses: 0, unmeasured_uses: 0, negative_uses: 0, baseline_tokens: 0, actual_tokens: 0, tokens_saved: 0, usd_saved: 0, usd_unvalued_uses: 0, local_zero_cash_uses: 0 };
        s.uses++;
        if (r.savings_status === 'measured') {
          s.measured_uses++; s.baseline_tokens += r.baseline_tokens; s.actual_tokens += r.actual.billable_tokens; s.tokens_saved += r.saved_tokens;
          if (r.saved_tokens < 0) s.negative_uses++;
          if (r.saved_usd == null) s.usd_unvalued_uses++; else s.usd_saved = round6(s.usd_saved + r.saved_usd);
          if (r.cash_basis === 'local_zero_cash') s.local_zero_cash_uses++;
        } else s.unmeasured_uses++;
        strata.set(r.model_spared, s);
        out.rows_counted++;
      }
    }
  }
  out.strata = [...strata.values()].sort((a, b) => a.model.localeCompare(b.model));
  out.faces = { tokens_saved: out.strata.reduce((x, s) => x + s.tokens_saved, 0), usd_saved: round6(out.strata.reduce((x, s) => x + s.usd_saved, 0)), measured_uses: out.strata.reduce((x, s) => x + s.measured_uses, 0), unmeasured_uses: out.strata.reduce((x, s) => x + s.unmeasured_uses, 0) };
  return out;
}

/** BILLING HOOK, Commercial License Exhibit A (Measured Savings). Read-only. */
export function measuredSavings(tagsDirs: string[], q: { licensee_id?: string; licensee_hash?: string; from: string; to: string }) {
  const lh = q.licensee_hash || (q.licensee_id != null ? licenseeHash(q.licensee_id) : null);
  if (!lh || !HEX64.test(lh)) throw new Error('BILLING_INVALID: a licensee id or 64-hex licensee hash is required');
  if (!q.from || !q.to) throw new Error('BILLING_INVALID: a period [from, to) is required');
  const g = greenBarrel(tagsDirs, { licensee_hash: lh, from: q.from, to: q.to });
  return { exhibit: 'Commercial License Exhibit A: Measured Savings', licensee_hash: lh, period: { from: q.from, to: q.to }, measured_tokens_saved: g.faces.tokens_saved, measured_usd_saved: g.faces.usd_saved, measured_uses: g.faces.measured_uses, unmeasured_uses: g.faces.unmeasured_uses, per_model: g.strata, ledgers_checked: g.ledgers, ledgers_rejected: g.ledgers_rejected, read_only: true as const };
}
