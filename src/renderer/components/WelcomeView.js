import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// WelcomeView.tsx -- SEG-S-3/4/5/6/9 + SEG-U-3 BP078 v0.1.36
// SEG-S-3: Updated hero/subline/bullets copy
// SEG-S-4: Mascot graphic with graceful fallback
// SEG-U-3: ProofAccordion replaces inline BenchmarkProofChart
// SEG-S-6: Two doorway cards wired to lifecycle stage B
// SEG-S-9: Mesh checkbox with localStorage persistence
import { useState, useCallback, useEffect } from 'react';
import { WelcomeCueCard } from './WelcomeCueCard';
import { ProofAccordion } from './ProofAccordion';
import { useLifecycleStage } from '../hooks/useLifecycleStage';
// SEG-S-7/8: Layer2 surfaces (both landed this session).
import { Layer2UseIt } from './Layer2UseIt';
import { Layer2ProveIt } from './Layer2ProveIt';
// SEG-V0145-2: Share modal
import { ShareMnemosyneC } from './ShareMnemosyneC';
import { CommunityConnectButton } from './CommunityConnectButton';
export const LS_ONBOARDING_COMPLETE = 'mnemosynec_onboarding_complete';
const MESH_KEY = 'mnemosynec_mesh_enabled';
export function WelcomeView({ onComplete }) {
    const { advanceTo } = useLifecycleStage();
    // SEG-S-6: doorway selection state
    const [doorwayChosen, setDoorwayChosen] = useState(null);
    // SEG-V0145-2: share modal
    const [showShare, setShowShare] = useState(false);
    // SEG-S-9: mesh checkbox
    const [meshEnabled, setMeshEnabled] = useState(() => {
        try {
            return localStorage.getItem(MESH_KEY) === 'true';
        }
        catch {
            return false;
        }
    });
    // Persist mesh preference
    useEffect(() => {
        try {
            localStorage.setItem(MESH_KEY, meshEnabled ? 'true' : 'false');
        }
        catch { /* storage unavailable */ }
    }, [meshEnabled]);
    // SEG-U-5: asset confirmed present -- dev warning removed
    // SEG-S-6: doorway click advances lifecycle to stage B
    const [visible, setVisible] = useState(true);
    const handleDoorwayClick = useCallback((choice) => {
        advanceTo('B');
        setVisible(false);
        setTimeout(() => {
            setDoorwayChosen(choice);
            setVisible(true);
        }, 180);
    }, [advanceTo]);
    // ── Layer 2 direct renders (SEG-S-7/8) ─────────────────────────────────────
    // Layer2 components own their full-screen overlay; return them directly.
    if (doorwayChosen === 'use-it') {
        return _jsx(Layer2UseIt, { onBack: () => setDoorwayChosen(null), onDone: onComplete });
    }
    if (doorwayChosen === 'prove-it') {
        // BP133 Yoke #24 Task 0: onDone wired so the "confirming" placeholder screen inside
        // Layer2ProveIt has a real completion path (previously this doorway had none at all).
        return _jsx(Layer2ProveIt, { onBack: () => setDoorwayChosen(null), onDone: onComplete });
    }
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
        opacity: visible ? 1 : 0,
        transition: 'opacity 180ms ease',
        overflowY: 'auto',
        padding: '24px 0',
    };
    const card = {
        width: '100%',
        maxWidth: 480,
        padding: '36px 32px',
        background: '#111827',
        border: '1px solid rgba(100, 116, 139, 0.2)',
        borderRadius: 12,
        margin: '0 16px',
    };
    const brandLine = {
        fontSize: 11,
        fontWeight: 700,
        color: '#6ee7b7',
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
        marginBottom: 20,
    };
    const subline = {
        fontSize: 13,
        color: '#64748b',
        lineHeight: 1.6,
        margin: '0 0 18px',
    };
    const bulletList = {
        margin: '0 0 24px',
        padding: 0,
        listStyle: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    };
    const bulletItem = {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        fontSize: 13,
        color: '#94a3b8',
        lineHeight: 1.5,
    };
    const bulletDot = {
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: 'rgba(110, 231, 183, 0.5)',
        flexShrink: 0,
        marginTop: 5,
    };
    const sectionLabel = {
        fontSize: 11,
        color: '#475569',
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        marginBottom: 12,
    };
    const cardRow = {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    };
    // SEG-S-9: Mesh checkbox (Stage A)
    const meshCheckbox = (_jsxs("label", { style: {
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            cursor: 'pointer',
            marginTop: 20,
            fontSize: 12,
            color: '#64748b',
            lineHeight: 1.5,
        }, children: [_jsx("input", { type: "checkbox", checked: meshEnabled, onChange: (e) => setMeshEnabled(e.target.checked), style: { marginTop: 2, flexShrink: 0, accentColor: '#6ee7b7' } }), _jsx("span", { children: "Uses connected cooperative memory sources when available. You stay in control." })] }));
    // ── Stage A: main welcome screen ───────────────────────────────────────────
    return (_jsxs("div", { style: overlay, children: [_jsxs("div", { style: card, children: [_jsx("div", { style: brandLine, children: "MnemosyneC" }), _jsx("h1", { style: { fontSize: '2rem', fontWeight: 700, color: '#e2e8f0', lineHeight: 1.25, margin: '0 0 6px', textAlign: 'center' }, children: "Your AI has Amnesia." }), _jsx("h2", { style: { fontSize: '1.6rem', fontWeight: 600, color: '#94a3b8', lineHeight: 1.25, margin: '0 0 14px', textAlign: 'center' }, children: "Dr. MnemosyneC has the Cure." }), _jsxs("p", { style: subline, children: ["Private AI memory and retrieval on your own computer. Free Forever", ' ', _jsx("span", { title: "Server Side Public License -- anti-extraction free-and-open license used by MongoDB and others. Means Free Forever for users, with copyleft protection against capture by closed cloud platforms.", style: { cursor: 'help' }, children: "(SSPL)" }), ". No Ads, No Strings. Great to use, better to join. Test it first or start using it now."] }), _jsxs("ul", { style: bulletList, children: [_jsxs("li", { style: bulletItem, children: [_jsx("span", { style: bulletDot }), _jsx("span", { children: "Free AI that remembers, runs locally, belongs to you." })] }), _jsxs("li", { style: bulletItem, children: [_jsx("span", { style: bulletDot }), _jsx("span", { children: "Private AI memory on your computer." })] }), _jsxs("li", { style: bulletItem, children: [_jsx("span", { style: bulletDot }), _jsx("a", { href: "https://mnemosynec.ai/how-it-works/", style: { color: '#6ee7b7', textDecoration: 'none', borderBottom: '1px solid rgba(110,231,183,0.3)' }, target: "_blank", rel: "noreferrer", children: "Learn how it works" })] })] }), _jsx("div", { style: { marginBottom: 20 }, children: _jsx("img", { src: "icons/mnemosynec-mark.png", alt: "MnemosyneC mascot", style: { height: 80, width: 'auto', objectFit: 'contain', display: 'block', margin: '0 auto' }, onError: (e) => {
                                e.target.style.display = 'none';
                            } }) }), _jsx(ProofAccordion, {}), _jsx("div", { style: sectionLabel, children: "Where do you want to start?" }), _jsxs("div", { style: cardRow, children: [_jsx(WelcomeCueCard, { label: "Prove it with a test", body: "See benchmark results before you decide.", size: "doorway", variant: "green", onClick: () => handleDoorwayClick('prove-it') }), _jsx(WelcomeCueCard, { label: "Just use it", body: "Start with the AI that fits your computer.", size: "doorway", variant: "blue", onClick: () => handleDoorwayClick('use-it') })] }), meshCheckbox, _jsx("div", { style: { marginTop: 12 }, children: _jsx(CommunityConnectButton, {}) }), _jsx("div", { style: {
                            display: 'flex',
                            justifyContent: 'flex-end',
                            marginTop: 16,
                            paddingTop: 12,
                            borderTop: '1px solid rgba(100, 116, 139, 0.12)',
                        }, children: _jsxs("button", { type: "button", onClick: () => setShowShare(true), style: {
                                background: 'none',
                                border: 'none',
                                color: '#475569',
                                fontSize: 11,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '2px 0',
                                fontFamily: 'system-ui, -apple-system, sans-serif',
                            }, onMouseEnter: (e) => { e.currentTarget.style.color = '#6ee7b7'; }, onMouseLeave: (e) => { e.currentTarget.style.color = '#475569'; }, children: [_jsxs("svg", { width: "13", height: "13", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [_jsx("circle", { cx: "12", cy: "3", r: "2", stroke: "currentColor", strokeWidth: "1.5" }), _jsx("circle", { cx: "12", cy: "13", r: "2", stroke: "currentColor", strokeWidth: "1.5" }), _jsx("circle", { cx: "3", cy: "8", r: "2", stroke: "currentColor", strokeWidth: "1.5" }), _jsx("line", { x1: "5", y1: "7", x2: "10", y2: "4", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }), _jsx("line", { x1: "5", y1: "9", x2: "10", y2: "12", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" })] }), "Share MnemosyneC"] }) })] }), showShare && _jsx(ShareMnemosyneC, { onClose: () => setShowShare(false) })] }));
}
export default WelcomeView;
