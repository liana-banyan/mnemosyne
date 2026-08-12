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

interface FrameResult {
  /** False = the authority gave no usable answer. Per FD-BP153-01 consequence 2 this ABSTAINS;
   *  it never falls back to ranking the unframed pool. */
  available: boolean;
  /** Option letters the SOURCE stated are not members of the category. May be empty, which is a
   *  valid frame meaning "the source excluded nothing", NOT the same as unavailable. */
  excluded: string[];
  query: string;
  via: string;
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
 */
async function establishFrame(
  askGoogle: MethodRunContext['askGoogle'],
  category: string,
  all: string[],
  OPT: Record<string, string>,
  note: (text: string) => void,
): Promise<FrameResult> {
  const query = `Which of these are ${category}, and which of them are not ${category}? `
    + `For each one that is not, say so explicitly and say what it is instead. ${list(all, OPT)}`;
  note(`   FRAME: ${query}`);
  const res = await googleBlocks(askGoogle, query);
  if (!res.ok) {
    note(`   FRAME: no usable answer (${res.via}) -- the frame is UNAVAILABLE, not empty`);
    return { available: false, excluded: [], query, via: res.via };
  }
  const ex = await gemmaExtract(
    'If this passage states that any of these names is NOT one of the named category, copy out '
      + 'exactly those names, spelled as the passage spells them. Copy only names the passage '
      + 'itself excludes. If the passage excludes none of them, return an empty list. Do not '
      + `decide yourself which ones qualify. Names: ${all.map((L) => OPT[L]).join('; ')}`,
    res.text,
    '{"not_members":["exact name the passage says is not one"],"stated_in_passage":true}',
  );
  let excluded = toLetters(ex?.not_members as unknown[] | undefined, OPT);
  excluded = excluded.filter((L) => appearsIn(res.text, OPT[L]));
  note(
    `   FRAME: source excluded ${excluded.length ? excluded.map((L) => `${L}) ${OPT[L]}`).join(', ') : '(nothing)'}`
      + ` -- ${excluded.length} option(s) are not ${category} and will NOT be ranked`,
  );
  return { available: true, excluded, query, via: res.via };
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
  step(`STAGE 0  THE FRAME (FD-BP153-01) -- which options are ${category} at all? Non-members are never ranked`);
  const frame = await establishFrame(askGoogle, category, ALL, OPT, note);
  if (!frame.available) {
    // FD-BP153-01 consequence 2, verbatim: "A magnitude result with no frame is NOT definitive."
    // Falling back to ranking the unframed pool is exactly the confident-wrong-answer generator
    // this ruling exists to close -- on qid 98 that fallback answers G (Arctic Circle) against a
    // key of A, because it ranks biomes alongside continents.
    step('ABSTAIN -- the frame could not be established, and an UNFRAMED magnitude result is not definitive (FD-BP153-01)');
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

  step('STAGE A  narrow the pool -- reuses runLitmusStripLoop() (Stage 2 above) UNCHANGED, no seed criteria');
  const loop = await runLitmusStripLoop(input, ctx, [], note);
  note(
    `   loop stopped: ${loop.stoppedReason}   criteria applied: ${loop.criteria.length}   `
      + `eliminations: ${loop.eliminations.length}   survivors: ${loop.survivors.join(', ') || '(none)'}`,
  );
  if (!loop.survivors.length) {
    step('ABSTAIN -- zero survivors after the litmus-strip loop; nothing left to rank');
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
  const mostToLeast = await askOrdering(askGoogle, category, property, 'most-to-least', pool, OPT, 'Q1 most-to-least', note);
  const leastToMost = await askOrdering(askGoogle, category, property, 'least-to-most', pool, OPT, 'Q2 least-to-most', note);

  // FD-BP153-01: QC re-includes every option the FRAME kept, not every option on the question.
  // His QC exists to check that an ELIMINATION was right, and a frame exclusion is not an
  // elimination -- re-including a biome here would reintroduce exactly the out-of-category
  // candidate the frame just removed, and on qid 98 that is the Arctic Circle walking back in.
  step(`STAGE C  quality control -- same two directions, re-asked, all IN-FRAME options re-included (his own stages 4/5)`);
  const mostToLeastQC = await askOrdering(askGoogle, category, property, 'most-to-least', framed, OPT, 'Q3 most-to-least (QC, in-frame options)', note);
  const leastToMostQC = await askOrdering(askGoogle, category, property, 'least-to-most', framed, OPT, 'Q4 least-to-most (QC, in-frame options)', note);

  const agreement = checkExtremeAgreement(targetExtreme, pool, mostToLeast, leastToMost, mostToLeastQC, leastToMostQC);
  for (const n of agreement.notes) note(n);

  const elapsedS = () => (Date.now() - t0) / 1000;

  if (!agreement.agrees) {
    step('ABSTAIN -- orderings do not agree at the target extreme (or none was usable, or QC contradicted an elimination); reporting, not resolving');
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
