import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { MEMBERSHIP_ANNUAL_FEE_USD, CREATOR_KEEP_PERCENT } from '../../../shared/membership_types';
export function CoopTouch({ onLearnMore, compact }) {
    return (_jsxs("div", { style: {
            background: 'rgba(110,231,183,0.05)',
            border: '1px solid rgba(110,231,183,0.18)',
            borderRadius: 8,
            padding: compact ? '8px 12px' : '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
        }, children: [_jsx("span", { style: { fontSize: compact ? 14 : 16 }, children: "\uD83C\uDF3F" }), _jsx("div", { style: { flex: 1, minWidth: 220 }, children: _jsxs("div", { style: { fontSize: compact ? 11 : 12, color: '#94a3b8', lineHeight: 1.5 }, children: ["MnemosyneC is built by a members-owned cooperative. For", ' ', _jsxs("strong", { style: { color: '#6ee7b7' }, children: ["$", MEMBERSHIP_ANNUAL_FEE_USD, "/year"] }), ", you become a member and share in how the cooperative allocates what it earns back to the people who build and use it -- Workers, Builders, and Creators keep", ' ', _jsxs("strong", { style: { color: '#6ee7b7' }, children: [CREATOR_KEEP_PERCENT, "%"] }), "."] }) }), _jsx("button", { onClick: onLearnMore, style: {
                    background: 'none',
                    border: '1px solid rgba(110,231,183,0.3)',
                    borderRadius: 6,
                    color: '#6ee7b7',
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '4px 10px',
                    cursor: 'pointer',
                    fontFamily: 'system-ui, sans-serif',
                    whiteSpace: 'nowrap',
                }, children: "About membership \u2192" })] }));
}
export default CoopTouch;
