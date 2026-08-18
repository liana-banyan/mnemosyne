/**
 * bishop_dispatch_wiring.ts — D-BP156-M0-008.
 *
 * Registers the real bishop_dispatch_handler.ts implementation as peer_server.ts's
 * `onBishopDispatch` hook, mirroring diagnosis_ipc.ts's `registerDiagnosisIpc()` convention
 * (a small dedicated file that owns wiring a hook implementation into registerPeerServerHooks,
 * called once from index.ts's init sequence). Kept separate from bishop_dispatch_handler.ts
 * itself so the handler's guardrail logic stays independently unit-testable (constructing a
 * payload and calling handleBishopDispatch directly) without needing this wiring at all.
 */

import { registerPeerServerHooks } from './peer_server';
import { handleBishopDispatch } from './bishop_dispatch_handler';

let _registered = false;

/** Idempotent, matching board_ipc.ts's initBoardWatcher()/yoke_watcher.ts's
 *  startResidentWatcher() discipline already established in this codebase (KN-BP144-10). */
export function registerBishopDispatchMeshHook(): void {
  if (_registered) return;
  _registered = true;
  registerPeerServerHooks({
    // D-BP157-023: routeId threaded through -- it is what lets launchWorker's own exit handler
    // post a stage-2/completion reply, much later, back to the SAME relay_route_replies row this
    // dispatch arrived on. spawnImpl/claimImpl are left undefined here (not omitted) so
    // handleBishopDispatch's own default parameters (the real spawn/execFileSync) still apply --
    // an explicit `undefined` argument triggers a JS default parameter exactly like an omitted
    // one; this file has no reason to import those two just to pass them through unchanged.
    onBishopDispatch: (payload, verifiedOriginPeerId, routeId) =>
      handleBishopDispatch(payload, verifiedOriginPeerId, undefined, undefined, routeId),
  });
}
