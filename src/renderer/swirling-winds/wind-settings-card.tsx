// Ambience card — inline Tab 1 settings, BP047 Phase 1.
// The card is unlocked by the Mnemosyne brand-name easter egg.

import React, { useEffect, useState } from 'react';
import type { WindTier } from './canvas-2d-wind';

const LS_ENABLED = 'mnem_wind_enabled';
const LS_TIER = 'mnem_wind_tier';
const LS_MOTION_OVERRIDE = 'mnem_wind_motion_override';

const TIERS: WindTier[] = ['OFF', 'WHISPER', 'BREEZE', 'GUST', 'STORM'];

interface WindSettingsCardProps {
  onTierChange: (tier: WindTier) => void;
}

export function WindSettingsCard({ onTierChange }: WindSettingsCardProps) {
  const [tier, setTier] = useState<WindTier>(() => (localStorage.getItem(LS_TIER) as WindTier | null) ?? 'BREEZE');
  const [savedTier, setSavedTier] = useState<WindTier>(tier);
  const [reducedMotion, setReducedMotion] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [motionOverride, setMotionOverride] = useState(() =>
    localStorage.getItem(LS_MOTION_OVERRIDE) === 'true',
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const effectiveTier = reducedMotion && !motionOverride ? 'OFF' : tier;
    onTierChange(effectiveTier);
  }, [tier, reducedMotion, motionOverride, onTierChange]);

  function applyTier(next: WindTier) {
    setTier(next);
    localStorage.setItem(LS_TIER, next);
    localStorage.setItem(LS_ENABLED, next !== 'OFF' ? 'true' : 'false');
  }

  function handleMotionOverride(checked: boolean) {
    setMotionOverride(checked);
    localStorage.setItem(LS_MOTION_OVERRIDE, checked ? 'true' : 'false');
  }

  const effectiveTier = reducedMotion && !motionOverride ? 'OFF' : tier;
  const isActive = effectiveTier !== 'OFF';
  const isDirty = tier !== savedTier;

  return (
    <div className="wind-settings-card">
      <div className="wind-settings-card__header">
        <div className="wind-settings-card__title">
          <span aria-hidden>🌬️</span>
          <span>Ambience</span>
          <small>Swirling winds background effect</small>
        </div>
        <button
          type="button"
          className={isActive ? 'wind-live-badge wind-live-badge--active' : 'wind-live-badge'}
          onClick={() => applyTier(isActive ? 'OFF' : savedTier !== 'OFF' ? savedTier : 'BREEZE')}
          title={isActive ? 'Click to turn off immediately' : 'Click to restore ambience'}
          aria-label={isActive ? 'Ambience active, click to turn off' : 'Ambience off, click to restore'}
        >
          {isActive ? 'LIVE' : 'OFF'}
        </button>
      </div>

      <div className="wind-tier-group" role="radiogroup" aria-label="Ambience intensity">
        {TIERS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={tier === option}
            className={tier === option ? 'wind-tier wind-tier--active' : 'wind-tier'}
            onClick={() => applyTier(option)}
            onMouseEnter={() => onTierChange(reducedMotion && !motionOverride ? 'OFF' : option)}
            onMouseLeave={() => onTierChange(effectiveTier)}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="wind-settings-card__actions">
        {isDirty ? (
          <>
            <button type="button" className="wind-action" onClick={() => applyTier(savedTier)}>
              Revert
            </button>
            <button type="button" className="wind-action wind-action--primary" onClick={() => setSavedTier(tier)}>
              Save
            </button>
          </>
        ) : (
          <span className="wind-saved-label">{savedTier === 'OFF' ? 'Effect off' : `Saved: ${savedTier}`}</span>
        )}
      </div>

      {reducedMotion && (
        <div className="wind-reduced-motion">
          <div>Motion disabled by system preference.</div>
          <div className="wind-reduced-motion__actions">
            <button
              type="button"
              className="wind-action wind-action--primary"
              onClick={() => {
                handleMotionOverride(true);
                applyTier(savedTier !== 'OFF' ? savedTier : 'BREEZE');
              }}
            >
              I want it anyway
            </button>
            <button
              type="button"
              className="wind-action"
              onClick={() => {
                handleMotionOverride(false);
                applyTier('OFF');
              }}
            >
              Keep off
            </button>
            <button
              type="button"
              className="wind-action"
              onClick={() => {
                handleMotionOverride(true);
                applyTier('BREEZE');
              }}
            >
              BREEZE only
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
