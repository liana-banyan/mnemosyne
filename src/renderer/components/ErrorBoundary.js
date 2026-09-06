import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// BP041 — Renderer Error Boundary
//
// Catches React render-tree crashes so a single broken component doesn't
// white-screen the entire MnemosyneC window. Empirical anchor: Knight SAGA 1
// b53a09d wired new IPC handlers in main+preload but Vite HMR only reloads
// renderer; old main process didn't have window.amplify.pantheonGetPrefs() →
// MakeYourselfComfortableWizard threw on mount → React tree crashed → white
// screen. Founder direct: "I cannot get out of the white screen."
//
// This boundary now catches such errors, displays a recovery panel, and lets
// the rest of MnemosyneC keep functioning. Member sees what went wrong AND
// has a Reload button to re-mount the renderer.
import { Component } from 'react';
export class ErrorBoundary extends Component {
    constructor() {
        super(...arguments);
        this.state = { hasError: false, error: null, info: null };
        this.reset = () => {
            this.setState({ hasError: false, error: null, info: null });
        };
        this.reload = () => {
            window.location.reload();
        };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, info) {
        this.setState({ info });
        console.error('[ErrorBoundary]', this.props.label ?? 'unknown', error, info);
    }
    render() {
        if (this.state.hasError) {
            const errMsg = this.state.error?.message ?? String(this.state.error);
            const stack = this.state.error?.stack ?? '';
            const componentStack = this.state.info?.componentStack ?? '';
            return (_jsxs("div", { style: styles.container, children: [_jsxs("div", { style: styles.header, children: [_jsx("span", { style: styles.icon, children: "\u26A0\uFE0F" }), _jsxs("span", { style: styles.title, children: ["Component crashed", this.props.label ? `: ${this.props.label}` : ''] })] }), _jsxs("div", { style: styles.body, children: [_jsx("p", { style: styles.hint, children: "The rest of MnemosyneC is still working. Try the actions below, or click another tab." }), _jsxs("details", { style: styles.details, children: [_jsx("summary", { style: styles.summary, children: "\uD83D\uDCCB Error details (click to expand)" }), _jsxs("div", { style: styles.errBlock, children: [_jsx("strong", { children: "Message:" }), _jsx("pre", { style: styles.pre, children: errMsg }), componentStack && (_jsxs(_Fragment, { children: [_jsx("strong", { children: "Component stack:" }), _jsx("pre", { style: styles.pre, children: componentStack.trim() })] })), stack && (_jsxs(_Fragment, { children: [_jsx("strong", { children: "Stack:" }), _jsx("pre", { style: styles.pre, children: stack })] }))] })] }), _jsxs("div", { style: styles.actions, children: [_jsx("button", { onClick: this.reset, style: styles.btnSecondary, children: "\u21BB Try again (re-mount this component)" }), _jsx("button", { onClick: this.reload, style: styles.btnPrimary, children: "\uD83D\uDD04 Reload window" })] }), _jsxs("p", { style: styles.diagnostic, children: [_jsx("strong", { children: "Common cause:" }), " Vite HMR hot-reloaded the renderer, but the main process / preload bridge wasn't restarted, so a new IPC handler (e.g. ", _jsx("code", { children: "window.amplify.someNewMethod()" }), ") doesn't exist yet. Fix: Ctrl+C the ", _jsx("code", { children: "npm run dev" }), " terminal and re-run."] })] })] }));
        }
        return this.props.children;
    }
}
const styles = {
    container: {
        margin: 16,
        border: '1px solid #f59e0b',
        borderRadius: 8,
        background: '#1a0f00',
        color: '#fef3c7',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overflow: 'hidden',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 14px',
        background: '#2a1a05',
        borderBottom: '1px solid #f59e0b44',
    },
    icon: { fontSize: 18 },
    title: { fontSize: 14, fontWeight: 700, color: '#fbbf24' },
    body: { padding: '12px 14px' },
    hint: { fontSize: 12, color: '#fef3c7', marginBottom: 10 },
    details: { marginBottom: 12 },
    summary: { fontSize: 11, color: '#fbbf24', cursor: 'pointer', userSelect: 'none' },
    errBlock: { marginTop: 8, fontSize: 11, color: '#fef3c7' },
    pre: {
        background: '#0a0a12',
        padding: 8,
        borderRadius: 4,
        margin: '4px 0 10px 0',
        fontSize: 10,
        color: '#cbd5e0',
        overflow: 'auto',
        maxHeight: 200,
        whiteSpace: 'pre-wrap',
        userSelect: 'text',
    },
    actions: { display: 'flex', gap: 8, marginTop: 8 },
    btnPrimary: {
        background: '#1f6feb',
        border: 'none',
        color: '#fff',
        padding: '6px 14px',
        borderRadius: 6,
        cursor: 'pointer',
        fontSize: 12,
    },
    btnSecondary: {
        background: '#21262d',
        border: '1px solid #30363d',
        color: '#c9d1d9',
        padding: '6px 14px',
        borderRadius: 6,
        cursor: 'pointer',
        fontSize: 12,
    },
    diagnostic: {
        marginTop: 14,
        padding: 10,
        background: '#0a0a12',
        borderRadius: 4,
        fontSize: 10,
        color: '#a0aec0',
        lineHeight: 1.5,
    },
};
