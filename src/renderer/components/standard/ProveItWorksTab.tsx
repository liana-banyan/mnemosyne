// SEG-K23-D — Prove It Works: honest poller health check (Truth-Always §2)

import React, { useState, useCallback } from 'react';

export interface ProveItWorksTabProps {
  onFirstComplete?: () => void;
  onSwitchTab?: (tab: string) => void;
}

type CheckState = 'idle' | 'checking' | 'alive' | 'offline';

export function ProveItWorksTab(props: ProveItWorksTabProps) {
  const { onFirstComplete, onSwitchTab } = props;
  const [checkState, setCheckState] = useState<CheckState>('idle');
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [hasCompleted, setHasCompleted] = useState(false);

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
      <div style={{ fontSize: 11, color: '#707070', marginBottom: 20, lineHeight: 1.5 }}>
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
        Run a live query → Ask tab
      </button>
    </div>
  );
}
