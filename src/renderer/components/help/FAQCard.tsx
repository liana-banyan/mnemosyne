// MnemosyneC · v0.2.0 · BP082 · LeanHelpTab — FAQ Card
// Sonnet 4.6 · Founder-ratified

import React, { useState } from 'react';

interface FAQItem {
  q: string;
  a: string;
}

const FAQS: FAQItem[] = [
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
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div style={s.card}>
      <h2 style={s.h2}>Frequently Asked Questions</h2>
      {FAQS.map((item, i) => (
        <div key={i} style={s.faqItem}>
          <button
            type="button"
            onClick={() => setOpen(open === i ? null : i)}
            style={s.faqQ}
            aria-expanded={open === i}
          >
            <span style={{ flex: 1, textAlign: 'left' }}>{item.q}</span>
            <span style={{ color: '#6ee7b7', marginLeft: 8 }}>{open === i ? '▲' : '▼'}</span>
          </button>
          {open === i && (
            <div style={s.faqA}>{item.a}</div>
          )}
        </div>
      ))}
    </div>
  );
}

const s = {
  card: {
    background: '#0d1117',
    border: '1px solid #1e2a38',
    borderRadius: 8,
    padding: '16px 18px',
    marginBottom: 14,
  } as React.CSSProperties,
  h2: {
    margin: '0 0 12px',
    fontSize: 14,
    fontWeight: 700,
    color: '#6ee7b7',
  } as React.CSSProperties,
  faqItem: {
    borderTop: '1px solid #1e2a38',
  } as React.CSSProperties,
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
  } as React.CSSProperties,
  faqA: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 1.65,
    padding: '0 0 10px',
  } as React.CSSProperties,
};
