import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// SAGA 5 — HELM VIEW: HelmShelf
// A single collapsible shelf (left / right / bottom) containing DeckCardSlots.
// Allotment handles inter-slot resizing within the shelf.
// Bridge canon station label rendered in header.
import { useState } from 'react';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import { STATION_META } from './HelmTypes';
import { DeckCardSlot } from './DeckCardSlot';
import { HelmDecksPicker } from './HelmDecksPicker';
const SHELF_COLLAPSED_STYLE = {
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
export function HelmShelf({ shelfId, cards, collapsed, station, onToggleCollapse, onAddCard, onRemoveCard, onMoveUp, onMoveDown, onMoveTo, onSwapCard, onReorder, direction = 'column', }) {
    const [pickerOpen, setPickerOpen] = useState(false);
    const [swappingCardId, setSwappingCardId] = useState(undefined);
    const [dragFrom, setDragFrom] = useState(null);
    const stationMeta = STATION_META[station];
    const isVertical = direction === 'column';
    const handleSwapCard = (cardId) => {
        setSwappingCardId(cardId);
        setPickerOpen(true);
    };
    const handlePickerSelect = (newCardId, targetShelf) => {
        if (swappingCardId) {
            onSwapCard(swappingCardId, newCardId);
        }
        else {
            onAddCard(newCardId);
        }
        setSwappingCardId(undefined);
    };
    const handleDrop = (targetIndex) => {
        if (!dragFrom)
            return;
        if (dragFrom.index !== targetIndex) {
            onReorder(dragFrom.index, targetIndex);
        }
        setDragFrom(null);
    };
    // Collapsed strip
    if (collapsed) {
        return (_jsxs("div", { style: SHELF_COLLAPSED_STYLE[shelfId], onClick: onToggleCollapse, role: "button", tabIndex: 0, onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onToggleCollapse();
            } }, title: `Expand ${stationMeta.label} shelf`, "aria-expanded": false, "aria-label": `Expand ${stationMeta.label} shelf — currently collapsed`, children: [_jsx("span", { style: { fontSize: '1rem', color: '#a0aec0', lineHeight: 1 }, children: "\u22EE" }), cards.length > 0 && (_jsx("span", { style: {
                        background: '#f6ad55', color: '#1a1a2e', fontSize: '0.6rem',
                        fontWeight: 700, padding: '1px 5px', borderRadius: '8px', lineHeight: 1.2,
                    }, children: cards.length })), _jsxs("span", { style: {
                        writingMode: isVertical ? 'vertical-rl' : 'horizontal-tb',
                        transform: isVertical ? 'rotate(180deg)' : undefined,
                        fontSize: '0.6rem', color: '#718096', letterSpacing: '0.1em',
                        fontWeight: 700, marginTop: isVertical ? '0.5rem' : 0,
                    }, children: [stationMeta.icon, " ", stationMeta.label.toUpperCase()] })] }));
    }
    // Expanded shelf
    const shelfContainerStyle = shelfId === 'bottom'
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
    return (_jsxs("div", { style: shelfContainerStyle, children: [_jsxs("div", { style: shelfHeaderStyle, children: [_jsx("span", { style: { fontSize: '0.85rem', lineHeight: 1 }, children: stationMeta.icon }), _jsxs("span", { style: shelfHeaderLabel, children: [stationMeta.label, " Station"] }), _jsx("button", { style: addCardBtn, onClick: () => { setSwappingCardId(undefined); setPickerOpen(true); }, title: "Add card from Helm Decks Library", "aria-label": `Add card to ${stationMeta.label} station`, children: "+ Card" }), _jsx("button", { style: collapseBtn, onClick: onToggleCollapse, title: "Collapse shelf", "aria-label": `Collapse ${stationMeta.label} shelf`, "aria-expanded": true, children: "\u22EE" })] }), _jsx("div", { style: { flex: 1, overflow: 'hidden', minHeight: 0 }, children: cards.length === 0 ? (_jsx("div", { style: emptyShelfStyle, children: _jsx("span", { style: { fontSize: '0.72rem', color: '#4a5568' }, children: "No cards \u00B7 click \"+ Card\" to add from Helm Decks Library" }) })) : (_jsx(Allotment, { vertical: direction === 'column', children: cards.map((cardId, idx) => (_jsx(Allotment.Pane, { minSize: 80, children: _jsx("div", { style: { height: '100%', display: 'flex', flexDirection: 'column', padding: 2 }, children: _jsx(DeckCardSlot, { cardId: cardId, shelf: shelfId, index: idx, totalInShelf: cards.length, onSwap: handleSwapCard, onMoveUp: () => onMoveUp(cardId), onMoveDown: () => onMoveDown(cardId), onMoveTo: (targetShelf) => onMoveTo(cardId, targetShelf), onRemove: () => onRemoveCard(cardId), onDragStart: (cid, i) => setDragFrom({ cardId: cid, index: i }), onDrop: handleDrop }) }) }, cardId))) })) }), pickerOpen && (_jsx(HelmDecksPicker, { onSelect: handlePickerSelect, onClose: () => { setPickerOpen(false); setSwappingCardId(undefined); }, swappingCardId: swappingCardId, swappingShelf: shelfId, defaultShelf: shelfId }))] }));
}
const shelfHeaderStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '4px 8px',
    background: '#111120',
    borderBottom: '1px solid #2d3748',
    fontSize: '0.7rem',
    flexShrink: 0,
};
const shelfHeaderLabel = {
    flex: 1,
    fontWeight: 700,
    color: '#cbd5e0',
    letterSpacing: '0.04em',
    fontSize: '0.7rem',
};
const addCardBtn = {
    background: 'none',
    border: '1px solid #2d3748',
    borderRadius: '3px',
    color: '#a0aec0',
    cursor: 'pointer',
    fontSize: '0.65rem',
    padding: '1px 6px',
};
const collapseBtn = {
    background: 'none',
    border: 'none',
    color: '#a0aec0',
    cursor: 'pointer',
    fontSize: '1rem',
    lineHeight: 1,
    padding: '0 4px',
    borderRadius: '3px',
};
const emptyShelfStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
    height: '100%',
    textAlign: 'center',
};
