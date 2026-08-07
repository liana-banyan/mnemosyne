// BoardPanel.tsx -- KN-BP144-10 T1/T2/T4/T5: Grand Central board panel.
//
// Renders the SAME rows and alarms board.mjs computes (ported in src/main/board/
// board_state_reader.ts, read via IPC through board_subscription.ts) -- this component itself
// never touches the filesystem or spawns git (T3). The only write path is the single "mark
// dispatched" button (T4), which reads and writes the same HARDWIRE\board_state.json board.mjs
// itself writes -- no second state store.
//
// T5: nothing fabricated. Every cell either shows a real value from the last snapshot or the
// literal string "unknown" -- no placeholder rows, no simulated timings, no Math.random().

import { useState, useEffect, useCallback, useMemo } from 'react';
import { boardSubscription, DEFAULT_BOARD_STATE, alarmCount } from './board_subscription';
import type { BoardState, BoardRow, BoardAlarm, VerifyOrphanResult } from './board_subscription';

// BP148 D-BP148-028: alarm messages carry the ticket id as their own literal prefix (see
// board_state_reader.ts's ORPHANED alarm: `${r.id} has a report claiming...`) -- extracted here
// with a trailing-space boundary so "KN-BP144-1" and "KN-BP144-11" never cross-match.
function orphanIdFromAlarm(message: string): string | null {
  const m = message.match(/^(KN-BP\d+-\d+)\s/);
  return m ? m[1] : null;
}

type VerifyState =
  | { status: 'loading' }
  | { status: 'done'; result: VerifyOrphanResult }
  | { status: 'error'; message: string };

function statusColor(status: BoardRow['status']): string {
  switch (status) {
    case 'REPORTED': return '#22c55e';
    case 'PHASE0-REPORTED': return '#38bdf8';
    case 'COMMITTED': return '#63b3ed';
    case 'WORKING': return '#f6ad55';
    case 'DISPATCHED': return '#a78bfa';
    case 'REPORT-NO-COMMIT': return '#ef4444';
    case 'written': return '#718096';
    default: return '#718096';
  }
}

function alarmColor(kind: BoardAlarm['kind']): string {
  switch (kind) {
    case 'COLLISION': return '#ef4444';
    case 'COLLISION-RISK': return '#f6ad55';
    case 'DOUBLE-BOOKED': return '#ef4444';
    case 'STALLED': return '#f6ad55';
    case 'ORPHANED': return '#ef4444';
    case 'IDLE': return '#63b3ed';
    case 'UNOWNED': return '#f6ad55';
    default: return '#718096';
  }
}

function relTime(iso: string | null): string {
  if (!iso) return 'unknown';
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin === 1) return '1 min ago';
  if (diffMin < 60) return `${diffMin} min ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

/** BP148 D-BP148-028: renders the Verify button's real result -- one of three honest states
 *  (commit found / nothing found / uncommitted in the working tree), always WITH the evidence
 *  (hash, repo, files, date), never a bare verdict. "Show the evidence, not just a verdict" is
 *  the whole point of this ticket -- a green tick the user must trust is the same problem in a
 *  nicer costume. */
function VerifyEvidence({ state }: { state: VerifyState }) {
  if (state.status === 'loading') {
    return <div style={styles.verifyPanel}>searching mnemosyne + LianaBanyanPlatform (git log, git status)…</div>;
  }
  if (state.status === 'error') {
    return <div style={{ ...styles.verifyPanel, color: '#fca5a5' }}>Verify failed: {state.message.slice(0, 300)}</div>;
  }

  const { result } = state;

  if (result.verdict === 'unknown-ticket') {
    return <div style={{ ...styles.verifyPanel, color: '#fca5a5' }}>unknown ticket: {result.error ?? `no dropzone ticket matches ${result.id}`}</div>;
  }

  const anyCommits = result.repos.some((r) => r.commits.length > 0);
  const anyDirty = result.repos.some((r) => r.dirty.length > 0);

  return (
    <div style={styles.verifyPanel}>
      <div style={{ ...styles.verifyVerdict, color: result.verdict === 'found' ? '#22c55e' : result.verdict === 'uncommitted' ? '#f6ad55' : '#ef4444' }}>
        {result.verdict === 'found' && 'COMMIT FOUND'}
        {result.verdict === 'uncommitted' && 'UNCOMMITTED IN WORKING TREE'}
        {result.verdict === 'not_found' && 'NOTHING FOUND — this report is genuinely unbacked'}
        <span style={styles.verifySubtle}> · claimed file: {result.claimedTarget ?? 'unknown'}{result.claimedSecondary.length > 0 ? ` (+${result.claimedSecondary.length} secondary)` : ''}</span>
      </div>

      {result.error && <div style={{ ...styles.verifySubtle, color: '#fca5a5' }}>git error during search: {result.error.slice(0, 200)}</div>}

      {!anyCommits && !anyDirty && (
        <div style={styles.verifySubtle}>searched both repos (all branches) by ticket id and by claimed file path — no matching commit, no uncommitted change.</div>
      )}

      {result.repos.map((r) => (
        <div key={r.repo} style={styles.verifyRepoBlock}>
          <div style={styles.verifyRepoHeader}>{r.repo} <span style={styles.verifySubtle}>({r.repoPath})</span></div>
          {r.commits.length === 0 && r.dirty.length === 0 && <div style={styles.verifySubtle}>nothing found here</div>}
          {r.commits.map((c) => (
            <div key={c.sha} style={styles.verifyCommitRow}>
              <span style={styles.verifySha}>{c.sha.slice(0, 10)}</span>
              <span style={styles.verifySubtle}>{new Date(c.iso).toLocaleString()}</span>
              <span style={styles.verifyBadge}>{c.matchedBy === 'ticket-id' ? 'matched: ticket id' : `matched: file (${c.matchedFile})`}</span>
              <span style={styles.verifySubj}>{c.subj}</span>
              {c.files.length > 0 && (
                <span style={styles.verifySubtle}>files: {c.files.slice(0, 6).join(', ')}{c.files.length > 6 ? ` +${c.files.length - 6} more` : ''}</span>
              )}
            </div>
          ))}
          {r.dirty.length > 0 && (
            <div style={styles.verifyDirty}>
              uncommitted in working tree: {r.dirty.map((d) => d.trim()).join(' · ')}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function BoardPanel() {
  const [state, setState] = useState<BoardState>(DEFAULT_BOARD_STATE);
  const [selectedTicket, setSelectedTicket] = useState<string>('');
  const [dispatching, setDispatching] = useState(false);
  const [dispatchMsg, setDispatchMsg] = useState<string | null>(null);
  // BP148 D-BP148-028: per-ticket Verify state, keyed by ticket id -- lets multiple orphan
  // cards be verified independently without clobbering each other's result.
  const [verifyState, setVerifyState] = useState<Record<string, VerifyState>>({});

  useEffect(() => {
    const unsub = boardSubscription.subscribe(setState);
    return unsub;
  }, []);

  const rows = state.snapshot?.rows ?? null;
  const alarms = state.snapshot?.alarms ?? null;
  const count = alarmCount(state);

  const undispatched = useMemo(
    () => (rows ?? []).filter((r) => r.status === 'written').map((r) => r.id),
    [rows],
  );

  useEffect(() => {
    if (!selectedTicket && undispatched.length) setSelectedTicket(undispatched[0]);
  }, [undispatched, selectedTicket]);

  const handleMarkDispatched = useCallback(async () => {
    if (!selectedTicket) return;
    setDispatching(true);
    setDispatchMsg(null);
    try {
      const result = await window.amplify.boardMarkDispatched?.(selectedTicket);
      if (result?.ok) {
        setDispatchMsg(`Recorded dispatch: ${selectedTicket} at ${result.dispatchedAt ?? 'unknown'}`);
        await boardSubscription.refreshNow();
      } else {
        setDispatchMsg(`Failed: ${result?.error ?? 'unknown error'}`);
      }
    } catch (err) {
      setDispatchMsg(`Failed: ${String(err)}`);
    }
    setDispatching(false);
  }, [selectedTicket]);

  // BP148 D-BP148-028: read-only. Never marks dispatched, never touches board_state.json --
  // just asks the main process to search real git history/working-tree status and show what it
  // finds. See board_verify.ts for the actual search.
  const handleVerify = useCallback(async (id: string) => {
    setVerifyState((prev) => ({ ...prev, [id]: { status: 'loading' } }));
    try {
      const result = await window.amplify.boardVerifyOrphan?.(id);
      if (result) {
        setVerifyState((prev) => ({ ...prev, [id]: { status: 'done', result } }));
      } else {
        setVerifyState((prev) => ({ ...prev, [id]: { status: 'error', message: 'no response from main process' } }));
      }
    } catch (err) {
      setVerifyState((prev) => ({ ...prev, [id]: { status: 'error', message: String(err) } }));
    }
  }, []);

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <span style={styles.title}>Grand Central — The Board</span>
        <span style={styles.subtitle}>
          {state.loading && !state.snapshot ? 'loading…' : state.snapshot ? `computed ${relTime(state.snapshot.computedAt)}` : 'unknown'}
        </span>
        {count !== null && count > 0 && (
          <span style={styles.badge}>{count} alarm{count === 1 ? '' : 's'}</span>
        )}
      </div>

      {state.error && <div style={styles.errorBanner}>⚠ polling error: {state.error.slice(0, 160)}</div>}
      {state.snapshot?.gitError && (
        <div style={styles.errorBanner}>⚠ git shell-out failed this cycle (showing last-known-good rows below): {state.snapshot.gitError.slice(0, 200)}</div>
      )}

      {/* ── T1: ticket rows, same six states board.mjs computes ───────────── */}
      <div style={styles.tableWrap}>
        {rows === null ? (
          <div style={styles.unknown}>unknown — no snapshot received yet</div>
        ) : rows.length === 0 ? (
          <div style={styles.unknown}>no tickets found in dropzone</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Ticket</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Worker</th>
                <th style={styles.th}>Target</th>
                <th style={styles.th}>Mode</th>
                <th style={styles.th}>Last commit</th>
                <th style={styles.th}>At</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={styles.td}>{r.id}</td>
                  <td style={{ ...styles.td, color: statusColor(r.status), fontWeight: 700 }}>{r.status}</td>
                  <td style={styles.td}>{r.worker ?? ''}</td>
                  <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: '0.68rem' }}>
                    {r.target ?? 'unknown'}
                    {r.secondaryCount > 0 && <span style={{ color: '#718096' }}> +{r.secondaryCount}</span>}
                  </td>
                  <td style={styles.td}>{r.mode ?? 'unknown'}</td>
                  <td style={{ ...styles.td, fontFamily: 'monospace' }}>{r.lastSha || 'unknown'}</td>
                  <td style={styles.td}>{r.lastWhen || (r.dispatchedAt ? `dispatched ${relTime(r.dispatchedAt)}` : 'unknown')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── T2: the five alarms board.mjs actually computes ──────────────── */}
      <div style={styles.alarmsSection}>
        <div style={styles.alarmsHeader}>Alarms</div>
        {alarms === null ? (
          <div style={styles.unknown}>unknown — no snapshot received yet</div>
        ) : alarms.length === 0 ? (
          <div style={styles.noAlarms}>none</div>
        ) : (
          alarms.map((a, i) => {
            const orphanId = a.kind === 'ORPHANED' ? orphanIdFromAlarm(a.message) : null;
            const vs = orphanId ? verifyState[orphanId] : undefined;
            return (
              <div key={`${a.kind}-${i}`} style={styles.alarmCard}>
                <div style={styles.alarmRow}>
                  <span style={{ ...styles.alarmKind, color: alarmColor(a.kind) }}>{a.kind}</span>
                  <span style={styles.alarmMsg}>{a.message}</span>
                  {/* ── T-verify (BP148 D-BP148-028): "Verify before believing it" gets an
                      actual verify affordance -- searches real git history/working-tree state
                      in both repos, read-only, shows the evidence found (or its honest
                      absence). Only rendered for ORPHANED cards; other alarm kinds are not
                      report-vs-commit claims and have nothing for this button to check. ── */}
                  {orphanId && (
                    <button
                      style={styles.verifyBtn}
                      onClick={() => handleVerify(orphanId)}
                      disabled={vs?.status === 'loading'}
                    >
                      {vs?.status === 'loading' ? 'Verifying…' : 'Verify'}
                    </button>
                  )}
                </div>
                {orphanId && vs && <VerifyEvidence state={vs} />}
              </div>
            );
          })
        )}
      </div>

      {state.snapshot && (
        <div style={styles.footerRow}>
          repo dirty: {state.snapshot.dirtyFiles.length} file(s) under src ·{' '}
          newest receipt: {state.snapshot.newestReceipt ? `${state.snapshot.newestReceipt.name} (${state.snapshot.newestReceipt.minsAgo}m ago)` : 'unknown'}
        </div>
      )}

      {/* ── T4: one button, mark dispatched. Reads/writes board_state.json only. ─ */}
      <div style={styles.dispatchSection}>
        <select
          style={styles.select}
          value={selectedTicket}
          onChange={(e) => setSelectedTicket(e.target.value)}
          disabled={!undispatched.length}
        >
          {undispatched.length === 0 && <option value="">no undispatched tickets</option>}
          {undispatched.map((id) => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
        <button
          style={{ ...styles.dispatchBtn, opacity: dispatching || !selectedTicket ? 0.5 : 1 }}
          onClick={handleMarkDispatched}
          disabled={dispatching || !selectedTicket}
        >
          {dispatching ? 'Recording…' : 'Mark dispatched'}
        </button>
        {dispatchMsg && <span style={styles.dispatchMsg}>{dispatchMsg}</span>}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto',
    background: '#0a0f1a', color: '#e2e8f0', padding: '0.9rem', gap: '0.6rem',
    fontFamily: 'system-ui, sans-serif', boxSizing: 'border-box',
  },
  header: { display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' },
  title: { fontWeight: 700, fontSize: '0.95rem', color: '#f0fdf4' },
  subtitle: { fontSize: '0.7rem', color: '#718096' },
  badge: {
    background: '#7f1d1d', color: '#fca5a5', borderRadius: 10, padding: '2px 8px',
    fontSize: '0.68rem', fontWeight: 700,
  },
  errorBanner: {
    background: '#2d1b1b', border: '1px solid #7f1d1d', color: '#fca5a5',
    borderRadius: 6, padding: '0.4rem 0.6rem', fontSize: '0.72rem',
  },
  tableWrap: { border: '1px solid #1e2a38', borderRadius: 6, overflow: 'auto', flexShrink: 0 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' },
  th: {
    textAlign: 'left', padding: '0.35rem 0.5rem', borderBottom: '1px solid #1e2a38',
    color: '#718096', fontWeight: 600, background: '#0d1117', position: 'sticky', top: 0,
  },
  td: { padding: '0.3rem 0.5rem', borderBottom: '1px solid #131c26' },
  unknown: { color: '#718096', fontSize: '0.75rem', padding: '0.5rem', fontStyle: 'italic' },
  alarmsSection: { border: '1px solid #1e2a38', borderRadius: 6, padding: '0.5rem 0.6rem' },
  alarmsHeader: { fontSize: '0.72rem', fontWeight: 700, color: '#718096', marginBottom: '0.3rem' },
  noAlarms: { color: '#22c55e', fontSize: '0.75rem' },
  alarmCard: { padding: '0.15rem 0', borderBottom: '1px solid #131c26' },
  alarmRow: { display: 'flex', gap: '0.5rem', fontSize: '0.72rem', padding: '0.15rem 0', alignItems: 'baseline', flexWrap: 'wrap' },
  alarmKind: { fontWeight: 700, minWidth: '80px', flexShrink: 0 },
  alarmMsg: { color: '#cbd5e0', flex: 1 },
  footerRow: { fontSize: '0.65rem', color: '#4a5568' },
  // BP148 D-BP148-028: the Verify button + its evidence panel.
  verifyBtn: {
    background: '#1a1a2e', border: '1px solid #2d3748', borderRadius: 4,
    color: '#38bdf8', fontSize: '0.68rem', fontWeight: 700, padding: '0.2rem 0.55rem',
    cursor: 'pointer', flexShrink: 0, marginLeft: 'auto',
  },
  verifyPanel: {
    marginTop: '0.3rem', marginBottom: '0.3rem', padding: '0.5rem 0.6rem',
    background: '#0d1117', border: '1px solid #1e2a38', borderRadius: 6,
    fontSize: '0.68rem', color: '#cbd5e0', display: 'flex', flexDirection: 'column', gap: '0.35rem',
  },
  verifyVerdict: { fontWeight: 700, fontSize: '0.72rem' },
  verifySubtle: { color: '#718096', fontSize: '0.65rem' },
  verifyRepoBlock: {
    borderTop: '1px solid #1e2a38', paddingTop: '0.3rem', display: 'flex', flexDirection: 'column', gap: '0.25rem',
  },
  verifyRepoHeader: { fontWeight: 700, color: '#a78bfa', fontSize: '0.68rem' },
  verifyCommitRow: {
    display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'baseline',
    padding: '0.15rem 0', borderBottom: '1px dashed #1e2a38',
  },
  verifySha: { fontFamily: 'monospace', color: '#63b3ed', fontWeight: 700 },
  verifySubj: { color: '#e2e8f0' },
  verifyBadge: {
    background: '#1a2e1a', color: '#22c55e', borderRadius: 8, padding: '1px 6px', fontSize: '0.6rem',
  },
  verifyDirty: {
    color: '#f6ad55', fontSize: '0.65rem', padding: '0.15rem 0',
  },
  dispatchSection: {
    display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 'auto',
    borderTop: '1px solid #1e2a38', paddingTop: '0.5rem', flexWrap: 'wrap',
  },
  select: {
    background: '#0d1117', color: '#e2e8f0', border: '1px solid #2d3748',
    borderRadius: 4, fontSize: '0.72rem', padding: '0.25rem 0.4rem',
  },
  dispatchBtn: {
    background: '#1a1a2e', border: '1px solid #2d3748', borderRadius: 4,
    color: '#63b3ed', fontSize: '0.72rem', fontWeight: 700, padding: '0.3rem 0.7rem', cursor: 'pointer',
  },
  dispatchMsg: { fontSize: '0.68rem', color: '#718096' },
};

export default BoardPanel;
