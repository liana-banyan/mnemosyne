// demand_test.define_detection_real_prose.test.ts -- D-BP157-053/BISHOP/seg-define-detection-bug
//
// Verifies the fix for the DEFINE-detection bug named in D-BP150-014's return ("SURVEYED-ASK vs
// QUESTION-STRING DEMAND," reason 2): determineDemandFromSurveyedAsk()'s DEFINE branch relied
// SOLELY on checkKind() (elements/kind_check.ts), whose DEFINITION_LEAD_RE only fires on the
// MMLU-Pro OPTION-phrasing convention ("It describes/refers to/denotes/means/represents/indicates/
// explains..."), not on how real Google prose actually states a definition. Live measured miss at
// D-BP150-014, qid 85: Survey found the correct passage ("A sampling method is called biased if it
// systematically favors some outcomes over others.") but DEFINE never fired because that sentence
// kind-checks as plain PROPOSITION, not DEFINITION-STATEMENT.
//
// This ticket added looksLikeDefinitionalProse() (demand_test.ts) as a SECOND, narrower check that
// runs ALONGSIDE checkKind() inside determineDemandFromSurveyedAsk() -- checkKind() itself and its
// other call site (survey_answers.ts's E-SURVEY-ANSWERS option typing) are byte-unchanged.
//
// Same conventions as this file's siblings (demand_test.six_demand_types.test.ts,
// demand_test.structural_path.test.ts): vitest directly against SOURCE, never dist. Fixtures are
// built directly as plain objects matching survey_ask.ts's exported types rather than calling
// surveyAskNested() itself (which needs a live MethodRunContext/Google/Gemma) -- this file tests
// determineDemandFromSurveyedAsk()'s own DEFINE-detection logic in isolation, at the unit level.
//
// THE THREE ASSERTIONS THE DISPATCH NAMED AS THE MINIMUM:
//   (a) a real-prose DEFINE denotation (the exact live qid-85 passage) is now detected.
//   (b) an MMLU-Pro-shaped denotation ("It describes...") is STILL detected -- no regression on the
//       path this bug was originally built to serve.
//   (c) a near-miss ("is called into question", the idiom this fix's negative lookahead exists to
//       exclude) is NOT detected -- the fix must not become a new false-positive source.
// Plus direct unit coverage of looksLikeDefinitionalProse() itself, isolating the regex behavior
// from the surrounding DEFINE-branch wiring.

import { describe, test, expect } from 'vitest';
import { determineDemandFromSurveyedAsk, looksLikeDefinitionalProse } from './demand_test';
import type {
  SurveyAskNestedResult,
  SurveyAskResult,
  SurveyDenotation,
  SurveyNestLevelResult,
} from './elements/survey_ask';
import type { NestLevel, NestResult } from './elements/nest';

function makeDenotation(sentence: string): SurveyDenotation {
  return {
    sentence,
    sourceUrl: 'https://example.test/fixture',
    sourceTitle: 'test fixture',
    register: null,
    registerWhy: 'test fixture -- register not exercised by this test',
    aspect: { aspect: 'NOMINAL', why: 'test fixture -- aspect not exercised by this test' },
    why: 'test fixture denotation',
  };
}

/** Builds a depth-1 (whole-phrase-only) SurveyAskNestedResult carrying exactly one denotation --
 *  the shape surveyAskNested() produces for a bare term like qid 85's "bias" (D-BP150-014's own
 *  "THE DEPTH-1 SPECIAL CASE" section). */
function makeNestedResult(term: string, sentence: string): SurveyAskNestedResult {
  const level: NestLevel = {
    label: 'whole-phrase',
    text: term,
    why: 'test fixture -- depth-1 special case, buildNest() found no frame/part split',
  };
  const nest: NestResult = {
    input: term,
    levels: [level],
    refused: false,
    why: 'test fixture nest result',
  };
  const survey: SurveyAskResult = {
    term,
    queries: [`define ${term}`],
    denotations: [makeDenotation(sentence)],
    discarded: [],
    reusedSources: [],
    why: 'test fixture survey result',
  };
  const levelResult: SurveyNestLevelResult = { level, surveyedTerm: term, survey };
  return {
    input: term,
    nest,
    levels: [levelResult],
    refused: false,
    why: 'test fixture nested result',
  };
}

describe('looksLikeDefinitionalProse() -- the real-prose definitional-shape check (D-BP157-053)', () => {
  test('detects "is called X if ..." -- the exact live qid-85 passage', () => {
    const r = looksLikeDefinitionalProse(
      'A sampling method is called biased if it systematically favors some outcomes over others.',
    );
    expect(r.isMatch).toBe(true);
    expect(r.label).toContain('called/known as');
  });

  test('detects "is defined as", "refers to", "denotes"', () => {
    expect(looksLikeDefinitionalProse('Bias is defined as a systematic error introduced by sampling.').isMatch).toBe(true);
    expect(looksLikeDefinitionalProse('The term refers to a systematic deviation from a true value.').isMatch).toBe(true);
    expect(looksLikeDefinitionalProse('This word denotes a preference that skews results.').isMatch).toBe(true);
  });

  test('does NOT match the "called into question/doubt" idiom (the declared exclusion)', () => {
    const r = looksLikeDefinitionalProse('This result is called into question by later replication studies.');
    expect(r.isMatch).toBe(false);
  });

  test('does NOT match plain prose carrying none of the closed-class constructions', () => {
    const r = looksLikeDefinitionalProse('The experiment ran for six weeks under controlled conditions.');
    expect(r.isMatch).toBe(false);
  });

  test('empty/whitespace-only input is a clean non-match, not a crash', () => {
    expect(looksLikeDefinitionalProse('').isMatch).toBe(false);
    expect(looksLikeDefinitionalProse('   ').isMatch).toBe(false);
  });
});

describe('determineDemandFromSurveyedAsk() DEFINE branch, fixed (D-BP157-053)', () => {
  test('(a) real-prose DEFINE denotation is now detected -- the live qid-85 miss, fixed', () => {
    const nested = makeNestedResult(
      'bias',
      'A sampling method is called biased if it systematically favors some outcomes over others.',
    );
    const result = determineDemandFromSurveyedAsk(nested);
    expect(result.demand).toBe('DEFINE');
    expect(result.derivedFrom).toBe('surveyed-ask');
    expect(result.why).toContain('real-prose definitional construction');
  });

  test('(b) MMLU-Pro-shaped denotation is STILL detected -- no regression via checkKind()', () => {
    const nested = makeNestedResult(
      'bias',
      'It describes a process that systematically favors certain outcomes over others.',
    );
    const result = determineDemandFromSurveyedAsk(nested);
    expect(result.demand).toBe('DEFINE');
    expect(result.derivedFrom).toBe('surveyed-ask');
    // Must be the checkKind() path, not the new real-prose path -- proves the original detector is
    // untouched and still fires first.
    expect(result.why).toContain('kind-checks as DEFINITION-STATEMENT');
  });

  test('(c) a near-miss ("called into question") must NOT be detected as DEFINE', () => {
    const nested = makeNestedResult(
      'bias',
      'This result is called into question by later replication studies.',
    );
    const result = determineDemandFromSurveyedAsk(nested);
    expect(result.demand).toBeNull();
    expect(result.derivedFrom).toBe('surveyed-ask');
  });
});
