// nexus_lookup_authority_routing.ts -- BP148 D-BP148-029 (SEG per-arm-routing).
//
// WHY THIS FILE EXISTS: src/main/index.ts's 'nexus-ask-lookup-fact' handler is the real
// answering path for the Nexus Ask tab's lookup-fact questions. Before this ticket it always
// tried user_google then user_perplexity, unconditionally, whenever the master Research Arm
// switch (isNexusAuthorityFlagEnabled()) was on -- the per-arm authority picker
// (NexusAuthoritySettings.tsx -> nexus_authority_settings_store.ts's setArmAuthority(),
// persisted under localStorage key 'mnemo_nexus_per_arm_authority') changed a LABEL only, never
// the actual dispatch. This file holds the pure (no I/O, no Electron import) routing decision
// that closes that gap, split out of index.ts specifically so it can be unit-tested without
// tripping index.ts's own module-scope `app.whenReady()` call (which throws immediately outside
// a real Electron process -- `app` resolves to `undefined` when `electron` is required by plain
// Node, same constraint documented in src/main/ai_dispatch_ipc_escalation_ladder.test.ts's
// header for a different file, except THAT file never calls anything at module scope; index.ts
// does, at its literal top level, so requiring dist/main/index.js outside Electron is not an
// option here). index.ts is still the only production caller; this file has no side effects of
// its own and no Electron import at all.
//
// CONTRACT (Bishop's WORK section, restated as code):
//   - The master Research Arm switch stays the sole on/off gate -- checked by the caller BEFORE
//     any of this runs; this file has no opinion on it and cannot turn the feature on or off.
//   - No per-arm assignment (absent / read failed, surfaced by the caller as `null`) OR an
//     explicit 'local_free' assignment (the shipped default for every arm -- see
//     browser_authority_types.ts's DEFAULT_NEXUS_PER_ARM_AUTHORITY) OR 'paid_api' (no
//     browser-authority implementation exists for it yet) all preserve TODAY'S exact behavior:
//     both authorities attempted, google-first, `restrictedTo: null`. This is the "additive, not
//     a rewrite" requirement -- an unassigned/default arm behaves byte-identically to before
//     this ticket.
//   - An explicit 'user_google' or 'user_perplexity' assignment restricts the plan to ONLY that
//     authority.
// The caller (index.ts) owns the fallback leg (retrying the other authority when a restricted
// single-authority attempt comes back empty -- "assigned authority unavailable") and owns making
// that fallback visible in the handler's response; this file only produces the initial plan.

/** Mirrors browser_authority_types.ts's NexusAuthorityName -- deliberately NOT imported from
 *  there (that file lives under src/shared/plow/, outside this ticket's OWNS list). The four
 *  literals are stable and small enough that duplicating them here keeps this file's
 *  zero-dependency guarantee trivially inspectable by anyone reading just this file. */
export type NexusLookupAssignedAuthority = 'local_free' | 'user_google' | 'user_perplexity' | 'paid_api';

export type NexusBrowserAuthority = 'user_google' | 'user_perplexity';

export interface NexusLookupAuthorityRoutingPlan {
  /** Authorities to attempt, in order, before any caller-side fallback. */
  authoritiesToTry: NexusBrowserAuthority[];
  /** Non-null only when the plan restricts the attempt to a single explicitly-assigned
   *  authority; null means "today's default both-authority behavior" (no assignment,
   *  'local_free', 'paid_api', or an unreadable/null assignment). */
  restrictedTo: NexusBrowserAuthority | null;
}

/** Pure, no I/O. See file header for the full contract. `assignedAuthority` is whatever the
 *  caller read for the 'lookup_fact' arm out of the per-arm settings mirror -- `null` for "could
 *  not be read" (no window, threw, unparseable, key absent), which this function treats exactly
 *  like an explicit 'local_free'. */
export function planNexusLookupAuthorityRouting(
  assignedAuthority: NexusLookupAssignedAuthority | null,
): NexusLookupAuthorityRoutingPlan {
  if (assignedAuthority === 'user_google') {
    return { authoritiesToTry: ['user_google'], restrictedTo: 'user_google' };
  }
  if (assignedAuthority === 'user_perplexity') {
    return { authoritiesToTry: ['user_perplexity'], restrictedTo: 'user_perplexity' };
  }
  // 'local_free' | 'paid_api' | null all land here -- today's unrestricted behavior, unchanged.
  return { authoritiesToTry: ['user_google', 'user_perplexity'], restrictedTo: null };
}

/** The other of the two browser authorities -- used only by the caller's single-authority
 *  fallback leg (a restricted attempt that returned nothing usable). */
export function otherNexusBrowserAuthority(a: NexusBrowserAuthority): NexusBrowserAuthority {
  return a === 'user_google' ? 'user_perplexity' : 'user_google';
}
