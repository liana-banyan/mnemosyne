// peer_artifact_verify.test.ts -- D-BP151-045/BISHOP/seg-peer-download-verify
//
// Same no-framework convention as battery_dispatch_plugin_endpoint.test.ts / cdp_guard.test.ts:
// manual assert(), run via plain `node` against the COMPILED output (`npm run build:main` first).
// Uses the same require.cache electron-mock technique to give the Thorax keypair module a real,
// writable fake `userData` dir without spawning a real Electron process.
//
// Run (after `npm run build:main`):
//   node src\main\keys_engines\peer_artifact_verify.test.ts
//
// What this proves (this ticket's own acceptance bar, restated as assertions):
//   1. A correctly-signed/hashed artifact from a real peer_artifact_server is ACCEPTED and its
//      bytes land at the expected cache path, byte-for-byte identical to what was served.
//   2. A peer that signs the TRUE hash but serves DIFFERENT bytes (tampered in transit / on the
//      peer's disk) is REFUSED -- Gate 3 (post-download hash check).
//   3. A peer that returns a hash with NO signature fields at all is REFUSED -- Gate 2.
//   4. A peer that returns a hash with a corrupted/invalid signature is REFUSED -- Gate 2.
//   5. Every refusal above is logged via console.warn with a reason string containing "REFUSED".
//   6. Nothing partial or unverified is ever left at the real cache path, and no temp download
//      file is left behind, after any refusal.
//
// Test artifacts use a version string unique to this ticket (never a real installer version) so
// this harness cannot collide with or contaminate a real cached artifact; every file this harness
// creates under the real ARTIFACT_CACHE_DIR (~/.lb_substrate/artifact_cache -- both client and
// server compute this from the real os.homedir(), not a fake, so this IS the real live directory)
// is deleted in a finally block at the end, and only files matching this run's own version tag are
// ever touched.

(async function main(): Promise<void> {

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

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

const DIST_SERVER_PATH = path.join(__dirname, '..', '..', '..', 'dist', 'main', 'keys_engines', 'peer_artifact_server');
const DIST_CLIENT_PATH = path.join(__dirname, '..', '..', '..', 'dist', 'main', 'keys_engines', 'peer_artifact_client');
const DIST_SIGN_VERIFY_PATH = path.join(__dirname, '..', '..', '..', 'dist', 'main', 'thorax', 'sign_verify');
const DIST_KEYPAIR_PATH = path.join(__dirname, '..', '..', '..', 'dist', 'main', 'thorax', 'ed25519_keypair');

for (const p of [DIST_SERVER_PATH, DIST_CLIENT_PATH, DIST_SIGN_VERIFY_PATH, DIST_KEYPAIR_PATH]) {
  if (!fs.existsSync(p + '.js')) {
    console.error(`FATAL: ${p}.js does not exist. Run \`npm run build:main\` first -- this test requires the COMPILED output.`);
    process.exit(2);
  }
}

const electronResolvedPath = require.resolve('electron');
const fakeUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pav-test-'));

/** Injects a fake `electron` module (app.getPath('userData') = a real temp dir) into
 *  require.cache, then requires a FRESH copy of the given compiled dist module so its static
 *  `import { app } from 'electron'` binding picks up the fake. Identical technique to
 *  battery_dispatch_plugin_endpoint.test.ts / cdp_guard.test.ts. */
function freshModuleWithFakeApp(distPath: string): { mod: any; restore: () => void } {
  const resolvedDistPath = require.resolve(distPath);
  const savedElectronEntry = require.cache[electronResolvedPath];
  const savedDistEntry = require.cache[resolvedDistPath];
  delete require.cache[resolvedDistPath];
  require.cache[electronResolvedPath] = {
    id: electronResolvedPath,
    filename: electronResolvedPath,
    loaded: true,
    exports: { app: { getPath: (_name: string) => fakeUserDataDir, isPackaged: false } },
  } as any;
  const mod = require(distPath);
  const restore = () => {
    delete require.cache[resolvedDistPath];
    if (savedElectronEntry) require.cache[electronResolvedPath] = savedElectronEntry;
    else delete require.cache[electronResolvedPath];
    if (savedDistEntry) require.cache[resolvedDistPath] = savedDistEntry;
  };
  return { mod, restore };
}

console.log('\n=== peer_artifact download-verify harness (D-BP151-045) ===\n');

// Real ARTIFACT_CACHE_DIR -- both client and server compute this identically from the real
// os.homedir(), not a fake. Every file this harness writes is tagged with TEST_TAG and removed
// in the finally block below.
const TEST_TAG = `0.0.0-d-bp151-045-test-${Date.now()}`;
const ARTIFACT_CACHE_DIR = path.join(os.homedir(), '.lb_substrate', 'artifact_cache');
fs.mkdirSync(ARTIFACT_CACHE_DIR, { recursive: true });
const filesToCleanup: string[] = [];

function cachePathFor(version: string): string {
  return path.join(ARTIFACT_CACHE_DIR, `MnemosyneC-Setup-${version}.exe`);
}

// Capture console.warn output so we can assert refusals are logged with a reason.
const warnLog: string[] = [];
const realWarn = console.warn;
console.warn = (...args: any[]) => { warnLog.push(args.map(String).join(' ')); realWarn(...args); };

let exitCode = 0;
try {

  // ── 1: happy path -- real server, real client, correctly signed/hashed artifact ─────────────
  {
    const version = `${TEST_TAG}-happy`;
    const artifactBytes = Buffer.from('D-BP151-045 legitimate artifact bytes, happy path');
    const serverCachePath = cachePathFor(version);
    fs.writeFileSync(serverCachePath, artifactBytes);
    filesToCleanup.push(serverCachePath);

    const { mod: serverMod, restore: restoreServer } = freshModuleWithFakeApp(DIST_SERVER_PATH);
    const TEST_PORT = 47298;
    process.env.PEER_ARTIFACT_PORT = String(TEST_PORT);
    // Re-require so the module picks up the env var at its top-level parseInt() -- the
    // freshModuleWithFakeApp() call above already cleared the cache entry for this path, but
    // PEER_ARTIFACT_PORT must be set BEFORE that require executes, so redo it in the right order.
    restoreServer();
    const { mod: serverMod2, restore: restoreServer2 } = freshModuleWithFakeApp(DIST_SERVER_PATH);
    serverMod2.startPeerArtifactServer();
    await new Promise((r) => setTimeout(r, 300));

    const clientMod = require(DIST_CLIENT_PATH);
    const destPath = await clientMod.downloadFromPeer(`127.0.0.1:${TEST_PORT}`, version);
    filesToCleanup.push(destPath);

    assert(destPath === serverCachePath, 'downloadFromPeer() resolves to the expected cache path', destPath);
    assert(fs.existsSync(destPath), 'the verified artifact file exists on disk after download');
    const gotBytes = fs.readFileSync(destPath);
    assert(gotBytes.equals(artifactBytes), 'downloaded bytes are byte-for-byte identical to what the server served');
    // No leftover temp file.
    const leftoverTmp = fs.readdirSync(ARTIFACT_CACHE_DIR).filter((f: string) => f.startsWith(path.basename(destPath)) && f.includes('.download-'));
    assert(leftoverTmp.length === 0, 'no leftover .download-*.tmp file after a successful verified download', JSON.stringify(leftoverTmp));

    restoreServer2();
    void serverMod; // unused first require, kept only to demonstrate the ordering issue avoided above
  }

  // ── Shared setup for the malicious-server tests: a REAL Ed25519 keypair (via the real Thorax
  //    module, fake userData) to produce genuinely-valid signatures for the "tampered bytes"
  //    case, plus a hand-built http server standing in for a hostile/broken peer. ────────────
  const { mod: keypairMod, restore: restoreKeypair } = freshModuleWithFakeApp(DIST_KEYPAIR_PATH);
  const { public_key_hex, private_key_hex } = keypairMod.getOrCreateKeypair();
  restoreKeypair();
  const { signFrame } = require(DIST_SIGN_VERIFY_PATH);

  function startMaliciousServer(handler: (req: any, res: any) => void): Promise<{ port: number; close: () => Promise<void> }> {
    return new Promise((resolve) => {
      const server = http.createServer(handler);
      server.listen(0, '127.0.0.1', () => {
        const port = (server.address() as any).port;
        resolve({ port, close: () => new Promise<void>((r) => server.close(() => r())) });
      });
    });
  }

  // ── 2: tampered payload -- signed hash is genuine for the ORIGINAL bytes, but the peer serves
  //      DIFFERENT bytes at /artifact -- Gate 3 must catch this after download. ────────────────
  {
    const version = `${TEST_TAG}-tampered`;
    const originalBytes = Buffer.from('original bytes that were actually signed');
    const tamperedBytes = Buffer.from('SUBSTITUTED bytes -- attacker or corrupted peer disk');
    const crypto = require('crypto');
    const trueHash = crypto.createHash('sha512').update(originalBytes).digest('hex');
    const canonical = `${version}:${trueHash}`;
    const signedHex = signFrame(canonical, private_key_hex);

    const { port, close } = await startMaliciousServer((req: any, res: any) => {
      if (req.url.startsWith('/hash/')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ peerId: 'malicious-peer', hash: trueHash, publicKeyHex: public_key_hex, signedHex }));
        return;
      }
      if (req.url.startsWith('/artifact/')) {
        res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
        res.end(tamperedBytes); // serves DIFFERENT bytes than what was hashed and signed
        return;
      }
      res.writeHead(404); res.end();
    });

    warnLog.length = 0;
    const destPath = cachePathFor(version);
    let threw = false; let errMsg = '';
    const clientMod = require(DIST_CLIENT_PATH);
    try {
      await clientMod.downloadFromPeer(`127.0.0.1:${port}`, version);
    } catch (err: any) {
      threw = true; errMsg = String(err?.message ?? err);
    }
    await close();

    assert(threw === true, 'tampered payload (bytes != signed hash): downloadFromPeer() REJECTS', errMsg);
    assert(/do NOT match the signed hash/.test(errMsg), 'rejection reason names the hash mismatch', errMsg);
    assert(!fs.existsSync(destPath), 'tampered artifact was NOT stored at the cache path');
    const leftover = fs.readdirSync(ARTIFACT_CACHE_DIR).filter((f: string) => f.includes(version));
    assert(leftover.length === 0, 'no partial/temp file left behind after tampered-payload refusal', JSON.stringify(leftover));
    assert(warnLog.some((l) => l.includes('REFUSED') && l.includes(version)), 'the refusal was logged via console.warn with a reason', warnLog.join(' | '));
  }

  // ── 3: missing signature -- peer returns a hash with NO publicKeyHex/signedHex at all ───────
  {
    const version = `${TEST_TAG}-nosig`;
    const bytes = Buffer.from('bytes served by a legacy or stripped-down peer with no signing');
    const crypto = require('crypto');
    const hash = crypto.createHash('sha512').update(bytes).digest('hex');

    const { port, close } = await startMaliciousServer((req: any, res: any) => {
      if (req.url.startsWith('/hash/')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ peerId: 'legacy-peer', hash })); // no publicKeyHex, no signedHex
        return;
      }
      if (req.url.startsWith('/artifact/')) {
        res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
        res.end(bytes);
        return;
      }
      res.writeHead(404); res.end();
    });

    warnLog.length = 0;
    const destPath = cachePathFor(version);
    let threw = false; let errMsg = '';
    const clientMod = require(DIST_CLIENT_PATH);
    try {
      await clientMod.downloadFromPeer(`127.0.0.1:${port}`, version);
    } catch (err: any) {
      threw = true; errMsg = String(err?.message ?? err);
    }
    await close();

    assert(threw === true, 'missing signature: downloadFromPeer() REJECTS', errMsg);
    assert(/no Ed25519 signature/.test(errMsg), 'rejection reason names the missing signature', errMsg);
    assert(!fs.existsSync(destPath), 'unsigned artifact was NOT stored at the cache path (never even attempted a download)');
    assert(warnLog.some((l) => l.includes('REFUSED') && l.includes(version)), 'the refusal was logged via console.warn with a reason', warnLog.join(' | '));
  }

  // ── 4: bad signature -- hash and fields all present, but the signature is corrupted ─────────
  {
    const version = `${TEST_TAG}-badsig`;
    const bytes = Buffer.from('bytes accompanied by a corrupted signature');
    const crypto = require('crypto');
    const hash = crypto.createHash('sha512').update(bytes).digest('hex');
    const canonical = `${version}:${hash}`;
    const validSignedHex: string = signFrame(canonical, private_key_hex);
    // Flip one hex character deep inside the 128-char signature suffix -- corrupts the
    // signature bytes while leaving the canonical prefix and overall length untouched.
    const flipIdx = validSignedHex.length - 10;
    const flippedChar = validSignedHex[flipIdx] === '0' ? '1' : '0';
    const corruptedSignedHex = validSignedHex.slice(0, flipIdx) + flippedChar + validSignedHex.slice(flipIdx + 1);
    assert(corruptedSignedHex !== validSignedHex, 'sanity: the corrupted signature actually differs from the valid one');

    const { port, close } = await startMaliciousServer((req: any, res: any) => {
      if (req.url.startsWith('/hash/')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ peerId: 'bad-sig-peer', hash, publicKeyHex: public_key_hex, signedHex: corruptedSignedHex }));
        return;
      }
      if (req.url.startsWith('/artifact/')) {
        res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
        res.end(bytes);
        return;
      }
      res.writeHead(404); res.end();
    });

    warnLog.length = 0;
    const destPath = cachePathFor(version);
    let threw = false; let errMsg = '';
    const clientMod = require(DIST_CLIENT_PATH);
    try {
      await clientMod.downloadFromPeer(`127.0.0.1:${port}`, version);
    } catch (err: any) {
      threw = true; errMsg = String(err?.message ?? err);
    }
    await close();

    assert(threw === true, 'corrupted/bad signature: downloadFromPeer() REJECTS', errMsg);
    assert(/signature verification failed/.test(errMsg), 'rejection reason names signature verification failure', errMsg);
    assert(!fs.existsSync(destPath), 'bad-signature artifact was NOT stored at the cache path (never even attempted a download)');
    assert(warnLog.some((l) => l.includes('REFUSED') && l.includes(version)), 'the refusal was logged via console.warn with a reason', warnLog.join(' | '));
  }

} finally {
  console.warn = realWarn;
  for (const f of filesToCleanup) {
    try { fs.unlinkSync(f); } catch { /* best-effort */ }
  }
  // Sweep any stray file this run's TEST_TAG created (temp files, partial writes, etc.) --
  // never touches any file not matching this run's own unique tag.
  try {
    for (const f of fs.readdirSync(ARTIFACT_CACHE_DIR)) {
      if (f.includes(TEST_TAG)) {
        try { fs.unlinkSync(path.join(ARTIFACT_CACHE_DIR, f)); } catch { /* best-effort */ }
      }
    }
  } catch { /* best-effort */ }
  try { fs.rmSync(fakeUserDataDir, { recursive: true, force: true }); } catch { /* noop */ }

  console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) exitCode = 1;
}

process.exit(exitCode);

})().catch((err) => {
  console.error('FATAL: test harness threw:', err);
  process.exit(2);
});
