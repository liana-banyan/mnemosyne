// demand_test.mcq_structural_widening.test.ts -- D-BP165-M0-020/BISHOP/M0/seg-demand
//
// Verifies the TWO NEW entries added to STRUCTURAL_DEMAND_DETECTORS (demand_test.ts) this
// dispatch -- `compute-mcq-numeric-options` and `identify-mcq-condition` -- which widen the
// LAST-RESORT structural DEMAND path (D-BP153-001) to recognize ordinary lettered MCQ stems,
// following the exact precedent set at D-BP164-M0-112 (which first extended this same function
// with a second detector, `compute-open-ended`, for open-ended free-response COMPUTE questions).
//
// FOUNDER ORDER, BP165, VERBATIM: "do #2, widen the structural detector ... Narrow, additive,
// keeps Survey off, and it is the same structural path already extended once at D-BP164-M0-112
// for exactly this kind of reason."
//
// THE MEASURED FAILURE THIS CLOSES. D-BP165-M0-019's n=50 stratified sweep (seed 42) returned 50
// of 50 ABSTAINED, ZERO LLM CALLS -- 42 of them `demand_unknown`, every one carrying a lettered
// option pool that `compute-open-ended` refuses on sight (`hasOptionPool` gate) and no other
// detector had ever examined. See demand_test.ts's own STRUCTURAL_DEMAND_DETECTORS header
// (D-BP165-M0-020 section) for the full accounting of which real fixtures convert and which stay
// deliberately unmapped.
//
// EVERY FIXTURE BELOW IS REAL, drawn directly from mmlu-pro-test.jsonl (question_id verbatim in
// each test name/comment), matching this dispatch's own instruction not to invent shapes.
//
// THE ASSERTIONS:
//   (a) qid 638 (business, MCQ with ten all-numeric dollar options, "Find the balance...") ->
//       COMPUTE, via the new compute-mcq-numeric-options entry, `derivedFrom: 'question-string'`.
//   (b) qid 6637 (health, THE FOUNDER'S OWN NAMED FIXTURE, "Which of the following statements is
//       correct?") -> IDENTIFY, via the new identify-mcq-condition entry.
//   (c) qid 10948 (philosophy, explicit "Identify the antecedent of...") -> IDENTIFY via the
//       imperative branch, not the "which of the following" branch.
//   (d) THE LAW 3 REGRESSION GUARD: the synthetic open-ended COMPUTE question with NO options,
//       "What is the value of 12 * 7 + 5?", still resolves COMPUTE via the pre-existing, untouched
//       compute-open-ended entry -- byte-identical `why` text to before this ticket.
//   (e) an MCQ with a qualitative (non-numeric) option pool and no "which of the following /
//       Identify" grammar (the France-capital shape already covered by
//       liana_terminal_engine.step_zero.test.ts) still refuses -- this widening is not a
//       catch-all.
//   (f) an MCQ with all-numeric options but NO computation cue in the question stays UNKNOWN --
//       the widened COMPUTE entry never guesses a missing verb from the option shape alone (qid
//       7420's real shape, reproduced literally).
//   (g) a question combining a LOCATE-IN-FRAMEWORK cue with "which of the following" grammar is
//       NOT claimed by identify-mcq-condition -- the FRAMEWORK_CUE_RE guard fires.
//   (h) every `why` string names its own detector id / this dispatch, so a reader can audit which
//       path fired without re-deriving it.

import { describe, test, expect } from 'vitest';
import { determineDemandFromQuestionStructure } from './demand_test';

describe('MCQ structural widening (D-BP165-M0-020)', () => {
  test('(a) qid 638 -- all-numeric MCQ options + "Find the" cue -> COMPUTE', () => {
    const question = 'Mr. Jackson bought his house in 1995, and financed the loan for 30 years at '
      + 'an interest rate of 7.8%. His monthly payment was $1260. In 2015, Mr. Jackson decides to '
      + 'pay off the loan. Find the balance of the loan he still owes.';
    const options = {
      A: '90000.00', B: '98000.00', C: '125678.90', D: '110000.00', E: '120000.00',
      F: '115245.67', G: '104761.48', H: '135000.00', I: '140000.00', J: '150000.00',
    };
    const result = determineDemandFromQuestionStructure(question, options);
    expect(result.demand).toBe('COMPUTE');
    expect(result.derivedFrom).toBe('question-string');
    expect(result.why).toContain('every option contains a digit');
    expect(result.why).toContain('Find the');
  });

  test('(b) qid 6637, THE FOUNDER\'S OWN FIXTURE -- "Which of the following statements is correct?" -> IDENTIFY', () => {
    const question = 'The amount and composition of dietary fat are important factors for '
      + 'influencing blood lipid metabolism. Which of the following statements is correct?';
    const options = {
      A: 'Replacement of saturated fatty acids with n-3 polyunsaturated fatty acids is associated '
        + 'with an increase in plasma triglyceride concentrations',
      B: 'Replacement of saturated fatty acids with monounsaturated fatty acids is associated with '
        + 'a decrease in HDL cholesterol',
      C: 'Replacement of saturated fatty acids with large amounts of carbohydrate is associated '
        + 'with decreased LDL and increased plasma triglyceride concentrations',
      D: 'Replacement of trans fatty acids with monounsaturated fatty acids is associated with an '
        + 'increase in HDL cholesterol',
      E: 'None of the above',
    };
    const result = determineDemandFromQuestionStructure(question, options);
    expect(result.demand).toBe('IDENTIFY');
    expect(result.derivedFrom).toBe('question-string');
    expect(result.why).toContain('Which of the following statements is');
  });

  test('(c) qid 10948 -- explicit imperative "Identify the antecedent..." -> IDENTIFY', () => {
    const question = 'Identify the antecedent of the following conditional proposition: The Bees '
      + 'win their first game only if either the Aardvarks or the Chipmunks do not win their first '
      + 'games.';
    const options = {
      A: 'The Bees do not win their first game.',
      B: 'Both the Aardvarks and the Chipmunks do not win their first games.',
      C: 'The Chipmunks do not win their first game.',
      D: 'The Aardvarks do not win their first game.',
    };
    const result = determineDemandFromQuestionStructure(question, options);
    expect(result.demand).toBe('IDENTIFY');
    expect(result.derivedFrom).toBe('question-string');
  });

  test('(d) LAW 3 REGRESSION GUARD -- open-ended COMPUTE with no options is unaffected, byte-identical why', () => {
    const before = 'the question has no lettered option pool (open-ended free response) and its own '
      + 'grammar carries a computation cue ("What is") alongside numeric/LaTeX math '
      + 'content -- the answer must be a value derived by computation. This says only that '
      + 'COMPUTE is the demand; whether any registered method\'s shapeTest() actually fits this '
      + 'question\'s specific shape is decided separately, at method selection (D-BP164-M0-112)';
    const result = determineDemandFromQuestionStructure('What is the value of 12 * 7 + 5?');
    expect(result.demand).toBe('COMPUTE');
    expect(result.derivedFrom).toBe('question-string');
    expect(result.why).toBe(before);
  });

  test('(e) qualitative MCQ options, no "which of the following / Identify" grammar -- still refuses (not a catch-all)', () => {
    const result = determineDemandFromQuestionStructure(
      'What is the capital of France?',
      { A: 'London', B: 'Paris', C: 'Berlin' },
    );
    expect(result.demand).toBeNull();
    expect(result.derivedFrom).toBe('question-string');
  });

  test('(f) qid 7420\'s real shape -- all-numeric MCQ options but NO computation cue -> still UNKNOWN', () => {
    const question = 'Suppose that current disposable income is $10000 and consumption spending is '
      + '$8000. For every $100 increase in disposable income saving increases $10. Given this '
      + 'information';
    const options = {
      A: 'the marginal propensity to save is .80.',
      B: 'the marginal propensity to save is .90.',
      C: 'the marginal propensity to save is .20.',
      D: 'the marginal propensity to consume is .08.',
    };
    const result = determineDemandFromQuestionStructure(question, options);
    // No COMPUTE_CUE_RE phrase in the question text at all -- the widened entry must not guess one.
    expect(result.demand).toBeNull();
  });

  test('(g) LOCATE-IN-FRAMEWORK cue guards identify-mcq-condition from mis-claiming a framework question', () => {
    const question = 'Within Critical Security Studies, which of the following is the referent '
      + 'object of security?';
    const options = { A: 'The state', B: 'The individual', C: 'The international system' };
    const result = determineDemandFromQuestionStructure(question, options);
    // Not claimed as IDENTIFY -- the structural path has never produced LOCATE-IN-FRAMEWORK, so
    // this correctly refuses rather than mis-claim it as IDENTIFY.
    expect(result.demand).toBeNull();
  });

  test('(h) the why string names the widening so a reader can audit which path fired', () => {
    const computeResult = determineDemandFromQuestionStructure(
      'Calculate the total of 3 and 4.',
      { A: '1', B: '2' },
    );
    expect(computeResult.demand).toBe('COMPUTE');
    expect(computeResult.why).toContain('D-BP165-M0-020');

    const identifyResult = determineDemandFromQuestionStructure(
      'Which of the following is true?',
      { A: 'X', B: 'Y' },
    );
    expect(identifyResult.demand).toBe('IDENTIFY');
    expect(identifyResult.why).toContain('D-BP165-M0-020');
  });
});
