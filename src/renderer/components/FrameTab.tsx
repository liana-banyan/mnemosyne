// FrameTab — SAGA 07 BP046B · Tab 1 of MnemosyneTabView
// Transparent Outlining Window status, mode controls, and MoneyPenny telemetry.
// This is the "daily driver" tab — after first Gauntlet completion, opens here by default.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { FrameMode } from './FrameModeIndicator';
import type { AuthState } from '../amplify.d';
import { ModeSelectorPopover } from './ModeSelectorPopover';
import { WindRenderer } from '../swirling-winds/canvas-2d-wind';
import { WindSettingsCard } from '../swirling-winds/wind-settings-card';
import type { WindTier } from '../swirling-winds/canvas-2d-wind';

interface FrameTabProps {
  currentMode: FrameMode;
  onModeChange: (mode: FrameMode) => void;
  authState: AuthState | null;
  windUnlocked?: boolean;
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
const LS_SUB_TOGGLE         = 'mnemosyne_sub_toggle';
const LS_SUB_CURSOR         = 'mnemosyne_sub_cost_cursor_usd';
const LS_SUB_CLAUDE         = 'mnemosyne_sub_cost_claude_usd';
const LS_SUB_TAX            = 'mnemosyne_sub_cost_tax_usd';

const CURRENCY_PRECISION_TOOLTIP =
  'Sub-cent precision tracking - queries cost fractions of a cent each. The 4-decimal value is the exact substrate tally; rounded display shows normal cents.';

export function FrameTab({ currentMode, onModeChange, authState, windUnlocked = false }: FrameTabProps) {
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [monthStats, setMonthStats] = useState<TelemetryMonth | null>(null);
  const [isOverlayVisible, setIsOverlayVisible] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WindRenderer | null>(null);
  const [windTier, setWindTier] = useState<WindTier>(() =>
    (localStorage.getItem('mnem_wind_tier') as WindTier | null) ?? 'BREEZE',
  );
  const [showCurrencyPrecision, setShowCurrencyPrecision] = useState(() =>
    localStorage.getItem(LS_CURRENCY_PRECISION) !== 'rounded',
  );

  // Subscription toggle state (Section 1 — Cloud Cost WITH/WITHOUT)
  const [subToggle, setSubToggle] = useState(() =>
    localStorage.getItem(LS_SUB_TOGGLE) !== 'off'
  );
  const [subCostCursor, setSubCostCursor] = useState(() =>
    parseFloat(localStorage.getItem(LS_SUB_CURSOR) ?? '200')
  );
  const [subCostClaude, setSubCostClaude] = useState(() =>
    parseFloat(localStorage.getItem(LS_SUB_CLAUDE) ?? '200')
  );
  const [subCostTax, setSubCostTax] = useState(() =>
    parseFloat(localStorage.getItem(LS_SUB_TAX) ?? '15')
  );
  const fetchedAtRef = useRef<number | null>(null);
  const [fetchedAgoLabel, setFetchedAgoLabel] = useState('');

  function updateFetchedLabel() {
    if (fetchedAtRef.current === null) return;
    const secs = Math.floor((Date.now() - fetchedAtRef.current) / 1000);
    if (secs < 60) setFetchedAgoLabel('synced just now');
    else setFetchedAgoLabel(`synced ${Math.floor(secs / 60)} min ago`);
  }

  useEffect(() => {
    if (!window.amplify) return;
    window.amplify.getAMPLIFYSummary?.().then((summary) => {
      if (summary?.month) {
        setMonthStats(summary.month);
        fetchedAtRef.current = Date.now();
        setFetchedAgoLabel('synced just now');
      }
    });
    const interval = setInterval(updateFetchedLabel, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!windUnlocked || !canvasRef.current) return undefined;

    const canvas = canvasRef.current;
    const parent = canvas.parentElement;
    const renderer = new WindRenderer(canvas);
    rendererRef.current = renderer;

    const resize = () => {
      if (!parent) return;
      renderer.resize(parent.clientWidth, parent.clientHeight);
    };

    resize();
    renderer.setTier(windTier);

    const onBlur = () => renderer.pauseOnBlur();
    const onFocus = () => renderer.resumeOnFocus();
    const onVisibilityChange = () => {
      if (document.hidden) renderer.pauseOnBlur();
      else renderer.resumeOnFocus();
    };

    const resizeObserver = typeof ResizeObserver !== 'undefined' && parent
      ? new ResizeObserver(resize)
      : null;
    resizeObserver?.observe(parent);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      renderer.destroy();
      rendererRef.current = null;
      resizeObserver?.disconnect();
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [windUnlocked]);

  const handleTierChange = useCallback((tier: WindTier) => {
    setWindTier(tier);
    rendererRef.current?.setTier(tier);
  }, []);

  const mode = MODE_INFO[currentMode];

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
    <div className="wind-frame-shell">
      {windUnlocked && (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          role="presentation"
          className="wind-ambience-canvas"
        />
      )}

      <div style={{ position: 'relative', zIndex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 16, height: '100%', boxSizing: 'border-box', overflowY: 'auto' }}>

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

      {windUnlocked && (
        <WindSettingsCard onTierChange={handleTierChange} />
      )}

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
            <StatCell label="Local Served" value={`${monthStats.substrate_hits.toLocaleString()}`} />
            <div style={{ gridColumn: '1 / -1' }}>
              <CloudCostBlock
                rawCost={monthStats.cloud_cost_avoided_usd}
                subToggle={subToggle}
                onToggle={(val) => {
                  setSubToggle(val);
                  localStorage.setItem(LS_SUB_TOGGLE, val ? 'on' : 'off');
                }}
                subCostCursor={subCostCursor}
                subCostClaude={subCostClaude}
                subCostTax={subCostTax}
                onSubCostChange={(field, v) => {
                  if (field === 'cursor') { setSubCostCursor(v); localStorage.setItem(LS_SUB_CURSOR, String(v)); }
                  if (field === 'claude') { setSubCostClaude(v); localStorage.setItem(LS_SUB_CLAUDE, String(v)); }
                  if (field === 'tax')    { setSubCostTax(v);    localStorage.setItem(LS_SUB_TAX,    String(v)); }
                }}
                showPrecision={showCurrencyPrecision}
                fetchedAgoLabel={fetchedAgoLabel}
              />
            </div>
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

// ─── Cloud Cost Block ─────────────────────────────────────────────────────────

interface CloudCostBlockProps {
  rawCost: number;
  subToggle: boolean;
  onToggle: (val: boolean) => void;
  subCostCursor: number;
  subCostClaude: number;
  subCostTax: number;
  onSubCostChange: (field: 'cursor' | 'claude' | 'tax', v: number) => void;
  showPrecision: boolean;
  fetchedAgoLabel: string;
}

function CloudCostBlock({
  rawCost, subToggle, onToggle,
  subCostCursor, subCostClaude, subCostTax, onSubCostChange,
  showPrecision, fetchedAgoLabel,
}: CloudCostBlockProps) {
  const fmt = (n: number) =>
    `$${n.toLocaleString('en-US', {
      minimumFractionDigits: showPrecision ? 4 : 2,
      maximumFractionDigits: showPrecision ? 4 : 2,
    })}`;
  const fmtRounded = (n: number) =>
    `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const subTotal = subCostCursor + subCostClaude + subCostTax;

  // rawCost is GROSS (per-token cost avoided with no subscription — confirmed via main-process grep:
  // cloud_cost_avoided_usd = CLOUD_COST_PER_TOKEN_USD * TYPICAL_RESPONSE_TOKENS per substrate hit)
  // WITHOUT subscription: rawCost (what you'd pay at per-token rates)
  // WITH subscription:    rawCost - subTotal (net savings after subscription costs)
  const withoutVal = rawCost;
  const withVal    = rawCost - subTotal;
  const netSavings = rawCost - subTotal;

  const displayVal = subToggle ? withVal : withoutVal;

  return (
    <div style={{
      background: 'rgba(15,23,42,0.5)', borderRadius: 8, padding: '10px 12px',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Cloud Cost Avoided
        </div>
        {fetchedAgoLabel && (
          <div style={{ fontSize: 8, color: '#334155' }}>{fetchedAgoLabel}</div>
        )}
      </div>

      {/* Primary number */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#34d399' }}>
          {fmt(displayVal)}
        </div>
        {showPrecision && (
          <div style={{ fontSize: 10, color: '#475569' }}>({fmtRounded(displayVal)} rounded)</div>
        )}
      </div>

      {/* Toggle */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
        <input
          type="checkbox"
          checked={subToggle}
          onChange={() => onToggle(!subToggle)}
          style={{ accentColor: '#34d399', width: 13, height: 13 }}
        />
        <span style={{ fontSize: 10, color: subToggle ? '#6ee7b7' : '#64748b' }}>
          {subToggle
            ? 'WITH subscription (Cursor Ultra + Claude Code Ultra)'
            : 'WITHOUT subscription (gross per-token cost)'}
        </span>
      </label>

      {/* Subscription cost detail — visible only when toggle ON */}
      {subToggle && (
        <div style={{
          background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.1)',
          borderRadius: 6, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5,
        }}>
          <div style={{ fontSize: 9, color: '#475569', marginBottom: 2 }}>
            Subscription cost (edit if yours differs):
          </div>
          <SubCostRow label="Cursor Ultra /mo" value={subCostCursor}
            onChange={(v) => onSubCostChange('cursor', v)} />
          <SubCostRow label="Claude Code Ultra /mo" value={subCostClaude}
            onChange={(v) => onSubCostChange('claude', v)} />
          <SubCostRow label="Tax /mo" value={subCostTax}
            onChange={(v) => onSubCostChange('tax', v)} />
          <div style={{
            borderTop: '1px solid rgba(100,116,139,0.15)', marginTop: 4, paddingTop: 4,
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 9, color: '#64748b' }}>Total subscription /mo</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8' }}>{fmtRounded(subTotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
            <span style={{ fontSize: 10, color: '#64748b' }}>Net savings this month</span>
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: netSavings >= 0 ? '#34d399' : '#f87171',
            }}>
              {netSavings >= 0 ? '+' : ''}{fmt(netSavings)}
            </span>
          </div>
        </div>
      )}

      {/* WITHOUT context line */}
      {subToggle && (
        <div style={{ fontSize: 9, color: '#334155' }}>
          Without subscription: gross cost would have been {fmt(withoutVal)}
        </div>
      )}
    </div>
  );
}

function SubCostRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 9, color: '#475569' }}>{label}</span>
      <input
        type="number"
        value={value}
        min={0}
        step={1}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        style={{
          width: 64, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(100,116,139,0.2)',
          color: '#e2e8f0', borderRadius: 4, padding: '2px 6px', fontSize: 9, textAlign: 'right',
        }}
      />
    </div>
  );
}
