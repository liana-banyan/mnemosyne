// MnemosyneC — Renderer Root
// B37 Phase 1 — Transparent overlay with FrameModeIndicator
// B37 Phase 7 — Auth gate, trial banner, member badge
// MV-HELM-CROWN-AMB SAGA 6 BP045 W1 — Role-gated routes added
// MV-J SAGA 4 BP045 W1 — Federation tab route added
// SAGA 07 BP046B — MnemosyneTabView replaces AMPLIFYDashboard as default dashboard
// SEG-R-1 BP067 — First-run gate: view=dashboard -> MnemosyneTabView -> Bp067FirstRunSpine
//   WelcomeView (Amnesia headline + two-doorway cascade) is the first spine step.
//   localStorage keys: 'mnemosynec_onboarding_complete' (WelcomeView done)
//                      'mnemosyne-bp067-first-run-complete' (full spine done)
//   Settings remain reachable via gear icon (SettingsTab inside MnemosyneTabView).

import React, { useState, useEffect, useLayoutEffect } from 'react';
import { FrameModeIndicator } from './components/FrameModeIndicator';
import { DashboardCornerAffordance } from './components/DashboardCornerAffordance';
import { UpdateToast } from './components/UpdateToast';
import { UpdateModal } from './components/UpdateModal';
// unrouted BP135 -- see YOKE_35 (Phase 1: CleanShell is now the default 'dashboard' mount below;
// MnemosyneTabView is no longer reachable from the shipped app. Kept per Rule 66 -- un-route, don't delete.)
import { MnemosyneTabView } from './components/MnemosyneTabView';
// unrouted BP135 -- see YOKE_35 (Phase 1: no longer mounted anywhere in App.tsx -- both the
// 'dashboard' view and the '#/clean-shell' hash now mount CleanShell. Kept per Rule 66.)
import { LeanShell } from './components/LeanShell';
import { CleanShell } from './components/CleanShell';
// BP138 Yoke 0.9.14 — new 5-tab Compass nav (Ask/Proof/Library/Social/More), reachable for
// testing at #/compass. Sibling to CleanShell.tsx; does not touch it or either of its two
// existing mount points ('dashboard' / 'clean-shell') below.
import { CompassShell } from './components/CompassShell';
import { AMPLIFYDashboard } from './components/AMPLIFYDashboard';
import { ClipboardCaptureModal } from './components/ClipboardCaptureModal';
import { ModelPullDialog } from './components/ModelPullDialog';
import { AuthGate } from './components/AuthGate';
import { TrialBanner } from './components/TrialBanner';
import { HearthConjunctionWindow } from './hearth/HearthConjunctionWindow';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FederationTab } from './components/FederationTab';
import { HelmCrownDashboard } from './hearth/helm/HelmCrownDashboard';
import { AmbassadorDashboard } from './ambassador/AmbassadorDashboard';
import { ProjectOwnerDashboard } from './project/ProjectOwnerDashboard';
import type { FrameMode } from './components/FrameModeIndicator';
import type { AuthState } from './amplify.d';
import type { UserRole, RoleArray } from '../shared/roles';
import { canAccessHelm, canAccessAmbassador, canAccessProject } from '../shared/roles';

type View =
  | 'overlay'
  | 'dashboard'
  | 'clean-shell'
  | 'compass'
  | 'hearth-conjunction'
  | 'federation'
  | 'helm'
  | 'ambassador'
  | 'project';

function getInitialView(): View {
  const hash = window.location.hash;
  if (hash === '#/dashboard') return 'dashboard';
  // BP132 Yoke #22 — clean 7-tab shell (CleanShell.tsx), reachable for testing at
  // #/clean-shell without touching the production Lean/Advanced default at
  // #/dashboard. Not linked from any default-path UI yet — Founder/Bishop opens it
  // directly by hash while the clean-shell-v0.9 branch is under review.
  if (hash === '#/clean-shell') return 'clean-shell';
  // BP138 Yoke 0.9.14 — new 5-tab Compass nav (Ask/Proof/Library/Social/More), reachable for
  // testing at #/compass. Not linked from any default-path UI yet — Founder/Bishop opens it
  // directly by hash while the nav-reorg is under review. Additive-only: does not change the
  // #/dashboard or #/clean-shell resolution above.
  if (hash === '#/compass') return 'compass';
  if (hash === '#/hearth-conjunction') return 'hearth-conjunction';
  if (hash === '#/federation') return 'federation';
  if (hash === '#/helm') return 'helm';
  if (hash === '#/ambassador') return 'ambassador';
  if (hash.startsWith('#/project/')) return 'project';
  return 'overlay';
}

function getProjectSlug(): string {
  const hash = window.location.hash;
  const match = hash.match(/^#\/project\/(.+)/);
  return match ? match[1] : '';
}

function AccessDenied({ role }: { role: string }) {
  return (
    <div style={{
      background: '#0a0f1a', color: '#64748b',
      fontFamily: 'system-ui, sans-serif',
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 8, textAlign: 'center', padding: 24,
    }}>
      <div style={{ fontSize: 28 }}>🔒</div>
      <div style={{ fontSize: 14, color: '#e2e8f0' }}>Access restricted</div>
      <div style={{ fontSize: 11 }}>This surface requires role: <code>{role}</code></div>
    </div>
  );
}

// Shared localStorage key — cross-window overlay visibility (default OFF = opt-in)
const LS_OVERLAY_ACTIVE = 'mnemo_overlay_active';

// Cycle order for bottom-right chip: ai_burst → normal → fallback → ai_burst
const OVERLAY_MODE_CYCLE: Record<FrameMode, FrameMode> = {
  ai_burst: 'normal',
  normal:   'fallback',
  fallback: 'ai_burst',
};

export default function App() {
  const [mode, setMode] = useState<FrameMode>('normal');
  const [view] = useState<View>(getInitialView);
  const [projectSlug] = useState<string>(getProjectSlug);
  const [showDashboard, setShowDashboard] = useState(view === 'dashboard');
  const [showModelPull, setShowModelPull] = useState(false);
  const [authState, setAuthState] = useState<AuthState | null>(null);
  // Overlay visible = opt-in (default false); synced via localStorage across windows
  const [overlayActive, setOverlayActive] = useState<boolean>(() =>
    localStorage.getItem(LS_OVERLAY_ACTIVE) === 'true'
  );
  // v0.4.0 BP083 SEG-5: post-install restart prompt state
  const [restartPrompt, setRestartPrompt] = useState<{ version: string; message: string } | null>(null);
  // v0.4.2 BP083 SEG-5: Plow resume modal
  const [plowResumeData, setPlowResumeData] = useState<Record<string, unknown> | null>(null);

  // Sync mode from main process + check first-launch model
  useEffect(() => {
    let cleanupMode: (() => void) | undefined;
    let cleanupAuth: (() => void) | undefined;

    // Guard: window.amplify is injected by the Electron preload via contextBridge.
    // In rare cases (preload timing edge, test harness) it may be absent — bail silently.
    if (!window.amplify) {
      console.warn('[AMPLIFY App] window.amplify not ready — bridge may not have loaded.');
      return;
    }

    window.amplify.getFrameMode().then(({ mode: m }) => setMode(m));
    cleanupMode = window.amplify.onFrameModeChanged(({ mode: m }) => setMode(m));

    // Phase 7: load auth state
    window.amplify.getAuthState().then(setAuthState);
    cleanupAuth = window.amplify.onAuthStateChanged((state) => {
      setAuthState(state);
    });

    // v0.4.0 BP083 SEG-5: listen for post-install restart prompt
    window.amplify.onShowRestartPrompt?.((data) => {
      setRestartPrompt(data as { version: string; message: string });
    });

    // v0.4.2 BP083 SEG-5: listen for Plow resume prompt
    window.amplify.onPlowResumePrompt?.((data) => {
      setPlowResumeData(data);
    });

    // First-launch model check deferred to BP067 Bp067FirstRunSpine (setupPrivateAI)

    return () => {
      cleanupMode?.();
      cleanupAuth?.();
    };
  }, []);

  // Cross-window sync: when FrameTab (dashboard window) writes mnemo_overlay_active,
  // the storage event fires here (overlay window) and updates overlayActive.
  useEffect(() => {
    if (view !== 'overlay') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_OVERLAY_ACTIVE) {
        setOverlayActive(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [view]);

  // AuthGate is shown in HearthConjunctionWindow (a normal movable OS window), NOT in the
  // always-on-top overlay. This makes it impossible for the modal to trap the user:
  // the native window has X button, Alt+F4, Esc key, and can be moved. (BP046B P0 fix)
  const showAuthGate =
    authState !== null &&
    (authState.status === 'unauthenticated' || authState.status === 'validating');

  // Single source of truth for LB Frame pointer capture (LB-STACK-0157).
  // AuthGate is no longer in the overlay — overlay stays transparent/passthrough at first launch.
  const overlayNeedsPointerCapture =
    view === 'overlay' && (showModelPull || showDashboard);

  useLayoutEffect(() => {
    if (view !== 'overlay') return;
    window.amplify?.setClickthrough(!overlayNeedsPointerCapture);
  }, [view, overlayNeedsPointerCapture]);

  const handleModeChange = (newMode: FrameMode) => {
    setMode(newMode);
    window.amplify.setFrameMode(newMode);
  };

  // Bottom-right chip cycles through 3 modes: AI Burst → Normal → Fallback → AI Burst.
  // (Dashboard opens from DashboardCornerAffordance top-left pill; chip is reserved for mode cycling.)
  const handleCornerClick = () => {
    handleModeChange(OVERLAY_MODE_CYCLE[mode]);
  };

  const handleDashboardClose = () => {
    setShowDashboard(false);
  };

  const showTrialBanner =
    authState?.status === 'trial_active' || authState?.status === 'trial_expired';

  // BP139 Yoke 0.9.15: CompassShell (the BP138 Yoke 0.9.14 5-tab Ask/Proof/Library/Social/More
  // nav) is now the DEFAULT front door for ALL users, replacing CleanShell (the BP135 YOKE_35
  // default). CleanShell is NOT deleted -- it stays fully reachable at '#/clean-shell' (Rule 66:
  // un-route, don't delete) and onExitToLean below wires the Compass "<- Lean" button straight to
  // that existing route as the reversible escape hatch back to the old 13-tab shell.
  if (view === 'dashboard') {
    return (
      <ErrorBoundary label="Compass Shell (BP139 Yoke 0.9.15 default)">
        <CompassShell
          currentMode={mode}
          onModeChange={handleModeChange}
          onClose={() => window.close()}
          authState={authState}
          onExitToLean={() => { window.location.hash = '#/clean-shell'; window.location.reload(); }}
        />
        {/* BP083 v0.3.2: update UI must mount in dashboard window (was overlay-only) */}
        <UpdateToast />
        <UpdateModal />
        {/* SEG-5 v0.1.59: Clipboard Q+A capture modal — hidden until triggered via tray or Ctrl+Shift+M */}
        <ClipboardCaptureModal />
        {/* v0.4.0 BP083 SEG-5: post-install restart prompt modal */}
        {restartPrompt && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
              padding: 28, maxWidth: 440, color: '#e2e8f0', textAlign: 'center',
            }}>
              <p style={{ fontSize: 15, marginBottom: 16 }}>{restartPrompt.message}</p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button
                  onClick={() => window.amplify?.requestAppQuit?.()}
                  style={{
                    background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8,
                    padding: '8px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                  }}
                >
                  Close MnemosyneC now
                </button>
                <button
                  onClick={() => setRestartPrompt(null)}
                  style={{
                    background: 'transparent', color: '#94a3b8', border: '1px solid #334155',
                    borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 14,
                  }}
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        )}
        {/* v0.4.2 BP083 SEG-5: Plow Resume modal */}
        {plowResumeData && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 9998,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              background: '#1e293b', border: '1px solid #6ee7b7', borderRadius: 14,
              padding: 28, maxWidth: 460, color: '#e2e8f0', textAlign: 'center',
              boxShadow: '0 0 30px rgba(110,231,183,0.15)',
            }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>🌾 Resume Plow?</div>
              <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>
                We detected an interrupted Plow from {String(plowResumeData.lastUpdated ?? '')}
              </p>
              <p style={{ fontSize: 15, color: '#6ee7b7', marginBottom: 4, fontWeight: 600 }}>
                {String(plowResumeData.totalQuestionsCompleted ?? 0)} / {String(plowResumeData.totalQuestionsTarget ?? 0)} questions complete
                ({String(plowResumeData.completedPct ?? 0)}%)
              </p>
              <p style={{ fontSize: 12, color: '#64748b', marginBottom: 20 }}>
                Model: {String((plowResumeData.config as Record<string, unknown>)?.model ?? 'unknown')} ·
                Domains: {((plowResumeData.config as Record<string, unknown>)?.domains as string[] | undefined)?.length ?? 0}
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button
                  onClick={() => {
                    window.amplify?.plowResumeFromCheckpoint?.();
                    setPlowResumeData(null);
                  }}
                  style={{
                    background: '#6ee7b7', color: '#0a0f1a', border: 'none', borderRadius: 8,
                    padding: '8px 22px', cursor: 'pointer', fontSize: 14, fontWeight: 700,
                  }}
                >
                  Resume Plow
                </button>
                <button
                  onClick={() => {
                    window.amplify?.plowDiscardCheckpoint?.();
                    setPlowResumeData(null);
                  }}
                  style={{
                    background: 'transparent', color: '#94a3b8', border: '1px solid #334155',
                    borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 14,
                  }}
                >
                  Start Fresh
                </button>
              </div>
            </div>
          </div>
        )}
        {/* BP138 Yoke 0.9.13 F4 item 2: the v0.4.2 BP083 SEG-3.5 "Lifecycle diagnostic banner"
            ("MnemosyneC didn't finish setting up · click here to continue.", blue #1e3a5f/
            #3b82f6) was removed from here. Root cause: it read mnemosynec_lifecycle_stage,
            which only ever advances past 'A'/'B'/'C' via WelcomeView.tsx/Layer2ProveIt.tsx/
            Layer2UseIt.tsx/MnemosyneTabView.tsx (advanceTo('B'/'C'/'D')) -- but BP135 YOKE_35
            Phase 1 made CleanShell (mounted above) the sole default front door and left that
            entire advancing chain unrouted (see the MnemosyneTabView import comment at the top
            of this file). Any install whose localStorage still carried a pre-YOKE_35 'A'/'B'/'C'
            stage value (or any CleanShell-only user who never had a reason to touch that dead
            code path) could NEVER satisfy this banner's completion condition -- it was a
            permanent false positive, not an honest signal, for every user of the current front
            door. Removed rather than patched with a new "is CleanShell onboarding done" heuristic
            we cannot actually verify (Truth-Always: don't fabricate a replacement status). If
            CleanShell grows its own real onboarding-completion signal later, wire a fresh banner
            off of that -- do not resurrect mnemosynec_lifecycle_stage for it. */}
      </ErrorBoundary>
    );
  }

  // BP132 Yoke #22 — CleanShell test route (#/clean-shell). Additive-only: does not
  // touch the 'dashboard' view above, so the production Lean/Advanced default is
  // unaffected while this fork is under review.
  if (view === 'clean-shell') {
    return (
      <ErrorBoundary label="Clean Shell (BP132 Yoke #22)">
        <CleanShell
          currentMode={mode}
          onModeChange={handleModeChange}
          onClose={() => window.close()}
          authState={authState}
          onExitToLean={() => { window.location.hash = '#/dashboard'; window.location.reload(); }}
        />
        <UpdateToast />
        <UpdateModal />
        <ClipboardCaptureModal />
      </ErrorBoundary>
    );
  }

  // BP138 Yoke 0.9.14 — Compass nav test route (#/compass). Additive-only, mirrors the
  // '#/clean-shell' block above exactly: does not touch 'dashboard' or 'clean-shell', so
  // neither the production Lean/Advanced default nor the clean-shell fork under review is
  // affected while this nav-reorg is under review.
  if (view === 'compass') {
    return (
      <ErrorBoundary label="Compass Shell (BP138 Yoke 0.9.14)">
        <CompassShell
          currentMode={mode}
          onModeChange={handleModeChange}
          onClose={() => window.close()}
          authState={authState}
          onExitToLean={() => { window.location.hash = '#/dashboard'; window.location.reload(); }}
        />
        <UpdateToast />
        <UpdateModal />
        <ClipboardCaptureModal />
      </ErrorBoundary>
    );
  }

  // B83 — Hearth Conjunction Window (Heavy Booster Test surface)
  // BP041 — wrapped in ErrorBoundary so single-component crashes don't white-screen the entire window.
  // BP046B — AuthGate is shown HERE (not in the always-on-top overlay) so the user can always escape
  // via the native OS window X button, Alt+F4, Esc key, or the "Use Free Forever" primary CTA.
  if (view === 'hearth-conjunction') {
    return (
      <ErrorBoundary label="Hearth Conjunction Window">
        {showAuthGate && (
          <AuthGate isValidating={authState?.status === 'validating'} />
        )}
        <HearthConjunctionWindow />
      </ErrorBoundary>
    );
  }

  // MV-J SAGA 4 — Federation tab
  if (view === 'federation') {
    return (
      <ErrorBoundary label="Federation Tab">
        <FederationTab />
      </ErrorBoundary>
    );
  }

  // MV-HELM-CROWN-AMB SAGA 6 — Role-gated surfaces
  // Roles are derived from authState; Founder has access to all role-gated routes.
  const userRoles: RoleArray = (authState as any)?.member?.roles ?? [];
  const isFounder = (authState as any)?.member?.is_founder === true;
  const effectiveRoles: RoleArray = isFounder ? [...userRoles, 'founder'] : userRoles;

  if (view === 'helm') {
    if (!canAccessHelm(effectiveRoles)) {
      return <AccessDenied role="helm-crown" />;
    }
    return (
      <ErrorBoundary label="Helm Crown Dashboard">
        <HelmCrownDashboard
          userRole={isFounder ? 'founder' : 'helm-crown'}
          displayName={(authState as any)?.member?.display_name}
        />
      </ErrorBoundary>
    );
  }

  if (view === 'ambassador') {
    if (!canAccessAmbassador(effectiveRoles)) {
      return <AccessDenied role="ambassador" />;
    }
    return (
      <ErrorBoundary label="Ambassador Dashboard">
        <AmbassadorDashboard
          userRole={isFounder ? 'founder' : 'ambassador'}
          displayName={(authState as any)?.member?.display_name}
        />
      </ErrorBoundary>
    );
  }

  if (view === 'project') {
    if (!canAccessProject(effectiveRoles)) {
      return <AccessDenied role="project-owner" />;
    }
    return (
      <ErrorBoundary label="Project Owner Dashboard">
        <ProjectOwnerDashboard
          slug={projectSlug}
          userRole={isFounder ? 'founder' : 'project-owner'}
          displayName={(authState as any)?.member?.display_name}
        />
      </ErrorBoundary>
    );
  }

  return (
    <>
      <DashboardCornerAffordance />
      {/* LB Frame border + corner indicator — opt-in only (defaults OFF).
          Enabled from FrameTab "Show" button → writes mnemo_overlay_active to localStorage.
          Bottom-right chip cycles AI Burst → Normal → Fallback → AI Burst. */}
      {overlayActive && (
        <FrameModeIndicator
          state={{ mode }}
          onModeChange={handleModeChange}
          onChipClick={showModelPull ? undefined : handleCornerClick}
          memberBadge={authState?.member?.badge_tier}
          degraded={authState?.degraded ?? false}
        />
      )}

      {/* Bug #1 v0.1.10 + BP083 v0.3.2: update download progress + install modal */}
      <UpdateToast />
      <UpdateModal />

      {/* Phase 7: Trial banner (active or expired) */}
      {showTrialBanner && (
        <TrialBanner
          status={authState!.status as 'trial_active' | 'trial_expired'}
          daysRemaining={authState?.trial_days_remaining ?? 0}
        />
      )}

      {/* First-launch model download consent */}
      {showModelPull && (
        <ModelPullDialog
          onComplete={() => {
            setShowModelPull(false);
          }}
          onSkip={() => {
            setShowModelPull(false);
          }}
        />
      )}

      {/* In-overlay dashboard (mode switcher + telemetry) */}
      {showDashboard && !showModelPull && (
        <AMPLIFYDashboard
          currentMode={mode}
          onModeChange={handleModeChange}
          onClose={handleDashboardClose}
          authState={authState}
        />
      )}
    </>
  );
}
