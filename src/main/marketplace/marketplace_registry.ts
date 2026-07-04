// AMPLIFY — Mnemosyne Marketplace Plugin Registry
// SAGA 6 Phase D — Steam-alternative sub-panel marketplace scaffold
// Doctrine: project_mnemosyne_bp041_post_first_fire_design_vision.md §4
//
// "Also we will want to use this frame as a Steam alternative, remember? With add-on subPanels
// that you can pick and choose from with categories." — Founder direct, BP041
//
// Distribution model:
//   - SSPL umbrella: all plugins must bind SSPL license (cooperative-class)
//   - Substitution-only payment (NO-FIAT-CONVERSION Blood Rule)
//   - IP Ledger registration required per plugin (appendPortalSearchEntry pattern)
//   - Developer keeps 83.3%; platform margin Cost+20%; Substitution-only settlement

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
} from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';
import { randomUUID, createHash } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PluginCategory =
  | 'software-enhancement'
  | 'backup'
  | 'creative'
  | 'developer'
  | 'cooperative-finance'
  | 'community';

export type PluginStatus =
  | 'draft'       // submitted; under Detective + Counsel review
  | 'active'      // approved; listed in marketplace
  | 'suspended'   // temporarily removed (Harper Guild or Detective review)
  | 'revoked';    // permanently removed (SSPL violation or policy breach)

export interface PluginManifest {
  plugin_id:          string;
  name:               string;
  version:            string;
  category:           PluginCategory;
  description:        string;
  author_member_id:   string;   // cooperative-substrate member_id; never real-name (BLOOD RULE)
  license:            'SSPL-1.0'; // enforced; no other license accepted
  ip_ledger_id:       string;   // ledger_id from IP Ledger registration
  entry_point:        string;   // relative path to main TS/JS module
  min_mnemosyne_ver:  string;
  payment_marks:      number;   // cost in Marks (Substitution-only; 0 = free)
  payment_joules:     number;   // cost in Joules
  payment_credits:    number;   // cost in Credits
  tags:               string[];
  status:             PluginStatus;
  registered_at:      string;
  updated_at:         string;
  review_notes?:      string;
  adjudicators?:      string[]; // Detective + Counsel IDs that reviewed
  sub_panel_config?: {
    mount_point:    'tab' | 'overlay' | 'sidebar';
    default_width?: number;
    default_height?:number;
    requires_ipc?:  string[];  // IPC channel names plugin needs
  };
}

export interface PluginInstallRecord {
  install_id:       string;
  plugin_id:        string;
  member_id:        string;
  installed_at:     string;
  version_at_install: string;
  payment_settled:  boolean;
  payment_ref?:     string;     // Substitution-only ledger reference
}

export interface PluginRegistrationRequest {
  name:               string;
  version:            string;
  category:           PluginCategory;
  description:        string;
  author_member_id:   string;
  entry_point:        string;
  min_mnemosyne_ver:  string;
  payment_marks?:     number;
  payment_joules?:    number;
  payment_credits?:   number;
  tags?:              string[];
  sub_panel_config?:  PluginManifest['sub_panel_config'];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LB_SUBSTRATE_ROOT =
  process.env.LB_SUBSTRATE_ROOT ?? resolve(homedir(), '.lb_substrate');

const PLUGINS_DIR   = resolve(LB_SUBSTRATE_ROOT, 'plugins', 'marketplace');
const REGISTRY_FILE = resolve(PLUGINS_DIR, 'registry.jsonl');
const INSTALLS_FILE = resolve(PLUGINS_DIR, 'installs.jsonl');

// ─── Utility ──────────────────────────────────────────────────────────────────

function ensurePluginsDir(): void {
  if (!existsSync(PLUGINS_DIR)) mkdirSync(PLUGINS_DIR, { recursive: true });
}

function shortId(seed: string): string {
  return createHash('sha256').update(seed).digest('hex').slice(0, 16);
}

// ─── Registry Operations ──────────────────────────────────────────────────────

/** Load all plugin manifests from local registry. */
export function loadRegistry(): PluginManifest[] {
  ensurePluginsDir();
  if (!existsSync(REGISTRY_FILE)) return [];
  const lines = readFileSync(REGISTRY_FILE, 'utf8').split('\n').filter(Boolean);
  const manifests: PluginManifest[] = [];
  for (const line of lines) {
    try { manifests.push(JSON.parse(line) as PluginManifest); }
    catch { /* skip malformed */ }
  }
  // Deduplicate: most-recent version wins per plugin_id
  const byId = new Map<string, PluginManifest>();
  for (const m of manifests) {
    const existing = byId.get(m.plugin_id);
    if (!existing || new Date(m.updated_at) > new Date(existing.updated_at)) {
      byId.set(m.plugin_id, m);
    }
  }
  return Array.from(byId.values());
}

/** Append a plugin manifest entry (append-only; use registerPlugin for new + updatePlugin for updates). */
function appendManifest(manifest: PluginManifest): void {
  ensurePluginsDir();
  appendFileSync(REGISTRY_FILE, JSON.stringify(manifest) + '\n', 'utf8');
}

/**
 * Register a new plugin in the marketplace.
 * Status starts as 'draft' — requires Detective + Counsel review before 'active'.
 * IP Ledger registration is performed by the caller (ip_ledger_store.registerClaim).
 */
export function registerPlugin(
  req: PluginRegistrationRequest,
  ip_ledger_id: string,
): PluginManifest {
  const now = new Date().toISOString();
  const manifest: PluginManifest = {
    plugin_id:         `plugin_${shortId(req.name + req.author_member_id + now)}`,
    name:              req.name,
    version:           req.version,
    category:          req.category,
    description:       req.description,
    author_member_id:  req.author_member_id,
    license:           'SSPL-1.0',
    ip_ledger_id,
    entry_point:       req.entry_point,
    min_mnemosyne_ver: req.min_mnemosyne_ver,
    payment_marks:     req.payment_marks  ?? 0,
    payment_joules:    req.payment_joules ?? 0,
    payment_credits:   req.payment_credits ?? 0,
    tags:              req.tags ?? [],
    status:            'draft',
    registered_at:     now,
    updated_at:        now,
    sub_panel_config:  req.sub_panel_config,
  };
  appendManifest(manifest);

  // Write individual plugin JSON file to plugins/marketplace/ directory
  const pluginFile = resolve(PLUGINS_DIR, `${manifest.plugin_id}.json`);
  writeFileSync(pluginFile, JSON.stringify(manifest, null, 2), 'utf8');

  return manifest;
}

/**
 * Update plugin status (Detective/Counsel adjudication → active/suspended/revoked).
 * Uses append-only update pattern: appends new manifest with updated fields.
 */
export function updatePluginStatus(
  plugin_id: string,
  status: PluginStatus,
  adjudicators: string[],
  review_notes?: string,
): PluginManifest | null {
  const all = loadRegistry();
  const existing = all.find((m) => m.plugin_id === plugin_id);
  if (!existing) return null;

  const updated: PluginManifest = {
    ...existing,
    status,
    adjudicators,
    review_notes,
    updated_at: new Date().toISOString(),
  };
  appendManifest(updated);

  const pluginFile = resolve(PLUGINS_DIR, `${plugin_id}.json`);
  writeFileSync(pluginFile, JSON.stringify(updated, null, 2), 'utf8');

  return updated;
}

/**
 * List plugins by category and/or status.
 * Returns manifests visible to members (active only by default).
 */
export function listPlugins(params?: {
  category?:   PluginCategory;
  status?:     PluginStatus;
  include_all?: boolean;
}): PluginManifest[] {
  const all = loadRegistry();
  const filterStatus = params?.include_all ? undefined : (params?.status ?? 'active');
  return all.filter((m) => {
    if (filterStatus && m.status !== filterStatus) return false;
    if (params?.category && m.category !== params.category) return false;
    return true;
  });
}

/** Record a plugin install for a member (append-only; used for Substitution-only payment tracking). */
export function recordInstall(params: {
  plugin_id:    string;
  member_id:    string;
  payment_ref?: string;
}): PluginInstallRecord {
  ensurePluginsDir();
  const now = new Date().toISOString();
  const all = loadRegistry();
  const plugin = all.find((m) => m.plugin_id === params.plugin_id);
  const record: PluginInstallRecord = {
    install_id:          `install_${shortId(params.plugin_id + params.member_id + now)}`,
    plugin_id:           params.plugin_id,
    member_id:           params.member_id,
    installed_at:        now,
    version_at_install:  plugin?.version ?? 'unknown',
    payment_settled:     !!params.payment_ref,
    payment_ref:         params.payment_ref,
  };
  appendFileSync(INSTALLS_FILE, JSON.stringify(record) + '\n', 'utf8');
  return record;
}

/** Marketplace statistics for transparency + developer dashboards. */
export function getMarketplaceStats(): {
  total_plugins: number;
  active_plugins: number;
  draft_plugins: number;
  by_category: Record<PluginCategory, number>;
  plugins_dir: string;
} {
  const all = loadRegistry();
  const byCategory = {
    'software-enhancement': 0,
    'backup': 0,
    'creative': 0,
    'developer': 0,
    'cooperative-finance': 0,
    'community': 0,
  } as Record<PluginCategory, number>;
  for (const m of all) {
    if (m.status === 'active') byCategory[m.category]++;
  }
  return {
    total_plugins:  all.length,
    active_plugins: all.filter((m) => m.status === 'active').length,
    draft_plugins:  all.filter((m) => m.status === 'draft').length,
    by_category:    byCategory,
    plugins_dir:    PLUGINS_DIR,
  };
}
