// SAGA 5 — HELM VIEW: HelmShelf
// A single collapsible shelf (left / right / bottom) containing DeckCardSlots.
// Allotment handles inter-slot resizing within the shelf.
// Bridge canon station label rendered in header.

import { useState } from 'react';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import type { ShelfId, CardId, StationId } from './HelmTypes';
import { STATION_META } from './HelmTypes';
import { DeckCardSlot } from './DeckCardSlot';
import { HelmDecksPicker } from './HelmDecksPicker';

interface HelmShelfProps {
  shelfId: ShelfId;
  cards: CardId[];
  collapsed: boolean;
  station: StationId;
  onToggleCollapse: () => void;
  onAddCard: (cardId: CardId) => void;
  onRemoveCard: (cardId: CardId) => void;
  onMoveUp: (cardId: CardId) => void;
  onMoveDown: (cardId: CardId) => void;
  onMoveTo: (cardId: CardId, targetShelf: ShelfId) => void;
  onSwapCard: (oldCardId: CardId, newCardId: CardId) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  /** For vertical shelves: 'column'; for bottom horizontal: 'row' */
  direction?: 'column' | 'row';
}

const SHELF_COLLAPSED_STYLE: Record<ShelfId, React.CSSProperties> = {
  left: {
    width: 28,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0',
    background: '#0a0a14',
    borderRight: '1px solid #2d3748',
    cursor: 'pointer',
    userSelect: 'none',
    flexShrink: 0,
  },
  right: {
    width: 28,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0',
    background: '#0a0a14',
    borderLeft: '1px solid #2d3748',
    cursor: 'pointer',
    userSelect: 'none',
    flexShrink: 0,
  },
  bottom: {
    height: 28,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0 0.5rem',
    background: '#0a0a12',
    borderTop: '1px solid #2d3748',
    cursor: 'pointer',
    userSelect: 'none',
    flexShrink: 0,
  },
};

export function HelmShelf({
  shelfId, cards, collapsed, station,
  onToggleCollapse, onAddCard, onRemoveCard,
  onMoveUp, onMoveDown, onMoveTo, onSwapCard, onReorder,
  direction = 'column',
}: HelmShelfProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [swappingCardId, setSwappingCardId] = useState<CardId | undefined>(undefined);
  const [dragFrom, setDragFrom] = useState<{ cardId: CardId; index: number } | null>(null);

  const stationMeta = STATION_META[station];
  const isVertical = direction === 'column';

  const handleSwapCard = (cardId: CardId) => {
    setSwappingCardId(cardId);
    setPickerOpen(true);
  };

  const handlePickerSelect = (newCardId: CardId, targetShelf: ShelfId) => {
    if (swappingCardId) {
      onSwapCard(swappingCardId, newCardId);
    } else {
      onAddCard(newCardId);
    }
    setSwappingCardId(undefined);
  };

  const handleDrop = (targetIndex: number) => {
    if (!dragFrom) return;
    if (dragFrom.index !== targetIndex) {
      onReorder(dragFrom.index, targetIndex);
    }
    setDragFrom(null);
  };

  // Collapsed strip
  if (collapsed) {
    return (
      <div
        style={SHELF_COLLAPSED_STYLE[shelfId]}
        onClick={onToggleCollapse}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleCollapse(); } }}
        title={`Expand ${stationMeta.label} shelf`}
        aria-expanded={false}
        aria-label={`Expand ${stationMeta.label} shelf — currently collapsed`}
      >
        <span style={{ fontSize: '1rem', color: '#a0aec0', lineHeight: 1 }}>⋮</span>
        {cards.length > 0 && (
          <span style={{
            background: '#f6ad55', color: '#1a1a2e', fontSize: '0.6rem',
            fontWeight: 700, padding: '1px 5px', borderRadius: '8px', lineHeight: 1.2,
          }}>{cards.length}</span>
        )}
        <span style={{
          writingMode: isVertical ? 'vertical-rl' : 'horizontal-tb',
          transform: isVertical ? 'rotate(180deg)' : undefined,
          fontSize: '0.6rem', color: '#718096', letterSpacing: '0.1em',
          fontWeight: 700, marginTop: isVertical ? '0.5rem' : 0,
        }}>
          {stationMeta.icon} {stationMeta.label.toUpperCase()}
        </span>
      </div>
    );
  }

  // Expanded shelf
  const shelfContainerStyle: React.CSSProperties = shelfId === 'bottom'
    ? {
        display: 'flex',
        flexDirection: 'column',
        background: '#0a0a12',
        borderTop: '1px solid #2d3748',
        flexShrink: 0,
        overflow: 'hidden',
      }
    : {
        display: 'flex',
        flexDirection: 'column',
        background: '#0a0a14',
        borderLeft: shelfId === 'right' ? '1px solid #2d3748' : undefined,
        borderRight: shelfId === 'left' ? '1px solid #2d3748' : undefined,
        overflow: 'hidden',
        flex: shelfId === 'right' ? '0 0 300px' : '0 0 260px',
        minWidth: 220,
      };

  return (
    <div style={shelfContainerStyle}>
      {/* Shelf header */}
      <div style={shelfHeaderStyle}>
        <span style={{ fontSize: '0.85rem', lineHeight: 1 }}>{stationMeta.icon}</span>
        <span style={shelfHeaderLabel}>
          {stationMeta.label} Station
        </span>
        <button
          style={addCardBtn}
          onClick={() => { setSwappingCardId(undefined); setPickerOpen(true); }}
          title="Add card from Helm Decks Library"
          aria-label={`Add card to ${stationMeta.label} station`}
        >+ Card</button>
        <button
          style={collapseBtn}
          onClick={onToggleCollapse}
          title="Collapse shelf"
          aria-label={`Collapse ${stationMeta.label} shelf`}
          aria-expanded={true}
        >⋮</button>
      </div>

      {/* Card slots — allotment for resizable splits */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {cards.length === 0 ? (
          <div style={emptyShelfStyle}>
            <span style={{ fontSize: '0.72rem', color: '#4a5568' }}>
              No cards · click "+ Card" to add from Helm Decks Library
            </span>
          </div>
        ) : (
          <Allotment vertical={direction === 'column'}>
            {cards.map((cardId, idx) => (
              <Allotment.Pane key={cardId} minSize={80}>
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 2 }}>
                  <DeckCardSlot
                    cardId={cardId}
                    shelf={shelfId}
                    index={idx}
                    totalInShelf={cards.length}
                    onSwap={handleSwapCard}
                    onMoveUp={() => onMoveUp(cardId)}
                    onMoveDown={() => onMoveDown(cardId)}
                    onMoveTo={(targetShelf) => onMoveTo(cardId, targetShelf)}
                    onRemove={() => onRemoveCard(cardId)}
                    onDragStart={(cid, i) => setDragFrom({ cardId: cid, index: i })}
                    onDrop={handleDrop}
                  />
                </div>
              </Allotment.Pane>
            ))}
          </Allotment>
        )}
      </div>

      {/* Helm Decks Library picker */}
      {pickerOpen && (
        <HelmDecksPicker
          onSelect={handlePickerSelect}
          onClose={() => { setPickerOpen(false); setSwappingCardId(undefined); }}
          swappingCardId={swappingCardId}
          swappingShelf={shelfId}
          defaultShelf={shelfId}
        />
      )}
    </div>
  );
}

const shelfHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.35rem',
  padding: '4px 8px',
  background: '#111120',
  borderBottom: '1px solid #2d3748',
  fontSize: '0.7rem',
  flexShrink: 0,
};

const shelfHeaderLabel: React.CSSProperties = {
  flex: 1,
  fontWeight: 700,
  color: '#cbd5e0',
  letterSpacing: '0.04em',
  fontSize: '0.7rem',
};

const addCardBtn: React.CSSProperties = {
  background: 'none',
  border: '1px solid #2d3748',
  borderRadius: '3px',
  color: '#a0aec0',
  cursor: 'pointer',
  fontSize: '0.65rem',
  padding: '1px 6px',
};

const collapseBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#a0aec0',
  cursor: 'pointer',
  fontSize: '1rem',
  lineHeight: 1,
  padding: '0 4px',
  borderRadius: '3px',
};

const emptyShelfStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1.5rem',
  height: '100%',
  textAlign: 'center',
};
