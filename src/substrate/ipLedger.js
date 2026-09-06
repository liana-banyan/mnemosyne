"use strict";
/**
 * ipLedger.ts -- Stamp-Certified IP Ledger primitive
 * BP089 Marathon Session 2 -- §16 ARCHITECTURAL HARD CANON BP087
 *
 * Implements Ed25519 stamping for cooperative IP provenance.
 * Local-first: stamps are created locally and replicated to Supabase ip_ledger table.
 *
 * Crypto: node:crypto native Ed25519 (Node 20+ -- no @noble/ed25519 in package.json).
 * DB pattern: Supabase REST API via fetch (matches wrasse_quartermaster.ts pattern).
 *
 * BLOOD: private keys NEVER logged, NEVER echoed, NEVER stored plaintext.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPayload = hashPayload;
exports.signPayloadHash = signPayloadHash;
exports.stampEntry = stampEntry;
exports.persistStamp = persistStamp;
exports.stampAndPersist = stampAndPersist;
exports.generateEd25519KeyPair = generateEd25519KeyPair;
const node_crypto_1 = require("node:crypto");
const node_crypto_2 = require("node:crypto");
// ─── Hashing ─────────────────────────────────────────────────────────────────
function hashPayload(payload) {
    const canonical = JSON.stringify(payload, Object.keys(payload).sort());
    return (0, node_crypto_1.createHash)('sha256').update(canonical, 'utf8').digest('hex');
}
// ─── Ed25519 Signing ──────────────────────────────────────────────────────────
/**
 * Sign a payload hash with an Ed25519 private key.
 * privateKeyPem: PEM-encoded PKCS#8 private key from generateKeyPairSync.
 * Returns hex-encoded signature.
 * BLOOD: never log or echo privateKeyPem.
 */
function signPayloadHash(payloadHash, privateKeyPem) {
    const sig = (0, node_crypto_1.sign)(null, Buffer.from(payloadHash, 'hex'), privateKeyPem);
    return sig.toString('hex');
}
// ─── Core: stampEntry ─────────────────────────────────────────────────────────
/**
 * Create a stamp entry record (local, not yet persisted).
 * ringBearerId: the peer/member creating this stamp.
 * entryType: semantic type (e.g. 'keypair_generated', 'innovation_claim', 'contribution').
 * payloadJson: arbitrary structured data being stamped.
 * privateKeyPem: optional -- if provided, signs the payload hash.
 * stampSeq: caller must provide a monotonically-increasing sequence number.
 */
function stampEntry(params) {
    const { ringBearerId, entryType, payloadJson, privateKeyPem, stampSeq } = params;
    const payloadHash = hashPayload(payloadJson);
    const ed25519_sig = privateKeyPem
        ? signPayloadHash(payloadHash, privateKeyPem)
        : null;
    return {
        id: (0, node_crypto_2.randomUUID)(),
        ring_bearer_id: ringBearerId,
        entry_type: entryType,
        payload_hash: payloadHash,
        payload_json: payloadJson,
        ed25519_sig,
        stamp_seq: stampSeq,
        stamped_at: new Date().toISOString(),
        merkle_node: null,
        replicated_at: null,
    };
}
// ─── Core: persistStamp ──────────────────────────────────────────────────────
/**
 * Persist a stamp entry to the Supabase ip_ledger table via REST API.
 * Uses fetch pattern consistent with wrasse_quartermaster.ts.
 *
 * TODO: If ip_ledger table schema conflict (old vs new §16 schema) is not yet resolved
 * by Bishop, this will fail with a column mismatch. Bishop must apply I12 migration
 * and rename ip_ledger_legacy first.
 */
async function persistStamp(entry, config) {
    const { supabaseUrl, anonKey } = config;
    try {
        const res = await fetch(`${supabaseUrl}/rest/v1/ip_ledger`, {
            method: 'POST',
            headers: {
                'apikey': anonKey,
                'Authorization': `Bearer ${anonKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation',
            },
            body: JSON.stringify(entry),
        });
        if (!res.ok) {
            const body = await res.text();
            return {
                entry,
                persisted: false,
                error: `HTTP ${res.status}: ${body}`,
            };
        }
        return { entry, persisted: true };
    }
    catch (err) {
        return {
            entry,
            persisted: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
// ─── Convenience: stampAndPersist ────────────────────────────────────────────
async function stampAndPersist(params, config) {
    const entry = stampEntry(params);
    return persistStamp(entry, config);
}
// ─── Key generation helper (used by peerKeyGen.ts) ──────────────────────────
/**
 * Generate a fresh Ed25519 key pair.
 * Returns publicKeyHex (DER SubjectPublicKeyInfo) and privateKeyPem (PKCS#8).
 * BLOOD: caller must encrypt privateKeyPem before any storage.
 */
function generateEd25519KeyPair() {
    const { publicKey, privateKey } = (0, node_crypto_1.generateKeyPairSync)('ed25519', {
        publicKeyEncoding: { type: 'spki', format: 'der' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    return {
        publicKeyHex: publicKey.toString('hex'),
        privateKeyPem: privateKey,
    };
}
//# sourceMappingURL=ipLedger.js.map