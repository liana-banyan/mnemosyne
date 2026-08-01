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
import { app } from 'electron';
// BP137 Yoke (Semantic Match Durable): additive semantic-code primitive, see
// semantic_soccerball.ts header for the full honesty-mandate evidence (Ollama embed test
// results) and fail-soft contract. Does not create an import cycle -- semantic_soccerball.ts
// only imports ollama_manager.ts.
import { semantic_soccerball_emit, computeSemanticSimilarity } from './semantic_soccerball';

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
  if (app.isPackaged && packaged) return packaged;
  return resolve(app.getAppPath(), 'resources', 'eblets_default');
}

/** Resolve + cache the live list of eblet store roots that actually exist on this machine. */
function resolveEbletStoreRoots(): string[] {
  if (_resolvedRootsCache) return _resolvedRootsCache.roots;

  const candidates: string[] = [];

  const envOverride = process.env.MNEM_EBLET_STORE_ROOTS;
  if (envOverride) {
    candidates.push(...envOverride.split(require('path').delimiter).map((p) => p.trim()).filter(Boolean));
  }

  candidates.push(bundledDefaultEbletRoot());
  candidates.push(resolve(app.getPath('userData'), 'eblets'));

  const resolved = candidates.filter((root) => {
    try { return existsSync(root); } catch { return false; }
  });

  if (resolved.length === 0) {
    // Truth-Always: this used to be a silent [] return with no signal anywhere.
    console.error(
      `[EbletStore] WARNING: zero eblet store roots resolved on this machine — the substrate ` +
      `is EMPTY. Every Ask will run with no eblet context. Checked: ${candidates.join(' | ')}. ` +
      `Set MNEM_EBLET_STORE_ROOTS or place eblets in ${resolve(app.getPath('userData'), 'eblets')}.`
    );
    for (const win of require('electron').BrowserWindow.getAllWindows() as import('electron').BrowserWindow[]) {
      if (!win.isDestroyed()) {
        win.webContents.send('eblet-store:diagnostic', {
          kind: 'zero_roots_resolved',
          message: 'No eblet store found on this machine — Ask will run without substrate context.',
          checked: candidates,
          userDataFallback: resolve(app.getPath('userData'), 'eblets'),
          at: new Date().toISOString(),
        });
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

/**
 * SEG-1: Recursively walk `root` and collect all *.eblet.md paths.
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
      } else if (entry.name.endsWith('.eblet.md')) {
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
  return resolve(app.getPath('userData'), 'mnemosynec', 'substrate', 'eblet_index.jsonl');
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
      const title = basename(fullPath, '.eblet.md').replace(/_/g, ' ').slice(0, 120);
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
    return stats;
  } catch (e) {
    console.error('[EbletIndex] warm-on-boot failed (non-fatal):', e);
    return { totalIndexed: 0, byCategory: {}, lastRefreshTimestamp: null };
  }
}

// ─── Index stats ──────────────────────────────────────────────────────────────

export interface EbletIndexStats {
  totalIndexed: number;
  byCategory: Partial<Record<EbletCategory, number>>;
  lastRefreshTimestamp: number | null;
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
  /** BP131 honesty fix, ADDITIVE/OPTIONAL. Caller-supplied hint about WHY this answer is being
   *  offered as verified, consumed by computeHonestVerification() at write time (see below) --
   *  never trusted blindly, only used to select among the three legitimate accept classes:
   *  'concordant' (2+ independent authorities/voters genuinely agreed -- an ensemble CONCORDANT
   *  accept, NOT a single_* accept), 'deterministic_compute' (a calculator/solver proved the
   *  answer, no LLM/authority guess involved), 'coroner_verified' (answer_coroner.ts explicitly
   *  ratified this as verified). 'single_authority' and 'coroner_unverified' are also accepted
   *  values so a caller can be explicit about a NON-qualifying signal (lone uncorroborated
   *  authority, or an explicit Coroner rejection) rather than leaving the field absent -- both
   *  resolve to the same honest verified:false/verdict:'unverified' outcome as leaving it unset.
   *  BP-COMPUTE-HONEST-DEMOTE addition: 'authority_extracted_compute' -- a real, checked
   *  unit-conversion/tolerance-match ran (never a guess), but the quantity it converted was
   *  extracted from an authority/LLM's own reasoning or fact text (compute_sidecar.ts
   *  UnitAwareComputeResult's `source: 'reasoning_fact'`, paths (a)/(c)) rather than a literal
   *  expression present in the question itself (path (b), which alone still earns
   *  'deterministic_compute'). Deliberately NOT one of computeHonestVerification()'s three accept
   *  classes below -- it has no independent grounding of its own (it is a derived restatement of
   *  another candidate's claim), so it resolves to the same honest verified:false/verdict:
   *  'unverified' outcome as 'single_authority'. */
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
  const ebletFile = resolve(app.getPath('userData'), 'substrate', 'verified_eblets.jsonl');
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
  const entries = afterAnswerKeyShapeQuarantine.filter((e) => !isFactVerdictInadmissibleForRetrieval(e));
  const factVerdictQuarantinedCount = afterAnswerKeyShapeQuarantine.length - entries.length;
  if (factVerdictQuarantinedCount > 0) {
    console.log(
      `[EbletStore] queryVerifiedEblets: excluded ${factVerdictQuarantinedCount} eblet(s) with an ` +
      `inadmissible factVerdict (R/O/B/Y) from retrieval (KN-BP141-5 FIX 2, Rule 66 quarantine-by-` +
      `non-retrieval, not deleted)`,
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
    const nonComponent = exactMatches.filter((e) => e.class !== 'component');
    const component = exactMatches.filter((e) => e.class === 'component');
    return [...nonComponent, ...component];
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
  const ebletFile = resolve(app.getPath('userData'), 'substrate', 'verified_eblets.jsonl');
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
  const entries = afterAnswerKeyShapeQuarantine.filter((e) => !isFactVerdictInadmissibleForRetrieval(e));
  const factVerdictQuarantinedCount = afterAnswerKeyShapeQuarantine.length - entries.length;
  if (factVerdictQuarantinedCount > 0) {
    console.log(
      `[EbletStore] queryVerifiedEbletsTopical: excluded ${factVerdictQuarantinedCount} eblet(s) ` +
      `with an inadmissible factVerdict (R/O/B/Y) from retrieval for domain=${domain} (KN-BP141-5 ` +
      `FIX 2, Rule 66 quarantine-by-non-retrieval, not deleted)`,
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

  const ebletFile = resolve(app.getPath('userData'), 'substrate', 'verified_eblets.jsonl');

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
  const ebletDir = resolve(app.getPath('userData'), 'substrate');
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
 * BP131 honesty fix: the SINGLE centralized predicate that decides whether a write to
 * verified_eblets.jsonl may honestly carry `verified:true`/`verdict:'verified'`.
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
 * Accept classes (verified:true, verdict:'verified') -- exactly three, matching Founder-ratified
 * BP131 build spec:
 *   1. Deterministic-compute provenance: `provenance` contains 'deterministic_compute' or
 *      'schedule_amortization' (a calculator/solver proved the answer, no LLM guess involved),
 *      OR the caller explicitly passes `corroboration: 'deterministic_compute'`.
 *   2. Genuine multi-source concordance: caller passes `corroboration: 'concordant'` (2+
 *      independent authorities/voters actually agreed -- an ensemble CONCORDANT accept, never a
 *      single_* accept).
 *   3. Explicit Coroner ratification: caller passes `corroboration: 'coroner_verified'`
 *      (answer_coroner.ts's own verified verdict).
 * Reject class (verified:false, verdict:'unverified') -- the default/fail-closed outcome for
 * everything else, INCLUDING a lone single_google/single_perplexity/single_wolfram accept, an
 * explicit `corroboration: 'single_authority'` or `'coroner_unverified'`, or no corroboration
 * signal supplied at all. Fail-closed by design: absence of a qualifying signal must never be
 * silently upgraded to verified:true. BP-COMPUTE-HONEST-DEMOTE: `corroboration:
 * 'authority_extracted_compute'` also falls into this reject class, deliberately -- it is a real
 * checked computation with no independent grounding (see that literal's own doc comment above),
 * so callers must ALSO make sure `provenance` never contains the literal substring
 * 'deterministic_compute' for such a write (the `deterministicByProvenance` check just below is a
 * second, independent way to reach `accepted`, and would otherwise silently re-grant verified:true
 * regardless of this corroboration value).
 *
 * ORTHOGONAL AXIS carve-out: `verdict` also carries a second, pre-existing, unrelated meaning --
 * 'correct'/'wrong' ground-truth grading against a TEST'S OWN answer key (mesh-test/benchmark
 * mode only, e.g. plow_mc_answerer.ts's verdictForLedger comparing the plow's chosenLetter to
 * testModeCorrectAnswerLetter). That is a real, already-truthful signal -- substrate_toggle.ts's
 * formatHit() reads verdict==='wrong' to inject a live "KNOWN-WRONG (avoid)" marker for future
 * voters, a genuine in-use feature. It must not be clobbered by this predicate: if the caller
 * supplies `verdict: 'correct'` or `'wrong'`, that value is preserved VERBATIM (never
 * overwritten to 'verified'/'unverified') -- `verified` is still independently computed from
 * corroboration/provenance as above, since "matched the test's answer key" and "was externally
 * corroborated" are different claims (a lucky single-authority guess that happens to match the
 * key is still not verified). The one invariant that must always hold is the task's actual
 * concern -- verified:true never paired with an honestly-unconfirmed verdict; 'correct'/'wrong'
 * are grading outcomes, not "unconfirmed", so this carve-out cannot reintroduce that bug.
 */
export function computeHonestVerification(
  entry: Pick<VerifiedEbletEntry, 'provenance' | 'corroboration' | 'verdict'>,
): { verified: boolean; verdict: 'correct' | 'wrong' | 'verified' | 'unverified' } {
  const provenance = entry.provenance ?? '';
  const deterministicByProvenance =
    provenance.includes('deterministic_compute') || provenance.includes('schedule_amortization');

  const accepted =
    entry.corroboration === 'coroner_verified' ||
    entry.corroboration === 'concordant' ||
    entry.corroboration === 'deterministic_compute' ||
    // coroner_unverified is an explicit REJECTION and must win over a provenance-string match --
    // checked first via the ternary ordering below, not here.
    (entry.corroboration !== 'coroner_unverified' && deterministicByProvenance);

  const verified = entry.corroboration === 'coroner_unverified' ? false : accepted;

  // Ground-truth grading carve-out (see doc comment above): preserve a real 'correct'/'wrong'
  // grade verbatim; only ever synthesize 'verified'/'unverified' when the caller did NOT supply
  // one of those two ground-truth values.
  if (entry.verdict === 'correct' || entry.verdict === 'wrong') {
    return { verified, verdict: entry.verdict };
  }
  return { verified, verdict: verified ? 'verified' : 'unverified' };
}

/**
 * Append a plow-accepted eblet to the persistent store.
 *
 * Store location: {userData}/substrate/verified_eblets.jsonl (append-only JSONL).
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

  const ebletDir = resolve(app.getPath('userData'), 'substrate');
  const ebletFile = resolve(ebletDir, 'verified_eblets.jsonl');

  if (!existsSync(ebletDir)) {
    mkdirSync(ebletDir, { recursive: true });
  }

  const expectedSha = createHash('sha256')
    .update(entry.question + entry.answer)
    .digest('hex');

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
  const ebletFile = resolve(app.getPath('userData'), 'substrate', 'verified_eblets.jsonl');
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
