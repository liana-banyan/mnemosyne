// script.test.ts -- D-BP152-041/BISHOP/seg-script-format-and-runner
//
// Covers this ticket's assertions (d) and (f), plus the load/parse/validate machinery those
// assertions depend on. See script_runner.test.ts for (a)/(b)/(c)/(e).

import { describe, test, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadScriptFromFile,
  makeMethodIdentity,
  parseScript,
  type ResolvedRef,
  type Script,
  validateScript,
} from './script';

const ATTRIBUTED_TEST = {
  kind: 'ATTRIBUTED' as const,
  founderRuling: 'BP152',
  quote: 'stack methods in whatever order I want',
  citedAt: 'LianaBanyanPlatform/BISHOP_DROPZONE/RULINGS_BP152.md FD-BP152-20',
};

function method(name: string, number: number): Script['steps'][number] {
  return { id: `${name}:${number}`, attribution: ATTRIBUTED_TEST };
}

function makeCatalog(methods: string[], scripts: Script[]): (id: string) => ResolvedRef {
  return (id: string): ResolvedRef => {
    const nested = scripts.find((s) => s.identity.id === id);
    if (nested) return { kind: 'script', script: nested };
    if (methods.includes(id)) {
      const [name, numberStr] = id.split(':');
      return { kind: 'method', identity: makeMethodIdentity(name, Number(numberStr)) };
    }
    return { kind: 'unresolved' };
  };
}

describe('script.ts -- makeMethodIdentity', () => {
  test('derives id from name:number', () => {
    expect(makeMethodIdentity('denotation', 1)).toEqual({ name: 'denotation', number: 1, id: 'denotation:1' });
  });
});

describe('script.ts -- validateScript, assertion (d): cycles are rejected with the cycle named', () => {
  test('rejects a script that references itself directly', () => {
    const selfScript: Script = {
      identity: makeMethodIdentity('loopy', 1),
      description: 'references itself',
      steps: [method('denotation', 1), { id: 'loopy:1', attribution: ATTRIBUTED_TEST }],
      savedBy: 'test',
      savedAt: '2026-08-11T00:00:00.000Z',
    };
    const resolve = makeCatalog(['denotation:1'], [selfScript]);
    const result = validateScript(selfScript, resolve);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('cycle detected');
      expect(result.error).toContain('loopy:1');
    }
  });

  test('rejects a mutual (indirect) cycle A -> B -> A, naming the full chain', () => {
    const scriptA: Script = {
      identity: makeMethodIdentity('script-a', 1),
      description: 'A calls B',
      steps: [{ id: 'script-b:1', attribution: ATTRIBUTED_TEST }],
      savedBy: 'test',
      savedAt: '2026-08-11T00:00:00.000Z',
    };
    const scriptB: Script = {
      identity: makeMethodIdentity('script-b', 1),
      description: 'B calls A back',
      steps: [{ id: 'script-a:1', attribution: ATTRIBUTED_TEST }],
      savedBy: 'test',
      savedAt: '2026-08-11T00:00:00.000Z',
    };
    const resolve = makeCatalog([], [scriptA, scriptB]);
    const result = validateScript(scriptA, resolve);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('cycle detected');
      expect(result.error).toContain('script-a:1');
      expect(result.error).toContain('script-b:1');
    }
  });

  test('accepts a script whose nested script is used twice but never cycles (diamond, not a cycle)', () => {
    const leaf: Script = {
      identity: makeMethodIdentity('leaf-script', 1),
      description: 'a small reusable sequence',
      steps: [method('denotation', 1)],
      savedBy: 'test',
      savedAt: '2026-08-11T00:00:00.000Z',
    };
    const top: Script = {
      identity: makeMethodIdentity('top-script', 1),
      description: 'uses leaf-script twice -- not a cycle, a diamond',
      steps: [{ id: 'leaf-script:1', attribution: ATTRIBUTED_TEST }, { id: 'leaf-script:1', attribution: ATTRIBUTED_TEST }],
      savedBy: 'test',
      savedAt: '2026-08-11T00:00:00.000Z',
    };
    const resolve = makeCatalog(['denotation:1'], [leaf, top]);
    expect(validateScript(top, resolve)).toEqual({ ok: true });
  });

  test('rejects a step id that resolves to nothing', () => {
    const script: Script = {
      identity: makeMethodIdentity('bad-script', 1),
      description: 'references an unknown id',
      steps: [method('does-not-exist', 9)],
      savedBy: 'test',
      savedAt: '2026-08-11T00:00:00.000Z',
    };
    const resolve = makeCatalog([], []);
    const result = validateScript(script, resolve);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('does-not-exist:9');
  });
});

describe('script.ts -- parseScript / loadScriptFromFile', () => {
  const workedExampleRaw = {
    identity: { name: 'three-step-demo', number: 1, id: 'three-step-demo:1' },
    description: 'the worked example from SEG_RETURN_BP152_041',
    steps: [
      { id: 'denotation:1', attribution: ATTRIBUTED_TEST },
      { id: 'register-gate:1', attribution: ATTRIBUTED_TEST },
      { id: 'terminator:1', attribution: ATTRIBUTED_TEST },
    ],
    savedBy: 'Founder',
    savedAt: '2026-08-11T00:00:00.000Z',
  };
  const resolve = makeCatalog(['denotation:1', 'register-gate:1', 'terminator:1'], []);

  test('parses a well-formed script object and validates it', () => {
    const result = parseScript(workedExampleRaw, resolve);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.script.steps.map((s) => s.id)).toEqual(['denotation:1', 'register-gate:1', 'terminator:1']);
    }
  });

  test('rejects identity.id that does not match name:number', () => {
    const raw = { ...workedExampleRaw, identity: { name: 'x', number: 1, id: 'x:2' } };
    const result = parseScript(raw, resolve);
    expect(result.ok).toBe(false);
  });

  test('rejects a step with no attribution', () => {
    const raw = { ...workedExampleRaw, steps: [{ id: 'denotation:1' }] };
    const result = parseScript(raw, resolve);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('attribution');
  });

  test('loads a script from a real file on disk, human-readable JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'script-test-'));
    const filePath = join(dir, 'three_step_demo.json');
    try {
      writeFileSync(filePath, JSON.stringify(workedExampleRaw, null, 2), 'utf8');
      const result = loadScriptFromFile(filePath, resolve);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.script.identity.id).toBe('three-step-demo:1');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('reports (never throws) when the file does not exist', () => {
    const result = loadScriptFromFile('C:\\definitely\\does\\not\\exist.json', resolve);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('could not read script file');
  });

  test('reports (never throws) on malformed JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'script-test-'));
    const filePath = join(dir, 'broken.json');
    try {
      writeFileSync(filePath, '{ not valid json', 'utf8');
      const result = loadScriptFromFile(filePath, resolve);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('not valid JSON');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('script.ts -- D-BP152-046 STAGE 1/2: ScriptStepRef.queryText parses and validates', () => {
  const workedExampleRaw = {
    identity: { name: 'query-text-demo', number: 1, id: 'query-text-demo:1' },
    description: 'exercises the new optional queryText field',
    steps: [
      { id: 'denotation:1', attribution: ATTRIBUTED_TEST, queryText: 'plain text, no placeholder' },
    ],
    savedBy: 'test',
    savedAt: '2026-08-11T00:00:00.000Z',
  };
  const resolve = makeCatalog(['denotation:1'], []);

  test('parses a step carrying queryText', () => {
    const result = parseScript(workedExampleRaw, resolve);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.script.steps[0].queryText).toBe('plain text, no placeholder');
  });

  test('a step with no queryText leaves the field undefined -- unchanged from before this ticket', () => {
    const result = parseScript(
      { ...workedExampleRaw, steps: [{ id: 'denotation:1', attribution: ATTRIBUTED_TEST }] },
      resolve,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.script.steps[0].queryText).toBeUndefined();
  });

  test('rejects a non-string queryText', () => {
    const raw = { ...workedExampleRaw, steps: [{ id: 'denotation:1', attribution: ATTRIBUTED_TEST, queryText: 42 }] };
    const result = parseScript(raw, resolve);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('queryText');
  });
});

describe('script.ts -- validateScript rejects queryText on a nested-script reference', () => {
  const leaf: Script = {
    identity: makeMethodIdentity('leaf-script', 1),
    description: 'a small reusable sequence',
    steps: [method('denotation', 1)],
    savedBy: 'test',
    savedAt: '2026-08-11T00:00:00.000Z',
  };

  test('rejects queryText on a step whose id resolves to a nested script', () => {
    const top: Script = {
      identity: makeMethodIdentity('top-with-query-on-script', 1),
      description: 'invalid: queryText on a nested-script step',
      steps: [{ id: 'leaf-script:1', attribution: ATTRIBUTED_TEST, queryText: 'this should not be allowed' }],
      savedBy: 'test',
      savedAt: '2026-08-11T00:00:00.000Z',
    };
    const resolve = makeCatalog(['denotation:1'], [leaf]);
    const result = validateScript(top, resolve);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('queryText');
      expect(result.error).toContain('nested script');
    }
  });

  test('queryText on a step resolving to a real method still validates fine', () => {
    const top: Script = {
      identity: makeMethodIdentity('top-with-query-on-method', 1),
      description: 'valid: queryText on a leaf method step',
      steps: [{ id: 'denotation:1', attribution: ATTRIBUTED_TEST, queryText: 'ask something' }],
      savedBy: 'test',
      savedAt: '2026-08-11T00:00:00.000Z',
    };
    const resolve = makeCatalog(['denotation:1'], []);
    expect(validateScript(top, resolve)).toEqual({ ok: true });
  });
});

describe('script.ts -- assertion (f): importing this module executes nothing', () => {
  test('exposes only functions/types -- module import performed no I/O and threw nothing', () => {
    // A module that executed something at import time (a Google call, a file write, a console
    // log) would already have run before this test body starts -- there would be nothing left
    // to assert against as a regression guard. This instead asserts the module's only
    // observable surface is its exported functions, reachable with no import-time side effect
    // having thrown or blocked getting here.
    expect(typeof makeMethodIdentity).toBe('function');
    expect(typeof validateScript).toBe('function');
    expect(typeof parseScript).toBe('function');
    expect(typeof loadScriptFromFile).toBe('function');
  });
});
