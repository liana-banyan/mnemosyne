// ai_dispatch_ipc_vram_gate.test.ts -- D-BP157-029/BISHOP/seg-rewire-vram-gate
// Converted to a real vitest suite by D-BP157-042/BISHOP/seg-close-loose-ends.
//
// Test harness for resolveVramGatedModel() (ai_dispatch_ipc.ts) -- the VRAM-gate consultation
// D-BP157-029 wired into 'ai-dispatch:query' and 'ai-dispatch:query-engine's model-resolution
// chains (see that dispatch's own ticket and SEG_RETURN_BP157_021_VRAM_GATE.md section 2, chain
// A). Proves: an explicit pick (model_override) is NEVER downgraded even when it does not fit,
// but the shortfall IS recorded (never silent); a non-explicit/persisted/heuristic pick that
// does not fit IS stepped down via applyVramGate, also recorded; unknown VRAM permits rather than
// blocks or silently shrinks; and the Windows CIM uint32 ~4 GiB ceiling value is never mistaken
// for a real 4 GB reading.
//
// D-BP157-042 FINDING: this file was originally written in this tree's older "manual assert() +
// process.exit()" convention (see TEST_BASELINE.md SYSTEMIC CAUSE 2 for the 28+ other `src/main`
// files still using it) -- named `*.test.ts` so vitest collects it, but with zero `describe`/
// `test` calls, so vitest reported the whole file as a FAILED SUITE ("No test suite found in
// file") even though its own 18 assertions, run via plain `node` against the compiled dist
// output, all passed. That older convention exists because ai_dispatch_ipc.ts imports `electron`
// (ipcMain, app) at module scope, and importing it directly into a vitest run would require
// mocking a large, non-exhaustively-known Electron surface.
//
// This file now follows the NEWER, more targeted convention this SAME dispatch (D-BP157-029)
// already established for exactly this constraint in its sibling `index_vram_gate.test.ts`
// (index.ts has the identical electron-at-module-scope problem): resolveVramGatedModel is a
// self-contained block (the VramGateOutcome interface, the process-lifetime detection cache, and
// the function itself -- see the marker constants below) that references only two free
// identifiers from outside that block, `applyVramGate` and `requiredVramGb` (both pure, zero-
// electron-dependency exports of ./hardware/ram_detector.ts, confirmed by D-BP157-025's own
// return). Its EXACT source text is sliced out of ai_dispatch_ipc.ts, stripped of TypeScript
// types via esbuild (already a transitive dependency of this repo's vitest), and eval'd with the
// REAL (not reimplemented, not mocked) applyVramGate/requiredVramGb injected -- so these tests
// assert real behavior against what ai_dispatch_ipc.ts actually ships, not a hand-duplicated copy
// that could silently drift. Only the VRAM `detector` itself is faked per test (as the original
// file already did), since that is the one input this suite must control to hit each branch.
//
// This is a single-file, narrowly-scoped fix (per this dispatch's own instruction: "choose based
// on what the repo already does elsewhere, report which convention you found and followed") --
// it does not touch or rename any of the other 28+ manual-harness files TEST_BASELINE.md
// documents; a repo-wide convention change is out of this dispatch's scope, same as it was out of
// TEST_BASELINE.md's Stage 2 scope.
//
// Run: npx vitest run src/main/ai_dispatch_ipc_vram_gate.test.ts

import { describe, test, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyVramGate, requiredVramGb } from './hardware/ram_detector';

const AI_DISPATCH_IPC_TS_PATH = join(__dirname, 'ai_dispatch_ipc.ts');

type FakeDetection = { vramGb: number | null; method: string; confidence: string; note?: string };

interface VramGateOutcome {
  model: string;
  requestedModel: string;
  wasExplicit: boolean;
  downgraded: boolean;
  vramGb: number | null;
  vramMethod: string;
  vramConfidence: string;
  requiredVramGbForRequested: number | null;
  note?: string;
}
type ResolveFn = (
  requestedModel: string,
  wasExplicit: boolean,
  detector?: () => FakeDetection,
) => VramGateOutcome;

let resolveVramGatedModel: ResolveFn;

beforeAll(() => {
  const src = readFileSync(AI_DISPATCH_IPC_TS_PATH, 'utf8');

  // Slice out exactly: VramGateOutcome, the process-lifetime detection cache, and
  // resolveVramGatedModel itself -- nothing else (in particular, none of the `ipcMain`/`electron`
  // code that starts at registerAiDispatchIPC()). If either marker goes missing this fails loudly
  // rather than silently testing stale or empty source.
  const startMarker = 'export interface VramGateOutcome {';
  const endMarker = 'export function registerAiDispatchIPC(): void {';
  const startIdx = src.indexOf(startMarker);
  const endIdx = src.indexOf(endMarker);
  expect(startIdx, 'VramGateOutcome interface not found in ai_dispatch_ipc.ts').toBeGreaterThan(-1);
  expect(endIdx, 'boundary marker (registerAiDispatchIPC) not found in ai_dispatch_ipc.ts').toBeGreaterThan(startIdx);

  const rawSlice = src.slice(startIdx, endIdx).replace(/^export /gm, '');

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const esbuild = require('esbuild');
  const { code } = esbuild.transformSync(rawSlice, { loader: 'ts', format: 'cjs' });

  const sandboxModule = { exports: {} as Record<string, unknown> };
  // The sliced source references `applyVramGate`/`requiredVramGb`/`detectVramGbDetailed` as free
  // identifiers (imports in the real file) -- injected here as real Function parameters bound to
  // the REAL ./hardware/ram_detector exports, not reimplemented. `detectVramGbDetailed` itself is
  // never actually invoked by any test below (every call site here supplies an explicit
  // `detector` argument, so the cached-default branch never runs), but is still provided so the
  // sliced module body evaluates without a ReferenceError.
  // eslint-disable-next-line no-new-func
  const factory = new Function(
    'module', 'exports', 'applyVramGate', 'requiredVramGb', 'detectVramGbDetailed',
    code + '\nexports.resolveVramGatedModel = resolveVramGatedModel;',
  );
  factory(sandboxModule, sandboxModule.exports, applyVramGate, requiredVramGb, () => {
    throw new Error('detectVramGbDetailed should never be invoked -- every test supplies an explicit detector');
  });
  resolveVramGatedModel = sandboxModule.exports.resolveVramGatedModel as ResolveFn;

  expect(typeof resolveVramGatedModel, 'resolveVramGatedModel did not eval to a function').toBe('function');
});

function fakeDetector(result: FakeDetection): () => FakeDetection {
  return () => result;
}

describe('resolveVramGatedModel (ai_dispatch_ipc.ts) -- VRAM gate consultation, D-BP157-029', () => {
  test('1: model fits -- unchanged, no downgrade, no note', () => {
    const out = resolveVramGatedModel(
      'gemma2:9b', false,
      fakeDetector({ vramGb: 16, method: 'registry', confidence: 'measured' }),
    );
    expect(out.model).toBe('gemma2:9b');
    expect(out.downgraded).toBe(false);
    expect(out.note).toBeUndefined();
  });

  test('2: model does not fit -- downgraded, with an issue recorded', () => {
    // gemma4:12b requires ~8.9 GB; 3 GB VRAM cannot hold it or gemma2:9b (~9.0 GB), lands on
    // gemma2:2b -- the SAME step-down-past-the-unreachable-rung scenario D-BP157-025's own
    // ram_detector.vram_detect.test.ts asserts for the detector layer; this proves the CALLER now
    // actually reaches that behavior instead of never invoking the gate at all.
    const out = resolveVramGatedModel(
      'gemma4:12b', false,
      fakeDetector({ vramGb: 3, method: 'registry', confidence: 'measured' }),
    );
    expect(out.model, 'model was changed (stepped down)').not.toBe('gemma4:12b');
    expect(out.downgraded).toBe(true);
    expect(typeof out.note).toBe('string');
    expect(out.note!.length).toBeGreaterThan(0);
  });

  test('3: explicit override wins even when it does not fit, WITH an issue recorded', () => {
    const out = resolveVramGatedModel(
      'gemma4:12b', true,
      fakeDetector({ vramGb: 3, method: 'registry', confidence: 'measured' }),
    );
    expect(out.model, 'explicit pick still wins, never downgraded').toBe('gemma4:12b');
    expect(out.wasExplicit).toBe(true);
    expect(out.downgraded).toBe(false);
    expect(typeof out.note).toBe('string');
    expect(out.note!).toMatch(/insufficient/);
  });

  test('3b: explicit override, sufficient VRAM -- no note, model unchanged', () => {
    const out = resolveVramGatedModel(
      'gemma4:12b', true,
      fakeDetector({ vramGb: 16, method: 'registry', confidence: 'measured' }),
    );
    expect(out.model).toBe('gemma4:12b');
    expect(out.note).toBeUndefined();
  });

  test('4: VRAM unknown -- permitted, with a note, never silently shrunk', () => {
    const out = resolveVramGatedModel(
      'gemma4:12b', false,
      fakeDetector({ vramGb: null, method: 'none', confidence: 'unknown', note: 'No GPU adapter data available' }),
    );
    expect(out.model, 'candidate is permitted through unchanged, never silently shrunk').toBe('gemma4:12b');
    expect(out.downgraded).toBe(false);
    expect(typeof out.note).toBe('string');
    expect(out.note!.length).toBeGreaterThan(0);
  });

  test('5: the 4095 MiB CIM ceiling value is never treated as a real 4 GB', () => {
    // detectVramGbDetailed()'s own ceiling-rejection logic (D-BP157-025, ram_detector.ts) turns a
    // capped ~4095 MiB CIM reading into vramGb: null, confidence: 'unknown', method:
    // 'cim-capped-rejected' -- never a plausible-looking 4.0 GB. This test proves the CALLER
    // (resolveVramGatedModel) honors that null/unknown as genuinely unknown (test 4's policy),
    // not as "4 GB is available," which would silently under-gate a model that needs more.
    const out = resolveVramGatedModel(
      'gemma4:12b', false,
      fakeDetector({
        vramGb: null,
        method: 'cim-capped-rejected',
        confidence: 'unknown',
        note: 'AdapterRAM reading sits at/above the Windows uint32 ~4 GiB ceiling -- reporting unknown rather than the capped, likely-wrong number',
      }),
    );
    expect(out.model, 'ceiling-rejected reading treated as unknown (permit), never as a real 4 GB downgrade trigger').toBe('gemma4:12b');
    expect(out.vramGb, 'vramGb surfaced as null, never a fabricated 4.0').toBeNull();
    expect(out.vramMethod).toBe('cim-capped-rejected');
  });
});
