// Pheromone Visualizer — Mnemosyne™ v0.1.8 · SEG-FT-6 · BP052 NOVACULA
// Trail heat map · access frequency · auto-refresh every 10s

import React, { useState, useEffect, useCallback } from 'react';

interface PheromoneTrail {
  subject: string;
  accessCount: number;
  lastAccessed: string;
  score: number;
}

const MOCK_TRAILS: PheromoneTrail[] = [
  { subject: 'Kitchen Table™ meal-planning session', accessCount: 47, lastAccessed: new Date(Date.now() - 120_000).toISOString(), score: 0.94 },
  { subject: 'Atlas™ event creation flow', accessCount: 38, lastAccessed: new Date(Date.now() - 300_000).toISOString(), score: 0.88 },
  { subject: 'Banyan Metric™ composite calculation', accessCount: 33, lastAccessed: new Date(Date.now() - 600_000).toISOString(), score: 0.82 },
  { subject: 'Eblet™ provenance chain lookup', accessCount: 29, lastAccessed: new Date(Date.now() - 900_000).toISOString(), score: 0.77 },
  { subject: 'P2P discovery peer expiry policy', accessCount: 24, lastAccessed: new Date(Date.now() - 1_200_000).toISOString(), score: 0.71 },
  { subject: 'Recipe™ AI-assist fallback behavior', accessCount: 21, lastAccessed: new Date(Date.now() - 1_800_000).toISOString(), score: 0.67 },
  { subject: 'Caithedral™ retrieval score normalization', accessCount: 18, lastAccessed: new Date(Date.now() - 2_400_000).toISOString(), score: 0.62 },
  { subject: 'DevModeTab panel navigation state', accessCount: 15, lastAccessed: new Date(Date.now() - 3_600_000).toISOString(), score: 0.55 },
  { subject: 'MnemosyneTabView tab persistence', accessCount: 12, lastAccessed: new Date(Date.now() - 5_400_000).toISOString(), score: 0.48 },
  { subject: 'Atlas™ participant color assignment', accessCount: 10, lastAccessed: new Date(Date.now() - 7_200_000).toISOString(), score: 0.43 },
  { subject: 'Kitchen Table IPC channel registration', accessCount: 8, lastAccessed: new Date(Date.now() - 10_800_000).toISOString(), score: 0.36 },
  { subject: 'Photo ref local path resolution', accessCount: 7, lastAccessed: new Date(Date.now() - 14_400_000).toISOString(), score: 0.31 },
  { subject: 'Multicast beacon 30s interval', accessCount: 6, lastAccessed: new Date(Date.now() - 18_000_000).toISOString(), score: 0.26 },
  { subject: 'Settings tab DevMode toggle sync', accessCount: 5, lastAccessed: new Date(Date.now() - 21_600_000).toISOString(), score: 0.21 },
  { subject: 'GauntletTab first-complete flag', accessCount: 4, lastAccessed: new Date(Date.now() - 28_800_000).toISOString(), score: 0.17 },
  { subject: 'FAQTab topic routing from Frame', accessCount: 3, lastAccessed: new Date(Date.now() - 36_000_000).toISOString(), score: 0.13 },
  { subject: 'FrameMode auto-detect polling', accessCount: 3, lastAccessed: new Date(Date.now() - 43_200_000).toISOString(), score: 0.12 },
  { subject: 'Watchdog overlay 8s interval', accessCount: 2, lastAccessed: new Date(Date.now() - 50_400_000).toISOString(), score: 0.08 },
  { subject: 'Tray icon tooltip format', accessCount: 2, lastAccessed: new Date(Date.now() - 57_600_000).toISOString(), score: 0.07 },
  { subject: 'Brand triple-click wind unlock', accessCount: 1, lastAccessed: new Date(Date.now() - 72_000_000).toISOString(), score: 0.03 },
];

function heatColor(score: number): string {
  const r = Math.round(255 * score);
  const g = Math.round(80 * (1 - score));
  const b = Math.round(200 * (1 - score * 0.8));
  return `rgb(${r},${g},${b})`;
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function PheromoneVisualizer() {
  const [trails, setTrails] = useState<PheromoneTrail[]>([]);
  const [hasLiveData, setHasLiveData] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = useCallback(async () => {
    try {
      const result = await (window.amplify as any)?.caiCore?.getPheromoneTrails?.() as PheromoneTrail[] | null;
      if (result && result.length > 0) {
        setTrails(result);
        setHasLiveData(true);
      } else {
        setTrails(MOCK_TRAILS);
      }
    } catch {
      setTrails(MOCK_TRAILS);
    }
    setLastRefresh(new Date());
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => { void load(); }, 10_000);
    return () => clearInterval(id);
  }, [load]);

  const sorted = [...trails].sort((a, b) => b.score - a.score);
  const gridItems = sorted.slice(0, 100);
  const maxScore = Math.max(...trails.map((t) => t.score), 0.01);

  return (
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>Pheromone Visualizer</div>
          <div style={{ fontSize: 9, color: '#475569', marginTop: 1 }}>
            {hasLiveData ? '● Live trails' : '○ Mock data'} · auto-refresh 10s · last: {lastRefresh.toLocaleTimeString()}
          </div>
        </div>
        <button onClick={() => void load()} style={{ padding: '3px 8px', fontSize: 9, cursor: 'pointer', border: '1px solid rgba(100,116,139,0.2)', background: 'transparent', color: '#64748b', borderRadius: 5 }}>↻ Refresh</button>
      </div>

      {/* Heat map grid — 10×N cells */}
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Trail Heat Map</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 3 }}>
          {gridItems.map((trail, i) => (
            <div
              key={i}
              title={`${trail.subject}\nAccess: ${trail.accessCount}\nScore: ${(trail.score * 100).toFixed(0)}%`}
              style={{
                height: 20,
                borderRadius: 3,
                background: heatColor(trail.score / maxScore),
                opacity: 0.7 + (trail.score / maxScore) * 0.3,
                cursor: 'default',
                transition: 'opacity 0.2s',
              }}
            />
          ))}
          {/* Fill remaining cells */}
          {Array.from({ length: Math.max(0, 100 - gridItems.length) }).map((_, i) => (
            <div key={`empty-${i}`} style={{ height: 20, borderRadius: 3, background: 'rgba(100,116,139,0.06)' }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: 8, color: '#334155' }}>cool (low access)</span>
          <span style={{ fontSize: 8, color: '#334155' }}>hot (high access)</span>
        </div>
      </div>

      {/* Trail list */}
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Trail Registry ({trails.length})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {sorted.slice(0, 12).map((trail, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(100,116,139,0.08)', borderRadius: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: heatColor(trail.score / maxScore), flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 9, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{trail.subject}</div>
              <div style={{ flexShrink: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 9, color: '#475569' }}>{trail.accessCount}×</span>
                <span style={{ fontSize: 8, color: '#334155' }}>{relTime(trail.lastAccessed)}</span>
                <span style={{ fontSize: 8, fontWeight: 700, color: trail.score >= 0.8 ? '#22c55e' : trail.score >= 0.5 ? '#f59e0b' : '#64748b' }}>
                  {(trail.score * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
