// named_set_step.test.ts -- D-BP154-013/BISHOP/S13/seg-composerstep, STEP 2/3
//
// FAIL-BEFORE / PASS-AFTER for THE NAMED SET as a Composer step. Same boundary as
// softballs_step.test.ts's own header: the pure parts (property derivation, query text, span
// verification) are exercised directly; runNamedSetStep() itself needs a live browser authority
// and a live Ollama instance, proven by an in-app run instead (this ticket's own return).
//
// FAIL-BEFORE: every test below FAILS on main before this ticket, because named_set_step.ts, its
// registration, and its wiring into script_bridge.ts did not exist -- the import at the top of
// this file alone throws "Cannot find module './named_set_step'".

import { describe, test, expect, vi } from 'vitest';
import {
  buildNamedSetQuery, deriveNamedSetProperty, registerNamedSetStep, runNamedSetStep, verifyIncludedEntries,
} from './named_set_step';
import { listComposerRegistry, runScratchComposer } from './script_bridge';
import type { MethodQuestionInput, MethodRunContext } from '../method_registry';

// qid 98's real option letters, from resources/mmlu_pro_bundled/questions.jsonl (question_id 98).
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
const QID98_QUESTION = "Which of the following world regions is NOT considered one of the world's most densely populated regions?";

describe('deriveNamedSetProperty -- reads the FULL superlative property the question itself names, never guesses', () => {
  test('qid 98: "...one of the world\'s most densely populated regions?" -> "world\'s most densely populated regions"', () => {
    expect(deriveNamedSetProperty(QID98_QUESTION)).toBe("world's most densely populated regions");
  });

  test('a question with no "one of/considered ...?" shape returns null, not a fabricated property', () => {
    expect(deriveNamedSetProperty('What is the capital of France?')).toBeNull();
  });
});

describe('buildNamedSetQuery -- ONE query, never one per option (FD-BP153-01 consequence 4)', () => {
  test('the query names the property once and lists every option once', () => {
    const q = buildNamedSetQuery("world's most densely populated regions", ALL, OPT);
    expect(q).toContain("Which of the following ARE world's most densely populated regions?");
    for (const L of ALL) expect(q).toContain(OPT[L]);
    expect(q.match(/Which of the following ARE/g)?.length).toBe(1);
  });
});

describe('verifyIncludedEntries -- extraction only, verified span or discarded (HARDWIRE-22, FD-BP153-07 FIX 2)', () => {
  // FD-BP153-04's own measured BP153 evidence, verbatim: "Only B (South Asia), D (Northeast
  // United States), and E (Europe) are recognized in human geography as major global population
  // clusters."
  const passage = 'Options A (South America), C (North Africa), F (Central Asia), G (Arctic '
    + 'Circle), H (Amazon Rainforest), and I (Sahara Desert) are all NOT considered among the '
    + "world's most densely populated regions. Only B (South Asia), D (Northeast United States), "
    + 'and E (Europe) are recognized in human geography as major global population clusters.';

  test('THE LOCK: on the real BP153 source wording, includes exactly B/D/E with their verbatim spans, and nothing else', () => {
    const raw = [
      { name: 'South Asia', span: 'Only B (South Asia), D (Northeast United States), and E (Europe) are recognized in human geography as major global population clusters.' },
      { name: 'Northeast United States', span: 'Only B (South Asia), D (Northeast United States), and E (Europe) are recognized in human geography as major global population clusters.' },
      { name: 'Europe', span: 'Only B (South Asia), D (Northeast United States), and E (Europe) are recognized in human geography as major global population clusters.' },
    ];
    const { included, discarded } = verifyIncludedEntries(raw, passage, OPT);
    expect(included.map((e) => e.letter).sort()).toEqual(['B', 'D', 'E']);
    expect(discarded).toBe(0);
    for (const e of included) {
      expect(passage).toContain(e.span);
      expect(e.span).toContain(e.name);
    }
  });

  test('a span not verbatim in the passage is discarded and counted, never silently kept', () => {
    const raw = [{ name: 'South Asia', span: 'South Asia is definitely one of them, everyone agrees.' }];
    const { included, discarded } = verifyIncludedEntries(raw, passage, OPT);
    expect(included).toHaveLength(0);
    expect(discarded).toBe(1);
  });

  test('a missing span is discarded and counted -- no span, no inclusion', () => {
    const raw = [{ name: 'South Asia', span: '' }];
    const { included, discarded } = verifyIncludedEntries(raw, passage, OPT);
    expect(included).toHaveLength(0);
    expect(discarded).toBe(1);
  });

  test('ABSENCE IS OMISSION: an option the passage never affirms is never included, and never discarded either', () => {
    const { included, discarded } = verifyIncludedEntries([], passage, OPT);
    expect(included).toHaveLength(0);
    expect(discarded).toBe(0);
  });

  test('NO RULE MAY SELECT A PARTICULAR LETTER: the same check accepts or discards identically regardless of which letter is under test', () => {
    const rawForA = [{ name: 'South America', span: 'South America is one of them, it is a myth.' }];
    const rawForB = [{ name: 'South Asia', span: 'South Asia is one of them, it is a myth.' }];
    expect(verifyIncludedEntries(rawForA, passage, OPT).discarded).toBe(1);
    expect(verifyIncludedEntries(rawForB, passage, OPT).discarded).toBe(1);
  });
});

describe('runNamedSetStep -- named failures, never a silent empty result', () => {
  test('no options at all -> ok:false with a named reason, not included:[] read as "nothing included"', async () => {
    const input: MethodQuestionInput = { question: 'free text, no options', options: null };
    const ctx: MethodRunContext = { askGoogle: vi.fn(), emit: vi.fn() };
    const { result } = await runNamedSetStep(input, ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('no lettered options');
  });

  test('no derivable property -> ok:false with a named reason, never a guessed property', async () => {
    const input: MethodQuestionInput = { question: 'Pick the best one.', options: { A: 'x', B: 'y' } };
    const ctx: MethodRunContext = { askGoogle: vi.fn(), emit: vi.fn() };
    const { result } = await runNamedSetStep(input, ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('could not determine the superlative property');
  });

  test('askGoogle unavailable -> ok:false, named, never "nothing included"', async () => {
    // googleBlocks() (comparative_cascade.ts, reused unmodified) retries a null/absent answer up
    // to 3 times with a settling sleep between attempts -- see softballs_step.test.ts's own
    // identical note. Timeout widened accordingly.
    const input: MethodQuestionInput = { question: QID98_QUESTION, options: OPT };
    const askGoogle = vi.fn().mockResolvedValue(null);
    const ctx: MethodRunContext = { askGoogle, emit: vi.fn() };
    const { result, summary } = await runNamedSetStep(input, ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('no usable answer');
    expect(summary).toContain('FAILED');
  }, 20000);
});

describe('THE STEP REGISTERS -- same wiring path Survey:1/StateTheQuestion:1/Softballs:1 already use', () => {
  test('NamedSet:1 is listed in the Composer registry and marked executable', () => {
    expect(typeof registerNamedSetStep).toBe('function');
    const entries = listComposerRegistry();
    const entry = entries.find((e) => e.id === 'NamedSet:1');
    expect(entry, 'NamedSet:1 should be listed').toBeTruthy();
    expect(entry?.executable).toBe(true);
  });

  test('stacking NamedSet:1 through runScratchComposer() reaches runNamedSetStep(), never a "no runner wired" failure', async () => {
    const freeText = `${QID98_QUESTION} ${ALL.map((L) => `${L}) ${OPT[L]}`).join(' ')}`;
    const askGoogle = vi.fn().mockResolvedValue(null); // unavailable -- proves the step RAN, not that it succeeded
    const emit = vi.fn();
    const response = await runScratchComposer(freeText, ['NamedSet:1'], askGoogle, emit);
    expect(response.mode).toBe('stack');
    if (response.mode === 'stack') {
      expect(response.result.ok).toBe(true);
      expect(response.result.error).toBeUndefined();
      expect(response.result.results).toHaveLength(1);
      expect(response.result.results[0].summary).toContain('NAMED SET');
      const raw = response.result.results[0].raw as { ok: boolean; error?: string };
      expect(raw.ok).toBe(false);
      expect(raw.error).toContain('no usable answer');
    }
  }, 20000);
});
