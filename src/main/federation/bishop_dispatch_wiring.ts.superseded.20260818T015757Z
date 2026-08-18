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
    onBishopDispatch: (payload, verifiedOriginPeerId) => handleBishopDispatch(payload, verifiedOriginPeerId),
  });
}
