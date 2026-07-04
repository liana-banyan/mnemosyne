// FirstLaunchModelDownload.tsx -- BP078 Step 1.5
// Inserted between Welcome (Step 1) and Try-it (Step 2) in Bp067FirstRunSpine.
// Checks if the model already exists; if not, pulls it via IPC and shows progress UI.

import React, { useEffect, useState, useCallback, useRef } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ModelPullProgress {
  downloaded: number;   // bytes downloaded
  total: number;        // total bytes (0 if unknown)
  speed?: string;       // e.g. "12.3 MB/s"
  status?: string;      // raw status line from ollama pull
}

export interface FirstLaunchModelDownloadProps {
  modelName: string;           // 'gemma4:12b'
  onModelReady: () => void;    // called when model exists or pull completes
  onSkip: () => void;          // escape hatch (always visible)
}

type Phase =
  | 'checking'      // initial check in flight
  | 'exists'        // model already present -- brief confirmation
  | 'pulling'       // download in progress
  | 'complete'      // pull finished -- brief confirmation
  | 'error';        // pull failed

// ── Helpers ────────────────────────────────────────────────────────────────────

const KEYFRAMES = `@keyframes fldm-spin { to { transform: rotate(360deg); } }`;
const MODEL_SIZE_LABEL = 'about 7 GB';
const READY_DELAY_MS = 1500;

function bytesToGB(bytes: number): string {
  return (bytes / 1_073_741_824).toFixed(1);
}

function progressFraction(downloaded: number, total: number): number {
  if (total <= 0 || downloaded <= 0) return 0;
  return Math.min(downloaded / total, 1);
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function CheckIcon(): React.ReactElement {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="rgba(74,222,128,0.15)" stroke="#4ade80" strokeWidth="1.5" />
      <path d="M9 16.5l5 5 9-9" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export function FirstLaunchModelDownload({
  modelName,
  onModelReady,
  onSkip,
}: FirstLaunchModelDownloadProps): React.ReactElement {
  const [phase, setPhase] = useState<Phase>('checking');
  const [progress, setProgress] = useState<ModelPullProgress | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Track whether a pull is already in flight to avoid double-starting on retry
  const pullActiveRef = useRef(false);

  // ── Start pull + register listeners ─────────────────────────────────────────

  const startPull = useCallback((): (() => void) => {
    if (pullActiveRef.current) return (): void => {};
    pullActiveRef.current = true;

    setPhase('pulling');
    setProgress(null);
    setErrorMsg(null);

    const unsubProgress = window.amplify.firstLaunchModelPull.onProgress(
      (data: ModelPullProgress): void => {
        setProgress(data);
      }
    );

    const unsubComplete = window.amplify.firstLaunchModelPull.onComplete((): void => {
      pullActiveRef.current = false;
      setPhase('complete');
      setTimeout(onModelReady, READY_DELAY_MS);
    });

    const unsubError = window.amplify.firstLaunchModelPull.onError((err: string): void => {
      pullActiveRef.current = false;
      setErrorMsg(err || 'Model download failed.');
      setPhase('error');
    });

    void window.amplify.firstLaunchModelPull.start(modelName).catch((err: unknown): void => {
      pullActiveRef.current = false;
      setErrorMsg(err instanceof Error ? err.message : 'Could not start model download.');
      setPhase('error');
    });

    return (): void => {
      unsubProgress();
      unsubComplete();
      unsubError();
    };
  }, [modelName, onModelReady]);

  // ── On mount: check existence ────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    let cleanupPull: (() => void) | null = null;

    void (async (): Promise<void> => {
      try {
        const result = await window.amplify.firstLaunchModelPull.check(modelName);
        if (cancelled) return;

        if (result.exists) {
          setPhase('exists');
          setTimeout((): void => {
            if (!cancelled) onModelReady();
          }, READY_DELAY_MS);
        } else {
          cleanupPull = startPull();
        }
      } catch {
        if (cancelled) return;
        // If check itself fails, attempt the pull anyway
        cleanupPull = startPull();
      }
    })();

    return (): void => {
      cancelled = true;
      cleanupPull?.();
    };
  }, [modelName, onModelReady, startPull]);

  // ── Retry handler ────────────────────────────────────────────────────────────

  const handleRetry = useCallback((): void => {
    pullActiveRef.current = false;
    startPull();
  }, [startPull]);

  // ── Styles (mirror Bp067FirstRunSpine) ───────────────────────────────────────

  const overlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 9600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0d1117',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  };

  const card: React.CSSProperties = {
    width: '100%',
    maxWidth: 480,
    padding: '40px 36px',
    background: '#111827',
    border: '1px solid rgba(100,116,139,0.2)',
    borderRadius: 12,
    margin: '0 16px',
  };

  const brandLine: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    color: '#6ee7b7',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: 28,
  };

  const heading: React.CSSProperties = {
    fontSize: 20,
    fontWeight: 800,
    color: '#e2e8f0',
    lineHeight: 1.25,
    margin: '0 0 10px',
  };

  const subText: React.CSSProperties = {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 1.7,
    margin: '0 0 24px',
  };

  const ghostBtn: React.CSSProperties = {
    display: 'block',
    width: '100%',
    textAlign: 'center',
    background: 'none',
    border: 'none',
    color: '#475569',
    fontSize: 12,
    cursor: 'pointer',
    padding: '8px 0 0',
  };

  const progressTrack: React.CSSProperties = {
    height: 6,
    background: 'rgba(110,231,183,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  };

  const spinnerStyle: React.CSSProperties = {
    width: 18,
    height: 18,
    border: '2px solid rgba(110,231,183,0.2)',
    borderTopColor: '#6ee7b7',
    borderRadius: '50%',
    animation: 'fldm-spin 0.8s linear infinite',
    display: 'inline-block',
    flexShrink: 0,
  };

  const retryBtn: React.CSSProperties = {
    padding: '10px 20px',
    background: 'rgba(110,231,183,0.13)',
    border: '1px solid rgba(110,231,183,0.4)',
    borderRadius: 8,
    color: '#6ee7b7',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    marginBottom: 10,
    width: '100%',
  };

  // ── Render phases ─────────────────────────────────────────────────────────────

  // Checking
  if (phase === 'checking') {
    return (
      <>
        <style>{KEYFRAMES}</style>
        <div style={overlay}>
          <div style={{ ...card, textAlign: 'center' }}>
            <div style={brandLine}>MnemosyneC</div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <span style={spinnerStyle} />
            </div>
            <p style={{ ...subText, marginBottom: 0 }}>Checking for {modelName}...</p>
          </div>
        </div>
      </>
    );
  }

  // Model already exists
  if (phase === 'exists') {
    return (
      <div style={overlay}>
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={brandLine}>MnemosyneC</div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <CheckIcon />
          </div>
          <p style={{ ...subText, color: '#94a3b8', marginBottom: 0 }}>
            Using your existing {modelName} -- no download needed.
          </p>
        </div>
      </div>
    );
  }

  // Download complete
  if (phase === 'complete') {
    return (
      <div style={overlay}>
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={brandLine}>MnemosyneC</div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <CheckIcon />
          </div>
          <p style={{ ...subText, color: '#94a3b8', marginBottom: 0 }}>
            Model ready. Starting your AI...
          </p>
        </div>
      </div>
    );
  }

  // Error
  if (phase === 'error') {
    return (
      <div style={overlay}>
        <div style={card}>
          <div style={brandLine}>MnemosyneC</div>
          <h2 style={{ ...heading, marginBottom: 10 }}>Download failed</h2>
          <div style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 8,
            padding: '12px 14px',
            marginBottom: 20,
            fontSize: 13,
            color: '#fca5a5',
            lineHeight: 1.6,
          }}>
            {errorMsg ?? 'Model download failed. Check your connection and try again.'}
          </div>
          <button type="button" style={retryBtn} onClick={handleRetry}>
            Retry
          </button>
          <button type="button" style={ghostBtn} onClick={onSkip}>
            Skip for now
          </button>
        </div>
      </div>
    );
  }

  // Pulling (phase === 'pulling')
  const fraction = progress ? progressFraction(progress.downloaded, progress.total) : 0;
  const pct = Math.round(fraction * 100);
  const showUnknownTotal = !progress || progress.total <= 0;

  const downloadedLabel = progress && progress.downloaded > 0
    ? `${bytesToGB(progress.downloaded)} GB`
    : '0.0 GB';

  const totalLabel = showUnknownTotal ? '...' : `${bytesToGB(progress?.total ?? 0)} GB`;

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div style={overlay}>
        <div style={card}>
          <div style={brandLine}>MnemosyneC</div>

          {/* Heading row with spinner */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={spinnerStyle} />
            <h2 style={{ ...heading, margin: 0 }}>Downloading your AI model</h2>
          </div>

          <p style={subText}>
            {modelName} -- {MODEL_SIZE_LABEL}. You can browse Liana Banyan while this runs.
          </p>

          {/* Progress bar */}
          <div style={progressTrack}>
            <div style={{
              height: '100%',
              width: showUnknownTotal ? '0%' : `${pct}%`,
              background: '#6ee7b7',
              borderRadius: 3,
              transition: 'width 0.4s ease',
            }} />
          </div>

          {/* GB display + percent */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
            fontSize: 12,
            color: '#64748b',
          }}>
            <span>
              {downloadedLabel} / {showUnknownTotal ? '?' : totalLabel}
            </span>
            <span>
              {showUnknownTotal ? '?' : `${pct}%`}
            </span>
          </div>

          {/* Speed */}
          {progress?.speed && (
            <div style={{ fontSize: 11, color: '#475569', marginBottom: 6 }}>
              {progress.speed}
            </div>
          )}

          {/* Raw status line from ollama */}
          {progress?.status && (
            <div style={{ fontSize: 10, color: '#334155', marginBottom: 16, lineHeight: 1.5 }}>
              {progress.status}
            </div>
          )}

          {/* Always-visible skip escape hatch */}
          <button type="button" style={ghostBtn} onClick={onSkip}>
            Skip for now
          </button>
        </div>
      </div>
    </>
  );
}

export default FirstLaunchModelDownload;
