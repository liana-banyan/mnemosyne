import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// SAGA 5 — HELM VIEW: Helm Decks Library Picker
// Modal/popover: searchable list of all available Deck Cards.
// Filter by category: substrate / activity / agent / ledger / custom.
import { useState, useMemo } from 'react';
import { CARD_META_LIST } from './CardRegistry';
const CATEGORIES = [
    { id: 'all', label: '✦ All' },
    { id: 'substrate', label: '🔬 Substrate' },
    { id: 'activity', label: '🌊 Activity' },
    { id: 'agent', label: '📡 Agent' },
    { id: 'ledger', label: '⚖️ Ledger' },
    { id: 'custom', label: '🌳 Custom' },
];
const SHELF_OPTIONS = [
    { id: 'right', label: '→ Right shelf' },
    { id: 'left', label: '← Left shelf' },
    { id: 'bottom', label: '↓ Bottom shelf' },
];
export function HelmDecksPicker({ onSelect, onClose, swappingCardId, swappingShelf, defaultShelf = 'right', }) {
    const [query, setQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [targetShelf, setTargetShelf] = useState(swappingShelf ?? defaultShelf);
    const filtered = useMemo(() => {
        return CARD_META_LIST.filter((m) => {
            if (swappingCardId && m.id === swappingCardId)
                return false;
            if (categoryFilter !== 'all' && m.category !== categoryFilter)
                return false;
            if (query.trim()) {
                const q = query.toLowerCase();
                return m.label.toLowerCase().includes(q) || m.description.toLowerCase().includes(q);
            }
            return true;
        });
    }, [query, categoryFilter, swappingCardId]);
    return (_jsxs(_Fragment, { children: [_jsx("div", { style: pickerStyles.backdrop, onClick: onClose, "aria-hidden": "true" }), _jsxs("div", { style: pickerStyles.modal, role: "dialog", "aria-modal": "true", "aria-label": swappingCardId ? 'Swap Deck Card' : 'Add Deck Card from Helm Decks Library', children: [_jsxs("div", { style: pickerStyles.header, children: [_jsx("span", { style: pickerStyles.headerTitle, children: "\uD83C\uDFB4 Helm Decks Library" }), swappingCardId && (_jsxs("span", { style: pickerStyles.swapBadge, children: ["Swapping: ", CARD_META_LIST.find((m) => m.id === swappingCardId)?.label] })), _jsx("button", { style: pickerStyles.closeBtn, onClick: onClose, "aria-label": "Close Helm Decks Library", children: "\u2715" })] }), _jsxs("div", { style: pickerStyles.shelfRow, children: [_jsx("span", { style: pickerStyles.shelfLabel, children: "Add to:" }), SHELF_OPTIONS.map(({ id, label }) => (_jsx("button", { style: {
                                    ...pickerStyles.shelfBtn,
                                    background: targetShelf === id ? '#1e3a5f' : 'transparent',
                                    borderColor: targetShelf === id ? '#3b82f6' : '#2d3748',
                                    color: targetShelf === id ? '#63b3ed' : '#a0aec0',
                                }, onClick: () => setTargetShelf(id), children: label }, id)))] }), _jsx("div", { style: pickerStyles.searchRow, children: _jsx("input", { type: "search", placeholder: "Search Deck Cards\u2026", value: query, onChange: (e) => setQuery(e.target.value), style: pickerStyles.searchInput, autoFocus: true, "aria-label": "Search Deck Cards" }) }), _jsx("div", { style: pickerStyles.catRow, children: CATEGORIES.map(({ id, label }) => (_jsx("button", { style: {
                                ...pickerStyles.catBtn,
                                background: categoryFilter === id ? '#2d3748' : 'transparent',
                                color: categoryFilter === id ? '#e2e8f0' : '#718096',
                                borderColor: categoryFilter === id ? '#4a5568' : 'transparent',
                            }, onClick: () => setCategoryFilter(id), children: label }, id))) }), _jsxs("div", { style: pickerStyles.grid, role: "list", children: [filtered.length === 0 && (_jsx("div", { style: pickerStyles.emptyState, children: "No cards match this filter." })), filtered.map((meta) => (_jsxs("button", { style: pickerStyles.card, onClick: () => { onSelect(meta.id, targetShelf); onClose(); }, role: "listitem", "aria-label": `Add ${meta.label} to ${targetShelf} shelf`, children: [_jsx("span", { style: pickerStyles.cardIcon, children: meta.icon }), _jsxs("div", { style: pickerStyles.cardText, children: [_jsx("span", { style: pickerStyles.cardLabel, children: meta.label }), _jsx("span", { style: pickerStyles.cardDesc, children: meta.description }), _jsx("span", { style: pickerStyles.cardCat, children: meta.category })] })] }, meta.id)))] }), _jsx("div", { style: pickerStyles.footer, children: _jsxs("span", { style: pickerStyles.footerNote, children: [filtered.length, " card", filtered.length !== 1 ? 's' : '', " available \u00B7 Right-click any card on a shelf to swap, move, or remove"] }) })] })] }));
}
const pickerStyles = {
    backdrop: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        zIndex: 10000,
    },
    modal: {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10001,
        background: '#0f0f1a',
        border: '1px solid #4a5568',
        borderRadius: '10px',
        width: 560,
        maxWidth: '90vw',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
        overflow: 'hidden',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        padding: '0.75rem 1rem',
        background: '#1a1a2e',
        borderBottom: '1px solid #2d3748',
        flexShrink: 0,
    },
    headerTitle: {
        fontWeight: 700,
        fontSize: '0.9rem',
        color: '#f6ad55',
        flex: 1,
    },
    swapBadge: {
        fontSize: '0.7rem',
        color: '#a0aec0',
        background: '#2d3748',
        padding: '2px 8px',
        borderRadius: '4px',
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        color: '#718096',
        cursor: 'pointer',
        fontSize: '1rem',
        lineHeight: 1,
        padding: '0 4px',
    },
    shelfRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.5rem 1rem',
        borderBottom: '1px solid #2d3748',
        flexShrink: 0,
    },
    shelfLabel: {
        fontSize: '0.72rem',
        color: '#718096',
        marginRight: '0.25rem',
    },
    shelfBtn: {
        padding: '3px 10px',
        border: '1px solid',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '0.72rem',
        transition: 'all 0.15s',
    },
    searchRow: {
        padding: '0.5rem 1rem 0',
        flexShrink: 0,
    },
    searchInput: {
        width: '100%',
        background: '#070710',
        border: '1px solid #2d3748',
        borderRadius: '6px',
        color: '#e2e8f0',
        padding: '0.4rem 0.75rem',
        fontSize: '0.82rem',
        outline: 'none',
        boxSizing: 'border-box',
    },
    catRow: {
        display: 'flex',
        gap: '0.3rem',
        padding: '0.4rem 1rem',
        flexWrap: 'wrap',
        flexShrink: 0,
    },
    catBtn: {
        padding: '3px 10px',
        border: '1px solid transparent',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '0.7rem',
        transition: 'all 0.15s',
    },
    grid: {
        flex: 1,
        overflow: 'auto',
        padding: '0.5rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
    },
    emptyState: {
        padding: '1.5rem',
        textAlign: 'center',
        color: '#4a5568',
        fontSize: '0.82rem',
    },
    card: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '0.6rem 0.75rem',
        background: 'transparent',
        border: '1px solid #2d3748',
        borderRadius: '6px',
        cursor: 'pointer',
        textAlign: 'left',
        color: '#e2e8f0',
        transition: 'border-color 0.15s, background 0.15s',
        width: '100%',
    },
    cardIcon: {
        fontSize: '1.5rem',
        lineHeight: 1,
        flexShrink: 0,
        marginTop: 2,
    },
    cardText: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.2rem',
        flex: 1,
    },
    cardLabel: {
        fontSize: '0.8rem',
        fontWeight: 700,
        color: '#f6ad55',
    },
    cardDesc: {
        fontSize: '0.7rem',
        color: '#718096',
        lineHeight: 1.4,
    },
    cardCat: {
        fontSize: '0.62rem',
        color: '#4a5568',
        textTransform: 'capitalize',
    },
    footer: {
        padding: '0.5rem 1rem',
        borderTop: '1px solid #2d3748',
        flexShrink: 0,
        background: '#0a0a12',
    },
    footerNote: {
        fontSize: '0.68rem',
        color: '#4a5568',
    },
};
