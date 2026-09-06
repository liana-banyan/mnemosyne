import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// MultiAISelector — BP060 Application 002 Step 1 v3 · UI-8
//
// §4.1 Quick-Pick Dropdown: chat input top area · Ctrl+Shift+A shortcut
// §4.2 Court Preset Management: named role→AI mappings · default "Solo Ollama"
// §4.3 On-the-fly Single-Use: one-shot override · auto-revert after
// §4.4 User-Defined Rules: IF-THEN form · opt-in · default no rules
// §4.5 Multi-Select Parallel Caithedrals: checkbox list · cost warning
// §4.6 Default Discipline (DOCTRINE-CLASS): Ollama ALWAYS default
//      Cloud-AI = explicit opt-in. Cost transparency displayed.
//      NO silent cloud default. This is DOCTRINE not UX preference.
//
// Court mappings (Founder-verbatim — exact strings):
//   Bishop = Anthropic Claude Opus 4.7 (1M context)
//   Rook   = GPT 5.5 (or lower fallback)
//   Knight = Gemini 3.1 Pro OR Sonnet 5.6 (current)
//   Pawn   = Comet Perplexity "Best" available model
//   Red Queen = "Founder ratify pending" (placeholder — DO NOT assume)
//
// decay_class: BETWEEN on substrate emissions. DOCTRINE on §4.6.
import { useState, useEffect, useCallback } from 'react';
// BP087 Wave 3 SEG-E2 -- Multi-Segment Gemma panel
import { MultiSegGemmaPanel } from './MultiSegGemmaPanel';
// ─── Available models ─────────────────────────────────────────────────────────
const MODELS = [
    {
        id: 'ollama-local',
        name: 'Ollama (Local)',
        provider: 'local',
        badge: 'LOCAL',
        cost: '$0.00 / query',
        note: 'Default — DOCTRINE class. No cloud. No data egress.',
    },
    {
        id: 'claude-opus-47',
        name: 'Anthropic Claude Opus 4.7 (1M context)',
        provider: 'cloud',
        badge: 'CLOUD',
        cost: 'Anthropic pricing',
        note: 'Court role: Bishop',
    },
    {
        id: 'gpt-55',
        name: 'GPT 5.5 (or lower fallback)',
        provider: 'cloud',
        badge: 'CLOUD',
        cost: 'OpenAI pricing',
        note: 'Court role: Rook',
    },
    {
        id: 'gemini-31-pro',
        name: 'Gemini 3.1 Pro',
        provider: 'cloud',
        badge: 'CLOUD',
        cost: 'Google pricing',
        note: 'Court role: Knight (option A)',
    },
    {
        id: 'sonnet-56',
        name: 'Sonnet 5.6 (current)',
        provider: 'cloud',
        badge: 'CLOUD',
        cost: 'Anthropic pricing',
        note: 'Court role: Knight (option B)',
    },
    {
        id: 'perplexity-best',
        name: 'Comet Perplexity "Best" available model',
        provider: 'cloud',
        badge: 'CLOUD',
        cost: 'Perplexity pricing',
        note: 'Court role: Pawn',
    },
    {
        id: 'founder-ratify-pending',
        name: 'Founder ratify pending',
        provider: 'cloud',
        badge: 'PENDING',
        cost: 'TBD',
        note: 'Court role: Red Queen — placeholder, DO NOT assume',
    },
];
// ─── Default Court Preset: "Solo Ollama" ─────────────────────────────────────
const SOLO_OLLAMA_PRESET = {
    id: 'solo-ollama',
    name: 'Solo Ollama',
    isDefault: true,
    mappings: {
        Bishop: 'ollama-local',
        Knight: 'ollama-local',
        Rook: 'ollama-local',
        Pawn: 'ollama-local',
        RedQueen: 'ollama-local',
    },
};
const COURT_PRESET = {
    id: 'court',
    name: 'Court (Multi-Cloud)',
    mappings: {
        Bishop: 'claude-opus-47',
        Knight: 'gemini-31-pro',
        Rook: 'gpt-55',
        Pawn: 'perplexity-best',
        RedQueen: 'founder-ratify-pending',
    },
};
const DEFAULT_PRESETS = [SOLO_OLLAMA_PRESET, COURT_PRESET];
const LS_PRESET = 'mnemo_ai_active_preset';
const LS_RULES = 'mnemo_ai_user_rules';
const LS_PARALLEL = 'mnemo_ai_parallel_selected';
// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle, icon }) {
    return (_jsxs("div", { style: { marginBottom: 8 }, children: [_jsxs("div", { style: { fontSize: 10, fontWeight: 700, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 5 }, children: [_jsx("span", { children: icon }), " ", title] }), subtitle && _jsx("div", { style: { fontSize: 8, color: '#334155', marginTop: 2 }, children: subtitle })] }));
}
// ─── Model badge ─────────────────────────────────────────────────────────────
function ModelBadge({ model }) {
    return (_jsx("span", { style: {
            fontSize: 7, padding: '1px 4px', borderRadius: 3, fontWeight: 700,
            background: model.provider === 'local' ? 'rgba(110,231,183,0.12)' : 'rgba(251,191,36,0.1)',
            border: model.provider === 'local' ? '1px solid rgba(110,231,183,0.3)' : '1px solid rgba(251,191,36,0.25)',
            color: model.provider === 'local' ? '#6ee7b7' : '#fbbf24',
        }, children: model.badge }));
}
// ─── §4.6 Doctrine Banner ─────────────────────────────────────────────────────
function DoctrineBanner({ activeIsLocal }) {
    return (_jsxs("div", { style: {
            padding: '8px 10px', borderRadius: 7, marginBottom: 12,
            background: activeIsLocal ? 'rgba(110,231,183,0.06)' : 'rgba(251,191,36,0.08)',
            border: `1px solid ${activeIsLocal ? 'rgba(110,231,183,0.25)' : 'rgba(251,191,36,0.35)'}`,
        }, children: [_jsx("div", { style: { fontSize: 9, fontWeight: 700, color: activeIsLocal ? '#6ee7b7' : '#fbbf24', marginBottom: 3 }, children: activeIsLocal
                    ? '✓ §4.6 DOCTRINE — Ollama Local active. No cloud cost.'
                    : '⚠ §4.6 DOCTRINE — Cloud AI active. Explicit opt-in confirmed.' }), _jsxs("div", { style: { fontSize: 8, color: '#64748b', lineHeight: 1.5 }, children: ["Ollama is always default. Cloud AI requires explicit opt-in.", !activeIsLocal && ' Cloud cost incurred per query — see model pricing above.'] })] }));
}
// ─── Main Component ───────────────────────────────────────────────────────────
export function MultiAISelector() {
    const [activeSection, setActiveSection] = useState('quick');
    // §4.6 — active model (default: Ollama local, DOCTRINE)
    const [activeModel, setActiveModel] = useState(() => {
        const saved = localStorage.getItem(LS_PRESET);
        return saved ?? 'ollama-local';
    });
    // §4.2 Court presets
    const [presets] = useState(DEFAULT_PRESETS);
    const [activePresetId, setActivePresetId] = useState('solo-ollama');
    // §4.3 Single-use override
    const [singleUseModel, setSingleUseModel] = useState(null);
    const [singleUseActive, setSingleUseActive] = useState(false);
    // §4.4 User rules
    const [rules, setRules] = useState(() => {
        try {
            const saved = localStorage.getItem(LS_RULES);
            return saved ? JSON.parse(saved) : [];
        }
        catch {
            return [];
        }
    });
    const [newCondition, setNewCondition] = useState('');
    const [newRuleModel, setNewRuleModel] = useState('ollama-local');
    // §4.5 Parallel selection
    const [parallelSelected, setParallelSelected] = useState(() => {
        try {
            const saved = localStorage.getItem(LS_PARALLEL);
            return saved ? JSON.parse(saved) : [];
        }
        catch {
            return [];
        }
    });
    // Keyboard shortcut Ctrl+Shift+A
    useEffect(() => {
        const handler = (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'A') {
                e.preventDefault();
                setActiveSection((prev) => prev === 'quick' ? 'court' : 'quick');
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);
    // Persist
    useEffect(() => { localStorage.setItem(LS_PRESET, activeModel); }, [activeModel]);
    useEffect(() => { localStorage.setItem(LS_RULES, JSON.stringify(rules)); }, [rules]);
    useEffect(() => { localStorage.setItem(LS_PARALLEL, JSON.stringify(parallelSelected)); }, [parallelSelected]);
    const effectiveModel = singleUseActive && singleUseModel ? singleUseModel : activeModel;
    const effectiveModelObj = MODELS.find((m) => m.id === effectiveModel) ?? MODELS[0];
    const activeIsLocal = effectiveModelObj.provider === 'local';
    const hasCloudInParallel = parallelSelected.some((id) => MODELS.find((m) => m.id === id)?.provider === 'cloud');
    const revertSingleUse = useCallback(() => {
        setSingleUseModel(null);
        setSingleUseActive(false);
    }, []);
    const addRule = useCallback(() => {
        if (!newCondition.trim())
            return;
        setRules((prev) => [
            ...prev,
            { id: `rule-${Date.now()}`, condition: newCondition.trim(), thenModel: newRuleModel, enabled: true },
        ]);
        setNewCondition('');
    }, [newCondition, newRuleModel]);
    const removeRule = useCallback((id) => {
        setRules((prev) => prev.filter((r) => r.id !== id));
    }, []);
    const sectionBtn = (id, label) => ({
        padding: '5px 10px', fontSize: 9, fontWeight: 600, cursor: 'pointer',
        background: activeSection === id ? 'rgba(167,139,250,0.12)' : 'transparent',
        border: activeSection === id ? '1px solid rgba(167,139,250,0.3)' : '1px solid rgba(100,116,139,0.15)',
        borderRadius: 5, color: activeSection === id ? '#a78bfa' : '#475569', transition: 'all 0.1s',
    });
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }, children: [_jsxs("div", { style: { padding: '8px 14px 6px', borderBottom: '1px solid rgba(100,116,139,0.15)', flexShrink: 0 }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 700, color: '#e2e8f0', marginBottom: 1 }, children: "Multi-AI Selector" }), _jsx("div", { style: { fontSize: 8, color: '#334155' }, children: "Ctrl+Shift+A to toggle \u00B7 BP060 Application 002 Step 1 v3 \u00B7 UI-8 \u00B7 \u00A74.6 Ollama Default DOCTRINE" })] }), _jsxs("div", { style: {
                    padding: '6px 14px', borderBottom: '1px solid rgba(100,116,139,0.1)',
                    display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
                }, children: [_jsx("span", { style: { fontSize: 9, color: '#64748b' }, children: "Active:" }), _jsx("span", { style: {
                            fontSize: 9, fontWeight: 700, color: effectiveModelObj.provider === 'local' ? '#6ee7b7' : '#fbbf24',
                            padding: '2px 8px', borderRadius: 10,
                            background: effectiveModelObj.provider === 'local' ? 'rgba(110,231,183,0.1)' : 'rgba(251,191,36,0.1)',
                            border: effectiveModelObj.provider === 'local' ? '1px solid rgba(110,231,183,0.3)' : '1px solid rgba(251,191,36,0.3)',
                        }, children: effectiveModelObj.name }), singleUseActive && (_jsxs("span", { style: { fontSize: 8, color: '#f87171' }, children: ["ONE-SHOT \u00B7", ' ', _jsx("button", { onClick: revertSingleUse, style: { fontSize: 8, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }, children: "revert" })] })), _jsx("span", { style: { marginLeft: 'auto', fontSize: 7, color: '#334155' }, children: effectiveModelObj.cost })] }), _jsxs("div", { style: {
                    padding: '6px 12px', display: 'flex', gap: 5, flexWrap: 'wrap',
                    borderBottom: '1px solid rgba(100,116,139,0.1)', flexShrink: 0,
                }, children: [_jsx("button", { style: sectionBtn('quick', 'Quick-Pick'), onClick: () => setActiveSection('quick'), children: "\u00A74.1 Quick-Pick" }), _jsx("button", { style: sectionBtn('court', 'Court'), onClick: () => setActiveSection('court'), children: "\u00A74.2 Court" }), _jsx("button", { style: sectionBtn('single-use', 'Single-Use'), onClick: () => setActiveSection('single-use'), children: "\u00A74.3 Single-Use" }), _jsx("button", { style: sectionBtn('rules', 'Rules'), onClick: () => setActiveSection('rules'), children: "\u00A74.4 Rules" }), _jsx("button", { style: sectionBtn('parallel', 'Parallel'), onClick: () => setActiveSection('parallel'), children: "\u00A74.5 Parallel" }), _jsx("button", { style: sectionBtn('multi-seg-gemma', 'Multi-Seg Gemma'), onClick: () => setActiveSection('multi-seg-gemma'), children: "Multi-Seg Gemma" })] }), _jsxs("div", { style: { flex: 1, overflow: 'auto', padding: '10px 14px' }, children: [_jsx(DoctrineBanner, { activeIsLocal: activeIsLocal }), activeSection === 'quick' && (_jsxs("div", { children: [_jsx(SectionHeader, { icon: "\u26A1", title: "\u00A74.1 Quick-Pick", subtitle: "Select active AI model \u00B7 Ctrl+Shift+A to focus" }), MODELS.map((m) => (_jsxs("button", { onClick: () => { setActiveModel(m.id); setSingleUseActive(false); }, style: {
                                    display: 'flex', alignItems: 'flex-start', gap: 8, textAlign: 'left',
                                    width: '100%', marginBottom: 5,
                                    padding: '7px 10px', borderRadius: 6, cursor: 'pointer',
                                    background: activeModel === m.id ? 'rgba(167,139,250,0.1)' : 'rgba(100,116,139,0.04)',
                                    border: activeModel === m.id ? '1px solid rgba(167,139,250,0.35)' : '1px solid rgba(100,116,139,0.12)',
                                    transition: 'all 0.1s',
                                }, children: [_jsx("div", { style: { paddingTop: 1 }, children: _jsx(ModelBadge, { model: m }) }), _jsxs("div", { style: { flex: 1 }, children: [_jsxs("div", { style: {
                                                    fontSize: 10, fontWeight: activeModel === m.id ? 700 : 500,
                                                    color: activeModel === m.id ? '#e2e8f0' : '#94a3b8',
                                                    display: 'flex', alignItems: 'center', gap: 5,
                                                }, children: [m.name, activeModel === m.id && _jsx("span", { style: { fontSize: 8, color: '#a78bfa' }, children: "\u2713 active" })] }), _jsx("div", { style: { fontSize: 8, color: '#475569', marginTop: 2 }, children: m.note }), _jsx("div", { style: { fontSize: 7, color: '#334155', marginTop: 1 }, children: m.cost })] })] }, m.id)))] })), activeSection === 'court' && (_jsxs("div", { children: [_jsx(SectionHeader, { icon: "\u265F", title: "\u00A74.2 Court Presets", subtitle: "Named role\u2192AI mappings \u00B7 Default: Solo Ollama" }), presets.map((preset) => (_jsxs("div", { style: {
                                    marginBottom: 10, padding: '8px 10px', borderRadius: 6,
                                    background: activePresetId === preset.id ? 'rgba(110,231,183,0.06)' : 'rgba(100,116,139,0.04)',
                                    border: activePresetId === preset.id ? '1px solid rgba(110,231,183,0.25)' : '1px solid rgba(100,116,139,0.12)',
                                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }, children: [_jsx("span", { style: { fontSize: 10, fontWeight: 700, color: activePresetId === preset.id ? '#6ee7b7' : '#94a3b8' }, children: preset.name }), preset.isDefault && (_jsx("span", { style: {
                                                    fontSize: 7, padding: '1px 4px', borderRadius: 3, fontWeight: 700,
                                                    background: 'rgba(110,231,183,0.12)', border: '1px solid rgba(110,231,183,0.3)', color: '#6ee7b7',
                                                }, children: "DEFAULT" })), _jsx("button", { onClick: () => {
                                                    setActivePresetId(preset.id);
                                                    // Apply Bishop mapping as active model
                                                    setActiveModel(preset.mappings.Bishop ?? 'ollama-local');
                                                }, style: {
                                                    marginLeft: 'auto', fontSize: 8, padding: '2px 8px',
                                                    background: 'rgba(100,116,139,0.08)', border: '1px solid rgba(100,116,139,0.2)',
                                                    borderRadius: 4, color: '#94a3b8', cursor: 'pointer',
                                                }, children: activePresetId === preset.id ? '✓ Active' : 'Apply' })] }), Object.entries(preset.mappings).map(([role, modelId]) => {
                                        const m = MODELS.find((x) => x.id === modelId);
                                        return (_jsxs("div", { style: { display: 'flex', gap: 8, fontSize: 9, marginBottom: 3, alignItems: 'center' }, children: [_jsxs("span", { style: { color: '#475569', width: 70, flexShrink: 0 }, children: [role, ":"] }), _jsx("span", { style: { color: '#e2e8f0' }, children: m?.name ?? modelId }), m && _jsx(ModelBadge, { model: m })] }, role));
                                    })] }, preset.id))), _jsx("div", { style: { fontSize: 8, color: '#334155', marginTop: 4 }, children: "Court mappings per Founder-verbatim canon. Red Queen = placeholder, Founder ratify pending." })] })), activeSection === 'single-use' && (_jsxs("div", { children: [_jsx(SectionHeader, { icon: "\uD83C\uDFAF", title: "\u00A74.3 Single-Use Override", subtitle: "One-shot model \u00B7 auto-reverts after use" }), _jsxs("div", { style: { marginBottom: 10 }, children: [_jsx("label", { style: { fontSize: 9, color: '#94a3b8', display: 'block', marginBottom: 4 }, children: "Select model for one-shot override:" }), _jsxs("select", { value: singleUseModel ?? '', onChange: (e) => setSingleUseModel(e.target.value), style: {
                                            width: '100%', padding: '6px 8px', fontSize: 9,
                                            background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(100,116,139,0.3)',
                                            borderRadius: 5, color: '#e2e8f0',
                                        }, children: [_jsx("option", { value: "", children: "\u2014 select model \u2014" }), MODELS.map((m) => (_jsxs("option", { value: m.id, children: [m.name, " [", m.badge, "]"] }, m.id)))] })] }), singleUseModel && (_jsx("div", { style: { marginBottom: 10, padding: '6px 8px', borderRadius: 5, background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.2)' }, children: _jsx("div", { style: { fontSize: 8, color: '#fbbf24' }, children: MODELS.find((m) => m.id === singleUseModel)?.provider === 'cloud'
                                        ? `⚠ Cloud AI — ${MODELS.find((m) => m.id === singleUseModel)?.cost}`
                                        : `✓ Local — ${MODELS.find((m) => m.id === singleUseModel)?.cost}` }) })), _jsxs("div", { style: { display: 'flex', gap: 6 }, children: [_jsx("button", { onClick: () => { if (singleUseModel)
                                            setSingleUseActive(true); }, disabled: !singleUseModel, style: {
                                            flex: 1, padding: '7px', fontSize: 10, fontWeight: 700,
                                            background: singleUseModel ? 'rgba(167,139,250,0.12)' : 'rgba(100,116,139,0.06)',
                                            border: `1px solid ${singleUseModel ? 'rgba(167,139,250,0.35)' : 'rgba(100,116,139,0.15)'}`,
                                            borderRadius: 5, color: singleUseModel ? '#a78bfa' : '#334155', cursor: singleUseModel ? 'pointer' : 'not-allowed',
                                        }, children: "Activate One-Shot" }), singleUseActive && (_jsx("button", { onClick: revertSingleUse, style: {
                                            padding: '7px 12px', fontSize: 9, background: 'rgba(239,68,68,0.08)',
                                            border: '1px solid rgba(239,68,68,0.25)', borderRadius: 5, color: '#f87171', cursor: 'pointer',
                                        }, children: "Revert" }))] }), singleUseActive && (_jsx("div", { style: { marginTop: 8, fontSize: 9, color: '#fbbf24' }, children: "ONE-SHOT ACTIVE \u2014 will auto-revert when you click Revert or change preset" }))] })), activeSection === 'rules' && (_jsxs("div", { children: [_jsx(SectionHeader, { icon: "\uD83D\uDCCB", title: "\u00A74.4 User-Defined Rules", subtitle: "IF-THEN routing \u00B7 opt-in \u00B7 default: no rules" }), _jsxs("div", { style: { marginBottom: 10 }, children: [_jsx("div", { style: { fontSize: 9, fontWeight: 600, color: '#64748b', marginBottom: 6 }, children: "Add rule" }), _jsx("input", { value: newCondition, onChange: (e) => setNewCondition(e.target.value), placeholder: 'IF condition (e.g. "query contains code")', style: {
                                            width: '100%', padding: '5px 8px', marginBottom: 5, fontSize: 9, boxSizing: 'border-box',
                                            background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(100,116,139,0.25)',
                                            borderRadius: 4, color: '#e2e8f0',
                                        } }), _jsxs("div", { style: { display: 'flex', gap: 6 }, children: [_jsx("select", { value: newRuleModel, onChange: (e) => setNewRuleModel(e.target.value), style: {
                                                    flex: 1, padding: '5px 6px', fontSize: 9,
                                                    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(100,116,139,0.25)',
                                                    borderRadius: 4, color: '#e2e8f0',
                                                }, children: MODELS.map((m) => (_jsxs("option", { value: m.id, children: ["THEN use: ", m.name] }, m.id))) }), _jsx("button", { onClick: addRule, style: {
                                                    padding: '5px 12px', fontSize: 9, fontWeight: 700,
                                                    background: 'rgba(110,231,183,0.1)', border: '1px solid rgba(110,231,183,0.25)',
                                                    borderRadius: 4, color: '#6ee7b7', cursor: 'pointer',
                                                }, children: "+ Add" })] })] }), rules.length === 0 ? (_jsx("div", { style: { fontSize: 9, color: '#334155', textAlign: 'center', padding: 16 }, children: "No rules defined (default \u2014 opt-in only)" })) : (rules.map((rule) => (_jsxs("div", { style: {
                                    padding: '6px 8px', marginBottom: 5, borderRadius: 5,
                                    background: rule.enabled ? 'rgba(110,231,183,0.04)' : 'rgba(100,116,139,0.04)',
                                    border: `1px solid ${rule.enabled ? 'rgba(110,231,183,0.15)' : 'rgba(100,116,139,0.1)'}`,
                                    display: 'flex', alignItems: 'flex-start', gap: 8,
                                }, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsxs("div", { style: { fontSize: 8, color: '#64748b' }, children: ["IF: ", _jsx("span", { style: { color: '#94a3b8' }, children: rule.condition })] }), _jsxs("div", { style: { fontSize: 8, color: '#64748b' }, children: ["THEN: ", _jsx("span", { style: { color: '#e2e8f0' }, children: MODELS.find((m) => m.id === rule.thenModel)?.name })] })] }), _jsx("button", { onClick: () => setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, enabled: !r.enabled } : r)), style: { fontSize: 8, padding: '2px 6px', background: 'none', border: '1px solid rgba(100,116,139,0.2)', borderRadius: 3, color: rule.enabled ? '#6ee7b7' : '#475569', cursor: 'pointer' }, children: rule.enabled ? 'ON' : 'OFF' }), _jsx("button", { onClick: () => removeRule(rule.id), style: { fontSize: 8, padding: '2px 6px', background: 'none', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 3, color: '#f87171', cursor: 'pointer' }, children: "\u2715" })] }, rule.id))))] })), activeSection === 'multi-seg-gemma' && (_jsx("div", { children: _jsx(MultiSegGemmaPanel, {}) })), activeSection === 'parallel' && (_jsxs("div", { children: [_jsx(SectionHeader, { icon: "\u26A1\u26A1", title: "\u00A74.5 Multi-Select Parallel Caithedrals", subtitle: "Side-by-side results \u00B7 cost warning for cloud" }), hasCloudInParallel && (_jsxs("div", { style: {
                                    padding: '7px 10px', marginBottom: 10, borderRadius: 6,
                                    background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)',
                                }, children: [_jsx("div", { style: { fontSize: 9, fontWeight: 700, color: '#fbbf24' }, children: "\u26A0 Cloud AI in parallel selection \u2014 cost per query per model" }), _jsx("div", { style: { fontSize: 8, color: '#64748b', marginTop: 2 }, children: "Each selected cloud model incurs its own API cost per query." })] })), MODELS.filter((m) => m.id !== 'founder-ratify-pending').map((m) => {
                                const selected = parallelSelected.includes(m.id);
                                return (_jsxs("div", { style: {
                                        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5,
                                        padding: '6px 8px', borderRadius: 5,
                                        background: selected ? `${m.provider === 'local' ? 'rgba(110,231,183,0.06)' : 'rgba(251,191,36,0.06)'}` : 'rgba(100,116,139,0.03)',
                                        border: `1px solid ${selected ? (m.provider === 'local' ? 'rgba(110,231,183,0.2)' : 'rgba(251,191,36,0.2)') : 'rgba(100,116,139,0.1)'}`,
                                        cursor: 'pointer',
                                    }, onClick: () => setParallelSelected((prev) => selected ? prev.filter((id) => id !== m.id) : [...prev, m.id]), children: [_jsx("div", { style: {
                                                width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                                                background: selected ? (m.provider === 'local' ? '#6ee7b7' : '#fbbf24') : 'transparent',
                                                border: `1px solid ${selected ? (m.provider === 'local' ? '#6ee7b7' : '#fbbf24') : 'rgba(100,116,139,0.3)'}`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#0a0f1a',
                                            }, children: selected ? '✓' : '' }), _jsx(ModelBadge, { model: m }), _jsx("span", { style: { fontSize: 9, color: selected ? '#e2e8f0' : '#64748b' }, children: m.name }), _jsx("span", { style: { fontSize: 7, color: '#334155', marginLeft: 'auto' }, children: m.cost })] }, m.id));
                            }), parallelSelected.length > 0 && (_jsxs("div", { style: { marginTop: 8, fontSize: 9, color: '#94a3b8' }, children: [parallelSelected.length, " model", parallelSelected.length !== 1 ? 's' : '', " selected for parallel dispatch", hasCloudInParallel && _jsx("span", { style: { color: '#fbbf24' }, children: " \u00B7 cloud cost applies" })] }))] }))] })] }));
}
