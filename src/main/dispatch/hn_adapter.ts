// HackerNews adapter — Battery Dispatch SEG-2e
// Semi-auto: opens HN submit page with pre-filled URL + title
// Founder clicks Submit in browser; pastes HN URL back to Battery Dispatch
// BP082 · Sonnet 4.6

import { shell } from 'electron';
import type { ContentFileMeta, DispatchResult } from './types';

export async function dispatchToHackerNews(
  meta: ContentFileMeta,
  canonicalUrl: string,
  onProgress: (msg: string) => void,
): Promise<DispatchResult> {
  const platform = 'hackernews' as const;
  try {
    // HN submit URL with pre-filled params
    const hnTitle = encodeURIComponent(`Show HN: ${meta.title}`);
    const hnUrl = encodeURIComponent(canonicalUrl);
    const submitUrl = `https://news.ycombinator.com/submitlink?u=${hnUrl}&t=${hnTitle}`;

    onProgress('HackerNews: opening submit page in browser…');
    await shell.openExternal(submitUrl);
    onProgress('HackerNews: browser opened — click Submit in browser, then paste HN thread URL back');

    // Return the submit URL so the renderer can prompt Founder to paste HN thread URL
    return { platform, status: 'success', fallbackUrl: submitUrl };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    onProgress(`HackerNews: ERROR — ${msg}`);
    return { platform, status: 'failed', error: msg };
  }
}
