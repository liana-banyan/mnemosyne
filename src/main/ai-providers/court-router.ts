// court-router.ts — BP060 Application 002 Steps 3+4 · AI-agnostic routing layer
// Maps Court member → provider client.
// NO provider hardcoded as default in routing layer.
// Default route = local (cooperative-class compute-ownership doctrine).
// AI-agnostic by construction — any provider can be swapped per court_member selection.
// decay_class: BETWEEN

import type { ProviderClient, ProviderQueryArgs, ProviderResponse, CourtMapping } from './types';
import { DEFAULT_COURT_MAPPING } from './types';
import { LocalRuntimeClient } from './local-runtime-client';
import { AnthropicClient } from './anthropic-client';
import { OpenAIClient } from './openai-client';
import { GeminiClient } from './gemini-client';
import { PerplexityClient } from './perplexity-client';

// ─── Singleton client registry ────────────────────────────────────────────────

let _localClient: LocalRuntimeClient | null = null;
let _anthropicClient: AnthropicClient | null = null;
let _openaiClient: OpenAIClient | null = null;
let _geminiClient: GeminiClient | null = null;
let _perplexityClient: PerplexityClient | null = null;

function getLocalClient(runtimeUrl?: string): LocalRuntimeClient {
  if (!_localClient) _localClient = new LocalRuntimeClient(runtimeUrl);
  if (runtimeUrl) _localClient.setRuntimeUrl(runtimeUrl);
  return _localClient;
}

function getClientForProvider(providerId: string): ProviderClient {
  switch (providerId) {
    case 'anthropic':
      if (!_anthropicClient) _anthropicClient = new AnthropicClient();
      return _anthropicClient;
    case 'openai':
      if (!_openaiClient) _openaiClient = new OpenAIClient();
      return _openaiClient;
    case 'gemini':
      if (!_geminiClient) _geminiClient = new GeminiClient();
      return _geminiClient;
    case 'perplexity':
      if (!_perplexityClient) _perplexityClient = new PerplexityClient();
      return _perplexityClient;
    case 'local':
    default:
      return getLocalClient();
  }
}

// ─── Court router ─────────────────────────────────────────────────────────────

export interface CourtRouterConfig {
  mapping?: Partial<CourtMapping>;
  local_runtime_url?: string;
}

export class CourtRouter {
  private mapping: CourtMapping;

  constructor(config?: CourtRouterConfig) {
    this.mapping = { ...DEFAULT_COURT_MAPPING, ...(config?.mapping || {}) };
    if (config?.local_runtime_url) {
      getLocalClient(config.local_runtime_url);
    }
  }

  updateLocalRuntimeUrl(url: string): void {
    getLocalClient(url);
  }

  getProviderForCourtMember(court_member: string): ProviderClient {
    const lower = court_member.toLowerCase().trim();

    // Resolve court member to provider_id
    let providerId: string;
    switch (lower) {
      case 'bishop':
        providerId = this.mapping.bishop;
        break;
      case 'rook':
        providerId = this.mapping.rook;
        break;
      case 'knight':
        providerId = this.mapping.knight;
        break;
      case 'pawn':
        providerId = this.mapping.pawn;
        break;
      case 'local':
      default:
        // Unknown court member → default local (cooperative-class compute ownership)
        providerId = this.mapping.local;
        break;
    }

    return getClientForProvider(providerId);
  }

  async dispatch(
    court_member: string,
    args: ProviderQueryArgs,
  ): Promise<ProviderResponse> {
    const client = this.getProviderForCourtMember(court_member);

    if (!client.is_configured()) {
      return {
        ok: false,
        provider: client.provider_id,
        error: `Provider "${client.display_name}" is not configured (missing API key or runtime URL).`,
      };
    }

    return client.query(args);
  }

  listClients(): Array<{ provider_id: string; display_name: string; configured: boolean }> {
    const all = ['local', 'anthropic', 'openai', 'gemini', 'perplexity'];
    return all.map((id) => {
      const client = getClientForProvider(id);
      return {
        provider_id: client.provider_id,
        display_name: client.display_name,
        configured: client.is_configured(),
      };
    });
  }
}

// ─── Module-level singleton router ───────────────────────────────────────────

let _router: CourtRouter | null = null;

export function getCourtRouter(config?: CourtRouterConfig): CourtRouter {
  if (!_router) _router = new CourtRouter(config);
  return _router;
}

export function updateCourtRouterLocalUrl(url: string): void {
  getCourtRouter().updateLocalRuntimeUrl(url);
  // Also update singleton local client directly
  getLocalClient(url);
}
