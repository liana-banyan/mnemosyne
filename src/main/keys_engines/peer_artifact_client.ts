/**
 * peer_artifact_client.ts -- Keys and Engines: download artifact from paired Frame
 * BP087 Wave 4 · Frame-to-Frame Wildfire Propagation · server-bypass
 *
 * Before downloading from mnemosynec.ai, check if any Circle peer has the artifact.
 * If yes: pull from peer directly (server bandwidth = 0 for this Frame).
 * If no: fall back to server download.
 */

import { request as httpRequest } from 'node:http';
import { createWriteStream, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const ARTIFACT_CACHE_DIR = join(homedir(), '.lb_substrate', 'artifact_cache');

export interface PeerArtifactResult {
  source: 'peer' | 'server';
  peerId?: string;
  localPath?: string;
  error?: string;
}

/**
 * Check if a peer has the artifact for a given version.
 * Returns the peer address if available, null otherwise.
 */
export async function findPeerWithArtifact(
  peerAddresses: string[],
  version: string,
  timeoutMs = 3000,
): Promise<string | null> {
  const checks = peerAddresses.map((addr) =>
    new Promise<string | null>((resolve) => {
      const [host, portStr] = addr.split(':');
      const port = parseInt(portStr, 10);
      const req = httpRequest(
        { host, port, path: `/hash/${encodeURIComponent(version)}`, method: 'GET', timeout: timeoutMs },
        (res) => {
          let data = '';
          res.on('data', (c: Buffer) => { data += c.toString(); });
          res.on('end', () => {
            try {
              const json = JSON.parse(data) as { hash?: string };
              resolve(json.hash ? addr : null);
            } catch {
              resolve(null);
            }
          });
        },
      );
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.end();
    }),
  );
  const results = await Promise.all(checks);
  return results.find((r) => r !== null) ?? null;
}

/**
 * Download artifact from a peer Frame to local ARTIFACT_CACHE_DIR.
 * Returns local file path on success.
 */
export async function downloadFromPeer(
  peerAddress: string,
  version: string,
): Promise<string> {
  mkdirSync(ARTIFACT_CACHE_DIR, { recursive: true });
  const destPath = join(ARTIFACT_CACHE_DIR, `MnemosyneC-Setup-${version}.exe`);

  return new Promise((resolve, reject) => {
    const [host, portStr] = peerAddress.split(':');
    const port = parseInt(portStr, 10);
    const req = httpRequest(
      { host, port, path: `/artifact/${encodeURIComponent(version)}`, method: 'GET' },
      (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Peer returned ${res.statusCode}`));
          return;
        }
        const writer = createWriteStream(destPath);
        res.pipe(writer);
        writer.on('finish', () => resolve(destPath));
        writer.on('error', reject);
      },
    );
    req.on('error', reject);
    req.end();
  });
}
