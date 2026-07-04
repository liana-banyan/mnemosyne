// NetworkValueReveal.tsx -- BP078 Scope 3
// Side-by-side "Caithedral Alone" vs "Yoked AI" comparison card.
// Receives live grading result or static canonical numbers (pearl_88a8c069).

import React from 'react';

export interface NetworkValueData {
  isStatic: boolean;
  accuracy: number;          // fraction 0-1
  hashVerified: number;      // count
  totalQuestions: number;
  p50LatencyMs: number;
  p95LatencyMs?: number;
}

// BP067 canonical static evidence -- pearl_88a8c069
export const CANONICAL_STATIC: NetworkValueData = {
  isStatic: true,
  accuracy: 1.0,
  hashVerified: 20,
  totalQuestions: 20,
  p50LatencyMs: 16.6,
};

interface Props {
  data: NetworkValueData;
}

const cell: React.CSSProperties = {
  flex: 1,
  background: 'rgba(15,23,42,0.7)',
  border: '1px solid rgba(100,116,139,0.2)',
  borderRadius: 10,
  padding: '18px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const cellHighlight: React.CSSProperties = {
  ...cell,
  border: '1px solid rgba(110,231,183,0.35)',
  background: 'rgba(6,78,59,0.2)',
};

const label: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: '#64748b',
  marginBottom: 4,
};

const valueStyle: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 700,
  color: '#f1f5f9',
  lineHeight: 1.2,
};

const subValue: React.CSSProperties = {
  fontSize: 11,
  color: '#94a3b8',
  marginTop: 2,
};

const badge: React.CSSProperties = {
  display: 'inline-block',
  background: 'rgba(110,231,183,0.15)',
  color: '#6ee7b7',
  border: '1px solid rgba(110,231,183,0.3)',
  borderRadius: 4,
  padding: '2px 7px',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.06em',
};

export function NetworkValueReveal({ data }: Props): React.ReactElement {
  const accuracyPct = Math.round(data.accuracy * 100);
  const latencyDisplay = data.p50LatencyMs < 1 ? '<1' : data.p50LatencyMs.toFixed(1);

  return (
    <div style={{ width: '100%' }}>
      {data.isStatic && (
        <div style={{
          fontSize: 11,
          color: '#64748b',
          marginBottom: 12,
          padding: '6px 10px',
          background: 'rgba(100,116,139,0.08)',
          borderRadius: 6,
          border: '1px solid rgba(100,116,139,0.15)',
        }}>
          Previously-recorded results from our verified benchmark run
          {' '}<span style={{ color: '#4b5563' }}>(pearl_88a8c069)</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        {/* Caithedral Alone column */}
        <div style={cell}>
          <div style={label}>Caithedral Alone</div>
          <div>
            <div style={{ ...valueStyle, color: '#94a3b8' }}>~60%</div>
            <div style={subValue}>local substrate only</div>
          </div>
          <div>
            <div style={{ ...valueStyle, fontSize: 18, color: '#94a3b8' }}>N/A</div>
            <div style={subValue}>no peer verification</div>
          </div>
          <div>
            <div style={{ ...valueStyle, fontSize: 18, color: '#94a3b8' }}>varies</div>
            <div style={subValue}>latency p50</div>
          </div>
        </div>

        {/* Yoked AI column */}
        <div style={cellHighlight}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={label}>Yoked AI</div>
            <span style={badge}>MESH</span>
          </div>
          <div>
            <div style={valueStyle}>{accuracyPct}%</div>
            <div style={subValue}>accuracy ({data.totalQuestions} questions)</div>
          </div>
          <div>
            <div style={{ ...valueStyle, color: '#6ee7b7' }}>
              {data.hashVerified}/{data.totalQuestions}
            </div>
            <div style={subValue}>hash-verified peer answers</div>
          </div>
          <div>
            <div style={{ ...valueStyle, color: '#6ee7b7' }}>
              {latencyDisplay}ms
            </div>
            <div style={subValue}>
              fetch latency p50
              {data.p95LatencyMs !== undefined && ` (p95: ${data.p95LatencyMs.toFixed(1)}ms)`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
