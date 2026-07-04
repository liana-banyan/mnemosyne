// brain_swap.ts -- Mountain 1 · I-B · Brain-Swap Operational Wire-Up (Council-Aware)
// KNIGHT MARATHON 4 · BP089 · BLACK MAMBA
//
// Canon: canon_mnemo_brain_swap_pluggable_cognitive_core_hot_swappable_bp085
//
// CCI (Cognitive Core Interface) contract + 2 shims:
//   Shim 1: ClaudeBrainAdapter  -- claude-sonnet-4-6 via Anthropic Messages API (raw fetch)
//   Shim 2: GemmaBrainAdapter   -- local Ollama REST endpoint (any model_id)
//
// DEFAULT path: selectCouncil() -- picks a Court Package, instantiates N CCI members.
// SPECIAL CASE: selectBrain()   -- single brain for speed-critical / known-low-variance.
//
// Selection follows "Consult, don't Rent" canon: free local first;
// flagship for hard targeted work or tool-required tasks.
//
// §3 Truth-Always: Brain Registry UI is v0.7.x ROADMAP.
// Mountain 1 ships CCI interface + 2 shims + selectCouncil + selectBrain.
// @anthropic-ai/sdk is not in package.json -- raw fetch used.

import type { SubstrateContextBundle } from './substrate_reader';
import type { CourtPackage, CouncilPackageName, EscalationPolicy, CouncilMember } from './court_packages';

// ─── Tool types (minimal) ─────────────────────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

// ─── CCI response ─────────────────────────────────────────────────────────────────

export interface CCIResponse {
  content: string;
  brain_id: string;
  tokens_used: number;
  latency_ms: number;
  tool_calls?: ToolCall[];
}

// ─── CCI (Cognitive Core Interface) ──────────────────────────────────────────────

export interface CCI {
  brain_id: string;
  vendor: 'anthropic' | 'google' | 'openai' | 'local';
  min_context_window: number;
  supports_tools: boolean;
  cost_per_1k_tokens: number;

  reason(
    prompt: string,
    context: SubstrateContextBundle,
    tools?: ToolDefinition[]
  ): Promise<CCIResponse>;

  ping(): Promise<{ latency_ms: number; available: boolean }>;
}

// ─── Council selection result ─────────────────────────────────────────────────────

export interface CouncilSelection {
  members: CCI[];
  council_package_name: string;
  variance_threshold: number;
  escalation_policy: EscalationPolicy;
}

// ─── Task categories ──────────────────────────────────────────────────────────────

export type TaskCategory =
  | 'substrate_query'
  | 'reasoning_hard'
  | 'peer_dispatch'
  | 'routine_summarize'
  | 'tool_required'
  | 'scribe_enforcement'
  | 'librarian_query';

export type ModelId = string;

// ─── Default task → council mapping ──────────────────────────────────────────────

const TASK_COUNCIL_MAP: Record<TaskCategory, CouncilPackageName> = {
  substrate_query:     'reader_council',
  reasoning_hard:      'strategic_council',
  peer_dispatch:       'composer_council',
  routine_summarize:   'reader_council',
  tool_required:       'adjudicator_council',
  scribe_enforcement:  'enforcement_council',
  librarian_query:     'librarian_council',
};

// ─── Shim 1: ClaudeBrainAdapter ──────────────────────────────────────────────────

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_API_VERSION = '2023-06-01';
const CLAUDE_MODEL = 'claude-sonnet-4-6';

function buildSubstrateSystemPrompt(context: SubstrateContextBundle): string {
  // MOUNTAIN_1b_ADDITION: prepend domain-primed context if present (set by runPlowLoop)
  const primedSection = context.primed_advantage_context
    ? context.primed_advantage_context + '\n\n'
    : '';

  const baseSection = [
    '## Substrate Context',
    `Timestamp: ${context.timestamp}`,
    `Peers online: ${context.peer_count}`,
    context.recent_peers.length > 0
      ? `Recent peers: ${context.recent_peers.map((p) => p.peer_id).slice(0, 5).join(', ')}`
      : 'No recent peers.',
    context.recent_pearls.length > 0
      ? `Recent pearls: ${context.recent_pearls.map((p) => p.pearl_type).slice(0, 5).join(', ')}`
      : 'No recent pearls.',
    context.hot_eblets.length > 0
      ? `Hot eblets: ${context.hot_eblets.map((e) => e.category + ':' + e.snippet.slice(0, 40)).join(' | ')}`
      : 'No hot eblets.',
    context.active_pheromones.length > 0
      ? `Active pheromones: ${context.active_pheromones.map((p) => p.domain + '(' + p.salience.toFixed(2) + ')').join(', ')}`
      : 'No active pheromones.',
  ].join('\n');

  return primedSection + baseSection; // MOUNTAIN_1b_ADDITION
}

export class ClaudeBrainAdapter implements CCI {
  readonly brain_id = 'claude-sonnet-4-6';
  readonly vendor = 'anthropic' as const;
  readonly min_context_window = 200000;
  readonly supports_tools = true;
  readonly cost_per_1k_tokens = 0.003;

  async reason(
    prompt: string,
    context: SubstrateContextBundle,
    _tools?: ToolDefinition[]
  ): Promise<CCIResponse> {
    const t0 = Date.now();
    const apiKey = process.env.ANTHROPIC_API_KEY ?? '';

    const systemPrompt = buildSubstrateSystemPrompt(context);

    try {
      const res = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': ANTHROPIC_API_VERSION,
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 2048,
          system: systemPrompt,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        return {
          content: `[ClaudeBrainAdapter error] HTTP ${res.status}: ${errText}`,
          brain_id: this.brain_id,
          tokens_used: 0,
          latency_ms: Date.now() - t0,
        };
      }

      const data = await res.json() as {
        content?: Array<{ type: string; text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };

      const content = data.content?.find((c) => c.type === 'text')?.text ?? '';
      const tokensUsed = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);

      return {
        content,
        brain_id: this.brain_id,
        tokens_used: tokensUsed,
        latency_ms: Date.now() - t0,
      };
    } catch (err) {
      return {
        content: `[ClaudeBrainAdapter error] ${err instanceof Error ? err.message : String(err)}`,
        brain_id: this.brain_id,
        tokens_used: 0,
        latency_ms: Date.now() - t0,
      };
    }
  }

  async ping(): Promise<{ latency_ms: number; available: boolean }> {
    const t0 = Date.now();
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
      if (!apiKey) return { latency_ms: 0, available: false };
      // Lightweight: just check the models endpoint
      const res = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'anthropic-version': ANTHROPIC_API_VERSION,
          'x-api-key': apiKey,
        },
        signal: AbortSignal.timeout(5000),
      });
      return { latency_ms: Date.now() - t0, available: res.ok };
    } catch {
      return { latency_ms: Date.now() - t0, available: false };
    }
  }
}

// ─── Shim 2: GemmaBrainAdapter ───────────────────────────────────────────────────

const OLLAMA_BASE = 'http://127.0.0.1:11434';

export class GemmaBrainAdapter implements CCI {
  readonly brain_id: string;
  readonly vendor = 'local' as const;
  readonly min_context_window = 8192;
  readonly supports_tools = false;
  readonly cost_per_1k_tokens = 0;

  private readonly ollamaModelId: string;
  private readonly fallbackModelId: string | undefined;

  constructor(modelId = 'gemma4:12b', fallbackModelId?: string) {
    this.ollamaModelId = modelId;
    this.fallbackModelId = fallbackModelId;
    // brain_id derived from model_id for traceability
    this.brain_id = modelId === 'gemma4:12b' ? 'gemma-3-local'
      : `local-${modelId.replace(/[^a-zA-Z0-9]/g, '-')}`;
  }

  async reason(
    prompt: string,
    context: SubstrateContextBundle,
    _tools?: ToolDefinition[]
  ): Promise<CCIResponse> {
    const t0 = Date.now();
    const systemPrompt = buildSubstrateSystemPrompt(context);
    const fullPrompt = `${systemPrompt}\n\n## Task\n${prompt}`;

    const attemptModel = async (modelId: string): Promise<CCIResponse | null> => {
      try {
        const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: modelId, prompt: fullPrompt, stream: false }),
          signal: AbortSignal.timeout(90000),
        });
        if (!res.ok) return null;
        const data = await res.json() as {
          response?: string;
          prompt_eval_count?: number;
          eval_count?: number;
        };
        return {
          content: data.response ?? '',
          brain_id: this.brain_id,
          tokens_used: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
          latency_ms: Date.now() - t0,
        };
      } catch {
        return null;
      }
    };

    const primary = await attemptModel(this.ollamaModelId);
    if (primary) return primary;

    if (this.fallbackModelId) {
      const fallback = await attemptModel(this.fallbackModelId);
      if (fallback) return { ...fallback, brain_id: this.brain_id + '-fallback' };
    }

    return {
      content: `[GemmaBrainAdapter error] Ollama unreachable for model ${this.ollamaModelId}`,
      brain_id: this.brain_id,
      tokens_used: 0,
      latency_ms: Date.now() - t0,
    };
  }

  async ping(): Promise<{ latency_ms: number; available: boolean }> {
    const t0 = Date.now();
    try {
      const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      return { latency_ms: Date.now() - t0, available: res.ok };
    } catch {
      return { latency_ms: Date.now() - t0, available: false };
    }
  }
}

// ─── createBrainFromMember (used by selectCouncil) ────────────────────────────────

export function createBrainFromMember(member: CouncilMember): CCI {
  if (member.vendor === 'anthropic') {
    return new ClaudeBrainAdapter();
  }
  return new GemmaBrainAdapter(member.model_id, member.fallback_model_id);
}

// ─── selectCouncil (DEFAULT path) ────────────────────────────────────────────────

/**
 * Pick a Court Package by task category and instantiate N CCI members.
 * This is the DEFAULT dispatch path per spec §4.
 */
export function selectCouncil(
  category: TaskCategory,
  availablePackages: CourtPackage[]
): CouncilSelection {
  const packageName = TASK_COUNCIL_MAP[category] ?? 'composer_council';
  const pkg = availablePackages.find((p) => p.name === packageName)
    ?? availablePackages[0];

  if (!pkg) {
    throw new Error(`No court package available for category: ${category}`);
  }

  const members = pkg.members.map(createBrainFromMember);

  return {
    members,
    council_package_name: pkg.name,
    variance_threshold: pkg.variance_threshold,
    escalation_policy: pkg.escalation_policy,
  };
}

// ─── selectBrain (SPECIAL CASE: single brain) ────────────────────────────────────

/**
 * Pick a single brain for speed-critical or known-low-variance tasks.
 * Follows "Consult, don't Rent": free local preferred unless tool-required or flagship-hard.
 */
export function selectBrain(
  category: TaskCategory,
  availableBrains: CCI[]
): CCI {
  if (category === 'tool_required') {
    const flagship = availableBrains.find((b) => b.vendor === 'anthropic');
    if (flagship) return flagship;
  }

  const localBrain = availableBrains.find((b) => b.vendor === 'local');
  if (localBrain) return localBrain;

  const anyBrain = availableBrains[0];
  if (!anyBrain) throw new Error('No brains available for single-brain dispatch');
  return anyBrain;
}
