/**
 * CatacombsTab -- Top-level Catacombs tab in MnemosyneTabView
 * BP087 Wave 5 -- 16-folder substrate default + Alexandrian Library
 *
 * 16 folder cards in responsive grid.
 * Per-folder manifest loaded via IPC catacombs:get-manifest.
 * License gate banner for for-profit-unlicensed members.
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { FolderManifest } from '../../main/catacombs/folder_bootstrap';
import type { FetchResult } from '../../main/catacombs/eblet_package_fetcher';
import type { AccessResult } from '../../main/catacombs/license_gate';
import { CategoryBrowser } from './CategoryBrowser';

// ---- Constants --------------------------------------------------------------

const ALL_SLUGS = [
  '01_biology',
  '02_business',
  '03_chemistry',
  '04_computer_science',
  '05_economics',
  '06_engineering',
  '07_health',
  '08_history',
  '09_law',
  '10_math',
  '11_other',
  '12_philosophy',
  '13_physics',
  '14_psychology',
  '15_USER',
  '16_LIANA_BANYAN',
] as const;

const DISPLAY_NAMES: Record<string, string> = {
  '01_biology': 'Biology',
  '02_business': 'Business',
  '03_chemistry': 'Chemistry',
  '04_computer_science': 'Computer Science',
  '05_economics': 'Economics',
  '06_engineering': 'Engineering',
  '07_health': 'Health',
  '08_history': 'History',
  '09_law': 'Law',
  '10_math': 'Math',
  '11_other': 'Other',
  '12_philosophy': 'Philosophy',
  '13_physics': 'Physics',
  '14_psychology': 'Psychology',
  '15_USER': 'My Contributions',
  '16_LIANA_BANYAN': 'Liana Banyan',
};

const SLUG_ICONS: Record<string, string> = {
  '01_biology': 'biology',
  '02_business': 'business',
  '03_chemistry': 'chemistry',
  '04_computer_science': 'cs',
  '05_economics': 'econ',
  '06_engineering': 'eng',
  '07_health': 'health',
  '08_history': 'history',
  '09_law': 'law',
  '10_math': 'math',
  '11_other': 'other',
  '12_philosophy': 'phil',
  '13_physics': 'physics',
  '14_psychology': 'psych',
  '15_USER': 'user',
  '16_LIANA_BANYAN': 'lb',
};

// ---- Types ------------------------------------------------------------------

type ManifestMap = Map<string, FolderManifest>;
type FetchStatusMap = Map<string, 'idle' | 'fetching' | 'done' | 'error'>;

// ---- Helpers ----------------------------------------------------------------

function invokeIPC(channel: string, ...args: unknown[]): Promise<unknown> {
  const w = window as any;
  if (w.electronAPI?.[channel]) return w.electronAPI[channel](...args);
  if (w.ipcRenderer?.invoke) return w.ipcRenderer.invoke(channel, ...args);
  return Promise.reject(new Error('IPC unavailable'));
}

function defaultManifest(slug: string): FolderManifest {
  return { slug, version: 1, soccerball_hash: null, eblet_count: 0, last_updated: null };
}

function formatDate(iso: string | null): string {
  if (!iso) return 'never';
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

// ---- Styles -----------------------------------------------------------------

const S = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    background: '#0a0f1a',
    color: '#e2e8f0',
    overflowY: 'auto' as const,
  } as React.CSSProperties,
  inner: {
    padding: '20px 20px 40px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
    minHeight: '100%',
  } as React.CSSProperties,
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap' as const,
    gap: 10,
  } as React.CSSProperties,
  title: {
    fontSize: 16,
    fontWeight: 700,
    color: '#6ee7b7',
  },
  prefetchBtn: (running: boolean): React.CSSProperties => ({
    background: running ? 'rgba(250,204,21,0.1)' : 'rgba(110,231,183,0.1)',
    border: running ? '1px solid rgba(250,204,21,0.3)' : '1px solid rgba(110,231,183,0.3)',
    borderRadius: 6,
    color: running ? '#fbbf24' : '#6ee7b7',
    fontSize: 11,
    fontWeight: 700,
    padding: '6px 14px',
    cursor: running ? 'not-allowed' : 'pointer',
    whiteSpace: 'nowrap' as const,
  }),
  offerBanner: {
    background: 'rgba(250,204,21,0.08)',
    border: '1px solid rgba(250,204,21,0.3)',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 11,
    color: '#fbbf24',
    lineHeight: 1.5,
  } as React.CSSProperties,
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 12,
  } as React.CSSProperties,
  card: (active: boolean): React.CSSProperties => ({
    background: active ? 'rgba(110,231,183,0.06)' : '#111827',
    border: active ? '1px solid rgba(110,231,183,0.35)' : '1px solid rgba(100,116,139,0.2)',
    borderRadius: 10,
    padding: '14px 12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  }),
  cardSlug: {
    fontSize: 10,
    color: '#475569',
    fontFamily: 'monospace',
    letterSpacing: '0.03em',
  },
  cardName: {
    fontSize: 13,
    fontWeight: 600,
    color: '#e2e8f0',
  },
  cardMeta: {
    fontSize: 10,
    color: '#64748b',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
    marginTop: 2,
  } as React.CSSProperties,
  cardActions: {
    display: 'flex',
    gap: 6,
    marginTop: 4,
  } as React.CSSProperties,
  fetchBtn: (status: string): React.CSSProperties => ({
    background: status === 'fetching' ? 'rgba(250,204,21,0.1)' : 'rgba(100,116,139,0.08)',
    border: '1px solid rgba(100,116,139,0.25)',
    borderRadius: 4,
    color: status === 'done' ? '#4ade80' : status === 'error' ? '#f87171' : '#64748b',
    fontSize: 9,
    fontWeight: 600,
    padding: '2px 8px',
    cursor: status === 'fetching' ? 'not-allowed' : 'pointer',
    whiteSpace: 'nowrap' as const,
  }),
  loadingMsg: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center' as const,
    padding: '40px 0',
  } as React.CSSProperties,
  errorMsg: {
    color: '#f87171',
    fontSize: 12,
    padding: '12px 0',
  } as React.CSSProperties,
};

// ---- Component --------------------------------------------------------------

export function CatacombsTab() {
  const [manifests, setManifests] = useState<ManifestMap>(new Map());
  const [loadingManifests, setLoadingManifests] = useState(true);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [prefetchRunning, setPrefetchRunning] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<FetchStatusMap>(new Map());
  const [accessResult, setAccessResult] = useState<AccessResult | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  // Load all 16 manifests on mount
  const loadManifests = useCallback(async () => {
    setLoadingManifests(true);
    setManifestError(null);
    try {
      // Bootstrap first (idempotent)
      await invokeIPC('catacombs:bootstrap').catch(() => {});

      // Load all manifests concurrently
      const results = await Promise.allSettled(
        ALL_SLUGS.map((slug) =>
          invokeIPC('catacombs:get-manifest', slug)
            .then((m) => ({ slug, manifest: (m as FolderManifest) ?? defaultManifest(slug) }))
            .catch(() => ({ slug, manifest: defaultManifest(slug) }))
        )
      );

      const map = new Map<string, FolderManifest>();
      for (const r of results) {
        if (r.status === 'fulfilled') {
          map.set(r.value.slug, r.value.manifest);
        }
      }
      setManifests(map);
    } catch (err) {
      setManifestError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingManifests(false);
    }
  }, []);

  useEffect(() => {
    void loadManifests();
  }, [loadManifests]);

  // Check access
  useEffect(() => {
    invokeIPC('catacombs:check-access', 'anonymous', 'read')
      .then((res) => setAccessResult(res as AccessResult))
      .catch(() => setAccessResult({ allowed: true }));
  }, []);

  async function handlePrefetchAll() {
    if (prefetchRunning) return;
    setPrefetchRunning(true);
    // Mark all MMLU slugs as fetching
    const newStatus = new Map(fetchStatus);
    for (const slug of ALL_SLUGS.slice(0, 14)) {
      newStatus.set(slug, 'fetching');
    }
    setFetchStatus(newStatus);

    try {
      const results = await invokeIPC('catacombs:prefetch-all') as FetchResult[];
      const updated = new Map(newStatus);
      for (const r of results ?? []) {
        updated.set(r.slug, r.source === 'error' ? 'error' : 'done');
      }
      setFetchStatus(updated);
      // Reload manifests after prefetch
      await loadManifests();
    } catch {
      const updated = new Map(fetchStatus);
      for (const slug of ALL_SLUGS.slice(0, 14)) {
        updated.set(slug, 'error');
      }
      setFetchStatus(updated);
    } finally {
      setPrefetchRunning(false);
    }
  }

  async function handleFetchSlug(slug: string) {
    const current = fetchStatus.get(slug);
    if (current === 'fetching') return;
    setFetchStatus((prev) => new Map(prev).set(slug, 'fetching'));
    try {
      const res = await invokeIPC('catacombs:fetch-package', slug) as FetchResult;
      setFetchStatus((prev) => new Map(prev).set(slug, res.source === 'error' ? 'error' : 'done'));
      await loadManifests();
    } catch {
      setFetchStatus((prev) => new Map(prev).set(slug, 'error'));
    }
  }

  // If browsing a specific category
  if (selectedSlug) {
    return (
      <CategoryBrowser
        categorySlug={selectedSlug}
        displayName={DISPLAY_NAMES[selectedSlug] ?? selectedSlug}
        onClose={() => setSelectedSlug(null)}
      />
    );
  }

  return (
    <div style={S.container}>
      <div style={S.inner}>
        {/* Header */}
        <div style={S.header}>
          <div>
            <div style={S.title}>Alexandrian Catacombs</div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
              16-folder cooperative knowledge library -- MMLU-Pro + USER + Liana Banyan
            </div>
          </div>
          <button
            style={S.prefetchBtn(prefetchRunning)}
            onClick={handlePrefetchAll}
            disabled={prefetchRunning}
            title="Pre-fetch all 14 MMLU-Pro category packages (peer-first, server fallback)"
          >
            {prefetchRunning ? 'Pre-fetching...' : 'Pre-fetch All'}
          </button>
        </div>

        {/* License gate banner */}
        {accessResult?.show_offer && (
          <div style={S.offerBanner}>
            <strong>Commercial Access Notice:</strong> You are viewing the Alexandrian Catacombs
            under SSPL base license. A 30-day 50% commercial license offer is available.
            Join as a cooperative member for $5/year for full access.
          </div>
        )}

        {/* Loading / error */}
        {loadingManifests && <div style={S.loadingMsg}>Loading manifests...</div>}
        {manifestError && <div style={S.errorMsg}>Error loading manifests: {manifestError}</div>}

        {/* 16-folder grid */}
        {!loadingManifests && (
          <div style={S.grid}>
            {ALL_SLUGS.map((slug) => {
              const manifest = manifests.get(slug) ?? defaultManifest(slug);
              const status = fetchStatus.get(slug) ?? 'idle';
              const isUserOrLB = slug === '15_USER' || slug === '16_LIANA_BANYAN';

              return (
                <div
                  key={slug}
                  style={S.card(false)}
                  onClick={() => setSelectedSlug(slug)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') setSelectedSlug(slug); }}
                  aria-label={`Browse ${DISPLAY_NAMES[slug] ?? slug} -- ${manifest.eblet_count} eblets`}
                  title={`Browse ${DISPLAY_NAMES[slug] ?? slug}`}
                >
                  <div style={S.cardSlug}>{slug}</div>
                  <div style={S.cardName}>{DISPLAY_NAMES[slug] ?? slug}</div>
                  <div style={S.cardMeta}>
                    <span>{manifest.eblet_count} eblet{manifest.eblet_count !== 1 ? 's' : ''}</span>
                    <span>Updated: {formatDate(manifest.last_updated)}</span>
                    {manifest.soccerball_hash && (
                      <span style={{ fontFamily: 'monospace', fontSize: 9 }}>
                        {manifest.soccerball_hash.slice(0, 8)}...
                      </span>
                    )}
                  </div>

                  {/* Per-folder Fetch button -- only for MMLU-Pro slugs */}
                  {!isUserOrLB && (
                    <div
                      style={S.cardActions}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        style={S.fetchBtn(status)}
                        onClick={() => handleFetchSlug(slug)}
                        disabled={status === 'fetching'}
                        title={`Fetch ${DISPLAY_NAMES[slug] ?? slug} package`}
                      >
                        {status === 'fetching' ? 'fetching...' : status === 'done' ? 'fetched' : status === 'error' ? 'retry' : 'fetch'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
