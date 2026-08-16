// membership_lookup.ts — D-BP155-025/BISHOP/seg-member-recognition
//
// Queries the real membership record (public.member_profiles) for the identity behind
// an lb_auth.ts LBSession. This is the ONLY membership lookup in the app; the old
// _validateAndSave() flow in auth_manager.ts (POST to the never-existent
// https://lianabanyan.com/api/amplify/validate) has been retired, not replaced with a
// second server-side endpoint. See auth_manager.ts's header for why.
//
// Why a client-side REST call is sufficient (no edge function needed):
//   member_profiles carries RLS policy "Users can view own profile always"
//     FOR SELECT USING (auth.uid() = user_id)
//   auth.uid() reads the `sub` claim of the JWT sent as the PostgREST Authorization
//   header. lb_auth.ts's session.access_token IS that JWT (it comes straight from
//   Supabase's own /auth/v1/otp + /auth/v1/token exchange) — so a query authenticated
//   with the user's own access_token, not the anon key, is automatically restricted by
//   Postgres itself to that user's own row. No secret leaks, no service_role key is
//   used or needed client-side, and there is nothing left for a server-side bridge to
//   do that RLS doesn't already do for free. Verified directly against the live schema
//   2026-08-15 (`psql "$SUPABASE_DB_URL" -c "\d member_profiles"`).
//
// This module does no caching and no retry/backoff — that policy lives in
// auth_manager.ts's refreshMembership(), which is the only caller.

import { getAnonKey, getSupabaseUrl } from './shared/anon_key';
import type { LBSession } from './lb_auth';

export interface MembershipRow {
  membership_status: 'inactive' | 'active' | 'cancelled' | 'expired' | 'lifetime';
  membership_expires_at: string | null;
  member_number: number | null;
  tags: string[];
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export type MembershipLookupResult =
  // row === null means the live query succeeded and found no member_profiles row for
  // this identity at all — a CONFIRMED non-member, not a failure.
  | { ok: true; row: MembershipRow | null }
  // The lookup could not be completed. Caller must NOT treat this as "not a member."
  | { ok: false; reason: 'network' | 'unauthorized' };

const REST_TIMEOUT_MS = 10_000;

export async function lookupMembership(session: LBSession): Promise<MembershipLookupResult> {
  const url = getSupabaseUrl();
  const anonKey = getAnonKey();

  const query =
    `${url}/rest/v1/member_profiles` +
    `?select=membership_status,membership_expires_at,member_number,tags,username,display_name,avatar_url` +
    `&user_id=eq.${encodeURIComponent(session.user_id)}`;

  try {
    const res = await fetch(query, {
      method: 'GET',
      headers: {
        apikey: anonKey,
        // The user's OWN JWT, not the anon key — this is what makes
        // auth.uid() = user_id evaluate true under RLS.
        Authorization: `Bearer ${session.access_token}`,
      },
      signal: AbortSignal.timeout(REST_TIMEOUT_MS),
    });

    if (res.status === 401 || res.status === 403) {
      return { ok: false, reason: 'unauthorized' };
    }
    if (!res.ok) {
      return { ok: false, reason: 'network' };
    }

    const rows = (await res.json()) as MembershipRow[];
    return { ok: true, row: rows[0] ?? null };
  } catch {
    // Network error, timeout, DNS failure, JSON parse failure — all indistinguishable
    // from "server unreachable" from here, which is exactly the point: none of them are
    // "not a member."
    return { ok: false, reason: 'network' };
  }
}
