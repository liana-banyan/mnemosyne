// Tablet Store — Phase B persistence layer for Pixie Dust Mining
// BP041 Canon: ~/.lb_substrate/tablets/<member_id>/iron/*.eblet.md (mutable)
//              ~/.lb_substrate/tablets/<member_id>/stone/*.eblet.md (immutable)
// Member sovereignty: tablets never leave device without explicit Federation Share.

import { mkdirSync, existsSync, writeFileSync, readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { randomUUID } from 'crypto';
import { TABLETS_ROOT } from './types';
import type { Eblet, TabletGrade, PersonaId, SharingScope } from './types';

// ─── Path helpers ─────────────────────────────────────────────────────────────

export function ironDir(memberId: string): string {
  return resolve(TABLETS_ROOT, memberId, 'iron');
}

export function stoneDir(memberId: string): string {
  return resolve(TABLETS_ROOT, memberId, 'stone');
}

function tabletPath(memberId: string, grade: TabletGrade, tabletId: string): string {
  const dir = grade === 'iron' ? ironDir(memberId) : stoneDir(memberId);
  const safe = tabletId.replace(/[^a-zA-Z0-9_.-]/g, '_');
  return resolve(dir, `${safe}.eblet.md`);
}

export function ensureTabletLayout(memberId: string): void {
  for (const d of [ironDir(memberId), stoneDir(memberId)]) {
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
  }
}

// ─── Markdown serialisation ───────────────────────────────────────────────────

function toMarkdown(eblet: Eblet): string {
  const frontmatter = [
    '---',
    `tablet_id: ${eblet.tablet_id}`,
    `tablet_grade: ${eblet.tablet_grade}`,
    `agent_persona: ${eblet.agent_persona}`,
    `member_id: ${eblet.member_id}`,
    `source_path: "${eblet.source_path.replace(/"/g, '\\"')}"`,
    `content_type: ${eblet.content_type}`,
    `mined_at: ${eblet.mined_at}`,
    `sharing_scope: ${eblet.sharing_scope}`,
    eblet.supersedes ? `supersedes: ${eblet.supersedes}` : null,
    eblet.tags?.length ? `tags: [${eblet.tags.map((t) => `"${t}"`).join(', ')}]` : null,
    '---',
  ].filter(Boolean).join('\n');

  return `${frontmatter}\n\n# ${eblet.title}\n\n${eblet.content}\n`;
}

function parseFrontmatter(raw: string): Partial<Eblet> {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, unknown> = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.+)$/);
    if (!kv) continue;
    const [, key, val] = kv;
    const stripped = val.trim().replace(/^"(.*)"$/, '$1');
    result[key] = stripped;
  }
  return result as Partial<Eblet>;
}

// ─── Write ────────────────────────────────────────────────────────────────────

export function writeIronTablet(memberId: string, eblet: Omit<Eblet, 'tablet_id' | 'tablet_grade'>): Eblet {
  ensureTabletLayout(memberId);
  const full: Eblet = {
    ...eblet,
    tablet_id: randomUUID(),
    tablet_grade: 'iron',
  };
  writeFileSync(tabletPath(memberId, 'iron', full.tablet_id), toMarkdown(full), 'utf-8');
  return full;
}

export function writeStoneTablet(memberId: string, eblet: Omit<Eblet, 'tablet_id' | 'tablet_grade'>): Eblet {
  ensureTabletLayout(memberId);
  const full: Eblet = {
    ...eblet,
    tablet_id: randomUUID(),
    tablet_grade: 'stone',
  };
  writeFileSync(tabletPath(memberId, 'stone', full.tablet_id), toMarkdown(full), 'utf-8');
  return full;
}

/** Promote an Iron Tablet to Stone — original is retained; Stone supersedes it. */
export function promoteToStone(memberId: string, ironTabletId: string): Eblet | null {
  ensureTabletLayout(memberId);
  const ironPath = tabletPath(memberId, 'iron', ironTabletId);
  if (!existsSync(ironPath)) return null;
  const raw = readFileSync(ironPath, 'utf-8');
  const meta = parseFrontmatter(raw);
  const contentMatch = raw.match(/^---[\s\S]*?---\n\n([\s\S]*)$/);
  const content = contentMatch ? contentMatch[1].trim() : '';

  const stone: Eblet = {
    tablet_id: randomUUID(),
    tablet_grade: 'stone',
    agent_persona: (meta.agent_persona as PersonaId) ?? 'fates',
    member_id: memberId,
    source_path: meta.source_path ?? '',
    content_type: meta.content_type ?? 'promoted_pattern',
    title: `[Stone] ${meta.title ?? ironTabletId}`,
    content,
    mined_at: new Date().toISOString(),
    sharing_scope: (meta.sharing_scope as SharingScope) ?? 'private',
    supersedes: ironTabletId,
    tags: Array.isArray(meta.tags) ? meta.tags : [],
  };
  writeFileSync(tabletPath(memberId, 'stone', stone.tablet_id), toMarkdown(stone), 'utf-8');
  return stone;
}

// ─── List ─────────────────────────────────────────────────────────────────────

export interface TabletSummary {
  tablet_id: string;
  tablet_grade: TabletGrade;
  agent_persona: PersonaId;
  source_path: string;
  content_type: string;
  mined_at: string;
  sharing_scope: SharingScope;
  supersedes?: string;
  tags?: string[];
}

export function listTablets(
  memberId: string,
  opts: { grade?: TabletGrade; persona?: PersonaId } = {},
): TabletSummary[] {
  const results: TabletSummary[] = [];
  const grades: TabletGrade[] = opts.grade ? [opts.grade] : ['iron', 'stone'];

  for (const grade of grades) {
    const dir = grade === 'iron' ? ironDir(memberId) : stoneDir(memberId);
    if (!existsSync(dir)) continue;
    for (const fname of readdirSync(dir)) {
      if (!fname.endsWith('.eblet.md')) continue;
      try {
        const raw = readFileSync(resolve(dir, fname), 'utf-8');
        const meta = parseFrontmatter(raw) as TabletSummary;
        if (!meta.tablet_id) continue;
        if (opts.persona && meta.agent_persona !== opts.persona) continue;
        results.push({
          tablet_id: meta.tablet_id,
          tablet_grade: grade,
          agent_persona: meta.agent_persona,
          source_path: meta.source_path ?? '',
          content_type: meta.content_type ?? '',
          mined_at: meta.mined_at ?? '',
          sharing_scope: meta.sharing_scope ?? 'private',
          supersedes: meta.supersedes,
          tags: Array.isArray(meta.tags) ? meta.tags : [],
        });
      } catch {
        /* skip corrupt tablet */
      }
    }
  }

  return results.sort((a, b) => b.mined_at.localeCompare(a.mined_at));
}

export function countTablets(memberId: string): { iron: number; stone: number; total: number } {
  const ironCount = existsSync(ironDir(memberId))
    ? readdirSync(ironDir(memberId)).filter((f) => f.endsWith('.eblet.md')).length
    : 0;
  const stoneCount = existsSync(stoneDir(memberId))
    ? readdirSync(stoneDir(memberId)).filter((f) => f.endsWith('.eblet.md')).length
    : 0;
  return { iron: ironCount, stone: stoneCount, total: ironCount + stoneCount };
}

/** Wipe all tablets for a member — sovereignty right. */
export function wipeTablets(memberId: string): { wiped: number } {
  const { rmSync } = require('fs') as typeof import('fs');
  let wiped = 0;
  for (const grade of ['iron', 'stone'] as TabletGrade[]) {
    const dir = grade === 'iron' ? ironDir(memberId) : stoneDir(memberId);
    if (!existsSync(dir)) continue;
    for (const fname of readdirSync(dir)) {
      if (!fname.endsWith('.eblet.md')) continue;
      try {
        rmSync(resolve(dir, fname));
        wiped++;
      } catch { /* non-fatal */ }
    }
  }
  return { wiped };
}
