import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// BP041 — Novacula Fire Button
// Member-replicable dispatch of the K533 canonical test #1 payload
// POST → http://127.0.0.1:11480/yoke/wave/dispatch
import { useState, useEffect } from 'react';
export function NovaculaFireButton() {
    const [fireState, setFireState] = useState('idle');
    const [waveId, setWaveId] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);
    const [showDetails, setShowDetails] = useState(false);
    // BP041 micro-followup — read seg_count_target dynamically from canonical
    // so the subtitle matches the actual payload (v2 = 60-SEG; v1 was 24-SEG).
    const [segCountTarget, setSegCountTarget] = useState(null);
    // Load canonical on mount to populate the subtitle (separate from fire-click fetch).
    useEffect(() => {
        fetch('/canonical/novacula/bp041_empirical_proof.json')
            .then((r) => (r.ok ? r.json() : null))
            .then((p) => {
            if (p)
                setSegCountTarget(p.seg_count_target ?? p.segs?.length ?? null);
        })
            .catch(() => { });
    }, []);
    const handleFire = async () => {
        setFireState('loading');
        setWaveId(null);
        setErrorMsg(null);
        try {
            const payloadResp = await fetch('/canonical/novacula/bp041_empirical_proof.json');
            if (!payloadResp.ok) {
                throw new Error(`Failed to load canonical payload: HTTP ${payloadResp.status}`);
            }
            const payload = await payloadResp.json();
            const dispatchResp = await fetch('http://127.0.0.1:11480/yoke/wave/dispatch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    anchor: payload.anchor,
                    segs: payload.segs,
                    synthesis_prompt: payload.synthesis_prompt,
                    synthesis_recipient: payload.synthesis_recipient,
                    // Layer 1 — Adaptive Concurrency Carrier: work-plan declaration
                    seg_count_target: payload.seg_count_target,
                    acceptable_min: payload.acceptable_min,
                }),
            });
            if (!dispatchResp.ok) {
                const errText = await dispatchResp.text();
                throw new Error(`Dispatch failed (HTTP ${dispatchResp.status}): ${errText.slice(0, 200)}`);
            }
            const result = await dispatchResp.json();
            const id = String(result.wave_id ?? result.id ?? JSON.stringify(result).slice(0, 40));
            setWaveId(id);
            setFireState('success');
            // BP041 — Broadcast the fired wave_id to LiveSegWatch (and any other
            // listeners). Direct event channel; doesn't depend on saga subscription
            // catching the wave on its 3s poll. Also stash in localStorage so the
            // most-recent wave survives reloads (Card C "Just Watch" reads it).
            try {
                window.dispatchEvent(new CustomEvent('mnemosyne-wave-fired', { detail: { waveId: id } }));
                localStorage.setItem('mnemosyne_last_wave_id', id);
            }
            catch { /* non-fatal */ }
        }
        catch (err) {
            setErrorMsg(err instanceof Error ? err.message : String(err));
            setFireState('error');
        }
    };
    const isInFlight = fireState === 'loading';
    return (_jsxs("div", { style: styles.wrapper, children: [_jsx("button", { style: {
                    ...styles.fireBtn,
                    opacity: isInFlight ? 0.65 : 1,
                    cursor: isInFlight ? 'not-allowed' : 'pointer',
                }, onClick: handleFire, disabled: isInFlight, title: "Fire BP041 Empirical Proof Novacula \u2014 K533 canonical test #1", children: isInFlight ? (_jsx(_Fragment, { children: "\u23F3 Firing Novacula\u2026" })) : (_jsx(_Fragment, { children: "\uD83C\uDF0A FIRE NOVACULA: BP041 Empirical Proof" })) }), _jsxs("div", { style: styles.subtitle, children: [segCountTarget ?? '—', " SEGs \u00B7 adaptive concurrency \u00B7 member-replicable \u00B7 K533 canonical test #1"] }), fireState === 'success' && waveId && (_jsxs("div", { style: styles.successBox, children: [_jsx("span", { style: styles.successIcon, children: "\u2705" }), _jsxs("span", { style: { display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }, children: [_jsx("b", { children: "Wave dispatched:" }), ' ', _jsx("code", { style: styles.waveIdCode, title: "Click to copy wave_id to clipboard", onClick: async () => {
                                    try {
                                        await navigator.clipboard.writeText(waveId);
                                        // Brief feedback by re-using the wave_id state value
                                        setWaveId(`✓ copied: ${waveId}`);
                                        setTimeout(() => setWaveId(waveId), 1200);
                                    }
                                    catch { /* permission denied; user can still triple-click select */ }
                                }, children: waveId })] }), _jsx("span", { style: styles.watchCta, children: "Watch live in Drekaskip panel below \u2193 \u00B7 click wave_id to copy" })] })), fireState === 'error' && errorMsg && (_jsxs("div", { style: styles.errorBox, children: [_jsx("span", { style: styles.errorIcon, children: "\u26A0" }), _jsx("span", { style: styles.errorText, children: errorMsg })] })), _jsx("div", { style: styles.detailsRow, children: _jsx("button", { style: styles.detailsToggle, onClick: () => setShowDetails((v) => !v), children: showDetails ? '▾ Hide details' : '▸ What is this?' }) }), showDetails && (_jsxs("div", { style: styles.detailsBox, children: [_jsxs("p", { style: styles.detailsPara, children: ["This button fires the ", _jsx("b", { children: "K533 Reproducibility Pack canonical test #1" }), ". It loads a deterministic 24-SEG payload from the bundled canonical store and dispatches it through AMPLIFY's Yoke wave engine at port 11480."] }), _jsxs("p", { style: styles.detailsPara, children: [_jsx("b", { children: "Verification steps:" }), " After dispatch, watch the 24 SEGs progress in the Drekaskip panel below. When complete, compare the synthesis content hash and SEG count to the published canonical at", ' ', _jsx("code", { style: styles.inlineCode, children: "canonical_hashes/bp041_empirical_proof.json" }), ". Zero errors + matching hash = empirical proof of member-replicability."] }), _jsxs("p", { style: styles.detailsPara, children: ["Payload SHA-256:", ' ', _jsx("code", { style: styles.inlineCode, children: "e6b56c85\u2026afa29e3b" })] })] }))] }));
}
const styles = {
    wrapper: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
        padding: '0.6rem 0.75rem',
        background: '#0d1a2e',
        border: '1px solid #1e3a5f',
        borderRadius: '8px',
        marginBottom: '0.5rem',
    },
    fireBtn: {
        background: 'linear-gradient(135deg, #1e3a5f 0%, #0f4c75 100%)',
        border: '1.5px solid #3b82f6',
        borderRadius: '6px',
        color: '#e2e8f0',
        fontWeight: 700,
        fontSize: '0.9rem',
        padding: '0.6rem 1rem',
        textAlign: 'left',
        letterSpacing: '0.02em',
        transition: 'box-shadow 0.15s',
        boxShadow: '0 0 8px rgba(59,130,246,0.25)',
    },
    subtitle: {
        fontSize: '0.68rem',
        color: '#63b3ed',
        letterSpacing: '0.03em',
    },
    successBox: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.2rem',
        background: '#0d2d1a',
        border: '1px solid #22c55e',
        borderRadius: '5px',
        padding: '0.4rem 0.6rem',
        fontSize: '0.75rem',
        color: '#86efac',
    },
    successIcon: { fontSize: '0.8rem' },
    waveIdCode: {
        fontFamily: 'monospace',
        fontSize: '0.7rem',
        background: '#0a1f10',
        padding: '2px 6px',
        borderRadius: '3px',
        wordBreak: 'break-all',
        // BP041 — Founder direct: "I would LOVE to be able to highlight and copy
        // just the line you needed, but I cannot." Electron renderer often has
        // `user-select: none` inherited from body/root; force `text` on code
        // elements so member can triple-click to select OR click-to-copy.
        userSelect: 'text',
        cursor: 'pointer',
        border: '1px solid transparent',
        transition: 'border-color 0.15s, background 0.15s',
    },
    watchCta: {
        color: '#4ade80',
        fontStyle: 'italic',
        fontSize: '0.68rem',
    },
    errorBox: {
        display: 'flex',
        gap: '0.4rem',
        alignItems: 'flex-start',
        background: '#1a0a0a',
        border: '1px solid #ef4444',
        borderRadius: '5px',
        padding: '0.4rem 0.6rem',
        fontSize: '0.72rem',
        color: '#fca5a5',
    },
    errorIcon: { flexShrink: 0, fontSize: '0.8rem' },
    errorText: { wordBreak: 'break-word' },
    detailsRow: { display: 'flex' },
    detailsToggle: {
        background: 'none',
        border: 'none',
        color: '#4a5568',
        cursor: 'pointer',
        fontSize: '0.65rem',
        padding: 0,
    },
    detailsBox: {
        background: '#090f1a',
        border: '1px solid #1e2d40',
        borderRadius: '5px',
        padding: '0.5rem 0.6rem',
        fontSize: '0.7rem',
        color: '#a0aec0',
    },
    detailsPara: { margin: '0 0 0.35rem' },
    inlineCode: {
        fontFamily: 'monospace',
        fontSize: '0.65rem',
        background: '#0f1620',
        padding: '1px 3px',
        borderRadius: '3px',
    },
};
