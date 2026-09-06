import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// MnemosyneC · v0.2.0 · BP082 · LeanHelpTab — FAQ Card
// Sonnet 4.6 · Founder-ratified
import { useState } from 'react';
const FAQS = [
    {
        q: 'What is MnemosyneC?',
        a: 'MnemosyneC is a local-first AI memory overlay. It runs on your computer using Ollama + Gemma — your questions never leave your machine. The cooperative substrate lets you optionally share insights (with your consent) to earn Marks and help others.',
    },
    {
        q: 'How do I get Gemma working?',
        a: 'Go to the Home tab. If Ollama isn\'t installed, MnemosyneC will guide you through it. Once Ollama is running, the AI model downloads automatically (~4 GB). This only happens once.',
    },
    {
        q: 'What are Marks?',
        a: 'Marks are your cooperative credit. You earn them by connecting community accounts, capturing knowledge to the substrate, and helping other members. Early members earn more — name your chapter, vote on Guild decisions, champion Stone-Tablet answers.',
    },
    {
        q: 'What is the Guild?',
        a: 'The Liana Banyan Plumbing & Mechanics Guild is the community of MnemosyneC users. Members help each other debug, build, and remember. Join on Discord or Reddit — your eblets (captured knowledge) accrue Marks that compound over time.',
    },
    {
        q: 'Is my data private?',
        a: 'Yes. All AI inference is local (Ollama on your machine). Eblet capture is opt-in per message. Discord/Reddit OAuth tokens are stored encrypted in your OS keychain — never in plain text or localStorage.',
    },
    {
        q: 'What is an eblet?',
        a: 'An eblet is a captured unit of knowledge — a message, answer, or insight you decide is worth keeping. Click 📚 Save on any AI or community message to capture it to your local substrate. Your captured eblets can optionally be shared with the cooperative to help others (with your consent). Each capture earns 1 Mark.',
    },
];
export function FAQCard() {
    const [open, setOpen] = useState(null);
    return (_jsxs("div", { style: s.card, children: [_jsx("h2", { style: s.h2, children: "Frequently Asked Questions" }), FAQS.map((item, i) => (_jsxs("div", { style: s.faqItem, children: [_jsxs("button", { type: "button", onClick: () => setOpen(open === i ? null : i), style: s.faqQ, "aria-expanded": open === i, children: [_jsx("span", { style: { flex: 1, textAlign: 'left' }, children: item.q }), _jsx("span", { style: { color: '#6ee7b7', marginLeft: 8 }, children: open === i ? '▲' : '▼' })] }), open === i && (_jsx("div", { style: s.faqA, children: item.a }))] }, i)))] }));
}
const s = {
    card: {
        background: '#0d1117',
        border: '1px solid #1e2a38',
        borderRadius: 8,
        padding: '16px 18px',
        marginBottom: 14,
    },
    h2: {
        margin: '0 0 12px',
        fontSize: 14,
        fontWeight: 700,
        color: '#6ee7b7',
    },
    faqItem: {
        borderTop: '1px solid #1e2a38',
    },
    faqQ: {
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        background: 'none',
        border: 'none',
        color: '#e2e8f0',
        fontSize: 12,
        fontWeight: 500,
        padding: '9px 0',
        cursor: 'pointer',
        fontFamily: 'system-ui, sans-serif',
        outline: 'none',
        textAlign: 'left',
    },
    faqA: {
        fontSize: 12,
        color: '#94a3b8',
        lineHeight: 1.65,
        padding: '0 0 10px',
    },
};
