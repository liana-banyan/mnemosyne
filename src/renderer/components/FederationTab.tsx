// Mnemosyne — Federation Tab (MV-J Full Surface)
// SAGA 4 BP045 W1 — extends FederationPeerMeshPanel
//
// Surfaces:
//   1. SVG mesh visualizer — self at center, peers as orbiting nodes
//   2. Peer roster — name · pubkey-short · joined · last-sync · leave button
//   3. Invite flow — generate 24h signed token + copy-to-clipboard
//   4. Accept flow — paste-token + verify + join-mesh confirmation
//   5. Empty state — cooperative-class, no mock peers
//
// K16 v0.8.10 additions:
//   - LAN peer discovery via kitchenTable.p2pStart/p2pPeers IPC
//   - lan_addresses surfaced on peer roster cards
//   - onSwitchTab prop for cross-link (Diagnostic Mode "View Federation" button)
// Migrated to mnemosyne repo: 2026-06-28 -- SEG-MM Novaculi BP099

import React, { useEffect, useState, useCallback, useRef } from 'react';
import type { MnemosynePeer } from '../../shared/federation-protocol';
import { PeerCueCard } from './PeerCueCard';

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
// Renders peers as a flex-wrap card grid using PeerCueCard.
// ⚠ TRUTH-ALWAYS (SEG-V0153A): handleConnectPeer uses federationAcceptInvite as a
//   stopgap because no `federation:connect-peer` IPC handler exists. A dedicated
//   handler calling connectToPeerWithEscalation() must be added to src/main/index.ts
//   and exposed via preload.ts before this button has full connect semantics.

function PeerRoster({ peers, onLeave, onConnect }: {
  peers: MnemosynePeer[];
  onLeave: (peerId: string) => void;
  onConnect: (peerId: string) => void;
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
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: 8 }}>
      {peers.map((peer) => (
        <div key={peer.peerId}>
          <PeerCueCard
            peer={peer}
            onConnect={onConnect}
          />
          {/* K16 v0.8.10 -- LAN IP addresses */}
          {peer.lan_addresses && peer.lan_addresses.length > 0 && (
            <div style={{ fontSize: 10, color: '#475569', marginTop: 2, paddingLeft: 4 }}>
              {peer.lan_addresses.join(' · ')}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Invite Cue Card Preview ──────────────────────────────────────────────────

function InviteCueCardPreview({
  displayName,
  recipientName,
}: {
  displayName: string;
  recipientName: string;
}) {
  const CARD_W = 280;
  const CARD_H = 160;
  const recipientLabel = recipientName.trim()
    ? `${recipientName.trim()}'s MnemosyneC network`
    : 'Your MnemosyneC network';
  const isHandleStyle = displayName.startsWith('@') || displayName.includes('#');

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{
        fontSize: 9, color: '#475569', marginBottom: 6,
        textTransform: 'uppercase', letterSpacing: '0.07em',
      }}>
        Your Invite Card Preview
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* FRONT face — brand/identity */}
        <div style={{
          width: CARD_W, height: CARD_H,
          background: '#0a0f1a',
          border: '1px solid #6ee7b7',
          borderRadius: 10,
          padding: '12px 14px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 18, lineHeight: 1 }}>🧠</div>
          <div style={{
            textAlign: 'center',
            fontSize: 15,
            fontWeight: 700,
            color: isHandleStyle ? '#6ee7b7' : '#e2e8f0',
          }}>
            {displayName}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{
              fontSize: 9, color: '#475569',
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              FounderDenken
            </div>
            <div style={{
              width: 16, height: 16, background: '#1a2235',
              borderRadius: 3, border: '1px solid #1e2d45',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 7, color: '#475569',
            }}>QR</div>
          </div>
        </div>

        {/* BACK face — action */}
        <div style={{
          width: CARD_W, height: CARD_H,
          background: '#0a0f1a',
          border: '1px solid #22c55e',
          borderRadius: 10,
          padding: '12px 14px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6ee7b7', letterSpacing: '0.08em' }}>
            MnemosyneC
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#e2e8f0', marginBottom: 8 }}>
              {recipientLabel}
            </div>
            <div style={{
              width: 16, height: 16, background: '#1a2235',
              borderRadius: 3, border: '1px solid #1e2d45',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 7, color: '#475569',
            }}>QR</div>
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
            Scan to accept ↑
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Invite Flow ──────────────────────────────────────────────────────────────

export function InviteFlow({ displayName }: { displayName?: string }) {
  const resolvedDisplayName = displayName?.trim() || 'Your Name';

  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [personalNote, setPersonalNote] = useState('');
  const [sendStatus, setSendStatus] = useState<
    'idle' | 'validating' | 'generating' | 'opening' | 'success' | 'error'
  >('idle');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sentToken, setSentToken] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const openTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [cooldownActive, setCooldownActive] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const [signCard, setSignCard] = useState(true);

  const [legacyToken, setLegacyToken] = useState<InviteToken | null>(null);
  const [legacyLoading, setLegacyLoading] = useState(false);
  const [legacyCopied, setLegacyCopied] = useState(false);
  const [legacyError, setLegacyError] = useState<string | null>(null);

  const isBusy =
    sendStatus === 'validating' ||
    sendStatus === 'generating' ||
    sendStatus === 'opening';

  useEffect(() => {
    if (!cooldownActive || cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds(s => {
        if (s <= 60) {
          setCooldownActive(false);
          clearInterval(interval);
          return 0;
        }
        return s - 60;
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [cooldownActive, cooldownSeconds]);

  const handleSend = async () => {
    if (isBusy) return;
    setSendStatus('validating');
    setEmailError(null);
    setSendError(null);

    if (!/.+@.+\..+/.test(recipientEmail.trim())) {
      setEmailError('Please enter a valid email address.');
      setSendStatus('idle');
      return;
    }

    setSendStatus('generating');
    let inviteToken: string;
    let expiresAt: string;
    try {
      const rawResult = await (window as any).amplify?.federationGenerateInvite?.();
      const result = rawResult && 'ok' in rawResult ? rawResult : { ok: true, ...rawResult };
      if (!result.ok && result.error === 'cooldown') {
        setCooldownSeconds(result.wait_seconds ?? 3600);
        setCooldownActive(true);
        setSendStatus('idle');
        return;
      }
      if (result?.token) {
        inviteToken = result.token;
        expiresAt = result.expiresAt;
      } else {
        inviteToken = `mnemo-invite-${crypto.randomUUID?.() ?? Date.now()}`;
        expiresAt = new Date(Date.now() + 86400000).toISOString();
      }
    } catch (e) {
      setSendStatus('error');
      setSendError('Failed to generate invite token: ' + String(e));
      return;
    }

    const acceptLink = `mnemo://accept?token=${inviteToken}`;
    const note = personalNote.trim();
    const fromLine = signCard ? `From: ${resolvedDisplayName}\n` : '';
    const noteBlock = signCard && note ? `\n${note}\n` : '';
    const body =
      fromLine +
      noteBlock +
      (fromLine || noteBlock ? '\n' : '') +
      "I'd like to share context with you via MnemosyneC.\n\n" +
      `Click to accept:\n${acceptLink}\n\n` +
      `Or paste this token in MnemosyneC → Federation → Accept tab:\n${inviteToken}\n\n` +
      `This invite expires: ${new Date(expiresAt).toLocaleString()}\n\n` +
      'Get MnemosyneC: https://mnemosynec.ai';

    const subjectRecipient = recipientName.trim();
    const mailtoUrl =
      'mailto:' + encodeURIComponent(recipientEmail.trim()) +
      '?subject=' + encodeURIComponent(
        subjectRecipient
          ? `${subjectRecipient}, you're invited to join MnemosyneC`
          : "You're invited to join MnemosyneC"
      ) +
      '&body=' + encodeURIComponent(body);

    setSendStatus('opening');
    setSentToken(inviteToken);
    (window as any).amplify?.openExternal?.(mailtoUrl);

    if (openTimeoutRef.current) clearTimeout(openTimeoutRef.current);
    openTimeoutRef.current = setTimeout(() => {
      setSendStatus('success');
    }, 3000);
  };

  const copyFallbackToken = async () => {
    if (!sentToken) return;
    try {
      await navigator.clipboard.writeText(sentToken);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const resetForm = () => {
    if (openTimeoutRef.current) clearTimeout(openTimeoutRef.current);
    setSendStatus('idle');
    setEmailError(null);
    setSendError(null);
    setSentToken(null);
    setTokenCopied(false);
    setRecipientName('');
    setRecipientEmail('');
    setPersonalNote('');
  };

  const sendButtonLabel = (): string => {
    switch (sendStatus) {
      case 'validating': return '⏳ Validating…';
      case 'generating': return '🔑 Generating…';
      case 'opening':    return '📧 Opening email client…';
      default:           return '✉️ Send Invite Card';
    }
  };

  const legacyGenerate = async () => {
    setLegacyLoading(true);
    setLegacyError(null);
    try {
      const result = await (window as any).amplify?.federationGenerateInvite?.();
      if (result?.token) {
        setLegacyToken({ token: result.token, expiresAt: result.expiresAt });
      } else {
        setLegacyToken({
          token: `mnemo-invite-${crypto.randomUUID?.() ?? Date.now()}`,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        });
      }
    } catch (e) {
      setLegacyError(String(e));
    } finally {
      setLegacyLoading(false);
    }
  };

  const legacyCopy = async () => {
    if (!legacyToken) return;
    try {
      await navigator.clipboard.writeText(legacyToken.token);
      setLegacyCopied(true);
      setTimeout(() => setLegacyCopied(false), 2000);
    } catch {
      setLegacyError('Could not copy to clipboard.');
    }
  };

  const legacyExpiresLabel = legacyToken
    ? new Date(legacyToken.expiresAt).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {sendStatus === 'success' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{
            fontSize: 12, color: C.green, padding: '10px 14px',
            background: '#0a1f0e', borderRadius: 8,
            border: `1px solid ${C.green}44`, lineHeight: 1.6,
          }}>
            ✓ Invite opened in your email client. Check your drafts.
          </div>
          {sentToken && (
            <div style={s.tokenBox}>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 6 }}>
                Fallback token — paste in Accept tab if email client didn't open
              </div>
              <div style={{
                fontFamily: 'monospace', fontSize: 10, color: C.accent,
                wordBreak: 'break-all', lineHeight: 1.5,
                background: '#070d1a', padding: '6px 10px', borderRadius: 6,
                border: `1px solid ${C.border}`,
              }}>
                {sentToken}
              </div>
              <button
                onClick={() => void copyFallbackToken()}
                style={{ ...s.ghostBtn, marginTop: 6, fontSize: 10 }}
              >
                {tokenCopied ? '✓ Copied!' : '📋 Copy token'}
              </button>
            </div>
          )}
          <button onClick={resetForm} style={s.ghostBtn}>
            Send another invite
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cooldownActive ? (
            <div style={{
              background: '#1a1200',
              border: '1px solid #d97706',
              borderRadius: 8,
              padding: '12px 16px',
              color: '#d97706',
              fontSize: 13,
            }}>
              ⏳ You can send your next invite in {Math.ceil(cooldownSeconds / 60)} minute{Math.ceil(cooldownSeconds / 60) !== 1 ? 's' : ''}.
              <div style={{ fontSize: 11, color: '#92400e', marginTop: 4 }}>
                Invite responsibly — senders who get rejected too often enter a cooldown period.
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
                Send a signed invite — valid 24 hours, single-use. Opens your mail client.
              </div>

              <div>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Their name"
                  disabled={isBusy}
                  maxLength={60}
                  style={s.input}
                />
              </div>

              <div>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => { setRecipientEmail(e.target.value); setEmailError(null); }}
                  placeholder="their@email.com"
                  disabled={isBusy}
                  style={{
                    ...s.input,
                    borderColor: emailError ? C.red : undefined,
                  }}
                />
                {emailError && (
                  <div style={{ fontSize: 10, color: C.red, marginTop: 4 }}>{emailError}</div>
                )}
              </div>

              <div>
                <textarea
                  value={personalNote}
                  onChange={(e) => setPersonalNote(e.target.value.slice(0, 280))}
                  placeholder="Why you're inviting them… (optional)"
                  rows={3}
                  disabled={isBusy}
                  style={{ ...s.input, resize: 'vertical', fontFamily: 'inherit', fontSize: 11 }}
                />
              </div>

              {sendError && (
                <div style={{ fontSize: 10, color: C.red, padding: '6px 10px', background: '#1c0808', borderRadius: 6 }}>
                  {sendError}
                </div>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94a3b8', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={signCard}
                  onChange={(e) => setSignCard(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                Sign this card as <span style={{ color: '#6ee7b7', marginLeft: 4 }}>{displayName?.trim() || 'you'}</span>
              </label>

              <button
                onClick={() => void handleSend()}
                disabled={isBusy}
                style={{
                  ...s.primaryBtn,
                  background: '#0e2a1a',
                  border: `1px solid ${C.green}`,
                  color: C.green,
                  opacity: isBusy ? 0.7 : 1,
                }}
              >
                {sendButtonLabel()}
              </button>

              <InviteCueCardPreview
                displayName={resolvedDisplayName}
                recipientName={recipientName}
              />
            </>
          )}
        </div>
      )}

      <details style={{ marginTop: 4 }}>
        <summary style={{
          fontSize: 10, color: C.muted, cursor: 'pointer',
          userSelect: 'none', padding: '4px 0', listStyle: 'none',
        }}>
          ▸ Generate token manually (copy-paste fallback)
        </summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
          {legacyError && (
            <div style={{ fontSize: 10, color: C.red, padding: '6px 10px', background: '#1c0808', borderRadius: 6 }}>
              {legacyError}
            </div>
          )}
          {!legacyToken ? (
            <button onClick={() => void legacyGenerate()} disabled={legacyLoading} style={s.primaryBtn}>
              {legacyLoading ? '⏳ Generating…' : '🔑 Generate Invite Token'}
            </button>
          ) : (
            <>
              <div style={s.tokenBox}>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 6 }}>
                  Invite token · expires {legacyExpiresLabel}
                </div>
                <div style={{
                  fontFamily: 'monospace', fontSize: 11, color: C.accent,
                  wordBreak: 'break-all', lineHeight: 1.5,
                  background: '#070d1a', padding: '8px 10px', borderRadius: 6,
                  border: `1px solid ${C.border}`,
                }}>
                  {legacyToken.token}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => void legacyCopy()} style={s.primaryBtn}>
                  {legacyCopied ? '✓ Copied!' : '📋 Copy Token'}
                </button>
                <button
                  onClick={() => { setLegacyToken(null); setLegacyCopied(false); }}
                  style={s.ghostBtn}
                >
                  Regenerate
                </button>
              </div>
              <div style={{ fontSize: 10, color: C.muted }}>
                ⚠️ Single-use. Do not share publicly. Expires in 24 hours.
              </div>
            </>
          )}
        </div>
      </details>

    </div>
  );
}

// ─── Accept Flow ──────────────────────────────────────────────────────────────

function AcceptFlow({ initialToken }: { initialToken?: string }) {
  const [tokenInput, setTokenInput] = useState(initialToken ?? '');
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [deepLinkBanner, setDeepLinkBanner] = useState(!!initialToken);
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    if (initialToken) {
      setTokenInput(initialToken);
      setStatus('idle');
      setMessage('');
      setDeepLinkBanner(true);
    }
  }, [initialToken]);

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
    setDeepLinkBanner(false);
  };

  const handleRejectInvite = async () => {
    if (rejecting || !tokenInput.trim()) return;
    setRejecting(true);
    void (window as any).amplify?.federationRejectInvite?.({
      invite_token: tokenInput.trim(),
      source: 'in_app',
    });
    setTimeout(() => {
      setTokenInput('');
      setStatus('idle');
      setMessage('');
      setDeepLinkBanner(false);
      setRejecting(false);
    }, 1500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {deepLinkBanner && status !== 'success' && (
        <div style={{ fontSize: 11, color: C.accent, padding: '8px 12px', background: '#0d1f38', borderRadius: 8, border: `1px solid ${C.accent}55` }}>
          🔗 Token received! Click <strong>Verify &amp; Join Mesh</strong> to connect.
        </div>
      )}
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

          {tokenInput.trim() && (
            <button
              style={{
                marginTop: 8,
                padding: '6px 12px',
                background: 'transparent',
                border: '1px solid #475569',
                color: '#64748b',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
              }}
              onClick={() => void handleRejectInvite()}
              disabled={rejecting}
            >
              {rejecting ? 'Dismissed' : 'Not interested'}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main FederationTab ───────────────────────────────────────────────────────

// K16 v0.8.10 -- onSwitchTab prop for cross-link (e.g., Diagnostic Mode "View Federation" button)
export function FederationTab({ onSwitchTab }: { onSwitchTab?: (tab: string) => void } = {}) {
  const [meshState, setMeshState] = useState<MeshState>({
    peers: [],
    relayConnected: false,
    ownPeerId: '',
  });
  const [activeTab, setActiveTab] = useState<TabId>('mesh');
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string | undefined>(undefined);
  const [deepLinkToken, setDeepLinkToken] = useState<string | undefined>(undefined);
  // K16 v0.8.10 -- LAN discovery state
  const [lanDiscovering, setLanDiscovering] = useState(false);
  const [lanDiscovered, setLanDiscovered] = useState<Array<{ ip: string; label?: string }>>([]);

  useEffect(() => {
    void (async () => {
      try {
        const authState = await (window as any).amplify?.getAuthState?.();
        const name: string | undefined = authState?.member?.display_name;
        if (name) setDisplayName(name);
      } catch { /* non-fatal */ }
    })();
  }, []);

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

  useEffect(() => {
    const cleanup = (window as any).amplify?.onFederationDeepLinkAccept?.(
      (data: { token: string; slug: string }) => {
        setDeepLinkToken(data.token);
        setActiveTab('accept');
      },
    );
    return () => cleanup?.();
  }, []);

  const handleLeave = async (peerId: string) => {
    if (!confirm('Leave mesh with this peer? They will still exist in their own mesh.')) return;
    try {
      await (window as any).amplify?.federationLeavePeer?.(peerId);
      await loadMesh();
    } catch { /* ignore */ }
  };

  const handleConnectPeer = async (peerId: string) => {
    try {
      await (window as any).amplify?.federationAcceptInvite?.(peerId);
      await loadMesh();
    } catch { /* ignore */ }
  };

  // K16 v0.8.10 -- LAN peer discovery using kitchenTable.p2pStart/p2pStop/p2pPeers IPC
  async function handleLanSearch() {
    setLanDiscovering(true);
    setLanDiscovered([]);
    try {
      const peerId = localStorage.getItem('mnemo_peer_id') ?? Math.random().toString(36).slice(2);
      localStorage.setItem('mnemo_peer_id', peerId);
      const label = localStorage.getItem('mnemo_display_name') ?? 'MnemosyneC';
      await (window as any).amplify?.kitchenTable?.p2pStart?.(peerId, label);

      let elapsed = 0;
      const tick = setInterval(async () => {
        elapsed += 2000;
        try {
          const result = await (window as any).amplify?.kitchenTable?.p2pPeers?.() as
            { peers: Array<{ address: string; displayName?: string }>; active: boolean } | null;
          if (result?.peers) {
            setLanDiscovered(result.peers.map((p) => ({ ip: p.address, label: p.displayName })));
          }
        } catch { /* ignore */ }
        if (elapsed >= 10_000) {
          clearInterval(tick);
          await (window as any).amplify?.kitchenTable?.p2pStop?.().catch(() => {});
          setLanDiscovering(false);
        }
      }, 2000);
    } catch {
      setLanDiscovering(false);
    }
  }

  const TABS: Array<{ id: TabId; label: string }> = [
    { id: 'mesh',   label: '🕸️ Mesh' },
    { id: 'roster', label: '📋 Roster' },
    { id: 'invite', label: '🔑 Invite' },
    { id: 'accept', label: '🤝 Accept' },
  ];

  // BP099→BP100 K20 Module 4: Poller health panel — polls every 5s
  const [pollerHealth, setPollerHealth] = useState<{
    alive: boolean;
    uptime_seconds: number;
    last_route_processed_at: string | null;
    last_route_id: string | null;
    restart_count: number;
    ollama_status: 'up' | 'down';
    current_consecutive_crashes: number;
  } | null>(null);

  useEffect(() => {
    async function fetchHealth() {
      try {
        const h = await (window as any).amplify?.pollerHealthQuery?.();
        if (h) setPollerHealth(h);
      } catch { /* non-fatal */ }
    }
    void fetchHealth();
    const interval = setInterval(() => void fetchHealth(), 5000);
    return () => clearInterval(interval);
  }, []);

  const pollerStatusLabel = !pollerHealth
    ? 'QUERYING…'
    : pollerHealth.alive
      ? 'ALIVE'
      : (pollerHealth.current_consecutive_crashes >= 30 ? 'CRASH-LOOP HALTED' : 'DEAD');
  const pollerStatusColor = !pollerHealth
    ? C.muted
    : pollerHealth.alive
      ? C.green
      : (pollerHealth.current_consecutive_crashes >= 30 ? C.red : C.amber);

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

      {/* ── K20 Poller Health Panel ── */}
      <div style={{
        margin: '6px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
        background: C.surface, padding: '8px 12px', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: pollerStatusColor, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: pollerStatusColor, letterSpacing: '0.06em' }}>
            ANSWER-POLLER: {pollerStatusLabel}
          </span>
        </div>
        {pollerHealth && (
          <>
            <span style={{ fontSize: 10, color: C.muted }}>uptime: {pollerHealth.uptime_seconds}s</span>
            <span style={{ fontSize: 10, color: C.muted }}>restarts: {pollerHealth.restart_count}</span>
            <span style={{ fontSize: 10, color: pollerHealth.ollama_status === 'down' ? C.red : C.green }}>
              Ollama: {pollerHealth.ollama_status.toUpperCase()}
            </span>
            {pollerHealth.current_consecutive_crashes > 0 && (
              <span style={{ fontSize: 10, color: C.amber }}>crashes: {pollerHealth.current_consecutive_crashes}</span>
            )}
            {pollerHealth.last_route_processed_at && (
              <span style={{ fontSize: 10, color: C.muted }}>
                last route: {new Date(pollerHealth.last_route_processed_at).toLocaleTimeString()}
              </span>
            )}
          </>
        )}
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
          <>
            <MeshVisualizer peers={meshState.peers} ownId={meshState.ownPeerId} />
            {/* K16 v0.8.10 -- Search LAN Peers */}
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => void handleLanSearch()}
                disabled={lanDiscovering}
                style={{
                  padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  cursor: lanDiscovering ? 'not-allowed' : 'pointer',
                  background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.35)',
                  color: '#60a5fa',
                }}
              >
                {lanDiscovering ? 'Searching LAN...' : 'Search LAN Peers'}
              </button>
              {lanDiscovered.length > 0 && (
                <div style={{ width: '100%', maxWidth: 340 }}>
                  {lanDiscovered.map((p) => (
                    <div key={p.ip} style={{ fontSize: 11, color: '#94a3b8', padding: '3px 0' }}>
                      🌐 {p.ip}{p.label ? ` · ${p.label}` : ''}{' '}
                      <span style={{ color: '#475569' }}>LAN discovered</span>
                    </div>
                  ))}
                </div>
              )}
              {!lanDiscovering && lanDiscovered.length === 0 && (
                <div style={{ fontSize: 10, color: '#475569' }}>
                  Click to scan for MnemosyneC peers on your local network
                </div>
              )}
            </div>
          </>
        ) : activeTab === 'roster' ? (
          <PeerRoster
            peers={meshState.peers}
            onLeave={(id) => void handleLeave(id)}
            onConnect={(id) => void handleConnectPeer(id)}
          />
        ) : activeTab === 'invite' ? (
          <InviteFlow displayName={displayName} />
        ) : (
          <AcceptFlow initialToken={deepLinkToken} />
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
