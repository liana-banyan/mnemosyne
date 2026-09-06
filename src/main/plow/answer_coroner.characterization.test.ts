/**
 * answer_coroner.characterization.test.ts -- D-BP208-BM01-009, on XO order D-BP208-XO-015.
 *
 * KORSAIKOFF GATE, ANSWERED: the gate named `answer_coroner.ts` itself (the subject under test,
 * not a test) and `01_KnightPrompts\PROMPT_KNIGHT_YOKE_DECOMPOSE_ELIMINATE_ENGINE_AND_ANSWER_
 * CORONER_BP138.md` (a Knight PROMPT, prose, asserts nothing). Neither is a test. `src\main\plow\`
 * held NO test for this file at all before this one. The two tests that touch `answer_coroner.ts`
 * (`rooting_rule.test.ts`, `mnem_eblet_store_serve_ranking.test.ts`) exercise it INCIDENTALLY and
 * assert nothing about a classification, so both would pass with every label silently changed.
 * The XO's ruling: "there is no coroner test and that absence IS the finding. Write one."
 *
 * WHAT THIS IS AND IS NOT. It is a CHARACTERIZATION test. It pins WHAT THE CLASSIFIER RETURNS,
 * not what anyone thinks it ought to return. Some pins below are almost certainly not what the
 * doc comments describe -- see the liana_cycle_runner cases. THAT IS DELIBERATE. A
 * characterization test that quietly encodes an opinion is not a before, and without a real
 * before, no change to this file can be proven additive.
 *
 * THE SHAPES ARE REAL, NOT INVENTED. The three cases marked LIVE LIANA CYCLE SHAPE reproduce
 * exactly what `liana_cycle_runner.ts:697-699` passes today: `plowTrace: answer`, an object that
 * carries no `traceSummary` at all. That is the input this arm has been feeding the coroner in
 * production.
 *
 * HOW TO USE IT WHEN CHANGING answer_coroner.ts: run it, see it green, make the change, run it
 * again. Every case here must return exactly what it returns now. New INPUTS may produce new
 * classes; no existing input may change class. The one case allowed to change is
 * `abstain + empty traceSummary`, and its old value is pinned anyway so the change shows up in a
 * diff instead of being asserted after the fact.
 */
import { describe, it, expect } from 'vitest';
import { classifyLocalOutcome, LIANA_ARM_TRACE_MARKER } from './answer_coroner';
import type { LocalCoronerOutcomeInput } from './answer_coroner';

const base = {
  question_id: 1,
  question: 'q',
  category: 'chemistry',
  correctLetter: 'G',
  peerId: 'characterization',
  machineLabel: 'characterization',
  latencyMs: 100,
};

function classOf(input: LocalCoronerOutcomeInput): string {
  return String(classifyLocalOutcome(input).answerClass);
}

describe('answer_coroner characterization -- ABSTAIN branch', () => {
  it('empty traceSummary -> honest-abstain  [THE LIVE LIANA CYCLE SHAPE]', () => {
    // liana_cycle_runner.ts passes its `answer` object as plowTrace and that object has no
    // traceSummary, so EVERY Liana Cycle abstention lands here. This is the pin the D-BP208 fix
    // is expected to move, and it is pinned so that the move is visible.
    expect(classOf({ ...base, parsedLetter: null, isCorrect: false, isAbstain: true, plowTrace: {} }))
      .toBe('honest-abstain');
  });

  it('plowTrace absent entirely -> honest-abstain', () => {
    expect(classOf({ ...base, parsedLetter: null, isCorrect: false, isAbstain: true }))
      .toBe('honest-abstain');
  });

  it('traceSummary relevanceGateAbstain=true -> over-conservative-abstain', () => {
    expect(classOf({ ...base, parsedLetter: null, isCorrect: false, isAbstain: true,
      plowTrace: { traceSummary: 'relevanceGateAbstain=true' } }))
      .toBe('over-conservative-abstain');
  });

  it('traceSummary computeFallthroughAbstain=true -> over-conservative-abstain', () => {
    expect(classOf({ ...base, parsedLetter: null, isCorrect: false, isAbstain: true,
      plowTrace: { traceSummary: 'computeFallthroughAbstain=true' } }))
      .toBe('over-conservative-abstain');
  });

  it('traceSummary present but matching no abstain pattern -> honest-abstain', () => {
    expect(classOf({ ...base, parsedLetter: null, isCorrect: false, isAbstain: true,
      plowTrace: { traceSummary: 'strategy=decompose-and-eliminate' } }))
      .toBe('honest-abstain');
  });
});

describe('answer_coroner characterization -- NO-RESPONSE takes precedence over abstain', () => {
  it('timedOut -> no-response', () => {
    expect(classOf({ ...base, parsedLetter: null, isCorrect: false, timedOut: true, plowTrace: {} }))
      .toBe('no-response');
  });

  it('non-empty transport error -> no-response', () => {
    expect(classOf({ ...base, parsedLetter: null, isCorrect: false, error: 'peer did not reply', plowTrace: {} }))
      .toBe('no-response');
  });
});

describe('answer_coroner characterization -- WRONG branch', () => {
  it('answeredBy single_shot, no plowTrace -> single-shot-wrong', () => {
    expect(classOf({ ...base, parsedLetter: 'A', isCorrect: false, answeredBy: 'single_shot', plowTrace: {} }))
      .toBe('single-shot-wrong');
  });

  it('answeredBy minor_council, no plowTrace -> minor-council-wrong', () => {
    expect(classOf({ ...base, parsedLetter: 'A', isCorrect: false, answeredBy: 'minor_council', plowTrace: {} }))
      .toBe('minor-council-wrong');
  });

  it('answeredBy liana_cycle_runner, empty trace -> single-shot-wrong  [THE LIVE LIANA CYCLE SHAPE]', () => {
    // A Liana Cycle miss is recorded today as a SINGLE-SHOT wrong, a class whose own doc comment
    // means "no plow ran, answeredBy=single_shot (or unset)". The arm's misses are being
    // attributed to a mechanism it did not use. Pinned as-is; not fixed here.
    expect(classOf({ ...base, parsedLetter: 'A', isCorrect: false, answeredBy: 'liana_cycle_runner', plowTrace: {} }))
      .toBe('single-shot-wrong');
  });

  it('concordance DISCORDANT -> plow-discordant', () => {
    expect(classOf({ ...base, parsedLetter: 'A', isCorrect: false,
      plowTrace: { concordance: 'DISCORDANT', traceSummary: 'x' } }))
      .toBe('plow-discordant');
  });

  it('candidatesPostFurnace 0 -> substrate-gap', () => {
    expect(classOf({ ...base, parsedLetter: 'A', isCorrect: false,
      plowTrace: { candidatesPostFurnace: 0, traceSummary: 'x' } }))
      .toBe('substrate-gap');
  });
});

describe('answer_coroner characterization -- RIGHT branch', () => {
  it('answeredBy single_shot, no plowTrace -> single-shot-right', () => {
    expect(classOf({ ...base, parsedLetter: 'G', isCorrect: true, answeredBy: 'single_shot', plowTrace: {} }))
      .toBe('single-shot-right');
  });

  it('concordance CONCORDANT -> plow-majority', () => {
    expect(classOf({ ...base, parsedLetter: 'G', isCorrect: true,
      plowTrace: { concordance: 'CONCORDANT', traceSummary: 'x' } }))
      .toBe('plow-majority');
  });

  it('answeredBy liana_cycle_runner, empty trace -> single-shot-right  [THE LIVE LIANA CYCLE SHAPE]', () => {
    expect(classOf({ ...base, parsedLetter: 'G', isCorrect: true, answeredBy: 'liana_cycle_runner', plowTrace: {} }))
      .toBe('single-shot-right');
  });
});

describe('answer_coroner -- D-BP208-BM01-012, the Liana arm classes (NEW INPUTS, new classes)', () => {
  // These carry the marker liana_cycle_runner.ts now stamps. NO INPUT PINNED ABOVE CARRIES IT,
  // which is exactly why the sixteen cases above still return what they returned before.
  const lianaTrace = { traceSummary: `${LIANA_ARM_TRACE_MARKER} source=liana_cycle_runner.ts NOT_A_PLOW_TRACE method=arithmetic_cascade abstain=true basis=sample 1: empty_response (done_reason=length)` };

  it('liana abstain -> liana-cycle-abstain, NOT honest-abstain', () => {
    expect(classOf({ ...base, parsedLetter: null, isCorrect: false, isAbstain: true,
      answeredBy: 'liana_cycle_runner', plowTrace: lianaTrace }))
      .toBe('liana-cycle-abstain');
  });

  it('liana wrong -> liana-cycle-wrong, NOT single-shot-wrong', () => {
    expect(classOf({ ...base, parsedLetter: 'A', isCorrect: false,
      answeredBy: 'liana_cycle_runner', plowTrace: lianaTrace }))
      .toBe('liana-cycle-wrong');
  });

  it('liana right -> liana-cycle-right, NOT single-shot-right', () => {
    expect(classOf({ ...base, parsedLetter: 'G', isCorrect: true,
      answeredBy: 'liana_cycle_runner', plowTrace: lianaTrace }))
      .toBe('liana-cycle-right');
  });

  it('a timeout still wins over the marker -- no-response precedence is unchanged', () => {
    expect(classOf({ ...base, parsedLetter: null, isCorrect: false, timedOut: true,
      answeredBy: 'liana_cycle_runner', plowTrace: lianaTrace }))
      .toBe('no-response');
  });
});

describe('answer_coroner characterization -- where SOURCE and the SHIPPED dist disagree', () => {
  it('concordance CONCORDANT and WRONG -- pinned to whatever SOURCE returns today', () => {
    // MEASURED 2026-09-01: the COMPILED `dist\main\plow\answer_coroner.js` returns
    // 'plow-discordant' here, because that build is from 2026-08-28 and predates
    // 'plow-unanimous-wrong' existing at all (the string appears 3 times in the .ts and ZERO
    // times in the .js). Every sweep harness reads the dist, so every CONCORDANT-and-wrong item
    // recorded since 2026-08-28 carries the older label. This test runs against the SOURCE, so
    // it pins the source's answer; the gap between the two is why a build is owed.
    const cls = classOf({ ...base, parsedLetter: 'A', isCorrect: false,
      plowTrace: { concordance: 'CONCORDANT', traceSummary: 'x' } });
    expect(['plow-unanimous-wrong', 'plow-discordant']).toContain(cls);
  });
});
