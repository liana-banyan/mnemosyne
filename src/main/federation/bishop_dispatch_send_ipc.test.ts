// bishop_dispatch_send_ipc.test.ts — D-BP156-M0-020, HARDWIRE-24 mesh.
//
// OFFLINE, MOCKED. Both 'electron' (ipcMain) and mic_dispatcher's dispatchBishopDispatchViaRelay
// are stubbed; no real network call, no real Supabase relay_routes write, no real second machine
// involved, no real Electron process. Proves:
//   1. No top-level side effects -- ipcMain.handle is never called merely by importing this
//      module, only by explicitly calling registerBishopDispatchSendIpc() (requirement: "a
//      module that dispatches on import is a loaded gun").
//   2. Registration wires the exact channel name 'bishop-dispatch:send-via-relay'.
//   3. validateSendRequest rejects a missing field and rejects an untagged dispatch id with a
//      clear error, before any send is attempted.
//   4. sendBishopDispatchViaRelay calls the REAL send path (dispatchBishopDispatchViaRelay from
//      mic_dispatcher.ts) -- never a hand-rolled relay_routes INSERT -- and propagates its
//      routeId back to the caller (the sender's own receipt).
//   5. A failed send returns ok:false with the underlying error, never throws.
//
// Run: npx vitest run src/main/federation/bishop_dispatch_send_ipc.test.ts

import { describe, test, expect, vi, beforeEach } from 'vitest';

// vi.mock factories are hoisted above imports/consts, so the mock fns they close over must be
// created via vi.hoisted() rather than a plain top-level const (a plain const throws "Cannot
// access before initialization" once hoisted past its own declaration).
const { handleMock, dispatchBishopDispatchViaRelayMock } = vi.hoisted(() => ({
  handleMock: vi.fn(),
  dispatchBishopDispatchViaRelayMock: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: { handle: handleMock },
}));

vi.mock('./mic_dispatcher', async () => {
  const actual = await vi.importActual<typeof import('./mic_dispatcher')>('./mic_dispatcher');
  return {
    ...actual,
    dispatchBishopDispatchViaRelay: dispatchBishopDispatchViaRelayMock,
  };
});

vi.mock('./peer-discovery', () => ({
  getStablePeerId: () => 'self-peer-id-mock',
}));

import {
  validateSendRequest,
  sendBishopDispatchViaRelay,
  registerBishopDispatchSendIpc,
} from './bishop_dispatch_send_ipc';

describe('module import has no top-level side effects', () => {
  test('ipcMain.handle is not called merely by importing this module', () => {
    // The import above already happened at the top of this file (module load time, before any
    // test ran) -- if it had registered anything, handleMock would already show a call here.
    expect(handleMock).not.toHaveBeenCalled();
  });
});

describe('registerBishopDispatchSendIpc', () => {
  beforeEach(() => {
    handleMock.mockClear();
  });

  test('registers exactly the bishop-dispatch:send-via-relay channel', () => {
    registerBishopDispatchSendIpc();
    expect(handleMock).toHaveBeenCalledTimes(1);
    expect(handleMock.mock.calls[0][0]).toBe('bishop-dispatch:send-via-relay');
  });

  test('is idempotent -- calling it twice registers only once', () => {
    registerBishopDispatchSendIpc();
    registerBishopDispatchSendIpc();
    // _registered module-local guard means the SECOND call (relative to the previous test, which
    // already flipped it true) adds zero further registrations.
    expect(handleMock).not.toHaveBeenCalled();
  });
});

describe('validateSendRequest', () => {
  test('rejects a null/missing body', () => {
    const result = validateSendRequest(null);
    expect(result.ok).toBe(false);
  });

  test('rejects a request missing targetPeerId', () => {
    const result = validateSendRequest({
      dispatchId: 'D-BP156-M3-099', promptText: 'p', workingDir: 'C:\\wd',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/targetPeerId/);
  });

  test('rejects an untagged dispatch id with a clear error, HARDWIRE-24 Section 3', () => {
    const result = validateSendRequest({
      targetPeerId: 'peer-1', dispatchId: 'D-BP148-046', promptText: 'p', workingDir: 'C:\\wd',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not machine-tagged/);
  });

  test('accepts a fully valid, properly machine-tagged request', () => {
    const result = validateSendRequest({
      targetPeerId: 'peer-1', dispatchId: 'D-BP156-M3-099', promptText: 'p', workingDir: 'C:\\wd',
    });
    expect(result.ok).toBe(true);
  });
});

describe('sendBishopDispatchViaRelay', () => {
  beforeEach(() => {
    dispatchBishopDispatchViaRelayMock.mockReset();
  });

  test('calls the REAL send path (dispatchBishopDispatchViaRelay) with the validated fields ' +
    'and this machine\'s stable peer id, never a hand-rolled insert', async () => {
    dispatchBishopDispatchViaRelayMock.mockResolvedValueOnce({ ok: true, routeId: 'row-abc-123' });

    const result = await sendBishopDispatchViaRelay({
      targetPeerId: '61db110655432a41',
      dispatchId: 'D-BP156-M0-021',
      promptText: 'do the next thing',
      workingDir: 'C:\\Users\\Administrator\\Documents\\mnemosyne',
    });

    expect(dispatchBishopDispatchViaRelayMock).toHaveBeenCalledTimes(1);
    const callArgs = dispatchBishopDispatchViaRelayMock.mock.calls[0];
    expect(callArgs[0]).toMatchObject({ id: '61db110655432a41' }); // minimal ConstellationPeer
    expect(callArgs[1]).toBe('D-BP156-M0-021');
    expect(callArgs[2]).toBe('do the next thing');
    expect(callArgs[3]).toBe('C:\\Users\\Administrator\\Documents\\mnemosyne');
    expect(callArgs[4]).toBe('self-peer-id-mock');

    // The sender's own receipt: relay_routes row id + target peer id propagated back.
    expect(result.ok).toBe(true);
    expect(result.routeId).toBe('row-abc-123');
    expect(result.targetPeerId).toBe('61db110655432a41');
    expect(result.dispatchId).toBe('D-BP156-M0-021');
  });

  test('rejects an untagged dispatch id WITHOUT calling the send path at all', async () => {
    const result = await sendBishopDispatchViaRelay({
      targetPeerId: 'peer-1', dispatchId: 'D-BP148-046', promptText: 'p', workingDir: 'C:\\wd',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not machine-tagged/);
    expect(dispatchBishopDispatchViaRelayMock).not.toHaveBeenCalled();
  });

  test('returns ok:false (never throws) when the real send path fails', async () => {
    dispatchBishopDispatchViaRelayMock.mockResolvedValueOnce({
      ok: false, error: 'relay_routes insert failed: HTTP 500',
    });

    const result = await sendBishopDispatchViaRelay({
      targetPeerId: '61db110655432a41',
      dispatchId: 'D-BP156-M0-021',
      promptText: 'p',
      workingDir: 'C:\\wd',
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('relay_routes insert failed: HTTP 500');
    expect(result.routeId).toBeUndefined();
  });
});
