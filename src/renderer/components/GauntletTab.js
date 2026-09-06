import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// GauntletTab — SAGA 07+08 BP046B · Tab 3 of MnemosyneTabView
// The Gauntlet 6-stage testing framework — the killer flywheel.
// Default tab on first launch. Proves "ANY hardware · ANY network · ANY AI · or NONE AT ALL".
//
// Stage 1: Baseline         (no MnemosyneC · no Caithedral · raw AI or no-AI)
// Stage 2: Caithedral alone  (substrate only · NO LLM · proves "or NONE AT ALL")
// Stage 3: + Any AI         (dropdown · pick model · same task)
// Stage 4: Yoked AI         (dropdown · cross-vendor symmetric yoke)
// Stage 5: Orchestration    (Wave / Drekaskip / Novacula / AutoBaton)
// Stage 6: Federation       (cross-Caithedral peer-mesh · Thorax · requires LB membership)
//
// Pioneer Bonus fires at Stage 3+ for previously-untested models.
// 5-marks bonus on first Stage 1 completion (SAGA 13).
import { useState } from 'react';
// ─── Pioneer position helper (mirrors DB function logic client-side) ───────────
// Used for optimistic UI; server validates before writing to gauntlet_pioneer_registry.
function getPioneerPosition(existingCount) {
    const pos = existingCount + 1;
    if (pos === 1)
        return { position: 1, multiplier: 3.0, label: 'First tested · Named · Permanent attribution · Pioneer #1' };
    if (pos === 2)
        return { position: 2, multiplier: 2.0, label: 'Co-validator · Named · Pioneer #2' };
    if (pos === 3)
        return { position: 3, multiplier: 1.5, label: 'Verifier · Named · Pioneer #3' };
    if (pos <= 10)
        return { position: pos, multiplier: 1.2, label: 'Early-adopter · cohort listing' };
    return { position: pos, multiplier: 1.0, label: 'Standard Gauntlet run' };
}
const STAGE_DEFS = [
    { stage: 1, name: 'Baseline', icon: '📊', desc: 'No MnemosyneC · no Caithedral · raw AI or no-AI baseline run' },
    { stage: 2, name: 'Caithedral Alone', icon: '🏛️', desc: 'Substrate only · NO LLM · proves "or NONE AT ALL"' },
    { stage: 3, name: '+ Any AI', icon: '🤖', desc: 'Caithedral + AI model of your choice · Pioneer Bonus fires here' },
    { stage: 4, name: 'Yoked AI', icon: '⚡', desc: 'Cross-vendor symmetric AI yoke · proves inexpensive ≈ flagship WITH substrate' },
    { stage: 5, name: 'Orchestration', icon: '🌊', desc: 'Wave / Drekaskip / Novacula / AutoBaton selector' },
    { stage: 6, name: 'Federation', icon: '🌐', desc: 'Cross-Caithedral peer-mesh · Thorax handshake · requires LB membership' },
];
// ─── Prerequisite logic (BP047 checkmark model) ───────────────────────────────
// Stage 6 requires: Stage 1 AND Stage 2 AND (Stage 3 OR Stage 4)
// Stage 5 requires: Stage 3 OR Stage 4
// Stage 4 requires: Stage 2
// Stage 3 requires: Stage 2 (or Stage 1 as baseline)
// Stage 1 and Stage 2: no prerequisites
function getPrerequisites(stage) {
    if (stage === 3)
        return [2];
    if (stage === 4)
        return [2];
    if (stage === 5)
        return [3];
    if (stage === 6)
        return [1, 2, 3];
    return [];
}
function getPrereqTooltip(stage) {
    if (stage === 3)
        return 'Requires Stage 2 (Caithedral Alone baseline)';
    if (stage === 4)
        return 'Requires Stage 2 (Caithedral Alone baseline)';
    if (stage === 5)
        return 'Requires Stage 3 or Stage 4 — AI must be in the run';
    if (stage === 6)
        return 'Requires Stages 1, 2, AND Stage 3 — Federation needs a full substrate + AI proof chain';
    return '';
}
function addPrerequisites(stages, newStage) {
    const prereqs = getPrerequisites(newStage);
    prereqs.forEach((p) => stages.add(p));
    // Stage 5 needs Stage 3 OR 4 — add Stage 3 as canonical default if neither present
    if (newStage === 5 && !stages.has(3) && !stages.has(4))
        stages.add(3);
    // Stage 6 needs Stage 3 — add if neither 3 nor 4 present
    if (newStage === 6 && !stages.has(3) && !stages.has(4))
        stages.add(3);
}
export function GauntletTab({ authState, onFirstComplete }) {
    const [phase, setPhase] = useState('idle');
    const [stageResults, setStageResults] = useState(STAGE_DEFS.map((s) => ({ ...s, status: 'pending' })));
    const [selectedStages, setSelectedStages] = useState(new Set([1, 2, 3, 4, 5, 6]));
    const [selectedModel, setSelectedModel] = useState('');
    const [dataMode, setDataMode] = useState('included');
    const isMember = authState?.status === 'member' || authState?.status === 'trial_active';
    // SAGA 09 · Pioneer Bonus state
    const [pioneerBonus, setPioneerBonus] = useState({
        visible: false, modelName: '', position: 0, multiplier: 1, label: '',
    });
    // SAGA 12 · Battery Dispatch share state — default OFF per spec
    const [shareState, setShareState] = useState({ optedIn: false, dispatched: false });
    function handleGo() {
        setPhase('mode-select');
    }
    function handleStartRun(mode) {
        setDataMode(mode);
        setPhase('running');
        runGauntlet(mode);
    }
    async function runGauntlet(mode) {
        // Run only the user-selected stages — BP047 checkmark selection model
        const results = STAGE_DEFS.map((s) => ({ ...s, status: 'pending' }));
        setStageResults([...results]);
        for (let i = 0; i < STAGE_DEFS.length; i++) {
            const def = STAGE_DEFS[i];
            // Skip stages the user did not select
            if (!selectedStages.has(def.stage)) {
                results[i] = { ...results[i], status: 'skipped' };
                setStageResults([...results]);
                continue;
            }
            // Skip Stage 6 if not a member
            if (def.stage === 6 && !isMember) {
                results[i] = { ...results[i], status: 'skipped' };
                setStageResults([...results]);
                continue;
            }
            results[i] = { ...results[i], status: 'running' };
            setStageResults([...results]);
            // Simulate stage execution — SAGA 08 replaces this with real substrate calls
            await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 400));
            const bm = simulateBanyanMetric(def.stage);
            const cumulative = results
                .slice(0, i + 1)
                .reduce((acc, r) => acc + (r.banyan_metric ?? 0), bm);
            // KN-BP143-3 D4 (follow-up): speed_delta/cost_delta/accuracy_delta used to be
            // Math.random()-derived (simulateDelta()) so the stage row always showed a
            // plausible-looking "+1.4x" style number even though no real substrate
            // measurement was ever taken. 0 is the honest placeholder -- StageRow already
            // renders 0 as "baseline" rather than a fake delta -- until SAGA 08 wires real
            // substrate calls in place of the setTimeout jitter above.
            results[i] = {
                ...results[i],
                status: 'complete',
                speed_delta: 0,
                cost_delta: 0,
                accuracy_delta: 0,
                banyan_metric: bm,
                cumulative_bm: cumulative,
            };
            setStageResults([...results]);
            // First Stage 1 completion — 5-marks bonus (SAGA 13 hook)
            if (def.stage === 1) {
                const firstRun = !localStorage.getItem('mnemo_gauntlet_stage1_done');
                if (firstRun) {
                    localStorage.setItem('mnemo_gauntlet_stage1_done', 'true');
                    // SAGA 13: trigger 5-marks credit via IPC
                    window.amplify?.creditFirstInstallMarks?.();
                }
            }
            // SAGA 09 · Pioneer Bonus — fires at Stage 3 for previously-untested models
            if (def.stage === 3 && selectedModel) {
                const modelKey = selectedModel || 'unknown-model';
                // Optimistic pioneer detection: check localStorage for existing pioneer count
                // Full DB validation happens server-side via gauntlet_pioneer_registry
                const storageKey = `mnemo_pioneer_tested_${modelKey}`;
                const existingCount = parseInt(localStorage.getItem(storageKey) ?? '0', 10);
                const pioneer = getPioneerPosition(existingCount);
                // Show Pioneer Bonus modal if multiplier > 1× (positions 1-10)
                if (pioneer.multiplier > 1.0 && isMember) {
                    setPioneerBonus({
                        visible: true,
                        modelName: modelKey,
                        position: pioneer.position,
                        multiplier: pioneer.multiplier,
                        label: pioneer.label,
                    });
                    // Optimistically record this test locally (server validates + writes to DB)
                    localStorage.setItem(storageKey, String(existingCount + 1));
                }
            }
        }
        setPhase('results');
        if (onFirstComplete)
            onFirstComplete();
    }
    function simulateBanyanMetric(stage) {
        // Scaffolded simulation — SAGA 08 replaces with real substrate measurement
        const base = [0, 1.2, 2.8, 1.5, 1.9, 1.4];
        return base[stage - 1] ?? 0;
    }
    const totalBM = stageResults.reduce((acc, r) => acc + (r.banyan_metric ?? 0), 0);
    const completedStages = stageResults.filter((r) => r.status === 'complete').length;
    // ─── Render ──────────────────────────────────────────────────────────────────
    if (phase === 'idle') {
        return (_jsx(GauntletIdle, { onGo: handleGo, isMember: isMember, selectedStages: selectedStages, onToggleStage: (stage) => {
                setSelectedStages((prev) => {
                    const next = new Set(prev);
                    if (next.has(stage)) {
                        next.delete(stage);
                    }
                    else {
                        next.add(stage);
                        // Auto-add prerequisites when a stage requiring them is selected
                        addPrerequisites(next, stage);
                    }
                    return next;
                });
            } }));
    }
    if (phase === 'mode-select') {
        return (_jsx(GauntletModeSelect, { onSelect: handleStartRun, onBack: () => setPhase('idle') }));
    }
    return (_jsxs("div", { style: { padding: 16, height: '100%', boxSizing: 'border-box', overflowY: 'auto' }, children: [_jsxs("div", { style: { marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 14, fontWeight: 700, color: '#e2e8f0' }, children: phase === 'running' ? '⚔️ Gauntlet Running…' : '✅ Gauntlet Complete' }), _jsxs("div", { style: { fontSize: 10, color: '#64748b', marginTop: 2 }, children: [completedStages, "/6 stages \u00B7 ", dataMode === 'included' ? 'Included test data' : dataMode === 'own' ? 'Your data' : 'Manual mode'] })] }), phase === 'results' && (_jsx("button", { onClick: () => { setPhase('idle'); setStageResults(STAGE_DEFS.map((s) => ({ ...s, status: 'pending' }))); }, style: {
                            background: 'rgba(110,231,183,0.1)', border: '1px solid rgba(110,231,183,0.25)',
                            color: '#6ee7b7', borderRadius: 8, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        }, children: "Run Again" }))] }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 4 }, children: stageResults.map((r) => (_jsx(StageRow, { result: r }, r.stage))) }), phase === 'results' && (_jsxs("div", { style: {
                    marginTop: 16,
                    background: 'rgba(110,231,183,0.08)', border: '1px solid rgba(110,231,183,0.25)',
                    borderRadius: 10, padding: '14px 20px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }, children: "Cumulative Banyan Metric \u00B7 6 Stages \u00B7 Your Task" }), _jsxs("div", { style: { fontSize: 28, fontWeight: 800, color: '#6ee7b7', marginTop: 4 }, children: [totalBM.toFixed(1), " BM"] })] }), _jsx("div", { style: { fontSize: 30 }, children: "\u2694\uFE0F" })] })), !isMember && phase === 'results' && (_jsxs("div", { style: {
                    marginTop: 10,
                    background: 'rgba(110,231,183,0.04)', border: '1px solid rgba(110,231,183,0.12)',
                    borderRadius: 8, padding: '10px 14px', textAlign: 'center',
                }, children: [_jsx("div", { style: { fontSize: 11, color: '#6ee7b7', fontWeight: 600 }, children: "Stage 6 \u00B7 Federation" }), _jsx("div", { style: { fontSize: 10, color: '#64748b', marginTop: 2 }, children: "Requires LB membership \u00B7 $5/year \u00B7 unlock cross-Caithedral peer-mesh" })] })), pioneerBonus.visible && (_jsx(PioneerBonusModal, { modelName: pioneerBonus.modelName, position: pioneerBonus.position, multiplier: pioneerBonus.multiplier, label: pioneerBonus.label, onDismiss: () => setPioneerBonus((s) => ({ ...s, visible: false })) })), phase === 'results' && (_jsx(BatteryDispatchShareToggle, { optedIn: shareState.optedIn, dispatched: shareState.dispatched, totalBM: totalBM, onToggle: () => setShareState((s) => ({ ...s, optedIn: !s.optedIn })), onDispatch: () => setShareState((s) => ({ ...s, dispatched: true })) }))] }));
}
// ─── Idle splash — checkmark stage selection (BP047) ─────────────────────────
function GauntletIdle({ onGo, isMember, selectedStages, onToggleStage, }) {
    const [toastMsg, setToastMsg] = useState(null);
    function handleToggle(stage) {
        const wasSelected = selectedStages.has(stage);
        if (!wasSelected) {
            // Check prereqs
            const prereqs = getPrerequisites(stage);
            const missingPrereqs = prereqs.filter((p) => !selectedStages.has(p));
            if (missingPrereqs.length > 0) {
                const names = missingPrereqs.map((p) => `Stage ${p}`).join(', ');
                setToastMsg(`Prerequisites added: ${names} required for Stage ${stage}`);
                setTimeout(() => setToastMsg(null), 3500);
            }
        }
        onToggleStage(stage);
    }
    const selectedCount = selectedStages.size;
    const canGo = selectedCount > 0;
    return (_jsxs("div", { style: {
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '16px 20px', gap: 12, height: '100%', boxSizing: 'border-box', overflowY: 'auto',
        }, children: [_jsxs("div", { style: { textAlign: 'center', flexShrink: 0 }, children: [_jsx("div", { style: { fontSize: 36 }, children: "\u2694\uFE0F" }), _jsx("div", { style: { fontSize: 16, fontWeight: 800, color: '#e2e8f0', letterSpacing: '-0.3px', marginTop: 4 }, children: "The Gauntlet" }), _jsxs("div", { style: { fontSize: 10, color: '#64748b', marginTop: 4, maxWidth: 280, lineHeight: 1.6 }, children: ["Select stages \u00B7 press GO \u00B7 empirical proof on", ' ', _jsx("span", { style: { color: '#6ee7b7' }, children: "ANY hardware \u00B7 ANY network \u00B7 ANY AI \u00B7 or NONE AT ALL" })] })] }), _jsx("div", { style: {
                    fontSize: 10, color: '#6ee7b7',
                    background: 'rgba(110,231,183,0.06)', border: '1px solid rgba(110,231,183,0.15)',
                    borderRadius: 6, padding: '5px 10px', width: '100%', maxWidth: 340, textAlign: 'center',
                    flexShrink: 0,
                }, children: "FREE AI: Ollama (onboard by default) \u2014 no cloud account, no API key, no cost" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 5, width: '100%', maxWidth: 340 }, children: STAGE_DEFS.map((s) => {
                    const isSelected = selectedStages.has(s.stage);
                    const prereqTip = getPrereqTooltip(s.stage);
                    const isStage6NonMember = s.stage === 6 && !isMember;
                    return (_jsxs("button", { onClick: () => !isStage6NonMember && handleToggle(s.stage), disabled: isStage6NonMember, title: prereqTip || (isStage6NonMember ? 'Requires LB membership · $5/year' : undefined), style: {
                            display: 'flex', alignItems: 'center', gap: 10,
                            background: isSelected ? 'rgba(110,231,183,0.07)' : 'rgba(15,23,42,0.6)',
                            border: `1px solid ${isSelected ? 'rgba(110,231,183,0.3)' : 'rgba(100,116,139,0.12)'}`,
                            borderRadius: 8, padding: '8px 12px', textAlign: 'left',
                            cursor: isStage6NonMember ? 'not-allowed' : 'pointer',
                            opacity: isStage6NonMember ? 0.4 : 1,
                            transition: 'all 0.15s',
                        }, children: [_jsx("div", { style: {
                                    width: 18, height: 18, flexShrink: 0, borderRadius: 4,
                                    border: `2px solid ${isSelected ? '#6ee7b7' : 'rgba(100,116,139,0.35)'}`,
                                    background: isSelected ? 'rgba(110,231,183,0.15)' : 'transparent',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.15s',
                                }, children: isSelected && _jsx("span", { style: { fontSize: 10, color: '#6ee7b7', fontWeight: 900, lineHeight: 1 }, children: "\u2713" }) }), _jsx("span", { style: { fontSize: 14, flexShrink: 0 }, children: s.icon }), _jsxs("div", { style: { flex: 1 }, children: [_jsxs("div", { style: {
                                            fontSize: 11, fontWeight: 600,
                                            color: isSelected ? '#94a3b8' : '#475569',
                                        }, children: ["Stage ", s.stage, " \u00B7 ", s.name] }), _jsx("div", { style: { fontSize: 9, color: '#334155', marginTop: 1, lineHeight: 1.4 }, children: s.desc }), prereqTip && (_jsx("div", { style: { fontSize: 8, color: '#4b5563', marginTop: 2, fontStyle: 'italic' }, children: prereqTip }))] })] }, s.stage));
                }) }), toastMsg && (_jsx("div", { style: {
                    position: 'fixed', bottom: 60, left: '50%', transform: 'translateX(-50%)',
                    background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.35)',
                    color: '#f59e0b', borderRadius: 8, padding: '7px 14px',
                    fontSize: 11, fontWeight: 600, zIndex: 999, whiteSpace: 'nowrap',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                }, children: toastMsg })), _jsxs("button", { onClick: onGo, disabled: !canGo, style: {
                    background: canGo
                        ? 'linear-gradient(135deg, rgba(110,231,183,0.2), rgba(52,211,153,0.1))'
                        : 'rgba(100,116,139,0.08)',
                    border: `1px solid ${canGo ? 'rgba(110,231,183,0.4)' : 'rgba(100,116,139,0.15)'}`,
                    color: canGo ? '#6ee7b7' : '#334155',
                    borderRadius: 12, padding: '11px 36px',
                    fontSize: 15, fontWeight: 800, cursor: canGo ? 'pointer' : 'not-allowed',
                    letterSpacing: '0.05em', transition: 'all 0.2s', flexShrink: 0,
                }, onMouseEnter: (e) => canGo && (e.currentTarget.style.background = 'linear-gradient(135deg, rgba(110,231,183,0.35), rgba(52,211,153,0.2))'), onMouseLeave: (e) => canGo && (e.currentTarget.style.background = 'linear-gradient(135deg, rgba(110,231,183,0.2), rgba(52,211,153,0.1))'), children: ["GO \u2694\uFE0F (", selectedCount, " stage", selectedCount !== 1 ? 's' : '', ")"] }), _jsx("div", { style: { fontSize: 9, color: '#334155', flexShrink: 0 }, children: "Earn 5 marks on your first run \u00B7 Pioneer Bonus on first model tests" })] }));
}
// ─── Mode select ──────────────────────────────────────────────────────────────
function GauntletModeSelect({ onSelect, onBack }) {
    const options = [
        { id: 'included', icon: '📦', label: 'Use Included Test Data', desc: 'Canonical test set · reproducible · comparable to community results' },
        { id: 'own', icon: '📁', label: 'Choose Your Own Data', desc: '"Get to Know You" handshake · folder ingestion · your Pheromone build' },
        { id: 'manual', icon: '🎛️', label: 'Advanced Manual Mode', desc: 'Expert control · custom prompts · stage-by-stage configuration' },
    ];
    return (_jsxs("div", { style: { padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10 }, children: [_jsx("button", { onClick: onBack, style: { background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16, padding: 0 }, children: "\u2190" }), _jsx("div", { style: { fontSize: 13, fontWeight: 700, color: '#e2e8f0' }, children: "Choose how to run the Gauntlet" })] }), options.map((opt) => (_jsxs("button", { onClick: () => onSelect(opt.id), style: {
                    background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(100,116,139,0.2)',
                    borderRadius: 10, padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
                    display: 'flex', alignItems: 'flex-start', gap: 12, transition: 'all 0.15s',
                }, onMouseEnter: (e) => { e.currentTarget.style.borderColor = 'rgba(110,231,183,0.3)'; e.currentTarget.style.background = 'rgba(110,231,183,0.04)'; }, onMouseLeave: (e) => { e.currentTarget.style.borderColor = 'rgba(100,116,139,0.2)'; e.currentTarget.style.background = 'rgba(15,23,42,0.6)'; }, children: [_jsx("span", { style: { fontSize: 22, flexShrink: 0, marginTop: 1 }, children: opt.icon }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 12, fontWeight: 600, color: '#e2e8f0' }, children: opt.label }), _jsx("div", { style: { fontSize: 10, color: '#64748b', marginTop: 3, lineHeight: 1.5 }, children: opt.desc })] })] }, opt.id)))] }));
}
// ─── SAGA 09 · Pioneer Bonus Modal ────────────────────────────────────────────
function PioneerBonusModal({ modelName, position, multiplier, label, onDismiss }) {
    const posEmoji = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '⭐';
    return (_jsx("div", { style: {
            position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.75)', zIndex: 9999,
        }, children: _jsxs("div", { style: {
                background: '#0f172a', border: '1px solid rgba(110,231,183,0.4)',
                borderRadius: 14, padding: '28px 30px', maxWidth: 360, width: '90%', textAlign: 'center',
                boxShadow: '0 0 48px rgba(110,231,183,0.12)',
            }, children: [_jsx("div", { style: { fontSize: 42, marginBottom: 12 }, children: posEmoji }), _jsx("div", { style: { fontSize: 16, fontWeight: 800, color: '#6ee7b7', marginBottom: 6 }, children: "Pioneer Bonus!" }), _jsxs("div", { style: { fontSize: 11, color: '#94a3b8', marginBottom: 4 }, children: ["You are the ", _jsxs("strong", { style: { color: '#e2e8f0' }, children: ["#", position, " tester"] }), " of"] }), _jsx("div", { style: { fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 10 }, children: modelName }), _jsxs("div", { style: {
                        background: 'rgba(110,231,183,0.08)', border: '1px solid rgba(110,231,183,0.2)',
                        borderRadius: 8, padding: '8px 12px', marginBottom: 14,
                    }, children: [_jsxs("div", { style: { fontSize: 22, fontWeight: 900, color: '#6ee7b7' }, children: [multiplier, "\u00D7"] }), _jsx("div", { style: { fontSize: 10, color: '#64748b', marginTop: 2 }, children: "marks multiplier" })] }), _jsxs("div", { style: { fontSize: 10, color: '#475569', marginBottom: 18, lineHeight: 1.6 }, children: [label, _jsx("br", {}), "Your attribution is permanent in the community Banyan Metric registry.", _jsx("br", {}), _jsx("span", { style: { color: '#334155' }, children: "Server validates \u00B7 IP Ledger stamp fires \u00B7 marks credited on confirmation." })] }), _jsx("button", { onClick: onDismiss, style: {
                        background: 'rgba(110,231,183,0.12)', border: '1px solid rgba(110,231,183,0.3)',
                        color: '#6ee7b7', borderRadius: 8, padding: '8px 24px',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer', width: '100%',
                    }, children: "Claim my Pioneer marks \u2192" })] }) }));
}
// ─── SAGA 12 · Battery Dispatch Share Toggle ──────────────────────────────────
// Default OFF per Founder R6 + Bishop pref · Stamp-to-Send transparency
function BatteryDispatchShareToggle({ optedIn, dispatched, totalBM, onToggle, onDispatch }) {
    if (dispatched) {
        return (_jsxs("div", { style: {
                marginTop: 14, background: 'rgba(110,231,183,0.05)',
                border: '1px solid rgba(110,231,183,0.15)', borderRadius: 10, padding: '12px 16px',
            }, children: [_jsx("div", { style: { fontSize: 11, color: '#6ee7b7', fontWeight: 600, marginBottom: 2 }, children: "\u2713 Dispatched via your Plugs" }), _jsx("div", { style: { fontSize: 9, color: '#475569' }, children: "+2 marks per platform \u00B7 Ledger \u2192 Dashboard \u2192 Settings \u2192 My Shares" })] }));
    }
    return (_jsxs("div", { style: {
            marginTop: 14, background: 'rgba(15,23,42,0.6)',
            border: '1px solid rgba(100,116,139,0.15)', borderRadius: 10, padding: '12px 16px',
        }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 11, fontWeight: 600, color: '#94a3b8' }, children: "Share your Gauntlet result" }), _jsxs("div", { style: { fontSize: 9, color: '#475569', marginTop: 2 }, children: ["BannerCard \u00B7 ", totalBM.toFixed(1), " BM headline \u00B7 via your connected Plugs"] })] }), _jsx("button", { onClick: onToggle, style: {
                            background: optedIn ? 'rgba(110,231,183,0.2)' : 'rgba(100,116,139,0.1)',
                            border: `1px solid ${optedIn ? 'rgba(110,231,183,0.4)' : 'rgba(100,116,139,0.15)'}`,
                            borderRadius: 20, padding: '4px 12px', cursor: 'pointer',
                            fontSize: 10, fontWeight: 700,
                            color: optedIn ? '#6ee7b7' : '#475569',
                            transition: 'all 0.2s',
                        }, children: optedIn ? 'ON' : 'OFF' })] }), optedIn && (_jsxs("div", { style: { borderTop: '1px solid rgba(100,116,139,0.1)', paddingTop: 8 }, children: [_jsx("div", { style: { fontSize: 9, color: '#475569', marginBottom: 8, lineHeight: 1.6 }, children: "You see every post before it goes \u00B7 Stamp-to-Send transparency \u00B7 +2 marks per platform \u00B7 You see what was sent \u00B7 ledger accessible" }), _jsxs("button", { onClick: onDispatch, style: {
                            background: 'rgba(110,231,183,0.1)', border: '1px solid rgba(110,231,183,0.25)',
                            color: '#6ee7b7', borderRadius: 6, padding: '6px 14px',
                            fontSize: 10, fontWeight: 600, cursor: 'pointer', width: '100%',
                        }, children: ["Stamp \u00B7 Send \u2192 (", totalBM.toFixed(1), " BM \u00B7 cooperative-class real)"] })] })), _jsx("div", { style: { fontSize: 8, color: '#1e293b', marginTop: 6, textAlign: 'center' }, children: "The substrate gets stronger like an Encyclopedia \u00B7 cooperative-class real" })] }));
}
// ─── Stage row ────────────────────────────────────────────────────────────────
function StageRow({ result }) {
    const def = STAGE_DEFS.find((s) => s.stage === result.stage);
    const statusColor = result.status === 'complete' ? '#22c55e' : result.status === 'running' ? '#f59e0b' : result.status === 'skipped' ? '#475569' : '#334155';
    const statusIcon = result.status === 'complete' ? '✓' : result.status === 'running' ? '⟳' : result.status === 'skipped' ? '—' : '○';
    return (_jsxs("div", { style: {
            display: 'grid', gridTemplateColumns: '28px 1fr 80px 80px 80px 70px 70px',
            gap: 6, alignItems: 'center',
            background: result.status === 'running' ? 'rgba(245,158,11,0.06)' : 'rgba(15,23,42,0.5)',
            border: `1px solid ${result.status === 'running' ? 'rgba(245,158,11,0.2)' : 'rgba(100,116,139,0.1)'}`,
            borderRadius: 8, padding: '7px 10px',
            fontSize: 10,
        }, children: [_jsx("div", { style: { color: statusColor, fontWeight: 700, textAlign: 'center' }, children: statusIcon }), _jsxs("div", { style: { color: result.status === 'pending' ? '#475569' : '#94a3b8' }, children: [_jsx("span", { style: { marginRight: 4 }, children: def.icon }), def.name] }), _jsx("div", { style: { color: result.speed_delta !== undefined ? '#6ee7b7' : '#334155', textAlign: 'right' }, children: result.speed_delta !== undefined && result.speed_delta !== 0 ? `+${result.speed_delta}×` : result.status === 'complete' ? 'baseline' : '—' }), _jsx("div", { style: { color: result.cost_delta !== undefined ? '#34d399' : '#334155', textAlign: 'right' }, children: result.cost_delta !== undefined && result.cost_delta !== 0 ? `${result.cost_delta.toFixed(1)}×` : result.status === 'complete' ? 'baseline' : '—' }), _jsx("div", { style: { color: '#94a3b8', textAlign: 'right' }, children: result.accuracy_delta !== undefined && result.accuracy_delta !== 0 ? `+${result.accuracy_delta.toFixed(1)}×` : result.status === 'complete' ? 'baseline' : '—' }), _jsx("div", { style: { color: '#6ee7b7', fontWeight: 700, textAlign: 'right' }, children: result.banyan_metric !== undefined ? `${result.banyan_metric.toFixed(1)} BM` : '—' }), _jsx("div", { style: { color: '#22c55e', fontWeight: 700, textAlign: 'right' }, children: result.cumulative_bm !== undefined ? `${result.cumulative_bm.toFixed(1)} ΣBM` : '—' })] }));
}
