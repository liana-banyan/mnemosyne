import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// LeanWelcomeView.tsx — SEG-V0150-P0-LEAN-WELCOME
// Lean, two-screen welcome: Screen 1 = download CTA; Screen 2 = benchmark proof.
// Benchmark data sourced from:
//   librarian-mcp/r10_cross_vendor/results/CADRE_BENCHMARK_RESULTS_BP067.md
//   Big-4 Baseline section, lines 26-33 (BP063 · 2026-05-30 · kappa=0.936)
//
// SEG-V0150-P0-DIAGNOSE-BRIDGE: bridge probe at mount (console, readable via DevTools / diagnostic)
// SEG-V0150-P0-FIX-BRIDGE-OR-FALLBACK: immediate button feedback + 5s fallback + Skip path
// SEG-V0150-P0-PROACTIVE: adaptive CTA based on Ollama + gemma4:12b probe at mount
import { useState, useEffect, useRef, useCallback } from 'react';
async function openMembershipCheckout(onError) {
    try {
        const result = await window.amplify?.openMembershipCheckout?.();
        if (!result) {
            window.open('https://lianabanyan.com/join?source=mnemosynec-app', '_blank', 'noopener');
            return;
        }
        if (!result.ok) {
            onError?.(`Couldn't open membership page: ${result.error ?? 'unknown error'}`);
        }
    }
    catch {
        onError?.('Membership page could not open. Please visit lianabanyan.com/join');
    }
}
// ── Benchmark data (EXACT from CADRE_BENCHMARK_RESULTS_BP067.md lines 29-33) ─
const BENCHMARK_ROWS = [
    { model: 'Opus 4.8', cold: '6.0%', hot: '89.3%', lift: '+83.3pp' },
    { model: 'GPT-5.5', cold: '19.3%', hot: '93.3%', lift: '+74.0pp' },
    { model: 'Gemini-3.5-flash', cold: '8.0%', hot: '90.7%', lift: '+82.7pp' },
    { model: 'Llama-single (8b, free)', cold: '6.0%', hot: '78.0%', lift: '+72.0pp' },
];
function ctaLabelFor(probeState, ctaActive) {
    if (ctaActive)
        return 'Starting…';
    switch (probeState) {
        case 'probing': return 'Checking your system…';
        case 'ready': return 'Start using MnemosyneC';
        case 'has_ollama_no_model': return 'Download your AI model (2 min)';
        case 'no_ollama':
        default: return 'Set up your AI engine (2 min)';
    }
}
export function LeanWelcomeView({ onComplete }) {
    const [screen, setScreen] = useState(1);
    const [onboardingMemberNudgeDismissed, setOnboardingMemberNudgeDismissed] = useState(() => localStorage.getItem('mnemo_onboarding_member_nudge_dismissed') === '1');
    const handleMemberNudgeClick = useCallback(() => {
        void openMembershipCheckout();
    }, []);
    const handleMemberNudgeDismiss = useCallback(() => {
        localStorage.setItem('mnemo_onboarding_member_nudge_dismissed', '1');
        setOnboardingMemberNudgeDismissed(true);
        onComplete();
    }, [onComplete]);
    // Install progress state
    const [installStep, setInstallStep] = useState(null);
    const [installMessage, setInstallMessage] = useState('');
    const [installProgress, setInstallProgress] = useState(null);
    const [installError, setInstallError] = useState(null);
    // SEG-V0150-P0-FIX-BRIDGE-OR-FALLBACK: visible feedback + 5s fallback
    const [ctaActive, setCtaActive] = useState(false);
    const [showFallback, setShowFallback] = useState(false);
    const statusReceivedRef = useRef(false);
    const fallbackTimerRef = useRef(null);
    // SEG-V0150-P0-PROACTIVE: adaptive CTA based on Ollama probe
    const [ollamaProbe, setOllamaProbe] = useState('probing');
    // ── Mount: Ollama probe (parallel to event subscription) ──────────────────
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) });
                if (res.ok) {
                    const data = await res.json();
                    const models = (data.models ?? []).map((m) => m.name);
                    const hasGemma = models.some((m) => m === 'gemma4:12b' || m.startsWith('gemma4:12b:'));
                    setOllamaProbe(hasGemma ? 'ready' : 'has_ollama_no_model');
                }
                else {
                    setOllamaProbe('no_ollama');
                }
            }
            catch {
                setOllamaProbe('no_ollama');
            }
        })();
    }, []);
    // ── Mount: event subscriptions + SEG-V0150-P0-DIAGNOSE-BRIDGE probe ───────
    useEffect(() => {
        // Bridge probe diagnostic — readable via DevTools console or runDiagnostic log
        const w = window;
        console.log('[BRIDGE-PROBE] typeof window.amplify =', typeof window.amplify, '\n[BRIDGE-PROBE] typeof window.amplify?.leanInstallStart =', typeof window.amplify?.leanInstallStart, '\n[BRIDGE-PROBE] typeof window.amplify?.onLeanInstallStatus =', typeof window.amplify?.onLeanInstallStatus, '\n[BRIDGE-PROBE] window.__preloadLoaded =', w.__preloadLoaded ?? false);
        const unsub1 = window.amplify?.onLeanInstallStatus?.((data) => {
            statusReceivedRef.current = true;
            if (fallbackTimerRef.current) {
                clearTimeout(fallbackTimerRef.current);
                fallbackTimerRef.current = null;
            }
            setShowFallback(false);
            setInstallStep(data.step);
            setInstallMessage(data.message);
            if (data.step === 'done') {
                setCtaActive(false);
                onComplete();
            }
        });
        const unsub2 = window.amplify?.onLeanInstallProgress?.((data) => {
            setInstallProgress(data);
        });
        const unsub3 = window.amplify?.onLeanInstallError?.((data) => {
            setInstallError(data);
            setCtaActive(false);
            if (fallbackTimerRef.current) {
                clearTimeout(fallbackTimerRef.current);
                fallbackTimerRef.current = null;
            }
        });
        return () => {
            unsub1?.();
            unsub2?.();
            unsub3?.();
            if (fallbackTimerRef.current)
                clearTimeout(fallbackTimerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // ── CTA click handler ──────────────────────────────────────────────────────
    const handleCta = async () => {
        if (ctaActive || ollamaProbe === 'probing')
            return;
        // "ready" state: Ollama + model already present — skip install, go directly
        if (ollamaProbe === 'ready') {
            const res = await window.amplify?.writeSkuTierSkip?.();
            if (res?.ok !== false) {
                onComplete();
            }
            else {
                setInstallError({ message: 'Could not write setup file. Try restarting the app.', retryable: false });
            }
            return;
        }
        setInstallError(null);
        setShowFallback(false);
        statusReceivedRef.current = false;
        setCtaActive(true);
        // 5-second fallback — if IPC never emits a status event
        fallbackTimerRef.current = setTimeout(() => {
            if (!statusReceivedRef.current) {
                setShowFallback(true);
                setCtaActive(false);
            }
        }, 5000);
        window.amplify?.leanInstallStart?.();
    };
    // ── Skip handler (fallback path + "I have Ollama" affordance) ─────────────
    const handleSkip = async () => {
        await window.amplify?.writeSkuTierSkip?.();
        onComplete();
    };
    // ── Shared styles ──────────────────────────────────────────────────────────
    const overlay = {
        position: 'fixed',
        inset: 0,
        zIndex: 9600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0d1117',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        overflowY: 'auto',
        padding: '24px 16px',
    };
    const card = {
        width: '100%',
        maxWidth: 520,
        padding: '36px 32px',
        background: '#111827',
        border: '1px solid rgba(100, 116, 139, 0.2)',
        borderRadius: 12,
    };
    const mutedText = {
        fontSize: 12,
        color: '#475569',
        lineHeight: 1.5,
    };
    const bodyText = {
        fontSize: 14,
        color: '#94a3b8',
        lineHeight: 1.6,
        margin: '0 0 16px',
    };
    const featureLine = {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        fontSize: 13,
        color: '#94a3b8',
        lineHeight: 1.5,
        marginBottom: 8,
    };
    const dot = {
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: 'rgba(110, 231, 183, 0.5)',
        flexShrink: 0,
        marginTop: 5,
    };
    const ctaButton = {
        display: 'block',
        width: '100%',
        padding: '14px 20px',
        background: ctaActive || ollamaProbe === 'probing' ? '#16803a' : '#22c55e',
        color: '#fff',
        border: 'none',
        borderRadius: 8,
        fontSize: 15,
        fontWeight: 700,
        cursor: ctaActive || ollamaProbe === 'probing' ? 'not-allowed' : 'pointer',
        textAlign: 'center',
        marginBottom: 10,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        transition: 'background 150ms ease',
        opacity: ctaActive || ollamaProbe === 'probing' ? 0.75 : 1,
    };
    const tagline = {
        textAlign: 'center',
        fontSize: 11,
        color: '#475569',
        marginBottom: 28,
    };
    const ghostLink = {
        background: 'none',
        border: 'none',
        color: '#475569',
        fontSize: 12,
        cursor: 'pointer',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: 0,
        textDecoration: 'underline',
        textDecorationColor: 'rgba(71,85,105,0.4)',
    };
    // ── Step cards ─────────────────────────────────────────────────────────────
    const stepCards = (_jsx("div", { style: { display: 'flex', gap: 8, marginBottom: 28 }, children: [
            { step: '1', label: 'Tell it something', body: 'Share context with your AI once.' },
            { step: '2', label: 'Come back later', body: 'Start a fresh session any time.' },
            { step: '3', label: 'It remembers', body: 'Your context loads automatically.' },
        ].map(({ step, label, body }) => (_jsxs("div", { style: {
                flex: 1,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(100,116,139,0.15)',
                borderRadius: 8,
                padding: '12px 10px',
                textAlign: 'center',
            }, children: [_jsx("div", { style: { fontSize: 18, fontWeight: 700, color: '#6ee7b7', marginBottom: 4 }, children: step }), _jsx("div", { style: { fontSize: 12, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }, children: label }), _jsx("div", { style: { fontSize: 11, color: '#475569', lineHeight: 1.4 }, children: body })] }, step))) }));
    // ── Shared: install progress + fallback UI ─────────────────────────────────
    const installStatusBlock = (_jsxs(_Fragment, { children: [installStep && installStep !== 'done' && (_jsxs("div", { style: { marginTop: 12, fontSize: '0.82rem', color: '#aaa', textAlign: 'center' }, children: [installMessage, installStep === 'pulling_model' && installProgress && (_jsxs("div", { style: { marginTop: 8 }, children: [_jsx("div", { style: { background: '#1e2a1e', borderRadius: 4, height: 8, overflow: 'hidden' }, children: _jsx("div", { style: {
                                        background: '#22c55e', height: '100%', borderRadius: 4,
                                        width: `${installProgress.percentComplete.toFixed(1)}%`,
                                        transition: 'width 0.5s ease'
                                    } }) }), _jsxs("div", { style: { marginTop: 4, color: '#888', fontSize: '0.75rem' }, children: [(installProgress.bytesDownloaded / 1e9).toFixed(2), " GB / ", (installProgress.totalBytes / 1e9).toFixed(2), " GB \u00B7 ", installProgress.speedLabel, installProgress.eta_s > 0 && ` · ~${Math.round(installProgress.eta_s / 60)}m left`] })] })), installStep === 'waiting_ollama' && (_jsx("button", { style: { marginTop: 8, padding: '6px 16px', background: '#2a3a2a', border: '1px solid #3d7a3d',
                            borderRadius: 6, color: '#7dff7d', cursor: 'pointer', fontSize: '0.82rem' }, onClick: handleCta, children: "Resume after installing Ollama" }))] })), showFallback && (_jsxs("div", { style: {
                    marginTop: 12, padding: '12px 14px', background: 'rgba(251,191,36,0.07)',
                    border: '1px solid rgba(251,191,36,0.25)', borderRadius: 8,
                    fontSize: '0.82rem', color: '#fbbf24', textAlign: 'center',
                }, children: ["Setup is taking longer than expected.", _jsxs("div", { style: { marginTop: 8, display: 'flex', gap: 8, justifyContent: 'center' }, children: [_jsx("button", { style: { padding: '6px 14px', background: '#1a2a1a', border: '1px solid #3d7a3d',
                                    borderRadius: 6, color: '#6ee7b7', cursor: 'pointer', fontSize: '0.8rem' }, onClick: handleCta, children: "Try again" }), _jsx("button", { style: { padding: '6px 14px', background: 'rgba(100,116,139,0.15)', border: '1px solid rgba(100,116,139,0.3)',
                                    borderRadius: 6, color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem' }, onClick: handleSkip, children: "Skip \u00B7 I have Ollama already" })] })] })), installError && (_jsxs("div", { style: { marginTop: 8, fontSize: '0.78rem', color: '#f87171', textAlign: 'center' }, children: [installError.message, installError.retryable && (_jsx("button", { style: { marginLeft: 8, color: '#f87171', background: 'none', border: 'none',
                            cursor: 'pointer', textDecoration: 'underline' }, onClick: () => { setInstallError(null); void handleCta(); }, children: "Retry" }))] }))] }));
    // ── Screen 1: Download CTA ─────────────────────────────────────────────────
    if (screen === 1) {
        return (_jsx("div", { style: overlay, children: _jsxs("div", { style: card, children: [_jsx("div", { style: { textAlign: 'center', marginBottom: 20 }, children: _jsx("img", { src: "icons/mnemosynec-mark.png", alt: "MnemosyneC mascot", style: { height: 72, width: 'auto', objectFit: 'contain' }, onError: (e) => { e.target.style.display = 'none'; } }) }), _jsx("h1", { style: {
                            fontSize: '1.75rem',
                            fontWeight: 700,
                            color: '#e2e8f0',
                            lineHeight: 1.2,
                            margin: '0 0 4px',
                            textAlign: 'center',
                        }, children: "Your AI has Amnesia." }), _jsx("h2", { style: {
                            fontSize: '1.4rem',
                            fontWeight: 600,
                            color: '#6ee7b7',
                            lineHeight: 1.2,
                            margin: '0 0 8px',
                            textAlign: 'center',
                        }, children: "Dr. MnemosyneC has the Cure." }), _jsxs("p", { style: { ...mutedText, textAlign: 'center', marginBottom: 24 }, children: [_jsx("em", { children: "(neh-MOZ-uh-nee)" }), " \u00B7 the Greek goddess of memory"] }), _jsx("p", { style: bodyText, children: "Every time you start a new session, your AI forgets everything. Your projects, your preferences, your past conversations \u00B7 gone. Dr. MnemosyneC gives your AI a permanent, private memory that actually stays." }), _jsxs("div", { style: { marginBottom: 24 }, children: [_jsxs("div", { style: featureLine, children: [_jsx("span", { style: dot }), _jsx("span", { children: "Works alongside ChatGPT, Claude, Gemini, or any AI you already use." })] }), _jsxs("div", { style: featureLine, children: [_jsx("span", { style: dot }), _jsx("span", { children: "All your data stays on your own computer. No cloud. No account required." })] }), _jsxs("div", { style: featureLine, children: [_jsx("span", { style: dot }), _jsx("span", { children: "Free to use. A $5/year membership unlocks the full cooperative." })] })] }), stepCards, _jsx("button", { type: "button", style: ctaButton, disabled: ctaActive || ollamaProbe === 'probing', onClick: () => { void handleCta(); }, onMouseEnter: (e) => {
                            if (!ctaActive && ollamaProbe !== 'probing')
                                e.currentTarget.style.background = '#16a34a';
                        }, onMouseLeave: (e) => {
                            if (!ctaActive && ollamaProbe !== 'probing')
                                e.currentTarget.style.background = '#22c55e';
                        }, children: ctaLabelFor(ollamaProbe, ctaActive) }), installStatusBlock, _jsx("p", { style: tagline, children: "Free forever \u00B7 No ads \u00B7 No strings \u00B7 Data stays on your computer" }), !onboardingMemberNudgeDismissed && (_jsxs("div", { className: "onboarding-member-nudge", style: {
                            background: 'rgba(6,95,70,0.12)',
                            border: '1px solid rgba(5,150,105,0.3)',
                            borderRadius: 8,
                            padding: '12px 14px',
                            marginBottom: 14,
                            textAlign: 'center',
                        }, children: [_jsx("p", { style: { margin: '0 0 8px', fontSize: 12, color: '#6ee7b7', lineHeight: 1.5 }, children: "Want to do more? Join the cooperative for $5/yr." }), _jsx("button", { type: "button", className: "member-cta-secondary", onClick: handleMemberNudgeClick, style: {
                                    background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
                                    border: '1px solid #059669',
                                    borderRadius: 6,
                                    color: '#6ee7b7',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    padding: '6px 14px',
                                    cursor: 'pointer',
                                    fontFamily: 'system-ui, sans-serif',
                                    outline: 'none',
                                    marginRight: 8,
                                }, children: "Become a Member \u00B7 $5/yr" }), _jsx("button", { type: "button", className: "skip-link", onClick: handleMemberNudgeDismiss, style: {
                                    background: 'none',
                                    border: 'none',
                                    color: '#475569',
                                    fontSize: 11,
                                    cursor: 'pointer',
                                    fontFamily: 'system-ui, sans-serif',
                                    padding: 0,
                                    textDecoration: 'underline',
                                    textDecorationColor: 'rgba(71,85,105,0.4)',
                                }, children: "Maybe later" })] })), _jsx("div", { style: { textAlign: 'center', borderTop: '1px solid rgba(100,116,139,0.12)', paddingTop: 14 }, children: _jsx("button", { type: "button", style: ghostLink, onClick: () => setScreen(2), onMouseEnter: (e) => { e.currentTarget.style.color = '#94a3b8'; }, onMouseLeave: (e) => { e.currentTarget.style.color = '#475569'; }, children: "Does it actually work? See the proof \u2192" }) })] }) }));
    }
    // ── Screen 2: Benchmark proof ──────────────────────────────────────────────
    const thStyle = {
        textAlign: 'left',
        fontSize: 11,
        fontWeight: 600,
        color: '#6ee7b7',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        padding: '6px 10px',
        borderBottom: '1px solid rgba(100,116,139,0.2)',
        whiteSpace: 'nowrap',
    };
    const tdStyle = {
        padding: '8px 10px',
        fontSize: 13,
        color: '#94a3b8',
        borderBottom: '1px solid rgba(100,116,139,0.08)',
    };
    const hotStyle = {
        ...tdStyle,
        color: '#6ee7b7',
        fontWeight: 700,
    };
    const liftStyle = {
        ...tdStyle,
        color: '#22c55e',
        fontWeight: 700,
    };
    return (_jsx("div", { style: overlay, children: _jsxs("div", { style: card, children: [_jsx("button", { type: "button", style: { ...ghostLink, marginBottom: 20, display: 'inline-block' }, onClick: () => setScreen(1), onMouseEnter: (e) => { e.currentTarget.style.color = '#94a3b8'; }, onMouseLeave: (e) => { e.currentTarget.style.color = '#475569'; }, children: "\u2190 Back to Download" }), _jsx("h2", { style: {
                        fontSize: '1.4rem',
                        fontWeight: 700,
                        color: '#e2e8f0',
                        margin: '0 0 10px',
                    }, children: "Does it actually work?" }), _jsx("p", { style: { ...bodyText, marginBottom: 20 }, children: "75 questions \u00B7 4 AI vendors \u00B7 real test run 2026-05-30. No tricks." }), _jsx("div", { style: {
                        overflowX: 'auto',
                        borderRadius: 8,
                        border: '1px solid rgba(100,116,139,0.2)',
                        marginBottom: 20,
                    }, children: _jsxs("table", { style: { width: '100%', borderCollapse: 'collapse', fontSize: 13 }, children: [_jsx("thead", { children: _jsxs("tr", { style: { background: 'rgba(255,255,255,0.03)' }, children: [_jsx("th", { style: thStyle, children: "Model" }), _jsx("th", { style: { ...thStyle, textAlign: 'center' }, children: "WITHOUT MnemosyneC" }), _jsx("th", { style: { ...thStyle, textAlign: 'center' }, children: "WITH MnemosyneC" }), _jsx("th", { style: { ...thStyle, textAlign: 'center' }, children: "Lift" })] }) }), _jsx("tbody", { children: BENCHMARK_ROWS.map((row) => (_jsxs("tr", { style: { background: 'transparent' }, children: [_jsx("td", { style: tdStyle, children: row.model }), _jsx("td", { style: { ...tdStyle, textAlign: 'center' }, children: row.cold }), _jsx("td", { style: { ...hotStyle, textAlign: 'center' }, children: row.hot }), _jsx("td", { style: { ...liftStyle, textAlign: 'center' }, children: row.lift })] }, row.model))) })] }) }), _jsxs("div", { style: {
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(100,116,139,0.12)',
                        borderRadius: 8,
                        padding: '14px 16px',
                        marginBottom: 24,
                    }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 600, color: '#6ee7b7', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }, children: "Banyan Metric\u2122: How We Measure" }), _jsxs("p", { style: { ...mutedText, margin: 0 }, children: [_jsx("strong", { style: { color: '#94a3b8' }, children: "Accuracy" }), " = percentage of 75 factual questions answered correctly. ", _jsx("strong", { style: { color: '#94a3b8' }, children: "COLD" }), " = standard AI session with no substrate loaded (what you get today).", ' ', _jsx("strong", { style: { color: '#94a3b8' }, children: "HOT" }), " = same AI with MnemosyneC substrate preloaded. Inter-rater kappa: 0.936 (near-perfect agreement). Test date: 2026-05-30. Results hash-verified at BP067. All four vendors tested independently."] })] }), _jsx("button", { type: "button", style: ctaButton, disabled: ctaActive || ollamaProbe === 'probing', onClick: () => { void handleCta(); }, onMouseEnter: (e) => {
                        if (!ctaActive && ollamaProbe !== 'probing')
                            e.currentTarget.style.background = '#16a34a';
                    }, onMouseLeave: (e) => {
                        if (!ctaActive && ollamaProbe !== 'probing')
                            e.currentTarget.style.background = '#22c55e';
                    }, children: ctaLabelFor(ollamaProbe, ctaActive) }), installStatusBlock, _jsx("p", { style: tagline, children: "Free forever \u00B7 No ads \u00B7 No strings \u00B7 Data stays on your computer" })] }) }));
}
export default LeanWelcomeView;
