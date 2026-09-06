// survey_steps.test.ts -- D-BP152-042/BISHOP/seg-survey-composable-steps
//
// Verifies, per this ticket's own VERIFY section: (a) each registered Survey part resolves and is
// individually referenceable; (b) Survey:1 still exists as the whole-sequence composite,
// untouched, alongside the six new parts; (f) importing this module (and its declarations)
// executes nothing.
//
// No network, no Electron API, no import from survey_stage.ts/methods/*.ts/elements/*.ts anywhere
// in this file or the module it tests.

import { describe, test, expect, vi } from 'vitest';
import type { StepDeclaration } from './step_declaration';

const EXPECTED_IDS = [
  'DefineTheTerm:1',
  'Categorize:1',
  'DetermineRegister:1',
  'JarMethod:1',
  'AmbiguityQuery:1',
  'OperationQuery:1',
];

/** Fresh, unpopulated method_registry.ts REGISTRY for every test that needs one -- same
 *  vi.resetModules() + dynamic re-import convention method_registry.test.ts already uses, so
 *  registerNameNumbered()'s deliberate throw-on-duplicate behavior never makes test order matter. */
async function freshModules() {
  vi.resetModules();
  const registry = await import('./method_registry');
  const steps = await import('./survey_steps');
  return { registry, steps };
}

describe('survey_steps.ts -- registration is inert', () => {
  test('REGISTRY is still empty immediately after importing survey_steps.ts -- no auto-registration at module load', async () => {
    const { registry } = await freshModules();
    expect(registry.listAllEntries()).toEqual([]);
  });

  test('this file does not import anything from survey_stage.ts, methods/*.ts, or elements/*.ts', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const here = __dirname;
    const src = fs.readFileSync(path.join(here, 'survey_steps.ts'), 'utf8');
    expect(src).not.toMatch(/from ['"].*survey_stage['"]/);
    expect(src).not.toMatch(/from ['"].*\/methods\//);
    expect(src).not.toMatch(/from ['"].*\/elements\//);
  });

  test('no field on any of the six declarations is a function -- descriptive only, nothing callable', async () => {
    const { registry, steps } = await freshModules();
    steps.registerSurveyParts();
    for (const entry of registry.listAllEntries()) {
      for (const [key, value] of Object.entries(entry.declaration)) {
        expect(typeof value, `${entry.identity.id}.declaration.${key} must not be a function`).not.toBe('function');
      }
    }
  });
});

describe('survey_steps.ts -- registerSurveyParts() registers exactly the six Survey primitives', () => {
  test('exactly the expected ids, no more, no less', async () => {
    const { steps } = await freshModules();
    const identities = steps.registerSurveyParts();
    const ids = identities.map((i) => i.id).sort();
    expect(ids).toEqual([...EXPECTED_IDS].sort());
  });

  test('assertion (a): each registered part resolves and is individually referenceable via lookupById()', async () => {
    const { registry, steps } = await freshModules();
    const identities = steps.registerSurveyParts();
    for (const identity of identities) {
      const found = registry.lookupById(identity.id);
      expect(found, `${identity.id} should resolve via lookupById()`).toBeTruthy();
      expect(found!.identity).toEqual(identity);
      const decl = found!.declaration;
      const requiredStringFields: (keyof StepDeclaration)[] = [
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

  // D-BP164-M0-114/BISHOP/M0/seg-resume -- base count bumped from ten to fifteen: five entries
  // (IdentifyUntaught, InferUntaught, LocateInFrameworkUntaught, ArithmeticCascade,
  // Stage3SymbolicCascade) were added to ../method_registry.ts's registerKnownMethods() to close
  // the gap between that catalog and the 8 already-live LianaMethod entries the executable
  // registry holds. See that file's own "D-BP164-M0-114" section.
  //
  // D-BP167-M0-056/BISHOP-M0/SEG -- base count bumped AGAIN, fifteen to seventeen: D-BP165-M0-022
  // added ComputeGemmaCascade:1 and ComputeSelectCascade:1 to registerKnownMethods() without
  // updating this test -- caught during a liana_cycle suite diagnosis, not a new regression.
  // 17 base + 6 survey parts = 23. Same drift class as method_registry.test.ts and
  // library/state_the_question_step.test.ts; see D-BP167-M0-056's own SEG return for the full
  // account of why 23 is the correct number, not 21.
  //
  // D-BP207-SEG-A, card t-00173320 -- base count bumped AGAIN, seventeen to twenty-one: 23 to 27.
  // Carded as "non-deterministic," but MEASURED, live, on the current vitest 4.1.9: this assertion
  // fails DETERMINISTICALLY even alone and with `--no-file-parallelism` -- not flaky. D-BP168-M0-126
  // added FOUR entries to ../method_registry.ts's registerKnownMethods() (PythagoreanTheoremCascade:1,
  // QuadraticFormulaCascade:1, PermutationCombinationCascade:1, LawOfCosinesCascade:1 -- confirmed by
  // calling the compiled dist directly: returns 21, not 17) without updating this test. Bucket-1
  // (stale count), same drift class as before, recurring a third time -- not the bucket-3 singleton-
  // pollution defect the card's own text guesses at.
  test('assertion (b): Survey:1 still exists as the whole-sequence composite, untouched, alongside the six parts', async () => {
    const { registry, steps } = await freshModules();
    registry.registerKnownMethods(); // registers Survey:1 (and the other 20 pre-existing entries)
    steps.registerSurveyParts(); // registers the six new parts -- no collision, no duplicate error
    const surveyComposite = registry.lookupById('Survey:1');
    expect(surveyComposite, 'Survey:1 must still resolve after registerSurveyParts() runs').toBeTruthy();
    expect(surveyComposite!.declaration.exportName).toBe('runSurveyStage');
    // All 6 new parts plus the pre-existing 21 coexist -- 27 total, none overwritten.
    expect(registry.listAllEntries().length).toBe(27);
    for (const id of EXPECTED_IDS) {
      expect(registry.lookupById(id), `${id} should also resolve`).toBeTruthy();
    }
  });

  test('registerSurveyParts() is inert to call order -- registerKnownMethods() before or after makes no difference', async () => {
    const { registry, steps } = await freshModules();
    steps.registerSurveyParts();
    registry.registerKnownMethods();
    expect(registry.listAllEntries().length).toBe(27);
    expect(registry.lookupById('Survey:1')).toBeTruthy();
    expect(registry.lookupById('DefineTheTerm:1')).toBeTruthy();
  });

  test('calling registerSurveyParts() twice throws on the first re-registered id -- duplicate is an error, not an overwrite', async () => {
    const { steps } = await freshModules();
    steps.registerSurveyParts();
    expect(() => steps.registerSurveyParts()).toThrow(/duplicate method id/);
  });

  test('names are operator-facing, not dispatch ids or bare function names', async () => {
    const { steps } = await freshModules();
    const identities = steps.registerSurveyParts();
    const names = identities.map((i) => i.name);
    // No dispatch-id shape (D-BP###-###) anywhere in a name.
    for (const name of names) {
      expect(name).not.toMatch(/^D-BP\d+-\d+/);
    }
    // Names are the Founder's own words for these steps, not the bare TS export identifiers.
    expect(names).not.toContain('founderStep2Survey');
    expect(names).not.toContain('founderStep3CategorizeOptions');
    expect(names).not.toContain('founderStep4DetermineRegister');
    expect(names).not.toContain('founderStep6JarMethod');
    expect(names).not.toContain('askAmbiguity');
    expect(names).not.toContain('askOperation');
    expect(names.sort()).toEqual(
      ['DefineTheTerm', 'Categorize', 'DetermineRegister', 'JarMethod', 'AmbiguityQuery', 'OperationQuery'].sort(),
    );
  });
});
