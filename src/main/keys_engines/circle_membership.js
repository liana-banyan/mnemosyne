/**
 * circle_membership.ts -- Keys and Engines: Circle of Influence peer query
 * BP087 Wave 4 · BP086 MIC-stamped trust list
 *
 * Queries peer_presence WHERE circle_of_influence = true AND reputation >= threshold.
 * Returns CircleMembership: { peers: CirclePeer[], count: number }
 *
 * Canon ref: canon_mic_stamped_user_approval_circle_of_influence_reciprocal_trust_bp086
 */
import { getAnonKey, getSupabaseUrl } from '../shared/anon_key';
// BP132 Yoke #23 Task 6: shared helper so a stranger's install still authenticates.
const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_ANON_KEY = getAnonKey();
const DEFAULT_REPUTATION_THRESHOLD = 0.8;
/**
 * Fetch Circle of Influence peers from peer_presence table via Supabase REST.
 * Filters: circle_of_influence = true AND reputation >= threshold.
 * Returns empty list if table does not exist or network is unavailable.
 */
export async function getCircleMembership(threshold = DEFAULT_REPUTATION_THRESHOLD) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.warn('[CircleMembership] SUPABASE_URL or SUPABASE_ANON_KEY not set');
        return { peers: [], count: 0, threshold };
    }
    try {
        const url = `${SUPABASE_URL}/rest/v1/peer_presence` +
            `?circle_of_influence=eq.true` +
            `&reputation=gte.${threshold}` +
            `&select=peer_id,artifact_server_address,reputation,mic_stamped`;
        const res = await fetch(url, {
            headers: {
                apikey: SUPABASE_ANON_KEY,
                'Content-Type': 'application/json',
            },
        });
        if (!res.ok) {
            console.warn(`[CircleMembership] Supabase REST error: ${res.status}`);
            return { peers: [], count: 0, threshold };
        }
        const rows = await res.json();
        const peers = rows.map((r) => ({
            peerId: r.peer_id,
            address: r.artifact_server_address,
            reputation: r.reputation,
            micStamped: r.mic_stamped,
        }));
        return { peers, count: peers.length, threshold };
    }
    catch (err) {
        console.error('[CircleMembership] Query failed:', err);
        return { peers: [], count: 0, threshold };
    }
}
