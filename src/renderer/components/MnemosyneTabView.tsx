// MnemosyneTabView — SAGA 07 BP046B · updated BP047 W1
// 6-tab Mnemosyne application shell:
//   Tab 1 · Frame     — Transparent Outlining Window status + controls (daily driver)
//   Tab 2 · Helm      — LB platform interface + Beacons side-shelves (membership gate)
//   Tab 3 · Gauntlet  — 6-stage testing framework + checkmark selection (first-launch default)
//   Tab 4 · Settings  — update · appearance · AI model assignment · substrate default (always visible)
//   Tab 5 · FAQ       — tl;dr / full-steps toggle · 7 seed entries (always visible)
//   Tab 6 · Developer — conditional, gated by membership + Pledge #2260 OR business license
//
// First-launch default = Tab 3 (Gauntlet front-and-center to onboard).
// After first Gauntlet completion, default shifts to Tab 1 (Frame as daily driver).
// Tab 6 visibility = developer_mode_enabled flag in localStorage.

import React, { useCallback, useRef, useState, useEffect } from 'react';
import type { FrameMode } from './FrameModeIndicator';
import type { AuthState } from '../amplify.d';
import type { UpdateState } from '../amplify.d';
import { GauntletTab } from './GauntletTab';
import { FrameTab } from './FrameTab';
import { DevModeTab } from './DevModeTab';
import { SettingsTab } from './SettingsTab';
import { FAQTab } from './FAQTab';
import { CaiSymbol } from './CaiSymbol';
import { OnboardingGate } from '../hearth/substrate/MakeYourselfComfortableWizard';

import { HelmCrownDashboard } from '../hearth/helm/HelmCrownDashboard';
import { AtlasView } from '../kitchen_table/AtlasView';
import { KitchenTableView } from '../kitchen_table/KitchenTableView';
import { AppTab } from './AppTab';
import { PearlGalleryTab } from './PearlGalleryTab';
import { PhoebePage } from './PhoebePage';

// ─── Local-storage keys ───────────────────────────────────────────────────────

const LS_GAUNTLET_FIRST_COMPLETE = 'mnemo_gauntlet_first_complete';
const LS_DEVELOPER_MODE = 'mnemo_developer_mode_enabled';
const LS_ACTIVE_TAB = 'mnemo_active_tab';
const LS_ONBOARD_CHOICE = 'mnemo_onboard_choice'; // 'free' | 'member' | 'developer' | 'dismissed'
const LS_WIND_UNLOCKED = 'mnem_wind_unlocked';
const LS_WIND_TIER = 'mnem_wind_tier';

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabId = 'frame' | 'helm' | 'gauntlet' | 'settings' | 'faq' | 'developer' | 'atlas' | 'kitchen-table' | 'app' | 'pearl-gallery' | 'phoebe';

interface TabDef {
  id: TabId;
  label: string;
  icon: string;
  iconElement?: React.ReactNode;
  tooltip: string;
}

const TABS: TabDef[] = [
  { id: 'frame',     label: 'Frame',     icon: '🪟', tooltip: 'Tab 1 · Frame — Transparent Outlining Window (your daily driver)' },
  { id: 'helm',      label: 'Helm',      icon: '🧭', tooltip: 'Tab 2 · Helm — LB platform · Beacons · cooperative peer-mesh' },
  { id: 'gauntlet',  label: 'Gauntlet',  icon: '⚔️', tooltip: 'Tab 3 · Gauntlet — 6-stage testing framework · stage selection · Pioneer Bonus' },
  { id: 'settings',  label: 'Settings',  icon: '⚙️', tooltip: 'Tab 4 · Settings — update Mnemosyne · AI model assignment · appearance · preferences' },
  { id: 'faq',       label: 'FAQ',       icon: '❓',  tooltip: 'Tab 5 · FAQ — common questions · tl;dr answers' },
  { id: 'developer',     label: 'Developer',     icon: '',    iconElement: <CaiSymbol size={13} color="#f59e0b" aria-label="CAI" />, tooltip: 'Tab 6 · Developer Mode — Caithedral™ · Eblet™ · Pheromone · Banyan Metric™ · SEG controls' },
  { id: 'atlas',         label: 'Atlas™',         icon: '📅', tooltip: 'Tab 7 · Atlas™ — Calendar · Events · Multi-person scheduling · P2P sync' },
  { id: 'kitchen-table', label: 'Kitchen Table',  icon: '🍽️', tooltip: 'Tab 8 · The Kitchen Table™ — Recipes™ · Meal planning · LAN peer discovery' },
  { id: 'app',           label: 'Services',       icon: '🧩', tooltip: 'Tab 9 · Cooperative Services — 10 member-services · App Tab BP054' },
  { id: 'pearl-gallery', label: 'Pearls',         icon: '💎', tooltip: 'Tab 10 · Pearl Gallery — Cooperative Memory Substrate · decoded transmissions' },
  { id: 'phoebe',        label: 'Idea Storage',   icon: '💡', tooltip: 'Tab 11 · Idea Storage™ — Phoebe™ · articles · URLs · inspiration boards' },
];

// ─── Props ───────────────────────────────────────────────────────────────────

interface MnemosyneTabViewProps {
  currentMode: FrameMode;
  onModeChange: (mode: FrameMode) => void;
  onClose: () => void;
  authState: AuthState | null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MnemosyneTabView({
  currentMode,
  onModeChange,
  onClose,
  authState,
}: MnemosyneTabViewProps) {
  const isMember = authState?.status === 'member' || authState?.status === 'trial_active';
  const isFounder = (authState as any)?.member?.is_founder === true;
  const displayName = (authState as any)?.member?.display_name as string | undefined;

  // Developer mode unlock — membership + Pledge #2260 OR business license
  const [devEnabled, setDevEnabled] = useState(() =>
    localStorage.getItem(LS_DEVELOPER_MODE) === 'true'
  );

  // 3-option ask: shown on first launch until user dismisses
  const [showOnboardAsk, setShowOnboardAsk] = useState(() =>
    !localStorage.getItem(LS_ONBOARD_CHOICE)
  );
  const [windUnlocked, setWindUnlocked] = useState(() =>
    localStorage.getItem(LS_WIND_UNLOCKED) === 'true'
  );
  const [appVersion, setAppVersion] = useState('');
  const [updateState, setUpdateState] = useState<UpdateState | null>(null);
  const windClickCount = useRef(0);
  const windClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Determine default tab: Tab 3 (gauntlet) on first launch, Tab 1 (frame) after first run
  function resolveDefaultTab(): TabId {
    const gauntletDone = localStorage.getItem(LS_GAUNTLET_FIRST_COMPLETE) === 'true';
    const saved = localStorage.getItem(LS_ACTIVE_TAB) as TabId | null;
    const validTabs: TabId[] = ['frame', 'helm', 'gauntlet', 'settings', 'faq', 'developer', 'atlas', 'kitchen-table', 'app', 'pearl-gallery', 'phoebe'];
    if (saved && validTabs.includes(saved) && (saved !== 'developer' || devEnabled)) return saved;
    return gauntletDone ? 'frame' : 'gauntlet';
  }

  const [activeTab, setActiveTab] = useState<TabId>(resolveDefaultTab);

  // Persist active tab
  useEffect(() => {
    localStorage.setItem(LS_ACTIVE_TAB, activeTab);
  }, [activeTab]);

  useEffect(() => {
    window.amplify?.getAppVersion?.().then((v) => setAppVersion(v?.version ?? '')).catch(() => {});
  }, []);

  useEffect(() => {
    if (!window.amplify) return;
    window.amplify.getUpdateState?.().then(setUpdateState).catch(() => {});
    const cleanup = window.amplify.onUpdateStateChanged?.((s) => setUpdateState(s));
    return cleanup ?? undefined;
  }, []);

  // Called by GauntletTab when the first full Gauntlet run completes
  function handleGauntletFirstComplete() {
    if (!localStorage.getItem(LS_GAUNTLET_FIRST_COMPLETE)) {
      localStorage.setItem(LS_GAUNTLET_FIRST_COMPLETE, 'true');
    }
  }

  // Cross-tab navigation — used by AppTab service tiles
  function handleNavigate(tabId: string) {
    const validTabs: TabId[] = ['frame', 'helm', 'gauntlet', 'settings', 'faq', 'developer', 'atlas', 'kitchen-table', 'app', 'pearl-gallery', 'phoebe'];
    if (validTabs.includes(tabId as TabId)) setActiveTab(tabId as TabId);
  }

  // Developer mode unlock from DevModeTab or settings
  function handleDevModeToggle(enabled: boolean) {
    setDevEnabled(enabled);
    localStorage.setItem(LS_DEVELOPER_MODE, enabled ? 'true' : 'false');
    if (!enabled && activeTab === 'developer') setActiveTab('gauntlet');
  }

  // Step-by-step interlock — forward-wires to FAQ tab (no-op until tab exists)
  function handleStepByStep(surfaceId: string) {
    localStorage.setItem('mnemosyne_faq_topic', surfaceId);
    setActiveTab('faq' as TabId); // will no-op visually until 'faq' tab is added to TABS array
  }

  // 3-option ask handlers
  function handleOnboardChoice(choice: 'free' | 'member' | 'developer') {
    localStorage.setItem(LS_ONBOARD_CHOICE, choice);
    setShowOnboardAsk(false);
    if (choice === 'member') {
      window.amplify?.openExternal?.('https://lianabanyan.com/join');
    }
    if (choice === 'developer') {
      window.amplify?.openExternal?.('https://lianabanyan.com/join');
      // Developer mode unlock is confirmed after membership + pledge sign
    }
  }

  function showWindToast() {
    const existing = document.getElementById('wind-unlock-toast');
    if (existing) return;
    const toast = document.createElement('div');
    toast.id = 'wind-unlock-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.className = 'wind-unlock-toast';
    toast.textContent = '✨ Ambience unlocked — Tab 1 · Frame';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }

  const handleBrandTripleClick = useCallback(() => {
    if (localStorage.getItem(LS_WIND_UNLOCKED) === 'true') return;

    windClickCount.current += 1;
    if (windClickTimer.current) clearTimeout(windClickTimer.current);
    windClickTimer.current = setTimeout(() => {
      windClickCount.current = 0;
    }, 600);

    if (windClickCount.current >= 3) {
      windClickCount.current = 0;
      if (windClickTimer.current) clearTimeout(windClickTimer.current);
      if (!localStorage.getItem(LS_WIND_TIER)) {
        localStorage.setItem(LS_WIND_TIER, 'BREEZE');
      }
      localStorage.setItem(LS_WIND_UNLOCKED, 'true');
      setWindUnlocked(true);
      setActiveTab('frame');
      showWindToast();
    }
  }, []);

  const visibleTabs = TABS.filter((t) => t.id !== 'developer' || devEnabled);
  // Atlas™ and Kitchen Table™ are always visible (core v0.1.8 features)

  // ─── Styles ────────────────────────────────────────────────────────────────

  const styles = {
    shell: {
      display: 'flex',
      flexDirection: 'column' as const,
      height: '100vh',
      background: '#0a0f1a',
      color: '#e2e8f0',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      overflow: 'hidden',
    },
    titleBar: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 16px 0',
      flexShrink: 0,
    } as React.CSSProperties,
    brand: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    } as React.CSSProperties,
    brandName: {
      fontSize: 15,
      fontWeight: 700,
      color: '#6ee7b7',
      letterSpacing: '-0.3px',
    },
    brandSub: {
      fontSize: 10,
      color: '#475569',
      letterSpacing: '0.05em',
    },
    closeBtn: {
      background: 'none',
      border: 'none',
      color: '#475569',
      cursor: 'pointer',
      fontSize: 14,
      padding: '2px 6px',
      borderRadius: 4,
    } as React.CSSProperties,
    tabBar: {
      display: 'flex',
      borderBottom: '1px solid rgba(100,116,139,0.2)',
      padding: '8px 12px 0',
      gap: 2,
      flexShrink: 0,
    } as React.CSSProperties,
    tab: (active: boolean): React.CSSProperties => ({
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      padding: '6px 14px',
      borderRadius: '6px 6px 0 0',
      border: '1px solid transparent',
      borderBottom: 'none',
      fontSize: 12,
      fontWeight: active ? 600 : 400,
      cursor: 'pointer',
      transition: 'all 0.15s ease',
      background: active ? 'rgba(110,231,183,0.08)' : 'transparent',
      color: active ? '#6ee7b7' : '#64748b',
      borderColor: active ? 'rgba(110,231,183,0.2)' : 'transparent',
      userSelect: 'none',
    }),
    tabIcon: {
      fontSize: 13,
    },
    tabContent: {
      flex: 1,
      overflow: 'auto',
      position: 'relative' as const,
    },
    modeChip: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 10,
      color: '#64748b',
      background: 'rgba(100,116,139,0.1)',
      border: '1px solid rgba(100,116,139,0.2)',
      borderRadius: 10,
      padding: '2px 8px',
    } as React.CSSProperties,
  };

  const modeLabel: Record<FrameMode, string> = {
    ai_burst: '🔥 AI Burst',
    normal: '🪵 Normal',
    fallback: '❄️ Fallback',
  };

  return (
    <OnboardingGate>
    <div style={styles.shell}>
      {/* Title bar */}
      <div style={styles.titleBar}>
        <div style={styles.brand}>
          <div>
            <div
              style={styles.brandName}
              onClick={handleBrandTripleClick}
              title={windUnlocked ? 'Mnemosyne™ — Ambience active' : 'Mnemosyne™'}
              aria-label="Mnemosyne™"
            >
              Mnemosyne™
            </div>
            <div style={{ ...styles.brandSub, display: 'flex', alignItems: 'center', gap: 4 }}>
              <CaiSymbol size={12} color="#6ee7b7" aria-label="CAI" />
              <span>
                {appVersion ? `v${appVersion} · ` : ''}CAI Amplifier · Liana Banyan
              </span>
              {/* Bug #2 v0.1.10: update status pill */}
              {updateState && updateState.status === 'downloaded' && (
                <button
                  onClick={() => window.amplify?.installUpdate?.()}
                  title={`v${updateState.version} ready — click to install & restart`}
                  style={{
                    background: 'rgba(59,130,246,0.15)',
                    border: '1px solid rgba(59,130,246,0.4)',
                    borderRadius: 10,
                    color: '#60a5fa',
                    fontSize: 9,
                    fontWeight: 700,
                    padding: '1px 6px',
                    cursor: 'pointer',
                    animation: 'mnemo-pulse 2s ease-in-out infinite',
                    whiteSpace: 'nowrap',
                  }}
                  aria-label={`v${updateState.version} ready to install`}
                >
                  v{updateState.version} · install ↻
                </button>
              )}
              {updateState && updateState.status === 'available' && (
                <span
                  title={`v${updateState.version} downloading…`}
                  style={{
                    background: 'rgba(245,158,11,0.15)',
                    border: '1px solid rgba(245,158,11,0.3)',
                    borderRadius: 10,
                    color: '#fbbf24',
                    fontSize: 9,
                    fontWeight: 600,
                    padding: '1px 6px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  update available
                </span>
              )}
              {updateState && updateState.status === 'downloading' && (
                <span
                  style={{
                    background: 'rgba(110,231,183,0.1)',
                    border: '1px solid rgba(110,231,183,0.25)',
                    borderRadius: 10,
                    color: '#6ee7b7',
                    fontSize: 9,
                    fontWeight: 600,
                    padding: '1px 6px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  downloading {updateState.downloadProgress ?? 0}%
                </span>
              )}
              {(!updateState || updateState.status === 'idle' || updateState.status === 'not-available') && appVersion && (
                <span
                  style={{
                    background: 'rgba(34,197,94,0.1)',
                    border: '1px solid rgba(34,197,94,0.25)',
                    borderRadius: 10,
                    color: '#4ade80',
                    fontSize: 9,
                    fontWeight: 600,
                    padding: '1px 6px',
                    whiteSpace: 'nowrap',
                  }}
                  title="Up to date"
                >
                  up to date
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={() => window.amplify?.checkForUpdates?.()}
            title="Check for updates to Mnemosyne"
            style={{
              padding: '5px 10px',
              background: 'rgba(110,231,183,0.1)',
              border: '1px solid rgba(110,231,183,0.3)',
              borderRadius: 6,
              color: '#6ee7b7',
              fontSize: 10,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Check for Updates{appVersion ? ` · v${appVersion}` : ''}
          </button>
          <div style={styles.modeChip}>
            {modeLabel[currentMode]}
          </div>
          <button
            style={styles.closeBtn}
            onClick={onClose}
            title="Close"
            aria-label="Close Mnemosyne"
          >
            ✕
          </button>
        </div>
      </div>

      {/* SAGA 03 — 3-option ask (first launch only) */}
      {showOnboardAsk && (
        <ThreeOptionAsk onChoice={handleOnboardChoice} devModeEnabled={devEnabled} appVersion={appVersion} />
      )}

      {/* BP048 — Dashboard → Bridge discoverability (complementary surfaces) */}
      <div style={{ padding: '8px 16px 0' }}>
        <button
          type="button"
          onClick={() => window.amplify?.openHearthConjunction?.()}
          style={{
            width: '100%',
            padding: '8px 12px',
            background: 'rgba(100,116,139,0.08)',
            border: '1px solid rgba(100,116,139,0.25)',
            borderRadius: 8,
            color: '#94a3b8',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            textAlign: 'left',
          }}
          title="Open the Heavy Booster operator console"
        >
          Open the Bridge →
        </button>
      </div>

      {/* Tab bar */}
      <div style={styles.tabBar} role="tablist" aria-label="Mnemosyne navigation">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            style={styles.tab(activeTab === tab.id)}
            onClick={() => setActiveTab(tab.id)}
            title={tab.tooltip}
          >
            <span style={styles.tabIcon} aria-hidden>{tab.iconElement ?? tab.icon}</span>
            {tab.label}
            {tab.id === 'developer' && (
              <span style={{ fontSize: 9, color: '#f59e0b', marginLeft: 2 }}>DEV</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div style={styles.tabContent}>
        {activeTab === 'frame' && (
          <div
            id="panel-frame"
            role="tabpanel"
            aria-labelledby="tab-frame"
            style={{ height: '100%' }}
          >
            <FrameTab
              currentMode={currentMode}
              onModeChange={onModeChange}
              authState={authState}
              windUnlocked={windUnlocked}
            />
          </div>
        )}

        {activeTab === 'helm' && (
          <div
            id="panel-helm"
            role="tabpanel"
            aria-labelledby="tab-helm"
            style={{ height: '100%' }}
          >
            {isMember || isFounder ? (
              <HelmCrownDashboard
                userRole={isFounder ? 'founder' : 'helm-crown'}
                displayName={displayName}
              />
            ) : (
              <HelmGate onJoin={() => window.amplify?.openExternal?.('https://lianabanyan.com/join')} />
            )}
          </div>
        )}

        {activeTab === 'gauntlet' && (
          <div
            id="panel-gauntlet"
            role="tabpanel"
            aria-labelledby="tab-gauntlet"
            style={{ height: '100%' }}
          >
            <GauntletTab
              authState={authState}
              onFirstComplete={handleGauntletFirstComplete}
            />
          </div>
        )}

        {activeTab === 'settings' && (
          <div
            id="panel-settings"
            role="tabpanel"
            aria-labelledby="tab-settings"
            style={{ height: '100%' }}
          >
            <SettingsTab
              authState={authState}
              devEnabled={devEnabled}
              onDevModeToggle={handleDevModeToggle}
            />
          </div>
        )}

        {activeTab === 'faq' && (
          <div
            id="panel-faq"
            role="tabpanel"
            aria-labelledby="tab-faq"
            style={{ height: '100%' }}
          >
            <FAQTab />
          </div>
        )}

        {activeTab === 'developer' && devEnabled && (
          <div
            id="panel-developer"
            role="tabpanel"
            aria-labelledby="tab-developer"
            style={{ height: '100%' }}
          >
            <DevModeTab
              authState={authState}
              onDisable={() => handleDevModeToggle(false)}
              onStepByStep={handleStepByStep}
            />
          </div>
        )}

        {activeTab === 'atlas' && (
          <div
            id="panel-atlas"
            role="tabpanel"
            aria-labelledby="tab-atlas"
            style={{ height: '100%' }}
          >
            <AtlasView />
          </div>
        )}

        {activeTab === 'kitchen-table' && (
          <div
            id="panel-kitchen-table"
            role="tabpanel"
            aria-labelledby="tab-kitchen-table"
            style={{ height: '100%' }}
          >
            <KitchenTableView />
          </div>
        )}

        {activeTab === 'app' && (
          <div
            id="panel-app"
            role="tabpanel"
            aria-labelledby="tab-app"
            style={{ height: '100%' }}
          >
            <AppTab authState={authState} onNavigate={handleNavigate} />
          </div>
        )}

        {activeTab === 'pearl-gallery' && (
          <div
            id="panel-pearl-gallery"
            role="tabpanel"
            aria-labelledby="tab-pearl-gallery"
            style={{ height: '100%' }}
          >
            <PearlGalleryTab />
          </div>
        )}

        {activeTab === 'phoebe' && (
          <div
            id="panel-phoebe"
            role="tabpanel"
            aria-labelledby="tab-phoebe"
            style={{ height: '100%' }}
          >
            <PhoebePage />
          </div>
        )}
      </div>

      {/* Developer mode unlock prompt — shown at bottom only if not yet enabled */}
      {!devEnabled && (isMember || isFounder) && (
        <DevModeUnlockBar onEnable={() => handleDevModeToggle(true)} />
      )}
    </div>
    </OnboardingGate>
  );
}

// ─── Helm Gate (non-member) ──────────────────────────────────────────────────

function HelmGate({ onJoin }: { onJoin: () => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', gap: 16, padding: 32, textAlign: 'center',
    }}>
      <div style={{ fontSize: 32 }}>🧭</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0' }}>Helm is for members</div>
      <div style={{ fontSize: 12, color: '#64748b', maxWidth: 280, lineHeight: 1.6 }}>
        Join the cooperative for $5/year to access Helm — the LB platform bridge,
        Beacons, and Federation Stage 6.
      </div>
      <button
        onClick={onJoin}
        style={{
          background: 'rgba(110,231,183,0.12)', border: '1px solid rgba(110,231,183,0.3)',
          color: '#6ee7b7', borderRadius: 8, padding: '8px 20px', fontSize: 13,
          fontWeight: 600, cursor: 'pointer',
        }}
      >
        Join — $5/year →
      </button>
      <div style={{ fontSize: 10, color: '#334155' }}>Free to use. Better to join.</div>
    </div>
  );
}

// ─── 3-option ask (SAGA 03) ──────────────────────────────────────────────────

function ThreeOptionAsk({
  onChoice,
  devModeEnabled,
  appVersion = '',
}: {
  onChoice: (c: 'free' | 'member' | 'developer') => void;
  devModeEnabled?: boolean;
  appVersion?: string;
}) {
  return (
    <div style={{
      background: 'rgba(10,15,26,0.97)',
      borderBottom: '1px solid rgba(110,231,183,0.15)',
      padding: '16px 20px',
      flexShrink: 0,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
        Welcome to Mnemosyne — how do you want to use it?
      </div>
      <div style={{ fontSize: 10, color: '#64748b', marginBottom: 12 }}>
        ANY hardware · ANY network · ANY AI model · or NONE AT ALL
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <OptionCard
          number={1}
          label="Use Free Forever"
          desc="No account needed · Tab 1 Frame is your daily driver · substrate runs locally · zero cost"
          color="#6ee7b7"
          onClick={() => onChoice('free')}
        />
        <OptionCard
          number={2}
          label="Join the cooperative — $5/year"
          desc="Unlock Tab 2 Helm + Federation Stage 6 + Banyan Metric sharing + Code Breakers marks"
          color="#34d399"
          onClick={() => onChoice('member')}
        />
        <OptionCard
          number={3}
          label={devModeEnabled ? 'Developer Mode Enabled' : 'Enable Developer Mode'}
          desc={
            devModeEnabled
              ? 'Active — submitting variants, forking strains, and controlling SEG count is now available in Tab 4'
              : 'Become a tester · submit Gauntlet variants · earn Pioneer Bonus marks · requires Option 2 OR business license'
          }
          color="#f59e0b"
          onClick={() => onChoice('developer')}
          enabled={devModeEnabled}
        />
        <OptionCard
          number={4}
          label="Check for Updates"
          desc={
            appVersion
              ? `Currently v${appVersion} · tap to check mnemosynec.ai for the latest strain`
              : 'Check mnemosynec.ai for the latest Mnemosyne strain'
          }
          color="#38bdf8"
          onClick={() => window.amplify?.checkForUpdates?.()}
        />
      </div>
    </div>
  );
}

function OptionCard({ number, label, desc, color, onClick, enabled }: {
  number: number; label: string; desc: string; color: string; onClick: () => void; enabled?: boolean;
}) {
  const rgba = color === '#6ee7b7' ? '110,231,183' : color === '#34d399' ? '52,211,153' : '245,158,11';
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, textAlign: 'left',
        background: `rgba(${rgba},0.06)`,
        border: `1px solid rgba(${rgba},${enabled ? '0.4' : '0.2'})`,
        borderRadius: 8, padding: '9px 12px', cursor: 'pointer', width: '100%',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
        background: `rgba(${rgba},0.15)`,
        border: `1px solid ${color}`, color, fontSize: 11, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {enabled ? '✓' : number}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color, display: 'flex', alignItems: 'center', gap: 5 }}>
          {label}
          {enabled && (
            <span style={{
              fontSize: 8, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)',
              color: '#f59e0b', borderRadius: 10, padding: '1px 5px', fontWeight: 700,
            }}>
              ACTIVE
            </span>
          )}
        </div>
        <div style={{ fontSize: 9, color: '#64748b', marginTop: 2, lineHeight: 1.5 }}>{desc}</div>
      </div>
    </button>
  );
}

// ─── Dev mode unlock bar ─────────────────────────────────────────────────────

function DevModeUnlockBar({ onEnable }: { onEnable: () => void }) {
  return (
    <div style={{
      borderTop: '1px solid rgba(100,116,139,0.15)',
      padding: '6px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: 'rgba(245,158,11,0.04)',
      flexShrink: 0,
    }}>
      <div style={{ fontSize: 10, color: '#475569' }}>
        Enable Developer Mode to submit variants, fork strains, and control SEG count
      </div>
      <button
        onClick={onEnable}
        style={{
          background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)',
          color: '#f59e0b', borderRadius: 6, padding: '3px 10px', fontSize: 10,
          fontWeight: 600, cursor: 'pointer',
        }}
      >
        Unlock <CaiSymbol size="0.85em" style={{ marginLeft: 3, marginRight: 3, verticalAlign: '-0.1em' }} /> Dev
      </button>
    </div>
  );
}
