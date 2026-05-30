// Mnemosyne — Deep-Link Handler
// SAGA 10 BP045 W1 — mnemosyne:// protocol registration + accept-token handling
//
// Protocol: mnemosyne://accept/{slug}/{accept_token}
// Registered via app.setAsDefaultProtocolClient in index.ts
//
// Flow:
//   1. OS passes deep-link URL to Electron via second-instance or open-url event
//   2. We parse the URL and route to the appropriate handler
//   3. For accept links: validate token, trigger federation accept flow

import { app } from 'electron';
import type { BrowserWindow } from 'electron';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeepLinkAcceptInvite {
  type: 'accept-invite';
  slug: string;
  token: string;
}

export interface DeepLinkAuthCallback {
  type: 'auth-callback';
  access_token: string;
  refresh_token: string;
}

export type DeepLinkPayload = DeepLinkAcceptInvite | DeepLinkAuthCallback;

export type DeepLinkHandler = (payload: DeepLinkPayload) => void;

// ─── Protocol name ────────────────────────────────────────────────────────────

const PROTOCOL = 'mnemosyne';
// BP065: mnemo:// protocol for LB auth callback
const PROTOCOL_MNEMO = 'mnemo';

// ─── URL parser ───────────────────────────────────────────────────────────────

export function parseDeepLink(url: string): DeepLinkPayload | null {
  try {
    const parsed = new URL(url);

    // BP065: mnemo://auth/callback#access_token=...&refresh_token=...
    // Supabase appends tokens as hash fragments; Windows argv may deliver them as query params
    if (parsed.protocol === `${PROTOCOL_MNEMO}:`) {
      const host = parsed.hostname;
      if (host === 'auth') {
        // Try hash first (Supabase default), then query params (fallback)
        const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ''));
        const accessToken =
          parsed.searchParams.get('access_token') ||
          hashParams.get('access_token');
        const refreshToken =
          parsed.searchParams.get('refresh_token') ||
          hashParams.get('refresh_token');
        if (accessToken && refreshToken) {
          return { type: 'auth-callback', access_token: accessToken, refresh_token: refreshToken };
        }
        // Partial — log and ignore rather than returning a broken payload
        console.warn('[deep-link] mnemo://auth/callback received but tokens missing in URL');
        return null;
      }
      return null;
    }

    if (parsed.protocol !== `${PROTOCOL}:`) return null;

    const host = parsed.hostname; // 'accept'
    const parts = parsed.pathname.split('/').filter(Boolean);
    // mnemosyne://accept/{slug}/{token}
    // → hostname='accept', pathname='/{slug}/{token}'

    if (host === 'accept' && parts.length >= 2) {
      const [slug, token] = parts;
      if (!slug || !token) return null;
      return { type: 'accept-invite', slug, token };
    }

    return null;
  } catch {
    return null;
  }
}

// ─── Registration ─────────────────────────────────────────────────────────────
// Call this AFTER app.whenReady() — see index.ts

export function registerDeepLinkProtocol(
  mainWindow: (() => BrowserWindow | null),
  handler?: DeepLinkHandler,
): void {
  // Register mnemosyne:// as default protocol client (idempotent)
  if (!app.isDefaultProtocolClient(PROTOCOL)) {
    const registered = app.setAsDefaultProtocolClient(PROTOCOL);
    if (!registered) {
      console.warn('[deep-link] Failed to register mnemosyne:// protocol client');
    } else {
      console.log('[deep-link] Registered mnemosyne:// protocol');
    }
  }

  // BP065: also register mnemo:// for LB auth callback
  if (!app.isDefaultProtocolClient(PROTOCOL_MNEMO)) {
    const registeredMnemo = app.setAsDefaultProtocolClient(PROTOCOL_MNEMO);
    if (!registeredMnemo) {
      console.warn('[deep-link] Failed to register mnemo:// protocol client');
    } else {
      console.log('[deep-link] Registered mnemo:// protocol (LB auth)');
    }
  }

  // macOS / Linux: open-url event fires when app is already running
  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url, mainWindow, handler);
  });

  // Windows: second-instance event passes argv; URL is in args
  app.on('second-instance', (_event, argv) => {
    // On Windows, the deep-link URL is the last argv item
    const url = argv.find((arg) =>
      arg.startsWith(`${PROTOCOL}://`) || arg.startsWith(`${PROTOCOL_MNEMO}://`)
    );
    if (url) {
      handleDeepLink(url, mainWindow, handler);
    }

    // Focus the existing window
    const win = mainWindow();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

// ─── Handler ──────────────────────────────────────────────────────────────────

function handleDeepLink(
  url: string,
  mainWindow: () => BrowserWindow | null,
  handler?: DeepLinkHandler,
): void {
  console.log('[deep-link] Received:', url);

  const payload = parseDeepLink(url);
  if (!payload) {
    console.warn('[deep-link] Unrecognized URL format:', url);
    return;
  }

  // Notify custom handler if registered (e.g., FederationClient)
  handler?.(payload);

  // Also send to renderer via webContents
  const win = mainWindow();
  if (win?.webContents) {
    win.webContents.send('deep-link-received', payload);
  }
}

// ─── Startup URL ──────────────────────────────────────────────────────────────
// On Windows, if the app was cold-started via a deep-link, the URL is in argv.
// Call this once after mainWindow is ready to handle any startup link.

export function handleStartupDeepLink(
  argv: string[],
  mainWindow: () => BrowserWindow | null,
  handler?: DeepLinkHandler,
): void {
  const url = argv.find((arg) =>
    arg.startsWith(`${PROTOCOL}://`) || arg.startsWith(`${PROTOCOL_MNEMO}://`)
  );
  if (url) {
    handleDeepLink(url, mainWindow, handler);
  }
}
