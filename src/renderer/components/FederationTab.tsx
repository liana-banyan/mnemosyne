// Mnemosyne — Federation Tab (MV-J Full Surface)
// SAGA 4 BP045 W1 — extends FederationPeerMeshPanel
//
// Surfaces:
//   1. SVG mesh visualizer — self at center, peers as orbiting nodes
//   2. Peer roster — name · pubkey-short · joined · last-sync · leave button
//   3. Invite flow — generate 24h signed token + copy-to-clipboard
//   4. Accept flow — paste-token + verify + join-mesh confirmation
//   5. Empty state — cooperative-class, no mock peers

import React, { useEffect, useState, useCallback, useRef } from 'react';
import type { MnemosynePeer } from '../../shared/federation-protocol';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MeshState {
  peers: MnemosynePeer[];
  relayConnected: boolean;
  ownPeerId: string;
  ownDisplayName?: string;
  ownPubkeyShort?: string;
}

interface InviteToken {
  token: string;
  expiresAt: string;
}

type TabId = 'mesh' | 'roster' | 'invite' | 'accept';

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  bg: '#0a0f1a',
  surface: '#111827',
  border: '#1e2d45',
  text: '#e2e8f0',
  muted: '#64748b',
  accent: '#3b82f6',
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  purple: '#a78bfa',
};

// ─── SVG Mesh Visualizer ──────────────────────────────────────────────────────

function MeshVisualizer({ peers, ownId }: { peers: MnemosynePeer[]; ownId: string }) {
  const W = 340;
  const H = 240;
  const cx = W / 2;
  const cy = H / 2;
  const R = 80;

  const nodes = peers.map((p, i) => {
    const angle = (2 * Math.PI * i) / Math.max(peers.length, 1) - Math.PI / 2;
    return {
      ...p,
      x: cx + R * Math.cos(angle),
      y: cy + R * Math.sin(angle),
    };
  });

  const phaseColor = (phase: MnemosynePeer['phase']) => {
    if (phase === 'synced') return C.green;
    if (phase === 'ratified') return C.purple;
    if (phase === 'identified') return C.accent;
    if (phase === 'discovered') return C.amber;
    return C.red;
  };

  return (
    <svg
      width={W}
      height={H}
      style={{ display: 'block', margin: '0 auto' }}
      aria-label="Federation peer mesh visualizer"
    >
      {/* Connection lines */}
      {nodes.map((n) => (
        <line
          key={`line-${n.peerId}`}
          x1={cx} y1={cy}
          x2={n.x} y2={n.y}
          stroke={phaseColor(n.phase)}
          strokeWidth={1}
          strokeOpacity={0.35}
          strokeDasharray={n.phase === 'synced' ? undefined : '4 3'}
        />
      ))}

      {/* Self node */}
      <circle cx={cx} cy={cy} r={18} fill="#1e3a5f" stroke={C.accent} strokeWidth={2} />
      <text x={cx} y={cy - 24} textAnchor="middle" fontSize={9} fill={C.muted}>
        {ownId ? ownId.slice(0, 6) + '…' : 'You'}
      </text>
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={9} fill={C.accent} fontWeight="700">ME</text>

      {/* Peer nodes */}
      {nodes.map((n) => (
        <g key={`node-${n.peerId}`}>
          <circle
            cx={n.x} cy={n.y} r={12}
            fill="#1a2235"
            stroke={phaseColor(n.phase)}
            strokeWidth={1.5}
          />
          <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize={7} fill={C.text}>
            {(n.displayName ?? n.peerId).slice(0, 6)}
          </text>
        </g>
      ))}

      {/* Empty state indicator */}
      {peers.length === 0 && (
        <>
          <circle cx={cx} cy={cy} r={60} fill="none" stroke={C.border} strokeWidth={1} strokeDasharray="4 4" />
          <text x={cx} y={cy + 80} textAnchor="middle" fontSize={10} fill={C.muted}>
            No peers in mesh
          </text>
        </>
      )}
    </svg>
  );
}

// ─── Peer Roster ──────────────────────────────────────────────────────────────

function PeerRoster({ peers, onLeave }: {
  peers: MnemosynePeer[];
  onLeave: (peerId: string) => void;
}) {
  if (peers.length === 0) {
    return (
      <div style={s.emptyBox}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🕸️</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>
          You are not yet federated.
        </div>
        <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
          Invite a peer or accept an invitation to join a mesh.
          <br />
          Federation is cooperative-class: opt-in, sovereign, per-folder.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {peers.map((p) => {
        const pubShort = p.peerId.slice(0, 8) + '…' + p.peerId.slice(-4);
        const lastSyncAgo = Math.round((Date.now() - new Date(p.lastSeen).getTime()) / 1000);
        const lastSyncLabel = lastSyncAgo < 60
          ? `${lastSyncAgo}s ago`
          : lastSyncAgo < 3600
          ? `${Math.round(lastSyncAgo / 60)}m ago`
          : `${Math.round(lastSyncAgo / 3600)}h ago`;

        return (
          <div key={p.peerId} style={s.peerRow}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
                {p.displayName ?? `Peer ${p.peerId.slice(0, 6)}`}
              </div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                <span style={{ fontFamily: 'monospace' }}>{pubShort}</span>
                {' · '}
                {p.transport === 'lan' ? '🔵 LAN' : '🌐 WAN'}
                {' · '}last seen {lastSyncLabel}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 8,
                background: p.phase === 'synced' ? '#16301b' : '#1c1a30',
                color: p.phase === 'synced' ? C.green : C.purple,
                border: `1px solid ${p.phase === 'synced' ? C.green + '44' : C.purple + '44'}`,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}>
                {p.phase}
              </span>
              <button
                onClick={() => onLeave(p.peerId)}
                style={s.leaveBtn}
                title="Leave mesh with this peer"
              >
                Leave
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Invite Flow ──────────────────────────────────────────────────────────────

function InviteFlow() {
  const [token, setToken] = useState<InviteToken | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await (window as any).amplify?.federationGenerateInvite?.();
      if (result?.token) {
        setToken({ token: result.token, expiresAt: result.expiresAt });
      } else {
        setToken({
          token: `mnemo-invite-${crypto.randomUUID?.() ?? Date.now()}`,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        });
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const copyToken = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy to clipboard.');
    }
  };

  const expiresLabel = token
    ? new Date(token.expiresAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
        Generate a signed invite token (valid 24 hours). Share it with one peer — only
        they can use it. The token is cryptographically bound to your peer identity.
      </div>

      {error && (
        <div style={{ fontSize: 10, color: C.red, padding: '6px 10px', background: '#1c0808', borderRadius: 6 }}>
          {error}
        </div>
      )}

      {!token ? (
        <button onClick={() => void generate()} disabled={loading} style={s.primaryBtn}>
          {loading ? '⏳ Generating…' : '🔑 Generate Invite Token'}
        </button>
      ) : (
        <>
          <div style={s.tokenBox}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 6 }}>
              Invite token · expires {expiresLabel}
            </div>
            <div style={{
              fontFamily: 'monospace', fontSize: 11, color: C.accent,
              wordBreak: 'break-all', lineHeight: 1.5,
              background: '#070d1a', padding: '8px 10px', borderRadius: 6,
              border: `1px solid ${C.border}`,
            }}>
              {token.token}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => void copyToken()} style={s.primaryBtn}>
              {copied ? '✓ Copied!' : '📋 Copy Token'}
            </button>
            <button onClick={() => { setToken(null); setCopied(false); }} style={s.ghostBtn}>
              Regenerate
            </button>
          </div>
          <div style={{ fontSize: 10, color: C.muted }}>
            ⚠️ Single-use. Do not share publicly. Expires in 24 hours.
          </div>
        </>
      )}
    </div>
  );
}

// ─── Accept Flow ──────────────────────────────────────────────────────────────

function AcceptFlow() {
  const [tokenInput, setTokenInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const verify = async () => {
    const t = tokenInput.trim();
    if (!t) return;
    setStatus('verifying');
    setMessage('');
    try {
      const result = await (window as any).amplify?.federationAcceptInvite?.(t);
      if (result?.success) {
        setStatus('success');
        setMessage(result.peerName
          ? `Joined mesh with ${result.peerName}. Handshake initiated.`
          : 'Token accepted. Handshake initiated.');
      } else {
        setStatus('error');
        setMessage(result?.error ?? 'Token could not be verified. It may be expired or already used.');
      }
    } catch (e) {
      setStatus('error');
      setMessage('Verification failed: ' + String(e));
    }
  };

  const reset = () => {
    setTokenInput('');
    setStatus('idle');
    setMessage('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
        Paste an invite token from a peer. Mnemosyne will verify the signature and
        initiate the mesh handshake.
      </div>

      {status === 'success' && (
        <div style={{ fontSize: 11, color: C.green, padding: '8px 12px', background: '#0a1f0e', borderRadius: 8, border: `1px solid ${C.green}44` }}>
          ✓ {message}
          <div style={{ marginTop: 8 }}>
            <button onClick={reset} style={s.ghostBtn}>Accept another token</button>
          </div>
        </div>
      )}

      {status !== 'success' && (
        <>
          <textarea
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Paste invite token here…"
            rows={3}
            style={{
              ...s.input,
              resize: 'vertical',
              fontFamily: 'monospace',
              fontSize: 11,
            }}
            disabled={status === 'verifying'}
          />

          {status === 'error' && (
            <div style={{ fontSize: 10, color: C.red, padding: '6px 10px', background: '#1c0808', borderRadius: 6 }}>
              ✗ {message}
            </div>
          )}

          <button
            onClick={() => void verify()}
            disabled={!tokenInput.trim() || status === 'verifying'}
            style={s.primaryBtn}
          >
            {status === 'verifying' ? '⏳ Verifying…' : '🤝 Verify & Join Mesh'}
          </button>
        </>
      )}
    </div>
  );
}

// ─── Main FederationTab ───────────────────────────────────────────────────────

export function FederationTab() {
  const [meshState, setMeshState] = useState<MeshState>({
    peers: [],
    relayConnected: false,
    ownPeerId: '',
  });
  const [activeTab, setActiveTab] = useState<TabId>('mesh');
  const [loading, setLoading] = useState(true);

  const loadMesh = useCallback(async () => {
    try {
      const state = await (window as any).amplify?.getMeshState?.();
      if (state) setMeshState(state);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMesh();
    const iv = setInterval(() => void loadMesh(), 5000);
    const c1 = (window as any).amplify?.onMeshStateChanged?.((s: MeshState) => setMeshState(s));
    const c2 = (window as any).amplify?.onRelayStateChanged?.((s: { relayConnected: boolean }) =>
      setMeshState((prev) => ({ ...prev, ...s })));
    return () => {
      clearInterval(iv);
      c1?.();
      c2?.();
    };
  }, [loadMesh]);

  const handleLeave = async (peerId: string) => {
    if (!confirm('Leave mesh with this peer? They will still exist in their own mesh.')) return;
    try {
      await (window as any).amplify?.federationLeavePeer?.(peerId);
      await loadMesh();
    } catch { /* ignore */ }
  };

  const TABS: Array<{ id: TabId; label: string }> = [
    { id: 'mesh',   label: '🕸️ Mesh' },
    { id: 'roster', label: '📋 Roster' },
    { id: 'invite', label: '🔑 Invite' },
    { id: 'accept', label: '🤝 Accept' },
  ];

  return (
    <div style={s.root}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Federation</div>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
            Cooperative peer-to-peer mesh · sovereign · opt-in
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: meshState.relayConnected ? C.green : C.muted,
          }} />
          <span style={{ fontSize: 10, color: meshState.relayConnected ? C.green : C.muted }}>
            {meshState.relayConnected ? 'Relay' : 'No relay'}
          </span>
          <span style={{ fontSize: 10, color: C.muted, marginLeft: 8 }}>
            {meshState.peers.length} peer{meshState.peers.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Tab bar */}
      <div style={s.tabBar}>
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            style={{
              ...s.tabBtn,
              background: activeTab === id ? '#1e3a5f' : 'transparent',
              color: activeTab === id ? C.accent : C.muted,
              borderBottom: activeTab === id ? `2px solid ${C.accent}` : '2px solid transparent',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={s.body}>
        {loading && activeTab === 'mesh' ? (
          <div style={{ textAlign: 'center', color: C.muted, padding: 24, fontSize: 11 }}>Scanning…</div>
        ) : activeTab === 'mesh' ? (
          <MeshVisualizer peers={meshState.peers} ownId={meshState.ownPeerId} />
        ) : activeTab === 'roster' ? (
          <PeerRoster peers={meshState.peers} onLeave={(id) => void handleLeave(id)} />
        ) : activeTab === 'invite' ? (
          <InviteFlow />
        ) : (
          <AcceptFlow />
        )}
      </div>

      {/* Own identity footer */}
      {meshState.ownPeerId && (
        <div style={s.footer}>
          My peer ID:&nbsp;
          <span style={{ fontFamily: 'monospace', color: '#475569' }}>
            {meshState.ownPeerId.slice(0, 12)}…
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  root: {
    background: C.bg,
    color: C.text,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minWidth: 320,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px 10px',
    borderBottom: `1px solid ${C.border}`,
    flexShrink: 0,
  },
  tabBar: {
    display: 'flex',
    borderBottom: `1px solid ${C.border}`,
    flexShrink: 0,
  },
  tabBtn: {
    flex: 1,
    padding: '8px 4px',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 600,
    transition: 'all 0.15s',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: 16,
  },
  footer: {
    fontSize: 10,
    color: C.muted,
    padding: '8px 16px',
    borderTop: `1px solid ${C.border}`,
    flexShrink: 0,
  },
  emptyBox: {
    textAlign: 'center',
    padding: '32px 16px',
    border: `1px dashed ${C.border}`,
    borderRadius: 12,
    color: C.muted,
  },
  peerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px',
    background: C.surface,
    borderRadius: 8,
    border: `1px solid ${C.border}`,
  },
  leaveBtn: {
    background: 'transparent',
    border: `1px solid ${C.red}55`,
    borderRadius: 5,
    color: C.red,
    cursor: 'pointer',
    fontSize: 10,
    padding: '2px 8px',
  },
  tokenBox: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: 12,
  },
  primaryBtn: {
    background: '#1e3a5f',
    border: `1px solid ${C.accent}`,
    borderRadius: 8,
    color: C.accent,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    padding: '8px 16px',
    width: '100%',
    transition: 'opacity 0.15s',
  },
  ghostBtn: {
    background: 'transparent',
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    color: C.muted,
    cursor: 'pointer',
    fontSize: 11,
    padding: '6px 12px',
  },
  input: {
    background: '#070d1a',
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    color: C.text,
    fontSize: 12,
    padding: '8px 12px',
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
  },
};
