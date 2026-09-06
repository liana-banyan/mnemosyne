import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const STEPS = [
    { key: 'extracting_spec', label: 'Understanding your request', icon: '🧠' },
    { key: 'spec_ready', label: 'App spec ready', icon: '📋' },
    { key: 'generating_code', label: 'Generating code', icon: '⚙️' },
    { key: 'installing_deps', label: 'Installing dependencies', icon: '📦' },
    { key: 'building', label: 'Building installer', icon: '🔨' },
    { key: 'complete', label: 'Ready to install!', icon: '✅' },
];
const STATUS_ORDER = [
    'extracting_spec',
    'spec_ready',
    'generating_code',
    'installing_deps',
    'building',
    'complete',
];
function getStepState(step, current) {
    if (current === 'error') {
        const currentIdx = STATUS_ORDER.indexOf(current);
        const stepIdx = STATUS_ORDER.indexOf(step);
        return stepIdx < currentIdx ? 'done' : stepIdx === currentIdx ? 'error' : 'pending';
    }
    const currentIdx = STATUS_ORDER.indexOf(current);
    const stepIdx = STATUS_ORDER.indexOf(step);
    if (stepIdx < currentIdx)
        return 'done';
    if (stepIdx === currentIdx)
        return 'active';
    return 'pending';
}
export function AppBuilderProgress({ progress, appName }) {
    if (!progress) {
        return (_jsxs("div", { style: styles.empty, children: [_jsx("div", { style: styles.emptyIcon, children: "\uD83D\uDD25" }), _jsx("div", { style: styles.emptyText, children: "Hearth is ready to build your app." }), _jsx("div", { style: styles.emptySubtext, children: "Describe what you want in the chat \u2192" })] }));
    }
    const currentStatus = progress.status;
    const isError = currentStatus === 'error';
    return (_jsxs("div", { style: styles.container, children: [appName && _jsxs("div", { style: styles.appTitle, children: ["Building: ", appName] }), _jsx("div", { style: styles.steps, children: STEPS.map((step) => {
                    const state = getStepState(step.key, currentStatus);
                    return (_jsxs("div", { style: { ...styles.step, ...(state === 'active' ? styles.stepActive : {}) }, children: [_jsx("div", { style: {
                                    ...styles.stepIcon,
                                    ...(state === 'done' ? styles.stepIconDone : {}),
                                    ...(state === 'active' ? styles.stepIconActive : {}),
                                    ...(state === 'error' ? styles.stepIconError : {}),
                                }, children: state === 'done' ? '✓' : state === 'error' ? '✗' : step.icon }), _jsx("div", { style: {
                                    ...styles.stepLabel,
                                    ...(state === 'done' ? styles.stepLabelDone : {}),
                                    ...(state === 'active' ? styles.stepLabelActive : {}),
                                    ...(state === 'pending' ? styles.stepLabelPending : {}),
                                }, children: step.label })] }, step.key));
                }) }), !isError && currentStatus !== 'complete' && (_jsx("div", { style: styles.progressBar, children: _jsx("div", { style: { ...styles.progressFill, width: `${progress.percent ?? 0}%` } }) })), _jsx("div", { style: {
                    ...styles.statusMessage,
                    ...(isError ? styles.statusError : {}),
                    ...(currentStatus === 'complete' ? styles.statusComplete : {}),
                }, children: progress.message }), currentStatus === 'complete' && progress.installerPath && (_jsxs("div", { style: styles.installerBox, children: [_jsx("div", { style: styles.installerLabel, children: "Installer ready:" }), _jsx("div", { style: styles.installerPath, children: progress.installerPath })] })), isError && progress.error && (_jsxs("div", { style: styles.errorBox, children: [_jsx("div", { style: styles.errorTitle, children: "Error details:" }), _jsx("pre", { style: styles.errorPre, children: progress.error.slice(0, 500) })] }))] }));
}
const styles = {
    container: {
        padding: '1.25rem',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    appTitle: {
        fontWeight: 700,
        fontSize: '1rem',
        marginBottom: '1rem',
        color: '#2c3e50',
    },
    steps: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        marginBottom: '1rem',
    },
    step: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.4rem 0',
    },
    stepActive: {
        background: '#fff8f3',
        borderRadius: '6px',
        padding: '0.4rem 0.5rem',
        marginLeft: '-0.5rem',
        marginRight: '-0.5rem',
    },
    stepIcon: {
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        background: '#f1f3f5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.9rem',
        flexShrink: 0,
    },
    stepIconDone: {
        background: '#d4edda',
        color: '#28a745',
        fontWeight: 700,
    },
    stepIconActive: {
        background: '#ffe0c2',
        color: '#e67e22',
    },
    stepIconError: {
        background: '#f8d7da',
        color: '#dc3545',
        fontWeight: 700,
    },
    stepLabel: {
        fontSize: '0.9rem',
        color: '#adb5bd',
    },
    stepLabelDone: {
        color: '#28a745',
        textDecoration: 'line-through',
    },
    stepLabelActive: {
        color: '#e67e22',
        fontWeight: 600,
    },
    stepLabelPending: {
        color: '#adb5bd',
    },
    progressBar: {
        height: '6px',
        background: '#dee2e6',
        borderRadius: '3px',
        overflow: 'hidden',
        marginBottom: '0.75rem',
    },
    progressFill: {
        height: '100%',
        background: '#e67e22',
        borderRadius: '3px',
        transition: 'width 0.4s ease',
    },
    statusMessage: {
        fontSize: '0.85rem',
        color: '#6c757d',
        fontStyle: 'italic',
        marginBottom: '0.75rem',
        wordBreak: 'break-word',
    },
    statusError: {
        color: '#dc3545',
        fontStyle: 'normal',
        fontWeight: 600,
    },
    statusComplete: {
        color: '#28a745',
        fontStyle: 'normal',
        fontWeight: 600,
    },
    installerBox: {
        background: '#d4edda',
        border: '1px solid #c3e6cb',
        borderRadius: '6px',
        padding: '0.75rem',
        marginTop: '0.5rem',
    },
    installerLabel: {
        fontWeight: 600,
        fontSize: '0.85rem',
        color: '#155724',
        marginBottom: '0.25rem',
    },
    installerPath: {
        fontSize: '0.8rem',
        color: '#155724',
        wordBreak: 'break-all',
        fontFamily: 'monospace',
    },
    errorBox: {
        background: '#f8d7da',
        border: '1px solid #f5c6cb',
        borderRadius: '6px',
        padding: '0.75rem',
        marginTop: '0.5rem',
    },
    errorTitle: {
        fontWeight: 600,
        fontSize: '0.85rem',
        color: '#721c24',
        marginBottom: '0.25rem',
    },
    errorPre: {
        fontSize: '0.75rem',
        color: '#721c24',
        margin: 0,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        maxHeight: '120px',
        overflowY: 'auto',
    },
    empty: {
        textAlign: 'center',
        padding: '2rem 1rem',
        color: '#6c757d',
    },
    emptyIcon: {
        fontSize: '2.5rem',
        marginBottom: '0.75rem',
    },
    emptyText: {
        fontSize: '1rem',
        fontWeight: 600,
        color: '#495057',
        marginBottom: '0.25rem',
    },
    emptySubtext: {
        fontSize: '0.85rem',
        color: '#adb5bd',
    },
};
