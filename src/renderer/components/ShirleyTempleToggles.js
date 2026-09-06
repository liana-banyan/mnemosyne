import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ShirleyTempleToggles — BP060 Application 002 Step 1 · UI-2
// Religion + Politics content toggles at chamber root level.
// Per canon_second_door_political_expedition_wing_tower_of_peace_bp059.
// Founder direct: "so that it is easy to find" — placed at chamber root, NOT buried.
// Shirley Temple Policy umbrella: user-agency at every content-class layer.
// decay_class: BETWEEN on all substrate interactions.
import { useState, useEffect, useCallback } from 'react';
// ─── LocalStorage keys ────────────────────────────────────────────────────────
const LS_RELIGION_VISIBLE = 'shirley_temple_religion_visible';
const LS_POLITICS_VISIBLE = 'shirley_temple_politics_visible';
// ─── Component ────────────────────────────────────────────────────────────────
export function ShirleyTempleToggles() {
    const [religionVisible, setReligionVisible] = useState(() => localStorage.getItem(LS_RELIGION_VISIBLE) !== 'false');
    const [politicsVisible, setPoliticsVisible] = useState(() => localStorage.getItem(LS_POLITICS_VISIBLE) !== 'false');
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
    return (_jsxs("div", { style: { borderBottom: '1px solid rgba(100,116,139,0.12)', flexShrink: 0 }, children: [_jsxs("button", { onClick: () => setExpanded((e) => !e), title: "Shirley Temple Policy \u2014 content visibility settings (easy to find)", style: {
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
                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("span", { style: { fontSize: 9, color: anyOff ? '#f59e0b' : '#334155', fontWeight: 600 }, children: "Content Visibility" }), anyOff && (_jsx("span", { style: {
                                    fontSize: 8,
                                    background: 'rgba(245,158,11,0.15)',
                                    border: '1px solid rgba(245,158,11,0.3)',
                                    color: '#f59e0b',
                                    borderRadius: 8,
                                    padding: '1px 5px',
                                    fontWeight: 700,
                                }, children: "CUSTOM" })), _jsx("span", { style: { fontSize: 8, color: '#1e293b' }, children: [!religionVisible && 'Religion hidden', !politicsVisible && 'Politics hidden']
                                    .filter(Boolean).join(' · ') })] }), _jsx("span", { style: { fontSize: 9, color: '#334155' }, children: expanded ? '▲' : '▼' })] }), expanded && (_jsxs("div", { style: { padding: '8px 16px 10px', background: 'rgba(10,15,26,0.5)' }, children: [_jsxs("div", { style: { fontSize: 9, color: '#475569', marginBottom: 8, lineHeight: 1.5 }, children: [_jsx("strong", { style: { color: '#64748b' }, children: "Shirley Temple Policy" }), " \u00B7 Cooperative user-agency umbrella. Content behind the Second Door (Tower of Peace) is opt-in. Toggle freely \u2014 persists per device."] }), _jsx(ToggleRow, { label: "Religious references", sublabel: "Including Founder-authored religious content", icon: "\u271D", enabled: religionVisible, onToggle: toggleReligion, color: "#a78bfa" }), _jsx(ToggleRow, { label: "Political content", sublabel: "Political Expedition Wing \u2014 not LB-proper", icon: "\uD83C\uDFDB", enabled: politicsVisible, onToggle: togglePolitics, color: "#38bdf8" }), _jsx("div", { style: { fontSize: 8, color: '#1e293b', marginTop: 8, lineHeight: 1.4 }, children: "Actual tolerance = enduring what you dislike. Non-engagement = avoiding it. Both are valid \u2014 this toggle enables non-engagement, not forced tolerance. Founder ratified 2026-05-27 \u00B7 canon_second_door_bp059." })] }))] }));
}
// ─── Toggle row sub-component ─────────────────────────────────────────────────
function ToggleRow({ label, sublabel, icon, enabled, onToggle, color, }) {
    return (_jsxs("div", { style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 0',
            borderBottom: '1px solid rgba(100,116,139,0.08)',
        }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("span", { style: { fontSize: 12 }, children: icon }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 10, color: '#e2e8f0', fontWeight: 600 }, children: label }), _jsx("div", { style: { fontSize: 8, color: '#475569' }, children: sublabel })] })] }), _jsxs("button", { onClick: onToggle, title: `${enabled ? 'Hide' : 'Show'} ${label}`, "aria-label": `${label}: currently ${enabled ? 'visible' : 'hidden'}. Click to toggle.`, style: {
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
                }, children: [_jsx("span", { style: {
                            display: 'inline-block',
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: enabled ? color : '#334155',
                            flexShrink: 0,
                        } }), enabled ? 'ON' : 'OFF'] })] }));
}
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result)
        return '100,116,139';
    return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`;
}
// ─── Hook for consumers to read toggle state ──────────────────────────────────
export function useShirleyTempleToggles() {
    const [religionVisible, setReligionVisible] = useState(() => localStorage.getItem(LS_RELIGION_VISIBLE) !== 'false');
    const [politicsVisible, setPoliticsVisible] = useState(() => localStorage.getItem(LS_POLITICS_VISIBLE) !== 'false');
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
