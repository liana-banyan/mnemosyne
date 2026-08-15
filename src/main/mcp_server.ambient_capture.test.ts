// mcp_server.ambient_capture.test.ts -- D-BP154-074/BISHOP-SEG/S74/seg-ambient
//
// LIVE INTEGRATION TEST, not a mock of the route logic: starts the REAL startMcpServer() HTTP
// server on a private port, POSTs to /capture exactly as browser-extension/bridge/
// local_mcp_client.js's background-service-worker fetch() will, then reads the written record
// back OFF DISK (not from the HTTP response) -- the same "read back off disk to confirm" standard
// the order itself sets as the acceptance bar.
//
// Isolation (estate hard rule, BP148 adversarial pass: 49/123 test files once wrote synthetic
// records into LIVE stores with no cleanup): LB_EVIDENCE_DIR and MNEMO_CAPTURE_KEY_DIR are both
// pointed at fresh OS temp directories, set BEFORE any import that could read them, and removed
// in afterAll. MNEMO_MCP_PORT is pinned to a high, unlikely-collision port so this test never
// fights the real running app for :11456.

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TEST_PORT = 18456;
let evidenceDir: string;
let captureKeyDir: string;

beforeAll(() => {
  evidenceDir = mkdtempSync(join(tmpdir(), 'lb-mcp-ambient-evidence-'));
  captureKeyDir = mkdtempSync(join(tmpdir(), 'lb-mcp-ambient-key-'));
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

describe('POST /capture (real running HTTP server)', () => {
  test('accepts a real capture, responds 200, and the record reads back off disk verbatim', async () => {
    const { startMcpServer } = await import('./mcp_server');
    const { getOrCreateCaptureKey } = await import('./ambient_capture_auth');
    await startMcpServer();
    const key = getOrCreateCaptureKey();
    expect(key.length).toBeGreaterThanOrEqual(32);

    const capturedAt = new Date().toISOString();
    const payload = {
      query: 'What is the capital of Australia',
      answer: 'Canberra is the capital city of Australia, chosen as a compromise between Sydney and Melbourne.',
      surface: 'gemini.google.com',
      url: 'https://gemini.google.com/app/live-test',
      capturedAt,
    };

    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Mnemo-Capture-Key': key },
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { recorded: boolean; queryKey: string; address: string; acquisitionId: string };
    expect(body.recorded).toBe(true);
    expect(body.queryKey).toBeTruthy();
    expect(body.acquisitionId).toContain('ambient_gemini.google.com_');

    // READ BACK OFF DISK -- not the HTTP response, the actual file the server wrote.
    const files = readdirSync(evidenceDir).filter((f) => f.startsWith('EVIDENCE_free-text_'));
    expect(files.length).toBe(1);
    const raw = readFileSync(join(evidenceDir, files[0]), 'utf8').trim();
    const onDisk = JSON.parse(raw.split('\n')[0]) as {
      authority: string; query: string; response: { mechanism: string; answer: string; surface: string; url: string };
    };
    expect(onDisk.authority).toBe('ambient_browser');
    expect(onDisk.query).toBe(payload.query);
    expect(onDisk.response.mechanism).toBe('AMBIENT_BROWSER_CAPTURE');
    expect(onDisk.response.answer).toBe(payload.answer);
    expect(onDisk.response.surface).toBe('gemini.google.com');
    expect(onDisk.response.url).toBe(payload.url);

    // ── Report the record verbatim (visible in the vitest FOREGROUND run's own stdout, per the
    // order's own "Report the evidence record verbatim" acceptance bar) ──
    // eslint-disable-next-line no-console
    console.log('[ACCEPTANCE RECORD, VERBATIM, OFF DISK]', raw);
  });

  test('rejects without the capture key (401), and rejects the WRONG key too', async () => {
    const payload = { query: 'anything', answer: 'anything at all', surface: 'gemini.google.com', url: 'https://x', capturedAt: new Date().toISOString() };
    const noKey = await fetch(`http://127.0.0.1:${TEST_PORT}/capture`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    expect(noKey.status).toBe(401);

    const wrongKey = await fetch(`http://127.0.0.1:${TEST_PORT}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Mnemo-Capture-Key': 'not-the-real-key-0000000000000000000000000000' },
      body: JSON.stringify(payload),
    });
    expect(wrongKey.status).toBe(401);
  });

  test('the capture key does NOT authorize /mcp (least-privilege boundary, proven not asserted)', async () => {
    const { getOrCreateCaptureKey } = await import('./ambient_capture_auth');
    const key = getOrCreateCaptureKey();
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
    });
    expect(res.status).toBe(401);
  });

  test('GET /capture/status reports connected:true and the running capture count', async () => {
    const { getOrCreateCaptureKey } = await import('./ambient_capture_auth');
    const key = getOrCreateCaptureKey();
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/capture/status`, {
      headers: { 'X-Mnemo-Capture-Key': key },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { connected: boolean; running: boolean; capturesRecorded: number };
    expect(body.connected).toBe(true);
    expect(body.running).toBe(true);
    expect(body.capturesRecorded).toBeGreaterThanOrEqual(1);
  });

  test('rejects an echoed-prompt / page-chrome capture with 422 and writes nothing new', async () => {
    const { getOrCreateCaptureKey } = await import('./ambient_capture_auth');
    const key = getOrCreateCaptureKey();
    const before = readdirSync(evidenceDir).filter((f) => f.startsWith('EVIDENCE_free-text_')).length;
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Mnemo-Capture-Key': key },
      body: JSON.stringify({
        query: 'What time zone is Perth in',
        answer: 'Sign in to save your activity across Google services.',
        surface: 'google.com',
        url: 'https://www.google.com/search?q=x',
        capturedAt: new Date().toISOString(),
      }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as { recorded: boolean; reason: string };
    expect(body.recorded).toBe(false);
    expect(body.reason).toMatch(/none of the query/);
    const after = readdirSync(evidenceDir).filter((f) => f.startsWith('EVIDENCE_free-text_')).length;
    expect(after).toBe(before);
  });
});
