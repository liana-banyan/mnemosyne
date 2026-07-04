// court_packages.ts -- Mountain 1 · I-F · Court Package Library
// KNIGHT MARATHON 4 · BP089 · BLACK MAMBA
//
// Preconfigured Council compositions for different task classes.
// Each Package lazy-loads on first reference and is cached in memory.
// M5 (Reminder Scribes) consumes enforcement_council.
// M6 (Librarian Corps) consumes librarian_council.
// Both available post-M4 merge.
//
// §3 Truth-Always: all 6 default packages ship with Mountain 1.
// Custom package registration via court_package_audit table is ROADMAP (post-M4).

import type { DatabaseConfig } from './substrate_reader';
import ws from 'ws';

// ─── Types ────────────────────────────────────────────────────────────────────────

export type CouncilPackageName =
  | 'reader_council'
  | 'composer_council'
  | 'strategic_council'
  | 'enforcement_council'
  | 'librarian_council'
  | 'adjudicator_council'
  | 'core_mic_live';  // BP094: dynamic CORE-tier MIC judges -- members populated at runtime from peer_presence

export type EscalationPolicy =
  | 'flagship_on_divergence'
  | 'fail_on_divergence'
  | 'always_flagship';

export interface CouncilMember {
  model_id: string;
  vendor: 'local' | 'anthropic' | 'google' | 'openai';
  ram_required_gb?: number;
  fallback_model_id?: string;
}

export interface CourtPackage {
  name: CouncilPackageName;
  description: string;
  members: CouncilMember[];
  variance_threshold: number;
  escalation_policy: EscalationPolicy;
  substrate_context_filter?: string[];
  estimated_latency_s: number;
  cost_per_fire: number;
}

export interface CourtPackageLibrary {
  get(name: CouncilPackageName): Promise<CourtPackage>;
  list(): CouncilPackageName[];
  preload(names: CouncilPackageName[]): Promise<void>;
}

// ─── Default packages ─────────────────────────────────────────────────────────────

const DEFAULT_PACKAGES: Record<Exclude<CouncilPackageName, 'core_mic_live'>, CourtPackage> = {
  reader_council: {
    name: 'reader_council',
    description: '3x gemma2:2b · sub-second extraction · variance threshold 5%',
    members: [
      { model_id: 'gemma2:2b', vendor: 'local', fallback_model_id: 'gemma4:12b' },
      { model_id: 'gemma2:2b', vendor: 'local', fallback_model_id: 'gemma4:12b' },
      { model_id: 'gemma2:2b', vendor: 'local', fallback_model_id: 'gemma4:12b' },
    ],
    variance_threshold: 0.05,
    escalation_policy: 'flagship_on_divergence',
    estimated_latency_s: 2,
    cost_per_fire: 0.00,
  },

  composer_council: {
    name: 'composer_council',
    description: '3x gemma4:12b · ~25s composition · variance threshold 15%',
    members: [
      { model_id: 'gemma4:12b', vendor: 'local' },
      { model_id: 'gemma4:12b', vendor: 'local' },
      { model_id: 'gemma4:12b', vendor: 'local' },
    ],
    variance_threshold: 0.15,
    escalation_policy: 'flagship_on_divergence',
    estimated_latency_s: 25,
    cost_per_fire: 0.00,
  },

  strategic_council: {
    name: 'strategic_council',
    description: '3x llama3.3:70b (if peer RAM allows) OR 5x gemma4:12b · 60-90s · variance threshold 10%',
    members: [
      { model_id: 'llama3.3:70b', vendor: 'local', ram_required_gb: 48, fallback_model_id: 'gemma4:12b' },
      { model_id: 'llama3.3:70b', vendor: 'local', ram_required_gb: 48, fallback_model_id: 'gemma4:12b' },
      { model_id: 'llama3.3:70b', vendor: 'local', ram_required_gb: 48, fallback_model_id: 'gemma4:12b' },
    ],
    variance_threshold: 0.10,
    escalation_policy: 'flagship_on_divergence',
    estimated_latency_s: 75,
    cost_per_fire: 0.00,
  },

  enforcement_council: {
    name: 'enforcement_council',
    description: '3x gemma4:12b with canon corpus subset · Scribe enforcement · Marathon 5',
    members: [
      { model_id: 'gemma4:12b', vendor: 'local' },
      { model_id: 'gemma4:12b', vendor: 'local' },
      { model_id: 'gemma4:12b', vendor: 'local' },
    ],
    variance_threshold: 0.10,
    escalation_policy: 'flagship_on_divergence',
    substrate_context_filter: ['hot_eblets', 'active_pheromones'],
    estimated_latency_s: 25,
    cost_per_fire: 0.00,
  },

  librarian_council: {
    name: 'librarian_council',
    description: '3x gemma4:12b with path-specific cabinet · Librarian Corps · Marathon 6',
    members: [
      { model_id: 'gemma4:12b', vendor: 'local' },
      { model_id: 'gemma4:12b', vendor: 'local' },
      { model_id: 'gemma4:12b', vendor: 'local' },
    ],
    variance_threshold: 0.10,
    escalation_policy: 'flagship_on_divergence',
    substrate_context_filter: ['hot_eblets', 'recent_pearls'],
    estimated_latency_s: 25,
    cost_per_fire: 0.00,
  },

  adjudicator_council: {
    name: 'adjudicator_council',
    description: 'flagship Sonnet 4.6 fallback · used only on divergence from other councils',
    members: [
      { model_id: 'claude-sonnet-4-6', vendor: 'anthropic' },
    ],
    variance_threshold: 0.0,
    escalation_policy: 'always_flagship',
    estimated_latency_s: 5,
    cost_per_fire: 0.08,
  },
};

// ─── Factory ──────────────────────────────────────────────────────────────────────

// BP094 §4: dynamic CORE_MIC_LIVE package -- queries peer_presence for active CORE peers at runtime
// Both c532e740 and 49f3e597 are default CORE-MIC peers; expands if more CORE peers are active.
// Equal MIC judge weight; neither has structural primacy (reciprocal pairing per BP091 §4.1).
async function buildCoreMicLivePackage(): Promise<CourtPackage> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js');
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!url || !key) throw new Error('[court_packages] Supabase env vars not set for CORE_MIC_LIVE');
    const supabase = createClient(url, key, { auth: { persistSession: false }, realtime: { transport: ws as unknown as typeof WebSocket } });
    const { data: rows, error } = await supabase
      .from('peer_presence')
      .select('peer_id, capabilities')
      .eq('status', 'active')
      .filter('capabilities->>ramTier', 'eq', 'CORE');
    if (error) throw new Error(`peer_presence query error: ${error.message}`);
    const activeCorePeers = (rows ?? []) as Array<{ peer_id: string; capabilities: { ollamaModel?: string; ramTier?: string } | null }>;
    const members: CouncilMember[] = activeCorePeers.map(p => ({
      model_id: p.capabilities?.ollamaModel ?? 'gemma2:9b',
      vendor: 'local' as const,
    }));
    // Fall back to static defaults if no CORE peers found in peer_presence
    if (members.length === 0) {
      members.push(
        { model_id: 'gemma2:9b', vendor: 'local' },
        { model_id: 'gemma2:9b', vendor: 'local' },
      );
    }
    return {
      name: 'core_mic_live',
      description: `${members.length}x active CORE-MIC peers (dynamic from peer_presence) -- judge-role only, FireGuard duty`,
      members,
      variance_threshold: 0.0,
      escalation_policy: 'flagship_on_divergence',
      estimated_latency_s: 30,
      cost_per_fire: 0.00,
    };
  } catch (err) {
    // Degraded fallback: return static 2-peer CORE package if peer_presence unavailable
    console.warn('[court_packages] CORE_MIC_LIVE peer_presence query failed -- using static fallback:', err);
    return {
      name: 'core_mic_live',
      description: '2x gemma2:9b CORE-MIC static fallback (peer_presence unavailable)',
      members: [
        { model_id: 'gemma2:9b', vendor: 'local' },
        { model_id: 'gemma2:9b', vendor: 'local' },
      ],
      variance_threshold: 0.0,
      escalation_policy: 'flagship_on_divergence',
      estimated_latency_s: 30,
      cost_per_fire: 0.00,
    };
  }
}

export function createCourtPackageLibrary(_db?: DatabaseConfig): CourtPackageLibrary {
  const _cache = new Map<CouncilPackageName, CourtPackage>();

  return {
    async get(name: CouncilPackageName): Promise<CourtPackage> {
      // BP094: CORE_MIC_LIVE is always fetched fresh (dynamic membership) -- no cache
      if (name === 'core_mic_live') {
        return buildCoreMicLivePackage();
      }
      if (_cache.has(name)) return _cache.get(name)!;
      const pkg = DEFAULT_PACKAGES[name as Exclude<CouncilPackageName, 'core_mic_live'>];
      if (!pkg) throw new Error(`Unknown court package: ${name}`);
      _cache.set(name, pkg);
      return pkg;
    },

    list(): CouncilPackageName[] {
      return [...Object.keys(DEFAULT_PACKAGES) as CouncilPackageName[], 'core_mic_live'];
    },

    async preload(names: CouncilPackageName[]): Promise<void> {
      await Promise.all(names.map(async (n) => {
        if (n === 'core_mic_live') return; // skip preload for dynamic package
        const pkg = DEFAULT_PACKAGES[n as Exclude<CouncilPackageName, 'core_mic_live'>];
        if (pkg) _cache.set(n, pkg);
      }));
    },
  };
}
