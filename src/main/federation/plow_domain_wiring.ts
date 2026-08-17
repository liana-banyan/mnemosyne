/**
 * plow_domain_wiring.ts — D-BP156-M0-014.
 *
 * Revives peer_server.ts's `onPlowDomain` hook -- HARDWIRE-24's older sibling to
 * `onBishopDispatch`/`bishop_dispatch_wiring.ts`, and the hook the whole mesh-hook-injection
 * design was told to mirror in the first place (see this ticket, DISPATCH_D-BP156-M0-014_
 * REVIVE_HOOK_AND_REPLY_LEG.md). Verified live, independently, before writing this file: only
 * `diagnosis_ipc.ts` (onDiagnosisPost/onDiagnosisAnswer/onDiagnosisUpvote) and
 * `bishop_dispatch_wiring.ts` (onBishopDispatch) ever call `registerPeerServerHooks` anywhere in
 * this repo -- `onPlowDomain` was never passed to it. Confirmed dead code, not a mis-report.
 *
 * REVIVED, NOT RETIRED, because it is not orphaned infrastructure -- `federated_andon.ts` and
 * `mic_dispatcher.ts` already POST to `/api/plow-domain` expecting a live answer (both predate
 * HARDWIRE-24 and this dispatch), and `mic_ipc.ts`'s own `registerMicIpc()` already contains a
 * byte-for-byte proven `runSelfDomain(domain, questions)` closure -- MIC's LAN self-domain
 * fallback -- that does the identical `runCanonicalPlow` + `writeVerifiedEblet` call this hook
 * needs. Removing the hook slot would not change today's behavior (every such POST already
 * 503s, same as before this file existed) but would foreclose completing an already-partially-
 * built, already-called LAN capability in favor of a misleading "the mechanism doesn't exist"
 * signal. `handlePlowDomainRequest` below is that same proven call shape, adapted only to take
 * `ollamaBaseUrl`/`model` as explicit parameters (peer_server.ts's `onPlowDomain` hook
 * signature) instead of closing over an IPC payload -- `resolvePlowDomainRequest()` already
 * resolves both, with the same defaulting peer_server.ts's own /api/plow-domain branch already
 * applied before this file existed, before calling the hook.
 */

import { registerPeerServerHooks } from './peer_server';

export interface PlowDomainHookResult {
  ebletsWritten: number;
  quarantined: number;
  andonEvents: number;
  status: string;
}

/** The real onPlowDomain implementation. Exported directly (not only reachable through the
 *  wiring function below) so a test can exercise it without needing a live
 *  registerPeerServerHooks registration -- same testability convention as
 *  bishop_dispatch_handler.ts's handleBishopDispatch(). */
export async function handlePlowDomainRequest(
  domain: string,
  questions: string[],
  ollamaBaseUrl: string,
  model: string,
): Promise<PlowDomainHookResult> {
  const { runCanonicalPlow } = await import('../plow/canonical_pipeline');
  const { writeVerifiedEblet } = await import('../mnem_eblet_store');

  let ebletsWritten = 0;
  let quarantined = 0;
  let andonEvents = 0;

  const result = await runCanonicalPlow(
    {
      domains: [domain],
      questionsPerDomain: questions.length,
      ollamaBaseUrl,
      model,
    },
    async (eblet) => { await writeVerifiedEblet(eblet as Parameters<typeof writeVerifiedEblet>[0]); },
    (evt) => {
      if (evt.type === 'andon-trigger') andonEvents++;
      if (evt.type === 'scribe-done') ebletsWritten += evt.ebletsWrittenThisQuestion ?? 0;
    },
    { cancelled: false },
    // Questions arrive already resolved by resolvePlowDomainRequest() (LAN caller supplies
    // them directly, unlike mic_ipc.ts's IPC path which samples from a local question bank) --
    // this sampler just slices the caller-supplied list, mirroring mic_ipc.ts's own
    // runSelfDomain() closure at line ~95-98 verbatim.
    (_domainArg, n) => questions.slice(0, n),
  );

  const dr = result.domainResults[0];
  return {
    ebletsWritten: dr?.totalEbletsWritten ?? ebletsWritten,
    quarantined: dr?.quarantinedCount ?? quarantined,
    andonEvents: dr?.andonEvents ?? andonEvents,
    status: dr?.status ?? 'YELLOW',
  };
}

let _registered = false;

/** Idempotent, matching bishop_dispatch_wiring.ts's registerBishopDispatchMeshHook() /
 *  board_ipc.ts's initBoardWatcher() once-only registration discipline (KN-BP144-10). */
export function registerPlowDomainMeshHook(): void {
  if (_registered) return;
  _registered = true;
  registerPeerServerHooks({ onPlowDomain: handlePlowDomainRequest });
}
