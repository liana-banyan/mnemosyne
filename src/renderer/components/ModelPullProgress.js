import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// ModelPullProgress.tsx — SEG-2 v0.1.56
// Progressive auto-pull UI for gemma4:12b when SEG-1 family-match returns null.
// Long-running heartbeat canon: anything >3s shows progress (pull is ~7 GB).
// Every-click-feedback: cancel button is always visible and functional.
// Silence = broken: no silent background download — all state is visible.
import { useCallback, useEffect, useRef, useState } from 'react';
// ── Constants ──────────────────────────────────────────────────────────────────
const FLOOR_PULL_MODEL = 'gemma4:12b';
const MODEL_SIZE_LABEL = 'about 7 GB';
const KEYFRAMES = `@keyframes mpp-spin { to { transform: rotate(360deg); } }`;
const SPEED_WINDOW_MS = 6000;
const HEARTBEAT_INTERVAL_MS = 2000;
const READY_DELAY_MS = 1400;
// ── Helpers ────────────────────────────────────────────────────────────────────
function bytesToGB(bytes) {
    return (bytes / 1073741824).toFixed(2);
}
function formatEta(seconds) {
    if (seconds <= 0 || !isFinite(seconds))
        return '—';
    if (seconds < 60)
        return `${Math.round(seconds)}s`;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
}
function formatSpeed(bytesPerSec) {
    if (bytesPerSec <= 0)
        return '—';
    if (bytesPerSec >= 1048576)
        return `${(bytesPerSec / 1048576).toFixed(1)} MB/s`;
    return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
}
// ── Spinner + Check icons ──────────────────────────────────────────────────────
function Spinner() {
    return (_jsx("span", { style: {
            display: 'inline-block',
            width: 18, height: 18,
            border: '2px solid rgba(110,231,183,0.2)',
            borderTopColor: '#6ee7b7',
            borderRadius: '50%',
            animation: 'mpp-spin 0.8s linear infinite',
            flexShrink: 0,
        } }));
}
function CheckIcon() {
    return (_jsxs("svg", { width: "28", height: "28", viewBox: "0 0 32 32", fill: "none", "aria-hidden": "true", children: [_jsx("circle", { cx: "16", cy: "16", r: "15", fill: "rgba(74,222,128,0.15)", stroke: "#4ade80", strokeWidth: "1.5" }), _jsx("path", { d: "M9 16.5l5 5 9-9", stroke: "#4ade80", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" })] }));
}
// ── Component ──────────────────────────────────────────────────────────────────
export function ModelPullProgress({ onComplete, onSkip }) {
    const [phase, setPhase] = useState('checking');
    const [progress, setProgress] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);
    const [heartbeat, setHeartbeat] = useState('Starting download…');
    const [speed, setSpeed] = useState(0);
    const [eta, setEta] = useState(-1);
    // Prevent double-start
    const pullActiveRef = useRef(false);
    // Speed estimation: circular buffer of (timestamp, bytes) samples
    const speedSamplesRef = useRef([]);
    // ── Speed + ETA computation ─────────────────────────────────────────────────
    const updateSpeedEta = useCallback((downloaded, total) => {
        const now = Date.now();
        const samples = speedSamplesRef.current;
        samples.push({ ts: now, bytes: downloaded });
        // Keep only the last SPEED_WINDOW_MS window
        const cutoff = now - SPEED_WINDOW_MS;
        while (samples.length > 1 && samples[0].ts < cutoff)
            samples.shift();
        if (samples.length >= 2) {
            const oldest = samples[0];
            const newest = samples[samples.length - 1];
            const elapsed = (newest.ts - oldest.ts) / 1000;
            const bytesDelta = newest.bytes - oldest.bytes;
            const bps = elapsed > 0 ? bytesDelta / elapsed : 0;
            setSpeed(bps);
            if (bps > 0 && total > 0) {
                const remaining = total - downloaded;
                setEta(remaining / bps);
            }
        }
    }, []);
    // ── Heartbeat ticker (every 2s) ─────────────────────────────────────────────
    useEffect(() => {
        if (phase !== 'pulling')
            return;
        const BEATS = [
            'Downloading your AI model…',
            'This is a one-time download. It stays on your computer.',
            'gemma4:12b · privacy-first · runs 100% locally.',
            'Almost there — your AI will be ready soon.',
        ];
        let i = 0;
        const id = setInterval(() => {
            i = (i + 1) % BEATS.length;
            setHeartbeat(BEATS[i]);
        }, HEARTBEAT_INTERVAL_MS);
        return () => clearInterval(id);
    }, [phase]);
    // ── Start pull + register IPC listeners ────────────────────────────────────
    const startPull = useCallback(() => {
        if (pullActiveRef.current)
            return () => { };
        pullActiveRef.current = true;
        setPhase('pulling');
        setProgress(null);
        setErrorMsg(null);
        speedSamplesRef.current = [];
        const unsubProgress = window.amplify.firstLaunchModelPull.onProgress((data) => {
            setProgress(data);
            updateSpeedEta(data.downloaded, data.total);
        });
        const unsubComplete = window.amplify.firstLaunchModelPull.onComplete(() => {
            pullActiveRef.current = false;
            setPhase('complete');
            setTimeout(onComplete, READY_DELAY_MS);
        });
        const unsubError = window.amplify.firstLaunchModelPull.onError((err) => {
            pullActiveRef.current = false;
            if (err === 'Download cancelled.') {
                setPhase('cancelled');
            }
            else {
                setErrorMsg(err || 'Model download failed.');
                setPhase('error');
            }
        });
        void window.amplify.firstLaunchModelPull.start(FLOOR_PULL_MODEL).catch((err) => {
            pullActiveRef.current = false;
            setErrorMsg(err instanceof Error ? err.message : 'Could not start model download.');
            setPhase('error');
        });
        return () => {
            unsubProgress();
            unsubComplete();
            unsubError();
        };
    }, [onComplete, updateSpeedEta]);
    // ── On mount: check then pull ───────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        let cleanupPull = null;
        void (async () => {
            try {
                const result = await window.amplify.firstLaunchModelPull.check(FLOOR_PULL_MODEL);
                if (cancelled)
                    return;
                if (result.exists) {
                    setPhase('exists');
                    setTimeout(() => { if (!cancelled)
                        onComplete(); }, READY_DELAY_MS);
                }
                else {
                    cleanupPull = startPull();
                }
            }
            catch {
                if (cancelled)
                    return;
                cleanupPull = startPull();
            }
        })();
        return () => {
            cancelled = true;
            cleanupPull?.();
        };
    }, [onComplete, startPull]);
    // ── Retry handler ────────────────────────────────────────────────────────────
    const handleRetry = useCallback(() => {
        pullActiveRef.current = false;
        speedSamplesRef.current = [];
        setEta(-1);
        setSpeed(0);
        startPull();
    }, [startPull]);
    // ── Cancel handler ───────────────────────────────────────────────────────────
    const handleCancel = useCallback(() => {
        void window.amplify.firstLaunchModelPull.cancel();
    }, []);
    // ── Styles ───────────────────────────────────────────────────────────────────
    const overlay = {
        position: 'fixed', inset: 0, zIndex: 9700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0d1117',
        fontFamily: 'system-ui, -apple-system, sans-serif',
    };
    const card = {
        width: '100%', maxWidth: 480,
        padding: '40px 36px',
        background: '#111827',
        border: '1px solid rgba(100,116,139,0.2)',
        borderRadius: 12,
        margin: '0 16px',
    };
    const brandLine = {
        fontSize: 13, fontWeight: 700, color: '#6ee7b7',
        letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 28,
    };
    const heading = {
        fontSize: 20, fontWeight: 800, color: '#e2e8f0',
        lineHeight: 1.25, margin: '0 0 10px',
    };
    const subText = {
        fontSize: 13, color: '#64748b', lineHeight: 1.7, margin: '0 0 24px',
    };
    const ghostBtn = {
        display: 'block', width: '100%', textAlign: 'center',
        background: 'none', border: 'none', color: '#475569',
        fontSize: 12, cursor: 'pointer', padding: '8px 0 0',
    };
    const cancelBtn = {
        display: 'block', width: '100%',
        background: 'none', border: '1px solid #334155',
        borderRadius: 6, color: '#94a3b8',
        fontSize: 12, cursor: 'pointer', padding: '6px 0',
        marginTop: 12, marginBottom: 4,
        fontFamily: 'system-ui, sans-serif',
    };
    const retryBtn = {
        padding: '10px 20px',
        background: 'rgba(110,231,183,0.13)',
        border: '1px solid rgba(110,231,183,0.4)',
        borderRadius: 8, color: '#6ee7b7',
        fontSize: 13, fontWeight: 700, cursor: 'pointer',
        marginBottom: 10, width: '100%',
        fontFamily: 'system-ui, sans-serif',
    };
    const progressTrack = {
        height: 6, background: 'rgba(110,231,183,0.2)',
        borderRadius: 3, overflow: 'hidden', marginBottom: 8,
    };
    // ── Render phases ─────────────────────────────────────────────────────────────
    if (phase === 'checking') {
        return (_jsxs(_Fragment, { children: [_jsx("style", { children: KEYFRAMES }), _jsx("div", { style: overlay, children: _jsxs("div", { style: { ...card, textAlign: 'center' }, children: [_jsx("div", { style: brandLine, children: "MnemosyneC" }), _jsx("div", { style: { display: 'flex', justifyContent: 'center', marginBottom: 16 }, children: _jsx(Spinner, {}) }), _jsxs("p", { style: { ...subText, marginBottom: 0 }, children: ["Checking for ", FLOOR_PULL_MODEL, "\u2026"] })] }) })] }));
    }
    if (phase === 'exists') {
        return (_jsx("div", { style: overlay, children: _jsxs("div", { style: { ...card, textAlign: 'center' }, children: [_jsx("div", { style: brandLine, children: "MnemosyneC" }), _jsx("div", { style: { display: 'flex', justifyContent: 'center', marginBottom: 14 }, children: _jsx(CheckIcon, {}) }), _jsxs("p", { style: { ...subText, color: '#94a3b8', marginBottom: 0 }, children: [FLOOR_PULL_MODEL, " is ready \u2014 no download needed."] })] }) }));
    }
    if (phase === 'complete') {
        return (_jsx("div", { style: overlay, children: _jsxs("div", { style: { ...card, textAlign: 'center' }, children: [_jsx("div", { style: brandLine, children: "MnemosyneC" }), _jsx("div", { style: { display: 'flex', justifyContent: 'center', marginBottom: 14 }, children: _jsx(CheckIcon, {}) }), _jsx("p", { style: { ...subText, color: '#94a3b8', marginBottom: 0 }, children: "Model ready. Starting your AI\u2026" })] }) }));
    }
    if (phase === 'cancelled') {
        return (_jsx("div", { style: overlay, children: _jsxs("div", { style: card, children: [_jsx("div", { style: brandLine, children: "MnemosyneC" }), _jsx("h2", { style: { ...heading, color: '#94a3b8' }, children: "Download cancelled" }), _jsx("p", { style: subText, children: "You can retry the download or skip for now. The model is needed for AI features." }), _jsx("button", { type: "button", style: retryBtn, onClick: handleRetry, children: "Retry download" }), _jsx("button", { type: "button", style: ghostBtn, onClick: onSkip, children: "Skip for now" })] }) }));
    }
    if (phase === 'error') {
        return (_jsx("div", { style: overlay, children: _jsxs("div", { style: card, children: [_jsx("div", { style: brandLine, children: "MnemosyneC" }), _jsx("h2", { style: { ...heading, marginBottom: 10 }, children: "Download failed" }), _jsx("div", { style: {
                            background: 'rgba(239,68,68,0.08)',
                            border: '1px solid rgba(239,68,68,0.25)',
                            borderRadius: 8, padding: '12px 14px', marginBottom: 20,
                            fontSize: 13, color: '#fca5a5', lineHeight: 1.6,
                        }, children: errorMsg ?? 'Model download failed. Check your connection and try again.' }), _jsx("button", { type: "button", style: retryBtn, onClick: handleRetry, children: "Retry" }), _jsx("button", { type: "button", style: ghostBtn, onClick: onSkip, children: "Skip for now" })] }) }));
    }
    // ── Pulling phase ─────────────────────────────────────────────────────────────
    const pct = progress?.percent ?? 0;
    const showUnknownTotal = !progress || progress.total <= 0;
    const downloadedGB = progress && progress.downloaded > 0 ? bytesToGB(progress.downloaded) : '0.00';
    const totalGB = showUnknownTotal ? '?' : bytesToGB(progress?.total ?? 0);
    return (_jsxs(_Fragment, { children: [_jsx("style", { children: KEYFRAMES }), _jsx("div", { style: overlay, children: _jsxs("div", { style: card, children: [_jsx("div", { style: brandLine, children: "MnemosyneC" }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }, children: [_jsx(Spinner, {}), _jsx("h2", { style: { ...heading, margin: 0 }, children: "Downloading your AI model" })] }), _jsxs("p", { style: subText, children: [FLOOR_PULL_MODEL, " \u00B7 ", MODEL_SIZE_LABEL, ". One-time download \u2014 stays on your computer."] }), _jsx("div", { style: progressTrack, children: _jsx("div", { style: {
                                    height: '100%',
                                    width: showUnknownTotal ? '0%' : `${pct}%`,
                                    background: '#6ee7b7',
                                    borderRadius: 3,
                                    transition: 'width 0.4s ease',
                                } }) }), _jsxs("div", { style: {
                                display: 'flex', justifyContent: 'space-between',
                                alignItems: 'center', marginBottom: 6,
                                fontSize: 12, color: '#64748b',
                            }, children: [_jsxs("span", { children: [downloadedGB, " GB / ", showUnknownTotal ? '~7 GB' : `${totalGB} GB`] }), _jsx("span", { children: showUnknownTotal ? '—' : `${pct}%` })] }), speed > 0 && (_jsxs("div", { style: {
                                display: 'flex', justifyContent: 'space-between',
                                fontSize: 11, color: '#475569', marginBottom: 6,
                            }, children: [_jsx("span", { children: formatSpeed(speed) }), eta > 0 && _jsxs("span", { children: ["ETA ", formatEta(eta)] })] })), _jsx("div", { style: { fontSize: 11, color: '#334155', marginBottom: 8, minHeight: 16 }, children: progress?.status ?? heartbeat }), _jsx("button", { type: "button", style: cancelBtn, onClick: handleCancel, children: "Cancel download" }), _jsx("button", { type: "button", style: ghostBtn, onClick: onSkip, children: "Skip for now" })] }) })] }));
}
export default ModelPullProgress;
