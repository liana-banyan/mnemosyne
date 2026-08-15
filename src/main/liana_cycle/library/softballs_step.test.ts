// softballs_step.test.ts -- D-BP154-013/BISHOP/S13/seg-composerstep
//
// FAIL-BEFORE / PASS-AFTER for THE SOFTBALLS as a Composer step. Mirrors the boundary
// classify_cascade.frame.test.ts's own header states for establishFrame(): the pure parts
// (category derivation, query text, span verification) are exercised directly here, because
// runSoftballsStep() itself calls googleBlocks() (live browser authority) and gemmaExtract()
// (live Ollama) -- neither is available under vitest, so the live orchestration is proven by an
// in-app run instead (this ticket's own return), not by a mock that would only prove the mock.
//
// FAIL-BEFORE: every test below FAILS on main before this ticket, because softballs_step.ts,
// its registration, and its wiring into script_bridge.ts did not exist -- the import at the top
// of this file alone throws "Cannot find module './softballs_step'".

import { describe, test, expect, vi } from 'vitest';
import {
  buildSoftballsQuery, deriveSoftballsCategory, registerSoftballsStep, runSoftballsStep, verifyExcludedEntries,
} from './softballs_step';
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

describe('deriveSoftballsCategory -- reads the category the question itself names, never guesses', () => {
  test('qid 98: "following world regions is" -> "world regions"', () => {
    expect(deriveSoftballsCategory(QID98_QUESTION)).toBe('world regions');
  });

  test('a question with no "following X is/are" shape returns null, not a fabricated category', () => {
    expect(deriveSoftballsCategory('What is the capital of France?')).toBeNull();
  });
});

describe('buildSoftballsQuery -- ONE query, never one per option (FD-BP153-01 consequence 4)', () => {
  test('the query names the category once and lists every option once', () => {
    const q = buildSoftballsQuery('world regions', ALL, OPT);
    expect(q).toContain('Which of the following are NOT world regions at all?');
    for (const L of ALL) expect(q).toContain(OPT[L]);
    // Exactly one query text is built per call -- no loop over options in this function's own
    // signature or body (it takes the whole option set at once).
    expect(q.match(/Which of the following are NOT/g)?.length).toBe(1);
  });
});

describe('verifyExcludedEntries -- extraction only, verified span or discarded (HARDWIRE-22, FD-BP153-07 FIX 2)', () => {
  const passage = 'The Arctic Circle is a line of latitude, not a world region. The Amazon '
    + 'Rainforest is a biome, not a world region. Sahara Desert is a desert biome, not a world '
    + 'region. South Asia, Northeast United States, and Europe are widely recognized world regions.';

  test('THE LOCK: on real qid 98 source wording, excludes exactly G/H/I with their verbatim spans, and nothing else', () => {
    const raw = [
      { name: 'Arctic Circle', span: 'The Arctic Circle is a line of latitude, not a world region.' },
      { name: 'Amazon Rainforest', span: 'The Amazon Rainforest is a biome, not a world region.' },
      { name: 'Sahara Desert', span: 'Sahara Desert is a desert biome, not a world region.' },
    ];
    const { excluded, discarded } = verifyExcludedEntries(raw, passage, OPT);
    expect(excluded.map((e) => e.letter).sort()).toEqual(['G', 'H', 'I']);
    expect(discarded).toBe(0);
    for (const e of excluded) {
      expect(passage).toContain(e.span);
      expect(e.span).toContain(e.name);
    }
  });

  test('a span not verbatim in the passage is discarded and counted, never silently kept', () => {
    const raw = [{ name: 'Arctic Circle', span: 'Arctic Circle is definitely not a world region, everyone agrees.' }];
    const { excluded, discarded } = verifyExcludedEntries(raw, passage, OPT);
    expect(excluded).toHaveLength(0);
    expect(discarded).toBe(1);
  });

  test('a missing span is discarded and counted -- no span, no exclusion', () => {
    const raw = [{ name: 'Arctic Circle', span: '' }];
    const { excluded, discarded } = verifyExcludedEntries(raw, passage, OPT);
    expect(excluded).toHaveLength(0);
    expect(discarded).toBe(1);
  });

  test('ABSENCE IS OMISSION: an option the passage never mentions is never excluded, and never discarded either', () => {
    // South America is not mentioned anywhere in `passage` above -- omission, not denial.
    const { excluded, discarded } = verifyExcludedEntries([], passage, OPT);
    expect(excluded).toHaveLength(0);
    expect(discarded).toBe(0);
  });

  test('NO RULE MAY SELECT A PARTICULAR LETTER: the same check accepts or discards identically regardless of which letter is under test', () => {
    const rawForA = [{ name: 'South America', span: 'South America is not a world region, it is a myth.' }];
    const rawForG = [{ name: 'Arctic Circle', span: 'Arctic Circle is not a world region, it is a myth.' }];
    expect(verifyExcludedEntries(rawForA, passage, OPT).discarded).toBe(1);
    expect(verifyExcludedEntries(rawForG, passage, OPT).discarded).toBe(1);
  });

  // D-BP154-052/BISHOP-SEG/S52/seg-wiregate ACTIVATION PROOF (FD-BP154-08: "tests pass" alone is
  // never ACTIVE). A name carrying a stated parenthetical alias -- "Northern Africa (North
  // Africa)" -- resolves to C) "North Africa" ONLY via entity_resolution.ts's THIRD mechanical
  // step (stated annotation, tried as an alternate name / containment). This file's OLD local
  // matcher (exact match, then a leading "L) " prefix strip only) had no annotation-splitting
  // step at all and would have left this entry unmatched -- "names no known option", zero
  // excluded, zero discarded. If this test passes, verifyExcludedEntries() is actually calling
  // through to the shared resolver's extended mechanism, not merely behaving byte-identically to
  // the retired local copy.
  test('WIRING PROOF: a stated parenthetical alias resolves only through entity_resolution.ts, never through this file\'s own retired local matcher', () => {
    const raw = [{
      name: 'Northern Africa (North Africa)',
      span: 'Northern Africa (North Africa) is not a world region, it is a myth.',
    }];
    const { excluded, discarded } = verifyExcludedEntries(raw, passage + ' ' + raw[0].span, OPT);
    expect(excluded.map((e) => e.letter)).toEqual(['C']);
    expect(discarded).toBe(0);
  });
});

describe('runSoftballsStep -- named failures, never a silent empty result', () => {
  test('no options at all -> ok:false with a named reason, not excluded:[] read as "nothing excluded"', async () => {
    const input: MethodQuestionInput = { question: 'free text, no options', options: null };
    const ctx: MethodRunContext = { askGoogle: vi.fn(), emit: vi.fn() };
    const { result } = await runSoftballsStep(input, ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('no lettered options');
  });

  test('no derivable category -> ok:false with a named reason, never a guessed category', async () => {
    const input: MethodQuestionInput = { question: 'Pick the best one.', options: { A: 'x', B: 'y' } };
    const ctx: MethodRunContext = { askGoogle: vi.fn(), emit: vi.fn() };
    const { result } = await runSoftballsStep(input, ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('could not determine the category');
  });

  test('askGoogle unavailable -> ok:false, named, never "nothing excluded"', async () => {
    // googleBlocks() (comparative_cascade.ts, reused unmodified) retries a null/absent answer up
    // to 3 times with a settling sleep between attempts before it reports failure -- the same
    // bounded-retry idiom every cascade already relies on. This test waits that out for real
    // rather than mocking it away, so the timeout is widened accordingly.
    const input: MethodQuestionInput = { question: QID98_QUESTION, options: OPT };
    const askGoogle = vi.fn().mockResolvedValue(null);
    const ctx: MethodRunContext = { askGoogle, emit: vi.fn() };
    const { result, summary } = await runSoftballsStep(input, ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('no usable answer');
    expect(summary).toContain('FAILED');
  }, 20000);
});

describe('THE STEP REGISTERS -- same wiring path Survey:1/StateTheQuestion:1 already use', () => {
  test('Softballs:1 is listed in the Composer registry and marked executable', () => {
    expect(typeof registerSoftballsStep).toBe('function');
    const entries = listComposerRegistry();
    const entry = entries.find((e) => e.id === 'Softballs:1');
    expect(entry, 'Softballs:1 should be listed').toBeTruthy();
    expect(entry?.executable).toBe(true);
  });

  test('stacking Softballs:1 through runScratchComposer() reaches runSoftballsStep(), never a "no runner wired" failure', async () => {
    // Free text with an explicit option list (same shape script_bridge.test.ts's own
    // StateTheQuestion:1 tests use) -- a NUMERIC qid input would route through parseQid(), which
    // reads the bundled corpus via Electron's `app` (unavailable under vitest, no relation to
    // this step's own logic); free text with typed options avoids that entirely.
    const freeText = `${QID98_QUESTION} ${ALL.map((L) => `${L}) ${OPT[L]}`).join(' ')}`;
    const askGoogle = vi.fn().mockResolvedValue(null); // unavailable -- proves the step RAN, not that it succeeded
    const emit = vi.fn();
    const response = await runScratchComposer(freeText, ['Softballs:1'], askGoogle, emit);
    expect(response.mode).toBe('stack');
    if (response.mode === 'stack') {
      // The step itself RAN and returned an honest result (askGoogle unavailable is a named
      // SoftballsResult failure, never a thrown exception) -- script_runner.ts's own "no runner
      // wired in the composer yet" error (thrown by script_bridge.ts's runOneStep() for an
      // unresolved id) would instead show up as result.ok===false / result.error set. Proves the
      // id resolved to the real function, not the unresolved-id fallback.
      expect(response.result.ok).toBe(true);
      expect(response.result.error).toBeUndefined();
      expect(response.result.results).toHaveLength(1);
      expect(response.result.results[0].summary).toContain('SOFTBALLS');
      const raw = response.result.results[0].raw as { ok: boolean; error?: string };
      expect(raw.ok).toBe(false);
      expect(raw.error).toContain('no usable answer');
    }
  }, 20000);
});
