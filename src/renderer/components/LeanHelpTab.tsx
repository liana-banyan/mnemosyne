// MnemosyneC · v0.2.0 · BP082 · 2026-06-13
// §2 Truth-Always · §3 Sonnet 4.6 · Founder-ratified
//
// LeanHelpTab — 4th tab in LeanShell.
// MnemosyneC as Substrate Filter: bring your own AI/social surface,
// we add an eblet + Marks layer ON TOP.
//
// SEG-1: 4th "Help" tab added to LeanShell tab strip (in LeanShell.tsx).
// SEG-2: This component — LeanHelpTab scaffold with FAQ + Connect cards + Coming Soon + Guild footer.
// SEG-3: Discord OAuth connect card (requires DISCORD_OAUTH_CLIENT_ID env var — see yoke-return).
// SEG-4: Reddit OAuth connect card (requires REDDIT_OAUTH_CLIENT_ID env var — see yoke-return).
// SEG-5: Eblet capture wired via substrateWrite IPC (per-message 📚 Save button).
// SEG-6: Coming Soon tiles — Chrome extension, Pawn/Perplexity, Cue Deck Cards.
// SEG-7: Marks economy — connect (5 ea) + capture (1 ea). Counter in header.
// SEG-8: Guild Incentives footer with Marks tiers table.
// SEG-9: Privacy — tokens via safeStorage (main process), never localStorage or renderer.

import React, { useState, useCallback, useEffect } from 'react';
import { FAQCard } from './help/FAQCard';
import { ConnectDiscordCard } from './help/ConnectDiscordCard';
import { ConnectRedditCard } from './help/ConnectRedditCard';
import { ComingSoonCard } from './help/ComingSoonCard';
import { GuildIncentivesFooter } from './help/GuildIncentivesFooter';

const LS_MARKS_KEY = 'mnemo_help_marks_earned';

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

function loadLocalMarks(): number {
  return parseInt(localStorage.getItem(LS_MARKS_KEY) ?? '0', 10) || 0;
}

function saveLocalMarks(n: number) {
  localStorage.setItem(LS_MARKS_KEY, String(n));
}

export function LeanHelpTab() {
  const [marks, setMarks] = useState<number>(loadLocalMarks);
  const [isMember, setIsMember] = useState<boolean>(false);
  const [memberCtaToast, setMemberCtaToast] = useState<string | null>(null);

  // Check local membership status
  useEffect(() => {
    window.amplify?.checkLocalMembershipStatus?.().then((r) => {
      if (r?.is_member) setIsMember(true);
    }).catch(() => {});
    // Also listen for activation events
    const unsub = window.amplify?.onMembershipActivated?.((result) => {
      if (result.ok) setIsMember(true);
    });
    return () => { unsub?.(); };
  }, []);

  const handleMemberCtaClick = useCallback(() => {
    void openMembershipCheckout((err) => {
      setMemberCtaToast(err);
      setTimeout(() => setMemberCtaToast(null), 4000);
    });
  }, []);

  const handleMarksAccrued = useCallback((delta: number) => {
    setMarks((prev) => {
      const next = prev + delta;
      saveLocalMarks(next);
      return next;
    });
  }, []);

  return (
    <div style={s.outer}>
      {/* Header */}
      <div style={s.headerBar}>
        <div style={{ flex: 1 }}>
          <h1 style={s.h1}>Help &amp; Community</h1>
          <p style={s.subtitle}>Get help. Join the Guild. Earn Marks for helping others.</p>
          {/* v0.4.1 BP083 SEG-4: The Secret of Mnem... is Salt */}
          <p style={{ fontSize: 13, color: '#a5b4fc', fontWeight: 700, margin: '6px 0 2px', letterSpacing: '0.01em' }}>
            🧂 The Secret of Mnem... is Salt.
          </p>
          <p style={{ fontSize: 12, color: '#64748b', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 8, padding: '10px 14px', lineHeight: 1.6, margin: '4px 0 4px' }}>
            MnemosyneC finds answers through <strong style={{ color: '#e2e8f0' }}>three salt layers</strong>:{' '}
            <strong>(1) Substrate Salt</strong> · verified eblets grown locally via canonical pipeline (what your machine already knows);{' '}
            <strong>(2) Federation Salt</strong> · Constellation peers share verified knowledge across the mesh;{' '}
            <strong>(3) Human Salt</strong> · The Diagnosis broadcasts to human Members when machines alone can&apos;t find the answer.{' '}
            <em style={{ color: '#475569' }}>Substrate Salt + Federation Salt + Human Salt = Right Answer.</em>
          </p>
        </div>
        {marks > 0 && (
          <div style={s.marksCounter} title="Marks earned via Help tab actions">
            ✦ {marks} Marks earned
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div style={s.scroll}>
        {/* Op-Ed feature tile */}
        <a
          href="https://lianabanyan.com/op-eds/thou-art-the-man"
          target="_blank"
          rel="noopener noreferrer"
          style={s.opEdTile}
        >
          <span style={s.opEdIcon}>📖</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={s.opEdNew}>NEW</div>
            <div style={s.opEdTitle}>Read "Thou Art the Man"</div>
            <div style={s.opEdDesc}>The structural argument for why we built the cooperative.</div>
          </div>
          <span style={s.opEdArrow}>→</span>
        </a>

        {/* FAQ + Install Guide */}
        <FAQCard />

        <div style={s.sectionLabel}>Community Connections</div>

        {/* Discord */}
        <ConnectDiscordCard onMarksAccrued={handleMarksAccrued} />

        {/* Reddit */}
        <ConnectRedditCard onMarksAccrued={handleMarksAccrued} />

        <div style={s.sectionLabel}>Coming Soon</div>

        {/* Coming Soon tiles — SEG-6 */}
        <ComingSoonCard
          icon="🌐"
          name="Chrome Browser Extension"
          why="Use ChatGPT, Claude.ai, Gemini, or any AI you already use in your browser · MnemosyneC adds a Save-to-Substrate button to every response. Your Marks accrue as you capture."
          eta="v0.2.x"
        />
        <ComingSoonCard
          icon="🦅"
          name="Perplexity (Pawn) Filter"
          why="Pawn has no MCP. We built the filter as a content-script overlay · same pattern as Discord and Reddit. Capture the answers worth keeping."
          eta="v0.2.x"
        />
        <ComingSoonCard
          icon="🃏"
          name="Cue Deck Cards (Advanced)"
          why="Turn captured eblets into shareable Cue Cards. Move to the Advanced tab when you're ready to publish your knowledge."
          eta="v0.3.x"
        />

        {/* BP085 — Membership CTA (hidden for existing members) */}
        {!isMember && (
          <section className="membership-cta-section" style={{
            background: 'linear-gradient(135deg, #0a1f14 0%, #0f2318 100%)',
            border: '1px solid #166534',
            borderRadius: 8,
            padding: '14px 16px',
            marginBottom: 12,
          }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: '#d1fae5' }}>
              Become a Member
            </h3>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: '#6ee7b7', lineHeight: 1.5 }}>
              Join the cooperative for <strong style={{ color: '#a7f3d0' }}>$5/yr</strong>. Members earn Marks,
              vote on Guild decisions, and help each other help ourselves.
            </p>
            <button
              className="member-cta-primary"
              onClick={handleMemberCtaClick}
              style={{
                background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
                border: '1px solid #059669',
                borderRadius: 6,
                color: '#6ee7b7',
                fontSize: 13,
                fontWeight: 700,
                padding: '8px 16px',
                cursor: 'pointer',
                fontFamily: 'system-ui, sans-serif',
                outline: 'none',
                width: '100%',
              }}
            >
              Become a Member · $5/yr
            </button>
            {memberCtaToast && (
              <p style={{ margin: '8px 0 0', fontSize: 11, color: '#fca5a5' }}>{memberCtaToast}</p>
            )}
          </section>
        )}
        {isMember && (
          <section className="membership-status-section" style={{
            background: 'rgba(6,95,70,0.15)',
            border: '1px solid #065f46',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 12,
          }}>
            <p style={{ margin: 0, fontSize: 12, color: '#6ee7b7' }}>
              ✓ You are a member of the cooperative.
            </p>
          </section>
        )}

        {/* Guild Incentives footer — SEG-8 */}
        <GuildIncentivesFooter />

        {/* Bottom breathing room */}
        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}

const s = {
  outer: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  headerBar: {
    padding: '14px 16px 8px',
    flexShrink: 0,
    borderBottom: '1px solid #1e2a38',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    flexWrap: 'wrap' as const,
  },
  h1: {
    margin: 0,
    fontSize: 16,
    fontWeight: 700,
    color: '#f0fdf4',
  } as React.CSSProperties,
  subtitle: {
    margin: '4px 0 0',
    fontSize: 11,
    color: '#475569',
  } as React.CSSProperties,
  marksCounter: {
    fontSize: 12,
    fontWeight: 700,
    color: '#6ee7b7',
    background: '#064e3b',
    border: '1px solid #059669',
    borderRadius: 5,
    padding: '3px 10px',
    flexShrink: 0,
    alignSelf: 'center',
    cursor: 'default',
  } as React.CSSProperties,
  scroll: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '12px 14px',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: '#475569',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    marginBottom: 8,
    marginTop: 4,
  } as React.CSSProperties,
  opEdTile: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'linear-gradient(135deg, #0a1a12 0%, #0f2318 100%)',
    border: '1px solid #166534',
    borderRadius: 8,
    padding: '10px 12px',
    marginBottom: 12,
    textDecoration: 'none',
    cursor: 'pointer',
  } as React.CSSProperties,
  opEdIcon: {
    fontSize: 20,
    flexShrink: 0,
  } as React.CSSProperties,
  opEdNew: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: '#4ade80',
    textTransform: 'uppercase' as const,
    marginBottom: 2,
  } as React.CSSProperties,
  opEdTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: '#d1fae5',
    marginBottom: 2,
  } as React.CSSProperties,
  opEdDesc: {
    fontSize: 10,
    color: '#6ee7b7',
    lineHeight: 1.4,
  } as React.CSSProperties,
  opEdArrow: {
    fontSize: 14,
    color: '#4ade80',
    flexShrink: 0,
  } as React.CSSProperties,
};
