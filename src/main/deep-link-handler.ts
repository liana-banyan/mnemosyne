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

export interface DeepLinkPayload {
  type: 'accept-invite';
  slug: string;
  token: string;
}

export type DeepLinkHandler = (payload: DeepLinkPayload) => void;

// ─── Protocol name ────────────────────────────────────────────────────────────

const PROTOCOL = 'mnemosyne';

// ─── URL parser ───────────────────────────────────────────────────────────────

export function parseDeepLink(url: string): DeepLinkPayload | null {
  try {
    const parsed = new URL(url);
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
  // Register as default protocol client (idempotent)
  if (!app.isDefaultProtocolClient(PROTOCOL)) {
    const registered = app.setAsDefaultProtocolClient(PROTOCOL);
    if (!registered) {
      console.warn('[deep-link] Failed to register mnemosyne:// protocol client');
    } else {
      console.log('[deep-link] Registered mnemosyne:// protocol');
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
    const url = argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
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
  const url = argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
  if (url) {
    handleDeepLink(url, mainWindow, handler);
  }
}
