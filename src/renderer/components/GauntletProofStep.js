import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// GauntletProofStep.tsx -- BP078 Scope 3 (refactored to Pawn spec)
// Manages mode_select -> running -> results state machine.
// Props: Pawn Section 7 drop-in interface (audience, fromFirstRun, callbacks).
// Copy: Pawn Sections 1, 2.
// Results: delegates to CheckoutSuccessStep (Pawn Section 3).
import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckoutSuccessStep } from './CheckoutSuccessStep';
const NEW_USER_MODES = [
    { id: 'included', label: 'Use Included Test Data', sub: 'Best first run. Fast, guided, and comparable.' },
    { id: 'own_data', label: 'Choose Your Own Data', sub: 'Point MnemosyneC at a folder and build proof from your own files.' },
    { id: 'manual', label: 'Advanced Manual Mode', sub: 'Tune sources and run settings yourself.' },
];
const POWER_USER_MODES = [
    { id: 'included', label: 'Included Benchmark', sub: 'Fast baseline across standard test inputs.' },
    { id: 'own_data', label: 'Your Data', sub: 'Build from a selected folder and compare on live substrate inputs.' },
    { id: 'manual', label: 'Manual', sub: 'Direct control over source and run settings.' },
];
// ─── Shared styles ────────────────────────────────────────────────────────────
const overlay = {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0d1117',
    zIndex: 9600,
    padding: 16,
    fontFamily: 'system-ui, -apple-system, sans-serif',
};
const card = {
    background: '#111827',
    border: '1px solid rgba(100,116,139,0.2)',
    borderRadius: 12,
    padding: '36px 32px 28px',
    maxWidth: 480,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
};
const brandLine = {
    fontSize: 12,
    fontWeight: 700,
    color: '#6ee7b7',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: 20,
};
const heading = {
    margin: '0 0 8px',
    fontSize: 20,
    fontWeight: 800,
    color: '#e2e8f0',
    lineHeight: 1.25,
};
const body = {
    margin: '0 0 24px',
    fontSize: 14,
    color: '#64748b',
    lineHeight: 1.7,
};
const primaryBtn = {
    display: 'block',
    width: '100%',
    padding: '13px 20px',
    background: 'rgba(110,231,183,0.13)',
    border: '1px solid rgba(110,231,183,0.4)',
    borderRadius: 8,
    color: '#6ee7b7',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'center',
    marginBottom: 10,
    fontFamily: 'inherit',
};
const primaryBtnDisabled = {
    ...primaryBtn,
    background: 'rgba(110,231,183,0.04)',
    border: '1px solid rgba(110,231,183,0.15)',
    color: '#475569',
    cursor: 'not-allowed',
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
    padding: '5px 0',
    fontFamily: 'inherit',
};
const spinnerStyle = {
    width: 22,
    height: 22,
    border: '2px solid rgba(110,231,183,0.2)',
    borderTopColor: '#6ee7b7',
    borderRadius: '50%',
    animation: 'mnemo-spin 0.8s linear infinite',
    display: 'inline-block',
};
// ─── Component ────────────────────────────────────────────────────────────────
export function GauntletProofStep({ audience, fromFirstRun, installVersion, onOpenModeSelect, onOpenFrame, onRunProof, onJoin, onKeepUsing, analytics, }) {
    const [phase, setPhase] = useState({ id: 'mode_select' });
    const [selectedMode, setSelectedMode] = useState('included');
    const modeCards = audience === 'power_user' ? POWER_USER_MODES : NEW_USER_MODES;
    const headingText = audience === 'power_user' ? 'Select proof mode' : 'Choose what to prove';
    const bodyText = audience === 'power_user'
        ? 'Use the included benchmark for a clean baseline, or run against your own substrate for a live read on performance.'
        : 'Start with a fast included run, or use your own folder to see results on work that matters to you.';
    // Notify parent once on mount
    useEffect(() => {
        onOpenModeSelect();
        analytics?.track('gauntlet_mode_selected', {
            source: 'gauntlet_mode_select',
            mode: 'included',
            audience,
            from_first_run: fromFirstRun,
            for_techies_enabled: audience === 'power_user',
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const cancelRef = useRef(false);
    const handleRunProof = useCallback(async () => {
        const runId = `run_${Date.now()}`;
        setPhase({ id: 'running', mode: selectedMode, runId });
        cancelRef.current = false;
        onRunProof(selectedMode);
        analytics?.track('gauntlet_mode_selected', {
            source: 'gauntlet_mode_select',
            mode: selectedMode,
            audience,
            from_first_run: fromFirstRun,
            for_techies_enabled: audience === 'power_user',
        });
        let metrics = { live: false };
        try {
            const result = await window.amplify?.runMeshTest?.({ testId: runId, timeoutMs: 45000 });
            if (!cancelRef.current) {
                if (result?.success === true && result.grading && !result.static_fallback) {
                    metrics = {
                        live: true,
                        p50LatencyMs: result.grading.p50_latency_ms,
                        sourcesCount: result.grading.hash_verified,
                    };
                }
            }
        }
        catch {
            // fallback metrics stay as { live: false }
        }
        if (!cancelRef.current) {
            analytics?.track('gauntlet_live_results_viewed', {
                source: 'gauntlet_results',
                run_id: runId,
                metrics_live: metrics.live,
                banyan_metric: metrics.banyanMetric,
                p50_latency_ms: metrics.p50LatencyMs,
                sources_count: metrics.sourcesCount,
                stage_count: metrics.stageCount,
                mode: selectedMode,
            });
            setPhase({ id: 'results', mode: selectedMode, runId, metrics });
        }
    }, [selectedMode, audience, fromFirstRun, onRunProof, analytics]);
    useEffect(() => {
        return () => { cancelRef.current = true; };
    }, []);
    // ── Mode select phase ────────────────────────────────────────────────────────
    if (phase.id === 'mode_select') {
        return (_jsxs(_Fragment, { children: [_jsx("style", { children: `@keyframes mnemo-spin { to { transform: rotate(360deg); } }` }), _jsx("div", { style: overlay, children: _jsxs("div", { style: card, children: [_jsx("div", { style: brandLine, children: "MnemosyneC" }), _jsx("h2", { style: heading, children: headingText }), _jsx("p", { style: body, children: bodyText }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }, children: modeCards.map((m) => {
                                    const selected = selectedMode === m.id;
                                    return (_jsxs("button", { type: "button", onClick: () => setSelectedMode(m.id), style: {
                                            padding: '12px 14px',
                                            background: selected ? 'rgba(6,78,59,0.2)' : 'rgba(15,23,42,0.5)',
                                            border: selected ? '1px solid rgba(110,231,183,0.45)' : '1px solid rgba(100,116,139,0.2)',
                                            borderRadius: 8,
                                            textAlign: 'left',
                                            cursor: 'pointer',
                                            fontFamily: 'inherit',
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: 10,
                                        }, children: [_jsx("div", { style: {
                                                    width: 14,
                                                    height: 14,
                                                    borderRadius: '50%',
                                                    border: selected ? '3px solid #6ee7b7' : '2px solid rgba(100,116,139,0.4)',
                                                    flexShrink: 0,
                                                    marginTop: 2,
                                                    background: selected ? 'rgba(110,231,183,0.2)' : 'transparent',
                                                } }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 13, fontWeight: 700, color: selected ? '#6ee7b7' : '#cbd5e1', marginBottom: 2 }, children: m.label }), _jsx("div", { style: { fontSize: 12, color: '#64748b', lineHeight: 1.5 }, children: m.sub })] })] }, m.id));
                                }) }), _jsx("button", { type: "button", style: primaryBtn, onClick: () => { void handleRunProof(); }, children: "Run proof" }), _jsx("button", { type: "button", style: ghostBtn, onClick: onOpenFrame, children: "Ask it anything" })] }) })] }));
    }
    // ── Running phase ────────────────────────────────────────────────────────────
    if (phase.id === 'running') {
        return (_jsxs(_Fragment, { children: [_jsx("style", { children: `@keyframes mnemo-spin { to { transform: rotate(360deg); } }` }), _jsxs("div", { style: { ...overlay, flexDirection: 'column', gap: 16 }, children: [_jsx("span", { style: spinnerStyle }), _jsxs("div", { style: { textAlign: 'center' }, children: [_jsx("div", { style: { fontSize: 15, fontWeight: 600, color: '#e2e8f0', marginBottom: 6 }, children: "Running proof..." }), _jsx("div", { style: { fontSize: 12, color: '#64748b' }, children: "Testing peer resolution accuracy. Takes up to 45 seconds." })] })] })] }));
    }
    // ── Results phase (CheckoutSuccessStep) ───────────────────────────────────────
    return (_jsx(CheckoutSuccessStep, { runId: phase.runId, mode: phase.mode, metrics: phase.metrics, onJoin: onJoin, onKeepUsing: onKeepUsing, analytics: analytics }));
}
