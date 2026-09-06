import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// BP037 — On-Deck Master-of-Ceremonies Panel (Phase 2)
// Read-only view of on_deck queue state from ~/.lb_substrate/on_deck/
//
// Three columns: Sequential | Anytime | Conditional
// Color-coded by target seat: Manager=green Knight=blue Pawn=amber Rook=violet
// Status badges: DRAFTING / READY / FIRED / RETURNED / COMPLETE / FAILED
// Side panel: details of selected item
// Fired archive: collapsible, default hidden
import { useState, useEffect, useCallback } from 'react';
// ─── Color tokens ─────────────────────────────────────────────────────────────
const SEAT_COLORS = {
    manager: '#22c55e',
    knight: '#3b82f6',
    pawn: '#f59e0b',
    rook: '#a855f7',
};
const STATUS_COLORS = {
    DRAFTING: '#718096',
    READY: '#63b3ed',
    FIRED: '#f6ad55',
    RETURNED: '#fc8181',
    COMPLETE: '#22c55e',
    FAILED: '#ef4444',
};
const PRIORITY_COLORS = {
    HIGH: '#ef4444',
    MEDIUM: '#f6ad55',
    LOW: '#718096',
};
// ─── Item card ────────────────────────────────────────────────────────────────
function ItemCard({ item, selected, onClick, }) {
    const fm = item.frontmatter;
    const seatColor = SEAT_COLORS[fm.target_seat];
    const statusColor = STATUS_COLORS[fm.status];
    return (_jsxs("button", { style: {
            ...styles.card,
            borderLeft: `3px solid ${seatColor}`,
            background: selected ? '#1e2d4a' : '#0f0f1a',
            outline: selected ? `1px solid ${seatColor}` : 'none',
        }, onClick: onClick, title: fm.on_deck_id, children: [_jsxs("div", { style: styles.cardTop, children: [_jsx("span", { style: { ...styles.idBadge, color: seatColor }, children: fm.on_deck_id }), _jsx("span", { style: { ...styles.statusBadge, background: statusColor + '22', color: statusColor, border: `1px solid ${statusColor}` }, children: fm.status })] }), _jsx("div", { style: styles.cardTitle, children: fm.title ?? fm.on_deck_id }), _jsxs("div", { style: styles.cardMeta, children: [_jsx("span", { style: { color: seatColor, fontSize: '0.65rem', fontWeight: 600 }, children: fm.target_seat.toUpperCase() }), _jsxs("span", { style: { ...styles.priorityDot, color: PRIORITY_COLORS[fm.priority] }, children: ["\u25CF ", fm.priority] }), fm.estimated_time && _jsxs("span", { style: styles.metaChip, children: [fm.estimated_time, "m"] }), fm.estimated_cost && _jsxs("span", { style: styles.metaChip, children: ["$", fm.estimated_cost.toFixed(2)] })] }), fm.depends_on.length > 0 && (_jsxs("div", { style: styles.deps, children: ["\u26D3 depends: ", fm.depends_on.join(', ')] }))] }));
}
// ─── Column ───────────────────────────────────────────────────────────────────
function Column({ title, icon, items, selectedId, onSelect, }) {
    return (_jsxs("div", { style: styles.col, children: [_jsxs("div", { style: styles.colHeader, children: [_jsx("span", { children: icon }), _jsx("span", { style: styles.colTitle, children: title }), _jsx("span", { style: styles.colCount, children: items.length })] }), _jsx("div", { style: styles.colBody, children: items.length === 0 ? (_jsx("div", { style: styles.emptyCol, children: "\u2014 empty \u2014" })) : (items.map((item) => (_jsx(ItemCard, { item: item, selected: selectedId === item.frontmatter.on_deck_id, onClick: () => onSelect(item) }, item.frontmatter.on_deck_id)))) })] }));
}
// ─── Detail panel ─────────────────────────────────────────────────────────────
function DetailPanel({ item, onClose, }) {
    const fm = item.frontmatter;
    const seatColor = SEAT_COLORS[fm.target_seat];
    return (_jsxs("div", { style: styles.detail, children: [_jsxs("div", { style: { ...styles.detailHeader, borderLeft: `3px solid ${seatColor}` }, children: [_jsx("span", { style: { color: seatColor, fontWeight: 700 }, children: fm.on_deck_id }), _jsx("span", { style: { flex: 1, marginLeft: '0.5rem', fontWeight: 600 }, children: fm.title ?? '' }), _jsx("button", { style: styles.closeBtn, onClick: onClose, children: "\u2715" })] }), _jsxs("div", { style: styles.detailMeta, children: [_jsx(MetaRow, { label: "Target seat", value: fm.target_seat, color: seatColor }), _jsx(MetaRow, { label: "Category", value: fm.category }), _jsx(MetaRow, { label: "Priority", value: fm.priority, color: PRIORITY_COLORS[fm.priority] }), _jsx(MetaRow, { label: "Status", value: fm.status, color: STATUS_COLORS[fm.status] }), fm.estimated_time && _jsx(MetaRow, { label: "Est. time", value: `${fm.estimated_time} min` }), fm.estimated_cost !== undefined && _jsx(MetaRow, { label: "Est. cost", value: `$${fm.estimated_cost.toFixed(2)}` }), fm.created_at && _jsx(MetaRow, { label: "Created", value: new Date(fm.created_at).toLocaleString() }), fm.depends_on.length > 0 && (_jsx(MetaRow, { label: "Depends on", value: fm.depends_on.join(', ') })), fm.conditions.length > 0 && (_jsx(MetaRow, { label: "Conditions", value: fm.conditions.join('; ') })), _jsx(MetaRow, { label: "File", value: item.file_path.split(/[\\/]/).slice(-2).join('/'), mono: true })] }), item.body && (_jsxs("div", { style: styles.detailBody, children: [_jsx("div", { style: styles.detailBodyLabel, children: "Body" }), _jsx("div", { style: styles.detailBodyText, children: item.body })] }))] }));
}
function MetaRow({ label, value, color, mono }) {
    return (_jsxs("div", { style: styles.metaRow, children: [_jsx("span", { style: styles.metaLabel, children: label }), _jsx("span", { style: { ...styles.metaValue, color: color ?? '#e2e8f0', fontFamily: mono ? 'monospace' : undefined }, children: value })] }));
}
// ─── Main panel ───────────────────────────────────────────────────────────────
export function OnDeckPanel() {
    const [payload, setPayload] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);
    const [showFired, setShowFired] = useState(false);
    const [lastScanned, setLastScanned] = useState(null);
    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await window.amplify.onDeckList?.();
            if (data) {
                setPayload(data);
                setLastScanned(data.scanned_at);
            }
        }
        catch (e) {
            setError(String(e));
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        void refresh();
        const timer = setInterval(refresh, 30000);
        return () => clearInterval(timer);
    }, [refresh]);
    const handleSelect = useCallback((item) => {
        setSelectedItem((prev) => prev?.frontmatter.on_deck_id === item.frontmatter.on_deck_id ? null : item);
    }, []);
    const totalActive = (payload?.sequential.length ?? 0) +
        (payload?.anytime.length ?? 0) +
        (payload?.conditional.length ?? 0);
    return (_jsxs("div", { style: styles.root, children: [_jsxs("div", { style: styles.header, children: [_jsx("span", { style: styles.headerIcon, children: "\uD83D\uDCCB" }), _jsx("span", { style: styles.headerTitle, children: "On Deck" }), loading && _jsx("span", { style: styles.loadingChip, children: "scanning\u2026" }), _jsxs("span", { style: styles.totalBadge, children: [totalActive, " active"] }), _jsx("div", { style: { flex: 1 } }), _jsx("button", { style: styles.refreshBtn, onClick: refresh, title: "Refresh on-deck queue", children: "\u21BA Refresh" })] }), error && (_jsxs("div", { style: styles.errorBanner, children: ["\u26A0 ", error] })), _jsxs("div", { style: styles.body, children: [_jsxs("div", { style: { ...styles.colGrid, flex: selectedItem ? '0 0 55%' : '1 1 auto' }, children: [_jsx(Column, { title: "Sequential", icon: "\u23E9", items: payload?.sequential ?? [], selectedId: selectedItem?.frontmatter.on_deck_id ?? null, onSelect: handleSelect }), _jsx(Column, { title: "Anytime", icon: "\uD83D\uDD04", items: payload?.anytime ?? [], selectedId: selectedItem?.frontmatter.on_deck_id ?? null, onSelect: handleSelect }), _jsx(Column, { title: "Conditional", icon: "\uD83D\uDD00", items: payload?.conditional ?? [], selectedId: selectedItem?.frontmatter.on_deck_id ?? null, onSelect: handleSelect })] }), selectedItem && (_jsx("div", { style: styles.detailWrapper, children: _jsx(DetailPanel, { item: selectedItem, onClose: () => setSelectedItem(null) }) }))] }), _jsxs("div", { style: styles.firedSection, children: [_jsxs("button", { style: styles.firedToggle, onClick: () => setShowFired((v) => !v), children: [showFired ? '▼' : '▶', " Fired archive (", payload?.fired_recent.length ?? 0, " recent)"] }), showFired && (_jsx("div", { style: styles.firedGrid, children: payload?.fired_recent.length === 0 ? (_jsx("span", { style: { color: '#718096', fontSize: '0.72rem' }, children: "No fired items yet." })) : (payload?.fired_recent.map((item) => (_jsx(ItemCard, { item: item, selected: false, onClick: () => handleSelect(item) }, item.frontmatter.on_deck_id + item.file_path)))) }))] }), _jsxs("div", { style: styles.footer, children: ["BP037 On-Deck MoC \u00B7 substrate: ", payload?.base_dir ?? '—', lastScanned && ` · scanned ${new Date(lastScanned).toLocaleTimeString()}`] })] }));
}
// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
    root: {
        display: 'flex',
        flexDirection: 'column',
        background: '#0a0a14',
        color: '#e2e8f0',
        height: '100%',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: '0.78rem',
        overflow: 'hidden',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.4rem 0.75rem',
        background: '#1a1a2e',
        borderBottom: '1px solid #2d3748',
        flexShrink: 0,
    },
    headerIcon: { fontSize: '1rem' },
    headerTitle: { fontWeight: 700, fontSize: '0.9rem', color: '#63b3ed' },
    loadingChip: { fontSize: '0.65rem', color: '#718096', marginLeft: '0.25rem' },
    totalBadge: {
        fontSize: '0.65rem',
        background: '#2d3748',
        color: '#a0aec0',
        borderRadius: '4px',
        padding: '1px 6px',
    },
    refreshBtn: {
        background: '#2d3748',
        border: '1px solid #4a5568',
        borderRadius: '4px',
        color: '#e2e8f0',
        padding: '0.2rem 0.5rem',
        cursor: 'pointer',
        fontSize: '0.7rem',
    },
    errorBanner: {
        background: '#450a0a',
        color: '#fc8181',
        padding: '0.3rem 0.75rem',
        fontSize: '0.72rem',
        flexShrink: 0,
    },
    body: {
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
        gap: '0.5rem',
        padding: '0.5rem',
        minHeight: 0,
    },
    colGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '0.5rem',
        overflow: 'hidden',
        minWidth: 0,
    },
    col: {
        display: 'flex',
        flexDirection: 'column',
        background: '#0f0f1a',
        border: '1px solid #2d3748',
        borderRadius: '8px',
        overflow: 'hidden',
        minHeight: 0,
    },
    colHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.4rem 0.6rem',
        background: '#1a1a2e',
        borderBottom: '1px solid #2d3748',
        flexShrink: 0,
    },
    colTitle: { fontWeight: 700, fontSize: '0.75rem', color: '#a0aec0' },
    colCount: {
        marginLeft: 'auto',
        fontSize: '0.65rem',
        background: '#2d3748',
        color: '#718096',
        borderRadius: '10px',
        padding: '0 5px',
    },
    colBody: { flex: 1, overflow: 'auto', padding: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' },
    emptyCol: { color: '#4a5568', fontSize: '0.7rem', textAlign: 'center', padding: '1rem 0' },
    card: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.2rem',
        padding: '0.4rem 0.5rem',
        border: '1px solid #2d3748',
        borderRadius: '5px',
        cursor: 'pointer',
        textAlign: 'left',
        color: '#e2e8f0',
        width: '100%',
        transition: 'background 0.1s',
    },
    cardTop: { display: 'flex', alignItems: 'center', gap: '0.3rem' },
    idBadge: { fontSize: '0.65rem', fontFamily: 'monospace', fontWeight: 700 },
    statusBadge: {
        marginLeft: 'auto',
        fontSize: '0.6rem',
        borderRadius: '3px',
        padding: '1px 5px',
        fontWeight: 600,
        letterSpacing: '0.04em',
    },
    cardTitle: { fontSize: '0.72rem', lineHeight: 1.3, color: '#cbd5e0' },
    cardMeta: { display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' },
    priorityDot: { fontSize: '0.62rem', fontWeight: 600 },
    metaChip: {
        fontSize: '0.6rem',
        background: '#2d3748',
        color: '#a0aec0',
        borderRadius: '3px',
        padding: '0 4px',
    },
    deps: { fontSize: '0.62rem', color: '#718096' },
    detailWrapper: { flex: '0 0 320px', overflow: 'hidden' },
    detail: {
        background: '#0f0f1a',
        border: '1px solid #2d3748',
        borderRadius: '8px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    },
    detailHeader: {
        display: 'flex',
        alignItems: 'center',
        padding: '0.5rem 0.75rem',
        background: '#1a1a2e',
        borderBottom: '1px solid #2d3748',
        paddingLeft: '0.75rem',
        fontSize: '0.78rem',
        flexShrink: 0,
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        color: '#718096',
        cursor: 'pointer',
        fontSize: '0.85rem',
    },
    detailMeta: {
        padding: '0.5rem 0.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
        borderBottom: '1px solid #1a1a2e',
        flexShrink: 0,
    },
    metaRow: { display: 'flex', gap: '0.4rem', alignItems: 'baseline' },
    metaLabel: { fontSize: '0.65rem', color: '#718096', minWidth: 80 },
    metaValue: { fontSize: '0.7rem', wordBreak: 'break-all' },
    detailBody: { flex: 1, overflow: 'auto', padding: '0.5rem 0.75rem' },
    detailBodyLabel: { fontSize: '0.65rem', color: '#718096', marginBottom: '0.3rem', fontWeight: 700 },
    detailBodyText: { fontSize: '0.72rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', color: '#cbd5e0' },
    firedSection: {
        borderTop: '1px solid #2d3748',
        background: '#0a0a14',
        flexShrink: 0,
    },
    firedToggle: {
        background: 'none',
        border: 'none',
        color: '#718096',
        cursor: 'pointer',
        fontSize: '0.7rem',
        padding: '0.4rem 0.75rem',
        width: '100%',
        textAlign: 'left',
    },
    firedGrid: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.3rem',
        padding: '0 0.75rem 0.5rem',
        maxHeight: 150,
        overflow: 'auto',
    },
    footer: {
        fontSize: '0.6rem',
        color: '#4a5568',
        padding: '0.25rem 0.75rem',
        borderTop: '1px solid #1a1a2e',
        flexShrink: 0,
    },
};
