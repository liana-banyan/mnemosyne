// MnemosyneC · v0.1.56 · BP081 · 2026-06-12
// §2 Truth-Always · §3 Sonnet 4.6 · Founder-ratified
//
// LeanGauntletTab — Gauntlet tab for the 3-tab LeanShell.
// Renders a user-initiated federation panel ABOVE the existing GauntletTab.
// Per A1.3: discovery fires ONLY on user click — not automatically on tab open.

import React, { useState, useCallback, useEffect } from 'react';
import { GauntletTab } from './GauntletTab';
import { CueDeckShareTab } from './CueDeckShareTab';
import type { AuthState } from '../amplify.d';

interface LeanGauntletTabProps {
  authState: AuthState | null;
}

// ─── Federation Panel types ───────────────────────────────────────────────────

type ScanState = 'idle' | 'scanning' | 'done';

interface PeerSummary {
  id: string;
  transport: 'lan' | 'wan';
  address?: string;
  phase: string;
  // BP132 Yoke #22 task 2: grafted from PeerCueCard.tsx's `peer.displayName ?? peerId.slice(0,8)`
  // pattern — getMeshState() peers carry `displayName` (MnemosynePeer.displayName, shared/federation-protocol.ts)
  // but this panel's ad-hoc cast previously dropped it on the floor.
  displayName?: string;
}

// ─── Lean Federation Panel ───────────────────────────────────────────────────

type TestMyBoxOverlay = {
  tone: 'green' | 'yellow' | 'red';
  message: string;
} | null;

// BP132 Yoke #22 task 2: exported so the Package Store tab (CleanShell.tsx) can
// mount this exact panel for its "Scan for Peers" affordance without rebuilding it.
export function LeanFederationPanel() {
  const [expanded, setExpanded] = useState(true);
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [lanPeers, setLanPeers] = useState<PeerSummary[]>([]);
  const [wanPeers, setWanPeers] = useState<PeerSummary[]>([]);
  const [ownId, setOwnId] = useState<string>('');
  const [showCueDeckTab, setShowCueDeckTab] = useState(false);
  const [connectStatus, setConnectStatus] = useState<string | null>(null);
  const [lanIp, setLanIp] = useState<string>('');
  const [testLoading, setTestLoading] = useState(false);
  const [testOverlay, setTestOverlay] = useState<TestMyBoxOverlay>(null);
  const [bootZombieCount, setBootZombieCount] = useState(0);
  const [machineLabel, setMachineLabel] = useState('');
  const [editingLabel, setEditingLabel] = useState(false);

  useEffect(() => {
    window.amplify?.getOwnPeerId?.().then((id) => {
      if (id) setOwnId(id);
    }).catch(() => { /* non-fatal */ });
    window.amplify?.getMachineLabel?.().then((label) => {
      if (label) setMachineLabel(label);
    }).catch(() => { /* non-fatal */ });
    window.amplify?.getBootZombieCount?.().then((r) => {
      if (r?.count > 0) setBootZombieCount(r.count);
    }).catch(() => { /* non-fatal */ });
    const unsub = window.amplify?.onBootZombieFlush?.((data) => {
      if (data.count > 0) setBootZombieCount(data.count);
    });
    return () => { unsub?.(); };
  }, []);

  const handleTestMyBox = useCallback(async () => {
    if (testLoading) return;
    setTestLoading(true);
    setTestOverlay(null);
    try {
      const peerId = ownId || await window.amplify?.getOwnPeerId?.() || '';
      if (!peerId) {
        setTestOverlay({ tone: 'red', message: '✗ No peer ID — restart MnemosyneC' });
        return;
      }
      const result = await window.amplify?.callTestMyBox?.(peerId);
      if (!result) {
        setTestOverlay({ tone: 'red', message: '✗ Test My Box unavailable in this build' });
        return;
      }
      if (result.ok && result.answer === result.correct_answer) {
        const secs = typeof result.wall_clock_s === 'number' ? result.wall_clock_s.toFixed(1) : '?';
        const ms = result.processing_ms ?? 0;
        setTestOverlay({
          tone: 'green',
          message: `✓ READY · your box answered correctly in ${secs}s (inference: ${ms}ms)`,
        });
      } else if (result.answer && result.answer !== result.correct_answer) {
        setTestOverlay({
          tone: 'yellow',
          message: '⚠ Answered but wrong — mesh reliability check needed',
        });
      } else {
        setTestOverlay({
          tone: 'red',
          message: '✗ No answer in 90s — check ollama serve + gemma4:12b is pulled',
        });
      }
    } catch {
      setTestOverlay({ tone: 'red', message: '✗ Test My Box call failed — check network' });
    } finally {
      setTestLoading(false);
      setTimeout(() => setTestOverlay(null), 5000);
    }
  }, [ownId, testLoading]);

  const handleConnect = useCallback(async () => {
    if (scanState === 'scanning') return;
    setScanState('scanning');
    setLanPeers([]);
    setWanPeers([]);
    setConnectStatus(null);

    // BP134 Yoke #30 Task B: zero-config WAN auto-connect. Presence-discovered peers
    // (shared Supabase peer_presence table, bundled publishable key, no invite-token
    // exchange) are surfaced + connected automatically on this same user-click gesture,
    // before reading getMeshState, so a same-cooperative WAN peer (e.g. NJS_3D_FACTORY)
    // shows up without the user ever pasting/scanning a "Connect Via Invite Token".
    // Best-effort: a failure here (offline, Supabase unreachable) must not block the
    // existing LAN/known-WAN scan below.
    try {
      await window.amplify?.federationAutoConnectPresence?.();
    } catch {
      // Non-fatal: fall through to whatever peers are already known
    }

    try {
      const state = await window.amplify?.getMeshState?.() as {
        peers: Array<{ peerId: string; transport: string; address?: string; phase?: string; displayName?: string }>;
        relayConnected: boolean;
        ownPeerId: string;
      } | undefined;

      if (state) {
        setOwnId(state.ownPeerId ?? '');
        const lan: PeerSummary[] = [];
        const wan: PeerSummary[] = [];
        for (const p of (state.peers ?? [])) {
          // BP134 Yoke #30 Task A: PeerTransport is 'lan' | 'wan-relay' (see
          // shared/federation-protocol.ts) -- there is no 'wan' literal. The previous
          // `p.transport === 'wan' ? 'wan' : 'lan'` check never matched a relay-connected
          // peer's real transport value ('wan-relay'), so every relay/foreign-subnet peer
          // (e.g. NJS_3D_FACTORY, on a different subnet reached via relay) silently fell
          // into the LAN bucket and "WAN peers" undercounted. Only an explicit 'lan'
          // transport (real same-subnet UDP discovery, or a presence peer whose
          // lan_addresses matched our own subnet -- see presence_autoconnect.ts's
          // sharesLocalSubnet()) is LAN; everything else (relay peers, foreign subnets)
          // is WAN.
          const entry: PeerSummary = {
            id: p.peerId,
            transport: p.transport === 'lan' ? 'lan' : 'wan',
            address: p.address,
            phase: p.phase ?? 'discovered',
            displayName: p.displayName,
          };
          if (entry.transport === 'lan') lan.push(entry);
          else wan.push(entry);
        }
        setLanPeers(lan);
        setWanPeers(wan);
      }
    } catch {
      // Non-fatal: show no peers
    }

    // Also try to get LAN IP via MoneyPenny URL endpoint
    try {
      const mp = await window.amplify?.getMoneyPennyUrl?.();
      if (mp?.ips?.length) setLanIp(mp.ips[0]);
    } catch { /* non-fatal */ }

    setScanState('done');
  }, [scanState]);

  // BP139 Yoke 0.9.15: "x Forget" control for a stale peer row. Wired to the confirmed
  // mic:remove-peer IPC (preload micRemovePeer(peerId): Promise<{ok:boolean}>, src/main/preload.ts
  // ~L1825) via window.amplify.micRemovePeer. That IPC clears the peer from the saved
  // ConstellationPeer store (src/main/federation/constellation_discovery.ts, used by the MIC
  // distributed-plow feature) -- a different registry from the live peerDiscovery.getAllPeers()
  // source that getMeshState() reads for this panel's lanPeers/wanPeers. So a forgotten peer is
  // dropped from THIS list immediately (local state filter below), but if it is still online and
  // reachable it can be rediscovered by a later "Refresh Scan" -- forgetting stops MIC from
  // treating it as a known distributed-plow node, it is not a network-level block.
  const handleForgetPeer = useCallback(async (peerId: string) => {
    try {
      await window.amplify?.micRemovePeer?.(peerId);
    } catch {
      // Non-fatal: still drop it from the visible list below
    }
    setLanPeers((prev) => prev.filter((p) => p.id !== peerId));
    setWanPeers((prev) => prev.filter((p) => p.id !== peerId));
  }, []);

  const peerIdDisplay = ownId ? ownId.slice(0, 16) : '—';
  const totalPeers = lanPeers.length + wanPeers.length;

  const statusBadge = () => {
    if (scanState === 'idle') return { text: 'NOT SCANNED', color: '#475569', bg: '#47556911' };
    if (scanState === 'scanning') return { text: 'SCANNING', color: '#f59e0b', bg: '#f59e0b11' };
    if (totalPeers > 0) return { text: 'PEERS FOUND', color: '#22c55e', bg: '#22c55e11' };
    return { text: 'NONE FOUND', color: '#64748b', bg: '#64748b11' };
  };

  const badge = statusBadge();

  return (
    <div style={{
      background: '#0d1117',
      border: '1px solid #1e2a38',
      borderRadius: 8,
      marginBottom: 12,
      overflow: 'hidden',
    }}>
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 12px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', flex: 1 }}>
          ⬡ Connect to Other Machines
        </span>
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          padding: '2px 7px',
          borderRadius: 10,
          background: badge.bg,
          color: badge.color,
          marginRight: 8,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.04em',
        }}>
          {badge.text}
        </span>
        <span style={{ fontSize: 11, color: '#475569' }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ padding: '8px 12px 12px', borderTop: '1px solid #1a2332' }}>
          {/* Machine info */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 6,
            marginBottom: 10,
            fontSize: 12,
          }}>
            <div style={{ color: '#64748b' }}>
              This machine: <span style={{ color: '#94a3b8' }}>{lanIp || '—'}</span>
            </div>
            <div style={{ color: '#64748b' }} title="Your identity on the mesh">
              Peer ID: <span style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: 11 }}>{peerIdDisplay}</span>
            </div>
            <div style={{ color: '#64748b', marginTop: 6, gridColumn: '1 / -1' }}>
              Machine label:{' '}
              {editingLabel ? (
                <input
                  style={{ background: '#1e2a38', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 3, padding: '1px 6px', fontSize: 11, width: 140 }}
                  defaultValue={machineLabel}
                  maxLength={64}
                  onBlur={(e) => {
                    window.amplify?.setMachineLabel?.(e.target.value).then((v: string) => {
                      setMachineLabel(v);
                      setEditingLabel(false);
                    });
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  autoFocus
                />
              ) : (
                <span
                  style={{ color: '#94a3b8', cursor: 'pointer', textDecoration: 'underline dotted' }}
                  title="Click to edit your machine label"
                  onClick={() => setEditingLabel(true)}
                >
                  {machineLabel || '(click to set)'}
                </span>
              )}
            </div>
            <div style={{ color: '#64748b' }}>
              LAN peers:{' '}
              {scanState === 'scanning'
                ? <span style={{ color: '#f59e0b' }}>Scanning…</span>
                : scanState === 'idle'
                  ? <span style={{ color: '#475569' }}>(not yet scanned)</span>
                  : <span style={{ color: '#94a3b8' }}>{lanPeers.length || 'None found nearby'}</span>
              }
            </div>
            <div style={{ color: '#64748b' }}>
              WAN peers:{' '}
              {scanState === 'scanning'
                ? <span style={{ color: '#f59e0b' }}>Looking up…</span>
                : scanState === 'idle'
                  ? <span style={{ color: '#475569' }}>(not yet connected)</span>
                  : <span style={{ color: '#94a3b8' }}>{wanPeers.length || 'None'}</span>
              }
            </div>
          </div>

          {/* Peer list (if found) */}
          {scanState === 'done' && totalPeers > 0 && (
            <div style={{ marginBottom: 10 }}>
              {[...lanPeers, ...wanPeers].map((p) => (
                <div key={p.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 0',
                  borderTop: '1px solid #1a2332',
                  fontSize: 11,
                  color: '#94a3b8',
                }}>
                  <span>{p.transport === 'lan' ? '🔵 LAN' : '🌐 WAN'}</span>
                  <span style={{ fontWeight: 700, color: '#e2e8f0' }}>{p.displayName ?? p.id.slice(0, 8)}</span>
                  <span style={{ fontFamily: 'monospace', color: '#475569', fontSize: 10 }}>{p.id.slice(0, 12)}</span>
                  {p.address && <span style={{ color: '#475569' }}>{p.address}</span>}
                  <span style={{
                    fontSize: 10,
                    padding: '1px 5px',
                    borderRadius: 8,
                    background: '#22c55e22',
                    color: '#22c55e',
                  }}>{p.phase}</span>
                  <span style={{ flex: 1 }} />
                  <button
                    onClick={() => handleForgetPeer(p.id)}
                    title="Forget this peer"
                    style={{
                      background: 'none',
                      border: '1px solid #2a1a1a',
                      borderRadius: 4,
                      color: '#64748b',
                      fontSize: 10,
                      padding: '1px 6px',
                      cursor: 'pointer',
                      fontFamily: 'system-ui, sans-serif',
                      outline: 'none',
                      flexShrink: 0,
                    }}
                  >
                    ✕ Forget
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Action row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const }}>
            <button
              onClick={handleTestMyBox}
              disabled={testLoading}
              style={{
                background: testLoading ? '#1e2a38' : '#2563eb',
                color: testLoading ? '#475569' : '#fff',
                border: 'none',
                borderRadius: 5,
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: 600,
                cursor: testLoading ? 'not-allowed' : 'pointer',
                fontFamily: 'system-ui, sans-serif',
                outline: 'none',
              }}
            >
              {testLoading ? 'Testing…' : 'Test My Box'}
            </button>

            <button
              onClick={handleConnect}
              disabled={scanState === 'scanning'}
              style={{
                background: scanState === 'scanning' ? '#1e2a38' : '#10b981',
                color: scanState === 'scanning' ? '#475569' : '#fff',
                border: 'none',
                borderRadius: 5,
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: 600,
                cursor: scanState === 'scanning' ? 'not-allowed' : 'pointer',
                fontFamily: 'system-ui, sans-serif',
                outline: 'none',
              }}
            >
              {scanState === 'scanning' ? 'Scanning…' : scanState === 'idle' ? 'Connect to other machines ▼' : 'Refresh Scan'}
            </button>

            <button
              onClick={() => setShowCueDeckTab((v) => !v)}
              style={{
                background: showCueDeckTab ? '#0d1b2a' : 'none',
                color: '#6ee7b7',
                border: `1px solid ${showCueDeckTab ? 'rgba(110,231,183,0.35)' : '#1e4038'}`,
                borderRadius: 5,
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'system-ui, sans-serif',
                outline: 'none',
              }}
            >
              Connect Via Invite Token Availability
            </button>
          </div>

          {/* Cue Deck Cards · Share & Receive tab */}
          {showCueDeckTab && <CueDeckShareTab />}

          {bootZombieCount > 0 && (
            <div style={{ marginTop: 6, fontSize: 11, color: '#64748b' }}>
              Boot cleaned {bootZombieCount} zombie route{bootZombieCount === 1 ? '' : 's'}
            </div>
          )}

          {testOverlay && (
            <div style={{
              marginTop: 8,
              padding: '8px 10px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              background: testOverlay.tone === 'green' ? '#14532d44' : testOverlay.tone === 'yellow' ? '#713f1244' : '#7f1d1d44',
              color: testOverlay.tone === 'green' ? '#4ade80' : testOverlay.tone === 'yellow' ? '#fbbf24' : '#f87171',
              border: `1px solid ${testOverlay.tone === 'green' ? '#166534' : testOverlay.tone === 'yellow' ? '#92400e' : '#991b1b'}`,
            }}>
              {testOverlay.message}
            </div>
          )}

          {connectStatus && (
            <div style={{ marginTop: 6, fontSize: 11, color: connectStatus.includes('✓') ? '#22c55e' : '#94a3b8' }}>
              {connectStatus}
            </div>
          )}

          {/* Distributed mode indicator */}
          {scanState === 'done' && (
            <div style={{ marginTop: 8, fontSize: 11, color: '#475569', fontStyle: 'italic' }}>
              {totalPeers > 0
                ? `Gauntlet running distributed across ${totalPeers + 1} machine${totalPeers > 1 ? 's' : ''}`
                : 'Gauntlet running on this machine'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── LeanGauntletTab ─────────────────────────────────────────────────────────

export function LeanGauntletTab({ authState }: LeanGauntletTabProps) {
  return (
    <div style={{
      height: '100%',
      overflowY: 'auto',
      padding: '12px 16px',
    }}>
      <LeanFederationPanel />
      <GauntletTab authState={authState} />
    </div>
  );
}
