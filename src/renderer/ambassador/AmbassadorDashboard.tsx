// Mnemosyne — Ambassador Dashboard
// MV-HELM-CROWN-AMB SAGA 6 BP045 W1
//
// Role-gated: ambassador | founder
// Surfaces: nominating Crown · scope · peer-witness

import React, { useState, useEffect } from 'react';
import type { UserRole } from '../../shared/roles';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AmbassadorProfile {
  displayName: string;
  nominatingCrown?: string;
  scope?: string;
  ratifiedAt?: string;
  peerWitnesses: string[];
}

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  bg: '#0a0f1a',
  surface: '#111827',
  border: '#1e2d45',
  text: '#e2e8f0',
  muted: '#64748b',
  accent: '#f59e0b',
  green: '#22c55e',
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────

interface AmbassadorDashboardProps {
  userRole?: UserRole;
  displayName?: string;
}

export function AmbassadorDashboard({ userRole = 'ambassador', displayName }: AmbassadorDashboardProps) {
  const [profile, setProfile] = useState<AmbassadorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const p = await (window as any).amplify?.ambassadorGetProfile?.();
        if (p) setProfile(p);
      } catch { /* empty state */ } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <div style={{
      background: C.bg,
      color: C.text,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      height: '100%',
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px 14px',
        borderBottom: `1px solid ${C.border}`,
        background: '#0d1220',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🌿</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Ambassador Dashboard</div>
            <div style={{ fontSize: 10, color: C.muted }}>
              {displayName ?? 'Ambassador'} · {userRole === 'founder' ? 'Founder access' : 'Role: Ambassador'}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Profile card */}
        <section>
          <h3 style={{ margin: '0 0 10px', fontSize: 13, color: C.accent }}>Ambassador Profile</h3>
          {loading ? (
            <div style={{ color: C.muted, fontSize: 11 }}>Loading…</div>
          ) : profile ? (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
              <Row label="Name" value={profile.displayName} />
              <Row label="Nominating Crown" value={profile.nominatingCrown ?? '—'} />
              <Row label="Scope" value={profile.scope ?? '—'} />
              <Row label="Ratified" value={profile.ratifiedAt ? new Date(profile.ratifiedAt).toLocaleDateString() : '—'} />
            </div>
          ) : (
            <div style={{
              textAlign: 'center', padding: '24px 16px',
              border: `1px dashed ${C.border}`, borderRadius: 10, color: C.muted, fontSize: 11,
            }}>
              Ambassador profile not yet established.
              <br />
              Contact your nominating Crown to complete onboarding.
            </div>
          )}
        </section>

        {/* Peer witnesses */}
        <section>
          <h3 style={{ margin: '0 0 10px', fontSize: 13, color: C.accent }}>Peer Witnesses</h3>
          {profile && profile.peerWitnesses.length > 0 ? (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
              {profile.peerWitnesses.map((w, i) => (
                <div key={i} style={{
                  fontSize: 11, color: C.text, padding: '4px 0',
                  borderBottom: i < profile.peerWitnesses.length - 1 ? `1px solid ${C.border}` : 'none',
                }}>
                  {w}
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              textAlign: 'center', padding: '20px 16px',
              border: `1px dashed ${C.border}`, borderRadius: 10, color: C.muted, fontSize: 11,
            }}>
              No peer witnesses on record.
            </div>
          )}
        </section>

        {/* Ambassador charter */}
        <section>
          <h3 style={{ margin: '0 0 10px', fontSize: 13, color: C.accent }}>Ambassador Charter</h3>
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14,
            fontSize: 11, color: C.muted, lineHeight: 1.7,
          }}>
            <p style={{ margin: '0 0 8px' }}>
              Ambassadors represent the cooperative in their scope — not as an authority,
              but as a presence. An Ambassador's role is to make the cooperative legible and
              trustworthy in their domain.
            </p>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
              <li>Nominated by a Helm Crown; ratified by dual-veto</li>
              <li>Scope is bounded — no ambassador speaks for all Initiatives</li>
              <li>Peer witnesses confirm presence in the domain</li>
              <li>Term: active until scope changes or role is voluntarily released</li>
            </ul>
          </div>
        </section>

      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '6px 0',
      borderBottom: `1px solid ${C.border}`,
    }}>
      <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      <span style={{ fontSize: 12, color: C.text }}>{value}</span>
    </div>
  );
}
