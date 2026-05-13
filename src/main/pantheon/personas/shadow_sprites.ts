// 🧝 Shadow E-Sprites — nimble first-look → pre-Forager triage Iron Tablets
// Lightweight surface-skim: quick categorisation, large-file detection, unusual extensions.
// Fastest persona — runs first to give member an immediate sense of what the Pantheon found.

import { readdirSync, statSync, existsSync } from 'fs';
import { resolve, extname, basename } from 'path';
import type { AgentPersona, Eblet, PersonaScanOpts } from '../types';

const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024; // 10 MB
const UNUSUAL_EXTENSIONS = new Set([
  'exe', 'dll', 'so', 'dylib', 'bin', 'dat', 'iso', 'img',
  'pem', 'key', 'p12', 'pfx', 'asc', 'gpg',
]);

interface SpriteReport {
  total_items: number;
  file_count: number;
  dir_count: number;
  large_files: Array<{ name: string; size_bytes: number }>;
  unusual_extension_files: string[];
  top_extensions: Array<{ ext: string; count: number }>;
  hidden_item_count: number;
}

function spriteSkim(folderPath: string): SpriteReport {
  const report: SpriteReport = {
    total_items: 0,
    file_count: 0,
    dir_count: 0,
    large_files: [],
    unusual_extension_files: [],
    top_extensions: [],
    hidden_item_count: 0,
  };

  if (!existsSync(folderPath)) return report;

  const extCount: Record<string, number> = {};

  let entries: string[];
  try { entries = readdirSync(folderPath); } catch { return report; }

  for (const entry of entries) {
    report.total_items++;
    if (entry.startsWith('.')) { report.hidden_item_count++; continue; }

    const full = resolve(folderPath, entry);
    try {
      const stat = statSync(full);
      if (stat.isDirectory()) {
        report.dir_count++;
      } else {
        report.file_count++;
        const ext = extname(entry).replace('.', '').toLowerCase();
        extCount[ext] = (extCount[ext] ?? 0) + 1;

        if (stat.size >= LARGE_FILE_THRESHOLD) {
          report.large_files.push({ name: entry, size_bytes: stat.size });
        }
        if (UNUSUAL_EXTENSIONS.has(ext)) {
          report.unusual_extension_files.push(basename(entry));
        }
      }
    } catch { /* skip */ }
  }

  report.top_extensions = Object.entries(extCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([ext, count]) => ({ ext, count }));

  return report;
}

function reportToContent(r: SpriteReport, folderPath: string): string {
  const largeLines = r.large_files
    .slice(0, 5)
    .map((f) => `  - \`${f.name}\` (${(f.size_bytes / (1024 * 1024)).toFixed(1)} MB)`)
    .join('\n');
  const extLines = r.top_extensions
    .map((e) => `  .${e.ext || '(none)'}: ${e.count}`)
    .join('\n');

  return [
    `**Folder:** ${folderPath}`,
    `**Items:** ${r.total_items}  (${r.file_count} files, ${r.dir_count} dirs, ${r.hidden_item_count} hidden)`,
    extLines ? `\n**Top file types:**\n${extLines}` : '',
    r.large_files.length ? `\n**Large files (>10 MB):**\n${largeLines}` : '',
    r.unusual_extension_files.length
      ? `\n**Unusual extensions detected:** ${r.unusual_extension_files.slice(0, 5).join(', ')}`
      : '',
    '\n*Sprites note:* This is a surface-skim triage report — lightweight first-pass before Forager does deep inventory.',
  ].filter(Boolean).join('\n');
}

export const ShadowSpritesPersona: AgentPersona = {
  id: 'shadow_sprite',
  displayName: 'Shadow E-Sprites',
  icon: '🧝',

  async scan(folderPath, memberId, opts: PersonaScanOpts): Promise<Eblet[]> {
    const { sharingScope, onProgress } = opts;

    onProgress?.({ persona: 'shadow_sprite', phase: 'scanning', message: `Sprites skimming ${folderPath}` });

    const report = spriteSkim(folderPath);

    const eblet: Eblet = {
      tablet_id: '',
      tablet_grade: 'iron',
      agent_persona: 'shadow_sprite',
      member_id: memberId,
      source_path: folderPath,
      content_type: 'surface_triage',
      title: `Sprite Triage: ${folderPath}`,
      content: reportToContent(report, folderPath),
      mined_at: new Date().toISOString(),
      sharing_scope: sharingScope,
      tags: ['sprite', 'triage', 'surface-skim'],
    };

    onProgress?.({
      persona: 'shadow_sprite',
      phase: 'done',
      message: `Sprites skimmed ${report.total_items} items`,
      tablets_written: 1,
    });

    return [eblet];
  },
};
