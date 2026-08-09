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
};

/** Matches a RUNTIME `kind:'stage'` event's text (e.g. "-> Q6  stage 4 -- Cake Cut Half, remove
 *  the half that are least populated: A) ...") back to one of this table's static keys, using
 *  only the fixed prefix comparative_cascade.ts's own step()/say() calls always produce
 *  (comparative_cascade.ts:199 "STAGE 0 ...", :644 "Q<n>  stage <n> -- ...", :756 "STAGE 5b
 *  ..."). The dynamic suffix (category/property/option text) is deliberately NOT matched against
 *  -- only the prefix, which is static regardless of the question this run answers. Returns null
 *  for any stage text this table does not recognize (a future stage, a different method) rather
 *  than guessing. */
export function classifyStageText(text: string): string | null {
  const body = text.replace(/^->\s*/, '').trimStart();
  if (/^STAGE 0\b/.test(body)) return 'stage0';
  if (/^STAGE 5b\b/.test(body)) return 'stage5b';
  const m = /^Q(\d{1,2})\b/.exec(body);
  if (m && COMPARATIVE_CASCADE_STEP_DEFS.some((d) => d.key === `q${m[1]}`)) return `q${m[1]}`;
  return null;
}

function findStepDef(key: string): LianaSteppedStepDef | null {
  return COMPARATIVE_CASCADE_STEP_DEFS.find((d) => d.key === key) ?? null;
}

/** Builds the full ordered step list for the up-front display (requirement A). Static -- does
 *  not depend on any live run or any Google call, so it can be, and must be, shown before the
 *  first query goes out. Returns null for a method this ticket did not map (see this file's
 *  header) -- the caller must not invent a list for a method with no table rather than silently
 *  showing an empty or wrong one. */
export function buildUpfrontStepList(methodId: string): LianaSteppedStepDef[] | null {
  if (methodId !== 'comparative-cascade') return null;
  return COMPARATIVE_CASCADE_STEP_DEFS.slice();
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
 * `finish` is a true no-op whenever `channel` is null or `methodId` is not a method this ticket
 * mapped -- see this file's header, requirement F.
 */
export function wrapForSteppedAudible(
  methodId: string,
  ctx: MethodRunContext,
  channel: SteppedAudibleChannel | null,
  log: SteppedAudibleLog,
): SteppedAudibleWrap {
  if (!channel || methodId !== 'comparative-cascade') {
    return { ctx, finish: async () => { /* never armed for this run -- nothing to flush */ } };
  }

  let pauseSeq = 0;
  const nextPauseId = () => `sp${++pauseSeq}`;
  let currentKey: string | null = null;
  let currentBuffer: LianaTerminalEvent[] = [];
  let pending: PendingFlush | null = null;
  const totalSteps = COMPARATIVE_CASCADE_STEP_DEFS.length;

  const wrappedEmit: EmitFn = (event) => {
    // Always forward first -- this decorator only OBSERVES the emit stream to find step
    // boundaries; it must never suppress, delay, or reorder a line reaching the live transcript
    // the operator already watches (the same left-pane feed audible.ts's per-call pause reuses).
    ctx.emit(event);
    if (event.kind === 'stage') {
      const key = classifyStageText(event.text);
      if (key) {
        if (currentKey !== null) {
          pending = { key: currentKey, events: currentBuffer };
        }
        currentKey = key;
        currentBuffer = [event];
        return;
      }
      // An unrecognized 'stage' event (should not happen for comparative-cascade -- see
      // classifyStageText's own doc comment) is buffered into whichever step is already open,
      // exactly like a 'note'/'fact' event, rather than silently mapped to a guess.
    }
    currentBuffer.push(event);
  };

  const runStepPause = async (flush: PendingFlush): Promise<void> => {
    const def = findStepDef(flush.key);
    if (!def) return; // cannot occur: classifyStageText only ever returns a key findStepDef resolves
    const pauseId = nextPauseId();
    const pause: LianaSteppedPause = {
      pauseId,
      stepIndex: COMPARATIVE_CASCADE_STEP_DEFS.findIndex((d) => d.key === flush.key) + 1,
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
