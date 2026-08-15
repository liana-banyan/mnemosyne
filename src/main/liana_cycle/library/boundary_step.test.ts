// boundary_step.test.ts -- D-BP154-053/BISHOP-SEG/S52/seg-wiregate PART 1 CONTINUATION
//
// FAIL-BEFORE / PASS-AFTER for 'BoundaryStability:1'. Same boundary as unitary_step.test.ts's own
// header: the pure parts (query text, span verification) are exercised directly; runBoundaryStep()
// itself calls a live conversational authority and a live Ollama extraction, neither available
// under vitest -- proven by an in-app run instead.
//
// FAIL-BEFORE: every test below FAILS on main before this ticket, because boundary_step.ts did not
// exist -- the import at the top of this file alone throws "Cannot find module './boundary_step'".

import { describe, test, expect } from 'vitest';
import {
  buildBoundaryCorroborationQuery, buildBoundaryQuery, registerBoundaryStep, runBoundaryStep,
  verifyBoundaryClassifications,
} from './boundary_step';
import { listComposerRegistry } from './script_bridge';
import type { MethodQuestionInput, MethodRunContext } from '../method_registry';

const OPT: Record<string, string> = {
  A: 'South America', B: 'South Asia', C: 'North Africa', D: 'Northeast United States', E: 'Europe',
  F: 'Central Asia', G: 'Arctic Circle', H: 'Amazon Rainforest', I: 'Sahara Desert',
};
const ALL = Object.keys(OPT);

describe('buildBoundaryQuery -- ONE query, per-option adjudication', () => {
  test('names every option once and asks for a classification of EVERY one, in order, none skipped', () => {
    const q = buildBoundaryQuery(ALL, OPT);
    expect(q).toContain('For EACH of the following');
    expect(q).toContain('every one, in order');
    expect(q).toContain('do not skip any');
    for (const L of ALL) expect(q).toContain(OPT[L]);
  });
});

describe('buildBoundaryCorroborationQuery', () => {
  test('asks about the single named option only', () => {
    const q = buildBoundaryCorroborationQuery({ letter: 'F', name: 'Central Asia', span: 'x' });
    expect(q).toContain('Central Asia');
  });
});

describe('verifyBoundaryClassifications -- per-option, extraction only, verified span or discarded (HARDWIRE-22)', () => {
  const passage = 'Central Asia has a materially variable boundary across world-regional usage, '
    + 'and the item supplies no boundary definition for it. South America has a stable, '
    + 'consistently-used boundary, routinely used in density comparisons.';

  test('an entry classified "variable" with a verbatim span is unstable', () => {
    const raw = [{
      name: 'Central Asia', classification: 'variable',
      span: 'Central Asia has a materially variable boundary across world-regional usage, and the item supplies no boundary definition for it.',
    }];
    const { unstable, confirmedStable, discarded } = verifyBoundaryClassifications(raw, passage, OPT);
    expect(unstable).toEqual([{ letter: 'F', name: 'Central Asia', span: raw[0].span }]);
    expect(confirmedStable).toEqual([]);
    expect(discarded).toBe(0);
  });

  test('an entry classified "stable" with a verbatim span is CONFIRMED, never eliminated', () => {
    const raw = [{
      name: 'South America', classification: 'stable',
      span: 'South America has a stable, consistently-used boundary, routinely used in density comparisons.',
    }];
    const { unstable, confirmedStable, discarded } = verifyBoundaryClassifications(raw, passage, OPT);
    expect(unstable).toEqual([]);
    expect(confirmedStable).toEqual([{ letter: 'A', name: 'South America', span: raw[0].span }]);
    expect(discarded).toBe(0);
  });

  test('EVERY option the passage addresses is classified in one pass -- Central Asia (variable) and South America (stable) together', () => {
    const raw = [
      {
        name: 'Central Asia', classification: 'variable',
        span: 'Central Asia has a materially variable boundary across world-regional usage, and the item supplies no boundary definition for it.',
      },
      {
        name: 'South America', classification: 'stable',
        span: 'South America has a stable, consistently-used boundary, routinely used in density comparisons.',
      },
    ];
    const { unstable, confirmedStable } = verifyBoundaryClassifications(raw, passage, OPT);
    expect(unstable.map((e) => e.letter)).toEqual(['F']);
    expect(confirmedStable.map((e) => e.letter)).toEqual(['A']);
  });

  test('discards an entry whose span is not verbatim in the passage', () => {
    const raw = [{ name: 'Central Asia', classification: 'variable', span: 'this sentence does not appear anywhere in the passage' }];
    const { unstable, discarded } = verifyBoundaryClassifications(raw, passage, OPT);
    expect(unstable).toEqual([]);
    expect(discarded).toBe(1);
  });

  test('an entry with no recognized classification value is neither unstable nor confirmed -- UNSTATED, not a discard', () => {
    const raw = [{ name: 'Central Asia', classification: 'maybe', span: 'irrelevant' }];
    const { unstable, confirmedStable, discarded } = verifyBoundaryClassifications(raw, passage, OPT);
    expect(unstable).toEqual([]);
    expect(confirmedStable).toEqual([]);
    expect(discarded).toBe(0);
  });

  test('never treats an unmentioned option as unstable -- absence is omission, not a candidate at all', () => {
    const { unstable, confirmedStable, discarded } = verifyBoundaryClassifications([], passage, OPT);
    expect(unstable).toEqual([]);
    expect(confirmedStable).toEqual([]);
    expect(discarded).toBe(0);
  });

  test('a name matching no known option is not a candidate, not a discard', () => {
    const raw = [{ name: 'Atlantis', classification: 'variable', span: 'irrelevant' }];
    const { unstable, discarded } = verifyBoundaryClassifications(raw, passage, OPT);
    expect(unstable).toEqual([]);
    expect(discarded).toBe(0);
  });

  // D-BP154-052/BISHOP-SEG/S52/seg-wiregate ACTIVATION PROOF: this file was built from the start
  // on entity_resolution.ts's shared resolver (never a local mirror) -- a stated parenthetical
  // alias resolves via that resolver's third mechanical step.
  test('WIRING PROOF: a stated parenthetical alias resolves through entity_resolution.ts', () => {
    const span = 'Northern Africa (North Africa) has a stable, consistently-used boundary.';
    const raw = [{ name: 'Northern Africa (North Africa)', classification: 'stable', span }];
    const { confirmedStable, discarded } = verifyBoundaryClassifications(raw, `${passage} ${span}`, OPT);
    expect(confirmedStable.map((e) => e.letter)).toEqual(['C']);
    expect(discarded).toBe(0);
  });
});

describe('runBoundaryStep -- named failures, honest and pure enough to test without a live authority', () => {
  test('fails honestly with no lettered options', async () => {
    const input: MethodQuestionInput = { question: 'q?', options: null };
    const ctx: MethodRunContext = { askGoogle: async () => null, emit: () => {} };
    const { result } = await runBoundaryStep(input, ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no lettered options/);
  });
});

describe('registerBoundaryStep / listComposerRegistry -- BoundaryStability:1 is registered and executable', () => {
  test('BoundaryStability:1 appears in the composer registry and is marked executable', () => {
    registerBoundaryStep();
    const entries = listComposerRegistry();
    const entry = entries.find((e) => e.id === 'BoundaryStability:1');
    expect(entry).toBeDefined();
    expect(entry?.executable).toBe(true);
  });
});
