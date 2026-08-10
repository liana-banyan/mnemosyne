// stepped_audible.ts -- D-BP151-023/BISHOP/seg-stepped-audible
//
// PER-STEP PAUSE. Founder, BP151, verbatim: "I want it to list my steps, and then show it happen,
// then stop before the next step and shows suggestions, for me to respond to or correct."
//
// NOT A REPLACEMENT FOR audible.ts, AND THE TWO MUST STAY SEPARATE -- same rule that keeps Call
// an Audible separate from Audit the Run (see audible.ts's own header). audible.ts pauses on both
// sides of EVERY Google call -- per-call granularity, and the Founder named it that way himself
// (BP149: "before the next Google Call"). This file pauses ONCE PER STAGE the running method
// emits (`kind:'stage'`), which comparative_cascade.ts already emits at every point its own
// header calls a "stage": STAGE 0, Q1..Q10, STAGE 5b (comparative_cascade.ts:199, 644, 756).
// THOSE EMISSIONS ARE THE STEP BOUNDARIES -- per this ticket's own instruction. This file does
// not invent a new boundary; it decorates the two channels the method already receives on
// MethodRunContext (askGoogle, emit), exactly the way audible.ts decorates askGoogle alone -- see
// that file's header for why a decorator, not a cascade rewrite, is correct here too. Read
// audible.ts in full before this file; this one repeats none of its reasoning, only what differs.
//
// WHY EMIT IS ALSO WRAPPED, NOT ONLY askGoogle: audible.ts's per-call pause works because
// askGoogle is AWAITED by every caller (googleBlocks() -> `await askGoogle(query)` in
// comparative_cascade.ts), so pausing inside the wrapped function genuinely blocks the run.
// emit() is NOT awaited anywhere (`emit({...})` -- every one of comparative_cascade.ts's own
// say/step/fact/note helpers calls it bare) -- a Promise returned from a wrapped emit() would be
// silently ignored by the caller and nothing would actually pause. So this decorator wraps emit()
// ONLY TO BUFFER events and detect a new 'stage' boundary; the real, blocking pause happens
// inside the wrapped askGoogle, immediately before the FIRST Google call of the step that just
// started -- which is, precisely, "after the previous step completed, before the next begins"
// (requirement C), because every stage in comparative_cascade.ts's run() is followed by at least
// one askGoogle call before the next 'stage' event fires. STAGE 0 is the one apparent exception
// (its own register-gate call never goes through askGoogle) -- but that is not a gap: STAGE 0's
// buffered content is shown at the pause that fires right before Q1's first call, which IS the
// "STAGE 0 is done, Q1 is about to start" boundary, the correct place for it.
//
// THE ONE GAP THIS DOES LEAVE, DISCLOSED RATHER THAN PAPERED OVER: STAGE 5b is the LAST 'stage'
// event comparative_cascade.ts's run() emits -- no further askGoogle call follows it, because the
// TERMINATOR that runs after it is pure arithmetic (comparative_cascade.ts:809-843, "Arithmetic
// only, no model below this line") with no more network calls and no more 'stage' events. So the
// buffer opened at STAGE 5b never gets a following askGoogle call to flush it through the normal
// path. finish() below exists ONLY to flush that one trailing buffer once `method.run()` has
// resolved -- it is not a 13th step boundary this file invented; it is the unavoidable last flush
// of the LAST real one. The TERMINATOR's own notes (which read as the mechanism behind Founder
// step 11, "the verdict is convergence, not a margin") land inside that same final flush, because
// they are emitted after STAGE 5b's step() and before run() returns, with no further 'stage'
// event in between. This is disclosed as a design choice in THINGS I NOTICED AND DID NOT DO in
// this ticket's return, not claimed as TERMINATOR having earned its own pause.
//
// SCOPED TO comparative-cascade ONLY, ON PURPOSE. definitional_cascade.ts (METHOD 2) also emits
// `kind:'stage'` events, but the Founder-step mapping table below (COMPARATIVE_CASCADE_STEP_DEFS)
// was built from THE_FOUNDERS_PROCESS_ORDERED_BP151.md's qid-98 worked case, which teaches
// comparative cascade's stages, not Method 2's qid-85 ones. Running this decorator against a
// method with no entry in that table would force a choice between silently skipping (looks
// broken, tells the operator nothing) or labeling every one of ITS stages TARE (a FALSE finding:
// "no Founder order exists" is a different claim than "this ticket did not map it"). Per
// HARDWIRE-23 ("do not stretch one of his steps to cover a stage he never described," and by the
// same logic, do not manufacture a TARE finding for a stage nobody has actually checked against
// his words yet), the honest answer for an out-of-scope method is: this decorator does not attach
// to it at all -- same as stepped-audible mode being OFF. See wrapForSteppedAudible()'s method-id
// gate below, and buildUpfrontStepList()'s null return for the same case.
//
// NO TIMEOUT, EVER -- identical rule to audible.ts, identical reason. Founder, BP149: "it stops
// and lets me start typing, but then it assumes I abandoned, so I need it to stop UNTIL I SAY
// GO." SteppedAudibleChannel.requestStepPause() below carries the same MUST-NOT-resolve-on-its-
// own constraint as AudibleChannel.requestPause().
//
// OFF STAYS IDENTICAL (requirement F). wrapForSteppedAudible() returns the SAME MethodRunContext
// object passed in, by reference, whenever `channel` is null OR `methodId` is not
// 'comparative-cascade' -- the identical structural guarantee audible.ts proves for its own
// off-state. No new object is allocated, no new closure runs, on the path that must be a no-op.
//
// NO DECISION RULE ADDED (HARDWIRE-23). A step pause's `approve` / `correct` / `redirect`
// response is recorded and nothing else -- it does not skip a call, does not rewrite a query,
// does not change pool membership, does not alter the terminator. Only `abandon` has a real
// effect (it stops the walk), and it is a mechanical stop, not a new answer-selection rule. What
// the method asks, in what order, and how it terminates are BYTE-IDENTICAL to a run with stepped
// audible off, module the pauses themselves.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// D-BP151-026/BISHOP/seg-contingency-operator -- EXTENDED TO RECOGNIZE SURVEY'S OWN STAGES.
//
// Founder, BP151, Q-20: "Splice into a Contingency Operator Variant so we can test." SEG return
// BP151-025 built survey_stage.ts's runSurveyStage() (Founder steps 2, 3, 4, 6) but did not touch
// this file (out of scope for that ticket) and left it unable to pause on Survey's own
// `kind:'stage'` events -- see its own return, fork 4(c). This ticket wires that gap, ADDITIVELY:
// a second, parallel step-def table (SURVEY_STEP_DEFS, below) alongside COMPARATIVE_CASCADE_STEP_
// DEFS, selected by a new `methodId === 'survey'` case everywhere this file branches on methodId
// (the gate in wrapForSteppedAudible(), buildUpfrontStepList()). classifyStageText() and
// findStepDef() now take the applicable table as a parameter so the SAME matching logic serves
// both tables rather than a second copy being written -- their DEFAULT parameter value is
// COMPARATIVE_CASCADE_STEP_DEFS, so every existing single-argument call site (this file's own
// wrapForSteppedAudible() before this edit, and every test that called classifyStageText(text)
// with one argument) resolves to the IDENTICAL table it always did -- an additive parameter, not
// a behavior change, per this file's own requirement F discipline.
//
// SURVEY_STEP_DEFS' four entries (steps 2, 3, 4, 6) are ATTRIBUTED with the SAME verbatim Founder
// quotes survey_stage.ts's own file header already carries (Excerpt 7 rule 12/13, Excerpt 2 rule
// 2, THE_FOUNDERS_PROCESS_ORDERED_BP151.md) -- copied, not re-derived, so this table cannot drift
// from the citations survey_stage.ts itself already carries. No new attribution is invented here.
//
// Survey never emits a stage with no Founder counterpart of its own (all four of its `kind:
// 'stage'` events map to Founder steps 2/3/4/6, per survey_stage.ts's own header) -- so
// SURVEY_STEP_DEFS has no TARE entry the way STAGE 5b is one for comparative-cascade. The TARE
// mechanism itself is unchanged and still fires for STAGE 5b exactly as before (regression-tested
// below) -- this ticket does not invent a Survey TARE entry where the Founder's own record gives
// none, per HARDWIRE-23 ("do not stretch one of his steps... and do not manufacture a TARE
// finding for a stage nobody has actually checked against his words").

import type {
  LianaSteppedAction,
  LianaSteppedAttribution,
  LianaSteppedPause,
  LianaSteppedRecord,
  LianaSteppedResponse,
  LianaSteppedStepDef,
  LianaTerminalEvent,
} from '../../shared/liana_cycle/liana_terminal_types';
import type { AskGoogleFn, EmitFn, MethodRunContext } from './method_registry';
// D-BP152-021/BISHOP/seg-ask-google-this -- reused, not forked. googleBlocks() is the SAME
// primitive Survey (survey_stage.ts's askAmbiguity()/askOperation()) and comparative_cascade.ts's
// own Q1-Q10 already send every Google query through -- "the EXISTING askGoogle channel", per this
// ticket's own requirement 2. survey_stage.ts already imports gemmaExtract/googleBlocks from this
// same file (methods/comparative_cascade.ts), so this import introduces no new circularity: that
// file imports only from method_registry.ts and register_gate_loader.ts, neither of which imports
// this one.
import { googleBlocks } from './methods/comparative_cascade';

/** How the engine reaches the operator for a step pause. Implemented over IPC in index.ts (same
 *  convention as AudibleChannel in audible.ts); kept as an interface here so this module has no
 *  Electron dependency and can be exercised without a window. */
export interface SteppedAudibleChannel {
  /** Shows one step pause and resolves with the operator's answer. MUST NOT resolve on its own --
   *  see this file's header on why there is no timeout. May REJECT if the operator's window is
   *  destroyed, which is the one non-operator way a pause ends (mirrors AudibleChannel). */
  requestStepPause: (pause: LianaSteppedPause) => Promise<LianaSteppedResponse>;
}

/** Thrown when the operator ends the run from inside a step pause. Same convention as
 *  audible.ts's AudibleAbandoned -- caught by the caller and converted into an honest outcome
 *  that KEEPS the stepped log, never silently discarded. */
export class SteppedAudibleAbandoned extends Error {
  constructor() {
    super('stepped_audible_abandoned');
    this.name = 'SteppedAudibleAbandoned';
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Collects what actually happened at every step pause, written by the engine rather than
 *  reconstructed by the UI -- same convention as audible.ts's AudibleLog. */
export class SteppedAudibleLog {
  private readonly records: LianaSteppedRecord[] = [];
  add(rec: LianaSteppedRecord): void { this.records.push(rec); }
  all(): LianaSteppedRecord[] { return this.records.slice(); }
  get length(): number { return this.records.length; }
}

// ─────────────────────────── the Founder's steps, mapped to comparative-cascade's stages ───────────────────────────
//
// Source read in full before this table was written:
// BISHOP_DROPZONE\THE_FOUNDERS_PROCESS_ORDERED_BP151.md ("THE FOUNDER'S PROCESS, IN ORDER -- qid
// 98 AS THE WORKED CASE", D-BP151-022/BISHOP/founders-process-ordered). Every founderWords string
// below is copied character for character from that file (its own quotes are themselves verbatim
// from his BP141/BP148/BP150 words, per that document's own sourcing). Order matches
// comparative_cascade.ts's run() order exactly: STAGE 0, Q1..Q10, STAGE 5b.
//
// STEPS THE LIVE CODE NEVER TOUCHES AT ALL, NAMED HERE SO THEIR ABSENCE IS NOT MISTAKEN FOR AN
// OVERSIGHT: Founder steps 2 (SURVEY), 3 (CATEGORIZE), 4 (DETERMINE REGISTER) and 6 (THE JAR
// METHOD) have NO corresponding `kind:'stage'` event anywhere in comparative_cascade.ts's run().
// deriveCategoryAndProperty() (comparative_cascade.ts:275-290) silently performs a regex-based
// stand-in for steps 2-4 and emits only a `note()`, never a `step()` -- so it is not a pausable
// boundary under this build, and this table does not invent one for it. The Jar Method's
// "eliminate what a source NAMED EXPLICITLY" (step 6) has no dedicated stage either; its nearest
// live-code relative is the high/low-word voting folded into Q1's extraction and the TERMINATOR's
// `denseElim` block (comparative_cascade.ts:811-816), neither of which is its own `kind:'stage'`
// emission. See this ticket's return, THINGS I NOTICED AND DID NOT DO.
export const COMPARATIVE_CASCADE_STEP_DEFS: LianaSteppedStepDef[] = [
  {
    key: 'stage0',
    attribution: 'ATTRIBUTED',
    founderStepNumber: 1,
    founderWords: 'FIRST. Figure out what the question is actually asking, with context like what you just said about how curriculum framing is taught and deserts and rainforests are not counted as regions. - So we need to vet the questions themselves, FIRST.',
    founderSource: 'Excerpt 3, BP141 -- THE_FOUNDERS_PROCESS_ORDERED_BP151.md, step 1',
    codeLabel: 'STAGE 0 -- register gate: is each option a member of the category at all?',
  },
  {
    key: 'q1',
    attribution: 'ATTRIBUTED',
    founderStepNumber: 5,
    founderWords: 'First I put in the inverse, because that usually cuts the question in half, at least: (I\'m asking for the B, as in opposite of what I actually want to know, which is the A)',
    founderSource: 'Excerpt 2, BP141, rule 1 -- THE_FOUNDERS_PROCESS_ORDERED_BP151.md, step 5',
    codeLabel: 'Q1 -- the inverse',
  },
  {
    key: 'q2',
    attribution: 'ATTRIBUTED',
    founderStepNumber: 7,
    founderWords: 'Now I make a DIFFERENT google search... \'Please put these regions in order of most densely to least densely populated.\'',
    founderSource: 'Excerpt 2, BP141 -- THE_FOUNDERS_PROCESS_ORDERED_BP151.md, step 7',
    codeLabel: 'Q2 -- order most to least, survivors',
  },
  {
    key: 'q3',
    attribution: 'ATTRIBUTED',
    founderStepNumber: 7,
    founderWords: 'AND another DIFFERENT google search to \'Please put these regions in order of least densely to most densely populated.\' -- to check accuracy of the same engine that I asked.',
    founderSource: 'Excerpt 2, BP141 -- THE_FOUNDERS_PROCESS_ORDERED_BP151.md, step 7',
    codeLabel: 'Q3 -- order least to most, survivors (opposite framing)',
  },
  {
    key: 'q4',
    attribution: 'ATTRIBUTED',
    founderStepNumber: 7,
    founderWords: 'Then I ask a FOURTH and FIFTH DIFFERENT google search to do the same thing, but with ALL of them, including the ones I eliminated in step 1 -- as a quality control.',
    founderSource: 'Excerpt 2, BP141 -- THE_FOUNDERS_PROCESS_ORDERED_BP151.md, step 7',
    codeLabel: 'Q4 -- order most to least, ALL options as quality control',
  },
  {
    key: 'q5',
    attribution: 'ATTRIBUTED',
    founderStepNumber: 7,
    founderWords: 'Then I ask a FOURTH and FIFTH DIFFERENT google search to do the same thing, but with ALL of them, including the ones I eliminated in step 1 -- as a quality control.',
    founderSource: 'Excerpt 2, BP141 -- THE_FOUNDERS_PROCESS_ORDERED_BP151.md, step 7',
    codeLabel: 'Q5 -- order least to most, ALL options as quality control',
  },
  {
    key: 'q6',
    attribution: 'ATTRIBUTED',
    founderStepNumber: 8,
    founderWords: 'Now I IN ADDITION use the \'Cake Cut Half\' method - where if I want guess a number my ten yr old is asking me between 1 and any number, I first cut it in half... But I invert it each time',
    founderSource: 'Excerpt 2, BP141, rule 3 -- THE_FOUNDERS_PROCESS_ORDERED_BP151.md, step 8',
    codeLabel: 'Q6 -- Cake Cut Half, remove the half that is least populated',
  },
  {
    key: 'q7',
    attribution: 'ATTRIBUTED',
    founderStepNumber: 8,
    founderWords: 'Now I IN ADDITION use the \'Cake Cut Half\' method - where if I want guess a number my ten yr old is asking me between 1 and any number, I first cut it in half... But I invert it each time',
    founderSource: 'Excerpt 2, BP141, rule 3 -- THE_FOUNDERS_PROCESS_ORDERED_BP151.md, step 8',
    codeLabel: 'Q7 -- Cake Cut Half, remove the half that is MOST populated (inverted direction)',
  },
  {
    key: 'q8',
    attribution: 'ATTRIBUTED',
    founderStepNumber: 10,
    founderWords: 'Finally, I ask the hard statistic numbers that will tell me the answer from probably ONE prompt',
    founderSource: 'Excerpt 2, BP141, rule 5 -- THE_FOUNDERS_PROCESS_ORDERED_BP151.md, step 10',
    codeLabel: 'Q8 -- the hard number, all options',
  },
  {
    key: 'q9',
    attribution: 'ATTRIBUTED',
    founderStepNumber: 10,
    founderWords: 'Finally, I ask the hard statistic numbers that will tell me the answer from probably ONE prompt',
    founderSource: 'Excerpt 2, BP141, rule 5 -- THE_FOUNDERS_PROCESS_ORDERED_BP151.md, step 10',
    codeLabel: 'Q9 -- sort by the property, most to least',
  },
  {
    key: 'q10',
    attribution: 'ATTRIBUTED',
    founderStepNumber: 10,
    founderWords: 'Finally, I ask the hard statistic numbers that will tell me the answer from probably ONE prompt',
    founderSource: 'Excerpt 2, BP141, rule 5 -- THE_FOUNDERS_PROCESS_ORDERED_BP151.md, step 10 (Q10 itself is his own "And for posterity" bonus question, RECOVERED_BP144.md line 238 -- present in his file word for word but named in the process document as not one of the seven core numbered-stage framings)',
    codeLabel: 'Q10 -- sort by the property, least to most',
  },
  {
    key: 'stage5b',
    // TARE -- HARDWIRE-23 Law 4. Already disclosed IN THE CODE THIS DECORATOR OBSERVES, at
    // comparative_cascade.ts:748-754, as having no literal counterpart anywhere in
    // RECOVERED_BP144.md or FounderCascadeWorkedByHand.txt. Repeated here, not re-derived -- this
    // table must not silently invent an attribution the code's own author already refused to
    // claim for it.
    attribution: 'TARE',
    codeLabel: 'STAGE 5b -- one option per question (this step\'s pause also carries the run\'s TERMINATOR notes -- see this file\'s header, "THE ONE GAP THIS DOES LEAVE")',
  },
];

/** Bishop suggestions, no authority, keyed by step -- the lettered sub-items from
 *  THE_FOUNDERS_PROCESS_ORDERED_BP151.md for the step each key maps to. Empty array where the
 *  process document gave no lettered suggestion for that exact framing. */
const SUGGESTIONS_BY_KEY: Record<string, string[]> = {
  stage0: [
    '1.a -- a failed vet must ABSTAIN, never proceed. On the qid-98 run the gate failed open, Arctic/Amazon/Sahara stayed in the pool, and the right answer then arrived for the wrong reason. (Built as D-BP151-013 FIX 1; awaiting your ruling on whether it should have been.)',
    '1.b -- scripts\\register_gate.mjs performs its own world_region / not_a_world_region verdicts, sits outside the audited directory, and is trusted wholesale. It has never been read. It decides step 1 and nobody knows what is in it.',
  ],
  q1: [
    '5.a -- the inverse must fire even when an answer is already in hand. Your own words on the removed early-exit: "I never said stop when sources agree... I didn\'t do it even in my by hand."',
  ],
  q2: [
    '7.a -- this is the redundancy you described at BP148: "one search engine asked seven differently-shaped questions." Same source, different framings. Multi-source belongs at escalation, as a check.',
  ],
  q3: ['7.a -- see Q2\'s note; this is the opposite-framing half of the same redundancy/QC check.'],
  q4: ['7.a -- see Q2\'s note; this is the ALL-options quality-control half.'],
  q5: ['7.a -- see Q2\'s note; this is the ALL-options quality-control, opposite-framing half.'],
  q6: [
    'This question\'s re-asking over the FULL option list (code: list(ALL), never the narrowed pool) also implements step 9 ("put back in what was just eliminated") -- disclosed here as a secondary effect, not claimed as its own separately attributed step.',
  ],
  q7: [
    'Same step-9 note as Q6 (list(ALL) re-inclusion). This is also the "invert it each time" half of rule 3 -- Q6 removed the half that is least, this removes the half that is MOST.',
  ],
  q8: [],
  q9: [],
  q10: [],
  stage5b: [
    'TARE, already disclosed at comparative_cascade.ts:748-754: this question\'s wording ("What is the numeric value or rate associated with X? Report the number and its unit.") has NO literal counterpart anywhere in RECOVERED_BP144.md or FounderCascadeWorkedByHand.txt. Surfaced for your ruling, not silently rewritten or left undisclosed.',
    '11.a -- the removed >=1.5x separation gate is gone (D-BP151-020); the current terminator (see the notes above, if TERMINATOR ran) fires on cross-framing convergence instead, per your own qid-98 words: "consistently across all questions."',
    '11.b -- a convergence branch requiring a strict majority, and a sole-survivor rule, both remain unattributed TAREs inside the terminator -- see this run\'s own TERMINATOR notes above for which one (if either) fired.',
  ],
  // D-BP151-026 -- the lettered sub-items THE_FOUNDERS_PROCESS_ORDERED_BP151.md already gives for
  // steps 2/3/4/6, copied verbatim (not invented here). Same "Bishop suggestion, no authority"
  // status as every other entry in this map.
  survey2: [
    '2.a -- the survey must enumerate every sense, never collapse to one. Your own run surfaced sewing, electronics and K-pop for "bias" before statistics was reached.',
    '2.b -- this is where the sources get captured (see step 11), because the survey is the first step that produces citable text.',
  ],
  survey3: [
    '3.a -- the live code clusters on a 2-shared-non-stopword-token threshold (definitional_cascade.ts:144). That number is not yours and does not do what you did.',
    '3.b -- your "G does not" is the odd-one-out signal doing real work. Recording why an option is unlike its neighbours may matter more than the grouping itself.',
  ],
  survey4: [
    '4.a -- the guess comes from the options\' own vocabulary ("sample", "too high on average", "represents"). The live field gate asks Google what field the term is in and never uses your route.',
    '4.b -- "a field name that contains the term is not a field -- it is a variety of the term" (your BP150 words) is the one rule in the live path that is fully yours and running.',
  ],
  survey6: [
    '6.a -- the live rule eliminates on one match against a generic word-list (comparative_cascade.ts:607, definitional_cascade.ts:242). That is not what you did. You removed what a source named with certainty; the code removes what a regex touches.',
  ],
};

// ─────────────────────────── D-BP151-026: SURVEY'S OWN STEP-DEF TABLE ───────────────────────────
//
// Source read in full before this table was written (same source COMPARATIVE_CASCADE_STEP_DEFS
// above was built from): BISHOP_DROPZONE\THE_FOUNDERS_PROCESS_ORDERED_BP151.md. Every
// founderWords string below is copied character for character from survey_stage.ts's OWN file
// header (lines 16-31 as filed at commit 37399af6), which itself copied them character for
// character from the process document -- no re-derivation, no paraphrase. Order matches
// runSurveyStage()'s own order exactly: step2, step3, step4, step6 (survey_stage.ts:469-472).
export const SURVEY_STEP_DEFS: LianaSteppedStepDef[] = [
  {
    key: 'survey2',
    attribution: 'ATTRIBUTED',
    founderStepNumber: 2,
    founderWords: 'If I look up the definition of bias in google, perfunctorily, I get this... That doesn\'t answer my question, it\'s just a fact to eblet for component factor foundation for reasoning. So keeping those definitions in mind, but not bound by them.',
    founderSource: 'Excerpt 7, BP141 -- THE_FOUNDERS_PROCESS_ORDERED_BP151.md, step 2',
    codeLabel: 'SURVEY STEP 2 -- define the term, perfunctorily, then keep looking',
  },
  {
    key: 'survey3',
    attribution: 'ATTRIBUTED',
    founderStepNumber: 3,
    founderWords: 'Well, first, I categorize the possible answers. I note that A, B, sorta C but more to that, D, E same as C... F, H is like C and E, I, and J all have to do with what answer it results in. G does not.',
    founderSource: 'Excerpt 7, BP141, rule 12 -- THE_FOUNDERS_PROCESS_ORDERED_BP151.md, step 3',
    codeLabel: 'SURVEY STEP 3 -- categorize the options by shared predicate, before eliminating anything',
  },
  {
    key: 'survey4',
    attribution: 'ATTRIBUTED',
    founderStepNumber: 4,
    founderWords: 'So I need to define what CONTEXT the question is being asked in. I would guess from \'sample\' being used in A, B, C, D, E, H, I questions... then it has to do with statistics. How do I know that? I don\'t, I\'m guessing. So I\'ll check:',
    founderSource: 'Excerpt 7, BP141, rule 13 -- THE_FOUNDERS_PROCESS_ORDERED_BP151.md, step 4',
    codeLabel: 'SURVEY STEP 4 -- determine the register: guess out loud, then check it',
  },
  {
    key: 'survey6',
    attribution: 'ATTRIBUTED',
    founderStepNumber: 6,
    founderWords: 'Note that we got rid of four answers with one google search - I like to call this the Jar Method... First we take out the Softballs, because we KNOW they are not the answer.',
    founderSource: 'Excerpt 2, BP141, rule 2 -- THE_FOUNDERS_PROCESS_ORDERED_BP151.md, step 6',
    codeLabel: 'SURVEY STEP 6 -- THE JAR METHOD: report what a source NAMED, never what a word list matched',
  },
];

/** Matches a RUNTIME `kind:'stage'` event's text (e.g. "-> Q6  stage 4 -- Cake Cut Half, remove
 *  the half that are least populated: A) ...") back to one of `stepDefs`' static keys, using only
 *  the fixed prefix the emitting code always produces (comparative_cascade.ts:199 "STAGE 0 ...",
 *  :644 "Q<n>  stage <n> -- ...", :756 "STAGE 5b ..."; survey_stage.ts's own "SURVEY STEP <n> --
 *  ..." stage lines). The dynamic suffix (category/property/option text) is deliberately NOT
 *  matched against -- only the prefix, which is static regardless of the question this run
 *  answers. Returns null for any stage text `stepDefs` does not recognize (a future stage, a
 *  different method) rather than guessing.
 *
 *  D-BP151-026: `stepDefs` is a NEW, additive parameter, defaulted to
 *  COMPARATIVE_CASCADE_STEP_DEFS -- every pre-existing single-argument call
 *  (`classifyStageText(text)`) resolves to the exact same table and the exact same behavior it
 *  always did; only a caller that explicitly passes SURVEY_STEP_DEFS gets the new SURVEY STEP
 *  branch. */
export function classifyStageText(
  text: string,
  stepDefs: LianaSteppedStepDef[] = COMPARATIVE_CASCADE_STEP_DEFS,
): string | null {
  const body = text.replace(/^->\s*/, '').trimStart();
  if (/^STAGE 0\b/.test(body)) return stepDefs.some((d) => d.key === 'stage0') ? 'stage0' : null;
  if (/^STAGE 5b\b/.test(body)) return stepDefs.some((d) => d.key === 'stage5b') ? 'stage5b' : null;
  const mq = /^Q(\d{1,2})\b/.exec(body);
  if (mq && stepDefs.some((d) => d.key === `q${mq[1]}`)) return `q${mq[1]}`;
  const ms = /^SURVEY STEP (\d{1,2})\b/.exec(body);
  if (ms && stepDefs.some((d) => d.key === `survey${ms[1]}`)) return `survey${ms[1]}`;
  return null;
}

function findStepDef(key: string, stepDefs: LianaSteppedStepDef[]): LianaSteppedStepDef | null {
  return stepDefs.find((d) => d.key === key) ?? null;
}

/** Resolves which static table applies to a methodId, per D-BP151-026 -- 'comparative-cascade'
 *  (unchanged) or the new 'survey' phase-id runSurveyStage() is wrapped under (NOT a registered
 *  LianaMethod id -- Survey is not in the method registry, see survey_ask.ts's own header on why
 *  a registry entry for Survey would be a loop; 'survey' here is only this decorator's own key for
 *  selecting a step-def table). Returns null for anything else -- unchanged out-of-scope
 *  behavior. */
function resolveStepDefsForMethodId(methodId: string): LianaSteppedStepDef[] | null {
  if (methodId === 'comparative-cascade') return COMPARATIVE_CASCADE_STEP_DEFS;
  if (methodId === 'survey') return SURVEY_STEP_DEFS;
  return null;
}

/** Builds the full ordered step list for the up-front display (requirement A). Static -- does
 *  not depend on any live run or any Google call, so it can be, and must be, shown before the
 *  first query goes out. Returns null for a method this ticket did not map (see this file's
 *  header) -- the caller must not invent a list for a method with no table rather than silently
 *  showing an empty or wrong one. D-BP151-026: now also resolves methodId === 'survey' to
 *  SURVEY_STEP_DEFS; 'comparative-cascade' is unaffected. */
export function buildUpfrontStepList(methodId: string): LianaSteppedStepDef[] | null {
  const stepDefs = resolveStepDefsForMethodId(methodId);
  return stepDefs ? stepDefs.slice() : null;
}

interface PendingFlush {
  key: string;
  events: LianaTerminalEvent[];
}

export interface SteppedAudibleWrap {
  ctx: MethodRunContext;
  /** MUST be called once, after `method.run()` has resolved (or thrown past this decorator),
   *  win either case -- flushes the LAST step's buffer, which has no following askGoogle call to
   *  trigger it through the normal path. See this file's header, "THE ONE GAP THIS DOES LEAVE".
   *  A no-op when stepped audible never armed (channel null or method out of scope). */
  finish: () => Promise<void>;
}

/**
 * Wraps a method's MethodRunContext so the operator is stopped once per Founder-mapped stage the
 * method emits, rather than once per Google call (that is audible.ts, unaffected by this file).
 *
 * Returns `{ ctx, finish }` where `ctx === ctx` (the SAME object passed in, by reference) and
 * `finish` is a true no-op whenever `channel` is null or `methodId` is not a phase this ticket
 * mapped -- see this file's header, requirement F.
 *
 * D-BP151-026: `methodId` now also accepts `'survey'` (runSurveyStage()'s own phase-id, see
 * resolveStepDefsForMethodId() above) in addition to `'comparative-cascade'`, unchanged. Every
 * other methodId still gets the same untouched no-op this function always returned for it.
 */
export function wrapForSteppedAudible(
  methodId: string,
  ctx: MethodRunContext,
  channel: SteppedAudibleChannel | null,
  log: SteppedAudibleLog,
): SteppedAudibleWrap {
  const stepDefs = resolveStepDefsForMethodId(methodId);
  if (!channel || !stepDefs) {
    return { ctx, finish: async () => { /* never armed for this run -- nothing to flush */ } };
  }

  let pauseSeq = 0;
  const nextPauseId = () => `sp${++pauseSeq}`;
  let currentKey: string | null = null;
  let currentBuffer: LianaTerminalEvent[] = [];
  let pending: PendingFlush | null = null;
  const totalSteps = stepDefs.length;

  const wrappedEmit: EmitFn = (event) => {
    // Always forward first -- this decorator only OBSERVES the emit stream to find step
    // boundaries; it must never suppress, delay, or reorder a line reaching the live transcript
    // the operator already watches (the same left-pane feed audible.ts's per-call pause reuses).
    ctx.emit(event);
    if (event.kind === 'stage') {
      const key = classifyStageText(event.text, stepDefs);
      if (key) {
        if (currentKey !== null) {
          pending = { key: currentKey, events: currentBuffer };
        }
        currentKey = key;
        currentBuffer = [event];
        return;
      }
      // An unrecognized 'stage' event (should not happen for a mapped phase -- see
      // classifyStageText's own doc comment) is buffered into whichever step is already open,
      // exactly like a 'note'/'fact' event, rather than silently mapped to a guess.
    }
    currentBuffer.push(event);
  };

  const runStepPause = async (flush: PendingFlush): Promise<void> => {
    const def = findStepDef(flush.key, stepDefs);
    if (!def) return; // cannot occur: classifyStageText only ever returns a key findStepDef resolves
    const pauseId = nextPauseId();
    const pause: LianaSteppedPause = {
      pauseId,
      stepIndex: stepDefs.findIndex((d) => d.key === flush.key) + 1,
      stepTotal: totalSteps,
      step: def,
      events: flush.events.slice(),
      suggestions: (SUGGESTIONS_BY_KEY[flush.key] ?? []).slice(),
      ts: nowIso(),
    };
    const response = await channel.requestStepPause(pause);
    const attribution: LianaSteppedAttribution = def.attribution;
    log.add({
      pauseId,
      stepIndex: pause.stepIndex,
      stepKey: flush.key,
      founderStepNumber: def.founderStepNumber,
      attribution,
      action: response.action,
      text: response.text,
      ts: nowIso(),
    });
    if (response.action === 'abandon') throw new SteppedAudibleAbandoned();
    // 'approve' / 'correct' / 'redirect' are recorded above and change NOTHING about this run --
    // requirement C.4/E: his response is the authority record for what gets built next, not a
    // live steering control. HARDWIRE-23: this build adds no decision rule.
  };

  const wrappedAskGoogle: AskGoogleFn = async (question) => {
    if (pending) {
      const flush = pending;
      pending = null;
      await runStepPause(flush);
    }
    return ctx.askGoogle(question);
  };

  const finish = async (): Promise<void> => {
    // Flushes the LAST step's buffer -- see this file's header, "THE ONE GAP THIS DOES LEAVE".
    if (currentKey !== null) {
      const flush: PendingFlush = { key: currentKey, events: currentBuffer };
      currentKey = null;
      currentBuffer = [];
      await runStepPause(flush);
    }
  };

  return { ctx: { askGoogle: wrappedAskGoogle, emit: wrappedEmit }, finish };
}

// ─────────────────────────── D-BP152-020/BISHOP/seg-pause-at-step-zero ───────────────────────────
//
// PAUSE AT STEP 0. Founder, FD-BP152-08, verbatim: "it loads the question first. Then it tells me
// what the next step WILL be." He must be able to stop AT Step 0 -- before any work happens -- and
// see the question and its options as state.
//
// THE OBSTACLE, AND WHY THIS IS A SEPARATE ENTRY POINT RATHER THAN A NEW ROW IN A STEP-DEF TABLE:
// every pause above fires from inside wrappedAskGoogle (see this file's header, "WHY EMIT IS ALSO
// WRAPPED, NOT ONLY askGoogle") because emit() is never awaited by its callers -- a Promise
// returned from a wrapped emit() would be silently dropped, and nothing would actually block.
// Step 0 issues NO Google call at all: liana_terminal_engine.ts states the question straight from
// parseQid()/parseFreeText(), before Survey, the Demand Test, or method selection ever run --
// there is no following askGoogle call anywhere near it for the buffer-then-flush mechanism above
// to hang a pause on. Registering 'step0' as an entry in COMPARATIVE_CASCADE_STEP_DEFS or
// SURVEY_STEP_DEFS and routing it through wrapForSteppedAudible()/classifyStageText() would not
// produce a pause AT Step 0 -- classifyStageText() only fires when a BUFFERED 'stage' event is
// followed by an askGoogle call, so the buffer opened at 'step0' would sit unflushed until
// whichever method's FIRST Google call finally triggers it, i.e. AFTER Survey, the Demand Test and
// method selection have already run. That is precisely the "tells me what the next step WILL be"
// (late) outcome FD-BP152-08 says is wrong, not a step boundary this file's existing mechanism can
// reach.
//
// THE FIX: requestStepZeroPause() is a direct, top-level `await` -- called by
// liana_terminal_engine.ts itself, in place, immediately after Step 0's own state lines are
// emitted and before anything else in the run happens (no Survey, no Demand Test, no askGoogle
// call precedes it there). This is not a value returned from a bare `emit()` call the way every
// other pause in this file is reached; it is an ordinary awaited async function call inside an
// already-async function, so it genuinely blocks. Reuses the SAME SteppedAudibleChannel /
// SteppedAudibleLog / LianaSteppedPause / LianaSteppedResponse / LianaSteppedRecord types and the
// SAME index.ts IPC convention ('liana-stepped-pause', PENDING_STEPPED_PAUSES keyed by pauseId,
// destroyed-sender rejection, no timeout) as every pause wrapForSteppedAudible() already produces
// -- NOTHING in index.ts, wrapForSteppedAudible(), classifyStageText(), or either step-def table
// was changed to build this. Not a fork of the shared mechanism; an additional, independent
// entry point into the same channel and the same log.
//
// NOT added to COMPARATIVE_CASCADE_STEP_DEFS or SURVEY_STEP_DEFS. Those tables classify a RUNTIME
// 'stage' event's TEXT back to a static key (classifyStageText()) for stages a METHOD emits
// mid-run, through the buffered path. STEP 0 precedes method selection entirely -- it is not a
// method stage, has no runtime 'stage' text a method emits, and does not need a place in either
// table.

/** The one step-def STEP 0's pause carries. Not part of either per-method table above -- see this
 *  section's header for why. ATTRIBUTED to FD-BP152-14 (RULINGS_BP152.md, BP152): "STEP 0: STATE
 *  THE QUESTION, FULLY. IT COMES BEFORE VETTING." founderStepNumber is 0, matching that ruling's
 *  own renumbering ("It is numbered STEP 0, not inserted as a new 1... Step 0 preserves the
 *  existing numbering exactly"). */
export const STEP_ZERO_STEP_DEF: LianaSteppedStepDef = {
  key: 'step0',
  attribution: 'ATTRIBUTED',
  founderStepNumber: 0,
  founderWords: 'Remember. the FIRST thing to do is to state the question, fully.',
  founderSource: 'FD-BP152-14, RULINGS_BP152.md (BP152) -- "STEP 0: STATE THE QUESTION, FULLY. IT COMES BEFORE VETTING."',
  codeLabel: 'STEP 0 -- STATE THE QUESTION, FULLY: question, options, options-exist flag, and source, before any query is issued',
};

// ─────────────────────────── D-BP152-021/BISHOP/seg-ask-google-this ───────────────────────────
//
// ASK GOOGLE THIS. Founder, FD-BP152-15, typed verbatim at a live Step 0 pause: "Send this query
// to Google and return the response: ...". Closed the open question of what a bench box may
// lawfully TYPE, under HARDWIRE-22: a PARAMETER to an existing primitive ("ask Google this"),
// never free prose construed into behavior. Ruled "go" -- this is the first executable Library
// Step (FD-BP152-15's own naming).
//
// `keep` (FD-BP152-07) is explicitly NOT built here. This action is ephemeral in EVERY sense that
// matters: the typed query is never written to resources/liana_survey_queries.json, never written
// to any method file, never written to the Library (which does not exist yet, D-BP152-018). It
// exists for exactly the run it was typed in, and is recorded in that run's own receipt (steppedLog
// + transcript below) so an ephemeral override still leaves a trace -- FD-BP152-07's own
// requirement: "An override that changes a run and leaves no trace makes the receipt a lie."

/** Plain string containment, per FD-BP152-15: "the receipt must record that the
 *  operator-authored query contained option strings, so a later reader can see that contamination
 *  was possible on that run." NEVER used to block or edit the query -- flag only. Returns the
 *  "LETTER) text" of every option whose full text appears verbatim inside `query`; `[]` when there
 *  is no options pool (a free-text question with no lettered options) or no match. */
function detectOptionContamination(query: string, options: Record<string, string> | null): string[] {
  if (!options) return [];
  const hits: string[] = [];
  for (const letterKey of Object.keys(options)) {
    const text = options[letterKey].trim();
    if (text && query.includes(text)) hits.push(`${letterKey}) ${text}`);
  }
  return hits;
}

/**
 * Pauses at Step 0, before any query is issued, presenting Step 0's own state -- the exact events
 * liana_terminal_engine.ts already emitted for it (SOURCE, QUESTION verbatim and complete,
 * OPTIONS EXIST, OPTIONS verbatim and complete or the honest no-options line). A true no-op
 * (returns immediately, resolves with no pause shown, nothing added to `log`, no call to
 * `askGoogle`) when `channel` is null -- the SAME OFF-stays-identical guarantee
 * wrapForSteppedAudible() and wrapAskGoogleWithAudible() already give, so a caller may call this
 * UNCONDITIONALLY (as liana_terminal_engine.ts does) without its own if-guard duplicating the one
 * already inside this function.
 *
 * D-BP152-021: NOW A LOOP, not a single pause. `approve` / `correct` / `redirect` / `abandon`
 * behave EXACTLY as before this ticket (requirement: "add alongside them; they must behave
 * exactly as today") -- `approve`/`correct`/`redirect` return (falling through to the rest of the
 * run, unchanged), `abandon` throws SteppedAudibleAbandoned, unchanged. The one new branch,
 * `ask_google` (FD-BP152-15): the operator's `response.text` is sent to Google VERBATIM (only
 * surrounding whitespace trimmed -- no templating, no prefix, no suffix, no reformatting, no
 * substitution) through `askGoogle`, the SAME channel every method already calls (via
 * `googleBlocks()`, comparative_cascade.ts -- no second transport, `resolveAmbiguityQueryTransport()`
 * untouched), the query and the raw, untruncated response are both emitted to the live transcript
 * (PARSER INSTRUMENT convention, `field_gate.ts`/`survey_stage.ts`'s own label/style, reused not
 * reinvented) so they land in the on-disk receipt the same way every other query/response in this
 * estate already does, and the pause fires AGAIN with the accumulated state (original Step 0 state
 * plus every ask_google exchange so far) so the operator can send another query or continue. This
 * is the whole reason it is a loop and not a second one-shot function: "Pause again after the
 * result... Do not auto-advance."
 *
 * `events` is the caller's own captured Step 0 event list, reused verbatim as the loop's starting
 * state -- this function does not re-derive, re-emit, or re-order anything that was already
 * emitted before it was called; it only packages what already happened (plus, now, what happens
 * during any `ask_google` round) into a pause and waits.
 *
 * `askGoogle`/`emit`/`options` are ADDITIVE parameters this ticket adds. Every one is used ONLY
 * inside the `ask_google` branch below (and `options` only for the contamination flag) -- on the
 * `channel === null` no-op path, and on every OFF-run that never types `ask_google`, none of the
 * three is ever touched, so behavior for every response type that existed before this ticket is
 * byte-identical to before it.
 *
 * Throws SteppedAudibleAbandoned on an 'abandon' response, exactly as before -- the caller's
 * existing catch block (liana_terminal_engine.ts, the same one every other SteppedAudibleAbandoned
 * already lands in) converts it into an honest abstain that keeps every note typed on the way to
 * it, including every ask_google exchange. MUST NOT resolve on its own -- see this file's header,
 * "NO TIMEOUT, EVER" -- channel.requestStepPause() itself carries that constraint; this function
 * adds no timer of its own, on any iteration of the loop.
 */
export async function requestStepZeroPause(
  channel: SteppedAudibleChannel | null,
  log: SteppedAudibleLog,
  events: LianaTerminalEvent[],
  askGoogle: AskGoogleFn,
  emit: EmitFn,
  options: Record<string, string> | null,
): Promise<void> {
  if (!channel) return;
  let stateEvents = events.slice();
  let round = 0;
  for (;;) {
    const pauseId = round === 0 ? 'sp0' : `sp0-google${round}`;
    const pause: LianaSteppedPause = {
      pauseId,
      stepIndex: 0,
      // The full step count is genuinely not known yet -- Step 0 precedes method selection
      // (liana_terminal_engine.ts runs Survey/the Demand Test/selectMethod() AFTER this point), so
      // no per-method step-def table (buildUpfrontStepList()) has been consulted. 0 states "not yet
      // known" honestly rather than fabricating a count before the method that would produce one has
      // even been chosen.
      stepTotal: 0,
      step: STEP_ZERO_STEP_DEF,
      events: stateEvents.slice(),
      suggestions: [],
      ts: nowIso(),
    };
    const response: LianaSteppedResponse = await channel.requestStepPause(pause);
    log.add({
      pauseId,
      stepIndex: 0,
      stepKey: STEP_ZERO_STEP_DEF.key,
      founderStepNumber: STEP_ZERO_STEP_DEF.founderStepNumber,
      attribution: STEP_ZERO_STEP_DEF.attribution,
      action: response.action,
      text: response.text,
      ts: nowIso(),
    });
    if (response.action === 'abandon') throw new SteppedAudibleAbandoned();
    if (response.action !== 'ask_google') {
      // 'approve' / 'correct' / 'redirect' -- recorded above and change NOTHING about this run,
      // UNCHANGED from before this ticket -- requirement C.4/E and HARDWIRE-23: his response is
      // the authority record for what gets built next, not a live steering control.
      return;
    }

    // D-BP152-021 -- FD-BP152-15: THE QUERY IS VERBATIM. Only whitespace at the very ends is
    // trimmed; nothing else touches it -- no templating, no prefix, no suffix, no substitution, no
    // reformatting. An operator-authored query is his to write and must never be blocked or
    // edited (FD-BP152-15) -- an empty typed box is the one case there is nothing to send, handled
    // honestly below without calling Google on an empty string.
    const query = (response.text ?? '').trim();
    round += 1;
    if (!query) {
      const emptyEvent: LianaTerminalEvent = {
        kind: 'note',
        text: '   ASK GOOGLE THIS: no query typed -- nothing sent, nothing to record.',
        ts: nowIso(),
      };
      emit(emptyEvent);
      stateEvents = [...stateEvents, emptyEvent];
      continue;
    }

    // FD-BP152-15's own guard, Bishop's, labeled as such: an operator-authored query deliberately
    // MAY carry the option list (his own worked example does) -- this never blocks or edits it.
    // Flag only, so a later reader of the receipt can see contamination was possible on this run
    // rather than discovering it by surprise.
    const contamination = detectOptionContamination(query, options);

    // PARSER INSTRUMENT convention -- same label/style field_gate.ts (D-BP151-006) and
    // survey_stage.ts's askAmbiguity()/askOperation() (D-BP152-004/007) already established for
    // "log the exact input before any parsing touches it". UNLIKE those two call sites, this one
    // carries NO length cap on either side (requirement 3: "No length cap. This is the whole
    // reason we can diagnose anything.") -- neither the query nor the response is ever truncated
    // here, at any length.
    const queryEvent: LianaTerminalEvent = {
      kind: 'note',
      text: `   PARSER INSTRUMENT [ask-google-this, OPERATOR OVERRIDE, FD-BP152-15] query SENT to Google (untruncated, verbatim)="${query}"`,
      ts: nowIso(),
    };
    emit(queryEvent);
    stateEvents = [...stateEvents, queryEvent];

    if (contamination.length) {
      const contamEvent: LianaTerminalEvent = {
        kind: 'note',
        text: `   CONTAMINATION FLAG (FD-BP152-15): the operator-authored query contains option string(s) verbatim: ${contamination.join('; ')} -- flagged, never blocked or edited; recorded so a later reader can see contamination was possible on this run.`,
        ts: nowIso(),
      };
      emit(contamEvent);
      stateEvents = [...stateEvents, contamEvent];
    }

    // THE EXISTING askGoogle CHANNEL, not a new one. googleBlocks() is the exact function every
    // method (comparative_cascade.ts's Q1-Q10) and Survey (survey_stage.ts's askAmbiguity()/
    // askOperation()) already send every query through -- requirement 2, "do not open a second
    // path to Google, do not add a transport, do not touch resolveAmbiguityQueryTransport()".
    const google = await googleBlocks(askGoogle, query);
    const responseEvent: LianaTerminalEvent = {
      kind: 'note',
      text: google.ok
        ? `   PARSER INSTRUMENT [ask-google-this, OPERATOR OVERRIDE, FD-BP152-15] RAW RESPONSE from Google (${google.via}) (untruncated, verbatim, no length cap)="${google.text}"`
        : `   PARSER INSTRUMENT [ask-google-this, OPERATOR OVERRIDE, FD-BP152-15] Google UNREACHABLE (${google.via}) -- an honest empty result, not a fabrication`,
      ts: nowIso(),
    };
    emit(responseEvent);
    stateEvents = [...stateEvents, responseEvent];

    // D-BP152-021 requirement 4: PAUSE AGAIN, presenting the response as state -- do not
    // auto-advance. Loops back to the top with `stateEvents` carrying the full accumulated
    // history (original Step 0 state plus every ask_google exchange so far), so the operator sees
    // everything, not only the newest exchange, at the next pause.
  }
}
