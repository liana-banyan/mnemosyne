import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export const SALT_LEVEL_CONFIGS = {
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
// ─── Styles ───────────────────────────────────────────────────────────────────
const TIER_COLORS = {
    pinch: { active: '#94a3b8', border: 'rgba(148,163,184,0.5)', inactive: '#475569' },
    seasoning: { active: '#86efac', border: 'rgba(134,239,172,0.5)', inactive: '#475569' },
    preserved_open: { active: '#6ee7b7', border: 'rgba(110,231,183,0.5)', inactive: '#475569' },
    preserved_forever: { active: '#fbbf24', border: 'rgba(251,191,36,0.5)', inactive: '#475569' },
};
// ─── SaltLevelSelector ───────────────────────────────────────────────────────
export function SaltLevelSelector({ value, onChange, showPreservedSub = false, compact = false }) {
    const levels = showPreservedSub
        ? ['pinch', 'seasoning', 'preserved_open', 'preserved_forever']
        : ['pinch', 'seasoning', 'preserved_open'];
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: [_jsx("div", { style: { display: 'flex', gap: 6, flexWrap: 'wrap' }, children: levels.map((lvl) => {
                    const cfg = SALT_LEVEL_CONFIGS[lvl];
                    const col = TIER_COLORS[lvl];
                    const isActive = value === lvl;
                    return (_jsxs("button", { type: "button", onClick: () => onChange(lvl), title: cfg.description, style: {
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
                        }, children: [_jsx("span", { style: { fontSize: compact ? 12 : 14 }, children: cfg.icon }), _jsx("span", { children: cfg.label })] }, lvl));
                }) }), !compact && (_jsx("div", { style: {
                    fontSize: 11,
                    color: '#64748b',
                    padding: '4px 2px',
                    lineHeight: 1.5,
                }, children: SALT_LEVEL_CONFIGS[value].description }))] }));
}
// ─── Helper: hex → "r,g,b" for rgba() ────────────────────────────────────────
function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!m)
        return '148,163,184';
    return `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}`;
}
