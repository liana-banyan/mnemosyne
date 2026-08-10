// orphan_catalog.test.ts -- D-BP152-018/BISHOP/seg-register-orphan-steps
//
// Verifies: (1) the catalog holds exactly the 6 verified orphans, no more, no less; (2) every
// declaration's required fields are populated; (3) importing this catalog module (and its
// sibling step_declaration.ts) executes none of the 6 described functions -- registration is
// inert, per this ticket's hard boundary ("Nothing is invoked").
//
// No network, no Electron API, no import from elements/ anywhere in this file or the modules it
// tests.

import { describe, test, expect } from 'vitest';
import { ORPHAN_STEP_CATALOG, listOrphanSteps } from './orphan_catalog';
import type { StepDeclaration } from './step_declaration';

const EXPECTED_IDS = [
  'elements.aspect_tag.partitionByAspect',
  'elements.aspect_tag.eliminateByAspect',
  'elements.kind_check.checkKindForAllOptions',
  'elements.substitution_search.SERVED_DEMANDS',
  'elements.substitution_search.formSubstitutionQueries',
  'elements.substitution_search.formSubstitutionQueriesForAllOptions',
];

describe('ORPHAN_STEP_CATALOG', () => {
  test('contains exactly the 6 verified orphans, no more, no less', () => {
    const ids = ORPHAN_STEP_CATALOG.map((d) => d.id).sort();
    expect(ids).toEqual([...EXPECTED_IDS].sort());
    expect(ORPHAN_STEP_CATALOG.length).toBe(6);
  });

  test('every declaration has its required fields populated', () => {
    const requiredStringFields: (keyof StepDeclaration)[] = [
      'id', 'version', 'sourceFile', 'exportName', 'whatItDoes', 'inputs', 'outputs',
    ];
    for (const decl of ORPHAN_STEP_CATALOG) {
      for (const field of requiredStringFields) {
        const value = decl[field];
        expect(typeof value, `${decl.id}.${field} should be a non-empty string`).toBe('string');
        expect((value as string).length, `${decl.id}.${field} should be non-empty`).toBeGreaterThan(0);
      }
      expect(decl.sourceLine, `${decl.id}.sourceLine should be a positive integer`).toBeGreaterThan(0);
      expect(['function', 'const']).toContain(decl.exportKind);
      expect(['DECIDES', 'REPORTS', 'DECIDES_AND_REFUSES']).toContain(decl.decidesOrReports);

      // queryText is always present and internally consistent.
      expect(decl.queryText).toBeTruthy();
      expect(typeof decl.queryText.issuesQuery).toBe('boolean');
      if (decl.queryText.issuesQuery) {
        expect(decl.queryText.description, `${decl.id}.queryText.description should be set when issuesQuery is true`).toBeTruthy();
      } else {
        expect(decl.queryText.description, `${decl.id}.queryText.description should be null when issuesQuery is false`).toBeNull();
      }
      expect(typeof decl.queryText.loadedFromQueryResource).toBe('boolean');

      // attribution: exactly one of ATTRIBUTED / TARE / NO_DECISION_RULE, per HARDWIRE-23 Law 4
      // ("there is no third category" beyond ATTRIBUTED/TARE for an actual decision rule; this
      // catalog additionally allows NO_DECISION_RULE for steps HARDWIRE-23 itself exempts --
      // pure loops/partitions with no branch that could change which answer comes out).
      expect(['ATTRIBUTED', 'TARE', 'NO_DECISION_RULE']).toContain(decl.attribution.kind);
      if (decl.attribution.kind === 'ATTRIBUTED') {
        expect(decl.attribution.founderRuling.length).toBeGreaterThan(0);
        expect(decl.attribution.quote.length).toBeGreaterThan(0);
        expect(decl.attribution.citedAt.length).toBeGreaterThan(0);
      } else if (decl.attribution.kind === 'TARE') {
        expect(decl.attribution.note.length).toBeGreaterThan(0);
      } else {
        expect(decl.attribution.why.length).toBeGreaterThan(0);
      }

      expect(decl.orphanEvidence.length, `${decl.id}.orphanEvidence should be non-empty`).toBeGreaterThan(0);
    }
  });

  test('listOrphanSteps() returns a copy, not the live module array', () => {
    const a = listOrphanSteps();
    const b = listOrphanSteps();
    expect(a).not.toBe(ORPHAN_STEP_CATALOG);
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
    // Mutating the returned copy must not affect the module-level catalog.
    a.pop();
    expect(ORPHAN_STEP_CATALOG.length).toBe(6);
  });
});

describe('registration is inert', () => {
  test('no field on any declaration is a function -- nothing here is callable, only descriptive', () => {
    for (const decl of ORPHAN_STEP_CATALOG) {
      for (const [key, value] of Object.entries(decl)) {
        expect(typeof value, `${decl.id}.${key} must not be a function`).not.toBe('function');
      }
    }
  });

  test('this catalog does not import anything from elements/', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const here = __dirname;
    const catalogSrc = fs.readFileSync(path.join(here, 'orphan_catalog.ts'), 'utf8');
    const declSrc = fs.readFileSync(path.join(here, 'step_declaration.ts'), 'utf8');
    expect(catalogSrc).not.toMatch(/from ['"].*\/elements\//);
    expect(declSrc).not.toMatch(/from ['"].*\/elements\//);
  });
});
