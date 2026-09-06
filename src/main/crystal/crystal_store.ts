// crystal_store.ts -- KN-BP147-M1 "THE CRYSTAL. THE MAPPING THAT STAYS TRUE."
//
// A durable, append-only store for chonk handles and their binding maps, replacing the
// in-process CAITHEDRAL_CRYSTAL for anything that must outlive a process. Phase-0 for this
// ticket found THREE independent in-memory-only implementations of the same content-
// addressed handle idea, all of which die at process end:
//   - caithedral-core/src/tools/soccerball_tools.ts  -- CAITHEDRAL_CRYSTAL = new Map()
//   - caithedral-core/src/tools/pearl_tools.ts       -- LOCAL_CRYSTAL     = new Map()
//   - librarian-mcp/src/codec/hex_warehouse.ts       -- MASS_CRYSTAL      = new Map()
// None of them, nor mnem_eblet_store.ts (a doctrine-text BM25 index), nor the pheromone
// substrate (a last-write-wins topic index keyed by scribe/tablet_id, not by content-
// addressed handle), nor .lb_substrate (whose own manifest.json schema carries an unpopulated
// `soccerball_hash: null` field) durably persists a chonk handle's binding map across a
// process restart. See the M1 return doc for the full Phase-0 evidence trail with line
// numbers. This module is the fix, scoped exactly to that gap.
//
// THE CHANGE-GATE RULES (HARDWIRE-05: state them explicitly, don't assume them):
//   1. Bindings are ADDITIVE BY DEFAULT. `bindChonk()` accepts a new key, accepts an
//      idempotent re-assertion of an unchanged key, and REJECTS an attempt to silently
//      change an existing key's value.
//   2. A binding may be mutated ONLY through `mutateChonkBinding()`, and only for one of
//      three named reasons: superseded_source | failed_resolution | explicit_ratification.
//      A mutation call requires a non-empty audit `note`; there is no silent-reason path.
//   3. Every mutation is versioned, never overwritten in place: the pre-mutation value is
//      written first to a `.superseded.<UTC-ts>` sibling file (HARDWIRE-00 Section 1.9),
//      THEN the new value is appended to the durable log.
//   4. The mint address is deterministic and derived from `pearls` ALONE (not bindings --
//      see the note on `deriveMintAddress` below for why that is a considered departure from
//      the three in-memory precedents, not a silent one).
//
// DATA LOCATION: resolved by `resolveCrystalDir()` below -- env override first, then Electron
// userData (or, outside Electron, the SAME location computed directly). All of it lives inside
// this ticket's OWNS block (this file writes only under its own resolved crystal dir; it never
// writes anywhere else in the tree).
//
// BP147, Bishop D-BP147-006 UPDATE-02: step 3 used to be a loud cwd-relative fallback
// (`resolve(process.cwd(), ".mnem_crystal_fallback")`, console.warn'd, then continued). That
// was the defect, not a safety net: it made the store's location depend on WHERE a process
// happened to be launched from. `librarian-mcp` is plain-node ESM with no Electron, so it could
// never satisfy the Electron branch and always landed there, while the Electron app landed in
// `%APPDATA%\amplify-computer\crystal\` -- two processes, two stores, BOTH reporting success,
// NEITHER seeing the other's binds. Cost: silent data loss with no error anywhere in the chain.
// The ruled replacement computes the Electron userData location directly (no Electron
// dependency required) so both sides agree BY DEFAULT, and hard-errors instead of guessing when
// it can't. See `resolveCrystalDir()` below for the full replacement and the Phase-0 evidence
// that the two computations are byte-identical on Windows.

// This directory carries its own package.json with "type": "commonjs" (see the file-header
// note above) so this module -- and the test/proof scripts that require() it -- can run
// directly via a plain `node` invocation with zero build step, which the far-end
// (kill-and-restart) proof depends on. Runtime values therefore come in via require();
// pure types come in via `import type`, which is fully erased and needs no runtime module
// resolution at all, so it is safe under CommonJS mode.
const { existsSync, mkdirSync, appendFileSync, readFileSync, writeFileSync } = require("fs");
const { resolve, join } = require("path");
const { createHash } = require("crypto");
// BP147, Bishop: the literal ".ts" extension was deliberate -- it let this module run
// unbuilt under a plain `node` invocation, which the original far-end proof depended on.
// It also made the module UNLOADABLE in the app that ships: the extension survives
// compilation, dist/ contains only crystal_types.js, and Electron 31.7.7 bundles Node
// 20.18.0, which predates native TS type-stripping entirely (22.6 experimental, 23.6
// default). Verified by direct repro: requiring the compiled crystal_store.js threw
// MODULE_NOT_FOUND. The proof ran on a path that cannot ship.
// FIRST ATTEMPT AT THIS FIX WAS WRONG AND IS RECORDED SO NOBODY REPEATS IT: dropping the
// extension to "./crystal_types" fixes the compiled path and BREAKS the unbuilt one. Node's
// extensionless CommonJS resolution tries .js/.json/.node -- never .ts, even on a TS-capable
// runtime. Verified by direct repro, not reasoned about. Trading one broken path for the
// other is not a fix.
// The shape that satisfies BOTH, locally, with no global module-resolution patch: try the
// compiled specifier, fall back to the unbuilt one. Each branch names the runtime it serves.
const crystalTypesRuntime = (() => {
  try {
    return require("./crystal_types"); // compiled: resolves crystal_types.js in dist/
  } catch {
    return require("./crystal_types.ts"); // unbuilt: TS-capable host runtime, no build step
  }
})();
const { isMutationReason } = crystalTypesRuntime;
import type {
  BindingTarget,
  CrystalBindings,
  MutationReason,
  CrystalLogRecord,
  BindResult,
  ResolvedChonk,
  CrystalMintMeta,
  CrystalPowerState,
  GuardedResolveResult,
  PowerStateResult,
} from "./crystal_types";

// ─── Storage location ──────────────────────────────────────────────────────

// The app.getPath('userData') app-name component, for the non-Electron fallback branch below
// ONLY (step 2). Inside Electron, the branch above this one asks app.getPath('userData')
// directly and needs no hardcoded name at all.
//
// CORRECTED D-BP158-006/BISHOP (supersedes the BP147 Phase 0 claim this comment used to make):
// this constant used to read "amplify-computer" on the theory that Electron derives userData
// from package.json's `name` field (mnemosyne/package.json:2 = "amplify-computer"), NOT
// electron-builder's `productName` ("MnemosyneC"), and that BP147 Phase 0 had verified
// %APPDATA%\amplify-computer exists while %APPDATA%\MnemosyneC does not. That reasoning about
// how Electron derives the default was correct, but the "MnemosyneC does not exist" half of the
// claim is now MEASURED FALSE: %APPDATA%\MnemosyneC exists today and is where the mesh peer
// identity keypair (identity/localPeerKeypair.ts) already lives. As of this ticket, the main
// process (src/main/index.ts, top of file) calls `app.setPath('userData', ...)` once at startup
// to repoint Electron's userData to %APPDATA%\MnemosyneC explicitly -- package.json's `name`
// field is deliberately left as "amplify-computer" (changing it would alter electron-builder's
// installer identity/update channel), but the running app's actual userData directory is now
// MnemosyneC. This fallback constant is updated to match so a non-Electron process reading this
// same store (librarian-mcp, the kill-and-restart proof scripts, tests) resolves the SAME
// directory the real running app now uses -- the exact two-stores-disagree failure mode this
// module's own header comment describes is what silently reappears if this constant is left as
// "amplify-computer" while the live app moves to "MnemosyneC".
const USERDATA_APP_NAME = "MnemosyneC";

function resolveCrystalDir(): string {
  const envOverride = process.env.MNEM_CRYSTAL_DIR;
  if (envOverride) return resolve(envOverride);

  const attempted: string[] = [];

  // 1. Genuinely inside Electron's main process: app.getPath('userData') IS the authority, on
  //    whatever platform Electron is running on, because it is asking Electron itself rather
  //    than re-deriving Electron's own convention.
  //    Lazy + guarded: this module has zero HARD Electron dependency so it can run standalone
  //    (tests, the kill-and-restart proof scripts, librarian-mcp, a future CLI) without an
  //    Electron runtime. Outside Electron, `require('electron')` resolves to a path STRING, not
  //    the app API -- the `typeof app.getPath === 'function'` guard is what actually detects
  //    that difference.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = require("electron") as { app?: { getPath: (name: string) => string } };
    const app = electron?.app;
    if (app && typeof app.getPath === "function") {
      return resolve(app.getPath("userData"), "crystal");
    }
    attempted.push(
      "Electron app.getPath('userData') -- 'electron' module resolved but exposes no " +
        "app.getPath (this process is not Electron's main process)"
    );
  } catch {
    attempted.push(
      "Electron app.getPath('userData') -- 'electron' is not resolvable in this process " +
        "(not running inside Electron, e.g. librarian-mcp / tests / proof scripts / a future CLI)"
    );
  }

  // 2. Not inside Electron: compute the SAME location app.getPath('userData') would produce,
  //    with zero Electron dependency and zero configuration, so both sides land in ONE store.
  //    This is the actual fix for D-BP147-006 UPDATE-02 -- see the file-header note above for
  //    the two-stores-both-silent defect this replaces.
  if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    if (appData) {
      return resolve(appData, USERDATA_APP_NAME, "crystal");
    }
    attempted.push("Windows computed path -- %APPDATA% is not set in this process's environment");
  } else {
    // Electron's userData convention is platform-specific (macOS: ~/Library/Application
    // Support/<name>; Linux: $XDG_CONFIG_HOME or ~/.config/<name>). This ticket's Phase-0
    // evidence was gathered on Windows only -- there is no macOS/Linux hardware available this
    // session to empirically confirm either convention against a live app's on-disk footprint
    // the way the Windows path was confirmed (folder existence check, not just reasoning from
    // Electron's docs). Shipping an unverified guess here is the EXACT failure mode this ruling
    // exists to remove ("a wrong path that silently 'works'"), so this throws instead.
    attempted.push(
      `No verified non-Electron userData computation for process.platform === "${process.platform}" ` +
        `-- Electron's convention differs by platform and was not empirically confirmed here`
    );
  }

  // 3. Nothing resolved. HARD ERROR -- never a silent cwd-relative fallback. That fallback was
  //    the defect this replaces: it made the store's location depend on where a process
  //    happened to be launched from, so two processes with different working directories got
  //    two different stores, both reporting success, neither seeing the other's binds.
  throw new Error(
    "[crystal_store] could not resolve a crystal storage directory. Tried, in order:\n" +
      attempted.map((a) => `  - ${a}`).join("\n") +
      "\n" +
      "Fix: set MNEM_CRYSTAL_DIR to an absolute directory path -- it is an override and wins " +
      "outright over everything above. " +
      `Expected default location on Windows: %APPDATA%\\${USERDATA_APP_NAME}\\crystal. ` +
      "This module does not fail open on its own -- callers already wrap getCrystalStore() in " +
      "try/catch and degrade to in-memory; that is where fail-open belongs, not here."
  );
}

const CRYSTAL_DIR = resolveCrystalDir();
const CRYSTAL_LOG_PATH = join(CRYSTAL_DIR, "crystal_log.jsonl");
const SUPERSEDED_DIR = join(CRYSTAL_DIR, "superseded");

function ensureDir(p: string): void {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

function utcTs(): string {
  return new Date().toISOString();
}

/** Filesystem-safe UTC timestamp for `.superseded.<ts>` filenames (':' is illegal on Windows). */
function utcTsForFilename(): string {
  return new Date().toISOString().replace(/:/g, "-");
}

// ─── The determinism primitive ─────────────────────────────────────────────

/**
 * deriveMintAddress -- pure, no I/O. The load-bearing property of this whole module:
 * identical `pearls` MUST re-derive the identical 32-hex-char address, every time, on any
 * machine, forever.
 *
 * SORTED BUT NOT DE-DUPLICATED (BP147, Bishop-ratified, verified against the real function --
 * do not "fix" this, it is canonical): the input array is order-independent (`[...pearls].sort()`
 * normalizes order before hashing) but duplicate entries are NOT collapsed, so they change the
 * sorted array's JSON shape and therefore change the address. Measured:
 *   deriveMintAddress(["pearl_a","pearl_b"])           -> 40b965c866ce4f9516da2ab468b2bb57
 *   deriveMintAddress(["pearl_a","pearl_a","pearl_b"]) -> e02802d54aad31cadb7ec8d7bae883b8
 * These are DIFFERENT addresses for a set that looks identical after de-duplication. This is
 * intentional and load-bearing, not a bug: changing the hash to dedupe first would invalidate
 * every handle already minted under the current scheme. Any second implementation of this
 * algorithm MUST reproduce "sorted, not deduped" exactly, or it will silently mint different
 * addresses for the same conceptual pearl set than this one does.
 *
 * DELIBERATE DEPARTURE FROM THE THREE EXISTING IN-MEMORY soccerball_emit IMPLEMENTATIONS:
 * they hash `{pearls, bindings}` TOGETHER, so adding one new binding fact mints an entirely
 * NEW address instead of extending the existing one's map -- directly at odds with the
 * Founder's own framing ("the MAPPING stays true, and the facts get added to": one map,
 * growing, not a new map per fact). This function derives the address from `pearls` ALONE;
 * bindings are a separately-appended ledger keyed BY that stable address. For the
 * empty-bindings case the two algorithms produce an IDENTICAL id (both reduce to
 * sha256(JSON.stringify(sortedPearls)).slice(0,32)); this is a considered refinement stated
 * openly, not a silent compatibility break.
 */
function deriveMintAddress(pearls: string[]): string {
  if (!pearls || pearls.length === 0) {
    throw new Error("deriveMintAddress: pearls must be non-empty");
  }
  const sorted = [...pearls].sort();
  const hash = createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
  return hash.slice(0, 32);
}

// ─── Durable log: read / append ────────────────────────────────────────────

function readAllRecords(): CrystalLogRecord[] {
  if (!existsSync(CRYSTAL_LOG_PATH)) return [];
  const raw = readFileSync(CRYSTAL_LOG_PATH, "utf-8");
  const out: CrystalLogRecord[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed) as CrystalLogRecord);
    } catch {
      // A corrupt line is skipped, never thrown -- fail open on read (HARDWIRE-00 1.8).
      continue;
    }
  }
  return out;
}

function appendRecord(rec: CrystalLogRecord): void {
  ensureDir(CRYSTAL_DIR);
  appendFileSync(CRYSTAL_LOG_PATH, JSON.stringify(rec) + "\n", "utf-8");
}

// ─── mintChonk ──────────────────────────────────────────────────────────────

/**
 * mintChonk -- register a chonk handle. Idempotent: re-minting the same pearl set is a
 * no-op that returns the existing address rather than writing a duplicate 'mint' record.
 *
 * BP162 D-BP162-M0-031: `meta` is a NEW, OPTIONAL second parameter carrying the six
 * Keystone Connector Typing fields (crystalType/crystalColor/graySubShade/whiteSubShade/
 * keystoneMaterial/powerState). Omitting it entirely (every pre-BP162 call site does)
 * produces the EXACT same record shape as before -- the mint record literal below starts
 * from the original 5-key object and only gains extra keys when `meta` supplies them.
 * `meta` NEVER reaches deriveMintAddress(); the sid above is derived from `pearls` alone,
 * computed before `meta` is even inspected.
 *
 * Re-minting an ALREADY-minted sid with a different `meta` is intentionally a no-op here
 * (matching the pre-existing alreadyMinted guard's own idempotent-no-op-on-repeat
 * semantics) -- typing/retyping a Crystal after its first mint, or re-grading its
 * Keystone's material, is out of scope for this dispatch and is left as an explicit,
 * documented follow-up (D-BP162-M0-025 section 2 recommends routing it through
 * mutateChonkBinding()-shaped governance); it is not silently attempted here.
 */
function mintChonk(pearls: string[], meta?: CrystalMintMeta): string {
  const sid = deriveMintAddress(pearls);
  const existing = readAllRecords();
  const alreadyMinted = existing.some((r) => r.op === "mint" && r.sid === sid);
  if (!alreadyMinted) {
    const rec: CrystalLogRecord = { v: 1, op: "mint", sid, ts: utcTs(), pearls: [...pearls].sort() };
    if (meta) {
      if (meta.crystalType !== undefined) rec.crystalType = meta.crystalType;
      if (meta.crystalColor !== undefined) rec.crystalColor = meta.crystalColor;
      if (meta.graySubShade !== undefined) rec.graySubShade = meta.graySubShade;
      if (meta.whiteSubShade !== undefined) rec.whiteSubShade = meta.whiteSubShade;
      if (meta.keystoneMaterial !== undefined) rec.keystoneMaterial = meta.keystoneMaterial;
      if (meta.powerState !== undefined) rec.powerState = meta.powerState;
    }
    appendRecord(rec);
  }
  return sid;
}

// ─── resolveChonk ───────────────────────────────────────────────────────────

/**
 * resolveChonk -- rehydrate a chonk's current state by replaying the append-only log.
 * This is what makes the store durable across process death: it reads from disk fresh,
 * it does not depend on any in-memory cache surviving from a prior process.
 */
function resolveChonk(sid: string): ResolvedChonk | null {
  const records = readAllRecords().filter((r) => r.sid === sid);
  const mintRec = records.find((r) => r.op === "mint");
  if (!mintRec || !mintRec.pearls) return null;

  const bindings: CrystalBindings = {};
  for (const r of records) {
    if ((r.op === "bind" || r.op === "supersede") && r.key && r.target) {
      // "Last one wins" within the replay is safe here specifically because 'bind' is only
      // ever appended by bindChonk() when the key is new or idempotently unchanged, and
      // 'supersede' only ever reaches the log through the gated mutateChonkBinding() path --
      // so the replay order always agrees with the gate that produced it.
      bindings[r.key] = r.target;
    }
  }
  const result: ResolvedChonk = { sid, pearls: mintRec.pearls, bindings };
  // BP162 D-BP162-M0-031: additive-only. Each key below is set ONLY when the mint record
  // actually carries it, so a pre-BP162 mint record (none of these six keys ever present)
  // resolves to the exact same {sid, pearls, bindings} object shape as before this change --
  // no new keys appear on old data. This function does NOT gate on powerState; it always
  // returns the full replay regardless of ON/OFF, exactly as it did pre-BP162 for every
  // existing caller. See resolveChonkGuarded() below for the power-aware entry point.
  if (mintRec.crystalType !== undefined) result.crystalType = mintRec.crystalType;
  if (mintRec.crystalColor !== undefined) result.crystalColor = mintRec.crystalColor;
  if (mintRec.graySubShade !== undefined) result.graySubShade = mintRec.graySubShade;
  if (mintRec.whiteSubShade !== undefined) result.whiteSubShade = mintRec.whiteSubShade;
  if (mintRec.keystoneMaterial !== undefined) result.keystoneMaterial = mintRec.keystoneMaterial;
  return result;
}

// ─── Power state -- BP162 D-BP162-M0-031, additive, governed ──────────────

/**
 * currentPowerState -- folds the latest 'power' record (if any) over the mint record's own
 * optional initial powerState, defaulting to "ON". Pure read, no I/O beyond readAllRecords.
 * A sid with no mint record has no meaningful power state; callers that care already check
 * resolveChonk()/resolveChonkGuarded() for existence first.
 */
function currentPowerState(sid: string): CrystalPowerState {
  const records = readAllRecords().filter((r) => r.sid === sid);
  let latest: CrystalPowerState | undefined;
  let latestTs = "";
  for (const r of records) {
    if (r.op === "power" && r.powerState && r.ts >= latestTs) {
      latest = r.powerState;
      latestTs = r.ts;
    }
  }
  if (latest) return latest;
  const mintRec = records.find((r) => r.op === "mint");
  return (mintRec && mintRec.powerState) || "ON";
}

/**
 * resolveChonkGuarded -- the power-aware resolution entry point. Distinguishes:
 *   - never minted:            { found: false, poweredOff: false, chonk: null }
 *   - minted, currently OFF:   { found: true,  poweredOff: true,  chonk: null }
 *   - minted, currently ON:    { found: true,  poweredOff: false, chonk: <ResolvedChonk> }
 * "Powered-down MUST mean its connectors do not resolve, while the Crystal and all its
 * files remain on disk untouched" (Founder ruling, D-BP162-M0-025 section 5): this function
 * enforces exactly that -- when OFF, `chonk` is withheld (bindings do not resolve to a
 * caller) but nothing on disk is read differently, touched, or deleted. resolveChonk()
 * itself is left completely unchanged (see its own comment above) so every pre-BP162 caller
 * keeps its exact existing null/non-null contract; this is a NEW, additional function.
 */
function resolveChonkGuarded(sid: string): GuardedResolveResult {
  const chonk = resolveChonk(sid);
  if (!chonk) {
    return { sid, found: false, poweredOff: false, powerState: "ON", chonk: null };
  }
  const powerState = currentPowerState(sid);
  if (powerState === "OFF") {
    return { sid, found: true, poweredOff: true, powerState, chonk: null };
  }
  return { sid, found: true, poweredOff: false, powerState, chonk };
}

/**
 * setCrystalPowerState -- the ONLY way a Crystal's power state changes after mint. Governed
 * the same way mutateChonkBinding() governs a binding change: one of the three named
 * MutationReason values, plus a non-empty audit note. Never overwrites anything in place --
 * appends a NEW 'power' record to the log (see currentPowerState()'s fold-latest-wins read
 * above). Nothing under CRYSTAL_DIR is deleted or rewritten by this function; it only ever
 * appends one line to crystal_log.jsonl.
 */
function setCrystalPowerState(
  sid: string,
  powerState: CrystalPowerState,
  reason: MutationReason,
  note: string
): PowerStateResult {
  if (!isMutationReason(reason)) {
    return {
      ok: false,
      sid,
      powerState: null,
      accepted: "rejected-invalid-reason",
      error: `"${String(reason)}" is not a permitted mutation reason`,
    };
  }
  if (!note || !note.trim()) {
    return {
      ok: false,
      sid,
      powerState: null,
      accepted: "rejected-invalid-reason",
      error: "setCrystalPowerState requires a non-empty note for the audit trail",
    };
  }
  const current = resolveChonk(sid);
  if (!current) {
    return {
      ok: false,
      sid,
      powerState: null,
      accepted: "rejected-not-minted",
      error: `sid ${sid} was never minted -- call mintChonk() first`,
    };
  }
  const existingState = currentPowerState(sid);
  if (existingState === powerState) {
    return { ok: true, sid, powerState, accepted: "idempotent-noop" };
  }
  appendRecord({ v: 1, op: "power", sid, ts: utcTs(), powerState, reason, note });
  return { ok: true, sid, powerState, accepted: "powered" };
}

// ─── bindChonk -- THE CHANGE GATE, DEFAULT (ADDITIVE) PATH ─────────────────

/**
 * bindChonk -- additive only.
 *   - New key on this sid           -> appended, accepted.
 *   - Existing key, identical value -> idempotent no-op, accepted (re-asserting an unchanged
 *                                       fact is not a mutation).
 *   - Existing key, DIFFERENT value -> REJECTED. Caller must use mutateChonkBinding() with
 *                                       one of the three named in-flux reasons.
 */
function bindChonk(sid: string, key: string, target: BindingTarget): BindResult {
  const current = resolveChonk(sid);
  if (!current) {
    return {
      ok: false,
      sid,
      key,
      accepted: "rejected-additive-only",
      error: `sid ${sid} was never minted -- call mintChonk() first`,
    };
  }
  const existing = current.bindings[key];
  if (!existing) {
    appendRecord({ v: 1, op: "bind", sid, ts: utcTs(), key, target });
    return { ok: true, sid, key, accepted: "appended" };
  }
  if (JSON.stringify(existing) === JSON.stringify(target)) {
    return { ok: true, sid, key, accepted: "idempotent-noop" };
  }
  return {
    ok: false,
    sid,
    key,
    accepted: "rejected-additive-only",
    error: `key "${key}" is already bound to a different target; call mutateChonkBinding() ` +
      `with an in-flux reason to change it`,
  };
}

// ─── mutateChonkBinding -- THE CHANGE GATE, IN-FLUX PATH ───────────────────

/**
 * mutateChonkBinding -- permitted ONLY for the three named reasons, and NEVER overwrites in
 * place: the pre-mutation value is written to a `.superseded.<UTC-ts>` sibling file first
 * (HARDWIRE-00 Section 1.9), then the new value is appended to the durable log.
 */
function mutateChonkBinding(
  sid: string,
  key: string,
  target: BindingTarget,
  reason: MutationReason,
  note: string
): BindResult {
  if (!isMutationReason(reason)) {
    return {
      ok: false,
      sid,
      key,
      accepted: "rejected-invalid-reason",
      error: `"${String(reason)}" is not a permitted mutation reason`,
    };
  }
  if (!note || !note.trim()) {
    return {
      ok: false,
      sid,
      key,
      accepted: "rejected-invalid-reason",
      error: "mutateChonkBinding requires a non-empty note for the audit trail",
    };
  }
  const current = resolveChonk(sid);
  if (!current) {
    return {
      ok: false,
      sid,
      key,
      accepted: "rejected-additive-only",
      error: `sid ${sid} was never minted -- call mintChonk() first`,
    };
  }
  const previous = current.bindings[key];
  if (!previous) {
    // Nothing to supersede -- this is a first write, which is the additive path, not a
    // mutation. Route it there rather than manufacturing a fake supersession.
    return bindChonk(sid, key, target);
  }

  ensureDir(SUPERSEDED_DIR);
  const siblingPath = join(SUPERSEDED_DIR, `${sid}.${key}.superseded.${utcTsForFilename()}.json`);
  writeFileSync(
    siblingPath,
    JSON.stringify(
      { sid, key, previous_target: previous, reason, note, superseded_at: utcTs() },
      null,
      2
    ),
    "utf-8"
  );

  appendRecord({ v: 1, op: "supersede", sid, ts: utcTs(), key, target, reason, note });

  return { ok: true, sid, key, accepted: "superseded", supersededSiblingPath: siblingPath };
}

// ─── Diagnostics ────────────────────────────────────────────────────────────

function crystalStats(): { mintedCount: number; logPath: string; logExists: boolean } {
  const records = readAllRecords();
  const minted = new Set(records.filter((r) => r.op === "mint").map((r) => r.sid));
  return { mintedCount: minted.size, logPath: CRYSTAL_LOG_PATH, logExists: existsSync(CRYSTAL_LOG_PATH) };
}

// ─── Exports (CommonJS -- see the header note on why this directory is CJS-scoped) ────────
module.exports = {
  CRYSTAL_DIR,
  CRYSTAL_LOG_PATH,
  SUPERSEDED_DIR,
  deriveMintAddress,
  mintChonk,
  resolveChonk,
  bindChonk,
  mutateChonkBinding,
  crystalStats,
  // BP162 D-BP162-M0-031 additions -- see each function's own doc comment above.
  resolveChonkGuarded,
  setCrystalPowerState,
  currentPowerState,
};


