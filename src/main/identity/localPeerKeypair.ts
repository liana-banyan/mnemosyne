// BP104 D3 — persistent peer_id via local Ed25519 keypair
// Keys live at %APPDATA%\MnemosyneC\keys\ — survive reinstall when install script preserves keys/

import { app } from 'electron';
import { createHash, generateKeyPairSync } from 'crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export interface LocalPeerKeypair {
  peerId: string;
  publicKeyHex: string;
}

function keysDir(): string {
  return join(app.getPath('appData'), 'MnemosyneC', 'keys');
}

function peerIdFromPublicHex(publicKeyHex: string): string {
  return createHash('sha256').update(publicKeyHex).digest('hex').slice(0, 16);
}

/** Generate or load Ed25519 keypair; never logs private key. */
export function ensureLocalPeerKeypair(): LocalPeerKeypair {
  const dir = keysDir();
  const privPath = join(dir, 'peer.ed25519.priv');
  const pubPath = join(dir, 'peer.ed25519.pub');

  mkdirSync(dir, { recursive: true, mode: 0o700 });

  if (existsSync(privPath) && existsSync(pubPath)) {
    const publicKeyHex = readFileSync(pubPath, 'utf8').trim();
    return { peerId: peerIdFromPublicHex(publicKeyHex), publicKeyHex };
  }

  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyHex = (publicKey.export({ type: 'spki', format: 'der' }) as Buffer).toString('hex');
  const privateKeyHex = (privateKey.export({ type: 'pkcs8', format: 'der' }) as Buffer).toString('hex');

  writeFileSync(privPath, privateKeyHex, { mode: 0o600 });
  writeFileSync(pubPath, publicKeyHex, { mode: 0o644 });
  try {
    chmodSync(privPath, 0o600);
  } catch {
    // Windows may ignore POSIX mode bits
  }

  return { peerId: peerIdFromPublicHex(publicKeyHex), publicKeyHex };
}
