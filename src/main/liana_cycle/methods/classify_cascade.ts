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

export interface FrameResult {
  /** False = the authority gave no usable answer. Per FD-BP153-01 consequence 2 this ABSTAINS;
   *  it never falls back to ranking the unframed pool. */
  available: boolean;
  /** Option letters the SOURCE stated are not members of the category -- RECONCILED (see
   *  reconcileNamedSet(), reused by extractFrameBothSides() below) with the complement
   *  (which-ARE-`category`) extraction when the two sides form a clean, conflict-free reading;
   *  otherwise this is the direct exclusion extraction alone, unreconciled. May be empty, which is
   *  a valid frame meaning "the source excluded nothing", NOT the same as unavailable. */
  excluded: string[];
  /** D-BP153-017, THE DOUBLECHECK applied to THE SOFTBALLS: option letters the SAME passage
   *  states ARE `category` -- the complementary direction, extracted from the identical
   *  already-fetched text, no new query. Empty when the complement extracted nothing (the passage
   *  may simply not use that shape). */
  included: string[];
  /** Option letters extracted as BOTH excluded and included by the two independent extractions --
   *  a FINDING, reported and never silently resolved (FD-BP153-07: "ask it both directions and
   *  require agreement"; a disagreement is reported, never resolved by force). Empty when the two
   *  extractions agree. */
  conflicts: string[];
  /** True when the direct exclusion set and the complement inclusion set together name every
   *  option in `all`, with zero conflicts -- mirrors NamedSetResult.partitionComplete exactly. */
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
}

/** THE SAME instruction and output shape both the owned-evidence extraction attempt (below) and
 *  the fresh-query path (further below) use to read a frame partition out of a passage -- factored
 *  into one function specifically so there is exactly ONE wording, never two that could drift.
 *  EXTRACTION ONLY (HARDWIRE-22): asks the model to copy out names the passage ITSELF states are
 *  excluded, never to judge whether a passage "answers" the question.
 *
 *  D-BP153-014, BUG-3 FIX. SHARPENED. Prior-run prose (Bishop's own dispatch, quoted verbatim):
 *  "G, H, and I represent the extreme sparsely populated biomes" -- establishFrame() extracted
 *  NOTHING from it. The old wording only asked for an explicit "NOT the category" statement; this
 *  sentence never uses the word NOT -- it states a POSITIVE alternate classification ("represent...
 *  biomes") instead, which is exactly as exclusionary but was outside what the old prompt looked
 *  for. THE COMPARISON STAYS MECHANICAL, no word list built here (HARDWIRE-23): the model is told
 *  to compare whatever classification the passage states against `category` -- the exact string
 *  this function is now given, the same string the fresh-query path already sends the question
 *  with -- and copy the name only when the STATED classification differs from that string. The
 *  model still only copies verbatim text (HARDWIRE-22 unrelaxed); the code's own appearsIn() check
 *  below still verifies every copy against the source passage, unchanged. */
function frameExtractionInstruction(category: string, all: string[], OPT: Record<string, string>): string {
  return `If this passage states that any of these names is NOT ${category}, copy out exactly those `
    + 'names, spelled as the passage spells them. This exclusion may be worded as an explicit NOT, '
    + `OR as a POSITIVE statement of what the name IS INSTEAD (for example, "X, Y, and Z represent `
    + `biomes" or "X, Y, and Z are climatic zones" -- when the passage states a classification for a `
    + `name that is DIFFERENT from "${category}", that name is excluded, even with no literal NOT). `
    + 'Copy only names the passage itself excludes, by either wording. If the passage excludes none '
    + 'of them, return an empty list. Do not decide yourself which ones qualify -- compare only '
    + 'against what the passage itself states the name is. For EACH excluded name, also copy out the '
    + 'exact verbatim sentence or clause from the passage that states the exclusion, word for word, '
    + `into "span". Names: ${all.map((L) => OPT[L]).join('; ')}`;
}
// D-BP153-016, FIX 2: `not_members` is now a list of {name, span} objects, not bare strings -- see
// extractSpannedLetters() (above) for the verification this shape exists to support.
const FRAME_EXTRACTION_SHAPE = '{"not_members":[{"name":"exact name the passage says is not one",'
  + '"span":"the exact verbatim sentence from the passage"}],"stated_in_passage":true}';

// ─────────────────────────── D-BP153-017: THE DOUBLECHECK, APPLIED TO THE SOFTBALLS ───────────────────────────
//
// TICKET_D-BP153-017_THE_THREE_QUESTIONS.md, ITEM 3: "Add the complementary direction to the
// Softballs, reconciled the same way the named set already is." His own QC, FD-BP153-07, verbatim:
// "ask it both directions and require agreement." D-BP153-014 already built exactly this pattern
// for THE NAMED SET (namedSetComplementExtractionInstruction() / extractNamedSetBothSides() /
// reconcileNamedSet(), above) -- this section is that SAME pattern, reused (reconcileNamedSet()
// itself is called unchanged, not reimplemented), retargeted at THE SOFTBALLS (establishFrame()).

/** The complementary direction of frameExtractionInstruction() above -- asks which of these names
 *  the passage states ARE `category`, rather than which are NOT. EXTRACTION ONLY (HARDWIRE-22):
 *  copies out names the passage itself states ARE the category, never judges which ones qualify. */
function frameComplementExtractionInstruction(category: string, all: string[], OPT: Record<string, string>): string {
  return `If this passage states that any of these names IS ${category} -- a legitimate member of `
    + 'that category, stated directly by the source -- copy out exactly those names, spelled as the '
    + `passage spells them. Copy only names the passage itself states ARE ${category}. If the passage `
    + 'states that none of them are, return an empty list. Do not decide yourself which ones qualify '
    + '-- copy only what the passage itself states. For EACH included name, also copy out the exact '
    + 'verbatim sentence or clause from the passage that states its inclusion, word for word, into '
    + `"span". Names: ${all.map((L) => OPT[L]).join('; ')}`;
}
const FRAME_COMPLEMENT_EXTRACTION_SHAPE = '{"members":[{"name":"exact name the passage says it is",'
  + '"span":"the exact verbatim sentence from the passage"}],"stated_in_passage":true}';

/** ONE passage, BOTH directions -- the exclusion read (direct, frameExtractionInstruction(),
 *  unchanged) and its complement (the inclusion read, frameComplementExtractionInstruction(),
 *  D-BP153-017), over the SAME already-in-hand text. NO NEW QUERY: two gemmaExtract() calls (local
 *  Ollama), never a second googleBlocks() -- mirrors extractNamedSetBothSides() above
 *  byte-for-byte.
 *
 *  REUSES reconcileNamedSet() UNCHANGED, roles swapped relative to the named set's own call: there,
 *  `members` is the direct read and `nonMembers` is the complement, and the function returns the
 *  reconciled MEMBER set. Here `members` is fed the direct EXCLUSION read and `nonMembers` is fed
 *  the complement INCLUSION read -- the identical arithmetic ("trust the complement side when it
 *  said something and the two sides do not conflict") then yields, in its own `.members` field, the
 *  reconciled EXCLUDED set, because "all minus the trusted complement" is exactly the exclusion
 *  arithmetic THE SOFTBALLS need. A conflict (a name BOTH extractions place on opposite sides) is
 *  never silently resolved -- reconcileNamedSet() already falls back to the direct extraction,
 *  unreconciled, and reports `conflicts` for the caller to note as a FINDING (FD-BP153-07: "a
 *  disagreement here is reported, never resolved by force"). */
async function extractFrameBothSides(
  passage: string,
  category: string,
  all: string[],
  OPT: Record<string, string>,
): Promise<{
  excluded: string[]; rawExcluded: string[]; excludedSpans: Record<string, string>;
  included: string[]; conflicts: string[]; partitionComplete: boolean; why: string; discarded: number;
}> {
  const exNot = await gemmaExtract(frameExtractionInstruction(category, all, OPT), passage, FRAME_EXTRACTION_SHAPE);
  const direct = extractSpannedLetters(exNot?.not_members, passage, OPT);

  const exIs = await gemmaExtract(frameComplementExtractionInstruction(category, all, OPT), passage, FRAME_COMPLEMENT_EXTRACTION_SHAPE);
  const complement = extractSpannedLetters(exIs?.members, passage, OPT);

  const reconciliation = reconcileNamedSet(all, direct.letters, complement.letters, OPT);
  return {
    excluded: reconciliation.members, // the reconciled EXCLUDED set -- see this function's own header
    rawExcluded: direct.letters,
    excludedSpans: direct.spans,
    included: complement.letters,
    conflicts: reconciliation.conflicts,
    partitionComplete: reconciliation.partitionComplete,
    why: reconciliation.why,
    discarded: direct.discarded + complement.discarded,
  };
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
 * SAME extraction (frameExtractionInstruction(), one shared instruction/shape, no second wording)
 * against every passage the caller says this run already owns. EXTRACTION ONLY, NEVER JUDGMENT
 * (HARDWIRE-22, unrelaxed) -- exactly the same choke point the fresh-query path already used:
 * gemmaExtract() copies out names the passage itself states are excluded, verified back against
 * THAT owned passage's own text with appearsIn(), never inferred. OWNED MEANS THIS RUN ONLY: the
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
): Promise<FrameResult> {
  const rawOwned = ownedPassages ? ownedPassages() : [];
  const owned = filterUsableOwnedPassages(rawOwned, all, OPT, 'FRAME', note);
  for (let i = 0; i < owned.length; i++) {
    const passage = owned[i].text;
    // eslint-disable-next-line no-await-in-loop -- each owned passage is tried in turn, stopping at
    // the first that yields a verified, non-empty read on either side; this is extraction over text
    // already sitting in memory (a local Ollama call), never a network fan-out, so there is nothing
    // here to parallelize against.
    const both = await extractFrameBothSides(passage, category, all, OPT);
    if (both.discarded) {
      note(`   FRAME: discarded ${both.discarded} value(s) with no verbatim supporting span (passage ${i + 1} of ${owned.length})`);
    }
    // D-BP153-017: answered when EITHER direction extracted something -- mirrors
    // extractNamedSetMembers()'s own extension of this same rule (D-BP153-014), for the identical
    // reason: the complement can be the more directly-stated side.
    if (both.rawExcluded.length || both.included.length) {
      note(
        `   FRAME: answered FROM OWNED EVIDENCE (passage ${i + 1} of ${owned.length}, already acquired `
          + `this run -- NO NEW QUERY ISSUED) -- direct extraction excludes `
          + `${both.rawExcluded.length ? both.rawExcluded.map((L) => `${L}) ${OPT[L]}`).join(', ') : '(none)'}, `
          + `complement states ${both.included.length ? both.included.map((L) => `${L}) ${OPT[L]}`).join(', ') : '(none)'} `
          + `IS ${category}`,
      );
      if (both.conflicts.length) {
        note(
          `   FRAME CONFLICT (D-BP153-017, THE DOUBLECHECK): ${both.conflicts.map((L) => `${L}) ${OPT[L]}`).join(', ')} `
            + 'extracted as BOTH excluded and included by the two independent directions -- reported as a FINDING, '
            + 'neither side is preferred (FD-BP153-07: "a disagreement here is reported, never resolved by force")',
        );
      }
      note(`   FRAME RECONCILIATION: ${both.why}`);
      note(
        `   FRAME: ${both.excluded.length} option(s) are not ${category} and will NOT be ranked -- `
          + `${both.excluded.map((L) => `${L}) ${OPT[L]}`).join(', ') || '(none)'}`,
      );
      return {
        available: true, excluded: both.excluded, included: both.included, conflicts: both.conflicts,
        partitionComplete: both.partitionComplete, reconciliationWhy: both.why,
        query: `(owned passage ${i + 1} of ${owned.length}, no query issued)`,
        via: 'owned-passage', answeredFrom: 'owned-passage', ownedPassageIndex: i,
      };
    }
    // D-BP153-010's rule, extended: yielded nothing on EITHER side -- inconclusive for THIS
    // passage, not "excluded nothing". Falls through to the next owned passage, then to the query
    // path below.
  }
  if (owned.length) {
    note(`   FRAME: ${owned.length} owned passage(s) already acquired this run did not contain a usable frame partition -- falling through to a NEW QUERY`);
  }

  const query = `Which of these are ${category}, and which of them are not ${category}? `
    + `For each one that is not, say so explicitly and say what it is instead. ${list(all, OPT)}`;
  note(`   FRAME: ${query}`);
  const res = await googleBlocks(askGoogle, query);
  if (!res.ok) {
    note(`   FRAME: no usable answer (${res.via}) -- the frame is UNAVAILABLE, not empty`);
    return {
      available: false, excluded: [], included: [], conflicts: [], partitionComplete: false,
      reconciliationWhy: 'unavailable -- no usable answer', query, via: res.via, answeredFrom: 'new-query', ownedPassageIndex: null,
    };
  }
  // D-BP153-010 -- AN EMPTY PASSAGE IS NOT AN EMPTY EXCLUSION LIST. Bishop's own bug, found in the
  // first live run of this function (2026-08-12T16:04Z, acquisition
  // EVIDENCE_qid98_2026-08-12T15-51-57-546Z_23720): googleBlocks() returned ok:true with EMPTY
  // text, gemmaExtract() then found nothing in nothing, and this function reported
  // "source excluded (nothing) -- 9 of 9 option(s) remain in frame". That reads identically to
  // "the source examined all nine and said every one is a world region", which is a completely
  // different fact.
  //
  // This is the exact defect class this session spent itself closing, rebuilt by hand inside the
  // fix for it. evidence_store.ts's own header states the rule this violated: a recorded null is
  // a FACT ("we asked and got nothing") and is NOT the same as an absent record. Same distinction,
  // same failure to honor it.
  //
  // An unusable frame must abstain (FD-BP153-01 consequence 2), never silently pass every option
  // through to the ranking -- because passing all nine through is precisely the unframed pool that
  // answers G on qid 98 against a key of A.
  if (!res.text || !res.text.trim()) {
    note(`   FRAME: the source returned an EMPTY passage (${res.via}) -- the frame is UNAVAILABLE, not "nothing excluded"`);
    return {
      available: false, excluded: [], included: [], conflicts: [], partitionComplete: false,
      reconciliationWhy: 'unavailable -- empty passage', query, via: `${res.via} (empty passage)`, answeredFrom: 'new-query', ownedPassageIndex: null,
    };
  }
  // D-BP153-016, FIX 3, mirrored for the fresh-query path: a passage naming none of the options
  // cannot state anything about them -- same fact-class as the empty-passage check just above.
  if (!passageMentionsAnyLabel(res.text, all, OPT)) {
    note(`   FRAME: the source's passage (${res.via}) names NONE of the option(s) under test -- the frame is UNAVAILABLE, not "nothing excluded"`);
    return {
      available: false, excluded: [], included: [], conflicts: [], partitionComplete: false,
      reconciliationWhy: 'unavailable -- no option named', query, via: `${res.via} (no option named)`, answeredFrom: 'new-query', ownedPassageIndex: null,
    };
  }
  const both = await extractFrameBothSides(res.text, category, all, OPT);
  if (both.discarded) {
    note(`   FRAME: discarded ${both.discarded} value(s) with no verbatim supporting span (fresh query)`);
  }
  note(
    `   FRAME: answered FROM A NEW QUERY -- direct extraction excludes `
      + `${both.rawExcluded.length ? both.rawExcluded.map((L) => `${L}) ${OPT[L]}`).join(', ') : '(nothing)'}, `
      + `complement states ${both.included.length ? both.included.map((L) => `${L}) ${OPT[L]}`).join(', ') : '(nothing)'} IS ${category}`,
  );
  if (both.conflicts.length) {
    note(
      `   FRAME CONFLICT (D-BP153-017, THE DOUBLECHECK): ${both.conflicts.map((L) => `${L}) ${OPT[L]}`).join(', ')} `
        + 'extracted as BOTH excluded and included by the two independent directions -- reported as a FINDING, '
        + 'neither side is preferred (FD-BP153-07: "a disagreement here is reported, never resolved by force")',
    );
  }
  note(`   FRAME RECONCILIATION: ${both.why}`);
  note(
    `   FRAME: ${both.excluded.length} option(s) are not ${category} and will NOT be ranked -- `
      + `${both.excluded.map((L) => `${L}) ${OPT[L]}`).join(', ') || '(none)'}`,
  );
  return {
    available: true, excluded: both.excluded, included: both.included, conflicts: both.conflicts,
    partitionComplete: both.partitionComplete, reconciliationWhy: both.why,
    query, via: res.via, answeredFrom: 'new-query', ownedPassageIndex: null,
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
   *  conflict-free partition of `all`; otherwise this is the direct extraction alone, unreconciled.
   *  May be empty, which (when `available` is true) is a valid reading meaning "the source named
   *  none of these as members" -- not the same as unavailable. */
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
}

/** D-BP153-014, BUG-1(b): pure set arithmetic, no I/O, mirrors runMembershipTerminator()'s own
 *  discipline (Step 3, above) -- mechanical only, never a model call, never a guess, and never a
 *  tie-break. Reconciles the direct member-extraction against the complement (non-member)
 *  extraction over the SAME already-fetched passage.
 *
 *  A conflict (an option BOTH extractions name) is a FINDING. Reported and left UNRESOLVED --
 *  never silently preferred one way or the other. His own dispatch, verbatim: "if they conflict...
 *  report it and do not silently prefer one." On conflict, this falls back to the direct member
 *  extraction, unreconciled -- the conflicting name(s) stay exactly where the direct extraction put
 *  them, and `conflicts` says so.
 *
 *  WHEN THERE IS NO CONFLICT AND THE COMPLEMENT SAID SOMETHING, the complement is TRUSTED --
 *  reconciled members = `all` minus non-members. This is deliberately NOT gated on the direct
 *  member list also being complete: his own diagnosis is that the complement is stated MORE
 *  directly in this shape of passage ("Options A, C, F... are all NOT considered... Only B, D, and
 *  E... qualify"), and gating on direct-side completeness would defeat the whole point -- the
 *  measured live bug is the direct extraction missing D while the complement names the other six
 *  cleanly; requiring D to ALSO already be on the direct list before trusting the complement would
 *  never fire on the one case this exists for. `partitionComplete` is still computed and reported
 *  (true only when BOTH sides together, unaided, cover every option) as an honest, separate
 *  finding -- it does not gate which set wins, per his own instruction that a conflict is reported,
 *  not that a partial partition disqualifies the more-direct side.
 *
 *  When the complement extracted NOTHING (no non-members stated at all -- the passage may simply
 *  not use that shape), there is nothing to reconcile against, and this falls back to the direct
 *  member extraction alone -- refusing to invent a complement that was never stated. */
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
  const partitionComplete = conflicts.length === 0 && all.every((L) => covered.has(L));
  const label = (Ls: string[]) => `{${Ls.map((L) => `${L}) ${OPT[L]}`).join(', ') || 'none'}}`;
  if (conflicts.length) {
    return {
      members,
      nonMembers,
      conflicts,
      partitionComplete: false,
      why: `CONFLICT: ${label(conflicts)} extracted as BOTH a member and a non-member by the two `
        + 'independent extractions -- reported, neither side is preferred; using the direct member '
        + 'extraction unreconciled',
    };
  }
  if (nonMembers.length) {
    const reconciledMembers = all.filter((L) => !nonMemberSet.has(L));
    const unaddressedByDirect = reconciledMembers.filter((L) => !memberSet.has(L));
    const completeNote = partitionComplete
      ? `complete partition: members ${label(members)} and non-members ${label(nonMembers)} together `
        + `account for all ${all.length} option(s), zero conflicts -- each side corroborates the other `
        + `(reconciled members: ${label(reconciledMembers)})`
      : `complement (non-members ${label(nonMembers)}) trusted despite an incomplete direct side -- `
        + `${label(unaddressedByDirect)} implied a member by the complement but not named by the direct `
        + `extraction (recovered, not assumed: HARDWIRE-22's own extraction-verified evidence, not a `
        + `guess) -- reconciled members: ${label(reconciledMembers)}`;
    return { members: reconciledMembers, nonMembers, conflicts, partitionComplete, why: completeNote };
  }
  return {
    members,
    nonMembers,
    conflicts,
    partitionComplete: false,
    why: 'the complement extracted nothing -- no non-members stated in this passage to reconcile '
      + 'against; using the direct member extraction alone',
  };
}

export interface NamedSetReconciliation {
  /** The reconciled member set -- see reconcileNamedSet()'s own header for exactly when this is the
   *  complement-derived set vs. the direct extraction, unreconciled. */
  members: string[];
  nonMembers: string[];
  conflicts: string[];
  partitionComplete: boolean;
  why: string;
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
): Promise<NamedSetReconciliation & { rawMembers: string[]; memberSpans: Record<string, string>; discarded: number }> {
  const exMembers = await gemmaExtract(namedSetExtractionInstruction(all, OPT, direction, property), passage, NAMED_SET_EXTRACTION_SHAPE);
  // D-BP153-016, FIX 2: verify the SPAN, not the string -- see extractSpannedLetters() (above) for
  // the discard rule this replaces bare toLetters()+appearsIn() with.
  const direct = extractSpannedLetters(exMembers?.members, passage, OPT);

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
): Promise<NamedSetResult> {
  const rawOwned = ownedPassages ? ownedPassages() : [];
  const owned = filterUsableOwnedPassages(rawOwned, all, OPT, 'NAMED SET', note);
  for (let i = 0; i < owned.length; i++) {
    const passage = owned[i].text;
    // eslint-disable-next-line no-await-in-loop -- each owned passage is tried in turn, stopping at
    // the first that yields a verified, non-empty read on either side; extraction over text already
    // sitting in memory (a local Ollama call), never a network fan-out, so nothing here to
    // parallelize.
    const both = await extractNamedSetBothSides(passage, all, OPT, direction, property);
    if (both.discarded) {
      note(`   NAMED SET: discarded ${both.discarded} value(s) with no verbatim supporting span (passage ${i + 1} of ${owned.length})`);
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
  const res = await googleBlocks(askGoogle, query);
  if (!res.ok) {
    note(`   NAMED SET: no usable answer (${res.via}) -- the named set is UNAVAILABLE, not empty`);
    return {
      available: false, members: [], rawMembers: [], memberSpans: {}, nonMembers: [], conflicts: [], partitionComplete: false,
      reconciliationWhy: 'unavailable -- no usable answer', query, via: res.via, answeredFrom: 'new-query', ownedPassageIndex: null,
    };
  }
  // D-BP153-010, mirrored: an EMPTY passage is not the same fact as "the source named zero
  // members" -- it means nothing was asked at all. See establishFrame()'s own D-BP153-010 comment
  // for the full incident this rule closes; the same failure mode is possible here. BUG-2 of
  // D-BP153-014's own dispatch: this check runs BEFORE either extraction below, so an empty
  // passage never reaches gemmaExtract() at all -- verified by
  // classify_cascade.membership_terminator.test.ts's own D-BP153-010 regression (unchanged by this
  // ticket) and classify_cascade.owned_evidence_frame.test.ts's new sibling test for establishFrame().
  if (!res.text || !res.text.trim()) {
    note(`   NAMED SET: the source returned an EMPTY passage (${res.via}) -- the named set is UNAVAILABLE, not "no members"`);
    return {
      available: false, members: [], rawMembers: [], memberSpans: {}, nonMembers: [], conflicts: [], partitionComplete: false,
      reconciliationWhy: 'unavailable -- empty passage', query, via: `${res.via} (empty passage)`, answeredFrom: 'new-query', ownedPassageIndex: null,
    };
  }
  // D-BP153-016, FIX 3, mirrored for the fresh-query path: a passage naming none of the options
  // cannot state anything about them.
  if (!passageMentionsAnyLabel(res.text, all, OPT)) {
    note(`   NAMED SET: the source's passage (${res.via}) names NONE of the option(s) under test -- the named set is UNAVAILABLE, not "no members"`);
    return {
      available: false, members: [], rawMembers: [], memberSpans: {}, nonMembers: [], conflicts: [], partitionComplete: false,
      reconciliationWhy: 'unavailable -- no option named', query, via: `${res.via} (no option named)`, answeredFrom: 'new-query', ownedPassageIndex: null,
    };
  }
  const both = await extractNamedSetBothSides(res.text, all, OPT, direction, property);
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
    query, via: res.via, answeredFrom: 'new-query', ownedPassageIndex: null,
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
 *  which kind is correct itself. */
function discriminatorExtractionInstruction(candidates: string[], OPT: Record<string, string>, category: string): string {
  return 'For each of these names, copy out exactly what KIND of thing the passage states it is '
    + '(for example "Continent", "Colloquial area", "Subcontinent", "Climatic zone") -- the '
    + "passage's own classification word or phrase for that name, verbatim, spelled as the passage "
    + 'spells it, AND the exact verbatim sentence or clause the kind was read from, into "span". Use '
    + 'null (and an empty span) for a name whose kind the passage does not state. SEPARATELY, if the '
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
): Promise<{ kinds: Record<string, string | null>; categoryKind: string | null; discarded: number }> {
  const ex = await gemmaExtract(
    discriminatorExtractionInstruction(candidates, OPT, category), passage, DISCRIMINATOR_EXTRACTION_SHAPE,
  );
  const rawKinds = (ex?.kinds as Array<{ name?: unknown; kind?: unknown; span?: unknown }> | undefined) ?? [];
  const kinds: Record<string, string | null> = {};
  let discarded = 0;
  for (const L of candidates) {
    const entry = rawKinds.find((r) => norm(r?.name) === norm(OPT[L]));
    const kindText = entry && typeof entry.kind === 'string' ? entry.kind.trim() : '';
    const span = entry && typeof entry.span === 'string' ? entry.span.trim() : '';
    const verified = !!kindText && !!span && spanIsVerbatim(passage, span) && appearsIn(span, kindText) && appearsIn(passage, OPT[L]);
    if (verified) {
      kinds[L] = kindText;
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
  return { kinds, categoryKind, discarded };
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
    if (Object.values(kinds).some((k) => k != null) || categoryKind != null) {
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
  // got rid of four answers with ONE google search." Ticket's own example wording, used verbatim.
  const query = `What kind of ${category} is each of these, and how do they differ from one another? ${list(candidates, OPT)}`;
  note(`   DISCRIMINATOR: ${query}`);
  const res = await googleBlocks(askGoogle, query);
  if (!res.ok) {
    note(`   DISCRIMINATOR: no usable answer (${res.via}) -- ABSTAIN, naming all ${candidates.length} candidate(s)`);
    return {
      survivors: candidates, unique: null, eliminations: [],
      kinds: Object.fromEntries(candidates.map((L) => [L, null])), categoryKind: null,
      why: `no usable answer (${res.via}) -- ABSTAIN naming ${candidates.join(', ')}, no elimination performed`,
      query, via: res.via, answeredFrom: 'new-query', ownedPassageIndex: null,
    };
  }
  if (!res.text || !res.text.trim()) {
    note(`   DISCRIMINATOR: the source returned an EMPTY passage (${res.via}) -- ABSTAIN, naming all ${candidates.length} candidate(s)`);
    return {
      survivors: candidates, unique: null, eliminations: [],
      kinds: Object.fromEntries(candidates.map((L) => [L, null])), categoryKind: null,
      why: `empty passage (${res.via}) -- ABSTAIN naming ${candidates.join(', ')}, no elimination performed`,
      query, via: `${res.via} (empty passage)`, answeredFrom: 'new-query', ownedPassageIndex: null,
    };
  }
  // D-BP153-016, FIX 3, mirrored for the fresh-query path: a passage naming none of the candidates
  // cannot state anything about them.
  if (!passageMentionsAnyLabel(res.text, candidates, OPT)) {
    note(`   DISCRIMINATOR: the source's passage (${res.via}) names NONE of the candidate(s) under test -- ABSTAIN, naming all ${candidates.length} candidate(s)`);
    return {
      survivors: candidates, unique: null, eliminations: [],
      kinds: Object.fromEntries(candidates.map((L) => [L, null])), categoryKind: null,
      why: `no candidate named (${res.via}) -- ABSTAIN naming ${candidates.join(', ')}, no elimination performed`,
      query, via: `${res.via} (no option named)`, answeredFrom: 'new-query', ownedPassageIndex: null,
    };
  }
  const { kinds, categoryKind, discarded } = await extractDiscriminatorKinds(res.text, candidates, OPT, category);
  if (discarded) {
    note(`   DISCRIMINATOR: discarded ${discarded} value(s) with no verbatim supporting span (fresh query)`);
  }
  const result = applyDiscriminatorElimination(candidates, kinds, categoryKind, category, OPT);
  note(`   DISCRIMINATOR: answered FROM A NEW QUERY -- ${result.why}`);
  return {
    survivors: result.survivors, unique: result.unique, eliminations: result.eliminations, kinds, categoryKind,
    why: result.why, query, via: res.via, answeredFrom: 'new-query', ownedPassageIndex: null,
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

  const say = (text: string) => emit({ kind: 'header', text, ts: nowIso() });
  const step = (text: string) => emit({ kind: 'stage', text: `-> ${text}`, ts: nowIso() });
  const note = (text: string) => emit({ kind: 'note', text, ts: nowIso() });

  // D-BP153-017, ITEM 4: THE QUERY BILL. Every query THIS route actually issues goes through this
  // counted wrapper -- it is the SAME askGoogle the evidence-writing layer upstream of ctx already
  // writes one evidence record per call for (evidence_authority.ts, not touched here), so this
  // tally is never a second, independently-derived guess at what the ledger holds; it is a live
  // count of the exact calls that produce it. `askGoogle` (destructured above) is not called
  // directly again below this point -- every call site in this function goes through
  // `countedAskGoogle` (or `countedCtx`, for runLitmusStripLoop()'s own internal calls) instead.
  let queriesIssued = 0;
  const countedAskGoogle: MethodRunContext['askGoogle'] = async (q) => {
    queriesIssued++;
    return askGoogle(q);
  };
  const countedCtx: MethodRunContext = { ...ctx, askGoogle: countedAskGoogle };
  // THE THREE QUESTIONS THIS RUN ATTEMPTED, and which of them THE DOUBLECHECK/owned-evidence-first
  // discipline (FD-BP153-04) resolved WITHOUT spending a query -- named as it happens below, read
  // back by queryBillNote() at every exit point so the saving is visible without reading the
  // ledger (ticket's own words).
  const questionsAttempted: string[] = [];
  const answeredFromOwned: string[] = [];
  /** Emits ONE note naming: queries issued this run, how many of THE THREE QUESTIONS were answered
   *  from owned evidence (no new query), and that the per-option denotation sweep (Survey's own
   *  FD-BP152-01 fallback) was skipped on this route -- always true here, since this function only
   *  ever runs when extractSuperlativeMatch() already matched (the SAME structural gate
   *  survey_stage.ts's own Step 3 gate now tests, D-BP153-017, so this fact and that skip can never
   *  disagree). Called at every exit point below, not only the final one, so an abstain's own
   *  transcript states the bill too. */
  const queryBillNote = () => note(
    `   QUERY BILL: ${queriesIssued} quer${queriesIssued === 1 ? 'y' : 'ies'} issued this run -- `
      + `${answeredFromOwned.length} of ${questionsAttempted.length} question(s) asked `
      + `(${questionsAttempted.join(', ') || 'none'}) answered from OWNED EVIDENCE, no new query `
      + `(${answeredFromOwned.join(', ') || 'none'}); 1 per-option denotation sweep SKIPPED -- redundant `
      + 'by construction on the superlative path (FD-BP152-01 fallback; D-BP153-017)',
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
  const frame = await establishFrame(countedAskGoogle, category, ALL, OPT, note, ctx.ownedPassages);
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
  const namedSet = await extractNamedSetMembers(countedAskGoogle, category, match.direction, property, ALL, OPT, note, ctx.ownedPassages);
  if (namedSet.answeredFrom === 'owned-passage') answeredFromOwned.push('THE NAMED SET');
  if (namedSet.available) {
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
      const discriminator = await runDiscriminator(countedAskGoogle, category, termination.candidates, OPT, note, ctx.ownedPassages);
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
