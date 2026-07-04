// LeanWelcomeView.tsx — SEG-V0150-P0-LEAN-WELCOME
// Lean, two-screen welcome: Screen 1 = download CTA; Screen 2 = benchmark proof.
// Benchmark data sourced from:
//   librarian-mcp/r10_cross_vendor/results/CADRE_BENCHMARK_RESULTS_BP067.md
//   Big-4 Baseline section, lines 26-33 (BP063 · 2026-05-30 · kappa=0.936)
//
// SEG-V0150-P0-DIAGNOSE-BRIDGE: bridge probe at mount (console, readable via DevTools / diagnostic)
// SEG-V0150-P0-FIX-BRIDGE-OR-FALLBACK: immediate button feedback + 5s fallback + Skip path
// SEG-V0150-P0-PROACTIVE: adaptive CTA based on Ollama + gemma4:12b probe at mount

import React, { useState, useEffect, useRef, useCallback } from 'react';

async function openMembershipCheckout(onError?: (msg: string) => void): Promise<void> {
  try {
    const result = await window.amplify?.openMembershipCheckout?.();
    if (!result) {
      window.open('https://lianabanyan.com/join?source=mnemosynec-app', '_blank', 'noopener');
      return;
    }
    if (!result.ok) {
      onError?.(`Couldn't open membership page: ${result.error ?? 'unknown error'}`);
    }
  } catch {
    onError?.('Membership page could not open. Please visit lianabanyan.com/join');
  }
}

interface Props {
  onComplete: () => void;
}

// ── Benchmark data (EXACT from CADRE_BENCHMARK_RESULTS_BP067.md lines 29-33) ─
const BENCHMARK_ROWS = [
  { model: 'Opus 4.8',                cold: '6.0%',  hot: '89.3%', lift: '+83.3pp' },
  { model: 'GPT-5.5',                 cold: '19.3%', hot: '93.3%', lift: '+74.0pp' },
  { model: 'Gemini-3.5-flash',        cold: '8.0%',  hot: '90.7%', lift: '+82.7pp' },
  { model: 'Llama-single (8b, free)', cold: '6.0%',  hot: '78.0%', lift: '+72.0pp' },
] as const;

// Adaptive CTA states — Off-the-Street test: button text describes what happens on click.
type OllamaProbeState = 'probing' | 'ready' | 'has_ollama_no_model' | 'no_ollama';

function ctaLabelFor(probeState: OllamaProbeState, ctaActive: boolean): string {
  if (ctaActive) return 'Starting…';
  switch (probeState) {
    case 'probing':            return 'Checking your system…';
    case 'ready':              return 'Start using MnemosyneC';
    case 'has_ollama_no_model': return 'Download your AI model (2 min)';
    case 'no_ollama':
    default:                   return 'Set up your AI engine (2 min)';
  }
}

export function LeanWelcomeView({ onComplete }: Props): React.ReactElement {
  const [screen, setScreen] = useState<1 | 2>(1);
  const [onboardingMemberNudgeDismissed, setOnboardingMemberNudgeDismissed] = useState(
    () => localStorage.getItem('mnemo_onboarding_member_nudge_dismissed') === '1',
  );

  const handleMemberNudgeClick = useCallback(() => {
    void openMembershipCheckout();
  }, []);

  const handleMemberNudgeDismiss = useCallback(() => {
    localStorage.setItem('mnemo_onboarding_member_nudge_dismissed', '1');
    setOnboardingMemberNudgeDismissed(true);
    onComplete();
  }, [onComplete]);

  // Install progress state
  const [installStep, setInstallStep] = useState<string | null>(null);
  const [installMessage, setInstallMessage] = useState<string>('');
  const [installProgress, setInstallProgress] = useState<{
    bytesDownloaded: number; totalBytes: number; percentComplete: number;
    speedLabel: string; eta_s: number;
  } | null>(null);
  const [installError, setInstallError] = useState<{ message: string; retryable: boolean } | null>(null);

  // SEG-V0150-P0-FIX-BRIDGE-OR-FALLBACK: visible feedback + 5s fallback
  const [ctaActive, setCtaActive] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const statusReceivedRef = useRef(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // SEG-V0150-P0-PROACTIVE: adaptive CTA based on Ollama probe
  const [ollamaProbe, setOllamaProbe] = useState<OllamaProbeState>('probing');

  // ── Mount: Ollama probe (parallel to event subscription) ──────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const data = await res.json() as { models?: Array<{ name: string }> };
          const models = (data.models ?? []).map((m: { name: string }) => m.name);
          const hasGemma = models.some((m: string) => m === 'gemma4:12b' || m.startsWith('gemma4:12b:'));
          setOllamaProbe(hasGemma ? 'ready' : 'has_ollama_no_model');
        } else {
          setOllamaProbe('no_ollama');
        }
      } catch {
        setOllamaProbe('no_ollama');
      }
    })();
  }, []);

  // ── Mount: event subscriptions + SEG-V0150-P0-DIAGNOSE-BRIDGE probe ───────
  useEffect(() => {
    // Bridge probe diagnostic — readable via DevTools console or runDiagnostic log
    const w = window as Window & { __preloadLoaded?: boolean };
    console.log(
      '[BRIDGE-PROBE] typeof window.amplify =', typeof window.amplify,
      '\n[BRIDGE-PROBE] typeof window.amplify?.leanInstallStart =', typeof window.amplify?.leanInstallStart,
      '\n[BRIDGE-PROBE] typeof window.amplify?.onLeanInstallStatus =', typeof window.amplify?.onLeanInstallStatus,
      '\n[BRIDGE-PROBE] window.__preloadLoaded =', w.__preloadLoaded ?? false,
    );

    const unsub1 = window.amplify?.onLeanInstallStatus?.((data: { step: string; message: string }) => {
      statusReceivedRef.current = true;
      if (fallbackTimerRef.current) { clearTimeout(fallbackTimerRef.current); fallbackTimerRef.current = null; }
      setShowFallback(false);
      setInstallStep(data.step);
      setInstallMessage(data.message);
      if (data.step === 'done') {
        setCtaActive(false);
        onComplete();
      }
    });

    const unsub2 = window.amplify?.onLeanInstallProgress?.((data: typeof installProgress) => {
      setInstallProgress(data);
    });

    const unsub3 = window.amplify?.onLeanInstallError?.((data: { message: string; retryable: boolean }) => {
      setInstallError(data);
      setCtaActive(false);
      if (fallbackTimerRef.current) { clearTimeout(fallbackTimerRef.current); fallbackTimerRef.current = null; }
    });

    return () => {
      unsub1?.();
      unsub2?.();
      unsub3?.();
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── CTA click handler ──────────────────────────────────────────────────────

  const handleCta = async () => {
    if (ctaActive || ollamaProbe === 'probing') return;

    // "ready" state: Ollama + model already present — skip install, go directly
    if (ollamaProbe === 'ready') {
      const res = await window.amplify?.writeSkuTierSkip?.();
      if (res?.ok !== false) {
        onComplete();
      } else {
        setInstallError({ message: 'Could not write setup file. Try restarting the app.', retryable: false });
      }
      return;
    }

    setInstallError(null);
    setShowFallback(false);
    statusReceivedRef.current = false;
    setCtaActive(true);

    // 5-second fallback — if IPC never emits a status event
    fallbackTimerRef.current = setTimeout(() => {
      if (!statusReceivedRef.current) {
        setShowFallback(true);
        setCtaActive(false);
      }
    }, 5000);

    window.amplify?.leanInstallStart?.();
  };

  // ── Skip handler (fallback path + "I have Ollama" affordance) ─────────────

  const handleSkip = async () => {
    await window.amplify?.writeSkuTierSkip?.();
    onComplete();
  };

  // ── Shared styles ──────────────────────────────────────────────────────────

  const overlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 9600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0d1117',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    overflowY: 'auto',
    padding: '24px 16px',
  };

  const card: React.CSSProperties = {
    width: '100%',
    maxWidth: 520,
    padding: '36px 32px',
    background: '#111827',
    border: '1px solid rgba(100, 116, 139, 0.2)',
    borderRadius: 12,
  };

  const mutedText: React.CSSProperties = {
    fontSize: 12,
    color: '#475569',
    lineHeight: 1.5,
  };

  const bodyText: React.CSSProperties = {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 1.6,
    margin: '0 0 16px',
  };

  const featureLine: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 1.5,
    marginBottom: 8,
  };

  const dot: React.CSSProperties = {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'rgba(110, 231, 183, 0.5)',
    flexShrink: 0,
    marginTop: 5,
  };

  const ctaButton: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '14px 20px',
    background: ctaActive || ollamaProbe === 'probing' ? '#16803a' : '#22c55e',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 700,
    cursor: ctaActive || ollamaProbe === 'probing' ? 'not-allowed' : 'pointer',
    textAlign: 'center',
    marginBottom: 10,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    transition: 'background 150ms ease',
    opacity: ctaActive || ollamaProbe === 'probing' ? 0.75 : 1,
  };

  const tagline: React.CSSProperties = {
    textAlign: 'center',
    fontSize: 11,
    color: '#475569',
    marginBottom: 28,
  };

  const ghostLink: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: '#475569',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    padding: 0,
    textDecoration: 'underline',
    textDecorationColor: 'rgba(71,85,105,0.4)',
  };

  // ── Step cards ─────────────────────────────────────────────────────────────

  const stepCards = (
    <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
      {[
        { step: '1', label: 'Tell it something', body: 'Share context with your AI once.' },
        { step: '2', label: 'Come back later',   body: 'Start a fresh session any time.' },
        { step: '3', label: 'It remembers',      body: 'Your context loads automatically.' },
      ].map(({ step, label, body }) => (
        <div
          key={step}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(100,116,139,0.15)',
            borderRadius: 8,
            padding: '12px 10px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, color: '#6ee7b7', marginBottom: 4 }}>{step}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.4 }}>{body}</div>
        </div>
      ))}
    </div>
  );

  // ── Shared: install progress + fallback UI ─────────────────────────────────

  const installStatusBlock = (
    <>
      {installStep && installStep !== 'done' && (
        <div style={{ marginTop: 12, fontSize: '0.82rem', color: '#aaa', textAlign: 'center' }}>
          {installMessage}
          {installStep === 'pulling_model' && installProgress && (
            <div style={{ marginTop: 8 }}>
              <div style={{ background: '#1e2a1e', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                <div style={{
                  background: '#22c55e', height: '100%', borderRadius: 4,
                  width: `${installProgress.percentComplete.toFixed(1)}%`,
                  transition: 'width 0.5s ease'
                }} />
              </div>
              <div style={{ marginTop: 4, color: '#888', fontSize: '0.75rem' }}>
                {(installProgress.bytesDownloaded / 1e9).toFixed(2)} GB / {(installProgress.totalBytes / 1e9).toFixed(2)} GB
                · {installProgress.speedLabel}
                {installProgress.eta_s > 0 && ` · ~${Math.round(installProgress.eta_s / 60)}m left`}
              </div>
            </div>
          )}
          {installStep === 'waiting_ollama' && (
            <button
              style={{ marginTop: 8, padding: '6px 16px', background: '#2a3a2a', border: '1px solid #3d7a3d',
                borderRadius: 6, color: '#7dff7d', cursor: 'pointer', fontSize: '0.82rem' }}
              onClick={handleCta}
            >
              Resume after installing Ollama
            </button>
          )}
        </div>
      )}

      {/* SEG-V0150-P0-FIX-BRIDGE-OR-FALLBACK: 5-second fallback UI */}
      {showFallback && (
        <div style={{
          marginTop: 12, padding: '12px 14px', background: 'rgba(251,191,36,0.07)',
          border: '1px solid rgba(251,191,36,0.25)', borderRadius: 8,
          fontSize: '0.82rem', color: '#fbbf24', textAlign: 'center',
        }}>
          Setup is taking longer than expected.
          <div style={{ marginTop: 8, display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button
              style={{ padding: '6px 14px', background: '#1a2a1a', border: '1px solid #3d7a3d',
                borderRadius: 6, color: '#6ee7b7', cursor: 'pointer', fontSize: '0.8rem' }}
              onClick={handleCta}
            >
              Try again
            </button>
            <button
              style={{ padding: '6px 14px', background: 'rgba(100,116,139,0.15)', border: '1px solid rgba(100,116,139,0.3)',
                borderRadius: 6, color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem' }}
              onClick={handleSkip}
            >
              Skip · I have Ollama already
            </button>
          </div>
        </div>
      )}

      {installError && (
        <div style={{ marginTop: 8, fontSize: '0.78rem', color: '#f87171', textAlign: 'center' }}>
          {installError.message}
          {installError.retryable && (
            <button style={{ marginLeft: 8, color: '#f87171', background: 'none', border: 'none',
              cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => { setInstallError(null); void handleCta(); }}>
              Retry
            </button>
          )}
        </div>
      )}
    </>
  );

  // ── Screen 1: Download CTA ─────────────────────────────────────────────────

  if (screen === 1) {
    return (
      <div style={overlay}>
        <div style={card}>

          {/* Mascot */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <img
              src="icons/mnemosynec-mark.png"
              alt="MnemosyneC mascot"
              style={{ height: 72, width: 'auto', objectFit: 'contain' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>

          {/* Hero */}
          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            color: '#e2e8f0',
            lineHeight: 1.2,
            margin: '0 0 4px',
            textAlign: 'center',
          }}>
            Your AI has Amnesia.
          </h1>
          <h2 style={{
            fontSize: '1.4rem',
            fontWeight: 600,
            color: '#6ee7b7',
            lineHeight: 1.2,
            margin: '0 0 8px',
            textAlign: 'center',
          }}>
            Dr. MnemosyneC has the Cure.
          </h2>
          <p style={{ ...mutedText, textAlign: 'center', marginBottom: 24 }}>
            <em>(neh-MOZ-uh-nee)</em> · the Greek goddess of memory
          </p>

          {/* Body */}
          <p style={bodyText}>
            Every time you start a new session, your AI forgets everything. Your projects, your
            preferences, your past conversations · gone. Dr. MnemosyneC gives your AI a permanent,
            private memory that actually stays.
          </p>

          {/* Feature lines */}
          <div style={{ marginBottom: 24 }}>
            <div style={featureLine}>
              <span style={dot} />
              <span>Works alongside ChatGPT, Claude, Gemini, or any AI you already use.</span>
            </div>
            <div style={featureLine}>
              <span style={dot} />
              <span>All your data stays on your own computer. No cloud. No account required.</span>
            </div>
            <div style={featureLine}>
              <span style={dot} />
              <span>Free to use. A $5/year membership unlocks the full cooperative.</span>
            </div>
          </div>

          {/* 3-step explainer */}
          {stepCards}

          {/* SEG-V0150-P0-PROACTIVE: Adaptive CTA */}
          <button
            type="button"
            style={ctaButton}
            disabled={ctaActive || ollamaProbe === 'probing'}
            onClick={() => { void handleCta(); }}
            onMouseEnter={(e) => {
              if (!ctaActive && ollamaProbe !== 'probing')
                (e.currentTarget as HTMLButtonElement).style.background = '#16a34a';
            }}
            onMouseLeave={(e) => {
              if (!ctaActive && ollamaProbe !== 'probing')
                (e.currentTarget as HTMLButtonElement).style.background = '#22c55e';
            }}
          >
            {ctaLabelFor(ollamaProbe, ctaActive)}
          </button>

          {installStatusBlock}

          <p style={tagline}>Free forever · No ads · No strings · Data stays on your computer</p>

          {/* BP085 — Membership nudge on onboarding final step */}
          {!onboardingMemberNudgeDismissed && (
            <div className="onboarding-member-nudge" style={{
              background: 'rgba(6,95,70,0.12)',
              border: '1px solid rgba(5,150,105,0.3)',
              borderRadius: 8,
              padding: '12px 14px',
              marginBottom: 14,
              textAlign: 'center',
            }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, color: '#6ee7b7', lineHeight: 1.5 }}>
                Want to do more? Join the cooperative for $5/yr.
              </p>
              <button
                type="button"
                className="member-cta-secondary"
                onClick={handleMemberNudgeClick}
                style={{
                  background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
                  border: '1px solid #059669',
                  borderRadius: 6,
                  color: '#6ee7b7',
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '6px 14px',
                  cursor: 'pointer',
                  fontFamily: 'system-ui, sans-serif',
                  outline: 'none',
                  marginRight: 8,
                }}
              >
                Become a Member · $5/yr
              </button>
              <button
                type="button"
                className="skip-link"
                onClick={handleMemberNudgeDismiss}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#475569',
                  fontSize: 11,
                  cursor: 'pointer',
                  fontFamily: 'system-ui, sans-serif',
                  padding: 0,
                  textDecoration: 'underline',
                  textDecorationColor: 'rgba(71,85,105,0.4)',
                }}
              >
                Maybe later
              </button>
            </div>
          )}

          {/* Proof ghost link */}
          <div style={{ textAlign: 'center', borderTop: '1px solid rgba(100,116,139,0.12)', paddingTop: 14 }}>
            <button
              type="button"
              style={ghostLink}
              onClick={() => setScreen(2)}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#475569'; }}
            >
              Does it actually work? See the proof →
            </button>
          </div>

        </div>
      </div>
    );
  }

  // ── Screen 2: Benchmark proof ──────────────────────────────────────────────

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 600,
    color: '#6ee7b7',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    padding: '6px 10px',
    borderBottom: '1px solid rgba(100,116,139,0.2)',
    whiteSpace: 'nowrap',
  };

  const tdStyle: React.CSSProperties = {
    padding: '8px 10px',
    fontSize: 13,
    color: '#94a3b8',
    borderBottom: '1px solid rgba(100,116,139,0.08)',
  };

  const hotStyle: React.CSSProperties = {
    ...tdStyle,
    color: '#6ee7b7',
    fontWeight: 700,
  };

  const liftStyle: React.CSSProperties = {
    ...tdStyle,
    color: '#22c55e',
    fontWeight: 700,
  };

  return (
    <div style={overlay}>
      <div style={card}>

        {/* Back link */}
        <button
          type="button"
          style={{ ...ghostLink, marginBottom: 20, display: 'inline-block' }}
          onClick={() => setScreen(1)}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#475569'; }}
        >
          ← Back to Download
        </button>

        <h2 style={{
          fontSize: '1.4rem',
          fontWeight: 700,
          color: '#e2e8f0',
          margin: '0 0 10px',
        }}>
          Does it actually work?
        </h2>
        <p style={{ ...bodyText, marginBottom: 20 }}>
          75 questions · 4 AI vendors · real test run 2026-05-30. No tricks.
        </p>

        {/* Benchmark table
            Source: CADRE_BENCHMARK_RESULTS_BP067.md, Big-4 Baseline, lines 26-33
            BP063 · 2026-05-30 · Haiku-graded · kappa=0.936 */}
        <div style={{
          overflowX: 'auto',
          borderRadius: 8,
          border: '1px solid rgba(100,116,139,0.2)',
          marginBottom: 20,
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                <th style={thStyle}>Model</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>WITHOUT MnemosyneC</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>WITH MnemosyneC</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Lift</th>
              </tr>
            </thead>
            <tbody>
              {BENCHMARK_ROWS.map((row) => (
                <tr key={row.model} style={{ background: 'transparent' }}>
                  <td style={tdStyle}>{row.model}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{row.cold}</td>
                  <td style={{ ...hotStyle, textAlign: 'center' }}>{row.hot}</td>
                  <td style={{ ...liftStyle, textAlign: 'center' }}>{row.lift}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Banyan Metric explainer */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(100,116,139,0.12)',
          borderRadius: 8,
          padding: '14px 16px',
          marginBottom: 24,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6ee7b7', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
            Banyan Metric™: How We Measure
          </div>
          <p style={{ ...mutedText, margin: 0 }}>
            <strong style={{ color: '#94a3b8' }}>Accuracy</strong> = percentage of 75 factual questions
            answered correctly. <strong style={{ color: '#94a3b8' }}>COLD</strong> = standard AI session
            with no substrate loaded (what you get today).{' '}
            <strong style={{ color: '#94a3b8' }}>HOT</strong> = same AI with MnemosyneC substrate
            preloaded. Inter-rater kappa: 0.936 (near-perfect agreement). Test date: 2026-05-30.
            Results hash-verified at BP067. All four vendors tested independently.
          </p>
        </div>

        {/* CTA repeat — same adaptive logic */}
        <button
          type="button"
          style={ctaButton}
          disabled={ctaActive || ollamaProbe === 'probing'}
          onClick={() => { void handleCta(); }}
          onMouseEnter={(e) => {
            if (!ctaActive && ollamaProbe !== 'probing')
              (e.currentTarget as HTMLButtonElement).style.background = '#16a34a';
          }}
          onMouseLeave={(e) => {
            if (!ctaActive && ollamaProbe !== 'probing')
              (e.currentTarget as HTMLButtonElement).style.background = '#22c55e';
          }}
        >
          {ctaLabelFor(ollamaProbe, ctaActive)}
        </button>

        {installStatusBlock}

        <p style={tagline}>Free forever · No ads · No strings · Data stays on your computer</p>

      </div>
    </div>
  );
}

export default LeanWelcomeView;
