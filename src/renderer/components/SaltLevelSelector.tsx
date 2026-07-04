// SaltLevelSelector.tsx — v0.4.1 BP083
// Three-tier Salt Level persistence selector.
// Founder-ratified: "A Pinch of Salt · Seasoning · Preserved in Salt"
// Per BP051 Heart of Peace: Glow surfaces attention — NEVER gates access.

import React from 'react';

// ─── Types (mirrored from diagnosis_types.ts — renderer can't import main) ───

export type SaltLevel = 'pinch' | 'seasoning' | 'preserved_open' | 'preserved_forever';

export interface SaltLevelConfig {
  level: SaltLevel;
  label: string;
  icon: string;
  description: string;
  networkScope: 'local' | 'constellation' | 'cross-cathedral';
  autoExpiry?: number;
  autoEscalateAfter?: number;
}

export const SALT_LEVEL_CONFIGS: Record<SaltLevel, SaltLevelConfig> = {
  pinch: {
    level: 'pinch',
    label: 'A Pinch of Salt',
    icon: '🧂',
    description: 'Quick local answer · ephemeral · no network',
    networkScope: 'local',
  },
  seasoning: {
    level: 'seasoning',
    label: 'Seasoning',
    icon: '🌿',
    description: 'Ask + Linger · Constellation keeps working · 24h–1 week',
    autoExpiry: 7 * 24 * 60 * 60 * 1000,
    autoEscalateAfter: 24 * 60 * 60 * 1000,
    networkScope: 'constellation',
  },
  preserved_open: {
    level: 'preserved_open',
    label: 'Preserved in Salt',
    icon: '🫙',
    description: 'Post as Diagnosis · open until answered · optional bounty',
    networkScope: 'cross-cathedral',
  },
  preserved_forever: {
    level: 'preserved_forever',
    label: 'Preserved Forever',
    icon: '♾️',
    description: 'Canon-class archival · never auto-deletes · 1-year pheromone-fade → Catacomb',
    autoExpiry: 365 * 24 * 60 * 60 * 1000,
    networkScope: 'cross-cathedral',
  },
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SaltLevelSelectorProps {
  value: SaltLevel;
  onChange: (level: SaltLevel) => void;
  /** When true, show Open/Forever sub-selector for preserved tiers */
  showPreservedSub?: boolean;
  compact?: boolean;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const TIER_COLORS: Record<SaltLevel, { active: string; border: string; inactive: string }> = {
  pinch:             { active: '#94a3b8', border: 'rgba(148,163,184,0.5)', inactive: '#475569' },
  seasoning:         { active: '#86efac', border: 'rgba(134,239,172,0.5)', inactive: '#475569' },
  preserved_open:    { active: '#6ee7b7', border: 'rgba(110,231,183,0.5)', inactive: '#475569' },
  preserved_forever: { active: '#fbbf24', border: 'rgba(251,191,36,0.5)',  inactive: '#475569' },
};

// ─── SaltLevelSelector ───────────────────────────────────────────────────────

export function SaltLevelSelector({ value, onChange, showPreservedSub = false, compact = false }: SaltLevelSelectorProps) {
  const levels: SaltLevel[] = showPreservedSub
    ? ['pinch', 'seasoning', 'preserved_open', 'preserved_forever']
    : ['pinch', 'seasoning', 'preserved_open'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Tier buttons */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {levels.map((lvl) => {
          const cfg = SALT_LEVEL_CONFIGS[lvl];
          const col = TIER_COLORS[lvl];
          const isActive = value === lvl;
          return (
            <button
              key={lvl}
              type="button"
              onClick={() => onChange(lvl)}
              title={cfg.description}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: compact ? 4 : 5,
                padding: compact ? '4px 10px' : '6px 12px',
                background: isActive ? `rgba(${hexToRgb(col.active)}, 0.12)` : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isActive ? col.border : 'rgba(100,116,139,0.25)'}`,
                borderRadius: 6,
                color: isActive ? col.active : col.inactive,
                fontSize: compact ? 11 : 12,
                fontWeight: isActive ? 700 : 400,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
                outline: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ fontSize: compact ? 12 : 14 }}>{cfg.icon}</span>
              <span>{cfg.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active tier description */}
      {!compact && (
        <div style={{
          fontSize: 11,
          color: '#64748b',
          padding: '4px 2px',
          lineHeight: 1.5,
        }}>
          {SALT_LEVEL_CONFIGS[value].description}
        </div>
      )}
    </div>
  );
}

// ─── Helper: hex → "r,g,b" for rgba() ────────────────────────────────────────

function hexToRgb(hex: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return '148,163,184';
  return `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}`;
}
