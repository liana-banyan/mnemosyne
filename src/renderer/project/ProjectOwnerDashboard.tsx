// Mnemosyne — Project Owner Dashboard
// MV-HELM-CROWN-AMB SAGA 6 BP045 W1
//
// Role-gated: project-owner | founder
// Surfaces: own initiative (Sweet 16) · contributor roster

import React, { useState, useEffect } from 'react';
import type { UserRole } from '../../shared/roles';
import { SWEET_SIXTEEN, getInitiativeBySlug } from '../../shared/roles';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Contributor {
  id: string;
  displayName: string;
  role: string;
  joinedAt: string;
  active: boolean;
}

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  bg: '#0a0f1a',
  surface: '#111827',
  border: '#1e2d45',
  text: '#e2e8f0',
  muted: '#64748b',
  accent: '#22c55e',
  amber: '#f59e0b',
  purple: '#a78bfa',
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────

interface ProjectOwnerDashboardProps {
  slug: string;
  userRole?: UserRole;
  displayName?: string;
}

export function ProjectOwnerDashboard({ slug, userRole = 'project-owner', displayName }: ProjectOwnerDashboardProps) {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [loading, setLoading] = useState(true);

  const initiative = getInitiativeBySlug(slug);

  useEffect(() => {
    const load = async () => {
      try {
        const c = await (window as any).amplify?.projectGetContributors?.({ slug });
        if (Array.isArray(c)) setContributors(c);
      } catch { /* empty state */ } finally {
        setLoading(false);
      }
    };
    void load();
  }, [slug]);

  if (!initiative) {
    return (
      <div style={{
        background: C.bg, color: C.text,
        fontFamily: 'system-ui, sans-serif',
        padding: 24, textAlign: 'center',
      }}>
        <div style={{ fontSize: 11, color: C.muted }}>Initiative not found: <code>{slug}</code></div>
        <div style={{ marginTop: 16, fontSize: 11, color: C.muted }}>
          Valid slugs: {SWEET_SIXTEEN.map((i) => i.slug).join(', ')}
        </div>
      </div>
    );
  }

  const active = contributors.filter((c) => c.active);
  const inactive = contributors.filter((c) => !c.active);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 22 }}>🌱</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
              #{initiative.number} — {initiative.name}
            </div>
            <div style={{ fontSize: 10, color: C.muted }}>
              Project Owner: {displayName ?? 'Owner'} · {userRole === 'founder' ? 'Founder access' : 'Role: Project Owner'}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {[
            { label: 'Active', value: active.length },
            { label: 'Total', value: contributors.length },
            initiative.crown ? { label: 'Crown', value: initiative.crown, wide: true } : null,
          ].filter(Boolean).map((s) => (
            <div key={s!.label} style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
              padding: '8px 12px', flex: s!.wide ? 2 : 1,
            }}>
              <div style={{ fontSize: s!.wide ? 11 : 18, fontWeight: 700, color: C.text }}>{s!.value}</div>
              <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{s!.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Active contributors */}
        <section>
          <h3 style={{ margin: '0 0 10px', fontSize: 13, color: C.accent }}>
            Active Contributors ({active.length})
          </h3>
          {loading ? (
            <div style={{ color: C.muted, fontSize: 11 }}>Loading…</div>
          ) : active.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '24px 16px',
              border: `1px dashed ${C.border}`, borderRadius: 10, color: C.muted, fontSize: 11,
            }}>
              No contributors yet. Invite members to join this initiative.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {active.map((c) => (
                <ContributorRow key={c.id} contributor={c} />
              ))}
            </div>
          )}
        </section>

        {/* Inactive / past contributors */}
        {inactive.length > 0 && (
          <section>
            <h3 style={{ margin: '0 0 10px', fontSize: 13, color: C.muted }}>
              Past Contributors ({inactive.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {inactive.map((c) => (
                <ContributorRow key={c.id} contributor={c} dim />
              ))}
            </div>
          </section>
        )}

        {/* Initiative info */}
        <section>
          <h3 style={{ margin: '0 0 10px', fontSize: 13, color: C.purple }}>Initiative Context</h3>
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
            padding: 14, fontSize: 11, color: C.muted, lineHeight: 1.7,
          }}>
            <div style={{ marginBottom: 6 }}>
              <strong style={{ color: C.text }}>Discipline reminder:</strong> Initiative #11 = "Let's Make Bread" ·
              #15 = "Power to the People" · Bonfire (#17) is a SPINOUT, not an Initiative.
            </div>
            <div>
              Creator-keep on this platform: <strong style={{ color: C.text }}>83.3%</strong> of every
              transaction (NEVER 83%, NEVER 84%). Platform margin: Cost + 20%. Membership: $5/year.
              Workers <em>may earn</em> — always use variance-bands, never point-estimates.
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

function ContributorRow({ contributor, dim }: { contributor: Contributor; dim?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 12px',
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      opacity: dim ? 0.6 : 1,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{contributor.displayName}</div>
        <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
          {contributor.role} · joined {new Date(contributor.joinedAt).toLocaleDateString()}
        </div>
      </div>
      <span style={{
        fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 8,
        background: contributor.active ? '#0a1f0e' : C.border,
        color: contributor.active ? C.accent : C.muted,
        border: `1px solid ${contributor.active ? C.accent + '44' : C.border}`,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}>
        {contributor.active ? 'Active' : 'Past'}
      </span>
    </div>
  );
}
