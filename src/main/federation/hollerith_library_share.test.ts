// D-BP223-BM0-X029-007: hollerith_library_share.ts -- signed search/fetch, manifest verification, tamper refusal, Rule 66.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { generateKeyPairSync, createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encodeFrame } from '../wire/hex-encode';
import { signFrame } from '../thorax/sign_verify';
import { handleLibraryRoute, pullLibraryFromPeer, soccerballAddress, buildSiloIndex, validateShareableEblet, resolveSharePolicy, canSealSharedCard, type LibraryRouteContext } from './hollerith_library_share';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
function keypair(peer_id: string) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', { publicKeyEncoding: { type: 'spki', format: 'der' }, privateKeyEncoding: { type: 'pkcs8', format: 'der' } });
  return { peer_id, public_key_hex: publicKey.toString('hex'), private_key_hex: privateKey.toString('hex') };
}
const signer = (k: ReturnType<typeof keypair>) => (seed: string, p: Record<string, unknown>) =>
  signFrame(encodeFrame(seed, 'broadcast', { ...p, public_key_hex: k.public_key_hex }), k.private_key_hex);
// X029-022: every shared card carries source_status + source_kind; `source` null writes a card WITHOUT them (must be refused)
function card(qid: number, share = true, source: { status: string; kind: string } | null = { status: 'source_pending', kind: 'none_found' }) {
  const body = `=== REFERENCE METHOD CARD ===\nmethod for ${qid}\n=== END OF METHOD CARD ===\n`;
  const pearl = `hollerith_card:qid${qid}:sha256:${sha(body)}`;
  const src = source ? `source_status: ${source.status}\nsource_kind: ${source.kind}\n` : '';
  return `---\nkind: hollerith_card\ntitle: "Hollerith card qid ${qid} (business)"\nqid: ${qid}\ntags: [hollerith-card, business, qid-${qid}]\nkeywords: [depreciation]\nhex_connector: ${soccerballAddress([pearl])}\nconnector_pearl: "${pearl}"\ncard_text_sha256: ${sha(body)}\nprovenance: BLIND\nmesh_share: ${share}\nleak_scan: clean_strict\n${src}---\n${body}`;
}

describe('hollerith_library_share', () => {
  const A = keypair('A'); const B = keypair('B'); const C = keypair('C');
  const silo = mkdtempSync(join(tmpdir(), 'holl-a-'));
  let server: http.Server; let url = '';
  beforeAll(async () => {
    // X030-067 pick B: this transport suite's requester B is enrolled with no owner id (other_owner), so its fixture cards are
    // SOURCED; a source_pending card would now be withheld from B (covered by the pick B suite below).
    writeFileSync(join(silo, 'hollerith_card_qid1.eblet.md'), card(1, true, { status: 'sourced', kind: 'url' }));
    writeFileSync(join(silo, 'hollerith_card_qid2.eblet.md'), card(2, true, { status: 'sourced', kind: 'url' }));
    writeFileSync(join(silo, 'private_qid3.eblet.md'), card(3, false));
    const ctx: LibraryRouteContext = {
      siloDir: silo, selfPeerId: 'A',
      resolveSenderKey: (id) => (id === 'B' ? { key: B.public_key_hex, trust: 'enrolled' } : null),
      allowSelfDeclaredKey: false, signPayload: signer(A),
    };
    server = http.createServer(async (req, res) => {
      const r = await handleLibraryRoute(req.url ?? '', req.method ?? 'GET', () => new Promise((ok) => { const c: Buffer[] = []; req.on('data', (d) => c.push(d)); req.on('end', () => ok(Buffer.concat(c).toString('utf8'))); }), ctx);
      const t = JSON.stringify(r ? r.body : { error: 'Not found' }); res.writeHead(r ? r.status : 404, { 'content-type': 'application/json' }); res.end(t);
    });
    await new Promise<void>((ok) => server.listen(0, '127.0.0.1', () => ok()));
    url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterAll(() => server.close());

  it('lists only mesh_share eblets whose connector re-derives', () => {
    const idx = buildSiloIndex(silo);
    expect(idx.connectors.map((c) => c.qid)).toEqual([1, 2]);
    expect(idx.skipped[0].reason).toMatch(/mesh_share/);
  });

  it('X029-022: refuses to share a card with no source, a bad source kind, or a status that disagrees with the kind', () => {
    expect(validateShareableEblet('a.eblet.md', card(7, true, null))).toMatchObject({ ok: false, reason: expect.stringMatching(/source_status missing/) });
    expect(validateShareableEblet('b.eblet.md', card(8, true, { status: 'sourced', kind: 'vibes' }))).toMatchObject({ ok: false, reason: expect.stringMatching(/source_kind/) });
    expect(validateShareableEblet('c.eblet.md', card(9, true, { status: 'sourced', kind: 'none_found' }))).toMatchObject({ ok: false, reason: expect.stringMatching(/disagree/) });
    expect(validateShareableEblet('d.eblet.md', card(10, true, { status: 'sourced', kind: 'url' })).ok).toBe(true);
    expect(validateShareableEblet('e.eblet.md', card(11, true)).ok).toBe(true);
  });

  it('enrolled peer pulls by tag, verifies the signed manifest, writes byte-identical files, then already_present', async () => {
    const dest = mkdtempSync(join(tmpdir(), 'holl-b-'));
    const r1 = await pullLibraryFromPeer({ peerBaseUrl: url, senderPeerId: 'B', signPayload: signer(B), query: { tags: ['hollerith-card'] }, destDir: dest, expectedPublisherKeyHex: A.public_key_hex });
    expect(r1.error).toBeUndefined();
    expect([r1.listed, r1.written, r1.refused, r1.publisherKeyTrust, r1.requesterTrustAtPublisher]).toEqual([2, 2, 0, 'expected_key', 'enrolled']);
    expect(readFileSync(join(dest, 'hollerith_card_qid1.eblet.md'), 'utf8')).toBe(readFileSync(join(silo, 'hollerith_card_qid1.eblet.md'), 'utf8'));
    const r2 = await pullLibraryFromPeer({ peerBaseUrl: url, senderPeerId: 'B', signPayload: signer(B), query: { keywords: ['depreciation'] }, destDir: dest, expectedPublisherKeyHex: A.public_key_hex });
    expect([r2.written, r2.alreadyPresent]).toEqual([0, 2]);
  });

  it('refuses unenrolled, impersonating and unsigned requesters', async () => {
    const dest = mkdtempSync(join(tmpdir(), 'holl-c-'));
    const unenrolled = await pullLibraryFromPeer({ peerBaseUrl: url, senderPeerId: 'C', signPayload: signer(C), query: { tags: ['hollerith-card'] }, destDir: dest });
    expect(unenrolled.error).toMatch(/HTTP 403/);
    const impersonate = await pullLibraryFromPeer({ peerBaseUrl: url, senderPeerId: 'B', signPayload: signer(C), query: { tags: ['hollerith-card'] }, destDir: dest });
    expect(impersonate.error).toMatch(/signature verification failed/);
    const unsigned = await fetch(url + '/api/library/search', { method: 'POST', body: JSON.stringify({ query: { tags: ['hollerith-card'] } }) });
    expect(unsigned.status).toBe(403);
    expect(readdirSync(dest)).toEqual([]);
  });

  it('refuses content altered in transit and a wrong publisher key; replaces changed files with a Rule 66 sibling', async () => {
    const dest = mkdtempSync(join(tmpdir(), 'holl-d-'));
    const tamper: typeof fetch = async (u, init) => { const r = await fetch(u, init); const j = await r.json(); if (String(u).endsWith('/fetch')) for (const f of j.files) f.content = f.content.replace('method', 'm3thod'); return new Response(JSON.stringify(j), { status: r.status }); };
    const t = await pullLibraryFromPeer({ peerBaseUrl: url, senderPeerId: 'B', signPayload: signer(B), query: { tags: ['qid-1'] }, destDir: dest, fetchImpl: tamper, expectedPublisherKeyHex: A.public_key_hex });
    expect([t.written, t.refused]).toEqual([0, 1]);
    const w = await pullLibraryFromPeer({ peerBaseUrl: url, senderPeerId: 'B', signPayload: signer(B), query: { tags: ['qid-1'] }, destDir: dest, expectedPublisherKeyHex: C.public_key_hex });
    expect(w.error).toMatch(/signed manifest failed verification/);
    writeFileSync(join(dest, 'hollerith_card_qid1.eblet.md'), 'old local copy');
    const rep = await pullLibraryFromPeer({ peerBaseUrl: url, senderPeerId: 'B', signPayload: signer(B), query: { tags: ['qid-1'] }, destDir: dest, expectedPublisherKeyHex: A.public_key_hex });
    expect(rep.files[0].action).toBe('replaced_with_superseded_sibling');
    expect(readdirSync(dest).some((f) => /\.superseded\./.test(f))).toBe(true);
    expect(existsSync(join(dest, 'hollerith_card_qid1.eblet.md'))).toBe(true);
  });
});

// D-BP223-BM0-X030-067 PICK B (Founder k/dc99f6ff): source_pending cards go to the SAME OWNER's own machines only (person-level
// identity: enrolled key + enrollment-record owner_id), visibly labeled "source pending"; other owners get sourced cards only;
// sealing refuses source_pending.
function supportFile(name: string, extraTags = '', status = 'not_a_card', kind = 'not_applicable') {
  const body = `support ${name}\n`;
  const pearl = `hollerith_recall_file:${name}:sha256:${sha(body)}`;
  return `---\nkind: hollerith_recall_file\ntitle: "support ${name}"\ntags: [hollerith-code-maze, pickb${extraTags}]\npkg_path: "${name}"\nhex_connector: ${soccerballAddress([pearl])}\nconnector_pearl: "${pearl}"\ncard_text_sha256: ${sha(body)}\nmesh_share: true\nleak_scan: clean_nogold\nsource_status: ${status}\nsource_kind: ${kind}\n---\n${body}`;
}
const OWNER = 'a'.repeat(32);
const OTHER = 'b'.repeat(32);

describe('X030-067 pick B: same-owner share of source_pending cards', () => {
  const P = keypair('P'); const SAME = keypair('SAME'); const OTH = keypair('OTH'); const TOFU = keypair('TOFU');
  const silo = mkdtempSync(join(tmpdir(), 'holl-pb-'));
  let server: http.Server; let url = '';
  const N_SOURCED = 3; const N_PENDING = 7;
  beforeAll(async () => {
    const tag = (q: number) => card(q).replace('tags: [hollerith-card,', 'tags: [hollerith-card, pickb,');
    for (let q = 100; q < 100 + N_SOURCED; q++) writeFileSync(join(silo, `c${q}.eblet.md`), tag(q).replace('source_status: source_pending\nsource_kind: none_found', 'source_status: sourced\nsource_kind: url'));
    for (let q = 200; q < 200 + N_PENDING; q++) writeFileSync(join(silo, `c${q}.eblet.md`), tag(q));
    writeFileSync(join(silo, 'support_exec.eblet.md'), supportFile('recall_exec.cjs'));
    const owners: Record<string, string> = { SAME: OWNER, OTH: OTHER };
    const keys: Record<string, string> = { SAME: SAME.public_key_hex, OTH: OTH.public_key_hex };
    const ctx: LibraryRouteContext = {
      siloDir: silo, selfPeerId: 'P', selfOwnerId: OWNER,
      resolveSenderKey: (id) => (keys[id] ? { key: keys[id], trust: 'enrolled' } : null),
      resolveSenderOwnerId: (id) => owners[id] ?? null,
      allowSelfDeclaredKey: true, signPayload: signer(P),
    };
    server = http.createServer(async (req, res) => {
      const r = await handleLibraryRoute(req.url ?? '', req.method ?? 'GET', () => new Promise((ok) => { const c: Buffer[] = []; req.on('data', (d) => c.push(d)); req.on('end', () => ok(Buffer.concat(c).toString('utf8'))); }), ctx);
      const t = JSON.stringify(r ? r.body : { error: 'Not found' }); res.writeHead(r ? r.status : 404, { 'content-type': 'application/json' }); res.end(t);
    });
    await new Promise<void>((ok) => server.listen(0, '127.0.0.1', () => ok()));
    url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterAll(() => server.close());

  it('same owner receives every card, source_pending ones labeled "source pending" and UNSEALABLE', async () => {
    const dest = mkdtempSync(join(tmpdir(), 'holl-pb-same-'));
    const r = await pullLibraryFromPeer({ peerBaseUrl: url, senderPeerId: 'SAME', signPayload: signer(SAME), query: { tags: ['pickb'] }, destDir: dest, expectedPublisherKeyHex: P.public_key_hex, ownerId: OWNER });
    expect(r.error).toBeUndefined();
    expect([r.sharePolicy, r.listed, r.written, r.refused, r.sourced, r.sourcePending, r.notACard]).toEqual(['same_owner', N_SOURCED + N_PENDING + 1, N_SOURCED + N_PENDING + 1, 0, N_SOURCED, N_PENDING, 1]);
    const pending = r.files.filter((f) => f.sourceStatus === 'source_pending');
    expect(pending.length).toBe(N_PENDING);
    expect(pending.every((f) => f.sourceLabel === 'source pending' && f.sealState === 'UNSEALABLE')).toBe(true);
    expect(r.files.filter((f) => f.sourceStatus === 'sourced').every((f) => f.sealState === 'SEALABLE' && f.sourceLabel === null)).toBe(true);
  });

  it('another owner (enrolled) receives only sourced cards plus support files; pending are withheld, not served', async () => {
    const dest = mkdtempSync(join(tmpdir(), 'holl-pb-oth-'));
    const r = await pullLibraryFromPeer({ peerBaseUrl: url, senderPeerId: 'OTH', signPayload: signer(OTH), query: { tags: ['pickb'] }, destDir: dest, expectedPublisherKeyHex: P.public_key_hex, ownerId: OTHER });
    expect([r.sharePolicy, r.listed, r.written, r.sourced, r.sourcePending, r.notACard]).toEqual(['other_owner', N_SOURCED + 1, N_SOURCED + 1, N_SOURCED, 0, 1]);
    expect(readdirSync(dest).some((f) => /^c2\d\d\./.test(f))).toBe(false);
    // asking for a pending connector by id directly is withheld, never served
    const pendingConn = buildSiloIndex(silo).connectors.find((c) => c.sourceStatus === 'source_pending')!.connector;
    const byId = await pullLibraryFromPeer({ peerBaseUrl: url, senderPeerId: 'OTH', signPayload: signer(OTH), query: { connectors: [pendingConn] }, destDir: dest, expectedPublisherKeyHex: P.public_key_hex });
    expect([byId.listed, byId.written]).toEqual([0, 0]);
  });

  it('same-owner is never granted by a claim: TOFU key claiming the owner id, and an enrolled peer lying about its owner, both get other_owner', async () => {
    const d1 = mkdtempSync(join(tmpdir(), 'holl-pb-tofu-'));
    const tofu = await pullLibraryFromPeer({ peerBaseUrl: url, senderPeerId: 'TOFU', signPayload: signer(TOFU), query: { tags: ['pickb'] }, destDir: d1, ownerId: OWNER });
    expect([tofu.requesterTrustAtPublisher, tofu.sharePolicy, tofu.sourcePending]).toEqual(['self_declared', 'other_owner', 0]);
    const d2 = mkdtempSync(join(tmpdir(), 'holl-pb-liar-'));
    const liar = await pullLibraryFromPeer({ peerBaseUrl: url, senderPeerId: 'OTH', signPayload: signer(OTH), query: { tags: ['pickb'] }, destDir: d2, ownerId: OWNER });
    expect([liar.sharePolicy, liar.sourcePending, liar.sourced]).toEqual(['other_owner', 0, N_SOURCED]);
    const d3 = mkdtempSync(join(tmpdir(), 'holl-pb-sameclaimother-'));
    const mism = await pullLibraryFromPeer({ peerBaseUrl: url, senderPeerId: 'SAME', signPayload: signer(SAME), query: { tags: ['pickb'] }, destDir: d3, ownerId: OTHER });
    expect([mism.sharePolicy, mism.sourcePending]).toEqual(['other_owner', 0]);
  });

  it('a node with no owner id (not signed in) shares no source_pending card to anyone', () => {
    expect(resolveSharePolicy('enrolled', 'SAME', {}, { selfOwnerId: null, resolveSenderOwnerId: () => OWNER }).policy).toBe('other_owner');
    expect(resolveSharePolicy('known', 'SAME', {}, { selfOwnerId: OWNER, resolveSenderOwnerId: () => OWNER }).policy).toBe('other_owner');
    expect(resolveSharePolicy('enrolled', 'SAME', {}, { selfOwnerId: OWNER, resolveSenderOwnerId: () => OWNER }).policy).toBe('same_owner');
  });

  it('sealing refuses source_pending; sourced seals; not_a_card is not sealable', () => {
    const idx = buildSiloIndex(silo);
    const pend = idx.connectors.find((c) => c.sourceStatus === 'source_pending')!;
    const src = idx.connectors.find((c) => c.sourceStatus === 'sourced')!;
    const sup = idx.connectors.find((c) => c.sourceStatus === 'not_a_card')!;
    expect(canSealSharedCard(pend)).toMatchObject({ ok: false, reason: expect.stringMatching(/source pending/) });
    expect(canSealSharedCard(src).ok).toBe(true);
    expect(canSealSharedCard(sup).ok).toBe(false);
    expect([pend.sealable, src.sealable, sup.sealable]).toEqual([false, true, false]);
  });

  it('a card cannot dodge the source rule by calling itself not_a_card', () => {
    expect(validateShareableEblet('x.eblet.md', supportFile('cards/formula_qid5.formula.json'))).toMatchObject({ ok: false, reason: expect.stringMatching(/cannot be marked not_a_card/) });
    expect(validateShareableEblet('y.eblet.md', supportFile('other.json', ', qid-5'))).toMatchObject({ ok: false, reason: expect.stringMatching(/cannot be marked not_a_card/) });
    expect(validateShareableEblet('z.eblet.md', supportFile('source_addenda/q5.json'))).toMatchObject({ ok: false, reason: expect.stringMatching(/cannot be marked not_a_card/) });
    expect(validateShareableEblet('w.eblet.md', supportFile('recall_exec.cjs', '', 'not_a_card', 'url'))).toMatchObject({ ok: false, reason: expect.stringMatching(/not_applicable/) });
  });

  it('tamper: an other-owner receipt refuses a source_pending card even if a publisher sends one, and a status edited in transit is refused', async () => {
    const dest = mkdtempSync(join(tmpdir(), 'holl-pb-tamper-'));
    // edit the pending card's source_status to "sourced" in transit: the body sha still matches, but the content sha differs from the signed manifest
    const flip: typeof fetch = async (u, init) => { const r = await fetch(u, init); const j = await r.json(); if (String(u).endsWith('/fetch')) for (const f of j.files) f.content = f.content.replace('source_status: sourced\nsource_kind: url', 'source_status: source_pending\nsource_kind: none_found'); return new Response(JSON.stringify(j), { status: r.status }); };
    const t = await pullLibraryFromPeer({ peerBaseUrl: url, senderPeerId: 'OTH', signPayload: signer(OTH), query: { tags: ['pickb'] }, destDir: dest, fetchImpl: flip, expectedPublisherKeyHex: P.public_key_hex });
    expect([t.sharePolicy, t.refused, t.sourcePending]).toEqual(['other_owner', N_SOURCED, 0]);
    expect(t.files.filter((f) => f.action === 'refused').every((f) => /signed manifest/.test(f.reason ?? ''))).toBe(true);
  });
});
