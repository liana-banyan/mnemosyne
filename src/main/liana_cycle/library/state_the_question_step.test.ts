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

  test('registering StateTheQuestion:1 alongside registerKnownMethods() does not disturb the pre-existing ten entries', async () => {
    const { registry, step } = await freshModules();
    const known = registry.registerKnownMethods();
    step.registerStateTheQuestionStep();
    expect(registry.listAllEntries().length).toBe(11);
    expect(known.length).toBe(10); // registerKnownMethods() itself still returns exactly ten
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
