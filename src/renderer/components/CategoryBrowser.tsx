/**
 * CategoryBrowser -- Browse and search Eblets in a single Catacombs category
 * BP087 Wave 5
 *
 * Search debounces 300ms -- calls catacombs:search IPC.
 * Inline CatacombsContributePanel on "Contribute" click.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { EbletEntry } from '../../main/catacombs/folder_bootstrap';
import { CatacombsContributePanel } from './CatacombsContributePanel';

// ---- Types ------------------------------------------------------------------

interface Props {
  categorySlug: string;
  displayName: string;
  onClose?: () => void;
}

// ---- Styles -----------------------------------------------------------------

const S = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    background: '#0a0f1a',
    color: '#e2e8f0',
    padding: 20,
    gap: 14,
    overflowY: 'auto' as const,
  } as React.CSSProperties,
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
  } as React.CSSProperties,
  backBtn: {
    background: 'none',
    border: '1px solid rgba(100,116,139,0.3)',
    borderRadius: 6,
    color: '#64748b',
    fontSize: 11,
    padding: '4px 10px',
    cursor: 'pointer',
  } as React.CSSProperties,
  categoryTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#6ee7b7',
  },
  searchBar: {
    background: '#111827',
    border: '1px solid rgba(100,116,139,0.3)',
    borderRadius: 8,
    color: '#e2e8f0',
    fontSize: 12,
    padding: '8px 12px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  contributeBtn: {
    background: 'rgba(110,231,183,0.1)',
    border: '1px solid rgba(110,231,183,0.3)',
    borderRadius: 6,
    color: '#6ee7b7',
    fontSize: 11,
    fontWeight: 700,
    padding: '6px 14px',
    cursor: 'pointer',
    alignSelf: 'flex-start' as const,
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  ebletList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  } as React.CSSProperties,
  ebletRow: {
    background: '#111827',
    border: '1px solid rgba(100,116,139,0.15)',
    borderRadius: 8,
    padding: '10px 14px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
  } as React.CSSProperties,
  ebletTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: '#e2e8f0',
  },
  ebletMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 10,
    color: '#64748b',
  } as React.CSSProperties,
  scoreChip: (score: number | undefined): React.CSSProperties => {
    const s = score ?? 0;
    const bg = s >= 0.8 ? 'rgba(34,197,94,0.2)' : s >= 0.5 ? 'rgba(250,204,21,0.2)' : 'rgba(239,68,68,0.2)';
    const col = s >= 0.8 ? '#4ade80' : s >= 0.5 ? '#fbbf24' : '#f87171';
    return { background: bg, color: col, borderRadius: 10, padding: '1px 8px', fontWeight: 700 };
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    textAlign: 'center' as const,
    gap: 12,
    color: '#475569',
  } as React.CSSProperties,
  loading: {
    color: '#475569',
    fontSize: 12,
    padding: '24px 0',
    textAlign: 'center' as const,
  } as React.CSSProperties,
};

// ---- Helpers ----------------------------------------------------------------

function invokeIPC(channel: string, ...args: unknown[]): Promise<unknown> {
  const w = window as any;
  if (w.electronAPI?.[channel]) return w.electronAPI[channel](...args);
  if (w.ipcRenderer?.invoke) return w.ipcRenderer.invoke(channel, ...args);
  return Promise.reject(new Error('IPC unavailable'));
}

// ---- Component --------------------------------------------------------------

export function CategoryBrowser({ categorySlug, displayName, onClose }: Props) {
  const [eblets, setEblets] = useState<EbletEntry[]>([]);
  const [filtered, setFiltered] = useState<EbletEntry[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showContribute, setShowContribute] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load eblets on mount
  useEffect(() => {
    setLoading(true);
    invokeIPC('catacombs:list-eblets', categorySlug)
      .then((rows) => {
        const list = (rows as EbletEntry[] | null) ?? [];
        setEblets(list);
        setFiltered(list);
      })
      .catch(() => {
        setEblets([]);
        setFiltered([]);
      })
      .finally(() => setLoading(false));
  }, [categorySlug]);

  // Debounced search
  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!q.trim()) {
        setFiltered(eblets);
        return;
      }
      try {
        const rows = await invokeIPC('catacombs:search', { slug: categorySlug, query: q });
        setFiltered((rows as EbletEntry[] | null) ?? []);
      } catch {
        // Client-side fallback filter
        const ql = q.toLowerCase();
        setFiltered(eblets.filter((e) => (e.title ?? e.uuid).toLowerCase().includes(ql)));
      }
    }, 300);
  }, [eblets, categorySlug]);

  function handleContributeSuccess() {
    setShowContribute(false);
    // Reload eblets
    invokeIPC('catacombs:list-eblets', categorySlug)
      .then((rows) => {
        const list = (rows as EbletEntry[] | null) ?? [];
        setEblets(list);
        setFiltered(list);
      })
      .catch(() => {});
  }

  return (
    <div style={S.container}>
      {/* Header */}
      <div style={S.header}>
        {onClose && (
          <button style={S.backBtn} onClick={onClose}>
            back
          </button>
        )}
        <span style={S.categoryTitle}>{displayName}</span>
      </div>

      {/* Search bar */}
      <input
        style={S.searchBar}
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder={`Search ${displayName}...`}
        aria-label={`Search ${displayName}`}
      />

      {/* Contribute button */}
      <button
        style={S.contributeBtn}
        onClick={() => setShowContribute((v) => !v)}
      >
        {showContribute ? 'Hide Contribute Form' : '+ Contribute Eblet'}
      </button>

      {/* Inline contribute panel */}
      {showContribute && (
        <CatacombsContributePanel
          defaultSlug={categorySlug}
          onSuccess={handleContributeSuccess}
          onClose={() => setShowContribute(false)}
        />
      )}

      {/* Eblet list */}
      {loading && <div style={S.loading}>Loading eblets...</div>}

      {!loading && filtered.length === 0 && (
        <div style={S.emptyState}>
          <div style={{ fontSize: 28 }}>📚</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
            No Eblets in this category yet.
          </div>
          <div style={{ fontSize: 11 }}>
            Be the first to contribute!
          </div>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={S.ebletList}>
          {filtered.map((e) => (
            <div key={e.uuid} style={S.ebletRow}>
              <div style={S.ebletTitle}>{e.title ?? e.uuid}</div>
              <div style={S.ebletMeta}>
                <span>{new Date(e.published_at).toLocaleDateString()}</span>
                {e.corroboration_score !== undefined && (
                  <span style={S.scoreChip(e.corroboration_score)}>
                    {(e.corroboration_score * 100).toFixed(0)}%
                  </span>
                )}
                {e.soccerball_hash && (
                  <span style={{ fontFamily: 'monospace', color: '#334155' }}>
                    {e.soccerball_hash.slice(0, 8)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
