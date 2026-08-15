// unitary_step.test.ts -- D-BP154-043/BISHOP-SEG/S43/seg-unitary
//
// FAIL-BEFORE / PASS-AFTER for 'Unitary:1'. Same boundary as softballs_step.test.ts's own header:
// the pure parts (query text, span verification) are exercised directly; runUnitaryStep() itself
// calls a live conversational authority and a live Ollama extraction, neither available under
// vitest -- proven by an in-app run instead.

import { describe, test, expect } from 'vitest';
import {
  buildUnitaryCorroborationQuery, buildUnitaryQuery, registerUnitaryStep, runUnitaryStep,
  verifyUnitaryClassifications,
} from './unitary_step';
import { listComposerRegistry } from './script_bridge';
import type { MethodQuestionInput, MethodRunContext } from '../method_registry';

const OPT: Record<string, string> = {
  A: 'South America', B: 'South Asia', C: 'North Africa', D: 'Northeast United States', E: 'Europe',
  F: 'Central Asia', G: 'Arctic Circle', H: 'Amazon Rainforest', I: 'Sahara Desert',
};
const ALL = Object.keys(OPT);

describe('buildUnitaryQuery -- ONE query, per-option adjudication (D-BP154-045 FIX 1)', () => {
  test('names every option once and asks for a classification of EVERY one, in order, none skipped', () => {
    const q = buildUnitaryQuery(ALL, OPT);
    expect(q).toContain('For EACH of the following');
    expect(q).toContain('every one, in order');
    expect(q).toContain('do not skip any');
    for (const L of ALL) expect(q).toContain(OPT[L]);
    // Never invites naming just ONE conglomerate -- the live defect this fix closes.
    expect(q).not.toMatch(/^Which of the following/);
  });
});

describe('buildUnitaryCorroborationQuery', () => {
  test('asks about the single named option only', () => {
    const q = buildUnitaryCorroborationQuery({ letter: 'F', name: 'Central Asia', span: 'x' });
    expect(q).toContain('Central Asia');
  });
});

describe('verifyUnitaryClassifications -- D-BP154-045 FIX 1: per-option, extraction only, verified span or discarded (HARDWIRE-22)', () => {
  const passage = 'Central Asia is a conglomerate of multiple separate countries, not a single '
    + 'world region. South America is a single unitary continent, not a conglomerate.';

  test('an entry classified "conglomerate" with a verbatim span is excluded', () => {
    const raw = [{ name: 'Central Asia', classification: 'conglomerate', span: 'Central Asia is a conglomerate of multiple separate countries, not a single world region.' }];
    const { excluded, confirmedUnitary, discarded } = verifyUnitaryClassifications(raw, passage, OPT);
    expect(excluded).toEqual([{ letter: 'F', name: 'Central Asia', span: raw[0].span }]);
    expect(confirmedUnitary).toEqual([]);
    expect(discarded).toBe(0);
  });

  test('an entry classified "unitary" with a verbatim span is CONFIRMED, never eliminated', () => {
    const raw = [{ name: 'South America', classification: 'unitary', span: 'South America is a single unitary continent, not a conglomerate.' }];
    const { excluded, confirmedUnitary, discarded } = verifyUnitaryClassifications(raw, passage, OPT);
    expect(excluded).toEqual([]);
    expect(confirmedUnitary).toEqual([{ letter: 'A', name: 'South America', span: raw[0].span }]);
    expect(discarded).toBe(0);
  });

  test('EVERY option the passage addresses is classified in one pass -- both Central Asia (conglomerate) and South America (unitary) together', () => {
    const raw = [
      { name: 'Central Asia', classification: 'conglomerate', span: 'Central Asia is a conglomerate of multiple separate countries, not a single world region.' },
      { name: 'South America', classification: 'unitary', span: 'South America is a single unitary continent, not a conglomerate.' },
    ];
    const { excluded, confirmedUnitary } = verifyUnitaryClassifications(raw, passage, OPT);
    expect(excluded.map((e) => e.letter)).toEqual(['F']);
    expect(confirmedUnitary.map((e) => e.letter)).toEqual(['A']);
  });

  test('discards an entry whose span is not verbatim in the passage', () => {
    const raw = [{ name: 'Central Asia', classification: 'conglomerate', span: 'this sentence does not appear anywhere in the passage' }];
    const { excluded, discarded } = verifyUnitaryClassifications(raw, passage, OPT);
    expect(excluded).toEqual([]);
    expect(discarded).toBe(1);
  });

  test('an entry with no recognized classification value is neither excluded nor confirmed -- UNSTATED, not a discard', () => {
    const raw = [{ name: 'Central Asia', classification: 'maybe', span: 'irrelevant' }];
    const { excluded, confirmedUnitary, discarded } = verifyUnitaryClassifications(raw, passage, OPT);
    expect(excluded).toEqual([]);
    expect(confirmedUnitary).toEqual([]);
    expect(discarded).toBe(0);
  });

  test('never treats an unmentioned option as excluded -- absence is omission, not a candidate at all', () => {
    const { excluded, confirmedUnitary, discarded } = verifyUnitaryClassifications([], passage, OPT);
    expect(excluded).toEqual([]);
    expect(confirmedUnitary).toEqual([]);
    expect(discarded).toBe(0);
  });

  test('a name matching no known option is not a candidate, not a discard', () => {
    const raw = [{ name: 'Atlantis', classification: 'conglomerate', span: 'irrelevant' }];
    const { excluded, discarded } = verifyUnitaryClassifications(raw, passage, OPT);
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
