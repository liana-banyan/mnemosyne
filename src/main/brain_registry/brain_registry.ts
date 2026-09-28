// brain_registry.ts -- Brain Registry for MnemosyneC Brain Swap
// Pluggable cognitive core hot-swappable per canon_mnemo_brain_swap_pluggable_cognitive_core_hot_swappable_bp085
// Persistence: Node.js fs + app.getPath('userData') pattern (same as ed25519_keypair.ts)
// No em-dashes. Absolute imports. TypeScript strict.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
// D-BP223-M0-h2cbpo68-MODEL_ROSTER/SEG-M0/BP223-MODEL_ROSTER: DEFAULT_BRAINS' two Anthropic
// entries below now read their model_id/brain_id from config/model_roster.json instead of
// carrying their own literal strings -- see model_roster.ts's header. Vendor model ids rotate by
// iteration; keeping the id in exactly one place means a future rotation is a one-line JSON edit,
// not a grep-and-replace across every file that used to duplicate the literal.
import { getRosterModelId } from '../model_roster';

export interface BrainEntry {
  brain_id: string;           // unique slug e.g. "claude-opus-4-7"
  vendor: string;             // "anthropic" | "google" | "ollama"
  model_id: string;           // exact model identifier sent to API or Ollama
  kind: 'flagship' | 'local';
  api_endpoint: string;       // full base URL; for Ollama: "http://127.0.0.1:11434"
  cost_per_1k_tokens: number; // USD; 0 for local
  capability_tier: number;    // 1 (lowest) to 5 (highest)
  status: 'available' | 'unavailable' | 'unknown';
}

export const DEFAULT_BRAINS: BrainEntry[] = [
  {
    brain_id: getRosterModelId('brain.opus'),
    vendor: 'anthropic',
    model_id: getRosterModelId('brain.opus'),
    kind: 'flagship',
    api_endpoint: 'https://api.anthropic.com',
    cost_per_1k_tokens: 0.015,
    capability_tier: 5,
    status: 'available',
  },
  {
    brain_id: getRosterModelId('brain.sonnet'),
    vendor: 'anthropic',
    model_id: getRosterModelId('brain.sonnet'),
    kind: 'flagship',
    api_endpoint: 'https://api.anthropic.com',
    cost_per_1k_tokens: 0.003,
    capability_tier: 4,
    status: 'available',
  },
  {
    brain_id: 'gemma4-12b',
    vendor: 'ollama',
    model_id: 'gemma4:12b',
    kind: 'local',
    api_endpoint: 'http://127.0.0.1:11434',
    cost_per_1k_tokens: 0,
    capability_tier: 2,
    status: 'unknown',
  },
  {
    brain_id: 'qwen2-5-7b',
    vendor: 'ollama',
    model_id: 'qwen2.5:7b',
    kind: 'local',
    api_endpoint: 'http://127.0.0.1:11434',
    cost_per_1k_tokens: 0,
    capability_tier: 2,
    status: 'unknown',
  },
  {
    brain_id: 'mistral-7b',
    vendor: 'ollama',
    model_id: 'mistral',
    kind: 'local',
    api_endpoint: 'http://127.0.0.1:11434',
    cost_per_1k_tokens: 0,
    capability_tier: 2,
    status: 'unknown',
  },
];

// BP134 Task D (Founder directive): the free local Ollama AI must be the default,
// never a cloud/paid path. Was 'claude-sonnet-4-6' (flagship, requires an Anthropic
// API key) -- every fresh install silently defaulted Ask into a dead-end asking for
// a key. 'gemma4-12b' is a local/Ollama entry in DEFAULT_BRAINS: $0 cost, no key.
// ensureFreeLocalDefaultOnFirstRun() below further refines this at first-run to
// whichever local model is ACTUALLY installed (prefers gemma-class, else smallest).
const DEFAULT_ACTIVE_BRAIN_ID = 'gemma4-12b';
const STORE_FILENAME = 'brain_registry.json';

interface BrainRegistryStore {
  active_brain_id: string;
  brains: BrainEntry[];
}

function getStorePath(): string {
  const userDataDir = app.getPath('userData');
  return join(userDataDir, STORE_FILENAME);
}

function readStore(): BrainRegistryStore {
  const filePath = getStorePath();
  if (existsSync(filePath)) {
    try {
      const raw = readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<BrainRegistryStore>;
      if (
        typeof parsed.active_brain_id === 'string' &&
        Array.isArray(parsed.brains) &&
        parsed.brains.length > 0
      ) {
        return parsed as BrainRegistryStore;
      }
    } catch {
      // Fall through to defaults if file is corrupt
    }
  }
  return { active_brain_id: DEFAULT_ACTIVE_BRAIN_ID, brains: DEFAULT_BRAINS };
}

function writeStore(store: BrainRegistryStore): void {
  const filePath = getStorePath();
  const userDataDir = app.getPath('userData');
  mkdirSync(userDataDir, { recursive: true });
  writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf8');
}

export function getBrainRegistry(): BrainEntry[] {
  return readStore().brains;
}

export function setBrainRegistry(brains: BrainEntry[]): void {
  const store = readStore();
  store.brains = brains;
  writeStore(store);
}

export function getActiveBrainId(): string {
  return readStore().active_brain_id;
}

export function setActiveBrainId(brain_id: string): void {
  const store = readStore();
  const exists = store.brains.some((b) => b.brain_id === brain_id);
  if (!exists) {
    console.warn(`[BrainRegistry] setActiveBrainId: unknown brain_id "${brain_id}" -- ignoring`);
    return;
  }
  store.active_brain_id = brain_id;
  writeStore(store);
}

export function getActiveBrain(): BrainEntry | undefined {
  const store = readStore();
  return store.brains.find((b) => b.brain_id === store.active_brain_id);
}

// ── BP134 Task C: dynamic installed-model discovery ─────────────────────────

/** Slugify an Ollama model tag into a brain_id, e.g. "gemma2:9b" -> "gemma2-9b". */
function ollamaModelToBrainId(modelName: string): string {
  return modelName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Rough capability-tier heuristic from the size token in a model tag (e.g. "9b" -> tier 3). */
function estimateCapabilityTier(modelName: string): number {
  const m = modelName.match(/(\d+(?:\.\d+)?)\s*b/i);
  if (!m) return 1;
  const n = parseFloat(m[1]);
  if (n >= 30) return 5;
  if (n >= 12) return 4;
  if (n >= 7) return 3;
  if (n >= 2) return 2;
  return 1;
}

/**
 * BP134 Task C: merge any installed-but-unregistered Ollama models (from
 * `ollama list` / /api/tags) into the persisted brain registry as 'local'
 * brains. Purely additive -- existing entries (including the curated
 * DEFAULT_BRAINS) are never removed or hidden. Idempotent: safe to call on
 * every brain-registry:list request. Returns the full (possibly-updated)
 * brain list.
 */
export function syncInstalledOllamaModels(installedModelNames: string[]): BrainEntry[] {
  const store = readStore();
  const existingModelIds = new Set(store.brains.map((b) => b.model_id));
  const existingBrainIds = new Set(store.brains.map((b) => b.brain_id));
  let changed = false;

  for (const modelName of installedModelNames) {
    if (existingModelIds.has(modelName)) continue;
    const brain_id = ollamaModelToBrainId(modelName);
    if (existingBrainIds.has(brain_id)) continue; // slug collision guard
    store.brains.push({
      brain_id,
      vendor: 'ollama',
      model_id: modelName,
      kind: 'local',
      api_endpoint: 'http://127.0.0.1:11434',
      cost_per_1k_tokens: 0,
      capability_tier: estimateCapabilityTier(modelName),
      status: 'available',
    });
    existingModelIds.add(modelName);
    existingBrainIds.add(brain_id);
    changed = true;
  }

  if (changed) {
    writeStore(store);
    console.log(`[BrainRegistry] BP134 Task C: synced ${installedModelNames.length} installed Ollama model(s), registry now has ${store.brains.length} brain(s)`);
  }
  return store.brains;
}

function storeFileExists(): boolean {
  return existsSync(getStorePath());
}

/**
 * BP135 Yoke #35: true only if the user (or ensureFreeLocalDefaultOnFirstRun) has ever
 * actually persisted a brain choice to brain_registry.json. readStore()/getActiveBrain()
 * silently fall back to DEFAULT_ACTIVE_BRAIN_ID ('gemma4-12b') when the file doesn't exist
 * yet -- that in-memory default is NOT hardware-aware and must never be treated as "the
 * peer's real selected model" by presence/plow callers. Those callers should fall through
 * to their own hardware-aware default (ram_detector.ts) when this returns false, exactly
 * as if no brain had been registered at all.
 */
export function hasPersistedBrainChoice(): boolean {
  return storeFileExists();
}

/**
 * BP134 Task D (Founder directive): "make the free version the default."
 * On a genuinely fresh install (no persisted brain_registry.json yet), pick a
 * LOCAL brain as the active default -- preferring an installed gemma-class
 * model, else the smallest installed model. Never overrides a prior explicit
 * choice: a no-op once brain_registry.json exists on disk. No-op if nothing
 * is installed yet (nothing to point at).
 */
export function ensureFreeLocalDefaultOnFirstRun(installedModelNames: string[]): void {
  if (storeFileExists()) return; // a persisted choice already exists -- never override it
  if (installedModelNames.length === 0) return; // nothing installed yet

  const brains = syncInstalledOllamaModels(installedModelNames);

  const sizeOf = (tag: string): number => {
    const m = tag.match(/(\d+(?:\.\d+)?)\s*b/i);
    return m ? parseFloat(m[1]) : Infinity;
  };

  const gemmaInstalled = installedModelNames.filter((m) => m.split(':')[0].toLowerCase().startsWith('gemma'));
  let preferredModelId: string | undefined;
  if (gemmaInstalled.length > 0) {
    // Prefer the largest installed gemma-class model (12b > 9b > 2b), mirroring the
    // "biggest gemma wins" intent of ollama_manager.selectBestGemmaModel().
    preferredModelId = [...gemmaInstalled].sort((a, b) => sizeOf(b) - sizeOf(a))[0];
  } else {
    // No gemma installed -- fall back to the smallest installed model of any family.
    preferredModelId = [...installedModelNames].sort((a, b) => sizeOf(a) - sizeOf(b))[0];
  }

  const targetBrain = brains.find((b) => b.model_id === preferredModelId && b.kind === 'local');
  if (!targetBrain) return;

  const store = readStore();
  store.active_brain_id = targetBrain.brain_id;
  writeStore(store);
  console.log(`[BrainRegistry] BP134 Task D: first-run default set to free local brain "${targetBrain.brain_id}" (${targetBrain.model_id})`);
}
