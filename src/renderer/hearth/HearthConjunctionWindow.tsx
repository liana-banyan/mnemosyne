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
import {
  ConjunctionContext,
  DEFAULT_PANEL_STATE,
  DEFAULT_AVAILABILITY,
  DEFAULT_PROBE_MAP,
} from './conjunction/conjunction_state';
import { BUILTIN_AGENTS, DEFAULT_TIER_CHOICES } from './conjunction/ConjunctionPanel';
import type {
  ConjunctionAgentId,
  ConjunctionMode,
  ConjunctionPanelState,
  ConjunctionResult,
  BackendAvailability,
  AgentProbeResult,
  TierChoiceMap,
} from './conjunction/types';

import { HelmShelf } from './helm/HelmShelf';
import { useHelmLayout } from './helm/useHelmLayout';
import type { CardId, ShelfId, PresetName } from './helm/HelmTypes';
import { PRESET_LAYOUTS } from './helm/HelmTypes';
import { HelmDecksPicker } from './helm/HelmDecksPicker';

type HearthTab = 'prove_it' | 'app_builder' | 'browser' | 'substrate';

export function HearthConjunctionWindow() {
  const [panelState, setPanelState] = useState<ConjunctionPanelState>(DEFAULT_PANEL_STATE);
  const [availability, setAvailability] = useState<BackendAvailability>(DEFAULT_AVAILABILITY);
  const [lastResult, setLastResult] = useState<ConjunctionResult | null>(null);
  const [tierChoices, setTierChoicesState] = useState<TierChoiceMap>(DEFAULT_TIER_CHOICES);
  const [substrateContext, setSubstrateContext] = useState<string | null>(null);
  const [conjunctionOutput, setConjunctionOutput] = useState<string | null>(null);
  const [injectionEvents, setInjectionEvents] = useState<Array<{ success: boolean; url: string }>>([]);
  const [showOnDeck, setShowOnDeck] = useState(false);
  const [activeTab, setActiveTab] = useState<HearthTab>('prove_it');
  const [proveCard, setProveCard] = useState<'A' | 'B' | 'C' | null>('A');
  const [builderCard, setBuilderCard] = useState<'A' | 'B' | 'C'>('B');
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('');

  // BP041 SAGA 5 — HELM VIEW layout management
  const {
    layout, toggleShelf, addCard, removeCard,
    moveCard, reorderCard, applyPreset,
  } = useHelmLayout();

  const swapCard = useCallback((shelf: ShelfId, oldCardId: CardId, newCardId: CardId) => {
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

  const reorderInShelf = useCallback((shelf: ShelfId, fromIndex: number, toIndex: number) => {
    const cards = [...layout.shelves[shelf].cards];
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= cards.length || toIndex >= cards.length) return;
    const [moved] = cards.splice(fromIndex, 1);
    cards.splice(toIndex, 0, moved);
    // Rebuild via sequential add — simplified for SAGA 5
    cards.forEach((_, i) => {
      if (i !== toIndex) return;
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
      if (v) setAppVersion(`v${v.version}`);
    });
  }, []);

  // BP041 — Click feedback flash
  const [lastClickedBtn, setLastClickedBtn] = useState<string | null>(null);
  const flashBtn = (id: string) => {
    setLastClickedBtn(id);
    setTimeout(() => setLastClickedBtn((cur) => (cur === id ? null : cur)), 250);
  };

  const contextRefreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    window.amplify.conjunctionGetState?.().then((s) => { if (s) setPanelState(s); }).catch(() => {});
    refreshAvailability();
    const avTimer = setInterval(refreshAvailability, 30_000);
    buildContext();
    contextRefreshTimer.current = setInterval(buildContext, 60_000);
    return () => {
      clearInterval(avTimer);
      if (contextRefreshTimer.current) clearInterval(contextRefreshTimer.current);
    };
  }, []);

  const refreshAvailability = useCallback(async () => {
    try {
      const av = await window.amplify.conjunctionGetAvailability?.();
      if (av) setAvailability(av);
    } catch { /* non-fatal */ }
  }, []);

  const buildContext = useCallback(async () => {
    try {
      const ctx = await window.amplify.conjunctionGetSubstrateContext?.();
      if (ctx?.raw_preamble) setSubstrateContext(ctx.raw_preamble);
    } catch { /* non-fatal */ }
  }, []);

  const selectMode = useCallback(async (mode: ConjunctionMode) => {
    try {
      const result = await window.amplify.conjunctionSelect?.(mode);
      if (result?.ok) setPanelState((s) => ({ ...s, selected: mode, per_request_override: null }));
    } catch { /* non-fatal */ }
  }, []);

  const dispatch = useCallback(async (prompt: string, mode_override?: ConjunctionMode): Promise<ConjunctionResult | null> => {
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
    } catch (err) {
      setPanelState((s) => ({ ...s, in_flight: null }));
      console.warn('[Conjunction] dispatch error:', err);
    }
    return null;
  }, []);

  const probeAgent = useCallback(async (agentId: ConjunctionAgentId): Promise<AgentProbeResult> => {
    return { agentId, status: 'unknown' };
  }, []);

  const setTierChoice = useCallback((agentId: ConjunctionAgentId, tierId: string) => {
    setTierChoicesState((prev) => ({ ...prev, [agentId]: tierId }));
    try { localStorage.setItem(`tier_${agentId}`, tierId); } catch { /* non-fatal */ }
  }, []);

  const openApiKeySettings = useCallback((_agentId?: ConjunctionAgentId) => {
    // Future: open Settings panel to API Keys tab
  }, []);

  const handleShiftClick = useCallback((mode: ConjunctionMode) => {
    setPanelState((s) => ({ ...s, per_request_override: mode }));
    window.amplify.conjunctionSetOverride?.(mode).catch(() => {});
  }, []);

  const TAB_META: Record<HearthTab, { icon: string; label: string; color: string; bgActive: string; bgInactive: string; station: string }> = {
    prove_it:    { icon: '🎯', label: 'Prove It!',   color: '#f6ad55', bgActive: '#3a2a14', bgInactive: '#1a1410', station: '🎯 Helm' },
    app_builder: { icon: '🏗️', label: 'App Builder', color: '#48bb78', bgActive: '#143524', bgInactive: '#0e1a13', station: '🏗️ Build' },
    browser:     { icon: '🌐', label: 'Browser',     color: '#4299e1', bgActive: '#142a3a', bgInactive: '#0e161e', station: '🌐 Nav' },
    substrate:   { icon: '📜', label: 'Substrate',   color: '#b48aff', bgActive: '#2a1a3a', bgInactive: '#150e1e', station: '📜 Charts' },
  };

  return (
    <ConjunctionContext.Provider value={{
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
    }}>
      <div style={styles.root}>

        {/* ── Window header ─────────────────────────────────────────────────── */}
        <div style={styles.topBar}>
          <NotCentsGlyph size="1.4rem" alt="NotCents · Mnemosyne identity" color="white" style={{ verticalAlign: 'middle' }} />
          <span style={styles.windowTitle}>Mnemosyne</span>
          <span style={styles.heavyBooster}>HEAVY BOOSTER TEST</span>
          {/* Bridge canon: The Conductor identity */}
          <span style={styles.conductorBadge} title="Bridge canon: you are The Conductor">
            🎼 The Conductor
          </span>
          {appVersion && (
            <span
              title="Mnemosyne version · LB Alpha-phase · click for changelog"
              style={{
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
              }}
              onClick={() => {
                const ext = (window as any).amplify?.openExternal;
                if (typeof ext === 'function') ext('https://cephas.lianabanyan.com/changelog/');
              }}
            >
              {appVersion} · α
            </span>
          )}
          <div style={styles.topBarSpacer} />

          {/* Preset selector — Phase D */}
          <div style={{ position: 'relative' }}>
            <button
              style={{
                ...styles.contextBtn,
                borderColor: showPresetMenu ? '#f6ad55' : '#4a5568',
              }}
              onClick={() => setShowPresetMenu((v) => !v)}
              title="Apply a Helm layout preset"
              aria-label="Helm layout presets"
            >
              🗂 {layout.preset}
            </button>
            {showPresetMenu && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 8000 }} onClick={() => setShowPresetMenu(false)} />
                <div style={styles.presetMenu}>
                  {(Object.keys(PRESET_LAYOUTS) as PresetName[]).map((name) => (
                    <button
                      key={name}
                      style={{
                        ...styles.presetMenuItem,
                        color: layout.preset === name ? '#f6ad55' : '#e2e8f0',
                        background: layout.preset === name ? 'rgba(246,173,85,0.1)' : 'none',
                      }}
                      onClick={() => { applyPreset(name); setShowPresetMenu(false); }}
                    >
                      {layout.preset === name ? '✓ ' : '  '}{name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Helm Decks Library — global add */}
          <button
            style={{ ...styles.contextBtn, ...(lastClickedBtn === 'helm_lib' ? styles.contextBtnFlash : {}) }}
            onClick={() => { flashBtn('helm_lib'); setShowLibraryPicker(true); }}
            title="Open Helm Decks Library — browse and add cards to any shelf"
            aria-label="Open Helm Decks Library"
          >
            🎴 Helm Decks
          </button>

          {/* Watch View */}
          <button
            style={{ ...styles.contextBtn, ...(lastClickedBtn === 'watch_view' ? styles.contextBtnFlash : {}) }}
            onClick={() => { flashBtn('watch_view'); window.amplify?.hideToWatchView?.().catch?.(() => {}); }}
            title="Switch to Watch View — Mnemosyne fades to frame border."
            aria-label="Switch to Watch View"
            aria-keyshortcuts="Control+Shift+M"
          >
            👁 Watch
          </button>

          {/* Reload */}
          <button
            style={{ ...styles.contextBtn, ...(lastClickedBtn === 'reload' ? styles.contextBtnFlash : {}) }}
            onClick={() => { flashBtn('reload'); setTimeout(() => window.location.reload(), 180); }}
            title="Reload Mnemosyne window"
            aria-label="Reload Mnemosyne window"
          >
            🔄 Reload
          </button>

          {/* Sync to Browser */}
          <button
            style={{ ...styles.contextBtn, ...(lastClickedBtn === 'sync_context' ? styles.contextBtnFlash : {}) }}
            onClick={() => { flashBtn('sync_context'); buildContext(); }}
            title="Sync substrate context to Embedded Chrome"
            aria-label="Sync substrate context"
          >
            🧬 Sync
          </button>

          {/* On Deck toggle */}
          <button
            style={{
              ...styles.contextBtn,
              background: showOnDeck ? '#1e3a5f' : '#2d3748',
              borderColor: showOnDeck ? '#3b82f6' : '#4a5568',
              color: showOnDeck ? '#63b3ed' : '#e2e8f0',
              ...(lastClickedBtn === 'on_deck' ? styles.contextBtnFlash : {}),
            }}
            onClick={() => { flashBtn('on_deck'); setShowOnDeck((v) => !v); }}
            title="Toggle On Deck panel"
            aria-label={`Toggle On Deck queue panel ${showOnDeck ? '(on)' : '(off)'}`}
            aria-pressed={showOnDeck}
          >
            📋 On Deck {showOnDeck ? '(on)' : '(off)'}
          </button>
        </div>

        {/* ── Main layout: [left-shelf] | [tabs+bottom] | [right-shelf] ───────── */}
        <div style={styles.layout}>

          {/* Left shelf — 🔭 Lookouts station (empty by default) */}
          <HelmShelf
            shelfId="left"
            cards={layout.shelves.left.cards}
            collapsed={layout.shelves.left.collapsed}
            station="lookouts"
            onToggleCollapse={() => toggleShelf('left')}
            onAddCard={(cardId) => addCard('left', cardId)}
            onRemoveCard={(cardId) => removeCard('left', cardId)}
            onMoveUp={(cardId) => reorderCard('left', cardId, 'up')}
            onMoveDown={(cardId) => reorderCard('left', cardId, 'down')}
            onMoveTo={(cardId, targetShelf) => moveCard('left', targetShelf, cardId)}
            onSwapCard={(oldId, newId) => swapCard('left', oldId, newId)}
            onReorder={(fi, ti) => reorderInShelf('left', fi, ti)}
            direction="column"
          />

          {/* Center: tabs + bottom shelf */}
          <div style={styles.centerCol}>
            <Allotment vertical>
              {/* Tab area */}
              <Allotment.Pane minSize={200}>
                <div style={styles.leftCol}>
                  {/* Tab navigation */}
                  <div style={styles.tabNav}>
                    {(Object.keys(TAB_META) as HearthTab[]).map((tab) => {
                      const isActive = activeTab === tab;
                      const meta = TAB_META[tab];
                      return (
                        <button
                          key={tab}
                          style={{
                            ...styles.tabBtn,
                            background: isActive ? meta.bgActive : meta.bgInactive,
                            color: isActive ? meta.color : `${meta.color}99`,
                            borderBottom: isActive ? `3px solid ${meta.color}` : `3px solid transparent`,
                            fontWeight: isActive ? 700 : 500,
                            fontSize: isActive ? '0.82rem' : '0.78rem',
                          }}
                          onClick={() => setActiveTab(tab)}
                          title={`${meta.station} Station`}
                        >
                          {meta.icon} {meta.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Tab content */}
                  <div style={{
                    ...styles.tabContent,
                    background: TAB_META[activeTab].bgInactive,
                    borderLeft: `1px solid ${TAB_META[activeTab].color}33`,
                    borderRight: `1px solid ${TAB_META[activeTab].color}33`,
                  }}>

                    {/* ─── Prove It! — 🎯 Helm Station ──────────────────────── */}
                    {activeTab === 'prove_it' && (
                      <div style={styles.proveItTab}>
                        <div style={styles.proveItHeader}>
                          <span style={styles.proveItTitle}>🎯 Prove It!</span>
                          <span style={styles.proveItSubtitle}>
                            Trust gateway — verify the substrate runs on your hardware.
                          </span>
                        </div>
                        <div style={styles.deckRow}>
                          {([
                            { key: 'A', icon: '🎯', title: 'Fire Empirical Proof', desc: 'Run canonical test data through the BP041 Empirical Proof Novacula.' },
                            { key: 'B', icon: '🧪', title: 'Fire Your Own Test',   desc: 'Provide your own input — wrapped in the same Novacula pipeline.' },
                            { key: 'C', icon: '👀', title: 'Just Watch',           desc: 'Read the canonical published synthesis without firing.' },
                          ] as { key: 'A' | 'B' | 'C'; icon: string; title: string; desc: string }[]).map(({ key, icon, title, desc }) => (
                            <button
                              key={key}
                              style={{ ...styles.deckCard, ...(proveCard === key ? styles.deckCardActive : {}) }}
                              onClick={() => setProveCard(proveCard === key ? null : key)}
                            >
                              <span style={styles.deckCardIcon}>{icon}</span>
                              <span style={styles.deckCardTitle}>{title}</span>
                              <span style={styles.deckCardDesc}>{desc}</span>
                            </button>
                          ))}
                        </div>

                        {proveCard === 'A' && (
                          <div style={styles.proveItBody}>
                            <NovaculaFireButton />
                            <LiveSegWatch title="Live SEG Watch — current wave" maxHeight={360} />
                            {conjunctionOutput && <div style={styles.proveItNote}>Conjunction result ready — see strip below ↓</div>}
                          </div>
                        )}
                        {proveCard === 'B' && (
                          <div style={styles.proveItBody}>
                            <p style={styles.proveItNote}>Custom test input — fire your data through the Novacula pipeline:</p>
                            <NovaculaFireButton />
                            <LiveSegWatch title="Live SEG Watch — custom test" maxHeight={360} />
                          </div>
                        )}
                        {proveCard === 'C' && (
                          <div style={styles.proveItBody}>
                            <p style={styles.proveItNote}>Read the most recent canonical synthesis without firing:</p>
                            <LiveSegWatch title="Just Watch — latest wave" maxHeight={400} />
                            {conjunctionOutput && (
                              <details style={{ marginTop: '0.5rem' }}>
                                <summary style={{ cursor: 'pointer', fontSize: '0.7rem', color: '#86efac' }}>📄 Conjunction-Panel output</summary>
                                <pre style={styles.synthesisView}>{conjunctionOutput.slice(0, 3000)}</pre>
                              </details>
                            )}
                          </div>
                        )}
                        {proveCard === null && (
                          <div style={styles.proveItBody}><p style={styles.proveItNote}>Pick a card above to get started.</p></div>
                        )}
                      </div>
                    )}

                    {/* ─── App Builder ──────────────────────────────────────── */}
                    {activeTab === 'app_builder' && (
                      <div style={styles.appBuilderTab}>
                        <div style={{ ...styles.deckRow, flexShrink: 0 }}>
                          {([
                            { key: 'A', icon: '📦', title: 'Build from Template',       desc: 'Choose a cooperative pattern.' },
                            { key: 'B', icon: '✏️', title: 'Describe in Plain English', desc: 'Tell CAI what you want. Builds locally, free.' },
                            { key: 'C', icon: '🌳', title: 'Browse What Members Built', desc: 'Explore apps built by cooperative members.' },
                          ] as { key: 'A' | 'B' | 'C'; icon: string; title: string; desc: string }[]).map(({ key, icon, title, desc }) => (
                            <button
                              key={key}
                              style={{ ...styles.deckCard, ...(builderCard === key ? styles.deckCardActive : {}) }}
                              onClick={() => setBuilderCard(key)}
                            >
                              <span style={styles.deckCardIcon}>{icon}</span>
                              <span style={styles.deckCardTitle}>{title}</span>
                              <span style={styles.deckCardDesc}>{desc}</span>
                            </button>
                          ))}
                        </div>
                        <div style={styles.builderCardBody}>
                          {builderCard === 'A' && (
                            <div style={styles.placeholderPane}>
                              <span style={styles.placeholderIcon}>📦</span>
                              <span style={styles.placeholderTitle}>Cooperative Template Library</span>
                              <span style={styles.placeholderDesc}>Coming soon. Card B is available now.</span>
                            </div>
                          )}
                          {builderCard === 'B' && <AppBuilderChat />}
                          {builderCard === 'C' && (
                            <div style={styles.placeholderPane}>
                              <span style={styles.placeholderIcon}>🌳</span>
                              <span style={styles.placeholderTitle}>Member App Library</span>
                              <span style={styles.placeholderDesc}>Browse and install apps built by cooperative members. Coming soon.</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ─── Browser — keyhole expand (Phase E) ───────────────── */}
                    {activeTab === 'browser' && (
                      <div style={styles.browserTab}>
                        <div style={styles.browserSlots}>
                          {([
                            { name: 'Chrome',   icon: '🟡', color: '#facc15' },
                            { name: 'Firefox',  icon: '🦊', color: '#f97316' },
                            { name: 'Edge',     icon: '🔵', color: '#3b82f6' },
                            { name: 'Brave',    icon: '🦁', color: '#fb923c' },
                            { name: 'Embedded', icon: '⚡', color: '#a78bfa' },
                            { name: 'Vivaldi',  icon: '🔴', color: '#ef4444' },
                          ]).map(({ name, icon, color }) => (
                            <div
                              key={name}
                              style={{ ...styles.browserSlot, borderColor: `${color}55` }}
                              title={name === 'Embedded' ? 'Use built-in Chromium (active below)' : `Open in ${name}`}
                            >
                              <span style={{ fontSize: '1.4rem' }}>{icon}</span>
                              <span style={{ ...styles.browserSlotLabel, color }}>{name}</span>
                            </div>
                          ))}
                        </div>
                        {/* Phase E: keyhole expand — EmbeddedChrome fills available area */}
                        <div style={styles.browserEmbedArea}>
                          <EmbeddedChrome
                            substrateContext={substrateContext}
                            onInjectionResult={(r) => setInjectionEvents((e) => [r, ...e].slice(0, 10))}
                          />
                        </div>
                      </div>
                    )}

                    {/* ─── Substrate — 📜 Charts Station ────────────────────── */}
                    {activeTab === 'substrate' && (
                      <div style={{ height: '100%', overflow: 'hidden' }}>
                        <MakeYourselfComfortableWizard />
                      </div>
                    )}

                  </div>
                </div>
              </Allotment.Pane>

              {/* Bottom shelf — ⚙️ Engineering Station (Drekaskip) */}
              {!layout.shelves.bottom.collapsed && (
                <Allotment.Pane
                  minSize={80}
                  preferredSize={layout.shelves.bottom.size ?? 260}
                >
                  <HelmShelf
                    shelfId="bottom"
                    cards={layout.shelves.bottom.cards}
                    collapsed={false}
                    station="engineering"
                    onToggleCollapse={() => toggleShelf('bottom')}
                    onAddCard={(cardId) => addCard('bottom', cardId)}
                    onRemoveCard={(cardId) => removeCard('bottom', cardId)}
                    onMoveUp={(cardId) => reorderCard('bottom', cardId, 'up')}
                    onMoveDown={(cardId) => reorderCard('bottom', cardId, 'down')}
                    onMoveTo={(cardId, targetShelf) => moveCard('bottom', targetShelf, cardId)}
                    onSwapCard={(oldId, newId) => swapCard('bottom', oldId, newId)}
                    onReorder={(fi, ti) => reorderInShelf('bottom', fi, ti)}
                    direction="row"
                  />
                </Allotment.Pane>
              )}
            </Allotment>

            {/* Bottom shelf collapsed strip */}
            {layout.shelves.bottom.collapsed && (
              <div
                style={{
                  height: 28, display: 'flex', flexDirection: 'row', alignItems: 'center',
                  gap: '0.5rem', padding: '0 0.75rem', background: '#0a0a12',
                  borderTop: '1px solid #2d3748', cursor: 'pointer', userSelect: 'none', flexShrink: 0,
                }}
                onClick={() => toggleShelf('bottom')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleShelf('bottom'); } }}
                title="Expand bottom shelf — ⚙️ Engineering Station"
                aria-expanded={false}
                aria-label="Expand Engineering station shelf"
              >
                <span style={{ fontSize: '0.75rem', color: '#4a5568' }}>⚙️ Engineering Station</span>
                <span style={{ fontSize: '0.65rem', color: '#2d3748' }}>· click to expand ↑</span>
              </div>
            )}
          </div>

          {/* Right shelf — 📡 Comms Station (In Conjunction) + ⚙️ Engineering (Active Substrate) */}
          <HelmShelf
            shelfId="right"
            cards={layout.shelves.right.cards}
            collapsed={layout.shelves.right.collapsed}
            station="comms"
            onToggleCollapse={() => toggleShelf('right')}
            onAddCard={(cardId) => addCard('right', cardId)}
            onRemoveCard={(cardId) => removeCard('right', cardId)}
            onMoveUp={(cardId) => reorderCard('right', cardId, 'up')}
            onMoveDown={(cardId) => reorderCard('right', cardId, 'down')}
            onMoveTo={(cardId, targetShelf) => moveCard('right', targetShelf, cardId)}
            onSwapCard={(oldId, newId) => swapCard('right', oldId, newId)}
            onReorder={(fi, ti) => reorderInShelf('right', fi, ti)}
            direction="column"
          />
        </div>

        {/* On-Deck panel (toggled from top bar) — 🧭 Quartermaster Station */}
        {showOnDeck && (
          <div style={styles.onDeckStrip}>
            <OnDeckPanel />
          </div>
        )}

        {/* Conjunction output strip */}
        {conjunctionOutput && (
          <div style={styles.outputStrip}>
            <div style={styles.outputHeader}>
              Conjunction Result · {lastResult?.synthesizer_mode} · {lastResult?.total_latency_ms}ms
              <button style={styles.outputClose} onClick={() => setConjunctionOutput(null)}>✕</button>
            </div>
            <div style={styles.outputBody}>{conjunctionOutput.slice(0, 2000)}</div>
          </div>
        )}

        {/* Injection event toast */}
        {injectionEvents.length > 0 && (
          <div style={{
            ...styles.injectionToast,
            background: injectionEvents[0].success ? '#14532d' : '#450a0a',
            borderColor: injectionEvents[0].success ? '#22c55e' : '#ef4444',
          }}>
            {injectionEvents[0].success ? '🧬 Context injected' : '⚠ Injection miss'}
            {' '}· {injectionEvents[0].url.slice(0, 40)}…
          </div>
        )}

        {/* Global Helm Decks Library picker */}
        {showLibraryPicker && (
          <HelmDecksPicker
            onSelect={(cardId, targetShelf) => addCard(targetShelf, cardId)}
            onClose={() => setShowLibraryPicker(false)}
            defaultShelf="right"
          />
        )}

      </div>
    </ConjunctionContext.Provider>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
    flex: 1, display: 'flex', flexDirection: 'column' as const,
    alignItems: 'flex-start', gap: '0.3rem', padding: '0.65rem 0.75rem',
    background: 'transparent', border: '1px solid #2d3748', borderRadius: '8px',
    cursor: 'pointer', textAlign: 'left' as const, color: '#e2e8f0',
    transition: 'border-color 0.15s, background 0.15s',
  },
  deckCardActive: { borderColor: '#f6ad55', background: 'rgba(246, 173, 85, 0.07)' },
  deckCardIcon: { fontSize: '1.35rem', lineHeight: 1 },
  deckCardTitle: { fontSize: '0.78rem', fontWeight: 700, color: '#f6ad55' },
  deckCardDesc: { fontSize: '0.68rem', color: '#718096', lineHeight: 1.4 },

  // ─── App Builder tab ──────────────────────────────────────────────────────
  appBuilderTab: {
    flex: 1, display: 'flex', flexDirection: 'column' as const,
    gap: '0.5rem', padding: '0.5rem', overflow: 'hidden', minHeight: 0,
  },
  builderCardBody: {
    flex: 1, overflow: 'hidden', minHeight: 0,
    display: 'flex', flexDirection: 'column' as const,
  },
  placeholderPane: {
    flex: 1, display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center', justifyContent: 'center',
    gap: '0.5rem', color: '#718096', padding: '2rem',
  },
  placeholderIcon: { fontSize: '2.5rem' },
  placeholderTitle: { fontSize: '0.95rem', fontWeight: 600, color: '#a0aec0' },
  placeholderDesc: { fontSize: '0.78rem', textAlign: 'center' as const, maxWidth: 320, lineHeight: 1.5 },

  // ─── Browser tab ─────────────────────────────────────────────────────────
  browserTab: {
    flex: 1, display: 'flex', flexDirection: 'column' as const,
    overflow: 'hidden', minHeight: 0,
  },
  browserSlots: {
    display: 'flex', gap: '0.4rem', padding: '0.5rem',
    flexShrink: 0, borderBottom: '1px solid #2d3748', background: '#0a0a12',
  },
  browserSlot: {
    flex: 1, display: 'flex', flexDirection: 'column' as const,
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
