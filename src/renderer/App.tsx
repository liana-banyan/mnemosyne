// Mnemosyne — Renderer Root
// B37 Phase 1 — Transparent overlay with FrameModeIndicator
// B37 Phase 7 — Auth gate, trial banner, member badge
// MV-HELM-CROWN-AMB SAGA 6 BP045 W1 — Role-gated routes added
// MV-J SAGA 4 BP045 W1 — Federation tab route added
// SAGA 07 BP046B — MnemosyneTabView replaces AMPLIFYDashboard as default dashboard

import React, { useState, useEffect, useLayoutEffect } from 'react';
import { FrameModeIndicator } from './components/FrameModeIndicator';
import { DashboardCornerAffordance } from './components/DashboardCornerAffordance';
import { UpdateToast } from './components/UpdateToast';
import { MnemosyneTabView } from './components/MnemosyneTabView';
import { AMPLIFYDashboard } from './components/AMPLIFYDashboard';
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
  | 'hearth-conjunction'
  | 'federation'
  | 'helm'
  | 'ambassador'
  | 'project';

function getInitialView(): View {
  const hash = window.location.hash;
  if (hash === '#/dashboard') return 'dashboard';
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

  // SAGA 07 BP046B — Dashboard now renders the 4-tab MnemosyneTabView
  if (view === 'dashboard') {
    return (
      <ErrorBoundary label="Mnemosyne Tab View">
        <MnemosyneTabView
          currentMode={mode}
          onModeChange={handleModeChange}
          onClose={() => window.close()}
          authState={authState}
        />
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

      {/* Bug #1 v0.1.10: update download progress + ready-to-install toast */}
      <UpdateToast />

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
