/**
 * bishop_dispatch_send_ipc.ts — D-BP156-M0-020, HARDWIRE-24 mesh.
 *
 * THE PROBLEM THIS FILE FIXES: dispatchBishopDispatchViaRelay (mic_dispatcher.ts) and
 * postBishopDispatchRelayRoute (also mic_dispatcher.ts) are the real, offline-tested send path
 * for a bishop_dispatch WAN relay row -- but as of D-BP156-M0-016 nothing in this codebase ever
 * calls them. No IPC handler, no npm script, no UI control. The send path was built and correct
 * and wired to nothing (the same "built, never invoked" pattern this session already found and
 * fixed three other times: onPlowDomain's hook registration, relay_poller_* telemetry, vramGb
 * publication).
 *
 * WHY THIS MUST BE AN IPC HANDLER, NOT A STANDALONE SCRIPT (investigated before writing this
 * file, D-BP156-M0-020's explicit instruction): dispatchBishopDispatchViaRelay signs its
 * plaintext with signAnnouncePayload() (announce_frame.ts), which calls getOrCreateKeypair()
 * (thorax/ed25519_keypair.ts), which does `import { app } from 'electron'; app.getPath
 * ('userData')` -- a hard dependency on a REAL, running Electron app singleton, because the
 * Ed25519 keypair is persisted at <userData>/thorax_ed25519.json and only that already-running
 * app process can read it. Proven directly, not assumed: node_modules/electron/index.js resolves
 * to a plain string (the path to the electron binary) whenever 'electron' is required from a
 * bare Node process (confirmed by reading that file) -- so `app` destructures to undefined and
 * `app.getPath` throws, which signAnnouncePayload's own try/catch swallows into a null return
 * (documented fail-soft behavior, see that file's own doc comment), and dispatchBishopDispatch-
 * ViaRelay falls back to an UNSIGNED plaintext envelope. bishop_dispatch_handler.ts's own
 * guardrail (a) (isOriginAllowed) refuses to spawn for any sender whose verifiedOriginPeerId is
 * null -- so a standalone script's send would go out unsigned and simply never verify on the
 * receiving end. This is directly demonstrated by the existing offline test
 * (mic_dispatcher.bishop_dispatch.test.ts), which runs in exactly this same bare-Node-process
 * shape and never mocks 'electron' at all -- its own success already proves the fallback path,
 * it just never needed the signature to be REAL for an encryption round-trip.
 *
 * The proven precedent for "a capability needs the real running Electron app" in this codebase
 * is NOT a standalone script -- it is scripts/mesh-test-cli.mjs, which explicitly documents (see
 * its own header) that going headless throws without a real Electron `app` singleton, and
 * instead attaches to an ALREADY-RUNNING instance via Chrome DevTools Protocol and calls a
 * preload-exposed window.amplify.* function. This file is the in-app half of that same shape:
 * a small dedicated IPC-registration file, mirroring mic_ipc.ts's registerMicIpc() and
 * diagnosis_ipc.ts's registerDiagnosisIpc() (both cited as the proven shape in this dispatch's
 * own instructions) -- registered once from index.ts's init sequence, calling the REAL send path
 * with zero forked logic. scripts/bishop_dispatch_send_cli.mjs (this same dispatch) is the CDP
 * driver that calls it from a terminal, mirroring mesh-test-cli.mjs's own CdpClient verbatim.
 */

import { ipcMain } from 'electron';
import { dispatchBishopDispatchViaRelay, isValidMachineTaggedDispatchId } from './mic_dispatcher';
import type { ConstellationPeer } from './mic_types';
import { getStablePeerId } from './peer-discovery';

export interface BishopDispatchSendViaRelayRequest {
  targetPeerId: string;
  dispatchId: string;
  promptText: string;
  workingDir: string;
}

export interface BishopDispatchSendViaRelayResponse {
  ok: boolean;
  error?: string;
  routeId?: string;
  targetPeerId: string;
  dispatchId: string;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * Validates the request shape and the machine-tagged dispatch id BEFORE calling the real send
 * path, so a malformed IPC call fails with a clear message instead of an obscure downstream
 * error. isValidMachineTaggedDispatchId is the SAME check dispatchBishopDispatchViaRelay itself
 * runs internally (HARDWIRE-24 Section 3) -- duplicated here only as an early, cheap, IPC-layer
 * rejection (no encrypt/fetch attempted for a request that is already known-bad); the real send
 * path's own check remains the authoritative gate and is never bypassed or weakened by this one.
 */
export function validateSendRequest(
  req: Partial<BishopDispatchSendViaRelayRequest> | null | undefined,
): { ok: true; req: BishopDispatchSendViaRelayRequest } | { ok: false; error: string } {
  if (!req || typeof req !== 'object') {
    return { ok: false, error: 'request body missing or not an object' };
  }
  const { targetPeerId, dispatchId, promptText, workingDir } = req;
  if (!isNonEmptyString(targetPeerId)) return { ok: false, error: 'targetPeerId is required (non-empty string)' };
  if (!isNonEmptyString(dispatchId)) return { ok: false, error: 'dispatchId is required (non-empty string)' };
  if (!isNonEmptyString(promptText)) return { ok: false, error: 'promptText is required (non-empty string)' };
  if (!isNonEmptyString(workingDir)) return { ok: false, error: 'workingDir is required (non-empty string)' };
  if (!isValidMachineTaggedDispatchId(dispatchId)) {
    return {
      ok: false,
      error: `dispatch id "${dispatchId}" is not machine-tagged (HARDWIRE-24 Section 3 requires ` +
        `the form D-BP<n>-M<n>-<n>); refusing to send an untagged id`,
    };
  }
  return { ok: true, req: { targetPeerId, dispatchId, promptText, workingDir } };
}

/**
 * Real send, callable independent of ipcMain registration (unit-testable directly, same split
 * as bishop_dispatch_handler.ts's handleBishopDispatch vs bishop_dispatch_wiring.ts). Calls
 * dispatchBishopDispatchViaRelay -- the REAL send path -- never a hand-rolled relay_routes
 * INSERT (M0 already refused that shortcut explicitly for this exact ticket: a hand-built row
 * would test the listener against a payload the real sender never produces, proving nothing).
 * Prints the relay_routes row id and target peer id to console on success -- this is the
 * sender's own receipt (Section 9 criterion 1), and it is what a CDP-driven caller (this same
 * dispatch's scripts/bishop_dispatch_send_cli.mjs) sees as this handler's return value too.
 */
export async function sendBishopDispatchViaRelay(
  req: Partial<BishopDispatchSendViaRelayRequest> | null | undefined,
): Promise<BishopDispatchSendViaRelayResponse> {
  const validated = validateSendRequest(req);
  if (!validated.ok) {
    return {
      ok: false,
      error: validated.error,
      targetPeerId: isNonEmptyString(req?.targetPeerId) ? req!.targetPeerId! : '',
      dispatchId: isNonEmptyString(req?.dispatchId) ? req!.dispatchId! : '',
    };
  }
  const { targetPeerId, dispatchId, promptText, workingDir } = validated.req;

  // dispatchBishopDispatchViaRelay only reads peer.id off this object (verified by reading its
  // body: `encryptForRelay(plaintext, peer.id)` and `postBishopDispatchRelayRoute(..., peer.id,
  // ...)`, no other ConstellationPeer field touched) -- the same minimal-peer-object shape this
  // module's own offline test (mic_dispatcher.bishop_dispatch.test.ts's mockPeer) already uses.
  // A bishop_dispatch send targets a peer id learned out-of-band (peer_presence, a Founder
  // ruling, HARDWIRE-24's named M0/M3 ids) -- it does not require the LAN-oriented
  // ConstellationPeer bookkeeping (address, cpuCapacity, installedDomains, ...) that only
  // dispatchDomainToPeer's isLanPeer() branch needs.
  const peer = { id: targetPeerId } as unknown as ConstellationPeer;
  const selfPeerId = getStablePeerId();

  const result = await dispatchBishopDispatchViaRelay(peer, dispatchId, promptText, workingDir, selfPeerId);

  if (result.ok) {
    // eslint-disable-next-line no-console
    console.log(
      `[BishopDispatchSend] sent dispatch=${dispatchId} to peer=${targetPeerId} -- ` +
      `relay_routes row id=${result.routeId ?? '(unknown -- insert response had no id)'}`,
    );
  } else {
    // eslint-disable-next-line no-console
    console.error(`[BishopDispatchSend] send FAILED dispatch=${dispatchId} to peer=${targetPeerId}: ${result.error}`);
  }

  return { ...result, targetPeerId, dispatchId };
}

let _registered = false;

/** Idempotent, matching bishop_dispatch_wiring.ts's registerBishopDispatchMeshHook() and
 *  board_ipc.ts's initBoardWatcher() discipline already established in this codebase. No
 *  top-level side effects anywhere in this module -- ipcMain.handle is only ever called from
 *  inside this function, which index.ts's init sequence calls exactly once. */
export function registerBishopDispatchSendIpc(): void {
  if (_registered) return;
  _registered = true;

  ipcMain.handle(
    'bishop-dispatch:send-via-relay',
    async (_evt, req: Partial<BishopDispatchSendViaRelayRequest>) => sendBishopDispatchViaRelay(req),
  );

  console.log('[BishopDispatchSendIpc] handlers registered');
}
