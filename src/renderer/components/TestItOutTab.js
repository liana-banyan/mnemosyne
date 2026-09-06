import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// TestItOutTab.tsx — SEG-2 v0.1.57 · SEG-4 v0.1.59 · BP079/BP081 · BP082 v0.2.2 · v0.2.3 · v0.3.1 · BP083 v0.3.5 · v0.3.5.1 · v0.3.8 BP083
// Single Q: 5-question MMLU-Pro / R11 diagnostic workout.
// Plow the Field: multi-domain parallel Plow run with per-domain progress.
// Andon discipline: correct answers grow substrate; wrong answers never written.
// v0.2.2: Substrate seed panel added (Settings → Substrate → Seed from Sealed Bank)
// v0.2.3: Beat-Google Benchmark mode added (BP082 — apples-to-apples handicapped comparison)
// v0.3.1: 3-Condition Mesh Comparison Test (BP082 Founder correction — Cold/Seeded/Loop)
// v0.3.5: My Self-Context panel added (BP083 — MEMORY.md amnesia cure)
// v0.3.8: GPQA Diamond Benchmark section (BP083 SEG-3)
import { useCallback, useEffect, useRef, useState } from 'react';
import { SubstrateSeedPanel } from './SubstrateSeedPanel';
import { BenchmarkModal } from './BenchmarkModal';
import { MeshComparisonModal } from './MeshComparisonModal';
const ALL_DOMAINS = [
    'math', 'physics', 'chemistry', 'biology', 'computer_science', 'engineering',
    'history', 'philosophy', 'law', 'business', 'economics', 'psychology', 'health', 'other',
];
const DOMAIN_LABELS = {
    math: 'Math', physics: 'Physics', chemistry: 'Chemistry', biology: 'Biology',
    computer_science: 'CS', engineering: 'Engineering', history: 'History',
    philosophy: 'Philosophy', law: 'Law', business: 'Business',
    economics: 'Economics', psychology: 'Psychology', health: 'Health', other: 'Other',
};
// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
        padding: '24px 24px 32px',
        background: '#0a0f1a',
        color: '#e2e8f0',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        gap: 20,
    },
    header: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
    },
    title: {
        fontSize: 18,
        fontWeight: 700,
        color: '#6ee7b7',
        margin: 0,
    },
    subtitle: {
        fontSize: 13,
        color: '#64748b',
        lineHeight: 1.6,
        margin: 0,
    },
    substrateNote: {
        fontSize: 11,
        color: '#475569',
        background: 'rgba(110,231,183,0.05)',
        border: '1px solid rgba(110,231,183,0.12)',
        borderRadius: 8,
        padding: '8px 12px',
        lineHeight: 1.6,
    },
    primaryBtn: (disabled) => ({
        padding: '11px 24px',
        background: disabled ? 'rgba(110,231,183,0.04)' : 'rgba(110,231,183,0.13)',
        border: disabled ? '1px solid rgba(110,231,183,0.15)' : '1px solid rgba(110,231,183,0.4)',
        borderRadius: 8,
        color: disabled ? '#475569' : '#6ee7b7',
        fontSize: 14,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        alignSelf: 'flex-start',
        transition: 'all 0.15s',
    }),
    historyRow: {
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(100,116,139,0.15)',
        borderRadius: 8,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    progressBar: (pct) => ({
        height: 4,
        borderRadius: 2,
        background: `linear-gradient(to right, #6ee7b7 ${pct}%, rgba(110,231,183,0.1) ${pct}%)`,
        marginBottom: 12,
        flexShrink: 0,
    }),
    questionCard: (isCorrect) => ({
        padding: '12px 14px',
        borderRadius: 8,
        border: isCorrect === null
            ? '1px solid rgba(100,116,139,0.2)'
            : isCorrect
                ? '1px solid rgba(110,231,183,0.35)'
                : '1px solid rgba(239,68,68,0.3)',
        background: isCorrect === null
            ? 'rgba(255,255,255,0.02)'
            : isCorrect
                ? 'rgba(110,231,183,0.05)'
                : 'rgba(239,68,68,0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
    }),
    qLabel: {
        fontSize: 11,
        fontWeight: 600,
        color: '#94a3b8',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
    },
    qText: {
        fontSize: 13,
        color: '#e2e8f0',
        lineHeight: 1.5,
    },
    answerRow: {
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
    },
    answerLabel: (correct) => ({
        fontSize: 11,
        color: correct ? '#6ee7b7' : '#f87171',
        fontWeight: 600,
    }),
    answerText: {
        fontSize: 12,
        color: '#94a3b8',
        lineHeight: 1.5,
    },
    badge: (correct) => ({
        fontSize: 16,
        flexShrink: 0,
        color: correct ? '#6ee7b7' : '#f87171',
    }),
    finalScore: (score, total) => ({
        fontSize: 32,
        fontWeight: 800,
        color: score === total ? '#6ee7b7' : score >= total * 0.6 ? '#fbbf24' : '#f87171',
        margin: 0,
    }),
    scoreSub: {
        fontSize: 13,
        color: '#64748b',
    },
    ctaNote: {
        fontSize: 12,
        color: '#475569',
        fontStyle: 'italic',
    },
    errorBox: {
        padding: '12px 16px',
        borderRadius: 8,
        border: '1px solid rgba(239,68,68,0.3)',
        background: 'rgba(239,68,68,0.05)',
        color: '#f87171',
        fontSize: 13,
    },
    // ── Plow the Field styles ──────────────────────────────────────────────────
    modeToggleRow: {
        display: 'flex',
        gap: 0,
        borderBottom: '1px solid rgba(100,116,139,0.18)',
        marginBottom: 0,
        flexShrink: 0,
    },
    modeTab: (active) => ({
        padding: '9px 18px',
        background: 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid #6ee7b7' : '2px solid transparent',
        color: active ? '#6ee7b7' : '#64748b',
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all 0.12s',
        marginBottom: -1,
    }),
    domainGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
        gap: '6px 10px',
    },
    domainLabel: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        color: '#94a3b8',
        cursor: 'pointer',
        userSelect: 'none',
    },
    plowControlRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
    },
    qCountInput: {
        width: 52,
        padding: '6px 8px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(100,116,139,0.25)',
        borderRadius: 6,
        color: '#e2e8f0',
        fontSize: 13,
        fontFamily: 'inherit',
        textAlign: 'center',
        outline: 'none',
    },
    domainProgressBar: (pct) => ({
        height: 3,
        borderRadius: 2,
        background: `linear-gradient(to right, #6ee7b7 ${pct}%, rgba(110,231,183,0.08) ${pct}%)`,
        marginTop: 3,
    }),
    aggregatePanel: {
        background: 'rgba(110,231,183,0.05)',
        border: '1px solid rgba(110,231,183,0.2)',
        borderRadius: 10,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
    selectAllRow: {
        display: 'flex',
        gap: 8,
        marginBottom: 6,
    },
    smallLink: {
        fontSize: 11,
        color: '#6ee7b7',
        cursor: 'pointer',
        background: 'none',
        border: 'none',
        padding: 0,
        fontFamily: 'inherit',
        textDecoration: 'underline',
    },
};
// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatRelativeTime(ts) {
    const diffMs = Date.now() - ts;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0)
        return 'today';
    if (diffDays === 1)
        return '1 day ago';
    if (diffDays < 30)
        return `${diffDays} days ago`;
    const diffWeeks = Math.floor(diffDays / 7);
    return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`;
}
// ─── Component ────────────────────────────────────────────────────────────────
export function TestItOutTab() {
    const [state, setState] = useState({ id: 'idle' });
    const [history, setHistory] = useState([]);
    const runningRef = useRef(false);
    // ── Plow the Field state ──────────────────────────────────────────────────
    const [activeMode, setActiveMode] = useState('single');
    const [selectedDomains, setSelectedDomains] = useState([...ALL_DOMAINS]);
    const [qCount, setQCount] = useState(5);
    // SEG-3.5 BP083: always-current ref so handlePlow never captures stale qCount
    const qCountRef = useRef(qCount);
    qCountRef.current = qCount;
    const [plowState, setPlowState] = useState({ id: 'idle' });
    const plowRunningRef = useRef(false);
    // ── Benchmark / Mesh Comparison state ─────────────────────────────────────
    const [benchmarkModalOpen, setBenchmarkModalOpen] = useState(false);
    const [meshModalOpen, setMeshModalOpen] = useState(false);
    const [diamondCount, setDiamondCount] = useState(50);
    const [diamondRunning, setDiamondRunning] = useState({ id: 'idle' });
    const [bareResult, setBareResult] = useState(null);
    const [coopResult, setCoopResult] = useState(null);
    const [lastDiamondResult, setLastDiamondResult] = useState(null);
    const diamondRunningRef = useRef(false);
    // ── BP083 My Self-Context state ────────────────────────────────────────────
    const [selfCtxContent, setSelfCtxContent] = useState(null);
    const [selfCtxLoading, setSelfCtxLoading] = useState(false);
    const [selfCtxStatus, setSelfCtxStatus] = useState('');
    const [resetConfirm, setResetConfirm] = useState(false);
    // ── BP134 Yoke #32 Phase G — "improves-over-time" Chocolate Pack refresh ───
    const [chocolateRefreshLoading, setChocolateRefreshLoading] = useState(false);
    const [chocolateRefreshStatus, setChocolateRefreshStatus] = useState('');
    // Load history on mount
    useEffect(() => {
        window.amplify?.getTestItOutHistory?.()
            .then((res) => { if (res?.runs)
            setHistory(res.runs.slice().reverse()); })
            .catch(() => { });
    }, []);
    const handleRun = useCallback(async () => {
        if (runningRef.current)
            return;
        runningRef.current = true;
        setState({ id: 'running', results: [] });
        // Subscribe to per-question progress
        const unsubProgress = window.amplify?.onTestItOutProgress?.((data) => {
            setState((prev) => {
                if (prev.id !== 'running')
                    return prev;
                const next = [...prev.results];
                next[data.questionIndex] = {
                    questionIndex: data.questionIndex,
                    question: data.question,
                    modelAnswer: data.modelAnswer,
                    correctAnswer: data.correctAnswer,
                    isCorrect: data.isCorrect,
                };
                return { id: 'running', results: next };
            });
        });
        // Subscribe to completion
        const unsubComplete = window.amplify?.onTestItOutComplete?.((data) => {
            setState({
                id: 'complete',
                score: data.score,
                total: data.total,
                results: data.results,
            });
            // Refresh history
            window.amplify?.getTestItOutHistory?.()
                .then((res) => { if (res?.runs)
                setHistory(res.runs.slice().reverse()); })
                .catch(() => { });
            runningRef.current = false;
        });
        try {
            const result = await window.amplify?.runTestItOut?.();
            if (result?.success === false) {
                const msg = result.error === 'NO_QUESTION_BANK'
                    ? 'Question bank not found. Please reinstall or check your installation.'
                    : `Run failed: ${result.error ?? 'unknown error'}`;
                setState({ id: 'error', message: msg });
                runningRef.current = false;
            }
        }
        catch (err) {
            setState({ id: 'error', message: String(err) });
            runningRef.current = false;
        }
        finally {
            unsubProgress?.();
            unsubComplete?.();
        }
    }, []);
    const handleRunAgain = useCallback(() => {
        setState({ id: 'idle' });
        void handleRun();
    }, [handleRun]);
    // ── BP083 My Self-Context handlers ─────────────────────────────────────────
    const loadSelfCtx = useCallback(async () => {
        setSelfCtxLoading(true);
        setSelfCtxStatus('');
        try {
            const res = await window.amplify?.mnemoGetMemoryMd?.();
            if (res?.ok && res.content !== undefined) {
                setSelfCtxContent(res.content);
                setSelfCtxStatus('Loaded.');
            }
            else {
                setSelfCtxStatus(`Error: ${res?.error ?? 'unknown'}`);
            }
        }
        catch (err) {
            setSelfCtxStatus(`Error: ${String(err)}`);
        }
        finally {
            setSelfCtxLoading(false);
        }
    }, []);
    // Load on mount
    useEffect(() => { void loadSelfCtx(); }, [loadSelfCtx]);
    const handleSelfCtxReload = useCallback(async () => {
        setSelfCtxLoading(true);
        setSelfCtxStatus('Reloading…');
        try {
            const res = await window.amplify?.mnemoReloadMemoryMd?.();
            if (res?.ok && res.content !== undefined) {
                setSelfCtxContent(res.content);
                setSelfCtxStatus('Reloaded from disk.');
            }
            else {
                setSelfCtxStatus(`Reload failed: ${res?.error ?? 'unknown'}`);
            }
        }
        catch (err) {
            setSelfCtxStatus(`Reload failed: ${String(err)}`);
        }
        finally {
            setSelfCtxLoading(false);
        }
    }, []);
    const handleSelfCtxEdit = useCallback(async () => {
        setSelfCtxStatus('Opening editor…');
        try {
            const res = await window.amplify?.mnemoOpenMemoryEditor?.();
            setSelfCtxStatus(res?.ok ? 'Opened in default editor. Save and Reload to apply.' : `Open failed: ${res?.error ?? 'unknown'}`);
        }
        catch (err) {
            setSelfCtxStatus(`Open failed: ${String(err)}`);
        }
    }, []);
    const handleSelfCtxReset = useCallback(async () => {
        if (!resetConfirm) {
            setResetConfirm(true);
            setSelfCtxStatus('Click Reset again to confirm. This will overwrite your customizations.');
            return;
        }
        setResetConfirm(false);
        setSelfCtxLoading(true);
        setSelfCtxStatus('Resetting to template…');
        try {
            const res = await window.amplify?.mnemoResetMemoryMd?.();
            if (res?.ok && res.content !== undefined) {
                setSelfCtxContent(res.content);
                setSelfCtxStatus('Reset to template. MEMORY.md regenerated.');
            }
            else {
                setSelfCtxStatus(`Reset failed: ${res?.error ?? 'unknown'}`);
            }
        }
        catch (err) {
            setSelfCtxStatus(`Reset failed: ${String(err)}`);
        }
        finally {
            setSelfCtxLoading(false);
        }
    }, [resetConfirm]);
    // ── BP134 Yoke #32 Phase G — "improves-over-time" Chocolate Pack refresh ───
    const handleRefreshChocolatePack = useCallback(async () => {
        setChocolateRefreshLoading(true);
        setChocolateRefreshStatus('Refreshing Chocolate Pack — reading live substrate + seed, deduping, rebuilding 14 category packages…');
        try {
            const res = await window.amplify?.refreshChocolatePack?.();
            if (res?.ok && res.manifest) {
                const m = res.manifest;
                setChocolateRefreshStatus(`Refreshed: ${m.totalEblets} unique eblets across ${m.categories.length} categories ` +
                    `(${m.totalDuplicatesRemoved} dupes removed). Saved to userData/chocolates/.`);
            }
            else {
                setChocolateRefreshStatus(`Refresh failed: ${res?.error ?? 'unknown'}`);
            }
        }
        catch (err) {
            setChocolateRefreshStatus(`Refresh failed: ${String(err)}`);
        }
        finally {
            setChocolateRefreshLoading(false);
        }
    }, []);
    // ── BP083 v0.3.8 — GPQA Diamond handlers ─────────────────────────────────
    const handleRunDiamond = useCallback(async (mode) => {
        if (diamondRunningRef.current)
            return;
        diamondRunningRef.current = true;
        setDiamondRunning({ id: 'running', mode, currentQ: 0, total: diamondCount, currentDomain: '…', stage: 'starting', runningPct: 0 });
        const unsubProgress = window.amplify?.onDiamondProgress?.((data) => {
            const ev = data;
            const type = ev.type;
            if (type === 'question-start') {
                setDiamondRunning((prev) => prev.id === 'running' ? {
                    ...prev,
                    currentQ: (ev.questionIndex ?? 0) + 1,
                    total: ev.total ?? diamondCount,
                    currentDomain: ev.domain ?? '…',
                    stage: ev.mode === 'cooperative' ? 'substrate + 3-voter' : '0-shot',
                } : prev);
            }
            else if (type === 'question-done') {
                setDiamondRunning((prev) => prev.id === 'running' ? {
                    ...prev,
                    currentQ: (ev.questionIndex ?? 0) + 1,
                    runningPct: ev.running_pct ?? prev.runningPct,
                } : prev);
            }
            else if (type === 'andon-retry') {
                setDiamondRunning((prev) => prev.id === 'running' ? { ...prev, stage: `Andon retry ${ev.attempt ?? ''}` } : prev);
            }
        });
        try {
            const res = await window.amplify?.runDiamond?.({ mode, count: diamondCount });
            if (res?.ok === false) {
                setDiamondRunning({ id: 'error', message: res.error ?? 'Diamond run failed' });
                diamondRunningRef.current = false;
                unsubProgress?.();
                return;
            }
            if (res?.summary) {
                const summary = res.summary;
                setLastDiamondResult(summary);
                if (mode === 'bare')
                    setBareResult(summary);
                else
                    setCoopResult(summary);
            }
            setDiamondRunning({ id: 'idle' });
        }
        catch (err) {
            setDiamondRunning({ id: 'error', message: String(err) });
        }
        finally {
            diamondRunningRef.current = false;
            unsubProgress?.();
        }
    }, [diamondCount]);
    const handleCancelDiamond = useCallback(async () => {
        await window.amplify?.cancelDiamond?.();
        setDiamondRunning({ id: 'idle' });
        diamondRunningRef.current = false;
    }, []);
    // ── Plow the Field handlers ───────────────────────────────────────────────
    const handlePlowDomainToggle = useCallback((domain) => {
        setSelectedDomains((prev) => prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain]);
    }, []);
    const handlePlow = useCallback(async () => {
        if (plowRunningRef.current || selectedDomains.length === 0)
            return;
        plowRunningRef.current = true;
        // Initialize progress state for all selected domains
        const progress = {};
        for (const domain of selectedDomains) {
            progress[domain] = {
                done: 0, total: qCount, verified: 0, rejected: 0,
                quarantined: 0, ebletsWritten: 0, status: 'pending',
            };
        }
        setPlowState({
            id: 'running',
            progress: { ...progress },
            currentDomain: selectedDomains[0] ?? null,
            currentSpecialist: null,
            totalEbletsGrown: 0,
            totalQuarantined: 0,
            andonBanner: null,
            domainIndex: 0,
            totalDomains: selectedDomains.length,
            questionIndex: 0,
            totalQuestions: qCount,
        });
        let totalEbletsGrown = 0;
        let totalQuarantinedCount = 0;
        // v0.4.2 SEG-1: Plow worker is a main-process singleton. Completion arrives
        // via onCanonicalPlowProgress type:'complete' — NOT the await return value.
        // This allows the plow to survive tab switches and Lean Mode toggles.
        let unsubWorkerState;
        // Subscribe to live progress events from the canonical pipeline
        const unsubProgress = window.amplify?.onCanonicalPlowProgress?.((event) => {
            const ev = event;
            const type = ev.type;
            const domain = ev.domain;
            // v0.4.2 SEG-1: Worker signals completion via type:'complete' broadcast
            if (type === 'complete') {
                const totalPlowed = Object.values(progress).reduce((s, p) => s + p.done, 0);
                const totalVerified = Object.values(progress).reduce((s, p) => s + p.verified, 0);
                const totalRejected = Object.values(progress).reduce((s, p) => s + p.rejected, 0);
                const totalQuarantined2 = Object.values(progress).reduce((s, p) => s + p.quarantined, 0);
                const overallStatus = totalEbletsGrown >= 5 ? 'GREEN' : 'YELLOW';
                setPlowState({
                    id: 'complete',
                    progress,
                    totalPlowed,
                    totalVerified,
                    totalRejected,
                    totalQuarantined: totalQuarantined2,
                    totalEbletsGrown,
                    overallStatus,
                });
                plowRunningRef.current = false;
                unsubProgress?.();
                unsubWorkerState?.();
                return;
            }
            if (domain && progress[domain]) {
                if (type === 'domain-start') {
                    progress[domain].status = 'running';
                }
                else if (type === 'question-start') {
                    progress[domain].currentQuestion = (ev.questionIndex ?? 0) + 1;
                    progress[domain].status = 'running';
                }
                else if (type === 'specialist-fire') {
                    progress[domain].currentSpecialist = ev.specialistName ?? null;
                }
                else if (type === 'scribe-done') {
                    const written = ev.ebletsWrittenThisQuestion ?? 0;
                    progress[domain].ebletsWritten += written;
                    totalEbletsGrown += written;
                    progress[domain].done++;
                    if (written > 0) {
                        progress[domain].verified++;
                    }
                    else {
                        progress[domain].quarantined++;
                        totalQuarantinedCount++;
                    }
                }
                else if (type === 'andon-trigger') {
                    // Andon banner handled in setPlowState below
                }
                else if (type === 'domain-done') {
                    const domResult = ev.domainResult;
                    if (domResult) {
                        const s = domResult.status;
                        progress[domain].status = s === 'GREEN' ? 'green' : s === 'YELLOW' ? 'yellow' : 'red';
                    }
                    progress[domain].currentSpecialist = undefined;
                }
            }
            const andonBanner = type === 'andon-trigger'
                ? `⚑ Andon cord pulled — domain ${domain ?? '?'} · retry ${ev.andonRetry ?? 1}/3`
                : type === 'andon-recovered' ? null
                    : undefined; // undefined = no change
            setPlowState((prev) => {
                if (prev.id !== 'running')
                    return prev;
                return {
                    ...prev,
                    progress: { ...progress },
                    currentDomain: (domain ?? prev.currentDomain),
                    currentSpecialist: domain ? (progress[domain]?.currentSpecialist ?? null) : prev.currentSpecialist,
                    totalEbletsGrown,
                    totalQuarantined: totalQuarantinedCount,
                    andonBanner: andonBanner !== undefined ? andonBanner : prev.andonBanner,
                    domainIndex: ev.domainIndex ?? prev.domainIndex,
                    totalDomains: ev.totalDomains ?? prev.totalDomains,
                    questionIndex: ev.questionIndex ?? prev.questionIndex,
                    totalQuestions: ev.totalQuestions ?? prev.totalQuestions,
                };
            });
        });
        // Also subscribe to worker state for error detection
        unsubWorkerState = window.amplify?.onPlowWorkerState?.((state) => {
            const status = state.status;
            if (status === 'error') {
                setPlowState({ id: 'error', message: state.error ?? 'Plow worker error' });
                plowRunningRef.current = false;
                unsubProgress?.();
                unsubWorkerState?.();
            }
            else if (status === 'cancelled') {
                setPlowState({ id: 'idle' });
                plowRunningRef.current = false;
                unsubProgress?.();
                unsubWorkerState?.();
            }
        });
        try {
            // SEG-1 BP083: fire-and-forget start — plow runs in main process independent of renderer
            const res = await window.amplify?.runCanonicalPlow?.({
                domains: selectedDomains,
                questionsPerDomain: qCountRef.current,
            });
            if (res?.ok === false) {
                setPlowState({ id: 'error', message: res.error ?? 'Canonical plow failed' });
                plowRunningRef.current = false;
                unsubProgress?.();
                unsubWorkerState?.();
                return;
            }
            // res.async === true → plow started; completion comes via type:'complete' progress event above
        }
        catch (err) {
            setPlowState({ id: 'error', message: String(err) });
            plowRunningRef.current = false;
            unsubProgress?.();
            unsubWorkerState?.();
        }
        // SEG-3.5 BP083: qCount removed from deps — read via qCountRef.current inside the callback
    }, [selectedDomains]);
    // ── Computed ────────────────────────────────────────────────────────────────
    const lastRun = history[0] ?? null;
    const bestRun = history.length > 0
        ? history.reduce((best, r) => (r.score > best.score ? r : best), history[0])
        : null;
    const TOTAL = 5;
    // ── Render ─────────────────────────────────────────────────────────────────
    return (_jsxs("div", { style: S.container, children: [_jsxs("div", { style: S.modeToggleRow, children: [_jsx("button", { type: "button", style: S.modeTab(activeMode === 'single'), onClick: () => setActiveMode('single'), children: "Single Q" }), _jsx("button", { type: "button", style: S.modeTab(activeMode === 'plow'), onClick: () => setActiveMode('plow'), children: "Plow the Field" })] }), activeMode === 'plow' && (_jsxs(_Fragment, { children: [_jsxs("div", { style: S.header, children: [_jsx("h2", { style: S.title, children: "Plow the Field \uD83C\uDF3E" }), _jsx("p", { style: S.subtitle, children: "Canonical pipeline v0.4.0: Spider \u2192 9 External Specialists (staggered) \u2192 Miner \u2192 Saladin \u2192 Furnace \u2192 Three Fates \u2192 Scribe. Fetches real domain knowledge from Wikipedia, arXiv, OpenAlex, PubMed and more \u2014 grows substrate with verified facts." }), _jsx("p", { style: { fontSize: 12, color: '#64748b', margin: 0 }, children: "\uD83E\uDDC2 Substrate Salt + Federation Salt + Human Salt = Right Answer." })] }), (plowState.id === 'idle' || plowState.id === 'complete') && (_jsxs(_Fragment, { children: [_jsxs("div", { style: { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(100,116,139,0.15)', borderRadius: 10, padding: '14px 16px' }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }, children: "Domains" }), _jsxs("div", { style: S.selectAllRow, children: [_jsx("button", { type: "button", style: S.smallLink, onClick: () => setSelectedDomains([...ALL_DOMAINS]), children: "Select All" }), _jsx("button", { type: "button", style: S.smallLink, onClick: () => setSelectedDomains([]), children: "Deselect All" }), _jsxs("span", { style: { fontSize: 11, color: '#475569', marginLeft: 4 }, children: [selectedDomains.length, "/", ALL_DOMAINS.length, " selected"] })] }), _jsx("div", { style: S.domainGrid, children: ALL_DOMAINS.map((domain) => (_jsxs("label", { style: S.domainLabel, children: [_jsx("input", { type: "checkbox", checked: selectedDomains.includes(domain), onChange: () => handlePlowDomainToggle(domain), style: { accentColor: '#6ee7b7', cursor: 'pointer' } }), DOMAIN_LABELS[domain]] }, domain))) })] }), _jsxs("div", { style: S.plowControlRow, children: [_jsx("span", { style: { fontSize: 13, color: '#94a3b8' }, children: "Questions per domain:" }), _jsx("input", { type: "number", min: 1, max: 200, value: qCount, onChange: (e) => setQCount(Math.max(1, Math.min(200, Number(e.target.value)))), style: S.qCountInput }), _jsxs("span", { style: { fontSize: 11, color: '#475569' }, children: ["\u00D7 ", selectedDomains.length, " domains = ", qCount * selectedDomains.length, " total q"] }), _jsx("button", { type: "button", style: S.primaryBtn(selectedDomains.length === 0), disabled: selectedDomains.length === 0, onClick: () => { void handlePlow(); }, children: "Plow \uD83C\uDF3E" }), _jsx("button", { type: "button", style: {
                                            background: 'rgba(99,102,241,0.1)',
                                            border: '1px solid rgba(99,102,241,0.3)',
                                            borderRadius: 8,
                                            color: '#a5b4fc',
                                            padding: '9px 18px',
                                            fontSize: 13,
                                            fontWeight: 700,
                                            cursor: selectedDomains.length === 0 ? 'not-allowed' : 'pointer',
                                            whiteSpace: 'nowrap',
                                            opacity: selectedDomains.length === 0 ? 0.4 : 1,
                                            fontFamily: 'inherit',
                                        }, disabled: selectedDomains.length === 0, onClick: async () => {
                                            try {
                                                const info = await window.amplify?.micEstimateWallclock?.({
                                                    domains: selectedDomains,
                                                    questionsPerDomain: qCountRef.current,
                                                });
                                                const peers = info?.onlinePeers ?? 0;
                                                const hrs = info?.estimatedMs ? (info.estimatedMs / 3600000).toFixed(1) : '?';
                                                const msg = peers > 0
                                                    ? `🌌 ${peers} online peer${peers !== 1 ? 's' : ''} discovered\n\nEstimated wall-clock with Constellation: ~${hrs}h\nEstimated without: ~${(selectedDomains.length * 5 / 60).toFixed(1)}h\n\nStart Constellation Plow?`
                                                    : `No online Constellation peers found.\n\nTo use MIC mode, add peers in Settings → Constellation.\n\nRun locally instead?`;
                                                if (window.confirm(msg)) {
                                                    void window.amplify?.micStartDistributedPlow?.({
                                                        domains: selectedDomains,
                                                        questionsPerDomain: qCountRef.current,
                                                    });
                                                }
                                            }
                                            catch (err) {
                                                window.alert(`MIC error: ${String(err)}`);
                                            }
                                        }, title: "Distribute this Plow across your Constellation peers (Machine In Charge mode)", children: "\uD83C\uDF0C Plow with Constellation" }), _jsx("button", { type: "button", style: {
                                            background: 'rgba(110,231,183,0.12)',
                                            border: '1px solid rgba(110,231,183,0.35)',
                                            borderRadius: 8,
                                            color: '#6ee7b7',
                                            padding: '7px 14px',
                                            fontSize: 12,
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                        }, onClick: () => setMeshModalOpen(true), children: "\uD83D\uDD2C Run Mesh Comparison Test" }), _jsx("button", { type: "button", style: {
                                            background: 'rgba(99,102,241,0.08)',
                                            border: '1px solid rgba(99,102,241,0.2)',
                                            borderRadius: 8,
                                            color: '#64748b',
                                            padding: '7px 10px',
                                            fontSize: 10,
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                        }, title: "Apples-to-apples handicapped comparison (v0.2.3 methodology)", onClick: () => setBenchmarkModalOpen(true), children: "\uD83C\uDFC1" })] }), plowState.id === 'idle' && (_jsx("div", { style: { fontSize: 13, color: '#475569', fontStyle: 'italic' }, children: "Select domains and hit Plow to grow your substrate across multiple knowledge domains." })), plowState.id === 'complete' && (_jsxs(_Fragment, { children: [_jsxs("div", { style: S.aggregatePanel, children: [_jsxs("div", { style: { fontSize: 14, fontWeight: 700, color: '#6ee7b7' }, children: ["Your substrate grew by ", plowState.totalEbletsGrown, " eblet", plowState.totalEbletsGrown !== 1 ? 's' : '', " this run \uD83C\uDF31", ' ', _jsx("span", { style: { fontSize: 12, color: plowState.overallStatus === 'GREEN' ? '#6ee7b7' : '#fbbf24', fontWeight: 600 }, children: plowState.overallStatus === 'GREEN' ? '● GREEN' : '● YELLOW' })] }), _jsxs("div", { style: { display: 'flex', gap: 20, flexWrap: 'wrap' }, children: [_jsxs("div", { style: { fontSize: 12, color: '#94a3b8' }, children: ["Questions plowed: ", _jsx("strong", { style: { color: '#e2e8f0' }, children: plowState.totalPlowed })] }), _jsxs("div", { style: { fontSize: 12, color: '#94a3b8' }, children: ["Q with new facts \u2713: ", _jsx("strong", { style: { color: '#6ee7b7' }, children: plowState.totalVerified })] }), _jsxs("div", { style: { fontSize: 12, color: '#94a3b8' }, children: ["Quarantined: ", _jsx("strong", { style: { color: '#fbbf24' }, children: plowState.totalQuarantined })] })] })] }), _jsx("div", { style: { fontSize: 11, color: '#475569', letterSpacing: '0.06em', textTransform: 'uppercase' }, children: "Per-domain results" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: Object.entries(plowState.progress).map(([domain, prog]) => {
                                            const dot = prog.status === 'green' ? '🟢'
                                                : prog.status === 'yellow' ? '🟡'
                                                    : prog.status === 'red' ? '🔴' : '⚪';
                                            return (_jsxs("div", { style: { padding: '8px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(100,116,139,0.12)', borderRadius: 7 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 }, children: [_jsxs("span", { style: { fontSize: 12, color: '#94a3b8' }, children: [dot, " ", DOMAIN_LABELS[domain] ?? domain] }), _jsxs("span", { style: { fontSize: 11, color: '#475569' }, children: [prog.ebletsWritten, " eblets \u00B7 ", prog.verified, "/", prog.total, " Q"] })] }), _jsx("div", { style: S.domainProgressBar(prog.total > 0 ? (prog.ebletsWritten / Math.max(1, prog.total * 2)) * 100 : 0) })] }, domain));
                                        }) })] }))] })), plowState.id === 'running' && (_jsxs(_Fragment, { children: [_jsxs("div", { style: { fontSize: 13, color: '#6ee7b7', animation: 'mnemo-pulse 1.5s ease-in-out infinite', display: 'flex', flexDirection: 'column', gap: 3 }, children: [_jsxs("div", { children: ["\u25CC Domain ", plowState.domainIndex + 1, "/", plowState.totalDomains, plowState.currentDomain ? ` · ${DOMAIN_LABELS[plowState.currentDomain] ?? plowState.currentDomain}` : '', ' · ', "Q ", plowState.questionIndex + 1, "/", plowState.totalQuestions, plowState.currentSpecialist ? ` · ${plowState.currentSpecialist}` : ''] }), _jsxs("div", { style: { fontSize: 11, color: '#94a3b8', display: 'flex', gap: 16 }, children: [_jsxs("span", { children: ["\uD83C\uDF31 Substrate grew by ", _jsx("strong", { style: { color: '#6ee7b7' }, children: plowState.totalEbletsGrown }), " eblets"] }), plowState.totalQuarantined > 0 && (_jsxs("span", { children: ["\u2691 ", _jsx("strong", { style: { color: '#fbbf24' }, children: plowState.totalQuarantined }), " quarantined"] }))] })] }), plowState.andonBanner && (_jsx("div", { style: {
                                    padding: '8px 14px',
                                    background: 'rgba(251,191,36,0.08)',
                                    border: '1px solid rgba(251,191,36,0.3)',
                                    borderRadius: 7,
                                    fontSize: 12,
                                    color: '#fbbf24',
                                    fontWeight: 600,
                                }, children: plowState.andonBanner })), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: Object.entries(plowState.progress).map(([domain, prog]) => {
                                    const isActive = plowState.currentDomain === domain;
                                    const statusColor = prog.status === 'green' ? '#6ee7b7'
                                        : prog.status === 'yellow' ? '#fbbf24'
                                            : prog.status === 'red' ? '#f87171'
                                                : isActive ? '#6ee7b7' : '#94a3b8';
                                    const statusDot = prog.status === 'green' ? '🟢'
                                        : prog.status === 'yellow' ? '🟡'
                                            : prog.status === 'red' ? '🔴'
                                                : prog.status === 'running' ? '◌' : '⚪';
                                    return (_jsxs("div", { style: {
                                            padding: '8px 12px',
                                            background: isActive ? 'rgba(110,231,183,0.04)' : 'rgba(255,255,255,0.02)',
                                            border: `1px solid ${isActive ? 'rgba(110,231,183,0.2)' : 'rgba(100,116,139,0.12)'}`,
                                            borderRadius: 7,
                                        }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 }, children: [_jsxs("span", { style: { fontSize: 12, color: statusColor, display: 'flex', alignItems: 'center', gap: 5 }, children: [_jsx("span", { children: statusDot }), DOMAIN_LABELS[domain] ?? domain, isActive && prog.currentSpecialist && (_jsxs("span", { style: { fontSize: 10, color: '#64748b', fontStyle: 'italic' }, children: ["\u00B7 ", prog.currentSpecialist] }))] }), _jsxs("span", { style: { fontSize: 11, color: '#475569' }, children: ["Q", prog.done, "/", prog.total, prog.ebletsWritten > 0 && _jsxs("span", { style: { color: '#6ee7b7', marginLeft: 6 }, children: ["+", prog.ebletsWritten, " eblets"] })] })] }), _jsx("div", { style: S.domainProgressBar(prog.total > 0 ? (prog.done / prog.total) * 100 : 0) }), _jsxs("div", { style: { fontSize: 10, color: '#475569', marginTop: 3 }, children: [prog.verified > 0 && _jsxs("span", { style: { color: '#6ee7b7' }, children: ["\u2713", prog.verified, " "] }), prog.quarantined > 0 && _jsxs("span", { style: { color: '#fbbf24' }, children: ["\u2691", prog.quarantined] })] })] }, domain));
                                }) }), _jsx("button", { type: "button", style: { ...S.primaryBtn(false), background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }, onClick: () => { void window.amplify?.cancelCanonicalPlow?.(); }, children: "Cancel Plow" })] })), plowState.id === 'error' && (_jsxs(_Fragment, { children: [_jsx("div", { style: S.errorBox, children: plowState.message }), _jsx("button", { type: "button", style: S.primaryBtn(false), onClick: () => setPlowState({ id: 'idle' }), children: "Retry" })] }))] })), activeMode === 'single' && (_jsxs(_Fragment, { children: [_jsxs("div", { style: S.header, children: [_jsx("h2", { style: S.title, children: "Test It Out" }), _jsx("p", { style: S.subtitle, children: "Run a 5-question diagnostic against your local AI. Correct answers grow your substrate \u2014 run weekly to improve accuracy over time." })] }), _jsx("div", { style: S.substrateNote, children: "\uD83C\uDF31 Each correct answer grows your local substrate. Run weekly for increasing accuracy." }), state.id === 'idle' && (_jsxs(_Fragment, { children: [lastRun && (_jsxs("div", { style: S.historyRow, children: [_jsxs("div", { children: [_jsxs("div", { style: { fontSize: 12, color: '#94a3b8' }, children: ["Last run: ", _jsxs("strong", { style: { color: '#e2e8f0' }, children: [lastRun.score, "/", lastRun.total] }), ' · ', formatRelativeTime(lastRun.ts)] }), bestRun && bestRun.ts !== lastRun.ts && (_jsxs("div", { style: { fontSize: 11, color: '#64748b', marginTop: 2 }, children: ["Best: ", bestRun.score, "/", bestRun.total] }))] }), _jsxs("div", { style: { fontSize: 11, color: '#475569' }, children: [history.length, " run", history.length !== 1 ? 's' : '', " total"] })] })), _jsx("button", { type: "button", style: S.primaryBtn(false), onClick: () => { void handleRun(); }, children: "Run Test It Out" })] })), state.id === 'running' && (_jsxs(_Fragment, { children: [_jsxs("div", { style: { flexShrink: 0 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 6 }, children: [_jsxs("span", { style: { fontSize: 12, color: '#94a3b8' }, children: [state.results.length, "/", TOTAL, " questions"] }), _jsxs("span", { style: { fontSize: 12, color: '#64748b' }, children: [state.results.filter((r) => r.isCorrect).length, " correct so far"] })] }), _jsx("div", { style: S.progressBar((state.results.length / TOTAL) * 100) })] }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 10 }, children: Array.from({ length: TOTAL }).map((_, idx) => {
                                    const result = state.results[idx];
                                    if (!result) {
                                        return (_jsx("div", { style: S.questionCard(null), children: _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsxs("span", { style: { fontSize: 11, color: '#475569' }, children: ["Q", idx + 1] }), state.results.length === idx && (_jsx("span", { style: { fontSize: 11, color: '#6ee7b7', animation: 'mnemo-pulse 1.5s ease-in-out infinite' }, children: "\u25CC running\u2026" })), state.results.length < idx && (_jsx("span", { style: { fontSize: 11, color: '#334155' }, children: "waiting" }))] }) }, idx));
                                    }
                                    return (_jsxs("div", { style: S.questionCard(result.isCorrect), children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }, children: [_jsxs("span", { style: S.qLabel, children: ["Q", idx + 1] }), _jsx("span", { style: S.badge(result.isCorrect), children: result.isCorrect ? '✓' : '✗' })] }), _jsx("div", { style: S.qText, children: result.question }), !result.isCorrect && (_jsxs("div", { style: S.answerRow, children: [_jsx("div", { style: S.answerLabel(false), children: "Model answered:" }), _jsxs("div", { style: S.answerText, children: [result.modelAnswer.slice(0, 200), result.modelAnswer.length > 200 ? '…' : ''] }), _jsx("div", { style: { ...S.answerLabel(true), marginTop: 4 }, children: "Correct answer:" }), _jsx("div", { style: S.answerText, children: result.correctAnswer })] }))] }, idx));
                                }) }), _jsx("button", { type: "button", style: S.primaryBtn(true), disabled: true, children: "Running\u2026" })] })), state.id === 'complete' && (_jsxs(_Fragment, { children: [_jsxs("div", { style: { display: 'flex', alignItems: 'baseline', gap: 12 }, children: [_jsxs("div", { style: S.finalScore(state.score, state.total), children: [state.score, "/", state.total] }), _jsx("div", { style: S.scoreSub, children: state.score === state.total ? 'Perfect!' : state.score >= 3 ? 'Good run.' : 'Keep running to grow your substrate.' })] }), _jsxs("div", { style: S.ctaNote, children: [state.score > 0
                                        ? `${state.score} correct answer${state.score > 1 ? 's' : ''} written to your local substrate.`
                                        : 'No substrate writes this run. Keep going — accuracy grows with each run.', ' ', "Run again to grow your substrate."] }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 10 }, children: state.results.map((result) => (_jsxs("div", { style: S.questionCard(result.isCorrect), children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }, children: [_jsxs("span", { style: S.qLabel, children: ["Q", result.questionIndex + 1] }), _jsx("span", { style: S.badge(result.isCorrect), children: result.isCorrect ? '✓' : '✗' })] }), _jsx("div", { style: S.qText, children: result.question }), !result.isCorrect && (_jsxs("div", { style: S.answerRow, children: [_jsx("div", { style: S.answerLabel(false), children: "Model answered:" }), _jsxs("div", { style: S.answerText, children: [result.modelAnswer.slice(0, 200), result.modelAnswer.length > 200 ? '…' : ''] }), _jsx("div", { style: { ...S.answerLabel(true), marginTop: 4 }, children: "Correct answer:" }), _jsx("div", { style: S.answerText, children: result.correctAnswer })] }))] }, result.questionIndex))) }), _jsx("div", { style: { display: 'flex', gap: 10, alignItems: 'center' }, children: _jsx("button", { type: "button", style: S.primaryBtn(false), onClick: handleRunAgain, children: "Run again to grow your substrate" }) })] })), state.id === 'error' && (_jsxs(_Fragment, { children: [_jsx("div", { style: S.errorBox, children: state.message }), _jsx("button", { type: "button", style: S.primaryBtn(false), onClick: () => setState({ id: 'idle' }), children: "Retry" })] })), (state.id === 'idle' || state.id === 'complete') && history.length > 0 && (_jsxs("div", { style: { marginTop: 8 }, children: [_jsx("div", { style: { fontSize: 11, color: '#475569', marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }, children: "Run history" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: history.slice(0, 10).map((run, i) => (_jsxs("div", { style: {
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '7px 12px',
                                        borderRadius: 6,
                                        background: i === 0 && state.id === 'complete' ? 'rgba(110,231,183,0.06)' : 'rgba(255,255,255,0.02)',
                                        border: '1px solid rgba(100,116,139,0.12)',
                                    }, children: [_jsxs("div", { style: { fontSize: 12, color: '#94a3b8' }, children: [_jsxs("strong", { style: { color: run.score >= 4 ? '#6ee7b7' : run.score >= 3 ? '#fbbf24' : '#f87171' }, children: [run.score, "/", run.total] }), ' · ', formatRelativeTime(run.ts)] }), _jsx("div", { style: { fontSize: 11, color: '#475569' }, children: run.model ? run.model.split(':')[0] : '' })] }, i))) })] }))] })), _jsxs("div", { style: { marginTop: 8, paddingTop: 16, borderTop: '1px solid rgba(100,116,139,0.1)' }, children: [_jsx("div", { style: { fontSize: 11, color: '#475569', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }, children: "\uD83D\uDC8E GPQA Diamond Benchmark" }), _jsx("p", { style: { fontSize: 12, color: '#64748b', lineHeight: 1.6, margin: '0 0 10px' }, children: "198 graduate-level reasoning questions across biology, chemistry, physics. The Google-Proof gold standard for AI reasoning \u2014 measures genuine expert-level understanding. Compare Bare vs. Cooperative-Pipeline to see the cooperative-architecture lift." }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }, children: [_jsx("span", { style: { fontSize: 12, color: '#94a3b8' }, children: "Questions to run:" }), _jsxs("select", { value: diamondCount, onChange: (e) => setDiamondCount(Number(e.target.value)), style: {
                                    padding: '5px 10px', background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(100,116,139,0.25)', borderRadius: 6,
                                    color: '#e2e8f0', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
                                }, disabled: diamondRunning.id === 'running', children: [_jsx("option", { value: 15, children: "15 (quick smoke)" }), _jsx("option", { value: 50, children: "50 (default)" }), _jsx("option", { value: 99, children: "99 (half)" }), _jsx("option", { value: 198, children: "198 (full benchmark)" })] })] }), _jsxs("div", { style: { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }, children: [_jsxs("button", { type: "button", title: "Raw Gemma 4 12B \u00B7 0-shot \u00B7 no substrate \u00B7 the baseline", disabled: diamondRunning.id === 'running', onClick: () => { void handleRunDiamond('bare'); }, style: {
                                    padding: '10px 18px',
                                    background: diamondRunning.id === 'running' ? 'rgba(100,116,139,0.05)' : 'rgba(100,116,139,0.12)',
                                    border: diamondRunning.id === 'running' ? '1px solid rgba(100,116,139,0.15)' : '1px solid rgba(100,116,139,0.4)',
                                    borderRadius: 8, color: diamondRunning.id === 'running' ? '#475569' : '#94a3b8',
                                    fontSize: 13, fontWeight: 700, cursor: diamondRunning.id === 'running' ? 'not-allowed' : 'pointer',
                                    fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
                                }, children: [_jsx("span", { children: "\uD83C\uDFC6 Run Bare Diamond" }), _jsx("span", { style: { fontSize: 10, fontWeight: 400, color: '#475569' }, children: "Raw Gemma 4 12B \u00B7 0-shot \u00B7 no substrate \u00B7 the baseline" })] }), _jsxs("button", { type: "button", title: "Canonical pipeline + substrate + 3-voter concordance + Andon \u00B7 the cooperative-architecture headline", disabled: diamondRunning.id === 'running', onClick: () => { void handleRunDiamond('cooperative'); }, style: {
                                    padding: '10px 18px',
                                    background: diamondRunning.id === 'running' ? 'rgba(110,231,183,0.04)' : 'rgba(110,231,183,0.13)',
                                    border: diamondRunning.id === 'running' ? '1px solid rgba(110,231,183,0.15)' : '1px solid rgba(110,231,183,0.4)',
                                    borderRadius: 8, color: diamondRunning.id === 'running' ? '#475569' : '#6ee7b7',
                                    fontSize: 13, fontWeight: 700, cursor: diamondRunning.id === 'running' ? 'not-allowed' : 'pointer',
                                    fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
                                }, children: [_jsx("span", { children: "\uD83D\uDD2C Run Cooperative-Pipeline Diamond" }), _jsx("span", { style: { fontSize: 10, fontWeight: 400, color: '#475569' }, children: "Substrate RAG + 3-voter concordance + Andon \u00B7 the cooperative headline" })] })] }), _jsxs("p", { style: { fontSize: 10, color: '#475569', margin: '0 0 10px', fontStyle: 'italic' }, children: ["Methodology: 0-shot \u00B7 per BP080 canon \u00B7", ' ', _jsx("span", { title: "GPQA Diamond uses 0-shot evaluation per Google's IT-model evaluation pattern. Do not change methodology without Founder re-ratify (BP080 methodology lock).", style: { cursor: 'help', borderBottom: '1px dotted #475569' }, children: "\u24D8 locked" })] }), diamondRunning.id === 'running' && (_jsxs("div", { style: { marginBottom: 12 }, children: [_jsxs("div", { style: {
                                    padding: '10px 14px', background: 'rgba(110,231,183,0.05)',
                                    border: '1px solid rgba(110,231,183,0.2)', borderRadius: 8, marginBottom: 8,
                                }, children: [_jsxs("div", { style: { fontSize: 12, color: '#6ee7b7', animation: 'mnemo-pulse 1.5s ease-in-out infinite', marginBottom: 4 }, children: ["\u25CC ", diamondRunning.mode === 'cooperative' ? '🔬 Cooperative-Pipeline' : '🏆 Bare', " Diamond running\u2026"] }), _jsxs("div", { style: { fontSize: 11, color: '#94a3b8' }, children: ["Q", diamondRunning.currentQ, "/", diamondRunning.total, " \u00B7", ' ', diamondRunning.currentDomain, " \u00B7", ' ', diamondRunning.stage, " \u00B7", ' ', diamondRunning.runningPct.toFixed(1), "% running accuracy"] }), _jsx("div", { style: {
                                            height: 3, borderRadius: 2, marginTop: 6,
                                            background: `linear-gradient(to right, #6ee7b7 ${diamondRunning.total > 0 ? (diamondRunning.currentQ / diamondRunning.total) * 100 : 0}%, rgba(110,231,183,0.1) ${diamondRunning.total > 0 ? (diamondRunning.currentQ / diamondRunning.total) * 100 : 0}%)`,
                                        } })] }), _jsx("button", { type: "button", onClick: () => { void handleCancelDiamond(); }, style: {
                                    padding: '6px 14px', background: 'rgba(239,68,68,0.08)',
                                    border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6,
                                    color: '#f87171', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                                }, children: "Cancel" })] })), diamondRunning.id === 'error' && (_jsxs("div", { style: { marginBottom: 10 }, children: [_jsx("div", { style: {
                                    padding: '10px 14px', background: 'rgba(239,68,68,0.05)',
                                    border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8,
                                    fontSize: 12, color: '#f87171', marginBottom: 8,
                                }, children: diamondRunning.message }), _jsx("button", { type: "button", onClick: () => setDiamondRunning({ id: 'idle' }), style: {
                                    padding: '6px 14px', background: 'rgba(110,231,183,0.08)',
                                    border: '1px solid rgba(110,231,183,0.25)', borderRadius: 6,
                                    color: '#6ee7b7', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                                }, children: "Retry" })] })), lastDiamondResult && diamondRunning.id !== 'running' && (_jsxs("div", { style: {
                            padding: '14px 16px', background: 'rgba(110,231,183,0.04)',
                            border: '1px solid rgba(110,231,183,0.18)', borderRadius: 10, marginBottom: 12,
                        }, children: [_jsxs("div", { style: { fontSize: 13, fontWeight: 700, color: '#6ee7b7', marginBottom: 8 }, children: [lastDiamondResult.mode === 'bare' ? '🏆 Bare Diamond' : '🔬 Cooperative-Pipeline Diamond', " Result"] }), _jsxs("div", { style: { fontSize: 22, fontWeight: 800, color: '#e2e8f0', marginBottom: 4 }, children: [lastDiamondResult.correct, "/", lastDiamondResult.total, " correct = ", lastDiamondResult.score_pct.toFixed(1), "%"] }), bareResult && coopResult && (_jsxs("div", { style: {
                                    fontSize: 13, fontWeight: 600, marginBottom: 10,
                                    color: coopResult.score_pct > bareResult.score_pct ? '#6ee7b7' : '#fbbf24',
                                }, children: ["Cooperative-architecture lift: ", coopResult.score_pct > bareResult.score_pct ? '+' : '', (coopResult.score_pct - bareResult.score_pct).toFixed(1), " pp", ' ', "(Bare: ", bareResult.score_pct.toFixed(1), "% \u2192 Coop: ", coopResult.score_pct.toFixed(1), "%)"] })), _jsxs("table", { style: { width: '100%', borderCollapse: 'collapse', fontSize: 12 }, children: [_jsx("thead", { children: _jsx("tr", { children: ['Domain', 'Score', 'Correct/Total'].map((h) => (_jsx("th", { style: { textAlign: 'left', color: '#64748b', fontWeight: 600, paddingBottom: 4, paddingRight: 12 }, children: h }, h))) }) }), _jsx("tbody", { children: ['physics', 'chemistry', 'biology'].map((domain) => {
                                            const s = lastDiamondResult?.by_domain?.[domain];
                                            if (!s || s.total === 0)
                                                return null;
                                            return (_jsxs("tr", { children: [_jsx("td", { style: { color: '#94a3b8', paddingRight: 12, paddingBottom: 3 }, children: domain }), _jsxs("td", { style: { color: s.score_pct >= 50 ? '#6ee7b7' : '#fbbf24', fontWeight: 600, paddingRight: 12 }, children: [s.score_pct.toFixed(1), "%"] }), _jsxs("td", { style: { color: '#64748b' }, children: [s.correct, "/", s.total] })] }, domain));
                                        }) })] })] }))] }), _jsxs("div", { style: { marginTop: 8, paddingTop: 16, borderTop: '1px solid rgba(100,116,139,0.1)' }, children: [_jsx("div", { style: { fontSize: 11, color: '#475569', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }, children: "Substrate Settings" }), _jsx(SubstrateSeedPanel, {})] }), _jsxs("div", { style: { marginTop: 8, paddingTop: 16, borderTop: '1px solid rgba(100,116,139,0.1)' }, children: [_jsx("div", { style: { fontSize: 11, color: '#475569', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }, children: "My Self-Context" }), _jsx("div", { style: { fontSize: 12, color: '#64748b', marginBottom: 10, lineHeight: 1.6 }, children: "MEMORY.md is injected as a system prompt on every Ask query \u2014 it tells MnemosyneC who she is, what runtime she's on, and her substrate layout. Edit to customize; Reload to apply live." }), _jsxs("div", { style: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }, children: [_jsx("button", { type: "button", style: {
                                    padding: '7px 14px', background: 'rgba(110,231,183,0.1)',
                                    border: '1px solid rgba(110,231,183,0.3)', borderRadius: 7,
                                    color: '#6ee7b7', fontSize: 12, fontWeight: 600, cursor: selfCtxLoading ? 'not-allowed' : 'pointer',
                                    fontFamily: 'inherit', opacity: selfCtxLoading ? 0.5 : 1,
                                }, disabled: selfCtxLoading, onClick: () => { void handleSelfCtxEdit(); }, children: "\u270F\uFE0F Edit in Default Editor" }), _jsx("button", { type: "button", style: {
                                    padding: '7px 14px', background: 'rgba(99,102,241,0.08)',
                                    border: '1px solid rgba(99,102,241,0.25)', borderRadius: 7,
                                    color: '#818cf8', fontSize: 12, fontWeight: 600, cursor: selfCtxLoading ? 'not-allowed' : 'pointer',
                                    fontFamily: 'inherit', opacity: selfCtxLoading ? 0.5 : 1,
                                }, disabled: selfCtxLoading, onClick: () => { void handleSelfCtxReload(); }, children: "\uD83D\uDD04 Reload" }), _jsx("button", { type: "button", style: {
                                    padding: '7px 14px',
                                    background: resetConfirm ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.03)',
                                    border: resetConfirm ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(100,116,139,0.2)',
                                    borderRadius: 7,
                                    color: resetConfirm ? '#f87171' : '#64748b',
                                    fontSize: 12, fontWeight: 600,
                                    cursor: selfCtxLoading ? 'not-allowed' : 'pointer',
                                    fontFamily: 'inherit', opacity: selfCtxLoading ? 0.5 : 1,
                                }, disabled: selfCtxLoading, onClick: () => { void handleSelfCtxReset(); }, children: resetConfirm ? '⚠️ Confirm Reset' : '↩ Reset to Template' })] }), selfCtxStatus && (_jsx("div", { style: { fontSize: 11, color: selfCtxStatus.startsWith('Error') || selfCtxStatus.startsWith('Reload failed') || selfCtxStatus.startsWith('Reset failed') || selfCtxStatus.startsWith('Open failed') ? '#f87171' : '#6ee7b7', marginBottom: 8 }, children: selfCtxStatus })), selfCtxContent !== null && (_jsx("div", { style: {
                            background: 'rgba(0,0,0,0.35)',
                            border: '1px solid rgba(100,116,139,0.2)',
                            borderRadius: 8,
                            padding: '12px 14px',
                            maxHeight: 260,
                            overflowY: 'auto',
                        }, children: _jsx("pre", { style: {
                                margin: 0, fontSize: 11, color: '#94a3b8',
                                fontFamily: 'monospace', whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word', lineHeight: 1.6,
                            }, children: selfCtxContent }) })), selfCtxContent === null && selfCtxLoading && (_jsx("div", { style: { fontSize: 12, color: '#475569', fontStyle: 'italic' }, children: "\u25CC Loading MEMORY.md\u2026" })), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }, children: [_jsxs("button", { type: "button", style: {
                                    padding: '6px 12px', background: 'rgba(250,204,21,0.08)',
                                    border: '1px solid rgba(250,204,21,0.3)', borderRadius: 7,
                                    color: '#facc15', fontSize: 11, fontWeight: 600,
                                    cursor: chocolateRefreshLoading ? 'not-allowed' : 'pointer',
                                    fontFamily: 'inherit', opacity: chocolateRefreshLoading ? 0.5 : 1,
                                }, disabled: chocolateRefreshLoading, onClick: () => { void handleRefreshChocolatePack(); }, children: ["\uD83C\uDF6B ", chocolateRefreshLoading ? 'Refreshing…' : 'Refresh Chocolate Pack'] }), _jsx("span", { style: { fontSize: 10, color: '#475569' }, children: "Folds this session's live plow writes back into the 14 deduped, versioned category packages (also runs automatically on quit)." })] }), chocolateRefreshStatus && (_jsx("div", { style: { fontSize: 11, color: chocolateRefreshStatus.startsWith('Refresh failed') ? '#f87171' : '#6ee7b7', marginTop: 6 }, children: chocolateRefreshStatus })), _jsx("div", { style: { fontSize: 11, color: '#475569', marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(100,116,139,0.12)' }, children: "\uD83E\uDDC2 Three salt-layers: Substrate \u00B7 Federation \u00B7 Human." })] }), benchmarkModalOpen && (_jsx(BenchmarkModal, { onClose: () => setBenchmarkModalOpen(false) })), meshModalOpen && (_jsx(MeshComparisonModal, { onClose: () => setMeshModalOpen(false) }))] }));
}
