// Eblet™ Inspector — Mnemosyne™ v0.1.8 · SEG-FT-6 · BP052 NOVACULA
// Searchable list of Eblets · expand for full content · export · provenance chain

import React, { useState, useEffect, useCallback } from 'react';

interface Eblet {
  id: string;
  title: string;
  category: string;
  sha256: string;
  createdAt: string;
  content: string;
  tags: string[];
  provenance: string[];
}

const MOCK_EBLETS: Eblet[] = [
  { id: 'LB-CODEX-0196', title: 'Built-in-Public / Advance-Notice / Six-Degrees Triad', category: 'canon', sha256: 'a3f7c8d2e91b4056f...', createdAt: '2026-05-01T08:30:00Z', content: 'The Built-in-Public / Advance-Notice / Six-Degrees triad governs how Liana Banyan Corporation communicates and demonstrates its cooperative model to the world. Built-in-Public means all architecture decisions are visible. Advance-Notice means affected parties receive warning before changes. Six-Degrees means any cooperative member is within 6 hops of the decision-makers.', tags: ['canon', 'communication', 'cooperative'], provenance: ['BP035 Overnight', 'Bishop Opus 4.7'] },
  { id: 'LB-CODEX-0197', title: 'To Blave Maneuver — Founder-ratified', category: 'canon', sha256: 'b8e2a1f45c7d9031a...', createdAt: '2026-05-02T10:00:00Z', content: 'The To Blave Maneuver describes the cooperative negotiation tactic of apparent concession that actually advances the core mission. Named after the Princess Bride "to blave means to bluff" scene. When used in cooperative defense, it allows the Founder to appear to yield on tactical points while securing strategic outcomes.', tags: ['canon', 'negotiation', 'founder-ratified'], provenance: ['BP035 Overnight'] },
  { id: 'LB-CODEX-0206', title: 'Banyan Scale™ Framework — LB-EDITION-10', category: 'canonical-value', sha256: 'c4d9f2a7b1e3087c6...', createdAt: '2026-05-07T14:20:00Z', content: 'The Banyan Scale™ is the exclusive single-number metric (also called Banyan Metric™) used by Liana Banyan Corporation to measure AI productivity improvement. It is the composite of Speed × Cost × Accuracy axes measured against a pre-CAI baseline. Current canonical value: 55,940,972× (CAI-9.6, May 2026).', tags: ['banyan-metric', 'canonical-value', 'measurement'], provenance: ['BP036', 'canonical_values.yaml'] },
  { id: 'LB-CODEX-0211', title: 'R-CONTEXT-UPSTREAM Trinity Rule — QUINDECIM #13', category: 'trinity-rule', sha256: 'd1a8c5f96b2e4073d...', createdAt: '2026-05-08T09:00:00Z', content: 'R-CONTEXT-UPSTREAM (class: SWEAT) — Seed context upstream before downstream work. Substrate-current before external-facing work. Bishop context must be seeded before Knight implementation begins. This rule was bound as PARAMOUNT per Founder BP035 Overnight session. Violation results in stale-context drift.', tags: ['trinity-rule', 'quindecim', 'upstream'], provenance: ['BP035 Overnight', 'QUINDECIM 15'] },
  { id: 'LB-CODEX-0214', title: 'Aircraft Carrier / Always-On Substrate Doctrine', category: 'architecture', sha256: 'e6b3d0f7a4c2915e8...', createdAt: '2026-05-11T11:30:00Z', content: 'The Aircraft Carrier doctrine states that Mnemosyne™ operates as an always-on substrate carrier — the platform does not sleep, it merely idles. Like a carrier that keeps its deck clear and engines warm, Mnemosyne keeps its substrate index alive and its federation connections warm between active sessions. LB-EDITION-10.', tags: ['architecture', 'doctrine', 'substrate'], provenance: ['BP036', 'LB-EDITION-10'] },
];

export function EbletInspector() {
  const [eblets, setEblets] = useState<Eblet[]>([]);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [hasLiveData, setHasLiveData] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await (window.amplify as any)?.caiCore?.listEblets?.() as Eblet[] | null;
      if (result && result.length > 0) {
        setEblets(result);
        setHasLiveData(true);
      } else {
        setEblets(MOCK_EBLETS);
      }
    } catch {
      setEblets(MOCK_EBLETS);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = search.trim()
    ? eblets.filter((e) => e.title.toLowerCase().includes(search.toLowerCase()) || e.tags.some((t) => t.includes(search.toLowerCase())) || e.id.toLowerCase().includes(search.toLowerCase()))
    : eblets;

  function handleExport(eblet: Eblet) {
    const blob = new Blob([JSON.stringify(eblet, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${eblet.id}.eblet.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>Eblet™ Inspector</div>
          <div style={{ fontSize: 9, color: '#475569', marginTop: 1 }}>
            {hasLiveData ? `● ${eblets.length} live Eblets` : `○ ${eblets.length} mock Eblets — cai-core not connected`}
          </div>
        </div>
      </div>

      <input
        style={{ width: '100%', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(100,116,139,0.2)', borderRadius: 6, color: '#e2e8f0', fontSize: 11, padding: '5px 8px', outline: 'none', boxSizing: 'border-box' }}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search Eblets by ID, title, or tag…"
      />

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#475569', fontSize: 11, padding: '20px 0' }}>No Eblets match your search</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filtered.map((eblet) => (
            <div
              key={eblet.id}
              style={{ background: 'rgba(15,23,42,0.5)', border: expanded === eblet.id ? '1px solid rgba(110,231,183,0.25)' : '1px solid rgba(100,116,139,0.12)', borderRadius: 7, overflow: 'hidden', transition: 'border-color 0.15s' }}
            >
              {/* Row */}
              <div
                style={{ display: 'flex', alignItems: 'center', padding: '7px 10px', cursor: 'pointer', gap: 8 }}
                onClick={() => setExpanded(expanded === eblet.id ? null : eblet.id)}
              >
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {eblet.title}
                  </div>
                  <div style={{ fontSize: 8, color: '#475569', marginTop: 1 }}>
                    <span style={{ color: '#6ee7b7' }}>{eblet.id}</span>
                    {' · '}
                    <span>{eblet.category}</span>
                    {' · '}
                    <span>sha256: {eblet.sha256.slice(0, 8)}…</span>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: '#334155', flexShrink: 0 }}>{expanded === eblet.id ? '▲' : '▼'}</div>
              </div>

              {/* Expanded detail */}
              {expanded === eblet.id && (
                <div style={{ padding: '0 10px 10px', borderTop: '1px solid rgba(100,116,139,0.1)' }}>
                  <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.7, margin: '8px 0' }}>{eblet.content}</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                    {eblet.tags.map((t) => (
                      <span key={t} style={{ fontSize: 8, background: 'rgba(110,231,183,0.08)', border: '1px solid rgba(110,231,183,0.15)', borderRadius: 8, color: '#6ee7b7', padding: '1px 6px' }}>{t}</span>
                    ))}
                  </div>
                  <div style={{ fontSize: 8, color: '#334155', marginBottom: 8 }}>
                    Provenance: {eblet.provenance.join(' → ')}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleExport(eblet); }}
                    style={{ fontSize: 9, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(100,116,139,0.2)', background: 'rgba(100,116,139,0.06)', color: '#94a3b8', borderRadius: 5, padding: '3px 10px' }}
                  >
                    Export JSON
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
