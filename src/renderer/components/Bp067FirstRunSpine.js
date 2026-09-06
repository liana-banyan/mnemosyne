import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// Bp067FirstRunSpine.tsx -- BP075 v0.1.26 minimal professional first-run
// SEG-R-1: WelcomeView (Amnesia headline + two-doorway cascade) is now step 'welcome'.
// Steps: welcome (WelcomeView) -> try-it -> success -> gauntlet -> first_steps -> app
// Preserved: askFloorModel elephant test, 3-option fallback, LS_BP067_FIRST_RUN_COMPLETE gate
// Removed: scroll-crawl animation, Founder voice audio, HEOHO blocking step, forced folder step
//
// BP133 Yoke #24 Task 0 (SHIPPING BLOCKER FIX): a real user hit a permanent dead end inside
// step 'welcome' -> Layer2ProveIt -> screenMode 'confirming' ("Full progress view coming in
// the next update"), which never called onComplete and had no path back to the tabbed shell
// (the only escape, LeanModeNudge, renders underneath this component's zIndex:9600 full-screen
// overlay and is therefore invisible/unclickable). Fix: a persistent, always-rendered "Skip
// intro" escape hatch (SkipIntroButton below) sits above every single step at zIndex 9700 (above
// the 9600 overlay) and unconditionally calls handleFinish -> commitFirstRunDone -> onComplete.
// No future step, however broken or half-built, can trap a user again: this hatch does not
// depend on that step's own JSX having a working forward path.
import { useState, useEffect, useRef, useCallback } from 'react';
import { GauntletProofStep } from './GauntletProofStep';
import { FirstStepsView } from './FirstStepsView';
import { WelcomeView, LS_ONBOARDING_COMPLETE } from './WelcomeView';
export const LS_BP067_FIRST_RUN_COMPLETE = 'mnemosyne-bp067-first-run-complete';
export const LS_SALTFIGHTER_SKIP = 'mnemosyne-saltfighter-skip';
const AUTO_TEST_PROMPT = 'What is the name of a famous elephant?';
const TRY_IT_TIMEOUT_MS = 30000;
function commitFirstRunDone(onComplete) {
    try {
        localStorage.setItem(LS_BP067_FIRST_RUN_COMPLETE, 'true');
        localStorage.setItem(LS_ONBOARDING_COMPLETE, 'true');
    }
    catch { /* ignore storage errors */ }
    void window.amplify?.markBp067FirstRunComplete?.();
    onComplete();
}
// Inline green check SVG -- no external icon dep
function CheckIcon() {
    return (_jsxs("svg", { width: "32", height: "32", viewBox: "0 0 32 32", fill: "none", "aria-hidden": "true", children: [_jsx("circle", { cx: "16", cy: "16", r: "15", fill: "rgba(74,222,128,0.15)", stroke: "#4ade80", strokeWidth: "1.5" }), _jsx("path", { d: "M9 16.5l5 5 9-9", stroke: "#4ade80", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" })] }));
}
// Shared CSS injected once per mount
const KEYFRAMES = `@keyframes mnemo-spin { to { transform: rotate(360deg); } }`;
// BP133 Yoke #24 Task 0 -- always-on-top escape hatch, see file header note.
// zIndex 9700 is deliberately above every step overlay in this file and in WelcomeView.tsx
// (all of which use 9600), so it can never be visually covered by a step's own content.
function SkipIntroButton({ onSkip }) {
    return (_jsx("button", { type: "button", onClick: onSkip, title: "Skip the intro and go straight to the app -- you can revisit this from Settings", style: {
            position: 'fixed',
            top: 12,
            right: 16,
            zIndex: 9700,
            background: 'rgba(15,23,42,0.85)',
            border: '1px solid rgba(100,116,139,0.35)',
            borderRadius: 6,
            color: '#94a3b8',
            fontSize: 11,
            fontWeight: 600,
            padding: '5px 12px',
            cursor: 'pointer',
            fontFamily: 'system-ui, -apple-system, sans-serif',
        }, children: "Skip intro -> go to app" }));
}
export function Bp067FirstRunSpine({ onComplete, onAskOnboard }) {
    const [step, setStep] = useState('welcome');
    const [visible, setVisible] = useState(true);
    // try-it state
    const [aiResponse, setAiResponse] = useState(null);
    const [asking, setAsking] = useState(false);
    const timeoutRef = useRef(null);
    // options state
    const [optionState, setOptionState] = useState('idle');
    const [borrowResult, setBorrowResult] = useState(null);
    const [customModelPath, setCustomModelPath] = useState(null);
    const [retryError, setRetryError] = useState(null);
    // folder state
    const [folderPicked, setFolderPicked] = useState(null);
    const [pickingFolder, setPickingFolder] = useState(false);
    // 200ms fade transition between steps
    const goTo = useCallback((next) => {
        setVisible(false);
        setTimeout(() => {
            setStep(next);
            setVisible(true);
        }, 200);
    }, []);
    // Auto-fire elephant test when entering try-it
    useEffect(() => {
        if (step !== 'try-it')
            return;
        let cancelled = false;
        setAsking(true);
        setAiResponse(null);
        timeoutRef.current = setTimeout(() => {
            if (!cancelled) {
                setAsking(false);
                goTo('options');
            }
        }, TRY_IT_TIMEOUT_MS);
        void (async () => {
            try {
                const result = await window.amplify?.askFloorModel?.(AUTO_TEST_PROMPT);
                if (cancelled)
                    return;
                if (timeoutRef.current)
                    clearTimeout(timeoutRef.current);
                if (result?.ok && result.text) {
                    setAiResponse(result.text);
                    setAsking(false);
                    goTo('success');
                }
                else {
                    setAsking(false);
                    goTo('options');
                }
            }
            catch {
                if (cancelled)
                    return;
                if (timeoutRef.current)
                    clearTimeout(timeoutRef.current);
                setAsking(false);
                goTo('options');
            }
        })();
        return () => {
            cancelled = true;
            if (timeoutRef.current)
                clearTimeout(timeoutRef.current);
        };
    }, [step, goTo]);
    const handleFinish = useCallback(() => {
        commitFirstRunDone(onComplete);
    }, [onComplete]);
    // Step 3 "Ask it anything" -- completes first-run AND fires the 3-option join funnel modal.
    // Uses onAskOnboard if provided (wired by MnemosyneTabView to setShowOnboardAsk(true));
    // falls back to plain onComplete for backward compatibility.
    const handleAskOnboard = useCallback(() => {
        commitFirstRunDone(onAskOnboard ?? onComplete);
    }, [onComplete, onAskOnboard]);
    const handlePickFolder = async () => {
        setPickingFolder(true);
        try {
            const result = await window.amplify?.watcher?.openFolderDialog?.();
            if (result && !result.canceled && result.filePaths.length > 0) {
                setFolderPicked(result.filePaths[0]);
                void window.amplify?.watcher?.addFolder?.(result.filePaths[0]).catch(() => { });
            }
        }
        catch { /* dialog unavailable */ }
        finally {
            setPickingFolder(false);
        }
    };
    const handleRetrySetup = async () => {
        setOptionState('retrying');
        setRetryError(null);
        try {
            const result = await window.amplify?.setupPrivateAI?.();
            if (result?.ok) {
                setOptionState('retry-ok');
                setTimeout(() => goTo('try-it'), 800);
            }
            else {
                setRetryError(result?.error ?? 'Setup failed.');
                setOptionState('retry-err');
            }
        }
        catch {
            setRetryError('Could not start setup.');
            setOptionState('retry-err');
        }
    };
    const handleBorrow = async () => {
        setOptionState('borrowing');
        setBorrowResult(null);
        try {
            const r = await window.amplify?.lbRequestFrontierBorrow?.();
            setBorrowResult(r ?? { ok: false, error: 'No response from mesh.' });
        }
        catch {
            setBorrowResult({ ok: false, error: 'Could not reach the mesh.' });
        }
        finally {
            setOptionState('borrow-result');
        }
    };
    // ── Shared style constants ─────────────────────────────────────────────────
    const overlay = {
        position: 'fixed',
        inset: 0,
        zIndex: 9600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0d1117',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        opacity: visible ? 1 : 0,
        transition: 'opacity 200ms ease',
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
        fontSize: 22,
        fontWeight: 800,
        color: '#e2e8f0',
        lineHeight: 1.25,
        margin: '0 0 10px',
    };
    const body = {
        fontSize: 14,
        color: '#64748b',
        lineHeight: 1.7,
        margin: '0 0 28px',
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
        marginBottom: 12,
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
        padding: '6px 0',
    };
    const footNote = {
        fontSize: 11,
        color: '#334155',
        marginTop: 20,
        lineHeight: 1.6,
        textAlign: 'center',
    };
    const spinner = {
        width: 22,
        height: 22,
        border: '2px solid rgba(110,231,183,0.2)',
        borderTopColor: '#6ee7b7',
        borderRadius: '50%',
        animation: 'mnemo-spin 0.8s linear infinite',
        display: 'inline-block',
    };
    const optionCard = {
        marginBottom: 10,
        padding: '12px 14px',
        background: 'rgba(15,23,42,0.5)',
        border: '1px solid rgba(100,116,139,0.2)',
        borderRadius: 8,
    };
    // ── Step 1: Welcome (SEG-R-1 -- WelcomeView Amnesia headline + two-doorway cascade) ──
    if (step === 'welcome') {
        return (_jsxs(_Fragment, { children: [_jsx(WelcomeView, { onComplete: handleFinish }), _jsx(SkipIntroButton, { onSkip: handleFinish })] }));
    }
    // ── Step 2: Try it (auto elephant test fires in useEffect) ─────────────────
    if (step === 'try-it') {
        return (_jsxs(_Fragment, { children: [_jsx("style", { children: KEYFRAMES }), _jsx("div", { style: overlay, children: _jsxs("div", { style: { ...card, textAlign: 'center' }, children: [_jsx("div", { style: brandLine, children: "MnemosyneC" }), _jsx("div", { style: { marginBottom: 20 }, children: _jsx("span", { style: spinner }) }), _jsx("h2", { style: { ...heading, fontSize: 18 }, children: asking ? 'Asking your AI a quick question.' : 'Connecting...' }), _jsxs("p", { style: { ...body, fontSize: 12 }, children: ["\u201C", AUTO_TEST_PROMPT, "\u201D"] })] }) }), _jsx(SkipIntroButton, { onSkip: handleFinish })] }));
    }
    // ── Step 3: Success ──────────────────────────────────────────────────────────
    if (step === 'success') {
        return (_jsxs(_Fragment, { children: [_jsx("div", { style: overlay, children: _jsxs("div", { style: card, children: [_jsx("div", { style: { marginBottom: 16 }, children: _jsx(CheckIcon, {}) }), _jsx("h2", { style: { ...heading, fontSize: 20, marginBottom: 10 }, children: "Your AI works." }), aiResponse && (_jsxs("blockquote", { style: {
                                    borderLeft: '3px solid rgba(110,231,183,0.4)',
                                    margin: '0 0 18px',
                                    padding: '10px 14px',
                                    background: 'rgba(6,78,59,0.12)',
                                    borderRadius: '0 6px 6px 0',
                                    fontSize: 13,
                                    color: '#cbd5e1',
                                    lineHeight: 1.7,
                                    maxHeight: 140,
                                    overflowY: 'auto',
                                }, children: [aiResponse.slice(0, 600), aiResponse.length > 600 ? '...' : ''] })), _jsx("p", { style: { ...body, fontSize: 13, marginBottom: 20 }, children: "Run a quick live check on included test data or your own folder and see what this install actually saves in speed, cost, and reach." }), _jsx("button", { type: "button", style: primaryBtn, onClick: () => goTo('gauntlet'), children: "See your proof" }), _jsx("button", { type: "button", style: ghostBtn, onClick: handleAskOnboard, children: "Ask it anything" })] }) }), _jsx(SkipIntroButton, { onSkip: handleFinish })] }));
    }
    // ── Step 3b: Gauntlet mesh proof (Founder binding 2 -- optional, always skippable) ────
    if (step === 'gauntlet') {
        return (_jsxs(_Fragment, { children: [_jsx(GauntletProofStep, { audience: "new_user", fromFirstRun: true, onOpenModeSelect: () => { }, onOpenFrame: handleAskOnboard, onRunProof: () => { }, onJoin: () => { goTo('first_steps'); }, onKeepUsing: handleAskOnboard }), _jsx(SkipIntroButton, { onSkip: handleFinish })] }));
    }
    // ── Step 3c: Intent capture + $5 checkout (FirstStepsView) ───────────────────
    if (step === 'first_steps') {
        return (_jsxs(_Fragment, { children: [_jsx(FirstStepsView, { onSelectIntent: () => { }, onCheckout: () => { }, onRoutePath: handleAskOnboard }), _jsx(SkipIntroButton, { onSkip: handleFinish })] }));
    }
    // ── Step 4: Options (shown on error or timeout) ─────────────────────────────
    if (step === 'options') {
        return (_jsxs(_Fragment, { children: [_jsx("style", { children: KEYFRAMES }), _jsx("div", { style: overlay, children: _jsxs("div", { style: { ...card, maxWidth: 500 }, children: [_jsx("div", { style: brandLine, children: "MnemosyneC" }), _jsx("h2", { style: { ...heading, fontSize: 18, marginBottom: 8 }, children: "Let's try a different way." }), _jsx("p", { style: { ...body, fontSize: 12, marginBottom: 20 }, children: "The AI did not respond. Choose how to continue." }), _jsxs("div", { style: { ...optionCard, border: '1px solid rgba(110,231,183,0.22)', background: 'rgba(6,78,59,0.1)' }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 700, color: '#6ee7b7', marginBottom: 4 }, children: "A -- Use the bundled AI" }), _jsx("div", { style: { fontSize: 11, color: '#94a3b8', marginBottom: 10, lineHeight: 1.5 }, children: "Retry local Ollama engine setup. Private, free, works offline." }), optionState === 'retrying' && (_jsxs("div", { style: { fontSize: 11, color: '#6ee7b7', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("span", { style: spinner }), "Setting up..."] })), optionState === 'retry-ok' && (_jsx("div", { style: { fontSize: 11, color: '#4ade80', marginBottom: 8 }, children: "Setup succeeded. Retrying test..." })), retryError && (_jsx("div", { style: { fontSize: 11, color: '#f87171', marginBottom: 8 }, children: retryError })), optionState !== 'retrying' && optionState !== 'retry-ok' && (_jsx("button", { type: "button", onClick: () => { void handleRetrySetup(); }, style: { padding: '6px 14px', background: 'rgba(110,231,183,0.12)', border: '1px solid rgba(110,231,183,0.3)', borderRadius: 6, color: '#6ee7b7', cursor: 'pointer', fontSize: 11, fontWeight: 600 }, children: optionState === 'retry-err' ? 'Try again' : 'Start bundled AI' }))] }), _jsxs("div", { style: optionCard, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 700, color: '#60a5fa', marginBottom: 4 }, children: "B -- Borrow a trusted friend\u2019s node" }), _jsx("div", { style: { fontSize: 11, color: '#94a3b8', marginBottom: 10, lineHeight: 1.5 }, children: "Use a Frontier node shared by a community member. Small transport fee may apply." }), optionState === 'borrowing' && (_jsx("div", { style: { fontSize: 11, color: '#60a5fa', marginBottom: 8 }, children: "Contacting the mesh..." })), optionState === 'borrow-result' && borrowResult && (_jsx("div", { style: {
                                            marginBottom: 8, padding: '8px 10px',
                                            background: borrowResult.ok ? 'rgba(59,130,246,0.1)' : 'rgba(239,68,68,0.08)',
                                            border: `1px solid ${borrowResult.ok ? 'rgba(59,130,246,0.3)' : 'rgba(239,68,68,0.25)'}`,
                                            borderRadius: 6, fontSize: 11,
                                            color: borrowResult.ok ? '#93c5fd' : '#fca5a5',
                                            lineHeight: 1.6,
                                        }, children: borrowResult.ok
                                            ? `Connected to ${borrowResult.node_count ?? 1} node${(borrowResult.node_count ?? 1) !== 1 ? 's' : ''}. ${borrowResult.disclosure ?? ''}`
                                            : (borrowResult.error ?? 'Could not reach a frontier node.') })), optionState !== 'borrowing' && (_jsx("button", { type: "button", onClick: () => { void handleBorrow(); }, style: { padding: '6px 14px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 6, color: '#60a5fa', cursor: 'pointer', fontSize: 11, fontWeight: 600 }, children: optionState === 'borrow-result' ? 'Try again' : 'Request a frontier node' }))] }), _jsxs("div", { style: { ...optionCard, marginBottom: 16 }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 700, color: '#a78bfa', marginBottom: 4 }, children: "C -- Choose a different AI folder" }), _jsx("div", { style: { fontSize: 11, color: '#94a3b8', marginBottom: 10, lineHeight: 1.5 }, children: "Point to a folder where you have Ollama models already downloaded." }), customModelPath && (_jsx("div", { style: { marginBottom: 8, padding: '6px 10px', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 6, fontSize: 10, color: '#c4b5fd', wordBreak: 'break-all' }, children: customModelPath })), _jsx("button", { type: "button", onClick: () => {
                                            void (async () => {
                                                try {
                                                    const result = await window.amplify?.watcher?.openFolderDialog?.();
                                                    if (result && !result.canceled && result.filePaths.length > 0) {
                                                        setCustomModelPath(result.filePaths[0]);
                                                    }
                                                }
                                                catch { /* dialog unavailable */ }
                                            })();
                                        }, style: { padding: '6px 14px', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 6, color: '#a78bfa', cursor: 'pointer', fontSize: 11, fontWeight: 600 }, children: customModelPath ? 'Choose different folder' : 'Browse for model folder' })] }), _jsx("button", { type: "button", style: ghostBtn, onClick: handleFinish, children: "Continue without AI for now" })] }) }), _jsx(SkipIntroButton, { onSkip: handleFinish })] }));
    }
    // ── Optional Step 5: Folder picker (reached from success tertiary link) ──────
    if (step === 'folder') {
        return (_jsxs(_Fragment, { children: [_jsx("style", { children: KEYFRAMES }), _jsx("div", { style: overlay, children: _jsxs("div", { style: card, children: [_jsx("div", { style: brandLine, children: "MnemosyneC" }), _jsx("h2", { style: { ...heading, fontSize: 18, marginBottom: 8 }, children: "Add a folder to your AI\u2019s memory." }), _jsx("p", { style: { ...body, fontSize: 13, marginBottom: 20 }, children: "Pick any folder and your AI will remember everything in it -- notes, documents, projects. Stays private on your computer. You can add more in Settings." }), folderPicked ? (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, padding: '10px 12px', background: 'rgba(6,78,59,0.15)', border: '1px solid rgba(110,231,183,0.3)', borderRadius: 6, fontSize: 12, color: '#6ee7b7' }, children: [_jsx("span", { children: "+" }), _jsx("span", { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: folderPicked }), _jsx("button", { type: "button", onClick: () => setFolderPicked(null), style: { background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 14, padding: 0 }, children: '×' })] })) : (_jsx("button", { type: "button", onClick: () => { void handlePickFolder(); }, disabled: pickingFolder, style: { display: 'block', width: '100%', padding: '12px 14px', marginBottom: 20, background: 'rgba(59,130,246,0.07)', border: '1px dashed rgba(59,130,246,0.35)', borderRadius: 8, color: '#60a5fa', fontSize: 13, fontWeight: 600, cursor: pickingFolder ? 'not-allowed' : 'pointer', textAlign: 'center' }, children: pickingFolder ? 'Opening...' : 'Choose a folder' })), _jsx("button", { type: "button", style: primaryBtn, onClick: handleFinish, children: folderPicked ? 'Done -- open the app' : 'Open the app' }), _jsx("button", { type: "button", style: ghostBtn, onClick: handleFinish, children: "Skip for now" })] }) }), _jsx(SkipIntroButton, { onSkip: handleFinish })] }));
    }
    // BP133 Yoke #24 Task 0: unreachable in the current Step union (every declared step is
    // handled above), but if `step` were ever set to an unrecognised value by future code,
    // the original `return null` here rendered a BLANK WINDOW -- indistinguishable from a
    // hang, and with no forward path at all. Truth-Always fallback: never render nothing.
    return (_jsx("div", { style: overlay, children: _jsxs("div", { style: card, children: [_jsx("div", { style: brandLine, children: "MnemosyneC" }), _jsx("h2", { style: { ...heading, fontSize: 16 }, children: "Something went sideways during setup." }), _jsxs("p", { style: { ...body, fontSize: 12 }, children: ["Unrecognised setup step (\"", String(step), "\"). This is a bug, not something you did."] }), _jsx("button", { type: "button", style: primaryBtn, onClick: handleFinish, children: "Continue to the app" })] }) }));
}
export default Bp067FirstRunSpine;
