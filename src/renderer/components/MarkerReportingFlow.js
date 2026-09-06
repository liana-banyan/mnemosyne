import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// MarkerReportingFlow — BP060 Application 002 Step 1 · UI-3
// Chess.com-adapted marker system for content-only (never person-direct) reporting.
// Per canon_second_door_political_expedition_wing_bp059 §6C.3-bis.
// Positive XOR Negative stance dropdown — mutually exclusive per submission.
// Matt 5:37 anchor: "Let your yea be yea, and your nay be nay."
// Markers attach to CONTENT ONLY (not users directly) — §6C.2 Challenge 2.
// Harper Guild custody disclosure always displayed.
import { useState, useCallback } from 'react';
// ─── Marker definitions ───────────────────────────────────────────────────────
const CLASS_A_MARKERS = [
    { id: 'religious', label: 'Religious', description: 'Contains religious content or framing' },
    { id: 'political', label: 'Political', description: 'Contains political content or advocacy' },
    { id: 'vulgar', label: 'Vulgar', description: 'Contains vulgar or crude language' },
    { id: 'offensive', label: 'Offensive', description: 'Likely to cause offense to a reasonable person' },
    { id: 'racist', label: 'Racist', description: 'Contains racist language or framing' },
    { id: 'bigoted', label: 'Bigoted', description: 'Expresses bigotry toward a group' },
    { id: 'extremist', label: 'Extremist', description: 'Promotes extreme or violent views' },
    { id: 'hateful', label: 'Hateful', description: 'Contains hate-class content' },
];
const CLASS_B_MARKERS = [
    { id: 'kind', label: 'Kind', description: 'Demonstrates genuine kindness in tone or action' },
    { id: 'generous', label: 'Generous', description: 'Shows generosity toward others' },
    { id: 'good', label: 'Good', description: 'Content produces good outcomes for the community' },
    { id: 'positive', label: 'Positive', description: 'Positive and uplifting in its effect' },
];
const CLASS_C_MARKERS = [
    { id: 'honest', label: 'Honest', description: 'Engages honestly with evidence and argument' },
    { id: 'fair', label: 'Fair', description: 'Fair engagement process — cites, doesn\'t misrepresent' },
];
// ─── Component ────────────────────────────────────────────────────────────────
export function MarkerReportingFlow() {
    const [contentRef, setContentRef] = useState('');
    const [stance, setStance] = useState(null);
    const [selectedMarkers, setSelectedMarkers] = useState(new Set());
    const [matt537, setMatt537] = useState(false);
    const [submitted, setSubmitted] = useState([]);
    const [showConfirm, setShowConfirm] = useState(false);
    const toggleMarker = useCallback((id) => {
        setSelectedMarkers((prev) => {
            const next = new Set(prev);
            if (next.has(id))
                next.delete(id);
            else
                next.add(id);
            return next;
        });
    }, []);
    const handleStanceChange = (s) => {
        setStance(s);
        setSelectedMarkers(new Set()); // reset markers when stance flips
    };
    const handleSubmit = useCallback(() => {
        if (!contentRef.trim() || !stance || selectedMarkers.size === 0 || !matt537)
            return;
        const marker = {
            content_ref: contentRef.trim(),
            stance,
            marker_ids: [...selectedMarkers],
            matt_537_affirmed: matt537,
            ts: Date.now(),
            session_id: `marker-${Date.now().toString(36)}`,
        };
        setSubmitted((prev) => [marker, ...prev.slice(0, 49)]);
        // Reset form
        setContentRef('');
        setStance(null);
        setSelectedMarkers(new Set());
        setMatt537(false);
        setShowConfirm(false);
    }, [contentRef, stance, selectedMarkers, matt537]);
    const canSubmit = contentRef.trim().length > 0 && stance !== null && selectedMarkers.size > 0 && matt537;
    const markersForStance = stance === 'negative'
        ? CLASS_A_MARKERS
        : [...CLASS_B_MARKERS, ...CLASS_C_MARKERS];
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }, children: [_jsxs("div", { style: {
                    padding: '10px 14px 6px',
                    borderBottom: '1px solid rgba(110,231,183,0.15)',
                    flexShrink: 0,
                }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 700, color: '#6ee7b7', marginBottom: 2 }, children: "Marker Reporting" }), _jsx("div", { style: { fontSize: 9, color: '#475569' }, children: "Content-only markers \u00B7 Chess.com-adapted \u00B7 Harper Guild custody" })] }), _jsxs("div", { style: { flex: 1, overflow: 'auto', padding: '10px 14px' }, children: [_jsxs("div", { style: {
                            marginBottom: 12,
                            padding: '8px 10px',
                            background: 'rgba(167,139,250,0.06)',
                            border: '1px solid rgba(167,139,250,0.2)',
                            borderRadius: 6,
                        }, children: [_jsx("div", { style: { fontSize: 9, fontWeight: 700, color: '#a78bfa', marginBottom: 3 }, children: "Harper Guild Custody Disclosure" }), _jsxs("div", { style: { fontSize: 8, color: '#64748b', lineHeight: 1.6 }, children: ["Markers attach to ", _jsx("strong", { style: { color: '#94a3b8' }, children: "content items only" }), " \u2014 never to persons directly. Your identity is anonymous to the recipient but known to the LB substrate and Harper Guild monitors, who are sworn to confidentiality (psychiatrist-analog). Anonymity may be lifted by a majority vote of 3 Harper Guild members if harm is involved (Tarasoff-class duty). By submitting, you affirm your marker is genuine."] })] }), _jsxs("div", { style: { marginBottom: 10 }, children: [_jsx("label", { style: { fontSize: 9, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 4 }, children: "Content Reference (ID or URL of the specific content)" }), _jsx("input", { value: contentRef, onChange: (e) => setContentRef(e.target.value), placeholder: "content-id, post-hash, or URL", style: {
                                    width: '100%',
                                    background: 'rgba(0,0,0,0.3)',
                                    border: '1px solid rgba(100,116,139,0.3)',
                                    borderRadius: 5,
                                    color: '#e2e8f0',
                                    fontSize: 10,
                                    padding: '6px 8px',
                                    boxSizing: 'border-box',
                                    fontFamily: 'monospace',
                                } })] }), _jsxs("div", { style: { marginBottom: 10 }, children: [_jsx("label", { style: { fontSize: 9, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 4 }, children: "Rating Direction \u2014 choose ONE (Positive OR Negative, not both)" }), _jsx("div", { style: { display: 'flex', gap: 6 }, children: ['positive', 'negative'].map((s) => (_jsx("button", { onClick: () => handleStanceChange(s), style: {
                                        flex: 1,
                                        padding: '7px 12px',
                                        background: stance === s
                                            ? s === 'positive' ? 'rgba(110,231,183,0.15)' : 'rgba(239,68,68,0.12)'
                                            : 'rgba(255,255,255,0.03)',
                                        border: `1px solid ${stance === s
                                            ? s === 'positive' ? 'rgba(110,231,183,0.5)' : 'rgba(239,68,68,0.4)'
                                            : 'rgba(100,116,139,0.2)'}`,
                                        borderRadius: 6,
                                        color: stance === s
                                            ? s === 'positive' ? '#6ee7b7' : '#f87171'
                                            : '#64748b',
                                        fontSize: 10,
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        transition: 'all 0.15s',
                                    }, children: s === 'positive' ? '👍 Positive Rating' : '⚠ Negative Rating' }, s))) })] }), stance && (_jsxs("div", { style: { marginBottom: 10 }, children: [_jsxs("label", { style: { fontSize: 9, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 6 }, children: [stance === 'negative' ? 'Class A · Negative Content Markers' : 'Class B + C · Positive Markers', " (select all that apply)"] }), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 5 }, children: markersForStance.map((m) => {
                                    const selected = selectedMarkers.has(m.id);
                                    const color = stance === 'positive' ? '#6ee7b7' : '#f87171';
                                    return (_jsxs("button", { onClick: () => toggleMarker(m.id), title: m.description, style: {
                                            padding: '4px 10px',
                                            background: selected ? `rgba(${stance === 'positive' ? '110,231,183' : '239,68,68'},0.15)` : 'rgba(255,255,255,0.03)',
                                            border: `1px solid ${selected ? color + '55' : 'rgba(100,116,139,0.2)'}`,
                                            borderRadius: 12,
                                            color: selected ? color : '#475569',
                                            fontSize: 9,
                                            fontWeight: selected ? 700 : 400,
                                            cursor: 'pointer',
                                            transition: 'all 0.15s',
                                        }, children: [selected ? '✓ ' : '', m.label] }, m.id));
                                }) })] })), stance && selectedMarkers.size > 0 && (_jsx("div", { style: {
                            marginBottom: 12,
                            padding: '8px 10px',
                            background: matt537 ? 'rgba(110,231,183,0.06)' : 'rgba(245,158,11,0.06)',
                            border: `1px solid ${matt537 ? 'rgba(110,231,183,0.25)' : 'rgba(245,158,11,0.25)'}`,
                            borderRadius: 6,
                        }, children: _jsxs("label", { style: { display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }, children: [_jsx("input", { type: "checkbox", checked: matt537, onChange: (e) => setMatt537(e.target.checked), style: { marginTop: 2, flexShrink: 0 } }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 9, fontWeight: 700, color: matt537 ? '#6ee7b7' : '#f59e0b' }, children: "This will be stamped \u2014 recorded permanently." }), _jsx("div", { style: { fontSize: 9, color: '#64748b', marginTop: 2, fontStyle: 'italic', lineHeight: 1.5 }, children: "\"Let your yea be yea, and your nay be nay.\" \u2014 Matthew 5:37 (KJV)" }), _jsx("div", { style: { fontSize: 8, color: '#475569', marginTop: 2 }, children: "I affirm this marker is genuine and I have reviewed the content I am marking." })] })] }) })), _jsx("button", { onClick: () => canSubmit && setShowConfirm(true), disabled: !canSubmit, style: {
                            width: '100%',
                            padding: '9px 14px',
                            background: canSubmit ? 'rgba(110,231,183,0.12)' : 'rgba(100,116,139,0.06)',
                            border: `1px solid ${canSubmit ? 'rgba(110,231,183,0.4)' : 'rgba(100,116,139,0.15)'}`,
                            borderRadius: 6,
                            color: canSubmit ? '#6ee7b7' : '#334155',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: canSubmit ? 'pointer' : 'not-allowed',
                            transition: 'all 0.15s',
                        }, children: "Submit Marker Report" }), showConfirm && (_jsxs("div", { style: {
                            marginTop: 10,
                            padding: '12px 14px',
                            background: 'rgba(15,17,26,0.97)',
                            border: '1px solid rgba(110,231,183,0.4)',
                            borderRadius: 8,
                        }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }, children: "Confirm Marker Submission" }), _jsxs("div", { style: { fontSize: 9, color: '#64748b', marginBottom: 8, lineHeight: 1.6 }, children: [_jsx("strong", { style: { color: '#94a3b8' }, children: "Content:" }), " ", contentRef, _jsx("br", {}), _jsx("strong", { style: { color: '#94a3b8' }, children: "Stance:" }), " ", stance, _jsx("br", {}), _jsx("strong", { style: { color: '#94a3b8' }, children: "Markers:" }), " ", [...selectedMarkers].join(', ')] }), _jsxs("div", { style: { display: 'flex', gap: 6 }, children: [_jsx("button", { onClick: handleSubmit, style: {
                                            flex: 1, padding: '6px 12px',
                                            background: 'rgba(110,231,183,0.15)',
                                            border: '1px solid rgba(110,231,183,0.4)',
                                            borderRadius: 5, color: '#6ee7b7',
                                            fontSize: 10, fontWeight: 700, cursor: 'pointer',
                                        }, children: "Confirm & Stamp" }), _jsx("button", { onClick: () => setShowConfirm(false), style: {
                                            padding: '6px 12px',
                                            background: 'rgba(255,255,255,0.04)',
                                            border: '1px solid rgba(100,116,139,0.2)',
                                            borderRadius: 5, color: '#475569',
                                            fontSize: 10, cursor: 'pointer',
                                        }, children: "Cancel" })] })] })), submitted.length > 0 && (_jsxs("div", { style: { marginTop: 14 }, children: [_jsxs("div", { style: { fontSize: 9, fontWeight: 600, color: '#475569', marginBottom: 6 }, children: ["Submitted This Session (", submitted.length, ")"] }), submitted.map((m, i) => (_jsxs("div", { style: {
                                    marginBottom: 6,
                                    padding: '6px 8px',
                                    background: m.stance === 'positive' ? 'rgba(110,231,183,0.05)' : 'rgba(239,68,68,0.05)',
                                    border: `1px solid ${m.stance === 'positive' ? 'rgba(110,231,183,0.2)' : 'rgba(239,68,68,0.2)'}`,
                                    borderRadius: 5,
                                    fontSize: 9,
                                }, children: [_jsxs("div", { style: { color: m.stance === 'positive' ? '#6ee7b7' : '#f87171', fontWeight: 600 }, children: [m.stance === 'positive' ? '👍' : '⚠', " ", m.content_ref] }), _jsxs("div", { style: { color: '#475569', marginTop: 2 }, children: [m.marker_ids.join(', '), " \u00B7 ", new Date(m.ts).toISOString().slice(11, 19), "Z"] })] }, i)))] }))] })] }));
}
export default MarkerReportingFlow;
