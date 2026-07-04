// ModelSetupProgress.tsx -- SEG-U-6 BP078
// Three-phase animated progress display for Ollama model setup.
// Replaces every static "being set up" placeholder.
// feedback_long_running_progress_heartbeat_canon_bp078 binding: static text is NEVER acceptable.

import React, { useState, useEffect, useRef, useCallback } from 'react';

export interface ModelSetupProgressProps {
  /** Ollama model tag to pull, e.g. "gemma4:12b". Pass '' for No-AI path (skips Phase 2). */
  modelName: string;
  onComplete: () => void;
  onError: (err: string) => void;
}

type Phase = 1 | 2 | 3;

// Keyframe CSS injected once at mount time
const KEYFRAMES = `
@keyframes lb-seg-spin { to { transform: rotate(360deg); } }
@keyframes lb-seg-bar { from { opacity: 0.6; } to { opacity: 1; } }
`;

function formatBytes(bytes: number): string {
  const gb = bytes / 1_073_741_824;
  if (gb >= 0.1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / 1_048_576;
  return `${Math.round(mb)} MB`;
}

function estimateTime(remainingBytes: number): string {
  const seconds = remainingBytes / (8 * 1_048_576); // assume ~8 MB/s
  if (seconds < 90) return 'less than 2 minutes';
  const mins = Math.ceil(seconds / 60);
  return `~${mins} minute${mins !== 1 ? 's' : ''}`;
}

// Phase 3 ETA calculation using rolling-average throughput
function calculateETA(
  completed: number,
  total: number,
  samples: Array<{ timestamp: number; bytes: number }>,
  lastEventTime: number
): string {
  if (total === 0 || completed === 0) return 'Calculating...';
  if (samples.length < 2) return 'Calculating...';

  const now = Date.now();
  // Stalled check: no new event for 30s while in downloading phase
  if (now - lastEventTime > 30000) return 'Resuming...';

  // Purge samples older than 5s
  const fiveSecondsAgo = now - 5000;
  const recentSamples = samples.filter((s) => s.timestamp >= fiveSecondsAgo);
  if (recentSamples.length < 2) return 'Calculating...';

  const oldest = recentSamples[0];
  const newest = recentSamples[recentSamples.length - 1];
  const timeDelta = newest.timestamp - oldest.timestamp;
  const bytesDelta = newest.bytes - oldest.bytes;

  if (timeDelta === 0 || bytesDelta <= 0) return 'Calculating...';

  const bytesPerMs = bytesDelta / timeDelta;
  const remainingBytes = total - completed;
  const etaMs = remainingBytes / bytesPerMs;
  const etaSeconds = Math.ceil(etaMs / 1000);

  if (etaSeconds < 60) return '< 1 minute remaining';
  const minutes = Math.floor(etaSeconds / 60);
  if (minutes < 60) return `~${minutes} minute${minutes !== 1 ? 's' : ''} remaining`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `~${hours} hour${hours !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''} remaining`;
}

const S = {
  wrap: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 14,
  },
  phaseLabel: {
    fontSize: 12,
    fontWeight: 700 as const,
    color: '#60a5fa',
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
  },
  spinnerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  spinner: {
    width: 20,
    height: 20,
    border: '2px solid rgba(110,231,183,0.2)',
    borderTopColor: '#6ee7b7',
    borderRadius: '50%',
    flexShrink: 0,
    animation: 'lb-seg-spin 0.8s linear infinite',
  },
  spinnerText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  barTrack: {
    height: 8,
    background: 'rgba(100,116,139,0.15)',
    borderRadius: 4,
    overflow: 'hidden' as const,
  },
  barFill: (pct: number) => ({
    height: '100%',
    width: `${pct}%`,
    background: 'linear-gradient(90deg, #6ee7b7, #34d399)',
    borderRadius: 4,
    transition: 'width 0.4s ease',
    minWidth: pct > 0 ? 8 : 0,
  }),
  barLabel: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 1.5,
  },
  heartbeatText: {
    fontSize: 13,
    color: '#94a3b8',
    fontFamily: 'monospace',
    letterSpacing: '0.02em',
  },
  errorBox: {
    padding: '12px 14px',
    background: 'rgba(127, 29, 29, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.30)',
    borderRadius: 8,
    fontSize: 12,
    color: '#f87171',
    lineHeight: 1.5,
  },
};

const DOT_FRAMES = ['', '.', '..', '...'];

export function ModelSetupProgress({
  modelName,
  onComplete,
  onError,
}: ModelSetupProgressProps): React.ReactElement {
  const [phase, setPhase] = useState<Phase>(1);
  const [pct, setPct] = useState(0);
  const [downloaded, setDownloaded] = useState(0);
  const [total, setTotal] = useState(0);
  const [heartbeat, setHeartbeat] = useState(false);
  const [dotIdx, setDotIdx] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Phase 3 granular progress state
  const [ollamaPhase, setOllamaPhase] = useState<string | null>(null);
  const [layerIndex, setLayerIndex] = useState<number | null>(null);
  const [layerCount, setLayerCount] = useState<number | null>(null);

  // refs prevent stale closure captures in async logic
  const cancelledRef = useRef(false);
  const heartbeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dotIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stable ref for onComplete — prevents useEffect re-run when parent re-renders
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  // Throughput tracking for ETA (rolling 5s window)
  const throughputSamplesRef = useRef<Array<{ timestamp: number; bytes: number }>>([]);
  const lastEventTimeRef = useRef<number>(Date.now());

  const clearTimers = () => {
    if (heartbeatTimerRef.current) { clearTimeout(heartbeatTimerRef.current); heartbeatTimerRef.current = null; }
    if (dotIntervalRef.current) { clearInterval(dotIntervalRef.current); dotIntervalRef.current = null; }
  };

  const startHeartbeat = useCallback(() => {
    setHeartbeat(true);
    dotIntervalRef.current = setInterval(() => {
      setDotIdx((i) => (i + 1) % DOT_FRAMES.length);
    }, 420);
  }, []);

  const stopHeartbeat = useCallback(() => {
    setHeartbeat(false);
    if (dotIntervalRef.current) { clearInterval(dotIntervalRef.current); dotIntervalRef.current = null; }
  }, []);

  const fail = useCallback((msg: string) => {
    clearTimers();
    setErrorMsg(msg);
    onError(msg);
  }, [onError]);

  useEffect(() => {
    cancelledRef.current = false;
    let unsubProgress: (() => void) | null = null;

    const run = async () => {
      // ---- Phase 1: Live pre-flight -- check Ollama reachability + model presence ----
      // SEG-V-1: uses 127.0.0.1 (not localhost) to avoid Windows IPv6 resolution mismatch.
      setPhase(1);

      // No-AI path: skip pull entirely, jump to Phase 3
      if (!modelName) {
        if (cancelledRef.current) return;
        setPhase(3);
        setTimeout(() => { if (!cancelledRef.current) onCompleteRef.current(); }, 1200);
        return;
      }

      let checkResult: { reachable: boolean; hasModel: boolean; models: string[] };
      try {
        checkResult = await window.amplify.checkOllamaAndModel(modelName);
      } catch {
        if (cancelledRef.current) return;
        fail('Could not reach the local AI engine. Please try again.');
        return;
      }

      if (cancelledRef.current) return;

      if (!checkResult.reachable) {
        fail('Could not reach the local AI engine. Check that Ollama is running (ollama.com) and try again.');
        return;
      }

      // Fast path: model already present -- skip pull, no progress bar
      if (checkResult.hasModel) {
        setPhase(3);
        setTimeout(() => { if (!cancelledRef.current) onCompleteRef.current(); }, 1200);
        return;
      }

      // ---- Phase 2: Download model ----
      setPhase(2);
      setPct(0);
      setDownloaded(0);
      setTotal(0);
      setHeartbeat(false);

      // Heartbeat fallback: if no IPC progress events in 5s, animate cycling dots
      heartbeatTimerRef.current = setTimeout(() => {
        if (!cancelledRef.current) startHeartbeat();
      }, 5000);

      // Subscribe to streaming pull progress before invoking pull
      unsubProgress = window.amplify.onOllamaPullProgress((progress) => {
        if (cancelledRef.current) return;
        // Real data arrived -- cancel heartbeat fallback
        if (heartbeatTimerRef.current) {
          clearTimeout(heartbeatTimerRef.current);
          heartbeatTimerRef.current = null;
        }
        stopHeartbeat();

        if (progress.percentComplete !== undefined) setPct(progress.percentComplete);
        if (progress.bytesDownloaded !== undefined) setDownloaded(progress.bytesDownloaded);
        if (progress.totalBytes !== undefined) setTotal(progress.totalBytes);

        // Phase 3 granular progress fields
        if (progress.phase) setOllamaPhase(progress.phase);
        if (progress.layerIndex !== undefined) setLayerIndex(progress.layerIndex);
        if (progress.layerCount !== undefined) setLayerCount(progress.layerCount);

        // Throughput tracking for ETA
        const completed = progress.completed ?? progress.bytesDownloaded ?? 0;
        if (completed > 0) {
          const now = Date.now();
          throughputSamplesRef.current.push({ timestamp: now, bytes: completed });
          lastEventTimeRef.current = now;
          // Keep only last 100 samples (plenty for 5s window)
          if (throughputSamplesRef.current.length > 100) {
            throughputSamplesRef.current = throughputSamplesRef.current.slice(-100);
          }
        }
      });

      // Invoke pull -- this resolves when the pull is complete
      let result: { success: boolean; alreadyInstalled?: boolean; error?: string };
      try {
        result = await window.amplify.pullNamedModel(modelName);
      } catch (err) {
        if (cancelledRef.current) return;
        clearTimers();
        fail(String(err));
        return;
      }

      if (cancelledRef.current) return;
      clearTimers();
      unsubProgress?.();
      unsubProgress = null;

      if (!result.success) {
        fail(result.error ?? 'Model download failed. Please check your connection and try again.');
        return;
      }

      // ---- Phase 3: Finalize ----
      setPhase(3);
      // Brief spinner to signal completion before calling onComplete
      setTimeout(() => {
        if (!cancelledRef.current) onCompleteRef.current();
      }, 1400);
    };

    run();

    return () => {
      cancelledRef.current = true;
      clearTimers();
      unsubProgress?.();
    };
  }, [modelName, fail, startHeartbeat, stopHeartbeat]);

  if (errorMsg) {
    return (
      <div style={S.wrap}>
        <style>{KEYFRAMES}</style>
        <div style={S.errorBox}>{errorMsg}</div>
      </div>
    );
  }

  const displayDots = DOT_FRAMES[dotIdx] ?? '';
  const displayModelLabel = modelName || 'AI engine';

  return (
    <div style={S.wrap}>
      <style>{KEYFRAMES}</style>

      {/* Phase label */}
      <div style={S.phaseLabel}>
        {phase === 1 && 'Step 1 of 3: Checking Ollama installation...'}
        {phase === 2 && `Step 2 of 3: Downloading ${displayModelLabel}`}
        {phase === 3 && 'Step 3 of 3: Setting up FULL tier...'}
      </div>

      {/* Phase 1: animated spinner */}
      {phase === 1 && (
        <div style={S.spinnerRow}>
          <div style={S.spinner} />
          <span style={S.spinnerText}>Checking local AI engine...</span>
        </div>
      )}

      {/* Phase 2: granular 5-element progress UI (download in progress) */}
      {phase === 2 && (
        <>
          {/* Heartbeat fallback: cycling dots when no IPC events have arrived yet */}
          {heartbeat && (
            <div style={S.spinnerRow}>
              <div style={S.spinner} />
              <span style={S.heartbeatText}>
                Downloading {displayModelLabel}{displayDots}
              </span>
            </div>
          )}

          {/* Element 1: Sub-step indicator */}
          {!heartbeat && (
            <div style={S.spinnerText}>
              {!ollamaPhase && 'Connecting...'}
              {ollamaPhase === 'manifest' && 'Step 1 of 5: Connecting to model server'}
              {ollamaPhase === 'downloading' &&
                `Step 2 of 5: Downloading model${layerIndex && layerCount ? ` (layer ${layerIndex} of ${layerCount})` : ''}`}
              {ollamaPhase === 'verifying' && 'Step 3 of 5: Verifying integrity'}
              {ollamaPhase === 'writing' && 'Step 4 of 5: Finalizing'}
              {(ollamaPhase === 'success' || ollamaPhase === 'complete') && 'Step 5 of 5: Complete'}
            </div>
          )}

          {/* Element 2: Progress bar (only when downloading with total > 0) */}
          {!heartbeat && ollamaPhase === 'downloading' && total > 0 && (
            <div style={S.barTrack}>
              <div style={S.barFill(pct)} />
            </div>
          )}

          {/* Element 3 + 4: Bytes counter + ETA (only when downloading with total > 0) */}
          {!heartbeat && ollamaPhase === 'downloading' && total > 0 && (
            <div style={S.barLabel}>
              {formatBytes(downloaded)} of {formatBytes(total)} —{' '}
              {calculateETA(downloaded, total, throughputSamplesRef.current, lastEventTimeRef.current)}
            </div>
          )}

          {/* Spinner for non-downloading phases (manifest, verifying, writing, or no phase yet) */}
          {!heartbeat && (!ollamaPhase || ollamaPhase === 'manifest' || ollamaPhase === 'verifying' || ollamaPhase === 'writing') && (
            <div style={S.spinnerRow}>
              <div style={S.spinner} />
              <span style={S.spinnerText}>Connecting to model repository...</span>
            </div>
          )}
        </>
      )}

      {/* Phase 3: brief finalizing spinner (1.4s transition to onComplete) */}
      {phase === 3 && (
        <div style={S.spinnerRow}>
          <div style={S.spinner} />
          <span style={S.spinnerText}>Finalizing your setup...</span>
        </div>
      )}
    </div>
  );
}

export default ModelSetupProgress;
