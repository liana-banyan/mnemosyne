// D-BP223-BM0-X030-207: eblet_provenance_tags.ts -- ORIGIN sealing, TRAIL, USE rows, signatures, tamper refusal, negative
// savings, per-model strata, billing sum, privacy, the CJS twin (both directions), and the library share carrying provenance.
import { describe, it, expect } from 'vitest';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync, createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encodeFrame } from '../wire/hex-encode';
import { signFrame } from '../thorax/sign_verify';
import * as T from './eblet_provenance_tags';
import { handleLibraryRoute, pullLibraryFromPeer, soccerballAddress, type LibraryRouteContext } from './hollerith_library_share';

const CLI = 'C:/Users/Administrator/Documents/LianaBanyanPlatform/HARDWIRE/tools/facts/eblet_tags/eblet_tags_cli.cjs';
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const tmp = () => mkdtempSync(join(tmpdir(), 'eblet-tags-ts-'));
function key(peer: string) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', { publicKeyEncoding: { type: 'spki', format: 'der' }, privateKeyEncoding: { type: 'pkcs8', format: 'der' } });
  return { peer_id: peer, public_key_hex: publicKey.toString('hex'), private_key_hex: privateKey.toString('hex') };
}
const kA = key('nodeA0000000000a'); const kB = key('nodeB0000000000b');
const A = T.signerFromKeypair(kA.peer_id, kA.public_key_hex, kA.private_key_hex);
const B = T.signerFromKeypair(kB.peer_id, kB.public_key_hex, kB.private_key_hex);
const BASE: T.BaselineInput = { status: 'measured', measured_utc: '2026-09-16T00:00:00Z', per_model: {
  'claude-fable-5-1': { vendor: 'Anthropic', billable_input_tokens: 1000, billable_output_tokens: 2000, usd: 0.11 },
  'gemma4:12b': { vendor: 'Ollama', cash_basis: 'local_zero_cash', billable_input_tokens: 500, billable_output_tokens: 700, usd: 0 },
} };
function mint(dir: string, id: string, baseline: T.BaselineInput = BASE) {
  const ref = T.cardRef({ card_id: id, content_sha256: sha(id) });
  T.sealOrigin(dir, { card_ref: ref, minted_by: A.peer_id, source: { kind: 'url', status: 'sourced', value: 'https://example.org' }, baseline }, A);
  return ref;
}

describe('eblet_provenance_tags', () => {
  it('seals ORIGIN once; a second ORIGIN is refused; unmeasured baselines are never invented', () => {
    const d = tmp(); const r = mint(d, 'c1');
    expect(T.verifyLedger(d, r.card_key).ok).toBe(true);
    expect(() => T.sealOrigin(d, { card_ref: r, baseline: BASE }, A)).toThrow(/ORIGIN_EXISTS/);
    const r2 = mint(d, 'c2', { status: 'unmeasured', reason: 'Pawn relay' });
    const u = T.appendUse(d, r2.card_key, { model_spared: 'claude-fable-5-1', actual: { model_calls: 0 } }, A);
    expect(u).toMatchObject({ savings_status: 'unmeasured', saved_tokens: null, saved_usd: null, baseline_tokens: null });
  });

  it('TRAIL hops and USE rows chain and verify; code recall and model call; thinking tokens counted; negative kept', () => {
    const d = tmp(); const r = mint(d, 'c3');
    T.appendTrailHop(d, r.card_key, { from_node: A.peer_id, to_node: B.peer_id, package_id: 'deck' }, A);
    const u1 = T.appendUse(d, r.card_key, { model_spared: 'claude-fable-5-1', actual: { model_calls: 0 }, licensee_id: 'org' }, B);
    const u2 = T.appendUse(d, r.card_key, { model_spared: 'claude-fable-5-1', actual: { model_calls: 1, vendor: 'Anthropic', usage: { input: 3000, output: 1500 }, trueTotalUsd: 0.105 } }, B);
    expect(u1.saved_tokens).toBe(3000); expect(u1.saved_usd).toBe(0.11);
    expect(u2.saved_tokens).toBe(-1500); expect(u2.saved_usd).toBe(0.005);
    const g = T.measureActual({ model_calls: 1, vendor: 'Google', usage: { input: 10, output: 5, reasoning: 100 } }, null);
    expect(g.billable_tokens).toBe(115);
    const v = T.verifyLedger(d, r.card_key);
    expect(v.ok).toBe(true); expect(v.trail).toHaveLength(1); expect(v.uses).toHaveLength(2);
    expect(() => T.appendUse(d, r.card_key, { model_spared: 'claude-fable-5-1', actual: { model_calls: 2 } }, A)).toThrow(/ACTUAL_UNMEASURED/);
  });

  it('refuses tampered ledgers: edited row, forged re-sign, deleted row, edited baseline', () => {
    const d = tmp(); const r = mint(d, 'c4');
    for (let i = 0; i < 3; i++) T.appendUse(d, r.card_key, { model_spared: 'claude-fable-5-1', actual: { model_calls: 0 } }, A);
    const p = T.ledgerPaths(d, r.card_key); const good = readFileSync(p.uses, 'utf8'); const lines = good.trim().split('\n');
    writeFileSync(p.uses, good.replace('"saved_tokens":3000', '"saved_tokens":4000'));
    expect(T.verifyLedger(d, r.card_key).ok).toBe(false);
    expect(() => T.appendUse(d, r.card_key, { model_spared: 'claude-fable-5-1', actual: { model_calls: 0 } }, A)).toThrow(/TAMPER_REFUSED/);
    const forged = JSON.parse(lines[1]); forged.saved_tokens = 9999; forged.signer_public_key_hex = B.public_key_hex; forged.row_hash = T.rowHashOf(forged); forged.sig = B.signHash(forged.row_hash);
    writeFileSync(p.uses, [lines[0], JSON.stringify(forged), lines[2]].join('\n') + '\n');
    expect(T.verifyLedger(d, r.card_key).errors.join()).toMatch(/recompute/);
    writeFileSync(p.uses, [lines[0], lines[2]].join('\n') + '\n');
    expect(T.verifyLedger(d, r.card_key).errors.join()).toMatch(/chain|seq/);
    writeFileSync(p.uses, good);
    const prov = readFileSync(p.provenance, 'utf8');
    writeFileSync(p.provenance, prov.replace('"usd":0.11', '"usd":0.99'));
    expect(T.verifyLedger(d, r.card_key).ok).toBe(false);
    expect(T.greenBarrel([d]).ledgers_rejected).toHaveLength(1);
  });

  it('X031H baseline addendum: fills a missing model, refuses an existing figure, tamper detected, savings use it', () => {
    const d = tmp();
    const r = mint(d, 'add1', { status: 'measured', measured_utc: '2026-09-16T00:00:00Z', per_model: { 'claude-fable-5-1': { vendor: 'Anthropic', billable_input_tokens: 1000, billable_output_tokens: 2000, usd: 0.11 } } });
    const ADD: T.BaselineModelInput = { vendor: 'Ollama', cash_basis: 'local_zero_cash', billable_input_tokens: 400, billable_output_tokens: 900, usd: 0, receipt: { file: 'plain.jsonl', file_sha256: sha('plain'), row_started_utc: null, http_status: 200 } };
    const origin = T.verifyLedger(d, r.card_key).origin;
    const a = T.appendBaselineAddendum(d, r.card_key, { model: 'gemma4:12b', baseline: ADD }, B);
    expect(a).toMatchObject({ type: 'baseline_addendum', seq: 1, model: 'gemma4:12b', origin_hash: origin?.row_hash });
    expect(a.addendum_baseline.receipt).toMatchObject({ file: 'plain.jsonl', file_sha256: sha('plain') });
    expect(() => T.appendBaselineAddendum(d, r.card_key, { model: 'claude-fable-5-1', baseline: ADD }, A)).toThrow(/ADDENDUM_REFUSED/);
    expect(() => T.appendBaselineAddendum(d, r.card_key, { model: 'gemma4:12b', baseline: ADD }, A)).toThrow(/ADDENDUM_REFUSED/);
    expect(() => T.appendBaselineAddendum(d, r.card_key, { model: 'llama3.1:8b', baseline: { ...ADD, receipt: { file: 'x' } } }, A)).toThrow(/ADDENDUM_INVALID/);
    const u = T.appendUse(d, r.card_key, { model_spared: 'gemma4:12b', actual: { model_calls: 0 } }, A);
    expect(u).toMatchObject({ savings_status: 'measured', saved_tokens: 1300, baseline_source: 'addendum', baseline_addendum_hash: a.row_hash });
    expect(T.appendUse(d, r.card_key, { model_spared: 'claude-fable-5-1', actual: { model_calls: 0 } }, A).saved_tokens).toBe(3000);
    const v = T.verifyLedger(d, r.card_key);
    expect(v.ok).toBe(true); expect(v.addenda).toHaveLength(1); expect(v.origin?.baseline_hash).toBe(origin?.baseline_hash);
    const p = T.ledgerPaths(d, r.card_key).provenance; const good = readFileSync(p, 'utf8');
    writeFileSync(p, good.replace('"billable_output_tokens":900', '"billable_output_tokens":9000'));
    expect(T.verifyLedger(d, r.card_key).ok).toBe(false);
    expect(() => T.appendUse(d, r.card_key, { model_spared: 'gemma4:12b', actual: { model_calls: 0 } }, A)).toThrow(/TAMPER_REFUSED/);
    let cliOut = ''; try { execFileSync(process.execPath, [CLI, 'verify', '--dir', d], { encoding: 'utf8' }); } catch (e) { cliOut = String((e as { stdout?: string }).stdout || ''); }
    expect(JSON.parse(cliOut).ok).toBe(0); // the CJS twin also rejects the tampered addendum (exit 1)
    writeFileSync(p, good);
    expect(T.verifyLedger(d, r.card_key).ok).toBe(true);
  });

  it('green barrel strata per model and the read-only billing sum', () => {
    const d = tmp(); const r1 = mint(d, 's1'); const r2 = mint(d, 's2');
    T.appendUse(d, r1.card_key, { model_spared: 'claude-fable-5-1', actual: { model_calls: 0 }, licensee_id: 'org-a', at_utc: '2026-09-05T00:00:00Z' }, A);
    T.appendUse(d, r2.card_key, { model_spared: 'claude-fable-5-1', actual: { model_calls: 0 }, licensee_id: 'org-a', at_utc: '2026-09-06T00:00:00Z' }, A);
    T.appendUse(d, r2.card_key, { model_spared: 'gemma4:12b', actual: { model_calls: 0 }, licensee_id: 'org-b', at_utc: '2026-09-06T00:00:00Z' }, A);
    const g = T.greenBarrel([d]);
    expect(g.strata.map((s) => [s.model, s.tokens_saved, s.usd_saved])).toEqual([['claude-fable-5-1', 6000, 0.22], ['gemma4:12b', 1200, 0]]);
    const bill = T.measuredSavings([d], { licensee_id: 'ORG-A', from: '2026-09-01T00:00:00Z', to: '2026-10-01T00:00:00Z' });
    expect(bill).toMatchObject({ measured_tokens_saved: 6000, measured_usd_saved: 0.22, measured_uses: 2, read_only: true });
  });

  it('privacy: question text and long strings refused; licensee stored as a hash', () => {
    const d = tmp(); const r = mint(d, 'p1');
    expect(T.privacyViolation({ actual: { question: 'what?' } }, 'use')).toMatch(/not allowed/);
    expect(() => T.appendTrailHop(d, r.card_key, { from_node: 'x'.repeat(300), to_node: 'y' }, A)).toThrow(/PRIVACY_REFUSED/);
    T.appendUse(d, r.card_key, { model_spared: 'claude-fable-5-1', actual: { model_calls: 0 }, licensee_id: 'Acme Secret Corp' }, A);
    expect(readFileSync(T.ledgerPaths(d, r.card_key).uses, 'utf8')).not.toMatch(/Acme/);
  });

  it('CJS twin: a ledger written by eblet_tags.cjs verifies here, and one written here verifies there (byte-identical hashing)', () => {
    const d = tmp();
    const made = JSON.parse(execFileSync(process.execPath, [CLI, 'fixture', '--dir', d], { encoding: 'utf8' }));
    for (const k of made.cards) expect(T.verifyLedger(d, k)).toMatchObject({ ok: true });
    const g = T.greenBarrel([d]);
    expect(g.strata.find((s) => s.model === 'gemini-3.1-pro-preview')).toMatchObject({ tokens_saved: -1200, usd_saved: -0.02, negative_uses: 1 });
    // X031H: the CJS-written BASELINE ADDENDUM and the use priced against it verify here
    expect(g.strata.find((s) => s.model === 'gemma4:12b')).toMatchObject({ tokens_saved: 1300, measured_uses: 1 });
    const d2 = tmp(); const r = mint(d2, 'ts-side');
    T.appendTrailHop(d2, r.card_key, { from_node: A.peer_id, to_node: B.peer_id }, A);
    T.appendUse(d2, r.card_key, { model_spared: 'gemma4:12b', actual: { model_calls: 1, vendor: 'Ollama', usage: { input: 100, output: 50 } } }, B);
    T.appendBaselineAddendum(d2, r.card_key, { model: 'llama3.1:8b', baseline: { vendor: 'Ollama', cash_basis: 'local_zero_cash', billable_input_tokens: 300, billable_output_tokens: 200, usd: 0, receipt: { file: 'ts_plain_run.jsonl', file_sha256: sha('ts-run'), row_started_utc: null, http_status: 200 } } }, A);
    T.appendUse(d2, r.card_key, { model_spared: 'llama3.1:8b', actual: { model_calls: 0 } }, B);
    const out = JSON.parse(execFileSync(process.execPath, [CLI, 'verify', '--dir', d2], { encoding: 'utf8' }));
    expect(out).toMatchObject({ ledgers: 1, ok: 1, trail_hops: 1, baseline_addenda: 1, use_rows: 2 });
    const barrel = JSON.parse(execFileSync(process.execPath, [CLI, 'barrel', '--dir', d2], { encoding: 'utf8' }));
    expect(barrel.strata.find((s: { model: string }) => s.model === 'llama3.1:8b')).toMatchObject({ tokens_saved: 500, measured_uses: 1 });
  });

  it('library share: provenance travels with the copy and the requester appends a signed TRAIL hop', async () => {
    const silo = tmp(); const pubTags = tmp(); const dest = tmp(); const reqTags = tmp();
    const body = '=== REFERENCE METHOD CARD ===\nmethod for 42\n=== END OF METHOD CARD ===\n';
    const pearl = `hollerith_card:qid42:sha256:${sha(body)}`; const connector = soccerballAddress([pearl]);
    writeFileSync(join(silo, 'hollerith_card_qid42.eblet.md'), `---\nkind: hollerith_card\ntitle: "qid 42"\nqid: 42\ntags: [hollerith-card, qid-42]\nhex_connector: ${connector}\nconnector_pearl: "${pearl}"\ncard_text_sha256: ${sha(body)}\nmesh_share: true\nleak_scan: clean_strict\nsource_status: sourced\nsource_kind: url\n---\n${body}`);
    const ref = T.cardRef({ card_id: 'qid42', content_sha256: sha(body), pearl });
    expect(ref.card_key).toBe(connector);
    T.sealOrigin(pubTags, { card_ref: ref, minted_by: A.peer_id, baseline: BASE }, A);
    T.appendUse(pubTags, connector, { model_spared: 'claude-fable-5-1', actual: { model_calls: 0 }, licensee_id: 'publisher-own-org' }, A);
    const frameSigner = (k: typeof kA) => (seed: string, p: Record<string, unknown>) => signFrame(encodeFrame(seed, 'broadcast', { ...p, public_key_hex: k.public_key_hex }), k.private_key_hex);
    const ctx: LibraryRouteContext = { siloDir: silo, selfPeerId: A.peer_id, resolveSenderKey: (id) => (id === B.peer_id ? { key: kB.public_key_hex, trust: 'enrolled' } : null), allowSelfDeclaredKey: false, signPayload: frameSigner(kA), tagsDir: pubTags };
    const server = http.createServer(async (req, res) => {
      const r = await handleLibraryRoute(req.url ?? '', req.method ?? 'GET', () => new Promise((ok) => { const c: Buffer[] = []; req.on('data', (x) => c.push(x)); req.on('end', () => ok(Buffer.concat(c).toString('utf8'))); }), ctx);
      res.writeHead(r ? r.status : 404, { 'content-type': 'application/json' }); res.end(JSON.stringify(r ? r.body : {}));
    });
    await new Promise<void>((ok) => server.listen(0, '127.0.0.1', () => ok()));
    try {
      const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
      const receipt = await pullLibraryFromPeer({ peerBaseUrl: url, senderPeerId: B.peer_id, signPayload: frameSigner(kB), query: { connectors: [connector] }, destDir: dest, expectedPublisherKeyHex: kA.public_key_hex, tags: { tagsDir: reqTags, signer: B } });
      expect(receipt.written).toBe(1); expect(receipt.trailHops).toBe(1);
      const v = T.verifyLedger(reqTags, connector);
      expect(v.ok).toBe(true);
      expect(v.origin?.signer_peer_id).toBe(A.peer_id);
      expect(v.trail[0]).toMatchObject({ from_node: A.peer_id, to_node: B.peer_id, signer_peer_id: B.peer_id });
      expect(existsSync(T.ledgerPaths(reqTags, connector).uses)).toBe(false); // publisher's use rows stay home
      const again = await pullLibraryFromPeer({ peerBaseUrl: url, senderPeerId: B.peer_id, signPayload: frameSigner(kB), query: { connectors: [connector] }, destDir: dest, expectedPublisherKeyHex: kA.public_key_hex, tags: { tagsDir: reqTags, signer: B } });
      expect(again.alreadyPresent).toBe(1);
      expect(T.verifyLedger(reqTags, connector).trail).toHaveLength(2);
      // a tampered served chain is refused for the tags; the card copy itself is unaffected
      const pp = T.ledgerPaths(pubTags, connector).provenance;
      writeFileSync(pp, readFileSync(pp, 'utf8').replace('"usd":0.11', '"usd":0.5'));
      const bad = await pullLibraryFromPeer({ peerBaseUrl: url, senderPeerId: B.peer_id, signPayload: frameSigner(kB), query: { connectors: [connector] }, destDir: dest, expectedPublisherKeyHex: kA.public_key_hex, tags: { tagsDir: tmp(), signer: B } });
      expect(bad.alreadyPresent).toBe(1); expect(bad.trailHops).toBe(0);
      expect(bad.files[0].trail?.action).toBe('refused');
    } finally { server.close(); }
  });
});
