// BrainSwapSelector.tsx -- MnemosyneC Brain Swap UI
// Pluggable cognitive core hot-swappable selector per canon_mnemo_brain_swap_pluggable_cognitive_core_hot_swappable_bp085
// No em-dashes. TypeScript strict. Matches existing component conventions.

import React, { useState, useEffect } from 'react';

interface BrainEntry {
  brain_id: string;
  vendor: string;
  model_id: string;
  kind: 'flagship' | 'local';
  api_endpoint: string;
  cost_per_1k_tokens: number;
  capability_tier: number;
  status: 'available' | 'unavailable' | 'unknown';
}

interface BrainRegistryListResult {
  ok: boolean;
  brains?: BrainEntry[];
  active_brain_id?: string;
  error?: string;
}

interface BrainSmokeTestResult {
  ok: boolean;
  content?: string;
  brain_id?: string;
  kind?: string;
  latency_ms?: number;
  error?: string;
}

function formatCost(cost: number): string {
  if (cost === 0) return '$0.00/1k (free)';
  return `$${cost.toFixed(4)}/1k tokens`;
}

export const BrainSwapSelector: React.FC = () => {
  const [brains, setBrains] = useState<BrainEntry[]>([]);
  const [activeBrainId, setActiveBrainId] = useState<string>('claude-sonnet-4-6');
  const [runtimeBrainId, setRuntimeBrainId] = useState<string>('claude-sonnet-4-6');
  const [selectedBrainId, setSelectedBrainId] = useState<string>('claude-sonnet-4-6');
  const [smokeResult, setSmokeResult] = useState<string | null>(null);
  const [smokeRunning, setSmokeRunning] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const registry = window.amplify.brainRegistry;
        if (!registry) { setLoading(false); return; }
        const result = await registry.list();
        if (result.ok && Array.isArray(result.brains)) {
          setBrains(result.brains as BrainEntry[]);
        }
        const activeResult = await registry.getActive();
        if (activeResult.ok && activeResult.brain_id) {
          setActiveBrainId(activeResult.brain_id);
          setRuntimeBrainId(activeResult.brain_id);
          setSelectedBrainId(activeResult.brain_id);
        }
      } catch (err) {
        console.error('[BrainSwapSelector] Load error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selectedBrain = brains.find((b) => b.brain_id === selectedBrainId);

  const handleSelect = async (brain_id: string) => {
    setSelectedBrainId(brain_id);
    setSaveError(null);
    setSmokeResult(null);
    try {
      const registry = window.amplify.brainRegistry;
      if (!registry) { setSaveError('Brain registry not available'); return; }
      const result = await registry.setActive(brain_id);
      if (result.ok) {
        setActiveBrainId(brain_id);
      } else {
        setSaveError(result.error ?? 'Failed to save brain selection');
      }
    } catch (err) {
      setSaveError(String(err));
    }
  };

  const handleSmokeTest = async () => {
    if (!selectedBrainId) return;
    setSmokeRunning(true);
    setSmokeResult(null);
    try {
      const registry = window.amplify.brainRegistry;
      if (!registry) { setSmokeResult('ERROR: Brain registry not available'); setSmokeRunning(false); return; }
      const result = await registry.smokeTest(selectedBrainId);
      if (result.ok && result.content) {
        setSmokeResult(`[${result.brain_id} / ${result.kind} / ${result.latency_ms}ms]\n${result.content}`);
      } else {
        setSmokeResult(`ERROR: ${result.error ?? 'No response'}`);
      }
    } catch (err) {
      setSmokeResult(`ERROR: ${String(err)}`);
    } finally {
      setSmokeRunning(false);
    }
  };

  const swapPending = activeBrainId !== runtimeBrainId;

  if (loading) {
    return (
      <div style={styles.container}>
        <p style={styles.loadingText}>Loading brain registry...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h3 style={styles.heading}>Orchestrator Brain</h3>
      <p style={styles.subheading}>Hot-swappable cognitive core. Changes persist on next session start.</p>

      <div style={styles.dropdownRow}>
        <select
          style={styles.select}
          value={selectedBrainId}
          onChange={(e) => { void handleSelect(e.target.value); }}
        >
          {brains.map((b) => (
            <option key={b.brain_id} value={b.brain_id}>
              {b.brain_id} [{b.kind}] -- {formatCost(b.cost_per_1k_tokens)}
            </option>
          ))}
        </select>

        {activeBrainId === selectedBrainId && (
          <span style={styles.activeBadge}>Active</span>
        )}
      </div>

      {selectedBrain && (
        <div style={styles.costLine}>
          <span style={styles.costLabel}>Cost per 1k tokens:</span>
          <span style={styles.costValue}>{formatCost(selectedBrain.cost_per_1k_tokens)}</span>
          <span style={styles.tierLabel}>Tier {selectedBrain.capability_tier}/5</span>
          <span style={styles.vendorLabel}>{selectedBrain.vendor}</span>
          <span style={
            selectedBrain.status === 'available'
              ? styles.statusGreen
              : selectedBrain.status === 'unavailable'
              ? styles.statusRed
              : styles.statusAmber
          }>
            {selectedBrain.status}
          </span>
        </div>
      )}

      {swapPending && (
        <div style={styles.swapBanner}>
          Brain swap will take effect on next session restart.
        </div>
      )}

      {saveError && (
        <div style={styles.errorBanner}>{saveError}</div>
      )}

      <button
        style={smokeRunning ? styles.testButtonDisabled : styles.testButton}
        onClick={() => { void handleSmokeTest(); }}
        disabled={smokeRunning}
      >
        {smokeRunning ? 'Testing...' : 'Test this brain'}
      </button>

      {smokeResult !== null && (
        <pre style={styles.smokeResult}>{smokeResult}</pre>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '16px',
    background: '#1a1a2e',
    borderRadius: '8px',
    border: '1px solid #2d2d4e',
    maxWidth: '560px',
    fontFamily: 'system-ui, sans-serif',
    color: '#e0e0f0',
  },
  heading: {
    margin: '0 0 4px 0',
    fontSize: '15px',
    fontWeight: 600,
    color: '#c0c8ff',
  },
  subheading: {
    margin: '0 0 12px 0',
    fontSize: '12px',
    color: '#888aaa',
  },
  dropdownRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  select: {
    flex: 1,
    background: '#12121e',
    color: '#e0e0f0',
    border: '1px solid #3a3a5e',
    borderRadius: '4px',
    padding: '6px 8px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  activeBadge: {
    background: '#1e3a1e',
    color: '#4cde4c',
    borderRadius: '4px',
    padding: '3px 8px',
    fontSize: '11px',
    fontWeight: 600,
    border: '1px solid #2e5a2e',
    whiteSpace: 'nowrap',
  },
  costLine: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '8px',
    fontSize: '12px',
    flexWrap: 'wrap',
  },
  costLabel: { color: '#888aaa' },
  costValue: { color: '#e0e0f0', fontWeight: 500 },
  tierLabel: {
    background: '#2a2a4e',
    padding: '2px 6px',
    borderRadius: '3px',
    color: '#aac0ff',
  },
  vendorLabel: {
    background: '#2a2a4e',
    padding: '2px 6px',
    borderRadius: '3px',
    color: '#c0aaff',
  },
  statusGreen: { color: '#4cde4c', fontWeight: 600 },
  statusRed: { color: '#de4c4c', fontWeight: 600 },
  statusAmber: { color: '#deaa4c', fontWeight: 600 },
  swapBanner: {
    background: '#2e2a10',
    border: '1px solid #5a4a10',
    color: '#deaa4c',
    borderRadius: '4px',
    padding: '6px 10px',
    fontSize: '12px',
    marginBottom: '8px',
  },
  errorBanner: {
    background: '#2e1010',
    border: '1px solid #5a1010',
    color: '#de6c6c',
    borderRadius: '4px',
    padding: '6px 10px',
    fontSize: '12px',
    marginBottom: '8px',
  },
  testButton: {
    background: '#2a3a6e',
    color: '#c0d0ff',
    border: '1px solid #3a4a8e',
    borderRadius: '4px',
    padding: '7px 14px',
    fontSize: '13px',
    cursor: 'pointer',
    marginBottom: '8px',
  },
  testButtonDisabled: {
    background: '#1a1a3e',
    color: '#666888',
    border: '1px solid #2a2a4e',
    borderRadius: '4px',
    padding: '7px 14px',
    fontSize: '13px',
    cursor: 'not-allowed',
    marginBottom: '8px',
  },
  smokeResult: {
    background: '#12121e',
    border: '1px solid #2d2d4e',
    borderRadius: '4px',
    padding: '10px',
    fontSize: '12px',
    color: '#c0d0c0',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: '200px',
    overflowY: 'auto',
    margin: 0,
  },
  loadingText: {
    color: '#888aaa',
    fontSize: '13px',
  },
};
