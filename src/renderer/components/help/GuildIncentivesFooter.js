import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function GuildIncentivesFooter() {
    return (_jsxs("div", { style: s.footer, children: [_jsx("h3", { style: s.h3, children: "First-mover advantage" }), _jsxs("p", { style: s.p, children: ["Name your own chapter. Keep showing up \u2192 eligible to", ' ', _jsx("strong", { style: { color: '#f0fdf4' }, children: "vote to rename the Guild itself" }), ". Champion an answer that becomes Stone-Tablet canon \u2014 you're the", ' ', _jsx("em", { children: "champion to beat" }), ". The earlier you start, the more your contributions compound."] }), _jsxs("div", { style: s.marksTable, children: [_jsxs("div", { style: s.tableRow, children: [_jsx("span", { style: s.action, children: "Connect Discord or Reddit" }), _jsx("span", { style: s.marks, children: "\u2726 5 Marks each" })] }), _jsxs("div", { style: s.tableRow, children: [_jsx("span", { style: s.action, children: "Capture an eblet (per message)" }), _jsx("span", { style: s.marks, children: "\u2726 1 Mark" })] }), _jsxs("div", { style: s.tableRow, children: [_jsx("span", { style: s.action, children: "Eblet upvoted by \u22653 members" }), _jsx("span", { style: s.marks, children: "\u2726 +3 retroactive" })] }), _jsxs("div", { style: s.tableRow, children: [_jsx("span", { style: s.action, children: "Install report (verified by 3-voter concordance)" }), _jsx("span", { style: s.marks, children: "\u2726 +2 Marks" })] }), _jsxs("div", { style: s.tableRow, children: [_jsx("span", { style: s.action, children: "Community thread captured to Catacombs" }), _jsx("span", { style: s.marks, children: "\u2726 +3 Marks" })] }), _jsxs("div", { style: s.tableRow, children: [_jsx("span", { style: s.action, children: "Issue eblet triggers version demotion (\u03BA \u2265 0.85)" }), _jsx("span", { style: s.marks, children: "\u2726 +10 Marks" })] }), _jsxs("div", { style: s.tableRow, children: [_jsx("span", { style: s.action, children: "First to capture a Stone-Tablet answer" }), _jsx("span", { style: s.marks, children: "\u2726 +25 champion bonus" })] }), _jsxs("div", { style: s.tableRow, children: [_jsx("span", { style: s.action, children: "Name a chapter (Guild incentive)" }), _jsx("span", { style: s.marks, children: "\u2726 50 Marks" })] }), _jsxs("div", { style: s.tableRow, children: [_jsx("span", { style: s.action, children: "Vote-success to rename the Guild" }), _jsx("span", { style: s.marks, children: "\u2726 250 Marks" })] })] }), _jsx("button", { type: "button", onClick: () => window.amplify?.openExternal?.('https://lianabanyan.com/bounty/'), style: s.bountyBtn, children: "See Bounty Posters \u2192" })] }));
}
const s = {
    footer: {
        background: '#060b12',
        border: '1px solid #1e2a38',
        borderRadius: 8,
        padding: '16px 18px',
        marginBottom: 14,
    },
    h3: {
        margin: '0 0 8px',
        fontSize: 13,
        fontWeight: 700,
        color: '#6ee7b7',
    },
    p: {
        margin: '0 0 14px',
        fontSize: 12,
        color: '#94a3b8',
        lineHeight: 1.65,
    },
    marksTable: {
        marginBottom: 14,
    },
    tableRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '4px 0',
        borderBottom: '1px solid #111827',
        gap: 8,
        flexWrap: 'wrap',
    },
    action: {
        fontSize: 11,
        color: '#94a3b8',
        flex: 1,
        minWidth: 140,
    },
    marks: {
        fontSize: 11,
        color: '#6ee7b7',
        fontWeight: 600,
        whiteSpace: 'nowrap',
    },
    bountyBtn: {
        background: 'none',
        border: '1px solid #334155',
        borderRadius: 5,
        color: '#94a3b8',
        fontSize: 11,
        padding: '4px 12px',
        cursor: 'pointer',
        fontFamily: 'system-ui, sans-serif',
        outline: 'none',
    },
};
