// BP104 D3 — persistent peer_id via local Ed25519 keypair
// K-D6-6-9 BP105 — 3-layer defense: idempotent load + cross-user-context lookup + ProgramData backup
//
// Keys live at %APPDATA%\MnemosyneC\keys\ — survive reinstall when install script preserves keys/
// Cross-user-context fallback: checks %LOCALAPPDATA%, %PROGRAMDATA%, and all user profiles
// before generating fresh (protects against NSIS upgrade wiping per-user AppData)

import { app } from 'electron';
import { createHash, generateKeyPairSync } from 'crypto';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface LocalPeerKeypair {
  peerId: string;
  publicKeyHex: string;
}

function canonicalKeysDir(): string {
  return join(app.getPath('appData'), 'MnemosyneC', 'keys');
}

function peerIdFromPublicHex(publicKeyHex: string): string {
  return createHash('sha256').update(publicKeyHex).digest('hex').slice(0, 16);
}

/** Returns all candidate key directory paths to check for an existing keypair.
 *  Ordered from most-preferred to least. Checked before generating fresh. */
function candidateKeysDirs(): string[] {
  const dirs: string[] = [];

  // 1. Canonical current-user Roaming (primary)
  try { dirs.push(join(app.getPath('appData'), 'MnemosyneC', 'keys')); } catch { /* pre-ready */ }

  // 2. LocalAppData (some Electron templates write here)
  const localAppData = process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local');
  dirs.push(join(localAppData, 'MnemosyneC', 'keys'));

  // 3. ProgramData machine-scope (written by app on fresh generation for cross-user resilience)
  const programData = process.env.PROGRAMDATA ?? 'C:\\ProgramData';
  dirs.push(join(programData, 'MnemosyneC', 'keys'));

  // 4. Enumerate all Windows user profiles (fallback for admin-installed, user-running scenario)
  try {
    const usersRoot = 'C:\\Users';
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

/** Try to load keypair from a specific directory. Returns null if not found or unreadable. */
function tryLoadKeypair(dir: string): LocalPeerKeypair | null {
  const privPath = join(dir, 'peer.ed25519.priv');
  const pubPath = join(dir, 'peer.ed25519.pub');
  if (!existsSync(privPath) || !existsSync(pubPath)) return null;
  try {
    const publicKeyHex = readFileSync(pubPath, 'utf8').trim();
    if (!publicKeyHex || publicKeyHex.length < 32) return null;
    return { peerId: peerIdFromPublicHex(publicKeyHex), publicKeyHex };
  } catch {
    return null;
  }
}

/** Save keypair to canonical current-user path. */
function saveToCanonicalDir(dir: string, publicKeyHex: string, privateKeyHex: string): void {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const privPath = join(dir, 'peer.ed25519.priv');
  const pubPath = join(dir, 'peer.ed25519.pub');
  writeFileSync(privPath, privateKeyHex, { mode: 0o600 });
  writeFileSync(pubPath, publicKeyHex, { mode: 0o644 });
  try { chmodSync(privPath, 0o600); } catch { /* Windows ignores POSIX mode bits */ }
}

/** Try to save keypair to ProgramData machine-scope (for cross-user resilience on future upgrades). */
function trySaveToProgramData(publicKeyHex: string, privateKeyHex: string): void {
  try {
    const programData = process.env.PROGRAMDATA ?? 'C:\\ProgramData';
    const pgDir = join(programData, 'MnemosyneC', 'keys');
    mkdirSync(pgDir, { recursive: true });
    const privPath = join(pgDir, 'peer.ed25519.priv');
    const pubPath = join(pgDir, 'peer.ed25519.pub');
    writeFileSync(privPath, privateKeyHex);
    writeFileSync(pubPath, publicKeyHex);
    console.log('[D3] keypair backup saved to ProgramData · cross-user resilience active');
  } catch {
    // Non-fatal — non-admin installs may not have write access to ProgramData
    console.log('[D3] ProgramData backup skipped (non-admin install — graceful)');
  }
}

/** Generate or load Ed25519 keypair; never logs private key.
 *  Layer 2: idempotent load — NEVER regenerates when key files are present.
 *  Layer 3: cross-user-context lookup — checks ProgramData + all user profiles before generating fresh.
 *  [BOOT-GATE] D3-keypair logs on every load/generate for gadget-verifiable empirical proof. */
export function ensureLocalPeerKeypair(): LocalPeerKeypair {
  const canonicalDir = canonicalKeysDir();
  console.log('[BOOT-GATE] D3-keypair CHECKING canonical=' + canonicalDir);

  // Layer 2: idempotent load — check canonical dir first
  const canonical = tryLoadKeypair(canonicalDir);
  if (canonical) {
    console.log('[D3] loaded existing keypair · peer_id=' + canonical.peerId + ' · source=AppData-canonical');
    // Also ensure ProgramData backup exists for future upgrade resilience
    const programData = process.env.PROGRAMDATA ?? 'C:\\ProgramData';
    const pgPriv = join(programData, 'MnemosyneC', 'keys', 'peer.ed25519.priv');
    if (!existsSync(pgPriv)) {
      try {
        const privPath = join(canonicalDir, 'peer.ed25519.priv');
        const pubPath = join(canonicalDir, 'peer.ed25519.pub');
        const pgDir = join(programData, 'MnemosyneC', 'keys');
        mkdirSync(pgDir, { recursive: true });
        copyFileSync(privPath, join(pgDir, 'peer.ed25519.priv'));
        copyFileSync(pubPath, join(pgDir, 'peer.ed25519.pub'));
        console.log('[D3] ProgramData backup created from canonical (upgrade resilience)');
      } catch { /* non-fatal — non-admin skips gracefully */ }
    }
    return canonical;
  }

  // Layer 3: cross-user-context lookup — check all candidates before generating fresh
  const allCandidates = candidateKeysDirs();
  for (const dir of allCandidates) {
    if (dir === canonicalDir) continue; // already checked above
    const found = tryLoadKeypair(dir);
    if (found) {
      console.log('[D3] loaded existing keypair · peer_id=' + found.peerId + ' · source=' + dir + ' (cross-user-context restore)');
      // Copy to canonical path so future loads are direct
      try {
        mkdirSync(canonicalDir, { recursive: true, mode: 0o700 });
        copyFileSync(join(dir, 'peer.ed25519.priv'), join(canonicalDir, 'peer.ed25519.priv'));
        copyFileSync(join(dir, 'peer.ed25519.pub'), join(canonicalDir, 'peer.ed25519.pub'));
        console.log('[D3] keypair copied to canonical AppData path · subsequent loads will be direct');
      } catch { /* non-fatal — still return the found keypair */ }
      return found;
    }
  }

  // All candidates empty — generate fresh keypair
  console.log('[D3] no existing keypair found in any candidate path — generating fresh Ed25519 keypair');
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyHex = (publicKey.export({ type: 'spki', format: 'der' }) as Buffer).toString('hex');
  const privateKeyHex = (privateKey.export({ type: 'pkcs8', format: 'der' }) as Buffer).toString('hex');

  // Save to canonical current-user path
  saveToCanonicalDir(canonicalDir, publicKeyHex, privateKeyHex);

  // Save to ProgramData machine-scope for cross-user resilience on future upgrades
  trySaveToProgramData(publicKeyHex, privateKeyHex);

  const peerId = peerIdFromPublicHex(publicKeyHex);
  console.log('[D3] generated fresh keypair · peer_id=' + peerId);
  console.log('[BOOT-GATE] D3-keypair PASS · peer_id=' + peerId);

  return { peerId, publicKeyHex };
}
