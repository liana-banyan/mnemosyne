// B83b — Substrate Context Builder (main-process)
// Composes the substrate-context preamble from:
//   - Active MCCI thread records (B82 MoneyPenny — queried via substrate API)
//   - Recently active canon references (LB-STACK / LB-CODEX IDs)
//   - Current session voice anchors (Coffee §8)
//
// Patent novelty: auto-injection of cooperative-AI-substrate context into
// third-party LLM-backed search interface via embedded-browser content-script bridge.
// Distinct from MCP integration (server-side, tool-call-class).

import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { LB_HEARTH_DIR } from '../conjunction/conjunction_receipts';

const CONTEXT_CACHE_PATH = resolve(LB_HEARTH_DIR, 'substrate_context_cache.json');
const SUBSTRATE_API = 'http://127.0.0.1:11480';

export interface SubstrateContextPreamble {
  thread_id: string | null;
  participants: string[];
  topic: string | null;
  canon_refs: string[];  // LB-STACK / LB-CODEX IDs
  active_session: string;
  voice_anchors: string[];
  built_at: string;
  raw_preamble: string;
}

const ACTIVE_SESSION = 'BP035 / Heavy Booster Test';
const DEFAULT_VOICE_ANCHORS = [
  '"HEAVY BOOSTER TEST." — Founder, BP034',
  '"In Conjunction" — Founder-coined backend-selection mode',
  '"and it gets to use the substrate we made, automatically." — Founder',
];

// Known canon refs active during B83 (supplement with live substrate hits)
const BASELINE_CANON_REFS = [
  'LB-STACK-0167 Kissaki Guild',
  'LB-STACK-0207 Trinity meta-canon (Blood/Sweat/Tears)',
  'LB-STACK-0215 Sweat Scribe (B80)',
  'LB-STACK-0216 Tears Scribe (B81)',
  'LB-STACK-0223 Hall Monitor Architecture',
];

export async function buildSubstrateContext(): Promise<SubstrateContextPreamble> {
  let threadId: string | null = null;
  let participants: string[] = [];
  let topic: string | null = null;
  let canonRefs: string[] = [...BASELINE_CANON_REFS];

  // Query local substrate for MCCI context
  try {
    const res = await fetch(`${SUBSTRATE_API}/substrate/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'MCCI thread MoneyPenny active session', degraded: false }),
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json() as {
        hit?: boolean;
        record?: { id?: string; text?: string; source?: string; keywords?: string[] };
      };
      if (data.hit && data.record) {
        threadId = data.record.id ?? null;
        topic = data.record.text?.slice(0, 100) ?? null;
        // Extract LB-STACK refs from record keywords
        const stackRefs = (data.record.keywords ?? []).filter((k) => k.startsWith('LB-STACK'));
        if (stackRefs.length > 0) {
          canonRefs = [...new Set([...canonRefs, ...stackRefs])].slice(0, 5);
        }
      }
    }
  } catch {
    /* substrate not responding — use cached context */
  }

  // Query for session telemetry to populate participants
  try {
    const res = await fetch(`${SUBSTRATE_API}/amplify/snapshot`, {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const snap = await res.json() as { index_size?: number };
      participants = [`Founder (BP035)`, `Knight (${snap.index_size ?? '?'} substrate records)`];
    }
  } catch {
    participants = ['Founder', 'Knight'];
  }

  const preamble = buildPreambleText({
    thread_id: threadId,
    participants,
    topic,
    canon_refs: canonRefs.slice(0, 5),
    active_session: ACTIVE_SESSION,
    voice_anchors: DEFAULT_VOICE_ANCHORS,
  });

  const ctx: SubstrateContextPreamble = {
    thread_id: threadId,
    participants,
    topic,
    canon_refs: canonRefs.slice(0, 5),
    active_session: ACTIVE_SESSION,
    voice_anchors: DEFAULT_VOICE_ANCHORS,
    built_at: new Date().toISOString(),
    raw_preamble: preamble,
  };

  // Cache for webview injection
  try {
    if (!existsSync(LB_HEARTH_DIR)) mkdirSync(LB_HEARTH_DIR, { recursive: true });
    writeFileSync(CONTEXT_CACHE_PATH, JSON.stringify(ctx, null, 2), 'utf8');
  } catch {
    /* non-fatal */
  }

  return ctx;
}

export function loadCachedContext(): SubstrateContextPreamble | null {
  try {
    if (existsSync(CONTEXT_CACHE_PATH)) {
      return JSON.parse(readFileSync(CONTEXT_CACHE_PATH, 'utf8')) as SubstrateContextPreamble;
    }
  } catch {
    /* corrupt cache */
  }
  return null;
}

function buildPreambleText(ctx: Omit<SubstrateContextPreamble, 'built_at' | 'raw_preamble'>): string {
  const lines = [
    '[LB Cooperative-AI Substrate context — auto-injected]',
    `Active MCCI thread: ${ctx.thread_id ?? 'none'} | ${ctx.participants.join(', ')} | ${ctx.topic ?? 'general'}`,
    `Recent canon refs: ${ctx.canon_refs.join('; ')}`,
    `Active session: ${ctx.active_session}`,
    `Founder voice anchors active: ${ctx.voice_anchors.slice(0, 3).join(' | ')}`,
    '[End substrate context. User question follows.]',
  ];
  return lines.join('\n');
}
