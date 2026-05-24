// Mnemosyne — Roll Queue Dashboard
// SAGA 14 BP045 W1 — Dual-veto nomination admin surface
//
// Role-gated: founder | helm-crown
// Surfaces: pending nominations queue · Founder/Helm-Crown veto buttons ·
//           decline rationale capture (private) · auto-promote on dual-ratification

import React, { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type VoteType = 'founder' | 'helm-crown';
type VoteValue = 'ratify' | 'veto';
type NomStatus = 'pending' | 'ratified' | 'declined' | 'awaiting-second';

interface Nomination {
  id: string;
  nomineeName: string;
  nomineeSlug: string;
  nomineeNote?: string;
  submittedAt: string;
  submittedBy?: string;
  status: NomStatus;
  founderVote?: VoteValue;
  helmCrownVote?: VoteValue;
  ratifiedAt?: string;
  declinedAt?: string;
}

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  bg: '#0a0f1a',
  surface: '#111827',
  border: '#1e2d45',
  text: '#e2e8f0',
  muted: '#64748b',
  accent: '#3b82f6',
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  purple: '#a78bfa',
};

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
      padding: '12px 16px', flex: 1,
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: color ?? C.text }}>{value}</div>
      <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: NomStatus }) {
  const map: Record<NomStatus, { label: string; color: string; bg: string }> = {
    pending:          { label: 'Pending',         color: C.amber,  bg: '#1c1504' },
    ratified:         { label: 'Ratified ✓',      color: C.green,  bg: '#0a1f0e' },
    declined:         { label: 'Declined',         color: C.muted,  bg: C.surface },
    'awaiting-second':{ label: 'Awaiting 2nd',    color: C.accent, bg: '#0d1a2d' },
  };
  const m = map[status] ?? map.pending;
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 8,
      background: m.bg, color: m.color, border: `1px solid ${m.color}44`,
      textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>{m.label}</span>
  );
}

// ─── Vote button ──────────────────────────────────────────────────────────────

function VoteBtn({
  label, vote, onClick, disabled, existing,
}: {
  label: string; vote: VoteValue; onClick: () => void;
  disabled?: boolean; existing?: VoteValue;
}) {
  const isRatify = vote === 'ratify';
  const alreadyVoted = existing === vote;
  const color = isRatify ? C.green : C.muted;
  return (
    <button
      onClick={onClick}
      disabled={disabled || alreadyVoted}
      title={alreadyVoted ? `Already voted ${vote}` : label}
      style={{
        background: alreadyVoted ? (isRatify ? '#0a1f0e' : '#1a1a1a') : 'transparent',
        border: `1px solid ${alreadyVoted ? color : C.border}`,
        borderRadius: 6,
        color: alreadyVoted ? color : C.muted,
        cursor: disabled || alreadyVoted ? 'not-allowed' : 'pointer',
        fontSize: 10,
        fontWeight: 600,
        padding: '3px 10px',
        opacity: disabled && !alreadyVoted ? 0.4 : 1,
      }}
    >
      {alreadyVoted ? `✓ ${vote}` : label}
    </button>
  );
}

// ─── Nomination row ───────────────────────────────────────────────────────────

function NominationRow({
  nom,
  vetoerType,
  onVote,
}: {
  nom: Nomination;
  vetoerType: VoteType;
  onVote: (id: string, vote: VoteValue, rationale?: string) => Promise<void>;
}) {
  const [declining, setDeclining] = useState(false);
  const [rationale, setRationale] = useState('');
  const [busy, setBusy] = useState(false);

  const myVote = vetoerType === 'founder' ? nom.founderVote : nom.helmCrownVote;
  const isSettled = nom.status === 'ratified' || nom.status === 'declined';

  const handleVote = async (vote: VoteValue) => {
    if (vote === 'veto') {
      setDeclining(true);
      return;
    }
    setBusy(true);
    try {
      await onVote(nom.id, vote);
    } finally {
      setBusy(false);
    }
  };

  const handleDeclineConfirm = async () => {
    setBusy(true);
    try {
      await onVote(nom.id, 'veto', rationale.trim() || undefined);
      setDeclining(false);
      setRationale('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 10, padding: '12px 14px', marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{nom.nomineeName}</span>
            <StatusBadge status={nom.status} />
          </div>
          {nom.nomineeNote && (
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>
              {nom.nomineeNote}
            </div>
          )}
          <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
            Submitted {new Date(nom.submittedAt).toLocaleDateString()}
            {nom.submittedBy ? ` · by ${nom.submittedBy}` : ''}
          </div>
        </div>
      </div>

      {/* Vote status row */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center',
        padding: '8px 0', borderTop: `1px solid ${C.border}`,
        marginTop: 4,
      }}>
        <div style={{ fontSize: 10, color: C.muted }}>
          <span style={{ marginRight: 4 }}>Founder:</span>
          <span style={{ color: nom.founderVote === 'ratify' ? C.green : nom.founderVote === 'veto' ? C.muted : C.amber }}>
            {nom.founderVote ?? 'pending'}
          </span>
        </div>
        <div style={{ fontSize: 10, color: C.muted }}>
          <span style={{ marginRight: 4 }}>Helm Crown:</span>
          <span style={{ color: nom.helmCrownVote === 'ratify' ? C.green : nom.helmCrownVote === 'veto' ? C.muted : C.amber }}>
            {nom.helmCrownVote ?? 'pending'}
          </span>
        </div>

        {!isSettled && !declining && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <VoteBtn
              label="Ratify"
              vote="ratify"
              onClick={() => void handleVote('ratify')}
              disabled={busy}
              existing={myVote}
            />
            <VoteBtn
              label="Decline"
              vote="veto"
              onClick={() => void handleVote('veto')}
              disabled={busy}
              existing={myVote}
            />
          </div>
        )}

        {nom.status === 'ratified' && (
          <div style={{ marginLeft: 'auto', fontSize: 10, color: C.green }}>
            ✓ Published at /roll/{nom.nomineeSlug}/
          </div>
        )}
      </div>

      {/* Decline rationale capture */}
      {declining && (
        <div style={{
          marginTop: 10, padding: '10px 12px',
          background: '#0f0a0a', border: `1px solid ${C.border}`,
          borderRadius: 8,
        }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>
            Decline rationale (private, stored only in admin records — never shown publicly):
          </div>
          <textarea
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="Optional — rationale is private and never displayed"
            rows={2}
            style={{
              width: '100%', background: '#070d1a', border: `1px solid ${C.border}`,
              borderRadius: 6, color: C.text, fontSize: 11, padding: '6px 10px',
              resize: 'vertical', boxSizing: 'border-box', outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={() => void handleDeclineConfirm()}
              disabled={busy}
              style={{
                background: 'transparent', border: `1px solid ${C.muted}`,
                borderRadius: 6, color: C.muted, cursor: busy ? 'not-allowed' : 'pointer',
                fontSize: 10, fontWeight: 600, padding: '4px 12px',
              }}
            >
              {busy ? 'Saving…' : 'Confirm decline'}
            </button>
            <button
              onClick={() => { setDeclining(false); setRationale(''); }}
              style={{
                background: 'transparent', border: 'none', color: C.muted,
                cursor: 'pointer', fontSize: 10, padding: '4px 8px',
              }}
            >
              Cancel
            </button>
          </div>
          <div style={{ fontSize: 9, color: C.muted, marginTop: 6 }}>
            EXCLUSION-WITHOUT-JUDGMENT is canon. No negative commentary on declined candidates.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

interface RollQueueDashboardProps {
  vetoerType: VoteType;
  displayName?: string;
}

export function RollQueueDashboard({ vetoerType, displayName }: RollQueueDashboardProps) {
  const [nominations, setNominations] = useState<Nomination[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<NomStatus | 'all'>('pending');

  const loadNominations = useCallback(async () => {
    try {
      const data = await (window as any).amplify?.rollGetNominations?.();
      if (Array.isArray(data)) setNominations(data);
    } catch { /* empty state */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadNominations(); }, [loadNominations]);

  const handleVote = async (id: string, vote: VoteValue, rationale?: string) => {
    try {
      await (window as any).amplify?.rollCastVote?.({ id, vetoer_type: vetoerType, vote, rationale });
      await loadNominations();
    } catch (e) {
      alert('Vote failed: ' + String(e));
    }
  };

  const filtered = filter === 'all' ? nominations : nominations.filter((n) => n.status === filter);
  const pending = nominations.filter((n) => n.status === 'pending' || n.status === 'awaiting-second');
  const ratified = nominations.filter((n) => n.status === 'ratified');
  const declined = nominations.filter((n) => n.status === 'declined');

  const FILTERS: Array<{ id: NomStatus | 'all'; label: string }> = [
    { id: 'all',              label: 'All' },
    { id: 'pending',          label: `Pending (${pending.length})` },
    { id: 'awaiting-second',  label: 'Awaiting 2nd' },
    { id: 'ratified',         label: 'Ratified' },
    { id: 'declined',         label: 'Declined' },
  ];

  return (
    <div style={{
      background: C.bg,
      color: C.text,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px 14px',
        borderBottom: `1px solid ${C.border}`,
        background: '#0d1220',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 20 }}>🎖️</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Roll Queue — Admin</div>
            <div style={{ fontSize: 10, color: C.muted }}>
              {displayName ?? vetoerType} · Dual-veto ratification
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <StatCard label="Pending" value={pending.length} color={pending.length > 0 ? C.amber : C.muted} />
          <StatCard label="Ratified" value={ratified.length} color={C.green} />
          <StatCard label="Declined" value={declined.length} />
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            style={{
              flex: 1, padding: '7px 4px', border: 'none',
              borderBottom: filter === id ? `2px solid ${C.accent}` : '2px solid transparent',
              background: 'transparent',
              color: filter === id ? C.accent : C.muted,
              cursor: 'pointer', fontSize: 10, fontWeight: 600,
            }}
          >{label}</button>
        ))}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: C.muted, fontSize: 11, padding: 24 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '32px 16px',
            border: `1px dashed ${C.border}`, borderRadius: 10, color: C.muted, fontSize: 11,
          }}>
            No nominations in this category.
          </div>
        ) : (
          filtered.map((nom) => (
            <NominationRow
              key={nom.id}
              nom={nom}
              vetoerType={vetoerType}
              onVote={handleVote}
            />
          ))
        )}
      </div>

      {/* Discipline footer */}
      <div style={{
        padding: '8px 16px', borderTop: `1px solid ${C.border}`,
        fontSize: 9, color: '#334155', lineHeight: 1.5, flexShrink: 0,
      }}>
        EXCLUSION-WITHOUT-JUDGMENT is canon · Decline rationale is private · No negative
        commentary on declined or removed names · Both votes required for ratification →
        auto-promotes to /roll/{'{slug}'}/
      </div>
    </div>
  );
}
