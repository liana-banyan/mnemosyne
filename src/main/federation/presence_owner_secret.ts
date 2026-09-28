/**
 * presence_owner_secret.ts -- D-BP223-X043-010-RB. The per-install PRESENCE OWNER SECRET.
 *
 * WHY THIS EXISTS. peer_presence, relay_routes and relay_route_replies were open to anyone holding
 * the public anon key (see BISHOP_DROPZONE\D-BP223-X043-007-RELAY-X25519\RELAY_X25519_REPORT.md).
 * Phase A (applied live 2026-09-28T03:09:33Z) added SECURITY DEFINER functions (presence_put_own,
 * route_send, routes_fetch_mine, route_set_status, route_reply_put, route_replies_for_sender) that
 * prove "this is my own row" without a login: each install holds 32 random bytes (64 lowercase
 * hex) and the server keeps only sha256 of that hex string in peer_presence_owner.
 *
 * WHERE IT LIVES. <userData>\presence_owner_secret.v1.<peer_id>.bin, written ONLY through Electron
 * safeStorage (Windows DPAPI; output starts with "v10"/"v11"), holding
 * JSON {v:1, peer_id, secret}. Plain-text storage is refused, the same rule as the identity keys
 * (thorax/ed25519_keypair.ts, identity/localPeerKeypair.ts). The MIC channel scripts
 * (BISHOP_DROPZONE\MIC_CHANNEL\mic_channel_owner_secret.js) READ this same file as the same Windows
 * user, because they send as the same peer id and the server accepts exactly one secret per peer.
 *
 * HOW IT IS OBTAINED, in order, once per process (cached in memory):
 *   1. the store exists: decrypt, check v, peer_id and format. A store that exists but cannot be
 *      read, or names another peer id, THROWS. Unreadable is not absent: overwriting it would
 *      orphan the row the server already binds to the old secret.
 *   2. M0 adoption: a one-time import file <home>\.lb-private-exports\m0_presence_owner_secret_<peer>.txt
 *      (created when Phase A registered M0's legacy row). It is read by path, never printed,
 *      written to the store, the store is read back and compared, and ONLY THEN the import file is
 *      shredded (overwritten with random bytes, flushed, then unlinked). If verification fails the
 *      file is kept and the import throws.
 *   3. otherwise generate 32 random bytes, write, read back, verify.
 *
 * The secret is sent ONLY inside the Phase A RPC bodies (relay_rpc.ts) and the owner-proof field
 * of the five relay edge functions, over TLS. It is never logged, never put in a URL, never
 * returned over IPC.
 */

import { randomBytes } from 'node:crypto';
import {
  closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, statSync,
  unlinkSync, writeFileSync, writeSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/** One store file PER PEER ID (an install can publish under more than one peer id, e.g. the
 *  stable identity and a Substrate Awakens '<16 hex>-sa' id). */
export function ownerSecretStoreFilename(peerId: string): string {
  return `presence_owner_secret.v1.${peerId}.bin`;
}
const SECRET_RE = /^[0-9a-f]{64}$/;
const PEER_ID_RE = /^[0-9a-z][0-9a-z-]{0,63}$/;
const SAFE_STORAGE_PREFIXES = ['v10', 'v11'];

export class OwnerSecretUnavailableError extends Error {
  readonly code = 'OWNER_SECRET_UNAVAILABLE';
  constructor(message: string) {
    super(message);
    this.name = 'OwnerSecretUnavailableError';
  }
}

/** Everything that touches Electron or the disk location is injected, so tests run offline. */
export interface OwnerSecretDeps {
  encryptionAvailable: () => boolean;
  encryptString: (plain: string) => Buffer;
  decryptString: (blob: Buffer) => string;
  userDataDir: () => string;
  /** Directory holding the one-time M0 import file. */
  importDir: () => string;
  random32: () => Buffer;
  log: (line: string) => void;
}

function electronDeps(): OwnerSecretDeps {
  // Lazy require so pure importers (and tests that inject deps) never load Electron.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { app, safeStorage } = require('electron') as typeof import('electron');
  return {
    encryptionAvailable: () => { try { return !!safeStorage && safeStorage.isEncryptionAvailable(); } catch { return false; } },
    encryptString: (s) => safeStorage.encryptString(s),
    decryptString: (b) => safeStorage.decryptString(b),
    userDataDir: () => app.getPath('userData'),
    importDir: () => join(homedir(), '.lb-private-exports'),
    random32: () => randomBytes(32),
    log: (l) => console.log(l),
  };
}

export function ownerSecretStorePath(deps: Pick<OwnerSecretDeps, 'userDataDir'>, peerId: string): string {
  if (!PEER_ID_RE.test(peerId)) throw new OwnerSecretUnavailableError(`[owner-secret] bad peer id ${peerId}`);
  return join(deps.userDataDir(), ownerSecretStoreFilename(peerId));
}

export function m0ImportFilePath(deps: Pick<OwnerSecretDeps, 'importDir'>, peerId: string): string {
  return join(deps.importDir(), `m0_presence_owner_secret_${peerId}.txt`);
}

function isEncryptedBlob(buf: Buffer): boolean {
  return buf.length > 3 && SAFE_STORAGE_PREFIXES.includes(buf.subarray(0, 3).toString('latin1'));
}

function readStore(deps: OwnerSecretDeps, peerId: string): string | null {
  const p = ownerSecretStorePath(deps, peerId);
  if (!existsSync(p)) return null;
  const buf = readFileSync(p);
  if (!isEncryptedBlob(buf)) {
    throw new OwnerSecretUnavailableError(`[owner-secret] store at ${p} is not in encrypted format; refusing to use or overwrite it`);
  }
  if (!deps.encryptionAvailable()) {
    throw new OwnerSecretUnavailableError('[owner-secret] Windows encrypted storage is unavailable; the owner secret cannot be read');
  }
  let parsed: { v?: unknown; peer_id?: unknown; secret?: unknown };
  try {
    parsed = JSON.parse(deps.decryptString(buf));
  } catch {
    throw new OwnerSecretUnavailableError(`[owner-secret] store at ${p} could not be decrypted; refusing to overwrite it`);
  }
  if (parsed.v !== 1 || typeof parsed.secret !== 'string' || !SECRET_RE.test(parsed.secret)) {
    throw new OwnerSecretUnavailableError(`[owner-secret] store at ${p} has an unexpected shape; refusing to overwrite it`);
  }
  if (parsed.peer_id !== peerId) {
    throw new OwnerSecretUnavailableError(
      `[owner-secret] store at ${p} belongs to peer ${String(parsed.peer_id)}, not ${peerId}; refusing to use or overwrite it`);
  }
  return parsed.secret;
}

/** Writes through a temp file, decrypts the temp back and compares, renames, then reads the
 *  final file back and compares again. Throws (and leaves no store) on any mismatch. */
function writeStoreVerified(deps: OwnerSecretDeps, peerId: string, secret: string): void {
  if (!deps.encryptionAvailable()) {
    throw new OwnerSecretUnavailableError('[owner-secret] Windows encrypted storage is unavailable; REFUSING to store the owner secret in plain text');
  }
  const p = ownerSecretStorePath(deps, peerId);
  mkdirSync(dirname(p), { recursive: true });
  const blob = deps.encryptString(JSON.stringify({ v: 1, peer_id: peerId, secret }));
  if (!isEncryptedBlob(blob)) throw new OwnerSecretUnavailableError('[owner-secret] encryption returned a blob without the encrypted-format prefix');
  const tmp = `${p}.tmp-${process.pid}`;
  writeFileSync(tmp, blob);
  try {
    const back = JSON.parse(deps.decryptString(readFileSync(tmp)));
    if (back.secret !== secret || back.peer_id !== peerId) throw new Error('temp write did not decrypt back');
  } catch (err) {
    try { unlinkSync(tmp); } catch { /* ignore */ }
    throw new OwnerSecretUnavailableError(`[owner-secret] verification of the encrypted write failed: ${(err as Error).message}`);
  }
  renameSync(tmp, p);
  if (readStore(deps, peerId) !== secret) {
    throw new OwnerSecretUnavailableError('[owner-secret] the stored owner secret did not read back identically');
  }
}

/** Overwrite with random bytes of the same length (twice), flush, unlink, confirm gone. */
export function shredFile(path: string, rnd: (n: number) => Buffer = (n) => randomBytes(n)): boolean {
  const size = Math.max(statSync(path).size, 64);
  for (let pass = 0; pass < 2; pass++) {
    const fd = openSync(path, 'r+');
    try {
      writeSync(fd, rnd(size), 0, size, 0);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  }
  unlinkSync(path);
  return !existsSync(path);
}

export interface ImportResult {
  imported: boolean;
  verified: boolean;
  shredded: boolean;
}

/**
 * One-time adoption of an owner secret already registered on the server (M0). Reads the file by
 * path, never prints it, stores it, verifies the read-back, and shreds the file ONLY after the
 * verification passed. Refuses if a store already exists with a DIFFERENT secret (never
 * overwrites); if the store already holds the same secret, just shreds the file.
 */
export function importOwnerSecretFromFile(filePath: string, peerId: string, deps: OwnerSecretDeps = electronDeps()): ImportResult {
  if (!PEER_ID_RE.test(peerId)) throw new OwnerSecretUnavailableError('[owner-secret] bad peer id');
  const raw = readFileSync(filePath, 'utf8').trim();
  if (!SECRET_RE.test(raw)) {
    throw new OwnerSecretUnavailableError('[owner-secret] import file is not 64 lowercase hex characters; not imported, file kept');
  }
  const existing = readStore(deps, peerId);
  if (existing !== null && existing !== raw) {
    throw new OwnerSecretUnavailableError('[owner-secret] a DIFFERENT owner secret is already stored; import refused, both kept');
  }
  if (existing === null) writeStoreVerified(deps, peerId, raw);
  const verified = readStore(deps, peerId) === raw;
  if (!verified) return { imported: existing === null, verified: false, shredded: false };
  const shredded = shredFile(filePath, (n) => Buffer.concat([deps.random32(), randomBytes(Math.max(0, n - 32))]).subarray(0, n));
  deps.log(`[owner-secret] import verified for peer ${peerId}; import file shredded=${shredded}`);
  return { imported: existing === null, verified: true, shredded };
}

const _cache = new Map<string, string>();

/** For tests only. */
export function _resetOwnerSecretCacheForTests(): void {
  _cache.clear();
}

/**
 * This install's owner secret for `peerId`. Throws OwnerSecretUnavailableError when it cannot be
 * read or safely created; callers fail closed (skip the write, never fall back to direct table
 * access).
 */
export function getPresenceOwnerSecret(peerId: string, deps: OwnerSecretDeps = electronDeps()): string {
  const cached = _cache.get(peerId);
  if (cached) return cached;
  if (!PEER_ID_RE.test(peerId)) throw new OwnerSecretUnavailableError(`[owner-secret] bad peer id ${peerId}`);

  let secret = readStore(deps, peerId);
  if (secret !== null) {
    // The store may have been written before this build ran (on M0 the MIC-side one-time import
    // wrote it so the live MIC scripts keep working), with the import file deliberately KEPT until
    // the app itself can read the store. Now it can: if the import file holds the SAME secret, it
    // is shredded here, after this process's own safeStorage read verified it. A different secret
    // is never adopted and never shredded; it is logged and left for a human.
    const importPath = m0ImportFilePath(deps, peerId);
    if (existsSync(importPath)) {
      try {
        importOwnerSecretFromFile(importPath, peerId, deps);
      } catch (err) {
        deps.log(`[owner-secret] leftover import file NOT shredded: ${(err as Error).message}`);
      }
    }
  }
  if (secret === null) {
    const importPath = m0ImportFilePath(deps, peerId);
    if (existsSync(importPath)) {
      const r = importOwnerSecretFromFile(importPath, peerId, deps);
      if (!r.verified) throw new OwnerSecretUnavailableError('[owner-secret] M0 import did not verify; file kept');
      secret = readStore(deps, peerId);
    } else {
      const fresh = deps.random32();
      if (fresh.length !== 32) throw new OwnerSecretUnavailableError('[owner-secret] random source returned the wrong length');
      writeStoreVerified(deps, peerId, fresh.toString('hex'));
      deps.log(`[owner-secret] generated a new presence owner secret for peer ${peerId}`);
      secret = readStore(deps, peerId);
    }
  }
  if (!secret) throw new OwnerSecretUnavailableError('[owner-secret] no owner secret after load');
  _cache.set(peerId, secret);
  return secret;
}
