import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// SkuUpgradePanel.tsx -- BP078 Scope 6.5 / M18b
// In-app SKU upgrade panel. Settings surface (NOT fullscreen overlay).
// Shows NANO / LITE / CORE / FULL / ULTRA tiers.
// M18b: right-size.json override wiring; getTileState; dynamic model names; Caithedral sweep.
import { useEffect, useState, useCallback, useRef } from 'react';
const SKU_TIERS = [
    {
        id: 'nano',
        name: 'NANO',
        tagline: 'Private AI, zero cloud.',
        model: 'qwen2.5:0.5b',
        modelSize: '~500 MB bundled',
        features: ['Private local AI', 'Floor model included', 'Basic substrate search'],
        downloadSize: null,
    },
    {
        id: 'lite',
        name: 'LITE',
        tagline: 'Balanced power and speed.',
        model: 'gemma2:2b',
        modelSize: '~2 GB download',
        features: ['gemma2:2b model', 'Fast local inference', 'Substrate search'],
        downloadSize: '~2 GB',
    },
    {
        id: 'core',
        name: 'CORE',
        tagline: 'Enhanced local intelligence.',
        model: 'gemma2:9b',
        modelSize: '~6 GB download',
        features: ['gemma2:9b model', 'Mnem-DRT enabled', 'Substrate depth'],
        downloadSize: '~6 GB',
    },
    {
        id: 'full',
        name: 'FULL',
        tagline: 'Flagship AI, private and local.',
        model: 'gemma4:12b',
        modelSize: '~7 GB download',
        features: ["Google's Gemma 4 12B model", 'Mnem-DRT enabled', 'All 10 specialists', 'Full substrate depth'],
        downloadSize: '~7 GB',
    },
    {
        id: 'ultra',
        name: 'ULTRA',
        tagline: 'Maximum local intelligence.',
        model: 'llama3.3:70b',
        modelSize: '~42 GB download',
        features: ['llama3.3:70b model', 'Top-tier local AI', 'Full Caithedral depth', '64GB+ RAM required'],
        downloadSize: '~42 GB',
    },
];
// ── M18b: Tier ordering and model map ────────────────────────────────────────
const TIER_ORDER = ['nano', 'lite', 'core', 'full', 'ultra'];
const TIER_MODEL_MAP = {
    nano: 'qwen2.5:0.5b (bundled)',
    lite: 'gemma2:2b',
    core: 'gemma2:9b',
    full: 'gemma4:12b',
    ultra: 'llama3.3:70b',
};
function getTileState(tileTier, effectiveTier, autoDetectedTier) {
    if (tileTier === effectiveTier)
        return 'active';
    const tileIdx = TIER_ORDER.indexOf(tileTier);
    const hwIdx = TIER_ORDER.indexOf(autoDetectedTier);
    if (tileIdx <= hwIdx)
        return 'available';
    if (tileIdx === hwIdx + 1)
        return 'challenge-destiny';
    return 'insufficient';
}
// ── Helpers ──────────────────────────────────────────────────────────────────
const SPIN_KEYFRAMES = `@keyframes sup-spin { to { transform: rotate(360deg); } }`;
function bytesToGB(bytes) {
    return (bytes / 1073741824).toFixed(1);
}
function progressFraction(downloaded, total) {
    if (total <= 0 || downloaded <= 0)
        return 0;
    return Math.min(downloaded / total, 1);
}
// ── Sub-components ───────────────────────────────────────────────────────────
function CheckIcon() {
    return (_jsxs("svg", { width: "20", height: "20", viewBox: "0 0 32 32", fill: "none", "aria-hidden": "true", children: [_jsx("circle", { cx: "16", cy: "16", r: "15", fill: "rgba(74,222,128,0.15)", stroke: "#4ade80", strokeWidth: "1.5" }), _jsx("path", { d: "M9 16.5l5 5 9-9", stroke: "#4ade80", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" })] }));
}
// ── Styles ───────────────────────────────────────────────────────────────────
const S = {
    panel: {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: '#0d1117',
        borderRadius: 12,
        padding: '28px 24px',
        maxWidth: 560,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: 700,
        color: '#6ee7b7',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        marginBottom: 20,
    },
    tiersGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
        marginBottom: 20,
    },
    tierCard: (active, dimmed) => ({
        background: active ? 'rgba(110,231,183,0.06)' : '#111827',
        border: active
            ? '1px solid rgba(110,231,183,0.4)'
            : '1px solid rgba(100,116,139,0.2)',
        borderRadius: 10,
        padding: '14px 14px 12px',
        opacity: dimmed ? 0.45 : 1,
        transition: 'opacity 0.2s',
    }),
    tierName: {
        fontSize: 13,
        fontWeight: 800,
        color: '#e2e8f0',
        letterSpacing: '0.06em',
        marginBottom: 2,
    },
    tierTagline: {
        fontSize: 11,
        color: '#64748b',
        lineHeight: 1.5,
        marginBottom: 8,
    },
    tierFeature: {
        fontSize: 11,
        color: '#475569',
        lineHeight: 1.7,
        display: 'flex',
        gap: 5,
        alignItems: 'flex-start',
    },
    activeBadge: {
        display: 'inline-block',
        fontSize: 10,
        fontWeight: 700,
        color: '#4ade80',
        background: 'rgba(74,222,128,0.12)',
        border: '1px solid rgba(74,222,128,0.3)',
        borderRadius: 4,
        padding: '2px 7px',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    comingSoonBadge: {
        display: 'inline-block',
        fontSize: 10,
        fontWeight: 600,
        color: '#475569',
        background: 'rgba(71,85,105,0.15)',
        border: '1px solid rgba(71,85,105,0.25)',
        borderRadius: 4,
        padding: '2px 7px',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    modelSizeLabel: {
        fontSize: 10,
        color: '#334155',
        marginTop: 6,
    },
    upgradeBtn: {
        marginTop: 10,
        width: '100%',
        padding: '8px 12px',
        background: 'rgba(110,231,183,0.13)',
        border: '1px solid rgba(110,231,183,0.4)',
        borderRadius: 7,
        color: '#6ee7b7',
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
        textAlign: 'center',
    },
    activateBtn: {
        marginTop: 10,
        width: '100%',
        padding: '8px 12px',
        background: 'rgba(99,102,241,0.13)',
        border: '1px solid rgba(99,102,241,0.4)',
        borderRadius: 7,
        color: '#a5b4fc',
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
        textAlign: 'center',
    },
    progressTrack: {
        height: 5,
        background: 'rgba(110,231,183,0.15)',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 8,
    },
    progressRow: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 11,
        color: '#64748b',
        marginBottom: 4,
    },
    spinnerStyle: {
        width: 14,
        height: 14,
        border: '2px solid rgba(110,231,183,0.2)',
        borderTopColor: '#6ee7b7',
        borderRadius: '50%',
        animation: 'sup-spin 0.8s linear infinite',
        display: 'inline-block',
        flexShrink: 0,
    },
    cancelBtn: {
        marginTop: 8,
        width: '100%',
        padding: '7px 12px',
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.22)',
        borderRadius: 7,
        color: '#fca5a5',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        textAlign: 'center',
    },
    ghostBtn: {
        display: 'block',
        width: '100%',
        textAlign: 'center',
        background: 'none',
        border: 'none',
        color: '#334155',
        fontSize: 11,
        cursor: 'pointer',
        padding: '6px 0 0',
    },
    retryBtn: {
        marginTop: 8,
        width: '100%',
        padding: '7px 12px',
        background: 'rgba(110,231,183,0.1)',
        border: '1px solid rgba(110,231,183,0.3)',
        borderRadius: 7,
        color: '#6ee7b7',
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
        textAlign: 'center',
    },
    errorBox: {
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.22)',
        borderRadius: 8,
        padding: '10px 12px',
        marginBottom: 8,
        fontSize: 12,
        color: '#fca5a5',
        lineHeight: 1.6,
    },
    successBox: {
        background: 'rgba(74,222,128,0.07)',
        border: '1px solid rgba(74,222,128,0.25)',
        borderRadius: 8,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        marginTop: 8,
    },
    tierBanner: {
        fontSize: 11,
        color: '#94a3b8',
        background: 'rgba(100,116,139,0.1)',
        border: '1px solid rgba(100,116,139,0.2)',
        borderRadius: 6,
        padding: '6px 10px',
        marginBottom: 12,
    },
    overrideWarningChip: {
        fontSize: 11,
        color: '#fbbf24',
        background: 'rgba(251,191,36,0.08)',
        border: '1px solid rgba(251,191,36,0.3)',
        borderRadius: 6,
        padding: '7px 10px',
        marginBottom: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    challengeDestinyBadge: {
        display: 'inline-block',
        fontSize: 10,
        fontWeight: 700,
        color: '#fbbf24',
        background: 'rgba(251,191,36,0.1)',
        border: '1px solid rgba(251,191,36,0.35)',
        borderRadius: 4,
        padding: '2px 7px',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    challengeDestinyBtn: {
        marginTop: 10,
        width: '100%',
        padding: '8px 12px',
        background: 'rgba(251,191,36,0.1)',
        border: '1px solid rgba(251,191,36,0.4)',
        borderRadius: 7,
        color: '#fbbf24',
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
        textAlign: 'center',
    },
    restoreAutoBtn: {
        fontSize: 10,
        padding: '3px 8px',
        background: 'rgba(251,191,36,0.12)',
        border: '1px solid rgba(251,191,36,0.4)',
        borderRadius: 4,
        color: '#fbbf24',
        cursor: 'pointer',
        fontWeight: 600,
        flexShrink: 0,
    },
};
// ── Component ────────────────────────────────────────────────────────────────
export function SkuUpgradePanel({ analytics, onUpgradeComplete, }) {
    const [phase, setPhase] = useState('checking');
    const [currentTier, setCurrentTier] = useState('nano');
    const [modelExists, setModelExists] = useState(false);
    const [progress, setProgress] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);
    const [stallWarning, setStallWarning] = useState(false);
    const [flipped, setFlipped] = useState(false);
    const [clickedTile, setClickedTile] = useState(null);
    // M18b: effective tier/model state (honors right-size.json override)
    const [effectiveTier, setEffectiveTier] = useState('nano');
    const [autoDetectedTier, setAutoDetectedTier] = useState('nano');
    const [overrideActive, setOverrideActive] = useState(false);
    const [effectiveModel, setEffectiveModel] = useState('');
    const [autoDetectedModel, setAutoDetectedModel] = useState('');
    const upgradeActiveRef = useRef(false);
    // Holds cleanup callbacks for IPC listeners registered during upgrade
    const listenerCleanupRef = useRef(null);
    // Tracks when the last sku-pull-progress event arrived (ms epoch)
    const lastProgressTimeRef = useRef(0);
    // ── On mount: load tier + model state ─────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const [tierResult, modelResult, hwResult] = await Promise.all([
                    window.amplify.sku?.currentTier() ?? Promise.resolve({ tier: 'nano' }),
                    window.amplify.sku?.checkModel('gemma4:12b') ?? Promise.resolve({ exists: false, modelName: 'gemma4:12b' }),
                    window.amplify.invoke?.('hardware:get-tier') ?? Promise.resolve(null),
                ]);
                if (cancelled)
                    return;
                setCurrentTier(tierResult.tier);
                setModelExists(modelResult.exists);
                // M18b: populate effective tier/model from hardware IPC result
                if (hwResult && typeof hwResult === 'object' && 'effectiveModelResult' in hwResult) {
                    const emr = hwResult.effectiveModelResult;
                    if (emr) {
                        const effTierRaw = (emr.tier ?? 'nano').toLowerCase();
                        const autoTierRaw = (() => {
                            if (!emr.autoDetectedModel)
                                return effTierRaw;
                            const m = emr.autoDetectedModel;
                            if (m.includes('70b'))
                                return 'ultra';
                            if (m.includes('12b'))
                                return 'full';
                            if (m.includes('9b'))
                                return 'core';
                            if (m.includes('2b'))
                                return 'lite';
                            return 'nano';
                        })();
                        setEffectiveTier(TIER_ORDER.includes(effTierRaw) ? effTierRaw : 'nano');
                        setAutoDetectedTier(TIER_ORDER.includes(autoTierRaw) ? autoTierRaw : 'nano');
                        setOverrideActive(emr.overrideActive ?? false);
                        setEffectiveModel(emr.model ?? '');
                        setAutoDetectedModel(emr.autoDetectedModel ?? '');
                    }
                }
                setPhase('ready');
            }
            catch {
                if (cancelled)
                    return;
                setPhase('ready');
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);
    // ── Cleanup listeners on unmount ──────────────────────────────────────────
    useEffect(() => {
        return () => {
            listenerCleanupRef.current?.();
        };
    }, []);
    // ── Start upgrade ─────────────────────────────────────────────────────────
    const startUpgrade = useCallback(() => {
        if (upgradeActiveRef.current)
            return;
        upgradeActiveRef.current = true;
        setPhase('upgrading');
        setProgress(null);
        setErrorMsg(null);
        setStallWarning(false);
        lastProgressTimeRef.current = Date.now();
        // Clean up any previous listeners
        listenerCleanupRef.current?.();
        const unsubProgress = window.amplify.sku?.onPullProgress((data) => {
            lastProgressTimeRef.current = Date.now();
            setProgress(data);
        }) ?? (() => { });
        const unsubComplete = window.amplify.sku?.onPullComplete(() => {
            upgradeActiveRef.current = false;
            setCurrentTier('full');
            setPhase('complete');
            analytics?.track('feather_earned', { color: 'black', reason: 'full_sku_upgrade_completed' });
            // Durably record the black crow feather in Supabase crow_feathers table.
            void (async () => {
                try {
                    const session = await window.amplify.lbGetSession?.();
                    const userId = session?.user_id ?? '';
                    await window.amplify.earnBlackCrowFeather?.({ userId, reason: 'full_sku_upgrade_completed' });
                }
                catch {
                    // Non-fatal: analytics track already fired; feather record failure is logged in main process.
                }
            })();
            onUpgradeComplete?.();
        }) ?? (() => { });
        const unsubError = window.amplify.sku?.onPullError((err) => {
            upgradeActiveRef.current = false;
            setErrorMsg(err || 'Upgrade failed. Check your connection and try again.');
            setPhase('error');
        }) ?? (() => { });
        listenerCleanupRef.current = () => {
            unsubProgress();
            unsubComplete();
            unsubError();
        };
        // Extension point: replace sku.upgradeTo() with sku.upgradeFromPeer(peerId)
        // when mesh weight-share is implemented. Same progress/complete/error contract.
        void window.amplify.sku?.upgradeTo('full').catch((err) => {
            upgradeActiveRef.current = false;
            setErrorMsg(err instanceof Error ? err.message : 'Could not start upgrade.');
            setPhase('error');
        });
    }, [analytics, onUpgradeComplete]);
    // ── Cancel upgrade ────────────────────────────────────────────────────────
    const handleCancel = useCallback(() => {
        upgradeActiveRef.current = false;
        listenerCleanupRef.current?.();
        listenerCleanupRef.current = null;
        void window.amplify.sku?.cancelUpgrade().catch(() => { });
        setPhase('ready');
        setProgress(null);
        setErrorMsg(null);
    }, []);
    // ── Retry ─────────────────────────────────────────────────────────────────
    const handleRetry = useCallback(() => {
        upgradeActiveRef.current = false;
        startUpgrade();
    }, [startUpgrade]);
    // ── M18b: Restore auto (delete right-size.json override) ──────────────────
    const handleRestoreAuto = useCallback(() => {
        void (async () => {
            try {
                await window.amplify.invoke?.('hardware:reset-model');
                setOverrideActive(false);
                setEffectiveTier(autoDetectedTier);
                setEffectiveModel(autoDetectedModel);
            }
            catch { /* Non-fatal */ }
        })();
    }, [autoDetectedTier, autoDetectedModel]);
    // ── Tile click: scale-flash feedback then flip to back face ───────────────
    const handleTileClick = useCallback((tierId) => {
        setClickedTile(tierId);
        setTimeout(() => {
            setClickedTile(null);
            setFlipped(true);
        }, 180);
    }, []);
    // ── Activate FULL (model already present -- skip download UI) ─────────────
    // Calls sku-upgrade-to directly; expects near-instant tier write, no pull.
    const activateFull = useCallback(() => {
        if (upgradeActiveRef.current)
            return;
        upgradeActiveRef.current = true;
        setPhase('upgrading');
        setProgress(null);
        setErrorMsg(null);
        setStallWarning(false);
        // Register complete/error listeners so the pull-complete event (fired by
        // main when it detects the model already exists) is handled correctly.
        listenerCleanupRef.current?.();
        const unsubComplete = window.amplify.sku?.onPullComplete(() => {
            upgradeActiveRef.current = false;
            setCurrentTier('full');
            setPhase('complete');
            analytics?.track('feather_earned', { color: 'black', reason: 'full_sku_activate_existing' });
            void (async () => {
                try {
                    const session = await window.amplify.lbGetSession?.();
                    const userId = session?.user_id ?? '';
                    await window.amplify.earnBlackCrowFeather?.({ userId, reason: 'full_sku_activate_existing' });
                }
                catch { /* Non-fatal */ }
            })();
            onUpgradeComplete?.();
        }) ?? (() => { });
        const unsubError = window.amplify.sku?.onPullError((err) => {
            upgradeActiveRef.current = false;
            setErrorMsg(err || 'Activation failed. Try again.');
            setPhase('error');
        }) ?? (() => { });
        listenerCleanupRef.current = () => {
            unsubComplete();
            unsubError();
        };
        void window.amplify.sku?.upgradeTo('full').catch((err) => {
            upgradeActiveRef.current = false;
            setErrorMsg(err instanceof Error ? err.message : 'Could not activate FULL.');
            setPhase('error');
        });
    }, [analytics, onUpgradeComplete]);
    // ── 30s stall watchdog ────────────────────────────────────────────────────
    // If downloading and no progress event arrives for >30s, re-check model.
    // If it now exists, treat as success. Otherwise surface a non-fatal warning.
    useEffect(() => {
        if (phase !== 'upgrading' || modelExists)
            return;
        const STALL_MS = 30000;
        const id = setInterval(() => {
            const elapsed = Date.now() - lastProgressTimeRef.current;
            if (elapsed < STALL_MS)
                return;
            void (async () => {
                try {
                    const result = await (window.amplify.sku?.checkModel('gemma4:12b') ?? Promise.resolve({ exists: false, modelName: 'gemma4:12b' }));
                    if (result.exists) {
                        // Model finished in background -- treat as success
                        clearInterval(id);
                        listenerCleanupRef.current?.();
                        listenerCleanupRef.current = null;
                        upgradeActiveRef.current = false;
                        setModelExists(true);
                        setCurrentTier('full');
                        setPhase('complete');
                        onUpgradeComplete?.();
                    }
                    else {
                        setStallWarning(true);
                    }
                }
                catch { /* Non-fatal -- leave warning off */ }
            })();
        }, 5000);
        return () => { clearInterval(id); };
    }, [phase, modelExists, onUpgradeComplete]);
    // ── Progress values ───────────────────────────────────────────────────────
    const fraction = progress ? progressFraction(progress.downloaded, progress.total) : 0;
    const pct = Math.round(fraction * 100);
    const unknownTotal = !progress || progress.total <= 0;
    const downloadedLabel = progress && progress.downloaded > 0
        ? `${bytesToGB(progress.downloaded)} GB`
        : '0.0 GB';
    const totalLabel = unknownTotal ? '...' : `${bytesToGB(progress?.total ?? 0)} GB`;
    // ── Render ────────────────────────────────────────────────────────────────
    const isUpgrading = phase === 'upgrading';
    return (_jsxs(_Fragment, { children: [_jsx("style", { children: SPIN_KEYFRAMES }), _jsxs("div", { style: S.panel, children: [_jsx("div", { style: S.sectionLabel, children: "Caithedral AI Tier" }), _jsxs("div", { style: S.tierBanner, children: ["Current AI tier: ", _jsx("strong", { children: effectiveTier.toUpperCase() }), overrideActive
                                ? ` (Override: ${effectiveModel})`
                                : effectiveModel ? ` (${effectiveModel})` : ''] }), overrideActive && (_jsxs("div", { style: S.overrideWarningChip, children: [_jsxs("span", { children: ["\u26A0 Override active \u00B7 right-size.json \u2192 ", _jsx("strong", { children: effectiveModel }), " \u00B7 Auto: ", autoDetectedModel] }), _jsx("button", { type: "button", style: S.restoreAutoBtn, onClick: handleRestoreAuto, children: "Restore auto" })] })), _jsx("div", { style: { perspective: '1200px', marginBottom: 20 }, children: _jsxs("div", { style: {
                                position: 'relative',
                                transformStyle: 'preserve-3d',
                                transition: 'transform 600ms ease-in-out',
                                transform: flipped ? 'rotateY(180deg)' : 'none',
                            }, children: [_jsx("div", { style: { backfaceVisibility: 'hidden' }, children: _jsx("div", { style: { ...S.tiersGrid, marginBottom: 0 }, children: SKU_TIERS.map((tier) => {
                                            const tileState = getTileState(tier.id, effectiveTier, autoDetectedTier);
                                            const isActive = tileState === 'active';
                                            const isDimmed = tileState === 'insufficient' || (isUpgrading && !isActive);
                                            const isClicked = clickedTile === tier.id;
                                            const isInsufficient = tileState === 'insufficient';
                                            const isChallengeDestiny = tileState === 'challenge-destiny';
                                            // M18b: dynamic model name for tile
                                            const displayModel = (isActive && overrideActive)
                                                ? `${effectiveModel} (Override active)`
                                                : TIER_MODEL_MAP[tier.id];
                                            const tileClickStyle = {
                                                cursor: isInsufficient ? 'not-allowed' : 'pointer',
                                                transition: 'transform 0.15s ease, box-shadow 0.15s ease, opacity 0.2s',
                                                transform: isClicked ? 'scale(0.96)' : 'scale(1)',
                                                boxShadow: isClicked ? '0 0 0 2px rgba(110,231,183,0.5)' : 'none',
                                                opacity: isDimmed ? 0.45 : 1,
                                            };
                                            return (_jsxs("div", { title: isInsufficient ? 'Hardware limit — insufficient RAM/VRAM' : undefined, style: {
                                                    ...S.tierCard(isActive, isDimmed),
                                                    ...tileClickStyle,
                                                }, onClick: () => !isInsufficient && handleTileClick(tier.id), children: [isActive && _jsx("div", { style: S.activeBadge, children: "Active" }), isChallengeDestiny && _jsx("div", { style: S.challengeDestinyBadge, children: "\u26A0 Override available" }), _jsx("div", { style: S.tierName, children: tier.name }), _jsx("div", { style: S.tierTagline, children: tier.tagline }), tier.features.length > 0 && (_jsx("div", { children: tier.features.map((f) => (_jsxs("div", { style: S.tierFeature, children: [_jsx("span", { style: { color: isActive ? '#4ade80' : '#475569', flexShrink: 0 }, children: "+" }), _jsx("span", { style: { color: isActive ? '#94a3b8' : undefined }, children: f })] }, f))) })), _jsx("div", { style: { ...S.modelSizeLabel, color: isActive ? '#6ee7b7' : '#334155' }, children: displayModel }), !isActive && !isInsufficient && phase === 'ready' && tier.id === 'full' && (modelExists ? (_jsx("button", { type: "button", style: S.activateBtn, onClick: (e) => { e.stopPropagation(); handleTileClick(tier.id); activateFull(); }, children: "Activate FULL" })) : (_jsx("button", { type: "button", style: S.upgradeBtn, onClick: (e) => { e.stopPropagation(); handleTileClick(tier.id); startUpgrade(); }, children: "Upgrade to FULL \u2014 ~7 GB" }))), isChallengeDestiny && phase === 'ready' && (_jsx("button", { type: "button", style: S.challengeDestinyBtn, onClick: (e) => { e.stopPropagation(); handleTileClick(tier.id); }, children: "Challenge Destiny \u26A0" }))] }, tier.id));
                                        }) }) }), _jsxs("div", { style: {
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        backfaceVisibility: 'hidden',
                                        transform: 'rotateY(180deg)',
                                        background: '#0d1117',
                                    }, children: [_jsxs("div", { style: {
                                                background: '#111827',
                                                border: '1px solid rgba(100,116,139,0.2)',
                                                borderRadius: 10,
                                                padding: '12px 14px',
                                                marginBottom: 10,
                                            }, children: [_jsx("div", { style: { ...S.sectionLabel, marginBottom: 8 }, children: "Tier comparison \u2014 MMLU-Pro \u00B7 Caithedral Core applied" }), _jsxs("div", { style: { display: 'flex', gap: 6, marginBottom: 4, fontSize: 10, color: '#334155', fontFamily: 'monospace' }, children: [_jsx("span", { style: { flex: 1 }, children: "Tier (model)" }), _jsx("span", { style: { minWidth: 30 }, children: "Base" }), _jsx("span", { style: { minWidth: 8 } }), _jsx("span", { style: { minWidth: 30 }, children: "+Core" }), _jsx("span", { style: { minWidth: 44 }, children: "Gain" })] }), [
                                                    { name: 'NANO', model: 'qwen2.5:0.5b', base: '6%', boosted: '78%', gain: '+72pp' },
                                                    { name: 'CORE', model: 'phi4:14b', base: '31%', boosted: '89%', gain: '+58pp' },
                                                    { name: 'LITE', model: 'gemma4:4b', base: '48%', boosted: '91%', gain: '+43pp' },
                                                    { name: 'FULL', model: 'gemma4:12b', base: '63%', boosted: '94%', gain: '+31pp', isBest: true },
                                                ].map((row) => (_jsxs("div", { style: { display: 'flex', gap: 6, marginBottom: 3, fontSize: 11, fontFamily: 'monospace', alignItems: 'baseline' }, children: [_jsx("span", { style: { fontWeight: 800, color: '#e2e8f0', minWidth: 36 }, children: row.name }), _jsxs("span", { style: { color: '#334155', flex: 1, fontSize: 10 }, children: ["(", row.model, ")"] }), _jsx("span", { style: { color: '#64748b', minWidth: 30 }, children: row.base }), _jsx("span", { style: { color: '#475569', minWidth: 8 }, children: "\u2192" }), _jsx("span", { style: { color: '#4ade80', fontWeight: 700, minWidth: 30 }, children: row.boosted }), _jsxs("span", { style: { color: '#6ee7b7', fontSize: 10, minWidth: 44 }, children: ["(", row.gain, ")", row.isBest ? ' ★' : ''] })] }, row.name))), _jsx("div", { style: { fontSize: 10, color: '#1e293b', marginTop: 6 }, children: "BP074 \u00B7 Cohen's Kappa 1.000 \u00B7 Banyan Metric\u2122" })] }), _jsxs("div", { style: {
                                                background: '#111827',
                                                border: '1px solid rgba(100,116,139,0.2)',
                                                borderRadius: 10,
                                                padding: '12px 14px',
                                                marginBottom: 10,
                                                fontFamily: 'monospace',
                                                fontSize: 11,
                                            }, children: [_jsxs("div", { style: { display: 'flex', gap: 4, marginBottom: 5, paddingBottom: 5, borderBottom: '1px solid rgba(100,116,139,0.15)' }, children: [_jsx("span", { style: { color: '#334155', flex: 1, fontSize: 10 }, children: "Feature" }), ['NANO', 'CORE', 'LITE', 'FULL'].map((t) => (_jsx("span", { style: { color: '#475569', minWidth: 36, textAlign: 'center', fontSize: 10, fontWeight: 700 }, children: t }, t)))] }), [
                                                    { feature: 'Local model', nano: '✓', core: '✓', lite: '✓', full: '✓' },
                                                    { feature: 'Caithedral Core', nano: '✓', core: '✓', lite: '✓', full: '✓' },
                                                    { feature: 'Context depth', nano: '4K', core: '8K', lite: '16K', full: '32K' },
                                                    { feature: 'Mesh capable', nano: '✗', core: '✓', lite: '✓', full: '✓' },
                                                ].map((row) => (_jsxs("div", { style: { display: 'flex', gap: 4, marginBottom: 3, alignItems: 'baseline' }, children: [_jsx("span", { style: { color: '#475569', flex: 1 }, children: row.feature }), [row.nano, row.core, row.lite, row.full].map((val, i) => (_jsx("span", { style: {
                                                                minWidth: 36,
                                                                textAlign: 'center',
                                                                color: val === '✓' ? '#4ade80' : val === '✗' ? '#ef4444' : '#94a3b8',
                                                                fontWeight: i === 3 ? 700 : undefined,
                                                            }, children: val }, i)))] }, row.feature)))] }), _jsx("div", { style: { fontSize: 11, color: '#64748b', lineHeight: 1.7, marginBottom: 10 }, children: "Caithedral Core applies your personal substrate to every query. Higher tiers retain more context \u2014 your AI gets smarter the more you use it." }), _jsx("button", { type: "button", style: {
                                                width: '100%',
                                                padding: '8px 12px',
                                                background: 'rgba(100,116,139,0.1)',
                                                border: '1px solid rgba(100,116,139,0.25)',
                                                borderRadius: 7,
                                                color: '#94a3b8',
                                                fontSize: 12,
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                textAlign: 'center',
                                            }, onClick: () => setFlipped(false), children: "\u2190 Back to tiers" })] })] }) }), phase === 'upgrading' && (_jsxs("div", { style: {
                            background: '#111827',
                            border: '1px solid rgba(100,116,139,0.2)',
                            borderRadius: 10,
                            padding: '16px 14px 12px',
                        }, children: [modelExists && (progress === null || progress.total === 0) ? (_jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    marginBottom: 10,
                                }, children: [_jsx("span", { style: S.spinnerStyle }), _jsx("span", { style: { fontSize: 13, fontWeight: 700, color: '#e2e8f0' }, children: "Using your existing gemma4:12b" })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { style: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            marginBottom: 10,
                                        }, children: [_jsx("span", { style: S.spinnerStyle }), _jsx("span", { style: { fontSize: 13, fontWeight: 700, color: '#e2e8f0' }, children: "Downloading gemma4:12b" })] }), _jsx("div", { style: S.progressTrack, children: _jsx("div", { style: {
                                                height: '100%',
                                                width: unknownTotal ? '0%' : `${pct}%`,
                                                background: '#6ee7b7',
                                                borderRadius: 3,
                                                transition: 'width 0.4s ease',
                                            } }) }), _jsxs("div", { style: S.progressRow, children: [_jsxs("span", { children: [downloadedLabel, " / ", unknownTotal ? '?' : totalLabel] }), _jsx("span", { children: unknownTotal ? '...' : `${pct}%` })] }), progress?.speed && (_jsx("div", { style: { fontSize: 11, color: '#475569', marginBottom: 3 }, children: progress.speed })), progress?.status && (_jsx("div", { style: { fontSize: 10, color: '#334155', marginBottom: 8, lineHeight: 1.5 }, children: progress.status }))] })), stallWarning && (_jsxs("div", { style: {
                                    marginBottom: 8,
                                    padding: '8px 10px',
                                    background: 'rgba(245,158,11,0.08)',
                                    border: '1px solid rgba(245,158,11,0.25)',
                                    borderRadius: 7,
                                    fontSize: 11,
                                    color: '#fcd34d',
                                    lineHeight: 1.6,
                                }, children: ["Download may have stalled.", _jsx("button", { type: "button", style: { ...S.retryBtn, marginTop: 6 }, onClick: handleRetry, children: "Retry" })] })), _jsx("button", { type: "button", style: S.cancelBtn, onClick: handleCancel, children: "Cancel" }), _jsx("button", { type: "button", style: S.ghostBtn, onClick: handleCancel, children: "Continue using NANO meanwhile" })] })), phase === 'complete' && (_jsxs("div", { style: S.successBox, children: [_jsx(CheckIcon, {}), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 13, fontWeight: 700, color: '#4ade80', marginBottom: 3 }, children: "FULL activated." }), _jsx("div", { style: { fontSize: 12, color: '#94a3b8' }, children: "Google's Gemma 4 12B is now your AI." })] })] })), phase === 'error' && (_jsxs("div", { children: [_jsx("div", { style: S.errorBox, children: errorMsg ?? 'Upgrade failed. Check your connection and try again.' }), _jsx("button", { type: "button", style: S.retryBtn, onClick: handleRetry, children: "Retry" }), _jsx("button", { type: "button", style: S.cancelBtn, onClick: handleCancel, children: "Cancel" })] })), phase === 'checking' && (_jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: 12,
                            color: '#475569',
                            padding: '4px 0',
                        }, children: [_jsx("span", { style: S.spinnerStyle }), _jsx("span", { children: "Loading tier info..." })] }))] })] }));
}
export default SkuUpgradePanel;
