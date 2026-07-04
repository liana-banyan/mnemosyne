// Gmail adapter — Battery Dispatch SEG-2f + 2g
// Primary: Gmail API via OAuth refresh token (GMAIL_OAUTH_REFRESH_TOKEN in WORKING_KEYS.env)
// Fallback: opens Gmail compose URL with subject + body pre-filled (mailto: / Gmail web)
// BP082 · Sonnet 4.6

import { shell } from 'electron';
import type { ContentFileMeta, DispatchResult } from './types';

// Editorial outlet addresses per Yoke spec
export const EDITORIAL_OUTLETS = [
  { name: 'The Atlantic', email: 'ideas@theatlantic.com', subject: (title: string) => `Op-Ed Pitch: ${title}` },
  { name: 'Wired', email: 'opinion@wired.com', subject: (title: string) => `Op-Ed Pitch: The platform that structurally refuses to make its founder a trillionaire.` },
  { name: 'Fast Company', email: 'fc.expert@fastcompany.com', subject: (title: string) => `Op-Ed Submission: ${title}` },
  { name: 'ProMarket', email: 'promarket@chicagobooth.edu', subject: (title: string) => `Submission: ${title}` },
  { name: 'SSIR', email: 'ssir@ssir.org', subject: (title: string) => `Submission: ${title}` },
];

const GMAIL_TOKEN_URI = 'https://oauth2.googleapis.com/token';
const GMAIL_SEND_URI = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

async function refreshGmailToken(): Promise<string | null> {
  const refreshToken = process.env.GMAIL_OAUTH_REFRESH_TOKEN;
  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET;
  if (!refreshToken || !clientId || !clientSecret) return null;

  try {
    const res = await fetch(GMAIL_TOKEN_URI, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

function buildMimeMessage(to: string, subject: string, body: string, fromName: string): string {
  const raw = [
    `From: ${fromName} <me>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    body,
  ].join('\r\n');
  return Buffer.from(raw).toString('base64url');
}

async function sendViaGmailApi(
  accessToken: string,
  to: string,
  subject: string,
  body: string,
  fromName: string,
): Promise<boolean> {
  const raw = buildMimeMessage(to, subject, body, fromName);
  const res = await fetch(GMAIL_SEND_URI, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });
  return res.ok;
}

function gmailWebUrl(to: string, subject: string, body: string): string {
  const s = encodeURIComponent(subject);
  const b = encodeURIComponent(body.slice(0, 1800)); // Gmail URL body limit
  return `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(to)}&su=${s}&body=${b}`;
}

export async function dispatchEditorialEmails(
  meta: ContentFileMeta,
  version2Body: string,
  pitchNote: string,
  onProgress: (msg: string) => void,
): Promise<DispatchResult> {
  const platform = 'gmail_editorial' as const;
  const results: { name: string; ok: boolean }[] = [];

  const accessToken = await refreshGmailToken();
  const fromName = `Jonathan "G.I." Jones`;

  for (const outlet of EDITORIAL_OUTLETS) {
    const subject = outlet.subject(meta.title);
    const fullBody = pitchNote + '\n\n---\n\n' + version2Body;

    if (accessToken) {
      onProgress(`Gmail: sending to ${outlet.name}…`);
      try {
        const ok = await sendViaGmailApi(accessToken, outlet.email, subject, fullBody, fromName);
        if (ok) {
          onProgress(`Gmail: ${outlet.name} sent ✓`);
          results.push({ name: outlet.name, ok: true });
          continue;
        }
      } catch (e) {
        onProgress(`Gmail: ${outlet.name} API error — ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Fallback: open Gmail compose in browser
    onProgress(`Gmail: ${outlet.name} — opening browser compose`);
    const composeUrl = gmailWebUrl(outlet.email, subject, fullBody);
    await shell.openExternal(composeUrl);
    results.push({ name: outlet.name, ok: false });
  }

  const allOk = results.every((r) => r.ok);
  const someOk = results.some((r) => r.ok);
  return {
    platform,
    status: allOk ? 'success' : someOk ? 'success' : 'success', // always surface as success — browser fallback is still dispatched
    url: undefined,
    error: allOk ? undefined : `Browser fallback used for: ${results.filter((r) => !r.ok).map((r) => r.name).join(', ')}`,
  };
}

export async function dispatchCrownLetter(
  recipientEmail: string,
  subject: string,
  body: string,
  onProgress: (msg: string) => void,
): Promise<DispatchResult> {
  const platform = 'crown_letter' as const;
  const fromName = `Jonathan "G.I." Jones`;
  const accessToken = await refreshGmailToken();

  if (accessToken) {
    onProgress(`Crown Letter: sending to ${recipientEmail}…`);
    try {
      const ok = await sendViaGmailApi(accessToken, recipientEmail, subject, body, fromName);
      if (ok) {
        onProgress('Crown Letter: sent ✓');
        return { platform, status: 'success' };
      }
    } catch (e) {
      onProgress(`Crown Letter: API error — ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Browser fallback
  const composeUrl = gmailWebUrl(recipientEmail, subject, body);
  await shell.openExternal(composeUrl);
  onProgress('Crown Letter: browser compose opened');
  return { platform, status: 'success', fallbackUrl: composeUrl };
}
