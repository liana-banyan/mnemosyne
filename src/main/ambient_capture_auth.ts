// ambient_capture_auth.ts -- D-BP154-074/BISHOP-SEG/S74/seg-ambient
//
// THE TOKEN A CONTENT SCRIPT CAN HOLD -- design stated, not just implemented.
//
// THE PROBLEM (coordinator follow-up, D-BP154-074, verbatim): "Not the Bearer secret in
// plaintext in a content script. Propose and implement something a browser extension can
// legitimately carry -- a scoped, locally-issued capture token, rotatable, 127.0.0.1-only."
//
// mcp_server.ts's real Bearer token (mcp_auth_token.txt, loadOrCreateAuthToken()) authorizes
// EVERY MCP tool -- including mnem_share_eblet_to_peer (would authorize sharing a verified eblet
// to a peer if that tool were ever implemented) and mnem_run_giant_concordance. Handing that
// token to a browser extension -- code that runs inside pages the extension does not control,
// on a surface (chatgpt.com/claude.ai/gemini.google.com/perplexity.ai/google.com) this estate
// does not operate -- would mean a bug or supply-chain compromise in ANY of those five sites, or
// in the extension itself, has the same reach as a fully-privileged local MCP client. That is a
// disproportionate blast radius for what this feature actually needs: write one capture record,
// read one status line.
//
// THE DESIGN:
//   1. A SEPARATE key, minted the same way loadOrCreateAuthToken() mints the MCP bearer token
//      (crypto.randomBytes(32), hex, written to a userData file) but to its OWN file
//      (mcp_capture_key.txt, never mcp_auth_token.txt) and checked against its OWN header
//      (X-Mnemo-Capture-Key), never accepted on the /mcp route and never able to authorize an
//      /mcp JSON-RPC call. Least privilege: this key opens exactly two doors -- POST /capture and
//      GET /capture/status -- and nothing else this server exposes.
//   2. ROTATABLE. rotateCaptureKey() below overwrites the file with a fresh
//      crypto.randomBytes(32) value and returns it; index.ts wires a tray menu item
//      ("Ambient Browser Capture Key...") that calls it and shows the new value in a native
//      dialog for the Founder to copy into the extension's options page. The OLD key stops
//      working the instant the new file is written (getOrCreateCaptureKey() always reads current
//      file contents, no in-memory cache of a stale value survives a rotation on the next
//      request).
//   3. 127.0.0.1-ONLY, enforced BELOW this file, at the network layer: mcp_server.ts's HTTP
//      server is bound to '127.0.0.1' only (startMcpServer(), unchanged by this ticket) -- the
//      key is worthless off-box even if leaked, because the port it authorizes is not reachable
//      from any other host. This module does not re-implement that binding; it only trusts that
//      it is true, and names the file that proves it (mcp_server.ts's httpSrv.listen(port,
//      '127.0.0.1', ...) call).
//   4. WHY A CONTENT SCRIPT CAN "LEGITIMATELY CARRY" THIS: a Manifest V3 content script itself
//      never makes the network call -- see manifest.json's host_permissions (127.0.0.1 only) and
//      background/service_worker.js: the content script only chrome.runtime.sendMessage()s the
//      captured text to the extension's OWN background service worker (a privileged extension
//      context, not page-visible, not readable by the page's own JavaScript or by any other
//      extension without its own explicit permission), and the SERVICE WORKER holds the key
//      (chrome.storage.local, extension-scoped storage no page script can read) and makes the
//      fetch(). The token never touches the DOM, never appears in a page's JS context, and never
//      leaves 127.0.0.1.
//
// THIS FILE DOES NOT TOUCH mcp_auth_token.txt, loadOrCreateAuthToken(), OR ANY EXISTING MCP
// ROUTE/TOOL. It is purely additive: a second, narrower, independently-rotatable secret for a
// second, narrower purpose.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';

/** Same override discipline as evidence_store.ts's resolveEvidenceDir() (LB_EVIDENCE_DIR) and
 *  this codebase's other userData-relative files: an env override first so a test or a
 *  non-Electron invocation never touches the real per-user file, and a real Electron userData
 *  path otherwise. Falls back to a fixed dev-mode path only if neither is available (mirrors
 *  loadOrCreateAuthToken()'s own ephemeral-token catch branch, one file below). */
function resolveCaptureKeyPath(): string {
  if (process.env.MNEMO_CAPTURE_KEY_DIR) {
    return join(process.env.MNEMO_CAPTURE_KEY_DIR, 'mcp_capture_key.txt');
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { app: electronApp } = require('electron') as typeof import('electron');
  return join(electronApp.getPath('userData'), 'mcp_capture_key.txt');
}

function mintKey(): string {
  return randomBytes(32).toString('hex');
}

/** Reads the current capture key, minting one on first call. Always reads the file fresh (no
 *  module-level cache) so a rotation (rotateCaptureKey(), below) takes effect on the very next
 *  request without a server restart. */
export function getOrCreateCaptureKey(): string {
  try {
    const p = resolveCaptureKeyPath();
    if (existsSync(p)) {
      const t = readFileSync(p, 'utf8').trim();
      if (t.length >= 32) return t;
    }
    const fresh = mintKey();
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, fresh, 'utf8');
    console.log(`[AmbientCapture] Capture key created at ${p}`);
    return fresh;
  } catch (e) {
    console.error('[AmbientCapture] Failed to load/create capture key, using ephemeral (will not persist across restart):', e);
    return mintKey();
  }
}

/** Overwrites the key file with a fresh value and returns it. The prior value stops
 *  authorizing anything the moment this returns, since getOrCreateCaptureKey()/isValidCaptureKey()
 *  never cache. Callers (index.ts's tray menu item) are responsible for showing the new value to
 *  the Founder so it can be re-pasted into the extension's options page -- this function only
 *  rotates the secret, it does not communicate it anywhere. */
export function rotateCaptureKey(): string {
  const p = resolveCaptureKeyPath();
  const fresh = mintKey();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, fresh, 'utf8');
  console.log(`[AmbientCapture] Capture key ROTATED at ${p}`);
  return fresh;
}

/** Plain string equality against the live file. Deliberately NOT constant-time: this guards a
 *  127.0.0.1-only, single-user, non-networked-adversary surface (see file header point 3) --
 *  the estate's own mcp_server.ts Bearer check (authHeader.slice(7) !== _authToken) uses the same
 *  plain comparison for the identical threat model, so this matches existing precedent rather
 *  than inventing a stricter one for a narrower-privileged secret. */
export function isValidCaptureKey(candidate: string | null | undefined): boolean {
  if (!candidate) return false;
  return candidate === getOrCreateCaptureKey();
}

/** Where the Founder can find the file directly, for the "what must he click" instruction path
 *  when no dialog is available (e.g. before first app launch has created it). */
export function getCaptureKeyPath(): string {
  return resolveCaptureKeyPath();
}
