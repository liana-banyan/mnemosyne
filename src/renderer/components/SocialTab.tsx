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

import React, { useCallback, useEffect, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { CueDeckCardRenderer, type CueCardTemplate } from './CueDeckCardRenderer';
import { CueDeckShareTab } from './CueDeckShareTab';
import { PeerCueCard } from './PeerCueCard';
import { loadLastMeshTestResult } from './OneClickMeshTestPanel';
import type { MnemosynePeer } from '../../shared/federation-protocol';

const WELCOME_TEMPLATE_ID = '4206c74a-fe74-41e1-8572-771054bf2d9e';
const EMPRESS_TEMPLATE_ID = '75df3887-3fc7-4f18-bf69-118043fd3809';

// ─── Doctrine-only cards (no DB row exists yet — Facet g per addendum) ────────

const CHECK_MY_MATH_BASE: CueCardTemplate = {
  id: 'doctrine-check-my-math',
  title: 'Check My Math',
  subtitle: 'By Grabthar\u2019s Hammer \u2014 What a Savings',
  accent_color: 'primary',
  background_type: 'gradient',
  qr_position: 'bottom-right',
  qr_size: 96,
};

const JOIN_MY_CREW_TEMPLATE: CueCardTemplate = {
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

function CardSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em',
        textTransform: 'uppercase' as const, marginBottom: 10,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// ─── Peer connect card list (QR-ledger-per-connection) ────────────────────────

function PeerConnectSection() {
  const [peers, setPeers] = useState<MnemosynePeer[]>([]);
  const [ownPeerId, setOwnPeerId] = useState('');
  const [lastLedgerQr, setLastLedgerQr] = useState<{ peerId: string; entryId: string } | null>(null);
  const [stampError, setStampError] = useState<string | null>(null);

  const loadMesh = useCallback(async () => {
    try {
      const state = await (window as any).amplify?.getMeshState?.();
      if (state) {
        setPeers(state.peers ?? []);
        setOwnPeerId(state.ownPeerId ?? '');
      }
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => { void loadMesh(); }, [loadMesh]);

  const handleConnect = useCallback(async (peerId: string) => {
    setStampError(null);
    try {
      // Real, previously-existing federation:connect-peer handler (confirmed live —
      // see FederationTab.tsx / PeerCueCard.tsx comment fixes in this same Yoke).
      const connectResult = await (window as any).amplify?.federationConnectPeer?.(peerId);
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
      const stampResult = await (window as any).amplify?.ipLedgerStampConnection?.({
        peer_id: peerId,
        peer_display_name: peer?.displayName,
        connection_method: 'federation_connect_peer',
      });
      if (stampResult?.ok && stampResult.entry_id) {
        setLastLedgerQr({ peerId, entryId: stampResult.entry_id });
      } else {
        setStampError(stampResult?.error ?? 'Connected, but ledger stamp failed');
      }
    } catch (e) {
      setStampError(String(e));
    }
  }, [peers, loadMesh]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <button
          onClick={() => void loadMesh()}
          style={{
            background: '#10b981', color: '#fff', border: 'none', borderRadius: 6,
            padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          ⬡ Scan for Peers
        </button>
        <span style={{ fontSize: 11, color: '#64748b' }}>
          {peers.length} peer{peers.length !== 1 ? 's' : ''} found
          {ownPeerId && <span> · you are {ownPeerId.slice(0, 8)}</span>}
        </span>
      </div>

      {peers.length === 0 && (
        <div style={{ fontSize: 11, color: '#475569', fontStyle: 'italic' }}>
          No peers discovered yet. Click Scan for Peers, or invite someone via the Welcome card above.
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 12 }}>
        {peers.map((p) => (
          <PeerCueCard key={p.peerId} peer={p} onConnect={(id) => void handleConnect(id)} />
        ))}
      </div>

      {stampError && (
        <div style={{ fontSize: 11, color: '#f87171', marginTop: 8 }}>✗ {stampError}</div>
      )}

      {lastLedgerQr && (
        <div style={{
          marginTop: 12, padding: 12, background: '#111827', border: '1px solid #1e2d45',
          borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, maxWidth: 200,
        }}>
          <QRCodeCanvas value={`mnemo://ledger-entry?id=${lastLedgerQr.entryId}`} size={140} bgColor="#111827" fgColor="#e2e8f0" />
          <div style={{ fontSize: 10, color: '#6ee7b7', textAlign: 'center' as const }}>
            ✓ Connection certified &amp; stamped to your IP ledger
          </div>
          <div style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace' }}>
            entry {lastLedgerQr.entryId.slice(0, 12)}…
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SocialTab ─────────────────────────────────────────────────────────────────

export function SocialTab(): React.ReactElement {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [meshResult, setMeshResult] = useState(() => loadLastMeshTestResult());

  useEffect(() => {
    (async () => {
      try {
        const rawResult = await (window as any).amplify?.federationGenerateInvite?.();
        const token = rawResult?.token;
        if (token) setInviteUrl(`mnemo://accept?token=${token}`);
      } catch { /* non-fatal */ }
    })();
  }, []);

  // Refresh Check My Math whenever the tab regains focus, so a test run completed
  // in another tab shows up here without requiring prop-drilling across CleanShell.
  useEffect(() => {
    const onFocus = () => setMeshResult(loadLastMeshTestResult());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const checkMyMathTemplate: CueCardTemplate = {
    ...CHECK_MY_MATH_BASE,
    body_text: meshResult
      ? `Real result from the One-Click Staged Test: ${meshResult.correct}/${meshResult.scored} correct` +
        (meshResult.accuracy !== null ? ` (${(meshResult.accuracy * 100).toFixed(0)}%)` : '') +
        `. ${meshResult.datasetLabel}`
      : 'Pending live benchmark result \u2014 run the One-Click Staged Test (Package Store tab) to generate a real, honest number. No placeholder figures are shown here.',
  };

  return (
    <div style={{
      height: '100%', overflowY: 'auto', padding: '16px 20px',
      background: '#0a0f1a', color: '#f0fdf4', fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <CardSection title="Welcome">
        <CueDeckCardRenderer
          templateId={WELCOME_TEMPLATE_ID}
          qrValue={inviteUrl ?? undefined}
          qrCaption="Scan to connect"
        />
        <div style={{ marginTop: 10 }}>
          <CueDeckShareTab />
        </div>
      </CardSection>

      <CardSection title="Name the Empress">
        <CueDeckCardRenderer templateId={EMPRESS_TEMPLATE_ID} />
      </CardSection>

      <CardSection title="Check My Math">
        <CueDeckCardRenderer template={checkMyMathTemplate} />
      </CardSection>

      <CardSection title="Join My Crew">
        <CueDeckCardRenderer
          template={JOIN_MY_CREW_TEMPLATE}
          qrValue={inviteUrl ?? undefined}
          qrCaption="Scan to join my substrate network"
        />
      </CardSection>

      <CardSection title="Peer / Federation Connect">
        <PeerConnectSection />
      </CardSection>
    </div>
  );
}

export default SocialTab;
