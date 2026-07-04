// DeckCuePullup.tsx — Shared bottom-sheet cue card pullup · BP067 Phase 3A
// Shared by Battery Dispatch (T15) and Broadcast Schedule (T16).
// Slides up from the bottom when cue cards are triggered; slides down on dismiss.

import React, { useEffect, useRef, useState } from 'react';
import type { CueCard } from '../hooks/useDeckCue';

interface DeckCuePullupProps {
  cards: CueCard[];
  isOpen: boolean;
  onDismiss: (id: string) => void;
  onClose: () => void;
}

export function DeckCuePullup({ cards, isOpen, onDismiss, onClose }: DeckCuePullupProps) {
  const [visible, setVisible] = useState(false);
  const [animClass, setAnimClass] = useState<'entering' | 'entered' | 'exiting'>('entering');
  const prevOpenRef = useRef(isOpen);

  // Animate in/out
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      setVisible(true);
      setAnimClass('entering');
      requestAnimationFrame(() => setAnimClass('entered'));
    } else if (!isOpen && prevOpenRef.current) {
      setAnimClass('exiting');
      const t = setTimeout(() => setVisible(false), 280);
      return () => clearTimeout(t);
    }
    prevOpenRef.current = isOpen;
  }, [isOpen]);

  if (!visible || cards.length === 0) return null;

  const translateY = animClass === 'entered' ? '0%' : '110%';

  return (
    <div
      role="region"
      aria-label="Deck Cue Cards"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 8000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0 16px 16px',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 600,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          transform: `translateY(${translateY})`,
          transition: animClass === 'exiting'
            ? 'transform 0.28s cubic-bezier(0.4, 0, 0.8, 0.6)'
            : 'transform 0.3s cubic-bezier(0.2, 0, 0, 1)',
          pointerEvents: 'auto',
        }}
      >
        {cards.map((card) => (
          <CueCardItem key={card.id} card={card} onDismiss={() => onDismiss(card.id)} />
        ))}

        {/* Dismiss all button (shown when 2+ cards) */}
        {cards.length > 1 && (
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '5px 0',
              background: 'transparent',
              border: 'none',
              color: '#334155',
              fontSize: 10,
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            Dismiss all
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Single cue card ─────────────────────────────────────────────────────────

function CueCardItem({ card, onDismiss }: { card: CueCard; onDismiss: () => void }) {
  return (
    <div
      style={{
        background: 'rgba(10,15,26,0.97)',
        border: '1px solid rgba(110,231,183,0.2)',
        borderRadius: 10,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }}
    >
      {/* Hen icon */}
      <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1 }}>🐓</span>

      {/* Content */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6ee7b7', marginBottom: 3 }}>
          {card.title}
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
          {card.body}
        </div>
      </div>

      {/* Dismiss */}
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{
          background: 'none',
          border: 'none',
          color: '#334155',
          cursor: 'pointer',
          fontSize: 14,
          flexShrink: 0,
          padding: '0 2px',
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </div>
  );
}
