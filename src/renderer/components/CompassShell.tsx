// CompassShell.tsx -- BP138 Yoke 0.9.14 (KNIGHT YOKE 0.9.14 BP138 rev2): new primary-nav
// information architecture. Sibling to CleanShell.tsx (new file, does not touch it) --
// reachable for testing at #/compass without affecting the production Lean/Advanced default
// (#/dashboard) or the existing clean-shell fork under review (#/clean-shell). Neither of
// those two App.tsx branches is modified by this Yoke.
//
// 5-tab nav: Ask, Proof, Library, Social, More. See the TABS array below for the one place to
// reorder tabs. Every tab's content is composed from REAL, already-existing components --
// nothing in src/renderer/components/compass/ fabricates data or reimplements IPC that already
// exists elsewhere; each file's own header documents exactly what it reuses and why.
//
// Membership CTA + membership-status wiring below mirrors CleanShell.tsx's TabBar/openMember-
// shipCheckout/useEffect blocks (same underlying window.amplify IPC bridge, same copy) --
// duplicated as a small, self-contained thin wrapper rather than importing from CleanShell.tsx,
// since those helpers are not exported there and this Yoke's hard constraint is to leave
// CleanShell.tsx (and App.tsx's existing branches) byte-for-byte untouched.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AskHomeTab } from './compass/AskHomeTab';
import { ProofTab } from './compass/ProofTab';
import { LibraryTab } from './compass/LibraryTab';
import { SocialCompassTab } from './compass/SocialCompassTab';
import { MoreTab } from './compass/MoreTab';
import { BoardPanel } from './board/BoardPanel';
import { boardSubscription, alarmCount } from './board/board_subscription';
import type { CompassTab, MoreSubView, CompassNavigate } from './compass/types';
import type { FrameMode } from './FrameModeIndicator';
import type { AuthState } from '../amplify.d';

const LS_LEAN_SETUP_DONE = 'lean_bg_setup_complete';

// BP138 Yoke 0.9.14: swap point -- reorder this array to change the tab order (e.g. Proof
// before Ask) without touching any other file in this Yoke.
const TABS: Array<{ id: CompassTab; label: string }> = [
  { id: 'ask', label: 'Ask' },
  { id: 'proof', label: 'Proof' },
  { id: 'library', label: 'Library' },
  { id: 'social', label: 'Social' },
  { id: 'more', label: 'More' },
  // KN-BP144-10: Grand Central board panel. Sixth sibling tab -- no reordering of the other
  // five, per the array's own swap-point convention above.
  { id: 'board', label: 'Board' },
];

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
  active, onSelect, isMember, onMemberCta, boardAlarmCount,
}: {
  active: CompassTab;
  onSelect: (t: CompassTab) => void;
  isMember: boolean;
  onMemberCta: () => void;
  boardAlarmCount: number | null;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', background: '#0d1117',
      borderBottom: '1px solid #1e2a38', height: 40, paddingLeft: 8, paddingRight: 8, flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', height: '100%', overflowX: 'auto', flexShrink: 1 }}>
        {TABS.map((t) => {
          const isActive = t.id === active;
          // KN-BP144-10 T2: alarm-count badge on the Board tab's own nav entry, visible
          // regardless of which tab is currently active -- this is the whole point of a panel
          // rather than a terminal tab. Fed by boardSubscription's shared timer (see
          // CompassShell's own useEffect below), which polls independent of BoardPanel ever
          // being mounted.
          const showBadge = t.id === 'board' && boardAlarmCount !== null && boardAlarmCount > 0;
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              style={{
                background: 'none', border: 'none', color: isActive ? '#f0fdf4' : '#64748b',
                fontFamily: 'system-ui, sans-serif', fontSize: 13, fontWeight: isActive ? 600 : 400,
                padding: '0 16px', height: '100%', cursor: 'pointer', position: 'relative',
                transition: 'color 0.15s', borderBottom: isActive ? '2px solid #6ee7b7' : '2px solid transparent',
                outline: 'none', whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              {t.label}
              {showBadge && (
                <span style={{
                  position: 'absolute', top: 4, right: 4, background: '#dc2626', color: '#fff',
                  borderRadius: 8, fontSize: 10, fontWeight: 700, lineHeight: 1,
                  padding: '2px 5px', minWidth: 14, textAlign: 'center',
                }}>
                  {boardAlarmCount}
                </span>
              )}
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
    </div>
  );
}

export interface CompassShellProps {
  currentMode: FrameMode;
  onModeChange: (mode: FrameMode) => void;
  onClose: () => void;
  authState: AuthState | null;
}

export function CompassShell({ currentMode, onModeChange, authState }: CompassShellProps) {
  const [activeTab, setActiveTab] = useState<CompassTab>('ask');
  const [moreSubView, setMoreSubView] = useState<MoreSubView>('menu');
  const [bgStatus, setBgStatus] = useState<string | null>(null);
  const setupFiredRef = useRef(false);

  const [isMember, setIsMember] = useState<boolean>(authState?.member?.is_member === true);
  const [memberToast, setMemberToast] = useState<string | null>(null);

  // KN-BP144-10 T2: subscribe to the board's shared poll HERE, at the shell level, not inside
  // BoardPanel.tsx -- so the nav badge stays live ("visible from other tabs") whether or not the
  // Board tab has ever been opened this session. boardSubscription is a singleton (see
  // board_subscription.ts): this adds a second subscriber sharing BoardPanel's own timer, it
  // does not start a second one.
  const [boardAlarmCount, setBoardAlarmCount] = useState<number | null>(null);
  useEffect(() => {
    const unsub = boardSubscription.subscribe((state) => setBoardAlarmCount(alarmCount(state)));
    return unsub;
  }, []);

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

  // Same cross-tab jump convention as CleanShell.tsx: Power/Diagnostics's "Share your results"
  // (moved from the old Package Store tab) dispatches this DOM CustomEvent instead of
  // prop-drilling a callback through the tab-switch render tree.
  useEffect(() => {
    const onJump = () => setActiveTab('social');
    window.addEventListener('mnemo-jump-to-social', onJump);
    return () => window.removeEventListener('mnemo-jump-to-social', onJump);
  }, []);

  // Background setup -- identical trigger condition to CleanShell.tsx/LeanShell.tsx, so a user
  // who already completed setup in either of those shells doesn't re-trigger it here.
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

  const handleNavigate: CompassNavigate = useCallback((tab, moreSubViewArg) => {
    setActiveTab(tab);
    if (tab === 'more' && moreSubViewArg) setMoreSubView(moreSubViewArg);
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
      <TabBar active={activeTab} onSelect={setActiveTab} isMember={isMember} onMemberCta={handleMemberCta} boardAlarmCount={boardAlarmCount} />
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {activeTab === 'ask' && <AskHomeTab onNavigate={handleNavigate} />}
        {activeTab === 'proof' && <ProofTab onNavigate={handleNavigate} authState={authState} />}
        {activeTab === 'library' && <LibraryTab />}
        {activeTab === 'social' && <SocialCompassTab />}
        {activeTab === 'board' && <BoardPanel />}
        {activeTab === 'more' && (
          <MoreTab
            subView={moreSubView}
            onSubViewChange={setMoreSubView}
            authState={authState}
            currentMode={currentMode}
            onModeChange={onModeChange}
          />
        )}
      </div>
    </div>
  );
}

export default CompassShell;
