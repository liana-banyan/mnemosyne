// elements/generator_stages.ts -- THE GENERATOR HALF OF THE CASCADE, AS NAMED ELEMENTS.
// D-BP164-M0-047/BISHOP-SEG/M0/seg-generator
//
// THE GAP THIS FILE CLOSES. Founder, verbatim, this dispatch: "your Cascade is a candidate
// GENERATOR. The shipped code is only an ELIMINATOR. There is even a canon naming it,
// canon_cascade_generates_it_does_not_only_eliminate_bp148. That is not a wiring problem. That is
// the thing itself not being built." Full measured basis:
// C:\Users\Administrator\.claude\projects\C--Users-Administrator-Documents\memory\
//   project_the_cascade_generates_it_does_not_only_eliminate_bp148.md
// and HARDWIRE-21 (LianaBanyanPlatform\HARDWIRE\HARDWIRE-21_CROWN_AND_CLAW.md).
//
// WHAT ALREADY EXISTED, VERIFIED BEFORE WRITING ONE LINE HERE. A generator was already built at
// BP148: src/main/plow/plow_generator_cascade.ts (commit f3820811, 22/22 tests, five pure
// functions G1-G5), and src/main/plow/plow_gom_jabbar.ts (KN-BP141-3 Stage 3, its own G1-G5:
// SymPy reconciliation, the SymPy bridge itself, the one-sided fabrication bound, the
// indistinguishable-probe-query builder, and failure-strikes-the-vote tallying). Both are REAL and
// TESTED but built against the OLDER plow_mc_elimination_cascade.ts architecture (OptionLike,
// pre-dating the LianaMethod/elements registry BP149-150 established) and PARKED -- never wired,
// because HARDWIRE-21's own "KNOWN FIX" records that wiring them in naively measured WORSE (qid 98
// stayed wrong; a generated candidate gained extra "independent" agreement votes for the SAME
// model/session that already voted directly, double-counting one derivation path as two).
//
// WHAT THIS FILE IS: THE ELEMENT-SURFACE BRIDGE, NOT A REWRITE. Per
// canon_liana_methods_are_compositions_of_named_elements_bp150, a method is an ORDERED COMPOSITION
// of named, independently-testable elements -- not a monolith, and not a second implementation of
// logic that already exists and is already tested. Every rule below that plow_generator_cascade.ts
// or plow_gom_jabbar.ts ALREADY implements is REUSED here as a thin, NAMED wrapper (imported, never
// copied) so it is reachable from the current elements/ surface, composable with nest.ts/
// kind_check.ts/field_gate.ts/catalyst_words.ts the way BP150's canon requires, and independently
// testable under this file's own name. Only rules with NO existing implementation get new code
// (Rule 2, the Jar Method; the SymPy-arithmetic per-option wiring of Rule 8; the field_gate.ts
// reuse for Rule 13; the catalyst_words.ts reuse for Rule 12) -- see the per-rule headers below for
// exactly which is which.
//
// THE FOUNDER'S HAND-WORKED CASCADE IS THE SPECIFICATION.
// C:\Users\Administrator\Downloads\FounderCascadeWorkedByHand.txt, read in full, line 1-420,
// confirmed both ends (line 1 title, line 420 the final numbered rule). Fourteen numbered rules
// recovered and transcribed verbatim in that file's own "Rule inventory" section (lines 395-419).
// The rule-to-element map is BISHOP_DROPZONE\CASCADE_GENERATOR_BUILT_BP164.md; the short form:
//
//   Rule  1  Ask the inverse first                    -> generateFromInverseFirst (REUSED G1)
//   Rule  2  The Jar Method                            -> generateFromJarMethod (NEW)
//   Rule  3  Cake Cut Half, inverted each pass          -> generateFromBidirectionalRanking (REUSED G2)
//   Rule  4  Re-include just-eliminated as control      -> generateFromReIncludedControl (REUSED G3)
//   Rule  5  Terminate on the hard number                -> generateFromHardNumberTermination (REUSED G4)
//   Rule  6  Bidirectional consistency validation (named)-> same mechanism as Rule 3, not a second stage
//   Rule  7  The Gom Jabbar Test (passphrase probe)      -> NOT IMPLEMENTED, see notImplemented[] below
//   Rule  8  Derived-quantity reconciliation (SymPy)     -> generateFromDerivedQuantityReconciliation (NEW, wraps REUSED SymPy bridge)
//   Rule  9  Significant figures / precision-to-need     -> folded into Rule 5's own determineRequiredPrecision, not a separate stage
//   Rule 10  One-sided bound on fabrication (quarters)   -> checkFabricationBound (REUSED plow_gom_jabbar G3)
//   Rule 11  Paraphrase collision, synonyms != identity  -> ALREADY a cross-cutting discipline (HARDWIRE-22, appearsIn/toLetters exact-match), not a new stage
//   Rule 12  Categorize by shared predicate first        -> categorizeOptionsBySharedPredicate (NEW, wraps REUSED catalyst_words.ts)
//   Rule 13  Determine register/context before defining  -> generateFromRegisterDetermination (NEW, wraps REUSED field_gate.ts)
//   Rule 14  Cluster numeric options by shared magnitude -> NOT IMPLEMENTED, see notImplemented[] below
//
// HARD CONSTRAINT (this dispatch, verbatim): "IT MUST NEVER READ A DATASET'S ANSWER FIELD." Every
// function below takes ONLY question/option TEXT and CALLER-SUPPLIED response text as input -- none
// of them accepts a MethodQuestionInput, a qid, or anything shaped like a bundled corpus row, so
// there is no `correctAnswer`/`solutionType`/answer-key field anywhere in this file's own type
// signatures for one to read. See generator_stages.test.ts's own "answer field is structurally
// unreachable" test for the runtime mutation proof this dispatch requires.
//
// HARD CONSTRAINT (HARDWIRE-21's own "KNOWN FIX", restated so a future wiring ticket cannot repeat
// the BP148 regression by omission): every GeneratedCandidate this file's composite function
// produces carries `agreementWeight: 0`, always. WIRING these candidates into an adjudicator's vote
// count is explicitly OUT OF SCOPE for this file (M3's job, per plow_generator_cascade.ts's own
// boundary comment, unchanged by this ticket) -- generation only, never selection.
//
// R-7 BOUNDARY, PER THE FOUNDER'S OWN INSTRUCTION THIS DISPATCH: this file registers NO LianaMethod
// and adds NO LianaDemand value. demand_test.ts's six ratified demands (RANK, DEFINE, IDENTIFY,
// CLASSIFY, INFER, LOCATE-IN-FRAMEWORK) do not include "generate a candidate any demand's own
// eliminator can then consider" -- generation is not itself an operation a question DEMANDS, it is
// a PRE-PASS any existing cascade may call. Building this as elements (not a new top-level method)
// is what keeps it inside the existing demand taxonomy without inventing a seventh value -- exactly
// the boundary arithmetic_cascade.ts's own header names and works around the same way (a
// PROVISIONAL, cast-not-typed demand, reachable only in shape-only selection) for a different
// reason. This file needs no such cast at all: it is never registered, so it never needs a demand.
//
// Rule 66: version, never overwrite -- new file, no supersede needed. No em-dashes anywhere in this
// file (or its comments) -- "--" used throughout per Rule 66.

import type {
  OptionLike,
  OptionValue,
} from '../../plow/plow_mc_elimination_cascade';
import { determineRequiredPrecision } from '../../plow/plow_mc_elimination_cascade';
import {
  generateInverseComplementCandidates,
  generateFromBidirectionalRanking as coreGenerateFromBidirectionalRanking,
  generateReIncludedCandidates,
  generateFromHardNumberStats,
  type InverseGenerationResult,
  type RankingGenerationResult,
  type ReIncludeGenerationResult,
  type HardNumberGenerationResult,
  type ExtremePolarity,
  type ControlRankingDirection,
} from '../../plow/plow_generator_cascade';
import {
  reconcileDerivedQuantity,
  evaluateOneSidedBound,
  type DerivedQuantityFactor,
  type GomJabbarG1Result,
  type OneSidedBoundClaim,
  type OneSidedBoundResult,
} from '../../plow/plow_gom_jabbar';
import { appearsIn } from '../methods/comparative_cascade';
import { findCatalystWords, type CatalystResult } from './catalyst_words';
import { fieldGate, type FieldGateResult } from './field_gate';
import type { MethodRunContext } from '../method_registry';

export type { ExtremePolarity, ControlRankingDirection };

// ─────────────────────────── RULE 1 -- ASK THE INVERSE FIRST (REUSED, plow_generator_cascade G1) ───────────────────────────
//
// Founder, Excerpt 2: "First I put in the inverse, because that usually cuts the question in half,
// at least." Thin named wrapper, no logic duplicated -- see plow_generator_cascade.ts's own G1
// header for the full mechanism and its own 22/22 test coverage.

export function generateFromInverseFirst(
  stemText: string,
  options: OptionLike[],
  inverseResponseText: string | null | undefined,
): InverseGenerationResult {
  return generateInverseComplementCandidates(stemText, options, inverseResponseText);
}

// ─────────────────────────── RULE 2 -- THE JAR METHOD (NEW) ───────────────────────────
//
// Founder, Excerpt 2: "I like to call this the Jar Method: It's the opposite of the adage about how
// to prioritize... You first put in softballs, then baseballs... Now reverse it. First we take out
// the Softballs, because we KNOW they are not the answer." Measured: one broad Google search
// ("what regions ARE densely populated") removed four of nine options in a single pass.
//
// NO EXISTING PRIMITIVE IMPLEMENTS THIS -- plow_generator_cascade.ts's G1 inverts a NEGATED STEM
// (NOT/EXCEPT); the Jar Method instead asks ONE BROAD, POSITIVE ENUMERATION of the whole category
// the question is about, unconditional on the stem's own polarity. Genuinely new, but built ENTIRELY
// from reused primitives: appearsIn() (comparative_cascade.ts, HARDWIRE-22 exact-match discipline,
// the same verification every extraction in this estate already uses) is the only mechanism this
// function calls -- no new string-matching logic is written.
//
// PURE AND SYNCHRONOUS, same contract as every plow_generator_cascade.ts function: the CALLER
// dispatches the real broad-enumeration query and hands this function the raw response text. Given
// no response, this ABSTAINS -- it never fabricates a jar contents list.

export interface JarMethodResult {
  applied: boolean;
  askedQuery: string;
  affirmedMembers: string[];
  generatedCandidates: string[];
  trace: string;
}

export function generateFromJarMethod(
  categoryQuestionText: string,
  options: OptionLike[],
  jarResponseText: string | null | undefined,
): JarMethodResult {
  if (!jarResponseText || jarResponseText.trim().length === 0) {
    return {
      applied: true,
      askedQuery: categoryQuestionText,
      affirmedMembers: [],
      generatedCandidates: [],
      trace:
        `JAR ABSTAIN: broad membership query built ("${categoryQuestionText}") but no response was ` +
        `supplied by the caller -- honest abstain, never a guess.`,
    };
  }
  const affirmedMembers = options.filter((o) => appearsIn(jarResponseText, o.text)).map((o) => o.letter);
  if (affirmedMembers.length === 0) {
    return {
      applied: true,
      askedQuery: categoryQuestionText,
      affirmedMembers: [],
      generatedCandidates: [],
      trace:
        `JAR ABSTAIN: response returned but verified none of the ${options.length} option(s) ` +
        `verbatim against it -- nothing affirmed, nothing to complement.`,
    };
  }
  const affirmedSet = new Set(affirmedMembers);
  const generatedCandidates = options.map((o) => o.letter).filter((l) => !affirmedSet.has(l));
  return {
    applied: true,
    askedQuery: categoryQuestionText,
    affirmedMembers,
    generatedCandidates,
    trace:
      generatedCandidates.length > 0
        ? `JAR GENERATE: one broad membership search verbatim-affirmed [${affirmedMembers.join(',')}] ` +
          `-- complement (removed in this single pass, like softballs first out of the jar) = ` +
          `[${generatedCandidates.join(',')}].`
        : `JAR NO GENERATE: every option was verbatim-affirmed as a member -- no complement remains, ` +
          `this pass discriminates nothing.`,
  };
}

// ─────────────────────────── RULE 3 / RULE 6 -- CAKE CUT HALF, BIDIRECTIONAL CONSISTENCY (REUSED, plow_generator_cascade G2) ───────────────────────────
//
// Founder, Excerpt 2 step 3: order both directions, require the second to be the exact reverse of
// the first. Named, in Excerpt 4, "elimination cascade with bidirectional consistency validation" --
// Rule 6 is not a SEPARATE stage from Rule 3, it is the Founder's own name for the SAME mechanism
// (checkBidirectionalConsistency, C4, plow_mc_elimination_cascade.ts, reused unchanged inside
// plow_generator_cascade.ts's G2). One element, two of the Founder's own citations for it.

export function generateFromBidirectionalRanking(
  options: OptionLike[],
  mostToLeastResponseText: string | null | undefined,
  leastToMostResponseText: string | null | undefined,
  polarity: ExtremePolarity,
): RankingGenerationResult {
  return coreGenerateFromBidirectionalRanking(options, mostToLeastResponseText, leastToMostResponseText, polarity);
}

// ─────────────────────────── RULE 4 -- RE-INCLUDE JUST-ELIMINATED AS A CONTROL (REUSED, plow_generator_cascade G3) ───────────────────────────
//
// Founder, Excerpt 2 step 4: "now I put BACK IN the ones that were JUST ELIMINATED" and re-ask, as
// a consistency control.

export function generateFromReIncludedControl(
  previouslyEliminated: string[],
  validLetters: Set<string>,
  controlResponseText: string | null | undefined,
  eliminatedFromExtreme: ExtremePolarity,
  controlRankingDirection: ControlRankingDirection = 'most_to_least',
): ReIncludeGenerationResult {
  return generateReIncludedCandidates(
    previouslyEliminated,
    validLetters,
    controlResponseText,
    eliminatedFromExtreme,
    controlRankingDirection,
  );
}

// ─────────────────────────── RULE 5 / RULE 9 -- HARD NUMBER TERMINATION, GATED BY SIGNIFICANT FIGURES (REUSED, plow_generator_cascade G4) ───────────────────────────
//
// Founder, Excerpt 2 step 5: "Finally, I ask the hard statistic numbers." Rule 9 (Excerpt 6, the
// 12" ruler / significant-figures story -- "close enough to figure out if my foot is bigger than
// the shoe I want to fit it in") is not a separate stage: it is the DISCIPLINE that already governs
// this one, via determineRequiredPrecision (C5, plow_mc_elimination_cascade.ts) -- an extreme value
// only generates a candidate when its margin over the runner-up clears the precision the DATA
// itself needs, never a fixed arbitrary tolerance. Folding Rule 9 into Rule 5's own element (rather
// than building a second stage that would have nothing left to gate) is a deliberate reading of the
// transcript, stated here rather than left implicit.

export function generateFromHardNumberTermination(
  options: OptionLike[],
  statsResponseText: string | null | undefined,
  polarity: ExtremePolarity,
): HardNumberGenerationResult {
  return generateFromHardNumberStats(options, statsResponseText, polarity);
}

// ─────────────────────────── RULE 8 -- DERIVED-QUANTITY RECONCILIATION, VIA SYMPY (NEW composition, REUSED SymPy bridge) ───────────────────────────
//
// Founder, Excerpt 6: "Ask for the density. Separately ask for the area. Then check the product
// against an independently sourced population. Two searches, three facts, one multiplication...
// use... Plypy [SymPy] instead of asking Google to do that part for itself." FD-BP141 (Founder,
// verbatim, quoted in this dispatch's own order): "it comes before wolfram because free and does
// calculations" -- SymPy first, a paid service only when the free path fails. THIS FILE DOES NOT
// COMPUTE THE PRODUCT ITSELF, IN JAVASCRIPT, ANYWHERE: it calls reconcileDerivedQuantity() (G1,
// plow_gom_jabbar.ts), which itself calls runSympyMultiplication() -> runSympyArithmetic() (G2,
// same file) -- the EXACT, ALREADY-WORKING `child_process.spawn('python')` bridge to the real,
// installed SymPy 1.14.0 this dispatch's own instructions named directly ("plow_gom_jabbar.ts
// ALREADY has runSympyArithmetic... REUSE IT"). No second SymPy bridge is written in this file.
//
// Per-option: two SEPARATELY sourced factors (e.g. density, area) and one INDEPENDENTLY sourced
// check value (e.g. population). reconcileDerivedQuantity() flags an option whose SymPy-computed
// product does not reconcile with its own independent check value -- "exactly the shape a
// fabricated factor would produce" (that function's own trace language). This element generates a
// candidate ONLY from among options that DID reconcile, and only when the reconciled extreme clears
// determineRequiredPrecision's own significant-figure gate (Rule 9, reused, not re-derived) over the
// reconciled runner-up -- so a caller can never receive a candidate whose own arithmetic
// contradicted itself, and never one forced past an ambiguous margin.

export interface DerivedQuantityOptionInput {
  letter: string;
  factorA: DerivedQuantityFactor;
  factorB: DerivedQuantityFactor;
  independentCheckValue: number;
}

export interface DerivedQuantityOptionReading {
  letter: string;
  reconciliation: GomJabbarG1Result;
}

export interface DerivedQuantityGenerationResult {
  readings: DerivedQuantityOptionReading[];
  generatedCandidate: string | null;
  trace: string;
}

export async function generateFromDerivedQuantityReconciliation(
  inputs: DerivedQuantityOptionInput[],
  polarity: ExtremePolarity,
  relTolerance = 0.05,
): Promise<DerivedQuantityGenerationResult> {
  if (inputs.length === 0) {
    return {
      readings: [],
      generatedCandidate: null,
      trace: 'RULE8 ABSTAIN: no per-option factor triples supplied by the caller -- honest abstain.',
    };
  }
  const readings: DerivedQuantityOptionReading[] = [];
  for (const inp of inputs) {
    // eslint-disable-next-line no-await-in-loop -- one SymPy subprocess call per option, sequential,
    // same discipline every other caller of the register gate / googleBlocks() in this estate uses.
    const reconciliation = await reconcileDerivedQuantity(
      inp.factorA,
      inp.factorB,
      inp.independentCheckValue,
      relTolerance,
    );
    readings.push({ letter: inp.letter, reconciliation });
  }

  const reconciled = readings.filter(
    (r) => r.reconciliation.consistent && r.reconciliation.computedProduct !== null,
  );
  if (reconciled.length < 2) {
    return {
      readings,
      generatedCandidate: null,
      trace:
        `RULE8 ABSTAIN: only ${reconciled.length} of ${inputs.length} option(s) reconciled (SymPy ` +
        `product agreed with its own independent check value, within ${(relTolerance * 100).toFixed(1)}%) ` +
        `-- not enough to discriminate an extreme.`,
    };
  }

  const withValues: OptionValue[] = reconciled.map((r) => ({
    letter: r.letter,
    value: r.reconciliation.computedProduct as number,
  }));
  const requiredPrecision = determineRequiredPrecision(withValues);
  const sorted = [...withValues].sort((a, b) => a.value - b.value);
  const extreme = polarity === 'least' ? sorted[0]! : sorted[sorted.length - 1]!;
  const runnerUp = polarity === 'least' ? sorted[1] : sorted[sorted.length - 2];

  if (requiredPrecision === null || !runnerUp) {
    return {
      readings,
      generatedCandidate: null,
      trace: 'RULE8 ABSTAIN: fewer than 2 distinct reconciled values -- no discrimination possible.',
    };
  }
  const margin = Math.abs(runnerUp.value - extreme.value);
  if (margin < requiredPrecision) {
    return {
      readings,
      generatedCandidate: null,
      trace:
        `RULE8 ABSTAIN: reconciled extreme "${extreme.letter}" (${extreme.value}) and runner-up ` +
        `"${runnerUp.letter}" (${runnerUp.value}) are within ${margin} of each other, below the ` +
        `required precision (${requiredPrecision}, Rule 9) -- ambiguous, not forced.`,
    };
  }
  return {
    readings,
    generatedCandidate: extreme.letter,
    trace:
      `RULE8 GENERATE: ${reconciled.length} of ${inputs.length} option(s) reconciled via SymPy ` +
      `[${withValues.map((v) => `${v.letter}=${v.value}`).join(',')}] -- polarity="${polarity}" ` +
      `extreme is "${extreme.letter}" (${extreme.value}), clearing required precision ` +
      `(${requiredPrecision}, Rule 9) over reconciled runner-up "${runnerUp.letter}" by margin ${margin}.`,
  };
}

// ─────────────────────────── RULE 10 -- ONE-SIDED BOUND ON FABRICATION (REUSED, plow_gom_jabbar G3) ───────────────────────────
//
// Founder, Excerpt 6, the quarters story: his father tallied only the claims OVER a dollar and
// never counted the ones under -- "after I had said over 1 dollar over 27 times, he pointed out
// that I only had $6." ALREADY BUILT at BP141 as plow_gom_jabbar.ts's G3
// (evaluateOneSidedBound/OneSidedBoundClaim) -- this is a thin named wrapper, reused not
// reimplemented, exposed on the elements/ surface for composability with the rest of this file.
//
// ITS ROLE IN A GENERATOR COMPOSITION, STATED PLAINLY: this function does not itself produce an
// option letter -- it is a per-source ADMISSIBILITY check a caller runs BEFORE trusting any
// candidate a source's own elaboration proposed (feeding, downstream, into plow_gom_jabbar.ts's own
// G5 tallyVotesStrikingFailures -- wiring that in is adjudication, out of scope here, same M3
// boundary as every other stage's downstream use). Included here for element-surface completeness
// and independent testability alongside its siblings, not because it changes this file's own union.

export function checkFabricationBound(
  claims: OneSidedBoundClaim[],
  knownCeiling: number,
): OneSidedBoundResult {
  return evaluateOneSidedBound(claims, knownCeiling);
}

// ─────────────────────────── RULE 11 -- PARAPHRASE COLLISION, SYNONYMS ARE NOT IDENTITIES (ALREADY COVERED, NO NEW ELEMENT) ───────────────────────────
//
// Founder, Excerpt 4: "if they WERE the same, they would use the same words. And they don't." This
// is HARDWIRE-22 ("similarity is not identity, never fuzzy") applied throughout this estate already
// -- appearsIn()/toLetters() (comparative_cascade.ts) and answer_key_guard.ts's
// isNearVerbatimOptionMatch() all perform EXACT normalized-string matching, never a similarity
// score. Every function in THIS file that verifies a caller-supplied response against an option
// (generateFromJarMethod above, generateFromInverseFirst/generateFromBidirectionalRanking/
// generateFromReIncludedControl/generateFromHardNumberTermination via their reused
// plow_generator_cascade.ts implementations) already inherits this discipline through appearsIn()/
// extractLetterRankingSequence(). No new element is built for Rule 11 because building one would
// duplicate a discipline this file already depends on rather than adding a missing one.

// ─────────────────────────── RULE 12 -- CATEGORIZE BY SHARED PREDICATE BEFORE ELIMINATING (NEW composition, REUSED catalyst_words.ts) ───────────────────────────
//
// Founder, Excerpt 7: "Well, first, I categorize the possible answers. I note that A, B, sorta C
// but more to that, D, E same as C... G does not." Mechanical grouping BEFORE any elimination
// begins. findCatalystWords() (elements/catalyst_words.ts, D-BP150-004, unmodified) already computes
// the non-circular signal this rule needs: which words VARY across the option set (catalysts, most
// discriminating first) versus which are shared by every option (universal, the ASK's own term).
// This function REPORTS that grouping as evidence for downstream stages -- it does not itself pick
// or eliminate an option (E-MATCH-UP stays field_gate.ts's own named-and-forbidden boundary).

export interface CategorizationResult {
  catalysts: CatalystResult['catalysts'];
  universal: string[];
  perOption: CatalystResult['perOption'];
  why: string;
}

export function categorizeOptionsBySharedPredicate(options: Record<string, string>): CategorizationResult {
  const { catalysts, universal, perOption } = findCatalystWords(options);
  const why =
    universal.length > 0
      ? `${Object.keys(options).length} option(s) categorized: ${universal.length} universal token(s) ` +
        `[${universal.join(', ')}] shared by every option (likely the ASK's own term, per catalyst_words.ts), ` +
        `${catalysts.length} discriminating token(s) found, most-shared-first.`
      : `${Object.keys(options).length} option(s) categorized: no universal token, ${catalysts.length} ` +
        `discriminating token(s) found -- a disjoint option set (e.g. short proper nouns), not a themed one.`;
  return { catalysts, universal, perOption, why };
}

// ─────────────────────────── RULE 13 -- DETERMINE THE QUESTION'S REGISTER/CONTEXT BEFORE APPLYING A DEFINITION (NEW composition, REUSED field_gate.ts) ───────────────────────────
//
// Founder, Excerpt 7: "So I need to define what CONTEXT the question is being asked in... I would
// guess... then it has to do with statistics. How do I know that? I don't, I'm guessing. So I'll
// check." Already built at BP150 as elements/field_gate.ts's E-FIELD-GATE (fieldGate()) -- this is a
// thin named wrapper, reused not reimplemented.
//
// WHAT THIS GENERATES, STATED PLAINLY (a genuine distinction, not a formality): field_gate.ts
// generates a SCOPING CONSTRAINT (a narrowed register/field, e.g. "bias in statistics"), never an
// option letter -- forcing it to pick one letter would be E-MATCH-UP, which field_gate.ts's own
// header names as UNSOLVED and out of bounds. This element is therefore not unioned into this
// file's own letter-candidate set; it is exposed so a caller (a future definitional-shaped
// composition) can scope its OWN candidate-generating queries to the register this determines,
// exactly the way survey_ask.ts already consumes field_gate.ts's scopedTerm today.

export async function generateFromRegisterDetermination(
  term: string,
  askText: string,
  options: Record<string, string> | null,
  ctx: MethodRunContext,
): Promise<FieldGateResult> {
  return fieldGate(term, askText, options, ctx);
}

// ─────────────────────────── NOT IMPLEMENTED, STATED PLAINLY ───────────────────────────

export interface NotImplementedRule {
  rule: string;
  founderName: string;
  reason: string;
}

export const NOT_IMPLEMENTED_RULES: NotImplementedRule[] = [
  {
    rule: 'RULE7',
    founderName: 'The Gom Jabbar Test (unknowable-to-an-echo passphrase probe)',
    reason:
      "plow_gom_jabbar.ts's own G4 (buildIndistinguishableQuery/verifyNoProbeFraming) already builds " +
      'and vets an INDISTINGUISHABLE probe QUERY -- reusable when this rule is eventually built. The ' +
      'harder half is not built anywhere in this codebase: deciding WHICH obscure fact only a genuine ' +
      'source could know (the Founder\'s own "who won the World Series 2 years ago, who was the ' +
      'pitcher" example), and checking the response against independently-known ground truth. That ' +
      'needs a curated, measured fact-selection heuristic this dispatch has no live data to validate ' +
      'against, and this estate\'s own standing discipline (this file\'s Rule 12/14 citations of the ' +
      "same principle) is: do not tune an unmeasured rule into existence. Flagged, not built.",
  },
  {
    rule: 'RULE14',
    founderName: 'Cluster numeric-looking options by shared magnitude/shape',
    reason:
      'The Founder\'s own math-test illustration (52/932/51/9,329,939/49/9.32 splitting into two ' +
      'magnitude-shaped groups by one check) has no existing primitive in this codebase to reuse, and ' +
      'no bundled-corpus measurement is available this pass to calibrate a magnitude-bucket boundary ' +
      'without guessing one -- the same honesty nest.ts\'s own WORD_COUNT_CEILING comment insists on ' +
      '("picked from the bundled 140-question corpus... NOT tuned to force any one case"). Not built ' +
      'this pass; a future ticket should measure it against the bundled corpus first.',
  },
];

// ─────────────────────────── THE COMPOSITE -- RUN WHATEVER STAGES THE CALLER HAS INPUT FOR ───────────────────────────
//
// Unions every rule's generated letters into one candidate set, each candidate carrying
// `agreementWeight: 0` (HARDWIRE-21's own known fix, see this file's header) so a future wiring
// ticket cannot re-introduce the BP148 double-counting regression by omission. A rule the caller
// supplied no input for simply does not run (see `ranByRule`) -- this never fabricates a response on
// a rule's behalf, and never conflates "did not run" with "ran and found nothing" (the same
// distinction plow_generator_cascade.ts's own composite already draws). Rule 13 generates a scope,
// not a letter, and is therefore never added to `generatedCandidates` -- see its own header above.

export interface GeneratedCandidate {
  letter: string;
  rule: string;
  /** ALWAYS 0. See this file's header, HARDWIRE-21's known fix. */
  agreementWeight: 0;
}

export interface GeneratorStagesInput {
  stemText: string;
  askText: string;
  options: OptionLike[];
  optionsMap: Record<string, string>;
  polarity: ExtremePolarity;

  inverseResponseText?: string | null;

  jarCategoryQuestionText?: string;
  jarResponseText?: string | null;

  mostToLeastResponseText?: string | null;
  leastToMostResponseText?: string | null;

  previouslyEliminated?: string[];
  eliminatedFromExtreme?: ExtremePolarity;
  controlResponseText?: string | null;
  controlRankingDirection?: ControlRankingDirection;

  hardNumberStatsResponseText?: string | null;

  derivedQuantityInputs?: DerivedQuantityOptionInput[];

  registerTerm?: string;
  ctx?: MethodRunContext;
}

export interface GeneratorStagesResult {
  generatedCandidates: GeneratedCandidate[];
  ranByRule: Record<'rule1' | 'rule2' | 'rule3' | 'rule4' | 'rule5' | 'rule8' | 'rule13', boolean>;
  rule1: InverseGenerationResult;
  rule2: JarMethodResult;
  rule3: RankingGenerationResult;
  rule4: ReIncludeGenerationResult;
  rule5: HardNumberGenerationResult;
  rule8: DerivedQuantityGenerationResult;
  rule13: FieldGateResult | null;
  notImplemented: NotImplementedRule[];
  trace: string[];
}

export async function runGeneratorStages(input: GeneratorStagesInput): Promise<GeneratorStagesResult> {
  const rule1 = generateFromInverseFirst(input.stemText, input.options, input.inverseResponseText);
  const rule2 = generateFromJarMethod(
    input.jarCategoryQuestionText ?? `which of the following are members of the category this question is about?`,
    input.options,
    input.jarResponseText,
  );
  const rule3 = generateFromBidirectionalRanking(
    input.options,
    input.mostToLeastResponseText,
    input.leastToMostResponseText,
    input.polarity,
  );
  const validLetters = new Set(input.options.map((o) => o.letter));
  const rule4 = generateFromReIncludedControl(
    input.previouslyEliminated ?? [],
    validLetters,
    input.controlResponseText,
    input.eliminatedFromExtreme ?? input.polarity,
    input.controlRankingDirection ?? 'most_to_least',
  );
  const rule5 = generateFromHardNumberTermination(input.options, input.hardNumberStatsResponseText, input.polarity);
  const rule8 =
    input.derivedQuantityInputs && input.derivedQuantityInputs.length > 0
      ? await generateFromDerivedQuantityReconciliation(input.derivedQuantityInputs, input.polarity)
      : {
          readings: [],
          generatedCandidate: null,
          trace: 'RULE8 NOT RUN: no per-option factor triples supplied by the caller.',
        };
  const rule13 =
    input.registerTerm && input.ctx
      ? await generateFromRegisterDetermination(input.registerTerm, input.askText, input.optionsMap, input.ctx)
      : null;

  const candidates: GeneratedCandidate[] = [];
  for (const l of rule1.generatedCandidates) candidates.push({ letter: l, rule: 'RULE1_INVERSE', agreementWeight: 0 });
  for (const l of rule2.generatedCandidates) candidates.push({ letter: l, rule: 'RULE2_JAR_METHOD', agreementWeight: 0 });
  if (rule3.generatedCandidate) candidates.push({ letter: rule3.generatedCandidate, rule: 'RULE3_BIDIRECTIONAL_RANKING', agreementWeight: 0 });
  for (const l of rule4.generatedCandidates) candidates.push({ letter: l, rule: 'RULE4_REINCLUDED_CONTROL', agreementWeight: 0 });
  if (rule5.generatedCandidate) candidates.push({ letter: rule5.generatedCandidate, rule: 'RULE5_HARD_NUMBER', agreementWeight: 0 });
  if (rule8.generatedCandidate) candidates.push({ letter: rule8.generatedCandidate, rule: 'RULE8_DERIVED_QUANTITY_SYMPY', agreementWeight: 0 });
  // rule13 generates a SCOPE, not a letter -- see its own header. Deliberately never pushed here.

  const seen = new Set<string>();
  const generatedCandidates = candidates.filter((c) => {
    if (seen.has(c.letter)) return false;
    seen.add(c.letter);
    return true;
  });

  return {
    generatedCandidates,
    ranByRule: {
      rule1: !!input.inverseResponseText,
      rule2: !!input.jarResponseText,
      rule3: !!(input.mostToLeastResponseText && input.leastToMostResponseText),
      rule4: !!(input.previouslyEliminated && input.previouslyEliminated.length > 0 && !!input.controlResponseText),
      rule5: !!input.hardNumberStatsResponseText,
      rule8: !!(input.derivedQuantityInputs && input.derivedQuantityInputs.length > 0),
      rule13: !!(input.registerTerm && input.ctx),
    },
    rule1,
    rule2,
    rule3,
    rule4,
    rule5,
    rule8,
    rule13,
    notImplemented: NOT_IMPLEMENTED_RULES,
    trace: [
      rule1.trace,
      rule2.trace,
      rule3.trace,
      rule4.trace,
      rule5.trace,
      rule8.trace,
      rule13 ? rule13.why : 'RULE13 NOT RUN: no registerTerm/ctx supplied by the caller.',
    ],
  };
}
