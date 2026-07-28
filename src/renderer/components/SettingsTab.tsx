// SettingsTab -- MnemosyneC CAI Amplifier Settings
// Tab 4 (always visible) -- BP047 W1
// SEG-R-2/3/4/5/6/7/12: restructured -- new top-level cards, AI Power Tier, Memory Depth Tier, Advanced collapsible
// Order: App Version | AI Capability | Cooperative Membership | AI Power Tier (+ model assign) | Memory Depth Tier | Advanced | Appearance | Substrate | Developer | Research | Contribution | Folders | Grand Projects
// KniPr034: My Contribution panel added -- read-only scaffold, data binding next wave
// BP077 v0.1.27: Mnem-DRT panel added (MnemosyneC Mnem-as-interface)
// BP078: SkuUpgradePanel wired into AI Power Tier section

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { AuthState } from '../amplify.d';
import { LocFaqModal } from './LocFaqPanel';
import { SkuUpgradePanel } from './SkuUpgradePanel';
import { useLifecycleStage } from '../hooks/useLifecycleStage';
import { ShareMnemosyneC } from './ShareMnemosyneC';
import { SubstrateAwakensJoinPanel } from './SubstrateAwakensJoinPanel';
// BP137 Yoke v2b Stage C ("Chrome-MCP Nexus Authority") -- new, self-contained settings
// section (own state, own persistence via nexus_authority_settings_store.ts). See that
// component's file header for the full Bishop-audit rationale.
import { NexusAuthoritySettings } from '../settings/NexusAuthoritySettings';

interface SettingsTabProps {
  authState: AuthState | null;
  onDevModeToggle?: (enabled: boolean) => void;
  devEnabled?: boolean;
  // SEG-UX-2: scroll-to-anchor target from pill modal "Open AI Tier in Settings"
  scrollTo?: string | null;
  onScrollConsumed?: () => void;
}

type Theme = 'dark' | 'light' | 'system';
type SubstrateMode = 'ai_burst' | 'normal' | 'fallback';
type ModelAssignment = 'ollama_local' | 'anthropic_cloud' | 'manual';

interface UpdateStatus {
  checking: boolean;
  upToDate: boolean | null;
  currentVersion: string;
  latestVersion: string | null;
  error: string | null;
}

interface PieceModels {
  bishop: ModelAssignment;
  knight: ModelAssignment;
  pawn: ModelAssignment;
  rook: ModelAssignment;
}

// ─── Chronos Research Consent (KniPr038) ────────────────────────────────────

interface ChronosConsent {
  enabled: boolean;
  consentTimestamp?: string;
  consentEbletPath?: string;
  actionClasses: {
    stamping: boolean;
    voting: boolean;
    recipeCompose: boolean;
    puddingPublish: boolean;
    crownLetterDraft: boolean;
  };
  revocationAvailable: boolean;
}

const DEFAULT_CHRONOS_CONSENT: ChronosConsent = {
  enabled: false,
  actionClasses: {
    stamping: false,
    voting: false,
    recipeCompose: false,
    puddingPublish: false,
    crownLetterDraft: false,
  },
  revocationAvailable: true,
};

const ACTION_CLASS_LABELS: Array<{ key: keyof ChronosConsent['actionClasses']; label: string }> = [
  { key: 'stamping',        label: 'Stamping & attestation' },
  { key: 'voting',          label: 'Voting & signal actions' },
  { key: 'recipeCompose',   label: 'Recipe composition' },
  { key: 'puddingPublish',  label: 'Content publishing' },
  { key: 'crownLetterDraft', label: 'Crown letter drafting' },
];

function loadChronosConsent(): ChronosConsent {
  try {
    const raw = localStorage.getItem('mnemo_chronos_consent');
    if (raw) return { ...DEFAULT_CHRONOS_CONSENT, ...JSON.parse(raw) };
  } catch { /* fall through */ }
  return { ...DEFAULT_CHRONOS_CONSENT };
}

function saveChronosConsent(c: ChronosConsent): void {
  localStorage.setItem('mnemo_chronos_consent', JSON.stringify(c));
}

function ChronosResearchPanel() {
  const [consent, setConsent] = useState<ChronosConsent>(loadChronosConsent);
  const [showModal, setShowModal] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);

  async function handleMasterToggle() {
    const next = !consent.enabled;
    const ts = new Date().toISOString();

    if (next) {
      // Turn ON — write signed consent Eblet via IPC
      const updated: ChronosConsent = {
        ...consent,
        enabled: true,
        consentTimestamp: ts,
      };
      setWriteError(null);
      try {
        const result = await (window as any).amplify?.writeChronosConsent?.({
          consent: updated,
          timestamp: ts,
        });
        if (result?.ok) {
          updated.consentEbletPath = result.ebletPath;
        }
      } catch (e) {
        setWriteError('Could not write consent Eblet · check permissions.');
      }
      setConsent(updated);
      saveChronosConsent(updated);
    } else {
      // Turn OFF — just disable in localStorage (use Revoke for full retraction)
      const updated: ChronosConsent = { ...consent, enabled: false };
      setConsent(updated);
      saveChronosConsent(updated);
    }
  }

  async function handleRevoke() {
    setRevoking(true);
    setWriteError(null);
    try {
      await (window as any).amplify?.revokeChronosConsent?.({
        originalConsentTs: consent.consentTimestamp,
      });
    } catch (e) {
      setWriteError('Revocation write failed · check permissions.');
    }
    const cleared: ChronosConsent = {
      ...DEFAULT_CHRONOS_CONSENT,
      revocationAvailable: true,
    };
    setConsent(cleared);
    saveChronosConsent(cleared);
    setRevoking(false);
  }

  function handleActionClass(key: keyof ChronosConsent['actionClasses'], val: boolean) {
    const updated: ChronosConsent = {
      ...consent,
      actionClasses: { ...consent.actionClasses, [key]: val },
    };
    setConsent(updated);
    saveChronosConsent(updated);
  }

  const s = styles;
  const cs = chronosStyles;

  return (
    <section style={s.section}>
      <div style={s.sectionHeader}>🔬 Research Participation</div>

      <div style={s.card}>
        {/* Master toggle row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>
              Chronos Research
            </div>
            <div style={cs.desc}>
              Chronos Research lets your MnemosyneC help everyone · anonymously. You keep control. The cooperative gets smarter.{' '}
              <button onClick={() => setShowModal(true)} style={{ ...cs.learnMoreBtn, display: 'inline' }}>
                [Learn more]
              </button>
              <br />
              <span style={cs.kNote}>Your data only joins the pool when at least 10 other members took the same action.</span>
            </div>
          </div>
          <button
            onClick={handleMasterToggle}
            style={{
              ...s.chip,
              minWidth: 38,
              ...(consent.enabled ? { ...s.chipActive, color: '#6ee7b7', borderColor: 'rgba(110,231,183,0.4)' } : {}),
            }}
          >
            {consent.enabled ? 'ON' : 'OFF'}
          </button>
        </div>

        {writeError && (
          <div style={{ fontSize: 9, color: '#f87171', marginTop: 6 }}>{writeError}</div>
        )}

        {/* Per-action-class checkboxes — only when master is ON */}
        {consent.enabled && (
          <>
            <div style={cs.divider} />
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6 }}>
              Choose which action types to include:
            </div>
            {ACTION_CLASS_LABELS.map(({ key, label }) => (
              <label key={key} style={cs.checkRow}>
                <input
                  type="checkbox"
                  checked={consent.actionClasses[key]}
                  onChange={(e) => handleActionClass(key, e.target.checked)}
                  style={cs.checkbox}
                />
                <span style={cs.checkLabel}>{label}</span>
              </label>
            ))}
          </>
        )}

        <div style={cs.divider} />

        {/* Footer: revoke + learn more */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
          <button
            onClick={handleRevoke}
            disabled={revoking}
            style={{ ...cs.revokeBtn, opacity: revoking ? 0.6 : 1 }}
          >
            {revoking ? 'Revoking…' : 'Revoke participation'}
          </button>
          <button
            onClick={() => setShowModal(true)}
            style={cs.learnMoreBtn}
          >
            What is Chronos? →
          </button>
        </div>

        {consent.enabled && consent.consentTimestamp && (
          <div style={{ fontSize: 9, color: '#475569', marginTop: 6 }}>
            Opted in: {new Date(consent.consentTimestamp).toLocaleDateString()}
            {consent.consentEbletPath && (
              <span style={{ marginLeft: 6 }}>· Eblet written</span>
            )}
          </div>
        )}
      </div>

      <div style={cs.revokeNote}>
        [Revoke participation] removes your consent Eblet and clears future data collection.
        Prior anonymized data cannot be recalled from the aggregation corpus.
      </div>

      {/* Chronos info modal */}
      {showModal && (
        <div style={cs.modalOverlay} onClick={() => setShowModal(false)}>
          <div style={cs.modal} onClick={(e) => e.stopPropagation()}>
            <div style={cs.modalTitle}>What is Chronos?</div>
            <div style={cs.modalBody}>
              <p>
                <strong>Chronos</strong> is the Liana Banyan cooperative's research telemetry layer.
                Every action you take (stamping, voting, composing recipes, etc.) carries a
                timestamped, sha256-signed observation · the Chronos tab.
              </p>
              <p>
                When you opt in, anonymized versions of these observations are contributed to
                the cooperative's research corpus. Academic institutions, policy bodies, and
                cooperative-class research projects may license this aggregated data.
              </p>
              <p>
                <strong>k-anonymity = 10:</strong> your data only enters an aggregation when
                at least 10 other members performed the same action class. Your identity is
                never linkable across queries — member IDs rotate per query family.
              </p>
              <p>
                Revenue from data licensing returns to opted-in members as <strong>Banyan Mark dividends</strong>,
                distributed quarterly through the cooperative treasury.
              </p>
              <p>
                You may revoke at any time. Future emissions stop immediately. The cooperative
                cannot recall prior anonymized contributions from the aggregation corpus, but
                your revocation Eblet is sha256-logged as a cryptographic commitment.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
              <button
                onClick={() => (window as any).amplify?.openExternal?.('https://cephas.lianabanyan.com/chronos')}
                style={cs.learnMoreBtn}
              >
                Full Chronos docs →
              </button>
              <button onClick={() => setShowModal(false)} style={{ ...s.btn }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

const chronosStyles = {
  desc: {
    fontSize: 9,
    color: '#64748b',
    lineHeight: 1.6,
    marginBottom: 4,
  },
  kNote: {
    color: '#475569',
    fontStyle: 'italic' as const,
  },
  divider: {
    height: 1,
    background: 'rgba(100,116,139,0.12)',
    margin: '8px 0',
  },
  checkRow: {
    display: 'flex' as const,
    alignItems: 'center',
    gap: 7,
    marginBottom: 5,
    cursor: 'pointer',
  },
  checkbox: {
    width: 12,
    height: 12,
    accentColor: '#6ee7b7',
    cursor: 'pointer',
  } as React.CSSProperties,
  checkLabel: {
    fontSize: 10,
    color: '#94a3b8',
  },
  revokeBtn: {
    background: 'none',
    border: '1px solid rgba(248,113,113,0.25)',
    borderRadius: 5,
    color: '#f87171',
    fontSize: 9,
    fontWeight: 500,
    padding: '3px 9px',
    cursor: 'pointer',
  } as React.CSSProperties,
  learnMoreBtn: {
    background: 'none',
    border: 'none',
    color: '#6ee7b7',
    fontSize: 9,
    cursor: 'pointer',
    padding: 0,
    fontWeight: 500,
    textDecoration: 'underline',
    textDecorationColor: 'rgba(110,231,183,0.35)',
  } as React.CSSProperties,
  revokeNote: {
    fontSize: 9,
    color: '#475569',
    marginTop: 5,
    fontStyle: 'italic' as const,
    lineHeight: 1.5,
  },
  modalOverlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modal: {
    background: 'rgba(15,23,42,0.98)',
    border: '1px solid rgba(100,116,139,0.3)',
    borderRadius: 10,
    padding: '18px 20px',
    maxWidth: 360,
    width: '90%',
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
  },
  modalTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#e2e8f0',
    marginBottom: 10,
  },
  modalBody: {
    fontSize: 10,
    color: '#94a3b8',
    lineHeight: 1.7,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
};

// TODO KniPr034-next: wire to Chronos aggregation IPC + Trail Eblet count from ~/.claude/state/eblets/TRAILS/
interface ContributionStats {
  ebletsContributed: number;
  marksEarned: number;
  patronageProjected: number;
  privacyBudgetRemaining: number;
  codeBreaker: {
    eligible: boolean;
    tier: 'none' | 'apprentice' | 'master';
    progress: {
      easy: number;
      moderate: number;
      strenuous: number;
      veryStrenuous: number;
      extreme: number;
    };
  };
}

const PLACEHOLDER_STATS: ContributionStats = {
  ebletsContributed: 0,
  marksEarned: 0,
  patronageProjected: 0,
  privacyBudgetRemaining: 100,
  codeBreaker: {
    eligible: false,
    tier: 'none',
    progress: { easy: 0, moderate: 0, strenuous: 0, veryStrenuous: 0, extreme: 0 },
  },
};

// ─── KniPr037: Code Breaker guild entry tracking ────────────────────────────

type CodeBreakerTier = 'none' | 'apprentice' | 'master';

function computeTier(stats: ContributionStats): CodeBreakerTier {
  const { easy, moderate, strenuous, veryStrenuous, extreme } = stats.codeBreaker.progress;
  const weightedMarks = easy * 10 + moderate * 25 + strenuous * 60 + veryStrenuous * 140 + extreme * 141;
  const apprenticeEligible = easy >= 10 && moderate >= 5 && strenuous >= 2 && veryStrenuous >= 1 && weightedMarks >= 61;
  const masterEligible = weightedMarks >= 250 && (extreme >= 1 || veryStrenuous >= 3);
  if (masterEligible) return 'master';
  if (apprenticeEligible) return 'apprentice';
  return 'none';
}

function MyContributionPanel() {
  // [PLACEHOLDER: IPC data binding for Marks ledger — next session]
  const stats = PLACEHOLDER_STATS;
  const [showTooltip, setShowTooltip] = useState(false);

  const { easy, moderate, strenuous, veryStrenuous, extreme } = stats.codeBreaker.progress;
  const weightedMarks = easy * 10 + moderate * 25 + strenuous * 60 + veryStrenuous * 140 + extreme * 141;
  const tier = computeTier(stats);

  const apprenticeGoal = 61;
  const masterGoal = 250;
  const apprenticePct = Math.min(100, Math.round((weightedMarks / apprenticeGoal) * 100));
  const masterPct = Math.min(100, Math.round((weightedMarks / masterGoal) * 100));
  const apprenticeEligible = easy >= 10 && moderate >= 5 && strenuous >= 2 && veryStrenuous >= 1 && weightedMarks >= 61;

  const s = styles;
  const cb = cbStyles;

  return (
    <section style={s.section}>
      <div style={s.sectionHeader}>★ My Contribution</div>

      <div style={s.card}>
        {/* Eblets + Marks */}
        <div style={contribStyles.row}>
          <span style={contribStyles.rowLabel}>Eblets contributed</span>
          <span style={contribStyles.rowValue}>{stats.ebletsContributed}</span>
        </div>
        <div style={contribStyles.row}>
          <span style={contribStyles.rowLabel}>Weighted Marks earned</span>
          <span style={contribStyles.rowValue}>{stats.marksEarned}</span>
        </div>

        {/* Patronage projection with info tooltip */}
        <div style={{ ...contribStyles.row, position: 'relative' }}>
          <span style={contribStyles.rowLabel}>
            Quarterly patronage projection
            <span
              style={contribStyles.infoIcon}
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              aria-label="About patronage projection"
            >
              ℹ
            </span>
            {showTooltip && (
              <div style={contribStyles.tooltip}>
                Marks earn patronage dividends once the cooperative treasury is established.
                Actual amounts depend on platform revenue and member participation.
              </div>
            )}
          </span>
          <span style={contribStyles.rowValue}>
            ${stats.patronageProjected.toFixed(2)}{' '}
            <span style={contribStyles.dimNote}>(projected, not guaranteed)</span>
          </span>
        </div>

        {/* Privacy budget */}
        <div style={contribStyles.row}>
          <span style={contribStyles.rowLabel}>Privacy budget remaining</span>
          <span style={contribStyles.rowValue}>{stats.privacyBudgetRemaining}%</span>
        </div>

        <div style={contribStyles.divider} />

        {/* ── Code Breaker Guild Entry (KniPr037) ─────────────────────────── */}
        <div style={{ marginBottom: 8 }}>
          <div style={cb.sectionTitle}>Code Breaker Guild Entry</div>

          {/* Weighted Mark calculator */}
          <div style={cb.calcBox}>
            <div style={cb.calcTotal}>
              Weighted Marks:{' '}
              <span style={cb.calcTotalValue}>{weightedMarks}</span>
            </div>
            <div style={cb.calcDivider} />
            {([
              { label: 'Easy (×10)',            count: easy,         weight: 10  },
              { label: 'Moderate (×25)',         count: moderate,     weight: 25  },
              { label: 'Strenuous (×60)',        count: strenuous,    weight: 60  },
              { label: 'Very Strenuous (×140)',  count: veryStrenuous,weight: 140 },
              { label: 'Extreme (×141)',         count: extreme,      weight: 141 },
            ] as const).map(({ label, count, weight }) => (
              <div key={label} style={cb.calcRow}>
                <span style={cb.calcLabel}>{label}:</span>
                <span style={cb.calcFormula}>
                  {count} × {weight} = {count * weight}
                </span>
              </div>
            ))}
          </div>

          {/* Tier badge */}
          <div style={cb.tierRow}>
            <span style={cb.tierLabel}>Code Breaker Tier:</span>
            <span style={{
              ...cb.tierBadge,
              ...(tier === 'master' ? cb.tierMaster : tier === 'apprentice' ? cb.tierApprentice : cb.tierNone),
            }}>
              {tier === 'master' ? 'Master' : tier === 'apprentice' ? 'Apprentice' : 'None'}
            </span>
          </div>

          {/* Progress toward Apprentice */}
          {tier === 'none' && (
            <div style={cb.progressSection}>
              <div style={cb.progressLabel}>
                Next tier: Apprentice{' '}
                <span style={cb.progressGoal}>(61 Marks needed)</span>
              </div>
              <div style={cb.reqNote}>
                Requirements: 10 Easy + 5 Moderate + 2 Strenuous + 1 Very-Strenuous
              </div>
              <div style={contribStyles.progressTrack}>
                <div style={{ ...contribStyles.progressFill, width: `${apprenticePct}%` }} />
              </div>
              <div style={cb.progressCount}>
                {weightedMarks} / 61 Marks
              </div>
              <div style={cb.masterNote}>
                After Apprentice → Master Code Breaker requires 250 Marks
                + 1 Extreme completion OR 3 Very-Strenuous substitute
              </div>
            </div>
          )}

          {/* Progress toward Master (once Apprentice) */}
          {tier === 'apprentice' && (
            <div style={cb.progressSection}>
              <div style={cb.progressLabel}>
                Progress toward Master{' '}
                <span style={cb.progressGoal}>(250 Marks needed)</span>
              </div>
              <div style={contribStyles.progressTrack}>
                <div style={{ ...contribStyles.progressFill, width: `${masterPct}%` }} />
              </div>
              <div style={cb.progressCount}>
                {weightedMarks} / 250 Marks
                {' · '}
                {extreme >= 1
                  ? '✓ Extreme req met'
                  : veryStrenuous >= 3
                  ? '✓ 3×VS req met'
                  : 'Need: 1 Extreme OR 3 Very-Strenuous'}
              </div>
              <div style={cb.masterNote}>
                Master also requires: 1 Extreme completion OR 3 Very-Strenuous substitute
              </div>
            </div>
          )}

          {/* Eligibility indicator — Apprentice threshold hit */}
          {apprenticeEligible && tier === 'none' && (
            <div style={cb.eligibilityBox}>
              <div style={cb.eligibilityCheck}>✓ Code Breaker Apprentice eligibility met!</div>
              <button style={cb.claimBtn} disabled>
                Claim your Apprentice badge →
                <span style={cb.claimNote}> (backend next wave)</span>
              </button>
            </div>
          )}

          {tier === 'apprentice' && (
            <div style={cb.eligibilityBox}>
              <div style={cb.eligibilityCheck}>✓ Apprentice Code Breaker</div>
            </div>
          )}

          {tier === 'master' && (
            <div style={{ ...cb.eligibilityBox, borderColor: 'rgba(251,191,36,0.35)', background: 'rgba(251,191,36,0.05)' }}>
              <div style={{ ...cb.eligibilityCheck, color: '#fbbf24' }}>✓ Master Code Breaker</div>
            </div>
          )}
        </div>

        <div style={contribStyles.divider} />

        {/* Revocation control */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={contribStyles.rowLabel}>Revocation control</span>
          <button
            style={contribStyles.linkBtn}
            onClick={() => (window as any).amplify?.openExternal?.('https://lianabanyan.com/privacy')}
          >
            Manage privacy settings →
          </button>
        </div>
      </div>

      <div style={contribStyles.zeroNote}>
        All zeros = new account. Numbers grow as you contribute Trails and earn Bounties.
      </div>
    </section>
  );
}

const contribStyles = {
  row: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 6,
    flexWrap: 'wrap' as const,
    gap: 4,
  },
  rowLabel: {
    fontSize: 10,
    color: '#64748b',
    position: 'relative' as const,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  },
  rowValue: {
    fontSize: 11,
    fontWeight: 600,
    color: '#e2e8f0',
  },
  dimNote: {
    fontSize: 9,
    fontWeight: 400,
    color: '#475569',
  },
  infoIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 13,
    height: 13,
    borderRadius: '50%',
    background: 'rgba(100,116,139,0.2)',
    border: '1px solid rgba(100,116,139,0.3)',
    color: '#94a3b8',
    fontSize: 8,
    fontWeight: 700,
    cursor: 'default',
    userSelect: 'none' as const,
    lineHeight: 1,
  },
  tooltip: {
    position: 'absolute' as const,
    bottom: '110%',
    left: 0,
    width: 200,
    background: 'rgba(15,23,42,0.97)',
    border: '1px solid rgba(100,116,139,0.3)',
    borderRadius: 6,
    padding: '7px 9px',
    fontSize: 9,
    color: '#94a3b8',
    lineHeight: 1.5,
    zIndex: 100,
    pointerEvents: 'none' as const,
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
  },
  divider: {
    height: 1,
    background: 'rgba(100,116,139,0.12)',
    margin: '8px 0',
  },
  progressTrack: {
    height: 6,
    background: 'rgba(100,116,139,0.15)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #6ee7b7 0%, #34d399 100%)',
    borderRadius: 3,
    transition: 'width 0.4s ease',
    minWidth: 0,
  },
  breakdownRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 3,
    alignItems: 'center',
  },
  breakdownItem: {
    fontSize: 9,
    color: '#64748b',
  },
  breakdownDot: {
    fontSize: 9,
    color: '#334155',
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: '#6ee7b7',
    fontSize: 10,
    cursor: 'pointer',
    padding: 0,
    fontWeight: 500,
    textDecoration: 'underline',
    textDecorationColor: 'rgba(110,231,183,0.35)',
  } as React.CSSProperties,
  zeroNote: {
    fontSize: 9,
    color: '#475569',
    marginTop: 5,
    fontStyle: 'italic',
  },
};

// ─── Code Breaker guild entry styles (KniPr037) ──────────────────────────────
const cbStyles = {
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: '#94a3b8',
    letterSpacing: '0.04em',
    marginBottom: 8,
    textTransform: 'uppercase' as const,
  },
  calcBox: {
    background: 'rgba(100,116,139,0.06)',
    border: '1px solid rgba(100,116,139,0.12)',
    borderRadius: 6,
    padding: '8px 10px',
    marginBottom: 10,
  },
  calcTotal: {
    fontSize: 11,
    fontWeight: 700,
    color: '#e2e8f0',
    marginBottom: 4,
  },
  calcTotalValue: {
    color: '#6ee7b7',
  },
  calcDivider: {
    height: 1,
    background: 'rgba(100,116,139,0.15)',
    margin: '5px 0 6px',
  },
  calcRow: {
    display: 'flex' as const,
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 3,
  },
  calcLabel: {
    fontSize: 9,
    color: '#64748b',
    minWidth: 140,
  },
  calcFormula: {
    fontSize: 9,
    color: '#94a3b8',
    fontVariantNumeric: 'tabular-nums' as const,
  },
  tierRow: {
    display: 'flex' as const,
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  tierLabel: {
    fontSize: 10,
    color: '#64748b',
  },
  tierBadge: {
    fontSize: 10,
    fontWeight: 700,
    borderRadius: 4,
    padding: '2px 8px',
    border: '1px solid',
  } as React.CSSProperties,
  tierNone: {
    color: '#475569',
    borderColor: 'rgba(71,85,105,0.3)',
    background: 'rgba(71,85,105,0.08)',
  } as React.CSSProperties,
  tierApprentice: {
    color: '#6ee7b7',
    borderColor: 'rgba(110,231,183,0.35)',
    background: 'rgba(110,231,183,0.08)',
  } as React.CSSProperties,
  tierMaster: {
    color: '#fbbf24',
    borderColor: 'rgba(251,191,36,0.35)',
    background: 'rgba(251,191,36,0.08)',
  } as React.CSSProperties,
  progressSection: {
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: '#94a3b8',
    marginBottom: 3,
  },
  progressGoal: {
    fontSize: 9,
    fontWeight: 400,
    color: '#475569',
  },
  reqNote: {
    fontSize: 9,
    color: '#64748b',
    marginBottom: 5,
    lineHeight: 1.5,
  },
  progressCount: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 3,
    marginBottom: 4,
  },
  masterNote: {
    fontSize: 9,
    color: '#475569',
    fontStyle: 'italic' as const,
    lineHeight: 1.5,
  },
  eligibilityBox: {
    background: 'rgba(110,231,183,0.05)',
    border: '1px solid rgba(110,231,183,0.25)',
    borderRadius: 6,
    padding: '7px 10px',
    marginTop: 8,
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: 5,
  },
  eligibilityCheck: {
    fontSize: 10,
    fontWeight: 700,
    color: '#6ee7b7',
  },
  claimBtn: {
    background: 'rgba(110,231,183,0.1)',
    border: '1px solid rgba(110,231,183,0.3)',
    borderRadius: 5,
    color: '#6ee7b7',
    fontSize: 10,
    fontWeight: 600,
    padding: '4px 10px',
    cursor: 'not-allowed',
    opacity: 0.7,
    alignSelf: 'flex-start',
  } as React.CSSProperties,
  claimNote: {
    fontSize: 9,
    fontWeight: 400,
    color: '#475569',
  },
};

// ─── BP077 Mnem-DRT Settings ──────────────────────────────────────────────────

type Sku = 'nano' | 'core' | 'lite' | 'full';
type EbletQuota = '10mb' | '100mb' | '1gb' | 'unlimited';

interface MnemDrtSettings {
  sku: Sku;
  mnem_drt_enabled: boolean;
  mnem_drt_specialists: {
    wikipedia: boolean;
    wikidata: boolean;
    arxiv: boolean;
    wolfram: boolean;
  };
  filtration_pipeline_enabled: boolean;
  eblet_store_quota: EbletQuota;
  federation_exchange_enabled: boolean;
}

const DEFAULT_MNEM_DRT: MnemDrtSettings = {
  sku: 'core',
  mnem_drt_enabled: false,
  mnem_drt_specialists: { wikipedia: false, wikidata: false, arxiv: false, wolfram: false },
  filtration_pipeline_enabled: false,
  eblet_store_quota: '100mb',
  federation_exchange_enabled: false,
};

const EBLET_QUOTA_OPTIONS: Array<{ id: EbletQuota; label: string }> = [
  { id: '10mb',      label: '10 MB'     },
  { id: '100mb',     label: '100 MB'    },
  { id: '1gb',       label: '1 GB'      },
  { id: 'unlimited', label: 'Unlimited' },
];

function loadMnemDrt(): MnemDrtSettings {
  try {
    const raw = localStorage.getItem('mnemo_mnem_drt');
    if (raw) return { ...DEFAULT_MNEM_DRT, ...JSON.parse(raw) };
  } catch { /* fall through */ }
  return { ...DEFAULT_MNEM_DRT };
}

function saveMnemDrt(s: MnemDrtSettings): void {
  localStorage.setItem('mnemo_mnem_drt', JSON.stringify(s));
}

async function persistMnemDrtToBackend(s: MnemDrtSettings): Promise<void> {
  try {
    await (window as any).amplify?.saveAiDispatchSettings?.({
      sku: s.sku,
      mnem_drt_enabled: s.mnem_drt_enabled,
      mnem_drt_specialists: s.mnem_drt_specialists,
      filtration_pipeline_enabled: s.filtration_pipeline_enabled,
      eblet_store_quota: s.eblet_store_quota,
      federation_exchange_enabled: s.federation_exchange_enabled,
    });
  } catch {
    // IPC channel may not be wired yet -- local storage is source of truth for now
  }
}

function MnemDrtPanel() {
  const [drt, setDrt] = useState<MnemDrtSettings>(loadMnemDrt);

  function update(patch: Partial<MnemDrtSettings>) {
    const next = { ...drt, ...patch };
    setDrt(next);
    saveMnemDrt(next);
    void persistMnemDrtToBackend(next);
  }

  function updateSpecialist(key: keyof MnemDrtSettings['mnem_drt_specialists'], val: boolean) {
    update({ mnem_drt_specialists: { ...drt.mnem_drt_specialists, [key]: val } });
  }

  const isNano = drt.sku === 'nano';
  const isFull = drt.sku === 'full';
  const s = styles;

  return (
    <section style={s.section}>
      <div style={s.sectionHeader}>🧠 Memory Depth Tier</div>

      {/* Disambiguation: Mnem-DRT install type, not AI model tier */}
      <div style={{ fontSize: 9, color: '#475569', marginBottom: 6, lineHeight: 1.5 }}>
        Mnem-DRT retrieval install type. Sets corpus depth and specialist count.
      </div>

      {/* SKU selector */}
      <div style={s.card}>
        <div style={s.label}>Install type (SKU)</div>
        <div style={s.toggleRow}>
          {(['nano', 'core', 'lite', 'full'] as Sku[]).map((sku) => (
            <button
              key={sku}
              onClick={() => update({ sku })}
              style={{ ...s.chip, ...(drt.sku === sku ? s.chipActive : {}) }}
              title={
                sku === 'nano' ? 'BYO Ollama -- minimal Mnem' :
                sku === 'core' ? 'Bundled Ollama -- opt-in Mnem-DRT' :
                sku === 'lite' ? 'Bundled Ollama + gemma2:2b -- opt-in Mnem-DRT' :
                'Full suite -- Mnem-DRT always on'
              }
            >
              {sku.toUpperCase()}
            </button>
          ))}
        </div>
        {isNano && (
          <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 6, lineHeight: 1.6 }}>
            NANO: minimal Mnem posture. r10v3 substrate is still injected on every query.
            Upgrade to CORE or LITE to enable Mnem-DRT retrieval.
          </div>
        )}
        {isFull && (
          <div style={{ fontSize: 9, color: '#6ee7b7', marginTop: 6, lineHeight: 1.6 }}>
            FULL: Mnem-DRT is always on. Wikipedia specialist enabled by default.
          </div>
        )}
      </div>

      {/* Master Mnem-DRT toggle (hidden for NANO; always-on display for FULL) */}
      {!isNano && (
        <div style={s.card}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0', marginBottom: 3 }}>
                Enable Mnem retrieval for this session
              </div>
              <div style={{ fontSize: 9, color: '#64748b', lineHeight: 1.6 }}>
                When on, MnemosyneC queries its substrate before every AI answer.
                {isFull ? ' Always active for FULL SKU.' : ' Opt-in for CORE and LITE.'}
              </div>
            </div>
            <button
              onClick={() => !isFull && update({ mnem_drt_enabled: !drt.mnem_drt_enabled })}
              disabled={isFull}
              style={{
                ...s.chip,
                minWidth: 38,
                ...(isFull || drt.mnem_drt_enabled
                  ? { ...s.chipActive, color: '#6ee7b7', borderColor: 'rgba(110,231,183,0.4)' }
                  : {}),
                opacity: isFull ? 0.75 : 1,
              }}
            >
              {isFull || drt.mnem_drt_enabled ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      )}

      {/* Source specialists (shown when Mnem-DRT is active and not NANO) */}
      {!isNano && (isFull || drt.mnem_drt_enabled) && (
        <div style={s.card}>
          <div style={s.label}>Source specialists</div>
          {([
            { key: 'wikipedia' as const, label: 'Wikipedia',     note: ''                       },
            { key: 'wikidata'  as const, label: 'Wikidata',      note: ''                       },
            { key: 'arxiv'     as const, label: 'arXiv',         note: ''                       },
            { key: 'wolfram'   as const, label: 'Wolfram Alpha', note: '(requires API key)'     },
          ]).map(({ key, label, note }) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isFull && key === 'wikipedia' ? true : drt.mnem_drt_specialists[key]}
                disabled={isFull && key === 'wikipedia'}
                onChange={(e) => updateSpecialist(key, e.target.checked)}
                style={{ width: 13, height: 13, accentColor: '#6ee7b7', cursor: 'pointer' } as React.CSSProperties}
              />
              <span style={{ fontSize: 10, color: '#94a3b8' }}>
                {label}{note ? <span style={{ fontSize: 9, color: '#475569', marginLeft: 4 }}>{note}</span> : null}
              </span>
            </label>
          ))}
          <div style={{ fontSize: 9, color: '#334155', marginTop: 4, fontStyle: 'italic' as const }}>
            W1 scope: specialist network calls are stubs -- full bridge lands in Week 1 build.
          </div>
        </div>
      )}

      {/* Filtration Pipeline toggle */}
      {!isNano && (
        <div style={s.card}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0', marginBottom: 3 }}>
                Filtration Pipeline
              </div>
              <div style={{ fontSize: 9, color: '#64748b', lineHeight: 1.6 }}>
                Recommended on for best results. May slow first query by 2-5 seconds.
                {isFull ? ' Always active for FULL SKU.' : ''}
              </div>
            </div>
            <button
              onClick={() => !isFull && update({ filtration_pipeline_enabled: !drt.filtration_pipeline_enabled })}
              disabled={isFull}
              style={{
                ...s.chip,
                minWidth: 38,
                ...(isFull || drt.filtration_pipeline_enabled
                  ? { ...s.chipActive, color: '#6ee7b7', borderColor: 'rgba(110,231,183,0.4)' }
                  : {}),
                opacity: isFull ? 0.75 : 1,
              }}
            >
              {isFull || drt.filtration_pipeline_enabled ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      )}

      {/* Eblet store quota */}
      <div style={s.card}>
        <div style={s.label}>Eblet store quota</div>
        <div style={s.toggleRow}>
          {EBLET_QUOTA_OPTIONS.map((q) => (
            <button
              key={q.id}
              onClick={() => update({ eblet_store_quota: q.id })}
              style={{ ...s.chip, ...(drt.eblet_store_quota === q.id ? s.chipActive : {}) }}
            >
              {q.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 9, color: '#475569', marginTop: 4, lineHeight: 1.5 }}>
          Maximum local disk space for your sovereign eblet knowledge base.
        </div>
      </div>

      {/* Federation eblet exchange */}
      <div style={s.card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0', marginBottom: 3 }}>
              Federation eblet exchange
            </div>
            <div style={{ fontSize: 9, color: '#64748b', lineHeight: 1.6 }}>
              Share substrate with trusted peers (opt-in). Your data leaves your computer
              only to peers you explicitly add. Default off across all SKUs.
            </div>
          </div>
          <button
            onClick={() => update({ federation_exchange_enabled: !drt.federation_exchange_enabled })}
            style={{
              ...s.chip,
              minWidth: 38,
              ...(drt.federation_exchange_enabled
                ? { ...s.chipActive, color: '#6ee7b7', borderColor: 'rgba(110,231,183,0.4)' }
                : {}),
            }}
          >
            {drt.federation_exchange_enabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <div style={{ fontSize: 9, color: '#334155', marginTop: 4, fontStyle: 'italic' as const, lineHeight: 1.5 }}>
        r10v3 substrate is injected on every query for all SKUs -- no configuration needed.
      </div>
    </section>
  );
}

const MODEL_OPTIONS: Array<{ id: ModelAssignment; label: string; desc: string }> = [
  { id: 'ollama_local', label: 'Ollama (local)',      desc: 'Free · runs on your hardware · no API key needed' },
  { id: 'anthropic_cloud', label: 'Anthropic (cloud)', desc: 'Claude family · requires API key' },
  { id: 'manual',       label: 'Manual / Other',       desc: 'Enter endpoint + key yourself' },
];

const THEME_OPTIONS: Array<{ id: Theme; label: string; icon: string }> = [
  { id: 'dark',   label: 'Dark',   icon: '🌑' },
  { id: 'light',  label: 'Light',  icon: '☀️' },
  { id: 'system', label: 'System', icon: '💻' },
];

const ZOOM_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1.0,  label: '100%' },
  { value: 1.1,  label: '110%' },
  { value: 1.15, label: '115% (default)' },
  { value: 1.2,  label: '120%' },
  { value: 1.25, label: '125%' },
];

const MODE_OPTIONS: Array<{ id: SubstrateMode; label: string; desc: string }> = [
  { id: 'ai_burst',  label: '🔥 AI Burst',  desc: 'Claude AI for enhanced analysis · free API key from console.anthropic.com · pay-per-token' },
  { id: 'normal',    label: '🪵 Normal',     desc: 'Balanced · Ollama local AI · recommended for most tasks · zero marginal cost' },
  { id: 'fallback',  label: '❄️ Fallback',   desc: 'Substrate-only · no AI required · Stage 2 mode · always offline-capable' },
];

export function SettingsTab({
  authState,
  onDevModeToggle,
  devEnabled = false,
  scrollTo,
  onScrollConsumed,
}: SettingsTabProps) {
  const isMember = authState?.status === 'member' || authState?.status === 'trial_active';
  const isFounder = (authState as any)?.member?.is_founder === true;
  const [showLocFaq, setShowLocFaq] = useState(false);
  const [showShare, setShowShare] = useState(false);

  // SEG-UX-3: current SKU tier for persistent tier text row
  const [currentSkuTier, setCurrentSkuTier] = useState<string | null>(null);

  // SEG-UX-4: settings quick-jump search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  // SEG-R-5: Advanced collapsible -- resets to collapsed on every reload
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // SEG-S-1: lifecycle stage hook (foundation for welcome tour, onboarding gates)
  const { resetToWelcome } = useLifecycleStage();

  // SEG-Q-13 BP078 / SEG-R-13: diagnostic state
  const [diagLogPath, setDiagLogPath] = React.useState<string | null>(null);
  const [diagRunning, setDiagRunning] = React.useState(false);
  const [diagError, setDiagError] = React.useState<string | null>(null);

  // v0.4.2 BP083 SEG-3: Hardware tier detection + model selection
  const [hwTier, setHwTier] = React.useState<{
    tier: { tier: string; ramGb: number; recommendedModel: string; displayName: string; description: string };
    allTiers: { tier: string; ramGb: number; recommendedModel: string; displayName: string; description: string }[];
    activeModel: string;
    effectiveModelResult?: { tier: string; model: string | null; overrideActive: boolean; autoDetectedModel: string | null; warning?: string };
  } | null>(null);
  const [hwModelSaving, setHwModelSaving] = React.useState(false);

  const handleRunDiagnostic = React.useCallback(async () => {
    setDiagRunning(true);
    setDiagError(null);
    setDiagLogPath(null);
    try {
      const result = await window.amplify?.runDiagnostic?.();
      if (result?.ok) {
        setDiagLogPath(result.logPath);
      } else {
        setDiagError('Diagnostic returned no result. Check main process log.');
      }
    } catch (err) {
      setDiagError(err instanceof Error ? err.message : String(err));
    } finally {
      setDiagRunning(false);
    }
  }, []);

  // Section refs for scroll-to-anchor
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  // SEG-UX-3: load current SKU tier on mount + subscribe to upgrade completion
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result =
          (await (window as any).amplify?.sku?.currentTier?.()) ?? { tier: 'nano' };
        if (!cancelled) setCurrentSkuTier(result.tier);
      } catch {
        if (!cancelled) setCurrentSkuTier('nano');
      }
    })();

    // SEG-UX-7: refresh tier text after upgrade completes (handles upgrade from pill modal)
    const unsubComplete = (window as any).amplify?.sku?.onPullComplete?.(() => {
      if (!cancelled) setCurrentSkuTier('full');
    }) ?? (() => {});

    return () => {
      cancelled = true;
      unsubComplete();
    };
  }, []);

  // SEG-UX-2: scroll to target section when prop changes
  useEffect(() => {
    if (!scrollTo) return;
    const el = sectionRefs.current.get(scrollTo);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    onScrollConsumed?.();
  }, [scrollTo, onScrollConsumed]);

  // v0.4.2 BP083 SEG-3: Load hardware tier info on mount
  useEffect(() => {
    void (async () => {
      try {
        const result = await window.amplify?.hardwareGetTier?.();
        if (result) setHwTier(result as typeof hwTier);
      } catch {
        // Non-fatal — hardware tier is best-effort
      }
    })();
  }, []);

  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    checking: false,
    upToDate: null,
    currentVersion: '',
    latestVersion: null,
    error: null,
  });

  // G.2 KniPr011: Subscribe to electron-updater state changes for proper install button state machine.
  // Status machine: idle/not-available → "Check for update"; checking → "Checking…";
  // available → show available version; downloading → show progress; downloaded → "Restart to update"
  const [liveUpdateState, setLiveUpdateState] = useState<{
    status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error' | 'not-available';
    version?: string;
    downloadProgress?: number;
    errorMessage?: string;
  } | null>(null);

  useEffect(() => {
    if (!window.amplify) return;
    window.amplify.getUpdateState?.().then(setLiveUpdateState).catch(() => {});
    const cleanup = window.amplify.onUpdateStateChanged?.((s) => setLiveUpdateState(s));
    return cleanup ?? undefined;
  }, []);

  const [theme, setTheme] = useState<Theme>(() =>
    (localStorage.getItem('mnemo_theme') as Theme | null) ?? 'dark'
  );

  const [zoomFactor, setZoomFactor] = useState<number>(() => {
    const stored = localStorage.getItem('ui.zoomFactor');
    return stored ? parseFloat(stored) : 1.15;
  });

  const [substrateMode, setSubstrateMode] = useState<SubstrateMode>(() =>
    (localStorage.getItem('mnemo_default_mode') as SubstrateMode | null) ?? 'normal'
  );

  const [pieceModels, setPieceModels] = useState<PieceModels>(() => {
    const saved = localStorage.getItem('mnemo_piece_models');
    if (saved) {
      try { return JSON.parse(saved) as PieceModels; } catch { /* fall through */ }
    }
    return { bishop: 'ollama_local', knight: 'ollama_local', pawn: 'ollama_local', rook: 'ollama_local' };
  });

  useEffect(() => {
    const ver = (window as any).amplify?.getVersion?.();
    if (ver) {
      setUpdateStatus((s) => ({ ...s, currentVersion: ver }));
    }
  }, []);

  async function handleCheckForUpdate() {
    setUpdateStatus((s) => ({ ...s, checking: true, upToDate: null, error: null }));
    try {
      window.amplify?.checkForUpdates?.();
      // State arrives via onUpdateStateChanged / liveUpdateState — brief checking window
      setTimeout(() => {
        setUpdateStatus((s) => ({ ...s, checking: false }));
      }, 2500);
    } catch {
      setUpdateStatus((s) => ({ ...s, checking: false, error: 'Update check failed · try again later.' }));
    }
  }

  function handleThemeChange(t: Theme) {
    setTheme(t);
    localStorage.setItem('mnemo_theme', t);
  }

  function handleZoomChange(factor: number) {
    setZoomFactor(factor);
    localStorage.setItem('ui.zoomFactor', String(factor));
    window.amplify?.setZoomFactor?.(factor);
  }

  function handleModeChange(m: SubstrateMode) {
    setSubstrateMode(m);
    localStorage.setItem('mnemo_default_mode', m);
  }

  function handleModelChange(piece: keyof PieceModels, model: ModelAssignment) {
    const updated = { ...pieceModels, [piece]: model };
    setPieceModels(updated);
    localStorage.setItem('mnemo_piece_models', JSON.stringify(updated));
  }

  const s = styles;

  // Section header search data (SEG-R-4, SEG-R-6 renames applied)
  const SECTION_HEADERS = [
    { key: 'update',         label: 'App Version',            keywords: ['update', 'version', 'download', 'install', 'app version'] },
    { key: 'ai-capability',  label: 'AI Capability',          keywords: ['ai capability', 'activate full', 'upgrade', 'tier'] },
    { key: 'membership',     label: 'Cooperative Membership', keywords: ['membership', 'cooperative', '$5', 'mirror clause', 'incentive'] },
    { key: 'ai-tier',        label: 'AI Power Tier',          keywords: ['ai power tier', 'ai tier', 'gemma', 'model', 'full', 'nano', 'upgrade', 'sku'] },
    { key: 'ai-model',       label: 'AI Model Assignment',    keywords: ['ai model', 'ollama', 'bishop', 'knight', 'pawn', 'rook', 'orchestrator', 'builder', 'researcher', 'primary assistant'] },
    { key: 'hardware-tier',  label: 'Hardware Tier & Plow Model', keywords: ['hardware', 'ram', 'plow model', 'gemma2', 'qwen', 'lightweight', 'standard', 'premium', 'heavy', 'model select'] },
    { key: 'mnem-drt',       label: 'Memory Depth Tier',      keywords: ['mnem', 'drt', 'retrieval', 'specialist', 'wikipedia', 'wikidata', 'arxiv', 'wolfram', 'memory depth'] },
    { key: 'advanced',       label: 'Advanced',               keywords: ['devtools', 'developer tools', 'debugging', 'remote-debugging', 'advanced', 'inspect', 'diagnostic'] },
    { key: 'appearance',     label: 'Appearance',             keywords: ['appearance', 'theme', 'dark', 'light', 'zoom', 'interface zoom', 'scale'] },
    { key: 'substrate',      label: 'Substrate Mode',         keywords: ['substrate', 'mode', 'burst', 'normal', 'fallback'] },
    { key: 'developer',      label: 'Developer Mode',         keywords: ['developer', 'dev mode', 'devmode'] },
    { key: 'research',       label: 'Research Participation', keywords: ['chronos', 'research', 'consent'] },
    { key: 'contribution',   label: 'My Contribution',        keywords: ['contribution', 'marks', 'stamps'] },
    { key: 'grand-projects', label: 'Grand Projects',         keywords: ['grand projects', 'project'] },
    { key: 'substrate-folders', label: 'Substrate Folders',  keywords: ['folders', 'index', 'watcher'] },
  ];

  const searchResults = searchQuery.trim().length > 0
    ? SECTION_HEADERS.filter((sec) => {
        const q = searchQuery.toLowerCase();
        return (
          sec.label.toLowerCase().includes(q) ||
          sec.keywords.some((k) => k.includes(q))
        );
      })
    : [];

  function scrollToSection(key: string) {
    const el = sectionRefs.current.get(key);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setSearchQuery('');
    setSearchOpen(false);
  }

  function setSectionRef(key: string) {
    return (el: HTMLElement | null) => {
      if (el) sectionRefs.current.set(key, el);
    };
  }

  return (
    <div style={s.container}>

      {/* SEG-V0149-P2: Run Diagnostic shortcut at top of Settings panel */}
      <div style={{ borderBottom: '1px solid #2a2a2a', paddingBottom: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, color: '#eee', marginBottom: 4 }}>Run Diagnostic</div>
        <div style={{ fontSize: '0.82rem', color: '#888', marginBottom: 8 }}>Check your AI engine and memory system health.</div>
        <button
          disabled={diagRunning}
          onClick={handleRunDiagnostic}
          style={{
            ...s.btn,
            background: diagRunning ? 'rgba(148,163,184,0.04)' : 'rgba(148,163,184,0.08)',
            borderColor: 'rgba(148,163,184,0.25)',
            color: diagRunning ? '#475569' : '#94a3b8',
            cursor: diagRunning ? 'not-allowed' : 'pointer',
            opacity: diagRunning ? 0.6 : 1,
          }}
        >
          {diagRunning ? 'Running diagnostic...' : 'Run Diagnostic'}
        </button>
      </div>

      {/* SEG-UX-4: Settings quick-jump search box */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <input
          type="search"
          placeholder="Search settings... (e.g. AI Power Tier, retrieval)"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
          onFocus={() => setSearchOpen(true)}
          onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
          role="combobox"
          aria-expanded={searchOpen && searchResults.length > 0}
          aria-autocomplete="list"
          aria-controls="settings-search-results"
          aria-label="Search settings sections"
          style={{
            width: '100%',
            padding: '7px 12px',
            background: 'rgba(15,23,42,0.7)',
            border: '1px solid rgba(100,116,139,0.25)',
            borderRadius: 7,
            color: '#e2e8f0',
            fontSize: 11,
            outline: 'none',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />
        {searchOpen && searchResults.length > 0 && (
          <ul
            id="settings-search-results"
            role="listbox"
            aria-label="Search results"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: '#111827',
              border: '1px solid rgba(100,116,139,0.25)',
              borderRadius: '0 0 7px 7px',
              zIndex: 100,
              margin: 0,
              padding: '4px 0',
              listStyle: 'none',
              boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
            }}
          >
            {searchResults.map((sec) => (
              <li
                key={sec.key}
                role="option"
                aria-selected={false}
                onMouseDown={() => scrollToSection(sec.key)}
                style={{
                  padding: '7px 14px',
                  cursor: 'pointer',
                  fontSize: 11,
                  color: '#94a3b8',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(110,231,183,0.07)'; (e.currentTarget as HTMLElement).style.color = '#6ee7b7'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}
              >
                {sec.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Disambiguator -- shown once above the three goal cards (SEG-R-2) */}
      <div style={{
        fontSize: 9,
        color: '#475569',
        marginBottom: 10,
        lineHeight: 1.6,
        padding: '5px 10px',
        background: 'rgba(100,116,139,0.05)',
        borderRadius: 6,
        border: '1px solid rgba(100,116,139,0.1)',
      }}>
        App updates change software. AI upgrades add model capability. Membership supports cooperative benefits.
      </div>

      {/* SEG-V0151-P1: UI Mode toggle — lean ↔ advanced */}
      <section style={s.section}>
        <div style={s.sectionHeader}>Interface Mode</div>
        <div style={s.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={s.label}>Advanced mode (shows all tabs)</div>
              <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                Switch between the simplified 3-tab view and the full multi-tab shell.
              </div>
            </div>
            <button
              onClick={() => {
                const current = localStorage.getItem('mnemoUiMode') ?? 'lean';
                const next = current === 'advanced' ? 'lean' : 'advanced';
                localStorage.setItem('mnemoUiMode', next);
                // Trigger storage event for LeanShell cross-window sync
                window.dispatchEvent(new StorageEvent('storage', { key: 'mnemoUiMode', newValue: next, storageArea: localStorage }));
              }}
              style={{
                ...s.btn,
                background: localStorage.getItem('mnemoUiMode') === 'advanced' ? '#10b981' : '#1e2a38',
                color: '#fff',
                minWidth: 64,
              }}
            >
              {localStorage.getItem('mnemoUiMode') === 'advanced' ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      </section>

      {/* Card 1: App Version (SEG-R-2) -- G.2 KniPr011 state machine preserved */}
      <section ref={setSectionRef('update') as React.RefCallback<HTMLElement>} style={s.section} id="settings-section-update">
        <div style={s.sectionHeader}>App Version</div>
        <div style={s.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={s.label}>Current version</div>
              <div style={s.value}>{updateStatus.currentVersion || liveUpdateState?.version || '\u2014'}</div>
            </div>
            {liveUpdateState?.status === 'available' && liveUpdateState.version && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                <div>
                  <div style={s.label}>Available</div>
                  <div style={{ ...s.value, color: '#6ee7b7' }}>v{liveUpdateState.version}</div>
                </div>
                <button
                  onClick={() => window.amplify?.downloadUpdate?.()}
                  style={{ ...s.btn, background: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.4)', color: '#fbbf24', fontWeight: 700 }}
                >
                  Install Now
                </button>
              </div>
            )}
            {(!liveUpdateState || liveUpdateState.status === 'idle' || liveUpdateState.status === 'not-available' || liveUpdateState.status === 'error') && (
              <button
                onClick={handleCheckForUpdate}
                disabled={updateStatus.checking}
                style={{ ...s.btn, opacity: updateStatus.checking ? 0.6 : 1 }}
              >
                {updateStatus.checking ? 'Checking...' : 'Check for Updates'}
              </button>
            )}
            {liveUpdateState?.status === 'checking' && (
              <button disabled style={{ ...s.btn, opacity: 0.5 }}>Checking...</button>
            )}
            {liveUpdateState?.status === 'downloading' && (
              <div style={{ fontSize: 10, color: '#6ee7b7' }}>
                Downloading... {liveUpdateState.downloadProgress ?? 0}%
              </div>
            )}
            {liveUpdateState?.status === 'downloaded' && (
              <button
                onClick={() => window.amplify?.installUpdate?.()}
                style={{ ...s.btn, background: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.4)', color: '#22c55e', fontWeight: 700 }}
              >
                Restart to update
              </button>
            )}
          </div>
          {liveUpdateState?.status === 'downloading' && (
            <div style={{ marginTop: 8, height: 4, background: 'rgba(100,116,139,0.2)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${liveUpdateState.downloadProgress ?? 0}%`,
                background: 'linear-gradient(90deg, #6ee7b7, #22c55e)',
                borderRadius: 2,
                transition: 'width 0.3s ease',
              }} />
            </div>
          )}
          {liveUpdateState?.status === 'not-available' && (
            <div style={s.successMsg}>You are on the latest version</div>
          )}
          {(!liveUpdateState || liveUpdateState.status === 'idle') && updateStatus.upToDate === true && (
            <div style={s.successMsg}>You are on the latest version</div>
          )}
          {updateStatus.error && (
            <div style={{ fontSize: 10, color: '#f87171', marginTop: 6 }}>{updateStatus.error}</div>
          )}
          <AutoInstallToggle />
        </div>
      </section>

      {/* M21: Card 1b: Automatic Updates — below App Version */}
      <AutomaticUpdatesSection />

      {/* BP137 Yoke v2b Stage C: Nexus Authority per-arm picker — new section, self-contained */}
      <NexusAuthoritySettings />

      {/* Card 2: AI Capability (SEG-R-2) */}
      <section
        ref={setSectionRef('ai-capability') as React.RefCallback<HTMLElement>}
        style={s.section}
        id="settings-section-ai-capability"
      >
        <div style={s.sectionHeader}>AI Capability</div>
        <div style={s.card}>
          {currentSkuTier && (
            <div style={{ marginBottom: 8 }}>
              <div style={s.label}>Current AI Power Tier</div>
              <div style={{
                fontSize: 13,
                fontWeight: 700,
                color: currentSkuTier === 'full' ? '#4ade80' : '#94a3b8',
                marginTop: 2,
              }}>
                {currentSkuTier.toUpperCase()}
                {currentSkuTier === 'full' && (
                  <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 6, color: '#6ee7b7' }}>
                    Google's Gemma 4 12B
                  </span>
                )}
              </div>
            </div>
          )}
          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 10, lineHeight: 1.5 }}>
            Upgrade to FULL for maximum reasoning power
          </div>
          <button
            disabled={currentSkuTier === 'full'}
            onClick={() => {
              const el = sectionRefs.current.get('ai-tier');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            style={{
              ...s.btn,
              background: currentSkuTier === 'full' ? 'rgba(74,222,128,0.08)' : 'rgba(110,231,183,0.1)',
              borderColor: currentSkuTier === 'full' ? 'rgba(74,222,128,0.3)' : 'rgba(110,231,183,0.3)',
              color: currentSkuTier === 'full' ? '#4ade80' : '#6ee7b7',
              opacity: currentSkuTier === 'full' ? 0.7 : 1,
            }}
          >
            {currentSkuTier === 'full' ? 'FULL active' : 'Activate FULL'}
          </button>
          {/* TODO: wire Activate FULL to activation flow when built */}
        </div>
      </section>

      {/* Card 3: Cooperative Membership (SEG-R-2) */}
      <section style={s.section} id="settings-section-membership">
        <div style={s.sectionHeader}>Cooperative Membership</div>
        <div style={s.card}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#6ee7b7' }}>$5</span>
            <span style={{ fontSize: 10, color: '#64748b' }}>/year</span>
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 6, lineHeight: 1.5 }}>
            Mirror Clause + Incentive to Hire benefits
          </div>
          <div style={{ fontSize: 9, color: '#64748b', lineHeight: 1.5 }}>
            Earn and spend within the cooperative
          </div>
        </div>
      </section>

      {/* AI Power Tier -- includes model assignment (SEG-R-4, SEG-R-3, SEG-R-5) */}
      <section
        ref={setSectionRef('ai-tier') as React.RefCallback<HTMLElement>}
        style={s.section}
        id="settings-section-ai-tier"
      >
        <div style={s.sectionHeader}>AI Power Tier</div>
        <div style={{ fontSize: 10, color: '#475569', marginBottom: 6, lineHeight: 1.5 }}>
          AI model tier. Sets the local model used for answers.
        </div>
        {currentSkuTier && (
          <p style={{
            fontSize: 11,
            fontWeight: 600,
            color: currentSkuTier === 'full' ? '#4ade80' : '#94a3b8',
            margin: '0 0 10px',
            padding: '6px 10px',
            background: currentSkuTier === 'full'
              ? 'rgba(74,222,128,0.07)'
              : 'rgba(100,116,139,0.07)',
            border: currentSkuTier === 'full'
              ? '1px solid rgba(74,222,128,0.2)'
              : '1px solid rgba(100,116,139,0.15)',
            borderRadius: 6,
          }}>
            Current AI tier: {currentSkuTier === 'full'
              ? "FULL (Google's Gemma 4 12B)"
              : currentSkuTier.toUpperCase()}
          </p>
        )}
        <SkuUpgradePanel analytics={undefined} />

        {/* AI Model Assignment subsection (SEG-R-3) */}
        <div style={{ ...s.sectionHeader, marginTop: 14, marginBottom: 6 }}>AI Model Assignment</div>
        <div style={s.note}>
          FREE AI: Ollama (onboard by default) -- no cloud account, no API key, no cost
        </div>
        <div ref={setSectionRef('ai-model') as React.RefCallback<HTMLDivElement>} id="settings-section-ai-model">
          {([
            {
              piece: 'pawn' as keyof PieceModels,
              functional: 'Primary Assistant',
              canon: 'Pawn',
              job: 'Handles everyday chat and quick questions.',
              recommended: true,
            },
            {
              piece: 'bishop' as keyof PieceModels,
              functional: 'Orchestrator',
              canon: 'Bishop',
              job: 'Foreman -- plans the work and manages agents.',
              recommended: false,
            },
            {
              piece: 'knight' as keyof PieceModels,
              functional: 'Builder',
              canon: 'Knight',
              job: 'Writes code and ships releases.',
              recommended: false,
            },
            {
              piece: 'rook' as keyof PieceModels,
              functional: 'Researcher',
              canon: 'Rook',
              job: 'Deep architecture reviews. Currently paused.',
              recommended: false,
            },
          ]).map(({ piece, functional, canon, job, recommended }) => (
            <div key={piece} style={{ ...s.card, marginBottom: 6, position: 'relative' as const }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div style={{ ...s.label, marginBottom: 0 }} title={job}>
                  {functional} ({canon})
                </div>
                {recommended && (
                  <span style={{
                    fontSize: 8,
                    fontWeight: 700,
                    color: '#6ee7b7',
                    background: 'rgba(110,231,183,0.12)',
                    border: '1px solid rgba(110,231,183,0.3)',
                    borderRadius: 4,
                    padding: '1px 5px',
                    letterSpacing: '0.03em',
                  }}>
                    Recommended
                  </span>
                )}
              </div>
              <div style={{ fontSize: 9, color: '#475569', marginBottom: 6, lineHeight: 1.4 }}>{job}</div>
              <div style={s.toggleRow}>
                {MODEL_OPTIONS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleModelChange(piece, m.id)}
                    style={{
                      ...s.chip,
                      ...(pieceModels[piece] === m.id ? s.chipActive : {}),
                    }}
                    title={m.desc}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* v0.4.2 BP083 SEG-3: Hardware Tier & Plow Model Selection */}
      <section style={s.section} id="settings-section-hardware-tier">
        <div style={s.sectionHeader}>Hardware Tier & Plow Model</div>
        <div style={{ fontSize: 10, color: '#475569', marginBottom: 10, lineHeight: 1.5 }}>
          MnemosyneC detects your system RAM and recommends the best local model for the Canonical Plow.
          Lightweight machines (≤11 GB) default to gemma2:2b · no more failed Plows on low-RAM hardware.
        </div>
        {!hwTier ? (
          <div style={{ fontSize: 11, color: '#475569', padding: '8px 0' }}>Detecting hardware…</div>
        ) : (
          <>
            {/* Detected info */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(100,116,139,0.15)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 10,
            }}>
              <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>
                Detected
              </div>
              <div style={{ fontSize: 12, color: '#e2e8f0', marginBottom: 2 }}>
                {hwTier.effectiveModelResult?.overrideActive
                  ? `${hwTier.effectiveModelResult.tier} (Override: ${hwTier.effectiveModelResult.model})`
                  : hwTier.tier.displayName} &middot; {hwTier.tier.ramGb} GB RAM
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>
                {hwTier.tier.description}
              </div>
              <div style={{ fontSize: 10, color: '#64748b' }}>
                Active Plow model: <span style={{ color: '#a78bfa', fontFamily: 'monospace' }}>{hwTier.activeModel}</span>
              </div>
            </div>

            {/* Tier selector */}
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6 }}>
              Override Model
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
              {hwTier.allTiers.map((t) => {
                const isActive = hwTier.activeModel === t.recommendedModel;
                const isRecommended = hwTier.tier.tier === t.tier;
                return (
                  <button
                    key={t.tier}
                    type="button"
                    disabled={hwModelSaving}
                    onClick={async () => {
                      setHwModelSaving(true);
                      try {
                        await window.amplify?.hardwareSetModel?.(t.recommendedModel, t.tier);
                        setHwTier((prev) => prev ? { ...prev, activeModel: t.recommendedModel } : prev);
                      } finally {
                        setHwModelSaving(false);
                      }
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: isActive ? 'rgba(167,139,250,0.1)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isActive ? 'rgba(167,139,250,0.35)' : 'rgba(100,116,139,0.15)'}`,
                      borderRadius: 7, padding: '8px 12px', cursor: hwModelSaving ? 'not-allowed' : 'pointer',
                      textAlign: 'left' as const, width: '100%',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: isActive ? '#a78bfa' : '#e2e8f0', fontWeight: isActive ? 600 : 400 }}>
                        {t.displayName}
                        {isRecommended && !isActive && (
                          <span style={{ marginLeft: 6, fontSize: 9, color: '#4ade80', background: 'rgba(74,222,128,0.1)', padding: '1px 5px', borderRadius: 3 }}>
                            RECOMMENDED
                          </span>
                        )}
                        {isActive && (
                          <span style={{ marginLeft: 6, fontSize: 9, color: '#a78bfa', background: 'rgba(167,139,250,0.1)', padding: '1px 5px', borderRadius: 3 }}>
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>{t.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Reset to auto-detect */}
            <button
              type="button"
              disabled={hwModelSaving}
              onClick={async () => {
                setHwModelSaving(true);
                try {
                  const result = await window.amplify?.hardwareResetModel?.();
                  if (result?.ok) {
                    setHwTier((prev) => prev ? { ...prev, activeModel: result.model } : prev);
                  }
                } finally {
                  setHwModelSaving(false);
                }
              }}
              style={{
                marginTop: 8, fontSize: 10, color: '#64748b',
                background: 'none', border: '1px solid rgba(100,116,139,0.2)',
                borderRadius: 5, padding: '4px 10px', cursor: hwModelSaving ? 'not-allowed' : 'pointer',
              }}
            >
              Reset to auto-detected ({hwTier.tier.recommendedModel})
            </button>
          </>
        )}
      </section>

      {/* Memory Depth Tier (SEG-R-4, SEG-R-5) */}
      <div
        ref={setSectionRef('mnem-drt') as React.RefCallback<HTMLDivElement>}
        id="settings-section-mnem-drt"
      >
        <MnemDrtPanel />
      </div>

      {/* Advanced collapsible -- collapsed by default (SEG-R-5, SEG-R-6, SEG-R-7) */}
      <section style={s.section} id="settings-section-advanced">
        <button
          onClick={() => setAdvancedOpen((o) => !o)}
          aria-expanded={advancedOpen}
          aria-controls="advanced-panel-content"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0 0 6px',
            width: '100%',
            textAlign: 'left' as const,
          }}
        >
          <span style={{ ...s.sectionHeader, marginBottom: 0 }}>Advanced</span>
          <span style={{ fontSize: 10, color: '#475569', marginLeft: 'auto' }}>
            {advancedOpen ? '\u25b2' : '\u25bc'}
          </span>
        </button>
        {advancedOpen && (
          <div id="advanced-panel-content">
            <div style={s.card}>
              <div style={{ marginBottom: 12 }}>
                <div style={s.label}>Developer Tools</div>
                <div style={{ fontSize: 9, color: '#475569', marginTop: 2, marginBottom: 8 }}>
                  Open the Chromium DevTools panel for this window. Keyboard shortcut: Ctrl+Shift+D (may conflict on some machines). Right-click the window title bar and choose &quot;Toggle Developer Tools&quot;. Power-user path: launch with <code style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace' }}>--remote-debugging-port=9222</code> and connect via Chrome at <code style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace' }}>chrome://inspect</code>.
                </div>
                <button
                  onClick={() => window.amplify?.toggleDevTools?.()}
                  style={{
                    ...s.btn,
                    background: 'rgba(148,163,184,0.08)',
                    borderColor: 'rgba(148,163,184,0.25)',
                    color: '#94a3b8',
                  }}
                >
                  Toggle DevTools
                </button>
              </div>
              <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }}>
                <div style={s.label}>Diagnostic Log</div>
                <div style={{ fontSize: 9, color: '#475569', marginTop: 2, marginBottom: 8 }}>
                  Runs a probe of app state (Ollama, SKU tier, disk, windows) and writes a log file to your userData folder. Share with Bishop or Knight for debugging. No DevTools required.
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
                  <button
                    disabled={diagRunning}
                    onClick={handleRunDiagnostic}
                    style={{
                      ...s.btn,
                      background: diagRunning ? 'rgba(148,163,184,0.04)' : 'rgba(148,163,184,0.08)',
                      borderColor: 'rgba(148,163,184,0.25)',
                      color: diagRunning ? '#475569' : '#94a3b8',
                      cursor: diagRunning ? 'not-allowed' : 'pointer',
                      opacity: diagRunning ? 0.6 : 1,
                    }}
                  >
                    {diagRunning ? 'Running diagnostic...' : 'Run Diagnostic'}
                  </button>
                  {diagError && (
                    <button
                      onClick={() => {
                        setDiagError(null);
                        setDiagLogPath(null);
                      }}
                      style={{
                        ...s.btn,
                        background: 'rgba(239,68,68,0.08)',
                        borderColor: 'rgba(239,68,68,0.3)',
                        color: '#f87171',
                        cursor: 'pointer',
                      }}
                    >
                      Retry
                    </button>
                  )}
                </div>
                {diagLogPath && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column' as const, gap: 4 }}>
                    <div style={{ fontSize: 9, color: '#6ee7b7' }}>
                      Log saved to: {diagLogPath}
                    </div>
                    <button
                      onClick={() => window.amplify?.openDiagFolder?.(diagLogPath)}
                      style={{
                        ...s.btn,
                        alignSelf: 'flex-start',
                        background: 'rgba(110,231,183,0.08)',
                        borderColor: 'rgba(110,231,183,0.25)',
                        color: '#6ee7b7',
                        cursor: 'pointer',
                      }}
                    >
                      Open log folder
                    </button>
                  </div>
                )}
                {diagError && !diagRunning && (
                  <div style={{ marginTop: 6, fontSize: 9, color: '#f87171' }}>
                    Error: {diagError}
                  </div>
                )}
              </div>
              <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }}>
                <div style={s.label}>Welcome Tour</div>
                <div style={{ fontSize: 9, color: '#475569', marginTop: 2, marginBottom: 8 }}>
                  Returns to the welcome screen. Your AI settings and memory are preserved.
                </div>
                <button
                  onClick={resetToWelcome}
                  style={{
                    ...s.btn,
                    background: 'rgba(248,113,113,0.08)',
                    borderColor: 'rgba(248,113,113,0.25)',
                    color: '#f87171',
                  }}
                >
                  Reset to Welcome Tour
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Appearance */}
      <section ref={setSectionRef('appearance') as React.RefCallback<HTMLElement>} style={s.section} id="settings-section-appearance">
        <div style={s.sectionHeader}>Appearance</div>
        <div style={s.card}>
          <div style={s.label}>Theme</div>
          <div style={s.toggleRow}>
            {THEME_OPTIONS.map((t) => (
              <button
                key={t.id}
                onClick={() => handleThemeChange(t.id)}
                style={{
                  ...s.chip,
                  ...(theme === t.id ? s.chipActive : {}),
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ ...s.card, marginTop: 6 }}>
          <div style={s.label}>Interface Zoom</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select
              value={zoomFactor}
              onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
              style={{
                background: 'rgba(15,23,42,0.8)',
                border: '1px solid rgba(100,116,139,0.25)',
                borderRadius: 6,
                color: '#e2e8f0',
                fontSize: 11,
                padding: '4px 8px',
                cursor: 'pointer',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            >
              {ZOOM_OPTIONS.map((z) => (
                <option key={z.value} value={z.value}>
                  {z.label}
                </option>
              ))}
            </select>
            <span style={{ fontSize: 9, color: '#475569' }}>
              Applied to all windows immediately
            </span>
          </div>
        </div>

        {/* SEG-V0145-2: Share MnemosyneC referral */}
        <div style={{ ...s.card, marginTop: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0', marginBottom: 2 }}>
                Share MnemosyneC
              </div>
              <div style={{ fontSize: 9, color: '#475569', lineHeight: 1.5 }}>
                Send a download link with your referral ID. You may earn cooperative credit.
              </div>
            </div>
            <button
              onClick={() => setShowShare(true)}
              style={{
                ...s.btn,
                background: 'rgba(110,231,183,0.08)',
                borderColor: 'rgba(110,231,183,0.25)',
                color: '#6ee7b7',
                whiteSpace: 'nowrap' as const,
                flexShrink: 0,
              }}
            >
              Share →
            </button>
          </div>
        </div>
      </section>

      {showShare && <ShareMnemosyneC onClose={() => setShowShare(false)} />}

      {/* Auto-Prepare FULL Upgrade */}
      <AutoPreparePullPanel />

      {/* Substrate Index Counter (BP084 SEG-6) */}
      <SubstrateCounterPanel />

      {/* MCP Substrate Bridge */}
      <McpSubstrateBridgePanel />

      {/* BP084 SEG-3 — Substrate Awakens Join Panel */}
      <SubstrateAwakensJoinPanel />

      {/* Substrate Mode */}
      <section ref={setSectionRef('substrate') as React.RefCallback<HTMLElement>} style={s.section} id="settings-section-substrate">
        <div style={s.sectionHeader}>Substrate Mode</div>
        <div style={s.card}>
          <div style={s.toggleRow}>
            {MODE_OPTIONS.map((m) => (
              <button
                key={m.id}
                onClick={() => handleModeChange(m.id)}
                style={{
                  ...s.chip,
                  ...(substrateMode === m.id ? s.chipActive : {}),
                }}
                title={m.desc}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 9, color: '#475569', marginTop: 6 }}>
            {MODE_OPTIONS.find((m) => m.id === substrateMode)?.desc}
          </div>
          {substrateMode === 'ai_burst' && (
            <div style={{ fontSize: 9, color: '#fbbf24', marginTop: 6, lineHeight: 1.6 }}>
              AI Burst uses Anthropic's Claude AI.{' '}
              <button
                onClick={() => window.amplify?.openExternal?.('https://console.anthropic.com')}
                style={{ background: 'none', border: 'none', color: '#fbbf24', cursor: 'pointer', fontSize: 9, padding: 0, textDecoration: 'underline' }}
              >
                Get your free API key →
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── Section 5: DEVELOPER MODE ────────────────────────────────────── */}
      {(isMember || isFounder) && (
        <section ref={setSectionRef('developer') as React.RefCallback<HTMLElement>} style={s.section} id="settings-section-developer">
          <div style={s.sectionHeader}>Developer Mode</div>
          <div style={s.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={s.label}>Cooperative Defensive Patent Pledge #2260</div>
                <div style={{ fontSize: 9, color: '#475569', marginTop: 2 }}>
                  {devEnabled ? 'Developer mode active -- submit variants -- fork strains -- SEG controls' : 'Requires membership + Pledge #2260 agreement'}
                </div>
              </div>
              <button
                onClick={() => onDevModeToggle?.(!devEnabled)}
                style={{
                  ...s.chip,
                  ...(devEnabled ? { ...s.chipActive, color: '#f59e0b', borderColor: 'rgba(245,158,11,0.4)' } : {}),
                }}
              >
                {devEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Research Participation */}
      <ChronosResearchPanel />

      {/* My Contribution */}
      <MyContributionPanel />

      {/* Managed Folders */}
      <FolderManagerPanel />

      {/* Grand Projects */}
      <section ref={setSectionRef('grand-projects') as React.RefCallback<HTMLElement>} style={s.section} id="settings-section-grand-projects">
        <div style={s.sectionHeader}>Grand Projects</div>
        <div style={s.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0', marginBottom: 3 }}>
                Library of Congress Grand Project
              </div>
              <div style={{ fontSize: 9, color: '#64748b', lineHeight: 1.5 }}>
                10,000-node cooperative network -- digitizing human knowledge -- free forever
              </div>
            </div>
            <button
              onClick={() => setShowLocFaq(true)}
              style={{
                ...s.btn,
                background: 'rgba(110,231,183,0.08)',
                borderColor: 'rgba(110,231,183,0.25)',
                color: '#6ee7b7',
                whiteSpace: 'nowrap' as const,
              }}
            >
              Library of Congress FAQ
            </button>
          </div>
        </div>
      </section>

      {showLocFaq && <LocFaqModal onClose={() => setShowLocFaq(false)} />}

    </div>
  );
}

// ─── Phase 2D: Folder Manager Panel ──────────────────────────────────────────

interface WatchedFolder { id: string; path: string; }

function FolderManagerPanel() {
  const [folders, setFolders] = React.useState<WatchedFolder[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [picking, setPicking] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const data = await window.amplify?.watcher?.listFolders?.() as WatchedFolder[] | undefined;
        setFolders(data ?? []);
      } catch { /* watcher unavailable */ }
    })();
  }, []);

  async function pick() {
    setPicking(true);
    try {
      const result = await window.amplify?.watcher?.openFolderDialog?.();
      if (result && !result.canceled && result.filePaths.length > 0) {
        const path = result.filePaths[0];
        await window.amplify?.watcher?.addFolder?.(path);
        const data = await window.amplify?.watcher?.listFolders?.() as WatchedFolder[] | undefined;
        setFolders(data ?? []);
        // Record that N=3 prompt 1 was shown (first-run already handles this)
        const n = Number(localStorage.getItem('mnemo_folder_prompt_count') ?? 0);
        if (n < 1) localStorage.setItem('mnemo_folder_prompt_count', '1');
      }
    } catch { /* dialog unavailable */ }
    finally { setPicking(false); }
  }

  return (
    <section style={{ margin: '0 0 8px', padding: '0 0 8px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '6px 0 4px', marginBottom: 4 }}>
        📂 Managed Folders
      </div>
      <div style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(100,116,139,0.15)', borderRadius: 8, padding: '10px 12px' }}>
        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8, lineHeight: 1.5 }}>
          Folders your AI indexes for memory. Add more to improve recall.
        </div>
        {folders.length === 0 ? (
          <div style={{ fontSize: 10, color: '#334155', marginBottom: 8 }}>No folders indexed yet.</div>
        ) : (
          <div style={{ marginBottom: 8 }}>
            {folders.map((f) => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 10, color: '#94a3b8' }}>
                <span style={{ color: '#6ee7b7', fontSize: 10 }}>✓</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 9 }}>{f.path}</span>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={pick}
          disabled={picking}
          style={{ padding: '5px 12px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: picking ? 'not-allowed' : 'pointer', border: '1px solid rgba(59,130,246,0.35)', background: 'rgba(59,130,246,0.08)', color: '#60a5fa', opacity: picking ? 0.6 : 1 }}
        >
          {picking ? 'Opening…' : '+ Add Folder'}
        </button>
      </div>
    </section>
  );
}

// ─── 1D-FIX: Auto-install on quit toggle ─────────────────────────────────────

function AutoInstallToggle() {
  const [enabled, setEnabled] = React.useState(() =>
    localStorage.getItem('mnemo_auto_install_on_quit') !== 'false'
  );

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem('mnemo_auto_install_on_quit', next ? 'true' : 'false');
    window.amplify?.setAutoInstallOnQuit?.(next);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(100,116,139,0.12)' }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8' }}>Auto-install on quit</div>
        <div style={{ fontSize: 9, color: '#475569', marginTop: 2 }}>
          When a downloaded update is ready, install it automatically when the app closes.
          Turn off to control when updates apply.
        </div>
      </div>
      <button
        onClick={toggle}
        style={{
          padding: '3px 10px',
          borderRadius: 6,
          fontSize: 10,
          fontWeight: 600,
          cursor: 'pointer',
          border: enabled ? '1px solid rgba(110,231,183,0.4)' : '1px solid rgba(100,116,139,0.3)',
          background: enabled ? 'rgba(110,231,183,0.1)' : 'rgba(100,116,139,0.06)',
          color: enabled ? '#6ee7b7' : '#64748b',
          marginLeft: 12,
          whiteSpace: 'nowrap' as const,
          flexShrink: 0,
        }}
      >
        {enabled ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}

// ─── M21: Update History Modal ────────────────────────────────────────────────

function UpdateHistoryModal({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = React.useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (window.amplify as any)?.getUpdateHistory?.()
      .then((rows: Record<string, unknown>[]) => { setEntries(rows); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const EVENT_COLORS: Record<string, string> = {
    check: '#60a5fa',
    download_started: '#fb923c',
    download_complete: '#4ade80',
    install_scheduled: '#a78bfa',
    check_error: '#f87171',
    download_error: '#f87171',
    install_error: '#f87171',
    'n/a': '#64748b',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'rgba(15,23,42,0.97)', border: '1px solid rgba(100,116,139,0.25)',
        borderRadius: 10, padding: '16px 20px', width: 520, maxHeight: '70vh',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.04em' }}>
            UPDATE HISTORY
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
        {loading ? (
          <div style={{ fontSize: 10, color: '#64748b', fontStyle: 'italic' }}>Loading…</div>
        ) : entries.length === 0 ? (
          <div style={{ fontSize: 10, color: '#64748b' }}>No history yet — history is recorded once automatic updates are active.</div>
        ) : (
          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[...entries].reverse().map((entry, i) => {
              const event = String(entry.event ?? '');
              const color = EVENT_COLORS[event] ?? '#94a3b8';
              const ts = typeof entry.ts === 'string' ? new Date(entry.ts).toLocaleString() : '';
              const extra = Object.entries(entry)
                .filter(([k]) => k !== 'ts' && k !== 'event')
                .map(([k, v]) => `${k}: ${String(v)}`)
                .join(' · ');
              return (
                <div key={i} style={{
                  display: 'flex', gap: 10, padding: '5px 8px',
                  background: 'rgba(30,41,59,0.5)', borderRadius: 5,
                  borderLeft: `3px solid ${color}`,
                }}>
                  <div style={{ fontSize: 9, color: '#64748b', whiteSpace: 'nowrap', minWidth: 120 }}>{ts}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color, whiteSpace: 'nowrap', minWidth: 110 }}>{event}</div>
                  <div style={{ fontSize: 9, color: '#94a3b8', wordBreak: 'break-all' }}>{extra}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── M21: Automatic Updates Section (Block 1) ─────────────────────────────────

type InstallTiming = 'launch' | 'quit' | 'scheduled' | 'approve';

interface AutoUpdateConfig {
  autoUpdates: boolean;
  installTiming: InstallTiming;
  scheduledTime: string;
  majorVersionRequiresApproval: boolean;
}

const DEFAULT_AU_CONFIG: AutoUpdateConfig = {
  autoUpdates: false,
  installTiming: 'quit',
  scheduledTime: '03:00',
  majorVersionRequiresApproval: true,
};

function AutomaticUpdatesSection() {
  const [cfg, setCfg] = React.useState<AutoUpdateConfig>(DEFAULT_AU_CONFIG);
  const [loaded, setLoaded] = React.useState(false);
  const [showConsentModal, setShowConsentModal] = React.useState(false);
  const [showHistoryModal, setShowHistoryModal] = React.useState(false);
  const [pendingApproveVersion, setPendingApproveVersion] = React.useState<{ version: string; readyPath: string } | null>(null);

  // Load config from main process on mount + migrate legacy key
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const remote = await (window.amplify as any)?.getAutoUpdateConfig?.();
        if (!mounted) return;
        if (remote) {
          // Block 6: migrate legacy 'mnemo_auto_install_on_quit' if new config is at default
          const legacyOnQuit = localStorage.getItem('mnemo_auto_install_on_quit');
          if (legacyOnQuit === 'true' && !remote.autoUpdates && remote.installTiming === 'quit') {
            // Already correct default — no migration action needed
          }
          setCfg({ ...DEFAULT_AU_CONFIG, ...remote });
        }
      } catch { /* not available in web / dev */ }
      if (mounted) setLoaded(true);
    })();
    return () => { mounted = false; };
  }, []);

  // Subscribe to approve-required events from main
  React.useEffect(() => {
    const cleanup = (window.amplify as any)?.onAutoUpdateApproveRequired?.((data: { version: string; readyPath: string }) => {
      setPendingApproveVersion(data);
    });
    return cleanup ?? undefined;
  }, []);

  async function persistCfg(updates: Partial<AutoUpdateConfig>): Promise<void> {
    const next = { ...cfg, ...updates };
    setCfg(next);
    try {
      await (window.amplify as any)?.setAutoUpdateConfig?.(updates);
    } catch { /* dev mode noop */ }
  }

  function handleToggle1Click() {
    if (cfg.autoUpdates) {
      // Turn OFF — no modal needed
      persistCfg({ autoUpdates: false });
    } else {
      // Turn ON — show consent modal first
      setShowConsentModal(true);
    }
  }

  async function handleEnableConfirm() {
    setShowConsentModal(false);
    // Block 6: read legacy toggle before enabling
    const legacyOnQuit = localStorage.getItem('mnemo_auto_install_on_quit');
    const timing: InstallTiming = legacyOnQuit === 'false' ? cfg.installTiming : 'quit';
    await persistCfg({ autoUpdates: true, installTiming: timing });
  }

  function handleEnableCancel() {
    setShowConsentModal(false);
    // Toggle stays OFF — no state change
  }

  const s = styles;

  const timingOptions: Array<{ value: InstallTiming; label: string }> = [
    { value: 'launch',    label: 'On next launch' },
    { value: 'quit',      label: 'On quit (default)' },
    { value: 'scheduled', label: 'At a scheduled time' },
    { value: 'approve',   label: 'Approve each update' },
  ];

  if (!loaded) return null;

  return (
    <>
      <section style={s.section} id="settings-section-automatic-updates">
        <div style={s.sectionHeader}>Automatic Updates</div>
        <div style={s.card}>

          {/* Toggle 1: Enable Automatic Updates */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#cbd5e1' }}>Automatic Updates</div>
              <div style={{ fontSize: 9, color: '#475569', marginTop: 2, lineHeight: 1.5 }}>
                {cfg.autoUpdates
                  ? 'MnemosyneC checks for new versions every 6 hours and downloads them in the background. All updates are signed by Liana Banyan Corporation.'
                  : 'Enable to let MnemosyneC check and download updates automatically. You control the install schedule.'}
              </div>
            </div>
            <button
              onClick={handleToggle1Click}
              style={{
                padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                cursor: 'pointer', whiteSpace: 'nowrap' as const, flexShrink: 0,
                border: cfg.autoUpdates ? '1px solid rgba(110,231,183,0.4)' : '1px solid rgba(100,116,139,0.3)',
                background: cfg.autoUpdates ? 'rgba(110,231,183,0.1)' : 'rgba(100,116,139,0.06)',
                color: cfg.autoUpdates ? '#6ee7b7' : '#64748b',
              }}
            >
              {cfg.autoUpdates ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Toggle 2 + Toggle 3 + History — visible only when autoUpdates is ON */}
          {cfg.autoUpdates && (
            <>
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(100,116,139,0.12)' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>
                  Install timing
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 5 }}>
                  {timingOptions.map(({ value, label }) => (
                    <label
                      key={value}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                    >
                      <input
                        type="radio"
                        name="install-timing"
                        value={value}
                        checked={cfg.installTiming === value}
                        onChange={() => persistCfg({ installTiming: value })}
                        style={{ accentColor: '#6ee7b7' }}
                      />
                      <span style={{ fontSize: 10, color: cfg.installTiming === value ? '#e2e8f0' : '#64748b', fontWeight: cfg.installTiming === value ? 600 : 400 }}>
                        {label}
                      </span>
                    </label>
                  ))}
                </div>
                {cfg.installTiming === 'scheduled' && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: '#64748b' }}>Daily at</span>
                    <input
                      type="time"
                      value={cfg.scheduledTime}
                      onChange={(e) => persistCfg({ scheduledTime: e.target.value })}
                      style={{
                        background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(100,116,139,0.25)',
                        borderRadius: 4, color: '#e2e8f0', fontSize: 10, padding: '2px 6px',
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Toggle 3: Major version requires approval */}
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(100,116,139,0.12)' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={cfg.majorVersionRequiresApproval}
                    onChange={(e) => persistCfg({ majorVersionRequiresApproval: e.target.checked })}
                    style={{ accentColor: '#6ee7b7', marginTop: 1 }}
                  />
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#cbd5e1' }}>
                      Major version jumps (e.g. v0.5 → v1.0) always require approval
                    </div>
                    <div style={{ fontSize: 9, color: '#475569', marginTop: 2, lineHeight: 1.5 }}>
                      When enabled, major version updates are announced but not downloaded automatically — you approve each one.
                    </div>
                  </div>
                </label>
              </div>

              {/* Pending approve notification */}
              {cfg.installTiming === 'approve' && pendingApproveVersion && (
                <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 6, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
                  <div style={{ fontSize: 10, color: '#fbbf24', fontWeight: 600, marginBottom: 4 }}>
                    Update v{pendingApproveVersion.version} ready to install
                  </div>
                  <button
                    onClick={() => {
                      (window.amplify as any)?.approveAutoUpdateInstall?.(pendingApproveVersion.readyPath);
                      setPendingApproveVersion(null);
                    }}
                    style={{ ...s.btn, background: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.4)', color: '#fbbf24', fontWeight: 700 }}
                  >
                    Install Now
                  </button>
                </div>
              )}

              {/* View Update History */}
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(100,116,139,0.12)' }}>
                <button
                  onClick={() => setShowHistoryModal(true)}
                  style={{ ...s.btn }}
                >
                  View Update History
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Consent Modal */}
      {showConsentModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'rgba(15,23,42,0.97)', border: '1px solid rgba(100,116,139,0.25)',
            borderRadius: 10, padding: '20px 24px', width: 420, display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>Enable Automatic Updates?</div>
            <p style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.65, margin: 0 }}>
              MnemosyneC will check for new versions every 6 hours and download them in the background.
              Updates will install on your chosen schedule. All updates are cryptographically signed by
              Liana Banyan Corporation — no third party can push updates to your machine. You can disable
              this at any time.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={handleEnableCancel}
                style={{ ...s.btn, color: '#64748b' }}
              >
                Cancel
              </button>
              <button
                onClick={handleEnableConfirm}
                style={{ ...s.btn, background: 'rgba(110,231,183,0.12)', borderColor: 'rgba(110,231,183,0.4)', color: '#6ee7b7', fontWeight: 700 }}
              >
                Enable
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update History Modal */}
      {showHistoryModal && <UpdateHistoryModal onClose={() => setShowHistoryModal(false)} />}
    </>
  );
}

const styles = {
  container: {
    padding: '12px 16px',
    overflowY: 'auto' as const,
    height: '100%',
    boxSizing: 'border-box' as const,
  },
  section: {
    marginBottom: 16,
  } as React.CSSProperties,
  sectionHeader: {
    fontSize: 11,
    fontWeight: 700,
    color: '#94a3b8',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginBottom: 6,
  },
  card: {
    background: 'rgba(15,23,42,0.6)',
    border: '1px solid rgba(100,116,139,0.15)',
    borderRadius: 8,
    padding: '10px 12px',
  } as React.CSSProperties,
  label: {
    fontSize: 10,
    color: '#64748b',
    marginBottom: 4,
  },
  value: {
    fontSize: 12,
    fontWeight: 600,
    color: '#e2e8f0',
  },
  toggleRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 4,
  },
  chip: {
    background: 'rgba(100,116,139,0.08)',
    border: '1px solid rgba(100,116,139,0.2)',
    borderRadius: 6,
    color: '#64748b',
    fontSize: 10,
    fontWeight: 500,
    padding: '4px 10px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  } as React.CSSProperties,
  chipActive: {
    background: 'rgba(110,231,183,0.1)',
    borderColor: 'rgba(110,231,183,0.35)',
    color: '#6ee7b7',
    fontWeight: 700,
  } as React.CSSProperties,
  btn: {
    background: 'rgba(100,116,139,0.1)',
    border: '1px solid rgba(100,116,139,0.25)',
    borderRadius: 6,
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: 600,
    padding: '5px 12px',
    cursor: 'pointer',
  } as React.CSSProperties,
  note: {
    fontSize: 10,
    color: '#6ee7b7',
    background: 'rgba(110,231,183,0.06)',
    border: '1px solid rgba(110,231,183,0.15)',
    borderRadius: 6,
    padding: '5px 10px',
    marginBottom: 6,
  },
  successMsg: {
    fontSize: 10,
    color: '#22c55e',
    marginTop: 6,
    fontWeight: 600,
  },
};

// ─── SEG-Q-4 BP078: Auto-Prepare FULL Upgrade Panel ──────────────────────────

function AutoPreparePullPanel() {
  const [enabled, setEnabled] = React.useState(false);
  const [modelReady, setModelReady] = React.useState(false);
  const [pulling, setPulling] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const s = await window.amplify?.getAutoPrepare?.();
        if (s) { setEnabled(s.enabled); setModelReady(s.modelReady); setPulling(s.pulling); }
      } catch { /* not available */ }
    })();
    const unsub = window.amplify?.onAutoPrepareReady?.(() => {
      setModelReady(true);
      setPulling(false);
    });
    return () => unsub?.();
  }, []);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    window.amplify?.setAutoPrepare?.(next);
    if (next && !modelReady) setPulling(true);
  }

  return (
    <section style={styles.section} id="settings-section-auto-prepare">
      <div style={styles.sectionHeader}>Auto-Prepare FULL Upgrade</div>
      <div style={styles.card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={styles.label}>
              Download Google's Gemma 4 12B in background
              {modelReady && <span style={{ marginLeft: 8, color: '#4ade80', fontWeight: 700, fontSize: 10 }}>READY</span>}
              {pulling && !modelReady && <span style={{ marginLeft: 8, color: '#fbbf24', fontWeight: 700, fontSize: 10 }}>Pulling...</span>}
            </div>
            <div style={{ fontSize: 9, color: '#475569', marginTop: 2, lineHeight: 1.5 }}>
              When ON, MnemosyneC silently pulls the Google's Gemma 4 12B model on launch and every 30 min
              while idle. When the download completes, you will receive a notification asking to
              activate. You must click Activate to switch to FULL tier. Nothing activates automatically.
            </div>
          </div>
          <button
            onClick={toggle}
            style={{
              ...styles.chip,
              flexShrink: 0,
              ...(enabled ? { ...styles.chipActive, color: '#4ade80', borderColor: 'rgba(74,222,128,0.4)' } : {}),
            }}
          >
            {enabled ? 'ON' : 'OFF'}
          </button>
        </div>
        {modelReady && (
          <div style={{ marginTop: 8, fontSize: 10, color: '#4ade80', fontWeight: 600 }}>
            Google's Gemma 4 12B is ready on this machine. Open AI Tier above to activate it.
          </div>
        )}
      </div>
    </section>
  );
}

// ─── BP081 K-2: MCP Substrate Bridge Panel ────────────────────────────────────

interface McpStatus {
  running: boolean;
  port: number | null;
  connectedClients: number;
  recentCalls: Array<{ tool: string; ts: number; clientId: string }>;
}

function McpSubstrateBridgePanel() {
  const [status, setStatus] = React.useState<McpStatus | null>(null);
  const [tokenPreview, setTokenPreview] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;

    async function fetchStatus() {
      try {
        const s = await (window.amplify as any)?.mcpGetStatus?.();
        if (mounted && s) setStatus(s);
      } catch { /* not available */ }
      if (mounted) setLoading(false);
    }

    async function fetchToken() {
      try {
        const t = await (window.amplify as any)?.mcpGetAuthToken?.();
        if (mounted && typeof t === 'string' && t.length > 0) {
          setTokenPreview(t.slice(0, 8) + '...');
        }
      } catch { /* not available */ }
    }

    fetchStatus();
    fetchToken();

    const interval = setInterval(fetchStatus, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  function handleCopyToken() {
    (async () => {
      try {
        const t = await (window.amplify as any)?.mcpGetAuthToken?.();
        if (typeof t === 'string') {
          await navigator.clipboard.writeText(t);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      } catch { /* noop */ }
    })();
  }

  const dotStyle: React.CSSProperties = {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    marginRight: 6,
    background: status?.running ? '#4ade80' : '#ef4444',
    boxShadow: status?.running ? '0 0 6px #4ade80' : 'none',
    verticalAlign: 'middle',
  };

  return (
    <section style={styles.section} id="settings-section-mcp-bridge">
      <div style={styles.sectionHeader}>MCP Substrate Bridge</div>
      <div style={styles.card}>
        {loading ? (
          <div style={{ fontSize: 10, color: '#64748b' }}>Loading MCP status...</div>
        ) : (
          <>
            {/* Status row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ fontSize: 11, color: '#cbd5e1', display: 'flex', alignItems: 'center' }}>
                  <span style={dotStyle} />
                  <span style={{ fontWeight: 600, marginRight: 4 }}>
                    {status?.running ? 'Running' : 'Offline'}
                  </span>
                </div>
                {status?.running && (
                  <div style={{ fontSize: 10, color: '#64748b' }}>
                    Port: <span style={{ color: '#93c5fd', fontFamily: 'monospace' }}>
                      {status.port ?? 11456}
                    </span>
                  </div>
                )}
                <div style={{ fontSize: 10, color: '#64748b' }}>
                  Clients: <span style={{ color: '#93c5fd' }}>{status?.connectedClients ?? 0}</span>
                </div>
              </div>
              <div style={{ fontSize: 9, color: '#475569', fontStyle: 'italic' }}>
                5 tools registered
              </div>
            </div>

            {/* Auth token row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: '#94a3b8', flex: 1 }}>
                Bearer token:{' '}
                <span style={{ fontFamily: 'monospace', color: '#e2e8f0', letterSpacing: 1 }}>
                  {tokenPreview ?? '—'}
                </span>
              </div>
              <button
                onClick={handleCopyToken}
                style={{
                  fontSize: 9,
                  padding: '3px 10px',
                  borderRadius: 4,
                  border: '1px solid rgba(148,163,184,0.3)',
                  background: copied ? 'rgba(74,222,128,0.15)' : 'rgba(51,65,85,0.6)',
                  color: copied ? '#4ade80' : '#94a3b8',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  fontWeight: copied ? 700 : 400,
                  minWidth: 54,
                  textAlign: 'center',
                }}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            {/* Recent calls */}
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Recent Calls
            </div>
            {!status?.recentCalls?.length ? (
              <div style={{ fontSize: 10, color: '#475569', fontStyle: 'italic' }}>
                No calls yet — connect a client to /mcp on port {status?.port ?? 11456}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {status.recentCalls.map((call, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 9,
                      padding: '3px 6px',
                      borderRadius: 4,
                      background: 'rgba(30,41,59,0.6)',
                      border: '1px solid rgba(51,65,85,0.4)',
                    }}
                  >
                    <span style={{ fontFamily: 'monospace', color: '#93c5fd' }}>{call.tool}</span>
                    <span style={{ color: '#475569' }}>
                      {new Date(call.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Endpoint hint */}
            <div style={{
              marginTop: 10,
              fontSize: 9,
              color: '#334155',
              padding: '5px 8px',
              borderRadius: 4,
              background: 'rgba(15,23,42,0.4)',
              fontFamily: 'monospace',
              letterSpacing: 0.3,
            }}>
              http://127.0.0.1:{status?.port ?? 11456}/mcp — add to Claude Desktop or Cursor MCP config
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// ─── BP084 SEG-6: Substrate Index Counter Panel ────────────────────────────────

interface EbletIndexStatsPayload {
  totalIndexed: number;
  byCategory: Record<string, number>;
  lastRefreshTimestamp: number | null;
}

function SubstrateCounterPanel() {
  const [stats, setStats] = React.useState<EbletIndexStatsPayload | null>(null);
  const [verifiedCount, setVerifiedCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;

    async function fetchStats() {
      try {
        const result = await (window.amplify as any)?.ipcInvoke?.('ai-dispatch:eblet-index-stats');
        if (!mounted) return;
        if (result?.ok && result.stats) {
          setStats(result.stats as EbletIndexStatsPayload);
          setVerifiedCount(result.verifiedCount ?? 0);
          setError(null);
        } else if (result?.error) {
          setError(result.error);
        }
      } catch (e) {
        if (mounted) setError(String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchStats();
    const interval = setInterval(fetchStats, 30_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const lastRefresh = stats?.lastRefreshTimestamp
    ? new Date(stats.lastRefreshTimestamp).toLocaleString()
    : 'not yet indexed';

  const canonCount = stats?.byCategory?.['canon'] ?? 0;
  const activeCount = stats?.byCategory?.['active'] ?? 0;
  const pixieCount = stats?.byCategory?.['pixie-dust'] ?? 0;
  const snapshotCount = stats?.byCategory?.['snapshot-canon'] ?? 0;
  const totalCanon = canonCount + snapshotCount;

  return (
    <section style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
        Substrate Index
      </div>
      <div style={{
        background: 'rgba(15,23,42,0.7)',
        border: '1px solid rgba(51,65,85,0.5)',
        borderRadius: 8,
        padding: '12px 14px',
      }}>
        {loading ? (
          <div style={{ fontSize: 10, color: '#64748b', fontStyle: 'italic' }}>Loading index stats…</div>
        ) : error ? (
          <div style={{ fontSize: 10, color: '#f87171' }}>Index unavailable: {error}</div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 600, marginBottom: 6 }}>
              {totalCanon.toLocaleString()} canon eblets
              {verifiedCount > 0 && (
                <span style={{ color: '#34d399', marginLeft: 6 }}>
                  + {verifiedCount.toLocaleString()} verified-runtime eblets
                </span>
              )}{' '}
              indexed.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
              {[
                { label: 'canon', value: canonCount, color: '#818cf8' },
                { label: 'active', value: activeCount, color: '#38bdf8' },
                { label: 'snapshot', value: snapshotCount, color: '#a78bfa' },
                { label: 'pixie-dust', value: pixieCount, color: '#fb923c' },
                { label: 'verified', value: verifiedCount, color: '#34d399' },
              ].filter((b) => b.value > 0).map((badge) => (
                <span
                  key={badge.label}
                  style={{
                    fontSize: 9,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: 'rgba(30,41,59,0.8)',
                    border: `1px solid ${badge.color}44`,
                    color: badge.color,
                    fontWeight: 600,
                  }}
                >
                  {badge.label}: {badge.value.toLocaleString()}
                </span>
              ))}
            </div>
            <div style={{ fontSize: 9, color: '#475569' }}>
              Last refresh: {lastRefresh}
            </div>
            <div style={{ fontSize: 9, color: '#334155', marginTop: 4 }}>
              BM25 priority: verified › canon › active › snapshot › trail › pixie-dust.{' '}
              Use <code style={{ color: '#7dd3fc' }}>category:pixie-dust</code> prefix to query historical-mine.
            </div>
          </>
        )}
      </div>
    </section>
  );
}
