import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// FirstStepsView.tsx -- BP078 Scope 5
// Intent capture: three single-select cards (Pawn Section 4) + checkout trigger.
// DELTA binding: intent capture fires INSIDE the $5 join flow, never before.
// After checkout success + verifyStatus active: write intent tag, then onRoutePath.
import { useCallback, useState } from 'react';
export const intentRoutingMap = {
    need_help: {
        cluster: 'household_and_savings',
        initiatives: ['lets-make-dinner', 'lets-get-groceries', 'household-concierge'],
        banner: 'Opened for: I need help. You can change your path anytime.',
        primaryAction: 'Start with Dinner',
    },
    want_to_help: {
        cluster: 'community_contribution',
        initiatives: ['harper-guild', 'didasko', 'health-accords'],
        banner: 'Opened for: I want to help. You can change your path anytime.',
        primaryAction: 'See where help is needed',
    },
    make_money: {
        cluster: 'commerce_and_work',
        initiatives: ['lets-go-shopping', 'defense-klaus', 'lets-make-bread'],
        banner: 'Opened for: I want to make money. You can change your path anytime.',
        primaryAction: 'Open earning-ready initiatives',
    },
};
const INTENT_CARDS = [
    {
        id: 'need_help',
        label: 'I need help',
        subtitle: 'Show me the tools and services most likely to save me money, time, or stress first.',
    },
    {
        id: 'want_to_help',
        label: 'I want to help',
        subtitle: 'Show me where I can contribute, host, review, teach, or support other members.',
    },
    {
        id: 'make_money',
        label: 'I want to make money',
        subtitle: 'Show me the initiatives with the clearest earning, service, or venture pathways first.',
    },
];
// ─── Styles ───────────────────────────────────────────────────────────────────
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
    maxWidth: 500,
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
const headingStyle = {
    margin: '0 0 8px',
    fontSize: 20,
    fontWeight: 800,
    color: '#e2e8f0',
    lineHeight: 1.25,
};
const helperStyle = {
    margin: '0 0 24px',
    fontSize: 13,
    color: '#64748b',
    lineHeight: 1.6,
};
const primaryBtnBase = {
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
    ...primaryBtnBase,
    background: 'rgba(110,231,183,0.04)',
    border: '1px solid rgba(110,231,183,0.12)',
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
const errorBox = {
    fontSize: 12,
    color: '#f87171',
    background: 'rgba(248,113,113,0.08)',
    border: '1px solid rgba(248,113,113,0.2)',
    borderRadius: 6,
    padding: '8px 12px',
    marginBottom: 12,
};
const successBox = {
    fontSize: 12,
    color: '#6ee7b7',
    background: 'rgba(6,78,59,0.15)',
    border: '1px solid rgba(110,231,183,0.25)',
    borderRadius: 6,
    padding: '10px 14px',
    marginBottom: 12,
    lineHeight: 1.6,
};
export function FirstStepsView({ selectedIntent: initialIntent = null, membershipActive = false, onSelectIntent, onCheckout, onRoutePath, analytics, }) {
    const [intent, setIntent] = useState(initialIntent);
    const [phase, setPhase] = useState(membershipActive ? 'checkout_pending' : 'select');
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState(null);
    const handleSelectIntent = useCallback((id) => {
        setIntent(id);
        onSelectIntent(id);
        analytics?.track('membership_intent_selected', {
            source: 'first_steps_intent',
            intent: id,
            selection_surface: 'join_modal',
            preselected: false,
        });
    }, [onSelectIntent, analytics]);
    const handleOpenPath = useCallback(async () => {
        if (!intent)
            return;
        setError(null);
        onCheckout(intent);
        try {
            const result = await window.amplify?.membership?.createCheckout(false);
            if (result?.ok) {
                const url = result.url;
                window.amplify?.openExternal?.(url ?? 'https://lianabanyan.com/join');
            }
            else {
                window.amplify?.openExternal?.('https://lianabanyan.com/join');
            }
        }
        catch {
            window.amplify?.openExternal?.('https://lianabanyan.com/join');
        }
        setPhase('checkout_pending');
    }, [intent, onCheckout]);
    const handleVerify = useCallback(async () => {
        if (!intent)
            return;
        setVerifying(true);
        setError(null);
        try {
            const result = await window.amplify?.membership?.verifyStatus?.();
            if (result?.membership_active === true) {
                analytics?.track('membership_path_routed', {
                    source: 'post_join_routing',
                    intent,
                    destination_surface: 'helm',
                    destination_cluster: intentRoutingMap[intent].cluster,
                    destination_initiatives: intentRoutingMap[intent].initiatives,
                    membership_status: 'active',
                });
                onRoutePath(intent);
            }
            else {
                setError("Membership not confirmed yet. Please wait a moment and try again.");
            }
        }
        catch {
            setError('Verification failed. Check your connection and try again.');
        }
        finally {
            setVerifying(false);
        }
    }, [intent, onRoutePath, analytics]);
    const handleReopenCheckout = useCallback(async () => {
        setError(null);
        try {
            const result = await window.amplify?.membership?.createCheckout(false);
            const url = result?.url;
            window.amplify?.openExternal?.(url ?? 'https://lianabanyan.com/join');
        }
        catch {
            window.amplify?.openExternal?.('https://lianabanyan.com/join');
        }
    }, []);
    // ── Select phase ─────────────────────────────────────────────────────────────
    if (phase === 'select') {
        return (_jsx("div", { style: overlay, children: _jsxs("div", { style: card, children: [_jsx("div", { style: brandLine, children: "MnemosyneC" }), _jsx("h2", { style: headingStyle, children: "What brings you in first?" }), _jsx("p", { style: helperStyle, children: "Pick the path you want opened by default. You can explore everything later." }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }, children: INTENT_CARDS.map((c) => {
                            const selected = intent === c.id;
                            return (_jsxs("button", { type: "button", onClick: () => handleSelectIntent(c.id), style: {
                                    padding: '14px 16px',
                                    background: selected ? 'rgba(6,78,59,0.2)' : 'rgba(15,23,42,0.5)',
                                    border: selected ? '1.5px solid rgba(110,231,183,0.5)' : '1px solid rgba(100,116,139,0.2)',
                                    borderRadius: 10,
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                    position: 'relative',
                                }, children: [selected && (_jsx("span", { "aria-hidden": "true", style: {
                                            position: 'absolute',
                                            top: 10,
                                            right: 12,
                                            fontSize: 14,
                                            color: '#6ee7b7',
                                        }, children: _jsx("svg", { width: "14", height: "14", viewBox: "0 0 14 14", fill: "none", "aria-hidden": "true", children: _jsx("path", { d: "M2.5 7l3 3 6-6", stroke: "#6ee7b7", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" }) }) })), _jsx("div", { style: { fontSize: 14, fontWeight: 700, color: selected ? '#6ee7b7' : '#e2e8f0', marginBottom: 4 }, children: c.label }), _jsx("div", { style: { fontSize: 12, color: '#64748b', lineHeight: 1.5 }, children: c.subtitle })] }, c.id));
                        }) }), _jsx("button", { type: "button", style: intent ? primaryBtnBase : primaryBtnDisabled, disabled: !intent, onClick: () => { void handleOpenPath(); }, children: "Open my path -- Join $5/year" }), _jsxs("div", { style: { marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(100,116,139,0.1)' }, children: [_jsx("button", { type: "button", style: ghostBtn, onClick: () => onRoutePath('need_help'), children: "Use free forever -- no account needed" }), _jsx("div", { style: { fontSize: 10, color: '#334155', textAlign: 'center', marginTop: 4 }, children: "All local AI features work without an account. Join later anytime from $ LB Account." })] })] }) }));
    }
    // ── Checkout pending phase ────────────────────────────────────────────────────
    return (_jsx("div", { style: overlay, children: _jsxs("div", { style: card, children: [_jsx("div", { style: brandLine, children: "MnemosyneC" }), _jsx("h2", { style: headingStyle, children: "Complete your membership" }), _jsx("p", { style: helperStyle, children: "Finish the checkout in your browser, then click below to confirm." }), _jsx("div", { style: successBox, children: "Checkout opened in your browser. Complete the $5 payment, then click the button below." }), error && _jsx("div", { style: errorBox, children: error }), _jsx("button", { type: "button", style: verifying ? primaryBtnDisabled : primaryBtnBase, disabled: verifying, onClick: () => { void handleVerify(); }, children: verifying ? 'Verifying...' : 'I have completed checkout' }), _jsx("button", { type: "button", style: ghostBtn, onClick: () => { void handleReopenCheckout(); }, children: "Need to open checkout again?" })] }) }));
}
export default FirstStepsView;
