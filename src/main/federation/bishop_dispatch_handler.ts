/**
 * bishop_dispatch_handler.ts — D-BP156-M0-008, HARDWIRE-24 mesh.
 *
 * The real implementation behind peer_server.ts's `onBishopDispatch` hook (registered via
 * registerPeerServerHooks, exactly mirroring the existing `onPlowDomain` hook-injection
 * pattern -- see peer_server.ts's own doc comments). Two things happen on a verified inbound
 * bishop_dispatch payload, in this order, every time:
 *
 *   1. THE FILE IS THE WAKE. Write the dispatch to the receiving machine's own local yoke at
 *      `${LB_LEDGER_ROOT}/YOKE/NOTICES/<dispatchId>.md`. This is the audit record and it is
 *      unconditional -- it happens even when every guardrail below refuses to spawn. A human
 *      or an armed Mic (yoke_watch_v4.sh, 120s poll cadence) can always find and act on this
 *      file regardless of whether auto-spawn is enabled.
 *
 *   2. CONDITIONAL AUTO-SPAWN. Per the Founder's ruling reversing the original ticket's "do not
 *      auto-launch a CLI worker" instruction (relayed as a mid-session scope expansion on
 *      D-BP156-M0-008 -- flagged, not independently re-confirmed with the Founder directly, see
 *      this dispatch's Yoke-return), `onBishopDispatch` may also launch a real `claude` CLI
 *      worker against the dispatch's promptText/workingDir. This is gated by SEVEN independent
 *      guardrails, all in this file:
 *        (a) sender allowlist (verifiedOriginPeerId, not the self-declared field)
 *        (b) working-directory allowlist (lexical containment + realpath symlink check)
 *        (c) kill switch, DEFAULT DISABLED (LB_MESH_AUTO_SPAWN_ENABLED)
 *        (d) one-spawn-per-dispatch-id-ever dedupe (persisted marker file, survives restart)
 *        (e) concurrency cap (LB_MESH_MAX_CONCURRENT_SPAWNS)
 *        (f) a hard timeout that kills a runaway worker (LB_MESH_SPAWN_TIMEOUT_MS)
 *        (g) every spawn AND every refusal logged to the ledger with dispatch id, origin peer
 *            id, decision, and a real UTC clock call
 *
 * NEVER interpolates promptText (or any payload field) into a shell string. child_process.spawn
 * is called with an explicit argv array and shell:false (Node's own default for spawn, stated
 * explicitly here anyway so a future edit cannot silently flip it) -- see spawnBishopWorker()
 * below and its accompanying shell-injection test in bishop_dispatch_handler.test.ts.
 */

import { existsSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import type { BishopDispatchPayload } from './mic_dispatcher';
import type { BishopDispatchResult } from './peer_server';

// ─── Ledger root (refuted-premise note, D-BP156-M0-008) ────────────────────────────────────
//
// The ticket this file was built under asserted "LB_LEDGER_ROOT is the existing overridable
// config introduced at commit 2f22a422; use it, never a hardcoded absolute path." That premise
// is REFUTED: `git log --all` in this repo has no commit 2f22a422 (ambiguous/unknown revision),
// a repo-wide grep for `LB_LEDGER_ROOT` before this file was written found zero hits, and the
// one existing ledger-root constant in this codebase (yoke_watcher.ts's `LEDGER_ROOT`) is a
// hardcoded literal with its own comment stating it is "single-machine estate tooling, not a
// portable library." No overridable config existed before this dispatch. resolveLedgerRoot()
// below IS that override capability, newly added here -- its default matches yoke_watcher.ts's
// existing hardcoded value so both stay consistent unless an operator explicitly overrides.
const DEFAULT_LEDGER_ROOT = 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\HARDWIRE\\LEDGER';

export function resolveLedgerRoot(): string {
  const envVal = process.env.LB_LEDGER_ROOT;
  return envVal && envVal.trim().length > 0 ? envVal : DEFAULT_LEDGER_ROOT;
}

function getNoticesDir(): string {
  return join(resolveLedgerRoot(), 'YOKE', 'NOTICES');
}

function getSpawnedMarkerDir(): string {
  return join(resolveLedgerRoot(), 'YOKE', 'NOTICES', '.spawned');
}

function getSpawnLogPath(): string {
  return join(resolveLedgerRoot(), 'YOKE', 'HEARTBEAT', 'BISHOP_DISPATCH_SPAWN.beat');
}

function nowUtc(): string {
  return new Date().toISOString();
}

// ─── Step 3: the yoke file write (unconditional) ────────────────────────────────────────────

/** Writes `${LB_LEDGER_ROOT}/YOKE/NOTICES/<dispatchId>.md`. Idempotent: a replayed/duplicated
 *  payload for the same dispatch id does not overwrite the original record (Rule 66 -- never
 *  clobber an existing file in place; this is not an in-place EDIT of an existing document, it
 *  is a would-be duplicate write, so the correct behavior is "skip, do not overwrite" rather
 *  than manufacturing a superseded sibling for a file that was never meant to change). */
export function writeYokeNoticeFile(
  payload: BishopDispatchPayload,
  verifiedOriginPeerId: string | null,
): { path: string; alreadyExisted: boolean } {
  const dir = getNoticesDir();
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${payload.dispatchId}.md`);
  if (existsSync(path)) {
    return { path, alreadyExisted: true };
  }
  const body =
    `MESH DISPATCH\n` +
    `DISPATCH: ${payload.dispatchId}\n` +
    `FROM: ${verifiedOriginPeerId ?? `UNVERIFIED (self-declared: ${payload.originPeerId})`}\n` +
    `RECEIVED_UTC: ${nowUtc()}\n` +
    `WORKING_DIR: ${payload.workingDir}\n` +
    `---\n` +
    `${payload.promptText}\n`;
  writeFileSync(path, body, 'utf8');
  return { path, alreadyExisted: false };
}

// ─── Carrier-agnostic by construction (D-BP156-M0-008 design-constraint follow-up) ──────────
//
// handleBishopDispatch() below takes a decoded BishopDispatchPayload plus a plain
// `verifiedOriginPeerId: string | null` -- it never reaches into WAN-relay-specific structures
// (no payload_encrypted, no route_id, no Supabase row shape) to decide who sent this. That
// decoding/verification work belongs entirely to the CARRIER (today: peer_server.ts's
// handleInboundBishopDispatchEnvelope, which decrypts + Ed25519-verifies a wan-relay-route
// payload -- see mic_dispatcher.ts's BishopDispatchTransport interface for the send-side
// mirror of this same seam). A future LAN carrier would decode its own wire format and its own
// signature scheme, then call this SAME function with the SAME two arguments.
//
// LOAD-BEARING SECURITY NOTE, stated here because it gates process spawning: LAN IS A LATENCY
// OPTIMIZATION, NEVER A TRUST BOUNDARY. Being on the same subnet as this machine is not
// authentication. Every guardrail below (origin allowlist, working-dir containment, kill
// switch, dedupe, concurrency cap, timeout, logging) applies IDENTICALLY regardless of which
// carrier delivered the payload -- a LAN carrier is required to produce a real
// verifiedOriginPeerId (e.g. via the same Ed25519 trust-on-first-use verification
// peer_server.ts already applies to the LAN /api/plow-domain path, resolvePlowDomainRequest
// above) before calling this function, not merely infer origin from which socket the bytes
// arrived on. No code path in this file, and no future carrier's code path, may skip a check
// that another carrier must pass.

// ─── Guardrail (a): sender allowlist ────────────────────────────────────────────────────────

/** M0's peer id, per this session's measured facts (D-BP156-M0-008 ticket: "peer_id
 *  61db110655432a41, label TERENO" is M3; "M0 is 1a78f7c9bdd5e830, label LIANABANYAN"). */
const DEFAULT_ALLOWED_ORIGINS = ['1a78f7c9bdd5e830'];

export function getAllowedOriginPeerIds(): string[] {
  const envVal = process.env.LB_MESH_ALLOWED_ORIGINS;
  if (envVal && envVal.trim().length > 0) {
    return envVal.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  }
  return DEFAULT_ALLOWED_ORIGINS;
}

function isOriginAllowed(verifiedOriginPeerId: string | null): boolean {
  if (!verifiedOriginPeerId) return false; // unverified sender never spawns, regardless of allowlist
  return getAllowedOriginPeerIds().includes(verifiedOriginPeerId);
}

// ─── Guardrail (b): working-directory allowlist ─────────────────────────────────────────────

// D-BP156-M0-022 (follow-up, own commit): was hardcoded 'C:\Users\Administrator\Documents' --
// M0's own username, on a product that ships to other machines/accounts (the same portability
// defect class already found compiled into app.asar as DEFAULT_LEDGER_ROOT/canonDir). Node's
// own os.homedir() resolves to whatever account actually owns the running process on any
// machine, any username, any OS -- deliberately NOT Electron's app.getPath('documents'), which
// requires a real running Electron `app` singleton and would break this file's own OFFLINE test
// suite (bishop_dispatch_handler.test.ts) the same way getOrCreateKeypair()'s app.getPath
// dependency already breaks standalone scripts (see bishop_dispatch_send_ipc.ts's header).
// Still just a DEFAULT: LB_MESH_ALLOWED_WORKDIR_ROOT remains the documented, expected-to-be-set
// per-machine override (see getAllowedWorkdirRoot() below).
const DEFAULT_ALLOWED_WORKDIR_ROOT = join(homedir(), 'Documents');

export function getAllowedWorkdirRoot(): string {
  const envVal = process.env.LB_MESH_ALLOWED_WORKDIR_ROOT;
  return envVal && envVal.trim().length > 0 ? envVal : DEFAULT_ALLOWED_WORKDIR_ROOT;
}

/** Resolves `workingDir` and checks it is contained inside the allowed root -- lexically
 *  (resolve() collapses ".." segments, so a naive "../../escape" traversal is caught here)
 *  AND by realpath (catches a symlink planted inside the allowed root that points outside it --
 *  resolve() alone does not follow symlinks).
 *
 *  D-BP156-M0-022 REVISED: a working dir that does not exist is now REFUSED here, not accepted
 *  on the lexical check alone. The original judgment ("a safe failure mode, not a security
 *  hole -- it never RUNS with dubious cwd, it errors") was right about security and wrong about
 *  safety: a missing cwd handed to `spawn()` on Windows produces `spawn <exe> ENOENT`, a message
 *  that names the EXECUTABLE, not the directory -- a real failure that accuses an innocent
 *  component. That misdirection cost a live session three wrong diagnoses in a row (transient,
 *  then a spawn-code regression, then a caller-side transform) before the actual shape of the
 *  gap was found by reading this function. Refusing here, with a reason distinguishable from
 *  the containment refusal above (different fault, different remedy: this one means "the
 *  directory needs to be created or the payload's workingDir is wrong," not "the sender is
 *  attempting a path-traversal escape"), converts an illegible downstream failure into a
 *  self-diagnosing guardrail refusal -- independent of whether a missing cwd is what actually
 *  happened in any specific run. */
export function isWorkingDirAllowed(workingDir: string): { ok: boolean; resolved: string; reason?: string } {
  const allowedRoot = resolve(getAllowedWorkdirRoot());
  const resolved = resolve(workingDir);

  const lexicallyContained = resolved === allowedRoot || resolved.startsWith(allowedRoot + sep);
  if (!lexicallyContained) {
    return { ok: false, resolved, reason: `"${resolved}" escapes allowed root "${allowedRoot}"` };
  }

  if (!existsSync(resolved)) {
    return { ok: false, resolved, reason: `REFUSED: working directory does not exist: "${resolved}"` };
  }

  try {
    const realResolved = realpathSync(resolved);
    const realAllowedRoot = existsSync(allowedRoot) ? realpathSync(allowedRoot) : allowedRoot;
    const realContained = realResolved === realAllowedRoot || realResolved.startsWith(realAllowedRoot + sep);
    if (!realContained) {
      return { ok: false, resolved, reason: `"${resolved}" resolves (via symlink) to "${realResolved}", which escapes "${realAllowedRoot}"` };
    }
  } catch (err) {
    return { ok: false, resolved, reason: `realpath check failed: ${err instanceof Error ? err.message : String(err)}` };
  }

  return { ok: true, resolved };
}

// ─── Guardrail (c): kill switch, DEFAULT DISABLED ───────────────────────────────────────────

/** Flag name an M3 operator sets to enable auto-spawn: LB_MESH_AUTO_SPAWN_ENABLED=true.
 *  ANY other value (absent, "false", "0", typo) is treated as disabled -- fails closed. */
export function isAutoSpawnEnabled(): boolean {
  return process.env.LB_MESH_AUTO_SPAWN_ENABLED === 'true';
}

// ─── Guardrail (d): one-spawn-per-dispatch-id-ever dedupe ──────────────────────────────────

export function hasAlreadySpawned(dispatchId: string): boolean {
  return existsSync(join(getSpawnedMarkerDir(), `${dispatchId}.spawned`));
}

function markSpawned(dispatchId: string): void {
  const dir = getSpawnedMarkerDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${dispatchId}.spawned`), `${nowUtc()}\n`, 'utf8');
}

// ─── Guardrail (e)/(f): concurrency cap and timeout ─────────────────────────────────────────

const DEFAULT_MAX_CONCURRENT_SPAWNS = 2;
const DEFAULT_SPAWN_TIMEOUT_MS = 30 * 60_000; // 30 minutes

export function getMaxConcurrentSpawns(): number {
  const envVal = process.env.LB_MESH_MAX_CONCURRENT_SPAWNS;
  const parsed = envVal ? Number.parseInt(envVal, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_CONCURRENT_SPAWNS;
}

export function getSpawnTimeoutMs(): number {
  const envVal = process.env.LB_MESH_SPAWN_TIMEOUT_MS;
  const parsed = envVal ? Number.parseInt(envVal, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SPAWN_TIMEOUT_MS;
}

/** In-memory only (module-local) -- a process restart naturally resets this to 0, which is
 *  correct: a restarted process has no live children left over from before it restarted. The
 *  dedupe-ever guarantee (guardrail d) is the one that must survive a restart, and it does
 *  because it is a file on disk, not this counter. */
const _activeSpawns = new Set<string>();

export function getActiveSpawnCount(): number {
  return _activeSpawns.size;
}

// ─── CLI invocation ──────────────────────────────────────────────────────────────────────────

/** Verified on disk this session (D-BP156-M0-008): `where claude` resolved to a real .exe,
 *  `C:\Users\Administrator\.local\bin\claude.exe`, not a .cmd/.bat shim -- important because
 *  Node's child_process.spawn on Windows requires shell:true to launch a .cmd/.bat file, and
 *  shell:true reintroduces exactly the argument-parsing risk this guardrail exists to avoid
 *  (see Node's own CVE-2024-27980 writeup). A genuine .exe needs no shell wrapping at all.
 *  The DEFAULT here is deliberately the bare command name "claude" (not this machine's
 *  absolute path) for portability to M3 -- M3's operator must confirm `claude` resolves on
 *  M3's own PATH (or set LB_MESH_SPAWN_CLI_PATH to an absolute path) before enabling the kill
 *  switch. Cursor's agent.cmd (the other reference pattern in this estate's memory) was
 *  deliberately NOT chosen as the default specifically because it IS a .cmd file. */
const DEFAULT_CLI_PATH = 'claude';
const DEFAULT_MODEL = 'sonnet';
const DEFAULT_PERMISSION_MODE = 'default';

export function getSpawnCliPath(): string {
  const envVal = process.env.LB_MESH_SPAWN_CLI_PATH;
  return envVal && envVal.trim().length > 0 ? envVal : DEFAULT_CLI_PATH;
}

export function getSpawnModel(): string {
  const envVal = process.env.LB_MESH_SPAWN_MODEL;
  return envVal && envVal.trim().length > 0 ? envVal : DEFAULT_MODEL;
}

export function getSpawnPermissionMode(): string {
  const envVal = process.env.LB_MESH_SPAWN_PERMISSION_MODE;
  return envVal && envVal.trim().length > 0 ? envVal : DEFAULT_PERMISSION_MODE;
}

/** Injectable so tests never actually spawn a process (see bishop_dispatch_handler.test.ts) --
 *  the default is the real node:child_process.spawn. This is the ONLY function in this file
 *  that touches process creation; every guardrail above it is a pure decision function. */
export type SpawnFn = typeof spawn;

/** D-BP156-M0-022: outcome of the bounded immediate-failure window below. `spawned: false`
 *  means the OS never actually created the process (a synchronous-class failure -- ENOENT for
 *  a missing binary/cwd, EACCES, etc. -- surfaced via child_process's 'error' event). `spawned:
 *  true` means either the process is confirmed running (no 'error' within the grace window) OR
 *  it already ran to completion within that same short window ('exit' fired first) -- either
 *  way, the OS did create a real process, which is the only claim this field makes. */
export interface LaunchOutcome {
  spawned: boolean;
  error?: string;
}

/** D-BP156-M0-022: how long launchWorker() waits, after calling spawnImpl(), before deciding
 *  what to report. NOT a wait for the worker's full lifetime (that can run up to
 *  LB_MESH_SPAWN_TIMEOUT_MS, default 30 minutes) -- it exists solely to give Node's own
 *  child_process implementation one full macrotask turn to deliver a synchronous-class launch
 *  failure. Node's internal spawn() defers a same-call failure (ENOENT, EACCES, bad cwd) to
 *  `process.nextTick` specifically so `.on('error', ...)` attached immediately after the call
 *  still catches it (see lib/internal/child_process.js's `onErrorNT` in Node's own source) --
 *  and the nextTick queue is always fully drained before the next macrotask (setImmediate/
 *  setTimeout) runs. One `setImmediate` tick is therefore sufficient to observe that class of
 *  failure without blocking on anything slower (a real launch that later fails on auth, e.g.
 *  the ~3.2s exit this codebase has already measured, is unaffected -- this window elapses long
 *  before that and reports `spawned: true`, correctly: the process DID launch). */
const SPAWN_IMMEDIATE_OUTCOME_GRACE = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

/**
 * Launches `claude -p <promptText> --output-format text --model <model> --permission-mode
 * <mode>` with `cwd: workingDir`. promptText and workingDir are passed as DISCRETE ARGV ARRAY
 * ELEMENTS, never concatenated into a command string -- shell:false is passed explicitly
 * (Node's own default for spawn, stated here so a future edit cannot silently flip it) so the
 * OS process-creation call receives each argument atomically; shell metacharacters inside
 * promptText (`; `, `&&`, backticks, `$(...)`, quotes) are inert data to the child process,
 * never parsed as shell syntax, because no shell is ever invoked to interpret them.
 *
 * Caller (spawnBishopWorkerIfAllowed) is responsible for every guardrail (allowlists, kill
 * switch, dedupe, concurrency cap) -- this function assumes all of that has already passed and
 * only implements: safe invocation, the concurrency-count bookkeeping, and the hard timeout.
 *
 * D-BP156-M0-022: returns a Promise<LaunchOutcome> instead of `void`. Previously this function
 * was fire-and-forget and the caller (handleBishopDispatch) reported `spawned: true` the instant
 * it decided to attempt a launch, before the OS process-creation call had resolved one way or
 * the other -- a real run (`D-BP156-M3-007`) recorded a `SPAWN_ERROR ENOENT` on disk 76ms before
 * the mesh reply asserted `spawned: true` for that same dispatch. `spawned` is `BishopDispatch-
 * Result`'s own documented field ("True only if a worker was actually spawned" -- peer_server.ts)
 * and a false `true` there is a false receipt a conductor can act on. This function now waits
 * one bounded grace window (see SPAWN_IMMEDIATE_OUTCOME_GRACE above) so the caller can report
 * what actually happened instead of what was merely attempted, without blocking on the worker's
 * full (up to 30-minute) lifetime.
 */
async function launchWorker(
  payload: BishopDispatchPayload,
  spawnImpl: SpawnFn,
): Promise<LaunchOutcome> {
  const cliPath = getSpawnCliPath();
  const args = [
    '-p', payload.promptText,
    '--output-format', 'text',
    '--model', getSpawnModel(),
    '--permission-mode', getSpawnPermissionMode(),
  ];

  _activeSpawns.add(payload.dispatchId);
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    _activeSpawns.delete(payload.dispatchId);
  };

  let child: ReturnType<SpawnFn>;
  try {
    child = spawnImpl(cliPath, args, {
      cwd: payload.workingDir,
      shell: false,
      windowsHide: true,
      stdio: 'ignore',
    });
  } catch (err) {
    finish();
    const detail = err instanceof Error ? err.message : String(err);
    logSpawnEvent({
      dispatchId: payload.dispatchId,
      originPeerId: payload.originPeerId,
      decision: 'SPAWN_FAILED',
      detail,
    });
    return { spawned: false, error: detail };
  }

  const timeoutMs = getSpawnTimeoutMs();
  const timer = setTimeout(() => {
    try { child.kill('SIGTERM'); } catch { /* best-effort */ }
    logSpawnEvent({
      dispatchId: payload.dispatchId,
      originPeerId: payload.originPeerId,
      decision: 'SPAWN_TIMEOUT_KILLED',
      detail: `exceeded ${timeoutMs}ms`,
    });
  }, timeoutMs);
  timer.unref?.();

  // D-BP156-M0-022: resolved exactly once, by whichever of the three settles first -- a genuine
  // 'error' (process never created), a genuine 'exit' that lands within the grace window (a
  // real, if very fast, launch-and-complete), or the grace window itself elapsing with neither
  // (a real, still-running process -- the common case for a working launch).
  const outcome = new Promise<LaunchOutcome>((resolveOutcome) => {
    let outcomeSettled = false;
    const settleOutcome = (result: LaunchOutcome) => {
      if (outcomeSettled) return;
      outcomeSettled = true;
      resolveOutcome(result);
    };

    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      finish();
      logSpawnEvent({
        dispatchId: payload.dispatchId,
        originPeerId: payload.originPeerId,
        decision: 'SPAWN_EXITED',
        detail: `code=${code ?? 'null'} signal=${signal ?? 'null'}`,
      });
      // Exiting (even non-zero -- e.g. a downstream auth failure) still means the OS DID create
      // the process. That is the only claim `spawned` makes; whatever the worker did with its
      // life is a separate question this field does not answer.
      settleOutcome({ spawned: true });
    });
    child.once('error', (err) => {
      clearTimeout(timer);
      finish();
      const detail = err instanceof Error ? err.message : String(err);
      logSpawnEvent({
        dispatchId: payload.dispatchId,
        originPeerId: payload.originPeerId,
        decision: 'SPAWN_ERROR',
        detail,
      });
      settleOutcome({ spawned: false, error: detail });
    });

    void SPAWN_IMMEDIATE_OUTCOME_GRACE().then(() => settleOutcome({ spawned: true }));
  });

  return outcome;
}

// ─── Guardrail (g): logging ──────────────────────────────────────────────────────────────────

interface SpawnLogEntry {
  dispatchId: string;
  originPeerId: string;
  decision: string;
  detail?: string;
}

/** Append-only, matching the existing HEARTBEAT_DIR *.beat convention already used elsewhere
 *  in this codebase (e.g. index.ts's LIANA-TERMINAL.beat) -- never overwritten, one line per
 *  event, real UTC clock call per line. */
export function logSpawnEvent(entry: SpawnLogEntry): void {
  try {
    const dir = join(resolveLedgerRoot(), 'YOKE', 'HEARTBEAT');
    mkdirSync(dir, { recursive: true });
    const line = `${nowUtc()}  BISHOP-DISPATCH-SPAWN  dispatch=${entry.dispatchId}  origin=${entry.originPeerId}  decision=${entry.decision}${entry.detail ? `  detail=${entry.detail}` : ''}\n`;
    const { appendFileSync } = require('node:fs') as typeof import('node:fs');
    appendFileSync(getSpawnLogPath(), line, 'utf8');
  } catch (err) {
    console.warn('[bishop_dispatch_handler] logSpawnEvent write failed (non-fatal):', err);
  }
}

// ─── The hook itself ─────────────────────────────────────────────────────────────────────────

/**
 * Registered as peer_server.ts's `onBishopDispatch` hook. Always writes the yoke file first
 * (Step 3, unconditional -- "the file IS the wake"). Then evaluates all seven spawn guardrails
 * in order, refusing (and logging the refusal) at the first one that fails, and only calling
 * launchWorker() when every guardrail passes.
 */
export async function handleBishopDispatch(
  payload: BishopDispatchPayload,
  verifiedOriginPeerId: string | null,
  spawnImpl: SpawnFn = spawn,
): Promise<BishopDispatchResult> {
  const { path: noticePath, alreadyExisted } = writeYokeNoticeFile(payload, verifiedOriginPeerId);

  const refuse = (reason: string): BishopDispatchResult => {
    logSpawnEvent({ dispatchId: payload.dispatchId, originPeerId: payload.originPeerId, decision: 'REFUSED', detail: reason });
    return { ok: true, spawned: false, reason, noticePath };
  };

  if (!isOriginAllowed(verifiedOriginPeerId)) {
    return refuse(`sender not on allowlist (verified=${verifiedOriginPeerId ?? 'null'}, allowed=[${getAllowedOriginPeerIds().join(',')}])`);
  }

  const workdirCheck = isWorkingDirAllowed(payload.workingDir);
  if (!workdirCheck.ok) {
    return refuse(`working dir not allowed: ${workdirCheck.reason}`);
  }

  if (!isAutoSpawnEnabled()) {
    return refuse('auto-spawn kill switch is disabled (LB_MESH_AUTO_SPAWN_ENABLED != "true")');
  }

  if (hasAlreadySpawned(payload.dispatchId)) {
    return refuse('already spawned once for this dispatch id (dedupe-ever marker present)');
  }

  if (getActiveSpawnCount() >= getMaxConcurrentSpawns()) {
    return refuse(`concurrency cap reached (${getActiveSpawnCount()}/${getMaxConcurrentSpawns()})`);
  }

  if (alreadyExisted) {
    // The yoke file already existed but no spawn marker did -- a genuinely odd state (a prior
    // process wrote the file but crashed before marking spawned). Treat as a replay and refuse
    // rather than guessing at intent; a human/M0 can force a re-dispatch under a new id.
    return refuse('notice file already existed with no spawn marker -- treating as a possible replay, refusing rather than guessing');
  }

  // All guardrails passed. Mark BEFORE spawning to close the replay race window (favors
  // never-double-spawn over guaranteed-single-attempt, per the dispatch's own instruction).
  markSpawned(payload.dispatchId);
  // 'SPAWNED' logged here records the DECISION to attempt a launch -- correct to log
  // immediately, and distinct from the returned BishopDispatchResult below, which now waits for
  // launchWorker()'s bounded outcome (D-BP156-M0-022) so `spawned` reports what happened, not
  // merely what was attempted.
  logSpawnEvent({ dispatchId: payload.dispatchId, originPeerId: payload.originPeerId, decision: 'SPAWNED' });
  const outcome = await launchWorker(payload, spawnImpl);
  return {
    ok: true,
    spawned: outcome.spawned,
    reason: outcome.spawned ? 'spawned' : `spawn failed: ${outcome.error ?? 'unknown error'}`,
    noticePath,
  };
}
