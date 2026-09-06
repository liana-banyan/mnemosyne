// SAGA 5 — HELM VIEW: useHelmLayout hook
// Manages layout state with localStorage persistence.
// Phase D: ~/.lb_substrate/helm_layout.json via IPC is a follow-on (K533-class).
// For SAGA 5: localStorage keyed by 'helm_layout_v1'.
import { useState, useCallback } from 'react';
import { DEFAULT_HELM_LAYOUT, PRESET_LAYOUTS } from './HelmTypes';
const STORAGE_KEY = 'helm_layout_v1';
function loadLayout() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return DEFAULT_HELM_LAYOUT;
        const parsed = JSON.parse(raw);
        if (parsed.version !== 1)
            return DEFAULT_HELM_LAYOUT;
        return parsed;
    }
    catch {
        return DEFAULT_HELM_LAYOUT;
    }
}
function saveLayout(layout) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    }
    catch {
        // non-fatal
    }
}
export function useHelmLayout() {
    const [layout, setLayoutRaw] = useState(loadLayout);
    const setLayout = useCallback((next) => {
        saveLayout(next);
        setLayoutRaw(next);
    }, []);
    const toggleShelf = useCallback((shelf) => {
        setLayout({
            ...layout,
            shelves: {
                ...layout.shelves,
                [shelf]: { ...layout.shelves[shelf], collapsed: !layout.shelves[shelf].collapsed },
            },
        });
    }, [layout, setLayout]);
    const setShelfSize = useCallback((shelf, size) => {
        setLayout({
            ...layout,
            shelves: {
                ...layout.shelves,
                [shelf]: { ...layout.shelves[shelf], size },
            },
        });
    }, [layout, setLayout]);
    const addCard = useCallback((shelf, cardId) => {
        const existing = layout.shelves[shelf].cards;
        if (existing.includes(cardId))
            return;
        setLayout({
            ...layout,
            shelves: {
                ...layout.shelves,
                [shelf]: { ...layout.shelves[shelf], cards: [...existing, cardId] },
            },
        });
    }, [layout, setLayout]);
    const removeCard = useCallback((shelf, cardId) => {
        setLayout({
            ...layout,
            shelves: {
                ...layout.shelves,
                [shelf]: {
                    ...layout.shelves[shelf],
                    cards: layout.shelves[shelf].cards.filter((c) => c !== cardId),
                },
            },
        });
    }, [layout, setLayout]);
    const moveCard = useCallback((fromShelf, toShelf, cardId, toIndex) => {
        const fromCards = layout.shelves[fromShelf].cards.filter((c) => c !== cardId);
        const toCards = layout.shelves[toShelf].cards.filter((c) => c !== cardId);
        if (toIndex !== undefined) {
            toCards.splice(toIndex, 0, cardId);
        }
        else {
            toCards.push(cardId);
        }
        setLayout({
            ...layout,
            shelves: {
                ...layout.shelves,
                [fromShelf]: { ...layout.shelves[fromShelf], cards: fromCards },
                [toShelf]: { ...layout.shelves[toShelf], cards: toCards },
            },
        });
    }, [layout, setLayout]);
    const reorderCard = useCallback((shelf, cardId, direction) => {
        const cards = [...layout.shelves[shelf].cards];
        const idx = cards.indexOf(cardId);
        if (idx < 0)
            return;
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= cards.length)
            return;
        [cards[idx], cards[swapIdx]] = [cards[swapIdx], cards[idx]];
        setLayout({
            ...layout,
            shelves: {
                ...layout.shelves,
                [shelf]: { ...layout.shelves[shelf], cards },
            },
        });
    }, [layout, setLayout]);
    const applyPreset = useCallback((preset) => {
        setLayout({ ...PRESET_LAYOUTS[preset], preset });
    }, [setLayout]);
    const resetToDefault = useCallback(() => {
        setLayout(DEFAULT_HELM_LAYOUT);
    }, [setLayout]);
    return {
        layout,
        toggleShelf,
        setShelfSize,
        addCard,
        removeCard,
        moveCard,
        reorderCard,
        applyPreset,
        resetToDefault,
    };
}
