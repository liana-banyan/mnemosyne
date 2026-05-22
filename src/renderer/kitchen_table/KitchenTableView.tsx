// Kitchen Table™ composite view — Mnemosyne™ v0.1.8 · SEG-FT-8 · BP052 NOVACULA
// Combines RecipesView + P2PDiscoveryPanel in a split layout

import React from 'react';
import { RecipesView } from './RecipesView';
import { P2PDiscoveryPanel } from './P2PDiscoveryPanel';

export function KitchenTableView() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 14px 4px',
        borderBottom: '1px solid rgba(100,116,139,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>
          🍽️ The Kitchen Table™
        </div>
        <div style={{ fontSize: 9, color: '#475569' }}>
          Recipes™ · Meal planning · Cooperative kitchen
        </div>
      </div>

      {/* Body — Recipes left, P2P panel bottom-right */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Recipes (takes most space) */}
        <div style={{ flex: 1, overflow: 'hidden', borderRight: '1px solid rgba(100,116,139,0.1)' }}>
          <RecipesView />
        </div>

        {/* Right rail — P2P discovery */}
        <div style={{ width: 220, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '8px 10px 4px', fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Network
          </div>
          <div style={{ padding: '0 10px 10px', flex: 1, overflowY: 'auto' }}>
            <P2PDiscoveryPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
