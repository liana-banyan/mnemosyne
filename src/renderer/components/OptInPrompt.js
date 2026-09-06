import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// OptInPrompt.tsx — Contextual 3-strikes opt-in prompt for Frontier / LB Account
// canon: canon_frontier_lb_account_opt_in_contextual_3_strikes_prompt_not_buried_tab_bp065
// BP065 · Founder direct: contextual, not a buried tab; max 3 asks; respectful, never nagware.
//
// Rendered as a fixed overlay above the main UI.
// Buttons:
//   YES — link my LB Account now → triggers auth flow → closes prompt
//   Once a day for 3 days / Once a week for 3 weeks → remind cadence → records strike
//   Never ask again → sets decision = 'never' → closes prompt
//   Tell me where to find this → shows path to Tab 14 LB Account → closes prompt
import { useState, useMemo } from 'react';
import { recordStrike, setDecision, setCadence } from '../lib/opt_in_strike_tracker';
import { getHenNarration } from '../lib/little_red_hen';
export function OptInPrompt({ onClose, onYes, onNavigateToTab }) {
    const [phase, setPhase] = useState('main');
    // LRH narration is stable for the lifetime of this prompt instance
    const henNarration = useMemo(() => getHenNarration('join'), []);
    const [email, setEmail] = useState('');
    const [emailError, setEmailError] = useState('');
    function handleRemind(cadence) {
        setCadence(cadence);
        recordStrike(cadence);
        onClose();
    }
    function handleNever() {
        setDecision('never');
        onClose();
    }
    function handleTellMe() {
        setPhase('tell-me-where');
    }
    function handleYesSubmit() {
        if (!email.trim() || !email.includes('@')) {
            setEmailError('Enter a valid email address.');
            return;
        }
        onYes(email.trim());
    }
    return (_jsx("div", { style: {
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            pointerEvents: 'none',
            padding: '0 16px 80px',
        }, children: _jsxs("div", { style: {
                pointerEvents: 'auto',
                background: 'rgba(10,15,26,0.97)',
                border: '1px solid rgba(110,231,183,0.3)',
                borderRadius: 12,
                padding: '18px 20px',
                maxWidth: 420,
                width: '100%',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
            }, children: [phase === 'main' && _jsx(MainPhase, { onRemind: handleRemind, onNever: handleNever, onYes: () => setPhase('yes-email'), onTellMe: handleTellMe, henNarration: henNarration }), phase === 'yes-email' && (_jsx(YesEmailPhase, { email: email, emailError: emailError, setEmail: setEmail, onSubmit: handleYesSubmit, onBack: () => setPhase('main') })), phase === 'tell-me-where' && (_jsx(TellMeWherePhase, { onNavigate: () => { onNavigateToTab(); onClose(); }, onClose: onClose }))] }) }));
}
// ─── Main phase ───────────────────────────────────────────────────────────────
function MainPhase({ onRemind, onNever, onYes, onTellMe, henNarration, }) {
    return (_jsxs(_Fragment, { children: [_jsxs("div", { style: { display: 'flex', alignItems: 'flex-start', gap: 10 }, children: [_jsx("span", { style: { fontSize: 20, flexShrink: 0 }, children: "\uD83C\uDF10" }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 13, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.4 }, children: "This result came from the cooperative substrate." }), _jsx("div", { style: { fontSize: 11, color: '#64748b', marginTop: 4, lineHeight: 1.6 }, children: "Linking your Liana Banyan account lets your device join the Frontier \u2014 a cooperative mesh where members share substrate and multiply what MnemosyneC knows. Free to use. Better together." }), _jsx("div", { style: { fontSize: 10, color: '#475569', marginTop: 6, fontStyle: 'italic' }, children: henNarration })] })] }), _jsx("button", { style: {
                    width: '100%',
                    padding: '9px 14px',
                    background: 'rgba(110,231,183,0.12)',
                    border: '1px solid rgba(110,231,183,0.35)',
                    borderRadius: 8,
                    color: '#6ee7b7',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'left',
                }, onClick: onYes, children: "\u2713 YES \u2014 link my LB Account now" }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: [_jsx("div", { style: { fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: '0.05em' }, children: "REMIND ME INSTEAD" }), _jsxs("div", { style: { display: 'flex', gap: 6 }, children: [_jsx("button", { style: remindBtn, onClick: () => onRemind('3days'), children: "Once a day for 3 days" }), _jsx("button", { style: remindBtn, onClick: () => onRemind('3weeks'), children: "Once a week for 3 weeks" })] })] }), _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsx("button", { style: { background: 'none', border: 'none', color: '#475569', fontSize: 10, cursor: 'pointer', padding: 0 }, onClick: onTellMe, children: "Tell me where to find this later \u2192" }), _jsx("button", { style: { background: 'none', border: 'none', color: '#334155', fontSize: 10, cursor: 'pointer', padding: 0 }, onClick: onNever, children: "Never ask again" })] })] }));
}
const remindBtn = {
    flex: 1,
    padding: '6px 10px',
    background: 'rgba(100,116,139,0.08)',
    border: '1px solid rgba(100,116,139,0.2)',
    borderRadius: 6,
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'center',
};
// ─── Yes / email phase ────────────────────────────────────────────────────────
function YesEmailPhase({ email, emailError, setEmail, onSubmit, onBack, }) {
    return (_jsxs(_Fragment, { children: [_jsx("div", { style: { fontSize: 13, fontWeight: 700, color: '#e2e8f0' }, children: "Link your LB Account" }), _jsx("div", { style: { fontSize: 11, color: '#64748b', lineHeight: 1.6 }, children: "Enter your email \u2014 we'll send a one-click magic link. No password needed." }), _jsx("input", { type: "email", placeholder: "your@email.com", value: email, onChange: (e) => setEmail(e.target.value), onKeyDown: (e) => e.key === 'Enter' && onSubmit(), autoFocus: true, style: {
                    width: '100%',
                    padding: '8px 12px',
                    background: 'rgba(15,23,42,0.9)',
                    border: '1px solid rgba(100,116,139,0.35)',
                    borderRadius: 6,
                    color: '#e2e8f0',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box',
                } }), emailError && (_jsxs("div", { style: { fontSize: 10, color: '#f87171' }, children: ["\u26A0 ", emailError] })), _jsxs("div", { style: { display: 'flex', gap: 8 }, children: [_jsx("button", { style: {
                            flex: 1, padding: '8px 14px',
                            background: 'rgba(110,231,183,0.12)', border: '1px solid rgba(110,231,183,0.35)',
                            borderRadius: 6, color: '#6ee7b7', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        }, onClick: onSubmit, children: "Send magic link \u2192" }), _jsx("button", { style: {
                            padding: '8px 14px',
                            background: 'none', border: '1px solid rgba(100,116,139,0.2)',
                            borderRadius: 6, color: '#64748b', fontSize: 11, cursor: 'pointer',
                        }, onClick: onBack, children: "Back" })] })] }));
}
// ─── Tell me where phase ──────────────────────────────────────────────────────
function TellMeWherePhase({ onNavigate, onClose }) {
    return (_jsxs(_Fragment, { children: [_jsx("div", { style: { fontSize: 13, fontWeight: 700, color: '#e2e8f0' }, children: "Where to find this later" }), _jsxs("div", { style: { fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }, children: ["In MnemosyneC, look for the", ' ', _jsx("strong", { style: { color: '#fbbf24' }, children: "LB Account" }), ' ', "tab in the tab bar at the top.", _jsx("br", {}), _jsx("br", {}), "From there you can link your account and join the Frontier any time you're ready."] }), _jsxs("div", { style: { display: 'flex', gap: 8 }, children: [_jsx("button", { style: {
                            flex: 1, padding: '8px 14px',
                            background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.25)',
                            borderRadius: 6, color: '#fbbf24', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }, onClick: onNavigate, children: "Take me there now \u2192" }), _jsx("button", { style: {
                            padding: '8px 14px',
                            background: 'none', border: '1px solid rgba(100,116,139,0.2)',
                            borderRadius: 6, color: '#64748b', fontSize: 11, cursor: 'pointer',
                        }, onClick: onClose, children: "Got it" })] })] }));
}
