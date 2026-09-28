/**
 * ed25519_keypair.ts -- MAMBA-beta3: Ed25519 Thorax PKI
 *
 * Generates an Ed25519 keypair on first launch and persists it to the
 * Electron userData directory so it survives restarts. On subsequent
 * launches the stored keypair is loaded instead of regenerated.
 *
 * Storage: <userData>/thorax_ed25519.json
 * Keys are DER-encoded and stored as lowercase hex strings.
 *
 * Canon ref: MAMBA-beta3 BP087
 */

import { generateKeyPairSync } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { app, safeStorage, dialog } from 'electron';

/** D-BP223-BM0-X030-073 P4: thrown instead of writing the mesh identity key in plain JSON. */
export class MeshIdentityUnavailableError extends Error {
  readonly code = 'MESH_IDENTITY_UNAVAILABLE';
  constructor(readonly filePath: string) {
    super(`[Thorax] Windows encrypted storage is unavailable, so the mesh identity key was NOT written (${filePath}). ` +
      'REFUSING to store a private key in plain JSON. MnemosyneC runs without a mesh identity until encrypted storage works.');
    this.name = 'MeshIdentityUnavailableError';
  }
}

export const MESH_IDENTITY_UNAVAILABLE_MESSAGE =
  'Mesh identity is off on this computer.\n\n' +
  'Windows encrypted storage is not available to MnemosyneC right now, so it will not save your mesh identity key ' +
  'in a readable file. Everything else keeps working; sharing with your other machines is off until this is fixed.\n\n' +
  'Usually fixed by signing in to Windows normally (not a temporary or service account) and restarting MnemosyneC.';

let _meshIdentityUnavailableShown = false;
let _meshIdentityStatus: { available: boolean; reason: string | null } = { available: true, reason: null };

/** D-BP223-BM0-X030-073 P4: whether this process has a mesh identity, and why not. */
export function getMeshIdentityStatus(): { available: boolean; reason: string | null } {
  return { ..._meshIdentityStatus };
}

/** Logs every time; shows the message once per run (non-blocking) when the app window system is ready. */
export function reportMeshIdentityUnavailable(filePath: string): void {
  _meshIdentityStatus = { available: false, reason: 'safeStorage unavailable; key not written in plain JSON' };
  console.error(`[Thorax] REFUSED plain-JSON mesh identity key at ${filePath}: safeStorage unavailable (X030-073 P4)`);
  if (_meshIdentityUnavailableShown) return;
  _meshIdentityUnavailableShown = true;
  try {
    if (app && typeof app.isReady === 'function' && app.isReady() && dialog && typeof dialog.showMessageBox === 'function') {
      void dialog.showMessageBox({ type: 'warning', title: 'MnemosyneC: mesh identity off', message: MESH_IDENTITY_UNAVAILABLE_MESSAGE, buttons: ['OK'] });
    }
  } catch { /* the console line above is the record */ }
}

const STORE_FILENAME = 'thorax_ed25519.json';

/**
 * D-BP158-M0-007. THE DEFECT THIS FIXES, MEASURED at BP158.
 *
 * This file is written in TWO formats. Older installs hold plain JSON. Since 2026-07-22 it is
 * written through Electron `safeStorage`, whose Windows output begins with the ASCII bytes "v10".
 * The previous reader only understood plain JSON, and its catch block "fell through to regenerate
 * if file is corrupt" -- then wrote the new key OVER the file it had just failed to read.
 *
 * So a perfectly good encrypted key was silently destroyed on startup and replaced with a fresh
 * identity. Measured on M0: the ruled 257-byte encrypted key (sha256 160be78f...) was replaced by
 * a new 226-byte plain-JSON key (sha256 e6725b98...) the first time the app launched after the
 * userData migration pointed it at the encrypted copy.
 *
 * TWO RULES NOW HOLD, and the second matters more than the first:
 *   1. Read BOTH formats.
 *   2. NEVER overwrite an existing key file that could not be read. Unreadable is not absent.
 *      Destroying a key you cannot parse is the worst available outcome: it is unrecoverable,
 *      it is silent, and it breaks every peer that trusted the old identity. If the file exists
 *      and cannot be read, this THROWS and the operator decides.
 */
const SAFE_STORAGE_PREFIXES = ['v10', 'v11'];

function looksEncrypted(buf: Buffer): boolean {
  return SAFE_STORAGE_PREFIXES.includes(buf.subarray(0, 3).toString('latin1'));
}

function parseKeypairJson(text: string): Ed25519Keypair | null {
  try {
    const parsed = JSON.parse(text) as Partial<Ed25519Keypair>;
    if (
      typeof parsed.public_key_hex === 'string' && parsed.public_key_hex.length > 0 &&
      typeof parsed.private_key_hex === 'string' && parsed.private_key_hex.length > 0
    ) {
      return parsed as Ed25519Keypair;
    }
  } catch {
    return null;
  }
  return null;
}

export interface Ed25519Keypair {
  public_key_hex: string;
  private_key_hex: string;
}

/**
 * Returns the persisted Ed25519 keypair for this peer.
 * On first call: generates a fresh keypair, saves it to <userData>/thorax_ed25519.json, returns it.
 * On subsequent calls: loads from disk, returns without regenerating.
 */
export function getOrCreateKeypair(): Ed25519Keypair {
  const userDataDir = app.getPath('userData');
  const filePath = join(userDataDir, STORE_FILENAME);

  if (existsSync(filePath)) {
    const buf = readFileSync(filePath);

    if (looksEncrypted(buf)) {
      // safeStorage format. Decryption failure here is NOT a reason to regenerate: on Windows the
      // blob is DPAPI-bound to this user account, so a failure means wrong account or a broken
      // credential store, and the key itself is probably fine. Refuse and let the operator decide.
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error(
          `[Thorax] ${filePath} is safeStorage-encrypted but safeStorage is unavailable in this ` +
          `process. REFUSING to regenerate: that would destroy a recoverable key and change this ` +
          `peer's signing identity.`,
        );
      }
      let decrypted: string;
      try {
        decrypted = safeStorage.decryptString(buf);
      } catch (e) {
        throw new Error(
          `[Thorax] ${filePath} is safeStorage-encrypted and could not be decrypted (${String(e)}). ` +
          `REFUSING to regenerate over it. The key may still be recoverable under the correct user ` +
          `account; regenerating would silently change this peer's signing identity.`,
        );
      }
      const kp = parseKeypairJson(decrypted);
      if (kp) return kp;
      throw new Error(
        `[Thorax] ${filePath} decrypted but did not contain a valid keypair. REFUSING to regenerate ` +
        `over an existing key file.`,
      );
    }

    const kp = parseKeypairJson(buf.toString('utf8'));
    if (kp) return kp;

    throw new Error(
      `[Thorax] ${filePath} exists but is neither valid JSON nor a safeStorage blob. REFUSING to ` +
      `regenerate over it. Unreadable is not absent: move the file aside deliberately if you truly ` +
      `intend a new identity.`,
    );
  }

  // D-BP223-BM0-X030-073 P4 (XO X030 pick on Founder k/0a8d1c96): if Windows encrypted storage is unavailable, REFUSE to
  // write the mesh identity key in plain JSON. Checked BEFORE a key is generated, so no private key ever exists
  // unencrypted in memory-to-disk form. The app runs without a mesh identity until encrypted storage works again: every
  // caller already treats a throw here as "keypair unavailable" (signAnnouncePayload fails soft, presence publishes
  // without public_key_hex). A clear message is shown once.
  if (!safeStorage.isEncryptionAvailable()) {
    reportMeshIdentityUnavailable(filePath);
    throw new MeshIdentityUnavailableError(filePath);
  }

  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });

  const keypair: Ed25519Keypair = { // gitleaks:allow
    public_key_hex: (publicKey as Buffer).toString('hex'),
    private_key_hex: (privateKey as Buffer).toString('hex'),
  };

  mkdirSync(userDataDir, { recursive: true });

  // Write encrypted when we can, matching the format the 2026-07-22 fix introduced. Writing plain
  // JSON here is what left a private key readable on disk in the first place.
  // X030-073 P4: the plain-JSON write path is removed. Encrypted storage was confirmed available above; if it vanished in
  // between, encryptString throws and nothing is written.
  const plaintext = JSON.stringify(keypair);
  writeFileSync(filePath, safeStorage.encryptString(plaintext));
  console.log('[Thorax] Generated new Ed25519 keypair, persisted ENCRYPTED to userData');
  return keypair;
}
