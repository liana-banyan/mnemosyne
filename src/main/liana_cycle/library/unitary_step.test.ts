// unitary_step.test.ts -- D-BP154-043/BISHOP-SEG/S43/seg-unitary
//
// FAIL-BEFORE / PASS-AFTER for 'Unitary:1'. Same boundary as softballs_step.test.ts's own header:
// the pure parts (query text, span verification) are exercised directly; runUnitaryStep() itself
// calls a live conversational authority and a live Ollama extraction, neither available under
// vitest -- proven by an in-app run instead.

import { describe, test, expect } from 'vitest';
import {
  buildUnitaryCorroborationQuery, buildUnitaryQuery, registerUnitaryStep, runUnitaryStep,
  verifyUnitaryExcludedEntries,
} from './unitary_step';
import { listComposerRegistry } from './script_bridge';
import type { MethodQuestionInput, MethodRunContext } from '../method_registry';

const OPT: Record<string, string> = {
  A: 'South America', B: 'South Asia', C: 'North Africa', D: 'Northeast United States', E: 'Europe',
  F: 'Central Asia', G: 'Arctic Circle', H: 'Amazon Rainforest', I: 'Sahara Desert',
};
const ALL = Object.keys(OPT);

describe('buildUnitaryQuery -- ONE query, never one per option', () => {
  test('names every option once and asks about conglomerate/grouping', () => {
    const q = buildUnitaryQuery(ALL, OPT);
    expect(q).toContain('CONGLOMERATE or GROUPING');
    for (const L of ALL) expect(q).toContain(OPT[L]);
    expect(q.match(/CONGLOMERATE or GROUPING/g)?.length).toBe(1);
  });
});

describe('buildUnitaryCorroborationQuery', () => {
  test('asks about the single named option only', () => {
    const q = buildUnitaryCorroborationQuery({ letter: 'F', name: 'Central Asia', span: 'x' });
    expect(q).toContain('Central Asia');
  });
});

describe('verifyUnitaryExcludedEntries -- extraction only, verified span or discarded (HARDWIRE-22)', () => {
  const passage = 'Central Asia is not considered a single world region, but a conglomerate of '
    + 'multiple countries. South America is a single unitary continent.';

  test('keeps an entry with a verbatim, on-topic span', () => {
    const raw = [{ name: 'Central Asia', span: 'Central Asia is not considered a single world region, but a conglomerate of multiple countries.' }];
    const { excluded, discarded } = verifyUnitaryExcludedEntries(raw, passage, OPT);
    expect(excluded).toEqual([{ letter: 'F', name: 'Central Asia', span: raw[0].span }]);
    expect(discarded).toBe(0);
  });

  test('discards an entry whose span is not verbatim in the passage', () => {
    const raw = [{ name: 'Central Asia', span: 'this sentence does not appear anywhere in the passage' }];
    const { excluded, discarded } = verifyUnitaryExcludedEntries(raw, passage, OPT);
    expect(excluded).toEqual([]);
    expect(discarded).toBe(1);
  });

  test('never treats an unmentioned option as excluded -- absence is omission, not a candidate at all', () => {
    const { excluded, discarded } = verifyUnitaryExcludedEntries([], passage, OPT);
    expect(excluded).toEqual([]);
    expect(discarded).toBe(0);
  });

  test('a name matching no known option is not a candidate, not a discard', () => {
    const raw = [{ name: 'Atlantis', span: 'irrelevant' }];
    const { excluded, discarded } = verifyUnitaryExcludedEntries(raw, passage, OPT);
    expect(excluded).toEqual([]);
    expect(discarded).toBe(0);
  });
});

describe('runUnitaryStep -- named failures, honest and pure enough to test without a live authority', () => {
  test('fails honestly with no lettered options', async () => {
    const input: MethodQuestionInput = { question: 'q?', options: null };
    const ctx: MethodRunContext = { askGoogle: async () => null, emit: () => {} };
    const { result } = await runUnitaryStep(input, ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no lettered options/);
  });

  test('fails honestly (never a guessed exclusion) when no authority answers', async () => {
    const input: MethodQuestionInput = { qid: 98, question: 'q?', options: OPT };
    const ctx: MethodRunContext = { askGoogle: async () => null, emit: () => {} };
    const { result } = await runUnitaryStep(input, ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/UNAVAILABLE/);
  }, 20000);
});

describe('registerUnitaryStep / listComposerRegistry -- Unitary:1 is a real, visible, reorderable Composer entry', () => {
  test('registers under the expected id and appears in the composer registry listing', () => {
    try { registerUnitaryStep(); } catch { /* already registered by an earlier test file in this run */ }
    const entries = listComposerRegistry();
    const entry = entries.find((e) => e.id === 'Unitary:1');
    expect(entry).toBeDefined();
    expect(entry?.executable).toBe(true);
  });
});
