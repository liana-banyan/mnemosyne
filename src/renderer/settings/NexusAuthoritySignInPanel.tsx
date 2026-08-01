// NexusAuthoritySignInPanel.tsx -- BP137 0.9.12 Stage F1 ("persistent, always-on, logged-in
// browser authority"), build item 3: the Settings "Authorities" (aka Nexus) sign-in panel.
//
// WHY THIS FILE EXISTS: NexusAuthoritySettings.tsx (Stage C) already lets the user pick WHICH
// authority answers each arm, but has no control to actually establish (or check) a real
// Google/Perplexity login for the persistent background session
// (nexus_authority_persistent_session.ts) that Stage F1 adds. This panel is that control: a
// one-time VISIBLE sign-in launcher + an honest per-authority signed-in/not-signed-in status
// probe. It never fabricates "signed in" -- every status shown here comes straight from the
// main process's cheap DOM-marker probe (see nexus_authority_persistent_session.ts's
// probeAllNexusAuthorityStatuses()); a probe that can't confirm a login is always rendered as
// "Not signed in", never defaulted to true.
//
// STYLE: mirrors NexusAuthoritySettings.tsx's section/card/toggleRow conventions exactly (same
// dark palette, same disabled-until-flags-on pattern) so it reads as one continuous "Nexus
// Authority (BP137)" settings area rather than a visually distinct add-on.

import { useCallback, useEffect, useState } from 'react';
import { loadNexusAuthoritySettings } from './nexus_authority_settings_store';

// BP140-K4: widened from 3 to 5 members (chatgpt/gemini added). Kept as an independent literal
// union here rather than a cross-layer import of the shared BrowserAuthorityName -- same
// convention this file's own header note already documents for every renderer-side setting type
// on this page (no cross-Electron-boundary import).
type AuthorityKey = 'user_google' | 'user_perplexity' | 'user_claude' | 'user_chatgpt' | 'user_gemini';

interface AuthorityRowState {
  status: 'unknown' | 'checking' | 'signed_in' | 'not_signed_in';
  reason: string | null;
}

const AUTHORITY_LABELS: Record<AuthorityKey, string> = {
  user_google: 'Google',
  user_perplexity: 'Perplexity',
  user_claude: 'Claude',
  user_chatgpt: 'ChatGPT',
  user_gemini: 'Gemini',
};

const INITIAL_ROW_STATE: AuthorityRowState = { status: 'unknown', reason: null };

export function NexusAuthoritySignInPanel() {
  const [loaded, setLoaded] = useState(false);
  const [flagsEnabled, setFlagsEnabled] = useState(false);
  const [rows, setRows] = useState<Record<AuthorityKey, AuthorityRowState>>({
    user_google: INITIAL_ROW_STATE,
    user_perplexity: INITIAL_ROW_STATE,
    user_claude: INITIAL_ROW_STATE,
    user_chatgpt: INITIAL_ROW_STATE,
    user_gemini: INITIAL_ROW_STATE,
  });
  const [sessionOpen, setSessionOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const refresh = () => {
      const snapshot = loadNexusAuthoritySettings();
      setFlagsEnabled(snapshot.researchArmMode && snapshot.researchArmBrowserAuthority);
    };
    refresh();
    setLoaded(true);
    window.addEventListener('nexus-authority-settings-changed', refresh);
    return () => window.removeEventListener('nexus-authority-settings-changed', refresh);
  }, []);

  const handleOpenSignIn = useCallback(async (authority: AuthorityKey) => {
    setBusy(true);
    try {
      const result = await window.amplify?.openNexusAuthoritySignIn?.(authority);
      if (result?.ok) {
        setSessionOpen(true);
      }
    } catch {
      /* non-fatal -- the button simply stays available to retry */
    } finally {
      setBusy(false);
    }
  }, []);

  const handleHideSignIn = useCallback(async () => {
    setBusy(true);
    try {
      await window.amplify?.hideNexusAuthoritySession?.();
    } catch {
      /* non-fatal */
    } finally {
      setSessionOpen(false);
      setBusy(false);
    }
  }, []);

  const handleCheckStatus = useCallback(async () => {
    setBusy(true);
    setRows((prev) => ({
      user_google: { ...prev.user_google, status: 'checking' },
      user_perplexity: { ...prev.user_perplexity, status: 'checking' },
      user_claude: { ...prev.user_claude, status: 'checking' },
      user_chatgpt: { ...prev.user_chatgpt, status: 'checking' },
      user_gemini: { ...prev.user_gemini, status: 'checking' },
    }));
    try {
      const result = await window.amplify?.checkNexusAuthoritySignInStatus?.();
      if (result) {
        setFlagsEnabled(result.enabled);
        const next: Record<AuthorityKey, AuthorityRowState> = {
          user_google: INITIAL_ROW_STATE,
          user_perplexity: INITIAL_ROW_STATE,
          user_claude: INITIAL_ROW_STATE,
          user_chatgpt: INITIAL_ROW_STATE,
          user_gemini: INITIAL_ROW_STATE,
        };
        for (const s of result.statuses) {
          // Never fabricate "signed in" -- the probe's own honest boolean is the ONLY thing
          // that can set status to 'signed_in'; every other outcome (including a malformed or
          // missing entry) falls through to 'not_signed_in'.
          next[s.authority as AuthorityKey] = { status: s.signedIn ? 'signed_in' : 'not_signed_in', reason: s.reason };
        }
        setRows(next);
      }
    } catch {
      setRows({
        user_google: { status: 'not_signed_in', reason: 'probe_call_failed' },
        user_perplexity: { status: 'not_signed_in', reason: 'probe_call_failed' },
        user_claude: { status: 'not_signed_in', reason: 'probe_call_failed' },
        user_chatgpt: { status: 'not_signed_in', reason: 'probe_call_failed' },
        user_gemini: { status: 'not_signed_in', reason: 'probe_call_failed' },
      });
    } finally {
      setBusy(false);
    }
  }, []);

  if (!loaded) return null;

  const s = styles;

  return (
    <section style={s.section} id="settings-section-nexus-authority-signin">
      <div style={s.sectionHeader}>Authorities (Nexus sign-in)</div>
      <div style={s.card}>
        <div style={s.introText}>
          Sign into your own Google, Perplexity, Claude, ChatGPT, and Gemini accounts once, in a
          window that opens visibly for this purpose only -- the app never sees your password,
          and every lookup afterward runs against YOUR logged-in session, at your own $0 quota.
        </div>

        {!flagsEnabled && (
          <div style={s.disabledNotice}>
            Enable <strong>Research Arm</strong> + <strong>User&apos;s Browser Session</strong>{' '}
            above to activate Google/Perplexity sign-in.
          </div>
        )}

        <div style={{ ...s.armList, opacity: flagsEnabled ? 1 : 0.45 }}>
          {(['user_google', 'user_perplexity', 'user_claude', 'user_chatgpt', 'user_gemini'] as AuthorityKey[]).map((authority) => {
            const row = rows[authority];
            const pillLabel =
              row.status === 'checking' ? 'Checking…' :
              row.status === 'signed_in' ? 'Signed in' :
              row.status === 'not_signed_in' ? 'Not signed in' :
              'Unknown';
            const pillColor =
              row.status === 'signed_in' ? '#6ee7b7' :
              row.status === 'not_signed_in' ? '#fbbf24' :
              '#64748b';
            return (
              <div key={authority} style={s.authorityRow}>
                <div style={{ flex: 1 }}>
                  <div style={s.authorityName}>{AUTHORITY_LABELS[authority]}</div>
                  <div style={{ ...s.statusPill, color: pillColor }}>
                    ● {pillLabel}
                    {row.reason && row.status !== 'checking' ? ` (${row.reason})` : ''}
                  </div>
                </div>
                <button
                  style={s.actionBtn}
                  disabled={!flagsEnabled || busy}
                  onClick={() => handleOpenSignIn(authority)}
                  title={
                    flagsEnabled
                      ? `Open a visible window to sign into ${AUTHORITY_LABELS[authority]}`
                      : "Enable Research Arm + User's Browser Session above first"
                  }
                >
                  Sign in to {AUTHORITY_LABELS[authority]}
                </button>
              </div>
            );
          })}
        </div>

        <div style={s.toggleRow}>
          <button
            style={s.actionBtn}
            disabled={!flagsEnabled || busy}
            onClick={handleCheckStatus}
            title={flagsEnabled ? 'Re-check signed-in status for both authorities' : "Enable Research Arm + User's Browser Session above first"}
          >
            Check status
          </button>
          {sessionOpen && (
            <button style={s.actionBtn} disabled={busy} onClick={handleHideSignIn} title="Hide the sign-in window (the session stays alive in the background)">
              Done -- hide sign-in window
            </button>
          )}
        </div>

        <div style={s.footerNote}>
          This session runs in the background at all times once enabled -- you never need to
          reopen it for a lookup to work. Status is never assumed: if the probe can&apos;t find
          your account marker on the page, it is reported as Not signed in, never Signed in.
        </div>
      </div>
    </section>
  );
}

// ─── Styles (palette matches NexusAuthoritySettings.tsx / ApiKeysSettings.tsx dark theme) ─────

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
  disabledNotice: {
    fontSize: 10,
    color: '#fbbf24',
    background: 'rgba(251,191,36,0.08)',
    border: '1px solid rgba(251,191,36,0.25)',
    borderRadius: 6,
    padding: '6px 8px',
    lineHeight: 1.5,
  },
  armList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    paddingTop: 8,
    borderTop: '1px solid rgba(100,116,139,0.12)',
  },
  authorityRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '6px 0',
  },
  authorityName: { fontSize: 11, fontWeight: 700, color: '#e2e8f0' },
  statusPill: { fontSize: 9.5, fontWeight: 600, marginTop: 2 },
  actionBtn: {
    background: 'rgba(15,23,42,0.6)',
    border: '1px solid rgba(100,116,139,0.3)',
    borderRadius: 6,
    padding: '5px 10px',
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  toggleRow: {
    display: 'flex',
    gap: 8,
    paddingTop: 8,
    borderTop: '1px solid rgba(100,116,139,0.12)',
  },
  footerNote: {
    fontSize: 8.5,
    color: '#475569',
    fontStyle: 'italic',
    lineHeight: 1.5,
  },
};
