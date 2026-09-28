// BP104 D3 — persistent peer_id via local Ed25519 keypair
// K-D6-6-9 BP105 — 3-layer defense: idempotent load + cross-user-context lookup + ProgramData backup
//
// Keys live at %APPDATA%\MnemosyneC\keys\ — survive reinstall when install script preserves keys/
// Cross-user-context fallback: checks %LOCALAPPDATA%, %PROGRAMDATA%, and all user profiles
// before generating fresh (protects against NSIS upgrade wiping per-user AppData)
//
// D-BP223-BM0-X030-098 (same class as X030-073 P4, XO X030 pick on Founder k/0a8d1c96): the private key file
// peer.ed25519.priv is NEVER written as plain hex any more. It is written through Electron safeStorage (Windows DPAPI),
// whose output starts with "v10"/"v11", the same format thorax/ed25519_keypair.ts uses.
//   - Fresh key and encrypted storage unavailable: REFUSE before generating, write nothing, show the same one-time
//     "Mesh identity is off" message, throw LocalPeerIdentityUnavailableError. Callers already fall back (getStablePeerId
//     uses the machine UUID id; presence publishes without public_key_hex).
//   - Existing PLAINTEXT key (written by an older build): migrated on read when encrypted storage is available. The
//     encrypted blob is written to a temp file, decrypted back and compared, then renamed over the plaintext file, then read
//     back and verified again. No plaintext copy is kept anywhere, and the plaintext is only replaced after the encrypted
//     write verified.
//   - Existing plaintext key and encrypted storage unavailable: the identity is NOT used (run without it). The file is left
//     where it is: deleting it would destroy the identity with no encrypted copy to fall back on (unreadable/unprotectable
//     is not absent). It is migrated on the first run where encrypted storage works.
//   - A plaintext key is never COPIED anywhere (the canonical restore and the ProgramData backup copy only encrypted blobs).
//   The public key file stays plain hex: it is public, and the peer_id is derived from it, so a migration never changes the
//   peer_id.

import { app, safeStorage } from 'electron';
import { createHash, createPrivateKey, generateKeyPairSync, sign } from 'crypto';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { reportMeshIdentityUnavailable } from '../thorax/ed25519_keypair';

export interface LocalPeerKeypair {
  peerId: string;
  publicKeyHex: string;
}

/** X030-098: thrown instead of writing, copying or using a plain-hex peer private key. */
export class LocalPeerIdentityUnavailableError extends Error {
  readonly code = 'LOCAL_PEER_IDENTITY_UNAVAILABLE';
  constructor(readonly filePath: string, readonly why: string) {
    super(`[D3] ${why} (${filePath}). REFUSING to store or use a private key in plain hex. ` +
      'MnemosyneC runs without this peer identity until Windows encrypted storage works.');
    this.name = 'LocalPeerIdentityUnavailableError';
  }
}

const PRIV_NAME = 'peer.ed25519.priv';
const PUB_NAME = 'peer.ed25519.pub';
const SAFE_STORAGE_PREFIXES = ['v10', 'v11'];

export function isEncryptedPrivBlob(buf: Buffer): boolean {
  return buf.length > 3 && SAFE_STORAGE_PREFIXES.includes(buf.subarray(0, 3).toString('latin1'));
}

function encryptionAvailable(): boolean {
  try { return !!safeStorage && safeStorage.isEncryptionAvailable(); } catch { return false; }
}

function canonicalKeysDir(): string {
  return join(app.getPath('userData'), 'keys');
}

function peerIdFromPublicHex(publicKeyHex: string): string {
  return createHash('sha256').update(publicKeyHex).digest('hex').slice(0, 16);
}

/** Returns all candidate key directory paths to check for an existing keypair.
 *  Ordered from most-preferred to least. Checked before generating fresh. */
function candidateKeysDirs(): string[] {
  const dirs: string[] = [];

  // 1. Canonical current-user Roaming (primary)
  try { dirs.push(join(app.getPath('userData'), 'keys')); } catch { /* pre-ready */ }

  // 2. LocalAppData (some Electron templates write here)
  const localAppData = process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local');
  dirs.push(join(localAppData, 'MnemosyneC', 'keys'));

  // 3. ProgramData machine-scope (written by app on fresh generation for cross-user resilience)
  const programData = process.env.PROGRAMDATA ?? 'C:\\ProgramData';
  dirs.push(join(programData, 'MnemosyneC', 'keys'));

  // 4. Enumerate all Windows user profiles (fallback for admin-installed, user-running scenario)
  try {
    const usersRoot = process.env.MNEMOSYNE_USERS_ROOT ?? 'C:\\Users';
    if (existsSync(usersRoot)) {
      for (const entry of readdirSync(usersRoot)) {
        const candidate = join(usersRoot, entry, 'AppData', 'Roaming', 'MnemosyneC', 'keys');
        if (!dirs.includes(candidate)) {
          dirs.push(candidate);
        }
      }
    }
  } catch { /* non-fatal — skip profile enumeration */ }

  return dirs;
}

/**
 * X030-098: writes the private key ENCRYPTED and proves it. Temp file first, decrypt-and-compare, rename over the target
 * (this is the moment any plaintext at that path is replaced), then read back and decrypt-and-compare again. Throws on any
 * mismatch; before the rename the target is untouched.
 */
export function writeEncryptedPrivVerified(privPath: string, privateKeyHex: string): void {
  const blob = safeStorage.encryptString(privateKeyHex);
  if (!isEncryptedPrivBlob(blob)) throw new Error('[D3] safeStorage returned a blob without the encrypted-format prefix');
  const tmp = `${privPath}.enc-tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmp, blob, { mode: 0o600 });
  try {
    if (safeStorage.decryptString(readFileSync(tmp)) !== privateKeyHex) throw new Error('[D3] encrypted temp write did not decrypt back to the key');
  } catch (err) {
    try { unlinkSync(tmp); } catch { /* best effort */ }
    throw err;
  }
  renameSync(tmp, privPath);
  try { chmodSync(privPath, 0o600); } catch { /* Windows ignores POSIX mode bits */ }
  const back = readFileSync(privPath);
  if (!isEncryptedPrivBlob(back) || safeStorage.decryptString(back) !== privateKeyHex) {
    throw new Error('[D3] encrypted private key did not verify after the final write');
  }
}

export type PrivState = 'absent' | 'encrypted' | 'migrated' | 'plaintext_no_encryption' | 'unreadable' | 'migration_failed';

/**
 * X030-098: inspects peer.ed25519.priv in `dir` and migrates a plain-hex key in place when encrypted storage is available.
 * Never deletes a key it could not first store encrypted.
 */
export function migratePlaintextPriv(dir: string): PrivState {
  const privPath = join(dir, PRIV_NAME);
  if (!existsSync(privPath)) return 'absent';
  let buf: Buffer;
  try { buf = readFileSync(privPath); } catch { return 'unreadable'; }
  if (isEncryptedPrivBlob(buf)) return 'encrypted';
  const hex = buf.toString('utf8').trim();
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length < 64) return 'unreadable';
  if (!encryptionAvailable()) return 'plaintext_no_encryption';
  try {
    writeEncryptedPrivVerified(privPath, hex);
    console.log('[D3] plaintext peer private key migrated to encrypted storage at ' + dir + ' (X030-098)');
    return 'migrated';
  } catch (err) {
    console.warn('[D3] could not migrate plaintext peer private key at ' + dir + ':', err instanceof Error ? err.message : String(err));
    return 'migration_failed';
  }
}

function refuse(filePath: string, why: string): never {
  reportMeshIdentityUnavailable(filePath);
  throw new LocalPeerIdentityUnavailableError(filePath, why);
}

function readPub(dir: string): string | null {
  const pubPath = join(dir, PUB_NAME);
  if (!existsSync(pubPath) || !existsSync(join(dir, PRIV_NAME))) return null;
  try {
    const publicKeyHex = readFileSync(pubPath, 'utf8').trim();
    return publicKeyHex && publicKeyHex.length >= 32 ? publicKeyHex : null;
  } catch {
    return null;
  }
}

/** Save keypair to canonical current-user path (private key encrypted, verified). */
function saveToCanonicalDir(dir: string, publicKeyHex: string, privateKeyHex: string): void {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeEncryptedPrivVerified(join(dir, PRIV_NAME), privateKeyHex);
  writeFileSync(join(dir, PUB_NAME), publicKeyHex, { mode: 0o644 });
}

/** ProgramData backup: copies only an ENCRYPTED private key blob (X030-098). A DPAPI blob is bound to the user who made it;
 *  the backup still restores the public key, and so the peer_id, for another account. */
function tryBackupEncryptedToProgramData(fromDir: string): void {
  try {
    const src = join(fromDir, PRIV_NAME);
    if (!isEncryptedPrivBlob(readFileSync(src))) return; // never copy plaintext
    const programData = process.env.PROGRAMDATA ?? 'C:\\ProgramData';
    const pgDir = join(programData, 'MnemosyneC', 'keys');
    mkdirSync(pgDir, { recursive: true });
    copyFileSync(src, join(pgDir, PRIV_NAME));
    copyFileSync(join(fromDir, PUB_NAME), join(pgDir, PUB_NAME));
    console.log('[D3] ProgramData backup saved (encrypted private key) · cross-user resilience active');
  } catch {
    console.log('[D3] ProgramData backup skipped (non-admin install — graceful)');
  }
}

/** Generate or load Ed25519 keypair; never logs private key.
 *  Layer 2: idempotent load — NEVER regenerates when key files are present.
 *  Layer 3: cross-user-context lookup — checks ProgramData + all user profiles before generating fresh.
 *  [BOOT-GATE] D3-keypair logs on every load/generate for gadget-verifiable empirical proof.
 *  X030-098: throws LocalPeerIdentityUnavailableError rather than store, copy or use a plain-hex private key. */
export function ensureLocalPeerKeypair(): LocalPeerKeypair {
  const canonicalDir = canonicalKeysDir();
  console.log('[BOOT-GATE] D3-keypair CHECKING canonical=' + canonicalDir);
  const programData = process.env.PROGRAMDATA ?? 'C:\\ProgramData';
  const pgDir = join(programData, 'MnemosyneC', 'keys');

  // Layer 2: idempotent load — check canonical dir first
  const canonicalPub = readPub(canonicalDir);
  if (canonicalPub) {
    const state = migratePlaintextPriv(canonicalDir);
    if (state === 'plaintext_no_encryption') refuse(join(canonicalDir, PRIV_NAME), 'a plain-hex peer private key exists and Windows encrypted storage is unavailable to migrate it');
    if (state === 'migration_failed') refuse(join(canonicalDir, PRIV_NAME), 'a plain-hex peer private key exists and its encrypted migration did not verify');
    if (state === 'unreadable') refuse(join(canonicalDir, PRIV_NAME), 'the peer private key file is unreadable (not replaced: unreadable is not absent)');
    const canonical = { peerId: peerIdFromPublicHex(canonicalPub), publicKeyHex: canonicalPub };
    console.log('[D3] loaded existing keypair · peer_id=' + canonical.peerId + ' · source=AppData-canonical');
    // An older build may have left a plaintext ProgramData copy: migrate it in place (best effort, never deletes unencrypted).
    const pgState = migratePlaintextPriv(pgDir);
    if (pgState === 'plaintext_no_encryption' || pgState === 'migration_failed') {
      console.warn('[D3] a plain-hex peer private key backup remains at ' + pgDir + ' (could not migrate it this run)');
    }
    // Also ensure ProgramData backup exists for future upgrade resilience (encrypted blob only)
    if (!existsSync(join(pgDir, PRIV_NAME))) tryBackupEncryptedToProgramData(canonicalDir);
    return canonical;
  }

  // Layer 3: cross-user-context lookup — check all candidates before generating fresh
  const allCandidates = candidateKeysDirs();
  for (const dir of allCandidates) {
    if (dir === canonicalDir) continue; // already checked above
    const pub = readPub(dir);
    if (!pub) continue;
    const found = { peerId: peerIdFromPublicHex(pub), publicKeyHex: pub };
    const srcPriv = join(dir, PRIV_NAME);
    let srcBuf: Buffer | null = null;
    try { srcBuf = readFileSync(srcPriv); } catch { srcBuf = null; }
    if (srcBuf && isEncryptedPrivBlob(srcBuf)) {
      console.log('[D3] loaded existing keypair · peer_id=' + found.peerId + ' · source=' + dir + ' (cross-user-context restore)');
      try {
        mkdirSync(canonicalDir, { recursive: true, mode: 0o700 });
        copyFileSync(srcPriv, join(canonicalDir, PRIV_NAME));
        copyFileSync(join(dir, PUB_NAME), join(canonicalDir, PUB_NAME));
        console.log('[D3] keypair copied to canonical AppData path · subsequent loads will be direct');
      } catch { /* non-fatal — still return the found keypair */ }
      return found;
    }
    const hex = srcBuf ? srcBuf.toString('utf8').trim() : '';
    if (!/^[0-9a-f]+$/i.test(hex) || hex.length < 64) continue; // unreadable candidate: skip it, never touch it
    if (!encryptionAvailable()) refuse(srcPriv, 'a plain-hex peer private key was found and Windows encrypted storage is unavailable');
    // Restore to canonical ENCRYPTED (verified), then migrate the source in place. The plaintext is never copied.
    try {
      saveToCanonicalDir(canonicalDir, pub, hex);
    } catch (err) {
      refuse(join(canonicalDir, PRIV_NAME), 'could not store the restored peer private key encrypted: ' + (err instanceof Error ? err.message : String(err)));
    }
    const srcState = migratePlaintextPriv(dir);
    if (srcState !== 'migrated' && srcState !== 'encrypted') {
      console.warn('[D3] a plain-hex peer private key remains at ' + dir + ' (no write access to migrate it); the canonical copy is encrypted');
    }
    console.log('[D3] loaded existing keypair · peer_id=' + found.peerId + ' · source=' + dir + ' (cross-user-context restore, encrypted into canonical)');
    return found;
  }

  // All candidates empty — generate fresh keypair. X030-098: check encrypted storage BEFORE generating.
  if (!encryptionAvailable()) refuse(join(canonicalDir, PRIV_NAME), 'no peer keypair exists and Windows encrypted storage is unavailable to store a new one');
  console.log('[D3] no existing keypair found in any candidate path — generating fresh Ed25519 keypair');
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyHex = (publicKey.export({ type: 'spki', format: 'der' }) as Buffer).toString('hex');
  const privateKeyHex = (privateKey.export({ type: 'pkcs8', format: 'der' }) as Buffer).toString('hex');

  // Save to canonical current-user path (encrypted, verified)
  saveToCanonicalDir(canonicalDir, publicKeyHex, privateKeyHex);

  // Save to ProgramData machine-scope for cross-user resilience on future upgrades (encrypted blob only)
  tryBackupEncryptedToProgramData(canonicalDir);

  const peerId = peerIdFromPublicHex(publicKeyHex);
  console.log('[D3] generated fresh keypair · peer_id=' + peerId);
  console.log('[BOOT-GATE] D3-keypair PASS · peer_id=' + peerId);

  return { peerId, publicKeyHex };
}

/**
 * D-BP223-BM09-ARCHBISHOP-004-016 ("My Savings Receipt"): signs `data` with THIS install's
 * Ed25519 private key -- a generic signing primitive, not receipt-specific, so this module never
 * learns anything about savings receipts (see savings_receipt_block.ts for the receipt-specific
 * text this ends up signing). Reuses the SAME keypair ensureLocalPeerKeypair() manages -- never a
 * second keypair: calls it first so an old plaintext key is migrated to encrypted storage before
 * signing, exactly like every other caller of this module, and so the canonical directory is
 * guaranteed to hold an encrypted private key file on every successful return path (idempotent
 * load, cross-user restore, and fresh-generate all end with one there -- see the three return
 * points above).
 *
 * The decrypted private-key hex lives only in the local `privateKeyHex` below, for the duration
 * of this call, and is never logged, returned, or written anywhere -- only the signature (a
 * public, non-secret value) and the algorithm name leave this function.
 */
export function signWithLocalPeerKey(data: Buffer | string): { signatureHex: string; sigAlg: string; publicKeyHex: string } {
  const { publicKeyHex } = ensureLocalPeerKeypair();
  const canonicalDir = canonicalKeysDir();
  const privPath = join(canonicalDir, PRIV_NAME);

  let buf: Buffer;
  try {
    buf = readFileSync(privPath);
  } catch (err) {
    refuse(privPath, `could not read the peer private key to sign with it: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!isEncryptedPrivBlob(buf)) {
    refuse(privPath, 'private key on disk is not in the expected encrypted format; refusing to sign with it');
  }
  if (!encryptionAvailable()) {
    refuse(privPath, 'Windows encrypted storage is unavailable; cannot decrypt the private key to sign');
  }

  const privateKeyHex = safeStorage.decryptString(buf);
  const privKey = createPrivateKey({ key: Buffer.from(privateKeyHex, 'hex'), format: 'der', type: 'pkcs8' });
  const sigAlg = privKey.asymmetricKeyType ?? 'unknown';
  if (sigAlg !== 'ed25519') {
    // X030-098's keypair is always generated via generateKeyPairSync('ed25519'), which is
    // inherently a signing (not encryption-only) algorithm -- this should be unreachable in
    // practice. Stated here, not silently worked around: per dispatch instruction, an
    // encryption-only or otherwise non-Ed25519 key must STOP the caller, not sign anyway.
    throw new Error(`[D3] local peer key is "${sigAlg}", not ed25519 -- refusing to sign a savings receipt with it (encryption-only key or wrong key type)`);
  }

  const dataBuffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  const signatureHex = sign(null, dataBuffer, privKey).toString('hex');
  return { signatureHex, sigAlg, publicKeyHex };
}
