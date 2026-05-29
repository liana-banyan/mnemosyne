// PearlGalleryTab — Tab 9 · Pearl Gallery
// Cooperative Memory Substrate — gallery of recently emitted/decoded Pearls.
// Pearls are compressed cooperative substrate transmissions (SSPS-encoded).
// Loaded via IPC: window.amplify.pearl.list()

import React, { useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PearlItem {
  pearl_id: string;
  timestamp: string;
  soul: string;           // celpane soul field — compressed essence
  decay_class: 'ephemeral' | 'session' | 'persistent' | 'eternal';
  decoded: boolean;
  source?: string;
}

type DecayClass = PearlItem['decay_class'];

const DECAY_COLORS: Record<DecayClass, { bg: string; border: string; text: string; label: string }> = {
  ephemeral:  { bg: 'rgba(239,68,68,0.08)',    border: 'rgba(239,68,68,0.25)',    text: '#f87171', label: 'Ephemeral'  },
  session:    { bg: 'rgba(245,158,11,0.08)',   border: 'rgba(245,158,11,0.25)',   text: '#fbbf24', label: 'Session'    },
  persistent: { bg: 'rgba(110,231,183,0.08)',  border: 'rgba(110,231,183,0.25)', text: '#6ee7b7', label: 'Persistent' },
  eternal:    { bg: 'rgba(167,139,250,0.08)',  border: 'rgba(167,139,250,0.25)', text: '#a78bfa', label: 'Eternal'    },
};

// ─── Component ───────────────────────────────────────────────────────────────

export function PearlGalleryTab() {
  const [pearls, setPearls] = useState<PearlItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPearl, setSelectedPearl] = useState<PearlItem | null>(null);
  const [decoding, setDecoding] = useState<string | null>(null);
  const [decodeResult, setDecodeResult] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    loadPearls();
  }, []);

  async function loadPearls() {
    setLoading(true);
    setError(null);
    try {
      const api = (window.amplify as any)?.pearl;
      if (!api?.list) {
        setPearls([]);
        setLoading(false);
        return;
      }
      const result: PearlItem[] = await api.list();
      setPearls(result ?? []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleDecode(pearl: PearlItem) {
    setSelectedPearl(pearl);
    setDecodeResult(null);
    setDecoding(pearl.pearl_id);
    try {
      const api = (window.amplify as any)?.pearl;
      if (!api?.decode) {
        setDecodeResult({ decoded: false, error: 'pearl_ipc_unavailable' });
        return;
      }
      const result = await api.decode(pearl.soul);
      setDecodeResult(result as Record<string, unknown>);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setDecodeResult({ decoded: false, error: msg });
    } finally {
      setDecoding(null);
    }
  }

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      boxSizing: 'border-box', overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        padding: '18px 20px 12px', flexShrink: 0,
        borderBottom: '1px solid rgba(100,116,139,0.12)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{
              fontSize: 15, fontWeight: 800, color: '#e2e8f0', letterSpacing: '-0.3px',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>💎</span> Pearl Gallery
            </div>
            <div style={{ fontSize: 10, color: '#475569', marginTop: 3 }}>
              Cooperative Memory Substrate
            </div>
          </div>
          <button
            onClick={loadPearls}
            disabled={loading}
            style={{
              background: 'rgba(110,231,183,0.08)', border: '1px solid rgba(110,231,183,0.2)',
              color: '#6ee7b7', borderRadius: 7, padding: '5px 12px',
              fontSize: 10, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Loading…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px 24px' }}>
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 8, padding: '10px 14px', marginBottom: 12,
            fontSize: 11, color: '#f87171',
          }}>
            Error loading pearls: {error}
          </div>
        )}

        {!loading && pearls.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '60px 20px', gap: 14, textAlign: 'center',
          }}>
            <div style={{ fontSize: 40, opacity: 0.4 }}>💎</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>
              No pearls yet
            </div>
            <div style={{
              fontSize: 11, color: '#334155', maxWidth: 320, lineHeight: 1.7,
            }}>
              Cooperative substrate transmissions will appear here as the network generates and decodes Pearls.
            </div>
            <div style={{
              fontSize: 9, color: '#1e293b',
              background: 'rgba(100,116,139,0.06)', border: '1px solid rgba(100,116,139,0.12)',
              borderRadius: 6, padding: '5px 10px',
            }}>
              Pearls are SSPS-encoded compressed cooperative memory fragments
            </div>
          </div>
        )}

        {pearls.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pearls.map((pearl) => (
              <PearlRow
                key={pearl.pearl_id}
                pearl={pearl}
                isSelected={selectedPearl?.pearl_id === pearl.pearl_id}
                isDecoding={decoding === pearl.pearl_id}
                decodeResult={selectedPearl?.pearl_id === pearl.pearl_id ? decodeResult : null}
                onDecode={() => handleDecode(pearl)}
                onDeselect={() => { setSelectedPearl(null); setDecodeResult(null); }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        borderTop: '1px solid rgba(100,116,139,0.1)',
        padding: '7px 20px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 9, color: '#1e293b' }}>
          {pearls.length} pearl{pearls.length !== 1 ? 's' : ''} · cooperative substrate memory
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(Object.keys(DECAY_COLORS) as DecayClass[]).map((cls) => {
            const c = DECAY_COLORS[cls];
            return (
              <div key={cls} style={{
                fontSize: 8, fontWeight: 600, color: c.text,
                background: c.bg, border: `1px solid ${c.border}`,
                borderRadius: 8, padding: '2px 6px',
              }}>
                {c.label}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Pearl row ────────────────────────────────────────────────────────────────

function PearlRow({
  pearl, isSelected, isDecoding, decodeResult, onDecode, onDeselect,
}: {
  pearl: PearlItem;
  isSelected: boolean;
  isDecoding: boolean;
  decodeResult: Record<string, unknown> | null;
  onDecode: () => void;
  onDeselect: () => void;
}) {
  const decay = DECAY_COLORS[pearl.decay_class] ?? DECAY_COLORS.session;
  const ts = new Date(pearl.timestamp);
  const tsStr = ts.toLocaleDateString() + ' ' + ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{
      background: isSelected ? 'rgba(110,231,183,0.06)' : 'rgba(15,23,42,0.55)',
      border: `1px solid ${isSelected ? 'rgba(110,231,183,0.25)' : 'rgba(100,116,139,0.12)'}`,
      borderRadius: 10, padding: '12px 14px',
      transition: 'all 0.15s',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* ID + timestamp */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 10, fontWeight: 700, color: '#94a3b8',
              fontFamily: 'monospace',
            }}>
              {pearl.pearl_id.length > 16 ? pearl.pearl_id.slice(0, 16) + '…' : pearl.pearl_id}
            </span>
            <span style={{ fontSize: 9, color: '#334155' }}>{tsStr}</span>
            <span style={{
              fontSize: 9, fontWeight: 700,
              color: decay.text, background: decay.bg, border: `1px solid ${decay.border}`,
              borderRadius: 8, padding: '1px 6px',
            }}>
              {DECAY_COLORS[pearl.decay_class]?.label ?? pearl.decay_class}
            </span>
            {pearl.decoded && (
              <span style={{
                fontSize: 9, fontWeight: 600,
                color: '#22c55e', background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.2)',
                borderRadius: 8, padding: '1px 6px',
              }}>
                decoded
              </span>
            )}
          </div>

          {/* Soul field */}
          <div style={{
            marginTop: 5, fontSize: 10, color: '#64748b',
            fontFamily: 'monospace', wordBreak: 'break-all', lineHeight: 1.5,
          }}>
            {pearl.soul.length > 120 ? pearl.soul.slice(0, 120) + '…' : pearl.soul}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            onClick={isSelected ? onDeselect : onDecode}
            disabled={isDecoding}
            style={{
              background: isSelected ? 'rgba(239,68,68,0.08)' : 'rgba(110,231,183,0.08)',
              border: `1px solid ${isSelected ? 'rgba(239,68,68,0.2)' : 'rgba(110,231,183,0.2)'}`,
              color: isSelected ? '#f87171' : '#6ee7b7',
              borderRadius: 6, padding: '4px 10px', fontSize: 10, fontWeight: 600,
              cursor: isDecoding ? 'not-allowed' : 'pointer', opacity: isDecoding ? 0.6 : 1,
            }}
          >
            {isDecoding ? '…' : isSelected ? 'Close' : 'Decode'}
          </button>
        </div>
      </div>

      {/* Decode result */}
      {isSelected && decodeResult && (
        <div style={{
          marginTop: 10, padding: '10px 12px',
          background: 'rgba(100,116,139,0.06)', border: '1px solid rgba(100,116,139,0.12)',
          borderRadius: 7,
        }}>
          <div style={{ fontSize: 9, color: '#475569', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Decode Result
          </div>
          <pre style={{
            margin: 0, fontSize: 9, color: '#94a3b8',
            fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            lineHeight: 1.6,
          }}>
            {JSON.stringify(decodeResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
