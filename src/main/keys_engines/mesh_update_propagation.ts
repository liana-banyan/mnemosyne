/**
 * mesh_update_propagation.ts -- Keys and Engines: node-to-node update propagation
 * BP134 Yoke #29 Part 2 ("then each node can update every other node so it is much faster")
 *
 * Detects peers advertising a newer semver in peer_presence and -- ONLY when the user has
 * granted consent (Part 1's AutoUpdateConfig.autoUpdates toggle; enforced by the caller,
 * not this module) -- pulls the installer bytes from that peer's artifact_server_address
 * over LAN/mesh instead of the canonical site.
 *
 * SECURITY (non-negotiable, per BP134 Founder directive): a peer's binary is NEVER
 * installed on its own say-so. A peer's self-reported hash (peer_artifact_server.ts's
 * GET /hash/:version route, which returns a SHA-512 of whatever bytes the peer happens to
 * have on disk) is treated as UNTRUSTED. This module re-hashes the actually-downloaded
 * bytes itself with SHA-256 and compares against the canonical site manifest hash supplied
 * by the caller (fetched independently from https://mnemosynec.org/version_trust.json --
 * see auto_update_scheduler.ts's checkAndMaybeDownload, which is the sole intended caller).
 * Any mismatch -> the downloaded file is deleted and that peer is skipped, never installed.
 *
 * Builds on BP087 Wave 4 scaffolding that already existed in this directory
 * (peer_artifact_client.ts / peer_artifact_server.ts / circle_query.ts / quorum_check.ts)
 * but was never wired to an actual update flow and never cross-checked a downloaded
 * artifact against a canonical/independent source -- see the BP134 Yoke #29 report for
 * the full inventory of what pre-existed vs. what this file adds.
 */

import { createHash } from 'node:crypto';
import { readFileSync, existsSync, mkdirSync, copyFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { getAnonKey, getSupabaseUrl } from '../shared/anon_key';
import { findPeerWithArtifact, downloadFromPeer } from './peer_artifact_client';

/** Must match peer_artifact_client.ts / peer_artifact_server.ts's cache location exactly --
 *  downloadFromPeer() already writes here, so a successful peer pull self-seeds this node's
 *  own cache (it can now re-serve that version onward to other peers with no extra step). */
const ARTIFACT_CACHE_DIR = join(homedir(), '.lb_substrate', 'artifact_cache');

/** A peer_presence row is only considered "live" within this window (peer_server.ts
 *  publishes presence every 60s -- 5 minutes gives generous margin for a missed beat
 *  without treating a genuinely-gone peer as reachable). */
const PEER_PRESENCE_STALE_MS = 5 * 60 * 1000;

export interface NewerPeer {
  peerId: string;
  machineLabel: string | null;
  version: string;
  /** Full address as advertised in peer_presence, e.g. "http://192.168.1.42:47213" */
  artifactServerAddress: string;
}

export interface CanonicalManifestEntry {
  version: string;
  url: string;
  sha256: string;
}

export interface MeshPullResult {
  ok: boolean;
  peerId?: string;
  /** Local path of the verified file (inside ARTIFACT_CACHE_DIR) on success. */
  localPath?: string;
  error?: string;
}

// ─── Semver ────────────────────────────────────────────────────────────────────
// Deliberately duplicated (not imported) from auto_update_scheduler.ts's private
// semverGt: that file is this module's sole intended caller, and importing back from
// it would create a circular module dependency. Keep this in sync if the comparison
// logic ever changes (3-part numeric only, matches the rest of this codebase).

export function semverGt(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false;
  }
  return false;
}

// ─── Peer version detection ───────────────────────────────────────────────────

interface PeerPresenceRow {
  peer_id: string;
  version: string | null;
  machine_label: string | null;
  artifact_server_address: string | null;
  last_seen_at: string | null;
}

/**
 * Query peer_presence for active peers advertising a strictly newer semver than
 * `currentVersion`, each with a usable artifact_server_address. Newest-first.
 * Never throws -- returns [] on any network/config failure (same "empty means no live
 * peers right now, not an error" contract as presence_autoconnect.ts).
 */
export async function findNewerPeers(currentVersion: string): Promise<NewerPeer[]> {
  const url = getSupabaseUrl();
  const anonKey = getAnonKey();
  if (!url || !anonKey) return [];

  try {
    const res = await fetch(
      `${url}/rest/v1/peer_presence?state=eq.active` +
        `&select=peer_id,version,machine_label,artifact_server_address,last_seen_at`,
      {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) return [];

    const rows = (await res.json()) as PeerPresenceRow[];
    const now = Date.now();

    const candidates: NewerPeer[] = rows
      .filter((r): r is PeerPresenceRow & { version: string; artifact_server_address: string; last_seen_at: string } =>
        !!r.version && !!r.artifact_server_address && !!r.last_seen_at)
      .filter((r) => {
        const age = now - new Date(r.last_seen_at).getTime();
        return age >= 0 && age < PEER_PRESENCE_STALE_MS;
      })
      .filter((r) => semverGt(r.version, currentVersion))
      .map((r) => ({
        peerId: r.peer_id,
        machineLabel: r.machine_label,
        version: r.version,
        artifactServerAddress: r.artifact_server_address,
      }));

    candidates.sort((a, b) => (semverGt(a.version, b.version) ? -1 : semverGt(b.version, a.version) ? 1 : 0));
    return candidates;
  } catch (err) {
    console.warn('[MeshUpdatePropagation] findNewerPeers failed (non-fatal):', err);
    return [];
  }
}

// ─── Canonical manifest (independent trust anchor) ────────────────────────────

/**
 * Fetch the canonical site release manifest directly. Exposed for standalone/testable
 * use and for callers that don't already have a fresh copy in hand; auto_update_scheduler
 * .ts's checkAndMaybeDownload() already fetches this same manifest for its own site-download
 * path and passes the entry straight through to pullAndVerifyFromPeers() rather than calling
 * this a second time in the same check cycle.
 */
export async function fetchCanonicalManifest(): Promise<CanonicalManifestEntry | null> {
  try {
    const resp = await fetch('https://mnemosynec.org/version_trust.json', {
      headers: { 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) return null;

    const trust = (await resp.json()) as {
      versions?: Array<{ tier?: string; version?: string; url?: string; sha256?: string }>;
    };
    const latest = trust.versions?.find((v) => v.tier === 'latest');
    if (!latest?.version || !latest.url || !latest.sha256) return null;

    return { version: latest.version, url: latest.url, sha256: latest.sha256 };
  } catch (err) {
    console.warn('[MeshUpdatePropagation] fetchCanonicalManifest failed (non-fatal):', err);
    return null;
  }
}

// ─── Pull + verify ─────────────────────────────────────────────────────────────

function sha256File(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

/**
 * Attempt to pull `version`'s installer from any of `peers` (already filtered to those
 * advertising a newer version; tried in the order given -- callers should pass
 * newest-first). Every candidate whose bytes fail to match `canonicalSha256` is deleted
 * and skipped -- this function NEVER returns ok:true for an unverified file.
 */
export async function pullAndVerifyFromPeers(
  peers: NewerPeer[],
  version: string,
  canonicalSha256: string,
): Promise<MeshPullResult> {
  for (const peer of peers) {
    // Only pull the exact version the canonical manifest names -- a peer advertising
    // some OTHER newer version than the manifest's "latest" is not a valid source for it.
    if (peer.version !== version) continue;

    try {
      // peer_artifact_client.ts's helpers expect "host:port"; artifact_server_address is
      // stored as a full "http://host:port" URL in peer_presence (peerIdentityCollector.ts).
      const hostPort = peer.artifactServerAddress.replace(/^https?:\/\//, '').replace(/\/$/, '');

      const found = await findPeerWithArtifact([hostPort], version, 4000);
      if (!found) continue;

      const localPath = await downloadFromPeer(found, version);

      const actualSha256 = sha256File(localPath);
      if (actualSha256.toLowerCase() !== canonicalSha256.toLowerCase()) {
        console.error(
          `[MeshUpdatePropagation] REJECTED artifact from peer ${peer.peerId} for v${version}: ` +
            `SHA-256 mismatch (peer bytes do not match canonical site manifest) -- deleting, never installing.`,
        );
        try { unlinkSync(localPath); } catch { /* best-effort cleanup */ }
        continue;
      }

      console.log(`[MeshUpdatePropagation] Verified v${version} from peer ${peer.peerId} (SHA-256 matches canonical manifest).`);
      return { ok: true, peerId: peer.peerId, localPath };
    } catch (err) {
      console.warn(`[MeshUpdatePropagation] Pull from peer ${peer.peerId} failed (trying next peer):`, err);
      continue;
    }
  }

  return { ok: false, error: peers.length === 0 ? 'no newer peers found' : 'no peer served a hash-verified copy' };
}

// ─── Cache seeding (makes propagation cascade) ────────────────────────────────

/**
 * Copy a verified installer into this node's own artifact cache so peer_artifact_server
 * (once started) can re-serve it to OTHER peers, without them each hitting the site --
 * this is what turns "one site download" into "propagates across the mesh" per the
 * Founder directive. Safe to call after ANY verified download (site or peer-sourced);
 * a peer-sourced file is already in this exact location via downloadFromPeer(), so this
 * is a no-op in that case.
 */
export function seedLocalArtifactCache(version: string, sourcePath: string): void {
  try {
    if (!existsSync(sourcePath)) return;
    mkdirSync(ARTIFACT_CACHE_DIR, { recursive: true });
    const destPath = join(ARTIFACT_CACHE_DIR, `MnemosyneC-Setup-${version}.exe`);
    if (join(sourcePath) === destPath) return; // already there (peer-sourced pull)
    copyFileSync(sourcePath, destPath);
    console.log(`[MeshUpdatePropagation] Seeded local artifact cache for v${version} -- this node can now serve it to peers.`);
  } catch (err) {
    console.warn('[MeshUpdatePropagation] seedLocalArtifactCache failed (non-fatal):', err);
  }
}
