import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// ModelPullDialog — B37 Phase 2
// First-launch model download consent + streaming progress indicator
// Per spec: show download size, require user consent, show disk space check result
import { useState } from 'react';
import { FLOOR_MODEL } from '../../shared/floor-model';
const DEFAULT_MODEL = FLOOR_MODEL;
const MODEL_SIZE_GB = 1.6;
export const ModelPullDialog = ({ onComplete, onSkip }) => {
    const [state, setState] = useState('consent');
    const [progress, setProgress] = useState(null);
    const [diskOk, setDiskOk] = useState(true);
    const [error, setError] = useState('');
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
            }
            else if (prog.status === 'error') {
                setError(prog.error ?? 'Unknown error during model pull');
                setState('error');
                cleanup();
            }
        });
        const result = await window.amplify.pullDefaultModel();
        if (result.alreadyInstalled) {
            setState('complete');
            cleanup();
        }
        else if (!result.success) {
            setError(result.error ?? 'Pull failed');
            setState('error');
            cleanup();
        }
    };
    const progressPercent = progress?.percentComplete ?? 0;
    const bytesGB = progress?.bytesDownloaded
        ? (progress.bytesDownloaded / 1073741824).toFixed(2)
        : '0.00';
    const totalGB = progress?.totalBytes
        ? (progress.totalBytes / 1073741824).toFixed(2)
        : MODEL_SIZE_GB.toFixed(2);
    return (_jsx("div", { className: "dashboard", style: { alignItems: 'flex-start', paddingTop: '15vh' }, children: _jsxs("div", { className: "dashboard__panel", style: { maxWidth: 440 }, children: [_jsx("div", { className: "dashboard__title", children: "MnemosyneC \u2014 Local AI Setup" }), _jsx("div", { className: "dashboard__subtitle", children: "One-time model download for local inference" }), state === 'consent' && (_jsxs(_Fragment, { children: [_jsxs("div", { style: {
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: 8,
                                padding: '14px 16px',
                                marginBottom: 18,
                                fontSize: 13,
                                color: 'rgba(255,255,255,0.75)',
                                lineHeight: 1.6,
                            }, children: [_jsx("p", { style: { marginBottom: 10 }, children: "MnemosyneC uses a local AI model to answer queries without sending them to the cloud. This protects your privacy and eliminates per-query costs." }), _jsxs("p", { children: [_jsx("strong", { style: { color: 'white' }, children: "Model:" }), " ", DEFAULT_MODEL, _jsx("br", {}), _jsx("strong", { style: { color: 'white' }, children: "Size:" }), " ~", MODEL_SIZE_GB, " GB", _jsx("br", {}), _jsx("strong", { style: { color: 'white' }, children: "Disk required:" }), " 6 GB free"] })] }), _jsxs("div", { style: { display: 'flex', gap: 10 }, children: [_jsxs("button", { className: "close-btn", style: { flex: 1, background: 'rgba(22,163,74,0.15)', borderColor: 'rgba(22,163,74,0.4)', color: '#16a34a' }, onClick: startPull, children: ["Download Model (~", MODEL_SIZE_GB, " GB)"] }), _jsx("button", { className: "close-btn", style: { flex: 0, padding: '10px 16px', color: 'rgba(255,255,255,0.4)' }, onClick: onSkip, children: "Skip" })] })] })), state === 'disk-check' && (_jsx("div", { style: { textAlign: 'center', padding: '20px 0', color: 'rgba(255,255,255,0.6)' }, children: "Checking available disk space\u2026" })), state === 'disk-error' && (_jsxs(_Fragment, { children: [_jsx("div", { style: {
                                background: 'rgba(239,68,68,0.1)',
                                border: '1px solid rgba(239,68,68,0.3)',
                                borderRadius: 8,
                                padding: '14px 16px',
                                marginBottom: 18,
                                color: '#ef4444',
                                fontSize: 13,
                            }, children: "Insufficient disk space. Please free at least 6 GB and try again." }), _jsx("button", { className: "close-btn", onClick: onSkip, children: "Skip for now" })] })), state === 'pulling' && (_jsxs(_Fragment, { children: [_jsxs("div", { style: { marginBottom: 14 }, children: [_jsxs("div", { style: {
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        fontSize: 12,
                                        color: 'rgba(255,255,255,0.5)',
                                        marginBottom: 6,
                                    }, children: [_jsx("span", { children: progress?.status === 'verifying' ? 'Verifying…' : 'Downloading…' }), _jsxs("span", { children: [bytesGB, " / ", totalGB, " GB (", progressPercent, "%)"] })] }), _jsx("div", { style: {
                                        height: 6,
                                        background: 'rgba(255,255,255,0.08)',
                                        borderRadius: 3,
                                        overflow: 'hidden',
                                    }, children: _jsx("div", { style: {
                                            height: '100%',
                                            width: `${progressPercent}%`,
                                            background: '#16a34a',
                                            borderRadius: 3,
                                            transition: 'width 0.3s ease',
                                        } }) })] }), _jsxs("div", { style: { fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }, children: ["Downloading ", DEFAULT_MODEL, " from Ollama registry\u2026"] })] })), state === 'complete' && (_jsxs(_Fragment, { children: [_jsx("div", { style: {
                                background: 'rgba(22,163,74,0.1)',
                                border: '1px solid rgba(22,163,74,0.3)',
                                borderRadius: 8,
                                padding: '14px 16px',
                                marginBottom: 18,
                                color: '#16a34a',
                                fontSize: 13,
                                textAlign: 'center',
                            }, children: "\uD83C\uDF3F Local model ready. MnemosyneC will now serve queries locally." }), _jsx("button", { className: "close-btn", style: { background: 'rgba(22,163,74,0.15)', borderColor: 'rgba(22,163,74,0.4)', color: '#16a34a' }, onClick: onComplete, children: "Start MnemosyneC" })] })), state === 'error' && (_jsxs(_Fragment, { children: [_jsxs("div", { style: {
                                background: 'rgba(239,68,68,0.1)',
                                border: '1px solid rgba(239,68,68,0.3)',
                                borderRadius: 8,
                                padding: '14px 16px',
                                marginBottom: 18,
                                color: '#ef4444',
                                fontSize: 13,
                            }, children: ["Error: ", error] }), _jsxs("div", { style: { display: 'flex', gap: 10 }, children: [_jsx("button", { className: "close-btn", style: { flex: 1 }, onClick: startPull, children: "Retry" }), _jsx("button", { className: "close-btn", style: { flex: 0, padding: '10px 16px', color: 'rgba(255,255,255,0.4)' }, onClick: onSkip, children: "Skip" })] })] }))] }) }));
};
export default ModelPullDialog;
