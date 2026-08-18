#!/usr/bin/env node
// trust_root_sign_rotation.mjs -- D-BP157-052/BISHOP/seg-build-root-rotation-retry
//
// THE ROOT-ROTATION ANNOUNCEMENT SIGNING TOOL. Mirrors scripts/trust_root_sign_manifest.mjs
// exactly in shape and safety posture -- run on the same machine/ceremony as that script, using
// the private key trust_root_keygen.mjs produced, to sign a root-rotation announcement instead
// of a version-manifest entry.
//
// THE PROBLEM this announcement solves: LB_PUBLIC_KEYS in src/main/auto_update_scheduler.ts is
// COMPILED APP CODE. A client older than the release that introduces a new keyId fails closed on
// "unknown keyId" and never sees another signed update. A root-rotation announcement, carried on
// the SAME already-polled version_trust.json (its top-level "rootRotations" array), lets an
// ALREADY-TRUSTED key introduce a NEW trusted key (or revoke a compromised overlay-introduced
// one) without a recompile.
//
// CANONICAL STRING -- bound EXACTLY to auto_update_scheduler.ts's canonicalRotationString()
// (read from source, not assumed):
//     addPart    = add.map(k => `${k.keyId}:${k.algorithm ?? 'ed25519'}:${k.publicKeyHex}`).join(',')
//     revokePart = revoke.join(',')
//     canonical  = `${sequence}:${signedBy}:add=[${addPart}]:revoke=[${revokePart}]`
//
// SIGNATURE -- bound EXACTLY to thorax/sign_verify.ts's signFrame(), reimplemented here (not
// imported), same reasoning trust_root_sign_manifest.mjs already documents: this script must run
// under plain Node with no TypeScript toolchain, possibly air-gapped. signFrame() does:
//     privKey = createPrivateKey({ key: Buffer.from(privateKeyHex,'hex'), format:'der', type:'pkcs8' })
//     sig     = sign(null, Buffer.from(frameHex,'utf8'), privKey)          // raw Ed25519, no digest
//     return frameHex + sig.toString('hex')                               // 128 hex chars appended
// The announcement's "signature" field carries the FULL frame (canonical string + signature), not
// the bare signature -- this matches verifyRotationAnnouncement()'s expectation: it calls
// verifyFrame(announcement.signature, signerPublicKeyHex), which strips the last 128 hex chars
// back off and re-derives the canonical string to compare against.
//
// Plain Node only. No dependency outside node:crypto, node:fs, node:path. NO NETWORK CALL OF ANY
// KIND anywhere in this file -- nothing here fetches, posts, or opens a socket.
//
// SECURITY NOTE, read before using: the announcement's `signedBy` keyId MUST already be trusted
// by the client (present in its compiled LB_PUBLIC_KEYS, or a previously-accepted overlay key) --
// this script does not and cannot check that; it only signs what it is told to sign. Signing an
// announcement with a key the fleet does not yet trust produces a signature that
// verifyRotationAnnouncement() will correctly refuse (NEVER TOFU).
//
// Usage (single announcement, prints signed JSON):
//   node scripts/trust_root_sign_rotation.mjs \
//     --key <path-to-signer-private-key.json> \
//     --sequence 2 --signedby lb-root-2026-01 \
//     --add lb-root-2026-07:<64-byte-DER-SPKI-hex>:ed25519 \
//     [--revoke <keyId>] [--out <path-to-write-signed-announcement.json>]
//
// Usage (append into an existing version_trust.json's "rootRotations" array):
//   node scripts/trust_root_sign_rotation.mjs \
//     --key <path> --sequence 2 --signedby lb-root-2026-01 --add <keyId>:<pubHex> \
//     --manifest <path-to-version_trust.json> --out <path-to-write-signed-manifest.json>

import { createPrivateKey, sign } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

function fail(reason) {
  process.stderr.write(`\n[trust_root_sign_rotation] ERROR: ${reason}\n\n`);
  process.exit(1);
}

function usageAndExit() {
  process.stderr.write(
    'Usage: node scripts/trust_root_sign_rotation.mjs --key <signer-private-key.json> ' +
    '--sequence <n> --signedby <keyId> [--add <keyId>:<publicKeyHex>[:algorithm]]... ' +
    '[--revoke <keyId>]... [--manifest <version_trust.json>] [--out <path>]\n',
  );
  process.exit(1);
}

// ─── Parse argv (no dependency -- hand-rolled, flags only, --add/--revoke repeatable) ─────────
const args = process.argv.slice(2);
const opts = {};
const addEntries = [];
const revokeEntries = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (!a.startsWith('--')) fail(`unrecognized argument '${a}'`);
  const key = a.slice(2);
  const val = args[i + 1];
  if (val === undefined || val.startsWith('--')) fail(`flag --${key} needs a value`);
  if (key === 'add') {
    addEntries.push(val);
  } else if (key === 'revoke') {
    revokeEntries.push(val);
  } else {
    opts[key] = val;
  }
  i++;
}
if (!opts.key) usageAndExit();

// ─── Load the signer's private key ────────────────────────────────────────────
// Same JSON-or-bare-hex acceptance as trust_root_sign_manifest.mjs -- accepts the format
// trust_root_keygen.mjs writes ({ keyId, privateKeyHex, ... }), or a bare hex string.
const keyPath = path.resolve(process.cwd(), opts.key);
if (!fs.existsSync(keyPath)) fail(`private key file not found: ${keyPath}`);
const keyFileRaw = fs.readFileSync(keyPath, 'utf8').trim();
let privateKeyHex;
let keyFileKeyId;
try {
  const parsed = JSON.parse(keyFileRaw);
  if (typeof parsed.privateKeyHex !== 'string' || parsed.privateKeyHex.length === 0) {
    fail(`key file ${keyPath} is JSON but has no non-empty "privateKeyHex" field`);
  }
  privateKeyHex = parsed.privateKeyHex;
  keyFileKeyId = typeof parsed.keyId === 'string' ? parsed.keyId : undefined;
} catch {
  privateKeyHex = keyFileRaw;
}
if (!/^[0-9a-fA-F]+$/.test(privateKeyHex)) {
  fail(`private key material is not a hex string (from ${keyPath})`);
}

const signedBy = opts.signedby ?? keyFileKeyId;
if (!signedBy) fail('no --signedby given and the key file has no "keyId" field -- pass --signedby explicitly');

if (!opts.sequence) fail('--sequence is required');
const sequence = Number(opts.sequence);
if (!Number.isFinite(sequence) || sequence <= 0 || !Number.isInteger(sequence)) {
  fail(`--sequence must be a positive integer (got '${opts.sequence}')`);
}

if (addEntries.length === 0 && revokeEntries.length === 0) {
  fail('at least one --add or --revoke is required -- an announcement that does nothing is refused');
}

// ─── Parse --add entries: keyId:publicKeyHex[:algorithm] ─────────────────────
const add = addEntries.map((raw) => {
  const parts = raw.split(':');
  if (parts.length < 2) fail(`--add entry '${raw}' must be keyId:publicKeyHex[:algorithm]`);
  const [keyId, publicKeyHex, algorithm = 'ed25519'] = parts;
  if (!keyId) fail(`--add entry '${raw}' has an empty keyId`);
  if (!/^[0-9a-fA-F]+$/.test(publicKeyHex)) fail(`--add entry '${raw}' publicKeyHex is not hex`);
  if (algorithm !== 'ed25519') fail(`--add entry '${raw}' uses unsupported algorithm '${algorithm}' (only ed25519 is supported)`);
  return { keyId, publicKeyHex, algorithm };
});
const revoke = revokeEntries.slice();

// ─── Canonical string + sign -- byte-for-byte match to canonicalRotationString() ─────────────
function canonicalRotationString({ sequence, add, revoke, signedBy }) {
  const addPart = (add ?? []).map((k) => `${k.keyId}:${k.algorithm ?? 'ed25519'}:${k.publicKeyHex}`).join(',');
  const revokePart = (revoke ?? []).slice().join(',');
  return `${sequence}:${signedBy}:add=[${addPart}]:revoke=[${revokePart}]`;
}

function signFrame(frameHex, privateKeyHexArg) {
  const privKey = createPrivateKey({
    key: Buffer.from(privateKeyHexArg, 'hex'),
    format: 'der',
    type: 'pkcs8',
  });
  const frameBuffer = Buffer.from(frameHex, 'utf8');
  const sigBuffer = sign(null, frameBuffer, privKey);
  return frameHex + sigBuffer.toString('hex');
}

const announcementFields = { sequence, add, revoke, signedBy };
const canonical = canonicalRotationString(announcementFields);
const signature = signFrame(canonical, privateKeyHex);

const signedAnnouncement = {
  sequence,
  ...(add.length > 0 ? { add } : {}),
  ...(revoke.length > 0 ? { revoke } : {}),
  signedBy,
  signature,
};

// ─── Write output: a bare announcement, or appended into an existing version_trust.json ──────
function loadManifest(manifestPath) {
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.versions)) {
    fail(`${manifestPath} does not look like a version_trust.json (no "versions" array)`);
  }
  return parsed;
}

let outputObject = signedAnnouncement;
if (opts.manifest) {
  const manifestPath = path.resolve(process.cwd(), opts.manifest);
  if (!fs.existsSync(manifestPath)) fail(`manifest not found: ${manifestPath}`);
  const manifest = loadManifest(manifestPath);
  if (!Array.isArray(manifest.rootRotations)) manifest.rootRotations = [];
  const idx = manifest.rootRotations.findIndex((r) => r.sequence === signedAnnouncement.sequence);
  if (idx >= 0) {
    manifest.rootRotations[idx] = signedAnnouncement;
  } else {
    manifest.rootRotations.push(signedAnnouncement);
  }
  outputObject = manifest;
}

const outText = JSON.stringify(outputObject, null, 2) + '\n';
if (opts.out) {
  const outPath = path.resolve(process.cwd(), opts.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, outText, 'utf8');
  process.stdout.write(`Signed. Wrote: ${outPath}\n`);
} else {
  process.stdout.write(outText);
}

process.stdout.write(
  `\ncanonical string signed: ${canonical}\n` +
  `sequence: ${sequence}\n` +
  `signedBy: ${signedBy}\n` +
  `add:      ${add.map((k) => k.keyId).join(', ') || '(none)'}\n` +
  `revoke:   ${revoke.join(', ') || '(none)'}\n` +
  'No network call was made. Nothing was transmitted.\n',
);
