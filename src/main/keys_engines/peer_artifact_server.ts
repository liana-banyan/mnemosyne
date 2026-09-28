/**
 * peer_artifact_server.ts -- Keys and Engines: serve installer bytes + hash to paired Frames
 * BP087 Wave 4 · Frame-to-Frame Wildfire Propagation
 *
 * Listens on PEER_ARTIFACT_PORT (default 47213).
 * Routes:
 *   GET /hash/:version       -> JSON { peerId, hash } (socceri-hash of local installer bytes)
 *   GET /artifact/:version   -> binary stream of local installer file
 *   GET /health              -> JSON { ok: true, peerId }
 *
 * D-BP223-BM0-X030-098 (same class as X030-073 P2, XO X030 pick on Founder k/0a8d1c96): this server was plain HTTP with no
 * auth. It now requires THE SAME signed frame as port 7474's GET routes for every request that does not come from this
 * machine: header x-mnem-signed-frame, a Thorax-signed frame whose payload names the exact request path as `route` and a
 * fresh `issued_ms` (5 minute window), verified by peer_server.ts requireSignedGet (enrolled key, then beacon-learned key,
 * then the frame's self-declared key). Unsigned, wrong-route, stale or tampered = 403, before any file is read.
 *   - Loopback requests (127.0.0.1, ::1, ::ffff:127.0.0.1) stay unsigned: same machine, and the signed-hash download check in
 *     peer_artifact_client.ts still guards the bytes.
 *   - The one unauthenticated non-local answer is GET /health -> exactly { ok: true }, no peer id (the 7474 health ping rule).
 *   - BIND STAYS ON ALL INTERFACES, on purpose: there is a documented LAN need. peer_server.ts publishes this server as
 *     artifact_server_address (identity/peerIdentityCollector.ts, http://<primary LAN IP>:<port>), and
 *     mesh_update_propagation.ts + catacombs/eblet_package_fetcher.ts pull installer / package bytes from OTHER machines at
 *     that address. Binding 127.0.0.1 would silently end mesh update propagation.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { homedir } from 'node:os';
// D-BP151-045: sign the hash this server serves, using the SAME Thorax Ed25519 primitives and
// the SAME keypair mechanism (thorax/ed25519_keypair.ts, mechanism 1 of the three the BP151-044
// sweep found) that federation/announce_frame.ts already uses to sign control-plane frames --
// no new crypto, no new keypair, no new identity mechanism. See peer_artifact_client.ts's
// downloadFromPeer() for the receive-side verification this signature exists to satisfy.
import { getOrCreateKeypair } from '../thorax/ed25519_keypair';
import { signFrame } from '../thorax/sign_verify';
// D-BP223-BM0-X030-098: the SAME signed-frame check port 7474 applies to its GET routes.
import { requireSignedGet } from '../federation/peer_server';

const PEER_ARTIFACT_PORT = parseInt(process.env.PEER_ARTIFACT_PORT ?? '47213', 10);
const ARTIFACT_CACHE_DIR = join(homedir(), '.lb_substrate', 'artifact_cache');
const FRAME_ID = process.env.LB_FRAME_ID ?? 'unknown';

function getArtifactPath(version: string): string {
  return join(ARTIFACT_CACHE_DIR, `MnemosyneC-Setup-${version}.exe`);
}

function computeLocalHash(version: string): string | null {
  const artifactPath = getArtifactPath(version);
  if (!existsSync(artifactPath)) return null;
  const bytes = readFileSync(artifactPath);
  return createHash('sha512').update(bytes).digest('hex');
}

/**
 * D-BP151-045: sign `${version}:${hash}` with this machine's Thorax Ed25519 private key so a
 * receiving peer can verify the hash was not substituted in transit or by a hostile intermediary
 * -- the hash alone (already served, pre-existing) is self-reported and was explicitly documented
 * elsewhere in this codebase as untrusted on its own (mesh_update_propagation.ts's header
 * comment). `signFrame` is reused exactly as announce_frame.ts uses it -- it signs whatever
 * string it is given; no wire-format encoding is needed for a two-field canonical string.
 * Fails soft (returns null, same convention as signAnnouncePayload) if the keypair is
 * unavailable -- the receiving side fails CLOSED on a missing signature, not this side.
 */
function signArtifactHash(version: string, hash: string): { publicKeyHex: string; signedHex: string } | null {
  try {
    const { public_key_hex, private_key_hex } = getOrCreateKeypair();
    const canonical = `${version}:${hash}`;
    const signedHex = signFrame(canonical, private_key_hex);
    return { publicKeyHex: public_key_hex, signedHex };
  } catch (err) {
    console.warn('[PeerArtifactServer] Thorax keypair unavailable -- serving hash unsigned (receiver will refuse it):', err);
    return null;
  }
}

// BP138 Yoke 0.9.13 F4 item 3: how many additional ports to try (47214, 47215, ...) before
// giving up. A second Frame instance on the SAME machine is the only realistic collision case
// (mesh peers are separate machines with their own :47213) -- a handful of sequential ports is
// plenty of headroom without scanning indefinitely.
const MAX_PORT_RETRIES = 5;

/** X030-098: true only for this machine's own loopback addresses. */
export function isLoopbackAddress(addr: string | undefined | null): boolean {
  if (!addr) return false;
  const a = addr.trim().toLowerCase();
  return a === '::1' || a === '127.0.0.1' || a.startsWith('127.') || a.startsWith('::ffff:127.');
}

type SignedGetCheck = { ok: true } | { ok: false; status: number; error: string };
type SignedGetVerifier = (headers: IncomingMessage['headers'], route: string) => SignedGetCheck;

/** The 7474 verifier (peer_server.ts requireSignedGet). Any throw inside it REFUSES non-local access (fail closed). */
function defaultSignedGetVerifier(headers: IncomingMessage['headers'], route: string): SignedGetCheck {
  try {
    const v = requireSignedGet(headers, route);
    return v.ok ? { ok: true } : { ok: false, status: v.status, error: v.error };
  } catch (err) {
    return { ok: false, status: 403, error: 'refused: signed-frame verifier failed (' + (err instanceof Error ? err.message : String(err)) + ')' };
  }
}

export interface PeerArtifactHandlerOptions {
  /** Tests only: override the loopback test (to exercise the non-local path over a 127.0.0.1 socket). */
  isLocal?: (remoteAddress: string | undefined) => boolean;
  /** Tests only: override the signed-frame verifier. Default is peer_server.ts requireSignedGet. */
  verifySignedGet?: SignedGetVerifier;
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/** X030-098: the request handler, exported so the auth rule is testable over real HTTP. */
export function createPeerArtifactRequestHandler(opts: PeerArtifactHandlerOptions = {}): (req: IncomingMessage, res: ServerResponse) => void {
  const isLocal = opts.isLocal ?? isLoopbackAddress;
  const verifySignedGet = opts.verifySignedGet ?? defaultSignedGetVerifier;

  return (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? '/';
    const pathname = url.split('?')[0];
    const local = isLocal(req.socket?.remoteAddress);

    let signedOk = false;
    if (!local) {
      const check = verifySignedGet(req.headers, pathname);
      signedOk = check.ok;
      if (!check.ok && pathname !== '/health') {
        sendJson(res, check.status || 403, { error: check.error });
        return;
      }
    }

    if (pathname === '/health') {
      // Non-local and unsigned: the minimal ping only, no machine details (the 7474 health rule).
      sendJson(res, 200, local || signedOk ? { ok: true, peerId: FRAME_ID } : { ok: true });
      return;
    }

    const hashMatch = pathname.match(/^\/hash\/(.+)$/);
    if (hashMatch) {
      const version = decodeURIComponent(hashMatch[1]);
      const hash = computeLocalHash(version);
      if (!hash) {
        sendJson(res, 404, { error: 'artifact not in local cache' });
        return;
      }
      // D-BP151-045: additive fields only -- publicKeyHex/signedHex are new, peerId/hash are
      // unchanged, so this stays backward compatible with anything that only reads peerId/hash.
      const sig = signArtifactHash(version, hash);
      sendJson(res, 200, {
        peerId: FRAME_ID,
        hash,
        ...(sig ? { publicKeyHex: sig.publicKeyHex, signedHex: sig.signedHex } : {}),
      });
      return;
    }

    const artifactMatch = pathname.match(/^\/artifact\/(.+)$/);
    if (artifactMatch) {
      const version = decodeURIComponent(artifactMatch[1]);
      const artifactPath = getArtifactPath(version);
      if (!existsSync(artifactPath)) {
        sendJson(res, 404, { error: 'artifact not in local cache' });
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      createReadStream(artifactPath).pipe(res);
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  };
}

export function startPeerArtifactServer(): void {
  const server = createServer(createPeerArtifactRequestHandler());

  // BP138 Yoke 0.9.13 F4 item 3: server.listen()'s EADDRINUSE fires asynchronously as an
  // 'error' EVENT on the server object -- it is NOT thrown synchronously, so the try/catch
  // around startPeerArtifactServer() at the index.ts call site never caught it. An unhandled
  // 'error' event on a Node EventEmitter is a fatal uncaught exception that crashed the whole
  // main process the moment a second MnemosyneC instance ran on the same machine (both bind
  // :47213). Fix: attach the 'error' handler BEFORE calling listen(), and on EADDRINUSE retry
  // sequentially on the next port up to MAX_PORT_RETRIES times; any other listen error, or
  // exhausting all retries, logs a clear warning and gives up -- this server is a nice-to-have
  // (serves this node's cached installer bytes to mesh peers) and must NEVER be allowed to take
  // the app down with it.
  const attemptListen = (port: number, retriesLeft: number): void => {
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && retriesLeft > 0) {
        const nextPort = port + 1;
        console.warn(`[PeerArtifactServer] Port ${port} in use (another instance running?) -- trying ${nextPort}`);
        attemptListen(nextPort, retriesLeft - 1);
        return;
      }
      if (err.code === 'EADDRINUSE') {
        console.warn(
          `[PeerArtifactServer] All ports ${PEER_ARTIFACT_PORT}-${port} in use -- ` +
          `giving up (non-fatal). This node will not serve cached installer bytes to mesh ` +
          `peers this session; mesh update propagation still works via each OTHER live peer.`,
        );
        return;
      }
      console.warn('[PeerArtifactServer] Failed to start (non-fatal):', err);
    });
    // X030-098: all interfaces on purpose (documented LAN need, see header); non-local requests need the signed frame.
    server.listen(port, () => {
      console.log(`[PeerArtifactServer] Listening on port ${port} (Frame: ${FRAME_ID}); non-local requests require a signed frame`);
    });
  };

  attemptListen(PEER_ARTIFACT_PORT, MAX_PORT_RETRIES);
}
