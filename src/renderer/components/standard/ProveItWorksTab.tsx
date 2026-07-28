// SEG-K23-D — Prove It Works: honest poller health check (Truth-Always §2)
// BP136 Yoke: extended with the answer-cache mode toggle + real (restart-surviving) meter
// summary. "Nothing that isn't real" -- every number below comes from
// ai-dispatch:answer-cache-meter-summary, which reads the persisted per-query JSONL log.

import React, { useState, useCallback, useEffect } from 'react';

export interface ProveItWorksTabProps {
  onFirstComplete?: () => void;
  onSwitchTab?: (tab: string) => void;
}

type CheckState = 'idle' | 'checking' | 'alive' | 'offline';

interface MeterSummary {
  total_queries: number;
  served_verbatim_count: number;
  rag_count: number;
  local_generate_count: number;
  flagship_count: number;
  cloud_cost_avoided_usd: number;
  avg_latency_ms: number;
  avg_served_verbatim_latency_ms: number;
}

function panelStyle(): React.CSSProperties {
  return {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(148, 163, 184, 0.06)',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    borderRadius: 6,
  };
}

export function ProveItWorksTab(props: ProveItWorksTabProps) {
  const { onFirstComplete, onSwitchTab } = props;
  const [checkState, setCheckState] = useState<CheckState>('idle');
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [hasCompleted, setHasCompleted] = useState(false);

  // BP136: answer-cache mode toggle + meter summary
  const [cacheModeOn, setCacheModeOn] = useState(false);
  const [cacheModeLoaded, setCacheModeLoaded] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [meter, setMeter] = useState<MeterSummary | null>(null);
  const [loadingMeter, setLoadingMeter] = useState(false);

  const refreshMeter = useCallback(async () => {
    setLoadingMeter(true);
    try {
      const res = await window.amplify?.aiDispatch?.getAnswerCacheMeterSummary?.();
      if (res?.ok && res.summary) setMeter(res.summary);
    } catch {
      // non-fatal — panel just shows the last-known (or empty) state
    }
    setLoadingMeter(false);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await window.amplify?.aiDispatch?.getSettings?.();
        if (res?.ok && res.settings) setCacheModeOn(res.settings.answer_cache_mode === true);
      } catch {
        // non-fatal — defaults to OFF, which matches the real default
      }
      setCacheModeLoaded(true);
    })();
    void refreshMeter();
  }, [refreshMeter]);

  const toggleCacheMode = useCallback(async () => {
    const next = !cacheModeOn;
    setToggling(true);
    setCacheModeOn(next);
    try {
      await window.amplify?.aiDispatch?.saveSettings?.({ answer_cache_mode: next });
    } catch {
      // non-fatal — UI stays optimistic; next getSettings() read will reconcile
    }
    setToggling(false);
  }, [cacheModeOn]);

  const runCheck = useCallback(async () => {
    setCheckState('checking');
    setCheckedAt(null);

    try {
      const result = await (window as any).amplify?.pollerHealthQuery?.();
      const timestamp = new Date().toISOString();
      setCheckedAt(timestamp);

      if (result?.alive === true) {
        setCheckState('alive');
      } else {
        setCheckState('offline');
      }

      if (!hasCompleted) {
        setHasCompleted(true);
        onFirstComplete?.();
      }
    } catch {
      setCheckedAt(new Date().toISOString());
      setCheckState('offline');
    }
  }, [hasCompleted, onFirstComplete]);

  return (
    <div style={{ padding: 16, height: '100%', boxSizing: 'border-box', overflowY: 'auto' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
        Prove It Works
      </div>
      <div style={{ fontSize: 11, color: '#707070', marginBottom: 4, lineHeight: 1.5 }}>
        Serve the frontier answer instantly at $0 — real counters only, nothing fabricated.
      </div>

      {/* BP136: Answer Cache mode toggle */}
      <div style={panelStyle()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>Answer Cache</div>
            <div style={{ fontSize: 11, color: '#707070', marginTop: 2, lineHeight: 1.5 }}>
              When ON, an exact or near-identical repeat question is served straight from the
              verified answer store — $0, no model call. Default is OFF.
            </div>
          </div>
          <button
            type="button"
            onClick={() => void toggleCacheMode()}
            disabled={toggling || !cacheModeLoaded}
            style={{
              flexShrink: 0,
              padding: '6px 14px',
              backgroundColor: cacheModeOn ? 'rgba(100, 200, 150, 0.15)' : 'rgba(148, 163, 184, 0.1)',
              border: `1px solid ${cacheModeOn ? 'rgba(100, 200, 150, 0.5)' : 'rgba(148, 163, 184, 0.3)'}`,
              borderRadius: 5,
              color: cacheModeOn ? '#8bc8a0' : '#94a3b8',
              fontSize: 12,
              fontWeight: 700,
              cursor: toggling ? 'wait' : 'pointer',
              minWidth: 52,
            }}
          >
            {cacheModeOn ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* BP136: The Meter — real counters */}
      <div style={panelStyle()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>The Meter</div>
          <button
            type="button"
            onClick={() => void refreshMeter()}
            disabled={loadingMeter}
            title="Refresh"
            style={{
              background: 'none',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              borderRadius: 4,
              color: '#94a3b8',
              fontSize: 11,
              padding: '2px 8px',
              cursor: loadingMeter ? 'wait' : 'pointer',
            }}
          >
            {loadingMeter ? '…' : '↻ Refresh'}
          </button>
        </div>
        {meter && meter.total_queries > 0 ? (
          <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.9 }}>
            <div>
              Served free (from substrate): <b style={{ color: '#6ee7b7' }}>{meter.served_verbatim_count}</b> of{' '}
              {meter.total_queries} queries
            </div>
            <div>
              Estimated cost avoided: <b style={{ color: '#6ee7b7' }}>${meter.cloud_cost_avoided_usd.toFixed(4)}</b>{' '}
              <span style={{ color: '#606060' }}>(estimate — not a guarantee)</span>
            </div>
            {meter.avg_served_verbatim_latency_ms > 0 && (
              <div>Avg latency, served free: {meter.avg_served_verbatim_latency_ms}ms</div>
            )}
            <div style={{ color: '#606060' }}>
              RAG-assisted: {meter.rag_count} · Local generate: {meter.local_generate_count} · Flagship: {meter.flagship_count}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#606060', fontStyle: 'italic' }}>
            No queries recorded yet. Ask a question, then come back and refresh.
          </div>
        )}
      </div>

      <div style={{ fontSize: 11, color: '#707070', margin: '20px 0 4px', lineHeight: 1.5 }}>
        Press the button to confirm your substrate poller is live.
      </div>

      <button
        type="button"
        onClick={() => void runCheck()}
        disabled={checkState === 'checking'}
        style={{
          padding: '10px 20px',
          backgroundColor: 'rgba(100, 200, 150, 0.15)',
          border: '1px solid rgba(100, 200, 150, 0.5)',
          borderRadius: 4,
          color: '#8bc8a0',
          fontSize: 14,
          fontWeight: 600,
          cursor: checkState === 'checking' ? 'wait' : 'pointer',
          opacity: checkState === 'checking' ? 0.7 : 1,
        }}
      >
        Prove It Works ▶
      </button>

      {checkState === 'checking' && (
        <div style={{ marginTop: 16, fontSize: 12, color: '#909090', fontStyle: 'italic' }}>
          Checking poller health…
        </div>
      )}

      {checkState === 'alive' && (
        <div style={{ marginTop: 16, padding: 12, backgroundColor: 'rgba(100, 200, 150, 0.08)', border: '1px solid rgba(100, 200, 150, 0.3)', borderRadius: 4 }}>
          <div style={{ fontSize: 13, color: '#8bc8a0', lineHeight: 1.5 }}>
            Substrate is alive — poller responding. Use the Ask tab to run a live query.
          </div>
          {checkedAt && (
            <div style={{ fontSize: 10, color: '#606060', marginTop: 8 }}>
              Checked at: {checkedAt}
            </div>
          )}
        </div>
      )}

      {checkState === 'offline' && (
        <div style={{ marginTop: 16, padding: 12, backgroundColor: 'rgba(200, 100, 100, 0.08)', border: '1px solid rgba(200, 100, 100, 0.3)', borderRadius: 4 }}>
          <div style={{ fontSize: 13, color: '#c8a0a0', lineHeight: 1.5 }}>
            Substrate poller not responding. Try starting MnemosyneC&apos;s Ollama integration, then return here.
          </div>
          {checkedAt && (
            <div style={{ fontSize: 10, color: '#606060', marginTop: 8 }}>
              Checked at: {checkedAt}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => onSwitchTab?.('ask')}
        style={{
          marginTop: 20,
          padding: '6px 14px',
          backgroundColor: 'transparent',
          border: '1px solid rgba(100, 200, 150, 0.3)',
          borderRadius: 4,
          color: '#8bc8a0',
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        Ask a question and watch the badge → Ask tab
      </button>
    </div>
  );
}
