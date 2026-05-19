// FAQTab — Mnemosyne CAI Amplifier FAQ
// Tab 5 (always visible) — BP047 W1
// tl;dr summary view by default · "Show full steps" toggle per entry
// STARTER SET — 7 seed entries — surface to Founder for ratification/trimming

import React, { useState } from 'react';

interface FaqEntry {
  id: string;
  question: string;
  tldr: string;
  full: string;
}

const FAQ_ENTRIES: FaqEntry[] = [
  {
    id: 'what-is-mnemosyne',
    question: 'What is Mnemosyne?',
    tldr: 'A substrate layer that makes any AI faster and cheaper by caching what it knows locally.',
    full: 'Mnemosyne is a local AI substrate — a Cathedral — that stores compressed semantic knowledge on your own hardware. Every query gets routed through the Cathedral first, dramatically reducing how much work any external AI model has to do. Speed increases, cost drops, and accuracy improves because the model is starting from a richer, pre-loaded context. Works with any AI model, or none at all.',
  },
  {
    id: 'internet-required',
    question: 'Does it require an internet connection?',
    tldr: 'No. Stages 1 and 2 run fully offline.',
    full: 'Mnemosyne is designed to run on any hardware, any network — or no network at all. Stage 1 (Baseline) and Stage 2 (Cathedral Alone) are fully offline. Stage 3+ bring in AI models, which may require network access depending on whether you are using a local model (Ollama) or a cloud model (Anthropic, etc.). Local Ollama runs entirely offline.',
  },
  {
    id: 'what-is-gauntlet',
    question: 'What is the Gauntlet?',
    tldr: 'A 6-stage empirical test that proves Mnemosyne works on your hardware.',
    full: 'The Gauntlet is the core validation framework:\n• Stage 1: Baseline — raw AI or no-AI, no Mnemosyne\n• Stage 2: Cathedral Alone — substrate only, no LLM, proves "or NONE AT ALL"\n• Stage 3: + Any AI — Cathedral + AI model of your choice (Pioneer Bonus fires here)\n• Stage 4: Yoked AI — cross-vendor symmetric AI yoke\n• Stage 5: Orchestration — Wave / Drekaskip / Novacula / AutoBaton\n• Stage 6: Federation — cross-Cathedral peer-mesh (requires membership)\nEach stage produces a Banyan Metric score. Running the Gauntlet earns marks.',
  },
  {
    id: 'cost',
    question: 'Do I need to pay?',
    tldr: 'Free forever. $5/year optional cooperative membership unlocks Helm and Stage 6.',
    full: 'Mnemosyne is free to use forever. No credit card, no trial that expires, no hidden limits. The cooperative membership ($5/year) unlocks:\n• Tab 2 — Helm (the LB platform bridge)\n• Stage 6 — Federation (cross-Cathedral peer-mesh)\n• Banyan Metric sharing + Code Breakers marks\nThe $5 goes toward the cooperative, not to a corporation. "Free to use. Better to join."',
  },
  {
    id: 'what-is-ollama',
    question: 'What is Ollama?',
    tldr: 'A free, local AI model runner. Mnemosyne includes it as a default AI option — no cloud costs.',
    full: 'Ollama (https://ollama.ai) is an open-source tool that lets you run large language models locally on your own machine — no GPU required for most models, though GPU accelerates performance. Mnemosyne uses Ollama as its default onboard AI option, meaning you can run Stage 3+ without any API key or cloud account. Ollama supports dozens of models including Llama, Mistral, Gemma, and many more. All data stays on your machine.',
  },
  {
    id: 'pledge-2260',
    question: 'What is the Cooperative Defensive Patent Pledge #2260?',
    tldr: 'A legal pledge that your use of Mnemosyne is defensive — you agree not to weaponize the patents.',
    full: 'The Cooperative Defensive Patent Pledge #2260 is a formal agreement that covers developers who unlock Developer Mode. By signing, you agree:\n1. You will only use Mnemosyne\'s patented methods in a cooperative, non-offensive way\n2. You will not use the innovations to initiate patent litigation against cooperative members\n3. Your development work is attributed in the Banyan Metric registry\nThe Pledge protects the cooperative commons. It is required for Developer Mode, not for general use.',
  },
  {
    id: 'any-hardware',
    question: 'What does "any hardware, any network, any AI, or NONE AT ALL" mean?',
    tldr: 'Mnemosyne works without a GPU, without internet, without any AI model. Stage 2 proves it.',
    full: 'This is the core empirical claim. Mnemosyne\'s substrate (the Cathedral) runs the same on:\n• Any hardware — laptop, desktop, server, low-spec machine. No GPU required.\n• Any network — fast fiber, slow WiFi, cellular, air-gapped. Stage 2 is fully offline.\n• Any AI — Ollama local, Anthropic cloud, OpenAI, any compatible endpoint.\n• NONE AT ALL — Stage 2 (Cathedral Alone) produces measurable results with zero AI involvement.\nThe Gauntlet exists specifically to prove these claims on your hardware, not in a lab.',
  },
];

export function FAQTab() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  return (
    <div style={{
      padding: '12px 16px',
      overflowY: 'auto',
      height: '100%',
      boxSizing: 'border-box',
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: 10,
      }}>
        ❓ Frequently Asked Questions
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {FAQ_ENTRIES.map((entry) => {
          const isOpen = expanded.has(entry.id);
          return (
            <div
              key={entry.id}
              style={{
                background: 'rgba(15,23,42,0.6)',
                border: `1px solid ${isOpen ? 'rgba(110,231,183,0.2)' : 'rgba(100,116,139,0.15)'}`,
                borderRadius: 8,
                overflow: 'hidden',
                transition: 'border-color 0.15s',
              }}
            >
              {/* Question row */}
              <button
                onClick={() => toggle(entry.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 8,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '9px 12px',
                  textAlign: 'left',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.4 }}>
                    {entry.question}
                  </div>
                  {!isOpen && (
                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 3, lineHeight: 1.5 }}>
                      {entry.tldr}
                    </div>
                  )}
                </div>
                <div style={{
                  fontSize: 10,
                  color: '#475569',
                  flexShrink: 0,
                  marginTop: 1,
                  transform: isOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.15s',
                }}>
                  ▾
                </div>
              </button>

              {/* Expanded content */}
              {isOpen && (
                <div style={{
                  padding: '0 12px 10px',
                  borderTop: '1px solid rgba(100,116,139,0.1)',
                }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#6ee7b7', marginTop: 8, marginBottom: 4 }}>
                    tl;dr
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.6, marginBottom: 8 }}>
                    {entry.tldr}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                    Full answer
                  </div>
                  <div style={{
                    fontSize: 10,
                    color: '#64748b',
                    lineHeight: 1.7,
                    whiteSpace: 'pre-line',
                  }}>
                    {entry.full}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 9, color: '#1e293b', marginTop: 14, textAlign: 'center' }}>
        Starter set · BP047 W1 · awaiting Founder ratification
      </div>
    </div>
  );
}
