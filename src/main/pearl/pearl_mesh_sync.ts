/**
 * pearl_mesh_sync.ts -- MAMBA-beta2
 *
 * Emit side: broadcast a pearl to mesh peers via MIC-broadcast (pearl_sync type).
 * Fetch side: attested 2-attempt fan-out REST fetch from peer nodes for unresolved pearls.
 *
 * Supabase client pattern: direct fetch (matching src/main/ codebase convention).
 * Canon ref: canon_plow_on_mesh_integration_distributed_12_blade_bp087
 */

const SUPABASE_URL: string =
  process.env['SUPABASE_URL'] ?? process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
const SUPABASE_SERVICE_KEY: string =
  process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
const MIC_BROADCAST_URL = `${SUPABASE_URL}/functions/v1/mic-broadcast`;

export interface PearlSyncPayload {
  pearl_id: string;
  soccerball_sid: string;
  payload_b64: string;
  origin_peer_id: string;
}

/**
 * Emit a pearl to the mesh.
 * 1. Optimistic local upsert into pearl_share table.
 * 2. MIC-broadcast with type 'pearl_sync' so all connected peers cache locally.
 */
export async function emitPearlSync(pearl: PearlSyncPayload): Promise<void> {
  const authored_at = new Date().toISOString();

  // 1. Optimistic local upsert into pearl_share table
  try {
    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/pearl_share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY,
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        pearl_id: pearl.pearl_id,
        soccerball_sid: pearl.soccerball_sid,
        payload_b64: pearl.payload_b64,
        authored_at,
        last_synced_at: authored_at,
        origin_peer_id: pearl.origin_peer_id,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!upsertRes.ok) {
      const text = await upsertRes.text().catch(() => '');
      console.warn(`[PearlMeshSync] local upsert HTTP ${upsertRes.status}: ${text.slice(0, 200)}`);
    }
  } catch (err) {
    console.warn('[PearlMeshSync] local upsert failed:', err);
  }

  // 2. Call MIC-broadcast with message type 'pearl_sync' and pearl payload
  try {
    const bcRes = await fetch(MIC_BROADCAST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY,
        'x-service-role': 'true',
      },
      body: JSON.stringify({
        broadcast_type: 'pearl_sync',
        payload_json: {
          pearl_id: pearl.pearl_id,
          soccerball_sid: pearl.soccerball_sid,
          payload_b64: pearl.payload_b64,
          authored_at,
          origin_peer_id: pearl.origin_peer_id,
        },
        issued_by: `peer:${pearl.origin_peer_id}`,
        ttl_seconds: 3600,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!bcRes.ok) {
      const text = await bcRes.text().catch(() => '');
      console.warn(`[PearlMeshSync] mic-broadcast HTTP ${bcRes.status}: ${text.slice(0, 200)}`);
    }
  } catch (err) {
    console.warn('[PearlMeshSync] mic-broadcast call failed:', err);
  }
}

/**
 * Attempt to fetch a pearl from up to 2 peer node REST endpoints.
 * Returns payload_b64 on first success; returns null after 2 failures.
 * Each attempt is logged explicitly (no silent degradation).
 */
export async function fetchPearlFromMesh(
  pearl_id: string,
  peerEndpoints: string[],
): Promise<string | null> {
  const attempts = peerEndpoints.slice(0, 2);

  for (const endpoint of attempts) {
    const url = `${endpoint}/pearl_share/${pearl_id}`;
    console.log(
      `[PearlMeshSync] fetchPearlFromMesh attempt endpoint=${endpoint} pearl_id=${pearl_id}`,
    );
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8_000),
      });
      if (res.ok) {
        const data = (await res.json()) as { payload_b64?: string };
        if (data.payload_b64) {
          console.log(
            `[PearlMeshSync] fetchPearlFromMesh HIT endpoint=${endpoint} pearl_id=${pearl_id}`,
          );
          return data.payload_b64;
        }
      }
      console.warn(
        `[PearlMeshSync] fetchPearlFromMesh MISS endpoint=${endpoint} pearl_id=${pearl_id} status=${res.status}`,
      );
    } catch (err) {
      console.warn(
        `[PearlMeshSync] fetchPearlFromMesh ERR endpoint=${endpoint} pearl_id=${pearl_id}:`,
        err,
      );
    }
  }

  return null;
}
