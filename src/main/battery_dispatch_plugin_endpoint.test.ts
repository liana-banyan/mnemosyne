// battery_dispatch_plugin_endpoint.test.ts -- D-BP151-042/BISHOP/seg-battery-dispatch-endpoint
//
// Same no-framework convention as cdp_guard.test.ts / mnem_eblet_store.test.ts: manual assert(),
// run via plain `node` against the COMPILED output (`npm run build:main` first). Uses the same
// require.cache electron-mock technique cdp_guard.test.ts established (itself citing
// mnem_eblet_store.test.ts's Test 3) to give this module a real, writable fake `userData` dir
// without spawning a real Electron process -- `app.getPath` is the only Electron API this module
// touches.
//
// Run (after `npm run build:main`):
//   node src\main\battery_dispatch_plugin_endpoint.test.ts
//
// What this proves (this ticket's own acceptance bar, restated as assertions):
//   1. isBatteryDispatchPluginEndpointEnabled(): off by default; explicit true wins; env var wins.
//   2. startBatteryDispatchPluginEndpoint(): REFUSES a non-loopback host synchronously.
//   3. Real HTTP, real network, no mocking of http/net:
//      - unauthenticated request -> 401, never reaches a verb handler
//      - wrong Bearer token -> 401
//      - handshake (correct token) -> 200, lists the exact 4-verb set
//      - register -> registrationId; invalid pluginId -> 400
//      - heartbeat: known id -> stillRegistered:true; unknown id -> stillRegistered:false (not
//        an error)
//      - unregister -> wasRegistered:true; a second unregister of the same id -> false
//      - unknown route -> 404
//      - oversized body -> rejected, never parsed
//   4. REAL connection-refused proof from this machine's own real LAN-facing IPv4 address (not
//      127.0.0.1) -- the loopback-only bind claim, proven, not assumed.
//   5. No session/cookie/credential-shaped field is accepted anywhere in the request/response
//      shapes exercised above (structural -- confirmed by code review in the SEG return; this
//      harness additionally confirms the registry record shape carries only pluginId/
//      displayName/registrationId/timestamps).

(async function main(): Promise<void> {

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const crypto = require('crypto');

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ` -- ${detail}` : ''}`);
    failed++;
  }
}

const DIST_MODULE_PATH = path.join(__dirname, '..', '..', 'dist', 'main', 'battery_dispatch_plugin_endpoint');
if (!fs.existsSync(DIST_MODULE_PATH + '.js')) {
  console.error(
    `FATAL: ${DIST_MODULE_PATH}.js does not exist. Run \`npm run build:main\` first -- ` +
      'this test requires the COMPILED output (see file header for why).',
  );
  process.exit(2);
}

const electronResolvedPath = require.resolve('electron');
const distResolvedPath = require.resolve(DIST_MODULE_PATH);

const fakeUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bde-test-'));

/** Injects a fake `electron` module exposing app.getPath('userData') = a real temp dir, then
 *  requires a FRESH copy of the compiled module so its static `import { app } from 'electron'`
 *  binding picks up the fake -- identical technique to cdp_guard.test.ts. */
function freshModuleWithFakeApp(): { mod: any; restore: () => void } {
  const savedElectronEntry = require.cache[electronResolvedPath];
  const savedDistEntry = require.cache[distResolvedPath];
  delete require.cache[distResolvedPath];
  require.cache[electronResolvedPath] = {
    id: electronResolvedPath,
    filename: electronResolvedPath,
    loaded: true,
    exports: { app: { getPath: (_name: string) => fakeUserDataDir, isPackaged: false } },
  } as any;
  const mod = require(DIST_MODULE_PATH);
  const restore = () => {
    delete require.cache[distResolvedPath];
    if (savedElectronEntry) require.cache[electronResolvedPath] = savedElectronEntry;
    else delete require.cache[electronResolvedPath];
    if (savedDistEntry) require.cache[distResolvedPath] = savedDistEntry;
  };
  return { mod, restore };
}

console.log('\n=== battery_dispatch_plugin_endpoint harness (D-BP151-042) ===\n');

// ── 1: isBatteryDispatchPluginEndpointEnabled -- off by default ───────────────────────────
{
  const { mod, restore } = freshModuleWithFakeApp();
  const { isBatteryDispatchPluginEndpointEnabled } = mod;
  delete process.env.BATTERY_DISPATCH_ENDPOINT;
  assert(isBatteryDispatchPluginEndpointEnabled() === false, 'off by default: no arg, no env var -> false');
  assert(isBatteryDispatchPluginEndpointEnabled(false) === false, 'off by default: explicit false -> false');
  assert(isBatteryDispatchPluginEndpointEnabled(true) === true, 'explicit true argument -> true');
  process.env.BATTERY_DISPATCH_ENDPOINT = '1';
  assert(isBatteryDispatchPluginEndpointEnabled() === true, 'BATTERY_DISPATCH_ENDPOINT=1 env var -> true');
  delete process.env.BATTERY_DISPATCH_ENDPOINT;
  assert(isBatteryDispatchPluginEndpointEnabled() === false, 'env var cleared -> back to false');
  restore();
}

// ── 2: non-loopback bind is refused synchronously ──────────────────────────────────────────
{
  const { mod, restore } = freshModuleWithFakeApp();
  let threw = false;
  let message = '';
  try {
    mod.startBatteryDispatchPluginEndpoint(19999, '0.0.0.0');
  } catch (err: any) {
    threw = true;
    message = String(err?.message ?? err);
  }
  restore();
  assert(threw === true, 'startBatteryDispatchPluginEndpoint("0.0.0.0"): throws synchronously, refuses to bind', message);
  assert(/127\.0\.0\.1/.test(message), 'refusal message names 127.0.0.1 as the only accepted host', message);
}

// ── 3: real HTTP server, real network, real verbs ──────────────────────────────────────────
{
  const { mod, restore } = freshModuleWithFakeApp();
  const TEST_PORT = 19560;
  const server = mod.startBatteryDispatchPluginEndpoint(TEST_PORT, '127.0.0.1');

  await new Promise((r) => setTimeout(r, 150)); // let listen() settle

  const token = mod.readCurrentToken();
  assert(typeof token === 'string' && token.length >= 32, 'a real Bearer token was generated on disk', String(token));

  function request(pathName: string, opts: { method?: string; token?: string | null; body?: unknown; host?: string } = {}): Promise<{ status: number; json: any }> {
    return new Promise((resolvePromise, reject) => {
      const bodyStr = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;
      const req = http.request(
        {
          host: opts.host ?? '127.0.0.1',
          port: TEST_PORT,
          path: pathName,
          method: opts.method ?? 'POST',
          timeout: 3000,
          headers: {
            'Content-Type': 'application/json',
            ...(opts.token === null ? {} : { Authorization: `Bearer ${opts.token ?? token}` }),
            ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
          },
        },
        (res: any) => {
          let data = '';
          res.on('data', (c: Buffer) => { data += c.toString('utf8'); });
          res.on('end', () => {
            let json: any = null;
            try { json = JSON.parse(data); } catch { /* leave null */ }
            resolvePromise({ status: res.statusCode, json });
          });
        },
      );
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      req.on('error', reject);
      if (bodyStr) req.write(bodyStr);
      req.end();
    });
  }

  // 3a: no token -> 401, never reaches a verb handler
  {
    const { status, json } = await request('/v1/handshake', { token: null });
    assert(status === 401, 'no Authorization header -> 401', String(status));
    assert(json?.ok === false, '401 body has ok:false');
  }

  // 3b: wrong token -> 401
  {
    const { status } = await request('/v1/handshake', { token: 'not-the-real-token-'.padEnd(64, 'x') });
    assert(status === 401, 'wrong Bearer token -> 401 (never partial-matches)');
  }

  // 3c: correct token, handshake -> 200, exact verb set
  {
    const { status, json } = await request('/v1/handshake');
    assert(status === 200, 'handshake with correct token -> 200', String(status));
    assert(json?.ok === true, 'handshake ok:true');
    assert(
      Array.isArray(json?.verbs) && json.verbs.length === 4 &&
        ['handshake', 'register', 'heartbeat', 'unregister'].every((v) => json.verbs.includes(v)),
      'handshake reports the exact 4-verb set, nothing more',
      JSON.stringify(json?.verbs),
    );
  }

  // 3d: register -- invalid pluginId rejected
  {
    const { status, json } = await request('/v1/register', { body: { pluginId: 'BAD ID!!', displayName: 'x' } });
    assert(status === 400, 'register: invalid pluginId format -> 400', String(status));
    assert(json?.ok === false, 'register: rejection body has ok:false');
  }

  // 3e: register -- valid, returns registrationId; response carries ONLY the announced fields
  let registrationId = '';
  {
    const { status, json } = await request('/v1/register', { body: { pluginId: 'demo_social_plugin', displayName: 'Demo Social Plugin' } });
    assert(status === 200, 'register: valid pluginId+displayName -> 200', String(status));
    assert(typeof json?.registrationId === 'string' && json.registrationId.length > 0, 'register: returns a registrationId');
    const keys = Object.keys(json).sort();
    assert(
      keys.every((k) => ['ok', 'registrationId', 'registeredAt'].includes(k)),
      'register response carries only ok/registrationId/registeredAt -- no cookie/session/token-shaped field',
      JSON.stringify(keys),
    );
    registrationId = json.registrationId;
  }

  // 3f: heartbeat -- known id
  {
    const { status, json } = await request('/v1/heartbeat', { body: { registrationId } });
    assert(status === 200 && json?.stillRegistered === true, 'heartbeat: known registrationId -> stillRegistered:true', JSON.stringify(json));
  }

  // 3g: heartbeat -- unknown id is reported, not an error
  {
    const { status, json } = await request('/v1/heartbeat', { body: { registrationId: 'not-a-real-id' } });
    assert(status === 200 && json?.stillRegistered === false, 'heartbeat: unknown registrationId -> 200 with stillRegistered:false (not a 4xx)', JSON.stringify(json));
  }

  // 3h: unregister -- known id, then idempotent second call
  {
    const first = await request('/v1/unregister', { body: { registrationId } });
    assert(first.status === 200 && first.json?.wasRegistered === true, 'unregister: known id -> wasRegistered:true', JSON.stringify(first.json));
    const second = await request('/v1/unregister', { body: { registrationId } });
    assert(second.status === 200 && second.json?.wasRegistered === false, 'unregister: same id again -> wasRegistered:false, no error', JSON.stringify(second.json));
  }

  // 3i: unknown route -> 404
  {
    const { status } = await request('/v1/does-not-exist');
    assert(status === 404, 'unknown route -> 404 (no arbitrary verb reachable)', String(status));
  }

  // 3j: oversized body rejected
  {
    const hugeName = 'x'.repeat(20 * 1024);
    const { status } = await request('/v1/register', { body: { pluginId: 'demo_social_plugin', displayName: hugeName } });
    assert(status === 400, 'register: oversized (>8KB) body rejected, never parsed as JSON that far', String(status));
  }

  // 3k: registry log on disk carries only the announced, non-secret fields
  {
    const logPath = path.join(fakeUserDataDir, 'battery_dispatch_plugins', 'registry.jsonl');
    assert(fs.existsSync(logPath), 'append-only registry audit log was written to disk', logPath);
    const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean);
    assert(lines.length >= 2, 'registry log has a register + unregister event', String(lines.length));
    for (const line of lines) {
      const evt = JSON.parse(line);
      const keys = Object.keys(evt);
      assert(
        keys.every((k) => ['type', 'pluginId', 'displayName', 'registrationId', 'at'].includes(k)),
        'registry log event carries only type/pluginId/displayName/registrationId/at -- never a token/cookie/session field',
        JSON.stringify(keys),
      );
    }
  }

  // ── 4: REAL loopback-only proof -- connect from this machine's own real LAN-facing IPv4 ──
  {
    const nets = os.networkInterfaces();
    let lanIp: string | null = null;
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] ?? []) {
        if (net.family === 'IPv4' && !net.internal) { lanIp = net.address; break; }
      }
      if (lanIp) break;
    }
    if (!lanIp) {
      console.warn('  (skip) no non-internal IPv4 interface found on this machine -- cannot run the LAN-IP refusal proof');
    } else {
      let refused = false;
      let detail = '';
      try {
        await request('/v1/handshake', { host: lanIp });
        detail = 'connection SUCCEEDED (this would be a real exposure)';
      } catch (err: any) {
        refused = true;
        detail = String(err?.message ?? err);
      }
      assert(refused === true, `REAL connection attempt to this machine's own LAN IP (${lanIp}:${TEST_PORT}) is refused/times out -- loopback-only bind proven, not assumed`, detail);
    }
  }

  await new Promise<void>((r) => server.close(() => r()));
  restore();
}

// ── 5: D-BP151-042 CORRECTION -- imported auth, but the two token files/values stay SEPARATE ──
// Founder ruling, relayed BP151 verbatim: "YES please fix the Battery Dispatch endpoint to
// import the function but still keep the tokens separate, agreed." This proves BOTH halves with
// real files on real disk (same fake userData dir both modules share) -- not just that imports
// resolve, but that the two servers' credentials are genuinely independent secrets.
{
  const OPENAI_DIST_PATH = path.join(__dirname, '..', '..', 'dist', 'main', 'openai_compat_server');
  if (!fs.existsSync(OPENAI_DIST_PATH + '.js')) {
    console.error(`FATAL: ${OPENAI_DIST_PATH}.js does not exist -- run npm run build:main first.`);
    failed++;
  } else {
    const openaiResolvedPath = require.resolve(OPENAI_DIST_PATH);
    const savedElectronEntry = require.cache[electronResolvedPath];
    const savedOpenaiEntry = require.cache[openaiResolvedPath];
    const savedDistEntry = require.cache[distResolvedPath];
    delete require.cache[openaiResolvedPath];
    delete require.cache[distResolvedPath];
    require.cache[electronResolvedPath] = {
      id: electronResolvedPath,
      filename: electronResolvedPath,
      loaded: true,
      exports: { app: { getPath: (_name: string) => fakeUserDataDir, isPackaged: false } },
    } as any;

    const bde = require(DIST_MODULE_PATH);
    const openai = require(OPENAI_DIST_PATH);

    // Force both token files into existence.
    bde.ensureTokenFileExists();
    // openai_compat_server.ts's own ensureTokenFileExists() is not exported (private) -- but
    // readCurrentToken() returning non-null after a real server start (section 3 above already
    // ran one full battery-dispatch server lifecycle) is not enough to prove THIS server's own
    // file; use the shared generic primitive directly, exactly as openai_compat_server.ts's own
    // module-private wrapper does, to materialize ITS file under its OWN filename.
    openai.ensureBearerTokenFileExists(openai.getTokenFilePath(), '[openai_compat_server]');

    const bdePath = bde.getTokenFilePath();
    const openaiPath = openai.getTokenFilePath();
    assert(bdePath !== openaiPath, 'the two servers resolve to DIFFERENT token file paths', `${bdePath} vs ${openaiPath}`);
    assert(path.basename(bdePath) === 'battery_dispatch_endpoint_token.txt', 'battery dispatch token filename is battery_dispatch_endpoint_token.txt', bdePath);
    assert(path.basename(openaiPath) === 'openai_compat_server_token.txt', 'openai-compat token filename is openai_compat_server_token.txt', openaiPath);

    const bdeToken1 = bde.readCurrentToken();
    const openaiToken1 = openai.readCurrentToken();
    assert(typeof bdeToken1 === 'string' && bdeToken1.length >= 32, 'battery dispatch token exists on disk');
    assert(typeof openaiToken1 === 'string' && openaiToken1.length >= 32, 'openai-compat token exists on disk');
    assert(bdeToken1 !== openaiToken1, 'the two token VALUES are different (never the same secret)', `${bdeToken1?.slice(0, 6)}... vs ${openaiToken1?.slice(0, 6)}...`);

    // Cross-auth must fail: a real request bearing the OPENAI token must NOT authorize against
    // the battery-dispatch path, and vice versa (isAuthorizedBearer is path-scoped).
    const fakeReqWithOpenaiToken = { headers: { authorization: `Bearer ${openaiToken1}` } } as any;
    const fakeReqWithBdeToken = { headers: { authorization: `Bearer ${bdeToken1}` } } as any;
    assert(
      bde.isAuthorized(fakeReqWithOpenaiToken) === false,
      "the openai-compat server's token does NOT authorize against the battery dispatch endpoint's own path",
    );
    assert(
      openai.isAuthorizedBearer(fakeReqWithBdeToken, openaiPath, '[test]') === false,
      "the battery dispatch endpoint's token does NOT authorize against the openai-compat server's own path",
    );
    assert(
      bde.isAuthorized(fakeReqWithBdeToken) === true,
      'the battery dispatch endpoint DOES authorize its own correct token (sanity check)',
    );

    // Rotate ONLY the battery-dispatch token (simulate a manual on-disk rotation) and confirm the
    // openai-compat token is completely unaffected -- independent blast radius, not shared state.
    fs.writeFileSync(bdePath, crypto.randomBytes(32).toString('hex'), { encoding: 'utf8', mode: 0o600 });
    const bdeToken2 = bde.readCurrentToken();
    const openaiToken2 = openai.readCurrentToken();
    assert(bdeToken2 !== bdeToken1, 'rotating the battery dispatch token file changes what readCurrentToken() returns for IT', undefined);
    assert(openaiToken2 === openaiToken1, "rotating the battery dispatch token left the openai-compat server's token COMPLETELY UNCHANGED", `before=${openaiToken1?.slice(0,6)}... after=${openaiToken2?.slice(0,6)}...`);
    assert(
      bde.isAuthorized({ headers: { authorization: `Bearer ${bdeToken2}` } } as any) === true,
      'the battery dispatch endpoint works with its NEW rotated token',
    );
    assert(
      openai.isAuthorizedBearer({ headers: { authorization: `Bearer ${openaiToken2}` } } as any, openaiPath, '[test]') === true,
      "the openai-compat server still works with its OWN (never-rotated) token -- rotating one file never breaks the other",
    );

    delete require.cache[openaiResolvedPath];
    delete require.cache[distResolvedPath];
    if (savedElectronEntry) require.cache[electronResolvedPath] = savedElectronEntry;
    else delete require.cache[electronResolvedPath];
    if (savedOpenaiEntry) require.cache[openaiResolvedPath] = savedOpenaiEntry;
    if (savedDistEntry) require.cache[distResolvedPath] = savedDistEntry;
  }
}

// ── Summary ─────────────────────────────────────────────────────────────────────────────

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
try { fs.rmSync(fakeUserDataDir, { recursive: true, force: true }); } catch { /* noop */ }
if (failed > 0) process.exit(1);

})().catch((err) => {
  console.error('FATAL: test harness threw:', err);
  process.exit(2);
});
