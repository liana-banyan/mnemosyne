import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// ModelSetupProgress.tsx -- SEG-U-6 BP078
// Three-phase animated progress display for Ollama model setup.
// Replaces every static "being set up" placeholder.
// feedback_long_running_progress_heartbeat_canon_bp078 binding: static text is NEVER acceptable.
import { useState, useEffect, useRef, useCallback } from 'react';
// Keyframe CSS injected once at mount time
const KEYFRAMES = `
@keyframes lb-seg-spin { to { transform: rotate(360deg); } }
@keyframes lb-seg-bar { from { opacity: 0.6; } to { opacity: 1; } }
`;
function formatBytes(bytes) {
    const gb = bytes / 1073741824;
    if (gb >= 0.1)
        return `${gb.toFixed(1)} GB`;
    const mb = bytes / 1048576;
    return `${Math.round(mb)} MB`;
}
function estimateTime(remainingBytes) {
    const seconds = remainingBytes / (8 * 1048576); // assume ~8 MB/s
    if (seconds < 90)
        return 'less than 2 minutes';
    const mins = Math.ceil(seconds / 60);
    return `~${mins} minute${mins !== 1 ? 's' : ''}`;
}
// Phase 3 ETA calculation using rolling-average throughput
function calculateETA(completed, total, samples, lastEventTime) {
    if (total === 0 || completed === 0)
        return 'Calculating...';
    if (samples.length < 2)
        return 'Calculating...';
    const now = Date.now();
    // Stalled check: no new event for 30s while in downloading phase
    if (now - lastEventTime > 30000)
        return 'Resuming...';
    // Purge samples older than 5s
    const fiveSecondsAgo = now - 5000;
    const recentSamples = samples.filter((s) => s.timestamp >= fiveSecondsAgo);
    if (recentSamples.length < 2)
        return 'Calculating...';
    const oldest = recentSamples[0];
    const newest = recentSamples[recentSamples.length - 1];
    const timeDelta = newest.timestamp - oldest.timestamp;
    const bytesDelta = newest.bytes - oldest.bytes;
    if (timeDelta === 0 || bytesDelta <= 0)
        return 'Calculating...';
    const bytesPerMs = bytesDelta / timeDelta;
    const remainingBytes = total - completed;
    const etaMs = remainingBytes / bytesPerMs;
    const etaSeconds = Math.ceil(etaMs / 1000);
    if (etaSeconds < 60)
        return '< 1 minute remaining';
    const minutes = Math.floor(etaSeconds / 60);
    if (minutes < 60)
        return `~${minutes} minute${minutes !== 1 ? 's' : ''} remaining`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `~${hours} hour${hours !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''} remaining`;
}
const S = {
    wrap: {
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
    },
    phaseLabel: {
        fontSize: 12,
        fontWeight: 700,
        color: '#60a5fa',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
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
        overflow: 'hidden',
    },
    barFill: (pct) => ({
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
export function ModelSetupProgress({ modelName, onComplete, onError, }) {
    const [phase, setPhase] = useState(1);
    const [pct, setPct] = useState(0);
    const [downloaded, setDownloaded] = useState(0);
    const [total, setTotal] = useState(0);
    const [heartbeat, setHeartbeat] = useState(false);
    const [dotIdx, setDotIdx] = useState(0);
    const [errorMsg, setErrorMsg] = useState(null);
    // Phase 3 granular progress state
    const [ollamaPhase, setOllamaPhase] = useState(null);
    const [layerIndex, setLayerIndex] = useState(null);
    const [layerCount, setLayerCount] = useState(null);
    // refs prevent stale closure captures in async logic
    const cancelledRef = useRef(false);
    const heartbeatTimerRef = useRef(null);
    const dotIntervalRef = useRef(null);
    // Stable ref for onComplete — prevents useEffect re-run when parent re-renders
    const onCompleteRef = useRef(onComplete);
    useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
    // Throughput tracking for ETA (rolling 5s window)
    const throughputSamplesRef = useRef([]);
    const lastEventTimeRef = useRef(Date.now());
    const clearTimers = () => {
        if (heartbeatTimerRef.current) {
            clearTimeout(heartbeatTimerRef.current);
            heartbeatTimerRef.current = null;
        }
        if (dotIntervalRef.current) {
            clearInterval(dotIntervalRef.current);
            dotIntervalRef.current = null;
        }
    };
    const startHeartbeat = useCallback(() => {
        setHeartbeat(true);
        dotIntervalRef.current = setInterval(() => {
            setDotIdx((i) => (i + 1) % DOT_FRAMES.length);
        }, 420);
    }, []);
    const stopHeartbeat = useCallback(() => {
        setHeartbeat(false);
        if (dotIntervalRef.current) {
            clearInterval(dotIntervalRef.current);
            dotIntervalRef.current = null;
        }
    }, []);
    const fail = useCallback((msg) => {
        clearTimers();
        setErrorMsg(msg);
        onError(msg);
    }, [onError]);
    useEffect(() => {
        cancelledRef.current = false;
        let unsubProgress = null;
        const run = async () => {
            // ---- Phase 1: Live pre-flight -- check Ollama reachability + model presence ----
            // SEG-V-1: uses 127.0.0.1 (not localhost) to avoid Windows IPv6 resolution mismatch.
            setPhase(1);
            // No-AI path: skip pull entirely, jump to Phase 3
            if (!modelName) {
                if (cancelledRef.current)
                    return;
                setPhase(3);
                setTimeout(() => { if (!cancelledRef.current)
                    onCompleteRef.current(); }, 1200);
                return;
            }
            let checkResult;
            try {
                checkResult = await window.amplify.checkOllamaAndModel(modelName);
            }
            catch {
                if (cancelledRef.current)
                    return;
                fail('Could not reach the local AI engine. Please try again.');
                return;
            }
            if (cancelledRef.current)
                return;
            if (!checkResult.reachable) {
                fail('Could not reach the local AI engine. Check that Ollama is running (ollama.com) and try again.');
                return;
            }
            // Fast path: model already present -- skip pull, no progress bar
            if (checkResult.hasModel) {
                setPhase(3);
                setTimeout(() => { if (!cancelledRef.current)
                    onCompleteRef.current(); }, 1200);
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
                if (!cancelledRef.current)
                    startHeartbeat();
            }, 5000);
            // Subscribe to streaming pull progress before invoking pull
            unsubProgress = window.amplify.onOllamaPullProgress((progress) => {
                if (cancelledRef.current)
                    return;
                // Real data arrived -- cancel heartbeat fallback
                if (heartbeatTimerRef.current) {
                    clearTimeout(heartbeatTimerRef.current);
                    heartbeatTimerRef.current = null;
                }
                stopHeartbeat();
                if (progress.percentComplete !== undefined)
                    setPct(progress.percentComplete);
                if (progress.bytesDownloaded !== undefined)
                    setDownloaded(progress.bytesDownloaded);
                if (progress.totalBytes !== undefined)
                    setTotal(progress.totalBytes);
                // Phase 3 granular progress fields
                if (progress.phase)
                    setOllamaPhase(progress.phase);
                if (progress.layerIndex !== undefined)
                    setLayerIndex(progress.layerIndex);
                if (progress.layerCount !== undefined)
                    setLayerCount(progress.layerCount);
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
            let result;
            try {
                result = await window.amplify.pullNamedModel(modelName);
            }
            catch (err) {
                if (cancelledRef.current)
                    return;
                clearTimers();
                fail(String(err));
                return;
            }
            if (cancelledRef.current)
                return;
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
                if (!cancelledRef.current)
                    onCompleteRef.current();
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
        return (_jsxs("div", { style: S.wrap, children: [_jsx("style", { children: KEYFRAMES }), _jsx("div", { style: S.errorBox, children: errorMsg })] }));
    }
    const displayDots = DOT_FRAMES[dotIdx] ?? '';
    const displayModelLabel = modelName || 'AI engine';
    return (_jsxs("div", { style: S.wrap, children: [_jsx("style", { children: KEYFRAMES }), _jsxs("div", { style: S.phaseLabel, children: [phase === 1 && 'Step 1 of 3: Checking Ollama installation...', phase === 2 && `Step 2 of 3: Downloading ${displayModelLabel}`, phase === 3 && 'Step 3 of 3: Setting up FULL tier...'] }), phase === 1 && (_jsxs("div", { style: S.spinnerRow, children: [_jsx("div", { style: S.spinner }), _jsx("span", { style: S.spinnerText, children: "Checking local AI engine..." })] })), phase === 2 && (_jsxs(_Fragment, { children: [heartbeat && (_jsxs("div", { style: S.spinnerRow, children: [_jsx("div", { style: S.spinner }), _jsxs("span", { style: S.heartbeatText, children: ["Downloading ", displayModelLabel, displayDots] })] })), !heartbeat && (_jsxs("div", { style: S.spinnerText, children: [!ollamaPhase && 'Connecting...', ollamaPhase === 'manifest' && 'Step 1 of 5: Connecting to model server', ollamaPhase === 'downloading' &&
                                `Step 2 of 5: Downloading model${layerIndex && layerCount ? ` (layer ${layerIndex} of ${layerCount})` : ''}`, ollamaPhase === 'verifying' && 'Step 3 of 5: Verifying integrity', ollamaPhase === 'writing' && 'Step 4 of 5: Finalizing', (ollamaPhase === 'success' || ollamaPhase === 'complete') && 'Step 5 of 5: Complete'] })), !heartbeat && ollamaPhase === 'downloading' && total > 0 && (_jsx("div", { style: S.barTrack, children: _jsx("div", { style: S.barFill(pct) }) })), !heartbeat && ollamaPhase === 'downloading' && total > 0 && (_jsxs("div", { style: S.barLabel, children: [formatBytes(downloaded), " of ", formatBytes(total), " \u2014", ' ', calculateETA(downloaded, total, throughputSamplesRef.current, lastEventTimeRef.current)] })), !heartbeat && (!ollamaPhase || ollamaPhase === 'manifest' || ollamaPhase === 'verifying' || ollamaPhase === 'writing') && (_jsxs("div", { style: S.spinnerRow, children: [_jsx("div", { style: S.spinner }), _jsx("span", { style: S.spinnerText, children: "Connecting to model repository..." })] }))] })), phase === 3 && (_jsxs("div", { style: S.spinnerRow, children: [_jsx("div", { style: S.spinner }), _jsx("span", { style: S.spinnerText, children: "Finalizing your setup..." })] }))] }));
}
export default ModelSetupProgress;
