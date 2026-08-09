// LianaCycleTab.tsx -- D-BP149-034/BISHOP/S34/seg-lianaterminal
//
// THE LIANA CYCLE TERMINAL. Ratified canon:
//   Asteroid-ProofVault/state/eblets/CANON/canon_liana_cycle_terminal_window_we_fight_as_we_train_bp148.eblet.md
// Founder, BP148: "the liana cycle is exactly that process, and we need it anyway, so why not
// make the terminal window view, and use it, so we can save what we can token wise, while
// actually using the real deal as practice? We fight as we train."
// Founder, BP149: "Seriously, build it, and use gemma to do it with our MIC method, if possible."
//
// Two panes. LEFT: a live, scrolling, monospace transcript of the cascade executing -- the same
// stage-by-stage output scripts/founder_cascade_v2.mjs prints to console, streamed here via
// window.amplify.onLianaTerminalEvent instead of pasted back from a separate terminal window
// (BP138 standing rule: the Founder must SEE the run live, question by question). RIGHT: the
// prompt -- a question or a bundled MMLU-Pro question id, Enter to run.
//
// Placement: a sibling Compass tab (see compass/types.ts's CompassTab union + CompassShell.tsx's
// TABS array), not folded into LeanAskTab.tsx. LeanAskTab is a chat-bubble surface built around
// ai-dispatch:query's chat/escalation ladder; this is a two-pane terminal built around a
// completely different engine (the ported cascade). Read LeanAskTab.tsx before this decision was
// made -- its Hex Terminal (D-BP148-001) is a real, separate, already-shipped feature (handle/
// celpane minting over a chat reply) with no natural extension point for a live multi-stage
// transcript; forcing this feature into that file's chat-bubble model would have been the
// dishonest fit.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type {
  LianaAudibleAction,
  LianaAudiblePause,
  LianaTeachingFile,
  LianaTerminalEvent,
  LianaTerminalOutcome,
} from '../../../shared/liana_cycle/liana_terminal_types';

const LS_LAST_RUNS_KEY = 'liana_terminal_recent_inputs';
const MAX_RECENT = 12;

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(LS_LAST_RUNS_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecent(list: string[]): void {
  try { localStorage.setItem(LS_LAST_RUNS_KEY, JSON.stringify(list.slice(0, MAX_RECENT))); } catch { /* non-fatal */ }
}

function eventColor(kind: LianaTerminalEvent['kind']): string {
  switch (kind) {
    case 'header': return '#f0fdf4';
    case 'stage': return '#22d3ee';
    case 'fact': return '#4ade80';
    case 'result': return '#fbbf24';
    case 'error': return '#f87171';
    case 'note':
    default: return '#64748b';
  }
}

function TranscriptLine({ evt }: { evt: LianaTerminalEvent }) {
  const hhmmss = (() => {
    try { return evt.ts.slice(11, 19); } catch { return ''; }
  })();
  return (
    <div style={{ display: 'flex', gap: 8, padding: '1px 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      <span style={{ color: '#334155', flexShrink: 0, userSelect: 'none' }}>{hhmmss}</span>
      <span style={{ color: eventColor(evt.kind), fontWeight: evt.kind === 'header' || evt.kind === 'result' ? 700 : 400 }}>
        {evt.text}
      </span>
    </div>
  );
}

// D-BP149-043/BISHOP/S43/seg-method2build -- THE TEACH BOX. method_registry.ts's own header
// named the gap this closes: "The terminal can ask and cannot listen. It reports 'recognized
// shape, not yet taught' [or 'no method matches'] and gives the operator nowhere to teach it."
// A run ends in exactly one of those two states via `outcome.error` -- 'method_not_yet_taught'
// (a registered method's shapeTest matched but its `run` is null, e.g. a future stub) or
// 'no_method_matched' (nothing on file fits at all). Both are teaching opportunities, not
// failures, so both trigger this box.
function isTeachableOutcome(outcome: LianaTerminalOutcome | null): boolean {
  return outcome?.error === 'no_method_matched' || outcome?.error === 'method_not_yet_taught';
}

function shapeTestSummaryFor(outcome: LianaTerminalOutcome): string {
  if (outcome.error === 'no_method_matched') {
    return 'NO METHOD MATCHES -- this question does not fit any recorded method.';
  }
  if (outcome.error === 'method_not_yet_taught') {
    return `NOT YET TAUGHT -- method "${outcome.method ?? '(unknown)'}" matched this question's shape but has no runner yet.`;
  }
  return '(unknown shape-test outcome)';
}

// D-BP149-044/BISHOP/S44/seg-steppedmode -- THE STEPPED WALK. Founder, BP149, verbatim: "when I
// ask a question, like '85', if it doesn't deterministically resolve, then I want to see a
// stepped version of what actually happens: 1. I want the actual question asked with the answer
// options as the first response then pause and wait for my response, then when I hit go, show
// the next step, and I will give my response on that."
//
// THIS IS A PACING/CAPTURE LAYER OVER AN ALREADY-COMPLETED RUN, NOT A LIVE PAUSE OF THE CASCADE.
// "After a normal run" (the ticket's own point 1) means the run has already happened by the time
// the walk is offered -- the same queries, in the same order, already went out and came back
// (constraints: "Do not change what the methods DO... This is a pacing and capture layer").
// Re-running with a real mid-flight pause would mean either (a) forcing the operator to sit
// through live network calls between every keystroke, or (b) restructuring every method's run()
// into a pausable generator, which the ticket explicitly forbids touching. Walking the CAPTURED
// transcript instead gets the Founder everything he asked for -- see the question and options
// first, one real action per pause, his own words recorded against that exact step -- without
// either cost, and without touching comparative_cascade.ts / definitional_cascade.ts /
// liana_terminal_engine.ts at all.
//
// TRIGGER: an outcome that did not deterministically resolve. abstain:true covers all three
// named cases (ABSTAIN from a method's own run, no_method_matched, method_not_yet_taught) in one
// check -- a clean correct (or even a clean wrong-but-answered) run stays a single fast run, per
// the ticket's own instruction not to force this on a resolved outcome.
function offersSteppedWalk(outcome: LianaTerminalOutcome | null): boolean {
  return outcome != null && outcome.abstain === true;
}

/** A general-outcome shape-test summary for the walk's teaching file -- shapeTestSummaryFor()
 *  above only covers the two `outcome.error`-tagged cases (no_method_matched /
 *  method_not_yet_taught); a method that RAN and abstained on its own (e.g. the definitional
 *  cascade's honest D5 abstain) sets no `error` at all, so it needs its own honest description
 *  here rather than falling into shapeTestSummaryFor()'s "(unknown shape-test outcome)" catch-all. */
function walkOutcomeSummary(outcome: LianaTerminalOutcome): string {
  if (outcome.error === 'no_method_matched' || outcome.error === 'method_not_yet_taught') {
    return shapeTestSummaryFor(outcome);
  }
  const who = outcome.method ? `method "${outcome.method}" ran and reached an honest abstain` : 'the run reached an honest abstain';
  const basis = outcome.basis ? `  basis: ${outcome.basis}` : '';
  return `ABSTAIN -- ${who}.${basis}`;
}

// Boundary event kinds: each one STARTS a new step (unless it is the very first event, which
// always opens step 1). 'stage' and 'header' are the cascade's own named-phase markers (e.g.
// "STAGE 0 register gate", "D1 CATEGORIZE..."); 'result' marks a verdict/abstain being reached;
// 'fact' marks a sourced answer landing (a Google response, an extracted core sense) -- splitting
// on 'fact' is what separates "the literal query about to go out" (the stage/header + its query
// note, shown BEFORE Google answers) from "what came back and what we did with it" (the fact +
// its trailing extraction/elimination notes), which is exactly the before/after pause point the
// Founder's own examples describe. 'note' never starts a step on its own -- it is always detail
// belonging to the boundary event that opened its step, never truncated, never summarized.
const STEP_BOUNDARY_KINDS = new Set<LianaTerminalEvent['kind']>(['stage', 'header', 'result', 'fact']);

/** Pure, no I/O, no method-specific knowledge -- works on any registered method's transcript
 *  because it only looks at event `kind`, which every method already emits via the same
 *  say/step/fact/note helpers (comparative_cascade.ts, definitional_cascade.ts). */
function groupEventsIntoSteps(events: LianaTerminalEvent[]): LianaTerminalEvent[][] {
  const steps: LianaTerminalEvent[][] = [];
  let current: LianaTerminalEvent[] = [];
  for (const evt of events) {
    if (STEP_BOUNDARY_KINDS.has(evt.kind) && current.length > 0) {
      steps.push(current);
      current = [];
    }
    current.push(evt);
  }
  if (current.length) steps.push(current);
  return steps;
}

export function LianaCycleTab() {
  const [transcript, setTranscript] = useState<LianaTerminalEvent[]>([]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<LianaTerminalOutcome | null>(null);
  const [recent, setRecent] = useState<string[]>(loadRecent);
  const [bridgeMissing, setBridgeMissing] = useState(false);
  const [teachText, setTeachText] = useState('');
  const [teachSubmitting, setTeachSubmitting] = useState(false);
  const [teachResult, setTeachResult] = useState<{ ok: boolean; filePath?: string; bytes?: number; error?: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // D-BP149-044/BISHOP/S44/seg-steppedmode -- THE STEPPED WALK. runEventsRef collects ONLY the
  // most recently completed run's own emitted events (reset at the start of every handleRun, so
  // it never mixes events across runs); lastRunEvents is the same list frozen into state once
  // that run resolves, which is what a "Walk it step by step" click groups into steps. See the
  // groupEventsIntoSteps()/offersSteppedWalk() header comment above for why this walks an
  // ALREADY-COMPLETED run's captured transcript rather than live-pausing the cascade.
  const runEventsRef = useRef<LianaTerminalEvent[]>([]);
  const [lastRunEvents, setLastRunEvents] = useState<LianaTerminalEvent[]>([]);
  const [walkActive, setWalkActive] = useState(false);
  const [walkSteps, setWalkSteps] = useState<LianaTerminalEvent[][]>([]);
  const [walkIndex, setWalkIndex] = useState(0);
  const [walkResponses, setWalkResponses] = useState<Record<number, string>>({});
  const [walkInput, setWalkInput] = useState('');
  const [walkSubmitting, setWalkSubmitting] = useState(false);
  const [walkResult, setWalkResult] = useState<{ ok: boolean; filePath?: string; bytes?: number; error?: string } | null>(null);
  const walkInputRef = useRef<HTMLTextAreaElement>(null);

  // D-BP150-009 -- WARN BEFORE DISCARDING A WALK IN PROGRESS. Founder, BP150: "Warn before
  // restarting."
  //
  // The Audit button itself is already guarded (`!walkActive`), so restarting from THERE cannot
  // lose anything -- the previous walk had already submitted. The real discard path is handleRun:
  // starting a NEW run while a walk is open calls setWalkActive(false) and the collected responses
  // are simply dropped, with no write and no acknowledgement. Same defect class the Founder
  // reported at BP149 ("a walk that throws away your annotations because you quit early is worse
  // than no walk"), reached by a different door.
  //
  // The warning OFFERS TO SAVE rather than only warning -- a dialog that can only say "you are
  // about to lose this" is barely better than losing it.
  const [pendingDiscard, setPendingDiscard] = useState<null | { kind: 'run'; text: string }>(null);
  /** True when the walk holds anything the operator typed that has not reached disk. */
  const walkHasUnsavedWork = walkActive && (Object.values(walkResponses).some((r) => r.trim()) || walkInput.trim().length > 0);

  // D-BP150-001/BISHOP/S01/seg-audible -- CALL AN AUDIBLE. Founder, BP149: "a button or toggle
  // to 'let me redirect it before the next Google Call'."
  //
  // THIS IS NOT THE WALK ABOVE, AND THE TWO CONTROLS STAY SEPARATE ON PURPOSE. Audit the Run
  // paces a run that has ALREADY FINISHED (see offersSteppedWalk's header). Call an Audible stops
  // a LIVE run at a real decision point and changes what happens next. Founder ruling, carried in
  // bishop_coffee.BP149_close_BP150_open.md: "A button that looks like it steers and only
  // annotates is the exact defect class this session spent twelve hours removing."
  const [audibleMode, setAudibleMode] = useState<boolean>(() => localStorage.getItem('liana.audible') === '1');
  useEffect(() => { localStorage.setItem('liana.audible', audibleMode ? '1' : '0'); }, [audibleMode]);
  const [activePause, setActivePause] = useState<LianaAudiblePause | null>(null);
  // The query the operator is editing. Seeded from the pause's own literal query, so leaving it
  // untouched and pressing Go sends EXACTLY what the method generated.
  const [pauseQuery, setPauseQuery] = useState('');
  const [pauseNote, setPauseNote] = useState('');
  const [pauseAnswering, setPauseAnswering] = useState(false);
  const pauseQueryRef = useRef<HTMLTextAreaElement>(null);
  const pauseNoteRef = useRef<HTMLTextAreaElement>(null);

  // D-BP150-002/BISHOP/S02/seg-notesrecall -- HIS EARLIER NOTES, AVAILABLE MID-PAUSE.
  // Founder, BP150: "post whichever of my notes I want into the textbox I'm typing in, so I don't
  // have to go read it, or do it from memory." His qid 85 walk notes ARE the spec for the method
  // that does not exist yet; retyping them from memory at the moment they apply is where a plan
  // gets lost.
  //
  // NOT FILTERED TO THE CURRENT QUESTION, deliberately. The notes are about the METHOD, not the
  // question that provoked them -- "this register gate must go AFTER the initial Survey step" is
  // wanted while walking anything, not only qid 85.
  const [notesFiles, setNotesFiles] = useState<LianaTeachingFile[]>([]);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesState, setNotesState] = useState<'idle' | 'loading' | 'loaded' | 'unavailable'>('idle');
  const [expandedNote, setExpandedNote] = useState<string | null>(null);
  // Which box he was last typing in, so "Insert" lands where he expects rather than always in one
  // of them. Defaults to the note box, which is the one that exists at both phases.
  const lastBox = useRef<'query' | 'note'>('note');

  const loadNotes = useCallback(async () => {
    if (!window.amplify?.lianaNotesList) { setNotesState('unavailable'); return; }
    setNotesState('loading');
    try {
      const res = await window.amplify.lianaNotesList();
      setNotesFiles(res.files ?? []);
      setNotesState('loaded');
    } catch {
      setNotesState('unavailable');
    }
  }, []);

  // Loaded once a pause exists, not on mount: reading the dropzone costs a disk walk and there is
  // nothing to insert into until the run has actually stopped.
  useEffect(() => {
    if (activePause && notesState === 'idle') void loadNotes();
  }, [activePause, notesState, loadNotes]);

  /** Inserts a note VERBATIM at the cursor of whichever box he was last in. Never reformats it,
   *  never replaces what is already typed -- it splices, so a note can be dropped into the middle
   *  of a sentence he is part way through. */
  const insertNote = useCallback((text: string) => {
    const which = lastBox.current;
    const el = which === 'query' ? pauseQueryRef.current : pauseNoteRef.current;
    const current = which === 'query' ? pauseQuery : pauseNote;
    const setter = which === 'query' ? setPauseQuery : setPauseNote;
    if (!el) { setter(current ? `${current}\n\n${text}` : text); return; }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? start;
    setter(current.slice(0, start) + text + current.slice(end));
    // Put the caret after what was just inserted so he can keep typing from there.
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + text.length;
      try { el.setSelectionRange(caret, caret); } catch { /* box may have re-rendered */ }
    });
  }, [pauseQuery, pauseNote]);

  // DRAGGABLE SPLIT. Founder, BP149: "I need the input box to be either movable or just half of the
  // screen ... like the right half." The right pane was a fixed 280px column, which left the Teach
  // textarea about eight lines of very narrow text -- unusable for typing out a method, which is
  // the one thing this pane exists for. Width is remembered across sessions.
  const splitRef = useRef<HTMLDivElement>(null);
  // DEFAULT IS HALF THE SCREEN. Founder, BP149: "yes default to half". A saved width always wins,
  // so once he drags it somewhere it stays there; half is only the starting point.
  const [rightW, setRightW] = useState<number>(() => {
    const saved = Number(localStorage.getItem('liana.rightWidth'));
    return Number.isFinite(saved) && saved >= 240 ? saved : 0; // 0 = not measured yet
  });
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (rightW > 0) return;                       // saved value, or already measured
    const box = splitRef.current?.getBoundingClientRect();
    if (box && box.width > 0) setRightW(Math.round(box.width / 2));
  }, [rightW]);
  useEffect(() => { if (rightW > 0) localStorage.setItem('liana.rightWidth', String(rightW)); }, [rightW]);
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const box = splitRef.current?.getBoundingClientRect();
      if (!box) return;
      // Clamp so neither pane can be dragged away entirely.
      const next = Math.min(Math.max(box.right - e.clientX, 240), Math.max(box.width - 320, 240));
      setRightW(next);
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    // Stop the transcript text selecting while the divider is being dragged.
    const prev = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = prev;
    };
  }, [dragging]);
  const halveScreen = useCallback(() => {
    const box = splitRef.current?.getBoundingClientRect();
    if (box) setRightW(Math.round(box.width / 2));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  useEffect(() => {
    if (!window.amplify?.onLianaTerminalEvent) {
      setBridgeMissing(true);
      return;
    }
    const unsub = window.amplify.onLianaTerminalEvent((evt) => {
      setTranscript((prev) => [...prev, evt]);
      // D-BP149-044: mirrored into the current-run-only buffer the stepped walk reads from.
      runEventsRef.current.push(evt);
    });
    return () => { unsub?.(); };
  }, []);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // D-BP150-001 -- the engine has stopped and is waiting. Pushed, not polled: a pause has no
  // duration to poll for, it lasts exactly as long as the Founder takes.
  useEffect(() => {
    if (!window.amplify?.onLianaAudiblePause) return;
    const unsub = window.amplify.onLianaAudiblePause((pause) => {
      setActivePause(pause);
      setPauseQuery(pause.query);   // seeded verbatim; untouched + Go sends the method's own query
      setPauseNote('');
    });
    return () => { unsub?.(); };
  }, []);

  // Focus whichever box the operator will actually type in at this phase: the query on the way
  // out (the one he can change), the note on the way back (the query is history by then).
  useEffect(() => {
    if (!activePause) return;
    if (activePause.phase === 'before_query') pauseQueryRef.current?.focus();
    else pauseNoteRef.current?.focus();
  }, [activePause]);

  // THE ONLY WAY A PAUSE ENDS FROM THIS SIDE. `action` is chosen by which button was pressed --
  // never inferred from what was typed. Auto-parsing the operator's free text and changing the
  // run because of it is precisely the failure the method registry exists to prevent: we could no
  // longer tell whether a method worked or whether the system had quietly rewritten itself.
  const answerPause = useCallback(async (action: LianaAudibleAction) => {
    const pause = activePause;
    if (!pause || pauseAnswering) return;
    if (!window.amplify?.lianaAudibleRespond) {
      setTranscript((prev) => [...prev, {
        kind: 'error',
        text: 'Preload bridge missing (lianaAudibleRespond) -- rebuild main and restart the app.',
        ts: new Date().toISOString(),
      }]);
      return;
    }
    // A rewrite is only a rewrite if the text actually differs. Pressing Go after incidentally
    // touching the box must not be recorded as the operator having redirected the cascade.
    const changed = pause.phase === 'before_query' && pauseQuery !== pause.query && pauseQuery.trim().length > 0;
    const effectiveAction: LianaAudibleAction = action === 'go' && changed ? 'rewrite' : action;
    setPauseAnswering(true);
    try {
      await window.amplify.lianaAudibleRespond({
        pauseId: pause.pauseId,
        action: effectiveAction,
        replacementQuery: effectiveAction === 'rewrite' ? pauseQuery : undefined,
        note: pauseNote || undefined,   // VERBATIM -- never trimmed, reformatted, or summarized
      });
      // Acknowledge in the transcript. Founder, BP149, on the notes box: a note that vanishes
      // into state with no acknowledgement is indistinguishable from one that was lost.
      const bits = [`audible call ${pause.callIndex} ${pause.phase === 'before_query' ? 'out' : 'back'}: ${effectiveAction}`];
      if (pauseNote.trim()) bits.push(`note saved (${pauseNote.trim().length} chars)`);
      setTranscript((prev) => [...prev, {
        kind: 'fact', text: `  ${bits.join(' · ')}`, ts: new Date().toISOString(),
      }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTranscript((prev) => [...prev, { kind: 'error', text: `audible respond threw: ${msg}`, ts: new Date().toISOString() }]);
    } finally {
      setPauseAnswering(false);
      setActivePause(null);
      setPauseNote('');
    }
  }, [activePause, pauseAnswering, pauseQuery, pauseNote]);

  // Enter makes a newline in BOTH audible boxes. Only a button acts. This is the same rule the
  // Founder had to ask for twice on the Audit notes box -- a single-line input whose Enter key
  // advanced the step is what made typing a paragraph look like abandoning.
  const handlePauseKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void answerPause('go'); }
  };

  const handleRun = useCallback(async () => {
    const text = input.trim();
    if (!text || running) return;
    if (!window.amplify?.lianaTerminalRun) {
      setBridgeMissing(true);
      return;
    }
    // D-BP150-009: an open walk holding untyped-to-disk notes must not be silently wiped by
    // starting a new run. Stop, hold the question, and let him choose. Bypassed by the banner's
    // own buttons, which call runNow() directly.
    if (walkHasUnsavedWork && !pendingDiscard) {
      setPendingDiscard({ kind: 'run', text });
      return;
    }
    setPendingDiscard(null);
    setRunning(true);
    setLastOutcome(null);
    setTeachText('');
    setTeachResult(null);
    // D-BP149-044: a fresh run starts a fresh capture -- the previous run's steps must never
    // leak into this one's walk.
    runEventsRef.current = [];
    setLastRunEvents([]);
    setWalkActive(false);
    setWalkResult(null);
    // D-BP150-001: a stale pause panel from a previous run must never be answerable against this
    // one. Its pauseId is already dead in main's table, but leaving it on screen would invite a
    // click that silently does nothing.
    setActivePause(null);
    setTranscript((prev) => [
      ...prev,
      { kind: 'header', text: `═══ RUN  "${text}"${audibleMode ? '   [CALL AN AUDIBLE ON]' : ''}`, ts: new Date().toISOString() },
    ]);
    const nextRecent = [text, ...recent.filter((r) => r !== text)].slice(0, MAX_RECENT);
    setRecent(nextRecent);
    saveRecent(nextRecent);
    setInput('');
    try {
      const outcome = await window.amplify.lianaTerminalRun(text, audibleMode);
      setLastOutcome(outcome);
      setLastRunEvents(runEventsRef.current.slice());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTranscript((prev) => [...prev, { kind: 'error', text: `IPC threw: ${msg}`, ts: new Date().toISOString() }]);
    } finally {
      setRunning(false);
      // A run that ended (resolved, threw, or was abandoned from inside a pause) leaves no pause
      // to answer. Main has already released it; this clears the panel to match.
      setActivePause(null);
      inputRef.current?.focus();
    }
  }, [input, running, recent, audibleMode, walkHasUnsavedWork, pendingDiscard]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); void handleRun(); }
  };

  const handleClear = useCallback(() => {
    setTranscript([]);
    setLastOutcome(null);
    setTeachText('');
    setTeachResult(null);
  }, []);

  // THE TEACH BOX submit. Writes the operator's `teachText` to disk EXACTLY as typed -- this
  // function never touches, trims (beyond the browser's own textarea value), reformats, or
  // summarizes it. window.amplify.lianaTeachSubmit (preload.ts) forwards it verbatim to
  // index.ts's 'liana-teach-submit' handler, which is the only place the file actually gets
  // written. Never auto-generates a method from this text -- a human reads the file later.
  const handleTeachSubmit = useCallback(async () => {
    const text = teachText; // VERBATIM -- no .trim(), no reformatting of the operator's words
    if (!text.trim() || !lastOutcome || teachSubmitting) return;
    if (!window.amplify?.lianaTeachSubmit) {
      setTeachResult({ ok: false, error: 'Preload bridge missing (lianaTeachSubmit) -- rebuild main and restart the app.' });
      return;
    }
    setTeachSubmitting(true);
    try {
      const result = await window.amplify.lianaTeachSubmit({
        teachingText: text,
        question: lastOutcome.question,
        options: lastOutcome.options ?? null,
        qid: lastOutcome.qid,
        shapeTestSummary: shapeTestSummaryFor(lastOutcome),
      });
      setTeachResult(result);
      if (result.ok && result.filePath) {
        setTranscript((prev) => [
          ...prev,
          {
            kind: 'result',
            text: `TEACHING WRITTEN -- ${result.filePath}  (${result.bytes ?? '?'} bytes)`,
            ts: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTeachResult({ ok: false, error: msg });
    } finally {
      setTeachSubmitting(false);
    }
  }, [teachText, lastOutcome, teachSubmitting]);

  // D-BP149-044/BISHOP/S44/seg-steppedmode -- START THE WALK. Groups the just-completed run's
  // captured transcript into steps (groupEventsIntoSteps() above) and opens the walk panel at
  // step 1, which -- because the engine always emits header(qid/free-text) -> note(question) ->
  // note(options) -> stage(METHOD SELECTION) before anything else, and 'stage' is a step
  // boundary -- is always exactly the question and its full option list, nothing more. Founder,
  // BP149: "I want the actual question asked with the answer options as the first response then
  // pause."
  const handleStartWalk = useCallback(() => {
    const steps = groupEventsIntoSteps(lastRunEvents);
    setWalkSteps(steps);
    setWalkIndex(0);
    setWalkResponses({});
    setWalkInput('');
    setWalkResult(null);
    setWalkActive(true);
  }, [lastRunEvents]);

  useEffect(() => {
    if (walkActive) walkInputRef.current?.focus();
  }, [walkActive, walkIndex]);

  // Writes the walk to disk over the SAME 'liana-teach-submit' IPC channel the plain Teach box
  // uses (extended, not duplicated -- see index.ts's handler). `responses` is passed in rather
  // than read from state because setWalkResponses() is async and the caller (handleWalkGo /
  // handleAbandonWalk) needs the box's own not-yet-committed text folded in before the request
  // goes out, or a fast final keystroke would be lost.
  const submitWalk = useCallback(async (
    responses: Record<number, string>,
    abandoned: boolean,
    lastTouchedIndex: number,
  ) => {
    if (!lastOutcome) return;
    if (!window.amplify?.lianaTeachSubmit) {
      setWalkResult({ ok: false, error: 'Preload bridge missing (lianaTeachSubmit) -- rebuild main and restart the app.' });
      return;
    }
    setWalkSubmitting(true);
    try {
      const total = walkSteps.length;
      const stepsPayload = walkSteps.map((events, i) => ({
        index: i,
        total,
        lines: events.map((e) => ({ kind: e.kind as string, text: e.text, ts: e.ts })),
        response: responses[i] ?? '',
      }));
      const result = await window.amplify.lianaTeachSubmit({
        teachingText: '',
        question: lastOutcome.question,
        options: lastOutcome.options ?? null,
        qid: lastOutcome.qid,
        shapeTestSummary: walkOutcomeSummary(lastOutcome),
        steppedWalk: { steps: stepsPayload, abandoned, abandonedAtStep: abandoned ? lastTouchedIndex : undefined },
      });
      setWalkResult(result);
      if (result.ok) {
        setWalkActive(false);
        setTranscript((prev) => [
          ...prev,
          {
            kind: 'result',
            text: `AUDIT WRITTEN${abandoned ? ' (abandoned)' : ''} -- ${result.filePath}  (${result.bytes ?? '?'} bytes)`,
            ts: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setWalkResult({ ok: false, error: msg });
    } finally {
      setWalkSubmitting(false);
    }
  }, [lastOutcome, walkSteps]);

  // AT EACH PAUSE HE TYPES A RESPONSE, THEN PRESSES GO -- empty is fine, it just advances.
  // Nothing here parses walkInput or changes what step comes next based on its content; it is
  // recorded against this exact step index and nothing more (HARDWIRE-22, and the ticket's own
  // "do NOT try to parse it, act on it automatically, or change the run because of it").
  // Pressing Go on the LAST step finalizes and writes the teaching file -- same action, same
  // key, uniform all the way through per the Founder's own description of the loop.
  const handleWalkGo = useCallback(() => {
    if (!walkActive || walkSubmitting) return;
    const idx = walkIndex;
    const responses = { ...walkResponses, [idx]: walkInput };
    setWalkResponses(responses);
    if (idx + 1 < walkSteps.length) {
      // Confirm the note landed. Founder, BP149: "let me take notes that are saved as steps
      // (step 1 note saved, step 2 note saved - when I click Go for the next step)". A note that
      // vanishes into state with no acknowledgement is indistinguishable from one that was lost.
      if (walkInput.trim()) {
        const chars = walkInput.trim().length;
        setTranscript((prev) => [...prev, {
          ts: new Date().toISOString(),
          kind: 'fact',
          text: `  step ${idx + 1} note saved (${chars} chars)`,
        } as LianaTerminalEvent]);
      }
      setWalkInput('');
      setWalkIndex(idx + 1);
    } else {
      void submitWalk(responses, false, idx);
    }
  }, [walkActive, walkSubmitting, walkIndex, walkResponses, walkInput, walkSteps.length, submitWalk]);

  // Enter inserts a newline. ONLY Ctrl+Enter (or the Go button) advances the walk.
  // The old handler advanced on a bare Enter, which is why typing a paragraph looked like
  // abandoning the walk.
  const handleWalkInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleWalkGo(); }
  };

  // HE MUST BE ABLE TO STOP. Writes whatever was collected (including whatever is sitting
  // un-submitted in the response box right now) rather than discarding it -- a walk that throws
  // away the operator's annotations because he quit early is worse than no walk at all.
  const handleAbandonWalk = useCallback(() => {
    if (!walkActive || walkSubmitting) return;
    const idx = walkIndex;
    const responses = { ...walkResponses, [idx]: walkInput };
    setWalkResponses(responses);
    void submitWalk(responses, true, idx);
  }, [walkActive, walkSubmitting, walkIndex, walkResponses, walkInput, submitWalk]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px 8px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f0fdf4', flex: 1 }}>
          Liana Cycle
        </h2>
        <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
          Google is the only source · Gemma extracts · the code decides · $0
        </span>
        {/* D-BP150-001 -- CALL AN AUDIBLE. Deliberately a separate control from Audit the Run,
            which appears after a run that did not resolve. Audit annotates what already happened;
            this steers what happens next. Founder ruling: do not merge them. */}
        <button
          type="button"
          onClick={() => setAudibleMode((v) => !v)}
          disabled={running}
          title={'Stop before every Google query and again on what comes back, until you say go.\nOff: the run is exactly the run it has always been.'}
          style={{
            background: audibleMode ? 'linear-gradient(135deg, #b45309, #f59e0b)' : 'none',
            border: `1px solid ${audibleMode ? '#f59e0b' : '#334155'}`, borderRadius: 5,
            color: running ? '#334155' : audibleMode ? '#0d1117' : '#94a3b8',
            fontSize: 11, fontWeight: 700, padding: '3px 9px',
            cursor: running ? 'default' : 'pointer', fontFamily: 'system-ui, sans-serif', outline: 'none',
          }}
        >
          Call an Audible{audibleMode ? ' · ARMED' : ''}
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={transcript.length === 0}
          style={{
            background: 'none', border: '1px solid #334155', borderRadius: 5,
            color: transcript.length === 0 ? '#334155' : '#94a3b8', fontSize: 11, padding: '3px 9px',
            cursor: transcript.length === 0 ? 'default' : 'pointer', fontFamily: 'system-ui, sans-serif', outline: 'none',
          }}
        >
          Clear
        </button>
      </div>

      {/* D-BP150-001 -- THE TOGGLE HAS TO SAY WHAT IT WILL DO, AND WHEN.
          Founder, BP150, on first use: "I clicked 'Call an Audible' and now it says 'On' but what
          does that mean?" He had it on while looking at an already-finished run, so nothing
          happened and nothing explained why. A state label with no statement of effect is the
          defect his own BP148 ruling names: "which means what to who about why? no one knows."
          This banner states the effect, and that it applies to the NEXT run, not this one. */}
      {audibleMode && !activePause && (
        <div style={{
          margin: '0 16px 8px', padding: '7px 12px', background: '#3b2508',
          border: '1px solid #b45309', borderRadius: 6, color: '#fbbf24', fontSize: 12,
          fontFamily: 'system-ui, sans-serif',
        }}>
          <strong>Call an Audible is ARMED — nothing is paused yet.</strong> It takes effect on the
          NEXT run you start. Type a question or qid and press Enter; the run will stop before every
          Google query, and again on what comes back, and wait until you press a button. It does
          nothing to a run that has already finished — for that, use Audit the Run.
        </div>
      )}

      {/* D-BP150-009 -- WARN BEFORE DISCARDING A WALK. Founder, BP150: "Warn before restarting."
          Offers to SAVE, not merely to warn: a dialog whose only options are "lose it" and "go
          back" is barely better than losing it. "Save them first" runs the same submit path the
          End-the-audit button uses, so everything typed reaches disk before the new run starts. */}
      {pendingDiscard && (
        <div style={{
          margin: '0 16px 8px', padding: '9px 12px', background: '#3b0d0d',
          border: '1px solid #b91c1c', borderRadius: 6, color: '#fca5a5', fontSize: 12,
          fontFamily: 'system-ui, sans-serif',
        }}>
          <strong>You have notes in the open audit that are not on disk yet.</strong> Starting
          “{pendingDiscard.text}” would discard them.
          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => { const idx = walkIndex; void submitWalk({ ...walkResponses, [idx]: walkInput }, true, idx); setPendingDiscard(null); }}
              style={{
                background: 'linear-gradient(135deg, #059669, #10b981)', color: '#fff', border: 'none',
                borderRadius: 5, padding: '5px 11px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'system-ui, sans-serif', outline: 'none',
              }}
            >
              Save them first, then run
            </button>
            <button
              type="button"
              onClick={() => { setWalkActive(false); setWalkResponses({}); setWalkInput(''); setPendingDiscard(null); void handleRun(); }}
              style={{
                background: 'none', border: '1px solid #7f1d1d', borderRadius: 5, color: '#fca5a5',
                padding: '5px 11px', fontSize: 12, cursor: 'pointer', fontFamily: 'system-ui, sans-serif', outline: 'none',
              }}
            >
              Discard and run anyway
            </button>
            <button
              type="button"
              onClick={() => setPendingDiscard(null)}
              style={{
                background: 'none', border: '1px solid #334155', borderRadius: 5, color: '#94a3b8',
                padding: '5px 11px', fontSize: 12, cursor: 'pointer', fontFamily: 'system-ui, sans-serif', outline: 'none',
              }}
            >
              Cancel, stay in the audit
            </button>
          </div>
        </div>
      )}

      {bridgeMissing && (
        <div style={{ margin: '0 16px 8px', padding: '8px 12px', background: '#7f1d1d', border: '1px solid #991b1b', borderRadius: 6, color: '#fca5a5', fontSize: 12 }}>
          Preload bridge missing (liana-terminal-run / liana-terminal-event) -- rebuild main and restart the app.
        </div>
      )}

      <div ref={splitRef} style={{ flex: 1, display: 'flex', minHeight: 0, gap: 0, background: '#1e2a38' }}>
        {activePause ? (
          <>
            {/* D-BP150-001/BISHOP/S01/seg-audible -- CALL AN AUDIBLE, THE LIVE PAUSE.
                The run is STOPPED right now, inside the engine, waiting on this panel. There is
                no timer: it waits until a button is pressed. Founder, BP149: "I need it to stop
                UNTIL I SAY GO."
                LEFT: on the way out, the live transcript (context for the query you are about to
                change). On the way back, the RAW payload -- before Gemma, before any parse
                decision. That second view is the one that earns this feature: at BP149 five real
                organic results were scraped and discarded because a `success` flag meant "no
                answer box", and nothing ever showed anyone the text that arrived. */}
            <div style={{
              flex: 1.6, minWidth: 0, background: '#05080d', overflowY: 'auto', padding: '10px 14px',
              fontFamily: 'Consolas, "Courier New", monospace', fontSize: 12, lineHeight: 1.5,
            }}>
              {activePause.phase === 'after_return' ? (
                <>
                  <div style={{ color: '#fbbf24', fontWeight: 700, marginBottom: 8, fontFamily: 'system-ui, sans-serif', fontSize: 13 }}>
                    CALL {activePause.callIndex} CAME BACK -- raw, before Gemma, before any parse decision
                  </div>
                  <div style={{ color: '#64748b', marginBottom: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    query sent: {activePause.query}
                    {'\n'}source: {activePause.sourceUrl ?? '(none)'}
                  </div>
                  <div style={{ color: activePause.rawSnippet ? '#4ade80' : '#64748b', marginBottom: 4, fontWeight: 700 }}>
                    ANSWER BOX
                  </div>
                  <div style={{ color: '#e2e8f0', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 14 }}>
                    {activePause.rawSnippet
                      ? activePause.rawSnippet
                      : '(none -- Google rendered no answer box. That is normal for this cascade\'s ordering, cake-cut and density stages, and it is NOT the same as "nothing came back". The facts, if any, are in the organic results below.)'}
                  </div>
                  <div style={{ color: '#22d3ee', marginBottom: 4, fontWeight: 700 }}>
                    ORGANIC RESULTS ({activePause.blocks?.length ?? 0}) -- untruncated
                  </div>
                  {(activePause.blocks ?? []).length === 0 && (
                    <div style={{ color: '#f87171' }}>
                      (none -- this call genuinely returned nothing)
                    </div>
                  )}
                  {(activePause.blocks ?? []).map((b, i) => (
                    <div key={i} style={{ marginBottom: 12, paddingLeft: 8, borderLeft: '2px solid #1e2a38' }}>
                      <div style={{ color: '#f0fdf4', fontWeight: 700, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{i + 1}. {b.title}</div>
                      <div style={{ color: '#cbd5e1', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{b.body}</div>
                      <div style={{ color: '#475569', wordBreak: 'break-all' }}>{b.url}</div>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {transcript.map((evt, i) => <TranscriptLine key={i} evt={evt} />)}
                  <div ref={bottomRef} />
                </>
              )}
            </div>

            <div style={{ width: 6, flexShrink: 0, background: '#1e2a38' }} />

            {/* RIGHT: what he changes and what he types. */}
            <div style={{ width: rightW || 280, flexShrink: 0, background: '#0d1117', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
              <div style={{ color: '#fbbf24', fontWeight: 700, fontFamily: 'system-ui, sans-serif', fontSize: 13 }}>
                AUDIBLE -- call {activePause.callIndex}, {activePause.phase === 'before_query' ? 'before it goes out' : 'after it came back'}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'system-ui, sans-serif' }}>
                The run is stopped inside the engine right now. It waits until you press a button --
                there is no timer.
              </div>

              {activePause.phase === 'before_query' ? (
                <>
                  <label style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'system-ui, sans-serif' }}>
                    The query about to be sent. Edit it and press Go to send yours instead; leave it
                    alone and Go sends exactly what the method wrote.
                  </label>
                  {/* Enter makes a newline. Only a button acts -- the same rule the Audit notes
                      box had to be corrected to at BP149. */}
                  <textarea
                    ref={pauseQueryRef}
                    value={pauseQuery}
                    onChange={(e) => setPauseQuery(e.target.value)}
                    onFocus={() => { lastBox.current = 'query'; }}
                    onKeyDown={handlePauseKeyDown}
                    disabled={pauseAnswering}
                    rows={6}
                    wrap="soft"
                    style={{
                      background: '#05080d', border: `1px solid ${pauseQuery !== activePause.query ? '#f59e0b' : '#334155'}`,
                      borderRadius: 6, color: '#e2e8f0', padding: '8px 10px', fontSize: 13,
                      fontFamily: 'Consolas, monospace', outline: 'none', width: '100%', boxSizing: 'border-box',
                      minHeight: 130, resize: 'vertical', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', lineHeight: 1.5,
                    }}
                  />
                  {pauseQuery !== activePause.query && (
                    <div style={{ fontSize: 11, color: '#f59e0b', fontFamily: 'system-ui, sans-serif' }}>
                      Changed. Go will send your wording, verbatim, and record it as a rewrite.
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'system-ui, sans-serif' }}>
                  The query is already spent, so there is nothing to rewrite here. To change what a
                  call fetches, rewrite the QUERY on the way out. Hand-writing a fact at this point
                  would put unsourced text into the evidence chain, which is the one thing this
                  estate does not do.
                </div>
              )}

              <label style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'system-ui, sans-serif' }}>
                Your note on this call (recorded verbatim; blank is fine)
              </label>
              <textarea
                ref={pauseNoteRef}
                value={pauseNote}
                onChange={(e) => setPauseNote(e.target.value)}
                onFocus={() => { lastBox.current = 'note'; }}
                onKeyDown={handlePauseKeyDown}
                disabled={pauseAnswering}
                rows={8}
                wrap="soft"
                placeholder={'Type as much as you want. Enter makes a new line.\nNothing advances until you press a button (or Ctrl+Enter for Go).'}
                style={{
                  background: '#05080d', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0',
                  padding: '8px 10px', fontSize: 13, fontFamily: 'Consolas, monospace', outline: 'none',
                  width: '100%', boxSizing: 'border-box', minHeight: 180, resize: 'vertical',
                  whiteSpace: 'pre-wrap', overflowWrap: 'break-word', lineHeight: 1.5,
                }}
              />

              {/* D-BP150-002 -- YOUR EARLIER NOTES. Click one to splice it into whichever box you
                  were last typing in, verbatim, at the cursor. Read-only: opening this never
                  edits or deletes a teaching file. */}
              <div style={{ borderTop: '1px solid #1e2a38', paddingTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setNotesOpen((v) => !v)}
                  style={{
                    background: 'none', border: 'none', color: '#22d3ee', fontSize: 12, fontWeight: 700,
                    padding: 0, cursor: 'pointer', fontFamily: 'system-ui, sans-serif', outline: 'none',
                  }}
                >
                  {notesOpen ? '▾' : '▸'} Your earlier notes
                  {notesState === 'loaded' && ` (${notesFiles.reduce((n, f) => n + f.notes.length, 0)})`}
                  {notesState === 'loading' && ' (reading…)'}
                </button>

                {notesOpen && (
                  <div style={{ marginTop: 8, maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {notesState === 'unavailable' && (
                      <div style={{ fontSize: 11, color: '#fca5a5', fontFamily: 'system-ui, sans-serif' }}>
                        Preload bridge missing (lianaNotesList) -- rebuild main and restart the app.
                      </div>
                    )}
                    {notesState === 'loaded' && notesFiles.length === 0 && (
                      <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'system-ui, sans-serif' }}>
                        No teaching files found in the dropzone. That is "none found", not proof none exist --
                        if you expected some, say so and I will check the path rather than assume.
                      </div>
                    )}
                    {notesFiles.map((f) => (
                      <div key={f.filePath}>
                        <div style={{ fontSize: 10, color: '#475569', fontFamily: 'system-ui, sans-serif', marginBottom: 4 }}>
                          {f.label} · {f.writtenAt.slice(0, 16).replace('T', ' ')}Z
                          {f.abandoned ? ' · ended early' : ''} · {f.notes.length} note{f.notes.length === 1 ? '' : 's'}
                        </div>
                        {f.notes.map((n, i) => {
                          const key = `${f.filePath}#${i}`;
                          const open = expandedNote === key;
                          return (
                            <div key={key} style={{ marginBottom: 6, paddingLeft: 6, borderLeft: '2px solid #1e2a38' }}>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                                <button
                                  type="button"
                                  onClick={() => setExpandedNote(open ? null : key)}
                                  title={n.heading}
                                  style={{
                                    background: 'none', border: 'none', color: '#94a3b8', fontSize: 11,
                                    padding: 0, cursor: 'pointer', textAlign: 'left', flex: 1,
                                    fontFamily: 'system-ui, sans-serif', outline: 'none',
                                  }}
                                >
                                  {n.stepIndex != null ? `step ${n.stepIndex}` : 'teach box'} · {n.text.length} chars
                                  {' — '}
                                  <span style={{ color: '#64748b' }}>
                                    {open ? '(hide)' : `${n.text.slice(0, 44).replace(/\s+/g, ' ')}…`}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => insertNote(n.text)}
                                  style={{
                                    background: 'none', border: '1px solid #334155', borderRadius: 4,
                                    color: '#22d3ee', fontSize: 10, fontWeight: 700, padding: '2px 7px',
                                    cursor: 'pointer', fontFamily: 'system-ui, sans-serif', outline: 'none', flexShrink: 0,
                                  }}
                                >
                                  Insert
                                </button>
                              </div>
                              {open && (
                                <div style={{
                                  marginTop: 4, fontSize: 11, color: '#cbd5e1', whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word', fontFamily: 'Consolas, monospace', lineHeight: 1.45,
                                }}>
                                  {n.text}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => void answerPause('go')}
                disabled={pauseAnswering}
                style={{
                  background: pauseAnswering ? '#1e2a38' : 'linear-gradient(135deg, #059669, #10b981)',
                  color: pauseAnswering ? '#64748b' : '#fff', border: 'none', borderRadius: 6,
                  padding: '8px 10px', fontSize: 13, fontWeight: 700, cursor: pauseAnswering ? 'default' : 'pointer',
                  fontFamily: 'system-ui, sans-serif', outline: 'none',
                }}
              >
                {pauseAnswering
                  ? 'Sending…'
                  : activePause.phase === 'before_query'
                    ? (pauseQuery !== activePause.query ? 'Go -- send my wording ▸' : 'Go -- send it ▸')
                    : 'Go -- use this result ▸'}
              </button>
              <button
                type="button"
                onClick={() => void answerPause('skip')}
                disabled={pauseAnswering}
                style={{
                  background: 'none', border: '1px solid #334155', borderRadius: 6,
                  color: pauseAnswering ? '#334155' : '#94a3b8', padding: '7px 10px', fontSize: 12,
                  cursor: pauseAnswering ? 'default' : 'pointer', fontFamily: 'system-ui, sans-serif', outline: 'none',
                }}
              >
                {activePause.phase === 'before_query' ? 'Skip this call' : 'Discard this result'}
              </button>
              <button
                type="button"
                onClick={() => void answerPause('abandon')}
                disabled={pauseAnswering}
                style={{
                  background: 'none', border: '1px solid #7f1d1d', borderRadius: 6,
                  color: pauseAnswering ? '#334155' : '#fca5a5', padding: '7px 10px', fontSize: 12, fontWeight: 700,
                  cursor: pauseAnswering ? 'default' : 'pointer', fontFamily: 'system-ui, sans-serif', outline: 'none',
                }}
              >
                End the run
              </button>
              <div style={{ fontSize: 10, color: '#475569', fontFamily: 'system-ui, sans-serif' }}>
                Ending keeps every note you have typed so far. Skipping is not an error -- the
                methods already handle a call that returns nothing.
              </div>
            </div>
          </>
        ) : walkActive ? (
          <>
            {/* D-BP149-044/BISHOP/S44/seg-steppedmode -- STEPPED WALK PANEL. LEFT: the current
                step's captured events, rendered full-text with TranscriptLine (same component
                the normal transcript uses, so nothing here is ever truncated or reformatted). */}
            <div style={{
              flex: 1.6, minWidth: 0, background: '#05080d', overflowY: 'auto', padding: '10px 14px',
              fontFamily: 'Consolas, "Courier New", monospace', fontSize: 12, lineHeight: 1.5,
            }}>
              <div style={{ color: '#60a5fa', fontWeight: 700, marginBottom: 8, fontFamily: 'system-ui, sans-serif', fontSize: 13 }}>
                AUDIT THE RUN -- STEP {walkIndex + 1} of {walkSteps.length}
                {walkIndex === 0 ? '  (the question, as the engine has it, and every option)' : ''}
              </div>
              {(walkSteps[walkIndex] ?? []).map((evt, i) => <TranscriptLine key={i} evt={evt} />)}
            </div>

            <div style={{ width: 6, flexShrink: 0, background: '#1e2a38' }} />

            {/* RIGHT: his response at this exact step, then Go (advance, or finish on the last
                step) or Abandon (write whatever was collected and stop). */}
            <div style={{ width: rightW || 280, flexShrink: 0, background: '#0d1117', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
              <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'system-ui, sans-serif' }}>
                Same queries, same order, same terminator as the run that already happened -- this
                walk is a pacing layer over that captured transcript, not a second run.
              </div>
              <label style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'system-ui, sans-serif' }}>
                Your note on this step (saved when you press Go; blank is fine)
              </label>
              {/* A TEXTAREA, NOT AN INPUT, AND ENTER DOES NOT ADVANCE.
                  Founder, BP149: "it stops and lets me start typing, but then it assumes I
                  abandoned, so I need it to stop UNTIL I SAY GO" and "I need the text box where I
                  type to be bigger vertically, and the sentences to LF at the end so that they
                  wrap in the box and I can see the entire two paragraphs I want to type."
                  All three complaints had ONE cause: this was a single-line <input> whose Enter
                  key called handleWalkGo. Typing a paragraph and pressing Enter for a new line
                  advanced the step, and on the last step it finalized and wrote the file -- which
                  reads exactly like being assumed to have abandoned. A single-line input also
                  cannot wrap or show two paragraphs.
                  Now: Enter inserts a newline like anywhere else, the walk advances ONLY when he
                  presses Go, and Ctrl+Enter is a keyboard shortcut for Go for when he wants one. */}
              <textarea
                ref={walkInputRef}
                value={walkInput}
                onChange={(e) => setWalkInput(e.target.value)}
                onKeyDown={handleWalkInputKeyDown}
                disabled={walkSubmitting}
                rows={12}
                wrap="soft"
                placeholder={'Type as much as you want. Enter makes a new line.\nThe walk only advances when you press Go (or Ctrl+Enter).'}
                style={{
                  background: '#05080d', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0',
                  padding: '8px 10px', fontSize: 13, fontFamily: 'Consolas, monospace', outline: 'none',
                  width: '100%', boxSizing: 'border-box', minHeight: 260, resize: 'vertical',
                  whiteSpace: 'pre-wrap', overflowWrap: 'break-word', lineHeight: 1.5,
                }}
              />
              <button
                type="button"
                onClick={handleWalkGo}
                disabled={walkSubmitting}
                style={{
                  background: walkSubmitting ? '#1e2a38' : 'linear-gradient(135deg, #059669, #10b981)',
                  color: walkSubmitting ? '#64748b' : '#fff', border: 'none', borderRadius: 6,
                  padding: '8px 10px', fontSize: 13, fontWeight: 700, cursor: walkSubmitting ? 'default' : 'pointer',
                  fontFamily: 'system-ui, sans-serif', outline: 'none',
                }}
              >
                {walkSubmitting ? 'Writing…' : (walkIndex + 1 < walkSteps.length ? 'Go ▸' : 'Go -- finish walk ▸')}
              </button>
              <button
                type="button"
                onClick={handleAbandonWalk}
                disabled={walkSubmitting}
                style={{
                  background: 'none', border: '1px solid #7f1d1d', borderRadius: 6,
                  color: walkSubmitting ? '#334155' : '#fca5a5', padding: '7px 10px', fontSize: 12, fontWeight: 700,
                  cursor: walkSubmitting ? 'default' : 'pointer', fontFamily: 'system-ui, sans-serif', outline: 'none',
                }}
              >
                End the audit
              </button>
              {walkResult && !walkResult.ok && (
                <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#fca5a5', wordBreak: 'break-word' }}>
                  failed: {walkResult.error}
                </div>
              )}
              <div style={{ marginTop: 'auto', fontSize: 10, color: '#334155', fontFamily: 'system-ui, sans-serif', lineHeight: 1.5 }}>
                Your response is recorded verbatim against this exact step and shown in the
                transcript on the left -- it never changes what already ran. A human reads the
                teaching file afterward and implements any correction by hand.
              </div>
            </div>
          </>
        ) : (
        <>
        {/* LEFT: the live transcript */}
        <div style={{
          flex: 1.6, minWidth: 0, background: '#05080d', overflowY: 'auto', padding: '10px 14px',
          fontFamily: 'Consolas, "Courier New", monospace', fontSize: 12, lineHeight: 1.5,
        }}>
          {transcript.length === 0 && (
            <div style={{ color: '#334155' }}>
              Type a bundled MMLU-Pro question id (e.g. 98) or a plain question in the panel on the right, then press Enter.
              {'\n'}The cascade runs here, live, stage by stage -- nothing is pasted in from outside.
            </div>
          )}
          {transcript.map((evt, i) => <TranscriptLine key={i} evt={evt} />)}
          {running && (
            <div style={{ color: '#22d3ee', marginTop: 4 }}>
              <span style={{ opacity: 0.6 }}>▌ running…</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* THE DIVIDER. Drag it anywhere; double-click snaps the panes to an even half. */}
        <div
          onMouseDown={() => setDragging(true)}
          onDoubleClick={halveScreen}
          title="Drag to resize. Double-click for an even split."
          style={{
            width: 6, flexShrink: 0, cursor: 'col-resize',
            background: dragging ? '#22d3ee' : '#1e2a38',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div style={{ width: 2, height: 34, borderRadius: 1, background: dragging ? '#0d1117' : '#334155' }} />
        </div>

        {/* RIGHT: the prompt. width 0 only on the very first paint, before the container is
            measured; the effect above sets it to half immediately after. */}
        <div style={{ width: rightW || 280, flexShrink: 0, background: '#0d1117', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
          <label style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'system-ui, sans-serif' }}>
            Question or qid
          </label>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={running}
            placeholder="98  or  What is..."
            style={{
              background: '#05080d', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0',
              padding: '8px 10px', fontSize: 13, fontFamily: 'Consolas, monospace', outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={() => void handleRun()}
            disabled={running || !input.trim()}
            style={{
              background: running || !input.trim() ? '#1e2a38' : 'linear-gradient(135deg, #059669, #10b981)',
              color: running || !input.trim() ? '#64748b' : '#fff', border: 'none', borderRadius: 6,
              padding: '8px 10px', fontSize: 13, fontWeight: 700, cursor: running || !input.trim() ? 'default' : 'pointer',
              fontFamily: 'system-ui, sans-serif', outline: 'none',
            }}
          >
            {running ? 'Running…' : 'Run ▸'}
          </button>

          {lastOutcome && (
            <div style={{
              marginTop: 4, padding: '8px 10px', borderRadius: 6, fontSize: 11, fontFamily: 'monospace',
              background: lastOutcome.abstain ? '#3f2d0a' : lastOutcome.ok ? '#052e1e' : '#3f0a0a',
              border: `1px solid ${lastOutcome.abstain ? '#a16207' : lastOutcome.ok ? '#059669' : '#991b1b'}`,
              color: lastOutcome.abstain ? '#facc15' : lastOutcome.ok ? '#6ee7b7' : '#fca5a5',
            }}>
              {lastOutcome.freeText
                ? (lastOutcome.abstain ? 'ABSTAIN (no extractable answer)' : `ANSWER: ${lastOutcome.verdict}`)
                : (lastOutcome.abstain ? `ABSTAIN  key=${lastOutcome.correct ?? '?'}` : `${lastOutcome.ok ? 'CORRECT' : 'WRONG'}  ${lastOutcome.verdict}  key=${lastOutcome.correct ?? '?'}`)}
              {lastOutcome.basis && <div style={{ marginTop: 3, opacity: 0.8 }}>{lastOutcome.basis}</div>}
            </div>
          )}

          {/* D-BP149-044/BISHOP/S44/seg-steppedmode -- offered whenever the run did NOT
              deterministically resolve (ABSTAIN / no_method_matched / method_not_yet_taught, all
              covered by outcome.abstain). Never forced -- a clean correct or clean-wrong-but-
              answered run has no stepped-walk offer at all, per the ticket's own instruction to
              keep those a single fast run. */}
          {offersSteppedWalk(lastOutcome) && lastRunEvents.length > 0 && !walkActive && (
            <button
              type="button"
              onClick={handleStartWalk}
              style={{
                marginTop: 4, width: '100%',
                background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
                color: '#fff', border: 'none', borderRadius: 6,
                padding: '8px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'system-ui, sans-serif', outline: 'none',
              }}
            >
              Audit the Run ▸
            </button>
          )}

          {!walkActive && walkResult && (
            <div style={{
              marginTop: 2, fontSize: 10, fontFamily: 'monospace', wordBreak: 'break-word',
              color: walkResult.ok ? '#6ee7b7' : '#fca5a5',
            }}>
              {walkResult.ok
                ? `walk written: ${walkResult.filePath} (${walkResult.bytes} bytes)`
                : `walk failed: ${walkResult.error}`}
            </div>
          )}

          {isTeachableOutcome(lastOutcome) && lastOutcome && (
            <div style={{ marginTop: 4, padding: '8px 10px', borderRadius: 6, background: '#1e2a38', border: '1px solid #334155' }}>
              <div style={{ fontSize: 11, color: '#facc15', fontFamily: 'system-ui, sans-serif', fontWeight: 700, marginBottom: 4 }}>
                Teach the terminal
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'system-ui, sans-serif', marginBottom: 6, lineHeight: 1.4 }}>
                {shapeTestSummaryFor(lastOutcome)} Type how you would work this one, in your own words. Written to disk verbatim -- nothing here is summarized, and no method is auto-generated from it.
              </div>
              <textarea
                value={teachText}
                onChange={(e) => setTeachText(e.target.value)}
                disabled={teachSubmitting}
                placeholder="First I would..."
                rows={14}
                style={{
                  width: '100%', boxSizing: 'border-box', background: '#05080d', border: '1px solid #334155',
                  borderRadius: 6, color: '#e2e8f0', padding: '8px 10px', fontSize: 12,
                  fontFamily: 'Consolas, monospace', outline: 'none', resize: 'vertical',
                  // Grows with the pane. Teaching a method is several paragraphs, and the old
                  // six-row box in a 280px column showed about eight words per line.
                  minHeight: 220,
                }}
              />
              <button
                type="button"
                onClick={() => void handleTeachSubmit()}
                disabled={teachSubmitting || !teachText.trim()}
                style={{
                  marginTop: 6, width: '100%',
                  background: teachSubmitting || !teachText.trim() ? '#1e2a38' : 'linear-gradient(135deg, #b45309, #f59e0b)',
                  color: teachSubmitting || !teachText.trim() ? '#64748b' : '#fff', border: 'none', borderRadius: 6,
                  padding: '7px 10px', fontSize: 12, fontWeight: 700,
                  cursor: teachSubmitting || !teachText.trim() ? 'default' : 'pointer',
                  fontFamily: 'system-ui, sans-serif', outline: 'none',
                }}
              >
                {teachSubmitting ? 'Writing…' : 'Teach ▸'}
              </button>
              {teachResult && (
                <div style={{
                  marginTop: 6, fontSize: 10, fontFamily: 'monospace', wordBreak: 'break-word',
                  color: teachResult.ok ? '#6ee7b7' : '#fca5a5',
                }}>
                  {teachResult.ok
                    ? `written: ${teachResult.filePath} (${teachResult.bytes} bytes)`
                    : `failed: ${teachResult.error}`}
                </div>
              )}
            </div>
          )}

          {recent.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontFamily: 'system-ui, sans-serif' }}>Recent</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {recent.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setInput(r)}
                    disabled={running}
                    style={{
                      background: 'none', border: '1px solid #1e2a38', borderRadius: 5, color: '#94a3b8',
                      fontSize: 11, padding: '4px 8px', textAlign: 'left', cursor: running ? 'default' : 'pointer',
                      fontFamily: 'Consolas, monospace', outline: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 'auto', fontSize: 10, color: '#334155', fontFamily: 'system-ui, sans-serif', lineHeight: 1.5 }}>
            Every completed question writes one heartbeat line to the yoke ledger
            (HARDWIRE\LEDGER\YOKE\HEARTBEAT\LIANA-TERMINAL.beat) -- visible to Bishop without
            copying anything back.
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
}

export default LianaCycleTab;
