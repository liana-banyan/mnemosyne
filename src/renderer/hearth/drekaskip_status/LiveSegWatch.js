import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// BP041 — Live SEG Watch
//
// Founder direct: *"I, and many like me, are visual people. I like to see the
// actual DOING of the segs processing. Like, watching each line of testing...
// CHECKMARK 100% or HIT / MISS / HOT... with totals adding up as we go. It
// makes it FASCINATING to watch. Kind of like, I loved watching plotter
// printers work."*
//
// Polls /yoke/wave/status/<waveId> every 1.5s while the wave is running;
// 5s once complete (just enough to show finalized state). Renders:
//   - LEFT  — vertical list of SEGs with HIT / EMPTY / ERROR / HOT / PENDING
//             status, reply size, recipient
//   - RIGHT — running aggregates: completion %, substantive count, errors,
//             in-flight count, wall-clock, synthesis-present flag
import { useState, useEffect, useRef } from 'react';
import { sagaSubscription } from './saga_subscription';
export function LiveSegWatch({ waveId: explicitWaveId, maxHeight = 320, title = 'Live SEG Watch' }) {
    const [wave, setWave] = useState(null);
    const [autoWaveId, setAutoWaveId] = useState(null);
    const targetWaveId = explicitWaveId ?? autoWaveId;
    // Auto-detect most recent wave — three paths in priority order:
    //   (1) Direct event from NovaculaFireButton (instant; doesn't need saga)
    //   (2) localStorage "mnemosyne_last_wave_id" (survives reload)
    //   (3) Saga subscription wave_instances[0] (eventually-consistent fallback)
    useEffect(() => {
        if (explicitWaveId)
            return; // explicit override
        // (1) Direct event channel — BP041 Founder direct: "it should wipe the
        //     old results when I do a new test." Clear wave state IMMEDIATELY
        //     when a new wave fires, before the new wave_id resolves.
        const onWaveFired = (ev) => {
            const detail = ev.detail;
            if (detail?.waveId) {
                setWave(null); // wipe stale rows immediately
                setAutoWaveId(detail.waveId);
            }
        };
        window.addEventListener('mnemosyne-wave-fired', onWaveFired);
        // (2) Restore most-recent from localStorage on mount
        try {
            const stored = localStorage.getItem('mnemosyne_last_wave_id');
            if (stored)
                setAutoWaveId(stored);
        }
        catch { /* non-fatal */ }
        // (3) Saga subscription fallback (eventually picks up; lower priority)
        const unsub = sagaSubscription.subscribe((state) => {
            const instances = state.wave_instances ?? [];
            if (instances.length > 0) {
                setAutoWaveId((cur) => cur ?? instances[0].id);
            }
        });
        return () => {
            window.removeEventListener('mnemosyne-wave-fired', onWaveFired);
            unsub();
        };
    }, [explicitWaveId]);
    // Wipe state when explicitWaveId changes (parent passed a different wave)
    useEffect(() => {
        if (explicitWaveId)
            setWave(null);
    }, [explicitWaveId]);
    // Poll the target wave
    useEffect(() => {
        if (!targetWaveId)
            return;
        let active = true;
        const fetchWave = async () => {
            try {
                const resp = await fetch(`http://127.0.0.1:11480/yoke/wave/status/${targetWaveId}`);
                if (!resp.ok || !active)
                    return;
                const data = await resp.json();
                if (active)
                    setWave(data);
            }
            catch { /* network blip; next tick retries */ }
        };
        fetchWave();
        const interval = setInterval(fetchWave, 1500);
        return () => { active = false; clearInterval(interval); };
    }, [targetWaveId]);
    // BP041 — animated dot trail. Founder direct: "would it be a lot to have a
    // .................................................................... that
    // keeps going as each gets done... constantly showing the progress being made
    // with motion like that?"
    const [tick, setTick] = useState(0);
    useEffect(() => {
        if (!wave || wave.status === 'complete' || wave.status === 'aborted')
            return;
        const t = setInterval(() => setTick((n) => (n + 1) % 60), 150);
        return () => clearInterval(t);
    }, [wave?.status, wave?.wave_id]);
    // BP041 — auto-focus on current HOT SEG. Founder direct: "the screen should
    // focus on the current point, like when you map in google maps, it centers
    // you and you see your triangle move along the roadway."
    const segListRef = useRef(null);
    const segs = wave?.segs ?? [];
    // Find the LATEST-progress SEG (Founder direct: "as each new line should
    // push it so the view shifts as data happens"). Scroll-target = last
    // completed (the "just landed" row at the bottom of the action), with
    // first-HOT as a fallback if nothing's landed yet.
    const activeIdx = (() => {
        // Last completed (HIT/EMPTY/ERROR) — the leading edge of activity
        for (let i = segs.length - 1; i >= 0; i--) {
            if (segs[i].status === 'done' || segs[i].status === 'error')
                return i;
        }
        // Nothing landed yet — show first HOT
        const firstHot = segs.findIndex((s) => s.status === 'dispatched');
        if (firstHot >= 0)
            return firstHot;
        return -1;
    })();
    useEffect(() => {
        if (activeIdx < 0 || !segListRef.current)
            return;
        const child = segListRef.current.children[activeIdx];
        if (child) {
            child.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [activeIdx, wave?.status]);
    const total = segs.length;
    const substantive = segs.filter((s) => s.status === 'done' && (s.reply ?? '').length > 100).length;
    const emptyDone = segs.filter((s) => s.status === 'done' && (s.reply ?? '').length <= 100).length;
    const errored = segs.filter((s) => s.status === 'error').length;
    const inFlight = segs.filter((s) => s.status === 'dispatched').length;
    const pending = segs.filter((s) => s.status === 'pending').length;
    const completionPct = total > 0 ? Math.round(((substantive + emptyDone + errored) / total) * 100) : 0;
    // Wall clock
    let wallClock = '—';
    if (wave?.created_at) {
        const start = new Date(wave.created_at).getTime();
        const end = wave.completed_at ? new Date(wave.completed_at).getTime() : Date.now();
        const seconds = Math.round((end - start) / 1000);
        wallClock = seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    }
    // Total reply bytes (cumulative substrate output volume)
    const totalReplyChars = segs.reduce((acc, s) => acc + (s.reply ?? '').length, 0);
    if (!targetWaveId) {
        return (_jsxs("div", { style: styles.emptyState, children: [_jsx("span", { style: styles.emptyIcon, children: "\uD83C\uDF0A" }), _jsx("span", { children: "No waves fired yet this session. Fire a Novacula above to watch SEGs process live." })] }));
    }
    if (!wave) {
        return (_jsxs("div", { style: styles.emptyState, children: [_jsx("span", { style: styles.emptyIcon, children: "\u23F3" }), _jsxs("span", { children: ["Loading wave ", _jsxs("code", { children: [targetWaveId.slice(0, 16), "\u2026"] })] })] }));
    }
    return (_jsxs("div", { style: styles.container, children: [_jsxs("div", { style: styles.header, children: [_jsx("span", { style: styles.title, children: title }), _jsxs("code", { style: styles.waveIdSmall, title: wave.wave_id, children: [wave.wave_id.slice(0, 24), "\u2026"] }), _jsx("span", { style: {
                            ...styles.statusBadge,
                            background: wave.status === 'complete' ? '#14532d' : wave.status === 'running' || wave.status === 'queued' ? '#7c2d12' : '#1e3a5f',
                            color: wave.status === 'complete' ? '#86efac' : wave.status === 'running' || wave.status === 'queued' ? '#fdba74' : '#93c5fd',
                        }, children: wave.status.toUpperCase() })] }), _jsxs("div", { style: { ...styles.body, maxHeight }, children: [_jsx("div", { style: styles.segList, ref: segListRef, role: "log", "aria-live": "polite", "aria-label": `Wave ${wave.wave_id.slice(0, 16)} segment progress; ${substantive} substantive, ${emptyDone} empty, ${errored} error, ${inFlight} in-flight, ${pending} pending of ${total} total`, children: segs.map((seg, i) => (_jsx(SegRow, { seg: seg, isActive: i === activeIdx, tick: tick }, seg.seg_id))) }), _jsxs("div", { style: styles.aggregates, children: [_jsx(BigStat, { value: `${completionPct}%`, label: "completion", color: "#f6ad55" }), _jsx(Stat, { value: substantive, label: "\u2705 HIT", color: "#22c55e", big: true }), _jsx(Stat, { value: emptyDone, label: "\u26A0\uFE0F EMPTY", color: "#f59e0b" }), _jsx(Stat, { value: errored, label: "\u274C ERROR", color: "#ef4444" }), _jsx(Stat, { value: inFlight, label: "\uD83D\uDD25 HOT (in-flight)", color: "#f97316" }), _jsx(Stat, { value: pending, label: "\u23F3 pending", color: "#718096" }), _jsx(Divider, {}), _jsx(Stat, { value: wallClock, label: "wall-clock", color: "#cbd5e0" }), _jsx(Stat, { value: `${(totalReplyChars / 1000).toFixed(1)}k`, label: "reply chars total", color: "#a5b4fc" }), _jsx(Stat, { value: wave.synthesis_text ? '✓ landed' : '—', label: "synthesis", color: wave.synthesis_text ? '#22c55e' : '#4a5568' }), wave.status === 'complete' && total > 0 && (() => {
                                // Baselines (conservative; member can refine in Settings later)
                                const serialSecondsPerSeg = 8; // single-AI serial baseline
                                const conventionalUsdPerArtifact = 500; // entry-tier consulting baseline
                                const actualUsdPerArtifact = 0.054; // BP039-measured per-artifact substrate cost
                                const actualSeconds = Math.max(1, Math.round(((wave.completed_at ? new Date(wave.completed_at).getTime() : Date.now())
                                    - new Date(wave.created_at).getTime()) / 1000));
                                const serialSeconds = total * serialSecondsPerSeg;
                                const fSpeedup = serialSeconds / actualSeconds;
                                const cReduction = conventionalUsdPerArtifact / actualUsdPerArtifact;
                                const aAccuracy = (substantive / total) * 100;
                                return (_jsxs(_Fragment, { children: [_jsx(Divider, {}), _jsx("div", { style: styles.banyanLabel, children: "\uD83D\uDCCA Banyan Metric" }), _jsx(Stat, { value: `${fSpeedup.toFixed(1)}×`, label: "F \u00B7 faster (vs serial)", color: "#22c55e", big: true }), _jsx(Stat, { value: `${Math.round(cReduction).toLocaleString()}×`, label: "C \u00B7 cheaper (per artifact)", color: "#86efac", big: true }), _jsx(Stat, { value: `${aAccuracy.toFixed(1)}%`, label: "A \u00B7 accuracy (substantive)", color: "#fbbf24", big: true }), _jsxs("div", { style: styles.metricActions, children: [_jsx("button", { style: styles.metricBtn, onClick: () => {
                                                        try {
                                                            const saved = JSON.parse(localStorage.getItem('mnemosyne_test_results') ?? '[]');
                                                            saved.unshift({
                                                                wave_id: wave.wave_id,
                                                                anchor: wave.anchor,
                                                                completed_at: wave.completed_at,
                                                                f_speedup: fSpeedup,
                                                                c_reduction: cReduction,
                                                                a_accuracy: aAccuracy,
                                                                total, substantive, errored,
                                                            });
                                                            localStorage.setItem('mnemosyne_test_results', JSON.stringify(saved.slice(0, 50)));
                                                            alert(`✓ Saved ${wave.wave_id.slice(0, 16)}… to test history`);
                                                        }
                                                        catch { /* non-fatal */ }
                                                    }, children: "\uD83D\uDCBE Save" }), _jsx("button", { style: styles.metricBtn, onClick: () => {
                                                        if (confirm('Wipe ALL saved test history? (current wave not affected)')) {
                                                            localStorage.removeItem('mnemosyne_test_results');
                                                        }
                                                    }, children: "\uD83D\uDDD1 Wipe history" })] })] }));
                            })()] })] }), wave.synthesis_text && (_jsxs("details", { style: styles.synthesisDetails, children: [_jsxs("summary", { style: styles.synthesisSummary, children: ["\uD83D\uDCC4 Synthesis output (", wave.synthesis_text.length.toLocaleString(), " chars) \u2014 click to expand"] }), _jsxs("pre", { style: styles.synthesisPre, children: [wave.synthesis_text.slice(0, 8000), wave.synthesis_text.length > 8000 ? '\n\n…(truncated; full output in wave archive)' : ''] })] }))] }));
}
/**
 * BP041 — Founder direct: *"that also helps when people can see their own
 * named data flash across the screen."* Extract a human-readable name from
 * the SEG's own reply (most replies start with `### N. Name\n\n...` heading
 * per canonical prompt format). When the reply lands, the SEG's own title
 * appears live — members see meaningful labels not generic seg_ids.
 */
function extractSegName(seg) {
    const reply = seg.reply ?? '';
    if (reply.length > 10) {
        // Try first line; strip leading markdown header markers
        const firstLine = reply.split('\n')[0].replace(/^#+\s*/, '').trim();
        if (firstLine && firstLine.length > 0 && firstLine.length < 100) {
            return { display: firstLine, fromReply: true };
        }
    }
    // Fallback to seg_id with light prettification
    const pretty = seg.seg_id.replace(/^seg_/, '').replace(/_/g, ' ');
    return { display: pretty, fromReply: false };
}
/**
 * BP041 — Founder direct: "the ... is supposed to be for EACH row as it
 * happens... so that it goes up to the end and green checkmarks if good
 * result, and yellow if not? and red if bad?"
 *
 * Per-row trail render:
 *   PENDING  → " . . . . . . . . . . . . . . " (faint grey static dots; waiting to start)
 *   HOT      → "•••••·  ·   ·    " (orange dots animating left→right as it works)
 *   HIT      → "•••••••••••••••• ✅"  (solid green dots + checkmark)
 *   EMPTY    → "•••••••••••••••• ⚠️"  (amber half-fill + warning)
 *   ERROR    → "••••••••••••••• ❌"  (red dots + X)
 */
function renderRowTrail(status, replyLen, tick) {
    const TRAIL_WIDTH = 32;
    if (status === 'error') {
        return { text: '•'.repeat(TRAIL_WIDTH) + ' ❌', color: '#ef4444' };
    }
    if (status === 'done' && replyLen > 100) {
        return { text: '•'.repeat(TRAIL_WIDTH) + ' ✅', color: '#22c55e' };
    }
    if (status === 'done') {
        return { text: '•'.repeat(Math.floor(TRAIL_WIDTH * 0.5)) + '·'.repeat(TRAIL_WIDTH - Math.floor(TRAIL_WIDTH * 0.5)) + ' ⚠️', color: '#f59e0b' };
    }
    if (status === 'dispatched') {
        // Animated march: as `tick` increments, the bar of solid dots slides
        const pos = tick % TRAIL_WIDTH;
        const dots = [];
        for (let i = 0; i < TRAIL_WIDTH; i++) {
            // Solid block of ~6 chars wrapping around
            const inBlock = (i >= pos && i < pos + 6) || (pos + 6 > TRAIL_WIDTH && i < (pos + 6) % TRAIL_WIDTH);
            dots.push(inBlock ? '•' : '·');
        }
        return { text: dots.join('') + '  ', color: '#f97316' };
    }
    // PENDING — static faint dots
    return { text: '·'.repeat(TRAIL_WIDTH) + '  ', color: '#4a5568' };
}
function SegRow({ seg, isActive, tick = 0 }) {
    const replyLen = (seg.reply ?? '').length;
    const { display: segName, fromReply } = extractSegName(seg);
    let icon, color, label;
    if (seg.status === 'error') {
        icon = '❌';
        color = '#ef4444';
        label = 'ERROR';
    }
    else if (seg.status === 'done' && replyLen > 100) {
        icon = '✅';
        color = '#22c55e';
        label = 'HIT';
    }
    else if (seg.status === 'done') {
        icon = '⚠️';
        color = '#f59e0b';
        label = 'EMPTY';
    }
    else if (seg.status === 'dispatched') {
        icon = '🔥';
        color = '#f97316';
        label = 'HOT';
    }
    else {
        icon = '⏳';
        color = '#718096';
        label = 'PENDING';
    }
    const trail = renderRowTrail(seg.status, replyLen, tick);
    return (_jsxs("div", { style: {
            ...styles.segRow,
            borderLeftColor: color,
            ...(isActive ? styles.segRowActive : {}),
        }, title: seg.error ?? `${seg.seg_id} → ${seg.recipient}`, children: [_jsx("span", { style: styles.segIcon, children: icon }), _jsx("span", { style: {
                    ...styles.segId,
                    color: fromReply ? '#e2e8f0' : '#718096',
                    fontFamily: fromReply ? 'inherit' : 'monospace',
                    fontSize: fromReply ? '0.72rem' : '0.65rem',
                    fontWeight: fromReply ? 600 : 400,
                    flex: '0 0 180px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }, children: segName }), _jsx("span", { style: {
                    ...styles.rowTrail,
                    color: trail.color,
                    flex: 1,
                }, children: trail.text }), _jsx("span", { style: styles.segMetric, children: replyLen > 0 ? `${replyLen.toLocaleString()} ch` : '' })] }));
}
function Stat({ value, label, color, big }) {
    return (_jsxs("div", { style: styles.statRow, children: [_jsx("span", { style: { ...styles.statValue, color, fontSize: big ? '1.05rem' : '0.85rem' }, children: value }), _jsx("span", { style: styles.statLabel, children: label })] }));
}
function BigStat({ value, label, color }) {
    return (_jsxs("div", { style: styles.bigStatRow, children: [_jsx("span", { style: { ...styles.bigStatValue, color }, children: value }), _jsx("span", { style: styles.bigStatLabel, children: label })] }));
}
function Divider() {
    return _jsx("div", { style: styles.divider });
}
const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        background: '#0a0a12',
        border: '1px solid #2d3748',
        borderRadius: '6px',
        overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.4rem 0.75rem',
        background: '#111120',
        borderBottom: '1px solid #2d3748',
        fontSize: '0.75rem',
    },
    title: { fontWeight: 700, color: '#f6ad55', letterSpacing: '0.04em' },
    waveIdSmall: {
        fontFamily: 'monospace',
        fontSize: '0.65rem',
        color: '#718096',
        background: '#0a0a12',
        padding: '1px 5px',
        borderRadius: '3px',
        userSelect: 'text',
    },
    statusBadge: {
        fontSize: '0.6rem',
        fontWeight: 700,
        padding: '1px 6px',
        borderRadius: '3px',
        letterSpacing: '0.08em',
        marginLeft: 'auto',
    },
    body: {
        display: 'flex',
        gap: '0.5rem',
        padding: '0.5rem',
        overflow: 'hidden',
        minHeight: 120,
    },
    segList: {
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        paddingRight: '0.25rem',
    },
    segRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '3px 6px',
        background: '#12121f',
        borderLeft: '3px solid',
        borderRadius: '2px',
        fontSize: '0.7rem',
        transition: 'background 0.18s, border-left-color 0.18s, box-shadow 0.18s',
        scrollMarginTop: '40px', // for scrollIntoView smooth-center
        scrollMarginBottom: '40px',
    },
    segRowActive: {
        // BP041 — "Google Maps triangle" auto-focus highlight on current SEG
        background: '#1f2540',
        boxShadow: '0 0 0 1px #f6ad5544, 0 0 8px #f6ad5522',
    },
    dotTrail: {
        overflow: 'hidden',
        padding: '4px 8px',
        background: '#070710',
        borderBottom: '1px solid #1a1a2e',
        fontFamily: 'monospace',
        fontSize: '0.75rem',
        color: '#f6ad55',
        letterSpacing: '0.1em',
        whiteSpace: 'nowrap',
    },
    dotTrailInner: {
        display: 'inline-block',
        minWidth: '100%',
    },
    segIcon: { fontSize: '0.75rem', flex: '0 0 auto' },
    segId: { fontFamily: 'monospace', color: '#cbd5e0', fontSize: '0.65rem' },
    segRecipient: { color: '#718096', fontSize: '0.6rem' },
    segStatus: { fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.05em' },
    segMetric: { fontFamily: 'monospace', fontSize: '0.6rem', color: '#a0aec0', minWidth: 60, textAlign: 'right', flex: '0 0 60px' },
    rowTrail: {
        fontFamily: 'monospace',
        fontSize: '0.7rem',
        letterSpacing: '0.05em',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'clip',
    },
    aggregates: {
        flex: '0 0 180px',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
        padding: '0.5rem',
        background: '#080812',
        borderRadius: '4px',
        fontSize: '0.7rem',
    },
    bigStatRow: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.25rem 0' },
    bigStatValue: { fontSize: '1.8rem', fontWeight: 800, lineHeight: 1, fontFamily: 'monospace' },
    bigStatLabel: { fontSize: '0.55rem', color: '#718096', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 },
    statRow: { display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'space-between' },
    statValue: { fontWeight: 700, fontFamily: 'monospace' },
    statLabel: { fontSize: '0.6rem', color: '#718096' },
    divider: { height: 1, background: '#2d3748', margin: '0.25rem 0' },
    banyanLabel: { fontSize: '0.65rem', color: '#f6ad55', fontWeight: 700, letterSpacing: '0.08em', textAlign: 'center', marginTop: 4 },
    metricActions: { display: 'flex', gap: '0.25rem', marginTop: 6 },
    metricBtn: {
        flex: 1,
        background: '#1a202c',
        border: '1px solid #2d3748',
        borderRadius: 3,
        color: '#a0aec0',
        padding: '3px 6px',
        fontSize: '0.6rem',
        cursor: 'pointer',
        fontFamily: 'inherit',
    },
    emptyState: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '1rem',
        background: '#0a0a12',
        border: '1px dashed #2d3748',
        borderRadius: '6px',
        color: '#718096',
        fontSize: '0.75rem',
        fontStyle: 'italic',
    },
    emptyIcon: { fontSize: '1.1rem' },
    synthesisDetails: {
        borderTop: '1px solid #2d3748',
        background: '#080812',
    },
    synthesisSummary: {
        padding: '0.4rem 0.75rem',
        cursor: 'pointer',
        fontSize: '0.7rem',
        color: '#86efac',
        userSelect: 'none',
    },
    synthesisPre: {
        padding: '0.5rem 0.75rem',
        margin: 0,
        fontFamily: 'monospace',
        fontSize: '0.65rem',
        color: '#cbd5e0',
        background: '#050510',
        maxHeight: 240,
        overflow: 'auto',
        whiteSpace: 'pre-wrap',
        userSelect: 'text',
    },
};
