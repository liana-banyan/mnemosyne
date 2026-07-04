// TrialFirePanel.tsx — BP087 Wave 3 SEG-C3
// Trial 02 Mesh Validation UI: 70Q paired Pass A + Pass B
// Uses window.amplify.thunderclap (added to preload by SEG-C2 or equivalent)

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type TrialStatus = 'idle' | 'checking-gates' | 'firing' | 'complete' | 'failed';
type FlagshipTier = 'claude' | 'gemma';

interface CompletePayload {
  accuracy: string;
  receiptPath: string;
  exitCode: number;
}

// Cast to any since thunderclap is added to preload by a separate SEG
function getThunderclap() {
  return (window.amplify as unknown as Record<string, any>).thunderclap as {
    checkGates: () => Promise<{ allGreen: boolean; output: string }>;
    fireTrial02: (opts: { flagshipTier: FlagshipTier }) => Promise<{ status: string; accuracy?: string; receiptPath?: string }>;
    onLog: (cb: (line: string) => void) => void;
    onComplete: (cb: (data: CompletePayload) => void) => void;
    onGatesFailed: (cb: (output: string) => void) => void;
    removeAllListeners: () => void;
  } | undefined;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TrialFirePanel() {
  const [status, setStatus] = useState<TrialStatus>('idle');
  const [logLines, setLogLines] = useState<string[]>([]);
  const [accuracy, setAccuracy] = useState('');
  const [receiptPath, setReceiptPath] = useState('');
  const [flagshipTier, setFlagshipTier] = useState<FlagshipTier>('gemma');
  const [gatesGreen, setGatesGreen] = useState(false);
  const [errorSummary, setErrorSummary] = useState('');

  const logRef = useRef<HTMLPreElement>(null);

  // Auto-scroll log panel on new lines
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logLines]);

  // Wire up thunderclap push events on mount
  useEffect(() => {
    const tc = getThunderclap();
    if (!tc) return;

    tc.onLog((line: string) => {
      setLogLines(prev => [...prev, line.trimEnd()]);
    });

    tc.onComplete((data: CompletePayload) => {
      setAccuracy(data.accuracy);
      setReceiptPath(data.receiptPath ?? '');
      setStatus('complete');
    });

    tc.onGatesFailed((output: string) => {
      setErrorSummary(`Gates check failed:\n${output}`);
      setStatus('failed');
    });

    return () => {
      getThunderclap()?.removeAllListeners();
    };
  }, []);

  const appendLog = (line: string) => {
    setLogLines(prev => [...prev, line]);
  };

  const handleCheckGates = useCallback(async () => {
    const tc = getThunderclap();
    if (!tc) {
      appendLog('[ERROR] thunderclap bridge not available. Preload not wired yet.');
      setGatesGreen(false);
      return;
    }
    setStatus('checking-gates');
    setLogLines([]);
    setGatesGreen(false);
    try {
      const result = await tc.checkGates();
      if (result.allGreen) {
        setGatesGreen(true);
        appendLog('[GATES] All gates GREEN. Ready to fire.');
        setStatus('idle');
      } else {
        setGatesGreen(false);
        setErrorSummary(result.output);
        appendLog('[GATES] One or more gates RED. Resolve before firing.');
        setStatus('failed');
      }
    } catch (e: unknown) {
      setGatesGreen(false);
      setErrorSummary(String(e));
      setStatus('failed');
    }
  }, []);

  const handleFireTrial = useCallback(async () => {
    const tc = getThunderclap();
    if (!tc) {
      appendLog('[ERROR] thunderclap bridge not available.');
      return;
    }
    if (!gatesGreen) return;
    setStatus('firing');
    setLogLines([]);
    setAccuracy('');
    setReceiptPath('');
    setErrorSummary('');
    try {
      await tc.fireTrial02({ flagshipTier });
      // Completion is pushed via onComplete event; status set there
    } catch (e: unknown) {
      setErrorSummary(String(e));
      setStatus('failed');
    }
  }, [flagshipTier, gatesGreen]);

  // ─── Status badge ──────────────────────────────────────────────────────────

  const statusBadge: Record<TrialStatus, { label: string; color: string; bg: string }> = {
    'idle': { label: 'IDLE', color: '#94a3b8', bg: 'rgba(100,116,139,0.1)' },
    'checking-gates': { label: 'CHECKING GATES', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    'firing': { label: 'FIRING', color: '#38bdf8', bg: 'rgba(56,189,248,0.1)' },
    'complete': { label: 'COMPLETE', color: '#6ee7b7', bg: 'rgba(110,231,183,0.1)' },
    'failed': { label: 'FAILED', color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
  };

  const badge = statusBadge[status];

  return (
    <div style={{ padding: '16px 20px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 620, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>Trial 02 Mesh Validation</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 3, lineHeight: 1.5 }}>
              70Q paired Pass A + Pass B
            </div>
          </div>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
            color: badge.color, background: badge.bg,
            border: `1px solid ${badge.color}55`,
            borderRadius: 5, padding: '3px 10px',
          }}>
            {badge.label}
          </span>
        </div>

        {/* Flagship tier selector */}
        <div style={{
          background: 'rgba(15,23,42,0.6)',
          border: '1px solid rgba(100,116,139,0.2)',
          borderRadius: 10, padding: '14px 16px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Flagship Tier
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['gemma', 'claude'] as FlagshipTier[]).map(tier => (
              <label key={tier} style={{
                display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer',
                padding: '7px 14px', borderRadius: 7,
                border: flagshipTier === tier
                  ? `1px solid ${tier === 'claude' ? 'rgba(139,92,246,0.5)' : 'rgba(110,231,183,0.4)'}`
                  : '1px solid rgba(100,116,139,0.2)',
                background: flagshipTier === tier
                  ? (tier === 'claude' ? 'rgba(139,92,246,0.08)' : 'rgba(110,231,183,0.08)')
                  : 'transparent',
              }}>
                <input
                  type="radio"
                  name="flagship-tier"
                  value={tier}
                  checked={flagshipTier === tier}
                  onChange={() => setFlagshipTier(tier)}
                  style={{ accentColor: tier === 'claude' ? '#a78bfa' : '#6ee7b7' }}
                />
                <span style={{
                  fontSize: 12, fontWeight: 600,
                  color: flagshipTier === tier
                    ? (tier === 'claude' ? '#a78bfa' : '#6ee7b7')
                    : '#64748b',
                }}>
                  {tier === 'claude' ? 'Claude (Flagship)' : 'Gemma (Local)'}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={handleCheckGates}
            disabled={status === 'checking-gates' || status === 'firing'}
            style={{
              flex: 1, padding: '9px 0', borderRadius: 7, fontSize: 12, fontWeight: 700,
              cursor: (status === 'checking-gates' || status === 'firing') ? 'not-allowed' : 'pointer',
              border: '1px solid rgba(245,158,11,0.4)',
              background: 'rgba(245,158,11,0.08)', color: '#f59e0b',
              opacity: (status === 'checking-gates' || status === 'firing') ? 0.5 : 1,
            }}
          >
            {status === 'checking-gates' ? 'Checking...' : 'Check Gates'}
          </button>

          <button
            type="button"
            onClick={handleFireTrial}
            disabled={!gatesGreen || status === 'firing' || status === 'checking-gates'}
            title={!gatesGreen ? 'Run Check Gates first' : undefined}
            style={{
              flex: 1, padding: '9px 0', borderRadius: 7, fontSize: 12, fontWeight: 700,
              cursor: (!gatesGreen || status === 'firing' || status === 'checking-gates') ? 'not-allowed' : 'pointer',
              border: `1px solid ${gatesGreen ? 'rgba(110,231,183,0.4)' : 'rgba(100,116,139,0.2)'}`,
              background: gatesGreen ? 'rgba(110,231,183,0.1)' : 'rgba(100,116,139,0.05)',
              color: gatesGreen ? '#6ee7b7' : '#475569',
              opacity: (!gatesGreen || status === 'firing') ? 0.55 : 1,
            }}
          >
            {status === 'firing' ? 'Firing...' : 'Fire Trial 02'}
          </button>
        </div>

        {/* Live log panel */}
        {logLines.length > 0 && (
          <div style={{
            background: 'rgba(8,15,30,0.8)',
            border: '1px solid rgba(100,116,139,0.15)',
            borderRadius: 8, overflow: 'hidden',
          }}>
            <div style={{
              padding: '7px 12px', fontSize: 9, fontWeight: 700, color: '#475569',
              textTransform: 'uppercase', letterSpacing: '0.08em',
              borderBottom: '1px solid rgba(100,116,139,0.1)',
            }}>
              Live Log
            </div>
            <pre
              ref={logRef}
              style={{
                margin: 0, padding: '10px 14px',
                fontFamily: 'monospace', fontSize: 10.5, lineHeight: 1.55,
                color: '#94a3b8', overflowY: 'auto', maxHeight: 400,
                whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              }}
            >
              <code>{logLines.join('\n')}</code>
            </pre>
          </div>
        )}

        {/* Completion block */}
        {status === 'complete' && (
          <div style={{
            background: 'rgba(6,78,59,0.18)',
            border: '1px solid rgba(110,231,183,0.35)',
            borderRadius: 10, padding: '14px 18px',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#6ee7b7', marginBottom: 8 }}>
              Trial 02 Complete
            </div>
            {receiptPath && (
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 5 }}>
                <span style={{ color: '#64748b' }}>Receipt: </span>{receiptPath}
              </div>
            )}
            <div style={{ fontSize: 12, color: '#e2e8f0', marginBottom: 6 }}>
              <span style={{ color: '#64748b' }}>Accuracy: </span>
              <span style={{ fontWeight: 700, color: '#6ee7b7' }}>{accuracy}</span>
            </div>
            <div style={{ fontSize: 10, color: '#475569', fontStyle: 'italic', lineHeight: 1.5 }}>
              Receipt minted. Canon eblet queued for Bishop close-out.
            </div>
          </div>
        )}

        {/* Failure block */}
        {status === 'failed' && errorSummary && (
          <div style={{
            background: 'rgba(127,29,29,0.15)',
            border: '1px solid rgba(248,113,113,0.3)',
            borderRadius: 10, padding: '14px 18px',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#f87171', marginBottom: 8 }}>
              Trial Failed
            </div>
            <pre style={{
              margin: 0, fontFamily: 'monospace', fontSize: 10.5, color: '#fca5a5',
              whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.5,
            }}>
              {errorSummary}
            </pre>
          </div>
        )}

      </div>
    </div>
  );
}
