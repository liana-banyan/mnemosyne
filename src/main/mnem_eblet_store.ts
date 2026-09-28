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
//
// BP155 Yoke (D-BP155-017, "Gemma is the Head Librarian through MnemosyneC"): two additive
// changes on top of KN-BP147-M2, both fail-soft, neither touches the BM25 scoring path's
// existing byte-for-byte output when semantic signal is unavailable:
//   1. A fourth root, the Founder's own `.claude\projects\...\memory\` topic-file tree
//      (MEMORY_ROOT below) -- see estateDoctrineRoots()'s own comment for the count. Its
//      files carry YAML frontmatter, not the `.eblet.md`/`HARDWIRE-*.md` naming convention
//      the other three roots use, so isIndexableEbletFile() now takes the root as a second
//      argument and applies a root-specific inclusion rule (see below).
//   2. EbletIndexEntry gains an optional `semanticCode` field, populated at index-build time
//      by the SAME semantic_soccerball_emit() already used for verified_eblets.jsonl (BP137
//      Yoke) -- no new embedder, no new vector store. queryEbletStoreEntries() combines this
//      with the existing BM25 score: real keyword hits get an additive semantic tie-break
//      bonus (can only raise their score, never lower it), and entries with ZERO keyword
//      overlap but high semantic similarity become newly-visible low-priority candidates,
//      capped below the weakest possible real single-token BM25 hit so they can never
//      outrank one. See SEMANTIC_BOOST_WEIGHT/SEMANTIC_ONLY_BASE/SEMANTIC_RECALL_THRESHOLD's
//      doc comments for the exact bound math.

import {
  existsSync,
  readdirSync,
  statSync,
  readFileSync,
  appendFileSync,
  mkdirSync,
  writeFileSync,
  renameSync,
  utimesSync,
  watch,
  type FSWatcher,
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
// D-BP223-BM0-X030-073: stale cutoff C + correction precedence at reuse time.
import { reuseDecision, type ReuseDecision, type ReuseState, type CorrectionRecord } from './card_freshness/card_freshness';

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

// The app.getPath('userData') app-name component, for the non-Electron fallback path only
// (fallbackUserDataPath() below) -- the real Electron branch (getElectronApp() below) always
// asks app.getPath('userData') directly and needs no hardcoded name.
//
// CORRECTED D-BP158-006/BISHOP (supersedes the BP147-era claim this comment used to make, which
// crystal_store.ts's own USERDATA_APP_NAME comment also used to make and has now also been
// corrected there): package.json's `name` field is still "amplify-computer" (deliberately left
// unchanged by this ticket -- renaming it would alter electron-builder's installer identity/
// update channel) but the main process (src/main/index.ts, top of file) now calls
// `app.setPath('userData', %APPDATA%\MnemosyneC)` once at startup, so the app's ACTUAL running
// userData directory is MnemosyneC, not the package-name-derived default. The old comment's
// factual claim that "%APPDATA%\MnemosyneC does not exist" is measurably false as of this
// ticket -- it is where the mesh peer identity keypair already lives. Mirrored here rather than
// imported, to avoid this module taking on crystal_store.ts as a load-bearing dependency for one
// string constant.
const USERDATA_APP_NAME = 'MnemosyneC';

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
// Bounded, named roots -- NOT the ~431k-file `.claude/state/eblets/` corpus this
// module's own loadOrRebuildIndex() doc comment already anticipated (that tree's CANON
// subdir alone holds ~288k files; PIXIE_DUST_BP051_FULL_REMINE_VERBATIM another ~143k --
// verified live via Get-ChildItem -Recurse -File count, session of this Yoke). That much
// larger, differently-named-but-similarly-named CANON tree is DELIBERATELY EXCLUDED from
// this default set: it was never one of the three roots this ticket named, and a cold
// walk+read of 431k files is not "a real, defaulted, discoverable configuration" -- it is
// a startup hang. If the estate wants that corpus indexed too, that is a separate, later
// ticket with its own bounded-subset design, not a silent side effect of this one.
//
// BP155 Yoke (D-BP155-017, Head Librarian wiring): the D-BP155-016 trace reported the first
// root below as "does not exist on this machine" (Glob false-negative, confirmed by direct
// `fs.existsSync`/`readdirSync` this session -- it holds 29 files, 20 of them .eblet.md,
// oldest dated 2026-07-22, well before that trace ran). It was never dead; re-verified
// live, not assumed. No path change was needed here -- see the Yoke's own return doc for
// the full re-verification evidence (existsSync true 3 ways, mtime range, live substrate
// stats jump 962->1014 after this Yoke's other additions).
function estateDoctrineRoots(): string[] {
  return [
    // BP146 canon, this workspace (29 files measured live this session, 20 .eblet.md).
    'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\Asteroid-ProofVault\\state\\eblets\\CANON',
    // BP082-BP145 canon, sibling repo (922 files measured live this session; ticket
    // said 921 -- off by one, one file landed between the ticket being written and
    // this Yoke; not a material discrepancy).
    'C:\\Users\\Administrator\\Documents\\Asteroid-ProofVault\\state\\eblets\\CANON',
    // The HardWires themselves.
    'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\HARDWIRE',
    // BP155 Yoke: the Founder's own living memory -- MEMORY.md's topic-file shorthand, the
    // KEEPER digests, and the BP-canon archive -- 885 indexable files measured live this
    // session (1,131 total .md, minus 80 Rule-66 `.superseded.<ts>` siblings and 166
    // `*_VIOLATION_SUPERSEDE.md` stub artifacts under the generalized filter below). This is
    // the estate's freshest, most-curated doctrine layer and was entirely invisible to the
    // substrate before this Yoke -- confirmed absent from `estateDoctrineRoots()` by the
    // D-BP155-016 trace and by this Yoke's own pre-change read of this function.
    MEMORY_ROOT,
    // D-BP155-018: the rulings root -- see RULINGS_ROOT's own comment above for why this is
    // walked shallow+pattern-filtered rather than recursively like the other roots.
    RULINGS_ROOT,
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

  // D-BP223-BM0-X010-011: test-only escape hatch. MNEM_EBLET_STORE_ROOTS was always
  // ADDITIVE (see the un-changed comment two lines below) -- a test harness setting it to a
  // scratch dir still pays the cost of walking the REAL estateDoctrineRoots()/bundled/userData
  // tiers on top of that scratch dir. That was cheap when the real corpus was a few thousand
  // files; it is no longer cheap now that HARDWIRE alone holds 46k+ indexable files (the same
  // growth this ticket's rebuild-floor fix responds to) -- a test that needs a truly isolated,
  // fast rebuild would otherwise pay a multi-second walk plus a real semantic-embedding pass
  // over the whole corpus. Setting this to "1" makes the env override EXCLUSIVE (skips every
  // other tier) instead of additive. Defaults to unset/additive -- zero behavior change for any
  // real (non-test) process, which never sets this.
  if (process.env.MNEM_EBLET_STORE_ROOTS_EXCLUSIVE === '1' && envOverride) {
    const resolved = candidates.filter((root) => { try { return existsSync(root); } catch { return false; } });
    _resolvedRootsCache = { roots: resolved, warnedEmpty: resolved.length === 0 };
    return resolved;
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
  // D-BP155-018: a Founder ruling is authoritative doctrine, same standing as CANON -- weight
  // it accordingly so it is actually competitive in PRIORITY_CATEGORIES/BM25 against the canon
  // eblet it may be correcting, rather than sitting at the lowest 'active' weight.
  if (p.includes('/BISHOP_DROPZONE/') && RULINGS_FILE_PATTERN.test(basename(p))) return 'canon';
  return 'active';
}

// ─── Recursive walker ─────────────────────────────────────────────────────────

// KN-BP147-M2: widened from *.eblet.md only. HARDWIRE-*.md (HARDWIRE-00_THE_TRAIL_HEAD.md,
// HARDWIRE-01_ANSWERING_PIPELINE.md, etc.) are doctrine too and do not carry the .eblet.md
// suffix. Deliberately literal to the ticket's glob (`HARDWIRE-*.md`, hyphen) -- this does
// NOT match HARDWIRE_CONVENTION.md (underscore), which stays out of the index by the same
// rule that keeps it out of git's own glob-based tooling elsewhere in this estate.
const HARDWIRE_DOC_PATTERN = /^HARDWIRE-.*\.md$/;

// BP155 Yoke: the Founder's own memory topic-file tree -- YAML-frontmattered *.md docs
// (MEMORY.md itself, KEEPER digests, feedback_/project_/canon_/reference_/correction_-
// prefixed topic files), never named *.eblet.md or HARDWIRE-*.md. Read several live before
// choosing this rule (project_founder_four_goal_campaign_order_bp147.md,
// keeper_bp046_disciplines.md, MEMORY.md) -- all share the same convention: `---` YAML
// frontmatter (name/description/metadata/handle/catalog) followed by markdown body. The
// frontmatter is doctrine-shaped but not RIGIDLY structured enough to make parsing it a
// precondition for indexing (some files have no frontmatter at all, e.g.
// daniel_ryan_removed.md, deep_read_session_12.md) -- so, consistent with how every other
// root here is walked (whole-file text into title+snippet, no frontmatter-only extraction),
// EVERY non-superseded/non-stub *.md file under this root is indexed by full text, same as
// the other three roots' *.eblet.md files.
const MEMORY_ROOT = 'C:\\Users\\Administrator\\.claude\\projects\\C--Users-Administrator-Documents\\memory';

// D-BP155-018 (keep-current fix): BISHOP_DROPZONE holds 621 files across 66 subdirectories
// (measured live this session) -- indexing it wholesale would be exactly the "cold walk of a
// huge unrelated tree" estateDoctrineRoots()'s own comment already warns against. Only
// `RULINGS_BP*.md` at the TOP LEVEL (5 files measured live: BP149/152/153/154/155) is the
// named target (FD-BP155-02's own text: "Ruling files under
// LianaBanyanPlatform\BISHOP_DROPZONE\RULINGS_*.md are NOT an indexed substrate root"). So
// this root is indexed SHALLOW (top-level directory entries only, no recursion into the other
// 66 subdirectories) and PATTERN-FILTERED (RULINGS_*.md only) -- see SHALLOW_PATTERN_ROOTS,
// walkShallowPatternRoot(), and isIndexableEbletFile()'s RULINGS_ROOT branch below.
const RULINGS_ROOT = 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\BISHOP_DROPZONE';
const RULINGS_FILE_PATTERN = /^RULINGS_.*\.md$/;

/** Roots walked SHALLOW (top-level directory entries only) and filtered to a specific
 *  filename pattern, instead of the full recursive *.eblet.md/HARDWIRE-*.md/*.md walk every
 *  other root uses. Currently just RULINGS_ROOT; a Set so a future narrow root can join
 *  without a chain of `root === X || root === Y` checks. */
const SHALLOW_PATTERN_ROOTS = new Set<string>([RULINGS_ROOT]);

// The estate's own live-editing convention (HARDWIRE_CONVENTION.md, Rule 66 "version never
// overwrite") produces `<name>.superseded.<UTC-ts>[.md]` siblings on every edit, and a
// separate hook produces `<name>_AUGUR_AUGUR_<REASON>_VIOLATION_SUPERSEDE.md` stubs (~2KB
// inert artifacts -- verified live: 8 of these exist under HARDWIRE/ this session, would
// have polluted BM25 with near-duplicate short files had they not been filtered). Both are
// excluded regardless of which pattern above matched the file.
//
// BP155 Yoke widening: the memory root carries BOTH the `_PRICING_VIOLATION_SUPERSEDE.md`
// variant the original pattern caught AND a `_CLOSEOUT_VIOLATION_SUPERSEDE.md` sibling
// variant it did not (measured live this session: 124 PRICING-only vs 166 total
// `*_VIOLATION_SUPERSEDE.md` files under the memory root -- the literal-PRICING pattern
// would have silently let 42 stub artifacts into the index). Generalized to match the
// stub-artifact SHAPE (any reason token, same `_VIOLATION_SUPERSEDE.md` suffix) rather than
// the one literal reason string HARDWIRE/ happened to produce -- strictly narrower false-
// exclusion risk than adding a second hardcoded literal, and covers both roots with one rule.
function isSupersededOrStubArtifact(name: string): boolean {
  return name.includes('.superseded.') || /_VIOLATION_SUPERSEDE\.md$/.test(name);
}

/**
 * BP155 Yoke: `root` is now REQUIRED (was file-shape-only before this Yoke) because the
 * memory root's inclusion rule is deliberately broader than the other three roots' -- see
 * MEMORY_ROOT's own doc comment for why a frontmatter-shape check was rejected in favor of
 * "every non-superseded/non-stub *.md file, full text". Every existing (non-memory) root is
 * completely unaffected: this is a strict narrowing of the check to an additional `root ===
 * MEMORY_ROOT` branch, not a change to the *.eblet.md/HARDWIRE-*.md rule those roots use.
 */
function isIndexableEbletFile(name: string, root: string): boolean {
  if (isSupersededOrStubArtifact(name)) return false;
  if (root === MEMORY_ROOT) return name.endsWith('.md');
  // D-BP155-018: RULINGS_ROOT's own inclusion rule is narrower than every other root's --
  // only the specific `RULINGS_BP*.md` shape, not "every .md" (MEMORY_ROOT's rule) and not
  // *.eblet.md/HARDWIRE-*.md (the other roots' rule). See RULINGS_ROOT's own comment for why.
  if (root === RULINGS_ROOT) return RULINGS_FILE_PATTERN.test(name);
  return name.endsWith('.eblet.md') || HARDWIRE_DOC_PATTERN.test(name);
}

/**
 * D-BP155-018: shallow, single-directory, pattern-filtered walk -- used ONLY for roots in
 * SHALLOW_PATTERN_ROOTS (currently RULINGS_ROOT). Deliberately does NOT recurse into
 * subdirectories, unlike walkEbletStore() below: RULINGS_ROOT's parent (BISHOP_DROPZONE) holds
 * 66 subdirectories / 621 files total (measured live) that are out of scope for this ticket --
 * see RULINGS_ROOT's own comment. A single readdirSync, filtered through
 * isIndexableEbletFile(), mirrors the top-level branch of walkEbletStore()'s loop without its
 * stack-based recursion.
 */
function walkShallowPatternRoot(root: string): string[] {
  const out: string[] = [];
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) continue; // shallow: subdirectories deliberately not walked
    if (isIndexableEbletFile(entry.name, root)) out.push(join(root, entry.name));
  }
  return out;
}

/**
 * SEG-1: Recursively walk `root` and collect all indexable doctrine file paths --
 * *.eblet.md (original scope) plus HARDWIRE-*.md (KN-BP147-M2), minus superseded/stub
 * artifacts (see isIndexableEbletFile above). BP155 Yoke: `root` is passed through to
 * isIndexableEbletFile() unchanged for every recursion level (it is the WALK's starting
 * root, not the current subdirectory), so the memory root's broader *.md rule applies to
 * every file under it including its keepers/iron_tablets/tablets/topic_files/archives
 * subdirectories, while every other root keeps the original narrower rule.
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
      } else if (isIndexableEbletFile(entry.name, root)) {
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
  /** BP155 Yoke (Head Librarian wiring, D-BP155-017): 32-hex SimHash code from
   *  semantic_soccerball_emit(`${title}\n${snippet}`) -- the SAME function already used for
   *  verified_eblets.jsonl (BP137 Yoke), no new embedder introduced. Computed once at index-
   *  build time and reused across rebuilds for unchanged (path, mtime) pairs (see
   *  loadOrRebuildIndex()) so a rebuild triggered by one new/edited file never re-embeds the
   *  whole corpus. Optional/absent for entries indexed before this Yoke, or when the embed
   *  call failed soft (Ollama unreachable) at compute time -- readers MUST treat absence as
   *  "no semantic signal for this entry", never as zero similarity (see
   *  queryEbletStoreEntries()'s scoring branch below). */
  semanticCode?: string;
  /** D-BP155-018 (supersession, minimum viable): the `supersedes:` value parsed out of this
   *  entry's own frontmatter (flat or nested under `metadata:`), e.g.
   *  `canon_memory_md_keyhole_640_lines_consolidation_needed_bp091` -- the OTHER entry's
   *  filename-derived key (see entryKey() near queryEbletStoreEntries()) that THIS entry
   *  claims to supersede. Absent when the file has no `supersedes:` line, or the line's value
   *  is the literal `nothing`. This is a raw, unresolved reference -- resolving it against a
   *  live entry and demoting/marking the target only happens at query time (see
   *  queryEbletStoreEntries()), never here, so a supersedes claim survives even on a rebuild
   *  where the target file hasn't been walked/read this pass. */
  supersedes?: string;
  /** D-BP155-018: one-time-migration sentinel. `true` once this entry's `supersedes` field has
   *  actually been checked (found or genuinely absent) at least once. Entries written by code
   *  before this field existed have neither `supersedes` NOR `supersedesChecked` -- without
   *  this sentinel, the zero-I/O reuse path in loadOrRebuildIndex() could not tell "genuinely
   *  has no supersedes claim" apart from "predates the feature and was never checked", and
   *  would either silently miss real supersedes claims on every untouched pre-migration file
   *  forever, or re-read every file's content on every rebuild forever to be safe (defeating
   *  the whole point of the reuse optimization). With the sentinel: unchecked entries get ONE
   *  cheap frontmatter-only read (no embedding call) the first time they are encountered after
   *  this Yoke, then are marked checked and never read again for this purpose while unchanged. */
  supersedesChecked?: true;
  /** D-BP219-BM0-035 (tagging discipline fix): normalized tag slugs parsed out of this entry's
   *  own frontmatter at index-build time -- see parseTagsFromFrontmatter() below for the exact
   *  extraction/normalization rule. PRIOR DEFECT: EbletIndexEntry had NO field to hold a tag at
   *  all -- every authored `tags:`/`topics:` frontmatter line in the corpus was parsed by
   *  nothing and stored nowhere, making ~2,880 hand-tagged records structurally unqueryable by
   *  tag (Founder, BP219: "your tagging discipline is being thrown away at the door"). Direct
   *  measurement this ticket (grep across the four real estateDoctrineRoots(), not the
   *  ~432k-file .claude/state/eblets/ tree this file deliberately never walks) found the
   *  authored-tag premise partly wrong: `tags:`/`topics:` are both nearly unused on disk today
   *  (1 file each across ~4,960 files checked); `related:` is the common list-of-slugs field
   *  (362+ files) but it is a CROSS-REFERENCE to other eblets (same shape supersedes uses), not
   *  a topic-tag vocabulary, so it is deliberately NOT folded into `tags` here -- see this
   *  ticket's return doc for the full count breakdown. This field exists so whatever tags ARE
   *  authored (now or going forward) have a slot instead of being silently dropped.
   *  ALWAYS an array (never a bare string, never null) once `tagsChecked` is true -- an
   *  authored-zero-tags entry is `tags: []` with `tagsChecked: true`. `tags` being `undefined`
   *  (paired with `tagsChecked` also undefined) means "indexed before this feature existed, not
   *  yet checked" -- the same absence-vs-empty distinction supersedes/supersedesChecked already
   *  establish above; readers MUST NOT treat an absent `tags` as "authored no tags". */
  tags?: string[];
  /** D-BP219-BM0-035: one-time-migration sentinel, identical pattern to supersedesChecked
   *  above. `true` once this entry's frontmatter has actually been scanned for `tags:`/
   *  `topics:` at least once (whether or not any were found). Lets the zero-I/O reuse path in
   *  loadOrRebuildIndex() distinguish "checked, genuinely has no tags" (tags: [], tagsChecked:
   *  true) from "predates this feature, never checked" (tags undefined, tagsChecked undefined)
   *  without re-reading every unchanged file on every rebuild. */
  tagsChecked?: true;
}

/** D-BP219-BM0-035: parse `tags:` or `topics:` out of a YAML frontmatter slice (same
 *  deliberately-not-a-YAML-parser convention this file already uses for `supersedes:` --
 *  one regex over the frontmatter block, not a real YAML parser). Accepts either authored key
 *  (both are real, both vanishingly rare on disk today -- see the `tags` field's own doc
 *  comment for the measured counts) and normalizes both into the same array so a reader never
 *  has to care which key an author actually used. Handles the three real shapes seen in this
 *  estate's frontmatter:
 *    - inline flow list:   `tags: [Foo Bar, baz-qux]`
 *    - inline single value: `tags: solo-tag`
 *    - YAML block list:     `tags:\n  - Foo Bar\n  - baz-qux`
 *  Normalization rule (matches this estate's existing lowercase-hyphenated slug convention,
 *  e.g. entryKey()'s filename-derived keys and supersedes' own values): trim surrounding
 *  whitespace/quotes, lowercase, collapse any run of whitespace/underscore into a single
 *  hyphen, strip characters outside [a-z0-9-]. Empty results after normalization are dropped.
 *  Never throws -- returns [] on no match or on any malformed line, exactly like the
 *  supersedes regex's own fail-soft convention. */
export function parseTagsFromFrontmatter(frontmatter: string): string[] {
  const normalize = (raw: string): string =>
    raw
      .trim()
      .replace(/^["']|["']$/g, '')
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '');

  const out = new Set<string>();

  // Flow-list or single-value form: `tags: [a, b]` or `tags: a` on one line.
  const flowMatch = frontmatter.match(/^\s*(?:tags|topics):\s*\[([^\]]*)\]\s*$/mi);
  if (flowMatch) {
    for (const piece of flowMatch[1].split(',')) {
      const n = normalize(piece);
      if (n) out.add(n);
    }
  } else {
    const inlineMatch = frontmatter.match(/^\s*(?:tags|topics):\s*(?!\[|\s*$)(.+?)\s*$/mi);
    if (inlineMatch) {
      const n = normalize(inlineMatch[1]);
      if (n) out.add(n);
    }
  }

  // YAML block-list form: `tags:` (or `topics:`) alone on a line, followed by `  - value` lines.
  const blockHeaderMatch = frontmatter.match(/^\s*(?:tags|topics):\s*$/mi);
  if (blockHeaderMatch && blockHeaderMatch.index !== undefined) {
    const after = frontmatter.slice(blockHeaderMatch.index + blockHeaderMatch[0].length);
    const lines = after.split('\n');
    for (const line of lines) {
      const itemMatch = line.match(/^\s*-\s*(.+?)\s*$/);
      if (!itemMatch) {
        // First non-list-item, non-blank line ends the block.
        if (line.trim() !== '') break;
        continue;
      }
      const n = normalize(itemMatch[1]);
      if (n) out.add(n);
    }
  }

  return Array.from(out);
}

/** BP155 Yoke: bounded-concurrency map -- Ollama is one local process; unbounded
 *  Promise.all across a corpus-sized fan-out (low thousands of entries) both serializes
 *  behind one process's real capacity and opens far more simultaneous sockets than useful.
 *  8 is a conservative concurrency chosen against this session's measured real warm-call
 *  latency (~140ms/call against live nomic-embed-text, see the Yoke's return doc for the
 *  pasted curl proof). Never throws itself -- `fn` is expected to be fail-soft internally
 *  (semantic_soccerball_emit already is), so one failing item never aborts the batch. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  }
  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

/** BP155 Yoke: concurrency ceiling for the embed fan-out in loadOrRebuildIndex(). */
const SEMANTIC_INDEX_EMBED_CONCURRENCY = 8;

/** Path to the persistent index JSONL file. */
function getIndexPath(): string {
  // D-BP148-007/KNIGHT/M1/seg-e7c1: resolveUserDataPath() replaces the old unguarded
  // `app.getPath('userData')` -- byte-identical when real Electron is present.
  return resolve(resolveUserDataPath(), 'mnemosynec', 'substrate', 'eblet_index.jsonl');
}

let _indexCache: { entries: EbletIndexEntry[]; loadedAt: number } | null = null;
const INDEX_CACHE_TTL_MS = 60_000; // re-check delta every 60s

// D-BP223-BM0-X030-004: (path|mtime) -> time of the last failed embed, so a rebuild does not
// re-pay the same fail-soft Ollama timeout on every pass. See the needsEmbed filter in
// loadOrRebuildIndex(). Overridable via MNEM_EMBED_RETRY_BACKOFF_MS for tests.
const _embedFailedAt = new Map<string, number>();
const EMBED_RETRY_BACKOFF_MS = (() => {
  const raw = process.env.MNEM_EMBED_RETRY_BACKOFF_MS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 10 * 60_000;
})();

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
  // D-BP155-018: SHALLOW_PATTERN_ROOTS (RULINGS_ROOT) must not pay a full recursive stat walk
  // of its 66 unrelated subdirectories / 621 files just to answer "did anything change" --
  // check the root dir's own mtime plus its direct children only, matching
  // walkShallowPatternRoot()'s own non-recursive scope.
  if (SHALLOW_PATTERN_ROOTS.has(root)) {
    let max = 0;
    try {
      max = statSync(root).mtimeMs;
      for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (entry.isDirectory()) continue;
        try {
          const m = statSync(join(root, entry.name)).mtimeMs;
          if (m > max) max = m;
        } catch { /* skip unreadable */ }
      }
    } catch { /* skip */ }
    return max;
  }

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

  // D-BP223-BM0-X010-025C-ARMBFIX: env-gated fast path for short-lived, subprocess-per-item
  // harnesses (e.g. mmlu_pro_plow_sweep.cjs) where `_indexCache` above NEVER helps -- each
  // item spawns a brand-new process with `_indexCache` undefined, so every item pays the full
  // `rootsMaxMtime()` tree walk below (and, when it finds anything newer than the on-disk
  // index, a full rebuild + Ollama re-embed) from scratch. Under concurrency and/or
  // `--keep-the-win`'s two-legs-per-item fan-out this multiplies into concurrent fighting
  // rewrites of the same `eblet_index.jsonl` plus saturated embed traffic, and the harness's
  // per-item timeout kills every item (see D-BP223-BM0-X010-025B-ARMB_REPORT.md for the full
  // trace). When MNEM_EBLET_INDEX_TRUST_CACHE=1 and an on-disk index already exists, skip the
  // mtime walk AND the rebuild entirely and load the on-disk index as-is -- correct for a
  // sweep harness reading a corpus some OTHER long-lived process (the live MnemosyneC app)
  // keeps fresh on its own schedule; wrong as a general default, which is exactly why this is
  // opt-in only and gated on the env var. With the env var absent or not '1', behavior below is
  // unchanged from before this patch.
  if (process.env.MNEM_EBLET_INDEX_TRUST_CACHE === '1' && existsSync(indexPath)) {
    try {
      const raw = readFileSync(indexPath, 'utf-8');
      const entries: EbletIndexEntry[] = [];
      for (const line of raw.split('\n')) {
        const t = line.trim();
        if (!t) continue;
        try { entries.push(JSON.parse(t) as EbletIndexEntry); } catch { /* skip malformed */ }
      }
      _indexCache = { entries, loadedAt: now };
      console.log(
        `[EbletIndex] MNEM_EBLET_INDEX_TRUST_CACHE=1: loaded ${entries.length} entries from ` +
        `disk cache with NO mtime walk and NO rebuild (trusting the on-disk index as-is)`,
      );
      return entries;
    } catch {
      // Fall through to the normal path below -- e.g. the file vanished between existsSync
      // and readFileSync above, or every line failed to parse. Never let a trust-cache read
      // failure be worse than just doing the normal walk/rebuild.
    }
  }

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
  const perRootCounts: Record<string, number> = {};
  for (const root of getEbletStoreRoots()) {
    if (existsSync(root)) {
      // D-BP155-018: SHALLOW_PATTERN_ROOTS (RULINGS_ROOT) get the non-recursive,
      // pattern-filtered walk -- see walkShallowPatternRoot()'s own comment.
      const found = SHALLOW_PATTERN_ROOTS.has(root)
        ? walkShallowPatternRoot(root)
        : walkEbletStore(root);
      allPaths.push(...found);
      perRootCounts[root] = found.length;
    } else {
      perRootCounts[root] = 0;
    }
  }
  // BP155 Yoke: name what each root actually contributed, per-root, every rebuild -- "check
  // the PARSER before the SOLVER". A root that silently resolves 0 files is this estate's
  // signature defect (a failure indistinguishable from success); this makes it visible in
  // the log on every rebuild instead of only when someone thinks to ask.
  for (const [root, count] of Object.entries(perRootCounts)) {
    console.log(`[EbletIndex] root contributed ${count} indexable file(s): ${root}`);
  }

  // BP155 Yoke: reuse semanticCode from the PRIOR on-disk index when (path, mtime) are
  // unchanged, so a rebuild triggered by ONE new/edited file does not re-embed the entire
  // corpus every time -- only genuinely new/changed entries pay the Ollama round-trip. Read
  // straight off disk (not _indexCache, which may already be stale/absent at this point).
  const priorByPath = new Map<string, EbletIndexEntry>();
  if (existsSync(indexPath)) {
    try {
      const priorRaw = readFileSync(indexPath, 'utf-8');
      for (const line of priorRaw.split('\n')) {
        const t = line.trim();
        if (!t) continue;
        try {
          const e = JSON.parse(t) as EbletIndexEntry;
          if (e.path) priorByPath.set(e.path, e);
        } catch { /* skip malformed */ }
      }
    } catch { /* no reuse available, fall through */ }
  }

  // D-BP155-018 (keep-current fix): a rebuild triggered by ONE new/changed file must not pay
  // a readFileSync of every OTHER unchanged file in the corpus just to reconstruct
  // title/snippet/category -- those are pure functions of file content+path, so for any
  // (path, mtime) pair that matches the PRIOR on-disk index exactly, reuse the whole entry
  // (title/snippet/category/supersedes/semanticCode) verbatim rather than re-deriving it. Only
  // new or changed files pay the read. Before this fix, semanticCode alone was reused (see
  // priorByPath above, BP155 Yoke) but title/snippet/category were recomputed via readFileSync
  // for EVERY entry on EVERY rebuild regardless of whether anything changed -- real I/O work
  // this ticket's "do not rebuild all 1,899 entries on every query" constraint rules out.
  let reusedZeroIoCount = 0;
  let reusedBackfillCount = 0;
  const entries: EbletIndexEntry[] = [];
  for (const fullPath of allPaths) {
    try {
      const mtime = statSync(fullPath).mtimeMs;
      const prior = priorByPath.get(fullPath);
      if (prior && prior.mtime === mtime) {
        if (prior.supersedesChecked && prior.tagsChecked) {
          // Unchanged AND already checked for both a supersedes claim and tags -- reuse
          // verbatim, zero I/O. D-BP219-BM0-035: gated on tagsChecked too, same reasoning as
          // supersedesChecked -- an entry that predates the tags feature must not be silently
          // reused forever with tags left undefined; see the one-time backfill branch below.
          entries.push(prior);
          reusedZeroIoCount++;
          continue;
        }
        // D-BP155-018 / D-BP219-BM0-035 one-time migration: unchanged content, but this entry
        // predates the supersedes feature and/or the tags feature and was never checked for
        // one or both. Cheap frontmatter-only read (no Ollama call, no embedding recompute --
        // semanticCode still carries over from `prior`) so this file is never re-read for
        // either purpose again once both `supersedesChecked` and `tagsChecked` land in the
        // persisted index.
        try {
          const rawFm = readFileSync(fullPath, 'utf-8');
          const fmEnd = rawFm.indexOf('\n---', 4);
          const frontmatter = rawFm.startsWith('---') && fmEnd > 0 ? rawFm.slice(0, fmEnd) : rawFm.slice(0, 2000);
          const backfilled: EbletIndexEntry = { ...prior };
          if (!prior.supersedesChecked) {
            const m = frontmatter.match(/^\s*supersedes:\s*["']?([^"'\n#]+?)["']?\s*$/m);
            backfilled.supersedesChecked = true;
            if (m) {
              const val = m[1].trim();
              if (val && val.toLowerCase() !== 'nothing') backfilled.supersedes = val;
            }
          }
          if (!prior.tagsChecked) {
            backfilled.tags = parseTagsFromFrontmatter(frontmatter);
            backfilled.tagsChecked = true;
          }
          entries.push(backfilled);
        } catch {
          entries.push(prior); // unreadable now -- keep prior data, leave unchecked for next pass
        }
        reusedBackfillCount++;
        continue;
      }

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
      // D-BP155-018 (supersession, minimum viable): parse a `supersedes:` line out of the
      // YAML frontmatter block (first `---`...`---`), flat (`supersedes: x`) or nested under
      // `metadata:` (`  supersedes: x`) -- both shapes are real, live conventions (compare
      // feedback_never_compact_memory_offload_to_eblet_bp155.md's nested
      // `metadata.supersedes` against a flat-frontmatter canon eblet). Deliberately NOT a YAML
      // parser -- one regex over the frontmatter slice, matching this file's existing
      // frontmatter-is-not-rigidly-parsed convention (see MEMORY_ROOT's own comment above).
      // "nothing" is the file's own convention for "supersedes nothing" (see
      // canon_train_on_truth_run_blind_bp153.eblet.md) and is treated as absent.
      let supersedes: string | undefined;
      const fmEnd = raw.indexOf('\n---', 4);
      const frontmatter = raw.startsWith('---') && fmEnd > 0 ? raw.slice(0, fmEnd) : raw.slice(0, 2000);
      const supersedesMatch = frontmatter.match(/^\s*supersedes:\s*["']?([^"'\n#]+?)["']?\s*$/m);
      if (supersedesMatch) {
        const val = supersedesMatch[1].trim();
        if (val && val.toLowerCase() !== 'nothing') supersedes = val;
      }
      // D-BP219-BM0-035: same frontmatter slice, parsed for tags too -- new/changed files pay
      // one extra regex pass, no extra I/O (frontmatter already in memory from the read above).
      const tags = parseTagsFromFrontmatter(frontmatter);
      const entry: EbletIndexEntry = {
        path: fullPath, category, title, snippet, mtime,
        supersedesChecked: true, tags, tagsChecked: true,
      };
      if (supersedes !== undefined) entry.supersedes = supersedes;
      // NOTE: semanticCode is deliberately left unset here -- this branch is reached only when
      // `prior` is absent or `prior.mtime !== mtime` (the unchanged case already `continue`d
      // above with the full prior entry, semanticCode included). Reusing a prior semanticCode
      // for content that just changed would serve a stale embedding under a fresh mtime; the
      // needsEmbed filter below picks up every entry with semanticCode === undefined and
      // computes it fresh.
      entries.push(entry);
    } catch { /* skip unreadable */ }
  }
  console.log(
    `[EbletIndex] rebuild: ${reusedZeroIoCount}/${allPaths.length} unchanged+already-checked ` +
    `entries reused with zero file reads; ${reusedBackfillCount} unchanged entries paid a ` +
    `one-time supersedes-backfill read (no embed call); ` +
    `${allPaths.length - reusedZeroIoCount - reusedBackfillCount} new/changed entries fully ` +
    `read from disk`,
  );

  // BP155 Yoke: fill in semanticCode for every entry that did NOT get one reused above (new
  // files, changed files, or the very first build after this Yoke). Fail-soft per entry --
  // semantic_soccerball_emit() already returns null (never throws) on any Ollama error; a
  // failed embed just leaves that entry's semanticCode absent, it never blocks indexing or
  // fails the rebuild. This is the ONLY place the CANON/HARDWIRE/memory corpus gets embedded
  // -- query time embeds the query text alone (see queryEbletStoreEntries()).
  // D-BP223-BM0-X030-004 (EbletIndex 20 s loop, part 2 of 3). MEASURED main.log 2026-09-16
  // 17:30-17:31 local: every rebuild re-tried the SAME 3 entries whose embed had already failed,
  // each retry costing about 8 s of fail-soft timeouts, and the failure is the same every pass.
  // An entry whose embed failed for this exact (path, mtime) is not retried until
  // EMBED_RETRY_BACKOFF_MS has passed. It keeps BM25-only ranking in the meantime, exactly as a
  // failed embed already did. A changed file (new mtime) is never held back.
  const embedNow = Date.now();
  const needsEmbed = entries.filter((e) => {
    if (e.semanticCode !== undefined) return false;
    const failedAt = _embedFailedAt.get(`${e.path}|${e.mtime}`);
    return failedAt === undefined || embedNow - failedAt >= EMBED_RETRY_BACKOFF_MS;
  });
  const heldBack = entries.filter((e) => e.semanticCode === undefined).length - needsEmbed.length;
  if (heldBack > 0) {
    console.log(`[EbletIndex] ${heldBack} entr${heldBack === 1 ? 'y' : 'ies'} with a recent failed embed held back from retry (backoff ${EMBED_RETRY_BACKOFF_MS} ms)`);
  }
  let embedSuccesses = 0;
  if (needsEmbed.length > 0) {
    console.log(
      `[EbletIndex] computing semantic codes for ${needsEmbed.length} new/changed ` +
      `entr${needsEmbed.length === 1 ? 'y' : 'ies'} (of ${entries.length} total, ` +
      `${entries.length - needsEmbed.length} reused from prior index)…`,
    );
    let embedFailures = 0;
    await mapWithConcurrency(needsEmbed, SEMANTIC_INDEX_EMBED_CONCURRENCY, async (e) => {
      try {
        const code = await semantic_soccerball_emit(`${e.title}\n${e.snippet}`);
        if (code) {
          e.semanticCode = code;
          embedSuccesses++;
          _embedFailedAt.delete(`${e.path}|${e.mtime}`);
        } else {
          embedFailures++;
          _embedFailedAt.set(`${e.path}|${e.mtime}`, Date.now());
        }
      } catch {
        // Belt-and-suspenders: semantic_soccerball_emit's own contract is fail-soft
        // (returns null, never throws), but a rebuild must never abort on ANY per-entry
        // failure regardless of which layer it originated in.
        embedFailures++;
        _embedFailedAt.set(`${e.path}|${e.mtime}`, Date.now());
      }
    });
    console.log(
      `[EbletIndex] semantic code fill complete: ${needsEmbed.length - embedFailures}/` +
      `${needsEmbed.length} succeeded${embedFailures > 0 ? ` (${embedFailures} fail-soft, Ollama likely unreachable -- those entries fall back to BM25-only ranking)` : ''}`,
    );
  }

  // D-BP223-BM0-X030-004 (EbletIndex 20 s loop, part 3 of 3). MEASURED: every pass logged
  // "56907/56907 unchanged+already-checked ... 0 new/changed" and still rewrote the full
  // 32,644,013-byte eblet_index.jsonl, about 4,320 times a day (about 141 GB/day of writes for no
  // change). When the walk proves the index content is identical to what is on disk (every path
  // reused verbatim, no path added or removed, no backfill, no new embed), skip the rewrite and
  // only stamp the index mtime with THIS pass's start time, so the rootsMtime > indexMtime check
  // above is satisfied for everything this pass already saw. Stamping the start time, not the end
  // time, means any file touched during the walk still reads as newer next time.
  const indexUnchanged =
    existsSync(indexPath) &&
    reusedZeroIoCount === allPaths.length &&
    reusedBackfillCount === 0 &&
    embedSuccesses === 0 &&
    priorByPath.size === entries.length;
  if (indexUnchanged) {
    try {
      // Stamp = max(pass start, the roots mtime observed BEFORE the walk). rootsMtime can sit a
      // fraction of a millisecond above the integer Date.now() start (measured: noise file
      // ...816.1387 vs start ...816), and every change it reflects was visible to the walk that
      // followed it. Passed as fractional seconds so NTFS keeps sub-millisecond precision.
      // +0.001 ms (10 NTFS ticks): the seconds-double to FILETIME conversion can truncate one
      // tick below rootsMtime, which would re-trigger the walk on the next check (seen in Test 7).
      const stampMs = Math.max(now, rootsMtime) + 0.001;
      utimesSync(indexPath, Date.now() / 1000, stampMs / 1000);
      console.log(`[EbletIndex] Index content unchanged (${entries.length} entries); skipped rewrite, stamped mtime only`);
      _indexCache = { entries, loadedAt: now };
      return entries;
    } catch (e) {
      console.warn('[EbletIndex] mtime stamp failed, falling back to full rewrite:', e);
    }
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

// ─── D-BP155-018: keep-current watchers + explicit force-refresh + failure marking ─────────
//
// THE DEFECT THIS FIXES: loadOrRebuildIndex()'s in-memory `_indexCache` TTL (60s, see
// INDEX_CACHE_TTL_MS above) means a query made LESS than 60s after the previous query's index
// load never even reaches the on-disk mtime comparison -- it returns the in-memory cache
// unconditionally. Measured live this session: a file written into MEMORY_ROOT seconds after a
// prior query returned byte-identical stale results on the very next query, then a query made
// >60s later picked up both that file and a second one correctly (rebuild fired, index grew
// 1899 -> 1901). So the mechanism DOES work, but only outside a 60-second blind window after
// every query -- exactly the "a newly added file... does not get picked up" defect the ticket
// names, and exactly reproducible on demand (see this Yoke's own return doc for the paired
// before/after query transcripts).
//
// FIX: an fs.watch() per root, debounced, that calls invalidateIndexCache() the moment a
// change is detected -- this clears `_indexCache` regardless of how recently the last query
// ran, so the 60s TTL can never again mask a real edit. A background rebuild is ALSO kicked
// off after the same debounce so the index is typically already warm by the time a query
// arrives (not required for correctness -- invalidateIndexCache() alone is sufficient for the
// next query to self-heal -- but removes the "first query after an edit pays the rebuild cost"
// latency tax). Neither changes loadOrRebuildIndex()'s own algorithm; this is purely an
// additional trigger for the same function, plus bookkeeping so a failed background rebuild is
// NAMED (Truth-Always) rather than silently leaving the last-known-good index in place with no
// signal that it may now be stale.

interface RebuildOutcome {
  status: 'ok' | 'failed';
  at: number;
  error?: string;
}

/** Timestamp of the most recent raw fs.watch event across every watched root, BEFORE
 *  debouncing -- used by getIndexFreshnessSignal() below to answer "is there a known change
 *  that the current in-memory index has not yet incorporated" even while the debounce timer is
 *  still pending or a rebuild is still in flight. */
let _lastChangeDetectedAt: number | null = null;
/** Result of the most recently COMPLETED watcher-triggered (or force-refresh-triggered)
 *  background rebuild attempt. `null` until the first one runs. */
let _lastRebuildOutcome: RebuildOutcome | null = null;
// D-BP223-BM0-X010-011B-STARTHANG (fix-forward on top of D-BP223-BM0-X010-011): `_rebuildInFlight`
// and `_lastRebuildStartedAt` used to be private to triggerBackgroundRebuild() -- warmEbletIndex()
// (the boot-time warm-up, index.ts's fire-and-forget call made BEFORE startEbletIndexWatchers())
// and forceRefreshEbletIndex() both called loadOrRebuildIndex() DIRECTLY, invisible to both the
// floor and the in-flight guard. On a live, continuously-writing estate (HARDWIRE churn, see
// D-BP223-BM0-X010-011's own measurement), the FIRST fs.watch event to settle after boot fires
// triggerBackgroundRebuild() while warmEbletIndex()'s own loadOrRebuildIndex() call is very
// plausibly still mid-walk -- and because _lastRebuildStartedAt was still 0 (warmEbletIndex()
// never set it) and _rebuildInFlight was still null (warmEbletIndex() never set that either), the
// floor check `_lastRebuildStartedAt > 0 && elapsed < MIN_REBUILD_INTERVAL_MS` evaluates false and
// the in-flight guard is a no-op: a SECOND, fully independent loadOrRebuildIndex() call starts,
// re-walking the same 50k+-file corpus and racing the first call's writeFileSync(tmp)/renameSync
// of the SAME eblet_index.jsonl.tmp path. Two synchronous full-corpus walks (each dominated by
// zero-yield statSync/readFileSync loops with no await inside them, see rootsMaxMtime() and the
// entries-loop above) racing on a live filesystem is the most direct, source-confirmed explanation
// for a boot that never reaches a window: whichever call is mid-walk when the second one starts
// monopolizes the single JS thread for however long ITS walk takes, and the two temp-file writers
// can contend for the same Windows file handle. FIX: every entry point into a background/warm
// rebuild (warmEbletIndex, forceRefreshEbletIndex, triggerBackgroundRebuild) now goes through
// runGuardedRebuild() below, which is the SOLE place `_rebuildInFlight`/`_lastRebuildStartedAt`
// are set -- a rebuild already in flight is coalesced (every caller awaits the SAME promise, not a
// fresh call), and the floor now correctly sees a boot-time warm-up as "a rebuild is running."
/** Guards against overlapping rebuilds from ANY entry point (boot warm-up, watcher-triggered,
 *  or explicit force-refresh) -- coalesces to one in-flight loadOrRebuildIndex() call rather than
 *  ever firing two concurrent walks of the same corpus. See runGuardedRebuild(). */
let _rebuildInFlight: Promise<EbletIndexEntry[]> | null = null;

const WATCH_DEBOUNCE_MS = 1500;
const _activeWatchers: FSWatcher[] = [];
const _watcherDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const _watcherSetupErrors: string[] = [];

// D-BP223-BM0-X010-011 (INDEXLOOP fix-forward): floor between watcher-triggered
// loadOrRebuildIndex() *executions*. WATCH_DEBOUNCE_MS only coalesces events within a single
// 1.5s settle window per root -- it does nothing to stop a root that keeps producing a fresh
// settle-worthy burst every few seconds, indefinitely, from re-running a FULL rebuild every
// single time. MEASURED (main.log, 2026-09-10 12:41-12:56 Central, pid 23004 pinned ~92% of
// one core): 101 real "[EbletIndex] Rebuilding index..." passes in ~15 minutes (~1 every 9s,
// some as close as 4.8s apart), each costing ~1.2-1.9s wall (readdirSync+statSync across
// 48,402 indexable files under 6 roots, dominated by LianaBanyanPlatform\HARDWIRE's 46,216 --
// ~48k new eblet files landed there the night before) PLUS an un-logged, equally expensive
// rootsMaxMtime()/treeMaxMtime() full-tree stat pass immediately before it. Every single one
// of those 101 rebuilds reported "48402/48402 unchanged+already-checked" -- the INDEXABLE
// content never changed; what changed was something else under the (continuously, actively
// written-to) HARDWIRE ledger tree bumping a directory or file mtime treeMaxMtime() picks up
// unconditionally (it is not filtered by isIndexableEbletFile the way walkEbletStore() is).
// Before the 48k-file jump this same mechanism existed but a full walk cost well under 100ms,
// so back-to-back triggers never overlapped and the loop was invisible.
//
// FIX (smallest available, single mechanism, no root scoping -- the Founder wants the
// substrate to see everything, not less): a floor on how often a watcher-triggered rebuild is
// allowed to actually RUN. invalidateIndexCache() below still fires on every settled debounce,
// same as before, so a query that arrives mid-floor still self-heals via loadOrRebuildIndex()'s
// own on-disk mtime check (see that function) and getIndexFreshnessSignal() still reports the
// pending change honestly -- this floor only paces the automatic BACKGROUND rebuild the watcher
// kicks off for its own sake, not correctness for an actual caller. A trigger that arrives
// inside the floor is not dropped: it is coalesced into one deferred retry for when the floor
// next opens, so the freshest known-pending state is always what eventually gets indexed.
// Overridable via MNEM_REBUILD_FLOOR_MS for fast, deterministic tests (see
// mnem_eblet_store.test.ts Test 4) -- production default is unaffected by that override being
// absent.
const MIN_REBUILD_INTERVAL_MS = (() => {
  const raw = process.env.MNEM_REBUILD_FLOOR_MS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 20_000;
})();
let _lastRebuildStartedAt = 0;
let _pendingRebuildFloorTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * D-BP223-BM0-X010-011B-STARTHANG: the SOLE place `_rebuildInFlight` and `_lastRebuildStartedAt`
 * are written. Every path that wants a rebuild to actually run (boot warm-up, an explicit
 * force-refresh, or a watcher trigger past the floor) calls this instead of `loadOrRebuildIndex()`
 * directly, so a rebuild that is already running -- from ANY of those three callers -- is always
 * visible to all the others: a second caller awaits the SAME in-flight promise instead of starting
 * an independent second full-corpus walk. Never throws (mirrors loadOrRebuildIndex()'s own
 * fail-soft-per-entry contract at the call-site level); a failure is recorded into
 * `_lastRebuildOutcome` and the empty/whatever-was-cached-before array is what callers observe via
 * a subsequent loadOrRebuildIndex() cache check, same as before this fix.
 */
function runGuardedRebuild(): Promise<EbletIndexEntry[]> {
  if (_rebuildInFlight) return _rebuildInFlight; // coalesce -- do not start a second walk
  _lastRebuildStartedAt = Date.now();
  _rebuildInFlight = (async () => {
    try {
      const entries = await loadOrRebuildIndex();
      _lastRebuildOutcome = { status: 'ok', at: Date.now() };
      return entries;
    } catch (e) {
      const reasonMsg = e instanceof Error ? (e.stack ?? e.message) : String(e);
      _lastRebuildOutcome = { status: 'failed', at: Date.now(), error: reasonMsg };
      console.error('[EbletIndex] guarded rebuild FAILED:', e);
      return [];
    } finally {
      _rebuildInFlight = null;
    }
  })();
  return _rebuildInFlight;
}

/**
 * Invalidate the cache immediately (so the NEXT query, whenever it comes, is forced to
 * re-check disk regardless of the 60s TTL) and kick a background rebuild so the index is
 * already warm by the time that query arrives. Coalesces concurrent calls into one in-flight
 * rebuild (via runGuardedRebuild(), shared with warmEbletIndex()/forceRefreshEbletIndex() -- see
 * that function's own comment for why sharing this guard across ALL three entry points is the
 * fix, not just this one), and paces repeated triggers to at most one real rebuild per
 * MIN_REBUILD_INTERVAL_MS (see that constant's own comment -- D-BP223-BM0-X010-011). Never
 * throws -- failure is recorded into `_lastRebuildOutcome`, not propagated, because this runs
 * from an fs.watch callback with no caller to report to.
 */
function triggerBackgroundRebuild(reason: string): void {
  invalidateIndexCache();
  if (_rebuildInFlight) return; // a rebuild is already in flight (from ANY entry point); it will pick up the latest state

  const elapsed = Date.now() - _lastRebuildStartedAt;
  if (_lastRebuildStartedAt > 0 && elapsed < MIN_REBUILD_INTERVAL_MS) {
    // Inside the floor: do not run a rebuild now, but do not drop this trigger either -- one
    // deferred retry is already enough to pick up EVERY event that arrived during the floor,
    // because triggerBackgroundRebuild() re-reads the (already invalidated) cache state when it
    // finally runs rather than replaying stale per-event data.
    if (!_pendingRebuildFloorTimer) {
      const delay = MIN_REBUILD_INTERVAL_MS - elapsed;
      _pendingRebuildFloorTimer = setTimeout(() => {
        _pendingRebuildFloorTimer = null;
        triggerBackgroundRebuild(`${reason} (deferred by rebuild floor, was ${delay}ms out)`);
      }, delay);
    }
    return;
  }

  // D-BP223-BM0-X030-004: name the trigger, so the next loop is diagnosable from main.log alone.
  console.log(`[EbletIndex] background rebuild triggered by ${reason}`);
  void runGuardedRebuild();
}

/**
 * Start one fs.watch() per resolved eblet store root (recursive for the normal roots, shallow
 * for SHALLOW_PATTERN_ROOTS -- matching walkShallowPatternRoot()'s own non-recursive scope so
 * the watcher's blast radius matches the indexer's). Idempotent: calling twice is a no-op if
 * watchers are already active, so app re-init paths can call this defensively. Safe to call
 * outside Electron (roots simply won't exist yet in most non-Electron test contexts, and
 * fs.watch on a missing path throws synchronously, caught per-root below) -- never throws.
 *
 * Fail-soft, NAMED: a root whose watcher fails to start (fs.watch throws, e.g. on a
 * filesystem/OS combination that does not support `recursive: true`) is recorded into
 * `_watcherSetupErrors` rather than silently leaving that one root unmonitored with no signal
 * -- surfaced via getEbletIndexStats().watcherErrors.
 */
/** D-BP223-BM0-X030-004: true when an fs.watch event could change the index for `root`.
 *  Exported for tests only. */
export function isWatchEventRelevant(
  root: string,
  filename: string | Buffer | null | undefined,
  eventType?: string,
): boolean {
  if (filename === null || filename === undefined) return true;
  const name = basename(String(filename));
  if (!name) return true;
  if (name.endsWith('.tmp')) return false;
  const hasExtension = /\.[A-Za-z0-9]{1,10}$/.test(name);
  if (!hasExtension) {
    // Windows recursive fs.watch reports a 'change' on a DIRECTORY whenever any child inside it
    // is modified (measured in Test 8: appending to LEDGER\churn.jsonl fired a 'change' for
    // "LEDGER"). The child's own event already carries its real file name, so a 'change' on an
    // existing directory adds nothing and is ignored. A 'rename' (created, deleted, renamed) or
    // a name that no longer exists stays relevant.
    if (eventType === 'change') {
      try {
        if (statSync(join(root, String(filename))).isDirectory()) return false;
      } catch { /* vanished: relevant */ }
    }
    return true;
  }
  return isIndexableEbletFile(name, root);
}

export function startEbletIndexWatchers(): void {
  if (_activeWatchers.length > 0) return; // already running
  const roots = getEbletStoreRoots();
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const shallow = SHALLOW_PATTERN_ROOTS.has(root);
    try {
      const watcher = watch(root, { recursive: !shallow }, (eventType, filename) => {
        // D-BP223-BM0-X030-004 (EbletIndex 20 s loop, part 1 of 3). MEASURED: the live estate
        // writes non-indexable files (ledger .jsonl/.json/.log, scripts, .tmp) under the watched
        // roots every few seconds, so a full rebuild ran every MIN_REBUILD_INTERVAL_MS (20 s)
        // indefinitely while every pass reported 0 new/changed entries. An event whose file name
        // carries an extension and is provably not indexable for this root is ignored here. An
        // event with no file name, or a name with no extension (a directory add/remove/rename),
        // still triggers, so coverage is not narrowed; the lazy TTL mtime check in
        // loadOrRebuildIndex() remains the backstop for anything this filter skips.
        if (!isWatchEventRelevant(root, filename, eventType)) return;
        _lastChangeDetectedAt = Date.now();
        const key = root; // one debounce timer per root -- rapid multi-file edits collapse to one rebuild
        const existing = _watcherDebounceTimers.get(key);
        if (existing) clearTimeout(existing);
        _watcherDebounceTimers.set(key, setTimeout(() => {
          _watcherDebounceTimers.delete(key);
          triggerBackgroundRebuild(`watch:${root}${filename ? `:${filename}` : ''}`);
        }, WATCH_DEBOUNCE_MS));
      });
      _activeWatchers.push(watcher);
    } catch (e) {
      const msg = `Failed to watch root "${root}" (recursive=${!shallow}): ${e instanceof Error ? e.message : String(e)}`;
      _watcherSetupErrors.push(msg);
      console.error(`[EbletIndex] ${msg}`);
    }
  }
  console.log(
    `[EbletIndex] keep-current watchers active on ${_activeWatchers.length}/${roots.length} root(s)` +
    (_watcherSetupErrors.length > 0 ? ` (${_watcherSetupErrors.length} failed to start, see watcherErrors)` : ''),
  );
}

/** Stop every active watcher (app shutdown / test teardown). */
export function stopEbletIndexWatchers(): void {
  for (const w of _activeWatchers.splice(0)) {
    try { w.close(); } catch { /* already closed */ }
  }
  for (const t of _watcherDebounceTimers.values()) clearTimeout(t);
  _watcherDebounceTimers.clear();
  // D-BP223-BM0-X010-011: also clear any pending rebuild-floor retry so teardown does not leave
  // a dangling setTimeout that fires triggerBackgroundRebuild() after watchers are stopped.
  if (_pendingRebuildFloorTimer) {
    clearTimeout(_pendingRebuildFloorTimer);
    _pendingRebuildFloorTimer = null;
  }
}

/**
 * Explicit force-refresh (constraint 3's "belt and suspenders" path): a caller that KNOWS it
 * just wrote a file (e.g. writeVerifiedEblet() below, or an MCP tool call made right after a
 * memory write) can demand a synchronous reread instead of waiting on the debounced watcher
 * path. Bypasses the 60s TTL and the watcher debounce entirely -- always re-checks disk NOW.
 * Never throws: a failure is recorded into `_lastRebuildOutcome` (same as the watcher path) and
 * surfaced in the returned stats' `refreshStatus`/`refreshError`, and the function still
 * returns the best available stats (the last-known-good in-memory index) rather than rejecting.
 */
export async function forceRefreshEbletIndex(): Promise<EbletIndexStats> {
  invalidateIndexCache();
  // D-BP223-BM0-X029-007. MEASURED ON M0 2026-09-16T19:29Z: resolveEbletStoreRoots() caches the roots that EXISTED at
  // first resolution. {userData}\eblets did not exist when M0's app started, so 190 Hollerith card eblets written there
  // (and every card a mesh library pull writes on a fresh node) stayed out of eblet_index.jsonl -- 0 matches after the
  // debounced rebuild -- until an app restart. A FORCED refresh is exactly the "I just wrote files, reread now" contract,
  // so it re-resolves the root list too. The lazy TTL path and the watchers are unchanged.
  _resolvedRootsCache = null;
  // D-BP223-BM0-X010-011B-STARTHANG: route through the SAME guard warmEbletIndex() and
  // triggerBackgroundRebuild() use (runGuardedRebuild()), never loadOrRebuildIndex() directly --
  // that direct-call gap (a boot-time or watcher-triggered rebuild invisible to this function,
  // and vice versa) is what let two full-corpus walks race each other. If one is already in
  // flight, await it first rather than stacking a second concurrent walk on top of it -- then
  // force one MORE guarded pass, because this function's documented contract ("I just wrote a
  // file, reread now") is not satisfied by an in-flight rebuild whose own rootsMaxMtime() snapshot
  // may predate that write; only a rebuild started AFTER the in-flight one finishes is guaranteed
  // to see it.
  if (_rebuildInFlight) {
    await _rebuildInFlight;
  }
  await runGuardedRebuild();
  return getEbletIndexStats();
}

/**
 * Constraint 3's "a refresh failure must be NAMED, never silent": answers whether the index a
 * query is about to be served from is known-possibly-stale, and why. Three independent signals,
 * any one of which is enough to report stale=true:
 *   1. A background rebuild attempt (watcher- or force-refresh-triggered) FAILED and no
 *      successful rebuild has happened since -- the in-memory index may already be behind disk
 *      and nothing is currently correcting it beyond the next lazy TTL check.
 *   2. A raw fs.watch event fired (a file changed) AFTER the current in-memory index was last
 *      loaded, and the debounced rebuild it should trigger has not completed yet -- a real
 *      change is known and not yet reflected.
 *   3. Zero watchers are active on this process (e.g. every root's fs.watch() call threw) --
 *      the automatic keep-current path does not exist at all for this session; only the 60s
 *      lazy TTL check and explicit force-refresh remain.
 * Cheap by design (compares timestamps already being tracked; no disk I/O) so it is safe to
 * call on every query.
 */
export function getIndexFreshnessSignal(): { stale: boolean; reason?: string } {
  if (_lastRebuildOutcome?.status === 'failed') {
    const sinceOk = _lastRebuildOutcome.at;
    if (!_indexCache || _indexCache.loadedAt <= sinceOk) {
      return {
        stale: true,
        reason: `last background index rebuild failed at ${new Date(_lastRebuildOutcome.at).toISOString()}: ${_lastRebuildOutcome.error}. Serving the last-known-good index; call mnem_force_refresh_substrate to retry.`,
      };
    }
  }
  if (_lastChangeDetectedAt !== null && (!_indexCache || _indexCache.loadedAt < _lastChangeDetectedAt)) {
    return {
      stale: true,
      reason: `a file change was detected at ${new Date(_lastChangeDetectedAt).toISOString()} that the current index (loaded ${_indexCache ? new Date(_indexCache.loadedAt).toISOString() : 'never'}) has not yet incorporated -- a debounced rebuild is pending or in flight.`,
    };
  }
  if (_activeWatchers.length === 0) {
    return {
      stale: true,
      reason: 'no keep-current watchers are active on this process (startEbletIndexWatchers() was not called, or every root failed to start -- see watcherErrors); the index only refreshes on the 60s lazy TTL check or an explicit force-refresh.',
    };
  }
  return { stale: false };
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
    // D-BP223-BM0-X010-011B-STARTHANG: runGuardedRebuild(), not loadOrRebuildIndex() directly --
    // this boot-time call must be visible to the SAME in-flight guard and MIN_REBUILD_INTERVAL_MS
    // floor that triggerBackgroundRebuild() uses, so a watcher event settling while this warm-up
    // is still mid-walk coalesces onto it instead of firing an independent second full-corpus
    // walk (see runGuardedRebuild()'s own comment for the race this closes). Fail-soft internally
    // (never throws), so the catch below now only guards getEbletIndexStats()/getEbletStoreRoots().
    const entries = await runGuardedRebuild();
    const stats = getEbletIndexStats();
    if (_lastRebuildOutcome?.status === 'failed') {
      console.error('[EbletIndex] warm-on-boot FAILED (non-fatal to app boot):', _lastRebuildOutcome.error);
      return {
        totalIndexed: stats.totalIndexed,
        byCategory: stats.byCategory,
        lastRefreshTimestamp: stats.lastRefreshTimestamp,
        status: 'failed',
        error: _lastRebuildOutcome.error,
      };
    }
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
  /** D-BP155-018: 'ok' when the most recent watcher/force-refresh-triggered background
   *  rebuild attempt succeeded (or none has run yet this process); 'failed' when it errored --
   *  see `refreshError`. Distinct from `status` above: `status` is warmEbletIndex()'s own
   *  boot-time outcome, this is the ONGOING keep-current path's outcome, which can flip to
   *  'failed' at any point during a long-running session after boot succeeded. */
  refreshStatus?: 'ok' | 'failed';
  refreshError?: string;
  /** Count of fs.watch() watchers currently active (one per resolved root, minus any that
   *  failed to start -- see watcherErrors). Zero means the automatic keep-current path is not
   *  running on this process at all. */
  watchersActive?: number;
  /** Non-empty when one or more roots' fs.watch() call threw at startEbletIndexWatchers() time
   *  (see that function's own doc comment) -- a root missing from this list's coverage but not
   *  named here would be a silent gap; this is the NAMED version. */
  watcherErrors?: string[];
  /** True when a known file change has not yet been incorporated into the in-memory index
   *  (debounced rebuild pending/in-flight) -- same signal getIndexFreshnessSignal() computes,
   *  duplicated onto stats for callers that only look at mnem_get_substrate_stats and never
   *  call mnem_query_substrate directly. */
  pendingChangeNotYetIndexed?: boolean;
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

  // D-BP155-018: refreshStatus/watchersActive/watcherErrors/pendingChangeNotYetIndexed are
  // process-wide keep-current bookkeeping, independent of whether `_indexCache` itself is
  // populated -- report them even on the "index not yet built" early return below, since a
  // caller checking freshness right after boot (before the first query has warmed the cache)
  // still needs to know whether watchers are even running.
  const refreshStatus = _lastRebuildOutcome?.status;
  const refreshError = _lastRebuildOutcome?.status === 'failed' ? _lastRebuildOutcome.error : undefined;
  const pendingChangeNotYetIndexed = _lastChangeDetectedAt !== null
    && (!_indexCache || _indexCache.loadedAt < _lastChangeDetectedAt);

  if (!_indexCache) {
    return {
      totalIndexed: 0,
      byCategory: {},
      lastRefreshTimestamp: indexMtime,
      refreshStatus,
      refreshError,
      watchersActive: _activeWatchers.length,
      watcherErrors: _watcherSetupErrors.length > 0 ? [..._watcherSetupErrors] : undefined,
      pendingChangeNotYetIndexed,
    };
  }
  const byCategory: Partial<Record<EbletCategory, number>> = {};
  for (const e of _indexCache.entries) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
  }
  return {
    totalIndexed: _indexCache.entries.length,
    byCategory,
    lastRefreshTimestamp: indexMtime,
    refreshStatus,
    refreshError,
    watchersActive: _activeWatchers.length,
    watcherErrors: _watcherSetupErrors.length > 0 ? [..._watcherSetupErrors] : undefined,
    pendingChangeNotYetIndexed,
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

// ─── BP155 Yoke: semantic scoring bounds (retrieval, not verbatim-serve) ──────
//
// Bound math (must-not-get-worse guarantee): PRIORITY_CATEGORIES' lowest CATEGORY_WEIGHT is
// 3 ('snapshot-canon'). The weakest possible REAL single-token BM25 hit in that category is
// `idf * 1 * 3` where `idf = log(1 + corpusSize)`. At this corpus's live size (~1,000-2,500
// entries after this Yoke's new roots), idf is ~6.9-7.8, so the weakest real keyword hit
// scores >=~20.7. SEMANTIC_ONLY_BASE + SEMANTIC_BOOST_WEIGHT (the maximum score a ZERO-
// keyword-overlap candidate can ever reach, at similarity 1.0) is capped at 0.5 + 8 = 8.5 --
// always less than the weakest real keyword hit. A pure-semantic candidate can therefore
// only ever fill space a keyword match left empty (top-3 has fewer than 3 real BM25 hits);
// it can never outrank or displace one. Real keyword hits (bm25 > 0) only ever gain an
// ADDITIVE bonus from semantic similarity (never a subtraction), so their score can only
// stay the same or increase relative to the pre-Yoke pure-BM25 ranking.
const SEMANTIC_BOOST_WEIGHT = 8;
const SEMANTIC_ONLY_BASE = 0.5;
/** Below SEMANTIC_SERVE_THRESHOLD (0.85, the verbatim-serve bar measured in the BP137 Yoke's
 *  Twain/Rand table) but above the worst measured false-positive (0.741, "Einstein's
 *  birthday" vs a stored Twain-birthday question) with real margin. This gate is for
 *  RETRIEVAL (adding an eblet to context), not verbatim-serve -- the cost of a false
 *  positive here is one extra loosely-related eblet in context, not a wrong fact served as
 *  true, so a somewhat lower bar than SEMANTIC_SERVE_THRESHOLD is an intentional, bounded
 *  risk, not a widened gate to force a pass. */
const SEMANTIC_RECALL_THRESHOLD = 0.80;

/** D-BP148-045/BISHOP (Wrasse Serving Path): one structured hit from the production
 *  eblet_index.jsonl corpus (914 records / 877 canon at time of writing) -- the SAME
 *  BM25-scored top-3 result queryEbletStore() below has always returned, just with
 *  `title`/`category`/`path` kept as separate fields instead of baked into one preformatted
 *  string. This is what lets a caller carry real identity (which file, which category)
 *  alongside the content it injects into a prompt, so an answer built from it can later be
 *  attributed/rooted -- queryEbletStore()'s plain string[] return has no way to do that. */
export interface EbletRetrievalHit {
  title: string;
  category: EbletCategory;
  path: string;
  /** First SNIPPET_WINDOW (500) chars of the source file -- same truncation
   *  queryEbletStore() has always applied, just exposed here rather than pre-joined into a
   *  formatted string. */
  content: string;
}

/**
 * D-BP148-045/BISHOP: the scoring engine shared by queryEbletStore() (below, preserved
 * byte-identical for its existing callers) and queryEbletStoreWithProvenance() (new,
 * structured). Extracted rather than duplicated so the two never drift -- both return
 * exactly the same top-3 BM25-over-canon/active/verified/snapshot-canon selection, one as
 * a formatted string[], one as EbletRetrievalHit[].
 *
 * Supports `category:<name>` prefix to force a specific category class:
 *   e.g. "category:pixie-dust cooperative economics"
 *
 * Default behaviour surfaces canon/active/snapshot-canon eblets only.
 * Historical-mine (pixie-dust) is only returned when explicitly requested.
 */
/** D-BP155-018 (supersession): the same filename-derived key used as `title`'s raw input
 *  (rawBase in loadOrRebuildIndex()) and as the value a file's own `supersedes:` frontmatter
 *  line names -- e.g. path `...\canon_memory_md_keyhole_640_lines_consolidation_needed_bp091
 *  .eblet.md` and frontmatter value `canon_memory_md_keyhole_640_lines_consolidation_needed_
 *  bp091` both reduce to this same key. Kept as a standalone function (not inlined at the two
 *  call sites) so the two derivations can never drift apart. */
function entryKey(fullPath: string): string {
  return fullPath.endsWith('.eblet.md') ? basename(fullPath, '.eblet.md') : basename(fullPath, '.md');
}

async function queryEbletStoreEntries(query: string): Promise<EbletRetrievalHit[]> {
  // Parse optional category:/tag: filter prefixes -- either or both, in any order, e.g.
  // "tag:big-kahuna category:canon cost collapse" or "category:canon tag:big-kahuna ...".
  // D-BP219-BM0-035: `tag:<slug>` is new this ticket, added alongside the pre-existing
  // `category:<name>` prefix rather than replacing it -- see this function's own header doc
  // comment (near EbletRetrievalHit) for the category: convention this mirrors. `<slug>` is
  // matched against an entry's normalized `tags` array (see parseTagsFromFrontmatter()); an
  // entry with `tags` still undefined (indexed before this feature, never backfilled) never
  // matches a tag: filter -- it is not silently treated as tagged or untagged either way,
  // it is simply excluded from a tag-filtered query until the next rebuild backfills it.
  let categoryFilter: EbletCategory | null = null;
  let tagFilter: string | null = null;
  let effectiveQuery = query;
  for (;;) {
    const catMatch = effectiveQuery.match(/^category:(\S+)\s*(.*)/i);
    if (catMatch) {
      categoryFilter = catMatch[1].toLowerCase() as EbletCategory;
      effectiveQuery = catMatch[2].trim();
      continue;
    }
    const tagMatch = effectiveQuery.match(/^tag:(\S+)\s*(.*)/i);
    if (tagMatch) {
      tagFilter = tagMatch[1].toLowerCase();
      effectiveQuery = tagMatch[2].trim();
      continue;
    }
    break;
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

  let candidates = indexEntries.filter((e) => allowedCategories.has(e.category));
  if (tagFilter) {
    candidates = candidates.filter((e) => e.tags?.includes(tagFilter as string));
  }
  if (candidates.length === 0) return [];

  // BP155 Yoke: one live embed call for the QUERY text only -- every candidate's
  // semanticCode is already persisted at index-build time (see loadOrRebuildIndex()), so
  // this NEVER re-embeds the corpus per query. Fails soft to null (Ollama down/timeout/
  // model missing) -- every branch below treats null exactly like "no candidate has a
  // semanticCode", which reproduces the pre-Yoke pure-BM25 ranking byte-for-byte.
  let queryCode: string | null = null;
  try {
    queryCode = await semantic_soccerball_emit(effectiveQuery);
  } catch {
    queryCode = null; // belt-and-suspenders; semantic_soccerball_emit is already fail-soft
  }

  // Score using snippet + title tokens (fast — no full file read)
  const scored = candidates
    .map((e) => {
      const tokens = Array.from(
        new Set([...tokenize(e.title), ...tokenize(e.snippet)]),
      );
      const bm25 = bm25Score(queryTokens, tokens, corpusSize, e.category);
      let semanticSim = 0;
      if (queryCode && e.semanticCode) {
        semanticSim = Math.max(0, computeSemanticSimilarity(queryCode, e.semanticCode));
      }
      let score: number;
      if (bm25 > 0) {
        // Real keyword hit -- semantic is an ADDITIVE tie-break bonus only, see the bound
        // math above SEMANTIC_BOOST_WEIGHT. Can only raise this candidate's score.
        score = bm25 + SEMANTIC_BOOST_WEIGHT * semanticSim;
      } else if (semanticSim >= SEMANTIC_RECALL_THRESHOLD) {
        // Zero keyword overlap, high semantic similarity -- new coverage this Yoke enables
        // (e.g. a paraphrased question whose answer lives in the memory root and shares no
        // BM25 token with the query). Capped below the weakest real single-token hit.
        score = SEMANTIC_ONLY_BASE + SEMANTIC_BOOST_WEIGHT * semanticSim;
      } else {
        score = 0;
      }
      return { entry: e, score, supersededByTitle: undefined as string | undefined };
    })
    .filter((r) => r.score > 0);

  // D-BP155-018 (supersession, minimum viable per ticket's "do not build a whole supersession
  // engine" instruction): only relevant when BOTH the superseding entry and the entry it names
  // actually matched THIS query (both present in `scored`, pre-slice) -- matching the ticket's
  // own condition, "when both match a query". A supersedes claim whose target never surfaces
  // for a given query needs no marker on that query's results.
  const scoredByKey = new Map(scored.map((r) => [entryKey(r.entry.path), r]));
  for (const r of scored) {
    if (!r.entry.supersedes) continue;
    const target = scoredByKey.get(r.entry.supersedes);
    if (!target || target === r) continue;
    // Demote (never remove -- the ticket requires a MARKER, not silent hiding) so the
    // superseded entry sorts below real hits instead of potentially outranking the doctrine
    // that corrects it; multiplied rather than zeroed so relative ordering among several
    // superseded entries is still meaningful if more than one is ever in play.
    target.score = target.score * 0.001;
    target.supersededByTitle = r.entry.title;
  }

  const winners = scored.sort((a, b) => b.score - a.score).slice(0, 3);

  // Lazy-load full body for top-3 winners only (SEG-3 discipline)
  const results: EbletRetrievalHit[] = [];
  for (const r of winners) {
    const marker = r.supersededByTitle
      ? `[SUPERSEDED BY "${r.supersededByTitle}" -- do not treat this as current guidance; retrieve that entry instead.]\n\n`
      : '';
    try {
      const raw = readFileSync(r.entry.path, 'utf-8');
      const content = marker + raw.slice(0, SNIPPET_WINDOW);
      results.push({ title: r.entry.title, category: r.entry.category, path: r.entry.path, content });
    } catch {
      results.push({ title: r.entry.title, category: r.entry.category, path: r.entry.path, content: marker + r.entry.snippet });
    }
  }
  return results;
}

/**
 * SEG-4: Query the local eblet store for files matching the user query.
 *
 * Supports `category:<name>` prefix to force a specific category class:
 *   e.g. "category:pixie-dust cooperative economics"
 *
 * Default behaviour surfaces canon/active/snapshot-canon eblets only.
 * Historical-mine (pixie-dust) is only returned when explicitly requested.
 *
 * Returns top-3 eblet snippets as string[]. Byte-identical to pre-D-BP148-045 behavior --
 * this is now a thin formatter over queryEbletStoreEntries().
 */
export async function queryEbletStore(query: string): Promise<string[]> {
  const hits = await queryEbletStoreEntries(query);
  return hits.map((h) => `[${h.title}] [category: ${h.category}]\n${h.content}`);
}

/** D-BP148-045/BISHOP (Wrasse Serving Path): same top-3 BM25 selection as queryEbletStore()
 *  above, structured so identity (title/category/path) survives alongside content instead of
 *  being pre-joined into one opaque string -- see EbletRetrievalHit's own doc comment for why
 *  this matters (provenance/rooting). New export; queryEbletStore()'s existing callers
 *  (mcp_server.ts, librarian_corps/*, substrace/wake_router.ts, the orphaned
 *  ai-dispatch:query handler) are completely untouched. */
export async function queryEbletStoreWithProvenance(query: string): Promise<EbletRetrievalHit[]> {
  return queryEbletStoreEntries(query);
}

// ─── SEG-4 v0.1.56: Verified eblet writer · SEG-1 v0.1.57: HOT retrieve path ──

export interface VerifiedEbletEntry {
  /** D-BP223-BM0-X030-073, READ-TIME ONLY (never written): set by applyReuseFreshness() in queryVerifiedEblets. Absent means
   *  the entry was not checked (other readers). 'prior_record_reverify' entries must never be served as verified. */
  reuse_state?: ReuseState;
  reuse_label?: string;
  freshness?: ReuseDecision;
  /** D-BP223-BM0-X030-073, OPTIONAL metadata a writer may set to pin the freshness class (canon | volatile | general). */
  freshness_class?: 'canon' | 'volatile' | 'general';
  tags?: string[];
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
    // D-BP148-037/BISHOP/critical-discard-fixes FIX: `corroboration` was accepted as a write-time
    // INPUT to computeHonestVerification() above (it decides verified/verdict) but was never
    // itself persisted to the JSONL line -- the identical D-BP148-034 gap already fixed in this
    // function's sibling writeVerifiedEblet() (see that function's own line-level comment, commit
    // 7b69bb84), just not swept up here. StoredRejectedOptionEblet extends
    // RejectedOptionEbletEntry and promises this field on every stored row; without this line it
    // could never actually be present at runtime. Purely additive/omitted-when-undefined, same
    // convention as writeVerifiedEblet()'s own corroboration line -- does not change the
    // derivation of `verified`/`verdict` above (still computed once, at write time, via
    // computeHonestVerification()), does not change classifyCorroborationTier() or isRooted()
    // (rooting_rule.ts untouched), and does not retroactively alter any existing line already on
    // disk (Rule 66 -- old rows simply continue to have no `corroboration` field).
    ...(entry.corroboration !== undefined ? { corroboration: entry.corroboration } : {}),
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

/** D-BP166-M0-017/BISHOP/seg-retrieval-class-filter: benchmark-seed-vs-operating admissibility
 *  gate, a NEW axis distinct from the four contamination quarantines above (FIX 1-4 all concern
 *  answer-key leaks / bad-writer shapes; this concerns whether a record is genuine operating
 *  knowledge at all). D-BP166-M0-009 (prior read-only SEG) measured the live
 *  %APPDATA%\MnemosyneC\substrate\verified_eblets.jsonl (301 records): 280 carry a
 *  `starter_chocolate:`-prefixed provenance and are MMLU-style benchmark trivia seeded for
 *  measurement (e.g. "What does the Pythagorean theorem state?"); the other 21 carry a
 *  `sprite:`-prefixed provenance and are genuine operational records. This dispatch re-measured
 *  the same live file directly (scratchpad/prefix_scan.js, 2026-08-24): confirmed exactly two
 *  provenance prefixes exist among all 301 records, `starter_chocolate` (280) and `sprite` (21) --
 *  no other benchmark-ish prefix is present, so `starter_chocolate:` is the correct and complete
 *  discriminator today. NOTE: the VerifiedEbletEntry.provenance doc comment above (line ~1514)
 *  claims the format is `spider:<name>:<session> | sprite:<id>:<session>` -- that comment is
 *  STALE against the live data (neither `spider:` nor `starter_chocolate:` matches its claimed
 *  shape); flagged here rather than silently fixed, since correcting that comment is out of this
 *  dispatch's authorized scope.
 *
 *  Rule 66 / vault-sacrosanct: quarantine BY NON-RETRIEVAL ONLY, same convention as the four
 *  predicates above -- the record stays on disk, byte-identical, forever. This predicate is
 *  OPT-IN exclusion (default-admitted) via the `admitBenchmarkSeed` parameter on
 *  queryVerifiedEbletsTopical, not a standing quarantine like FIX 1-4: callers that want
 *  benchmark trivia excluded from an operating-question's retrieved context pass
 *  `admitBenchmarkSeed: false`; every existing caller that does not pass it keeps receiving
 *  benchmark-seed content exactly as before (back-compat mandatory). */
const BENCHMARK_SEED_PROVENANCE_PREFIXES = ['starter_chocolate'];

export function isBenchmarkSeedEblet(
  entry: Pick<VerifiedEbletEntry, 'provenance'>,
): boolean {
  const provenance = entry.provenance ?? '';
  const prefix = provenance.split(':')[0];
  return BENCHMARK_SEED_PROVENANCE_PREFIXES.includes(prefix);
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
/** D-BP223-X043-002-A (0.9.40), FOUNDER RULING, NEW MEANING: "a near match becomes a
 *  SUGGESTION, never the served answer." The name is kept because other code imports it, but
 *  this value is no longer a serve bar on the chat path. In ai_dispatch_ipc.ts a stored question
 *  that clears it WITHOUT being an exact normalized match is returned as `nearMatchSuggestion`
 *  ("A similar question was answered before: open it?") while the question still goes to the
 *  normal answer path; only an exact match serves from the record. It also remains the
 *  semantic discriminating floor the CSIA Psionic fast path must clear (necessary, no longer
 *  sufficient: that path now also requires an exact question match). See near_match_suggestion.ts. */
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

/** D-BP223-BM0-X030-073: an appended correction row, not a Q/A entry. */
export function isCorrectionShapedRow(row: unknown): boolean {
  if (!row || typeof row !== 'object') return false;
  const r = row as Record<string, unknown>;
  const k = String(r.kind ?? '').toLowerCase();
  const a = String(r.addendum_type ?? '').toLowerCase();
  return k === 'correction' || k === 'supersede' || k === 'superseded' || a === 'correction' || a === 'supersede' || a === 'source';
}

/** D-BP223-BM0-X030-073: the reuse check. Drops corrected entries, labels aged ones. Pure; exported for tests. */
export function applyReuseFreshness(entries: VerifiedEbletEntry[], corrections: CorrectionRecord[], nowMs: number): VerifiedEbletEntry[] {
  const out: VerifiedEbletEntry[] = [];
  let corrected = 0;
  let aged = 0;
  for (const e of entries) {
    const d = reuseDecision({ question: e.question, provenance: e.provenance, sha256: e.sha256, timestamp: e.timestamp, freshness_class: e.freshness_class, tags: e.tags }, nowMs, corrections);
    if (d.state === 'corrected') { corrected++; continue; }
    if (d.state === 'prior_record_reverify') aged++;
    out.push({ ...e, reuse_state: d.state, reuse_label: d.label, freshness: d });
  }
  if (corrected || aged) {
    console.log(`[EbletStore] queryVerifiedEblets: ${corrected} corrected entry(ies) withheld as the old answer, ${aged} aged entry(ies) labeled "Prior record, re-verify" (X030-073, nothing on disk touched)`);
  }
  return out;
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
  // D-BP223-BM0-X030-073: appended correction rows (kind correction/supersede, or a correction/source addendum) live in the
  // same append-only file. They carry no question/answer, so the filter below never admitted them; they are now read here.
  const correctionRows: CorrectionRecord[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as Partial<VerifiedEbletEntry> & CorrectionRecord;
      if (isCorrectionShapedRow(parsed)) {
        correctionRows.push(parsed as CorrectionRecord);
        continue;
      }
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
  const afterEmptyBody = afterScrapeShapeQuarantine.filter((e) => !isEmptyAnswerBodyShapedEblet(e));
  const emptyBodyQuarantinedCount = afterScrapeShapeQuarantine.length - afterEmptyBody.length;
  if (emptyBodyQuarantinedCount > 0) {
    console.log(
      `[EbletStore] queryVerifiedEblets: excluded ${emptyBodyQuarantinedCount} empty-answer-body ` +
      `bare-letter eblet(s) from retrieval (KN-BP142-6 FIX 4, Rule 66 quarantine-by-non-retrieval, ` +
      `not deleted)`,
    );
  }

  // D-BP223-BM0-X030-073 STALE CUTOFF C: correction first, then age on the existing decay score (card_freshness.ts).
  // A corrected entry is never returned as the old answer. An aged entry is returned labeled "Prior record, re-verify"
  // (reuse_state prior_record_reverify), and the serve gate in ai_dispatch_ipc.ts never serves it as verified.
  const entries = applyReuseFreshness(afterEmptyBody, correctionRows, Date.now());

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
  // D-BP166-M0-017/BISHOP/seg-retrieval-class-filter: OPTIONAL, defaults to true == existing
  // behavior unchanged (back-compat mandatory, no existing caller's output changes without an
  // explicit edit to pass false). See isBenchmarkSeedEblet()'s doc comment above for what this
  // excludes and why.
  admitBenchmarkSeed = true,
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
  const entriesAfterQuarantine = afterScrapeShapeQuarantine.filter((e) => !isEmptyAnswerBodyShapedEblet(e));
  const emptyBodyQuarantinedCount = afterScrapeShapeQuarantine.length - entriesAfterQuarantine.length;
  if (emptyBodyQuarantinedCount > 0) {
    console.log(
      `[EbletStore] queryVerifiedEbletsTopical: excluded ${emptyBodyQuarantinedCount} ` +
      `empty-answer-body bare-letter eblet(s) from retrieval for domain=${domain} (KN-BP142-6 ` +
      `FIX 4, Rule 66 quarantine-by-non-retrieval, not deleted)`,
    );
  }

  // D-BP166-M0-017/BISHOP/seg-retrieval-class-filter: benchmark-seed admissibility gate, opt-in
  // exclusion only (see isBenchmarkSeedEblet()'s doc comment above). FAIL OPEN (Law 3): if
  // excluding benchmark-seed content would empty the result set, fall back to the unfiltered set
  // and log rather than returning nothing.
  let entries = entriesAfterQuarantine;
  if (!admitBenchmarkSeed) {
    const afterBenchmarkSeedFilter = entriesAfterQuarantine.filter((e) => !isBenchmarkSeedEblet(e));
    const benchmarkSeedFilteredCount = entriesAfterQuarantine.length - afterBenchmarkSeedFilter.length;
    if (afterBenchmarkSeedFilter.length === 0 && entriesAfterQuarantine.length > 0) {
      console.log(
        `[EbletStore] queryVerifiedEbletsTopical: benchmark-seed filter (admitBenchmarkSeed=false) ` +
        `would empty the result set for domain=${domain} (${benchmarkSeedFilteredCount} excluded of ` +
        `${entriesAfterQuarantine.length}); FAILING OPEN to the unfiltered set rather than returning nothing`,
      );
    } else {
      entries = afterBenchmarkSeedFilter;
      if (benchmarkSeedFilteredCount > 0) {
        console.log(
          `[EbletStore] queryVerifiedEbletsTopical: excluded ${benchmarkSeedFilteredCount} ` +
          `benchmark-seed eblet(s) (admitBenchmarkSeed=false) from retrieval for domain=${domain}`,
        );
      }
    }
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
