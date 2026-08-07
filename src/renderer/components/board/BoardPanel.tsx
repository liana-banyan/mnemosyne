// BoardPanel.tsx -- KN-BP144-10 T1/T2/T4/T5, extended BP148 D-BP148-031.
//
// Renders the SAME rows and alarms board.mjs computes (ported in src/main/board/
// board_state_reader.ts, read via IPC through board_subscription.ts) -- this component itself
// never touches the filesystem or spawns git (T3). Writes go through three narrow IPC surfaces:
// mark-dispatched (T4, pre-existing), Verify (BP148 D-BP148-028, read-only), and the alarm
// actions added by THIS ticket (dismiss/restore + UNOWNED commit/park/discard).
//
// BP148 D-BP148-031 -- what changed and why (the Founder's own complaint, verbatim): he clicked
// an UNOWNED alarm and found a sentence with no button. "It still doesn't tell me what to do
// with it... otherwise it means 'The torpedoes from Saturn are golden brown!!'" A follow-on
// scope addition widened this: the board didn't say what it WAS either. Both are fixed here:
//   1. A plain-language purpose banner at the top (BOARD_PURPOSE_STATEMENT, from
//      src/shared/board/alarm_key.ts) -- visible at rest, no click/hover required.
//   2. Every alarm card now shows a plain-English "what this is" + "what to do" pair
//      (ALARM_LABELS/ALARM_EXPLANATIONS/ALARM_GUIDANCE, same shared module) ABOVE the raw
//      machine message, which stays visible too -- the plain text explains it, the raw message
//      remains the evidence.
//   3. Every alarm gets a real action set: Acknowledge (persisted + recoverable, every kind),
//      plus kind-specific actions where a real one exists -- UNOWNED gets commit/park/discard,
//      STALLED and IDLE get a one-click re-dispatch, ORPHANED keeps its pre-existing Verify.
//      Coordination-only kinds (COLLISION/COLLISION-RISK/DOUBLE-BOOKED) get Acknowledge only,
//      because the actual fix is a human decision this board cannot make -- ALARM_GUIDANCE says
//      so in plain words instead of a button pretending otherwise.
//   4. A "Handled" section lists every dismissal ever recorded, restorable, never erased.
//
// T5 still holds: every cell either shows a real value from the last snapshot/action result or
// the literal string "unknown" -- no placeholder rows, no simulated timings, no Math.random().

import { useState, useEffect, useCallback, useMemo } from 'react';
import { boardSubscription, DEFAULT_BOARD_STATE, alarmCount } from './board_subscription';
import type { BoardState, BoardRow, BoardAlarm, VerifyOrphanResult, AlarmDismissal } from './board_subscription';
import {
  canonicalizeAlarmKey,
  extractLeadingTicketId,
  extractStalledTarget,
  extractIdleQueuedIds,
  extractUnownedFiles,
  BOARD_PURPOSE_STATEMENT,
  ALARM_LABELS,
  ALARM_EXPLANATIONS,
  ALARM_GUIDANCE,
  type AlarmKind,
} from '../../../shared/board/alarm_key';

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

// Plain-language gloss for each status word, shown as a title tooltip on the cell -- the
// Founder's scope addition asked that internal vocabulary either be explained inline or use
// words that carry themselves; a hover tooltip is a reasonable middle ground for a dense table
// cell where printing the whole sentence would break the "don't redesign the layout" constraint.
const STATUS_GLOSS: Record<BoardRow['status'], string> = {
  written: 'Queued -- described but not yet handed to an agent',
  DISPATCHED: 'Handed to an agent, no file activity seen yet',
  WORKING: 'An agent is actively editing the target file right now',
  COMMITTED: 'Code was saved (committed), no written report yet',
  REPORTED: 'Agent reported done AND there is a matching saved commit',
  'REPORT-NO-COMMIT': 'Agent reported done but NO commit backs it up -- see ORPHANED below',
  'PHASE0-REPORTED': 'Agent reported a read-only finding -- no code was expected to change',
};

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

function defaultBranchName(files: string[]): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const hint = files[0] ? files[0].replace(/^.*[\\/]/, '').replace(/[^a-zA-Z0-9_.-]/g, '-').slice(0, 40) : 'unowned';
  return `board-parked-${hint}-${stamp}`;
}

/** BP148 D-BP148-028: renders the Verify button's real result -- one of three honest states
 *  (commit found / nothing found / uncommitted in the working tree), always WITH the evidence
 *  (hash, repo, files, date), never a bare verdict. Unchanged by this ticket. */
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

/** BP148 D-BP148-031: the universal Acknowledge control -- every alarm kind gets this. Two-step
 *  (open form -> confirm) even though acknowledging is reversible, so a note can be attached and
 *  a stray click doesn't silently swallow an alarm. */
function AcknowledgeControl({
  open, note, busy, onOpen, onNoteChange, onConfirm, onCancel,
}: {
  open: boolean;
  note: string;
  busy: boolean;
  onOpen: () => void;
  onNoteChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) {
    return (
      <button style={styles.ackBtn} onClick={onOpen} title="Record that you've seen this and decided how to handle it. Recoverable -- shows up under Handled below, and can be restored.">
        Acknowledge
      </button>
    );
  }
  return (
    <div style={styles.ackForm}>
      <input
        style={styles.ackInput}
        placeholder="Optional note: why is this OK to acknowledge?"
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
      />
      <button style={styles.ackConfirmBtn} disabled={busy} onClick={onConfirm}>
        {busy ? 'Saving…' : 'Confirm acknowledge'}
      </button>
      <button style={styles.ackCancelBtn} disabled={busy} onClick={onCancel}>Cancel</button>
    </div>
  );
}

export function BoardPanel() {
  const [state, setState] = useState<BoardState>(DEFAULT_BOARD_STATE);
  const [selectedTicket, setSelectedTicket] = useState<string>('');
  const [dispatching, setDispatching] = useState(false);
  const [dispatchMsg, setDispatchMsg] = useState<string | null>(null);
  const [verifyState, setVerifyState] = useState<Record<string, VerifyState>>({});

  // BP148 D-BP148-031: per-alarm-key UI state for the new action affordances. Keyed by
  // canonicalizeAlarmKey() (stable across the 15s recompute), not array index or raw message.
  const [ackOpen, setAckOpen] = useState<Record<string, boolean>>({});
  const [ackNote, setAckNote] = useState<Record<string, string>>({});
  const [ackBusy, setAckBusy] = useState<Record<string, boolean>>({});
  const [unownedOpen, setUnownedOpen] = useState<Record<string, boolean>>({});
  const [unownedMsg, setUnownedMsg] = useState<Record<string, string>>({});
  const [unownedBranch, setUnownedBranch] = useState<Record<string, string>>({});
  const [unownedBusy, setUnownedBusy] = useState<Record<string, 'commit' | 'park' | 'discard' | null>>({});
  const [unownedResult, setUnownedResult] = useState<Record<string, { ok: boolean; detail: string }>>({});
  const [discardConfirming, setDiscardConfirming] = useState<Record<string, boolean>>({});
  const [quickBusy, setQuickBusy] = useState<Record<string, boolean>>({});
  const [showHandled, setShowHandled] = useState(false);

  useEffect(() => {
    const unsub = boardSubscription.subscribe(setState);
    return unsub;
  }, []);

  const rows = state.snapshot?.rows ?? null;
  const alarms = state.snapshot?.alarms ?? null;
  const count = alarmCount(state);
  const dismissals = state.dismissals;

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

  // ── BP148 D-BP148-031: Acknowledge (any kind) ────────────────────────────────────────────
  const handleAckConfirm = useCallback(async (key: string, kind: AlarmKind, message: string) => {
    setAckBusy((p) => ({ ...p, [key]: true }));
    try {
      await window.amplify.boardAlarmDismiss?.(key, kind, message, ackNote[key] ?? null);
      await boardSubscription.refreshNow();
      setAckOpen((p) => ({ ...p, [key]: false }));
    } finally {
      setAckBusy((p) => ({ ...p, [key]: false }));
    }
  }, [ackNote]);

  const handleRestore = useCallback(async (key: string) => {
    setAckBusy((p) => ({ ...p, [key]: true }));
    try {
      await window.amplify.boardAlarmRestore?.(key);
      await boardSubscription.refreshNow();
    } finally {
      setAckBusy((p) => ({ ...p, [key]: false }));
    }
  }, []);

  // ── BP148 D-BP148-031: UNOWNED actions ───────────────────────────────────────────────────
  const handleUnownedCommit = useCallback(async (key: string, files: string[]) => {
    setUnownedBusy((p) => ({ ...p, [key]: 'commit' }));
    try {
      const msg = unownedMsg[key]?.trim() || `Save changes flagged by the Grand Central board (UNOWNED): ${files.join(', ')}`;
      const result = await window.amplify.boardUnownedCommit?.(files, msg);
      if (result?.ok) {
        setUnownedResult((p) => ({ ...p, [key]: { ok: true, detail: `Committed ${result.sha?.slice(0, 10)}. ${result.stat ?? ''}` } }));
      } else {
        setUnownedResult((p) => ({ ...p, [key]: { ok: false, detail: result?.error ?? 'commit failed, no detail returned' } }));
      }
      await boardSubscription.refreshNow();
    } finally {
      setUnownedBusy((p) => ({ ...p, [key]: null }));
    }
  }, [unownedMsg]);

  const handleUnownedPark = useCallback(async (key: string, files: string[]) => {
    setUnownedBusy((p) => ({ ...p, [key]: 'park' }));
    try {
      const branch = unownedBranch[key]?.trim() || defaultBranchName(files);
      const msg = unownedMsg[key]?.trim() || `PARKED via board UI: ${files.join(', ')}`;
      const result = await window.amplify.boardUnownedPark?.(files, branch, msg);
      if (result?.ok) {
        setUnownedResult((p) => ({ ...p, [key]: { ok: true, detail: `Parked on ${result.branch} (${result.sha?.slice(0, 10)}), returned to ${result.returnedToBranch}. ${result.stat ?? ''}` } }));
      } else {
        setUnownedResult((p) => ({ ...p, [key]: { ok: false, detail: result?.error ?? 'park failed, no detail returned' } }));
      }
      await boardSubscription.refreshNow();
    } finally {
      setUnownedBusy((p) => ({ ...p, [key]: null }));
    }
  }, [unownedBranch, unownedMsg]);

  const handleUnownedDiscardConfirm = useCallback(async (key: string, files: string[]) => {
    setUnownedBusy((p) => ({ ...p, [key]: 'discard' }));
    try {
      const result = await window.amplify.boardUnownedDiscard?.(files, true);
      if (result?.ok) {
        setUnownedResult((p) => ({ ...p, [key]: { ok: true, detail: result.results.map((r) => `${r.file}: ${r.action}`).join('; ') } }));
      } else {
        const perFile = result ? result.results.map((r) => `${r.file}: ${r.action}${r.error ? ` (${r.error})` : ''}`).join('; ') : '';
        const detail = `${result?.error ?? 'discard failed'}${perFile ? ` -- ${perFile}` : ''}`;
        setUnownedResult((p) => ({ ...p, [key]: { ok: false, detail } }));
      }
      setDiscardConfirming((p) => ({ ...p, [key]: false }));
      await boardSubscription.refreshNow();
    } finally {
      setUnownedBusy((p) => ({ ...p, [key]: null }));
    }
  }, []);

  // ── BP148 D-BP148-031: STALLED re-dispatch / IDLE dispatch-next (reuse existing IPC) ────
  const handleQuickDispatch = useCallback(async (id: string) => {
    setQuickBusy((p) => ({ ...p, [id]: true }));
    try {
      await window.amplify.boardMarkDispatched?.(id);
      await boardSubscription.refreshNow();
    } finally {
      setQuickBusy((p) => ({ ...p, [id]: false }));
    }
  }, []);

  const handledList: AlarmDismissal[] = useMemo(
    () => (dismissals ? Object.values(dismissals).sort((a, b) => (a.dismissedAt < b.dismissedAt ? 1 : -1)) : []),
    [dismissals],
  );

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <span style={styles.title}>Grand Central — The Board</span>
        <span style={styles.subtitle}>
          {state.loading && !state.snapshot ? 'loading…' : state.snapshot ? `computed ${relTime(state.snapshot.computedAt)}` : 'unknown'}
        </span>
        {count !== null && count > 0 && (
          <span style={styles.badge} title="Alarms that still need a human decision. Acknowledged alarms don't count here.">{count} need{count === 1 ? 's' : ''} a decision</span>
        )}
        {count === 0 && <span style={styles.badgeClear}>nothing needs attention</span>}
      </div>

      {/* ── Purpose banner: plain language, visible at rest (Founder scope addition) ──────── */}
      <div style={styles.purposeBanner}>{BOARD_PURPOSE_STATEMENT}</div>

      {state.error && <div style={styles.errorBanner}>⚠ polling error: {state.error.slice(0, 160)}</div>}
      {state.snapshot?.gitError && (
        <div style={styles.errorBanner}>⚠ git shell-out failed this cycle (showing last-known-good rows below): {state.snapshot.gitError.slice(0, 200)}</div>
      )}

      {/* ── T1: ticket rows, same seven states board.mjs computes ─────────────────────────── */}
      <div style={styles.sectionCaption}>
        Tickets: one row per unit of work handed to an AI agent. Hover a Status word for what it means.
      </div>
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
                  <td style={{ ...styles.td, color: statusColor(r.status), fontWeight: 700 }} title={STATUS_GLOSS[r.status]}>{r.status}</td>
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

      {/* ── T2: the seven alarms board.mjs actually computes, now with plain-language + actions */}
      <div style={styles.alarmsSection}>
        <div style={styles.alarmsHeader}>
          Alarms — things that look off and need a decision
        </div>
        {alarms === null ? (
          <div style={styles.unknown}>unknown — no snapshot received yet</div>
        ) : alarms.length === 0 ? (
          <div style={styles.noAlarms}>none — nothing looks off right now</div>
        ) : (
          alarms.map((a, i) => {
            const key = canonicalizeAlarmKey(a);
            const dismissal = dismissals ? dismissals[key] : undefined;
            const isAcknowledged = !!dismissal && dismissal.restoredAt === null;
            const orphanId = a.kind === 'ORPHANED' ? extractLeadingTicketId(a.message) : null;
            const stalledId = a.kind === 'STALLED' ? extractLeadingTicketId(a.message) : null;
            const idleNext = a.kind === 'IDLE' ? extractIdleQueuedIds(a.message)[0] ?? null : null;
            const unownedFiles = a.kind === 'UNOWNED' ? extractUnownedFiles(a.message) : [];
            const vs = orphanId ? verifyState[orphanId] : undefined;
            const uResult = unownedResult[key];

            return (
              <div key={`${a.kind}-${i}`} style={{ ...styles.alarmCard, opacity: isAcknowledged ? 0.55 : 1 }}>
                <div style={styles.alarmTop}>
                  <span style={{ ...styles.alarmKind, color: alarmColor(a.kind) }}>{a.kind}</span>
                  <span style={styles.alarmLabel}>{ALARM_LABELS[a.kind]}</span>
                  {isAcknowledged && <span style={styles.ackTag}>acknowledged{dismissal?.dismissedAt ? ` ${relTime(dismissal.dismissedAt)}` : ''}</span>}
                </div>
                <div style={styles.alarmExplain}>{ALARM_EXPLANATIONS[a.kind]}</div>
                <div style={styles.alarmGuidance}>What to do: {ALARM_GUIDANCE[a.kind]}</div>
                <div style={styles.alarmRawMsg}>{a.message}</div>

                <div style={styles.actionRow}>
                  {/* ORPHANED: existing Verify, unchanged */}
                  {orphanId && (
                    <button style={styles.verifyBtn} onClick={() => handleVerify(orphanId)} disabled={vs?.status === 'loading'}>
                      {vs?.status === 'loading' ? 'Verifying…' : 'Verify'}
                    </button>
                  )}

                  {/* STALLED: one-click re-dispatch resets the clock */}
                  {stalledId && (
                    <button
                      style={styles.actionBtn}
                      disabled={quickBusy[stalledId]}
                      onClick={() => handleQuickDispatch(stalledId)}
                      title="Records a fresh dispatch timestamp for this ticket, same effect as the Dispatch control at the bottom of this panel."
                    >
                      {quickBusy[stalledId] ? 'Re-dispatching…' : `Re-dispatch ${stalledId}`}
                    </button>
                  )}

                  {/* IDLE: one-click dispatch of the first queued ticket named in the alarm */}
                  {idleNext && (
                    <button
                      style={styles.actionBtn}
                      disabled={quickBusy[idleNext]}
                      onClick={() => handleQuickDispatch(idleNext)}
                      title="Hands the first waiting ticket to an agent (records a dispatch timestamp)."
                    >
                      {quickBusy[idleNext] ? 'Dispatching…' : `Dispatch ${idleNext}`}
                    </button>
                  )}

                  {/* UNOWNED: open the commit/park/discard panel */}
                  {a.kind === 'UNOWNED' && unownedFiles.length > 0 && (
                    <button style={styles.actionBtn} onClick={() => setUnownedOpen((p) => ({ ...p, [key]: !p[key] }))}>
                      {unownedOpen[key] ? 'Hide options' : 'Decide what to do with these files'}
                    </button>
                  )}

                  {/* Universal: Acknowledge / Restore */}
                  {!isAcknowledged ? (
                    <AcknowledgeControl
                      open={!!ackOpen[key]}
                      note={ackNote[key] ?? ''}
                      busy={!!ackBusy[key]}
                      onOpen={() => setAckOpen((p) => ({ ...p, [key]: true }))}
                      onNoteChange={(v) => setAckNote((p) => ({ ...p, [key]: v }))}
                      onConfirm={() => handleAckConfirm(key, a.kind, a.message)}
                      onCancel={() => setAckOpen((p) => ({ ...p, [key]: false }))}
                    />
                  ) : (
                    <button style={styles.ackBtn} disabled={ackBusy[key]} onClick={() => handleRestore(key)} title="Undo the acknowledgement -- this alarm will count toward the badge again.">
                      {ackBusy[key] ? 'Restoring…' : 'Restore (un-acknowledge)'}
                    </button>
                  )}
                </div>

                {orphanId && vs && <VerifyEvidence state={vs} />}

                {/* ── UNOWNED decision panel: commit / park / discard, evidence-first ────── */}
                {a.kind === 'UNOWNED' && unownedOpen[key] && (
                  <div style={styles.unownedPanel}>
                    <div style={styles.unownedFilesLabel}>Exact files this applies to:</div>
                    <ul style={styles.unownedFilesList}>
                      {unownedFiles.map((f) => <li key={f} style={styles.unownedFileItem}>{f}</li>)}
                    </ul>

                    <div style={styles.unownedRow}>
                      <input
                        style={styles.unownedInput}
                        placeholder="Commit message"
                        value={unownedMsg[key] ?? ''}
                        onChange={(e) => setUnownedMsg((p) => ({ ...p, [key]: e.target.value }))}
                      />
                      <button style={styles.actionBtn} disabled={!!unownedBusy[key]} onClick={() => handleUnownedCommit(key, unownedFiles)}>
                        {unownedBusy[key] === 'commit' ? 'Committing…' : 'Commit'}
                      </button>
                    </div>
                    <div style={styles.unownedHint}>Saves these files as a real commit on the current branch. Reversible with normal git history.</div>

                    <div style={styles.unownedRow}>
                      <input
                        style={styles.unownedInput}
                        placeholder={`Branch name (default: ${defaultBranchName(unownedFiles)})`}
                        value={unownedBranch[key] ?? ''}
                        onChange={(e) => setUnownedBranch((p) => ({ ...p, [key]: e.target.value }))}
                      />
                      <button style={styles.actionBtn} disabled={!!unownedBusy[key]} onClick={() => handleUnownedPark(key, unownedFiles)}>
                        {unownedBusy[key] === 'park' ? 'Parking…' : 'Park to a branch'}
                      </button>
                    </div>
                    <div style={styles.unownedHint}>Moves these files onto a NEW branch as a commit, then returns you to the current branch clean. Nothing is lost -- this is the safer default over Discard.</div>

                    <div style={styles.unownedRow}>
                      {!discardConfirming[key] ? (
                        <button style={styles.discardBtn} onClick={() => setDiscardConfirming((p) => ({ ...p, [key]: true }))}>
                          Discard these files…
                        </button>
                      ) : (
                        <div style={styles.discardConfirmBox}>
                          <div style={styles.discardWarning}>
                            This permanently deletes/reverts these {unownedFiles.length} file(s), cannot be undone:
                          </div>
                          <ul style={styles.unownedFilesList}>
                            {unownedFiles.map((f) => <li key={f} style={styles.unownedFileItem}>{f}</li>)}
                          </ul>
                          <button style={styles.discardConfirmBtn} disabled={!!unownedBusy[key]} onClick={() => handleUnownedDiscardConfirm(key, unownedFiles)}>
                            {unownedBusy[key] === 'discard' ? 'Discarding…' : `Yes, permanently discard ${unownedFiles.length} file(s)`}
                          </button>
                          <button style={styles.ackCancelBtn} disabled={!!unownedBusy[key]} onClick={() => setDiscardConfirming((p) => ({ ...p, [key]: false }))}>
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                    {!discardConfirming[key] && <div style={styles.unownedHint}>Irreversible. Prefer Park unless you are sure this work should not exist.</div>}

                    {uResult && (
                      <div style={{ ...styles.unownedResultBox, color: uResult.ok ? '#22c55e' : '#fca5a5' }}>
                        {uResult.ok ? 'Done: ' : 'Failed: '}{uResult.detail}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── BP148 D-BP148-031: Handled section -- every dismissal ever recorded, restorable,
          never erased. Collapsed by default so it never crowds the active list. ─────────────── */}
      <div style={styles.handledSection}>
        <button style={styles.handledToggle} onClick={() => setShowHandled((v) => !v)}>
          {showHandled ? '▾' : '▸'} Handled ({handledList.length})
        </button>
        {showHandled && (
          handledList.length === 0 ? (
            <div style={styles.unknown}>nothing acknowledged yet</div>
          ) : (
            handledList.map((d) => (
              <div key={d.key} style={styles.handledRow}>
                <span style={{ ...styles.alarmKind, color: alarmColor(d.kind) }}>{d.kind}</span>
                <span style={styles.handledMsg}>{d.message}</span>
                <span style={styles.verifySubtle}>
                  {d.restoredAt ? `restored ${relTime(d.restoredAt)} (was acknowledged ${relTime(d.dismissedAt)})` : `acknowledged ${relTime(d.dismissedAt)}`}
                  {d.note ? ` · note: ${d.note}` : ''}
                </span>
                {!d.restoredAt && (
                  <button style={styles.ackBtn} disabled={ackBusy[d.key]} onClick={() => handleRestore(d.key)}>
                    {ackBusy[d.key] ? 'Restoring…' : 'Restore'}
                  </button>
                )}
              </div>
            ))
          )
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
  badgeClear: {
    background: '#052e1c', color: '#6ee7b7', borderRadius: 10, padding: '2px 8px',
    fontSize: '0.68rem', fontWeight: 700,
  },
  purposeBanner: {
    fontSize: '0.72rem', lineHeight: 1.5, color: '#cbd5e0', background: '#0d1117',
    border: '1px solid #1e2a38', borderRadius: 6, padding: '0.5rem 0.65rem',
  },
  sectionCaption: { fontSize: '0.68rem', color: '#718096' },
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
  alarmCard: { padding: '0.5rem 0', borderBottom: '1px solid #131c26', display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  alarmTop: { display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' },
  alarmKind: { fontWeight: 700, fontSize: '0.68rem', minWidth: '80px', flexShrink: 0, fontFamily: 'monospace' },
  alarmLabel: { color: '#f0fdf4', fontSize: '0.75rem', fontWeight: 600 },
  ackTag: { color: '#94a3b8', fontSize: '0.65rem', fontStyle: 'italic', marginLeft: 'auto' },
  alarmExplain: { color: '#cbd5e0', fontSize: '0.72rem', lineHeight: 1.4 },
  alarmGuidance: { color: '#94a3b8', fontSize: '0.68rem', lineHeight: 1.4, fontStyle: 'italic' },
  alarmRawMsg: { color: '#4a5568', fontSize: '0.62rem', fontFamily: 'monospace' },
  actionRow: { display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.15rem' },
  footerRow: { fontSize: '0.65rem', color: '#4a5568' },
  // Verify (BP148 D-BP148-028), unchanged.
  verifyBtn: {
    background: '#1a1a2e', border: '1px solid #2d3748', borderRadius: 4,
    color: '#38bdf8', fontSize: '0.68rem', fontWeight: 700, padding: '0.2rem 0.55rem',
    cursor: 'pointer', flexShrink: 0,
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
  // BP148 D-BP148-031: generic action + acknowledge controls.
  actionBtn: {
    background: '#1a1a2e', border: '1px solid #2d3748', borderRadius: 4,
    color: '#a78bfa', fontSize: '0.68rem', fontWeight: 700, padding: '0.2rem 0.55rem',
    cursor: 'pointer', flexShrink: 0,
  },
  ackBtn: {
    background: 'transparent', border: '1px solid #2d3748', borderRadius: 4,
    color: '#94a3b8', fontSize: '0.66rem', fontWeight: 600, padding: '0.2rem 0.5rem',
    cursor: 'pointer', flexShrink: 0, marginLeft: 'auto',
  },
  ackForm: { display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap', marginLeft: 'auto' },
  ackInput: {
    background: '#0d1117', color: '#e2e8f0', border: '1px solid #2d3748',
    borderRadius: 4, fontSize: '0.66rem', padding: '0.2rem 0.4rem', minWidth: '180px',
  },
  ackConfirmBtn: {
    background: '#1a2e1a', border: '1px solid #22c55e', borderRadius: 4,
    color: '#22c55e', fontSize: '0.66rem', fontWeight: 700, padding: '0.2rem 0.5rem', cursor: 'pointer',
  },
  ackCancelBtn: {
    background: 'transparent', border: '1px solid #2d3748', borderRadius: 4,
    color: '#718096', fontSize: '0.66rem', padding: '0.2rem 0.5rem', cursor: 'pointer',
  },
  // UNOWNED decision panel.
  unownedPanel: {
    marginTop: '0.3rem', padding: '0.5rem 0.6rem', background: '#0d1117',
    border: '1px solid #1e2a38', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: '0.3rem',
  },
  unownedFilesLabel: { fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 },
  unownedFilesList: { margin: 0, paddingLeft: '1.1rem', fontSize: '0.66rem', fontFamily: 'monospace', color: '#e2e8f0' },
  unownedFileItem: { padding: '1px 0' },
  unownedRow: { display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' },
  unownedInput: {
    background: '#0a0f1a', color: '#e2e8f0', border: '1px solid #2d3748',
    borderRadius: 4, fontSize: '0.68rem', padding: '0.25rem 0.4rem', flex: 1, minWidth: '200px',
  },
  unownedHint: { fontSize: '0.62rem', color: '#4a5568', fontStyle: 'italic' },
  discardBtn: {
    background: '#2d1b1b', border: '1px solid #7f1d1d', borderRadius: 4,
    color: '#fca5a5', fontSize: '0.68rem', fontWeight: 700, padding: '0.25rem 0.6rem', cursor: 'pointer',
  },
  discardConfirmBox: {
    display: 'flex', flexDirection: 'column', gap: '0.3rem', padding: '0.4rem 0.5rem',
    background: '#2d1b1b', border: '1px solid #7f1d1d', borderRadius: 6, width: '100%',
  },
  discardWarning: { color: '#fca5a5', fontSize: '0.68rem', fontWeight: 700 },
  discardConfirmBtn: {
    background: '#7f1d1d', border: '1px solid #ef4444', borderRadius: 4,
    color: '#fff', fontSize: '0.68rem', fontWeight: 700, padding: '0.3rem 0.6rem', cursor: 'pointer',
  },
  unownedResultBox: {
    fontSize: '0.66rem', padding: '0.3rem 0.4rem', borderRadius: 4, background: '#0a0f1a',
    border: '1px solid #1e2a38',
  },
  // Handled (dismissal history) section.
  handledSection: { border: '1px solid #1e2a38', borderRadius: 6, padding: '0.4rem 0.6rem' },
  handledToggle: {
    background: 'transparent', border: 'none', color: '#718096', fontSize: '0.7rem',
    fontWeight: 700, cursor: 'pointer', padding: 0,
  },
  handledRow: {
    display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap',
    padding: '0.3rem 0', borderTop: '1px solid #131c26', marginTop: '0.3rem',
  },
  handledMsg: { color: '#94a3b8', fontSize: '0.68rem', flex: 1 },
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
