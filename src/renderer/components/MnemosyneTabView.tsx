// MnemosyneCTabView -- SAGA 07 BP046B · updated BP067 Phase 2
// BP078 SEG-UX-1/2/5/6: dynamic tab overflow, titlebar pill, ThreeOptionAsk removed,
// Check-for-Update SKU integration.
// BP078 SEG-S-2: migration for pre-v0.1.35 users (lifecycle_stage default 'A').
// BP078 SEG-S-10: tab bar + settings gear gated at stages A/B/C.
// 16-tab MnemosyneC application shell:
//   Tab 1  · Frame          -- Transparent Outlining Window status + controls (daily driver)
//   Tab 2  · Helm           -- LB platform interface + Beacons side-shelves (membership gate)
//   Tab 3  · Gauntlet       -- 6-stage testing framework + checkmark selection (for-techies)
//   Tab 4  · Settings       -- update · appearance · AI model assignment · substrate default (gear icon)
//   Tab 5  · FAQ            -- tl;dr / full-steps toggle · 7 seed entries (always visible)
//   Tab 6  · Developer      -- conditional, gated by membership + Pledge #2260 OR business license
//   Tab 7  · Atlas          -- Calendar · Events · Multi-person scheduling · P2P sync
//   Tab 8  · Kitchen Table  -- Recipes · Meal planning · LAN peer discovery
//   Tab 9  · Pearls         -- Pearl Gallery · compressed Eblet references
//   Tab 10 · Substrate      -- BP060 Application 002 · caithedral-core tools · Areopagus
//   Tab 11 · Console        -- Unified Substrate Console · Bridge + Dashboard view
//   Tab 12 · AI             -- Multi-AI Selector · Quick-pick · Court presets
//   Tab 13 · Caithedral Core -- SSPL open-source substrate · Banyan Metric · MoneyPenny
//   Tab 14 · $ LB Account  -- Link your LB cooperative account · Join the Frontier mesh
//   Tab 15 · Battery        -- Cooperative time/energy dispatch · Reserve vs Spend
//   Tab 16 · Broadcast      -- Cooperative content/announcement scheduler

import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
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
import { SkuUpgradeModal } from './SkuUpgradeModal';

import { HelmCrownDashboard } from '../hearth/helm/HelmCrownDashboard';
import { AtlasView } from '../kitchen_table/AtlasView';
import { KitchenTableView } from '../kitchen_table/KitchenTableView';
import { PearlGalleryTab } from './PearlGalleryTab';
// BP060 Application 002 Step 1 -- Substrate UI surfaces
import { SubstrateTab } from './SubstrateTab';
// BP060 v3 UI-7 + UI-8
import { UnifiedSubstrateConsole } from './UnifiedSubstrateConsole';
import { MultiAISelector } from './MultiAISelector';
import { CaithedralCoreTab } from './CaithedralCoreTab';
// BP065 -- Tier-2 Part A (LB Account) + 3-strikes opt-in
import { LBAccountTab } from './LBAccountTab';
// SEG-V0145-1 — NotCents glyph on LB Account identity surfaces
import { NotCentsGlyph } from './NotCentsGlyph';
import { OptInPrompt } from './OptInPrompt';
import { shouldShowPrompt, recordStrike, setDecision } from '../lib/opt_in_strike_tracker';
// BP067 Phase 1A -- $5 join flow
import { FirstStepsView } from './FirstStepsView';
// BP067 v0.1.24 -- one-spine first-run (supersedes SaltFighterFirstRun + OnboardingWizard)
// SEG-R-1: WelcomeView is now first spine step; LS_ONBOARDING_COMPLETE is the WelcomeView gate.
import { Bp067FirstRunSpine, LS_BP067_FIRST_RUN_COMPLETE } from './Bp067FirstRunSpine';
import { WelcomeView, LS_ONBOARDING_COMPLETE } from './WelcomeView';
// SEG-V0149-P1: first-install gate
import { LeanWelcomeView } from './LeanWelcomeView';
// BP078 SEG-S-2/10: lifecycle stage hook
import { useLifecycleStage, LS_STAGE_KEY } from '../hooks/useLifecycleStage';
// BP067 Phase 2B/2C -- Battery Dispatch + Broadcast Schedule
import { BatteryDispatchTab } from './BatteryDispatchTab';
import { BroadcastScheduleTab } from './BroadcastScheduleTab';
// BP082 v0.3.0 -- Battery Dispatch Publish Fan-Out
import { BatteryPublishTab } from './BatteryPublishTab';
// SEG-2 v0.1.57 -- Test It Out substrate-warming workout
import { TestItOutTab } from './TestItOutTab';
// BP081 Wave A SEG-A1 -- Substrate Stats dashboard
import { SubstrateStatsTab } from './SubstrateStatsTab';
// BP081 K-1 SEG-K1-3 -- Membership tab
import { MembershipTab } from './MembershipTab';
// BP087 Wave 3 SEG-C3 -- Trial 02 Mesh Validation
import { TrialFirePanel } from './TrialFirePanel';
// BP087 Wave 3 SEG-F2 -- Companies Joining In
import { CompaniesJoiningInTab } from './CompaniesJoiningInTab';
// BP087 Wave 5 -- Alexandrian Catacombs 16-folder substrate default
import { CatacombsTab } from './CatacombsTab';
// BP092 I12 -- My IP Ledger: Ring Bearer + Stamp-Certify UI
import { MyIPLedgerTab } from './MyIPLedgerTab';

// ─── Local-storage keys ───────────────────────────────────────────────────────

const LS_GAUNTLET_FIRST_COMPLETE = 'mnemo_gauntlet_first_complete';
const LS_DEVELOPER_MODE = 'mnemo_developer_mode_enabled';
const LS_ACTIVE_TAB = 'mnemo_active_tab';
const LS_FOR_TECHIES = 'mnemo_for_techies_unlocked';
const LS_WIND_UNLOCKED = 'mnem_wind_unlocked';
const LS_WIND_TIER = 'mnem_wind_tier';

// ─── BP078 SEG-S-2: pre-v0.1.35 migration ────────────────────────────────────
// Runs once at module load time (before useLifecycleStage lazy init reads localStorage).
// Any user without a lifecycle_stage key is placed at stage A so WelcomeView is shown.
// Does NOT clear bp067 flags -- those remain valid for other purposes.
function migrateLegacyFlags(): void {
  const hasStage = localStorage.getItem(LS_STAGE_KEY);
  if (!hasStage) {
    localStorage.setItem(LS_STAGE_KEY, 'A');
  }
  // If stage is already set (B, C, D, E, F), respect it -- do not regress.
}
migrateLegacyFlags();

// ─── Tab priority order (SEG-UX-1) ───────────────────────────────────────────
// Frame must never be hidden. AI must be in top 3. FAQ must be in top 4.
// Kitchen Table and $ LB Account may degrade to More at narrow widths.

const PRIORITY_TAB_IDS: TabId[] = [
  'frame',
  'ai-selector',
  'faq',
  'kitchen-table',
  'lb-account',
];

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabId =
  | 'frame'
  | 'helm'
  | 'gauntlet'
  | 'settings'
  | 'faq'
  | 'developer'
  | 'atlas'
  | 'kitchen-table'
  | 'pearls'
  | 'substrate'
  | 'console'
  | 'ai-selector'
  | 'caithedral-core'
  | 'lb-account'
  | 'battery-dispatch'
  | 'broadcast-schedule'
  | 'test-it-out'
  | 'substrate-stats'
  | 'membership'
  | 'battery-publish'
  | 'trial-fire'
  | 'companies'
  | 'catacombs'
  | 'my-ip-ledger';

interface TabDef {
  id: TabId;
  label: string;
  icon: string;
  iconElement?: React.ReactNode;
  tooltip: string;
}

const TABS: TabDef[] = [
  { id: 'frame',     label: 'Frame',     icon: '🪟', tooltip: 'Tab 1 · Frame -- Transparent Outlining Window (your daily driver)' },
  { id: 'helm',      label: 'Helm',      icon: '🧭', tooltip: 'Tab 2 · Helm -- LB platform · Beacons · cooperative peer-mesh' },
  { id: 'gauntlet',  label: 'Gauntlet',  icon: '⚔️', tooltip: 'Tab 3 · Gauntlet -- 6-stage testing framework · stage selection · Pioneer Bonus' },
  { id: 'settings',  label: 'Settings',  icon: '⚙️', tooltip: 'Tab 4 · Settings -- update MnemosyneC · AI model assignment · appearance · preferences' },
  { id: 'faq',       label: 'FAQ',       icon: '❓',  tooltip: 'Tab 5 · FAQ -- common questions · tl;dr answers' },
  { id: 'developer', label: 'Developer', icon: '',   iconElement: <CaiSymbol size={13} color="#f59e0b" aria-label="CAI" />, tooltip: 'Tab 6 · Developer Mode -- Caithedral · Eblet · Pheromone · Banyan Metric · SEG controls' },
  { id: 'atlas',         label: 'Atlas',         icon: '📅', tooltip: 'Tab 7 · Atlas -- Calendar · Events · Multi-person scheduling · P2P sync' },
  { id: 'kitchen-table', label: 'Kitchen Table',  icon: '🍽️', tooltip: 'Tab 8 · The Kitchen Table -- Recipes · Meal planning · LAN peer discovery' },
  { id: 'pearls',        label: 'Pearls',          icon: '🪶', tooltip: 'Tab 9 · Pearl Gallery -- cooperative substrate Pearl registry · compressed Eblet references · 6.1x compression' },
  { id: 'substrate',    label: 'Substrate',       icon: '🕸', tooltip: 'Tab 10 · Substrate -- BP060 Application 002 · caithedral-core tools · Areopagus · Theorem viz · Markers · Second Door' },
  { id: 'console',      label: 'Console',         icon: '🖥', tooltip: 'Tab 11 · Unified Substrate Console -- Bridge view + Dashboard view · Ctrl+Tab to switch (UI-7)' },
  { id: 'ai-selector',  label: 'AI',              icon: '🤖', tooltip: 'Tab 12 · Multi-AI Selector -- Quick-pick · Court presets · Default Ollama doctrine (UI-8)' },
  { id: 'caithedral-core', label: 'Caithedral Core', icon: '🏛', tooltip: 'Tab 13 · Caithedral Core -- SSPL open-source substrate · Designed to Be Copied · Banyan Metric · MoneyPenny · Substrated Folders · CPU-only inference' },
  { id: 'lb-account',        label: 'LB Account',        icon: '',   iconElement: <NotCentsGlyph size="13px" />, tooltip: 'Tab 14 · ₵ LB Account -- Link your Liana Banyan cooperative account · Join the Frontier mesh · Crewman attribution' },
  { id: 'battery-dispatch',  label: 'Battery',           icon: '⚡', tooltip: 'Tab 15 · Battery Dispatch -- Cooperative time/energy dispatch · Reserve vs Spend' },
  { id: 'broadcast-schedule', label: 'Broadcast',        icon: '📡', tooltip: 'Tab 16 · Broadcast Schedule -- Cooperative content/announcement scheduler · Pending vs Sent' },
  { id: 'test-it-out',        label: 'Test It Out',      icon: '🧪', tooltip: 'Tab 17 · Test It Out -- 5-question substrate-warming diagnostic · run weekly · grows local accuracy' },
  { id: 'substrate-stats',   label: '📊 Substrate',     icon: '',   tooltip: 'Tab 18 · Substrate Stats -- eblet count · verified rate · growth trend · recent writes · source breakdown' },
  { id: 'membership',        label: '💎 Membership',    icon: '',   tooltip: 'Tab 19 · Membership -- $5/year · 83.3% creator-keep · Cost+20% · join or fork' },
  // BP082 v0.3.0 -- Battery Dispatch Publish Fan-Out
  { id: 'battery-publish',   label: '🔥 Publish',       icon: '',   tooltip: 'Tab 20 · Battery Publish -- One-click fan-out to Cephas · lianabanyan.com · Substack · Medium · HN · Gmail editorial · Crown Letters' },
  // BP087 Wave 3 SEG-C3 -- Trial 02 Mesh Validation
  { id: 'trial-fire',        label: 'Trial 02',         icon: '🧨', tooltip: 'Trial 02 · Mesh Validation -- 70Q paired Pass A + Pass B · thunderclap dispatch' },
  // BP087 Wave 3 SEG-F2 -- Companies Joining In
  { id: 'companies',         label: 'Companies',        icon: '🏢', tooltip: 'Companies -- cooperative businesses joining the Liana Banyan platform' },
  // BP087 Wave 5 -- Alexandrian Catacombs 16-folder substrate default
  { id: 'catacombs',         label: 'Catacombs',        icon: '📚', tooltip: 'Alexandrian Catacombs -- 16-folder cooperative knowledge library (MMLU-Pro + USER + LB)' },
  // BP092 I12 -- My IP Ledger: Ring Bearer identity + Stamp-Certified contributions
  { id: 'my-ip-ledger',      label: 'My IP Ledger',     icon: '🔏', tooltip: 'My IP Ledger -- Ring Bearer public key · Stamp-Certified contributions · verifiable proofs · M25b' },
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
  // SEG-S-2/10: lifecycle stage -- must be called before all other hooks
  const { stage, advanceTo } = useLifecycleStage();

  const isMember = authState?.status === 'member' || authState?.status === 'trial_active';
  const isFounder = (authState as any)?.member?.is_founder === true;
  const displayName = (authState as any)?.member?.display_name as string | undefined;

  // Developer mode unlock -- membership + Pledge #2260 OR business license
  const [devEnabled, setDevEnabled] = useState(() =>
    localStorage.getItem(LS_DEVELOPER_MODE) === 'true'
  );

  // BP067 Phase 1A -- $5 join flow modal
  const [showFirstSteps, setShowFirstSteps] = useState(false);

  // BP067 v0.1.24 -- one-spine first-run complete gate
  // SEG-R-1: also check LS_ONBOARDING_COMPLETE (WelcomeView two-doorway gate) --
  // if either key is set, skip the entire spine (user has seen the welcome screen).
  // v0.1.61 hotfix: LS_ONBOARDING_COMPLETE uses truthy check (not === 'true') because
  // pre-v0.1.51 installs wrote '1' rather than 'true'. Without this, users with old-format
  // data see Bp067FirstRunSpine cover the entire window (no tab strip visible).
  const [bp067Complete, setBp067Complete] = useState(() =>
    localStorage.getItem(LS_BP067_FIRST_RUN_COMPLETE) === 'true' ||
    !!localStorage.getItem(LS_ONBOARDING_COMPLETE)
  );

  const [forTechies, setForTechies] = useState(() =>
    localStorage.getItem(LS_FOR_TECHIES) === 'true'
  );

  // BP067 Phase 1C -- "Schedule this meal" cross-tab handoff
  const [scheduledMealTitle, setScheduledMealTitle] = useState<string | null>(null);

  // BP067 Phase 2D -- Organic N=3 folder prompt
  const [showFolderPrompt, setShowFolderPrompt] = useState(false);
  const [folderPromptMsg, setFolderPromptMsg] = useState('');

  const [windUnlocked, setWindUnlocked] = useState(() =>
    localStorage.getItem(LS_WIND_UNLOCKED) === 'true'
  );
  const [appVersion, setAppVersion] = useState('');
  const [updateState, setUpdateState] = useState<UpdateState | null>(null);

  // BP065 -- 3-strikes opt-in prompt state
  const [showOptIn, setShowOptIn] = useState(false);

  // SEG-UX-2: SKU tier state for pill visibility
  const [skuTier, setSkuTier] = useState<'nano' | 'core' | 'lite' | 'full' | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // SEG-UX-6: combined update + SKU modal
  const [updateStatusLine, setUpdateStatusLine] = useState<string | null>(null);

  // SEG-UX-3: settings scroll target (for pill "Open AI Tier in Settings")
  const [settingsScrollTo, setSettingsScrollTo] = useState<string | null>(null);

  // SEG-UX-1: tab overflow state
  const [visiblePriorityCount, setVisiblePriorityCount] = useState(PRIORITY_TAB_IDS.length);
  const [moreOpen, setMoreOpen] = useState(false);

  const windClickCount = useRef(0);
  const windClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // SEG-UX-1: refs for overflow calculation
  const tabBarRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const pillRef = useRef<HTMLButtonElement>(null);
  // Map from tabId to measured width (cached after first measurement)
  const cachedTabWidths = useRef<Map<TabId, number>>(new Map());
  // Refs to rendered priority tab buttons for measurement
  const priorityTabButtonRefs = useRef<Map<TabId, HTMLButtonElement | null>>(new Map());

  // BP067: default Tab 1 Frame (daily driver) -- Gauntlet hidden behind For Techies
  function resolveDefaultTab(): TabId {
    const saved = localStorage.getItem(LS_ACTIVE_TAB) as TabId | null;
    const validTabs: TabId[] = [
      'frame', 'helm', 'gauntlet', 'settings', 'faq', 'developer', 'atlas',
      'kitchen-table', 'pearls', 'substrate', 'console', 'ai-selector',
      'caithedral-core', 'lb-account', 'battery-dispatch', 'broadcast-schedule', 'test-it-out',
      'substrate-stats', 'membership', 'trial-fire', 'companies', 'catacombs',
    ];
    if (
      saved &&
      validTabs.includes(saved) &&
      (saved !== 'developer' || devEnabled) &&
      (saved !== 'gauntlet' || forTechies)
    ) return saved;
    return 'frame';
  }

  const [activeTab, setActiveTab] = useState<TabId>(resolveDefaultTab);

  // Persist active tab
  useEffect(() => {
    localStorage.setItem(LS_ACTIVE_TAB, activeTab);
  }, [activeTab]);

  useEffect(() => {
    window.amplify?.getAppVersion?.().then((v) => setAppVersion(v?.version ?? '')).catch(() => {});
  }, []);

  // SEG-UX-2: load SKU tier on mount
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await window.amplify?.sku?.currentTier?.() ?? { tier: 'nano' as const };
        if (!cancelled) setSkuTier(result.tier as 'nano' | 'core' | 'lite' | 'full');
      } catch {
        if (!cancelled) setSkuTier('nano');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // BP065 -- 3-strikes opt-in: check if we should show the prompt on first meaningful interaction
  useEffect(() => {
    const timer = setTimeout(() => {
      if (shouldShowPrompt()) {
        window.amplify?.getAMPLIFYSnapshot?.()
          .then((snap) => { if (snap.substrate_hits > 0 || snap.total_queries > 2) setShowOptIn(true); })
          .catch(() => {});
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!window.amplify) return;
    window.amplify.getUpdateState?.().then(setUpdateState).catch(() => {});
    const cleanup = window.amplify.onUpdateStateChanged?.((s) => setUpdateState(s));
    return cleanup ?? undefined;
  }, []);

  // BP067 Phase 3B -- mnemo://focus/<tab_id> deep-link
  useEffect(() => {
    if (!window.amplify?.onNavigateFocusTab) return;
    const cleanup = window.amplify.onNavigateFocusTab((tabId) => {
    const validTabs: TabId[] = [
      'frame', 'helm', 'gauntlet', 'settings', 'faq', 'developer',
      'atlas', 'kitchen-table', 'pearls', 'substrate', 'console', 'ai-selector',
      'caithedral-core', 'lb-account', 'battery-dispatch', 'broadcast-schedule', 'test-it-out',
      'substrate-stats', 'membership', 'trial-fire', 'companies', 'catacombs',
    ];
    if (validTabs.includes(tabId as TabId)) setActiveTab(tabId as TabId);
    });
    return cleanup;
  }, []);

  // BP067 Phase 2D -- Organic N=3 folder-prompt harness
  useEffect(() => {
    const shown = Number(localStorage.getItem('mnemo_folder_prompt_count') ?? 0);
    if (shown >= 3) return;

    const promptTimer = setTimeout(async () => {
      if (shown >= 1) return;
      try {
        const snap = await window.amplify?.getAMPLIFYSnapshot?.();
        if (snap && snap.substrate_hits > 0) {
          const cur = Number(localStorage.getItem('mnemo_folder_prompt_count') ?? 0);
          if (cur < 2) {
            localStorage.setItem('mnemo_folder_prompt_count', String(cur + 1));
            setFolderPromptMsg('Want to index more folders? More folders = better memory for your AI.');
            setShowFolderPrompt(true);
          }
        }
      } catch { /* substrate unavailable */ }
    }, 15_000);

    const installTs = Number(localStorage.getItem('mnemo_install_ts') ?? 0);
    if (!installTs) localStorage.setItem('mnemo_install_ts', String(Date.now()));
    const daysSinceInstall = (Date.now() - (installTs || Date.now())) / (1000 * 60 * 60 * 24);
    if (daysSinceInstall >= 7 && shown < 3) {
      const timer2 = setTimeout(async () => {
        try {
          const folders = await window.amplify?.watcher?.listFolders?.() as Array<unknown> | undefined;
          if (folders && folders.length <= 1) {
            const cur = Number(localStorage.getItem('mnemo_folder_prompt_count') ?? 0);
            if (cur < 3) {
              localStorage.setItem('mnemo_folder_prompt_count', String(cur + 1));
              setFolderPromptMsg(`You have ${folders.length} folder indexed. Add more for better memory recall.`);
              setShowFolderPrompt(true);
            }
          }
        } catch { /* watcher unavailable */ }
      }, 5_000);
      return () => { clearTimeout(promptTimer); clearTimeout(timer2); };
    }

    return () => clearTimeout(promptTimer);
  }, []);

  // SEG-UX-1: ResizeObserver for dynamic tab overflow
  useEffect(() => {
    const container = tabBarRef.current;
    if (!container) return;

    const calculate = () => {
      const containerWidth = container.getBoundingClientRect().width;
      // Reserved space: gear icon (44px) + More button (~80px) + pill (~120px) + gaps + padding
      const RESERVED = 260;
      const available = Math.max(0, containerWidth - RESERVED);

      // Update cached widths from currently rendered tab buttons
      priorityTabButtonRefs.current.forEach((el, id) => {
        if (el) {
          const w = el.getBoundingClientRect().width;
          if (w > 0) cachedTabWidths.current.set(id, w + 4); // +4 for gap
        }
      });

      // Calculate how many priority tabs fit
      let accumulated = 0;
      let count = 0;
      for (const tabId of PRIORITY_TAB_IDS) {
        const w = cachedTabWidths.current.get(tabId) ?? 90;
        if (accumulated + w <= available) {
          accumulated += w;
          count++;
        } else {
          break;
        }
      }

      // Frame must never be hidden (index 0), AI in top 3, FAQ in top 4
      count = Math.max(3, count);
      count = Math.min(count, PRIORITY_TAB_IDS.length);
      setVisiblePriorityCount(count);
    };

    const observer = new ResizeObserver(calculate);
    observer.observe(container);
    // Initial calculation after first paint
    const rafId = requestAnimationFrame(calculate);
    return () => { observer.disconnect(); cancelAnimationFrame(rafId); };
  }, []);

  // SEG-UX-1: close More dropdown on click outside
  useEffect(() => {
    if (!moreOpen) return;
    function handleClickOutside(e: MouseEvent) {
      const moreBtn = moreButtonRef.current;
      const menu = document.getElementById('tab-more-menu');
      if (!moreBtn?.contains(e.target as Node) && !menu?.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [moreOpen]);

  // SEG-UX-1: Ctrl+Tab cycles through ALL tabs including overflowed
  useEffect(() => {
    function handleCtrlTab(e: KeyboardEvent) {
      if (!e.ctrlKey || e.key !== 'Tab') return;
      e.preventDefault();
      const allIds = visibleTabsForCycle.map((t) => t.id);
      if (allIds.length === 0) return;
      const cur = allIds.indexOf(activeTab);
      const next = e.shiftKey
        ? (cur - 1 + allIds.length) % allIds.length
        : (cur + 1) % allIds.length;
      setActiveTab(allIds[next]);
    }
    document.addEventListener('keydown', handleCtrlTab);
    return () => document.removeEventListener('keydown', handleCtrlTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, devEnabled, forTechies]);

  // Called by GauntletTab when the first full Gauntlet run completes
  function handleGauntletFirstComplete() {
    if (!localStorage.getItem(LS_GAUNTLET_FIRST_COMPLETE)) {
      localStorage.setItem(LS_GAUNTLET_FIRST_COMPLETE, 'true');
    }
    if (shouldShowPrompt()) {
      setTimeout(() => setShowOptIn(true), 1500);
    }
  }

  // Developer mode unlock from DevModeTab or settings
  function handleDevModeToggle(enabled: boolean) {
    setDevEnabled(enabled);
    localStorage.setItem(LS_DEVELOPER_MODE, enabled ? 'true' : 'false');
    if (!enabled && activeTab === 'developer') setActiveTab('gauntlet');
  }

  // Step-by-step interlock -- forward-wires to FAQ tab
  function handleStepByStep(surfaceId: string) {
    localStorage.setItem('mnemosyne_faq_topic', surfaceId);
    setActiveTab('faq');
  }

  function showWindToast() {
    const existing = document.getElementById('wind-unlock-toast');
    if (existing) return;
    const toast = document.createElement('div');
    toast.id = 'wind-unlock-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.className = 'wind-unlock-toast';
    toast.textContent = 'Ambience unlocked -- Tab 1 · Frame';
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

  // SEG-UX-6: Check for Update with SKU surface integration
  const handleCheckForUpdates = useCallback(async () => {
    // Run the electron-updater check
    void window.amplify?.checkForUpdates?.();

    // If not FULL, surface a modal with BOTH the update status AND the SKU upgrade panel
    if (skuTier !== 'full') {
      // Determine update status line
      let statusLine = 'Checking for app update...';
      if (updateState?.status === 'not-available') {
        statusLine = `App version: v${appVersion} is current.`;
      } else if (updateState?.status === 'available' && updateState.version) {
        statusLine = `App update available: v${updateState.version}`;
      } else if (updateState?.status === 'downloaded' && updateState.version) {
        statusLine = `App update v${updateState.version} ready -- install from titlebar.`;
      } else if (appVersion) {
        statusLine = `App version: v${appVersion} -- checking for updates...`;
      }
      setUpdateStatusLine(statusLine);
      setShowUpgradeModal(true);
    }
  }, [skuTier, updateState, appVersion]);

  // SEG-UX-1: visible tabs (excludes 'settings' -- it becomes the gear icon)
  const visibleTabs = useMemo(
    () =>
      TABS.filter((t) => {
        if (t.id === 'settings') return false; // settings is now gear icon
        if (t.id === 'developer') return devEnabled;
        if (t.id === 'gauntlet') return forTechies;
        return true;
      }),
    [devEnabled, forTechies]
  );

  // Used by Ctrl+Tab cycling -- includes all visible tabs for cycling
  const visibleTabsForCycle = useMemo(
    () => [...visibleTabs, TABS.find((t) => t.id === 'settings')!].filter(Boolean),
    [visibleTabs]
  );

  // SEG-UX-1: calculate overflow tab ids
  const { barTabIds, moreTabIds } = useMemo(() => {
    // Priority tabs that are in visibleTabs, in priority order
    const priorityVisible = PRIORITY_TAB_IDS.filter((id) =>
      visibleTabs.some((t) => t.id === id)
    );
    // First N priority tabs go in the bar
    const barIds = priorityVisible.slice(0, visiblePriorityCount);
    // Remaining priority tabs overflow to More
    const overflowPriority = priorityVisible.slice(visiblePriorityCount);
    // Non-priority tabs (excluding settings) always go to More
    const nonPriority = visibleTabs
      .filter((t) => !PRIORITY_TAB_IDS.includes(t.id))
      .map((t) => t.id);

    return {
      barTabIds: barIds,
      moreTabIds: [...overflowPriority, ...nonPriority],
    };
  }, [visibleTabs, visiblePriorityCount]);

  const showBridgeBanner = bp067Complete && (isMember || isFounder);
  const showModeChip = bp067Complete && (isMember || isFounder);

  // Navigate to settings and optionally scroll to a section -- declared before early return (Rules of Hooks)
  const navigateToSettings = useCallback((scrollTarget?: string) => {
    if (scrollTarget) setSettingsScrollTo(scrollTarget);
    setActiveTab('settings');
  }, []);

  // ─── SEG-V0149-P1: first-install LeanWelcome gate ────────────────────────────
  // null = IPC check in-flight; true = show LeanWelcomeView; false = show WelcomeView
  const [showLean, setShowLean] = useState<boolean | null>(null);

  useEffect(() => {
    if (!['A', 'B', 'C'].includes(stage)) return; // only relevant for pre-recruited stages
    if (localStorage.getItem(LS_ONBOARDING_COMPLETE) === 'true') {
      setShowLean(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const result = await window.amplify?.sku?.onboardingCheck?.() ?? { skuExists: true };
        if (!cancelled) setShowLean(!result.skuExists);
      } catch {
        if (!cancelled) setShowLean(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // ─── SEG-S-10: stages A/B/C -- no tab bar, no settings gear ─────────────────
  // WelcomeView is the only surface rendered. Stage C surface is deferred to v0.1.36.
  const isPreRecruited = ['A', 'B', 'C'].includes(stage);
  if (isPreRecruited) {
    // Loading: wait for IPC check before committing to either view
    if (showLean === null) {
      return (
        <div style={{
          background: '#0a0f1a', height: '100vh',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} />
      );
    }
    // First install: sku_tier.json absent AND onboarding not complete
    if (showLean) {
      return (
        <LeanWelcomeView
          onComplete={() => {
            localStorage.setItem(LS_ONBOARDING_COMPLETE, 'true');
            setShowLean(false);
          }}
        />
      );
    }
    // Returning user or sku_tier.json present: existing WelcomeView (unchanged)
    return (
      <WelcomeView
        onComplete={() => {
          localStorage.setItem(LS_ONBOARDING_COMPLETE, 'true');
          advanceTo('D'); // TODO v0.1.36: replace with Stage C trigger; direct D advance is bridge for v0.1.35
          setBp067Complete(true);
        }}
      />
    );
  }

  // ─── More dropdown keyboard handling ─────────────────────────────────────

  function handleMoreButtonKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMoreOpen(true);
      setTimeout(() => {
        const first = document.querySelector<HTMLElement>('#tab-more-menu [role="menuitem"]');
        first?.focus();
      }, 0);
    } else if (e.key === 'Escape') {
      setMoreOpen(false);
    }
  }

  function handleMoreItemKeyDown(e: React.KeyboardEvent, idx: number) {
    const total = moreTabIds.length;
    if (e.key === 'Escape') {
      e.preventDefault();
      setMoreOpen(false);
      moreButtonRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const items = document.querySelectorAll<HTMLElement>('#tab-more-menu [role="menuitem"]');
      items[(idx + 1) % total]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const items = document.querySelectorAll<HTMLElement>('#tab-more-menu [role="menuitem"]');
      items[(idx - 1 + total) % total]?.focus();
    }
  }

  // ─── Styles ────────────────────────────────────────────────────────────────

  const modeLabel: Record<FrameMode, string> = {
    ai_burst: 'AI Burst',
    normal: 'Normal',
    fallback: 'Fallback',
  };

  const handleScheduleMeal = (recipeName: string) => {
    setScheduledMealTitle(recipeName);
    setActiveTab('atlas');
  };

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
      alignItems: 'flex-end',
      borderBottom: '1px solid rgba(100,116,139,0.2)',
      padding: '8px 12px 0',
      gap: 2,
      flexShrink: 0,
      position: 'relative' as const,
      overflow: 'visible',
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
      whiteSpace: 'nowrap' as const,
      flexShrink: 0,
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

  // SEG-UX-2: pill visibility -- hidden for FULL users, removed from DOM entirely
  const showPill = skuTier !== null && skuTier !== 'full';

  return (
    <>
      {/* BP067 v0.1.24 -- one-spine first-run shown before main app on first launch */}
      {!bp067Complete && (
        <Bp067FirstRunSpine
          onComplete={() => {
            setBp067Complete(true);
            setActiveTab('frame');
          }}
          onAskOnboard={() => {
            // SEG-UX-5: ThreeOptionAsk removed. onAskOnboard now just completes first-run.
            setBp067Complete(true);
            setActiveTab('frame');
          }}
        />
      )}

      {/* BP067 Phase 1A -- $5 join flow modal */}
      {showFirstSteps && (
        <FirstStepsView
          onSelectIntent={() => {}}
          onCheckout={() => {}}
          onRoutePath={() => { setShowFirstSteps(false); setActiveTab('lb-account'); }}
        />
      )}

      {/* SEG-UX-2: Upgrade modal (titlebar pill + SEG-UX-6 check-for-update) */}
      {showUpgradeModal && (
        <SkuUpgradeModal
          onClose={() => {
            setShowUpgradeModal(false);
            setUpdateStatusLine(null);
            pillRef.current?.focus();
          }}
          onOpenSettings={() => navigateToSettings('ai-tier')}
          onUpgradeComplete={() => setSkuTier('full')}
          updateStatusLine={updateStatusLine}
        />
      )}

      <OnboardingGate>
        <div style={styles.shell}>
          {/* Title bar */}
          <div style={styles.titleBar}>
            <div style={styles.brand}>
              {/* SEG-U-5: elephant icon left of wordmark, 36px */}
              <img
                src="icons/mnemosynec-mark.png"
                alt="MnemosyneC"
                style={{ height: 36, width: 'auto', objectFit: 'contain', verticalAlign: 'middle', marginRight: 8 }}
                onError={(e: React.SyntheticEvent<HTMLImageElement>): void => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div>
                <div
                  style={styles.brandName}
                  onClick={handleBrandTripleClick}
                  title={windUnlocked ? 'MnemosyneC -- Ambience active' : 'MnemosyneC'}
                  aria-label="MnemosyneC"
                >
                  MnemosyneC
                </div>
                <div style={{ ...styles.brandSub, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CaiSymbol size={12} color="#6ee7b7" aria-label="CAI" />
                  <span>
                    {appVersion ? `v${appVersion} · ` : ''}Caithedral · Liana Banyan
                  </span>
                  {updateState && updateState.status === 'downloaded' && (
                    <button
                      onClick={() => window.amplify?.installUpdate?.()}
                      title={`v${updateState.version} ready -- click to install & restart`}
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
                      v{updateState.version} · install
                    </button>
                  )}
                  {updateState && updateState.status === 'available' && (
                    <button
                      type="button"
                      onClick={() => window.amplify?.downloadUpdate?.()}
                      title={`Install v${updateState.version} now`}
                      style={{
                        background: 'rgba(245,158,11,0.15)',
                        border: '1px solid rgba(245,158,11,0.4)',
                        borderRadius: 10,
                        color: '#fbbf24',
                        fontSize: 9,
                        fontWeight: 700,
                        padding: '1px 8px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                      aria-label={`Install v${updateState.version} now`}
                    >
                      v{updateState.version} · Install Now
                    </button>
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

            {/* Right-side titlebar controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* SEG-UX-2: "Get FULL AI Free" pill -- removed from DOM for FULL users */}
              {showPill && (
                <button
                  ref={pillRef}
                  type="button"
                  onClick={() => { setUpdateStatusLine(null); setShowUpgradeModal(true); }}
                  aria-label="Open FREE FULL AI upgrade options"
                  title="Upgrade to FULL -- Google's Gemma 4 12B, free download."
                  style={{
                    padding: '5px 12px',
                    background: 'rgba(110,231,183,0.13)',
                    border: '1px solid rgba(110,231,183,0.45)',
                    borderRadius: 20,
                    color: '#6ee7b7',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.02em',
                  }}
                >
                  Get FULL AI Free
                </button>
              )}

              {/* SEG-UX-6: Check for Updates -- also surfaces SKU upgrade for non-FULL users */}
              <button
                type="button"
                onClick={handleCheckForUpdates}
                title="Check for updates to MnemosyneC"
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

              {/* BP067: mode chip hidden until authenticated/member state */}
              {showModeChip && (
                <button
                  type="button"
                  onClick={() => {
                    const nextMode = currentMode === 'ai_burst' ? 'normal' : 'ai_burst';
                    onModeChange(nextMode);
                    window.amplify?.setFrameMode?.(nextMode);
                  }}
                  title={
                    currentMode === 'ai_burst'
                      ? 'AI Burst active -- click to switch to Normal mode'
                      : 'Click to enable AI Burst mode (Cloud AI + Substrate)'
                  }
                  aria-label={`Current mode: ${modeLabel[currentMode]}. Click to toggle AI Burst.`}
                  style={{
                    ...styles.modeChip,
                    cursor: 'pointer',
                    border:
                      currentMode === 'ai_burst'
                        ? '1px solid rgba(250,204,21,0.4)'
                        : '1px solid rgba(100,116,139,0.2)',
                    color: currentMode === 'ai_burst' ? '#facc15' : '#64748b',
                    background:
                      currentMode === 'ai_burst'
                        ? 'rgba(250,204,21,0.08)'
                        : 'rgba(100,116,139,0.1)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {currentMode === 'ai_burst' ? 'AI Burst' : currentMode === 'normal' ? 'Normal' : 'Fallback'}
                </button>
              )}

              <button
                style={styles.closeBtn}
                onClick={onClose}
                title="Close"
                aria-label="Close MnemosyneC"
              >
                x
              </button>
            </div>
          </div>

          {/* SEG-R-12: Shirley Temple Policy toggles removed from UI; both default ON in localStorage */}

          {/* BP067 Phase 2D -- Organic N=3 folder prompt */}
          {showFolderPrompt && (
            <div
              style={{
                margin: '4px 16px 0',
                background: 'rgba(59,130,246,0.08)',
                border: '1px solid rgba(59,130,246,0.25)',
                borderRadius: 8,
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 11, color: '#60a5fa', flex: 1 }}>📂 {folderPromptMsg}</span>
              <button
                style={{
                  padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                  cursor: 'pointer', border: '1px solid rgba(59,130,246,0.4)',
                  background: 'rgba(59,130,246,0.12)', color: '#60a5fa', whiteSpace: 'nowrap',
                }}
                onClick={() => { setShowFolderPrompt(false); setActiveTab('settings'); }}
              >
                Manage Folders
              </button>
              <button
                style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 14, flexShrink: 0 }}
                onClick={() => setShowFolderPrompt(false)}
              >
                x
              </button>
            </div>
          )}

          {/* BP067: Bridge banner hidden until member/authenticated */}
          {showBridgeBanner && (
            <div style={{ padding: '8px 16px 0' }}>
              <button
                type="button"
                onClick={() => setActiveTab('lb-account')}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'rgba(250,204,21,0.06)',
                  border: '1px solid rgba(250,204,21,0.2)',
                  borderRadius: 8,
                  color: '#fbbf24',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                title="Open the LB Account tab -- link your Liana Banyan account · join the Frontier"
              >
                Open the Bridge -- Link LB Account
              </button>
            </div>
          )}

          {/* BP067: Advanced disclosure -- reveals Gauntlet tab (SEG-R-6) */}
          {bp067Complete && !forTechies && (
            <div style={{ padding: '4px 16px 0', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem(LS_FOR_TECHIES, 'true');
                  setForTechies(true);
                  setActiveTab('gauntlet');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#475569',
                  fontSize: 10,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                ⚔️ Gauntlet
              </button>
            </div>
          )}

          {/* SEG-UX-1: Tab bar with ResizeObserver-based overflow */}
          <div
            ref={tabBarRef}
            style={styles.tabBar}
            role="tablist"
            aria-label="MnemosyneC navigation"
          >
            {/* Priority tabs visible in the bar */}
            {barTabIds.map((tabId) => {
              const tab = TABS.find((t) => t.id === tabId);
              if (!tab) return null;
              return (
                <button
                  key={tab.id}
                  ref={(el) => { priorityTabButtonRefs.current.set(tab.id, el); }}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`panel-${tab.id}`}
                  id={`tab-${tab.id}`}
                  style={styles.tab(activeTab === tab.id)}
                  onClick={() => setActiveTab(tab.id)}
                  title={tab.tooltip}
                >
                  <span style={styles.tabIcon} aria-hidden>
                    {tab.iconElement ?? tab.icon}
                  </span>
                  {tab.label}
                </button>
              );
            })}

            {/* "More" dropdown -- only shown when there are overflow tabs */}
            {moreTabIds.length > 0 && (
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <button
                  ref={moreButtonRef}
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={moreOpen}
                  aria-controls="tab-more-menu"
                  onClick={() => setMoreOpen((o) => !o)}
                  onKeyDown={handleMoreButtonKeyDown}
                  style={{
                    ...styles.tab(moreTabIds.includes(activeTab)),
                    borderRadius: '6px 6px 0 0',
                  }}
                >
                  More {moreOpen ? '▴' : '▾'}
                </button>
                {moreOpen && (
                  <div
                    id="tab-more-menu"
                    role="menu"
                    aria-label="More tabs"
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 1px)',
                      left: 0,
                      background: '#111827',
                      border: '1px solid rgba(100,116,139,0.25)',
                      borderRadius: '0 8px 8px 8px',
                      zIndex: 1000,
                      minWidth: 180,
                      padding: '4px 0',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    }}
                  >
                    {moreTabIds.map((tabId, idx) => {
                      const tab = TABS.find((t) => t.id === tabId);
                      if (!tab) return null;
                      return (
                        <button
                          key={tab.id}
                          role="menuitem"
                          onClick={() => { setActiveTab(tab.id); setMoreOpen(false); }}
                          onKeyDown={(e) => handleMoreItemKeyDown(e, idx)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            width: '100%',
                            textAlign: 'left',
                            background: 'none',
                            border: 'none',
                            color: activeTab === tab.id ? '#6ee7b7' : '#94a3b8',
                            fontSize: 12,
                            padding: '8px 16px',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(110,231,183,0.06)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                        >
                          <span aria-hidden style={{ fontSize: 13 }}>
                            {tab.iconElement ?? tab.icon}
                          </span>
                          {tab.label}
                          {tab.id === 'developer' && (
                            <span style={{ fontSize: 9, color: '#f59e0b', marginLeft: 2 }}>DEV</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Spacer pushes gear icon to far right */}
            <div style={{ flex: 1 }} />

            {/* Gear icon -- Settings (fixed at far right, never in More) */}
            {/* Settings gear hidden at stages A/B/C per BP078 Staged Launch Plan. Reappears at stage D (v0.1.37). */}
            <button
              role="tab"
              id="tab-settings"
              aria-controls="panel-settings"
              aria-selected={activeTab === 'settings'}
              aria-label="Settings"
              title="Settings -- update, appearance, AI tier, preferences"
              onClick={() => setActiveTab('settings')}
              style={{
                ...styles.tab(activeTab === 'settings'),
                padding: '6px 10px',
                fontSize: 16,
                borderRadius: '6px 6px 0 0',
              }}
            >
              ⚙
            </button>
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
                  <HelmGate onJoin={() => setShowFirstSteps(true)} />
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
                  scrollTo={settingsScrollTo}
                  onScrollConsumed={() => setSettingsScrollTo(null)}
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
                <AtlasView
                  prefilledTitle={scheduledMealTitle}
                  onPrefilledConsumed={() => setScheduledMealTitle(null)}
                />
              </div>
            )}

            {activeTab === 'kitchen-table' && (
              <div
                id="panel-kitchen-table"
                role="tabpanel"
                aria-labelledby="tab-kitchen-table"
                style={{ height: '100%' }}
              >
                <KitchenTableView onScheduleMeal={handleScheduleMeal} />
              </div>
            )}

            {activeTab === 'pearls' && (
              <div
                id="panel-pearls"
                role="tabpanel"
                aria-labelledby="tab-pearls"
                style={{ height: '100%' }}
              >
                <PearlGalleryTab />
              </div>
            )}

            {activeTab === 'substrate' && (
              <div
                id="panel-substrate"
                role="tabpanel"
                aria-labelledby="tab-substrate"
                style={{ height: '100%' }}
              >
                <SubstrateTab />
              </div>
            )}

            {activeTab === 'console' && (
              <div
                id="panel-console"
                role="tabpanel"
                aria-labelledby="tab-console"
                style={{ height: '100%' }}
              >
                <UnifiedSubstrateConsole />
              </div>
            )}

            {activeTab === 'ai-selector' && (
              <div
                id="panel-ai-selector"
                role="tabpanel"
                aria-labelledby="tab-ai-selector"
                style={{ height: '100%' }}
              >
                <MultiAISelector />
              </div>
            )}

            {activeTab === 'caithedral-core' && (
              <div
                id="panel-caithedral-core"
                role="tabpanel"
                aria-labelledby="tab-caithedral-core"
                style={{ height: '100%' }}
              >
                <CaithedralCoreTab />
              </div>
            )}

            {activeTab === 'lb-account' && (
              <div
                id="panel-lb-account"
                role="tabpanel"
                aria-labelledby="tab-lb-account"
                style={{ height: '100%', overflowY: 'auto' }}
              >
                <LBAccountTab />
              </div>
            )}

            {activeTab === 'battery-dispatch' && (
              <div
                id="panel-battery-dispatch"
                role="tabpanel"
                aria-labelledby="tab-battery-dispatch"
                style={{ height: '100%', overflowY: 'auto' }}
              >
                <BatteryDispatchTab />
              </div>
            )}

            {/* BP082 v0.3.0 -- Battery Dispatch Publish Fan-Out (Tab 17) */}
            {activeTab === 'battery-publish' && (
              <div
                id="panel-battery-publish"
                role="tabpanel"
                aria-labelledby="tab-battery-publish"
                style={{ height: '100%', overflow: 'hidden' }}
              >
                <BatteryPublishTab />
              </div>
            )}

            {activeTab === 'broadcast-schedule' && (
              <div
                id="panel-broadcast-schedule"
                role="tabpanel"
                aria-labelledby="tab-broadcast-schedule"
                style={{ height: '100%', overflowY: 'auto' }}
              >
                <BroadcastScheduleTab />
              </div>
            )}

            {activeTab === 'test-it-out' && (
              <div
                id="panel-test-it-out"
                role="tabpanel"
                aria-labelledby="tab-test-it-out"
                style={{ height: '100%' }}
              >
                <TestItOutTab />
              </div>
            )}

            {activeTab === 'substrate-stats' && (
              <div
                id="panel-substrate-stats"
                role="tabpanel"
                aria-labelledby="tab-substrate-stats"
                style={{ height: '100%' }}
              >
                <SubstrateStatsTab />
              </div>
            )}

            {activeTab === 'membership' && (
              <div
                id="panel-membership"
                role="tabpanel"
                aria-labelledby="tab-membership"
                style={{ height: '100%', overflowY: 'auto' }}
              >
                <MembershipTab />
              </div>
            )}

            {/* BP087 Wave 3 SEG-C3 -- Trial 02 Mesh Validation */}
            {activeTab === 'trial-fire' && (
              <div
                id="panel-trial-fire"
                role="tabpanel"
                aria-labelledby="tab-trial-fire"
                style={{ height: '100%', overflowY: 'auto' }}
              >
                <TrialFirePanel />
              </div>
            )}

            {/* BP087 Wave 3 SEG-F2 -- Companies Joining In */}
            {activeTab === 'companies' && (
              <div
                id="panel-companies"
                role="tabpanel"
                aria-labelledby="tab-companies"
                style={{ height: '100%', overflowY: 'auto' }}
              >
                <CompaniesJoiningInTab />
              </div>
            )}

            {/* BP087 Wave 5 -- Alexandrian Catacombs 16-folder substrate default */}
            {activeTab === 'catacombs' && (
              <div
                id="panel-catacombs"
                role="tabpanel"
                aria-labelledby="tab-catacombs"
                style={{ height: '100%' }}
              >
                <CatacombsTab />
              </div>
            )}
            {activeTab === 'my-ip-ledger' && (
              <div
                id="panel-my-ip-ledger"
                role="tabpanel"
                aria-labelledby="tab-my-ip-ledger"
                style={{ height: '100%', overflowY: 'auto' }}
              >
                <MyIPLedgerTab />
              </div>
            )}
          </div>

          {/* BP065 -- 3-strikes contextual opt-in prompt */}
          {showOptIn && (
            <OptInPrompt
              onClose={() => setShowOptIn(false)}
              onYes={async (email: string) => {
                recordStrike();
                setShowOptIn(false);
                if (window.amplify?.lbStartAuth) {
                  await window.amplify
                    .lbStartAuth(email)
                    .then((result: { ok: boolean; error?: string }) => {
                      if (result.ok) setActiveTab('lb-account');
                    })
                    .catch(() => {});
                }
              }}
              onNavigateToTab={() => setActiveTab('lb-account')}
            />
          )}

          {/* Developer mode unlock bar -- shown at bottom only if not yet enabled */}
          {!devEnabled && (isMember || isFounder) && (
            <DevModeUnlockBar onEnable={() => handleDevModeToggle(true)} />
          )}
        </div>
      </OnboardingGate>
    </>
  );
}

// ─── Helm Gate (non-member) ──────────────────────────────────────────────────

function HelmGate({ onJoin }: { onJoin: () => void }) {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', gap: 16, padding: 32, textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 32 }}>🧭</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0' }}>Helm is for members</div>
      <div style={{ fontSize: 12, color: '#64748b', maxWidth: 280, lineHeight: 1.6 }}>
        Join the cooperative for $5/year to access Helm -- the LB platform bridge,
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
        Join -- $5/year
      </button>
      <div style={{ fontSize: 10, color: '#334155' }}>Free to use. Better to join.</div>
    </div>
  );
}

// ─── Dev mode unlock bar ─────────────────────────────────────────────────────

function DevModeUnlockBar({ onEnable }: { onEnable: () => void }) {
  return (
    <div
      style={{
        borderTop: '1px solid rgba(100,116,139,0.15)',
        padding: '6px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(245,158,11,0.04)',
        flexShrink: 0,
      }}
    >
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
        Unlock Dev
      </button>
    </div>
  );
}
