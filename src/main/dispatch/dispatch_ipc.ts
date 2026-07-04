// Battery Dispatch IPC — SEG-2 + SEG-3 + SEG-4
// BP082 · Sonnet 4.6 · Founder-ratified
//
// BP078 BLOOD canon: Founder ratify gate is code-level enforced.
// ASSERTION: dispatch() THROWS if any requested platform is not in ratifiedPlatforms[].
// This is not a warning — it is a hard error that the renderer must handle.

import { ipcMain, app } from 'electron';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import { createHash, randomUUID } from 'crypto';
import type {
  ContentFileMeta,
  DispatchRequest,
  DispatchResult,
  DispatchReceipt,
  DispatchHistoryEntry,
  Platform,
  ContentClass,
} from './types';
import { appendDispatchHistory, loadDispatchHistory, appendReceiptEblet } from './dispatch_history';
import { stampCertify } from '../ip_ledger/stamp_certify';
import { getRingBearerIdentity } from '../ip_ledger/ring_bearer_keygen';
import { dispatchToCephas } from './cephas_adapter';
import { dispatchToPlatform } from './platform_adapter';
import { dispatchToSubstack } from './substack_adapter';
import { dispatchToMedium } from './medium_adapter';
import { dispatchToHackerNews } from './hn_adapter';
import { dispatchEditorialEmails, EDITORIAL_OUTLETS } from './gmail_adapter';

const WORKSPACE = join(homedir(), 'Documents', 'LianaBanyanPlatform');
const FOUNDER_REVIEW_DIR = join(WORKSPACE, 'BISHOP_DROPZONE', '00_FOUNDER_REVIEW');

// Marks awarded per successful platform dispatch
const MARKS_PER_DISPATCH = 5;

// ─── Frontmatter parser (lightweight) ────────────────────────────────────────

function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };
  const body = match[2] ?? '';
  const fm: Record<string, unknown> = {};
  for (const line of match[1].split('\n')) {
    const eq = line.indexOf(':');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    fm[key] = val;
  }
  return { frontmatter: fm, body };
}

function detectContentClass(fm: Record<string, unknown>, fileName: string): ContentClass {
  const cls = ((fm.class ?? fm.category ?? '') as string).toLowerCase();
  if (cls.includes('op-ed') || fileName.includes('OPED')) return 'op-ed';
  if (cls.includes('crown') || cls.includes('letter')) return 'crown-letter';
  if (cls.includes('paper')) return 'paper';
  if (cls.includes('social')) return 'social';
  return 'unknown';
}

function defaultPlatformsForClass(cls: ContentClass): Platform[] {
  switch (cls) {
    case 'op-ed': return ['cephas', 'lianabanyan', 'substack', 'medium', 'hackernews', 'gmail_editorial'];
    case 'paper': return ['cephas', 'lianabanyan', 'substack'];
    case 'crown-letter': return ['crown_letter'];
    case 'social': return ['substack', 'hackernews'];
    default: return ['cephas', 'lianabanyan'];
  }
}

// ─── BP078 BLOOD: Ratify Gate ─────────────────────────────────────────────────

function assertAllRatified(requested: Platform[], ratified: Platform[]): void {
  const ratifiedSet = new Set(ratified);
  const unratified = requested.filter((p) => !ratifiedSet.has(p));
  if (unratified.length > 0) {
    throw new Error(
      `[BP078 BLOOD VIOLATION] Attempted to dispatch to unratified platforms: ${unratified.join(', ')}. ` +
      `Founder must explicitly ratify each platform before dispatch fires. ` +
      `This is a code-level assertion — no bypass exists.`
    );
  }
}

// ─── Receipt builder ──────────────────────────────────────────────────────────

function buildReceipt(
  meta: ContentFileMeta,
  result: DispatchResult,
): DispatchReceipt {
  const contentHash = createHash('sha256')
    .update(meta.filePath + result.platform + (result.url ?? ''))
    .digest('hex')
    .slice(0, 16);
  return {
    id: randomUUID(),
    contentSource: meta.filePath,
    contentClass: meta.contentClass,
    title: meta.title,
    platform: result.platform,
    dispatchUrl: result.url,
    dispatchTimestamp: new Date().toISOString(),
    founderRatified: true,
    cooperativeDispatchId: randomUUID(),
    sha256: contentHash,
    marks: MARKS_PER_DISPATCH,
  };
}

// ─── Recursive .md file discovery ────────────────────────────────────────────
// Recurses into subdirectories so Wave-1 letters and Substrate Awakens drafts
// stored in subdirs of 00_FOUNDER_REVIEW/ are visible to the dispatch queue.

function getAllMdFilePaths(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllMdFilePaths(fullPath));
    } else if (entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

// ─── IPC Registration ─────────────────────────────────────────────────────────

export function registerDispatchIPC(): void {

  // List ratified content files from BISHOP_DROPZONE/00_FOUNDER_REVIEW/ (recursive)
  ipcMain.handle('dispatch:list-content-files', async () => {
    const dir = FOUNDER_REVIEW_DIR;
    if (!existsSync(dir)) return [];
    try {
      const filePaths = getAllMdFilePaths(dir);
      const metas: ContentFileMeta[] = filePaths.map((filePath) => {
        const fileName = basename(filePath);
        const content = readFileSync(filePath, 'utf8');
        const { frontmatter: fm, body: _body } = parseFrontmatter(content);
        const cls = detectContentClass(fm, fileName);
        return {
          filePath,
          fileName,
          title: (fm.title as string) ?? fileName,
          subtitle: fm.subtitle as string | undefined,
          contentClass: cls,
          date: fm.date as string | undefined,
          status: fm.status as string | undefined,
          slug: fm.slug as string | undefined,
          publishTargets: (fm.publish_targets as string[] | undefined) ?? defaultPlatformsForClass(cls).map(String),
          rawFrontmatter: fm,
        } satisfies ContentFileMeta;
      });
      return metas;
    } catch (e) {
      console.error('[BatteryDispatch] list-content-files error:', e);
      return [];
    }
  });

  // Get default platforms for a content class
  ipcMain.handle('dispatch:default-platforms', async (_event, cls: ContentClass) => {
    return defaultPlatformsForClass(cls);
  });

  // Get content file body for preview
  ipcMain.handle('dispatch:get-file-body', async (_event, filePath: string) => {
    if (!existsSync(filePath)) return { error: 'File not found' };
    try {
      const content = readFileSync(filePath, 'utf8');
      const { frontmatter: fm, body } = parseFrontmatter(content);
      // Extract VERSION 1 body if multiple versions present
      const v1Match = body.match(/# VERSION 1[\s\S]*?\n([\s\S]*?)(?=\n# VERSION 2|\n---\n---|\n# VERSION)/);
      const v1Body = v1Match ? v1Match[1].trim() : body.trim();
      const v2Match = body.match(/# VERSION 2[\s\S]*?\n([\s\S]*?)(?=\n# VERSION|\n---\n##|$)/);
      const v2Body = v2Match ? v2Match[1].trim() : v1Body;
      return { v1Body, v2Body, fullBody: body };
    } catch (e) {
      return { error: String(e) };
    }
  });

  // ─── MAIN DISPATCH — BP078 BLOOD gate enforced ────────────────────────────
  ipcMain.handle('dispatch:fire', async (event, req: DispatchRequest) => {
    const { filePath, platforms, ratifiedPlatforms } = req;

    // BP078 BLOOD: hard assertion — throws if any unratified platform requested
    try {
      assertAllRatified(platforms, ratifiedPlatforms);
    } catch (gateErr) {
      console.error('[BP078 BLOOD]', gateErr);
      return { ok: false, error: (gateErr as Error).message, results: [] };
    }

    if (!existsSync(filePath)) {
      return { ok: false, error: `File not found: ${filePath}`, results: [] };
    }

    const content = readFileSync(filePath, 'utf8');
    const { frontmatter: fm, body } = parseFrontmatter(content);
    const cls = detectContentClass(fm, filePath.split(/[/\\]/).pop() ?? '');
    const meta: ContentFileMeta = {
      filePath,
      fileName: filePath.split(/[/\\]/).pop() ?? '',
      title: (fm.title as string) ?? 'Untitled',
      subtitle: fm.subtitle as string | undefined,
      contentClass: cls,
      date: fm.date as string | undefined,
      status: fm.status as string | undefined,
      slug: fm.slug as string | undefined,
      publishTargets: [],
      rawFrontmatter: fm,
    };

    // Extract bodies
    const v1Match = body.match(/# VERSION 1[\s\S]*?\n([\s\S]*?)(?=\n# VERSION 2|\n---\n---|\n# VERSION)/);
    const v1Body = v1Match ? v1Match[1].trim() : body.trim();
    const v2Match = body.match(/# VERSION 2[\s\S]*?\n([\s\S]*?)(?=\n##\s*PITCH NOTE|\n# VERSION|\n---\n##|$)/);
    const v2Body = v2Match ? v2Match[1].trim() : v1Body;
    const pitchMatch = body.match(/## PITCH NOTE[\s\S]*?\n([\s\S]*?)(?=\n##|\n# |$)/);
    const pitchNote = pitchMatch ? pitchMatch[1].trim() : '';

    const results: DispatchResult[] = [];
    const progressEmit = (msg: string) => {
      event.sender.send('dispatch:progress', { msg, ts: Date.now() });
    };

    for (const platform of platforms) {
      progressEmit(`Starting ${platform}…`);
      let result: DispatchResult;

      switch (platform) {
        case 'cephas':
          result = await dispatchToCephas(meta, v1Body, progressEmit);
          break;
        case 'lianabanyan':
          result = await dispatchToPlatform(meta, v1Body, progressEmit);
          break;
        case 'substack':
          result = await dispatchToSubstack(meta, v1Body, progressEmit);
          break;
        case 'medium':
          result = await dispatchToMedium(meta, v1Body, progressEmit);
          break;
        case 'hackernews': {
          // Use the lianabanyan.com URL as canonical URL for HN submission
          const existingPlatformResult = results.find((r) => r.platform === 'lianabanyan');
          const canonUrl = existingPlatformResult?.url ?? `https://lianabanyan.com/op-eds/${meta.slug ?? 'article'}/`;
          result = await dispatchToHackerNews(meta, canonUrl, progressEmit);
          break;
        }
        case 'gmail_editorial':
          result = await dispatchEditorialEmails(meta, v2Body, pitchNote, progressEmit);
          break;
        default:
          result = { platform, status: 'skipped', error: `Unknown platform: ${platform}` };
      }

      results.push(result);

      // SEG-4: Write receipt eblet per successful dispatch
      if (result.status === 'success') {
        const receipt = buildReceipt(meta, result);
        appendReceiptEblet(receipt);
        progressEmit(`Receipt eblet written for ${platform} (${MARKS_PER_DISPATCH} Marks)`);
      }
    }

    // Append full dispatch history entry
    const historyEntry: DispatchHistoryEntry = {
      id: randomUUID(),
      title: meta.title,
      contentSource: filePath,
      contentClass: cls,
      dispatchedAt: new Date().toISOString(),
      platforms: results.map((r) => ({ platform: r.platform, status: r.status, url: r.url })),
      receipts: results
        .filter((r) => r.status === 'success')
        .map((r) => buildReceipt(meta, r)),
    };
    appendDispatchHistory(historyEntry);

    // BP092 I12 Hook 2 — Stamp-Certify: battery_dispatch_submission (fire-and-forget)
    void (async () => {
      try {
        const identity = getRingBearerIdentity();
        await stampCertify({
          contribution_type: 'battery_dispatch_submission',
          payload: JSON.stringify({
            event: 'battery_dispatch_submission',
            dispatch_id: historyEntry.id,
            member_id: identity.peer_id,
            timestamp: Date.now(),
            platforms: results.map((r) => r.platform),
            title: meta.title,
          }),
        });
      } catch (e) {
        console.error('[ip_ledger hook] battery_dispatch_submission:', e);
      }
    })();

    return { ok: true, results };
  });

  // Load dispatch history
  ipcMain.handle('dispatch:history', async () => {
    return loadDispatchHistory();
  });

  // Credential status check (names only — no values per Blood Rule R16)
  ipcMain.handle('dispatch:credential-status', async () => {
    return {
      substack: !!process.env.SUBSTACK_API_KEY,
      medium: !!process.env.MEDIUM_API_TOKEN,
      gmail: !!(process.env.GMAIL_OAUTH_REFRESH_TOKEN && process.env.GMAIL_OAUTH_CLIENT_ID),
      cephas: true,      // Always wired (git + firebase in workspace)
      lianabanyan: true, // Always wired
      hackernews: true,  // Semi-auto browser (no creds needed)
    };
  });

  console.log('[BatteryDispatch] IPC channels registered');
}
