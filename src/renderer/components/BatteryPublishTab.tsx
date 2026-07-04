// BatteryPublishTab — Battery Dispatch v0.3.0 · Publish Fan-Out Engine
// BP082 · 2026-06-14 · Sonnet 4.6 · Founder-ratified
//
// SEG-1: Full publish fan-out UI — content picker, fan-out plan, per-platform
//        preview modals, ratify checkmarks, dispatch button, history view.
// SEG-5: Settings panel — credential status per platform + setup links.
// SEG-6: First-use wizard — conditional on first open.
//
// BP078 BLOOD canon: NOTHING dispatches without Founder ratify checkmark.
// The dispatch button is disabled (and the IPC layer throws) if any selected
// platform is not ratified. Two-layer enforcement: UI + main process.

import React, { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types (mirrors main/dispatch/types.ts — renderer copy) ──────────────────

type ContentClass = 'op-ed' | 'crown-letter' | 'paper' | 'social' | 'unknown';
type Platform = 'cephas' | 'lianabanyan' | 'substack' | 'medium' | 'hackernews' | 'gmail_editorial' | 'crown_letter';
type DispatchStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

interface ContentFileMeta {
  filePath: string;
  fileName: string;
  title: string;
  subtitle?: string;
  contentClass: ContentClass;
  date?: string;
  status?: string;
  slug?: string;
  publishTargets?: string[];
}

interface PlatformRow {
  platform: Platform;
  label: string;
  icon: string;
  description: string;
  enabled: boolean;
  ratified: boolean;
  status: DispatchStatus;
  resultUrl?: string;
  fallbackUrl?: string;
  error?: string;
}

interface DispatchHistoryEntry {
  id: string;
  title: string;
  contentSource: string;
  contentClass: ContentClass;
  dispatchedAt: string;
  platforms: { platform: Platform; status: DispatchStatus; url?: string }[];
}

interface CredentialStatus {
  substack: boolean;
  medium: boolean;
  gmail: boolean;
  cephas: boolean;
  lianabanyan: boolean;
  hackernews: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LS_WIZARD_DONE = 'battery_dispatch_wizard_done';
const LS_ACTIVE_VIEW = 'battery_dispatch_view';

const PLATFORM_META: Record<Platform, { label: string; icon: string; description: string }> = {
  cephas:         { label: 'Cephas (cephas.lianabanyan.com)', icon: '🏛', description: 'Full-auto: writes Hugo content file, builds, deploys via Firebase.' },
  lianabanyan:    { label: 'lianabanyan.com (/op-eds/…)', icon: '🌿', description: 'Full-auto: generates React page, builds, deploys via Firebase.' },
  substack:       { label: 'Substack (For the Keep)', icon: '📬', description: 'API draft (if key set) or browser pre-fill. Founder publishes in Substack admin.' },
  medium:         { label: 'Medium (@gijones)', icon: '📝', description: 'API draft (if token set) or browser pre-fill. Founder publishes in Medium editor.' },
  hackernews:     { label: 'HackerNews (Show HN)', icon: '🔶', description: 'Semi-auto: opens HN submit with pre-filled title + URL. Founder clicks Submit.' },
  gmail_editorial:{ label: 'Editorial emails (Atlantic · Wired · Fast Co · ProMarket · SSIR)', icon: '✉️', description: 'Gmail API (if configured) or browser compose opened per outlet.' },
  crown_letter:   { label: 'Crown Letters (per recipient)', icon: '👑', description: 'Gmail API or browser compose to the Crown recipient.' },
};

function defaultPlatformsForClass(cls: ContentClass): Platform[] {
  switch (cls) {
    case 'op-ed': return ['cephas', 'lianabanyan', 'substack', 'medium', 'hackernews', 'gmail_editorial'];
    case 'paper': return ['cephas', 'lianabanyan', 'substack'];
    case 'crown-letter': return ['crown_letter'];
    case 'social': return ['substack', 'hackernews'];
    default: return ['cephas', 'lianabanyan'];
  }
}

function initialPlatformRows(cls: ContentClass, creds: CredentialStatus): PlatformRow[] {
  const defaults = defaultPlatformsForClass(cls);
  return (Object.keys(PLATFORM_META) as Platform[]).map((p) => ({
    platform: p,
    label: PLATFORM_META[p].label,
    icon: PLATFORM_META[p].icon,
    description: PLATFORM_META[p].description,
    enabled: defaults.includes(p),
    ratified: false,
    status: 'pending',
  }));
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  outer: { height: '100%', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden', background: '#0a0f1a', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' },
  header: { padding: '12px 16px 8px', borderBottom: '1px solid #1e2a38', flexShrink: 0 },
  headerTitle: { fontSize: 15, fontWeight: 700, color: '#f0fdf4', margin: 0 },
  headerSub: { fontSize: 11, color: '#475569', marginTop: 2 },
  tabBar: { display: 'flex', gap: 2, padding: '8px 16px 0', borderBottom: '1px solid #1e2a38', flexShrink: 0 },
  tab: (active: boolean): React.CSSProperties => ({
    fontSize: 11, fontWeight: active ? 700 : 400, color: active ? '#6ee7b7' : '#64748b',
    background: 'none', border: 'none', borderBottom: active ? '2px solid #6ee7b7' : '2px solid transparent',
    padding: '4px 12px 6px', cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
  }),
  scroll: { flex: 1, overflowY: 'auto' as const, padding: '12px 14px' },
  card: { background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(100,116,139,0.15)', borderRadius: 8, padding: '12px 14px', marginBottom: 10 },
  label: { fontSize: 9, fontWeight: 700, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 6 },
  selectBox: { width: '100%', background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(100,116,139,0.25)', borderRadius: 5, color: '#e2e8f0', fontSize: 11, padding: '6px 9px', outline: 'none', boxSizing: 'border-box' as const },
  platformRow: (enabled: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 0',
    borderBottom: '1px solid rgba(100,116,139,0.08)', opacity: enabled ? 1 : 0.45,
  }),
  ratifyBtn: (ratified: boolean): React.CSSProperties => ({
    flexShrink: 0, width: 20, height: 20, borderRadius: 4, border: ratified ? '1px solid #6ee7b7' : '1px solid rgba(100,116,139,0.3)',
    background: ratified ? 'rgba(110,231,183,0.15)' : 'rgba(15,23,42,0.4)', cursor: 'pointer',
    fontSize: 11, color: ratified ? '#6ee7b7' : '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center',
  }),
  dispatchBtn: (canDispatch: boolean): React.CSSProperties => ({
    width: '100%', padding: '10px 0', borderRadius: 7, fontSize: 13, fontWeight: 700,
    cursor: canDispatch ? 'pointer' : 'not-allowed', border: '1px solid rgba(110,231,183,0.35)',
    background: canDispatch ? 'rgba(110,231,183,0.12)' : 'rgba(15,23,42,0.3)',
    color: canDispatch ? '#6ee7b7' : '#334155', opacity: canDispatch ? 1 : 0.5,
  }),
  statusDot: (st: DispatchStatus): React.CSSProperties => ({
    width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 4,
    background: st === 'success' ? '#4ade80' : st === 'failed' ? '#f87171' : st === 'running' ? '#f59e0b' : st === 'skipped' ? '#64748b' : '#1e2a38',
  }),
  progressLog: { background: 'rgba(0,0,0,0.3)', borderRadius: 5, padding: '8px 10px', maxHeight: 140, overflowY: 'auto' as const, fontSize: 10, fontFamily: 'monospace', color: '#6ee7b7', lineHeight: 1.6 },
  credRow: (ok: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0',
    borderBottom: '1px solid rgba(100,116,139,0.06)',
  }),
  credDot: (ok: boolean): React.CSSProperties => ({
    width: 8, height: 8, borderRadius: '50%', background: ok ? '#4ade80' : '#64748b', flexShrink: 0,
  }),
  wizardBox: {
    position: 'absolute' as const, inset: 0, background: 'rgba(10,15,26,0.97)',
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 10,
  },
  previewModal: {
    position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, padding: 16,
  },
  previewBox: {
    background: '#0d1117', border: '1px solid rgba(100,116,139,0.3)', borderRadius: 10,
    width: '100%', maxWidth: 520, maxHeight: '80vh', overflowY: 'auto' as const, padding: 20,
  },
};

// ─── Amplify IPC helpers ──────────────────────────────────────────────────────

const amp = () => window.amplify;

async function ipcInvoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const a = amp();
  switch (channel) {
    case 'dispatch:list-content-files': return a?.dispatchListContentFiles?.() as Promise<T> ?? Promise.resolve([] as unknown as T);
    case 'dispatch:default-platforms': return a?.dispatchDefaultPlatforms?.(args[0] as string) as Promise<T> ?? Promise.resolve([] as unknown as T);
    case 'dispatch:get-file-body': return a?.dispatchGetFileBody?.(args[0] as string) as Promise<T> ?? Promise.resolve({ error: 'no bridge' } as unknown as T);
    case 'dispatch:fire': return a?.dispatchFire?.(args[0] as { filePath: string; platforms: string[]; ratifiedPlatforms: string[] }) as Promise<T> ?? Promise.resolve({ ok: false, error: 'no bridge', results: [] } as unknown as T);
    case 'dispatch:history': return a?.dispatchHistory?.() as Promise<T> ?? Promise.resolve([] as unknown as T);
    case 'dispatch:credential-status': return a?.dispatchCredentialStatus?.() as Promise<T> ?? Promise.resolve({ substack: false, medium: false, gmail: false, cephas: true, lianabanyan: true, hackernews: true } as unknown as T);
    default: throw new Error(`Unknown dispatch channel: ${channel}`);
  }
}

function onDispatchProgress(cb: (msg: string) => void): () => void {
  return amp()?.onDispatchProgress?.(cb) ?? (() => {});
}

// ─── Wizard (SEG-6) ───────────────────────────────────────────────────────────

function FirstUseWizard({ creds, onDone }: { creds: CredentialStatus; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const platforms: { label: string; icon: string; credKey?: keyof CredentialStatus; envVar?: string }[] = [
    { label: 'Cephas museum', icon: '🏛', credKey: 'cephas' },
    { label: 'lianabanyan.com', icon: '🌿', credKey: 'lianabanyan' },
    { label: 'Substack', icon: '📬', credKey: 'substack', envVar: 'SUBSTACK_API_KEY' },
    { label: 'Medium', icon: '📝', credKey: 'medium', envVar: 'MEDIUM_API_TOKEN' },
    { label: 'Gmail (editorial + Crown Letters)', icon: '✉️', credKey: 'gmail', envVar: 'GMAIL_OAUTH_REFRESH_TOKEN + GMAIL_OAUTH_CLIENT_ID + GMAIL_OAUTH_CLIENT_SECRET' },
    { label: 'HackerNews', icon: '🔶', credKey: 'hackernews' },
  ];

  return (
    <div style={s.wizardBox}>
      <div style={{ maxWidth: 400, width: '100%' }}>
        <div style={{ fontSize: 20, marginBottom: 6 }}>⚡ Welcome to Battery Dispatch</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 20, lineHeight: 1.6 }}>
          {step === 0 ? (
            <>
              Pick which platforms you want to publish to. You ratify each dispatch before it fires — nothing publishes without your explicit sign-off.
            </>
          ) : (
            <>
              For platforms marked ⚪, add the env var to <code style={{ fontSize: 10, color: '#6ee7b7' }}>WORKING_KEYS.env</code> in the LockBox vault and relaunch MnemosyneC. Browser-fallback works without any keys.
            </>
          )}
        </div>

        {step === 0 && (
          <div style={{ marginBottom: 20 }}>
            {platforms.map((p) => {
              const ok = p.credKey ? creds[p.credKey] : true;
              return (
                <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid rgba(100,116,139,0.1)' }}>
                  <span>{ok ? '✅' : '⚪'}</span>
                  <span style={{ fontSize: 12 }}>{p.icon} {p.label}</span>
                  {!ok && p.envVar && (
                    <span style={{ fontSize: 9, color: '#475569', marginLeft: 'auto' }}>5-min setup</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {step === 1 && (
          <div style={{ marginBottom: 20 }}>
            {platforms.filter((p) => p.envVar && !(p.credKey && creds[p.credKey])).map((p) => (
              <div key={p.label} style={s.card}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#f0fdf4', marginBottom: 4 }}>{p.icon} {p.label}</div>
                <div style={{ fontSize: 10, color: '#6ee7b7', fontFamily: 'monospace' }}>{p.envVar}</div>
                <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>Add to WORKING_KEYS.env in the LockBox vault, relaunch.</div>
              </div>
            ))}
            {platforms.every((p) => !p.envVar || (p.credKey && creds[p.credKey])) && (
              <div style={{ fontSize: 12, color: '#4ade80' }}>✅ All platforms configured! Click Finish.</div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          {step === 0 && (
            <>
              <button onClick={() => { localStorage.setItem(LS_WIZARD_DONE, '1'); onDone(); }} style={{ background: 'none', border: '1px solid rgba(100,116,139,0.3)', borderRadius: 5, color: '#64748b', fontSize: 11, padding: '6px 14px', cursor: 'pointer' }}>
                Skip Wizard
              </button>
              <button onClick={() => setStep(1)} style={{ background: 'rgba(110,231,183,0.12)', border: '1px solid rgba(110,231,183,0.35)', borderRadius: 5, color: '#6ee7b7', fontSize: 11, fontWeight: 700, padding: '6px 14px', cursor: 'pointer', flex: 1 }}>
                Begin Setup →
              </button>
            </>
          )}
          {step === 1 && (
            <button onClick={() => { localStorage.setItem(LS_WIZARD_DONE, '1'); onDone(); }} style={{ background: 'rgba(110,231,183,0.12)', border: '1px solid rgba(110,231,183,0.35)', borderRadius: 5, color: '#6ee7b7', fontSize: 11, fontWeight: 700, padding: '6px 14px', cursor: 'pointer', flex: 1 }}>
              Finish — Open Battery Dispatch
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Preview Modal ─────────────────────────────────────────────────────────────

function PreviewModal({
  platform, meta, body, onClose, onRatify, ratified,
}: {
  platform: Platform; meta: ContentFileMeta | null; body: string;
  onClose: () => void; onRatify: () => void; ratified: boolean;
}) {
  const pm = PLATFORM_META[platform];
  const preview = body.slice(0, 800) + (body.length > 800 ? '…' : '');
  return (
    <div style={s.previewModal} onClick={onClose}>
      <div style={s.previewBox} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 18 }}>{pm.icon}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f0fdf4' }}>{pm.label}</div>
            <div style={{ fontSize: 10, color: '#475569' }}>{pm.description}</div>
          </div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>Title</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>{meta?.title ?? '—'}</div>
        {meta?.subtitle && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>Subtitle</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12, fontStyle: 'italic' }}>{meta.subtitle}</div>
          </>
        )}
        <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>Body preview</div>
        <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.6, background: 'rgba(0,0,0,0.3)', borderRadius: 5, padding: '8px 10px', maxHeight: 200, overflowY: 'auto', fontFamily: 'monospace', whiteSpace: 'pre-wrap', marginBottom: 14 }}>
          {preview || '(loading…)'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid rgba(100,116,139,0.3)', borderRadius: 5, color: '#64748b', fontSize: 11, padding: '6px 12px', cursor: 'pointer' }}>
            Close
          </button>
          <button
            onClick={() => { onRatify(); onClose(); }}
            style={{ background: ratified ? 'rgba(248,113,113,0.1)' : 'rgba(110,231,183,0.12)', border: ratified ? '1px solid rgba(248,113,113,0.35)' : '1px solid rgba(110,231,183,0.35)', borderRadius: 5, color: ratified ? '#f87171' : '#6ee7b7', fontSize: 11, fontWeight: 700, padding: '6px 14px', cursor: 'pointer', flex: 1 }}
          >
            {ratified ? '✅ Ratified (click to un-ratify)' : '✅ Ratify this platform'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Settings Panel (SEG-5) ───────────────────────────────────────────────────

function SettingsPanel({ creds }: { creds: CredentialStatus }) {
  const platforms: { key: keyof CredentialStatus; label: string; icon: string; envVars?: string[]; note?: string }[] = [
    { key: 'cephas', label: 'Cephas Hugo', icon: '🏛', note: 'Wired (git + firebase in workspace)' },
    { key: 'lianabanyan', label: 'lianabanyan.com React', icon: '🌿', note: 'Wired (firebase in workspace)' },
    { key: 'hackernews', label: 'HackerNews', icon: '🔶', note: 'Semi-auto browser (no setup needed)' },
    { key: 'substack', label: 'Substack', icon: '📬', envVars: ['SUBSTACK_API_KEY'] },
    { key: 'medium', label: 'Medium', icon: '📝', envVars: ['MEDIUM_API_TOKEN'] },
    { key: 'gmail', label: 'Gmail (editorial + Crown Letters)', icon: '✉️', envVars: ['GMAIL_OAUTH_CLIENT_ID', 'GMAIL_OAUTH_CLIENT_SECRET', 'GMAIL_OAUTH_REFRESH_TOKEN'] },
  ];

  return (
    <div>
      <div style={{ ...s.label, marginBottom: 10 }}>Platform Credentials</div>
      {platforms.map((p) => {
        const ok = creds[p.key];
        return (
          <div key={p.key} style={s.credRow(ok)}>
            <div style={s.credDot(ok)} />
            <span style={{ fontSize: 12 }}>{p.icon} {p.label}</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: ok ? '#4ade80' : '#64748b' }}>
              {ok ? '✅ Ready' : p.note ? p.note : '⚪ Not configured'}
            </span>
          </div>
        );
      })}
      <div style={{ marginTop: 14, ...s.card }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0', marginBottom: 6 }}>How to configure</div>
        <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.7 }}>
          Add the env vars to <code style={{ color: '#6ee7b7' }}>WORKING_KEYS.env</code> in the LockBox vault:
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#6ee7b7', background: 'rgba(0,0,0,0.3)', borderRadius: 4, padding: '6px 8px', marginTop: 6, lineHeight: 1.8 }}>
          {platforms.filter((p) => p.envVars).flatMap((p) => p.envVars!).map((v) => `${v}=your_key_here`).join('\n')}
        </div>
        <div style={{ fontSize: 10, color: '#475569', marginTop: 6 }}>
          Relaunch MnemosyneC after adding keys. Browser-fallback works without any keys.
        </div>
      </div>
      <div style={{ marginTop: 10, ...s.card }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>Founder Decisions Pending</div>
        <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.7 }}>
          • <strong>Substack publication name</strong> — Bishop suggests "For the Keep — by Jonathan G.I. Jones"<br/>
          • <strong>Default fan-out per class</strong> — tune which platforms each content type targets<br/>
          • <strong>Standing Ratify thresholds</strong> — which classes auto-fire after file-level ratify<br/>
          • <strong>Crown Letters defaults</strong> — postal vs Gmail per recipient
        </div>
      </div>
    </div>
  );
}

// ─── History Panel ─────────────────────────────────────────────────────────────

function HistoryPanel({ history }: { history: DispatchHistoryEntry[] }) {
  if (history.length === 0) {
    return <div style={{ fontSize: 11, color: '#334155', textAlign: 'center', padding: '24px 0' }}>No dispatches yet. Pick content + ratify platforms + fire.</div>;
  }
  return (
    <div>
      {history.slice(0, 20).map((entry) => (
        <div key={entry.id} style={s.card}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>{entry.title}</div>
          <div style={{ fontSize: 9, color: '#475569', marginBottom: 8 }}>{entry.contentClass} · {new Date(entry.dispatchedAt).toLocaleString()}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
            {entry.platforms.map((p) => (
              <span key={p.platform} style={{
                fontSize: 10, padding: '2px 7px', borderRadius: 10,
                background: p.status === 'success' ? 'rgba(74,222,128,0.1)' : p.status === 'failed' ? 'rgba(248,113,113,0.1)' : 'rgba(100,116,139,0.1)',
                color: p.status === 'success' ? '#4ade80' : p.status === 'failed' ? '#f87171' : '#64748b',
                border: `1px solid ${p.status === 'success' ? 'rgba(74,222,128,0.3)' : p.status === 'failed' ? 'rgba(248,113,113,0.3)' : 'rgba(100,116,139,0.2)'}`,
              }}>
                {p.status === 'success' ? '✓' : p.status === 'failed' ? '✗' : '–'} {p.platform}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function BatteryPublishTab() {
  const [view, setView] = useState<'dispatch' | 'history' | 'settings'>(
    () => (localStorage.getItem(LS_ACTIVE_VIEW) as 'dispatch' | 'history' | 'settings' | null) ?? 'dispatch'
  );
  const [showWizard, setShowWizard] = useState(() => localStorage.getItem(LS_WIZARD_DONE) !== '1');
  const [files, setFiles] = useState<ContentFileMeta[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [selectedMeta, setSelectedMeta] = useState<ContentFileMeta | null>(null);
  const [previewBody, setPreviewBody] = useState('');
  const [platforms, setPlatforms] = useState<PlatformRow[]>([]);
  const [dispatching, setDispatching] = useState(false);
  const [progressLog, setProgressLog] = useState<string[]>([]);
  const [previewingPlatform, setPreviewingPlatform] = useState<Platform | null>(null);
  const [history, setHistory] = useState<DispatchHistoryEntry[]>([]);
  const [creds, setCreds] = useState<CredentialStatus>({ substack: false, medium: false, gmail: false, cephas: true, lianabanyan: true, hackernews: true });
  const logRef = useRef<HTMLDivElement>(null);

  // Load credential status
  useEffect(() => {
    ipcInvoke<CredentialStatus>('dispatch:credential-status').then(setCreds).catch(() => {});
  }, []);

  // Load content files
  useEffect(() => {
    ipcInvoke<ContentFileMeta[]>('dispatch:list-content-files').then(setFiles).catch(() => {});
  }, []);

  // Load history
  const reloadHistory = useCallback(() => {
    ipcInvoke<DispatchHistoryEntry[]>('dispatch:history').then(setHistory).catch(() => {});
  }, []);
  useEffect(() => { reloadHistory(); }, [reloadHistory]);

  // Subscribe to dispatch progress events
  useEffect(() => {
    const unsub = onDispatchProgress((msg: string) => {
      setProgressLog((prev) => [...prev, msg]);
      setTimeout(() => { logRef.current?.scrollTo(0, 99999); }, 50);
    });
    return unsub;
  }, []);

  // When file selection changes
  const handleFileSelect = useCallback(async (filePath: string) => {
    setSelectedFile(filePath);
    const meta = files.find((f) => f.filePath === filePath) ?? null;
    setSelectedMeta(meta);
    if (meta) {
      const rows = initialPlatformRows(meta.contentClass, creds);
      setPlatforms(rows);
      // Load body for preview
      const bodyRes = await ipcInvoke<{ v1Body?: string; v2Body?: string; error?: string }>('dispatch:get-file-body', filePath);
      setPreviewBody(bodyRes.v1Body ?? '');
    }
  }, [files, creds]);

  // Toggle platform enabled
  const toggleEnabled = useCallback((platform: Platform) => {
    setPlatforms((prev) => prev.map((r) => r.platform === platform ? { ...r, enabled: !r.enabled, ratified: false } : r));
  }, []);

  // Toggle ratify
  const toggleRatify = useCallback((platform: Platform) => {
    setPlatforms((prev) => prev.map((r) => r.platform === platform ? { ...r, ratified: !r.ratified } : r));
  }, []);

  // BP078 BLOOD: can dispatch only if ≥1 platform enabled AND all enabled platforms are ratified
  const enabledPlatforms = platforms.filter((r) => r.enabled);
  const ratifiedPlatforms = platforms.filter((r) => r.enabled && r.ratified);
  const canDispatch = selectedFile.length > 0 && enabledPlatforms.length > 0 && ratifiedPlatforms.length === enabledPlatforms.length && !dispatching;

  // Dispatch handler
  const handleDispatch = useCallback(async () => {
    if (!canDispatch) return;
    setDispatching(true);
    setProgressLog([]);
    // Reset platform statuses
    setPlatforms((prev) => prev.map((r) => r.enabled ? { ...r, status: 'running' } : r));

    try {
      const result = await ipcInvoke<{ ok: boolean; error?: string; results: Array<{ platform: Platform; status: 'success' | 'failed' | 'skipped'; url?: string; fallbackUrl?: string; error?: string }> }>(
        'dispatch:fire',
        {
          filePath: selectedFile,
          platforms: enabledPlatforms.map((r) => r.platform),
          ratifiedPlatforms: ratifiedPlatforms.map((r) => r.platform),
        }
      );

      if (!result.ok) {
        setProgressLog((prev) => [...prev, `ERROR: ${result.error}`]);
        setPlatforms((prev) => prev.map((r) => ({ ...r, status: r.enabled ? 'failed' : r.status })));
      } else {
        setPlatforms((prev) => prev.map((r) => {
          const res = result.results.find((x) => x.platform === r.platform);
          if (!res) return r;
          return { ...r, status: res.status, resultUrl: res.url, fallbackUrl: res.fallbackUrl, error: res.error };
        }));
        reloadHistory();
      }
    } catch (e) {
      setProgressLog((prev) => [...prev, `IPC error: ${e instanceof Error ? e.message : String(e)}`]);
    } finally {
      setDispatching(false);
    }
  }, [canDispatch, selectedFile, enabledPlatforms, ratifiedPlatforms, reloadHistory]);

  const switchView = (v: typeof view) => {
    setView(v);
    localStorage.setItem(LS_ACTIVE_VIEW, v);
  };

  return (
    <div style={s.outer}>
      {/* Header */}
      <div style={s.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>⚡</span>
          <div>
            <div style={s.headerTitle}>Battery Dispatch</div>
            <div style={s.headerSub}>Auto-fan-out for ratified content. You ratify → the cooperative dispatches.</div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={s.tabBar}>
        {(['dispatch', 'history', 'settings'] as const).map((v) => (
          <button key={v} onClick={() => switchView(v)} style={s.tab(view === v)}>
            {v === 'dispatch' ? '+ New Dispatch' : v === 'history' ? 'History' : 'Settings'}
          </button>
        ))}
      </div>

      {/* Scrollable content */}
      <div style={s.scroll}>

        {/* ── DISPATCH VIEW ────────────────────────────────────────────────── */}
        {view === 'dispatch' && (
          <>
            {/* File picker */}
            <div style={s.card}>
              <div style={s.label}>Content file (from BISHOP_DROPZONE/00_FOUNDER_REVIEW/)</div>
              <select
                style={s.selectBox}
                value={selectedFile}
                onChange={(e) => handleFileSelect(e.target.value)}
              >
                <option value="">— Select ratified content file —</option>
                {files.map((f) => (
                  <option key={f.filePath} value={f.filePath}>
                    [{f.contentClass}] {f.title}
                    {f.status?.toLowerCase().includes('ratif') ? ' ✓' : ''}
                  </option>
                ))}
              </select>
              {selectedMeta && (
                <div style={{ marginTop: 8, fontSize: 10, color: '#475569' }}>
                  Class: <strong style={{ color: '#6ee7b7' }}>{selectedMeta.contentClass}</strong>
                  {selectedMeta.date && <> · Date: {selectedMeta.date}</>}
                  {selectedMeta.status && <> · Status: {selectedMeta.status}</>}
                </div>
              )}
            </div>

            {/* Fan-out plan */}
            {selectedMeta && (
              <div style={s.card}>
                <div style={s.label}>Fan-out plan — check all platforms you want to fire</div>
                <div style={{ marginBottom: 6, fontSize: 10, color: '#475569' }}>
                  Tick a platform, then click <strong>[Preview]</strong> to review + ratify. Dispatch fires only ratified ✅ platforms.
                </div>
                {platforms.map((row) => (
                  <div key={row.platform} style={s.platformRow(row.enabled)}>
                    {/* Enable checkbox */}
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={() => toggleEnabled(row.platform)}
                      style={{ width: 14, height: 14, flexShrink: 0, marginTop: 2, accentColor: '#6ee7b7', cursor: 'pointer' }}
                    />
                    {/* Status dot */}
                    <div style={s.statusDot(row.status)} title={row.status} />
                    {/* Label + description */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0' }}>
                        {row.icon} {row.label}
                      </div>
                      <div style={{ fontSize: 9, color: '#475569', lineHeight: 1.5 }}>{row.description}</div>
                      {row.resultUrl && (
                        <div style={{ fontSize: 10, color: '#4ade80', marginTop: 2 }}>✓ {row.resultUrl}</div>
                      )}
                      {row.fallbackUrl && !row.resultUrl && (
                        <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 2 }}>↗ browser opened</div>
                      )}
                      {row.error && row.status === 'failed' && (
                        <div style={{ fontSize: 9, color: '#f87171', marginTop: 2 }}>{row.error.slice(0, 80)}</div>
                      )}
                    </div>
                    {/* Preview + ratify */}
                    {row.enabled && (
                      <>
                        <button
                          onClick={() => setPreviewingPlatform(row.platform)}
                          style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(100,116,139,0.25)', borderRadius: 4, color: '#94a3b8', fontSize: 10, padding: '3px 8px', cursor: 'pointer' }}
                        >
                          Preview
                        </button>
                        <button
                          onClick={() => toggleRatify(row.platform)}
                          style={s.ratifyBtn(row.ratified)}
                          title={row.ratified ? 'Un-ratify' : 'Ratify this platform'}
                        >
                          {row.ratified ? '✓' : ''}
                        </button>
                      </>
                    )}
                  </div>
                ))}

                {/* Ratify summary */}
                <div style={{ marginTop: 10, fontSize: 10, color: enabledPlatforms.length > 0 && ratifiedPlatforms.length < enabledPlatforms.length ? '#f59e0b' : '#4ade80' }}>
                  {enabledPlatforms.length === 0 ? 'Select at least one platform.' :
                    ratifiedPlatforms.length < enabledPlatforms.length
                      ? `⚠ ${enabledPlatforms.length - ratifiedPlatforms.length} platform(s) not yet ratified. Preview each and click Ratify.`
                      : `✅ All ${ratifiedPlatforms.length} selected platforms ratified — ready to dispatch.`}
                </div>
              </div>
            )}

            {/* Dispatch button */}
            {selectedMeta && (
              <button
                onClick={handleDispatch}
                disabled={!canDispatch}
                style={s.dispatchBtn(canDispatch)}
              >
                {dispatching ? '⏳ Dispatching…' : `🔥 DISPATCH (${ratifiedPlatforms.length}/${enabledPlatforms.length} ratified)`}
              </button>
            )}

            {/* Progress log */}
            {progressLog.length > 0 && (
              <div style={{ ...s.card, marginTop: 8 }}>
                <div style={s.label}>Dispatch log</div>
                <div style={s.progressLog} ref={logRef}>
                  {progressLog.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Last dispatch summary */}
            {history.length > 0 && !dispatching && (
              <div style={{ fontSize: 10, color: '#334155', textAlign: 'center', marginTop: 8 }}>
                Last dispatch: <strong style={{ color: '#64748b' }}>{history[0].title}</strong> · {new Date(history[0].dispatchedAt).toLocaleString()}
              </div>
            )}
          </>
        )}

        {/* ── HISTORY VIEW ─────────────────────────────────────────────────── */}
        {view === 'history' && <HistoryPanel history={history} />}

        {/* ── SETTINGS VIEW ────────────────────────────────────────────────── */}
        {view === 'settings' && <SettingsPanel creds={creds} />}

      </div>

      {/* Preview modal */}
      {previewingPlatform && (
        <PreviewModal
          platform={previewingPlatform}
          meta={selectedMeta}
          body={previewBody}
          onClose={() => setPreviewingPlatform(null)}
          onRatify={() => toggleRatify(previewingPlatform)}
          ratified={platforms.find((r) => r.platform === previewingPlatform)?.ratified ?? false}
        />
      )}

      {/* First-use wizard overlay (SEG-6) */}
      {showWizard && (
        <FirstUseWizard creds={creds} onDone={() => setShowWizard(false)} />
      )}
    </div>
  );
}
