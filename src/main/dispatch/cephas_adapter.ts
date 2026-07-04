// Cephas Hugo adapter — Battery Dispatch SEG-2a
// Writes content file → Hugo build → Firebase deploy
// BP082 · Sonnet 4.6
//
// Full-auto: no Founder interaction needed after ratify.

import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { ContentFileMeta, DispatchResult } from './types';

const execAsync = promisify(exec);

const WORKSPACE = join(homedir(), 'Documents', 'LianaBanyanPlatform');
const CEPHAS_CONTENT = join(WORKSPACE, 'Cephas', 'cephas-hugo', 'content');
const CEPHAS_HUGO = join(WORKSPACE, 'Cephas', 'cephas-hugo');

function contentClassToSection(cls: ContentFileMeta['contentClass']): string {
  switch (cls) {
    case 'op-ed': return 'op-eds';
    case 'crown-letter': return 'letters/crown-initiative';
    case 'paper': return 'papers';
    default: return 'articles';
  }
}

function buildCephásMarkdown(meta: ContentFileMeta, body: string): string {
  const date = meta.date ?? new Date().toISOString().split('T')[0];
  const slug = meta.slug ?? meta.fileName.replace(/\.md$/, '').toLowerCase().replace(/\s+/g, '-');
  const fm = [
    '---',
    `title: "${meta.title}"`,
    meta.subtitle ? `subtitle: "${meta.subtitle}"` : null,
    `date: ${date}`,
    'draft: false',
    meta.rawFrontmatter.author ? `author: "${meta.rawFrontmatter.author}"` : null,
    `category: "${meta.contentClass}"`,
    `slug: "${slug}"`,
    meta.rawFrontmatter.description ? `description: "${meta.rawFrontmatter.description}"` : null,
    '---',
  ].filter(Boolean).join('\n');
  return fm + '\n\n' + body;
}

export async function dispatchToCephas(
  meta: ContentFileMeta,
  body: string,
  onProgress: (msg: string) => void,
): Promise<DispatchResult> {
  const platform = 'cephas' as const;
  try {
    const section = contentClassToSection(meta.contentClass);
    const sectionDir = join(CEPHAS_CONTENT, section);
    if (!existsSync(sectionDir)) mkdirSync(sectionDir, { recursive: true });

    const slug = meta.slug ?? meta.fileName.replace(/\.md$/, '').toLowerCase().replace(/\s+/g, '-');
    const outPath = join(sectionDir, `${slug}.md`);
    const md = buildCephásMarkdown(meta, body);
    writeFileSync(outPath, md, 'utf8');
    onProgress('Cephas: content file written');

    onProgress('Cephas: running hugo --minify…');
    await execAsync('hugo --minify', { cwd: CEPHAS_HUGO, timeout: 120_000 });
    onProgress('Cephas: hugo build complete');

    onProgress('Cephas: deploying to Firebase…');
    await execAsync('firebase deploy --only hosting:cephas', { cwd: CEPHAS_HUGO, timeout: 300_000 });
    onProgress('Cephas: deployed ✓');

    const url = `https://cephas.lianabanyan.com/${section}/${slug}/`;
    return { platform, status: 'success', url };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    onProgress(`Cephas: ERROR — ${msg}`);
    return { platform, status: 'failed', error: msg };
  }
}
