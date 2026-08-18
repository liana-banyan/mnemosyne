// elements/banyan_metric_standard.ts -- E-BANYAN-METRIC-STANDARD -- D-BP152-035/BISHOP/seg-classify-method, STAGE 3/3
//
// A FAITHFUL PORT, NOT A NEW FORMULA. Founder, RULINGS_BP152.md FD-BP152-19: "That's what the
// Banyan Metric is for" (answering what makes a membership verdict "definitive"). This ticket's
// own instruction: "Read it and mirror its dimensions and weights exactly. Do NOT invent a
// scoring formula and do NOT rescale anything." The Standard, 10-dim, one-answer-to-one-question
// axis is already executable at:
//   C:\Users\Administrator\Documents\LianaBanyanPlatform\replication-kit\truth_single_bp076.py
//   :1010-1174 -- BANYAN_METRIC_DIMENSIONS, _compute_banyan_metric(), the band table in
//   _render_banyan_metric_block()'s own printed interpretation lines.
//
// CALLING THE PYTHON DIRECTLY FROM THIS METHOD (a `child_process` shell-out from Electron's main
// process, mid-Liana-Cycle-run, to a separate Python venv/toolchain this repo does not otherwise
// depend on) is impractical from this path -- stated plainly per this ticket's own fallback
// instruction. SO THIS FILE IS A PORT: every dimension name, target, weight, score_fn and band
// boundary below is copied from the Python file above, arithmetic-for-arithmetic, not rederived
// or rebalanced. Anywhere this file's TypeScript differs from the Python's exact behavior is
// called out in that dimension's own comment and is a labeled TARE, not a silent deviation.
//
// DIMENSIONS AND WEIGHTS, verbatim from truth_single_bp076.py:1010-1091 (10/5/10/15/15/10/5/15/5/10,
// sum 110): specialists_consulted(10) / eblets_gathered_raw(5) / derivative_pairs_collapsed(10) /
// independent_clusters_for_answer(15) / primary_text_present(15) / confidence_label_calibration(10)
// / stubbed_gap_acknowledged(5) / manual_llm_concordance(15) / wall_clock_latency_s(5) /
// anti_popularity_guardrails_count(10). Reference score at BP076/077: 71.1/100 MEDIUM.
//
// BANDS, verbatim from truth_single_bp076.py:1168-1172: 90-100 ABSOLUTE, 75-89 HIGH, 60-74 MEDIUM,
// 40-59 LOW, 0-39 INSUFFICIENT.
// Ported verbatim from BANYAN_METRIC_DIMENSIONS, truth_single_bp076.py:1010-1091. Same order (this
// file's own iteration order is insertion order, matching Python's dict, matching the Python
// table's own printed row order), same weights, same score_fn arithmetic.
export const BANYAN_METRIC_DIMENSIONS = {
    specialists_consulted: {
        weight: 10,
        targetDisplay: '>=8',
        description: 'More working DRT specialists = more workers pointing the way',
        scoreFn: (v) => Math.min(100, Math.round((v / 8) * 100)),
    },
    eblets_gathered_raw: {
        weight: 5,
        targetDisplay: '>=30',
        description: 'Raw retrieval breadth',
        scoreFn: (v) => Math.min(100, Math.round((v / 30) * 100)),
    },
    derivative_pairs_collapsed: {
        weight: 10,
        targetDisplay: '>0',
        description: 'Independence-detection caught derivative sources',
        scoreFn: (v) => (v > 0 ? 100 : 0),
    },
    independent_clusters_for_answer: {
        weight: 15,
        targetDisplay: '>=4',
        description: 'Independent sources supporting the chosen answer',
        scoreFn: (v) => Math.min(100, Math.round((v / 4) * 100)),
    },
    primary_text_present: {
        weight: 15,
        targetDisplay: 'YES',
        description: "Author's actual words retrieved verbatim",
        scoreFn: (v) => (v ? 100 : 0),
    },
    confidence_label_calibration: {
        weight: 10,
        targetDisplay: 'HIGH/ABS',
        description: 'Final confidence label achieved',
        scoreFn: (v) => {
            const s = v;
            if (s === 'ABSOLUTE')
                return 100;
            if (s === 'HIGH')
                return 85;
            if (s === 'MEDIUM')
                return 60;
            if (s === 'LOW')
                return 30;
            return 10;
        },
    },
    stubbed_gap_acknowledged: {
        weight: 5,
        targetDisplay: '>0',
        description: "Truth-Always: tool honestly flags what it couldn't consult",
        scoreFn: (v) => (v > 0 ? 100 : 0),
    },
    manual_llm_concordance: {
        weight: 15,
        targetDisplay: '>=0.70',
        description: 'Manual + LLM synthesis converge on same answer (cross-validation)',
        scoreFn: (v) => Math.min(100, Math.round((v / 0.7) * 100)),
    },
    wall_clock_latency_s: {
        weight: 5,
        targetDisplay: '<45',
        description: 'Speed (lower better; under 45s gate)',
        scoreFn: (v) => {
            const s = v;
            if (s <= 30)
                return 100;
            if (s <= 60)
                return Math.round(100 - ((s - 30) / 30) * 60);
            return 0;
        },
    },
    anti_popularity_guardrails_count: {
        weight: 10,
        targetDisplay: '>=4',
        description: 'Independence + source-class weighting + primary-text bonus + reputation-static-noted',
        scoreFn: (v) => Math.min(100, Math.round((v / 4) * 100)),
    },
};
/** Ported verbatim from _compute_banyan_metric(), truth_single_bp076.py:1097-1134. THE
 *  value-attribution override (derivative_pairs_collapsed=0 scored as 100 for
 *  mathematical/physics_constant/physics_mmlu_pro domains) is deliberately NOT ported here --
 *  classify_cascade.ts's own run is never one of those three domains, so the override's condition
 *  is never true for this caller, and porting a branch that can never fire would be dead code
 *  masquerading as fidelity. This is a stated omission, not a silent one. */
export function computeBanyanMetricStandard(inputs) {
    const dimScores = {};
    for (const [name, cfg] of Object.entries(BANYAN_METRIC_DIMENSIONS)) {
        const raw = inputs[name];
        const scored = cfg.scoreFn(raw);
        dimScores[name] = Math.max(0, Math.min(100, scored));
    }
    const totalWeight = Object.values(BANYAN_METRIC_DIMENSIONS).reduce((s, d) => s + d.weight, 0);
    const composite = Object.entries(BANYAN_METRIC_DIMENSIONS).reduce((sum, [name, cfg]) => sum + dimScores[name] * cfg.weight, 0) / totalWeight;
    const rounded = Math.round(composite * 10) / 10;
    return { dimScores, composite: rounded, band: bandFor(rounded), inputs };
}
/** Ported verbatim from _render_banyan_metric_block()'s own printed interpretation lines,
 *  truth_single_bp076.py:1168-1172: 90-100 ABSOLUTE, 75-89 HIGH, 60-74 MEDIUM, 40-59 LOW, 0-39
 *  INSUFFICIENT. */
export function bandFor(composite) {
    if (composite >= 90)
        return 'ABSOLUTE';
    if (composite >= 75)
        return 'HIGH';
    if (composite >= 60)
        return 'MEDIUM';
    if (composite >= 40)
        return 'LOW';
    return 'INSUFFICIENT';
}
/** One line per dimension, for the transcript -- same information the Python table prints
 *  (`_render_banyan_metric_block()`), reformatted for this estate's emit() convention rather than
 *  a fixed-width console table. */
export function renderBanyanMetricLines(bm) {
    const lines = [];
    for (const [name, cfg] of Object.entries(BANYAN_METRIC_DIMENSIONS)) {
        const raw = bm.inputs[name];
        lines.push(`      ${name}: ${String(raw)} (target ${cfg.targetDisplay})  score ${bm.dimScores[name]}  weight ${cfg.weight}`);
    }
    lines.push(`   Banyan Metric Standard composite: ${bm.composite}/100 -- ${bm.band}`);
    return lines;
}
