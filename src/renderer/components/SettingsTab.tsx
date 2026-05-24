// SettingsTab — Mnemosyne CAI Amplifier Settings
// Tab 4 (always visible) — BP047 W1
// Sections: Update · Appearance · AI Model Assignment · Substrate · Developer Mode · My Contribution
// Auto-updater is top-priority item (Founder direct)
// KniPr034: My Contribution panel added — read-only scaffold, data binding next wave

import React, { useState, useEffect } from 'react';
import type { AuthState } from '../amplify.d';
import { LocFaqModal } from './LocFaqPanel';

interface SettingsTabProps {
  authState: AuthState | null;
  onDevModeToggle?: (enabled: boolean) => void;
  devEnabled?: boolean;
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
        setWriteError('Could not write consent Eblet — check permissions.');
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
      setWriteError('Revocation write failed — check permissions.');
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
              Chronos Research Opt-In
            </div>
            <div style={cs.desc}>
              Contribute anonymized action data to the Liana Banyan research corpus.
              Your participation earns Marks and supports the cooperative's AI research mission.
              <br />
              <span style={cs.kNote}>k-anonymity = 10: your data is only shared when at least 10 other members take the same action.</span>
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
            Learn more: What is Chronos? →
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
                timestamped, sha256-signed observation — the Chronos tab.
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

const MODE_OPTIONS: Array<{ id: SubstrateMode; label: string; desc: string }> = [
  { id: 'ai_burst',  label: '🔥 AI Burst',  desc: 'Claude AI for enhanced analysis · free API key from console.anthropic.com · pay-per-token' },
  { id: 'normal',    label: '🪵 Normal',     desc: 'Balanced · Ollama local AI · recommended for most tasks · zero marginal cost' },
  { id: 'fallback',  label: '❄️ Fallback',   desc: 'Substrate-only · no AI required · Stage 2 mode · always offline-capable' },
];

export function SettingsTab({ authState, onDevModeToggle, devEnabled = false }: SettingsTabProps) {
  const isMember = authState?.status === 'member' || authState?.status === 'trial_active';
  const isFounder = (authState as any)?.member?.is_founder === true;
  const [showLocFaq, setShowLocFaq] = useState(false);

  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    checking: false,
    upToDate: null,
    currentVersion: '',
    latestVersion: null,
    error: null,
  });

  const [theme, setTheme] = useState<Theme>(() =>
    (localStorage.getItem('mnemo_theme') as Theme | null) ?? 'dark'
  );

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
      const result = await (window as any).amplify?.checkForUpdate?.();
      if (result === null || result === undefined) {
        setUpdateStatus((s) => ({ ...s, checking: false, upToDate: true, latestVersion: s.currentVersion }));
      } else {
        setUpdateStatus((s) => ({ ...s, checking: false, upToDate: false, latestVersion: result }));
      }
    } catch (err) {
      setUpdateStatus((s) => ({ ...s, checking: false, error: 'Update check failed — try again later.' }));
    }
  }

  function handleThemeChange(t: Theme) {
    setTheme(t);
    localStorage.setItem('mnemo_theme', t);
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

  return (
    <div style={s.container}>

      {/* ── Section 1: MNEMOSYNE UPDATE ─────────────────────────────────── */}
      <section style={s.section}>
        <div style={s.sectionHeader}>⬆️ Mnemosyne™ Update</div>
        <div style={s.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={s.label}>Current strain</div>
              <div style={s.value}>{updateStatus.currentVersion || '—'}</div>
            </div>
            {updateStatus.latestVersion && !updateStatus.upToDate && (
              <div>
                <div style={s.label}>Available</div>
                <div style={{ ...s.value, color: '#6ee7b7' }}>{updateStatus.latestVersion}</div>
              </div>
            )}
            <button
              onClick={handleCheckForUpdate}
              disabled={updateStatus.checking}
              style={{ ...s.btn, opacity: updateStatus.checking ? 0.6 : 1 }}
            >
              {updateStatus.checking ? 'Checking…' : 'Check for update'}
            </button>
          </div>

          {updateStatus.upToDate === true && (
            <div style={s.successMsg}>✓ You're on the latest strain</div>
          )}
          {updateStatus.upToDate === false && updateStatus.latestVersion && (
            <div style={{ ...s.card, marginTop: 8, background: 'rgba(110,231,183,0.06)' }}>
              <div style={{ fontSize: 11, color: '#6ee7b7', fontWeight: 600, marginBottom: 6 }}>
                Mnemosyne {updateStatus.latestVersion} is available
              </div>
              <button
                style={{ ...s.btn, background: 'rgba(110,231,183,0.15)', borderColor: 'rgba(110,231,183,0.4)' }}
                onClick={() => (window as any).amplify?.installUpdate?.()}
              >
                Install + Restart →
              </button>
            </div>
          )}
          {updateStatus.error && (
            <div style={{ fontSize: 10, color: '#f87171', marginTop: 6 }}>{updateStatus.error}</div>
          )}
        </div>
      </section>

      {/* ── Section 2: APPEARANCE ────────────────────────────────────────── */}
      <section style={s.section}>
        <div style={s.sectionHeader}>🎨 Appearance</div>
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
      </section>

      {/* ── Section 3: AI MODEL ASSIGNMENT ──────────────────────────────── */}
      <section style={s.section}>
        <div style={s.sectionHeader}>🤖 AI Model Assignment</div>
        <div style={s.note}>
          FREE AI: Ollama (onboard by default) — no cloud account, no API key, no cost
        </div>
        {(['bishop', 'knight', 'pawn', 'rook'] as const).map((piece) => (
          <div key={piece} style={{ ...s.card, marginBottom: 6 }}>
            <div style={s.label}>
              {piece === 'bishop' ? '✍️ Bishop' : piece === 'knight' ? '♞ Knight' : piece === 'pawn' ? '♟ Pawn' : '♜ Rook'}
            </div>
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
      </section>

      {/* ── Section 4: SUBSTRATE MODE ────────────────────────────────────── */}
      <section style={s.section}>
        <div style={s.sectionHeader}>⚙️ Substrate Mode</div>
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
        <section style={s.section}>
          <div style={s.sectionHeader}>🔧 Developer Mode</div>
          <div style={s.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={s.label}>Cooperative Defensive Patent Pledge #2260</div>
                <div style={{ fontSize: 9, color: '#475569', marginTop: 2 }}>
                  {devEnabled ? 'Developer mode active · submit variants · fork strains · SEG controls' : 'Requires membership + Pledge #2260 agreement'}
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

      {/* ── Section 6: RESEARCH PARTICIPATION (KniPr038) ─────────────────── */}
      <ChronosResearchPanel />

      {/* ── Section 7: MY CONTRIBUTION ───────────────────────────────────── */}
      <MyContributionPanel />

      {/* ── Section 8: GRAND PROJECTS (KniPr022) ────────────────────────── */}
      <section style={s.section}>
        <div style={s.sectionHeader}>🏛️ Grand Projects</div>
        <div style={s.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0', marginBottom: 3 }}>
                Library of Congress Grand Project
              </div>
              <div style={{ fontSize: 9, color: '#64748b', lineHeight: 1.5 }}>
                10,000-node cooperative network · digitizing human knowledge · free forever
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
              Library of Congress FAQ →
            </button>
          </div>
        </div>
      </section>

      {showLocFaq && <LocFaqModal onClose={() => setShowLocFaq(false)} />}

    </div>
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
