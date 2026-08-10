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
  /** D-BP151-023 (Stepped Audible): every PER-FOUNDER-STEP pause the operator was shown and what
   *  they did about it, in order, verbatim. Present only on a run that had stepped-audible mode
   *  ON and reached at least one pause. ADDITIVE/OPTIONAL, same convention as audibleLog above --
   *  a normal run, and a run whose audible mode is the per-call one, both omit it entirely. */
  steppedLog?: LianaSteppedRecord[];
  /** D-BP151-026 (Contingency Operator: Survey Splice), ADDITIVE/OPTIONAL, same "a normal run
   *  omits it entirely" convention as audibleLog/steppedLog above. Present ONLY when the
   *  Contingency Operator Survey Splice variant was ON for this run (Founder, BP151, Q-20: "This
   *  is a case for Contingency Operators. Do it, and see if it works before I ratify" -- a
   *  Contingency Operator "is not ratified by existing"), so the receipt always states which
   *  variant produced it. Absent on every run with the variant off, which is every run before
   *  this ticket and every run after it that does not opt in -- the shipped/default path is
   *  identified by the field's ABSENCE, exactly the way audible/stepped-audible mode being off is
   *  identified by audibleLog/steppedLog's absence, not by a separate "off" value. See
   *  liana_terminal_engine.ts's isContingencyOperatorSurveySpliceEnabled() for the gate.
   *
   *  D-BP151-027 (Contingency Operator: Abstain Clues) ADDS its own literal to this same union --
   *  see comparative_cascade.ts's isAbstainCluesModeEnabled() for that gate. The two variants are
   *  independent (different tickets, different files, different SEGs live at the same time this
   *  literal was added -- D-BP151-025/026 own survey_stage.ts/elements/liana_terminal_engine.ts;
   *  this ticket touches ONLY this shared type file, additively, and comparative_cascade.ts). */
  variant?: 'contingency-operator-survey-splice' | 'contingency-operator-abstain-clues';
  /** D-BP151-027 (Contingency Operator: Abstain Clues), ADDITIVE/OPTIONAL, same "a normal run
   *  omits it entirely" convention as audibleLog/steppedLog/variant above. Present ONLY when the
   *  Abstain Clues variant was ON for this run AND the run actually abstained -- Founder, BP151
   *  (FD-BP151-26), verbatim: "If abstain happens, give the runners-up based on exactly what
   *  isn't authoritative, but gives clues... Just identify every guess as such, with what it is
   *  using to guess." Absent on every run with the variant off (every run before this ticket and
   *  every run after that does not opt in) AND absent on any run that answers instead of
   *  abstaining -- this field NEVER accompanies a non-null `verdict`, and its presence or absence
   *  never changes `verdict`/`ok`/`abstain` above, which this Contingency Operator does not touch.
   *  See comparative_cascade.ts's isAbstainCluesModeEnabled() for the gate and
   *  buildAbstainCluesReport() for what this contains and where each signal is harvested from. */
  abstainClues?: ComparativeAbstainCluesReport;
  /** D-BP152-016 (SC-01 wiring: score every future run, not just qid-98 receipts on disk).
   *  ADDITIVE/OPTIONAL, same "a normal run omits it entirely" convention as audibleLog/steppedLog/
   *  variant/abstainClues above. Present ONLY when the Contingency Operator Survey Splice variant
   *  was ON for this run (SC-01 scores `FounderStep2Result`, which only Survey produces) AND
   *  scoring itself did not throw. `LianaSc01Result` below structurally mirrors `SC01Result`
   *  (sc01_pivot_terms_scorer.ts, main-only -- not imported here, same reason
   *  ComparativeAbstainCluesReport is DEFINED here rather than in its main-only producer file, see
   *  that type's own header immediately below). No pass/fail, no promotion, no verdict anywhere in
   *  this shape (FD-BP152-10) -- numbers and the full, uncollapsed enumeration only (FD-BP152-12).
   *  Scoring reads what Survey already produced; it issues no query and changes no control flow. */
  sc01?: LianaSc01Result;
  /** D-BP152-016. Present ONLY when SC-01 scoring itself threw -- the run's own verdict/abstain
   *  above is UNAFFECTED either way ("A scorer that can kill a run is worse than no scorer.").
   *  Mutually exclusive with `sc01` above (a thrown scoring attempt produces no result to report). */
  sc01ScoringError?: string;
}

// ─────────────────────────── D-BP152-016: SC-01 (Contingency Operator: Survey Splice only) ───────────────────────────
//
// Structural mirror of SC01Result/SC01TermScore/SC01EnumeratedMeaning
// (src/main/liana_cycle/sc01_pivot_terms_scorer.ts) -- NOT imported from there, for the same
// cross-boundary reason ComparativeAbstainCluesReport above is defined here rather than in
// comparative_cascade.ts: this file is shared main+renderer, the scorer file is main-only. The
// real scorer function (scoreSc01PivotTerms(), unmodified, un-forked) is the only thing that ever
// constructs a value of this shape; every field name and type below is copied from it verbatim.

/** One enumerated denotation for one pivot term, kept in full -- never summarized, never
 *  deduplicated (FD-BP152-12). Mirrors SC01EnumeratedMeaning. */
export interface LianaSc01EnumeratedMeaning {
  sentence: string;
  sourceUrl: string;
  sourceTitle: string;
  register: string | null;
  fromLevel: string;
}

/** Mirrors SC01TermScore -- every predicate broken out so the receipt shows WHICH of the three
 *  SC-01 conditions failed, not only a final boolean. */
export interface LianaSc01TermScore {
  term: string;
  verbatimInQuestion: boolean;
  carriesTriple: boolean;
  hasNamedSourceDefinition: boolean;
  countsTowardStrictCount: boolean;
  enumeratedMeanings: LianaSc01EnumeratedMeaning[];
}

/** Mirrors SC01Result. */
export interface LianaSc01Result {
  qid: number;
  questionText: string;
  strictCount: number;
  diagnostics: { namedCount: number; tripleCount: number; definedCount: number };
  terms: LianaSc01TermScore[];
  ambiguityQueryUnusable: boolean;
  why: string;
}

// ─────────────────────────── D-BP151-027: ABSTAIN CLUES (Contingency Operator) ───────────────────────────
//
// Founder, BP151 (FD-BP151-26), verbatim, positing this Contingency Operator himself: "And I want
// to know the WHY of abstain. So we can make it not, with deterministic reasons. Actually -
// instead, I'd like to posit a CO of my own: If abstain happens, give the runners-up based on
// exactly what isn't authoritative, but gives clues. Like the sole-survivor - not definitive on
// it's own, but there are other rules and principles we can apply that, combined with it, ARE
// definitive. Just identify every guess as such, with what it is using to guess."
//
// Defined HERE, not in comparative_cascade.ts, for the same reason LianaAudibleRecord/
// LianaSteppedRecord are defined here rather than in the method file that produces them: this
// file is shared main+renderer (tsconfig.main.json AND tsconfig.renderer.json), a method file is
// main-only, and LianaTerminalOutcome (which carries this report) is itself defined here.

/** The exact non-authoritative signal a guess is based on -- the Founder's own four worked
 *  examples (FD-BP151-26) and no fifth invented. See comparative_cascade.ts's
 *  buildAbstainCluesReport() for exactly how each one is detected, all four from values the
 *  terminator already computed and was about to discard. */
export type ComparativeAbstainSignal =
  | 'sole-survivor'
  | 'vote-count'
  | 'coverage-incomplete'
  | 'value-no-convergence';

/** One runner-up, labeled a GUESS, with the exact signal it is guessing from -- his own words:
 *  "identify every guess as such, with what it is using to guess." NEVER an answer: this type
 *  only ever appears inside LianaTerminalOutcome.abstainClues, which itself only ever appears
 *  alongside `verdict: null`. */
export interface ComparativeAbstainClue {
  letter: string;
  optionText: string;
  signal: ComparativeAbstainSignal;
  /** Always starts with "GUESS:" and always names the signal in plain language, per his
   *  instruction to identify every guess as such. */
  guess: string;
  /** The rule this clue leans on and its attribution status (HARDWIRE-23 Law 5: "the receipt
   *  names which rule fired, and who ordered it"). */
  basis: string;
}

/** The structured report attached to an abstain when the Abstain Clues Contingency Operator is
 *  ON. `runnersUp` is intentionally UNRANKED across signal types (this ticket's own hard
 *  constraint: "DO NOT INVENT A RANKING NUMBER... reporting them unranked, each with its named
 *  signal, is an acceptable and honest outcome") -- the only ordering preserved is the ONE that
 *  already existed in the terminator's own vote-count sort, reused verbatim for the vote-count
 *  group. */
export interface ComparativeAbstainCluesReport {
  runnersUp: ComparativeAbstainClue[];
  /** Which branch withheld and why, harvested VERBATIM from the terminator's own notes
   *  (evaluateComparativeTerminator's return, .notes) -- never re-derived or paraphrased. */
  whyAbstained: string[];
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

// ─────────────────────────── D-BP151-023: STEPPED AUDIBLE (per-Founder-step pause) ───────────────────────────
//
// Founder, BP151, verbatim: "I want it to list my steps, and then show it happen, then stop
// before the next step and shows suggestions, for me to respond to or correct."
//
// NOT THE SAME AS D-BP150-001 (CALL AN AUDIBLE, above), and the two must stay separate the same
// way Call an Audible stayed separate from Audit the Run (see that feature's own header). Call an
// Audible pauses on BOTH SIDES OF EVERY GOOGLE CALL -- per-call granularity. This pauses ONCE PER
// STAGE the running method emits (`kind:'stage'`) -- per-Founder-step granularity, with each stage
// mapped to one of his 18 numbered steps in
// BISHOP_DROPZONE\THE_FOUNDERS_PROCESS_ORDERED_BP151.md, or marked TARE (HARDWIRE-23) when the
// stage is not his. See src/main/liana_cycle/stepped_audible.ts for the decorator, the mapping
// table, and why it is scoped to the comparative-cascade method only.

/** A stage in the running method traces to one of the Founder's numbered steps, verbatim and
 *  cited, or it does not -- HARDWIRE-23 Law 1: "there is no third category." */
export type LianaSteppedAttribution = 'ATTRIBUTED' | 'TARE';

/** One entry in the step list shown BEFORE the run starts (requirement A of D-BP151-023), and
 *  reused as the `step` field of every pause for that same stage (requirement C.1). Static per
 *  method -- built once from the Founder's process document, not derived from a live run, so it
 *  can be shown before the first Google call goes out. */
export interface LianaSteppedStepDef {
  /** Stable key this decorator matches a runtime `kind:'stage'` event's text against, e.g.
   *  'stage0', 'q1', 'stage5b'. Never shown to the operator directly -- `codeLabel` is. */
  key: string;
  attribution: LianaSteppedAttribution;
  /** Present ONLY when `attribution === 'ATTRIBUTED'` -- HARDWIRE-23 Law 4: a TARE entry must
   *  never carry an attribution string that could be mistaken for one. */
  founderStepNumber?: number;
  /** His exact words, verbatim, quoted or paraphrased NOWHERE -- present only when ATTRIBUTED. */
  founderWords?: string;
  /** Where founderWords is from, e.g. "Excerpt 2, BP141, rule 1 -- ...process...BP151.md step
   *  5". Present only when ATTRIBUTED. */
  founderSource?: string;
  /** Bishop's own one-line label for what the code stage does -- always present, ATTRIBUTED or
   *  TARE alike. This is a label for the STAGE, never a paraphrase of the Founder's words (those,
   *  when they exist, are carried verbatim in founderWords instead). */
  codeLabel: string;
}

/** What the operator is shown at one step pause (requirement C). */
export interface LianaSteppedPause {
  /** Unique within a run -- same stale-reply-cannot-resolve-a-later-pause guarantee as
   *  LianaAudiblePause.pauseId above. */
  pauseId: string;
  /** 1-based index of this step within the FULL step list shown up front (requirement A), so the
   *  operator can see "step 6 of 12" and match it to the list already shown. */
  stepIndex: number;
  stepTotal: number;
  step: LianaSteppedStepDef;
  /** Every transcript event emitted during the step that JUST COMPLETED, verbatim and
   *  untruncated -- reused from the existing emit/receipt path (requirement C.2), never
   *  re-derived or summarized by a second reporting mechanism. */
  events: LianaTerminalEvent[];
  /** Lettered sub-items from the process document for this Founder step, shown at the pause and
   *  labeled Bishop suggestions carrying NO authority (requirement C.3). Empty for a TARE step:
   *  a stage with no Founder order has no Founder sub-items to suggest against. */
  suggestions: string[];
  ts: string;
}

/** What the operator can do at a step pause. Per HARDWIRE-23 ("this build adds no decision
 *  rule"), NONE of these change what the method already did or will do next -- see
 *  stepped_audible.ts's own header. `approve`/`correct`/`redirect` are recorded verbatim as the
 *  authority record for whatever gets BUILT from this later (requirement E); `abandon` is the one
 *  action with a real effect -- it stops the walk from advancing further, same "keeps every note"
 *  guarantee as LianaAudibleAction's `abandon`. */
export type LianaSteppedAction = 'approve' | 'correct' | 'redirect' | 'abandon';

/** The operator's answer to one step pause. */
export interface LianaSteppedResponse {
  pauseId: string;
  action: LianaSteppedAction;
  /** VERBATIM. Never parsed, normalized, re-templated, or acted on automatically. */
  text?: string;
}

/** One step pause and its answer, joined -- the provenance/authority record (requirement E).
 *  Founder, BP151: "EVERYTHING DONE has a provenance authority receipt attached to it." Written
 *  by the main process from what actually happened, never reconstructed in the renderer. */
export interface LianaSteppedRecord {
  pauseId: string;
  stepIndex: number;
  stepKey: string;
  founderStepNumber?: number;
  attribution: LianaSteppedAttribution;
  action: LianaSteppedAction;
  /** His exact words, verbatim -- present only when he typed something. */
  text?: string;
  ts: string;
}
