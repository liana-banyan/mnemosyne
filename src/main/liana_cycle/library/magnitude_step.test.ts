// magnitude_step.test.ts -- D-BP154-022/BISHOP-SEG/S22/seg-magnitude
//
// FAIL-BEFORE / PASS-AFTER for THE MAGNITUDE as the fifth Composer step. Same boundary as
// softballs_step.test.ts's / named_set_step.test.ts's / discriminator_step.test.ts's own headers:
// the pure parts (property/direction derivation, query text, span verification, disagreement
// detection) are exercised directly; runMagnitudeStep() itself needs a live browser authority and
// a live Ollama instance for its two authority-dependent branches (proven by an in-app run
// instead, this ticket's own return) -- its FRAME-REFUSAL branches (no options, no frame
// established, contradictory frame, degenerate frame, no derivable property) are pure/synchronous
// enough to test directly here, same as discriminator_step.test.ts's own "named failures" suite.
//
// FAIL-BEFORE: every test below FAILS on main before this ticket, because magnitude_step.ts, its
// registration, and its wiring into script_bridge.ts/terminator_step.ts did not exist -- the
// import at the top of this file alone throws "Cannot find module './magnitude_step'".
//
// MECHANISM TEST THROUGHOUT (FD-BP153-06): every test below uses INVENTED vocabulary (Alpha/Beta/
// Gamma properties, made-up option names) wherever the assertion is about the MECHANISM, never
// qid 98's own real words -- proving each rule would survive on a question whose answer is
// unknown, the same standard terminator_step.test.ts's own D-BP154-020/021 tests already hold to.

import { describe, test, expect, vi } from 'vitest';
import {
  buildMagnitudeQuery, deriveMagnitudeSuperlativeProperty, deriveMagnitudeTargetExtreme,
  magnitudeOrdersDisagree, registerMagnitudeStep, runMagnitudeStep, verifyMagnitudeOrder,
} from './magnitude_step';
import { listComposerRegistry, runScratchComposer, type ComposerStepOutcome } from './script_bridge';
import type { MethodQuestionInput, MethodRunContext } from '../method_registry';
import type { SoftballsResult } from './softballs_step';

const QID98_QUESTION = "Which of the following world regions is NOT considered one of the world's most densely populated regions?";
const OPT: Record<string, string> = {
  A: 'South America',
  B: 'South Asia',
  C: 'North Africa',
  D: 'Northeast United States',
  E: 'Europe',
  F: 'Central Asia',
  G: 'Arctic Circle',
  H: 'Amazon Rainforest',
  I: 'Sahara Desert',
};
const ALL = Object.keys(OPT);

function softballsExcluding(letters: string[]): SoftballsResult {
  return {
    ok: true, category: 'world regions', query: 'q',
    excluded: letters.map((L) => ({ letter: L, name: OPT[L], span: `${L} is not a world region.` })),
    discarded: 0,
    notExcluded: ALL.filter((L) => !letters.includes(L)),
    via: 'test',
  };
}

describe('deriveMagnitudeSuperlativeProperty -- reads the superlative property, byte-identical twin of discriminator_step.ts\'s own, never guesses', () => {
  test('qid 98 shape', () => {
    expect(deriveMagnitudeSuperlativeProperty(QID98_QUESTION)).toBe("world's most densely populated regions");
  });

  test('a bare-category question with no superlative phrase returns null', () => {
    expect(deriveMagnitudeSuperlativeProperty('Which of the following is NOT a mammal?')).toBeNull();
  });
});

describe('deriveMagnitudeTargetExtreme -- reads which end the QUESTION demands, never guesses which option is extreme', () => {
  test('qid 98 shape: NOT + "most" property -> target is LEAST', () => {
    expect(deriveMagnitudeTargetExtreme(QID98_QUESTION, "world's most densely populated regions")).toBe('least');
  });

  // Invented vocabulary from here down -- proves the MECHANISM (negation x stated direction),
  // never tuned to qid 98's real words.
  test('a direct (non-negated) "most" question targets MOST', () => {
    expect(deriveMagnitudeTargetExtreme('Which of the following is the most Alpha?', 'most Alpha')).toBe('most');
  });

  test('a direct (non-negated) "least" question targets LEAST', () => {
    expect(deriveMagnitudeTargetExtreme('Which of the following is the least Alpha?', 'least Alpha')).toBe('least');
  });

  test('a NOT question about a "least" property targets MOST (the opposite end)', () => {
    expect(deriveMagnitudeTargetExtreme('Which of the following is NOT one of the least Alpha?', 'least Alpha')).toBe('most');
  });

  test('no explicit "most"/"least" word in the property defaults its own direction to "most"', () => {
    expect(deriveMagnitudeTargetExtreme('Which of the following is the Alphaest?', 'Alphaest things')).toBe('most');
  });
});

describe('buildMagnitudeQuery -- restricted to the FRAME, never the full option list (FD-BP153-01)', () => {
  test('only frame members appear in the query, never an eliminated option', () => {
    const q = buildMagnitudeQuery('Alpha Grade', ['A', 'C'], OPT);
    expect(q).toContain(OPT.A);
    expect(q).toContain(OPT.C);
    expect(q).not.toContain(OPT.B);
    expect(q).not.toContain(OPT.D);
  });
});

describe('verifyMagnitudeOrder -- extraction only, verified span or discarded (HARDWIRE-22), never outside the frame', () => {
  const passage = 'Alpha is the most Grade-A of the group. Beta is less Grade-A than Alpha. '
    + 'Gamma is not part of this comparison at all.';
  const OPT2: Record<string, string> = { A: 'Alpha', B: 'Beta', C: 'Gamma' };

  test('a stated order is kept in the given sequence, each entry verbatim-span verified', () => {
    const raw = [
      { name: 'Alpha', span: 'Alpha is the most Grade-A of the group.' },
      { name: 'Beta', span: 'Beta is less Grade-A than Alpha.' },
    ];
    const { order, discarded } = verifyMagnitudeOrder(raw, passage, ['A', 'B'], OPT2);
    expect(order.map((e) => e.letter)).toEqual(['A', 'B']);
    expect(discarded).toBe(0);
  });

  // D-BP154-022 FIX, live-measured this ticket: a real Gemini answer stated a full three-way
  // order in ONE compound sentence ("...the full order ... is C ... as the most ..., A ... as
  // second most ..., and F ... as the least...") and the local extraction model returned zero
  // entries -- an instruction-clarity fix (this file's own instruction/shape text), not a
  // verification change. This test proves the VERIFICATION side already accepted a shared span
  // across multiple entries even before that fix -- the bug was in what the local model chose to
  // extract, never in this choke point. Invented vocabulary, not qid 98's real words.
  test('the SAME whole-sentence span may be reused across multiple entries -- verification never required distinct spans', () => {
    const compoundPassage = 'The full order from most to least Grade-A is Alpha as the most, '
      + 'Beta as second, and Gamma as the least.';
    const raw = [
      { name: 'Alpha', span: 'The full order from most to least Grade-A is Alpha as the most, Beta as second, and Gamma as the least.' },
      { name: 'Beta', span: 'The full order from most to least Grade-A is Alpha as the most, Beta as second, and Gamma as the least.' },
      { name: 'Gamma', span: 'The full order from most to least Grade-A is Alpha as the most, Beta as second, and Gamma as the least.' },
    ];
    const { order, discarded } = verifyMagnitudeOrder(raw, compoundPassage, ['A', 'B', 'C'], OPT2);
    expect(order.map((e) => e.letter)).toEqual(['A', 'B', 'C']);
    expect(discarded).toBe(0);
  });

  test('an option OUTSIDE the frame is never ranked, even if the source mentions it', () => {
    const raw = [
      { name: 'Alpha', span: 'Alpha is the most Grade-A of the group.' },
      { name: 'Gamma', span: 'Gamma is not part of this comparison at all.' },
    ];
    // Frame is {A, B} only -- Gamma (C) is outside it and must never appear in `order`.
    const { order } = verifyMagnitudeOrder(raw, passage, ['A', 'B'], OPT2);
    expect(order.map((e) => e.letter)).toEqual(['A']);
    expect(order.some((e) => e.letter === 'C')).toBe(false);
  });

  test('a span that does not verbatim-match the passage is discarded, not silently kept', () => {
    const raw = [{ name: 'Alpha', span: 'Alpha is the most Grade-A of the group (fabricated addition).' }];
    const { order, discarded } = verifyMagnitudeOrder(raw, passage, ['A', 'B'], OPT2);
    expect(order).toHaveLength(0);
    expect(discarded).toBe(1);
  });

  test('NO RULE MAY SELECT A PARTICULAR LETTER: the same check accepts or discards identically regardless of which letter is under test', () => {
    const rawForA = [{ name: 'Alpha', span: 'Alpha is obviously first, everyone knows.' }];
    const rawForB = [{ name: 'Beta', span: 'Beta is obviously first, everyone knows.' }];
    expect(verifyMagnitudeOrder(rawForA, passage, ['A', 'B'], OPT2).discarded).toBe(1);
    expect(verifyMagnitudeOrder(rawForB, passage, ['A', 'B'], OPT2).discarded).toBe(1);
  });
});

describe('magnitudeOrdersDisagree -- pure sequence comparison, never resolved by force', () => {
  test('identical relative order over shared members -- no disagreement', () => {
    const a = [{ letter: 'A', name: 'Alpha', span: 'x' }, { letter: 'B', name: 'Beta', span: 'y' }, { letter: 'C', name: 'Gamma', span: 'z' }];
    const b = [{ letter: 'B', name: 'Beta', span: 'p' }, { letter: 'C', name: 'Gamma', span: 'q' }];
    expect(magnitudeOrdersDisagree(a, b)).toBe(false);
  });

  test('opposite relative order over shared members -- disagreement', () => {
    const a = [{ letter: 'A', name: 'Alpha', span: 'x' }, { letter: 'B', name: 'Beta', span: 'y' }];
    const b = [{ letter: 'B', name: 'Beta', span: 'p' }, { letter: 'A', name: 'Alpha', span: 'q' }];
    expect(magnitudeOrdersDisagree(a, b)).toBe(true);
  });

  test('fewer than two members in common -- nothing to disagree about', () => {
    const a = [{ letter: 'A', name: 'Alpha', span: 'x' }];
    const b = [{ letter: 'A', name: 'Alpha', span: 'y' }, { letter: 'C', name: 'Gamma', span: 'z' }];
    expect(magnitudeOrdersDisagree(a, b)).toBe(false);
  });
});

describe('runMagnitudeStep -- named failures, never a silent full-option-list ranking (FD-BP153-01)', () => {
  test('no options at all -> ok:false with a named reason', async () => {
    const input: MethodQuestionInput = { question: 'free text, no options', options: null };
    const ctx: MethodRunContext = { askGoogle: vi.fn(), emit: vi.fn() };
    const { result } = await runMagnitudeStep(input, ctx, []);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('no lettered options');
  });

  test('NO frame established (no prior feeder step ran) -> ok:false, refuses rather than ranking everything', async () => {
    const input: MethodQuestionInput = { question: QID98_QUESTION, options: OPT };
    const ctx: MethodRunContext = { askGoogle: vi.fn(), emit: vi.fn() };
    const { result } = await runMagnitudeStep(input, ctx, []); // empty priorResults -- no frame
    expect(result.ok).toBe(false);
    expect(result.error).toContain('no frame was established');
    expect(result.frame).toEqual([]);
  });

  test('a frame established but reduced to fewer than two survivors -> ok:false, nothing to rank', async () => {
    const input: MethodQuestionInput = { question: QID98_QUESTION, options: OPT };
    const ctx: MethodRunContext = { askGoogle: vi.fn(), emit: vi.fn() };
    // Softballs excludes 8 of 9, leaving exactly one survivor.
    const softballs = softballsExcluding(['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']);
    const priorResults: ComposerStepOutcome[] = [{ id: 'Softballs:1', summary: 's', raw: softballs }];
    const { result } = await runMagnitudeStep(input, ctx, priorResults);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('survivor(s)');
  });

  test('a frame established with 2+ survivors but no derivable superlative property -> ok:false, never guesses what to rank by', async () => {
    const input: MethodQuestionInput = { question: 'Which of the following is NOT a mammal?', options: OPT };
    const ctx: MethodRunContext = { askGoogle: vi.fn(), emit: vi.fn() };
    const softballs = softballsExcluding(['D', 'G', 'H', 'I']); // 5 survivors remain, no "one of X" phrase
    const priorResults: ComposerStepOutcome[] = [{ id: 'Softballs:1', summary: 's', raw: softballs }];
    const { result } = await runMagnitudeStep(input, ctx, priorResults);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('could not determine the superlative property');
  });

  test('askGoogle unavailable and no owned evidence -> ok:false, named, never a fabricated order', async () => {
    const input: MethodQuestionInput = { question: QID98_QUESTION, options: OPT };
    const askGoogle = vi.fn().mockResolvedValue(null);
    const ctx: MethodRunContext = { askGoogle, emit: vi.fn() };
    const softballs = softballsExcluding(['D', 'G', 'H', 'I']); // A,B,C,E,F survive -- a real frame
    const priorResults: ComposerStepOutcome[] = [{ id: 'Softballs:1', summary: 's', raw: softballs }];
    const { result, summary } = await runMagnitudeStep(input, ctx, priorResults);
    expect(result.ok).toBe(false);
    expect(result.frame.sort()).toEqual(['A', 'B', 'C', 'E', 'F']);
    expect(result.error).toContain('no usable answer');
    expect(summary).toContain('FAILED');
  }, 20000);
});

describe('THE STEP REGISTERS -- same wiring path Softballs:1/NamedSet:1/Discriminator:1/Terminator:1 already use', () => {
  test('Magnitude:1 is listed in the Composer registry and marked executable', () => {
    expect(typeof registerMagnitudeStep).toBe('function');
    const entries = listComposerRegistry();
    const entry = entries.find((e) => e.id === 'Magnitude:1');
    expect(entry, 'Magnitude:1 should be listed').toBeTruthy();
    expect(entry?.executable).toBe(true);
  });

  test('stacking all five steps together runs them in order, each independently, over the same full option set', async () => {
    const freeText = `${QID98_QUESTION} ${ALL.map((L) => `${L}) ${OPT[L]}`).join(' ')}`;
    const askGoogle = vi.fn().mockResolvedValue(null);
    const emit = vi.fn();
    const response = await runScratchComposer(
      freeText, ['Softballs:1', 'NamedSet:1', 'Discriminator:1', 'Magnitude:1', 'Terminator:1'], askGoogle, emit,
    );
    expect(response.mode).toBe('stack');
    if (response.mode === 'stack') {
      expect(response.result.results.map((r) => r.id)).toEqual(['Softballs:1', 'NamedSet:1', 'Discriminator:1', 'Magnitude:1', 'Terminator:1']);
      // Every feeder step fails honestly (askGoogle unavailable) -> no frame -> Magnitude refuses
      // -> Terminator finds no eliminations at all -> ABSTAIN over the full option list, never a
      // fabricated verdict.
      const magnitudeRaw = response.result.results.find((r) => r.id === 'Magnitude:1')?.raw as { ok: boolean; error?: string };
      expect(magnitudeRaw.ok).toBe(false);
      const terminatorRaw = response.result.results.find((r) => r.id === 'Terminator:1')?.raw as { abstain: boolean };
      expect(terminatorRaw.abstain).toBe(true);
    }
  }, 60000);
});
