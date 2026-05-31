#!/usr/bin/env node
/**
 * BP067 — Prepare bundled Gemma floor model for electron-builder extraResources.
 *
 * Run before `npm run dist` on a machine with Ollama installed:
 *   npm run prepare:floor-model
 *
 * Pulls gemma2:2b, then copies Ollama manifest + blob refs into resources/ollama/bundled/
 * so family-install users get zero-download first answer offline.
 */
import { execSync, spawnSync } from 'child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const FLOOR = 'gemma2:2b';
const DEST = join(process.cwd(), 'resources', 'ollama', 'bundled');
const OLLAMA_MODELS = join(homedir(), '.ollama', 'models');

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

function main() {
  try {
    execSync('ollama --version', { stdio: 'ignore' });
  } catch {
    console.error('[prepare-floor-model] Ollama not found on PATH. Install Ollama or skip bundling.');
    process.exit(1);
  }

  console.log(`[prepare-floor-model] Pulling ${FLOOR}…`);
  run(`ollama pull ${FLOOR}`);

  if (!existsSync(OLLAMA_MODELS)) {
    console.error('[prepare-floor-model] ~/.ollama/models missing after pull.');
    process.exit(1);
  }

  if (existsSync(DEST)) rmSync(DEST, { recursive: true, force: true });
  mkdirSync(DEST, { recursive: true });

  // Copy entire models tree subset — manifests + blobs referenced by floor model
  cpSync(OLLAMA_MODELS, join(DEST, 'models'), { recursive: true });
  console.log(`[prepare-floor-model] Bundled model copied to ${DEST}`);
  console.log('[prepare-floor-model] Ready for electron-builder extraResources.');
}

main();
