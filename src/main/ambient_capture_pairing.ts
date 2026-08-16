// ambient_capture_pairing.ts -- D-BP155-021/BISHOP/seg-oneclick-pairing
//
// ONE-CLICK PAIRING, replacing the hand-copy-a-64-char-key flow this ticket's own order names as
// costing the Founder four hours on first install ("Give me steps and I'll follow it, but also
// realize that no one will go through all these steps to do this but me"). The extension now asks
// this server for a key instead of the Founder copying one out of a tray dialog.
//
// THE ROUTE THIS MODULE BACKS (mcp_server.ts's POST /pair) IS UNAUTHENTICATED BY NECESSITY: the
// extension has no key yet, so it cannot present one. That is only safe because of everything
// below -- this file is the actual security boundary, not the HTTP route.
//
//   1. NEVER hands out the key on the strength of the request alone. requestPairing() always
//      raises a confirmation (in production, a native OS dialog via Electron's `dialog` module)
//      naming the requesting extension id, and the key is released ONLY when that confirmation
//      resolves to 'allow'. Default is deny: a confirmation that never resolves (the Founder is
//      away, or never answers) times out to denied, not granted -- see the race against
//      timeoutPromise below. Nothing in this file has a code path that returns a key without an
//      'allow' answer.
//   2. SINGLE-FLIGHT. _pendingPairing holds the in-flight promise; a second call while one is
//      already outstanding is refused immediately (never queued) so a page that fires many
//      requests cannot stack up dialogs and win a click meant for an earlier, different request.
//   3. RATE-LIMITED independently of single-flight -- pruneAndCountAttempts() enforces a hard
//      ceiling per rolling window, so a page that waits out a timeout and immediately retries
//      still cannot spam confirmations indefinitely.
//   4. EVERY OUTCOME IS LOGGED (grant, deny, timeout, and every pre-dialog rejection) via
//      console.log, which index.ts's own electron-log wiring (Object.assign(console,
//      log.functions), see that file's top) already pipes to a rotating on-disk log file --
//      the Founder can find every pairing attempt after the fact without having had to watch it
//      happen.
//
// The confirmation itself is INJECTABLE (confirmFn) specifically so this module's logic --
// single-flight, rate-limit, default-deny-on-timeout, grant-releases-the-real-key -- can be
// exercised in a test environment with no Electron `dialog` available, per this estate's own
// `_..ForTests` convention (see e.g. federation/mesh_trust_settings.ts's
// _resetMeshTrustSettingsCacheForTests). Production code never overrides it: realConfirmFn is the
// only confirmFn a live server ever uses.
//
// THIS FILE DOES NOT MINT OR STORE THE KEY ITSELF -- it only decides whether to release the one
// ambient_capture_auth.ts already mints, via that file's own getOrCreateCaptureKey(). Least
// privilege from that file's design is preserved unchanged: this is purely a new, gated way for
// the extension to LEARN the same narrow-privileged key, not a new privilege.

import { getOrCreateCaptureKey } from './ambient_capture_auth';

export interface PairingOutcome {
  granted: boolean;
  key?: string;
  port?: number;
  reason?: string;
  /** HTTP status code the caller (mcp_server.ts) should respond with. */
  status: number;
}

export type ConfirmFn = (extensionId: string) => Promise<'allow' | 'deny'>;

const DEFAULT_TIMEOUT_MS = 60_000; // a dialog that gets no answer within this denies (fail closed)
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 5; // hard ceiling per rolling window, independent of single-flight

let _pendingPairing: Promise<PairingOutcome> | null = null;
const _attemptTimestamps: number[] = [];
let _confirmFnOverride: ConfirmFn | null = null;
let _timeoutMsOverride: number | null = null;

/** Production confirmation: a native, modal OS dialog. Lazy require() (same pattern as
 *  ambient_capture_auth.ts's resolveCaptureKeyPath and mcp_server.ts's getTokenPath) so this
 *  module loads fine before Electron's `app` is ready, and so a test that injects a confirmFn
 *  override never has to load the real `electron` package at all. */
function realConfirmFn(extensionId: string): Promise<'allow' | 'deny'> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { dialog } = require('electron') as typeof import('electron');
  return dialog
    .showMessageBox({
      type: 'question',
      title: 'Allow browser extension to pair?',
      message: 'The MnemosyneC Substrate Capture extension is asking to pair with this app.',
      detail:
        `Extension id: ${extensionId}\n\n` +
        'Allowing gives this extension a narrow key that authorizes exactly two things: writing ' +
        'a capture (POST /capture) and reading a status line (GET /capture/status). It cannot do ' +
        'anything else this app exposes -- not the full MCP tool set, nothing beyond a capture ' +
        'write. You can revoke or rotate this key any time from the tray menu ' +
        '("Ambient Browser Capture Key...").',
      buttons: ['Deny', 'Allow'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    })
    .then((result) => (result.response === 1 ? 'allow' : 'deny'));
}

function pruneAndCountAttempts(): number {
  const now = Date.now();
  while (_attemptTimestamps.length && now - _attemptTimestamps[0] > RATE_LIMIT_WINDOW_MS) {
    _attemptTimestamps.shift();
  }
  return _attemptTimestamps.length;
}

function logPairingEvent(kind: 'GRANT' | 'DENY' | 'REJECT', extensionId: string, reason: string): void {
  console.log(`[AmbientCapturePairing] ${kind} extensionId=${extensionId} reason=${reason}`);
}

/** THE single entry point mcp_server.ts's POST /pair route calls. Never returns a key except on
 *  an explicit 'allow' from confirmFn (or its real-dialog default). */
export async function requestPairing(extensionId: string, port: number): Promise<PairingOutcome> {
  if (_pendingPairing) {
    logPairingEvent('REJECT', extensionId, 'pairing_already_in_progress');
    return { granted: false, reason: 'pairing_already_in_progress', status: 409 };
  }

  if (pruneAndCountAttempts() >= RATE_LIMIT_MAX_ATTEMPTS) {
    logPairingEvent('REJECT', extensionId, 'rate_limited');
    return { granted: false, reason: 'rate_limited', status: 429 };
  }
  _attemptTimestamps.push(Date.now());

  const confirmFn = _confirmFnOverride || realConfirmFn;
  const timeoutMs = _timeoutMsOverride ?? DEFAULT_TIMEOUT_MS;

  const run = (async (): Promise<PairingOutcome> => {
    let timeoutHandle: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<PairingOutcome>((resolve) => {
      timeoutHandle = setTimeout(() => resolve({ granted: false, reason: 'timeout', status: 403 }), timeoutMs);
    });
    const confirmPromise = confirmFn(extensionId)
      .then((answer): PairingOutcome => {
        if (answer === 'allow') {
          return { granted: true, key: getOrCreateCaptureKey(), port, status: 200 };
        }
        return { granted: false, reason: 'denied', status: 403 };
      })
      .catch((e): PairingOutcome => ({
        granted: false,
        reason: `confirm_threw: ${String((e && e.message) || e)}`,
        status: 500,
      }));

    const outcome = await Promise.race([confirmPromise, timeoutPromise]);
    clearTimeout(timeoutHandle!);
    return outcome;
  })();

  _pendingPairing = run;
  let outcome: PairingOutcome;
  try {
    outcome = await run;
  } finally {
    _pendingPairing = null;
  }

  logPairingEvent(outcome.granted ? 'GRANT' : 'DENY', extensionId, outcome.reason || 'allowed');
  return outcome;
}

// ── Test hooks, `_..ForTests` convention (see this repo's federation/mesh_trust_settings.ts) ───

export function _setConfirmFnForTests(fn: ConfirmFn | null): void {
  _confirmFnOverride = fn;
}

export function _setPairingTimeoutMsForTests(ms: number | null): void {
  _timeoutMsOverride = ms;
}

export function _resetPairingStateForTests(): void {
  _pendingPairing = null;
  _attemptTimestamps.length = 0;
  _confirmFnOverride = null;
  _timeoutMsOverride = null;
}
