// AMPLIFY Computer — Substrate Query Router
// B37 Phase 3 — Three-mode operation per CAI Conductor #2277 + Bushel 37 spec
//
// Arm B substrate → local Ollama → cloud API escalation
//   AI Burst:  substrate hit → Ollama inference → cloud (full path)
//   Normal:    substrate hit or miss (read-only, no AI cost)
//   Fallback:  substrate + peer-sync only (zero cloud, zero Ollama)

import { createHash } from 'crypto';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  readdirSync,
  mkdirSync,
} from 'fs';
import { resolve } from 'path';
import { app } from 'electron';

// ─── Types ───────────────────────────────────────────────────────────────────

export type FrameMode = 'ai_burst' | 'normal' | 'fallback';

export interface SubstrateRecord {
  id: string;
  text: string;
  source: string;
  keywords: string[];
  ts: string;
  embedding_hint?: string;
}

export interface QueryResult {
  hit: boolean;
  record?: SubstrateRecord;
  score?: number;
  routing: 'substrate_hit' | 'local_ollama' | 'cloud_escalation' | 'peer_sync' | 'miss';
  latency_ms: number;
  cloud_cost_avoided_usd: number;
}

export interface QueryOptions {
  degraded?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DATA_DIR = resolve(
  process.env.APPDATA || process.env.HOME || '.',
  'AMPLIFY Computer',
  'substrate',
);

// Librarian-mcp stitchpunks data directory — read if present
const LIBRARIAN_DATA_DIR = resolve(
  process.env.APPDATA
    ? resolve(process.env.APPDATA, '..', 'Local', 'Programs') // best guess on Windows
    : '/',
);
// Workspace-relative path works in dev — overridden in packaged builds
const DEV_LIBRARIAN_DIR = resolve(
  __dirname,
  '../../../../librarian-mcp/stitchpunks/data',
);

// Cost baseline: cloud API cost per token (~$3/1M for Sonnet)
const CLOUD_COST_PER_TOKEN_USD = 0.000003;
const TYPICAL_RESPONSE_TOKENS = 800;

// ─── Local Substrate Index ────────────────────────────────────────────────────

export class SubstrateLocalIndex {
  private records: SubstrateRecord[] = [];
  private indexedKeywords: Map<string, Set<number>> = new Map();
  private loaded = false;

  private get cacheFile(): string {
    return resolve(DATA_DIR, 'substrate_cache.jsonl');
  }

  async load(): Promise<void> {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

    // 1. Load own AMPLIFY substrate cache
    if (existsSync(this.cacheFile)) {
      const lines = readFileSync(this.cacheFile, 'utf8')
        .split('\n')
        .filter(Boolean);
      for (const line of lines) {
        try {
          this.addRecord(JSON.parse(line) as SubstrateRecord);
        } catch {
          // Malformed line — skip
        }
      }
    }

    // 2. Ingest from librarian-mcp data directory (dev or post-install copy)
    const librarianDir = existsSync(DEV_LIBRARIAN_DIR)
      ? DEV_LIBRARIAN_DIR
      : null;

    if (librarianDir) {
      await this._ingestLibrarianData(librarianDir);
    }

    this.loaded = true;
    console.log(`[SubstrateIndex] Loaded ${this.records.length} records`);
  }

  private async _ingestLibrarianData(dir: string): Promise<void> {
    // Read content_archive_index.json if present
    const archiveIndex = resolve(dir, 'content_archive_index.json');
    if (existsSync(archiveIndex)) {
      try {
        const raw = readFileSync(archiveIndex, 'utf8');
        const entries = JSON.parse(raw) as Array<{
          id?: string;
          title?: string;
          excerpt?: string;
          tags?: string[];
          text?: string;
          path?: string;
        }>;
        for (const entry of Array.isArray(entries) ? entries : []) {
          const text = entry.excerpt ?? entry.text ?? entry.title ?? '';
          if (!text) continue;
          this.addRecord({
            id: entry.id ?? createHash('md5').update(text).digest('hex').slice(0, 12),
            text,
            source: 'librarian:content_archive',
            keywords: this._extractKeywords(text, entry.tags),
            ts: new Date().toISOString(),
          });
        }
      } catch {
        // Unparseable — skip
      }
    }

    // Read gold tablets (high-signal canonical content)
    const goldDir = resolve(dir, 'gold');
    if (existsSync(goldDir)) {
      try {
        const files = readdirSync(goldDir).filter((f) => f.endsWith('.jsonl'));
        for (const file of files.slice(0, 20)) {
          const lines = readFileSync(resolve(goldDir, file), 'utf8')
            .split('\n')
            .filter(Boolean);
          for (const line of lines.slice(0, 100)) {
            try {
              const rec = JSON.parse(line) as { text?: string; id?: string; tags?: string[] };
              if (!rec.text) continue;
              this.addRecord({
                id: rec.id ?? createHash('md5').update(rec.text).digest('hex').slice(0, 12),
                text: rec.text,
                source: `librarian:gold/${file}`,
                keywords: this._extractKeywords(rec.text, rec.tags),
                ts: new Date().toISOString(),
              });
            } catch {
              // Skip
            }
          }
        }
      } catch {
        // Skip
      }
    }

    // Read amplify_telemetry.jsonl as context about past queries
    const telemetry = resolve(dir, 'amplify_telemetry.jsonl');
    if (existsSync(telemetry)) {
      try {
        const lines = readFileSync(telemetry, 'utf8').split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const rec = JSON.parse(line) as {
              query?: string;
              answer_excerpt?: string;
              ts?: string;
            };
            if (rec.query && rec.answer_excerpt) {
              this.addRecord({
                id: createHash('md5').update(rec.query).digest('hex').slice(0, 12),
                text: `${rec.query} — ${rec.answer_excerpt}`,
                source: 'librarian:telemetry',
                keywords: this._extractKeywords(rec.query),
                ts: rec.ts ?? new Date().toISOString(),
              });
            }
          } catch {
            // Skip
          }
        }
      } catch {
        // Skip
      }
    }
  }

  private addRecord(record: SubstrateRecord): void {
    const idx = this.records.length;
    this.records.push(record);
    for (const kw of record.keywords) {
      const set = this.indexedKeywords.get(kw) ?? new Set();
      set.add(idx);
      this.indexedKeywords.set(kw, set);
    }
  }

  private _extractKeywords(text: string, extra?: string[]): string[] {
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .filter((w) => !STOP_WORDS.has(w));

    const all = Array.from(new Set([...words, ...(extra ?? []).map((t) => t.toLowerCase())]));
    return all.slice(0, 40);
  }

  query(queryText: string, topK = 1): Array<{ record: SubstrateRecord; score: number }> {
    if (!this.loaded || this.records.length === 0) return [];

    const queryKeywords = this._extractKeywords(queryText);
    if (queryKeywords.length === 0) return [];

    // BM25-lite: count keyword overlaps weighted by inverse keyword frequency
    const scores = new Map<number, number>();

    for (const kw of queryKeywords) {
      const postings = this.indexedKeywords.get(kw);
      if (!postings) continue;
      const idf = Math.log(1 + this.records.length / postings.size);
      for (const idx of postings) {
        scores.set(idx, (scores.get(idx) ?? 0) + idf);
      }
    }

    const results = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([idx, score]) => ({ record: this.records[idx], score }));

    return results;
  }

  writeRecord(record: SubstrateRecord): void {
    this.addRecord(record);
    try {
      appendFileSync(this.cacheFile, JSON.stringify(record) + '\n', 'utf8');
    } catch (err) {
      console.warn('[SubstrateIndex] Failed to persist record:', err);
    }
  }

  get size(): number {
    return this.records.length;
  }
}

// ─── Three-Mode Query Router ──────────────────────────────────────────────────

export class SubstrateRouter {
  private index: SubstrateLocalIndex;
  private currentMode: FrameMode = 'normal';
  private forcedMode: FrameMode | null = null;
  private ollamaBase: string;

  constructor(index: SubstrateLocalIndex, ollamaBase = 'http://localhost:11434') {
    this.index = index;
    this.ollamaBase = ollamaBase;
  }

  setMode(mode: FrameMode): void {
    this.currentMode = mode;
  }

  setForcedMode(mode: FrameMode | null): void {
    this.forcedMode = mode;
    if (mode !== null) this.currentMode = mode;
  }

  getForcedMode(): FrameMode | null {
    return this.forcedMode;
  }

  getEffectiveMode(): FrameMode {
    return this.forcedMode ?? this.currentMode;
  }

  async query(
    queryText: string,
    ollamaModel?: string,
    options: QueryOptions = {},
  ): Promise<QueryResult> {
    const t0 = Date.now();
    const mode = options.degraded ? 'fallback' : this.getEffectiveMode();

    // ── Step 1: Local substrate lookup (all modes) ────────────────────────────
    const hits = this.index.query(queryText, 1);
    const CONFIDENCE_THRESHOLD = 2.0; // minimum BM25-lite score for a "hit"

    if (hits.length > 0 && hits[0].score >= CONFIDENCE_THRESHOLD) {
      return {
        hit: true,
        record: hits[0].record,
        score: hits[0].score,
        routing: 'substrate_hit',
        latency_ms: Date.now() - t0,
        cloud_cost_avoided_usd: CLOUD_COST_PER_TOKEN_USD * TYPICAL_RESPONSE_TOKENS,
      };
    }

    // ── Step 2a: Normal / Fallback — return miss (no further escalation) ──────
    if (mode === 'normal' || mode === 'fallback') {
      return {
        hit: false,
        routing: mode === 'fallback' ? 'peer_sync' : 'miss',
        latency_ms: Date.now() - t0,
        cloud_cost_avoided_usd: 0,
      };
    }

    // ── Step 2b: AI Burst — try local Ollama ──────────────────────────────────
    const ollamaResult = await this._tryOllama(queryText, ollamaModel);
    if (ollamaResult) {
      const newRecord: SubstrateRecord = {
        id: createHash('md5').update(queryText).digest('hex').slice(0, 12),
        text: `${queryText} — ${ollamaResult.slice(0, 300)}`,
        source: 'local_ollama',
        keywords: [],
        ts: new Date().toISOString(),
      };
      this.index.writeRecord(newRecord);

      return {
        hit: true,
        record: newRecord,
        routing: 'local_ollama',
        latency_ms: Date.now() - t0,
        cloud_cost_avoided_usd: CLOUD_COST_PER_TOKEN_USD * TYPICAL_RESPONSE_TOKENS,
      };
    }

    // ── Step 3: AI Burst — cloud escalation ───────────────────────────────────
    return {
      hit: false,
      routing: 'cloud_escalation',
      latency_ms: Date.now() - t0,
      cloud_cost_avoided_usd: 0,
    };
  }

  private async _tryOllama(
    query: string,
    model = 'llama3.1:8b-instruct-q4_K_M',
  ): Promise<string | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(`${this.ollamaBase}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: query,
          stream: false,
          options: { num_predict: 200 },
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (!res.ok) return null;
      const data = await res.json() as { response?: string };
      return data.response?.trim() ?? null;
    } catch {
      return null;
    }
  }
}

// ─── Stop words ───────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'that', 'this', 'with', 'from', 'have', 'they', 'will', 'been', 'were',
  'what', 'when', 'where', 'which', 'while', 'your', 'more', 'also', 'into',
  'than', 'then', 'some', 'about', 'just', 'would', 'could', 'should',
  'their', 'there', 'these', 'those', 'each', 'such', 'other', 'after',
  'over', 'under', 'only', 'very', 'still', 'well', 'back', 'even',
]);
