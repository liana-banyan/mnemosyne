import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import locFaqContent from '../content/grand-project-loc-faq.md?raw';
export function LocFaqPanel() {
    return (_jsx("div", { style: {
            padding: '16px 20px',
            maxWidth: 720,
            overflowY: 'auto',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            color: '#e2e8f0',
            lineHeight: 1.7,
        }, children: _jsx(ReactMarkdown, { remarkPlugins: [remarkGfm], components: {
                h1: ({ children }) => (_jsx("h1", { style: { fontSize: 17, fontWeight: 700, color: '#6ee7b7', marginBottom: 8, marginTop: 0 }, children: children })),
                h2: ({ children }) => (_jsx("h2", { style: { fontSize: 15, fontWeight: 700, color: '#6ee7b7', marginBottom: 6, marginTop: 20 }, children: children })),
                h3: ({ children }) => (_jsx("h3", { style: { fontSize: 13, fontWeight: 700, color: '#93c5fd', marginBottom: 5, marginTop: 18 }, children: children })),
                p: ({ children }) => (_jsx("p", { style: { fontSize: 12, color: '#94a3b8', marginBottom: 10, marginTop: 0 }, children: children })),
                strong: ({ children }) => (_jsx("strong", { style: { color: '#e2e8f0', fontWeight: 700 }, children: children })),
                em: ({ children }) => (_jsx("em", { style: { color: '#94a3b8', fontStyle: 'italic' }, children: children })),
                ul: ({ children }) => (_jsx("ul", { style: { paddingLeft: 18, marginBottom: 10, marginTop: 4 }, children: children })),
                ol: ({ children }) => (_jsx("ol", { style: { paddingLeft: 18, marginBottom: 10, marginTop: 4 }, children: children })),
                li: ({ children }) => (_jsx("li", { style: { fontSize: 12, color: '#94a3b8', marginBottom: 4 }, children: children })),
                a: ({ href, children }) => (_jsx("a", { href: href, onClick: (e) => {
                        e.preventDefault();
                        if (href)
                            window.amplify?.openExternal?.(href);
                    }, style: { color: '#6ee7b7', textDecoration: 'underline', textDecorationColor: 'rgba(110,231,183,0.4)' }, children: children })),
                code: ({ children }) => (_jsx("code", { style: {
                        background: 'rgba(100,116,139,0.15)',
                        border: '1px solid rgba(100,116,139,0.2)',
                        borderRadius: 4,
                        padding: '1px 5px',
                        fontFamily: 'monospace',
                        fontSize: 11,
                        color: '#94a3b8',
                    }, children: children })),
                blockquote: ({ children }) => (_jsx("blockquote", { style: {
                        borderLeft: '3px solid rgba(110,231,183,0.4)',
                        paddingLeft: 12,
                        marginLeft: 0,
                        marginRight: 0,
                        marginBottom: 10,
                        color: '#64748b',
                        fontStyle: 'italic',
                    }, children: children })),
                hr: () => (_jsx("hr", { style: { border: 'none', borderTop: '1px solid rgba(100,116,139,0.15)', margin: '14px 0' } })),
            }, children: locFaqContent }) }));
}
// ─── LocFaqModal ──────────────────────────────────────────────────────────────
// Full overlay modal wrapper for LocFaqPanel.
export function LocFaqModal({ onClose }) {
    return (_jsx("div", { style: {
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            zIndex: 300,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            overflowY: 'auto',
            padding: '32px 16px',
        }, onClick: onClose, children: _jsxs("div", { style: {
                background: '#0f172a',
                border: '1px solid rgba(100,116,139,0.25)',
                borderRadius: 12,
                width: '100%',
                maxWidth: 760,
                boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
                position: 'relative',
                maxHeight: '90vh',
                overflowY: 'auto',
            }, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { style: {
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 20px',
                        borderBottom: '1px solid rgba(100,116,139,0.15)',
                        position: 'sticky',
                        top: 0,
                        background: '#0f172a',
                        zIndex: 1,
                    }, children: [_jsx("div", { style: { fontSize: 13, fontWeight: 700, color: '#6ee7b7' }, children: "Library of Congress Grand Project \u2014 FAQ" }), _jsx("button", { onClick: onClose, style: {
                                background: 'none',
                                border: 'none',
                                color: '#64748b',
                                cursor: 'pointer',
                                fontSize: 18,
                                lineHeight: 1,
                                padding: '2px 6px',
                            }, "aria-label": "Close FAQ", children: "\u00D7" })] }), _jsx(LocFaqPanel, {})] }) }));
}
