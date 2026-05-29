// MarkerReportingFlow — BP060 Application 002 Step 1 · UI-3
// Chess.com-adapted marker system for content-only (never person-direct) reporting.
// Per canon_second_door_political_expedition_wing_bp059 §6C.3-bis.
// Positive XOR Negative stance dropdown — mutually exclusive per submission.
// Matt 5:37 anchor: "Let your yea be yea, and your nay be nay."
// Markers attach to CONTENT ONLY (not users directly) — §6C.2 Challenge 2.
// Harper Guild custody disclosure always displayed.

import React, { useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type MarkerStance = 'positive' | 'negative';

interface ClassAMarker {
  id: string;
  label: string;
  description: string;
}

interface ClassBMarker {
  id: string;
  label: string;
  description: string;
}

interface ClassCMarker {
  id: string;
  label: string;
  description: string;
}

interface SubmittedMarker {
  content_ref: string;
  stance: MarkerStance;
  marker_ids: string[];
  matt_537_affirmed: boolean;
  ts: number;
  session_id: string;
}

// ─── Marker definitions ───────────────────────────────────────────────────────

const CLASS_A_MARKERS: ClassAMarker[] = [
  { id: 'religious', label: 'Religious', description: 'Contains religious content or framing' },
  { id: 'political', label: 'Political', description: 'Contains political content or advocacy' },
  { id: 'vulgar', label: 'Vulgar', description: 'Contains vulgar or crude language' },
  { id: 'offensive', label: 'Offensive', description: 'Likely to cause offense to a reasonable person' },
  { id: 'racist', label: 'Racist', description: 'Contains racist language or framing' },
  { id: 'bigoted', label: 'Bigoted', description: 'Expresses bigotry toward a group' },
  { id: 'extremist', label: 'Extremist', description: 'Promotes extreme or violent views' },
  { id: 'hateful', label: 'Hateful', description: 'Contains hate-class content' },
];

const CLASS_B_MARKERS: ClassBMarker[] = [
  { id: 'kind', label: 'Kind', description: 'Demonstrates genuine kindness in tone or action' },
  { id: 'generous', label: 'Generous', description: 'Shows generosity toward others' },
  { id: 'good', label: 'Good', description: 'Content produces good outcomes for the community' },
  { id: 'positive', label: 'Positive', description: 'Positive and uplifting in its effect' },
];

const CLASS_C_MARKERS: ClassCMarker[] = [
  { id: 'honest', label: 'Honest', description: 'Engages honestly with evidence and argument' },
  { id: 'fair', label: 'Fair', description: 'Fair engagement process — cites, doesn\'t misrepresent' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function MarkerReportingFlow() {
  const [contentRef, setContentRef] = useState('');
  const [stance, setStance] = useState<MarkerStance | null>(null);
  const [selectedMarkers, setSelectedMarkers] = useState<Set<string>>(new Set());
  const [matt537, setMatt537] = useState(false);
  const [submitted, setSubmitted] = useState<SubmittedMarker[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);

  const toggleMarker = useCallback((id: string) => {
    setSelectedMarkers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleStanceChange = (s: MarkerStance) => {
    setStance(s);
    setSelectedMarkers(new Set()); // reset markers when stance flips
  };

  const handleSubmit = useCallback(() => {
    if (!contentRef.trim() || !stance || selectedMarkers.size === 0 || !matt537) return;
    const marker: SubmittedMarker = {
      content_ref: contentRef.trim(),
      stance,
      marker_ids: [...selectedMarkers],
      matt_537_affirmed: matt537,
      ts: Date.now(),
      session_id: `marker-${Date.now().toString(36)}`,
    };
    setSubmitted((prev) => [marker, ...prev.slice(0, 49)]);
    // Reset form
    setContentRef('');
    setStance(null);
    setSelectedMarkers(new Set());
    setMatt537(false);
    setShowConfirm(false);
  }, [contentRef, stance, selectedMarkers, matt537]);

  const canSubmit = contentRef.trim().length > 0 && stance !== null && selectedMarkers.size > 0 && matt537;
  const markersForStance = stance === 'negative'
    ? CLASS_A_MARKERS
    : [...CLASS_B_MARKERS, ...CLASS_C_MARKERS];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{
        padding: '10px 14px 6px',
        borderBottom: '1px solid rgba(110,231,183,0.15)',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6ee7b7', marginBottom: 2 }}>
          Marker Reporting
        </div>
        <div style={{ fontSize: 9, color: '#475569' }}>
          Content-only markers · Chess.com-adapted · Harper Guild custody
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '10px 14px' }}>
        {/* Harper Guild custody disclosure — always shown */}
        <div style={{
          marginBottom: 12,
          padding: '8px 10px',
          background: 'rgba(167,139,250,0.06)',
          border: '1px solid rgba(167,139,250,0.2)',
          borderRadius: 6,
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#a78bfa', marginBottom: 3 }}>
            Harper Guild Custody Disclosure
          </div>
          <div style={{ fontSize: 8, color: '#64748b', lineHeight: 1.6 }}>
            Markers attach to <strong style={{ color: '#94a3b8' }}>content items only</strong> — never to persons directly.
            Your identity is anonymous to the recipient but known to the LB substrate and Harper Guild monitors,
            who are sworn to confidentiality (psychiatrist-analog). Anonymity may be lifted by a majority vote of
            3 Harper Guild members if harm is involved (Tarasoff-class duty). By submitting, you affirm your
            marker is genuine.
          </div>
        </div>

        {/* Content reference */}
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 9, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
            Content Reference (ID or URL of the specific content)
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

        {/* Positive XOR Negative stance dropdown */}
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 9, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
            Rating Direction — choose ONE (Positive OR Negative, not both)
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['positive', 'negative'] as MarkerStance[]).map((s) => (
              <button
                key={s}
                onClick={() => handleStanceChange(s)}
                style={{
                  flex: 1,
                  padding: '7px 12px',
                  background: stance === s
                    ? s === 'positive' ? 'rgba(110,231,183,0.15)' : 'rgba(239,68,68,0.12)'
                    : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${stance === s
                    ? s === 'positive' ? 'rgba(110,231,183,0.5)' : 'rgba(239,68,68,0.4)'
                    : 'rgba(100,116,139,0.2)'}`,
                  borderRadius: 6,
                  color: stance === s
                    ? s === 'positive' ? '#6ee7b7' : '#f87171'
                    : '#64748b',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {s === 'positive' ? '👍 Positive Rating' : '⚠ Negative Rating'}
              </button>
            ))}
          </div>
        </div>

        {/* Marker selection — shown only after stance selected */}
        {stance && (
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 9, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 6 }}>
              {stance === 'negative' ? 'Class A · Negative Content Markers' : 'Class B + C · Positive Markers'} (select all that apply)
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {markersForStance.map((m) => {
                const selected = selectedMarkers.has(m.id);
                const color = stance === 'positive' ? '#6ee7b7' : '#f87171';
                return (
                  <button
                    key={m.id}
                    onClick={() => toggleMarker(m.id)}
                    title={m.description}
                    style={{
                      padding: '4px 10px',
                      background: selected ? `rgba(${stance === 'positive' ? '110,231,183' : '239,68,68'},0.15)` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${selected ? color + '55' : 'rgba(100,116,139,0.2)'}`,
                      borderRadius: 12,
                      color: selected ? color : '#475569',
                      fontSize: 9,
                      fontWeight: selected ? 700 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {selected ? '✓ ' : ''}{m.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Matt 5:37 affirmation */}
        {stance && selectedMarkers.size > 0 && (
          <div style={{
            marginBottom: 12,
            padding: '8px 10px',
            background: matt537 ? 'rgba(110,231,183,0.06)' : 'rgba(245,158,11,0.06)',
            border: `1px solid ${matt537 ? 'rgba(110,231,183,0.25)' : 'rgba(245,158,11,0.25)'}`,
            borderRadius: 6,
          }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={matt537}
                onChange={(e) => setMatt537(e.target.checked)}
                style={{ marginTop: 2, flexShrink: 0 }}
              />
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: matt537 ? '#6ee7b7' : '#f59e0b' }}>
                  This will be stamped — recorded permanently.
                </div>
                <div style={{ fontSize: 9, color: '#64748b', marginTop: 2, fontStyle: 'italic', lineHeight: 1.5 }}>
                  "Let your yea be yea, and your nay be nay." — Matthew 5:37 (KJV)
                </div>
                <div style={{ fontSize: 8, color: '#475569', marginTop: 2 }}>
                  I affirm this marker is genuine and I have reviewed the content I am marking.
                </div>
              </div>
            </label>
          </div>
        )}

        {/* Submit button */}
        <button
          onClick={() => canSubmit && setShowConfirm(true)}
          disabled={!canSubmit}
          style={{
            width: '100%',
            padding: '9px 14px',
            background: canSubmit ? 'rgba(110,231,183,0.12)' : 'rgba(100,116,139,0.06)',
            border: `1px solid ${canSubmit ? 'rgba(110,231,183,0.4)' : 'rgba(100,116,139,0.15)'}`,
            borderRadius: 6,
            color: canSubmit ? '#6ee7b7' : '#334155',
            fontSize: 11,
            fontWeight: 700,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s',
          }}
        >
          Submit Marker Report
        </button>

        {/* Confirmation modal */}
        {showConfirm && (
          <div style={{
            marginTop: 10,
            padding: '12px 14px',
            background: 'rgba(15,17,26,0.97)',
            border: '1px solid rgba(110,231,183,0.4)',
            borderRadius: 8,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>
              Confirm Marker Submission
            </div>
            <div style={{ fontSize: 9, color: '#64748b', marginBottom: 8, lineHeight: 1.6 }}>
              <strong style={{ color: '#94a3b8' }}>Content:</strong> {contentRef}<br/>
              <strong style={{ color: '#94a3b8' }}>Stance:</strong> {stance}<br/>
              <strong style={{ color: '#94a3b8' }}>Markers:</strong> {[...selectedMarkers].join(', ')}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={handleSubmit}
                style={{
                  flex: 1, padding: '6px 12px',
                  background: 'rgba(110,231,183,0.15)',
                  border: '1px solid rgba(110,231,183,0.4)',
                  borderRadius: 5, color: '#6ee7b7',
                  fontSize: 10, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Confirm & Stamp
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                style={{
                  padding: '6px 12px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(100,116,139,0.2)',
                  borderRadius: 5, color: '#475569',
                  fontSize: 10, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Submitted markers log */}
        {submitted.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              Submitted This Session ({submitted.length})
            </div>
            {submitted.map((m, i) => (
              <div key={i} style={{
                marginBottom: 6,
                padding: '6px 8px',
                background: m.stance === 'positive' ? 'rgba(110,231,183,0.05)' : 'rgba(239,68,68,0.05)',
                border: `1px solid ${m.stance === 'positive' ? 'rgba(110,231,183,0.2)' : 'rgba(239,68,68,0.2)'}`,
                borderRadius: 5,
                fontSize: 9,
              }}>
                <div style={{ color: m.stance === 'positive' ? '#6ee7b7' : '#f87171', fontWeight: 600 }}>
                  {m.stance === 'positive' ? '👍' : '⚠'} {m.content_ref}
                </div>
                <div style={{ color: '#475569', marginTop: 2 }}>
                  {m.marker_ids.join(', ')} · {new Date(m.ts).toISOString().slice(11, 19)}Z
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MarkerReportingFlow;
