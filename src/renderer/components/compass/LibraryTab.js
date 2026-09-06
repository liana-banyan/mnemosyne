import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
// compass/LibraryTab.tsx -- BP138 Yoke 0.9.14: Compass nav tab 3 (Library).
//
// Founder decision #1 (pre-confirmed): Library absorbs the Catacombs/install-oriented pieces
// of the old Package Store tab -- CatacombsTab.tsx (which already composes CategoryBrowser.tsx
// internally on drill-in, and CategoryBrowser already composes CatacombsContributePanel.tsx in
// context) plus a standalone "+ Contribute" entry mirroring the old PackageStoreTab's pattern
// for a user who wants to contribute without picking a category first. The diagnostics-oriented
// pieces (OneClickMeshTestPanel, ProveItWorksTab, LeanFederationPanel) do NOT come here -- they
// moved to Power/Diagnostics (Phase 2, under More) and Proof (Phase 1) instead. "Substrate"
// stays out of Library entirely per the same decision -- it is not mounted anywhere below.
//
// Phase 5 Cue Deck card: "Share your Library" -- gated on the REAL summed eblet_count across
// all 16 folder manifests, reported up via CatacombsTab's new (additive, backward-compatible)
// onManifestsLoaded callback. Skipped honestly when the real count is 0.
import { useState } from 'react';
import { CatacombsTab } from '../CatacombsTab';
import { CatacombsContributePanel } from '../CatacombsContributePanel';
import { CueDeckCardRenderer } from '../CueDeckCardRenderer';
export function LibraryTab() {
    const [showContribute, setShowContribute] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);
    const [totalEblets, setTotalEblets] = useState(null);
    const shareTemplate = totalEblets !== null && totalEblets > 0 ? {
        id: 'doctrine-library-share',
        title: 'My Library',
        subtitle: 'Alexandrian Catacombs -- cooperative knowledge library',
        body_text: `${totalEblets} eblet${totalEblets === 1 ? '' : 's'} across the 16-folder cooperative library on my machine. Join my crew to grow yours.`,
        accent_color: 'accent',
        background_type: 'gradient',
    } : null;
    return (_jsxs("div", { style: {
            height: '100%', overflowY: 'auto', padding: '16px 20px',
            background: '#0a0f1a', color: '#f0fdf4', fontFamily: 'system-ui, -apple-system, sans-serif',
        }, children: [_jsxs("div", { style: { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }, children: [_jsxs("button", { onClick: () => setShowContribute((v) => !v), style: pillBtn(showContribute), children: ["\u270E ", showContribute ? 'Hide' : 'Contribute a Package'] }), shareTemplate && (_jsxs("button", { onClick: () => setShareOpen((v) => !v), style: pillBtn(shareOpen), children: ["\uD83D\uDCE4 ", shareOpen ? 'Hide' : 'Share your Library'] }))] }), showContribute && (_jsx("div", { style: { marginBottom: 16 }, children: _jsx(CatacombsContributePanel, { onSuccess: () => setShowContribute(false), onClose: () => setShowContribute(false) }) })), shareOpen && shareTemplate && (_jsx("div", { style: { marginBottom: 16 }, children: _jsx(CueDeckCardRenderer, { template: shareTemplate }) })), _jsx(CatacombsTab, { onManifestsLoaded: setTotalEblets })] }));
}
function pillBtn(active) {
    return {
        background: active ? '#1e3a5c' : 'none',
        color: active ? '#e2e8f0' : '#6ee7b7',
        border: '1px solid #1e4038',
        borderRadius: 6,
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'system-ui, sans-serif',
    };
}
export default LibraryTab;
