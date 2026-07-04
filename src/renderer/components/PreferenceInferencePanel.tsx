// PreferenceInferencePanel.tsx — BP087 Wave 3 SEG-G2
// Member inferred preference viewer + editor
// Schema: member_preference_inferred (member_user_id, topic_tag, weight_decimal,
//         last_observation_at, observation_count)
// PK: (member_user_id, topic_tag) — no standalone id column
// RLS: member sees only own rows via auth.uid() = member_user_id
// Auth: derived from window.amplify.lbGetSession() + supabase.auth.getSession()

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface InferredPref {
  member_user_id: string;
  topic_tag: string;
  weight_decimal: number;
  last_observation_at: string;
  observation_count: number;
}

interface LbSession {
  linked: boolean;
  user_id?: string;
  email?: string;
}

// Weight bar width (0-100%)
function weightBar(w: number): string {
  return `${Math.round(Math.max(0, Math.min(1, w)) * 100)}%`;
}

function weightColor(w: number): string {
  if (w >= 0.7) return '#6ee7b7';
  if (w >= 0.35) return '#f59e0b';
  return '#94a3b8';
}

function relativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.floor(hr / 24)}d ago`;
  } catch {
    return iso;
  }
}

// ─── Preference Row ───────────────────────────────────────────────────────────

interface PrefRowProps {
  pref: InferredPref;
  onRemove: (pref: InferredPref) => Promise<void>;
  onWeightDown: (pref: InferredPref) => Promise<void>;
  busy: boolean;
}

function PrefRow({ pref, onRemove, onWeightDown, busy }: PrefRowProps) {
  const color = weightColor(pref.weight_decimal);

  return (
    <div style={{
      background: 'rgba(15,23,42,0.5)',
      border: '1px solid rgba(100,116,139,0.15)',
      borderRadius: 8, padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 2 }}>
            {pref.topic_tag}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
            <span style={{ fontSize: 9, color: '#475569' }}>
              Weight: <span style={{ color, fontWeight: 700 }}>{(pref.weight_decimal * 100).toFixed(1)}%</span>
            </span>
            <span style={{ fontSize: 9, color: '#475569' }}>
              Observations: <span style={{ color: '#94a3b8' }}>{pref.observation_count}</span>
            </span>
            <span style={{ fontSize: 9, color: '#475569' }}>
              Last seen: <span style={{ color: '#64748b' }}>{relativeTime(pref.last_observation_at)}</span>
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => void onWeightDown(pref)}
            disabled={busy}
            title="Halve weight"
            style={{
              padding: '4px 10px', borderRadius: 5, fontSize: 10, fontWeight: 600,
              cursor: busy ? 'not-allowed' : 'pointer',
              border: '1px solid rgba(245,158,11,0.35)',
              background: 'rgba(245,158,11,0.07)', color: '#f59e0b',
              opacity: busy ? 0.5 : 1,
            }}
          >
            Weight down
          </button>
          <button
            type="button"
            onClick={() => void onRemove(pref)}
            disabled={busy}
            title="Remove preference"
            style={{
              padding: '4px 10px', borderRadius: 5, fontSize: 10, fontWeight: 600,
              cursor: busy ? 'not-allowed' : 'pointer',
              border: '1px solid rgba(248,113,113,0.35)',
              background: 'rgba(248,113,113,0.07)', color: '#f87171',
              opacity: busy ? 0.5 : 1,
            }}
          >
            Remove
          </button>
        </div>
      </div>

      {/* Weight bar */}
      <div style={{ height: 4, background: 'rgba(100,116,139,0.15)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: weightBar(pref.weight_decimal),
          background: color, borderRadius: 2,
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PreferenceInferencePanel() {
  const [preferences, setPreferences] = useState<InferredPref[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<LbSession | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Get linked LB session (provides member_user_id)
  useEffect(() => {
    async function loadSession() {
      try {
        const lbSess = await window.amplify.lbGetSession?.();
        if (lbSess) setSession(lbSess as LbSession);
      } catch {
        // Not linked — session stays null
      }
    }
    void loadSession();
  }, []);

  const fetchPreferences = useCallback(async (userId: string) => {
    setLoading(true);
    setFetchError(null);
    try {
      const { data, error } = await supabase
        .from('member_preference_inferred')
        .select('member_user_id,topic_tag,weight_decimal,last_observation_at,observation_count')
        .eq('member_user_id', userId)
        .order('weight_decimal', { ascending: false });

      if (error) {
        setFetchError(error.message);
        setPreferences(null);
      } else {
        setPreferences((data as InferredPref[]) ?? []);
      }
    } catch (e: unknown) {
      setFetchError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch when session is available
  useEffect(() => {
    if (session?.linked && session.user_id) {
      void fetchPreferences(session.user_id);
    } else if (session !== null) {
      // Session loaded but not linked
      setLoading(false);
    }
  }, [session, fetchPreferences]);

  const handleRemove = useCallback(async (pref: InferredPref) => {
    const key = pref.topic_tag;
    setBusyKey(key);
    try {
      const { error } = await supabase
        .from('member_preference_inferred')
        .delete()
        .eq('member_user_id', pref.member_user_id)
        .eq('topic_tag', pref.topic_tag);

      if (!error && session?.user_id) {
        await fetchPreferences(session.user_id);
      }
    } finally {
      setBusyKey(null);
    }
  }, [session, fetchPreferences]);

  const handleWeightDown = useCallback(async (pref: InferredPref) => {
    const key = pref.topic_tag;
    setBusyKey(key);
    try {
      const newWeight = Math.max(0, pref.weight_decimal * 0.5);
      const { error } = await supabase
        .from('member_preference_inferred')
        .update({ weight_decimal: newWeight })
        .eq('member_user_id', pref.member_user_id)
        .eq('topic_tag', pref.topic_tag);

      if (!error && session?.user_id) {
        await fetchPreferences(session.user_id);
      }
    } finally {
      setBusyKey(null);
    }
  }, [session, fetchPreferences]);

  const isNotLinked = session !== null && !session.linked;

  return (
    <div style={{ padding: '16px 20px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Header */}
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>Your Inferred Preferences</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, lineHeight: 1.65 }}>
            The substrate learned these from your natural interactions. You own them.
            You can remove or adjust any of them.
          </div>
        </div>

        {/* Not linked state */}
        {isNotLinked && (
          <div style={{
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 8, padding: '14px 16px',
            fontSize: 11, color: '#fbbf24', lineHeight: 1.5,
          }}>
            Link your LB Account to view inferred preferences.
          </div>
        )}

        {/* Loading state */}
        {loading && session?.linked && (
          <div style={{ textAlign: 'center', padding: '36px 0', fontSize: 12, color: '#475569' }}>
            Loading preferences...
          </div>
        )}

        {/* Fetch error */}
        {!loading && fetchError && (
          <div style={{
            background: 'rgba(127,29,29,0.15)',
            border: '1px solid rgba(248,113,113,0.3)',
            borderRadius: 8, padding: '12px 16px',
            fontSize: 11, color: '#fca5a5',
          }}>
            <div style={{ fontWeight: 700, color: '#f87171', marginBottom: 4 }}>Error loading preferences</div>
            {fetchError}
          </div>
        )}

        {/* Empty state */}
        {!loading && !fetchError && preferences !== null && preferences.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '48px 0',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 32 }}>🌱</span>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
              No inferred preferences yet.
            </div>
            <div style={{ fontSize: 11, color: '#475569', maxWidth: 280, lineHeight: 1.6 }}>
              The substrate learns as you use it.
            </div>
          </div>
        )}

        {/* Preferences list */}
        {!loading && !fetchError && preferences && preferences.length > 0 && (
          <>
            <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: '0.05em' }}>
              {preferences.length} inferred preference{preferences.length !== 1 ? 's' : ''}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {preferences.map(pref => (
                <PrefRow
                  key={pref.topic_tag}
                  pref={pref}
                  onRemove={handleRemove}
                  onWeightDown={handleWeightDown}
                  busy={busyKey === pref.topic_tag}
                />
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
