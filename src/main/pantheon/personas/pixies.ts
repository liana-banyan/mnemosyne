// 🧚 Pixies — micro-attribution dusting → Pheromone dust → aggregated Iron Tablets
// Tiny-grain attribution: recently modified files, creation bursts, frequently-touched artifacts.
// Pheromone dust is sub-Eblet; here aggregated into a single member attribution-profile Iron Tablet.

import { readdirSync, statSync, existsSync } from 'fs';
import { resolve, basename } from 'path';
import type { AgentPersona, Eblet, PersonaScanOpts } from '../types';

interface DustParticle {
  path: string;
  name: string;
  modified_at: string;
  size_bytes: number;
  category: string;
}

function collectDust(folderPath: string, maxFiles = 300): DustParticle[] {
  const particles: DustParticle[] = [];
  const now = Date.now();
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

  function walk(dir: string, depth: number): void {
    if (particles.length >= maxFiles || depth > 5) return;
    if (!existsSync(dir)) return;
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return; }

    for (const entry of entries) {
      if (particles.length >= maxFiles) break;
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      const full = resolve(dir, entry);
      try {
        const stat = statSync(full);
        if (stat.isDirectory()) {
          walk(full, depth + 1);
        } else if (stat.isFile() && now - stat.mtimeMs < THIRTY_DAYS) {
          // Only recently-touched files qualify as active dust
          particles.push({
            path: full,
            name: basename(full),
            modified_at: stat.mtime.toISOString(),
            size_bytes: stat.size,
            category: entry.includes('.') ? entry.split('.').pop()!.toLowerCase() : 'other',
          });
        }
      } catch { /* skip */ }
    }
  }

  walk(folderPath, 0);
  return particles.sort((a, b) => b.modified_at.localeCompare(a.modified_at));
}

function dustToContent(particles: DustParticle[], folderPath: string): string {
  const categoryMap: Record<string, number> = {};
  for (const p of particles) {
    categoryMap[p.category] = (categoryMap[p.category] ?? 0) + 1;
  }
  const topCategories = Object.entries(categoryMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([cat, count]) => `  .${cat}: ${count} files`)
    .join('\n');

  const recentLines = particles
    .slice(0, 20)
    .map((p) => `- \`${p.name}\`  (${p.modified_at.slice(0, 10)})`)
    .join('\n');

  return [
    `**Scanned folder:** ${folderPath}`,
    `**Active files (last 30 days):** ${particles.length}`,
    `\n**Most-active file types:**\n${topCategories || '  (none)'}`,
    `\n**Most recently modified:**\n${recentLines || '  (none)'}`,
    '\n*Pixies note:* This is micro-attribution dust — a cooperative-substrate fingerprint of recent creative activity. Aggregated signals feed your Three-Currency Ledger contribution profile.',
  ].filter(Boolean).join('\n');
}

export const PixiesPersona: AgentPersona = {
  id: 'pixies',
  displayName: 'Pixies',
  icon: '🧚',

  async scan(folderPath, memberId, opts: PersonaScanOpts): Promise<Eblet[]> {
    const { sharingScope, maxFiles = 300, onProgress } = opts;

    onProgress?.({ persona: 'pixies', phase: 'scanning', message: `Dusting ${folderPath}` });

    const particles = collectDust(folderPath, maxFiles);

    onProgress?.({ persona: 'pixies', phase: 'generating', message: `Aggregating ${particles.length} dust particles` });

    if (particles.length === 0) {
      onProgress?.({ persona: 'pixies', phase: 'done', message: 'No recently-active files found', tablets_written: 0 });
      return [];
    }

    const eblet: Eblet = {
      tablet_id: '',
      tablet_grade: 'iron',
      agent_persona: 'pixies',
      member_id: memberId,
      source_path: folderPath,
      content_type: 'attribution_dust',
      title: `Pixie Dust: Recent Activity in ${folderPath}`,
      content: dustToContent(particles, folderPath),
      mined_at: new Date().toISOString(),
      sharing_scope: sharingScope,
      tags: ['pixies', 'attribution', 'recent-activity', 'pheromone-dust'],
    };

    onProgress?.({ persona: 'pixies', phase: 'done', message: 'Pixies aggregated attribution dust', tablets_written: 1 });
    return [eblet];
  },
};
