import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Layer2ProveIt.tsx -- SEG-S-8 BP078 v0.1.37
// Layer 2 surface for "Proof That It Works" doorway.
// BP137 Yoke (Knight, concurrent tab): the "Big Numbers" strip, the five flip
// cards (Eyewitness Kappa 0.883, Banyan Metric 94.8% vs 8.7%, Star Chamber
// "4 Judges ALL AGREE", Sound Barrier "Kappa 1.000" trophy, MMLU-Pro card) and
// the four benchmark-choice buttons were hardcoded, stale, self-graded numbers
// with no live recomputation, and the choice buttons dead-ended at a static
// "coming in the next update" placeholder. All of that is removed here rather
// than hidden -- no fabricated numbers may remain on this screen. The only
// path to "proof" from this doorway now leads into the app itself, to the
// real Prove It Works panel and live Diagnostics Meter (Package Store tab).
import { useCallback } from 'react';
import { useLifecycleStage } from '../hooks/useLifecycleStage';
// Shared style tokens matching WelcomeView dark theme
const S = {
    overlay: {
        position: 'fixed',
        inset: 0,
        zIndex: 9600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0d1117',
        fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    card: {
        width: '100%',
        maxWidth: 480,
        padding: '36px 32px',
        background: '#111827',
        border: '1px solid rgba(100, 116, 139, 0.2)',
        borderRadius: 12,
        margin: '0 16px',
    },
    brandLine: {
        fontSize: 11,
        fontWeight: 700,
        color: '#6ee7b7',
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
        marginBottom: 20,
    },
    heading: {
        fontSize: 16,
        fontWeight: 800,
        color: '#e2e8f0',
        lineHeight: 1.3,
        margin: '0 0 10px',
    },
    introLine: {
        fontSize: 12,
        color: '#64748b',
        lineHeight: 1.6,
        marginBottom: 20,
    },
    backBtn: {
        background: 'none',
        border: 'none',
        color: '#475569',
        fontSize: 11,
        cursor: 'pointer',
        padding: '0 0 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
    },
    proceedBtn: {
        marginTop: 14,
        width: '100%',
        padding: '10px 0',
        background: 'rgba(6, 78, 59, 0.25)',
        border: '1px solid rgba(110, 231, 183, 0.45)',
        borderRadius: 8,
        color: '#6ee7b7',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'background 0.15s',
    },
};
export function Layer2ProveIt({ onBack, onDone }) {
    const { advanceTo } = useLifecycleStage();
    // BP137 Yoke: single honest CTA -- no self-graded benchmark runs on this screen.
    // Routes into the app (Package Store tab -> "Prove It Works" panel + Diagnostics'
    // live Meter, i.e. ProveItWorksTab / OneClickMeshTestPanel), which recompute
    // results live instead of showing pre-graded numbers.
    const handleGoToHonestProof = useCallback(() => {
        advanceTo('C');
        if (onDone) {
            onDone();
        }
        else {
            onBack();
        }
    }, [advanceTo, onDone, onBack]);
    return (_jsx("div", { style: S.overlay, children: _jsxs("div", { style: { ...S.card, maxWidth: 860 }, children: [_jsx("button", { type: "button", style: S.backBtn, onClick: onBack, children: '< back' }), _jsx("div", { style: S.brandLine, children: "Proof That It Works" }), _jsx("h2", { style: S.heading, children: "See it work, live." }), _jsx("p", { style: S.introLine, children: "The real proof lives inside the app, not on this screen: the Package Store tab's \"Prove It Works\" panel and the live Diagnostics Meter run and score results fresh each time, so nothing here is pre-graded or pre-filled in advance." }), _jsx("button", { type: "button", style: S.proceedBtn, onClick: handleGoToHonestProof, children: "Continue to Prove It Works & the live Meter" })] }) }));
}
export default Layer2ProveIt;
