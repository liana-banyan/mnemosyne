import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// OneClickMeshTestPanel.tsx — BP132 Yoke #21 D9 / Yoke #22 "one-click staged test" /
// Yoke #23 WAN-distributed dispatch
//
// See src/main/mesh_test/one_click_mmlu_pro.ts for the full Truth-Always scope note.
// Short version shown to the user in this panel: real ground-truth-scored MMLU-Pro-format
// questions. "Auto" mode dispatches across live WAN mesh peers when any are online, and
// falls back to this machine's local Ollama when none are (peer_presence had 0 rows as
// of the last check this agent could perform — live multi-peer verification is still
// pending Bishop/Founder action, same flagging pattern as Yoke #21's peer_presence check).
//
// Writes its last result to localStorage so the Social tab's "Check My Math" card
// (CueDeckCardRenderer-based) can display the real number without prop-drilling
// across tabs — see LS_LAST_RESULT below.
import { useCallback, useEffect, useState } from 'react';
// KN-BP144-3 Phase 1 ("one store, one truth"): researchArmMode used to live ONLY in this
// component's own useState, fully disconnected from nexus_authority_settings_store.ts (the
// store Settings > Nexus Authority's master switch reads/writes) -- confirmed by direct read,
// this file never imported that module before this pass. That meant the Settings toggle had
// ZERO effect on this panel's scored runs, and this panel's checkbox had zero effect on what
// Settings displayed -- two independent "truths" for the identical CanonicalPlowMcConfig.
// researchArmMode field. See loadNexusAuthoritySettings/saveResearchArmMode/
// hasNexusAuthorityModeEverBeenSet usages below for the fix.
import { hasNexusAuthorityModeEverBeenSet, loadNexusAuthoritySettings, saveResearchArmMode, } from '../settings/nexus_authority_settings_store';
export const LS_LAST_RESULT = 'mnemo_last_mesh_test_result';
// BP138 Yoke: one-click HOT/COLD substrate lift -- see runHotColdLiftTest() in
// src/main/mesh_test/one_click_mmlu_pro.ts for the full design note. Persisted separately
// from LS_LAST_RESULT so the standalone single-run result and the last lift result never
// clobber each other.
export const LS_LAST_LIFT_RESULT = 'mnemo_last_hotcold_lift_result';
// BP140-K6 REQUIREMENT 4 (honest subset receipts): a subset run's receipt is persisted under
// this SEPARATE key -- NEVER LS_LAST_RESULT. LS_LAST_RESULT is read independently by the
// Social tab's "Check My Math" card and by ProofTab.tsx as "the most recent full benchmark
// score"; a 4/5 "Re-run misses" subset score written there would silently masquerade as a
// full-benchmark result the next time either of those surfaces loads. See the
// 'mesh-test:progress' 'complete' handler below for the isSubsetRun branch that enforces this.
export const LS_LAST_SUBSET_RESULT = 'mnemo_last_mesh_test_subset_result';
// BP135 YOKE_35 Phase 3: ported from GauntletTab.tsx (now cut from the shipped Help
// sub-tabs, see CleanShell.tsx) -- its two real side-effects (marks credit, Pioneer
// registry) must not silently regress just because the fake stage-sim around them is
// gone. GauntletTab.tsx itself stays in the tree, unrouted, per Rule 66.
const LS_FIRST_RUN_MARKS_CREDITED = 'mnemo_gauntlet_stage1_done';
// Mirrors GauntletTab.tsx's getPioneerPosition() verbatim -- optimistic client-side
// position estimate; server validates before writing to gauntlet_pioneer_registry.
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
/** BP137 Honest-MMLU-Provenance Yoke, Step 2: an outcome counts as "substrate-sourced" only
 *  when it was actually answered via the plow AND carries at least one named-source receipt.
 *  No receipt -> not counted as sourced, regardless of answeredBy -- Step 2's explicit rule. */
function isProvenanceSourced(o) {
    return o.answeredBy === 'plow' && (o.plowTrace?.provenance_receipts?.length ?? 0) > 0;
}
/** BP137 Honest-MMLU-Provenance Yoke, Step 2: renders the receipt row under a served answer
 *  ("Wikipedia, verified, hash a1b2c3d4e5f6...") or an explicit "no receipt" note when the
 *  outcome carries none -- never silently omits the row, since silence would look like an
 *  unsourced answer is sourced. */
function ProvenanceReceiptRow({ outcome }) {
    if (outcome.answeredBy !== 'plow')
        return null;
    const receipts = outcome.plowTrace?.provenance_receipts ?? [];
    if (receipts.length === 0) {
        return (_jsx("div", { style: { fontSize: 9, color: '#64748b', marginLeft: 16, fontStyle: 'italic' }, children: "no provenance receipt -- not counted as substrate-sourced" }));
    }
    return (_jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginLeft: 16 }, children: receipts.map((r, i) => (_jsxs("span", { style: { fontSize: 9, color: r.verified ? '#6ee7b7' : '#facc15', fontFamily: 'monospace' }, children: ["[", r.source, r.verified ? ' verified' : ' unverified', " hash:", r.contentHash.slice(0, 8), "]"] }, i))) }));
}
function classifyOutcomeForDemoDisplay(o) {
    const isNoResponse = !!o.timedOut || (typeof o.error === 'string' && o.error.trim().length > 0);
    if (isNoResponse) {
        return {
            displayClass: 'no-response',
            label: 'NO RESPONSE',
            detail: 'timed out or a transport error -- never attempted, not an abstain',
            icon: '\u23F1', // ⏱
            colorFg: '#94a3b8',
            colorBg: '#1e293b',
        };
    }
    const plowTrace = (o.plowTrace ?? {});
    const browserCorroboration = typeof plowTrace.browserAuthorityCorroboration === 'string'
        ? plowTrace.browserAuthorityCorroboration
        : null;
    const candidatesPostFurnace = typeof plowTrace.candidatesPostFurnace === 'number'
        ? plowTrace.candidatesPostFurnace
        : null;
    const hasGrounding = (candidatesPostFurnace ?? 0) > 0;
    const structuredCorroborator = plowTrace.structuredCorroborator === true;
    const independentCorroboration = plowTrace.independentCorroboration === true;
    const voterLetters = Array.isArray(plowTrace.voter_letters)
        ? plowTrace.voter_letters.map((v) => (typeof v === 'string' ? v : null))
        : [];
    const nonNullVoters = voterLetters.filter((v) => v !== null);
    const isUnanimousVote = nonNullVoters.length > 0 && nonNullVoters.every((v) => v === nonNullVoters[0]);
    const isDeterministicCompute = browserCorroboration === 'deterministic_compute' ||
        browserCorroboration === 'deterministic_compute_override';
    let deterministicSolverName = null;
    if (isDeterministicCompute && Array.isArray(plowTrace.voter_diagnostics)) {
        for (const diag of plowTrace.voter_diagnostics) {
            const rawPreview = typeof diag?.rawPreview === 'string'
                ? diag.rawPreview
                : '';
            const match = rawPreview.match(/^deterministic_compute \(([^)]+)\)/);
            if (match) {
                deterministicSolverName = match[1];
                break;
            }
        }
    }
    if (isDeterministicCompute) {
        return {
            displayClass: 'proven',
            label: 'PROVEN',
            detail: deterministicSolverName ? `solved by ${deterministicSolverName}` : 'solved by a deterministic compute sidecar',
            icon: '\u2605', // ★
            colorFg: '#4ade80',
            colorBg: '#052e16',
        };
    }
    // Contested-key: mirrors classifyCore's wrong-branch check -- the STRONGEST acceptance path
    // (structured + independent + unanimous voters) still landed on the wrong letter. Only
    // reachable when the answer was actually wrong (not correct, not an abstain).
    if (!o.isCorrect && !o.isAbstain && browserCorroboration && browserCorroboration !== 'none'
        && structuredCorroborator && independentCorroboration && isUnanimousVote) {
        return {
            displayClass: 'contested',
            label: 'CONTESTED',
            detail: 'the strongest sources disagreed with the sealed key -- not counted as a failure',
            icon: '\u21C4', // ⇄
            colorFg: '#c4b5fd',
            colorBg: '#2e1a47',
        };
    }
    if (browserCorroboration && browserCorroboration !== 'none' && !hasGrounding) {
        return {
            displayClass: 'ungrounded',
            label: 'UNGROUNDED',
            detail: 'accepted with zero post-Furnace grounding',
            icon: '\u25B2', // ▲
            colorFg: '#cbd5e1',
            colorBg: '#1f2937',
        };
    }
    if (browserCorroboration === 'agree') {
        return {
            displayClass: 'corroborated',
            label: 'CORROBORATED',
            detail: 'independent sources agreed',
            icon: '\u2713', // ✓
            colorFg: '#60a5fa',
            colorBg: '#0c2340',
        };
    }
    if (browserCorroboration === 'adjudicated') {
        return {
            displayClass: 'adjudicated',
            label: 'ADJUDICATED',
            detail: 'sources disagreed, a judge decided',
            icon: '\u2696', // ⚖
            colorFg: '#fbbf24',
            colorBg: '#3a2f0a',
        };
    }
    return {
        displayClass: 'unclassified',
        label: o.isAbstain ? 'ABSTAIN' : o.isCorrect ? 'ANSWERED' : 'WRONG',
        detail: o.answeredBy ? `answered by ${o.answeredBy}` : 'unclassified',
        icon: '\u2022', // •
        colorFg: '#94a3b8',
        colorBg: '#111827',
    };
}
/** Plain-English, no-jargon legend, mirrors answer_coroner.ts's DEMO_DISPLAY_LEGEND verbatim.
 *  Rendered once per card, not per row. 'unclassified' deliberately omitted -- honest catch-all,
 *  not a taught concept for a first-time viewer. */
const DEMO_DISPLAY_LEGEND = [
    { displayClass: 'proven', label: 'PROVEN', description: 'A calculator solved it outright -- no guessing involved.' },
    { displayClass: 'corroborated', label: 'CORROBORATED', description: 'Multiple independent sources checked and agreed.' },
    { displayClass: 'adjudicated', label: 'ADJUDICATED', description: 'Sources disagreed, so a judge step picked one.' },
    { displayClass: 'ungrounded', label: 'UNGROUNDED', description: 'Accepted with no supporting facts found -- weakest evidence.' },
    { displayClass: 'contested', label: 'CONTESTED', description: 'Strong sources disagreed with the answer key -- not a system failure.' },
    { displayClass: 'no-response', label: 'NO RESPONSE', description: 'Timed out or failed to connect -- never actually attempted.' },
];
/** BP141 KN-BP141-9 D3: one row's colour-coded classification chip + latency, rendered next to
 *  the existing checkmark/category/question line. Latency is shown explicitly per Founder's
 *  requirement: "qid 33 answered in 211ms by proof while adjudicated rows took 45 to 80 seconds.
 *  That contrast IS the demo, make sure it is visible." */
function DemoDisplayBadge({ outcome }) {
    const info = classifyOutcomeForDemoDisplay(outcome);
    const latencySeconds = outcome.latencyMs >= 1000 ? `${(outcome.latencyMs / 1000).toFixed(1)}s` : `${Math.round(outcome.latencyMs)}ms`;
    return (_jsxs("span", { style: { display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 4 }, children: [_jsxs("span", { title: info.detail, style: {
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: info.colorBg, color: info.colorFg,
                    border: `1px solid ${info.colorFg}`, borderRadius: 4,
                    padding: '1px 6px', fontSize: 9, fontWeight: 800, letterSpacing: 0.3,
                    fontFamily: 'system-ui, sans-serif',
                }, children: [_jsx("span", { "aria-hidden": "true", children: info.icon }), _jsx("span", { children: info.label })] }), _jsx("span", { style: { fontSize: 9, color: info.colorFg, fontStyle: 'italic', opacity: 0.85 }, children: info.detail }), _jsx("span", { style: { fontSize: 9, color: '#64748b', fontFamily: 'monospace' }, children: latencySeconds })] }));
}
// BP141 KN-BP141-9 D1 ("The Demo Front Door"): one button is the front door, not one option
// among seven. Founder, verbatim: "More detail setup = more barrier."
//
// RECOMMENDED_DEFAULTS is the exact configuration that produced run 031's 18/20 scored result
// (C:\Users\Administrator\Downloads\031mnemo_mesh_test_receipt_2026-08-01T18-13-04-045Z.json):
// substrateEnabled true, plowEnabled true, researchArmMode true, plowAndonEnabled true
// (Condition C -- that receipt's plowTrace.condition field reads "C_warm_andon" on every row),
// 20 questions. Dispatch mode is set to 'local_ollama' rather than the old 'auto' default
// specifically because a stranger's machine (the professor's laptop) has zero live WAN mesh
// peers -- 'auto' would silently fall back to local anyway per this file's own doc comment
// above, but setting it explicitly here means the demo reproduces run 031's actual dispatchMode
// ("local_ollama", confirmed by reading that receipt's own top-level field) instead of depending
// on live peer discovery succeeding or failing invisibly mid-demo.
const RECOMMENDED_DEFAULTS = {
    mode: 'local_ollama',
    substrateEnabled: true,
    plowEnabled: true,
    plowAndonEnabled: true,
    researchArmMode: true,
    researchArmMeshSynergy: false,
    researchArmDecompose: false,
    federatedSubstrateEnabled: false,
    maxTotalQuestions: 20,
};
export function loadLastMeshTestResult() {
    try {
        const raw = localStorage.getItem(LS_LAST_RESULT);
        if (!raw)
            return null;
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
export function loadLastLiftResult() {
    try {
        const raw = localStorage.getItem(LS_LAST_LIFT_RESULT);
        if (!raw)
            return null;
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
/** BP140-K6 REQUIREMENT 4: the subset-run equivalent of loadLastMeshTestResult() above --
 *  reads from the SEPARATE LS_LAST_SUBSET_RESULT key so a subset receipt is never confused
 *  with (or read in place of) the last full-run receipt. */
export function loadLastSubsetResult() {
    try {
        const raw = localStorage.getItem(LS_LAST_SUBSET_RESULT);
        if (!raw)
            return null;
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
/** BP134 Yoke #32 Phase F item 4: serialize the full OneClickRunResult (every outcome,
 *  every persisted plow_trace, the corpus manifest hash) to a downloadable .json file --
 *  third-party verifiability, so a result can be independently re-checked question by
 *  question rather than trusting only the on-screen aggregate percentage. */
export function downloadReceipt(result) {
    try {
        const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mnemo_mesh_test_receipt_${result.startedAt.replace(/[:.]/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    catch (e) {
        console.error('[OneClickMeshTestPanel] receipt download failed:', e);
    }
}
export function MeshTestResultSummary({ result, onShareResult, showPerQuestionDetail }) {
    // BP137 Honest-MMLU-Provenance Yoke, Step 2+3: the provenance-backed subset of this result's
    // outcomes -- only outcomes with at least one named-source receipt count here, per Step 2's
    // explicit "no receipt -> not substrate-sourced" rule. This is the SINGLE headline number for
    // this benchmark (never the raw "all outcomes" percentage, which may include un-sourced
    // single-shot/Minor-Council answers that are pure model recall, not swarm-provenance).
    const sourcedOutcomes = result.outcomes.filter(isProvenanceSourced);
    const sourcedScored = sourcedOutcomes.filter((o) => o.parsedLetter !== null).length;
    const sourcedCorrect = sourcedOutcomes.filter((o) => o.isCorrect).length;
    const sourcedAccuracy = sourcedScored > 0 ? sourcedCorrect / sourcedScored : null;
    const [detailOpen, setDetailOpen] = useState(false);
    return (_jsxs("div", { children: [_jsxs("div", { style: {
                    background: '#111827', border: '1px solid #1e2d45', borderRadius: 8,
                    padding: '10px 14px', marginBottom: 8,
                }, children: [result.isSubsetRun && (_jsxs("div", { style: {
                            display: 'inline-block', fontSize: 11, fontWeight: 800, color: '#0d1117',
                            background: '#facc15', borderRadius: 4, padding: '3px 9px', marginBottom: 8,
                            letterSpacing: 0.4, textTransform: 'uppercase',
                        }, children: ["\u26A0 Subset run (", result.total, " of ", result.subsetOfTotal ?? '?', " questions)"] })), sourcedAccuracy !== null ? (_jsxs("div", { style: { fontSize: 16, fontWeight: 700, color: '#6ee7b7' }, children: [`${(sourcedAccuracy * 100).toFixed(0)}% sourced-knowledge accuracy`, _jsxs("span", { style: { fontSize: 10, color: '#475569', fontWeight: 400, marginLeft: 6 }, children: ["(provenance-backed, ", sourcedCorrect, "/", sourcedScored, " of ", sourcedOutcomes.length, " sourced answers)"] })] })) : (_jsxs("div", { style: { fontSize: 14, fontWeight: 700, color: '#facc15' }, children: ["Not provenance-sourced this run", _jsx("span", { style: { fontSize: 10, color: '#94a3b8', fontWeight: 400, marginLeft: 6 }, children: "(enable 12-Blade Plow, Local or WAN Mesh, for a sourced-knowledge headline)" })] })), _jsxs("div", { style: { fontSize: 10, color: '#64748b', marginTop: 3 }, children: [result.accuracy !== null ? `${(result.accuracy * 100).toFixed(0)}% raw accuracy` : 'no scored answers', ' (all answers incl. non-sourced fallback -- not substrate-provenance) · ', result.correct, "/", result.scored, " correct (of ", result.total, " answers run) \u00B7", ' ', result.dispatchMode === 'wan_mesh'
                                ? `dispatched across ${result.livePeersFound ?? '?'} live WAN peer(s)`
                                : result.dispatchMode === 'local_ollama' ? 'dispatched locally on this machine' : result.dispatchMode, ' · substrate ', _jsx("span", { style: { color: result.substrateEnabled ? '#6ee7b7' : '#94a3b8', fontWeight: 700 }, children: result.substrateEnabled ? 'ON' : 'OFF' }), (result.dispatchMode === 'wan_mesh' || result.plowEnabled) && (_jsxs(_Fragment, { children: [' · answered by ', _jsx("span", { style: { color: result.plowEnabled ? '#facc15' : '#94a3b8', fontWeight: 700 }, children: result.plowEnabled ? '12-Blade Plow' : 'single-shot' })] })), result.dispatchMode === 'wan_mesh' && (_jsxs(_Fragment, { children: [' · federated substrate ', _jsx("span", { style: { color: result.federatedSubstrateEnabled ? '#a78bfa' : '#94a3b8', fontWeight: 700 }, children: result.federatedSubstrateEnabled ? 'ON' : 'OFF' })] }))] }), _jsxs("div", { style: { fontSize: 10, color: '#475569', marginTop: 4, fontStyle: 'italic' }, children: [result.datasetLabel, result.exactPerCategory && ` · exact ${result.exactPerCategory}/category sampling (Full 14x${result.exactPerCategory})`] }), result.corpusManifestSha256 && (_jsxs("div", { style: { fontSize: 9, color: '#334155', marginTop: 2, fontFamily: 'monospace' }, children: ["corpus manifest sha256: ", result.corpusManifestSha256.slice(0, 16), "..."] }))] }), result.peerBreakdown && result.peerBreakdown.length > 0 && (_jsxs("div", { style: {
                    background: '#111827', border: '1px solid #1e2d45', borderRadius: 8,
                    padding: '10px 14px', marginBottom: 8,
                }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 6 }, children: "Per-peer accuracy" }), result.peerBreakdown.map((p) => (_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#cbd5e1', padding: '2px 0' }, children: [_jsx("span", { style: { color: '#38bdf8' }, children: p.machineLabel }), _jsxs("span", { children: [p.accuracy !== null ? `${(p.accuracy * 100).toFixed(0)}%` : 'unscored', " (", p.correct, "/", p.scored, " of ", p.total, ")"] })] }, p.peerId)))] })), result.consensusOutcomes && result.consensusOutcomes.length > 0 && (_jsxs("div", { style: {
                    background: '#111827', border: '1px solid #3b2d5f', borderRadius: 8,
                    padding: '10px 14px', marginBottom: 8,
                }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 700, color: '#c4b5fd', marginBottom: 6 }, children: "Mesh consensus" }), _jsxs("div", { style: { fontSize: 13, fontWeight: 700, color: '#c4b5fd', marginBottom: 6 }, children: [result.consensusAccuracy !== null && result.consensusAccuracy !== undefined
                                ? `${(result.consensusAccuracy * 100).toFixed(0)}% consensus accuracy`
                                : 'No scored consensus answers', ' — ', result.consensusOutcomes.filter((c) => c.isConsensusCorrect).length, "/", result.consensusOutcomes.filter((c) => c.consensusLetter !== null).length, " correct"] }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 3 }, children: result.consensusOutcomes.map((c) => (_jsxs("div", { style: { display: 'flex', gap: 8, fontSize: 10, color: '#94a3b8' }, children: [_jsx("span", { style: { color: c.isConsensusCorrect ? '#4ade80' : '#f87171' }, children: c.isConsensusCorrect ? '✓' : c.consensusLetter === null ? '·' : '✗' }), _jsxs("span", { style: { color: '#64748b' }, children: ["[", c.category, "]"] }), _jsxs("span", { children: ["consensus ", c.consensusLetter ?? '—', " (correct ", c.correctLetter, ")"] }), c.andonTriggered && (_jsx("span", { style: { color: '#facc15', fontWeight: 700 }, children: "andon triggered" }))] }, c.question_id))) })] })), showPerQuestionDetail && result.outcomes.length > 0 && (_jsxs("div", { style: {
                    background: '#111827', border: '1px solid #1e2d45', borderRadius: 8,
                    padding: '10px 14px', marginBottom: 8,
                }, children: [_jsxs("button", { onClick: () => setDetailOpen((v) => !v), style: {
                            background: 'none', border: 'none', color: '#94a3b8', fontSize: 11, fontWeight: 700,
                            cursor: 'pointer', fontFamily: 'system-ui, sans-serif', padding: 0,
                        }, children: [detailOpen ? '▼' : '▶', " How this answer was assembled -- ", result.outcomes.length, " question(s)"] }), detailOpen && (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }, children: result.outcomes.map((o, i) => (_jsxs("div", { children: [_jsxs("div", { style: { fontSize: 11, color: o.isCorrect ? '#4ade80' : '#f87171', display: 'flex', gap: 8, alignItems: 'center' }, children: [_jsx("span", { children: o.isCorrect ? '✓' : o.timedOut ? '⏱' : o.isAbstain ? '·' : '✗' }), _jsx(DemoDisplayBadge, { outcome: o }), o.machineLabel && _jsxs("span", { style: { color: '#38bdf8' }, children: ["[", o.machineLabel, "]"] }), o.answeredBy === 'plow' && _jsx("span", { style: { color: '#facc15' }, children: "[plow]" }), _jsxs("span", { style: { color: '#64748b' }, children: ["[", o.category, "]"] }), _jsx("span", { style: { color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: o.question })] }), _jsx(ProvenanceReceiptRow, { outcome: o })] }, `${o.question_id}-${o.peerId ?? 'local'}-${i}`))) }))] })), _jsxs("div", { style: { display: 'flex', gap: 8 }, children: [onShareResult && (_jsx("button", { onClick: () => onShareResult(result), style: {
                            background: 'none', color: '#6ee7b7', border: '1px solid #1e4038', borderRadius: 6,
                            padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                            fontFamily: 'system-ui, sans-serif',
                        }, children: "\uD83D\uDCE4 Share your results" })), _jsx("button", { onClick: () => downloadReceipt(result), style: {
                            background: 'none', color: '#93c5fd', border: '1px solid #1e3a5f', borderRadius: 6,
                            padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                            fontFamily: 'system-ui, sans-serif',
                        }, children: "\u2B07 Download receipt (.json)" })] })] }));
}
export function OneClickMeshTestPanel({ onShareResult, authState }) {
    const [state, setState] = useState('idle');
    const isMember = authState?.status === 'member' || authState?.status === 'trial_active';
    // BP135 YOKE_35 Phase 3: ported Pioneer Bonus modal state (see PioneerBonusModal below).
    const [pioneerBonus, setPioneerBonus] = useState({
        visible: false, modelName: '', position: 0, multiplier: 1, label: '',
    });
    // BP141 KN-BP141-9 D1: initial values below now start at RECOMMENDED_DEFAULTS (not the old
    // all-OFF/'auto' defaults) so the panel opens ALREADY matching the known-good, proof-backed
    // configuration -- "pre-selected on first open" per the Founder's ask. The individual
    // setters/onChange handlers are unchanged; a manual toggle still works exactly as before, it
    // just now starts from a different baseline and flips `recommendedDefaultsApplied` to false
    // (see that state + applyRecommendedDefaults() below).
    const [mode, setMode] = useState(RECOMMENDED_DEFAULTS.mode);
    // BP133 Yoke #24 Task 1: explicit substrate on/off switch.
    const [substrateEnabled, setSubstrateEnabled] = useState(RECOMMENDED_DEFAULTS.substrateEnabled);
    // BP133 Yoke #24 Task 2: explicit opt-in to the 12-Blade Column Plow (wan_mesh only --
    // has no effect in local_ollama mode, since the plow answerer runs on the RESPONDING
    // peer's machine).
    const [plowEnabled, setPlowEnabled] = useState(RECOMMENDED_DEFAULTS.plowEnabled);
    // Condition C (Andon retry loop) vs Condition B (single pass) -- only meaningful when
    // plowEnabled is true.
    const [plowAndonEnabled, setPlowAndonEnabled] = useState(RECOMMENDED_DEFAULTS.plowAndonEnabled);
    // BP137 Yoke v2b (Research Arm): explicit opt-in, only meaningful when plowEnabled is true.
    // Bundles Stage A.0 (relevance gate moved upstream of the MC voters -- fixes the Bush/Biden
    // off-topic-citation failure mode) + Stage A (answer-type classifier + real compute sidecar
    // for computable questions) together. Off by default, same opt-in pattern as every other
    // toggle here.
    //
    // KN-BP144-3 Phase 1 ("one store, one truth"): initial value now comes from
    // nexus_authority_settings_store.ts -- the SAME canonical store Settings > Nexus Authority's
    // master switch reads/writes -- instead of always starting from the hardcoded
    // RECOMMENDED_DEFAULTS constant regardless of what the user set elsewhere. On a genuinely
    // fresh install (hasNexusAuthorityModeEverBeenSet() false -- the store has never been written
    // by ANY surface), this seeds the store with RECOMMENDED_DEFAULTS.researchArmMode and persists
    // that seed immediately, preserving BP141 KN-BP141-9 D1's "pre-selected on first open" UX
    // without inventing a second default independent of the store. Every subsequent mount (or a
    // live change from the Settings tab while this panel is also mounted, via the
    // 'nexus-authority-settings-changed' listener below) reads the real persisted value -- never a
    // silently different one. setResearchArmMode (the wrapper below) is what makes this
    // bidirectional: every manual toggle of this checkbox also persists into the store, so the
    // Settings tab's toggle and this panel's checkbox can never again silently disagree.
    const [researchArmMode, setResearchArmModeRaw] = useState(() => {
        if (!hasNexusAuthorityModeEverBeenSet()) {
            saveResearchArmMode(RECOMMENDED_DEFAULTS.researchArmMode);
            return RECOMMENDED_DEFAULTS.researchArmMode;
        }
        return loadNexusAuthoritySettings().researchArmMode;
    });
    const setResearchArmMode = useCallback((next) => {
        setResearchArmModeRaw(next);
        saveResearchArmMode(next);
    }, []);
    // Keeps this panel in sync when researchArmMode changes from a DIFFERENT mounted surface
    // (Settings > Nexus Authority's master switch) -- closes the loop the other direction too.
    useEffect(() => {
        const syncFromStore = () => setResearchArmModeRaw(loadNexusAuthoritySettings().researchArmMode);
        window.addEventListener('nexus-authority-settings-changed', syncFromStore);
        return () => window.removeEventListener('nexus-authority-settings-changed', syncFromStore);
    }, []);
    // BP138 Yoke 0.9.13 F3: explicit opt-in to mesh-synergy dispatch (asker's round-robin
    // distribution of DIFFERENT authorities -- user_google/user_perplexity/swarm -- across live
    // peers for the SAME question, instead of every peer redundantly running the identical full
    // plow). Only meaningful when plowEnabled + researchArmMode are also true AND mode is
    // wan_mesh with 2+ live peers (see one_click_mmlu_pro.ts's researchArmMeshSynergy doc comment
    // for the exact AND-gate). Off by default, same opt-in pattern as every toggle above.
    const [researchArmMeshSynergy, setResearchArmMeshSynergy] = useState(RECOMMENDED_DEFAULTS.researchArmMeshSynergy);
    // BP138 Yoke Phase 2: explicit opt-in to the Decompose-and-Eliminate engine. AND-gated with
    // researchArmMode at the back-end (one_click_mmlu_pro.ts). Only meaningful in wan_mesh +
    // plowEnabled + researchArmMode. Off by default -- all pre-Phase-2 behavior unchanged.
    const [researchArmDecompose, setResearchArmDecompose] = useState(RECOMMENDED_DEFAULTS.researchArmDecompose);
    // BP135 Yoke #34 Phase 5: explicit opt-in to pooled cross-peer substrate (federated
    // substrate layer). Only meaningful when substrateEnabled is true AND mode is wan_mesh --
    // ignored server-side otherwise (see one_click_mmlu_pro.ts config.federatedSubstrateEnabled
    // doc comment). Off by default, same pattern as substrateEnabled/plowEnabled/plowAndonEnabled:
    // the Founder must opt in, a run's meaning never changes silently.
    const [federatedSubstrateEnabled, setFederatedSubstrateEnabled] = useState(RECOMMENDED_DEFAULTS.federatedSubstrateEnabled);
    // BP133 Yoke #24 Task 4: question-count control. QUESTION_COUNT_PRESETS[0] (3) is the
    // one-click smoke test; F12 DevTools is unavailable in this build, so this replaces the
    // only prior way to change question count (a console workaround).
    const [maxTotalQuestions, setMaxTotalQuestions] = useState(RECOMMENDED_DEFAULTS.maxTotalQuestions);
    // BP134 Yoke #32 Phase F item 2: "Full 14x5 MMLU-Pro" preset -- exact 5-per-category
    // sampling across all 14 canonical domains (70 total), substrate+plow+andon forced ON.
    // Cleared by any manual change to the individual toggles/question-count below, since at
    // that point the run is no longer the untouched preset (Truth-Always: never let a result
    // silently claim "Full 14x5" when the Founder changed a setting after selecting it).
    const [fullPresetSelected, setFullPresetSelected] = useState(false);
    // BP141 KN-BP141-9 D1: true when the panel's current config matches RECOMMENDED_DEFAULTS
    // (initially true -- "pre-selected on first open"). Flips to false the instant ANY manual
    // control is touched (every onChange handler below now calls
    // setRecommendedDefaultsApplied(false) alongside its existing setFullPresetSelected(false)
    // call), so the primary button can honestly read "Custom" the moment the config diverges,
    // and "Back to Recommended" is always one click away -- "never silently strand the user in a
    // broken config."
    const [recommendedDefaultsApplied, setRecommendedDefaultsApplied] = useState(true);
    // BP141 KN-BP141-9 D1: the ONE collapsed disclosure ("Show what this does / Customize").
    // Collapsed by default -- the 7 checkboxes + mode selector + question-count + "Full 14x5"
    // preset all live inside this disclosure now, so the front door is the recommended-defaults
    // button, not a wall of knobs.
    const [customizeOpen, setCustomizeOpen] = useState(false);
    const [total, setTotal] = useState(0);
    const [doneCount, setDoneCount] = useState(0);
    const [peersDiscovered, setPeersDiscovered] = useState(null);
    const [liveOutcomes, setLiveOutcomes] = useState([]);
    const [result, setResult] = useState(() => loadLastMeshTestResult());
    const [errorMsg, setErrorMsg] = useState(null);
    // BP140-K6 REQUIREMENT 3: manual subset input -- comma-separated question IDs or 1-based
    // positions into the currently-displayed outcome list (e.g. "6, 13, 14, 15, 16").
    const [subsetInput, setSubsetInput] = useState('');
    // BP138 Yoke: one-click HOT/COLD substrate lift -- separate run/progress/result state
    // from the standalone single-run state above so the two features never clobber each
    // other (see LS_LAST_LIFT_RESULT / 'mesh-test:hotcold-progress' channel notes).
    const [liftState, setLiftState] = useState('idle');
    const [liftArm, setLiftArm] = useState(null);
    const [liftDoneCount, setLiftDoneCount] = useState(0);
    const [liftTotal, setLiftTotal] = useState(0);
    const [liftPeersDiscovered, setLiftPeersDiscovered] = useState(null);
    const [liftResult, setLiftResult] = useState(() => loadLastLiftResult());
    const [liftErrorMsg, setLiftErrorMsg] = useState(null);
    // BP138 Phase 1 Answer Coroner state
    const [coronerState, setCoronerState] = useState('idle');
    const [coronerLog, setCoronerLog] = useState([]);
    const [coronerRoundup, setCoronerRoundup] = useState(null);
    const [coronerError, setCoronerError] = useState(null);
    // BP139 Founder Yoke: which data the roundup on screen was actually computed from -- 'wan'
    // (the 500-row Supabase relay_route_replies dump) or 'local' (the CURRENT run's own
    // outcomes, no network call). Never left ambiguous in the UI which one the Founder is
    // looking at.
    const [coronerSource, setCoronerSource] = useState(null);
    // gates config controls so both actions can't
    // race each other and silently produce a confusing mixed-config result.
    const busy = state === 'running' || liftState === 'running';
    // BP139 Founder Yoke: "the benchmark results must NOT disappear when a run finishes."
    // result/loadLastMeshTestResult already hydrate from localStorage on mount (persists across
    // tab switches/reloads); this is the explicit "Clear results" action -- only this empties
    // the view, matching "I want to keep seeing them ... until it is replaced or I clear it."
    const [loadedReceiptName, setLoadedReceiptName] = useState(null);
    // BP141 KN-BP141-9 D1: the front-door action. Resets every knob this file owns back to
    // RECOMMENDED_DEFAULTS in one click -- including maxTotalQuestions and mode, not just the 4
    // headline flags, so "Back to Recommended" is a genuine full reset and never leaves a stray
    // manual change (e.g. a changed question count) silently in effect alongside the recommended
    // flags. Deliberately does NOT touch `fullPresetSelected` truthiness beyond clearing it --
    // this button and the separate "Full 14x5 MMLU-Pro" preset button (customize-only, unchanged)
    // remain two distinct, mutually-exclusive presets.
    const applyRecommendedDefaults = useCallback(() => {
        setMode(RECOMMENDED_DEFAULTS.mode);
        setSubstrateEnabled(RECOMMENDED_DEFAULTS.substrateEnabled);
        setPlowEnabled(RECOMMENDED_DEFAULTS.plowEnabled);
        setPlowAndonEnabled(RECOMMENDED_DEFAULTS.plowAndonEnabled);
        setResearchArmMode(RECOMMENDED_DEFAULTS.researchArmMode);
        setResearchArmMeshSynergy(RECOMMENDED_DEFAULTS.researchArmMeshSynergy);
        setResearchArmDecompose(RECOMMENDED_DEFAULTS.researchArmDecompose);
        setFederatedSubstrateEnabled(RECOMMENDED_DEFAULTS.federatedSubstrateEnabled);
        setMaxTotalQuestions(RECOMMENDED_DEFAULTS.maxTotalQuestions);
        setFullPresetSelected(false);
        setRecommendedDefaultsApplied(true);
    }, []);
    const handleClearResults = useCallback(() => {
        setResult(null);
        setLiveOutcomes([]);
        setState('idle');
        setTotal(0);
        setDoneCount(0);
        setPeersDiscovered(null);
        setErrorMsg(null);
        setLoadedReceiptName(null);
        setCoronerRoundup(null);
        setCoronerSource(null);
        setCoronerError(null);
        setCoronerState('idle');
        try {
            localStorage.removeItem(LS_LAST_RESULT);
        }
        catch { /* non-fatal */ }
    }, []);
    // BP139 Founder Yoke: load a previously downloaded receipt (.json, from downloadReceipt()
    // above) and show its results + breakdown, same view as a live run. Deliberately does NOT
    // overwrite LS_LAST_RESULT -- that key is shared with ProofTab.tsx and the Social "Check My
    // Math" card, and a manually loaded historical receipt must never silently masquerade as
    // this machine's actual last real run there. loadedReceiptName labels the view instead.
    const handleLoadReceiptFile = useCallback((e) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // allow re-selecting the same file next time
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(String(reader.result));
                if (!parsed || !Array.isArray(parsed.outcomes)) {
                    setErrorMsg(`"${file.name}" does not look like a mesh-test receipt (.json) -- missing outcomes[].`);
                    setState('error');
                    return;
                }
                setResult(parsed);
                setLiveOutcomes([]);
                setState('idle');
                setErrorMsg(null);
                setLoadedReceiptName(file.name);
                setCoronerRoundup(null);
                setCoronerSource(null);
                setCoronerError(null);
            }
            catch (err) {
                setErrorMsg(`Failed to parse "${file.name}": ${String(err)}`);
                setState('error');
            }
        };
        reader.onerror = () => setErrorMsg(`Failed to read "${file.name}"`);
        reader.readAsText(file);
    }, []);
    // BP135 YOKE_35 Phase 3: the two real side-effects ported from GauntletTab.tsx's
    // stage-sim loop, now anchored to this panel's own (real) completion event instead of
    // a fake "Stage 1"/"Stage 3" boundary.
    const handleRealCompletionSideEffects = useCallback(async () => {
        // 1) First-ever proof-run marks credit (SAGA 13) -- reuses the exact same one-time
        // localStorage flag GauntletTab.tsx used, so a user who already earned this via the
        // old (now-cut) Gauntlet sub-tab is not credited twice.
        const firstRun = !localStorage.getItem(LS_FIRST_RUN_MARKS_CREDITED);
        if (firstRun) {
            localStorage.setItem(LS_FIRST_RUN_MARKS_CREDITED, 'true');
            window.amplify?.creditFirstInstallMarks?.();
        }
        // 2) Pioneer Bonus (SAGA 09) -- GauntletTab.tsx keyed this off a `selectedModel`
        // dropdown value that was never actually wired to any UI (dead code path). This port
        // keys it off the real active-brain identity instead (window.amplify.brainRegistry.
        // getActive(), a genuine IPC call, preload.ts:971) rather than fabricate a model
        // selector that doesn't exist in this panel -- "nothing that isn't real."
        if (!isMember)
            return;
        try {
            // brainRegistry is a real preload bridge (preload.ts:968-977) not yet declared in
            // amplify.d.ts -- cast via `(window as any).amplify`, matching this file's existing
            // pattern for onMeshTestProgress/meshTestRunOneClick above (same underlying drift).
            const brainResp = await window.amplify?.brainRegistry?.getActive?.();
            const brainId = brainResp?.ok ? brainResp.brain_id : undefined;
            if (!brainId)
                return;
            const storageKey = `mnemo_pioneer_tested_${brainId}`;
            const existingCount = parseInt(localStorage.getItem(storageKey) ?? '0', 10);
            const pioneer = getPioneerPosition(existingCount);
            if (pioneer.multiplier > 1.0) {
                setPioneerBonus({
                    visible: true,
                    modelName: brainId,
                    position: pioneer.position,
                    multiplier: pioneer.multiplier,
                    label: pioneer.label,
                });
                // Optimistic local record; server validates + writes to gauntlet_pioneer_registry.
                localStorage.setItem(storageKey, String(existingCount + 1));
            }
        }
        catch { /* non-fatal -- Pioneer Bonus is a bonus, never blocks the real test result */ }
    }, [isMember]);
    useEffect(() => {
        const unsub = window.amplify?.onMeshTestProgress?.((payload) => {
            if (payload.type === 'start') {
                // BP139 Founder Yoke: a NEW run starting is the one implicit "replaced" condition
                // (per Founder ask: keep seeing results "until it is replaced or I clear it") -- the
                // stale result/loaded-receipt/coroner roundup on screen belongs to the PREVIOUS run
                // and must not be shown alongside the new one's growing live feed.
                setTotal(payload.total);
                setDoneCount(0);
                setLiveOutcomes([]);
                setResult(null);
                setLoadedReceiptName(null);
                setCoronerRoundup(null);
                setCoronerSource(null);
                setCoronerError(null);
                setCoronerState('idle');
            }
            else if (payload.type === 'peers-discovered') {
                setPeersDiscovered(payload.count);
            }
            else if (payload.type === 'question-complete') {
                setDoneCount(payload.index + 1);
                setLiveOutcomes((prev) => [...prev, payload.outcome]);
            }
            else if (payload.type === 'complete') {
                setResult(payload.result);
                setState(payload.result.wanError ? 'error' : 'complete');
                if (payload.result.wanError)
                    setErrorMsg(payload.result.wanError);
                // BP140-K6 REQUIREMENT 4 (honest subset receipts): a subset run's receipt is persisted
                // under LS_LAST_SUBSET_RESULT, NEVER LS_LAST_RESULT -- the latter is read independently
                // by the Social tab's "Check My Math" card and ProofTab.tsx as "the most recent FULL
                // benchmark score"; writing a subset score there would silently contaminate both.
                try {
                    if (payload.result.isSubsetRun) {
                        localStorage.setItem(LS_LAST_SUBSET_RESULT, JSON.stringify(payload.result));
                    }
                    else {
                        localStorage.setItem(LS_LAST_RESULT, JSON.stringify(payload.result));
                    }
                }
                catch { /* non-fatal */ }
                // Marks-credit / Pioneer Bonus side effects are for a genuine benchmark run -- a
                // partial "re-run misses"/"run subset" pass must not double-fire either one.
                if (!payload.result.wanError && !payload.result.isSubsetRun)
                    void handleRealCompletionSideEffects();
            }
        });
        return () => unsub?.();
    }, [handleRealCompletionSideEffects]);
    const handleRun = useCallback(async () => {
        setState('running');
        setErrorMsg(null);
        setPeersDiscovered(null);
        try {
            const resp = await window.amplify?.meshTestRunOneClick?.({
                mode,
                substrateEnabled,
                maxTotalQuestions,
                plowEnabled,
                plowAndonEnabled,
                researchArmMode,
                researchArmMeshSynergy,
                researchArmDecompose,
                exactPerCategory: fullPresetSelected ? 5 : undefined,
                federatedSubstrateEnabled,
            });
            if (!resp?.ok) {
                setErrorMsg(resp?.error ?? 'Test run failed to start');
                setState('error');
            }
            // Completion is reported via the mesh-test:progress 'complete' event above.
        }
        catch (e) {
            setErrorMsg(String(e));
            setState('error');
        }
    }, [mode, substrateEnabled, maxTotalQuestions, plowEnabled, plowAndonEnabled, researchArmMode, researchArmMeshSynergy, researchArmDecompose, fullPresetSelected, federatedSubstrateEnabled]);
    // BP140-K6 REQUIREMENT 1/2/3: fires a run scoped to an EXACT question_id set via the SAME
    // IPC channel (meshTestRunOneClick) as handleRun above, with questionIds populated. Reuses
    // the panel's current mode/substrate/plow toggles (the config a Founder is actively looking
    // at) but deliberately omits maxTotalQuestions/exactPerCategory -- the main-process runner
    // gives an explicit questionIds list priority over both (see one_click_mmlu_pro.ts's
    // questionIds JSDoc), so passing them here would be dead weight, not a real override.
    const handleRunSubset = useCallback(async (questionIds) => {
        if (questionIds.length === 0)
            return;
        setState('running');
        setErrorMsg(null);
        setPeersDiscovered(null);
        try {
            const resp = await window.amplify?.meshTestRunOneClick?.({
                mode,
                substrateEnabled,
                plowEnabled,
                plowAndonEnabled,
                researchArmMode,
                researchArmMeshSynergy,
                researchArmDecompose,
                federatedSubstrateEnabled,
                questionIds,
            });
            if (!resp?.ok) {
                setErrorMsg(resp?.error ?? 'Subset run failed to start');
                setState('error');
            }
            // Completion is reported via the mesh-test:progress 'complete' event above -- same as
            // handleRun, except payload.result.isSubsetRun routes it to LS_LAST_SUBSET_RESULT there.
        }
        catch (e) {
            setErrorMsg(String(e));
            setState('error');
        }
    }, [mode, substrateEnabled, plowEnabled, plowAndonEnabled, researchArmMode, researchArmMeshSynergy, researchArmDecompose, federatedSubstrateEnabled]);
    // BP140-K6 REQUIREMENT 2: "Re-run misses (N)" -- collects question_id from every outcome in
    // the CURRENTLY DISPLAYED result where isCorrect === false, then fires handleRunSubset with
    // exactly that set.
    const handleRerunMisses = useCallback(() => {
        const missedIds = (result?.outcomes ?? [])
            .filter((o) => o.isCorrect === false)
            .map((o) => String(o.question_id));
        void handleRunSubset(missedIds);
    }, [result, handleRunSubset]);
    // BP140-K6 REQUIREMENT 3: parses the manual subset input -- comma-separated question IDs OR
    // 1-based positions. A token is treated as a position (resolved against the outcome list
    // currently on screen -- the same "dataset" the Founder is looking at, result.outcomes,
    // falling back to the still-growing liveOutcomes mid-run) when it is ALL digits (no letters/
    // punctuation); otherwise it's treated as a literal question_id string verbatim. Whitespace
    // around commas is stripped. Positions with no matching outcome (out of range) are silently
    // dropped -- an honest "resolved N of M tokens" outcome, matching filterQuestionsByIds'
    // own dataset-side exact-match-or-drop convention in one_click_mmlu_pro.ts.
    const parseSubsetInput = useCallback((raw) => {
        const sourceOutcomes = result?.outcomes ?? liveOutcomes;
        const ids = [];
        for (const rawToken of raw.split(',')) {
            const token = rawToken.trim();
            if (!token)
                continue;
            if (/^\d+$/.test(token)) {
                const position = parseInt(token, 10);
                const outcome = sourceOutcomes[position - 1];
                if (outcome)
                    ids.push(String(outcome.question_id));
            }
            else {
                ids.push(token);
            }
        }
        return ids;
    }, [result, liveOutcomes]);
    const handleRunSubsetClick = useCallback(() => {
        const ids = parseSubsetInput(subsetInput);
        void handleRunSubset(ids);
    }, [subsetInput, parseSubsetInput, handleRunSubset]);
    // BP138 Yoke: 'mesh-test:hotcold-progress' listener -- a dedicated channel (see
    // one_click_mmlu_pro.ts's opts.progressChannel) so a lift run's two inner
    // runOneClickMmluProTest() calls never emit onto 'mesh-test:progress' and disturb the
    // standalone single-run state/effect above.
    useEffect(() => {
        const unsub = window.amplify?.onMeshTestHotColdProgress?.((payload) => {
            if (payload.type === 'arm-start') {
                setLiftArm(payload.arm);
                setLiftDoneCount(0);
                setLiftTotal(0);
                setLiftPeersDiscovered(null);
            }
            else if (payload.type === 'start') {
                setLiftTotal(payload.total);
                setLiftDoneCount(0);
            }
            else if (payload.type === 'peers-discovered') {
                setLiftPeersDiscovered(payload.count);
            }
            else if (payload.type === 'question-complete') {
                setLiftDoneCount(payload.index + 1);
            }
            else if (payload.type === 'complete' || payload.type === 'cancelled') {
                setLiftResult(payload.result);
                setLiftArm(null);
                setLiftState('complete');
                try {
                    localStorage.setItem(LS_LAST_LIFT_RESULT, JSON.stringify(payload.result));
                }
                catch { /* non-fatal */ }
            }
        });
        return () => unsub?.();
    }, []);
    const handleRunLift = useCallback(async () => {
        setLiftState('running');
        setLiftErrorMsg(null);
        setLiftArm(null);
        setLiftPeersDiscovered(null);
        try {
            // Same config shape/values as "Run the Test" above -- this IS the HOT arm's exact
            // config. The main-process handler runs a COLD arm first with substrate/plow forced
            // off using this same mode/question-count, then this exact config unmodified as HOT.
            const resp = await window.amplify?.meshTestRunHotColdLift?.({
                mode,
                substrateEnabled,
                maxTotalQuestions,
                plowEnabled,
                plowAndonEnabled,
                researchArmMode,
                researchArmMeshSynergy,
                exactPerCategory: fullPresetSelected ? 5 : undefined,
                federatedSubstrateEnabled,
            });
            if (!resp?.ok) {
                setLiftErrorMsg(resp?.error ?? 'HOT/COLD lift run failed to start');
                setLiftState('error');
            }
            // Completion is reported via the mesh-test:hotcold-progress 'complete' event above.
        }
        catch (e) {
            setLiftErrorMsg(String(e));
            setLiftState('error');
        }
    }, [mode, substrateEnabled, maxTotalQuestions, plowEnabled, plowAndonEnabled, researchArmMode, researchArmMeshSynergy, fullPresetSelected, federatedSubstrateEnabled]);
    // BP138 Phase 1: Answer Coroner -- run autopsy over existing benchmark data in Supabase
    // (the 500-row WAN relay_route_replies dump, across ALL peers/sessions ever recorded).
    const handleRunCoroner = useCallback(async () => {
        setCoronerState('running');
        setCoronerLog([]);
        setCoronerRoundup(null);
        setCoronerError(null);
        setCoronerSource('wan');
        // subscribe to progress messages
        const unsub = window.amplify?.onCoronerProgress?.((msg) => {
            setCoronerLog((prev) => [...prev.slice(-199), msg]);
        });
        try {
            const resp = await window.amplify?.runAnswerCoroner?.({ limit: 500 });
            if (resp?.ok) {
                setCoronerRoundup(resp.roundup);
                setCoronerState('done');
            }
            else {
                setCoronerError(resp?.error ?? 'Coroner failed');
                setCoronerState('error');
            }
        }
        catch (e) {
            setCoronerError(String(e));
            setCoronerState('error');
        }
        finally {
            unsub?.();
        }
    }, []);
    // BP139 Founder Yoke: Answer Coroner over the CURRENT run's own outcomes -- the benchmark
    // the Founder JUST ran (or a loaded receipt), not the old 500-row WAN dump. No network call;
    // classifies result.outcomes (falls back to liveOutcomes if a run is still in flight) via
    // the same classifyCore(...) the WAN path uses (answer_coroner.ts), so the classification
    // rules are identical, only the data source differs.
    const handleRunCoronerLocal = useCallback(async () => {
        const outcomes = (result?.outcomes && result.outcomes.length > 0) ? result.outcomes : liveOutcomes;
        if (!outcomes || outcomes.length === 0) {
            setCoronerError('No run outcomes to classify yet -- run the test (or load a receipt) first.');
            setCoronerState('error');
            setCoronerSource('local');
            return;
        }
        setCoronerState('running');
        setCoronerLog([]);
        setCoronerRoundup(null);
        setCoronerError(null);
        setCoronerSource('local');
        const unsub = window.amplify?.onCoronerProgress?.((msg) => {
            setCoronerLog((prev) => [...prev.slice(-199), msg]);
        });
        try {
            const resp = await window.amplify?.runAnswerCoronerOnLocalOutcomes?.({
                outcomes: outcomes.map((o) => ({
                    question_id: o.question_id,
                    question: o.question,
                    category: o.category,
                    correctLetter: o.correctLetter,
                    parsedLetter: o.parsedLetter,
                    isCorrect: o.isCorrect,
                    isAbstain: o.isAbstain,
                    answeredBy: o.answeredBy ?? null,
                    peerId: o.peerId ?? null,
                    machineLabel: o.machineLabel ?? null,
                    latencyMs: o.latencyMs ?? null,
                    plowTrace: o.plowTrace ?? null,
                })),
            });
            if (resp?.ok) {
                setCoronerRoundup(resp.roundup);
                setCoronerState('done');
            }
            else {
                setCoronerError(resp?.error ?? 'Coroner failed');
                setCoronerState('error');
            }
        }
        catch (e) {
            setCoronerError(String(e));
            setCoronerState('error');
        }
        finally {
            unsub?.();
        }
    }, [result, liveOutcomes]);
    const runningAccuracy = liveOutcomes.length > 0
        ? liveOutcomes.filter((o) => o.isCorrect).length / liveOutcomes.length
        : null;
    // BP139 Founder Yoke: the per-question feed to render -- growing liveOutcomes while a run is
    // in flight, otherwise the persisted/loaded result's own outcomes (falls back to liveOutcomes
    // so a still-classifying error state right after a run doesn't blank the list).
    const displayOutcomes = state === 'running' ? liveOutcomes : (result?.outcomes ?? liveOutcomes);
    const modeButton = (choice, label) => (_jsx("button", { onClick: () => { setMode(choice); setRecommendedDefaultsApplied(false); }, disabled: busy, style: {
            background: mode === choice ? '#10b981' : 'transparent',
            color: mode === choice ? '#0d1117' : '#94a3b8',
            border: `1px solid ${mode === choice ? '#10b981' : '#1e2a38'}`,
            borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600,
            cursor: busy ? 'default' : 'pointer', fontFamily: 'system-ui, sans-serif',
        }, children: label }));
    return (_jsxs("div", { style: {
            background: '#0d1117',
            border: '1px solid #1e2a38',
            borderRadius: 10,
            padding: 16,
            fontFamily: 'system-ui, -apple-system, sans-serif',
        }, children: [_jsx("div", { style: { fontSize: 14, fontWeight: 700, color: '#f0fdf4', marginBottom: 4 }, children: "\uD83E\uDDEA Sourced-Knowledge Benchmark (MMLU-Pro format, with provenance)" }), _jsx("div", { style: { fontSize: 11, color: '#64748b', marginBottom: 6, lineHeight: 1.5 }, children: "Runs real multiple-choice questions with known correct answers and scores every answer live -- no fabricated numbers." }), customizeOpen && (_jsxs("div", { style: {
                    fontSize: 10, color: '#94a3b8', marginBottom: 10, lineHeight: 1.6,
                    background: 'rgba(110,231,183,0.05)', border: '1px solid rgba(110,231,183,0.15)',
                    borderRadius: 6, padding: '6px 10px',
                }, children: ["This is a ", _jsx("b", { style: { color: '#6ee7b7' }, children: "sourced-knowledge" }), " claim, not a reasoning claim: \"12-Blade Column Plow\" mode (checkbox below, works in Local or WAN Mesh) answers by fetching facts from named independent authorities (Wikipedia, arXiv, OpenAlex, PubMed, browser-authority Google/Perplexity, etc.) and shows a receipt under each answer. Without Plow, the model answers from its own knowledge with no receipt -- those answers are shown but are never counted as substrate-sourced (see the headline below)."] })), _jsx("button", { onClick: applyRecommendedDefaults, disabled: busy, style: {
                    display: 'block', width: '100%',
                    background: recommendedDefaultsApplied ? '#10b981' : 'transparent',
                    color: recommendedDefaultsApplied ? '#0d1117' : '#facc15',
                    border: `2px solid ${recommendedDefaultsApplied ? '#10b981' : '#facc15'}`,
                    borderRadius: 8, padding: '12px 16px', fontSize: 14, fontWeight: 800,
                    cursor: busy ? 'default' : 'pointer', fontFamily: 'system-ui, sans-serif',
                    marginBottom: 6,
                }, children: recommendedDefaultsApplied ? '\u2713 Recommended Defaults (ready to run)' : '\u21BA Back to Recommended Defaults' }), !recommendedDefaultsApplied && (_jsx("div", { style: { fontSize: 11, color: '#facc15', marginBottom: 8, textAlign: 'center' }, children: "Custom configuration -- click above to return to the known-good recommended setup." })), _jsxs("button", { onClick: () => setCustomizeOpen((v) => !v), style: {
                    background: 'none', border: 'none', color: '#94a3b8', fontSize: 11, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'system-ui, sans-serif', padding: 0, marginBottom: 10,
                    display: 'block',
                }, children: [customizeOpen ? '\u25BC' : '\u25B6', " ", customizeOpen ? 'Hide' : 'Show', " what this does / Customize"] }), customizeOpen && (_jsxs("div", { style: {
                    fontSize: 10, color: '#94a3b8', marginBottom: 10, lineHeight: 1.6,
                    background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)',
                    borderRadius: 6, padding: '8px 10px',
                }, children: [_jsx("b", { style: { color: '#6ee7b7' }, children: "Recommended" }), " = Substrate ON + 12-Blade Plow ON + Research Arm ON + Andon retry loop ON (Condition C) + 20 questions, run locally on this machine. This is the exact setup that produced 18 correct out of 20 in the reference run -- stated here so it is inspectable, not magic."] })), customizeOpen && (_jsxs(_Fragment, { children: [_jsxs("div", { style: { display: 'flex', gap: 6, marginBottom: 12 }, children: [modeButton('auto', 'Auto (WAN if live)'), modeButton('wan_mesh', 'WAN Mesh only'), modeButton('local_ollama', 'Local -- full plow (this machine)')] }), mode === 'local_ollama' && (_jsx("div", { style: { fontSize: 10, color: '#475569', marginBottom: 10, marginTop: -6 }, children: "Local mode now runs the full plow (Research Arm, Browser Authority, Decompose) on this machine using your own signed-in Perplexity + Google sessions -- no WAN peers required. Mesh Synergy and federated substrate stay WAN-only below." })), _jsxs("label", { style: {
                            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
                            fontSize: 12, color: '#94a3b8', cursor: busy ? 'default' : 'pointer',
                            fontFamily: 'system-ui, sans-serif',
                        }, children: [_jsx("input", { type: "checkbox", checked: substrateEnabled, disabled: busy, onChange: (e) => { setSubstrateEnabled(e.target.checked); setFullPresetSelected(false); setRecommendedDefaultsApplied(false); } }), "Substrate context ", substrateEnabled ? 'ON' : 'OFF', _jsx("span", { style: { color: '#475569', fontSize: 10 }, children: "(ON injects related topical eblets into the prompt; OFF sends the bare question, no substrate call is made at all)" })] }), _jsx("div", { style: { fontSize: 10, color: '#64748b', marginBottom: 10, marginLeft: 22, marginTop: -6 }, children: "Plain English: gives the AI background notes on the topic before it answers." }), _jsxs("label", { style: {
                            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
                            fontSize: 12, color: '#94a3b8',
                            cursor: busy ? 'default' : 'pointer',
                            fontFamily: 'system-ui, sans-serif',
                        }, children: [_jsx("input", { type: "checkbox", checked: plowEnabled, disabled: busy, onChange: (e) => { setPlowEnabled(e.target.checked); setFullPresetSelected(false); setRecommendedDefaultsApplied(false); } }), "12-Blade Column Plow ", plowEnabled ? 'ON' : 'OFF', _jsx("span", { style: { color: '#475569', fontSize: 10 }, children: "(ON: the answering machine -- this machine in Local mode, the responding peer in WAN Mesh mode -- runs the full specialist-swarm + Miner/Saladin/Furnace pipeline instead of a single Ollama call. Slower; WAN Mesh per-question timeout auto-raised to 5min)" })] }), _jsx("div", { style: { fontSize: 10, color: '#64748b', marginBottom: 6, marginLeft: 22, marginTop: -4 }, children: "Plain English: checks the answer against many independent fact-finding methods instead of trusting one guess." }), plowEnabled && (_jsxs("label", { style: {
                            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, marginLeft: 20,
                            fontSize: 12, color: '#94a3b8', cursor: busy ? 'default' : 'pointer',
                            fontFamily: 'system-ui, sans-serif',
                        }, children: [_jsx("input", { type: "checkbox", checked: plowAndonEnabled, disabled: busy, onChange: (e) => { setPlowAndonEnabled(e.target.checked); setFullPresetSelected(false); setRecommendedDefaultsApplied(false); } }), "Andon retry loop ", plowAndonEnabled ? 'ON (Condition C)' : 'OFF (Condition B, single pass)'] })), plowEnabled && (_jsx("div", { style: { fontSize: 10, color: '#64748b', marginBottom: 6, marginLeft: 42, marginTop: -4 }, children: "Plain English: if the independent checks disagree, tries again automatically instead of giving up." })), plowEnabled && (_jsxs("label", { style: {
                            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, marginLeft: 20,
                            fontSize: 12, color: '#94a3b8', cursor: busy ? 'default' : 'pointer',
                            fontFamily: 'system-ui, sans-serif',
                        }, children: [_jsx("input", { type: "checkbox", checked: researchArmMode, disabled: busy, onChange: (e) => { setResearchArmMode(e.target.checked); setFullPresetSelected(false); setRecommendedDefaultsApplied(false); } }), "Research Arm (Stage A.0+A) ", researchArmMode ? 'ON' : 'OFF', _jsx("span", { style: { color: '#475569', fontSize: 10 }, children: "(ON: relevance gate moved upstream of the MC voters -- abstains rather than voting on off-topic sources -- plus a classifier + deterministic compute sidecar for computable questions. Also enables Google/Perplexity/Claude/ChatGPT/Gemini browser authorities, subject to each one's own enable toggle in Settings > Authorities. KN-BP144-3: this checkbox is the SAME Research Arm switch as Settings > Nexus Authority -- changing it here changes it there too, and vice versa.)" })] })), plowEnabled && researchArmMode && (_jsx("div", { style: { fontSize: 10, color: '#64748b', marginBottom: 6, marginLeft: 42, marginTop: -4 }, children: "Plain English: adds a math/logic solver that can prove some answers outright, and skips questions it cannot verify instead of guessing." })), plowEnabled && researchArmMode && (() => {
                        const meshSynergyGated = busy || mode !== 'wan_mesh';
                        return (_jsxs("label", { style: {
                                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, marginLeft: 20,
                                fontSize: 12, color: meshSynergyGated ? '#475569' : '#94a3b8',
                                cursor: meshSynergyGated ? 'default' : 'pointer',
                                fontFamily: 'system-ui, sans-serif',
                            }, children: [_jsx("input", { type: "checkbox", checked: researchArmMeshSynergy, disabled: meshSynergyGated, onChange: (e) => { setResearchArmMeshSynergy(e.target.checked); setFullPresetSelected(false); setRecommendedDefaultsApplied(false); } }), "Mesh Synergy ", researchArmMeshSynergy ? 'ON' : 'OFF', " (requires 2+ peers)", _jsx("span", { style: { color: '#475569', fontSize: 10 }, children: "(ON: distributes DIFFERENT authorities -- Google/Perplexity/swarm -- round-robin across live WAN peers for the SAME question, then pools their answers, instead of every peer redundantly running the identical full plow. WAN Mesh mode only.)" })] }));
                    })(), plowEnabled && researchArmMode && (_jsx("div", { style: { fontSize: 10, color: '#64748b', marginBottom: 6, marginLeft: 42, marginTop: -4 }, children: "Plain English: splits the fact-finding work across multiple connected computers running at once (only works with 2+ connected computers)." })), plowEnabled && researchArmMode && (_jsxs("label", { style: {
                            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, marginLeft: 20,
                            fontSize: 12, color: busy ? '#475569' : '#94a3b8',
                            cursor: busy ? 'default' : 'pointer',
                            fontFamily: 'system-ui, sans-serif',
                        }, children: [_jsx("input", { type: "checkbox", checked: researchArmDecompose, disabled: busy, onChange: (e) => { setResearchArmDecompose(e.target.checked); setFullPresetSelected(false); setRecommendedDefaultsApplied(false); } }), "Decompose+Eliminate ", researchArmDecompose ? 'ON' : 'OFF', _jsx("span", { style: { color: '#475569', fontSize: 10 }, children: "(ON: breaks each option into an atomic foundation-fact query, verifies it via browser authority, and eliminates options whose fact verifies false -- deterministic conclude or honest abstain. Requires Plow + Research Arm; works in both Local and WAN Mesh mode. BP138 Phase 2.)" })] })), plowEnabled && researchArmMode && (_jsx("div", { style: { fontSize: 10, color: '#64748b', marginBottom: 6, marginLeft: 42, marginTop: -4 }, children: "Plain English: breaks a question into smaller facts, checks each one, and rules out wrong choices one at a time." })), (() => {
                        const federatedGated = busy || mode !== 'wan_mesh' || !substrateEnabled;
                        return (_jsxs("label", { style: {
                                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
                                fontSize: 12, color: federatedGated ? '#475569' : '#94a3b8',
                                cursor: federatedGated ? 'default' : 'pointer',
                                fontFamily: 'system-ui, sans-serif',
                            }, children: [_jsx("input", { type: "checkbox", checked: federatedSubstrateEnabled, disabled: federatedGated, onChange: (e) => { setFederatedSubstrateEnabled(e.target.checked); setFullPresetSelected(false); setRecommendedDefaultsApplied(false); } }), "Federated substrate (pool eblets across peers) ", federatedSubstrateEnabled ? 'ON' : 'OFF', _jsx("span", { style: { color: '#475569', fontSize: 10 }, children: "(WAN Mesh + Substrate ON only. ON: pools topical eblets from every live peer into one shared index before each question, instead of each peer using only its own local substrate. Requires all peers on 0.9.5.)" })] }));
                    })(), _jsx("div", { style: { fontSize: 10, color: '#64748b', marginBottom: 10, marginLeft: 22, marginTop: -6 }, children: "Plain English: shares background notes across all connected computers instead of each one working alone." }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }, children: [_jsx("span", { style: { fontSize: 11, color: '#64748b' }, children: "Questions:" }), [3, 10, 20, 50].map((n) => (_jsx("button", { onClick: () => { setMaxTotalQuestions(n); setFullPresetSelected(false); setRecommendedDefaultsApplied(false); }, disabled: busy, style: {
                                    background: !fullPresetSelected && maxTotalQuestions === n ? '#10b981' : 'transparent',
                                    color: !fullPresetSelected && maxTotalQuestions === n ? '#0d1117' : '#94a3b8',
                                    border: `1px solid ${!fullPresetSelected && maxTotalQuestions === n ? '#10b981' : '#1e2a38'}`,
                                    borderRadius: 6, padding: '3px 9px', fontSize: 11, fontWeight: 600,
                                    cursor: busy ? 'default' : 'pointer', fontFamily: 'system-ui, sans-serif',
                                }, children: n }, n))), _jsx("input", { type: "number", min: 1, max: 500, value: maxTotalQuestions, disabled: busy, onChange: (e) => {
                                    const v = parseInt(e.target.value, 10);
                                    if (!Number.isNaN(v) && v > 0) {
                                        setMaxTotalQuestions(v);
                                        setFullPresetSelected(false);
                                        setRecommendedDefaultsApplied(false);
                                    }
                                }, style: {
                                    width: 52, background: '#0d1117', border: '1px solid #1e2a38', borderRadius: 6,
                                    color: '#e2e8f0', fontSize: 11, padding: '3px 6px', fontFamily: 'system-ui, sans-serif',
                                } })] }), _jsxs("div", { style: { marginBottom: 12 }, children: [_jsx("button", { onClick: () => {
                                    setMaxTotalQuestions(70);
                                    setSubstrateEnabled(true);
                                    setPlowEnabled(true);
                                    setPlowAndonEnabled(true);
                                    setMode('auto');
                                    setFullPresetSelected(true);
                                    setRecommendedDefaultsApplied(false);
                                }, disabled: busy, style: {
                                    background: fullPresetSelected ? '#facc15' : 'transparent',
                                    color: fullPresetSelected ? '#0d1117' : '#facc15',
                                    border: `1px solid ${fullPresetSelected ? '#facc15' : '#4d3a0a'}`,
                                    borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700,
                                    cursor: busy ? 'default' : 'pointer', fontFamily: 'system-ui, sans-serif',
                                }, children: "\u26A1 70 \u2014 Full 14x5 MMLU-Pro" }), _jsx("span", { style: { marginLeft: 8, fontSize: 10, color: '#475569' }, children: "(exactly 5 questions from EACH of the 14 categories, substrate+plow+Andon forced ON -- run this AFTER seeding the Chocolate Pack to see \"hot\" differ from \"cold\")" })] })] })), state !== 'running' && (_jsx("button", { onClick: () => void handleRun(), disabled: busy, style: {
                    background: '#10b981', color: '#fff', border: 'none', borderRadius: 6,
                    padding: '8px 16px', fontSize: 13, fontWeight: 700,
                    cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
                    fontFamily: 'system-ui, sans-serif', marginRight: 8,
                }, children: "\u25B6 Run the Test" })), liftState !== 'running' && (_jsx("button", { onClick: () => void handleRunLift(), disabled: busy, title: "Runs the same question set twice: once with substrate+plow OFF (COLD baseline), once with your current toggles above (HOT) -- then shows the lift.", style: {
                    background: 'transparent', color: '#facc15', border: '1px solid #4d3a0a', borderRadius: 6,
                    padding: '8px 16px', fontSize: 13, fontWeight: 700,
                    cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
                    fontFamily: 'system-ui, sans-serif',
                }, children: "\uD83D\uDD25\u2744\uFE0F Run HOT/COLD Lift" })), liftState === 'running' && (_jsxs("div", { style: { marginTop: 8 }, children: [_jsxs("div", { style: { fontSize: 12, color: '#facc15', animation: 'mnemo-pulse 1.5s ease-in-out infinite' }, children: ["\u25CC Running ", liftArm === 'cold' ? 'COLD' : liftArm === 'hot' ? 'HOT' : '...', " arm", liftPeersDiscovered !== null && liftPeersDiscovered > 0
                                ? ` — ${liftPeersDiscovered} live peer(s)`
                                : liftPeersDiscovered === 0 ? ' — no live peers, running locally' : '', liftTotal > 0 && ` — question ${liftDoneCount}/${liftTotal}`] }), _jsx("div", { style: { fontSize: 10, color: '#64748b', marginTop: 2 }, children: liftArm === 'cold'
                            ? 'COLD baseline: substrate+plow forced OFF, everything else identical to your current settings'
                            : liftArm === 'hot'
                                ? 'HOT: your current settings above, unmodified'
                                : '' })] })), liftState === 'error' && (_jsxs("div", { style: { fontSize: 12, color: '#f87171', marginTop: 8 }, children: ["\u2717 ", liftErrorMsg] })), (liftState === 'complete' || (liftState === 'idle' && liftResult)) && liftResult && (_jsxs("div", { style: {
                    marginTop: 12, background: '#111827', border: '1px solid #4d3a0a', borderRadius: 8,
                    padding: '10px 14px',
                }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 700, color: '#facc15', marginBottom: 6 }, children: "\uD83D\uDD25\u2744\uFE0F HOT/COLD Lift" }), liftResult.hotScored === 0 && liftResult.cancelled ? (_jsx("div", { style: { fontSize: 12, color: '#facc15' }, children: "Stopped during the COLD arm \u2014 no HOT run was attempted, no lift to report." })) : (_jsxs(_Fragment, { children: [_jsxs("div", { style: { fontSize: 15, fontWeight: 700, color: '#e2e8f0' }, children: ["COLD ", liftResult.coldAccuracy != null ? `${(liftResult.coldAccuracy * 100).toFixed(0)}%` : 'n/a', ' / ', "HOT ", liftResult.hotAccuracy != null ? `${(liftResult.hotAccuracy * 100).toFixed(0)}%` : 'n/a', ' / ', "LIFT ", liftResult.liftPp != null
                                        ? `${liftResult.liftPp >= 0 ? '+' : ''}${liftResult.liftPp.toFixed(1)}pp`
                                        : 'n/a', _jsxs("span", { style: { fontSize: 11, color: '#94a3b8', fontWeight: 400, marginLeft: 6 }, children: ["(n=", liftResult.n, ")"] })] }), _jsxs("div", { style: { fontSize: 10, color: '#64748b', marginTop: 5 }, children: ["COLD: ", _jsx("span", { style: { color: '#94a3b8' }, children: liftResult.coldLabel }), ' — ', liftResult.coldCorrect, "/", liftResult.coldScored, " scored correct"] }), _jsxs("div", { style: { fontSize: 10, color: '#64748b' }, children: ["HOT: ", _jsx("span", { style: { color: '#94a3b8' }, children: liftResult.hotLabel }), ' — ', liftResult.hotCorrect, "/", liftResult.hotScored, " scored correct"] }), liftResult.cancelled && (_jsx("div", { style: { fontSize: 10, color: '#facc15', marginTop: 4 }, children: "\u26A0 HOT arm was stopped early (cancelled) \u2014 numbers above reflect only the questions answered before stop." })), liftResult.belowMinN && (_jsxs("div", { style: { fontSize: 10, color: '#facc15', marginTop: 4 }, children: ["\u26A0 n=", liftResult.n, " is below this app's ", liftResult.minMeaningfulN, "-question floor for a meaningful lift number \u2014 treat this delta as noisy, not conclusive. Re-run with more questions for a trustworthy result."] }))] }))] })), state === 'running' && (_jsxs("div", { style: { fontSize: 12, color: '#6ee7b7', marginBottom: 8, animation: 'mnemo-pulse 1.5s ease-in-out infinite' }, children: ["\u25CC ", peersDiscovered !== null && peersDiscovered > 0
                        ? `${peersDiscovered} live peer(s) — `
                        : peersDiscovered === 0 ? 'no live peers — running locally — ' : '', "Question ", doneCount, "/", total || '?', runningAccuracy !== null && (_jsxs("span", { style: { marginLeft: 10, color: '#94a3b8' }, children: ["running accuracy: ", (runningAccuracy * 100).toFixed(0), "%"] }))] })), state !== 'running' && result && (_jsxs("div", { style: {
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: 8, flexWrap: 'wrap', gap: 6,
                }, children: [_jsx("div", { style: { fontSize: 11, color: '#64748b' }, children: loadedReceiptName
                            ? _jsxs(_Fragment, { children: ["\uD83D\uDCC4 Loaded receipt: ", _jsx("span", { style: { color: '#94a3b8' }, children: loadedReceiptName })] })
                            : _jsxs(_Fragment, { children: ["Last run finished ", new Date(result.completedAt).toLocaleString(), " \u2014 stays visible until a new run starts or you clear it."] }) }), _jsx("button", { onClick: handleClearResults, disabled: busy, style: {
                            background: 'none', color: '#f87171', border: '1px solid #4b1f1f', borderRadius: 6,
                            padding: '3px 10px', fontSize: 10, fontWeight: 600,
                            cursor: busy ? 'default' : 'pointer', fontFamily: 'system-ui, sans-serif',
                        }, children: "\uD83D\uDDD1 Clear results" })] })), state !== 'running' && result && (_jsxs("div", { style: {
                    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap',
                }, children: [result.outcomes.filter((o) => o.isCorrect === false).length > 0 && (_jsxs("button", { onClick: () => void handleRerunMisses(), disabled: busy, title: "Re-runs only the questions this result got wrong, via the same IPC channel, scoped by question_id -- never a full re-run.", style: {
                            background: 'transparent', color: '#fca5a5', border: '1px solid #4b1f1f', borderRadius: 6,
                            padding: '5px 12px', fontSize: 11, fontWeight: 700,
                            cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
                            fontFamily: 'system-ui, sans-serif',
                        }, children: ["\u21BB Re-run misses (", result.outcomes.filter((o) => o.isCorrect === false).length, ")"] })), _jsx("input", { type: "text", value: subsetInput, disabled: busy, onChange: (e) => setSubsetInput(e.target.value), placeholder: "e.g. 6, 13, 14, 15, 16", title: "Comma-separated question IDs or 1-based positions in the list below. Pure-digit tokens resolve to a position; anything else is treated as a literal question_id.", style: {
                            flex: '1 1 220px', minWidth: 160, background: '#0d1117', border: '1px solid #1e2a38',
                            borderRadius: 6, color: '#e2e8f0', fontSize: 11, padding: '5px 8px',
                            fontFamily: 'system-ui, sans-serif',
                        } }), _jsx("button", { onClick: handleRunSubsetClick, disabled: busy || subsetInput.trim().length === 0, title: "Runs exactly the parsed subset of question IDs/positions above, via the same IPC channel.", style: {
                            background: 'transparent', color: '#93c5fd', border: '1px solid #1e3a5f', borderRadius: 6,
                            padding: '5px 12px', fontSize: 11, fontWeight: 700,
                            cursor: (busy || subsetInput.trim().length === 0) ? 'default' : 'pointer',
                            opacity: (busy || subsetInput.trim().length === 0) ? 0.6 : 1,
                            fontFamily: 'system-ui, sans-serif',
                        }, children: "\u25B6 Run subset" })] })), displayOutcomes.length > 0 && (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: state === 'running' ? 0 : 10 }, children: [_jsx("div", { style: {
                            fontSize: 10, color: '#64748b', marginBottom: 4, lineHeight: 1.6,
                            display: 'flex', flexWrap: 'wrap', gap: 10,
                        }, children: DEMO_DISPLAY_LEGEND.map((l) => (_jsxs("span", { children: [_jsx("strong", { style: { color: '#94a3b8' }, children: l.label }), ": ", l.description] }, l.displayClass))) }), displayOutcomes.map((o, i) => (_jsxs("div", { children: [_jsxs("div", { style: { fontSize: 11, color: o.isCorrect ? '#4ade80' : '#f87171', display: 'flex', gap: 8, alignItems: 'center' }, children: [_jsx("span", { children: o.isCorrect ? '✓' : o.timedOut ? '⏱' : o.isAbstain ? '·' : '✗' }), _jsx(DemoDisplayBadge, { outcome: o }), o.machineLabel && _jsxs("span", { style: { color: '#38bdf8' }, children: ["[", o.machineLabel, "]"] }), o.answeredBy === 'plow' && _jsx("span", { style: { color: '#facc15' }, children: "[plow]" }), _jsxs("span", { style: { color: '#64748b' }, children: ["[", o.category, "]"] }), _jsx("span", { style: { color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: o.question })] }), _jsx(ProvenanceReceiptRow, { outcome: o })] }, `${o.question_id}-${o.peerId ?? 'local'}-${i}`)))] })), state === 'error' && (_jsxs("div", { style: { fontSize: 12, color: '#f87171', marginTop: 8 }, children: ["\u2717 ", errorMsg] })), result && (_jsx("div", { style: { marginTop: 4 }, children: _jsx(MeshTestResultSummary, { result: result, onShareResult: onShareResult }) })), _jsx("div", { style: { marginTop: 10 }, children: _jsxs("label", { style: {
                        display: 'inline-block', fontSize: 11, color: '#93c5fd', border: '1px solid #1e3a5f',
                        borderRadius: 6, padding: '6px 12px', cursor: busy ? 'default' : 'pointer',
                        fontFamily: 'system-ui, sans-serif', opacity: busy ? 0.6 : 1,
                    }, children: ["\uD83D\uDCC2 Load a receipt (.json)", _jsx("input", { type: "file", accept: "application/json,.json", onChange: handleLoadReceiptFile, disabled: busy, style: { display: 'none' } })] }) }), pioneerBonus.visible && (_jsx(PioneerBonusModal, { modelName: pioneerBonus.modelName, position: pioneerBonus.position, multiplier: pioneerBonus.multiplier, label: pioneerBonus.label, onDismiss: () => setPioneerBonus((s) => ({ ...s, visible: false })) })), customizeOpen && (_jsx("div", { style: { fontSize: 10, color: '#334155', marginTop: 12, lineHeight: 1.5 }, children: "Scope note: \"Auto\" picks WAN mesh dispatch when live peers are online (via the relay_routes/relay_route_replies bus, Supabase-relayed, never a raw LAN IP) and falls back to local Ollama otherwise. Live multi-peer verification of this exact flow is still pending Bishop/Founder confirming 2 or more peers online -- see Yoke #23 Bishop handoff." })), _jsxs("div", { style: { marginTop: 18, borderTop: '1px solid #1e2a38', paddingTop: 14 }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 8 }, children: "Answer Coroner -- autopsy, real classifier, no fabricated numbers" }), _jsxs("div", { style: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }, children: [_jsx("button", { onClick: () => void handleRunCoronerLocal(), disabled: coronerState === 'running' || busy || displayOutcomes.length === 0, title: displayOutcomes.length === 0 ? 'Run the test (or load a receipt) first' : 'Classify the outcomes shown above -- no network call', style: {
                                    background: coronerState === 'running' ? '#1e2a38' : '#6d28d9',
                                    color: '#f5f3ff', border: 'none', borderRadius: 6,
                                    padding: '5px 14px', fontSize: 11, fontWeight: 700,
                                    cursor: (coronerState === 'running' || busy || displayOutcomes.length === 0) ? 'default' : 'pointer',
                                    opacity: displayOutcomes.length === 0 ? 0.5 : 1,
                                    fontFamily: 'system-ui, sans-serif',
                                }, children: coronerState === 'running' && coronerSource === 'local' ? 'Classifying...' : `Run Coroner on this run (${displayOutcomes.length})` }), _jsx("button", { onClick: () => void handleRunCoroner(), disabled: coronerState === 'running' || busy, title: "Classifies up to 500 rows of ALL WAN benchmark history in Supabase, across every session ever recorded on this account -- not just the run shown above", style: {
                                    background: coronerState === 'running' ? '#1e2a38' : '#0f766e',
                                    color: '#e2e8f0', border: 'none', borderRadius: 6,
                                    padding: '5px 14px', fontSize: 11, fontWeight: 600,
                                    cursor: (coronerState === 'running' || busy) ? 'default' : 'pointer',
                                    fontFamily: 'system-ui, sans-serif',
                                }, children: coronerState === 'running' && coronerSource === 'wan' ? 'Running autopsy...' : 'Run Coroner on WAN history (500-row)' })] }), coronerState === 'running' && coronerLog.length > 0 && (_jsx("div", { style: {
                            background: '#0a0f17', border: '1px solid #1e2a38', borderRadius: 6,
                            padding: '6px 10px', maxHeight: 100, overflowY: 'auto',
                            fontSize: 10, color: '#64748b', fontFamily: 'monospace', marginBottom: 8,
                        }, children: coronerLog.slice(-10).map((msg, i) => _jsx("div", { children: msg }, i)) })), coronerError && (_jsxs("div", { style: { fontSize: 11, color: '#f87171', marginBottom: 8 }, children: ["Error: ", coronerError] })), coronerRoundup && (() => {
                        // Real CoronerRoundup shape (answer_coroner.ts / amplify.d.ts runAnswerCoroner) --
                        // NOT totalAnalyzed/classCounts/baselineSession, which never existed on this type.
                        const r = coronerRoundup;
                        return (_jsxs("div", { style: { fontSize: 11, color: '#94a3b8', lineHeight: 1.7 }, children: [_jsxs("div", { style: { marginBottom: 4 }, children: [_jsx("span", { style: {
                                                fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
                                                color: coronerSource === 'local' ? '#c4b5fd' : '#6ee7b7', marginRight: 8,
                                            }, children: coronerSource === 'local' ? 'source: this run' : 'source: WAN history (500-row)' }), _jsx("span", { style: { color: '#f0fdf4', fontWeight: 700 }, children: "Analyzed:" }), " ", r.totalRecords ?? '?', " answers"] }), _jsxs("div", { style: { display: 'flex', gap: 18, marginBottom: 8 }, children: [_jsxs("div", { children: [_jsx("span", { style: { color: '#f87171', fontWeight: 700 }, children: "Correctable wrongs:" }), ' ', _jsx("span", { style: { fontSize: 14, fontWeight: 800, color: '#fca5a5' }, children: r.correctableWrongs ?? '?' }), _jsx("span", { style: { color: '#475569', fontSize: 9 }, children: " -- drive to 0" })] }), _jsxs("div", { children: [_jsx("span", { style: { color: '#6ee7b7', fontWeight: 700 }, children: "Honest abstains:" }), ' ', _jsx("span", { style: { fontSize: 14, fontWeight: 800, color: '#a7f3d0' }, children: r.honestAbstains ?? '?' }), _jsx("span", { style: { color: '#475569', fontSize: 9 }, children: " -- leave honest" })] })] }), r.byClass && (_jsxs("div", { style: { marginBottom: 6 }, children: [_jsx("span", { style: { color: '#cbd5e1' }, children: "Class breakdown: " }), Object.entries(r.byClass).map(([cls, records]) => (_jsxs("span", { style: { marginRight: 8 }, children: [_jsxs("span", { style: { color: '#64748b' }, children: [cls, ": "] }), _jsx("span", { style: { color: '#e2e8f0', fontWeight: 600 }, children: records.length })] }, cls)))] })), r.prioritizedFixList && r.prioritizedFixList.length > 0 && (_jsxs("div", { children: [_jsx("div", { style: { color: '#cbd5e1', marginBottom: 2 }, children: "Prioritized fix list:" }), r.prioritizedFixList.slice(0, 5).map((item, i) => (_jsxs("div", { style: { marginLeft: 8, fontSize: 10, color: '#94a3b8' }, children: [i + 1, ". ", item.answerClass, " (", item.count, ")", item.exemplars && item.exemplars.length > 0 && (_jsx("div", { style: { marginLeft: 12, color: '#475569' }, children: item.exemplars.slice(0, 3).map((ex, j) => (_jsxs("div", { children: ["-- ", (ex.question ?? '').slice(0, 80), ' ', "[answered: ", ex.answeredLetter ?? '?', ", correct: ", ex.sealedLetter ?? '?', "]"] }, j))) }))] }, i)))] }))] }));
                    })()] })] }));
}
// ─── BP135 YOKE_35 Phase 3: Pioneer Bonus Modal ───────────────────────────────
// Ported verbatim (styling + copy) from GauntletTab.tsx's PioneerBonusModal, which is
// now unrouted -- see handleRealCompletionSideEffects above for the wiring change.
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
export default OneClickMeshTestPanel;
