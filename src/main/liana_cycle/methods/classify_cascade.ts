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
// STAGE 2 -- the litmus-strip loop reuses this generator UNCHANGED. It already builds both his
// FD-BP152-03 question shapes (SCALE/DEFINITION and THRESHOLD) off a literal span of the question
// text; this file writes no second wording and no second gate on what may be asked.
import { generateScaleDefinitionQuestion, generateThresholdQuestion, literalSubjectSpan } from '../elements/method_question_generator';
import type { GeneratedMethodQuestion } from '../elements/method_question_generator';

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

// ─────────────────────────── STAGE 2: the litmus-strip loop ───────────────────────────
//
// D-BP152-035 STAGE 2/3. His words: "If more than one survives, add another litmus strip -- a
// NEW axis, never a reweighting of existing criteria." This section is what adds one.

/** THE CEILING. His own worked qid 98 example -- the four major population clusters, four climate
 *  exclusions (too dry / too wet / too cold / too high), then one scale-and-kind axis (world
 *  region vs biome) -- names SIX independent litmus strips before reaching a single survivor. A
 *  run that needs MORE axes than his own worked example used, before narrowing to one option,
 *  signals the criteria stack itself is underspecified for this question -- the honest move is to
 *  stop and report the surviving set (STAGE 3's abstain), not to keep inventing axes indefinitely.
 *  Named constant, not a magic number buried in a loop condition, so the cap and this reasoning
 *  are visible without reading the loop body. */
export const LITMUS_STRIP_CEILING = 6;

const NEGATION_RE = /\bNOT\b/i;

/** Structural NOT-detection -- the identical one-line mechanic `definitional_cascade.ts`'s own
 *  `run()` already uses inline to build its inverse question (`/\bNOT\b/i.test(input.question)`),
 *  not imported (it is not exported there either -- same reuse ceiling `comparative_cascade.ts`'s
 *  SEG_RETURN_034 read already documented for that exact transform) but the same mechanic,
 *  reimplemented here for CLASSIFY's own use. When true, the question demands the COMPLEMENT of
 *  whatever a criterion's own aspect literally names -- see sourceNextLitmusStrip() below for how
 *  this sets the new criterion's polarity. */
export function questionDemandsComplement(question: string): boolean {
  return NEGATION_RE.test(question);
}

/** Mechanical, structural candidate-term extraction -- no word list, no model call, three
 *  patterns read off the QUESTION'S OWN GRAMMAR (never the option text). Mirrors the shape
 *  `comparative_cascade.ts`'s own (non-exported, RANK-specific) `deriveCategoryAndProperty()`
 *  reads for RANK; not imported (that function is not exported and is RANK-shaped), reimplemented
 *  narrowly here for CLASSIFY. Every candidate is verified as a literal span of the question text
 *  via `literalSubjectSpan()` (elements/method_question_generator.ts, unchanged) before use -- a
 *  candidate that is not a literal span is dropped, never guessed into one (FD-BP152-03: "Both
 *  subjects are literal spans of the question text"). */
export function extractClassifyCandidateTerms(question: string): string[] {
  const patterns: RegExp[] = [
    // "the following X is/are" -- the category noun phrase itself (qid 98: "world regions").
    /following\s+([a-z][a-z\s]*?)\s+(?:is|are)\b/i,
    // "considered/classified as/qualify as (one of (the))? X" -- the categorical predicate.
    /(?:considered|classified as|categorized as|qualify as|qualifies as)\s+(?:one of\s+)?(?:the\s+)?([a-z][a-z0-9\s'-]{2,60}?)(?:[.?!]|$)/i,
    // "most/least ADJECTIVE" -- the superlative property phrase (qid 98: "most densely populated").
    /\b(?:most|least)\s+([a-z][a-z\s-]*?)(?:\s+(?:regions?|options?|choices?|items?|of\b)|[.?!]|$)/i,
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const re of patterns) {
    const m = re.exec(question);
    if (!m || !m[1]) continue;
    const term = m[1].trim();
    if (!term) continue;
    const span = literalSubjectSpan(term, question);
    if (!span) continue;
    const key = span.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(span);
  }
  return out;
}

/** Sources ONE new litmus strip's boundary/definition -- reuses method_question_generator.ts's
 *  own SCALE_DEFINITION/THRESHOLD wording UNCHANGED (no second query text invented here), prefers
 *  THRESHOLD (a numeric/definitional cutoff is the more directly testable aspect), falls back to
 *  SCALE_DEFINITION when THRESHOLD could not be generated for this term, and refuses (returns
 *  null, never a guess) when neither shape could be generated or the sourcing query returned
 *  nothing usable. `complement` (from questionDemandsComplement()) sets the new criterion's
 *  polarity -- this is the ONE judgment this loop makes about a freshly-sourced criterion, and it
 *  is a structural mapping (NOT-detected -> disqualifying), never a per-term guess. */
async function sourceNextLitmusStrip(
  candidateTerm: string,
  questionText: string,
  complement: boolean,
  ctx: MethodRunContext,
  index: number,
  note: (text: string) => void,
): Promise<ClassifyCriterion | null> {
  const thresholdQ = generateThresholdQuestion(candidateTerm, questionText);
  const scaleQ = generateScaleDefinitionQuestion(candidateTerm, questionText);
  const primary: GeneratedMethodQuestion | null =
    'questionText' in thresholdQ ? thresholdQ : ('questionText' in scaleQ ? scaleQ : null);
  if (!primary) {
    note(
      `   litmus strip ${index}: "${candidateTerm}" refused both shapes -- `
        + `${'why' in thresholdQ ? thresholdQ.why : ''} / ${'why' in scaleQ ? scaleQ.why : ''}`,
    );
    return null;
  }
  note(`   litmus strip ${index}: sourcing "${candidateTerm}" via ${primary.shape} (${primary.queryId})`);
  note(`      ${primary.questionText}`);
  const res = await googleBlocks(ctx.askGoogle, primary.questionText);
  if (!res.ok) {
    note(`   litmus strip ${index}: "${candidateTerm}" -- no usable answer, refusing to source a criterion from nothing`);
    return null;
  }
  const cited = res.text.length > 300 ? `${res.text.slice(0, 300)}...` : res.text;
  note(`   litmus strip ${index}: sourced -- ${cited}`);
  return {
    id: `litmus-${index}`,
    description: `meets "${candidateTerm}" per the sourced ${primary.shape === 'THRESHOLD' ? 'threshold' : 'scale/definition'}`,
    polarity: complement ? 'disqualifying' : 'qualifying',
    aspect: `${candidateTerm}, per this sourced answer: "${cited}"`,
    source: `${primary.questionText} -- Google [${res.via}]`,
  };
}

export interface LitmusStripLoopResult {
  survivors: string[];
  criteria: ClassifyCriterion[];
  eliminations: EliminationRecord[];
  unknowns: UnknownRecord[];
  stoppedReason: 'definitive' | 'zero-survivors' | 'ceiling' | 'terms-exhausted';
}

/** THE LOOP. Applies `seedCriteria` first (Stage 1's typed-parameter entry point, still lawful,
 *  still usable directly per FD-BP152-15), then -- while more than one option survives -- sources
 *  and applies ONE MORE litmus strip at a time, up to LITMUS_STRIP_CEILING, each one a NEW axis (a
 *  freshly extracted candidate term never used by an earlier strip in this run), never a
 *  reweighting of a criterion already on the stack. Stops the instant the pool narrows to 0 or 1,
 *  or the ceiling is reached, or there are no more candidate terms to source a strip from --
 *  whichever comes first -- and reports exactly which via `stoppedReason`, never silently. */
export async function runLitmusStripLoop(
  input: MethodQuestionInput,
  ctx: MethodRunContext,
  seedCriteria: ClassifyCriterion[],
  note: (text: string) => void,
): Promise<LitmusStripLoopResult> {
  const OPT = input.options as Record<string, string>;
  const ALL = Object.keys(OPT);
  const complement = questionDemandsComplement(input.question);
  note(`   question ${complement ? 'DEMANDS THE COMPLEMENT (NOT detected)' : 'demands direct membership (no NOT detected)'}`);

  const allCriteria: ClassifyCriterion[] = [...seedCriteria];
  const seedRound = await applyOccamElimination(ALL, OPT, seedCriteria, ctx, note);
  let survivors = seedRound.survivors;
  let eliminations = seedRound.eliminations;
  let unknowns = seedRound.unknowns;

  if (!survivors.length) {
    return { survivors, criteria: allCriteria, eliminations, unknowns, stoppedReason: 'zero-survivors' };
  }
  if (survivors.length === 1) {
    return { survivors, criteria: allCriteria, eliminations, unknowns, stoppedReason: 'definitive' };
  }

  const usedAspects = new Set(seedCriteria.map((c) => c.aspect.toLowerCase()));
  const candidateTerms = extractClassifyCandidateTerms(input.question).filter(
    (t) => ![...usedAspects].some((a) => a.startsWith(t.toLowerCase())),
  );
  let termIndex = 0;
  let stripsAdded = 0;

  while (survivors.length > 1) {
    if (stripsAdded >= LITMUS_STRIP_CEILING) {
      return { survivors, criteria: allCriteria, eliminations, unknowns, stoppedReason: 'ceiling' };
    }
    if (termIndex >= candidateTerms.length) {
      return { survivors, criteria: allCriteria, eliminations, unknowns, stoppedReason: 'terms-exhausted' };
    }
    const term = candidateTerms[termIndex];
    termIndex++;
    // eslint-disable-next-line no-await-in-loop -- each strip's query depends on the PRIOR strip's
    // narrowed survivor pool; strips are sourced one at a time by design (each is a NEW axis
    // evaluated against the current state), not fired in parallel.
    const criterion = await sourceNextLitmusStrip(term, input.question, complement, ctx, allCriteria.length + 1, note);
    if (!criterion) continue; // refused this term -- try the next one; does not count against the ceiling
    stripsAdded++;
    allCriteria.push(criterion);
    // eslint-disable-next-line no-await-in-loop -- see above
    const round = await applyOccamElimination(survivors, OPT, [criterion], ctx, note);
    survivors = round.survivors;
    eliminations = eliminations.concat(round.eliminations);
    unknowns = unknowns.concat(round.unknowns);
    note(`   after litmus strip "${criterion.id}": pool -> ${survivors.length} (${survivors.join(', ') || 'none'})`);
  }

  return {
    survivors,
    criteria: allCriteria,
    eliminations,
    unknowns,
    stoppedReason: survivors.length === 0 ? 'zero-survivors' : 'definitive',
  };
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

// ─────────────────────────── run (STAGE 2: seed criteria + the litmus-strip loop) ───────────────────────────

/** STAGE 2 ORCHESTRATOR, exported for direct testing the same way Stage 1's entry point is.
 *  Wraps runLitmusStripLoop() with the same transcript/emit conventions every other method in
 *  this registry uses. STILL ABSTAINS UNCONDITIONALLY -- STAGE 3 is what turns a definitive
 *  single survivor into a published verdict with its Banyan Metric score; until it lands, this
 *  stage reports the loop's own outcome (survivors + why it stopped) honestly, never publishes a
 *  verdict on its own authority. */
export async function runClassifyCascade(
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

  step(`STAGE 1+2  Occam elimination + litmus-strip loop (ceiling ${LITMUS_STRIP_CEILING}) -- ${seedCriteria.length} seed criterion/criteria`);
  const loop = await runLitmusStripLoop(input, ctx, seedCriteria, note);
  note(
    `   loop stopped: ${loop.stoppedReason}   criteria applied: ${loop.criteria.length}   `
      + `eliminations: ${loop.eliminations.length}   unknowns: ${loop.unknowns.length}   survivors: ${loop.survivors.join(', ') || '(none)'}`,
  );

  const elapsedS = ((Date.now() - t0) / 1000).toFixed(1);
  const basisParts = [
    `STAGE 1+2 (Occam elimination + litmus-strip loop -- STAGE 3's Banyan-Metric publish/abstain `
      + `rule is not yet wired into this entry point) applied ${loop.criteria.length} criterion/criteria, `
      + `loop stopped: ${loop.stoppedReason}`,
    `eliminations: ${loop.eliminations.map((e) => `${e.option} broke "${e.criterionId}"`).join('; ') || 'none'}`,
    `survivors: ${loop.survivors.join(', ') || '(none)'}`,
  ];
  emit({
    kind: 'result',
    text: `STAGE 1+2 ONLY -- stopped:${loop.stoppedReason}  survivors: ${loop.survivors.join(',') || '(none)'}${KEY != null ? `  key=${KEY}` : ''}`,
    ts: nowIso(),
  });
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
  // Registered entry point, general case: no seed criteria hardcoded for any specific question --
  // the litmus-strip loop (STAGE 2) sources every criterion automatically from the question's own
  // structurally-extracted candidate terms. STAGE 3 adds the Banyan-Metric publish/abstain rule;
  // until it lands, this always abstains, reporting the loop's own survivor set honestly.
  return runClassifyCascade(input, ctx, []);
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
