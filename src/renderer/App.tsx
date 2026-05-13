// AMPLIFY Computer — Renderer Root
// B37 Phase 1 — Transparent overlay with FrameModeIndicator
// B37 Phase 7 — Auth gate, trial banner, member badge

import React, { useState, useEffect, useLayoutEffect } from 'react';
import { FrameModeIndicator } from './components/FrameModeIndicator';
import { AMPLIFYDashboard } from './components/AMPLIFYDashboard';
import { ModelPullDialog } from './components/ModelPullDialog';
import { AuthGate } from './components/AuthGate';
import { TrialBanner } from './components/TrialBanner';
import { HearthConjunctionWindow } from './hearth/HearthConjunctionWindow';
import { ErrorBoundary } from './components/ErrorBoundary';
import type { FrameMode } from './components/FrameModeIndicator';
import type { AuthState } from './amplify.d';

type View = 'overlay' | 'dashboard' | 'hearth-conjunction';

function getInitialView(): View {
  const hash = window.location.hash;
  if (hash === '#/dashboard') return 'dashboard';
  if (hash === '#/hearth-conjunction') return 'hearth-conjunction';
  return 'overlay';
}

export default function App() {
  const [mode, setMode] = useState<FrameMode>('normal');
  const [view] = useState<View>(getInitialView);
  const [showDashboard, setShowDashboard] = useState(view === 'dashboard');
  const [showModelPull, setShowModelPull] = useState(false);
  const [authState, setAuthState] = useState<AuthState | null>(null);

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

    // First-launch: check if default model needs pulling
    window.amplify.getOllamaStatus().then((status) => {
      if (status.running && !status.model) {
        window.amplify.listOllamaModels().then((models) => {
          const defaultInstalled = models.some((m) =>
            m.startsWith('llama3.1:8b'),
          );
          if (!defaultInstalled && view === 'overlay') {
            setShowModelPull(true);
          }
        });
      }
    });

    return () => {
      cleanupMode?.();
      cleanupAuth?.();
    };
  }, []);

  const showAuthGate =
    !authState || authState.status === 'unauthenticated' || authState.status === 'validating';

  // Single source of truth for LB Frame pointer capture (LB-STACK-0157).
  // When any modal/gate is visible, the overlay must receive clicks; otherwise passthrough.
  const overlayNeedsPointerCapture =
    view === 'overlay' && (showAuthGate || showModelPull || showDashboard);

  useLayoutEffect(() => {
    if (view !== 'overlay') return;
    window.amplify?.setClickthrough(!overlayNeedsPointerCapture);
  }, [view, overlayNeedsPointerCapture]);

  const handleModeChange = (newMode: FrameMode) => {
    setMode(newMode);
    window.amplify.setFrameMode(newMode);
  };

  const handleCornerClick = () => {
    setShowDashboard(true);
  };

  const handleDashboardClose = () => {
    setShowDashboard(false);
  };

  const showTrialBanner =
    !showAuthGate &&
    (authState?.status === 'trial_active' || authState?.status === 'trial_expired');

  if (view === 'dashboard') {
    return (
      <AMPLIFYDashboard
        currentMode={mode}
        onModeChange={handleModeChange}
        onClose={() => window.close()}
        authState={authState}
      />
    );
  }

  // B83 — Hearth Conjunction Window (Heavy Booster Test surface)
  // BP041 — wrapped in ErrorBoundary so single-component crashes don't white-screen the entire window.
  // Founder direct: "I cannot get out of the white screen that happened when I clicked the substrate tab."
  if (view === 'hearth-conjunction') {
    return (
      <ErrorBoundary label="Hearth Conjunction Window">
        <HearthConjunctionWindow />
      </ErrorBoundary>
    );
  }

  return (
    <>
      {/* Always-present LB Frame border + corner indicator */}
      <FrameModeIndicator
        state={{ mode }}
        onModeChange={showModelPull || showDashboard || showAuthGate ? undefined : handleCornerClick}
        memberBadge={authState?.member?.badge_tier}
        degraded={authState?.degraded ?? false}
      />

      {/* Phase 7: First-launch / auth gate */}
      {showAuthGate && (
        <AuthGate isValidating={authState?.status === 'validating'} />
      )}

      {/* Phase 7: Trial banner (active or expired) */}
      {showTrialBanner && !showAuthGate && (
        <TrialBanner
          status={authState!.status as 'trial_active' | 'trial_expired'}
          daysRemaining={authState?.trial_days_remaining ?? 0}
        />
      )}

      {/* First-launch model download consent */}
      {showModelPull && !showAuthGate && (
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
      {showDashboard && !showModelPull && !showAuthGate && (
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
