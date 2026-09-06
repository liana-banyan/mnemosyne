import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// MnemosyneC · v0.2.0 · BP082 · 2026-06-13
// §2 Truth-Always · §3 Sonnet 4.6 · Founder-ratified
//
// LeanHelpTab — 4th tab in LeanShell.
// MnemosyneC as Substrate Filter: bring your own AI/social surface,
// we add an eblet + Marks layer ON TOP.
//
// SEG-1: 4th "Help" tab added to LeanShell tab strip (in LeanShell.tsx).
// SEG-2: This component — LeanHelpTab scaffold with FAQ + Connect cards + Coming Soon + Guild footer.
// SEG-3: Discord OAuth connect card (requires DISCORD_OAUTH_CLIENT_ID env var — see yoke-return).
// SEG-4: Reddit OAuth connect card (requires REDDIT_OAUTH_CLIENT_ID env var — see yoke-return).
// SEG-5: Eblet capture wired via substrateWrite IPC (per-message 📚 Save button).
// SEG-6: Coming Soon tiles — Chrome extension, Pawn/Perplexity, Cue Deck Cards.
// SEG-7: Marks economy — connect (5 ea) + capture (1 ea). Counter in header.
// SEG-8: Guild Incentives footer with Marks tiers table.
// SEG-9: Privacy — tokens via safeStorage (main process), never localStorage or renderer.
import { useState, useCallback, useEffect } from 'react';
import { FAQCard } from './help/FAQCard';
import { ConnectDiscordCard } from './help/ConnectDiscordCard';
import { ConnectRedditCard } from './help/ConnectRedditCard';
import { GuildIncentivesFooter } from './help/GuildIncentivesFooter';
// unrouted BP135 -- see YOKE_35 Phase 3 (the 3 ComingSoonCard tiles below were honestly-
// labeled placeholders, but "nothing that isn't real" cuts placeholders too -- see
// verdict table. ComingSoonCard.tsx itself is untouched, kept per Rule 66.)
// import { ComingSoonCard } from './help/ComingSoonCard';
const LS_MARKS_KEY = 'mnemo_help_marks_earned';
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
function loadLocalMarks() {
    return parseInt(localStorage.getItem(LS_MARKS_KEY) ?? '0', 10) || 0;
}
function saveLocalMarks(n) {
    localStorage.setItem(LS_MARKS_KEY, String(n));
}
export function LeanHelpTab() {
    const [marks, setMarks] = useState(loadLocalMarks);
    const [isMember, setIsMember] = useState(false);
    const [memberCtaToast, setMemberCtaToast] = useState(null);
    // Check local membership status
    useEffect(() => {
        window.amplify?.checkLocalMembershipStatus?.().then((r) => {
            if (r?.is_member)
                setIsMember(true);
        }).catch(() => { });
        // Also listen for activation events
        const unsub = window.amplify?.onMembershipActivated?.((result) => {
            if (result.ok)
                setIsMember(true);
        });
        return () => { unsub?.(); };
    }, []);
    const handleMemberCtaClick = useCallback(() => {
        void openMembershipCheckout((err) => {
            setMemberCtaToast(err);
            setTimeout(() => setMemberCtaToast(null), 4000);
        });
    }, []);
    const handleMarksAccrued = useCallback((delta) => {
        setMarks((prev) => {
            const next = prev + delta;
            saveLocalMarks(next);
            return next;
        });
    }, []);
    return (_jsxs("div", { style: s.outer, children: [_jsxs("div", { style: s.headerBar, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsx("h1", { style: s.h1, children: "Help & Community" }), _jsx("p", { style: s.subtitle, children: "Get help. Join the Guild. Earn Marks for helping others." }), _jsx("p", { style: { fontSize: 13, color: '#a5b4fc', fontWeight: 700, margin: '6px 0 2px', letterSpacing: '0.01em' }, children: "\uD83E\uDDC2 The Secret of Mnem... is Salt." }), _jsxs("p", { style: { fontSize: 12, color: '#64748b', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 8, padding: '10px 14px', lineHeight: 1.6, margin: '4px 0 4px' }, children: ["MnemosyneC finds answers through ", _jsx("strong", { style: { color: '#e2e8f0' }, children: "three salt layers" }), ":", ' ', _jsx("strong", { children: "(1) Substrate Salt" }), " \u00B7 verified eblets grown locally via canonical pipeline (what your machine already knows);", ' ', _jsx("strong", { children: "(2) Federation Salt" }), " \u00B7 Constellation peers share verified knowledge across the mesh;", ' ', _jsx("strong", { children: "(3) Human Salt" }), " \u00B7 The Diagnosis broadcasts to human Members when machines alone can't find the answer.", ' ', _jsx("em", { style: { color: '#475569' }, children: "Substrate Salt + Federation Salt + Human Salt = Right Answer." })] })] }), marks > 0 && (_jsxs("div", { style: s.marksCounter, title: "Marks earned via Help tab actions", children: ["\u2726 ", marks, " Marks earned"] }))] }), _jsxs("div", { style: s.scroll, children: [_jsxs("a", { href: "https://lianabanyan.com/op-eds/thou-art-the-man", target: "_blank", rel: "noopener noreferrer", style: s.opEdTile, children: [_jsx("span", { style: s.opEdIcon, children: "\uD83D\uDCD6" }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("div", { style: s.opEdNew, children: "NEW" }), _jsx("div", { style: s.opEdTitle, children: "Read \"Thou Art the Man\"" }), _jsx("div", { style: s.opEdDesc, children: "The structural argument for why we built the cooperative." })] }), _jsx("span", { style: s.opEdArrow, children: "\u2192" })] }), _jsx(FAQCard, {}), _jsx("div", { style: s.sectionLabel, children: "Community Connections" }), _jsx(ConnectDiscordCard, { onMarksAccrued: handleMarksAccrued }), _jsx(ConnectRedditCard, { onMarksAccrued: handleMarksAccrued }), !isMember && (_jsxs("section", { className: "membership-cta-section", style: {
                            background: 'linear-gradient(135deg, #0a1f14 0%, #0f2318 100%)',
                            border: '1px solid #166534',
                            borderRadius: 8,
                            padding: '14px 16px',
                            marginBottom: 12,
                        }, children: [_jsx("h3", { style: { margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: '#d1fae5' }, children: "Become a Member" }), _jsxs("p", { style: { margin: '0 0 10px', fontSize: 12, color: '#6ee7b7', lineHeight: 1.5 }, children: ["Join the cooperative for ", _jsx("strong", { style: { color: '#a7f3d0' }, children: "$5/yr" }), ". Members earn Marks, vote on Guild decisions, and help each other help ourselves."] }), _jsx("button", { className: "member-cta-primary", onClick: handleMemberCtaClick, style: {
                                    background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
                                    border: '1px solid #059669',
                                    borderRadius: 6,
                                    color: '#6ee7b7',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    padding: '8px 16px',
                                    cursor: 'pointer',
                                    fontFamily: 'system-ui, sans-serif',
                                    outline: 'none',
                                    width: '100%',
                                }, children: "Become a Member \u00B7 $5/yr" }), memberCtaToast && (_jsx("p", { style: { margin: '8px 0 0', fontSize: 11, color: '#fca5a5' }, children: memberCtaToast }))] })), isMember && (_jsx("section", { className: "membership-status-section", style: {
                            background: 'rgba(6,95,70,0.15)',
                            border: '1px solid #065f46',
                            borderRadius: 8,
                            padding: '10px 14px',
                            marginBottom: 12,
                        }, children: _jsx("p", { style: { margin: 0, fontSize: 12, color: '#6ee7b7' }, children: "\u2713 You are a member of the cooperative." }) })), _jsx(GuildIncentivesFooter, {}), _jsx("div", { style: { height: 16 } })] })] }));
}
const s = {
    outer: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    },
    headerBar: {
        padding: '14px 16px 8px',
        flexShrink: 0,
        borderBottom: '1px solid #1e2a38',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        flexWrap: 'wrap',
    },
    h1: {
        margin: 0,
        fontSize: 16,
        fontWeight: 700,
        color: '#f0fdf4',
    },
    subtitle: {
        margin: '4px 0 0',
        fontSize: 11,
        color: '#475569',
    },
    marksCounter: {
        fontSize: 12,
        fontWeight: 700,
        color: '#6ee7b7',
        background: '#064e3b',
        border: '1px solid #059669',
        borderRadius: 5,
        padding: '3px 10px',
        flexShrink: 0,
        alignSelf: 'center',
        cursor: 'default',
    },
    scroll: {
        flex: 1,
        overflowY: 'auto',
        padding: '12px 14px',
    },
    sectionLabel: {
        fontSize: 10,
        fontWeight: 700,
        color: '#475569',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        marginBottom: 8,
        marginTop: 4,
    },
    opEdTile: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'linear-gradient(135deg, #0a1a12 0%, #0f2318 100%)',
        border: '1px solid #166534',
        borderRadius: 8,
        padding: '10px 12px',
        marginBottom: 12,
        textDecoration: 'none',
        cursor: 'pointer',
    },
    opEdIcon: {
        fontSize: 20,
        flexShrink: 0,
    },
    opEdNew: {
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.1em',
        color: '#4ade80',
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    opEdTitle: {
        fontSize: 12,
        fontWeight: 700,
        color: '#d1fae5',
        marginBottom: 2,
    },
    opEdDesc: {
        fontSize: 10,
        color: '#6ee7b7',
        lineHeight: 1.4,
    },
    opEdArrow: {
        fontSize: 14,
        color: '#4ade80',
        flexShrink: 0,
    },
};
