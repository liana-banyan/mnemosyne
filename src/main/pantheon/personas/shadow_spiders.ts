// 🕷️ Shadow E-Spiders — deep recursive crawl → Iron Tablets (web of references)
// Full depth traversal: builds a cross-reference map linking related files by name/type proximity.
// More thorough than Forager but slower; focuses on relationships, not just inventory.

import { readdirSync, statSync, existsSync } from 'fs';
import { resolve, basename, extname, relative } from 'path';
import type { AgentPersona, Eblet, PersonaScanOpts } from '../types';

interface CrawlNode {
  path: string;
  name: string;
  ext: string;
  size_bytes: number;
  mtime: string;
  depth: number;
}

interface WebThread {
  anchor: string;
  related: string[];
  reason: string;
}

function crawlTree(folderPath: string, maxNodes = 1000): CrawlNode[] {
  const nodes: CrawlNode[] = [];

  function walk(dir: string, depth: number): void {
    if (nodes.length >= maxNodes || depth > 10) return;
    if (!existsSync(dir)) return;
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return; }

    for (const entry of entries) {
      if (nodes.length >= maxNodes) break;
      if (entry.startsWith('.') || entry === 'node_modules' || entry === '__pycache__') continue;
      const full = resolve(dir, entry);
      try {
        const stat = statSync(full);
        if (stat.isDirectory()) {
          walk(full, depth + 1);
        } else {
          nodes.push({
            path: full,
            name: basename(full),
            ext: extname(full).toLowerCase(),
            size_bytes: stat.size,
            mtime: stat.mtime.toISOString(),
            depth,
          });
        }
      } catch { /* skip */ }
    }
  }

  walk(folderPath, 0);
  return nodes;
}

/** Build simple cross-reference threads: files with matching base-name in different dirs */
function buildWebThreads(nodes: CrawlNode[], folderPath: string): WebThread[] {
  const threads: WebThread[] = [];
  const byBaseStem: Record<string, string[]> = {};

  for (const node of nodes) {
    const stem = node.name.replace(/\.[^.]+$/, '').toLowerCase();
    if (!byBaseStem[stem]) byBaseStem[stem] = [];
    byBaseStem[stem].push(node.path);
  }

  for (const [stem, paths] of Object.entries(byBaseStem)) {
    if (paths.length < 2) continue;
    threads.push({
      anchor: stem,
      related: paths.map((p) => relative(folderPath, p)),
      reason: 'shared_base_name',
    });
  }

  return threads.slice(0, 30); // cap at 30 threads per web
}

function spiderWebToContent(nodes: CrawlNode[], threads: WebThread[], folderPath: string): string {
  const maxDepth = Math.max(...nodes.map((n) => n.depth), 0);
  const threadLines = threads
    .slice(0, 10)
    .map((t) => `- **${t.anchor}**: ${t.related.slice(0, 3).join(' ↔ ')}${t.related.length > 3 ? ` (+${t.related.length - 3} more)` : ''}`)
    .join('\n');

  return [
    `**Root:** ${folderPath}`,
    `**Total nodes crawled:** ${nodes.length}`,
    `**Max depth reached:** ${maxDepth}`,
    `**Cross-reference threads detected:** ${threads.length}`,
    threads.length ? `\n**Sample threads (shared base names):**\n${threadLines}` : '',
    '\n*Spider note:* Deep recursive crawl — web of cross-references. These threads seed future Fates pattern detection.',
  ].filter(Boolean).join('\n');
}

export const ShadowSpidersPersona: AgentPersona = {
  id: 'shadow_spider',
  displayName: 'Shadow E-Spiders',
  icon: '🕷️',

  async scan(folderPath, memberId, opts: PersonaScanOpts): Promise<Eblet[]> {
    const { sharingScope, maxFiles = 800, onProgress } = opts;

    onProgress?.({ persona: 'shadow_spider', phase: 'scanning', message: `Spiders crawling ${folderPath}` });

    const nodes = crawlTree(folderPath, maxFiles);

    onProgress?.({ persona: 'shadow_spider', phase: 'generating', message: `Building cross-reference web from ${nodes.length} nodes` });

    const threads = buildWebThreads(nodes, folderPath);

    const eblet: Eblet = {
      tablet_id: '',
      tablet_grade: 'iron',
      agent_persona: 'shadow_spider',
      member_id: memberId,
      source_path: folderPath,
      content_type: 'spider_web',
      title: `Spider Web: ${folderPath}`,
      content: spiderWebToContent(nodes, threads, folderPath),
      mined_at: new Date().toISOString(),
      sharing_scope: sharingScope,
      tags: ['spider', 'crawl', 'cross-reference', 'pheromone'],
    };

    onProgress?.({
      persona: 'shadow_spider',
      phase: 'done',
      message: `Spiders wove ${threads.length} cross-reference threads from ${nodes.length} nodes`,
      tablets_written: 1,
    });

    return [eblet];
  },
};
