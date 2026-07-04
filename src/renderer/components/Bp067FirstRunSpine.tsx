// Bp067FirstRunSpine.tsx -- BP075 v0.1.26 minimal professional first-run
// SEG-R-1: WelcomeView (Amnesia headline + two-doorway cascade) is now step 'welcome'.
// Steps: welcome (WelcomeView) -> try-it -> success -> gauntlet -> first_steps -> app
// Preserved: askFloorModel elephant test, 3-option fallback, LS_BP067_FIRST_RUN_COMPLETE gate
// Removed: scroll-crawl animation, Founder voice audio, HEOHO blocking step, forced folder step

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GauntletProofStep } from './GauntletProofStep';
import { FirstStepsView } from './FirstStepsView';
import { WelcomeView, LS_ONBOARDING_COMPLETE } from './WelcomeView';

export const LS_BP067_FIRST_RUN_COMPLETE = 'mnemosyne-bp067-first-run-complete';
export const LS_SALTFIGHTER_SKIP = 'mnemosyne-saltfighter-skip';

const AUTO_TEST_PROMPT = 'What is the name of a famous elephant?';
const TRY_IT_TIMEOUT_MS = 30_000;

type Step = 'welcome' | 'try-it' | 'success' | 'gauntlet' | 'first_steps' | 'options' | 'folder';
type OptionState = 'idle' | 'retrying' | 'retry-ok' | 'retry-err' | 'borrowing' | 'borrow-result';

interface BorrowResult {
  ok: boolean;
  disclosure?: string;
  error?: string;
  cost_transport_usd?: number;
  node_count?: number;
}

export interface Bp067FirstRunSpineProps {
  onComplete: () => void;
  /** Called instead of plain onComplete when the user clicks "Ask it anything" on Step 3 success.
   *  Parent (MnemosyneTabView) uses this to fire setShowOnboardAsk(true) so the 3-option join
   *  funnel becomes reachable immediately after the AI proof moment. */
  onAskOnboard?: () => void;
}

function commitFirstRunDone(onComplete: () => void): void {
  try {
    localStorage.setItem(LS_BP067_FIRST_RUN_COMPLETE, 'true');
    localStorage.setItem(LS_ONBOARDING_COMPLETE, 'true');
  } catch { /* ignore storage errors */ }
  void window.amplify?.markBp067FirstRunComplete?.();
  onComplete();
}

// Inline green check SVG -- no external icon dep
function CheckIcon(): React.ReactElement {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="rgba(74,222,128,0.15)" stroke="#4ade80" strokeWidth="1.5" />
      <path d="M9 16.5l5 5 9-9" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Shared CSS injected once per mount
const KEYFRAMES = `@keyframes mnemo-spin { to { transform: rotate(360deg); } }`;

export function Bp067FirstRunSpine({ onComplete, onAskOnboard }: Bp067FirstRunSpineProps): React.ReactElement | null {
  const [step, setStep] = useState<Step>('welcome');
  const [visible, setVisible] = useState(true);

  // try-it state
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // options state
  const [optionState, setOptionState] = useState<OptionState>('idle');
  const [borrowResult, setBorrowResult] = useState<BorrowResult | null>(null);
  const [customModelPath, setCustomModelPath] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);

  // folder state
  const [folderPicked, setFolderPicked] = useState<string | null>(null);
  const [pickingFolder, setPickingFolder] = useState(false);

  // 200ms fade transition between steps
  const goTo = useCallback((next: Step): void => {
    setVisible(false);
    setTimeout(() => {
      setStep(next);
      setVisible(true);
    }, 200);
  }, []);

  // Auto-fire elephant test when entering try-it
  useEffect(() => {
    if (step !== 'try-it') return;
    let cancelled = false;
    setAsking(true);
    setAiResponse(null);

    timeoutRef.current = setTimeout(() => {
      if (!cancelled) {
        setAsking(false);
        goTo('options');
      }
    }, TRY_IT_TIMEOUT_MS);

    void (async (): Promise<void> => {
      try {
        const result = await window.amplify?.askFloorModel?.(AUTO_TEST_PROMPT);
        if (cancelled) return;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (result?.ok && result.text) {
          setAiResponse(result.text);
          setAsking(false);
          goTo('success');
        } else {
          setAsking(false);
          goTo('options');
        }
      } catch {
        if (cancelled) return;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setAsking(false);
        goTo('options');
      }
    })();

    return (): void => {
      cancelled = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [step, goTo]);

  const handleFinish = useCallback((): void => {
    commitFirstRunDone(onComplete);
  }, [onComplete]);

  // Step 3 "Ask it anything" -- completes first-run AND fires the 3-option join funnel modal.
  // Uses onAskOnboard if provided (wired by MnemosyneTabView to setShowOnboardAsk(true));
  // falls back to plain onComplete for backward compatibility.
  const handleAskOnboard = useCallback((): void => {
    commitFirstRunDone(onAskOnboard ?? onComplete);
  }, [onComplete, onAskOnboard]);

  const handlePickFolder = async (): Promise<void> => {
    setPickingFolder(true);
    try {
      const result = await window.amplify?.watcher?.openFolderDialog?.();
      if (result && !result.canceled && result.filePaths.length > 0) {
        setFolderPicked(result.filePaths[0]);
        void window.amplify?.watcher?.addFolder?.(result.filePaths[0]).catch((): void => {});
      }
    } catch { /* dialog unavailable */ }
    finally { setPickingFolder(false); }
  };

  const handleRetrySetup = async (): Promise<void> => {
    setOptionState('retrying');
    setRetryError(null);
    try {
      const result = await window.amplify?.setupPrivateAI?.();
      if (result?.ok) {
        setOptionState('retry-ok');
        setTimeout(() => goTo('try-it'), 800);
      } else {
        setRetryError(result?.error ?? 'Setup failed.');
        setOptionState('retry-err');
      }
    } catch {
      setRetryError('Could not start setup.');
      setOptionState('retry-err');
    }
  };

  const handleBorrow = async (): Promise<void> => {
    setOptionState('borrowing');
    setBorrowResult(null);
    try {
      const r = await window.amplify?.lbRequestFrontierBorrow?.();
      setBorrowResult(r ?? { ok: false, error: 'No response from mesh.' });
    } catch {
      setBorrowResult({ ok: false, error: 'Could not reach the mesh.' });
    } finally {
      setOptionState('borrow-result');
    }
  };

  // ── Shared style constants ─────────────────────────────────────────────────

  const overlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 9600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0d1117',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    opacity: visible ? 1 : 0,
    transition: 'opacity 200ms ease',
  };

  const card: React.CSSProperties = {
    width: '100%',
    maxWidth: 480,
    padding: '40px 36px',
    background: '#111827',
    border: '1px solid rgba(100,116,139,0.2)',
    borderRadius: 12,
    margin: '0 16px',
  };

  const brandLine: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    color: '#6ee7b7',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: 28,
  };

  const heading: React.CSSProperties = {
    fontSize: 22,
    fontWeight: 800,
    color: '#e2e8f0',
    lineHeight: 1.25,
    margin: '0 0 10px',
  };

  const body: React.CSSProperties = {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 1.7,
    margin: '0 0 28px',
  };

  const primaryBtn: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '13px 20px',
    background: 'rgba(110,231,183,0.13)',
    border: '1px solid rgba(110,231,183,0.4)',
    borderRadius: 8,
    color: '#6ee7b7',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'center',
    marginBottom: 12,
  };

  const ghostBtn: React.CSSProperties = {
    display: 'block',
    width: '100%',
    textAlign: 'center',
    background: 'none',
    border: 'none',
    color: '#475569',
    fontSize: 12,
    cursor: 'pointer',
    padding: '6px 0',
  };

  const footNote: React.CSSProperties = {
    fontSize: 11,
    color: '#334155',
    marginTop: 20,
    lineHeight: 1.6,
    textAlign: 'center',
  };

  const spinner: React.CSSProperties = {
    width: 22,
    height: 22,
    border: '2px solid rgba(110,231,183,0.2)',
    borderTopColor: '#6ee7b7',
    borderRadius: '50%',
    animation: 'mnemo-spin 0.8s linear infinite',
    display: 'inline-block',
  };

  const optionCard: React.CSSProperties = {
    marginBottom: 10,
    padding: '12px 14px',
    background: 'rgba(15,23,42,0.5)',
    border: '1px solid rgba(100,116,139,0.2)',
    borderRadius: 8,
  };

  // ── Step 1: Welcome (SEG-R-1 -- WelcomeView Amnesia headline + two-doorway cascade) ──

  if (step === 'welcome') {
    return (
      <WelcomeView onComplete={handleFinish} />
    );
  }

  // ── Step 2: Try it (auto elephant test fires in useEffect) ─────────────────

  if (step === 'try-it') {
    return (
      <>
        <style>{KEYFRAMES}</style>
        <div style={overlay}>
          <div style={{ ...card, textAlign: 'center' }}>
            <div style={brandLine}>MnemosyneC</div>
            <div style={{ marginBottom: 20 }}>
              <span style={spinner} />
            </div>
            <h2 style={{ ...heading, fontSize: 18 }}>
              {asking ? 'Asking your AI a quick question.' : 'Connecting...'}
            </h2>
            <p style={{ ...body, fontSize: 12 }}>
              &ldquo;{AUTO_TEST_PROMPT}&rdquo;
            </p>
          </div>
        </div>
      </>
    );
  }

  // ── Step 3: Success ──────────────────────────────────────────────────────────

  if (step === 'success') {
    return (
      <div style={overlay}>
        <div style={card}>
          <div style={{ marginBottom: 16 }}>
            <CheckIcon />
          </div>
          <h2 style={{ ...heading, fontSize: 20, marginBottom: 10 }}>Your AI works.</h2>
          {aiResponse && (
            <blockquote style={{
              borderLeft: '3px solid rgba(110,231,183,0.4)',
              margin: '0 0 18px',
              padding: '10px 14px',
              background: 'rgba(6,78,59,0.12)',
              borderRadius: '0 6px 6px 0',
              fontSize: 13,
              color: '#cbd5e1',
              lineHeight: 1.7,
              maxHeight: 140,
              overflowY: 'auto',
            }}>
              {aiResponse.slice(0, 600)}{aiResponse.length > 600 ? '...' : ''}
            </blockquote>
          )}
          <p style={{ ...body, fontSize: 13, marginBottom: 20 }}>
            Run a quick live check on included test data or your own folder and see what this install actually saves in speed, cost, and reach.
          </p>
          <button type="button" style={primaryBtn} onClick={(): void => goTo('gauntlet')}>
            See your proof
          </button>
          <button type="button" style={ghostBtn} onClick={handleAskOnboard}>
            Ask it anything
          </button>
        </div>
      </div>
    );
  }

  // ── Step 3b: Gauntlet mesh proof (Founder binding 2 -- optional, always skippable) ────

  if (step === 'gauntlet') {
    return (
      <GauntletProofStep
        audience="new_user"
        fromFirstRun={true}
        onOpenModeSelect={() => {}}
        onOpenFrame={handleAskOnboard}
        onRunProof={() => {}}
        onJoin={(): void => { goTo('first_steps'); }}
        onKeepUsing={handleAskOnboard}
      />
    );
  }

  // ── Step 3c: Intent capture + $5 checkout (FirstStepsView) ───────────────────

  if (step === 'first_steps') {
    return (
      <FirstStepsView
        onSelectIntent={() => {}}
        onCheckout={() => {}}
        onRoutePath={handleAskOnboard}
      />
    );
  }

  // ── Step 4: Options (shown on error or timeout) ─────────────────────────────

  if (step === 'options') {
    return (
      <>
        <style>{KEYFRAMES}</style>
        <div style={overlay}>
          <div style={{ ...card, maxWidth: 500 }}>
            <div style={brandLine}>MnemosyneC</div>
            <h2 style={{ ...heading, fontSize: 18, marginBottom: 8 }}>{"Let's try a different way."}</h2>
            <p style={{ ...body, fontSize: 12, marginBottom: 20 }}>
              The AI did not respond. Choose how to continue.
            </p>

            {/* Option A -- Use bundled AI */}
            <div style={{ ...optionCard, border: '1px solid rgba(110,231,183,0.22)', background: 'rgba(6,78,59,0.1)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6ee7b7', marginBottom: 4 }}>
                A -- Use the bundled AI
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10, lineHeight: 1.5 }}>
                Retry local Ollama engine setup. Private, free, works offline.
              </div>
              {optionState === 'retrying' && (
                <div style={{ fontSize: 11, color: '#6ee7b7', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={spinner} />
                  Setting up...
                </div>
              )}
              {optionState === 'retry-ok' && (
                <div style={{ fontSize: 11, color: '#4ade80', marginBottom: 8 }}>Setup succeeded. Retrying test...</div>
              )}
              {retryError && (
                <div style={{ fontSize: 11, color: '#f87171', marginBottom: 8 }}>{retryError}</div>
              )}
              {optionState !== 'retrying' && optionState !== 'retry-ok' && (
                <button
                  type="button"
                  onClick={(): void => { void handleRetrySetup(); }}
                  style={{ padding: '6px 14px', background: 'rgba(110,231,183,0.12)', border: '1px solid rgba(110,231,183,0.3)', borderRadius: 6, color: '#6ee7b7', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                >
                  {optionState === 'retry-err' ? 'Try again' : 'Start bundled AI'}
                </button>
              )}
            </div>

            {/* Option B -- Borrow a frontier node */}
            <div style={optionCard}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>
                {"B -- Borrow a trusted friend\u2019s node"}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10, lineHeight: 1.5 }}>
                Use a Frontier node shared by a community member. Small transport fee may apply.
              </div>
              {optionState === 'borrowing' && (
                <div style={{ fontSize: 11, color: '#60a5fa', marginBottom: 8 }}>Contacting the mesh...</div>
              )}
              {optionState === 'borrow-result' && borrowResult && (
                <div style={{
                  marginBottom: 8, padding: '8px 10px',
                  background: borrowResult.ok ? 'rgba(59,130,246,0.1)' : 'rgba(239,68,68,0.08)',
                  border: `1px solid ${borrowResult.ok ? 'rgba(59,130,246,0.3)' : 'rgba(239,68,68,0.25)'}`,
                  borderRadius: 6, fontSize: 11,
                  color: borrowResult.ok ? '#93c5fd' : '#fca5a5',
                  lineHeight: 1.6,
                }}>
                  {borrowResult.ok
                    ? `Connected to ${borrowResult.node_count ?? 1} node${(borrowResult.node_count ?? 1) !== 1 ? 's' : ''}. ${borrowResult.disclosure ?? ''}`
                    : (borrowResult.error ?? 'Could not reach a frontier node.')}
                </div>
              )}
              {optionState !== 'borrowing' && (
                <button
                  type="button"
                  onClick={(): void => { void handleBorrow(); }}
                  style={{ padding: '6px 14px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 6, color: '#60a5fa', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                >
                  {optionState === 'borrow-result' ? 'Try again' : 'Request a frontier node'}
                </button>
              )}
            </div>

            {/* Option C -- Choose a different AI folder */}
            <div style={{ ...optionCard, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', marginBottom: 4 }}>
                C -- Choose a different AI folder
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10, lineHeight: 1.5 }}>
                Point to a folder where you have Ollama models already downloaded.
              </div>
              {customModelPath && (
                <div style={{ marginBottom: 8, padding: '6px 10px', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 6, fontSize: 10, color: '#c4b5fd', wordBreak: 'break-all' }}>
                  {customModelPath}
                </div>
              )}
              <button
                type="button"
                onClick={(): void => {
                  void (async (): Promise<void> => {
                    try {
                      const result = await window.amplify?.watcher?.openFolderDialog?.();
                      if (result && !result.canceled && result.filePaths.length > 0) {
                        setCustomModelPath(result.filePaths[0]);
                      }
                    } catch { /* dialog unavailable */ }
                  })();
                }}
                style={{ padding: '6px 14px', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 6, color: '#a78bfa', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
              >
                {customModelPath ? 'Choose different folder' : 'Browse for model folder'}
              </button>
            </div>

            <button type="button" style={ghostBtn} onClick={handleFinish}>
              Continue without AI for now
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── Optional Step 5: Folder picker (reached from success tertiary link) ──────

  if (step === 'folder') {
    return (
      <>
        <style>{KEYFRAMES}</style>
        <div style={overlay}>
          <div style={card}>
            <div style={brandLine}>MnemosyneC</div>
            <h2 style={{ ...heading, fontSize: 18, marginBottom: 8 }}>
              {"Add a folder to your AI\u2019s memory."}
            </h2>
            <p style={{ ...body, fontSize: 13, marginBottom: 20 }}>
              Pick any folder and your AI will remember everything in it -- notes, documents, projects.
              Stays private on your computer. You can add more in Settings.
            </p>
            {folderPicked ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, padding: '10px 12px', background: 'rgba(6,78,59,0.15)', border: '1px solid rgba(110,231,183,0.3)', borderRadius: 6, fontSize: 12, color: '#6ee7b7' }}>
                <span>+</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {folderPicked}
                </span>
                <button
                  type="button"
                  onClick={(): void => setFolderPicked(null)}
                  style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 14, padding: 0 }}
                >
                  {'×'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={(): void => { void handlePickFolder(); }}
                disabled={pickingFolder}
                style={{ display: 'block', width: '100%', padding: '12px 14px', marginBottom: 20, background: 'rgba(59,130,246,0.07)', border: '1px dashed rgba(59,130,246,0.35)', borderRadius: 8, color: '#60a5fa', fontSize: 13, fontWeight: 600, cursor: pickingFolder ? 'not-allowed' : 'pointer', textAlign: 'center' }}
              >
                {pickingFolder ? 'Opening...' : 'Choose a folder'}
              </button>
            )}
            <button type="button" style={primaryBtn} onClick={handleFinish}>
              {folderPicked ? 'Done -- open the app' : 'Open the app'}
            </button>
            <button type="button" style={ghostBtn} onClick={handleFinish}>
              Skip for now
            </button>
          </div>
        </div>
      </>
    );
  }

  return null;
}

export default Bp067FirstRunSpine;
