// BP140-K3 — Homework job frontmatter schema + parse/write
//
// Mirrors the on_deck Eblet frontmatter convention (src/main/on_deck/on_deck_types.ts +
// on_deck_parser.ts) — same `--- YAML ---` fence, same StatusSchema/PrioritySchema enums, same
// flat-YAML extraction primitives (extractFrontmatter/parseYamlBlock) reused verbatim below.
//
// NOT reusing OnDeckFrontmatterSchema.safeParse()/parseOnDeckFile() directly: zod's default
// z.object() strips unrecognized keys on parse, so `job_type`/`source_path`/`failure_reason`
// (homework-specific fields with no on_deck equivalent) would silently vanish from the parsed
// result if the shared schema were reused as-is. This file defines its own schema that reuses
// the shared *enums* and *primitives* (StatusSchema, PrioritySchema, extractFrontmatter,
// parseYamlBlock) for on_deck-family consistency, while keeping its own field set intact.
//
// Also builds the ONLY writer in the on_deck family: on_deck_bridge.ts's listOnDeck() is
// explicitly read-only (see BP140-K3 task spec — "none exists, you build the puller"). This
// writer is scoped to homework/ only; it never touches sequential/anytime/conditional/.

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import { extractFrontmatter, parseYamlBlock } from '../on_deck/on_deck_parser';
import { StatusSchema, PrioritySchema, type OnDeckStatus, type Priority } from '../on_deck/on_deck_types';

// ─── Job types ────────────────────────────────────────────────────────────────
// Proof-of-life ships exactly one job type. New job types are added here (and in
// homework_runner.ts's dispatch switch) only after Bishop reviews forage_eblet.

export const HomeworkJobTypeSchema = z.enum(['forage_eblet']);
export type HomeworkJobType = z.infer<typeof HomeworkJobTypeSchema>;

// ─── Frontmatter schema ─────────────────────────────────────────────────────

export const HomeworkFrontmatterSchema = z.object({
  homework_id: z.string().min(1, 'homework_id must not be empty'),
  job_type: HomeworkJobTypeSchema,
  priority: PrioritySchema.default('LOW'),
  status: StatusSchema.default('READY'),
  /** Absolute path to the archive file this job forages (e.g. an .rtf scan or journal file).
   *  Read-only input — the puller/job NEVER deletes or modifies this source file. */
  source_path: z.string().min(1, 'source_path must not be empty'),
  title: z.string().optional(),
  created_at: z.string().optional(),
  /** Populated only when status === 'FAILED'. Human-readable reason, left in place (never
   *  auto-retried, never deleted) for the Founder/Bishop to triage. */
  failure_reason: z.string().optional(),
});

export type HomeworkFrontmatter = z.infer<typeof HomeworkFrontmatterSchema>;

export interface HomeworkItem {
  frontmatter: HomeworkFrontmatter;
  body: string;
  /** Absolute path to the source .eblet.md job file (the queue entry, NOT source_path). */
  file_path: string;
}

export type HomeworkParseResult =
  | { ok: true; item: HomeworkItem }
  | { ok: false; file_path: string; error: string };

// ─── Parse ────────────────────────────────────────────────────────────────────

export function parseHomeworkFile(filePath: string): HomeworkParseResult {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch (e) {
    return { ok: false, file_path: filePath, error: `Cannot read file: ${String(e)}` };
  }

  const extracted = extractFrontmatter(content);
  if (!extracted) {
    return { ok: false, file_path: filePath, error: 'No YAML frontmatter found (must start with ---)' };
  }

  const rawObj = parseYamlBlock(extracted.raw);
  const parsed = HomeworkFrontmatterSchema.safeParse(rawObj);
  if (!parsed.success) {
    const msgs = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return { ok: false, file_path: filePath, error: `Schema validation failed: ${msgs}` };
  }

  return { ok: true, item: { frontmatter: parsed.data, body: extracted.body, file_path: filePath } };
}

// ─── Serialize + write ────────────────────────────────────────────────────────

function serializeHomeworkFile(frontmatter: HomeworkFrontmatter, body: string): string {
  const lines: string[] = ['---'];
  lines.push(`homework_id: ${frontmatter.homework_id}`);
  lines.push(`job_type: ${frontmatter.job_type}`);
  lines.push(`priority: ${frontmatter.priority}`);
  lines.push(`status: ${frontmatter.status}`);
  lines.push(`source_path: "${frontmatter.source_path.replace(/"/g, '\\"')}"`);
  if (frontmatter.title) lines.push(`title: "${frontmatter.title.replace(/"/g, '\\"')}"`);
  if (frontmatter.created_at) lines.push(`created_at: ${frontmatter.created_at}`);
  if (frontmatter.failure_reason) {
    lines.push(`failure_reason: "${frontmatter.failure_reason.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`);
  }
  lines.push('---');
  lines.push('');
  lines.push(body);
  return lines.join('\n');
}

/** Rewrite a homework job file IN PLACE with a new status/frontmatter (e.g. READY -> FAILED).
 *  Only ever called on files inside the homework/ queue dir — never on source_path archives. */
export function writeHomeworkFileInPlace(item: HomeworkItem): void {
  writeFileSync(item.file_path, serializeHomeworkFile(item.frontmatter, item.body), 'utf-8');
}

/** Move a completed job's .eblet.md from homework/ to homework/fired/, stamping status
 *  COMPLETE first. Additive-only: this MOVES the queue entry (a scheduling artifact, not the
 *  Vault), never the source_path archive it referenced. The durable COMPLETE record is written
 *  to fired/ BEFORE the original is removed, so a crash mid-move never loses the record. */
export function moveHomeworkFileToFired(item: HomeworkItem, firedDir: string): void {
  if (!existsSync(firedDir)) mkdirSync(firedDir, { recursive: true });
  const finalFrontmatter: HomeworkFrontmatter = { ...item.frontmatter, status: 'COMPLETE' };
  const content = serializeHomeworkFile(finalFrontmatter, item.body);
  const fileName = item.file_path.split(/[\\/]/).pop() ?? `${item.frontmatter.homework_id}.eblet.md`;
  const destPath = join(firedDir, fileName);
  writeFileSync(destPath, content, 'utf-8');
  try {
    unlinkSync(item.file_path);
  } catch {
    // non-fatal — the durable COMPLETE record already exists in fired/ either way
  }
}

/** Mark a job FAILED in place (never moved, never deleted — Founder/Bishop triage it). */
export function markHomeworkFailed(item: HomeworkItem, reason: string): void {
  const failedFrontmatter: HomeworkFrontmatter = { ...item.frontmatter, status: 'FAILED', failure_reason: reason };
  writeHomeworkFileInPlace({ ...item, frontmatter: failedFrontmatter });
}

export type { OnDeckStatus as HomeworkStatus, Priority as HomeworkPriority };
