// NexusAuthoritySettings.tsx -- BP137 Yoke v2b Stage C ("Chrome-MCP Nexus Authority"), item 2:
// the per-arm brain/authority picker.
//
// WHY THIS FILE EXISTS (Bishop audit): today, every arm (compute / lookup-fact / reasoning)
// is answered by whatever this app's existing pipeline already does, with no user-visible
// control over WHICH source answers a given kind of question, and no way for the user to
// opt into routing a lookup-fact question through their OWN logged-in Google/Perplexity
// session (see src/main/plow/browser_authority_adapter.ts for that mechanism) instead of
// the existing free specialist-adapter swarm or an escalation to a paid API. This panel is
// that control surface. Per the Bishop prompt's explicit requirement, every arm defaults to
// a free authority ('local_free') -- nothing here ever defaults to 'paid_api'.
//
// STYLE: mirrors this repo's existing Settings-panel conventions closely --
// src/renderer/hearth/conjunction/ApiKeysSettings.tsx's section/row/pill layout and dark
// palette, and SettingsTab.tsx's `<section>` + sectionHeader banner convention (see that
// file's AutomaticUpdatesSection for the closest analog: a self-contained settings block
// that loads/persists its own state and renders as one more <section> in the Settings tab).
// This component is intentionally self-contained (no props) so mounting it is a single,
// isolated JSX line -- see SettingsTab.tsx's own new `<NexusAuthoritySettings />` line for
// where it is wired in.

import { useCallback, useEffect, useState } from 'react';
import {
  NEXUS_ARM_NAMES,
  NEXUS_AUTHORITY_OPTIONS,
  type NexusArmName,
  type NexusAuthorityName,
} from '../../shared/plow/browser_authority_types';
import {
  loadNexusAuthoritySettings,
  saveResearchArmMode,
  setArmAuthority,
} from './nexus_authority_settings_store';

const ARM_LABELS: Record<NexusArmName, string> = {
  computable: 'Compute',
  lookup_fact: 'Lookup (fact-finding)',
  reasoning: 'Reasoning',
};

const ARM_DESCRIPTIONS: Record<NexusArmName, string> = {
  computable: 'Questions with a deterministic numeric/symbolic answer (e.g. unit conversions, arithmetic).',
  lookup_fact: 'Questions answerable by looking up a single fact (e.g. "what year did X happen").',
  reasoning: 'Open-ended questions that need multi-step reasoning rather than a single lookup.',
};

export function NexusAuthoritySettings() {
  const [loaded, setLoaded] = useState(false);
  const [researchArmMode, setResearchArmMode] = useState(false);
  const [researchArmBrowserAuthority, setResearchArmBrowserAuthority] = useState(false);
  const [perArm, setPerArm] = useState<Record<NexusArmName, NexusAuthorityName>>(() => {
    const init: Record<NexusArmName, NexusAuthorityName> = {} as Record<NexusArmName, NexusAuthorityName>;
    for (const arm of NEXUS_ARM_NAMES) init[arm] = 'local_free';
    return init;
  });

  useEffect(() => {
    const snapshot = loadNexusAuthoritySettings();
    setResearchArmMode(snapshot.researchArmMode);
    setResearchArmBrowserAuthority(snapshot.researchArmBrowserAuthority);
    setPerArm(snapshot.perArmAuthority);
    setLoaded(true);
  }, []);

  // KN-BP144-3 Phase 1 (one gate, not two): toggling the master switch now also flips
  // researchArmBrowserAuthority in lockstep (see saveResearchArmMode()'s own comment in
  // nexus_authority_settings_store.ts) -- update both pieces of local state together so this
  // panel's own read-only sub-flag row (below) never has a stale frame where it disagrees with
  // what was just persisted.
  const handleModeToggle = useCallback(() => {
    setResearchArmMode((prev) => {
      const next = !prev;
      saveResearchArmMode(next);
      setResearchArmBrowserAuthority(next);
      return next;
    });
  }, []);

  const handleArmAuthorityChange = useCallback((arm: NexusArmName, authority: NexusAuthorityName) => {
    const next = setArmAuthority(arm, authority);
    setPerArm(next);
  }, []);

  if (!loaded) return null;

  const s = styles;

  return (
    <section style={s.section} id="settings-section-nexus-authority">
      <div style={s.sectionHeader}>Nexus Authority (BP137)</div>
      <div style={s.card}>
        <div style={s.introText}>
          Choose which authority answers each kind of question. Free/local options are always
          the default -- browser and paid options are opt-in only.
        </div>

        {/* Master switch */}
        <div style={s.toggleRow}>
          <div style={{ flex: 1 }}>
            <div style={s.toggleLabel}>Research Arm</div>
            <div style={s.toggleDesc}>
              Master switch for this Yoke's new research paths. Off means every arm behaves
              exactly as it did before BP137.
            </div>
          </div>
          <button
            style={{
              ...s.pill,
              background: researchArmMode ? 'rgba(110,231,183,0.12)' : 'rgba(100,116,139,0.08)',
              borderColor: researchArmMode ? 'rgba(110,231,183,0.4)' : 'rgba(100,116,139,0.3)',
              color: researchArmMode ? '#6ee7b7' : '#64748b',
            }}
            onClick={handleModeToggle}
            aria-label="Toggle Research Arm master switch"
          >
            {researchArmMode ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* KN-BP144-3 Phase 1: this used to be an INDEPENDENT clickable sub-switch a user had to
            separately remember to turn on -- the exact "silent second gate" this ticket's WHY
            section names (ensureNexusAuthoritySession() ANDs this with researchArmMode, and a
            user who only ever flips the master switch above never saw this row at all unless
            they expanded it). It is now a read-only status line: saveResearchArmMode() always
            keeps researchArmBrowserAuthority equal to researchArmMode, so there is exactly ONE
            control (Research Arm, above) and this row exists only to make that fact visible,
            never to invite a second, independently-forgettable decision. */}
        {researchArmMode && (
          <div style={s.toggleRow}>
            <div style={{ flex: 1 }}>
              <div style={s.toggleLabel}>User's Browser Session</div>
              <div style={s.toggleDesc}>
                Included automatically whenever Research Arm is ON -- no separate switch to
                forget. Lets the lookup arm use your own logged-in Google/Perplexity/Claude/
                ChatGPT/Gemini session (via the embedded Nexus browser) instead of only the
                local specialist-adapter swarm.
              </div>
            </div>
            <div
              style={{
                ...s.pill,
                cursor: 'default',
                background: researchArmBrowserAuthority ? 'rgba(110,231,183,0.12)' : 'rgba(100,116,139,0.08)',
                borderColor: researchArmBrowserAuthority ? 'rgba(110,231,183,0.4)' : 'rgba(100,116,139,0.3)',
                color: researchArmBrowserAuthority ? '#6ee7b7' : '#64748b',
              }}
              title="Follows Research Arm automatically -- not independently editable"
              aria-label="Browser-authority sub-flag status (read-only, follows Research Arm)"
            >
              {researchArmBrowserAuthority ? 'ON' : 'OFF'}
            </div>
          </div>
        )}

        {/* Per-arm picker */}
        <div style={s.armList}>
          {NEXUS_ARM_NAMES.map((arm) => (
            <div key={arm} style={s.armRow}>
              <div style={s.armHeader}>
                <span style={s.armName}>{ARM_LABELS[arm]}</span>
                <span style={s.armDesc}>{ARM_DESCRIPTIONS[arm]}</span>
              </div>
              <div style={s.optionGrid}>
                {NEXUS_AUTHORITY_OPTIONS.map((opt) => {
                  const selected = perArm[arm] === opt.authority;
                  const disabled = (opt.authority === 'user_google' || opt.authority === 'user_perplexity')
                    && !(researchArmMode && researchArmBrowserAuthority);
                  return (
                    <button
                      key={opt.authority}
                      style={{
                        ...s.optionBtn,
                        ...(selected ? s.optionBtnSelected : {}),
                        opacity: disabled ? 0.45 : 1,
                        cursor: disabled ? 'not-allowed' : 'pointer',
                      }}
                      disabled={disabled}
                      title={disabled ? "Enable Research Arm + User's Browser Session above first" : opt.description}
                      onClick={() => handleArmAuthorityChange(arm, opt.authority)}
                      aria-pressed={selected}
                      aria-label={`Set ${ARM_LABELS[arm]} authority to ${opt.label}`}
                    >
                      <span>{opt.label}</span>
                      <span style={{ ...s.freeTag, color: opt.free ? '#6ee7b7' : '#fbbf24' }}>
                        {opt.free ? '$0' : 'paid'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={s.footerNote}>
          Choices are saved on this device and survive a restart. Wiring these choices into the
          live answer pipeline is tracked separately (BP137 Yoke v2b Stage C item 4, deferred).
        </div>
      </div>
    </section>
  );
}

// ─── Styles (palette matches ApiKeysSettings.tsx / SettingsTab.tsx dark theme) ────────────────

const styles: Record<string, React.CSSProperties> = {
  section: { margin: '0 0 8px' },
  sectionHeader: {
    fontSize: 12,
    fontWeight: 700,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: 8,
  },
  card: {
    background: 'rgba(30,41,59,0.5)',
    border: '1px solid rgba(100,116,139,0.2)',
    borderRadius: 10,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  introText: {
    fontSize: 10.5,
    color: '#94a3b8',
    lineHeight: 1.5,
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 8,
    borderTop: '1px solid rgba(100,116,139,0.12)',
  },
  toggleLabel: { fontSize: 11, fontWeight: 600, color: '#cbd5e1' },
  toggleDesc: { fontSize: 9, color: '#64748b', marginTop: 2, lineHeight: 1.5 },
  pill: {
    padding: '3px 10px',
    borderRadius: 6,
    fontSize: 10,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    border: '1px solid',
  },
  armList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    paddingTop: 8,
    borderTop: '1px solid rgba(100,116,139,0.12)',
  },
  armRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  armHeader: { display: 'flex', flexDirection: 'column', gap: 2 },
  armName: { fontSize: 10.5, fontWeight: 700, color: '#e2e8f0' },
  armDesc: { fontSize: 9, color: '#64748b', lineHeight: 1.4 },
  optionGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  optionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'rgba(15,23,42,0.6)',
    border: '1px solid rgba(100,116,139,0.3)',
    borderRadius: 6,
    padding: '4px 8px',
    fontSize: 9.5,
    color: '#94a3b8',
    fontWeight: 600,
  },
  optionBtnSelected: {
    border: '1px solid rgba(110,231,183,0.5)',
    background: 'rgba(110,231,183,0.1)',
    color: '#6ee7b7',
  },
  freeTag: {
    fontSize: 8.5,
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  footerNote: {
    fontSize: 8.5,
    color: '#475569',
    fontStyle: 'italic',
    lineHeight: 1.5,
  },
};
