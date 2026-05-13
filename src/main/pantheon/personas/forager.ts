// 🦊 Foragers — inventory scan → Iron Tablets
// Fast directory manifests: catalog what exists, surface forgotten artifacts.
// Composes with existing Forager scribe (BP037 inventory canon).

import { readdirSync, statSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { AgentPersona, Eblet, PersonaScanOpts } from '../types';

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

interface DirManifest {
  path: string;
  file_count: number;
  subdir_count: number;
  total_size_bytes: number;
  largest_file: { name: string; size_bytes: number } | null;
  oldest_file: { name: string; mtime: string } | null;
  newest_file: { name: string; mtime: string } | null;
  extension_distribution: Record<string, number>;
}

function manifestDir(dirPath: string): DirManifest {
  const manifest: DirManifest = {
    path: dirPath,
    file_count: 0,
    subdir_count: 0,
    total_size_bytes: 0,
    largest_file: null,
    oldest_file: null,
    newest_file: null,
    extension_distribution: {},
  };

  let entries: string[];
  try {
    entries = readdirSync(dirPath);
  } catch {
    return manifest;
  }

  for (const entry of entries) {
    if (entry.startsWith('.') || entry === 'node_modules' || entry === '__pycache__') continue;
    const full = resolve(dirPath, entry);
    try {
      const stat = statSync(full);
      if (stat.isDirectory()) {
        manifest.subdir_count++;
      } else if (stat.isFile()) {
        manifest.file_count++;
        manifest.total_size_bytes += stat.size;

        const ext = entry.includes('.') ? entry.split('.').pop()!.toLowerCase() : '(none)';
        manifest.extension_distribution[ext] = (manifest.extension_distribution[ext] ?? 0) + 1;

        if (!manifest.largest_file || stat.size > manifest.largest_file.size_bytes) {
          manifest.largest_file = { name: entry, size_bytes: stat.size };
        }
        const mtime = stat.mtime.toISOString();
        if (!manifest.oldest_file || mtime < manifest.oldest_file.mtime) {
          manifest.oldest_file = { name: entry, mtime };
        }
        if (!manifest.newest_file || mtime > manifest.newest_file.mtime) {
          manifest.newest_file = { name: entry, mtime };
        }
      }
    } catch { /* skip */ }
  }

  return manifest;
}

function manifestToContent(m: DirManifest): string {
  const extLines = Object.entries(m.extension_distribution)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([ext, count]) => `  .${ext}: ${count}`)
    .join('\n');

  return [
    `**Path:** ${m.path}`,
    `**Files:** ${m.file_count}  |  **Sub-directories:** ${m.subdir_count}`,
    `**Total size:** ${humanSize(m.total_size_bytes)}`,
    m.largest_file ? `**Largest file:** ${m.largest_file.name} (${humanSize(m.largest_file.size_bytes)})` : '',
    m.oldest_file ? `**Oldest:** ${m.oldest_file.name} (${m.oldest_file.mtime})` : '',
    m.newest_file ? `**Newest:** ${m.newest_file.name} (${m.newest_file.mtime})` : '',
    extLines ? `\n**Extension distribution:**\n${extLines}` : '',
  ].filter(Boolean).join('\n');
}

export const ForagerPersona: AgentPersona = {
  id: 'forager',
  displayName: 'Foragers',
  icon: '🦊',

  async scan(folderPath, memberId, opts: PersonaScanOpts): Promise<Eblet[]> {
    const { sharingScope, maxFiles = 200, onProgress } = opts;
    const eblets: Eblet[] = [];

    onProgress?.({ persona: 'forager', phase: 'scanning', message: `Foraging ${folderPath}` });

    const dirsToScan: string[] = [folderPath];
    let dirCount = 0;

    while (dirsToScan.length > 0 && dirCount < maxFiles) {
      const current = dirsToScan.shift()!;
      if (!existsSync(current)) continue;

      const manifest = manifestDir(current);
      dirCount++;

      eblets.push({
        tablet_id: '',
        tablet_grade: 'iron',
        agent_persona: 'forager',
        member_id: memberId,
        source_path: current,
        content_type: 'directory_manifest',
        title: `Directory: ${current}`,
        content: manifestToContent(manifest),
        mined_at: new Date().toISOString(),
        sharing_scope: sharingScope,
        tags: ['directory', 'manifest', 'forager'],
      });

      // Queue subdirectories (up to depth 3)
      if (dirCount < maxFiles) {
        try {
          for (const entry of readdirSync(current)) {
            if (entry.startsWith('.') || entry === 'node_modules' || entry === '__pycache__') continue;
            const full = resolve(current, entry);
            try {
              if (statSync(full).isDirectory()) dirsToScan.push(full);
            } catch { /* skip */ }
          }
        } catch { /* skip unreadable */ }
      }
    }

    onProgress?.({
      persona: 'forager',
      phase: 'done',
      message: `Foragers catalogued ${eblets.length} directories`,
      tablets_written: eblets.length,
    });

    return eblets;
  },
};
