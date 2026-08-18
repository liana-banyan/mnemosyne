#!/usr/bin/env node
// trust_root_sign_manifest.mjs -- D-BP157-036/BISHOP/seg-offline-key-ceremony
//
// THE PER-RELEASE SIGNING TOOL. Run on the same offline machine as trust_root_keygen.mjs, once
// per release, using the private key that script produced. Produces a signature that
// verifyManifestEntrySignature() in src/main/auto_update_scheduler.ts accepts.
//
// CANONICAL STRING -- bound EXACTLY to auto_update_scheduler.ts's canonicalManifestEntryString()
// (read from source, not assumed):
//     `${entry.keyId ?? ''}:${entry.tier ?? 'latest'}:${entry.version}:${entry.url}:${entry.sha256}`
//
// SIGNATURE -- bound EXACTLY to thorax/sign_verify.ts's signFrame(), reimplemented here (not
// imported) because this script must run under plain Node on an air-gapped machine with no
// TypeScript toolchain available. signFrame() does:
//     privKey = createPrivateKey({ key: Buffer.from(privateKeyHex,'hex'), format:'der', type:'pkcs8' })
//     sig     = sign(null, Buffer.from(frameHex,'utf8'), privKey)          // raw Ed25519, no digest
//     return frameHex + sig.toString('hex')                               // 128 hex chars appended
// The entry's "signature" field therefore carries the FULL frame (canonical string + signature),
// not the bare signature -- this matches what verifyManifestEntrySignature() expects: it calls
// verifyFrame(entry.signature, publicKeyHex), which strips the last 128 hex chars back off and
// re-derives the canonical string to compare against. This script's own round-trip test
// (src/main/trust_root_ceremony.roundtrip.test.ts) proves the two implementations agree by
// signing with THIS file's logic and verifying with the app's REAL, imported
// verifyManifestEntrySignature() -- not a reimplementation of the verifier, the real one.
//
// Plain Node only. No dependency outside node:crypto, node:fs, node:path. NO NETWORK CALL OF
// ANY KIND anywhere in this file -- nothing here fetches, posts, or opens a socket.
//
// Usage (single entry, prints signed entry JSON):
//   node scripts/trust_root_sign_manifest.mjs \
//     --key <path-to-private-key.json> \
//     --version 0.9.26 --url https://mnemosynec.org/dl/MnemosyneC-Setup-0.9.26.exe \
//     --sha256 <64-hex-char-sha256> [--tier latest] [--keyid lb-root-2026-01] \
//     [--out <path-to-write-signed-entry.json>]
//
// Usage (update an existing version_trust.json manifest in place):
//   node scripts/trust_root_sign_manifest.mjs \
//     --key <path-to-private-key.json> \
//     --version 0.9.26 --url https://... --sha256 <hex> \
//     --manifest <path-to-version_trust.json> --out <path-to-write-signed-manifest.json>

import { createPrivateKey, sign } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

function fail(reason) {
  process.stderr.write(`\n[trust_root_sign_manifest] ERROR: ${reason}\n\n`);
  process.exit(1);
}

function usageAndExit() {
  process.stderr.write(
    'Usage: node scripts/trust_root_sign_manifest.mjs --key <private-key.json> ' +
    '--version <v> --url <url> --sha256 <hex> [--tier latest] [--keyid <id>] ' +
    '[--manifest <version_trust.json>] [--out <path>]\n',
  );
  process.exit(1);
}

// ─── Parse argv (no dependency -- hand-rolled, flags only) ───────────────────
const args = process.argv.slice(2);
const opts = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (!a.startsWith('--')) fail(`unrecognized argument '${a}'`);
  const key = a.slice(2);
  const val = args[i + 1];
  if (val === undefined || val.startsWith('--')) fail(`flag --${key} needs a value`);
  opts[key] = val;
  i++;
}
if (!opts.key) usageAndExit();

// ─── Load the private key ─────────────────────────────────────────────────────
// Accepts the JSON format trust_root_keygen.mjs writes ({ keyId, privateKeyHex, ... }), and
// falls back to treating the file's trimmed contents as a bare hex string if it is not valid
// JSON, so a key produced by any other tool in the same PKCS8-DER-hex encoding still works.
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
  // Not JSON -- treat the whole trimmed file as a bare hex string.
  privateKeyHex = keyFileRaw;
}
if (!/^[0-9a-fA-F]+$/.test(privateKeyHex)) {
  fail(`private key material is not a hex string (from ${keyPath})`);
}

const keyId = opts.keyid ?? keyFileKeyId;
if (!keyId) fail('no --keyid given and the key file has no "keyId" field -- pass --keyid explicitly');

if (!opts.version) fail('--version is required');
if (!opts.url) fail('--url is required');
if (!opts.sha256) fail('--sha256 is required');
if (!/^[0-9a-fA-F]{64}$/.test(opts.sha256)) {
  fail(`--sha256 must be 64 hex characters (got ${opts.sha256.length} chars)`);
}
const tier = opts.tier ?? 'latest';

// ─── Canonical string + sign -- byte-for-byte match to the app's verifier ───
function canonicalManifestEntryString({ keyId, tier, version, url, sha256 }) {
  return `${keyId ?? ''}:${tier ?? 'latest'}:${version}:${url}:${sha256}`;
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

const entryFields = { keyId, tier, version: opts.version, url: opts.url, sha256: opts.sha256 };
const canonical = canonicalManifestEntryString(entryFields);
const signature = signFrame(canonical, privateKeyHex);

const signedEntry = {
  version: opts.version,
  url: opts.url,
  sha256: opts.sha256,
  tier,
  keyId,
  signature,
};

// ─── Write output: a bare entry, or merged into an existing version_trust.json ───────────────
function loadManifest(manifestPath) {
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.versions)) {
    fail(`${manifestPath} does not look like a version_trust.json (no "versions" array)`);
  }
  return parsed;
}

let outputObject = signedEntry;
if (opts.manifest) {
  const manifestPath = path.resolve(process.cwd(), opts.manifest);
  if (!fs.existsSync(manifestPath)) fail(`manifest not found: ${manifestPath}`);
  const manifest = loadManifest(manifestPath);
  const idx = manifest.versions.findIndex(
    (v) => v.version === signedEntry.version && (v.tier ?? 'latest') === signedEntry.tier,
  );
  if (idx >= 0) {
    manifest.versions[idx] = signedEntry;
  } else {
    manifest.versions.push(signedEntry);
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
  `keyId:  ${keyId}\n` +
  `tier:   ${tier}\n` +
  `version: ${opts.version}\n` +
  'No network call was made. Nothing was transmitted.\n',
);
