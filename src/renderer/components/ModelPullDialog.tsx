// ModelPullDialog — B37 Phase 2
// First-launch model download consent + streaming progress indicator
// Per spec: show download size, require user consent, show disk space check result

import React, { useEffect, useState } from 'react';
import type { ModelPullProgress } from '../amplify.d';

import { FLOOR_MODEL, FLOOR_MODEL_ALIASES } from '../../shared/floor-model';

const DEFAULT_MODEL = FLOOR_MODEL;
const MODEL_SIZE_GB = 1.6;

interface ModelPullDialogProps {
  onComplete: () => void;
  onSkip: () => void;
}

type DialogState = 'consent' | 'disk-check' | 'disk-error' | 'pulling' | 'complete' | 'error';

export const ModelPullDialog: React.FC<ModelPullDialogProps> = ({ onComplete, onSkip }) => {
  const [state, setState] = useState<DialogState>('consent');
  const [progress, setProgress] = useState<ModelPullProgress | null>(null);
  const [diskOk, setDiskOk] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const startPull = async () => {
    setState('disk-check');
    const diskCheck = await window.amplify.checkDiskSpace();
    if (!diskCheck.ok) {
      setState('disk-error');
      return;
    }
    setDiskOk(true);
    setState('pulling');

    const cleanup = window.amplify.onOllamaPullProgress((prog) => {
      setProgress(prog);
      if (prog.status === 'complete') {
        setState('complete');
        cleanup();
      } else if (prog.status === 'error') {
        setError(prog.error ?? 'Unknown error during model pull');
        setState('error');
        cleanup();
      }
    });

    const result = await window.amplify.pullDefaultModel();
    if (result.alreadyInstalled) {
      setState('complete');
      cleanup();
    } else if (!result.success) {
      setError(result.error ?? 'Pull failed');
      setState('error');
      cleanup();
    }
  };

  const progressPercent = progress?.percentComplete ?? 0;
  const bytesGB = progress?.bytesDownloaded
    ? (progress.bytesDownloaded / 1_073_741_824).toFixed(2)
    : '0.00';
  const totalGB = progress?.totalBytes
    ? (progress.totalBytes / 1_073_741_824).toFixed(2)
    : MODEL_SIZE_GB.toFixed(2);

  return (
    <div className="dashboard" style={{ alignItems: 'flex-start', paddingTop: '15vh' }}>
      <div className="dashboard__panel" style={{ maxWidth: 440 }}>
        <div className="dashboard__title">Mnemosyne — Local AI Setup</div>
        <div className="dashboard__subtitle">One-time model download for local inference</div>

        {state === 'consent' && (
          <>
            <div
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8,
                padding: '14px 16px',
                marginBottom: 18,
                fontSize: 13,
                color: 'rgba(255,255,255,0.75)',
                lineHeight: 1.6,
              }}
            >
              <p style={{ marginBottom: 10 }}>
                Mnemosyne uses a local AI model to answer queries without sending
                them to the cloud. This protects your privacy and eliminates per-query costs.
              </p>
              <p>
                <strong style={{ color: 'white' }}>Model:</strong> {DEFAULT_MODEL}
                <br />
                <strong style={{ color: 'white' }}>Size:</strong> ~{MODEL_SIZE_GB} GB
                <br />
                <strong style={{ color: 'white' }}>Disk required:</strong> 6 GB free
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="close-btn"
                style={{ flex: 1, background: 'rgba(22,163,74,0.15)', borderColor: 'rgba(22,163,74,0.4)', color: '#16a34a' }}
                onClick={startPull}
              >
                Download Model (~{MODEL_SIZE_GB} GB)
              </button>
              <button
                className="close-btn"
                style={{ flex: 0, padding: '10px 16px', color: 'rgba(255,255,255,0.4)' }}
                onClick={onSkip}
              >
                Skip
              </button>
            </div>
          </>
        )}

        {state === 'disk-check' && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(255,255,255,0.6)' }}>
            Checking available disk space…
          </div>
        )}

        {state === 'disk-error' && (
          <>
            <div
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8,
                padding: '14px 16px',
                marginBottom: 18,
                color: '#ef4444',
                fontSize: 13,
              }}
            >
              Insufficient disk space. Please free at least 6 GB and try again.
            </div>
            <button className="close-btn" onClick={onSkip}>
              Skip for now
            </button>
          </>
        )}

        {state === 'pulling' && (
          <>
            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: 6,
                }}
              >
                <span>{progress?.status === 'verifying' ? 'Verifying…' : 'Downloading…'}</span>
                <span>{bytesGB} / {totalGB} GB ({progressPercent}%)</span>
              </div>
              <div
                style={{
                  height: 6,
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${progressPercent}%`,
                    background: '#16a34a',
                    borderRadius: 3,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
              Downloading {DEFAULT_MODEL} from Ollama registry…
            </div>
          </>
        )}

        {state === 'complete' && (
          <>
            <div
              style={{
                background: 'rgba(22,163,74,0.1)',
                border: '1px solid rgba(22,163,74,0.3)',
                borderRadius: 8,
                padding: '14px 16px',
                marginBottom: 18,
                color: '#16a34a',
                fontSize: 13,
                textAlign: 'center',
              }}
            >
              🌿 Local model ready. Mnemosyne will now serve queries locally.
            </div>
            <button
              className="close-btn"
              style={{ background: 'rgba(22,163,74,0.15)', borderColor: 'rgba(22,163,74,0.4)', color: '#16a34a' }}
              onClick={onComplete}
            >
              Start Mnemosyne
            </button>
          </>
        )}

        {state === 'error' && (
          <>
            <div
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8,
                padding: '14px 16px',
                marginBottom: 18,
                color: '#ef4444',
                fontSize: 13,
              }}
            >
              Error: {error}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="close-btn" style={{ flex: 1 }} onClick={startPull}>
                Retry
              </button>
              <button className="close-btn" style={{ flex: 0, padding: '10px 16px', color: 'rgba(255,255,255,0.4)' }} onClick={onSkip}>
                Skip
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ModelPullDialog;
