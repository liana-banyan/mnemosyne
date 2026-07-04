// CompaniesJoiningInTab.tsx — BP087 Wave 3 SEG-F2
// Displays live food-sector member businesses from entity_membership table
// Supabase client: src/renderer/lib/supabase.ts

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EntityMember {
  entity_name: string;
  node_type: string;
  city: string | null;
  joined_at: string;
}

function formatMonthYear(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  } catch {
    return isoDate;
  }
}

// ─── Entity Card ──────────────────────────────────────────────────────────────

function EntityCard({ entity }: { entity: EntityMember }) {
  return (
    <div style={{
      background: 'rgba(15,23,42,0.6)',
      border: '1px solid rgba(100,116,139,0.2)',
      borderRadius: 10, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 5,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
        {entity.entity_name}
      </div>
      {entity.city && (
        <div style={{ fontSize: 11, color: '#94a3b8' }}>
          {entity.city}
        </div>
      )}
      <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
        Member since {formatMonthYear(entity.joined_at)}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CompaniesJoiningInTab() {
  const [entities, setEntities] = useState<EntityMember[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchEntities() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: sbErr } = await supabase
          .from('entity_membership')
          .select('entity_name,node_type,city,joined_at')
          .eq('node_type', 'food')
          .eq('status', 'live')
          .order('joined_at', { ascending: false });

        if (cancelled) return;
        if (sbErr) {
          setError(sbErr.message);
          setEntities(null);
        } else {
          setEntities((data as EntityMember[]) ?? []);
        }
      } catch (e: unknown) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchEntities();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ padding: '16px 20px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 580, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Header */}
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>Member Businesses</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 3, lineHeight: 1.5 }}>
            Food-sector cooperative members
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div style={{
            textAlign: 'center', padding: '36px 0',
            fontSize: 12, color: '#475569',
          }}>
            Loading member businesses...
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div style={{
            background: 'rgba(127,29,29,0.15)',
            border: '1px solid rgba(248,113,113,0.3)',
            borderRadius: 8, padding: '14px 16px',
            fontSize: 11, color: '#fca5a5', lineHeight: 1.5,
          }}>
            <div style={{ fontWeight: 700, color: '#f87171', marginBottom: 4 }}>Failed to load</div>
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && entities !== null && entities.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '48px 0',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 32 }}>🌱</span>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>No member businesses yet.</div>
            <div style={{ fontSize: 11, color: '#475569' }}>Be the first.</div>
          </div>
        )}

        {/* Entity cards */}
        {!loading && !error && entities && entities.length > 0 && (
          <>
            <div style={{
              fontSize: 10, color: '#475569',
              fontWeight: 600, letterSpacing: '0.05em',
            }}>
              {entities.length} member{entities.length !== 1 ? 's' : ''}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {entities.map((entity, i) => (
                <EntityCard key={`${entity.entity_name}-${i}`} entity={entity} />
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
