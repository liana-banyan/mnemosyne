// compass/SocialCompassTab.tsx -- BP138 Yoke 0.9.14: Compass nav tab 4 (Social).
//
// Reuses SocialTab.tsx as the base (its 5 real Cue Deck cards -- Welcome, Name the Empress,
// Check My Math, Join My Crew, Peer/Federation -- stay exactly as they are; Phase 5 says
// "Social keeps its existing cards," so nothing about SocialTab.tsx itself is touched).
//
// Adds one section: BatteryPublishTab.tsx ("Battery Dispatch"), fully absorbed here per the
// Yoke's investigation -- its content is entirely about fanning out ratified content to
// social/publishing platforms (Cephas, lianabanyan.com, Substack, Medium, HackerNews, Gmail
// editorial, Crown Letters), which is a Social-shaped concern top to bottom; there is no
// unrelated leftover content that would need a separate home in More. The underlying
// component and its dispatch logic are reused completely unmodified -- only the user-facing
// label changes, from the internal codename "Battery Dispatch" to "Share & Publish".

import React, { useState } from 'react';
import { SocialTab } from '../SocialTab';
import { BatteryPublishTab } from '../BatteryPublishTab';

export function SocialCompassTab(): React.ReactElement {
  const [showPublish, setShowPublish] = useState(false);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px 0', flexShrink: 0, background: '#0a0f1a' }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em',
          textTransform: 'uppercase' as const, marginBottom: 10,
        }}>
          Share &amp; Publish
        </div>
        <button
          onClick={() => setShowPublish((v) => !v)}
          style={{
            background: showPublish ? '#1e3a5c' : 'none', color: showPublish ? '#e2e8f0' : '#6ee7b7',
            border: '1px solid #1e4038', borderRadius: 6, padding: '6px 12px', fontSize: 12,
            fontWeight: 600, cursor: 'pointer', fontFamily: 'system-ui, sans-serif', marginBottom: 10,
          }}
        >
          ⚡ {showPublish ? 'Hide' : 'Open Share & Publish'}
        </button>
        {showPublish && (
          <div style={{ height: 480, border: '1px solid #1e2a38', borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
            <BatteryPublishTab />
          </div>
        )}
      </div>

      {/* Existing Social surface -- unmodified, own scroll container, own padding/background. */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <SocialTab />
      </div>
    </div>
  );
}

export default SocialCompassTab;
