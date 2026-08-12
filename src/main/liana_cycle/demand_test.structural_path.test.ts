// demand_test.structural_path.test.ts -- D-BP153-001/BISHOP/seg-demand-structural-path
//
// Verifies the LAST-RESORT structural DEMAND path added at BP153, which closes the measured
// failure that kept qid 98 from ever starting a run.
//
// THE FAILURE. Live run, Downloads\latestTest.md (qid 98, confirmed by that file's own SOURCE
// header): SURVEY STEP 2 found no cued term, the ambiguity query returned four terms lifted from
// our own query text ("words", "phrases", "meaning", "fundamentally"), the sig-figs rule correctly
// dropped all four as non-literal-spans, and the run ended DEMAND: UNKNOWN (latestTest.md:561)
// before method selection. Meanwhile extractSuperlativeMatch() -- which classify_cascade.ts's own
// run() already trusts to route this exact question to its superlative-by-magnitude path -- matched
// the question the whole time. Two components agreed and were not connected.
//
// Same conventions as this file's siblings (demand_test.six_demand_types.test.ts): vitest directly
// against SOURCE, never dist -- PROCESS SAFETY forbids writing into dist\ while the Founder's
// `npm run dev` is live.
//
// THE ASSERTIONS:
//   (a) qid 98's EXACT question text, byte-for-byte from resources/mmlu_pro_bundled/questions.jsonl,
//       yields CLASSIFY. This is the regression that matters.
//   (b) the derivation is labeled 'question-string', NOT 'surveyed-ask' -- a structural inference
//       must never be laundered as a surveyed finding.
//   (c) a question with no structural superlative still yields `demand: null`. Refusing beats
//       guessing (canon R-5); this path did not become a catch-all.
//   (d) the receipt names the literal span it matched, so a reader can audit WHY it fired.
//   (e) this path is not answer-key-aware: it sees only the question string, and a question with
//       the same grammar but a different subject still derives CLASSIFY.

import { describe, test, expect } from 'vitest';
import { determineDemandFromQuestionStructure } from './demand_test';

// Byte-for-byte from resources/mmlu_pro_bundled/questions.jsonl, question_id 98.
const QID98 = 'Which of the following world regions is NOT considered one of the world\'s most densely populated regions?';

describe('DEMAND structural path, last resort (D-BP153-001)', () => {
  test('(a) qid 98\'s exact question text derives CLASSIFY', () => {
    const result = determineDemandFromQuestionStructure(QID98);
    expect(result.demand).toBe('CLASSIFY');
  });

  test('(b) the derivation is labeled question-string, never surveyed-ask', () => {
    const result = determineDemandFromQuestionStructure(QID98);
    expect(result.derivedFrom).toBe('question-string');
  });

  test('(c) a question with no structural superlative still refuses', () => {
    const noSuperlative = 'Which of the following is a mammal?';
    const result = determineDemandFromQuestionStructure(noSuperlative);
    expect(result.demand).toBeNull();
    expect(result.derivedFrom).toBe('question-string');
  });

  test('(d) the receipt names the literal span that matched', () => {
    const result = determineDemandFromQuestionStructure(QID98);
    // The span must be a literal substring of the question -- the D-BP152-052 rule that an
    // extracted term be a real span of the original, applied here too.
    expect(result.why).toContain('densely populated');
    expect(QID98.toLowerCase()).toContain('densely populated');
  });

  test('(e) the path reads grammar, not an answer key -- same shape, different subject, same demand', () => {
    const sameShape = 'Which of the following countries is NOT considered one of the world\'s most heavily forested countries?';
    const result = determineDemandFromQuestionStructure(sameShape);
    expect(result.demand).toBe('CLASSIFY');
  });
});
