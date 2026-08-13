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
import type {
  LianaMethod, MethodQuestionInput, MethodRunContext, OwnedPassage, ShapeTestResult,
} from '../method_registry';
import type { LianaTerminalOutcome } from '../../../shared/liana_cycle/liana_terminal_types';
import {
  appearsIn, evaluateComparativeTerminator, gemmaExtract, googleBlocks, list, norm, toLetters, toPerSqKm,
} from './comparative_cascade';
// D-BP152-038, ADDITIVE: the superlative-by-magnitude route (far below) imports ONLY these
// already-exported primitives from comparative_cascade.ts -- evaluateComparativeTerminator() (the
// ruled terminator, reused unchanged) plus the same googleBlocks/gemmaExtract/appearsIn/toLetters/
// list/norm/toPerSqKm helpers definitional_cascade.ts already reuses. comparative_cascade.ts
// itself is not modified anywhere by this ticket (verify by diff).
import type { GoogleAnswer } from './comparative_cascade';
// STAGE 2 -- the litmus-strip loop reuses this generator UNCHANGED. It already builds both his
// FD-BP152-03 question shapes (SCALE/DEFINITION and THRESHOLD) off a literal span of the question
// text; this file writes no second wording and no second gate on what may be asked.
import { generateScaleDefinitionQuestion, generateThresholdQuestion, literalSubjectSpan } from '../elements/method_question_generator';
import type { GeneratedMethodQuestion } from '../elements/method_question_generator';
// STAGE 3 -- the Banyan Metric Standard axis, a faithful port of truth_single_bp076.py:1010-1174
// (dimensions, weights, bands unchanged -- see that file's own header for what "faithful" means
// here and what is deliberately NOT ported).
import { computeBanyanMetricStandard, renderBanyanMetricLines } from '../elements/banyan_metric_standard';
import type { BanyanConfidenceLabel, BanyanMetricInputs } from '../elements/banyan_metric_standard';

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

/** STAGE 3 addition: the audit trail's third row-type, symmetric with EliminationRecord and
 *  UnknownRecord. A verified 'pass' is exactly as citable as a 'fail' -- same shape, same
 *  fields -- and STAGE 3's Banyan-Metric inputs need it: "how many independent aspects did the
 *  eventual answer actually verify" is read directly off this array for the winning option (see
 *  buildBanyanMetricInputs() below), not re-derived or guessed. */
export interface PassRecord {
  option: string;
  criterionId: string;
  criterionDescription: string;
  source: string;
  query: string;
  evidence: string;
}

/** D-BP152-037. One already-received passage, banked at the moment it is fetched so a LATER pass
 *  (THE CONVERGENCE, harvestCriteriaFromBankedPassages() far below) can mine it for more candidate
 *  criteria WITHOUT a second askGoogle call. Banked at the only two googleBlocks() call sites this
 *  file has: evaluateCriterionForOption() (a per-option/per-criterion check -- `option` and
 *  `criterionId` are set) and sourceNextLitmusStrip() (a litmus strip's own SOURCING query, about
 *  the candidate term itself, not yet about any specific option -- `option` and `criterionId` are
 *  null). This second kind is where a passage like his own quoted live Gemini run ("recognized
 *  macro-region cluster", "secondary cluster", "smaller biomes or sub-regions") actually lives --
 *  today only its first 300 characters are logged and the rest is discarded once one aspect is
 *  drawn from it; banking keeps the whole thing so nothing paid for is thrown away. */
export interface BankedPassage {
  query: string;
  text: string;
  sources: string[];
  via: string;
  option: string | null;
  criterionId: string | null;
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
  // D-BP152-037, ADDITIVE/OPTIONAL: when a caller passes a bank, the fetched passage is recorded
  // into it (query/text/sources/via/option/criterionId) so a LATER, SEPARATE pass -- THE
  // CONVERGENCE, see harvestCriteriaFromBankedPassages() far below -- can mine already-received
  // passages for more criteria without issuing a second askGoogle call. Every existing call site
  // that omits this argument compiles and behaves exactly as before (runClassifyCascadeWithSeedCriteria,
  // Stage 1's own entry point, does not pass one).
  bank?: BankedPassage[],
): Promise<CriterionCheckResult> {
  const query = `Is ${optionText} ${criterion.aspect}? Answer plainly (yes or no) and cite evidence.`;
  const res = await googleBlocks(ctx.askGoogle, query);
  if (bank && res.ok) {
    bank.push({ query, text: res.text, sources: res.sources, via: res.via, option, criterionId: criterion.id });
  }
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
  passes: PassRecord[];
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
  // D-BP152-037, ADDITIVE/OPTIONAL -- see BankedPassage above and evaluateCriterionForOption()'s
  // own note on this same parameter. Threaded through unchanged; this function's own elimination
  // logic below is untouched by this ticket.
  bank?: BankedPassage[],
): Promise<OccamEliminationResult> {
  let survivors = [...pool];
  const eliminations: EliminationRecord[] = [];
  const unknowns: UnknownRecord[] = [];
  const passes: PassRecord[] = [];
  for (const criterion of criteria) {
    if (!survivors.length) break; // requirement 2: never relax a criterion to revive a pool -- if
    // the pool is already empty, later criteria have nothing left to test and are skipped, not
    // used to somehow "un-eliminate" anything.
    const stillIn: string[] = [];
    for (const option of survivors) {
      const result = await evaluateCriterionForOption(criterion, option, OPT[option], ctx, bank);
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
        passes.push({
          option,
          criterionId: criterion.id,
          criterionDescription: criterion.description,
          source: criterion.source,
          query: result.query,
          evidence: result.evidence,
        });
        note(`   PASS ${option} on criterion "${criterion.id}" -- evidence: "${result.evidence}"`);
        stillIn.push(option);
      }
    }
    survivors = stillIn;
  }
  return { survivors, eliminations, unknowns, passes };
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

/** Which structural role a candidate term plays in the question's own grammar.
 *
 *  'scope'     -- the category/eligibility noun phrase (pattern 1, "the following X is/are").
 *                 Being IN the scope is what makes an option ELIGIBLE to be considered at all; a
 *                 NOT elsewhere in the question negates the PREDICATE, never the scope an option
 *                 must occupy to be a candidate in the first place. A scope term can therefore
 *                 never be disqualifying -- see sourceNextLitmusStrip() below.
 *  'predicate' -- the categorical predicate (pattern 2) or the superlative target property
 *                 (pattern 3) -- the thing the question is actually asking whether an option
 *                 satisfies (or, on a NOT-question, does NOT satisfy). This is what a NOT governs. */
export type ClassifyCandidateRole = 'scope' | 'predicate';

export interface ClassifyCandidateTerm {
  term: string;
  role: ClassifyCandidateRole;
}

// D-BP152-038, factored out (no behavior change): these three pattern-literals used to live only
// inline inside extractClassifyCandidateTerms()'s own `patterns` array below. Named here so the
// superlative-by-magnitude route far below (extractSuperlativeMatch()) can test the EXACT SAME
// regex SCOPE_PATTERN_RE/SUPERLATIVE_PROPERTY_RE already use for detection, with exactly one
// definition of each -- never a second, hand-copied literal that could drift from this one.
const SCOPE_PATTERN_RE = /following\s+([a-z][a-z\s]*?)\s+(?:is|are)\b/i;
const PREDICATE_CATEGORICAL_RE = /(?:considered|classified as|categorized as|qualify as|qualifies as)\s+(?:one of\s+)?(?:the\s+)?([a-z][a-z0-9\s'-]{2,60}?)(?:[.?!]|$)/i;
/** "most/least ADJECTIVE" -- the superlative property phrase (qid 98: "most densely populated").
 *  THIS IS THE STRUCTURAL SIGNAL the superlative-by-magnitude route (far below) gates on -- no
 *  word list, no second regex; extractSuperlativeMatch() tests this exact constant. */
export const SUPERLATIVE_PROPERTY_RE = /\b(most|least)\s+([a-z][a-z\s-]*?)(?:\s+(?:regions?|options?|choices?|items?|of\b)|[.?!]|$)/i;

/** Mechanical, structural candidate-term extraction -- no word list, no model call, three
 *  patterns read off the QUESTION'S OWN GRAMMAR (never the option text). Mirrors the shape
 *  `comparative_cascade.ts`'s own (non-exported, RANK-specific) `deriveCategoryAndProperty()`
 *  reads for RANK; not imported (that function is not exported and is RANK-shaped), reimplemented
 *  narrowly here for CLASSIFY. Every candidate is verified as a literal span of the question text
 *  via `literalSubjectSpan()` (elements/method_question_generator.ts, unchanged) before use -- a
 *  candidate that is not a literal span is dropped, never guessed into one (FD-BP152-03: "Both
 *  subjects are literal spans of the question text").
 *
 *  Each pattern carries a fixed, structural role (see ClassifyCandidateRole above) -- pattern 1
 *  produces 'scope', patterns 2 and 3 produce 'predicate' -- read off WHICH PATTERN matched, never
 *  guessed from the term's own text. */
export function extractClassifyCandidateTerms(question: string): ClassifyCandidateTerm[] {
  const patterns: Array<{ re: RegExp; role: ClassifyCandidateRole; group: number }> = [
    // "the following X is/are" -- the category/scope noun phrase itself (qid 98: "world regions").
    { re: SCOPE_PATTERN_RE, role: 'scope', group: 1 },
    // "considered/classified as/qualify as (one of (the))? X" -- the categorical predicate.
    { re: PREDICATE_CATEGORICAL_RE, role: 'predicate', group: 1 },
    // "most/least ADJECTIVE" -- the superlative property phrase (qid 98: "most densely populated").
    { re: SUPERLATIVE_PROPERTY_RE, role: 'predicate', group: 2 },
  ];
  const seen = new Set<string>();
  const out: ClassifyCandidateTerm[] = [];
  for (const { re, role, group } of patterns) {
    const m = re.exec(question);
    if (!m || !m[group]) continue;
    const term = m[group].trim();
    if (!term) continue;
    const span = literalSubjectSpan(term, question);
    if (!span) continue;
    const key = span.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ term: span, role });
  }
  return out;
}

/** Sources ONE new litmus strip's boundary/definition -- reuses method_question_generator.ts's
 *  own SCALE_DEFINITION/THRESHOLD wording UNCHANGED (no second query text invented here), prefers
 *  THRESHOLD (a numeric/definitional cutoff is the more directly testable aspect), falls back to
 *  SCALE_DEFINITION when THRESHOLD could not be generated for this term, and refuses (returns
 *  null, never a guess) when neither shape could be generated or the sourcing query returned
 *  nothing usable.
 *
 *  D-BP152-036 FIX. Polarity now follows `role` (from extractClassifyCandidateTerms(), carried
 *  through by the caller), not a blanket read of `complement` against every term. A 'scope' term
 *  is always 'qualifying' -- being IN the category is what makes an option ELIGIBLE to be
 *  considered at all, and can never be what a NOT disqualifies. A 'predicate' term (the
 *  categorical predicate or the superlative target property) still inherits `complement` exactly
 *  as before: NOT-detected -> disqualifying, otherwise qualifying. This is READ OFF THE
 *  QUESTION'S OWN GRAMMAR (which pattern matched), never a per-term guess, never a word list.
 *
 *  THE DEFECT THIS REPLACES, FOUND BY THE qid 98 DRY RUN (SEG_RETURN_BP152_035_CLASSIFY_METHOD.md,
 *  Stage 3 verification, and confirmed by D-BP152-035's own return). The old blanket mapping
 *  (`complement ? 'disqualifying' : 'qualifying'` applied to EVERY sourced term regardless of what
 *  it was) is correct for a target-property term (e.g. "densely populated" on qid 98 -- a
 *  NOT-question should disqualify options the source confirms have that property) but wrong for a
 *  scope/eligibility term (e.g. "world regions" -- whether an option qualifies as a legitimate
 *  candidate AT ALL, independent of the NOT). The live dry run's real gemma extraction read a
 *  genuinely-worded "is this a world region" passage as affirmatively "yes" for BOTH surviving
 *  options, and the blanket complement-derived DISQUALIFYING polarity then eliminated both -- an
 *  honest zero-survivor abstain, not a crash, but a real over-elimination relative to the
 *  historically correct key. */
async function sourceNextLitmusStrip(
  candidateTerm: string,
  role: ClassifyCandidateRole,
  questionText: string,
  complement: boolean,
  ctx: MethodRunContext,
  index: number,
  note: (text: string) => void,
  // D-BP152-037, ADDITIVE/OPTIONAL -- see BankedPassage above. This is the OTHER of this file's
  // two googleBlocks() call sites; its passages are where his own quoted Gemini example lives.
  bank?: BankedPassage[],
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
  if (bank) {
    bank.push({ query: primary.questionText, text: res.text, sources: res.sources, via: res.via, option: null, criterionId: null });
  }
  const cited = res.text.length > 300 ? `${res.text.slice(0, 300)}...` : res.text;
  note(`   litmus strip ${index}: sourced -- ${cited}`);
  // D-BP152-036: polarity follows the matched pattern's ROLE, not a blanket read of `complement`.
  // 'scope' (pattern 1, "the following X is/are") is always qualifying -- eligibility for the
  // category can never be what a NOT disqualifies. 'predicate' (patterns 2/3) still inherits
  // `complement` exactly as before.
  const polarity: CriterionPolarity = role === 'scope' ? 'qualifying' : (complement ? 'disqualifying' : 'qualifying');
  note(
    `   litmus strip ${index}: "${candidateTerm}" role=${role} -- polarity=${polarity}`
      + (role === 'scope' ? ' (scope term, always qualifying)' : ` (predicate term, inherits complement=${complement})`),
  );
  return {
    id: `litmus-${index}`,
    description: `meets "${candidateTerm}" per the sourced ${primary.shape === 'THRESHOLD' ? 'threshold' : 'scale/definition'} (role=${role})`,
    polarity,
    aspect: `${candidateTerm}, per this sourced answer: "${cited}"`,
    source: `${primary.questionText} -- Google [${res.via}]`,
  };
}

export interface LitmusStripLoopResult {
  survivors: string[];
  criteria: ClassifyCriterion[];
  eliminations: EliminationRecord[];
  unknowns: UnknownRecord[];
  passes: PassRecord[];
  stoppedReason: 'definitive' | 'zero-survivors' | 'ceiling' | 'terms-exhausted';
  /** D-BP152-037: every passage this run's seed-criteria checks and litmus-strip sourcing/checks
   *  actually received from Google, banked as fetched -- the raw material THE CONVERGENCE (see
   *  harvestCriteriaFromBankedPassages() far below) mines with no second askGoogle call. */
  bank: BankedPassage[];
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

  // D-BP152-037: every passage fetched anywhere in this loop is banked here, in fetch order, so
  // THE CONVERGENCE (harvestCriteriaFromBankedPassages(), called by the caller after this loop
  // returns) can mine already-received text with no second askGoogle call.
  const bank: BankedPassage[] = [];

  const allCriteria: ClassifyCriterion[] = [...seedCriteria];
  const seedRound = await applyOccamElimination(ALL, OPT, seedCriteria, ctx, note, bank);
  let survivors = seedRound.survivors;
  let eliminations = seedRound.eliminations;
  let unknowns = seedRound.unknowns;
  let passes = seedRound.passes;

  if (!survivors.length) {
    return { survivors, criteria: allCriteria, eliminations, unknowns, passes, stoppedReason: 'zero-survivors', bank };
  }
  if (survivors.length === 1) {
    return { survivors, criteria: allCriteria, eliminations, unknowns, passes, stoppedReason: 'definitive', bank };
  }

  const usedAspects = new Set(seedCriteria.map((c) => c.aspect.toLowerCase()));
  const candidateTerms = extractClassifyCandidateTerms(input.question).filter(
    (t) => ![...usedAspects].some((a) => a.startsWith(t.term.toLowerCase())),
  );
  let termIndex = 0;
  let stripsAdded = 0;

  while (survivors.length > 1) {
    if (stripsAdded >= LITMUS_STRIP_CEILING) {
      return { survivors, criteria: allCriteria, eliminations, unknowns, passes, stoppedReason: 'ceiling', bank };
    }
    if (termIndex >= candidateTerms.length) {
      return { survivors, criteria: allCriteria, eliminations, unknowns, passes, stoppedReason: 'terms-exhausted', bank };
    }
    const term = candidateTerms[termIndex];
    termIndex++;
    // eslint-disable-next-line no-await-in-loop -- each strip's query depends on the PRIOR strip's
    // narrowed survivor pool; strips are sourced one at a time by design (each is a NEW axis
    // evaluated against the current state), not fired in parallel.
    const criterion = await sourceNextLitmusStrip(term.term, term.role, input.question, complement, ctx, allCriteria.length + 1, note, bank);
    if (!criterion) continue; // refused this term -- try the next one; does not count against the ceiling
    stripsAdded++;
    allCriteria.push(criterion);
    // eslint-disable-next-line no-await-in-loop -- see above
    const round = await applyOccamElimination(survivors, OPT, [criterion], ctx, note, bank);
    survivors = round.survivors;
    eliminations = eliminations.concat(round.eliminations);
    unknowns = unknowns.concat(round.unknowns);
    passes = passes.concat(round.passes);
    note(`   after litmus strip "${criterion.id}": pool -> ${survivors.length} (${survivors.join(', ') || 'none'})`);
  }

  return {
    survivors,
    criteria: allCriteria,
    eliminations,
    unknowns,
    passes,
    stoppedReason: survivors.length === 0 ? 'zero-survivors' : 'definitive',
    bank,
  };
}

// ─────────────────────────── THE CONVERGENCE: harvesting criteria from answers already in hand ───────────────────────────
//
// D-BP152-037/BISHOP/seg-harvest-criteria-convergence. THE FOUNDER'S RULING, BP152, VERBATIM:
//   "YES build the harvesting the criteria out of answers already in hand. THE CONVERGENCE."
//
// THE DEFECT THIS CLOSES. extractClassifyCandidateTerms() (above) reads only the QUESTION's own
// grammar. But every passage this run's seed-criteria checks and litmus-strip sourcing queries
// already fetched (banked into LitmusStripLoopResult.bank, above) can carry richer criteria than
// the question itself names -- his own live Gemini run stated "recognized macro-region cluster",
// "secondary cluster", and "smaller biomes or sub-regions", none of which qid 98's question text
// carries. Those passages were already paid for and, until this section, were discarded once one
// aspect was drawn from each.
//
// THIS IS NOT A RE-ASK. Every function below reads ONLY `BankedPassage.text`, already sitting in
// memory from when runLitmusStripLoop() fetched it earlier in this SAME run -- nothing in this
// section calls ctx.askGoogle or googleBlocks(). The only network-shaped call anywhere below is
// gemmaExtract(), which is a LOCAL Ollama call (extraction, HARDWIRE-22), never a second Google
// query.
//
// HARDWIRE-22 IS THE BINDING CONSTRAINT. gemmaExtract() below copies out a verbatim span and
// nothing else -- same unrelaxed extraction path evaluateCriterionForOption() already uses above,
// same appearsIn() verification before anything extracted is trusted. No prompt below asks a
// model to judge relevance, importance, or correctness; the code's own filtering (appearsIn(),
// the dedup set, the applicability check, the exact-string convergence grouping) decides
// everything that decides anything.
//
// POLARITY -- REFUSE RATHER THAN GUESS. extractClassifyCandidateTerms() reads a term's role
// (scope vs predicate) off WHICH GRAMMAR PATTERN matched in the QUESTION. A harvested phrase comes
// from an ANSWER, not the question -- there is no such pattern to read, for any harvested phrase,
// in this build. Per his ruling: "if a harvested criterion's polarity cannot be established
// structurally, RECORD IT BUT DO NOT LET IT ELIMINATE." Every HarvestedCriterion below is
// therefore polarity 'undetermined' -- a DIFFERENT, narrower type than ClassifyCriterion's own
// CriterionPolarity ('qualifying' | 'disqualifying'), so a harvested criterion cannot even be
// PASSED to applyOccamElimination() without a type error. That is deliberate: it is the structural
// guarantee (not a runtime check that could be forgotten) that a harvested criterion never
// eliminates -- it never enters the Occam elimination path at all. Applicability is instead
// checked below by a separate, additive pass that only ever records a reading, never removes an
// option from `survivors`.
//
// CONVERGENCE -- RECORDED AND SHOWN, NEVER PROMOTED. Per his ruling, there is no weighting in this
// method; a converged criterion is never auto-promoted to eliminate or to a higher weight. Two
// harvested phrases converge only on an EXACT, normalized (trim + lowercase) text match -- a
// fuzzy/semantic "these mean the same thing" judgment would itself be the kind of DECISION
// HARDWIRE-22 forbids a model from making, so no such judgment is made here, by a model or by
// this code. And per his qid-92 canon ("four vendors agreeing was one path counted four times"):
// convergence is counted only across INDEPENDENT sources -- passageIndependenceKey() below treats
// two banked passages as the SAME source when they share the same primary cited URL, so two
// phrases surfacing from the same underlying authority (even via two different queries in this
// run) collapse to ONE derivation path, not two.

export interface HarvestedCriterion {
  id: string;
  /** The verbatim span copied out of the passage -- the candidate criterion itself, never a
   *  paraphrase (verified with appearsIn() against its own source passage before being kept). */
  aspect: string;
  /** Always 'undetermined' -- see this section's header. A separate, narrower type from
   *  ClassifyCriterion's own CriterionPolarity so a harvested criterion cannot type-check as an
   *  input to applyOccamElimination(). */
  polarity: 'undetermined';
  /** The exact query whose ALREADY-RECEIVED passage this phrase was copied from. */
  sourceQuery: string;
  /** Which option's per-option check produced the source passage, or null when the source was a
   *  litmus strip's own SOURCING query (about the candidate term itself, not yet about any
   *  option). */
  sourceOption: string | null;
  /** The source passage's own first cited URL (GoogleAnswer.sources[0]), when it has one -- the
   *  "which authority" half of provenance; null for an answer-box passage with no cited URL. */
  sourceUrl: string | null;
}

/** One harvested criterion checked against ONE surviving option's OWN already-banked passage(s) --
 *  extraction only, no new query. Recorded for the transcript/audit; never feeds
 *  applyOccamElimination() or mutates `survivors`. */
export interface HarvestApplicationRecord {
  criterionId: string;
  aspect: string;
  option: string;
  reading: 'yes' | 'no' | 'unclear';
  evidence: string;
  /** Which already-banked query's passage this reading was read from. */
  bankedQuery: string;
}

export interface ConvergenceRecord {
  aspectNormalized: string;
  criterionIds: string[];
  independentSourceKeys: string[];
  independentSourceCount: number;
}

export interface HarvestResult {
  harvested: HarvestedCriterion[];
  applications: HarvestApplicationRecord[];
  /** Ids of harvested criteria for which at least one surviving option's already-banked passages
   *  yielded a verified yes/no reading. Per his ruling: "Report how many were harvested versus how
   *  many were applicable -- that count is a finding either way." */
  applicableCriterionIds: string[];
  convergence: ConvergenceRecord[];
}

/** "SAME authority in the SAME thread is ONE derivation path" (his qid-92 canon). Thread = the
 *  exact query text (this file never re-asks the same question, so distinct queries in one run
 *  are already distinct threads by construction). Authority = the passage's own first cited
 *  source URL (GoogleAnswer.sources, already returned by googleBlocks() -- not a new lookup).
 *  Two banked passages collapse to the SAME independent source only when they share that same
 *  primary URL; a passage with nothing in `sources` (a bare answer-box snippet) is its own
 *  independent source by necessity -- there is nothing to compare it against. */
function passageIndependenceKey(p: BankedPassage): string {
  return p.sources.length ? `url:${p.sources[0]}` : `query:${p.query}`;
}

/** Extracts, from ONE already-banked passage, up to three verbatim phrases that name a category,
 *  membership, cluster, or classification property -- copied out, never invented, verified with
 *  appearsIn() before acceptance, exactly like evaluateCriterionForOption()'s own sentence
 *  extraction above. NO NEW askGoogle CALL: gemmaExtract() reads only `passage.text`, already
 *  sitting in memory from earlier in this run.
 *
 *  DEDUP SCOPE, DELIBERATELY NARROW -- this is the one place THE CONVERGENCE could quietly defeat
 *  its own purpose, so it is spelled out here. `stackAspects` is READ-ONLY and fixed at call time
 *  (the existing criteria stack -- seed criteria plus every litmus strip already sourced from the
 *  QUESTION's grammar): a phrase that duplicates one of THOSE is dropped, because harvesting it
 *  again would just re-add a criterion already being tested. A phrase is also dropped if it
 *  duplicates another phrase from THIS SAME passage (three phrases from one gemmaExtract() call
 *  occasionally repeat). Nothing here compares against phrases harvested from OTHER passages --
 *  doing so would silently collapse the second of two independently-stated occurrences of the same
 *  criterion before THE CONVERGENCE's own grouping step (harvestCriteriaFromBankedPassages() below)
 *  ever saw it, which would make convergence structurally unobservable. Cross-passage repetition is
 *  exactly the signal being harvested for -- it is grouped and counted later, never suppressed
 *  here. */
async function harvestPhrasesFromPassage(
  passage: BankedPassage,
  stackAspects: ReadonlySet<string>,
  startIndex: number,
): Promise<HarvestedCriterion[]> {
  const ex = await gemmaExtract(
    'Copy out up to three short verbatim phrases from the passage that each name a category, '
      + 'membership, cluster, or classification property (the kind of phrase that could tell you '
      + 'which named group or type something belongs to). Copy each phrase out exactly as written, '
      + 'word for word from the passage -- do not summarize, paraphrase, or explain, and do not rank '
      + 'or choose which one is most important. If none exist, return an empty list.',
    passage.text,
    '{"phrases":["verbatim phrase 1","verbatim phrase 2","verbatim phrase 3"]}',
  );
  const raw = Array.isArray(ex?.phrases) ? (ex!.phrases as unknown[]) : [];
  const out: HarvestedCriterion[] = [];
  const seenThisPassage = new Set<string>();
  let i = startIndex;
  for (const p of raw) {
    const phrase = String(p ?? '').trim();
    if (!phrase) continue;
    if (!appearsIn(passage.text, phrase)) continue; // unverified copy -- refuse, never trust
    const key = phrase.toLowerCase();
    if (seenThisPassage.has(key)) continue; // this passage's own 3 phrases repeating each other
    if (stackAspects.has(key)) continue; // already a criterion on the existing stack
    if ([...stackAspects].some((a) => key.includes(a) || a.includes(key))) continue; // substring dup of the stack
    seenThisPassage.add(key);
    out.push({
      id: `harvest-${i}`,
      aspect: phrase,
      polarity: 'undetermined',
      sourceQuery: passage.query,
      sourceOption: passage.option,
      sourceUrl: passage.sources[0] ?? null,
    });
    i++;
  }
  return out;
}

/** THE CONVERGENCE, end to end. Runs over every passage already banked during this run's Occam
 *  elimination + litmus-strip loop. NO NEW askGoogle CALL anywhere in this function or anything it
 *  calls. Three passes:
 *   1. Harvest candidate criteria (verbatim phrases) out of every banked passage.
 *   2. For each harvested criterion, check whether a CURRENT survivor's OWN already-banked
 *      passage(s) already speak to it -- extraction over already-banked text only.
 *   3. Group harvested criteria by exact, normalized aspect text and count convergence across
 *      INDEPENDENT sources only, guarding the false-consensus trap his qid-92 canon names.
 *  Never eliminates, never reweights, never mutates `survivors` -- purely additive audit fed back
 *  into the transcript and the outcome's `basis` by the caller. */
export async function harvestCriteriaFromBankedPassages(
  bank: BankedPassage[],
  existingCriteria: ClassifyCriterion[],
  survivors: string[],
  OPT: Record<string, string>,
  note: (text: string) => void,
): Promise<HarvestResult> {
  // Fixed for the whole pass, never mutated -- see harvestPhrasesFromPassage()'s own header for
  // why cross-passage repetition must survive as separate HarvestedCriterion entries rather than
  // being deduped away here (that repetition is exactly what the convergence grouping below counts).
  const stackAspects = new Set(existingCriteria.map((c) => c.aspect.toLowerCase()));
  const harvested: HarvestedCriterion[] = [];
  let idx = 1;
  for (const passage of bank) {
    // eslint-disable-next-line no-await-in-loop -- extraction reads one already-banked passage at
    // a time (a local Ollama call, not a network fan-out).
    const found = await harvestPhrasesFromPassage(passage, stackAspects, idx);
    idx += found.length;
    for (const h of found) {
      harvested.push(h);
      note(
        `   harvested "${h.aspect}" -- from ${h.sourceOption ? `option ${h.sourceOption}'s` : "the litmus-sourcing"} `
          + `answer to "${h.sourceQuery.slice(0, 80)}${h.sourceQuery.length > 80 ? '...' : ''}"`,
      );
    }
  }

  const applications: HarvestApplicationRecord[] = [];
  const applicableIds = new Set<string>();
  for (const criterion of harvested) {
    for (const option of survivors) {
      const optionPassages = bank.filter((p) => p.option === null || p.option === option);
      for (const passage of optionPassages) {
        // eslint-disable-next-line no-await-in-loop -- extraction-only, over already-banked text,
        // one passage at a time (same reasoning as the harvest loop above).
        const ex = await gemmaExtract(
          `Does the passage assert that "${OPT[option]}" ${criterion.aspect}, or that it does NOT? `
            + 'Copy out the verbatim sentence that supports your reading, word for word from the '
            + 'passage. If the passage does not address this at all, say "unclear" and leave the '
            + 'sentence empty.',
          passage.text,
          '{"reading":"yes|no|unclear","sentence":"the verbatim sentence, or empty"}',
        );
        const reading = String((ex?.reading as string | undefined) || 'unclear').toLowerCase();
        const sentence = String((ex?.sentence as string | undefined) || '');
        if (!sentence || !appearsIn(passage.text, sentence)) continue;
        if (reading !== 'yes' && reading !== 'no') continue;
        applications.push({
          criterionId: criterion.id,
          aspect: criterion.aspect,
          option,
          reading: reading as 'yes' | 'no',
          evidence: sentence,
          bankedQuery: passage.query,
        });
        applicableIds.add(criterion.id);
        note(
          `   ${criterion.id} ("${criterion.aspect}") applied to ${option} (undetermined polarity -- `
            + `recorded, never eliminates): ${reading} -- "${sentence}"`,
        );
        break; // one resolved reading for this option is enough to mark this criterion applicable
      }
    }
  }

  // Convergence: exact, normalized aspect-text match ONLY (see this section's header). Counted
  // across INDEPENDENT sources only.
  const bankByQuery = new Map(bank.map((p) => [p.query, p] as const));
  const groups = new Map<string, HarvestedCriterion[]>();
  for (const h of harvested) {
    const key = h.aspect.trim().toLowerCase();
    const g = groups.get(key) ?? [];
    g.push(h);
    groups.set(key, g);
  }
  const convergence: ConvergenceRecord[] = [];
  for (const [aspectNormalized, members] of groups) {
    if (members.length < 2) continue; // stated once -- nothing to converge
    const keys = new Set<string>();
    for (const m of members) {
      const passage = bankByQuery.get(m.sourceQuery);
      keys.add(passage ? passageIndependenceKey(passage) : `query:${m.sourceQuery}`);
    }
    convergence.push({
      aspectNormalized,
      criterionIds: members.map((m) => m.id),
      independentSourceKeys: [...keys],
      independentSourceCount: keys.size,
    });
    if (keys.size >= 2) {
      note(`   CONVERGENCE: "${aspectNormalized}" stated by ${keys.size} independent source(s) (criteria ${members.map((m) => m.id).join(', ')})`);
    } else {
      note(
        `   NOT CONVERGENT: "${aspectNormalized}" stated ${members.length}x but from only ${keys.size} independent `
          + 'source (same authority/thread repeated -- one derivation path, not counted as convergence)',
      );
    }
  }

  return { harvested, applications, applicableCriterionIds: [...applicableIds], convergence };
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

  // ── THE CONVERGENCE (D-BP152-037) ───────────────────────────────────────────────────────────
  // His ruling: "YES build the harvesting the criteria out of answers already in hand. THE
  // CONVERGENCE." Mines every passage this run ALREADY received (loop.bank) for more candidate
  // criteria -- NO NEW askGoogle CALL. Purely additive: never touches `loop.survivors`, never
  // changes which branch below fires, never alters the Banyan Metric inputs. See this file's own
  // "THE CONVERGENCE" section header (above runLitmusStripLoop... below it, structurally) for the
  // full rationale.
  step(`THE CONVERGENCE  harvesting criteria from ${loop.bank.length} already-received passage(s) -- no new query issued`);
  const harvest = await harvestCriteriaFromBankedPassages(loop.bank, loop.criteria, loop.survivors, OPT, note);
  const harvestSummary = `harvested ${harvest.harvested.length} criterion/criteria from ${loop.bank.length} already-received `
    + `passage(s), ${harvest.applicableCriterionIds.length} applicable (undetermined polarity -- recorded, none eliminate); `
    + `convergence groups: ${harvest.convergence.length} (>=2 independent sources: ${harvest.convergence.filter((c) => c.independentSourceCount >= 2).length})`;
  note(`   ${harvestSummary}`);

  const elapsedS = (Date.now() - t0) / 1000;
  const eliminationsSummary = loop.eliminations.map((e) => `${e.option} broke "${e.criterionId}"`).join('; ') || 'none';

  // ── STAGE 3: THE BANYAN METRIC + THE PUBLISH/ABSTAIN RULE ──────────────────────────────────
  // His words, FD-BP152-19: "Apply criteria as hard pass/fail... If more than one survives, add
  // another litmus strip... Score the answer on the Banyan Metric Standard axis and publish it
  // with its score, down to LOW. INSUFFICIENT alone abstains, reporting the surviving set."
  //
  // NO TIE-BREAK, STILL. Zero survivors and more-than-one survivors (loop exhausted its ceiling
  // or its candidate terms without narrowing further) BOTH abstain here -- neither branch picks a
  // winner. Only `loop.survivors.length === 1` (the loop's OWN "definitive" outcome, reached with
  // no forcing) ever reaches the Banyan Metric at all.
  step('STAGE 3  Banyan Metric Standard scoring + publish/abstain rule');
  if (loop.survivors.length === 0) {
    // Requirement 2: no constraint relaxation. Report zero survivors honestly, not a guess.
    step('   zero survivors -- every option broke at least one criterion; refusing to relax any of them (his "Don\'t do rule 2")');
    emit({ kind: 'result', text: `ABSTAIN (zero survivors)   eliminations: ${eliminationsSummary}${KEY != null ? `  key=${KEY}` : ''}`, ts: nowIso() });
    return {
      qid: input.qid,
      question: input.question,
      verdict: null,
      correct: KEY,
      abstain: true,
      freeText: input.qid == null,
      basis: `zero survivors after ${loop.criteria.length} criterion/criteria (loop stopped: ${loop.stoppedReason}); `
        + `eliminations: ${eliminationsSummary}; no relaxation applied; ${harvestSummary}`,
    };
  }
  if (loop.survivors.length > 1) {
    step(
      `   more than one survivor (${loop.survivors.join(', ')}), loop stopped (${loop.stoppedReason}) before reaching definitiveness -- `
        + 'abstaining and reporting the surviving set, never picking among them (no tie-breaker exists in this code)',
    );
    emit({
      kind: 'result',
      text: `ABSTAIN (${loop.survivors.length} survivors, loop stopped: ${loop.stoppedReason})   survivors: ${loop.survivors.join(',')}${KEY != null ? `  key=${KEY}` : ''}`,
      ts: nowIso(),
    });
    return {
      qid: input.qid,
      question: input.question,
      verdict: null,
      correct: KEY,
      abstain: true,
      freeText: input.qid == null,
      basis: `${loop.survivors.length} survivor(s) remain after ${loop.criteria.length} criterion/criteria, loop stopped: `
        + `${loop.stoppedReason} -- survivors: ${loop.survivors.join(', ')}; eliminations: ${eliminationsSummary}; no tie-breaker applied; `
        + `${harvestSummary}`,
    };
  }

  const winner = loop.survivors[0];
  const bmInputs = buildBanyanMetricInputs(loop, winner, elapsedS);
  const bm = computeBanyanMetricStandard(bmInputs);
  for (const line of renderBanyanMetricLines(bm)) note(line);

  if (bm.band === 'INSUFFICIENT') {
    step(`   single survivor ${winner}, but Banyan Metric ${bm.composite}/100 is INSUFFICIENT -- his rule: "INSUFFICIENT alone abstains"`);
    emit({ kind: 'result', text: `ABSTAIN (INSUFFICIENT, ${bm.composite}/100)   sole survivor was ${winner}${KEY != null ? `  key=${KEY}` : ''}`, ts: nowIso() });
    return {
      qid: input.qid,
      question: input.question,
      verdict: null,
      correct: KEY,
      abstain: true,
      freeText: input.qid == null,
      basis: `sole survivor ${winner} after ${loop.criteria.length} criterion/criteria, but Banyan Metric Standard `
        + `${bm.composite}/100 is INSUFFICIENT -- abstaining per his rule ("INSUFFICIENT alone abstains"); `
        + `eliminations: ${eliminationsSummary}; ${harvestSummary}`,
    };
  }

  // PUBLISH, floor LOW. "Low is definitive, specifically BECAUSE it also comes with a Banyan
  // Metric Score... one source, they let it exist, but they tell you it might be wrong."
  const ok = KEY != null ? winner === KEY : undefined;
  step(`   single survivor ${winner} -- Banyan Metric ${bm.composite}/100 (${bm.band}) -- publishing WITH its score, per his floor-is-LOW rule`);
  emit({
    kind: 'result',
    text: `${KEY != null ? (ok ? 'CORRECT' : 'WRONG') : 'ANSWER'}  ${winner} (${OPT[winner]})  BM ${bm.composite}/100 ${bm.band}${KEY != null ? `  key=${KEY}` : ''}`,
    ts: nowIso(),
  });
  note(`   ${elapsedS.toFixed(1)}s`);
  return {
    qid: input.qid,
    question: input.question,
    verdict: winner,
    correct: KEY,
    ok,
    abstain: false,
    freeText: input.qid == null,
    basis: `sole survivor after ${loop.criteria.length} criterion/criteria (loop stopped: ${loop.stoppedReason}); `
      + `Banyan Metric Standard ${bm.composite}/100 (${bm.band}), published per his floor-is-LOW rule; `
      + `eliminations: ${eliminationsSummary}; ${harvestSummary}`,
  };
}

/** STAGE 3. Maps this run's own measurements onto the ported Banyan Metric Standard's 10 inputs
 *  (`elements/banyan_metric_standard.ts`, itself a faithful, unrescaled port of
 *  `truth_single_bp076.py:1010-1134` -- see that file's own header). SOME MAPPINGS ARE DIRECT AND
 *  FAITHFUL to the Python dimension's own stated meaning; OTHERS ARE REASONED PROXIES, TARE-
 *  labeled below, because this method's own run produces different raw material than the
 *  multi-specialist retrieval pipeline truth_single_bp076.py was built to score. Every TARE is
 *  disclosed here AND in the deliverable -- none is silently smoothed to look better than it is. */
function buildBanyanMetricInputs(
  loop: LitmusStripLoopResult,
  winner: string,
  elapsedS: number,
): BanyanMetricInputs {
  // TARE: "specialists consulted" in the Python source means DRT specialists, a different
  // pipeline's concept entirely. Here it stands in for "distinct sourced queries this run
  // actually issued" -- the nearest analogous meaning, not the literal one.
  const distinctQueries = new Set<string>([
    ...loop.eliminations.map((e) => e.query),
    ...loop.unknowns.map((u) => u.query),
    ...loop.passes.map((p) => p.query),
  ]);

  const winnerUnknowns = loop.unknowns.filter((u) => u.option === winner);
  const winnerPasses = loop.passes.filter((p) => p.option === winner);
  const anyUnknownAnywhere = loop.unknowns.length > 0;

  // ATTRIBUTED, not a TARE: "independent aspects tested" is exactly what a criterion IS in this
  // file. Directly implements his own instruction: "if all of them pass, that's VERY definitive
  // ... the score rises with the aspects tested." Counts only criteria the WINNER verifiably
  // PASSED (a criterion the winner never faced, e.g. it was eliminated before reaching it, is not
  // counted -- only Occam elimination never runs a criterion against an option already removed,
  // so this can only undercount, never inflate).
  const independentClustersForAnswer = winnerPasses.length;

  // TARE, reasoned, disclosed: no dedicated confidence-label input exists for this method (unlike
  // the Python pipeline's own upstream step that assigns one independently). Derived here from
  // whether the winner AND the run as a whole hit any 'unknown' reading: zero unknowns anywhere
  // -> ABSOLUTE (every aspect tested resolved cleanly); winner itself fully resolved but some
  // OTHER option had an unknown along the way -> HIGH; the winner survived a criterion only
  // because that criterion came back unknown for it -> MEDIUM. This is Bishop's interpretation of
  // his Rover/planets reasoning, not his own words, and is flagged as such in the deliverable.
  let confidence: BanyanConfidenceLabel;
  if (!anyUnknownAnywhere) confidence = 'ABSOLUTE';
  else if (winnerUnknowns.length === 0) confidence = 'HIGH';
  else confidence = 'MEDIUM';

  return {
    specialists_consulted: distinctQueries.size,
    eblets_gathered_raw: loop.eliminations.length + loop.unknowns.length + loop.passes.length,
    // TARE: no derivative-source/dedup detection is built anywhere in this file -- honestly
    // reported as 0 (never measured), not fabricated. See the deliverable's "known gaps".
    derivative_pairs_collapsed: 0,
    independent_clusters_for_answer: independentClustersForAnswer,
    primary_text_present: winnerPasses.some((p) => !!p.evidence),
    confidence_label_calibration: confidence,
    // Direct, faithful mapping -- the Python dimension's own description ("Truth-Always: tool
    // honestly flags what it couldn't consult") is exactly what an UnknownRecord anywhere in this
    // run IS.
    stubbed_gap_acknowledged: anyUnknownAnywhere ? 1 : 0,
    // TARE: no independent, second derivation exists for this method to cross-validate against --
    // honestly 0, not fabricated. Structurally caps this dimension's score at 0/100 until a real
    // cross-validation mechanism is built; disclosed, not smoothed over.
    manual_llm_concordance: 0,
    // Direct, faithful mapping -- actual measured wall-clock elapsed time for this run.
    wall_clock_latency_s: elapsedS,
    // Structural, ATTRIBUTED to this method's own architecture (Stages 1-3 of this ticket), not
    // invented per-run: every run of this method (a) never eliminates on 'unknown', (b) never
    // tie-breaks, (c) requires a cited, verified source for every elimination, (d) publishes its
    // answer WITH its Banyan Metric score (his Wikipedia-banner model) -- four guardrails
    // guaranteed by construction, so this is a constant, not a per-run count.
    anti_popularity_guardrails_count: 4,
  };
}

// ─────────────────────────── THE SUPERLATIVE-BY-MAGNITUDE ROUTE ───────────────────────────
//
// D-BP152-038/BISHOP/seg-superlative-resolves-by-rank. THE FOUNDER'S RULING, BP152, VERBATIM, in
// answer to "does a superlative membership question terminate on the RANK terminator applied to
// the property the superlative names": "Yes. that. now code it, please."
//
// HIS OWN WALKTHROUGH IS THE SPECIFICATION (FOUNDER_CASCADE_WORKED_BY_HAND_VERBATIM_RECOVERED_
// BP144.md, lines 35-100, EXCERPT 2). He solved the population-density membership question BY
// RANKING, not by classifying: order the (already-narrowed) options by the property the
// superlative names, asking BOTH directions as separate Google searches to check the engine
// against itself, then a quality-control pass with every option -- including ones already
// eliminated -- re-included, then read the answer off the SAME hard number his comparative
// cascade already terminates on.
//
// STRUCTURAL DETECTION, NO WORD LIST. extractSuperlativeMatch() below tests SUPERLATIVE_PROPERTY_RE
// -- the EXACT pattern 3 regex extractClassifyCandidateTerms() (above) also matches, factored into
// one shared constant so there is exactly one definition, never two that could drift. If the
// question carries no structural "most X" / "least X" span, this route never engages and run()
// (bottom of this file) falls through to the unmodified criteria-stack path, behaving exactly as
// it did at 1a9dd511.
//
// AN ADDITIONAL ROUTE, NOT A REPLACEMENT. runClassifyCascade() (Occam elimination + litmus strips
// + Banyan Metric, Stages 1-3 above) is untouched by this section -- not one line inside it is
// modified, and it remains the path every non-superlative CLASSIFY question runs. This route
// REUSES runLitmusStripLoop() (Stage 2, unmodified) to get a survivor pool the same general,
// no-word-list way every other CLASSIFY question gets one -- this section adds no second
// elimination mechanism of its own.
//
// TERMINATE ON THE EXISTING HARD NUMBER, REUSED NOT COPIED. evaluateComparativeTerminator()'s
// value-convergence branch (comparative_cascade.ts:689-750, order-of-magnitude self-agreement) is
// imported and called directly below -- comparative_cascade.ts itself is not modified anywhere by
// this ticket (verify by diff).
//
// A KNOWN, DISCLOSED GAP IN THE REUSED FUNCTION, NOT FIXED HERE (per this ticket's own FORBIDDEN
// section: "do NOT modify comparative_cascade.ts"). detectValueConvergence()'s own doc comment
// there states plainly that when more than one option self-agrees, it always picks the LOWEST
// value -- "direction-awareness for a 'most X' question is a separate, pre-existing gap this
// ticket was not asked to fix." That is exactly right for a NOT-question asking which option is
// NOT among the superlative's own direction (qid 98: NOT the most densely populated => wants the
// least-dense option, and the reused function's own lowest-wins rule lands on exactly that extreme
// with no change needed here). It is NOT correct for a DIRECT "most X" question with no NOT (that
// needs the HIGHEST self-agreeing value, which the reused function does not compute) -- this route
// detects that case (targetExtreme === 'most') and ABSTAINS with the gap named, rather than either
// modifying the reused function or inventing an unrequested workaround (an inversion/reciprocal
// transform) that was never asked for and was never verified against his own worked examples.

interface SuperlativeMatch { direction: 'most' | 'least'; property: string; }

/** Structural detection -- tests SUPERLATIVE_PROPERTY_RE, the SAME regex
 *  extractClassifyCandidateTerms()'s own pattern 3 matches (that match IS the signal, per this
 *  ticket). Returns which direction word matched ('most'/'least') and the literal property span,
 *  or null when the question carries no structural superlative -- the ONLY gate run() uses to
 *  decide whether this route engages at all. */
export function extractSuperlativeMatch(question: string): SuperlativeMatch | null {
  const m = SUPERLATIVE_PROPERTY_RE.exec(question);
  if (!m || !m[2]) return null;
  const term = m[2].trim();
  if (!term) return null;
  const span = literalSubjectSpan(term, question);
  if (!span) return null;
  const direction = m[1].toLowerCase() as 'most' | 'least';
  return { direction, property: span };
}

/** Pure two-value flip -- no lookup table, no word list. A NOT-question demands the complement of
 *  the superlative's own direction (questionDemandsComplement(), already defined above). */
function oppositeExtreme(direction: 'most' | 'least'): 'most' | 'least' {
  return direction === 'most' ? 'least' : 'most';
}

interface OrderingQueryResult {
  label: string;
  query: string;
  ok: boolean;
  ordering: string[];
  raw: GoogleAnswer | null;
}

/** Fires ONE ordering query, his own sentence structure verbatim
 *  (FOUNDER_CASCADE_WORKED_BY_HAND_VERBATIM_RECOVERED_BP144.md lines 67/80: "Please put these
 *  regions in order of most/least densely to least/most densely populated."), and extracts the
 *  stated order the SAME way comparative_cascade.ts's own stage 3 already does (gemmaExtract +
 *  toLetters + appearsIn verification against the passage). NEW CODE HERE, reusing only the
 *  already-exported primitives (googleBlocks, gemmaExtract, appearsIn, toLetters, list) -- not a
 *  copy of that file's run() body, and comparative_cascade.ts is not modified. */
async function askOrdering(
  askGoogle: MethodRunContext['askGoogle'],
  category: string,
  property: string,
  direction: 'most-to-least' | 'least-to-most',
  pool: string[],
  OPT: Record<string, string>,
  label: string,
  note: (text: string) => void,
): Promise<OrderingQueryResult> {
  const [d1, d2] = direction === 'most-to-least' ? ['most', 'least'] : ['least', 'most'];
  const query = `Please put these ${category} in order of ${d1} ${property} to ${d2} ${property}. ${list(pool, OPT)}`;
  note(`   ${label}: ${query}`);
  const res = await googleBlocks(askGoogle, query);
  if (!res.ok) {
    note(`   ${label}: no usable answer (${res.via})`);
    return { label, query, ok: false, ordering: [], raw: res };
  }
  const ex = await gemmaExtract(
    'If this passage states an explicit ranking or ordered list of any of these names, copy that '
      + 'list out in exactly the order the passage gives it. If the passage does not state an order, '
      + `return an empty list. Do not put them in order yourself. Names: ${pool.map((L) => OPT[L]).join('; ')}`,
    res.text,
    '{"order":["exact name, in the passage\'s stated order"],"order_stated_in_passage":true}',
  );
  let ordering = toLetters(ex?.order as unknown[] | undefined, OPT);
  ordering = ordering.filter((L) => appearsIn(res.text, OPT[L]));
  note(`   ${label}: stated order -- ${ordering.length ? ordering.map((L) => `${L}) ${OPT[L]}`).join(' > ') : '(none extracted)'}`);
  return { label, query, ok: true, ordering, raw: res };
}

// ─────────────────────────── D-BP153-016: TYPED OWNED PASSAGES, AND VERIFY-THE-SPAN ───────────────────────────
//
// D-BP153-016/BISHOP/seg-classify-016. THE MEASURED FAILURE (live run 2026-08-12T20:39Z, receipt
// LIANA_RUN_qid98_2026-08-12T20-39-01-893Z.json). All three owned-evidence extractors below ran from
// OWNED EVIDENCE with zero queries and produced nonsense: establishFrame() excluded a real cluster
// member, extractNamedSetMembers() returned "Amazon Rainforest" as a member of the world's most
// densely populated regions, and the source of that value was the AMBIGUITY passage -- acquired to
// answer "what is ambiguous here", and by construction full of counterfactuals:
//   "If 'populated' is interpreted ecologically, the Amazon Rainforest flips from being one of the
//   least human-populated regions to one of the most densely populated places on Earth..."
// appearsIn() passed it because the words "Amazon Rainforest" literally appear in that sentence.
// Presence is not assertion. The OTHER owned passage that run held was 197 characters of Gemini UI
// chrome ("Interpreting the Prompt Gemini said Answer now Thinking...") -- a passage naming NONE of
// the options at all, mined anyway.
//
// FD-BP153-07 (RULINGS_BP153.md), THE RULING, THREE FIXES:
//   FIX 1 -- TYPE THE PASSAGES. `OwnedPassage.kind` (method_registry.ts) names WHAT QUESTION a
//   passage was acquired to answer. An ambiguity passage may never source a claim about what IS --
//   it exists to enumerate ALTERNATIVE meanings, and is rejected outright, before extraction is even
//   attempted.
//   FIX 2 -- VERIFY THE SPAN, NOT THE STRING. Every extraction that yields option letters (or a
//   discriminator kind) must also return, per value, the verbatim SUPPORTING SPAN it was read from.
//   The span must appear VERBATIM in the source passage (whitespace normalized only -- never fuzzy)
//   AND must contain the value. A value with no span, or an unverifiable span, is DISCARDED and the
//   discard is COUNTED and reported in a note. This REPLACES bare appearsIn(passage, value) as the
//   sufficiency test -- appearsIn() is still run (against the span, and the passage), but presence
//   alone is no longer enough.
//   FIX 3 -- REJECT A PASSAGE THAT CANNOT SOURCE THE CLAIM. A passage naming NONE of the option
//   labels this extraction is about cannot state anything about them. Mechanical (appearsIn() over
//   the whole label set, the SAME choke point every other check in this file already uses), never a
//   word list.
//
// THE ONE TEST FOR ANY RULE HERE (Founder, BP153, FD-BP153-06, verbatim): "would this rule survive
// on a question whose answer we do NOT know?" Both fixes below are pure structural checks -- WHICH
// KIND a passage carries, WHETHER a span is verbatim, WHETHER a passage names any option at all --
// none of them read input.correctAnswer, and none of them can be tuned toward a particular letter.

/** FIX 1. Owned-passage kinds no extractor in this file may EVER accept as a source. An ambiguity
 *  passage exists to enumerate alternative meanings; it is, by construction, full of counterfactuals
 *  ("if X is interpreted as Y, then..."), and a claim about what IS may never be sourced from one.
 *  Named here once so establishFrame(), extractNamedSetMembers(), and runDiscriminator() all reject
 *  the identical set, never three separately-worded copies that could drift. */
const REJECTED_OWNED_PASSAGE_KINDS = new Set<string>(['ambiguity']);

/** FIX 3, mechanical, general -- NOT a word list. A passage that names NONE of the option labels
 *  this extraction is about cannot state anything about them (the measured case: 197 characters of
 *  Gemini UI chrome, naming no option at all, mined anyway). Reuses appearsIn(), the SAME check
 *  every extracted value in this file is already verified against. */
function passageMentionsAnyLabel(passage: string, labels: string[], OPT: Record<string, string>): boolean {
  return labels.some((L) => appearsIn(passage, OPT[L]));
}

/** D-BP154-001/BISHOP/seg-invaliddraw -- a short, verbatim preview of a passage for a DISCARD note
 *  (THE RULE, rule 5: "say every discard out loud... a passage preview. A silent discard is
 *  indistinguishable from a draw that never happened."). Truncation only, never a summary or a
 *  rewrite -- the same "verbatim, whitespace-normalized-only" discipline normalizeSpanWhitespace()
 *  already uses for a supporting span, applied here to a note instead of an extraction. */
function passagePreview(passage: string, maxLen = 160): string {
  const norm = normalizeSpanWhitespace(passage);
  return norm.length > maxLen ? `${norm.slice(0, maxLen)}...` : norm;
}

/** FIX 1 + FIX 3, the SHARED CHOKE POINT. establishFrame(), extractNamedSetMembers(), and
 *  runDiscriminator() all filter their `ownedPassages()` accessor through this ONE function before
 *  trying anything else. Every rejection is noted (never silent); an owned passage that is empty or
 *  whitespace-only is dropped exactly as before this ticket (D-BP153-010's own rule, unchanged --
 *  that is a different fact than a wrong-kind or label-less passage, so it is not itself noted
 *  here, matching every pre-existing call site's own `.filter((p) => !!p && !!p.trim())` idiom). */
function filterUsableOwnedPassages(
  owned: OwnedPassage[],
  labels: string[],
  OPT: Record<string, string>,
  stageLabel: string,
  note: (text: string) => void,
): OwnedPassage[] {
  const out: OwnedPassage[] = [];
  for (const p of owned) {
    if (!p || !p.text || !p.text.trim()) continue;
    if (REJECTED_OWNED_PASSAGE_KINDS.has(p.kind)) {
      note(
        `   ${stageLabel}: REJECTED an owned passage of kind '${p.kind}' -- an ambiguity passage `
          + 'enumerates ALTERNATIVE meanings and may never source a claim about what IS (FD-BP153-07 FIX 1)',
      );
      continue;
    }
    if (!passageMentionsAnyLabel(p.text, labels, OPT)) {
      note(
        `   ${stageLabel}: REJECTED an owned passage of kind '${p.kind}' -- it names NONE of the `
          + 'option(s) under test and cannot source a claim about them (FD-BP153-07 FIX 3)',
      );
      continue;
    }
    out.push(p);
  }
  return out;
}

/** FIX 2. Whitespace-only normalization -- collapse runs of whitespace to one space and trim,
 *  nothing else. Deliberately NOT norm() (comparative_cascade.ts), which also lowercases and strips
 *  punctuation -- that looseness is exactly what let "Amazon Rainforest" pass BUG-016's real
 *  failure by bare presence. "Verbatim" means verbatim; case and punctuation are preserved. */
function normalizeSpanWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** FIX 2. THE FOUNDER'S RULING, BP153, verbatim: "the span must appear VERBATIM in the source
 *  passage (normalize whitespace only -- do not fuzzy match)". Exported so this ticket's own tests
 *  can exercise it directly. */
export function spanIsVerbatim(passage: string, span: string): boolean {
  const s = normalizeSpanWhitespace(span);
  if (!s) return false;
  return normalizeSpanWhitespace(passage).includes(s);
}

/** One raw `{name, span}` (or `{name, kind, span}`) entry as a model may return it -- untyped on
 *  purpose, this is exactly the shape gemmaExtract()'s JSON parse hands back before anything here
 *  has verified a single field of it. */
type RawSpannedEntry = { name?: unknown; span?: unknown };

/** FIX 2, THE SHARED VERIFY-THE-SPAN CHOKE POINT. Reads a list of `{name, span}` entries out of a
 *  model's JSON, and accepts a value ONLY when ALL of: (a) a non-empty `name` was given, (b) a
 *  non-empty `span` was given (D-BP153-016 test 4: no span -> discard), (c) that span is VERBATIM in
 *  `passage` per spanIsVerbatim() above (test 3: an unverifiable span -> discard), and (d) the span
 *  itself contains the named value (appearsIn(span, name) -- the span must actually be ABOUT this
 *  value, not merely some other verbatim sentence). Every failure of (b)/(c)/(d) is a DISCARD, and
 *  the caller is handed the count so it can note it (FIX 2: "the discard is COUNTED and reported in
 *  a note"). `name` is then mapped to a known option letter by toLetters()'s own exact-match
 *  discipline (HARDWIRE-22: similarity is not identity) -- a `name` that names no known option is
 *  simply not a match (not a "discard": nothing here was ever a candidate value to begin with). */
function extractSpannedLetters(
  raw: unknown,
  passage: string,
  OPT: Record<string, string>,
): { letters: string[]; spans: Record<string, string>; discarded: number } {
  const entries = Array.isArray(raw) ? (raw as RawSpannedEntry[]) : [];
  const letters: string[] = [];
  const spans: Record<string, string> = {};
  let discarded = 0;
  for (const entry of entries) {
    const name = typeof entry?.name === 'string' ? entry.name.trim() : '';
    const span = typeof entry?.span === 'string' ? entry.span.trim() : '';
    if (!name) continue; // nothing named at all -- not a value to discard, just an empty entry
    if (!span || !spanIsVerbatim(passage, span) || !appearsIn(span, name)) {
      discarded++;
      continue;
    }
    const matched = toLetters([name], OPT);
    for (const L of matched) {
      letters.push(L);
      spans[L] = span;
    }
  }
  return { letters: [...new Set(letters)], spans, discarded };
}

// ─────────────────────────── D-BP153-018: A PROPERTY SPAN IS NOT A MEMBERSHIP SPAN ───────────────────────────
//
// D-BP153-018/BISHOP/seg-classify-018. THE MEASURED FAILURE (live run 2026-08-12T22:32Z, receipt
// LIANA_RUN_qid98_2026-08-12T22-32-08-512Z.json). THE SOFTBALLS (establishFrame(), QUESTION 1 --
// "what IS a legitimate world region?") extracted its exclusion set from this sentence:
//   "Options A, C, F, G, H, I are all NOT considered among the world's most densely populated
//   regions."
// That sentence answers QUESTION 2 (THE NAMED SET -- "which options SCORE as densely populated?"),
// not QUESTION 1. Both questions returned the SAME set, legitimate-regions MINUS named-set-members
// left ZERO, and the run fell through to the magnitude route and burned 53 queries.
//
// THE RULE, Founder's own diagnosis: a span that asserts the SUPERLATIVE PROPERTY is not evidence
// about CATEGORY MEMBERSHIP. A span stating how a thing SCORES on a property may never answer what
// a thing IS.
//
// MECHANICAL, NOT A WORD LIST. `property` is the literal string extractSuperlativeMatch() already
// read off the question's own grammar (SUPERLATIVE_PROPERTY_RE) -- for qid 98, "densely populated",
// verbatim. This check is a case-insensitive, whitespace-normalized substring test of THAT string
// against a value's own verified supporting span (D-BP153-016's span, already verbatim-checked
// above) -- nothing here reads input.correctAnswer, and nothing here can be tuned toward a
// particular letter. Satisfies FD-BP153-06: "would this rule survive on a question whose answer we
// do not know?" Yes -- it fires on the SHAPE of the span, never its content's relation to any key.
function normalizePropertyForMatch(property: string): string {
  return normalizeSpanWhitespace(property).toLowerCase();
}

/** THE HARD RULE, establishFrame() ONLY. Given a span-verified {letters, spans} extraction (either
 *  direction -- the direct exclusion read or its complement, both are claims about CATEGORY
 *  MEMBERSHIP), DISCARD any value whose own supporting span contains the superlative property
 *  string. `property` empty/blank (no superlative in play, or a caller that predates this ticket)
 *  is a no-op -- nothing to check a span against, so every pre-existing call site that never passed
 *  a property keeps behaving exactly as it did before this ticket. Every discard is counted AND
 *  noted individually, naming the option and quoting the offending span (never silent). */
function discardPropertyContaminatedSpans(
  entry: { letters: string[]; spans: Record<string, string> },
  property: string,
  OPT: Record<string, string>,
  note: (text: string) => void,
  label: string,
): { letters: string[]; spans: Record<string, string>; discardedCount: number } {
  const propNorm = normalizePropertyForMatch(property);
  if (!propNorm) return { letters: entry.letters, spans: entry.spans, discardedCount: 0 };
  const letters: string[] = [];
  const spans: Record<string, string> = {};
  let discardedCount = 0;
  for (const L of entry.letters) {
    const span = entry.spans[L] ?? '';
    if (normalizeSpanWhitespace(span).toLowerCase().includes(propNorm)) {
      discardedCount++;
      note(
        `   ${label}: DISCARDED ${L}) ${OPT[L]} (D-BP153-018) -- its supporting span asserts the `
          + `SUPERLATIVE PROPERTY ("${property}"), not category membership: "${span}"`,
      );
    } else {
      letters.push(L);
      spans[L] = span;
    }
  }
  return { letters, spans, discardedCount };
}

/** THE SYMMETRIC CHECK, extractNamedSetMembers() ONLY -- REPORT, NEVER ENFORCE. A named-set
 *  member's span SHOULD be about the property (QUESTION 2 is literally "which options ARE
 *  `property`"), but a source may state membership without repeating the property phrase verbatim
 *  (e.g. "Only B, D, and E qualify" immediately after the property was named in the prior
 *  sentence) -- rejecting on that basis would manufacture exactly the kind of confident-wrong
 *  elimination D-BP153-018 exists to close, on the OTHER side. This only counts and notes, so a
 *  future run can measure whether the signal is worth enforcing (ticket's own words: "report, do
 *  not enforce"). Never mutates the member list this was handed. */
function reportMembersMissingProperty(
  entry: { letters: string[]; spans: Record<string, string> },
  property: string,
  OPT: Record<string, string>,
  note: (text: string) => void,
): void {
  const propNorm = normalizePropertyForMatch(property);
  if (!propNorm) return;
  const missing = entry.letters.filter((L) => !normalizeSpanWhitespace(entry.spans[L] ?? '').toLowerCase().includes(propNorm));
  if (missing.length) {
    note(
      `   NAMED SET (D-BP153-018, symmetric check, REPORT ONLY, not enforced): ${missing.length} `
        + `member span(s) do not mention the property ("${property}") -- `
        + `${missing.map((L) => `${L}) ${OPT[L]}`).join(', ')} -- counted, not rejected`,
    );
  }
}

export interface FrameResult {
  /** False = the authority gave no usable answer. Per FD-BP153-01 consequence 2 this ABSTAINS;
   *  it never falls back to ranking the unframed pool. */
  available: boolean;
  /** D-BP153-032: option letters whose STATED KIND (extractFrameKinds(), applyFrameKindElimination(),
   *  both above) differs from the STATED category kind -- pure per-option comparison in code, never
   *  a model judgment call (HARDWIRE-22). An option with no stated kind at all is in NEITHER
   *  `excluded` nor `included` (D-BP153-029's rule: never guessed, and never discarded from the
   *  options that WERE stated merely because some other option was not). May be empty, which is a
   *  valid frame meaning "the stated category kind excludes nothing among what was stated" -- NOT
   *  the same as unavailable (see `available`, above: unavailable means no category kind was ever
   *  stated at all, a categorically different fact from "stated, and it excludes nothing"). */
  excluded: string[];
  /** D-BP153-032: option letters whose STATED KIND matches the STATED category kind -- the other
   *  side of the same per-option comparison that produces `excluded`. Empty when no option's stated
   *  kind matches (or nothing was stated). RETIRED, D-BP153-017's own two-independent-extractions
   *  "doublecheck" reading of this field (ask both directions, reconcile) -- THE SOFTBALLS now read
   *  a single stated kind per option, which is single-valued by construction, so `included` is
   *  simply the complement of `excluded` within "options with a stated kind", never a second,
   *  independently-extracted direction. D-BP153-017 remains fully live for THE NAMED SET, below. */
  included: string[];
  /** RETIRED, D-BP153-032: a stated kind is single-valued (it either matches the stated category
   *  kind, differs from it, or is unstated), so there is no longer a shape in which THE SOFTBALLS'
   *  own extraction could name an option on both sides at once. Always empty from establishFrame()
   *  from this ticket forward; kept on the interface only because NamedSetResult (below, UNTOUCHED
   *  by this ticket) still has a live, non-empty `conflicts` of its own and callers that read both
   *  result types generically should not need a type-level special case for FrameResult alone. */
  conflicts: string[];
  /** True when EVERY option in `all` has a STATED KIND (D-BP153-032) -- i.e. `unaccounted`
   *  (applyFrameKindElimination()'s own field, above) is empty. Independent of whether a category
   *  kind was ever stated (`available`, above, is the field that tracks that): a frame can have
   *  complete per-option coverage and still be unavailable, if nothing ever stated which of those
   *  kinds counts. */
  partitionComplete: boolean;
  /** Plain-English rendering of the reconciliation arithmetic -- mirrors
   *  NamedSetResult.reconciliationWhy, so a reader can audit this result without re-running
   *  anything. */
  reconciliationWhy: string;
  query: string;
  via: string;
  /** FD-BP153-04 -- THE RECEIPT SAYS WHICH. "A saved query invisible in the transcript is
   *  indistinguishable from a query that was never needed." 'owned-passage' when the frame
   *  partition was extracted from a passage this run had already acquired, with NO new query
   *  issued; 'new-query' when no owned passage contained it and establishFrame() fell through to
   *  its existing googleBlocks() call, unchanged. */
  answeredFrom: 'owned-passage' | 'new-query';
  /** Index into the caller's ownedPassages() array that answered the frame, when answeredFrom is
   *  'owned-passage'; null on 'new-query'. */
  ownedPassageIndex: number | null;
  /** D-BP153-031, ADDITIVE/OPTIONAL -- undefined on an owned-passage answer (zero draws spent,
   *  never multiplied) and on every call site that predates this ticket's own repeated-draw wiring.
   *  On a fresh-query answer, the LB_DRAW_REPEATS value actually in effect this call and how many
   *  independent draws THE SOFTBALLS' base question actually issued. D-BP154-001: `drawsIssued` can
   *  now EXCEED `drawRepeats` -- an INVALID draw (passage names none of the options) is replaced,
   *  under a cap, so `drawsIssued` counts every attempt (valid and invalid, including replacements),
   *  never only the `drawRepeats` target. See drawWithAgreement() above. */
  drawRepeats?: number;
  drawsIssued?: number;
}

// ─────────────────────────── D-BP153-032: THE SOFTBALLS, STATED KIND -- NEVER STATED MEMBERSHIP ───────────────────────────
//
// D-BP153-032/BISHOP/seg-classify-032, A HARDWIRE-22 VIOLATION CLOSED. THE MEASURED PROOF (repeated
// draws, D-BP153-031): run LIANA_RUN_qid98_2026-08-13T12-25-35-888Z.json issued THE SOFTBALLS' base
// query twice against ESSENTIALLY IDENTICAL source text (both draws on record, quoted verbatim in
// this ticket's own dispatch) and got wildly different extractions:
//   draw 1 -> excludes {A,B,C,D,E,F,G,H,I}   (all nine)
//   draw 2 -> excludes {G,H,I}
// ~0% source variance produced ~100% extraction variance.
//
// ROOT CAUSE. frameExtractionInstruction()/frameComplementExtractionInstruction() (RETIRED by this
// ticket -- were here, immediately above establishFrame(), before this section) asked the LOCAL
// MODEL which options ARE/are NOT `category`. The passage states KINDS ("Continent", "Geopolitical
// Subregion", "Parallel of Latitude", ...), never membership directly -- to answer "is Geopolitical
// Subregion a world region?" gemma had to DECIDE whether that kind counts. THAT IS JUDGMENT
// (HARDWIRE-22 forbids delegating it to a local model), and it decided differently every call.
//
// THE FIX. THE DISCRIMINATOR (extractDiscriminatorKinds()/applyDiscriminatorElimination(), STAGE D,
// further below) already asks the RIGHT question, over a narrowed candidate set: copy out the
// STATED KIND per name, and separately the STATED category denotation, then compare the two IN PURE
// CODE -- copying is extraction; deciding membership from a judgment call is not. THE SOFTBALLS now
// ask the IDENTICAL question over the FULL option list, reusing extractDiscriminatorKinds() ITSELF
// (unmodified logic; this ticket's own change to it, above that function's own header, only ADDS the
// verbatim spans to its return so D-BP153-018's property-span discard, below, can run over a
// stated-kind read exactly as it already ran over the retired exclusion/inclusion reads) -- one
// extraction mechanism, not two that could drift (D-BP153-020's own "one mechanism" discipline,
// restated here for a THIRD caller of the identical extractor). discriminatorExtractionInstruction()
// and DISCRIMINATOR_EXTRACTION_SHAPE (STAGE D, further below) are reused BYTE-IDENTICAL, not copied.
//
// available:false ONLY when NO categoryKind is ever stated, ANYWHERE this function looks (Founder,
// this ticket, verbatim): "NO stated category denotation -> the frame is UNAVAILABLE (no
// exclusions)... Do NOT guess which kind counts." A categoryKind that IS stated but some OTHER
// option's own kind never is does NOT make the frame unavailable -- D-BP153-029's own rule ("a
// directly stated exclusion is never discarded merely because some OTHER option went unaccounted
// for"), restated here for kind-comparison: an option with no stated kind is left UNACCOUNTED
// (excluded from neither list), never guessed either way. See applyFrameKindElimination(), below,
// for the pure-code arithmetic this produces, and establishFrame() (immediately below it) for how
// owned evidence / a fresh query / the D-BP153-026 completion follow-up feed it.
//
// D-BP153-017 ("THE DOUBLECHECK", ask both directions, require agreement WITHIN one passage) is
// SUPERSEDED for THE SOFTBALLS by this ticket -- there is only one direction now (a stated kind is
// single-valued: it either matches categoryKind, differs from it, or is unstated; it cannot be
// "both"), so FrameResult.conflicts is always empty from this function from here on. D-BP153-017
// remains fully enforced for THE NAMED SET (extractNamedSetMembers(), further below, UNTOUCHED by
// this ticket) -- that function still asks both directions and reconciles them; only THE SOFTBALLS'
// own QUESTION 1 changes here. D-BP153-031's REPEATED-DRAW wrapper (drawWithAgreement(), above) is
// UNRELAXED and is exactly how this ticket's own measured failure is closed: the EXTRACTED RESULT
// SET (kinds + categoryKind) must still agree byte-for-byte across independent draws before anything
// downstream trusts it -- what changes is that the SAME passage now yields the SAME extraction every
// time (pure copying is deterministic; judgment was not), so agreement is no longer a matter of luck.

/** ONE passage, THE SOFTBALLS' own stated-kind read. Reuses extractDiscriminatorKinds() (STAGE D,
 *  further below) UNCHANGED as the extraction mechanism -- see this section's own header for why --
 *  then applies D-BP153-018's property-span discard to the KIND reads exactly as it already applied
 *  to the retired direct/complement reads: a span asserting the SUPERLATIVE PROPERTY is not evidence
 *  of a stated KIND either, same rule, same reason, now guarding a different extraction shape. The
 *  category-kind span is checked the same way, inline (discardPropertyContaminatedSpans() is keyed
 *  by option letter via `OPT`, which the category-kind claim -- not itself an option -- does not
 *  have, so this is the smallest equivalent check, not a second parallel mechanism). */
async function extractFrameKinds(
  passage: string,
  names: string[],
  OPT: Record<string, string>,
  category: string,
  property: string,
  note: (text: string) => void,
): Promise<{ kinds: Record<string, string | null>; categoryKind: string | null; discarded: number }> {
  const {
    kinds: rawKinds, kindSpans, categoryKind: rawCategoryKind, categoryKindSpan, discarded: spanDiscarded, truncated,
  } = await extractDiscriminatorKinds(passage, names, OPT, category);

  // D-BP153-034 -- TRUNCATION IS NAMED, NEVER SILENT. When the model hits its token ceiling the
  // JSON is cut mid-object, the parse fails, and every kind arrives null -- byte-identical to "the
  // passage stated nothing". That conflation cost this campaign a full session: the extractor was
  // working, the passage was perfect, and the receipt read `kinds {A:null ... I:null}`.
  // MEASURED at D-BP153-034: num_predict 512 stopped at eval_count 512 with done_reason=length on
  // the real qid 98 frame passage, 68 tokens short of the 580 the same read needs.
  if (truncated) {
    note(
      '   FRAME / QUESTION 1 (stated-kind read): THE MODEL HIT ITS TOKEN CEILING (done_reason=length, '
        + 'D-BP153-034) -- the JSON was cut off mid-object and could not be parsed, so every kind below '
        + 'reads as null. THIS IS A TRUNCATED READ, NOT AN EMPTY PASSAGE. The passage may state every '
        + 'kind perfectly; we simply could not finish reading it. Do NOT interpret the nulls as the '
        + 'source having said nothing.',
    );
  }

  const kindEntry = { letters: names.filter((L) => rawKinds[L] != null), spans: kindSpans };
  const kindFiltered = discardPropertyContaminatedSpans(kindEntry, property, OPT, note, 'FRAME / QUESTION 1 (stated-kind read)');
  const kinds: Record<string, string | null> = { ...rawKinds };
  for (const L of kindEntry.letters) {
    if (!kindFiltered.letters.includes(L)) kinds[L] = null; // discarded as a property span, D-BP153-018
  }

  let categoryKind = rawCategoryKind;
  let categoryDiscarded = 0;
  const propNorm = normalizePropertyForMatch(property);
  if (categoryKind && categoryKindSpan && propNorm
    && normalizeSpanWhitespace(categoryKindSpan).toLowerCase().includes(propNorm)) {
    note(
      `   FRAME / QUESTION 1 (category-kind read): DISCARDED the stated category kind ("${categoryKind}") `
        + `(D-BP153-018) -- its supporting span asserts the SUPERLATIVE PROPERTY ("${property}"), not `
        + `category membership: "${categoryKindSpan}"`,
    );
    categoryKind = null;
    categoryDiscarded = 1;
  }

  return { kinds, categoryKind, discarded: spanDiscarded + kindFiltered.discardedCount + categoryDiscarded };
}

export interface FrameKindElimination {
  excluded: string[];
  included: string[];
  /** Option letters with no stated kind (either never extracted, or discarded, D-BP153-018) --
   *  neither excluded nor included, never guessed. */
  unaccounted: string[];
  why: string;
}

/** Pure set arithmetic, no I/O -- mirrors applyDiscriminatorElimination()'s (STAGE D, further below)
 *  own discipline DELIBERATELY, but is NOT a call to it: THE DISCRIMINATOR refuses to eliminate
 *  ANYTHING when even one candidate lacks a stated kind (its own condition (a), "partial information
 *  does not eliminate") -- an all-or-nothing gate that fits a narrowed few-candidate set fed by a
 *  single targeted query. THE SOFTBALLS run over the FULL option list, where D-BP153-029's own rule
 *  already governs the identical shape of gap ("a directly stated exclusion is never discarded
 *  merely because some OTHER option went unaccounted for") -- so this applies the SAME per-option
 *  comparison WITHOUT that all-or-nothing gate: every option whose own kind IS known is judged on
 *  its own merits, and an option with no stated kind is left UNACCOUNTED, in neither list, never
 *  guessed (HARDWIRE-22 unrelaxed). This is "the smallest equivalent", commented as deliberately
 *  mirroring applyDiscriminatorElimination() rather than reusing it, per this ticket's own
 *  instruction (reuse it if it generalizes; it does not, for the reason just given).
 *
 *  `categoryKind === null` is the ONE case this refuses ENTIRELY (Founder, this ticket, verbatim):
 *  "NO stated category denotation -> the frame is UNAVAILABLE (no exclusions)... Do NOT guess which
 *  kind counts." establishFrame() (below) reads that as FrameResult.available:false -- the frame's
 *  own `available` flag has no analog in DiscriminatorResult (STAGE D never marks itself
 *  unavailable; it always names survivors), which is exactly why this is a separate function rather
 *  than a shared one. */
export function applyFrameKindElimination(
  all: string[],
  kinds: Record<string, string | null>,
  categoryKind: string | null,
  category: string,
  OPT: Record<string, string>,
): FrameKindElimination {
  const label = (Ls: string[]) => `{${Ls.map((L) => `${L}) ${OPT[L]}`).join(', ') || 'none'}}`;
  if (!categoryKind) {
    return {
      excluded: [],
      included: [],
      unaccounted: all,
      why: `the passage does not state which kind properly denotes "${category}" -- FRAME UNAVAILABLE, `
        + 'no exclusions performed (HARDWIRE-22: never guess which kind counts)',
    };
  }
  const excluded = all.filter((L) => kinds[L] != null && kinds[L] !== categoryKind);
  const included = all.filter((L) => kinds[L] === categoryKind);
  const unaccounted = all.filter((L) => kinds[L] == null);
  const why = `stated category kind "${categoryKind}" (per the source) excludes ${label(excluded)}, keeps `
    + `${label(included)}${unaccounted.length ? `, and leaves ${label(unaccounted)} UNACCOUNTED (no stated kind -- never guessed)` : ''}`;
  return {
    excluded, included, unaccounted, why,
  };
}

// ─────────────────────────── D-BP153-024: CONVERSATIONAL AUTHORITY FIRST, THEN GOOGLE ───────────────────────────
//
// THE MEASURED FAILURE THIS CLOSES (receipt LIANA_RUN_qid98_2026-08-13T02-29-52-712Z.json). THE
// SOFTBALLS' reworded frame query (D-BP153-021/023, above) was finally issued, and went straight to
// askGoogle: "nobox+organic(5)" -- a page of organic web-search links -- which named none of the
// nine options under test, so the frame correctly refused ("the frame is UNAVAILABLE, not 'nothing
// excluded'") rather than guess. In the SAME run, the operation meta-question (survey_stage.ts's own
// askOperation(), which already tries `ctx.askConversationalAuthority` first via
// obtainMetaQuestionPassage()) went to `user_gemini` and returned usable prose. THE SOFTBALLS/THE
// NAMED SET/THE DISCRIMINATOR (establishFrame()/extractNamedSetMembers()/runDiscriminator(), below
// and further down this file) are the SAME SHAPE OF ASK survey_stage.ts's two meta-questions already
// are -- a CONVERSATIONAL, structured, per-item accounting across every option -- exactly what a
// page of search-result links cannot answer and a conversational authority reliably can.
//
// obtainCascadePassage(), immediately below, gives all three functions the SAME
// try-conversational-then-fall-back-to-Google behavior survey_stage.ts's own
// obtainMetaQuestionPassage() already established for the ambiguity/operation meta-questions -- see
// this function's own header for exactly why it is a mirror, not a re-export, of that one.

/**
 * MIRRORS survey_stage.ts's own obtainMetaQuestionPassage() DELIBERATELY -- same
 * try-conversational-then-fall-back-to-Google shape, same reason -- named here specifically so the
 * two do not silently drift if either one changes. NOT a re-export: obtainMetaQuestionPassage() is
 * module-private to survey_stage.ts, takes a full `MethodRunContext` plus a fixed
 * 'ambiguity'|'operation' label, and calls `ctx.emit` directly with a structured
 * LianaTerminalEvent. establishFrame()/extractNamedSetMembers()/runDiscriminator() already take a
 * bare `askGoogle: MethodRunContext['askGoogle']` function and a bare `note: (text: string) => void`
 * closure, not a full ctx -- reshaping all three signatures to carry a ctx just to reuse that
 * function would be a bigger change than this ticket authorizes ("route... through the same
 * try-conversational-then-fall-back-to-Google behavior", not "restructure the three functions").
 *
 * `askConversationalAuthority` is OPTIONAL, same contract as `MethodRunContext.
 * askConversationalAuthority` itself (method_registry.ts) -- undefined for every caller that does
 * not thread it, so this goes straight to `googleBlocks()`, BYTE-IDENTICAL to this file's own
 * behavior before this ticket. ANY non-ok conversational result (window not open, operator visibly
 * using it, ceiling reached with no text, any other refusal) falls back to `googleBlocks()`,
 * UNCHANGED -- never hangs the run, never silently swaps the other direction.
 *
 * Returns a GoogleAnswer-COMPATIBLE shape so every one of the three call sites below needed no edit
 * beyond the single line that acquires `res` -- `res.ok`/`res.text`/`res.via` are the only fields
 * any of the three functions reads (verified by reading every `res.` use in
 * establishFrame()/extractNamedSetMembers()/runDiscriminator() before writing this).
 *
 * Law 5 (HARDWIRE-23), "the receipt says which": on the conversational branch, `via` is tagged with
 * the answering authority's own name (`answered by ${convo.authority}` -- e.g. "answered by
 * user_gemini") so every existing `${res.via}`-interpolating note/basis string downstream (already
 * written, untouched by this ticket) names it with no further edit at those call sites. On the
 * Google branch `via` is returned EXACTLY as `googleBlocks()` produced it (e.g. "nobox+organic(5)")
 * -- unchanged, because that string already names Google by its own existing convention (same rule
 * obtainMetaQuestionPassage()'s own header states: "the Google via-string", not a second tag).
 */
async function obtainCascadePassage(
  askGoogle: MethodRunContext['askGoogle'],
  askConversationalAuthority: MethodRunContext['askConversationalAuthority'],
  label: string,
  query: string,
  note: (text: string) => void,
): Promise<GoogleAnswer> {
  if (askConversationalAuthority) {
    note(`   ${label}: query SENT to conversational authority (untruncated, verbatim)="${query}"`);
    const convo = await askConversationalAuthority(query);
    if (convo.ok && convo.text.trim()) {
      note(
        `   ${label}: ANSWERED BY: ${convo.authority} (${convo.via}) -- a conversational authority, `
          + 'not Google web search',
      );
      return {
        ok: true, text: convo.text, via: `${convo.via} (answered by ${convo.authority})`, blocks: [], sources: convo.citations,
      };
    }
    note(
      `   ${label}: conversational authority UNAVAILABLE (${convo.via}) -- falling back to Google `
        + "(never hijack the operator's window, never hang the run)",
    );
  } else {
    note(`   ${label}: no conversational authority is wired for this call -- falling back to Google`);
  }
  note(`   ${label}: query SENT to Google (untruncated, verbatim)="${query}"`);
  return googleBlocks(askGoogle, query);
}

// ─────────────────────────── D-BP153-026: THE COMPLETION FOLLOW-UP ───────────────────────────
//
// THE MEASURED FAILURE THIS CLOSES (live run, receipt LIANA_RUN_qid98_2026-08-13T02-58-52-307Z.json).
// THE SOFTBALLS' fresh query finally reached user_gemini (D-BP153-024) and got a real, on-topic
// answer -- but only for SEVEN of the nine options:
//   FRAME: direct extraction excludes D) Northeast United States, G) Arctic Circle, H) Amazon
//          Rainforest, I) Sahara Desert, complement states B) South Asia, C) North Africa,
//          F) Central Asia
//   FRAME RECONCILIATION: INCOMPLETE PARTITION -- {A) South America, E) Europe} unaccounted for
//   FRAME: 0 option(s) are not world regions -- (none); 9 of 9 remain in frame
// D-BP153-020's own gate correctly refused to trust a partial answer -- that gate is UNRELAXED by
// this ticket -- but the run then just gave up on those two options entirely, even though the
// question itself said "Answer for every one, in order, and do not skip any." A person reading a
// seven-of-nine answer asks about the other two. Nothing here did.
//
// THE RULE (Founder, BP153, verbatim in this ticket's own dispatch): "When a partition comes back
// INCOMPLETE from a fresh query, ask ONE targeted follow-up naming ONLY the unaccounted-for
// options, then reconcile again." AT MOST ONE follow-up per question -- never a loop, never one
// query per missing option -- and it fires ONLY after a FRESH query came back incomplete, never on
// an owned-passage read (those already fall through to the next owned passage, then to the fresh
// query, unchanged -- D-BP153-023's own rule, untouched here) and never a second time on its own
// output (if the follow-up is ALSO incomplete, the existing safety net stands: zero exclusions,
// the still-unaccounted options are named, the run proceeds).
//
// issueCompletionFollowUp(), below, is the ONE shared implementation establishFrame() and
// extractNamedSetMembers() both call (never a second, parallel one) -- it composes the targeted
// query, routes it through the SAME obtainCascadePassage() every other query in this file already
// uses (conversational authority first, Google fallback -- never a third path), and hands the
// returned passage back to the CALLER's own already-audited extractor (extractFrameBothSides() /
// extractNamedSetBothSides(), unmodified) so every existing guard -- span verification, the
// D-BP153-018 property-span discard, typed passages, appearsIn -- applies to the follow-up's own
// extraction exactly as it does to the first pass. This function decides nothing (HARDWIRE-22
// unrelaxed): it only fetches one more passage and reports whether it was usable.
//
// The caller (establishFrame() / extractNamedSetMembers()) is the one that UNIONS the follow-up's
// raw direct/complement reads with the first pass's own raw reads and re-applies
// reconcileNamedSet() to the union -- see each call site's own D-BP153-026 comment for that
// arithmetic. The first pass's own reads are never discarded, only added to.
//
// D-BP153-027 ADDS a second trigger for this SAME follow-up, below (complementSilentAndPartial()) --
// see that function's own header for the measured gap it closes. `reason`, added to this function's
// signature by that ticket, names WHICH of the two triggers fired, so the transcript can tell them
// apart (both share this one mechanism, unchanged).
async function issueCompletionFollowUp(
  label: string,
  reason: string,
  buildQuery: (namesList: string) => string,
  uncovered: string[],
  all: string[],
  OPT: Record<string, string>,
  askGoogle: MethodRunContext['askGoogle'],
  askConversationalAuthority: MethodRunContext['askConversationalAuthority'] | undefined,
  note: (text: string) => void,
): Promise<{ text: string; via: string } | null> {
  const namesList = list(uncovered, OPT);
  const query = buildQuery(namesList);
  note(
    `   ${label} FOLLOW-UP (D-BP153-026): ${reason} -- the first pass left ${uncovered.length} of `
      + `${all.length} option(s) unaccounted for -- ${namesList} -- issuing ONE targeted follow-up `
      + 'naming ONLY these (AT MOST ONE follow-up per question, never a loop)',
  );
  const res = await obtainCascadePassage(askGoogle, askConversationalAuthority, `${label} FOLLOW-UP`, query, note);
  if (!res.ok || !res.text || !res.text.trim()) {
    note(
      `   ${label} FOLLOW-UP: no usable answer (${res.via}) -- proceeding with the first pass's own `
        + 'reconciliation, unchanged (D-BP153-020\'s safety net still applies)',
    );
    return null;
  }
  if (!passageMentionsAnyLabel(res.text, uncovered, OPT)) {
    note(
      `   ${label} FOLLOW-UP: the source's passage (${res.via}) names NONE of the `
        + `${uncovered.length} still-unaccounted option(s) -- proceeding with the first pass's own `
        + 'reconciliation, unchanged',
    );
    return null;
  }
  note(`   ${label} FOLLOW-UP: ANSWERED BY ${res.via}`);
  return { text: res.text, via: res.via };
}

// ─────────────────────────── D-BP153-027: COMPLEMENT-SILENT, AND PARTIAL ───────────────────────────
//
// THE MEASURED GAP (live run, receipt LIANA_RUN_qid98_2026-08-13T03-29-03-503Z.json). THE NAMED SET's
// fresh query finally reached a real "Only B (South Asia), D (Northeast United States), and E
// (Europe)..." passage, but the complement extraction found nothing to say (no source text of the
// form "X is NOT a member" for this passage), and the direct extraction under-recalled the stated
// list, the SAME gemma weakness namedSetExtractionInstruction()'s own header (D-BP153-014, BUG-1(a))
// already named and only partly closed: {B, E} came back, D was dropped.
//
//   NAMED SET RECONCILIATION: the complement extracted nothing -- no non-members stated in this
//   passage to reconcile against; using the direct member extraction alone
//   MEMBERSHIP TERMINATOR: legitimate-regions {A,B,C,D,E,F} MINUS named-set-members {B,E} leaves 4
//   candidates (A, C, D, F) -- had the named set returned {B, D, E}, the terminator would have
//   handed the discriminator exactly {A, C, F}.
//
// reconcileNamedSet()'s own last branch (above, "the complement extracted nothing... using the
// direct member extraction alone") is CORRECT and is NOT changed here -- a silent complement is not
// evidence of anything, and the direct side is the only stated read there is. What that branch does
// NOT carry is the `incompletePartition` flag D-BP153-026's own gate reads (it structurally cannot:
// there is no complement to be incomplete AGAINST), so a complement-silent-but-under-extracted direct
// read never reached D-BP153-026's follow-up at all.
//
// THE RULE (Founder, BP153, verbatim in this ticket's own dispatch): "A COMPLEMENT-SILENT read whose
// DIRECT side does not account for every option is INCOMPLETE for the purpose of the completion
// follow-up." complementSilentAndPartial(), below, is that test -- and ONLY that test. It changes
// nothing about what reconcileNamedSet() DOES with a complement-silent read (extraction only, never
// an inference from silence -- HARDWIRE-22 unrelaxed); it only tells the two callers
// (establishFrame() / extractNamedSetMembers(), each at their own D-BP153-026 gate) whether THIS
// shape earns the SAME one-shot completion follow-up an INCOMPLETE PARTITION already earns.
//
// GATED ON A NON-EMPTY DIRECT SIDE, DELIBERATELY. "The direct side's stated values do not cover all N
// options" presupposes there ARE stated values -- a direct side that found NOTHING AT ALL (whether
// because the passage is genuinely silent, or because D-BP153-019's property-discard rule (above)
// discarded every candidate) is the PRE-EXISTING "extracted nothing" outcome this file already
// treats as legitimate (D-BP153-010/018/019, all untouched by this ticket) -- not a new partial-list
// case for THIS rule to re-litigate. Gating on `directValues.length > 0` keeps this rule targeted
// exactly at the measured shape (a genuine, non-empty, under-recalled list) and leaves every
// already-settled "nothing extracted" case exactly as it was.
function complementSilentAndPartial(all: string[], directValues: string[], complementValues: string[]): string[] {
  if (complementValues.length > 0 || directValues.length === 0) return [];
  const covered = new Set(directValues);
  return all.filter((L) => !covered.has(L));
}

// ─────────────────────────── D-BP153-031: THE CHANNEL VARIANCE FINDING, REPEATED DRAWS ───────────────────────────
//
// D-BP153-031/BISHOP/seg-repeated-draws. Bishop diagnosed this from FOUR CONSECUTIVE LIVE RUNS, not
// re-diagnosed here. THE MEASURED FAILURE: the SAME question, to the SAME authority, on consecutive
// runs, returned wildly different named sets for qid 98 --
//   run 03-57Z: members {B, E}
//   run 04-55Z: members {B, D, E}   <- correct
//   run 06-40Z: members {C}          <- one member, and the wrong one (North Africa is not a dense
//                                        cluster)
// Receipt LIANA_RUN_qid98_2026-08-13T06-40-53-268Z.json: the membership terminator ran on the single,
// unlucky {C} draw ("legitimate-regions {A..I} MINUS named-set-members {C) North Africa} leaves 8
// candidates") and correctly ABSTAINED on 8 surviving candidates -- sound arithmetic over a noisy
// input. Every fix to date made the DERIVATION sound; none makes the INPUT stable. This section makes
// the input stable by asking more than once and requiring agreement -- it never resolves a
// disagreement itself.
//
// THE RULE, HIS OWN, EXTENDED. FD-BP153-07 ("ask it both directions and require agreement") already
// covers both DIRECTIONS within ONE draw (the member extraction and its complement, over the SAME
// already-fetched passage). It does not cover REPEATED draws -- a second, fully independent fetch of
// the SAME question. This section is that extension, composed with the estate's own noise-floor
// canon ("never cite a single run" -- 44% observed spread on identical zero-change runs): THE SOFTBALLS
// (establishFrame()), THE NAMED SET (extractNamedSetMembers()), and THE DISCRIMINATOR
// (runDiscriminator()) each ask their own BASE question LB_DRAW_REPEATS times, independently, and the
// EXTRACTED RESULT SETS (never the raw prose -- the prose differs every draw by construction) must
// agree byte-for-byte before anything downstream trusts them.
//
// SCOPE, DELIBERATELY NARROW. Repeats apply ONLY to the FRESH-QUERY path of the BASE question. An
// OWNED-EVIDENCE read is a complete answer already sitting in memory from earlier this run, not a
// draw from a noisy channel -- used once, at zero cost, exactly as before this ticket (see each call
// site's own owned-passage loop, untouched). D-BP153-026's completion follow-up is its OWN single
// query, issued only AFTER the base question's repeats already agreed and the agreed result is
// incomplete -- it is never itself repeated (see establishFrame()'s and extractNamedSetMembers()'s
// own "the repeats run FIRST" comment, at each call site, for where this is enforced).
//
// DISAGREEMENT IS A FINDING, NEVER SILENTLY RESOLVED (FD-BP152-21: "ask Google, and also let the
// Cascade apply, as a check on each other" -- two independent draws checking one another is the same
// discipline, and a check that disagrees is a FINDING, not noise to resolve). No intersection, no
// union, no majority vote, no first-draw preference -- any of those would be exactly the
// force-a-winner-from-noise this file's own "no tie-breakers, ever" rule (FD-BP152-19) already
// forbids for criteria and for a named set, applied here to repeated draws of the SAME question. A
// disagreement makes the question UNAVAILABLE -- the identical state a frame/named-set/discriminator
// read that could not be established at all already produces -- so the run abstains or falls through
// exactly as it already does for that state; nothing new is invented for this case.
//
// LB_DRAW_REPEATS, CLAMPED [1, 5], DEFAULT 2. resolveDrawRepeats() reads the environment fresh on
// every call (never cached at module load) so a test can set it per-case. repeats === 1 makes
// drawWithAgreement() below issue exactly ONE draw and emit NONE of its own wrapper note()s --
// byte-identical to this file's own behavior before this ticket, the escape hatch this ticket's own
// spec requires ("a value of 1 must reproduce today's behavior EXACTLY, so the feature can be turned
// off").

/** Reads `LB_DRAW_REPEATS` fresh on every call (never cached), clamped to [1, 5], default 2. A
 *  missing or non-numeric value is the default; a value outside [1, 5] is clamped, never rejected --
 *  an operational dial, not a config the estate wants a run to crash over. */
export function resolveDrawRepeats(): number {
  const raw = process.env.LB_DRAW_REPEATS;
  const parsed = raw === undefined ? NaN : Number.parseInt(raw, 10);
  const repeats = Number.isFinite(parsed) ? parsed : 2;
  return Math.max(1, Math.min(5, repeats));
}

// ─────────────────────────── D-BP154-001: THE INVALID DRAW ───────────────────────────
//
// TICKET_D-BP154-001_THE_INVALID_DRAW.md/BISHOP/seg-invaliddraw. THE RULE, verbatim: "A draw whose
// passage names NONE of the question's options is an INVALID draw, not a disagreeing one. Discard
// it, say so out loud, and take another in its place. It must never veto a good draw." MEASURED on
// HARDWIRE\LEDGER\LIANA_RUNS\LIANA_RUN_qid98_2026-08-13T19-24-50-420Z.json (D-BP153-034,
// commit 1ee72b8d): draw 1 was a failed browser capture ("no option named"); draw 2 was a perfect,
// verbatim-sourced extraction. The pre-existing drawWithAgreement() (above) compared the two
// byte-for-byte and reported a DISAGREEMENT, discarding the good draw along with the bad one -- one
// failed capture vetoed a correct answer. This section closes that.
//
// THE OTHER HALF, THE RULE'S OWN WORDS: "draws that all extract NOTHING are not in agreement.
// Agreement on an empty result is not corroboration." MEASURED on runs 2026-08-13T16-29-46-988Z and
// 2026-08-13T16-59-33-658Z, both `kinds {A:null...I:null}` on EVERY draw -- a passage that DID name
// options (so not an invalid draw by the rule above) but from which nothing was ever extracted. Two
// (or more) such draws agree byte-for-byte on `resultKey` today and are trusted -- false
// corroboration of an uninformative result. `RepeatedDraw.emptyResult` (below) closes this half.
//
// FD-BP153-06 TEST, APPLIED (Founder, BP153, verbatim): "would this rule survive on a question whose
// answer we do not know?" Yes -- both checks are structural (does the passage name ANY option at
// all; did the extraction produce ANY informative value at all), never keyed on WHICH option or
// WHICH value. HARDWIRE-22 UNRELAXED: this never judges, it only classifies a draw as usable or not.

/** D-BP154-001: the cap on REPLACEMENT draws issued to stand in for an INVALID one, named so the
 *  transcript and this file's own tests can cite it. THE RULE's own words: "capped at a small named
 *  constant of TOTAL attempts... the cap is what stops this becoming consensus-shopping -- we are
 *  replacing failed captures, never redrawing until we like the answer." At most this many EXTRA
 *  draws beyond the configured `LB_DRAW_REPEATS` may ever be issued by ONE drawWithAgreement() call;
 *  once exhausted, still-missing valid draws mean the question is a CAPTURE FAILURE, and the run
 *  abstains -- never a widened gate, never a forced pass (WHAT NOT TO DO, this ticket, verbatim). */
export const LB_DRAW_MAX_INVALID_REPLACEMENTS = 2;

/** One independent draw's own outcome. `resultKey` is the CANONICAL, comparable rendering of the
 *  EXTRACTED RESULT SET this draw produced (never the raw passage text -- see this section's own
 *  header); two draws agree iff their `resultKey`s are byte-identical. `resultLabel` is the
 *  human-readable rendering of the same fact, for the transcript. `data` is whatever the caller needs
 *  to proceed when this draw turns out to be the trusted one.
 *
 *  D-BP154-001, ADDITIVE/OPTIONAL: `invalid` marks a FAILED CAPTURE -- the drawOnce() callback
 *  already ran passageMentionsAnyLabel() (D-BP153-016 FIX 3, the SAME predicate, reused, never a
 *  second one) and found the passage names NONE of the question's options. `invalidDetail` is the
 *  transport/authority that answered plus a verbatim passage preview, for the discard note (THE
 *  RULE, rule 5). `emptyResult` marks a draw whose passage DID name options but from which nothing
 *  informative was ever extracted (THE RULE's "other half") -- a draw missing both flags is treated
 *  as an ordinary, comparable draw, exactly as every draw was before this ticket. */
export interface RepeatedDraw<T> {
  resultKey: string;
  resultLabel: string;
  data: T;
  invalid?: boolean;
  invalidDetail?: string;
  emptyResult?: boolean;
}

export interface RepeatedDrawOutcome<T> {
  agreed: boolean;
  /** The (arbitrary, since identical-by-definition-of-`agreed`) first draw, when every draw agreed.
   *  Null on disagreement -- there IS no single trusted draw then; see this section's own header,
   *  "never a first-draw preference" (that rule is about disagreement, where the draws are NOT
   *  identical; here, on agreement, they are, so returning one of them is not a preference). */
  trusted: RepeatedDraw<T> | null;
  /** EVERY draw actually attempted, valid and invalid, INCLUDING replacement draws taken for an
   *  invalid one (D-BP154-001) -- `draws.length` can exceed `repeats` for exactly this reason. Never
   *  filtered; a caller that wants only the draws actually compared reads `trusted`/the disagreement
   *  note, not this array. */
  draws: RepeatedDraw<T>[];
  repeats: number;
  /** D-BP154-001: true iff this outcome is a CAPTURE FAILURE, THE RULE's own distinct third state --
   *  neither a trusted agreement nor a draw-disagreement between two informative draws. Set when
   *  either (a) the replacement cap (`LB_DRAW_MAX_INVALID_REPLACEMENTS`) was exhausted before
   *  `repeats` VALID draws were obtained, or (b) every valid draw obtained extracted NOTHING (THE
   *  RULE's "other half": "agreement on an empty result is not corroboration"). Callers MUST branch
   *  on this before treating `agreed === false` as draw-disagreement -- a capture failure is neither
   *  agreement nor disagreement. */
  captureFailure?: boolean;
  captureFailureReason?: 'all-invalid' | 'all-empty';
}

/** THE MECHANISM. Issues independent draws of `drawOnce`, one at a time (see the no-await-in-loop
 *  note below), until either `repeats` VALID draws have been collected or the D-BP154-001 replacement
 *  cap is exhausted, then compares the VALID draws' `resultKey`s and returns the single agreed draw,
 *  a reported UNRESOLVED disagreement, or a CAPTURE FAILURE (`captureFailure`, D-BP154-001, THE
 *  INVALID DRAW). `repeats <= 1` is a pure pass-through, UNCHANGED by D-BP154-001: exactly one draw
 *  is issued, its result is used exactly as given (valid, invalid, or empty alike), and none of this
 *  function's own note()s fire -- see this section's own header (D-BP153-031) and the D-BP154-001
 *  section header (above) for why: THE TICKET'S OWN SCOPE is "the draw-repeat loop... wherever it is
 *  used," and at `repeats <= 1` there is no repeat loop to apply it to.
 *
 *  D-BP154-001, THE MECHANISM (repeats > 1 only), per THE RULE's own five points: (1) classify each
 *  draw via `draw.invalid`/`draw.emptyResult`, set by the caller's own `drawOnce()` (never re-derived
 *  here -- "reuse that predicate, do not write a second one"); (2) an invalid draw is removed from
 *  the comparison set before agreement/disagreement is ever computed; (3) a replacement is taken for
 *  each invalid draw, capped at `LB_DRAW_MAX_INVALID_REPLACEMENTS` TOTAL extra attempts; (4) if the
 *  cap is exhausted before `repeats` valid draws exist (all-invalid is the extreme case of this), or
 *  every valid draw extracted nothing, the result is a CAPTURE FAILURE, never draw-disagreement and
 *  never a trusted agreement; (5) every discard is noted, naming the draw number, the FAILED CAPTURE
 *  fact, the transport/authority, and a passage preview (`draw.invalidDetail`). A VALID draw is never
 *  discarded -- only draws with `invalid === true` are ever removed from the comparison set. */
export async function drawWithAgreement<T>(
  label: string,
  repeats: number,
  drawOnce: (drawIndex: number) => Promise<RepeatedDraw<T>>,
  note: (text: string) => void,
): Promise<RepeatedDrawOutcome<T>> {
  // D-BP153-031's own escape hatch, UNTOUCHED by D-BP154-001. THE TICKET'S OWN SCOPE (WHAT TO
  // BUILD, verbatim): "The draw-repeat loop introduced by D-BP153-031... wherever it is used." At
  // `repeats <= 1` there IS no repeat loop -- one draw is issued and its result is used exactly as
  // it was before EITHER ticket, no notes, no invalid-draw replacement, no empty-result guard. This
  // is deliberate, not an oversight: every sibling classify_cascade.*.test.ts file (18 of them)
  // pins `LB_DRAW_REPEATS=1` specifically so its own single-draw fixtures stay valid across BOTH
  // tickets, and D-BP154-001's own measured evidence (this file's own D-BP154-001 section header)
  // is entirely about MULTIPLE independent draws disagreeing or falsely "agreeing" -- a concept
  // that does not exist for a single draw.
  if (repeats <= 1) {
    const draw = await drawOnce(0);
    return { agreed: true, trusted: draw, draws: [draw], repeats };
  }
  const draws: RepeatedDraw<T>[] = [];
  const validDraws: RepeatedDraw<T>[] = [];
  let capExhausted = false;
  for (;;) {
    if (validDraws.length >= repeats) break;
    if (draws.length >= repeats + LB_DRAW_MAX_INVALID_REPLACEMENTS) { capExhausted = true; break; }
    const attemptNumber = draws.length + 1;
    const isReplacement = draws.length >= repeats;
    if (!isReplacement) {
      note(`   ${label}: DRAW ${attemptNumber} of ${repeats} (LB_DRAW_REPEATS=${repeats}, D-BP153-031)`);
    } else {
      note(
        `   ${label}: DRAW ${attemptNumber} -- REPLACEMENT draw ${draws.length - repeats + 1} of `
          + `${LB_DRAW_MAX_INVALID_REPLACEMENTS} for an earlier INVALID draw (D-BP154-001)`,
      );
    }
    // eslint-disable-next-line no-await-in-loop -- each draw must be a genuinely separate,
    // independent ask of the SAME channel (that is the entire point -- a parallel fan-out would not
    // measure independent channel variance, it would just be the same race this file's own rate-limit
    // history already warns about); drawn one at a time by design.
    const draw = await drawOnce(draws.length);
    draws.push(draw);
    note(`   ${label}: draw ${attemptNumber} result -- ${draw.resultLabel}`);
    if (draw.invalid) {
      const attemptsLeft = repeats + LB_DRAW_MAX_INVALID_REPLACEMENTS - draws.length;
      // D-BP154-001, THE RULE rule 5: "say every discard out loud... which draw number, that it
      // named no options, the transport/authority that answered, and a passage preview. A silent
      // discard is indistinguishable from a draw that never happened."
      note(
        `   ${label}: draw ${attemptNumber} DISCARDED as INVALID -- named NONE of the option(s) under `
          + 'test, a FAILED CAPTURE, never a disagreeing answer (D-BP154-001, THE INVALID DRAW) -- '
          + `${draw.invalidDetail ?? 'no detail available'} -- `
          + (attemptsLeft > 0
            ? 'taking a REPLACEMENT draw in its place'
            : `cap reached (LB_DRAW_MAX_INVALID_REPLACEMENTS=${LB_DRAW_MAX_INVALID_REPLACEMENTS}), no further replacement`),
      );
      continue; // NEVER counted toward agreement or disagreement (THE RULE, rule 2).
    }
    validDraws.push(draw); // a VALID draw is never discarded (THE RULE, verbatim).
  }

  if (capExhausted || validDraws.length === 0) {
    note(
      `   ${label}: only ${validDraws.length} of ${repeats} required VALID draw(s) obtained after `
        + `${draws.length} attempt(s) (replacement cap LB_DRAW_MAX_INVALID_REPLACEMENTS=`
        + `${LB_DRAW_MAX_INVALID_REPLACEMENTS} exhausted) -- CAPTURE FAILURE (D-BP154-001), never `
        + `draw-disagreement and never a trusted result; treating ${label} as UNAVAILABLE`,
    );
    return {
      agreed: false, trusted: null, draws, repeats, captureFailure: true, captureFailureReason: 'all-invalid',
    };
  }

  // D-BP154-001, THE RULE's "other half": every VALID draw obtained named options (passed the
  // `invalid` check above) but extracted NOTHING informative -- agreement on an empty result is not
  // corroboration.
  if (validDraws.every((d) => d.emptyResult)) {
    note(
      `   ${label}: ${validDraws.length} valid independent draw(s) each named an option but extracted `
        + 'NOTHING -- agreement on an empty result is not corroboration (D-BP154-001, THE INVALID '
        + `DRAW, THE RULE's other half) -- CAPTURE FAILURE, never draw-disagreement and never a `
        + `trusted empty result; treating ${label} as UNAVAILABLE`,
    );
    return {
      agreed: false, trusted: null, draws, repeats, captureFailure: true, captureFailureReason: 'all-empty',
    };
  }

  const uniqueKeys = new Set(validDraws.map((d) => d.resultKey));
  if (uniqueKeys.size <= 1) {
    note(`   ${label}: ${validDraws.length} valid independent draw(s) AGREE -- ${validDraws[0].resultLabel} -- trusted`);
    return { agreed: true, trusted: validDraws[0], draws, repeats };
  }
  note(
    `   ${label}: DISAGREEMENT across ${validDraws.length} VALID independent draws of the SAME question `
      + '(D-BP153-031, THE CHANNEL VARIANCE FINDING) -- '
      + `${validDraws.map((d, i) => `draw ${i + 1}: ${d.resultLabel}`).join(' | ')} -- reported as a FINDING and `
      + 'LEFT UNRESOLVED (never an intersection, a union, a majority vote, or a first-draw pick); '
      + `treating ${label} as UNAVAILABLE`,
  );
  return { agreed: false, trusted: null, draws, repeats };
}

/**
 * FD-BP153-01 -- THE FRAME. Establishes which options are legitimate members of the category the
 * question names, before anything is ranked.
 *
 * THE FOUNDER'S RULING, BP153, verbatim: "So make the ruling that a superlative resolves by
 * magnitude RIGHT by making it complete with the frame."
 *
 * WHY THIS EXISTS, MEASURED. FD-BP152-38 ruled that a superlative resolves by magnitude, and that
 * ruling is correct and is not reversed. BP153 showed it was INCOMPLETE. Ranking qid 98's full
 * option list by population density puts the Arctic Circle at the least extreme, so the magnitude
 * route answers G. The key is A. The Founder's own hand-worked run had South America ranked LAST
 * in every ordering, because he restricted the options to legitimate world regions BEFORE he
 * ranked, and inside {South Asia, Northeast US, Europe, South America} it is last. He did the
 * frame step in his head and never wrote it down as a step. The code ranked everything, so it
 * ranked biomes against continents, which is a category error rather than a close call.
 *
 * ONE QUERY, NOT ONE PER OPTION. Founder, BP151, on the same principle: "we got rid of four
 * answers with ONE google search." This also matters for volume: BP152 measured ~18 queries per
 * run right before Google rate-limited this machine.
 *
 * ASKED, NEVER ASSUMED. No word list of "things that are biomes" is built here; that would be
 * exactly the tare HARDWIRE-23 forbids and the judgment HARDWIRE-22 refuses to delegate. The
 * category test goes to the authority, and the local model only COPIES OUT the names the passage
 * itself excluded (extraction, unrelaxed), verified back against the passage text with appearsIn()
 * the same way askOrdering() already verifies an extracted ordering.
 *
 * FD-BP153-04 -- CONSULT FIRST, ADDED. THE FOUNDER'S RULING, BP153, verbatim: "Before a step
 * issues a new query, it must first try to answer that query by EXTRACTING from passages this run
 * has already acquired. A new query is spent only when the owned evidence does not contain the
 * answer."
 *
 * THE MEASUREMENT BEHIND IT. Live run 2026-08-12T16:04Z, qid 98: the OPERATION query's own
 * response already contained, verbatim, the FRAME partition this function exists to establish
 * ("Options A..., C..., F..., G..., H..., and I... are all NOT considered among the world's most
 * densely populated regions. Only B..., D..., and E... are recognized..."). gemmaExtract() had
 * correctly taken only the operation word from that passage, because that is what the operation
 * step asks -- the rest was discarded, and this function then spent a fresh query to re-derive
 * something the run already had in hand, before 62 more queries hit google.com/sorry.
 *
 * WHAT THIS ADDS, BELOW. Before the existing query path (unchanged beneath this block), try the
 * SAME extraction (extractFrameKinds(), D-BP153-032, one shared instruction/shape, no second
 * wording) against every passage the caller says this run already owns. EXTRACTION ONLY, NEVER
 * JUDGMENT (HARDWIRE-22, unrelaxed) -- exactly the same choke point the fresh-query path already
 * used: gemmaExtract() copies out the KIND the passage itself states for each name, verified back
 * against THAT owned passage's own text with appearsIn(), never inferred. OWNED MEANS THIS RUN ONLY: the
 * `ownedPassages` accessor comes from MethodRunContext (method_registry.ts), populated by
 * liana_terminal_engine.ts from live in-memory state, never the evidence store on disk. And
 * D-BP153-010's rule extends here unchanged: an owned passage that yields NOTHING extractable is
 * INCONCLUSIVE for this question, not "confirmed nothing excluded" -- it may simply not address
 * the category at all -- so an empty extraction tries the next owned passage rather than being
 * read as a frame.
 *
 * EXPORTED, D-BP153-011, same reason Stage 1's runClassifyCascadeWithSeedCriteria() and Stage 2's
 * runLitmusStripLoop() are exported above: so this ticket's own verification can exercise the
 * owned-evidence-first behavior directly (mocked askGoogle/gemmaExtract, no live Ollama or
 * Electron browser automation) rather than only through the full superlative-by-magnitude route.
 */
export async function establishFrame(
  askGoogle: MethodRunContext['askGoogle'],
  category: string,
  all: string[],
  OPT: Record<string, string>,
  note: (text: string) => void,
  // FD-BP153-04, ADDITIVE/OPTIONAL -- see MethodRunContext.ownedPassages's own doc comment
  // (method_registry.ts) for why this is optional and what "owned" means. Omitted (undefined)
  // behaves exactly as before this ticket: straight to the query path below, no change.
  // D-BP153-016, FIX 1: now typed OwnedPassage[], not bare string[] -- see this file's own
  // "TYPED OWNED PASSAGES, AND VERIFY-THE-SPAN" section header, above, for the ruling.
  ownedPassages?: () => OwnedPassage[],
  // D-BP153-018, ADDITIVE/OPTIONAL, placed AFTER `ownedPassages` so no existing call site (which
  // never passes a 7th argument) shifts meaning -- see this function's own D-BP153-018 section
  // header (above establishFrame() in this file) for the ruling. Undefined/blank behaves exactly as
  // before this ticket: discardPropertyContaminatedSpans() no-ops on an empty property string.
  property?: string,
  // D-BP153-024, ADDITIVE/OPTIONAL, placed LAST so no existing call site (none of which pass an 8th
  // argument) shifts meaning. Undefined behaves exactly as before this ticket: the fresh-query path
  // below goes straight to Google via obtainCascadePassage()'s own no-conversational-authority
  // branch. See obtainCascadePassage()'s own header, immediately above establishFrame(), for the
  // full ruling.
  askConversationalAuthority?: MethodRunContext['askConversationalAuthority'],
): Promise<FrameResult> {
  const prop = property ?? '';
  const rawOwned = ownedPassages ? ownedPassages() : [];
  const owned = filterUsableOwnedPassages(rawOwned, all, OPT, 'FRAME', note);
  for (let i = 0; i < owned.length; i++) {
    const passage = owned[i].text;
    // eslint-disable-next-line no-await-in-loop -- each owned passage is tried in turn, stopping at
    // the first that yields a verified, complete stated-kind read; extraction over text already
    // sitting in memory (a local Ollama call), never a network fan-out, so there is nothing here to
    // parallelize against.
    const { kinds, categoryKind, discarded } = await extractFrameKinds(passage, all, OPT, category, prop, note);
    if (discarded) {
      note(`   FRAME: discarded ${discarded} value(s) with no verbatim supporting span (passage ${i + 1} of ${owned.length})`);
    }
    const anyKindOrCategory = Object.values(kinds).some((k) => k != null) || categoryKind != null;
    const missingKind = all.filter((L) => kinds[L] == null);
    // D-BP153-023/BISHOP/seg-classify-023, restated for THE SOFTBALLS' stated-kind shape
    // (D-BP153-032): a passage that stated SOME kinds but not EVERY option's kind is a
    // per-PASSAGE-retry heuristic only -- try for a MORE complete read from the next owned passage,
    // then the fresh query below. This is NOT the terminal safety net: D-BP153-029's own rule (an
    // unaccounted option is never guessed, and a directly stated kind is never discarded merely
    // because some OTHER option went unaccounted for) governs the terminal answer regardless -- see
    // applyFrameKindElimination(), above, which this function's own terminal return (further below)
    // always applies even when some option never got a stated kind.
    if (anyKindOrCategory && missingKind.length > 0) {
      note(
        `   FRAME: INCOMPLETE on owned passage ${i + 1} of ${owned.length} (D-BP153-023) -- `
          + `${missingKind.length} of ${all.length} option(s) have no stated kind `
          + `{${missingKind.map((L) => `${L}) ${OPT[L]}`).join(', ')}} -- this owned passage did NOT `
          + `fully answer THE SOFTBALLS; falling through to `
          + `${i + 1 < owned.length ? 'the next owned passage' : 'a fresh query'}`,
      );
      continue;
    }
    if (anyKindOrCategory) {
      const result = applyFrameKindElimination(all, kinds, categoryKind, category, OPT);
      note(
        `   FRAME: answered FROM OWNED EVIDENCE (passage ${i + 1} of ${owned.length}, already acquired `
          + `this run -- NO NEW QUERY ISSUED) -- ${result.why}`,
      );
      return {
        available: categoryKind != null,
        excluded: result.excluded,
        included: result.included,
        conflicts: [],
        partitionComplete: result.unaccounted.length === 0,
        reconciliationWhy: result.why,
        query: `(owned passage ${i + 1} of ${owned.length}, no query issued)`,
        via: 'owned-passage', answeredFrom: 'owned-passage', ownedPassageIndex: i,
      };
    }
    // D-BP153-010's rule, extended: yielded no stated kind and no stated categoryKind at all --
    // inconclusive for THIS passage, not "confirmed nothing excluded". Falls through to the next
    // owned passage, then to the query path below.
  }
  if (owned.length) {
    note(`   FRAME: ${owned.length} owned passage(s) already acquired this run did not contain a usable stated-kind read -- falling through to a NEW QUERY`);
  }

  // D-BP153-033 FIX. D-BP153-032 changed QUESTION 1's OWN query wording to reuse STAGE D's query
  // verbatim ("What kind of X is each of these, how do they differ from one another, and which of
  // those kinds properly denotes X?") -- that was the WRONG fix for a defect that was never in the
  // query wording. THE MEASURED FAILURE this restores from (run
  // LIANA_RUN_qid98_2026-08-13T16-29-46-988Z.json, acquisition
  // EVIDENCE_qid98_2026-08-13T16-27-05-170Z_27064.jsonl): STAGE D's own wording invites a source to
  // answer with a COMPARISON ESSAY ("how do they differ from one another") -- the real Gemini
  // passages this run acquired GROUPED the nine options under four category headings ("Category 1:
  // Macro-Geographic / Socio-Political Regions  A) South America (Continent) B) South Asia
  // (Sub-continental realm) ...") instead of stating a kind per option, and
  // extractDiscriminatorKinds()'s per-item shape read every one of those as null -- draw 1 result:
  // "kinds {A:null, B:null, C:null, D:null, E:null, F:null, G:null, H:null, I:null},
  // categoryKind=null". THE FRAME's OWN previous query (D-BP153-021, 332dd737, "For EACH of the
  // following, state exactly what it is...") produced clean per-option lines on both draws it ever
  // ran and never once produced this comparison-essay shape -- restored here VERBATIM, with the
  // category-denotation ask appended as a SEPARATE TRAILING CLAUSE (never folded into the per-option
  // list, so it cannot reshape it into a comparison essay the way STAGE D's single run-on sentence
  // did). ONE query still (Founder, BP151, verbatim: "we got rid of four answers with ONE google
  // search"). Extraction (extractFrameKinds()/extractDiscriminatorKinds(), above/further below) is
  // UNCHANGED by this ticket's Fix 1 -- Fix 2 (discriminatorExtractionInstruction(), further below)
  // is what teaches the EXTRACTOR to read a grouped-heading passage; this fix only restores what is
  // ASKED of the source. STAGE D's OWN query (further below, D-BP153-028's wording) is untouched --
  // this ticket's dispatch is explicit that the discriminator's wording stays as it is.
  const query = `For EACH of the following, state exactly what it is -- its actual classification `
    + `or type -- rather than merely whether it is or is not ${category}. Answer for every one, in `
    + `order, and do not skip any. ${list(all, OPT)} Then, separately and last, state which one of `
    + `those classifications properly denotes "${category}".`;
  note(`   FRAME: ${query}`);
  // D-BP153-031, THE REPEATS RUN FIRST. THE SOFTBALLS' own base question is drawn LB_DRAW_REPEATS
  // times, independently, BEFORE anything downstream (including D-BP153-026's completion follow-up,
  // below) ever runs -- see this file's own D-BP153-031 section header for the full ruling. Each
  // draw repeats the IDENTICAL checks this function already performed once before that ticket
  // (res.ok, non-empty passage, passageMentionsAnyLabel) plus the extraction itself, and folds all
  // four possible outcomes into one comparable `resultKey` -- so two draws that fail for DIFFERENT
  // reasons (one empty, one genuinely extracted) are correctly treated as a disagreement too, not
  // silently conflated. D-BP153-032 changes only what `resultKey`/`resultLabel` are built FROM (the
  // stated-kind extraction, not the retired direct/complement one) -- the wrapper itself
  // (drawWithAgreement(), above) is untouched, and is exactly how this ticket's own measured
  // variance is closed: a deterministic (copy-only) extraction now agrees draw over draw on
  // essentially identical source text, where a judgment-based one did not.
  type FrameDrawData =
    | { kind: 'not-ok'; res: GoogleAnswer }
    | { kind: 'empty'; res: GoogleAnswer }
    | { kind: 'no-label'; res: GoogleAnswer }
    | { kind: 'extracted'; res: GoogleAnswer; kinds: Record<string, string | null>; categoryKind: string | null; discarded: number };
  const drawRepeats = resolveDrawRepeats();
  const frameDrawOutcome = await drawWithAgreement<FrameDrawData>('FRAME', drawRepeats, async () => {
    // D-BP153-024: tries `askConversationalAuthority` first (when threaded), falls back to Google --
    // see obtainCascadePassage()'s own header, above establishFrame(), for the full ruling.
    const drawRes = await obtainCascadePassage(askGoogle, askConversationalAuthority, 'FRAME', query, note);
    if (!drawRes.ok) {
      return { resultKey: 'UNAVAILABLE:not-ok', resultLabel: `no usable answer (${drawRes.via})`, data: { kind: 'not-ok', res: drawRes } };
    }
    // D-BP153-010 -- AN EMPTY PASSAGE IS NOT AN EMPTY EXCLUSION LIST. An unusable frame must abstain
    // (FD-BP153-01 consequence 2), never silently pass every option through to the ranking.
    if (!drawRes.text || !drawRes.text.trim()) {
      return { resultKey: 'UNAVAILABLE:empty', resultLabel: `empty passage (${drawRes.via})`, data: { kind: 'empty', res: drawRes } };
    }
    // D-BP153-016, FIX 3, mirrored for the fresh-query path: a passage naming none of the options
    // cannot state anything about them -- same fact-class as the empty-passage check above.
    // D-BP154-001: this is exactly THE INVALID DRAW -- a FAILED CAPTURE, not a disagreeing answer.
    // `invalid`/`invalidDetail` let drawWithAgreement() (above) remove it from the comparison set
    // and replace it under the cap, instead of letting it veto a good draw the way it did on the
    // measured receipt (LIANA_RUN_qid98_2026-08-13T19-24-50-420Z.json, this ticket's own header).
    if (!passageMentionsAnyLabel(drawRes.text, all, OPT)) {
      return {
        resultKey: 'UNAVAILABLE:no-label', resultLabel: `no option named (${drawRes.via})`, data: { kind: 'no-label', res: drawRes },
        invalid: true, invalidDetail: `answered by ${drawRes.via} -- passage preview: "${passagePreview(drawRes.text)}"`,
      };
    }
    const { kinds: drawKinds, categoryKind: drawCategoryKind, discarded: drawDiscarded } = await extractFrameKinds(drawRes.text, all, OPT, category, prop, note);
    // THE COMPARISON: the EXTRACTED RESULT SET, never the raw passage text (this section's own
    // header) -- the stated kind per option plus the stated category kind are exactly what
    // applyFrameKindElimination() consumes; sorted by option letter so key order never causes a
    // spurious disagreement.
    const resultKey = JSON.stringify({
      kinds: all.map((L) => [L, drawKinds[L]]), categoryKind: drawCategoryKind,
    });
    const resultLabel = `kinds {${all.map((L) => `${L}:${drawKinds[L] ?? 'null'}`).join(', ')}}, categoryKind=${drawCategoryKind ?? 'null'}`;
    // D-BP154-001, THE RULE's "other half": the passage named options (it passed the check above)
    // but nothing was actually extracted about ANY of them -- an uninformative draw that must never
    // be allowed to "agree" with another equally uninformative draw and be trusted as corroboration.
    const emptyResult = all.every((L) => drawKinds[L] == null) && drawCategoryKind == null;
    return {
      resultKey, resultLabel, emptyResult, data: {
        kind: 'extracted', res: drawRes, kinds: drawKinds, categoryKind: drawCategoryKind, discarded: drawDiscarded,
      },
    };
  }, note);
  if (frameDrawOutcome.captureFailure) {
    // D-BP154-001: a CAPTURE FAILURE -- either every draw (through the replacement cap) was
    // INVALID, or every valid draw extracted nothing. Distinct from draw-disagreement (THE RULE:
    // "it must never veto a good draw") and distinct from a trusted agreement (THE RULE's other
    // half: "agreement on an empty result is not corroboration").
    return {
      available: false, excluded: [], included: [], conflicts: [], partitionComplete: false,
      reconciliationWhy: `unavailable -- CAPTURE FAILURE (D-BP154-001, ${frameDrawOutcome.captureFailureReason}), `
        + 'never a disagreement and never a trusted empty frame',
      query, via: 'draw-capture-failure', answeredFrom: 'new-query', ownedPassageIndex: null,
      drawRepeats, drawsIssued: frameDrawOutcome.draws.length,
    };
  }
  if (!frameDrawOutcome.agreed) {
    // DISAGREEMENT -> UNAVAILABLE, exactly the same state a frame this function could never
    // establish at all already produces (FD-BP153-01 consequence 2). Never an intersection, a
    // union, a majority, or a first-draw pick -- drawWithAgreement() above already reported the
    // FINDING (D-BP153-031) naming every draw's own result; this is only the caller's consequence.
    return {
      available: false, excluded: [], included: [], conflicts: [], partitionComplete: false,
      reconciliationWhy: `unavailable -- ${drawRepeats} independent draws disagreed (D-BP153-031, THE CHANNEL VARIANCE FINDING)`,
      query, via: 'draw-disagreement', answeredFrom: 'new-query', ownedPassageIndex: null,
      drawRepeats, drawsIssued: frameDrawOutcome.draws.length,
    };
  }
  const frameTrusted = frameDrawOutcome.trusted!.data;
  if (frameTrusted.kind === 'not-ok') {
    note(`   FRAME: no usable answer (${frameTrusted.res.via}) -- the frame is UNAVAILABLE, not empty`);
    return {
      available: false, excluded: [], included: [], conflicts: [], partitionComplete: false,
      reconciliationWhy: 'unavailable -- no usable answer', query, via: frameTrusted.res.via, answeredFrom: 'new-query', ownedPassageIndex: null,
      drawRepeats, drawsIssued: frameDrawOutcome.draws.length,
    };
  }
  if (frameTrusted.kind === 'empty') {
    note(`   FRAME: the source returned an EMPTY passage (${frameTrusted.res.via}) -- the frame is UNAVAILABLE, not "nothing excluded"`);
    return {
      available: false, excluded: [], included: [], conflicts: [], partitionComplete: false,
      reconciliationWhy: 'unavailable -- empty passage', query, via: `${frameTrusted.res.via} (empty passage)`, answeredFrom: 'new-query', ownedPassageIndex: null,
      drawRepeats, drawsIssued: frameDrawOutcome.draws.length,
    };
  }
  if (frameTrusted.kind === 'no-label') {
    note(`   FRAME: the source's passage (${frameTrusted.res.via}) names NONE of the option(s) under test -- the frame is UNAVAILABLE, not "nothing excluded"`);
    return {
      available: false, excluded: [], included: [], conflicts: [], partitionComplete: false,
      reconciliationWhy: 'unavailable -- no option named', query, via: `${frameTrusted.res.via} (no option named)`, answeredFrom: 'new-query', ownedPassageIndex: null,
      drawRepeats, drawsIssued: frameDrawOutcome.draws.length,
    };
  }
  const { res, discarded } = frameTrusted;
  let effectiveKinds = frameTrusted.kinds;
  let effectiveCategoryKind = frameTrusted.categoryKind;
  if (discarded) {
    note(`   FRAME: discarded ${discarded} value(s) with no verbatim supporting span (fresh query)`);
  }
  note(
    `   FRAME: answered FROM A NEW QUERY -- stated kinds `
      + `{${all.map((L) => `${L}:${effectiveKinds[L] ?? 'null'}`).join(', ')}}, `
      + `stated category kind = ${effectiveCategoryKind ?? 'null'}`,
  );

  // D-BP153-026, THE COMPLETION FOLLOW-UP -- see this file's own section header, above
  // obtainCascadePassage(), for the full ruling. Fires ONLY when the fresh query's own stated-kind
  // read left some option(s) with no stated kind (D-BP153-032 restates the SAME gate for THE
  // SOFTBALLS' new shape: "uncovered" here means "no stated kind", where before this ticket it meant
  // "named by neither the direct nor the complement extraction" -- the underlying rule, AT MOST ONE
  // follow-up naming ONLY the still-unaccounted options, is unchanged). D-BP153-027's own SECOND
  // trigger (complementSilentAndPartial()) has no analog here -- there is no complement direction
  // left to be silent about (see this file's own D-BP153-032 section header) -- it remains fully
  // wired for THE NAMED SET, below, untouched by this ticket.
  const uncovered = all.filter((L) => effectiveKinds[L] == null);
  if (uncovered.length) {
    const followUp = await issueCompletionFollowUp(
      'FRAME',
      'INCOMPLETE STATED-KIND COVERAGE (D-BP153-032)',
      (namesList) => `For EACH of the following, state exactly what it is -- its actual classification `
        + `or type -- rather than merely whether it is or is not ${category}. These are the ONLY `
        + `option(s) the first pass left unaccounted for; answer for every one, in order, and do not `
        + `skip any. ${namesList} Then, separately and last, state which one of those classifications `
        + `properly denotes "${category}".`,
      uncovered, all, OPT, askGoogle, askConversationalAuthority, note,
    );
    if (followUp) {
      // The SAME extractor the first pass used, unmodified -- every guard (span verification,
      // D-BP153-018's property-span discard, typed passages, appearsIn) applies to this passage
      // exactly as it did to the first one. Scoped to `uncovered` only -- the follow-up query itself
      // named only these, so nothing else could be stated in the reply anyway.
      const followUpRead = await extractFrameKinds(followUp.text, uncovered, OPT, category, prop, note);
      if (followUpRead.discarded) {
        note(`   FRAME FOLLOW-UP: discarded ${followUpRead.discarded} value(s) with no verbatim supporting span`);
      }
      // Union the follow-up's stated kinds into the first pass's own -- the first pass is never
      // discarded, only added to (mirrors D-BP153-026's own "union, not replacement" rule). Prefer
      // the first pass's own categoryKind when it has one; take the follow-up's only when the first
      // pass never got one at all.
      const mergedKinds: Record<string, string | null> = { ...effectiveKinds };
      for (const L of uncovered) {
        if (followUpRead.kinds[L] != null) mergedKinds[L] = followUpRead.kinds[L];
      }
      const mergedCategoryKind = effectiveCategoryKind ?? followUpRead.categoryKind;
      note(
        `   FRAME FOLLOW-UP RECONCILIATION (D-BP153-026, union of first pass + follow-up): stated kinds `
          + `{${all.map((L) => `${L}:${mergedKinds[L] ?? 'null'}`).join(', ')}}, stated category kind = `
          + `${mergedCategoryKind ?? 'null'}`,
      );
      effectiveKinds = mergedKinds;
      effectiveCategoryKind = mergedCategoryKind;
    }
  }

  // THE TERMINAL SAFETY NET -- applyFrameKindElimination() (above) is ALWAYS the final word here,
  // even when the follow-up (if any) is ALSO incomplete: D-BP153-029's own rule means an option with
  // no stated kind stays UNACCOUNTED (never guessed) rather than blocking every OTHER option's own
  // directly stated exclusion, and Founder's own D-BP153-032 rule means a categoryKind that was
  // NEVER stated by anything this function tried makes the whole frame UNAVAILABLE (`available`,
  // below) rather than publishing a zero-exclusion "answer" that was never actually established.
  const result = applyFrameKindElimination(all, effectiveKinds, effectiveCategoryKind, category, OPT);
  note(`   FRAME RECONCILIATION: ${result.why}`);
  note(
    `   FRAME: ${result.excluded.length} option(s) are not ${category} and will NOT be ranked -- `
      + `${result.excluded.map((L) => `${L}) ${OPT[L]}`).join(', ') || '(none)'}`,
  );
  return {
    available: effectiveCategoryKind != null,
    excluded: result.excluded,
    included: result.included,
    conflicts: [],
    partitionComplete: result.unaccounted.length === 0,
    reconciliationWhy: result.why,
    query, via: res.via, answeredFrom: 'new-query', ownedPassageIndex: null,
    drawRepeats, drawsIssued: frameDrawOutcome.draws.length,
  };
}

// ─────────────────────────── THE NAMED SET, and THE MEMBERSHIP TERMINATOR ───────────────────────────
//
// D-BP153-013/BISHOP/seg-membership-terminator. Encodes Bishop's own hand derivation of qid 98
// VERBATIM -- this section is a BUILD of what he already worked out, not a redesign:
//
//   Step 1 THE FRAME (establishFrame(), above -- NOT rebuilt here): which options are legitimate
//   members of the category the question names ("world regions")? Biomes are not.
//   Step 2 THE NAMED SET (extractNamedSetMembers(), below): the superlative phrase ("the world's
//   most densely populated regions") can denote a NAMED SET, not a magnitude to rank -- the
//   source NAMES its members directly, exactly the way establishFrame()'s source names its
//   exclusions. qid 98's real evidence names exactly three: South Asia, Northeast US, Europe.
//   Step 3 PUT THEM TOGETHER (runMembershipTerminator(), below): legitimate-regions (all, minus
//   the frame's own exclusions) MINUS named-set-members = the answer candidates. Exactly one
//   candidate is the answer.
//   Step 4 If the difference is not exactly one option, ABSTAIN and name the survivors. Never
//   pick among them -- this is FD-BP152-19 (the Membership Terminator: Occam elimination, break
//   one rule and you are eliminated), the SAME "no tie-breaker, ever" rule this file's Stage 1
//   already implements for criteria, applied here to a NAMED SET rather than a magnitude, and
//   composed with FD-BP153-01 (frame first, above).
//
// THE MEASUREMENT THIS IS BUILT ON. qid 98's real evidence store, this run: the SAME passage
// establishFrame() already fetches for the frame partition ALSO states, verbatim, "Only B (South
// Asia), D (Northeast United States), and E (Europe) are recognized in human geography as major
// global population clusters" -- the named set, sitting in evidence this run already owns, right
// next to the frame partition. When BOTH resolve from owned evidence, this route answers with
// ZERO new queries and never issues Stage B's four ordering queries at all -- the volume problem
// that got this machine rate-limited (BP152: ~18 queries/run before google.com/sorry).
//
// NEVER TUNED TOWARD THE KEY. runMembershipTerminator() below is a pure function of (all,
// frameExcluded, members) -- it can return any letter as the unique candidate, or none, and it
// never breaks a tie. No branch in this section reads input.correctAnswer.

export interface NamedSetResult {
  /** False = the authority gave no usable answer -- the named set is UNAVAILABLE, not empty. See
   *  FrameResult.available's own doc comment for why that distinction matters; the same reasoning
   *  applies here symmetrically. */
  available: boolean;
  /** Option letters the SOURCE itself states ARE members of the named set -- RECONCILED (see
   *  reconcileNamedSet() below) with the complement extraction when the two sides form a clean,
   *  COMPLETE, conflict-free partition of `all` (D-BP153-020: covering every option, not merely
   *  conflict-free). When the complement said something but the union is incomplete, this is the
   *  DIRECTLY STATED member list, unexpanded (D-BP153-029) -- the COMPLEMENT-DERIVED INFERENCE is
   *  discarded, never the directly stated values themselves (see reconcileNamedSet()'s own header
   *  for why); this is empty only when the direct side itself stated nothing. Only when the
   *  complement extracted NOTHING AT ALL is this the direct extraction alone, unreconciled. May be
   *  empty, which (when `available` is true) is a valid reading meaning "nothing about membership is
   *  established from this passage" -- not the same as unavailable. */
  members: string[];
  /** The direct member-extraction, BEFORE reconciliation -- D-BP153-014. Kept separate from
   *  `members` so a reader can see exactly what changed and why (reconciliation.why says the
   *  rest). Always populated when `available`. */
  rawMembers: string[];
  /** D-BP153-016, FIX 2: the verbatim SUPPORTING SPAN each letter in `rawMembers` was extracted
   *  from -- one entry per letter in `rawMembers`, keyed by option letter. This is what "verify the
   *  span, not the string" actually produces, made visible on the result so a reader (or a test)
   *  can audit it without re-running anything. */
  memberSpans: Record<string, string>;
  /** D-BP153-014, BUG-1(b): the complement -- option letters the SAME passage states are NOT
   *  members, extracted from the identical already-fetched text, no new query. Bishop's own
   *  diagnosis: the passage states non-membership MORE directly than membership, so this extraction
   *  can recover a name the direct member-list under-recalled. */
  nonMembers: string[];
  /** Option letters extracted as BOTH a member and a non-member by the two independent extractions
   *  -- a FINDING, reported and never silently resolved one way or the other (his own words,
   *  verbatim, D-BP153-014 dispatch: "if they conflict... report it and do not silently prefer
   *  one"). Empty when the two extractions agree. */
  conflicts: string[];
  /** True when `rawMembers` and `nonMembers` together name every option in `all`, with zero
   *  conflicts -- a complete, mutually-corroborating partition. See reconcileNamedSet() below. */
  partitionComplete: boolean;
  /** Plain-English rendering of the reconciliation arithmetic -- see reconcileNamedSet()'s own
   *  `why`, threaded through so a reader can audit this result without re-running anything. */
  reconciliationWhy: string;
  query: string;
  via: string;
  /** FD-BP153-04, mirrored from FrameResult -- THE RECEIPT SAYS WHICH. 'owned-passage' when the
   *  named set was extracted from a passage this run had already acquired, NO new query issued;
   *  'new-query' when no owned passage answered it and this fell through to its own googleBlocks()
   *  call, exactly the same shape establishFrame() already uses. */
  answeredFrom: 'owned-passage' | 'new-query';
  /** Index into the caller's ownedPassages() array that answered the named set, when answeredFrom
   *  is 'owned-passage'; null on 'new-query'. */
  ownedPassageIndex: number | null;
  /** D-BP153-031, ADDITIVE/OPTIONAL -- mirrors FrameResult's own pair, same contract, see there. */
  drawRepeats?: number;
  drawsIssued?: number;
}

/** D-BP153-014, BUG-1(b), SUPERSEDED IN PART BY D-BP153-020 (below). Pure set arithmetic, no I/O,
 *  mirrors runMembershipTerminator()'s own discipline (Step 3, above) -- mechanical only, never a
 *  model call, never a guess, and never a tie-break. Reconciles the direct member-extraction
 *  against the complement (non-member) extraction over the SAME already-fetched passage.
 *
 *  A conflict (an option BOTH extractions name) is a FINDING. Reported and left UNRESOLVED --
 *  never silently preferred one way or the other. His own dispatch, verbatim: "if they conflict...
 *  report it and do not silently prefer one." On conflict, this falls back to the direct member
 *  extraction, unreconciled -- the conflicting name(s) stay exactly where the direct extraction put
 *  them, and `conflicts` says so.
 *
 *  D-BP153-020, THE MEASURED FAILURE THIS SECTION NOW CLOSES (live run, receipt
 *  LIANA_RUN_qid98_2026-08-13T00-54-31-659Z.json). THE OLD RULE (D-BP153-014) trusted the
 *  complement whenever it said something and there was no conflict, REGARDLESS of whether the two
 *  sides together covered every option -- deliberately, on the theory that the complement is
 *  stated more directly in some passages. Measured live: a passage whose complement named only
 *  {A, E} out of nine options reconciled to SEVEN exclusions {B,C,D,F,G,H,I} -- every option the
 *  complement simply never mentioned was treated as excluded. South Asia, North Africa, Northeast
 *  United States, and Central Asia ARE legitimate world regions; the source never said otherwise,
 *  it just never named them. Absence is omission, not a stated exclusion (FD-BP153-07).
 *
 *  THE RULE, NOW: an exclusion may be trusted ONLY when `members` and `nonMembers` TOGETHER cover
 *  every option in `all` (zero conflicts, zero gaps -- `partitionComplete`, computed below). When
 *  the complement said something but the union is incomplete, the COMPLEMENT-DERIVED INFERENCE
 *  (below, "everything the complement did not name is a member/non-member") is discarded -- see
 *  D-BP153-029, immediately below, for what is NOT discarded.
 *
 *  This intentionally retires the OLD "complement trusted despite an incomplete direct side"
 *  reading D-BP153-014 built (the live bug's own exact wording) -- the case that reading existed
 *  for (a passage naming D nowhere directly, recovered only by complement completion arithmetic)
 *  is the SAME arithmetic that produced the live bug: inferring a member (or an exclusion) for an
 *  option neither extraction actually named, purely from its absence on the other list. HARDWIRE-22:
 *  extraction only, never an inference dressed as one.
 *
 *  A DIRECT-ONLY OR COMPLEMENT-ONLY read (the OTHER side extracted nothing at all,
 *  `nonMembers.length === 0`, below) is UNCHANGED and untouched by this rule -- it never performs
 *  this completion arithmetic in the first place, it only ever reports names one side explicitly,
 *  directly stated, so there is nothing here for "absence is omission" to forbid.
 *
 *  When the complement extracted NOTHING (no non-members stated at all -- the passage may simply
 *  not use that shape), there is nothing to reconcile against, and this falls back to the direct
 *  member extraction alone -- refusing to invent a complement that was never stated.
 *
 *  D-BP153-029, BISHOP'S OWN SPEC ERROR, CORRECTED. THE MEASURED FAILURE (live run, receipt
 *  LIANA_RUN_qid98_2026-08-13T04-29-14-925Z.json). D-BP153-026's own completion follow-up
 *  (issueCompletionFollowUp(), below) finally drove a FRAME reconciliation to a union naming SEVEN
 *  of nine options: direct excludes {D, G, H, I} -- FOUR options, each with its own verbatim
 *  supporting span, EXPLICITLY STATED by the source -- and complement names {B, C, F}. A and E were
 *  the only two options neither side ever addressed. D-BP153-020's gate (immediately above) read
 *  this as an INCOMPLETE PARTITION and, as this function was ORIGINALLY WRITTEN, discarded
 *  EVERYTHING -- not just the two unaccounted-for options, all four of the source's own explicit
 *  exclusion statements too, publishing "0 option(s) are not world regions -- 9 of 9 remain."
 *
 *  THE ERROR: D-BP153-020 was written to stop INFERENCE FROM ABSENCE -- treating an option the
 *  source never mentioned as excluded (the ORIGINAL live bug, this function's own header above:
 *  "the source named only A and E as world regions, therefore the other seven are NOT"). It was
 *  NEVER supposed to gate DIRECTLY STATED exclusions -- those are not an inference from absence,
 *  they are the extraction this whole file exists to trust (HARDWIRE-22: extraction, verified by
 *  appearsIn() against the source's own text, span by span). Discarding a directly stated value
 *  because the SAME passage also failed to classify two unrelated options is the gather-it-and-
 *  throw-it-away defect this file exists to close -- as real a failure as the one D-BP153-020 itself
 *  fixed, just on the opposite side of the same gate.
 *
 *  THE FIX, PRECISELY: an incomplete partition invalidates the COMPLEMENT-DERIVED INFERENCE (the
 *  "all minus non-members" arithmetic the COMPLETE branch below performs) -- it NEVER invalidates
 *  the DIRECTLY STATED values (`members`, this function's own parameter, untouched, unexpanded, and
 *  un-shrunk). The branch below now returns `members` EXACTLY AS PASSED IN -- not `[]`, not `all
 *  minus nonMemberSet` -- discards only the complement-derived inference, and the `why` string names
 *  both sets, the unaccounted-for options, and says explicitly that the N directly stated value(s)
 *  are RETAINED. The ban on inference from absence is UNCHANGED: a `members` that was itself EMPTY
 *  (nothing directly stated -- this function's own TEST 1/D-BP153-020's own headline case, and
 *  classify_cascade.complete_partition_required.test.ts's own coverage) still reconciles to `[]`
 *  here, because there is nothing direct to retain -- this fix retains what was STATED, it invents
 *  nothing. */
export function reconcileNamedSet(
  all: string[],
  members: string[],
  nonMembers: string[],
  OPT: Record<string, string>,
): NamedSetReconciliation {
  const memberSet = new Set(members);
  const nonMemberSet = new Set(nonMembers);
  const conflicts = all.filter((L) => memberSet.has(L) && nonMemberSet.has(L));
  const covered = new Set([...members, ...nonMembers]);
  const uncovered = all.filter((L) => !covered.has(L));
  const partitionComplete = conflicts.length === 0 && uncovered.length === 0;
  const label = (Ls: string[]) => `{${Ls.map((L) => `${L}) ${OPT[L]}`).join(', ') || 'none'}}`;
  if (conflicts.length) {
    return {
      members,
      nonMembers,
      conflicts,
      partitionComplete: false,
      incompletePartition: false, // a CONFLICT, not an incomplete union -- see D-BP153-023's own doc comment
      why: `CONFLICT: ${label(conflicts)} extracted as BOTH a member and a non-member by the two `
        + 'independent extractions -- reported, neither side is preferred; using the direct member '
        + 'extraction unreconciled',
    };
  }
  if (nonMembers.length) {
    // D-BP153-020, THE GATE: an exclusion is trusted ONLY when the two sides TOGETHER cover every
    // option -- see this function's own header for the measured failure this closes. Absence from
    // BOTH extractions is omission, never a stated exclusion, so an incomplete union establishes
    // NOTHING (not even the direct side's own partial list -- see header: this branch is the ONLY
    // one that ever performs "all minus the other side" completion arithmetic, and that arithmetic
    // is exactly what is forbidden on an incomplete union).
    if (!partitionComplete) {
      // D-BP153-029, THE CORRECTION -- see this function's own D-BP153-029 doc comment, above, for
      // the measured failure and the precise fix. `members` is returned EXACTLY AS PASSED IN: the
      // DIRECTLY STATED values are RETAINED, unexpanded and un-shrunk. What is discarded is only the
      // COMPLEMENT-DERIVED INFERENCE -- the "all minus nonMemberSet" arithmetic the COMPLETE branch
      // below performs -- which this branch never computes at all. Absence is still omission, never
      // a stated exclusion (D-BP153-020, unrelaxed): a `members` that was itself empty stays empty
      // here, because there is nothing directly stated to retain.
      return {
        members,
        nonMembers,
        conflicts,
        partitionComplete: false,
        // D-BP153-023: THE one outcome a caller must NOT treat as "this passage FULLY answered". See
        // establishFrame()'s and extractNamedSetMembers()'s own owned-passage loops -- this is
        // exactly the signal they fall through on, rather than terminating here as the live
        // measured bug (this file's own D-BP153-023 section header) did. UNCHANGED by D-BP153-029:
        // that fall-through is driven by this flag, not by whether `members` is empty.
        incompletePartition: true,
        why: `INCOMPLETE PARTITION (D-BP153-020/D-BP153-029, FD-BP153-07): members ${label(members)} `
          + `and non-members ${label(nonMembers)} do NOT together account for every option -- `
          + `${label(uncovered)} unaccounted for by either extraction. The complement-derived `
          + 'inference (everything the complement did not name) is discarded -- absence is still '
          + `omission, never a stated exclusion. The ${members.length} directly stated value(s) `
          + `${label(members)} are RETAINED.`,
      };
    }
    const reconciledMembers = all.filter((L) => !nonMemberSet.has(L));
    return {
      members: reconciledMembers,
      nonMembers,
      conflicts,
      partitionComplete: true,
      incompletePartition: false, // COMPLETE -- the polar opposite outcome
      why: `complete partition: members ${label(members)} and non-members ${label(nonMembers)} together `
        + `account for all ${all.length} option(s), zero conflicts -- each side corroborates the other `
        + `(reconciled members: ${label(reconciledMembers)})`,
    };
  }
  return {
    members,
    nonMembers,
    conflicts,
    partitionComplete: false,
    // D-BP153-023: the complement said NOTHING at all -- there is no union to be incomplete, this is
    // a direct-only read (or a genuinely silent passage), the SAME class of answer this file already
    // treated as terminal before this ticket, untouched here.
    incompletePartition: false,
    why: 'the complement extracted nothing -- no non-members stated in this passage to reconcile '
      + 'against; using the direct member extraction alone',
  };
}

export interface NamedSetReconciliation {
  /** The reconciled member set -- see reconcileNamedSet()'s own header for exactly when this is the
   *  complement-derived set (a COMPLETE partition) vs. the direct extraction, unreconciled (a
   *  conflict, a silent complement, or -- D-BP153-029 -- an INCOMPLETE partition, where this is the
   *  directly stated `members` passed in, untouched; never the complement-derived inference, and
   *  never forced to `[]` merely because the union left some other option unaccounted for). */
  members: string[];
  nonMembers: string[];
  conflicts: string[];
  partitionComplete: boolean;
  why: string;
  /** D-BP153-023/BISHOP/seg-classify-023 -- INCOMPLETE IS NOT ANSWERED. True in EXACTLY the one
   *  branch below where `nonMembers` said something, there is no conflict, and the union still does
   *  not cover every option in `all` -- the "INCOMPLETE PARTITION" outcome. False in every other
   *  outcome (a conflict, a complete partition, or the complement having said nothing at all), so a
   *  caller can tell "this owned passage did NOT FULLY answer the question" (this flag) apart from
   *  "this owned passage answered, just with zero exclusions/members trusted" (every other
   *  false-but-`members`-is-empty case already produced before this ticket). See establishFrame()'s
   *  and extractNamedSetMembers()'s own owned-passage loops for what a caller does with this: falls
   *  through to the next owned passage, then to a fresh query, rather than terminating here (the
   *  live measured bug this ticket closes -- see this file's own D-BP153-023 section header,
   *  above establishFrame()). Never used to relax `partitionComplete` itself, and never used on the
   *  FRESH-QUERY path (D-BP153-020's safety net there is unchanged: a fresh query that is ALSO
   *  incomplete is still the final answer -- D-BP153-029 changes WHAT that final answer contains --
   *  the directly stated values, not necessarily zero -- never whether it is final: nothing further
   *  to fall through to). */
  incompletePartition: boolean;
}

/** THE SAME instruction/shape both the owned-evidence attempt and the fresh-query path below use
 *  to read a named-set partition out of a passage -- one wording, mirroring
 *  frameExtractionInstruction()'s own reason for existing (above). EXTRACTION ONLY (HARDWIRE-22):
 *  asks the model to copy out names the passage ITSELF states ARE members, never to judge whether
 *  an option belongs.
 *
 *  D-BP153-014, BUG-1(a) FIX. SHARPENED. The real qid 98 passage
 *  ("Only B (South Asia), D (Northeast United States), and E (Europe) are recognized...") measured
 *  gemma4:12b extracting only {B, E} -- D was dropped from a three-name list. The prior wording
 *  never told the model a stated list is EXHAUSTIVE or that a partial copy is wrong; it is silent
 *  on the exact failure mode measured. This version names the "Only X, Y, and Z" shape explicitly
 *  and says a partial copy is wrong, twice, in different words -- still pure copying (HARDWIRE-22
 *  unrelaxed: the model is told WHAT PATTERN to copy completely, never asked to judge which names
 *  belong). See extractNamedSetMembers() below for the second, independent safety net (the
 *  complement extraction + reconcileNamedSet()) this alone does not have to catch every case. */
function namedSetExtractionInstruction(
  all: string[],
  OPT: Record<string, string>,
  direction: 'most' | 'least',
  property: string,
): string {
  return `If this passage states that any of these names IS one of the ${direction} ${property} -- a `
    + 'named member the source itself calls out, not merely a plausible candidate -- copy out exactly '
    + 'those names, spelled as the passage spells them. THE PASSAGE MAY STATE THE MEMBERS AS A LIST, '
    + 'often worded "Only X, Y, and Z..." or "X, Y, and Z are recognized/qualify/are considered...". '
    + 'When it is worded that way, the list is EXHAUSTIVE -- copy out EVERY name in it, not just the '
    + 'first one or two. If the passage names three members, your list must contain all three; copying '
    + 'only one or two of a stated list is WRONG, even if the others are less prominent in the '
    + 'sentence. Copy only names the passage itself states ARE members. If the passage states that '
    + 'none of them are members, return an empty list. Do not decide yourself which ones qualify -- '
    + 'copy only what the passage itself states. For EACH member, also copy out the exact verbatim '
    + 'sentence or clause from the passage that states its membership, word for word, into "span". '
    + `Names: ${all.map((L) => OPT[L]).join('; ')}`;
}
// D-BP153-016, FIX 2: `members` is now a list of {name, span} objects, not bare strings.
const NAMED_SET_EXTRACTION_SHAPE = '{"members":[{"name":"exact name the passage says is one",'
  + '"span":"the exact verbatim sentence from the passage"}],"stated_in_passage":true}';

/** D-BP153-014, BUG-1(b): the complement of namedSetExtractionInstruction() above -- same passage,
 *  same names, asks the OPPOSITE question. His own diagnosis, verbatim: the passage states
 *  non-membership MORE directly than membership ("Options A, C, F, G, H, I... are all correct
 *  choices because none of them are considered... Only B, D, and E qualify"). Structurally the same
 *  shape frameExtractionInstruction() (above) already uses for the FRAME's own exclusion read --
 *  this is that shape, retargeted at the named set's own complement rather than the category. */
function namedSetComplementExtractionInstruction(
  all: string[],
  OPT: Record<string, string>,
  direction: 'most' | 'least',
  property: string,
): string {
  return `If this passage states that any of these names is NOT one of the ${direction} ${property} -- `
    + 'the source itself excludes it from that group, explicitly -- copy out exactly those names, '
    + 'spelled as the passage spells them. THE PASSAGE MAY STATE THE EXCLUDED NAMES AS A LIST (for '
    + 'example, worded "X, Y, and Z are all NOT..." or "none of X, Y, and Z are..."). When it is '
    + 'worded that way, copy out EVERY excluded name in it, not just the first one or two. If the '
    + 'passage excludes none of them, return an empty list. Do not decide yourself which ones qualify '
    + '-- copy only what the passage itself states. For EACH excluded name, also copy out the exact '
    + 'verbatim sentence or clause from the passage that states the exclusion, word for word, into '
    + `"span". Names: ${all.map((L) => OPT[L]).join('; ')}`;
}
// D-BP153-016, FIX 2: `not_members` is now a list of {name, span} objects, not bare strings.
const NAMED_SET_COMPLEMENT_EXTRACTION_SHAPE = '{"not_members":[{"name":"exact name the passage says is not one",'
  + '"span":"the exact verbatim sentence from the passage"}],"stated_in_passage":true}';

/** One passage, BOTH extractions -- the direct member read and its complement, over the identical
 *  already-in-hand text. NO NEW QUERY: two gemmaExtract() calls (local Ollama), never a second
 *  googleBlocks(). Both extracted lists are appearsIn()-verified against `passage` before being
 *  trusted, same choke point every other extraction in this file already uses. Returns the
 *  RECONCILED result (reconcileNamedSet()) so callers never have to re-derive the arithmetic. */
async function extractNamedSetBothSides(
  passage: string,
  all: string[],
  OPT: Record<string, string>,
  direction: 'most' | 'least',
  property: string,
  note: (text: string) => void,
): Promise<NamedSetReconciliation & { rawMembers: string[]; memberSpans: Record<string, string>; discarded: number }> {
  const exMembers = await gemmaExtract(namedSetExtractionInstruction(all, OPT, direction, property), passage, NAMED_SET_EXTRACTION_SHAPE);
  // D-BP153-016, FIX 2: verify the SPAN, not the string -- see extractSpannedLetters() (above) for
  // the discard rule this replaces bare toLetters()+appearsIn() with.
  const direct = extractSpannedLetters(exMembers?.members, passage, OPT);
  // D-BP153-018, THE SYMMETRIC CHECK -- REPORT ONLY, never a rejection here (see
  // reportMembersMissingProperty()'s own header, above, for why this side does not enforce what
  // establishFrame()'s side discards outright).
  reportMembersMissingProperty(direct, property, OPT, note);

  const exNon = await gemmaExtract(
    namedSetComplementExtractionInstruction(all, OPT, direction, property), passage, NAMED_SET_COMPLEMENT_EXTRACTION_SHAPE,
  );
  const complement = extractSpannedLetters(exNon?.not_members, passage, OPT);

  const reconciliation = reconcileNamedSet(all, direct.letters, complement.letters, OPT);
  return {
    ...reconciliation, rawMembers: direct.letters, memberSpans: direct.spans, discarded: direct.discarded + complement.discarded,
  };
}

/**
 * STEP 2, THE NAMED SET. Structurally, byte-for-byte, the same owned-evidence-first shape
 * establishFrame() (above) already uses -- FD-BP153-04's ruling applies here exactly as it does
 * there: "Before a step issues a new query, it must first try to answer that query by EXTRACTING
 * from passages this run has already acquired. A new query is spent only when the owned evidence
 * does not contain the answer." And D-BP153-010's rule extends here unchanged too: an owned
 * passage yielding NOTHING extractable from EITHER extraction is INCONCLUSIVE for this passage,
 * not "named zero members" -- tries the next owned passage, then the query path; and a query
 * response with an EMPTY passage is UNAVAILABLE, never "the source named no members" (see the two
 * D-BP153-010 checks inline below, identical reasoning to establishFrame()'s own, and BUG-2 of
 * D-BP153-014's own dispatch -- the same rule extended here, unchanged from before this ticket).
 *
 * D-BP153-014, BUG-1(b) ADDITION: each passage now yields BOTH the direct member extraction and
 * its complement (extractNamedSetBothSides() above), reconciled before this function decides
 * whether the passage "answered". A passage counts as having answered when EITHER side extracted
 * something (not only when the direct member list is non-empty as before this ticket) -- his own
 * diagnosis is that the complement can be the more directly-stated side, so requiring the direct
 * list alone to be non-empty would miss exactly the passages this fix exists for.
 *
 * EXPORTED for the same reason establishFrame() is exported: so this ticket's own verification
 * can exercise the owned-evidence-first behavior directly (mocked askGoogle/gemmaExtract), no
 * live Ollama or Electron browser automation required.
 */
export async function extractNamedSetMembers(
  askGoogle: MethodRunContext['askGoogle'],
  category: string,
  direction: 'most' | 'least',
  property: string,
  all: string[],
  OPT: Record<string, string>,
  note: (text: string) => void,
  // FD-BP153-04, ADDITIVE/OPTIONAL -- same contract as establishFrame()'s own `ownedPassages`
  // parameter, same accessor. D-BP153-016, FIX 1: now typed OwnedPassage[], not bare string[].
  ownedPassages?: () => OwnedPassage[],
  // D-BP153-024, ADDITIVE/OPTIONAL, placed LAST -- same contract as establishFrame()'s own
  // trailing `askConversationalAuthority` parameter. See obtainCascadePassage()'s own header for
  // the full ruling.
  askConversationalAuthority?: MethodRunContext['askConversationalAuthority'],
): Promise<NamedSetResult> {
  const rawOwned = ownedPassages ? ownedPassages() : [];
  const owned = filterUsableOwnedPassages(rawOwned, all, OPT, 'NAMED SET', note);
  for (let i = 0; i < owned.length; i++) {
    const passage = owned[i].text;
    // eslint-disable-next-line no-await-in-loop -- each owned passage is tried in turn, stopping at
    // the first that yields a verified, non-empty read on either side; extraction over text already
    // sitting in memory (a local Ollama call), never a network fan-out, so nothing here to
    // parallelize.
    const both = await extractNamedSetBothSides(passage, all, OPT, direction, property, note);
    if (both.discarded) {
      note(`   NAMED SET: discarded ${both.discarded} value(s) with no verbatim supporting span (passage ${i + 1} of ${owned.length})`);
    }
    // D-BP153-023/BISHOP/seg-classify-023 -- INCOMPLETE IS NOT ANSWERED, mirrors establishFrame()'s
    // own identical gate (above): this owned passage extracted something, but reconcileNamedSet()
    // came back INCOMPLETE PARTITION -- members and non-members do NOT together account for every
    // option. A partial answer establishes nothing (FD-BP153-07) -- falls through instead of
    // terminating with a false "nothing trusted, done" the way the pre-023 code did.
    if ((both.rawMembers.length || both.nonMembers.length) && both.incompletePartition) {
      note(
        `   NAMED SET: INCOMPLETE PARTITION on owned passage ${i + 1} of ${owned.length} (D-BP153-023) -- `
          + `${both.why} -- this owned passage did NOT answer THE NAMED SET; falling through to `
          + `${i + 1 < owned.length ? 'the next owned passage' : 'a fresh query'}`,
      );
      continue;
    }
    if (both.rawMembers.length || both.nonMembers.length) {
      note(
        `   NAMED SET: answered FROM OWNED EVIDENCE (passage ${i + 1} of ${owned.length}, already acquired `
          + `this run -- NO NEW QUERY ISSUED) -- direct extraction names `
          + `${both.rawMembers.length ? both.rawMembers.map((L) => `${L}) ${OPT[L]}`).join(', ') : '(none)'} as members, `
          + `complement names ${both.nonMembers.length ? both.nonMembers.map((L) => `${L}) ${OPT[L]}`).join(', ') : '(none)'} as non-members`,
      );
      if (both.conflicts.length) {
        note(`   NAMED SET CONFLICT: ${both.conflicts.map((L) => `${L}) ${OPT[L]}`).join(', ')} extracted as BOTH member and non-member -- reported, not resolved`);
      }
      note(`   NAMED SET RECONCILIATION: ${both.why}`);
      return {
        available: true,
        members: both.members,
        rawMembers: both.rawMembers,
        memberSpans: both.memberSpans,
        nonMembers: both.nonMembers,
        conflicts: both.conflicts,
        partitionComplete: both.partitionComplete,
        reconciliationWhy: both.why,
        query: `(owned passage ${i + 1} of ${owned.length}, no query issued)`,
        via: 'owned-passage', answeredFrom: 'owned-passage', ownedPassageIndex: i,
      };
    }
    // D-BP153-010's rule, extended exactly as establishFrame() extends it: nothing extracted from
    // THIS passage (by EITHER side) is inconclusive, not "the source named no members" -- fall
    // through to the next owned passage, then the query path below.
  }
  if (owned.length) {
    note(`   NAMED SET: ${owned.length} owned passage(s) already acquired this run did not name any members -- falling through to a NEW QUERY`);
  }

  // The estate's own query-generation style -- the exact wording this ticket specifies, the same
  // list()/OPT convention every other query in this file already uses.
  const query = `Which of these are ${category} that ARE ${direction} ${property}? Name each one that is. ${list(all, OPT)}`;
  note(`   NAMED SET: ${query}`);
  // D-BP153-031, THE REPEATS RUN FIRST -- mirrors establishFrame()'s own identical wiring (above),
  // see this file's own D-BP153-031 section header for the full ruling. THE NAMED SET's own base
  // question is drawn LB_DRAW_REPEATS times, independently, before D-BP153-026's completion
  // follow-up (below) ever runs. THIS IS THE EXACT QUESTION THE MEASURED FAILURE WAS ON (this
  // file's own D-BP153-031 header: run 06-40Z's single unlucky {C} draw).
  type NamedSetDrawData =
    | { kind: 'not-ok'; res: GoogleAnswer }
    | { kind: 'empty'; res: GoogleAnswer }
    | { kind: 'no-label'; res: GoogleAnswer }
    | { kind: 'extracted'; res: GoogleAnswer; both: Awaited<ReturnType<typeof extractNamedSetBothSides>> };
  const drawRepeats = resolveDrawRepeats();
  const namedSetDrawOutcome = await drawWithAgreement<NamedSetDrawData>('NAMED SET', drawRepeats, async () => {
    // D-BP153-024: tries `askConversationalAuthority` first (when threaded), falls back to Google --
    // see obtainCascadePassage()'s own header, above establishFrame(), for the full ruling.
    const drawRes = await obtainCascadePassage(askGoogle, askConversationalAuthority, 'NAMED SET', query, note);
    if (!drawRes.ok) {
      return { resultKey: 'UNAVAILABLE:not-ok', resultLabel: `no usable answer (${drawRes.via})`, data: { kind: 'not-ok', res: drawRes } };
    }
    // D-BP153-010, mirrored: an EMPTY passage is not the same fact as "the source named zero
    // members" -- see establishFrame()'s own D-BP153-010 comment for the full incident this rule
    // closes; the same failure mode is possible here.
    if (!drawRes.text || !drawRes.text.trim()) {
      return { resultKey: 'UNAVAILABLE:empty', resultLabel: `empty passage (${drawRes.via})`, data: { kind: 'empty', res: drawRes } };
    }
    // D-BP153-016, FIX 3, mirrored for the fresh-query path: a passage naming none of the options
    // cannot state anything about them. D-BP154-001: THE INVALID DRAW -- a FAILED CAPTURE, never a
    // disagreeing answer; see establishFrame()'s own identical D-BP154-001 comment, above.
    if (!passageMentionsAnyLabel(drawRes.text, all, OPT)) {
      return {
        resultKey: 'UNAVAILABLE:no-label', resultLabel: `no option named (${drawRes.via})`, data: { kind: 'no-label', res: drawRes },
        invalid: true, invalidDetail: `answered by ${drawRes.via} -- passage preview: "${passagePreview(drawRes.text)}"`,
      };
    }
    const drawBoth = await extractNamedSetBothSides(drawRes.text, all, OPT, direction, property, note);
    // THE COMPARISON: the EXTRACTED RESULT SET (this section's own header) -- members/nonMembers/
    // conflicts/partitionComplete are exactly the fields runMembershipTerminator() and
    // checkFrameNamedSetConsistency() actually consume downstream.
    const resultKey = JSON.stringify({
      members: [...drawBoth.members].sort(), nonMembers: [...drawBoth.nonMembers].sort(),
      conflicts: [...drawBoth.conflicts].sort(), partitionComplete: drawBoth.partitionComplete,
    });
    const resultLabel = `members {${drawBoth.members.join(',') || 'none'}}, non-members {${drawBoth.nonMembers.join(',') || 'none'}}`
      + `${drawBoth.conflicts.length ? `, conflicts {${drawBoth.conflicts.join(',')}}` : ''}`;
    // D-BP154-001, THE RULE's "other half": a labeled passage from which NEITHER side extracted a
    // single member is uninformative -- never let two such draws "agree" and be trusted.
    const emptyResult = drawBoth.members.length === 0 && drawBoth.nonMembers.length === 0;
    return {
      resultKey, resultLabel, emptyResult, data: { kind: 'extracted', res: drawRes, both: drawBoth },
    };
  }, note);
  if (namedSetDrawOutcome.captureFailure) {
    // D-BP154-001: CAPTURE FAILURE -- see establishFrame()'s own identical branch, above, for the
    // full ruling this mirrors.
    return {
      available: false, members: [], rawMembers: [], memberSpans: {}, nonMembers: [], conflicts: [], partitionComplete: false,
      reconciliationWhy: `unavailable -- CAPTURE FAILURE (D-BP154-001, ${namedSetDrawOutcome.captureFailureReason}), `
        + 'never a disagreement and never a trusted empty named set',
      query, via: 'draw-capture-failure', answeredFrom: 'new-query', ownedPassageIndex: null,
      drawRepeats, drawsIssued: namedSetDrawOutcome.draws.length,
    };
  }
  if (!namedSetDrawOutcome.agreed) {
    // DISAGREEMENT -> UNAVAILABLE, the identical state a named set this function could never
    // establish at all already produces -- never an intersection, union, majority, or first-draw
    // pick. drawWithAgreement() above already reported the FINDING (D-BP153-031) naming every
    // draw's own result set; this is only the caller's consequence of it.
    return {
      available: false, members: [], rawMembers: [], memberSpans: {}, nonMembers: [], conflicts: [], partitionComplete: false,
      reconciliationWhy: `unavailable -- ${drawRepeats} independent draws disagreed (D-BP153-031, THE CHANNEL VARIANCE FINDING)`,
      query, via: 'draw-disagreement', answeredFrom: 'new-query', ownedPassageIndex: null,
      drawRepeats, drawsIssued: namedSetDrawOutcome.draws.length,
    };
  }
  const namedSetTrusted = namedSetDrawOutcome.trusted!.data;
  if (namedSetTrusted.kind === 'not-ok') {
    note(`   NAMED SET: no usable answer (${namedSetTrusted.res.via}) -- the named set is UNAVAILABLE, not empty`);
    return {
      available: false, members: [], rawMembers: [], memberSpans: {}, nonMembers: [], conflicts: [], partitionComplete: false,
      reconciliationWhy: 'unavailable -- no usable answer', query, via: namedSetTrusted.res.via, answeredFrom: 'new-query', ownedPassageIndex: null,
      drawRepeats, drawsIssued: namedSetDrawOutcome.draws.length,
    };
  }
  if (namedSetTrusted.kind === 'empty') {
    note(`   NAMED SET: the source returned an EMPTY passage (${namedSetTrusted.res.via}) -- the named set is UNAVAILABLE, not "no members"`);
    return {
      available: false, members: [], rawMembers: [], memberSpans: {}, nonMembers: [], conflicts: [], partitionComplete: false,
      reconciliationWhy: 'unavailable -- empty passage', query, via: `${namedSetTrusted.res.via} (empty passage)`, answeredFrom: 'new-query', ownedPassageIndex: null,
      drawRepeats, drawsIssued: namedSetDrawOutcome.draws.length,
    };
  }
  if (namedSetTrusted.kind === 'no-label') {
    note(`   NAMED SET: the source's passage (${namedSetTrusted.res.via}) names NONE of the option(s) under test -- the named set is UNAVAILABLE, not "no members"`);
    return {
      available: false, members: [], rawMembers: [], memberSpans: {}, nonMembers: [], conflicts: [], partitionComplete: false,
      reconciliationWhy: 'unavailable -- no option named', query, via: `${namedSetTrusted.res.via} (no option named)`, answeredFrom: 'new-query', ownedPassageIndex: null,
      drawRepeats, drawsIssued: namedSetDrawOutcome.draws.length,
    };
  }
  const { res, both } = namedSetTrusted;
  if (both.discarded) {
    note(`   NAMED SET: discarded ${both.discarded} value(s) with no verbatim supporting span (fresh query)`);
  }
  note(
    `   NAMED SET: answered FROM A NEW QUERY -- direct extraction names `
      + `${both.rawMembers.length ? both.rawMembers.map((L) => `${L}) ${OPT[L]}`).join(', ') : '(nothing)'} as members, `
      + `complement names ${both.nonMembers.length ? both.nonMembers.map((L) => `${L}) ${OPT[L]}`).join(', ') : '(nothing)'} as non-members`,
  );
  if (both.conflicts.length) {
    note(`   NAMED SET CONFLICT: ${both.conflicts.map((L) => `${L}) ${OPT[L]}`).join(', ')} extracted as BOTH member and non-member -- reported, not resolved`);
  }
  // D-BP153-026, THE COMPLETION FOLLOW-UP -- mirrors establishFrame()'s own identical gate (above),
  // see this file's own D-BP153-026 section header (above obtainCascadePassage()) for the full
  // ruling. Fires ONLY here (a FRESH query's own reconciliation came back INCOMPLETE PARTITION),
  // never on an owned-passage read. D-BP153-027 ADDS a second trigger, below -- THIS is the exact
  // shape that ticket's own measured gap was found in (see complementSilentAndPartial()'s own
  // section header, above obtainCascadePassage()): a COMPLEMENT-SILENT read whose direct side did
  // not itself name every option. Either way, AT MOST ONE: this branch runs once per
  // extractNamedSetMembers() call, never re-entered on its own output.
  const namedSetComplementSilentUncovered = both.incompletePartition
    ? [] : complementSilentAndPartial(all, both.rawMembers, both.nonMembers);
  let effective = both;
  if (both.incompletePartition || namedSetComplementSilentUncovered.length) {
    const uncovered = both.incompletePartition
      ? all.filter((L) => !new Set([...both.rawMembers, ...both.nonMembers]).has(L))
      : namedSetComplementSilentUncovered;
    const reason = both.incompletePartition
      ? 'INCOMPLETE PARTITION' : 'COMPLEMENT-SILENT-AND-PARTIAL (D-BP153-027)';
    const followUp = await issueCompletionFollowUp(
      'NAMED SET',
      reason,
      (namesList) => `Which of these are ${category} that ARE ${direction} ${property}? These are the `
        + `ONLY option(s) the first pass left unaccounted for; name each one that is, and state what `
        + `each one is otherwise. ${namesList}`,
      uncovered, all, OPT, askGoogle, askConversationalAuthority, note,
    );
    if (followUp) {
      // The SAME extractor the first pass used, unmodified -- every guard applies to this passage
      // exactly as it did to the first one.
      const followUpBoth = await extractNamedSetBothSides(followUp.text, all, OPT, direction, property, note);
      if (followUpBoth.discarded) {
        note(`   NAMED SET FOLLOW-UP: discarded ${followUpBoth.discarded} value(s) with no verbatim supporting span`);
      }
      // Reconcile the follow-up's values TOGETHER WITH the first pass's values -- the first pass is
      // never discarded, only added to -- then apply the complete-partition test to the union.
      const unionMembers = [...new Set([...both.rawMembers, ...followUpBoth.rawMembers])];
      const unionNonMembers = [...new Set([...both.nonMembers, ...followUpBoth.nonMembers])];
      const merged = reconcileNamedSet(all, unionMembers, unionNonMembers, OPT);
      note(`   NAMED SET FOLLOW-UP RECONCILIATION (D-BP153-026, union of first pass + follow-up): ${merged.why}`);
      effective = {
        ...both,
        members: merged.members,
        rawMembers: unionMembers,
        nonMembers: unionNonMembers,
        conflicts: merged.conflicts,
        partitionComplete: merged.partitionComplete,
        why: merged.why,
        incompletePartition: merged.incompletePartition,
      };
    }
  }
  note(`   NAMED SET RECONCILIATION: ${effective.why}`);
  return {
    available: true,
    members: effective.members,
    rawMembers: effective.rawMembers,
    memberSpans: both.memberSpans,
    nonMembers: effective.nonMembers,
    conflicts: effective.conflicts,
    partitionComplete: effective.partitionComplete,
    reconciliationWhy: effective.why,
    query, via: res.via, answeredFrom: 'new-query', ownedPassageIndex: null,
    drawRepeats, drawsIssued: namedSetDrawOutcome.draws.length,
  };
}

export interface MembershipTerminatorResult {
  /** legitimate-regions (all, minus the frame's own exclusions) MINUS named-set-members. */
  candidates: string[];
  /** candidates[0] when candidates.length === 1, else null. NEVER a forced pick among more than
   *  one survivor -- Step 4, verbatim: "If the difference is not exactly one option, ABSTAIN and
   *  name the surviving candidates. Never pick among them." */
  unique: string | null;
  /** Plain-English rendering of the set arithmetic, for the transcript/basis -- a reader can
   *  audit the verdict (or the abstain) without re-running anything. */
  why: string;
}

// ─────────────────────────── CROSS-QUESTION CONSISTENCY (D-BP153-030) ───────────────────────────
//
// D-BP153-030/BISHOP/seg-cross-question-consistency. THE MEASURED FALSE PASS this closes (live run,
// receipt LIANA_RUN_qid98_2026-08-13T04-55-00-660Z.json): that run PUBLISHED A with ok=true, on a
// basis that reads, verbatim: "frame excluded [G, H, I, B, C, D, F] (new-query); named set of most
// densely populated members [B, D, E] (owned-passage); legitimate-regions {A, E} MINUS
// named-set-members {B, D, E} leaves exactly one candidate: A -- UNIQUE". THE FRAME says B (South
// Asia) and D (Northeast United States) are NOT world regions. THE NAMED SET says B and D are AMONG
// the world's most densely populated REGIONS. Both cannot be true -- a member of "the most densely
// populated world regions" is a world region BY CONSTRUCTION (membership in a named subset of a
// category implies membership in the category itself, for ANY superlative-membership question, not
// just this one). Nothing checked QUESTION 1 (THE SOFTBALLS, the frame) against QUESTION 2 (THE
// NAMED SET) before this ticket, so the run published on a self-contradictory basis -- A survived
// only because the frame was over-aggressive (it excluded B and D too), never because South America
// was distinguished from North Africa/Central Asia on the evidence. The discriminator (STAGE D)
// never ran. Same shape as BP149: right letter, wrong mechanism.
//
// THE RULE: an option THE NAMED SET states is a member must be IN FRAME. If THE FRAME (QUESTION 1)
// excluded an option that THE NAMED SET (QUESTION 2) names as a member (QUESTION 2), that is a
// CONTRADICTION between the two sources' own answers -- not a tie to break, not a case for trusting
// one source over the other.
//
// BEHAVIOR ON CONTRADICTION, per the estate's own standing doctrine on disagreeing sources (this
// file's own FD-BP153-07 "a disagreement here is reported, never resolved by force", and FD-BP152-21
// "ask Google, and also let the Cascade apply, as a check on each other" -- both sources are meant
// to check one another, and a check that disagrees is a FINDING, not noise to silently resolve):
// name every contradicting option and what EACH source said about it, then ABSTAIN. Never pick a
// side (never "trust the named set", never drop the frame exclusion and continue) -- that is exactly
// the silent resolution this rule exists to prevent. Pure function, no I/O, no model call, and no
// access to input.correctAnswer -- it can only ever ABSTAIN, never select a letter, so it cannot be
// tuned toward a key (mirrors runMembershipTerminator()'s own discipline, immediately below).
export interface FrameNamedSetConsistencyResult {
  /** Option letters THE NAMED SET states are members that THE FRAME excluded as not being a member
   *  of the category at all -- empty when the two sources agree on every named-set member. */
  contradictions: string[];
  /** True when every named-set member is in frame (no contradiction) -- the ORIGINAL, unchanged
   *  behavior applies and the membership terminator may run. False means STAGE M must not run this
   *  turn; the caller abstains instead. */
  consistent: boolean;
  /** Plain-English rendering of the check, naming each contradicting option and what the frame said
   *  vs. what the named set said, for the transcript/basis -- a reader can audit the abstain (or the
   *  all-clear) without re-running anything. */
  why: string;
}

/**
 * CROSS-QUESTION CONSISTENCY. Pure function over already-computed inputs -- no I/O, fully testable
 * in isolation, and never reads `KEY`/`input.correctAnswer` (nothing here can select an answer; it
 * can only ever report a contradiction and let the caller abstain). `frameExcluded` is Step 1's own
 * exclusion list (FrameResult.excluded); `members` is Step 2's own named-set membership
 * (NamedSetResult.members). Runs AFTER both have resolved and BEFORE runMembershipTerminator() so
 * the terminator never computes candidates from a contradictory pair.
 */
export function checkFrameNamedSetConsistency(
  frameExcluded: string[],
  members: string[],
  OPT: Record<string, string>,
): FrameNamedSetConsistencyResult {
  const excludedSet = new Set(frameExcluded);
  const contradictions = members.filter((L) => excludedSet.has(L));
  if (!contradictions.length) {
    return {
      contradictions,
      consistent: true,
      why: 'no contradiction -- every named-set member the source named is also in frame',
    };
  }
  const detail = contradictions
    .map((L) => `${L}) ${OPT[L]} -- THE FRAME excluded it (not a member of the category); THE NAMED SET states it IS a member`)
    .join('; ');
  return {
    contradictions,
    consistent: false,
    why: `CONTRADICTION on ${contradictions.length} option${contradictions.length === 1 ? '' : 's'}: ${detail} `
      + '-- a member of a named subset of the category is a member of the category by construction, so both '
      + 'cannot be true; reported as a FINDING, neither source is preferred (FD-BP153-07 x FD-BP152-21)',
  };
}

/**
 * STEP 3, PUT THEM TOGETHER. Pure function over already-computed inputs -- no I/O, fully
 * testable in isolation. `all` is the FULL original option set (mirrors establishFrame()'s own
 * `all` parameter); `frameExcluded` is Step 1's own exclusion list (FrameResult.excluded, already
 * built, not touched by this ticket); `members` is Step 2's own named-set membership
 * (NamedSetResult.members, extractNamedSetMembers() above).
 *
 * candidates = all MINUS frameExcluded MINUS members. unique = candidates.length === 1 ?
 * candidates[0] : null. Nothing else -- no scoring, no weighting, no tiebreak. Same Occam
 * discipline applyOccamElimination() (Stage 1, above) already enforces for criteria, restated
 * here for a named set: a candidate that fails EITHER test (out of frame, or a named member) is
 * eliminated; everything else survives, and a survivor set of size other than 1 abstains rather
 * than being forced.
 */
export function runMembershipTerminator(
  all: string[],
  frameExcluded: string[],
  members: string[],
  OPT: Record<string, string>,
): MembershipTerminatorResult {
  const excludedSet = new Set(frameExcluded);
  const memberSet = new Set(members);
  const legitimate = all.filter((L) => !excludedSet.has(L));
  const candidates = legitimate.filter((L) => !memberSet.has(L));
  const unique = candidates.length === 1 ? candidates[0] : null;
  const legitimateStr = `{${legitimate.map((L) => `${L}) ${OPT[L]}`).join(', ') || 'none'}}`;
  const membersStr = `{${members.map((L) => `${L}) ${OPT[L]}`).join(', ') || 'none'}}`;
  let why: string;
  if (candidates.length === 1) {
    why = `legitimate-regions ${legitimateStr} MINUS named-set-members ${membersStr} leaves exactly one `
      + `candidate: ${candidates[0]}) ${OPT[candidates[0]]} -- UNIQUE`;
  } else if (candidates.length === 0) {
    why = `legitimate-regions ${legitimateStr} MINUS named-set-members ${membersStr} leaves ZERO candidates `
      + '-- every legitimate option was also named a member; not unique, abstaining';
  } else {
    why = `legitimate-regions ${legitimateStr} MINUS named-set-members ${membersStr} leaves `
      + `${candidates.length} candidates (${candidates.map((L) => `${L}) ${OPT[L]}`).join(', ')}) -- not `
      + 'unique, abstaining and naming the survivors (Step 4: never pick among them)';
  }
  return { candidates, unique, why };
}

// ─────────────────────────── STAGE D: THE DISCRIMINATOR ───────────────────────────
//
// D-BP153-015/BISHOP/seg-discriminator. Fires ONLY when STAGE M (the membership terminator, above)
// leaves MORE THAN ONE candidate -- see runSuperlativeByMagnitude()'s own wiring, further below,
// for exactly where this sits between STAGE M and the existing magnitude route (STAGE A onward).
// Mirrors establishFrame()'s and extractNamedSetMembers()'s own shape byte-for-byte: owned evidence
// tried first (FD-BP153-04), ONE query if nothing owned answers it -- never one per candidate,
// Founder BP151 verbatim: "we got rid of four answers with ONE google search" -- extraction only
// (HARDWIRE-22, unrelaxed), every extracted value appearsIn()-verified against its source passage,
// and unique-or-abstain (FD-BP152-19's own "no tie-breakers, ever", restated here for a stated-kind
// distinction rather than a magnitude or a named set).
//
// THE MEASUREMENT THIS CLOSES. Live run 2026-08-12T19:14Z, qid 98: with the frame correctly
// removing the biomes and the named set correctly reconciling to {B, D, E}, the membership
// terminator lands on {A, C, F} -- three legitimate world regions, none a dense cluster. That is a
// CORRECT abstain on the evidence STAGE M alone has (TICKET_D-BP153-015_THE_DISCRIMINATOR.md quotes
// the passage verbatim). His own hand derivation closed it with one more fact the source states:
// the survivors sit at different REGISTERS -- Google's own entity labels call South America and
// Europe "Continent" and North Africa and Central Asia "Colloquial area". This stage asks for
// exactly that fact and extracts it; it never assumes it (that ticket's own "WHY THIS IS NOT A
// TARE" section).
//
// THE ONE TEST FOR ANY RULE HERE (Founder, BP153, verbatim): "would this rule survive on a question
// whose answer we do NOT know?" Eliminating a candidate because the source ITSELF states its kind
// differs from the kind the source ITSELF says the category denotes passes that test. Nothing else
// is built here -- no word list of "which kinds count", no preference for continents over colloquial
// areas (that rule's only justification would be that it yields the known key, which is exactly the
// tare the Founder named and rejected).

/** THE SAME instruction/shape both the owned-evidence attempt and the fresh-query path below use to
 *  read a stated-kind distinction out of a passage -- one wording, mirroring
 *  frameExtractionInstruction()'s and namedSetExtractionInstruction()'s own reason for existing
 *  (above). EXTRACTION ONLY (HARDWIRE-22): asks the model to copy out the passage's OWN
 *  classification word for each survivor, and separately (never conflated into the same field) the
 *  passage's OWN statement of which of those kinds properly denotes the category -- never to judge
 *  which kind is correct itself.
 *
 *  D-BP153-033, ADDITIVE: THE MEASURED FAILURE this paragraph closes (see this file's own
 *  D-BP153-033 section header, at establishFrame()'s fresh-query path, for the full receipt) is not
 *  a judgment defect -- it is a SHAPE the per-item reading missed entirely. A passage can state every
 *  option's kind by GROUPING options under a category heading ("Category 1: Macro-Geographic /
 *  Socio-Political Regions  A) South America (Continent) B) South Asia (Sub-continental realm) ...")
 *  rather than stating "A) South America: Continent" per line. The heading NAMES the kind just as
 *  plainly as a per-item line does -- reading it and attributing it to the names listed beneath it is
 *  PURE COPYING, not a judgment about whether that kind qualifies as anything (HARDWIRE-22
 *  unrelaxed: this paragraph only tells the model WHERE a stated kind may be written, never which
 *  kind counts). The per-item shape (a kind stated directly on the name's own line) is unchanged and
 *  must keep working exactly as it does today; this is an ADDITIONAL shape the same read now also
 *  recognizes. */
function discriminatorExtractionInstruction(candidates: string[], OPT: Record<string, string>, category: string): string {
  return 'For each of these names, copy out exactly what KIND of thing the passage states it is '
    + '(for example "Continent", "Colloquial area", "Subcontinent", "Climatic zone") -- the '
    + "passage's own classification word or phrase for that name, verbatim, spelled as the passage "
    + 'spells it, AND the exact verbatim sentence or clause the kind was read from, into "span". The '
    + 'passage may state a kind two different ways: (1) directly on the name\'s own line (for example '
    + '"A) South America: Continent"), or (2) by GROUPING several names under a category heading that '
    + 'itself names the kind (for example a heading reading "Category 1: Macro-Geographic / '
    + 'Socio-Political Regions" followed by a list of names underneath it, with no kind word on any '
    + "individual name's own line). When the passage uses the SECOND shape, every name listed under a "
    + "heading takes THAT HEADING's own stated kind as its kind -- copy the heading's kind text "
    + 'verbatim into "kind", and into "span" copy the verbatim text that ties the name to its heading '
    + "(the heading line itself, or the heading line together with the name's own line beneath it) so "
    + 'the tie can be checked against the passage. This is still copying only -- never decide yourself '
    + 'whether a heading\'s kind qualifies as anything, only which heading (if any) a name sits under. '
    + 'Use null (and an empty span) for a name whose kind the passage does not state either way. '
    + 'SEPARATELY, if the '
    + `passage ALSO states which of those stated kinds properly counts as a ${category} -- the `
    + 'formal or correct kind for that category, AS THE PASSAGE ITSELF SAYS SO, never your own '
    + 'judgment -- copy that kind verbatim too, in category_kind, with its own verbatim sentence in '
    + 'category_kind_span. Use null (and an empty span) there if the passage does not state this. Do '
    + 'not decide yourself which kind is correct or which kind the category means -- copy only what '
    + `the passage states. Names: ${candidates.map((L) => OPT[L]).join('; ')}`;
}
// D-BP153-016, FIX 2: each kind entry, and category_kind, now carries its own verbatim span.
const DISCRIMINATOR_EXTRACTION_SHAPE = '{"kinds":[{"name":"exact name","kind":"exact kind as the '
  + 'passage states it, or null","span":"the exact verbatim sentence stating this name\'s kind, or '
  + 'empty"}],"category_kind":"the kind the passage states properly denotes the category, or null",'
  + '"category_kind_span":"the exact verbatim sentence stating which kind properly denotes the '
  + 'category, or empty","stated_in_passage":true}';

/** One passage, the discriminator's own read -- appearsIn()-verified per candidate AND for
 *  category_kind, exactly the same choke point every other extraction in this file already uses.
 *  Matching an extracted `{name, kind}` entry back to a candidate letter is normalized-string
 *  equality only (norm()), the same "similarity is not identity" discipline toLetters() already
 *  enforces elsewhere in this estate -- never fuzzy.
 *
 *  D-BP153-016, FIX 2: a kind (or category_kind) is accepted only when its OWN span is verbatim in
 *  `passage` (spanIsVerbatim(), above) and that span contains the kind text (appearsIn(span,
 *  kindText)) -- bare presence of the kind text anywhere in the passage is no longer sufficient.
 *  Every rejection for a name that DID carry a (non-null) kind is a DISCARD, counted and returned so
 *  the caller can note it. */
async function extractDiscriminatorKinds(
  passage: string,
  candidates: string[],
  OPT: Record<string, string>,
  category: string,
): Promise<{
  kinds: Record<string, string | null>;
  // D-BP153-032, ADDITIVE: the verbatim span each verified kind was read from -- undefined for a
  // candidate whose kind is null. Discriminator callers (below, unchanged) already destructure only
  // `{ kinds, categoryKind, discarded }`, so an extra field on this return is a no-op for them.
  // THE SOFTBALLS (establishFrame(), above) reuse this SAME extractor (D-BP153-032's own header, at
  // establishFrame()) and need the spans to run D-BP153-018's property-span discard over a
  // stated-kind read, exactly as it already runs over the old exclusion/inclusion reads.
  kindSpans: Record<string, string>;
  categoryKind: string | null;
  categoryKindSpan: string | null;
  discarded: number;
  // D-BP153-034: true when the model hit its token ceiling and the JSON was cut off mid-object.
  // A truncated read and a genuinely empty read BOTH arrive as all-nulls; this is the only thing
  // that tells them apart, and conflating them is what hid the defect for an entire session.
  truncated: boolean;
}> {
  const rawOut: { text?: string; truncated?: boolean } = {};
  const ex = await gemmaExtract(
    discriminatorExtractionInstruction(candidates, OPT, category), passage, DISCRIMINATOR_EXTRACTION_SHAPE, rawOut,
  );
  const truncated = rawOut.truncated === true;
  const rawKinds = (ex?.kinds as Array<{ name?: unknown; kind?: unknown; span?: unknown }> | undefined) ?? [];
  const kinds: Record<string, string | null> = {};
  const kindSpans: Record<string, string> = {};
  let discarded = 0;
  for (const L of candidates) {
    const entry = rawKinds.find((r) => norm(r?.name) === norm(OPT[L]));
    const kindText = entry && typeof entry.kind === 'string' ? entry.kind.trim() : '';
    const span = entry && typeof entry.span === 'string' ? entry.span.trim() : '';
    const verified = !!kindText && !!span && spanIsVerbatim(passage, span) && appearsIn(span, kindText) && appearsIn(passage, OPT[L]);
    if (verified) {
      kinds[L] = kindText;
      kindSpans[L] = span;
    } else {
      kinds[L] = null;
      if (kindText) discarded++; // a kind was stated but its span did not verify -- counted, not silently dropped
    }
  }
  const rawCategoryKind = typeof ex?.category_kind === 'string' ? ex.category_kind.trim() : '';
  const categoryKindSpan = typeof ex?.category_kind_span === 'string' ? ex.category_kind_span.trim() : '';
  const categoryKindVerified = !!rawCategoryKind && !!categoryKindSpan
    && spanIsVerbatim(passage, categoryKindSpan) && appearsIn(categoryKindSpan, rawCategoryKind);
  const categoryKind = categoryKindVerified ? rawCategoryKind : null;
  if (rawCategoryKind && !categoryKindVerified) discarded++;
  return {
    kinds, kindSpans, categoryKind, categoryKindSpan: categoryKindVerified ? categoryKindSpan : null, discarded, truncated,
  };
}

export interface DiscriminatorElimination {
  letter: string;
  statedKind: string;
  reason: string;
}

export interface DiscriminatorEliminationResult {
  survivors: string[];
  unique: string | null;
  eliminations: DiscriminatorElimination[];
  why: string;
}

/** Pure set arithmetic, no I/O -- mirrors runMembershipTerminator()'s own discipline (Step 3,
 *  above): mechanical only, never a model call, never a guess, never a tie-break.
 *
 *  Eliminates a candidate ONLY when ALL THREE hold:
 *   (a) EVERY candidate has a stated kind -- partial information does not eliminate. This is
 *       UNKNOWN IS UNMEASURED, NEVER BAD (this file's own header rule, Stage 1), restated here: a
 *       candidate this passage never characterized is not thereby cleared OR condemned, so this
 *       refuses to act at all rather than eliminate around a gap.
 *   (b) the survivors do not all share the same stated kind -- there must BE a distinction to act
 *       on, or there is nothing for a category-kind statement to discriminate between.
 *   (c) the passage states which kind properly denotes `category`, AND that stated kind is one of
 *       the kinds actually present among the candidates (an unrecognized categoryKind names nothing
 *       here and is not usable). Because (c) requires categoryKind to be one of the PRESENT kinds,
 *       at least one candidate always matches it -- survivors can never be an empty set here.
 *
 *  When all three hold, every candidate whose stated kind does not match categoryKind is
 *  eliminated. Otherwise nothing is eliminated and every original candidate survives, unresolved --
 *  the honest abstain FD-BP152-19 already requires everywhere else in this file. Exported, same
 *  reason runMembershipTerminator() is exported: so this ticket's own verification can exercise the
 *  elimination arithmetic directly, without a mocked askGoogle/gemmaExtract round trip. */
export function applyDiscriminatorElimination(
  candidates: string[],
  kinds: Record<string, string | null>,
  categoryKind: string | null,
  category: string,
  OPT: Record<string, string>,
): DiscriminatorEliminationResult {
  const label = (Ls: string[]) => `{${Ls.map((L) => `${L}) ${OPT[L]}`).join(', ') || 'none'}}`;
  const missingKind = candidates.filter((L) => !kinds[L]);
  if (missingKind.length) {
    return {
      survivors: candidates,
      unique: null,
      eliminations: [],
      why: `${missingKind.length} of ${candidates.length} candidate(s) have no STATED kind `
        + `(${label(missingKind)}) -- partial information does not eliminate; no elimination performed, `
        + `all ${candidates.length} candidate(s) survive`,
    };
  }
  const presentKinds = [...new Set(candidates.map((L) => kinds[L] as string))];
  if (presentKinds.length <= 1) {
    return {
      survivors: candidates,
      unique: null,
      eliminations: [],
      why: `all ${candidates.length} candidates share the same stated kind ("${presentKinds[0] ?? 'none'}") `
        + '-- no distinction to eliminate on',
    };
  }
  if (!categoryKind || !presentKinds.includes(categoryKind)) {
    return {
      survivors: candidates,
      unique: null,
      eliminations: [],
      why: categoryKind
        ? `the survivors are stated to differ in kind (${presentKinds.map((k) => `"${k}"`).join(', ')}), but `
          + `the stated category kind ("${categoryKind}") does not match any of them -- unusable, no `
          + 'elimination performed'
        : `the survivors are stated to differ in kind (${presentKinds.map((k) => `"${k}"`).join(', ')}), but `
          + `the passage does not state which kind properly denotes "${category}" -- no elimination performed`,
    };
  }
  // categoryKind is guaranteed to be one of presentKinds here, so survivors.length >= 1 always.
  const survivors = candidates.filter((L) => kinds[L] === categoryKind);
  const eliminations: DiscriminatorElimination[] = candidates
    .filter((L) => kinds[L] !== categoryKind)
    .map((L) => ({
      letter: L,
      statedKind: kinds[L] as string,
      reason: `stated kind "${kinds[L]}" differs from "${categoryKind}", the kind the source states `
        + `properly denotes ${category}`,
    }));
  const unique = survivors.length === 1 ? survivors[0] : null;
  const why = unique
    ? `stated kind "${categoryKind}" (the category's own kind, per the source) uniquely identifies `
      + `${survivors[0]}) ${OPT[survivors[0]]} -- ${eliminations.map((e) => `${e.letter}) ${OPT[e.letter]} `
        + `eliminated (${e.reason})`).join('; ')}`
    : `${survivors.length} candidates share the category's stated kind ("${categoryKind}") `
      + `${label(survivors)} -- not unique, abstaining and naming the survivors`;
  return { survivors, unique, eliminations, why };
}

export interface DiscriminatorResult {
  survivors: string[];
  unique: string | null;
  eliminations: DiscriminatorElimination[];
  kinds: Record<string, string | null>;
  categoryKind: string | null;
  why: string;
  query: string;
  via: string;
  answeredFrom: 'owned-passage' | 'new-query' | 'not-fired';
  ownedPassageIndex: number | null;
  /** D-BP153-031, ADDITIVE/OPTIONAL -- mirrors FrameResult's own pair, same contract, see there. */
  drawRepeats?: number;
  drawsIssued?: number;
}

/**
 * STAGE D, THE DISCRIMINATOR. `candidates` is STAGE M's own non-unique survivor set
 * (MembershipTerminatorResult.candidates, runMembershipTerminator() above) -- this function never
 * re-derives it. Fires only on `candidates.length > 1` (guarded here too, defensively, not only by
 * the caller -- see the early return below); on 0 or 1 nothing here runs and no query is issued.
 *
 * EXPORTED for the same reason establishFrame() and extractNamedSetMembers() are exported: so this
 * ticket's own verification can exercise the owned-evidence-first behavior directly (mocked
 * askGoogle/gemmaExtract), no live Ollama or Electron browser automation required.
 */
export async function runDiscriminator(
  askGoogle: MethodRunContext['askGoogle'],
  category: string,
  candidates: string[],
  OPT: Record<string, string>,
  note: (text: string) => void,
  // FD-BP153-04, ADDITIVE/OPTIONAL -- same contract as establishFrame()'s and
  // extractNamedSetMembers()'s own `ownedPassages` parameter, same accessor. D-BP153-016, FIX 1:
  // now typed OwnedPassage[], not bare string[].
  ownedPassages?: () => OwnedPassage[],
  // D-BP153-024, ADDITIVE/OPTIONAL, placed LAST -- same contract as establishFrame()'s and
  // extractNamedSetMembers()'s own trailing `askConversationalAuthority` parameter. See
  // obtainCascadePassage()'s own header for the full ruling.
  askConversationalAuthority?: MethodRunContext['askConversationalAuthority'],
): Promise<DiscriminatorResult> {
  if (candidates.length <= 1) {
    return {
      survivors: candidates,
      unique: candidates[0] ?? null,
      eliminations: [],
      kinds: {},
      categoryKind: null,
      why: 'STAGE D never fires on 0 or 1 candidates (Founder, BP153: fires only when the membership '
        + 'terminator leaves more than one) -- nothing changes here',
      query: '(not issued -- candidates.length <= 1)',
      via: 'not-fired',
      answeredFrom: 'not-fired',
      ownedPassageIndex: null,
    };
  }

  const rawOwned = ownedPassages ? ownedPassages() : [];
  const owned = filterUsableOwnedPassages(rawOwned, candidates, OPT, 'DISCRIMINATOR', note);
  for (let i = 0; i < owned.length; i++) {
    const passage = owned[i].text;
    // eslint-disable-next-line no-await-in-loop -- each owned passage is tried in turn, stopping at
    // the first that yields a verified, usable read; extraction over text already sitting in memory
    // (a local Ollama call), never a network fan-out, so there is nothing here to parallelize
    // against -- same convention establishFrame()/extractNamedSetMembers() already use.
    const { kinds, categoryKind, discarded } = await extractDiscriminatorKinds(passage, candidates, OPT, category);
    if (discarded) {
      note(`   DISCRIMINATOR: discarded ${discarded} value(s) with no verbatim supporting span (passage ${i + 1} of ${owned.length})`);
    }
    const anyKindOrCategory = Object.values(kinds).some((k) => k != null) || categoryKind != null;
    // D-BP153-023/BISHOP/seg-classify-023 -- INCOMPLETE IS NOT ANSWERED, applied to STAGE D's own
    // completeness notion: "account for every option" here means a STATED KIND for every candidate
    // (applyDiscriminatorElimination()'s own (a) requirement, "partial information does not
    // eliminate" -- missingKind, below, is that same gap). Before this ticket, a passage stating a
    // kind for even ONE of several candidates was treated as having "answered" and terminated the
    // step -- exactly the same premature-termination shape establishFrame() and
    // extractNamedSetMembers() had for THE SOFTBALLS/THE NAMED SET, restated here for STAGE D:
    // partial per-candidate coverage is not an answer, it falls through to the next owned passage,
    // then to STAGE D's own one fresh query (unchanged below, the safety net: a fresh query that is
    // ALSO incomplete is still the final answer -- applyDiscriminatorElimination() already reports
    // "partial information does not eliminate" for that case, nothing further to fall through to).
    const missingKind = candidates.filter((L) => kinds[L] == null);
    if (anyKindOrCategory && missingKind.length > 0) {
      const label = (Ls: string[]) => `{${Ls.map((L) => `${L}) ${OPT[L]}`).join(', ') || 'none'}}`;
      note(
        `   DISCRIMINATOR: INCOMPLETE on owned passage ${i + 1} of ${owned.length} (D-BP153-023) -- `
          + `${missingKind.length} of ${candidates.length} candidate(s) have no stated kind `
          + `${label(missingKind)} -- this owned passage did NOT answer STAGE D; falling through to `
          + `${i + 1 < owned.length ? 'the next owned passage' : 'a fresh query'}`,
      );
      continue;
    }
    if (anyKindOrCategory) {
      const result = applyDiscriminatorElimination(candidates, kinds, categoryKind, category, OPT);
      note(
        `   DISCRIMINATOR: answered FROM OWNED EVIDENCE (passage ${i + 1} of ${owned.length}, already `
          + `acquired this run -- NO NEW QUERY ISSUED) -- ${result.why}`,
      );
      return {
        survivors: result.survivors, unique: result.unique, eliminations: result.eliminations, kinds, categoryKind,
        why: result.why, query: `(owned passage ${i + 1} of ${owned.length}, no query issued)`,
        via: 'owned-passage', answeredFrom: 'owned-passage', ownedPassageIndex: i,
      };
    }
    // Nothing extractable from THIS passage (D-BP153-010's rule, extended exactly as
    // establishFrame() and extractNamedSetMembers() extend it): inconclusive, not "no distinction
    // stated" -- try the next owned passage, then the query path below.
  }
  if (owned.length) {
    note(`   DISCRIMINATOR: ${owned.length} owned passage(s) already acquired this run did not state a usable kind -- falling through to a NEW QUERY`);
  }

  // ONE QUERY, over the survivors only -- never one per candidate. Founder, BP151, verbatim: "we
  // got rid of four answers with ONE google search."
  //
  // D-BP153-028 FIX. THE MEASURED GAP (live run, receipt
  // LIANA_RUN_qid98_2026-08-13T03-57-15-514Z.json). The OLD wording asked only what KIND each
  // option is -- it never asked what kind of thing `category` ITSELF properly denotes.
  // applyDiscriminatorElimination() (above) has always required BOTH a stated kind per candidate
  // AND a stated categoryKind before it will eliminate anything; the live run got all three stated
  // kinds ("A continent", "A macro-region", "A landlocked region") but no categoryKind, because the
  // question never asked for it -- so the run correctly, but avoidably, abstained. This is the SAME
  // single query, extended with ONE more clause asking the SAME source what kind `category` itself
  // denotes -- never a second call (Founder, BP151, verbatim, above). Extraction of the answer is
  // UNCHANGED (discriminatorExtractionInstruction()/DISCRIMINATOR_EXTRACTION_SHAPE, above, already
  // ask for category_kind separately from each candidate's own kind, span-verified exactly the same
  // way) -- only the QUESTION SENT TO THE SOURCE changes, so the source has a chance to state it.
  //
  // HARDWIRE-22 UNRELAXED, FD-BP153-06 ("would this rule survive on a question whose answer we do
  // not know?"): this asks the source to STATE which kind denotes the category -- it does not ask
  // the source (or Gemma, downstream) to JUDGE which candidate is correct, and it does not prefer
  // any particular kind. If the source states a categoryKind that eliminates the historically
  // correct candidate, applyDiscriminatorElimination() eliminates it -- that is the intended,
  // honest behavior (this file's own header, and the ticket's own "CRITICAL HONESTY REQUIREMENT").
  const query = `What kind of ${category} is each of these, how do they differ from one another, `
    + `and which of those kinds properly denotes "${category}"? ${list(candidates, OPT)}`;
  note(`   DISCRIMINATOR: ${query}`);
  // D-BP153-031, THE REPEATS RUN FIRST -- mirrors establishFrame()'s and extractNamedSetMembers()'s
  // own identical wiring (above), see this file's own D-BP153-031 section header for the full
  // ruling. STAGE D's own base question is drawn LB_DRAW_REPEATS times, independently; STAGE D has
  // no completion follow-up of its own (D-BP153-026 names only THE SOFTBALLS and THE NAMED SET), so
  // there is no ordering to state beyond "the repeats are the whole fresh-query path here".
  type DiscriminatorDrawData =
    | { kind: 'not-ok'; res: GoogleAnswer }
    | { kind: 'empty'; res: GoogleAnswer }
    | { kind: 'no-label'; res: GoogleAnswer }
    | { kind: 'extracted'; res: GoogleAnswer; kinds: Record<string, string | null>; categoryKind: string | null; discarded: number };
  const drawRepeats = resolveDrawRepeats();
  const discriminatorDrawOutcome = await drawWithAgreement<DiscriminatorDrawData>('DISCRIMINATOR', drawRepeats, async () => {
    // D-BP153-024: tries `askConversationalAuthority` first (when threaded), falls back to Google --
    // see obtainCascadePassage()'s own header, above establishFrame(), for the full ruling.
    const drawRes = await obtainCascadePassage(askGoogle, askConversationalAuthority, 'DISCRIMINATOR', query, note);
    if (!drawRes.ok) {
      return { resultKey: 'UNAVAILABLE:not-ok', resultLabel: `no usable answer (${drawRes.via})`, data: { kind: 'not-ok', res: drawRes } };
    }
    if (!drawRes.text || !drawRes.text.trim()) {
      return { resultKey: 'UNAVAILABLE:empty', resultLabel: `empty passage (${drawRes.via})`, data: { kind: 'empty', res: drawRes } };
    }
    // D-BP153-016, FIX 3, mirrored for the fresh-query path: a passage naming none of the candidates
    // cannot state anything about them. D-BP154-001: THE INVALID DRAW -- a FAILED CAPTURE, never a
    // disagreeing answer; see establishFrame()'s own identical D-BP154-001 comment, above.
    if (!passageMentionsAnyLabel(drawRes.text, candidates, OPT)) {
      return {
        resultKey: 'UNAVAILABLE:no-label', resultLabel: `no option named (${drawRes.via})`, data: { kind: 'no-label', res: drawRes },
        invalid: true, invalidDetail: `answered by ${drawRes.via} -- passage preview: "${passagePreview(drawRes.text)}"`,
      };
    }
    const { kinds: drawKinds, categoryKind: drawCategoryKind, discarded: drawDiscarded } = await extractDiscriminatorKinds(drawRes.text, candidates, OPT, category);
    // THE COMPARISON: the EXTRACTED RESULT SET (this section's own header) -- the stated kind per
    // candidate plus the stated category kind are exactly what applyDiscriminatorElimination()
    // consumes; sorted by candidate letter so key order never causes a spurious disagreement.
    const resultKey = JSON.stringify({
      kinds: candidates.map((L) => [L, drawKinds[L]]), categoryKind: drawCategoryKind,
    });
    const resultLabel = `kinds {${candidates.map((L) => `${L}:${drawKinds[L] ?? 'null'}`).join(', ')}}, categoryKind=${drawCategoryKind ?? 'null'}`;
    // D-BP154-001, THE RULE's "other half" -- the MEASURED case this ticket's own header names
    // (runs 16-29-46-988Z/16-59-33-658Z, `kinds {A:null...I:null}` on EVERY draw): a labeled
    // passage from which NO candidate's kind and NO category kind was ever extracted.
    const emptyResult = candidates.every((L) => drawKinds[L] == null) && drawCategoryKind == null;
    return {
      resultKey, resultLabel, emptyResult, data: {
        kind: 'extracted', res: drawRes, kinds: drawKinds, categoryKind: drawCategoryKind, discarded: drawDiscarded,
      },
    };
  }, note);
  if (discriminatorDrawOutcome.captureFailure) {
    // D-BP154-001: CAPTURE FAILURE -- see establishFrame()'s own identical branch, above, for the
    // full ruling this mirrors.
    note(`   DISCRIMINATOR: CAPTURE FAILURE (D-BP154-001, ${discriminatorDrawOutcome.captureFailureReason}) -- ABSTAIN, naming all ${candidates.length} candidate(s)`);
    return {
      survivors: candidates, unique: null, eliminations: [],
      kinds: Object.fromEntries(candidates.map((L) => [L, null])), categoryKind: null,
      why: `CAPTURE FAILURE (D-BP154-001, ${discriminatorDrawOutcome.captureFailureReason}) -- `
        + `never a disagreement and never a trusted empty read -- ABSTAIN naming ${candidates.join(', ')}, no elimination performed`,
      query, via: 'draw-capture-failure', answeredFrom: 'new-query', ownedPassageIndex: null,
      drawRepeats, drawsIssued: discriminatorDrawOutcome.draws.length,
    };
  }
  if (!discriminatorDrawOutcome.agreed) {
    // DISAGREEMENT -> UNAVAILABLE, the identical ABSTAIN-naming-every-candidate state a discriminator
    // read this function could never establish at all already produces -- never an intersection,
    // union, majority, or first-draw pick. drawWithAgreement() above already reported the FINDING
    // (D-BP153-031) naming every draw's own result set; this is only the caller's consequence of it.
    note(`   DISCRIMINATOR: DRAWS DISAGREED (D-BP153-031) -- ABSTAIN, naming all ${candidates.length} candidate(s)`);
    return {
      survivors: candidates, unique: null, eliminations: [],
      kinds: Object.fromEntries(candidates.map((L) => [L, null])), categoryKind: null,
      why: `${drawRepeats} independent draws disagreed (D-BP153-031, THE CHANNEL VARIANCE FINDING) -- `
        + `ABSTAIN naming ${candidates.join(', ')}, no elimination performed`,
      query, via: 'draw-disagreement', answeredFrom: 'new-query', ownedPassageIndex: null,
      drawRepeats, drawsIssued: discriminatorDrawOutcome.draws.length,
    };
  }
  const discriminatorTrusted = discriminatorDrawOutcome.trusted!.data;
  if (discriminatorTrusted.kind === 'not-ok') {
    note(`   DISCRIMINATOR: no usable answer (${discriminatorTrusted.res.via}) -- ABSTAIN, naming all ${candidates.length} candidate(s)`);
    return {
      survivors: candidates, unique: null, eliminations: [],
      kinds: Object.fromEntries(candidates.map((L) => [L, null])), categoryKind: null,
      why: `no usable answer (${discriminatorTrusted.res.via}) -- ABSTAIN naming ${candidates.join(', ')}, no elimination performed`,
      query, via: discriminatorTrusted.res.via, answeredFrom: 'new-query', ownedPassageIndex: null,
      drawRepeats, drawsIssued: discriminatorDrawOutcome.draws.length,
    };
  }
  if (discriminatorTrusted.kind === 'empty') {
    note(`   DISCRIMINATOR: the source returned an EMPTY passage (${discriminatorTrusted.res.via}) -- ABSTAIN, naming all ${candidates.length} candidate(s)`);
    return {
      survivors: candidates, unique: null, eliminations: [],
      kinds: Object.fromEntries(candidates.map((L) => [L, null])), categoryKind: null,
      why: `empty passage (${discriminatorTrusted.res.via}) -- ABSTAIN naming ${candidates.join(', ')}, no elimination performed`,
      query, via: `${discriminatorTrusted.res.via} (empty passage)`, answeredFrom: 'new-query', ownedPassageIndex: null,
      drawRepeats, drawsIssued: discriminatorDrawOutcome.draws.length,
    };
  }
  if (discriminatorTrusted.kind === 'no-label') {
    note(`   DISCRIMINATOR: the source's passage (${discriminatorTrusted.res.via}) names NONE of the candidate(s) under test -- ABSTAIN, naming all ${candidates.length} candidate(s)`);
    return {
      survivors: candidates, unique: null, eliminations: [],
      kinds: Object.fromEntries(candidates.map((L) => [L, null])), categoryKind: null,
      why: `no candidate named (${discriminatorTrusted.res.via}) -- ABSTAIN naming ${candidates.join(', ')}, no elimination performed`,
      query, via: `${discriminatorTrusted.res.via} (no option named)`, answeredFrom: 'new-query', ownedPassageIndex: null,
      drawRepeats, drawsIssued: discriminatorDrawOutcome.draws.length,
    };
  }
  const { res, kinds, categoryKind, discarded } = discriminatorTrusted;
  if (discarded) {
    note(`   DISCRIMINATOR: discarded ${discarded} value(s) with no verbatim supporting span (fresh query)`);
  }
  const result = applyDiscriminatorElimination(candidates, kinds, categoryKind, category, OPT);
  note(`   DISCRIMINATOR: answered FROM A NEW QUERY -- ${result.why}`);
  return {
    survivors: result.survivors, unique: result.unique, eliminations: result.eliminations, kinds, categoryKind,
    why: result.why, query, via: res.via, answeredFrom: 'new-query', ownedPassageIndex: null,
    drawRepeats, drawsIssued: discriminatorDrawOutcome.draws.length,
  };
}

/** Reads the option sitting at a named extreme out of a most-to-least-worded ordering array
 *  (index 0 = the "most" end, last index = the "least" end) -- structural index lookup only; the
 *  CALLER supplies which array (mostToLeast-worded vs leastToMost-worded) so this stays a plain
 *  lookup, never a guess at which end is which. */
function extremeOf(ordering: string[], end: 'first' | 'last'): string | null {
  if (!ordering.length) return null;
  return end === 'first' ? ordering[0] : ordering[ordering.length - 1];
}

export interface ExtremeAgreementCheck {
  targetExtreme: 'most' | 'least';
  primaryCandidate: string | null;
  qcCandidate: string | null;
  contradictsElimination: boolean;
  agrees: boolean;
  candidate: string | null;
  notes: string[];
}

/** His check, structurally. "Two ways to make sure it's correct... to check accuracy of the same
 *  engine that I asked" (step 3) -- the two PRIMARY-direction queries (over the survivor pool) must
 *  agree at the target extreme. "As a quality control" (step 4) -- the two QC-direction queries
 *  (over EVERY option, including ones the litmus-strip loop already eliminated) must ALSO agree at
 *  the target extreme, AND that QC extreme must not be an option the loop already eliminated -- if
 *  it is, "that contradicts an earlier elimination and MUST be reported, not silently ignored."
 *  Any of these three checks failing is reported as a disagreement; NONE of them force a winner --
 *  "a disagreement here is a failure to report, never a tie to break." */
function checkExtremeAgreement(
  targetExtreme: 'most' | 'least',
  pool: string[],
  mostToLeast: OrderingQueryResult,
  leastToMost: OrderingQueryResult,
  mostToLeastQC: OrderingQueryResult,
  leastToMostQC: OrderingQueryResult,
): ExtremeAgreementCheck {
  const notes: string[] = [];
  const primaryReadings = [
    { label: mostToLeast.label, L: extremeOf(mostToLeast.ordering, targetExtreme === 'most' ? 'first' : 'last') },
    { label: leastToMost.label, L: extremeOf(leastToMost.ordering, targetExtreme === 'most' ? 'last' : 'first') },
  ];
  const qcReadings = [
    { label: mostToLeastQC.label, L: extremeOf(mostToLeastQC.ordering, targetExtreme === 'most' ? 'first' : 'last') },
    { label: leastToMostQC.label, L: extremeOf(leastToMostQC.ordering, targetExtreme === 'most' ? 'last' : 'first') },
  ];
  for (const r of [...primaryReadings, ...qcReadings]) {
    notes.push(`   extreme-agreement reading (${targetExtreme}): ${r.label} -> ${r.L ?? '(no usable ordering)'}`);
  }

  const primaryUsable = primaryReadings.filter((r): r is { label: string; L: string } => r.L != null);
  let primaryCandidate: string | null = null;
  if (primaryUsable.length && new Set(primaryUsable.map((r) => r.L)).size === 1) {
    primaryCandidate = primaryUsable[0].L;
  } else if (primaryUsable.length > 1) {
    notes.push(
      `   DISAGREEMENT between the two primary directions at the ${targetExtreme} extreme -- `
        + `${primaryUsable.map((r) => `${r.label}=${r.L}`).join(', ')} -- his words: "two ways to make sure it's `
        + 'correct"; reported, not resolved',
    );
  }

  const qcUsable = qcReadings.filter((r): r is { label: string; L: string } => r.L != null);
  let qcCandidate: string | null = null;
  if (qcUsable.length && new Set(qcUsable.map((r) => r.L)).size === 1) {
    qcCandidate = qcUsable[0].L;
  } else if (qcUsable.length > 1) {
    notes.push(
      `   DISAGREEMENT between the two quality-control directions at the ${targetExtreme} extreme -- `
        + `${qcUsable.map((r) => `${r.label}=${r.L}`).join(', ')} -- reported, not resolved`,
    );
  }

  const contradictsElimination = qcCandidate != null && !pool.includes(qcCandidate);
  if (contradictsElimination) {
    notes.push(
      `   QC (all options re-included) puts ${qcCandidate} at the ${targetExtreme} extreme, but ${qcCandidate} was `
        + `already eliminated by the litmus-strip loop (not in the survivor pool: ${pool.join(', ')}) -- this `
        + 'CONTRADICTS the earlier elimination and is reported here, per his own quality-control step, never '
        + 'silently ignored',
    );
  } else if (primaryCandidate != null && qcCandidate != null && primaryCandidate !== qcCandidate) {
    notes.push(
      `   DISAGREEMENT between the primary pass (${primaryCandidate}) and the quality-control pass (${qcCandidate}) `
        + `at the ${targetExtreme} extreme -- reported, not resolved`,
    );
  }

  const agrees = primaryCandidate != null && primaryCandidate === qcCandidate && !contradictsElimination;
  if (agrees) {
    notes.push(`   extreme-agreement: the primary pass and the quality-control pass agree -- ${targetExtreme} extreme is ${primaryCandidate}`);
  }
  return { targetExtreme, primaryCandidate, qcCandidate, contradictsElimination, agrees, candidate: agrees ? primaryCandidate : null, notes };
}

/** Numeric density figures per option, harvested from the SAME four ordering passages already
 *  fetched above -- NO NEW askGoogle CALL, the identical "don't pay for evidence twice" discipline
 *  THE CONVERGENCE (above) already established for the criteria-stack route. His own transcript
 *  shows exactly this: the ordering answers themselves cite per-region figures ("G) Nile Valley:
 *  ~1,000 to over 40,000 people per km2..."), never a separate numbers-only query at this stage.
 *  Uses the SAME figure-extraction shape and toPerSqKm() unit-rate proof comparative_cascade.ts's
 *  own stage 5 already uses (imported, not copied) -- a non-density superlative property will
 *  simply fail toPerSqKm()'s unit-RATE test for every candidate and bind nothing, the honest,
 *  conservative outcome (reported as zero observations, never guessed at). */
async function harvestDensityObservations(
  passages: OrderingQueryResult[],
  pool: string[],
  OPT: Record<string, string>,
  note: (text: string) => void,
): Promise<Record<string, number[]>> {
  const densityObservations: Record<string, number[]> = {};
  for (const p of passages) {
    if (!p.ok || !p.raw || !p.raw.ok) continue;
    const passageText = p.raw.text;
    // eslint-disable-next-line no-await-in-loop -- extraction over one already-fetched passage at
    // a time, same convention THE CONVERGENCE section above uses, for the identical reason.
    const ex = await gemmaExtract(
      'Copy out every number in this passage that appears together with a unit or rate (for example '
        + '"per square kilometer", "%", "/km2", "per sq mi"). For each one, copy the surrounding words '
        + 'exactly as they appear.',
      passageText,
      '{"figures":[{"value":number,"unit":"the unit as written","context":"the verbatim surrounding text"}]}',
    );
    for (const f of (ex?.figures as Array<{ value: number; unit?: string; context: string }> | undefined) ?? []) {
      if (typeof f.value !== 'number') continue;
      if (!appearsIn(passageText, f.context)) continue;
      const ctxNorm = norm(String(f.context || ''));
      for (const L of pool) {
        if (!ctxNorm.includes(norm(OPT[L]))) continue;
        const c = toPerSqKm(f.value, f.unit, f.context);
        if (c.ok) {
          (densityObservations[L] ??= []).push(c.value);
          note(`   [${p.label}] harvested observation for ${OPT[L]}: ${c.value.toFixed(2)} ${c.unit} (as written: ${f.value} ${f.unit ?? 'no unit'})`);
        } else {
          note(`   [${p.label}] candidate for ${OPT[L]} rejected: ${f.value} ${f.unit ?? '(no unit field)'} -- ${c.reason}`);
        }
      }
    }
  }
  return densityObservations;
}

/** THE ROUTE, end to end. Detection already happened in run() (extractSuperlativeMatch()) before
 *  this is called -- `match` is passed in, never re-derived, so there is exactly one place in this
 *  file that decides "is this a superlative question". */
export async function runSuperlativeByMagnitude(
  input: MethodQuestionInput,
  ctx: MethodRunContext,
  match: SuperlativeMatch,
): Promise<LianaTerminalOutcome> {
  const { emit, askGoogle } = ctx;
  const OPT = input.options as Record<string, string>;
  const ALL = Object.keys(OPT);
  const KEY = input.correctAnswer;
  const t0 = Date.now();

  // D-BP153-028 FIX: THE QUERY BILL'S ROOT CAUSE, MEASURED (not assumed) by reading every call site
  // below before writing this. THE OLD BILL COUNTED ONLY `askGoogle` CALLS. D-BP153-024 (above,
  // obtainCascadePassage()) routes THE SOFTBALLS/THE NAMED SET/THE DISCRIMINATOR's fresh queries AND
  // D-BP153-026's completion follow-ups through `ctx.askConversationalAuthority` FIRST when it is
  // threaded -- and every one of the three call sites below (establishFrame(), extractNamedSetMembers(),
  // runDiscriminator()) was passed the RAW `ctx.askConversationalAuthority`, never a counted wrapper,
  // while `askGoogle` itself was already routed through `countedAskGoogle`. So a run answered
  // end-to-end by the conversational authority (live receipt LIANA_RUN_qid98_2026-08-13T03-57-15-514Z.
  // json: five queries actually sent and answered by user_gemini, per the transcript's own
  // "ANSWERED BY:"/"query SENT to conversational authority" lines and the seven records the evidence
  // store held) billed itself "0 queries issued -- 0 of 3 answered", the exact contradiction this
  // ticket names. Fixed the same way `countedAskGoogle` already was: a matching counted wrapper for
  // the second authority, so BOTH channels are tallied by the same live count of the exact calls that
  // produce the evidence records, never a second, independently-derived guess.
  let queriesIssued = 0;
  let googleQueriesIssued = 0;
  let conversationalQueriesIssued = 0;
  let followUpsIssued = 0;
  // D-BP153-031: THE REPEAT COUNT AND HOW MANY DRAWS WERE ISSUED, so the cost of repeated-draw
  // agreement is visible in the SAME bill as every other query this route spends. `drawRepeats` is
  // read ONCE here (LB_DRAW_REPEATS does not change mid-run); `totalDrawsIssued` accumulates each of
  // THE SOFTBALLS/THE NAMED SET/THE DISCRIMINATOR's own `drawsIssued` (undefined -- an
  // owned-evidence answer, or a call site predating this ticket -- counts as 0, never NaN) as each
  // stage resolves below. Every draw a stage issues already runs through `countedAskGoogle` /
  // `countedAskConversationalAuthority` (obtainCascadePassage() is called from inside each draw), so
  // `queriesIssued` above ALREADY reflects the repeats byte-for-byte; `totalDrawsIssued` is the same
  // fact stated in the repeats' own units (draws, not raw queries) so a reader does not have to do
  // the arithmetic by hand to see it reconcile.
  const drawRepeats = resolveDrawRepeats();
  let totalDrawsIssued = 0;
  // D-BP154-001, THE RULE rule 6: "Extend THE QUERY BILL to count the replacement draws, so the
  // cost of failed captures is visible without reading the ledger." `totalDrawsIssued` already
  // includes every replacement draw (drawWithAgreement() reports EVERY attempt in `draws.length`,
  // valid and invalid alike -- see its own D-BP154-001 header, above) so the total was already
  // correct; this is the SAME fact restated in its own units (draws issued ABOVE `drawRepeats`,
  // i.e. spent solely on replacing an invalid draw) so a reader sees the failed-capture cost without
  // doing `totalDrawsIssued - N * drawRepeats` by hand.
  let totalReplacementDrawsIssued = 0;
  /** D-BP154-001: draws beyond `drawRepeats` on ONE stage's own `drawsIssued` were spent replacing
   *  an invalid draw (drawWithAgreement() only ever issues more than `drawRepeats` attempts to
   *  replace one -- see its own header). `undefined` (owned-evidence, zero draws) contributes 0. */
  const replacementDrawsOf = (issued: number | undefined) => Math.max(0, (issued ?? 0) - drawRepeats);

  const say = (text: string) => emit({ kind: 'header', text, ts: nowIso() });
  const step = (text: string) => emit({ kind: 'stage', text: `-> ${text}`, ts: nowIso() });
  // D-BP153-026's own issueCompletionFollowUp() (above) unconditionally emits a note beginning
  // "<LABEL> FOLLOW-UP (D-BP153-026):" as the FIRST thing it does whenever it is invoked (i.e.
  // whenever establishFrame()/extractNamedSetMembers() decide to spend the one-shot completion
  // follow-up) -- this is the one point common to every follow-up, regardless of which authority
  // ultimately answers it, so counting that exact, already-emitted marker (rather than threading a
  // new counter parameter through issueCompletionFollowUp() and both of its callers) tallies "how
  // many completion follow-ups were issued" from the same live transcript the rest of the bill reads,
  // with no change to either function's signature or behavior.
  const note = (text: string) => {
    if (/ FOLLOW-UP \(D-BP153-026\):/.test(text)) followUpsIssued++;
    emit({ kind: 'note', text, ts: nowIso() });
  };

  // D-BP153-017, ITEM 4: THE QUERY BILL. Every query THIS route actually issues goes through one of
  // these two counted wrappers -- they are the SAME askGoogle/askConversationalAuthority the
  // evidence-writing layer upstream of ctx already writes one evidence record per call for
  // (evidence_authority.ts, not touched here), so this tally is never a second, independently-derived
  // guess at what the ledger holds; it is a live count of the exact calls that produce it. Neither
  // `askGoogle` nor `ctx.askConversationalAuthority` (destructured/read above) is called directly
  // again below this point -- every call site in this function goes through `countedAskGoogle` /
  // `countedAskConversationalAuthority` (or `countedCtx`, for runLitmusStripLoop()'s own internal
  // calls) instead.
  const countedAskGoogle: MethodRunContext['askGoogle'] = async (q) => {
    queriesIssued++;
    googleQueriesIssued++;
    return askGoogle(q);
  };
  // `undefined` when `ctx.askConversationalAuthority` itself is undefined -- obtainCascadePassage()
  // (D-BP153-024) already treats an undefined askConversationalAuthority as "no conversational
  // authority is wired for this call, go straight to Google", and this preserves that exactly (a
  // wrapper that always ran would turn "not wired" into "wired but always refuses", a different fact).
  const countedAskConversationalAuthority: MethodRunContext['askConversationalAuthority'] = ctx.askConversationalAuthority
    ? async (q) => {
      queriesIssued++;
      conversationalQueriesIssued++;
      return ctx.askConversationalAuthority!(q);
    }
    : undefined;
  const countedCtx: MethodRunContext = {
    ...ctx, askGoogle: countedAskGoogle, askConversationalAuthority: countedAskConversationalAuthority,
  };
  // THE THREE QUESTIONS THIS RUN ATTEMPTED, and which of them THE DOUBLECHECK/owned-evidence-first
  // discipline (FD-BP153-04) resolved WITHOUT spending a query -- named as it happens below, read
  // back by queryBillNote() at every exit point so the saving is visible without reading the
  // ledger (ticket's own words).
  const questionsAttempted: string[] = [];
  const answeredFromOwned: string[] = [];
  /** Emits ONE note naming: queries issued this run (split by which authority answered them), how
   *  many of THE THREE QUESTIONS were answered from owned evidence (no new query), how many
   *  completion follow-ups (D-BP153-026) were issued, and that the per-option denotation sweep
   *  (Survey's own FD-BP152-01 fallback) was skipped on this route -- always true here, since this
   *  function only ever runs when extractSuperlativeMatch() already matched (the SAME structural
   *  gate survey_stage.ts's own Step 3 gate now tests, D-BP153-017, so this fact and that skip can
   *  never disagree). Called at every exit point below, not only the final one, so an abstain's own
   *  transcript states the bill too. D-BP153-028: the leading "N quer(y/ies) issued this run" clause
   *  is UNCHANGED wording/position from before this ticket (every pre-existing assertion on it still
   *  matches) -- the authority split, the follow-up count, and everything after are ADDITIVE. */
  const queryBillNote = () => note(
    `   QUERY BILL: ${queriesIssued} quer${queriesIssued === 1 ? 'y' : 'ies'} issued this run `
      + `(${conversationalQueriesIssued} to the conversational authority, ${googleQueriesIssued} to Google) -- `
      + `${answeredFromOwned.length} of ${questionsAttempted.length} question(s) asked `
      + `(${questionsAttempted.join(', ') || 'none'}) answered from OWNED EVIDENCE, no new query `
      + `(${answeredFromOwned.join(', ') || 'none'}); ${followUpsIssued} completion follow-up${followUpsIssued === 1 ? '' : 's'} issued `
      + '(D-BP153-026); 1 per-option denotation sweep SKIPPED -- redundant '
      + 'by construction on the superlative path (FD-BP152-01 fallback; D-BP153-017); '
      + `LB_DRAW_REPEATS=${drawRepeats} (D-BP153-031), ${totalDrawsIssued} draw${totalDrawsIssued === 1 ? '' : 's'} issued across `
      + "THE SOFTBALLS/THE NAMED SET/THE DISCRIMINATOR's own base question(s) "
      + `(${totalReplacementDrawsIssued} of which ${totalReplacementDrawsIssued === 1 ? 'was a REPLACEMENT draw' : 'were REPLACEMENT draws'} `
      + 'for an INVALID capture, D-BP154-001) -- included in, never '
      + `on top of, the ${queriesIssued} quer${queriesIssued === 1 ? 'y' : 'ies'} counted above`,
  );

  say(`METHOD classify-cascade / superlative-by-magnitude -- ${input.qid != null ? `qid ${input.qid}` : 'free-text'}`);
  note(`   ${input.question}`);
  note(`   ${ALL.map((L) => `${L}) ${OPT[L]}`).join('  ')}`);
  note(
    '   Founder ruling, BP152, verbatim: "Yes. that. now code it, please" -- a superlative membership question '
      + 'resolves by ranking the options by the property the superlative names, per his own hand-worked '
      + 'walkthrough (FOUNDER_CASCADE_WORKED_BY_HAND_VERBATIM_RECOVERED_BP144.md, lines 35-100)',
  );

  const complement = questionDemandsComplement(input.question);
  const scopeTerm = extractClassifyCandidateTerms(input.question).find((t) => t.role === 'scope')?.term;
  const category = scopeTerm ?? 'options';
  const { property } = match;
  const targetExtreme = complement ? oppositeExtreme(match.direction) : match.direction;
  step(
    `SUPERLATIVE DETECTED -- direction="${match.direction}" property="${property}" category="${category}" `
      + `${complement ? 'NOT-question (complement demanded)' : 'direct question'} -- target extreme for membership: ${targetExtreme}`,
  );

  // FD-BP153-01 -- THE FRAME RUNS FIRST. See establishFrame()'s own header for the ruling, the
  // measurement behind it, and why a word list was not built here.
  // D-BP153-017, ITEM 2: THE THREE QUESTIONS, NAMED. This is QUESTION 1, THE SOFTBALLS -- "which
  // of these are not <category> at all?" (TICKET_D-BP153-017_THE_THREE_QUESTIONS.md). "STAGE 0"
  // is kept verbatim in the label (not just "QUESTION 1") so every pre-existing transcript/test
  // assertion on that token is unaffected -- this is an ADDITIVE label, not a rename.
  step(`STAGE 0 / QUESTION 1  THE SOFTBALLS (FD-BP153-01/FD-BP153-07) -- which options are NOT ${category} at all? Non-members are never ranked`);
  questionsAttempted.push('THE SOFTBALLS');
  // FD-BP153-04: `ctx.ownedPassages` (MethodRunContext, ADDITIVE/OPTIONAL) is threaded through here
  // so establishFrame() tries extraction from evidence this run already owns before it spends a
  // new query -- see establishFrame()'s own header for the ruling and the measurement behind it.
  // D-BP153-024: `ctx.askConversationalAuthority` threaded through as the trailing argument, same
  // additive/optional pattern `ctx.ownedPassages` already established -- see
  // obtainCascadePassage()'s own header for the full ruling.
  const frame = await establishFrame(countedAskGoogle, category, ALL, OPT, note, ctx.ownedPassages, property, countedAskConversationalAuthority);
  totalDrawsIssued += frame.drawsIssued ?? 0;
  totalReplacementDrawsIssued += replacementDrawsOf(frame.drawsIssued);
  if (frame.answeredFrom === 'owned-passage') answeredFromOwned.push('THE SOFTBALLS');
  if (!frame.available) {
    // FD-BP153-01 consequence 2, verbatim: "A magnitude result with no frame is NOT definitive."
    // Falling back to ranking the unframed pool is exactly the confident-wrong-answer generator
    // this ruling exists to close -- on qid 98 that fallback answers G (Arctic Circle) against a
    // key of A, because it ranks biomes alongside continents.
    step('ABSTAIN -- the frame could not be established, and an UNFRAMED magnitude result is not definitive (FD-BP153-01)');
    queryBillNote();
    emit({ kind: 'result', text: `ABSTAIN (frame unavailable -- ${frame.via})${KEY != null ? `  key=${KEY}` : ''}`, ts: nowIso() });
    return {
      qid: input.qid,
      question: input.question,
      verdict: null,
      correct: KEY,
      abstain: true,
      freeText: input.qid == null,
      basis: `superlative-by-magnitude route: the frame query ("${frame.query}") returned no usable answer `
        + `(${frame.via}). Per FD-BP153-01 a superlative resolves by magnitude INSIDE THE FRAME; with no frame `
        + 'established, ranking the full option list would compare members of the category against things that '
        + 'are not members of it at all, so this abstains rather than publishing an unframed extreme',
    };
  }
  const framed = ALL.filter((L) => !frame.excluded.includes(L));
  if (!framed.length) {
    step(`ABSTAIN -- the frame excluded every option; nothing is a ${category} to rank`);
    queryBillNote();
    emit({ kind: 'result', text: `ABSTAIN (frame excluded every option)${KEY != null ? `  key=${KEY}` : ''}`, ts: nowIso() });
    return {
      qid: input.qid,
      question: input.question,
      verdict: null,
      correct: KEY,
      abstain: true,
      freeText: input.qid == null,
      basis: `superlative-by-magnitude route: the frame excluded all ${ALL.length} options as not being ${category}; `
        + 'nothing remains to order by magnitude',
    };
  }
  note(`   FRAME: ${framed.length} of ${ALL.length} option(s) remain in frame -- ${framed.join(', ')}`);

  // ── STAGE M: THE MEMBERSHIP TERMINATOR (FD-BP152-19 x FD-BP153-01) ─────────────────────────
  // See this file's own "THE NAMED SET, and THE MEMBERSHIP TERMINATOR" section header (above
  // establishFrame()... below it, structurally) for the full derivation and the measurement
  // behind it. Runs AFTER the frame (Step 1, above) and BEFORE Stage A/B (the litmus-strip loop
  // and the four ordering queries) -- if it resolves, NEITHER of those ever runs, which is the
  // whole point: it saves the queries that got this machine rate-limited. If it does not resolve
  // (named set unavailable, or the difference is not exactly one option), this falls through to
  // the EXISTING magnitude path below, completely unchanged -- not one line of Stage A onward is
  // touched by this block.
  // D-BP153-017, ITEM 2: QUESTION 2, THE NAMED SET -- "which of these ARE <the superlative
  // property>?" STAGE M (the membership terminator, below) is what PUTS the two questions
  // together (frame minus named set); the question itself is asked here. "STAGE M" is kept
  // verbatim (additive label, not a rename -- same reasoning as STAGE 0/QUESTION 1 above).
  step(`STAGE M / QUESTION 2  THE NAMED SET (FD-BP152-19 x FD-BP153-01) -- which options ARE ${match.direction} ${property}? Does a NAMED SET resolve this without ranking?`);
  questionsAttempted.push('THE NAMED SET');
  // D-BP153-024: same threading as establishFrame(), above.
  const namedSet = await extractNamedSetMembers(countedAskGoogle, category, match.direction, property, ALL, OPT, note, ctx.ownedPassages, countedAskConversationalAuthority);
  totalDrawsIssued += namedSet.drawsIssued ?? 0;
  totalReplacementDrawsIssued += replacementDrawsOf(namedSet.drawsIssued);
  if (namedSet.answeredFrom === 'owned-passage') answeredFromOwned.push('THE NAMED SET');
  if (namedSet.available) {
    // D-BP153-030: CROSS-QUESTION CONSISTENCY. Must run BEFORE runMembershipTerminator() -- see
    // checkFrameNamedSetConsistency()'s own section header (above) for the full ruling and the
    // measured false pass (qid 98, receipt LIANA_RUN_qid98_2026-08-13T04-55-00-660Z.json) this
    // closes. The terminator must never compute candidates from a frame/named-set pair that
    // contradict each other.
    const consistency = checkFrameNamedSetConsistency(frame.excluded, namedSet.members, OPT);
    note(`   CROSS-QUESTION CONSISTENCY (D-BP153-030): ${consistency.why}`);
    if (!consistency.consistent) {
      step(
        `ABSTAIN -- THE FRAME and THE NAMED SET contradict each other on `
          + `${consistency.contradictions.map((L) => `${L}) ${OPT[L]}`).join(', ')}; reporting the contradiction, `
          + 'never silently resolving it (FD-BP153-07 x FD-BP152-21) -- Stage D, Stage A\'s litmus-strip loop, and '
          + 'Stage B\'s four ordering queries were never issued',
      );
      queryBillNote();
      emit({
        kind: 'result',
        text: `ABSTAIN (frame/named-set contradiction on ${consistency.contradictions.join(', ')})${KEY != null ? `  key=${KEY}` : ''}`,
        ts: nowIso(),
      });
      note(`   ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      return {
        qid: input.qid,
        question: input.question,
        verdict: null,
        correct: KEY,
        abstain: true,
        freeText: input.qid == null,
        basis: `superlative-by-magnitude route, CROSS-QUESTION CONSISTENCY (D-BP153-030): frame excluded `
          + `[${frame.excluded.join(', ') || 'none'}] (${frame.answeredFrom}); named set of ${match.direction} `
          + `${property} members [${namedSet.members.join(', ') || 'none'}] (${namedSet.answeredFrom}); `
          + `${consistency.why}`,
      };
    }
    const termination = runMembershipTerminator(ALL, frame.excluded, namedSet.members, OPT);
    note(`   MEMBERSHIP TERMINATOR: ${termination.why}`);
    if (termination.unique) {
      const winner = termination.unique;
      const ok = KEY != null ? winner === KEY : undefined;
      step(
        `PUBLISH -- ${winner} (${OPT[winner]}) -- the named set resolved uniquely; Stage A's litmus-strip loop `
          + 'and Stage B\'s four ordering queries were never issued',
      );
      queryBillNote();
      emit({
        kind: 'result',
        text: `${KEY != null ? (ok ? 'CORRECT' : 'WRONG') : 'ANSWER'}  ${winner} (${OPT[winner]})  via membership terminator${KEY != null ? `  key=${KEY}` : ''}`,
        ts: nowIso(),
      });
      note(`   ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      return {
        qid: input.qid,
        question: input.question,
        verdict: winner,
        correct: KEY,
        ok,
        abstain: false,
        freeText: input.qid == null,
        basis: `superlative-by-magnitude route, MEMBERSHIP TERMINATOR (FD-BP152-19's Occam elimination applied to a `
          + `NAMED SET, FD-BP153-01 frame first): frame excluded [${frame.excluded.join(', ') || 'none'}] `
          + `(${frame.answeredFrom}); named set of ${match.direction} ${property} members `
          + `[${namedSet.members.join(', ') || 'none'}] (${namedSet.answeredFrom}); ${termination.why}`,
      };
    }
    // D-BP153-015 -- STAGE D, THE DISCRIMINATOR. Fires ONLY here: the membership terminator ran,
    // named the survivors, and left MORE THAN ONE. On zero candidates (below, unchanged) or a
    // single candidate (already returned above) this is never reached and nothing changes. See
    // this file's own "STAGE D: THE DISCRIMINATOR" section header (above) for the full derivation.
    if (termination.candidates.length > 1) {
      // D-BP153-017, ITEM 2: QUESTION 3, THE DISCRIMINATOR -- "what kind is each survivor, and
      // what kind does <category> denote?" Fires only here, per the ticket's own shape. "STAGE D"
      // is kept verbatim (additive label, not a rename -- same reasoning as STAGE 0/1, STAGE M/2).
      step(
        `STAGE D / QUESTION 3  THE DISCRIMINATOR (D-BP153-015) -- what kind is each survivor, and what kind does `
          + `${category} denote? The membership terminator left ${termination.candidates.length} candidates `
          + `(${termination.candidates.join(', ')}); does a STATED KIND distinction resolve it?`,
      );
      questionsAttempted.push('THE DISCRIMINATOR');
      // D-BP153-024: same threading as establishFrame()/extractNamedSetMembers(), above.
      const discriminator = await runDiscriminator(countedAskGoogle, category, termination.candidates, OPT, note, ctx.ownedPassages, countedAskConversationalAuthority);
      totalDrawsIssued += discriminator.drawsIssued ?? 0;
      totalReplacementDrawsIssued += replacementDrawsOf(discriminator.drawsIssued);
      if (discriminator.answeredFrom === 'owned-passage') answeredFromOwned.push('THE DISCRIMINATOR');
      if (discriminator.unique) {
        const winner = discriminator.unique;
        const ok = KEY != null ? winner === KEY : undefined;
        step(
          `PUBLISH -- ${winner} (${OPT[winner]}) -- the discriminator resolved uniquely on a STATED kind `
            + 'distinction; Stage A\'s litmus-strip loop and Stage B\'s four ordering queries were never issued',
        );
        queryBillNote();
        emit({
          kind: 'result',
          text: `${KEY != null ? (ok ? 'CORRECT' : 'WRONG') : 'ANSWER'}  ${winner} (${OPT[winner]})  via discriminator${KEY != null ? `  key=${KEY}` : ''}`,
          ts: nowIso(),
        });
        note(`   ${((Date.now() - t0) / 1000).toFixed(1)}s`);
        return {
          qid: input.qid,
          question: input.question,
          verdict: winner,
          correct: KEY,
          ok,
          abstain: false,
          freeText: input.qid == null,
          basis: `superlative-by-magnitude route, THE DISCRIMINATOR (STAGE D, D-BP153-015 -- fires on the `
            + `membership terminator's own ${termination.candidates.length}-candidate non-unique result): frame `
            + `excluded [${frame.excluded.join(', ') || 'none'}] (${frame.answeredFrom}); named set `
            + `[${namedSet.members.join(', ') || 'none'}] (${namedSet.answeredFrom}); STAGE M candidates `
            + `[${termination.candidates.join(', ')}] (${termination.why}); ${discriminator.why}`,
        };
      }
      step(
        `ABSTAIN -- the discriminator could not resolve the membership terminator's `
          + `${termination.candidates.length} candidates to a unique answer; naming the survivors, never picking `
          + 'among them (FD-BP152-19)',
      );
      queryBillNote();
      emit({
        kind: 'result',
        text: `ABSTAIN (discriminator: ${discriminator.survivors.join(', ')})${KEY != null ? `  key=${KEY}` : ''}`,
        ts: nowIso(),
      });
      note(`   ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      return {
        qid: input.qid,
        question: input.question,
        verdict: null,
        correct: KEY,
        abstain: true,
        freeText: input.qid == null,
        basis: `superlative-by-magnitude route, THE DISCRIMINATOR (STAGE D, D-BP153-015): the membership `
          + `terminator left ${termination.candidates.length} candidates [${termination.candidates.join(', ')}] `
          + `(${termination.why}); ${discriminator.why} -- ABSTAIN naming `
          + `[${discriminator.survivors.join(', ')}], never picking among survivors (FD-BP152-19)`,
      };
    }
    note('   MEMBERSHIP TERMINATOR did not resolve uniquely -- falling through to the magnitude route, unchanged');
  } else {
    note(`   NAMED SET unavailable (${namedSet.via}) -- falling through to the magnitude route, unchanged`);
  }

  step('STAGE A  narrow the pool -- reuses runLitmusStripLoop() (Stage 2 above) UNCHANGED, no seed criteria');
  // `countedCtx` (not the bare `ctx` this function received), so every query the litmus-strip loop
  // itself issues (via ctx.askGoogle, internally) is counted into THE QUERY BILL too.
  const loop = await runLitmusStripLoop(input, countedCtx, [], note);
  note(
    `   loop stopped: ${loop.stoppedReason}   criteria applied: ${loop.criteria.length}   `
      + `eliminations: ${loop.eliminations.length}   survivors: ${loop.survivors.join(', ') || '(none)'}`,
  );
  if (!loop.survivors.length) {
    step('ABSTAIN -- zero survivors after the litmus-strip loop; nothing left to rank');
    queryBillNote();
    emit({ kind: 'result', text: `ABSTAIN (zero survivors)${KEY != null ? `  key=${KEY}` : ''}`, ts: nowIso() });
    return {
      qid: input.qid,
      question: input.question,
      verdict: null,
      correct: KEY,
      abstain: true,
      freeText: input.qid == null,
      basis: `superlative-by-magnitude route: property="${property}" -- zero survivors after ${loop.criteria.length} `
        + `criterion/criteria (loop stopped: ${loop.stoppedReason}); nothing left to order by magnitude`,
    };
  }
  // FD-BP153-01: the frame is applied to the ranking pool HERE, so nothing outside the category is
  // ever ordered by magnitude. The litmus loop above is left UNCHANGED (it eliminates on criteria,
  // a different job from deciding what is a candidate at all); the frame is intersected with its
  // survivors rather than threaded through it, which keeps this ticket out of that function.
  const pool = loop.survivors.filter((L) => framed.includes(L));
  const droppedByFrame = loop.survivors.filter((L) => !framed.includes(L));
  if (droppedByFrame.length) {
    note(`   FRAME applied to the ranking pool: dropped ${droppedByFrame.map((L) => `${L}) ${OPT[L]}`).join(', ')} -- not ${category}, so never ranked`);
  }
  if (!pool.length) {
    step(`ABSTAIN -- every litmus-loop survivor was outside the frame; nothing that is a ${category} remains to rank`);
    queryBillNote();
    emit({ kind: 'result', text: `ABSTAIN (no in-frame survivors)${KEY != null ? `  key=${KEY}` : ''}`, ts: nowIso() });
    return {
      qid: input.qid,
      question: input.question,
      verdict: null,
      correct: KEY,
      abstain: true,
      freeText: input.qid == null,
      basis: `superlative-by-magnitude route: the litmus loop left survivors [${loop.survivors.join(', ')}], but the `
        + `frame excluded all of them as not being ${category}; nothing in frame remains to order by magnitude`,
    };
  }

  step('STAGE B  order the pool by the property, both directions, as separate queries (his own check on the engine)');
  const mostToLeast = await askOrdering(countedAskGoogle, category, property, 'most-to-least', pool, OPT, 'Q1 most-to-least', note);
  const leastToMost = await askOrdering(countedAskGoogle, category, property, 'least-to-most', pool, OPT, 'Q2 least-to-most', note);

  // FD-BP153-01: QC re-includes every option the FRAME kept, not every option on the question.
  // His QC exists to check that an ELIMINATION was right, and a frame exclusion is not an
  // elimination -- re-including a biome here would reintroduce exactly the out-of-category
  // candidate the frame just removed, and on qid 98 that is the Arctic Circle walking back in.
  step(`STAGE C  quality control -- same two directions, re-asked, all IN-FRAME options re-included (his own stages 4/5)`);
  const mostToLeastQC = await askOrdering(countedAskGoogle, category, property, 'most-to-least', framed, OPT, 'Q3 most-to-least (QC, in-frame options)', note);
  const leastToMostQC = await askOrdering(countedAskGoogle, category, property, 'least-to-most', framed, OPT, 'Q4 least-to-most (QC, in-frame options)', note);

  const agreement = checkExtremeAgreement(targetExtreme, pool, mostToLeast, leastToMost, mostToLeastQC, leastToMostQC);
  for (const n of agreement.notes) note(n);

  const elapsedS = () => (Date.now() - t0) / 1000;

  if (!agreement.agrees) {
    step('ABSTAIN -- orderings do not agree at the target extreme (or none was usable, or QC contradicted an elimination); reporting, not resolving');
    queryBillNote();
    emit({ kind: 'result', text: `ABSTAIN (ordering disagreement at ${targetExtreme} extreme)${KEY != null ? `  key=${KEY}` : ''}`, ts: nowIso() });
    return {
      qid: input.qid,
      question: input.question,
      verdict: null,
      correct: KEY,
      abstain: true,
      freeText: input.qid == null,
      basis: `superlative-by-magnitude route: property="${property}" direction=${match.direction}`
        + `${complement ? ' (complement demanded)' : ''} target extreme=${targetExtreme} -- orderings disagreed, were `
        + `unusable, or the QC pass contradicted an earlier elimination at that extreme (primary=${agreement.primaryCandidate ?? 'none'}, `
        + `qc=${agreement.qcCandidate ?? 'none'}, contradictsElimination=${agreement.contradictsElimination}); per his own `
        + 'instruction, a disagreement here is reported, never resolved by force',
    };
  }

  if (targetExtreme === 'most') {
    step(
      'ABSTAIN -- target extreme is "most", but the reused terminator (evaluateComparativeTerminator\'s value '
        + 'convergence) always resolves to the LOWEST self-agreeing value -- comparative_cascade.ts\'s own documented, '
        + 'pre-existing gap, not fixed here per this ticket\'s FORBIDDEN section -- reporting the gap rather than '
        + 'publishing a verdict the reused function was never shown to get right in this direction',
    );
    queryBillNote();
    emit({ kind: 'result', text: `ABSTAIN (reused terminator direction gap -- target extreme "most" not supported)${KEY != null ? `  key=${KEY}` : ''}`, ts: nowIso() });
    return {
      qid: input.qid,
      question: input.question,
      verdict: null,
      correct: KEY,
      abstain: true,
      freeText: input.qid == null,
      basis: `superlative-by-magnitude route: orderings agreed (candidate ${agreement.candidate}), but target extreme `
        + 'is "most" and the reused evaluateComparativeTerminator() value-convergence branch always picks the LOWEST '
        + 'self-agreeing value (a documented, pre-existing gap in that reused function, not modified here) -- '
        + 'abstaining and reporting the gap rather than publishing a direction the terminator was never shown to '
        + `handle; ordering candidate for reference only: ${agreement.candidate}`,
    };
  }

  step(`STAGE D  harvest density observations from the ${[mostToLeast, leastToMost, mostToLeastQC, leastToMostQC].filter((p) => p.ok).length} already-fetched passage(s) above -- no new query`);
  const densityObservations = await harvestDensityObservations([mostToLeast, leastToMost, mostToLeastQC, leastToMostQC], pool, OPT, note);
  note(`   observations: ${pool.map((L) => `${L}=${(densityObservations[L] ?? []).join('/') || '(none)'}`).join('  ')}`);

  step('STAGE E  terminate -- evaluateComparativeTerminator() value-convergence branch, imported unchanged from comparative_cascade.ts');
  const termResult = evaluateComparativeTerminator(pool, {}, {}, property, densityObservations);
  for (const n of termResult.notes) note(n);
  const verdict = termResult.verdict;

  if (!verdict) {
    step('ABSTAIN -- the hard number did not converge (no self-agreeing value); reporting, not forcing');
    queryBillNote();
    emit({ kind: 'result', text: `ABSTAIN (no value convergence)   ordering candidate: ${agreement.candidate}${KEY != null ? `  key=${KEY}` : ''}`, ts: nowIso() });
    return {
      qid: input.qid,
      question: input.question,
      verdict: null,
      correct: KEY,
      abstain: true,
      freeText: input.qid == null,
      basis: `superlative-by-magnitude route: orderings agreed at the ${targetExtreme} extreme (candidate `
        + `${agreement.candidate}), but the reused hard-number terminator found no order-of-magnitude self-agreement `
        + 'across observations -- abstaining rather than forcing the ordering candidate to stand in for the hard '
        + "number the Founder's ruling requires",
    };
  }

  const ok = KEY != null ? verdict === KEY : undefined;
  step(`PUBLISH -- ${verdict} (${OPT[verdict]}), hard number self-agreed, ordering candidate was ${agreement.candidate === verdict ? 'the SAME option' : `DIFFERENT (${agreement.candidate})`}`);
  queryBillNote();
  emit({
    kind: 'result',
    text: `${KEY != null ? (ok ? 'CORRECT' : 'WRONG') : 'ANSWER'}  ${verdict} (${OPT[verdict]})${KEY != null ? `  key=${KEY}` : ''}`,
    ts: nowIso(),
  });
  note(`   ${elapsedS().toFixed(1)}s`);
  return {
    qid: input.qid,
    question: input.question,
    verdict,
    correct: KEY,
    ok,
    abstain: false,
    freeText: input.qid == null,
    basis: `superlative-by-magnitude route: property="${property}" target extreme=${targetExtreme}; orderings agreed `
      + `(candidate ${agreement.candidate}); terminated on the reused hard-number rule (evaluateComparativeTerminator, `
      + `comparative_cascade.ts, unmodified): ${termResult.basis}`,
  };
}

async function run(input: MethodQuestionInput, ctx: MethodRunContext): Promise<LianaTerminalOutcome> {
  // D-BP152-038/BISHOP/seg-superlative-resolves-by-rank. Founder, BP152, verbatim: "Yes. that. now
  // code it, please" -- a superlative membership question resolves by ranking the options by the
  // property the superlative names, terminating on the same hard-number rule the RANK method
  // (comparative_cascade.ts) already uses. Structural gate only (extractSuperlativeMatch(), the
  // SAME SUPERLATIVE_PROPERTY_RE extractClassifyCandidateTerms() already matches) -- a
  // non-superlative CLASSIFY question never reaches this branch and runs the unmodified
  // criteria-stack path below, exactly as it behaved at 1a9dd511.
  const superlative = extractSuperlativeMatch(input.question);
  if (superlative) {
    return runSuperlativeByMagnitude(input, ctx, superlative);
  }
  // Registered entry point, general case: no seed criteria hardcoded for any specific question --
  // the litmus-strip loop (STAGE 2) sources every criterion automatically from the question's own
  // structurally-extracted candidate terms, and STAGE 3's Banyan-Metric rule decides publish vs
  // abstain from the loop's own outcome.
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
