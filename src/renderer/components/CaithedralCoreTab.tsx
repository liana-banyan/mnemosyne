// CaithedralCoreTab.tsx — BP061 · Tab 13 · Caithedral™ Core surface inside Mnemosyne
// Surfaces the LEAN open-source CAI™ Core SSPL reference implementation.
// All window.amplify.caithedral calls use graceful try/catch degradation.
// Color scheme: #0a0a0a bg · #7c6af7 accent · #22c55e success · #f59e0b warning

import React, { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type SubPanel = 'overview' | 'substrate' | 'folders' | 'banyan-metric' | 'dag-soccerball';

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
  dagSoccerball?: {
    emit: (pearls: string[], bindings?: Record<string, string>, faces?: Record<string, string>) => Promise<{ dag_id: string; pearl_count: number; face_count: number; dag_crystal_size: number }>;
    resolve: (root_id: string, path: string[]) => Promise<{ found: boolean; node: unknown; path_taken: string[]; depth: number }>;
    handle: (mode: 'encode' | 'decode', opts: { root_id?: string; session_meta?: string; handle?: string }) => Promise<{ handle?: string; handle_bytes?: number; max_depth?: number; total_nodes?: number; addressable_count?: number; bytes_referenced?: number; compression_ratio?: string; meta?: unknown; found?: boolean }>;
    stats: () => Promise<{ total_dag_nodes: number; estimatedBytes: number }>;
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
  { id: 'dag-soccerball', label: 'DAG ⚽'        },
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
            Keystone I · SSPL-1.0 · Designed to Be Copied
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
            tools pending Keystone I
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
        {activePanel === 'dag-soccerball' && <DagSoccerballPanel cai={cai} />}
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
        CAI™ Core Keystone I · SSPL-1.0 + Patent Pledge #2260 · © 2026 Liana Banyan Corporation · 50-year charter · Designed to Be Copied · mnemosynec.ai
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
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Caithedral tools available in Keystone I+</div>
      <div style={{ color: P.muted, fontSize: 11 }}>
        The <code style={{ color: P.accent }}>window.amplify.caithedral</code> bridge is not yet wired in this build.
        Update Mnemosyne to Keystone I to enable live Banyan Metric™, MoneyPenny™, Substrate, and Substrated Folders.
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
        <strong style={{ color: P.subtext }}>CAI™ Core Keystone I</strong>
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

// ─── DAG Soccerball Panel (BP061 · Soccerball-in-Soccerball · Context Lever) ─

function DagSoccerballPanel({ cai }: { cai: CaithedralApi | null }) {
  const [rootId, setRootId] = useState('');
  const [path, setPath] = useState('');
  const [sessionMeta, setSessionMeta] = useState('');
  const [handle, setHandle] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [stats, setStats] = useState<{ total_dag_nodes: number; estimatedBytes: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeOp, setActiveOp] = useState<'emit' | 'resolve' | 'encode' | 'decode'>('emit');

  const [emitPearls, setEmitPearls] = useState('af5be14111467931');
  const [emitFaces, setEmitFaces] = useState('');

  // MESH-6 Piece 6: fetch-from-peer state
  const [fetchPeerDagId, setFetchPeerDagId] = useState('');
  const [fetchPeerSelectedId, setFetchPeerSelectedId] = useState('');
  const [meshPeers, setMeshPeers] = useState<Array<{ peerId: string; displayName?: string }>>([]);
  const [fetchPeerResult, setFetchPeerResult] = useState<string | null>(null);
  const [fetchPeerLoading, setFetchPeerLoading] = useState(false);

  useEffect(() => {
    if (!cai?.dagSoccerball) return;
    cai.dagSoccerball.stats().then(setStats).catch(() => {});
  }, [cai]);

  // Load mesh peers for peer-selector (independent of dagSoccerball bridge)
  useEffect(() => {
    (window as typeof window & { amplify?: { getMeshState?: () => Promise<{ peers: Array<{ peerId: string; displayName?: string }> }> } }).amplify?.getMeshState?.()
      .then((state) => { if (state?.peers) setMeshPeers(state.peers); })
      .catch(() => {});
  }, []);

  const refreshStats = useCallback(async () => {
    if (!cai?.dagSoccerball) return;
    try { setStats(await cai.dagSoccerball.stats()); } catch {}
  }, [cai]);

  const runOp = useCallback(async () => {
    if (!cai?.dagSoccerball) return;
    setLoading(true);
    setResult(null);
    try {
      if (activeOp === 'emit') {
        const pearls = emitPearls.split(',').map(s => s.trim()).filter(Boolean);
        const faces: Record<string, string> = {};
        if (emitFaces.trim()) {
          emitFaces.split(',').forEach(pair => {
            const [k, v] = pair.trim().split(':');
            if (k && v) faces[k.trim()] = v.trim();
          });
        }
        const r = await cai.dagSoccerball.emit(pearls, {}, faces);
        setRootId(r.dag_id);
        setResult(JSON.stringify(r, null, 2));
        await refreshStats();
      } else if (activeOp === 'resolve') {
        const p = path.split(',').map(s => s.trim()).filter(Boolean);
        const r = await cai.dagSoccerball.resolve(rootId, p);
        setResult(JSON.stringify(r, null, 2));
      } else if (activeOp === 'encode') {
        const r = await cai.dagSoccerball.handle('encode', { root_id: rootId, session_meta: sessionMeta || undefined });
        setHandle(r.handle ?? '');
        setResult(JSON.stringify(r, null, 2));
      } else {
        const r = await cai.dagSoccerball.handle('decode', { handle });
        setResult(JSON.stringify(r, null, 2));
      }
    } catch (err) {
      setResult(`Error: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [cai, activeOp, emitPearls, emitFaces, rootId, path, sessionMeta, handle, refreshStats]);

  // MESH-6 Piece 6: fetch-from-peer op (independent of dagSoccerball bridge)
  const runFetchPeer = useCallback(async () => {
    if (!fetchPeerDagId.trim() || !fetchPeerSelectedId) {
      setFetchPeerResult('Error: provide dag_id and select a peer');
      return;
    }
    setFetchPeerLoading(true);
    setFetchPeerResult(null);
    try {
      const r = await (window as unknown as { amplify?: { federationFetchSid?: (dag_id: string, peerId: string) => Promise<{ ok: boolean; node?: unknown; hash_verified: boolean; error?: string }> } }).amplify?.federationFetchSid?.(fetchPeerDagId.trim(), fetchPeerSelectedId);
      if (r?.ok && r.hash_verified) {
        setFetchPeerResult(JSON.stringify({ hash_verified: true, node: r.node }, null, 2));
      } else {
        setFetchPeerResult(`Error: ok=${r?.ok} hash_verified=${r?.hash_verified} error=${r?.error}`);
      }
    } catch (err) {
      setFetchPeerResult(`Error: ${(err as Error).message}`);
    } finally {
      setFetchPeerLoading(false);
    }
  }, [fetchPeerDagId, fetchPeerSelectedId]);

  const addressingRows = [1,2,3,4,5,6].map(d => ({ depth: d, count: Math.pow(6, d) }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header info */}
      <div style={{
        padding: '10px 14px',
        background: 'rgba(124,106,247,0.06)',
        border: `1px solid rgba(124,106,247,0.2)`,
        borderRadius: 8,
        fontSize: 11,
        color: '#aaa',
        lineHeight: 1.7,
      }}>
        <strong style={{ color: P.accent }}>Soccerball-in-Soccerball™</strong>
        {' · '}Recursive DAG addressing · 6 faces × depth N = 6<sup>N</sup> items
        <br />
        <strong style={{ color: P.success }}>Context Lever™:</strong>
        {' '}~135-byte handle re-weaves full session from substrate · replaces 72%→{'<'}30% context
      </div>

      {/* Addressing table */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: 6,
      }}>
        {addressingRows.map(({ depth, count }) => (
          <div key={depth} style={{
            padding: '8px 6px',
            background: P.surface,
            border: `1px solid ${P.border}`,
            borderRadius: 6,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 9, color: P.muted }}>depth {depth}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: P.accent }}>{count.toLocaleString()}</div>
            <div style={{ fontSize: 8, color: '#444' }}>items</div>
          </div>
        ))}
      </div>

      {/* Stats row */}
      {stats && (
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{
            flex: 1, padding: '8px 12px', background: P.surface,
            border: `1px solid ${P.border}`, borderRadius: 6,
          }}>
            <div style={{ fontSize: 9, color: P.muted }}>DAG nodes in crystal</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: P.accent }}>{stats.total_dag_nodes}</div>
          </div>
          <div style={{
            flex: 1, padding: '8px 12px', background: P.surface,
            border: `1px solid ${P.border}`, borderRadius: 6,
          }}>
            <div style={{ fontSize: 9, color: P.muted }}>Substrate ~bytes</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: P.success }}>{stats.estimatedBytes.toLocaleString()}</div>
          </div>
        </div>
      )}

      {!cai?.dagSoccerball ? (
        <div style={{
          padding: 14, background: 'rgba(245,158,11,0.06)',
          border: `1px solid rgba(245,158,11,0.2)`, borderRadius: 8,
          color: P.warning, fontSize: 11,
        }}>
          DAG Soccerball bridge available in Keystone I+ · dagSoccerball bridge not wired in this build
        </div>
      ) : (
        <>
          {/* Op selector */}
          <div style={{ display: 'flex', gap: 4 }}>
            {(['emit', 'resolve', 'encode', 'decode'] as const).map((op) => (
              <button
                key={op}
                onClick={() => setActiveOp(op)}
                style={{
                  padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: activeOp === op ? 600 : 400, cursor: 'pointer',
                  border: activeOp === op ? `1px solid rgba(124,106,247,0.6)` : `1px solid ${P.border}`,
                  background: activeOp === op ? 'rgba(124,106,247,0.15)' : 'transparent',
                  color: activeOp === op ? P.accent : P.muted,
                }}
              >
                {op}
              </button>
            ))}
          </div>

          {/* Emit form */}
          {activeOp === 'emit' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input value={emitPearls} onChange={e => setEmitPearls(e.target.value)}
                placeholder="pearl IDs (comma-separated)"
                style={{ flex: 1, background: P.surface, color: P.text, border: `1px solid ${P.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 11, outline: 'none' }} />
              <input value={emitFaces} onChange={e => setEmitFaces(e.target.value)}
                placeholder="faces: 0:dag_id_child0, 2:dag_id_child2 (optional)"
                style={{ flex: 1, background: P.surface, color: P.text, border: `1px solid ${P.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 11, outline: 'none' }} />
            </div>
          )}

          {/* Resolve form */}
          {activeOp === 'resolve' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input value={rootId} onChange={e => setRootId(e.target.value)}
                placeholder="root dag_id (32 chars)"
                style={{ flex: 1, background: P.surface, color: P.text, border: `1px solid ${P.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 11, fontFamily: 'monospace', outline: 'none' }} />
              <input value={path} onChange={e => setPath(e.target.value)}
                placeholder="face path: 0, 3, 2 (comma-separated 0–5)"
                style={{ flex: 1, background: P.surface, color: P.text, border: `1px solid ${P.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 11, outline: 'none' }} />
            </div>
          )}

          {/* Encode form */}
          {activeOp === 'encode' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input value={rootId} onChange={e => setRootId(e.target.value)}
                placeholder="root dag_id (32 chars)"
                style={{ flex: 1, background: P.surface, color: P.text, border: `1px solid ${P.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 11, fontFamily: 'monospace', outline: 'none' }} />
              <input value={sessionMeta} onChange={e => setSessionMeta(e.target.value)}
                placeholder="session label (optional, max 20 chars)"
                style={{ flex: 1, background: P.surface, color: P.text, border: `1px solid ${P.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 11, outline: 'none' }} />
            </div>
          )}

          {/* Decode form */}
          {activeOp === 'decode' && (
            <input value={handle} onChange={e => setHandle(e.target.value)}
              placeholder="paste ~135-byte DAG handle here"
              style={{ flex: 1, background: P.surface, color: P.text, border: `1px solid ${P.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 11, fontFamily: 'monospace', outline: 'none' }} />
          )}

          <button
            onClick={() => void runOp()}
            disabled={loading}
            style={{
              alignSelf: 'flex-start', padding: '7px 18px',
              background: loading ? '#333' : P.accent,
              color: '#fff', border: 'none', borderRadius: 6,
              cursor: loading ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600,
            }}
          >
            {loading ? '…' : activeOp === 'emit' ? 'Emit DAG Node' : activeOp === 'resolve' ? 'Resolve Path' : activeOp === 'encode' ? 'Encode Handle' : 'Decode Handle'}
          </button>

          {result && (
            <div style={{
              padding: 12, background: P.surface, border: `1px solid ${P.border}`,
              borderRadius: 6, fontSize: 10, color: '#ccc', whiteSpace: 'pre-wrap',
              fontFamily: 'monospace', maxHeight: 220, overflow: 'auto',
            }}>
              {result}
            </div>
          )}
        </>
      )}

      {/* Context lever explanation */}
      <div style={{
        padding: '8px 12px', background: P.surface, border: `1px solid ${P.border}`,
        borderRadius: 6, fontSize: 10, color: P.muted, lineHeight: 1.7,
      }}>
        <strong style={{ color: P.subtext }}>Context Lever™ mechanics:</strong> A ~135-byte handle encodes root_id + depth + node_count + pearls_hash + epoch. Feed the handle into dag_soccerball_handle (decode) at session-open to instantly re-weave the full DAG from the substrate — no re-reading context. Target: 72% context → {'<'}30%.
        <br />
        <strong style={{ color: P.success }}>POCKET-6 LIVE:</strong> soccerball-over-DNS emitting via Google Cloud DNS (ns-cloud-a1..a4.googledomains.com · Zone: soccerball-s · pearl_82fc6d2e03a9c98c).
      </div>

      {/* MESH-6 Piece 6: Resolve from peer — independent of local dagSoccerball bridge */}
      <div style={{
        padding: '10px 14px',
        background: 'rgba(34,197,94,0.05)',
        border: `1px solid rgba(34,197,94,0.2)`,
        borderRadius: 8,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{ fontSize: 11, color: P.success, fontWeight: 600 }}>
          MESH-6 · Resolve from Peer
        </div>
        <div style={{ fontSize: 10, color: P.muted }}>
          Fetch a DAG node from a peer by dag_id. Hash-verified on receipt (SID = sha256(pearls,bindings,faces)[:32]).
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            value={fetchPeerDagId}
            onChange={e => setFetchPeerDagId(e.target.value)}
            placeholder="remote dag_id (32 chars)"
            style={{ background: P.surface, color: P.text, border: `1px solid ${P.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 11, fontFamily: 'monospace', outline: 'none' }}
          />
          <select
            value={fetchPeerSelectedId}
            onChange={e => setFetchPeerSelectedId(e.target.value)}
            style={{ background: P.surface, color: P.text, border: `1px solid ${P.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 11 }}
          >
            <option value="">— select peer —</option>
            {meshPeers.map(p => (
              <option key={p.peerId} value={p.peerId}>
                {p.displayName ?? p.peerId.slice(0, 12)} ({p.peerId.slice(0, 8)}…)
              </option>
            ))}
          </select>
        </div>
        {meshPeers.length === 0 && (
          <div style={{ fontSize: 10, color: P.muted, fontStyle: 'italic' }}>
            No peers discovered yet — open Federation tab to connect peers first.
          </div>
        )}
        <button
          onClick={() => void runFetchPeer()}
          disabled={fetchPeerLoading}
          style={{
            alignSelf: 'flex-start', padding: '6px 16px',
            background: fetchPeerLoading ? '#333' : 'rgba(34,197,94,0.8)',
            color: '#fff', border: 'none', borderRadius: 6,
            cursor: fetchPeerLoading ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 600,
          }}
        >
          {fetchPeerLoading ? '…fetching' : 'Fetch + Verify Hash'}
        </button>
        {fetchPeerResult && (
          <div style={{
            padding: 10, background: P.surface, border: `1px solid ${P.border}`,
            borderRadius: 6, fontSize: 10, color: fetchPeerResult.startsWith('Error') ? P.danger : '#ccc',
            whiteSpace: 'pre-wrap', fontFamily: 'monospace', maxHeight: 200, overflow: 'auto',
          }}>
            {fetchPeerResult}
          </div>
        )}
      </div>
    </div>
  );
}
