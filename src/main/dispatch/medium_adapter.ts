// Medium adapter — Battery Dispatch SEG-2d
// Primary: Medium API (MEDIUM_API_TOKEN from WORKING_KEYS.env)
// Fallback: open Medium editor in browser
// BP082 · Sonnet 4.6

import { shell } from 'electron';
import type { ContentFileMeta, DispatchResult } from './types';

const MEDIUM_API = 'https://api.medium.com/v1';

export async function dispatchToMedium(
  meta: ContentFileMeta,
  body: string,
  onProgress: (msg: string) => void,
): Promise<DispatchResult> {
  const platform = 'medium' as const;
  const token = process.env.MEDIUM_API_TOKEN;

  if (token) {
    onProgress('Medium: fetching user ID…');
    try {
      const meRes = await fetch(`${MEDIUM_API}/me`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (meRes.ok) {
        const me = (await meRes.json()) as { data?: { id: string } };
        const userId = me.data?.id;
        if (userId) {
          onProgress('Medium: creating draft post…');
          const postRes = await fetch(`${MEDIUM_API}/users/${userId}/posts`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: meta.title,
              contentFormat: 'markdown',
              content: `# ${meta.title}\n\n*${meta.subtitle ?? ''}*\n\n${body}`,
              publishStatus: 'draft',
              tags: ['cooperative', 'economics', 'founder'],
            }),
          });
          if (postRes.ok) {
            const post = (await postRes.json()) as { data?: { url: string } };
            const url = post.data?.url ?? 'https://medium.com/new-story';
            onProgress(`Medium: draft created ✓`);
            return { platform, status: 'success', url };
          }
          onProgress(`Medium: API returned ${postRes.status} — falling back to browser`);
        }
      } else {
        onProgress(`Medium: /me returned ${meRes.status} — falling back to browser`);
      }
    } catch (e) {
      onProgress(`Medium: API error — ${e instanceof Error ? e.message : String(e)} — falling back to browser`);
    }
  } else {
    onProgress('Medium: no API token configured — using browser fallback');
  }

  // Browser fallback
  const fallbackUrl = 'https://medium.com/new-story';
  await shell.openExternal(fallbackUrl);
  onProgress('Medium: browser opened — paste title + body + click Publish');
  return { platform, status: 'success', fallbackUrl };
}
