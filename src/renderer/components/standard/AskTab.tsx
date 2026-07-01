// SEG-K23-D — Ask tab: marketplace shelf + Areopagus query + membership link

import React, { useState, useEffect } from 'react';
import type { AuthState } from '../../amplify.d';
import { AreopagusQueryPane } from '../AreopagusQueryPane';

export interface AskTabProps {
  authState: AuthState | null;
  onSwitchTab?: (tab: string) => void;
}

interface MarketplacePlugin {
  name?: string;
  id?: string;
}

function ChocolatesShelf() {
  const [plugins, setPlugins] = useState<MarketplacePlugin[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function fetchPlugins() {
      try {
        const res = await fetch('http://localhost:11480/yoke/marketplace/plugins');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          setPlugins(data);
        } else if (!cancelled && data?.plugins && Array.isArray(data.plugins) && data.plugins.length > 0) {
          setPlugins(data.plugins);
        }
      } catch {
        /* silent — empty or unavailable */
      }
    }
    void fetchPlugins();
    return () => { cancelled = true; };
  }, []);

  if (plugins.length === 0) return null;

  return (
    <div style={{ marginBottom: 8, flexShrink: 0 }}>
      <div style={{ fontSize: 10, color: '#606060', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Active Packages
      </div>
      <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 11, color: '#707070', lineHeight: 1.6 }}>
        {plugins.map((p, i) => (
          <li key={p.id ?? p.name ?? i}>{p.name ?? p.id ?? 'Unknown plugin'}</li>
        ))}
      </ul>
    </div>
  );
}

export function AskTab(_props: AskTabProps) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: 8,
      }}
    >
      <ChocolatesShelf />

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <AreopagusQueryPane />
      </div>

      <button
        type="button"
        onClick={() => window.amplify?.openExternal?.('https://mnemosynec.org')}
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          fontSize: 12,
          opacity: 0.6,
          padding: '4px 10px',
          backgroundColor: 'transparent',
          border: '1px solid rgba(100, 200, 150, 0.4)',
          borderRadius: 4,
          cursor: 'pointer',
          color: '#8bc8a0',
        }}
      >
        Join — $5/year
      </button>
    </div>
  );
}
