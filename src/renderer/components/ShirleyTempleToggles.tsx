// ShirleyTempleToggles — BP060 Application 002 Step 1 · UI-2
// Religion + Politics content toggles at chamber root level.
// Per canon_second_door_political_expedition_wing_tower_of_peace_bp059.
// Founder direct: "so that it is easy to find" — placed at chamber root, NOT buried.
// Shirley Temple Policy umbrella: user-agency at every content-class layer.
// decay_class: BETWEEN on all substrate interactions.

import React, { useState, useEffect, useCallback } from 'react';

// ─── LocalStorage keys ────────────────────────────────────────────────────────

const LS_RELIGION_VISIBLE = 'shirley_temple_religion_visible';
const LS_POLITICS_VISIBLE  = 'shirley_temple_politics_visible';

// ─── Component ────────────────────────────────────────────────────────────────

export function ShirleyTempleToggles() {
  const [religionVisible, setReligionVisible] = useState(() =>
    localStorage.getItem(LS_RELIGION_VISIBLE) !== 'false'
  );
  const [politicsVisible, setPoliticsVisible] = useState(() =>
    localStorage.getItem(LS_POLITICS_VISIBLE) !== 'false'
  );
  const [expanded, setExpanded] = useState(false);

  const toggleReligion = useCallback(() => {
    const next = !religionVisible;
    setReligionVisible(next);
    localStorage.setItem(LS_RELIGION_VISIBLE, String(next));
  }, [religionVisible]);

  const togglePolitics = useCallback(() => {
    const next = !politicsVisible;
    setPoliticsVisible(next);
    localStorage.setItem(LS_POLITICS_VISIBLE, String(next));
  }, [politicsVisible]);

  // Indicator: show amber dot when any toggle is OFF
  const anyOff = !religionVisible || !politicsVisible;

  return (
    <div style={{ borderBottom: '1px solid rgba(100,116,139,0.12)', flexShrink: 0 }}>
      {/* Collapsed row — always visible at chamber root */}
      <button
        onClick={() => setExpanded((e) => !e)}
        title="Shirley Temple Policy — content visibility settings (easy to find)"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: anyOff ? 'rgba(245,158,11,0.04)' : 'transparent',
          border: 'none',
          borderBottom: expanded ? '1px solid rgba(100,116,139,0.1)' : 'none',
          padding: '5px 16px',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9, color: anyOff ? '#f59e0b' : '#334155', fontWeight: 600 }}>
            Content Visibility
          </span>
          {anyOff && (
            <span style={{
              fontSize: 8,
              background: 'rgba(245,158,11,0.15)',
              border: '1px solid rgba(245,158,11,0.3)',
              color: '#f59e0b',
              borderRadius: 8,
              padding: '1px 5px',
              fontWeight: 700,
            }}>
              CUSTOM
            </span>
          )}
          <span style={{ fontSize: 8, color: '#1e293b' }}>
            {[!religionVisible && 'Religion hidden', !politicsVisible && 'Politics hidden']
              .filter(Boolean).join(' · ')}
          </span>
        </div>
        <span style={{ fontSize: 9, color: '#334155' }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div style={{ padding: '8px 16px 10px', background: 'rgba(10,15,26,0.5)' }}>
          <div style={{ fontSize: 9, color: '#475569', marginBottom: 8, lineHeight: 1.5 }}>
            <strong style={{ color: '#64748b' }}>Shirley Temple Policy</strong> · Cooperative user-agency umbrella.
            Content behind the Second Door (Tower of Peace) is opt-in. Toggle freely — persists per device.
          </div>

          {/* Religion toggle */}
          <ToggleRow
            label="Religious references"
            sublabel="Including Founder-authored religious content"
            icon="✝"
            enabled={religionVisible}
            onToggle={toggleReligion}
            color="#a78bfa"
          />

          {/* Politics toggle */}
          <ToggleRow
            label="Political content"
            sublabel="Political Expedition Wing — not LB-proper"
            icon="🏛"
            enabled={politicsVisible}
            onToggle={togglePolitics}
            color="#38bdf8"
          />

          <div style={{ fontSize: 8, color: '#1e293b', marginTop: 8, lineHeight: 1.4 }}>
            Actual tolerance = enduring what you dislike. Non-engagement = avoiding it.
            Both are valid — this toggle enables non-engagement, not forced tolerance.
            Founder ratified 2026-05-27 · canon_second_door_bp059.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Toggle row sub-component ─────────────────────────────────────────────────

function ToggleRow({
  label,
  sublabel,
  icon,
  enabled,
  onToggle,
  color,
}: {
  label: string;
  sublabel: string;
  icon: string;
  enabled: boolean;
  onToggle: () => void;
  color: string;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '6px 0',
      borderBottom: '1px solid rgba(100,116,139,0.08)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12 }}>{icon}</span>
        <div>
          <div style={{ fontSize: 10, color: '#e2e8f0', fontWeight: 600 }}>{label}</div>
          <div style={{ fontSize: 8, color: '#475569' }}>{sublabel}</div>
        </div>
      </div>
      <button
        onClick={onToggle}
        title={`${enabled ? 'Hide' : 'Show'} ${label}`}
        aria-label={`${label}: currently ${enabled ? 'visible' : 'hidden'}. Click to toggle.`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          background: enabled ? `rgba(${hexToRgb(color)},0.12)` : 'rgba(100,116,139,0.1)',
          border: `1px solid ${enabled ? color + '55' : 'rgba(100,116,139,0.2)'}`,
          borderRadius: 12,
          color: enabled ? color : '#475569',
          fontSize: 9,
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: enabled ? color : '#334155',
          flexShrink: 0,
        }} />
        {enabled ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '100,116,139';
  return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`;
}

// ─── Hook for consumers to read toggle state ──────────────────────────────────

export function useShirleyTempleToggles() {
  const [religionVisible, setReligionVisible] = useState(() =>
    localStorage.getItem(LS_RELIGION_VISIBLE) !== 'false'
  );
  const [politicsVisible, setPoliticsVisible] = useState(() =>
    localStorage.getItem(LS_POLITICS_VISIBLE) !== 'false'
  );

  useEffect(() => {
    const handler = () => {
      setReligionVisible(localStorage.getItem(LS_RELIGION_VISIBLE) !== 'false');
      setPoliticsVisible(localStorage.getItem(LS_POLITICS_VISIBLE) !== 'false');
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return { religionVisible, politicsVisible };
}

export default ShirleyTempleToggles;
