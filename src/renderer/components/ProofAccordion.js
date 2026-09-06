import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ProofAccordion.tsx -- SEG-U-3/7 BP078 v0.1.36
// Three-accordion proof area: HOT/COLD chart, mesh benchmark, kappa trophy.
// SEG-U-7: listens for 'mesh-test-complete' IPC to populate item 2.
import { useState, useEffect, useRef } from 'react';
import { BenchmarkProofChart } from './BenchmarkProofChart';
function AccordionItem({ title, isOpen, onToggle, children }) {
    const bodyRef = useRef(null);
    const header = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        cursor: 'pointer',
        background: '#1e293b',
        borderRadius: isOpen ? '6px 6px 0 0' : 6,
        border: '1px solid rgba(100, 116, 139, 0.25)',
        borderBottom: isOpen ? '1px solid rgba(100, 116, 139, 0.15)' : '1px solid rgba(100, 116, 139, 0.25)',
        userSelect: 'none',
        transition: 'background 120ms ease',
    };
    const titleStyle = {
        fontSize: 12,
        fontWeight: 600,
        color: '#94a3b8',
        letterSpacing: '0.02em',
    };
    const chevronStyle = {
        width: 16,
        height: 16,
        color: '#475569',
        flexShrink: 0,
        transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
        transition: 'transform 220ms ease',
    };
    const bodyWrap = {
        overflow: 'hidden',
        maxHeight: isOpen ? 600 : 0,
        transition: 'max-height 280ms ease',
        border: isOpen ? '1px solid rgba(100, 116, 139, 0.25)' : 'none',
        borderTop: 'none',
        borderRadius: '0 0 6px 6px',
    };
    const bodyInner = {
        padding: '12px 14px',
        background: '#111827',
    };
    return (_jsxs("div", { style: { marginBottom: 6 }, children: [_jsxs("div", { style: header, onClick: onToggle, role: "button", "aria-expanded": isOpen, children: [_jsx("span", { style: titleStyle, children: title }), _jsx("svg", { style: chevronStyle, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: _jsx("path", { d: "M6 3l5 5-5 5", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }) })] }), _jsx("div", { style: bodyWrap, ref: bodyRef, "aria-hidden": !isOpen, children: _jsx("div", { style: bodyInner, children: children }) })] }));
}
function MeshPendingBody() {
    return (_jsx("div", { className: "mesh-pending", style: { fontSize: 12, color: '#475569', lineHeight: 1.6, padding: '4px 0' }, children: "Mesh benchmark pending -- results will populate here after the three-node test completes." }));
}
function MeshResultsBody({ metrics }) {
    const deltaSign = metrics.delta_pp >= 0 ? '+' : '';
    const statBlock = {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    };
    const bigStat = {
        fontSize: 20,
        fontWeight: 800,
        color: '#6ee7b7',
        lineHeight: 1.2,
    };
    const statLabel = {
        fontSize: 11,
        color: '#475569',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        marginBottom: 2,
    };
    const row = {
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
    };
    const cell = {
        flex: '1 1 80px',
    };
    return (_jsxs("div", { style: statBlock, children: [_jsxs("div", { style: { marginBottom: 4 }, children: [_jsx("div", { style: statLabel, children: "HOT vs COLD accuracy lift" }), _jsxs("div", { style: bigStat, children: [deltaSign, metrics.delta_pp.toFixed(1), " pp"] })] }), _jsxs("div", { style: row, children: [_jsxs("div", { style: cell, children: [_jsx("div", { style: statLabel, children: "HOT accuracy" }), _jsxs("div", { style: { fontSize: 15, fontWeight: 700, color: '#60a5fa' }, children: [metrics.hot_accuracy_pct.toFixed(1), "%"] })] }), _jsxs("div", { style: cell, children: [_jsx("div", { style: statLabel, children: "COLD accuracy" }), _jsxs("div", { style: { fontSize: 15, fontWeight: 700, color: '#64748b' }, children: [metrics.cold_accuracy_pct.toFixed(1), "%"] })] }), metrics.fast_cheap_good && (_jsxs("div", { style: cell, children: [_jsx("div", { style: statLabel, children: "FCG score" }), _jsx("div", { style: { fontSize: 15, fontWeight: 700, color: '#a78bfa' }, children: metrics.fast_cheap_good })] }))] }), metrics.svgPath && (_jsx("img", { src: metrics.svgPath, alt: "Mesh test big numbers", style: { width: '100%', marginTop: 8, borderRadius: 4 } }))] }));
}
function TrophyBody() {
    const trophyCard = {
        border: '1px solid rgba(234, 179, 8, 0.4)',
        borderRadius: 8,
        background: 'rgba(234, 179, 8, 0.05)',
        padding: '14px 16px',
    };
    const kappaValue = {
        fontSize: 26,
        fontWeight: 900,
        color: '#eab308',
        lineHeight: 1.1,
        marginBottom: 4,
    };
    const kappaLabel = {
        fontSize: 11,
        fontWeight: 700,
        color: '#92400e',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        marginBottom: 10,
    };
    const subText = {
        fontSize: 12,
        color: '#78716c',
        lineHeight: 1.55,
    };
    return (_jsxs("div", { style: trophyCard, children: [_jsx("div", { style: kappaLabel, children: "Cohen's Kappa" }), _jsx("div", { style: kappaValue, children: "1.000" }), _jsx("div", { style: subText, children: "Perfect agreement between AI and human judgment across 75 benchmark questions." })] }));
}
export function ProofAccordion() {
    const [open, setOpen] = useState([false, false, false]);
    const [meshMetrics, setMeshMetrics] = useState(null);
    const firstMeshRef = useRef(false);
    const toggle = (idx) => {
        setOpen((prev) => {
            const next = [...prev];
            next[idx] = !next[idx];
            return next;
        });
    };
    useEffect(() => {
        const amplify = window.amplify;
        if (!amplify?.onMeshTestComplete)
            return;
        const unsub = amplify.onMeshTestComplete((metrics) => {
            setMeshMetrics(metrics);
            if (!firstMeshRef.current) {
                firstMeshRef.current = true;
                setOpen((prev) => {
                    const next = [...prev];
                    next[1] = true;
                    return next;
                });
            }
        });
        return unsub;
    }, []);
    const container = {
        margin: '0 0 20px',
        width: '100%',
    };
    return (_jsxs("div", { style: container, children: [_jsx(AccordionItem, { title: "HOT/COLD Banyan Metric Results", isOpen: open[0], onToggle: () => toggle(0), children: _jsx(BenchmarkProofChart, {}) }), _jsx(AccordionItem, { title: "Google's Gemma 4 12B MMLU-Pro Benchmark", isOpen: open[1], onToggle: () => toggle(1), children: meshMetrics ? _jsx(MeshResultsBody, { metrics: meshMetrics }) : _jsx(MeshPendingBody, {}) }), _jsx(AccordionItem, { title: "BP074 Sound Barrier -- Cohen's Kappa 1.000 Trophy", isOpen: open[2], onToggle: () => toggle(2), children: _jsx(TrophyBody, {}) })] }));
}
export default ProofAccordion;
