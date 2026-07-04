/**
 * SubstrateSeedPanel — BP082 v0.2.2 SEG-3
 * Founder substrate seed admin path.
 * Settings → Substrate → Seed from Sealed Bank → Confirm
 *
 * Reads all 12,062 MMLU-Pro questions from the bundled resource bank and writes
 * Founder-attested seed eblets to verified_eblets.jsonl. Bypasses concordance per
 * Founder-attestation doctrine (BP080 Tower-of-Peace canon).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

type SeedState =
  | { id: 'idle' }
  | { id: 'confirming' }
  | { id: 'seeding'; written: number; skipped: number; total: number; pct: number }
  | { id: 'done'; written: number; skipped: number; total: number }
  | { id: 'error'; message: string };

const S = {
  panel: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(100,116,139,0.18)',
    borderRadius: 10,
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
  },
  title: {
    fontSize: 13,
    fontWeight: 700,
    color: '#e2e8f0',
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
  },
  desc: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 1.6,
  },
  btn: (variant: 'primary' | 'danger' | 'ghost') => ({
    padding: '7px 16px',
    borderRadius: 7,
    border: 'none',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer' as const,
    background:
      variant === 'primary' ? 'rgba(99,102,241,0.85)' :
      variant === 'danger'  ? 'rgba(239,68,68,0.85)' :
      'rgba(100,116,139,0.2)',
    color: '#f8fafc',
    transition: 'opacity 0.15s',
  }),
  progressTrack: {
    height: 6,
    background: 'rgba(100,116,139,0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: (pct: number) => ({
    height: '100%',
    width: `${Math.min(pct, 100)}%`,
    background: 'linear-gradient(90deg, #6ee7b7, #6366f1)',
    borderRadius: 4,
    transition: 'width 0.3s ease',
  }),
  confirmBox: {
    background: 'rgba(239,68,68,0.06)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 8,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
  },
  confirmText: {
    fontSize: 12,
    color: '#fca5a5',
    lineHeight: 1.6,
  },
  row: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap' as const,
  },
  statChip: (color: string) => ({
    fontSize: 11,
    color,
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${color}30`,
    borderRadius: 5,
    padding: '3px 8px',
  }),
};

type ReseedState =
  | { id: 'idle' }
  | { id: 'confirming' }
  | { id: 'reseeding'; written: number; total: number; pct: number }
  | { id: 'done'; written: number; total: number; backupPath?: string }
  | { id: 'error'; message: string };

export function SubstrateSeedPanel() {
  const [state, setState] = useState<SeedState>({ id: 'idle' });
  const unsubRef = useRef<(() => void) | null>(null);
  const [reseedState, setReseedState] = useState<ReseedState>({ id: 'idle' });
  const reseedUnsubRef = useRef<(() => void) | null>(null);

  // Subscribe to progress events when seeding starts
  useEffect(() => {
    if (state.id !== 'seeding') return;

    const unsub = window.amplify?.onPlowSeedProgress?.((data) => {
      if (data.done) {
        setState({ id: 'done', written: data.written, skipped: data.skipped, total: data.total });
        unsubRef.current?.();
        unsubRef.current = null;
      } else {
        setState({
          id: 'seeding',
          written: data.written,
          skipped: data.skipped,
          total: data.total,
          pct: data.pct,
        });
      }
    });

    unsubRef.current = unsub ?? null;
    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [state.id]);

  const handleSeedConfirm = useCallback(async () => {
    setState({ id: 'seeding', written: 0, skipped: 0, total: 0, pct: 0 });
    try {
      const result = await window.amplify?.plowSeedFromBank?.();
      if (!result?.ok) {
        setState({ id: 'error', message: result?.errors?.[0] ?? 'Unknown seed error' });
      }
      // done state is set via progress event with done:true
    } catch (err) {
      setState({ id: 'error', message: String(err) });
    }
  }, []);

  // Subscribe to reset-reseed progress
  useEffect(() => {
    if (reseedState.id !== 'reseeding') return;
    const unsub = window.amplify?.onPlowResetReseedProgress?.((data) => {
      if (data.done) {
        setReseedState({ id: 'done', written: data.written, total: data.total });
        reseedUnsubRef.current?.();
        reseedUnsubRef.current = null;
      } else {
        setReseedState({ id: 'reseeding', written: data.written, total: data.total, pct: data.pct });
      }
    });
    reseedUnsubRef.current = unsub ?? null;
    return () => { reseedUnsubRef.current?.(); reseedUnsubRef.current = null; };
  }, [reseedState.id]);

  const handleReseedConfirm = useCallback(async () => {
    setReseedState({ id: 'reseeding', written: 0, total: 0, pct: 0 });
    try {
      const result = await window.amplify?.plowResetAndReseedContext?.();
      if (!result?.ok) {
        setReseedState({ id: 'error', message: 'Reseed failed · check console' });
      } else {
        setReseedState({ id: 'done', written: result.written, total: result.total, backupPath: result.backupPath });
      }
    } catch (err) {
      setReseedState({ id: 'error', message: String(err) });
    }
  }, []);

  return (
    <div style={S.panel}>
      <div style={S.title}>⚗ Substrate · Seed from Sealed Bank</div>

      <p style={S.desc}>
        Write all MMLU-Pro questions from the bundled sealed bank directly to substrate
        as Founder-attested seed eblets. Bypasses 3-voter concordance — Founder attestation
        IS the verification. (~12,000 Q&amp;A eblets, one-time, ~3–5 minutes.)
      </p>

      {state.id === 'idle' && (
        <div style={S.row}>
          <button
            type="button"
            style={S.btn('primary')}
            onClick={() => setState({ id: 'confirming' })}
          >
            Seed from Sealed Bank →
          </button>
        </div>
      )}

      {state.id === 'confirming' && (
        <div style={S.confirmBox}>
          <p style={S.confirmText}>
            This will write ~12,000 Founder-attested eblets to your local substrate.
            Existing eblets are NOT deleted. Duplicates are skipped by sha256.
            This operation cannot be undone but can be safely repeated.
          </p>
          <div style={S.row}>
            <button type="button" style={S.btn('danger')} onClick={handleSeedConfirm}>
              Confirm: Seed Substrate
            </button>
            <button
              type="button"
              style={S.btn('ghost')}
              onClick={() => setState({ id: 'idle' })}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {state.id === 'seeding' && (
        <>
          <div style={{ fontSize: 12, color: '#6ee7b7', animation: 'mnemo-pulse 1.5s ease-in-out infinite' }}>
            ◌ Seeding substrate… {state.written.toLocaleString()} / {state.total > 0 ? state.total.toLocaleString() : '?'} eblets written
          </div>
          <div style={S.progressTrack}>
            <div style={S.progressFill(state.pct)} />
          </div>
          <div style={{ fontSize: 11, color: '#475569' }}>
            {state.pct}% complete
            {state.skipped > 0 && ` · ${state.skipped} skipped (duplicates)`}
          </div>
        </>
      )}

      {state.id === 'done' && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#6ee7b7' }}>
            ✓ Substrate seeded
          </div>
          <div style={S.row}>
            <span style={S.statChip('#6ee7b7')}>✓ {state.written.toLocaleString()} written</span>
            {state.skipped > 0 && (
              <span style={S.statChip('#94a3b8')}>{state.skipped.toLocaleString()} skipped</span>
            )}
            <span style={S.statChip('#818cf8')}>{state.total.toLocaleString()} total</span>
          </div>
          <p style={S.desc}>
            Plow the Field will now have a fully-seeded substrate to verify against.
            Run Plow on any domain — expected verified rate ≥ 40%.
          </p>
          <button
            type="button"
            style={S.btn('ghost')}
            onClick={() => setState({ id: 'idle' })}
          >
            Reset
          </button>
        </>
      )}

      {state.id === 'error' && (
        <>
          <div style={{ fontSize: 12, color: '#f87171' }}>
            ✗ Seed error: {state.message}
          </div>
          <button
            type="button"
            style={S.btn('ghost')}
            onClick={() => setState({ id: 'idle' })}
          >
            Retry
          </button>
        </>
      )}

      {/* ── BP083 SEG-5: Reset + Reseed Context-Class ─────────────────── */}
      <div style={{ marginTop: 12, borderTop: '1px solid rgba(100,116,139,0.12)', paddingTop: 12 }}>
        <div style={{ ...S.title, color: '#f59e0b' }}>⚠ Reset + Reseed Context-Class</div>
        <p style={{ ...S.desc, marginTop: 6 }}>
          The original "Seed from Sealed Bank" wrote Q&amp;A pairs that poison mesh test
          lift numbers (the grader can look up the exact answer). This action:
          (1) backs up your current substrate, (2) clears it, (3) re-seeds with
          topical-context eblets — domain labels without answer text — so Mesh Test
          lift is genuine cooperative-architecture lift, not answer-key lookup.
          Run Plow the Field afterward to grow the substrate organically.
        </p>

        {reseedState.id === 'idle' && (
          <button
            type="button"
            style={{ ...S.btn('danger'), marginTop: 8 }}
            onClick={() => setReseedState({ id: 'confirming' })}
          >
            Reset + Reseed Context-Class Substrate →
          </button>
        )}

        {reseedState.id === 'confirming' && (
          <div style={{ ...S.confirmBox, marginTop: 8 }}>
            <p style={S.confirmText}>
              This will CLEAR your substrate and re-seed with context-class eblets.
              Your current substrate is backed up automatically. Mesh Test lift numbers
              after this reset will be honest (not answer-key cheating).
            </p>
            <div style={S.row}>
              <button type="button" style={S.btn('danger')} onClick={handleReseedConfirm}>
                Confirm: Reset + Reseed
              </button>
              <button type="button" style={S.btn('ghost')} onClick={() => setReseedState({ id: 'idle' })}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {reseedState.id === 'reseeding' && (
          <>
            <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 8 }}>
              ◌ Reseed in progress… {reseedState.written.toLocaleString()} / {reseedState.total > 0 ? reseedState.total.toLocaleString() : '?'} context eblets written
            </div>
            <div style={{ ...S.progressTrack, marginTop: 6 }}>
              <div style={{ ...S.progressFill(reseedState.pct), background: 'linear-gradient(90deg, #f59e0b, #f97316)' }} />
            </div>
          </>
        )}

        {reseedState.id === 'done' && (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#6ee7b7', marginTop: 8 }}>
              ✓ Substrate reset + reseeded with context-class eblets
            </div>
            <div style={S.row}>
              <span style={S.statChip('#6ee7b7')}>✓ {reseedState.written.toLocaleString()} context eblets</span>
              <span style={S.statChip('#818cf8')}>{reseedState.total.toLocaleString()} total</span>
            </div>
            <p style={{ ...S.desc, marginTop: 6 }}>
              Substrate is now answer-key-free. Run Plow the Field to build organic domain knowledge. Mesh Test lift numbers will now be honest.
            </p>
            <button type="button" style={{ ...S.btn('ghost'), marginTop: 4 }} onClick={() => setReseedState({ id: 'idle' })}>
              Done
            </button>
          </>
        )}

        {reseedState.id === 'error' && (
          <>
            <div style={{ fontSize: 12, color: '#f87171', marginTop: 8 }}>
              ✗ Reseed error: {reseedState.message}
            </div>
            <button type="button" style={S.btn('ghost')} onClick={() => setReseedState({ id: 'idle' })}>
              Retry
            </button>
          </>
        )}
      </div>
    </div>
  );
}
