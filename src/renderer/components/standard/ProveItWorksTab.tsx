// SEG-K23-D — Prove It Works: honest poller health check (Truth-Always §2)
// BP136 Yoke: extended with the answer-cache mode toggle + real (restart-surviving) meter
// summary. "Nothing that isn't real" -- every number below comes from
// ai-dispatch:answer-cache-meter-summary, which reads the persisted per-query JSONL log.
// BP139: extended with Authority Proof Panel -- sign-in status + live test query + result.

import React, { useState, useCallback, useEffect, useRef } from 'react';
// BP1xx Browser Authority enable-toggle unification (this build pass): reuse the SAME
// mnem_drt_specialists load/save/persist path SettingsTab.tsx's MnemDrtPanel already uses
// (localStorage 'mnemo_mnem_drt' mirror + amplify.aiDispatch.saveSettings round-trip to
// ai_dispatch_settings.json) rather than inventing a second, possibly-diverging persistence
// path. See SettingsTab.tsx's own export comment above these three for the rationale.
import { loadMnemDrt, saveMnemDrt, persistMnemDrtToBackend } from '../SettingsTab';

export interface ProveItWorksTabProps {
  onFirstComplete?: () => void;
  onSwitchTab?: (tab: string) => void;
}

type CheckState = 'idle' | 'checking' | 'alive' | 'offline';

// BP139 Authority Proof Panel types
type AuthorityCheckState = 'idle' | 'checking' | 'done' | 'error';
type AuthorityTestState = 'idle' | 'running' | 'done' | 'error';

interface AuthoritySignInRow {
  authority: 'user_google' | 'user_perplexity' | 'user_claude';
  signedIn: boolean;
  reason: string;
  checkedAt: string;
}

interface AuthorityTestResult {
  answerType: 'computable' | 'lookup_fact' | 'reasoning';
  usable: boolean;
  reason?: 'flag_off' | 'not_lookup_fact' | 'authority_empty';
  fact?: string;
  sourceUrl?: string;
  authority?: 'user_google' | 'user_perplexity';
  confidence?: number;
}

const AUTHORITY_LABELS: Record<string, string> = {
  user_google: 'Google',
  user_perplexity: 'Perplexity',
  user_claude: 'Claude',
};

const REASON_EXPLANATIONS: Record<string, string> = {
  flag_off: 'Research Arm + Browser Authority flags are both OFF in Settings > Authorities. Enable them there, then retry.',
  not_lookup_fact: 'The question was not classified as a lookup-fact (a single verifiable fact). Try a question like "what year did the Berlin Wall fall".',
  authority_empty: 'Both Google and Perplexity were tried but neither returned a usable result. Check that you are signed in to both authorities.',
};

const DEFAULT_TEST_QUESTION = 'what year did the Berlin Wall fall';

interface MeterSummary {
  total_queries: number;
  served_verbatim_count: number;
  rag_count: number;
  local_generate_count: number;
  flagship_count: number;
  cloud_cost_avoided_usd: number;
  avg_latency_ms: number;
  avg_served_verbatim_latency_ms: number;
}

function panelStyle(): React.CSSProperties {
  return {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(148, 163, 184, 0.06)',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    borderRadius: 6,
  };
}

export function ProveItWorksTab(props: ProveItWorksTabProps) {
  const { onFirstComplete, onSwitchTab } = props;
  const [checkState, setCheckState] = useState<CheckState>('idle');
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [hasCompleted, setHasCompleted] = useState(false);

  // BP136: answer-cache mode toggle + meter summary
  const [cacheModeOn, setCacheModeOn] = useState(false);
  const [cacheModeLoaded, setCacheModeLoaded] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [meter, setMeter] = useState<MeterSummary | null>(null);
  const [loadingMeter, setLoadingMeter] = useState(false);

  // BP139: Authority Proof Panel
  const [authorityCheckState, setAuthorityCheckState] = useState<AuthorityCheckState>('idle');
  const [flagsEnabled, setFlagsEnabled] = useState<boolean | null>(null);
  const [signInStatuses, setSignInStatuses] = useState<AuthoritySignInRow[] | null>(null);
  const [testQuestion, setTestQuestion] = useState(DEFAULT_TEST_QUESTION);
  const [testState, setTestState] = useState<AuthorityTestState>('idle');
  const [testResult, setTestResult] = useState<AuthorityTestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const testQuestionRef = useRef(testQuestion);

  // BP1xx Browser Authority enable-toggle unification: mirrors the SAME
  // mnem_drt_specialists Record<string, boolean> SettingsTab.tsx's MnemDrtPanel reads/writes,
  // keyed by 'user_google' | 'user_perplexity' | 'user_claude' (BrowserLlmAuthorityName). Loaded
  // once from the localStorage mirror on mount -- same read path loadMnemDrt() always uses, no
  // new source of truth.
  const [authorityEnabled, setAuthorityEnabled] = useState<Record<string, boolean>>(
    () => loadMnemDrt().mnem_drt_specialists,
  );

  const refreshMeter = useCallback(async () => {
    setLoadingMeter(true);
    try {
      const res = await window.amplify?.aiDispatch?.getAnswerCacheMeterSummary?.();
      if (res?.ok && res.summary) setMeter(res.summary);
    } catch {
      // non-fatal — panel just shows the last-known (or empty) state
    }
    setLoadingMeter(false);
  }, []);

  // BP139: check authority sign-in status + flag state
  const refreshAuthorityStatus = useCallback(async () => {
    setAuthorityCheckState('checking');
    try {
      const res = await window.amplify?.checkNexusAuthoritySignInStatus?.();
      if (res) {
        setFlagsEnabled(res.enabled ?? false);
        setSignInStatuses(res.statuses ?? []);
        setAuthorityCheckState('done');
      } else {
        setAuthorityCheckState('error');
      }
    } catch {
      setAuthorityCheckState('error');
    }
  }, []);

  // BP139: run a live test query through the authority chain
  const runAuthorityTest = useCallback(async () => {
    const q = testQuestionRef.current.trim();
    if (!q) return;
    setTestState('running');
    setTestResult(null);
    setTestError(null);
    try {
      const res = await window.amplify?.nexusAskLookupFact?.(q) as AuthorityTestResult | undefined;
      if (res) {
        setTestResult(res);
        setTestState('done');
      } else {
        setTestError('No response from authority IPC');
        setTestState('error');
      }
    } catch (e) {
      setTestError(String(e));
      setTestState('error');
    }
  }, []);

  // BP1xx Browser Authority enable-toggle unification: "the toggle IS the login trigger"
  // (Founder BP1xx). Writes mnem_drt_specialists[authority] through the SAME
  // load-current/merge/save/persist sequence SettingsTab.tsx's updateSpecialist() uses --
  // reading loadMnemDrt() fresh (not the closed-over `drt` this file doesn't have) so this never
  // clobbers other specialist keys (wikipedia/wolfram/etc.) that MnemDrtPanel may have already
  // saved. When switching ON while not currently signed in, also opens the SAME nexus sign-in
  // window NexusAuthoritySignInPanel.tsx's own "Sign in to X" button opens
  // (window.amplify.openNexusAuthoritySignIn) -- toggle-on doubles as the login trigger.
  const toggleAuthorityEnabled = useCallback((authority: 'user_google' | 'user_perplexity' | 'user_claude', nextVal: boolean, signedIn: boolean) => {
    const current = loadMnemDrt();
    const next = { ...current, mnem_drt_specialists: { ...current.mnem_drt_specialists, [authority]: nextVal } };
    saveMnemDrt(next);
    void persistMnemDrtToBackend(next);
    setAuthorityEnabled(next.mnem_drt_specialists);
    if (nextVal && !signedIn) {
      void window.amplify?.openNexusAuthoritySignIn?.(authority);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await window.amplify?.aiDispatch?.getSettings?.();
        if (res?.ok && res.settings) setCacheModeOn(res.settings.answer_cache_mode === true);
      } catch {
        // non-fatal — defaults to OFF, which matches the real default
      }
      setCacheModeLoaded(true);
    })();
    void refreshMeter();
    // BP139: auto-probe authority status on mount so the panel is not cold
    void refreshAuthorityStatus();
  }, [refreshMeter, refreshAuthorityStatus]);

  // BP139: keep the ref in sync so runAuthorityTest captures the latest question
  useEffect(() => { testQuestionRef.current = testQuestion; }, [testQuestion]);

  const toggleCacheMode = useCallback(async () => {
    const next = !cacheModeOn;
    setToggling(true);
    setCacheModeOn(next);
    try {
      await window.amplify?.aiDispatch?.saveSettings?.({ answer_cache_mode: next });
    } catch {
      // non-fatal — UI stays optimistic; next getSettings() read will reconcile
    }
    setToggling(false);
  }, [cacheModeOn]);

  const runCheck = useCallback(async () => {
    setCheckState('checking');
    setCheckedAt(null);

    try {
      const result = await (window as any).amplify?.pollerHealthQuery?.();
      const timestamp = new Date().toISOString();
      setCheckedAt(timestamp);

      if (result?.alive === true) {
        setCheckState('alive');
      } else {
        setCheckState('offline');
      }

      if (!hasCompleted) {
        setHasCompleted(true);
        onFirstComplete?.();
      }
    } catch {
      setCheckedAt(new Date().toISOString());
      setCheckState('offline');
    }
  }, [hasCompleted, onFirstComplete]);

  return (
    <div style={{ padding: 16, height: '100%', boxSizing: 'border-box', overflowY: 'auto' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
        Prove It Works
      </div>
      <div style={{ fontSize: 11, color: '#707070', marginBottom: 4, lineHeight: 1.5 }}>
        Serve the frontier answer instantly at $0 — real counters only, nothing fabricated.
      </div>

      {/* BP136: Answer Cache mode toggle */}
      <div style={panelStyle()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>Answer Cache</div>
            <div style={{ fontSize: 11, color: '#707070', marginTop: 2, lineHeight: 1.5 }}>
              When ON, an exact or near-identical repeat question is served straight from the
              verified answer store — $0, no model call. Default is OFF.
            </div>
          </div>
          <button
            type="button"
            onClick={() => void toggleCacheMode()}
            disabled={toggling || !cacheModeLoaded}
            style={{
              flexShrink: 0,
              padding: '6px 14px',
              backgroundColor: cacheModeOn ? 'rgba(100, 200, 150, 0.15)' : 'rgba(148, 163, 184, 0.1)',
              border: `1px solid ${cacheModeOn ? 'rgba(100, 200, 150, 0.5)' : 'rgba(148, 163, 184, 0.3)'}`,
              borderRadius: 5,
              color: cacheModeOn ? '#8bc8a0' : '#94a3b8',
              fontSize: 12,
              fontWeight: 700,
              cursor: toggling ? 'wait' : 'pointer',
              minWidth: 52,
            }}
          >
            {cacheModeOn ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* BP136: The Meter — real counters */}
      <div style={panelStyle()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>The Meter</div>
          <button
            type="button"
            onClick={() => void refreshMeter()}
            disabled={loadingMeter}
            title="Refresh"
            style={{
              background: 'none',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              borderRadius: 4,
              color: '#94a3b8',
              fontSize: 11,
              padding: '2px 8px',
              cursor: loadingMeter ? 'wait' : 'pointer',
            }}
          >
            {loadingMeter ? '…' : '↻ Refresh'}
          </button>
        </div>
        {meter && meter.total_queries > 0 ? (
          <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.9 }}>
            <div>
              Served free (from substrate): <b style={{ color: '#6ee7b7' }}>{meter.served_verbatim_count}</b> of{' '}
              {meter.total_queries} queries
            </div>
            <div>
              Estimated cost avoided: <b style={{ color: '#6ee7b7' }}>${meter.cloud_cost_avoided_usd.toFixed(4)}</b>{' '}
              <span style={{ color: '#606060' }}>(estimate — not a guarantee)</span>
            </div>
            {meter.avg_served_verbatim_latency_ms > 0 && (
              <div>Avg latency, served free: {meter.avg_served_verbatim_latency_ms}ms</div>
            )}
            <div style={{ color: '#606060' }}>
              RAG-assisted: {meter.rag_count} · Local generate: {meter.local_generate_count} · Flagship: {meter.flagship_count}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#606060', fontStyle: 'italic' }}>
            No queries recorded yet. Ask a question, then come back and refresh.
          </div>
        )}
      </div>

      <div style={{ fontSize: 11, color: '#707070', margin: '20px 0 4px', lineHeight: 1.5 }}>
        Press the button to confirm your substrate poller is live.
      </div>

      <button
        type="button"
        onClick={() => void runCheck()}
        disabled={checkState === 'checking'}
        style={{
          padding: '10px 20px',
          backgroundColor: 'rgba(100, 200, 150, 0.15)',
          border: '1px solid rgba(100, 200, 150, 0.5)',
          borderRadius: 4,
          color: '#8bc8a0',
          fontSize: 14,
          fontWeight: 600,
          cursor: checkState === 'checking' ? 'wait' : 'pointer',
          opacity: checkState === 'checking' ? 0.7 : 1,
        }}
      >
        Prove It Works ▶
      </button>

      {checkState === 'checking' && (
        <div style={{ marginTop: 16, fontSize: 12, color: '#909090', fontStyle: 'italic' }}>
          Checking poller health…
        </div>
      )}

      {checkState === 'alive' && (
        <div style={{ marginTop: 16, padding: 12, backgroundColor: 'rgba(100, 200, 150, 0.08)', border: '1px solid rgba(100, 200, 150, 0.3)', borderRadius: 4 }}>
          <div style={{ fontSize: 13, color: '#8bc8a0', lineHeight: 1.5 }}>
            Substrate is alive — poller responding. Use the Ask tab to run a live query.
          </div>
          {checkedAt && (
            <div style={{ fontSize: 10, color: '#606060', marginTop: 8 }}>
              Checked at: {checkedAt}
            </div>
          )}
        </div>
      )}

      {checkState === 'offline' && (
        <div style={{ marginTop: 16, padding: 12, backgroundColor: 'rgba(200, 100, 100, 0.08)', border: '1px solid rgba(200, 100, 100, 0.3)', borderRadius: 4 }}>
          <div style={{ fontSize: 13, color: '#c8a0a0', lineHeight: 1.5 }}>
            Substrate poller not responding. Try starting MnemosyneC&apos;s Ollama integration, then return here.
          </div>
          {checkedAt && (
            <div style={{ fontSize: 10, color: '#606060', marginTop: 8 }}>
              Checked at: {checkedAt}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => onSwitchTab?.('ask')}
        style={{
          marginTop: 20,
          padding: '6px 14px',
          backgroundColor: 'transparent',
          border: '1px solid rgba(100, 200, 150, 0.3)',
          borderRadius: 4,
          color: '#8bc8a0',
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        Ask a question and watch the badge → Ask tab
      </button>

      {/* BP139: Authority Proof Panel -- sign-in status + live test query */}
      <div style={{ marginTop: 24, borderTop: '1px solid rgba(148,163,184,0.15)', paddingTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>Browser Authority</div>
          <button
            type="button"
            onClick={() => void refreshAuthorityStatus()}
            disabled={authorityCheckState === 'checking'}
            style={{
              background: 'none', border: '1px solid rgba(148,163,184,0.3)', borderRadius: 4,
              color: '#94a3b8', fontSize: 11, padding: '2px 8px',
              cursor: authorityCheckState === 'checking' ? 'wait' : 'pointer',
            }}
          >
            {authorityCheckState === 'checking' ? '...' : 'Refresh'}
          </button>
        </div>
        <div style={{ fontSize: 11, color: '#707070', marginBottom: 10, lineHeight: 1.5 }}>
          Verify that the browser authority is signed in and can return a sourced fact.
          Flags must be ON in Settings &gt; Authorities.
        </div>

        {/* Flags gate */}
        {flagsEnabled !== null && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '3px 8px', borderRadius: 4, marginBottom: 8,
            background: flagsEnabled ? 'rgba(110,231,183,0.1)' : 'rgba(200,100,100,0.08)',
            border: `1px solid ${flagsEnabled ? 'rgba(110,231,183,0.35)' : 'rgba(200,100,100,0.3)'}`,
            fontSize: 11, color: flagsEnabled ? '#6ee7b7' : '#c87070', fontWeight: 600,
          }}>
            {flagsEnabled ? 'Flags ON' : 'Flags OFF -- enable Research Arm + Browser Authority in Settings'}
          </div>
        )}

        {/* Sign-in status rows -- BP1xx: each row is now also an enable toggle (the toggle IS
            the login trigger: switching ON while not signed in opens the nexus sign-in window). */}
        {signInStatuses && signInStatuses.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
            {signInStatuses.map((s) => {
              const enabled = authorityEnabled[s.authority] ?? false;
              return (
                <div key={s.authority} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '4px 8px', borderRadius: 4,
                  background: s.signedIn ? 'rgba(110,231,183,0.06)' : 'rgba(148,163,184,0.06)',
                  border: `1px solid ${s.signedIn ? 'rgba(110,231,183,0.25)' : 'rgba(148,163,184,0.2)'}`,
                  fontSize: 11,
                }}>
                  <span style={{
                    fontWeight: 700,
                    color: s.signedIn ? '#6ee7b7' : '#94a3b8',
                  }}>
                    {s.signedIn ? 'Signed in' : 'Not signed in'}
                  </span>
                  <span style={{ color: '#64748b' }}>{AUTHORITY_LABELS[s.authority] ?? s.authority}</span>
                  {!s.signedIn && s.reason && (
                    <span style={{ color: '#475569', fontSize: 10 }}>{s.reason}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleAuthorityEnabled(s.authority, !enabled, s.signedIn)}
                    title={
                      enabled
                        ? `Disable ${AUTHORITY_LABELS[s.authority] ?? s.authority} as an authority`
                        : s.signedIn
                          ? `Enable ${AUTHORITY_LABELS[s.authority] ?? s.authority} as an authority`
                          : `Enable ${AUTHORITY_LABELS[s.authority] ?? s.authority} and sign in`
                    }
                    style={{
                      marginLeft: 'auto', flexShrink: 0,
                      padding: '3px 10px', borderRadius: 4,
                      background: enabled ? 'rgba(100,200,150,0.15)' : 'rgba(148,163,184,0.1)',
                      border: `1px solid ${enabled ? 'rgba(100,200,150,0.5)' : 'rgba(148,163,184,0.3)'}`,
                      color: enabled ? '#8bc8a0' : '#94a3b8',
                      fontSize: 10, fontWeight: 700, cursor: 'pointer', minWidth: 40,
                    }}
                  >
                    {enabled ? 'ON' : 'OFF'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ fontSize: 10, color: '#64748b', marginTop: -6, marginBottom: 10, lineHeight: 1.5 }}>
          Off by default. Switching an authority ON while it is not signed in also opens its
          sign-in window.
        </div>
        {authorityCheckState === 'error' && (
          <div style={{ fontSize: 11, color: '#f87171', marginBottom: 8 }}>
            Could not probe authority status -- app may be starting up.
          </div>
        )}

        {/* Live test section */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Test question:</div>
          <input
            type="text"
            value={testQuestion}
            onChange={(e) => setTestQuestion(e.target.value)}
            disabled={testState === 'running'}
            placeholder="e.g. what year did the Berlin Wall fall"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '6px 10px', borderRadius: 4,
              background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(148,163,184,0.3)',
              color: '#e2e8f0', fontSize: 12, fontFamily: 'system-ui, sans-serif',
              outline: 'none',
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => void runAuthorityTest()}
          disabled={testState === 'running' || !testQuestion.trim()}
          style={{
            padding: '7px 16px',
            backgroundColor: 'rgba(100,200,150,0.15)',
            border: '1px solid rgba(100,200,150,0.5)',
            borderRadius: 4, color: '#8bc8a0', fontSize: 12, fontWeight: 600,
            cursor: (testState === 'running' || !testQuestion.trim()) ? 'wait' : 'pointer',
            opacity: (testState === 'running' || !testQuestion.trim()) ? 0.6 : 1,
          }}
        >
          {testState === 'running' ? 'Querying authority...' : 'Test Authority'}
        </button>

        {/* Result display */}
        {testState === 'done' && testResult && (
          <div style={{
            marginTop: 10, padding: 10, borderRadius: 4,
            background: testResult.usable ? 'rgba(110,231,183,0.06)' : 'rgba(148,163,184,0.06)',
            border: `1px solid ${testResult.usable ? 'rgba(110,231,183,0.25)' : 'rgba(148,163,184,0.2)'}`,
          }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{
                padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                background: testResult.usable ? 'rgba(110,231,183,0.15)' : 'rgba(200,100,100,0.15)',
                color: testResult.usable ? '#6ee7b7' : '#f87171',
                border: `1px solid ${testResult.usable ? 'rgba(110,231,183,0.4)' : 'rgba(200,100,100,0.3)'}`,
              }}>
                {testResult.usable ? 'USABLE' : 'NOT USABLE'}
              </span>
              <span style={{
                padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                background: 'rgba(148,163,184,0.1)', color: '#94a3b8',
                border: '1px solid rgba(148,163,184,0.2)',
              }}>
                {testResult.answerType}
              </span>
              {testResult.authority && (
                <span style={{
                  padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                  background: 'rgba(148,163,184,0.1)', color: '#94a3b8',
                  border: '1px solid rgba(148,163,184,0.2)',
                }}>
                  via {AUTHORITY_LABELS[testResult.authority] ?? testResult.authority}
                </span>
              )}
              {testResult.confidence !== undefined && (
                <span style={{
                  padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                  background: 'rgba(148,163,184,0.1)', color: '#94a3b8',
                  border: '1px solid rgba(148,163,184,0.2)',
                }}>
                  confidence {Math.round(testResult.confidence * 100)}%
                </span>
              )}
            </div>
            {testResult.usable && testResult.fact && (
              <div style={{ fontSize: 12, color: '#f0fdf4', fontWeight: 600, marginBottom: 4, lineHeight: 1.5 }}>
                {testResult.fact}
              </div>
            )}
            {testResult.usable && testResult.sourceUrl && (
              <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.4, wordBreak: 'break-all' }}>
                Source:{' '}
                <span
                  role="link"
                  tabIndex={0}
                  onClick={() => window.amplify?.openExternal?.(testResult.sourceUrl!)}
                  onKeyDown={(e) => e.key === 'Enter' && window.amplify?.openExternal?.(testResult.sourceUrl!)}
                  style={{ color: '#6ee7b7', textDecoration: 'underline', cursor: 'pointer' }}
                >
                  {testResult.sourceUrl}
                </span>
              </div>
            )}
            {!testResult.usable && testResult.reason && (
              <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
                <span style={{ fontWeight: 700, color: '#fca5a5' }}>{testResult.reason}</span>
                {' -- '}
                {REASON_EXPLANATIONS[testResult.reason] ?? 'No explanation available.'}
              </div>
            )}
          </div>
        )}
        {testState === 'error' && testError && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#f87171' }}>Error: {testError}</div>
        )}
      </div>
    </div>
  );
}