import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * CategoryBrowser -- Browse and search Eblets in a single Catacombs category
 * BP087 Wave 5
 *
 * Search debounces 300ms -- calls catacombs:search IPC.
 * Inline CatacombsContributePanel on "Contribute" click.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { CatacombsContributePanel } from './CatacombsContributePanel';
// ---- Styles -----------------------------------------------------------------
const S = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#0a0f1a',
        color: '#e2e8f0',
        padding: 20,
        gap: 14,
        overflowY: 'auto',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexShrink: 0,
    },
    backBtn: {
        background: 'none',
        border: '1px solid rgba(100,116,139,0.3)',
        borderRadius: 6,
        color: '#64748b',
        fontSize: 11,
        padding: '4px 10px',
        cursor: 'pointer',
    },
    categoryTitle: {
        fontSize: 15,
        fontWeight: 700,
        color: '#6ee7b7',
    },
    searchBar: {
        background: '#111827',
        border: '1px solid rgba(100,116,139,0.3)',
        borderRadius: 8,
        color: '#e2e8f0',
        fontSize: 12,
        padding: '8px 12px',
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box',
    },
    contributeBtn: {
        background: 'rgba(110,231,183,0.1)',
        border: '1px solid rgba(110,231,183,0.3)',
        borderRadius: 6,
        color: '#6ee7b7',
        fontSize: 11,
        fontWeight: 700,
        padding: '6px 14px',
        cursor: 'pointer',
        alignSelf: 'flex-start',
        whiteSpace: 'nowrap',
    },
    ebletList: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
    ebletRow: {
        background: '#111827',
        border: '1px solid rgba(100,116,139,0.15)',
        borderRadius: 8,
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
    },
    ebletTitle: {
        fontSize: 12,
        fontWeight: 600,
        color: '#e2e8f0',
    },
    ebletMeta: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 10,
        color: '#64748b',
    },
    scoreChip: (score) => {
        const s = score ?? 0;
        const bg = s >= 0.8 ? 'rgba(34,197,94,0.2)' : s >= 0.5 ? 'rgba(250,204,21,0.2)' : 'rgba(239,68,68,0.2)';
        const col = s >= 0.8 ? '#4ade80' : s >= 0.5 ? '#fbbf24' : '#f87171';
        return { background: bg, color: col, borderRadius: 10, padding: '1px 8px', fontWeight: 700 };
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
        gap: 12,
        color: '#475569',
    },
    loading: {
        color: '#475569',
        fontSize: 12,
        padding: '24px 0',
        textAlign: 'center',
    },
};
// ---- Helpers ----------------------------------------------------------------
function invokeIPC(channel, ...args) {
    const w = window;
    if (w.electronAPI?.[channel])
        return w.electronAPI[channel](...args);
    if (w.ipcRenderer?.invoke)
        return w.ipcRenderer.invoke(channel, ...args);
    return Promise.reject(new Error('IPC unavailable'));
}
// ---- Component --------------------------------------------------------------
export function CategoryBrowser({ categorySlug, displayName, onClose }) {
    const [eblets, setEblets] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [showContribute, setShowContribute] = useState(false);
    const debounceRef = useRef(null);
    // Load eblets on mount
    useEffect(() => {
        setLoading(true);
        invokeIPC('catacombs:list-eblets', categorySlug)
            .then((rows) => {
            const list = rows ?? [];
            setEblets(list);
            setFiltered(list);
        })
            .catch(() => {
            setEblets([]);
            setFiltered([]);
        })
            .finally(() => setLoading(false));
    }, [categorySlug]);
    // Debounced search
    const handleSearch = useCallback((q) => {
        setQuery(q);
        if (debounceRef.current)
            clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            if (!q.trim()) {
                setFiltered(eblets);
                return;
            }
            try {
                const rows = await invokeIPC('catacombs:search', { slug: categorySlug, query: q });
                setFiltered(rows ?? []);
            }
            catch {
                // Client-side fallback filter
                const ql = q.toLowerCase();
                setFiltered(eblets.filter((e) => (e.title ?? e.uuid).toLowerCase().includes(ql)));
            }
        }, 300);
    }, [eblets, categorySlug]);
    function handleContributeSuccess() {
        setShowContribute(false);
        // Reload eblets
        invokeIPC('catacombs:list-eblets', categorySlug)
            .then((rows) => {
            const list = rows ?? [];
            setEblets(list);
            setFiltered(list);
        })
            .catch(() => { });
    }
    return (_jsxs("div", { style: S.container, children: [_jsxs("div", { style: S.header, children: [onClose && (_jsx("button", { style: S.backBtn, onClick: onClose, children: "back" })), _jsx("span", { style: S.categoryTitle, children: displayName })] }), _jsx("input", { style: S.searchBar, type: "text", value: query, onChange: (e) => handleSearch(e.target.value), placeholder: `Search ${displayName}...`, "aria-label": `Search ${displayName}` }), _jsx("button", { style: S.contributeBtn, onClick: () => setShowContribute((v) => !v), children: showContribute ? 'Hide Contribute Form' : '+ Contribute Eblet' }), showContribute && (_jsx(CatacombsContributePanel, { defaultSlug: categorySlug, onSuccess: handleContributeSuccess, onClose: () => setShowContribute(false) })), loading && _jsx("div", { style: S.loading, children: "Loading eblets..." }), !loading && filtered.length === 0 && (_jsxs("div", { style: S.emptyState, children: [_jsx("div", { style: { fontSize: 28 }, children: "\uD83D\uDCDA" }), _jsx("div", { style: { fontSize: 13, fontWeight: 600, color: '#e2e8f0' }, children: "No Eblets in this category yet." }), _jsx("div", { style: { fontSize: 11 }, children: "Be the first to contribute!" })] })), !loading && filtered.length > 0 && (_jsx("div", { style: S.ebletList, children: filtered.map((e) => (_jsxs("div", { style: S.ebletRow, children: [_jsx("div", { style: S.ebletTitle, children: e.title ?? e.uuid }), _jsxs("div", { style: S.ebletMeta, children: [_jsx("span", { children: new Date(e.published_at).toLocaleDateString() }), e.corroboration_score !== undefined && (_jsxs("span", { style: S.scoreChip(e.corroboration_score), children: [(e.corroboration_score * 100).toFixed(0), "%"] })), e.soccerball_hash && (_jsx("span", { style: { fontFamily: 'monospace', color: '#334155' }, children: e.soccerball_hash.slice(0, 8) }))] })] }, e.uuid))) }))] }));
}
