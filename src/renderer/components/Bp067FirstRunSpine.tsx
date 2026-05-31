// Bp067FirstRunSpine.tsx — BP067 v0.1.24 one-spine first-run (supersedes multi-screen SaltFighter + wizard)
// Sequence: transparent install → SaltFighter cover → value → ask→answer → optional folder → main app
// Canon: Asteroid-ProofVault/BP067_v0124_INSTALL_ONBOARDING_SPEC.md

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UPGRADE_MODELS } from '../../shared/floor-model';

export const LS_BP067_FIRST_RUN_COMPLETE = 'mnemosyne-bp067-first-run-complete';
export const LS_SALTFIGHTER_SKIP = 'mnemosyne-saltfighter-skip';

type SpinePhase = 'install' | 'cover' | 'value' | 'ask' | 'folder' | 'upgrades';

interface EngineSetupProgress {
  step: string;
  message: string;
  detail?: string;
  percentComplete?: number;
}

interface Bp067FirstRunSpineProps {
  onComplete: () => void;
}

const SALTFIGHTER_TEXT =
  'Greetings, SaltFighter!\n\n' +
  'Your AI remembers you.\n' +
  'Your questions stay on your computer.\n' +
  'Private. Free. Yours.\n\n' +
  'Free to use. Better to join. Share and Save.';

const SAMPLE_PROMPTS = [
  'What can you help me with?',
  'Write a short grocery list for tacos.',
  'Explain what makes this AI private.',
];

export function Bp067FirstRunSpine({ onComplete }: Bp067FirstRunSpineProps) {
  const [phase, setPhase] = useState<SpinePhase>('install');
  const [installLines, setInstallLines] = useState<EngineSetupProgress[]>([]);
  const [installError, setInstallError] = useState<string | null>(null);
  const [installDone, setInstallDone] = useState(false);
  const [doNotShowAgain, setDoNotShowAgain] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [folderPicked, setFolderPicked] = useState<string | null>(null);
  const [pickingFolder, setPickingFolder] = useState(false);
  const [showUpgrades, setShowUpgrades] = useState(false);
  const crawlRef = useRef<HTMLDivElement | null>(null);
  const askInputRef = useRef<HTMLInputElement | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Phase 0: transparent install ─────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'install') return;

    let cleanupProgress: (() => void) | undefined;

    const run = async () => {
      cleanupProgress = window.amplify?.onEngineSetupProgress?.((p: EngineSetupProgress) => {
        setInstallLines((prev) => {
          const last = prev[prev.length - 1];
          if (last?.message === p.message) return prev;
          return [...prev, p];
        });
        if (p.step === 'ready') setInstallDone(true);
        if (p.step === 'error') setInstallError(p.detail ?? p.message);
      });

      const result = await window.amplify?.setupPrivateAI?.();
      if (!result?.ok) {
        setInstallError(result?.error ?? 'Setup failed');
        return;
      }
      setInstallDone(true);
      setTimeout(() => setPhase('cover'), 600);
    };

    void run();
    return () => cleanupProgress?.();
  }, [phase]);

  // ─── SaltFighter cover: auto-advance ~8s ────────────────────────────────────
  useEffect(() => {
    if (phase !== 'cover') return;

    try {
      const audio = new Audio('greetings_saltfighter.m4a');
      audio.volume = 0.7;
      audio.play().catch(() => {});
    } catch { /* audio optional */ }

    if (crawlRef.current) {
      const el = crawlRef.current;
      let frame = 0;
      const animate = () => {
        el.scrollTop += 0.4;
        frame = requestAnimationFrame(animate);
      };
      frame = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(frame);
    }
    return undefined;
  }, [phase]);

  useEffect(() => {
    if (phase !== 'cover') return;
    autoAdvanceRef.current = setTimeout(() => {
      if (doNotShowAgain) {
        finishSpine();
      } else {
        setPhase('value');
      }
    }, 8000);
    return () => {
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    };
  }, [phase, doNotShowAgain]);

  useEffect(() => {
    if (phase === 'ask') {
      askInputRef.current?.focus();
    }
  }, [phase]);

  const finishSpine = useCallback(() => {
    try {
      localStorage.setItem(LS_BP067_FIRST_RUN_COMPLETE, 'true');
      if (doNotShowAgain) localStorage.setItem(LS_SALTFIGHTER_SKIP, 'true');
    } catch { /* ignore */ }
    void window.amplify?.markBp067FirstRunComplete?.();
    onComplete();
  }, [doNotShowAgain, onComplete]);

  const handleSkipCover = () => {
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    if (doNotShowAgain) {
      finishSpine();
    } else {
      setPhase('value');
    }
  };

  const handleAsk = async () => {
    const q = question.trim();
    if (!q || asking) return;
    setAsking(true);
    setAskError(null);
    try {
      const result = await window.amplify?.askFloorModel?.(q);
      if (result?.ok && result.text) {
        setAnswer(result.text);
        setPhase('folder');
      } else {
        setAskError(result?.error ?? 'Could not get an answer. Try again in a moment.');
      }
    } catch {
      setAskError('Something went wrong. Try again in a moment.');
    } finally {
      setAsking(false);
    }
  };

  const handlePickFolder = async () => {
    setPickingFolder(true);
    try {
      const result = await window.amplify?.watcher?.openFolderDialog?.();
      if (result && !result.canceled && result.filePaths.length > 0) {
        setFolderPicked(result.filePaths[0]);
        await window.amplify?.watcher?.addFolder?.(result.filePaths[0]).catch(() => {});
      }
    } catch { /* dialog unavailable */ }
    finally { setPickingFolder(false); }
  };

  const handleFolderDone = () => {
    setShowUpgrades(true);
    setPhase('upgrades');
  };

  const overlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 9600,
    background: '#0a0f1a',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    overflow: 'hidden',
  };

  // ─── Install screen ─────────────────────────────────────────────────────────
  if (phase === 'install') {
    return (
      <div style={overlay}>
        <div style={{ flex: 1, padding: '48px 56px', maxWidth: 560, margin: '0 auto', width: '100%' }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#e2e8f0', marginBottom: 8 }}>
            Setting up your private AI engine
          </h1>
          <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7, marginBottom: 28 }}>
            MnemosyneC runs on Ollama, a free, open-source AI engine that runs entirely on your computer.
            Your questions and files never leave your machine. Free, forever.
          </p>
          <div style={{ fontSize: 12, color: '#64748b', lineHeight: 2.2, fontFamily: 'monospace' }}>
            {installLines.map((line, i) => (
              <div key={i} style={{ color: line.step === 'error' ? '#f87171' : line.step === 'ready' ? '#4ade80' : '#94a3b8' }}>
                {line.message}
              </div>
            ))}
            {!installDone && !installError && (
              <div style={{ color: '#475569' }}>Almost ready…</div>
            )}
          </div>
          {installError && (
            <div style={{ marginTop: 20, padding: 14, background: 'rgba(239,68,68,0.1)', borderRadius: 8, color: '#fca5a5', fontSize: 12 }}>
              {installError}
              <div style={{ marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => { setInstallError(null); setInstallLines([]); void window.amplify?.setupPrivateAI?.(); }}
                  style={{ padding: '6px 14px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#fca5a5', cursor: 'pointer' }}
                >
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── SaltFighter cover ──────────────────────────────────────────────────────
  if (phase === 'cover') {
    return (
      <div style={{ ...overlay, background: '#000' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 40%, rgba(30,60,120,0.5) 0%, #000 70%)' }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px 60px', position: 'relative' }}>
          <div ref={crawlRef} style={{ width: '100%', maxWidth: 600, height: 320, overflow: 'hidden', maskImage: 'linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)' }}>
            <p style={{ fontSize: 17, fontWeight: 500, color: '#6ee7b7', textAlign: 'center', lineHeight: 2, whiteSpace: 'pre-line', marginBottom: 200 }}>
              {SALTFIGHTER_TEXT}
            </p>
          </div>
        </div>
        <div style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(110,231,183,0.15)', background: 'rgba(0,0,0,0.8)' }}>
          <span style={{ fontSize: 10, color: '#334155' }}>Welcome · MnemosyneC</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, color: '#475569' }}>
              <input type="checkbox" checked={doNotShowAgain} onChange={(e) => setDoNotShowAgain(e.target.checked)} style={{ accentColor: '#6ee7b7' }} />
              Don&apos;t show again
            </label>
            <button type="button" onClick={handleSkipCover} style={{ padding: '8px 20px', background: 'transparent', border: '1px solid rgba(100,116,139,0.3)', borderRadius: 6, color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>
              Skip → open the app
            </button>
            <button type="button" onClick={() => { if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current); setPhase('value'); }} style={{ padding: '8px 24px', background: 'rgba(110,231,183,0.12)', border: '1px solid rgba(110,231,183,0.4)', borderRadius: 6, color: '#6ee7b7', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Continue →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Value screen ───────────────────────────────────────────────────────────
  if (phase === 'value') {
    return (
      <div style={overlay}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
          <div style={{ maxWidth: 480, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#e2e8f0', lineHeight: 1.25, marginBottom: 16 }}>
              An AI that&apos;s yours.
            </div>
            <div style={{ fontSize: 18, color: '#94a3b8', lineHeight: 1.6, marginBottom: 32 }}>
              Private. Free. Remembers your stuff.
            </div>
            <button
              type="button"
              onClick={() => setPhase('ask')}
              style={{ padding: '14px 32px', background: 'rgba(110,231,183,0.15)', border: '1px solid rgba(110,231,183,0.4)', borderRadius: 8, color: '#6ee7b7', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
            >
              Get started →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Ask box (instant payoff) ───────────────────────────────────────────────
  if (phase === 'ask') {
    return (
      <div style={overlay}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
          <div style={{ maxWidth: 520, width: '100%' }}>
            <label htmlFor="bp067-ask" style={{ display: 'block', fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>
              Ask me anything:
            </label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                id="bp067-ask"
                ref={askInputRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleAsk(); }}
                placeholder="Try: What can you help me with?"
                disabled={asking}
                style={{ flex: 1, padding: '12px 14px', background: '#111827', border: '1px solid rgba(110,231,183,0.3)', borderRadius: 8, color: '#e2e8f0', fontSize: 14 }}
              />
              <button
                type="button"
                onClick={() => void handleAsk()}
                disabled={asking || !question.trim()}
                style={{ padding: '12px 20px', background: 'rgba(110,231,183,0.15)', border: '1px solid rgba(110,231,183,0.4)', borderRadius: 8, color: '#6ee7b7', fontWeight: 700, cursor: asking ? 'wait' : 'pointer', opacity: asking || !question.trim() ? 0.6 : 1 }}
              >
                {asking ? '…' : 'Ask'}
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {SAMPLE_PROMPTS.map((p) => (
                <button key={p} type="button" onClick={() => setQuestion(p)} style={{ fontSize: 10, padding: '4px 10px', background: 'rgba(100,116,139,0.15)', border: '1px solid rgba(100,116,139,0.25)', borderRadius: 12, color: '#94a3b8', cursor: 'pointer' }}>
                  {p}
                </button>
              ))}
            </div>
            {askError && <div style={{ fontSize: 12, color: '#f87171', marginTop: 8 }}>{askError}</div>}
          </div>
        </div>
      </div>
    );
  }

  // ─── Optional folder (after first answer) ───────────────────────────────────
  if (phase === 'folder') {
    return (
      <div style={overlay}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
          <div style={{ maxWidth: 520, width: '100%' }}>
            {answer && (
              <div style={{ marginBottom: 24, padding: 16, background: 'rgba(6,78,59,0.15)', border: '1px solid rgba(110,231,183,0.25)', borderRadius: 8, fontSize: 13, color: '#cbd5e1', lineHeight: 1.6, maxHeight: 120, overflow: 'auto' }}>
                {answer.slice(0, 500)}{answer.length > 500 ? '…' : ''}
              </div>
            )}
            <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>
              Want me to remember your stuff — recipes, schedules, documents?
            </div>
            <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7, marginBottom: 20 }}>
              Point me at a folder. I&apos;ll keep it private. Optional — you can always do this later in Settings.
            </p>
            {folderPicked ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(6,78,59,0.15)', borderRadius: 6, fontSize: 11, color: '#6ee7b7', marginBottom: 16 }}>
                <span>✓</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folderPicked}</span>
              </div>
            ) : (
              <button type="button" onClick={() => void handlePickFolder()} disabled={pickingFolder} style={{ width: '100%', padding: 12, marginBottom: 16, background: 'rgba(59,130,246,0.08)', border: '1px dashed rgba(59,130,246,0.35)', borderRadius: 8, color: '#60a5fa', fontWeight: 600, cursor: 'pointer' }}>
                {pickingFolder ? 'Opening…' : 'Choose a folder'}
              </button>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={handleFolderDone} style={{ padding: '10px 18px', background: 'none', border: '1px solid rgba(100,116,139,0.25)', borderRadius: 6, color: '#64748b', cursor: 'pointer' }}>
                Not now
              </button>
              <button type="button" onClick={handleFolderDone} style={{ padding: '10px 24px', background: 'rgba(110,231,183,0.12)', border: '1px solid rgba(110,231,183,0.35)', borderRadius: 6, color: '#6ee7b7', fontWeight: 600, cursor: 'pointer' }}>
                Open the app →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Optional upgrades (after proof) ──────────────────────────────────────
  if (phase === 'upgrades' && showUpgrades) {
    return (
      <div style={overlay}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
          <div style={{ maxWidth: 480, textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>
              Now that you see it works — want it even smarter?
            </div>
            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 24, lineHeight: 1.6 }}>
              Optional. Your current brain works fine. Upgrade anytime in Settings.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 24 }}>
              <button type="button" style={{ padding: '10px 16px', background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.25)', borderRadius: 8, color: '#94a3b8', fontSize: 12, cursor: 'default' }} title="Available in Settings → AI">
                {UPGRADE_MODELS.good.label}
              </button>
              <button type="button" style={{ padding: '10px 16px', background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.25)', borderRadius: 8, color: '#94a3b8', fontSize: 12, cursor: 'default' }} title="Available in Settings → AI">
                {UPGRADE_MODELS.great.label}
              </button>
            </div>
            <button type="button" onClick={finishSpine} style={{ padding: '12px 28px', background: 'rgba(110,231,183,0.15)', border: '1px solid rgba(110,231,183,0.4)', borderRadius: 8, color: '#6ee7b7', fontWeight: 700, cursor: 'pointer' }}>
              I&apos;m good — open MnemosyneC →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default Bp067FirstRunSpine;
