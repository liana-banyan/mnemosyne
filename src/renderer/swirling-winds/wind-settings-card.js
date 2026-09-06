import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// Ambience card — inline Tab 1 settings, BP047 Phase 1.
// The card is unlocked by the Mnemosyne brand-name easter egg. // KEEP: easter egg references parent-platform name
import { useEffect, useState } from 'react';
const LS_ENABLED = 'mnem_wind_enabled';
const LS_TIER = 'mnem_wind_tier';
const LS_MOTION_OVERRIDE = 'mnem_wind_motion_override';
const TIERS = ['OFF', 'WHISPER', 'BREEZE', 'GUST', 'STORM'];
export function WindSettingsCard({ onTierChange }) {
    const [tier, setTier] = useState(() => localStorage.getItem(LS_TIER) ?? 'BREEZE');
    const [savedTier, setSavedTier] = useState(tier);
    const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const [motionOverride, setMotionOverride] = useState(() => localStorage.getItem(LS_MOTION_OVERRIDE) === 'true');
    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const handler = (event) => setReducedMotion(event.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);
    useEffect(() => {
        const effectiveTier = reducedMotion && !motionOverride ? 'OFF' : tier;
        onTierChange(effectiveTier);
    }, [tier, reducedMotion, motionOverride, onTierChange]);
    function applyTier(next) {
        setTier(next);
        localStorage.setItem(LS_TIER, next);
        localStorage.setItem(LS_ENABLED, next !== 'OFF' ? 'true' : 'false');
    }
    function handleMotionOverride(checked) {
        setMotionOverride(checked);
        localStorage.setItem(LS_MOTION_OVERRIDE, checked ? 'true' : 'false');
    }
    const effectiveTier = reducedMotion && !motionOverride ? 'OFF' : tier;
    const isActive = effectiveTier !== 'OFF';
    const isDirty = tier !== savedTier;
    return (_jsxs("div", { className: "wind-settings-card", children: [_jsxs("div", { className: "wind-settings-card__header", children: [_jsxs("div", { className: "wind-settings-card__title", children: [_jsx("span", { "aria-hidden": true, children: "\uD83C\uDF2C\uFE0F" }), _jsx("span", { children: "Ambience" }), _jsx("small", { children: "Swirling winds background effect" })] }), _jsx("button", { type: "button", className: isActive ? 'wind-live-badge wind-live-badge--active' : 'wind-live-badge', onClick: () => applyTier(isActive ? 'OFF' : savedTier !== 'OFF' ? savedTier : 'BREEZE'), title: isActive ? 'Click to turn off immediately' : 'Click to restore ambience', "aria-label": isActive ? 'Ambience active, click to turn off' : 'Ambience off, click to restore', children: isActive ? 'LIVE' : 'OFF' })] }), _jsx("div", { className: "wind-tier-group", role: "radiogroup", "aria-label": "Ambience intensity", children: TIERS.map((option) => (_jsx("button", { type: "button", role: "radio", "aria-checked": tier === option, className: tier === option ? 'wind-tier wind-tier--active' : 'wind-tier', onClick: () => applyTier(option), onMouseEnter: () => onTierChange(reducedMotion && !motionOverride ? 'OFF' : option), onMouseLeave: () => onTierChange(effectiveTier), children: option }, option))) }), _jsx("div", { className: "wind-settings-card__actions", children: isDirty ? (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "wind-action", onClick: () => applyTier(savedTier), children: "Revert" }), _jsx("button", { type: "button", className: "wind-action wind-action--primary", onClick: () => setSavedTier(tier), children: "Save" })] })) : (_jsx("span", { className: "wind-saved-label", children: savedTier === 'OFF' ? 'Effect off' : `Saved: ${savedTier}` })) }), reducedMotion && (_jsxs("div", { className: "wind-reduced-motion", children: [_jsx("div", { children: "Motion disabled by system preference." }), _jsxs("div", { className: "wind-reduced-motion__actions", children: [_jsx("button", { type: "button", className: "wind-action wind-action--primary", onClick: () => {
                                    handleMotionOverride(true);
                                    applyTier(savedTier !== 'OFF' ? savedTier : 'BREEZE');
                                }, children: "I want it anyway" }), _jsx("button", { type: "button", className: "wind-action", onClick: () => {
                                    handleMotionOverride(false);
                                    applyTier('OFF');
                                }, children: "Keep off" }), _jsx("button", { type: "button", className: "wind-action", onClick: () => {
                                    handleMotionOverride(true);
                                    applyTier('BREEZE');
                                }, children: "BREEZE only" })] })] }))] }));
}
