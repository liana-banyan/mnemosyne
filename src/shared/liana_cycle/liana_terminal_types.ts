// liana_terminal_types.ts -- D-BP149-034/BISHOP/S34/seg-lianaterminal
//
// Shared vocabulary for the Liana Cycle terminal (main <-> renderer, tsconfig.main.json AND
// tsconfig.renderer.json both see src/shared/**, same convention as
// shared/plow/browser_authority_types.ts and shared/membership_types.ts).
//
// Ratified canon: Asteroid-ProofVault/state/eblets/CANON/
//   canon_liana_cycle_terminal_window_we_fight_as_we_train_bp148.eblet.md
// Founder, BP148: "the liana cycle is exactly that process, and we need it anyway, so why not
// make the terminal window view, and use it, so we can save what we can token wise, while
// actually using the real deal as practice? We fight as we train."
// Founder, BP149: "Seriously, build it, and use gemma to do it with our MIC method, if possible."

/** One printed line of the live transcript, mirroring founder_cascade_v2.mjs's console output
 *  (say/step/fact/note/header) one-for-one so the left pane is the SAME cascade, just rendered
 *  in the app instead of a separate terminal window. */
export type LianaTerminalEventKind = 'header' | 'stage' | 'fact' | 'note' | 'result' | 'error';

export interface LianaTerminalEvent {
  kind: LianaTerminalEventKind;
  text: string;
  /** Real UTC ISO timestamp (new Date().toISOString()), never a self-reported estimate --
   *  HARDWIRE canon "never report a self-measured quantity without an instrument". */
  ts: string;
}

export interface LianaTerminalOutcome {
  /** Present when the input parsed as a bundled MMLU-Pro question id. */
  qid?: number;
  question: string;
  /** The lettered verdict (e.g. "A"), or null on an honest abstain. */
  verdict: string | null;
  /** The answer key, only present for a bundled qid run (a raw free-text question has no key). */
  correct?: string;
  ok?: boolean;
  basis?: string;
  abstain: boolean;
  /** True when the input did not parse as a bundled qid (a free-text question, with or without
   *  its own typed lettered options). */
  freeText: boolean;
  error?: string;
  /** D-BP149-041 (method registry): the id of the registered method that answered this question
   *  (e.g. 'comparative-cascade'), when one matched. ADDITIVE/OPTIONAL -- absent whenever no
   *  method matched, a method's shape matched but it is an unimplemented stub, or the terminal
   *  threw before method selection ran; every pre-registry caller that destructures only the
   *  older fields keeps compiling and behaving identically. */
  method?: string;
  /** D-BP149-043 (Teach box): the parsed lettered option pool for this run, when one was
   *  present -- null for a bare free-text question with no lettered options, undefined only if
   *  parsing never got far enough to know (e.g. the terminal threw before parsing). ADDITIVE/
   *  OPTIONAL, populated by liana_terminal_engine.ts at every return site; the LianaCycleTab.tsx
   *  Teach box uses this to write the option list into a teaching file without re-parsing the
   *  operator's raw input string itself. */
  options?: Record<string, string> | null;
  /** D-BP150-001 (Call an Audible): every pause the operator was shown and what they did about
   *  it, in order, verbatim. Present only on a run that had audible mode ON and reached at least
   *  one pause. ADDITIVE/OPTIONAL -- a normal run omits it entirely and every pre-audible caller
   *  keeps compiling. This is the record that makes an audible a TEACHING event rather than a
   *  one-off steer: a rewritten query that worked is a candidate method revision. */
  audibleLog?: LianaAudibleRecord[];
}

// ─────────────────────────── D-BP150-001: CALL AN AUDIBLE ───────────────────────────
//
// Founder, BP149, verbatim: "a button or toggle to 'let me redirect it before the next Google
// Call'." And, on the Audit the Run box that preceded it: "I need it to stop UNTIL I SAY GO."
//
// THIS IS NOT "AUDIT THE RUN", AND THE TWO MUST NEVER BE MERGED INTO ONE CONTROL. Audit the Run
// paces a run that has ALREADY FINISHED and captures notes against each recorded step. Call an
// Audible stops a LIVE run at a real decision point and lets the operator change what happens
// next. Founder ruling, carried in bishop_coffee.BP149_close_BP150_open.md: "A button that looks
// like it steers and only annotates is the exact defect class this session spent twelve hours
// removing."
//
// THE PAUSE IS TWO-SIDED, and the second side is the one that earns its keep. The going-out
// pause is what the Founder asked for. The coming-back pause exists because the defect that hid
// for four sessions was on the RETURN path: `extractBrowserAuthorityAnswer` reported
// success:false whenever Google rendered no answer box, and five real scraped results were
// deleted before anything could look at them (fixed BP149, commit 8ec02925, never yet watched
// live). Estate rule, BP141: check the PARSER before the SOLVER -- print what a component
// RECEIVED before instrumenting what it DOES. The after-return pause is that rule as a control.

/** Which side of a Google call the operator is being stopped at.
 *  - `before_query`  -- the literal query is about to be sent and can still be changed.
 *  - `after_return`  -- the call came back; this is the RAW text, before Gemma extraction and
 *                       before any parse decision. */
export type LianaAudiblePhase = 'before_query' | 'after_return';

/** One raw organic result exactly as the scraper captured it. Deliberately NOT flattened to a
 *  single string: comparative_cascade.ts's own header records that a block's body refers to its
 *  title with pronouns, and flattening destroyed that reference for a whole BP149 session. */
export interface LianaAudibleRawBlock {
  title: string;
  body: string;
  url: string;
}

/** What the operator is shown at one pause. */
export interface LianaAudiblePause {
  /** Unique within a run. The renderer echoes it back on the response so a stale reply from an
   *  earlier pause can never resolve a later one -- the pauses are sequential, but the UI is
   *  not, and a mis-routed response would silently steer the wrong call. */
  pauseId: string;
  phase: LianaAudiblePhase;
  /** 1-based index of this Google call within the run, for the transcript and the teaching file. */
  callIndex: number;
  /** `before_query`: the query about to go out, character for character -- never a summary or a
   *  cleaned-up rendering of it. `after_return`: the query that was actually sent (which may be
   *  the operator's own rewrite from the paired before_query pause). */
  query: string;
  /** `after_return` only. The answer-box snippet, or '' when Google rendered no box -- an empty
   *  string here is honest and load-bearing, not a failure: it means the facts are in `blocks`. */
  rawSnippet?: string;
  /** `after_return` only. The organic results, untruncated. */
  blocks?: LianaAudibleRawBlock[];
  /** `after_return` only. Null when the call returned nothing at all. */
  sourceUrl?: string | null;
  ts: string;
}

/** What the operator can do at a pause.
 *  - `go`       -- proceed unchanged (valid at both phases).
 *  - `rewrite`  -- `before_query` only: send `replacementQuery` instead, verbatim.
 *  - `skip`     -- treat this call as having returned nothing. The methods already handle a null
 *                  lookup; this is not a new code path for them.
 *  - `abandon`  -- stop the run here. Everything already typed is kept (Founder, BP149: "a walk
 *                  that throws away your annotations because you quit early is worse than no
 *                  walk"). */
export type LianaAudibleAction = 'go' | 'rewrite' | 'skip' | 'abandon';

/** The operator's answer to one pause. */
export interface LianaAudibleResponse {
  pauseId: string;
  action: LianaAudibleAction;
  /** `rewrite` only. Sent verbatim, never parsed, normalized, or re-templated. */
  replacementQuery?: string;
  /** Optional at every pause and recorded verbatim. Founder, BP149: "I DESPISE SUMMARIES." */
  note?: string;
}

// ─────────────── D-BP150-002: EARLIER NOTES, AVAILABLE INSIDE A LIVE PAUSE ───────────────
//
// Founder, BP150: "I'd like to start the Call an Audible, and then post whichever of my notes I
// want into the textbox I'm typing in, so I don't have to go read it, or do it from memory."
//
// The notes he wrote walking qid 85 ARE the plan for the method that does not exist yet. Making
// him retype them from memory, at the exact moment they apply, is where a plan goes to die. These
// types carry the already-written teaching files back into the live pause panel.
//
// PARSED FROM THE FILES THIS APP ITSELF WROTE, not from a database. The format is deterministic
// because index.ts's 'liana-teach-submit' handler is its only author -- so the four files already
// on disk from BP149/BP150 are readable without migrating anything, which is the whole point: he
// wants THESE notes, written an hour ago, not notes captured after some future schema change.

/** One thing the operator typed, exactly as typed. */
export interface LianaTeachingNote {
  /** 1-based step number within a stepped walk; null for a plain Teach-box entry, which is one
   *  undivided block rather than a per-step annotation. */
  stepIndex: number | null;
  stepTotal: number | null;
  /** The step's own boundary line (e.g. "[stage] -> STAGE 1  ask the inverse..."), so he can
   *  recognize which moment a note belonged to without opening the file. */
  heading: string;
  /** VERBATIM. Never trimmed beyond surrounding blank lines, never reflowed, never summarized. */
  text: string;
}

export interface LianaTeachingFile {
  filePath: string;
  fileName: string;
  /** e.g. "qid85" -- the slug the writer used, which is how a file is matched to a question. */
  label: string;
  /** The question text as recorded at write time. */
  question: string;
  /** UTC ISO, taken from the filename stamp the writer minted. */
  writtenAt: string;
  /** True when the walk was ended early. Kept because an abandoned walk's notes are still real
   *  notes -- and his qid 85 walk was abandoned at step 8 of 17. */
  abandoned: boolean;
  notes: LianaTeachingNote[];
}

/** One pause and its answer, joined, for the outcome's `audibleLog` and the teaching file.
 *  Written by the main process, never reconstructed in the renderer, so the record reflects what
 *  the ENGINE actually did rather than what the UI believes it asked for. */
export interface LianaAudibleRecord {
  pauseId: string;
  phase: LianaAudiblePhase;
  callIndex: number;
  /** The query as the method generated it, before any operator change. */
  originalQuery: string;
  /** What was actually sent. Equals `originalQuery` unless the operator rewrote it. */
  effectiveQuery: string;
  action: LianaAudibleAction;
  note?: string;
  ts: string;
}
