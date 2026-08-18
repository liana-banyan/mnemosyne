// index_vram_gate.test.ts — D-BP157-029/BISHOP/seg-rewire-vram-gate
//
// index.ts is a 10,000+ line Electron main-process "registration surface" that imports
// 'electron' at module scope -- importing it directly into a vitest run would require mocking a
// large, non-exhaustively-known surface of Electron APIs it touches at load time (same
// constraint index.relay_route_race_guard.test.ts's own header documents; this file follows that
// SAME "read the source, never import index.ts" convention). Unlike that test (pure string
// containment, no execution), this one goes one step further: resolveVramGatedAnswerModel
// (index.ts) is a fully self-contained pure function -- it closes over nothing from the rest of
// index.ts, taking only its own three arguments (requestedModel, wasExplicit, deps) -- so its
// EXACT source text is sliced out of index.ts, stripped of TypeScript types via esbuild
// (already a transitive dependency of this repo's vitest), and eval'd to get a REAL callable
// function to assert real behavior against, not a hand-duplicated reimplementation that could
// silently drift from what index.ts actually ships.
//
// Proves: model fits -> unchanged; model does not fit -> downgraded with an issue recorded;
// explicit payload.model wins even when it does not fit, with an issue recorded; VRAM unknown ->
// permitted, recorded, never silently shrunk; a capped ~4095 MiB CIM reading (vramGb: null,
// method: 'cim-capped-rejected') is never treated as a real 4 GB. Also proves the actual call
// site inside startRelayRoutePoll wires payload.model as the explicit flag (source-level, same
// technique as the pre-existing sibling test).
//
// Run: npx vitest run src/main/index_vram_gate.test.ts

import { describe, test, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const INDEX_TS_PATH = join(__dirname, 'index.ts');

type VramGateOutcome = {
  model: string;
  requestedModel: string;
  wasExplicit: boolean;
  downgraded: boolean;
  vramGb: number | null;
  vramMethod: string;
  vramConfidence: string;
  requiredVramGbForRequested: number | null;
  note?: string;
};
type VramGateDeps = {
  applyVramGate: (tierModel: string | null, vramGb: number | null) => { model: string | null; note?: string };
  requiredVramGb: (model: string) => number | null;
  detectVramGbDetailed: () => { vramGb: number | null; method: string; confidence: string; note?: string };
};
type ResolveFn = (requestedModel: string, wasExplicit: boolean, deps: VramGateDeps) => VramGateOutcome;

let resolveVramGatedAnswerModel: ResolveFn;
let indexSrc: string;

beforeAll(() => {
  indexSrc = readFileSync(INDEX_TS_PATH, 'utf8');

  const startMarker = 'export interface VramGateOutcome {';
  const endMarker = "let _cachedVramDetectionForRelayAnswer:";
  const startIdx = indexSrc.indexOf(startMarker);
  const endIdx = indexSrc.indexOf(endMarker);
  expect(startIdx, 'VramGateOutcome interface not found in index.ts').toBeGreaterThan(-1);
  expect(endIdx, 'boundary marker (_cachedVramDetectionForRelayAnswer) not found in index.ts').toBeGreaterThan(startIdx);

  // Slice out exactly: VramGateOutcome, VramGateDeps, resolveVramGatedAnswerModel -- nothing
  // else. `export` is stripped (not a module in this eval sandbox); esbuild strips the TS types.
  const rawSlice = indexSrc.slice(startIdx, endIdx).replace(/^export /gm, '');

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const esbuild = require('esbuild');
  const { code } = esbuild.transformSync(rawSlice, { loader: 'ts', format: 'cjs' });

  const sandboxModule = { exports: {} as Record<string, unknown> };
  // eslint-disable-next-line no-new-func
  const factory = new Function('module', 'exports', code + '\nexports.resolveVramGatedAnswerModel = resolveVramGatedAnswerModel;');
  factory(sandboxModule, sandboxModule.exports);
  resolveVramGatedAnswerModel = sandboxModule.exports.resolveVramGatedAnswerModel as ResolveFn;

  expect(typeof resolveVramGatedAnswerModel, 'resolveVramGatedAnswerModel did not eval to a function').toBe('function');
});

describe('resolveVramGatedAnswerModel (index.ts) — VRAM gate consultation, D-BP157-029', () => {
  test('model fits -- unchanged, not downgraded, no note', () => {
    const out = resolveVramGatedAnswerModel('gemma2:9b', false, {
      applyVramGate: (tierModel) => ({ model: tierModel }),
      requiredVramGb: () => 7.1,
      detectVramGbDetailed: () => ({ vramGb: 16, method: 'registry', confidence: 'measured' }),
    });
    expect(out.model).toBe('gemma2:9b');
    expect(out.downgraded).toBe(false);
    expect(out.note).toBeUndefined();
  });

  test('model does not fit -- downgraded, with an issue recorded', () => {
    const out = resolveVramGatedAnswerModel('gemma4:12b', false, {
      applyVramGate: (tierModel) => ({ model: 'gemma2:2b', note: `${tierModel} stepped down to gemma2:2b` }),
      requiredVramGb: (m) => (m === 'gemma4:12b' ? 8.9 : 2.2),
      detectVramGbDetailed: () => ({ vramGb: 3, method: 'registry', confidence: 'measured' }),
    });
    expect(out.model).toBe('gemma2:2b');
    expect(out.downgraded).toBe(true);
    expect(typeof out.note).toBe('string');
    expect(out.note!.length).toBeGreaterThan(0);
  });

  test('explicit payload.model wins even when it does not fit, with an issue recorded', () => {
    const out = resolveVramGatedAnswerModel('gemma4:12b', true, {
      applyVramGate: () => { throw new Error('applyVramGate must never be called for an explicit pick'); },
      requiredVramGb: () => 8.9,
      detectVramGbDetailed: () => ({ vramGb: 3, method: 'registry', confidence: 'measured' }),
    });
    expect(out.model).toBe('gemma4:12b');
    expect(out.wasExplicit).toBe(true);
    expect(out.downgraded).toBe(false);
    expect(out.note).toMatch(/insufficient/);
  });

  test('VRAM unknown -- permitted through, recorded, never silently shrunk', () => {
    const out = resolveVramGatedAnswerModel('gemma4:12b', false, {
      applyVramGate: (tierModel) => ({ model: tierModel, note: 'VRAM undetectable -- using RAM-tier recommendation' }),
      requiredVramGb: () => 8.9,
      detectVramGbDetailed: () => ({ vramGb: null, method: 'none', confidence: 'unknown' }),
    });
    expect(out.model).toBe('gemma4:12b');
    expect(out.downgraded).toBe(false);
    expect(typeof out.note).toBe('string');
  });

  test('a capped ~4095 MiB CIM reading (cim-capped-rejected, vramGb: null) is never treated as a real 4 GB', () => {
    const out = resolveVramGatedAnswerModel('gemma4:12b', false, {
      applyVramGate: (tierModel) => ({ model: tierModel, note: 'ceiling-rejected -- treated as unknown' }),
      requiredVramGb: () => 8.9,
      detectVramGbDetailed: () => ({ vramGb: null, method: 'cim-capped-rejected', confidence: 'unknown' }),
    });
    expect(out.vramGb).toBeNull();
    expect(out.vramMethod).toBe('cim-capped-rejected');
    expect(out.model).toBe('gemma4:12b');
  });
});

describe('startRelayRoutePoll call site — wiring, source-level (same technique as index.relay_route_race_guard.test.ts)', () => {
  test('the answer-model call site passes payload.model-derived explicitPayloadModel as the wasExplicit flag', () => {
    expect(indexSrc).toContain('resolveVramGatedAnswerModel(preGateAnswerModel, explicitPayloadModel !== undefined,');
  });

  test('the pre-gate candidate chain is unchanged: explicit payload.model > activeBrainLocalModel > ollamaManager.getSelectedModel() > hardcoded floor', () => {
    const idx = indexSrc.indexOf('const preGateAnswerModel: string =');
    expect(idx).toBeGreaterThan(-1);
    const slice = indexSrc.slice(idx, idx + 300);
    expect(slice).toContain('explicitPayloadModel ||');
    expect(slice).toContain('activeBrainLocalModel ||');
    expect(slice).toContain("ollamaManager.getSelectedModel() ||");
    expect(slice).toContain("'gemma4:12b';");
  });

  test('the gate decision is surfaced in both the abstain and success answer_json branches as vram_gate, never silently dropped', () => {
    const occurrences = indexSrc.split('vram_gate: answerModelGate,').length - 1;
    expect(occurrences).toBe(2);
  });
});
