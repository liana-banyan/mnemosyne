import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// SAGA 5 — HELM VIEW: DeckCardSlot
// Wrapper around any Deck Card component. Provides:
//   - Right-click context menu (Swap / Move up / Move down / Move to shelf / Remove / Pin)
//   - HTML5 drag-and-drop for reorder within a shelf
//   - Card header with icon + label
import { useState, useRef, useCallback } from 'react';
import { CARD_COMPONENTS, CARD_META_LIST } from './CardRegistry';
const OTHER_SHELVES = {
    left: ['right', 'bottom'],
    right: ['left', 'bottom'],
    bottom: ['left', 'right'],
};
const SHELF_LABELS = {
    left: '← Left shelf',
    right: '→ Right shelf',
    bottom: '↓ Bottom shelf',
};
export function DeckCardSlot({ cardId, shelf, index, totalInShelf, onSwap, onMoveUp, onMoveDown, onMoveTo, onRemove, onDragStart, onDrop, }) {
    const meta = CARD_META_LIST.find((m) => m.id === cardId);
    const CardComponent = CARD_COMPONENTS[cardId];
    const [menuPos, setMenuPos] = useState(null);
    const [draggingOver, setDraggingOver] = useState(false);
    const slotRef = useRef(null);
    const closeMenu = useCallback(() => setMenuPos(null), []);
    const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setMenuPos({ x: e.clientX, y: e.clientY });
    };
    // HTML5 drag-and-drop
    const handleDragStart = (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', `${shelf}:${index}:${cardId}`);
        onDragStart(cardId, index);
    };
    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDraggingOver(true);
    };
    const handleDragLeave = () => setDraggingOver(false);
    const handleDrop = (e) => {
        e.preventDefault();
        setDraggingOver(false);
        onDrop(index);
    };
    return (_jsxs(_Fragment, { children: [_jsxs("div", { ref: slotRef, draggable: true, onDragStart: handleDragStart, onDragOver: handleDragOver, onDragLeave: handleDragLeave, onDrop: handleDrop, onContextMenu: handleContextMenu, style: {
                    ...slotStyles.slot,
                    borderColor: draggingOver ? '#f6ad55' : '#2d3748',
                    background: draggingOver ? 'rgba(246,173,85,0.06)' : '#0f0f1a',
                }, children: [_jsxs("div", { style: slotStyles.header, children: [_jsx("span", { style: slotStyles.headerIcon, children: meta?.icon ?? '📦' }), _jsx("span", { style: slotStyles.headerLabel, children: meta?.label ?? cardId }), _jsx("button", { style: slotStyles.menuBtn, onClick: (e) => { e.stopPropagation(); handleContextMenu(e); }, title: "Card options \u2014 swap, move, remove", "aria-label": `${meta?.label ?? cardId} card options`, children: "\u22EE" })] }), _jsx("div", { style: slotStyles.body, children: _jsx(CardComponent, {}) })] }), menuPos && (_jsxs(_Fragment, { children: [_jsx("div", { style: slotStyles.menuBackdrop, onClick: closeMenu }), _jsxs("div", { style: { ...slotStyles.menu, left: menuPos.x, top: menuPos.y }, onMouseLeave: closeMenu, children: [_jsxs("div", { style: slotStyles.menuHeader, children: [meta?.icon, " ", meta?.label] }), _jsx("button", { style: slotStyles.menuItem, onClick: () => { closeMenu(); onSwap(cardId); }, children: "\uD83D\uDD00 Swap card\u2026" }), index > 0 && (_jsx("button", { style: slotStyles.menuItem, onClick: () => { closeMenu(); onMoveUp(); }, children: "\u2B06 Move up" })), index < totalInShelf - 1 && (_jsx("button", { style: slotStyles.menuItem, onClick: () => { closeMenu(); onMoveDown(); }, children: "\u2B07 Move down" })), _jsx("div", { style: slotStyles.menuDivider }), OTHER_SHELVES[shelf].map((targetShelf) => (_jsx("button", { style: slotStyles.menuItem, onClick: () => { closeMenu(); onMoveTo(targetShelf); }, children: SHELF_LABELS[targetShelf] }, targetShelf))), _jsx("div", { style: slotStyles.menuDivider }), _jsx("button", { style: { ...slotStyles.menuItem, color: '#fc8181' }, onClick: () => { closeMenu(); onRemove(); }, children: "\u2715 Remove" })] })] }))] }));
}
const slotStyles = {
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
