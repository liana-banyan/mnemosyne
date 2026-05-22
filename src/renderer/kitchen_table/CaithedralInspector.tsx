// Caithedral™ Retrieval Inspector — Mnemosyne™ v0.1.8 · SEG-FT-5 · BP052 NOVACULA
// Displays retrieval log · test query · source scribe filter · score histogram

import React, { useState, useEffect, useCallback } from 'react';

interface RetrievalEntry {
  timestamp: string;
  query: string;
  sourceScribe: string;
  score: number;
  resultSnippet: string;
}

const MOCK_ENTRIES: RetrievalEntry[] = [
  { timestamp: new Date(Date.now() - 300_000).toISOString(), query: 'Kitchen Table meal planning', sourceScribe: 'KnightQueue', score: 0.94, resultSnippet: 'Family meal coordination via cooperative Kitchen Table™ module…' },
  { timestamp: new Date(Date.now() - 900_000).toISOString(), query: 'Atlas™ scheduling conflict resolution', sourceScribe: 'KnightArchitecture', score: 0.88, resultSnippet: 'Multi-participant scheduling with availability juggling visualization…' },
  { timestamp: new Date(Date.now() - 1_800_000).toISOString(), query: 'Banyan Metric composite score', sourceScribe: 'KnightBRIDLEMemory', score: 0.91, resultSnippet: 'BP052 NOVACULA v0.1.8 wave target composite score 89.4…' },
  { timestamp: new Date(Date.now() - 3_600_000).toISOString(), query: 'P2P discovery peer expiry', sourceScribe: 'KnightQueue', score: 0.76, resultSnippet: 'UDP multicast beacon expiry at 90s, peer map cleanup on 15s interval…' },
  { timestamp: new Date(Date.now() - 7_200_000).toISOString(), query: 'Recipe™ AI-assist fallback', sourceScribe: 'KnightHandoffs', score: 0.82, resultSnippet: 'Graceful fallback when window.amplify.ai unavailable — silent no-op…' },
];

const ALL_SCRIBES = ['All', 'KnightQueue', 'KnightArchitecture', 'KnightBRIDLEMemory', 'KnightHandoffs'];

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

function scoreColor(score: number): string {
  if (score >= 0.9) return '#22c55e';
  if (score >= 0.75) return '#f59e0b';
  return '#f87171';
}

export function CaithedralInspector() {
  const [entries, setEntries] = useState<RetrievalEntry[]>([]);
  const [scribeFilter, setScribeFilter] = useState('All');
  const [testQuery, setTestQuery] = useState('');
  const [querying, setQuerying] = useState(false);
  const [hasLiveData, setHasLiveData] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await (window.amplify as any)?.caiCore?.getRetrievalLog?.() as RetrievalEntry[] | null;
      if (result && result.length > 0) {
        setEntries(result);
        setHasLiveData(true);
      } else {
        setEntries(MOCK_ENTRIES);
      }
    } catch {
      setEntries(MOCK_ENTRIES);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleTestQuery() {
    if (!testQuery.trim()) return;
    setQuerying(true);
    try {
      const result = await (window.amplify as any)?.caiCore?.query?.({ query: testQuery }) as { score?: number; snippet?: string; scribe?: string } | null;
      const entry: RetrievalEntry = {
        timestamp: new Date().toISOString(),
        query: testQuery,
        sourceScribe: result?.scribe ?? 'live',
        score: result?.score ?? 0,
        resultSnippet: result?.snippet ?? '(no result)',
      };
      setEntries((prev) => [entry, ...prev]);
      setHasLiveData(true);
    } catch {
      const entry: RetrievalEntry = {
        timestamp: new Date().toISOString(),
        query: testQuery,
        sourceScribe: 'mock',
        score: Math.random() * 0.4 + 0.6,
        resultSnippet: `Mock result for: "${testQuery}" — cai-core not connected`,
      };
      setEntries((prev) => [entry, ...prev]);
    } finally {
      setQuerying(false);
      setTestQuery('');
    }
  }

  const filtered = scribeFilter === 'All' ? entries : entries.filter((e) => e.sourceScribe === scribeFilter);

  const maxScore = Math.max(...entries.map((e) => e.score), 0.01);

  return (
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>Caithedral™ Retrieval Inspector</div>
          <div style={{ fontSize: 9, color: '#475569', marginTop: 1 }}>
            {hasLiveData ? '● Live data' : '○ Mock data — cai-core not connected'}
          </div>
        </div>
        <select
          value={scribeFilter}
          onChange={(e) => setScribeFilter(e.target.value)}
          style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(100,116,139,0.2)', borderRadius: 5, color: '#94a3b8', fontSize: 10, padding: '3px 7px', cursor: 'pointer' }}
        >
          {ALL_SCRIBES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Test query input */}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          style={{ flex: 1, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(100,116,139,0.2)', borderRadius: 6, color: '#e2e8f0', fontSize: 11, padding: '5px 8px', outline: 'none' }}
          value={testQuery}
          onChange={(e) => setTestQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleTestQuery(); }}
          placeholder="Run a test query against Caithedral™…"
        />
        <button
          onClick={() => void handleTestQuery()}
          disabled={querying || !testQuery.trim()}
          style={{ padding: '5px 12px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: querying ? 'wait' : 'pointer', border: '1px solid rgba(110,231,183,0.3)', background: 'rgba(110,231,183,0.08)', color: '#6ee7b7', opacity: querying ? 0.6 : 1 }}
        >
          {querying ? '…' : 'Run'}
        </button>
      </div>

      {/* Score histogram */}
      {entries.length > 0 && (
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Score Histogram</div>
          <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 40 }}>
            {entries.slice(0, 12).map((e, i) => (
              <div
                key={i}
                title={`${e.query.slice(0, 30)} — ${(e.score * 100).toFixed(0)}%`}
                style={{
                  flex: 1,
                  height: `${(e.score / maxScore) * 100}%`,
                  background: scoreColor(e.score),
                  borderRadius: '2px 2px 0 0',
                  opacity: 0.85,
                  minWidth: 8,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Retrieval log table */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#475569', fontSize: 11, padding: '20px 0' }}>
          No retrieval events yet — run the Gauntlet or ask a question to populate
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Retrieval Log ({filtered.length})</div>
          {filtered.map((entry, i) => (
            <div key={i} style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(100,116,139,0.1)', borderRadius: 6, padding: '7px 10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#e2e8f0', flex: 1, marginRight: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.query}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: scoreColor(entry.score), flexShrink: 0 }}>{(entry.score * 100).toFixed(0)}%</span>
              </div>
              <div style={{ fontSize: 9, color: '#64748b', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.resultSnippet}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ fontSize: 8, color: '#334155' }}>📚 {entry.sourceScribe}</span>
                <span style={{ fontSize: 8, color: '#334155' }}>🕐 {relTime(entry.timestamp)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
