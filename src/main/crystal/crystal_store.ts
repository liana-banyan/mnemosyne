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
// DATA LOCATION: resolved by `resolveCrystalDir()` below -- env override first, Electron
// userData second, a loud cwd-relative fallback last. All of it lives inside this ticket's
// OWNS block (this file writes only under its own resolved crystal dir; it never writes
// anywhere else in the tree).

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
} from "./crystal_types";

// ─── Storage location ──────────────────────────────────────────────────────

function resolveCrystalDir(): string {
  const envOverride = process.env.MNEM_CRYSTAL_DIR;
  if (envOverride) return resolve(envOverride);

  try {
    // Lazy + guarded: this module has zero HARD Electron dependency so it can run standalone
    // (tests, the kill-and-restart proof scripts, a future CLI) without an Electron runtime.
    // Outside Electron, `require('electron')` resolves to a path STRING, not the app API --
    // the `typeof app.getPath === 'function'` guard is what actually detects that difference.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = require("electron") as { app?: { getPath: (name: string) => string } };
    const app = electron?.app;
    if (app && typeof app.getPath === "function") {
      return resolve(app.getPath("userData"), "crystal");
    }
  } catch {
    // Not running inside Electron (tests, proof scripts, CLI) -- fall through to the
    // cwd-relative fallback below. Fail OPEN, never closed (HARDWIRE-00 Section 1.8).
  }

  const fallback = resolve(process.cwd(), ".mnem_crystal_fallback");
  console.warn(
    `[crystal_store] no MNEM_CRYSTAL_DIR and no Electron app.getPath available; ` +
      `falling back to ${fallback}. Set MNEM_CRYSTAL_DIR explicitly in production.`
  );
  return fallback;
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
 * identical `pearls` (any order, any duplication) MUST re-derive the identical 32-hex-char
 * address, every time, on any machine, forever.
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
 */
function mintChonk(pearls: string[]): string {
  const sid = deriveMintAddress(pearls);
  const existing = readAllRecords();
  const alreadyMinted = existing.some((r) => r.op === "mint" && r.sid === sid);
  if (!alreadyMinted) {
    appendRecord({ v: 1, op: "mint", sid, ts: utcTs(), pearls: [...pearls].sort() });
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
  return { sid, pearls: mintRec.pearls, bindings };
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
};


