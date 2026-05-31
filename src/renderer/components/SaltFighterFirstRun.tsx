// SaltFighterFirstRun.tsx — First-run onboarding sequence
// BP067 Phase 1B · MnemosyneC v0.1.23
//
// Sequence (shown once, on first launch):
//   Screen 1 — SaltFighter cover: scrolling text crawl + "Do not show again" checkbox
//   Screen 2 — HEOHO: Help Each Other Help Ourselves + 16 initiatives + Join CTA
//   Screen 3 — Now What? / Pick a Folder: progressive disclosure + folder picker
//
// Gate: localStorage 'mnemosyne-saltfighter-done'
// Audio: greetings_saltfighter.m4a (Founder voice — plays on Screen 1 if file present)
// Canon: canon_saltfighter_brand_last_starfighter_trope_re_purposed_for_mnemosyne_recruitment_bp060

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── 16 Initiatives ───────────────────────────────────────────────────────────

const INITIATIVES = [
  "Let's Make Dinner — cooperative meal-planning and home-chef coordination",
  "Let's Get Groceries — group grocery procurement and cooperative bulk purchasing",
  "Let's Go Shopping — cooperative retail and community-commerce platform",
  "Household Concierge — home-services coordination and domestic-task marketplace",
  "The Family Table — intergenerational family connection and shared resources",
  "Tatiana Schlossburg Health Accords — cooperative healthcare access and wellness",
  "MSA — Medical Savings Accounts; cooperative healthcare-cost sharing",
  "Defense Klaus — cooperative protective services and loved-ones safety network",
  "Rally Group — community organizing and collective-action mobilization",
  "VSL — Very Short Loans; cooperative microfinance and peer-lending",
  "Let's Make Bread — cooperative artisan food production and local baking",
  "Harper Guild — cooperative creative guild for writers, artists, and creators",
  "JukeBox — cooperative music and entertainment; artist-owned distribution",
  "Didasko — cooperative education marketplace; tutor-to-learner knowledge sharing",
  "Power to the People — cooperative civic participation and grassroots organizing",
  "Brass Tacks — foundational cooperative-labor coordination and worker-ownership",
];

// ─── Scrolling Text Crawl ─────────────────────────────────────────────────────

const SALTFIGHTER_TEXT =
  "Greetings, SaltFighter!\n\n" +
  "You have been recruited by the Cooperative to defend the frontier against\n" +
  "X-traction and the Profit Armada.\n\n" +
  "The Frontier is not a metaphor for what we hope to build.\n" +
  "It is the architecture that is already running.\n\n" +
  "Your AI remembers you.\n" +
  "Your neighbors can answer your questions.\n" +
  "The Cooperative protects what you build.\n\n" +
  "Free to use. Better to join. Share and Save.\n\n" +
  "Help each other help ourselves.";

// ─── Props ────────────────────────────────────────────────────────────────────

interface SaltFighterFirstRunProps {
  onComplete: () => void;
  onJoin: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SaltFighterFirstRun({ onComplete, onJoin }: SaltFighterFirstRunProps) {
  const [screen, setScreen] = useState<1 | 2 | 3>(1);
  const [doNotShowAgain, setDoNotShowAgain] = useState(false);
  const [folderPicked, setFolderPicked] = useState<string | null>(null);
  const [pickingFolder, setPickingFolder] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const crawlRef = useRef<HTMLDivElement | null>(null);

  // Attempt to play SaltFighter audio on screen 1
  useEffect(() => {
    if (screen !== 1) return;
    try {
      const audio = new Audio();
      audio.src = 'greetings_saltfighter.m4a';
      audio.volume = 0.7;
      audio.play().catch(() => {});
      audioRef.current = audio;
    } catch { /* audio unavailable — fail silently */ }
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [screen]);

  // Auto-scroll the crawl text on screen 1
  useEffect(() => {
    if (screen !== 1 || !crawlRef.current) return;
    const el = crawlRef.current;
    let frame = 0;
    const speed = 0.4;
    const animate = () => {
      el.scrollTop += speed;
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [screen]);

  const advance = useCallback(() => {
    audioRef.current?.pause();
    // 1B-FIX: "Do not show again" checked on screen 1 → skip straight to app
    if (screen === 1 && doNotShowAgain) {
      onComplete();
      return;
    }
    if (screen < 3) {
      setScreen((s) => (s + 1) as 1 | 2 | 3);
    } else {
      onComplete();
    }
  }, [screen, doNotShowAgain, onComplete]);

  const handlePickFolder = async () => {
    setPickingFolder(true);
    try {
      const result = await window.amplify?.watcher?.openFolderDialog?.();
      if (result && !result.canceled && result.filePaths.length > 0) {
        setFolderPicked(result.filePaths[0]);
        // Optionally add the folder to the watcher
        window.amplify?.watcher?.addFolder?.(result.filePaths[0]).catch(() => {});
      }
    } catch { /* dialog unavailable */ }
    finally { setPickingFolder(false); }
  };

  const sharedOverlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 9500,
    background: '#000',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    overflow: 'hidden',
  };

  // ─── Screen 1: SaltFighter Cover ─────────────────────────────────────────────
  if (screen === 1) {
    return (
      <div style={sharedOverlay}>
        {/* Star field background */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 50% 40%, rgba(30,60,120,0.5) 0%, #000 70%)',
        }} />

        {/* Scrolling text crawl — Last Starfighter style */}
        <div style={{
          flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column',
          justifyContent: 'center', alignItems: 'center', padding: '40px 60px',
        }}>
          <div
            ref={crawlRef}
            style={{
              width: '100%',
              maxWidth: 600,
              overflowY: 'hidden',
              height: 340,
              position: 'relative',
              maskImage: 'linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)',
            }}
          >
            <p style={{
              fontSize: 17,
              fontWeight: 500,
              color: '#6ee7b7',
              textAlign: 'center',
              lineHeight: 2.0,
              whiteSpace: 'pre-line',
              marginBottom: 200,
            }}>
              {SALTFIGHTER_TEXT}
            </p>
          </div>

          {/* Brand mark */}
          <div style={{
            marginTop: 16,
            fontSize: 11,
            color: 'rgba(110,231,183,0.4)',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
          }}>
            Liana Banyan · Mnemosyne™ · The Cooperative
          </div>
        </div>

        {/* Footer bar */}
        <div style={{
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid rgba(110,231,183,0.15)',
          background: 'rgba(0,0,0,0.8)',
          flexShrink: 0,
        }}>
          {/* "Do not show again" checkbox — LOWER-RIGHT per spec */}
          <div style={{ fontSize: 10, color: '#334155' }}>
            First launch · SaltFighter welcome
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, color: '#475569' }}>
              <input
                type="checkbox"
                checked={doNotShowAgain}
                onChange={(e) => setDoNotShowAgain(e.target.checked)}
                style={{ accentColor: '#6ee7b7' }}
              />
              Do not show again
            </label>

            <button
              onClick={advance}
              style={{
                padding: '8px 24px',
                background: 'rgba(110,231,183,0.12)',
                border: '1px solid rgba(110,231,183,0.4)',
                borderRadius: 6,
                color: '#6ee7b7',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                letterSpacing: '0.03em',
              }}
            >
              Enter →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Screen 2: HEOHO — Help Each Other Help Ourselves ─────────────────────

  if (screen === 2) {
    return (
      <div style={{ ...sharedOverlay, background: '#0a0f1a' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '36px 48px 24px' }}>
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            {/* Title */}
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6ee7b7', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>
                The Cooperative
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#e2e8f0', lineHeight: 1.2, marginBottom: 10 }}>
                Help Each Other Help Ourselves
              </div>
              <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
                Mnemosyne™ is the first app of a cooperative ecosystem built to put
                economic power back in the hands of everyday people.
                Sixteen initiatives. One cooperative. You own a piece of it for $5/year.
              </div>
            </div>

            {/* Initiatives grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 8,
              marginBottom: 28,
            }}>
              {INITIATIVES.map((init, i) => {
                const [name, ...rest] = init.split(' — ');
                return (
                  <div key={i} style={{
                    background: 'rgba(15,23,42,0.6)',
                    border: '1px solid rgba(100,116,139,0.15)',
                    borderRadius: 8,
                    padding: '10px 12px',
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', marginBottom: 2 }}>
                      {i + 1}. {name}
                    </div>
                    <div style={{ fontSize: 9, color: '#475569', lineHeight: 1.5 }}>
                      {rest.join(' — ')}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Join CTA */}
            <div style={{
              background: 'rgba(6,78,59,0.15)',
              border: '1px solid rgba(110,231,183,0.25)',
              borderRadius: 10,
              padding: '18px 20px',
              marginBottom: 16,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>
                Become a founding member — $5/year
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 14, lineHeight: 1.6 }}>
                Your $5 holds a seat at the cooperative table. Free to use, better to join.
              </div>
              <button
                onClick={() => { onJoin(); }}
                style={{
                  padding: '10px 28px',
                  background: 'rgba(110,231,183,0.12)',
                  border: '1px solid rgba(110,231,183,0.4)',
                  borderRadius: 8,
                  color: '#6ee7b7',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginRight: 10,
                }}
              >
                Join for $5/year →
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderTop: '1px solid rgba(100,116,139,0.15)', background: 'rgba(0,0,0,0.6)', flexShrink: 0,
        }}>
          <button
            onClick={() => setScreen(1)}
            style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 12 }}
          >
            ← Back
          </button>
          <button
            onClick={advance}
            style={{
              padding: '8px 24px', background: 'rgba(110,231,183,0.1)',
              border: '1px solid rgba(110,231,183,0.3)', borderRadius: 6,
              color: '#6ee7b7', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Continue →
          </button>
        </div>
      </div>
    );
  }

  // ─── Screen 3: Now What? / Pick a Folder ────────────────────────────────────

  return (
    <div style={{ ...sharedOverlay, background: '#0a0f1a' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '48px 64px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: 560, width: '100%' }}>
          {/* Headline */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0', lineHeight: 1.25, marginBottom: 12 }}>
              Never Repeat Yourself to Your AI Again
            </div>
            <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.8 }}>
              Pick a folder — whatever you put in it becomes the basis of YOUR account and memory.
              Just talk to your AI and ask questions about your own stuff.
              When you <strong style={{ color: '#94a3b8' }}>Connect</strong> to the Cooperative network,
              answers come back faster, better, and cheaper.
            </div>
          </div>

          {/* Folder picker card */}
          <div style={{
            background: 'rgba(15,23,42,0.6)',
            border: '1px solid rgba(100,116,139,0.2)',
            borderRadius: 10,
            padding: '20px 24px',
            marginBottom: 20,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>
              📂 Pick your first folder
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 14, lineHeight: 1.6 }}>
              This is where your AI will look when you ask it questions.
              Start with Documents, or any folder of your notes, photos, or projects.
              You can add more later.
            </div>

            {folderPicked ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(6,78,59,0.15)', border: '1px solid rgba(110,231,183,0.25)',
                borderRadius: 6, padding: '8px 12px', fontSize: 11, color: '#6ee7b7',
              }}>
                <span>✓</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                  {folderPicked.split(/[\\/]/).slice(-2).join('/')}
                </span>
                <button
                  onClick={() => setFolderPicked(null)}
                  style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 12 }}
                >
                  ×
                </button>
              </div>
            ) : (
              <button
                onClick={handlePickFolder}
                disabled={pickingFolder}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: pickingFolder ? 'rgba(100,116,139,0.06)' : 'rgba(59,130,246,0.08)',
                  border: '1px dashed rgba(59,130,246,0.35)',
                  borderRadius: 6,
                  color: '#60a5fa',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: pickingFolder ? 'not-allowed' : 'pointer',
                  textAlign: 'center',
                }}
              >
                {pickingFolder ? 'Opening…' : '+ Choose a folder on your computer →'}
              </button>
            )}
          </div>

          {/* Benchmark nudge */}
          <div style={{
            background: 'rgba(15,23,42,0.4)',
            border: '1px solid rgba(100,116,139,0.12)',
            borderRadius: 8,
            padding: '12px 16px',
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>⚡</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', marginBottom: 2 }}>
                Cold → Hot: +72–83% accuracy improvement
              </div>
              <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.5 }}>
                Measured in the Library of Congress benchmark — AI that has your context
                answers 72–83 percentage points more accurately than a cold AI with no memory.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderTop: '1px solid rgba(100,116,139,0.15)', background: 'rgba(0,0,0,0.6)', flexShrink: 0,
      }}>
        <button
          onClick={() => setScreen(2)}
          style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 12 }}
        >
          ← Back
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onComplete}
            style={{
              padding: '8px 18px', background: 'none',
              border: '1px solid rgba(100,116,139,0.2)', borderRadius: 6,
              color: '#475569', fontSize: 11, cursor: 'pointer',
            }}
          >
            Skip for now
          </button>
          <button
            onClick={onComplete}
            style={{
              padding: '8px 24px', background: 'rgba(110,231,183,0.1)',
              border: '1px solid rgba(110,231,183,0.3)', borderRadius: 6,
              color: '#6ee7b7', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {folderPicked ? 'Great — open the app →' : 'Open the app →'}
          </button>
        </div>
      </div>
    </div>
  );
}
