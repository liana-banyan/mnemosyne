// classify_cascade.ts -- D-BP152-035/BISHOP/seg-classify-method, STAGE 1/3
//
// METHOD 3 of the Liana Cycle method registry: THE CLASSIFY CASCADE. Shape: the question sorts
// options into named categories (or a category and its complement), and the answer is which
// bucket an option belongs to -- never a rank, never a definition. Taught by the Founder's
// membership terminator ruling
//   C:\Users\Administrator\Documents\LianaBanyanPlatform\BISHOP_DROPZONE\RULINGS_BP152.md
//   FD-BP152-19, and by qid 98 itself, ruled CLASSIFY at FD-BP152-06 ("qid 98 is classify").
//
// THIS IS A BUILD, NOT AN EXTRACTION. SEG_RETURN_BP152_034_CLASSIFY_SEPARATION.md measured
// comparative_cascade.ts's 19 steps as CLASSIFY-only = 0 of 19, and found no membership
// terminator anywhere in that file. Nothing is extracted from comparative_cascade.ts here beyond
// the same already-exported, already-shared helpers definitional_cascade.ts itself established
// as reusable (googleBlocks, gemmaExtract, appearsIn) -- see that file's own "SHARED PREFIX"
// header for the precedent. comparative_cascade.ts and definitional_cascade.ts are not modified
// by this file; their behavior is unchanged (verify by diff, per this ticket's own instruction).
//
// THE TERMINATOR, HIS WORDS, VERBATIM (FD-BP152-19):
//   "For the tiebreaker issue, we use sig figs. It's Occams razor on the little league stack --
//   once we break a rule, it no longer is a possibility, and it's unlikely but not impossible
//   that two balls will fit the bill of all the rules of little league -- but then we need to
//   introduce other factors, like where it is played, and what is commonly available in that
//   area that it is played in, and does it exist in places that could get both balls, but South
//   Korea doesn't have little league, so elliminated. We just need more litmus strips if that
//   occurs, and a SOME POINT, the word building becomes definitive to fit more of the
//   definitions that it must fit to be the answer, than factory or barracks does. Definitive."
//
// And, ruling on the pasted resolution-tree design: "Don't do rule 2. And rule 3 agreed as
// unmeasured, not bad, and rule 4 yes must come from a source only -- not the humidity thing."
//
// And, on the floor and its reasoning: "Low is definitive, specifically BECAUSE it also comes
// with a Banyan Metric Score -- which means it's like wikipedia does for their pages. one
// source, they let it exist, but they tell you it might be wrong. We tell you for example: Rover
// is a Dog. Rover is Brown. Therefore, all dogs are brown. Logical, but not enough info. So
// definitive? Only if you don't ask any more questions." -- Stage 3 of this file implements the
// Banyan-Metric half of the terminator; this stage (1) implements the Occam-elimination half.
//
// THE TERMINATOR, NOW COMPLETE (his own synthesis, FD-BP152-19's closing block): "Apply criteria
// as hard pass/fail; break one and the option is eliminated (Occam). If more than one survives,
// add another litmus strip -- a new axis, not a reweighting. Score the answer on the Banyan
// Metric Standard axis and publish it with its score, down to LOW. INSUFFICIENT alone abstains,
// reporting the surviving set."
//
// NO TIE-BREAKERS. EVER. He rejected, by name: lexicographic forcing, an ID/timestamp tie-break,
// and "Rule 2" (relaxing the lowest-priority constraint when nothing survives). This file
// implements none of them. applyOccamElimination() below never picks among survivors -- when
// more than one option remains after every criterion applied so far, the caller (Stage 2, the
// litmus-strip loop, and Stage 3, the final abstain) either adds another axis or reports the
// survivor set honestly. Nothing in this file forces a single winner out of a tied field.
//
// UNKNOWN IS UNMEASURED, NEVER BAD. His correction to the pasted resolution-tree design's Rule 3.
// A criterion that cannot be verified for a given option (no extractable, source-verified
// evidence either way) leaves that option IN the pool -- see applyOccamElimination() below,
// which only ever removes an option on a VERIFIED 'fail', never on 'unknown'. This is the exact
// defect his own naive-eliminator canon warns about: discarding the correct key in 61 of 497
// questions (12.3%) by treating missing data as disqualifying.
//
// BOUNDARY NUMBERS COME FROM A SOURCE, NEVER HARDCODED. His Rule 4, corrected: "yes must come
// from a source only -- not the humidity thing" (a hardcoded numeric threshold Bishop proposed
// and he rejected by name). No criterion in this file states its own pass/fail boundary in code.
// Every criterion's verdict is read out of Google's own answer to a question this file sent
// about THAT SPECIFIC criterion for THAT SPECIFIC option (evaluateCriterionForOption() below) --
// the query text and the returned passage ARE the source, and both are cited in full in every
// EliminationRecord this file produces.
//
// EVERY ELIMINATION IS RECORDED WITH ITS CRITERION AND SOURCE, so a reader can audit and
// overrule it without re-running the method. See EliminationRecord and applyOccamElimination().
//
// NO MODEL CALL THAT JUDGES (HARDWIRE-22). gemmaExtract() here, as everywhere else in this
// estate, extracts and verifies only -- it copies out a verbatim sentence and a plain yes/no/
// unclear reading of what that sentence states; the code alone (evaluateCriterionForOption()'s
// own if/else, not a second model call) decides pass/fail/unknown from the extracted, verified
// text. Google is external evidence, not a judge; Gemma extracts, never chooses.

import { avgOptionWordCount, registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput, MethodRunContext, ShapeTestResult } from '../method_registry';
import type { LianaTerminalOutcome } from '../../../shared/liana_cycle/liana_terminal_types';
import { appearsIn, gemmaExtract, googleBlocks } from './comparative_cascade';

function nowIso(): string {
  return new Date().toISOString();
}

// ─────────────────────────── the criteria stack ───────────────────────────

/** How a criterion's sourced yes/no reading maps onto pass/fail for a given option.
 *
 *  'qualifying'    -- the aspect IS the target class's own defining property. Google "yes" ->
 *                      pass (the option belongs). Google "no" -> fail (it does not).
 *  'disqualifying' -- the aspect is a property that EXCLUDES an option from the target class
 *                      (used, structurally, for a NOT-framed question -- see extractNegation()
 *                      in Stage 2/3 below). Google "yes" -> fail. Google "no" -> pass.
 *
 *  Both polarities are hard pass/fail (Occam), never a score, never a weight. */
export type CriterionPolarity = 'qualifying' | 'disqualifying';

export type CriterionVerdict = 'pass' | 'fail' | 'unknown';

/** A single litmus strip. `aspect` is the literal property asked about, spliced verbatim into
 *  the per-option query evaluateCriterionForOption() sends -- never a word list, never a
 *  hand-tuned regex over the option text. `source` names where the criterion's OWN wording came
 *  from (a citation, a prior query's returned passage, or an operator-typed parameter per
 *  FD-BP152-15) -- it is NOT the per-option evidence (that lives in CriterionCheckResult /
 *  EliminationRecord, one per option, because the SAME criterion can be sourced once and then
 *  applied against many options). */
export interface ClassifyCriterion {
  id: string;
  description: string;
  polarity: CriterionPolarity;
  aspect: string;
  source: string;
}

export interface CriterionCheckResult {
  option: string;
  verdict: CriterionVerdict;
  /** The verbatim, passage-verified sentence supporting the verdict. Empty when verdict is
   *  'unknown' -- there is nothing to cite for a criterion that could not be evaluated. */
  evidence: string;
  /** The exact query sent for THIS option's check -- the per-option half of the criterion's
   *  provenance (the criterion's own `source` is the other half). */
  query: string;
}

/** One row of the audit trail this method exists to produce. Every elimination is recoverable
 *  from this record alone: which option, which criterion (by id and plain-English description),
 *  which source (the criterion's own citation plus the exact query sent for this option), and
 *  the verbatim evidence a reader can check against the query themselves. */
export interface EliminationRecord {
  option: string;
  criterionId: string;
  criterionDescription: string;
  source: string;
  query: string;
  evidence: string;
}

/** An option that survived a criterion only because that criterion could not be verified for it
 *  -- recorded so the transcript is honest about what was NOT measured, per his Rule 3
 *  correction. Never causes an elimination; see applyOccamElimination() below. */
export interface UnknownRecord {
  option: string;
  criterionId: string;
  criterionDescription: string;
  query: string;
}

/** Sends ONE sourced query about ONE option against ONE criterion, extracts a verbatim
 *  supporting sentence (never a summary, never a paraphrase), verifies that sentence actually
 *  appears in the returned passage, and only THEN maps the extracted yes/no reading through the
 *  criterion's own polarity to pass/fail. Any failure to get a verified sentence -- no answer,
 *  extraction failure, an unverifiable "sentence", or an extraction that itself says "unclear"
 *  -- returns 'unknown', never 'fail'. This is the single choke point where "boundary from a
 *  source, never hardcoded" (Rule 4) and "unknown never eliminates" (Rule 3, corrected) both
 *  live in code. */
export async function evaluateCriterionForOption(
  criterion: ClassifyCriterion,
  option: string,
  optionText: string,
  ctx: MethodRunContext,
): Promise<CriterionCheckResult> {
  const query = `Is ${optionText} ${criterion.aspect}? Answer plainly (yes or no) and cite evidence.`;
  const res = await googleBlocks(ctx.askGoogle, query);
  if (!res.ok) {
    return { option, verdict: 'unknown', evidence: '', query };
  }
  const ex = await gemmaExtract(
    `Does the passage assert that "${optionText}" ${criterion.aspect}, or that it does NOT? Copy out `
      + 'the verbatim sentence that supports your reading, word for word from the passage. If the '
      + 'passage does not address this at all, say "unclear" and leave the sentence empty.',
    res.text,
    '{"reading":"yes|no|unclear","sentence":"the verbatim sentence, or empty"}',
  );
  const reading = String((ex?.reading as string | undefined) || 'unclear').toLowerCase();
  const sentence = String((ex?.sentence as string | undefined) || '');
  if (!sentence || !appearsIn(res.text, sentence)) {
    // No verified sentence to cite -- refusing to trust an extraction that cannot be checked
    // against its own source, even if `reading` came back yes/no. Unverified is unknown, not fail.
    return { option, verdict: 'unknown', evidence: '', query };
  }
  const sourceSaysYes = reading === 'yes';
  const sourceSaysNo = reading === 'no';
  if (!sourceSaysYes && !sourceSaysNo) {
    return { option, verdict: 'unknown', evidence: sentence, query };
  }
  const pass = criterion.polarity === 'qualifying' ? sourceSaysYes : sourceSaysNo;
  return { option, verdict: pass ? 'pass' : 'fail', evidence: sentence, query };
}

export interface OccamEliminationResult {
  survivors: string[];
  eliminations: EliminationRecord[];
  unknowns: UnknownRecord[];
}

/** THE TERMINATOR'S FIRST HALF: Occam elimination. Applies criteria to the pool IN ORDER, one at
 *  a time; a 'fail' removes the option from the pool for every criterion after it (once
 *  eliminated, an option is not re-tested -- there is nothing left to eliminate it FROM). A
 *  'pass' or 'unknown' keeps the option in. No scoring, no partial credit, no weighting -- every
 *  criterion is a hard gate, per his own words: "once we break a rule, it no longer is a
 *  possibility." Returns the full audit trail (eliminations AND unknowns), never just the
 *  survivor count, so a reader can see exactly why the pool is what it is. */
export async function applyOccamElimination(
  pool: string[],
  OPT: Record<string, string>,
  criteria: ClassifyCriterion[],
  ctx: MethodRunContext,
  note: (text: string) => void,
): Promise<OccamEliminationResult> {
  let survivors = [...pool];
  const eliminations: EliminationRecord[] = [];
  const unknowns: UnknownRecord[] = [];
  for (const criterion of criteria) {
    if (!survivors.length) break; // requirement 2: never relax a criterion to revive a pool -- if
    // the pool is already empty, later criteria have nothing left to test and are skipped, not
    // used to somehow "un-eliminate" anything.
    const stillIn: string[] = [];
    for (const option of survivors) {
      const result = await evaluateCriterionForOption(criterion, option, OPT[option], ctx);
      if (result.verdict === 'fail') {
        eliminations.push({
          option,
          criterionId: criterion.id,
          criterionDescription: criterion.description,
          source: criterion.source,
          query: result.query,
          evidence: result.evidence,
        });
        note(
          `   ELIMINATED ${option} -- broke criterion "${criterion.id}" (${criterion.description}) `
            + `[source: ${criterion.source}] evidence: "${result.evidence}"`,
        );
      } else if (result.verdict === 'unknown') {
        unknowns.push({ option, criterionId: criterion.id, criterionDescription: criterion.description, query: result.query });
        note(`   UNKNOWN ${option} on criterion "${criterion.id}" -- not eliminated (unknown is unmeasured, never bad)`);
        stillIn.push(option);
      } else {
        note(`   PASS ${option} on criterion "${criterion.id}" -- evidence: "${result.evidence}"`);
        stillIn.push(option);
      }
    }
    survivors = stillIn;
  }
  return { survivors, eliminations, unknowns };
}

// ─────────────────────────── shapeTest ───────────────────────────

/** Demand PRECEDES shape (method_registry.ts's own R-6 comment: "demand is checked first because
 *  it is the cheaper and more decisive of the two"). selectMethod() already restricts this method
 *  to CLASSIFY-demand questions before shapeTest() ever runs, so this method's own shape gate
 *  imposes no CLASSIFY-cue regex of its own -- that table already lives in demand_test.ts and
 *  duplicating it here would be exactly the two-classifiers-for-one-decision problem
 *  demand_test.ts's own header warns against (checkKind(), NOT a second classifier). The only
 *  thing shape must confirm is the structural minimum every option-eliminating method needs: an
 *  actual option pool to eliminate among. */
function shapeTest(input: MethodQuestionInput): ShapeTestResult {
  if (!input.options || Object.keys(input.options).length < 2) {
    return { matches: false, reason: 'no option pool to classify -- this method assigns options to categories, it needs at least two' };
  }
  const n = Object.keys(input.options).length;
  return {
    matches: true,
    reason: `${n} option(s) available to classify; avg ${avgOptionWordCount(input.options).toFixed(1)} words/option -- `
      + 'demand gate (canon R-4/R-6) already restricts this method to CLASSIFY-demand questions, so shape imposes no further test',
  };
}

// ─────────────────────────── run (STAGE 1: single-pass elimination only) ───────────────────────────

/** STAGE 1 ENTRY POINT, exported so this ticket's own Stage 1 verification can exercise the
 *  elimination engine end to end with an explicit, typed criteria stack -- a lawful operator
 *  parameter per FD-BP152-15 ("typed text supplies a PARAMETER to a primitive... code sends it,
 *  code returns the passage, nothing construes what he meant"), not a free-form instruction the
 *  machine interprets. The registered `run()` below calls this with an EMPTY seed, because the
 *  registry method must answer future CLASSIFY questions it has never seen (same charter
 *  comparative_cascade.ts's own header states for RANK: "this file contains NO TEMPLATE... must
 *  answer future comparative questions this session has never seen") -- hardcoding qid 98's own
 *  criteria into the general path would be exactly the over-fit that charter forbids. Stage 2
 *  (the litmus-strip loop) is what supplies criteria automatically for the general case; until it
 *  lands, an empty seed and zero survivors-narrowed means this stage honestly reports "more than
 *  one survives, no further criteria on the stack yet" rather than fabricating a verdict. */
export async function runClassifyCascadeWithSeedCriteria(
  input: MethodQuestionInput,
  ctx: MethodRunContext,
  seedCriteria: ClassifyCriterion[],
): Promise<LianaTerminalOutcome> {
  const { emit } = ctx;
  const OPT = input.options as Record<string, string>;
  const ALL = Object.keys(OPT);
  const KEY = input.correctAnswer;
  const t0 = Date.now();

  const say = (text: string) => emit({ kind: 'header', text, ts: nowIso() });
  const step = (text: string) => emit({ kind: 'stage', text: `-> ${text}`, ts: nowIso() });
  const note = (text: string) => emit({ kind: 'note', text, ts: nowIso() });

  say(`METHOD classify-cascade -- ${input.qid != null ? `qid ${input.qid}` : 'free-text'}`);
  note(`   ${input.question}`);
  note(`   ${ALL.map((L) => `${L}) ${OPT[L]}`).join('  ')}`);

  step(`STAGE 1  Occam elimination -- ${seedCriteria.length} criterion/criteria on the stack`);
  const pool = [...ALL];
  const { survivors, eliminations, unknowns } = await applyOccamElimination(pool, OPT, seedCriteria, ctx, note);
  note(`   pool ${pool.length} -> ${survivors.length}   (${eliminations.length} elimination(s), ${unknowns.length} unknown reading(s))`);

  const elapsedS = ((Date.now() - t0) / 1000).toFixed(1);
  const basisParts = [
    `STAGE 1 (Occam elimination only -- STAGE 2's litmus-strip loop and STAGE 3's Banyan-Metric `
      + 'publish/abstain rule are not yet wired into this entry point) applied '
      + `${seedCriteria.length} criterion/criteria: ${eliminations.length} elimination(s) `
      + `(${eliminations.map((e) => `${e.option} broke "${e.criterionId}"`).join('; ') || 'none'}), `
      + `${unknowns.length} unknown reading(s)`,
    `survivors: ${survivors.join(', ') || '(none)'}`,
  ];
  emit({ kind: 'result', text: `STAGE 1 ONLY -- survivors: ${survivors.join(',') || '(none)'}${KEY != null ? `  key=${KEY}` : ''}`, ts: nowIso() });
  note(`   ${elapsedS}s`);

  return {
    qid: input.qid,
    question: input.question,
    verdict: null,
    correct: KEY,
    abstain: true,
    freeText: input.qid == null,
    basis: basisParts.join('; '),
  };
}

async function run(input: MethodQuestionInput, ctx: MethodRunContext): Promise<LianaTerminalOutcome> {
  // Registered entry point, general case: no seed criteria hardcoded for any specific question.
  // STAGE 2 replaces this empty array with automatically-generated litmus strips (reusing
  // elements/method_question_generator.ts) and a ceiling; until that lands, this stage always
  // reports the full, unnarrowed pool as survivors -- an honest "nothing has been tested yet",
  // never a fabricated verdict.
  return runClassifyCascadeWithSeedCriteria(input, ctx, []);
}

export const classifyCascadeMethod: LianaMethod = {
  id: 'classify-cascade',
  name: 'The Classify Cascade',
  demand: 'CLASSIFY',
  taughtBy: 'the Founder\'s membership terminator ruling, RULINGS_BP152.md FD-BP152-19 (Occam elimination, litmus '
    + 'strips, Banyan-Metric publish-with-score) -- qid 98 ruled CLASSIFY at FD-BP152-06 ("qid 98 is classify"); '
    + 'SEG_RETURN_BP152_034_CLASSIFY_SEPARATION.md measured comparative_cascade.ts as CLASSIFY-only = 0 of 19 '
    + 'steps and no membership terminator anywhere in that file, so this is a BUILD, not an extraction',
  shapeDescription: 'the question sorts options into a named category and its complement, and the answer is which side an option falls on',
  shapeTest,
  run,
};

registerMethod(classifyCascadeMethod);
