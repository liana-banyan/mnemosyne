// AMPLIFY Computer — Hearth App Builder — Spec Extractor
// B69a — Free-form member request → validated AppSpec
// Local-first Cold Start Pathway: Ollama JSON-schema extraction, no cloud calls.

import { AppSpec, AppSpecSchema, SpecExtractResult } from './types';

const OLLAMA_BASE = 'http://localhost:11434';
const OLLAMA_MODEL = 'llama3.1:8b-instruct-q4_K_M';
const OLLAMA_TIMEOUT_MS = 30_000;

// ─── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a precise app specification extractor. Given a plain-English description of a desired application, you output ONLY a valid JSON object conforming to the AppSpec schema below. No markdown, no explanation, just JSON.

AppSpec schema:
{
  "appName": "string (1-64 chars, alphanumeric + spaces/dashes/underscores)",
  "description": "string (concise description of the app)",
  "entities": [
    {
      "name": "string (PascalCase, e.g. MoodEntry)",
      "fields": [
        { "name": "string (camelCase)", "type": "string|int|real|date|text|bool", "nullable": true/false }
      ]
    }
  ],
  "forms": [
    {
      "entity": "string (matches entity name)",
      "fields": ["field1", "field2"],
      "submitLabel": "optional string"
    }
  ],
  "views": [
    {
      "name": "string (e.g. AllMoodEntries)",
      "entity": "string (matches entity name)",
      "columns": ["field1", "field2"],
      "sortBy": "optional field name"
    }
  ],
  "metadata": {
    "author": "member",
    "version": "0.1.0",
    "createdAt": "ISO8601 timestamp"
  }
}

Rules:
- Always include an "id" field (type: "int", nullable: false) as the first field in each entity.
- Entity names: PascalCase. Field names: camelCase.
- If the user wants to rate/score something, use type "int".
- If the user wants a long note/description, use type "text". Short strings use "string".
- Create a form for every entity. Create a view for every entity.
- Output ONLY the JSON object, no other text.`;

function buildUserPrompt(request: string, author: string): string {
  return `Build an app for me: ${request}\n\nCurrent UTC timestamp: ${new Date().toISOString()}\nAuthor: ${author}`;
}

// ─── Ollama extraction ────────────────────────────────────────────────────────

async function extractViaOllama(
  request: string,
  author: string,
): Promise<{ raw: string; ok: boolean; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        system: SYSTEM_PROMPT,
        prompt: buildUserPrompt(request, author),
        stream: false,
        format: 'json',
        options: { num_predict: 1200, temperature: 0.1 },
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!res.ok) {
      return { raw: '', ok: false, error: `Ollama HTTP ${res.status}` };
    }

    const data = await res.json() as { response?: string };
    const raw = data.response?.trim() ?? '';
    return { raw, ok: raw.length > 0 };
  } catch (err: unknown) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : String(err);
    return { raw: '', ok: false, error: msg };
  }
}

async function isOllamaAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: controller.signal }).finally(() =>
      clearTimeout(timer),
    );
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Fallback spec builder (minimal deterministic spec from request text) ─────
// Used when Ollama is unavailable. Generates a minimal but valid AppSpec from
// a heuristic parse of the request text. Member is shown the result and can edit.

export function buildFallbackSpec(request: string, author: string): AppSpec {
  // Derive a sanitized app name
  const words = request
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4);
  const appName = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'My App';

  // Detect common field patterns in request text
  const lower = request.toLowerCase();
  const fields: Array<{ name: string; type: 'string' | 'int' | 'real' | 'date' | 'text' | 'bool'; nullable?: boolean }> = [
    { name: 'id', type: 'int', nullable: false },
    { name: 'title', type: 'string', nullable: false },
    { name: 'createdAt', type: 'date', nullable: false },
  ];

  if (lower.includes('note') || lower.includes('description') || lower.includes('comment')) {
    fields.push({ name: 'notes', type: 'text', nullable: true });
  }
  if (lower.includes('rate') || lower.includes('rating') || lower.includes('score') || lower.includes('1-10')) {
    fields.push({ name: 'rating', type: 'int', nullable: true });
  }
  if (lower.includes('mood')) {
    fields.push({ name: 'mood', type: 'int', nullable: true });
  }
  if (lower.includes('tag') || lower.includes('label') || lower.includes('category')) {
    fields.push({ name: 'tags', type: 'string', nullable: true });
  }
  if (lower.includes('amount') || lower.includes('cost') || lower.includes('price') || lower.includes('budget')) {
    fields.push({ name: 'amount', type: 'real', nullable: true });
  }
  if (lower.includes('date') || lower.includes('when') || lower.includes('day')) {
    fields.push({ name: 'date', type: 'date', nullable: true });
  }
  if (lower.includes('complete') || lower.includes('done') || lower.includes('finished')) {
    fields.push({ name: 'completed', type: 'bool', nullable: false });
  }

  const entityName = words[0]
    ? words[0].charAt(0).toUpperCase() + words[0].slice(1) + 'Entry'
    : 'Entry';

  const viewColumns = fields.filter((f) => f.name !== 'id').map((f) => f.name).slice(0, 5);

  return {
    appName,
    description: request.slice(0, 200),
    entities: [{ name: entityName, fields }],
    forms: [{ entity: entityName, fields: fields.filter((f) => f.name !== 'id').map((f) => f.name), submitLabel: 'Save' }],
    views: [{ name: `All${entityName}s`, entity: entityName, columns: viewColumns, sortBy: 'createdAt' }],
    metadata: { author, version: '0.1.0', createdAt: new Date().toISOString() },
  };
}

// ─── Parse + validate ─────────────────────────────────────────────────────────

function parseAndValidate(raw: string): { ok: boolean; spec?: AppSpec; error?: string } {
  // Strip markdown code fences if Ollama returns them anyway
  let cleaned = raw.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    return { ok: false, error: `JSON parse failed: ${e instanceof Error ? e.message : String(e)}` };
  }

  const result = AppSpecSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return { ok: false, error: `AppSpec validation failed: ${issues}` };
  }

  return { ok: true, spec: result.data };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function extractSpec(
  request: string,
  author = 'member',
): Promise<SpecExtractResult> {
  const t0 = Date.now();

  if (!request?.trim()) {
    return { ok: false, error: 'Empty request', method: 'ollama', latency_ms: 0 };
  }

  // Try Ollama first (local-first Cold Start Pathway — no cloud)
  const ollamaAvailable = await isOllamaAvailable();

  if (ollamaAvailable) {
    const { raw, ok: fetchOk, error: fetchErr } = await extractViaOllama(request, author);
    if (fetchOk && raw) {
      const parsed = parseAndValidate(raw);
      if (parsed.ok && parsed.spec) {
        return { ok: true, spec: parsed.spec, method: 'ollama', latency_ms: Date.now() - t0 };
      }
      // Ollama returned unparseable JSON — fall through to fallback
      console.warn('[HearthExtractor] Ollama returned invalid spec, using fallback:', parsed.error);
    } else {
      console.warn('[HearthExtractor] Ollama fetch failed:', fetchErr);
    }
  }

  // Fallback: deterministic heuristic extraction
  const fallbackSpec = buildFallbackSpec(request, author);
  const validated = AppSpecSchema.safeParse(fallbackSpec);
  if (!validated.success) {
    return {
      ok: false,
      error: 'Fallback spec generation failed validation — please describe your app differently',
      method: 'fallback_form',
      latency_ms: Date.now() - t0,
    };
  }

  return {
    ok: true,
    spec: validated.data,
    method: 'fallback_form',
    latency_ms: Date.now() - t0,
  };
}

// Smoke test: extract a known spec and verify it's valid
export async function specExtractSmoke(): Promise<{ passed: boolean; latency_ms: number; error?: string }> {
  const t0 = Date.now();
  try {
    const result = await extractSpec(
      'build me a daily-log app where I rate my mood 1-10 and write a note',
    );
    if (!result.ok || !result.spec) {
      return { passed: false, latency_ms: Date.now() - t0, error: result.error ?? 'no spec returned' };
    }
    // Verify minimum structure
    if (result.spec.entities.length < 1 || result.spec.forms.length < 1 || result.spec.views.length < 1) {
      return { passed: false, latency_ms: Date.now() - t0, error: 'spec missing entities/forms/views' };
    }
    return { passed: true, latency_ms: Date.now() - t0 };
  } catch (err) {
    return { passed: false, latency_ms: Date.now() - t0, error: String(err) };
  }
}
