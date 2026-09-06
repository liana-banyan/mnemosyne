import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// B83 — Hearth Conjunction Window — Top-Level Shell
// "The Heavy Booster Test surface"
// Unifies: B69 App Builder Chat / B82 MoneyPenny / B61A Drekaskip /
//          Watchdog / B80 Sweat / B81 Tears / B-SE4-1 into ONE window
//
// BP041 SAGA 5 — Panel Manager + HELM VIEW + Bridge canon expansion
//   Phase A: allotment-driven multi-shelf (left · right · bottom)
//   Phase B: DeckCardSlot system — card registry, right-click context menu, drag-drop
//   Phase C: Helm Decks Library picker
//   Phase D: Layout persistence via localStorage (IPC disk path: K533-class follow-on)
//   Phase E: Bridge canon integration — 8 Station labels · The Conductor · keyhole expand
//
// Founder-coined names (immutable per R-FOUNDER-NAMING-PROVENANCE):
//   "Hearth Conjunction Window", "In Conjunction", "HEAVY BOOSTER TEST",
//   "HELM VIEW", "Deck Cards", "Helm Decks Library", "The Conductor",
//   "Bridge", "Station"
import { useState, useEffect, useCallback, useRef } from 'react';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import { AppBuilderChat } from './AppBuilderChat';
import { EmbeddedChrome } from './embedded_browser/EmbeddedChrome';
import { LiveSegWatch } from './drekaskip_status/LiveSegWatch';
import { NotCentsGlyph } from '../components/NotCentsGlyph';
import { NovaculaFireButton } from './drekaskip_status/NovaculaFireButton';
import { OnDeckPanel } from './on_deck/OnDeckPanel';
import { MakeYourselfComfortableWizard } from './substrate/MakeYourselfComfortableWizard';
import { ConjunctionContext, DEFAULT_PANEL_STATE, DEFAULT_AVAILABILITY, DEFAULT_PROBE_MAP, } from './conjunction/conjunction_state';
import { BUILTIN_AGENTS, DEFAULT_TIER_CHOICES } from './conjunction/ConjunctionPanel';
import { HelmShelf } from './helm/HelmShelf';
import { useHelmLayout } from './helm/useHelmLayout';
import { PRESET_LAYOUTS } from './helm/HelmTypes';
import { HelmDecksPicker } from './helm/HelmDecksPicker';
export function HearthConjunctionWindow() {
    const [panelState, setPanelState] = useState(DEFAULT_PANEL_STATE);
    const [availability, setAvailability] = useState(DEFAULT_AVAILABILITY);
    const [lastResult, setLastResult] = useState(null);
    const [tierChoices, setTierChoicesState] = useState(DEFAULT_TIER_CHOICES);
    const [substrateContext, setSubstrateContext] = useState(null);
    const [conjunctionOutput, setConjunctionOutput] = useState(null);
    const [injectionEvents, setInjectionEvents] = useState([]);
    const [showOnDeck, setShowOnDeck] = useState(false);
    const [activeTab, setActiveTab] = useState('prove_it');
    const [proveCard, setProveCard] = useState('A');
    const [builderCard, setBuilderCard] = useState('B');
    const [showLibraryPicker, setShowLibraryPicker] = useState(false);
    const [showPresetMenu, setShowPresetMenu] = useState(false);
    const [appVersion, setAppVersion] = useState('');
    // BP041 SAGA 5 — HELM VIEW layout management
    const { layout, toggleShelf, addCard, removeCard, moveCard, reorderCard, applyPreset, } = useHelmLayout();
    const swapCard = useCallback((shelf, oldCardId, newCardId) => {
        const cards = layout.shelves[shelf].cards;
        const idx = cards.indexOf(oldCardId);
        if (idx < 0) {
            addCard(shelf, newCardId);
            return;
        }
        // Replace in-place: remove old, insert new at same position
        const newCards = [...cards];
        newCards.splice(idx, 1, newCardId);
        // Use moveCard via a direct layout mutation pattern
        // Since useHelmLayout doesn't expose setCards directly, remove + add in order
        removeCard(shelf, oldCardId);
        addCard(shelf, newCardId);
        // Re-sort is best-effort for SAGA 5; full ordering guaranteed in follow-on
    }, [layout, addCard, removeCard]);
    const reorderInShelf = useCallback((shelf, fromIndex, toIndex) => {
        const cards = [...layout.shelves[shelf].cards];
        if (fromIndex < 0 || toIndex < 0 || fromIndex >= cards.length || toIndex >= cards.length)
            return;
        const [moved] = cards.splice(fromIndex, 1);
        cards.splice(toIndex, 0, moved);
        // Rebuild via sequential add — simplified for SAGA 5
        cards.forEach((_, i) => {
            if (i !== toIndex)
                return;
            reorderCard(shelf, moved, fromIndex < toIndex ? 'down' : 'up');
        });
    }, [layout, reorderCard]);
    // BP041 — Auto-switch to Card C on Novacula fire
    useEffect(() => {
        const onFire = () => { setActiveTab('prove_it'); setProveCard('C'); };
        window.addEventListener('mnemosyne-wave-fired', onFire);
        return () => window.removeEventListener('mnemosyne-wave-fired', onFire);
    }, []);
    // MV-VERSION-DISPLAY BP044
    useEffect(() => {
        window.amplify.getAppVersion?.().then((v) => {
            if (v)
                setAppVersion(`v${v.version}`);
        });
    }, []);
    // BP041 — Click feedback flash
    const [lastClickedBtn, setLastClickedBtn] = useState(null);
    const flashBtn = (id) => {
        setLastClickedBtn(id);
        setTimeout(() => setLastClickedBtn((cur) => (cur === id ? null : cur)), 250);
    };
    const contextRefreshTimer = useRef(null);
    useEffect(() => {
        window.amplify.conjunctionGetState?.().then((s) => { if (s)
            setPanelState(s); }).catch(() => { });
        refreshAvailability();
        const avTimer = setInterval(refreshAvailability, 30000);
        buildContext();
        contextRefreshTimer.current = setInterval(buildContext, 60000);
        return () => {
            clearInterval(avTimer);
            if (contextRefreshTimer.current)
                clearInterval(contextRefreshTimer.current);
        };
    }, []);
    const refreshAvailability = useCallback(async () => {
        try {
            const av = await window.amplify.conjunctionGetAvailability?.();
            if (av)
                setAvailability(av);
        }
        catch { /* non-fatal */ }
    }, []);
    const buildContext = useCallback(async () => {
        try {
            const ctx = await window.amplify.conjunctionGetSubstrateContext?.();
            if (ctx?.raw_preamble)
                setSubstrateContext(ctx.raw_preamble);
        }
        catch { /* non-fatal */ }
    }, []);
    const selectMode = useCallback(async (mode) => {
        try {
            const result = await window.amplify.conjunctionSelect?.(mode);
            if (result?.ok)
                setPanelState((s) => ({ ...s, selected: mode, per_request_override: null }));
        }
        catch { /* non-fatal */ }
    }, []);
    const dispatch = useCallback(async (prompt, mode_override) => {
        setPanelState((s) => ({
            ...s,
            in_flight: { mode: mode_override ?? s.selected, started_at: new Date().toISOString() },
        }));
        setConjunctionOutput(null);
        try {
            const result = await window.amplify.conjunctionDispatch?.(prompt, mode_override);
            if (result) {
                setLastResult(result);
                setConjunctionOutput(result.synthesized);
                setPanelState((s) => ({
                    ...s,
                    in_flight: null,
                    last_dispatch: {
                        mode: mode_override ?? s.selected,
                        ts: new Date().toISOString(),
                        latency_ms: result.total_latency_ms,
                        success: result.receipts.some((r) => r.result !== null),
                    },
                }));
                return result;
            }
        }
        catch (err) {
            setPanelState((s) => ({ ...s, in_flight: null }));
            console.warn('[Conjunction] dispatch error:', err);
        }
        return null;
    }, []);
    const probeAgent = useCallback(async (agentId) => {
        return { agentId, status: 'unknown' };
    }, []);
    const setTierChoice = useCallback((agentId, tierId) => {
        setTierChoicesState((prev) => ({ ...prev, [agentId]: tierId }));
        try {
            localStorage.setItem(`tier_${agentId}`, tierId);
        }
        catch { /* non-fatal */ }
    }, []);
    const openApiKeySettings = useCallback((_agentId) => {
        // Future: open Settings panel to API Keys tab
    }, []);
    const handleShiftClick = useCallback((mode) => {
        setPanelState((s) => ({ ...s, per_request_override: mode }));
        window.amplify.conjunctionSetOverride?.(mode).catch(() => { });
    }, []);
    const TAB_META = {
        prove_it: { icon: '🎯', label: 'Prove It!', color: '#f6ad55', bgActive: '#3a2a14', bgInactive: '#1a1410', station: '🎯 Helm' },
        app_builder: { icon: '🏗️', label: 'App Builder', color: '#48bb78', bgActive: '#143524', bgInactive: '#0e1a13', station: '🏗️ Build' },
        browser: { icon: '🌐', label: 'Browser', color: '#4299e1', bgActive: '#142a3a', bgInactive: '#0e161e', station: '🌐 Nav' },
        substrate: { icon: '📜', label: 'Substrate', color: '#b48aff', bgActive: '#2a1a3a', bgInactive: '#150e1e', station: '📜 Charts' },
    };
    return (_jsx(ConjunctionContext.Provider, { value: {
            panelState, availability, lastResult,
            agents: BUILTIN_AGENTS,
            probeMap: DEFAULT_PROBE_MAP,
            tierChoices,
            apiKeyStatus: {},
            selectMode,
            dispatch,
            refreshAvailability,
            probeAgent,
            setTierChoice,
            openApiKeySettings,
        }, children: _jsxs("div", { style: styles.root, children: [_jsxs("div", { style: styles.topBar, children: [_jsx(NotCentsGlyph, { size: "1.4rem", alt: "NotCents \u00B7 MnemosyneC identity", color: "white", style: { verticalAlign: 'middle' } }), _jsx("span", { style: styles.windowTitle, children: "MnemosyneC" }), _jsx("span", { style: styles.heavyBooster, children: "HEAVY BOOSTER TEST" }), _jsx("span", { style: styles.conductorBadge, title: "Bridge canon: you are The Conductor", children: "\uD83C\uDFBC The Conductor" }), appVersion && (_jsxs("span", { title: "MnemosyneC version \u00B7 LB Alpha-phase \u00B7 click for changelog", style: {
                                fontSize: '0.62rem',
                                color: '#4a5568',
                                fontFamily: 'monospace',
                                border: '1px solid #2d3748',
                                borderRadius: '4px',
                                padding: '1px 5px',
                                letterSpacing: '0.03em',
                                whiteSpace: 'nowrap',
                                cursor: 'pointer',
                                flexShrink: 0,
                            }, onClick: () => {
                                const ext = window.amplify?.openExternal;
                                if (typeof ext === 'function')
                                    ext('https://cephas.lianabanyan.com/changelog/');
                            }, children: [appVersion, " \u00B7 \u03B1"] })), _jsx("div", { style: styles.topBarSpacer }), _jsxs("div", { style: { position: 'relative' }, children: [_jsxs("button", { style: {
                                        ...styles.contextBtn,
                                        borderColor: showPresetMenu ? '#f6ad55' : '#4a5568',
                                    }, onClick: () => setShowPresetMenu((v) => !v), title: "Apply a Helm layout preset", "aria-label": "Helm layout presets", children: ["\uD83D\uDDC2 ", layout.preset] }), showPresetMenu && (_jsxs(_Fragment, { children: [_jsx("div", { style: { position: 'fixed', inset: 0, zIndex: 8000 }, onClick: () => setShowPresetMenu(false) }), _jsx("div", { style: styles.presetMenu, children: Object.keys(PRESET_LAYOUTS).map((name) => (_jsxs("button", { style: {
                                                    ...styles.presetMenuItem,
                                                    color: layout.preset === name ? '#f6ad55' : '#e2e8f0',
                                                    background: layout.preset === name ? 'rgba(246,173,85,0.1)' : 'none',
                                                }, onClick: () => { applyPreset(name); setShowPresetMenu(false); }, children: [layout.preset === name ? '✓ ' : '  ', name] }, name))) })] }))] }), _jsx("button", { style: { ...styles.contextBtn, ...(lastClickedBtn === 'helm_lib' ? styles.contextBtnFlash : {}) }, onClick: () => { flashBtn('helm_lib'); setShowLibraryPicker(true); }, title: "Open Helm Decks Library \u2014 browse and add cards to any shelf", "aria-label": "Open Helm Decks Library", children: "\uD83C\uDFB4 Helm Decks" }), _jsx("button", { style: { ...styles.contextBtn, ...(lastClickedBtn === 'watch_view' ? styles.contextBtnFlash : {}) }, onClick: () => { flashBtn('watch_view'); window.amplify?.hideToWatchView?.().catch?.(() => { }); }, title: "Switch to Watch View \u2014 MnemosyneC fades to frame border.", "aria-label": "Switch to Watch View", "aria-keyshortcuts": "Control+Shift+M", children: "\uD83D\uDC41 Watch" }), _jsx("button", { style: { ...styles.contextBtn, ...(lastClickedBtn === 'reload' ? styles.contextBtnFlash : {}) }, onClick: () => { flashBtn('reload'); setTimeout(() => window.location.reload(), 180); }, title: "Reload MnemosyneC window", "aria-label": "Reload MnemosyneC window", children: "\uD83D\uDD04 Reload" }), _jsx("button", { style: { ...styles.contextBtn, ...(lastClickedBtn === 'sync_context' ? styles.contextBtnFlash : {}) }, onClick: () => { flashBtn('sync_context'); buildContext(); }, title: "Sync substrate context to Embedded Chrome", "aria-label": "Sync substrate context", children: "\uD83E\uDDEC Sync" }), _jsxs("button", { style: {
                                ...styles.contextBtn,
                                background: showOnDeck ? '#1e3a5f' : '#2d3748',
                                borderColor: showOnDeck ? '#3b82f6' : '#4a5568',
                                color: showOnDeck ? '#63b3ed' : '#e2e8f0',
                                ...(lastClickedBtn === 'on_deck' ? styles.contextBtnFlash : {}),
                            }, onClick: () => { flashBtn('on_deck'); setShowOnDeck((v) => !v); }, title: "Toggle On Deck panel", "aria-label": `Toggle On Deck queue panel ${showOnDeck ? '(on)' : '(off)'}`, "aria-pressed": showOnDeck, children: ["\uD83D\uDCCB On Deck ", showOnDeck ? '(on)' : '(off)'] })] }), _jsxs("div", { style: styles.layout, children: [_jsx(HelmShelf, { shelfId: "left", cards: layout.shelves.left.cards, collapsed: layout.shelves.left.collapsed, station: "lookouts", onToggleCollapse: () => toggleShelf('left'), onAddCard: (cardId) => addCard('left', cardId), onRemoveCard: (cardId) => removeCard('left', cardId), onMoveUp: (cardId) => reorderCard('left', cardId, 'up'), onMoveDown: (cardId) => reorderCard('left', cardId, 'down'), onMoveTo: (cardId, targetShelf) => moveCard('left', targetShelf, cardId), onSwapCard: (oldId, newId) => swapCard('left', oldId, newId), onReorder: (fi, ti) => reorderInShelf('left', fi, ti), direction: "column" }), _jsxs("div", { style: styles.centerCol, children: [_jsxs(Allotment, { vertical: true, children: [_jsx(Allotment.Pane, { minSize: 200, children: _jsxs("div", { style: styles.leftCol, children: [_jsx("div", { style: styles.tabNav, children: Object.keys(TAB_META).map((tab) => {
                                                            const isActive = activeTab === tab;
                                                            const meta = TAB_META[tab];
                                                            return (_jsxs("button", { style: {
                                                                    ...styles.tabBtn,
                                                                    background: isActive ? meta.bgActive : meta.bgInactive,
                                                                    color: isActive ? meta.color : `${meta.color}99`,
                                                                    borderBottom: isActive ? `3px solid ${meta.color}` : `3px solid transparent`,
                                                                    fontWeight: isActive ? 700 : 500,
                                                                    fontSize: isActive ? '0.82rem' : '0.78rem',
                                                                }, onClick: () => setActiveTab(tab), title: `${meta.station} Station`, children: [meta.icon, " ", meta.label] }, tab));
                                                        }) }), _jsxs("div", { style: {
                                                            ...styles.tabContent,
                                                            background: TAB_META[activeTab].bgInactive,
                                                            borderLeft: `1px solid ${TAB_META[activeTab].color}33`,
                                                            borderRight: `1px solid ${TAB_META[activeTab].color}33`,
                                                        }, children: [activeTab === 'prove_it' && (_jsxs("div", { style: styles.proveItTab, children: [_jsxs("div", { style: styles.proveItHeader, children: [_jsx("span", { style: styles.proveItTitle, children: "\uD83C\uDFAF Prove It!" }), _jsx("span", { style: styles.proveItSubtitle, children: "Trust gateway \u2014 verify the substrate runs on your hardware." })] }), _jsx("div", { style: styles.deckRow, children: [
                                                                            { key: 'A', icon: '🎯', title: 'Fire Empirical Proof', desc: 'Run canonical test data through the BP041 Empirical Proof Novacula.' },
                                                                            { key: 'B', icon: '🧪', title: 'Fire Your Own Test', desc: 'Provide your own input — wrapped in the same Novacula pipeline.' },
                                                                            { key: 'C', icon: '👀', title: 'Just Watch', desc: 'Read the canonical published synthesis without firing.' },
                                                                        ].map(({ key, icon, title, desc }) => (_jsxs("button", { style: { ...styles.deckCard, ...(proveCard === key ? styles.deckCardActive : {}) }, onClick: () => setProveCard(proveCard === key ? null : key), children: [_jsx("span", { style: styles.deckCardIcon, children: icon }), _jsx("span", { style: styles.deckCardTitle, children: title }), _jsx("span", { style: styles.deckCardDesc, children: desc })] }, key))) }), proveCard === 'A' && (_jsxs("div", { style: styles.proveItBody, children: [_jsx(NovaculaFireButton, {}), _jsx(LiveSegWatch, { title: "Live SEG Watch \u2014 current wave", maxHeight: 360 }), conjunctionOutput && _jsx("div", { style: styles.proveItNote, children: "Conjunction result ready \u2014 see strip below \u2193" })] })), proveCard === 'B' && (_jsxs("div", { style: styles.proveItBody, children: [_jsx("p", { style: styles.proveItNote, children: "Custom test input \u2014 fire your data through the Novacula pipeline:" }), _jsx(NovaculaFireButton, {}), _jsx(LiveSegWatch, { title: "Live SEG Watch \u2014 custom test", maxHeight: 360 })] })), proveCard === 'C' && (_jsxs("div", { style: styles.proveItBody, children: [_jsx("p", { style: styles.proveItNote, children: "Read the most recent canonical synthesis without firing:" }), _jsx(LiveSegWatch, { title: "Just Watch \u2014 latest wave", maxHeight: 400 }), conjunctionOutput && (_jsxs("details", { style: { marginTop: '0.5rem' }, children: [_jsx("summary", { style: { cursor: 'pointer', fontSize: '0.7rem', color: '#86efac' }, children: "\uD83D\uDCC4 Conjunction-Panel output" }), _jsx("pre", { style: styles.synthesisView, children: conjunctionOutput.slice(0, 3000) })] }))] })), proveCard === null && (_jsx("div", { style: styles.proveItBody, children: _jsx("p", { style: styles.proveItNote, children: "Pick a card above to get started." }) }))] })), activeTab === 'app_builder' && (_jsxs("div", { style: styles.appBuilderTab, children: [_jsx("div", { style: { ...styles.deckRow, flexShrink: 0 }, children: [
                                                                            { key: 'A', icon: '📦', title: 'Build from Template', desc: 'Choose a cooperative pattern.' },
                                                                            { key: 'B', icon: '✏️', title: 'Describe in Plain English', desc: 'Tell CAI what you want. Builds locally, free.' },
                                                                            { key: 'C', icon: '🌳', title: 'Browse What Members Built', desc: 'Explore apps built by cooperative members.' },
                                                                        ].map(({ key, icon, title, desc }) => (_jsxs("button", { style: { ...styles.deckCard, ...(builderCard === key ? styles.deckCardActive : {}) }, onClick: () => setBuilderCard(key), children: [_jsx("span", { style: styles.deckCardIcon, children: icon }), _jsx("span", { style: styles.deckCardTitle, children: title }), _jsx("span", { style: styles.deckCardDesc, children: desc })] }, key))) }), _jsxs("div", { style: styles.builderCardBody, children: [builderCard === 'A' && (_jsxs("div", { style: styles.placeholderPane, children: [_jsx("span", { style: styles.placeholderIcon, children: "\uD83D\uDCE6" }), _jsx("span", { style: styles.placeholderTitle, children: "Cooperative Template Library" }), _jsx("span", { style: styles.placeholderDesc, children: "Coming soon. Card B is available now." })] })), builderCard === 'B' && _jsx(AppBuilderChat, {}), builderCard === 'C' && (_jsxs("div", { style: styles.placeholderPane, children: [_jsx("span", { style: styles.placeholderIcon, children: "\uD83C\uDF33" }), _jsx("span", { style: styles.placeholderTitle, children: "Member App Library" }), _jsx("span", { style: styles.placeholderDesc, children: "Browse and install apps built by cooperative members. Coming soon." })] }))] })] })), activeTab === 'browser' && (_jsxs("div", { style: styles.browserTab, children: [_jsx("div", { style: styles.browserSlots, children: ([
                                                                            { name: 'Chrome', icon: '🟡', color: '#facc15' },
                                                                            { name: 'Firefox', icon: '🦊', color: '#f97316' },
                                                                            { name: 'Edge', icon: '🔵', color: '#3b82f6' },
                                                                            { name: 'Brave', icon: '🦁', color: '#fb923c' },
                                                                            { name: 'Embedded', icon: '⚡', color: '#a78bfa' },
                                                                            { name: 'Vivaldi', icon: '🔴', color: '#ef4444' },
                                                                        ]).map(({ name, icon, color }) => (_jsxs("div", { style: { ...styles.browserSlot, borderColor: `${color}55` }, title: name === 'Embedded' ? 'Use built-in Chromium (active below)' : `Open in ${name}`, children: [_jsx("span", { style: { fontSize: '1.4rem' }, children: icon }), _jsx("span", { style: { ...styles.browserSlotLabel, color }, children: name })] }, name))) }), _jsx("div", { style: styles.browserEmbedArea, children: _jsx(EmbeddedChrome, { substrateContext: substrateContext, onInjectionResult: (r) => setInjectionEvents((e) => [r, ...e].slice(0, 10)) }) })] })), activeTab === 'substrate' && (_jsx("div", { style: { height: '100%', overflow: 'hidden' }, children: _jsx(MakeYourselfComfortableWizard, {}) }))] })] }) }), !layout.shelves.bottom.collapsed && (_jsx(Allotment.Pane, { minSize: 80, preferredSize: layout.shelves.bottom.size ?? 260, children: _jsx(HelmShelf, { shelfId: "bottom", cards: layout.shelves.bottom.cards, collapsed: false, station: "engineering", onToggleCollapse: () => toggleShelf('bottom'), onAddCard: (cardId) => addCard('bottom', cardId), onRemoveCard: (cardId) => removeCard('bottom', cardId), onMoveUp: (cardId) => reorderCard('bottom', cardId, 'up'), onMoveDown: (cardId) => reorderCard('bottom', cardId, 'down'), onMoveTo: (cardId, targetShelf) => moveCard('bottom', targetShelf, cardId), onSwapCard: (oldId, newId) => swapCard('bottom', oldId, newId), onReorder: (fi, ti) => reorderInShelf('bottom', fi, ti), direction: "row" }) }))] }), layout.shelves.bottom.collapsed && (_jsxs("div", { style: {
                                        height: 28, display: 'flex', flexDirection: 'row', alignItems: 'center',
                                        gap: '0.5rem', padding: '0 0.75rem', background: '#0a0a12',
                                        borderTop: '1px solid #2d3748', cursor: 'pointer', userSelect: 'none', flexShrink: 0,
                                    }, onClick: () => toggleShelf('bottom'), role: "button", tabIndex: 0, onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        toggleShelf('bottom');
                                    } }, title: "Expand bottom shelf \u2014 \u2699\uFE0F Engineering Station", "aria-expanded": false, "aria-label": "Expand Engineering station shelf", children: [_jsx("span", { style: { fontSize: '0.75rem', color: '#4a5568' }, children: "\u2699\uFE0F Engineering Station" }), _jsx("span", { style: { fontSize: '0.65rem', color: '#2d3748' }, children: "\u00B7 click to expand \u2191" })] }))] }), _jsx(HelmShelf, { shelfId: "right", cards: layout.shelves.right.cards, collapsed: layout.shelves.right.collapsed, station: "comms", onToggleCollapse: () => toggleShelf('right'), onAddCard: (cardId) => addCard('right', cardId), onRemoveCard: (cardId) => removeCard('right', cardId), onMoveUp: (cardId) => reorderCard('right', cardId, 'up'), onMoveDown: (cardId) => reorderCard('right', cardId, 'down'), onMoveTo: (cardId, targetShelf) => moveCard('right', targetShelf, cardId), onSwapCard: (oldId, newId) => swapCard('right', oldId, newId), onReorder: (fi, ti) => reorderInShelf('right', fi, ti), direction: "column" })] }), showOnDeck && (_jsx("div", { style: styles.onDeckStrip, children: _jsx(OnDeckPanel, {}) })), conjunctionOutput && (_jsxs("div", { style: styles.outputStrip, children: [_jsxs("div", { style: styles.outputHeader, children: ["Conjunction Result \u00B7 ", lastResult?.synthesizer_mode, " \u00B7 ", lastResult?.total_latency_ms, "ms", _jsx("button", { style: styles.outputClose, onClick: () => setConjunctionOutput(null), children: "\u2715" })] }), _jsx("div", { style: styles.outputBody, children: conjunctionOutput.slice(0, 2000) })] })), injectionEvents.length > 0 && (_jsxs("div", { style: {
                        ...styles.injectionToast,
                        background: injectionEvents[0].success ? '#14532d' : '#450a0a',
                        borderColor: injectionEvents[0].success ? '#22c55e' : '#ef4444',
                    }, children: [injectionEvents[0].success ? '🧬 Context injected' : '⚠ Injection miss', ' ', "\u00B7 ", injectionEvents[0].url.slice(0, 40), "\u2026"] })), showLibraryPicker && (_jsx(HelmDecksPicker, { onSelect: (cardId, targetShelf) => addCard(targetShelf, cardId), onClose: () => setShowLibraryPicker(false), defaultShelf: "right" }))] }) }));
}
const styles = {
    root: {
        width: '100vw',
        height: '100vh',
        background: '#0a0a14',
        color: '#e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overflow: 'hidden',
    },
    topBar: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 0.75rem',
        background: '#1a1a2e',
        borderBottom: '2px solid #f6ad55',
        flexShrink: 0,
        minHeight: 44,
        flexWrap: 'nowrap',
        overflowX: 'auto',
    },
    windowTitle: {
        fontWeight: 700,
        fontSize: '1.1rem',
        color: '#f6ad55',
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
    },
    heavyBooster: {
        fontSize: '0.65rem',
        fontWeight: 700,
        background: '#f6ad55',
        color: '#1a1a2e',
        borderRadius: '4px',
        padding: '2px 6px',
        letterSpacing: '0.08em',
        whiteSpace: 'nowrap',
    },
    // Phase E: The Conductor badge
    conductorBadge: {
        fontSize: '0.65rem',
        fontWeight: 700,
        background: 'rgba(246,173,85,0.12)',
        border: '1px solid rgba(246,173,85,0.35)',
        color: '#f6ad55',
        borderRadius: '4px',
        padding: '2px 8px',
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
        cursor: 'default',
    },
    topBarSpacer: { flex: 1, minWidth: 8 },
    contextBtn: {
        background: '#2d3748',
        border: '1px solid #4a5568',
        borderRadius: '4px',
        color: '#e2e8f0',
        padding: '0.3rem 0.6rem',
        cursor: 'pointer',
        fontSize: '0.75rem',
        transition: 'all 0.15s ease-out',
        whiteSpace: 'nowrap',
        flexShrink: 0,
    },
    contextBtnFlash: {
        background: '#1a4a6e',
        borderColor: '#f6ad55',
        color: '#fff',
        boxShadow: '0 0 0 2px #f6ad5566, 0 0 8px #f6ad5544',
        transform: 'scale(0.97)',
    },
    presetMenu: {
        position: 'absolute',
        top: '110%',
        right: 0,
        zIndex: 9000,
        background: '#1a1a2e',
        border: '1px solid #4a5568',
        borderRadius: '6px',
        padding: '4px 0',
        minWidth: 160,
        boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
    },
    presetMenuItem: {
        display: 'block',
        width: '100%',
        background: 'none',
        border: 'none',
        padding: '6px 14px',
        fontSize: '0.75rem',
        textAlign: 'left',
        cursor: 'pointer',
    },
    layout: {
        display: 'flex',
        flex: 1,
        gap: 0,
        overflow: 'hidden',
        minHeight: 0,
    },
    centerCol: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minWidth: 0,
        minHeight: 0,
    },
    leftCol: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        background: '#0f0f1a',
    },
    tabNav: {
        display: 'flex',
        flexShrink: 0,
        borderBottom: '2px solid #2d3748',
        background: '#12121f',
    },
    tabBtn: {
        flex: 1,
        padding: '0.65rem 0.5rem',
        border: 'none',
        borderRight: '1px solid #2d3748',
        cursor: 'pointer',
        letterSpacing: '0.04em',
        transition: 'all 0.18s ease-out',
    },
    tabContent: {
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
    },
    // ─── Prove It! tab ────────────────────────────────────────────────────────
    proveItTab: {
        flex: 1, display: 'flex', flexDirection: 'column',
        padding: '1rem', gap: '1rem', overflow: 'auto',
    },
    proveItHeader: { display: 'flex', flexDirection: 'column', gap: '0.35rem' },
    proveItTitle: { fontSize: '1.1rem', fontWeight: 700, color: '#f6ad55' },
    proveItSubtitle: { fontSize: '0.82rem', color: '#a0aec0', lineHeight: 1.5, maxWidth: 480 },
    proveItBody: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
    proveItNote: { fontSize: '0.75rem', color: '#68d391', fontStyle: 'italic' },
    synthesisView: {
        fontSize: '0.75rem', lineHeight: 1.5, color: '#e2e8f0',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        background: '#070710', border: '1px solid #2d3748',
        borderRadius: '6px', padding: '0.75rem', overflow: 'auto', maxHeight: 360,
    },
    // ─── Deck Cards ────────────────────────────────────────────────────────────
    deckRow: { display: 'flex', gap: '0.5rem', flexShrink: 0 },
    deckCard: {
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'flex-start', gap: '0.3rem', padding: '0.65rem 0.75rem',
        background: 'transparent', border: '1px solid #2d3748', borderRadius: '8px',
        cursor: 'pointer', textAlign: 'left', color: '#e2e8f0',
        transition: 'border-color 0.15s, background 0.15s',
    },
    deckCardActive: { borderColor: '#f6ad55', background: 'rgba(246, 173, 85, 0.07)' },
    deckCardIcon: { fontSize: '1.35rem', lineHeight: 1 },
    deckCardTitle: { fontSize: '0.78rem', fontWeight: 700, color: '#f6ad55' },
    deckCardDesc: { fontSize: '0.68rem', color: '#718096', lineHeight: 1.4 },
    // ─── App Builder tab ──────────────────────────────────────────────────────
    appBuilderTab: {
        flex: 1, display: 'flex', flexDirection: 'column',
        gap: '0.5rem', padding: '0.5rem', overflow: 'hidden', minHeight: 0,
    },
    builderCardBody: {
        flex: 1, overflow: 'hidden', minHeight: 0,
        display: 'flex', flexDirection: 'column',
    },
    placeholderPane: {
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: '0.5rem', color: '#718096', padding: '2rem',
    },
    placeholderIcon: { fontSize: '2.5rem' },
    placeholderTitle: { fontSize: '0.95rem', fontWeight: 600, color: '#a0aec0' },
    placeholderDesc: { fontSize: '0.78rem', textAlign: 'center', maxWidth: 320, lineHeight: 1.5 },
    // ─── Browser tab ─────────────────────────────────────────────────────────
    browserTab: {
        flex: 1, display: 'flex', flexDirection: 'column',
        overflow: 'hidden', minHeight: 0,
    },
    browserSlots: {
        display: 'flex', gap: '0.4rem', padding: '0.5rem',
        flexShrink: 0, borderBottom: '1px solid #2d3748', background: '#0a0a12',
    },
    browserSlot: {
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: '0.2rem', padding: '0.4rem 0.25rem',
        border: '1px solid', borderRadius: '6px', cursor: 'pointer',
        background: 'rgba(255,255,255,0.02)', transition: 'background 0.15s',
    },
    browserSlotLabel: { fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.04em' },
    browserEmbedArea: { flex: 1, overflow: 'hidden', minHeight: 0 },
    // ─── Strips & toasts ─────────────────────────────────────────────────────
    onDeckStrip: {
        borderTop: '2px solid #3b82f6', background: '#070710',
        flexShrink: 0, height: 340, overflow: 'hidden',
    },
    outputStrip: {
        borderTop: '1px solid #f6ad55', background: '#110a00',
        flexShrink: 0, maxHeight: '35vh', display: 'flex', flexDirection: 'column',
    },
    outputHeader: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0.4rem 0.75rem', background: '#1a1100',
        fontSize: '0.75rem', color: '#f6ad55', fontWeight: 600,
    },
    outputClose: { background: 'none', border: 'none', color: '#718096', cursor: 'pointer', fontSize: '0.85rem' },
    outputBody: {
        flex: 1, overflow: 'auto', padding: '0.5rem 0.75rem',
        fontSize: '0.78rem', lineHeight: 1.5, color: '#e2e8f0', whiteSpace: 'pre-wrap',
    },
    injectionToast: {
        position: 'fixed', bottom: '0.75rem', right: '0.75rem',
        border: '1px solid', borderRadius: '6px', padding: '0.3rem 0.6rem',
        fontSize: '0.72rem', color: '#e2e8f0', zIndex: 9999, maxWidth: 320,
    },
};
