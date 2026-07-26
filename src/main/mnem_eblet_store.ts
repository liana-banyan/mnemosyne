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
  verified: true;       // Andon: ONLY true entries may be written here
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
  verdict?: 'correct' | 'wrong' | 'unverified';
  /** 0-1, derived from concordance/BMV at write time (see computeArgumentConfidence() in
   *  canonical_pipeline.ts) -- how much the writing pipeline itself trusted this fact. */
  confidence?: number;
}

/** Backward-compat accessor (item 6): every reader that cares about verdict should go through
 *  this instead of reading entry.verdict directly, so "field absent" and "field explicitly
 *  unverified" are handled identically without duplicating the ?? fallback at every call site. */
export function readVerdict(entry: VerifiedEbletEntry): 'correct' | 'wrong' | 'unverified' {
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

/**
 * Module-scoped telemetry counters for the HOT retrieve path.
 * Callers (ai_dispatch_ipc) increment these after each queryVerifiedEblets() call.
 * Exported as a mutable object so cross-module increments are type-safe.
 */
export const substrateCounters = { hotHits: 0, coldCalls: 0 };

const VERIFIED_STOP_WORDS = new Set([
  'the', 'a', 'is', 'what', 'how', 'why', 'when', 'where', 'who', 'of',
  'in', 'on', 'at', 'to', 'for', 'with', 'an', 'and', 'or', 'not', 'be',
  'are', 'was', 'were',
]);

function tokenizeQuestion(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0)
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
      console.warn('[SubstrateHOT] Malformed verified_eblets line skipped:', trimmed.slice(0, 80));
    }
  }

  if (entries.length === 0) return [];

  // Exact match on question text (case-insensitive, trimmed)
  const qNorm = question.trim().toLowerCase();
  const exact = entries.find((e) => e.question.trim().toLowerCase() === qNorm);
  if (exact) return [exact];

  // Keyword fallback
  const qTokens = tokenizeQuestion(question);
  if (qTokens.length === 0) return [];
  const qSet = new Set(qTokens);

  const scored = entries.map((e) => {
    const corpus = tokenizeQuestion(e.question + ' ' + e.answer);
    let score = 0;
    for (const tok of qSet) {
      score += corpus.filter((t) => t === tok).length;
    }
    return { entry: e, score };
  });

  return scored
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || b.entry.timestamp - a.entry.timestamp)
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

  const entries: VerifiedEbletEntry[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as Partial<VerifiedEbletEntry>;
      if (parsed.question && parsed.answer && parsed.sha256 && parsed.verified === true) {
        entries.push(parsed as VerifiedEbletEntry);
      }
    } catch { /* skip malformed */ }
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
 * Run on app startup: scan verified_eblets.jsonl, quarantine malformed or
 * unverified lines, rewrite clean file atomically.
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

    if (parsed.verified !== true) {
      result.verifiedFalseLines++;
      result.quarantined++;
      quarantineLines.push(trimmed);
      continue;
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
 * Append a plow-accepted, specialist-verified Q&A eblet to the persistent store.
 *
 * Store location: {userData}/substrate/verified_eblets.jsonl (append-only JSONL).
 * Andon discipline: the `verified: true` field is structurally required; callers that
 * cannot supply it (e.g., unverified Ollama raw output) must NOT call this function.
 *
 * Returns the sha256 of (question + answer) as write confirmation.
 */
export async function writeVerifiedEblet(entry: VerifiedEbletEntry): Promise<string> {
  if (!entry.verified) {
    console.error('[EbletStore] Andon violation: attempted write with verified=false — blocked');
    return '';
  }

  const ebletDir = resolve(app.getPath('userData'), 'substrate');
  const ebletFile = resolve(ebletDir, 'verified_eblets.jsonl');

  if (!existsSync(ebletDir)) {
    mkdirSync(ebletDir, { recursive: true });
  }

  const expectedSha = createHash('sha256')
    .update(entry.question + entry.answer)
    .digest('hex');

  const line = JSON.stringify({
    question: entry.question,
    answer: entry.answer,
    provenance: entry.provenance,
    verified: true,
    sha256: expectedSha,
    timestamp: entry.timestamp,
    // BP135 Yoke #34 argument-ledger (0.9.7): additive, omitted entirely (not written as null/
    // undefined) when the caller doesn't supply them -- keeps every pre-0.9.7 caller's output
    // byte-identical and keeps old JSONL lines structurally indistinguishable from a 0.9.7 write
    // that simply chose not to populate these optional fields.
    ...(entry.reasoning !== undefined ? { reasoning: entry.reasoning } : {}),
    ...(entry.verdict !== undefined ? { verdict: entry.verdict } : {}),
    ...(entry.confidence !== undefined ? { confidence: entry.confidence } : {}),
  });

  appendFileSync(ebletFile, line + '\n', 'utf-8');
  return expectedSha;
}
