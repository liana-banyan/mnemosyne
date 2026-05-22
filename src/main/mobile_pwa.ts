// MoneyPenny Mobile PWA — Mnemosyne CAI Amplifier
// B37 Phase 5 — Self-contained mobile chat interface served from port 11480
//
// All assets generated as strings (no separate build step, no file I/O).
// Served by SubstrateAPIServer routes: /mobile /manifest.json /sw.js /icon.svg

// ─── Icon SVG ─────────────────────────────────────────────────────────────────

export function getIconSVG(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f172a"/>
      <stop offset="100%" style="stop-color:#1e293b"/>
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f59e0b"/>
      <stop offset="100%" style="stop-color:#fbbf24"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <rect x="8" y="8" width="496" height="496" rx="90" fill="none" stroke="url(#gold)" stroke-width="8"/>
  <!-- M letterform -->
  <text x="256" y="340" text-anchor="middle"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="280" font-weight="900"
    fill="url(#gold)">M</text>
  <!-- Subtitle -->
  <text x="256" y="430" text-anchor="middle"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="42" font-weight="400" letter-spacing="6"
    fill="rgba(255,255,255,0.45)">MNEMOSYNE</text>
</svg>`;
}

// ─── PWA Manifest ─────────────────────────────────────────────────────────────

export function getManifestJSON(): string {
  return JSON.stringify(
    {
      name: 'MoneyPenny',
      short_name: 'MoneyPenny',
      description: 'Mnemosyne — Memory, powered by CAI · cooperative substrate interface',
      display: 'standalone',
      orientation: 'portrait-primary',
      start_url: '/mobile',
      scope: '/',
      theme_color: '#1a1a2e',
      background_color: '#0f172a',
      icons: [
        {
          src: '/icon.svg',
          sizes: '192x192',
          type: 'image/svg+xml',
          purpose: 'any',
        },
        {
          src: '/icon.svg',
          sizes: '512x512',
          type: 'image/svg+xml',
          purpose: 'any maskable',
        },
      ],
      categories: ['productivity', 'utilities'],
    },
    null,
    2,
  );
}

// ─── Service Worker ───────────────────────────────────────────────────────────

export function getServiceWorker(): string {
  return `// MoneyPenny Service Worker — B37 Phase 5
// Bump CACHE_NAME when /mobile shell changes; BP029 network-first /mobile prevents stale Pixel bundles (v3: Yoke SSE Phase B).
const CACHE_NAME = 'moneypenny-v5-bp047-mobile';
const SHELL_URLS = ['/mobile', '/manifest.json', '/icon.svg'];

// Install: cache shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)),
  );
  self.skipWaiting();
});

// Activate: prune old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

// Fetch: network-first for API calls, cache-first for shell
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API + Yoke + Family: network-first, no caching (Pixel must never get a cached POST/GET mixup)
  if (
    url.pathname.startsWith('/substrate/') ||
    url.pathname.startsWith('/amplify/') ||
    url.pathname.startsWith('/federation/') ||
    url.pathname.startsWith('/yoke/') ||
    url.pathname.startsWith('/family/') ||
    url.pathname === '/mode' ||
    url.pathname === '/health'
  ) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: 'offline', hit: false }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    return;
  }

  // /mobile shell: network-first then refresh cache (fixes stale PWA after deploys)
  if (url.pathname === '/mobile') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // Other shell assets: cache-first
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request)),
  );
});
`;
}

// ─── Mobile HTML Shell ────────────────────────────────────────────────────────

export function getMobileHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"/>
  <meta name="theme-color" content="#1a1a2e"/>
  <meta name="apple-mobile-web-app-capable" content="yes"/>
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
  <meta name="apple-mobile-web-app-title" content="MoneyPenny"/>
  <link rel="manifest" href="/manifest.json"/>
  <link rel="apple-touch-icon" href="/icon.svg"/>
  <title>MoneyPenny</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg:        #0f172a;
      --surface:   #1e293b;
      --surface2:  #273449;
      --gold:      #f59e0b;
      --gold-dim:  rgba(245,158,11,0.15);
      --green:     #22c55e;
      --blue:      #3b82f6;
      --text:      #e2e8f0;
      --text-muted: rgba(255,255,255,0.45);
      --border:    rgba(255,255,255,0.08);
      --radius:    14px;
      --safe-bottom: env(safe-area-inset-bottom, 0px);
      --safe-top:    env(safe-area-inset-top, 0px);
    }
    html, body {
      height: 100%;
      background: var(--bg);
      color: var(--text);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 15px;
      -webkit-font-smoothing: antialiased;
      overscroll-behavior: none;
    }
    #app {
      display: flex;
      flex-direction: column;
      height: 100dvh;
      max-width: 640px;
      margin: 0 auto;
    }

    /* ── Header ─────────────────────────────────────────────────── */
    #header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 18px;
      padding-top: calc(12px + var(--safe-top));
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
      gap: 10px;
    }
    #header-left { display: flex; align-items: center; gap: 10px; }
    #header-icon {
      width: 36px; height: 36px; border-radius: 9px;
      background: var(--gold-dim);
      border: 1px solid rgba(245,158,11,0.3);
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; flex-shrink: 0;
    }
    #header-title { font-size: 17px; font-weight: 700; color: var(--text); }
    #header-sub   { font-size: 11px; color: var(--text-muted); margin-top: 1px; }
    #header-right {
      display: flex; flex-direction: column; align-items: flex-end; gap: 5px;
      min-width: 118px;
    }
    #header-right-row { display: flex; align-items: center; gap: 6px; }
    #strain-label { font-size: 10px; color: var(--text-muted); white-space: nowrap; }
    #conn-pill {
      font-size: 10px; padding: 3px 8px; border-radius: 20px;
      border: 1px solid rgba(255,255,255,0.12);
      white-space: nowrap; font-weight: 700; letter-spacing: 0.2px;
    }
    #conn-pill.conn-live { color: var(--green); background: rgba(34,197,94,0.12); border-color: rgba(34,197,94,0.28); }
    #conn-pill.conn-local { color: #f59e0b; background: rgba(245,158,11,0.12); border-color: rgba(245,158,11,0.28); }
    #conn-pill.conn-failed { color: #ef4444; background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.28); }
    #mode-badge {
      font-size: 10px; padding: 2px 7px; border-radius: 20px;
      background: var(--gold-dim); color: var(--gold);
      border: 1px solid rgba(245,158,11,0.25);
      white-space: nowrap;
    }
    #mode-badge.compact { font-size: 9px; padding: 1px 6px; }

    /* ── BP047: Collapsible stats card ───────────────────────────── */
    #stats-card {
      margin: 10px 14px 4px;
      padding: 11px 12px;
      background: linear-gradient(135deg, rgba(245,158,11,0.10), rgba(30,41,59,0.92));
      border: 1px solid rgba(245,158,11,0.22);
      border-radius: 16px;
      flex-shrink: 0;
    }
    #stats-card.collapsed .stats-grid { display: none; }
    #stats-card.collapsed { padding: 8px 12px; }
    #stats-toggle {
      width: 100%;
      display: flex; align-items: center; justify-content: space-between;
      background: transparent; border: 0; color: var(--text);
      font: inherit; cursor: pointer; touch-action: manipulation;
    }
    #stats-title { font-size: 12px; font-weight: 800; color: var(--gold); letter-spacing: 0.2px; }
    #stats-chevron { color: var(--text-muted); font-size: 14px; }
    .stats-grid {
      display: grid; grid-template-columns: minmax(0, 1fr) auto;
      gap: 7px 14px; margin-top: 10px; font-size: 12px;
    }
    .stats-grid .label { color: var(--text-muted); }
    .stats-grid .value { color: var(--text); font-weight: 700; text-align: right; }
    .sippin-dual { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
    .sippin-panel {
      padding: 8px 10px; border-radius: 10px;
      background: rgba(15,23,42,0.55); border: 1px solid rgba(245,158,11,0.18);
    }
    .sippin-panel .panel-hd {
      font-size: 10px; font-weight: 700; color: var(--gold);
      margin-bottom: 4px; display: flex; align-items: center; gap: 4px;
    }
    .sippin-panel .panel-val { font-size: 14px; font-weight: 800; color: var(--text); }
    .sippin-panel .panel-cap { font-size: 9px; color: var(--text-muted); margin-top: 3px; line-height: 1.4; }
    .sippin-hint { color: var(--gold); text-decoration: none; font-weight: 700; }

    /* ── Bushel 43: Character avatar bar ─────────────────────────── */
    #character-bar {
      display: flex; gap: 10px; padding: 10px 16px 4px;
      flex-shrink: 0;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }
    #character-bar::-webkit-scrollbar { display: none; }
    .char-avatar {
      flex: 0 0 auto;
      display: flex; align-items: center; gap: 8px;
      min-width: 108px;
      padding: 8px 12px; border-radius: 14px;
      background: var(--surface); color: var(--text-muted);
      border: 1.5px solid var(--border);
      font-family: inherit; font-size: 14px; cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      transition: background 0.15s, border-color 0.2s, color 0.2s;
      user-select: none;
      touch-action: manipulation;
    }
    .char-avatar:active { transform: scale(0.97); }
    .char-avatar.active {
      background: var(--gold-dim);
      border-color: rgba(245,158,11,0.5);
      color: var(--gold);
      box-shadow: 0 0 0 2px rgba(245,158,11,0.15);
    }
    .char-avatar .char-icon {
      width: 24px; height: 24px; border-radius: 7px;
      background: rgba(255,255,255,0.06);
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 13px; flex-shrink: 0;
    }
    .char-avatar.active .char-icon {
      background: var(--gold);
      color: #000;
    }
    .char-avatar .char-name { font-weight: 600; }
    /* Bushel 44: family member online/offline status indicator */
    .char-avatar .char-status {
      width: 7px; height: 7px; border-radius: 50%;
      background: #6b7280; margin-left: 2px;
      transition: background 0.3s;
    }
    .char-avatar .char-status.online { background: var(--green); }
    .char-avatar.family-member { /* slight visual differentiation from MoneyPenny/Bishop */
      border-style: dashed;
      border-color: rgba(255,255,255,0.18);
    }
    .char-avatar.family-member.active {
      border-style: solid;
      border-color: rgba(245,158,11,0.5);
    }

    /* ── Quick buttons ───────────────────────────────────────────── */
    #quick-bar {
      display: flex; gap: 8px; padding: 10px 16px 6px;
      flex-wrap: wrap; overflow: visible; flex-shrink: 0;
      position: relative;
      z-index: 2;
      touch-action: manipulation;
    }
    #quick-bar::-webkit-scrollbar { display: none; }
    .qbtn {
      flex-shrink: 0;
      padding: 7px 14px; border-radius: 20px;
      background: var(--surface); color: var(--text);
      border: 1px solid var(--border);
      font-size: 13px; cursor: pointer;
      white-space: nowrap;
      -webkit-tap-highlight-color: transparent;
      transition: background 0.15s, border-color 0.15s;
      user-select: none;
      touch-action: manipulation;
    }
    .qbtn:active { background: var(--surface2); border-color: rgba(255,255,255,0.2); }
    .qbtn.gold { background: var(--gold-dim); border-color: rgba(245,158,11,0.3); color: var(--gold); }
    #quick-toggle {
      display: none; margin: 8px 16px 4px; align-self: flex-start;
      padding: 7px 12px; border-radius: 18px;
      background: var(--gold-dim); color: var(--gold);
      border: 1px solid rgba(245,158,11,0.3);
      font: inherit; font-size: 13px; cursor: pointer;
      touch-action: manipulation;
    }
    #quick-bar.collapsed { display: none; }
    #quick-toggle.visible { display: block; }
    .inline-actions {
      display: flex; flex-wrap: wrap; gap: 7px; margin-top: 8px;
    }
    .inline-action {
      padding: 6px 10px; border-radius: 16px;
      background: var(--gold-dim); color: var(--gold);
      border: 1px solid rgba(245,158,11,0.35);
      font: inherit; font-size: 12px; cursor: pointer;
      touch-action: manipulation;
    }
    .inline-action.secondary {
      background: rgba(255,255,255,0.05);
      color: var(--text);
      border-color: var(--border);
    }
    .msg.system-card {
      align-self: stretch;
      max-width: 100%;
      background: rgba(30,41,59,0.82);
      border: 1px solid var(--border);
      color: var(--text);
      text-align: left;
      font-size: 13px;
      padding: 10px 12px;
    }
    .msg.system-card .close-msg {
      float: right;
      margin-left: 8px;
      border: 0;
      background: transparent;
      color: var(--text-muted);
      font-size: 18px;
      line-height: 1;
      cursor: pointer;
    }

    /* ── Message thread ──────────────────────────────────────────── */
    #thread {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      padding: 12px 14px 96px;
      display: flex; flex-direction: column; gap: 10px;
      scroll-behavior: smooth;
      -webkit-overflow-scrolling: touch;
      position: relative;
      z-index: 1;
    }
    .msg {
      max-width: 86%; border-radius: var(--radius);
      padding: 10px 13px; font-size: 14px; line-height: 1.5;
      animation: msgIn 0.2s ease-out;
      word-break: break-word;
    }
    @keyframes msgIn {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .msg.user {
      align-self: flex-end;
      background: var(--blue);
      color: #fff;
      border-bottom-right-radius: 4px;
    }
    .msg.assistant {
      align-self: flex-start;
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
      border-bottom-left-radius: 4px;
    }
    .msg.system {
      align-self: center;
      background: transparent;
      color: var(--text-muted);
      font-size: 12px;
      text-align: center;
      padding: 4px 0;
    }
    .msg.error {
      align-self: flex-start;
      background: rgba(239,68,68,0.1);
      border: 1px solid rgba(239,68,68,0.25);
      color: #fca5a5;
      font-size: 13px;
    }
    .msg-meta {
      font-size: 10px; color: var(--text-muted); margin-top: 4px;
      display: flex; align-items: center; gap: 6px;
    }
    .routing-badge {
      padding: 1px 6px; border-radius: 10px; font-size: 9px;
      font-weight: 600; letter-spacing: 0.3px;
    }
    .routing-badge.substrate_hit { background: rgba(34,197,94,0.15); color: #4ade80; }
    .routing-badge.local_ollama  { background: rgba(245,158,11,0.15); color: #fbbf24; }
    .routing-badge.cloud_escalation { background: rgba(99,102,241,0.15); color: #a5b4fc; }
    .routing-badge.miss { background: rgba(107,114,128,0.15); color: #9ca3af; }
    .routing-badge.peer_sync { background: rgba(59,130,246,0.15); color: #93c5fd; }

    /* Typing indicator */
    .typing { align-self: flex-start; }
    .typing-dots {
      display: flex; gap: 4px; padding: 12px 16px;
      background: var(--surface); border-radius: var(--radius);
      border-bottom-left-radius: 4px;
      border: 1px solid var(--border);
    }
    .typing-dots span {
      width: 7px; height: 7px; border-radius: 50%;
      background: var(--text-muted);
      animation: dot 1.2s infinite;
    }
    .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
    .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes dot {
      0%,60%,100% { opacity: 0.3; transform: scale(0.8); }
      30%          { opacity: 1;   transform: scale(1); }
    }

    /* ── Input bar ───────────────────────────────────────────────── */
    #input-area {
      display: flex; gap: 10px; padding: 10px 14px;
      padding-bottom: calc(10px + var(--safe-bottom));
      background: var(--surface);
      border-top: 1px solid var(--border);
      flex-shrink: 0;
      align-items: flex-end;
      position: relative;
      z-index: 2;
      touch-action: manipulation;
    }
    #input {
      flex: 1; min-height: 42px; max-height: 120px;
      padding: 10px 14px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 22px;
      color: var(--text);
      font-size: 15px;
      font-family: inherit;
      resize: none;
      outline: none;
      line-height: 1.4;
      overflow-y: auto;
      transition: border-color 0.2s;
      -webkit-appearance: none;
    }
    #input:focus { border-color: rgba(245,158,11,0.4); }
    #input::placeholder { color: var(--text-muted); }
    #send-btn {
      min-width: 72px; height: 44px; border-radius: 999px;
      padding: 0 16px;
      background: var(--gold); color: #000; border: none;
      display: flex; align-items: center; justify-content: center;
      gap: 7px; font-size: 14px; font-weight: 800; cursor: pointer; flex-shrink: 0;
      -webkit-tap-highlight-color: transparent;
      transition: transform 0.1s, opacity 0.2s;
      touch-action: manipulation;
    }
    #send-btn:active { transform: scale(0.92); }
    #send-btn:disabled { opacity: 0.4; cursor: default; }
    #send-btn.thinking::before {
      content: '';
      width: 12px; height: 12px; border-radius: 50%;
      border: 2px solid rgba(0,0,0,0.22);
      border-top-color: #000;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    /* Bushel 46: attachment button + preview */
    #attach-btn {
      width: 38px; height: 38px; border-radius: 50%;
      background: var(--surface2); color: var(--gold);
      border: 1px solid var(--border);
      display: flex; align-items: center; justify-content: center;
      font-size: 17px; cursor: pointer; flex-shrink: 0;
      -webkit-tap-highlight-color: transparent;
      transition: transform 0.1s;
    }
    #attach-btn:active { transform: scale(0.92); }
    #attach-btn:disabled { opacity: 0.4; cursor: default; }
    #attach-preview {
      display: none; padding: 6px 14px;
      background: var(--surface);
      border-top: 1px solid var(--border);
      flex-shrink: 0;
      gap: 8px; flex-wrap: wrap;
    }
    #attach-preview.visible { display: flex; }
    .attach-chip {
      display: flex; align-items: center; gap: 6px;
      padding: 4px 10px; border-radius: 12px;
      background: var(--gold-dim); color: var(--gold);
      border: 1px solid rgba(245,158,11,0.3);
      font-size: 12px;
    }
    .attach-chip .remove { cursor: pointer; opacity: 0.7; margin-left: 4px; }
    .attach-chip .remove:hover { opacity: 1; }
    .msg img.attachment {
      max-width: 100%; max-height: 320px; border-radius: 8px;
      margin-top: 6px; display: block;
    }
    .msg audio.attachment {
      margin-top: 6px; max-width: 100%;
    }

    /* ── Savings strip ───────────────────────────────────────────── */
    #savings-strip {
      display: none;
      padding: 7px 16px;
      background: rgba(34,197,94,0.07);
      border-bottom: 1px solid rgba(34,197,94,0.12);
      font-size: 11px; color: rgba(34,197,94,0.75);
      text-align: center; flex-shrink: 0;
    }
    #savings-strip.visible { display: block; }
    #savings-strip .money-precision {
      cursor: help;
      text-decoration: underline dotted rgba(34,197,94,0.55);
      text-underline-offset: 3px;
    }
    #state-strip {
      padding: 7px 14px calc(8px + var(--safe-bottom));
      background: var(--surface);
      border-top: 1px solid var(--border);
      font-size: 11px;
      color: var(--text-muted);
      flex-shrink: 0;
    }
    #state-strip .state-line { display: flex; align-items: center; gap: 6px; }
    #state-strip .state-line + .state-line { margin-top: 3px; }
    #state-dot { color: var(--green); font-weight: 900; }
    #state-strip.state-thinking #state-dot { color: #f59e0b; animation: pulse 1s infinite; }
    #state-strip.state-waiting #state-dot { color: rgba(255,255,255,0.45); }
    #state-strip.state-local #state-dot { color: #f59e0b; }
    #state-strip.state-failed #state-dot { color: #ef4444; }
    @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
  </style>
</head>
<body>
<div id="app">
  <!-- Header -->
  <div id="header">
    <div id="header-left">
      <div id="header-icon">M</div>
      <div>
        <div id="header-title">MoneyPenny</div>
        <div id="header-sub">Mnemosyne CAI Amplifier</div>
      </div>
    </div>
    <div id="header-right">
      <div id="header-right-row">
        <span id="mode-badge" class="compact">—</span>
        <span id="conn-pill" class="conn-local">◌ LOCAL</span>
      </div>
      <div id="strain-label">v0.1.5 · Substrate: LOCAL</div>
    </div>
  </div>

  <!-- BP047: Stats card -->
  <div id="stats-card">
    <button id="stats-toggle" type="button" aria-expanded="true">
      <span id="stats-title">Mnemosyne stats</span>
      <span id="stats-chevron">▼</span>
    </button>
    <div class="sippin-dual">
      <div class="sippin-panel">
        <div class="panel-hd">Tech-nerd view · subscription throttle avoided
          <a class="sippin-hint" href="https://cephas.lianabanyan.org/economics/sippin-ethereal-t" title="Sippin' Ethereal T · Honest-Alpha estimate">?</a>
        </div>
        <div class="panel-val" id="stat-sub-throttle">~$—</div>
        <div class="panel-cap">ESTIMATED · extra Ultra-class accounts not needed this month</div>
      </div>
      <div class="sippin-panel">
        <div class="panel-hd">Normal-user view · pepperoni-slice avoided
          <a class="sippin-hint" href="https://cephas.lianabanyan.org/economics/sippin-ethereal-t" title="Per-call nickel-and-dime pattern">?</a>
        </div>
        <div class="panel-val" id="stat-pepperoni">~$—</div>
        <div class="panel-cap">ESTIMATED · ChatGPT-Plus-style per-call stack vs Mnemosyne substrate</div>
      </div>
    </div>
    <div class="stats-grid">
      <span class="label">Direct cloud API (measured)</span><span class="value" id="stat-cost">$3.5064</span>
      <span class="label">Queries served this month</span><span class="value" id="stat-queries">22,775</span>
      <span class="label">Substrate strain</span><span class="value" id="stat-strain">v0.1.5 NOVACULA</span>
      <span class="label">Last successful query</span><span class="value" id="stat-last-query">--</span>
      <span class="label">Pioneer rank</span><span class="value" id="stat-pioneer">--</span>
    </div>
  </div>

  <!-- Savings strip -->
  <div id="savings-strip"></div>

  <!-- Bushel 43+44: Character-avatar recipient selector with dynamic family roster -->
  <div id="character-bar">
    <button class="char-avatar active" data-recipient="moneypenny" title="Talk to MoneyPenny (substrate query)">
      <span class="char-icon">M</span><span class="char-name">MoneyPenny</span>
    </button>
    <button class="char-avatar" data-recipient="bishop" title="Note Bishop (writes to Yoke; Bishop reads + replies)">
      <span class="char-icon">B</span><span class="char-name">Bishop</span>
      <span class="char-status" id="status-bishop"></span>
    </button>
    <button class="char-avatar" data-recipient="knight" title="Note Knight (Yoke → Cursor / Knight lane)">
      <span class="char-icon">K</span><span class="char-name">Knight</span>
    </button>
    <button class="char-avatar" data-recipient="pawn" title="Note Pawn (Yoke → compliance lane)">
      <span class="char-icon">P</span><span class="char-name">Pawn</span>
    </button>
    <button class="char-avatar" data-recipient="rook" title="Note Rook (Yoke → patents lane)">
      <span class="char-icon">R</span><span class="char-name">Rook</span>
    </button>
    <!-- Dynamic family member avatars injected by loadFamilyRoster() -->
  </div>

  <!-- Quick buttons -->
  <div id="quick-bar">
    <button class="qbtn gold" data-action="brief">Brief me on today's work</button>
    <button class="qbtn" data-action="gadget-vs-seg">Compare Gadget vs SEG for this repo</button>
    <button class="qbtn" data-action="substrate">Check Mnemosyne substrate status</button>
    <button class="qbtn" data-action="dispatch-pawn">Dispatch Pawn for BP046 audit</button>
    <button class="qbtn" data-action="gauntlet">Run the Gauntlet</button>
    <button class="qbtn" data-action="pioneer-marks">Show my Pioneer Marks</button>
  </div>
  <button id="quick-toggle" type="button">+ Quick Actions</button>

  <!-- Message thread -->
  <div id="thread"></div>

  <!-- Input bar -->
  <div id="input-area">
    <!-- Bushel 46: attachment picker (file input hidden; label triggers it) -->
    <input type="file" id="attach-input" accept="image/*,audio/*" style="display:none" multiple />
    <button id="attach-btn" title="Attach image or audio (Family Table only)">📎</button>
    <textarea id="input" rows="1" placeholder="Brief me on today's work..."></textarea>
    <button id="send-btn" disabled><span id="send-label">Send</span></button>
  </div>
  <div id="state-strip" class="state-idle">
    <div class="state-line"><span id="state-dot">●</span><span id="state-main">Substrate: LOCAL · Last query: --</span></div>
    <div class="state-line">Agent: MONEYPENNY · Mode: CAI Amplifier</div>
  </div>
  <div id="attach-preview"></div>
</div>

<script>
  'use strict';

  /** AbortSignal.timeout polyfill (older Android WebView / Chrome). */
  function fetchSignal(ms) {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      return AbortSignal.timeout(ms);
    }
    var c = new AbortController();
    setTimeout(function () { c.abort(); }, ms);
    return c.signal;
  }

  // ── State ────────────────────────────────────────────────────────
  const BASE = window.location.origin;
  let busy = false;
  let online = false;
  let currentMode = '—';
  let lastQueryText = '';
  let lastSuccessfulQueryAt = '';
  const STRAIN_VERSION = window.__STRAIN_VERSION__ || 'v0.1.7';
  const STRAIN_DISPLAY = STRAIN_VERSION + ' NOVACULA';
  // Bushel 43: character-avatar recipient selector replaces single-shot noteMode
  // Sticky selection — stays on chosen recipient until user taps another avatar
  let currentRecipient = 'moneypenny';

  // ── DOM ──────────────────────────────────────────────────────────
  const thread   = document.getElementById('thread');
  const input    = document.getElementById('input');
  const sendBtn  = document.getElementById('send-btn');
  const sendLabel = document.getElementById('send-label');
  const modeBadge = document.getElementById('mode-badge');
  const connPill = document.getElementById('conn-pill');
  const strainLabel = document.getElementById('strain-label');
  const savingsStrip = document.getElementById('savings-strip');
  const statsCard = document.getElementById('stats-card');
  const statsToggle = document.getElementById('stats-toggle');
  const statsChevron = document.getElementById('stats-chevron');
  const statCost = document.getElementById('stat-cost');
  const statQueries = document.getElementById('stat-queries');
  const statStrain = document.getElementById('stat-strain');
  const statLastQuery = document.getElementById('stat-last-query');
  const statPioneer = document.getElementById('stat-pioneer');
  const statSubThrottle = document.getElementById('stat-sub-throttle');
  const statPepperoni = document.getElementById('stat-pepperoni');
  const quickBar = document.getElementById('quick-bar');
  const quickToggle = document.getElementById('quick-toggle');
  const stateStrip = document.getElementById('state-strip');
  const stateMain = document.getElementById('state-main');

  // ── Connectivity check ───────────────────────────────────────────
  async function checkHealth() {
    try {
      const r = await fetch(BASE + '/mode', { signal: fetchSignal(3000) });
      const d = await r.json();
      online = true;
      const modeEmoji = { ai_burst: '🔥', normal: '🌿', fallback: '🌑' };
      currentMode = d.mode || 'normal';
      modeBadge.textContent = (modeEmoji[currentMode] || '') + ' ' + (currentMode.replace('_', ' '));
      setConnectionState('live');
    } catch {
      online = false;
      modeBadge.textContent = 'Offline';
      setConnectionState('failed');
    }
  }

  function setConnectionState(state, detail) {
    if (!connPill || !strainLabel) return;
    connPill.className = '';
    if (state === 'live') {
      connPill.classList.add('conn-live');
      connPill.textContent = '● LIVE';
      strainLabel.textContent = STRAIN_VERSION + ' · Substrate: CONNECTED';
      updateStateStrip('idle');
    } else if (state === 'failed') {
      connPill.classList.add('conn-failed');
      connPill.textContent = '✕ FAILED';
      strainLabel.textContent = STRAIN_VERSION + ' · Last success: ' + (lastSuccessfulQueryAt || '--');
      updateStateStrip('failed', detail || 'connection failed');
    } else {
      connPill.classList.add('conn-local');
      connPill.textContent = '◌ LOCAL';
      strainLabel.textContent = STRAIN_VERSION + ' · Substrate: LOCAL';
      updateStateStrip('local');
    }
  }

  function updateStateStrip(state, detail) {
    if (!stateStrip || !stateMain) return;
    stateStrip.className = 'state-' + state;
    if (state === 'thinking') {
      stateMain.textContent = 'Substrate: THINKING · Last query: ' + (lastSuccessfulQueryAt || '--');
    } else if (state === 'waiting') {
      stateMain.textContent = 'Routing to federation substrate...';
    } else if (state === 'local') {
      stateMain.textContent = 'Offline vault · no remote queries';
    } else if (state === 'failed') {
      stateMain.innerHTML = '✕ ' + escHtml(detail || 'failed') + ' · ' + new Date().toLocaleTimeString() + ' · <button class="inline-action secondary" data-inline-action="retry-last" type="button">Retry</button>';
    } else {
      stateMain.textContent = 'Substrate: ' + (online ? 'CONNECTED' : 'LOCAL') + ' · Last query: ' + (lastSuccessfulQueryAt || '--');
    }
  }

  // ── Savings strip ─────────────────────────────────────────────────
  const moneyFmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const moneyPrecisionFmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  const intFmt = new Intl.NumberFormat('en-US');
  const MONEY_PRECISION_TITLE = 'Sub-cent precision tracking — queries cost fractions of a cent each. The 4-decimal value is the exact substrate tally; rounded display shows normal cents.';

  function formatMoney(value, precision) {
    return '$' + (precision ? moneyPrecisionFmt : moneyFmt).format(Number(value) || 0);
  }

  function moneySpan(value, precision) {
    return '<span class="money-precision" title="' + escHtml(MONEY_PRECISION_TITLE) + '">' +
      formatMoney(value, precision) +
      '</span>';
  }

  async function loadSavings() {
    try {
      const r = await fetch(BASE + '/amplify/summary', { signal: fetchSignal(4000) });
      const d = await r.json();
      const s = d.month || d.session || {};
      const cost = s.cloud_cost_avoided_usd || 0;
      const q = s.total_queries || 0;
      updateStatsCard(cost, q, d.pioneer_rank || d.pioneerRank || '--');
      try {
        localStorage.setItem('mp_last_stats', JSON.stringify({ cost, q, pioneer: d.pioneer_rank || d.pioneerRank || '--' }));
      } catch {}
      if (q > 0) {
        savingsStrip.innerHTML =
          'This month: ' + moneySpan(cost, true) + ' cloud cost avoided · ' + intFmt.format(q) + ' queries';
        savingsStrip.classList.add('visible');
      }
    } catch {
      try {
        const cached = JSON.parse(localStorage.getItem('mp_last_stats') || '{}');
        if (cached && (cached.q || cached.cost)) updateStatsCard(cached.cost || 3.5064, cached.q || 22775, cached.pioneer || '--');
      } catch {}
    }
  }

  function computeSippinViews(queries, directCost) {
    const q = Number(queries) || 0;
    const direct = Number(directCost) || 0;
    const peakPerAccount = 5000;
    const accountsRequired = q > 0 ? Math.ceil(q / peakPerAccount) : 0;
    const subAvoided = Math.max(0, accountsRequired - 1) * 216;
    const subLow = Math.max(0, accountsRequired - 2) * 216;
    const subHigh = accountsRequired * 216;
    const casualPerQuery = 0.04;
    const normalEst = q * casualPerQuery;
    const pepperoni = Math.max(0, normalEst - direct);
    return { subAvoided, subLow, subHigh, pepperoni, normalEst, accountsRequired };
  }

  function updateStatsCard(cost, queries, pioneerRank) {
    const q = queries || 0;
    const c = cost ?? 0;
    const sippin = computeSippinViews(q, c);
    if (statCost && cost !== null && cost !== undefined) statCost.textContent = formatMoney(c, true);
    if (statQueries && queries !== null && queries !== undefined) statQueries.textContent = intFmt.format(q);
    if (statSubThrottle) {
      const band = sippin.subLow !== sippin.subHigh
        ? '~$' + moneyFmt.format(sippin.subLow) + '–' + moneyFmt.format(sippin.subHigh)
        : '~$' + moneyFmt.format(sippin.subAvoided);
      statSubThrottle.textContent = band + '/mo';
    }
    if (statPepperoni) {
      statPepperoni.textContent = '~$' + moneyFmt.format(sippin.pepperoni);
    }
    if (statStrain) statStrain.textContent = STRAIN_DISPLAY;
    if (statLastQuery) statLastQuery.textContent = lastSuccessfulQueryAt || '--';
    if (statPioneer) statPioneer.textContent = pioneerRank || '--';
  }

  // ── Message helpers ───────────────────────────────────────────────
  function addMsg(type, html, meta) {
    const div = document.createElement('div');
    div.className = 'msg ' + type;
    div.innerHTML = html;
    if (meta) {
      const m = document.createElement('div');
      m.className = 'msg-meta';
      m.innerHTML = meta;
      div.appendChild(m);
    }
    thread.appendChild(div);
    requestAnimationFrame(() => {
      thread.scrollTop = thread.scrollHeight;
      const last = thread.lastElementChild;
      if (last) last.scrollIntoView({ block: 'end', behavior: 'smooth' });
    });
    return div;
  }

  function addSystemCard(html, actions) {
    const actionHtml = (actions || []).map(function (a) {
      return '<button class="inline-action' + (a.secondary ? ' secondary' : '') + '" data-inline-action="' + escHtml(a.action) + '" data-insert="' + escHtml(a.insert || '') + '" type="button">' + escHtml(a.label) + '</button>';
    }).join('');
    return addMsg(
      'system-card',
      '<button class="close-msg" type="button" aria-label="Dismiss">×</button>' + html +
      (actionHtml ? '<div class="inline-actions">' + actionHtml + '</div>' : ''),
    );
  }

  function showTyping() {
    const div = document.createElement('div');
    div.className = 'typing';
    div.id = 'typing-indicator';
    div.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
    thread.appendChild(div);
    requestAnimationFrame(() => {
      thread.scrollTop = thread.scrollHeight;
      const last = thread.lastElementChild;
      if (last) last.scrollIntoView({ block: 'end', behavior: 'smooth' });
    });
  }

  function removeTyping() {
    const t = document.getElementById('typing-indicator');
    if (t) t.remove();
  }

  function routingBadge(r) {
    const labels = {
      substrate_hit: 'Substrate',
      local_ollama: 'Ollama',
      cloud_escalation: 'Cloud',
      peer_sync: 'Peer',
      miss: 'Miss',
    };
    return '<span class="routing-badge ' + r + '">' + (labels[r] || r) + '</span>';
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\\n/g, '<br>');
  }

  // Bushel 47 #17: lightweight markdown — **bold**, *italic*, code (backtick-quoted), line breaks
  function renderMarkdown(s) {
    let out = escHtml(s);
    const BT = String.fromCharCode(96); // backtick — avoid raw char that would terminate outer TS template literal
    // Triple-backtick code blocks first (multi-line)
    out = out.replace(new RegExp(BT+BT+BT+'([\\s\\S]*?)'+BT+BT+BT, 'g'), '<pre style="background:rgba(255,255,255,0.05);padding:8px;border-radius:6px;overflow-x:auto;font-size:12px">$1</pre>');
    // Inline code
    out = out.replace(new RegExp(BT+'([^'+BT+']+?)'+BT, 'g'), '<code style="background:rgba(255,255,255,0.08);padding:2px 5px;border-radius:3px;font-size:13px">$1</code>');
    // Bold **x**
    out = out.replace(/\*\*([^*\\n]+?)\*\*/g, '<strong>$1</strong>');
    // Italic *x*
    out = out.replace(/\*([^*\\n]+?)\*/g, '<em>$1</em>');
    // Line breaks (newline becomes br)
    out = out.replace(/\\n/g, '<br>');
    return out;
  }

  // Bushel 47 #2: relative timestamps
  function relativeTime(isoTs) {
    if (!isoTs) return '';
    const then = new Date(isoTs).getTime();
    const now = Date.now();
    const diff = now - then;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    if (diff < 86400000 * 7) return Math.floor(diff / 86400000) + 'd ago';
    return new Date(isoTs).toLocaleDateString();
  }

  // Bushel 47 #19: draft persistence — save unsent input on every keystroke
  const DRAFT_KEY = 'moneypenny_mail_draft_v1';
  function saveDraft() {
    if (!input) return;
    try { localStorage.setItem(DRAFT_KEY, input.value || ''); } catch {}
  }
  function loadDraft() {
    if (!input || !sendBtn) return;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        input.value = saved;
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        sendBtn.disabled = !saved.trim();
      }
    } catch {}
  }
  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
  }

  const QUICK_QUERIES = {
    brief: "Brief me on today's work",
    'gadget-vs-seg': 'Compare Gadget vs SEG for this repo',
    substrate: 'Check Mnemosyne substrate status',
    'dispatch-pawn': 'Dispatch Pawn for BP046 audit',
    gauntlet: 'Run the Gauntlet',
    'pioneer-marks': 'Show my Pioneer Marks',
  };

  function insertPrompt(text) {
    if (!input || !text) return;
    input.value = text;
    input.focus();
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    if (sendBtn) sendBtn.disabled = !input.value.trim() || busy;
    saveDraft();
  }

  function collapseQuickActions() {
    if (!quickBar || !quickToggle) return;
    quickBar.classList.add('collapsed');
    quickToggle.classList.add('visible');
    sessionStorage.setItem('mp_quick_collapsed_session', 'true');
  }

  function expandQuickActions() {
    if (!quickBar || !quickToggle) return;
    quickBar.classList.remove('collapsed');
    quickToggle.classList.remove('visible');
  }

  function setSendThinking(isThinking) {
    if (!sendBtn || !sendLabel) return;
    sendBtn.classList.toggle('thinking', Boolean(isThinking));
    sendLabel.textContent = isThinking ? 'Thinking…' : 'Send';
  }

  const PLACEHOLDERS = [
    "Brief me on today's work...",
    'What did I finish in BP046B?',
    'Check substrate status...',
    'Dispatch a Pawn...',
    'Run the Gauntlet...',
  ];
  let placeholderIdx = 0;
  let placeholderTimer = null;
  function startPlaceholderCycle() {
    if (!input || input.value || document.activeElement === input || placeholderTimer) return;
    placeholderTimer = setInterval(function () {
      if (!input || input.value || document.activeElement === input) return;
      placeholderIdx = (placeholderIdx + 1) % PLACEHOLDERS.length;
      input.placeholder = PLACEHOLDERS[placeholderIdx];
    }, 4000);
  }
  function stopPlaceholderCycle() {
    if (placeholderTimer) clearInterval(placeholderTimer);
    placeholderTimer = null;
  }

  async function handlePawnQuery(text) {
    if (busy) return;
    busy = true;
    if (sendBtn) sendBtn.disabled = true;
    setSendThinking(true);
    updateStateStrip('waiting');
    addMsg('user', renderMarkdown(text));
    const thinkId = 'think-' + Date.now();
    addMsg('assistant', '<em id="' + thinkId + '">Pawn is thinking...</em>');

    try {
      const r = await fetch(BASE + '/yoke/pawn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(60000),
      });
      const d = await r.json();
      document.getElementById(thinkId)?.parentElement?.remove();
      if (d.success) {
        addMsg('assistant', '🦅 <strong>Pawn:</strong><br>' + renderMarkdown(d.reply));
      } else {
        addMsg('assistant', '⚠️ Pawn error: ' + escHtml(d.error || 'unknown'));
      }
    } catch (e) {
      document.getElementById(thinkId)?.parentElement?.remove();
      addMsg('assistant', '⚠️ Pawn unreachable: ' + escHtml(e.message));
    } finally {
      busy = false;
      setSendThinking(false);
      updateStateStrip('idle');
      if (sendBtn && input) sendBtn.disabled = !input.value.trim();
    }
  }

  async function handleRookQuery(text) {
    if (busy) return;
    busy = true;
    if (sendBtn) sendBtn.disabled = true;
    setSendThinking(true);
    updateStateStrip('waiting');
    addMsg('user', renderMarkdown(text));
    const thinkId = 'think-' + Date.now();
    addMsg('assistant', '<em id="' + thinkId + '">Rook is thinking...</em>');

    try {
      const r = await fetch(BASE + '/yoke/rook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(90000),
      });
      const d = await r.json();
      document.getElementById(thinkId)?.parentElement?.remove();
      if (d.success) {
        addMsg('assistant', '♜ <strong>Rook:</strong><br>' + renderMarkdown(d.reply));
      } else {
        addMsg('assistant', '⚠️ Rook error: ' + escHtml(d.error || 'unknown'));
      }
    } catch (e) {
      document.getElementById(thinkId)?.parentElement?.remove();
      addMsg('assistant', '⚠️ Rook unreachable: ' + escHtml(e.message));
    } finally {
      busy = false;
      setSendThinking(false);
      updateStateStrip('idle');
      if (sendBtn && input) sendBtn.disabled = !input.value.trim();
    }
  }

  async function sendQuery(text, opts) {

    if (busy || !text.trim()) return;
    busy = true;
    lastQueryText = text;
    if (sendBtn) sendBtn.disabled = true;
    setSendThinking(true);
    updateStateStrip('thinking');

    addMsg('user', renderMarkdown(text));
    showTyping();

    try {
      const r = await fetch(BASE + '/substrate/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text }),
        signal: fetchSignal(30000),
      });
      const d = await r.json();
      removeTyping();
      lastSuccessfulQueryAt = new Date().toLocaleTimeString();
      updateStatsCard(null, null, null);
      updateStateStrip('idle');
      setConnectionState('live');

      if (d.hit && d.record) {
        const excerpt = d.record.text
          ? d.record.text.slice(0, 600) + (d.record.text.length > 600 ? '…' : '')
          : '(no text)';
        addMsg(
          'assistant',
          escHtml(excerpt),
          routingBadge(d.routing) +
          '<span>' + (d.latency_ms || 0) + 'ms</span>' +
          (d.score ? '<span>score: ' + d.score.toFixed(1) + '</span>' : ''),
        );
      } else if (d.routing === 'cloud_escalation') {
        addMsg(
          'assistant',
          '☁️ Not in substrate — routing to cloud API. No local record available.',
          routingBadge('cloud_escalation'),
        );
      } else if (d.routing === 'peer_sync') {
        addMsg(
          'assistant',
          '🌑 Fallback mode — querying peer substrate. ' + (d.peer_sync_exchanged ? d.peer_sync_exchanged + ' records exchanged.' : 'No local match found.'),
          routingBadge('peer_sync'),
        );
      } else {
        addMsg(
          'assistant',
          '❌ No substrate hit for this query. Escalate to cloud or add to substrate.',
          routingBadge(d.routing || 'miss'),
        );
      }
      if (!opts || !opts.suppressFirstMarks) maybeShowFiveMarks();
    } catch (e) {
      removeTyping();
      setConnectionState(online ? 'failed' : 'local', e.message || 'timeout');
      if ((e.name === 'AbortError') || String(e.message || '').toLowerCase().includes('abort')) {
        showTimeoutAsk();
      }
      if (!online) {
        addMsg('error', '📵 Offline — is Mnemosyne running on this network?');
      } else {
        addMsg('error', 'Query failed: ' + e.message);
      }
    } finally {
      busy = false;
      setSendThinking(false);
      if (sendBtn && input) sendBtn.disabled = !input.value.trim();
    }
  }

  function showTimeoutAsk() {
    addSystemCard(
      'MoneyPenny is taking longer than expected.',
      [
        { label: 'Retry', action: 'retry-last' },
        { label: 'Cancel', action: 'dismiss', secondary: true },
        { label: 'Check substrate status', action: 'insert', insert: 'Check substrate status' },
      ],
    );
  }

  function showIdentityBlock() {
    if (localStorage.getItem('mp_identity_shown')) {
      addMsg('system-card', 'MoneyPenny · CAI front-desk · Mnemosyne Amplifier');
      return;
    }
    addSystemCard(
      "I'm MoneyPenny — your CAI front-desk for Mnemosyne Amplifier.<br>" +
      'I route agents, report substrate health, run benchmarks, dispatch Pawns, and summarize your work. I know what you\\'ve already done. I\\'ll start from where you left off.<br><br>' +
      '<em>I believe enough for both of us.</em>',
    );
    localStorage.setItem('mp_identity_shown', 'true');
  }

  function shouldAskBatteryDispatch() {
    const asked = localStorage.getItem('mp_battery_dispatch_asked');
    const laterAt = Number(localStorage.getItem('mp_battery_dispatch_later_at') || 0);
    if (!asked) return true;
    return localStorage.getItem('mp_battery_dispatch') === 'later' && Date.now() - laterAt > 7 * 24 * 60 * 60 * 1000;
  }

  function showBatteryDispatchAsk(onboardingMode) {
    if (!shouldAskBatteryDispatch()) return;
    addSystemCard(
      (onboardingMode ? 'One optional feature: Battery Dispatch.<br>' : 'MoneyPenny can run background dispatches when you\\'re away.<br>') +
      'I can run background dispatches when you\\'re away — local substrate only, no cloud calls without your explicit queue.',
      [
        { label: 'Enable Battery Dispatch', action: 'battery-enable' },
        { label: 'Ask me later', action: 'battery-later', secondary: true },
        { label: "Never — I'll dispatch manually", action: 'battery-never', secondary: true },
      ],
    );
  }

  function maybeShowFiveMarks(force) {
    if (!force && localStorage.getItem('mp_5marks_shown')) return;
    addSystemCard(
      "Welcome to the cooperative. You've earned 5 Marks for your first Mnemosyne session. You are now in the Pioneer Registry.",
      [
        { label: 'See my Marks', action: 'marks-see' },
        { label: 'Dismiss', action: 'marks-dismiss', secondary: true },
      ],
    );
  }

  function showOnboardingM1() {
    addSystemCard(
      "Hi. I'm MoneyPenny — your CAI front-desk for Mnemosyne Amplifier.<br>" +
      'I route agents, report substrate health, run benchmarks, dispatch Pawns, and summarize your work.<br><br>' +
      'Where would you like to start?',
      [
        { label: 'What is Mnemosyne?', action: 'onboard-m2a', insert: 'What is Mnemosyne?' },
        { label: 'Run a quick benchmark', action: 'onboard-m2b', insert: 'Run a quick benchmark' },
        { label: 'Show my substrate status', action: 'onboard-m2c', insert: 'Show my substrate status' },
      ],
    );
  }

  function getOnboardingBranch(text) {
    const t = String(text || '').trim().toLowerCase();
    if (t === 'what is mnemosyne?') return 'a';
    if (t === 'run a quick benchmark') return 'b';
    if (t === 'show my substrate status') return 'c';
    return null;
  }

  function showOnboardingM2(branch) {
    if (branch === 'a') {
      addSystemCard(
        'Mnemosyne is a cooperative memory substrate — local, yours, indexed. When you query me, I check Mnemosyne first before touching any cloud model.<br><br>' +
        '90-98% fewer data-center round-trips per query. Your data stays local. Your cooperative keeps the margin.<br><br>' +
        "Mnemosyne isn't a product to use. It's a belief made visible.<br>Mnemosyne is an active, daily act of defiance.",
      );
    } else if (branch === 'b') {
      addSystemCard(
        'The Gauntlet is our benchmark framework — 6 stages from baseline to cross-Cathedral federation.<br><br>' +
        'Stage 2 is the proof: with no AI model running at all — CPU-only — Mnemosyne retrieved canonical Eblets at 0.059ms mean. Zero tokens. Zero cloud cost.<br><br>' +
        "Type 'Run the Gauntlet' to start Stage 1.",
      );
    } else {
      addSystemCard(
        'Checking substrate now. I\\'ll report:<br>' +
        '- Connection state (LIVE / LOCAL / FAILED)<br>' +
        '- Last successful query timestamp<br>' +
        '- Queries served this month<br>' +
        '- Cloud cost avoided<br><br>' +
        (online ? 'Substrate is LIVE.' : 'Substrate is LOCAL or offline right now. The rest of onboarding still works.'),
      );
    }
    setTimeout(function () {
      if (!busy && !input.value.trim()) showOnboardingM3();
    }, 2000);
  }

  function showOnboardingM3() {
    addSystemCard(
      "One more thing about how this works: I don't invent anything. I retrieve from what your cooperative has already built.<br><br>" +
      'The substrate is the intelligence. The model is the voice.<br><br>' +
      "Mnemosyne isn't a product to use. It's a belief made visible.<br>" +
      'Mnemosyne is an active, daily act of defiance.<br><br>' +
      'Those two lines go together. They are always the last words before the action ask.',
    );
    setTimeout(function () {
      if (shouldAskBatteryDispatch()) showBatteryDispatchAsk(true);
      if (!localStorage.getItem('mp_5marks_shown')) maybeShowFiveMarks(true);
    }, 1200);
  }

  function completeOnboarding() {
    localStorage.setItem('mp_onboarding_complete', 'true');
  }

  // ── Bushel 43+53-A: Character-avatar recipient selector ───────────────
  // Each avatar routes Send:
  //   moneypenny -> POST /substrate/query
  //   bishop | knight -> POST /yoke/note (file bridge)
  //   pawn -> POST /yoke/pawn (Perplexity sonar-reasoning-pro — Bushel 58)
  //   rook -> POST /yoke/rook (Gemini 2.5 Pro — Bushel 58 Phase C)
  //   family:* -> POST /yoke/note (Family Table scope)
  function setRecipient(name, displayName) {
    currentRecipient = name;
    document.querySelectorAll('.char-avatar').forEach((el) => {
      if (el.getAttribute('data-recipient') === name) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });
    if (!input || !sendBtn) return;
    if (name === 'bishop') {
      input.placeholder = 'Note to Bishop…';
      if (sendLabel) sendLabel.textContent = 'Send';
      sendBtn.title = 'Send note to Bishop (Yoke channel)';
    } else if (name === 'knight') {
      input.placeholder = 'Note to Knight…';
      if (sendLabel) sendLabel.textContent = 'Send';
      sendBtn.title = 'Send note to Knight (Yoke)';
    } else if (name === 'pawn') {
      input.placeholder = 'Message to Pawn…';
      if (sendLabel) sendLabel.textContent = 'Send';
      sendBtn.title = 'Send to Pawn (Perplexity)';
    } else if (name === 'rook') {
      input.placeholder = 'Message to Rook…';
      if (sendLabel) sendLabel.textContent = 'Send';
      sendBtn.title = 'Send to Rook (Gemini)';
    } else if (name && name.indexOf('family:') === 0) {
      // Bushel 44+45+46: Family member recipient (Family Table scope)
      const dn = displayName || 'family member';
      input.placeholder = 'Note to ' + dn + ' (Family Table)…';
      if (sendLabel) sendLabel.textContent = 'Send';
      sendBtn.title = 'Send to ' + dn + ' (Family Table scope)';
    } else {
      input.placeholder = PLACEHOLDERS[placeholderIdx];
      if (sendLabel) sendLabel.textContent = 'Send';
      sendBtn.title = 'Send query to substrate';
    }
    refreshAttachButton();
  }

  async function handleSendNote(text) {
    if (busy) return;
    busy = true;
    setSendThinking(true);
    updateStateStrip('waiting');
    // Bushel 45: determine scope + recipient_id from currentRecipient
    let scope = 'just-recipient';
    let recipientId = null;
    let recipientName = null;
    let recipientLabel = 'Bishop';
    if (currentRecipient === 'knight') {
      recipientId = 'knight';
      recipientName = 'Knight';
      recipientLabel = 'Knight';
    } else if (currentRecipient && currentRecipient.indexOf('family:') === 0) {
      scope = 'family-table';
      recipientId = currentRecipient.slice(7); // strip "family:" prefix
      // Pull recipient name from the active char-avatar's data attribute
      const activeBtn = document.querySelector('.char-avatar.active');
      if (activeBtn) {
        recipientName = activeBtn.getAttribute('data-member-name');
        recipientLabel = recipientName || recipientId.slice(0, 8);
      }
    }
    addMsg('user', '📝 → ' + escHtml(recipientLabel) + ':<br>' + renderMarkdown(text));
    showTyping();
    try {
      const attachmentIds = pendingAttachments.map((a) => a.attachment_id);
      const r = await fetch(BASE + '/yoke/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: text,
          urgency: 'normal',
          scope,
          recipient_id: recipientId,
          recipient_name: recipientName,
          attachment_ids: attachmentIds,
        }),
        signal: fetchSignal(8000),
      });
      const d = await r.json();
      removeTyping();
      if (d.success) {
        const shortId = String(d.msg_id || '').slice(0, 8);
        const tsShort = String(d.ts || '').replace('T', ' ').slice(0, 16);
        const scopeLabel = scope === 'family-table' ? ' (Family Table)' : '';
        const attachLabel = attachmentIds.length > 0 ? ' · ' + attachmentIds.length + ' attachment' + (attachmentIds.length > 1 ? 's' : '') : '';
        addMsg(
          'system',
          '📨 Sent to ' + escHtml(recipientLabel) + scopeLabel + attachLabel + ' · ' + tsShort + ' · ' + shortId,
        );
        // Bushel 46: clear pending attachments after successful send
        pendingAttachments = [];
        renderAttachPreview();
      } else {
        addMsg('error', 'Send failed: ' + (d.error || 'unknown error'));
      }
    } catch (e) {
      removeTyping();
      addMsg('error', 'Send failed: ' + e.message);
    } finally {
      busy = false;
      setSendThinking(false);
      updateStateStrip('idle');
      if (sendBtn && input) sendBtn.disabled = !input.value.trim();
    }
    // Bushel 43: sticky recipient — do not auto-revert
  }

  function yokeFileNoteRecipientSelected() {
    return (
      currentRecipient === 'bishop' ||
      currentRecipient === 'knight' ||
      (currentRecipient && currentRecipient.indexOf('family:') === 0)
    );
  }

  // ── Event wiring ──────────────────────────────────────────────────
  try {
    if (statsToggle && statsCard && statsChevron) {
      const collapsed = localStorage.getItem('stats_collapsed') === 'true';
      statsCard.classList.toggle('collapsed', collapsed);
      statsChevron.textContent = collapsed ? '▾' : '▼';
      statsToggle.setAttribute('aria-expanded', String(!collapsed));
      statsToggle.addEventListener('click', () => {
        const next = !statsCard.classList.contains('collapsed');
        statsCard.classList.toggle('collapsed', next);
        statsChevron.textContent = next ? '▾' : '▼';
        statsToggle.setAttribute('aria-expanded', String(!next));
        localStorage.setItem('stats_collapsed', String(next));
      });
    }

    if (quickToggle) {
      quickToggle.addEventListener('click', expandQuickActions);
    }

    document.addEventListener('click', (e) => {
      const close = e.target.closest('.close-msg');
      if (close) {
        close.closest('.msg')?.remove();
        return;
      }
      const actionBtn = e.target.closest('[data-inline-action]');
      if (!actionBtn) return;
      const action = actionBtn.getAttribute('data-inline-action');
      const insert = actionBtn.getAttribute('data-insert') || '';
      if (action === 'insert') {
        insertPrompt(insert);
      } else if (action === 'retry-last') {
        if (lastQueryText) sendQuery(lastQueryText);
      } else if (action === 'dismiss') {
        actionBtn.closest('.msg')?.remove();
      } else if (action === 'battery-enable') {
        localStorage.setItem('mp_battery_dispatch', 'enabled');
        localStorage.setItem('mp_battery_dispatch_asked', 'true');
        actionBtn.closest('.msg')?.remove();
        addMsg('system', 'Battery Dispatch enabled. You can change this in settings.');
      } else if (action === 'battery-later') {
        localStorage.setItem('mp_battery_dispatch', 'later');
        localStorage.setItem('mp_battery_dispatch_asked', 'true');
        localStorage.setItem('mp_battery_dispatch_later_at', String(Date.now()));
        actionBtn.closest('.msg')?.remove();
        addMsg('system', 'Battery Dispatch paused for now. I will ask again later.');
      } else if (action === 'battery-never') {
        localStorage.setItem('mp_battery_dispatch', 'never');
        localStorage.setItem('mp_battery_dispatch_asked', 'true');
        actionBtn.closest('.msg')?.remove();
        addMsg('system', 'Battery Dispatch will stay manual unless you reset it.');
      } else if (action === 'marks-see') {
        localStorage.setItem('mp_5marks_shown', 'true');
        completeOnboarding();
        insertPrompt('Show my Pioneer Marks');
      } else if (action === 'marks-dismiss') {
        localStorage.setItem('mp_5marks_shown', 'true');
        completeOnboarding();
        actionBtn.closest('.msg')?.remove();
      } else if (action === 'onboard-m2a') {
        insertPrompt(insert);
      } else if (action === 'onboard-m2b') {
        insertPrompt(insert);
      } else if (action === 'onboard-m2c') {
        insertPrompt(insert);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      expandQuickActions();
      document.querySelectorAll('.msg.system-card').forEach((el) => {
        const close = el.querySelector('.close-msg');
        if (close) el.remove();
      });
    });

    document.querySelectorAll('.char-avatar').forEach((btn) => {
      btn.addEventListener('click', () => {
        const r = btn.getAttribute('data-recipient');
        if (r) setRecipient(r);
      });
    });

    document.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const a = btn.getAttribute('data-action');
        const q = QUICK_QUERIES[a];
        if (q) {
          insertPrompt(q);
          collapseQuickActions();
        }
      });
    });

    if (input) {
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        if (sendBtn) sendBtn.disabled = !input.value.trim() || busy;
        saveDraft();
      });
      input.addEventListener('focus', stopPlaceholderCycle);
      input.addEventListener('blur', startPlaceholderCycle);

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          doSend();
        }
      });
    }

    if (sendBtn) sendBtn.addEventListener('click', doSend);

    function doSend() {
      if (!input || !sendBtn) return;
      const text = input.value.trim();
      if (!text || busy) return;
      const onboardingBranch = getOnboardingBranch(text);
      if (!localStorage.getItem('mp_onboarding_complete') && !onboardingBranch) {
        sessionStorage.setItem('mp_onboarding_paused', 'true');
      }
      input.value = '';
      input.style.height = 'auto';
      sendBtn.disabled = true;
      clearDraft();
      if (currentRecipient === 'pawn') {
        handlePawnQuery(text);
      } else if (currentRecipient === 'rook') {
        handleRookQuery(text);
      } else if (yokeFileNoteRecipientSelected()) {
        handleSendNote(text);
      } else {
        sendQuery(text, { suppressFirstMarks: Boolean(onboardingBranch) }).then(() => {
          if (onboardingBranch && !localStorage.getItem('mp_onboarding_complete')) {
            showOnboardingM2(onboardingBranch);
          }
        });
      }
    }
  } catch (wireErr) {
    console.error('[MoneyPenny] event wiring failed:', wireErr);
  }

  // ── Service worker registration ────────────────────────────────────
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((reg) => {
      reg.update(); // force fresh asset check on every load (BP030 Phase D)
    }).catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload(); // new SW activated — reload for fresh assets
    });
  }

  // ── Install prompt (Android Chrome) ───────────────────────────────
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Show install hint
    addMsg('system', '📲 Tap ⋮ → Add to Home Screen to install MoneyPenny');
  });

  // ── Init ──────────────────────────────────────────────────────────
  async function init() {
    await checkHealth();
    await loadSavings();
    updateStatsCard(null, null, null);
    startPlaceholderCycle();

    if (online) {
      addMsg('system', '● Connected to Mnemosyne CAI Amplifier');
    } else {
      addMsg('system', '○ Offline — connect to the same WiFi as your Mnemosyne device');
    }

    showIdentityBlock();
    if (!localStorage.getItem('mp_onboarding_complete') && !sessionStorage.getItem('mp_onboarding_paused')) {
      showOnboardingM1();
    } else {
      showBatteryDispatchAsk(false);
    }
  }

  // ── Bushel 46: Attachment picker + upload + preview ────────────────────
  // Family-Table-scope only: attachments restricted to family member recipients.
  // Image/audio limit ~14 MB binary; uploaded as base64 to /family/attachment.

  const attachInput = document.getElementById('attach-input');
  const attachBtn = document.getElementById('attach-btn');
  const attachPreview = document.getElementById('attach-preview');
  let pendingAttachments = []; // [{attachment_id, filename, content_type, url}]

  function isAttachmentAllowed() {
    return currentRecipient && currentRecipient.indexOf('family:') === 0;
  }

  function refreshAttachButton() {
    if (!attachBtn) return;
    attachBtn.disabled = !isAttachmentAllowed();
    attachBtn.title = isAttachmentAllowed()
      ? 'Attach image or audio (Family Table)'
      : 'Attachments only available when sending to a family member';
  }

  function renderAttachPreview() {
    if (!attachPreview) return;
    attachPreview.innerHTML = '';
    if (pendingAttachments.length === 0) {
      attachPreview.classList.remove('visible');
      return;
    }
    attachPreview.classList.add('visible');
    pendingAttachments.forEach((a, idx) => {
      const chip = document.createElement('div');
      chip.className = 'attach-chip';
      const isImg = (a.content_type || '').startsWith('image/');
      const isAud = (a.content_type || '').startsWith('audio/');
      const icon = isImg ? '🖼️' : isAud ? '🎵' : '📎';
      chip.innerHTML = icon + ' ' + escHtml(a.filename) +
        ' <span class="remove" data-idx="' + idx + '">×</span>';
      attachPreview.appendChild(chip);
    });
    attachPreview.querySelectorAll('.remove').forEach((el) => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.getAttribute('data-idx'), 10);
        pendingAttachments.splice(idx, 1);
        renderAttachPreview();
      });
    });
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const idx = result.indexOf(',');
        resolve(idx >= 0 ? result.substring(idx + 1) : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function uploadAttachment(file) {
    const base64 = await fileToBase64(file);
    const r = await fetch(BASE + '/family/attachment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        content_type: file.type || 'application/octet-stream',
        base64_data: base64,
      }),
      signal: fetchSignal(30000),
    });
    return r.json();
  }

  if (attachBtn && attachInput) {
  attachBtn.addEventListener('click', () => {
    if (!isAttachmentAllowed()) {
      addMsg('error', 'Attachments only available when sending to a family member (Family Table scope).');
      return;
    }
    attachInput.click();
  });

  attachInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      try {
        addMsg('system', '📤 Uploading ' + escHtml(file.name) + '…');
        const result = await uploadAttachment(file);
        if (result.success) {
          pendingAttachments.push({
            attachment_id: result.attachment_id,
            filename: file.name,
            content_type: result.content_type,
            url: result.url,
          });
          renderAttachPreview();
        } else {
          addMsg('error', 'Upload failed: ' + (result.error || 'unknown'));
        }
      } catch (err) {
        addMsg('error', 'Upload failed: ' + err.message);
      }
    }
    attachInput.value = ''; // reset for next selection
  });
  }

  refreshAttachButton();

  function renderAttachments(div, attachmentIds) {
    if (!attachmentIds || attachmentIds.length === 0) return;
    for (const id of attachmentIds) {
      const url = BASE + '/family/attachment/' + id;
      // Try image first; if it 404s or non-image, fall back to audio
      const img = document.createElement('img');
      img.className = 'attachment';
      img.src = url;
      img.alt = 'Family Table attachment';
      img.onerror = () => {
        img.remove();
        const audio = document.createElement('audio');
        audio.className = 'attachment';
        audio.controls = true;
        audio.src = url;
        div.appendChild(audio);
      };
      div.appendChild(img);
    }
  }

  // ── Bushel 44: Dynamic family roster — load + render character avatars ────
  // Family members are paired Mnemosyne peers on local network (federation peers).
  // Roster fetched from /family/roster; rendered as additional .char-avatar buttons.

  async function loadFamilyRoster() {
    try {
      const r = await fetch(BASE + '/family/roster', { signal: fetchSignal(3000) });
      const d = await r.json();
      const roster = (d.roster || []);
      const charBar = document.getElementById('character-bar');
      // Remove existing dynamic family avatars (preserve MoneyPenny + Bishop)
      charBar.querySelectorAll('.char-avatar.family-member').forEach((el) => el.remove());
      // Add fresh avatars
      for (const m of roster) {
        const btn = document.createElement('button');
        btn.className = 'char-avatar family-member';
        btn.setAttribute('data-recipient', 'family:' + m.member_id);
        btn.setAttribute('data-member-name', m.name);
        btn.title = 'Note ' + m.name + ' (Family Table)';
        const initial = (m.name || '?').trim().charAt(0).toUpperCase();
        btn.innerHTML =
          '<span class="char-icon">' + escHtml(initial) + '</span>' +
          '<span class="char-name">' + escHtml(m.name) + '</span>' +
          '<span class="char-status' + (m.online ? ' online' : '') + '"></span>';
        btn.addEventListener('click', () => setRecipient('family:' + m.member_id, m.name));
        charBar.appendChild(btn);
      }
    } catch { /* offline or no roster yet */ }
  }

  // ── Bushel 42 + BP029 Phase B: inbox ingest (polling + SSE) ─────────────
  // Tracks msg_ids already rendered so we only show new Bishop replies once.
  const seenReplies = new Set();

  function ingestInboxPayload(d) {
    const replies = (d.replies || []).slice().reverse(); // oldest-first for thread chronology
    for (const reply of replies) {
      if (!reply.msg_id || seenReplies.has(reply.msg_id)) continue;
      if (reply.event === 'read') continue;
      seenReplies.add(reply.msg_id);
      var shortIrt = String(reply.in_reply_to || '').slice(0, 8);
      var ts = reply.ts || '';
      var rel = relativeTime(ts);
      addMsg(
        'assistant',
        '<div style="color:var(--gold);font-weight:600;margin-bottom:4px">' +
        '📬 ' + escHtml(reply.author || 'Bishop') + '’s Reply</div>' +
        renderMarkdown(reply.text || ''),
        'in reply to ' + shortIrt + ' · <span data-relative-ts="' + escHtml(ts) + '">' + rel + '</span>',
      );
      try {
        fetch(BASE + '/yoke/inbox/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ msg_id: reply.msg_id }),
        }).catch(function () {});
      } catch (e) {}
    }
  }

  async function pollInbox() {
    try {
      var r = await fetch(BASE + '/yoke/inbox', { signal: fetchSignal(4000) });
      var d = await r.json();
      ingestInboxPayload(d);
    } catch (e) { /* offline or transient */ }
  }

  var yokeEventSource = null;
  function attachYokeInboxStream() {
    if (typeof EventSource === 'undefined') {
      return false;
    }
    if (yokeEventSource) {
      try { yokeEventSource.close(); } catch (e) {}
      yokeEventSource = null;
    }
    try {
      yokeEventSource = new EventSource(BASE + '/yoke/stream');
      yokeEventSource.addEventListener('inbox', function (ev) {
        try {
          var d = JSON.parse(ev.data);
          ingestInboxPayload(d);
        } catch (e) {}
      });
      yokeEventSource.onerror = function () {
        try { yokeEventSource.close(); } catch (e) {}
        yokeEventSource = null;
        setTimeout(attachYokeInboxStream, 5000);
      };
      return true;
    } catch (e) {
      return false;
    }
  }

  // Poll health every 30s
  setInterval(checkHealth, 30000);
  // Refresh savings every 2min
  setInterval(loadSavings, 120000);
  if (!attachYokeInboxStream()) {
    setInterval(pollInbox, 10000);
  } else {
    // Fallback poll on a longer cadence in case SSE drops silently
    setInterval(pollInbox, 120000);
  }
  setTimeout(pollInbox, 1500);
  // Bushel 44: load family roster on startup + refresh every 30s for online/offline status
  setTimeout(loadFamilyRoster, 800);
  setInterval(loadFamilyRoster, 30000);
  // Bushel 47 #19: restore draft on init (after init delay)
  setTimeout(loadDraft, 600);
  // Bushel 47 #2: refresh relative timestamps every 30s
  setInterval(() => {
    document.querySelectorAll('[data-relative-ts]').forEach((el) => {
      const ts = el.getAttribute('data-relative-ts');
      if (ts) el.textContent = relativeTime(ts);
    });
  }, 30000);

  init().catch(function (e) {
    console.error('[MoneyPenny] init failed:', e);
  });
</script>
</body>
</html>`;
}

// ─── Local IP detection ───────────────────────────────────────────────────────

import { networkInterfaces } from 'os';

export function getLocalIPs(): string[] {
  const ifaces = networkInterfaces();
  const ips: string[] = [];

  for (const iface of Object.values(ifaces)) {
    for (const addr of iface ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) {
        ips.push(addr.address);
      }
    }
  }

  return ips;
}

export function getMoneyPennyURL(port = 11480): string {
  const ips = getLocalIPs();
  const ip = ips[0] ?? '127.0.0.1';
  return `http://${ip}:${port}/mobile`;
}
