import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * SubstrateSeedPanel — BP082 v0.2.2 SEG-3
 * Founder substrate seed admin path.
 * Settings → Substrate → Seed from Sealed Bank → Confirm
 *
 * Reads all 12,062 MMLU-Pro questions from the bundled resource bank and writes
 * Founder-attested seed eblets to verified_eblets.jsonl. Bypasses concordance per
 * Founder-attestation doctrine (BP080 Tower-of-Peace canon).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
const S = {
    panel: {
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(100,116,139,0.18)',
        borderRadius: 10,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
    },
    title: {
        fontSize: 13,
        fontWeight: 700,
        color: '#e2e8f0',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
    },
    desc: {
        fontSize: 12,
        color: '#94a3b8',
        lineHeight: 1.6,
    },
    btn: (variant) => ({
        padding: '7px 16px',
        borderRadius: 7,
        border: 'none',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        background: variant === 'primary' ? 'rgba(99,102,241,0.85)' :
            variant === 'danger' ? 'rgba(239,68,68,0.85)' :
                'rgba(100,116,139,0.2)',
        color: '#f8fafc',
        transition: 'opacity 0.15s',
    }),
    progressTrack: {
        height: 6,
        background: 'rgba(100,116,139,0.2)',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressFill: (pct) => ({
        height: '100%',
        width: `${Math.min(pct, 100)}%`,
        background: 'linear-gradient(90deg, #6ee7b7, #6366f1)',
        borderRadius: 4,
        transition: 'width 0.3s ease',
    }),
    confirmBox: {
        background: 'rgba(239,68,68,0.06)',
        border: '1px solid rgba(239,68,68,0.2)',
        borderRadius: 8,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
    },
    confirmText: {
        fontSize: 12,
        color: '#fca5a5',
        lineHeight: 1.6,
    },
    row: {
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
    },
    statChip: (color) => ({
        fontSize: 11,
        color,
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${color}30`,
        borderRadius: 5,
        padding: '3px 8px',
    }),
};
export function SubstrateSeedPanel() {
    const [state, setState] = useState({ id: 'idle' });
    const unsubRef = useRef(null);
    const [reseedState, setReseedState] = useState({ id: 'idle' });
    const reseedUnsubRef = useRef(null);
    // Subscribe to progress events when seeding starts
    useEffect(() => {
        if (state.id !== 'seeding')
            return;
        const unsub = window.amplify?.onPlowSeedProgress?.((data) => {
            if (data.done) {
                setState({ id: 'done', written: data.written, skipped: data.skipped, total: data.total });
                unsubRef.current?.();
                unsubRef.current = null;
            }
            else {
                setState({
                    id: 'seeding',
                    written: data.written,
                    skipped: data.skipped,
                    total: data.total,
                    pct: data.pct,
                });
            }
        });
        unsubRef.current = unsub ?? null;
        return () => {
            unsubRef.current?.();
            unsubRef.current = null;
        };
    }, [state.id]);
    const handleSeedConfirm = useCallback(async () => {
        setState({ id: 'seeding', written: 0, skipped: 0, total: 0, pct: 0 });
        try {
            const result = await window.amplify?.plowSeedFromBank?.();
            if (!result?.ok) {
                setState({ id: 'error', message: result?.errors?.[0] ?? 'Unknown seed error' });
            }
            // done state is set via progress event with done:true
        }
        catch (err) {
            setState({ id: 'error', message: String(err) });
        }
    }, []);
    // Subscribe to reset-reseed progress
    useEffect(() => {
        if (reseedState.id !== 'reseeding')
            return;
        const unsub = window.amplify?.onPlowResetReseedProgress?.((data) => {
            if (data.done) {
                setReseedState({ id: 'done', written: data.written, total: data.total });
                reseedUnsubRef.current?.();
                reseedUnsubRef.current = null;
            }
            else {
                setReseedState({ id: 'reseeding', written: data.written, total: data.total, pct: data.pct });
            }
        });
        reseedUnsubRef.current = unsub ?? null;
        return () => { reseedUnsubRef.current?.(); reseedUnsubRef.current = null; };
    }, [reseedState.id]);
    const handleReseedConfirm = useCallback(async () => {
        setReseedState({ id: 'reseeding', written: 0, total: 0, pct: 0 });
        try {
            const result = await window.amplify?.plowResetAndReseedContext?.();
            if (!result?.ok) {
                setReseedState({ id: 'error', message: 'Reseed failed · check console' });
            }
            else {
                setReseedState({ id: 'done', written: result.written, total: result.total, backupPath: result.backupPath });
            }
        }
        catch (err) {
            setReseedState({ id: 'error', message: String(err) });
        }
    }, []);
    return (_jsxs("div", { style: S.panel, children: [_jsx("div", { style: S.title, children: "\u2697 Substrate \u00B7 Seed from Sealed Bank" }), _jsx("p", { style: S.desc, children: "Write all MMLU-Pro questions from the bundled sealed bank directly to substrate as Founder-attested seed eblets. Bypasses 3-voter concordance \u2014 Founder attestation IS the verification. (~12,000 Q&A eblets, one-time, ~3\u20135 minutes.)" }), state.id === 'idle' && (_jsx("div", { style: S.row, children: _jsx("button", { type: "button", style: S.btn('primary'), onClick: () => setState({ id: 'confirming' }), children: "Seed from Sealed Bank \u2192" }) })), state.id === 'confirming' && (_jsxs("div", { style: S.confirmBox, children: [_jsx("p", { style: S.confirmText, children: "This will write ~12,000 Founder-attested eblets to your local substrate. Existing eblets are NOT deleted. Duplicates are skipped by sha256. This operation cannot be undone but can be safely repeated." }), _jsxs("div", { style: S.row, children: [_jsx("button", { type: "button", style: S.btn('danger'), onClick: handleSeedConfirm, children: "Confirm: Seed Substrate" }), _jsx("button", { type: "button", style: S.btn('ghost'), onClick: () => setState({ id: 'idle' }), children: "Cancel" })] })] })), state.id === 'seeding' && (_jsxs(_Fragment, { children: [_jsxs("div", { style: { fontSize: 12, color: '#6ee7b7', animation: 'mnemo-pulse 1.5s ease-in-out infinite' }, children: ["\u25CC Seeding substrate\u2026 ", state.written.toLocaleString(), " / ", state.total > 0 ? state.total.toLocaleString() : '?', " eblets written"] }), _jsx("div", { style: S.progressTrack, children: _jsx("div", { style: S.progressFill(state.pct) }) }), _jsxs("div", { style: { fontSize: 11, color: '#475569' }, children: [state.pct, "% complete", state.skipped > 0 && ` · ${state.skipped} skipped (duplicates)`] })] })), state.id === 'done' && (_jsxs(_Fragment, { children: [_jsx("div", { style: { fontSize: 13, fontWeight: 700, color: '#6ee7b7' }, children: "\u2713 Substrate seeded" }), _jsxs("div", { style: S.row, children: [_jsxs("span", { style: S.statChip('#6ee7b7'), children: ["\u2713 ", state.written.toLocaleString(), " written"] }), state.skipped > 0 && (_jsxs("span", { style: S.statChip('#94a3b8'), children: [state.skipped.toLocaleString(), " skipped"] })), _jsxs("span", { style: S.statChip('#818cf8'), children: [state.total.toLocaleString(), " total"] })] }), _jsx("p", { style: S.desc, children: "Plow the Field will now have a fully-seeded substrate to verify against. Run Plow on any domain \u2014 expected verified rate \u2265 40%." }), _jsx("button", { type: "button", style: S.btn('ghost'), onClick: () => setState({ id: 'idle' }), children: "Reset" })] })), state.id === 'error' && (_jsxs(_Fragment, { children: [_jsxs("div", { style: { fontSize: 12, color: '#f87171' }, children: ["\u2717 Seed error: ", state.message] }), _jsx("button", { type: "button", style: S.btn('ghost'), onClick: () => setState({ id: 'idle' }), children: "Retry" })] })), _jsxs("div", { style: { marginTop: 12, borderTop: '1px solid rgba(100,116,139,0.12)', paddingTop: 12 }, children: [_jsx("div", { style: { ...S.title, color: '#f59e0b' }, children: "\u26A0 Reset + Reseed Context-Class" }), _jsx("p", { style: { ...S.desc, marginTop: 6 }, children: "The original \"Seed from Sealed Bank\" wrote Q&A pairs that poison mesh test lift numbers (the grader can look up the exact answer). This action: (1) backs up your current substrate, (2) clears it, (3) re-seeds with topical-context eblets \u2014 domain labels without answer text \u2014 so Mesh Test lift is genuine cooperative-architecture lift, not answer-key lookup. Run Plow the Field afterward to grow the substrate organically." }), reseedState.id === 'idle' && (_jsx("button", { type: "button", style: { ...S.btn('danger'), marginTop: 8 }, onClick: () => setReseedState({ id: 'confirming' }), children: "Reset + Reseed Context-Class Substrate \u2192" })), reseedState.id === 'confirming' && (_jsxs("div", { style: { ...S.confirmBox, marginTop: 8 }, children: [_jsx("p", { style: S.confirmText, children: "This will CLEAR your substrate and re-seed with context-class eblets. Your current substrate is backed up automatically. Mesh Test lift numbers after this reset will be honest (not answer-key cheating)." }), _jsxs("div", { style: S.row, children: [_jsx("button", { type: "button", style: S.btn('danger'), onClick: handleReseedConfirm, children: "Confirm: Reset + Reseed" }), _jsx("button", { type: "button", style: S.btn('ghost'), onClick: () => setReseedState({ id: 'idle' }), children: "Cancel" })] })] })), reseedState.id === 'reseeding' && (_jsxs(_Fragment, { children: [_jsxs("div", { style: { fontSize: 12, color: '#f59e0b', marginTop: 8 }, children: ["\u25CC Reseed in progress\u2026 ", reseedState.written.toLocaleString(), " / ", reseedState.total > 0 ? reseedState.total.toLocaleString() : '?', " context eblets written"] }), _jsx("div", { style: { ...S.progressTrack, marginTop: 6 }, children: _jsx("div", { style: { ...S.progressFill(reseedState.pct), background: 'linear-gradient(90deg, #f59e0b, #f97316)' } }) })] })), reseedState.id === 'done' && (_jsxs(_Fragment, { children: [_jsx("div", { style: { fontSize: 13, fontWeight: 700, color: '#6ee7b7', marginTop: 8 }, children: "\u2713 Substrate reset + reseeded with context-class eblets" }), _jsxs("div", { style: S.row, children: [_jsxs("span", { style: S.statChip('#6ee7b7'), children: ["\u2713 ", reseedState.written.toLocaleString(), " context eblets"] }), _jsxs("span", { style: S.statChip('#818cf8'), children: [reseedState.total.toLocaleString(), " total"] })] }), _jsx("p", { style: { ...S.desc, marginTop: 6 }, children: "Substrate is now answer-key-free. Run Plow the Field to build organic domain knowledge. Mesh Test lift numbers will now be honest." }), _jsx("button", { type: "button", style: { ...S.btn('ghost'), marginTop: 4 }, onClick: () => setReseedState({ id: 'idle' }), children: "Done" })] })), reseedState.id === 'error' && (_jsxs(_Fragment, { children: [_jsxs("div", { style: { fontSize: 12, color: '#f87171', marginTop: 8 }, children: ["\u2717 Reseed error: ", reseedState.message] }), _jsx("button", { type: "button", style: S.btn('ghost'), onClick: () => setReseedState({ id: 'idle' }), children: "Retry" })] }))] })] }));
}
