// cdp_guard.ts -- D-BP151-038/BISHOP/seg-cdp-guard
//
// FOUNDER'S ORDER, BP151, verbatim: "Build the guard."
//
// THE FINDING THIS GUARD CLOSES (D-BP151-034, CHROME_IN_MNEMOSYNEC_PHASE_0_BP151.md, table B6):
// "CDP port 9333 grants arbitrary JS execution (not just the exposed `amplify` surface) in any
// open renderer, including the Nexus-Authority webview holding five live logged-in sessions...
// NAMED GAP -- no code-level guard exists." Runtime.evaluate over Chrome DevTools Protocol is
// not restricted by contextBridge's allowlist -- it runs arbitrary JavaScript in a renderer's
// top-frame context. D-BP151-034 verified the port is dev-only and loopback-only TODAY, but
// named no mechanism in this repo that keeps either of those true. This file is that mechanism.
//
// AMENDED 2026-08-09 (D-BP151-043, correcting the paragraph below): no production code path in
// this repo requires CDP any more. `D-BP151-041` (commit `56afd84f`) rewired
// scripts/register_gate.mjs onto the in-process `ctx.askGoogle` bridge already in scope at its
// call site (comparative_cascade.ts) and deleted register_gate.mjs's own CDP dial
// (`pickTarget()`, `askGoogleBlocks()`, the `PORT` constant) along with its standalone debug CLI
// -- see SEG_RETURN_BP151_041_REGISTER_GATE_INPROCESS.md. This guard's refusal below fires
// exactly as before (ONLY when app.isPackaged is true) and needed no code change, but its REASON
// is narrower than the paragraph below states: it is not "don't break the register gate's only
// path to Google" any more. It exists because the `--remote-debugging-port` CLI flag can still
// be handed to a packaged MnemosyneC.exe by any launcher, shortcut, or script (empirical finding
// #3 below) -- CDP has no authentication, so that flag alone would expose the Nexus-Authority
// webview's live logged-in sessions on an end-user machine. Refusing that flag in a packaged
// build remains this file's entire job, independent of what the register gate does. Founder Step
// 1 (the register gate) now HAS a real production implementation that needs no CDP, in dev or in
// a packaged build (SEG_RETURN_BP151_041_REGISTER_GATE_INPROCESS.md, "Does anything in the
// production path still need CDP? No.") -- the paragraph below's closing claim that it has none
// is the specific thing this amendment corrects.
//
// [ORIGINAL, SUPERSEDED BY THE AMENDMENT ABOVE -- kept verbatim as the historical record of what
// this guard was built against, per this ticket's own instruction not to strip attribution]
// THE TENSION THIS TICKET NAMES, NOT SOLVES: scripts/register_gate.mjs reaches Google through
// the Founder's own logged-in Nexus-Authority session BY CONNECTING TO THIS SAME PORT (see
// register_gate.mjs pickTarget()/askGoogleBlocks(), ~line 162-206). So this guard must never
// break `npm run dev:main:cdp`. It doesn't: the refusal below fires ONLY when app.isPackaged
// is true. Every dev launch (packaged=false) is untouched. See SEG_RETURN_BP151_038_CDP_GUARD.md
// for the register-gate-still-works proof and the production-fork question this ticket asks the
// Founder to decide (register_gate.mjs's ONLY path to Google is this CDP port, and this guard,
// by design, refuses that port in a packaged build -- meaning Founder Step 1 currently has no
// production implementation; that is an architecture decision, not this ticket's to make).
//
// WHAT THIS FILE DOES NOT DO, ON PURPOSE (ticket's own HARD CONSTRAINTS):
//   - Never reads, logs, copies, or transmits credentials, cookies, session tokens, or any
//     authentication state. It only ever looks at: (a) process.argv / app.commandLine (launch
//     flags, not session data), (b) the CDP HTTP metadata endpoint's Browser/Protocol-Version
//     fields (never a page's DOM, never Runtime.evaluate), and (c) OS-level TCP connection
//     tables (peer IP:port + PID -- transport metadata, never payload).
//   - Adds no authentication to CDP itself (not supported by the protocol -- D-BP151-034 A2).
//   - Never touches the port number, register_gate.mjs, or register_gate_loader.ts.
//
// THREE EMPIRICAL FINDINGS THIS GUARD IS BUILT ON (measured this ticket, not assumed --
// see SEG_RETURN_BP151_038_CDP_GUARD.md for the full commands/output):
//   1. CDP is enabled ONLY by package.json:12's `dev:main:cdp` script's literal
//      `--remote-debugging-port=9333` CLI flag. Grepped the entire `src/main` tree and
//      `scripts/`: zero calls to `app.commandLine.appendSwitch` for any debug/inspect switch
//      exist anywhere in this app's own code -- nothing in this app can turn CDP on from
//      inside JS today. The only "switch" is the literal command line a human or npm script
//      chooses to launch with.
//   2. It binds loopback-only IN FACT, not by assumption: launched `npm run dev:main:cdp` and
//      confirmed via `netstat -an` (`TCP 127.0.0.1:9333 0.0.0.0:0 LISTENING` -- no 0.0.0.0
//      bind), a successful `curl http://127.0.0.1:9333/json/version`, and a FAILED
//      `curl http://<this machine's real LAN IP>:9333/json/version` (connection refused) from
//      the same machine. This is Chromium's own default; nothing in this repo enforces it,
//      which is exactly the gap D-BP151-034 named.
//   3. A PACKAGED build CAN enable it today: this repo has no `@electron/fuses` hardening
//      (grepped package.json -- not a dependency), no `app.commandLine` filtering anywhere, and
//      the electron-builder `build` config in package.json injects no launch arguments and
//      strips none. `MnemosyneC.exe --remote-debugging-port=9333` (any shortcut, any script,
//      any launcher) would work exactly as it does in dev today, on a real end-user machine,
//      against their real logged-in sessions. This is the finding that makes the guard urgent.
//
// GUARD SHAPE CHOSEN, AND WHY OVER THE ALTERNATIVES:
//   - "Hard-refuse in a packaged build" (enforcePackagedCdpRefusal, below) is the ONLY one of
//     the ticket's three candidate shapes that closes finding #3 outright: it turns "a packaged
//     build can enable CDP" into "a packaged build that is asked to enable CDP refuses to run
//     at all." It costs the dev workflow nothing (packaged=false is the only environment
//     dev:main:cdp ever runs in) and requires no new opt-in mechanism to get wrong.
//   - "Explicit opt-in in dev" is, in practice, ALREADY true: choosing to run `dev:main:cdp`
//     instead of plain `dev:main` IS the explicit opt-in (two different npm scripts, a
//     deliberate choice every time). Adding a second gate (an env var, a settings flag) on top
//     of that would only risk breaking the one thing this ticket forbade breaking at the time --
//     the register gate's sole path to Google, since `D-BP151-041`/`56afd84f` this is no longer
//     true, see the header amendment above -- for a decision that is already explicit. Instead
//     this file makes the existing implicit opt-in LOUD (logCdpDevExposureBanner) so it is
//     never silently on, without adding a second switch that could silently be left off.
//   - "Log every CDP attach" is built (startCdpAttachWatcher) as honestly as this protocol
//     allows: Electron's main process has no JS-level hook that fires when an external CDP
//     WebSocket client attaches (Chromium owns that server internally; this is a real, checked
//     limitation, not a shortcut -- see SEG_RETURN's "THINGS I NOTICED AND DID NOT DO"). What
//     IS real and checkable: the OS's own TCP connection table for this port. On Windows this
//     file shells out to `netstat -ano` (read-only, no `-f`/kill flags) and diffs the set of
//     ESTABLISHED peers on the CDP port on each poll, logging exactly the new ones (peer
//     address:port, local PID, timestamp) -- genuine "who connected, when," grounded in real OS
//     state. Non-Windows platforms get one honest "not implemented on this platform" log line
//     instead of a silent no-op.

import { app } from 'electron';
import { request as httpRequest } from 'node:http';
import { execFile } from 'node:child_process';

/** The one CDP port this repo ever uses -- package.json:12 (`dev:main:cdp`) hardcodes it as the
 *  `--remote-debugging-port` value. (scripts/register_gate.mjs used to hardcode this same number
 *  too, as its own `PORT` constant, when it dialed CDP directly -- that constant was deleted by
 *  `D-BP151-041`/`56afd84f` when the register gate stopped using CDP; see the header amendment
 *  above.) This guard reads it, it does not choose it or change it (ticket's own hard
 *  constraint). */
export const CDP_PORT = 9333;

/** Guarded replacement for `app.isPackaged`, same shape as mnem_eblet_store.ts's
 *  resolveIsPackaged() precedent in this tree. `require('electron')` resolves to a plain path
 *  STRING (not an object) outside a real Electron process, so `app` can be undefined when this
 *  module is loaded by plain `node` for a test -- guard every read, never assume. */
function resolveIsPackaged(): boolean {
  return typeof app !== 'undefined' && app && typeof app.isPackaged === 'boolean'
    ? app.isPackaged
    : false;
}

/** True if the CURRENT process was launched with a `--remote-debugging-port[=N]` command-line
 *  switch -- the one and only way CDP turns on in this repo (empirical finding #1 above).
 *  Reads process.argv directly rather than app.commandLine so this is testable outside a real
 *  Electron process (app.commandLine is unavailable/unreliable pre-'ready' in some Electron
 *  versions when app is the undefined-string stub described above; process.argv is always a
 *  real array). Chromium's own command-line switch matching is `--name` or `--name=value`,
 *  case-sensitive, which is what this mirrors. */
export function isCdpRequested(argv: readonly string[] = process.argv): boolean {
  return argv.some((a) => a === '--remote-debugging-port' || a.startsWith('--remote-debugging-port='));
}

/** Parses the requested port out of argv, if present. Returns null if the switch is absent or
 *  malformed (no value, non-numeric value) -- callers should fall back to CDP_PORT, never guess. */
export function getRequestedCdpPort(argv: readonly string[] = process.argv): number | null {
  for (const a of argv) {
    if (a.startsWith('--remote-debugging-port=')) {
      const v = Number(a.slice('--remote-debugging-port='.length));
      return Number.isFinite(v) && v > 0 ? v : null;
    }
  }
  return null;
}

/**
 * THE HARD REFUSE (highest-value guard, per the ticket's own ordering).
 *
 * Founder's order, BP151: "Build the guard." D-BP151-034's B6 table named this exact exposure
 * with no preventing mechanism. This is that mechanism: if this process is a PACKAGED build
 * (resolveIsPackaged() true -- never true for `npm run dev:main:cdp`, which always runs
 * unpackaged from source) AND it was launched with the CDP switch (isCdpRequested()), this
 * function logs loudly to stderr (packaged builds still have console piped to a log file via
 * this repo's own electron-log wiring at index.ts's top) and terminates the process immediately,
 * before any BrowserWindow, any webview, any IPC handler is created -- so none of the Founder's
 * five logged-in authority sessions are ever put at risk by a packaged build that was asked to
 * expose CDP. Must be called as early as possible in index.ts's module-load order (see the call
 * site comment there) -- earlier than app.whenReady(), earlier than any window-creation code.
 *
 * Returns true if it refused (and, in a real Electron process, never returns at all -- app.exit
 * terminates synchronously enough that the caller's next statement does not run). Returns false
 * (falls through, does nothing else) in every case where refusal does not apply. The boolean
 * return exists only so tests can observe the decision without actually killing the test process.
 */
export function enforcePackagedCdpRefusal(argv: readonly string[] = process.argv): boolean {
  if (!resolveIsPackaged() || !isCdpRequested(argv)) return false;

  const requestedPort = getRequestedCdpPort(argv) ?? CDP_PORT;
  // HARDWIRE-23 Law 4 attribution: this refusal exists because of Founder BP151 ("Build the
  // guard.") acting on D-BP151-034's named gap (CHROME_IN_MNEMOSYNEC_PHASE_0_BP151.md, table B6)
  // -- CDP's Runtime.evaluate bypasses contextBridge entirely and can reach the Nexus-Authority
  // webview's five live logged-in sessions. A packaged build is precisely the environment
  // D-BP151-034 flagged as unguarded ("this could silently stop being true... a future packaged
  // build adding this flag"). This message says exactly that, at refusal time, on the record.
  const banner =
    '\n' +
    '================================================================================\n' +
    '[cdp_guard] REFUSING TO START -- CDP requested in a PACKAGED build.\n' +
    `[cdp_guard] --remote-debugging-port=${requestedPort} was passed to a packaged MnemosyneC.\n` +
    '[cdp_guard] Chrome DevTools Protocol has no authentication. Runtime.evaluate over CDP runs\n' +
    '[cdp_guard] arbitrary JavaScript in any open renderer, bypassing the contextBridge allowlist\n' +
    '[cdp_guard] entirely -- including the Nexus-Authority webview holding the logged-in Google /\n' +
    '[cdp_guard] Perplexity / Claude / ChatGPT / Gemini sessions (D-BP151-034, table B6).\n' +
    '[cdp_guard] This guard exists because Founder BP151 ordered "Build the guard." on exactly\n' +
    '[cdp_guard] this named gap. A packaged build is an end-user machine; CDP must never be\n' +
    '[cdp_guard] reachable there. Exiting now, before any window or session is created.\n' +
    '[cdp_guard] Dev workflow is UNAFFECTED: `npm run dev:main:cdp` always runs unpackaged, so\n' +
    '[cdp_guard] this refusal never fires there.\n' +
    '================================================================================\n';
  console.error(banner);

  // app.exit() over app.quit(): quit() is asynchronous and can be cancelled by a
  // 'before-quit'/'window-all-closed' handler elsewhere in this large registration surface;
  // exit() terminates immediately and unconditionally, which is what "refuse to start" requires.
  // Fall back to process.exit for the non-Electron/test path (app.exit undefined there).
  if (typeof app !== 'undefined' && app && typeof app.exit === 'function') {
    app.exit(1);
  } else {
    process.exit(1);
  }
  return true;
}

let _devBannerLoggedOnce = false;

/**
 * VISIBILITY, not a second gate (ticket's "explicit opt-in in dev" candidate).
 *
 * Choosing to run `npm run dev:main:cdp` instead of plain `npm run dev:main` already IS the
 * explicit opt-in -- two different scripts, a deliberate choice every launch. Adding a further
 * env-var/flag gate on top would have risked breaking the one thing this ticket forbade breaking
 * at the time (the register gate's only path to Google -- since `D-BP151-041`/`56afd84f` this is
 * no longer true, see the header amendment above) for a decision that is already explicit. So
 * this function does not block anything; it makes the already-explicit choice IMPOSSIBLE to miss
 * in the logs, once per process, so CDP is never quietly on in a dev session someone forgot they
 * started.
 */
export function logCdpDevExposureBanner(argv: readonly string[] = process.argv): void {
  if (resolveIsPackaged() || !isCdpRequested(argv) || _devBannerLoggedOnce) return;
  _devBannerLoggedOnce = true;
  const port = getRequestedCdpPort(argv) ?? CDP_PORT;
  console.warn(
    `\n[cdp_guard] CDP is ACTIVE this session: --remote-debugging-port=${port} (dev build). ` +
      'Chrome DevTools Protocol has no authentication -- any local process on this machine can ' +
      'run arbitrary JavaScript in any open MnemosyneC window via this port for as long as this ' +
      'process runs (D-BP151-034). This is expected while `dev:main:cdp` is the launch script in ' +
      'use, and is closed off automatically in packaged builds by enforcePackagedCdpRefusal() ' +
      'in this same file. Founder BP151 order: "Build the guard."\n',
  );
}

// ─── Attach watcher (best-honest "log every CDP attach") ──────────────────────────────────────

interface CdpAttachWatcherHandle {
  stop(): void;
}

/** One HTTP GET to the CDP metadata endpoint. Reads ONLY Browser/Protocol-Version fields for a
 *  reachability heartbeat -- never a page target, never Runtime.evaluate, never page content. */
function probeCdpVersion(port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const req = httpRequest(
      { host: '127.0.0.1', port, path: '/json/version', method: 'GET', timeout: timeoutMs },
      (res) => {
        res.resume(); // discard body; only reachability matters here
        resolvePromise(res.statusCode === 200);
      },
    );
    req.on('timeout', () => { try { req.destroy(); } catch { /* noop */ } resolvePromise(false); });
    req.on('error', () => resolvePromise(false));
    req.end();
  });
}

/** Windows-only: shells out to `netstat -ano` (read-only enumeration, no destructive flags) and
 *  returns the set of "PEER_IP:PEER_PORT|LOCAL_PID" strings currently ESTABLISHED on `port`.
 *  This is the one real, OS-grounded source of "who is connected to CDP right now" available to
 *  a plain Electron main process -- Chromium's own CDP server gives this file no JS-level
 *  connect/disconnect event (see this file's header, "THINGS I NOTICED AND DID NOT DO" in
 *  SEG_RETURN_BP151_038_CDP_GUARD.md). Never reads process memory, never reads request/response
 *  bodies -- only the OS TCP table's address/port/pid columns. */
function listEstablishedPeersWindows(port: number): Promise<Set<string>> {
  return new Promise((resolvePromise) => {
    execFile('netstat', ['-ano'], { timeout: 4000 }, (err, stdout) => {
      if (err || !stdout) { resolvePromise(new Set()); return; }
      const peers = new Set<string>();
      const portSuffix = `:${port}`;
      for (const line of stdout.split(/\r?\n/)) {
        if (!line.includes(portSuffix) || !/ESTABLISHED/i.test(line)) continue;
        // netstat -ano columns: Proto  LocalAddr:Port  RemoteAddr:Port  State  PID
        const cols = line.trim().split(/\s+/);
        if (cols.length < 5) continue;
        const [, localAddr, remoteAddr, state, pid] = cols;
        if (!/ESTABLISHED/i.test(state)) continue;
        // Only entries where CDP's own port (9333) is the LOCAL side -- i.e. someone connected
        // TO this app's CDP server, not this app connecting out to something else on that port.
        if (!localAddr.endsWith(portSuffix)) continue;
        peers.add(`${remoteAddr}|pid=${pid}`);
      }
      resolvePromise(peers);
    });
  });
}

/**
 * Starts the CDP attach/heartbeat watcher. No-op (returns null) unless CDP was actually
 * requested this process (isCdpRequested()) -- never runs, never opens a timer, when the app
 * launched normally. Safe to call unconditionally from initCdpGuard(); this is the check.
 *
 * Logs, at most once per state change (never every poll, to avoid log-flooding a session that
 * legitimately keeps CDP open for the whole register-gate run):
 *   - the port going from unreachable -> reachable and back (heartbeat transitions)
 *   - (Windows only) any NEW established peer connection on the CDP port since the last poll
 *
 * Founder BP151 ("Build the guard.") + D-BP151-034 B6: "An unlogged debug port is worse than a
 * logged one" is this function's whole reason to exist.
 */
export function startCdpAttachWatcher(
  argv: readonly string[] = process.argv,
  port: number = CDP_PORT,
  intervalMs = 5000,
): CdpAttachWatcherHandle | null {
  if (!isCdpRequested(argv)) return null;

  let lastReachable: boolean | null = null;
  let lastPeers = new Set<string>();

  const tick = async () => {
    const reachable = await probeCdpVersion(port, 2000);
    if (lastReachable === null || reachable !== lastReachable) {
      console.log(
        `[cdp_guard] [attach-watch] :${port} ${reachable ? 'REACHABLE' : 'unreachable'} at ` +
          new Date().toISOString(),
      );
      lastReachable = reachable;
    }

    if (process.platform === 'win32') {
      const peers = await listEstablishedPeersWindows(port);
      for (const p of peers) {
        if (!lastPeers.has(p)) {
          console.warn(`[cdp_guard] [attach-watch] NEW CDP connection on :${port} -- ${p} at ${new Date().toISOString()}`);
        }
      }
      lastPeers = peers;
    } else if (lastReachable === true && lastPeers.size === 0) {
      // Logged once (lastPeers.size===0 sentinel keeps this from repeating every tick).
      console.log(
        `[cdp_guard] [attach-watch] peer-connection enumeration is not implemented on ` +
          `platform "${process.platform}" (netstat -ano parsing is Windows-only) -- reachability ` +
          `heartbeat above is still live, but per-connection "who" is a known gap here.`,
      );
      lastPeers = new Set(['__unsupported_platform_logged__']);
    }
  };

  void tick();
  const timer = setInterval(() => { void tick(); }, intervalMs);
  // Never hold the process open just for this watcher (matches port_guard.ts's own probes,
  // which are one-shot; this one is recurring but must not block a clean app.quit()).
  if (typeof timer.unref === 'function') timer.unref();

  return { stop: () => clearInterval(timer) };
}

/**
 * SINGLE ENTRY POINT -- this is the one call index.ts makes (per this ticket's "make the
 * index.ts touch as small as possible" instruction, alongside the module's one import line).
 *
 * Order matters: the hard refusal MUST run first and MUST be allowed to terminate the process
 * before the banner/watcher below ever run -- there is nothing to log or watch in a process that
 * is about to exit. In dev (the only case that falls through), logs the loud one-time banner and
 * starts the attach watcher; both are no-ops when CDP was never requested this process.
 */
export function initCdpGuard(argv: readonly string[] = process.argv): void {
  if (enforcePackagedCdpRefusal(argv)) return; // process is exiting; nothing below should run
  logCdpDevExposureBanner(argv);
  startCdpAttachWatcher(argv);
}
