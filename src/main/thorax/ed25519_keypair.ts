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
import { app } from 'electron';

const STORE_FILENAME = 'thorax_ed25519.json';

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
    try {
      const raw = readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<Ed25519Keypair>;
      if (
        typeof parsed.public_key_hex === 'string' && parsed.public_key_hex.length > 0 &&
        typeof parsed.private_key_hex === 'string' && parsed.private_key_hex.length > 0
      ) {
        return parsed as Ed25519Keypair;
      }
    } catch {
      // Fall through to regenerate if file is corrupt
    }
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
  writeFileSync(filePath, JSON.stringify(keypair), 'utf8');

  console.log('[Thorax] Generated new Ed25519 keypair and persisted to userData');
  return keypair;
}
