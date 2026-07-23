// AppTab — BP054 · Application-002 UI Surfaces
// The unified member-services dashboard — 10 canonical cooperative sub-services.
// Services 1-4: partial implementations exist elsewhere — tiles link to relevant tabs/views.
// Services 5-10: new implementations (Application-002 surfaces).

import React, { useState, useRef } from 'react';
import type { AuthState } from '../amplify.d';

interface AppTabProps {
  authState: AuthState | null;
  onNavigate?: (tabId: string) => void;
}

interface ServiceTile {
  id: number;
  icon: string;
  name: string;
  description: string;
  status: 'open' | 'coming-soon' | 'member-only';
  actionLabel: string;
  tabTarget?: string;
  externalUrl?: string;
}

const SERVICES: ServiceTile[] = [
  {
    id: 1,
    icon: '🌐',
    name: 'Peer Hosting',
    description: 'Asteroid-proof P2P hosting on the cooperative substrate — your files, redundantly held across member peers.',
    status: 'open',
    actionLabel: 'Open',
    tabTarget: 'kitchen-table',
  },
  {
    id: 2,
    icon: '🔬',
    name: 'Research',
    description: 'Academic and business research assistance — opt in to Chronos substrate for deep literature and source retrieval.',
    status: 'coming-soon',
    actionLabel: 'Coming Soon',
  },
  {
    id: 3,
    icon: '🍽️',
    name: 'Recipe Pantry',
    description: 'Save, search, and share recipes with your household — meal planning and pantry management, zero ads.',
    status: 'open',
    actionLabel: 'Open',
    tabTarget: 'kitchen-table',
  },
  {
    id: 4,
    icon: '🛠️',
    name: 'Software Work',
    description: 'Build and deploy cooperative-class apps as a member-developer — Hearth App Builder with AI-assisted scaffolding.',
    status: 'open',
    actionLabel: 'Open',
    tabTarget: 'helm',
  },
  {
    id: 5,
    icon: '🏆',
    name: "Bounty's App",
    description: 'Trail-Bounty-Code-Breaker — earn marks by completing cooperative challenges, breaking trails, and solving bounties.',
    status: 'coming-soon',
    actionLabel: 'Coming Soon',
  },
  {
    id: 6,
    icon: '💡',
    name: 'Make Something',
    description: 'Submit your idea to the cooperative — "What do you want made?" unTech entry form for member-sourced products.',
    status: 'coming-soon',
    actionLabel: 'Coming Soon',
  },
  {
    id: 7,
    icon: '🗺️',
    name: 'Pawn Walkthrough',
    description: 'Code Breakers Trail Heads — guided cooperative onboarding paths with progressive mark rewards and peer mentorship.',
    status: 'coming-soon',
    actionLabel: 'Coming Soon',
  },
  {
    id: 8,
    icon: '📸',
    name: 'Theia',
    description: 'Photos, videos, and albums — member-owned media storage with cooperative peer-sync. Zero ads, your IP retained.',
    status: 'coming-soon',
    actionLabel: 'Coming Soon',
  },
  {
    id: 9,
    icon: '📅',
    name: 'Atlas',
    description: 'Family and team scheduling — multi-person calendar with P2P peer sync across local network and cooperative mesh.',
    status: 'open',
    actionLabel: 'Open',
    tabTarget: 'atlas',
  },
  {
    id: 10,
    icon: '🕸️',
    name: 'Local Network',
    description: 'Federation-ready local peer-mesh — discover and sync with cooperative members on your LAN, no cloud required.',
    status: 'open',
    actionLabel: 'Open',
    tabTarget: 'kitchen-table',
  },
];

export function AppTab({ authState, onNavigate }: AppTabProps) {
  const isMember = authState?.status === 'member' || authState?.status === 'trial_active';
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  // MoneyPenny Orchestration Panel state
  const [mpOpen, setMpOpen] = useState(false);
  const [mpTask, setMpTask] = useState('');
  const [mpBusy, setMpBusy] = useState(false);
  const [mpResult, setMpResult] = useState<{ briefing: string | null; error?: string } | null>(null);
  const mpInputRef = useRef<HTMLInputElement>(null);

  async function handleMpAsk() {
    const task = mpTask.trim();
    if (!task || mpBusy) return;
    setMpBusy(true);
    setMpResult(null);
    try {
      const res = await window.amplify?.moneypenny?.orchestrate(task);
      setMpResult(res ?? { briefing: null, error: 'no_response' });
    } catch {
      setMpResult({ briefing: null, error: 'librarian_unavailable' });
    } finally {
      setMpBusy(false);
    }
  }

  function handleAction(tile: ServiceTile) {
    if (tile.status === 'coming-soon') return;
    if (tile.tabTarget && onNavigate) {
      onNavigate(tile.tabTarget);
      return;
    }
    if (tile.externalUrl) {
      window.amplify?.openExternal?.(tile.externalUrl);
    }
  }

  const implementedCount = SERVICES.filter((s) => s.status === 'open').length;
  const comingSoonCount = SERVICES.filter((s) => s.status === 'coming-soon').length;

  return (
    <div style={{
      height: '100%', overflowY: 'auto', padding: '20px 20px 32px',
      boxSizing: 'border-box',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#e2e8f0', letterSpacing: '-0.3px' }}>
          Cooperative Services
        </div>
        <div style={{ fontSize: 10, color: '#475569', marginTop: 4, lineHeight: 1.6 }}>
          {implementedCount} active · {comingSoonCount} coming soon · member-owned · zero ads · your IP retained
        </div>
        {!isMember && (
          <div style={{
            marginTop: 10, padding: '8px 12px',
            background: 'rgba(110,231,183,0.06)', border: '1px solid rgba(110,231,183,0.18)',
            borderRadius: 8, fontSize: 10, color: '#6ee7b7',
          }}>
            Some services require cooperative membership ($5/year) — free features are always available.
          </div>
        )}
      </div>

      {/* Services grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 12,
      }}>
        {SERVICES.map((tile) => {
          const isHovered = hoveredId === tile.id;
          const isComingSoon = tile.status === 'coming-soon';
          const isMemberOnly = tile.status === 'member-only' && !isMember;

          return (
            <div
              key={tile.id}
              onMouseEnter={() => setHoveredId(tile.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                background: isHovered && !isComingSoon
                  ? 'rgba(110,231,183,0.07)'
                  : 'rgba(15,23,42,0.6)',
                border: `1px solid ${isHovered && !isComingSoon ? 'rgba(110,231,183,0.28)' : 'rgba(100,116,139,0.15)'}`,
                borderRadius: 12,
                padding: '16px 16px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                transition: 'all 0.15s',
                opacity: isComingSoon ? 0.75 : 1,
              }}
            >
              {/* Icon + number */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 24 }}>{tile.icon}</span>
                <span style={{
                  fontSize: 9, color: '#334155', fontWeight: 600,
                  background: 'rgba(100,116,139,0.08)',
                  borderRadius: 10, padding: '2px 6px',
                }}>
                  {tile.id < 10 ? `0${tile.id}` : tile.id}
                </span>
              </div>

              {/* Name */}
              <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.3 }}>
                {tile.name}
              </div>

              {/* Description */}
              <div style={{
                fontSize: 10, color: '#64748b', lineHeight: 1.6, flex: 1,
              }}>
                {tile.description}
              </div>

              {/* Action button */}
              <button
                onClick={() => handleAction(tile)}
                disabled={isComingSoon || isMemberOnly}
                style={{
                  marginTop: 4,
                  background: isComingSoon || isMemberOnly
                    ? 'rgba(100,116,139,0.08)'
                    : 'rgba(110,231,183,0.1)',
                  border: `1px solid ${isComingSoon || isMemberOnly ? 'rgba(100,116,139,0.15)' : 'rgba(110,231,183,0.3)'}`,
                  borderRadius: 7,
                  color: isComingSoon || isMemberOnly ? '#334155' : '#6ee7b7',
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '6px 12px',
                  cursor: isComingSoon || isMemberOnly ? 'default' : 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s',
                  width: '100%',
                }}
              >
                {isMemberOnly ? '🔒 Members Only' : tile.actionLabel}
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div style={{
        marginTop: 24, textAlign: 'center', fontSize: 9, color: '#1e293b',
      }}>
        Cooperative-class services · member IP retained · zero ads · $5/year to join
      </div>

      {/* MoneyPenny AI Orchestration Panel */}
      <div style={{ marginTop: 20 }}>
        <button
          onClick={() => setMpOpen((o) => !o)}
          style={{
            width: '100%',
            background: 'rgba(15,23,42,0.5)',
            border: '1px solid rgba(100,116,139,0.18)',
            borderRadius: 10,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            color: '#94a3b8',
            fontSize: 11,
            fontWeight: 600,
            textAlign: 'left',
          }}
        >
          <span>🤖 AI Orchestration</span>
          <span style={{ fontSize: 9, opacity: 0.6 }}>{mpOpen ? '▲ collapse' : '▼ expand'}</span>
        </button>

        {mpOpen && (
          <div style={{
            marginTop: 8,
            background: 'rgba(15,23,42,0.7)',
            border: '1px solid rgba(100,116,139,0.15)',
            borderRadius: 10,
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}>
            <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.5 }}>
              Ask MoneyPenny to brief you on any task using the Librarian context engine.
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={mpInputRef}
                value={mpTask}
                onChange={(e) => setMpTask(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleMpAsk(); }}
                placeholder="What would you like to do?"
                style={{
                  flex: 1,
                  background: 'rgba(30,41,59,0.8)',
                  border: '1px solid rgba(100,116,139,0.25)',
                  borderRadius: 7,
                  color: '#e2e8f0',
                  fontSize: 11,
                  padding: '7px 10px',
                  outline: 'none',
                }}
              />
              <button
                onClick={() => void handleMpAsk()}
                disabled={mpBusy || !mpTask.trim()}
                style={{
                  background: mpBusy || !mpTask.trim()
                    ? 'rgba(100,116,139,0.1)'
                    : 'rgba(110,231,183,0.12)',
                  border: `1px solid ${mpBusy || !mpTask.trim() ? 'rgba(100,116,139,0.15)' : 'rgba(110,231,183,0.3)'}`,
                  borderRadius: 7,
                  color: mpBusy || !mpTask.trim() ? '#475569' : '#6ee7b7',
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '7px 14px',
                  cursor: mpBusy || !mpTask.trim() ? 'default' : 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                }}
              >
                {mpBusy ? 'Asking…' : 'Ask MoneyPenny'}
              </button>
            </div>

            {mpResult && (
              <div style={{ marginTop: 4 }}>
                {mpResult.error === 'librarian_unavailable' || (!mpResult.briefing && mpResult.error) ? (
                  <div style={{
                    fontSize: 10, color: '#f59e0b',
                    background: 'rgba(245,158,11,0.06)',
                    border: '1px solid rgba(245,158,11,0.18)',
                    borderRadius: 7,
                    padding: '8px 12px',
                    lineHeight: 1.5,
                  }}>
                    MoneyPenny is offline — start the Librarian server to connect.
                  </div>
                ) : (
                  <textarea
                    readOnly
                    value={mpResult.briefing ?? ''}
                    rows={6}
                    style={{
                      width: '100%',
                      background: 'rgba(30,41,59,0.6)',
                      border: '1px solid rgba(100,116,139,0.2)',
                      borderRadius: 7,
                      color: '#cbd5e1',
                      fontSize: 10,
                      padding: '8px 10px',
                      resize: 'vertical',
                      lineHeight: 1.6,
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                    }}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
