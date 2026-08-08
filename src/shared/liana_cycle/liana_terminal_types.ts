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
}
