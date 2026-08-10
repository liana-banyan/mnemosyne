// demand_test.six_demand_types.test.ts -- D-BP152-023/BISHOP/seg-six-demand-types
//
// Verifies FD-BP152-16 (Founder, BP152, verbatim: "part two should offer all six demand types.").
// Part 2 of the Founder's opening query (askOperation(), survey_stage.ts) previously offered only
// four of the six LianaDemand types -- IDENTIFY and LOCATE-IN-FRAMEWORK could never be returned.
// This ticket extended `resources/liana_survey_queries.json`'s `survey.operation.askedText` to
// offer all six (his four words unchanged, plus a TARE-flagged addition: 'identified' and 'placed
// within a framework') and extended `determineDemandFromOperationAnswer()` (demand_test.ts) to map
// the two new words/phrases onto IDENTIFY and LOCATE-IN-FRAMEWORK.
//
// Same conventions as this file's sibling D-BP152 test files (liana_terminal_engine.
// pause_at_step_zero.test.ts, liana_terminal_engine.ask_google_this.test.ts): vitest directly
// against SOURCE (never dist -- PROCESS SAFETY forbids writing into dist\ while the Founder's
// `npm run dev` is live). No electron mock needed -- this file's exports have no electron
// dependency.
//
// THE FIVE ASSERTIONS THIS TICKET'S VERIFY SECTION NAMES:
//   (a) all six words/phrases map to their correct LianaDemand.
//   (b) the four existing (Founder-attributed) mappings are unchanged in behavior.
//   (c) an unmappable answer still yields `demand: null`.
//   (d) an answer matching two or more words/phrases still yields `demand: null`, not a
//       first-match win.
//   (e) the composed Part 2 query still contains the Founder's four words verbatim, in his
//       original order, as a contiguous substring.

import { describe, test, expect } from 'vitest';
import { determineDemandFromOperationAnswer } from './demand_test';
import { getQueryText } from './query_text_loader';

describe('Part 2 offers all six demand types (FD-BP152-16, D-BP152-023)', () => {
  test('(a) all six words/phrases map to their correct LianaDemand', () => {
    expect(determineDemandFromOperationAnswer('ranked').demand).toBe('RANK');
    expect(determineDemandFromOperationAnswer('defined').demand).toBe('DEFINE');
    expect(determineDemandFromOperationAnswer('classified').demand).toBe('CLASSIFY');
    expect(determineDemandFromOperationAnswer('inferred from evidence').demand).toBe('INFER');
    expect(determineDemandFromOperationAnswer('identified').demand).toBe('IDENTIFY');
    expect(determineDemandFromOperationAnswer('placed within a framework').demand).toBe('LOCATE-IN-FRAMEWORK');
  });

  test('(b) the four existing (Founder-attributed) mappings are unchanged in behavior', () => {
    // Same inputs/expectations D-BP152-005 established for these four -- unchanged by this ticket.
    const rank = determineDemandFromOperationAnswer('Ranked.');
    expect(rank.demand).toBe('RANK');
    expect(rank.derivedFrom).toBe('surveyed-ask');

    const define = determineDemandFromOperationAnswer('It wants a definition, so: defined.');
    expect(define.demand).toBe('DEFINE');

    const classify = determineDemandFromOperationAnswer('Classifying.');
    expect(classify.demand).toBe('CLASSIFY');

    const infer = determineDemandFromOperationAnswer('The answer must be inferred from evidence.');
    expect(infer.demand).toBe('INFER');
  });

  test('(c) an unmappable answer still yields demand: null', () => {
    const r = determineDemandFromOperationAnswer('The answer requires counting the vowels.');
    expect(r.demand).toBeNull();
    // Absent/empty answers also still yield null.
    expect(determineDemandFromOperationAnswer(null).demand).toBeNull();
    expect(determineDemandFromOperationAnswer('   ').demand).toBeNull();
  });

  test('(d) an answer matching two or more words/phrases still yields demand: null, not a first-match win', () => {
    // Would previously have silently picked RANK (array order) before the ambiguity check; the
    // ambiguity check itself is untouched by this ticket, exercised here against the six-entry map.
    const rankVsDefine = determineDemandFromOperationAnswer('It wants things ranked, then defined.');
    expect(rankVsDefine.demand).toBeNull();

    // New pair: an answer naming both a new word and an existing word must ALSO yield null, proving
    // the two new entries participate in the same ambiguity check rather than being a bolt-on.
    const identifyVsClassify = determineDemandFromOperationAnswer('Identified, or possibly classified.');
    expect(identifyVsClassify.demand).toBeNull();

    // Both new entries together.
    const identifyVsFramework = determineDemandFromOperationAnswer('Either identified, or placed within a framework.');
    expect(identifyVsFramework.demand).toBeNull();
  });

  test('(e) the composed Part 2 query still contains the Founders four words verbatim, in his original order', () => {
    const askedText = getQueryText('survey.operation.askedText');
    const foundersFour = 'And then what operation does this question require in order to answer it: '
      + 'does it want things ranked, defined, classified, or inferred from evidence?';
    expect(askedText).toContain(foundersFour);
    // And the TARE addition is present too, appended after his sentence, not interleaved with it.
    expect(askedText).toContain('identified');
    expect(askedText).toContain('placed within a framework');
    expect(askedText.indexOf(foundersFour)).toBeLessThan(askedText.indexOf('identified'));
  });
});
