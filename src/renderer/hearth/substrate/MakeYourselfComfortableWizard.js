import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// MnemosyneC — Make Yourself Comfortable Wizard + OnboardingWizard (sidebar)
// BP041 Canon: "What do you want substrate access to for yourself?"
// Folder picker → dual-checkbox (Pixie-lated for ME / Shared with Federation)
// Pantheon dispatch progress (LiveSegWatch-style)
// Member sovereignty: all OFF by default; member must explicitly check.
//
// BP065 v0.1.23 — OnboardingWizard revamp: 6-click → minimal-click per canon:
//   canon_onboarding_minimal_clicks_sensible_defaults_skip_everything_explain_or_skip_bp065
//   canon_mnemosynec_minimum_install_substrate_only_no_ollama_no_key_any_hardware_bp065
//   canon_ai_burst_works_key_free_by_default_api_key_optional_never_block_untech_bp065
// Now 3 screens: Welcome · Quick Setup · All Set. Keypair auto-generated silently.
// Ollama card removed from sidebar (jargon, not needed at onboarding).
// "Skip all → open the app" on every screen.
import { useState, useEffect, useCallback, useRef } from 'react';
import { ScreenWelcome, ScreenSetup, ScreenAllSet, } from './OnboardingScreens';
import { LocFaqModal } from '../../components/LocFaqPanel';
// ─── OnboardingWizard (non-blocking sidebar) ──────────────────────────────────
// KniPr012: converted from full-page replacement to position:fixed right sidebar.
// Main app content is visible and interactive behind it.
// BP065: reduced to 3 screens, Ollama card removed, keypair auto-generated silently.
const ONBOARDED_KEY = 'mnemosyne-onboarded';
const TOTAL_STEPS = 3;
const C = {
    bg: '#0a0f1a',
    surface: '#111827',
    border: '#1e2d45',
    text: '#e2e8f0',
    muted: '#64748b',
    accent: '#3b82f6',
    green: '#22c55e',
    amber: '#f59e0b',
};
// ─── OnboardingWizard ─────────────────────────────────────────────────────────
// BP065 v0.1.23: 3-screen minimal flow. Ollama card removed (jargon).
// Keypair auto-generated silently in ScreenWelcome. Skip-all on every screen.
// Setup prefs (shortcut, startup, apiKey) applied via IPC on Screen 2 → 3 transition.
export function OnboardingWizard({ onComplete }) {
    const [step, setStep] = useState(1);
    const [collected, setCollected] = useState({});
    const [showLocFaq, setShowLocFaq] = useState(false);
    const finish = () => {
        try {
            localStorage.setItem(ONBOARDED_KEY, 'true');
        }
        catch { /* ignore */ }
        onComplete();
    };
    const applySetupPrefs = async (prefs) => {
        try {
            await window.amplify?.applyOnboardingPrefs?.(prefs);
        }
        catch { /* non-fatal: prefs are best-effort */ }
    };
    const handleNext = (data) => {
        const merged = data ? { ...collected, ...data } : collected;
        setCollected(merged);
        if (step === TOTAL_STEPS) {
            finish();
        }
        else {
            // On transition from Screen 2 (setup), apply prefs in background
            if (step === 2 && data) {
                void applySetupPrefs({
                    displayName: data.displayName ?? '',
                    addDesktopShortcut: data.addDesktopShortcut ?? true,
                    addStartupItem: data.addStartupItem ?? false,
                    apiKey: data.apiKey ?? '',
                });
            }
            setStep((prev) => (prev + 1));
        }
    };
    const handleBack = () => {
        if (step > 1)
            setStep((prev) => (prev - 1));
    };
    const screenProps = {
        onNext: handleNext,
        onBack: handleBack,
        onSkip: finish,
        step,
        totalSteps: TOTAL_STEPS,
        collected,
    };
    return (_jsxs(_Fragment, { children: [_jsx("div", { style: {
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.25)',
                    zIndex: 800,
                    pointerEvents: 'none',
                }, "aria-hidden": "true" }), _jsxs("div", { role: "dialog", "aria-modal": "false", "aria-label": "MnemosyneC first-run setup", style: {
                    position: 'fixed',
                    right: 0,
                    top: 0,
                    height: '100%',
                    width: 400,
                    background: C.bg,
                    borderLeft: `1px solid ${C.border}`,
                    boxShadow: '-8px 0 32px rgba(0,0,0,0.6)',
                    zIndex: 801,
                    display: 'flex',
                    flexDirection: 'column',
                    overflowY: 'auto',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                }, children: [_jsx("button", { onClick: finish, "aria-label": "Skip setup \u2014 open the app now", style: {
                            position: 'absolute',
                            top: 12,
                            right: 14,
                            background: 'none',
                            border: 'none',
                            color: C.muted,
                            cursor: 'pointer',
                            fontSize: 18,
                            lineHeight: 1,
                            padding: '2px 4px',
                            zIndex: 1,
                        }, title: "Skip setup \u2014 all options available in Settings later", children: "\u00D7" }), _jsxs("div", { style: { fontSize: 10, color: C.muted, textAlign: 'center', paddingTop: 20 }, children: ["Step ", step, " of ", TOTAL_STEPS] }), _jsxs("div", { style: { flex: 1, padding: '8px 24px 20px' }, children: [step === 1 && _jsx(ScreenWelcome, { ...screenProps }), step === 2 && _jsx(ScreenSetup, { ...screenProps }), step === 3 && _jsx(ScreenAllSet, { ...screenProps })] }), _jsxs("div", { style: {
                            borderTop: '1px solid rgba(100,116,139,0.15)',
                            padding: '10px 24px',
                            flexShrink: 0,
                        }, children: [_jsx("button", { onClick: () => setShowLocFaq(true), style: {
                                    background: 'none',
                                    border: 'none',
                                    color: '#6ee7b7',
                                    cursor: 'pointer',
                                    fontSize: 11,
                                    fontWeight: 500,
                                    padding: 0,
                                    textDecoration: 'underline',
                                    textDecorationColor: 'rgba(110,231,183,0.35)',
                                    fontFamily: 'inherit',
                                }, children: "Learn about the Grand Project \u2192" }), _jsx("div", { style: { fontSize: 9, color: '#334155', marginTop: 2 }, children: "Library of Congress \u00B7 10,000-node cooperative network" })] })] }), showLocFaq && _jsx(LocFaqModal, { onClose: () => setShowLocFaq(false) })] }));
}
// BP067 v0.1.24 — OnboardingWizard deferred per BP067 (one-spine first-run supersedes sidebar wizard).
// OnboardingGate is a pass-through; optional wizard available later via Settings if needed.
export function OnboardingGate({ children }) {
    return _jsx(_Fragment, { children: children });
}
const PERSONA_DISPLAY = {
    miner: { icon: '🛠️', label: 'Miners' },
    fates: { icon: '🧶', label: 'Fates' },
    forager: { icon: '🦊', label: 'Foragers' },
    pixies: { icon: '🧚', label: 'Pixies' },
    shadow_spider: { icon: '🕷️', label: 'Shadow E-Spiders' },
    shadow_sprite: { icon: '🧝', label: 'Shadow E-Sprites' },
};
// ─── Sub-components ───────────────────────────────────────────────────────────
function PersonaProgressRow({ evt }) {
    const meta = PERSONA_DISPLAY[evt.persona] ?? { icon: '🔮', label: evt.persona };
    const isDone = evt.phase === 'done';
    const isError = evt.phase === 'error';
    return (_jsxs("div", { style: {
            display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0',
            opacity: isDone ? 0.75 : 1,
        }, children: [_jsx("span", { style: { fontSize: 16, minWidth: 22 }, children: meta.icon }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6 }, children: [_jsx("span", { style: { fontSize: 11, fontWeight: 600, color: '#c9d1d9' }, children: meta.label }), isDone && _jsx("span", { style: { fontSize: 10, color: '#3fb950' }, children: "\u2713" }), isError && _jsx("span", { style: { fontSize: 10, color: '#f85149' }, children: "\u2717" }), evt.tablets_written !== undefined && evt.tablets_written > 0 && (_jsxs("span", { style: { fontSize: 10, color: '#58a6ff', marginLeft: 'auto' }, children: ["+", evt.tablets_written, " tablets"] }))] }), _jsx("div", { style: { fontSize: 10, color: isError ? '#f85149' : '#8b949e', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, children: evt.message })] })] }));
}
function FolderRow({ pref, onToggle, onRemove, onMine, isMining, }) {
    const short = pref.folder_path.split(/[\\/]/).slice(-2).join('/');
    return (_jsxs("div", { style: {
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: 8,
            padding: '12px 14px',
            marginBottom: 8,
        }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }, children: [_jsx("span", { style: { fontSize: 16 }, children: "\uD83D\uDCC2" }), _jsx("span", { style: { flex: 1, fontSize: 12, color: '#c9d1d9', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: pref.folder_path, children: short }), _jsx("button", { onClick: onRemove, style: { background: 'none', border: 'none', color: '#6e7681', cursor: 'pointer', fontSize: 14, padding: '0 4px' }, title: "Remove folder", children: "\u2715" })] }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }, children: [_jsxs("label", { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }, children: [_jsx("input", { type: "checkbox", checked: pref.pixelated, onChange: (e) => onToggle('pixelated', e.target.checked), style: { accentColor: '#58a6ff' } }), _jsxs("span", { style: { fontSize: 11, color: '#c9d1d9' }, children: ["\uD83E\uDDDA ", _jsx("strong", { children: "Pixie-lated for ME" }), _jsx("span", { style: { color: '#8b949e', marginLeft: 4 }, children: "(private substrate)" })] })] }), _jsxs("label", { style: {
                            display: 'flex', alignItems: 'center', gap: 8, cursor: pref.pixelated ? 'pointer' : 'not-allowed',
                            opacity: pref.pixelated ? 1 : 0.4,
                        }, children: [_jsx("input", { type: "checkbox", checked: pref.federation_shared, disabled: !pref.pixelated, onChange: (e) => onToggle('federation_shared', e.target.checked), style: { accentColor: '#3fb950' } }), _jsxs("span", { style: { fontSize: 11, color: '#c9d1d9' }, children: ["\uD83C\uDF10 ", _jsx("strong", { children: "Shared with Federation" }), _jsx("span", { style: { color: '#8b949e', marginLeft: 4 }, children: "(cooperative opt-in)" })] })] })] }), pref.tablet_counts && (_jsxs("div", { style: { fontSize: 10, color: '#8b949e', marginBottom: 8 }, children: [pref.tablet_counts.iron, " Iron Tablets \u00B7 ", pref.tablet_counts.stone, " Stone Tablets", pref.last_mined_at && _jsxs("span", { style: { marginLeft: 8 }, children: ["\u00B7 last mined ", pref.last_mined_at.slice(0, 10)] })] })), _jsx("button", { onClick: onMine, disabled: !pref.pixelated || isMining, style: {
                    background: pref.pixelated && !isMining ? '#1f6feb' : '#21262d',
                    border: '1px solid #30363d',
                    borderRadius: 6,
                    color: pref.pixelated && !isMining ? '#fff' : '#6e7681',
                    cursor: pref.pixelated && !isMining ? 'pointer' : 'not-allowed',
                    fontSize: 11,
                    padding: '5px 12px',
                    width: '100%',
                }, children: isMining ? '⏳ Pantheon descending...' : '🪄 Begin Mining →' })] }));
}
// ─── Main wizard ──────────────────────────────────────────────────────────────
export function MakeYourselfComfortableWizard() {
    const [memberId] = useState('founder'); // Phase A: founder-id; Phase B: from auth
    const [prefs, setPrefs] = useState(null);
    const [progressLog, setProgressLog] = useState([]);
    const [miningFolder, setMiningFolder] = useState(null);
    const [miningReceipt, setMiningReceipt] = useState(null);
    const [tabletCounts, setTabletCounts] = useState(null);
    const [error, setError] = useState(null);
    const progressEndRef = useRef(null);
    const loadPrefs = useCallback(async () => {
        try {
            const p = (await window.amplify.pantheonGetPrefs(memberId));
            setPrefs(p);
        }
        catch (e) {
            setError(String(e));
        }
    }, [memberId]);
    const loadTabletCounts = useCallback(async () => {
        try {
            const c = await window.amplify.pantheonCountTablets(memberId);
            setTabletCounts(c);
        }
        catch { /* non-fatal */ }
    }, [memberId]);
    useEffect(() => {
        void loadPrefs();
        void loadTabletCounts();
        const unsub = window.amplify.onPantheonProgress((evt) => {
            const progress = evt;
            setProgressLog((prev) => {
                // SEG-3: findLastIndex not in es2022 lib — manual reverse search
                let idx = -1;
                for (let i = prev.length - 1; i >= 0; i--) {
                    if (prev[i].persona === progress.persona) {
                        idx = i;
                        break;
                    }
                }
                if (idx >= 0 && prev[idx].phase !== 'done' && prev[idx].phase !== 'error') {
                    const next = [...prev];
                    next[idx] = progress;
                    return next;
                }
                return [...prev, progress];
            });
            if (progress.phase === 'done' || progress.phase === 'error') {
                void loadTabletCounts();
            }
        });
        return () => unsub();
    }, [loadPrefs, loadTabletCounts]);
    useEffect(() => {
        progressEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [progressLog]);
    const handlePickFolder = async () => {
        const folder = await window.amplify.pantheonPickFolder();
        if (!folder)
            return;
        await window.amplify.pantheonSetPref(memberId, folder, true, false);
        await loadPrefs();
    };
    const handleToggle = async (folderPath, field, val) => {
        const current = prefs?.folders.find((f) => f.folder_path === folderPath);
        if (!current)
            return;
        const pixelated = field === 'pixelated' ? val : current.pixelated;
        const federation_shared = field === 'federation_shared' ? val : current.federation_shared;
        await window.amplify.pantheonSetPref(memberId, folderPath, pixelated, federation_shared);
        await loadPrefs();
    };
    const handleRemove = async (folderPath) => {
        await window.amplify.pantheonRemovePref(memberId, folderPath);
        await loadPrefs();
    };
    const handleMine = async (pref) => {
        if (miningFolder)
            return;
        setMiningFolder(pref.folder_path);
        setProgressLog([]);
        setMiningReceipt(null);
        setError(null);
        try {
            const scope = pref.federation_shared ? 'federation' : 'private';
            const receipt = await window.amplify.pantheonDispatch(memberId, pref.folder_path, scope);
            setMiningReceipt(receipt);
            await loadPrefs();
            await loadTabletCounts();
        }
        catch (e) {
            setError(String(e));
        }
        finally {
            setMiningFolder(null);
        }
    };
    const handleWipe = async () => {
        if (!confirm('Wipe all your Tablets? This cannot be undone.'))
            return;
        const result = await window.amplify.pantheonWipe(memberId);
        setProgressLog([]);
        setMiningReceipt(null);
        await loadTabletCounts();
        alert(`Wiped ${result.wiped} tablets. Your substrate is clear.`);
    };
    // ─── Render ────────────────────────────────────────────────────────────────
    return (_jsxs("div", { style: {
            background: '#0d1117',
            color: '#c9d1d9',
            fontFamily: 'system-ui, sans-serif',
            height: '100%',
            overflowY: 'auto',
            padding: 16,
        }, children: [_jsxs("div", { style: { marginBottom: 16 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }, children: [_jsx("span", { style: { fontSize: 20 }, children: "\uD83E\uDE91" }), _jsx("h2", { style: { margin: 0, fontSize: 16, fontWeight: 700 }, children: "Make Yourself Comfortable" })] }), _jsxs("p", { style: { margin: 0, fontSize: 11, color: '#8b949e', lineHeight: 1.5 }, children: ["What do you want substrate access to for yourself?", _jsx("br", {}), "The Pantheon descends on your chosen folders:\u00A0", _jsx("span", { style: { color: '#c9d1d9' }, children: "Miners \u00B7 Fates \u00B7 Foragers \u00B7 Pixies \u00B7 Spiders \u00B7 Sprites" })] })] }), tabletCounts && tabletCounts.total > 0 && (_jsxs("div", { style: {
                    background: '#161b22',
                    border: '1px solid #30363d',
                    borderRadius: 8,
                    padding: '8px 14px',
                    marginBottom: 12,
                    display: 'flex',
                    gap: 16,
                    alignItems: 'center',
                }, children: [_jsx("span", { style: { fontSize: 12 }, children: "\uD83D\uDDC2\uFE0F Your Substrate" }), _jsxs("span", { style: { fontSize: 11, color: '#8b949e' }, children: ["\u2699\uFE0F ", tabletCounts.iron, " Iron Tablets"] }), _jsxs("span", { style: { fontSize: 11, color: '#e3b341' }, children: ["\uD83D\uDDFF ", tabletCounts.stone, " Stone Tablets"] }), _jsx("button", { onClick: handleWipe, style: {
                            marginLeft: 'auto',
                            background: 'none',
                            border: '1px solid #6e7681',
                            borderRadius: 4,
                            color: '#6e7681',
                            cursor: 'pointer',
                            fontSize: 10,
                            padding: '2px 8px',
                        }, children: "Wipe Substrate" })] })), _jsxs("div", { style: {
                    background: '#0f1923',
                    border: '1px solid #1f3a52',
                    borderRadius: 8,
                    padding: '8px 12px',
                    marginBottom: 12,
                    fontSize: 10,
                    color: '#58a6ff',
                    lineHeight: 1.6,
                }, children: ["\uD83D\uDEE1\uFE0F Your data stays on ", _jsx("strong", { children: "YOUR computer" }), ". Federation sharing is per-folder opt-in only. You can stop, pause, or wipe your substrate at any time."] }), error && (_jsxs("div", { style: { color: '#f85149', fontSize: 11, marginBottom: 8, padding: '6px 10px', background: '#1c0a0a', borderRadius: 6 }, children: ["\u2717 ", error] })), prefs?.folders.map((pref) => (_jsx(FolderRow, { pref: pref, onToggle: (field, val) => void handleToggle(pref.folder_path, field, val), onRemove: () => void handleRemove(pref.folder_path), onMine: () => void handleMine(pref), isMining: miningFolder === pref.folder_path }, pref.folder_path))), _jsx("button", { onClick: () => void handlePickFolder(), style: {
                    background: '#21262d',
                    border: '1px dashed #30363d',
                    borderRadius: 8,
                    color: '#58a6ff',
                    cursor: 'pointer',
                    fontSize: 12,
                    padding: '10px 14px',
                    width: '100%',
                    marginBottom: 12,
                    textAlign: 'left',
                }, children: "+ Add folder..." }), progressLog.length > 0 && (_jsxs("div", { style: {
                    background: '#0f1117',
                    border: '1px solid #30363d',
                    borderRadius: 8,
                    padding: '10px 12px',
                    marginBottom: 10,
                }, children: [_jsxs("div", { style: { fontSize: 11, fontWeight: 600, color: '#8b949e', marginBottom: 6 }, children: ["\uD83E\uDE84 Pantheon descending", miningFolder && _jsx("span", { style: { color: '#58a6ff', marginLeft: 6, fontFamily: 'monospace', fontSize: 10 }, children: miningFolder.split(/[\\/]/).slice(-1)[0] })] }), progressLog.map((evt, i) => (_jsx(PersonaProgressRow, { evt: evt }, `${evt.persona}-${i}`))), _jsx("div", { ref: progressEndRef })] })), miningReceipt != null && (() => {
                const r = miningReceipt;
                return (_jsxs("div", { style: {
                        background: '#0f1a0f',
                        border: '1px solid #238636',
                        borderRadius: 8,
                        padding: '10px 14px',
                        fontSize: 11,
                        color: '#3fb950',
                    }, children: ["\u2713 Mining complete \u2014 ", r.total_tablets, " Tablets generated (", r.iron_tablets, " Iron, ", r.stone_tablets, " Stone)", _jsx("span", { style: { color: '#8b949e', marginLeft: 8 }, children: r.completed_at?.slice(0, 19).replace('T', ' ') })] }));
            })(), (!prefs?.folders || prefs.folders.length === 0) && (_jsxs("div", { style: {
                    marginTop: 8,
                    textAlign: 'center',
                    fontSize: 10,
                    color: '#6e7681',
                }, children: ["No folders selected. Add a folder above to let the Pantheon descend.", _jsx("br", {}), _jsx("span", { style: { fontStyle: 'italic' }, children: "Your substrate respects \"no permission to scan\" as canonical state." })] }))] }));
}
