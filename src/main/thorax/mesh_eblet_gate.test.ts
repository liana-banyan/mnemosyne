// mesh_eblet_gate.test.ts -- D-BP223-BM0-X009-027-MESHWIRE proof. Two EPHEMERAL Ed25519 node
// identities (generateKeyPairSync, same pattern signed_assertion.test.ts already uses for test
// fixtures) -- never the real persisted per-machine keypair at <userData>/thorax_ed25519.json,
// which this file never opens, reads, or references.
//
// Proves the allow path AND the refusal path, per the dispatch's own instruction that a test
// proving only the allow path is half a test:
//   1. node-alpha signs a request for an eblet it IS scoped for -> node-beta grants it.
//   2. node-alpha signs a request for an eblet it is NOT scoped for -> node-beta refuses it.
//   3. an unenrolled peer's signed request -> node-beta refuses it (peer authentication gap).
//   4. a tampered request (payload changed after signing) -> node-beta refuses it.
// Every grant and every refusal leaves a JSONL audit record; the test reads that file back and
// checks its content, it does not just trust the return value.

import { describe, test, expect, beforeEach } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  signEbletRequest,
  verifyAndServeEbletRequest,
  EBLET_READ_SCOPE,
  type PeerEnrollment,
} from './mesh_eblet_gate';

function freshKeypair() {
  const kp = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });
  return {
    publicKeyHex: (kp.publicKey as Buffer).toString('hex'),
    privateKeyHex: (kp.privateKey as Buffer).toString('hex'),
  };
}

describe('D-BP223-BM0-X009-027-MESHWIRE -- mesh_eblet_gate', () => {
  let workdir: string;
  let auditPath: string;
  let alpha: ReturnType<typeof freshKeypair>;
  let beta: ReturnType<typeof freshKeypair>;
  let stranger: ReturnType<typeof freshKeypair>;
  let enrollments: Map<string, PeerEnrollment>;
  let store: Record<string, unknown>;

  beforeEach(() => {
    workdir = mkdtempSync(join(tmpdir(), 'meshwire-test-'));
    auditPath = join(workdir, 'node-beta-audit.jsonl');
    alpha = freshKeypair();
    beta = freshKeypair();
    stranger = freshKeypair();

    // node-beta's enrollment registry: only "node-alpha" is enrolled, and it is scoped to read
    // exactly "eblet:public-hello" and anything under the "eblet:shared-*" prefix. It is NOT
    // scoped for "eblet:private-secret".
    enrollments = new Map<string, PeerEnrollment>([
      ['node-alpha', {
        peer_id: 'node-alpha',
        public_key_hex: alpha.publicKeyHex,
        allowed_eblets: ['eblet:public-hello', 'eblet:shared-*'],
      }],
    ]);

    store = {
      'eblet:public-hello': { text: 'hello from node-beta' },
      'eblet:shared-notes': { text: 'shared notes payload' },
      'eblet:private-secret': { text: 'THIS MUST NEVER LEAVE node-beta' },
    };
  });

  function serve(assertion: ReturnType<typeof signEbletRequest>) {
    return verifyAndServeEbletRequest({
      assertion,
      servingNodeId: 'node-beta',
      resolvePeer: (peerId) => enrollments.get(peerId) ?? null,
      loadEblet: (ebletId) => store[ebletId] ?? null,
      auditLogPath: auditPath,
    });
  }

  test('ALLOW PATH: enrolled peer, in-scope eblet -> granted and payload returned', () => {
    const assertion = signEbletRequest({
      peerId: 'node-alpha',
      ebletId: 'eblet:public-hello',
      privateKeyHex: alpha.privateKeyHex,
      auditLogPath: join(workdir, 'node-alpha-audit.jsonl'),
    });
    expect(assertion.scope).toBe(EBLET_READ_SCOPE);

    const result = serve(assertion);
    expect(result.granted).toBe(true);
    expect(result.payload).toEqual({ text: 'hello from node-beta' });
    expect(result.reason).toMatch(/verified sender "node-alpha"/);

    // prefix-scoped eblet also grants
    const assertion2 = signEbletRequest({
      peerId: 'node-alpha', ebletId: 'eblet:shared-notes', privateKeyHex: alpha.privateKeyHex,
    });
    expect(serve(assertion2).granted).toBe(true);
  });

  test('REFUSAL PATH (out of scope): enrolled peer, eblet NOT in its allow-list -> refused, payload withheld', () => {
    const assertion = signEbletRequest({
      peerId: 'node-alpha',
      ebletId: 'eblet:private-secret',
      privateKeyHex: alpha.privateKeyHex,
    });
    const result = serve(assertion);
    expect(result.granted).toBe(false);
    expect(result.payload).toBeUndefined();
    expect(result.reason).toMatch(/not authorized to read eblet "eblet:private-secret"/);
  });

  test('REFUSAL PATH (peer authentication): unenrolled signer -> refused before scope is even checked', () => {
    const assertion = signEbletRequest({
      peerId: 'node-gamma-never-enrolled',
      ebletId: 'eblet:public-hello',
      privateKeyHex: stranger.privateKeyHex,
    });
    const result = serve(assertion);
    expect(result.granted).toBe(false);
    expect(result.reason).toMatch(/is not enrolled with node "node-beta"/);
  });

  test('REFUSAL PATH (forged sender): stranger claims to BE node-alpha but signs with its own key -> signature fails', () => {
    // stranger issues a request whose `issuer` field claims 'node-alpha' but is signed with the
    // stranger's own private key, not node-alpha's. verifyAssertion checks the signature against
    // node-alpha's ENROLLED public key, so this must fail even though the peer_id string matches.
    const assertion = signEbletRequest({
      peerId: 'node-alpha', // forged claim
      ebletId: 'eblet:public-hello',
      privateKeyHex: stranger.privateKeyHex, // wrong key
    });
    const result = serve(assertion);
    expect(result.granted).toBe(false);
    expect(result.reason).toMatch(/signature\/scope\/expiry check failed/);
  });

  test('REFUSAL PATH (tamper): eblet id swapped after signing -> signature no longer verifies', () => {
    const assertion = signEbletRequest({
      peerId: 'node-alpha', ebletId: 'eblet:public-hello', privateKeyHex: alpha.privateKeyHex,
    });
    const tampered = { ...assertion, subject: 'eblet:private-secret' };
    const result = serve(tampered);
    expect(result.granted).toBe(false);
    expect(result.reason).toMatch(/signature\/scope\/expiry check failed/);
  });

  test('AUDIT TRAIL: both a grant and a refusal leave a readable JSONL record on the serving node', () => {
    const ok = signEbletRequest({
      peerId: 'node-alpha', ebletId: 'eblet:public-hello', privateKeyHex: alpha.privateKeyHex,
    });
    serve(ok);
    const bad = signEbletRequest({
      peerId: 'node-alpha', ebletId: 'eblet:private-secret', privateKeyHex: alpha.privateKeyHex,
    });
    serve(bad);

    expect(existsSync(auditPath)).toBe(true);
    const lines = readFileSync(auditPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(lines.length).toBe(2);
    expect(lines[0].event).toBe('grant');
    expect(lines[0].eblet_id).toBe('eblet:public-hello');
    expect(lines[1].event).toBe('refuse');
    expect(lines[1].eblet_id).toBe('eblet:private-secret');
  });
});
