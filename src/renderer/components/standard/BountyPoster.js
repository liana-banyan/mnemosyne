import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const CARD_STYLE = {
    width: 280,
    padding: 16,
    backgroundColor: 'rgba(30, 40, 50, 0.8)',
    border: '1px solid rgba(100, 200, 150, 0.3)',
    borderRadius: 6,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
};
const LABEL_STYLE = {
    fontSize: 10,
    color: '#7a9b8a',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 2,
};
const TEXT_STYLE = {
    fontSize: 12,
    color: '#a0b0a8',
    lineHeight: 1.5,
    margin: 0,
};
export function BountyPoster(props) {
    const { posterId, headline, whatIsNeeded, whyItMatters, memberGets, onClaim, claimLabel = 'TAKE THE WHEEL →' } = props;
    return (_jsxs("div", { style: CARD_STYLE, children: [_jsx("div", { style: { fontSize: 14, fontWeight: 700, color: '#8bc8a0', lineHeight: 1.4 }, children: headline }), _jsxs("div", { children: [_jsx("div", { style: LABEL_STYLE, children: "What's Needed" }), _jsx("p", { style: TEXT_STYLE, children: whatIsNeeded })] }), _jsxs("div", { children: [_jsx("div", { style: LABEL_STYLE, children: "Why It Matters" }), _jsx("p", { style: TEXT_STYLE, children: whyItMatters })] }), _jsxs("div", { children: [_jsx("div", { style: LABEL_STYLE, children: "What You Get" }), _jsx("p", { style: TEXT_STYLE, children: memberGets })] }), _jsx("button", { type: "button", onClick: () => onClaim(posterId), style: {
                    marginTop: 4,
                    padding: '8px 14px',
                    backgroundColor: 'rgba(100, 200, 150, 0.15)',
                    border: '1px solid rgba(100, 200, 150, 0.5)',
                    borderRadius: 4,
                    color: '#8bc8a0',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    alignSelf: 'flex-start',
                }, children: claimLabel })] }));
}
