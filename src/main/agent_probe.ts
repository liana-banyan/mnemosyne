// SAGA 4 BP041 — Agent Probe
// Per-agent static config check + live HTTP probe on first enable per session.
// Mirrors scribeToggleMonitor IPC pattern (probeAgent / setApiKey / getApiKeyStatus).
//
// R16 / R-NO-API-KEY-EXPOSURE: API key values NEVER logged, NEVER returned to renderer.
// Renderer sees only AgentProbeStatus ('available' | 'missing_key' | 'unavailable' | …).
// Keys are stored encrypted-at-rest at ~/.lb_substrate/api_keys.json (AES-256 via crypto).
//
// BLOOD RULE binding: NO-PRIVATE (member data local-only), NO-FIAT (spend opt-in per tier),
// Privacy-by-Default (keys never leave machine; probe traffic to vendor only on first enable).

import { homedir } from 'os';
import { join } from 'path';
import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from 'fs';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// ─── Types (mirrored in renderer/hearth/conjunction/types.ts) ────────────────

export type AgentProbeStatus =
  | 'unknown'
  | 'probing'
  | 'available'
  | 'unavailable'
  | 'missing_key';

export interface AgentProbeResult {
  agentId: string;
  status: AgentProbeStatus;
  reason?: string;
  probed_at?: string;
}

// ─── Static agent config ─────────────────────────────────────────────────────

interface AgentStaticConfig {
  /** env var key name — undefined = no key needed */
  envKey?: string;
  /** Function to perform live probe → returns ok + optional reason */
  liveProbeFn: (modelId?: string) => Promise<{ ok: boolean; reason?: string }>;
}

const AGENT_CONFIGS: Record<string, AgentStaticConfig> = {
  cpu_only: {
    liveProbeFn: async () => ({ ok: true, reason: 'Local substrate — always available' }),
  },
  hearth: {
    liveProbeFn: async () => {
      try {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 3000);
        const res = await fetch('http://localhost:11434/api/version', { signal: ctrl.signal });
        clearTimeout(timeout);
        if (!res.ok) return { ok: false, reason: `Ollama responded ${res.status}` };
        return { ok: true, reason: 'Ollama running' };
      } catch (err) {
        return { ok: false, reason: 'Ollama not running — start with: ollama serve' };
      }
    },
  },
  pawn: {
    envKey: 'PERPLEXITY_API_KEY',
    liveProbeFn: async (modelId = 'sonar') => {
      const key = process.env.PERPLEXITY_API_KEY;
      if (!key) return { ok: false, reason: 'PERPLEXITY_API_KEY not set' };
      try {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelId,
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 1,
          }),
          signal: ctrl.signal,
        });
        clearTimeout(timeout);
        if (res.status === 401) return { ok: false, reason: 'Invalid Perplexity API key' };
        if (!res.ok && res.status !== 400) return { ok: false, reason: `Perplexity responded ${res.status}` };
        return { ok: true, reason: 'Pawn available' };
      } catch (err) {
        return { ok: false, reason: 'Perplexity API unreachable' };
      }
    },
  },
  rook: {
    envKey: 'GOOGLE_API_KEY',
    liveProbeFn: async (modelId = 'gemini-2.5-flash') => {
      const key = process.env.GOOGLE_API_KEY;
      if (!key) return { ok: false, reason: 'GOOGLE_API_KEY not set' };
      try {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 5000);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${key}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'ping' }] }] }),
          signal: ctrl.signal,
        });
        clearTimeout(timeout);
        if (res.status === 400) return { ok: true, reason: 'Rook available (Gemini 400 = key valid)' };
        if (res.status === 401 || res.status === 403) return { ok: false, reason: 'Invalid Google API key' };
        if (!res.ok) return { ok: false, reason: `Gemini responded ${res.status}` };
        return { ok: true, reason: 'Rook available' };
      } catch (err) {
        return { ok: false, reason: 'Gemini API unreachable' };
      }
    },
  },
  bishop: {
    envKey: 'ANTHROPIC_API_KEY',
    liveProbeFn: async () => {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) return { ok: false, reason: 'ANTHROPIC_API_KEY not set' };
      try {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-7',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
          }),
          signal: ctrl.signal,
        });
        clearTimeout(timeout);
        if (res.status === 401) return { ok: false, reason: 'Invalid Anthropic API key' };
        if (res.status === 529) return { ok: false, reason: 'Anthropic API overloaded' };
        // 400 = bad request but key is valid
        if (!res.ok && res.status !== 400) return { ok: false, reason: `Anthropic responded ${res.status}` };
        return { ok: true, reason: 'Bishop available' };
      } catch (err) {
        return { ok: false, reason: 'Anthropic API unreachable' };
      }
    },
  },
  knight: {
    liveProbeFn: async () => {
      // Knight = Cursor IDE via Yoke bridge. Check Yoke file accessibility.
      const { existsSync: fExists } = await import('fs');
      const yokePath = join(homedir(), 'Documents', 'LianaBanyanPlatform', 'KNIGHT_BISHOP_MESSAGES.md');
      if (!fExists(yokePath)) {
        return { ok: false, reason: 'KNIGHT_BISHOP_MESSAGES.md not found — Yoke bridge unavailable' };
      }
      return { ok: true, reason: 'Knight Yoke bridge accessible (async — paste cycle)' };
    },
  },
  browser_ai: {
    liveProbeFn: async () => ({ ok: true, reason: 'Browser AI — always available (manual paste cycle)' }),
  },
  all_in_conjunction: {
    liveProbeFn: async () => ({ ok: true, reason: 'Orchestrates all enabled agents' }),
  },
};

// ─── Session-level probe cache ────────────────────────────────────────────────

const sessionCache = new Map<string, AgentProbeResult>();

// ─── API key storage (AES-256 encrypted at rest) ─────────────────────────────

const SUBSTRATE_ROOT = process.env.LB_SUBSTRATE_ROOT ?? join(homedir(), '.lb_substrate');
const KEYS_FILE = join(SUBSTRATE_ROOT, 'api_keys.json');

// Derive a consistent AES key from machine identity (no user password needed).
// Salt is stored alongside; this is obfuscation-at-rest, not password-based KDF.
// For stronger security, users should set keys via OS keychain (future: Phase D-v2).
const KEY_SALT_FILE = join(SUBSTRATE_ROOT, '.api_salt');

function getOrCreateSalt(): Buffer {
  if (existsSync(KEY_SALT_FILE)) {
    return readFileSync(KEY_SALT_FILE);
  }
  mkdirSync(SUBSTRATE_ROOT, { recursive: true });
  const salt = randomBytes(32);
  writeFileSync(KEY_SALT_FILE, salt);
  return salt;
}

function getDerivedKey(): Buffer {
  const salt = getOrCreateSalt();
  // Machine-tied: hostname + platform as password-equivalent
  const password = `lb-substrate-${process.platform}-${require('os').hostname()}`;
  return scryptSync(password, salt, 32);
}

function encrypt(plain: string): string {
  const iv = randomBytes(16);
  const key = getDerivedKey();
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf-8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(ciphertext: string): string | null {
  try {
    const [ivHex, encHex] = ciphertext.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const enc = Buffer.from(encHex, 'hex');
    const key = getDerivedKey();
    const decipher = createDecipheriv('aes-256-cbc', key, iv);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf-8');
  } catch {
    return null;
  }
}

interface StoredKeys {
  [agentId: string]: string; // encrypted ciphertext
}

function loadStoredKeys(): StoredKeys {
  if (!existsSync(KEYS_FILE)) return {};
  try {
    return JSON.parse(readFileSync(KEYS_FILE, 'utf-8')) as StoredKeys;
  } catch {
    return {};
  }
}

function saveStoredKeys(keys: StoredKeys): void {
  mkdirSync(SUBSTRATE_ROOT, { recursive: true });
  writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2), 'utf-8');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check static config for an agent: does the required env var exist?
 * Returns 'missing_key' if absent, 'unknown' if no key required (probe needed).
 * R16: never returns the key value — only boolean presence.
 */
export function staticCheck(agentId: string): AgentProbeStatus {
  const config = AGENT_CONFIGS[agentId];
  if (!config) return 'unknown';
  if (config.envKey) {
    const isSet = Boolean(process.env[config.envKey]);
    return isSet ? 'unknown' : 'missing_key';
  }
  return 'unknown';
}

/**
 * Run the full probe for an agent (static + live).
 * Uses session cache — re-probes only if not yet cached or force=true.
 */
export async function probeAgent(
  agentId: string,
  opts: { force?: boolean; modelId?: string } = {},
): Promise<AgentProbeResult> {
  // Return from cache unless forced
  if (!opts.force && sessionCache.has(agentId)) {
    return sessionCache.get(agentId)!;
  }

  const config = AGENT_CONFIGS[agentId];
  if (!config) {
    const result: AgentProbeResult = { agentId, status: 'unknown', reason: 'No config for agent' };
    sessionCache.set(agentId, result);
    return result;
  }

  // Static check first
  if (config.envKey && !process.env[config.envKey]) {
    const result: AgentProbeResult = {
      agentId,
      status: 'missing_key',
      reason: `${config.envKey} not configured — set in Settings`,
    };
    sessionCache.set(agentId, result);
    return result;
  }

  // Live probe
  try {
    const { ok, reason } = await config.liveProbeFn(opts.modelId);
    const result: AgentProbeResult = {
      agentId,
      status: ok ? 'available' : 'unavailable',
      reason,
      probed_at: new Date().toISOString(),
    };
    sessionCache.set(agentId, result);
    return result;
  } catch (err) {
    const result: AgentProbeResult = {
      agentId,
      status: 'unavailable',
      reason: err instanceof Error ? err.message : 'Probe error',
      probed_at: new Date().toISOString(),
    };
    sessionCache.set(agentId, result);
    return result;
  }
}

/**
 * Store an API key for an agent.
 * Writes to process.env[envKey] for immediate use.
 * Persists encrypted to ~/.lb_substrate/api_keys.json for future sessions.
 * R16: value is never logged or returned. Returns only { ok }.
 */
export function setApiKey(agentId: string, keyValue: string): { ok: boolean; error?: string } {
  const config = AGENT_CONFIGS[agentId];
  if (!config?.envKey) {
    return { ok: false, error: `Agent ${agentId} does not require an API key` };
  }
  try {
    // Set in current process
    process.env[config.envKey] = keyValue;

    // Persist encrypted
    const stored = loadStoredKeys();
    stored[agentId] = encrypt(keyValue);
    saveStoredKeys(stored);

    // Invalidate session cache so next probe re-checks
    sessionCache.delete(agentId);

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Store error' };
  }
}

/**
 * Load persisted API keys into process.env on startup.
 * Called once from main process init (index.ts).
 * R16: only sets env vars; values never logged.
 */
export function loadPersistedApiKeys(): void {
  try {
    const stored = loadStoredKeys();
    for (const [agentId, ciphertext] of Object.entries(stored)) {
      const config = AGENT_CONFIGS[agentId];
      if (!config?.envKey) continue;
      if (process.env[config.envKey]) continue; // already set (e.g. from SDS.env — takes precedence)
      const plain = decrypt(ciphertext);
      if (plain) {
        process.env[config.envKey] = plain;
      }
    }
  } catch {
    // Silent: startup failure must not block app launch
  }
}

/**
 * Get API key status for all agents (presence only — R16 compliant).
 * Returns Record<agentId, isSet> — never the values.
 */
export function getApiKeyStatus(): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const [agentId, config] of Object.entries(AGENT_CONFIGS)) {
    if (config.envKey) {
      result[agentId] = Boolean(process.env[config.envKey]);
    }
  }
  return result;
}

/**
 * Clear session probe cache for an agent (e.g. after key is set).
 */
export function clearProbeCache(agentId?: string): void {
  if (agentId) {
    sessionCache.delete(agentId);
  } else {
    sessionCache.clear();
  }
}
