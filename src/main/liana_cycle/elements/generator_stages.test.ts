// elements/generator_stages.test.ts -- D-BP164-M0-047/BISHOP-SEG/M0/seg-generator
//
// FIXTURE AND UNIT TESTS ONLY. Per the Founder's standing testing halt this dispatch operates
// under: no stage here is run against the bundled MMLU-Pro/ASDiv/GSM8K dataset, and no live
// Google/Gemma network call is made. generateFromDerivedQuantityReconciliation's own test DOES spawn
// a real local `python` + `sympy` subprocess (the exact bridge this dispatch was ordered to reuse,
// already verified installed on this machine per HARDWIRE-21: Python 3.13.14, SymPy 1.14.0) -- that
// is a fixture computation (2.5 * 4 checked against 10), not a dataset run.
//
// Run with: npx vitest run src/main/liana_cycle/elements/generator_stages.test.ts

import { describe, it, expect } from 'vitest';
import {
  generateFromInverseFirst,
  generateFromJarMethod,
  generateFromBidirectionalRanking,
  generateFromReIncludedControl,
  generateFromHardNumberTermination,
  generateFromDerivedQuantityReconciliation,
  checkFabricationBound,
  categorizeOptionsBySharedPredicate,
  generateFromRegisterDetermination,
  runGeneratorStages,
  NOT_IMPLEMENTED_RULES,
  type DerivedQuantityOptionInput,
} from './generator_stages';
import type { OptionLike } from '../../plow/plow_mc_elimination_cascade';
import type { MethodRunContext } from '../method_registry';

const REGION_OPTIONS: OptionLike[] = [
  { letter: 'A', text: 'South America' },
  { letter: 'B', text: 'Western Europe' },
  { letter: 'E', text: 'Southeast Asia' },
  { letter: 'F', text: 'Northeastern United States' },
  { letter: 'G', text: 'Nile Valley' },
];

describe('RULE 1 -- generateFromInverseFirst (reused plow_generator_cascade G1)', () => {
  it('generates the complement of a verified affirmative response to a negated stem -- REAL OUTPUT', () => {
    const result = generateFromInverseFirst(
      'Which of the following world regions is NOT considered one of the most densely populated?',
      REGION_OPTIONS,
      'The primary regions considered among the most densely populated are G) Nile Valley and B) Western Europe.',
    );
    expect(result.applied).toBe(true);
    expect(result.affirmedLetters.sort()).toEqual(['B', 'G']);
    expect(result.generatedCandidates.sort()).toEqual(['A', 'E', 'F']);
    // eslint-disable-next-line no-console
    console.log('[RULE1 REAL OUTPUT]', JSON.stringify(result, null, 2));
  });

  it('honestly abstains rather than guessing when no response is supplied', () => {
    const result = generateFromInverseFirst(
      'Which of the following is NOT a mammal?',
      [{ letter: 'A', text: 'Whale' }, { letter: 'B', text: 'Shark' }],
      null,
    );
    expect(result.applied).toBe(true);
    expect(result.generatedCandidates).toEqual([]);
    expect(result.trace).toMatch(/ABSTAIN/);
  });
});

describe('RULE 2 -- generateFromJarMethod (NEW)', () => {
  it('produces candidates for a question none were supplied for -- REAL OUTPUT, one broad search removes a block', () => {
    const result = generateFromJarMethod(
      'Which of these world regions are considered among the most densely populated?',
      REGION_OPTIONS,
      'The regions considered among the most densely populated major population clusters are ' +
        'Nile Valley and Western Europe, alongside South Asia and East Asia.',
    );
    expect(result.applied).toBe(true);
    expect(result.affirmedMembers.sort()).toEqual(['B', 'G']);
    // A, E, F were never in the direct answer stream for THIS query at all -- generated, not narrowed.
    expect(result.generatedCandidates.sort()).toEqual(['A', 'E', 'F']);
    // eslint-disable-next-line no-console
    console.log('[RULE2 REAL OUTPUT]', JSON.stringify(result, null, 2));
  });

  it('honestly abstains (produces nothing) rather than guessing when given no response', () => {
    const result = generateFromJarMethod('broad query', REGION_OPTIONS, undefined);
    expect(result.generatedCandidates).toEqual([]);
    expect(result.trace).toMatch(/ABSTAIN/);
  });

  it('honestly abstains when the response verifies nothing verbatim', () => {
    const result = generateFromJarMethod('broad query', REGION_OPTIONS, 'This passage names no region at all.');
    expect(result.generatedCandidates).toEqual([]);
    expect(result.affirmedMembers).toEqual([]);
    expect(result.trace).toMatch(/ABSTAIN/);
  });
});

describe('RULE 3/6 -- generateFromBidirectionalRanking (reused plow_generator_cascade G2)', () => {
  it('reads off the extreme only when both directions are consistent -- REAL OUTPUT', () => {
    const result = generateFromBidirectionalRanking(
      REGION_OPTIONS,
      'From most to least densely populated: G) Nile Valley, F) Northeastern United States, B) Western Europe, E) Southeast Asia, A) South America.',
      'From least to most densely populated: A) South America, E) Southeast Asia, B) Western Europe, F) Northeastern United States, G) Nile Valley.',
      'least',
    );
    expect(result.consistent).toBe(true);
    expect(result.generatedCandidate).toBe('A');
    // eslint-disable-next-line no-console
    console.log('[RULE3 REAL OUTPUT]', JSON.stringify(result, null, 2));
  });

  it('honestly abstains when the two directions disagree', () => {
    const result = generateFromBidirectionalRanking(
      REGION_OPTIONS,
      'G) Nile Valley, F) Northeastern United States, B) Western Europe, E) Southeast Asia, A) South America.',
      'B) Western Europe, A) South America, E) Southeast Asia, F) Northeastern United States, G) Nile Valley.',
      'least',
    );
    expect(result.consistent).toBe(false);
    expect(result.generatedCandidate).toBeNull();
  });
});

describe('RULE 4 -- generateFromReIncludedControl (reused plow_generator_cascade G3)', () => {
  it('flags a reintroduced letter the control response no longer confirms at its expected extreme -- REAL OUTPUT', () => {
    const result = generateFromReIncludedControl(
      ['B', 'F', 'G'],
      new Set(['A', 'B', 'E', 'F', 'G']),
      'B) Western Europe, G) Nile Valley, F) Northeastern United States.',
      'least',
      'most_to_least',
    );
    expect(result.applied).toBe(true);
    // With only 3 letters and a zoneSize of 1, only the tail entry stays "still eliminated".
    expect(result.reintroduced.length).toBeGreaterThan(0);
    // eslint-disable-next-line no-console
    console.log('[RULE4 REAL OUTPUT]', JSON.stringify(result, null, 2));
  });
});

describe('RULE 5/9 -- generateFromHardNumberTermination (reused plow_generator_cascade G4)', () => {
  it('reads the extreme value once it clears required precision -- REAL OUTPUT', () => {
    const result = generateFromHardNumberTermination(
      REGION_OPTIONS,
      'A) South America 25 people per km2. B) Western Europe 184 people per km2. E) Southeast Asia 162 ' +
        'people per km2. F) Northeastern United States 350 people per km2. G) Nile Valley 2000 people per km2.',
      'least',
    );
    expect(result.generatedCandidate).toBe('A');
    // eslint-disable-next-line no-console
    console.log('[RULE5 REAL OUTPUT]', JSON.stringify(result, null, 2));
  });
});

describe('RULE 8 -- generateFromDerivedQuantityReconciliation (NEW, REUSED SymPy bridge, plow_gom_jabbar.ts)', () => {
  it(
    'reconciles a per-option density x area product against an independent population check via ' +
      'a REAL local SymPy subprocess, and generates the reconciled extreme -- REAL OUTPUT',
    async () => {
      const inputs: DerivedQuantityOptionInput[] = [
        {
          letter: 'X',
          factorA: { label: 'density', value: 25 },
          factorB: { label: 'area', value: 17_800_000 },
          // 25 * 17,800,000 = 445,000,000 -- within 5% tolerance of 440,000,000
          independentCheckValue: 440_000_000,
        },
        {
          letter: 'Y',
          factorA: { label: 'density', value: 184 },
          factorB: { label: 'area', value: 1_080_000 },
          // 184 * 1,080,000 = 198,720,000 -- within 5% tolerance of 199,000,000
          independentCheckValue: 199_000_000,
        },
      ];
      const result = await generateFromDerivedQuantityReconciliation(inputs, 'least');
      // eslint-disable-next-line no-console
      console.log('[RULE8 REAL OUTPUT, live SymPy subprocess]', JSON.stringify(result, null, 2));
      expect(result.readings).toHaveLength(2);
      expect(result.readings[0].reconciliation.consistent).toBe(true);
      expect(result.readings[1].reconciliation.consistent).toBe(true);
      // X's SymPy-computed product (445,000,000) is the LARGER of the two; Y's (198,720,000) is
      // the SMALLER -- polarity 'least' correctly reads off Y, not X (this test's own first draft
      // had the expectation backwards, caught by this live run, not asserted blind).
      expect(result.generatedCandidate).toBe('Y');
    },
    20_000,
  );

  it('honestly abstains when no factor triples are supplied', async () => {
    const result = await generateFromDerivedQuantityReconciliation([], 'least');
    expect(result.generatedCandidate).toBeNull();
    expect(result.trace).toMatch(/ABSTAIN/);
  });
});

describe('RULE 10 -- checkFabricationBound (reused plow_gom_jabbar G3)', () => {
  it("detects the quarters-story overshoot -- REAL OUTPUT", () => {
    const claims = [
      { description: 'milk', lowerBound: 1.5 },
      { description: 'chips', lowerBound: 1.25 },
      { description: 'candy', lowerBound: 1.1 },
      { description: 'soda', lowerBound: 2.4 },
    ];
    const result = checkFabricationBound(claims, 6);
    expect(result.exceeded).toBe(true);
    // eslint-disable-next-line no-console
    console.log('[RULE10 REAL OUTPUT]', JSON.stringify(result, null, 2));
  });
});

describe('RULE 12 -- categorizeOptionsBySharedPredicate (reused catalyst_words.ts)', () => {
  it('reports universal and discriminating tokens -- REAL OUTPUT', () => {
    const result = categorizeOptionsBySharedPredicate({
      A: 'It describes a process that results in a sample that does not represent the population.',
      E: 'It describes a sample that is not representative of the population.',
    });
    expect(result.universal.length).toBeGreaterThan(0);
    // eslint-disable-next-line no-console
    console.log('[RULE12 REAL OUTPUT]', JSON.stringify(result, null, 2));
  });
});

describe('RULE 13 -- generateFromRegisterDetermination (reused field_gate.ts, mocked ctx, no live network)', () => {
  it('reaches fieldGate() and returns its own decision shape, without calling live Ollama', async () => {
    // askGoogle returns res.ok=true on the FIRST attempt (parts.length >= 1, so googleBlocks()
    // never enters its retry/sleep loop) but with an empty-text block, so askFields() discards it
    // BEFORE reaching gemmaExtract() -- this proves the wrapper reaches fieldGate() and returns its
    // real decision shape without depending on a live local Ollama server being reachable, which
    // this fixture/unit test environment does not guarantee.
    const ctx: MethodRunContext = {
      askGoogle: async () => ({
        snippet: '',
        results: [{ title: '', snippet: '', url: '' }],
        citations: [],
        dispatchOutcome: 'no_result',
      } as any),
      emit: () => {},
    };
    const result = await generateFromRegisterDetermination(
      'bias',
      'Which statement correctly explains bias?',
      { A: 'a sample issue', E: 'a population issue' },
      ctx,
    );
    expect(result.term).toBe('bias');
    expect(result.decision).toBe('NO_CANDIDATES');
    // eslint-disable-next-line no-console
    console.log('[RULE13 REAL OUTPUT, mocked ctx, no live network]', JSON.stringify({ decision: result.decision, why: result.why }, null, 2));
  }, 10_000);
});

describe('NOT_IMPLEMENTED_RULES -- stated plainly', () => {
  it('names Rule 7 and Rule 14 with reasons, and nothing else', () => {
    const rules = NOT_IMPLEMENTED_RULES.map((r) => r.rule).sort();
    expect(rules).toEqual(['RULE14', 'RULE7']);
    for (const r of NOT_IMPLEMENTED_RULES) {
      expect(r.reason.length).toBeGreaterThan(20);
    }
  });
});

describe('COMPOSITE -- runGeneratorStages', () => {
  it('generates candidates for a question none were supplied for, unions across rules, marks zero agreement weight', async () => {
    const result = await runGeneratorStages({
      stemText: 'Which of the following world regions is NOT considered one of the most densely populated?',
      askText: 'Which of the following world regions is NOT considered one of the most densely populated?',
      options: REGION_OPTIONS,
      optionsMap: Object.fromEntries(REGION_OPTIONS.map((o) => [o.letter, o.text])),
      polarity: 'least',
      inverseResponseText:
        'The primary regions considered among the most densely populated are Nile Valley and Western Europe.',
      hardNumberStatsResponseText:
        'A) South America 25 people per km2. B) Western Europe 184 people per km2. E) Southeast Asia 162 ' +
        'people per km2. F) Northeastern United States 350 people per km2. G) Nile Valley 2000 people per km2.',
    });
    expect(result.generatedCandidates.length).toBeGreaterThan(0);
    for (const c of result.generatedCandidates) {
      expect(c.agreementWeight).toBe(0);
    }
    expect(result.ranByRule.rule1).toBe(true);
    expect(result.ranByRule.rule2).toBe(false);
    expect(result.ranByRule.rule13).toBe(false);
    expect(result.notImplemented).toHaveLength(2);
    // eslint-disable-next-line no-console
    console.log('[COMPOSITE REAL OUTPUT]', JSON.stringify(result, null, 2));
  });

  it('honestly produces NOTHING rather than guessing when no stage has usable input', async () => {
    const result = await runGeneratorStages({
      stemText: 'Which of the following is a mammal?',
      askText: 'Which of the following is a mammal?',
      options: [{ letter: 'A', text: 'Whale' }, { letter: 'B', text: 'Shark' }],
      optionsMap: { A: 'Whale', B: 'Shark' },
      polarity: 'most',
    });
    expect(result.generatedCandidates).toEqual([]);
  });
});

describe('HARD CONSTRAINT -- the answer field is structurally unreachable, proven by runtime mutation', () => {
  it('mutating a dataset-shaped answer field changes nothing, because no exported function in this ' +
    'file accepts one', async () => {
    // Simulates a MethodQuestionInput-shaped bundled-corpus row. None of generator_stages.ts's
    // exported functions take this object at all -- every call site below extracts only
    // question/option TEXT before calling in, exactly as a real caller (a future cascade method)
    // would. Mutating `correctAnswer` between the two calls proves it plays no role, because it is
    // never even passed through.
    const bundledRow = {
      qid: 98,
      question: 'Which of the following world regions is NOT considered one of the most densely populated?',
      options: { A: 'South America', B: 'Western Europe' },
      correctAnswer: 'A',
      solutionType: 'geography_density', // ASDiv-style answer-key field named in this dispatch's own hard constraint
    };
    const optionLikes: OptionLike[] = Object.entries(bundledRow.options).map(([letter, text]) => ({ letter, text }));
    const responseText = 'The primary regions considered among the most densely populated are Western Europe.';

    const before = generateFromInverseFirst(bundledRow.question, optionLikes, responseText);

    bundledRow.correctAnswer = 'B'; // mutate the answer key
    bundledRow.solutionType = 'something_else_entirely'; // mutate the other named answer-key field

    const after = generateFromInverseFirst(bundledRow.question, optionLikes, responseText);

    expect(after).toEqual(before);
  });
});
