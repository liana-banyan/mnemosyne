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
 *      D-BP157-007 added two more things launchWorker() does once the seven guardrails above have
 *      already passed:
 *        (h) HARDWIRE-25 claim: the dispatch id is claimed via yoke_claim.sh before the worker
 *            can write anything under it; a bare id already held by a live actor gets the worker
 *            reassigned to a deterministic "-W1"/"-W2"/... child id instead. D-BP157-010 found,
 *            and D-BP157-012 CLOSED, a gap here: at cap exhaustion (every candidate refused) this
 *            is now an EIGHTH GUARDRAIL, not a non-refusing side effect -- launchWorker() fails
 *            closed and refuses to spawn under an unclaimed id, logging a distinct
 *            SPAWN_REFUSED_UNCLAIMED beat event so the refusal is loud, not silent.
 *        (i) the worker's stdout+stderr are captured to a real log file under
 *            `${LB_LEDGER_ROOT}/YOKE/WORKER_LOGS/<effectiveDispatchId>.log`, not discarded.
 *
 *      D-BP157-010 closes a gap D-BP157-007 flagged rather than hid: (h)'s yoke_claim.sh call
 *      is now reached through an injectable `claimImpl: ClaimExecFn` parameter (mirroring
 *      `spawnImpl: SpawnFn`), so bishop_dispatch_handler.test.ts's stated "no real process is
 *      ever spawned" guarantee holds again. Production default is unchanged: execFileSync, same
 *      arguments, same behavior.
 *
 *      D-BP157-012 closes the gap D-BP157-010 found and documented but correctly left alone as
 *      out of its own scope: launchWorker() did not gate spawning on claimResult.claimed, so at
 *      cap exhaustion (MAX_CHILD_SUFFIX_ATTEMPTS suffix attempts, 21 total tries) it still
 *      launched a worker under an unclaimed id -- HARDWIRE-25's guard failed OPEN under exactly
 *      the contention it exists to catch. Per Founder ruling FD-BP157-02 ("PUT ALL THAT WE BUILD
 *      IN"), launchWorker() now REFUSES TO SPAWN when claimResult.claimed is false: no argv is
 *      built, no worker log is opened, spawnImpl is never called, and a distinct beat-file
 *      decision (SPAWN_REFUSED_UNCLAIMED) is logged naming the dispatch id, attempts tried, and
 *      the cap, so an operator can distinguish this refusal from "ran and did nothing" or "never
 *      arrived." The happy path (claim wins, bare id or any suffix) is unchanged.
 *
 *      D-BP157-033 confirmed the exact cause of "spawns, exits 0, produces nothing": argv's
 *      `--permission-mode` was unconditionally `getSpawnPermissionMode()` (default "default"), and
 *      a non-interactive, detached worker under that mode has no human present to approve a tool
 *      call, so it can write nothing. Per FD-BP157-04/FD-BP157-05, a NEW, SEPARATE consent gate
 *      (mesh_auto_spawn_consent.ts, mirroring mesh_trust_settings.ts's shape, OFF by default) is
 *      now required, IN ADDITION TO the existing kill switch (guardrail (c) above), before a
 *      worker is launched under an elevated permission mode that can actually write files and run
 *      commands. Neither gate alone is sufficient -- see resolveEffectivePermissionMode() below,
 *      the pure function that encodes this truth table, and its callers.
 *
 *      D-BP157-041/BISHOP/seg-fix-worker-output-and-hooks closes two more gaps, MEASURED (not
 *      inferred) by Bishop M0 running the real CLI by hand, no mesh involved: `claude -p ... --
 *      output-format text` exits 0 in 10-26s with a 1-byte (bare newline) log -- the exact
 *      production symptom. The same command with `--output-format json` reveals why: the JSON
 *      shows `num_turns:11, duration_api_ms:0, usage:{input_tokens:0,output_tokens:0},
 *      result:""` while still claiming `subtype:"success", is_error:false`. Eleven turns ran and
 *      NONE of them reached the model -- confirmed by a THIRD run with CLAUDE_CONFIG_DIR pointed
 *      at an empty temp dir (no hooks, no settings.json), which exits in ~4s with a real
 *      (if unauthenticated) response. The account's SessionStart/UserPromptSubmit/SessionEnd
 *      hooks (~15 across this account's settings.json) consume the worker's turns before any
 *      model call happens. Two changes, both in launchWorker() below:
 *        (j) argv's `--output-format` is now `json`, not `text`. The captured worker log is
 *            parsed (parseWorkerJsonOutput below) and its real numbers -- num_turns,
 *            duration_api_ms, token counts, total_cost_usd, result length -- are folded into
 *            deriveCompletionOutcome's `issues`, alongside a new WORKER_NO_MODEL_CALL issue
 *            raised exactly when duration_api_ms is 0 and total tokens are 0 while num_turns is
 *            greater than 0 -- the measured "turns ran, nothing reached the model" signature.
 *            The CLI's own `subtype`/`is_error` verdict is recorded but never trusted as the
 *            lifecycle signal; the existing sentinel-based lifecycle logic (evidence table above
 *            deriveCompletionOutcome) is unchanged and still authoritative.
 *        (k) when (and only when) BOTH the kill switch and the mesh auto-spawn consent gate are
 *            satisfied (the same `elevated` boolean resolveEffectivePermissionMode already
 *            computes), the spawned worker's child process gets its own CLAUDE_CONFIG_DIR (see
 *            getWorkerClaudeConfigDir/isWorkerClaudeConfigDirProvisioned below), pointed at a
 *            directory under this estate's own ledger root -- NOT C:\Users\Administrator\.claude
 *            -- so it starts with zero hooks (no settings.json there means no hooks run at all)
 *            instead of inheriting the account's full hook set. If that directory is not
 *            provisioned (does not exist or is empty), launchWorker() REFUSES to spawn with a
 *            distinct, loud WORKER_CLAUDE_CONFIG_DIR_NOT_PROVISIONED error -- it never falls back
 *            to leaving CLAUDE_CONFIG_DIR unset, because that would silently restore the exact
 *            bug this closes. What that directory needs provisioned, and what could not be
 *            determined without moving credential material (forbidden), is documented at
 *            getWorkerClaudeConfigDir's own definition below and in this dispatch's return doc.
 *
 * NEVER interpolates promptText (or any payload field) into a shell string. child_process.spawn
 * is called with an explicit argv array and shell:false (Node's own default for spawn, stated
 * explicitly here anyway so a future edit cannot silently flip it) -- see spawnBishopWorker()
 * below and its accompanying shell-injection test in bishop_dispatch_handler.test.ts.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, realpathSync, openSync, closeSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import type { StdioOptions } from 'node:child_process';
import { homedir } from 'node:os';
import type { BishopDispatchPayload } from './mic_dispatcher';
import type { BishopDispatchResult, WorkLifecycle, WorkIssue } from './peer_server';
import { getStablePeerId } from './peer-discovery';
import {
  writeBishopDispatchCompletionReply,
  getDefaultReplyWriteConfig,
  type BishopDispatchCompletionInput,
} from './bishop_dispatch_reply';
// D-BP157-033: the new, separate mesh auto-spawn consent gate (FD-BP157-04/FD-BP157-05) --
// see resolveEffectivePermissionMode() below for how this is coupled with the existing
// LB_MESH_AUTO_SPAWN_ENABLED kill switch (isAutoSpawnEnabled() above).
import { isMeshAutoSpawnConsentGranted } from './mesh_auto_spawn_consent';

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

// D-BP157-007, work item 1: the worker's own stdout/stderr, captured instead of discarded.
// Alongside the existing YOKE/HEARTBEAT/ and YOKE/NOTICES/.spawned/ artifacts, named by the
// EFFECTIVE (possibly HARDWIRE-25-suffixed, see claimEffectiveDispatchId below) dispatch id so a
// successor reading a suffixed return/canoe/beat can find the matching log by the same id.
function getWorkerLogDir(): string {
  return join(resolveLedgerRoot(), 'YOKE', 'WORKER_LOGS');
}

function getWorkerLogPath(effectiveDispatchId: string): string {
  return join(getWorkerLogDir(), `${effectiveDispatchId}.log`);
}

function nowUtc(): string {
  return new Date().toISOString();
}

/** Builds a single falsifiable `WorkIssue`, tying it to the evidence it was read off of --
 *  matches peer_server.ts's own `transportIssue()` helper for the transport-level (ok:false)
 *  side of the same status vocabulary (D-BP157-023, SEG_RETURN_BP157_015's design). */
function makeIssue(code: string, message: string, evidence: string, observedBy: string): WorkIssue {
  return { code, message, evidence, observedAtUtc: nowUtc(), observedBy };
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

// ─── HARDWIRE-25: the claim protocol, closing the parent/child collision gap ────────────────
//
// D-BP157-007, work item 3. `hasAlreadySpawned()` above only dedupes THIS relay's own repeat
// delivery of the same dispatch id -- it has no way to know a resident Bishop session, reached
// through a different channel entirely, is already alive and working the identical id (the
// measured BP156-M3-011 incident: two live actors, one dispatch id, one return path, "neither of
// us knows the other exists" -- M3's own words, filed in D-BP156-M3-011_PARENT_SESSION.md).
// HARDWIRE-25 (proposed D-BP157-003, ratified per FD-BP157-01) closes that gap: before this
// handler lets a spawned worker write anything under a dispatch id, it claims that id via the
// existing yoke_claim.sh atomic-create protocol (HARDWIRE-24 Section 5). If the bare id is
// already claimed by a live actor, the spawned worker becomes a CHILD and is assigned a
// deterministic -W1, -W2, ... suffix -- never a fresh top-level id, never random -- so a reader
// can always find a child's output by appending -W<n> to the parent id in order.
//
// yoke_claim.sh is invoked, not reimplemented -- that is the entire point of HARDWIRE-25's own
// wording. It runs under bash.
//
// D-BP157-014 CORRECTED the line above (previously: "DEFAULT_BASH_PATH below is the bare command
// name so a PATH-resolved bash is used first, exactly the same portability idiom DEFAULT_CLI_PATH
// already uses for `claude`"). That idiom was measured wrong twice over on this machine by the
// Founder's own live run tonight (2026-08-18): a bare 'bash' resolves to
// C:\Windows\System32\bash.exe (the WSL launcher stub), not a real Git-for-Windows bash, and
// separately, a plausible manual LB_MESH_BASH_PATH override of C:\Program Files\Git\usr\bin\bash.exe
// is ALSO wrong -- invoked directly (not from inside an already-configured bash), it starts WITHOUT
// the MSYS PATH prepended, so coreutils including `date` are missing, which is exactly the failure
// yoke_claim.sh hit 21 times in a row that run (see that script's own D-BP157-014 hardening of
// now_utc()/expires_utc()/is_expired(), which now also fails loudly instead of silently on a
// missing `date`). C:\Program Files\Git\bin\bash.exe is the one that sets up its own environment
// (prepends /mingw64/bin:/usr/bin to PATH) and was empirically verified working, invoked directly,
// on this machine this dispatch. Resolved in explicit, ordered preference below -- first existing
// well-known Git-for-Windows bash location wins, bare 'bash' is the last-resort fallback so a
// machine with none of the well-known layouts still attempts something rather than hard-failing at
// import time. LB_MESH_BASH_PATH (see getBashPath() below) still overrides everything.

const KNOWN_GIT_BASH_PATHS = [
  'C:\\Program Files\\Git\\bin\\bash.exe',
  'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
  join(homedir(), 'AppData', 'Local', 'Programs', 'Git', 'bin', 'bash.exe'),
];

/** D-BP157-014: ordered default-bash resolution, first KNOWN_GIT_BASH_PATHS entry that exists on
 *  disk wins; falls back to the bare command name (the old, now-measured-unreliable behavior) only
 *  if none of the well-known locations exist. `existsFn` is injectable so tests can exercise the
 *  ordering without depending on this machine's actual disk layout. */
export function resolveDefaultBashPath(existsFn: (p: string) => boolean = existsSync): string {
  for (const candidate of KNOWN_GIT_BASH_PATHS) {
    if (existsFn(candidate)) return candidate;
  }
  return 'bash';
}

const DEFAULT_BASH_PATH = resolveDefaultBashPath();
const DEFAULT_CLAIM_ACTOR = 'MNEMOSYNEC-AUTOSPAWN';
const MAX_CHILD_SUFFIX_ATTEMPTS = 20;

/** D-BP157-010: injectable so tests never actually shell out (see bishop_dispatch_handler.test.ts)
 *  -- the default is the real node:child_process.execFileSync. Mirrors SpawnFn/spawnImpl exactly:
 *  this is the ONLY function tryClaim() below touches to invoke yoke_claim.sh; every guardrail
 *  and retry decision around it (tryClaim's try/catch, claimEffectiveDispatchId's suffix walk)
 *  stays real code, exercised for real, with only the actual OS-level process creation faked. */
export type ClaimExecFn = typeof execFileSync;

export function getBashPath(): string {
  const envVal = process.env.LB_MESH_BASH_PATH;
  return envVal && envVal.trim().length > 0 ? envVal : DEFAULT_BASH_PATH;
}

/** Default derived from the ledger root, matching yoke_claim.sh's own directory convention
 *  (HARDWIRE\tools\ sits alongside HARDWIRE\LEDGER\, the ledger root's parent) -- overridable
 *  directly for a layout that does not follow that convention. */
export function getYokeClaimScriptPath(): string {
  const envVal = process.env.LB_MESH_YOKE_CLAIM_SCRIPT_PATH;
  if (envVal && envVal.trim().length > 0) return envVal;
  return join(resolveLedgerRoot(), '..', 'tools', 'yoke_claim.sh');
}

export function getClaimActor(): string {
  const envVal = process.env.LB_MESH_CLAIM_ACTOR;
  return envVal && envVal.trim().length > 0 ? envVal : DEFAULT_CLAIM_ACTOR;
}

/** Defaults to the spawn timeout expressed in whole hours (minimum 1) so a claim does not
 *  meaningfully outlive the worker it was taken for; LB_MESH_CLAIM_TTL_HOURS overrides directly,
 *  matching every other numeric guardrail's env-override idiom in this file. */
export function getClaimTtlHours(): number {
  const envVal = process.env.LB_MESH_CLAIM_TTL_HOURS;
  const parsed = envVal ? Number.parseInt(envVal, 10) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return Math.max(1, Math.ceil(getSpawnTimeoutMs() / 3_600_000));
}

/** Invokes `yoke_claim.sh claim <id> <actor> <model> <ttlHours>` via claimImpl (execFileSync in
 *  production) -- synchronous and short-lived (a single local file create), matching the rest of
 *  this file's synchronous guardrail style. Exit code 0 means the claim was won; any non-zero
 *  exit (already claimed, or the script/bash itself could not run) is reported back as ok:false
 *  with whatever detail is available, never thrown past this function. */
function tryClaim(
  dispatchId: string,
  actor: string,
  model: string,
  ttlHours: number,
  claimImpl: ClaimExecFn,
): { ok: boolean; detail: string } {
  try {
    const stdout = claimImpl(getBashPath(), [getYokeClaimScriptPath(), 'claim', dispatchId, actor, model, String(ttlHours)], {
      encoding: 'utf8',
      windowsHide: true,
    });
    return { ok: true, detail: stdout.trim() };
  } catch (err) {
    const e = err as { stderr?: Buffer | string; message?: string };
    const detail = e.stderr ? String(e.stderr).trim() : (e.message ?? String(err));
    return { ok: false, detail };
  }
}

/** Resolves the EFFECTIVE dispatch id a spawned worker must use for every artifact it writes
 *  (return, canoe, beat, worker log). Tries the bare id first; if it is already claimed by a
 *  live actor, tries "<id>-W1", then "-W2", ... deterministically (never randomly) until a claim
 *  is won or the attempt cap is reached. `claimed: false` on return means every attempt,
 *  including the bare id, was refused -- the caller still gets an effectiveId (the last
 *  candidate tried) to log honestly, but no claim file was actually written for it. */
export function claimEffectiveDispatchId(
  baseId: string,
  actor: string,
  model: string,
  ttlHours: number,
  claimImpl: ClaimExecFn,
): { effectiveId: string; claimed: boolean; detail: string } {
  let candidate = baseId;
  for (let n = 0; n <= MAX_CHILD_SUFFIX_ATTEMPTS; n++) {
    candidate = n === 0 ? baseId : `${baseId}-W${n}`;
    const result = tryClaim(candidate, actor, model, ttlHours, claimImpl);
    if (result.ok) {
      return { effectiveId: candidate, claimed: true, detail: result.detail };
    }
    if (n === MAX_CHILD_SUFFIX_ATTEMPTS) {
      return { effectiveId: candidate, claimed: false, detail: result.detail };
    }
  }
  // Unreachable (the loop above always returns), kept only so TypeScript sees every path return.
  return { effectiveId: candidate, claimed: false, detail: 'claim resolution fell through unexpectedly' };
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

// ─── D-BP157-033: consent-gated elevated permission mode ───────────────────────────────────
//
// `claude --help` (run this session, no agent spawned) confirms the installed CLI's
// `--permission-mode` accepts exactly: "acceptEdits", "bypassPermissions", "default", "plan".
// Only "bypassPermissions" removes every tool-approval prompt -- "acceptEdits" still leaves
// non-Edit tools (Bash, in particular, which a worker needs for "run this command" / "git push"
// style dispatches) gated on an approval that a detached, non-interactive process can never
// answer, so it would not close the measured gap. "plan" is strictly read-only and cannot write
// at all. DEFAULT_ELEVATED_PERMISSION_MODE is therefore "bypassPermissions" -- the one mode that
// actually lets an unattended worker do the work a dispatch asks for.
const DEFAULT_ELEVATED_PERMISSION_MODE = 'bypassPermissions';

export function getElevatedSpawnPermissionMode(): string {
  const envVal = process.env.LB_MESH_SPAWN_ELEVATED_PERMISSION_MODE;
  return envVal && envVal.trim().length > 0 ? envVal : DEFAULT_ELEVATED_PERMISSION_MODE;
}

// ─── D-BP157-041, ITEM 2: a dedicated CLAUDE_CONFIG_DIR for elevated-mode workers ───────────
//
// THE MEASURED CAUSE (Bishop M0, by hand, no mesh involved -- see the header doc block above and
// SEG_RETURN_BP157_038/040): a bare `claude -p ...` run under this account's real
// CLAUDE_CONFIG_DIR (default ~/.claude, ~15 hooks across SessionStart/UserPromptSubmit/
// SessionEnd) reports zero API time and zero tokens across 11 turns, still claiming success. The
// same command with CLAUDE_CONFIG_DIR pointed at an empty directory (no settings.json => no
// hooks at all) returns a real response in seconds. A worker spawned under the elevated
// (bypassPermissions) permission mode -- the only mode that can actually perform the work a
// dispatch asks for -- must not inherit the account's hook set.
//
// getWorkerClaudeConfigDir() defaults to a directory under THIS estate's own ledger root, never
// under C:\Users\Administrator\.claude -- this dispatch is explicitly forbidden from editing
// anything under the account's real .claude directory, and pointing the default anywhere inside
// it would risk exactly that. The ledger root is a tree this codebase already owns and already
// writes per-worker artifacts under (YOKE/WORKER_LOGS sits right next to YOKE/WORKER_CLAUDE_CONFIG).
const DEFAULT_WORKER_CLAUDE_CONFIG_DIR_NAME = 'WORKER_CLAUDE_CONFIG';

export function getWorkerClaudeConfigDir(): string {
  const envVal = process.env.LB_MESH_WORKER_CLAUDE_CONFIG_DIR;
  if (envVal && envVal.trim().length > 0) return envVal;
  return join(resolveLedgerRoot(), 'YOKE', DEFAULT_WORKER_CLAUDE_CONFIG_DIR_NAME);
}

/**
 * "Provisioned" means a human has deliberately populated this directory -- deliberately NOT a
 * check for any specific credential filename. Two reasons, both load-bearing, both MEASURED this
 * dispatch (D-BP157-041):
 *
 *   1. This machine's OWN account ~/.claude has no `.credentials.json` or any other file at its
 *      top level that looks like an auth token (verified via a names-only `Get-ChildItem -Force`
 *      listing -- nothing was read, nothing was printed). Whatever this account's own working
 *      auth mechanism actually is, it is not a plain file at the conventional CLAUDE_CONFIG_DIR
 *      path on this machine -- so hard-coding that filename as "the" provisioning check would be
 *      testing for something this very machine's own real, working config does not have.
 *   2. Even if the exact filename were known, this dispatch is explicitly FORBIDDEN from reading,
 *      copying, or printing credential material -- so it could never distinguish a real token
 *      file from an empty placeholder by content, only by presence.
 *
 * A non-empty directory is therefore the honest, safe, CONTENT-BLIND signal used here: it proves
 * a human did something deliberate (most plausibly, ran `claude /login` once with
 * CLAUDE_CONFIG_DIR pointed at this exact directory -- the CLI's own standard way to seed a fresh
 * config dir), without this code ever inspecting what got written. What exactly the CLI writes
 * there, and whether it is sufficient on its own (independent of whatever non-file mechanism this
 * account's interactive sessions actually use) is UNVERIFIED -- explicitly flagged, not silently
 * assumed, in this dispatch's return doc. Until an operator provisions it and confirms a worker
 * authenticates, this directory stays empty and every elevated-mode launch refuses loudly rather
 * than silently falling back to the account's own CLAUDE_CONFIG_DIR.
 */
export function isWorkerClaudeConfigDirProvisioned(
  dir: string,
  existsFn: (p: string) => boolean = existsSync,
  readDirFn: (p: string) => string[] = readdirSync,
): boolean {
  if (!existsFn(dir)) return false;
  try {
    return readDirFn(dir).length > 0;
  } catch {
    return false;
  }
}

/** Pure decision function -- the exact truth table FD-BP157-05 requires. BOTH `autoSpawnEnabled`
 *  (the existing LB_MESH_AUTO_SPAWN_ENABLED kill switch, guardrail (c), already checked and
 *  required to be true before handleBishopDispatch() ever calls launchWorker(), which is the only
 *  production caller of this function) AND `consentGranted` (mesh_auto_spawn_consent.ts's NEW,
 *  separate toggle) must be true before the elevated permission mode is used. Neither alone is
 *  sufficient:
 *    - kill switch ON, consent OFF  -> restrictive mode (today's unchanged default behavior; an
 *      operator who has not yet granted the new consent sees no behavior change from before this
 *      dispatch -- the worker still spawns, but cannot use tools without a human present).
 *    - kill switch OFF, consent ON  -> never reaches this function at all (handleBishopDispatch's
 *      guardrail (c) refuses to spawn before launchWorker is called) -- included in the table
 *      here only so a reader auditing this function in isolation sees the full four-cell truth
 *      table, not just the two cells production code can actually reach.
 *    - kill switch ON,  consent ON  -> elevated mode.
 *    - kill switch OFF, consent OFF -> never reaches this function; no spawn at all.
 *  Exported and kept pure (no I/O) so bishop_dispatch_handler.test.ts can exercise all four cells
 *  directly, independent of the full spawn/claim/log machinery -- matches this file's own
 *  established idiom (isOriginAllowed, isWorkingDirAllowed, isAutoSpawnEnabled are all pure too). */
export function resolveEffectivePermissionMode(
  autoSpawnEnabled: boolean,
  consentGranted: boolean,
): { mode: string; elevated: boolean } {
  const elevated = autoSpawnEnabled === true && consentGranted === true;
  return { mode: elevated ? getElevatedSpawnPermissionMode() : getSpawnPermissionMode(), elevated };
}

/** Injectable so tests never actually spawn the CLI worker process (see
 *  bishop_dispatch_handler.test.ts) -- the default is the real node:child_process.spawn. This is
 *  the ONLY function in this file that creates the CLI worker's process; every guardrail above it
 *  is a pure decision function. (D-BP157-010: ClaimExecFn/claimImpl above is the analogous
 *  injection point for the separate yoke_claim.sh subprocess tryClaim() shells out to.) */
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
  /** D-BP157-023: which WorkIssue code the caller should file when spawned is false -- lets
   *  handleBishopDispatch's final return distinguish a HARDWIRE-25 claim refusal from a real
   *  process-launch failure without re-deriving that distinction from the error string. */
  errorCode?: string;
  /** D-BP157-023: the HARDWIRE-25 effective (possibly "-W<n>"-suffixed) id this launch attempt
   *  actually used -- carried up into BishopDispatchResult.effectiveId so a later completion
   *  reply can be matched to the right worker log by anyone reading the stage-1 reply alone. */
  effectiveId?: string;
  /** D-BP157-033: which permission mode this launch attempt actually used
   *  (resolveEffectivePermissionMode()'s result), and whether the mesh auto-spawn consent toggle
   *  was granted at decision time. Undefined only on the HARDWIRE-25 claim-refusal path
   *  (SPAWN_REFUSED_UNCLAIMED), which returns before a permission mode is ever decided --
   *  handleBishopDispatch() uses that undefined-ness to know whether to append the
   *  permission-mode WorkIssue at all. */
  permissionMode?: string;
  consentGranted?: boolean;
}

// ─── D-BP157-023, THE RETURN LEG (SEG_RETURN_BP157_015 Part 2) ─────────────────────────────────
//
// The core problem: bishop_dispatch_relay_listener.ts's poll tick resolves `handleEnvelope()`
// after launchWorker's one-setImmediate-tick grace window -- milliseconds, never the worker's
// real lifetime (up to LB_MESH_SPAWN_TIMEOUT_MS, default 30 minutes). The reply that tick posts
// (writeBishopDispatchReply, stage:'launch') can therefore only ever prove lifecycle 'begun' or
// 'failed', never 'completed'. This section is the SECOND, LATER write into the SAME already-
// proven relay_route_replies bus, triggered by an event handler that already exists:
// launchWorker's own `child.once('exit', ...)` below fires whenever the worker actually exits,
// however long that takes, because it is a callback on the long-running MnemosyneC.exe process
// that did the spawn -- NO NEW DAEMON is required on the receiving machine, this is one more
// branch inside an event handler already registered every time a worker is launched.
//
// The worker is a one-shot `claude -p` process that knows nothing about the relay or about
// route ids -- the only channel this file has into telling it "say when you're done" is the same
// prompt-injection paragraph HARDWIRE-25 already uses for the child-actor notice (see
// promptTextForChild below). COMPLETION_SENTINEL is that instruction's target string; a worker
// that never prints it, even on a clean exit 0, reproduces the exact D-BP156-M3-011/
// D-BP157-M3-002 shape this dispatch was built to stop being invisible: "code=0 is not evidence
// of work" (M3's own words, SEG_RETURN_BP157_018 Part 6).

export const COMPLETION_SENTINEL = 'BISHOP-DISPATCH-WORK-COMPLETE';

// D-BP157-033 verified this sentinel path stays intact under the new consent-gated elevated
// permission mode: promptTextForChild (which carries completionInstruction, below) is still built
// once and passed unchanged as the single `-p` argv element regardless of which permission mode is
// chosen -- resolveEffectivePermissionMode() only changes the VALUE of the separate
// `--permission-mode` argv element two positions later (see launchWorker's `args` array). Delivery
// mechanism, log-capture (stdioOption -> the real fd opened for workerLogPath), and sentinel
// detection (deriveCompletionOutcome below, reading that same log) are untouched.

// ─── D-BP157-041, ITEM 1: parse the worker's `--output-format json` captured log ────────────

/** Fields this file cares about, pulled out of the CLI's single-JSON-object `-p ... --output-
 *  format json` result. `subtype`/`isError` are carried through for the record only -- per this
 *  dispatch's own instruction, they are NEVER used to decide `lifecycle` (see
 *  deriveCompletionOutcome below, which keeps deciding lifecycle from signal/exit-code/sentinel
 *  alone); a run with zero API time and zero tokens is a failure regardless of what the CLI
 *  itself reports here. */
export interface WorkerJsonSummary {
  numTurns: number;
  durationApiMs: number;
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
  resultLength: number;
  subtype: string | null;
  isError: boolean | null;
}

/** Tolerant by construction: malformed JSON, an empty/null log, or a wrong-shaped object all
 *  return `null` rather than throwing -- a worker that (for whatever reason, e.g. an older
 *  `--output-format text` override via LB_MESH_SPAWN env knobs, or a log truncated by a crash)
 *  did not emit valid JSON must degrade to "no telemetry available," never crash
 *  deriveCompletionOutcome. Every field defaults to a zero/null value when absent or
 *  wrong-typed, rather than throwing on a missing key -- the CLI's own JSON shape is not this
 *  file's contract to enforce. */
export function parseWorkerJsonOutput(logContent: string | null): WorkerJsonSummary | null {
  if (!logContent) return null;
  const trimmed = logContent.trim();
  if (!trimmed) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null;
  const o = obj as Record<string, unknown>;
  const usage = (typeof o.usage === 'object' && o.usage !== null) ? (o.usage as Record<string, unknown>) : {};
  return {
    numTurns: typeof o.num_turns === 'number' ? o.num_turns : 0,
    durationApiMs: typeof o.duration_api_ms === 'number' ? o.duration_api_ms : 0,
    inputTokens: typeof usage.input_tokens === 'number' ? usage.input_tokens : 0,
    outputTokens: typeof usage.output_tokens === 'number' ? usage.output_tokens : 0,
    totalCostUsd: typeof o.total_cost_usd === 'number' ? o.total_cost_usd : 0,
    resultLength: typeof o.result === 'string' ? o.result.length : 0,
    subtype: typeof o.subtype === 'string' ? o.subtype : null,
    isError: typeof o.is_error === 'boolean' ? o.is_error : null,
  };
}

/** Pure decision function -- the easiest thing to get exhaustively right, independently
 *  testable without any process/file I/O (matches this file's own established idiom:
 *  isOriginAllowed, isWorkingDirAllowed, isAutoSpawnEnabled are all pure too). Exported so
 *  bishop_dispatch_handler.test.ts can exercise every branch directly against sample log
 *  content, without needing a real child process or a real exit event.
 *
 *  Evidence table (SEG_RETURN_BP157_015 Part 1): a non-null `signal` means the OS killed the
 *  process (the SPAWN_TIMEOUT_KILLED path, or an external kill) -- 'failed', never 'completed',
 *  regardless of what the log contains. A non-zero exit code is the same: 'failed'. Only a clean
 *  exit (code 0, no signal) with the sentinel actually present in the captured log counts as
 *  'completed' -- a clean exit WITHOUT the sentinel is 'failed' with a NO_COMPLETION_SENTINEL
 *  issue, which is deliberately the same shape D-BP156-M3-011/D-BP157-M3-002 already measured. */
export function deriveCompletionOutcome(
  effectiveId: string,
  logContent: string | null,
  code: number | null,
  signal: NodeJS.Signals | null,
): { lifecycle: WorkLifecycle; issues: WorkIssue[] } {
  let lifecycle: WorkLifecycle;
  const issues: WorkIssue[] = [];

  // ─── lifecycle, decided EXACTLY as before D-BP157-041 -- signal/exit-code/sentinel only.
  // The CLI's own `subtype`/`is_error` verdict (parsed below) is NEVER consulted here, per this
  // dispatch's own instruction: a run with zero API time and zero tokens is a failure regardless
  // of what the CLI calls it, but a worker that truly did work must still be provable by the
  // sentinel alone, unchanged.
  if (signal) {
    lifecycle = 'failed';
    issues.push(makeIssue(
      'SPAWN_KILLED_BY_SIGNAL',
      `worker process was killed by signal ${signal} before it could report completion`,
      `effectiveId=${effectiveId} signal=${signal}`,
      'launchWorker exit handler',
    ));
  } else if (code !== 0) {
    lifecycle = 'failed';
    issues.push(makeIssue(
      'SPAWN_NONZERO_EXIT',
      `worker process exited with non-zero code ${code ?? 'null'}`,
      `effectiveId=${effectiveId} code=${code ?? 'null'}`,
      'launchWorker exit handler',
    ));
  } else if (logContent && logContent.includes(COMPLETION_SENTINEL)) {
    lifecycle = 'completed';
  } else {
    lifecycle = 'failed';
    issues.push(makeIssue(
      'NO_COMPLETION_SENTINEL',
      'worker exited code 0 but the completion sentinel was never found in its captured log -- ' +
        'the measured D-BP156-M3-011/D-BP157-M3-002 shape: a clean exit that produced zero ' +
        'durable evidence of work. code=0 is not evidence of work.',
      `effectiveId=${effectiveId} code=0 logBytes=${logContent?.length ?? 0}`,
      'launchWorker exit handler',
    ));
  }

  // ─── D-BP157-041, ITEM 1: fold the parsed `--output-format json` telemetry in, regardless of
  // which lifecycle branch above fired. Always-legible record (WORKER_JSON_TELEMETRY) plus a
  // distinct, loud diagnosis (WORKER_NO_MODEL_CALL) for the exact measured signature: turns ran,
  // no API time, no tokens -- "the check that would have saved two sessions."
  const parsed = parseWorkerJsonOutput(logContent);
  if (parsed) {
    issues.push(makeIssue(
      'WORKER_JSON_TELEMETRY',
      `worker's --output-format json result: num_turns=${parsed.numTurns} ` +
        `duration_api_ms=${parsed.durationApiMs} input_tokens=${parsed.inputTokens} ` +
        `output_tokens=${parsed.outputTokens} total_cost_usd=${parsed.totalCostUsd} ` +
        `result_length=${parsed.resultLength} cli_subtype=${parsed.subtype ?? 'unknown'} ` +
        `cli_is_error=${parsed.isError ?? 'unknown'} -- cli_subtype/cli_is_error are recorded ` +
        `ONLY, never used to decide lifecycle above`,
      `effectiveId=${effectiveId}`,
      'deriveCompletionOutcome JSON parse',
    ));

    const totalTokens = parsed.inputTokens + parsed.outputTokens;
    if (parsed.durationApiMs === 0 && totalTokens === 0 && parsed.numTurns > 0) {
      issues.push(makeIssue(
        'WORKER_NO_MODEL_CALL',
        `worker consumed ${parsed.numTurns} turn(s) (duration_api_ms=0, zero input/output ` +
          `tokens) -- the turns were consumed BEFORE any model call happened, not because the ` +
          `work was trivial. MEASURED cause (SEG_RETURN_BP157_038/040, reproduced by hand with ` +
          `no mesh involved): the account's SessionStart/UserPromptSubmit hooks absorb the turn ` +
          `before the model is ever reached. The CLI itself reported subtype="${parsed.subtype ?? 'unknown'}" ` +
          `is_error=${parsed.isError ?? 'unknown'} for this same run -- do not trust that verdict.`,
        `effectiveId=${effectiveId} num_turns=${parsed.numTurns} duration_api_ms=${parsed.durationApiMs} ` +
          `total_tokens=${totalTokens}`,
        'deriveCompletionOutcome JSON parse',
      ));
    }
  }

  return { lifecycle, issues };
}

/** Everything the stage-2/completion write needs, already derived. Mirrors
 *  bishop_dispatch_reply.ts's own BishopDispatchCompletionInput shape exactly (re-exported type,
 *  not redefined) -- effectiveId/workerLogPointer/tailExcerpt are added by the exit handler
 *  below, lifecycle/issues come straight from deriveCompletionOutcome. */
export type CompletionReplyFn = (
  routeId: string,
  completion: BishopDispatchCompletionInput,
  processingMs: number,
) => Promise<boolean>;

/** Production default: resolves this machine's own stable peer id (getStablePeerId(), the SAME
 *  resolution bishop_dispatch_relay_listener.ts's own config.peerId already uses) and the same
 *  anon-key config writeBishopDispatchReply's own getDefaultReplyWriteConfig() already resolves
 *  -- no new credential path. Deliberately NEVER called by bishop_dispatch_handler.test.ts (every
 *  test that reaches the exit-handler completion branch injects its own completionReplyImpl mock,
 *  mirroring spawnImpl/claimImpl's existing injection discipline) so this file's stated "no real
 *  process is ever spawned, no real network" OFFLINE guarantee extends to this seam too --
 *  getStablePeerId()'s own fallback path shells out to a real `powershell` command, which must
 *  never run inside this suite. */
const defaultCompletionReplyImpl: CompletionReplyFn = (routeId, completion, processingMs) =>
  writeBishopDispatchCompletionReply(getDefaultReplyWriteConfig(), routeId, getStablePeerId(), completion, processingMs);

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
 *
 * D-BP157-007: two further changes, both scoped to this function.
 *   Work item 3 (HARDWIRE-25): before building argv, claims payload.dispatchId via
 *   claimEffectiveDispatchId(). If the bare id is already held by a live actor (the resident-
 *   session collision HARDWIRE-25 exists to close), the worker becomes a child under a
 *   deterministic "-W<n>" suffix, and promptText gets one appended paragraph telling the worker
 *   its effective id -- the only channel this function has into a one-shot `-p` worker's own
 *   behavior, since promptText's content is not otherwise under this file's control.
 *   Work item 1: stdio is no longer 'ignore'. A per-dispatch log file, named by the EFFECTIVE
 *   (possibly suffixed) id, captures the worker's stdout+stderr via a real fd (fs.openSync),
 *   never a pipe -- so there is no "unread pipe fills and blocks the child" hazard to guard
 *   against. If the log file cannot be opened, that failure is logged to the beat file
 *   (SPAWN_ATTEMPT, detail names the error) and stdio falls back to 'ignore' -- loud, not silent.
 *
 * D-BP157-010: `claimImpl` is now a required parameter here (threaded from handleBishopDispatch's
 * defaulted `claimImpl: ClaimExecFn = execFileSync`), mirroring how `spawnImpl` is threaded --
 * closes the gap D-BP157-007 flagged in its own return (tryClaim() called execFileSync
 * unconditionally, silently breaking this test file's stated "no real process is ever spawned"
 * guarantee for every test that reaches this function). Production default is unchanged: the real
 * execFileSync, called the same way, with the same arguments, as before this dispatch.
 */
async function launchWorker(
  payload: BishopDispatchPayload,
  spawnImpl: SpawnFn,
  claimImpl: ClaimExecFn,
  routeId: string | undefined,
  completionReplyImpl: CompletionReplyFn,
): Promise<LaunchOutcome> {
  const cliPath = getSpawnCliPath();
  const model = getSpawnModel();

  // D-BP157-033: consent-gated permission mode. `true` for autoSpawnEnabled below is not a
  // shortcut -- launchWorker() is only ever reached (production or test) after
  // handleBishopDispatch's guardrail (c) kill-switch check has already passed, so within this
  // function the kill switch is always known-true; resolveEffectivePermissionMode() itself stays
  // a general pure function testable at all four truth-table cells independent of that call site.
  //
  // D-BP157-041: moved ABOVE the HARDWIRE-25 claim (it used to sit just before building argv,
  // well after the claim) so the new CLAUDE_CONFIG_DIR provisioning check below can refuse
  // cheaply, before a HARDWIRE-25 claim is spent on a worker that is not going to run.
  const consentGranted = isMeshAutoSpawnConsentGranted();
  const { mode: effectivePermissionMode, elevated } = resolveEffectivePermissionMode(true, consentGranted);

  // ─── D-BP157-041, ITEM 2: dedicated CLAUDE_CONFIG_DIR, elevated mode only ────────────────
  // Only reached at all when BOTH the kill switch and mesh auto-spawn consent are satisfied
  // (elevated === true) -- exactly the same two-gate coupling resolveEffectivePermissionMode
  // already enforces for the permission mode itself. Under the restrictive (non-elevated) mode,
  // behavior is byte-for-byte unchanged from before this dispatch: no CLAUDE_CONFIG_DIR override
  // is even considered.
  let workerClaudeConfigDir: string | undefined;
  if (elevated) {
    const candidateDir = getWorkerClaudeConfigDir();
    if (!isWorkerClaudeConfigDirProvisioned(candidateDir)) {
      const refusalDetail =
        `candidateDir=${candidateDir} elevated=true consentGranted=${consentGranted} ` +
        `permissionMode=${effectivePermissionMode}`;
      logSpawnEvent({
        dispatchId: payload.dispatchId,
        originPeerId: payload.originPeerId,
        decision: 'SPAWN_REFUSED_CONFIG_DIR_UNPROVISIONED',
        detail: refusalDetail,
      });
      return {
        spawned: false,
        errorCode: 'WORKER_CLAUDE_CONFIG_DIR_NOT_PROVISIONED',
        error:
          `mesh auto-spawn consent is granted and the elevated permission mode would be used, but ` +
          `the dedicated worker CLAUDE_CONFIG_DIR "${candidateDir}" is not provisioned (does not ` +
          `exist, or exists but is empty). Refusing to spawn under the account's own ` +
          `CLAUDE_CONFIG_DIR instead -- that would silently restore the measured "hooks consume ` +
          `every turn before any model call happens" bug (SEG_RETURN_BP157_038/040). An operator ` +
          `must provision this directory (e.g. run "CLAUDE_CONFIG_DIR=<dir> claude /login" by ` +
          `hand once) before an elevated-mode worker can be spawned.`,
        permissionMode: effectivePermissionMode,
        consentGranted,
      };
    }
    workerClaudeConfigDir = candidateDir;
  }

  // ─── HARDWIRE-25: claim the id before anything gets written under it ─────────────────────
  const claimTtlHours = getClaimTtlHours();
  const claimResult = claimEffectiveDispatchId(payload.dispatchId, getClaimActor(), model, claimTtlHours, claimImpl);
  const effectiveId = claimResult.effectiveId;

  // D-BP157-012: FAIL CLOSED. claimEffectiveDispatchId() walks the bare id, then up to
  // MAX_CHILD_SUFFIX_ATTEMPTS deterministic "-W<n>" suffixes (see its own doc comment above), and
  // reports claimed:false only when EVERY one of those attempts -- MAX_CHILD_SUFFIX_ATTEMPTS + 1
  // total, bare id included -- was refused. D-BP157-010 found and DOCUMENTED (correctly left
  // unfixed, out of its own scope) that launchWorker() proceeded to spawn anyway under that last,
  // still-unclaimed candidate id -- the guard failed OPEN under exactly the contention HARDWIRE-25
  // exists to close. Refuse here, before anything is built for a worker that would write under an
  // id nothing actually holds a claim on: no argv, no worker-log open, no spawnImpl call, no entry
  // in _activeSpawns. The refusal is logged as a distinct beat-file decision (SPAWN_REFUSED_
  // UNCLAIMED, never folded into SPAWN_FAILED/SPAWN_ERROR) so an operator can tell "refused
  // because the dispatch id could not be claimed" apart from "ran and did nothing" and from "never
  // arrived."
  if (!claimResult.claimed) {
    const attemptsTried = MAX_CHILD_SUFFIX_ATTEMPTS + 1; // bare id + up to MAX_CHILD_SUFFIX_ATTEMPTS suffixes
    const refusalDetail =
      `dispatchId=${payload.dispatchId} attemptsTried=${attemptsTried} cap=${MAX_CHILD_SUFFIX_ATTEMPTS} ` +
      `lastCandidate=${effectiveId} lastClaimDetail=${claimResult.detail}`;
    logSpawnEvent({
      dispatchId: payload.dispatchId,
      originPeerId: payload.originPeerId,
      decision: 'SPAWN_REFUSED_UNCLAIMED',
      detail: refusalDetail,
    });
    return {
      spawned: false,
      errorCode: 'SPAWN_REFUSED_UNCLAIMED',
      effectiveId,
      error:
        `HARDWIRE-25 claim refused: could not claim dispatch id "${payload.dispatchId}" after ` +
        `${attemptsTried} attempts (bare id plus up to ${MAX_CHILD_SUFFIX_ATTEMPTS} deterministic ` +
        `child suffixes); last candidate tried was "${effectiveId}" (${claimResult.detail}). ` +
        `Refusing to spawn under an unclaimed id.`,
    };
  }

  const childActorNotice = effectiveId === payload.dispatchId
    ? ''
    : `\n\n[HARDWIRE-25 CHILD ACTOR NOTICE] The dispatch id "${payload.dispatchId}" ` +
      `is already claimed by a live actor (${claimResult.detail}). Per HARDWIRE-25, you are a CHILD ` +
      `of that dispatch. Your effective dispatch id for every artifact you write -- return, canoe, ` +
      `beat, and worker log -- is "${effectiveId}". Do not write to the bare id's path; write to the ` +
      `"${effectiveId}" path instead.`;

  // D-BP157-023, THE RETURN LEG: unconditionally appended (previously only appended for the
  // HARDWIRE-25 child-notice branch above) -- every spawned worker, bare id or child, is told to
  // print the sentinel when done, since every spawned worker's completion needs to be
  // distinguishable from a clean exit that did nothing (see deriveCompletionOutcome above).
  const completionInstruction =
    `\n\n[BISHOP DISPATCH COMPLETION SENTINEL] When you have finished all requested work, print ` +
    `the exact line "${COMPLETION_SENTINEL}" (with no other text on that line) as the very last ` +
    `line of your output, so the dispatching machine can distinguish your work actually ` +
    `finishing from your process merely exiting having done nothing.`;

  const promptTextForChild = payload.promptText + childActorNotice + completionInstruction;

  // D-BP157-041, ITEM 1: 'json', not 'text' -- see parseWorkerJsonOutput/deriveCompletionOutcome
  // above and this file's header doc block, item (j).
  const args = [
    '-p', promptTextForChild,
    '--output-format', 'json',
    '--model', model,
    '--permission-mode', effectivePermissionMode,
  ];

  // ─── Work item 1: open a real log file for the worker's stdout+stderr ────────────────────
  const workerLogPath = getWorkerLogPath(effectiveId);
  let logFd: number | null = null;
  let logOpenError: string | null = null;
  try {
    mkdirSync(getWorkerLogDir(), { recursive: true });
    logFd = openSync(workerLogPath, 'a');
  } catch (err) {
    logOpenError = err instanceof Error ? err.message : String(err);
  }
  const stdioOption: StdioOptions = logFd !== null ? ['ignore', logFd, logFd] : ['ignore', 'ignore', 'ignore'];

  logSpawnEvent({
    dispatchId: payload.dispatchId,
    originPeerId: payload.originPeerId,
    decision: 'SPAWN_ATTEMPT',
    detail: `effectiveId=${effectiveId} claimed=${claimResult.claimed} claimDetail=${claimResult.detail} ` +
      `permissionMode=${effectivePermissionMode} consentGranted=${consentGranted} ` +
      `claudeConfigDir=${workerClaudeConfigDir ?? '(unset, account default)'} ` +
      `workerLog=${logOpenError ? `OPEN_FAILED(${logOpenError}), falling back to stdio:ignore` : workerLogPath}`,
  });

  _activeSpawns.add(payload.dispatchId);
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    _activeSpawns.delete(payload.dispatchId);
  };

  let child: ReturnType<SpawnFn>;
  const spawnStartMs = Date.now(); // D-BP157-023: base for the eventual completion reply's processingMs
  try {
    child = spawnImpl(cliPath, args, {
      cwd: payload.workingDir,
      shell: false,
      windowsHide: true,
      stdio: stdioOption,
      // D-BP157-041, ITEM 2: only present when `elevated` gated it on above -- omitting the
      // `env` key entirely (rather than passing `env: process.env` unconditionally) preserves
      // this file's pre-existing behavior byte-for-byte on every non-elevated launch, since Node
      // already inherits process.env by default when `env` is omitted from spawn options.
      ...(workerClaudeConfigDir
        ? { env: { ...process.env, CLAUDE_CONFIG_DIR: workerClaudeConfigDir } }
        : {}),
    });
  } catch (err) {
    finish();
    if (logFd !== null) { try { closeSync(logFd); } catch { /* best-effort */ } }
    const detail = err instanceof Error ? err.message : String(err);
    logSpawnEvent({
      dispatchId: payload.dispatchId,
      originPeerId: payload.originPeerId,
      decision: 'SPAWN_FAILED',
      detail: `effectiveId=${effectiveId} workerLog=${workerLogPath} ${detail}`,
    });
    return { spawned: false, errorCode: 'SPAWN_FAILED', effectiveId, error: detail, permissionMode: effectivePermissionMode, consentGranted };
  }

  // The child process duplicates logFd for its own use once spawned; close the parent's copy so
  // a long-running MnemosyneC process does not leak a file descriptor per worker spawned.
  if (logFd !== null) { try { closeSync(logFd); } catch { /* best-effort */ } }

  const timeoutMs = getSpawnTimeoutMs();
  const timer = setTimeout(() => {
    try { child.kill('SIGTERM'); } catch { /* best-effort */ }
    logSpawnEvent({
      dispatchId: payload.dispatchId,
      originPeerId: payload.originPeerId,
      decision: 'SPAWN_TIMEOUT_KILLED',
      detail: `effectiveId=${effectiveId} workerLog=${workerLogPath} exceeded ${timeoutMs}ms`,
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
        detail: `effectiveId=${effectiveId} workerLog=${workerLogPath} code=${code ?? 'null'} signal=${signal ?? 'null'}`,
      });
      // Exiting (even non-zero -- e.g. a downstream auth failure) still means the OS DID create
      // the process. That is the only claim `spawned` makes; whatever the worker did with its
      // life is a separate question this field does not answer.
      settleOutcome({ spawned: true, effectiveId, permissionMode: effectivePermissionMode, consentGranted });

      // ─── D-BP157-023, THE RETURN LEG ────────────────────────────────────────────────────────
      // This 'exit' listener already fires whenever the worker actually exits, however long that
      // took (up to LB_MESH_SPAWN_TIMEOUT_MS) -- no new daemon, one more branch inside an event
      // handler already registered above. Fire-and-forget: never awaited by, and never delays,
      // settleOutcome above -- stage-1 (this function's own return) must stay fast, matching
      // SPAWN_IMMEDIATE_OUTCOME_GRACE's own bounded-window contract.
      void (async () => {
        let logContent: string | null = null;
        try {
          logContent = readFileSync(workerLogPath, 'utf8');
        } catch {
          // Nothing captured -- e.g. the earlier log-open fallback to stdio:'ignore', or the
          // worker wrote nothing before exiting. deriveCompletionOutcome treats null the same as
          // "no sentinel found."
        }
        const { lifecycle: completionLifecycle, issues: completionIssues } =
          deriveCompletionOutcome(effectiveId, logContent, code, signal);
        if (!routeId) return; // no carrier to post a completion reply through (e.g. a future LAN carrier, or a direct/offline call)
        const completion: BishopDispatchCompletionInput = {
          effectiveId,
          lifecycle: completionLifecycle,
          issues: completionIssues,
          workerLogPointer: `${effectiveId}.log`,
          tailExcerpt: logContent ? logContent.slice(-4000) : '',
        };
        try {
          await completionReplyImpl(routeId, completion, Date.now() - spawnStartMs);
        } catch (err) {
          console.warn('[bishop_dispatch_handler] completion reply write failed (non-fatal):', err);
        }
      })();
    });
    child.once('error', (err) => {
      clearTimeout(timer);
      finish();
      const detail = err instanceof Error ? err.message : String(err);
      logSpawnEvent({
        dispatchId: payload.dispatchId,
        originPeerId: payload.originPeerId,
        decision: 'SPAWN_ERROR',
        detail: `effectiveId=${effectiveId} workerLog=${workerLogPath} ${detail}`,
      });
      settleOutcome({ spawned: false, errorCode: 'SPAWN_ERROR', effectiveId, error: detail, permissionMode: effectivePermissionMode, consentGranted });
    });

    void SPAWN_IMMEDIATE_OUTCOME_GRACE().then(() =>
      settleOutcome({ spawned: true, effectiveId, permissionMode: effectivePermissionMode, consentGranted }));
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
 *
 * D-BP157-023: `routeId` (the relay_routes row id this dispatch arrived on, threaded all the way
 * down from bishop_dispatch_relay_listener.ts) is optional and carrier-supplied -- when absent
 * (a direct/offline call, or a future carrier that has no such id), the return leg's stage-2
 * completion write is simply never attempted; every other guardrail and behavior is identical.
 * `completionReplyImpl` defaults to the real network write and is only ever exercised via
 * launchWorker's exit handler, long after this function has already returned.
 */
export async function handleBishopDispatch(
  payload: BishopDispatchPayload,
  verifiedOriginPeerId: string | null,
  spawnImpl: SpawnFn = spawn,
  claimImpl: ClaimExecFn = execFileSync,
  routeId?: string,
  completionReplyImpl: CompletionReplyFn = defaultCompletionReplyImpl,
): Promise<BishopDispatchResult> {
  const { path: noticePath, alreadyExisted } = writeYokeNoticeFile(payload, verifiedOriginPeerId);

  const refuse = (reason: string): BishopDispatchResult => {
    logSpawnEvent({ dispatchId: payload.dispatchId, originPeerId: payload.originPeerId, decision: 'REFUSED', detail: reason });
    return { ok: true, lifecycle: 'refused', issues: [], spawned: false, reason, noticePath };
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
  const outcome = await launchWorker(payload, spawnImpl, claimImpl, routeId, completionReplyImpl);
  // D-BP157-023: this is STAGE 1 ONLY -- 'begun' means the OS created the process (or it already
  // ran to completion inside the short grace window), never 'completed'. Proving 'completed'
  // requires the worker's real exit, which launchWorker's own exit handler observes and posts as
  // a SEPARATE, LATER reply (see writeBishopDispatchCompletionReply) -- this function has already
  // returned by the time that happens for any real (non-instant) worker.
  const issues: WorkIssue[] = outcome.spawned
    ? []
    : [makeIssue(
        outcome.errorCode ?? 'SPAWN_ERROR',
        outcome.error ?? 'unknown error',
        `dispatchId=${payload.dispatchId} effectiveId=${outcome.effectiveId ?? payload.dispatchId}`,
        'launchWorker',
      )];

  // D-BP157-033: legible, always-distinct record of which permission mode this launch attempt
  // used and why -- an operator must be able to tell "consent not granted, ran restricted" apart
  // from "ran and did nothing" (NO_COMPLETION_SENTINEL, the return leg's own issue) and from
  // "never arrived" (no record at all). Present whenever launchWorker() got far enough to decide
  // a permission mode -- i.e. every outcome except the HARDWIRE-25 SPAWN_REFUSED_UNCLAIMED path,
  // which returns before that decision is ever made (outcome.permissionMode stays undefined
  // there, and only there).
  if (outcome.permissionMode !== undefined) {
    issues.push(makeIssue(
      outcome.consentGranted ? 'MESH_AUTO_SPAWN_CONSENT_GRANTED' : 'MESH_AUTO_SPAWN_CONSENT_NOT_GRANTED',
      outcome.consentGranted
        ? `mesh auto-spawn consent is granted (mesh_auto_spawn_consent.ts); worker launched with ` +
          `elevated permission mode "${outcome.permissionMode}"`
        : `mesh auto-spawn consent is NOT granted (mesh_auto_spawn_consent.ts, off by default); ` +
          `worker launched with restrictive permission mode "${outcome.permissionMode}" -- a ` +
          `non-interactive worker under this mode cannot use tools without a human present to ` +
          `approve them, and will typically exit having done nothing`,
      `dispatchId=${payload.dispatchId} effectiveId=${outcome.effectiveId ?? payload.dispatchId} ` +
        `permissionMode=${outcome.permissionMode} consentGranted=${outcome.consentGranted}`,
      'handleBishopDispatch permission-mode decision',
    ));
  }

  return {
    ok: true,
    lifecycle: outcome.spawned ? 'begun' : 'failed',
    issues,
    spawned: outcome.spawned,
    reason: outcome.spawned ? 'spawned' : `spawn failed: ${outcome.error ?? 'unknown error'}`,
    noticePath,
    effectiveId: outcome.effectiveId,
  };
}
