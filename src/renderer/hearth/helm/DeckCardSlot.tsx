// SAGA 5 — HELM VIEW: DeckCardSlot
// Wrapper around any Deck Card component. Provides:
//   - Right-click context menu (Swap / Move up / Move down / Move to shelf / Remove / Pin)
//   - HTML5 drag-and-drop for reorder within a shelf
//   - Card header with icon + label

import { useState, useRef, useCallback } from 'react';
import type { CardId, ShelfId } from './HelmTypes';
import { CARD_COMPONENTS, CARD_META_LIST } from './CardRegistry';

interface DeckCardSlotProps {
  cardId: CardId;
  shelf: ShelfId;
  index: number;
  totalInShelf: number;
  onSwap: (cardId: CardId) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMoveTo: (shelf: ShelfId) => void;
  onRemove: () => void;
  onDragStart: (cardId: CardId, index: number) => void;
  onDrop: (targetIndex: number) => void;
}

const OTHER_SHELVES: Record<ShelfId, ShelfId[]> = {
  left:   ['right', 'bottom'],
  right:  ['left', 'bottom'],
  bottom: ['left', 'right'],
};

const SHELF_LABELS: Record<ShelfId, string> = {
  left:   '← Left shelf',
  right:  '→ Right shelf',
  bottom: '↓ Bottom shelf',
};

export function DeckCardSlot({
  cardId, shelf, index, totalInShelf,
  onSwap, onMoveUp, onMoveDown, onMoveTo, onRemove,
  onDragStart, onDrop,
}: DeckCardSlotProps) {
  const meta = CARD_META_LIST.find((m) => m.id === cardId)!;
  const CardComponent = CARD_COMPONENTS[cardId];

  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [draggingOver, setDraggingOver] = useState(false);
  const slotRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setMenuPos(null), []);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ x: e.clientX, y: e.clientY });
  };

  // HTML5 drag-and-drop
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `${shelf}:${index}:${cardId}`);
    onDragStart(cardId, index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDraggingOver(true);
  };

  const handleDragLeave = () => setDraggingOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggingOver(false);
    onDrop(index);
  };

  return (
    <>
      <div
        ref={slotRef}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onContextMenu={handleContextMenu}
        style={{
          ...slotStyles.slot,
          borderColor: draggingOver ? '#f6ad55' : '#2d3748',
          background: draggingOver ? 'rgba(246,173,85,0.06)' : '#0f0f1a',
        }}
      >
        {/* Card header */}
        <div style={slotStyles.header}>
          <span style={slotStyles.headerIcon}>{meta?.icon ?? '📦'}</span>
          <span style={slotStyles.headerLabel}>{meta?.label ?? cardId}</span>
          <button
            style={slotStyles.menuBtn}
            onClick={(e) => { e.stopPropagation(); handleContextMenu(e as unknown as React.MouseEvent); }}
            title="Card options — swap, move, remove"
            aria-label={`${meta?.label ?? cardId} card options`}
          >⋮</button>
        </div>

        {/* Card body */}
        <div style={slotStyles.body}>
          <CardComponent />
        </div>
      </div>

      {/* Context menu overlay */}
      {menuPos && (
        <>
          <div style={slotStyles.menuBackdrop} onClick={closeMenu} />
          <div
            style={{ ...slotStyles.menu, left: menuPos.x, top: menuPos.y }}
            onMouseLeave={closeMenu}
          >
            <div style={slotStyles.menuHeader}>{meta?.icon} {meta?.label}</div>
            <button style={slotStyles.menuItem} onClick={() => { closeMenu(); onSwap(cardId); }}>
              🔀 Swap card…
            </button>
            {index > 0 && (
              <button style={slotStyles.menuItem} onClick={() => { closeMenu(); onMoveUp(); }}>
                ⬆ Move up
              </button>
            )}
            {index < totalInShelf - 1 && (
              <button style={slotStyles.menuItem} onClick={() => { closeMenu(); onMoveDown(); }}>
                ⬇ Move down
              </button>
            )}
            <div style={slotStyles.menuDivider} />
            {OTHER_SHELVES[shelf].map((targetShelf) => (
              <button
                key={targetShelf}
                style={slotStyles.menuItem}
                onClick={() => { closeMenu(); onMoveTo(targetShelf); }}
              >
                {SHELF_LABELS[targetShelf]}
              </button>
            ))}
            <div style={slotStyles.menuDivider} />
            <button
              style={{ ...slotStyles.menuItem, color: '#fc8181' }}
              onClick={() => { closeMenu(); onRemove(); }}
            >
              ✕ Remove
            </button>
          </div>
        </>
      )}
    </>
  );
}

const slotStyles: Record<string, React.CSSProperties> = {
  slot: {
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid #2d3748',
    borderRadius: '6px',
    overflow: 'hidden',
    flex: '1 1 0',
    minHeight: 80,
    transition: 'border-color 0.15s, background 0.15s',
    cursor: 'grab',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '4px 8px',
    background: '#1a1a2e',
    borderBottom: '1px solid #2d3748',
    flexShrink: 0,
    userSelect: 'none',
  },
  headerIcon: { fontSize: '0.85rem', lineHeight: 1 },
  headerLabel: {
    flex: 1,
    fontSize: '0.7rem',
    fontWeight: 600,
    color: '#a0aec0',
    letterSpacing: '0.03em',
  },
  menuBtn: {
    background: 'none',
    border: 'none',
    color: '#718096',
    cursor: 'pointer',
    fontSize: '0.9rem',
    lineHeight: 1,
    padding: '0 4px',
    borderRadius: '3px',
    flexShrink: 0,
  },
  body: {
    flex: 1,
    overflow: 'auto',
    minHeight: 0,
  },
  menuBackdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 9998,
  },
  menu: {
    position: 'fixed',
    zIndex: 9999,
    background: '#1a1a2e',
    border: '1px solid #4a5568',
    borderRadius: '6px',
    padding: '4px 0',
    minWidth: 180,
    boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
  },
  menuHeader: {
    padding: '6px 12px',
    fontSize: '0.72rem',
    color: '#f6ad55',
    fontWeight: 700,
    borderBottom: '1px solid #2d3748',
    marginBottom: 2,
  },
  menuItem: {
    display: 'block',
    width: '100%',
    background: 'none',
    border: 'none',
    color: '#e2e8f0',
    padding: '5px 12px',
    fontSize: '0.75rem',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'background 0.1s',
  },
  menuDivider: {
    height: 1,
    background: '#2d3748',
    margin: '3px 0',
  },
};
