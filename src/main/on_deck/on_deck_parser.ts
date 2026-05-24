// BP037 — On-Deck Phase 1: Frontmatter parser for .eblet.md files
// Parses YAML frontmatter delimited by --- ... ---

import { readFileSync } from 'fs';
import { OnDeckFrontmatterSchema, type OnDeckItem } from './on_deck_types';
import type { ZodError } from 'zod';

// ─── Result types ─────────────────────────────────────────────────────────────

export interface ParseOk {
  ok: true;
  item: OnDeckItem;
}

export interface ParseErr {
  ok: false;
  file_path: string;
  error: string;
}

export type ParseResult = ParseOk | ParseErr;

// ─── YAML frontmatter extractor ───────────────────────────────────────────────

/**
 * Extract the raw YAML block between the first --- and the second ---.
 * Returns null if the document doesn't start with a YAML fence.
 */
export function extractFrontmatter(content: string): { raw: string; body: string } | null {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('---')) return null;

  const firstNewline = trimmed.indexOf('\n');
  if (firstNewline === -1) return null;

  const rest = trimmed.slice(firstNewline + 1);
  const closingFence = rest.indexOf('\n---');
  if (closingFence === -1) return null;

  const raw = rest.slice(0, closingFence).trim();
  const body = rest.slice(closingFence + 4).trim(); // skip \n---
  return { raw, body };
}

// ─── Minimal flat YAML parser ─────────────────────────────────────────────────
// Handles: strings, numbers, booleans, and single-line arrays ([ "a", "b" ])
// Sufficient for the on_deck frontmatter schema; no external dependency.

function parseYamlValue(raw: string): unknown {
  const v = raw.trim();

  // Array: [ "a", "b" ] or []
  if (v.startsWith('[')) {
    const inner = v.slice(1, v.lastIndexOf(']'));
    if (inner.trim() === '') return [];
    return inner
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }

  // Boolean
  if (v === 'true') return true;
  if (v === 'false') return false;

  // Null
  if (v === 'null' || v === '~' || v === '') return null;

  // Number
  const n = Number(v);
  if (!isNaN(n) && v !== '') return n;

  // Quoted string
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }

  return v;
}

export function parseYamlBlock(raw: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const line of raw.split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const val = line.slice(colon + 1).trim();
    if (key) result[key] = parseYamlValue(val);
  }
  return result;
}

// ─── Public parse function ────────────────────────────────────────────────────

export function parseOnDeckFile(filePath: string): ParseResult {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch (e) {
    return { ok: false, file_path: filePath, error: `Cannot read file: ${String(e)}` };
  }

  const extracted = extractFrontmatter(content);
  if (!extracted) {
    return {
      ok: false,
      file_path: filePath,
      error: 'No YAML frontmatter found (must start with ---)',
    };
  }

  const rawObj = parseYamlBlock(extracted.raw);

  const parsed = OnDeckFrontmatterSchema.safeParse(rawObj);
  if (!parsed.success) {
    const err = parsed.error as ZodError;
    const msgs = err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return { ok: false, file_path: filePath, error: `Schema validation failed: ${msgs}` };
  }

  return {
    ok: true,
    item: {
      frontmatter: parsed.data,
      body: extracted.body,
      file_path: filePath,
    },
  };
}

export function parseOnDeckContent(content: string, filePath: string): ParseResult {
  const extracted = extractFrontmatter(content);
  if (!extracted) {
    return {
      ok: false,
      file_path: filePath,
      error: 'No YAML frontmatter found (must start with ---)',
    };
  }

  const rawObj = parseYamlBlock(extracted.raw);
  const parsed = OnDeckFrontmatterSchema.safeParse(rawObj);
  if (!parsed.success) {
    const err = parsed.error as ZodError;
    const msgs = err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return { ok: false, file_path: filePath, error: `Schema validation failed: ${msgs}` };
  }

  return {
    ok: true,
    item: {
      frontmatter: parsed.data,
      body: extracted.body,
      file_path: filePath,
    },
  };
}
