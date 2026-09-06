// method_registry.test.ts -- D-BP152-040/BISHOP/seg-method-identity-registry
//
// Verifies: (c) a duplicate Name:Number is an error, not an overwrite; (d) every registered
// entry resolves to a real declaration (the required StepDeclaration fields are populated); (e)
// importing this module executes nothing -- REGISTRY stays empty until a caller explicitly calls
// registerKnownMethods(), and this module imports nothing from methods/*.ts or survey_stage.ts;
// (f) [file-identity check lives in the SEG return, not here -- a git diff of the four forbidden
// files, not a unit test].
//
// Every test that needs a CLEAN registry gets one via freshRegistryModule() (vi.resetModules() +
// dynamic re-import) rather than sharing the one module-level REGISTRY singleton across tests,
// since registerNameNumbered() is deliberately append-only/throw-on-duplicate and would otherwise
// make test order matter.

import { describe, test, expect, vi } from 'vitest';

/** Every test that needs a fresh, unpopulated REGISTRY calls this first -- vi.resetModules()
 *  clears vitest's module cache so the subsequent dynamic import re-evaluates method_registry.ts
 *  from scratch, giving it its own REGISTRY Map rather than sharing the one another test already
 *  populated. Needed because REGISTRY is module-level state and registerNameNumbered() is
 *  deliberately throw-on-duplicate, not reset-on-call. */
async function freshRegistryModule() {
  vi.resetModules();
  return import('./method_registry');
}

describe('importing this module executes nothing', () => {
  test('REGISTRY is empty immediately after import -- no auto-registration at module load', async () => {
    const mod = await freshRegistryModule();
    expect(mod.listAllEntries()).toEqual([]);
  });

  test('this module does not import anything from methods/*.ts or survey_stage.ts', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const here = __dirname;
    const registrySrc = fs.readFileSync(path.join(here, 'method_registry.ts'), 'utf8');
    expect(registrySrc).not.toMatch(/from ['"].*\/methods\//);
    expect(registrySrc).not.toMatch(/from ['"].*survey_stage['"]/);
    expect(registrySrc).not.toMatch(/from ['"].*\/elements\//);
  });

  test('no field on any registered declaration is a function -- descriptive only, nothing callable', async () => {
    const mod = await freshRegistryModule();
    mod.registerKnownMethods();
    for (const entry of mod.listAllEntries()) {
      for (const [key, value] of Object.entries(entry.declaration)) {
        expect(typeof value, `${entry.identity.id}.declaration.${key} must not be a function`).not.toBe('function');
      }
    }
  });
});

describe('registerKnownMethods() registers the seventeen pre-existing entries', () => {
  // D-BP164-M0-114/BISHOP/M0/seg-resume -- count and id list updated from ten to fifteen. Five
  // entries were added to close the gap between this catalog and the 8 LianaMethod entries the
  // executable registry (registerMethod/selectMethod, ../method_registry.ts) actually holds:
  // identifyUntaught, inferUntaught, locateInFrameworkUntaught, arithmeticCascadeMethod, and
  // stage3SymbolicCascadeMethod were all already live and wired (imported by
  // liana_terminal_engine.ts) but had no Name:Number identity in this catalog before this dispatch.
  // See ../method_registry.ts's own "D-BP164-M0-114" section, immediately above
  // registerKnownMethods(), for the full account.
  //
  // D-BP167-M0-056/BISHOP-M0/SEG -- count and id list updated AGAIN, fifteen to seventeen.
  // D-BP165-M0-022 added ComputeGemmaCascade:1 and ComputeSelectCascade:1 to
  // registerKnownMethods() (../method_registry.ts, whose own doc comment there already says "the
  // SEVENTEEN pre-existing entries") without updating this test -- caught during a liana_cycle
  // suite diagnosis, not a new regression. Same drift class as
  // library/state_the_question_step.test.ts and library/survey_steps.test.ts (23 vs 21); see
  // D-BP167-M0-056's own SEG return for the full account.
  //
  // D-BP207-SEG-A, card t-00173320 -- count and id list updated AGAIN, seventeen to twenty-one.
  // This card was carded as "THE LIANA CYCLE TEST SUITE IS NON-DETERMINISTIC," with a stated fix
  // of "reset the registry between tests" for a suspected cross-file singleton-pollution bug. MEASURED,
  // live, on the currently installed vitest 4.1.9: this exact assertion fails DETERMINISTICALLY,
  // every time, run completely alone (`vitest run method_registry.test.ts`, nothing else) and also
  // with `--no-file-parallelism` across the whole 4-file reproduction D-BP168-M0-114 used -- i.e. it
  // is NOT flaky and NOT order-dependent today, whatever it was when that dispatch wrote its
  // diagnosis. ROOT CAUSE: D-BP168-M0-126 (a later, unrelated composer-methods dispatch) added FOUR
  // more entries to ../method_registry.ts's registerKnownMethods() -- PythagoreanTheoremCascade:1,
  // QuadraticFormulaCascade:1, PermutationCombinationCascade:1, LawOfCosinesCascade:1 -- without
  // updating this test's hardcoded expected list/count. Confirmed by calling
  // dist/main/liana_cycle/method_registry.js's registerKnownMethods() directly: returns exactly 21
  // identities today, matching the 4 new ids added below. This is bucket-1 (stale count, the SAME
  // drift class this file's own two comments above already describe, recurring a third time), not
  // the bucket-3 singleton-pollution defect the card's own text hypothesizes -- no registry reset
  // mechanism is needed to fix this specific assertion.
  test('exactly the expected ids, no more, no less', async () => {
    const mod = await freshRegistryModule();
    const identities = mod.registerKnownMethods();
    const ids = identities.map((i) => i.id).sort();
    const expected = [
      'ComparativeCascade:1',
      'DefinitionalCascade:1',
      'ClassifyCascade:1',
      'Survey:1',
      'IdentifyUntaught:1',
      'InferUntaught:1',
      'LocateInFrameworkUntaught:1',
      'ArithmeticCascade:1',
      'Stage3SymbolicCascade:1',
      'ComputeGemmaCascade:1',
      'ComputeSelectCascade:1',
      'PythagoreanTheoremCascade:1',
      'QuadraticFormulaCascade:1',
      'PermutationCombinationCascade:1',
      'LawOfCosinesCascade:1',
      'partitionByAspect:1',
      'eliminateByAspect:1',
      'checkKindForAllOptions:1',
      'SERVED_DEMANDS:1',
      'formSubstitutionQueries:1',
      'formSubstitutionQueriesForAllOptions:1',
    ].sort();
    expect(ids).toEqual(expected);
    expect(mod.listAllEntries().length).toBe(21);
  });

  test('every registered entry resolves to a real declaration via lookupById()', async () => {
    const mod = await freshRegistryModule();
    const identities = mod.registerKnownMethods();
    for (const identity of identities) {
      const found = mod.lookupById(identity.id);
      expect(found, `${identity.id} should resolve via lookupById()`).toBeTruthy();
      expect(found!.identity).toEqual(identity);
      const decl = found!.declaration;
      // The same required-field shape orphan_catalog.test.ts checks, since this registry reuses
      // the identical StepDeclaration type rather than inventing a second one.
      const requiredStringFields: (keyof typeof decl)[] = [
        'id', 'version', 'sourceFile', 'exportName', 'whatItDoes', 'inputs', 'outputs',
      ];
      for (const field of requiredStringFields) {
        const value = decl[field];
        expect(typeof value, `${identity.id}.declaration.${field} should be a non-empty string`).toBe('string');
        expect((value as string).length, `${identity.id}.declaration.${field} should be non-empty`).toBeGreaterThan(0);
      }
      expect(decl.sourceLine, `${identity.id}.declaration.sourceLine should be a positive integer`).toBeGreaterThan(0);
      expect(['function', 'const']).toContain(decl.exportKind);
      expect(['DECIDES', 'REPORTS', 'DECIDES_AND_REFUSES']).toContain(decl.decidesOrReports);
      expect(['ATTRIBUTED', 'TARE', 'NO_DECISION_RULE']).toContain(decl.attribution.kind);
    }
  });

  test('listIterationsOfName() and latestNumberOfName() see the registered iteration', async () => {
    const mod = await freshRegistryModule();
    mod.registerKnownMethods();
    const surveyIterations = mod.listIterationsOfName('Survey');
    expect(surveyIterations.length).toBe(1);
    expect(surveyIterations[0].identity.number).toBe(1);
    expect(mod.latestNumberOfName('Survey')).toBe(1);
    expect(mod.latestNumberOfName('NoSuchMethod')).toBeNull();
  });
});

describe('a duplicate Name:Number is an error, not an overwrite', () => {
  test('calling registerKnownMethods() a second time throws on the first re-registered id', async () => {
    const mod = await freshRegistryModule();
    mod.registerKnownMethods();
    expect(() => mod.registerKnownMethods()).toThrow(/duplicate method id/);
  });

  // D-BP207-SEG-A, card t-00173320 -- 17 -> 21, same stale-count drift as the test above; see that
  // test's own comment for the full account (D-BP168-M0-126, 4 new registerKnownMethods() entries).
  test('listAllEntries() still holds exactly the twenty-one entries after a rejected duplicate attempt', async () => {
    const mod = await freshRegistryModule();
    mod.registerKnownMethods();
    expect(() => mod.registerKnownMethods()).toThrow();
    expect(mod.listAllEntries().length).toBe(21);
  });

  test('registerNameNumbered() throws on an exact Name:Number duplicate', async () => {
    const mod = await freshRegistryModule();
    mod.registerKnownMethods();
    const surveyDecl = mod.lookupById('Survey:1')!.declaration;
    expect(() => mod.registerNameNumbered('Survey', 1, surveyDecl)).toThrow(/duplicate method id "Survey:1"/);
  });

  test('the same name at a DIFFERENT number is not a duplicate -- iterations galore', async () => {
    const mod = await freshRegistryModule();
    mod.registerKnownMethods();
    const surveyDecl = mod.lookupById('Survey:1')!.declaration;
    // A second iteration of the same name, different number, must be accepted, not thrown, and
    // must coexist with the first rather than replacing it.
    const secondIdentity = mod.registerNameNumbered('Survey', 2, surveyDecl);
    expect(secondIdentity).toEqual({ name: 'Survey', number: 2, id: 'Survey:2' });
    expect(mod.lookupById('Survey:1')).toBeTruthy();
    expect(mod.lookupById('Survey:2')).toBeTruthy();
    expect(mod.listIterationsOfName('Survey').map((e) => e.identity.number)).toEqual([1, 2]);
    expect(mod.latestNumberOfName('Survey')).toBe(2);
  });
});
