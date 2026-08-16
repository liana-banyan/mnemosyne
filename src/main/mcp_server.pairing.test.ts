// mcp_server.pairing.test.ts -- D-BP155-021/BISHOP/seg-oneclick-pairing
//
// LIVE INTEGRATION TEST over the REAL startMcpServer() HTTP server, POSTing to /pair exactly as
// browser-extension/bridge/local_mcp_client.js's background-service-worker fetch() will. Follows
// this repo's own established pattern for this exact route family
// (mcp_server.ambient_capture.test.ts) -- same isolation discipline (LB_EVIDENCE_DIR,
// MNEMO_CAPTURE_KEY_DIR pointed at fresh temp dirs, MNEMO_MCP_PORT pinned to a private port).
//
// The one addition this route needs beyond that pattern: requestPairing() would otherwise raise a
// REAL native OS dialog, which cannot run in a test process. ambient_capture_pairing.ts's own
// `_..ForTests` hooks (_setConfirmFnForTests, _setPairingTimeoutMsForTests,
// _resetPairingStateForTests) exist for exactly this -- inject a synthetic confirmation instead of
// Electron's `dialog`, and shrink the default-deny timeout so the timeout test does not take 60
// real seconds.

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as http from 'node:http';

const TEST_PORT = 18457; // different private port than mcp_server.ambient_capture.test.ts's 18456
let evidenceDir: string;
let captureKeyDir: string;
const EXT_ID = 'abcdefghijklmnopabcdefghijklmnop'; // 32 chars, a-p -- a syntactically valid chrome extension id

beforeAll(() => {
  evidenceDir = mkdtempSync(join(tmpdir(), 'lb-mcp-pairing-evidence-'));
  captureKeyDir = mkdtempSync(join(tmpdir(), 'lb-mcp-pairing-key-'));
  process.env.LB_EVIDENCE_DIR = evidenceDir;
  process.env.MNEMO_CAPTURE_KEY_DIR = captureKeyDir;
  process.env.MNEMO_MCP_PORT = String(TEST_PORT);
});

afterAll(async () => {
  const { stopMcpServer } = await import('./mcp_server');
  await stopMcpServer();
  rmSync(evidenceDir, { recursive: true, force: true });
  rmSync(captureKeyDir, { recursive: true, force: true });
  delete process.env.LB_EVIDENCE_DIR;
  delete process.env.MNEMO_CAPTURE_KEY_DIR;
  delete process.env.MNEMO_MCP_PORT;
});

beforeEach(async () => {
  const { _resetPairingStateForTests, _setPairingTimeoutMsForTests } = await import('./ambient_capture_pairing');
  _resetPairingStateForTests();
  _setPairingTimeoutMsForTests(200); // real dialogs get 60s; tests get 200ms so a timeout test is fast
});

/** POST /pair with a plain fetch (browser-extension-shaped: a chrome-extension:// Origin, no
 *  auth header of any kind -- there is no key yet, that is the whole point of this route). */
function postPair(headers: Record<string, string> = { Origin: `chrome-extension://${EXT_ID}` }): Promise<Response> {
  return fetch(`http://127.0.0.1:${TEST_PORT}/pair`, { method: 'POST', headers });
}

/** Raw node:http request, used only for the Host-header test below -- the standard fetch() API
 *  forbids overriding the Host header (it is a "forbidden request header" per the Fetch spec), so
 *  a real browser extension could never send a spoofed Host either; this proves the server-side
 *  check is still correct defense in depth even though nothing in-browser can trigger it. */
function rawPairRequest(headers: Record<string, string>): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port: TEST_PORT, path: '/pair', method: 'POST', headers },
      (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => resolve({ status: res.statusCode || 0, body }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

describe('POST /pair (real running HTTP server)', () => {
  test('denies by default: no confirmation ever answers, times out to denied, no key released', async () => {
    const { startMcpServer } = await import('./mcp_server');
    const { _setConfirmFnForTests } = await import('./ambient_capture_pairing');
    await startMcpServer();

    // A confirmFn that never resolves -- models a dialog the Founder never clicks. The 200ms
    // timeout set in beforeEach is what actually ends this, not the confirmation.
    _setConfirmFnForTests(() => new Promise(() => { /* never resolves */ }));

    const res = await postPair();
    expect(res.status).toBe(403);
    const body = await res.json() as { paired: boolean; reason: string; key?: string };
    expect(body.paired).toBe(false);
    expect(body.reason).toBe('timeout');
    expect(body.key).toBeUndefined();
  });

  test('only releases the key after an explicit allow', async () => {
    const { _setConfirmFnForTests } = await import('./ambient_capture_pairing');
    const { getOrCreateCaptureKey } = await import('./ambient_capture_auth');
    const realKey = getOrCreateCaptureKey();

    _setConfirmFnForTests(async () => 'allow');
    const res = await postPair();
    expect(res.status).toBe(200);
    const body = await res.json() as { paired: boolean; key: string; port: number };
    expect(body.paired).toBe(true);
    expect(body.key).toBe(realKey);
    expect(body.port).toBe(TEST_PORT);
  });

  test('an explicit deny releases nothing', async () => {
    const { _setConfirmFnForTests } = await import('./ambient_capture_pairing');
    _setConfirmFnForTests(async () => 'deny');
    const res = await postPair();
    expect(res.status).toBe(403);
    const body = await res.json() as { paired: boolean; reason: string; key?: string };
    expect(body.paired).toBe(false);
    expect(body.reason).toBe('denied');
    expect(body.key).toBeUndefined();
  });

  test('the key /pair hands out DOES authorize /capture (it is the same narrow key, proven not asserted)', async () => {
    const { _setConfirmFnForTests } = await import('./ambient_capture_pairing');
    _setConfirmFnForTests(async () => 'allow');
    const pairRes = await postPair();
    const { key } = await pairRes.json() as { key: string };

    const statusRes = await fetch(`http://127.0.0.1:${TEST_PORT}/capture/status`, {
      headers: { 'X-Mnemo-Capture-Key': key },
    });
    expect(statusRes.status).toBe(200);
    const statusBody = await statusRes.json() as { connected: boolean };
    expect(statusBody.connected).toBe(true);
  });

  test('rejects a non-extension Origin before any confirmation is raised (dialog never called)', async () => {
    const { _setConfirmFnForTests } = await import('./ambient_capture_pairing');
    let confirmCalled = false;
    _setConfirmFnForTests(async () => { confirmCalled = true; return 'allow'; });

    const res = await postPair({ Origin: 'https://evil.example.com' });
    expect(res.status).toBe(403);
    const body = await res.json() as { paired: boolean; reason: string };
    expect(body.paired).toBe(false);
    expect(body.reason).toBe('origin_not_extension');
    expect(confirmCalled).toBe(false);
  });

  test('rejects a missing Origin header', async () => {
    const res = await postPair({});
    expect(res.status).toBe(403);
    const body = await res.json() as { reason: string };
    expect(body.reason).toBe('origin_not_extension');
  });

  test('rejects a malformed chrome-extension id (wrong length / wrong alphabet)', async () => {
    const res = await postPair({ Origin: 'chrome-extension://not-a-real-id' });
    expect(res.status).toBe(403);
    const body = await res.json() as { reason: string };
    expect(body.reason).toBe('origin_not_extension');
  });

  test('rejects a spoofed non-loopback Host header (raw request, fetch cannot even send this)', async () => {
    const { status, body } = await rawPairRequest({
      Origin: `chrome-extension://${EXT_ID}`,
      Host: 'evil.example.com',
      'Content-Length': '0',
    });
    expect(status).toBe(403);
    expect(JSON.parse(body).reason).toBe('host_not_loopback');
  });

  test('single-flight: a second concurrent request while one is pending is refused with 409, first still resolves', async () => {
    const { _setConfirmFnForTests } = await import('./ambient_capture_pairing');
    let releaseFirst: (v: 'allow') => void;
    const firstAnswer = new Promise<'allow'>((resolve) => { releaseFirst = resolve; });
    _setConfirmFnForTests(() => firstAnswer);

    const firstReq = postPair(); // starts, awaits firstAnswer -- do not await this yet

    // Give the event loop a turn so the first request has definitely entered requestPairing()
    // and set _pendingPairing before the second one races it.
    await new Promise((r) => setTimeout(r, 20));

    const secondRes = await postPair();
    expect(secondRes.status).toBe(409);
    const secondBody = await secondRes.json() as { reason: string };
    expect(secondBody.reason).toBe('pairing_already_in_progress');

    releaseFirst!('allow');
    const firstRes = await firstReq;
    expect(firstRes.status).toBe(200);
  });

  test('rate limit: a 6th attempt within the window is refused with 429', async () => {
    const { _setConfirmFnForTests } = await import('./ambient_capture_pairing');
    _setConfirmFnForTests(async () => 'deny'); // resolves fast, so single-flight never blocks this loop

    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await postPair();
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5)).toEqual([403, 403, 403, 403, 403]); // 5 real denies
    expect(statuses[5]).toBe(429); // the 6th attempt is rate-limited, never reaches the confirmation
  });
});
