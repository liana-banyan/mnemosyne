// SEG-K23-D — What This Is For: flip-card bounty deck

import React, { useState, useCallback } from 'react';

export interface WhatThisIsForTabProps {
  onSwitchTab?: (tab: string) => void;
}

interface DeckCard {
  slug: string;
  title: string;
  hook: string;
  body: string;
  cta: string;
}

const DECK_CARDS: DeckCard[] = [
  {
    slug: 'name-the-empress-stop-the-nothing',
    title: 'Name the Empress. Stop the Nothing.',
    hook: 'Be a Bastion, in a Time of Storms. One name. One country. Permanent IP attribution. 60 slots.',
    body: 'The cooperative substrate has a governance layer coming online. It needs a name — not a product name, but a constitutional name. 60 winners, one per country. Each winner receives a patent floater slot, permanent IP Ledger attribution via Ed25519 stamp, and Founding Foundation status. Propose a name. Write a rationale. Claim your country slot. Stop the Nothing.',
    cta: 'Name the Empress →',
  },
  {
    slug: '12-cities-competition',
    title: 'EMPLOY THE WORLD — Grab a City. Build the Guild.',
    hook: 'The 12 Cities Project is open. Name your city, seed your chapter. Win Marks and permanent IP attribution.',
    body: 'The cooperative is expanding into 12 target cities via Guild Chapters rooted in gaming communities. Each city needs a Project Manager to identify anchor gaming communities, approach admins, and seed cooperative substrate participation. First organizer to reach threshold claims the chapter. Marks + permanent attribution + founding leadership role.',
    cta: 'Claim a City →',
  },
  {
    slug: 'take-the-captains-wheel',
    title: 'EMPLOY THE WORLD — Grab an Oar. We\'re Rowing as We Build the Sails.',
    hook: 'Fork MnemosyneC, build something real, earn Marks and a patent floater slot. Best builders become NOIDs.',
    body: 'Fork MnemosyneC, build a real contribution, submit via Battery Dispatch. NANO (0.05M) / CORE (1M) / ULTRA (10M) tiers. ULTRA earns patent floater eligibility from the 75-slot Puzzle pool. NOIDs = Noble Order of Idea Developers — the LB R&D team built from this pipeline. Your name goes in the IP Ledger permanently on acceptance.',
    cta: 'Join the Dev Crew →',
  },
  {
    slug: 'join-csia-project-ground-floor',
    title: 'Join the CSIA Project. Ground Floor. Now.',
    hook: 'Build something we use. Your name in the IP Ledger. When it earns — you earn 20%.',
    body: 'The Cooperative Substrate Inference Architecture (CSIA) is how the cooperative substrate thinks — eblets, catacombs, pheromone trails, CEL-based reasoning, Three Fates routing. $250 submission to Phase 1 juried review (or $50 + 10hrs Stewards Guild). When your patent licenses: you earn 20% of NET licensing revenue. Build something real. This is the ground floor.',
    cta: 'Join CSIA →',
  },
  {
    slug: 'build-a-better-site-than-this',
    title: 'EMPLOY THE WORLD — Make a Better Website than THIS',
    hook: 'If you can build a better mnemosynec.org, prove it. Winner\'s design goes live, permanent credit, Marks, patent floater.',
    body: 'Deliver a working HTML/CSS/JS redesign of mnemosynec.org. Real page, not a mockup. WCAG AA accessibility. Canon banner preserved verbatim ("Substrate Replaces New Data Centers."). Substrate-compounding chart preserved. ULTRA winner\'s design becomes the live brochure with permanent footer credit + 10 Marks + patent floater slot eligibility.',
    cta: 'Build a Better Site →',
  },
];

const CARD_W = 280;
const CARD_H = 320;

function FlipCard({ card, index, flipped, onFlip }: { card: DeckCard; index: number; flipped: boolean; onFlip: (i: number) => void }) {
  const openExternal = () => window.amplify?.openExternal?.('https://mnemosynec.org');

  return (
    <div
      style={{
        width: CARD_W,
        height: CARD_H,
        perspective: 1200,
        cursor: 'pointer',
      }}
      onClick={() => onFlip(index)}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.6s',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* Front face */}
        <div
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backfaceVisibility: 'hidden',
            padding: 20,
            boxSizing: 'border-box',
            backgroundColor: 'rgba(30, 50, 40, 0.85)',
            border: '1px solid rgba(100, 200, 150, 0.3)',
            borderRadius: 6,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#8bc8a0', lineHeight: 1.4, marginBottom: 12 }}>
              {card.title}
            </div>
            <div style={{ fontSize: 12, color: '#a0b0a8', lineHeight: 1.5 }}>
              {card.hook}
            </div>
          </div>
          <div style={{ fontSize: 10, color: '#606060', textAlign: 'right' }}>
            Click to flip →
          </div>
        </div>

        {/* Back face */}
        <div
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            padding: 20,
            boxSizing: 'border-box',
            backgroundColor: 'rgba(30, 40, 50, 0.9)',
            border: '1px solid rgba(100, 200, 150, 0.3)',
            borderRadius: 6,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontSize: 11, color: '#a0b0a8', lineHeight: 1.5, overflowY: 'auto', flex: 1 }}>
            {card.body}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexShrink: 0 }}>
            <button
              type="button"
              onClick={openExternal}
              style={{
                flex: 1,
                padding: '6px 10px',
                backgroundColor: 'rgba(100, 200, 150, 0.15)',
                border: '1px solid rgba(100, 200, 150, 0.5)',
                borderRadius: 4,
                color: '#8bc8a0',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {card.cta}
            </button>
            <button
              type="button"
              onClick={() => onFlip(index)}
              style={{
                padding: '6px 10px',
                backgroundColor: 'transparent',
                border: '1px solid rgba(100, 200, 150, 0.3)',
                borderRadius: 4,
                color: '#707070',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              ← Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WhatThisIsForTab(props: WhatThisIsForTabProps) {
  const { onSwitchTab } = props;
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());

  const toggleFlip = useCallback((index: number) => {
    setFlippedCards((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  return (
    <div style={{ padding: 16, height: '100%', boxSizing: 'border-box', overflowY: 'auto' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 16 }}>
        What This Is For
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {DECK_CARDS.map((card, index) => (
          <FlipCard
            key={card.slug}
            card={card}
            index={index}
            flipped={flippedCards.has(index)}
            onFlip={toggleFlip}
          />
        ))}
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
        <div style={{ fontSize: 12, color: '#7a9b8a', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Cross-initiative actions:
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => onSwitchTab?.('kitchen')}
            style={{
              padding: '6px 14px',
              backgroundColor: 'transparent',
              border: '1px solid rgba(100, 200, 150, 0.3)',
              borderRadius: 4,
              color: '#8bc8a0',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            The Kitchen →
          </button>
          <button
            type="button"
            onClick={() => onSwitchTab?.('household-scheduler')}
            style={{
              padding: '6px 14px',
              backgroundColor: 'transparent',
              border: '1px solid rgba(100, 200, 150, 0.3)',
              borderRadius: 4,
              color: '#8bc8a0',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Household Scheduler →
          </button>
        </div>
      </div>
    </div>
  );
}
