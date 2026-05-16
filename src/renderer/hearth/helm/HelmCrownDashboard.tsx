// Mnemosyne — Helm Crown Dashboard
// MV-HELM-CROWN-AMB SAGA 6 BP045 W1
//
// Role-gated: helm-crown | founder
// Surfaces: Roll seat · ratification activity · veto history · Crown-to-Crown comms

import React, { useState, useEffect } from 'react';
import type { UserRole } from '../../../shared/roles';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RatificationItem {
  id: string;
  nomineeName: string;
  submittedAt: string;
  status: 'pending' | 'ratified' | 'declined';
}

interface VetoRecord {
  id: string;
  context: string;
  decidedAt: string;
  vote: 'ratify' | 'veto';
}

interface CommMessage {
  id: string;
  from: string;
  preview: string;
  at: string;
  read: boolean;
}

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  bg: '#0a0f1a',
  surface: '#111827',
  border: '#1e2d45',
  text: '#e2e8f0',
  muted: '#64748b',
  accent: '#a78bfa',
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
};

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: '14px 16px',
      flex: 1,
      minWidth: 100,
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{value}</div>
      <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: C.accent, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

interface HelmCrownDashboardProps {
  userRole?: UserRole;
  displayName?: string;
}

export function HelmCrownDashboard({ userRole = 'helm-crown', displayName }: HelmCrownDashboardProps) {
  const [ratifications, setRatifications] = useState<RatificationItem[]>([]);
  const [vetoHistory, setVetoHistory] = useState<VetoRecord[]>([]);
  const [comms, setComms] = useState<CommMessage[]>([]);
  const [activeSection, setActiveSection] = useState<'roll' | 'ratify' | 'veto' | 'comms'>('roll');

  useEffect(() => {
    // IPC fetch — non-fatal on absence
    const load = async () => {
      try {
        const r = await (window as any).amplify?.helmGetRatifications?.();
        if (Array.isArray(r)) setRatifications(r);
      } catch { /* empty state */ }
      try {
        const v = await (window as any).amplify?.helmGetVetoHistory?.();
        if (Array.isArray(v)) setVetoHistory(v);
      } catch { /* empty state */ }
      try {
        const c = await (window as any).amplify?.helmGetComms?.();
        if (Array.isArray(c)) setComms(c);
      } catch { /* empty state */ }
    };
    void load();
  }, []);

  const pending = ratifications.filter((r) => r.status === 'pending');
  const unread = comms.filter((c) => !c.read).length;

  const SECTIONS = [
    { id: 'roll' as const,   label: `🎖️ Roll Seat` },
    { id: 'ratify' as const, label: `🗳️ Ratify${pending.length > 0 ? ` (${pending.length})` : ''}` },
    { id: 'veto' as const,   label: '📜 Veto History' },
    { id: 'comms' as const,  label: `📡 C2C${unread > 0 ? ` (${unread})` : ''}` },
  ];

  return (
    <div style={{
      background: C.bg,
      color: C.text,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px 12px',
        borderBottom: `1px solid ${C.border}`,
        background: '#0d1220',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 22 }}>👑</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Helm Crown Dashboard</div>
            <div style={{ fontSize: 10, color: C.muted }}>
              {displayName ?? 'Helm Crown'} · {userRole === 'founder' ? 'Founder access' : 'Role: Helm Crown'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <StatCard label="Pending nominations" value={pending.length} />
          <StatCard label="Veto decisions" value={vetoHistory.length} />
          <StatCard label="Unread comms" value={unread} />
        </div>
      </div>

      {/* Nav */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        {SECTIONS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id)}
            style={{
              flex: 1,
              padding: '8px 4px',
              border: 'none',
              borderBottom: activeSection === id ? `2px solid ${C.accent}` : '2px solid transparent',
              background: 'transparent',
              color: activeSection === id ? C.accent : C.muted,
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 600,
            }}
          >{label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

        {/* Roll Seat */}
        {activeSection === 'roll' && (
          <div>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, color: C.text }}>Your Roll Seat</h3>
            <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.7, marginBottom: 16 }}>
              As a Helm Crown, you hold a ratification seat on the Roll. Nominations require
              dual ratification (Founder + Helm Crown) to be confirmed. Either party may
              decline — EXCLUSION-WITHOUT-JUDGMENT is canon.
            </div>
            <div style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: '12px 16px',
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.accent, marginBottom: 6 }}>
                Dual-veto structure
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: C.muted, lineHeight: 1.8 }}>
                <li>Founder veto + Helm Crown veto → nomination reviewed</li>
                <li>Both ratify → candidate appears on public Roll</li>
                <li>Either declines → status: declined (reason private)</li>
                <li>No negative commentary on declined candidates — ever</li>
              </ul>
            </div>
          </div>
        )}

        {/* Ratification queue */}
        {activeSection === 'ratify' && (
          <div>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, color: C.text }}>Pending Nominations</h3>
            {pending.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '32px 16px',
                border: `1px dashed ${C.border}`, borderRadius: 10, color: C.muted, fontSize: 11,
              }}>
                No pending nominations at this time.
              </div>
            ) : (
              pending.map((item) => (
                <div key={item.id} style={{
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: '12px 14px', marginBottom: 8,
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{item.nomineeName}</div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                      Submitted {new Date(item.submittedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      await (window as any).amplify?.helmVote?.({ id: item.id, vote: 'ratify' });
                    }}
                    style={{ ...btnStyle, borderColor: C.green, color: C.green }}
                  >Ratify</button>
                  <button
                    onClick={async () => {
                      await (window as any).amplify?.helmVote?.({ id: item.id, vote: 'veto' });
                    }}
                    style={{ ...btnStyle, borderColor: C.muted, color: C.muted }}
                  >Decline</button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Veto history */}
        {activeSection === 'veto' && (
          <div>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, color: C.text }}>Veto History</h3>
            {vetoHistory.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '32px 16px',
                border: `1px dashed ${C.border}`, borderRadius: 10, color: C.muted, fontSize: 11,
              }}>
                No decisions on record yet.
              </div>
            ) : (
              vetoHistory.map((v) => (
                <div key={v.id} style={{
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: '10px 14px', marginBottom: 6,
                  display: 'flex', gap: 12, alignItems: 'center',
                }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 8,
                    background: v.vote === 'ratify' ? '#0a1f0e' : '#1c0808',
                    color: v.vote === 'ratify' ? C.green : C.red,
                    border: `1px solid ${v.vote === 'ratify' ? C.green : C.red}44`,
                  }}>
                    {v.vote === 'ratify' ? 'RATIFIED' : 'DECLINED'}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: C.text }}>{v.context}</div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                      {new Date(v.decidedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Crown-to-Crown comms */}
        {activeSection === 'comms' && (
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: 14, color: C.text }}>Crown-to-Crown Comms</h3>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>
              Placeholder — secure Crown-to-Crown messaging channel. Full implementation pending
              federation mesh relay (SAGA 4 + relay hardening).
            </div>
            {comms.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '32px 16px',
                border: `1px dashed ${C.border}`, borderRadius: 10, color: C.muted, fontSize: 11,
              }}>
                No messages yet. Comms channel will activate when relay is connected.
              </div>
            ) : (
              comms.map((m) => (
                <div key={m.id} style={{
                  background: m.read ? C.surface : '#111a2d',
                  border: `1px solid ${m.read ? C.border : C.accent + '44'}`,
                  borderRadius: 8, padding: '10px 14px', marginBottom: 6,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>{m.from}</span>
                    <span style={{ fontSize: 10, color: C.muted }}>{m.at}</span>
                  </div>
                  <div style={{ fontSize: 11, color: C.muted }}>{m.preview}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 10,
  fontWeight: 600,
  padding: '3px 10px',
};
