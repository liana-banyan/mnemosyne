// MnemosyneC · v0.2.0 · BP082 · LeanHelpTab — FAQ Card
// Sonnet 4.6 · Founder-ratified

import React, { useState } from 'react';

interface FAQItem {
  q: string;
  a: string;
}

const FAQS: FAQItem[] = [
  // D-BP223-BM0-X029-018 (Founder k/0ee57a97): shared verbatim with FAQTab.tsx and the site FAQ.
  {
    q: "What will this do to my machine?",
    a: "It still works, and you, the user, have precedence.\n\nMnemosyneC keeps a library of answers on your computer and can run a small AI model on it. Most answers come straight from the library, with no AI model at all. On one of our own desktops (8 GB graphics card) it answered 300 test questions in 3.78 milliseconds each, with zero AI model calls (measured September 16, 2026).\n\nWhen it does use a model, the small model we run on our 8 GB desktops (gemma2:2b) took about 1.8 GB of graphics memory when we measured it on an 8 GB card. On a different card, with longer questions, we measured about 3.3 GB.\n\n\"You come first\" is ON by default. While you are using the computer, background AI work pauses: answering questions for other members, warm-ups, test runs, and Homework. It picks back up when you step away. Sharing small files with other members keeps going, because it uses almost nothing. It never opens a window, never takes focus, and never touches your web browser.\n\nTo turn it off: Settings, then \"You come first\", then OFF.",
  },
  {
    q: "Can I still use my computer?",
    a: "Yes. It still works, and you have precedence.\n\nWith \"You come first\" ON (the default), MnemosyneC pauses its background AI work when:\n- you have typed or moved the mouse in the last 2 minutes,\n- a full-screen video, game, or presentation is in front, or\n- your graphics card does not have room for the AI model right now, or its free memory cannot be read.\n\nIt resumes on its own once the computer has been idle. Work that has to wait stays in line, so nothing is lost. Questions you ask it yourself are never paused, because you asked them.\n\nIt never pops up windows, never steals focus, and never touches your browser, whether the setting is on or off.\n\nThe check for a full-screen video or game takes about a third of a second in a hidden background process (measured September 16, 2026). It only runs after you have been away from the keyboard and mouse for 2 minutes and there is work waiting.\n\nOne thing it cannot see yet: a video playing in a normal, not full-screen, window while you don't touch the mouse. If that ever stutters, make the video full screen, or wiggle the mouse.\n\nWant it to run at full speed instead? Open Settings and turn \"You come first\" OFF. Anything it produces while you are using the computer is then labeled \"desktop in use\".",
  },
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
    // D-BP223-BM0-X029-018: keep paragraph and list breaks in multi-paragraph answers (single-line answers unchanged).
    whiteSpace: 'pre-line',
  } as React.CSSProperties,
};
