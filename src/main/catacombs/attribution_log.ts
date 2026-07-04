/**
 * attribution_log.ts -- IP Ledger contribution attribution + Marks earn
 * BP087 Wave 5 -- BP086 10% work-contribution rate
 *
 * Canon ref: SEG-CL-delta -- 10 base Marks * corroboration_score per contribution
 */

// ---- Types ------------------------------------------------------------------

export interface AttributionParams {
  member_id: string;
  category_slug: string;
  eblet_uuid: string;
  corroboration_score: number;
  star_chamber_verdict: 'GREEN' | 'RED';
  scrambler_verdict: 'GREEN' | 'RED';
  keys_engines_verdict: 'GREEN' | 'RED';
  published_at: string;
}

// ---- Constants --------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';
const BASE_MARKS = 10;

// ---- Public API -------------------------------------------------------------

/**
 * Log a contribution attribution row to Supabase catacombs_contributions.
 * Computes marks_earned = 10 base Marks * corroboration_score.
 * Emits a console pearl for observability (MCP pearl_emit not available in main process).
 */
export async function logAttribution(params: AttributionParams): Promise<void> {
  const marks_earned = BASE_MARKS * params.corroboration_score;

  // Emit observable pearl via console (main process cannot call MCP directly)
  console.log(
    `[ATTRIBUTION_LOGGED] member=${params.member_id} slug=${params.category_slug} ` +
    `uuid=${params.eblet_uuid} marks=${marks_earned.toFixed(4)} score=${params.corroboration_score}`
  );

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[Attribution] SUPABASE_URL or SUPABASE_ANON_KEY not set -- skipping DB insert');
    return;
  }

  const body = {
    member_id: params.member_id,
    category_slug: params.category_slug,
    eblet_uuid: params.eblet_uuid,
    corroboration_score: params.corroboration_score,
    star_chamber_verdict: params.star_chamber_verdict,
    scrambler_verdict: params.scrambler_verdict,
    keys_engines_verdict: params.keys_engines_verdict,
    marks_earned,
    published_at: params.published_at,
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/catacombs_contributions`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn(`[Attribution] Insert failed (${res.status}): ${text}`);
    } else {
      console.log(`[Attribution] Inserted -- marks_earned=${marks_earned.toFixed(4)}`);
    }
  } catch (err) {
    console.error('[Attribution] Network error during insert:', err);
  }
}
