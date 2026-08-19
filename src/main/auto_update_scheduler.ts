// MnemosyneC — Automatic Update Scheduler
// M21 — Express permission, 6-hour polling, SHA-256 verify, audit JSONL
//
// Canon ref: canon_mic_stamped_user_approval_circle_of_influence_reciprocal_trust_bp086
//   - No silent install. Ever.
//   - Toggle ON = express perpetual consent for LB-signed v0.5.x → v0.5.y patch stream
//   - Major version jumps (v0.5.x → v1.0.x) re-prompt regardless of toggle state

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { app, ipcMain, BrowserWindow, Notification } from 'electron';
// BP134 Yoke #29 Part 2: node-to-node propagation -- detect a newer peer, pull + verify
// its installer against THIS SAME canonical manifest fetch's sha256 before ever trusting it.
import { findNewerPeers, pullAndVerifyFromPeers, seedLocalArtifactCache } from './keys_engines/mesh_update_propagation';
// D-BP157-035: the trust-root fix. Reuses the SAME Thorax Ed25519 verify primitive
// peer_artifact_client.ts:144-149 already uses for peer-signed hashes (no second crypto
// implementation, per SEG_RETURN_BP157_032_TRUST_ROOT_DESIGN.md Part C / Part 2.C).
import { verifyFrame } from './thorax/sign_verify';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AutoUpdateConfig {
  autoUpdates: boolean;                                                     // Toggle 1 — default false
  installTiming: 'launch' | 'quit' | 'scheduled' | 'approve';             // Toggle 2 — default 'quit'
  scheduledTime: string;                                                    // HH:MM 24hr — default '03:00'
  majorVersionRequiresApproval: boolean;                                    // Toggle 3 — default true
}

const DEFAULT_AUTO_UPDATE_CONFIG: AutoUpdateConfig = {
  autoUpdates: false,
  installTiming: 'quit',
  scheduledTime: '03:00',
  majorVersionRequiresApproval: true,
};

// ─── Paths ────────────────────────────────────────────────────────────────────

function getUserDataDir(): string {
  try {
    return app.getPath('userData');
  } catch {
    return path.join(os.homedir(), '.mnemosynec');
  }
}

function getAutoUpdateConfigPath(): string {
  return path.join(getUserDataDir(), 'auto-update-config.json');
}

const UPDATES_DIR = path.join(os.homedir(), '.mnemosynec', 'updates');
const UPDATE_HISTORY_PATH = path.join(os.homedir(), '.mnemosynec', 'update-history.jsonl');

// ─── Config persistence ───────────────────────────────────────────────────────

export function getAutoUpdateConfig(): AutoUpdateConfig {
  try {
    const configPath = getAutoUpdateConfigPath();
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      return { ...DEFAULT_AUTO_UPDATE_CONFIG, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('[auto-update] Failed to read config:', e);
  }
  return { ...DEFAULT_AUTO_UPDATE_CONFIG };
}

export function setAutoUpdateConfig(cfg: Partial<AutoUpdateConfig>): AutoUpdateConfig {
  const current = getAutoUpdateConfig();
  const updated = { ...current, ...cfg };
  try {
    const configPath = getAutoUpdateConfigPath();
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(updated, null, 2));
  } catch (e) {
    console.error('[auto-update] Failed to write config:', e);
  }
  return updated;
}

// ─── Update history (JSONL) ───────────────────────────────────────────────────

export function appendUpdateHistory(entry: Record<string, unknown>): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
  try {
    const dir = path.dirname(UPDATE_HISTORY_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(UPDATE_HISTORY_PATH, line + '\n');
  } catch (e) {
    console.error('[auto-update] Failed to write history:', e);
  }
}

export function getUpdateHistory(): Record<string, unknown>[] {
  try {
    if (!fs.existsSync(UPDATE_HISTORY_PATH)) return [];
    const lines = fs.readFileSync(UPDATE_HISTORY_PATH, 'utf-8').trim().split('\n').filter(Boolean);
    return lines.slice(-100).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

// ─── Semver helpers ───────────────────────────────────────────────────────────

function semverGt(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false;
  }
  return false;
}

function isMajorJump(current: string, latest: string): boolean {
  const [curMajor] = current.split('.').map(Number);
  const [latMajor] = latest.split('.').map(Number);
  return latMajor > curMajor;
}

// ─── Window registry for renderer notifications ───────────────────────────────

const registeredWindows: Set<BrowserWindow> = new Set();

export function registerWindowForAutoUpdate(win: BrowserWindow): void {
  registeredWindows.add(win);
  win.on('closed', () => registeredWindows.delete(win));
}

function broadcastToRenderer(channel: string, payload: unknown): void {
  for (const win of registeredWindows) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}

function showSystemNotification(title: string, body: string): void {
  if (Notification.isSupported()) {
    new Notification({ title, body, silent: false }).show();
  }
}

function notifyPatchReady(version: string): void {
  showSystemNotification('MnemosyneC update ready', `v${version} is downloaded and ready to install.`);
  broadcastToRenderer('auto-update-patch-ready', { version });
}

function notifyMajorAvailable(version: string): void {
  showSystemNotification(
    'MnemosyneC major update available',
    `v${version} requires your approval — open MnemosyneC to review and install.`,
  );
  broadcastToRenderer('auto-update-major-available', { version });
}

function notifyApproveRequired(readyPath: string): void {
  const version = path.basename(readyPath)
    .replace('MnemosyneC-Setup-', '')
    .replace('.exe.ready', '');
  showSystemNotification(
    'MnemosyneC update ready for approval',
    `v${version} downloaded — open MnemosyneC to approve installation.`,
  );
  broadcastToRenderer('auto-update-approve-required', { version, readyPath });
}

function notifySecurityEvent(msg: string): void {
  showSystemNotification('MnemosyneC — Update security event', msg);
  broadcastToRenderer('auto-update-security-event', { message: msg });
  console.error('[auto-update] SECURITY EVENT:', msg);
}

// ─── LB Update Root public key registry (D-BP157-035) ─────────────────────────
// SEG_RETURN_BP157_032_TRUST_ROOT_DESIGN.md Part 2.A/F, per FOUNDER RULING FD-BP157-12
// ("use the certificate and the IP ledger — with the chaining that we designed for eblet
// provenance"). This registry pins the LB Update Root Ed25519 public key(s) INSIDE the
// application itself, compiled from this source file into dist/main/auto_update_scheduler.js,
// which ships inside app.asar alongside the Authenticode-signed MnemosyneC.exe /
// MnemosyneC-Setup-*.exe (scripts/sign.cjs, Azure Trusted Signing).
//
// HONEST SCOPE (MEASURED: package.json's electron-builder `build` block, read in full this
// pass, sets `asar: true` but declares no `electronFuses` / asar-integrity configuration).
// This means the Authenticode signature on the .exe does NOT, by default, cryptographically
// bind the contents of app.asar (and therefore this constant) the way the design's Part A
// aspirationally describes. What this registry DOES protect: a version_trust.json entry
// cannot be trusted merely because it was served over HTTPS or because a peer offered it —
// it must carry a valid Ed25519 signature from a keyId listed here. What it does NOT protect
// (accepted residual risk, named explicitly in the design's Part G item 1, unchanged by this
// dispatch): an attacker who ALREADY has write access to the install directory can overwrite
// this compiled constant (and the rest of app.asar) without necessarily invalidating the
// Authenticode signature on the .exe wrapper — closing that gap needs OS-level ACLs / Windows
// Code Integrity (WDAC) or an electron-builder asar-integrity fuse, neither of which this
// dispatch adds. Nor does this protect against compromise of the Azure Trusted Signing
// account/CI secrets (a legitimately Microsoft-signed malicious binary), nor does it establish
// any trust on a machine's very first install — this is an UPDATE-time trust root only.
const PLACEHOLDER_KEY_SENTINEL = 'PLACEHOLDER_KEY_NOT_PROVISIONED_DO_NOT_TRUST';

interface RootKeyEntry {
  /** DER-encoded SPKI Ed25519 public key, lowercase hex — SAME encoding
   *  ed25519_keypair.ts's getOrCreateKeypair() and sign_verify.ts's verifyFrame() already use
   *  everywhere else in this codebase (no new key encoding invented). Or the sentinel above
   *  when the real key has not yet been provisioned. */
  publicKeyHex: string;
  algorithm: 'ed25519';
  status: 'active' | 'placeholder';
}

// keyId -> root key entry. Rotation (Part F): a compromised/retired keyId is simply removed
// (or left present but never re-issued) in the NEXT Authenticode-signed app release — old,
// already-published manifest entries signed under an old keyId remain verifiable as long as
// that keyId stays in this map, so a machine that is offline across a rotation does not brick;
// an unrecognized keyId is refused (fail closed), never silently accepted.
//
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// CORRECTED D-BP158-M0-009. THIS ENTRY IS REAL AND LIVE. IT IS NOT A PLACEHOLDER.
//
// The block that stood here said 'lb-root-2026-01' below is a PLACEHOLDER, NOT a real
// provisioned root key. That was true when written and became FALSE when the key was actually
// provisioned at BP157 and pasted in below. The prose was never updated, and it caused a real
// error: a BP158 SEG audit read this comment, reported the trust root as missing from the
// shipped registry, and that false finding was filed as an open work item and repeated to the
// Founder before anyone checked the value four lines down.
//
// MEASURED 2026-08-19: the publicKeyHex below is a genuine Ed25519 SPKI-DER key with status
// 'active', and it matches the provisioned root's public half at
// C:\Users\Administrator\.lb-root-keys\lb-root-2026-01.private.json.pubkey.txt byte for byte.
// A live end-to-end proof signed an order with the real root PRIVATE key and verified it with
// the COMPILED public key below: genuine order authorized; scope-widened, subject-swapped,
// unknown-issuer and expired orders all refused.
//
// The sentinel machinery is still real and still correct: verifyManifestEntrySignature() below
// refuses any entry whose key is PLACEHOLDER_KEY_NOT_PROVISIONED_DO_NOT_TRUST or whose status
// is not 'active', so the path fails closed. That guard simply does not apply to this entry.
//
// ACCEPTED RISK, unchanged: the private half lives on networked M0 per FD-BP157-14. See the
// per-entry note below, which is current.
//
// IF YOU ARE ABOUT TO REPORT THIS KEY AS MISSING: read the value, not this comment. That is
// the mistake this paragraph exists to stop you repeating.
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
const LB_PUBLIC_KEYS: Record<string, RootKeyEntry> = {
  'lb-root-2026-01': {
    // Provisioned 2026-08-18 (BP157, FD-BP157-13 as amended by the Founder's explicit
    // instruction to generate on M0). Private half lives OUTSIDE both repos at
    // C:\Users\Administrator\.lb-root-keys\ with an icacls owner-only ACL.
    // ACCEPTED RISK, PERMANENT POSTURE. Do not read this as a to-do.
    // FD-BP157-13 originally specified an offline ceremony. It was SUPERSEDED by the
    // Founder: "I'm never running it on an offline machine, bc there is no point in an
    // offline machine." There is therefore NO PENDING ROTATION to an offline-born root
    // and no one is waiting to perform one.
    // What remains true and is the accepted cost: this key lives on a networked machine,
    // so a compromise of M0 is equivalent to manifest forgery. The estate has leaked
    // credentials off a networked machine once before (BP155), so this is a lived risk
    // rather than a theoretical one.
    // The only upgrade path still open is a non-extractable HSM key (e.g. Azure Key
    // Vault, alongside the existing Trusted Signing identity), which would remove the
    // copy-the-file attack entirely at the cost of concentrating both the code-signing
    // identity and the manifest root in one tenancy. That is a Founder decision and has
    // NOT been taken. The keyId registry makes any such move a normal signed release.
    publicKeyHex: '302a300506032b65700321003b31e58e45f7373ed002793515ec112c1bb42a94d6abeef6bdb417f6705b77f6',
    algorithm: 'ed25519',
    status: 'active',
  },

  // ── D-BP158-M0-017: the Founder ATTESTATION key ──────────────────────────────────────────
  // Signs the receipts emitted by the `founder-code-verify` and `founder-break-glass` edge
  // functions. Those receipts are the proof that a live authenticator code, or an emailed
  // break-glass link, authorized a specific order.
  //
  // WHY IT IS A SEPARATE keyId FROM THE ROOT, and this is the point of the whole exercise:
  // the private half of THIS key was generated in the Founder's own browser and set as a
  // Supabase function secret. BISHOP HAS NEVER SEEN IT AND CANNOT REACH IT. As of
  // D-BP158-M0-016 the Management API token and the CLI login were both revoked (measured:
  // HTTP 401, and Unauthorized), so Bishop can no longer read, set, or overwrite function
  // secrets. Bishop therefore cannot manufacture an attestation, which is exactly the
  // property the root key alone could never provide, because the root key is a file on a
  // machine Bishop controls.
  //
  // Public half only, obviously: a public key VERIFIES a receipt and can never PRODUCE one.
  // Shipping it means M3, a member, or an auditor checks an attestation OFFLINE with no call
  // back to us. VALIDATED before it was pasted here: 88 hex chars, correct Ed25519 SPKI
  // prefix, 32 raw key bytes, and it imports as an ed25519 public key through the same
  // createPublicKey path the verifiers use.
  'lb-attest-2026-01': {
    publicKeyHex: '302a300506032b6570032100dc035f3d59f0be2899082b400fe2a1fbeb3bba669a4ce006a480d35ac88c8684',
    algorithm: 'ed25519',
    status: 'active',
  },
};

// ─── Download + SHA-256 + Ed25519 verify ─────────────────────────────────────

interface VersionEntry {
  version: string;
  url: string;
  sha256: string;
  signature?: string;
  /** Which LB_PUBLIC_KEYS entry this signature was produced with. Mandatory for a signature
   *  to be accepted — see verifyManifestEntrySignature(). */
  keyId?: string;
  /** Carried through from version_trust.json's per-entry tier field ('latest', etc.) and bound
   *  into the signed canonical string so a signed entry cannot be silently relabeled to a
   *  different tier without invalidating its signature. */
  tier?: string;
}

/**
 * Deterministic canonical string bound by the Ed25519 signature over a version_trust.json
 * entry. Mirrors the existing `${version}:${hash}` canonical-string pattern
 * peer_artifact_client.ts already uses for peer-signed hashes -- same shape, same reasoning:
 * a fixed, unambiguous field order so signer and verifier always hash identical bytes.
 * Exported so tests can construct valid signed fixtures without duplicating this format.
 */
export function canonicalManifestEntryString(entry: {
  keyId?: string;
  tier?: string;
  version: string;
  url: string;
  sha256: string;
}): string {
  return `${entry.keyId ?? ''}:${entry.tier ?? 'latest'}:${entry.version}:${entry.url}:${entry.sha256}`;
}

export interface ManifestSignatureCheck {
  ok: boolean;
  reason?: string;
}

/**
 * The hard, mandatory signature gate (Part C of the design). FAILS CLOSED on every path:
 * missing signature, missing keyId, unknown keyId, or the still-placeholder key are ALL
 * treated identically to a bad signature -- refuse, never warn-and-proceed.
 *
 * Reuses verifyFrame() from thorax/sign_verify.ts exactly as peer_artifact_client.ts:144-149
 * already does for peer-signed artifact hashes -- no new crypto primitive. entry.signature is
 * expected to be signFrame(canonicalManifestEntryString(entry), rootPrivateKeyHex): the
 * canonical string with a 128-hex-char Ed25519 signature appended, matching the exact
 * frameHex+signature wire shape sign_verify.ts already defines.
 */
export function verifyManifestEntrySignature(
  entry: {
    version?: string;
    url?: string;
    sha256?: string;
    signature?: string;
    keyId?: string;
    tier?: string;
  },
  // D-BP157-052: defaults to compiled LB_PUBLIC_KEYS UNION the local root-rotation overlay
  // (getEffectiveKeyRegistry(), defined further below in this file) instead of LB_PUBLIC_KEYS
  // alone -- this is what makes a rotation-introduced key immediately usable for verifying a
  // NEW version_trust.json entry, without a recompile. Overlay is additive only (Requirement
  // 4): a compiled keyId can never be shadowed. Callers that explicitly pass a keyRegistry
  // (every existing test in auto_update_scheduler.trust_root.test.ts does) are unaffected.
  keyRegistry: Record<string, RootKeyEntry> = getEffectiveKeyRegistry(),
): ManifestSignatureCheck {
  if (!entry.version || !entry.url || !entry.sha256) {
    return { ok: false, reason: 'incomplete manifest entry (missing version, url, or sha256)' };
  }
  if (!entry.signature || entry.signature.length === 0) {
    return { ok: false, reason: 'missing signature' };
  }
  if (!entry.keyId || entry.keyId.length === 0) {
    return { ok: false, reason: 'missing keyId' };
  }
  const keyEntry = keyRegistry[entry.keyId];
  if (!keyEntry) {
    return { ok: false, reason: `unknown keyId '${entry.keyId}'` };
  }
  if (keyEntry.status === 'placeholder' || keyEntry.publicKeyHex === PLACEHOLDER_KEY_SENTINEL) {
    return { ok: false, reason: `keyId '${entry.keyId}' is still the placeholder root key -- not provisioned for release` };
  }

  const canonical = canonicalManifestEntryString({
    keyId: entry.keyId,
    tier: entry.tier,
    version: entry.version,
    url: entry.url,
    sha256: entry.sha256,
  });
  try {
    const verified = verifyFrame(entry.signature, keyEntry.publicKeyHex);
    if (!verified.valid || verified.frameHex !== canonical) {
      return { ok: false, reason: 'signature verification failed (bad signature, tampered manifest entry, or wrong key)' };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: `signature verification error: ${e}` };
  }
}

// ─── Root-rotation overlay (D-BP157-052) ───────────────────────────────────────
// THE PROBLEM this section fixes: LB_PUBLIC_KEYS above is COMPILED APP CODE. A client older
// than the release that introduces a new keyId fails closed on "unknown keyId" (by design --
// see verifyManifestEntrySignature above) and then has no path back: it never sees another
// signed update, forever. SEG_RETURN_BP157_048_EXISTING_TRUST_INVENTORY.md's design verdict
// (Question 3) is implemented here: a SIGNED root-rotation announcement, carried over the
// SAME already-fetched, already-unconditionally-polled version_trust.json this file already
// reads in checkAndMaybeDownload() below -- no new daemon, no new poller, no new channel.
//
// TRUST MODEL, one line each (also restated in the SEG return document):
//   1. NEVER TOFU               -- verifyRotationAnnouncement() only accepts a signature from a
//                                   keyId already present in compiledRegistry ∪ overlay.keys;
//                                   an unknown signedBy is refused before any crypto runs.
//   2. REPLAY / ROLLBACK        -- verifyRotationAnnouncement() rejects sequence <=
//                                   overlay.highWaterSequence; applyRotationAnnouncement()
//                                   persists the new high-water mark ONLY on acceptance.
//   3. ADDITIVE vs REVOCATION   -- `add` and `revoke` are separate fields; revoke can name only
//                                   overlay-introduced keyIds (never a compiledRegistry keyId --
//                                   refused outright), and the post-apply trusted set is checked
//                                   non-empty before anything is persisted.
//   4. OVERLAY IS ADDITIVE ONLY -- getEffectiveKeyRegistry() always starts from compiledRegistry
//                                   and only ADDS active overlay keys on top; a compiled keyId
//                                   entry can never be shadowed or replaced by an overlay entry.
//   5. PERSISTENCE              -- lb_root_trust_overlay.json in the SAME userData directory
//                                   thorax_ed25519.json already uses (getUserDataDir()), same
//                                   plain-JSON-on-disk convention, no new storage mechanism.
//   6. PEER PROVENANCE UNDISTURBED -- verifyFrame() itself (thorax/sign_verify.ts) is never
//                                   edited; this section only calls it, exactly as
//                                   peer_artifact_client.ts's downloadFromPeer() already does
//                                   independently. See this dispatch's return doc for the
//                                   explicit check that peer_artifact_client.ts is untouched.
//   7. FAIL CLOSED, LOUDLY      -- every rejection returns a distinct `reason` string and
//                                   checkAndMaybeDownload() below appends a
//                                   'root_rotation_rejected' row (with that reason) to the SAME
//                                   update-history JSONL every other security event already
//                                   writes to; acceptance likewise writes 'root_rotation_accepted'.

/** One trusted-key entry as persisted in the local overlay file. Mirrors RootKeyEntry's shape
 *  (same publicKeyHex/algorithm fields) plus overlay-only bookkeeping (status can be 'revoked'
 *  here, which RootKeyEntry/LB_PUBLIC_KEYS never uses -- a compiled entry is never revoked). */
interface OverlayKeyEntry {
  publicKeyHex: string;
  algorithm: 'ed25519';
  status: 'active' | 'revoked';
  addedAtUtc: string;
  introducedBySequence: number;
}

interface TrustOverlay {
  /** Highest rotation-announcement sequence number ever ACCEPTED. Requirement 2 (replay /
   *  rollback protection): any announcement with sequence <= this value is refused. */
  highWaterSequence: number;
  keys: Record<string, OverlayKeyEntry>;
}

const EMPTY_OVERLAY: TrustOverlay = { highWaterSequence: 0, keys: {} };

/** SAME userData directory, SAME plain-JSON-on-disk convention thorax_ed25519.json already
 *  uses (ed25519_keypair.ts's getOrCreateKeypair(), STORE_FILENAME = 'thorax_ed25519.json') --
 *  no new persistence convention invented (Requirement 5). */
export function getTrustOverlayPath(): string {
  return path.join(getUserDataDir(), 'lb_root_trust_overlay.json');
}

function isValidOverlayShape(v: unknown): v is TrustOverlay {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  if (typeof o.highWaterSequence !== 'number' || !Number.isFinite(o.highWaterSequence)) return false;
  if (!o.keys || typeof o.keys !== 'object') return false;
  for (const entry of Object.values(o.keys as Record<string, unknown>)) {
    if (!entry || typeof entry !== 'object') return false;
    const e = entry as Record<string, unknown>;
    if (typeof e.publicKeyHex !== 'string' || e.publicKeyHex.length === 0) return false;
    if (e.algorithm !== 'ed25519') return false;
    if (e.status !== 'active' && e.status !== 'revoked') return false;
  }
  return true;
}

/**
 * Requirement 4: "If the overlay is missing, corrupt or unparseable, fall back cleanly to
 * compiled-only and keep working." Every failure path here (missing file, unparseable JSON,
 * wrong shape) returns EMPTY_OVERLAY rather than throwing -- an update check must never be
 * blocked by a damaged local file.
 */
export function loadTrustOverlay(): TrustOverlay {
  try {
    const p = getTrustOverlayPath();
    if (!fs.existsSync(p)) return { ...EMPTY_OVERLAY, keys: {} };
    const raw = fs.readFileSync(p, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!isValidOverlayShape(parsed)) {
      console.error('[auto-update] trust overlay file has an invalid shape -- falling back to compiled-only');
      return { ...EMPTY_OVERLAY, keys: {} };
    }
    return parsed;
  } catch (e) {
    console.error('[auto-update] trust overlay file is corrupt/unreadable -- falling back to compiled-only:', e);
    return { ...EMPTY_OVERLAY, keys: {} };
  }
}

function saveTrustOverlay(overlay: TrustOverlay): void {
  const p = getTrustOverlayPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(overlay, null, 2));
}

/**
 * Requirement 4 (additive, never a replacement): compiledRegistry is authoritative and always
 * wins -- an overlay entry sharing a keyId with a compiled entry is ignored, never merged over
 * it. Only overlay keys with status 'active' contribute. This is what
 * verifyManifestEntrySignature() below now consults by default, so a version-manifest entry
 * signed by a rotation-introduced key becomes usable the moment the overlay accepts it.
 */
export function getEffectiveKeyRegistry(
  compiledRegistry: Record<string, RootKeyEntry> = LB_PUBLIC_KEYS,
  overlay: TrustOverlay = loadTrustOverlay(),
): Record<string, RootKeyEntry> {
  const merged: Record<string, RootKeyEntry> = { ...compiledRegistry };
  for (const [keyId, entry] of Object.entries(overlay.keys)) {
    if (keyId in compiledRegistry) continue; // compiled entries can never be shadowed
    if (entry.status !== 'active') continue;
    merged[keyId] = { publicKeyHex: entry.publicKeyHex, algorithm: entry.algorithm, status: 'active' };
  }
  return merged;
}

export interface TrustRootAnnouncement {
  /** Monotonic. Requirement 2. */
  sequence: number;
  /** Additive: new keyIds to trust. Requirement 3. */
  add?: Array<{ keyId: string; publicKeyHex: string; algorithm?: 'ed25519' }>;
  /** Revocation: overlay-introduced keyIds ONLY -- a compiled keyId here is refused outright.
   *  Requirement 3. Separate field from `add` by design, never inferred from it. */
  revoke?: string[];
  /** keyId of the ALREADY-TRUSTED signer (compiled or previously-accepted overlay). Requirement 1. */
  signedBy: string;
  /** signFrame(canonicalRotationString(...), signerPrivateKeyHex). */
  signature: string;
}

/**
 * Deterministic canonical string bound by the rotation announcement's signature. Same reasoning
 * as canonicalManifestEntryString above: a fixed field order and separator so signer and
 * verifier always hash identical bytes, and every field the signature must protect (sequence,
 * every added key's id/algorithm/publicKeyHex, every revoked keyId, and who signed it) is
 * bound in -- nothing can be altered post-signature without invalidating it.
 */
export function canonicalRotationString(a: {
  sequence: number;
  add?: Array<{ keyId: string; publicKeyHex: string; algorithm?: string }>;
  revoke?: string[];
  signedBy: string;
}): string {
  const addPart = (a.add ?? [])
    .map((k) => `${k.keyId}:${k.algorithm ?? 'ed25519'}:${k.publicKeyHex}`)
    .join(',');
  const revokePart = (a.revoke ?? []).slice().join(',');
  return `${a.sequence}:${a.signedBy}:add=[${addPart}]:revoke=[${revokePart}]`;
}

export interface RotationCheckResult {
  ok: boolean;
  reason?: string;
  /** Present only when ok=true -- the overlay applyRotationAnnouncement() should persist. */
  nextOverlay?: TrustOverlay;
}

/**
 * Pure verification: does NOT touch disk (both compiledRegistry and overlay are ordinary
 * parameters, defaulted to the real ones so production call sites don't have to pass them, but
 * fully injectable for tests -- same pattern verifyManifestEntrySignature() already uses).
 * Returns the overlay that WOULD result if applied; applyRotationAnnouncement() below is the
 * only place that actually persists it.
 */
export function verifyRotationAnnouncement(
  announcement: Partial<TrustRootAnnouncement>,
  compiledRegistry: Record<string, RootKeyEntry> = LB_PUBLIC_KEYS,
  overlay: TrustOverlay = loadTrustOverlay(),
): RotationCheckResult {
  if (typeof announcement.sequence !== 'number' || !Number.isFinite(announcement.sequence)) {
    return { ok: false, reason: 'malformed rotation announcement (missing/invalid sequence)' };
  }
  if (!announcement.signedBy || announcement.signedBy.length === 0) {
    return { ok: false, reason: 'malformed rotation announcement (missing signedBy)' };
  }
  if (!announcement.signature || announcement.signature.length === 0) {
    return { ok: false, reason: 'missing signature' };
  }

  // Requirement 2: replay / rollback protection, checked before any crypto runs.
  if (announcement.sequence <= overlay.highWaterSequence) {
    return {
      ok: false,
      reason: `replay or rollback refused (sequence ${announcement.sequence} <= high-water mark ${overlay.highWaterSequence})`,
    };
  }

  // Requirement 1: NEVER TOFU. The signer must already be trusted -- compiled, or a
  // previously-accepted, still-active overlay key. An announcement cannot vouch for itself.
  const effective = getEffectiveKeyRegistry(compiledRegistry, overlay);
  const signerEntry = effective[announcement.signedBy];
  if (!signerEntry) {
    return { ok: false, reason: `unknown signer keyId '${announcement.signedBy}' (not trusted -- TOFU refused)` };
  }
  if (signerEntry.status === 'placeholder' || signerEntry.publicKeyHex === PLACEHOLDER_KEY_SENTINEL) {
    return { ok: false, reason: `signer keyId '${announcement.signedBy}' is still the placeholder root key -- not provisioned` };
  }

  const canonical = canonicalRotationString({
    sequence: announcement.sequence,
    add: announcement.add,
    revoke: announcement.revoke,
    signedBy: announcement.signedBy,
  });
  let verified: { valid: boolean; frameHex: string };
  try {
    verified = verifyFrame(announcement.signature, signerEntry.publicKeyHex);
  } catch (e) {
    return { ok: false, reason: `signature verification error: ${e}` };
  }
  if (!verified.valid || verified.frameHex !== canonical) {
    return { ok: false, reason: 'signature verification failed (bad signature, tampered announcement, or wrong key)' };
  }

  // Requirement 3: the compiled-in root can NEVER be removed by an announcement. Refuse the
  // WHOLE announcement (not a silent partial-apply) if it tries.
  const revokeList = announcement.revoke ?? [];
  for (const keyId of revokeList) {
    if (keyId in compiledRegistry) {
      return { ok: false, reason: `revocation of compiled-in root key '${keyId}' refused` };
    }
  }

  // Build the candidate next overlay.
  const nextKeys: Record<string, OverlayKeyEntry> = { ...overlay.keys };
  for (const keyId of revokeList) {
    const existing = nextKeys[keyId];
    if (existing) nextKeys[keyId] = { ...existing, status: 'revoked' };
    // Revoking a keyId that was never introduced is a no-op, not an error -- idempotent under
    // an out-of-order or duplicated relay of the same announcement content.
  }
  const nowIso = new Date().toISOString();
  for (const k of announcement.add ?? []) {
    if (!k.keyId || !k.publicKeyHex) {
      return { ok: false, reason: 'malformed rotation announcement (an "add" entry is missing keyId or publicKeyHex)' };
    }
    if (k.keyId in compiledRegistry) {
      // Adding a keyId that already exists compiled is a no-op (compiled always wins per
      // getEffectiveKeyRegistry) rather than an error -- not a security-relevant case.
      continue;
    }
    nextKeys[k.keyId] = {
      publicKeyHex: k.publicKeyHex,
      algorithm: k.algorithm ?? 'ed25519',
      status: 'active',
      addedAtUtc: nowIso,
      introducedBySequence: announcement.sequence,
    };
  }

  // Requirement 3, last-resort guard: the resulting trusted set (compiled UNION overlay-active)
  // must never be empty -- this is what "bricks updates permanently" looks like. Compiled keys
  // can never be revoked (checked above), so in normal production this can only ever be
  // violated if compiledRegistry itself is empty (a test scenario) -- checked defensively
  // regardless, since defense-in-depth here costs nothing.
  const nextOverlay: TrustOverlay = { highWaterSequence: announcement.sequence, keys: nextKeys };
  const resultingRegistry = getEffectiveKeyRegistry(compiledRegistry, nextOverlay);
  if (Object.keys(resultingRegistry).length === 0) {
    return { ok: false, reason: 'refused: applying this announcement would leave an empty trusted-key set' };
  }

  return { ok: true, nextOverlay };
}

/**
 * Verifies (via verifyRotationAnnouncement above) AND, only on success, persists the resulting
 * overlay to disk and records the outcome in the same update-history JSONL every other
 * security-relevant event in this file already writes to (Requirement 7 -- fail closed,
 * loudly, no silent rejection).
 */
export function applyRotationAnnouncement(
  announcement: Partial<TrustRootAnnouncement>,
  compiledRegistry: Record<string, RootKeyEntry> = LB_PUBLIC_KEYS,
): RotationCheckResult {
  const overlay = loadTrustOverlay();
  const result = verifyRotationAnnouncement(announcement, compiledRegistry, overlay);
  if (!result.ok || !result.nextOverlay) {
    appendUpdateHistory({
      event: 'root_rotation_rejected',
      sequence: announcement.sequence,
      signedBy: announcement.signedBy,
      reason: result.reason,
    });
    notifySecurityEvent(`Root-rotation announcement REFUSED (${result.reason})`);
    return result;
  }
  saveTrustOverlay(result.nextOverlay);
  appendUpdateHistory({
    event: 'root_rotation_accepted',
    sequence: announcement.sequence,
    signedBy: announcement.signedBy,
    added: (announcement.add ?? []).map((k) => k.keyId),
    revoked: announcement.revoke ?? [],
  });
  return result;
}

async function downloadAndVerify(entry: VersionEntry): Promise<void> {
  if (!fs.existsSync(UPDATES_DIR)) {
    fs.mkdirSync(UPDATES_DIR, { recursive: true });
  }

  const stagedPath = path.join(UPDATES_DIR, `MnemosyneC-Setup-${entry.version}.exe.staged`);
  const readyPath  = path.join(UPDATES_DIR, `MnemosyneC-Setup-${entry.version}.exe.ready`);

  // Don't re-download if already staged and verified
  if (fs.existsSync(readyPath)) {
    console.log('[auto-update] Already staged:', readyPath);
    notifyPatchReady(entry.version);
    return;
  }

  appendUpdateHistory({ event: 'download_started', version: entry.version, url: entry.url });

  try {
    const resp = await fetch(entry.url);
    if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);

    const buffer = Buffer.from(await resp.arrayBuffer());

    // SHA-256 verification — hard gate
    const actualSha = crypto.createHash('sha256').update(buffer).digest('hex');
    if (actualSha !== entry.sha256) {
      // Write then immediately delete the tampered file
      try { fs.writeFileSync(stagedPath, buffer); fs.unlinkSync(stagedPath); } catch { /* noop */ }
      throw new Error(`SHA-256 mismatch: expected ${entry.sha256}, got ${actualSha}`);
    }

    // Write to staged path
    fs.writeFileSync(stagedPath, buffer);

    // Ed25519 signature verification over the MANIFEST ENTRY -- MANDATORY, fail closed.
    // D-BP157-035: the two prior defects this fixes were (1) LB_PUBLIC_KEY was always null,
    // so this gate was permanently inert, and (2) the old code used
    // crypto.createVerify('ed25519'), which Node does not support for streaming verify at all
    // (MEASURED on this machine's installed Node v24.11.0: `crypto.createVerify('ed25519')`
    // constructs without error, but `.verify()` throws `TypeError: Invalid digest` -- it would
    // have thrown on every real signed update, not merely no-op'd). This uses the same
    // one-shot `crypto.verify(null, message, keyObject, signature)` shape sign_verify.ts's
    // verifyFrame() already uses successfully elsewhere in this codebase.
    //
    // Same "write-then-delete" refusal pattern as the SHA-256 mismatch check above, before
    // ever promoting the staged file to <version>.exe.ready -- this is the choke point BOTH
    // checkAndMaybeDownload()'s site-download fallback AND approveMajorVersionUpdate() call
    // through (D-BP157-030's major-version approve path), so this one gate protects both.
    const sigCheck = verifyManifestEntrySignature(entry);
    if (!sigCheck.ok) {
      try { fs.unlinkSync(stagedPath); } catch { /* noop */ }
      const msg = `Manifest signature check FAILED (${sigCheck.reason}) -- update REFUSED for v${entry.version}`;
      appendUpdateHistory({ event: 'signature_rejected', version: entry.version, reason: sigCheck.reason });
      notifySecurityEvent(msg);
      throw new Error(msg);
    }

    // Promote staged → ready
    fs.renameSync(stagedPath, readyPath);

    appendUpdateHistory({
      event: 'download_complete',
      version: entry.version,
      sha256: actualSha,
      signature_valid: true,
      keyId: entry.keyId,
    });
    notifyPatchReady(entry.version);
  } catch (e) {
    if (fs.existsSync(stagedPath)) try { fs.unlinkSync(stagedPath); } catch { /* noop */ }
    appendUpdateHistory({ event: 'download_error', version: entry.version, error: String(e) });
    notifySecurityEvent(`Update download/verification failed: ${e}`);
    throw e;
  }
}

// ─── Mesh (peer-to-peer) promotion helper ─────────────────────────────────────

/**
 * Promote a mesh-pulled, already hash-verified installer straight to the same
 * "<version>.exe.ready" convention downloadAndVerify() uses for site downloads, so the
 * existing installTiming state machine (launch/quit/scheduled/approve) in
 * checkAndTriggerPendingInstall() treats a peer-sourced update identically to a
 * site-sourced one -- the user never sees a difference in the install flow, only in
 * update-history (event: 'mesh_pull_verified' vs 'download_complete').
 */
function promoteVerifiedFileToReady(version: string, sourcePath: string): void {
  if (!fs.existsSync(UPDATES_DIR)) fs.mkdirSync(UPDATES_DIR, { recursive: true });
  const readyPath = path.join(UPDATES_DIR, `MnemosyneC-Setup-${version}.exe.ready`);
  fs.copyFileSync(sourcePath, readyPath);
  notifyPatchReady(version);
}

// ─── Check and maybe download ─────────────────────────────────────────────────

// Exported (D-BP157-035) so a direct test can exercise the manifest-signature gate ahead of
// the mesh path without needing the 6-hour polling loop -- same reasoning fetchLatestVersionTrustEntry
// above was already exported for.
export async function checkAndMaybeDownload(): Promise<void> {
  const cfg = getAutoUpdateConfig();
  if (!cfg.autoUpdates) return;

  const currentVer = app.getVersion();

  try {
    const resp = await fetch('https://mnemosynec.org/version_trust.json', {
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!resp.ok) throw new Error(`version_trust fetch failed: ${resp.status}`);

    const trust = await resp.json() as {
      versions?: Array<{
        tier?: string;
        version?: string;
        url?: string;
        sha256?: string;
        signature?: string;
        keyId?: string;
      }>;
      // D-BP157-052: root-rotation announcements, carried on the SAME already-fetched,
      // already-unconditionally-polled version_trust.json this function already reads every
      // 6 hours from first boot -- no new channel, no new poller. Processed below regardless
      // of whether a new app version is available, so a client parks on an old version_trust
      // entry (or none at all) but still learns about a rotated root key.
      rootRotations?: Array<Partial<TrustRootAnnouncement>>;
    };

    // Process root-rotation announcements FIRST, in ascending sequence order, before touching
    // the version-manifest logic below -- a rotation may introduce the very key that signs the
    // 'latest' entry this poll is about to check, and applyRotationAnnouncement()'s own
    // sequence/signature gates make processing them out of order harmless either way (each is
    // independently verified; a rejected one is recorded and skipped, never blocks the rest).
    if (Array.isArray(trust.rootRotations) && trust.rootRotations.length > 0) {
      const ordered = [...trust.rootRotations].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
      for (const announcement of ordered) {
        try {
          applyRotationAnnouncement(announcement);
        } catch (e) {
          // Defense-in-depth only -- applyRotationAnnouncement() itself never throws on a bad
          // announcement (it returns { ok:false, reason }), but a poll cycle must never abort
          // because of a root-rotation entry regardless.
          console.error('[auto-update] root-rotation processing threw unexpectedly:', e);
        }
      }
    }

    const latestEntry = trust.versions?.find((v) => v.tier === 'latest');
    if (!latestEntry?.version) throw new Error('No latest entry in version_trust.json');

    const latestVer = latestEntry.version;

    appendUpdateHistory({
      event: 'check',
      result: semverGt(latestVer, currentVer) ? 'new_available' : 'already_current',
      version: currentVer,
      latest: latestVer,
    });

    if (!semverGt(latestVer, currentVer)) return; // already current

    // Major version jump gate
    if (cfg.majorVersionRequiresApproval && isMajorJump(currentVer, latestVer)) {
      notifyMajorAvailable(latestVer);
      return; // notification only, no auto-download
    }

    // D-BP157-035 / SEG_RETURN_BP157_032_TRUST_ROOT_DESIGN.md Part D: the manifest's sha256
    // must be verified against the pinned root BEFORE it is trusted as the reference hash for
    // EITHER the mesh path or the site path below -- otherwise an unsigned or tampered
    // manifest entry could still steer this node to accept peer-served bytes matching an
    // unverified hash (FD-BP156-04: LAN/mesh is a carrier, never a trust boundary; being
    // offered by a peer must confer nothing). Once this passes, mesh delivery becomes strictly
    // a transport optimization: pullAndVerifyFromPeers() below re-hashes what it actually
    // downloaded against THIS SAME now-verified latestEntry.sha256, never a peer's
    // self-reported hash (mesh_update_propagation.ts is untouched by this dispatch).
    // downloadAndVerify() re-checks this same signature independently further down as
    // defense-in-depth for the site-download path and for approveMajorVersionUpdate()'s
    // separate manifest fetch.
    const manifestSigCheck = verifyManifestEntrySignature(latestEntry);
    if (!manifestSigCheck.ok) {
      const msg = `version_trust.json 'latest' entry (v${latestVer}) failed signature verification (${manifestSigCheck.reason}) -- update REFUSED, mesh and site paths both skipped`;
      appendUpdateHistory({ event: 'manifest_signature_rejected', version: latestVer, reason: manifestSigCheck.reason });
      notifySecurityEvent(msg);
      return;
    }

    // BP134 Yoke #29 Part 2: try the mesh before the site. peers advertising this exact
    // latestVer, with a live artifact_server_address, are asked for the installer bytes;
    // pullAndVerifyFromPeers() re-hashes what it actually downloaded (SHA-256) against
    // latestEntry.sha256 -- the SAME canonical value the site-download path below verifies
    // against -- and NEVER trusts a peer's own self-reported hash. Any peer whose bytes
    // don't match is discarded and the next peer (or the site fallback) is tried instead.
    if (latestEntry.url && latestEntry.sha256) {
      try {
        const newerPeers = await findNewerPeers(currentVer);
        if (newerPeers.length > 0) {
          appendUpdateHistory({ event: 'mesh_peers_found', version: latestVer, peerCount: newerPeers.length });
          const meshResult = await pullAndVerifyFromPeers(newerPeers, latestVer, latestEntry.sha256);
          if (meshResult.ok && meshResult.localPath) {
            appendUpdateHistory({
              event: 'mesh_pull_verified',
              version: latestVer,
              peerId: meshResult.peerId,
              sha256: latestEntry.sha256,
            });
            promoteVerifiedFileToReady(latestVer, meshResult.localPath);
            return; // mesh propagation succeeded -- site download skipped entirely
          }
          appendUpdateHistory({ event: 'mesh_pull_unavailable', version: latestVer, reason: meshResult.error });
        }
      } catch (meshErr) {
        // Mesh is best-effort -- any failure here (Supabase unreachable, all peers
        // unreachable, etc.) must never block the site fallback below.
        console.warn('[auto-update] Mesh propagation attempt failed (falling back to site):', meshErr);
      }
    }

    // Proceed with background download from the canonical site (fallback / no verified
    // peer copy was available)
    if (latestEntry.url && latestEntry.sha256) {
      await downloadAndVerify({
        version: latestVer,
        url: latestEntry.url,
        sha256: latestEntry.sha256,
        signature: latestEntry.signature,
        keyId: latestEntry.keyId,
        tier: latestEntry.tier,
      });
      // Seed this node's own artifact cache so it can serve latestVer onward to ITS
      // peers via peer_artifact_server -- this is what makes one site download cascade
      // across the mesh instead of every node pulling the full installer independently.
      seedLocalArtifactCache(latestVer, path.join(UPDATES_DIR, `MnemosyneC-Setup-${latestVer}.exe.ready`));
    } else {
      console.warn('[auto-update] version_trust entry missing url or sha256 — skipping download');
    }
  } catch (e) {
    console.error('[auto-update] Check failed:', e);
    appendUpdateHistory({ event: 'check_error', error: String(e), version: currentVer });
  }
}

// ─── Major-version approve/decline (D-BP157-030, Item 2) ──────────────────────
//
// THE GAP THIS FILLS: `notifyMajorAvailable()` above fires an OS notification telling the user
// to "open MnemosyneC to review and install," and broadcasts `auto-update-major-available` --
// but nothing ever ACTED on the user's approval. `checkAndMaybeDownload()`'s major-jump gate
// (line ~313 above) is a pure notify-and-return: it never downloads a major version, approved or
// not, so until now there was no code path that could ever turn an approval into an installed
// update. This section is that missing action, mirroring the ALREADY-WORKING approve flow this
// file already has for the non-major case (Toggle 2 'approve' timing -> notifyApproveRequired ->
// renderer's pendingApproveVersion/"Install Now" button -> `auto-update-approve-install` IPC ->
// triggerInstall) rather than inventing a new one.
//
// SCOPE, DELIBERATE: canonical-site-only (`downloadAndVerify`, unchanged, SAME SHA-256 gate, SAME
// inert-until-keyed Ed25519 gate -- the trust root itself is untouched). Never touches
// `findNewerPeers`/`pullAndVerifyFromPeers` (mesh_update_propagation.ts) and never changes
// `checkAndMaybeDownload()`'s own control flow -- this is new, additive, and fires ONLY on an
// explicit, deliberate renderer click (SettingsTab.tsx's onAutoUpdateMajorAvailable listener),
// never on a timer. "Any change to auto_update_scheduler.ts's network behavior" in this
// dispatch's own out-of-scope list reads, in context, as the mesh-sourcing consent gate
// (SEG_RETURN_BP157_027_MESH_UPDATE_CONSENT.md Part 5 items 6-7, grouped there with the mesh
// propagation module and the new mesh-sourcing toggle) -- not a ban on ever adding a new,
// explicitly human-gated function to this file. Flagged here for review rather than assumed
// silently correct.

/** Re-fetches the SAME canonical manifest `checkAndMaybeDownload()` already reads (same URL, same
 *  no-cache header) and returns its 'latest' tier entry, or null if unreachable/malformed. Never
 *  throws. Exported so a future direct test can call it without duplicating the fetch shape. */
export async function fetchLatestVersionTrustEntry(): Promise<VersionEntry | null> {
  try {
    const resp = await fetch('https://mnemosynec.org/version_trust.json', {
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!resp.ok) return null;
    const trust = (await resp.json()) as { versions?: Array<VersionEntry> };
    const latestEntry = trust.versions?.find((v) => v.tier === 'latest');
    if (!latestEntry?.version || !latestEntry.url || !latestEntry.sha256) return null;
    return latestEntry;
  } catch (e) {
    console.error('[auto-update] fetchLatestVersionTrustEntry failed:', e);
    return null;
  }
}

/**
 * Called only from the `approve-major-update` IPC handler below, itself called only when a human
 * clicks the new "Approve" control SettingsTab.tsx renders for an `auto-update-major-available`
 * event -- never automatic. Re-validates against a FRESH manifest fetch (never trusts that the
 * version the user saw is still what the manifest offers -- the manifest could have moved between
 * notify and approve) before calling the existing, unmodified `downloadAndVerify()`.
 *
 * On success, immediately calls `notifyApproveRequired()` (the SAME function
 * `checkAndTriggerPendingInstall()`'s `case 'approve':` already calls) regardless of the user's
 * general `installTiming` preference -- a major-version jump is a one-shot decision, not a
 * standing schedule (canon ref at this file's own header: "Major version jumps ... re-prompt
 * regardless of toggle state"), so approving one always ends in one more deliberate "Install Now"
 * click via the ALREADY-BUILT pendingApproveVersion flow (SettingsTab.tsx:2610-2626), in the
 * current session, without waiting for a relaunch. This never auto-installs on approval alone.
 */
export async function approveMajorVersionUpdate(version: string): Promise<{ ok: boolean; error?: string }> {
  appendUpdateHistory({ event: 'major_version_approved', version });
  const entry = await fetchLatestVersionTrustEntry();
  if (!entry) {
    appendUpdateHistory({ event: 'major_version_approve_error', version, error: 'version_trust_unavailable' });
    return { ok: false, error: 'Could not reach the update manifest -- try again shortly.' };
  }
  if (entry.version !== version) {
    // The manifest moved between notify and approve -- never install a DIFFERENT version than
    // the one the user actually reviewed and clicked approve on.
    appendUpdateHistory({ event: 'major_version_approve_mismatch', requested: version, offered: entry.version });
    return { ok: false, error: `The update manifest now offers v${entry.version}, not v${version} -- please re-check for updates.` };
  }
  try {
    await downloadAndVerify(entry); // unchanged; SHA-256-gated; fires notifyPatchReady() on success
    const readyPath = path.join(UPDATES_DIR, `MnemosyneC-Setup-${version}.exe.ready`);
    if (fs.existsSync(readyPath)) notifyApproveRequired(readyPath);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** Declining is a real, recorded outcome (audit-logged via the existing `appendUpdateHistory`
 *  JSONL log, readable in the existing "View Update History" modal), never a silent dismissal --
 *  and it takes no further action, leaving the app running on its current version. */
export function declineMajorVersionUpdate(version: string): void {
  appendUpdateHistory({ event: 'major_version_declined', version });
}

// ─── Polling loop ─────────────────────────────────────────────────────────────

const AUTO_UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

let autoUpdateTimer: ReturnType<typeof setInterval> | null = null;

export function startAutoUpdateLoop(): void {
  if (autoUpdateTimer) return; // already running
  // 30s startup delay to avoid slamming the network on launch
  setTimeout(() => checkAndMaybeDownload().catch(() => {}), 30_000);
  autoUpdateTimer = setInterval(
    () => checkAndMaybeDownload().catch(() => {}),
    AUTO_UPDATE_CHECK_INTERVAL_MS,
  );
  console.log('[auto-update] Loop started — 6hr interval');
}

export function stopAutoUpdateLoop(): void {
  if (autoUpdateTimer) {
    clearInterval(autoUpdateTimer);
    autoUpdateTimer = null;
    console.log('[auto-update] Loop stopped');
  }
}

// ─── Scheduled install helper ─────────────────────────────────────────────────

function scheduleInstallAt(scheduledTime: string, readyPath: string): void {
  const [hourStr, minStr] = scheduledTime.split(':');
  const hour = parseInt(hourStr, 10);
  const min  = parseInt(minStr, 10);
  const now  = new Date();
  const scheduled = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, min, 0);
  if (scheduled <= now) scheduled.setDate(scheduled.getDate() + 1); // tomorrow if past
  const delay = scheduled.getTime() - now.getTime();
  console.log(`[auto-update] Install scheduled at ${scheduledTime} (${Math.round(delay / 60000)} min from now)`);
  setTimeout(() => triggerInstall(readyPath), delay);
}

function triggerInstall(readyPath: string): void {
  const exePath = readyPath.replace('.ready', '');
  try {
    fs.renameSync(readyPath, exePath);
    appendUpdateHistory({ event: 'install_scheduled', trigger: 'auto', path: exePath });
    // Spawn installer silently and quit
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { spawn } = require('child_process') as typeof import('child_process');
    spawn(exePath, ['/SILENT'], { detached: true, stdio: 'ignore' }).unref();
    app.quit();
  } catch (e) {
    console.error('[auto-update] triggerInstall failed:', e);
    appendUpdateHistory({ event: 'install_error', error: String(e) });
  }
}

// ─── Pending install check (on launch) ───────────────────────────────────────

export async function checkAndTriggerPendingInstall(): Promise<void> {
  const cfg = getAutoUpdateConfig();
  if (!cfg.autoUpdates) return;
  if (!fs.existsSync(UPDATES_DIR)) return;

  let readyFiles: string[];
  try {
    readyFiles = fs.readdirSync(UPDATES_DIR).filter((f) => f.endsWith('.ready'));
  } catch {
    return;
  }
  if (readyFiles.length === 0) return;

  const readyPath = path.join(UPDATES_DIR, readyFiles[readyFiles.length - 1]); // latest

  switch (cfg.installTiming) {
    case 'launch':
      triggerInstall(readyPath);
      break;
    case 'quit':
      app.on('before-quit', () => triggerInstall(readyPath));
      break;
    case 'scheduled':
      scheduleInstallAt(cfg.scheduledTime, readyPath);
      break;
    case 'approve':
      notifyApproveRequired(readyPath);
      break;
  }
}

// ─── Config migration (Block 6) ───────────────────────────────────────────────
// The old installOnQuit toggle lived in renderer localStorage only.
// Migration to the new config key happens on the renderer side in AutomaticUpdatesSection
// (useEffect reads 'mnemo_auto_install_on_quit' and calls set-auto-update-config).
// No main-process migration is needed since the old setting was never persisted here.
export function migrateAutoInstallConfig(): void {
  console.log('[auto-update] Config migration check complete (renderer-side migration handles legacy key)');
}

// ─── IPC registration ─────────────────────────────────────────────────────────

export function registerAutoUpdateIPC(): void {
  try { ipcMain.handle('get-auto-update-config', () => getAutoUpdateConfig()); }
  catch (e) { console.error('[auto-update] Duplicate IPC registration: get-auto-update-config', e); }

  try {
    ipcMain.handle('set-auto-update-config', (_event, cfg: Partial<AutoUpdateConfig>) => {
      const updated = setAutoUpdateConfig(cfg);
      if (updated.autoUpdates) {
        startAutoUpdateLoop();
      } else {
        stopAutoUpdateLoop();
      }
      return updated;
    });
  } catch (e) { console.error('[auto-update] Duplicate IPC registration: set-auto-update-config', e); }

  try {
    ipcMain.handle('get-update-history', () => getUpdateHistory());
  } catch (e) { console.error('[auto-update] Duplicate IPC registration: get-update-history', e); }

  // Renderer-triggered install approval (Toggle 2 = 'approve')
  ipcMain.on('auto-update-approve-install', (_event, readyPath: string) => {
    triggerInstall(readyPath);
  });

  // D-BP157-030 Item 2: the missing major-version review/approve action -- see this file's
  // "Major-version approve/decline" section above for the full rationale.
  try {
    ipcMain.handle('approve-major-update', async (_event, version: string) => approveMajorVersionUpdate(version));
  } catch (e) { console.error('[auto-update] Duplicate IPC registration: approve-major-update', e); }

  try {
    ipcMain.handle('decline-major-update', (_event, version: string) => {
      declineMajorVersionUpdate(version);
      return { ok: true };
    });
  } catch (e) { console.error('[auto-update] Duplicate IPC registration: decline-major-update', e); }
}
