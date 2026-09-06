import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// DevModeTab — SAGA 11 BP046B · v0.1.8 BP052 NOVACULA W1 SEG-FT-4
// Developer Mode — 6 inspector panels (pill tabs at top):
//   1. Caithedral™ Inspector   — retrieval log (W2 full implementation)
//   2. Eblet™ Inspector        — searchable Eblet store (W2 full implementation)
//   3. Pheromone Visualizer    — trail heat map (W2 full implementation)
//   4. Banyan Metric™ Ledger   — composite score ledger (W2 full implementation)
//   5. Atlas™ Panel            — links to Atlas™ scheduling tab
//   6. SEG Controls            — Wave/Drekaskip/Novacula/AutoBaton + Gauntlet surfaces
import { useState } from 'react';
import { CaiSymbol } from './CaiSymbol';
import { CaithedralInspector } from '../kitchen_table/CaithedralInspector';
import { EbletInspector } from '../kitchen_table/EbletInspector';
import { PheromoneVisualizer } from '../kitchen_table/PheromoneVisualizer';
import { BanyanMetricLedger } from '../kitchen_table/BanyanMetricLedger';
import { SubstratedFoldersPanel } from './SubstratedFoldersPanel';
const SURFACES = [
    { id: 'submit-test', icon: '📝', label: 'Submit New Test', desc: 'Define a Gauntlet variant · upload test data · register as project' },
    { id: 'uploads', icon: '📋', label: 'My Uploads', desc: 'Full ledger · every upload logged with timestamp + status + project' },
    { id: 'fork-strain', icon: '🍴', label: 'Fork Strain', desc: 'Clone MnemosyneC strain · modify · run · submit upstream or maintain fork' },
    { id: 'seg-control', icon: '⚙️', label: 'SEG Count Control', desc: 'Wave / Drekaskip / Novacula / AutoBaton selectors · parallel SEG count' },
    { id: 'project-connect', icon: '🔗', label: 'Project Connect', desc: 'Link upload to project · family/tribe/guild/business · Counterpart peer' },
    { id: 'variant-voting', icon: '🗳️', label: 'Variant Voting', desc: 'Submit to /gauntlet/variants/ · community votes · Level 3 auto-offer as strain' },
];
// ─── Inspector panel definitions ──────────────────────────────────────────────
const PANELS = [
    { id: 'caithedral', label: 'Caithedral™' },
    { id: 'eblet', label: 'Eblet™' },
    { id: 'pheromone', label: 'Pheromone' },
    { id: 'banyan-metric', label: 'Banyan Metric™' },
    { id: 'atlas', label: 'Atlas™' },
    { id: 'seg-controls', label: 'SEG Controls' },
    { id: 'substrate', label: 'Substrate™' },
];
export function DevModeTab({ authState, onDisable, onStepByStep }) {
    const [activePanel, setActivePanel] = useState('caithedral');
    const [activeSurface, setActiveSurface] = useState(null);
    const [flippedCard, setFlippedCard] = useState(null);
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }, children: [_jsxs("div", { style: {
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'rgba(245,158,11,0.06)', borderBottom: '1px solid rgba(245,158,11,0.15)',
                    padding: '6px 12px', flexShrink: 0,
                }, children: [_jsxs("div", { style: { fontSize: 11, fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 5 }, children: [_jsx(CaiSymbol, { size: "0.9em", color: "#f59e0b" }), "Developer Mode", _jsx("span", { style: { fontSize: 8, color: '#64748b', fontWeight: 400 }, children: "\u00B7 cooperative peer-witness real" })] }), _jsx("button", { onClick: onDisable, style: {
                            background: 'none', border: '1px solid rgba(100,116,139,0.25)',
                            color: '#475569', borderRadius: 6, padding: '3px 8px', fontSize: 9, cursor: 'pointer',
                        }, children: "Disable" })] }), _jsx("div", { style: {
                    display: 'flex', gap: 4, padding: '8px 12px 0',
                    borderBottom: '1px solid rgba(100,116,139,0.12)',
                    flexShrink: 0, overflowX: 'auto',
                }, children: PANELS.map((panel) => (_jsx("button", { onClick: () => setActivePanel(panel.id), style: {
                        padding: '4px 10px',
                        borderRadius: 12,
                        fontSize: 10,
                        fontWeight: activePanel === panel.id ? 700 : 400,
                        cursor: 'pointer',
                        border: activePanel === panel.id ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(100,116,139,0.15)',
                        background: activePanel === panel.id ? 'rgba(245,158,11,0.08)' : 'transparent',
                        color: activePanel === panel.id ? '#f59e0b' : '#64748b',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s',
                    }, children: panel.label }, panel.id))) }), _jsxs("div", { style: { flex: 1, overflow: 'auto' }, children: [activePanel === 'caithedral' && _jsx(CaithedralInspector, {}), activePanel === 'eblet' && _jsx(EbletInspector, {}), activePanel === 'pheromone' && _jsx(PheromoneVisualizer, {}), activePanel === 'banyan-metric' && _jsx(BanyanMetricLedger, {}), activePanel === 'atlas' && _jsx(AtlasPanel, {}), activePanel === 'seg-controls' && (_jsx(SegControlsPanel, { authState: authState, onDisable: onDisable, onStepByStep: onStepByStep, activeSurface: activeSurface, setActiveSurface: setActiveSurface, flippedCard: flippedCard, setFlippedCard: setFlippedCard })), activePanel === 'substrate' && _jsx(SubstratedFoldersPanel, {})] })] }));
}
// ─── Atlas™ Panel — links to Atlas tab ────────────────────────────────────────
function AtlasPanel() {
    return (_jsx("div", { style: { padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }, children: _jsxs("div", { style: {
                background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.2)',
                borderRadius: 8, padding: '16px 14px', textAlign: 'center',
            }, children: [_jsx("div", { style: { fontSize: 28, marginBottom: 8 }, children: "\uD83D\uDCC5" }), _jsx("div", { style: { fontSize: 13, fontWeight: 700, color: '#38bdf8', marginBottom: 4 }, children: "Atlas\u2122 Scheduling" }), _jsxs("div", { style: { fontSize: 10, color: '#64748b', lineHeight: 1.6 }, children: ["Atlas\u2122 is available in its own primary tab.", _jsx("br", {}), "Switch to the Atlas\u2122 tab to manage calendar events, participants, and P2P sync."] }), _jsx("div", { style: { fontSize: 9, color: '#334155', marginTop: 10 }, children: "Dev panel integration coming in a future wave \u2014 will show Atlas sync state, P2P event queue, and AI-suggest logs." })] }) }));
}
// ─── SEG Controls Panel (existing DevModeTab surface grid + original Gauntlet surfaces) ───
function SegControlsPanel({ authState, onDisable, onStepByStep, activeSurface, setActiveSurface, flippedCard, setFlippedCard, }) {
    if (activeSurface) {
        return (_jsx(SurfaceView, { surface: activeSurface, authState: authState, onBack: () => setActiveSurface(null) }));
    }
    return (_jsxs("div", { style: { padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }, children: [_jsx("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }, children: SURFACES.map((s) => (_jsx("div", { style: { position: 'relative', perspective: 600, height: 120 }, children: _jsxs("div", { style: {
                            position: 'absolute', inset: 0,
                            transformStyle: 'preserve-3d',
                            transition: 'transform 0.35s ease',
                            transform: flippedCard === s.id ? 'rotateY(180deg)' : 'rotateY(0deg)',
                        }, children: [_jsxs("div", { style: {
                                    position: 'absolute', inset: 0,
                                    backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                                    background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(100,116,139,0.15)',
                                    borderRadius: 10, padding: '12px 12px',
                                    display: 'flex', flexDirection: 'column', cursor: 'pointer', boxSizing: 'border-box',
                                }, onClick: () => setActiveSurface(s.id), onMouseEnter: (e) => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.3)'; e.currentTarget.style.background = 'rgba(245,158,11,0.04)'; }, onMouseLeave: (e) => { e.currentTarget.style.borderColor = 'rgba(100,116,139,0.15)'; e.currentTarget.style.background = 'rgba(15,23,42,0.6)'; }, children: [_jsx("div", { style: { fontSize: 18, marginBottom: 4 }, children: s.icon }), _jsx("div", { style: { fontSize: 11, fontWeight: 600, color: '#e2e8f0' }, children: s.label }), _jsx("div", { style: { fontSize: 9, color: '#475569', marginTop: 3, lineHeight: 1.5, flex: 1 }, children: s.desc }), _jsx("button", { onClick: (e) => { e.stopPropagation(); setFlippedCard(s.id); }, style: { alignSelf: 'flex-end', marginTop: 4, background: 'none', border: '1px solid rgba(100,116,139,0.2)', color: '#475569', borderRadius: 4, padding: '2px 7px', fontSize: 8, cursor: 'pointer' }, title: `More info about ${s.label}`, children: "More Info" })] }), _jsxs("div", { style: {
                                    position: 'absolute', inset: 0,
                                    backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                                    transform: 'rotateY(180deg)',
                                    background: 'rgba(15,23,42,0.92)', border: '1px solid rgba(245,158,11,0.2)',
                                    borderRadius: 10, padding: '10px 12px',
                                    display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', boxSizing: 'border-box',
                                }, children: [_jsx(CardDetailContent, { surfaceId: s.id }), _jsxs("div", { style: { display: 'flex', gap: 6, marginTop: 'auto' }, children: [_jsx("button", { onClick: () => setFlippedCard(null), style: { flex: 1, background: 'none', border: '1px solid rgba(100,116,139,0.2)', color: '#64748b', borderRadius: 6, padding: '4px 0', fontSize: 9, cursor: 'pointer' }, children: "\u2190 Back" }), _jsx("button", { onClick: () => { setFlippedCard(null); onStepByStep(s.id); }, style: { flex: 1, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b', borderRadius: 6, padding: '4px 0', fontSize: 9, cursor: 'pointer', fontWeight: 600 }, children: "Step-By-Step" })] })] })] }) }, s.id))) }), _jsx("div", { style: { background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(100,116,139,0.1)', borderRadius: 8, padding: '8px 12px' }, children: _jsxs("div", { style: { fontSize: 9, color: '#475569', lineHeight: 1.6 }, children: [_jsx("span", { style: { color: '#64748b', fontWeight: 600 }, children: "Cooperative Defensive Patent Pledge #2260" }), ' ', "\u2014 all Developer Mode submissions are bound by this pledge. Variants crossing community Level 3 (1,000+ credits) are auto-offered as optional download strains."] }) })] }));
}
// ─── Card detail content (flip back face) ─────────────────────────────────────
const CARD_DETAIL = {
    'submit-test': {
        headline: 'Submit New Test',
        body: 'Define a new Gauntlet variant. Describe a task, upload or point to test data, and register it as a named project. Community runs it. Pioneer Bonus fires if you are first.',
    },
    'uploads': {
        headline: 'My Uploads',
        body: 'Full ledger of every file or dataset you have submitted — timestamp, content snapshot, processing status, linked project, and its place in the variant lineage.',
    },
    'fork-strain': {
        headline: 'Fork Strain',
        body: 'Clone the current MnemosyneC strain, modify it, run it locally against your own tests, then submit a pull upstream or maintain your own fork permanently.',
    },
    'seg-control': {
        headline: 'SEG Count Control',
        body: 'Choose your orchestration pattern: Wave (sequential fan-out), Drekaskip (priority-skip routing), Novacula (18-SEG parallel — current default), or AutoBaton (Maestro auto-selects).',
    },
    'project-connect': {
        headline: 'Project Connect',
        body: 'Link an upload to a specific project — your own, a family member, tribe group, guild, business, or a Counterpart peer node in the cooperative.',
    },
    'variant-voting': {
        headline: 'Variant Voting',
        body: 'Submit a Gauntlet variant to the community voting pool. Community members vote with credits. A variant reaching Level 3 (1,000+ credits) is auto-offered as an optional download strain.',
    },
};
function CardDetailContent({ surfaceId }) {
    const c = CARD_DETAIL[surfaceId];
    return (_jsxs("div", { style: { flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }, children: [_jsx("div", { style: { fontSize: 10, fontWeight: 700, color: '#f59e0b' }, children: c.headline }), _jsx("div", { style: { fontSize: 9, color: '#94a3b8', lineHeight: 1.6 }, children: c.body })] }));
}
// ─── Surface view placeholder ─────────────────────────────────────────────────
function SurfaceView({ surface, authState, onBack }) {
    const def = SURFACES.find((s) => s.id === surface);
    return (_jsxs("div", { style: { padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10 }, children: [_jsx("button", { onClick: onBack, style: { background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16, padding: 0 }, children: "\u2190" }), _jsxs("div", { children: [_jsxs("div", { style: { fontSize: 14, fontWeight: 700, color: '#e2e8f0' }, children: [def.icon, " ", def.label] }), _jsx("div", { style: { fontSize: 10, color: '#64748b', marginTop: 2 }, children: def.desc })] })] }), surface === 'submit-test' && _jsx(SubmitTestForm, { authState: authState }), surface === 'uploads' && _jsx(UploadsLedger, {}), surface === 'fork-strain' && _jsx(ForkStrainPanel, {}), surface === 'seg-control' && _jsx(SEGControlPanel, {}), surface === 'project-connect' && _jsx(ProjectConnectPanel, {}), surface === 'variant-voting' && _jsx(VariantVotingPanel, {})] }));
}
// ─── Surface stubs (SAGA 11 fills these out) ─────────────────────────────────
function SubmitTestForm({ authState }) {
    return (_jsxs("div", { style: { color: '#64748b', fontSize: 12, padding: '20px 0', textAlign: 'center' }, children: [_jsx("div", { style: { fontSize: 24, marginBottom: 8 }, children: "\uD83D\uDCDD" }), _jsx("div", { children: "Gauntlet variant submission form" }), _jsx("div", { style: { fontSize: 10, marginTop: 4 }, children: "SAGA 11 full implementation \u00B7 define test \u00B7 upload data \u00B7 register project" })] }));
}
function UploadsLedger() {
    return (_jsxs("div", { style: { color: '#64748b', fontSize: 12, padding: '20px 0', textAlign: 'center' }, children: [_jsx("div", { style: { fontSize: 24, marginBottom: 8 }, children: "\uD83D\uDCCB" }), _jsx("div", { children: "Uploads ledger \u2014 every upload logged" }), _jsx("div", { style: { fontSize: 10, marginTop: 4 }, children: "Timestamp \u00B7 content snapshot \u00B7 status \u00B7 project association \u00B7 variant lineage" })] }));
}
function ForkStrainPanel() {
    return (_jsxs("div", { style: { color: '#64748b', fontSize: 12, padding: '20px 0', textAlign: 'center' }, children: [_jsx("div", { style: { fontSize: 24, marginBottom: 8 }, children: "\uD83C\uDF74" }), _jsx("div", { children: "Fork current MnemosyneC strain" }), _jsx("div", { style: { fontSize: 10, marginTop: 4 }, children: "Clone \u00B7 modify \u00B7 run locally \u00B7 submit upstream OR maintain personal fork" })] }));
}
function SEGControlPanel() {
    return (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 10 }, children: [
            { id: 'wave', label: '🌊 Wave', desc: 'Standard sequential fan-out' },
            { id: 'drekaskip', label: '🐉 Drekaskip', desc: 'Priority-routing skip-class' },
            { id: 'novacula', label: '⚡ Novacula', desc: '18-SEG parallel fan-out (current)' },
            { id: 'autobaton', label: '🎯 AutoBaton', desc: 'Maestro-class automatic selection' },
        ].map((opt) => (_jsxs("div", { style: {
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(100,116,139,0.15)',
                borderRadius: 8, padding: '10px 12px',
            }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 12, fontWeight: 600, color: '#e2e8f0' }, children: opt.label }), _jsx("div", { style: { fontSize: 10, color: '#475569', marginTop: 2 }, children: opt.desc })] }), _jsx("input", { type: "radio", name: "orchestrator", value: opt.id, defaultChecked: opt.id === 'novacula' })] }, opt.id))) }));
}
function ProjectConnectPanel() {
    return (_jsxs("div", { style: { color: '#64748b', fontSize: 12, padding: '20px 0', textAlign: 'center' }, children: [_jsx("div", { style: { fontSize: 24, marginBottom: 8 }, children: "\uD83D\uDD17" }), _jsx("div", { children: "Connect to a project" }), _jsx("div", { style: { fontSize: 10, marginTop: 4 }, children: "Own project \u00B7 family/tribe/guild/business \u00B7 Counterpart peer" })] }));
}
function VariantVotingPanel() {
    return (_jsxs("div", { style: { color: '#64748b', fontSize: 12, padding: '20px 0', textAlign: 'center' }, children: [_jsx("div", { style: { fontSize: 24, marginBottom: 8 }, children: "\uD83D\uDDF3\uFE0F" }), _jsx("div", { children: "Submit variant to community voting" }), _jsx("div", { style: { fontSize: 10, marginTop: 4 }, children: "Level 3 (1,000+ credits) \u2192 auto-offered as optional download strain" })] }));
}
