import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// FirstLaunchModelDownload.tsx -- BP078 Step 1.5
// Inserted between Welcome (Step 1) and Try-it (Step 2) in Bp067FirstRunSpine.
// Checks if the model already exists; if not, pulls it via IPC and shows progress UI.
import { useEffect, useState, useCallback, useRef } from 'react';
// ── Helpers ────────────────────────────────────────────────────────────────────
const KEYFRAMES = `@keyframes fldm-spin { to { transform: rotate(360deg); } }`;
const MODEL_SIZE_LABEL = 'about 7 GB';
const READY_DELAY_MS = 1500;
function bytesToGB(bytes) {
    return (bytes / 1073741824).toFixed(1);
}
function progressFraction(downloaded, total) {
    if (total <= 0 || downloaded <= 0)
        return 0;
    return Math.min(downloaded / total, 1);
}
// ── Sub-components ─────────────────────────────────────────────────────────────
function CheckIcon() {
    return (_jsxs("svg", { width: "28", height: "28", viewBox: "0 0 32 32", fill: "none", "aria-hidden": "true", children: [_jsx("circle", { cx: "16", cy: "16", r: "15", fill: "rgba(74,222,128,0.15)", stroke: "#4ade80", strokeWidth: "1.5" }), _jsx("path", { d: "M9 16.5l5 5 9-9", stroke: "#4ade80", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" })] }));
}
// ── Component ──────────────────────────────────────────────────────────────────
export function FirstLaunchModelDownload({ modelName, onModelReady, onSkip, }) {
    const [phase, setPhase] = useState('checking');
    const [progress, setProgress] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);
    // Track whether a pull is already in flight to avoid double-starting on retry
    const pullActiveRef = useRef(false);
    // ── Start pull + register listeners ─────────────────────────────────────────
    const startPull = useCallback(() => {
        if (pullActiveRef.current)
            return () => { };
        pullActiveRef.current = true;
        setPhase('pulling');
        setProgress(null);
        setErrorMsg(null);
        const unsubProgress = window.amplify.firstLaunchModelPull.onProgress((data) => {
            setProgress(data);
        });
        const unsubComplete = window.amplify.firstLaunchModelPull.onComplete(() => {
            pullActiveRef.current = false;
            setPhase('complete');
            setTimeout(onModelReady, READY_DELAY_MS);
        });
        const unsubError = window.amplify.firstLaunchModelPull.onError((err) => {
            pullActiveRef.current = false;
            setErrorMsg(err || 'Model download failed.');
            setPhase('error');
        });
        void window.amplify.firstLaunchModelPull.start(modelName).catch((err) => {
            pullActiveRef.current = false;
            setErrorMsg(err instanceof Error ? err.message : 'Could not start model download.');
            setPhase('error');
        });
        return () => {
            unsubProgress();
            unsubComplete();
            unsubError();
        };
    }, [modelName, onModelReady]);
    // ── On mount: check existence ────────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        let cleanupPull = null;
        void (async () => {
            try {
                const result = await window.amplify.firstLaunchModelPull.check(modelName);
                if (cancelled)
                    return;
                if (result.exists) {
                    setPhase('exists');
                    setTimeout(() => {
                        if (!cancelled)
                            onModelReady();
                    }, READY_DELAY_MS);
                }
                else {
                    cleanupPull = startPull();
                }
            }
            catch {
                if (cancelled)
                    return;
                // If check itself fails, attempt the pull anyway
                cleanupPull = startPull();
            }
        })();
        return () => {
            cancelled = true;
            cleanupPull?.();
        };
    }, [modelName, onModelReady, startPull]);
    // ── Retry handler ────────────────────────────────────────────────────────────
    const handleRetry = useCallback(() => {
        pullActiveRef.current = false;
        startPull();
    }, [startPull]);
    // ── Styles (mirror Bp067FirstRunSpine) ───────────────────────────────────────
    const overlay = {
        position: 'fixed',
        inset: 0,
        zIndex: 9600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0d1117',
        fontFamily: 'system-ui, -apple-system, sans-serif',
    };
    const card = {
        width: '100%',
        maxWidth: 480,
        padding: '40px 36px',
        background: '#111827',
        border: '1px solid rgba(100,116,139,0.2)',
        borderRadius: 12,
        margin: '0 16px',
    };
    const brandLine = {
        fontSize: 13,
        fontWeight: 700,
        color: '#6ee7b7',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        marginBottom: 28,
    };
    const heading = {
        fontSize: 20,
        fontWeight: 800,
        color: '#e2e8f0',
        lineHeight: 1.25,
        margin: '0 0 10px',
    };
    const subText = {
        fontSize: 13,
        color: '#64748b',
        lineHeight: 1.7,
        margin: '0 0 24px',
    };
    const ghostBtn = {
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
    const progressTrack = {
        height: 6,
        background: 'rgba(110,231,183,0.2)',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 10,
    };
    const spinnerStyle = {
        width: 18,
        height: 18,
        border: '2px solid rgba(110,231,183,0.2)',
        borderTopColor: '#6ee7b7',
        borderRadius: '50%',
        animation: 'fldm-spin 0.8s linear infinite',
        display: 'inline-block',
        flexShrink: 0,
    };
    const retryBtn = {
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
        return (_jsxs(_Fragment, { children: [_jsx("style", { children: KEYFRAMES }), _jsx("div", { style: overlay, children: _jsxs("div", { style: { ...card, textAlign: 'center' }, children: [_jsx("div", { style: brandLine, children: "MnemosyneC" }), _jsx("div", { style: { display: 'flex', justifyContent: 'center', marginBottom: 16 }, children: _jsx("span", { style: spinnerStyle }) }), _jsxs("p", { style: { ...subText, marginBottom: 0 }, children: ["Checking for ", modelName, "..."] })] }) })] }));
    }
    // Model already exists
    if (phase === 'exists') {
        return (_jsx("div", { style: overlay, children: _jsxs("div", { style: { ...card, textAlign: 'center' }, children: [_jsx("div", { style: brandLine, children: "MnemosyneC" }), _jsx("div", { style: { display: 'flex', justifyContent: 'center', marginBottom: 14 }, children: _jsx(CheckIcon, {}) }), _jsxs("p", { style: { ...subText, color: '#94a3b8', marginBottom: 0 }, children: ["Using your existing ", modelName, " -- no download needed."] })] }) }));
    }
    // Download complete
    if (phase === 'complete') {
        return (_jsx("div", { style: overlay, children: _jsxs("div", { style: { ...card, textAlign: 'center' }, children: [_jsx("div", { style: brandLine, children: "MnemosyneC" }), _jsx("div", { style: { display: 'flex', justifyContent: 'center', marginBottom: 14 }, children: _jsx(CheckIcon, {}) }), _jsx("p", { style: { ...subText, color: '#94a3b8', marginBottom: 0 }, children: "Model ready. Starting your AI..." })] }) }));
    }
    // Error
    if (phase === 'error') {
        return (_jsx("div", { style: overlay, children: _jsxs("div", { style: card, children: [_jsx("div", { style: brandLine, children: "MnemosyneC" }), _jsx("h2", { style: { ...heading, marginBottom: 10 }, children: "Download failed" }), _jsx("div", { style: {
                            background: 'rgba(239,68,68,0.08)',
                            border: '1px solid rgba(239,68,68,0.25)',
                            borderRadius: 8,
                            padding: '12px 14px',
                            marginBottom: 20,
                            fontSize: 13,
                            color: '#fca5a5',
                            lineHeight: 1.6,
                        }, children: errorMsg ?? 'Model download failed. Check your connection and try again.' }), _jsx("button", { type: "button", style: retryBtn, onClick: handleRetry, children: "Retry" }), _jsx("button", { type: "button", style: ghostBtn, onClick: onSkip, children: "Skip for now" })] }) }));
    }
    // Pulling (phase === 'pulling')
    const fraction = progress ? progressFraction(progress.downloaded, progress.total) : 0;
    const pct = Math.round(fraction * 100);
    const showUnknownTotal = !progress || progress.total <= 0;
    const downloadedLabel = progress && progress.downloaded > 0
        ? `${bytesToGB(progress.downloaded)} GB`
        : '0.0 GB';
    const totalLabel = showUnknownTotal ? '...' : `${bytesToGB(progress?.total ?? 0)} GB`;
    return (_jsxs(_Fragment, { children: [_jsx("style", { children: KEYFRAMES }), _jsx("div", { style: overlay, children: _jsxs("div", { style: card, children: [_jsx("div", { style: brandLine, children: "MnemosyneC" }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }, children: [_jsx("span", { style: spinnerStyle }), _jsx("h2", { style: { ...heading, margin: 0 }, children: "Downloading your AI model" })] }), _jsxs("p", { style: subText, children: [modelName, " -- ", MODEL_SIZE_LABEL, ". You can browse Liana Banyan while this runs."] }), _jsx("div", { style: progressTrack, children: _jsx("div", { style: {
                                    height: '100%',
                                    width: showUnknownTotal ? '0%' : `${pct}%`,
                                    background: '#6ee7b7',
                                    borderRadius: 3,
                                    transition: 'width 0.4s ease',
                                } }) }), _jsxs("div", { style: {
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 10,
                                fontSize: 12,
                                color: '#64748b',
                            }, children: [_jsxs("span", { children: [downloadedLabel, " / ", showUnknownTotal ? '?' : totalLabel] }), _jsx("span", { children: showUnknownTotal ? '?' : `${pct}%` })] }), progress?.speed && (_jsx("div", { style: { fontSize: 11, color: '#475569', marginBottom: 6 }, children: progress.speed })), progress?.status && (_jsx("div", { style: { fontSize: 10, color: '#334155', marginBottom: 16, lineHeight: 1.5 }, children: progress.status })), _jsx("button", { type: "button", style: ghostBtn, onClick: onSkip, children: "Skip for now" })] }) })] }));
}
export default FirstLaunchModelDownload;
