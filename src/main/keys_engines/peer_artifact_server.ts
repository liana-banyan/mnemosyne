/**
 * peer_artifact_server.ts -- Keys and Engines: serve installer bytes + hash to paired Frames
 * BP087 Wave 4 · Frame-to-Frame Wildfire Propagation
 *
 * Listens on PEER_ARTIFACT_PORT (default 47213).
 * Routes:
 *   GET /hash/:version       -> JSON { peerId, hash } (socceri-hash of local installer bytes)
 *   GET /artifact/:version   -> binary stream of local installer file
 *   GET /health              -> JSON { ok: true, peerId }
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { homedir } from 'node:os';

const PEER_ARTIFACT_PORT = parseInt(process.env.PEER_ARTIFACT_PORT ?? '47213', 10);
const ARTIFACT_CACHE_DIR = join(homedir(), '.lb_substrate', 'artifact_cache');
const FRAME_ID = process.env.LB_FRAME_ID ?? 'unknown';

function getArtifactPath(version: string): string {
  return join(ARTIFACT_CACHE_DIR, `MnemosyneC-Setup-${version}.exe`);
}

function computeLocalHash(version: string): string | null {
  const artifactPath = getArtifactPath(version);
  if (!existsSync(artifactPath)) return null;
  const bytes = readFileSync(artifactPath);
  return createHash('sha512').update(bytes).digest('hex');
}

export function startPeerArtifactServer(): void {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? '/';

    if (url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, peerId: FRAME_ID }));
      return;
    }

    const hashMatch = url.match(/^\/hash\/(.+)$/);
    if (hashMatch) {
      const version = decodeURIComponent(hashMatch[1]);
      const hash = computeLocalHash(version);
      if (!hash) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'artifact not in local cache' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ peerId: FRAME_ID, hash }));
      return;
    }

    const artifactMatch = url.match(/^\/artifact\/(.+)$/);
    if (artifactMatch) {
      const version = decodeURIComponent(artifactMatch[1]);
      const artifactPath = getArtifactPath(version);
      if (!existsSync(artifactPath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'artifact not in local cache' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      createReadStream(artifactPath).pipe(res);
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  server.listen(PEER_ARTIFACT_PORT, () => {
    console.log(`[PeerArtifactServer] Listening on port ${PEER_ARTIFACT_PORT} (Frame: ${FRAME_ID})`);
  });
}
