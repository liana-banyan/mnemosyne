// Pheromone Visualizer — MnemosyneC™ v0.1.8 · SEG-FT-6 · BP052 NOVACULA
// Trail heat map · access frequency · auto-refresh every 10s
//
// KN-BP143-3 D4: this file used to fall back to a 20-entry MOCK_TRAILS array (fabricated
// subjects, access counts, timestamps, and scores) whenever caiCore.getPheromoneTrails() was
// unavailable or empty, rendering a fully-populated heat map + trail registry that looked like
// real telemetry. Cut, not wired: no engine call anywhere in this codebase currently returns
// per-trail pheromone data, so there is nothing real to fill the grid with. When there is no live
// data, the grid renders its existing honest empty state below instead.

import React, { useState, useEffect, useCallback } from 'react';

interface PheromoneTrail {
  subject: string;
  accessCount: number;
  lastAccessed: string;
  score: number;
}

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
        setTrails([]);
        setHasLiveData(false);
      }
    } catch {
      setTrails([]);
      setHasLiveData(false);
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
            {hasLiveData ? '● Live trails' : '○ No trail data yet'} · auto-refresh 10s · last: {lastRefresh.toLocaleTimeString()}
          </div>
        </div>
        <button onClick={() => void load()} style={{ padding: '3px 8px', fontSize: 9, cursor: 'pointer', border: '1px solid rgba(100,116,139,0.2)', background: 'transparent', color: '#64748b', borderRadius: 5 }}>↻ Refresh</button>
      </div>

      {hasLiveData ? (
        <>
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
        </>
      ) : (
        <div style={{ fontSize: 10, color: '#64748b', fontStyle: 'italic', lineHeight: 1.6, padding: '20px 0', textAlign: 'center' }}>
          Not yet tracked -- no engine call anywhere in this codebase returns per-trail pheromone
          data today. Honestly empty, not a fabricated heat map (KN-BP143-3 D4).
        </div>
      )}
    </div>
  );
}
