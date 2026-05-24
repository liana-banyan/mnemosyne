// 🛠️ Miners — structured-data extraction → Iron Tablets
// Extracts file metadata, document headings, EXIF concepts from member-chosen folders.
// Output: Iron Tablets (mutable; update as source changes).

import { readdirSync, statSync, existsSync, readFileSync } from 'fs';
import { resolve, extname, basename } from 'path';
import type { AgentPersona, Eblet, PersonaScanOpts } from '../types';

const MAX_HEADING_BYTES = 65_536; // read first 64 KB for heading extraction

function extractMarkdownHeadings(text: string): string[] {
  return text
    .split('\n')
    .filter((l) => /^#{1,3}\s+.+/.test(l))
    .map((l) => l.replace(/^#+\s+/, '').trim())
    .slice(0, 20);
}

function extractTextHeadings(text: string): string[] {
  // Simple ALL-CAPS or line-followed-by-dashes heuristic
  return text
    .split('\n')
    .filter((l) => l.trim().length > 3 && l.trim().length < 120 && /^[A-Z]/.test(l.trim()))
    .slice(0, 10);
}

function categoriseFile(ext: string): string {
  const doc = ['.md', '.txt', '.rtf', '.doc', '.docx', '.odt', '.pdf'];
  const code = ['.ts', '.js', '.py', '.java', '.cs', '.cpp', '.c', '.go', '.rs', '.rb'];
  const image = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.svg'];
  const sheet = ['.csv', '.xlsx', '.xls', '.ods'];
  const data = ['.json', '.yaml', '.yml', '.xml', '.toml'];
  const archive = ['.zip', '.tar', '.gz', '.7z', '.rar'];
  if (doc.includes(ext)) return 'document';
  if (code.includes(ext)) return 'code';
  if (image.includes(ext)) return 'image';
  if (sheet.includes(ext)) return 'spreadsheet';
  if (data.includes(ext)) return 'data';
  if (archive.includes(ext)) return 'archive';
  return 'file';
}

function mineFile(filePath: string): { title: string; content: string; tags: string[] } {
  const name = basename(filePath);
  const ext = extname(filePath).toLowerCase();
  const category = categoriseFile(ext);
  let headings: string[] = [];

  try {
    if (['.md', '.txt', '.ts', '.js', '.py', '.json', '.yaml', '.yml'].includes(ext)) {
      const raw = readFileSync(filePath, 'utf-8').slice(0, MAX_HEADING_BYTES);
      headings = ext === '.md' ? extractMarkdownHeadings(raw) : extractTextHeadings(raw);
    }
  } catch { /* unreadable — fine */ }

  const stat = statSync(filePath);
  const content = [
    `**File:** ${name}`,
    `**Type:** ${category} (${ext || '(no extension)'})`,
    `**Size:** ${(stat.size / 1024).toFixed(1)} KB`,
    `**Modified:** ${stat.mtime.toISOString()}`,
    `**Created:** ${stat.birthtime.toISOString()}`,
    headings.length ? `\n**Detected headings / sections:**\n${headings.map((h) => `- ${h}`).join('\n')}` : '',
  ].filter(Boolean).join('\n');

  return {
    title: `File: ${name}`,
    content,
    tags: [category, ext.replace('.', '') || 'no-ext'],
  };
}

export const MinerPersona: AgentPersona = {
  id: 'miner',
  displayName: 'Miners',
  icon: '🛠️',

  async scan(folderPath, memberId, opts: PersonaScanOpts): Promise<Eblet[]> {
    const { sharingScope, maxFiles = 500, onProgress } = opts;
    const eblets: Eblet[] = [];
    let processed = 0;

    onProgress?.({ persona: 'miner', phase: 'scanning', message: `Scanning ${folderPath}` });

    function walkDir(dir: string, depth: number): void {
      if (processed >= maxFiles || depth > 8) return;
      if (!existsSync(dir)) return;
      let entries: string[];
      try {
        entries = readdirSync(dir);
      } catch {
        return;
      }

      for (const entry of entries) {
        if (processed >= maxFiles) break;
        const full = resolve(dir, entry);
        // Skip hidden files and known noise dirs
        if (entry.startsWith('.') || entry === 'node_modules' || entry === '__pycache__') continue;
        try {
          const stat = statSync(full);
          if (stat.isDirectory()) {
            walkDir(full, depth + 1);
          } else if (stat.isFile() && stat.size < 50 * 1024 * 1024) {
            // Skip very large binaries (> 50 MB)
            const { title, content, tags } = mineFile(full);
            eblets.push({
              tablet_id: '', // assigned by tablet_store
              tablet_grade: 'iron',
              agent_persona: 'miner',
              member_id: memberId,
              source_path: full,
              content_type: 'file_metadata',
              title,
              content,
              mined_at: new Date().toISOString(),
              sharing_scope: sharingScope,
              tags,
            });
            processed++;
          }
        } catch { /* skip unreadable */ }
      }
    }

    walkDir(folderPath, 0);

    onProgress?.({
      persona: 'miner',
      phase: 'done',
      message: `Miners extracted metadata for ${eblets.length} files`,
      tablets_written: eblets.length,
    });

    return eblets;
  },
};
