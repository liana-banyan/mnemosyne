import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// SEG-K23-D — Prove It Works: honest poller health check (Truth-Always §2)
// BP136 Yoke: extended with the answer-cache mode toggle + real (restart-surviving) meter
// summary. "Nothing that isn't real" -- every number below comes from
// ai-dispatch:answer-cache-meter-summary, which reads the persisted per-query JSONL log.
// BP139: extended with Authority Proof Panel -- sign-in status + live test query + result.
import { useState, useCallback, useEffect, useRef } from 'react';
// BP1xx Browser Authority enable-toggle unification (this build pass): reuse the SAME
// mnem_drt_specialists load/save/persist path SettingsTab.tsx's MnemDrtPanel already uses
// (localStorage 'mnemo_mnem_drt' mirror + amplify.aiDispatch.saveSettings round-trip to
// ai_dispatch_settings.json) rather than inventing a second, possibly-diverging persistence
// path. See SettingsTab.tsx's own export comment above these three for the rationale.
import { loadMnemDrt, saveMnemDrt, persistMnemDrtToBackend } from '../SettingsTab';
// BP140-K5 MOVE 3: "Two Barrels" replaces "The Meter" below -- see TwoBarrelMeter.tsx's header
// for the full boundary-check writeup (getAnswerCacheMeterSummary() is aggregate-only, so
// Barrel 2 renders a single real "aggregate" stratum and Barrel 1 renders an honest "not yet
// tracked" empty state; no per-AI number is fabricated).
import { TwoBarrelMeter } from '../TwoBarrelMeter';
const AUTHORITY_LABELS = {
    user_google: 'Google',
    user_perplexity: 'Perplexity',
    user_claude: 'Claude',
    user_chatgpt: 'ChatGPT',
    user_gemini: 'Gemini',
};
const REASON_EXPLANATIONS = {
    flag_off: 'Research Arm + Browser Authority flags are both OFF in Settings > Authorities. Enable them there, then retry.',
    not_lookup_fact: 'The question was not classified as a lookup-fact (a single verifiable fact). Try a question like "what year did the Berlin Wall fall".',
    authority_empty: 'Both Google and Perplexity were tried but neither returned a usable result. Check that you are signed in to both authorities.',
};
const DEFAULT_TEST_QUESTION = 'what year did the Berlin Wall fall';
function panelStyle() {
    return {
        marginTop: 16,
        padding: 12,
        backgroundColor: 'rgba(148, 163, 184, 0.06)',
        border: '1px solid rgba(148, 163, 184, 0.2)',
        borderRadius: 6,
    };
}
export function ProveItWorksTab(props) {
    const { onFirstComplete, onSwitchTab } = props;
    const [checkState, setCheckState] = useState('idle');
    const [checkedAt, setCheckedAt] = useState(null);
    const [hasCompleted, setHasCompleted] = useState(false);
    // BP136: answer-cache mode toggle + meter summary
    const [cacheModeOn, setCacheModeOn] = useState(false);
    const [cacheModeLoaded, setCacheModeLoaded] = useState(false);
    const [toggling, setToggling] = useState(false);
    const [meter, setMeter] = useState(null);
    const [loadingMeter, setLoadingMeter] = useState(false);
    // BP139: Authority Proof Panel
    const [authorityCheckState, setAuthorityCheckState] = useState('idle');
    const [flagsEnabled, setFlagsEnabled] = useState(null);
    const [signInStatuses, setSignInStatuses] = useState(null);
    const [testQuestion, setTestQuestion] = useState(DEFAULT_TEST_QUESTION);
    const [testState, setTestState] = useState('idle');
    const [testResult, setTestResult] = useState(null);
    const [testError, setTestError] = useState(null);
    const testQuestionRef = useRef(testQuestion);
    // BP1xx Browser Authority enable-toggle unification: mirrors the SAME
    // mnem_drt_specialists Record<string, boolean> SettingsTab.tsx's MnemDrtPanel reads/writes,
    // keyed by 'user_google' | 'user_perplexity' | 'user_claude' (BrowserLlmAuthorityName). Loaded
    // once from the localStorage mirror on mount -- same read path loadMnemDrt() always uses, no
    // new source of truth.
    const [authorityEnabled, setAuthorityEnabled] = useState(() => loadMnemDrt().mnem_drt_specialists);
    const refreshMeter = useCallback(async () => {
        setLoadingMeter(true);
        try {
            const res = await window.amplify?.aiDispatch?.getAnswerCacheMeterSummary?.();
            if (res?.ok && res.summary)
                setMeter(res.summary);
        }
        catch {
            // non-fatal — panel just shows the last-known (or empty) state
        }
        setLoadingMeter(false);
    }, []);
    // BP139: check authority sign-in status + flag state
    const refreshAuthorityStatus = useCallback(async () => {
        setAuthorityCheckState('checking');
        try {
            const res = await window.amplify?.checkNexusAuthoritySignInStatus?.();
            if (res) {
                setFlagsEnabled(res.enabled ?? false);
                setSignInStatuses(res.statuses ?? []);
                setAuthorityCheckState('done');
            }
            else {
                setAuthorityCheckState('error');
            }
        }
        catch {
            setAuthorityCheckState('error');
        }
    }, []);
    // BP139: run a live test query through the authority chain
    const runAuthorityTest = useCallback(async () => {
        const q = testQuestionRef.current.trim();
        if (!q)
            return;
        setTestState('running');
        setTestResult(null);
        setTestError(null);
        try {
            const res = await window.amplify?.nexusAskLookupFact?.(q);
            if (res) {
                setTestResult(res);
                setTestState('done');
            }
            else {
                setTestError('No response from authority IPC');
                setTestState('error');
            }
        }
        catch (e) {
            setTestError(String(e));
            setTestState('error');
        }
    }, []);
    // BP1xx Browser Authority enable-toggle unification: "the toggle IS the login trigger"
    // (Founder BP1xx). Writes mnem_drt_specialists[authority] through the SAME
    // load-current/merge/save/persist sequence SettingsTab.tsx's updateSpecialist() uses --
    // reading loadMnemDrt() fresh (not the closed-over `drt` this file doesn't have) so this never
    // clobbers other specialist keys (wikipedia/wolfram/etc.) that MnemDrtPanel may have already
    // saved. When switching ON while not currently signed in, also opens the SAME nexus sign-in
    // window NexusAuthoritySignInPanel.tsx's own "Sign in to X" button opens
    // (window.amplify.openNexusAuthoritySignIn) -- toggle-on doubles as the login trigger.
    const toggleAuthorityEnabled = useCallback((authority, nextVal, signedIn) => {
        const current = loadMnemDrt();
        const next = { ...current, mnem_drt_specialists: { ...current.mnem_drt_specialists, [authority]: nextVal } };
        saveMnemDrt(next);
        void persistMnemDrtToBackend(next);
        setAuthorityEnabled(next.mnem_drt_specialists);
        if (nextVal && !signedIn) {
            void window.amplify?.openNexusAuthoritySignIn?.(authority);
        }
    }, []);
    useEffect(() => {
        void (async () => {
            try {
                const res = await window.amplify?.aiDispatch?.getSettings?.();
                if (res?.ok && res.settings)
                    setCacheModeOn(res.settings.answer_cache_mode === true);
            }
            catch {
                // non-fatal — defaults to OFF, which matches the real default
            }
            setCacheModeLoaded(true);
        })();
        void refreshMeter();
        // BP139: auto-probe authority status on mount so the panel is not cold
        void refreshAuthorityStatus();
    }, [refreshMeter, refreshAuthorityStatus]);
    // BP139: keep the ref in sync so runAuthorityTest captures the latest question
    useEffect(() => { testQuestionRef.current = testQuestion; }, [testQuestion]);
    const toggleCacheMode = useCallback(async () => {
        const next = !cacheModeOn;
        setToggling(true);
        setCacheModeOn(next);
        try {
            await window.amplify?.aiDispatch?.saveSettings?.({ answer_cache_mode: next });
        }
        catch {
            // non-fatal — UI stays optimistic; next getSettings() read will reconcile
        }
        setToggling(false);
    }, [cacheModeOn]);
    const runCheck = useCallback(async () => {
        setCheckState('checking');
        setCheckedAt(null);
        try {
            const result = await window.amplify?.pollerHealthQuery?.();
            const timestamp = new Date().toISOString();
            setCheckedAt(timestamp);
            if (result?.alive === true) {
                setCheckState('alive');
            }
            else {
                setCheckState('offline');
            }
            if (!hasCompleted) {
                setHasCompleted(true);
                onFirstComplete?.();
            }
        }
        catch {
            setCheckedAt(new Date().toISOString());
            setCheckState('offline');
        }
    }, [hasCompleted, onFirstComplete]);
    return (_jsxs("div", { style: { padding: 16, height: '100%', boxSizing: 'border-box', overflowY: 'auto' }, children: [_jsx("div", { style: { fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }, children: "Prove It Works" }), _jsx("div", { style: { fontSize: 11, color: '#707070', marginBottom: 4, lineHeight: 1.5 }, children: "Serve the frontier answer instantly at $0 \u2014 real counters only, nothing fabricated." }), _jsx("div", { style: panelStyle(), children: _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 13, fontWeight: 600, color: '#e2e8f0' }, children: "Answer Cache" }), _jsx("div", { style: { fontSize: 11, color: '#707070', marginTop: 2, lineHeight: 1.5 }, children: "When ON, an exact or near-identical repeat question is served straight from the verified answer store \u2014 $0, no model call. Default is OFF." })] }), _jsx("button", { type: "button", onClick: () => void toggleCacheMode(), disabled: toggling || !cacheModeLoaded, style: {
                                flexShrink: 0,
                                padding: '6px 14px',
                                backgroundColor: cacheModeOn ? 'rgba(100, 200, 150, 0.15)' : 'rgba(148, 163, 184, 0.1)',
                                border: `1px solid ${cacheModeOn ? 'rgba(100, 200, 150, 0.5)' : 'rgba(148, 163, 184, 0.3)'}`,
                                borderRadius: 5,
                                color: cacheModeOn ? '#8bc8a0' : '#94a3b8',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: toggling ? 'wait' : 'pointer',
                                minWidth: 52,
                            }, children: cacheModeOn ? 'ON' : 'OFF' })] }) }), _jsx(TwoBarrelMeter, { meter: meter, loading: loadingMeter, onRefresh: () => void refreshMeter() }), meter && meter.total_queries > 0 && (_jsxs("div", { style: { ...panelStyle(), fontSize: 11, color: '#606060', lineHeight: 1.7 }, children: [_jsxs("div", { children: ["Served free (from substrate): ", _jsx("b", { style: { color: '#6ee7b7' }, children: meter.served_verbatim_count }), " of", ' ', meter.total_queries, " queries"] }), meter.avg_served_verbatim_latency_ms > 0 && (_jsxs("div", { children: ["Avg latency, served free: ", meter.avg_served_verbatim_latency_ms, "ms"] })), _jsxs("div", { children: ["RAG-assisted: ", meter.rag_count, " \u00B7 Local generate: ", meter.local_generate_count, " \u00B7 Flagship: ", meter.flagship_count] })] })), _jsx("div", { style: { fontSize: 11, color: '#707070', margin: '20px 0 4px', lineHeight: 1.5 }, children: "Press the button to confirm your substrate poller is live." }), _jsx("button", { type: "button", onClick: () => void runCheck(), disabled: checkState === 'checking', style: {
                    padding: '10px 20px',
                    backgroundColor: 'rgba(100, 200, 150, 0.15)',
                    border: '1px solid rgba(100, 200, 150, 0.5)',
                    borderRadius: 4,
                    color: '#8bc8a0',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: checkState === 'checking' ? 'wait' : 'pointer',
                    opacity: checkState === 'checking' ? 0.7 : 1,
                }, children: "Prove It Works \u25B6" }), checkState === 'checking' && (_jsx("div", { style: { marginTop: 16, fontSize: 12, color: '#909090', fontStyle: 'italic' }, children: "Checking poller health\u2026" })), checkState === 'alive' && (_jsxs("div", { style: { marginTop: 16, padding: 12, backgroundColor: 'rgba(100, 200, 150, 0.08)', border: '1px solid rgba(100, 200, 150, 0.3)', borderRadius: 4 }, children: [_jsx("div", { style: { fontSize: 13, color: '#8bc8a0', lineHeight: 1.5 }, children: "Substrate is alive \u2014 poller responding. Use the Ask tab to run a live query." }), checkedAt && (_jsxs("div", { style: { fontSize: 10, color: '#606060', marginTop: 8 }, children: ["Checked at: ", checkedAt] }))] })), checkState === 'offline' && (_jsxs("div", { style: { marginTop: 16, padding: 12, backgroundColor: 'rgba(200, 100, 100, 0.08)', border: '1px solid rgba(200, 100, 100, 0.3)', borderRadius: 4 }, children: [_jsx("div", { style: { fontSize: 13, color: '#c8a0a0', lineHeight: 1.5 }, children: "Substrate poller not responding. Try starting MnemosyneC's Ollama integration, then return here." }), checkedAt && (_jsxs("div", { style: { fontSize: 10, color: '#606060', marginTop: 8 }, children: ["Checked at: ", checkedAt] }))] })), _jsx("button", { type: "button", onClick: () => onSwitchTab?.('ask'), style: {
                    marginTop: 20,
                    padding: '6px 14px',
                    backgroundColor: 'transparent',
                    border: '1px solid rgba(100, 200, 150, 0.3)',
                    borderRadius: 4,
                    color: '#8bc8a0',
                    fontSize: 12,
                    cursor: 'pointer',
                }, children: "Ask a question and watch the badge \u2192 Ask tab" }), _jsxs("div", { style: { marginTop: 24, borderTop: '1px solid rgba(148,163,184,0.15)', paddingTop: 14 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }, children: [_jsx("div", { style: { fontSize: 13, fontWeight: 700, color: '#e2e8f0' }, children: "Browser Authority" }), _jsx("button", { type: "button", onClick: () => void refreshAuthorityStatus(), disabled: authorityCheckState === 'checking', style: {
                                    background: 'none', border: '1px solid rgba(148,163,184,0.3)', borderRadius: 4,
                                    color: '#94a3b8', fontSize: 11, padding: '2px 8px',
                                    cursor: authorityCheckState === 'checking' ? 'wait' : 'pointer',
                                }, children: authorityCheckState === 'checking' ? '...' : 'Refresh' })] }), _jsx("div", { style: { fontSize: 11, color: '#707070', marginBottom: 10, lineHeight: 1.5 }, children: "Verify that the browser authority is signed in and can return a sourced fact. Flags must be ON in Settings > Authorities." }), flagsEnabled !== null && (_jsx("div", { style: {
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '3px 8px', borderRadius: 4, marginBottom: 8,
                            background: flagsEnabled ? 'rgba(110,231,183,0.1)' : 'rgba(200,100,100,0.08)',
                            border: `1px solid ${flagsEnabled ? 'rgba(110,231,183,0.35)' : 'rgba(200,100,100,0.3)'}`,
                            fontSize: 11, color: flagsEnabled ? '#6ee7b7' : '#c87070', fontWeight: 600,
                        }, children: flagsEnabled ? 'Flags ON' : 'Flags OFF -- enable Research Arm + Browser Authority in Settings' })), signInStatuses && signInStatuses.length > 0 && (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }, children: signInStatuses.map((s) => {
                            const enabled = authorityEnabled[s.authority] ?? false;
                            return (_jsxs("div", { style: {
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '4px 8px', borderRadius: 4,
                                    background: s.signedIn ? 'rgba(110,231,183,0.06)' : 'rgba(148,163,184,0.06)',
                                    border: `1px solid ${s.signedIn ? 'rgba(110,231,183,0.25)' : 'rgba(148,163,184,0.2)'}`,
                                    fontSize: 11,
                                }, children: [_jsx("span", { style: {
                                            fontWeight: 700,
                                            color: s.signedIn ? '#6ee7b7' : '#94a3b8',
                                        }, children: s.signedIn ? 'Signed in' : 'Not signed in' }), _jsx("span", { style: { color: '#64748b' }, children: AUTHORITY_LABELS[s.authority] ?? s.authority }), !s.signedIn && s.reason && (_jsx("span", { style: { color: '#475569', fontSize: 10 }, children: s.reason })), _jsx("button", { type: "button", onClick: () => toggleAuthorityEnabled(s.authority, !enabled, s.signedIn), title: enabled
                                            ? `Disable ${AUTHORITY_LABELS[s.authority] ?? s.authority} as an authority`
                                            : s.signedIn
                                                ? `Enable ${AUTHORITY_LABELS[s.authority] ?? s.authority} as an authority`
                                                : `Enable ${AUTHORITY_LABELS[s.authority] ?? s.authority} and sign in`, style: {
                                            marginLeft: 'auto', flexShrink: 0,
                                            padding: '3px 10px', borderRadius: 4,
                                            background: enabled ? 'rgba(100,200,150,0.15)' : 'rgba(148,163,184,0.1)',
                                            border: `1px solid ${enabled ? 'rgba(100,200,150,0.5)' : 'rgba(148,163,184,0.3)'}`,
                                            color: enabled ? '#8bc8a0' : '#94a3b8',
                                            fontSize: 10, fontWeight: 700, cursor: 'pointer', minWidth: 40,
                                        }, children: enabled ? 'ON' : 'OFF' })] }, s.authority));
                        }) })), _jsx("div", { style: { fontSize: 10, color: '#64748b', marginTop: -6, marginBottom: 10, lineHeight: 1.5 }, children: "Off by default. Switching an authority ON while it is not signed in also opens its sign-in window." }), authorityCheckState === 'error' && (_jsx("div", { style: { fontSize: 11, color: '#f87171', marginBottom: 8 }, children: "Could not probe authority status -- app may be starting up." })), _jsxs("div", { style: { marginBottom: 8 }, children: [_jsx("div", { style: { fontSize: 11, color: '#94a3b8', marginBottom: 4 }, children: "Test question:" }), _jsx("input", { type: "text", value: testQuestion, onChange: (e) => setTestQuestion(e.target.value), disabled: testState === 'running', placeholder: "e.g. what year did the Berlin Wall fall", style: {
                                    width: '100%', boxSizing: 'border-box',
                                    padding: '6px 10px', borderRadius: 4,
                                    background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(148,163,184,0.3)',
                                    color: '#e2e8f0', fontSize: 12, fontFamily: 'system-ui, sans-serif',
                                    outline: 'none',
                                } })] }), _jsx("button", { type: "button", onClick: () => void runAuthorityTest(), disabled: testState === 'running' || !testQuestion.trim(), style: {
                            padding: '7px 16px',
                            backgroundColor: 'rgba(100,200,150,0.15)',
                            border: '1px solid rgba(100,200,150,0.5)',
                            borderRadius: 4, color: '#8bc8a0', fontSize: 12, fontWeight: 600,
                            cursor: (testState === 'running' || !testQuestion.trim()) ? 'wait' : 'pointer',
                            opacity: (testState === 'running' || !testQuestion.trim()) ? 0.6 : 1,
                        }, children: testState === 'running' ? 'Querying authority...' : 'Test Authority' }), testState === 'done' && testResult && (_jsxs("div", { style: {
                            marginTop: 10, padding: 10, borderRadius: 4,
                            background: testResult.usable ? 'rgba(110,231,183,0.06)' : 'rgba(148,163,184,0.06)',
                            border: `1px solid ${testResult.usable ? 'rgba(110,231,183,0.25)' : 'rgba(148,163,184,0.2)'}`,
                        }, children: [_jsxs("div", { style: { display: 'flex', gap: 10, marginBottom: 6, flexWrap: 'wrap' }, children: [_jsx("span", { style: {
                                            padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                                            background: testResult.usable ? 'rgba(110,231,183,0.15)' : 'rgba(200,100,100,0.15)',
                                            color: testResult.usable ? '#6ee7b7' : '#f87171',
                                            border: `1px solid ${testResult.usable ? 'rgba(110,231,183,0.4)' : 'rgba(200,100,100,0.3)'}`,
                                        }, children: testResult.usable ? 'USABLE' : 'NOT USABLE' }), _jsx("span", { style: {
                                            padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                                            background: 'rgba(148,163,184,0.1)', color: '#94a3b8',
                                            border: '1px solid rgba(148,163,184,0.2)',
                                        }, children: testResult.answerType }), testResult.authority && (_jsxs("span", { style: {
                                            padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                                            background: 'rgba(148,163,184,0.1)', color: '#94a3b8',
                                            border: '1px solid rgba(148,163,184,0.2)',
                                        }, children: ["via ", AUTHORITY_LABELS[testResult.authority] ?? testResult.authority] })), testResult.confidence !== undefined && (_jsxs("span", { style: {
                                            padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                                            background: 'rgba(148,163,184,0.1)', color: '#94a3b8',
                                            border: '1px solid rgba(148,163,184,0.2)',
                                        }, children: ["confidence ", Math.round(testResult.confidence * 100), "%"] }))] }), testResult.usable && testResult.fact && (_jsx("div", { style: { fontSize: 12, color: '#f0fdf4', fontWeight: 600, marginBottom: 4, lineHeight: 1.5 }, children: testResult.fact })), testResult.usable && testResult.sourceUrl && (_jsxs("div", { style: { fontSize: 10, color: '#64748b', lineHeight: 1.4, wordBreak: 'break-all' }, children: ["Source:", ' ', _jsx("span", { role: "link", tabIndex: 0, onClick: () => window.amplify?.openExternal?.(testResult.sourceUrl), onKeyDown: (e) => e.key === 'Enter' && window.amplify?.openExternal?.(testResult.sourceUrl), style: { color: '#6ee7b7', textDecoration: 'underline', cursor: 'pointer' }, children: testResult.sourceUrl })] })), !testResult.usable && testResult.reason && (_jsxs("div", { style: { fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }, children: [_jsx("span", { style: { fontWeight: 700, color: '#fca5a5' }, children: testResult.reason }), ' -- ', REASON_EXPLANATIONS[testResult.reason] ?? 'No explanation available.'] }))] })), testState === 'error' && testError && (_jsxs("div", { style: { marginTop: 8, fontSize: 11, color: '#f87171' }, children: ["Error: ", testError] }))] })] }));
}
