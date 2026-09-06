import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * CatacombsTab -- Top-level Catacombs tab in MnemosyneTabView
 * BP087 Wave 5 -- 16-folder substrate default + Alexandrian Library
 *
 * 16 folder cards in responsive grid.
 * Per-folder manifest loaded via IPC catacombs:get-manifest.
 * License gate banner for for-profit-unlicensed members.
 */
import { useState, useEffect, useCallback } from 'react';
import { CategoryBrowser } from './CategoryBrowser';
// ---- Constants --------------------------------------------------------------
const ALL_SLUGS = [
    '01_biology',
    '02_business',
    '03_chemistry',
    '04_computer_science',
    '05_economics',
    '06_engineering',
    '07_health',
    '08_history',
    '09_law',
    '10_math',
    '11_other',
    '12_philosophy',
    '13_physics',
    '14_psychology',
    '15_USER',
    '16_LIANA_BANYAN',
];
const DISPLAY_NAMES = {
    '01_biology': 'Biology',
    '02_business': 'Business',
    '03_chemistry': 'Chemistry',
    '04_computer_science': 'Computer Science',
    '05_economics': 'Economics',
    '06_engineering': 'Engineering',
    '07_health': 'Health',
    '08_history': 'History',
    '09_law': 'Law',
    '10_math': 'Math',
    '11_other': 'Other',
    '12_philosophy': 'Philosophy',
    '13_physics': 'Physics',
    '14_psychology': 'Psychology',
    '15_USER': 'My Contributions',
    '16_LIANA_BANYAN': 'Liana Banyan',
};
const SLUG_ICONS = {
    '01_biology': 'biology',
    '02_business': 'business',
    '03_chemistry': 'chemistry',
    '04_computer_science': 'cs',
    '05_economics': 'econ',
    '06_engineering': 'eng',
    '07_health': 'health',
    '08_history': 'history',
    '09_law': 'law',
    '10_math': 'math',
    '11_other': 'other',
    '12_philosophy': 'phil',
    '13_physics': 'physics',
    '14_psychology': 'psych',
    '15_USER': 'user',
    '16_LIANA_BANYAN': 'lb',
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
function defaultManifest(slug) {
    return { slug, version: 1, soccerball_hash: null, eblet_count: 0, last_updated: null };
}
function formatDate(iso) {
    if (!iso)
        return 'never';
    try {
        return new Date(iso).toLocaleDateString();
    }
    catch {
        return iso;
    }
}
// ---- Styles -----------------------------------------------------------------
const S = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#0a0f1a',
        color: '#e2e8f0',
        overflowY: 'auto',
    },
    inner: {
        padding: '20px 20px 40px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        minHeight: '100%',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
    },
    title: {
        fontSize: 16,
        fontWeight: 700,
        color: '#6ee7b7',
    },
    prefetchBtn: (running) => ({
        background: running ? 'rgba(250,204,21,0.1)' : 'rgba(110,231,183,0.1)',
        border: running ? '1px solid rgba(250,204,21,0.3)' : '1px solid rgba(110,231,183,0.3)',
        borderRadius: 6,
        color: running ? '#fbbf24' : '#6ee7b7',
        fontSize: 11,
        fontWeight: 700,
        padding: '6px 14px',
        cursor: running ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap',
    }),
    offerBanner: {
        background: 'rgba(250,204,21,0.08)',
        border: '1px solid rgba(250,204,21,0.3)',
        borderRadius: 8,
        padding: '10px 14px',
        fontSize: 11,
        color: '#fbbf24',
        lineHeight: 1.5,
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
    },
    card: (active) => ({
        background: active ? 'rgba(110,231,183,0.06)' : '#111827',
        border: active ? '1px solid rgba(110,231,183,0.35)' : '1px solid rgba(100,116,139,0.2)',
        borderRadius: 10,
        padding: '14px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
    }),
    cardSlug: {
        fontSize: 10,
        color: '#475569',
        fontFamily: 'monospace',
        letterSpacing: '0.03em',
    },
    cardName: {
        fontSize: 13,
        fontWeight: 600,
        color: '#e2e8f0',
    },
    cardMeta: {
        fontSize: 10,
        color: '#64748b',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        marginTop: 2,
    },
    cardActions: {
        display: 'flex',
        gap: 6,
        marginTop: 4,
    },
    fetchBtn: (status) => ({
        background: status === 'fetching' ? 'rgba(250,204,21,0.1)' : 'rgba(100,116,139,0.08)',
        border: '1px solid rgba(100,116,139,0.25)',
        borderRadius: 4,
        color: status === 'done' ? '#4ade80' : status === 'error' ? '#f87171' : '#64748b',
        fontSize: 9,
        fontWeight: 600,
        padding: '2px 8px',
        cursor: status === 'fetching' ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap',
    }),
    loadingMsg: {
        color: '#475569',
        fontSize: 12,
        textAlign: 'center',
        padding: '40px 0',
    },
    errorMsg: {
        color: '#f87171',
        fontSize: 12,
        padding: '12px 0',
    },
};
export function CatacombsTab({ onManifestsLoaded } = {}) {
    const [manifests, setManifests] = useState(new Map());
    const [loadingManifests, setLoadingManifests] = useState(true);
    const [manifestError, setManifestError] = useState(null);
    const [prefetchRunning, setPrefetchRunning] = useState(false);
    const [fetchStatus, setFetchStatus] = useState(new Map());
    const [accessResult, setAccessResult] = useState(null);
    const [selectedSlug, setSelectedSlug] = useState(null);
    // Load all 16 manifests on mount
    const loadManifests = useCallback(async () => {
        setLoadingManifests(true);
        setManifestError(null);
        try {
            // Bootstrap first (idempotent)
            await invokeIPC('catacombs:bootstrap').catch(() => { });
            // Load all manifests concurrently
            const results = await Promise.allSettled(ALL_SLUGS.map((slug) => invokeIPC('catacombs:get-manifest', slug)
                .then((m) => ({ slug, manifest: m ?? defaultManifest(slug) }))
                .catch(() => ({ slug, manifest: defaultManifest(slug) }))));
            const map = new Map();
            for (const r of results) {
                if (r.status === 'fulfilled') {
                    map.set(r.value.slug, r.value.manifest);
                }
            }
            setManifests(map);
            if (onManifestsLoaded) {
                let total = 0;
                for (const m of map.values())
                    total += m.eblet_count ?? 0;
                onManifestsLoaded(total);
            }
        }
        catch (err) {
            setManifestError(err instanceof Error ? err.message : String(err));
        }
        finally {
            setLoadingManifests(false);
        }
    }, [onManifestsLoaded]);
    useEffect(() => {
        void loadManifests();
    }, [loadManifests]);
    // Check access
    useEffect(() => {
        invokeIPC('catacombs:check-access', 'anonymous', 'read')
            .then((res) => setAccessResult(res))
            .catch(() => setAccessResult({ allowed: true }));
    }, []);
    async function handlePrefetchAll() {
        if (prefetchRunning)
            return;
        setPrefetchRunning(true);
        // Mark all MMLU slugs as fetching
        const newStatus = new Map(fetchStatus);
        for (const slug of ALL_SLUGS.slice(0, 14)) {
            newStatus.set(slug, 'fetching');
        }
        setFetchStatus(newStatus);
        try {
            const results = await invokeIPC('catacombs:prefetch-all');
            const updated = new Map(newStatus);
            for (const r of results ?? []) {
                updated.set(r.slug, r.source === 'error' ? 'error' : 'done');
            }
            setFetchStatus(updated);
            // Reload manifests after prefetch
            await loadManifests();
        }
        catch {
            const updated = new Map(fetchStatus);
            for (const slug of ALL_SLUGS.slice(0, 14)) {
                updated.set(slug, 'error');
            }
            setFetchStatus(updated);
        }
        finally {
            setPrefetchRunning(false);
        }
    }
    async function handleFetchSlug(slug) {
        const current = fetchStatus.get(slug);
        if (current === 'fetching')
            return;
        setFetchStatus((prev) => new Map(prev).set(slug, 'fetching'));
        try {
            const res = await invokeIPC('catacombs:fetch-package', slug);
            setFetchStatus((prev) => new Map(prev).set(slug, res.source === 'error' ? 'error' : 'done'));
            await loadManifests();
        }
        catch {
            setFetchStatus((prev) => new Map(prev).set(slug, 'error'));
        }
    }
    // If browsing a specific category
    if (selectedSlug) {
        return (_jsx(CategoryBrowser, { categorySlug: selectedSlug, displayName: DISPLAY_NAMES[selectedSlug] ?? selectedSlug, onClose: () => setSelectedSlug(null) }));
    }
    return (_jsx("div", { style: S.container, children: _jsxs("div", { style: S.inner, children: [_jsxs("div", { style: S.header, children: [_jsxs("div", { children: [_jsx("div", { style: S.title, children: "Alexandrian Catacombs" }), _jsx("div", { style: { fontSize: 11, color: '#475569', marginTop: 2 }, children: "16-folder cooperative knowledge library -- MMLU-Pro + USER + Liana Banyan" })] }), _jsx("button", { style: S.prefetchBtn(prefetchRunning), onClick: handlePrefetchAll, disabled: prefetchRunning, title: "Pre-fetch all 14 MMLU-Pro category packages (peer-first, server fallback)", children: prefetchRunning ? 'Pre-fetching...' : 'Pre-fetch All' })] }), accessResult?.show_offer && (_jsxs("div", { style: S.offerBanner, children: [_jsx("strong", { children: "Commercial Access Notice:" }), " You are viewing the Alexandrian Catacombs under SSPL base license. A 30-day 50% commercial license offer is available. Join as a cooperative member for $5/year for full access."] })), loadingManifests && _jsx("div", { style: S.loadingMsg, children: "Loading manifests..." }), manifestError && _jsxs("div", { style: S.errorMsg, children: ["Error loading manifests: ", manifestError] }), !loadingManifests && (_jsx("div", { style: S.grid, children: ALL_SLUGS.map((slug) => {
                        const manifest = manifests.get(slug) ?? defaultManifest(slug);
                        const status = fetchStatus.get(slug) ?? 'idle';
                        const isUserOrLB = slug === '15_USER' || slug === '16_LIANA_BANYAN';
                        return (_jsxs("div", { style: S.card(false), onClick: () => setSelectedSlug(slug), role: "button", tabIndex: 0, onKeyDown: (e) => { if (e.key === 'Enter')
                                setSelectedSlug(slug); }, "aria-label": `Browse ${DISPLAY_NAMES[slug] ?? slug} -- ${manifest.eblet_count} eblets`, title: `Browse ${DISPLAY_NAMES[slug] ?? slug}`, children: [_jsx("div", { style: S.cardSlug, children: slug }), _jsx("div", { style: S.cardName, children: DISPLAY_NAMES[slug] ?? slug }), _jsxs("div", { style: S.cardMeta, children: [_jsxs("span", { children: [manifest.eblet_count, " eblet", manifest.eblet_count !== 1 ? 's' : ''] }), _jsxs("span", { children: ["Updated: ", formatDate(manifest.last_updated)] }), manifest.soccerball_hash && (_jsxs("span", { style: { fontFamily: 'monospace', fontSize: 9 }, children: [manifest.soccerball_hash.slice(0, 8), "..."] }))] }), !isUserOrLB && (_jsx("div", { style: S.cardActions, onClick: (e) => e.stopPropagation(), children: _jsx("button", { style: S.fetchBtn(status), onClick: () => handleFetchSlug(slug), disabled: status === 'fetching', title: `Fetch ${DISPLAY_NAMES[slug] ?? slug} package`, children: status === 'fetching' ? 'fetching...' : status === 'done' ? 'fetched' : status === 'error' ? 'retry' : 'fetch' }) }))] }, slug));
                    }) }))] }) }));
}
