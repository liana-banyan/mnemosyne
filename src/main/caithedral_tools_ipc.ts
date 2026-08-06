// caithedral_tools_ipc.ts — BP060 Application 002 Step 1 v3 · DELTA-1
// §X.A1 fix: native caithedral-core@0.2.0 imports — no more inlined parity.
// IPC surface unchanged — same channel names, same input/output shapes.
// All 9 tools + areopagus_query + ten_pearl_roundtrip wired through.
// decay_class: "BETWEEN" on all emissions per Application 002 canon.
// NEVER "wormhole" — binding discipline.

import { ipcMain } from 'electron';
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';

// ─── Native caithedral-core imports (DELTA-1 §X.A1 fix) ──────────────────────

import {
  soccerball_emit,
  soccerball_decode,
  soccerball_lookup,
  speckle_nibble,
  setDurableCrystalAdapter,
  setPearlDurableCrystalAdapter,
} from 'caithedral-core/tools/soccerball';

import { eblit_emit } from 'caithedral-core/tools/eblit';

import { substrace_weave } from 'caithedral-core/tools/substrace';

import { quilt_compose } from 'caithedral-core/tools/quilt';

import {
  substrate_address_validate,
  gen_valid_address,
} from 'caithedral-core/tools/substrate_address';

// ─── KN-BP147-M1: wire soccerball/pearl tools to the durable Crystal store ────
// Phase 0 found FOUR places holding their own ephemeral content-addressed-
// handle Map (this file's own AREOPAGUS_INDEX below is NOT one of them -- see
// the note on that array for why it stays ephemeral by design). Three of the
// four ARE the same duplicated abstraction: caithedral-core's
// CAITHEDRAL_CRYSTAL (soccerball_tools.ts) and LOCAL_CRYSTAL (pearl_tools.ts),
// plus librarian-mcp's MASS_CRYSTAL (hex_warehouse.ts, a different repo --
// left untouched, see BLOCKED file). SEPARATE FINDING (also see BLOCKED
// files): librarian-mcp's live MCP tools literally named "soccerball_emit" /
// "pearl_emit" do NOT call hex_warehouse.ts's functions at all -- they import
// "caithedral-core/tools/soccerball", which librarian-mcp's node_modules
// resolves to a THIRD, separate physical checkout at
// LianaBanyanPlatform/caithedral-core (remote liana-banyan/caithedral-core,
// stale, no durable-adapter code) -- not this repo's caithedral-core (remote
// liana-banyan/cai-core, fixed below), and not hex_warehouse.ts either. That
// checkout and librarian-mcp/src/server.ts are both outside this ticket's
// OWNS block; the durable-adapter fix below cannot reach them. This module is
// the correct wiring point
// for the two caithedral-core stores: it already imports caithedral-core's
// tools, it lives inside mnemosyne itself (not the portable, separately-
// published caithedral-core repo -- see soccerball_tools.ts's
// DurableCrystalAdapter doc comment for why caithedral-core cannot hard-import
// mnemosyne's internal src/main/crystal directly), and it is loaded once by
// index.ts's existing import of registerCaithedralToolsIPC -- no index.ts
// edit needed or made.
//
// Fails OPEN (HARDWIRE-00 Section 1.8): if crystal_store can't be loaded for
// any reason, this logs loudly and caithedral-core's tools keep their
// original in-memory-only behavior, unchanged. Nothing wedges.
//
// KNOWN GAP (VERIFIED EMPIRICALLY, KN-BP147-M1 dispatch D-BP147-005 -- not
// this file's to fix -- src/main/crystal/ is READ-ONLY for this ticket):
// this require() call below deliberately uses NO extension (Node's normal
// CommonJS resolution: try .js, then .ts under native type-stripping) so it
// resolves correctly to the packaged dist/main/crystal/crystal_store.js in a
// real tsc-compiled build. Confirmed working at that layer:
//   `node -e "require('./crystal/crystal_store')"` from dist/main -- OK.
// BUT crystal_store.ts:45 (read-only to this ticket) has its OWN internal
// `require("./crystal_types.ts")` with a HARDCODED, literal `.ts` extension.
// tsc does not rewrite string literals inside require() calls, and tsc does
// not copy .ts SOURCE files into outDir -- it only emits .js -- so in any
// tsc-compiled dist tree, dist/main/crystal/crystal_types.ts never exists,
// only crystal_types.js does. The result: crystal_store.js's own load-time
// require() throws MODULE_NOT_FOUND the instant anything requires it out of
// a real dist build, in BOTH `npm run dev:main` and `npm run build` (both
// run `tsc -p tsconfig.main.json` before `electron .`) -- there is no
// execution path for the real app that avoids this. Verified by hand,
// twice, from a clean dist/main/crystal/ with no stray .ts copy present:
//   require('./crystal/crystal_store.ts') from dist/main -> MODULE_NOT_FOUND
//     (Cannot find module './crystal/crystal_store.ts') -- the ORIGINAL bug.
//   require('./crystal/crystal_store')    from dist/main -> loads crystal_store.js,
//     which itself then throws MODULE_NOT_FOUND on './crystal_types.ts' --
//     THIS extension fix (below) gets one layer closer but cannot fully
//     resolve it alone, because the second failure is inside the read-only file.
// The try/catch below means a failure here is safe (fails open to the
// pre-existing in-memory behavior) but silently forfeits durability in the
// real running app until crystal_store.ts:45 drops its OWN `.ts` extension.
// See the BLOCKED file (HARDWIRE/LEDGER/YOKE/BLOCKED/D-BP147-005_M1_*.md)
// for the exact one-line fix and the full verification transcript.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const crystalStore = require('./crystal/crystal_store') as {
    mintChonk(pearls: string[]): string;
    resolveChonk(sid: string): {
      sid: string;
      pearls: string[];
      bindings: Record<string, { targetType: string; ref: string; meta?: Record<string, unknown> }>;
    } | null;
    bindChonk(
      sid: string,
      key: string,
      target: { targetType: string; ref: string; meta?: Record<string, unknown> }
    ): { ok: boolean; accepted: string; error?: string };
    CRYSTAL_LOG_PATH: string;
  };

  // getMintTimestamp -- reads the Crystal's own append-only log (CRYSTAL_LOG_PATH
  // and the CrystalLogRecord.ts field are both part of crystal_store.ts's/
  // crystal_types.ts's EXPORTED public surface, not an internal reach-around) to
  // recover the original mint ts for soccerball_lookup's PeanutRoll.ts field.
  // resolveChonk() does not expose it directly.
  function getMintTimestamp(sid: string): string | null {
    try {
      if (!existsSync(crystalStore.CRYSTAL_LOG_PATH)) return null;
      const raw = readFileSync(crystalStore.CRYSTAL_LOG_PATH, 'utf-8');
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const rec = JSON.parse(trimmed);
        if (rec.op === 'mint' && rec.sid === sid) return rec.ts as string;
      }
      return null;
    } catch {
      return null; // fail open -- ts is a diagnostic nicety, not load-bearing
    }
  }

  const crystalAdapter = {
    mintChonk: crystalStore.mintChonk,
    resolveChonk: crystalStore.resolveChonk,
    bindChonk: crystalStore.bindChonk,
    getMintTimestamp,
  };

  setDurableCrystalAdapter(crystalAdapter);
  setPearlDurableCrystalAdapter(crystalAdapter);
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn(
    '[caithedral_tools_ipc] KN-BP147-M1: Crystal durable store unavailable, ' +
      'soccerball/pearl tools falling back to in-memory-only substrate:',
    e,
  );
}

// ─── Types (re-exported from caithedral-core for IPC shape reference) ─────────

interface PeanutRoll {
  v: 1;
  s: string;
  p: string[];
  b: Record<string, string>;
  ts: number;
}

// ─── Seeded RNG helper (for substrate_address_emit seed→address adapter) ─────
// IPC callers pass a seed string; internally we derive a deterministic
// sequence of pseudo-random numbers from SHA-256(seed) so gen_valid_address()
// can produce a consistent result for the same seed.

function seededRng(seed: string): () => number {
  const hash = createHash('sha256').update(seed).digest('hex');
  let idx = 0;
  return (): number => {
    // Take 4 hex chars at a time, interpret as uint16, normalise to [0,1).
    const chunk = hash.slice(idx * 4, idx * 4 + 4);
    idx = (idx + 1) % 8; // reuse the 32-char hash cyclically
    return parseInt(chunk, 16) / 0x10000;
  };
}

// ─── BETWEEN-crystal in-process registry for areopagus_query ─────────────────
// caithedral-core maintains its own MassCrystal but that registry is only
// accessible via the exported lookup functions.  We maintain a parallel
// session-scoped index for Areopagus text search.
//
// KN-BP147-M1 Phase 0 finding: this array is DELIBERATELY left ephemeral, not
// consolidated into the Crystal. It is not a fourth instance of the
// content-addressed-handle-store duplication -- it is a substring TEXT SEARCH
// index over sids/pearls/bindings that are ALREADY durable via soccerball_emit
// above (once a Crystal adapter is wired in). It is explicitly documented
// above as "session-scoped," is capped at 10,000 entries by design (indexSid
// below), and answers a different question (substring match across many
// entries) than the Crystal answers (exact-key O(1) resolve). Rebuilding it
// on every process start from durable soccerball data, instead of letting it
// die with the process, is a real feature that could be built later, but it
// is not this ticket's "hold its own Map instead of the Crystal" defect --
// bulldozing it here would be exactly the "don't bulldoze a legitimate cache"
// case the ticket calls out. Left untouched.

interface AreopagusEntry {
  sid: string;
  pearls: string[];
  bindings: Record<string, string>;
  ts: number;
}

const AREOPAGUS_INDEX: AreopagusEntry[] = [];

function indexSid(sid: string, pearls: string[], bindings: Record<string, string>): void {
  if (AREOPAGUS_INDEX.length < 10_000) {
    AREOPAGUS_INDEX.push({ sid, pearls, bindings, ts: Date.now() });
  }
}

// ─── IPC handler wrapper ──────────────────────────────────────────────────────

type IpcResult<T> = { ok: true; result: T } | { ok: false; error: string };

function wrap<T>(fn: () => T): IpcResult<T> {
  try {
    return { ok: true, result: fn() };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function wrapAsync<T>(fn: () => Promise<T>): Promise<IpcResult<T>> {
  try {
    return { ok: true, result: await fn() };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ─── MESH-6: pointer-advance hook (set by index.ts after relay/peer init) ────

let _meshPointerAdvanceHook: ((newDagId: string) => void) | null = null;

export function setMeshPointerAdvanceHook(fn: (newDagId: string) => void): void {
  _meshPointerAdvanceHook = fn;
}

import { dag_soccerball_emit as _dag_emit } from 'caithedral-core/tools/dag_soccerball';

export function dag_soccerball_emit_reexport(pearls: string[], bindings?: Record<string, string>, faces?: Record<string, string>): string {
  return _dag_emit(pearls, bindings, faces);
}

// ─── IPC registration ─────────────────────────────────────────────────────────

export function registerCaithedralToolsIPC(): void {

  // soccerball_emit
  ipcMain.handle('caithedral:soccerball_emit', (_ev, pearls: string[], bindings: Record<string, string> = {}) =>
    wrap(() => {
      const sid = soccerball_emit(pearls, bindings);
      indexSid(sid, pearls, bindings);
      // MESH-6 Piece 3: notify peers of pointer advance
      _meshPointerAdvanceHook?.(sid);
      return sid;
    }),
  );

  // soccerball_decode
  ipcMain.handle('caithedral:soccerball_decode', (_ev, sid: string) =>
    wrap(() => soccerball_decode(sid)),
  );

  // soccerball_lookup
  ipcMain.handle('caithedral:soccerball_lookup', (_ev, sid: string) =>
    wrap(() => soccerball_lookup(sid) as PeanutRoll | null),
  );

  // speckle_nibble
  ipcMain.handle('caithedral:speckle_nibble', (_ev, sid: string, position: number) =>
    wrap(() => speckle_nibble(sid, position)),
  );

  // eblit_emit
  ipcMain.handle('caithedral:eblit_emit', (_ev, pearl_id: string, source_cathedral: string, ts?: number) =>
    wrap(() => eblit_emit(pearl_id, source_cathedral, ts)),
  );

  // substrace_weave
  ipcMain.handle('caithedral:substrace_weave', (_ev, eblit_null_lines: string[], weaver: string, weave_ts?: number) =>
    wrap(() => substrace_weave(eblit_null_lines, weaver, weave_ts)),
  );

  // quilt_compose
  ipcMain.handle('caithedral:quilt_compose', (_ev, substrace_ids: string[], narrative_tag: string, weaver: string, ts?: number) =>
    wrap(() => quilt_compose(substrace_ids, narrative_tag, weaver, ts)),
  );

  // substrate_address_emit — adapter: seed string → gen_valid_address(seededRng)
  ipcMain.handle('caithedral:substrate_address_emit', (_ev, seed: string) =>
    wrap(() => {
      const rng = seededRng(seed);
      return gen_valid_address(rng);
    }),
  );

  // substrate_address_validate
  ipcMain.handle('caithedral:substrate_address_validate', (_ev, address: string) =>
    wrap(() => substrate_address_validate(address)),
  );

  // areopagus_query — session-scope BETWEEN text search
  ipcMain.handle('caithedral:areopagus_query', (_ev, query: string) =>
    wrap(() => {
      const q = query.trim().toLowerCase();
      if (!q) return { matches: [], total: AREOPAGUS_INDEX.length };
      const matches = AREOPAGUS_INDEX.filter(
        (e) =>
          e.sid.includes(q) ||
          e.pearls.some((p) => p.toLowerCase().includes(q)) ||
          Object.values(e.bindings).some((v) => String(v).toLowerCase().includes(q)),
      ).slice(0, 50);
      return { matches, total: AREOPAGUS_INDEX.length };
    }),
  );

  // ten_pearl_roundtrip — Substrace Theorem empirical proof
  // Emits 10 Pearls → 10 Eblits → 1 Substrace → 1 Quilt
  // Verifies: substrace_id and quilt_id are each recoverable via soccerball_lookup
  // (since they ARE soccerball SIDs — same inputs ≡ same SIDs at any endpoint).
  ipcMain.handle('caithedral:ten_pearl_roundtrip', (_ev) =>
    wrap(() => {
      const ts = Date.now();
      const weaver = 'mnemosyne-bp060-v3';
      const narrative_tag = 'Application002-Step1-v3-roundtrip';

      // 10 Pearls — deterministic for this session-ts
      const pearls: string[] = [];
      for (let i = 0; i < 10; i++) {
        const pid = createHash('sha256')
          .update(`pearl:${ts}:${i}:bp060-v3`)
          .digest('hex')
          .slice(0, 32);
        pearls.push(pid);
      }

      // 10 Eblits
      const eblits = pearls.map((pid) => {
        const e = eblit_emit(pid, weaver, ts);
        return { eblit_id: e.eblit_id, pearl_id: e.pearl_id, null_line: e.null_line, decay_class: e.decay_class };
      });

      // 1 Substrace
      const null_lines = eblits.map((e) => e.null_line);
      const substrace = substrace_weave(null_lines, weaver, ts);

      // 1 Quilt
      const quilt = quilt_compose([substrace.substrace_id], narrative_tag, weaver, ts);

      // Theorem verification: substrace_id and quilt_id must be resolvable via soccerball_lookup
      const substrace_lookup_result = soccerball_lookup(substrace.substrace_id);
      const quilt_lookup_result = soccerball_lookup(quilt.quilt_id);
      const sid_equality = !!(substrace_lookup_result && quilt_lookup_result);

      // Index for Areopagus
      indexSid(substrace.substrace_id, null_lines, { weaver, weave_ts: String(ts) });
      indexSid(quilt.quilt_id, [substrace.substrace_id], { weaver, ts: String(ts), narrative_tag });

      return {
        pearls,
        eblits,
        substrace: {
          substrace_id: substrace.substrace_id,
          eblits: substrace.eblits,
          decay_class: substrace.decay_class,
        },
        quilt: {
          quilt_id: quilt.quilt_id,
          substraces: quilt.substraces,
          narrative_tag: quilt.narrative_tag,
          decay_class: quilt.decay_class,
        },
        sid_equality,
        ts,
      };
    }),
  );
}
