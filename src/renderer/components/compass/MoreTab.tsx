// compass/MoreTab.tsx -- BP138 Yoke 0.9.14: Compass nav tab 5 (More, overflow).
//
// Menu of destinations not promoted to a top-level Compass tab: Kitchen Table, Atlas,
// Diagnosis, Frame, LB Account, Settings, Membership, Help, Power/Diagnostics (Phase 2).
//
// Two destinations here (Diagnosis, Frame) are NOT explicitly named anywhere in this Yoke's
// Phase 1 "More" list -- see this Yoke's final report, "decisions I had to make" section, for
// why they landed here rather than being silently dropped (Rule: reorganize, never delete
// function).
//
// Kitchen Table and Atlas are ALSO reachable directly from the Ask home's quick-starts
// (Phase 3) -- their presence here is supplementary, not their primary front door, per the
// Yoke's own instruction.
//
// Help and Substrate here are small LOCAL composers mirroring CleanShell.tsx's own
// HelpFaqTab/CombinedSubstrateTab sub-tab pattern exactly, rather than importing those private
// (non-exported) functions from CleanShell.tsx -- this keeps CleanShell.tsx byte-for-byte
// untouched, which is this Yoke's hard acceptance gate.

import React from 'react';
import type { AuthState } from '../../amplify.d';
import type { FrameMode } from '../FrameModeIndicator';
import { KitchenTableView } from '../../kitchen_table/KitchenTableView';
import { AtlasView } from '../../kitchen_table/AtlasView';
import { TheDiagnosisTab } from '../TheDiagnosisTab';
import { FrameTab } from '../FrameTab';
import { LBAccountTab } from '../LBAccountTab';
import { SettingsTab } from '../SettingsTab';
import { MembershipTab } from '../MembershipTab';
import { LeanHelpTab } from '../LeanHelpTab';
import { DiagnosticModeTab } from '../DiagnosticModeTab';
import { MeshTestTerminalTab } from '../MeshTestTerminalTab';
import { PowerDiagnosticsPanel } from './PowerDiagnosticsPanel';
import { AuthorizationsPanel } from './AuthorizationsPanel';
// D-M3004-023/BISHOP-M0/prove-it-button: additive-only new destination, separate from the
// existing "Prove It Now" (Proof tab) -- see that file's own header for the seam rationale.
import { SwappableTerminalPanes } from './SwappableTerminalPanes';
import type { MoreSubView } from './types';

function HelpComposer(): React.ReactElement {
  const [sub, setSub] = React.useState<'faq' | 'diagnostic' | 'terminal'>('faq');
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

interface MenuEntry {
  id: MoreSubView;
  icon: string;
  label: string;
  desc: string;
}

const MENU: MenuEntry[] = [
  { id: 'kitchen-table', icon: '🍽️', label: 'Kitchen Table', desc: 'Recipes, trail eblets, bounty board' },
  { id: 'atlas', icon: '🗓️', label: 'Atlas', desc: 'Scheduling, meal planning, shared calendar' },
  { id: 'diagnosis', icon: '🧂', label: 'Diagnosis', desc: 'Post an open question to the community' },
  { id: 'frame', icon: '🖼️', label: 'Frame', desc: 'LB Frame overlay border + mode indicator' },
  { id: 'lb-account', icon: '🔑', label: 'LB Account', desc: 'Your Liana Banyan account' },
  { id: 'settings', icon: '⚙️', label: 'Settings', desc: 'App preferences, models, updates' },
  { id: 'membership', icon: '💎', label: 'Membership', desc: '$5/year cooperative membership' },
  { id: 'help', icon: '❓', label: 'Help', desc: 'FAQ, remote diagnostics, terminal' },
  { id: 'power', icon: '🧪', label: 'Power / Diagnostics', desc: 'Advanced mesh + substrate controls' },
  // D-BP148-038: one place for every permission MnemosyneC holds or grants -- automatic
  // updates, mesh trust/peer verification, paid cloud escalation, Nexus authorities, and any
  // active benchmark/long-running task.
  { id: 'authorizations', icon: '🔐', label: 'Authorizations', desc: 'Permissions the app holds: updates, mesh trust, paid escalation, Nexus' },
  // D-M3004-023/BISHOP-M0/prove-it-button: a separate, additive surface -- not a replacement
  // for the existing "Prove It Now" (Proof tab), which is unmodified by this entry.
  { id: 'terminal-panes', icon: '🖥️', label: 'Terminal Panes', desc: 'Swappable-role panes: run one proof question, watch the receipt JSON land live' },
];

export interface MoreTabProps {
  subView: MoreSubView;
  onSubViewChange: (v: MoreSubView) => void;
  authState: AuthState | null;
  currentMode: FrameMode;
  onModeChange: (mode: FrameMode) => void;
}

export function MoreTab({ subView, onSubViewChange, authState, currentMode, onModeChange }: MoreTabProps): React.ReactElement {
  if (subView !== 'menu') {
    const entry = MENU.find((m) => m.id === subView);
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
          borderBottom: '1px solid #1e2a38', flexShrink: 0,
        }}>
          <button
            onClick={() => onSubViewChange('menu')}
            style={{
              background: 'none', border: '1px solid rgba(100,116,139,0.3)', borderRadius: 6,
              color: '#64748b', fontSize: 11, padding: '4px 10px', cursor: 'pointer',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            ← More
          </button>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
            {entry ? `${entry.icon} ${entry.label}` : ''}
          </span>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {subView === 'kitchen-table' && <KitchenTableView />}
          {subView === 'atlas' && <AtlasView />}
          {subView === 'diagnosis' && <TheDiagnosisTab />}
          {subView === 'frame' && <FrameTab currentMode={currentMode} onModeChange={onModeChange} authState={authState} />}
          {subView === 'lb-account' && <LBAccountTab />}
          {subView === 'settings' && <SettingsTab authState={authState} />}
          {subView === 'membership' && <MembershipTab />}
          {subView === 'help' && <HelpComposer />}
          {subView === 'power' && <PowerDiagnosticsPanel authState={authState} />}
          {subView === 'authorizations' && <AuthorizationsPanel onSubViewChange={onSubViewChange} />}
          {subView === 'terminal-panes' && <SwappableTerminalPanes />}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      height: '100%', overflowY: 'auto', padding: '16px 20px',
      background: '#0a0f1a', color: '#f0fdf4', fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ marginBottom: 12, fontSize: 16, fontWeight: 700, color: '#f0fdf4' }}>More</div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12,
      }}>
        {MENU.map((entry) => (
          <button
            key={entry.id}
            onClick={() => onSubViewChange(entry.id)}
            style={{
              background: '#111827', border: '1px solid rgba(100,116,139,0.2)', borderRadius: 10,
              padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 4,
              cursor: 'pointer', textAlign: 'left' as const, fontFamily: 'system-ui, sans-serif',
            }}
          >
            <div style={{ fontSize: 20 }}>{entry.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{entry.label}</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>{entry.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default MoreTab;
