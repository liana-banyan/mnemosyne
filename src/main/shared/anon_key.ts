// anon_key.ts -- BP132 Yoke #23 Task 6: shared Supabase anon/publishable key resolution.
//
// ROOT CAUSE CONFIRMED (2026-07-23/24, Bishop-reported + verified against source): the
// long-standing "peer_presence stays at 0 rows" mystery from Yoke #21/#22/#23 has a real,
// concrete code cause. peer_server.ts's publishPresence() -> tryPublish() sent its POST to
// wan-relay-publish with headers: { 'Content-Type': 'application/json' } and NO apikey/
// Authorization header AT ALL -- not "falls back to nothing when the env var is unset",
// literally never read process.env.SUPABASE_ANON_KEY in that function in the first place.
// Any Supabase edge function with JWT verification enabled (the default) rejects a
// request with no auth header as 401 UNAUTHORIZED_NO_AUTH_HEADER before it ever reaches
// the handler -- this alone is sufficient to explain zero peer_presence rows on every
// boot, independent of anything else fixed in Yoke #21 (registerPresenceConfig ordering,
// wan_soccerball_id guard, etc. were all real fixes, just not sufficient on their own).
//
// A repo-wide audit (2026-07-24) found roughly 20 other files independently reading
// process.env.SUPABASE_ANON_KEY (some with a NEXT_PUBLIC_ fallback, most with NO bundled
// fallback at all) -- every one of them silently authenticates with an empty string on
// any machine with no WORKING_KEYS.env / SDS.env present, i.e. any stranger's install.
//
// FIX: one shared helper, reusing the exact fallback key already shipped in
// beacons_lit/index.ts prior to this yoke (SUPABASE_ANON_KEY_FALLBACK). The
// 'sb_publishable_' prefix identifies this as a Supabase PUBLISHABLE key -- the current
// generation of Supabase API key (successor to the legacy anon/service_role pair),
// explicitly designed by Supabase to be safe for client-side/public embedding, the same
// way a Stripe publishable key (pk_...) differs from a Stripe secret key (sk_...).
// Bundling this key is NOT a secrets-hygiene violation: it carries no more privilege than
// what RLS already grants to anonymous/public requests, and Supabase's own docs describe
// publishable keys as intended for exactly this kind of client-side distribution. This is
// distinct from, and must never be confused with, an actual service_role key (full
// bypass-RLS privilege) -- no service_role key is bundled anywhere in this module or its
// callers, and none should ever be.
//
// Every Supabase REST/edge-function caller in this codebase should use getAnonKey() (or
// getAnonKeyHeaders()) instead of reading process.env.SUPABASE_ANON_KEY directly, so
// every call authenticates correctly even on a machine with zero configured env vars.
//
// EXCEPTION: env_loader.ts's getEnvLoaderStatus() intentionally does NOT use this
// fallback -- it exists specifically to report what was actually resolved from env/vault
// for diagnostic purposes, and substituting the bundled fallback there would misreport a
// missing vault as a successful load.

export const SUPABASE_ANON_KEY_FALLBACK = 'sb_publishable_2KjyBXCIPaUUPiFL-p0Srg_EQj3d5FM';

// The Supabase project URL is not a secret either -- it is the public REST/edge-function
// host every client (including anonymous browser/mobile clients) must call, and this exact
// literal is already hardcoded as a fallback in several places in this codebase (e.g.
// beacons_lit/index.ts's SUPABASE_URL constant, peer_server.ts's relayBaseFallback). Several
// call sites resolve `process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''`
// with NO literal fallback, meaning presence/relay registration silently no-ops on a machine
// with no WORKING_KEYS.env at all (the URL resolves empty, gating code short-circuits before
// even attempting a network call) -- the same "works on the Founder's dev machine, silently
// broken for a stranger" failure class as the missing anon-key fallback above.
export const SUPABASE_URL_FALLBACK = 'https://ruuxzilgmuwddcofqecc.supabase.co';

/**
 * Resolves the Supabase anon/publishable key to use for a real API call: explicit env
 * override first (operator/CI convenience), then the bundled publishable-key fallback so
 * every install -- including a stranger's, with no WORKING_KEYS.env present -- can still
 * authenticate WAN relay / presence / mesh calls.
 */
export function getAnonKey(): string {
  return (
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    SUPABASE_ANON_KEY_FALLBACK
  );
}

/** Resolves the Supabase project URL, falling back to the bundled public project host. */
export function getSupabaseUrl(): string {
  return (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    SUPABASE_URL_FALLBACK
  ).replace(/\/$/, '');
}

/** Convenience: the apikey + Authorization headers nearly every Supabase call needs. */
export function getAnonKeyHeaders(extra?: Record<string, string>): Record<string, string> {
  const anonKey = getAnonKey();
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    ...extra,
  };
}
