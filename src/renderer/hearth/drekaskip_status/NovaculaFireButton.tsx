// BP041 — Novacula Fire Button
// Member-replicable dispatch of the K533 canonical test #1 payload
// POST → http://127.0.0.1:11480/yoke/wave/dispatch

import { useState } from 'react';

interface DispatchResponse {
  wave_id: string;
  status?: string;
  [key: string]: unknown;
}

type FireState = 'idle' | 'loading' | 'success' | 'error';

export function NovaculaFireButton() {
  const [fireState, setFireState] = useState<FireState>('idle');
  const [waveId, setWaveId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleFire = async () => {
    setFireState('loading');
    setWaveId(null);
    setErrorMsg(null);

    try {
      const payloadResp = await fetch('/canonical/novacula/bp041_empirical_proof.json');
      if (!payloadResp.ok) {
        throw new Error(`Failed to load canonical payload: HTTP ${payloadResp.status}`);
      }
      const payload = await payloadResp.json();

      const dispatchResp = await fetch('http://127.0.0.1:11480/yoke/wave/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anchor:              payload.anchor,
          segs:                payload.segs,
          synthesis_prompt:    payload.synthesis_prompt,
          synthesis_recipient: payload.synthesis_recipient,
          // Layer 1 — Adaptive Concurrency Carrier: work-plan declaration
          seg_count_target:    payload.seg_count_target,
          acceptable_min:      payload.acceptable_min,
        }),
      });

      if (!dispatchResp.ok) {
        const errText = await dispatchResp.text();
        throw new Error(`Dispatch failed (HTTP ${dispatchResp.status}): ${errText.slice(0, 200)}`);
      }

      const result: DispatchResponse = await dispatchResp.json();
      const id = result.wave_id ?? result.id ?? JSON.stringify(result).slice(0, 40);
      setWaveId(String(id));
      setFireState('success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setFireState('error');
    }
  };

  const isInFlight = fireState === 'loading';

  return (
    <div style={styles.wrapper}>
      {/* Main fire button */}
      <button
        style={{
          ...styles.fireBtn,
          opacity: isInFlight ? 0.65 : 1,
          cursor: isInFlight ? 'not-allowed' : 'pointer',
        }}
        onClick={handleFire}
        disabled={isInFlight}
        title="Fire BP041 Empirical Proof Novacula — K533 canonical test #1"
      >
        {isInFlight ? (
          <>⏳ Firing Novacula…</>
        ) : (
          <>🌊 FIRE NOVACULA: BP041 Empirical Proof</>
        )}
      </button>

      {/* Subtitle */}
      <div style={styles.subtitle}>
        24 SEGs · adaptive concurrency · member-replicable · K533 canonical test #1
      </div>

      {/* Success state */}
      {fireState === 'success' && waveId && (
        <div style={styles.successBox}>
          <span style={styles.successIcon}>✅</span>
          <span>
            <b>Wave dispatched:</b>{' '}
            <code style={styles.waveIdCode}>{waveId}</code>
          </span>
          <span style={styles.watchCta}>Watch live in Drekaskip panel below ↓</span>
        </div>
      )}

      {/* Error state */}
      {fireState === 'error' && errorMsg && (
        <div style={styles.errorBox}>
          <span style={styles.errorIcon}>⚠</span>
          <span style={styles.errorText}>{errorMsg}</span>
        </div>
      )}

      {/* What is this? expandable */}
      <div style={styles.detailsRow}>
        <button
          style={styles.detailsToggle}
          onClick={() => setShowDetails((v) => !v)}
        >
          {showDetails ? '▾ Hide details' : '▸ What is this?'}
        </button>
      </div>

      {showDetails && (
        <div style={styles.detailsBox}>
          <p style={styles.detailsPara}>
            This button fires the <b>K533 Reproducibility Pack canonical test #1</b>. It loads a
            deterministic 24-SEG payload from the bundled canonical store and dispatches it through
            AMPLIFY's Yoke wave engine at port 11480.
          </p>
          <p style={styles.detailsPara}>
            <b>Verification steps:</b> After dispatch, watch the 24 SEGs progress in the Drekaskip
            panel below. When complete, compare the synthesis content hash and SEG count to the
            published canonical at{' '}
            <code style={styles.inlineCode}>canonical_hashes/bp041_empirical_proof.json</code>
            . Zero errors + matching hash = empirical proof of member-replicability.
          </p>
          <p style={styles.detailsPara}>
            Payload SHA-256:{' '}
            <code style={styles.inlineCode}>
              e6b56c85…afa29e3b
            </code>
          </p>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    padding: '0.6rem 0.75rem',
    background: '#0d1a2e',
    border: '1px solid #1e3a5f',
    borderRadius: '8px',
    marginBottom: '0.5rem',
  },
  fireBtn: {
    background: 'linear-gradient(135deg, #1e3a5f 0%, #0f4c75 100%)',
    border: '1.5px solid #3b82f6',
    borderRadius: '6px',
    color: '#e2e8f0',
    fontWeight: 700,
    fontSize: '0.9rem',
    padding: '0.6rem 1rem',
    textAlign: 'left',
    letterSpacing: '0.02em',
    transition: 'box-shadow 0.15s',
    boxShadow: '0 0 8px rgba(59,130,246,0.25)',
  },
  subtitle: {
    fontSize: '0.68rem',
    color: '#63b3ed',
    letterSpacing: '0.03em',
  },
  successBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
    background: '#0d2d1a',
    border: '1px solid #22c55e',
    borderRadius: '5px',
    padding: '0.4rem 0.6rem',
    fontSize: '0.75rem',
    color: '#86efac',
  },
  successIcon: { fontSize: '0.8rem' },
  waveIdCode: {
    fontFamily: 'monospace',
    fontSize: '0.7rem',
    background: '#0a1f10',
    padding: '1px 4px',
    borderRadius: '3px',
    wordBreak: 'break-all',
  },
  watchCta: {
    color: '#4ade80',
    fontStyle: 'italic',
    fontSize: '0.68rem',
  },
  errorBox: {
    display: 'flex',
    gap: '0.4rem',
    alignItems: 'flex-start',
    background: '#1a0a0a',
    border: '1px solid #ef4444',
    borderRadius: '5px',
    padding: '0.4rem 0.6rem',
    fontSize: '0.72rem',
    color: '#fca5a5',
  },
  errorIcon: { flexShrink: 0, fontSize: '0.8rem' },
  errorText: { wordBreak: 'break-word' },
  detailsRow: { display: 'flex' },
  detailsToggle: {
    background: 'none',
    border: 'none',
    color: '#4a5568',
    cursor: 'pointer',
    fontSize: '0.65rem',
    padding: 0,
  },
  detailsBox: {
    background: '#090f1a',
    border: '1px solid #1e2d40',
    borderRadius: '5px',
    padding: '0.5rem 0.6rem',
    fontSize: '0.7rem',
    color: '#a0aec0',
  },
  detailsPara: { margin: '0 0 0.35rem' },
  inlineCode: {
    fontFamily: 'monospace',
    fontSize: '0.65rem',
    background: '#0f1620',
    padding: '1px 3px',
    borderRadius: '3px',
  },
};
