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

describe('registerKnownMethods() registers the ten pre-existing entries', () => {
  test('exactly the expected ids, no more, no less', async () => {
    const mod = await freshRegistryModule();
    const identities = mod.registerKnownMethods();
    const ids = identities.map((i) => i.id).sort();
    const expected = [
      'ComparativeCascade:1',
      'DefinitionalCascade:1',
      'ClassifyCascade:1',
      'Survey:1',
      'partitionByAspect:1',
      'eliminateByAspect:1',
      'checkKindForAllOptions:1',
      'SERVED_DEMANDS:1',
      'formSubstitutionQueries:1',
      'formSubstitutionQueriesForAllOptions:1',
    ].sort();
    expect(ids).toEqual(expected);
    expect(mod.listAllEntries().length).toBe(10);
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

  test('listAllEntries() still holds exactly the ten entries after a rejected duplicate attempt', async () => {
    const mod = await freshRegistryModule();
    mod.registerKnownMethods();
    expect(() => mod.registerKnownMethods()).toThrow();
    expect(mod.listAllEntries().length).toBe(10);
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
