import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// MnemosyneC — Onboarding Screen Components
// BP065 v0.1.23 — Minimal-click revamp per canon eblets:
//   canon_onboarding_minimal_clicks_sensible_defaults_skip_everything_explain_or_skip_bp065
//   canon_mnemosynec_minimum_install_substrate_only_no_ollama_no_key_any_hardware_bp065
//   canon_ai_burst_works_key_free_by_default_api_key_optional_never_block_untech_bp065
//
// NEW flow: 3 screens · minimum 2 clicks · or 1-click "Skip all → open the app"
//   Screen 1: Welcome + Skip-all affordance
//   Screen 2: ~4 optional questions, all with defaults, all skippable
//   Screen 3: All Set — auto-proceeds after 3 seconds
//
// Replaces 5-screen, 6-click flow (Welcome, Identity, FirstBanyan, Federation, Roll).
import { useState, useEffect } from 'react';
// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
    bg: '#0a0f1a',
    surface: '#111827',
    border: '#1e2d45',
    text: '#e2e8f0',
    muted: '#64748b',
    accent: '#3b82f6',
    green: '#22c55e',
    amber: '#f59e0b',
};
// ─── Progress indicator ───────────────────────────────────────────────────────
export function ProgressDots({ step, total }) {
    return (_jsx("div", { style: { display: 'flex', gap: 6, justifyContent: 'center', margin: '20px 0 0' }, children: Array.from({ length: total }).map((_, i) => (_jsx("div", { style: {
                width: i === step - 1 ? 20 : 8,
                height: 8,
                borderRadius: 4,
                background: i < step ? C.accent : i === step - 1 ? C.accent : C.border,
                opacity: i < step ? 0.5 : 1,
                transition: 'all 0.3s',
            } }, i))) }));
}
// ─── Screen 1: Welcome ────────────────────────────────────────────────────────
// Canon: explain in plain English, no jargon, "Skip all" prominent.
// Keypair auto-generated silently on mount — no click needed.
export function ScreenWelcome({ onNext, onSkip, step, totalSteps }) {
    useEffect(() => {
        // Silent background keypair generation — no user action or UI required.
        try {
            void window.amplify?.generateMemberKeypair?.();
        }
        catch { /* non-fatal */ }
    }, []);
    return (_jsxs("div", { style: s.screen, children: [_jsx("div", { style: { fontSize: 48, marginBottom: 12, textAlign: 'center' }, children: "\uD83C\uDF3F" }), _jsx("h1", { style: s.title, children: "Welcome to MnemosyneC\u2122" }), _jsxs("p", { style: s.body, children: ["Your private AI memory that runs on ", _jsx("em", { children: "your" }), " computer. No account required. No cloud upload. Free forever."] }), _jsxs("div", { style: s.infoBox, children: [_jsx("div", { style: { fontWeight: 700, fontSize: 12, color: C.text, marginBottom: 6 }, children: "\uD83D\uDEE1\uFE0F What MnemosyneC does" }), _jsx("div", { style: { fontSize: 11, color: C.muted, lineHeight: 1.7 }, children: "Reads folders you choose, builds a private memory index, and lets you search and query your own knowledge using local AI \u2014 entirely offline if you prefer. Your files are never moved, modified, or uploaded." })] }), _jsx("button", { onClick: () => onNext(), style: s.primaryBtn, children: "Get Started \u2192" }), _jsx("button", { onClick: onSkip, style: s.skipAllBtn, children: "Skip all \u2192 open the app" }), _jsx(ProgressDots, { step: step, total: totalSteps })] }));
}
export function ScreenSetup({ onNext, onSkip, step, totalSteps }) {
    const [displayName, setDisplayName] = useState('');
    const [addDesktopShortcut, setAddDesktopShortcut] = useState(true);
    const [addStartupItem, setAddStartupItem] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const handleApply = () => {
        onNext({ displayName, addDesktopShortcut, addStartupItem, apiKey });
    };
    return (_jsxs("div", { style: s.screen, children: [_jsx("h2", { style: s.title, children: "Quick Setup" }), _jsx("p", { style: { ...s.body, marginBottom: 18 }, children: "All optional. Sensible defaults are already set \u2014 just change what you want." }), _jsxs("div", { style: s.question, children: [_jsxs("div", { style: s.questionLabel, children: ["What should we call you?", _jsx("span", { style: s.optTag, children: "optional" })] }), _jsx("p", { style: s.questionDesc, children: "Used only on this device \u2014 never shared or uploaded." }), _jsx("input", { value: displayName, onChange: (e) => setDisplayName(e.target.value), placeholder: "Your name or nickname", style: s.input, maxLength: 60 })] }), _jsxs("div", { style: s.question, children: [_jsxs("label", { style: s.checkRow, children: [_jsx("input", { type: "checkbox", checked: addDesktopShortcut, onChange: (e) => setAddDesktopShortcut(e.target.checked), style: { accentColor: C.accent, width: 15, height: 15, flexShrink: 0 } }), _jsx("span", { style: s.questionLabel, children: "Add a shortcut to your Desktop" })] }), _jsx("p", { style: { ...s.questionDesc, marginLeft: 23 }, children: "Makes it easy to launch MnemosyneC anytime by double-clicking the icon." })] }), _jsxs("div", { style: s.question, children: [_jsxs("label", { style: s.checkRow, children: [_jsx("input", { type: "checkbox", checked: addStartupItem, onChange: (e) => setAddStartupItem(e.target.checked), style: { accentColor: C.accent, width: 15, height: 15, flexShrink: 0 } }), _jsx("span", { style: s.questionLabel, children: "Start automatically when Windows starts?" })] }), _jsx("p", { style: { ...s.questionDesc, marginLeft: 23 }, children: "MnemosyneC will be ready in the background before you need it. Change anytime in Settings." })] }), _jsxs("div", { style: s.question, children: [_jsxs("div", { style: s.questionLabel, children: ["AI key for cloud-enhanced results", _jsx("span", { style: s.optTag, children: "optional" })] }), _jsxs("p", { style: s.questionDesc, children: ["AI Burst works ", _jsx("strong", { style: { color: C.green }, children: "free and local" }), " without a key \u2014 local AI already gives strong results. Add a key later in Settings if you want cloud-frontier analysis."] }), _jsx("input", { value: apiKey, onChange: (e) => setApiKey(e.target.value), placeholder: "sk-ant-... (leave blank \u2014 AI Burst works without it)", style: s.input, type: "password", autoComplete: "off" })] }), _jsx("button", { onClick: handleApply, style: { ...s.primaryBtn, marginTop: 16 }, children: "Apply & Continue \u2192" }), _jsx("button", { onClick: onSkip, style: s.skipAllBtn, children: "Skip all \u2192 open the app" }), _jsx(ProgressDots, { step: step, total: totalSteps })] }));
}
// ─── Screen 3: All Set ────────────────────────────────────────────────────────
// Canon: confirm, auto-proceed after 3 seconds.
export function ScreenAllSet({ onNext, onSkip, step, totalSteps }) {
    const [countdown, setCountdown] = useState(3);
    useEffect(() => {
        if (countdown <= 0) {
            onNext();
            return;
        }
        const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [countdown, onNext]);
    return (_jsxs("div", { style: s.screen, children: [_jsx("div", { style: { fontSize: 48, marginBottom: 12, textAlign: 'center' }, children: "\u2705" }), _jsx("h2", { style: s.title, children: "You're all set." }), _jsx("p", { style: s.body, children: "MnemosyneC is ready. Your private memory is running. No account required. No cloud upload." }), _jsx("p", { style: { fontSize: 11, color: C.muted, textAlign: 'center', marginBottom: 20 }, children: "You can add folders to index from the Substrate tab anytime." }), _jsxs("button", { onClick: () => onNext(), style: s.primaryBtn, children: ["Open MnemosyneC", countdown > 0 ? ` (${countdown})` : '', " \u2192"] }), _jsx("button", { onClick: onSkip, style: { ...s.skipAllBtn, opacity: 0.6 }, children: "Skip" }), _jsx(ProgressDots, { step: step, total: totalSteps })] }));
}
// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
    screen: {
        maxWidth: 420,
        margin: '0 auto',
        padding: '0 4px',
        display: 'flex',
        flexDirection: 'column',
    },
    title: {
        margin: '0 0 10px',
        fontSize: 20,
        fontWeight: 700,
        color: C.text,
        textAlign: 'center',
    },
    body: {
        margin: '0 0 16px',
        fontSize: 12,
        color: C.muted,
        lineHeight: 1.7,
        textAlign: 'center',
    },
    infoBox: {
        background: '#0f1923',
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: '12px 14px',
        marginBottom: 20,
    },
    primaryBtn: {
        background: '#1e3a5f',
        border: `1px solid ${C.accent}`,
        borderRadius: 8,
        color: C.accent,
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 700,
        padding: '11px 20px',
        width: '100%',
        marginBottom: 10,
        fontFamily: 'inherit',
    },
    skipAllBtn: {
        background: 'transparent',
        border: 'none',
        color: C.muted,
        cursor: 'pointer',
        fontSize: 11,
        textDecoration: 'underline',
        padding: '4px 0',
        width: '100%',
        textAlign: 'center',
        display: 'block',
    },
    question: {
        marginBottom: 16,
    },
    questionLabel: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        fontWeight: 600,
        color: C.text,
        marginBottom: 3,
    },
    optTag: {
        fontSize: 10,
        fontWeight: 400,
        color: C.muted,
        background: '#1e2d45',
        padding: '1px 6px',
        borderRadius: 10,
        letterSpacing: '0.02em',
    },
    questionDesc: {
        margin: '0 0 6px',
        fontSize: 10,
        color: C.muted,
        lineHeight: 1.6,
    },
    checkRow: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        cursor: 'pointer',
        marginBottom: 2,
    },
    input: {
        background: '#070d1a',
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        color: C.text,
        fontSize: 12,
        padding: '8px 12px',
        width: '100%',
        outline: 'none',
        boxSizing: 'border-box',
        fontFamily: 'inherit',
    },
};
