// CleanShell.tsx — BP132 Yoke #22 clean 7-tab shell
// Forked from LeanShell.tsx (v0.5.1 BP082+BP085) per the Yoke's explicit instruction:
// "FORK FROM LEAN, DO NOT REWRITE." Carries over uiMode/membership/bg-setup chrome
// unchanged where possible; replaces the 8-tab TABS array + render switch with the
// 7 target tabs (Ask, Package Store, Help/FAQ, Kitchen Table, Atlas Schedule,
// Social, Helm/Portfolio). Does NOT touch LeanShell.tsx itself — this is an
// additive, reachable-for-testing alternative shell (see App.tsx wiring), so the
// production Lean/Advanced default is never at risk from this in-progress fork.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LeanAskTab } from './LeanAskTab';
import { LeanHelpTab } from './LeanHelpTab';
// unrouted BP135 -- see YOKE_35 Phase 3 (GauntletTab's fake stage-sim cut from Help's sub-tabs;
// its two real side-effects ported into OneClickMeshTestPanel.tsx. Kept per Rule 66.)
// import { GauntletTab } from './GauntletTab';
import { DiagnosticModeTab } from './DiagnosticModeTab';
import { MeshTestTerminalTab } from './MeshTestTerminalTab';
import { CatacombsTab } from './CatacombsTab';
import { CatacombsContributePanel } from './CatacombsContributePanel';
import { LeanFederationPanel } from './LeanGauntletTab';
import { OneClickMeshTestPanel } from './OneClickMeshTestPanel';
// BP136 Yoke: Prove It panel (answer-cache mode toggle + real meter) -- previously authored
// (K23) but never mounted anywhere in the shipped shell. Mounted here, toggle-collapsible,
// alongside OneClickMeshTestPanel (kept as-is, now under an explicit "Diagnostics" label).
import { ProveItWorksTab } from './standard/ProveItWorksTab';
import { KitchenTableView } from '../kitchen_table/KitchenTableView';
import { AtlasView } from '../kitchen_table/AtlasView';
import { SocialTab } from './SocialTab';
// unrouted BP135 -- see YOKE_35 Phase 4 (Helm tab CUT from the shipped shell -- a repo-wide
// grep for helmGetComms/helmGetRatifications/helmGetVetoHistory finds zero main-process
// handlers anywhere in src/, so Roll/Ratify/Veto are unwired, not just the honestly-labeled
// Comms placeholder. "Nothing that isn't real." The real composable Helm/Bridge is a
// separate future Yoke. HelmCrownDashboard.tsx is untouched and still live at the
// role-gated #/helm route in App.tsx -- only CleanShell's tab is cut. Kept per Rule 66.)
// import { HelmCrownDashboard } from '../hearth/helm/HelmCrownDashboard';
import { TheDiagnosisTab } from './TheDiagnosisTab';
import { BatteryPublishTab } from './BatteryPublishTab';
import { FrameTab } from './FrameTab';
import { LBAccountTab } from './LBAccountTab';
import { SettingsTab } from './SettingsTab';
import { MembershipTab } from './MembershipTab';
import { SubstrateTab } from './SubstrateTab';
import { SubstrateStatsTab } from './SubstrateStatsTab';
import { UnifiedSubstrateConsole } from './UnifiedSubstrateConsole';
import type { FrameMode } from './FrameModeIndicator';
import type { AuthState } from '../amplify.d';

// ─── openMembershipCheckout (identical to LeanShell.tsx — Golden Key membership gate reuse) ──

async function openMembershipCheckout(onError?: (msg: string) => void): Promise<void> {
  try {
    const result = await window.amplify?.openMembershipCheckout?.();
    if (!result) {
      window.open('https://lianabanyan.com/join?source=mnemosynec-app', '_blank', 'noopener');
      return;
    }
    if (!result.ok) onError?.(`Couldn't open membership page: ${result.error ?? 'unknown error'}`);
  } catch {
    onError?.('Membership page could not open. Please visit lianabanyan.com/join');
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

// BP135 YOKE_35 Phase 4: 'helm' removed (see HelmCrownDashboard import note above); 'substrate'
// (new, combined), 'diagnosis', 'publish', 'frame', 'lb-account', 'settings', 'membership'
// added -- the six item-4 surfaces confirmed real in Phase 3, plus the folded Substrate tab.
type CleanTab =
  | 'ask' | 'package-store' | 'substrate' | 'help' | 'kitchen-table' | 'atlas' | 'social'
  | 'diagnosis' | 'publish' | 'frame' | 'lb-account' | 'settings' | 'membership';
const LS_LEAN_SETUP_DONE = 'lean_bg_setup_complete';

export interface CleanShellProps {
  currentMode: FrameMode;
  onModeChange: (mode: FrameMode) => void;
  onClose: () => void;
  authState: AuthState | null;
  onExitToLean?: () => void;
}

const TABS: Array<{ id: CleanTab; label: string }> = [
  { id: 'ask',           label: 'Ask' },
  { id: 'package-store', label: '📦 Package Store' },
  { id: 'substrate',     label: '🧬 Substrate' },
  { id: 'help',          label: '❓ Help' },
  { id: 'kitchen-table', label: '🍽️ Kitchen Table' },
  { id: 'atlas',         label: '🗓️ Atlas' },
  { id: 'social',        label: '🌐 Social' },
  { id: 'diagnosis',     label: '🧂 Diagnosis' },
  { id: 'publish',       label: '📡 Publish' },
  { id: 'frame',         label: '🖼️ Frame' },
  { id: 'lb-account',    label: '🔑 LB Account' },
  { id: 'settings',      label: '⚙️ Settings' },
  { id: 'membership',    label: '💎 Membership' },
];

// ─── Package Store tab (Catacombs + peer-scan + Contribute + One-Click test) ──
// Yoke #22 task: "reuse CatacombsTab.tsx + CategoryBrowser.tsx (already composed
// inside CatacombsTab) + CatacombsContributePanel.tsx. ADD a Scan for Peers button
// showing each peer's self-identified name — graft from PeerCueCard into
// LeanGauntletTab's LeanFederationPanel." All three are mounted as-is below;
// nothing here was rebuilt from scratch.

function PackageStoreTab({ authState, onSwitchTab }: { authState: AuthState | null; onSwitchTab: (tab: CleanTab) => void }) {
  const [showContribute, setShowContribute] = useState(false);
  const [showPeerScan, setShowPeerScan] = useState(false);
  // BP136 Yoke: Prove It panel toggle (answer-cache mode + real meter)
  const [showProveIt, setShowProveIt] = useState(false);

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '16px 20px' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' as const }}>
        <button onClick={() => setShowPeerScan((v) => !v)} style={pillBtn(showPeerScan)}>
          ⬡ {showPeerScan ? 'Hide' : 'Scan for Peers'}
        </button>
        <button onClick={() => setShowContribute((v) => !v)} style={pillBtn(showContribute)}>
          ✎ {showContribute ? 'Hide' : 'Contribute a Package'}
        </button>
        <button onClick={() => setShowProveIt((v) => !v)} style={pillBtn(showProveIt)}>
          🎯 {showProveIt ? 'Hide' : 'Prove It Works'}
        </button>
      </div>

      {showPeerScan && (
        <div style={{ marginBottom: 16 }}>
          <LeanFederationPanel />
        </div>
      )}

      {showContribute && (
        <div style={{ marginBottom: 16 }}>
          <CatacombsContributePanel onSuccess={() => setShowContribute(false)} onClose={() => setShowContribute(false)} />
        </div>
      )}

      {showProveIt && (
        <div style={{ marginBottom: 16, border: '1px solid #1e2a38', borderRadius: 8 }}>
          <ProveItWorksTab onSwitchTab={(tab) => onSwitchTab(tab as CleanTab)} />
        </div>
      )}

      <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
        Diagnostics
      </div>
      <div style={{ marginBottom: 20 }}>
        <OneClickMeshTestPanel
          authState={authState}
          onShareResult={() => { window.dispatchEvent(new CustomEvent('mnemo-jump-to-social')); }}
        />
      </div>

      <CatacombsTab />
    </div>
  );
}

function pillBtn(active: boolean): React.CSSProperties {
  return {
    background: active ? '#1e3a5c' : 'none',
    color: active ? '#e2e8f0' : '#6ee7b7',
    border: '1px solid #1e4038',
    borderRadius: 6,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif',
  };
}

// ─── Help/FAQ tab (LeanHelpTab + Diagnostic poller + Terminal) ────────────────
// Yoke #22 landmine note: 'help' here must stay FAQ+membership (LeanHelpTab), NOT
// the Founder-Son pipeline (that was HelpTab.tsx on Lean's separate 'pipeline' tab,
// which is intentionally dropped from this 7-tab shell — bloat per the Yoke's drop list).
// BP135 YOKE_35 Phase 3: the 'gauntlet' sub-tab is CUT here -- GauntletTab.tsx's core
// loop was a fake stage-sim (`await new Promise(...setTimeout...)`, "Simulate stage
// execution"), fully superseded by the Package Store tab's real OneClickMeshTestPanel.
// Its two real side-effects (marks credit, Pioneer registry) are ported into
// OneClickMeshTestPanel's completion path -- see OneClickMeshTestPanel.tsx. GauntletTab.tsx
// itself is left in the tree, unrouted, per Rule 66.

function HelpFaqTab() {
  const [sub, setSub] = useState<'faq' | 'diagnostic' | 'terminal'>('faq');
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 4, padding: '10px 16px 0', flexShrink: 0 }}>
        {(['faq', 'diagnostic', 'terminal'] as const).map((id) => (
          <button
            key={id}
            onClick={() => setSub(id)}
            style={{
              background: 'none', border: 'none',
              color: sub === id ? '#f0fdf4' : '#64748b',
              fontSize: 12, fontWeight: sub === id ? 700 : 400,
              padding: '4px 10px', cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
              borderBottom: sub === id ? '2px solid #6ee7b7' : '2px solid transparent',
            }}
          >
            {/* BP135 YOKE_35 Phase 3: renamed from "🩺 Diagnostic Mode" -- collided with the
                new top-level "Diagnosis" tab (TheDiagnosisTab, see Phase 4). Component file,
                IPC channel names, and DiagnosticModeTab.tsx itself are untouched -- label only. */}
            {id === 'faq' ? 'FAQ' : id === 'diagnostic' ? '🩺 Remote Diagnostics' : '💻 Terminal'}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: sub === 'diagnostic' || sub === 'terminal' ? 16 : 0 }}>
        {sub === 'faq' && <LeanHelpTab />}
        {sub === 'diagnostic' && <DiagnosticModeTab />}
        {sub === 'terminal' && <MeshTestTerminalTab />}
      </div>
    </div>
  );
}

// ─── Substrate tab (combined) ──────────────────────────────────────────────────
// BP135 YOKE_35 Phase 4: folds the three real substrate surfaces that lived only in the
// now-unrouted 24-tab MnemosyneTabView into ONE CleanShell tab, resolving the "Substrate"
// x2 label collision (MnemosyneTabView.tsx:163 vs :171) by construction -- there is now
// exactly one "Substrate" tab. Each sub-view is mounted as-is (no internal rewrite):
//   - Tools & Panels -> SubstrateTab.tsx (Tools/Markers/Second Door/Areopagus/Theorem)
//   - Stats          -> SubstrateStatsTab.tsx (real getSubstrateStats IPC)
//   - Console        -> UnifiedSubstrateConsole.tsx (Bridge minus addMockTasks + Dashboard,
//                        both real -- see Phase 3 cut)

type SubstrateSubView = 'panels' | 'stats' | 'console';

function CombinedSubstrateTab() {
  const [sub, setSub] = useState<SubstrateSubView>('panels');
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 4, padding: '10px 16px 0', flexShrink: 0 }}>
        {(['panels', 'stats', 'console'] as const).map((id) => (
          <button
            key={id}
            onClick={() => setSub(id)}
            style={{
              background: 'none', border: 'none',
              color: sub === id ? '#f0fdf4' : '#64748b',
              fontSize: 12, fontWeight: sub === id ? 700 : 400,
              padding: '4px 10px', cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
              borderBottom: sub === id ? '2px solid #6ee7b7' : '2px solid transparent',
            }}
          >
            {id === 'panels' ? 'Tools & Panels' : id === 'stats' ? '📊 Stats' : '🌉 Console'}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {sub === 'panels' && <SubstrateTab />}
        {sub === 'stats' && <SubstrateStatsTab />}
        {sub === 'console' && <UnifiedSubstrateConsole />}
      </div>
    </div>
  );
}

// ─── Shared chrome (BgStatusBar) — identical to LeanShell.tsx ─────────────────

function BgStatusBar({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div style={{
      height: 24, background: '#0a0f1a', borderBottom: '1px solid #1e2a38',
      display: 'flex', alignItems: 'center', paddingLeft: 12, opacity: 0.8, flexShrink: 0,
    }}>
      <span style={{ fontSize: 11, fontFamily: 'system-ui, sans-serif', color: '#6ee7b7', letterSpacing: '0.02em' }}>
        ◌ {msg}
      </span>
    </div>
  );
}

function TabBar({
  active, onSelect, isMember, onMemberCta, onExitToLean,
}: {
  active: CleanTab;
  onSelect: (t: CleanTab) => void;
  isMember: boolean;
  onMemberCta: () => void;
  onExitToLean?: () => void;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', background: '#0d1117',
      borderBottom: '1px solid #1e2a38', height: 40, paddingLeft: 8, paddingRight: 8, flexShrink: 0,
    }}>
      {/* BP135 YOKE_35 Phase 4: scrollable -- 13 tabs (up from 7) no longer reliably fit a
          narrow window; overflow-x lets every tab stay reachable instead of clipping. */}
      <div style={{ display: 'flex', alignItems: 'center', height: '100%', overflowX: 'auto', flexShrink: 1 }}>
        {TABS.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              style={{
                background: 'none', border: 'none', color: isActive ? '#f0fdf4' : '#64748b',
                fontFamily: 'system-ui, sans-serif', fontSize: 13, fontWeight: isActive ? 600 : 400,
                padding: '0 14px', height: '100%', cursor: 'pointer', position: 'relative',
                transition: 'color 0.15s', borderBottom: isActive ? '2px solid #6ee7b7' : '2px solid transparent',
                outline: 'none', whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div style={{ flex: 1 }} />
      {!isMember && (
        <button
          onClick={onMemberCta}
          title="Join the Cooperative — $5/yr"
          style={{
            background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)', border: '1px solid #059669',
            borderRadius: 4, color: '#6ee7b7', fontSize: 11, fontWeight: 700, padding: '3px 10px',
            cursor: 'pointer', fontFamily: 'system-ui, sans-serif', outline: 'none', marginRight: 6, whiteSpace: 'nowrap',
          }}
        >
          Become a Member · $5/yr
        </button>
      )}
      {onExitToLean && (
        <button
          onClick={onExitToLean}
          title="Back to the standard Lean view"
          style={{
            background: 'none', border: '1px solid #1e2a38', borderRadius: 4, color: '#475569',
            fontSize: 11, padding: '3px 8px', cursor: 'pointer', fontFamily: 'system-ui, sans-serif', outline: 'none',
          }}
        >
          ← Lean
        </button>
      )}
    </div>
  );
}

// ─── CleanShell ─────────────────────────────────────────────────────────────────

export function CleanShell({ currentMode, onModeChange, authState, onExitToLean }: CleanShellProps) {
  const [activeTab, setActiveTab] = useState<CleanTab>('ask');
  const [bgStatus, setBgStatus] = useState<string | null>(null);
  const setupFiredRef = useRef(false);

  const [isMember, setIsMember] = useState<boolean>(authState?.member?.is_member === true);
  const [memberToast, setMemberToast] = useState<string | null>(null);

  const showMemberToast = useCallback((msg: string) => {
    setMemberToast(msg);
    setTimeout(() => setMemberToast(null), 4000);
  }, []);

  const handleMemberCta = useCallback(() => {
    void openMembershipCheckout((err) => showMemberToast(err));
  }, [showMemberToast]);

  useEffect(() => { setIsMember(authState?.member?.is_member === true); }, [authState]);

  useEffect(() => {
    window.amplify?.checkLocalMembershipStatus?.().then((result) => {
      if (result?.is_member) setIsMember(true);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const unsub = window.amplify?.onMembershipActivated?.((result) => {
      if (result.ok) {
        setIsMember(true);
        showMemberToast('Welcome to the Cooperative! You are now a member.');
      } else {
        showMemberToast(`Membership activation failed: ${result.error ?? 'unknown error'}`);
      }
    });
    return () => { unsub?.(); };
  }, [showMemberToast]);

  // Jump to Social tab when OneClickMeshTestPanel's "Share your results" is clicked
  // from Package Store — decouples the two tabs via a DOM CustomEvent rather than
  // prop-drilling a cross-tab callback through the tab-switch render tree.
  useEffect(() => {
    const onJump = () => setActiveTab('social');
    window.addEventListener('mnemo-jump-to-social', onJump);
    return () => window.removeEventListener('mnemo-jump-to-social', onJump);
  }, []);

  // Background setup (identical trigger condition to LeanShell.tsx, so a user who
  // has already completed setup in Lean mode doesn't re-trigger it here).
  useEffect(() => {
    if (setupFiredRef.current) return;
    if (localStorage.getItem(LS_LEAN_SETUP_DONE) === '1') return;
    setupFiredRef.current = true;
    const unsubStatus = window.amplify?.onLeanInstallStatus?.((data) => {
      if (data.step === 'model_ready' || data.step === 'model_complete') {
        setBgStatus(null);
        localStorage.setItem(LS_LEAN_SETUP_DONE, '1');
      } else if (data.step === 'pulling_model') {
        setBgStatus('Downloading your AI model… (this takes a few minutes)');
      } else {
        setBgStatus(data.message ?? null);
      }
    });
    const unsubProgress = window.amplify?.onLeanInstallProgress?.((data) => {
      setBgStatus(`Downloading your AI model… ${data.percentComplete}%`);
    });
    window.amplify?.leanInstallStart?.().catch(() => {});
    return () => { unsubStatus?.(); unsubProgress?.(); };
  }, []);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: '#0a0f1a', color: '#f0fdf4', fontFamily: 'system-ui, -apple-system, sans-serif',
      overflow: 'hidden',
    }}>
      <BgStatusBar msg={bgStatus} />
      {memberToast && (
        <div style={{
          position: 'fixed', top: 48, right: 12, zIndex: 9999,
          background: isMember ? '#065f46' : '#7f1d1d', border: `1px solid ${isMember ? '#059669' : '#991b1b'}`,
          borderRadius: 6, padding: '8px 14px', fontSize: 12, color: isMember ? '#6ee7b7' : '#fca5a5',
          fontFamily: 'system-ui, sans-serif', maxWidth: 320, boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
          {memberToast}
        </div>
      )}
      <TabBar active={activeTab} onSelect={setActiveTab} isMember={isMember} onMemberCta={handleMemberCta} onExitToLean={onExitToLean} />
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {activeTab === 'ask' && <LeanAskTab onSwitchToHome={() => setActiveTab('ask')} />}
        {activeTab === 'package-store' && <PackageStoreTab authState={authState} onSwitchTab={setActiveTab} />}
        {activeTab === 'substrate' && <CombinedSubstrateTab />}
        {activeTab === 'help' && <HelpFaqTab />}
        {activeTab === 'kitchen-table' && <KitchenTableView />}
        {activeTab === 'atlas' && <AtlasView />}
        {activeTab === 'social' && <SocialTab />}
        {/* BP135 YOKE_35 Phase 4: promoted from MnemosyneTabView-only per item 4 -- all six
            confirmed real by file:line in the Phase 3 reality-audit table. */}
        {activeTab === 'diagnosis' && <TheDiagnosisTab />}
        {activeTab === 'publish' && <BatteryPublishTab />}
        {activeTab === 'frame' && (
          <FrameTab currentMode={currentMode} onModeChange={onModeChange} authState={authState} />
        )}
        {activeTab === 'lb-account' && <LBAccountTab />}
        {activeTab === 'settings' && <SettingsTab authState={authState} />}
        {activeTab === 'membership' && <MembershipTab />}
      </div>
    </div>
  );
}

export default CleanShell;
