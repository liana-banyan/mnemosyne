import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// B83b — Embedded Chrome Panel
// Embeds a Chromium webview via Electron's <webview> tag
// Patent novelty: auto-injection of cooperative-AI-substrate context into
//   third-party AI-backed search interface via embedded-browser content-script bridge.
// R-MECHANISM-VERIFY: Electron 31 supports <webview> with webviewTag: true in webPreferences
//
// Multi-browser deferral: Chrome only at v1 per Founder direct.
// B83-FOLLOWUP-MULTIBROWSER tracks Firefox/Edge/Brave/Safari support.
import { useState, useRef, useEffect, useCallback } from 'react';
import { DEFAULT_INJECTION_STATE } from './substrate_injection_content_script';
import { BROWSER_AUTHORITY_SETTLE_DELAY_MS, BROWSER_AUTHORITY_TIMEOUT_MS } from './browser_authority_content_script';
import { buildBrowserAuthorityQueryUrl } from '../../../shared/plow/browser_authority_types';
const GOOGLE_SEARCH_AI_URL = 'https://www.google.com';
export function EmbeddedChrome({ substrateContext, onInjectionResult, onBrowserAuthorityBridgeReady }) {
    const webviewRef = useRef(null);
    const [currentUrl, setCurrentUrl] = useState(GOOGLE_SEARCH_AI_URL);
    const [urlInput, setUrlInput] = useState(GOOGLE_SEARCH_AI_URL);
    const [loading, setLoading] = useState(false);
    const [injectionState, setInjectionState] = useState(DEFAULT_INJECTION_STATE);
    const [webviewReady, setWebviewReady] = useState(false);
    // BP137 Yoke v2b Stage C -- holds the resolver for whichever runBrowserAuthorityQuery() call
    // is currently in flight (at most one at a time; a second call while one is pending rejects
    // immediately rather than silently dropping the first). null whenever no call is pending --
    // which is always true for every caller that never supplies onBrowserAuthorityBridgeReady.
    const pendingBrowserAuthorityRef = useRef(null);
    const bridgeAnnouncedRef = useRef(false);
    // Preload path: compiled by tsconfig.main.json → dist/main/hearth/embedded_browser/webview_preload.js
    // In dev, __dirname points to src/main; in prod, dist/main — both valid for preload resolution
    const preloadPath = window.amplify.getWebviewPreloadPath
        ? window.amplify.getWebviewPreloadPath()
        : undefined;
    // Push substrate context to webview when it changes
    useEffect(() => {
        if (!webviewReady || !webviewRef.current)
            return;
        if (substrateContext) {
            webviewRef.current.send('substrate-context-update', {
                context: substrateContext,
                enabled: injectionState.enabled,
            });
            setInjectionState((s) => ({
                ...s,
                context_loaded: true,
                context_length: substrateContext.length,
            }));
        }
    }, [substrateContext, webviewReady, injectionState.enabled]);
    const attachWebviewListeners = useCallback((wv) => {
        wv.addEventListener('ipc-message', (e) => {
            const ev = e;
            if (ev.channel === 'webview-ready') {
                setWebviewReady(true);
                // Push current context on ready
                if (substrateContext) {
                    wv.send('substrate-context-update', {
                        context: substrateContext,
                        enabled: injectionState.enabled,
                    });
                }
            }
            if (ev.channel === 'substrate-injection-result') {
                const result = ev.args[0];
                setInjectionState((s) => ({
                    ...s,
                    last_result: {
                        success: result.success,
                        url: result.url,
                        injection_count: result.injection_count,
                        selector_used: null,
                    },
                }));
                onInjectionResult?.({ success: result.success, url: result.url });
            }
            // BP137 Yoke v2b Stage C -- ADDITIVE. Reachable only after a runBrowserAuthorityQuery()
            // call has set pendingBrowserAuthorityRef (which only happens when a consumer supplied
            // onBrowserAuthorityBridgeReady and then invoked the bridge it received). If no call is
            // pending, this branch is a guaranteed no-op -- a stray/duplicate message on this
            // channel is simply dropped rather than throwing.
            if (ev.channel === 'browser-authority-extraction-result') {
                const pending = pendingBrowserAuthorityRef.current;
                if (pending) {
                    clearTimeout(pending.timeoutId);
                    pendingBrowserAuthorityRef.current = null;
                    pending.resolve(ev.args[0]);
                }
            }
        });
        wv.addEventListener('did-navigate', (e) => {
            const nav = e;
            setCurrentUrl(nav.url);
            setUrlInput(nav.url);
            setLoading(false);
        });
        wv.addEventListener('did-finish-load', () => {
            setLoading(false);
            // Re-push context after navigation
            if (substrateContext) {
                setTimeout(() => {
                    wv.send('substrate-context-update', {
                        context: substrateContext,
                        enabled: injectionState.enabled,
                    });
                }, 500); // wait for page JS to settle
            }
        });
    }, [substrateContext, injectionState.enabled, onInjectionResult]);
    // Mount webview listener once
    useEffect(() => {
        const wv = webviewRef.current;
        if (wv)
            attachWebviewListeners(wv);
    }, [attachWebviewListeners]);
    // BP137 Yoke v2b Stage C -- ADDITIVE. The real, working implementation behind
    // BrowserAuthorityRuntimeBridge.runQuery. Never called by anything in this file on its own;
    // it only ever runs when a consumer of EmbeddedChrome received it via
    // onBrowserAuthorityBridgeReady (below) and chose to invoke it. Resolves with
    // `success: false` (never a fabricated snippet/URL) on a missing webview, an already-pending
    // call, or a timeout -- see this function's three early-resolve branches.
    const runBrowserAuthorityQuery = useCallback((question, authority) => {
        return new Promise((resolve) => {
            const wv = webviewRef.current;
            const honestFailure = () => ({ success: false, authority, snippet: '', sourceUrl: null, selectorUsed: null });
            if (!wv) {
                resolve(honestFailure());
                return;
            }
            if (pendingBrowserAuthorityRef.current) {
                // A call is already in flight. Never clobber its resolver (that would silently drop
                // the first caller's result) -- this second call simply reports its own honest
                // failure instead of queueing (queueing multiple in-flight browser-authority calls
                // against one shared webview is out of scope for this pass).
                resolve(honestFailure());
                return;
            }
            const timeoutId = setTimeout(() => {
                pendingBrowserAuthorityRef.current = null;
                resolve(honestFailure());
            }, BROWSER_AUTHORITY_TIMEOUT_MS);
            pendingBrowserAuthorityRef.current = { resolve, timeoutId };
            const onFinishLoad = () => {
                wv.removeEventListener('did-finish-load', onFinishLoad);
                // Give the results page's own JS a moment to paint the answer box before asking
                // webview_preload.ts's extractor to read it -- same "wait for page JS to settle"
                // rationale already used by this component's substrate-context re-push above.
                setTimeout(() => {
                    const request = { query: question, authority };
                    wv.send('browser-authority-run-query', request);
                }, BROWSER_AUTHORITY_SETTLE_DELAY_MS);
            };
            wv.addEventListener('did-finish-load', onFinishLoad);
            setLoading(true);
            wv.loadURL(buildBrowserAuthorityQueryUrl({ question, authority }));
        });
    }, []);
    // BP137 Yoke v2b Stage C -- ADDITIVE. Announces the real, working bridge exactly once, the
    // first time the webview reports ready, and ONLY when a consumer opted in via
    // onBrowserAuthorityBridgeReady. When that prop is undefined (every pre-BP137 caller), this
    // effect's body never executes past its first guard clause -- no new state, no new webview
    // traffic, nothing observably different from this effect not existing at all.
    useEffect(() => {
        if (!webviewReady || !onBrowserAuthorityBridgeReady || bridgeAnnouncedRef.current)
            return;
        bridgeAnnouncedRef.current = true;
        onBrowserAuthorityBridgeReady({ runQuery: runBrowserAuthorityQuery });
    }, [webviewReady, onBrowserAuthorityBridgeReady, runBrowserAuthorityQuery]);
    function navigateTo(url) {
        let target = url.trim();
        if (!target.startsWith('http://') && !target.startsWith('https://')) {
            target = `https://${target}`;
        }
        setLoading(true);
        if (webviewRef.current) {
            webviewRef.current.loadURL(target);
        }
        setUrlInput(target);
    }
    function handleUrlKeyDown(e) {
        if (e.key === 'Enter')
            navigateTo(urlInput);
    }
    function toggleInjection() {
        const next = !injectionState.enabled;
        setInjectionState((s) => ({ ...s, enabled: next }));
        if (webviewRef.current && webviewReady) {
            webviewRef.current.send('substrate-injection-toggle', { enabled: next });
        }
    }
    const injectionIndicator = injectionState.last_result
        ? injectionState.last_result.success ? '✓ injected' : '⚠ injection miss'
        : injectionState.context_loaded ? '⏳ context ready' : '○ no context';
    const injectionColor = injectionState.last_result?.success
        ? '#22c55e'
        : injectionState.context_loaded
            ? '#f6ad55'
            : '#718096';
    return (_jsxs("div", { style: styles.container, children: [_jsxs("div", { style: styles.browserBar, children: [_jsx("input", { style: styles.urlInput, value: urlInput, onChange: (e) => setUrlInput(e.target.value), onKeyDown: handleUrlKeyDown, placeholder: "Enter URL or search\u2026" }), _jsx("button", { style: styles.goBtn, onClick: () => navigateTo(urlInput), title: "Navigate", children: loading ? '⟳' : '→' }), _jsxs("div", { style: { ...styles.injectionBadge, color: injectionColor }, title: `Substrate injection: ${injectionIndicator}`, children: [injectionState.enabled ? '🧬' : '○', _jsx("span", { style: styles.injectionText, children: injectionIndicator })] }), _jsx("button", { style: { ...styles.toggleBtn, background: injectionState.enabled ? '#2c5282' : '#4a5568' }, onClick: toggleInjection, title: injectionState.enabled ? 'Disable substrate injection' : 'Enable substrate injection', children: injectionState.enabled ? 'Auto-inject ON' : 'Auto-inject OFF' })] }), _jsx("div", { style: styles.webviewContainer, children: typeof window !== 'undefined' && (_jsx("webview", { ref: (el) => {
                        if (el && el !== webviewRef.current) {
                            webviewRef.current = el;
                            attachWebviewListeners(el);
                        }
                    }, src: GOOGLE_SEARCH_AI_URL, preload: preloadPath, style: styles.webview, 
                    /* @ts-expect-error — webview is an Electron custom element not in React types */
                    allowpopups: "true" })) }), injectionState.context_loaded && (_jsxs("div", { style: styles.contextStatus, children: [_jsx("span", { style: { color: '#68d391' }, children: "Substrate context loaded" }), ' · ', injectionState.context_length, " chars", ' · ', "Enter key in Google Search AI triggers injection"] })), !webviewReady && (_jsx("div", { style: styles.webviewNotice, children: "Embedded Chrome loading\u2026 If blocked by Content Security Policy, substrate context will be copied to clipboard for manual paste." }))] }));
}
const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#0f0f1a',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid #2d3748',
    },
    browserBar: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.4rem 0.6rem',
        background: '#1a1a2e',
        borderBottom: '1px solid #2d3748',
    },
    urlInput: {
        flex: 1,
        background: '#2d3748',
        border: '1px solid #4a5568',
        borderRadius: '4px',
        padding: '0.3rem 0.5rem',
        color: '#e2e8f0',
        fontSize: '0.8rem',
        outline: 'none',
        fontFamily: 'monospace',
    },
    goBtn: {
        background: '#4a5568',
        border: 'none',
        borderRadius: '4px',
        padding: '0.3rem 0.6rem',
        color: '#e2e8f0',
        cursor: 'pointer',
        fontSize: '0.85rem',
    },
    injectionBadge: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
        fontSize: '0.75rem',
        minWidth: 120,
    },
    injectionText: { fontSize: '0.65rem' },
    toggleBtn: {
        border: 'none',
        borderRadius: '4px',
        padding: '0.25rem 0.5rem',
        color: '#e2e8f0',
        cursor: 'pointer',
        fontSize: '0.65rem',
        whiteSpace: 'nowrap',
    },
    webviewContainer: {
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
    },
    webview: {
        width: '100%',
        height: '100%',
        display: 'block',
    },
    contextStatus: {
        padding: '0.25rem 0.6rem',
        background: '#0d1117',
        fontSize: '0.65rem',
        color: '#718096',
        borderTop: '1px solid #2d3748',
    },
    webviewNotice: {
        padding: '0.3rem 0.6rem',
        background: '#2d2000',
        fontSize: '0.65rem',
        color: '#f6ad55',
        textAlign: 'center',
    },
};
