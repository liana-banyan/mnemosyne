import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// MembershipTab.tsx — BP081 K-1
// Tab 19 · 💎 Membership
// Canonical: $5/year · 83.3% creator-keep · Cost+20% platform margin
// Three-currency system: Credits / Marks / Joules (no fiat at data layer)
import { useState, useEffect, useRef } from 'react';
import { MEMBERSHIP_ANNUAL_FEE_USD, CREATOR_KEEP_PERCENT } from '../../shared/membership_types';
// ─── Helpers ──────────────────────────────────────────────────────────────────
function tierBadge(tier) {
    switch (tier) {
        case 'founder':
            return { label: 'Founder', color: '#facc15', bg: 'rgba(250,204,21,0.12)' };
        case 'forked':
            return { label: 'Forked', color: '#94a3b8', bg: 'rgba(148,163,184,0.10)' };
        default:
            return { label: 'Standard', color: '#6ee7b7', bg: 'rgba(110,231,183,0.10)' };
    }
}
function statusLabel(status) {
    switch (status) {
        case 'active': return { text: 'Active', color: '#4ade80' };
        case 'expired': return { text: 'Expired', color: '#f87171' };
        case 'pending_payment': return { text: 'Pending payment', color: '#fbbf24' };
        case 'cancelled': return { text: 'Cancelled', color: '#94a3b8' };
        default: return { text: 'Not yet joined', color: '#475569' };
    }
}
// ─── Component ────────────────────────────────────────────────────────────────
export function MembershipTab() {
    const [memberStatus, setMemberStatus] = useState(null);
    const [loadingStatus, setLoadingStatus] = useState(true);
    const [checkoutPhase, setCheckoutPhase] = useState('idle');
    const [checkoutError, setCheckoutError] = useState(null);
    // Long-running heartbeat during checkout-session creation
    const heartbeatRef = useRef(null);
    const [heartbeatTick, setHeartbeatTick] = useState(0);
    const [heartbeatMsg, setHeartbeatMsg] = useState('Opening Stripe checkout...');
    const HEARTBEAT_MSGS = [
        'Opening Stripe checkout...',
        'Connecting to checkout...',
        'Almost there...',
        'Launching in your browser...',
    ];
    // Load membership status on mount
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const result = await window.amplify?.membershipGetStatus?.();
                if (!cancelled && result) {
                    setMemberStatus(result);
                }
            }
            catch {
                // silent — stub may not be wired yet
            }
            finally {
                if (!cancelled)
                    setLoadingStatus(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);
    // Cleanup heartbeat on unmount
    useEffect(() => {
        return () => {
            if (heartbeatRef.current)
                clearInterval(heartbeatRef.current);
        };
    }, []);
    function startHeartbeat() {
        let tick = 0;
        heartbeatRef.current = setInterval(() => {
            tick += 1;
            setHeartbeatTick(tick);
            setHeartbeatMsg(HEARTBEAT_MSGS[tick % HEARTBEAT_MSGS.length]);
        }, 1800);
    }
    function stopHeartbeat() {
        if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current);
            heartbeatRef.current = null;
        }
        setHeartbeatTick(0);
    }
    async function handleJoin() {
        if (checkoutPhase === 'loading')
            return;
        setCheckoutPhase('loading');
        setCheckoutError(null);
        startHeartbeat();
        try {
            const result = await window.amplify?.membershipStartCheckout?.();
            stopHeartbeat();
            if (result?.success) {
                setCheckoutPhase('opened');
            }
            else {
                setCheckoutPhase('error');
                setCheckoutError(result?.error ?? 'Checkout unavailable — try again shortly.');
            }
        }
        catch (err) {
            stopHeartbeat();
            setCheckoutPhase('error');
            setCheckoutError(String(err));
        }
    }
    // ─── Styles ───────────────────────────────────────────────────────────────
    const S = {
        container: {
            padding: '20px 24px',
            overflowY: 'auto',
            height: '100%',
            color: '#e2e8f0',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            maxWidth: 640,
        },
        section: {
            marginBottom: 24,
        },
        sectionTitle: {
            fontSize: 11,
            fontWeight: 700,
            color: '#475569',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 10,
        },
        card: {
            background: 'rgba(15,23,42,0.6)',
            border: '1px solid rgba(100,116,139,0.2)',
            borderRadius: 10,
            padding: '14px 18px',
        },
        row: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: 6,
        },
        label: {
            fontSize: 12,
            color: '#64748b',
        },
        value: {
            fontSize: 12,
            fontWeight: 600,
            color: '#cbd5e1',
        },
        joinButton: (phase) => ({
            width: '100%',
            padding: '12px 20px',
            background: phase === 'loading'
                ? 'rgba(110,231,183,0.05)'
                : 'rgba(110,231,183,0.13)',
            border: `1px solid ${phase === 'loading' ? 'rgba(110,231,183,0.2)' : 'rgba(110,231,183,0.45)'}`,
            borderRadius: 10,
            color: phase === 'loading' ? '#4ade80' : '#6ee7b7',
            fontSize: 14,
            fontWeight: 700,
            cursor: phase === 'loading' ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'all 0.15s ease',
            letterSpacing: '0.01em',
        }),
        openedBanner: {
            background: 'rgba(34,197,94,0.08)',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: 10,
            padding: '12px 16px',
            fontSize: 12,
            color: '#4ade80',
            lineHeight: 1.6,
        },
        errorBanner: {
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 11,
            color: '#f87171',
            marginTop: 8,
        },
        bullet: {
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            fontSize: 12,
            color: '#94a3b8',
            lineHeight: 1.6,
            marginBottom: 8,
        },
        bulletDot: {
            color: '#6ee7b7',
            fontSize: 14,
            flexShrink: 0,
            marginTop: 1,
        },
        forkCard: {
            background: 'rgba(15,23,42,0.4)',
            border: '1px solid rgba(100,116,139,0.15)',
            borderRadius: 10,
            padding: '14px 18px',
        },
        link: {
            color: '#60a5fa',
            textDecoration: 'underline',
            cursor: 'pointer',
            fontSize: 11,
        },
        spinner: {
            display: 'inline-block',
            width: 14,
            height: 14,
            border: '2px solid rgba(110,231,183,0.3)',
            borderTopColor: '#6ee7b7',
            borderRadius: '50%',
            animation: 'membership-spin 0.8s linear infinite',
        },
    };
    const badge = memberStatus ? tierBadge(memberStatus.tier) : null;
    const status = memberStatus ? statusLabel(memberStatus.status) : null;
    const isNeverJoined = !memberStatus || memberStatus.status === 'never_joined';
    const isActive = memberStatus?.status === 'active';
    return (_jsxs("div", { style: S.container, children: [_jsx("style", { children: `
        @keyframes membership-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes membership-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
      ` }), _jsxs("div", { style: S.section, children: [_jsx("div", { style: S.sectionTitle, children: "Your Status" }), _jsx("div", { style: S.card, children: loadingStatus ? (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("span", { style: S.spinner }), _jsx("span", { style: { fontSize: 12, color: '#475569' }, children: "Checking membership status..." })] })) : memberStatus ? (_jsxs(_Fragment, { children: [_jsxs("div", { style: S.row, children: [_jsx("span", { style: S.label, children: "Tier" }), badge && (_jsx("span", { style: {
                                                background: badge.bg,
                                                color: badge.color,
                                                border: `1px solid ${badge.color}40`,
                                                borderRadius: 12,
                                                padding: '2px 10px',
                                                fontSize: 11,
                                                fontWeight: 700,
                                            }, children: badge.label }))] }), _jsxs("div", { style: S.row, children: [_jsx("span", { style: S.label, children: "Status" }), status && (_jsx("span", { style: { fontSize: 12, fontWeight: 600, color: status.color }, children: status.text }))] }), _jsxs("div", { style: S.row, children: [_jsx("span", { style: S.label, children: "Annual fee" }), _jsxs("span", { style: S.value, children: ["$", MEMBERSHIP_ANNUAL_FEE_USD, "/year"] })] })] })) : (_jsx("span", { style: { fontSize: 12, color: '#475569' }, children: "Status unavailable" })) })] }), !isActive && (_jsxs("div", { style: S.section, children: [_jsxs("div", { style: S.sectionTitle, children: ["Join Liana Banyan \u2014 $", MEMBERSHIP_ANNUAL_FEE_USD, "/year"] }), checkoutPhase === 'opened' ? (_jsxs("div", { style: S.openedBanner, children: ["\u2713 Checkout opened in your browser.", _jsx("br", {}), "Come back here once you've joined. Then close and reopen MnemosyneC to refresh your membership status."] })) : (_jsxs(_Fragment, { children: [_jsx("button", { style: S.joinButton(checkoutPhase), onClick: handleJoin, disabled: checkoutPhase === 'loading', "aria-label": checkoutPhase === 'loading' ? 'Opening checkout...' : `Join Liana Banyan for $${MEMBERSHIP_ANNUAL_FEE_USD}/year`, title: `Join the cooperative — $${MEMBERSHIP_ANNUAL_FEE_USD}/year`, children: checkoutPhase === 'loading' ? (_jsxs(_Fragment, { children: [_jsx("span", { style: S.spinner, "aria-hidden": true }), _jsx("span", { style: { animation: 'membership-pulse 1.4s ease-in-out infinite' }, children: heartbeatMsg })] })) : (_jsxs(_Fragment, { children: ["\uD83D\uDC8E Join \u00B7 $", MEMBERSHIP_ANNUAL_FEE_USD, "/year"] })) }), checkoutPhase === 'error' && checkoutError && (_jsx("div", { style: S.errorBanner, role: "alert", children: checkoutError })), checkoutPhase === 'idle' && isNeverJoined && (_jsx("div", { style: { marginTop: 8, fontSize: 10, color: '#334155', textAlign: 'center' }, children: "Free to use. Better to join." }))] }))] })), _jsxs("div", { style: S.section, children: [_jsx("div", { style: S.sectionTitle, children: "Or fork it" }), _jsxs("div", { style: S.forkCard, children: [_jsx("div", { style: { fontSize: 12, color: '#94a3b8', lineHeight: 1.7, marginBottom: 10 }, children: "Free forever if you want to fork. Cost+20% if you stay." }), _jsx("div", { style: { fontSize: 11, color: '#475569', lineHeight: 1.6, marginBottom: 10 }, children: "MnemosyneC ships under SSPL. You can fork it, self-host it, run it forever at zero cost. If you build a product on it, you share the stack (SSPL \u00A713). If you stay in the cooperative, you get the full mesh \u2014 platform margin is Cost+20%, never more." }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("a", { href: "https://github.com/liana-banyan", target: "_blank", rel: "noopener noreferrer", style: S.link, onClick: (e) => {
                                            e.preventDefault();
                                            window.amplify?.openExternal?.('https://github.com/liana-banyan');
                                        }, children: "GitHub \u2192" }), _jsx("span", { style: { fontSize: 11, color: '#334155' }, children: "Pledge #2260 \u00B7 SSPL" })] })] })] }), _jsxs("div", { style: S.section, children: [_jsx("div", { style: S.sectionTitle, children: "What you get" }), _jsxs("div", { style: S.card, children: [_jsxs("div", { style: S.bullet, children: [_jsx("span", { style: S.bulletDot, children: "\u25C6" }), _jsxs("span", { children: [_jsxs("strong", { style: { color: '#e2e8f0' }, children: [CREATOR_KEEP_PERCENT, "% creator-keep"] }), ' ', "\u2014 every time someone pays for your work, ", CREATOR_KEEP_PERCENT, "% goes directly to you. Never rounded. Never 83%."] })] }), _jsxs("div", { style: S.bullet, children: [_jsx("span", { style: S.bulletDot, children: "\u25C6" }), _jsxs("span", { children: [_jsx("strong", { style: { color: '#e2e8f0' }, children: "No ads \u00B7 No VC \u00B7 Participation not equity" }), ' ', "\u2014 the cooperative earns Cost+20%, period. No extraction above that."] })] }), _jsxs("div", { style: S.bullet, children: [_jsx("span", { style: S.bulletDot, children: "\u25C6" }), _jsxs("span", { children: [_jsx("strong", { style: { color: '#e2e8f0' }, children: "Your substrate. Your eblets. Your knowledge." }), ' ', "Compounding locally. Shared by consent. Sovereign to you."] })] }), _jsxs("div", { style: S.bullet, children: [_jsx("span", { style: S.bulletDot, children: "\u25C6" }), _jsxs("span", { children: [_jsx("strong", { style: { color: '#e2e8f0' }, children: "Access to Deep Test + peer mesh sharing" }), ' ', "\u2014 let your substrate grow with the mesh. Opt-in. Revocable. Always yours."] })] }), _jsxs("div", { style: S.bullet, children: [_jsx("span", { style: S.bulletDot, children: "\u25C6" }), _jsxs("span", { children: [_jsx("strong", { style: { color: '#e2e8f0' }, children: "Three-currency system" }), ' ', "\u2014 Credits / Marks / Joules. Your internal economy. Never converted to fiat at the data layer."] })] }), _jsx("div", { style: {
                                    marginTop: 14,
                                    paddingTop: 12,
                                    borderTop: '1px solid rgba(100,116,139,0.12)',
                                    fontSize: 10,
                                    color: '#334155',
                                    lineHeight: 1.7,
                                }, children: "$5/year \u00B7 Help each other help ourselves." })] })] })] }));
}
