/**
 * circle_query.ts -- Keys and Engines: query paired Frames for their hash confirmation
 * BP087 Wave 4 · 2-of-3 quorum
 *
 * Each paired Frame runs a peer_artifact_server on a high port.
 * circle_query asks each: "what is your confirmed hash for version X?"
 * Returns: array of { peerId, hash, ok } from each peer.
 */

import { request as httpRequest } from 'node:http';

export interface PeerHashResponse {
  peerId: string;
  hash: string;
  ok: boolean;
  error?: string;
}

/**
 * Query a single peer Frame for its confirmed hash for a given version.
 * Peer must be running peer_artifact_server (SEG-KE-epsilon).
 */
export async function queryPeerHash(
  peerAddress: string, // host:port e.g. "192.168.1.42:47213"
  version: string,
  timeoutMs = 5000,
): Promise<PeerHashResponse> {
  return new Promise((resolve) => {
    const [host, portStr] = peerAddress.split(':');
    const port = parseInt(portStr, 10);

    const req = httpRequest(
      { host, port, path: `/hash/${encodeURIComponent(version)}`, method: 'GET', timeout: timeoutMs },
      (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => {
          try {
            const json = JSON.parse(data) as { peerId: string; hash: string };
            resolve({ peerId: json.peerId, hash: json.hash, ok: true });
          } catch {
            resolve({ peerId: peerAddress, hash: '', ok: false, error: 'parse error' });
          }
        });
      },
    );

    req.on('error', (err: Error) => {
      resolve({ peerId: peerAddress, hash: '', ok: false, error: err.message });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ peerId: peerAddress, hash: '', ok: false, error: 'timeout' });
    });

    req.end();
  });
}

/**
 * Query all peers in the Circle and return their hash responses.
 */
export async function queryCircleHashes(
  peerAddresses: string[],
  version: string,
): Promise<PeerHashResponse[]> {
  return Promise.all(peerAddresses.map((addr) => queryPeerHash(addr, version)));
}
