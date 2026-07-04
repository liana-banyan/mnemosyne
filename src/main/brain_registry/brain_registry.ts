// brain_registry.ts -- Brain Registry for MnemosyneC Brain Swap
// Pluggable cognitive core hot-swappable per canon_mnemo_brain_swap_pluggable_cognitive_core_hot_swappable_bp085
// Persistence: Node.js fs + app.getPath('userData') pattern (same as ed25519_keypair.ts)
// No em-dashes. Absolute imports. TypeScript strict.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

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
    brain_id: 'claude-opus-4-7',
    vendor: 'anthropic',
    model_id: 'claude-opus-4-7',
    kind: 'flagship',
    api_endpoint: 'https://api.anthropic.com',
    cost_per_1k_tokens: 0.015,
    capability_tier: 5,
    status: 'available',
  },
  {
    brain_id: 'claude-sonnet-4-6',
    vendor: 'anthropic',
    model_id: 'claude-sonnet-4-6',
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

const DEFAULT_ACTIVE_BRAIN_ID = 'claude-sonnet-4-6';
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
