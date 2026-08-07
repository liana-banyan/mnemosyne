// mnem_eblet_store.ts -- BP084 v0.1.28 full-substrate recursive eblet reader
// SEG-1: Recursive walkEbletStore replaces flat readdirSync — reads all subdirs.
// SEG-2: EbletEntry gains `category` field derived from path (canon/active/trail/etc.)
// SEG-3: Persistent index at {userData}/mnemosynec/substrate/eblet_index.jsonl
//         — cold index written on first launch or when mtime delta detected.
//         — subsequent launches load index only, sub-3s target.
// SEG-4: Category-weighted BM25 (canon > active > trail > pixie-dust)
//         + `category:pixie-dust` query prefix to surface historical-mine class.
// SEG-5: Verified eblets surface through same query interface as category=verified.
//
// SEG-4 (orig) addition: writeVerifiedEblet() appends plow-accepted Q&A pairs to
// {userData}/substrate/verified_eblets.jsonl (append-only JSONL).
// Andon discipline: verified:true gate — unverified answers NEVER cached here.
//
// Known limitation (spec §8 integration spec): the legacy EBLET_STORE_PATH is outside
// the app bundle. In packaged/installed builds, this path may not exist on the end-user
// machine. The function gracefully returns [] when the path is absent -- no crash, no
// warning surfaced to the user.
//
// KN-BP147-M2 (BP147, "put the doctrine in MnemosyneC and make it consumed"): three
// estate-doctrine paths (Asteroid-ProofVault CANON x2, HARDWIRE/) are now REAL DEFAULTS in
// resolveEbletStoreRoots() -- see estateDoctrineRoots() below -- not just an env var a human
// has to remember to set. walkEbletStore() now also collects HARDWIRE-*.md alongside
// *.eblet.md, skipping .superseded.* siblings and *_AUGUR_AUGUR_PRICING_VIOLATION_SUPERSEDE.md
// stub artifacts. This machine's estate-scale-and-a-half `.claude/state/eblets/` corpus
// (~432k files, measured live) is deliberately NOT among these roots -- see the comment on
// estateDoctrineRoots() for why. Far-end proof (query returning real doctrine text, index
// count before/after) is in the M2 return doc, not repeated here.

import {
  existsSync,
  readdirSync,
  statSync,
  readFileSync,
  appendFileSync,
  mkdirSync,
  writeFileSync,
  renameSync,
} from 'fs';
import { resolve, join, basename } from 'path';
import { createHash } from 'crypto';
// BP137 Yoke (Semantic Match Durable): additive semantic-code primitive, see
// semantic_soccerball.ts header for the full honesty-mandate evidence (Ollama embed test
// results) and fail-soft contract. Does not create an import cycle -- semantic_soccerball.ts
// only imports ollama_manager.ts.
import { semantic_soccerball_emit, computeSemanticSimilarity } from './semantic_soccerball';
// KN-BP142-10: the Rooting Rule (canon BP142) made structural. computeHonestVerification()
// below no longer decides tier membership itself -- it delegates to this shared module so the
// exact same tier logic also gates liana_cycle_runner.ts's mintLedgerMark(), and neither write
// path can drift from the other. See rooting_rule.ts's own header for the full canon citation.
import { classifyCorroborationTier, isRooted, rootedTraceLabel } from './rooting_rule';

// ─── Guarded Electron resolution (D-BP148-007/KNIGHT/M1/seg-e7c1) ─────────────
//
// PRIOR BUG: this file did a static `import { app } from 'electron';` at module scope.
// Outside a real Electron process (plain `node`, ts-node, this file's own test harness,
// a future CLI/MCP host) Node's `require('electron')` resolves to a plain path STRING,
// not the Electron API surface -- `app` is `undefined` there, and every call site below
// that did `app.getPath(...)` / `app.isPackaged` / `app.getAppPath()` unguarded threw
// `TypeError: Cannot read properties of undefined (reading 'getPath')` the first time it
// ran outside Electron's main process. That is a HARD crash, not the "substrate is
// legitimately empty" case warmEbletIndex() was reporting it as (see that function's own
// comment for the second half of this fix).
//
// FIX: same guarded pattern crystal_store.ts's resolveCrystalDir() already uses one
// directory over (src/main/crystal/crystal_store.ts) -- try/catch require('electron'),
// type-check `typeof app.getPath === 'function'` before trusting the result (a bare
// `require('electron')` succeeding is not proof it's the real API; outside Electron it is
// a string), and a computed non-Electron fallback when that check fails. Departure from
// crystal_store.ts's version, deliberately: that module resolves ONCE at module load and
// caches the directory in a top-level const. THIS file's own existing comment fifteen
// lines below already documents why call-time (not load-time) resolution is load-bearing
// here -- app.getPath()/isPackaged are only guaranteed safe to read once Electron's `app`
// is actually ready, which module-load time is not guaranteed to be. This fix preserves
// that: getElectronApp() is called fresh, at call time, from inside every function that
// needs it, exactly where the old `app.` reference used to sit. It also caches a POSITIVE
// resolution across calls (once real Electron is confirmed present, it stays present for
// the life of the process) but never caches a NEGATIVE one, so a call made too early
// (before Electron's `app` is wired) can never permanently poison later calls made after
// it is.
//
// REAL-ELECTRON PATH IS BYTE-IDENTICAL: when `require('electron')` resolves an object with
// a real `app.getPath` function, getElectronApp() returns that exact same `app` object, and
// every call site below invokes the exact same `.getPath('userData')` / `.isPackaged` /
// `.getAppPath()` it always did. This is strictly an ADDITIVE fallback for the non-Electron
// case -- not a refactor of the real packaged app's resolution.
type ElectronAppShape = {
  getPath: (name: string) => string;
  isPackaged: boolean;
  getAppPath: () => string;
};

// The app.getPath('userData') app-name component. Electron derives this from package.json's
// `name` field (mnemosyne/package.json:2 = "amplify-computer"), NOT electron-builder's
// `productName` ("MnemosyneC") -- same distinction crystal_store.ts's own USERDATA_APP_NAME
// comment documents, verified there against the live shipping app's on-disk footprint
// (%APPDATA%\amplify-computer exists; %APPDATA%\MnemosyneC does not). Mirrored here rather
// than imported, to avoid this module taking on crystal_store.ts as a load-bearing dependency
// for one string constant.
const USERDATA_APP_NAME = 'amplify-computer';

let _electronAppCache: ElectronAppShape | null = null; // only ever caches a POSITIVE resolution -- see comment above.

/**
 * Returns the real Electron `app` object when running inside Electron's main process (and
 * only then -- `typeof app.getPath === 'function'` is the actual proof, not merely that
 * `require('electron')` didn't throw); otherwise returns `null` so callers can fall back.
 */
function getElectronApp(): ElectronAppShape | null {
  if (_electronAppCache) return _electronAppCache;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = require('electron') as { app?: ElectronAppShape };
    if (electron && electron.app && typeof electron.app.getPath === 'function') {
      _electronAppCache = electron.app;
      return _electronAppCache;
    }
  } catch {
    // Not resolvable outside Electron's main process -- expected for node scripts/tests.
  }
  return null;
}

/**
 * Non-Electron fallback for `app.getPath('userData')`: computes the SAME location
 * Electron's own convention would produce, with zero Electron dependency. Windows-only
 * (verified against this machine's real %APPDATA%\amplify-computer footprint, same as
 * crystal_store.ts's resolveCrystalDir()); throws for any other `process.platform` rather
 * than shipping an unverified guess -- a wrong-but-silently-working path is the exact
 * failure mode this fix exists to remove, not something to reintroduce on other platforms.
 */
function fallbackUserDataPath(): string {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA;
    if (appData) return resolve(appData, USERDATA_APP_NAME);
    throw new Error(
      "[EbletStore] non-Electron fallback: %APPDATA% is not set in this process's environment.",
    );
  }
  throw new Error(
    `[EbletStore] non-Electron fallback: no verified userData computation for ` +
      `process.platform === "${process.platform}". Real Electron app.getPath('userData') ` +
      `was not available either (see getElectronApp()).`,
  );
}

/** Guarded replacement for `app.getPath('userData')`. Real-Electron behavior unchanged. */
function resolveUserDataPath(): string {
  const electronApp = getElectronApp();
  if (electronApp) return electronApp.getPath('userData');
  return fallbackUserDataPath();
}

/** Guarded replacement for `app.isPackaged`. Outside Electron, always `false` (a bare node
 *  process is never a packaged Electron app). Real-Electron behavior unchanged. */
function resolveIsPackaged(): boolean {
  const electronApp = getElectronApp();
  return electronApp ? electronApp.isPackaged : false;
}

/** Guarded replacement for `app.getAppPath()`. Outside Electron there is no packaged-app
 *  root to ask Electron for; this file's own bundledDefaultEbletRoot() only reaches this
 *  path in its "not packaged, running from source" branch, where Electron's own getAppPath()
 *  resolves to the project root (the directory containing package.json). This mirrors that
 *  by walking up from this compiled file's own on-disk location (dist/main/*.js -> project
 *  root is two levels up), which is stable regardless of the calling process's cwd -- unlike
 *  `process.cwd()`, which would silently depend on where node happened to be launched from
 *  (the exact defect class B4's own portability fix, in this same file's history, removed).
 *  Real-Electron behavior unchanged. */
function resolveAppPath(): string {
  const electronApp = getElectronApp();
  if (electronApp) return electronApp.getAppPath();
  return resolve(__dirname, '..', '..');
}

// ─── Eblet store roots (BP132 Yoke #21 B4 — portability fix) ──────────────────
//
// PRIOR BEHAVIOR (broken on any machine but the Founder's dev box): three hardcoded
// C:\Users\Administrator\... paths. On a stranger's install none of these exist, so
// queryVerifiedEblets()/queryEbletStore() silently returned [] — eblet context (pulled
// into every Ask at ai_dispatch_ipc.ts:304-323) was silently absent for every real user.
//
// NEW: roots are resolved at call time (not module load, so app.getPath()/isPackaged
// are always safe to read) from four sources, in priority order:
//   1. MNEM_EBLET_STORE_ROOTS env override (path.delimiter-separated) — operator escape hatch.
//   2. Bundled default eblet set shipped with the app (resources/eblets_default, wired into
//      extraResources in package.json) — resolves via process.resourcesPath when packaged,
//      or resources/eblets_default relative to the repo when running from source.
//   3. {userData}/eblets — a portable, per-user, writable root. This is also the target the
//      Yoke #22 Helm "eblet your own folder" pipeline should write into, so a stranger's own
//      contributed eblets show up here without any hardcoded path.
//
// PORTABILITY CLEANUP (BP132 Yoke #23 Task 3, 2026-07-23): a 4th tier -- legacyDevRoots(),
// three hardcoded C:\Users\Administrator\... paths kept as a "Founder dev-machine fallback"
// -- was removed here. It was inert everywhere but the Founder's own machine (filtered by
// existsSync like everything else), but not portable, and the Founder's own machine is
// already covered by tiers 1-3 above (MNEM_EBLET_STORE_ROOTS env override, the bundled
// default set, and {userData}/eblets). No behavior change on any real install; this only
// removes dead hardcoded-path weight from the codebase per the Yoke #21 B4 portability fix.
//
// All candidates are filtered to existsSync() before use. If the resolved list is EMPTY,
// callers must surface a visible warning (Truth-Always) instead of quietly returning [].
let _resolvedRootsCache: { roots: string[]; warnedEmpty: boolean } | null = null;

function bundledDefaultEbletRoot(): string {
  // Packaged app: resources/eblets_default is placed next to the asar via extraResources.
  // Dev (unpackaged): fall back to the repo-relative resources/eblets_default folder.
  const packaged = typeof process !== 'undefined' && (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
    ? join((process as NodeJS.Process & { resourcesPath?: string }).resourcesPath!, 'eblets_default')
    : null;
  // D-BP148-007/KNIGHT/M1/seg-e7c1: resolveIsPackaged()/resolveAppPath() replace the old
  // unguarded `app.isPackaged`/`app.getAppPath()` -- byte-identical when real Electron is
  // present, see the guarded-resolution block above for the non-Electron fallback.
  if (resolveIsPackaged() && packaged) return packaged;
  return resolve(resolveAppPath(), 'resources', 'eblets_default');
}

// ─── Estate doctrine roots (KN-BP147-M2 -- "put the doctrine in MnemosyneC") ──
//
// PRIOR STATE (verified by reading this function before this Yoke, and by `git log
// --oneline -- src/main/mnem_eblet_store.ts`, 16 commits, none of which touch estate-root
// defaults): resolveEbletStoreRoots() only ever knew about MNEM_EBLET_STORE_ROOTS (env),
// the bundled default set, and {userData}/eblets. Zero hardcoded reference to
// LianaBanyanPlatform, Asteroid-ProofVault, HARDWIRE, or CANON existed anywhere in this
// file -- confirmed by grep for those exact tokens turning up nothing outside comments
// and deriveCategory()'s path-matching rules. The mechanism (deriveCategory's `canon`
// tier, walkEbletStore's recursion, the BM25 index) was real; nothing pointed it at the
// estate's own doctrine. This is that wire.
//
// Three bounded, named roots -- NOT the ~431k-file `.claude/state/eblets/` corpus this
// module's own loadOrRebuildIndex() doc comment already anticipated (that tree's CANON
// subdir alone holds ~288k files; PIXIE_DUST_BP051_FULL_REMINE_VERBATIM another ~143k --
// verified live via Get-ChildItem -Recurse -File count, session of this Yoke). That much
// larger, differently-named-but-similarly-named CANON tree is DELIBERATELY EXCLUDED from
// this default set: it was never one of the three roots this ticket named, and a cold
// walk+read of 431k files is not "a real, defaulted, discoverable configuration" -- it is
// a startup hang. If the estate wants that corpus indexed too, that is a separate, later
// ticket with its own bounded-subset design, not a silent side effect of this one.
function estateDoctrineRoots(): string[] {
  return [
    // BP146 canon, this workspace (27 files measured live this session).
    'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\Asteroid-ProofVault\\state\\eblets\\CANON',
    // BP082-BP145 canon, sibling repo (922 files measured live this session; ticket
    // said 921 -- off by one, one file landed between the ticket being written and
    // this Yoke; not a material discrepancy).
    'C:\\Users\\Administrator\\Documents\\Asteroid-ProofVault\\state\\eblets\\CANON',
    // The HardWires themselves.
    'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\HARDWIRE',
  ];
}

/** Resolve + cache the live list of eblet store roots that actually exist on this machine. */
function resolveEbletStoreRoots(): string[] {
  if (_resolvedRootsCache) return _resolvedRootsCache.roots;

  const candidates: string[] = [];

  const envOverride = process.env.MNEM_EBLET_STORE_ROOTS;
  if (envOverride) {
    candidates.push(...envOverride.split(require('path').delimiter).map((p) => p.trim()).filter(Boolean));
  }

  // KN-BP147-M2: estate doctrine roots are now real defaults, not an env var a human has
  // to remember to set. The env override above is additive (same pattern this function
  // already used for the bundled/userData tiers below) -- it can ADD roots on top of
  // these, it does not need to replace them.
  candidates.push(...estateDoctrineRoots());

  candidates.push(bundledDefaultEbletRoot());
  // D-BP148-007/KNIGHT/M1/seg-e7c1: resolveUserDataPath() replaces the old unguarded
  // `app.getPath('userData')` -- byte-identical when real Electron is present.
  candidates.push(resolve(resolveUserDataPath(), 'eblets'));

  const resolved = candidates.filter((root) => {
    try { return existsSync(root); } catch { return false; }
  });

  if (resolved.length === 0) {
    // Truth-Always: this used to be a silent [] return with no signal anywhere.
    console.error(
      `[EbletStore] WARNING: zero eblet store roots resolved on this machine — the substrate ` +
      `is EMPTY. Every Ask will run with no eblet context. Checked: ${candidates.join(' | ')}. ` +
      `Set MNEM_EBLET_STORE_ROOTS or place eblets in ${resolve(resolveUserDataPath(), 'eblets')}.`
    );
    // D-BP148-007/KNIGHT/M1/seg-e7c1: the renderer-notification loop below is Electron-only
    // by nature (BrowserWindow has no non-Electron meaning) -- guarded by getElectronApp()
    // instead of an unguarded `require('electron').BrowserWindow`, so this diagnostic branch
    // degrades to "log only" outside Electron instead of throwing. Real-Electron behavior
    // (the notification itself) is unchanged; this only skips it when there is no Electron
    // renderer to notify in the first place.
    if (getElectronApp()) {
      for (const win of require('electron').BrowserWindow.getAllWindows() as import('electron').BrowserWindow[]) {
        if (!win.isDestroyed()) {
          win.webContents.send('eblet-store:diagnostic', {
            kind: 'zero_roots_resolved',
            message: 'No eblet store found on this machine — Ask will run without substrate context.',
            checked: candidates,
            userDataFallback: resolve(resolveUserDataPath(), 'eblets'),
            at: new Date().toISOString(),
          });
        }
      }
    }
  } else {
    console.log(`[EbletStore] resolved ${resolved.length} eblet store root(s): ${resolved.join(' | ')}`);
  }

  _resolvedRootsCache = { roots: resolved, warnedEmpty: resolved.length === 0 };
  return resolved;
}

/** Backward-compat accessor — some call sites below iterate this directly. */
function getEbletStoreRoots(): string[] {
  return resolveEbletStoreRoots();
}

// Maximum chars read from each eblet file for scoring and snippet extraction.
const SCORE_WINDOW = 300;
const SNIPPET_WINDOW = 500;

// ─── Category derivation ─────────────────────────────────────────────────────

export type EbletCategory =
  | 'verified'
  | 'canon'
  | 'active'
  | 'snapshot-canon'
  | 'trail'
  | 'pixie-dust'
  | 'session';

/** BM25 category weights — higher = surfaced first. */
const CATEGORY_WEIGHT: Record<EbletCategory, number> = {
  verified:        6,
  canon:           5,
  active:          4,
  'snapshot-canon': 3,
  trail:           2,
  session:         1.5,
  'pixie-dust':    1,
};

/**
 * Derive an EbletCategory from the full file path.
 *
 * Rules (first match wins):
 *   path contains \state\eblets\CANON\         → canon
 *   path contains \state\eblets\PIXIE_DUST_    → pixie-dust
 *   path contains \state\eblets\TRAILS\        → trail
 *   path contains \state\eblets\BP (BP-bucket) → session
 *   path contains AntigravityWorkspace\…\canon → snapshot-canon
 *   all other eblets at root or unknown dir    → active
 */
function deriveCategory(fullPath: string): EbletCategory {
  const p = fullPath.replace(/\\/g, '/');
  if (p.includes('/state/eblets/CANON/'))                    return 'canon';
  if (/\/state\/eblets\/PIXIE_DUST/.test(p))                 return 'pixie-dust';
  if (p.includes('/state/eblets/TRAILS/'))                   return 'trail';
  if (/\/state\/eblets\/BP\d/.test(p))                       return 'session';
  if (p.includes('AntigravityWorkspace') && p.includes('/canon/')) return 'snapshot-canon';
  return 'active';
}

// ─── Recursive walker ─────────────────────────────────────────────────────────

// KN-BP147-M2: widened from *.eblet.md only. HARDWIRE-*.md (HARDWIRE-00_THE_TRAIL_HEAD.md,
// HARDWIRE-01_ANSWERING_PIPELINE.md, etc.) are doctrine too and do not carry the .eblet.md
// suffix. Deliberately literal to the ticket's glob (`HARDWIRE-*.md`, hyphen) -- this does
// NOT match HARDWIRE_CONVENTION.md (underscore), which stays out of the index by the same
// rule that keeps it out of git's own glob-based tooling elsewhere in this estate.
const HARDWIRE_DOC_PATTERN = /^HARDWIRE-.*\.md$/;
// The estate's own live-editing convention (HARDWIRE_CONVENTION.md, Rule 66 "version never
// overwrite") produces `<name>.superseded.<UTC-ts>[.md]` siblings on every edit, and a
// separate hook produces `<name>_AUGUR_AUGUR_PRICING_VIOLATION_SUPERSEDE.md` stubs (~2KB
// inert artifacts -- verified live: 8 of these exist under HARDWIRE/ this session, would
// have polluted BM25 with near-duplicate short files had they not been filtered). Both are
// excluded regardless of which pattern above matched the file.
function isSupersededOrStubArtifact(name: string): boolean {
  return name.includes('.superseded.') || name.endsWith('_AUGUR_AUGUR_PRICING_VIOLATION_SUPERSEDE.md');
}

function isIndexableEbletFile(name: string): boolean {
  if (isSupersededOrStubArtifact(name)) return false;
  return name.endsWith('.eblet.md') || HARDWIRE_DOC_PATTERN.test(name);
}

/**
 * SEG-1: Recursively walk `root` and collect all indexable doctrine file paths --
 * *.eblet.md (original scope) plus HARDWIRE-*.md (KN-BP147-M2), minus superseded/stub
 * artifacts (see isIndexableEbletFile above).
 * Uses an explicit stack (no recursion) to handle deep trees safely.
 */
function walkEbletStore(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (isIndexableEbletFile(entry.name)) {
        out.push(full);
      }
    }
  }
  return out;
}

// ─── Persistent index ─────────────────────────────────────────────────────────

export interface EbletIndexEntry {
  path: string;
  category: EbletCategory;
  title: string;
  snippet: string;   // first 200 chars of content
  mtime: number;
}

/** Path to the persistent index JSONL file. */
function getIndexPath(): string {
  // D-BP148-007/KNIGHT/M1/seg-e7c1: resolveUserDataPath() replaces the old unguarded
  // `app.getPath('userData')` -- byte-identical when real Electron is present.
  return resolve(resolveUserDataPath(), 'mnemosynec', 'substrate', 'eblet_index.jsonl');
}

let _indexCache: { entries: EbletIndexEntry[]; loadedAt: number } | null = null;
const INDEX_CACHE_TTL_MS = 60_000; // re-check delta every 60s

/**
 * BP132 Yoke #21 E10 (keep-current / self-index refresh) — fix-forward.
 *
 * PRIOR BUG: rootsMaxMtime() only checked the ROOT directory's own mtime. On every
 * common filesystem, adding/removing a file updates its DIRECT parent directory's
 * mtime, NOT every ancestor directory above it. Eblets live several subdirectories
 * deep (state/eblets/CANON/..., state/eblets/BP.../..., etc.), so a brand-new eblet
 * written two or more levels below a root was invisible to this check forever — the
 * index would never be flagged stale, and semantic search would keep returning
 * whatever was cached at first-index time. This is the exact failure mode Yoke #21's
 * E10 motivation describes: "the correct eblet existed but semantic search returned
 * month-old results."
 *
 * FIX: walk the FULL tree (same traversal as walkEbletStore, but without reading file
 * contents — just stat() calls) and take the max mtime across every directory AND
 * file encountered. This is still cheap (no file reads) and correctly detects a
 * change at any depth.
 */
function treeMaxMtime(root: string): number {
  let max = 0;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries;
    try {
      const dirStat = statSync(dir);
      if (dirStat.mtimeMs > max) max = dirStat.mtimeMs;
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else {
        try {
          const fStat = statSync(full);
          if (fStat.mtimeMs > max) max = fStat.mtimeMs;
        } catch { /* skip unreadable */ }
      }
    }
  }
  return max;
}

/**
 * Return the mtime of the most-recently-modified file/directory across every eblet
 * store root (full-tree scan, not just the root dir itself — see treeMaxMtime above)
 * so we can detect when new eblets have been added anywhere in the tree.
 */
function rootsMaxMtime(): number {
  let max = 0;
  for (const root of getEbletStoreRoots()) {
    if (!existsSync(root)) continue;
    try {
      const m = treeMaxMtime(root);
      if (m > max) max = m;
    } catch { /* skip */ }
  }
  return max;
}

/**
 * SEG-3: Load or rebuild the persistent eblet index.
 *
 * Algorithm:
 *   1. If in-memory cache is fresh (< 60s), return it.
 *   2. Read index file; compare index mtime to roots mtime.
 *   3. If roots newer → re-walk all roots → rewrite index → return.
 *   4. Otherwise load index file → return.
 *
 * Full re-index of 431k eblets targets < 60s cold; subsequent launches < 3s.
 */
async function loadOrRebuildIndex(): Promise<EbletIndexEntry[]> {
  const now = Date.now();
  if (_indexCache && now - _indexCache.loadedAt < INDEX_CACHE_TTL_MS) {
    return _indexCache.entries;
  }

  const indexPath = getIndexPath();
  const indexDir = join(indexPath, '..');

  // Check if existing index is up-to-date
  let indexMtime = 0;
  if (existsSync(indexPath)) {
    try { indexMtime = statSync(indexPath).mtimeMs; } catch { /* fallback 0 */ }
  }

  const rootsMtime = rootsMaxMtime();
  const needsRebuild = indexMtime === 0 || rootsMtime > indexMtime;

  if (!needsRebuild && indexMtime > 0) {
    // Load from file
    try {
      const raw = readFileSync(indexPath, 'utf-8');
      const entries: EbletIndexEntry[] = [];
      for (const line of raw.split('\n')) {
        const t = line.trim();
        if (!t) continue;
        try { entries.push(JSON.parse(t) as EbletIndexEntry); } catch { /* skip malformed */ }
      }
      _indexCache = { entries, loadedAt: now };
      console.log(`[EbletIndex] Loaded ${entries.length} entries from disk cache`);
      return entries;
    } catch { /* fall through to rebuild */ }
  }

  // Rebuild: walk all roots
  console.log('[EbletIndex] Rebuilding index…');
  const allPaths: string[] = [];
  for (const root of getEbletStoreRoots()) {
    if (existsSync(root)) {
      allPaths.push(...walkEbletStore(root));
    }
  }

  const entries: EbletIndexEntry[] = [];
  for (const fullPath of allPaths) {
    try {
      const mtime = statSync(fullPath).mtimeMs;
      const raw = readFileSync(fullPath, 'utf-8');
      // KN-BP147-M2: fullPath now may be a HARDWIRE-*.md doc, which does not carry the
      // .eblet.md suffix -- strip whichever suffix actually applies so titles for both
      // classes render clean (was: HARDWIRE docs kept their trailing ".md" verbatim in the
      // title, a cosmetic-only defect, since basename()'s ext arg is a no-op when the
      // path doesn't end with it).
      const rawBase = fullPath.endsWith('.eblet.md')
        ? basename(fullPath, '.eblet.md')
        : basename(fullPath, '.md');
      const title = rawBase.replace(/_/g, ' ').slice(0, 120);
      const snippet = raw.slice(0, 200);
      const category = deriveCategory(fullPath);
      entries.push({ path: fullPath, category, title, snippet, mtime });
    } catch { /* skip unreadable */ }
  }

  // Write index atomically
  try {
    mkdirSync(indexDir, { recursive: true });
    const tmp = indexPath + '.tmp';
    writeFileSync(tmp, entries.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf-8');
    renameSync(tmp, indexPath);
    console.log(`[EbletIndex] Wrote ${entries.length} entries to ${indexPath}`);
  } catch (e) {
    console.warn('[EbletIndex] Failed to write index:', e);
  }

  _indexCache = { entries, loadedAt: now };
  return entries;
}

/** Invalidate in-memory index cache (e.g. after a new eblet is written). */
export function invalidateIndexCache(): void {
  _indexCache = null;
}

/**
 * BP132 Yoke #21 E10: warm the eblet index at boot instead of waiting for the first
 * Ask to trigger a lazy rebuild. Two benefits: (1) the first real Ask of a session
 * isn't slowed down by a cold index build, (2) any change made to the eblet roots
 * while the app was closed is picked up immediately on the next launch, not on
 * whichever later moment the user happens to ask a question. Non-fatal by design.
 */
export async function warmEbletIndex(): Promise<EbletIndexStats> {
  try {
    const entries = await loadOrRebuildIndex();
    const stats = getEbletIndexStats();
    console.log(
      `[EbletIndex] warm-on-boot complete: ${entries.length} entries indexed ` +
      `(roots=${getEbletStoreRoots().length})`,
    );
    return { ...stats, status: 'ok' };
  } catch (e) {
    // D-BP148-007/KNIGHT/M1/seg-e7c1 (ticket M1.b, "fix the silent zero"): PRIOR BEHAVIOR
    // returned {totalIndexed:0, byCategory:{}, lastRefreshTimestamp:null} on ANY failure --
    // byte-for-byte identical to what a caller sees when the substrate is genuinely empty
    // (fresh install, roots exist but hold zero eblets, etc). A hard failure (e.g. the
    // Electron-fallback path above throwing, a rebuild I/O error) was therefore
    // indistinguishable from "there is nothing to index" to any caller reading this return
    // value -- exactly the defect ground-truth item 6 named. FIX: an explicit
    // status:'failed' + `error` field makes the failure unmissable; this remains non-fatal
    // to app boot (still returns a value, never throws/rejects) and the real underlying
    // reason is logged below, not swallowed.
    const reason = e instanceof Error ? (e.stack ?? e.message) : String(e);
    console.error('[EbletIndex] warm-on-boot FAILED (non-fatal to app boot):', e);
    return {
      totalIndexed: 0,
      byCategory: {},
      lastRefreshTimestamp: null,
      status: 'failed',
      error: reason,
    };
  }
}

// ─── Index stats ──────────────────────────────────────────────────────────────

export interface EbletIndexStats {
  totalIndexed: number;
  byCategory: Partial<Record<EbletCategory, number>>;
  lastRefreshTimestamp: number | null;
  // D-BP148-007/KNIGHT/M1/seg-e7c1: both fields are optional and set ONLY by
  // warmEbletIndex()'s catch branch. getEbletIndexStats() itself never sets `status` --
  // a plain totalIndexed:0 from THAT function is the legitimately-empty case. `status:
  // 'failed'` means path-resolution/rebuild threw (see `error` for the real reason), which
  // is NOT the same thing and must not be presented to a human/caller as though it were.
  status?: 'ok' | 'failed';
  error?: string;
}

/**
 * Return aggregate stats from the persistent index (used by SEG-6 UI counter).
 * Non-blocking: reads from in-memory cache; returns zeros when index not yet built.
 */
export function getEbletIndexStats(): EbletIndexStats {
  const indexPath = getIndexPath();
  let indexMtime: number | null = null;
  try {
    if (existsSync(indexPath)) indexMtime = statSync(indexPath).mtimeMs;
  } catch { /* fallback */ }

  if (!_indexCache) {
    return { totalIndexed: 0, byCategory: {}, lastRefreshTimestamp: indexMtime };
  }
  const byCategory: Partial<Record<EbletCategory, number>> = {};
  for (const e of _indexCache.entries) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
  }
  return {
    totalIndexed: _indexCache.entries.length,
    byCategory,
    lastRefreshTimestamp: indexMtime,
  };
}

// ─── STOP_WORDS ──────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'that', 'this', 'with', 'from', 'have', 'they', 'will', 'been', 'were',
  'what', 'when', 'where', 'which', 'while', 'your', 'more', 'also', 'into',
  'than', 'then', 'some', 'about', 'just', 'would', 'could', 'should',
  'their', 'there', 'these', 'those', 'each', 'such', 'other', 'after',
  'over', 'under', 'only', 'very', 'still', 'well', 'back', 'even',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .filter((w) => !STOP_WORDS.has(w));
}

// ─── EbletEntry (SEG-2: +category) ───────────────────────────────────────────

interface EbletEntry {
  filename: string;
  fullPath: string;
  category: EbletCategory;
  head: string;
  content: string;
  tokens: string[];
}

// ─── BM25 with category weight (SEG-4) ───────────────────────────────────────

function bm25Score(
  queryTokens: string[],
  docTokens: string[],
  corpusSize: number,
  category: EbletCategory,
): number {
  let score = 0;
  const docSet = new Set(docTokens);
  for (const qt of queryTokens) {
    if (docSet.has(qt)) {
      // IDF approximation: log(1 + corpus / 1) since we don't track per-term doc freq
      const idf = Math.log(1 + corpusSize);
      const tf = docTokens.filter((t) => t === qt).length;
      score += idf * tf;
    }
  }
  return score * (CATEGORY_WEIGHT[category] ?? 1);
}

// ─── "Just want the answers" category filter constants ───────────────────────

/** Categories returned to LLM prompt by default (SEG-4 "just want the answers"). */
const PRIORITY_CATEGORIES = new Set<EbletCategory>(['verified', 'canon', 'active', 'snapshot-canon']);

/**
 * SEG-4: Query the local eblet store for files matching the user query.
 *
 * Supports `category:<name>` prefix to force a specific category class:
 *   e.g. "category:pixie-dust cooperative economics"
 *
 * Default behaviour surfaces canon/active/snapshot-canon eblets only.
 * Historical-mine (pixie-dust) is only returned when explicitly requested.
 *
 * Returns top-3 eblet snippets as string[].
 */
export async function queryEbletStore(query: string): Promise<string[]> {
  // Parse optional category filter prefix
  let categoryFilter: EbletCategory | null = null;
  let effectiveQuery = query;
  const catMatch = query.match(/^category:(\S+)\s*(.*)/i);
  if (catMatch) {
    categoryFilter = catMatch[1].toLowerCase() as EbletCategory;
    effectiveQuery = catMatch[2].trim();
  }

  const indexEntries = await loadOrRebuildIndex();
  if (indexEntries.length === 0) return [];

  const queryTokens = tokenize(effectiveQuery);
  if (queryTokens.length === 0) return [];

  // Lazy-load full content only for scoring; full body fetched for top winners
  const corpusSize = indexEntries.length;
  const allowedCategories = categoryFilter
    ? new Set<EbletCategory>([categoryFilter])
    : PRIORITY_CATEGORIES;

  const candidates = indexEntries.filter((e) => allowedCategories.has(e.category));
  if (candidates.length === 0) return [];

  // Score using snippet + title tokens (fast — no full file read)
  const scored = candidates
    .map((e) => {
      const tokens = Array.from(
        new Set([...tokenize(e.title), ...tokenize(e.snippet)]),
      );
      return { entry: e, score: bm25Score(queryTokens, tokens, corpusSize, e.category) };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  // Lazy-load full body for top-3 winners only (SEG-3 discipline)
  const results: string[] = [];
  for (const r of scored) {
    try {
      const raw = readFileSync(r.entry.path, 'utf-8');
      const content = raw.slice(0, SNIPPET_WINDOW);
      const categoryBadge = `[category: ${r.entry.category}]`;
      results.push(`[${r.entry.title}] ${categoryBadge}\n${content}`);
    } catch {
      results.push(`[${r.entry.title}] [category: ${r.entry.category}]\n${r.entry.snippet}`);
    }
  }
  return results;
}

// ─── SEG-4 v0.1.56: Verified eblet writer · SEG-1 v0.1.57: HOT retrieve path ──

export interface VerifiedEbletEntry {
  question: string;
  answer: string;
  provenance: string;   // format: spider:<name>:<session> | sprite:<id>:<session>
  /** BP131 honesty fix: widened from a literal `true` to `boolean`. The old literal type FORCED
   *  every caller to write `verified: true` just to satisfy the compiler, even callers with zero
   *  genuine verification signal (a lone uncorroborated authority guess) -- that is the exact
   *  root cause of the "100% verified:true, 0% verdict:'verified'" integrity violation this Yoke
   *  fixes (see writeVerifiedEblet()'s honesty gate below). Whatever the caller supplies here is
   *  now advisory only -- writeVerifiedEblet() RE-DERIVES the persisted `verified`/`verdict` pair
   *  from `provenance`/`corroboration` via computeHonestVerification(), never trusting this field
   *  verbatim. Kept on the interface (rather than dropped) so existing callers stay source-
   *  compatible without edits. */
  verified: boolean;
  sha256: string;       // sha256(question + answer)
  timestamp: number;
  /** BP135 Yoke #34 argument-ledger (0.9.7), OPTIONAL/ADDITIVE. Absent on every eblet written
   *  before this Yoke -- Rule 66 (never rewrite/delete existing eblets in place) means those
   *  are never migrated to carry these fields; every reader must treat their absence as
   *  verdict='unverified' (see readVerdict() below), never as 'correct' or 'wrong' by inference. */
  /** The voter/derivation working (0.9.6 reasoning-mode text, or a short method note) that
   *  produced this eblet -- the METHOD, never a bare answer-key letter. */
  reasoning?: string;
  /** 'correct'/'wrong' only ever set in a context where a ground-truth answer was available for
   *  local comparison (e.g. the mesh test's payload.correct_answer_letter) -- production Asks
   *  have no ground truth to compare against and must write 'unverified'. */
  verdict?: 'correct' | 'wrong' | 'verified' | 'unverified';
  /** BP131 honesty fix, ADDITIVE/OPTIONAL, tier semantics made structural by KN-BP142-10 (the
   *  Rooting Rule, canon BP142; see rooting_rule.ts). Caller-supplied hint about WHY this answer
   *  is being offered as verified, consumed by computeHonestVerification() at write time (see
   *  below) via rooting_rule.ts's classifyCorroborationTier() -- never trusted blindly, only used
   *  to select among the two tiers that ROOT (flip verified:true): 'deterministic_compute' (Tier
   *  1 proven -- a calculator/solver proved the answer, no LLM/authority guess involved) and
   *  'coroner_verified' (Tier 2 ground-truth-checked -- answer_coroner.ts explicitly ratified
   *  this against a known answer key). 'concordant' (2+ independent authorities/voters
   *  genuinely agreed -- an ensemble CONCORDANT accept, NOT a single_* accept) IS a real,
   *  named tier (Tier 3, concordant), but per the BP142 Rooting Rule it never ROOTS: agreement
   *  alone is not verification ("variance is not independence, and the independence unit is the
   *  DERIVATION PATH, never the model or the machine"), so it resolves to the same honest
   *  verified:false/verdict:'unverified' outcome as an uncorroborated single-authority guess --
   *  the answer is still written and still retrievable, it simply is not ROOTED. 'single_authority'
   *  and 'coroner_unverified' are also accepted values so a caller can be explicit about a
   *  NON-qualifying signal (lone uncorroborated authority, or an explicit Coroner rejection)
   *  rather than leaving the field absent -- both resolve to the same honest
   *  verified:false/verdict:'unverified' outcome as leaving it unset. BP-COMPUTE-HONEST-DEMOTE
   *  addition: 'authority_extracted_compute' -- a real, checked unit-conversion/tolerance-match
   *  ran (never a guess), but the quantity it converted was extracted from an authority/LLM's own
   *  reasoning or fact text (compute_sidecar.ts UnitAwareComputeResult's `source:
   *  'reasoning_fact'`, paths (a)/(c)) rather than a literal expression present in the question
   *  itself (path (b), which alone still earns 'deterministic_compute'). Deliberately unclassified
   *  by classifyCorroborationTier() -- it has no independent grounding of its own (it is a
   *  derived restatement of another candidate's claim), so it resolves to the same honest
   *  verified:false/verdict:'unverified' outcome as 'single_authority'. */
  corroboration?: 'concordant' | 'single_authority' | 'deterministic_compute' | 'authority_extracted_compute' | 'coroner_verified' | 'coroner_unverified';
  /** 0-1, derived from concordance/BMV at write time (see computeArgumentConfidence() in
   *  canonical_pipeline.ts) -- how much the writing pipeline itself trusted this fact. */
  confidence?: number;
  /** BP136 Yoke (answer-cache v1), OPTIONAL/ADDITIVE, forward-compat for the v2 research arm.
   *  The stored/served unit is a provenanced COMPONENT, not just a bare Q->A pair -- most
   *  answers are combinations of reusable components (facts/steps) that v2 will fetch from
   *  MCP-federated authorities. Absent on every eblet written before this Yoke; readers must
   *  treat absence as 'whole_answer' (the only class v1 ever writes), never infer 'component'. */
  class?: 'whole_answer' | 'component';
  /** BP136 Yoke, OPTIONAL/ADDITIVE. Structured provenance for cross-authority corroboration
   *  (v2/v3) -- deliberately separate from the existing bare-string `provenance` field above
   *  (which stays untouched for backward compat with every existing reader/writer). */
  provenanceDetail?: {
    source: string;
    method: string;
    corroboration_sources: string[];
    hash: string;
    ts: string;
  };
  /** BP136 Yoke v2a (CSIA activation): Truth Integrity Chain (TIC) 5-field schema, referenced
   *  by the YOKE_V2 spec as `canon_truth_integrity_chain...bp084`. VERIFIED THIS SESSION: no
   *  file matching that canon doc name, and no code implementing these 5 fields, was found
   *  anywhere in this repo, the LianaBanyanPlatform workspace, or the Librarian Cathedral
   *  substrate (search_knowledge + detective_investigate both returned no matching indexed
   *  content) -- these fields DID NOT EXIST before this Yoke; v1 added only `class` and
   *  `provenanceDetail` above. OPTIONAL/ADDITIVE, same Rule 66 convention as those two fields:
   *  absent on every eblet written before this Yoke; readers must treat absence as "no TIC
   *  data recorded", never infer empty arrays or a "known-nothing" state. */
  tic?: {
    /** Facts already corroborated/settled for this question (what the loop currently believes). */
    known: string[];
    /** Open theories not yet resolved -- surfaced honestly rather than silently dropped. */
    theories_open: string[];
    /** Candidate answers/components explicitly refuted/retracted (Rule 66: never deleted,
     *  only marked eliminated here). */
    eliminated: string[];
    /** Provenance chain: the STORED QUESTIONS of the eblets this fact was derived/corroborated
     *  from (e.g. Psionic's convergent cluster) -- the "where did this come from" edge. */
    dependencies_upstream: string[];
    /** The inverse edge: questions/facts that in turn depend on this one. Populated by a
     *  future writer when a later fact cites this one as an upstream dependency; absent/empty
     *  at write time for a brand-new fact, same convention as every other optional field here. */
    applications_downstream: string[];
  };
  /** BP137 Yoke (Semantic Match Durable), OPTIONAL/ADDITIVE. 32-hex-char SimHash code of an
   *  Ollama embedding of THIS entry's `question` field (see semantic_soccerball_emit() in
   *  semantic_soccerball.ts) -- structurally the same 32-hex-char shape as the sha256
   *  Soccerball wire format, but semantic rather than content-addressed. Absent on every eblet
   *  written before this Yoke, and absent on any write made while semantic_soccerball_mode is
   *  off or while ollamaManager.embed() was unavailable for that write -- readers must treat
   *  absence as "no semantic code recorded" and fall back to token-similarity, never infer a
   *  code or a similarity value. */
  semanticCode?: string;
  /** BP140 Yoke (Eblet-Learning Substrate / Liana Cycle), OPTIONAL/ADDITIVE. The RGBY fact-verdict
   *  color taxonomy coined in canon_eblet_fact_verdict_color_taxonomy_rgby_bp139 -- a SUPERSET of,
   *  not a replacement for, the 4-value `verdict` field above (which stays the honest write-time
   *  signal). Where `verdict` is derived at write time from provenance/corroboration alone,
   *  `factVerdict` is derived at CORONER time when ground truth is known, so it can distinguish
   *  outcomes `verdict` structurally cannot. Letter-labeled (not just colored) for colorblind
   *  readers per the dataviz-accessibility rule:
   *    G = right        (Coroner outcome 'right' / deterministic-compute / concordant-verified)
   *    R = wrong        (Coroner outcome 'wrong' vs ground truth)
   *    B = undetermined (answered-but-unverified, or an abstain with no ground truth yet -- go-LOOK)
   *    Y = unknowable   (no fact of the matter / genuinely unanswerable -- distinct from B)
   *    O = conflicting  (authorities actively disagreed: ensembleOutcome.corroboration==='disagree'
   *                      -- a go-INVESTIGATE signal, has no source in the Coroner's single-letter view)
   *  Absent on every eblet written before this Yoke and on every non-scored production Ask (no
   *  ground truth) -- readers MUST treat absence as "no RGBY verdict recorded" and fall back to
   *  readVerdict(), never infer a color. Persisted for EVERY ensemble candidate (winner AND losers),
   *  not just the accepted letter -- that is the whole point: keep the reasoning we paid for. */
  factVerdict?: 'G' | 'R' | 'B' | 'Y' | 'O';
  /** BP140 Yoke, OPTIONAL/ADDITIVE. Not a color -- an attribute on a G that is true-NOW but expires
   *  ('current population', 'latest version'). `flag:true` tells the Liana Cycle to re-verify on the
   *  next pass instead of trusting a Green that may have quietly rotted; `checkedAt` is the ISO-8601
   *  UTC instant the fact was last confirmed. Absent means "not marked volatile" -- never infer
   *  staleness from absence. */
  volatileDated?: { flag: boolean; checkedAt: string };
}

/** Backward-compat accessor (item 6): every reader that cares about verdict should go through
 *  this instead of reading entry.verdict directly, so "field absent" and "field explicitly
 *  unverified" are handled identically without duplicating the ?? fallback at every call site. */
export function readVerdict(entry: VerifiedEbletEntry): 'correct' | 'wrong' | 'verified' | 'unverified' {
  return entry.verdict ?? 'unverified';
}

// ─── KN-BP144-15 Phase 2: rejection records ("eliminations are facts and we throw them away") ──
//
// A REJECTION IS A CLAIM ABOUT AN OPTION, NOT ABOUT AN ANSWER (ticket's own framing, binding).
// VerifiedEbletEntry does not fit one as-is (Phase 0 report 0.4, full finding there): its
// retrieval key is a (question, answer) PAIR, where `answer` is conventionally the WINNING
// value a caller wants SERVED; there is no slot for "which option's own text is being rejected
// and why", and `class: 'whole_answer' | 'component'` both describe something meant to be served
// or reused as an answer fragment, which a rejection structurally is not. Per the ticket's own
// instruction ("prefer a new, separate type/record alongside it, written through the same store
// mechanism" -- not editing VerifiedEbletEntry itself), RejectedOptionEbletEntry below is that
// distinct, minimal, additive type. It reuses VerifiedEbletEntry's own `corroboration`/`verdict`
// vocabulary (unchanged, not widened) purely so it can be passed to computeHonestVerification()
// below unmodified -- the SAME Rooting Rule gate every other write already goes through, applied
// here without needing a single line of that gate's own logic to change (Phase 0 0.5's own
// finding: the gate is caller-agnostic, only the "does anything ever construct a rejection-shaped
// call" seam was missing -- this closes exactly that seam, nothing else).
export interface RejectedOptionEbletEntry {
  /** The full question stem this rejection concerns -- kept for provenance/audit trail, NEVER
   *  the retrieval key (Phase 0 0.4: a synthesized one-off "why is J wrong for qid 85"-shaped
   *  question would never match how a real future question actually phrases itself). Retrieval
   *  by a later question touching the same concept is intended to key off `concept`/
   *  `predicateReferentTerms` instead -- see queryRejectedOptionEblets() below. */
  question: string;
  /** The REJECTED option's own letter. Never a winner, never a servable `answer` -- there is
   *  deliberately no field here that could be read as "the answer to this question". */
  rejectedLetter: string;
  /** The rejected option's own text, quoted verbatim -- the evidence a future reader can check
   *  `reason` against without re-deriving it, matching EliminationRecord.evidence in
   *  plow_mc_elimination_cascade.ts (the producer this type is designed to receive from). */
  optionText: string;
  /** The rule identifier that produced this rejection -- see EliminationRecord.ruleId. */
  ruleId: string;
  /** The full rationale, verbatim -- never a bare rule code (Phase 0 0.3's own load-bearing
   *  finding: a bare rule name is not a reason worth storing). */
  reason: string;
  /** The concept this rejection's rule was reasoning about (e.g. "bias") -- the durable retrieval
   *  key per Phase 0 0.4 above. Null when the producing rule never resolved one. */
  concept: string | null;
  /** The register the rule resolved to (e.g. "statistics"), narrowing retrieval further than
   *  concept alone. Null when the producing rule never resolved one. */
  register: string | null;
  /** The predicate referent terms this rejection was checked against -- the actual checkable
   *  claim, retrievable independent of any one question's phrasing ("downchain linkage": a LATER
   *  fact about the same concept/register/referent-terms triple can find this rejection by that
   *  triple, the same way `concept`/`registerCandidate.register`/`derivedPredicateReferentTerms`
   *  already let plow_mc_elimination_cascade.ts's own caller correlate a later run against an
   *  earlier one). */
  predicateReferentTerms: string[];
  /** Same free-text provenance convention as VerifiedEbletEntry.provenance -- origin-tracing,
   *  agnostic to positive/negative claim shape (Phase 0 0.4: this field generalizes cleanly). */
  provenance: string;
  /** Same vocabulary as VerifiedEbletEntry.corroboration, UNCHANGED -- passed to
   *  computeHonestVerification() verbatim; see that function's own doc comment for tier
   *  semantics. A rejection reached via a mandatory-verification-gated, literal-substring
   *  predicate check (this ticket's own producing mechanism) is a deterministic, mechanically
   *  reproducible claim -- no LLM guess, no "agreement" -- so it is honestly classified
   *  'deterministic_compute' (Tier 1) by this type's own writer below, not left to a generic
   *  'concordant' default that would understate what was actually proven. */
  corroboration?: VerifiedEbletEntry['corroboration'];
  verdict?: VerifiedEbletEntry['verdict'];
  timestamp: number;
}

/** Persisted-record shape: RejectedOptionEbletEntry plus the fields computeHonestVerification()/
 *  the writer below derive rather than accept from the caller, plus the structural
 *  `claimType: 'rejection'` marker (FE-3 defense in depth -- see writeRejectedOptionEblet's own
 *  doc comment for why this field exists even though physical file separation already makes a
 *  rejection unreachable by every existing candidate-set query). */
export interface StoredRejectedOptionEblet extends RejectedOptionEbletEntry {
  claimType: 'rejection';
  verified: boolean;
  sha256: string;
}

/**
 * Append a rejected-option claim to its own dedicated store file.
 *
 * Store location: {userData}/substrate/rejected_option_eblets.jsonl -- deliberately a SEPARATE
 * file from {userData}/substrate/verified_eblets.jsonl (the answering pool queryVerifiedEblets/
 * queryVerifiedEbletsTopical/loadAllVerifiedEblets read) and from
 * {userData}/substrate/rgby_ledger.jsonl (the KN-BP141-5 FIX 3 sibling). This is not an
 * incidental choice: it is the FIRST of two independent reasons a stored rejection can never
 * become a candidate/vote/corroborator (KN-BP144-15 ticket's own mandatory FE-3 requirement) --
 * no existing candidate-set-building function anywhere in this file (or in
 * plow_mc_answerer.ts/answer_coroner.ts/csia_research.ts, confirmed by grep of every
 * `verified_eblets.jsonl`/`rgby_ledger.jsonl` reference in src/main) ever opens this filename,
 * so a rejection is unreachable by them BY CONSTRUCTION, not merely by the absence of code that
 * happens not to read it today. The SECOND, independent reason is the `claimType: 'rejection'`
 * marker persisted on every row (see StoredRejectedOptionEblet) -- defense in depth: even a
 * hypothetical future reader that scanned every substrate/*.jsonl file indiscriminately would
 * still have to affirmatively ignore this marker to misuse a rejection as a candidate.
 *
 * ROOTING RULE (KN-BP142-10, unchanged, applied here exactly as at every other write path):
 * `verified`/`verdict` are ALWAYS re-derived via computeHonestVerification() -- never taken
 * verbatim from `entry`. A rejection whose `corroboration` does not qualify for Tier 1/Tier 2
 * (per rooting_rule.ts's classifyCorroborationTier(), unmodified) is honestly persisted with
 * verified:false/verdict:'unverified' -- exactly the same honesty discipline writeVerifiedEblet()
 * already applies to a positive claim. This function cannot "fail" the Rooting Rule by
 * construction: it never overrides what computeHonestVerification() decides.
 *
 * Rule 66: append-only, same as writeVerifiedEblet() -- no existing row is ever rewritten.
 *
 * Returns the sha256 of (question + '\0' + rejectedLetter + '\0' + reason) as write confirmation
 * -- a rejection's natural identity is the TRIPLE (which question, which option, which reason),
 * never a (question, answer) pair (Phase 0 0.4's own finding on why that pair does not fit).
 */
export async function writeRejectedOptionEblet(entry: RejectedOptionEbletEntry): Promise<string> {
  const { verified: honestVerified, verdict: honestVerdict } = computeHonestVerification(entry);

  // D-BP148-007/KNIGHT/M1/seg-e7c1: resolveUserDataPath() replaces the old unguarded
  // `app.getPath('userData')` -- byte-identical when real Electron is present.
  const ebletDir = resolve(resolveUserDataPath(), 'substrate');
  const ebletFile = resolve(ebletDir, 'rejected_option_eblets.jsonl');
  if (!existsSync(ebletDir)) {
    mkdirSync(ebletDir, { recursive: true });
  }

  const expectedSha = createHash('sha256')
    .update(entry.question + '\0' + entry.rejectedLetter + '\0' + entry.reason)
    .digest('hex');

  const line = JSON.stringify({
    claimType: 'rejection',
    question: entry.question,
    rejectedLetter: entry.rejectedLetter,
    optionText: entry.optionText,
    ruleId: entry.ruleId,
    reason: entry.reason,
    concept: entry.concept,
    register: entry.register,
    predicateReferentTerms: entry.predicateReferentTerms,
    provenance: entry.provenance,
    verified: honestVerified,
    verdict: honestVerdict,
    sha256: expectedSha,
    timestamp: entry.timestamp,
  });

  appendFileSync(ebletFile, line + '\n', 'utf-8');
  return expectedSha;
}

/**
 * Reads back every rejection persisted by writeRejectedOptionEblet() above (FE-1: "the far end is
 * a rejection record readable from the store, not a function that returned one" -- this is that
 * read-back path). Optional `filter` narrows by the durable retrieval keys Phase 0 0.4 identified
 * (`concept`/`question`) -- NEVER by a servable answer, because none exists on this shape.
 * Malformed lines are skipped, consistent with every other reader in this file. Returns [] when
 * the file does not exist yet (no rejection ever written) -- never throws.
 */
export async function queryRejectedOptionEblets(filter?: {
  concept?: string;
  question?: string;
}): Promise<StoredRejectedOptionEblet[]> {
  // D-BP148-007/KNIGHT/M1/seg-e7c1: resolveUserDataPath() replaces the old unguarded
  // `app.getPath('userData')` -- byte-identical when real Electron is present.
  const ebletFile = resolve(resolveUserDataPath(), 'substrate', 'rejected_option_eblets.jsonl');
  if (!existsSync(ebletFile)) return [];

  let raw: string;
  try {
    raw = readFileSync(ebletFile, 'utf-8');
  } catch {
    return [];
  }

  const entries: StoredRejectedOptionEblet[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as Partial<StoredRejectedOptionEblet>;
      if (parsed.claimType === 'rejection' && parsed.question && parsed.rejectedLetter) {
        entries.push(parsed as StoredRejectedOptionEblet);
      }
    } catch {
      console.warn('[EbletStore] Malformed rejected_option_eblets line skipped:', trimmed.slice(0, 80));
    }
  }

  if (!filter) return entries;
  return entries.filter(
    (e) =>
      (filter.concept === undefined || e.concept === filter.concept) &&
      (filter.question === undefined || e.question === filter.question),
  );
}

/** BP135 Yoke #34 (0.9.7): shared Q/A relevance check, used at BOTH write time (before stamping
 *  a specialist-derived fact as a verified eblet, canonical_pipeline.ts's runScribe) and read
 *  time (queryVerifiedEbletsTopical below, filtering existing junk WITHOUT deleting it -- Rule
 *  66). Token-overlap ratio: what fraction of the question's meaningful (stopword-filtered)
 *  tokens actually appear in the answer text. Deliberately simple/explainable (no external NLP
 *  dependency) -- reuses the same tokenizeQuestion() convention already used by the verified-
 *  eblet keyword-scoring paths in this file. */
export function computeQaRelevance(question: string, answer: string): number {
  const qTokens = tokenizeQuestion(question);
  if (qTokens.length === 0) return 0;
  const aTokens = new Set(tokenizeQuestion(answer));
  if (aTokens.size === 0) return 0;
  const overlap = qTokens.filter((t) => aTokens.has(t)).length;
  return overlap / qTokens.length;
}

/** Conservative default threshold: this is a coarse gate against wholesale Q/A mismatch (BP135
 *  audit finding: ~47% of existing canonical_plow eblets are Q/A-mismatched junk), not a
 *  precision semantic-similarity score -- legitimate answers routinely paraphrase rather than
 *  repeat the question's exact tokens, so this stays low on purpose. */
export const QA_RELEVANCE_THRESHOLD = 0.08;

export function isQaRelevant(question: string, answer: string, threshold: number = QA_RELEVANCE_THRESHOLD): boolean {
  return computeQaRelevance(question, answer) >= threshold;
}

/** BP-CONTAMINATION-QUARANTINE (this pass, Bishop-verified defect in plow_mc_answerer.ts's
 *  writeComputeMethodEblet, fixed the same pass this predicate ships in): 28 pre-existing
 *  class:'component' records in the live substrate leaked BOTH the live benchmark question text
 *  AND an explicit answer letter inside `reasoning` -- an answer key wearing a reusable-tool
 *  eblet's class. class:'component' is the class eligible for injection during scored runs
 *  (tools ON, answer-keys OFF) -- if one of these had ever been injected, a voter would be
 *  handed the question's own answer letter disguised as a "method", silently invalidating the
 *  score (memorization, not derivation).
 *
 *  Rule 66 / vault-sacrosanct forbid deleting or rewriting existing substrate records, so this is
 *  quarantine BY NON-RETRIEVAL ONLY -- same pattern as the isQaRelevant relevance filter inside
 *  queryVerifiedEbletsTopical below (BP135 Yoke #34): the record stays on disk, byte-identical,
 *  forever; every retrieval path that can surface a class:'component' eblet must run this
 *  predicate and drop a match, never mutate the file.
 *
 *  Shape of a contaminated record (both conditions required, so this can never false-positive on
 *  a legitimate general tool eblet):
 *    - provenance starts with 'plow_mc_answerer:compute_method:' -- the exact writer that leaked.
 *      formula_eblet_mint.ts's clean 'deterministic_compute:formula:' records do NOT match this
 *      prefix, so they can never be caught here.
 *    - reasoning contains the literal substring 'question="' -- the exact leak marker the old
 *      writer emitted (`reasoning: \`question="${researchQuery...}"\``). The FIXED writer (this
 *      same pass) never emits that substring in any field, so no new write can ever match this
 *      predicate -- it exists purely to quarantine the 28 legacy records already on disk. */
const CONTAMINATED_COMPUTE_METHOD_PROVENANCE_PREFIX = 'plow_mc_answerer:compute_method:';

export function isContaminatedComputeMethodEblet(
  entry: Pick<VerifiedEbletEntry, 'provenance' | 'reasoning'>,
): boolean {
  const provenance = entry.provenance ?? '';
  const reasoning = entry.reasoning ?? '';
  return (
    provenance.startsWith(CONTAMINATED_COMPUTE_METHOD_PROVENANCE_PREFIX) &&
    reasoning.includes('question="')
  );
}

/** KN-BP141-5 FIX 1 (retrieval-side contamination: the answer-key pool). Bishop-measured against
 *  the LIVE substrate (C:\Users\Administrator\AppData\Roaming\amplify-computer\substrate\
 *  verified_eblets.jsonl, 1,671 records at measurement time, growing): 694 records carry
 *  provenance 'answer_coroner:ensemble_candidate' -- the RGBY ledger, written correctly by the
 *  Coroner's all-candidate persist (see answer_coroner.ts's persistEnsembleCandidateFactVerdicts,
 *  NOT modified by this ticket). Of those 694, `answer` is a bare option letter in 694/694 and the
 *  question text is benchmark-shaped in 407/694. isContaminatedComputeMethodEblet() above is a
 *  PROVENANCE-PREFIX patch for 28 specific legacy plow_mc_answerer:compute_method: rows -- its own
 *  prefix check never matches 'answer_coroner:ensemble_candidate:...', so all 694 sail through it
 *  untouched (proven this ticket by running the real compiled predicate over the real file: 0
 *  caught). isContaminatedComputeMethodEblet is a patch for those 28 rows, not a general rule.
 *
 *  THIS predicate is SHAPE-based, not provenance-based -- deliberately, per the ticket's own
 *  instruction: "provenance must not appear in this predicate at all." A record that LOOKS like an
 *  answer key (a bare MC option letter for `answer`, paired with a benchmark-shaped `question`) is
 *  an answer key regardless of who wrote it -- the same shape written by a different, future,
 *  not-yet-invented writer must be caught here too, without this file needing to learn that
 *  writer's provenance string first.
 *
 *  Two independent conditions, BOTH required:
 *    1. `answer` is a bare MC option letter: either just the letter with optional trailing
 *       punctuation ("B", "B)", "B.", "B:"), or an explicit "answer: B" framing.
 *    2. `question` is benchmark-shaped: longer than 60 chars AND (contains a literal "?" OR
 *       matches a curated MC-stem phrase, e.g. "which of the following" / "what is").
 *
 *  MEASURED THIS TICKET against the real live substrate (scratchpad/verify_kn_bp141_5_*.js):
 *  407 of the 694 ensemble_candidate rows clear BOTH conditions (matches the WHY section's own
 *  pre-measured 407/694 figure exactly). The remaining 287 have a bare-letter answer but a
 *  question that is fill-in-the-blank/imperative-shaped ("_____ is an important element...",
 *  "Calculate the density of...", "Indicate whether...") with no "?" and no curated stem phrase --
 *  an HONEST gap in this shape predicate, not a bug: those 287 rows are not caught by FIX 1 alone
 *  (FIX 2's factVerdict gate, and FIX 3's write-time routing, are the other two independent layers
 *  that also apply to them; see this ticket's own report for the combined effect).
 *
 *  Rule 66 / vault-sacrosanct: quarantine BY NON-RETRIEVAL ONLY, exactly like
 *  isContaminatedComputeMethodEblet's own convention -- the record stays on disk, byte-identical,
 *  forever; every retrieval path that can surface it must run this predicate and drop a match,
 *  never mutate the file. */
const BARE_LETTER_ANSWER_RE = /^\s*[A-J]\s*[).:]?\s*$/;
const FRAMED_LETTER_ANSWER_RE = /^\s*answer\s*[:=]?\s*[A-J]\b/i;
const BENCHMARK_STEM_PHRASE_RE = /\b(which of the following|what is|what are|what was|what were)\b/i;
const BENCHMARK_QUESTION_MIN_LENGTH = 60;

function isBareOptionLetterAnswer(answer: string): boolean {
  return BARE_LETTER_ANSWER_RE.test(answer) || FRAMED_LETTER_ANSWER_RE.test(answer);
}

function isBenchmarkShapedQuestion(question: string): boolean {
  if (question.length <= BENCHMARK_QUESTION_MIN_LENGTH) return false;
  return question.includes('?') || BENCHMARK_STEM_PHRASE_RE.test(question);
}

export function isAnswerKeyShapedEblet(
  entry: Pick<VerifiedEbletEntry, 'answer' | 'question'>,
): boolean {
  return isBareOptionLetterAnswer(entry.answer ?? '') && isBenchmarkShapedQuestion(entry.question ?? '');
}

/** KN-BP141-5 FIX 2 (retrieval-side contamination: the answer-key pool), INDEPENDENT of FIX 1
 *  above -- measured and gated separately, per the ticket's own instruction, so each layer's
 *  effect can be attributed on its own.
 *
 *  VerifiedEbletEntry.factVerdict (BP140 Yoke) exists and is populated on the live substrate
 *  (measured this ticket: G 427 / R 150 / O 117, all 694 on the same 694 answer_coroner:
 *  ensemble_candidate rows FIX 1 targets by shape) and NOTHING reads it before this fix -- no
 *  retrieval path in this file inspects factVerdict at all prior to KN-BP141-5.
 *
 *  Per the ticket: a record whose factVerdict is 'R' (wrong), 'O' (conflicting), 'B'
 *  (undetermined), or 'Y' (unknowable) must never be served as supporting context, whatever its
 *  class or provenance -- only 'G' (grounded) may be served. This function implements exactly
 *  that admissibility rule for records that DO carry a factVerdict.
 *
 *  ABSENCE HANDLING (same "absence != inference" convention this field's own doc comment already
 *  states, and the same convention isContaminatedComputeMethodEblet/isAnswerKeyShapedEblet use for
 *  their own optional fields): factVerdict is absent on every eblet written before the BP140 Yoke
 *  and on every non-scored production Ask (no ground truth to grade against) -- that is the vast
 *  majority of the substrate (1,103 of 1,797 records measured this ticket carry no factVerdict at
 *  all). An absent factVerdict means "no RGBY verdict recorded," never "R/O/B/Y" and never "G" by
 *  inference -- this function returns false (admissible, i.e. NOT inadmissible) for an absent
 *  factVerdict, so the 1,103 ordinary unlabeled records already legitimately served as context
 *  keep being served exactly as before. Only a record that EXPLICITLY carries a non-'G' letter is
 *  newly withheld by this fix. */
export function isFactVerdictInadmissibleForRetrieval(
  entry: Pick<VerifiedEbletEntry, 'factVerdict'>,
): boolean {
  return entry.factVerdict !== undefined && entry.factVerdict !== 'G';
}

/** KN-BP142-3 FIX 3 (retrieval-side contamination: the canonical_plow scrape pool), INDEPENDENT of
 *  FIX 1 and FIX 2 above -- neither of those two catches this shape, by design and confirmed by
 *  running both real compiled predicates over the real live substrate this ticket (0 caught):
 *    - isAnswerKeyShapedEblet requires a BARE MC OPTION LETTER answer ("B", "B)", "answer: B"). The
 *      canonical_plow rows carry a 100-600 char scraped passage as `answer`, never a bare letter, so
 *      they never match isBareOptionLetterAnswer and sail through FIX 1 untouched.
 *    - isFactVerdictInadmissibleForRetrieval withholds only a record whose factVerdict is an
 *      EXPLICIT non-'G' letter. The canonical_plow rows carry no factVerdict field at all (absent,
 *      same as ~61% of the substrate per FIX 2's own doc comment), so this returns "admissible" by
 *      its own documented absence-handling design. Sails through FIX 2 untouched too.
 *
 *  Bishop measured (this ticket, KN-BP142-3 Phase 0) 225 records in the live substrate carrying
 *  provenance 'canonical_plow:<source>:<domain>:bp083' -- a benchmark-topic scrape pass that stored
 *  a domain-labeled STEM as `question` and an unrelated scraped passage as `answer`, e.g.:
 *    question: "biology | Which of the following would most likely provide examples of mitotic cell
 *               divisi | wikipedia"
 *    answer:   "In many legal jurisdictions, the manner of death is a determination, typically made
 *               by the coroner, medical examiner, police..." (600 chars, topic: forensic pathology,
 *               NOT mitosis -- completely unrelated to the question stem)
 *  `question` here is not a question at all -- it is a `domain | truncated-stem | source` LABEL the
 *  scraper used to file the passage under, and `answer` is the scraped passage itself, never an
 *  actual answer to the stem. All 225 carry `verified: true` and are, right now, fully admissible to
 *  every retrieval path in this file -- a voter or RAG context builder that received one of these
 *  would be handed an authoritative-looking "verified" fact about coroners for a mitosis question.
 *
 *  THIS predicate is SHAPE-based on the `question` field's own delimiter structure, exactly like
 *  isAnswerKeyShapedEblet's own design principle above ("a record that LOOKS like an X is an X
 *  regardless of who wrote it") -- it does not read `provenance` at all, so a future writer that
 *  independently produces the same `domain | stem | source` label shape is caught here too, without
 *  this file needing to learn that writer's provenance string first.
 *
 *  Two independent conditions, BOTH required:
 *    1. `question` has the `domain | stem | source` label shape: split on the FIRST and LAST pipe
 *       character (there may be more than one pipe inside the middle stem itself, e.g. a
 *       "Statement 1 | ..." MMLU-Pro logic stem) -- the text before the first pipe is a short,
 *       lowercase, letters/spaces/underscore-only LABEL (<=26 chars, e.g. "biology", "computer
 *       science"), and the text after the last pipe is a short, lowercase, letters-only SOURCE
 *       token (3-20 chars, e.g. "wikipedia", "arxiv", "openalex", "wikidata", "pubmed"). A genuine
 *       question never has this exact leading-label / trailing-single-word shape.
 *    2. `answer` is a long passage: >=100 chars after trimming -- well below the family's own
 *       measured median (~600 chars, truncated at 600) but above anything a normal bare-fact or
 *       short-answer eblet would carry, kept as a second independent corroborating signal so this
 *       predicate never fires on condition 1 alone.
 *
 *  MEASURED THIS TICKET against the real live substrate (scratchpad/kn_bp142_3_predicate_design_
 *  check.js and verify_kn_bp142_3_phase0_predicate_fprate.js): exactly 225 of 1,816 raw records
 *  match BOTH conditions, and all 225 of the 225 are canonical_plow provenance -- 0 false positives
 *  (nothing else in the whole store, contaminated or clean, matches this shape) and 0 false
 *  negatives (every one of the 225 Bishop identified by provenance is also caught by this shape
 *  check, independently, without ever reading provenance). See that verification script's own
 *  output in the KN-BP142-3 Yoke return for the full funnel breakdown.
 *
 *  Rule 66 / vault-sacrosanct: quarantine BY NON-RETRIEVAL ONLY, exactly like the two predicates
 *  above -- the record stays on disk, byte-identical, forever; every retrieval path that can
 *  surface it must run this predicate and drop a match, never mutate the file. */
const SCRAPE_LABEL_DOMAIN_RE = /^[a-z][a-z _]{1,25}$/;
const SCRAPE_LABEL_SOURCE_RE = /^[a-z]{3,20}$/;
const SCRAPE_LABEL_PASSAGE_MIN_LENGTH = 100;

function isScrapeLabelShapedQuestion(question: string): boolean {
  const idxFirst = question.indexOf('|');
  const idxLast = question.lastIndexOf('|');
  if (idxFirst === -1 || idxFirst === idxLast) return false;
  const domainPart = question.slice(0, idxFirst).trim();
  const sourcePart = question.slice(idxLast + 1).trim();
  return SCRAPE_LABEL_DOMAIN_RE.test(domainPart) && SCRAPE_LABEL_SOURCE_RE.test(sourcePart);
}

function isLongScrapedPassageAnswer(answer: string): boolean {
  return answer.trim().length >= SCRAPE_LABEL_PASSAGE_MIN_LENGTH;
}

export function isCanonicalPlowScrapeShapedEblet(
  entry: Pick<VerifiedEbletEntry, 'question' | 'answer'>,
): boolean {
  return isScrapeLabelShapedQuestion(entry.question ?? '') && isLongScrapedPassageAnswer(entry.answer ?? '');
}

/** KN-BP142-6 FIX 4 (retrieval-side contamination: the empty-body bare-letter pool),
 *  INDEPENDENT of FIX 1, FIX 2, and FIX 3 above.
 *
 *  Founder ran the scored 20 (run 034), the Aristotle "incontinence" question (correct key E)
 *  was answered A. Bishop traced the live substrate and found the CORRECT answer twice
 *  (verified, provenance plow_mc_answerer:solved:user_perplexity:...) and also, verified: true,
 *  a record whose entire answer is "A) " (a bare option letter followed by a closing
 *  parenthesis and nothing else), provenance plow_mc_answerer:solved:wikipedia:
 *  https://en.wikipedia.org/wiki/Female_ejaculation, an article with no topical relationship to
 *  Aristotle or incontinence.
 *
 *  KN-BP142-6 traced isAnswerKeyShapedEblet() against this exact record (real record, real
 *  compiled predicate, see this ticket's own Yoke return for the full sub-check trace) and
 *  found the miss is NOT in isBareOptionLetterAnswer (it correctly returns true for "A) ",
 *  the BARE_LETTER_ANSWER_RE regex already tolerates the trailing whitespace). The miss is in
 *  isBenchmarkShapedQuestion: the Aristotle question is only 49 characters (the gate requires
 *  > 60), ends in ":" rather than "?", and matches none of the curated MC-stem phrases, so it
 *  fails the benchmark-shape gate and the record sails through FIX 1 untouched even though its
 *  answer is the purest possible instance of a bare option letter.
 *
 *  KN-BP142-6 measured (this ticket, scratchpad/kn_bp142_6_task4_predicate_design_check.js)
 *  against the full live substrate (1,816 records at measurement time): exactly 4 records
 *  match "option letter, REQUIRED closing punctuation, then nothing else" and all 4 are this
 *  same shape, all provenance plow_mc_answerer:solved:wikipedia:..., all verified: true. Manual
 *  audit of all 4 (not a sample) confirms every one is a genuinely empty answer body, none
 *  carries any substantive content this predicate would be wrongly discarding.
 *
 *  This predicate is DELIBERATELY INDEPENDENT of question shape, unlike isAnswerKeyShapedEblet
 *  above, because an answer whose entire content, once the option-letter prefix is stripped, is
 *  empty can never be a useful, substantive answer to serve as context, regardless of what the
 *  paired question looks like. That is exactly the gap Task 1 located: pairing the bare-letter
 *  check with a question-shape gate is what let a 49-character, non-"?" question slip an
 *  empty-body answer through FIX 1 whole.
 *
 *  This predicate is DELIBERATELY NARROWER than isBareOptionLetterAnswer's own BARE_LETTER_
 *  ANSWER_RE (which makes the closing punctuation OPTIONAL, so a bare "E" or "A" with no
 *  punctuation at all also matches it): the closing punctuation mark is REQUIRED here.
 *  answer_coroner:ensemble_candidate rows (694 of them per FIX 1's own doc comment) store a
 *  bare letter with NO trailing punctuation by design (their own admissibility path is
 *  isFactVerdictInadmissibleForRetrieval, not this one) -- requiring the punctuation mark is
 *  what keeps this predicate from colliding with that unrelated, intentionally-designed family.
 *  Measured this ticket: BARE_LETTER_ANSWER_RE alone matches 698 of 1,816 records; requiring
 *  the punctuation mark narrows that to exactly the same 4 records found above, a 694-record
 *  reduction that is entirely the un-punctuated ensemble_candidate shape, correctly excluded.
 *
 *  Rule 66 / vault-sacrosanct: quarantine BY NON-RETRIEVAL ONLY, exactly like the three
 *  predicates above -- the record stays on disk, byte-identical, forever; every retrieval path
 *  that can surface it must run this predicate and drop a match, never mutate the file. */
const EMPTY_BODY_OPTION_LETTER_ANSWER_RE = /^\s*[A-J][).:]\s*$/;

function isEmptyBodyOptionLetterAnswer(answer: string): boolean {
  return EMPTY_BODY_OPTION_LETTER_ANSWER_RE.test(answer);
}

export function isEmptyAnswerBodyShapedEblet(
  entry: Pick<VerifiedEbletEntry, 'answer'>,
): boolean {
  return isEmptyBodyOptionLetterAnswer(entry.answer ?? '');
}

/** BP136 Yoke (answer-cache v1): question<->question similarity, DISTINCT from
 *  computeQaRelevance() above (which scores question-vs-ANSWER overlap). This scores how
 *  similar a NEW question is to a STORED question, for the answer-cache serve-verbatim
 *  decision. Same token-overlap-ratio convention as computeQaRelevance for explainability,
 *  but symmetric-ish input (two questions rather than a question and its answer). */
export function computeQuestionSimilarity(questionA: string, questionB: string): number {
  const tokensA = tokenizeQuestion(questionA);
  if (tokensA.length === 0) return 0;
  const tokensBSet = new Set(tokenizeQuestion(questionB));
  if (tokensBSet.size === 0) return 0;
  const overlap = tokensA.filter((t) => tokensBSet.has(t)).length;
  return overlap / tokensA.length;
}

/** BP136 Yoke v1: minimum question<->question similarity to serve a stored answer VERBATIM
 *  (skip the model call entirely) when the question is not an exact string match. Set well
 *  above QA_RELEVANCE_THRESHOLD (0.08) on purpose -- that gate only screens out gross Q/A
 *  mismatch (topical relevance), while serving verbatim requires the NEW question to be a
 *  near-restatement of the STORED question, not merely on the same topic. 0.6 means at least
 *  60% of the new question's meaningful (stopword-filtered) tokens must already appear in the
 *  stored question -- conservative by design for v1 (semantic/embedding matching is v2; this
 *  keyword-overlap gate is deliberately strict to avoid serving a wrong-but-similar-looking
 *  cached answer at $0 with high confidence framing).
 */
export const SERVE_VERBATIM_THRESHOLD = 0.6;

/** BP136 Yoke (hotfix, post-Euler-mismatch incident): symmetric variant of
 *  computeQuestionSimilarity, used ONLY by the SIMILARITY branch of the verbatim-serve gate
 *  in ai_dispatch_ipc.ts (the EXACT-question-match branch is untouched and stays safe/as-is).
 *
 *  Incident: "What's the quadratic formula?" (3 stopword-filtered tokens: "s", "quadratic",
 *  "formula" -- the "s" is the tokenized remnant of the "'s" contraction) was served the
 *  starter_chocolate eblet for "What is Euler's formula for complex exponentials?" because
 *  directional computeQuestionSimilarity(newQuestion, storedQuestion) = overlap / |tokensA|
 *  only checks what fraction of the NEW question's tokens appear in the STORED question. Two
 *  of the new question's three tokens ("s" and "formula") happen to occur in Euler's question
 *  too -- neither is the discriminating word ("quadratic" is absent from Euler's question) --
 *  giving 2/3 = 0.667, which clears SERVE_VERBATIM_THRESHOLD even though the two questions are
 *  not restatements of each other. Bolting isQaRelevant(query, storedAnswer) onto this branch
 *  does not fix it either (verified empirically): the Euler answer literally contains the word
 *  "formula", so isQaRelevant(query, eulerAnswer) = 0.667 >= 0.08 (passes when it must fail),
 *  while isQaRelevant(query, quadraticAnswer) = 0 < 0.08 (fails when it must pass -- the
 *  correct quadratic-formula answer never spells out the word "quadratic" or "formula", it
 *  just states the formula symbolically). Answer-text token overlap is unreliable in BOTH
 *  directions for short factual answers, so it is not used as the guard.
 *
 *  Fix: require the similarity to hold in BOTH directions (new-question-explained-by-stored
 *  AND stored-question-explained-by-new), i.e. the two questions must be near-restatements of
 *  EACH OTHER, not merely share a couple of one-way tokens. min(sim(A,B), sim(B,A)) is never
 *  larger than the old directional sim(A,B) alone, so this can only make the gate MORE
 *  conservative -- no case that used to fail the gate can newly pass it.
 */
export function computeQuestionSimilaritySymmetric(questionA: string, questionB: string): number {
  return Math.min(
    computeQuestionSimilarity(questionA, questionB),
    computeQuestionSimilarity(questionB, questionA),
  );
}

/** BP137 Yoke (Semantic Match Durable): minimum cosine-similarity (approximated via 128-bit
 *  SimHash Hamming distance, see hammingToSimilarity() in semantic_soccerball.ts) between a
 *  new query's embedding and a stored question's embedding to serve that stored answer
 *  VERBATIM. Tuned empirically THIS SESSION with real nomic-embed-text embeddings against the
 *  live store's own Twain/Rand pair (measured with a throwaway script, both real cosine AND
 *  this exact SimHash approximation -- see the BP137 report for the full table):
 *    Highest observed FALSE-POSITIVE risk (frame-collision, different subject):
 *      "What was Einstein's birthday?"      vs stored "...Mark Twain's Birthday?"  -> simhashSim=0.741
 *      "What was Mark Twain's birthday?"    vs stored "...Ayn Rand's birthday?"    -> simhashSim=0.596
 *      stored Twain question                vs stored Rand question                -> simhashSim=0.596
 *    Lowest observed TRUE-POSITIVE (genuine paraphrase, same subject) worth serving:
 *      "When was Ayn Rand born?"            vs stored "...Ayn Rand's birthday?"    -> simhashSim=0.893
 *      "When was Mark Twains' bday?"        vs stored "...Mark Twain's Birthday?"  -> simhashSim=0.904
 *  0.85 sits in the gap between the worst false-positive (0.741) and the weakest desired true-
 *  positive (0.893) with margin on both sides. A typo'd "quadratic formula" paraphrase scored
 *  0.773 (below 0.85) -- an honest UNDER-serve, not a false-serve; ship-safety mandate is
 *  "under-serve is fine, false-serve is not," so this stays conservative rather than closing
 *  that gap by lowering further. NOTE (honesty-mandate finding): 128 SimHash bits (the spec's
 *  required code width) quantizes real cosine similarity coarsely enough that this margin,
 *  while real, is not huge -- a future increase in bit-count (still additive/optional) would
 *  sharpen it further; this is disclosed plainly in the BP137 report rather than glossed over. */
export const SEMANTIC_SERVE_THRESHOLD = 0.85;

/** BP137 Yoke (Semantic Match Durable), STEP 2: scan every entry (not just a token-ranked
 *  top-K) for the nearest stored question by semantic (SimHash) code, since a semantically
 *  correct match may share zero discriminating tokens with a token-ranked candidate list.
 *  Skips entries with no persisted semanticCode (every eblet written before this Yoke, or any
 *  write made while the mode/embeddings were unavailable) and class:'component' fragments
 *  (never served verbatim, same rule as the exact-match path in ai_dispatch_ipc.ts). Returns
 *  null if no entry has a usable semantic code -- callers must fall back to the token path. */
export function findNearestBySemanticCode(
  queryCode: string,
  entries: VerifiedEbletEntry[],
): { entry: VerifiedEbletEntry; similarity: number } | null {
  let best: { entry: VerifiedEbletEntry; similarity: number } | null = null;
  for (const entry of entries) {
    if (!entry.semanticCode) continue;
    if (entry.class === 'component') continue;
    const similarity = computeSemanticSimilarity(queryCode, entry.semanticCode);
    if (!best || similarity > best.similarity) best = { entry, similarity };
  }
  return best;
}

/**
 * Module-scoped telemetry counters for the HOT retrieve path.
 * Callers (ai_dispatch_ipc) increment these after each queryVerifiedEblets() call.
 * Exported as a mutable object so cross-module increments are type-safe.
 */
export const substrateCounters = { hotHits: 0, coldCalls: 0 };

// BP-birthday-collision fix (post-Ayn-Rand-mismatch incident): 'did'/'does'/'do' were the last
// common English interrogative/auxiliary words missing from this list (what/how/why/when/where/
// who/is/are/was/were were already covered by the Euler-mismatch Yoke above). Any "What did X
// do?"/"Does X do Y?"/"Do X and Y..." question template previously let did/does/do inflate
// token-overlap between two questions that differ only in the discriminating subject noun (the
// same template-collision class as the quadratic/Euler incident, just a different frame verb).
// Verified empirically against the live 501-entry verified_eblets.jsonl store: adding these three
// words changes zero exact-match or genuine-paraphrase outcomes (0 newly-missed, 0 newly-wrong)
// while closing this residual frame-word gap -- see gadget script results in the BP136 session log.
const VERIFIED_STOP_WORDS = new Set([
  'the', 'a', 'is', 'what', 'how', 'why', 'when', 'where', 'who', 'of',
  'in', 'on', 'at', 'to', 'for', 'with', 'an', 'and', 'or', 'not', 'be',
  'are', 'was', 'were', 'did', 'does', 'do',
]);

// BP136 Yoke (post-Euler-mismatch ranking hotfix, part 2): drop bare single-character tokens.
// Punctuation is replaced with spaces before splitting, so possessive/contraction apostrophes
// ("Ohm's", "What's", "isn't") leave behind a lone "s"/"t" fragment with no semantic content.
// Empirically (against the real 280-entry verified_eblets store) that fragment was enough to
// falsely clear SERVE_VERBATIM_THRESHOLD once candidate selection started ranking primarily on
// question<->question similarity: e.g. "What's tort law?" -> tokens [s, tort, law] symmetric-
// matched "What is Ohm's law?" -> tokens [ohm, s, law] at 2/3 = 0.667 (>= 0.6), a real wrong
// serve that did not exist under the old Q+A-frequency ranking (which buried the collision
// behind unrelated corpus-frequency winners). Filtering length<=1 tokens removes the "s"/"t"
// noise from every token-overlap consumer in this file (question-similarity ranking here AND
// computeQaRelevance/isQaRelevant) -- verified empirically against all 280 real stored Q/A pairs
// that this produces ZERO isQaRelevant flips at the existing QA_RELEVANCE_THRESHOLD (0.08), so
// the write-time verification gate (canonical_pipeline.ts runScribe) is unaffected in practice.
function tokenizeQuestion(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .filter((w) => !VERIFIED_STOP_WORDS.has(w));
}

/**
 * Query the persistent verified eblet store ({userData}/substrate/verified_eblets.jsonl)
 * for Q&A pairs relevant to the user's question.
 *
 * Strategy:
 *   1. Exact match: question.trim().toLowerCase() === eblet.question.trim().toLowerCase()
 *      → return immediately as sole top hit.
 *   2. Keyword fallback: score each eblet by token overlap on (question + answer),
 *      return top-K sorted by score desc, ties broken by recency (timestamp desc).
 *
 * Edge cases:
 *   - Missing file → [] (fresh install, no crash)
 *   - Malformed JSONL line → skip + warn, continue
 *   - Empty/stopword-only question → []
 *
 * Note: VerifiedEbletEntry.sha256 stores sha256(question+answer); a direct question-string
 * equality check is used for exact-match because sha256(question) ≠ sha256(question+answer).
 */
export async function queryVerifiedEblets(question: string, topK = 3): Promise<VerifiedEbletEntry[]> {
  // D-BP148-007/KNIGHT/M1/seg-e7c1: resolveUserDataPath() replaces the old unguarded
  // `app.getPath('userData')` -- byte-identical when real Electron is present.
  const ebletFile = resolve(resolveUserDataPath(), 'substrate', 'verified_eblets.jsonl');
  if (!existsSync(ebletFile)) return [];

  let raw: string;
  try {
    raw = readFileSync(ebletFile, 'utf-8');
  } catch {
    return [];
  }

  const rawEntries: VerifiedEbletEntry[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as Partial<VerifiedEbletEntry>;
      if (parsed.question && parsed.answer && parsed.sha256 && parsed.verified === true) {
        rawEntries.push(parsed as VerifiedEbletEntry);
      }
    } catch {
      console.warn('[SubstrateHOT] Malformed verified_eblets line skipped:', trimmed.slice(0, 80));
    }
  }

  // BP-CONTAMINATION-QUARANTINE: drop (never delete/rewrite -- Rule 66) any class:'component'
  // record from plow_mc_answerer.ts's legacy writeComputeMethodEblet() that leaked a question +
  // answer letter into `reasoning`. See isContaminatedComputeMethodEblet()'s doc comment above.
  const afterComputeMethodQuarantine = rawEntries.filter((e) => !isContaminatedComputeMethodEblet(e));
  const quarantinedCount = rawEntries.length - afterComputeMethodQuarantine.length;
  if (quarantinedCount > 0) {
    console.log(
      `[EbletStore] queryVerifiedEblets: excluded ${quarantinedCount} contaminated ` +
      `compute-method component eblet(s) from retrieval (Rule 66 quarantine-by-non-retrieval, not deleted)`,
    );
  }

  // KN-BP141-5 FIX 1: shape-based answer-key quarantine, independent of the provenance-prefix
  // check above -- see isAnswerKeyShapedEblet()'s doc comment for the full empirical basis.
  const afterAnswerKeyShapeQuarantine = afterComputeMethodQuarantine.filter((e) => !isAnswerKeyShapedEblet(e));
  const answerKeyShapedQuarantinedCount = afterComputeMethodQuarantine.length - afterAnswerKeyShapeQuarantine.length;
  if (answerKeyShapedQuarantinedCount > 0) {
    console.log(
      `[EbletStore] queryVerifiedEblets: excluded ${answerKeyShapedQuarantinedCount} answer-key-shaped ` +
      `eblet(s) from retrieval (KN-BP141-5 FIX 1, Rule 66 quarantine-by-non-retrieval, not deleted)`,
    );
  }

  // KN-BP141-5 FIX 2: factVerdict admissibility gate, independent of FIX 1 above -- see
  // isFactVerdictInadmissibleForRetrieval()'s doc comment. Only a record whose factVerdict is
  // explicitly a non-'G' letter is withheld here; an absent factVerdict is unaffected.
  const afterFactVerdictQuarantine = afterAnswerKeyShapeQuarantine.filter((e) => !isFactVerdictInadmissibleForRetrieval(e));
  const factVerdictQuarantinedCount = afterAnswerKeyShapeQuarantine.length - afterFactVerdictQuarantine.length;
  if (factVerdictQuarantinedCount > 0) {
    console.log(
      `[EbletStore] queryVerifiedEblets: excluded ${factVerdictQuarantinedCount} eblet(s) with an ` +
      `inadmissible factVerdict (R/O/B/Y) from retrieval (KN-BP141-5 FIX 2, Rule 66 quarantine-by-` +
      `non-retrieval, not deleted)`,
    );
  }

  // KN-BP142-3 FIX 3: canonical_plow scrape-shaped quarantine, independent of FIX 1 and FIX 2
  // above -- see isCanonicalPlowScrapeShapedEblet()'s doc comment for the full empirical basis.
  const afterScrapeShapeQuarantine = afterFactVerdictQuarantine.filter((e) => !isCanonicalPlowScrapeShapedEblet(e));
  const scrapeShapedQuarantinedCount = afterFactVerdictQuarantine.length - afterScrapeShapeQuarantine.length;
  if (scrapeShapedQuarantinedCount > 0) {
    console.log(
      `[EbletStore] queryVerifiedEblets: excluded ${scrapeShapedQuarantinedCount} canonical_plow ` +
      `scrape-shaped eblet(s) from retrieval (KN-BP142-3 FIX 3, Rule 66 quarantine-by-non-retrieval, ` +
      `not deleted)`,
    );
  }

  // KN-BP142-6 FIX 4: empty-body bare-letter quarantine, independent of FIX 1, FIX 2, and FIX 3
  // above -- see isEmptyAnswerBodyShapedEblet()'s doc comment for the full empirical basis. This
  // is deliberately question-shape-independent, plugging the exact gap KN-BP142-6 traced in FIX
  // 1 (a short, non-"?" question let a bare-letter, empty-body answer sail through).
  const entries = afterScrapeShapeQuarantine.filter((e) => !isEmptyAnswerBodyShapedEblet(e));
  const emptyBodyQuarantinedCount = afterScrapeShapeQuarantine.length - entries.length;
  if (emptyBodyQuarantinedCount > 0) {
    console.log(
      `[EbletStore] queryVerifiedEblets: excluded ${emptyBodyQuarantinedCount} empty-answer-body ` +
      `bare-letter eblet(s) from retrieval (KN-BP142-6 FIX 4, Rule 66 quarantine-by-non-retrieval, ` +
      `not deleted)`,
    );
  }

  if (entries.length === 0) return [];

  // Exact match on question text (case-insensitive, trimmed).
  // BP-component-serve-fix: a component fragment can be stamped with the SAME exact question
  // text as its parent whole_answer (csia_research.ts writes both under the user's literal
  // question -- see runCsiaConcordanceGateAndStore ~line 197 vs ~line 222). Gather ALL exact
  // matches (not just the first) and put non-component entries first, so the verbatim-serve
  // gate downstream (ai_dispatch_ipc.ts, which reads verifiedHits[0]-equivalent) never inherits
  // a component purely because of file-write order. RAG callers still see every exact match --
  // this only reorders, it never drops a hit.
  const qNorm = question.trim().toLowerCase();
  const exactMatches = entries.filter((e) => e.question.trim().toLowerCase() === qNorm);
  if (exactMatches.length > 0) {
    // D-BP148-015/BISHOP/serve-path-ranking: file order is not a quality signal. The audit
    // (AUDIT_BP148_IS_THE_ANSWER_CACHE_SAFE_TO_SERVE.md) showed this exact branch returning
    // candidates in raw file/write order with no ranking at all, so ai_dispatch_ipc.ts's
    // `verifiedHits.find(...)` (the verbatim-serve gate) always got the OLDEST surviving
    // answer -- two arithmetic-verified cases (a density question, a Kepler binary-star
    // period question) showed a wrong single-authority guess served while a later, Tier-1
    // deterministic-compute answer for the identical question sat unreached in the same file.
    //
    // Fix: re-derive rootedness at READ time using THIS FILE's own rooting_rule.ts imports --
    // the SAME classifyCorroborationTier()/isRooted() pair computeHonestVerification() already
    // uses at write time (below) and plow_mc_answerer.ts's own production-readback path
    // already uses ad hoc at read time (computeHonestVerification(readbackExact), guarded
    // "never trust the stored verified flag alone"). Never a new/parallel notion of "rooted" --
    // a record's PAST verified:true is no longer trusted verbatim for serving; only what its
    // own corroboration/provenance can prove TODAY is. This is a retrieval decision only --
    // Rule 66, nothing on disk is touched, an unrooted record just stops being servABLE.
    const tierOf = (e: VerifiedEbletEntry) => classifyCorroborationTier(e.corroboration, e.provenance);
    const rankedAll = exactMatches.map((e) => ({ entry: e, tier: tierOf(e), rooted: isRooted(tierOf(e)) }));
    const rooted = rankedAll.filter((r) => r.rooted);

    if (rooted.length === 0) {
      console.log(
        `[EbletStore] queryVerifiedEblets: ${exactMatches.length} exact-question-text match(es) ` +
        `found but 0 pass isRooted() at read time -- abstaining, not serving (D-BP148-015)`,
      );
      return [];
    }

    // Ranking order within the rooted pool, most-preferred first -- justified per-step:
    //  1. Higher tier: 'proven' (Tier 1, a solver computed it) before 'ground-truth-checked'
    //     (Tier 2, checked against a known key). Tier 3/unrooted never reach here (filtered
    //     above) -- isRooted()/classifyCorroborationTier() are the ONLY notion of rootedness
    //     used, imported verbatim from rooting_rule.ts, never reinvented.
    //  2. A real verdict ('verified' or a ground-truth 'correct') over an absent/'unverified'
    //     one -- separates a record that has actually been through the honest write-time gate
    //     (computeHonestVerification()) from a legacy row whose verified:true predates that
    //     gate (the audit's 432-record/60%-of-servable-pool finding: verified:true paired with
    //     verdict undefined/'unverified', a pairing the current write path cannot produce).
    //  3. An EXPLICIT corroboration:'deterministic_compute' flag (compute_sidecar.ts's own
    //     signal, set by the component that actually ran the computation) over a record that
    //     only reached Tier 1 via classifyCorroborationTier()'s provenance-STRING fallback
    //     (for callers that never set the field) -- the explicit flag is the more direct proof.
    //  4. Most recent write wins the final tie -- newer writes are more likely to reflect the
    //     current (fixed) write-time gate than an old one.
    const tierRank = (t: ReturnType<typeof tierOf>) => (t === 'proven' ? 0 : t === 'ground-truth-checked' ? 1 : 2);
    const hasRealVerdict = (e: VerifiedEbletEntry) => e.verdict === 'verified' || e.verdict === 'correct';
    const verdictRank = (e: VerifiedEbletEntry) => (hasRealVerdict(e) ? 0 : 1);
    const explicitComputeRank = (e: VerifiedEbletEntry) => (e.corroboration === 'deterministic_compute' ? 0 : 1);
    type RankKey = [number, number, number];
    const rankKey = (r: (typeof rooted)[number]): RankKey => [
      tierRank(r.tier),
      verdictRank(r.entry),
      explicitComputeRank(r.entry),
    ];
    const compareKey = (a: RankKey, b: RankKey) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

    // Contradiction handling (D-BP148-015 step 3): group the ROOTED, non-component candidates
    // by normalized answer text. class:'component' entries are excluded from this grouping --
    // they are supporting-fact fragments stamped under the SAME question text as their parent
    // whole_answer (csia_research.ts), so grouping them in would manufacture a false
    // contradiction between an answer and its own component. A single distinct rooted answer
    // -> no contradiction, rank and serve normally. 2+ distinct rooted answers to the identical
    // question -> compare each answer-group's BEST rank key; serve the strictly-best group, or
    // ABSTAIN (return []) if the top two groups tie on rank -- "prefer the better-rooted one; if
    // indistinguishable, abstain and let the normal dispatch path run" (an honest cache miss is
    // always cheaper than a confident wrong answer).
    const rootedNonComponent = rooted.filter((r) => r.entry.class !== 'component');
    const rootedComponent = rooted.filter((r) => r.entry.class === 'component');

    if (rootedNonComponent.length === 0) {
      // Only rooted components survived (no rooted whole-answer for this exact question) --
      // return them for RAG/topical use; ai_dispatch_ipc.ts's topVerifiedHit already filters
      // class !== 'component', so the verbatim-serve gate naturally sees no candidate here too.
      return rootedComponent
        .slice()
        .sort((a, b) => b.entry.timestamp - a.entry.timestamp)
        .map((r) => r.entry);
    }

    const byAnswer = new Map<string, typeof rootedNonComponent>();
    for (const r of rootedNonComponent) {
      const key = r.entry.answer.trim().toLowerCase();
      const list = byAnswer.get(key) ?? [];
      list.push(r);
      byAnswer.set(key, list);
    }
    // ADDITIONAL tiebreak, beyond the four ranking criteria above -- disclosed explicitly, not
    // slipped in silently. Measured against the real store (D-BP148-015 verification): the
    // density acceptance case has 4 disagreeing ROOTED answer-groups that tie EXACTLY on tier/
    // verdict/explicit-corroboration (14 records compute "C) .60 g/cc" via three independent
    // deterministic sub-methods -- density/bare_value/answer_coroner -- vs 2 records for "A) 1.00
    // g/cc" and 1 for "B) .70 g/cc", both from a single, internally-inconsistent sub-method,
    // `deterministic_compute:unit_aware`, that also produced "C" most of the time). Without this
    // tiebreak the ranking above would call that indistinguishable and abstain -- defensible, but
    // it throws away real signal: EVERY one of these 18 records is INDEPENDENTLY Tier-1 rooted on
    // its own terms already (unlike KN-BP142-6's Tier-3 "concordant" failure mode this ticket must
    // not reintroduce -- that was N models merely agreeing, none independently proven; this is N
    // ALREADY-proven derivations, via different compute sub-methods, being counted only to break a
    // tie between them, never to grant rootedness itself). More independently-rooted derivations
    // landing on the same answer is stronger evidence than fewer; ties (equal group size) still
    // abstain below, so a genuine even split is never guessed. Placed after the four literal
    // criteria and before recency: it is a claim about how many independent proofs exist, which
    // outranks which single proof happens to be newest.
    const groups = Array.from(byAnswer.values()).map((list) => {
      const best = list.reduce((b, r) => (compareKey(rankKey(r), rankKey(b)) < 0 ? r : b));
      const groupKey: [number, number, number, number] = [...rankKey(best), -list.length];
      return { list, groupKey };
    });
    const compareGroupKey = (a: [number, number, number, number], b: [number, number, number, number]) =>
      a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3];
    groups.sort((a, b) => compareGroupKey(a.groupKey, b.groupKey));

    if (groups.length > 1 && compareGroupKey(groups[0].groupKey, groups[1].groupKey) === 0) {
      console.log(
        `[EbletStore] queryVerifiedEblets: ${groups.length} mutually contradictory rooted ` +
        `answer(s) for one exact question, indistinguishable by rank AND independent-derivation ` +
        `count -- abstaining, not serving (D-BP148-015)`,
      );
      return [];
    }

    const winningGroup = groups[0].list
      .slice()
      .sort((a, b) => compareKey(rankKey(a), rankKey(b)) || b.entry.timestamp - a.entry.timestamp)
      .map((r) => r.entry);
    const winningComponents = rootedComponent
      .slice()
      .sort((a, b) => b.entry.timestamp - a.entry.timestamp)
      .map((r) => r.entry);
    return [...winningGroup, ...winningComponents];
  }

  // Keyword fallback
  const qTokens = tokenizeQuestion(question);
  if (qTokens.length === 0) return [];
  const qSet = new Set(qTokens);

  // BP136 Yoke (post-Euler-mismatch ranking hotfix): candidates are now ranked PRIMARILY by
  // question<->question similarity (computeQuestionSimilaritySymmetric -- same measure the
  // verbatim-serve gate in ai_dispatch_ipc.ts already uses), not by Q+A token frequency.
  //
  // Root cause this closes: the old primary key (legacyScore below) counts token hits across
  // `e.question + ' ' + e.answer`, so an eblet whose ANSWER happens to restate query words
  // (e.g. Euler's-formula's answer literally contains the word "formula") could outrank the
  // actually-matching eblet whose answer is purely symbolic and never spells out the question's
  // words (e.g. the quadratic-formula eblet's answer is just "x = (-b +/- sqrt(b^2-4ac)) / 2a",
  // it never writes "quadratic" or "formula"). That made the correct eblet lose the topK=1 slot
  // entirely, so the symmetric serve gate (which only ever inspects verifiedHits[0]) had nothing
  // correct left to serve and the query fell through to a full regeneration instead of a $0
  // verbatim serve. Ranking on question-to-question similarity first fixes the ordering at the
  // source: the eblet whose QUESTION best restates the query is top-1, independent of how its
  // answer happens to be phrased.
  //
  // legacyScore is kept as a secondary tiebreaker (and as the sole ordering key for the
  // qSim===0 bucket) so topical/keyword-only RAG context assembly -- queries that don't
  // restate any stored question but do share vocabulary with a stored answer -- keeps
  // returning the same kind of loosely-related hits it always did; this change can only
  // reorder/promote candidates that already had a nonzero legacyScore or qSim, it does not
  // introduce new candidates and does not touch the exact-match path above.
  const scored = entries.map((e) => {
    const corpus = tokenizeQuestion(e.question + ' ' + e.answer);
    let legacyScore = 0;
    for (const tok of qSet) {
      legacyScore += corpus.filter((t) => t === tok).length;
    }
    const qSim = computeQuestionSimilaritySymmetric(question, e.question);
    return { entry: e, qSim, legacyScore };
  });

  // BP-component-serve-fix: class:'component' fragments must never outrank a class:'whole_answer'
  // (or classless/legacy, treated as whole_answer per the VerifiedEbletEntry.class doc comment)
  // record purely on legacyScore token density. Inserted directly AFTER qSim (before legacyScore)
  // because the diagnosed incident is exactly a qSim TIE (1.0 vs 1.0) between a whole_answer and
  // its own component: csia_research.ts stamps both with the identical question text, so qSim
  // alone cannot separate them and legacyScore used to decide the tie, favoring whichever answer
  // text happens to repeat the query's words more densely (e.g. a book-title component's dense
  // "Ayn"/"Rand" repetition beating the whole_answer's short birthdate). This tiebreaker only
  // ever fires on a qSim tie -- it cannot demote a component that is a strictly BETTER qSim match
  // than every whole_answer candidate, so topical RAG-only relevance (queryVerifiedEblets' other
  // consumer) is unaffected, and it never touches the exact-match path above.
  const componentRank = (e: VerifiedEbletEntry) => (e.class === 'component' ? 1 : 0);
  return scored
    .filter((r) => r.qSim > 0 || r.legacyScore > 0)
    .sort(
      (a, b) =>
        b.qSim - a.qSim ||
        componentRank(a.entry) - componentRank(b.entry) ||
        b.legacyScore - a.legacyScore ||
        b.entry.timestamp - a.entry.timestamp,
    )
    .slice(0, topK)
    .map((r) => r.entry);
}

/**
 * Query verified eblets for TOPICAL context ONLY — excludes exact-match hits.
 *
 * This is the mesh-test-safe retrieval path. The exact-match path (question ===
 * stored question) returns the direct answer and constitutes answer-key cheating
 * for the mesh test. This function only returns keyword-scored hits from RELATED
 * questions in the substrate, providing genuine domain-knowledge lift without
 * short-circuiting the MCQ task.
 *
 * BP083 SEG-2/3: Use this function — never queryVerifiedEblets — in B/C conditions.
 */
export async function queryVerifiedEbletsTopical(
  question: string,
  domain: string,
  topK = 3,
): Promise<VerifiedEbletEntry[]> {
  // D-BP148-007/KNIGHT/M1/seg-e7c1: resolveUserDataPath() replaces the old unguarded
  // `app.getPath('userData')` -- byte-identical when real Electron is present.
  const ebletFile = resolve(resolveUserDataPath(), 'substrate', 'verified_eblets.jsonl');
  if (!existsSync(ebletFile)) return [];

  let raw: string;
  try {
    raw = readFileSync(ebletFile, 'utf-8');
  } catch {
    return [];
  }

  const rawEntries: VerifiedEbletEntry[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as Partial<VerifiedEbletEntry>;
      if (parsed.question && parsed.answer && parsed.sha256 && parsed.verified === true) {
        rawEntries.push(parsed as VerifiedEbletEntry);
      }
    } catch { /* skip malformed */ }
  }

  // BP-CONTAMINATION-QUARANTINE: this is the scored-run (tools ON, answer-keys OFF) injection
  // path -- see this function's own docstring ("BP083 SEG-2/3: Use this function ... in B/C
  // conditions"). Drop (never delete/rewrite -- Rule 66) any class:'component' record from
  // plow_mc_answerer.ts's legacy writeComputeMethodEblet() that leaked a question + answer
  // letter into `reasoning`; injecting one of these during a scored run would be handing a
  // voter the current question's own answer key disguised as a reusable tool. See
  // isContaminatedComputeMethodEblet()'s doc comment above for the exact match shape.
  const afterComputeMethodQuarantine = rawEntries.filter((e) => !isContaminatedComputeMethodEblet(e));
  const quarantinedComputeMethodCount = rawEntries.length - afterComputeMethodQuarantine.length;
  if (quarantinedComputeMethodCount > 0) {
    console.log(
      `[EbletStore] queryVerifiedEbletsTopical: excluded ${quarantinedComputeMethodCount} ` +
      `contaminated compute-method component eblet(s) from retrieval for domain=${domain} ` +
      `(Rule 66 quarantine-by-non-retrieval, not deleted)`,
    );
  }

  // KN-BP141-5 FIX 1: shape-based answer-key quarantine, independent of the provenance-prefix
  // check above -- see isAnswerKeyShapedEblet()'s doc comment for the full empirical basis. This
  // is exactly the retrieval path (mesh-test B/C conditions, tools ON, answer-keys OFF) the
  // ticket's WHY section describes the loop leaking through.
  const afterAnswerKeyShapeQuarantine = afterComputeMethodQuarantine.filter((e) => !isAnswerKeyShapedEblet(e));
  const answerKeyShapedQuarantinedCount = afterComputeMethodQuarantine.length - afterAnswerKeyShapeQuarantine.length;
  if (answerKeyShapedQuarantinedCount > 0) {
    console.log(
      `[EbletStore] queryVerifiedEbletsTopical: excluded ${answerKeyShapedQuarantinedCount} ` +
      `answer-key-shaped eblet(s) from retrieval for domain=${domain} (KN-BP141-5 FIX 1, Rule 66 ` +
      `quarantine-by-non-retrieval, not deleted)`,
    );
  }

  // KN-BP141-5 FIX 2: factVerdict admissibility gate, independent of FIX 1 above -- see
  // isFactVerdictInadmissibleForRetrieval()'s doc comment. Only a record whose factVerdict is
  // explicitly a non-'G' letter is withheld here; an absent factVerdict is unaffected.
  const afterFactVerdictQuarantine = afterAnswerKeyShapeQuarantine.filter((e) => !isFactVerdictInadmissibleForRetrieval(e));
  const factVerdictQuarantinedCount = afterAnswerKeyShapeQuarantine.length - afterFactVerdictQuarantine.length;
  if (factVerdictQuarantinedCount > 0) {
    console.log(
      `[EbletStore] queryVerifiedEbletsTopical: excluded ${factVerdictQuarantinedCount} eblet(s) ` +
      `with an inadmissible factVerdict (R/O/B/Y) from retrieval for domain=${domain} (KN-BP141-5 ` +
      `FIX 2, Rule 66 quarantine-by-non-retrieval, not deleted)`,
    );
  }

  // KN-BP142-3 FIX 3: canonical_plow scrape-shaped quarantine, independent of FIX 1 and FIX 2
  // above -- this is exactly the retrieval path (mesh-test B/C conditions, tools ON, answer-keys
  // OFF) that could hand a voter a scraped, topically-unrelated passage disguised as a "verified"
  // fact for the current question's domain. See isCanonicalPlowScrapeShapedEblet()'s doc comment.
  const afterScrapeShapeQuarantine = afterFactVerdictQuarantine.filter((e) => !isCanonicalPlowScrapeShapedEblet(e));
  const scrapeShapedQuarantinedCount = afterFactVerdictQuarantine.length - afterScrapeShapeQuarantine.length;
  if (scrapeShapedQuarantinedCount > 0) {
    console.log(
      `[EbletStore] queryVerifiedEbletsTopical: excluded ${scrapeShapedQuarantinedCount} ` +
      `canonical_plow scrape-shaped eblet(s) from retrieval for domain=${domain} (KN-BP142-3 FIX 3, ` +
      `Rule 66 quarantine-by-non-retrieval, not deleted)`,
    );
  }

  // KN-BP142-6 FIX 4: empty-body bare-letter quarantine, independent of FIX 1, FIX 2, and FIX 3
  // above -- this is exactly the retrieval path (mesh-test B/C conditions, tools ON, answer-keys
  // OFF) the ticket traced the Aristotle "incontinence" miss through. See
  // isEmptyAnswerBodyShapedEblet()'s doc comment for the full empirical basis.
  const entries = afterScrapeShapeQuarantine.filter((e) => !isEmptyAnswerBodyShapedEblet(e));
  const emptyBodyQuarantinedCount = afterScrapeShapeQuarantine.length - entries.length;
  if (emptyBodyQuarantinedCount > 0) {
    console.log(
      `[EbletStore] queryVerifiedEbletsTopical: excluded ${emptyBodyQuarantinedCount} ` +
      `empty-answer-body bare-letter eblet(s) from retrieval for domain=${domain} (KN-BP142-6 ` +
      `FIX 4, Rule 66 quarantine-by-non-retrieval, not deleted)`,
    );
  }

  if (entries.length === 0) return [];

  const qNorm = question.trim().toLowerCase();

  // Keyword scoring: domain name + question words (excluding exact match)
  const qTokens = tokenizeQuestion(`${domain} ${question}`);
  if (qTokens.length === 0) return [];
  const qSet = new Set(qTokens);

  const scored = entries
    .filter((e) => e.question.trim().toLowerCase() !== qNorm) // exclude exact match
    .map((e) => {
      // Score on stored question text + answer (topical similarity, not exact answer lookup)
      const corpus = tokenizeQuestion(e.question + ' ' + e.provenance);
      let score = 0;
      for (const tok of qSet) {
        score += corpus.filter((t) => t === tok).length;
      }
      return { entry: e, score };
    })
    .filter((r) => r.score > 0);

  // BP135 Yoke #34 (0.9.7) RELEVANCE FILTER AT READ: per the BP135 audit finding that ~47% of
  // existing canonical_plow eblets are Q/A-mismatched junk (written before the write-time gate
  // in canonical_pipeline.ts's runScribe existed), drop any hit whose STORED ANSWER doesn't
  // actually address the CURRENT question, even though it scored on keyword overlap with the
  // stored question text. Rule 66: this NEVER deletes/rewrites the underlying eblet -- it is
  // quarantine-by-non-retrieval only. The same line stays on disk and can still surface for a
  // different query that legitimately finds it relevant.
  const relevanceChecked = scored.filter((r) => isQaRelevant(question, r.entry.answer));
  const droppedForRelevance = scored.length - relevanceChecked.length;
  if (droppedForRelevance > 0) {
    console.log(
      `[EbletStore] queryVerifiedEbletsTopical: filtered ${droppedForRelevance} irrelevant ` +
      `hit(s) for domain=${domain} (Rule 66 quarantine-by-non-retrieval, not deleted)`,
    );
  }

  return relevanceChecked
    .sort((a, b) => b.score - a.score || b.entry.timestamp - a.entry.timestamp)
    .slice(0, topK)
    .map((r) => r.entry);
}

// ─── SEG-A2 BP081: Substrate stats query ──────────────────────────────────────

export interface SubstrateStats {
  totalEblets: number;
  verifiedCount: number;
  lastWriteTimestamp: number | null;
  topDomains: Array<{ domain: string; count: number; lastWrite: number }>;
  recentWrites: Array<{ questionExcerpt: string; provenanceSource: string; timestamp: number }>;
  growthTrend: Array<{ date: string; count: number }>;
  quarantinedCount: number;
  error?: string;
}

let _statsCache: { data: SubstrateStats; cachedAt: number } | null = null;
const STATS_CACHE_TTL_MS = 10_000;

/**
 * Query the verified eblet store and return aggregate substrate stats.
 * Results are cached for 10 seconds (non-blocking; synchronous after first read).
 * On empty store: returns zeros/empty arrays. On malformed store: returns best-effort + error field.
 */
export function queryStats(): SubstrateStats {
  const now = Date.now();
  if (_statsCache && now - _statsCache.cachedAt < STATS_CACHE_TTL_MS) {
    return _statsCache.data;
  }

  // D-BP148-007/KNIGHT/M1/seg-e7c1: resolveUserDataPath() replaces the old unguarded
  // `app.getPath('userData')` -- byte-identical when real Electron is present.
  const ebletFile = resolve(resolveUserDataPath(), 'substrate', 'verified_eblets.jsonl');

  const empty = (): SubstrateStats => ({
    totalEblets: 0,
    verifiedCount: 0,
    lastWriteTimestamp: null,
    topDomains: [],
    recentWrites: [],
    growthTrend: buildEmptyGrowthTrend(),
    quarantinedCount: 0,
  });

  if (!existsSync(ebletFile)) {
    const result = empty();
    _statsCache = { data: result, cachedAt: now };
    return result;
  }

  let raw: string;
  try {
    raw = readFileSync(ebletFile, 'utf-8');
  } catch (e) {
    const result: SubstrateStats = { ...empty(), error: String(e) };
    _statsCache = { data: result, cachedAt: now };
    return result;
  }

  const entries: VerifiedEbletEntry[] = [];
  let parseErrorCount = 0;
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as Partial<VerifiedEbletEntry>;
      if (parsed.question && parsed.answer && parsed.sha256 && parsed.verified === true) {
        entries.push(parsed as VerifiedEbletEntry);
      }
    } catch {
      parseErrorCount++;
    }
  }

  const totalEblets = entries.length;
  const verifiedCount = entries.filter((e) => e.verified === true).length;
  const lastWriteTimestamp = entries.length > 0
    ? Math.max(...entries.map((e) => e.timestamp))
    : null;

  // Top domains extracted from provenance (format: type:<name>:<session> or bare string)
  const domainMap = new Map<string, { count: number; lastWrite: number }>();
  for (const e of entries) {
    const domain = e.provenance.split(':')[0] || 'unknown';
    const existing = domainMap.get(domain);
    if (!existing) {
      domainMap.set(domain, { count: 1, lastWrite: e.timestamp });
    } else {
      existing.count++;
      if (e.timestamp > existing.lastWrite) existing.lastWrite = e.timestamp;
    }
  }
  const topDomains = Array.from(domainMap.entries())
    .map(([domain, { count, lastWrite }]) => ({ domain, count, lastWrite }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const recentWrites = [...entries]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10)
    .map((e) => ({
      questionExcerpt: e.question.slice(0, 80),
      provenanceSource: e.provenance,
      timestamp: e.timestamp,
    }));

  const growthTrend = buildGrowthTrend(entries);

  const result: SubstrateStats = {
    totalEblets,
    verifiedCount,
    lastWriteTimestamp,
    topDomains,
    recentWrites,
    growthTrend,
    quarantinedCount: 0,
    ...(parseErrorCount > 0 ? { error: `${parseErrorCount} malformed line(s) skipped` } : {}),
  };

  _statsCache = { data: result, cachedAt: now };
  return result;
}

function buildEmptyGrowthTrend(): Array<{ date: string; count: number }> {
  return buildGrowthTrend([]);
}

function buildGrowthTrend(entries: VerifiedEbletEntry[]): Array<{ date: string; count: number }> {
  const DAY_MS = 86_400_000;
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const basTs = base.getTime();

  const dayCounts = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(basTs - i * DAY_MS);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    dayCounts.set(key, 0);
  }
  for (const e of entries) {
    const d = new Date(e.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (dayCounts.has(key)) {
      dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
    }
  }
  return Array.from(dayCounts.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ─── A-2 BP081 v0.1.59.1: Startup integrity check ────────────────────────────

export interface StartupIntegrityResult {
  totalLines: number;
  quarantined: number;
  malformedLines: number;
  verifiedFalseLines: number;
}

/**
 * Run on app startup: scan verified_eblets.jsonl, quarantine STRUCTURALLY MALFORMED lines
 * (missing question/answer/sha256/timestamp), rewrite clean file atomically.
 * BP131 honesty fix: no longer quarantines an honest verified:false/verdict:'unverified' line --
 * see the verified!==true branch below for why that would delete legitimate data.
 * Non-fatal: always returns a result even if checks partially fail.
 */
export async function runStartupIntegrityCheck(): Promise<StartupIntegrityResult> {
  // D-BP148-007/KNIGHT/M1/seg-e7c1: resolveUserDataPath() replaces the old unguarded
  // `app.getPath('userData')` -- byte-identical when real Electron is present.
  const ebletDir = resolve(resolveUserDataPath(), 'substrate');
  const ebletFile = resolve(ebletDir, 'verified_eblets.jsonl');
  const quarantineFile = resolve(ebletDir, 'eblets.quarantine.jsonl');

  const result: StartupIntegrityResult = {
    totalLines: 0,
    quarantined: 0,
    malformedLines: 0,
    verifiedFalseLines: 0,
  };

  if (!existsSync(ebletFile)) {
    return result;
  }

  let raw: string;
  try {
    raw = readFileSync(ebletFile, 'utf-8');
  } catch (e) {
    console.error('[EbletStore] Startup check: could not read eblet file:', e);
    return result;
  }

  const cleanLines: string[] = [];
  const quarantineLines: string[] = [];

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    result.totalLines++;

    let parsed: Partial<VerifiedEbletEntry> | null = null;
    try {
      parsed = JSON.parse(trimmed) as Partial<VerifiedEbletEntry>;
    } catch {
      result.malformedLines++;
      result.quarantined++;
      quarantineLines.push(trimmed);
      continue;
    }

    // BP131 honesty fix: this used to quarantine (delete from the live store) every line where
    // verified !== true. That was fine back when verified:true was the ONLY value any writer
    // could produce (a literal-`true`-typed field) -- verified:false could only mean corruption.
    // Now that writeVerifiedEblet() honestly writes verified:false/verdict:'unverified' for a
    // real (but uncorroborated) solved-answer write, verified:false is an INTENDED, legitimate
    // state, not corruption -- quarantining it on every app startup would silently delete the
    // very "honest false" records this Yoke exists to produce, violating the "provenance/sha256/
    // source must survive regardless of verdict" requirement. Quarantine is now reserved for
    // STRUCTURALLY malformed lines only (missing a required field); an honest verified:false
    // survivor is counted (verifiedFalseLines, kept for telemetry/back-compat naming) but kept.
    const structurallyValid = !!(parsed.question && parsed.answer && parsed.sha256 && parsed.timestamp);
    if (!structurallyValid) {
      result.malformedLines++;
      result.quarantined++;
      quarantineLines.push(trimmed);
      continue;
    }
    if (parsed.verified !== true) {
      result.verifiedFalseLines++;
    }

    cleanLines.push(trimmed);
  }

  // Write quarantine file (append-only)
  if (quarantineLines.length > 0) {
    try {
      if (!existsSync(ebletDir)) mkdirSync(ebletDir, { recursive: true });
      appendFileSync(quarantineFile, quarantineLines.join('\n') + '\n', 'utf-8');
    } catch (e) {
      console.error('[EbletStore] Startup check: could not write quarantine file:', e);
    }
  }

  // Atomically rewrite clean file
  try {
    const tmpFile = resolve(ebletDir, 'verified_eblets.jsonl.tmp');
    writeFileSync(tmpFile, cleanLines.join('\n') + (cleanLines.length > 0 ? '\n' : ''), 'utf-8');
    renameSync(tmpFile, ebletFile);
  } catch (e) {
    console.error('[EbletStore] Startup check: could not rewrite clean file:', e);
  }

  console.log(
    `[EbletStore] Startup check: ${result.totalLines} total, ${result.quarantined} quarantined, ` +
    `${result.malformedLines} malformed, ${result.verifiedFalseLines} verified=false survivors`,
  );

  return result;
}

/**
 * BP131 honesty fix, made structural by KN-BP142-10 (the Rooting Rule, canon BP142): the SINGLE
 * centralized predicate that decides whether a write to verified_eblets.jsonl may honestly carry
 * `verified:true`/`verdict:'verified'`.
 *
 * Root cause this closes: VerifiedEbletEntry.verified used to be typed as the literal `true`,
 * which structurally FORCED every one of this file's ~20 call sites (plow_mc_answerer.ts,
 * ai_dispatch_ipc.ts, csia_research.ts, etc.) to write `verified: true` just to satisfy the
 * compiler -- including call sites with zero genuine verification signal, e.g.
 * plow_mc_answerer.ts's writeAndReplicateSolvedAnswer(), which writes `verified: true` (a
 * lone accepted browser-authority letter, sometimes a SINGLE uncorroborated single_perplexity
 * accept) alongside an honestly-set `verdict: 'unverified'` in the SAME object literal. That
 * contradiction (verified:true + verdict:'unverified' in one write) is the exact shape
 * empirically observed across the live 662-row substrate (100% verified:true, 0% verdict:
 * 'verified', 139 explicit verdict:'unverified' -- e.g. the Scaccio "E) $106.00" wrong answer
 * stored wearing verified:true). writeVerifiedEblet() now calls this helper and OVERRIDES
 * whatever the caller passed for `verified`/`verdict`, so the two fields can never again
 * disagree and `verified:true` can never again mean "an LLM/authority guessed once."
 *
 * KN-BP142-10 SECOND HONESTY FIX, layered on top of the first: BP131's own three accept classes
 * included `corroboration: 'concordant'` (2+ independent authorities/voters merely agreeing) as
 * equal in weight to a deterministic-compute proof or an explicit Coroner ground-truth
 * ratification. Founder's BP142 Rooting Rule canon settles this was never true equality --
 * "variance is not independence, and the independence unit is the DERIVATION PATH, never the
 * model or the machine. Two models are not two witnesses." KN-BP142-6 measured the live cost of
 * treating them as equal: nine verified:true records for one MMLU-Pro question, none correct,
 * four minted via a legitimate two-model concordant accept AFTER this file's own honesty fix had
 * already landed. `verified:true` now REQUIRES the write to be ROOTED (see rooting_rule.ts) --
 * Tier 1 (proven) or Tier 2 (ground-truth-checked) only. `corroboration: 'concordant'` still
 * classifies to a real, named tier (Tier 3, concordant) but that tier is deliberately excluded
 * from the ROOTED set, so it now resolves to the same honest verified:false/verdict:'unverified'
 * outcome as an uncorroborated single_authority guess -- it is NOT rejected outright (the write
 * still happens, the answer is still stored and still retrievable, per canon's "Tier 3 still
 * answers" clause), it simply does not ROOT.
 *
 * Tier classification (delegated to rooting_rule.ts's classifyCorroborationTier(), the ONE
 * shared source of truth also consulted by liana_cycle_runner.ts's mintLedgerMark() write gate):
 *   TIER 1 proven               : provenance contains 'deterministic_compute' or
 *                                  'schedule_amortization', OR corroboration ===
 *                                  'deterministic_compute'.
 *   TIER 2 ground-truth-checked : corroboration === 'coroner_verified' (answer_coroner.ts's own
 *                                  explicit ratification).
 *   TIER 3 concordant           : corroboration === 'concordant'. Classified, never rejected as
 *                                  malformed, but NEVER ROOTS (see rooting_rule.ts's isRooted()).
 *   unclassified (null)         : corroboration === 'coroner_unverified' (an explicit Coroner
 *                                  REJECTION, wins over a provenance-string deterministic match),
 *                                  or 'single_authority'/'authority_extracted_compute'/undefined
 *                                  with no deterministic provenance signal. Fail-closed by
 *                                  design: absence of a qualifying signal must never be silently
 *                                  upgraded to verified:true. BP-COMPUTE-HONEST-DEMOTE:
 *                                  'authority_extracted_compute' stays unclassified deliberately
 *                                  -- it is a real checked computation with no independent
 *                                  grounding (see that literal's own doc comment above), so
 *                                  callers must ALSO make sure `provenance` never contains the
 *                                  literal substring 'deterministic_compute' for such a write.
 *
 * ORTHOGONAL AXIS carve-out (unchanged by KN-BP142-10): `verdict` also carries a second,
 * pre-existing, unrelated meaning -- 'correct'/'wrong' ground-truth grading against a TEST'S OWN
 * answer key (mesh-test/benchmark mode only, e.g. plow_mc_answerer.ts's verdictForLedger
 * comparing the plow's chosenLetter to testModeCorrectAnswerLetter). That is a real,
 * already-truthful signal -- substrate_toggle.ts's formatHit() reads verdict==='wrong' to inject
 * a live "KNOWN-WRONG (avoid)" marker for future voters, a genuine in-use feature. It must not be
 * clobbered by this predicate: if the caller supplies `verdict: 'correct'` or `'wrong'`, that
 * value is preserved VERBATIM (never overwritten to 'verified'/'unverified') -- `verified` is
 * still independently computed from the ROOTED tier check above, since "matched the test's
 * answer key" and "was ROOTED via proven/ground-truth-checked corroboration" are different
 * claims (a lucky single-authority guess that happens to match the key is still not ROOTED). The
 * one invariant that must always hold is the task's actual concern -- verified:true never paired
 * with an honestly-unconfirmed verdict; 'correct'/'wrong' are grading outcomes, not
 * "unconfirmed", so this carve-out cannot reintroduce that bug.
 */
export function computeHonestVerification(
  entry: Pick<VerifiedEbletEntry, 'provenance' | 'corroboration' | 'verdict'>,
): { verified: boolean; verdict: 'correct' | 'wrong' | 'verified' | 'unverified' } {
  const tier = classifyCorroborationTier(entry.corroboration, entry.provenance);
  const verified = isRooted(tier);

  // KN-BP142-10 verification (b): the ROOTED trace, verbatim, at the exact write path where
  // `verified` is decided. Grep this file for "ROOTED" to find it.
  console.log(
    `[EbletStore] computeHonestVerification: corroboration=${entry.corroboration ?? '(none)'} ` +
    `tier=${tier ?? '(unclassified)'} -> ${rootedTraceLabel(tier)} (verified=${verified})`,
  );

  // Ground-truth grading carve-out (see doc comment above): preserve a real 'correct'/'wrong'
  // grade verbatim; only ever synthesize 'verified'/'unverified' when the caller did NOT supply
  // one of those two ground-truth values.
  if (entry.verdict === 'correct' || entry.verdict === 'wrong') {
    return { verified, verdict: entry.verdict };
  }
  return { verified, verdict: verified ? 'verified' : 'unverified' };
}

/** KN-BP141-5 FIX 3 (separate the ledger from the answering pool). answer_coroner.ts's
 *  persistEnsembleCandidateFactVerdicts (NOT touched by this ticket) calls writeVerifiedEblet
 *  below with provenance `answer_coroner:ensemble_candidate:${candidate.authority}` for EVERY
 *  ensemble candidate, winner and losers alike -- the RGBY ledger the per-capability Banyan
 *  Metric needs. Ledger-writing and answering-pool-writing are two jobs that used to share one
 *  file (verified_eblets.jsonl), and that sharing is the root cause this ticket's WHY section
 *  identifies: a faithful log of wrong answers sat in the SAME pool retrieval reads as context.
 *
 *  This prefix check is deliberately the mirror image of isAnswerKeyShapedEblet's own design
 *  choice: FIX 1/2 (read-side quarantine) are explicitly shape-based, NOT provenance-based,
 *  because a retrieval-time filter must catch this shape from any writer, known or future. FIX 3
 *  is write-side ROUTING, and here provenance is exactly the right signal: this file already
 *  knows, by construction, that answer_coroner.ts is the ONLY writer of this specific provenance
 *  family, so routing on it is precise (no shape-based false-positive risk at write time) and
 *  keeps the RGBY-ledger-vs-answering-pool split legible by provenance alone, independent of
 *  whatever shape a given candidate's answer/question happen to have.
 *
 *  Rule 66: existing answer_coroner:ensemble_candidate rows already on disk in
 *  verified_eblets.jsonl are NOT moved, rewritten, or deleted by this fix -- they stay exactly
 *  where they are, byte-identical, and stay quarantined by non-retrieval per FIX 1 and FIX 2
 *  above. Only NEW writes matching this prefix are routed to the sibling ledger file below. */
const RGBY_LEDGER_WRITE_PROVENANCE_PREFIX = 'answer_coroner:ensemble_candidate';

export function isRgbyLedgerWrite(entry: Pick<VerifiedEbletEntry, 'provenance'>): boolean {
  return (entry.provenance ?? '').startsWith(RGBY_LEDGER_WRITE_PROVENANCE_PREFIX);
}

/** KN-BP141-6 FIX B (dedupe on write, with multiplicity preserved). Bishop-measured against the
 *  live substrate: distinct Q+A pairs vs. total rows showed 74% duplication (measured this ticket
 *  as part of the same file; see this ticket's own verification numbers for the current figures),
 *  333 questions carrying exactly one distinct answer, 34 carrying 2+ (genuine conflicting
 *  claims), worst case 11 stored rows collapsing to 6 mutually exclusive answers for one density
 *  question.
 *
 *  DEDUPE KEY: sha256(question + '\0' + answer) -- deliberately DISTINCT from the `sha256` field
 *  already persisted on every VerifiedEbletEntry (that field is sha256(question+answer), NO
 *  separator, and is left completely unchanged here for backward compatibility with every
 *  existing reader/writer that already depends on its exact formula as "write confirmation" and
 *  as the content-address readers compare against). Two different hashes for two different jobs:
 *  the persisted `sha256` field identifies WHAT was written; this dedupeKey identifies WHETHER a
 *  (question, answer) pair has already been recorded, independent of provenance/reasoning/
 *  timestamp/etc, so two different authorities independently landing on the identical letter for
 *  the identical question collapse to the same key (this is exactly the shape the 1,327-row
 *  redundancy measurement counted). The NUL separator guards against a theoretical
 *  concatenation collision between two different (question, answer) splits that happen to share
 *  the same combined string with no separator (belt-and-suspenders; not observed as a real
 *  incident in this substrate, but free to add and explicitly requested by the ticket). */
export function computeDedupeKey(question: string, answer: string): string {
  return createHash('sha256').update(question + '\0' + answer).digest('hex');
}

/** KN-BP141-6 FIX B write-time half: scans `filePath` (whichever file the current write is about
 *  to land in -- verified_eblets.jsonl OR the KN-BP141-5 FIX 3 sibling rgby_ledger.jsonl,
 *  dedupe is applied per-destination-file, not cross-file) for any EXISTING row whose own
 *  (question, answer) pair hashes to the same dedupeKey. Read-only; never mutates the file it
 *  scans. Malformed lines and lines missing question/answer are skipped, consistent with every
 *  other reader in this file. */
function fileHasDedupeKeyCollision(filePath: string, dedupeKey: string): boolean {
  if (!existsSync(filePath)) return false;
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch {
    return false;
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let parsed: Partial<VerifiedEbletEntry> | null = null;
    try {
      parsed = JSON.parse(trimmed) as Partial<VerifiedEbletEntry>;
    } catch {
      continue;
    }
    if (!parsed.question || parsed.answer === undefined) continue;
    if (computeDedupeKey(parsed.question, parsed.answer) === dedupeKey) return true;
  }
  return false;
}

/** KN-BP141-6 FIX B read-side half: "READ-side collapse" per the ticket's own phrasing. Groups
 *  `entries` by computeDedupeKey(question, answer) and returns ONE CollapsedVerifiedEbletEntry
 *  per distinct (question, answer) pair, with `encounterCount` = the number of PHYSICAL rows that
 *  share that key (multiplicity preserved as a count, never discarded) and `lastSeen`/`firstSeen`
 *  = the max/min timestamp among them. `representative` is the single physical row with the
 *  latest timestamp (the most-recently-reaffirmed version of this fact), used for reasoning/
 *  provenance/factVerdict/etc. display -- the OTHER physical rows sharing the key are NOT
 *  discarded from disk (Rule 66), only folded into this one logical view for callers that want
 *  the collapsed shape.
 *
 *  Rule 66 / never-rewrite discipline: this is a PURE function over an already-loaded array --
 *  it never reads or writes any file itself, and produces a new in-memory view only. No existing
 *  row is touched. Distinct questions that carry 2+ DIFFERENT answers are NEVER collapsed into
 *  each other by this function -- the dedupe key includes the answer, so conflicting claims
 *  ("B" vs "F" for the same question) always land in separate CollapsedVerifiedEbletEntry groups,
 *  each with its own encounterCount; this is what preserves genuine disagreement as signal
 *  instead of erasing it (see this ticket's verification (c)).
 *
 *  Deliberately NOT wired into queryVerifiedEblets/queryVerifiedEbletsTopical's existing return
 *  shape in this commit -- those functions' callers (ai_dispatch_ipc.ts etc.) expect
 *  VerifiedEbletEntry[], not a collapsed shape, and changing that return contract is a separate,
 *  larger change this ticket does not ask for. This function is exported as a standalone utility,
 *  callable by any future caller (or a verification script) that wants the collapsed view. */
export interface CollapsedVerifiedEbletEntry {
  question: string;
  answer: string;
  dedupeKey: string;
  encounterCount: number;
  firstSeen: number;
  lastSeen: number;
  representative: VerifiedEbletEntry;
}

export function collapseVerifiedEbletsByAnswer(entries: VerifiedEbletEntry[]): CollapsedVerifiedEbletEntry[] {
  const groups = new Map<string, VerifiedEbletEntry[]>();
  for (const e of entries) {
    const key = computeDedupeKey(e.question, e.answer);
    const existing = groups.get(key);
    if (existing) {
      existing.push(e);
    } else {
      groups.set(key, [e]);
    }
  }

  const collapsed: CollapsedVerifiedEbletEntry[] = [];
  for (const [dedupeKey, group] of groups) {
    let firstSeen = group[0].timestamp;
    let lastSeen = group[0].timestamp;
    let representative = group[0];
    for (const g of group) {
      if (g.timestamp < firstSeen) firstSeen = g.timestamp;
      if (g.timestamp > lastSeen) {
        lastSeen = g.timestamp;
        representative = g;
      }
    }
    collapsed.push({
      question: representative.question,
      answer: representative.answer,
      dedupeKey,
      encounterCount: group.length,
      firstSeen,
      lastSeen,
      representative,
    });
  }
  return collapsed;
}

/**
 * Append a plow-accepted eblet to the persistent store.
 *
 * Store location: {userData}/substrate/verified_eblets.jsonl (append-only JSONL) for ordinary
 * writes. KN-BP141-5 FIX 3: an ensemble-candidate RGBY-ledger write (provenance prefix
 * 'answer_coroner:ensemble_candidate', see isRgbyLedgerWrite() above) is routed instead to the
 * SIBLING file {userData}/substrate/rgby_ledger.jsonl -- same directory, same append-only JSONL
 * shape, same computeHonestVerification()/sha256 derivation below, just a different destination
 * file that the answering retrieval path (queryVerifiedEblets/queryVerifiedEbletsTopical) never
 * reads. The Coroner's all-candidate persist keeps writing every candidate, winners and losers,
 * with reasoning intact -- nothing about WHAT is written or HOW it is derived changes, only WHERE
 * it lands.
 *
 * BP131 honesty fix: this is NO LONGER an Andon gate that blocks non-verified writes -- every
 * solved-answer/component write is persisted regardless of verification status (provenance +
 * sha256 + source must survive for origin tracing regardless of verdict), but the persisted
 * `verified`/`verdict` pair is ALWAYS re-derived here via computeHonestVerification(), never
 * taken verbatim from the caller. See that function's doc comment for the full root-cause
 * writeup and the three legitimate accept classes.
 *
 * Returns the sha256 of (question + answer) as write confirmation.
 */
export async function writeVerifiedEblet(
  entry: VerifiedEbletEntry,
  // BP137 Yoke (Semantic Match Durable), STEP 2: additive, defaults to {} so every existing
  // call site (v2a/v2b/v2c writes in ai_dispatch_ipc.ts/csia_research.ts, and any future
  // caller that never heard of this Yoke) is byte-identical -- computeSemanticCode defaults
  // false, no embed() network call is made, no semanticCode field is written, unless a caller
  // EXPLICITLY opts in (which ai_dispatch_ipc.ts/csia_research.ts only do when
  // isSemanticSoccerballModeEnabled(settings) is true).
  opts: { computeSemanticCode?: boolean } = {},
): Promise<string> {
  // BP131 honesty fix: `verified`/`verdict` are ALWAYS re-derived here, never taken verbatim
  // from `entry` -- see computeHonestVerification()'s doc comment above for why the caller-
  // supplied values can never be trusted as the source of truth. This is no longer a blocking
  // Andon gate: a genuinely-unverified write (verified:false honestly) is NOT an error and is
  // NOT rejected -- provenance/sha256/source must survive regardless of verdict so origin
  // tracing and future reconciliation stay possible. (TODO(liana-marks):
  // mintMarkForVerifiedContribution(peerId, entryId) -- Bishop wires DB side -- fires below,
  // only on the genuinely-verified branch, once a peerId/entryId plumbing exists.)
  const { verified: honestVerified, verdict: honestVerdict } = computeHonestVerification(entry);
  if (honestVerified) {
    // TODO(liana-marks): mintMarkForVerifiedContribution(peerId, entryId) -- Bishop wires DB side
  }

  // D-BP148-007/KNIGHT/M1/seg-e7c1: resolveUserDataPath() replaces the old unguarded
  // `app.getPath('userData')` -- byte-identical when real Electron is present.
  const ebletDir = resolve(resolveUserDataPath(), 'substrate');
  // KN-BP141-5 FIX 3: route ensemble-candidate RGBY-ledger writes to a sibling file the
  // answering retrieval path never reads -- see isRgbyLedgerWrite()'s doc comment above.
  const routeToRgbyLedger = isRgbyLedgerWrite(entry);
  const ebletFile = resolve(ebletDir, routeToRgbyLedger ? 'rgby_ledger.jsonl' : 'verified_eblets.jsonl');
  if (routeToRgbyLedger) {
    console.log(
      `[EbletStore] writeVerifiedEblet: routed provenance='${entry.provenance}' to sibling RGBY ` +
      `ledger ${ebletFile} (KN-BP141-5 FIX 3, not the answering pool)`,
    );
  }

  if (!existsSync(ebletDir)) {
    mkdirSync(ebletDir, { recursive: true });
  }

  const expectedSha = createHash('sha256')
    .update(entry.question + entry.answer)
    .digest('hex');

  // KN-BP141-6 FIX B: dedupe on write. "On collision, do NOT append" -- if `ebletFile` (the
  // exact destination this write is already routed to, post-FIX-3) already contains a row whose
  // own (question, answer) hashes to the same dedupeKey, skip the append entirely; no new row is
  // written, no existing row is touched. `expectedSha` above is a pure function of
  // (question, answer) alone, so it is IDENTICAL for the new call and every existing colliding
  // row -- the "write confirmation" return value is correct whether or not a new line is
  // actually appended, no special-casing needed for the return path.
  const dedupeKey = computeDedupeKey(entry.question, entry.answer);
  if (fileHasDedupeKeyCollision(ebletFile, dedupeKey)) {
    console.log(
      `[EbletStore] writeVerifiedEblet: deduped write (KN-BP141-6 FIX B) -- (question, answer) ` +
      `already present in ${ebletFile}, not appending a duplicate row. Multiplicity is preserved ` +
      `via read-side collapse (collapseVerifiedEbletsByAnswer), not by re-appending the same fact.`,
    );
    return expectedSha;
  }

  // BP137 Yoke (Semantic Match Durable), STEP 2 write side: only ever attempted when the
  // caller explicitly opted in AND didn't already supply a code. Fails soft to undefined (no
  // field written) on any embed failure -- semantic_soccerball_emit()/ollamaManager.embed()
  // never throw, see their own doc comments for the fail-soft contract.
  let semanticCode = entry.semanticCode;
  if (semanticCode === undefined && opts.computeSemanticCode) {
    try {
      semanticCode = (await semantic_soccerball_emit(entry.question)) ?? undefined;
    } catch (err) {
      console.warn('[EbletStore] semantic_soccerball_emit failed at write time (fail-soft, field omitted):', err);
      semanticCode = undefined;
    }
  }

  const line = JSON.stringify({
    question: entry.question,
    answer: entry.answer,
    provenance: entry.provenance,
    // BP131 honesty fix: was a hardcoded `true` literal regardless of how the entry was actually
    // derived -- that hardcode (paired with callers separately writing an honest
    // `verdict: 'unverified'` in the same object literal, e.g. plow_mc_answerer.ts's
    // writeAndReplicateSolvedAnswer) is the root cause of the 100%-verified:true/0%-verdict:
    // 'verified' integrity violation this Yoke fixes. Now sourced from computeHonestVerification()
    // so it can never disagree with `verdict` below.
    verified: honestVerified,
    sha256: expectedSha,
    timestamp: entry.timestamp,
    // BP135 Yoke #34 argument-ledger (0.9.7): additive, omitted entirely (not written as null/
    // undefined) when the caller doesn't supply them -- keeps every pre-0.9.7 caller's output
    // byte-identical and keeps old JSONL lines structurally indistinguishable from a 0.9.7 write
    // that simply chose not to populate these optional fields.
    ...(entry.reasoning !== undefined ? { reasoning: entry.reasoning } : {}),
    // BP131 honesty fix: ALWAYS written now (never passed through from `entry.verdict` verbatim)
    // so `verified`+`verdict` can never disagree -- see computeHonestVerification() above.
    verdict: honestVerdict,
    ...(entry.confidence !== undefined ? { confidence: entry.confidence } : {}),
    // BP136 Yoke (answer-cache v1 forward-compat schema): `class` always written (defaulted to
    // 'whole_answer' when the caller doesn't specify) since v1 write-back always produces a
    // whole-answer unit; `provenanceDetail` stays additive/omitted like the fields above.
    class: entry.class ?? 'whole_answer',
    ...(entry.provenanceDetail !== undefined ? { provenanceDetail: entry.provenanceDetail } : {}),
    // BP136 Yoke v2a (CSIA activation): TIC 5-field schema, additive/omitted like the fields
    // above -- see the VerifiedEbletEntry.tic doc comment for the honesty-mandate verification
    // that these fields did not exist anywhere before this Yoke.
    ...(entry.tic !== undefined ? { tic: entry.tic } : {}),
    // D-BP148-034/BISHOP/plant-rate FIX: `corroboration` was accepted as a write-time INPUT to
    // computeHonestVerification() above (it decides verified/verdict) but was never itself
    // persisted to the JSONL line -- a real gap between this field's own doc comment (which
    // documents it as consumed by rooting_rule.ts's classifyCorroborationTier()) and
    // queryVerifiedEblets()'s D-BP148-015 read-time re-derivation (`classifyCorroborationTier(
    // e.corroboration, e.provenance)`), which has ALWAYS depended on `e.corroboration` being a
    // real field on the stored entry and, until this line, could only ever recover Tier 1 (via
    // the persisted `provenance` string) -- Tier 2 (`coroner_verified`) and Tier 3 (`concordant`)
    // were unrecoverable at read time no matter what a caller passed at write time, because the
    // one field that carries that signal silently vanished on every single write. Purely
    // additive/omitted-when-undefined, same convention as every optional field on this object --
    // does not change the derivation of `verified`/`verdict` above (still computed once, at write
    // time, via computeHonestVerification()), does not change classifyCorroborationTier() or
    // isRooted() (rooting_rule.ts untouched), and does not retroactively alter any existing line
    // already on disk (Rule 66 -- old rows simply continue to have no `corroboration` field, same
    // as before this fix, and continue to only ever recover Tier 1 via provenance at read time).
    ...(entry.corroboration !== undefined ? { corroboration: entry.corroboration } : {}),
    // BP137 Yoke (Semantic Match Durable): additive/omitted exactly like every optional field
    // above -- see the VerifiedEbletEntry.semanticCode doc comment.
    ...(semanticCode !== undefined ? { semanticCode } : {}),
    // BP140 Yoke (Eblet-Learning Substrate / Liana Cycle): additive/omitted exactly like every
    // optional field above -- see VerifiedEbletEntry.factVerdict/volatileDated doc comments.
    // Passed through VERBATIM (unlike verified/verdict above, factVerdict is never re-derived
    // here -- it is only ever meaningful when a caller supplies it with real Coroner-time ground
    // truth behind it via deriveFactVerdict() in answer_coroner.ts; this writer has no ground
    // truth of its own to check it against).
    ...(entry.factVerdict !== undefined ? { factVerdict: entry.factVerdict } : {}),
    ...(entry.volatileDated !== undefined ? { volatileDated: entry.volatileDated } : {}),
  });

  appendFileSync(ebletFile, line + '\n', 'utf-8');
  return expectedSha;
}

/**
 * BP136 Yoke v2a (CSIA activation): raw listing of every verified eblet in the store, used by
 * psionic_predictor.ts's zero-LLM graph walk (which needs the FULL set to build eblet<->eblet
 * edges, unlike queryVerifiedEblets/queryVerifiedEbletsTopical above, which only ever return a
 * question-scored top-K). Deliberately a NEW function, not a refactor of the three existing
 * JSONL-parsing call sites above (queryVerifiedEblets, queryVerifiedEbletsTopical, queryStats)
 * -- Rule 66 / this Yoke's surgical-diff discipline: touching any of those three risks changing
 * behavior relied on by the production Ask path's v1 cache or the mesh-test scoring paths, so
 * the parse logic is intentionally duplicated here rather than extracted into a shared helper
 * those call sites would need to be modified to use.
 */
export async function loadAllVerifiedEblets(): Promise<VerifiedEbletEntry[]> {
  // D-BP148-007/KNIGHT/M1/seg-e7c1: resolveUserDataPath() replaces the old unguarded
  // `app.getPath('userData')` -- byte-identical when real Electron is present.
  const ebletFile = resolve(resolveUserDataPath(), 'substrate', 'verified_eblets.jsonl');
  if (!existsSync(ebletFile)) return [];

  let raw: string;
  try {
    raw = readFileSync(ebletFile, 'utf-8');
  } catch {
    return [];
  }

  const entries: VerifiedEbletEntry[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as Partial<VerifiedEbletEntry>;
      if (parsed.question && parsed.answer && parsed.sha256 && parsed.verified === true) {
        entries.push(parsed as VerifiedEbletEntry);
      }
    } catch {
      // skip malformed, consistent with the other readers in this file
    }
  }
  return entries;
}
