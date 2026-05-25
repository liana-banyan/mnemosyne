// PearlGalleryTab — Mnemosyne v0.1.14 · BP057 W5 GOLD
// Tab 9 · Pearls — cooperative substrate Pearl registry viewer
// Displays received Pearls (SSPS compressed Eblet references) for member inspection
// Pearl-class: atomic wire-non-atomic-meaning data primitives (canon_pearls_eblet_condensate_data_class_bp055)

import React, { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Pearl {
  hash: string;
  name: string;
  domain: string;
  tags: string[];
  byteSize: number;
  mintedAt: string;
  compressionRatio?: number;
  shortDescription?: string;
}

// ─── Mock Pearl data (WildFire Tour mode placeholder) ────────────────────────
// Per Behavioral Rule 10: mock data shown ONLY in WildFire Tour mode.
// Real data state: empty until actual Pearl emissions received from substrate.

const WILDFIRE_PEARLS: Pearl[] = [
  {
    hash: 'PEARL-a1b2c3d4-faith-bedrock',
    name: 'canon_founder_faith_statement_philosophical_bedrock_bp051',
    domain: 'faith · bedrock · philosophy',
    tags: ['bedrock', 'faith', 'bp051'],
    byteSize: 607,
    mintedAt: '2026-05-22',
    compressionRatio: 15.8,
    shortDescription: 'Founder faith statement — soul anchor · Mark 9:24 · BA Bible + Ramsay + Lewis',
  },
  {
    hash: 'PEARL-e5f6a7b8-pearls-class',
    name: 'canon_pearls_eblet_condensate_data_class_bp055',
    domain: 'pearls · architecture · compression',
    tags: ['pearls', 'ssps', 'bp055'],
    byteSize: 904,
    mintedAt: '2026-05-24',
    compressionRatio: 6.5,
    shortDescription: 'Pearls = atomic-wire-non-atomic-meaning data primitives · SSPS wire format',
  },
  {
    hash: 'PEARL-c9d0e1f2-heart-of-peace',
    name: 'canon_heart_of_peace_arbinger_anatomy_of_peace_outward_mindset_bp051',
    domain: 'heart · arbinger · peace',
    tags: ['bedrock', 'heart', 'bp051'],
    byteSize: 734,
    mintedAt: '2026-05-22',
    compressionRatio: 18.4,
    shortDescription: 'Heart of Peace — Two Ways of Being · Arbinger Anatomy of Peace',
  },
  {
    hash: 'PEARL-b3c4d5e6-clean-baseline',
    name: 'canon_clean_baseline_empirical_proof_pearl_wrasse_compose_at_gold_scale_bp057',
    domain: 'empirical · gold · w5',
    tags: ['gold', 'w5', 'bp057'],
    byteSize: 612,
    mintedAt: '2026-05-25',
    compressionRatio: 7.2,
    shortDescription: 'W5 GOLD 3840-SAGA clean-baseline empirical proof · Pearl+Wrasse compose at scale',
  },
  {
    hash: 'PEARL-f7a8b9c0-wrasse-qm',
    name: 'canon_wrasse_quartermaster_substrate_primitive_auto_injection_path_manifest_bp056b',
    domain: 'wrasse · quartermaster · dispatch',
    tags: ['wrasse', 'dispatch', 'bp056b'],
    byteSize: 588,
    mintedAt: '2026-05-25',
    compressionRatio: 8.1,
    shortDescription: 'Wrasse-Quartermaster pre-baking pattern — Bishop injects path manifests before Knight wakes',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function PearlGalleryTab() {
  const [pearls, setPearls] = useState<Pearl[]>([]);
  const [isWildfireTour] = useState(false); // Off by default — real data mode
  const [selectedPearl, setSelectedPearl] = useState<Pearl | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [decodedContent, setDecodedContent] = useState<string | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);

  useEffect(() => {
    // In production: call window.amplify?.getPearls?.() or substrate MCP
    // For now: empty registry until substrate Pearl emissions are received
    const timer = setTimeout(() => {
      if (isWildfireTour) {
        setPearls(WILDFIRE_PEARLS);
      } else {
        setPearls([]); // Real state: no Pearls until substrate populated
      }
      setIsLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [isWildfireTour]);

  const filteredPearls = pearls.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.domain.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q)) ||
      (p.shortDescription || '').toLowerCase().includes(q)
    );
  });

  const handleDecode = useCallback(async (pearl: Pearl) => {
    setIsDecoding(true);
    setDecodedContent(null);
    try {
      // In production: call pearl_decode MCP tool via IPC
      // const result = await window.amplify?.decodePearl?.(pearl.hash);
      // For now: show Pearl metadata as decoded content
      await new Promise((r) => setTimeout(r, 600)); // simulate decode
      setDecodedContent(
        `# ${pearl.name}\n\n` +
        `**Hash:** ${pearl.hash}\n` +
        `**Domain:** ${pearl.domain}\n` +
        `**Tags:** ${pearl.tags.join(', ')}\n` +
        `**Minted:** ${pearl.mintedAt}\n` +
        `**Compression:** ${pearl.compressionRatio?.toFixed(1)}× (${pearl.byteSize} bytes SSPS → ${Math.round(pearl.byteSize * (pearl.compressionRatio ?? 6))} bytes Eblet)\n\n` +
        `## Summary\n${pearl.shortDescription}\n\n` +
        `---\n*Full Eblet requires pearl_decode MCP connection to librarian-mcp substrate*`
      );
    } catch {
      setDecodedContent('Pearl decode failed — substrate connection required');
    } finally {
      setIsDecoding(false);
    }
  }, []);

  // ─── Styles ─────────────────────────────────────────────────────────────────

  const s = {
    container: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column' as const,
      background: '#0a0f1a',
      color: '#e2e8f0',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    header: {
      padding: '12px 16px 8px',
      borderBottom: '1px solid rgba(100,116,139,0.15)',
      flexShrink: 0,
    },
    titleRow: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
    },
    title: {
      fontSize: 13,
      fontWeight: 700,
      color: '#a78bfa',
      letterSpacing: '-0.2px',
    },
    badge: {
      fontSize: 9,
      fontWeight: 700,
      padding: '2px 6px',
      borderRadius: 10,
      background: 'rgba(167,139,250,0.12)',
      border: '1px solid rgba(167,139,250,0.25)',
      color: '#a78bfa',
    },
    subtitle: {
      fontSize: 10,
      color: '#475569',
      lineHeight: 1.4,
    },
    searchBar: {
      padding: '8px 16px',
      borderBottom: '1px solid rgba(100,116,139,0.1)',
      flexShrink: 0,
    },
    input: {
      width: '100%',
      padding: '6px 10px',
      background: 'rgba(100,116,139,0.08)',
      border: '1px solid rgba(100,116,139,0.2)',
      borderRadius: 6,
      color: '#e2e8f0',
      fontSize: 11,
      outline: 'none',
      boxSizing: 'border-box' as const,
    },
    body: {
      flex: 1,
      display: 'flex',
      overflow: 'hidden',
    },
    list: {
      width: selectedPearl ? '45%' : '100%',
      overflowY: 'auto' as const,
      borderRight: selectedPearl ? '1px solid rgba(100,116,139,0.15)' : 'none',
    },
    detail: {
      flex: 1,
      overflowY: 'auto' as const,
      padding: 16,
    },
    emptyState: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      gap: 12,
      padding: 32,
      textAlign: 'center' as const,
    },
    pearlItem: (selected: boolean): React.CSSProperties => ({
      padding: '10px 16px',
      borderBottom: '1px solid rgba(100,116,139,0.08)',
      cursor: 'pointer',
      background: selected ? 'rgba(167,139,250,0.08)' : 'transparent',
      borderLeft: selected ? '2px solid #a78bfa' : '2px solid transparent',
      transition: 'all 0.15s',
    }),
    pearlName: {
      fontSize: 10,
      fontWeight: 600,
      color: '#a78bfa',
      marginBottom: 2,
      wordBreak: 'break-all' as const,
    },
    pearlDomain: {
      fontSize: 9,
      color: '#64748b',
      marginBottom: 4,
    },
    pearlMeta: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap' as const,
    },
    tag: {
      fontSize: 8,
      padding: '1px 5px',
      borderRadius: 8,
      background: 'rgba(100,116,139,0.1)',
      border: '1px solid rgba(100,116,139,0.2)',
      color: '#475569',
    },
    compressionBadge: {
      fontSize: 8,
      padding: '1px 5px',
      borderRadius: 8,
      background: 'rgba(110,231,183,0.08)',
      border: '1px solid rgba(110,231,183,0.2)',
      color: '#6ee7b7',
    },
    decodeBtn: {
      marginTop: 8,
      padding: '4px 10px',
      background: 'rgba(167,139,250,0.1)',
      border: '1px solid rgba(167,139,250,0.25)',
      borderRadius: 6,
      color: '#a78bfa',
      fontSize: 10,
      fontWeight: 600,
      cursor: 'pointer',
    },
  };

  if (isLoading) {
    return (
      <div style={{ ...s.container, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>🪶</div>
        <div style={{ fontSize: 11, color: '#64748b' }}>Loading Pearl registry…</div>
      </div>
    );
  }

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.titleRow}>
          <span style={{ fontSize: 16 }}>🪶</span>
          <div style={s.title}>Pearl Gallery™</div>
          <div style={s.badge}>SUBSTRATE</div>
          {pearls.length > 0 && (
            <div style={{ ...s.badge, background: 'rgba(110,231,183,0.08)', borderColor: 'rgba(110,231,183,0.2)', color: '#6ee7b7' }}>
              {pearls.length} Pearl{pearls.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
        <div style={s.subtitle}>
          Cooperative substrate · atomic compressed Eblet references · 6.1× avg compression
        </div>
      </div>

      {/* Search */}
      {pearls.length > 0 && (
        <div style={s.searchBar}>
          <input
            style={s.input}
            placeholder="Search Pearls by name, domain, or tag…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search Pearl registry"
          />
        </div>
      )}

      {/* Body */}
      <div style={s.body}>
        {/* Pearl list */}
        <div style={s.list}>
          {pearls.length === 0 ? (
            <div style={s.emptyState}>
              <div style={{ fontSize: 36 }}>🪶</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>
                No Pearls yet
              </div>
              <div style={{ fontSize: 11, color: '#475569', maxWidth: 260, lineHeight: 1.6 }}>
                Pearls arrive when connected to the Caithedral cooperative substrate.
                Each Pearl is a compressed reference to a cooperative canon — 6.1× smaller
                than the full Eblet.
              </div>
              <div style={{
                marginTop: 8,
                padding: '8px 12px',
                background: 'rgba(167,139,250,0.06)',
                border: '1px solid rgba(167,139,250,0.2)',
                borderRadius: 8,
                fontSize: 10,
                color: '#64748b',
                maxWidth: 280,
                lineHeight: 1.5,
              }}>
                <strong style={{ color: '#a78bfa' }}>Pearl Prerogative:</strong> Agents emit
                Pearls instead of quoting full canon content — 83.5% chatter reduction.
                Matthew 7:6 inversion · receiver-capable cooperatives.
              </div>
            </div>
          ) : filteredPearls.length === 0 ? (
            <div style={s.emptyState}>
              <div style={{ fontSize: 11, color: '#64748b' }}>No Pearls match "{searchQuery}"</div>
            </div>
          ) : (
            filteredPearls.map((pearl) => (
              <div
                key={pearl.hash}
                style={s.pearlItem(selectedPearl?.hash === pearl.hash)}
                onClick={() => {
                  setSelectedPearl(selectedPearl?.hash === pearl.hash ? null : pearl);
                  setDecodedContent(null);
                }}
                role="button"
                tabIndex={0}
                aria-label={`Pearl: ${pearl.name}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setSelectedPearl(selectedPearl?.hash === pearl.hash ? null : pearl);
                  }
                }}
              >
                <div style={s.pearlName}>{pearl.name}</div>
                <div style={s.pearlDomain}>{pearl.domain}</div>
                <div style={s.pearlMeta}>
                  {pearl.tags.map((t) => (
                    <span key={t} style={s.tag}>{t}</span>
                  ))}
                  {pearl.compressionRatio && (
                    <span style={s.compressionBadge}>{pearl.compressionRatio.toFixed(1)}× compression</span>
                  )}
                  <span style={s.tag}>{pearl.byteSize}b SSPS</span>
                  <span style={s.tag}>{pearl.mintedAt}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail panel */}
        {selectedPearl && (
          <div style={s.detail}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', marginBottom: 8 }}>
              🪶 Pearl Detail
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8', wordBreak: 'break-all', marginBottom: 4 }}>
              {selectedPearl.hash}
            </div>
            <div style={{ fontSize: 11, color: '#e2e8f0', marginBottom: 4 }}>
              {selectedPearl.shortDescription}
            </div>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 12 }}>
              Domain: {selectedPearl.domain} · {selectedPearl.byteSize}b ·{' '}
              {selectedPearl.compressionRatio?.toFixed(1)}× compression
            </div>

            <button
              style={s.decodeBtn}
              onClick={() => handleDecode(selectedPearl)}
              disabled={isDecoding}
            >
              {isDecoding ? 'Decoding…' : '⚙ Decode Pearl →'}
            </button>

            {decodedContent && (
              <div style={{
                marginTop: 12,
                padding: '10px 12px',
                background: 'rgba(100,116,139,0.06)',
                border: '1px solid rgba(100,116,139,0.15)',
                borderRadius: 6,
                fontSize: 10,
                color: '#94a3b8',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6,
                fontFamily: 'monospace',
              }}>
                {decodedContent}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
