// Kitchen Table™ composite view — Mnemosyne™ v0.1.8 · SEG-FT-8 · BP052 NOVACULA
// KniPr035: Trail Eblets tab added alongside Recipes + P2P
// KniPr036: Bounty Board tab added

import React, { useState } from 'react';
import { RecipesView } from './RecipesView';
import { P2PDiscoveryPanel } from './P2PDiscoveryPanel';
import { TrailEbletViewer } from './TrailEbletViewer';
import { BountyBrowser } from './BountyBrowser';

type KitchenTab = 'kitchen' | 'trails' | 'bounty-board';

const TAB_ITEMS: Array<{ id: KitchenTab; label: string }> = [
  { id: 'kitchen',      label: '🍽️ Kitchen' },
  { id: 'trails',       label: '🥾 Trail Eblets' },
  { id: 'bounty-board', label: '🏹 Bounty Board' },
];

export function KitchenTableView() {
  const [activeTab, setActiveTab] = useState<KitchenTab>('kitchen');

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header + tab bar */}
      <div style={{
        padding: '6px 14px 0',
        borderBottom: '1px solid rgba(100,116,139,0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        flexShrink: 0,
      }}>
        {TAB_ITEMS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid rgba(99,102,241,0.7)' : '2px solid transparent',
              color: activeTab === tab.id ? '#e2e8f0' : '#64748b',
              fontSize: 11,
              fontWeight: activeTab === tab.id ? 700 : 400,
              padding: '4px 12px 6px',
              cursor: 'pointer',
              transition: 'color 0.12s, border-color 0.12s',
              flexShrink: 0,
            }}
          >
            {tab.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {activeTab === 'kitchen' && (
          <div style={{ fontSize: 9, color: '#475569', paddingBottom: 6 }}>
            Recipes™ · Meal planning · Cooperative kitchen
          </div>
        )}
        {activeTab === 'trails' && (
          <div style={{ fontSize: 9, color: '#475569', paddingBottom: 6 }}>
            Pawn Phase 3 outputs · TRAILS eblet store
          </div>
        )}
        {activeTab === 'bounty-board' && (
          <div style={{ fontSize: 9, color: '#475569', paddingBottom: 6 }}>
            Pawn Phase 3 · accept Trails · earn Marks
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'kitchen' && (
          <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
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
        )}
        {activeTab === 'trails' && <TrailEbletViewer />}
        {activeTab === 'bounty-board' && <BountyBrowser />}
      </div>
    </div>
  );
}
