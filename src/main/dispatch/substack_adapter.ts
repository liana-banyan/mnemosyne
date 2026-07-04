// Substack adapter — Battery Dispatch SEG-2c
// Primary: Substack API (SUBSTACK_API_KEY from WORKING_KEYS.env)
// Fallback: open Substack editor in browser with pre-filled URL params
// BP082 · Sonnet 4.6

import { shell } from 'electron';
import type { ContentFileMeta, DispatchResult } from './types';

const SUBSTACK_API_BASE = 'https://api.substack.com/api/v1';

export async function dispatchToSubstack(
  meta: ContentFileMeta,
  body: string,
  onProgress: (msg: string) => void,
): Promise<DispatchResult> {
  const platform = 'substack' as const;
  const apiKey = process.env.SUBSTACK_API_KEY;

  if (apiKey) {
    onProgress('Substack: attempting API draft creation…');
    try {
      const res = await fetch(`${SUBSTACK_API_BASE}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          title: meta.title,
          subtitle: meta.subtitle ?? '',
          body_markdown: body,
          type: 'newsletter',
          draft: true, // Save as draft — Founder publishes via Substack admin
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { url?: string; id?: string };
        const url = data.url ?? 'https://substack.com/publish/posts/new';
        onProgress(`Substack: draft created ✓`);
        return { platform, status: 'success', url };
      }
      onProgress(`Substack: API returned ${res.status} — falling back to browser`);
    } catch (e) {
      onProgress(`Substack: API error — ${e instanceof Error ? e.message : String(e)} — falling back to browser`);
    }
  } else {
    onProgress('Substack: no API key configured — using browser fallback');
  }

  // Browser fallback: open Substack new post editor
  const title = encodeURIComponent(meta.title);
  const subtitle = encodeURIComponent(meta.subtitle ?? '');
  const fallbackUrl = `https://substack.com/publish/post/new?title=${title}&subtitle=${subtitle}`;
  await shell.openExternal(fallbackUrl);
  onProgress('Substack: browser opened — paste body + click Publish');
  return { platform, status: 'success', fallbackUrl };
}
