// SecondDoorStamps — BP060 Application 002 Step 1 · UI-4
// Second Door threshold stamping — Coming/Going at the Tower of Peace.
// Per canon_second_door_political_expedition_wing_tower_of_peace_bp059.
// Content must be Stamped Coming (leaving LB-proper) AND Going (re-entering).
// Audit receipts displayed. Visual threshold state indicator.
// NOT LB-proper: content behind Second Door is Political Expedition Wing.

import React, { useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type StampDirection = 'coming' | 'going';

interface ThresholdStamp {
  id: string;
  direction: StampDirection;
  content_ref: string;
  wing: 'political' | 'religious' | 'both';
  member_id: string;
  ts: number;
  receipt_hash: string;
}

// ─── SHA-256 receipt hash (DELTA-2 §X.A2 fix) ────────────────────────────────
// Uses Web Crypto API (window.crypto.subtle) — available in Electron renderer.
// Returns first 16 hex chars of SHA-256 digest as the receipt_hash.
// Async: caller must await.

async function makeReceiptHash(content_ref: string, direction: StampDirection, ts: number): Promise<string> {
  const str = `${content_ref}:${direction}:${ts}`;
  const enc = new TextEncoder();
  const data = enc.encode(str);
  const hashBuf = await window.crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hex.slice(0, 16) + '-sha256';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SecondDoorStamps() {
  const [contentRef, setContentRef] = useState('');
  const [memberId, setMemberId] = useState('');
  const [wing, setWing] = useState<'political' | 'religious' | 'both'>('political');
  const [stamps, setStamps] = useState<ThresholdStamp[]>([]);
  const [activeStamps, setActiveStamps] = useState<Map<string, ThresholdStamp>>(new Map());

  const stamp = useCallback(async (direction: StampDirection) => {
    if (!contentRef.trim()) return;
    const ts = Date.now();
    const receipt_hash = await makeReceiptHash(contentRef.trim(), direction, ts);
    const s: ThresholdStamp = {
      id: `stamp-${ts.toString(36)}`,
      direction,
      content_ref: contentRef.trim(),
      wing,
      member_id: memberId.trim() || 'anonymous',
      ts,
      receipt_hash,
    };
    setStamps((prev) => [s, ...prev.slice(0, 99)]);

    // Track Coming stamps — when both Coming+Going for same content exist, mark threshold complete
    if (direction === 'coming') {
      setActiveStamps((prev) => {
        const next = new Map(prev);
        next.set(contentRef.trim(), s);
        return next;
      });
    } else {
      // Going stamp closes the threshold cycle
      setActiveStamps((prev) => {
        const next = new Map(prev);
        next.delete(contentRef.trim());
        return next;
      });
    }
  }, [contentRef, memberId, wing]);

  const hasActiveComing = activeStamps.has(contentRef.trim());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{
        padding: '10px 14px 6px',
        borderBottom: '1px solid rgba(56,189,248,0.2)',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', marginBottom: 2 }}>
          Second Door · Threshold Stamps
        </div>
        <div style={{ fontSize: 9, color: '#475569' }}>
          Tower of Peace · Political Expedition Wing · NOT LB-proper
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '10px 14px' }}>
        {/* Architectural notice */}
        <div style={{
          marginBottom: 12,
          padding: '8px 10px',
          background: 'rgba(56,189,248,0.06)',
          border: '1px solid rgba(56,189,248,0.2)',
          borderRadius: 6,
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#38bdf8', marginBottom: 3 }}>
            ⚠ Second Door — Political Expedition Wing
          </div>
          <div style={{ fontSize: 8, color: '#64748b', lineHeight: 1.6 }}>
            Content stamped here is entering a wing <strong style={{ color: '#94a3b8' }}>NOT covered by LB cooperative structural bylaws</strong>.
            Governed by Reputation + Listen-to-Speak statutes. Entry is voluntary and at-your-own-behest.
            Stamps are audit receipts — they cannot be altered after submission.
            "You enter at your own behest, with the understanding that you must abide by the rules."
          </div>
        </div>

        {/* Threshold state indicator */}
        <div style={{
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 10px',
          background: hasActiveComing
            ? 'rgba(245,158,11,0.08)'
            : 'rgba(100,116,139,0.06)',
          border: `1px solid ${hasActiveComing ? 'rgba(245,158,11,0.3)' : 'rgba(100,116,139,0.15)'}`,
          borderRadius: 6,
        }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
            background: hasActiveComing ? '#f59e0b' : '#334155',
            boxShadow: hasActiveComing ? '0 0 6px rgba(245,158,11,0.6)' : 'none',
          }} />
          <div style={{ fontSize: 9, color: hasActiveComing ? '#f59e0b' : '#475569' }}>
            {hasActiveComing
              ? `Threshold OPEN — "${contentRef}" has a Coming stamp · awaiting Going stamp to complete cycle`
              : 'Threshold CLOSED — no active Coming stamp for this content reference'}
          </div>
        </div>

        {/* Content reference input */}
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 9, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 3 }}>
            Content Reference
          </label>
          <input
            value={contentRef}
            onChange={(e) => setContentRef(e.target.value)}
            placeholder="content-id, post-hash, or URL"
            style={{
              width: '100%',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(100,116,139,0.3)',
              borderRadius: 5,
              color: '#e2e8f0',
              fontSize: 10,
              padding: '6px 8px',
              boxSizing: 'border-box',
              fontFamily: 'monospace',
            }}
          />
        </div>

        {/* Member ID */}
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 9, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 3 }}>
            Member ID (optional — anonymous if blank)
          </label>
          <input
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            placeholder="member identifier (leave blank for anonymous)"
            style={{
              width: '100%',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(100,116,139,0.3)',
              borderRadius: 5,
              color: '#e2e8f0',
              fontSize: 10,
              padding: '6px 8px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Wing selector */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 9, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
            Wing
          </label>
          <div style={{ display: 'flex', gap: 5 }}>
            {(['political', 'religious', 'both'] as const).map((w) => (
              <button
                key={w}
                onClick={() => setWing(w)}
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  background: wing === w ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${wing === w ? 'rgba(56,189,248,0.4)' : 'rgba(100,116,139,0.2)'}`,
                  borderRadius: 5,
                  color: wing === w ? '#38bdf8' : '#475569',
                  fontSize: 9,
                  fontWeight: wing === w ? 700 : 400,
                  cursor: 'pointer',
                }}
              >
                {w === 'political' ? '🏛 Political' : w === 'religious' ? '✝ Religious' : '⊕ Both'}
              </button>
            ))}
          </div>
        </div>

        {/* Stamp buttons */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button
            onClick={() => stamp('coming')}
            disabled={!contentRef.trim()}
            title="Stamp Coming — this content is entering the Political Expedition Wing (leaving LB-proper)"
            style={{
              flex: 1,
              padding: '10px 14px',
              background: 'rgba(245,158,11,0.12)',
              border: '1px solid rgba(245,158,11,0.4)',
              borderRadius: 6,
              color: '#f59e0b',
              fontSize: 11,
              fontWeight: 700,
              cursor: contentRef.trim() ? 'pointer' : 'not-allowed',
              opacity: contentRef.trim() ? 1 : 0.4,
              transition: 'all 0.15s',
            }}
          >
            ↗ Stamp COMING
          </button>
          <button
            onClick={() => stamp('going')}
            disabled={!contentRef.trim()}
            title="Stamp Going — this content is re-entering LB-proper governance"
            style={{
              flex: 1,
              padding: '10px 14px',
              background: 'rgba(110,231,183,0.12)',
              border: '1px solid rgba(110,231,183,0.4)',
              borderRadius: 6,
              color: '#6ee7b7',
              fontSize: 11,
              fontWeight: 700,
              cursor: contentRef.trim() ? 'pointer' : 'not-allowed',
              opacity: contentRef.trim() ? 1 : 0.4,
              transition: 'all 0.15s',
            }}
          >
            ↙ Stamp GOING
          </button>
        </div>

        {/* Audit receipts */}
        {stamps.length > 0 && (
          <div>
            <div style={{ fontSize: 9, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              Audit Receipts ({stamps.length})
            </div>
            {stamps.map((s) => (
              <div key={s.id} style={{
                marginBottom: 5,
                padding: '6px 8px',
                background: s.direction === 'coming' ? 'rgba(245,158,11,0.05)' : 'rgba(110,231,183,0.05)',
                border: `1px solid ${s.direction === 'coming' ? 'rgba(245,158,11,0.2)' : 'rgba(110,231,183,0.2)'}`,
                borderRadius: 5,
                fontSize: 9,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{
                    color: s.direction === 'coming' ? '#f59e0b' : '#6ee7b7',
                    fontWeight: 700,
                  }}>
                    {s.direction === 'coming' ? '↗ COMING' : '↙ GOING'} · {s.wing}
                  </span>
                  <span style={{ fontSize: 8, color: '#334155', fontFamily: 'monospace' }}>
                    {s.receipt_hash}
                  </span>
                </div>
                <div style={{ color: '#64748b' }}>
                  {s.content_ref} · {s.member_id} · {new Date(s.ts).toISOString().slice(11, 19)}Z
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SecondDoorStamps;
