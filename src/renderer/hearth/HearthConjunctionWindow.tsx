// B83 — Hearth Conjunction Window — Top-Level Shell
// "The Heavy Booster Test surface"
// Unifies: B69 App Builder Chat / B82 MoneyPenny / B61A Drekaskip /
//          Watchdog / B80 Sweat / B81 Tears / B-SE4-1 into ONE window
//
// BP041 Design Pass — §3: 3-tab layout (Prove It! / App Builder / Browser)
// Layout:
//   Left column:  Tab nav + tab content (Prove It! | App Builder | Browser)
//                 + persistent Drekaskip Wave Status footer band
//   Right column: In Conjunction panel (top) | Active Substrate Panel (bottom)
//
// Founder-coined names (immutable per R-FOUNDER-NAMING-PROVENANCE):
//   "Hearth Conjunction Window", "In Conjunction", "HEAVY BOOSTER TEST"

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppBuilderChat } from './AppBuilderChat';
import { ConjunctionPanel } from './conjunction/ConjunctionPanel';
import { EmbeddedChrome } from './embedded_browser/EmbeddedChrome';
import { DrekaskipStatusPanel } from './drekaskip_status/DrekaskipStatusPanel';
import { LiveSegWatch } from './drekaskip_status/LiveSegWatch';
import { NotCentsGlyph } from '../components/NotCentsGlyph';
import { NovaculaFireButton } from './drekaskip_status/NovaculaFireButton';
import { ActiveSubstratePanel } from './active_substrate/ActiveSubstratePanel';
import { OnDeckPanel } from './on_deck/OnDeckPanel';
import { MakeYourselfComfortableWizard } from './substrate/MakeYourselfComfortableWizard';
import {
  ConjunctionContext,
  DEFAULT_PANEL_STATE,
  DEFAULT_AVAILABILITY,
} from './conjunction/conjunction_state';
import type { ConjunctionMode, ConjunctionPanelState, ConjunctionResult, BackendAvailability } from './conjunction/types';

type HearthTab = 'prove_it' | 'app_builder' | 'browser' | 'substrate';

export function HearthConjunctionWindow() {
  const [panelState, setPanelState] = useState<ConjunctionPanelState>(DEFAULT_PANEL_STATE);
  const [availability, setAvailability] = useState<BackendAvailability>(DEFAULT_AVAILABILITY);
  const [lastResult, setLastResult] = useState<ConjunctionResult | null>(null);
  const [substrateContext, setSubstrateContext] = useState<string | null>(null);
  const [conjunctionOutput, setConjunctionOutput] = useState<string | null>(null);
  const [injectionEvents, setInjectionEvents] = useState<Array<{ success: boolean; url: string }>>([]);
  const [showOnDeck, setShowOnDeck] = useState(false);
  const [activeTab, setActiveTab] = useState<HearthTab>('prove_it');
  // §4 — Deck Card selections per tab (Founder rule: always 3 options)
  // BP041 — Default-select Card A so the Fire Novacula button is visible immediately
  // on Prove It! tab. After fire, auto-switch to Card C "Just Watch" so the member
  // sees SEGs progress live without manual navigation.
  const [proveCard, setProveCard] = useState<'A' | 'B' | 'C' | null>('A');

  // BP041 — Auto-switch to Card C on Novacula fire (so SEG progression is visible
  // immediately + member doesn't have to find it). Founder direct: "when I fire,
  // it should switch to Just Watch automatically."
  useEffect(() => {
    const onFire = () => {
      setActiveTab('prove_it');
      setProveCard('C');
    };
    window.addEventListener('mnemosyne-wave-fired', onFire);
    return () => window.removeEventListener('mnemosyne-wave-fired', onFire);
  }, []);

  // BP041 — Drekaskip footer drag-resize-UP. Native CSS resize grows DOWN from the
  // bottom; for a bottom-anchored footer member needs to drag UP to enlarge.
  // Custom top-edge drag handle solves it. Founder direct: "I STILL can't move
  // the bottom up... I want to see MORE of that if I feel like it."
  const [drekaskipHeight, setDrekaskipHeight] = useState<number>(260);
  const drekaskipDragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const handleDrekaskipDragStart = (e: React.MouseEvent) => {
    drekaskipDragRef.current = { startY: e.clientY, startHeight: drekaskipHeight };
    const onMove = (ev: MouseEvent) => {
      if (!drekaskipDragRef.current) return;
      const delta = drekaskipDragRef.current.startY - ev.clientY; // drag up = positive
      const next = Math.max(80, Math.min(800, drekaskipDragRef.current.startHeight + delta));
      setDrekaskipHeight(next);
    };
    const onUp = () => {
      drekaskipDragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // BP041 — Click feedback flash: track recent button presses for 250ms outline glow.
  // Founder direct: "SOMETHING should show me that I did, in fact, click it."
  const [lastClickedBtn, setLastClickedBtn] = useState<string | null>(null);
  const flashBtn = (id: string) => {
    setLastClickedBtn(id);
    setTimeout(() => setLastClickedBtn((cur) => (cur === id ? null : cur)), 250);
  };

  // BP041 — HELM VIEW canon (Founder direct): right shelf is the Helm station.
  // 3-dots toggle collapses to thin strip with active-count badge.
  // Persists across reload via localStorage.
  // Composes-forward with SAGA 5 Panel Manager (full multi-shelf + Deck Card swap).
  const [rightShelfCollapsed, setRightShelfCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('mnemosyne_right_shelf_collapsed') === '1'; } catch { return false; }
  });
  const toggleRightShelf = () => {
    setRightShelfCollapsed((cur) => {
      const next = !cur;
      try { localStorage.setItem('mnemosyne_right_shelf_collapsed', next ? '1' : '0'); } catch { /* non-fatal */ }
      return next;
    });
  };
  const [builderCard, setBuilderCard] = useState<'A' | 'B' | 'C'>('B');
  const contextRefreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load initial panel state + availability
  useEffect(() => {
    window.amplify.conjunctionGetState?.().then((s) => {
      if (s) setPanelState(s);
    }).catch(() => { /* non-fatal */ });

    refreshAvailability();

    // Refresh availability every 30s
    const avTimer = setInterval(refreshAvailability, 30_000);

    // Build substrate context on mount + every 60s
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
    } catch {
      /* non-fatal */
    }
  }, []);

  const buildContext = useCallback(async () => {
    try {
      const ctx = await window.amplify.conjunctionGetSubstrateContext?.();
      if (ctx?.raw_preamble) setSubstrateContext(ctx.raw_preamble);
    } catch {
      /* non-fatal */
    }
  }, []);

  const selectMode = useCallback(async (mode: ConjunctionMode) => {
    try {
      const result = await window.amplify.conjunctionSelect?.(mode);
      if (result?.ok) {
        setPanelState((s) => ({ ...s, selected: mode, per_request_override: null }));
      }
    } catch {
      /* non-fatal */
    }
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

  const handleShiftClick = useCallback((mode: ConjunctionMode) => {
    setPanelState((s) => ({ ...s, per_request_override: mode }));
    window.amplify.conjunctionSetOverride?.(mode).catch(() => { /* non-fatal */ });
  }, []);

  const TAB_META: Record<HearthTab, { icon: string; label: string; color: string; bgActive: string; bgInactive: string }> = {
    // BP041 — each tab has its own color identity; active tab gets full saturation,
    // inactive tabs muted but still hued. Founder direct: "different shades, so it
    // is clear that you are on a tab."
    prove_it:    { icon: '🎯', label: 'Prove It!',   color: '#f6ad55', bgActive: '#3a2a14', bgInactive: '#1a1410' }, // amber
    app_builder: { icon: '🏗️', label: 'App Builder', color: '#48bb78', bgActive: '#143524', bgInactive: '#0e1a13' }, // green
    browser:     { icon: '🌐', label: 'Browser',     color: '#4299e1', bgActive: '#142a3a', bgInactive: '#0e161e' }, // blue
    substrate:   { icon: '🪑', label: 'Substrate',   color: '#b48aff', bgActive: '#2a1a3a', bgInactive: '#150e1e' }, // violet — Pixie Dust Mining
  };

  return (
    <ConjunctionContext.Provider value={{ panelState, availability, lastResult, selectMode, dispatch, refreshAvailability }}>
      <div style={styles.root}>
        {/* Window header */}
        <div style={styles.topBar}>
          <NotCentsGlyph size="1.4rem" alt="NotCents · Mnemosyne identity" />
          <span style={styles.windowTitle}>Mnemosyne</span>
          <span style={styles.heavyBooster}>HEAVY BOOSTER TEST</span>
          <div style={styles.topBarSpacer} />
          {/* BP041 SAGA 3 — Watch View toggle (Ctrl+Shift+M) */}
          <button
            style={{
              ...styles.contextBtn,
              ...(lastClickedBtn === 'watch_view' ? styles.contextBtnFlash : {}),
            }}
            onClick={() => {
              flashBtn('watch_view');
              // Hide this window; the FrameModeIndicator overlay remains visible with OverlayTag
              window.amplify?.hideToWatchView?.().catch?.(() => {/* non-fatal */});
            }}
            title="Switch to Watch View — Mnemosyne fades to frame border. Press Ctrl+Shift+M or click the tag to return."
            aria-label="Switch to Watch View — hide main window, substrate stays active"
            aria-keyshortcuts="Control+Shift+M"
          >
            👁 Watch
          </button>

          {/* BP041 — Page-reload button + flash feedback on click */}
          <button
            style={{
              ...styles.contextBtn,
              ...(lastClickedBtn === 'reload' ? styles.contextBtnFlash : {}),
            }}
            onClick={() => { flashBtn('reload'); setTimeout(() => window.location.reload(), 180); }}
            title="Reload Mnemosyne window — like browser F5. Substrate state stays; UI rebuilds."
            aria-label="Reload Mnemosyne window"
          >
            🔄 Reload
          </button>
          <button
            style={{
              ...styles.contextBtn,
              ...(lastClickedBtn === 'sync_context' ? styles.contextBtnFlash : {}),
            }}
            onClick={() => { flashBtn('sync_context'); buildContext(); }}
            title="Sync Mnemosyne substrate to Embedded Chrome — when you open a web page in the Browser tab, Mnemosyne auto-injects what it knows (canon, receipts, current state) so the page is substrate-aware. This rebuilds that injection blob from latest substrate."
            aria-label="Sync substrate context to Embedded Chrome browser"
          >
            🧬 Sync to Browser
          </button>
          <button
            style={{
              ...styles.contextBtn,
              background: showOnDeck ? '#1e3a5f' : '#2d3748',
              borderColor: showOnDeck ? '#3b82f6' : '#4a5568',
              color: showOnDeck ? '#63b3ed' : '#e2e8f0',
              ...(lastClickedBtn === 'on_deck' ? styles.contextBtnFlash : {}),
            }}
            onClick={() => { flashBtn('on_deck'); setShowOnDeck((v) => !v); }}
            title="Toggle On Deck panel — your task queue staging area. Items here are pending Mnemosyne work you haven't fired yet."
            aria-label={`Toggle On Deck queue panel ${showOnDeck ? '(currently visible)' : '(currently hidden)'}`}
            aria-pressed={showOnDeck}
          >
            📋 On Deck {showOnDeck ? '(on)' : '(off)'}
          </button>
        </div>

        {/* Main layout: left (tabs) | right (panels) */}
        <div style={styles.layout}>

          {/* Left column: tab nav + tab content + drekaskip footer */}
          <div style={styles.leftCol}>

            {/* Tab navigation strip — per-tab color identity (BP041) */}
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
                      color: isActive ? meta.color : `${meta.color}99`, // ~60% opacity hex suffix
                      borderBottom: isActive
                        ? `3px solid ${meta.color}`
                        : `3px solid transparent`,
                      fontWeight: isActive ? 700 : 500,
                      fontSize: isActive ? '0.82rem' : '0.78rem',
                    }}
                    onClick={() => setActiveTab(tab)}
                  >
                    {meta.icon} {meta.label}
                  </button>
                );
              })}
            </div>

            {/* Tab content area — BP041: tinted to match active tab color (full-tab identity, not just nav) */}
            <div style={{
              ...styles.tabContent,
              background: TAB_META[activeTab].bgInactive,
              borderLeft: `1px solid ${TAB_META[activeTab].color}33`,
              borderRight: `1px solid ${TAB_META[activeTab].color}33`,
            }}>

              {/* ─── Prove It! — trust gateway ───────────────────────────── */}
              {activeTab === 'prove_it' && (
                <div style={styles.proveItTab}>
                  <div style={styles.proveItHeader}>
                    <span style={styles.proveItTitle}>🎯 Prove It!</span>
                    <span style={styles.proveItSubtitle}>
                      Trust gateway — verify the substrate runs on your hardware. Pick how you want to see the proof.
                    </span>
                  </div>

                  {/* Deck Cards — 3 options */}
                  <div style={styles.deckRow}>
                    {([
                      { key: 'A', icon: '🎯', title: 'Fire Empirical Proof', desc: 'Run canonical test data through the BP041 Empirical Proof Novacula. Instant trust — no setup. (Substrate adapts to your current concurrency cap.)' },
                      { key: 'B', icon: '🧪', title: 'Fire Your Own Test', desc: 'Provide your own input. Wrapped in the same Novacula pipeline — you own the result.' },
                      { key: 'C', icon: '👀', title: 'Just Watch', desc: 'Read the canonical published synthesis without firing. See what the system produces.' },
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

                  {/* Card action areas — BP041: LiveSegWatch shows real-time SEG progression + aggregates */}
                  {proveCard === 'A' && (
                    <div style={styles.proveItBody}>
                      <NovaculaFireButton />
                      <LiveSegWatch title="Live SEG Watch — current wave" maxHeight={360} />
                      {conjunctionOutput && (
                        <div style={styles.proveItNote}>Conjunction result ready — see strip below ↓</div>
                      )}
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
                      <p style={styles.proveItNote}>Read the most recent canonical synthesis without firing — see what the substrate produced:</p>
                      <LiveSegWatch title="Just Watch — latest wave" maxHeight={400} />
                      {conjunctionOutput && (
                        <details style={{ marginTop: '0.5rem' }}>
                          <summary style={{ cursor: 'pointer', fontSize: '0.7rem', color: '#86efac' }}>📄 Conjunction-Panel output (separate from Novacula synthesis)</summary>
                          <pre style={styles.synthesisView}>{conjunctionOutput.slice(0, 3000)}</pre>
                        </details>
                      )}
                    </div>
                  )}
                  {proveCard === null && (
                    <div style={styles.proveItBody}>
                      <p style={styles.proveItNote}>Pick a card above to get started.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ─── App Builder — 3 modes ───────────────────────────────── */}
              {activeTab === 'app_builder' && (
                <div style={styles.appBuilderTab}>
                  {/* Deck Cards */}
                  <div style={{ ...styles.deckRow, flexShrink: 0 }}>
                    {([
                      { key: 'A', icon: '📦', title: 'Build from Template', desc: 'Choose a cooperative pattern — budget tracker, task list, co-op ledger, and more.' },
                      { key: 'B', icon: '✏️', title: 'Describe in Plain English', desc: 'Tell CAI what you want. It builds the app locally on your machine. Free, always.' },
                      { key: 'C', icon: '🌳', title: 'Browse What Members Built', desc: 'Explore apps built by cooperative members. Install any with one click.' },
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

                  {/* Card content */}
                  <div style={styles.builderCardBody}>
                    {builderCard === 'A' && (
                      <div style={styles.placeholderPane}>
                        <span style={styles.placeholderIcon}>📦</span>
                        <span style={styles.placeholderTitle}>Cooperative Template Library</span>
                        <span style={styles.placeholderDesc}>Coming soon — pattern library for cooperative apps. Card B (Describe in Plain English) is available now.</span>
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

              {/* ─── Browser — 6 chalk-line slots + EmbeddedChrome ───────── */}
              {activeTab === 'browser' && (
                <div style={styles.browserTab}>
                  {/* 6 browser slots */}
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

                  {/* Embedded Chrome below the slot picker */}
                  <div style={styles.browserEmbedArea}>
                    <EmbeddedChrome
                      substrateContext={substrateContext}
                      onInjectionResult={(r) => setInjectionEvents((e) => [r, ...e].slice(0, 10))}
                    />
                  </div>
                </div>
              )}

              {/* ─── Substrate — Pixie Dust Mining (BP041 SAGA 1) ──────────── */}
              {activeTab === 'substrate' && (
                <div style={{ height: '100%', overflow: 'hidden' }}>
                  <MakeYourselfComfortableWizard />
                </div>
              )}
            </div>

            {/* Drekaskip Wave Status — resizable footer band (BP041 custom drag-up handle) */}
            <div style={{ ...styles.drekaskipFooter, height: drekaskipHeight }}>
              {/* Top-edge drag handle — grab here and drag UP to enlarge the footer */}
              <div
                style={styles.drekaskipResizeHandle}
                onMouseDown={handleDrekaskipDragStart}
                title="Drag up/down to resize the Drekaskip Wave Status panel"
                role="separator"
                aria-label="Resize Drekaskip Wave Status panel — drag up to enlarge, down to shrink"
                aria-orientation="horizontal"
                tabIndex={0}
                onKeyDown={(e) => {
                  // BP041 a11y Phase A — keyboard alternative to drag: arrow up/down resizes 20px
                  if (e.key === 'ArrowUp') {
                    setDrekaskipHeight((h) => Math.min(800, h + 20));
                    e.preventDefault();
                  } else if (e.key === 'ArrowDown') {
                    setDrekaskipHeight((h) => Math.max(80, h - 20));
                    e.preventDefault();
                  }
                }}
              >
                <span style={styles.drekaskipResizeGrip}>⇕</span>
              </div>
              <div style={styles.drekaskipFooterHeader}>
                <span>🌊</span> Drekaskip Wave Status
                <span style={styles.drekaskipResizeHint}>· drag the top edge to resize ↕</span>
              </div>
              <div style={styles.drekaskipFooterBody}>
                <DrekaskipStatusPanel />
              </div>
            </div>
          </div>

          {/* Right shelf — HELM VIEW Helm Station (BP041 canon). Click ⋮ to collapse / expand. */}
          {rightShelfCollapsed ? (
            <div
              style={styles.rightShelfCollapsed}
              onClick={toggleRightShelf}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleRightShelf(); } }}
              title="Expand right shelf — Helm Station (In Conjunction · Active Substrate)"
              role="button"
              tabIndex={0}
              aria-label="Expand Helm Station shelf — currently collapsed. Contains In Conjunction agent selector and Active Substrate scribe monitor."
              aria-expanded={false}
            >
              <span style={styles.shelfHandle}>⋮</span>
              <span style={styles.shelfBadge}>2</span>
              <span style={styles.shelfLabelVert}>HELM</span>
            </div>
          ) : (
            <div style={styles.rightCol}>
              {/* Shelf header with 3-dots collapse toggle */}
              <div style={styles.shelfHeader}>
                <span style={styles.shelfHeaderLabel}>🎯 Helm Station</span>
                <button
                  style={styles.shelfToggleBtn}
                  onClick={toggleRightShelf}
                  title="Collapse right shelf to thin strip"
                  aria-label="Collapse Helm Station shelf"
                  aria-expanded={true}
                >⋮</button>
              </div>

              {/* Conjunction Panel (B83a) — first Deck Card slot */}
              <div style={{ ...styles.panel, flex: '0 0 55%' }}>
                <div style={styles.panelHeader}><span>🔀</span> In Conjunction</div>
                <div style={styles.panelBody}>
                  <ConjunctionPanel
                    panelState={panelState}
                    availability={availability}
                    onSelect={selectMode}
                    onShiftClick={handleShiftClick}
                  />
                </div>
              </div>

              {/* Active Substrate Panel (B83d) — second Deck Card slot */}
              <div style={{ ...styles.panel, flex: '1 1 auto' }}>
                <div style={styles.panelHeader}><span>🔬</span> Active Substrate</div>
                <div style={styles.panelBody}>
                  <ActiveSubstratePanel />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* On-Deck panel (BP037) — full-width strip, toggled from top bar */}
        {showOnDeck && (
          <div style={styles.onDeckStrip}>
            <OnDeckPanel />
          </div>
        )}

        {/* Conjunction output strip (shown when dispatch result available) */}
        {conjunctionOutput && (
          <div style={styles.outputStrip}>
            <div style={styles.outputHeader}>
              Conjunction Result · {lastResult?.synthesizer_mode} · {lastResult?.total_latency_ms}ms
              <button style={styles.outputClose} onClick={() => setConjunctionOutput(null)}>✕</button>
            </div>
            <div style={styles.outputBody}>{conjunctionOutput.slice(0, 2000)}</div>
          </div>
        )}

        {/* Injection event toast (last injection) */}
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
    gap: '0.6rem',
    padding: '0.5rem 1rem',
    background: '#1a1a2e',
    borderBottom: '2px solid #f6ad55',
    flexShrink: 0,
    minHeight: 44, // BP041 — anchor for vertical alignment of header items
  },
  hearthFlame: {
    fontSize: '1.4rem',
    fontWeight: 700,
    color: '#f6ad55',
    display: 'inline-flex',
    alignItems: 'center',
  },
  windowTitle: {
    fontWeight: 700,
    fontSize: '1.1rem',
    color: '#f6ad55',
    letterSpacing: '0.04em',
    display: 'inline-flex',
    alignItems: 'center',
    lineHeight: 1, // BP041 — flush vertical alignment with HEAVY BOOSTER TEST badge
  },
  windowSubtitle: {
    fontSize: '0.7rem',
    color: '#a0aec0',
    fontStyle: 'italic',
    marginLeft: '0.25rem',
  },
  heavyBooster: {
    fontSize: '0.65rem',
    fontWeight: 700,
    background: '#f6ad55',
    color: '#1a1a2e',
    borderRadius: '4px',
    padding: '2px 6px',
    letterSpacing: '0.08em',
  },
  topBarSpacer: { flex: 1 },
  contextBtn: {
    background: '#2d3748',
    border: '1px solid #4a5568',
    borderRadius: '4px',
    color: '#e2e8f0',
    padding: '0.3rem 0.6rem',
    cursor: 'pointer',
    fontSize: '0.75rem',
    transition: 'all 0.15s ease-out',
  },
  contextBtnFlash: {
    // BP041 — click confirmation flash (250ms): bright outline + slight glow
    background: '#1a4a6e',
    borderColor: '#f6ad55',
    color: '#fff',
    boxShadow: '0 0 0 2px #f6ad5566, 0 0 8px #f6ad5544',
    transform: 'scale(0.97)',
  },
  layout: {
    display: 'flex',
    flex: 1,
    gap: '0.5rem',
    padding: '0.5rem',
    overflow: 'hidden',
    minHeight: 0,
  },

  // ─── Left column: tab nav + tab content + drekaskip footer ──────────────
  leftCol: {
    display: 'flex',
    flexDirection: 'column',
    flex: 2,
    minWidth: 0,
    overflow: 'hidden',
    background: '#0f0f1a',
    borderRadius: '8px',
    border: '1px solid #2d3748',
  },
  tabNav: {
    display: 'flex',
    flexShrink: 0,
    borderBottom: '2px solid #2d3748',
    background: '#12121f',
  },
  tabBtn: {
    // BP041 — base style; color/background/border/weight set per-tab inline
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
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '1rem',
    gap: '1rem',
    overflow: 'auto',
  },
  proveItHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  proveItTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#f6ad55',
  },
  proveItSubtitle: {
    fontSize: '0.82rem',
    color: '#a0aec0',
    lineHeight: 1.5,
    maxWidth: 480,
  },
  proveItBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  proveItNote: {
    fontSize: '0.75rem',
    color: '#68d391',
    fontStyle: 'italic',
  },
  synthesisView: {
    fontSize: '0.75rem',
    lineHeight: 1.5,
    color: '#e2e8f0',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    background: '#070710',
    border: '1px solid #2d3748',
    borderRadius: '6px',
    padding: '0.75rem',
    overflow: 'auto',
    maxHeight: 360,
  },

  // ─── Deck Cards (§4 — 3 options per tab) ─────────────────────────────────
  deckRow: {
    display: 'flex',
    gap: '0.5rem',
    flexShrink: 0,
  },
  deckCard: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-start',
    gap: '0.3rem',
    padding: '0.65rem 0.75rem',
    background: 'transparent',
    border: '1px solid #2d3748',
    borderRadius: '8px',
    cursor: 'pointer',
    textAlign: 'left' as const,
    color: '#e2e8f0',
    transition: 'border-color 0.15s, background 0.15s',
  },
  deckCardActive: {
    borderColor: '#f6ad55',
    background: 'rgba(246, 173, 85, 0.07)',
  },
  deckCardIcon: {
    fontSize: '1.35rem',
    lineHeight: 1,
  },
  deckCardTitle: {
    fontSize: '0.78rem',
    fontWeight: 700,
    color: '#f6ad55',
  },
  deckCardDesc: {
    fontSize: '0.68rem',
    color: '#718096',
    lineHeight: 1.4,
  },

  // ─── App Builder tab ──────────────────────────────────────────────────────
  appBuilderTab: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
    padding: '0.5rem',
    overflow: 'hidden',
    minHeight: 0,
  },
  builderCardBody: {
    flex: 1,
    overflow: 'hidden',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column' as const,
  },
  placeholderPane: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    color: '#718096',
    padding: '2rem',
  },
  placeholderIcon: { fontSize: '2.5rem' },
  placeholderTitle: { fontSize: '0.95rem', fontWeight: 600, color: '#a0aec0' },
  placeholderDesc: { fontSize: '0.78rem', textAlign: 'center' as const, maxWidth: 320, lineHeight: 1.5 },

  // ─── Browser tab ─────────────────────────────────────────────────────────
  browserTab: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    minHeight: 0,
  },
  browserSlots: {
    display: 'flex',
    gap: '0.4rem',
    padding: '0.5rem',
    flexShrink: 0,
    borderBottom: '1px solid #2d3748',
    background: '#0a0a12',
  },
  browserSlot: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '0.2rem',
    padding: '0.4rem 0.25rem',
    border: '1px solid',
    borderRadius: '6px',
    cursor: 'pointer',
    background: 'rgba(255,255,255,0.02)',
    transition: 'background 0.15s',
  },
  browserSlotLabel: {
    fontSize: '0.6rem',
    fontWeight: 600,
    letterSpacing: '0.04em',
  },
  browserEmbedArea: {
    flex: 1,
    overflow: 'hidden',
    minHeight: 0,
  },

  // ─── Drekaskip footer band (persistent across all tabs) ──────────────────
  // BP041 — height controlled by drekaskipHeight state via custom top-edge
  // drag handle. Drag UP to enlarge (footer is bottom-anchored so member
  // never has to reach below the visible area).
  drekaskipFooter: {
    flexShrink: 0,
    borderTop: 'none', // handle below provides the visual edge
    background: '#0a0a12',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  },
  drekaskipResizeHandle: {
    // BP041 a11y Phase A — bumped 8→16px for WCAG 2.5.5 click-target compliance
    height: 16,
    background: 'linear-gradient(180deg, #f6ad5544 0%, #f6ad5511 100%)',
    cursor: 'ns-resize',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background 0.15s',
    userSelect: 'none',
  },
  drekaskipResizeGrip: {
    fontSize: '0.7rem',
    color: '#f6ad55',
    opacity: 0.7,
    letterSpacing: '-2px',
  },
  drekaskipResizeHint: {
    marginLeft: 'auto',
    fontSize: '0.65rem',
    color: '#4a5568',
    fontStyle: 'italic',
    fontWeight: 400,
  },
  drekaskipFooterHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.3rem 0.75rem',
    background: '#111120',
    borderBottom: '1px solid #2d3748',
    fontWeight: 600,
    fontSize: '0.75rem',
    color: '#718096',
    flexShrink: 0,
  },
  drekaskipFooterBody: {
    flex: 1,
    overflow: 'auto',
    padding: '0.4rem 0.75rem',
    minHeight: 0,
  },

  // ─── Right column panels ──────────────────────────────────────────────────
  // BP041 — HELM VIEW canon: collapsed-shelf strip + header + toggle
  rightShelfCollapsed: {
    flex: '0 0 28px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0',
    background: '#0a0a14',
    borderLeft: '1px solid #2d3748',
    cursor: 'pointer',
    transition: 'background 0.18s',
    userSelect: 'none' as const,
  },
  shelfHandle: { fontSize: '1.1rem', color: '#a0aec0', lineHeight: 1 },
  shelfBadge: {
    background: '#f6ad55',
    color: '#1a1a2e',
    fontSize: '0.6rem',
    fontWeight: 700,
    padding: '1px 5px',
    borderRadius: '8px',
    lineHeight: 1.2,
  },
  shelfLabelVert: {
    writingMode: 'vertical-rl' as const,
    transform: 'rotate(180deg)',
    fontSize: '0.6rem',
    color: '#718096',
    letterSpacing: '0.1em',
    fontWeight: 700,
    marginTop: '0.5rem',
  },
  shelfHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 10px',
    background: '#111120',
    borderBottom: '1px solid #2d3748',
    fontSize: '0.7rem',
    flexShrink: 0,
  },
  shelfHeaderLabel: { fontWeight: 700, color: '#cbd5e0', letterSpacing: '0.04em' },
  shelfToggleBtn: {
    background: 'none',
    border: 'none',
    color: '#a0aec0',
    cursor: 'pointer',
    fontSize: '1rem',
    lineHeight: 1,
    padding: '0 4px',
    borderRadius: '3px',
  },
  rightCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    flex: '0 0 300px',
    minWidth: 240,
    overflow: 'hidden',
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    background: '#0f0f1a',
    borderRadius: '8px',
    border: '1px solid #2d3748',
    overflow: 'hidden',
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.4rem 0.75rem',
    background: '#1a1a2e',
    borderBottom: '1px solid #2d3748',
    fontWeight: 600,
    fontSize: '0.8rem',
    color: '#a0aec0',
    flexShrink: 0,
  },
  panelBody: {
    flex: 1,
    overflow: 'auto',
    padding: '0.5rem',
    minHeight: 0,
  },

  // ─── Strips & toasts ─────────────────────────────────────────────────────
  onDeckStrip: {
    borderTop: '2px solid #3b82f6',
    background: '#070710',
    flexShrink: 0,
    height: 340,
    overflow: 'hidden',
  },
  outputStrip: {
    borderTop: '1px solid #f6ad55',
    background: '#110a00',
    flexShrink: 0,
    maxHeight: '35vh',
    display: 'flex',
    flexDirection: 'column',
  },
  outputHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.4rem 0.75rem',
    background: '#1a1100',
    fontSize: '0.75rem',
    color: '#f6ad55',
    fontWeight: 600,
  },
  outputClose: {
    background: 'none',
    border: 'none',
    color: '#718096',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  outputBody: {
    flex: 1,
    overflow: 'auto',
    padding: '0.5rem 0.75rem',
    fontSize: '0.78rem',
    lineHeight: 1.5,
    color: '#e2e8f0',
    whiteSpace: 'pre-wrap',
  },
  injectionToast: {
    position: 'fixed',
    bottom: '0.75rem',
    right: '0.75rem',
    border: '1px solid',
    borderRadius: '6px',
    padding: '0.3rem 0.6rem',
    fontSize: '0.72rem',
    color: '#e2e8f0',
    zIndex: 9999,
    maxWidth: 320,
  },
};
