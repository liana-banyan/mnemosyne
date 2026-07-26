// chocolate_consolidator.ts — BP134 Yoke #32 Phase G: "improves-over-time"
//
// Runtime library version of scripts/build_chocolate_packages.mjs (Phase E). The standalone
// script is a dev-time build tool (run manually, output committed to resources/chocolates/
// for shipping in the app bundle). THIS module is the live, in-app path: it reuses the exact
// same dedup + provenance-bucketing algorithm, but:
//   - reads the live store via app.getPath('userData') directly (no platform guesswork --
//     we're already inside Electron, unlike the standalone script)
//   - writes into {userData}/chocolates/ (a writable, per-user location) rather than the
//     app's own resources/ directory, which is read-only/reinstalled-on-update in a packaged
//     build and typically requires elevated permissions to write into (e.g. Program Files)
//   - is invoked automatically on quit (best-effort, time-boxed) AND on-demand via the
//     "Refresh Chocolate Pack" button (TestItOutTab.tsx) / plow:refresh-chocolate-pack IPC
//
// "Improves over time": every quit (and every manual refresh) re-reads the live substrate,
// re-dedupes on sha256(question+answer) (mandatory per the Yoke), and rewrites the 14
// category files + manifest.json. Nothing is ever silently dropped -- ambiguous provenance
// buckets into 'other', never discarded (same discipline as Phase E).

import { createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, delimiter } from 'path';
import { app } from 'electron';

const CATEGORIES = [
  'math', 'physics', 'chemistry', 'biology', 'computer_science', 'engineering',
  'history', 'philosophy', 'law', 'business', 'economics', 'psychology', 'health',
  'other',
];
const CATEGORY_SET = new Set(CATEGORIES);

interface RawEbletSource { label: string; path: string }

interface ConsolidatedEblet {
  question: string;
  answer: string;
  provenance: string;
  verified: true;
  sha256: string;
  timestamp: number;
}

export interface ChocolateCategoryManifestEntry {
  category: string;
  count: number;
  version: string;
  generated_at: string;
  source_mix: { canonical_plow: number; starter_chocolate: number; plow_field: number; other: number };
}

export interface ChocolateConsolidationManifest {
  version: string;
  generatedAt: string;
  totalEblets: number;
  totalSourcesRead: number;
  totalRecordsRead: number;
  totalDuplicatesRemoved: number;
  totalMalformedSkipped: number;
  sources: Array<{ label: string; path: string }>;
  categories: ChocolateCategoryManifestEntry[];
  outputDir: string;
}

/** Where Phase G writes the refreshed, live-improving packages -- writable in every install
 *  mode (dev or packaged), unlike resources/chocolates/ (Phase E's dev-time build target). */
function chocolatePackOutputDir(): string {
  return join(app.getPath('userData'), 'chocolates');
}

/** The bundled seed (Phase A) -- read-only, resolved the same way installStarterChocolate does. */
function starterChocolateSeedPath(): string {
  const packedPath = join(process.resourcesPath ?? '', 'chocolates', 'starter_chocolate.jsonl');
  const devPath = join(app.getAppPath(), 'resources', 'chocolates', 'starter_chocolate.jsonl');
  return existsSync(packedPath) ? packedPath : devPath;
}

function inventorySources(): RawEbletSource[] {
  const sources: RawEbletSource[] = [
    { label: 'live_substrate', path: join(app.getPath('userData'), 'substrate', 'verified_eblets.jsonl') },
    { label: 'starter_chocolate_seed', path: starterChocolateSeedPath() },
  ];
  const extra = process.env.MNEM_CHOCOLATE_SOURCES;
  if (extra) {
    for (const p of extra.split(delimiter).map((s) => s.trim()).filter(Boolean)) {
      sources.push({ label: 'env_override', path: p });
    }
  }
  return sources.filter((s) => existsSync(s.path));
}

function sourceFamilyFromProvenance(provenance: string): 'canonical_plow' | 'starter_chocolate' | 'plow_field' | 'other' {
  if (provenance.startsWith('canonical_plow:')) return 'canonical_plow';
  if (provenance.startsWith('starter_chocolate:')) return 'starter_chocolate';
  if (provenance.startsWith('plow-field:')) return 'plow_field';
  return 'other';
}

function categoryFromProvenance(provenance: string): string {
  const parts = provenance.split(':');
  let rawDomain: string | undefined;
  if (parts[0] === 'canonical_plow') rawDomain = parts[2];
  else if (parts[0] === 'starter_chocolate') rawDomain = parts[1];
  else if (parts[0] === 'plow-field') rawDomain = parts[1];
  const normalized = (rawDomain || '').trim().toLowerCase().replace(/\s+/g, '_');
  return CATEGORY_SET.has(normalized) ? normalized : 'other';
}

function sha256Of(question: string, answer: string): string {
  return createHash('sha256').update(question + answer).digest('hex');
}

function loadSource(sourcePath: string): { entries: ConsolidatedEblet[]; malformed: number } {
  const raw = readFileSync(sourcePath, 'utf8');
  const entries: ConsolidatedEblet[] = [];
  let malformed = 0;
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as Partial<ConsolidatedEblet>;
      if (!parsed.question || !parsed.answer || parsed.verified !== true) continue;
      entries.push({
        question: parsed.question,
        answer: parsed.answer,
        provenance: typeof parsed.provenance === 'string' ? parsed.provenance : 'other:unknown',
        verified: true,
        sha256: sha256Of(parsed.question, parsed.answer), // recomputed -- never trust the stored hash
        timestamp: typeof parsed.timestamp === 'number' ? parsed.timestamp : Date.now(),
      });
    } catch {
      malformed++;
    }
  }
  return { entries, malformed };
}

/**
 * Re-consolidate the live substrate + starter seed into 14 deduped category packages +
 * manifest.json under {userData}/chocolates/. Mandatory dedup on sha256(question+answer)
 * (Phase E/G requirement) -- safe to call repeatedly; every call is a full, idempotent
 * rebuild from the current source-of-truth files, never an incremental append that could
 * accumulate drift.
 */
export async function consolidateChocolatePackages(): Promise<ChocolateConsolidationManifest> {
  const outputDir = chocolatePackOutputDir();
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const sources = inventorySources();
  const seenHashes = new Set<string>();
  const byCategory: Record<string, ConsolidatedEblet[]> = Object.fromEntries(CATEGORIES.map((c) => [c, []]));
  const sourceMixByCategory: Record<string, { canonical_plow: number; starter_chocolate: number; plow_field: number; other: number }> =
    Object.fromEntries(CATEGORIES.map((c) => [c, { canonical_plow: 0, starter_chocolate: 0, plow_field: 0, other: 0 }]));

  let totalRead = 0;
  let totalMalformed = 0;
  let totalDuplicates = 0;

  for (const source of sources) {
    let loaded: { entries: ConsolidatedEblet[]; malformed: number };
    try {
      loaded = loadSource(source.path);
    } catch (e) {
      console.warn(`[ChocolateConsolidator] failed to read source ${source.path}:`, e);
      continue;
    }
    totalRead += loaded.entries.length;
    totalMalformed += loaded.malformed;

    for (const entry of loaded.entries) {
      if (seenHashes.has(entry.sha256)) {
        totalDuplicates++;
        continue;
      }
      seenHashes.add(entry.sha256);
      const category = categoryFromProvenance(entry.provenance);
      const family = sourceFamilyFromProvenance(entry.provenance);
      byCategory[category].push(entry);
      sourceMixByCategory[category][family]++;
    }
  }

  const generatedAt = new Date().toISOString();
  const version = app.getVersion();
  const categoryManifests: ChocolateCategoryManifestEntry[] = [];

  for (const category of CATEGORIES) {
    const entries = byCategory[category];
    const outFile = join(outputDir, `${category}.jsonl`);
    const lines = entries.map((e) => JSON.stringify(e));
    writeFileSync(outFile, lines.length > 0 ? lines.join('\n') + '\n' : '', 'utf8');
    categoryManifests.push({
      category,
      count: entries.length,
      version,
      generated_at: generatedAt,
      source_mix: sourceMixByCategory[category],
    });
  }

  const manifest: ChocolateConsolidationManifest = {
    version,
    generatedAt,
    totalEblets: seenHashes.size,
    totalSourcesRead: sources.length,
    totalRecordsRead: totalRead,
    totalDuplicatesRemoved: totalDuplicates,
    totalMalformedSkipped: totalMalformed,
    sources,
    categories: categoryManifests,
    outputDir,
  };
  writeFileSync(join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  console.log(
    `[ChocolateConsolidator] Refreshed ${sources.length} source(s) -> ${seenHashes.size} unique eblets ` +
    `(${totalDuplicates} dupes removed, ${totalMalformed} malformed skipped) -> ${outputDir}`,
  );
  return manifest;
}

/** Best-effort, time-boxed wrapper for the before-quit hook -- must never delay app exit. */
export async function consolidateChocolatePackagesOnQuit(timeoutMs = 4000): Promise<void> {
  try {
    await Promise.race([
      consolidateChocolatePackages(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('consolidation timed out')), timeoutMs)),
    ]);
  } catch (e) {
    console.warn('[ChocolateConsolidator] on-quit refresh skipped/failed (non-fatal):', e);
  }
}
