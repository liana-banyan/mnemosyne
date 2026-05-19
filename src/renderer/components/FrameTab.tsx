// FrameTab — SAGA 07 BP046B · Tab 1 of MnemosyneTabView
// Transparent Outlining Window status, mode controls, and MoneyPenny telemetry.
// This is the "daily driver" tab — after first Gauntlet completion, opens here by default.

import React, { useState, useEffect } from 'react';
import type { FrameMode } from './FrameModeIndicator';
import type { AuthState } from '../amplify.d';
import { ModeSelectorPopover } from './ModeSelectorPopover';

interface FrameTabProps {
  currentMode: FrameMode;
  onModeChange: (mode: FrameMode) => void;
  authState: AuthState | null;
}

interface TelemetryMonth {
  total_queries: number;
  substrate_hits: number;
  cloud_cost_avoided_usd: number;
  substrate_hit_ratio: number;
}

const MODE_INFO: Record<FrameMode, { icon: string; label: string; color: string; description: string }> = {
  ai_burst:  { icon: '🔥', label: 'AI Burst',  color: '#facc15', description: 'Cloud AI + Mnemosyne + Substrate · Pay-per-token' },
  normal:    { icon: '🪵', label: 'Normal',    color: '#22c55e', description: 'Local Ollama + Substrate · Zero marginal cost' },
  fallback:  { icon: '❄️', label: 'Fallback',  color: '#3b82f6', description: 'Substrate cache only · Zero cost · Offline-capable' },
};

const LS_CURRENCY_PRECISION = 'mnemo_display_currency_precision';
const CURRENCY_PRECISION_TOOLTIP =
  'Sub-cent precision tracking - queries cost fractions of a cent each. The 4-decimal value is the exact substrate tally; rounded display shows normal cents.';

export function FrameTab({ currentMode, onModeChange, authState }: FrameTabProps) {
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [monthStats, setMonthStats] = useState<TelemetryMonth | null>(null);
  const [isOverlayVisible, setIsOverlayVisible] = useState(true);
  const [showCurrencyPrecision, setShowCurrencyPrecision] = useState(() =>
    localStorage.getItem(LS_CURRENCY_PRECISION) !== 'rounded',
  );

  useEffect(() => {
    if (!window.amplify) return;
    window.amplify.getAMPLIFYSummary?.().then((summary) => {
      if (summary?.month) setMonthStats(summary.month);
    });
  }, []);

  const mode = MODE_INFO[currentMode];
  const currencyDigits = showCurrencyPrecision ? 4 : 2;
  const cloudCostDisplay = monthStats
    ? `$${monthStats.cloud_cost_avoided_usd.toLocaleString('en-US', {
      minimumFractionDigits: currencyDigits,
      maximumFractionDigits: currencyDigits,
    })}`
    : '$0.0000';

  function handleCurrencyPrecisionToggle() {
    const next = !showCurrencyPrecision;
    setShowCurrencyPrecision(next);
    localStorage.setItem(LS_CURRENCY_PRECISION, next ? 'precision' : 'rounded');
  }

  const handleToggleOverlay = () => {
    if (isOverlayVisible) {
      window.amplify?.hideOverlay?.();
    } else {
      window.amplify?.showOverlay?.();
    }
    setIsOverlayVisible(!isOverlayVisible);
  };

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, height: '100%', boxSizing: 'border-box', overflowY: 'auto' }}>

      {/* Mode card */}
      <div style={{
        background: `rgba(${mode.color === '#facc15' ? '250,204,21' : mode.color === '#22c55e' ? '34,197,94' : '59,130,246'},0.08)`,
        border: `1px solid rgba(${mode.color === '#facc15' ? '250,204,21' : mode.color === '#22c55e' ? '34,197,94' : '59,130,246'},0.25)`,
        borderRadius: 10,
        padding: '14px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Active Mode
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 700, color: mode.color }}>
              <span>{mode.icon}</span>
              <span>{mode.label}</span>
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{mode.description}</div>
          </div>
          <button
            onClick={() => setShowModeSelector(true)}
            style={{
              background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.2)',
              color: '#94a3b8', borderRadius: 8, padding: '6px 12px', fontSize: 11,
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            Change
          </button>
        </div>
      </div>

      {/* Overlay toggle */}
      <div style={{
        background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(100,116,139,0.15)',
        borderRadius: 10, padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>
            🪟 Transparent Outlining Window
          </div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
            {isOverlayVisible ? 'Active — substrate hits outlined on screen' : 'Hidden — click to restore'}
          </div>
        </div>
        <button
          onClick={handleToggleOverlay}
          style={{
            background: isOverlayVisible ? 'rgba(110,231,183,0.1)' : 'rgba(100,116,139,0.1)',
            border: `1px solid ${isOverlayVisible ? 'rgba(110,231,183,0.3)' : 'rgba(100,116,139,0.2)'}`,
            color: isOverlayVisible ? '#6ee7b7' : '#64748b',
            borderRadius: 8, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}
        >
          {isOverlayVisible ? 'Hide' : 'Show'}
        </button>
      </div>

      {/* MoneyPenny stats */}
      {monthStats && (
        <div style={{
          background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(100,116,139,0.15)',
          borderRadius: 10, padding: '12px 16px',
        }}>
          <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            <span>This Month · Mnemosyne CAI Amplifier</span>
            <button
              type="button"
              onClick={handleCurrencyPrecisionToggle}
              title="Dashboard -> Settings -> Display: toggle rounded/precision currency display"
              style={{
                marginLeft: 8, background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.2)',
                color: '#94a3b8', borderRadius: 999, padding: '2px 7px', fontSize: 9,
                cursor: 'pointer', textTransform: 'none', letterSpacing: 0,
              }}
            >
              {showCurrencyPrecision ? 'Precision' : 'Rounded'}
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <StatCell label="Queries" value={monthStats.total_queries.toLocaleString()} />
            <StatCell label="Substrate Hits" value={`${(monthStats.substrate_hit_ratio * 100).toFixed(1)}%`} color="#6ee7b7" />
            <StatCell
              label="Cloud Cost Avoided"
              value={cloudCostDisplay}
              color="#34d399"
              title={CURRENCY_PRECISION_TOOLTIP}
            />
            <StatCell label="Local Served" value={`${monthStats.substrate_hits.toLocaleString()}`} />
          </div>
        </div>
      )}

      {/* Free to use / join CTA */}
      {!authState?.member && (
        <div style={{
          background: 'rgba(110,231,183,0.04)', border: '1px solid rgba(110,231,183,0.12)',
          borderRadius: 10, padding: '12px 16px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6ee7b7', marginBottom: 4 }}>
            Free to use. Better to join.
          </div>
          <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.6, marginBottom: 10 }}>
            $5/year unlocks Helm + Federation Stage 6 + Code Breakers marks + Banyan Metric sharing
          </div>
          <button
            onClick={() => window.amplify?.openExternal?.('https://lianabanyan.com/join')}
            style={{
              background: 'rgba(110,231,183,0.12)', border: '1px solid rgba(110,231,183,0.3)',
              color: '#6ee7b7', borderRadius: 8, padding: '6px 16px', fontSize: 11,
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            Join — $5/year →
          </button>
        </div>
      )}

      {showModeSelector && (
        <ModeSelectorPopover
          currentMode={currentMode}
          onSelect={(m) => { onModeChange(m); setShowModeSelector(false); }}
          onClose={() => setShowModeSelector(false)}
        />
      )}
    </div>
  );
}

function StatCell({ label, value, color, title }: { label: string; value: string; color?: string; title?: string }) {
  return (
    <div style={{
      background: 'rgba(15,23,42,0.5)', borderRadius: 8, padding: '8px 10px',
      cursor: title ? 'help' : 'default',
      textDecoration: title ? 'underline dotted rgba(52,211,153,0.45)' : 'none',
      textUnderlineOffset: 3,
    }}
    title={title}
    >
      <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: color ?? '#e2e8f0', marginTop: 3 }}>{value}</div>
    </div>
  );
}
