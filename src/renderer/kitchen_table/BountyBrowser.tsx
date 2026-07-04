// BountyBrowser.tsx — KniPr036 · Bounty Board publication UI scaffold
// Bounties are Pawn Phase 3 Trail Eblets published for members to attempt.
// Members accept a Bounty, complete the walk-through, and earn Marks.

import React, { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Difficulty = 'Easy' | 'Moderate' | 'Strenuous' | 'Very Strenuous' | 'Extreme';
type Surface = 'mnemo' | 'cephas' | 'platform' | 'cross';
type BountyStatus = 'Available' | 'In Progress' | 'Completed';

interface Bounty {
  id: string;
  difficulty: Difficulty;
  marks: number;
  surface: Surface;
  status: BountyStatus;
}

type FilterOption = 'All' | Difficulty;
type SortOption = 'Newest' | 'Highest Marks' | 'Difficulty ▲' | 'Difficulty ▼';

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_BOUNTIES: Bounty[] = [
  { id: 'V001', difficulty: 'Moderate',       marks: 25,  surface: 'mnemo',    status: 'Available' },
  { id: 'V002', difficulty: 'Easy',           marks: 10,  surface: 'cephas',   status: 'Available' },
  { id: 'V013', difficulty: 'Strenuous',      marks: 60,  surface: 'cephas',   status: 'Available' },
  { id: 'V025', difficulty: 'Easy',           marks: 10,  surface: 'platform', status: 'Available' },
  { id: 'V037', difficulty: 'Very Strenuous', marks: 140, surface: 'cross',    status: 'Available' },
];

// ─── Difficulty config ────────────────────────────────────────────────────────

const DIFFICULTY_CONFIG: Record<Difficulty, { color: string; bg: string; border: string }> = {
  'Easy':           { color: '#4ade80', bg: 'rgba(74,222,128,0.12)',   border: 'rgba(74,222,128,0.3)'   },
  'Moderate':       { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',   border: 'rgba(96,165,250,0.3)'   },
  'Strenuous':      { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',   border: 'rgba(251,191,36,0.3)'   },
  'Very Strenuous': { color: '#f87171', bg: 'rgba(248,113,113,0.12)',  border: 'rgba(248,113,113,0.3)'  },
  'Extreme':        { color: '#c084fc', bg: 'rgba(192,132,252,0.12)',  border: 'rgba(192,132,252,0.3)'  },
};

const DIFFICULTY_ORDER: Difficulty[] = ['Easy', 'Moderate', 'Strenuous', 'Very Strenuous', 'Extreme'];

// ─── Surface label ────────────────────────────────────────────────────────────

const SURFACE_LABELS: Record<Surface, string> = {
  mnemo:    '🧠 mnemo',
  cephas:   '📜 cephas',
  platform: '🌐 platform',
  cross:    '⚡ cross-surface',
};

// ─── Filter / Sort helpers ────────────────────────────────────────────────────

function applyFilterSort(
  bounties: Bounty[],
  filter: FilterOption,
  sort: SortOption,
): Bounty[] {
  let result = filter === 'All' ? bounties : bounties.filter((b) => b.difficulty === filter);

  if (sort === 'Highest Marks') {
    result = [...result].sort((a, b) => b.marks - a.marks);
  } else if (sort === 'Difficulty ▲') {
    result = [...result].sort((a, b) =>
      DIFFICULTY_ORDER.indexOf(a.difficulty) - DIFFICULTY_ORDER.indexOf(b.difficulty)
    );
  } else if (sort === 'Difficulty ▼') {
    result = [...result].sort((a, b) =>
      DIFFICULTY_ORDER.indexOf(b.difficulty) - DIFFICULTY_ORDER.indexOf(a.difficulty)
    );
  }
  // 'Newest' keeps insertion order (source-order)
  return result;
}

// ─── BountyCard ───────────────────────────────────────────────────────────────

function BountyCard({ bounty }: { bounty: Bounty }) {
  const diff = DIFFICULTY_CONFIG[bounty.difficulty];

  const handleAccept = () => {
    alert('Bounty acceptance coming soon — Pawn Phase 3 publication in progress.');
  };

  const handleViewTrail = () => {
    alert(`Trail viewer for ${bounty.id} coming soon — KniPr035 (TrailEbletViewer) not yet wired to Bounty IDs.`);
  };

  return (
    <div
      style={{
        background: 'rgba(15,23,42,0.7)',
        border: '1px solid rgba(100,116,139,0.2)',
        borderRadius: 10,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(110,231,183,0.25)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(100,116,139,0.2)'; }}
    >
      {/* Top row: Trail ID + difficulty badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.3px' }}>
          {bounty.id}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700,
          color: diff.color,
          background: diff.bg,
          border: `1px solid ${diff.border}`,
          borderRadius: 10,
          padding: '2px 8px',
        }}>
          {bounty.difficulty}
        </span>
      </div>

      {/* Mark weight + surface */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          fontSize: 12, fontWeight: 600, color: '#fbbf24',
          background: 'rgba(251,191,36,0.08)',
          border: '1px solid rgba(251,191,36,0.25)',
          borderRadius: 8,
          padding: '2px 8px',
        }}>
          {bounty.marks} Marks
        </span>
        <span style={{ fontSize: 10, color: '#64748b' }}>
          {SURFACE_LABELS[bounty.surface]}
        </span>
      </div>

      {/* Status */}
      <div style={{ fontSize: 10, color: '#94a3b8' }}>
        Status: <span style={{ color: bounty.status === 'Available' ? '#4ade80' : '#94a3b8', fontWeight: 600 }}>
          {bounty.status}
        </span>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
        <button
          onClick={handleAccept}
          style={{
            flex: 1,
            padding: '6px 10px',
            background: 'rgba(110,231,183,0.1)',
            border: '1px solid rgba(110,231,183,0.3)',
            borderRadius: 6,
            color: '#6ee7b7',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(110,231,183,0.18)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(110,231,183,0.1)'; }}
        >
          Accept Bounty
        </button>
        <button
          onClick={handleViewTrail}
          style={{
            flex: 1,
            padding: '6px 10px',
            background: 'rgba(96,165,250,0.08)',
            border: '1px solid rgba(96,165,250,0.25)',
            borderRadius: 6,
            color: '#60a5fa',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(96,165,250,0.16)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(96,165,250,0.08)'; }}
        >
          View Trail
        </button>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function BountyEmptyState() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      gap: 12,
      padding: 32,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 36 }}>🏹</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>
        Bounty Board is warming up.
      </div>
      <div style={{ fontSize: 12, color: '#64748b', maxWidth: 300, lineHeight: 1.7 }}>
        Pawn Phase 3 Trails are being reviewed for publication.
        <br />
        Check back soon — first Bounties expected within 24 hours.
      </div>
    </div>
  );
}

// ─── BountyBrowser (main export) ─────────────────────────────────────────────

export function BountyBrowser() {
  const [filter, setFilter] = useState<FilterOption>('All');
  const [sort, setSort] = useState<SortOption>('Newest');
  const [showPreview, setShowPreview] = useState(false);

  const filters: FilterOption[] = ['All', 'Easy', 'Moderate', 'Strenuous', 'Very Strenuous', 'Extreme'];
  const sorts: SortOption[] = ['Newest', 'Highest Marks', 'Difficulty ▲', 'Difficulty ▼'];

  const displayedBounties = showPreview
    ? applyFilterSort(MOCK_BOUNTIES, filter, sort)
    : [];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: '#0a0f1a',
      color: '#e2e8f0',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px 8px',
        borderBottom: '1px solid rgba(100,116,139,0.15)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>
            🏹 Bounty Board
          </div>
          {/* Show Preview toggle — Founder/dev only */}
          <label style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 10, color: '#64748b', cursor: 'pointer', userSelect: 'none',
          }}>
            <div
              onClick={() => setShowPreview((p) => !p)}
              style={{
                width: 28, height: 16, borderRadius: 8,
                background: showPreview ? 'rgba(110,231,183,0.4)' : 'rgba(100,116,139,0.25)',
                border: `1px solid ${showPreview ? 'rgba(110,231,183,0.6)' : 'rgba(100,116,139,0.4)'}`,
                position: 'relative', cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              <div style={{
                position: 'absolute', top: 1, left: showPreview ? 13 : 1,
                width: 12, height: 12, borderRadius: '50%',
                background: showPreview ? '#6ee7b7' : '#64748b',
                transition: 'left 0.2s',
              }} />
            </div>
            Show Preview
          </label>
        </div>

        {/* Divider */}
        <div style={{ borderBottom: '1px solid rgba(100,116,139,0.2)', marginBottom: 8 }} />

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
          <span style={{ fontSize: 9, color: '#475569', fontWeight: 600, alignSelf: 'center', marginRight: 4 }}>
            FILTER
          </span>
          {filters.map((f) => {
            const active = filter === f;
            const diffConf = f !== 'All' ? DIFFICULTY_CONFIG[f as Difficulty] : null;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '2px 9px',
                  borderRadius: 10,
                  fontSize: 10,
                  fontWeight: active ? 700 : 400,
                  cursor: 'pointer',
                  background: active
                    ? (diffConf ? diffConf.bg : 'rgba(110,231,183,0.12)')
                    : 'transparent',
                  border: `1px solid ${active
                    ? (diffConf ? diffConf.border : 'rgba(110,231,183,0.3)')
                    : 'rgba(100,116,139,0.25)'}`,
                  color: active
                    ? (diffConf ? diffConf.color : '#6ee7b7')
                    : '#64748b',
                  transition: 'all 0.15s',
                }}
              >
                {f}
              </button>
            );
          })}
        </div>

        {/* Sort chips */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 9, color: '#475569', fontWeight: 600, alignSelf: 'center', marginRight: 4 }}>
            SORT
          </span>
          {sorts.map((s) => {
            const active = sort === s;
            return (
              <button
                key={s}
                onClick={() => setSort(s)}
                style={{
                  padding: '2px 9px',
                  borderRadius: 10,
                  fontSize: 10,
                  fontWeight: active ? 700 : 400,
                  cursor: 'pointer',
                  background: active ? 'rgba(100,116,139,0.15)' : 'transparent',
                  border: `1px solid ${active ? 'rgba(100,116,139,0.4)' : 'rgba(100,116,139,0.2)'}`,
                  color: active ? '#94a3b8' : '#475569',
                  transition: 'all 0.15s',
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
        {displayedBounties.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 10,
          }}>
            {displayedBounties.map((bounty) => (
              <BountyCard key={bounty.id} bounty={bounty} />
            ))}
          </div>
        ) : (
          <BountyEmptyState />
        )}
      </div>

      {/* Footer note when preview is active */}
      {showPreview && (
        <div style={{
          padding: '5px 14px',
          borderTop: '1px solid rgba(100,116,139,0.1)',
          fontSize: 9,
          color: '#334155',
          flexShrink: 0,
        }}>
          Preview mode — showing 5 mock bounties (V001 V002 V013 V025 V037). Real data pending Pawn Phase 3 publication.
        </div>
      )}
    </div>
  );
}
