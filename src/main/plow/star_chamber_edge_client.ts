// star_chamber_edge_client.ts -- BP137 Yoke v2b Stage E: records a distributed Star Chamber
// fire to the `star_chamber_mesh_fires` table via the EXISTING `star-chamber-analyze` edge
// function -- never a direct client-key table insert.
//
// WHY THIS FILE EXISTS (R-MECHANISM-VERIFY): `star_chamber_mesh_fires` (Bishop-gadgeted this
// session, live schema: id uuid, dispatch_id text, domain text, question text,
// confidence_variance numeric, andon_threshold numeric, peer_answers_json jsonb,
// star_chamber_answer text, judge_answers jsonb, judge_confidences jsonb, h_score numeric,
// consensus_reached bool, falsification_criteria jsonb, created_at timestamptz) has RLS set to
// anon-read / service_role-write (per the Stage E spec) -- an anon-key client can never insert
// into it directly. The existing, already-referenced client call site for the
// `star-chamber-analyze` edge function (src/main/catacombs/contribute_to_category.ts:100) proves
// the calling CONVENTION this repo already uses for that function: POST with the anon/
// publishable apikey header only, letting the edge function itself hold and use the
// SUPABASE_SERVICE_ROLE_KEY server-side (Deno.env.get, never sent by this client -- see
// wan-relay-publish/index.ts for the same pattern on a different function, confirmed by direct
// read this Yoke). This file follows that exact convention for a NEW payload_type
// ('star_chamber_mesh_fire') carrying the mesh-fire columns above; it does not modify
// contribute_to_category.ts's own 'mesh_benchmark_verify' call.
//
// The literal `supabase/functions/star-chamber-analyze/` Deno source was NOT found in this repo
// (confirmed: zero glob hits under supabase/functions/) -- only two client CALL sites reference
// it (contribute_to_category.ts, and this new file). Per the Stage E task's explicit instruction
// ("if you cannot find it in this repo, search for it and report where it lives"): it is not
// vendored in `mnemosyne`; it is deployed directly to the shared Supabase project
// (ruuxzilgmuwddcofqecc.supabase.co, same project every other edge-function URL in this repo
// resolves to via getSupabaseUrl()) and its server-side source lives wherever Bishop's Supabase
// deploy pipeline keeps edge functions outside this repo's tree -- this file never guesses at or
// reconstructs that source, per the task's "do not hand-edit or guess at Supabase schema/edge
// function" instruction.
//
// Honesty/degrade discipline: mirrors contribute_to_category.ts's runStarChamber() exactly --
// network failure, non-2xx, or a 404 (function not deployed to reach from THIS box's network
// path yet) all degrade to a labeled `simulated: true` return rather than throwing or silently
// dropping the fire. The caller (star_chamber_dispatch.ts) always has a payload to report, live
// or simulated, never neither.

import { getAnonKey, getSupabaseUrl } from '../shared/anon_key';

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_ANON_KEY = getAnonKey();

/** Mirrors the live `star_chamber_mesh_fires` schema (Bishop-gadgeted, BP137) field-for-field.
 *  `id`/`created_at` are DB-assigned (never set by the client) -- omitted here on purpose. */
export interface StarChamberMeshFirePayload {
  dispatch_id: string;
  domain: string;
  question: string;
  confidence_variance: number;
  andon_threshold: number;
  peer_answers_json: Array<{ authority: string; answer: string; verified: boolean; source_url?: string }>;
  star_chamber_answer: string | null;
  judge_answers: Record<string, string | null>;
  judge_confidences: Record<string, number>;
  h_score: number;
  consensus_reached: boolean;
  falsification_criteria: Record<string, unknown>;
}

export interface StarChamberMeshFireRecordResult {
  /** True only when the edge function actually accepted the write (HTTP 2xx with a real row
   *  id back) -- never true for a degraded/simulated report. */
  ok: boolean;
  /** DB-assigned row id, present only when `ok` is true. */
  id?: string;
  /** True whenever this call could NOT be confirmed live (network error, non-2xx, 404, or
   *  SUPABASE_URL unresolved) -- the caller MUST label any report built from this result as
   *  dry-run/simulated, never as a confirmed live write. */
  simulated: boolean;
  /** The exact payload that was sent (or would have been sent) -- always populated so a
   *  simulated result still has a concrete, reportable body. */
  payloadSent: StarChamberMeshFirePayload;
  reason?: string;
}

/**
 * Records one distributed Star Chamber fire via the existing `star-chamber-analyze` edge
 * function -- service_role write path, no client-key insert ever attempted against
 * `star_chamber_mesh_fires` directly (that table's RLS does not grant anon/authenticated INSERT
 * per the Stage E spec). Never throws; a failure of any kind degrades to `simulated: true` with
 * the payload that was attempted, so the caller always has something concrete to report.
 */
export async function recordStarChamberMeshFire(
  payload: StarChamberMeshFirePayload,
): Promise<StarChamberMeshFireRecordResult> {
  if (!SUPABASE_URL) {
    return { ok: false, simulated: true, payloadSent: payload, reason: 'SUPABASE_URL not resolved' };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/star-chamber-analyze`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payload_type: 'star_chamber_mesh_fire',
        ...payload,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (res.status === 404) {
      return { ok: false, simulated: true, payloadSent: payload, reason: 'star-chamber-analyze not reachable (404) -- graceful degrade' };
    }
    if (!res.ok) {
      return { ok: false, simulated: true, payloadSent: payload, reason: `HTTP ${res.status}` };
    }

    const json = (await res.json().catch(() => null)) as { id?: string; row_id?: string } | null;
    const id = json?.id ?? json?.row_id;
    if (!id) {
      // Function reached but did not hand back a row id we can cite -- honest: report simulated
      // rather than fabricating an id.
      return { ok: false, simulated: true, payloadSent: payload, reason: 'edge function returned 2xx with no row id' };
    }
    return { ok: true, id, simulated: false, payloadSent: payload };
  } catch (err) {
    return {
      ok: false,
      simulated: true,
      payloadSent: payload,
      reason: `request failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
