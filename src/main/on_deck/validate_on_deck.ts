// BP037 — On-Deck Phase 1: Standalone validator
// Usage: npx ts-node src/main/on_deck/validate_on_deck.ts [--dir ~/.lb_substrate/on_deck]
//
// Scans all on_deck subdirectories, validates each .eblet.md against the schema,
// and prints a pass/fail report. Exit code 0 = all valid; 1 = any failures.

import { readdirSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { homedir } from 'os';
import { parseOnDeckFile } from './on_deck_parser';
import type { OnDeckItem } from './on_deck_types';

const CATEGORIES = ['sequential', 'anytime', 'conditional'] as const;

function resolveSubstrateDir(args: string[]): string {
  const dirIdx = args.indexOf('--dir');
  if (dirIdx !== -1 && args[dirIdx + 1]) {
    const raw = args[dirIdx + 1];
    return raw.startsWith('~') ? resolve(homedir(), raw.slice(2)) : resolve(raw);
  }
  return resolve(homedir(), '.lb_substrate', 'on_deck');
}

function scanCategory(baseDir: string, category: string): string[] {
  const dir = join(baseDir, category);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.eblet.md'))
    .map((f) => join(dir, f));
}

export function validateOnDeckDir(baseDir: string): { passed: OnDeckItem[]; failed: { path: string; error: string }[] } {
  const passed: OnDeckItem[] = [];
  const failed: { path: string; error: string }[] = [];

  for (const cat of CATEGORIES) {
    const files = scanCategory(baseDir, cat);
    for (const fp of files) {
      const result = parseOnDeckFile(fp);
      if (result.ok) {
        passed.push(result.item);
      } else {
        failed.push({ path: result.file_path, error: result.error });
      }
    }
  }

  return { passed, failed };
}

// ─── CLI entry point ──────────────────────────────────────────────────────────

if (require.main === module) {
  const baseDir = resolveSubstrateDir(process.argv.slice(2));

  if (!existsSync(baseDir)) {
    console.error(`[validate_on_deck] Directory not found: ${baseDir}`);
    process.exit(1);
  }

  console.log(`\n[validate_on_deck] Scanning: ${baseDir}\n`);

  const { passed, failed } = validateOnDeckDir(baseDir);
  const total = passed.length + failed.length;

  if (total === 0) {
    console.log('  (no .eblet.md files found in sequential/ anytime/ conditional/)');
  }

  for (const item of passed) {
    const fm = item.frontmatter;
    console.log(`  ✓  ${fm.on_deck_id}  [${fm.target_seat}/${fm.category}/${fm.priority}]  ${fm.title ?? '(no title)'}`);
  }

  for (const f of failed) {
    console.log(`  ✗  ${f.path}`);
    console.log(`       ${f.error}`);
  }

  console.log(`\n  ${passed.length}/${total} valid\n`);

  if (failed.length > 0) process.exit(1);
}
