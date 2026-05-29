// CaithedralCoreTab.tsx — BP061 · Tab 13 · Caithedral™ Core surface inside Mnemosyne
// Surfaces the LEAN open-source CAI™ Core SSPL reference implementation.
// All window.amplify.caithedral calls use graceful try/catch degradation.
// Color scheme: #0a0a0a bg · #7c6af7 accent · #22c55e success · #f59e0b warning

import React, { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type SubPanel = 'overview' | 'substrate' | 'folders' | 'banyan-metric';

interface BmScore {
  composite: number;
  CW: number;
  WC: number;
  SC: number;
  RR: number;
  DR: number;
  CM: number;
}

interface BmRow {
  score: BmScore;
  session_id: string;
  bp_session: string;
  timestamp: string;
}

interface CaithedralApi {
  banyanMetric?: {
    getLatest: () => Promise<{ score: BmScore; session_id: string; bp_session: string; timestamp: string } | null>;
    getTrend: (n?: number) => Promise<BmRow[]>;
  };
  moneyPenny?: {
    getDualView: () => Promise<{ combined_usd: number } | null>;
  };
  substrate?: {
    query: (text: string) => Promise<{ hit: boolean; record?: { text: string }; routing: string; latency_ms: number }>;
  };
  substratedFolders?: {
    list: () => Promise<string[]>;
    add: (p?: string) => Promise<{ ok: boolean; paths: string[] }>;
    remove: (p: string) => Promise<{ ok: boolean; paths: string[] }>;
  };
}

function getCaithedral(): CaithedralApi | null {
  return (window as unknown as { amplify?: { caithedral?: CaithedralApi } }).amplify?.caithedral ?? null;
}

// ─── Sub-panel pill styles ─────────────────────────────────────────────────────

const SUBPANELS: { id: SubPanel; label: string }[] = [
  { id: 'overview',      label: 'Overview'       },
  { id: 'substrate',     label: 'Substrate'      },
  { id: 'folders',       label: 'Folders'        },
  { id: 'banyan-metric', label: 'Banyan Metric™' },
];

// ─── Shared palette ────────────────────────────────────────────────────────────

const P = {
  bg:      '#0a0a0a',
  surface: '#111111',
  border:  '#222222',
  accent:  '#7c6af7',
  success: '#22c55e',
  warning: '#f59e0b',
  danger:  '#ef4444',
  muted:   '#666666',
  text:    '#e0e0e0',
  subtext: '#aaaaaa',
} as const;

// ─── Root component ────────────────────────────────────────────────────────────

export function CaithedralCoreTab() {
  const [activePanel, setActivePanel] = useState<SubPanel>('overview');
  const cai = getCaithedral();
  const available = cai !== null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: P.bg,
      color: P.text,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 16px 8px',
        borderBottom: `1px solid ${P.border}`,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: 0.5 }}>
            Caithedral™ Core
          </div>
          <div style={{ fontSize: 10, color: P.muted, marginTop: 1 }}>
            v0.1.16 · SSPL-1.0 · Designed to Be Copied
          </div>
        </div>
        {!available && (
          <span style={{
            fontSize: 9, fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 10,
            background: 'rgba(245,158,11,0.12)',
            border: `1px solid rgba(245,158,11,0.3)`,
            color: P.warning,
          }}>
            tools pending v0.1.16
          </span>
        )}
        {available && (
          <span style={{
            fontSize: 9, fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 10,
            background: 'rgba(34,197,94,0.1)',
            border: `1px solid rgba(34,197,94,0.25)`,
            color: P.success,
          }}>
            ACTIVE
          </span>
        )}
      </div>

      {/* Pill tab bar */}
      <div style={{
        display: 'flex',
        gap: 4,
        padding: '8px 16px',
        borderBottom: `1px solid ${P.border}`,
        flexShrink: 0,
      }}>
        {SUBPANELS.map((sp) => (
          <button
            key={sp.id}
            onClick={() => setActivePanel(sp.id)}
            style={{
              padding: '4px 12px',
              borderRadius: 20,
              border: activePanel === sp.id
                ? `1px solid rgba(124,106,247,0.6)`
                : `1px solid ${P.border}`,
              background: activePanel === sp.id
                ? 'rgba(124,106,247,0.15)'
                : 'transparent',
              color: activePanel === sp.id ? P.accent : P.muted,
              fontSize: 11,
              fontWeight: activePanel === sp.id ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {sp.label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {activePanel === 'overview'      && <OverviewPanel cai={cai} />}
        {activePanel === 'substrate'     && <SubstratePanel cai={cai} />}
        {activePanel === 'folders'       && <FoldersPanel cai={cai} />}
        {activePanel === 'banyan-metric' && <BanyanMetricPanel cai={cai} />}
      </div>

      {/* Footer */}
      <div style={{
        padding: '6px 16px',
        borderTop: `1px solid ${P.border}`,
        fontSize: 9,
        color: '#333',
        flexShrink: 0,
        lineHeight: 1.6,
      }}>
        CAI™ Core v0.1.16 · SSPL-1.0 + Patent Pledge #2260 · © 2026 Liana Banyan Corporation · 50-year charter · Designed to Be Copied · mnemosynec.ai
      </div>
    </div>
  );
}

// ─── Unavailability notice ────────────────────────────────────────────────────

function UnavailableNotice() {
  return (
    <div style={{
      padding: 16,
      background: 'rgba(245,158,11,0.06)',
      border: `1px solid rgba(245,158,11,0.2)`,
      borderRadius: 8,
      color: P.warning,
      fontSize: 12,
      lineHeight: 1.6,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Caithedral tools available in Mnemosyne v0.1.16+</div>
      <div style={{ color: P.muted, fontSize: 11 }}>
        The <code style={{ color: P.accent }}>window.amplify.caithedral</code> bridge is not yet wired in this build.
        Update Mnemosyne to v0.1.16 to enable live Banyan Metric™, MoneyPenny™, Substrate, and Substrated Folders.
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{
      background: P.surface,
      border: `1px solid ${P.border}`,
      borderRadius: 8,
      padding: '12px 14px',
    }}>
      <div style={{ fontSize: 10, color: P.muted, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: accent ?? '#fff' }}>{value}</div>
    </div>
  );
}

// ─── Overview panel ───────────────────────────────────────────────────────────

function OverviewPanel({ cai }: { cai: CaithedralApi | null }) {
  const [bmScore, setBmScore] = useState<{ composite: number } | null>(null);
  const [mpView, setMpView] = useState<{ combined_usd: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cai) return;
    cai.banyanMetric?.getLatest()
      .then((r) => r && setBmScore(r.score))
      .catch((e: unknown) => setError(String(e)));
    cai.moneyPenny?.getDualView()
      .then((r) => r && setMpView(r))
      .catch(() => {});
  }, [cai]);

  if (!cai) return <UnavailableNotice />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 12,
      }}>
        <StatCard
          label="Banyan Metric™"
          value={bmScore ? `${bmScore.composite.toFixed(1)}/100` : '—'}
          accent={bmScore
            ? bmScore.composite >= 80 ? P.success : bmScore.composite >= 50 ? P.warning : P.danger
            : '#fff'}
        />
        <StatCard
          label="MoneyPenny™ Saved"
          value={mpView ? `$${mpView.combined_usd.toFixed(4)}` : '—'}
          accent={P.success}
        />
        <StatCard label="Architecture" value="Caithedral™ active" accent={P.accent} />
        <StatCard label="License" value="SSPL-1.0" />
      </div>

      {error && (
        <div style={{
          padding: 10,
          background: 'rgba(239,68,68,0.06)',
          border: `1px solid rgba(239,68,68,0.2)`,
          borderRadius: 6,
          fontSize: 11,
          color: P.danger,
        }}>
          {error}
        </div>
      )}

      <div style={{
        padding: 14,
        background: P.surface,
        borderRadius: 8,
        fontSize: 11,
        color: P.muted,
        lineHeight: 1.8,
        border: `1px solid ${P.border}`,
      }}>
        <strong style={{ color: P.subtext }}>CAI™ Core v0.1.16</strong>
        {' · '}Cooperative AI Memory Architecture
        {' · '}Reference Implementation
        <br />
        SSPL-1.0 + Cooperative Patent Pledge #2260 · Designed to Be Copied
        <br />
        <button
          onClick={() => (window as unknown as { amplify?: { openExternal?: (u: string) => void } }).amplify?.openExternal?.('https://mnemosynec.ai')}
          style={{
            background: 'none',
            border: 'none',
            color: P.accent,
            cursor: 'pointer',
            fontSize: 11,
            padding: 0,
            textDecoration: 'underline',
          }}
        >
          mnemosynec.ai
        </button>
      </div>
    </div>
  );
}

// ─── Substrate panel ──────────────────────────────────────────────────────────

function SubstratePanel({ cai }: { cai: CaithedralApi | null }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async () => {
    if (!cai?.substrate || !query.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await cai.substrate.query(query.trim());
      if (r.hit && r.record) {
        setResult(`[${r.routing} · ${r.latency_ms}ms · HIT]\n${r.record.text}`);
      } else {
        setResult(`[${r.routing ?? 'miss'} · ${r.latency_ms ?? 0}ms · MISS] No substrate hit`);
      }
    } catch (err) {
      setResult(`Error: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [cai, query]);

  if (!cai) return <UnavailableNotice />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12, color: P.muted }}>
        Caithedral™ CPU-only retrieval · zero LLM inference
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void search()}
          placeholder="Query the substrate…"
          style={{
            flex: 1,
            background: P.surface,
            color: P.text,
            border: `1px solid ${P.border}`,
            borderRadius: 6,
            padding: '8px 10px',
            fontSize: 12,
            outline: 'none',
          }}
        />
        <button
          onClick={() => void search()}
          disabled={loading || !query.trim() || !cai.substrate}
          style={{
            padding: '8px 18px',
            background: loading ? '#333' : P.accent,
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {loading ? '…' : 'Query'}
        </button>
      </div>
      {result && (
        <div style={{
          padding: 12,
          background: P.surface,
          border: `1px solid ${P.border}`,
          borderRadius: 6,
          fontSize: 11,
          color: '#ccc',
          whiteSpace: 'pre-wrap',
          fontFamily: 'monospace',
          maxHeight: 260,
          overflow: 'auto',
        }}>
          {result}
        </div>
      )}
      {!cai.substrate && (
        <div style={{ fontSize: 11, color: P.warning }}>
          substrate.query not available via this bridge — check preload wiring
        </div>
      )}
    </div>
  );
}

// ─── Folders panel ────────────────────────────────────────────────────────────

function FoldersPanel({ cai }: { cai: CaithedralApi | null }) {
  const [folders, setFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!cai?.substratedFolders) return;
    try {
      const f = await cai.substratedFolders.list();
      setFolders(f);
    } catch (err) {
      setListError(String(err));
    }
  }, [cai]);

  useEffect(() => { void refresh(); }, [refresh]);

  const addFolder = async () => {
    if (!cai?.substratedFolders) return;
    setLoading(true);
    try {
      const result = await cai.substratedFolders.add();
      setFolders(result.paths);
    } catch (err) {
      setListError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const removeFolder = async (path: string) => {
    if (!cai?.substratedFolders) return;
    try {
      const result = await cai.substratedFolders.remove(path);
      setFolders(result.paths);
    } catch (err) {
      setListError(String(err));
    }
  };

  if (!cai) return <UnavailableNotice />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12, color: P.muted, lineHeight: 1.6 }}>
        CAI™ Core reads <strong style={{ color: P.subtext }}>only</strong> the folders you mark here.
        Files are never modified — Eblet™ records are written to{' '}
        <code style={{ color: P.accent, fontSize: 11 }}>~/.cai_core/</code>.
      </div>

      <button
        onClick={() => void addFolder()}
        disabled={loading || !cai.substratedFolders}
        style={{
          alignSelf: 'flex-start',
          padding: '7px 16px',
          background: loading ? '#333' : P.success,
          color: '#000',
          border: 'none',
          borderRadius: 6,
          cursor: loading || !cai.substratedFolders ? 'not-allowed' : 'pointer',
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        {loading ? 'Selecting…' : '+ Add Substrated Folder'}
      </button>

      {listError && (
        <div style={{ fontSize: 11, color: P.danger }}>{listError}</div>
      )}

      {folders.length === 0 ? (
        <div style={{
          padding: 16,
          background: P.surface,
          borderRadius: 6,
          color: '#555',
          fontSize: 12,
          border: `1px solid ${P.border}`,
        }}>
          No folders substrated yet. Click "+ Add Substrated Folder" to begin.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {folders.map((f) => (
            <div key={f} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 12px',
              background: P.surface,
              border: '1px solid #1a2e1a',
              borderRadius: 6,
            }}>
              <span style={{ color: P.success, fontSize: 13, flexShrink: 0 }}>✓</span>
              <span style={{ flex: 1, fontSize: 11, color: '#ccc', wordBreak: 'break-all' }}>{f}</span>
              <span style={{ fontSize: 9, color: '#555', flexShrink: 0 }}>Substrated</span>
              <button
                onClick={() => void removeFolder(f)}
                style={{
                  padding: '3px 8px',
                  background: 'transparent',
                  border: `1px solid ${P.border}`,
                  borderRadius: 4,
                  color: P.muted,
                  cursor: 'pointer',
                  fontSize: 10,
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {!cai.substratedFolders && (
        <div style={{ fontSize: 11, color: P.warning }}>
          substratedFolders bridge not available — check preload wiring
        </div>
      )}
    </div>
  );
}

// ─── Banyan Metric™ panel ─────────────────────────────────────────────────────

function BanyanMetricPanel({ cai }: { cai: CaithedralApi | null }) {
  const [latest, setLatest] = useState<BmRow | null>(null);
  const [rows, setRows] = useState<BmRow[]>([]);

  useEffect(() => {
    if (!cai?.banyanMetric) return;
    cai.banyanMetric.getLatest()
      .then((r) => r && setLatest(r as BmRow))
      .catch(() => {});
    cai.banyanMetric.getTrend(10)
      .then((t) => setRows((t as BmRow[]).slice().reverse()))
      .catch(() => {});
  }, [cai]);

  if (!cai) return <UnavailableNotice />;

  const scoreColor = (v: number) =>
    v >= 80 ? P.success : v >= 50 ? P.warning : P.danger;

  const dimRow = (label: string, val: number, weight: string) => (
    <div key={label} style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '5px 0',
      borderBottom: '1px solid #1a1a1a',
    }}>
      <div>
        <span style={{ fontSize: 11, color: '#ccc', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 9, color: '#444', marginLeft: 6 }}>w={weight}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: scoreColor(val) }}>
        {val.toFixed(1)}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 12, color: P.muted }}>
        6-dimension AI session scoring · CW · WC · SC · RR · DR · CM
      </div>

      {latest ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ padding: 14, background: P.surface, border: `1px solid ${P.border}`, borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: P.muted, marginBottom: 6 }}>Composite Score</div>
            <div style={{
              fontSize: 34,
              fontWeight: 900,
              color: scoreColor(latest.score.composite),
            }}>
              {latest.score.composite.toFixed(2)}
              <span style={{ fontSize: 14, color: '#444' }}>/100</span>
            </div>
            <div style={{ fontSize: 9, color: '#444', marginTop: 4 }}>
              Session: {latest.session_id?.slice(0, 16)} · {latest.bp_session}
            </div>
          </div>
          <div style={{ padding: 14, background: P.surface, border: `1px solid ${P.border}`, borderRadius: 8 }}>
            {dimRow('CW — Context Window',   latest.score.CW, '0.20')}
            {dimRow('WC — Work Completed',   latest.score.WC, '0.20')}
            {dimRow('SC — Substrate Contrib',latest.score.SC, '0.15')}
            {dimRow('RR — Retrieval Rate',   latest.score.RR, '0.20')}
            {dimRow('DR — Drift Rate',       latest.score.DR, '0.10')}
            {dimRow('CM — Cost Mitigation',  latest.score.CM, '0.15')}
          </div>
        </div>
      ) : (
        <div style={{
          padding: 16,
          background: P.surface,
          borderRadius: 6,
          color: '#555',
          fontSize: 12,
          border: `1px solid ${P.border}`,
        }}>
          No Banyan Metric™ records yet. Records are written when a session appends a score row.
        </div>
      )}

      {rows.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: P.muted, marginBottom: 8 }}>
            Session History (last 10)
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${P.border}` }}>
                  {['Session', 'BP', 'Composite', 'CW', 'WC', 'SC', 'RR', 'DR', 'CM', 'Date'].map((h) => (
                    <th key={h} style={{ padding: '5px 6px', textAlign: 'left', color: '#555', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #111' }}>
                    <td style={{ padding: '4px 6px', color: P.subtext }}>{r.session_id?.slice(0, 10)}</td>
                    <td style={{ padding: '4px 6px', color: P.muted }}>{r.bp_session}</td>
                    <td style={{ padding: '4px 6px', fontWeight: 700, color: scoreColor(r.score.composite) }}>
                      {r.score.composite.toFixed(1)}
                    </td>
                    {(['CW', 'WC', 'SC', 'RR', 'DR', 'CM'] as Array<keyof BmScore>).map((d) => (
                      <td key={d} style={{ padding: '4px 6px', color: P.muted }}>{r.score[d].toFixed(1)}</td>
                    ))}
                    <td style={{ padding: '4px 6px', color: '#444' }}>
                      {new Date(r.timestamp).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!cai.banyanMetric && (
        <div style={{ fontSize: 11, color: P.warning }}>
          banyanMetric bridge not available — check preload wiring
        </div>
      )}
    </div>
  );
}
