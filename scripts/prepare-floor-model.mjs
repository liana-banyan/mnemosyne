#!/usr/bin/env node
/**
 * BP067 — Prepare bundled Gemma floor model for electron-builder extraResources.
 *
 * Run before `npm run dist` on a machine with Ollama installed:
 *   npm run prepare:floor-model
 *
 * Pulls gemma2:2b, then copies ONLY the gemma2:2b manifest + its blob refs
 * into resources/ollama/bundled/ — does NOT copy other models from ~/.ollama.
 *
 * Installer impact: +~1.6 GB. Skip this step to ship without bundled model;
 * the app's ensureFloorModel() will pull transparently on first run instead.
 */
import { execSync } from 'child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, readdirSync, statSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const FLOOR = 'gemma2:2b';
const DEST = join(process.cwd(), 'resources', 'ollama', 'bundled');
const OLLAMA_MODELS = join(homedir(), '.ollama', 'models');

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

/**
 * Resolve the Ollama manifest file path for a given model tag.
 * Format: manifests/registry.ollama.ai/library/<name>/<tag>
 */
function resolveManifestPath(models, modelTag) {
  const [name, tag = 'latest'] = modelTag.split(':');
  const path = join(models, 'manifests', 'registry.ollama.ai', 'library', name, tag);
  if (existsSync(path)) return path;

  // Also check without 'library/' prefix (some Ollama versions store differently)
  const altPath = join(models, 'manifests', 'registry.ollama.ai', name, tag);
  if (existsSync(altPath)) return altPath;

  return null;
}

/**
 * Parse an Ollama manifest JSON and return the set of blob digest strings.
 * Digests are in the form "sha256:<hex>" — files live at blobs/sha256-<hex>.
 */
function extractBlobDigests(manifestPath) {
  const raw = readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);
  const digests = new Set();

  // config layer
  if (manifest.config?.digest) digests.add(manifest.config.digest);

  // weight layers
  for (const layer of manifest.layers ?? []) {
    if (layer.digest) digests.add(layer.digest);
  }

  return digests;
}

/** Convert "sha256:<hex>" → "sha256-<hex>" (Ollama blob filename convention). */
function digestToFilename(digest) {
  return digest.replace(':', '-');
}

function main() {
  // 1. Verify Ollama is on PATH
  try {
    execSync('ollama --version', { stdio: 'ignore' });
  } catch {
    console.error('[prepare-floor-model] Ollama not found on PATH. Install Ollama first.');
    process.exit(1);
  }

  // 2. Pull the floor model (idempotent — skips if already present)
  console.log(`[prepare-floor-model] Pulling ${FLOOR}…`);
  run(`ollama pull ${FLOOR}`);

  // 3. Resolve manifest path
  const manifestPath = resolveManifestPath(OLLAMA_MODELS, FLOOR);
  if (!manifestPath) {
    console.error(`[prepare-floor-model] Manifest not found for ${FLOOR} in ${OLLAMA_MODELS}`);
    process.exit(1);
  }
  console.log(`[prepare-floor-model] Manifest: ${manifestPath}`);

  // 4. Extract blob digests
  const digests = extractBlobDigests(manifestPath);
  console.log(`[prepare-floor-model] Found ${digests.size} blob(s) to copy.`);

  // 5. Prepare destination tree
  const destManifestDir = join(DEST, 'models', 'manifests', 'registry.ollama.ai', 'library', FLOOR.split(':')[0]);
  const destBlobsDir = join(DEST, 'models', 'blobs');
  if (existsSync(DEST)) rmSync(DEST, { recursive: true, force: true });
  mkdirSync(destManifestDir, { recursive: true });
  mkdirSync(destBlobsDir, { recursive: true });

  // 6. Copy manifest
  const destManifest = join(destManifestDir, FLOOR.split(':')[1] ?? 'latest');
  cpSync(manifestPath, destManifest);
  console.log(`[prepare-floor-model] Copied manifest → ${destManifest}`);

  // 7. Copy only the blobs referenced by this model
  const blobsDir = join(OLLAMA_MODELS, 'blobs');
  let copiedBytes = 0;
  for (const digest of digests) {
    const filename = digestToFilename(digest);
    const src = join(blobsDir, filename);
    const dst = join(destBlobsDir, filename);
    if (!existsSync(src)) {
      console.warn(`[prepare-floor-model] WARNING: blob missing: ${filename}`);
      continue;
    }
    cpSync(src, dst);
    const size = statSync(dst).size;
    copiedBytes += size;
    console.log(`  copied ${filename} (${(size / 1e9).toFixed(2)} GB)`);
  }

  console.log(`\n[prepare-floor-model] Done. Total copied: ${(copiedBytes / 1e9).toFixed(2)} GB`);
  console.log(`[prepare-floor-model] Bundled model at: ${DEST}`);
  console.log('[prepare-floor-model] Ready for electron-builder extraResources.');
}

main();
