import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// SocialTab.tsx — BP132 Yoke #22 (tab 6) + Addendum A
//
// Stands up a real, standalone Social tab. Previously CueDeckShareTab was buried
// as a toggle inside LeanGauntletTab.tsx's federation panel — mounted standalone
// here, alongside the new CueDeckCardRenderer, per the addendum's explicit ask.
//
// Five cards (per canon_cue_deck_card_unified_system_facets — "seed-loop primitive"):
//   1. Welcome              — DB row 4206c74a-... ("Welcome, Captain") + live invite QR
//   2. Name the Empress     — DB row 75df3887-... (empress-naming-campaign), display-only
//   3. Check My Math        — NO DB row (doctrine-only, built here). Truth-Always: shows
//                             the REAL One-Click Staged Test number when one exists,
//                             otherwise an honest "pending" state. NEVER the old 97.1%.
//   4. Join My Crew/SOCCERI — NO DB row (doctrine-only, built here), own invite QR.
//   5. Peer/Federation      — PeerCueCard roster, wired to the real federation:connect-peer
//                             handler + stampCertifyConnection (QR-ledger-per-connection).
import { useCallback, useEffect, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { CueDeckCardRenderer } from './CueDeckCardRenderer';
import { CueDeckShareTab } from './CueDeckShareTab';
import { PeerCueCard } from './PeerCueCard';
import { loadLastMeshTestResult } from './OneClickMeshTestPanel';
const WELCOME_TEMPLATE_ID = '4206c74a-fe74-41e1-8572-771054bf2d9e';
const EMPRESS_TEMPLATE_ID = '75df3887-3fc7-4f18-bf69-118043fd3809';
// ─── Doctrine-only cards (no DB row exists yet — Facet g per addendum) ────────
const CHECK_MY_MATH_BASE = {
    id: 'doctrine-check-my-math',
    title: 'Check My Math',
    subtitle: 'By Grabthar\u2019s Hammer \u2014 What a Savings',
    accent_color: 'primary',
    background_type: 'gradient',
    qr_position: 'bottom-right',
    qr_size: 96,
};
const JOIN_MY_CREW_TEMPLATE = {
    id: 'doctrine-join-my-crew',
    title: 'Join My Crew',
    subtitle: 'Join my Crew / Become part of my Substrate Network',
    body_text: 'Every machine that joins strengthens the mesh for everyone. Scan to connect your MnemosyneC to mine.',
    accent_color: 'secondary',
    background_type: 'gradient',
    qr_position: 'bottom-right',
    qr_size: 110,
};
// ─── Section wrapper ──────────────────────────────────────────────────────────
function CardSection({ title, children }) {
    return (_jsxs("div", { style: { marginBottom: 24 }, children: [_jsx("div", { style: {
                    fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em',
                    textTransform: 'uppercase', marginBottom: 10,
                }, children: title }), children] }));
}
// ─── Peer connect card list (QR-ledger-per-connection) ────────────────────────
function PeerConnectSection() {
    const [peers, setPeers] = useState([]);
    const [ownPeerId, setOwnPeerId] = useState('');
    const [lastLedgerQr, setLastLedgerQr] = useState(null);
    const [stampError, setStampError] = useState(null);
    const loadMesh = useCallback(async () => {
        try {
            const state = await window.amplify?.getMeshState?.();
            if (state) {
                setPeers(state.peers ?? []);
                setOwnPeerId(state.ownPeerId ?? '');
            }
        }
        catch { /* non-fatal */ }
    }, []);
    useEffect(() => { void loadMesh(); }, [loadMesh]);
    const handleConnect = useCallback(async (peerId) => {
        setStampError(null);
        try {
            // Real, previously-existing federation:connect-peer handler (confirmed live —
            // see FederationTab.tsx / PeerCueCard.tsx comment fixes in this same Yoke).
            const connectResult = await window.amplify?.federationConnectPeer?.(peerId);
            await loadMesh();
            if (!connectResult?.success) {
                setStampError(connectResult?.error === 'relay_not_connected'
                    ? 'Relay not connected yet — try again once the mesh is live.'
                    : (connectResult?.error ?? 'Connect failed'));
                return;
            }
            // BP132 Addendum A — QR-ledger-per-connection: mint a fresh Ed25519-signed
            // ip_ledger_entries row for this connection, then generate its QR client-side.
            const peer = peers.find((p) => p.peerId === peerId);
            const stampResult = await window.amplify?.ipLedgerStampConnection?.({
                peer_id: peerId,
                peer_display_name: peer?.displayName,
                connection_method: 'federation_connect_peer',
            });
            if (stampResult?.ok && stampResult.entry_id) {
                setLastLedgerQr({ peerId, entryId: stampResult.entry_id });
            }
            else {
                setStampError(stampResult?.error ?? 'Connected, but ledger stamp failed');
            }
        }
        catch (e) {
            setStampError(String(e));
        }
    }, [peers, loadMesh]);
    return (_jsxs("div", { children: [_jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }, children: [_jsx("button", { onClick: () => void loadMesh(), style: {
                            background: '#10b981', color: '#fff', border: 'none', borderRadius: 6,
                            padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                            fontFamily: 'system-ui, sans-serif',
                        }, children: "\u2B21 Scan for Peers" }), _jsxs("span", { style: { fontSize: 11, color: '#64748b' }, children: [peers.length, " peer", peers.length !== 1 ? 's' : '', " found", ownPeerId && _jsxs("span", { children: [" \u00B7 you are ", ownPeerId.slice(0, 8)] })] })] }), peers.length === 0 && (_jsx("div", { style: { fontSize: 11, color: '#475569', fontStyle: 'italic' }, children: "No peers discovered yet. Click Scan for Peers, or invite someone via the Welcome card above." })), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 12 }, children: peers.map((p) => (_jsx(PeerCueCard, { peer: p, onConnect: (id) => void handleConnect(id) }, p.peerId))) }), stampError && (_jsxs("div", { style: { fontSize: 11, color: '#f87171', marginTop: 8 }, children: ["\u2717 ", stampError] })), lastLedgerQr && (_jsxs("div", { style: {
                    marginTop: 12, padding: 12, background: '#111827', border: '1px solid #1e2d45',
                    borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, maxWidth: 200,
                }, children: [_jsx(QRCodeCanvas, { value: `mnemo://ledger-entry?id=${lastLedgerQr.entryId}`, size: 140, bgColor: "#111827", fgColor: "#e2e8f0" }), _jsx("div", { style: { fontSize: 10, color: '#6ee7b7', textAlign: 'center' }, children: "\u2713 Connection certified & stamped to your IP ledger" }), _jsxs("div", { style: { fontSize: 9, color: '#475569', fontFamily: 'monospace' }, children: ["entry ", lastLedgerQr.entryId.slice(0, 12), "\u2026"] })] }))] }));
}
// ─── SocialTab ─────────────────────────────────────────────────────────────────
export function SocialTab() {
    const [inviteUrl, setInviteUrl] = useState(null);
    const [meshResult, setMeshResult] = useState(() => loadLastMeshTestResult());
    useEffect(() => {
        (async () => {
            try {
                const rawResult = await window.amplify?.federationGenerateInvite?.();
                const token = rawResult?.token;
                if (token)
                    setInviteUrl(`mnemo://accept?token=${token}`);
            }
            catch { /* non-fatal */ }
        })();
    }, []);
    // Refresh Check My Math whenever the tab regains focus, so a test run completed
    // in another tab shows up here without requiring prop-drilling across CleanShell.
    useEffect(() => {
        const onFocus = () => setMeshResult(loadLastMeshTestResult());
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, []);
    const checkMyMathTemplate = {
        ...CHECK_MY_MATH_BASE,
        body_text: meshResult
            ? `Real result from the One-Click Staged Test (${meshResult.dispatchMode === 'wan_mesh'
                ? `dispatched across ${meshResult.livePeersFound ?? '?'} live WAN mesh peer(s)`
                : 'dispatched locally on this machine'}): ${meshResult.correct}/${meshResult.scored} correct` +
                (meshResult.accuracy !== null ? ` (${(meshResult.accuracy * 100).toFixed(0)}%)` : '') +
                `. ${meshResult.datasetLabel}`
            : 'Pending live benchmark result \u2014 run the One-Click Staged Test (Package Store tab) to generate a real, honest number. No placeholder figures are shown here.',
    };
    return (_jsxs("div", { style: {
            height: '100%', overflowY: 'auto', padding: '16px 20px',
            background: '#0a0f1a', color: '#f0fdf4', fontFamily: 'system-ui, -apple-system, sans-serif',
        }, children: [_jsxs(CardSection, { title: "Welcome", children: [_jsx(CueDeckCardRenderer, { templateId: WELCOME_TEMPLATE_ID, qrValue: inviteUrl ?? undefined, qrCaption: "Scan to connect" }), _jsx("div", { style: { marginTop: 10 }, children: _jsx(CueDeckShareTab, {}) })] }), _jsx(CardSection, { title: "Name the Empress", children: _jsx(CueDeckCardRenderer, { templateId: EMPRESS_TEMPLATE_ID }) }), _jsx(CardSection, { title: "Check My Math", children: _jsx(CueDeckCardRenderer, { template: checkMyMathTemplate }) }), _jsx(CardSection, { title: "Join My Crew", children: _jsx(CueDeckCardRenderer, { template: JOIN_MY_CREW_TEMPLATE, qrValue: inviteUrl ?? undefined, qrCaption: "Scan to join my substrate network" }) }), _jsx(CardSection, { title: "Peer / Federation Connect", children: _jsx(PeerConnectSection, {}) })] }));
}
export default SocialTab;
