/**
 * peer_artifact_client.ts -- Keys and Engines: download artifact from paired Frame
 * BP087 Wave 4 · Frame-to-Frame Wildfire Propagation · server-bypass
 *
 * Before downloading from mnemosynec.ai, check if any Circle peer has the artifact.
 * If yes: pull from peer directly (server bandwidth = 0 for this Frame).
 * If no: fall back to server download.
 */

import { request as httpRequest } from 'node:http';
import { createWriteStream, mkdirSync, readFileSync, renameSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { homedir } from 'node:os';
// D-BP151-045: verify what a peer sends before it is accepted or stored. Reuses the SAME
// Thorax Ed25519 verify primitive federation/announce_frame.ts already uses to verify
// control-plane frames (no second crypto implementation) -- see peer_artifact_server.ts's
// signArtifactHash() for the matching send-side signer this checks against.
import { verifyFrame } from '../thorax/sign_verify';

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

interface SignedHashResponse {
  peerId?: string;
  hash?: string;
  publicKeyHex?: string;
  signedHex?: string;
  error?: string;
}

/** Same route peer_artifact_server.ts serves for findPeerWithArtifact() above, fetched again
 *  here (small, cheap GET) to get the fields that route needs: publicKeyHex/signedHex. Never
 *  throws -- resolves null on any network/parse failure, which downloadFromPeer() below treats
 *  as a refusal (fail closed, not fail open). */
function fetchSignedHash(host: string, port: number, version: string, timeoutMs = 5000): Promise<SignedHashResponse | null> {
  return new Promise((resolve) => {
    const req = httpRequest(
      { host, port, path: `/hash/${encodeURIComponent(version)}`, method: 'GET', timeout: timeoutMs },
      (res) => {
        let data = '';
        res.on('data', (c: Buffer) => { data += c.toString(); });
        res.on('end', () => {
          try { resolve(JSON.parse(data) as SignedHashResponse); } catch { resolve(null); }
        });
      },
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

function sha512File(filePath: string): string {
  return createHash('sha512').update(readFileSync(filePath)).digest('hex');
}

/**
 * Download artifact from a peer Frame to local ARTIFACT_CACHE_DIR.
 * Returns local file path on success.
 *
 * D-BP151-045: fail-closed verification, three gates, in order --
 *   1. Peer must return a hash at all (missing -> refused).
 *   2. That hash must carry a valid Ed25519 signature from the SAME peer, verified with
 *      thorax/sign_verify.ts's verifyFrame() (the exact primitive announce_frame.ts's
 *      verifyAnnounceFrame() wraps for control-plane frames) against the peer's self-declared
 *      public key -- the same trust-on-first-use floor peer_server.ts:370-374 already accepts
 *      for control-plane frames when no previously-learned key exists for the sender. No
 *      "known peer" key store is consulted here: which store (if any) should back a stronger
 *      check than TOFU for artifact-serving peers is a trust-model decision this ticket does
 *      not make -- see the SEG return's FORK section.
 *   3. The bytes actually downloaded must SHA-512-hash to the value that was signed (missing,
 *      unsigned, or mismatched -> refused; downloaded bytes are written to a TEMP path and only
 *      renamed into the real cache path after both checks above pass -- nothing partial or
 *      unverified is ever readable at the path callers expect).
 */
export async function downloadFromPeer(
  peerAddress: string,
  version: string,
): Promise<string> {
  mkdirSync(ARTIFACT_CACHE_DIR, { recursive: true });
  const destPath = join(ARTIFACT_CACHE_DIR, `MnemosyneC-Setup-${version}.exe`);
  const tmpPath = `${destPath}.download-${process.pid}-${Date.now()}.tmp`;
  const [host, portStr] = peerAddress.split(':');
  const port = parseInt(portStr, 10);

  // Gate 1 + 2: fetch and verify the SIGNED hash before trusting any bytes this peer sends.
  const signed = await fetchSignedHash(host, port, version);
  if (!signed || typeof signed.hash !== 'string' || signed.hash.length === 0) {
    const msg = `downloadFromPeer REFUSED ${peerAddress} v${version}: peer returned no hash (fail closed)`;
    console.warn(`[PeerArtifactClient] ${msg}`);
    throw new Error(msg);
  }
  if (typeof signed.publicKeyHex !== 'string' || signed.publicKeyHex.length === 0 ||
      typeof signed.signedHex !== 'string' || signed.signedHex.length === 0) {
    const msg = `downloadFromPeer REFUSED ${peerAddress} v${version}: peer's hash response carried no Ed25519 signature (fail closed)`;
    console.warn(`[PeerArtifactClient] ${msg}`);
    throw new Error(msg);
  }
  const canonical = `${version}:${signed.hash}`;
  const verified = verifyFrame(signed.signedHex, signed.publicKeyHex);
  if (!verified.valid || verified.frameHex !== canonical) {
    const msg = `downloadFromPeer REFUSED ${peerAddress} v${version}: signature verification failed (bad signature, tampered response, or wrong key)`;
    console.warn(`[PeerArtifactClient] ${msg}`);
    throw new Error(msg);
  }

  // Bytes go to a TEMP path first -- never write straight to the path a caller might read.
  await new Promise<void>((resolve, reject) => {
    const req = httpRequest(
      { host, port, path: `/artifact/${encodeURIComponent(version)}`, method: 'GET' },
      (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Peer returned ${res.statusCode}`));
          return;
        }
        const writer = createWriteStream(tmpPath);
        res.pipe(writer);
        writer.on('finish', () => resolve());
        writer.on('error', reject);
      },
    );
    req.on('error', reject);
    req.end();
  });

  // Gate 3: the bytes that actually arrived must hash to what was signed.
  let actualHash: string;
  try {
    actualHash = sha512File(tmpPath);
  } catch (err) {
    try { unlinkSync(tmpPath); } catch { /* best-effort cleanup */ }
    const msg = `downloadFromPeer REFUSED ${peerAddress} v${version}: could not hash downloaded bytes (${err instanceof Error ? err.message : String(err)})`;
    console.warn(`[PeerArtifactClient] ${msg}`);
    throw new Error(msg);
  }
  if (actualHash.toLowerCase() !== signed.hash.toLowerCase()) {
    try { unlinkSync(tmpPath); } catch { /* best-effort cleanup */ }
    const msg = `downloadFromPeer REFUSED ${peerAddress} v${version}: downloaded bytes do NOT match the signed hash (tampered in transit or on peer disk) -- deleted, never stored`;
    console.warn(`[PeerArtifactClient] ${msg}`);
    throw new Error(msg);
  }

  // Only now promote the verified bytes to the real cache path.
  renameSync(tmpPath, destPath);
  return destPath;
}
