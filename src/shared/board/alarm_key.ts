// alarm_key.ts -- BP148 D-BP148-031: shared (main + renderer) vocabulary and stable identity
// for Grand Central board alarms.
//
// WHY THIS FILE EXISTS: the Founder's complaint was "an alarm that states a fact but offers no
// action is noise" -- and a follow-on scope addition: "it doesn't even tell me what the board
// is, or what it is for." Fixing both means every alarm needs (a) a stable identity a dismissal
// can attach to across recomputes, and (b) plain-language text a stranger can read cold. Both
// halves live here, in src/shared/ (not src/main/), specifically so this is ONE source of truth
// importable at RUNTIME by both board_alarm_actions.ts (main process, writes dismissals) and
// BoardPanel.tsx (renderer, displays them) -- not two copies that can drift, and not a
// main-only module the renderer can only reach as an erased type-only import (the existing
// board_subscription.ts convention for BoardSnapshot/BoardRow/BoardAlarm). This file has zero
// Node built-in imports for exactly that reason: it must bundle cleanly into the Vite renderer.
//
// board_state_reader.ts remains the ONLY place that DECIDES whether an alarm fires (the
// detector). This file only interprets an alarm the detector already produced -- ordinary-tier
// UI affordances over an existing detector, not a second detector.

export type AlarmKind =
  | 'COLLISION'
  | 'COLLISION-RISK'
  | 'DOUBLE-BOOKED'
  | 'STALLED'
  | 'ORPHANED'
  | 'IDLE'
  | 'UNOWNED';

export interface AlarmLike {
  kind: AlarmKind;
  message: string;
}

/** One or two sentences, plain language, no internal vocabulary -- shown at rest on the board
 *  itself, per the Founder's scope addition: "if the meaning lives one click away, the board
 *  still fails at rest." */
export const BOARD_PURPOSE_STATEMENT =
  'This board watches the coding work being done on this app right now by AI agents, and flags ' +
  'anything that looks off: two agents about to overwrite the same file, an agent that has gone ' +
  'quiet, a finished-work claim with nothing to back it up, or changed files nobody has claimed. ' +
  'The number below is how many of those flags need a human decision.';

/** A short, human-recognizable name for each alarm kind -- shown next to the machine-readable
 *  kind (COLLISION, UNOWNED, etc.) rather than replacing it, so the vocabulary in this file and
 *  the vocabulary in board_state_reader.ts's own alarm messages still visibly refer to the same
 *  thing. */
export const ALARM_LABELS: Record<AlarmKind, string> = {
  COLLISION: 'Two workers, one file',
  'COLLISION-RISK': 'Two workers might collide',
  'DOUBLE-BOOKED': 'One worker, two jobs',
  STALLED: 'Gone quiet',
  ORPHANED: 'Claimed finished, no proof',
  IDLE: 'Nothing running',
  UNOWNED: 'Unsaved changes, no owner',
};

/** The "what is this" sentence -- one plain sentence per kind, written for someone who has
 *  never read this codebase (the Founder's own bar: "otherwise it means 'The torpedoes from
 *  Saturn are golden brown!!'"). */
export const ALARM_EXPLANATIONS: Record<AlarmKind, string> = {
  COLLISION:
    'Two different AI agents have each been told to change the exact same file at the same ' +
    'time. Whichever one saves last will silently erase the other one’s work.',
  'COLLISION-RISK':
    'Two agents might end up touching the same file -- one of them only listed it as a file it ' +
    'might need, not one it definitely will. This is a warning, not a confirmed collision yet.',
  'DOUBLE-BOOKED':
    'The same named worker is recorded as doing two jobs at the same time. Nobody can actually ' +
    'work on two tickets at once, so one of these two records is stale or wrong.',
  STALLED:
    'An agent was told to start a job, and nothing about it has changed in a while. It may be ' +
    'stuck, may have crashed, or may never have actually started.',
  ORPHANED:
    'An agent reported finishing a job, but there is no saved (committed) code that backs the ' +
    'claim up. That can mean the work is real but not saved yet, or that the report is wrong.',
  IDLE:
    'There is work sitting ready to hand to an agent, and right now nobody is doing anything at ' +
    'all.',
  UNOWNED:
    'There are unsaved changes sitting on disk that no open ticket claims responsibility for -- ' +
    'either someone edited files outside the normal process, or a job finished without being ' +
    'recorded as done.',
};

/** The "what do I do about it" sentence -- always paired with the explanation above, per the
 *  Founder's rule: "an alarm that states a fact but offers no action is noise." For kinds where
 *  this board genuinely cannot act for the user (a human coordination problem), this sentence
 *  says so plainly instead of pretending a button can fix it. */
export const ALARM_GUIDANCE: Record<AlarmKind, string> = {
  COLLISION:
    'Reassign one of the two tickets to a different file, or tell one worker to stop. This board ' +
    'cannot resolve a real collision for you -- only a human decision can.',
  'COLLISION-RISK':
    'Check whether the "might touch" side actually needs that file. If not, no action is needed; ' +
    'if it does, treat it like a confirmed collision.',
  'DOUBLE-BOOKED':
    'Check which of the two jobs the worker is actually doing, and correct or re-dispatch the ' +
    'other one.',
  STALLED:
    'Check on the agent. If it is still working, re-dispatching resets the clock; if it has died, ' +
    'decide what to do with whatever it left behind.',
  ORPHANED:
    'Press Verify to see the real commit history and working-tree state before believing the ' +
    'report either way.',
  IDLE:
    'Dispatch one of the waiting tickets below, or leave this alone if the pause is intentional.',
  UNOWNED:
    'Decide what should happen to these files: save them as a real commit, set them aside on a ' +
    'branch for later, throw them away, or mark this as expected and move on.',
};

/** Builds a STABLE identity for an alarm, so a dismissal survives the alarm being recomputed
 *  every 15s with slightly different wording. Without this, "dismiss" would undo itself on the
 *  very next poll tick, because board_state_reader.ts's own messages carry volatile numbers
 *  (elapsed minutes on STALLED, queued-ticket count on IDLE) that change tick to tick even when
 *  the alarm is about the exact same real-world thing. This function strips exactly the parts
 *  each alarm kind's message construction (see board_state_reader.ts's computeBoardSnapshot())
 *  documents as volatile, and keeps everything that identifies WHICH real thing the alarm is
 *  about (ticket ids, file paths, worker names).
 *
 *  Read-only, pure string logic, no I/O -- safe to call from either process. */
export function canonicalizeAlarmKey(alarm: AlarmLike): string {
  const { kind, message } = alarm;
  const ticketIds = () => [...message.matchAll(/KN-BP\d+-\d+/g)].map((m) => m[0]).sort();

  switch (kind) {
    case 'COLLISION':
    case 'COLLISION-RISK': {
      // "ID1 and ID2 both declare FILE. ..." / "ID1 (primary) and ID2 (secondary) may both
      // reach FILE. At least one side is a secondary declaration, so ..."
      const ids = ticketIds();
      const fileMatch = message.match(/(?:declare|reach)\s+(\S+)\.?/);
      return `${kind}:${ids.join(',')}:${fileMatch ? fileMatch[1] : message}`;
    }
    case 'DOUBLE-BOOKED': {
      // "WORKER is recorded against ID1 and ID2. ..."
      const ids = ticketIds();
      const worker = message.match(/^(.+?) is recorded against/)?.[1] ?? message;
      return `${kind}:${worker}:${ids.join(',')}`;
    }
    case 'STALLED': {
      // "ID dispatched Xm ago, no activity on TARGET." -- Xm is the volatile part, dropped.
      const id = message.match(/^(KN-BP\d+-\d+)/)?.[1] ?? message;
      const target = message.match(/no activity on (\S+?)\.?$/)?.[1] ?? '';
      return `${kind}:${id}:${target}`;
    }
    case 'ORPHANED': {
      const id = message.match(/^(KN-BP\d+-\d+)/)?.[1] ?? message;
      return `${kind}:${id}`;
    }
    case 'IDLE': {
      // "nothing is running and N ticket(s) are written and undispatched: id1, id2" -- N is
      // derived from the id list, so sorting the id list alone is a sufficient stable key.
      const listPart = message.match(/undispatched:\s*(.+)$/)?.[1] ?? message;
      const sorted = listPart.split(',').map((s) => s.trim()).filter(Boolean).sort();
      return `${kind}:${sorted.join(',')}`;
    }
    case 'UNOWNED': {
      // "uncommitted changes with no dispatched ticket: file1, file2" (message truncates to the
      // first 4 -- see board_state_reader.ts's `unowned.slice(0, 4)` -- so this key is only as
      // stable as that truncation; a 5th unowned file appearing/disappearing outside the shown
      // four will not change this key, which is the correct behavior: the ALARM is the same
      // "there is unowned work" situation from the user's point of view either way.
      const listPart = message.match(/no dispatched ticket:\s*(.+)$/)?.[1] ?? message;
      const sorted = listPart.split(',').map((s) => s.trim()).filter(Boolean).sort();
      return `${kind}:${sorted.join(',')}`;
    }
    default:
      return `${kind}:${message}`;
  }
}

// ─── Per-kind subject extraction: which real-world things does THIS alarm point at? ────────
// Used by BoardPanel.tsx to wire an alarm card's action buttons (re-dispatch a specific
// ticket, offer specific files to commit/park/discard) to the actual thing the alarm names,
// without a second parser -- these read the exact same message shapes
// board_state_reader.ts's computeBoardSnapshot() constructs, one level less strict than
// canonicalizeAlarmKey() above (that function only needs a stable STRING; these return the
// actual ids/paths as usable values).

/** ORPHANED/STALLED both lead their message with the ticket id -- `${r.id} has a report...` /
 *  `${r.id} dispatched Xm ago...`. Trailing-space-bounded so "KN-BP144-1" and "KN-BP144-11"
 *  never cross-match (same discipline as BoardPanel.tsx's pre-existing orphanIdFromAlarm). */
export function extractLeadingTicketId(message: string): string | null {
  const m = message.match(/^(KN-BP\d+-\d+)\s/);
  return m ? m[1] : null;
}

/** STALLED: `${r.id} dispatched ${m}m ago, no activity on ${r.target || 'its target'}.` */
export function extractStalledTarget(message: string): string | null {
  const m = message.match(/no activity on (\S+?)\.?$/);
  if (!m || m[1] === 'its' /* "its target" has no real path */) return null;
  return m[1];
}

/** IDLE: `nothing is running and N ticket(s) are written and undispatched: id1, id2`. Returns
 *  the full queued list in original (non-sorted) order, so the UI can offer "dispatch the
 *  first one" the same way a human reading the sentence left-to-right would pick it. */
export function extractIdleQueuedIds(message: string): string[] {
  const m = message.match(/undispatched:\s*(.+)$/);
  if (!m) return [];
  return m[1].split(',').map((s) => s.trim()).filter(Boolean);
}

/** UNOWNED: `uncommitted changes with no dispatched ticket: file1, file2`. NOTE: this list is
 *  capped to 4 by board_state_reader.ts's own `unowned.slice(0, 4)` -- if more than 4 files are
 *  genuinely unowned, this only returns the first 4 the alarm message itself shows. That is a
 *  display truncation inherited from the detector, not something this function can see past. */
export function extractUnownedFiles(message: string): string[] {
  const m = message.match(/no dispatched ticket:\s*(.+)$/);
  if (!m) return [];
  return m[1].split(',').map((s) => s.trim()).filter(Boolean);
}

/** Persisted dismissal record shape -- shared so main (writer) and renderer (reader) agree on
 *  the wire format. NEVER deleted once created (see board_alarm_actions.ts) -- restoredAt is
 *  set instead of removing the row, so a dismissal is always findable, per the Founder's rule:
 *  "a dismissed alarm should be findable, not erased." */
export interface AlarmDismissal {
  key: string;
  kind: AlarmKind;
  /** The exact alarm message text at the moment it was dismissed -- evidence of what was
   *  actually acknowledged, not just which kind. */
  message: string;
  note: string | null;
  dismissedAt: string;
  /** null while still dismissed/hidden; set to an ISO timestamp when restored. The row stays
   *  in the store either way -- this is the only state transition, never a delete. */
  restoredAt: string | null;
}
