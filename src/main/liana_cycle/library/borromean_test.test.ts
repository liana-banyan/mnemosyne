// borromean_test.test.ts -- D-BP154-072/BISHOP-SEG/S52/seg-wiregate
//
// FAIL-BEFORE / PASS-AFTER for P12, THE BORROMEAN TEST. Every test below FAILS on main before this
// ticket, because borromean_test.ts (and its export from script_bridge.ts's registration table)
// did not exist -- the import at the top of this file alone throws "Cannot find module
// './borromean_test'".
//
// MECHANISM TEST THROUGHOUT (FD-BP153-06/HARDWIRE-22): every classification below is proven with
// INVENTED vocabulary (Zorblatt/Fignorp/Quexil clusters) -- a genuinely convergent case, a
// single-sourced case, and an insufficient one -- so each rule would survive on a question whose
// answer is unknown, the same standard every sibling step's own test file holds to. The qid 98
// application (a separate describe block, real corpus text) is a validation against reality, never
// a rule keyed on the letter A.
//
// THE GUARD, PROVEN NOT SIMULATED: runBorromeanTest() calls the REAL runTerminatorStep() -- not a
// hand-rolled copy of the elimination rules -- imported directly from terminator_step.ts, the same
// function every live composer run already uses. Every removal test below is therefore exercising
// terminator_step.ts's own current logic, so a future change to the elimination rules is
// automatically covered by these same tests without this file needing to change.

import { describe, test, expect } from 'vitest';
import { runBorromeanTest } from './borromean_test';
import type {
  MethodQuestionInput, MethodRunContext,
} from '../method_registry';
import type { ComposerStepOutcome } from './script_bridge';
import type { SoftballsResult } from './softballs_step';
import type { NamedSetResult } from './named_set_step';
import type { DiscriminatorResult } from './discriminator_step';

// ─────────────────────────── invented vocabulary throughout ───────────────────────────

const OPT: Record<string, string> = {
  A: 'Zorblatt Prime', B: 'Fignorp Cluster', C: 'Quexil Belt', D: 'Drenvale Expanse',
  E: 'Yalthorp Reach', F: 'Wobsy Nebula',
};
const ALL = Object.keys(OPT);

function softballs(excluded: string[]): SoftballsResult {
  return {
    ok: true, category: 'invented clusters', query: 'q',
    excluded: excluded.map((letter) => ({ letter, name: OPT[letter] as string, span: `${letter}) out of frame` })),
    discarded: 0,
    notExcluded: ALL.filter((L) => !excluded.includes(L)),
    via: 'test',
  };
}

function namedSet(included: string[]): NamedSetResult {
  return {
    ok: true, property: 'the invented superlative property', query: 'q',
    included: included.map((letter) => ({ letter, name: OPT[letter] as string, span: `${letter}) is a member` })),
    discarded: 0,
    notIncluded: ALL.filter((L) => !included.includes(L)),
    via: 'test',
  };
}

function discriminator(propertyMembers: string[]): DiscriminatorResult {
  return {
    ok: true, category: 'invented clusters', property: null, query: 'q',
    kinds: [], discardedKinds: 0, noKindStated: ALL, categoryKind: null, categoryKindDiscarded: false,
    propertyMembers: propertyMembers.map((letter) => ({ letter, name: OPT[letter] as string, span: `${letter}) stated member` })),
    discardedPropertyMembers: 0,
    categoryEnumeration: null, categoryEnumerationDiscarded: false, categoryEnumerationMembers: [],
    discardedCategoryEnumerationMembers: 0, subregionNonMembers: [], discardedSubregionNonMembers: 0,
    registerStatement: null, registerStatementDiscarded: false, enumerationDisagreement: null,
    via: 'test',
  };
}

const input: MethodQuestionInput = { question: 'Which of the invented clusters is the exception?', options: OPT };
const ctx: MethodRunContext = { askGoogle: async () => null, emit: () => {} };

function outcome(id: string, raw: unknown): ComposerStepOutcome {
  return { id, summary: 's', raw };
}

describe('runBorromeanTest -- named failures, never a silent empty result', () => {
  test('the baseline Terminator run itself abstains (no unique verdict) -> ok:false, named, never a classification', async () => {
    // No step eliminates anyone -- multiple survivors, ABSTAIN.
    const priorResults = [outcome('Softballs:1', softballs([]))];
    const result = await runBorromeanTest(input, ctx, priorResults);
    expect(result.ok).toBe(false);
    expect(result.classification).toBeNull();
    expect(result.error).toMatch(/no unique verdict/);
  });
});

describe('runBorromeanTest -- INSUFFICIENT (invented vocabulary): fewer than 3 load-bearing findings', () => {
  test('only 2 distinct steps contribute an elimination -> INSUFFICIENT, not a failure', async () => {
    const sb = softballs(['B', 'C', 'D']);
    const ns = namedSet(['E']); // eliminates E as a stated member (not the odd one out)
    // F is never addressed by anyone, but only 2 STEPS (Softballs:1, NamedSet:1) contributed --
    // survivors would be {A, F}, so this baseline actually abstains too. Use a shape where the
    // baseline DOES reach a unique verdict via only 2 steps: eliminate F too, from NamedSet.
    const ns2 = namedSet(['E', 'F']);
    const priorResults = [outcome('Softballs:1', sb), outcome('NamedSet:1', ns2)];
    void ns;
    const result = await runBorromeanTest(input, ctx, priorResults);
    expect(result.ok).toBe(true);
    expect(result.verdictLetter).toBe('A');
    expect(result.loadBearingFindings.sort()).toEqual(['NamedSet:1', 'Softballs:1']);
    expect(result.classification).toBe('INSUFFICIENT');
    expect(result.reason).toMatch(/INSUFFICIENT/);
    expect(result.removals).toEqual([]);
  });
});

describe('runBorromeanTest -- CONVERGENT (invented vocabulary): the verdict fails on every removal', () => {
  test('three steps each eliminate DISJOINT letters, none redundant -- removing any one un-eliminates its own letters and breaks uniqueness', async () => {
    const sb = softballs(['C', 'D']); // Softballs:1 alone eliminates C, D
    const ns = namedSet(['E']); // NamedSet:1 alone eliminates E
    const disc = discriminator(['B', 'F']); // Discriminator:1 alone eliminates B, F
    const priorResults = [
      outcome('Softballs:1', sb), outcome('NamedSet:1', ns), outcome('Discriminator:1', disc),
    ];
    const result = await runBorromeanTest(input, ctx, priorResults);
    expect(result.ok).toBe(true);
    expect(result.verdictLetter).toBe('A');
    expect(result.loadBearingFindings.sort()).toEqual(['Discriminator:1', 'NamedSet:1', 'Softballs:1']);
    expect(result.classification).toBe('CONVERGENT');
    expect(result.removals).toHaveLength(3);
    for (const r of result.removals) expect(r.verdictSurvived).toBe(false);
    expect(result.reason).toMatch(/CONVERGENT/);
  });
});

describe('runBorromeanTest -- SINGLE-SOURCED (invented vocabulary): the verdict survives one or more removals, and this is reported as a label, never a failure', () => {
  test('Softballs:1 alone already eliminates everyone but A; NamedSet:1/Discriminator:1 only redundantly re-eliminate letters Softballs:1 already covered', async () => {
    // Softballs:1 (OUT_OF_FRAME) and NamedSet:1/Discriminator:1 (STATED_MEMBER) are OPPOSITE
    // dispositions on the SAME letter -- terminator_step.ts's own (correct, unchanged) Softballs-
    // vs-membership contradiction check would fire if they ever overlapped, so this fixture keeps
    // Softballs:1's own letter (B) disjoint from NamedSet:1's/Discriminator:1's own letters
    // (C, D, E, F) -- exactly as any real run must. NamedSet:1 and Discriminator:1 are BOTH
    // STATED_MEMBER-family (over-determination, not contradiction, the same shape D-BP154-062's
    // own qid-98 fix already established as safe -- and matches the real qid-98 receipt, where
    // NamedSet:1 AND Discriminator:1 independently both eliminated South Asia).
    const sb = softballs(['B']); // uniquely necessary -- nothing else touches B
    const ns = namedSet(['C', 'D', 'E', 'F']); // does the rest of the work alone
    const disc = discriminator(['D']); // redundant -- D already eliminated by NamedSet:1
    const priorResults = [
      outcome('Softballs:1', sb), outcome('NamedSet:1', ns), outcome('Discriminator:1', disc),
    ];
    const result = await runBorromeanTest(input, ctx, priorResults);
    expect(result.ok).toBe(true);
    expect(result.verdictLetter).toBe('A');
    expect(result.loadBearingFindings.sort()).toEqual(['Discriminator:1', 'NamedSet:1', 'Softballs:1']);
    expect(result.classification).toBe('SINGLE-SOURCED');
    const survived = result.removals.filter((r) => r.verdictSurvived).map((r) => r.findingId).sort();
    // Removing Discriminator:1 still leaves A alone (NamedSet:1 already covers D by itself);
    // removing Softballs:1 or NamedSet:1 does NOT survive (their own unique letters return).
    expect(survived).toEqual(['Discriminator:1']);
    const softballsRemoval = result.removals.find((r) => r.findingId === 'Softballs:1');
    const namedSetRemoval = result.removals.find((r) => r.findingId === 'NamedSet:1');
    expect(softballsRemoval?.verdictSurvived).toBe(false);
    expect(namedSetRemoval?.verdictSurvived).toBe(false);
    // CONSTRAINT (the dispatch's own): SINGLE-SOURCED is a label, never a failure.
    expect(result.reason).toMatch(/not a failure/);
    expect(result.reason).not.toMatch(/\bwrong\b/i);
  });
});

describe('the inverse error the dispatch names explicitly: survival-under-removal must never be reported as proof the verdict is WRONG', () => {
  test('SINGLE-SOURCED text never claims the verdict itself is incorrect', async () => {
    const sb = softballs(['B']);
    const ns = namedSet(['C', 'D', 'E', 'F']);
    const disc = discriminator(['D']);
    const priorResults = [
      outcome('Softballs:1', sb), outcome('NamedSet:1', ns), outcome('Discriminator:1', disc),
    ];
    const result = await runBorromeanTest(input, ctx, priorResults);
    expect(result.classification).toBe('SINGLE-SOURCED');
    expect(result.reason.toLowerCase()).not.toContain('incorrect');
    expect(result.reason.toLowerCase()).not.toContain('invalid');
    expect(result.reason).toMatch(/may still be correct/);
  });
});

describe('registration/wiring smoke test', () => {
  test('Borromean:1 is registered and executable', async () => {
    const { registerBorromeanTestStep } = await import('./borromean_test');
    const { listComposerRegistry } = await import('./script_bridge');
    registerBorromeanTestStep();
    const entries = listComposerRegistry();
    const entry = entries.find((e) => e.id === 'Borromean:1');
    expect(entry).toBeDefined();
    expect(entry?.executable).toBe(true);
  });
});
