#!/usr/bin/env node
// trust_root_keygen.mjs -- D-BP157-036/BISHOP/seg-offline-key-ceremony
//
// THE OFFLINE CEREMONY TOOL. FOUNDER RULING FD-BP157-13, verbatim: "Generated offline, kept
// off every networked machine, used to sign manifests by hand. Strictly stronger -- a CI
// compromise cannot forge a manifest -- at the cost of a manual step per release."
//
// This script generates ONE Ed25519 "LB Update Root" keypair using node:crypto -- the exact
// same DER SPKI (public) / PKCS8 (private) hex encoding already used everywhere else in this
// codebase (ed25519_keypair.ts's getOrCreateKeypair(), thorax/sign_verify.ts's signFrame() /
// verifyFrame(), and auto_update_scheduler.ts's LB_PUBLIC_KEYS registry). No new key format
// is invented.
//
// THE FOUNDER RUNS THIS HIMSELF, ON A MACHINE THAT IS OFFLINE, NOT THIS DISPATCH. This script
// was written by a SEG worker under an absolute constraint: it must never generate a
// production keypair itself and never print, log, or write the private key anywhere but the
// one path the operator names. It has no test-mode shortcut that would let an agent silently
// run the real ceremony -- every invocation writes a real, distinct keypair to disk.
//
// Plain Node only. No dependency outside the standard library (node:crypto, node:fs,
// node:path, node:os, node:child_process). No network call anywhere in this file -- if that
// ever stops being true, this script has been tampered with; it is meant to run on an
// air-gapped machine where a network call could not succeed anyway.
//
// Usage:
//   node scripts/trust_root_keygen.mjs <output-path-for-private-key.json> [--keyid <keyId>] [--force]
//
// Example:
//   node scripts/trust_root_keygen.mjs D:\offline-keys\lb-root-2026-01.private.json --keyid lb-root-2026-01
//
// Output:
//   <output-path>                  -- PRIVATE key material. JSON. Never printed to stdout.
//   <output-path>.pubkey.txt       -- PUBLIC key + keyId, plain text. Safe to copy anywhere.
//   stdout                          -- public key, suggested keyId, permission report, warnings.

import { generateKeyPairSync } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

function fail(reason, detail) {
  process.stderr.write(`\n[trust_root_keygen] REFUSED: ${reason}\n`);
  if (detail) process.stderr.write(`  ${detail}\n`);
  process.stderr.write('\nNo key was generated. No file was written.\n\n');
  process.exit(1);
}

function usageAndExit() {
  process.stderr.write(
    'Usage: node scripts/trust_root_keygen.mjs <output-path-for-private-key.json> [--keyid <keyId>] [--force]\n' +
    'Run this ONLY on a machine that is offline and will stay offline.\n',
  );
  process.exit(1);
}

// ─── Parse argv ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args.length === 0 || args[0].startsWith('-')) usageAndExit();

const outArg = args[0];
let keyIdArg = null;
let force = false;
for (let i = 1; i < args.length; i++) {
  if (args[i] === '--keyid') {
    keyIdArg = args[i + 1];
    i++;
  } else if (args[i] === '--force') {
    force = true;
  } else {
    fail(`unrecognized argument '${args[i]}'`);
  }
}

const outPath = path.resolve(process.cwd(), outArg);
const outDir = path.dirname(outPath);
const pubSidecarPath = `${outPath}.pubkey.txt`;

// ─── Refusal gate 1: inside THIS repository ───────────────────────────────────
// A private root key committed to git would be the BP155 credential leak repeated at a worse
// layer (SEG dispatch spec, verbatim). Refuse before generating anything.
const outPathLower = outPath.toLowerCase();
const repoRootLower = (REPO_ROOT + path.sep).toLowerCase();
if (outPathLower === REPO_ROOT.toLowerCase() || outPathLower.startsWith(repoRootLower)) {
  fail(
    `output path is inside this repository (${REPO_ROOT})`,
    `Requested: ${outPath}\nPick a path outside any git working tree entirely -- an offline\nmachine's local disk, not synced anywhere, not tracked by any repo.`,
  );
}

// ─── Refusal gate 2: inside ANY git working tree ──────────────────────────────
// Not just this repo -- any repo. Walk upward from the output directory looking for the
// nearest ancestor that git itself would recognize as a working tree root (a `.git` entry,
// file or directory -- a file is how git worktrees and submodules mark it).
function findGitRoot(startDir) {
  let dir = path.resolve(startDir);
  for (;;) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
const gitRoot = findGitRoot(fs.existsSync(outDir) ? outDir : path.dirname(outDir));
if (gitRoot) {
  fail(
    `output path is inside a git working tree (root: ${gitRoot})`,
    `Requested: ${outPath}\nA git working tree can be pushed, mirrored, or accidentally staged.\nPick a path with no .git ancestor anywhere above it.`,
  );
}

// ─── Refusal gate 3: inside a cloud-synced folder ─────────────────────────────
// Two layers: known sync-client environment variables (authoritative when present), plus a
// path-substring heuristic as a backup for sync folders this machine's env vars don't name
// (a different user profile, a mapped drive, a non-default install location).
function detectCloudSync(targetPath) {
  const reasons = [];
  const targetLower = targetPath.toLowerCase();

  const envCandidates = [
    ['OneDrive', process.env.OneDrive],
    ['OneDriveCommercial', process.env.OneDriveCommercial],
    ['OneDriveConsumer', process.env.OneDriveConsumer],
  ];
  for (const [name, val] of envCandidates) {
    if (val && targetLower.startsWith((val + path.sep).toLowerCase())) {
      reasons.push(`under %${name}% (${val})`);
    }
  }

  const nameHeuristics = [
    ['OneDrive', 'onedrive'],
    ['Dropbox', 'dropbox'],
    ['Google Drive', 'google drive'],
    ['Google Drive', 'googledrive'],
    ['iCloud Drive', 'icloud drive'],
    ['iCloud Drive', 'icloud~com~apple~clouddocs'],
    ['Box Sync', 'box sync'],
    ['Box Sync', 'boxsync'],
  ];
  for (const [label, needle] of nameHeuristics) {
    if (targetLower.includes(needle)) reasons.push(`path contains "${label}" folder name`);
  }

  return [...new Set(reasons)];
}
const cloudReasons = detectCloudSync(outPath);
if (cloudReasons.length > 0) {
  fail(
    'output path appears to be inside a cloud-synced folder',
    `Requested: ${outPath}\nDetected: ${cloudReasons.join('; ')}\n` +
    'A cloud-synced folder uploads its contents automatically -- that defeats "kept off every\n' +
    'networked machine" (FD-BP157-13) the moment sync runs. Pick a path on local, unsynced\n' +
    'storage (e.g. a USB drive kept with the offline machine, or that machine\'s local disk\n' +
    'outside any sync client\'s watched folders).',
  );
}

// ─── Refusal gate 4: do not silently clobber an existing key ─────────────────
if (fs.existsSync(outPath) && !force) {
  fail(
    `output path already exists: ${outPath}`,
    'Re-pass --force if you intend to overwrite it. Overwriting a root key without a deliberate\n' +
    'decision is how a previous rotation gets silently destroyed.',
  );
}

// ─── Generate. Only past this point does any key material exist. ────────────
const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'der' },
  privateKeyEncoding: { type: 'pkcs8', format: 'der' },
});
const publicKeyHex = publicKey.toString('hex');
const privateKeyHex = privateKey.toString('hex');

const now = new Date();
const suggestedKeyId =
  keyIdArg ??
  `lb-root-${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

// ─── Write private key file ───────────────────────────────────────────────────
fs.mkdirSync(outDir, { recursive: true });
const privateRecord = {
  keyId: suggestedKeyId,
  algorithm: 'ed25519',
  createdAtUtc: now.toISOString(),
  createdOnHost: os.hostname(),
  // Same DER-encoding convention as ed25519_keypair.ts and thorax/sign_verify.ts.
  privateKeyEncoding: 'pkcs8-der-hex',
  privateKeyHex,
};
fs.writeFileSync(outPath, JSON.stringify(privateRecord, null, 2) + '\n', { mode: 0o600 });

// ─── Restrict file permissions, report honestly what could / could not be enforced ──────────
const permReport = [];
try {
  fs.chmodSync(outPath, 0o600);
  permReport.push('fs.chmodSync(0o600) applied.');
} catch (e) {
  permReport.push(`fs.chmodSync(0o600) failed: ${e.message}`);
}

if (process.platform === 'win32') {
  permReport.push(
    'Windows note: Node\'s chmod on Windows only toggles the read-only attribute; it does NOT ' +
    'set an owner-only ACL the way POSIX 0600 does on Linux/macOS. Attempting a real ACL ' +
    'restriction via icacls now.',
  );
  const owner = process.env.USERNAME || os.userInfo().username;
  try {
    execFileSync('icacls', [outPath, '/inheritance:r', '/grant:r', `${owner}:F`], {
      stdio: 'pipe',
    });
    permReport.push(
      `icacls applied: inheritance removed, access restricted to '${owner}:F' only. ` +
      'This IS enforced -- verify with: icacls "' + outPath + '"',
    );
  } catch (e) {
    permReport.push(
      `icacls FAILED (${e.message.trim().split('\n')[0]}). File permissions were NOT ` +
      'restricted beyond the read-only attribute. Restrict access manually (icacls, or move ' +
      'the file to encrypted removable media) before leaving this file on any disk.',
    );
  }
} else {
  permReport.push(
    'POSIX platform: 0600 (owner read/write only) is enforced by the filesystem, not merely ' +
    'advisory.',
  );
}

// ─── Write public sidecar (safe to copy anywhere, contains no secret) ────────
const pubRecord =
  `LB Update Root public key -- SAFE TO COPY, CONTAINS NO SECRET MATERIAL\n` +
  `keyId: ${suggestedKeyId}\n` +
  `algorithm: ed25519\n` +
  `publicKeyEncoding: spki-der-hex\n` +
  `publicKeyHex: ${publicKeyHex}\n` +
  `generatedAtUtc: ${now.toISOString()}\n`;
fs.writeFileSync(pubSidecarPath, pubRecord, { mode: 0o644 });

// ─── Report. NEVER include privateKeyHex or privateRecord below this line. ──
process.stdout.write('\n=== LB Update Root key ceremony: complete ===\n\n');
process.stdout.write(`keyId (suggested):  ${suggestedKeyId}\n`);
process.stdout.write(`algorithm:           ed25519\n`);
process.stdout.write(`publicKeyHex:        ${publicKeyHex}\n\n`);
process.stdout.write(`Private key written to:  ${outPath}\n`);
process.stdout.write(`Public key sidecar:      ${pubSidecarPath}\n\n`);
process.stdout.write('Permission enforcement:\n');
for (const line of permReport) process.stdout.write(`  - ${line}\n`);
process.stdout.write(
  '\nWARNING -- read before doing anything else:\n' +
  '  1. This machine should be offline right now and should STAY offline for key generation.\n' +
  '     If it has a network connection, treat this key as suspect and start over on a machine\n' +
  '     that does not.\n' +
  '  2. The PRIVATE key file above must NEVER be copied to a networked machine, NEVER emailed,\n' +
  '     NEVER pasted into a chat, NEVER committed to any git repository, and NEVER placed in a\n' +
  '     cloud-synced folder. Copy only the .pubkey.txt sidecar (or the publicKeyHex printed\n' +
  '     above) back to a networked machine.\n' +
  '  3. This tool printed the public key exactly once, above. It will never print the private\n' +
  '     key -- there is no flag that does that.\n' +
  '  4. Back this file up now, offline (see docs/TRUST_ROOT_CEREMONY.md, "Backup and\n' +
  '     recovery"). A root key that exists on exactly one disk is one hardware failure away\n' +
  '     from never being able to ship a signed update again.\n\n',
);
