// D-BP223-PQ005-012-X041: the PUSH (offer one card to one peer, on consent, signed receipt back) and the fourth consent.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { generateKeyPairSync, createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encodeFrame } from '../wire/hex-encode';
import { signFrame } from '../thorax/sign_verify';
import { peekAnnouncePayload, verifyAnnounceFrame } from './announce_frame';
import { signerFromKeypair, sealOrigin, verifyLedger, cardRef } from './eblet_provenance_tags';
import {
  handleLibraryRoute, pushEbletToPeer, soccerballAddress, listHeldOffers, acceptHeldOffer, rejectHeldOffer, defaultOfferConsent,
  LIBRARY_OFFER_PATH, type LibraryRouteContext,
} from './hollerith_library_share';
import { decideOfferConsent, readShareReceiveSettings, writeShareReceiveSettings, DEFAULT_SHARE_RECEIVE_SETTINGS } from './share_receive_consent';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
function keypair(peer_id: string) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', { publicKeyEncoding: { type: 'spki', format: 'der' }, privateKeyEncoding: { type: 'pkcs8', format: 'der' } });
  return { peer_id, public_key_hex: publicKey.toString('hex'), private_key_hex: privateKey.toString('hex') };
}
const signer = (k: ReturnType<typeof keypair>) => (seed: string, p: Record<string, unknown>) =>
  signFrame(encodeFrame(seed, 'broadcast', { ...p, public_key_hex: k.public_key_hex }), k.private_key_hex);
const cardBody = (qid: number) => `=== REFERENCE METHOD CARD ===\nmethod for ${qid}\n=== END OF METHOD CARD ===\n`;
const cardPearl = (qid: number) => `hollerith_card:qid${qid}:sha256:${sha(cardBody(qid))}`;
function card(qid: number, share = true, source: { status: string; kind: string } = { status: 'sourced', kind: 'url' }) {
  const body = cardBody(qid);
  const pearl = cardPearl(qid);
  return `---\nkind: hollerith_card\ntitle: "Hollerith card qid ${qid} (business)"\nqid: ${qid}\ntags: [hollerith-card, business, qid-${qid}]\nkeywords: [depreciation]\nhex_connector: ${soccerballAddress([pearl])}\nconnector_pearl: "${pearl}"\ncard_text_sha256: ${sha(body)}\nprovenance: BLIND\nmesh_share: ${share}\nleak_scan: clean_strict\nsource_status: ${source.status}\nsource_kind: ${source.kind}\n---\n${body}`;
}
const OWNER = 'a'.repeat(32);
const OTHER = 'b'.repeat(32);
const readBodyOf = (req: http.IncomingMessage) => new Promise<string>((ok) => { const c: Buffer[] = []; req.on('data', (d) => c.push(d)); req.on('end', () => ok(Buffer.concat(c).toString('utf8'))); });

describe('X041 push: offer one card to one peer, on consent, with a signed receipt', () => {
  // R is the RECEIVER (its silo receives); SAME is the sender enrolled to R's owner; OTH is an enrolled other owner;
  // KNOWN is beacon-known only; STR is a stranger (self-declared key).
  const R = keypair('R'); const SAME = keypair('SAME'); const OTH = keypair('OTH'); const KNOWN = keypair('KNOWN'); const STR = keypair('STR');
  const rSilo = mkdtempSync(join(tmpdir(), 'push-r-silo-'));
  const rInbox = mkdtempSync(join(tmpdir(), 'push-r-inbox-'));
  const rTags = mkdtempSync(join(tmpdir(), 'push-r-tags-'));
  const senders: Record<string, { silo: string; tags: string; k: ReturnType<typeof keypair> }> = {};
  for (const k of [SAME, OTH, KNOWN, STR]) senders[k.peer_id] = { silo: mkdtempSync(join(tmpdir(), `push-${k.peer_id}-silo-`)), tags: mkdtempSync(join(tmpdir(), `push-${k.peer_id}-tags-`)), k };
  let server: http.Server; let url = '';
  const ctx: LibraryRouteContext = {
    siloDir: rSilo, selfPeerId: 'R', selfOwnerId: OWNER, inboxDir: rInbox, tagsDir: rTags,
    tagSigner: signerFromKeypair('R', R.public_key_hex, R.private_key_hex),
    resolveSenderKey: (id) => ({ SAME: { key: SAME.public_key_hex, trust: 'enrolled' as const }, OTH: { key: OTH.public_key_hex, trust: 'enrolled' as const }, KNOWN: { key: KNOWN.public_key_hex, trust: 'known' as const } } as Record<string, { key: string; trust: 'enrolled' | 'known' }>)[id] ?? null,
    resolveSenderOwnerId: (id) => ({ SAME: OWNER, OTH: OTHER } as Record<string, string>)[id] ?? null,
    allowSelfDeclaredKey: true, signPayload: signer(R),
  };
  beforeAll(async () => {
    // every sender holds card 1 (sourced) and card 2 (source pending); SAME also holds an ORIGIN ledger for card 1
    for (const s of Object.values(senders)) {
      writeFileSync(join(s.silo, 'hollerith_card_qid1.eblet.md'), card(1));
      writeFileSync(join(s.silo, 'hollerith_card_qid2.eblet.md'), card(2, true, { status: 'source_pending', kind: 'none_found' }));
      writeFileSync(join(s.silo, 'private_qid3.eblet.md'), card(3, false));
    }
    const conn1 = soccerballAddress([cardPearl(1)]);
    sealOrigin(senders.SAME.tags, { card_ref: cardRef({ card_id: 'qid1', content_sha256: sha(card(1)), pearl: cardPearl(1) }), baseline: { status: 'unmeasured', reason: 'test' }, minted_by: 'SAME' }, signerFromKeypair('SAME', SAME.public_key_hex, SAME.private_key_hex));
    expect(readdirSync(senders.SAME.tags).some((f) => f.startsWith(conn1))).toBe(true);
    server = http.createServer(async (req, res) => {
      const r = await handleLibraryRoute(req.url ?? '', req.method ?? 'GET', () => readBodyOf(req), ctx);
      const t = JSON.stringify(r ? r.body : { error: 'Not found' }); res.writeHead(r ? r.status : 404, { 'content-type': 'application/json' }); res.end(t);
    });
    await new Promise<void>((ok) => server.listen(0, '127.0.0.1', () => ok()));
    url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterAll(() => server.close());

  const push = (k: ReturnType<typeof keypair>, extra: Partial<Parameters<typeof pushEbletToPeer>[0]> = {}) => pushEbletToPeer({
    peerBaseUrl: url, senderPeerId: k.peer_id, signPayload: signer(k), siloDir: senders[k.peer_id].silo, tagsDir: senders[k.peer_id].tags,
    file: 'hollerith_card_qid1.eblet.md', expectedReceiverKeyHex: R.public_key_hex, ...extra,
  });

  it('same owner: the card lands in the receiver silo, the receiver signs a receipt the sender verifies, the TRAIL hop is appended', async () => {
    const r = await push(SAME);
    expect(r.error).toBeUndefined();
    expect([r.action, r.receiptVerified, r.receiverKeyTrust, r.senderTrustAtReceiver, r.sharePolicy, r.receiverPeerId]).toEqual(['written', true, 'expected_key', 'enrolled', 'same_owner', 'R']);
    expect(readFileSync(join(rSilo, 'hollerith_card_qid1.eblet.md'), 'utf8')).toBe(readFileSync(join(senders.SAME.silo, 'hollerith_card_qid1.eblet.md'), 'utf8'));
    // the receipt is a signed frame anyone can re-verify against R's key; it names this exact card and these exact bytes
    const v = verifyAnnounceFrame(r.signedReceipt!, R.public_key_hex);
    expect(v.valid && v.payload?.kind === 'hollerith_share_receipt' && v.payload?.connector === r.connector && v.payload?.sha256 === r.sha256).toBe(true);
    expect(peekAnnouncePayload(r.signedReceipt!)?.claimedPublicKeyHex).toBe(R.public_key_hex);
    // provenance travelled: the receiver's ledger carries SAME's ORIGIN plus one TRAIL hop SAME -> R, signed by R
    const led = verifyLedger(rTags, r.connector!, { provenanceOnly: true });
    expect(led.ok).toBe(true);
    expect(led.trail.length).toBe(1);
    expect([led.trail[0].from_node, led.trail[0].to_node, led.trail[0].signer_peer_id]).toEqual(['SAME', 'R', 'R']);
    // a second identical offer is already_present, never a duplicate
    const again = await push(SAME);
    expect([again.action, again.receiptVerified]).toEqual(['already_present', true]);
  });

  it('same owner may push a source_pending card; another owner may not (pick B), and the refusal is itself a signed receipt', async () => {
    const ok = await push(SAME, { file: 'hollerith_card_qid2.eblet.md' });
    expect([ok.action, ok.sharePolicy]).toEqual(['written', 'same_owner']);
    const no = await push(OTH, { file: 'hollerith_card_qid2.eblet.md' });
    expect([no.action, no.httpStatus, no.receiptVerified]).toEqual(['refused', 403, true]);
    expect(no.reason).toMatch(/source pending/);
  });

  it('another enrolled owner, and a beacon-known peer, are HELD in the inbox until a person accepts; nothing lands by itself', async () => {
    const before = readFileSync(join(rSilo, 'hollerith_card_qid1.eblet.md'), 'utf8');
    const r = await push(OTH);
    expect([r.action, r.httpStatus, r.receiptVerified, r.sharePolicy]).toEqual(['held_for_consent', 202, true, 'other_owner']);
    const k = await push(KNOWN);
    expect([k.action, k.senderTrustAtReceiver]).toEqual(['held_for_consent', 'known']);
    const held = listHeldOffers(rInbox);
    expect(held.map((h) => h.senderPeerId).sort()).toEqual(['KNOWN', 'OTH']);
    expect(held.every((h) => h.file === 'hollerith_card_qid1.eblet.md' && h.trust !== 'self_declared')).toBe(true);
    // the silo did not change because of a held offer
    expect(readFileSync(join(rSilo, 'hollerith_card_qid1.eblet.md'), 'utf8')).toBe(before);
    // a person rejects one and accepts the other; the accepted one lands (already_present here: same bytes) and the inbox empties
    expect(rejectHeldOffer(rInbox, 'KNOWN', 'hollerith_card_qid1.eblet.md').ok).toBe(true);
    const acc = acceptHeldOffer(rInbox, rSilo, 'OTH', 'hollerith_card_qid1.eblet.md', 'R', { tagsDir: rTags, signer: ctx.tagSigner! });
    expect(acc.ok && acc.action === 'already_present').toBe(true);
    expect(listHeldOffers(rInbox)).toEqual([]);
    expect(acceptHeldOffer(rInbox, rSilo, 'OTH', 'hollerith_card_qid1.eblet.md', 'R')).toMatchObject({ ok: false });
  });

  it('a stranger (self-declared key) is refused and nothing is kept; an unshareable card is never sent; a tampered receipt is not trusted', async () => {
    const s = await push(STR);
    expect([s.action, s.httpStatus, s.receiptVerified, s.senderTrustAtReceiver]).toEqual(['refused', 403, true, 'self_declared']);
    expect(listHeldOffers(rInbox)).toEqual([]);
    expect(existsSync(join(rInbox, 'STR'))).toBe(false);
    const priv = await push(SAME, { file: 'private_qid3.eblet.md' });
    expect([priv.action, priv.httpStatus]).toEqual(['error', null]);
    expect(priv.error).toMatch(/not shareable: mesh_share/);
    // a receipt re-signed by the wrong key (a man in the middle) fails verification and the push is not counted as landed
    const forge: typeof fetch = async (u, init) => { const r = await fetch(u, init); const j = await r.json(); j.signed_receipt = signer(STR)('x', { ...(j.receipt as Record<string, unknown>) }); return new Response(JSON.stringify(j), { status: r.status }); };
    const f = await push(SAME, { fetchImpl: forge });
    expect([f.receiptVerified, f.action]).toEqual([false, 'already_present']);
    expect(f.error).toMatch(/signed receipt failed verification/);
    // an unsigned offer is refused at the door
    const raw = await fetch(url + LIBRARY_OFFER_PATH, { method: 'POST', body: JSON.stringify({ offer: { file: 'x.eblet.md', content: 'y' } }) });
    expect(raw.status).toBe(403);
  });

  it('a changed card from the same owner replaces the old one with a Rule 66 sibling', async () => {
    writeFileSync(join(rSilo, 'hollerith_card_qid1.eblet.md'), 'an older local copy');
    const r = await push(SAME);
    expect(r.action).toBe('replaced_with_superseded_sibling');
    expect(readdirSync(rSilo).some((f) => /hollerith_card_qid1\.superseded\./.test(f))).toBe(true);
  });
});

describe('X041 the fourth consent: settings and the decision', () => {
  const entry = { connector: 'c', file: 'f', sha256: 's', bytes: 1, qid: 1, title: 't', kind: 'hollerith_card', tags: [], keywords: [], provenance: null, cardTextSha256: 'x', sourceStatus: 'sourced' as const, sourceKind: 'url', sourceLabel: null, sealable: true };
  it('default: same owner accepts, enrolled or known is held, a stranger is refused', () => {
    expect(defaultOfferConsent({ senderPeerId: 'a', trust: 'enrolled', policy: 'same_owner', entry }).decision).toBe('accept');
    expect(defaultOfferConsent({ senderPeerId: 'a', trust: 'enrolled', policy: 'other_owner', entry }).decision).toBe('hold');
    expect(defaultOfferConsent({ senderPeerId: 'a', trust: 'known', policy: 'other_owner', entry }).decision).toBe('hold');
    expect(defaultOfferConsent({ senderPeerId: 'a', trust: 'self_declared', policy: 'other_owner', entry }).decision).toBe('refuse');
  });
  it('a person may widen it to every enrolled peer or to named peers, never to strangers', () => {
    const wide = { acceptFrom: 'enrolled' as const, allowPeers: ['friend'] };
    expect(decideOfferConsent(wide, { senderPeerId: 'a', trust: 'enrolled', policy: 'other_owner', entry }).decision).toBe('accept');
    expect(decideOfferConsent(wide, { senderPeerId: 'a', trust: 'known', policy: 'other_owner', entry }).decision).toBe('hold');
    expect(decideOfferConsent(wide, { senderPeerId: 'friend', trust: 'known', policy: 'other_owner', entry }).decision).toBe('accept');
    expect(decideOfferConsent(wide, { senderPeerId: 'friend', trust: 'self_declared', policy: 'other_owner', entry }).decision).toBe('refuse');
    expect(decideOfferConsent(DEFAULT_SHARE_RECEIVE_SETTINGS, { senderPeerId: 'a', trust: 'enrolled', policy: 'other_owner', entry }).decision).toBe('hold');
  });
  it('settings fail closed and are written with a Rule 66 sibling', () => {
    const dir = mkdtempSync(join(tmpdir(), 'share-settings-'));
    const p = join(dir, 'share_receive_settings.json');
    expect(readShareReceiveSettings(p)).toEqual(DEFAULT_SHARE_RECEIVE_SETTINGS);
    writeFileSync(p, '{not json');
    expect(readShareReceiveSettings(p)).toEqual(DEFAULT_SHARE_RECEIVE_SETTINGS);
    expect(writeShareReceiveSettings({ acceptFrom: 'enrolled', allowPeers: ['x', '', 7 as unknown as string] }, p)).toEqual({ acceptFrom: 'enrolled', allowPeers: ['x'] });
    expect(readShareReceiveSettings(p)).toEqual({ acceptFrom: 'enrolled', allowPeers: ['x'] });
    expect(writeShareReceiveSettings({ acceptFrom: 'anyone' as unknown as 'enrolled' }, p).acceptFrom).toBe('same_owner');
    expect(readdirSync(dir).some((f) => /superseded/.test(f))).toBe(true);
  });
});
