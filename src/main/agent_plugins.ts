// SAGA 4 BP041 — Agent Plugins Loader
// Watches ~/.lb_substrate/plugins/agents/*.json for community plugin manifests.
// SSPL Blood Rule: all plugins distributed for Mnemosyne carry SSPL umbrella.
// Higher Standards Class: third-party plugin authors held to SSPL + cooperative-class.
// IP Ledger: member-developed plugins attributed via plugin manifest `ipLedgerRef` field.
//
// Plugin spec (JSON manifest):
//   interface InConjunctionPluginManifest {
//     id: string;                   unique agent ID (must not conflict with builtins)
//     displayName: string;
//     subtitle: string;
//     icon: string;
//     tiers?: Array<{id, label, tierClass, modelId}>;
//     requiresKey?: string;         env var name
//     licenseType: 'SSPL-1.0';      REQUIRED — rejected if absent or wrong
//     ipLedgerRef?: string;         IP Ledger innovation ID (e.g. "IL-0042")
//     authorHandle?: string;        Discord/GitHub handle
//     schemaVersion: 1;
//   }
//
// Distribution paths:
//   Path A — Commercial AI company: SSPL fork of Mnemosyne with integration
//   Path B — Member developer: JSON manifest + plugin index on Discord/GitHub
//   Path C — LB blessed: reviewed + ships in default Mnemosyne build

import { homedir } from 'os';
import { join } from 'path';
import {
  mkdirSync,
  existsSync,
  readdirSync,
  readFileSync,
  watchFile,
  unwatchFile,
} from 'fs';
// Types inlined: main/ cannot cross-import from renderer/ rootDir
interface AgentTier {
  id: string;
  label: string;
  tierClass: 'flagship' | 'balanced' | 'cheap';
  modelId: string;
}

export interface InConjunctionAgent {
  id: string;
  displayName: string;
  subtitle: string;
  icon: string;
  tiers?: AgentTier[];
  alwaysAvailable?: boolean;
  requiresKey?: string;
  source?: 'builtin' | 'plugin';
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SUBSTRATE_ROOT = process.env.LB_SUBSTRATE_ROOT ?? join(homedir(), '.lb_substrate');
const PLUGIN_DIR = join(SUBSTRATE_ROOT, 'plugins', 'agents');
const SCHEMA_VERSION = 1;
const REQUIRED_LICENSE = 'SSPL-1.0';

// IDs reserved for builtins — plugin loader rejects any manifest claiming these
const RESERVED_IDS = new Set([
  'cpu_only',
  'hearth',
  'pawn',
  'rook',
  'bishop',
  'knight',
  'browser_ai',
  'all_in_conjunction',
]);

// ─── Manifest schema ─────────────────────────────────────────────────────────

interface PluginTierManifest {
  id: string;
  label: string;
  tierClass: 'flagship' | 'balanced' | 'cheap';
  modelId: string;
}

interface InConjunctionPluginManifest {
  schemaVersion: number;
  id: string;
  displayName: string;
  subtitle: string;
  icon: string;
  tiers?: PluginTierManifest[];
  requiresKey?: string;
  licenseType: string;
  ipLedgerRef?: string;
  authorHandle?: string;
}

// ─── Validation ───────────────────────────────────────────────────────────────

interface ValidationResult {
  ok: boolean;
  reason?: string;
}

function validateManifest(raw: unknown, filename: string): ValidationResult {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, reason: `${filename}: manifest must be a JSON object` };
  }
  const m = raw as Partial<InConjunctionPluginManifest>;

  if (m.schemaVersion !== SCHEMA_VERSION) {
    return { ok: false, reason: `${filename}: schemaVersion must be ${SCHEMA_VERSION}` };
  }
  if (!m.id || typeof m.id !== 'string' || !m.id.trim()) {
    return { ok: false, reason: `${filename}: id is required` };
  }
  if (RESERVED_IDS.has(m.id)) {
    return { ok: false, reason: `${filename}: id "${m.id}" is reserved for built-in agents` };
  }
  if (!/^[a-z0-9_-]{2,64}$/.test(m.id)) {
    return { ok: false, reason: `${filename}: id must be 2-64 chars, lowercase alphanumeric/dash/underscore` };
  }
  if (!m.displayName || typeof m.displayName !== 'string') {
    return { ok: false, reason: `${filename}: displayName is required` };
  }
  if (!m.subtitle || typeof m.subtitle !== 'string') {
    return { ok: false, reason: `${filename}: subtitle is required` };
  }
  if (!m.icon || typeof m.icon !== 'string') {
    return { ok: false, reason: `${filename}: icon is required` };
  }
  if (m.licenseType !== REQUIRED_LICENSE) {
    return {
      ok: false,
      reason: `${filename}: licenseType must be "${REQUIRED_LICENSE}" — SSPL umbrella is non-negotiable per Mnemosyne Blood Rule`,
    };
  }
  if (m.tiers !== undefined) {
    if (!Array.isArray(m.tiers) || m.tiers.length === 0) {
      return { ok: false, reason: `${filename}: tiers must be a non-empty array if present` };
    }
    for (const tier of m.tiers) {
      if (!tier.id || !tier.label || !tier.modelId) {
        return { ok: false, reason: `${filename}: each tier must have id, label, modelId` };
      }
      if (!['flagship', 'balanced', 'cheap'].includes(tier.tierClass)) {
        return { ok: false, reason: `${filename}: tier tierClass must be flagship | balanced | cheap` };
      }
    }
  }
  return { ok: true };
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

function manifestToAgent(m: InConjunctionPluginManifest): InConjunctionAgent {
  return {
    id: m.id,
    displayName: m.displayName,
    subtitle: m.subtitle,
    icon: m.icon,
    tiers: m.tiers?.map((t): AgentTier => ({
      id: t.id,
      label: t.label,
      tierClass: t.tierClass,
      modelId: t.modelId,
    })),
    requiresKey: m.requiresKey,
    source: 'plugin',
  };
}

// ─── Plugin registry ──────────────────────────────────────────────────────────

interface PluginRegistryEntry {
  filename: string;
  agent: InConjunctionAgent;
  ipLedgerRef?: string;
  authorHandle?: string;
  loadedAt: string;
}

const registry = new Map<string, PluginRegistryEntry>();
let changeCallback: ((agents: InConjunctionAgent[]) => void) | null = null;
const watchedFiles = new Set<string>();

// ─── Internal helpers ─────────────────────────────────────────────────────────

function loadPluginFile(filepath: string): { agent?: InConjunctionAgent; error?: string } {
  const filename = filepath.split(/[\\/]/).pop() ?? filepath;
  try {
    const raw = JSON.parse(readFileSync(filepath, 'utf-8')) as unknown;
    const validation = validateManifest(raw, filename);
    if (!validation.ok) {
      return { error: validation.reason };
    }
    const m = raw as InConjunctionPluginManifest;
    return { agent: manifestToAgent(m) };
  } catch (err) {
    return { error: `${filename}: parse error — ${err instanceof Error ? err.message : String(err)}` };
  }
}

function getPluginFiles(): string[] {
  if (!existsSync(PLUGIN_DIR)) return [];
  return readdirSync(PLUGIN_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => join(PLUGIN_DIR, f));
}

function notifyChange(): void {
  if (changeCallback) {
    changeCallback(Array.from(registry.values()).map((e) => e.agent));
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Ensure the plugin directory exists. Called once at startup.
 * Also writes a README if the directory is newly created.
 */
export function ensurePluginDir(): void {
  if (!existsSync(PLUGIN_DIR)) {
    mkdirSync(PLUGIN_DIR, { recursive: true });
    // Drop a README for member developers
    const readmePath = join(PLUGIN_DIR, 'README.txt');
    writePluginReadme(readmePath);
  }
}

function writePluginReadme(path: string): void {
  const content = [
    'In Conjunction — Community Plugin Directory',
    '==========================================',
    '',
    'Drop .json plugin manifests here to add custom agents to In Conjunction.',
    '',
    'Required fields:',
    '  schemaVersion: 1',
    '  id: unique lowercase alphanumeric id (e.g. "my-agent")',
    '  displayName: "My Agent"',
    '  subtitle: "Helena-pedagogy one-liner"',
    '  icon: single emoji',
    '  licenseType: "SSPL-1.0"   ← required; SSPL umbrella is non-negotiable',
    '',
    'Optional fields:',
    '  tiers: [{id, label, tierClass, modelId}]',
    '  requiresKey: "MY_API_KEY"',
    '  ipLedgerRef: "IL-0042"    ← cooperative IP Ledger attribution',
    '  authorHandle: "@yourhandle"',
    '',
    'Distribution: Discord / GitHub / Mnemosyne plugin index.',
    'See https://cephas.lianabanyan.com/in-conjunction/ for full spec.',
  ].join('\n');

  try {
    const { writeFileSync } = require('fs') as typeof import('fs');
    writeFileSync(path, content, 'utf-8');
  } catch {
    // Non-fatal
  }
}

/**
 * Load all plugins from the plugin directory.
 * Populates registry. Returns loaded agents + any load errors.
 */
export function loadPlugins(): { agents: InConjunctionAgent[]; errors: string[] } {
  const errors: string[] = [];
  const files = getPluginFiles();

  for (const filepath of files) {
    const { agent, error } = loadPluginFile(filepath);
    const filename = filepath.split(/[\\/]/).pop() ?? filepath;
    if (error) {
      errors.push(error);
      console.warn(`[agent_plugins] Rejected: ${error}`);
    } else if (agent) {
      registry.set(agent.id, {
        filename,
        agent,
        loadedAt: new Date().toISOString(),
      });
    }
  }

  return { agents: Array.from(registry.values()).map((e) => e.agent), errors };
}

/**
 * Get currently loaded plugin agents.
 */
export function getLoadedPlugins(): InConjunctionAgent[] {
  return Array.from(registry.values()).map((e) => e.agent);
}

/**
 * Watch plugin directory for changes — calls callback when agents change.
 * Polling-based (compatible with Windows filesystem watchers).
 */
export function watchPluginDir(onChange: (agents: InConjunctionAgent[]) => void): void {
  changeCallback = onChange;
  ensurePluginDir();

  // Poll the directory every 10 seconds for new/removed .json files
  setInterval(() => {
    const currentFiles = new Set(getPluginFiles());
    let changed = false;

    // Check for new files
    for (const filepath of currentFiles) {
      if (!watchedFiles.has(filepath)) {
        watchedFiles.add(filepath);
        const { agent, error } = loadPluginFile(filepath);
        const filename = filepath.split(/[\\/]/).pop() ?? filepath;
        if (error) {
          console.warn(`[agent_plugins] New plugin rejected: ${error}`);
        } else if (agent) {
          registry.set(agent.id, { filename, agent, loadedAt: new Date().toISOString() });
          changed = true;
        }
      }
    }

    // Check for removed files
    for (const filepath of Array.from(watchedFiles)) {
      if (!currentFiles.has(filepath)) {
        watchedFiles.delete(filepath);
        // Find and remove by filename
        for (const [id, entry] of registry.entries()) {
          if (join(PLUGIN_DIR, entry.filename) === filepath) {
            registry.delete(id);
            changed = true;
            break;
          }
        }
      }
    }

    if (changed) notifyChange();
  }, 10_000);
}

/**
 * Get plugin registry metadata (for diagnostics / Settings display).
 */
export function getPluginRegistry(): Array<{
  id: string;
  filename: string;
  displayName: string;
  ipLedgerRef?: string;
  authorHandle?: string;
  loadedAt: string;
}> {
  return Array.from(registry.values()).map((e) => ({
    id: e.agent.id,
    filename: e.filename,
    displayName: e.agent.displayName,
    ipLedgerRef: e.ipLedgerRef,
    authorHandle: e.authorHandle,
    loadedAt: e.loadedAt,
  }));
}

/**
 * Unwatch all (cleanup on app quit).
 */
export function unwatchPlugins(): void {
  for (const filepath of watchedFiles) {
    try { unwatchFile(filepath); } catch { /* silent */ }
  }
  watchedFiles.clear();
  changeCallback = null;
}
