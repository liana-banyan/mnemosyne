// fixture_harness.test.ts -- D-BP214-XO1947-022/BISHOP-XO/seg-method-scaffold
//
// WHAT THIS IS. The other half of the "close the engineering bottleneck" build named in
// D-BP214-XO1947-020_THE_DIDASKO_MAP.md Part Six: a GENERIC, method-agnostic regression runner
// that loads every registered liana_cycle method, matches it against a stored fixture file (if one
// exists), and reports PASS / FAIL / ABSTAIN / NO-FIXTURE per method. This is deliberately NOT a
// per-method hand-written vitest suite like withheld_curve_shift_guard.test.ts and its siblings --
// those already exist, already cover their own methods in much more depth, and are untouched by
// this file. This harness instead answers a DIFFERENT question those per-method suites cannot: "run
// every registered method's fixtures, all at once, and tell me the shape of the whole toolbox" --
// the "tune it and check it still works" step (the map's Part Two, stage 6) that today has no
// automated signal at all.
//
// ZERO MODEL CALLS, ALWAYS. Every ctx passed to a method's run() here has an askGoogle that THROWS
// if called, and no Ollama/fetch call is ever made from this file. Two of the four newest methods
// (withheld-curve-shift-guard, convention-locked-recompute) DO call a local Ollama model inside their
// own run() -- exactly like their own hand-written *.test.ts siblings (grep confirms neither one
// ever calls .run() in its own test file, for the same reason), this harness's fixtures for those
// two methods assert shapeTest() ONLY (`runModelFree` omitted or false) and run() is reported as its
// own NOT-RUN category, never faked, never silently skipped without saying so.
//
// FIXTURE FILE SCHEMA. One JSON file per method under ./fixtures/<method-id>.fixtures.json:
//   {
//     "methodId": "set-equivalence-match",
//     "fixtures": [
//       {
//         "name": "human-readable label for this fixture",
//         "qid": 66,                          // OR "input": { question, options, qid?, correctAnswer? }
//         "expectShapeMatches": true,          // required
//         "runModelFree": true,                // optional, default false -- see header above
//         "expectAbstain": true,               // required only when runModelFree is true
//         "expectVerdict": null                // required only when runModelFree is true
//       }
//     ]
//   }
// `qid` loads the bundled corpus row (resources/mmlu_pro_bundled/questions.jsonl) by its internal
// question_id field, same convention every existing *.test.ts in this directory already uses --
// `input` supplies a MethodQuestionInput directly (used for shape-only fixtures with no bundled
// qid, and for the throwaway scaffold-generated method proven in this dispatch's report).
//
// CLASSIFICATION, PER FIXTURE:
//   shapeTest(input).matches !== expectShapeMatches                    -> FAIL
//   expectShapeMatches is false (no run expected)                      -> PASS
//   runModelFree is not true                                           -> NOT-RUN (shape asserted only)
//   method.quarantined and run() throws                                -> QUARANTINED (own category, never FAIL --
//                                                                          this is the fence working correctly)
//   method.quarantined and run() does NOT throw                        -> FAIL (the fence is broken -- a real regression)
//   run() throws (method not quarantined)                              -> FAIL
//   outcome.abstain === true                                           -> ABSTAIN (own category, never FAIL)
//   outcome.verdict === expectVerdict (and not abstain)                -> PASS
//   otherwise                                                          -> FAIL
// A method with no fixture file at all is reported as NO-FIXTURE, once, in the summary -- not
// silently omitted and not counted as a failure.
//
// D-BP220-BM0-006/BISHOP-SEG, 2026-09-05, ADDITIVE: the QUARANTINED category was added when
// set_equivalence_match.ts became this estate's first quarantined method (see that file's own
// header and method_registry.ts's `quarantined`/`quarantineReason` fields) -- a quarantined
// method's run() is SUPPOSED to throw, on every call, so this harness must not report that as a
// failure the way it would for any other method's unexpected throw.
//
// electron is mocked exactly like every other method test file in this directory -- never reached
// by shapeTest() or a model-free run(), the mock throws if anything ever does reach it.

import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('electron', () => ({
  app: { getPath: () => { throw new Error('app.getPath must never be reached by a fixture-harness run'); }, isPackaged: false },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: class {},
}));

import { listMethods } from '../method_registry';
import type { MethodQuestionInput } from '../method_registry';
import type { LianaTerminalEvent } from '../../../shared/liana_cycle/liana_terminal_types';

// D-BP214-XO1947-022: auto-discovers every method module in this directory via Vite's
// import.meta.glob, so a NEW method (including a scaffold-generated one, or one deleted afterward)
// is picked up or dropped automatically -- this file never hardcodes a per-method import list, and
// never needs editing (a Rule-66 versioned edit) just to add or remove a method from the run.
// Excludes:
//   *.test.ts               -- this file and its siblings (would re-run their own describe/it blocks)
//   *.superseded.*          -- Rule 66 versioned siblings, which still call registerMethod() at
//                               import time and would collide with their live successor's own id
//                               (measured: classify_cascade.superseded.20260831T161500Z.ts threw
//                               "duplicate method id" the first time this harness ran, confirming
//                               the exclusion is load-bearing, not defensive-for-nothing)
//   anchored_lookup_guard.ts -- deliberately UNREGISTERED in production (liana_terminal_engine.ts's
//                               own import is commented out, "DO NOT re-enable" -- see
//                               D-BP214-XO1947-020_THE_DIDASKO_MAP.md Part Four). Globbing it in
//                               here would make it live for THIS harness even though it is not live
//                               in the real engine, which would misreport the toolbox's true shape.
const methodModules = import.meta.glob(
  ['./*.ts', '!./*.test.ts', '!./*.superseded.*', '!./anchored_lookup_guard.ts'],
  { eager: true },
);
void methodModules; // imported purely for registerMethod() side effects; contents unused directly

const FIXTURES_DIR = join(__dirname, 'fixtures');

interface FixtureCase {
  name: string;
  qid?: number;
  input?: MethodQuestionInput;
  expectShapeMatches: boolean;
  runModelFree?: boolean;
  expectAbstain?: boolean;
  expectVerdict?: string | null;
}

interface FixtureFile {
  methodId: string;
  fixtures: FixtureCase[];
}

const letter = (i: number): string => String.fromCharCode(65 + i);

let bundledRows: Array<{ question_id: number; question: string; options: string[]; answer: string }> | null = null;
function loadBundledRow(qid: number) {
  if (bundledRows === null) {
    const bundlePath = join(__dirname, '..', '..', '..', '..', 'resources', 'mmlu_pro_bundled', 'questions.jsonl');
    bundledRows = readFileSync(bundlePath, 'utf-8')
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0)
      .map((l) => JSON.parse(l));
  }
  const row = bundledRows!.find((r) => r.question_id === qid);
  if (!row) throw new Error(`fixture_harness: qid ${qid} not found in bundled corpus`);
  return row;
}

function inputFromFixture(fc: FixtureCase): MethodQuestionInput {
  if (fc.input) return fc.input;
  if (fc.qid !== undefined) {
    const row = loadBundledRow(fc.qid);
    const options: Record<string, string> = {};
    row.options.forEach((o, i) => { options[letter(i)] = o; });
    return { question: row.question, options, qid: row.question_id, correctAnswer: row.answer };
  }
  throw new Error(`fixture "${fc.name}": neither "qid" nor "input" was supplied`);
}

function makeZeroModelCtx() {
  const events: LianaTerminalEvent[] = [];
  return {
    ctx: {
      askGoogle: async () => { throw new Error('askGoogle must never be reached by a zero-model-call fixture run'); },
      emit: (e: LianaTerminalEvent) => { events.push(e); },
    },
    events,
  };
}

type Verdict = 'PASS' | 'FAIL' | 'ABSTAIN' | 'NOT-RUN' | 'QUARANTINED';

async function classifyFixture(
  method: ReturnType<typeof listMethods>[number],
  fc: FixtureCase,
): Promise<{ verdict: Verdict; detail: string }> {
  const input = inputFromFixture(fc);
  const shapeResult = method.shapeTest(input);
  if (shapeResult.matches !== fc.expectShapeMatches) {
    return {
      verdict: 'FAIL',
      detail: `shapeTest.matches=${shapeResult.matches}, expected ${fc.expectShapeMatches} (reason: ${shapeResult.reason})`,
    };
  }
  if (!fc.expectShapeMatches) {
    return { verdict: 'PASS', detail: 'shapeTest correctly refused' };
  }
  if (!fc.runModelFree) {
    return { verdict: 'NOT-RUN', detail: 'shape asserted only -- run() requires a live model call, not exercised here' };
  }
  if (!method.run) {
    return { verdict: 'FAIL', detail: 'fixture requires runModelFree but method.run is null (unimplemented stub)' };
  }
  const { ctx } = makeZeroModelCtx();
  let outcome;
  try {
    outcome = await method.run(input, ctx as any);
  } catch (err) {
    // D-BP220-BM0-006/BISHOP-SEG, 2026-09-05 -- QUARANTINED METHODS ARE EXPECTED TO THROW. A
    // quarantined method's run() fails loudly BY DESIGN (see method_registry.ts's own
    // `quarantined` field and, e.g., methods/set_equivalence_match.ts's own fence) -- that throw
    // is a correct, honest refusal, never a regression, and must not be reported as FAIL. This
    // branch doubles as a standing regression guard: if a quarantined method's run() ever STOPS
    // throwing (the fence silently removed or bypassed), the check just below this catch block
    // (`if (method.quarantined)` after a NON-throwing outcome) reports that as FAIL instead.
    if (method.quarantined) {
      return { verdict: 'QUARANTINED', detail: `run() correctly refused (quarantined method): ${(err as Error).message}` };
    }
    return { verdict: 'FAIL', detail: `run() threw: ${(err as Error).message}` };
  }
  if (method.quarantined) {
    return { verdict: 'FAIL', detail: 'method is quarantined but run() did NOT throw -- the fence is broken, this is a real regression' };
  }
  if (outcome.abstain === true) {
    if (fc.expectAbstain === false) {
      return { verdict: 'FAIL', detail: `abstained but fixture expected a verdict (basis: ${outcome.basis})` };
    }
    return { verdict: 'ABSTAIN', detail: outcome.basis ?? '(no basis given)' };
  }
  if (outcome.verdict === fc.expectVerdict) {
    return { verdict: 'PASS', detail: `verdict=${outcome.verdict}` };
  }
  return { verdict: 'FAIL', detail: `verdict=${outcome.verdict}, expected ${fc.expectVerdict}` };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE RUN. One describe block, one test per (method, fixture) pair, plus a final summary test
// that always passes but prints the full coverage table -- so "vitest run fixture_harness.test.ts"
// alone answers "what does the whole toolbox look like right now" without grep-ing test output.
// ─────────────────────────────────────────────────────────────────────────────────────────────

const registeredMethods = listMethods();
const summaryRows: string[] = [];
const noFixtureMethods: string[] = [];

describe('fixture_harness -- zero-model-call regression over every registered method', () => {
  for (const method of registeredMethods) {
    const fixturePath = join(FIXTURES_DIR, `${method.id}.fixtures.json`);
    if (!existsSync(fixturePath)) {
      noFixtureMethods.push(method.id);
      summaryRows.push(`NO-FIXTURE  ${method.id}`);
      continue;
    }
    const fixtureFile: FixtureFile = JSON.parse(readFileSync(fixturePath, 'utf-8'));
    if (fixtureFile.methodId !== method.id) {
      throw new Error(`fixtures/${method.id}.fixtures.json declares methodId "${fixtureFile.methodId}", filename implies "${method.id}"`);
    }
    for (const fc of fixtureFile.fixtures) {
      it(`${method.id} :: ${fc.name}`, async () => {
        const result = await classifyFixture(method, fc);
        summaryRows.push(`${result.verdict.padEnd(8)}  ${method.id} :: ${fc.name} -- ${result.detail}`);
        // ABSTAIN is a correct, honest outcome and must never fail the suite. FAIL is a real
        // regression signal. NOT-RUN is informational (model-dependent, not exercised).
        expect(result.verdict, `${method.id} :: ${fc.name} -- ${result.detail}`).not.toBe('FAIL');
      });
    }
  }

  it('SUMMARY (always passes; prints the full per-method coverage table)', () => {
    console.log('\n=== fixture_harness coverage summary ===');
    for (const row of summaryRows) console.log(row);
    console.log(`\n${registeredMethods.length} registered methods total, ${noFixtureMethods.length} with no fixture file:`);
    for (const id of noFixtureMethods) console.log(`  NO-FIXTURE: ${id}`);
    expect(true).toBe(true);
  });
});
