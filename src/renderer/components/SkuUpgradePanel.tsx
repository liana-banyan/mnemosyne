// SkuUpgradePanel.tsx -- BP078 Scope 6.5 / M18b
// In-app SKU upgrade panel. Settings surface (NOT fullscreen overlay).
// Shows NANO / LITE / CORE / FULL / ULTRA tiers.
// M18b: right-size.json override wiring; getTileState; dynamic model names; Caithedral sweep.

import React, { useEffect, useState, useCallback, useRef } from 'react';
import type { SkuPullProgress } from '../amplify.d';

// ── Types ───────────────────────────────────────────────────────────────────

type SkuTierId = 'nano' | 'lite' | 'core' | 'full' | 'ultra';
type TileState = 'active' | 'available' | 'challenge-destiny' | 'insufficient';

type UpgradePhase =
  | 'checking'   // loading tier + model existence
  | 'ready'      // waiting for user action
  | 'upgrading'  // pull in progress
  | 'complete'   // pull done, FULL activated
  | 'error';     // pull failed

export interface SkuUpgradePanelProps {
  analytics?: {
    track: (event: string, payload?: Record<string, unknown>) => void;
  };
  onUpgradeComplete?: () => void;
}

// ── Tier definitions ─────────────────────────────────────────────────────────

interface SkuTierDef {
  id: SkuTierId;
  name: string;
  tagline: string;
  model: string;
  modelSize: string;
  features: string[];
  downloadSize: string | null;
  comingSoon?: boolean;
}

const SKU_TIERS: SkuTierDef[] = [
  {
    id: 'nano',
    name: 'NANO',
    tagline: 'Private AI, zero cloud.',
    model: 'qwen2.5:0.5b',
    modelSize: '~500 MB bundled',
    features: ['Private local AI', 'Floor model included', 'Basic substrate search'],
    downloadSize: null,
  },
  {
    id: 'lite',
    name: 'LITE',
    tagline: 'Balanced power and speed.',
    model: 'gemma2:2b',
    modelSize: '~2 GB download',
    features: ['gemma2:2b model', 'Fast local inference', 'Substrate search'],
    downloadSize: '~2 GB',
  },
  {
    id: 'core',
    name: 'CORE',
    tagline: 'Enhanced local intelligence.',
    model: 'gemma2:9b',
    modelSize: '~6 GB download',
    features: ['gemma2:9b model', 'Mnem-DRT enabled', 'Substrate depth'],
    downloadSize: '~6 GB',
  },
  {
    id: 'full',
    name: 'FULL',
    tagline: 'Flagship AI, private and local.',
    model: 'gemma4:12b',
    modelSize: '~7 GB download',
    features: ["Google's Gemma 4 12B model", 'Mnem-DRT enabled', 'All 10 specialists', 'Full substrate depth'],
    downloadSize: '~7 GB',
  },
  {
    id: 'ultra',
    name: 'ULTRA',
    tagline: 'Maximum local intelligence.',
    model: 'llama3.3:70b',
    modelSize: '~42 GB download',
    features: ['llama3.3:70b model', 'Top-tier local AI', 'Full Caithedral depth', '64GB+ RAM required'],
    downloadSize: '~42 GB',
  },
];

// ── M18b: Tier ordering and model map ────────────────────────────────────────

const TIER_ORDER: SkuTierId[] = ['nano', 'lite', 'core', 'full', 'ultra'];

const TIER_MODEL_MAP: Record<SkuTierId, string> = {
  nano:  'qwen2.5:0.5b (bundled)',
  lite:  'gemma2:2b',
  core:  'gemma2:9b',
  full:  'gemma4:12b',
  ultra: 'llama3.3:70b',
};

function getTileState(
  tileTier: SkuTierId,
  effectiveTier: SkuTierId,
  autoDetectedTier: SkuTierId,
): TileState {
  if (tileTier === effectiveTier) return 'active';
  const tileIdx = TIER_ORDER.indexOf(tileTier);
  const hwIdx = TIER_ORDER.indexOf(autoDetectedTier);
  if (tileIdx <= hwIdx) return 'available';
  if (tileIdx === hwIdx + 1) return 'challenge-destiny';
  return 'insufficient';
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SPIN_KEYFRAMES = `@keyframes sup-spin { to { transform: rotate(360deg); } }`;

function bytesToGB(bytes: number): string {
  return (bytes / 1_073_741_824).toFixed(1);
}

function progressFraction(downloaded: number, total: number): number {
  if (total <= 0 || downloaded <= 0) return 0;
  return Math.min(downloaded / total, 1);
}

// ── Sub-components ───────────────────────────────────────────────────────────

function CheckIcon(): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="rgba(74,222,128,0.15)" stroke="#4ade80" strokeWidth="1.5" />
      <path d="M9 16.5l5 5 9-9" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const S = {
  panel: {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    background: '#0d1117',
    borderRadius: 12,
    padding: '28px 24px',
    maxWidth: 560,
  } as React.CSSProperties,

  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: '#6ee7b7',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    marginBottom: 20,
  } as React.CSSProperties,

  tiersGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
    marginBottom: 20,
  } as React.CSSProperties,

  tierCard: (active: boolean, dimmed: boolean): React.CSSProperties => ({
    background: active ? 'rgba(110,231,183,0.06)' : '#111827',
    border: active
      ? '1px solid rgba(110,231,183,0.4)'
      : '1px solid rgba(100,116,139,0.2)',
    borderRadius: 10,
    padding: '14px 14px 12px',
    opacity: dimmed ? 0.45 : 1,
    transition: 'opacity 0.2s',
  }),

  tierName: {
    fontSize: 13,
    fontWeight: 800,
    color: '#e2e8f0',
    letterSpacing: '0.06em',
    marginBottom: 2,
  } as React.CSSProperties,

  tierTagline: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 1.5,
    marginBottom: 8,
  } as React.CSSProperties,

  tierFeature: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 1.7,
    display: 'flex',
    gap: 5,
    alignItems: 'flex-start',
  } as React.CSSProperties,

  activeBadge: {
    display: 'inline-block',
    fontSize: 10,
    fontWeight: 700,
    color: '#4ade80',
    background: 'rgba(74,222,128,0.12)',
    border: '1px solid rgba(74,222,128,0.3)',
    borderRadius: 4,
    padding: '2px 7px',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    marginBottom: 8,
  } as React.CSSProperties,

  comingSoonBadge: {
    display: 'inline-block',
    fontSize: 10,
    fontWeight: 600,
    color: '#475569',
    background: 'rgba(71,85,105,0.15)',
    border: '1px solid rgba(71,85,105,0.25)',
    borderRadius: 4,
    padding: '2px 7px',
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    marginBottom: 8,
  } as React.CSSProperties,

  modelSizeLabel: {
    fontSize: 10,
    color: '#334155',
    marginTop: 6,
  } as React.CSSProperties,

  upgradeBtn: {
    marginTop: 10,
    width: '100%',
    padding: '8px 12px',
    background: 'rgba(110,231,183,0.13)',
    border: '1px solid rgba(110,231,183,0.4)',
    borderRadius: 7,
    color: '#6ee7b7',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  activateBtn: {
    marginTop: 10,
    width: '100%',
    padding: '8px 12px',
    background: 'rgba(99,102,241,0.13)',
    border: '1px solid rgba(99,102,241,0.4)',
    borderRadius: 7,
    color: '#a5b4fc',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  progressTrack: {
    height: 5,
    background: 'rgba(110,231,183,0.15)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  } as React.CSSProperties,

  progressRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 11,
    color: '#64748b',
    marginBottom: 4,
  } as React.CSSProperties,

  spinnerStyle: {
    width: 14,
    height: 14,
    border: '2px solid rgba(110,231,183,0.2)',
    borderTopColor: '#6ee7b7',
    borderRadius: '50%',
    animation: 'sup-spin 0.8s linear infinite',
    display: 'inline-block',
    flexShrink: 0,
  } as React.CSSProperties,

  cancelBtn: {
    marginTop: 8,
    width: '100%',
    padding: '7px 12px',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.22)',
    borderRadius: 7,
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  ghostBtn: {
    display: 'block',
    width: '100%',
    textAlign: 'center' as const,
    background: 'none',
    border: 'none',
    color: '#334155',
    fontSize: 11,
    cursor: 'pointer',
    padding: '6px 0 0',
  } as React.CSSProperties,

  retryBtn: {
    marginTop: 8,
    width: '100%',
    padding: '7px 12px',
    background: 'rgba(110,231,183,0.1)',
    border: '1px solid rgba(110,231,183,0.3)',
    borderRadius: 7,
    color: '#6ee7b7',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  errorBox: {
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.22)',
    borderRadius: 8,
    padding: '10px 12px',
    marginBottom: 8,
    fontSize: 12,
    color: '#fca5a5',
    lineHeight: 1.6,
  } as React.CSSProperties,

  successBox: {
    background: 'rgba(74,222,128,0.07)',
    border: '1px solid rgba(74,222,128,0.25)',
    borderRadius: 8,
    padding: '12px 14px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 8,
  } as React.CSSProperties,

  tierBanner: {
    fontSize: 11,
    color: '#94a3b8',
    background: 'rgba(100,116,139,0.1)',
    border: '1px solid rgba(100,116,139,0.2)',
    borderRadius: 6,
    padding: '6px 10px',
    marginBottom: 12,
  } as React.CSSProperties,

  overrideWarningChip: {
    fontSize: 11,
    color: '#fbbf24',
    background: 'rgba(251,191,36,0.08)',
    border: '1px solid rgba(251,191,36,0.3)',
    borderRadius: 6,
    padding: '7px 10px',
    marginBottom: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,

  challengeDestinyBadge: {
    display: 'inline-block',
    fontSize: 10,
    fontWeight: 700,
    color: '#fbbf24',
    background: 'rgba(251,191,36,0.1)',
    border: '1px solid rgba(251,191,36,0.35)',
    borderRadius: 4,
    padding: '2px 7px',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    marginBottom: 8,
  } as React.CSSProperties,

  challengeDestinyBtn: {
    marginTop: 10,
    width: '100%',
    padding: '8px 12px',
    background: 'rgba(251,191,36,0.1)',
    border: '1px solid rgba(251,191,36,0.4)',
    borderRadius: 7,
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  restoreAutoBtn: {
    fontSize: 10,
    padding: '3px 8px',
    background: 'rgba(251,191,36,0.12)',
    border: '1px solid rgba(251,191,36,0.4)',
    borderRadius: 4,
    color: '#fbbf24',
    cursor: 'pointer',
    fontWeight: 600,
    flexShrink: 0,
  } as React.CSSProperties,
};

// ── Component ────────────────────────────────────────────────────────────────

export function SkuUpgradePanel({
  analytics,
  onUpgradeComplete,
}: SkuUpgradePanelProps): React.ReactElement {
  const [phase, setPhase] = useState<UpgradePhase>('checking');
  const [currentTier, setCurrentTier] = useState<SkuTierId>('nano');
  const [modelExists, setModelExists] = useState(false);
  const [progress, setProgress] = useState<SkuPullProgress | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [stallWarning, setStallWarning] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [clickedTile, setClickedTile] = useState<SkuTierId | null>(null);

  // M18b: effective tier/model state (honors right-size.json override)
  const [effectiveTier, setEffectiveTier] = useState<SkuTierId>('nano');
  const [autoDetectedTier, setAutoDetectedTier] = useState<SkuTierId>('nano');
  const [overrideActive, setOverrideActive] = useState(false);
  const [effectiveModel, setEffectiveModel] = useState<string>('');
  const [autoDetectedModel, setAutoDetectedModel] = useState<string>('');

  const upgradeActiveRef = useRef(false);
  // Holds cleanup callbacks for IPC listeners registered during upgrade
  const listenerCleanupRef = useRef<(() => void) | null>(null);
  // Tracks when the last sku-pull-progress event arrived (ms epoch)
  const lastProgressTimeRef = useRef<number>(0);

  // ── On mount: load tier + model state ─────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    void (async (): Promise<void> => {
      try {
        const [tierResult, modelResult, hwResult] = await Promise.all([
          window.amplify.sku?.currentTier() ?? Promise.resolve({ tier: 'nano' as const }),
          window.amplify.sku?.checkModel('gemma4:12b') ?? Promise.resolve({ exists: false, modelName: 'gemma4:12b' }),
          (window.amplify as unknown as { invoke?: (ch: string) => Promise<unknown> }).invoke?.('hardware:get-tier') ?? Promise.resolve(null),
        ]);
        if (cancelled) return;
        setCurrentTier(tierResult.tier);
        setModelExists(modelResult.exists);

        // M18b: populate effective tier/model from hardware IPC result
        if (hwResult && typeof hwResult === 'object' && 'effectiveModelResult' in (hwResult as Record<string, unknown>)) {
          const emr = (hwResult as Record<string, unknown>).effectiveModelResult as {
            tier?: string; model?: string | null; overrideActive?: boolean; autoDetectedModel?: string | null;
          };
          if (emr) {
            const effTierRaw = (emr.tier ?? 'nano').toLowerCase() as SkuTierId;
            const autoTierRaw = (() => {
              if (!emr.autoDetectedModel) return effTierRaw;
              const m = emr.autoDetectedModel;
              if (m.includes('70b')) return 'ultra' as SkuTierId;
              if (m.includes('12b')) return 'full' as SkuTierId;
              if (m.includes('9b')) return 'core' as SkuTierId;
              if (m.includes('2b')) return 'lite' as SkuTierId;
              return 'nano' as SkuTierId;
            })();
            setEffectiveTier(TIER_ORDER.includes(effTierRaw) ? effTierRaw : 'nano');
            setAutoDetectedTier(TIER_ORDER.includes(autoTierRaw) ? autoTierRaw : 'nano');
            setOverrideActive(emr.overrideActive ?? false);
            setEffectiveModel(emr.model ?? '');
            setAutoDetectedModel(emr.autoDetectedModel ?? '');
          }
        }

        setPhase('ready');
      } catch {
        if (cancelled) return;
        setPhase('ready');
      }
    })();

    return (): void => {
      cancelled = true;
    };
  }, []);

  // ── Cleanup listeners on unmount ──────────────────────────────────────────

  useEffect(() => {
    return (): void => {
      listenerCleanupRef.current?.();
    };
  }, []);

  // ── Start upgrade ─────────────────────────────────────────────────────────

  const startUpgrade = useCallback((): void => {
    if (upgradeActiveRef.current) return;
    upgradeActiveRef.current = true;

    setPhase('upgrading');
    setProgress(null);
    setErrorMsg(null);
    setStallWarning(false);
    lastProgressTimeRef.current = Date.now();

    // Clean up any previous listeners
    listenerCleanupRef.current?.();

    const unsubProgress = window.amplify.sku?.onPullProgress((data: SkuPullProgress): void => {
      lastProgressTimeRef.current = Date.now();
      setProgress(data);
    }) ?? ((): void => {});

    const unsubComplete = window.amplify.sku?.onPullComplete((): void => {
      upgradeActiveRef.current = false;
      setCurrentTier('full');
      setPhase('complete');
      analytics?.track('feather_earned', { color: 'black', reason: 'full_sku_upgrade_completed' });
      // Durably record the black crow feather in Supabase crow_feathers table.
      void (async (): Promise<void> => {
        try {
          const session = await window.amplify.lbGetSession?.();
          const userId = session?.user_id ?? '';
          await window.amplify.earnBlackCrowFeather?.({ userId, reason: 'full_sku_upgrade_completed' });
        } catch {
          // Non-fatal: analytics track already fired; feather record failure is logged in main process.
        }
      })();
      onUpgradeComplete?.();
    }) ?? ((): void => {});

    const unsubError = window.amplify.sku?.onPullError((err: string): void => {
      upgradeActiveRef.current = false;
      setErrorMsg(err || 'Upgrade failed. Check your connection and try again.');
      setPhase('error');
    }) ?? ((): void => {});

    listenerCleanupRef.current = (): void => {
      unsubProgress();
      unsubComplete();
      unsubError();
    };

    // Extension point: replace sku.upgradeTo() with sku.upgradeFromPeer(peerId)
    // when mesh weight-share is implemented. Same progress/complete/error contract.
    void window.amplify.sku?.upgradeTo('full').catch((err: unknown): void => {
      upgradeActiveRef.current = false;
      setErrorMsg(err instanceof Error ? err.message : 'Could not start upgrade.');
      setPhase('error');
    });
  }, [analytics, onUpgradeComplete]);

  // ── Cancel upgrade ────────────────────────────────────────────────────────

  const handleCancel = useCallback((): void => {
    upgradeActiveRef.current = false;
    listenerCleanupRef.current?.();
    listenerCleanupRef.current = null;
    void window.amplify.sku?.cancelUpgrade().catch((): void => {});
    setPhase('ready');
    setProgress(null);
    setErrorMsg(null);
  }, []);

  // ── Retry ─────────────────────────────────────────────────────────────────

  const handleRetry = useCallback((): void => {
    upgradeActiveRef.current = false;
    startUpgrade();
  }, [startUpgrade]);

  // ── M18b: Restore auto (delete right-size.json override) ──────────────────

  const handleRestoreAuto = useCallback((): void => {
    void (async (): Promise<void> => {
      try {
        await (window.amplify as unknown as { invoke?: (ch: string) => Promise<unknown> }).invoke?.('hardware:reset-model');
        setOverrideActive(false);
        setEffectiveTier(autoDetectedTier);
        setEffectiveModel(autoDetectedModel);
      } catch { /* Non-fatal */ }
    })();
  }, [autoDetectedTier, autoDetectedModel]);

  // ── Tile click: scale-flash feedback then flip to back face ───────────────

  const handleTileClick = useCallback((tierId: SkuTierId): void => {
    setClickedTile(tierId);
    setTimeout((): void => {
      setClickedTile(null);
      setFlipped(true);
    }, 180);
  }, []);

  // ── Activate FULL (model already present -- skip download UI) ─────────────
  // Calls sku-upgrade-to directly; expects near-instant tier write, no pull.

  const activateFull = useCallback((): void => {
    if (upgradeActiveRef.current) return;
    upgradeActiveRef.current = true;

    setPhase('upgrading');
    setProgress(null);
    setErrorMsg(null);
    setStallWarning(false);

    // Register complete/error listeners so the pull-complete event (fired by
    // main when it detects the model already exists) is handled correctly.
    listenerCleanupRef.current?.();

    const unsubComplete = window.amplify.sku?.onPullComplete((): void => {
      upgradeActiveRef.current = false;
      setCurrentTier('full');
      setPhase('complete');
      analytics?.track('feather_earned', { color: 'black', reason: 'full_sku_activate_existing' });
      void (async (): Promise<void> => {
        try {
          const session = await window.amplify.lbGetSession?.();
          const userId = session?.user_id ?? '';
          await window.amplify.earnBlackCrowFeather?.({ userId, reason: 'full_sku_activate_existing' });
        } catch { /* Non-fatal */ }
      })();
      onUpgradeComplete?.();
    }) ?? ((): void => {});

    const unsubError = window.amplify.sku?.onPullError((err: string): void => {
      upgradeActiveRef.current = false;
      setErrorMsg(err || 'Activation failed. Try again.');
      setPhase('error');
    }) ?? ((): void => {});

    listenerCleanupRef.current = (): void => {
      unsubComplete();
      unsubError();
    };

    void window.amplify.sku?.upgradeTo('full').catch((err: unknown): void => {
      upgradeActiveRef.current = false;
      setErrorMsg(err instanceof Error ? err.message : 'Could not activate FULL.');
      setPhase('error');
    });
  }, [analytics, onUpgradeComplete]);

  // ── 30s stall watchdog ────────────────────────────────────────────────────
  // If downloading and no progress event arrives for >30s, re-check model.
  // If it now exists, treat as success. Otherwise surface a non-fatal warning.

  useEffect(() => {
    if (phase !== 'upgrading' || modelExists) return;

    const STALL_MS = 30_000;
    const id = setInterval((): void => {
      const elapsed = Date.now() - lastProgressTimeRef.current;
      if (elapsed < STALL_MS) return;

      void (async (): Promise<void> => {
        try {
          const result = await (window.amplify.sku?.checkModel('gemma4:12b') ?? Promise.resolve({ exists: false, modelName: 'gemma4:12b' }));
          if (result.exists) {
            // Model finished in background -- treat as success
            clearInterval(id);
            listenerCleanupRef.current?.();
            listenerCleanupRef.current = null;
            upgradeActiveRef.current = false;
            setModelExists(true);
            setCurrentTier('full');
            setPhase('complete');
            onUpgradeComplete?.();
          } else {
            setStallWarning(true);
          }
        } catch { /* Non-fatal -- leave warning off */ }
      })();
    }, 5_000);

    return (): void => { clearInterval(id); };
  }, [phase, modelExists, onUpgradeComplete]);

  // ── Progress values ───────────────────────────────────────────────────────

  const fraction = progress ? progressFraction(progress.downloaded, progress.total) : 0;
  const pct = Math.round(fraction * 100);
  const unknownTotal = !progress || progress.total <= 0;
  const downloadedLabel = progress && progress.downloaded > 0
    ? `${bytesToGB(progress.downloaded)} GB`
    : '0.0 GB';
  const totalLabel = unknownTotal ? '...' : `${bytesToGB(progress?.total ?? 0)} GB`;

  // ── Render ────────────────────────────────────────────────────────────────

  const isUpgrading = phase === 'upgrading';

  return (
    <>
      <style>{SPIN_KEYFRAMES}</style>
      <div style={S.panel}>

        {/* Header */}
        <div style={S.sectionLabel}>Caithedral AI Tier</div>

        {/* M18b: Tier banner */}
        <div style={S.tierBanner}>
          Current AI tier: <strong>{effectiveTier.toUpperCase()}</strong>
          {overrideActive
            ? ` (Override: ${effectiveModel})`
            : effectiveModel ? ` (${effectiveModel})` : ''}
        </div>

        {/* M18b: Override warning chip */}
        {overrideActive && (
          <div style={S.overrideWarningChip}>
            <span>⚠ Override active · right-size.json → <strong>{effectiveModel}</strong> · Auto: {autoDetectedModel}</span>
            <button type="button" style={S.restoreAutoBtn} onClick={handleRestoreAuto}>
              Restore auto
            </button>
          </div>
        )}

        {/* Tier grid — 3D flip scene (curiosity-reward UX, SEG-V0145-3) */}
        <div style={{ perspective: '1200px', marginBottom: 20 }}>
          {/* Flipper */}
          <div style={{
            position: 'relative',
            transformStyle: 'preserve-3d',
            transition: 'transform 600ms ease-in-out',
            transform: flipped ? 'rotateY(180deg)' : 'none',
          }}>

            {/* ── Front face: tier cards ── */}
            <div style={{ backfaceVisibility: 'hidden' }}>
              <div style={{ ...S.tiersGrid, marginBottom: 0 }}>
                {SKU_TIERS.map((tier) => {
                  const tileState = getTileState(tier.id, effectiveTier, autoDetectedTier);
                  const isActive = tileState === 'active';
                  const isDimmed = tileState === 'insufficient' || (isUpgrading && !isActive);
                  const isClicked = clickedTile === tier.id;
                  const isInsufficient = tileState === 'insufficient';
                  const isChallengeDestiny = tileState === 'challenge-destiny';

                  // M18b: dynamic model name for tile
                  const displayModel = (isActive && overrideActive)
                    ? `${effectiveModel} (Override active)`
                    : TIER_MODEL_MAP[tier.id];

                  const tileClickStyle: React.CSSProperties = {
                    cursor: isInsufficient ? 'not-allowed' : 'pointer',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease, opacity 0.2s',
                    transform: isClicked ? 'scale(0.96)' : 'scale(1)',
                    boxShadow: isClicked ? '0 0 0 2px rgba(110,231,183,0.5)' : 'none',
                    opacity: isDimmed ? 0.45 : 1,
                  };

                  return (
                    <div
                      key={tier.id}
                      title={isInsufficient ? 'Hardware limit — insufficient RAM/VRAM' : undefined}
                      style={{
                        ...S.tierCard(isActive, isDimmed),
                        ...tileClickStyle,
                      }}
                      onClick={() => !isInsufficient && handleTileClick(tier.id)}
                    >
                      {/* Badge row */}
                      {isActive && <div style={S.activeBadge}>Active</div>}
                      {isChallengeDestiny && <div style={S.challengeDestinyBadge}>⚠ Override available</div>}

                      <div style={S.tierName}>{tier.name}</div>
                      <div style={S.tierTagline}>{tier.tagline}</div>

                      {/* Features */}
                      {tier.features.length > 0 && (
                        <div>
                          {tier.features.map((f) => (
                            <div key={f} style={S.tierFeature}>
                              <span style={{ color: isActive ? '#4ade80' : '#475569', flexShrink: 0 }}>+</span>
                              <span style={{ color: isActive ? '#94a3b8' : undefined }}>{f}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* M18b: dynamic model name */}
                      <div style={{ ...S.modelSizeLabel, color: isActive ? '#6ee7b7' : '#334155' }}>
                        {displayModel}
                      </div>

                      {/* Action buttons */}
                      {!isActive && !isInsufficient && phase === 'ready' && tier.id === 'full' && (
                        modelExists ? (
                          <button
                            type="button"
                            style={S.activateBtn}
                            onClick={(e) => { e.stopPropagation(); handleTileClick(tier.id); activateFull(); }}
                          >
                            Activate FULL
                          </button>
                        ) : (
                          <button
                            type="button"
                            style={S.upgradeBtn}
                            onClick={(e) => { e.stopPropagation(); handleTileClick(tier.id); startUpgrade(); }}
                          >
                            Upgrade to FULL — ~7 GB
                          </button>
                        )
                      )}
                      {isChallengeDestiny && phase === 'ready' && (
                        <button
                          type="button"
                          style={S.challengeDestinyBtn}
                          onClick={(e) => { e.stopPropagation(); handleTileClick(tier.id); }}
                        >
                          Challenge Destiny ⚠
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Back face: benchmark data + feature table + explainer ── */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              background: '#0d1117',
            }}>
              {/* Benchmark comparison */}
              <div style={{
                background: '#111827',
                border: '1px solid rgba(100,116,139,0.2)',
                borderRadius: 10,
                padding: '12px 14px',
                marginBottom: 10,
              }}>
                <div style={{ ...S.sectionLabel, marginBottom: 8 }}>
                  Tier comparison — MMLU-Pro · Caithedral Core applied
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 4, fontSize: 10, color: '#334155', fontFamily: 'monospace' }}>
                  <span style={{ flex: 1 }}>Tier (model)</span>
                  <span style={{ minWidth: 30 }}>Base</span>
                  <span style={{ minWidth: 8 }} />
                  <span style={{ minWidth: 30 }}>+Core</span>
                  <span style={{ minWidth: 44 }}>Gain</span>
                </div>
                {[
                  { name: 'NANO', model: 'qwen2.5:0.5b', base: '6%',  boosted: '78%', gain: '+72pp' },
                  { name: 'CORE', model: 'phi4:14b',      base: '31%', boosted: '89%', gain: '+58pp' },
                  { name: 'LITE', model: 'gemma4:4b',     base: '48%', boosted: '91%', gain: '+43pp' },
                  { name: 'FULL', model: 'gemma4:12b',    base: '63%', boosted: '94%', gain: '+31pp', isBest: true },
                ].map((row) => (
                  <div key={row.name} style={{ display: 'flex', gap: 6, marginBottom: 3, fontSize: 11, fontFamily: 'monospace', alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 800, color: '#e2e8f0', minWidth: 36 }}>{row.name}</span>
                    <span style={{ color: '#334155', flex: 1, fontSize: 10 }}>({row.model})</span>
                    <span style={{ color: '#64748b', minWidth: 30 }}>{row.base}</span>
                    <span style={{ color: '#475569', minWidth: 8 }}>→</span>
                    <span style={{ color: '#4ade80', fontWeight: 700, minWidth: 30 }}>{row.boosted}</span>
                    <span style={{ color: '#6ee7b7', fontSize: 10, minWidth: 44 }}>
                      ({row.gain}){row.isBest ? ' ★' : ''}
                    </span>
                  </div>
                ))}
                <div style={{ fontSize: 10, color: '#1e293b', marginTop: 6 }}>
                  BP074 · Cohen's Kappa 1.000 · Banyan Metric™
                </div>
              </div>

              {/* Feature comparison table */}
              <div style={{
                background: '#111827',
                border: '1px solid rgba(100,116,139,0.2)',
                borderRadius: 10,
                padding: '12px 14px',
                marginBottom: 10,
                fontFamily: 'monospace',
                fontSize: 11,
              }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 5, paddingBottom: 5, borderBottom: '1px solid rgba(100,116,139,0.15)' }}>
                  <span style={{ color: '#334155', flex: 1, fontSize: 10 }}>Feature</span>
                  {(['NANO', 'CORE', 'LITE', 'FULL'] as const).map((t) => (
                    <span key={t} style={{ color: '#475569', minWidth: 36, textAlign: 'center' as const, fontSize: 10, fontWeight: 700 }}>{t}</span>
                  ))}
                </div>
                {[
                  { feature: 'Local model',     nano: '✓', core: '✓', lite: '✓',  full: '✓'  },
                  { feature: 'Caithedral Core', nano: '✓', core: '✓', lite: '✓',  full: '✓'  },
                  { feature: 'Context depth',   nano: '4K', core: '8K', lite: '16K', full: '32K' },
                  { feature: 'Mesh capable',    nano: '✗', core: '✓', lite: '✓',  full: '✓'  },
                ].map((row) => (
                  <div key={row.feature} style={{ display: 'flex', gap: 4, marginBottom: 3, alignItems: 'baseline' }}>
                    <span style={{ color: '#475569', flex: 1 }}>{row.feature}</span>
                    {([row.nano, row.core, row.lite, row.full] as const).map((val, i) => (
                      <span key={i} style={{
                        minWidth: 36,
                        textAlign: 'center' as const,
                        color: val === '✓' ? '#4ade80' : val === '✗' ? '#ef4444' : '#94a3b8',
                        fontWeight: i === 3 ? 700 : undefined,
                      }}>{val}</span>
                    ))}
                  </div>
                ))}
              </div>

              {/* Substrate depth explainer */}
              <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.7, marginBottom: 10 }}>
                Caithedral Core applies your personal substrate to every query. Higher tiers retain more context — your AI gets smarter the more you use it.
              </div>

              {/* Flip back CTA */}
              <button
                type="button"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'rgba(100,116,139,0.1)',
                  border: '1px solid rgba(100,116,139,0.25)',
                  borderRadius: 7,
                  color: '#94a3b8',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'center' as const,
                }}
                onClick={() => setFlipped(false)}
              >
                ← Back to tiers
              </button>
            </div>

          </div>
        </div>

        {/* Upgrading progress panel */}
        {phase === 'upgrading' && (
          <div style={{
            background: '#111827',
            border: '1px solid rgba(100,116,139,0.2)',
            borderRadius: 10,
            padding: '16px 14px 12px',
          }}>
            {/* Model-exists fast path: skip download bar, show activation copy */}
            {modelExists && (progress === null || progress.total === 0) ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 10,
              }}>
                <span style={S.spinnerStyle} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
                  Using your existing gemma4:12b
                </span>
              </div>
            ) : (
              <>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 10,
                }}>
                  <span style={S.spinnerStyle} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
                    Downloading gemma4:12b
                  </span>
                </div>

                {/* Progress bar */}
                <div style={S.progressTrack}>
                  <div style={{
                    height: '100%',
                    width: unknownTotal ? '0%' : `${pct}%`,
                    background: '#6ee7b7',
                    borderRadius: 3,
                    transition: 'width 0.4s ease',
                  }} />
                </div>

                {/* GB + percent */}
                <div style={S.progressRow}>
                  <span>{downloadedLabel} / {unknownTotal ? '?' : totalLabel}</span>
                  <span>{unknownTotal ? '...' : `${pct}%`}</span>
                </div>

                {/* Speed */}
                {progress?.speed && (
                  <div style={{ fontSize: 11, color: '#475569', marginBottom: 3 }}>
                    {progress.speed}
                  </div>
                )}

                {/* Raw ollama status */}
                {progress?.status && (
                  <div style={{ fontSize: 10, color: '#334155', marginBottom: 8, lineHeight: 1.5 }}>
                    {progress.status}
                  </div>
                )}
              </>
            )}

            {stallWarning && (
              <div style={{
                marginBottom: 8,
                padding: '8px 10px',
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: 7,
                fontSize: 11,
                color: '#fcd34d',
                lineHeight: 1.6,
              }}>
                Download may have stalled.
                <button
                  type="button"
                  style={{ ...S.retryBtn, marginTop: 6 }}
                  onClick={handleRetry}
                >
                  Retry
                </button>
              </div>
            )}
            <button type="button" style={S.cancelBtn} onClick={handleCancel}>
              Cancel
            </button>
            <button type="button" style={S.ghostBtn} onClick={handleCancel}>
              Continue using NANO meanwhile
            </button>
          </div>
        )}

        {/* Complete */}
        {phase === 'complete' && (
          <div style={S.successBox}>
            <CheckIcon />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#4ade80', marginBottom: 3 }}>
                FULL activated.
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                Google's Gemma 4 12B is now your AI.
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div>
            <div style={S.errorBox}>
              {errorMsg ?? 'Upgrade failed. Check your connection and try again.'}
            </div>
            <button type="button" style={S.retryBtn} onClick={handleRetry}>
              Retry
            </button>
            <button type="button" style={S.cancelBtn} onClick={handleCancel}>
              Cancel
            </button>
          </div>
        )}

        {/* Checking state */}
        {phase === 'checking' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: '#475569',
            padding: '4px 0',
          }}>
            <span style={S.spinnerStyle} />
            <span>Loading tier info...</span>
          </div>
        )}

      </div>
    </>
  );
}

export default SkuUpgradePanel;
