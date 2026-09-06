// state_the_question_step.test.ts -- D-BP152-049/BISHOP/seg-unify-registry-and-fixes, STAGE 3/4
//
// Verifies: 'StateTheQuestion:1' registers under the NameNumbered registry, alongside (not
// instead of) the pre-existing ten entries; registration is inert (no import from
// liana_terminal_engine.ts, no side effect at module load); the declaration is ATTRIBUTED to the
// Founder's own words, verbatim.

import { describe, test, expect, vi } from 'vitest';

async function freshModules() {
  vi.resetModules();
  const registry = await import('./method_registry');
  const step = await import('./state_the_question_step');
  return { registry, step };
}

describe('state_the_question_step.ts -- registration is inert', () => {
  test('REGISTRY is still empty immediately after importing this module -- no auto-registration at module load', async () => {
    const { registry } = await freshModules();
    expect(registry.listAllEntries()).toEqual([]);
  });

  test('this file does not import anything from liana_terminal_engine.ts, survey_stage.ts, methods/*.ts, or elements/*.ts', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(path.join(__dirname, 'state_the_question_step.ts'), 'utf8');
    expect(src).not.toMatch(/from ['"].*liana_terminal_engine['"]/);
    expect(src).not.toMatch(/from ['"].*survey_stage['"]/);
    expect(src).not.toMatch(/from ['"].*\/methods\//);
    expect(src).not.toMatch(/from ['"].*\/elements\//);
  });

  test('registerStateTheQuestionStep() registers exactly "StateTheQuestion:1", resolvable via lookupById()', async () => {
    const { registry, step } = await freshModules();
    const identity = step.registerStateTheQuestionStep();
    expect(identity).toEqual({ name: 'StateTheQuestion', number: 1, id: 'StateTheQuestion:1' });
    const found = registry.lookupById('StateTheQuestion:1');
    expect(found).toBeTruthy();
    expect(found!.declaration.attribution.kind).toBe('ATTRIBUTED');
    if (found!.declaration.attribution.kind === 'ATTRIBUTED') {
      expect(found!.declaration.attribution.quote).toContain('State the Question');
      expect(found!.declaration.attribution.founderRuling).toBe('BP152');
    }
  });

  // D-BP164-M0-114/BISHOP/M0/seg-resume -- counts bumped from ten/eleven to fifteen/sixteen: five
  // entries (IdentifyUntaught, InferUntaught, LocateInFrameworkUntaught, ArithmeticCascade,
  // Stage3SymbolicCascade) were added to ../method_registry.ts's registerKnownMethods() to close
  // the gap between that catalog and the 8 already-live LianaMethod entries the executable
  // registry holds. See that file's own "D-BP164-M0-114" section for the full account. This test's
  // own assertion (StateTheQuestion:1 coexists, undisturbed, alongside the pre-existing entries) is
  // unchanged in kind -- only the base count moved.
  //
  // D-BP167-M0-056/BISHOP-M0/SEG -- counts bumped AGAIN, seventeen/eighteen: D-BP165-M0-022 added
  // two more entries (ComputeGemmaCascade:1, ComputeSelectCascade:1) to registerKnownMethods()
  // without updating this test, drift caught during a liana_cycle suite diagnosis. Verified against
  // ../method_registry.ts's own registerKnownMethods() (its doc comment there says "the SEVENTEEN
  // pre-existing entries") and confirmed 17 is what the function actually returns. This is the
  // SAME drift class as method_registry.test.ts and library/survey_steps.test.ts (23 vs 21) --
  // see D-BP167-M0-056's own SEG return for the full account.
  //
  // D-BP207-SEG-A, card t-00173320 -- counts bumped AGAIN, twenty-one/twenty-two. This card was
  // carded as "THE LIANA CYCLE TEST SUITE IS NON-DETERMINISTIC," but MEASURED, live, on the current
  // vitest 4.1.9: this test fails DETERMINISTICALLY even run completely alone, with
  // `--no-file-parallelism`, every time -- not flaky, not order-dependent. D-BP168-M0-126 (a later,
  // unrelated dispatch) added FOUR more entries to ../method_registry.ts's registerKnownMethods()
  // (PythagoreanTheoremCascade:1, QuadraticFormulaCascade:1, PermutationCombinationCascade:1,
  // LawOfCosinesCascade:1 -- confirmed by direct read of that function and by calling it against the
  // compiled dist: returns exactly 21 identities today) without updating this test -- the SAME
  // drift class the two comments above already describe, recurring a third time. This is bucket-1
  // (stale count), not bucket-3 (singleton pollution); the card's own "reset the registry between
  // tests" diagnosis does not apply to this specific assertion. The doc comment's "seventeen" is
  // now itself stale too and is corrected here.
  test('registering StateTheQuestion:1 alongside registerKnownMethods() does not disturb the pre-existing twenty-one entries', async () => {
    const { registry, step } = await freshModules();
    const known = registry.registerKnownMethods();
    step.registerStateTheQuestionStep();
    expect(registry.listAllEntries().length).toBe(22);
    expect(known.length).toBe(21); // registerKnownMethods() itself still returns exactly twenty-one
    expect(registry.lookupById('StateTheQuestion:1')).toBeTruthy();
    expect(registry.lookupById('Survey:1')).toBeTruthy();
  });

  test('no field on the declaration is a function -- descriptive only, nothing callable', async () => {
    const { registry, step } = await freshModules();
    step.registerStateTheQuestionStep();
    const entry = registry.lookupById('StateTheQuestion:1')!;
    for (const [key, value] of Object.entries(entry.declaration)) {
      expect(typeof value, `declaration.${key} must not be a function`).not.toBe('function');
    }
  });
});
