/**
 * eblet_package_fetcher.ts -- Lazy Eblet Package Fetcher
 * BP087 Wave 5 -- Wildfire peer-first, server fallback
 *
 * Canon ref: SEG-CL-beta -- Wildfire peer-first download with bonfire server fallback
 */

import { mkdirSync, createWriteStream } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { findPeerWithArtifact, downloadFromPeer } from '../keys_engines/peer_artifact_client';
import { getCircleMembership } from '../keys_engines/circle_membership';
import { updateManifest } from './manifest_updater';
import { getFolderPath, FOLDER_MANIFEST } from './folder_bootstrap';

// ---- Types ------------------------------------------------------------------

export interface FetchResult {
  slug: string;
  source: 'peer' | 'server' | 'error';
  peerId?: string;
  error?: string;
}

// ---- Constants --------------------------------------------------------------

const LB_SUBSTRATE_ROOT = join(homedir(), '.lb_substrate');

// Default bonfire endpoint -- overridden by CAI_BONFIRE_ENDPOINT env var
function bonfireEndpoint(): string {
  return process.env.CAI_BONFIRE_ENDPOINT ?? 'https://bonfire.lianabanyan.com';
}

// ---- Helpers ----------------------------------------------------------------

function downloadUrl(slug: string): string {
  return `${bonfireEndpoint()}/packages/${encodeURIComponent(slug)}.tar.gz`;
}

/**
 * Download a tar.gz package from the bonfire server via HTTP/HTTPS.
 * Writes to ~/.lb_substrate/<slug>/<slug>.tar.gz.
 * Returns path on success.
 */
async function downloadFromServer(slug: string): Promise<string> {
  const folderPath = getFolderPath(slug);
  mkdirSync(folderPath, { recursive: true });
  const destPath = join(folderPath, `${slug}.tar.gz`);
  const url = downloadUrl(slug);

  return new Promise((resolve, reject) => {
    const requester = url.startsWith('https') ? httpsRequest : httpRequest;
    const req = requester(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Server returned ${res.statusCode} for ${slug}`));
        return;
      }
      const writer = createWriteStream(destPath);
      res.pipe(writer);
      writer.on('finish', () => resolve(destPath));
      writer.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

// ---- Public API -------------------------------------------------------------

/**
 * Fetch a category package: peer-first (Wildfire), then bonfire server fallback.
 * On success updates the folder manifest soccerball hash.
 */
export async function fetchCategoryPackage(slug: string): Promise<FetchResult> {
  // 1. Get circle peers for peer-first lookup
  let peerAddresses: string[] = [];
  try {
    const circle = await getCircleMembership();
    peerAddresses = circle.peers.map((p) => p.address);
  } catch {
    // Non-fatal -- fall through to server
  }

  // 2. Try peer download (Wildfire)
  if (peerAddresses.length > 0) {
    try {
      const peerAddr = await findPeerWithArtifact(peerAddresses, slug);
      if (peerAddr) {
        const localPath = await downloadFromPeer(peerAddr, slug);
        console.log(`[Catacombs] Fetched ${slug} from peer ${peerAddr}`);
        await updateManifest(slug, `peer-fetch-${Date.now()}`).catch(() => {});
        return { slug, source: 'peer', peerId: peerAddr };
      }
    } catch (err) {
      console.warn(`[Catacombs] Peer fetch failed for ${slug}:`, err);
    }
  }

  // 3. Fallback: bonfire server download
  try {
    await downloadFromServer(slug);
    console.log(`[Catacombs] Fetched ${slug} from bonfire server`);
    await updateManifest(slug, `server-fetch-${Date.now()}`).catch(() => {});
    return { slug, source: 'server' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Catacombs] Server fetch failed for ${slug}:`, msg);
    return { slug, source: 'error', error: msg };
  }
}

/**
 * Pre-fetch all 14 MMLU-Pro category packages (01-14, not 15_USER or 16_LIANA_BANYAN).
 * Runs concurrently via Promise.allSettled.
 */
export async function prefetchAll(): Promise<FetchResult[]> {
  const mmluSlugs = FOLDER_MANIFEST.slice(0, 14); // 01_biology .. 14_psychology
  const results = await Promise.allSettled(mmluSlugs.map((slug) => fetchCategoryPackage(slug)));
  return results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    return { slug: mmluSlugs[i], source: 'error' as const, error: String(r.reason) };
  });
}
