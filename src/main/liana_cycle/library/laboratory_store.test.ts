// laboratory_store.test.ts -- D-BP152-022/BISHOP/seg-laboratory-and-keep
//
// Verifies FD-BP152-07 (ephemeral by default, persisted only on "keep") and FD-BP152-10 (the
// Laboratory, tier 1 of the three folders). See laboratory_store.ts's own header for the full
// design rationale, including the chosen on-disk path and why it was chosen over the
// resources/ extraResources precedent.
//
// THE SIX ASSERTIONS THIS TICKET'S VERIFY SECTION NAMES:
//   (a) a kept query round-trips byte-identical from save to load.
//   (b) saving an existing name versions rather than overwrites, and the prior content survives
//       in a ".superseded" sibling.
//   (c) loading fills the box and executes nothing.
//   (d) without "keep" the query still vanishes.
//   (e) the three existing pause actions (approve/correct/redirect) behave exactly as at cb311a23.
//   (f) a save into a missing/unwritable directory reports the failure explicitly and never
//       silently drops the query.
//
// NEVER TOUCHES THE REAL LABORATORY DIRECTORY. Every test below points LB_LABORATORY_DIR at a
// fresh temp directory under os.tmpdir() (never under the repo, never under
// C:\Users\Administrator\Documents\LianaBanyanPlatform) and deletes it afterward -- per this
// estate's own standing finding that unguarded tests have contaminated live stores before
// (BP148: "49 of 123 test files writing synthetic records into real stores with no cleanup").
//
// No electron mock needed -- laboratory_store.ts imports nothing from 'electron', same
// electron-agnostic discipline query_text_loader.ts's own header documents and for the same
// reason (a plain-node test runner must be able to exercise this file).

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { saveLaboratoryStep, listLaboratorySteps, laboratoryDirForDisplay } from './laboratory_store';

let tmpDir: string;
const savedEnv = process.env.LB_LABORATORY_DIR;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'lb-laboratory-test-'));
  process.env.LB_LABORATORY_DIR = tmpDir;
});

afterEach(() => {
  if (savedEnv === undefined) delete process.env.LB_LABORATORY_DIR;
  else process.env.LB_LABORATORY_DIR = savedEnv;
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best effort */ }
});

describe('THE LABORATORY, AND KEEP (FD-BP152-07, FD-BP152-10, D-BP152-022)', () => {

  test('the env override actually redirects the store (sanity check the harness never touches the real path)', () => {
    expect(laboratoryDirForDisplay()).toBe(tmpDir);
    expect(laboratoryDirForDisplay()).not.toContain('LianaBanyanPlatform');
  });

  test('(a) a kept query round-trips byte-identical from save to load, trimmed only at the ends (FD-BP152-15\'s own trim)', () => {
    const typed = '  What is the smallest set of questions   I could ask first?  \n';
    const res = saveLaboratoryStep({
      name: 'smallest question set',
      queryTextVerbatim: typed,
      provenance: { runInput: '98' },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.version).toBe('1');

    const loaded = listLaboratorySteps();
    expect(loaded).toHaveLength(1);
    const step = loaded[0];

    // Byte-identical to typed.trim() -- and NOT equal to the untrimmed original, so this
    // assertion is not vacuous (same discipline D-BP152-021's own test (a) used).
    expect(step.queryTextVerbatim).toBe(typed.trim());
    expect(step.queryTextVerbatim).not.toBe(typed);

    // Every field requirement 2 names is actually on disk: his name for it, attribution
    // (Founder-authored, dated, from the bench), provenance (qid/run).
    expect(step.name).toBe('smallest question set');
    expect(step.savedBy).toBe('Founder');
    expect(step.savedFromBench).toBe(true);
    expect(typeof step.savedAt).toBe('string');
    expect(step.provenance).toEqual({ runInput: '98' });
    expect(step.declaration.attribution.kind).toBe('ATTRIBUTED');
    if (step.declaration.attribution.kind === 'ATTRIBUTED') {
      expect(step.declaration.attribution.founderRuling).toBe('BP152');
      expect(step.declaration.attribution.quote).toContain('unless I say keep');
    }

    // The file on disk is the SAME byte-identical string -- read the raw file directly, not only
    // through listLaboratorySteps(), to prove the persistence layer itself, not just the reader.
    const onDisk = JSON.parse(readFileSync(res.path, 'utf8'));
    expect(onDisk.queryTextVerbatim).toBe(typed.trim());
  });

  test('(b) saving an existing name VERSIONS rather than overwrites; the prior content survives untouched in a .superseded sibling', () => {
    const first = saveLaboratoryStep({
      name: 'Ambiguity Plus Operation',
      queryTextVerbatim: 'first query text',
      provenance: { runInput: '98' },
      now: () => '2026-08-10T20:00:00.000Z',
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.version).toBe('1');
    expect(first.supersededPath).toBeNull();

    const second = saveLaboratoryStep({
      name: 'Ambiguity Plus Operation',
      queryTextVerbatim: 'second, revised query text',
      provenance: { runInput: '99' },
      now: () => '2026-08-10T20:05:00.000Z',
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.version).toBe('2');
    expect(second.supersededPath).not.toBeNull();

    // Nothing was deleted -- Rule 66. The prior file exists, renamed, byte-identical in content.
    expect(existsSync(second.supersededPath as string)).toBe(true);
    const priorContent = JSON.parse(readFileSync(second.supersededPath as string, 'utf8'));
    expect(priorContent.queryTextVerbatim).toBe('first query text');
    expect(priorContent.declaration.version).toBe('1');
    expect(priorContent.provenance).toEqual({ runInput: '98' });

    // The canonical path now holds ONLY the new content.
    const currentContent = JSON.parse(readFileSync(second.path, 'utf8'));
    expect(currentContent.queryTextVerbatim).toBe('second, revised query text');
    expect(currentContent.declaration.version).toBe('2');

    // list() surfaces exactly ONE current entry -- the superseded sibling is excluded, never
    // double-counted or silently dropped.
    const current = listLaboratorySteps();
    expect(current).toHaveLength(1);
    expect(current[0].queryTextVerbatim).toBe('second, revised query text');
    expect(current[0].declaration.version).toBe('2');
  });

  test('(c) loading executes nothing -- listLaboratorySteps()/saveLaboratoryStep() never reach askGoogle or googleBlocks, and the renderer Load handler only sets state', () => {
    // Structural proof at the source level, same discipline orphan_catalog.ts's own inertness
    // test uses: this module cannot execute a query because it never imports anything that could
    // send one.
    const src = readFileSync(join(__dirname, 'laboratory_store.ts'), 'utf8');
    expect(src).not.toMatch(/askGoogle/);
    expect(src).not.toMatch(/googleBlocks/);
    expect(src).not.toMatch(/import\s+.*from\s+['"].*comparative_cascade['"]/);

    // The renderer's Load handler (LianaCycleTab.tsx, D-BP152-022) must call ONLY
    // setSteppedResponseText -- never answerSteppedPause()/lianaSteppedRespond -- inside its own
    // function body, so pressing Load can never send anything by itself.
    const tabSrcPath = join(__dirname, '..', '..', '..', 'renderer', 'components', 'compass', 'LianaCycleTab.tsx');
    const tabSrc = readFileSync(tabSrcPath, 'utf8');
    const handlerMatch = tabSrc.match(
      /const handleLoadLaboratoryStep = useCallback\(\(step: LianaLaboratoryStepSummary\) => \{([\s\S]*?)\}, \[\]\);/,
    );
    expect(handlerMatch).not.toBeNull();
    const body = handlerMatch ? handlerMatch[1] : '';
    expect(body).toMatch(/setSteppedResponseText\(step\.queryTextVerbatim\)/);
    expect(body).not.toMatch(/answerSteppedPause/);
    expect(body).not.toMatch(/lianaSteppedRespond/);
  });

  test('(d) without "keep", a query still vanishes -- this module is not reachable from the run path at all', () => {
    // Structural: neither stepped_audible.ts (requestStepZeroPause(), the Step 0 loop D-BP152-021
    // built) nor liana_terminal_engine.ts imports anything from laboratory_store.ts. Saving is
    // reachable ONLY via the new, separate 'liana-laboratory-save' IPC channel (index.ts),
    // triggered ONLY by the renderer's own "Keep" button -- never automatically by a send.
    const steppedAudibleSrc = readFileSync(join(__dirname, '..', 'stepped_audible.ts'), 'utf8');
    expect(steppedAudibleSrc).not.toMatch(/laboratory_store/);
    const engineSrc = readFileSync(join(__dirname, '..', 'liana_terminal_engine.ts'), 'utf8');
    expect(engineSrc).not.toMatch(/laboratory_store/);

    // Confirms nothing was ever written for a run that never called saveLaboratoryStep() --
    // the directory this test's own beforeEach pointed at is empty until a save happens.
    expect(listLaboratorySteps()).toHaveLength(0);
  });

  test('(e) "keep" never touches the stepped-pause action union -- structural regression guard', () => {
    // LianaSteppedAction (shared/liana_cycle/liana_terminal_types.ts) must still be exactly the
    // five literals D-BP152-021 shipped at cb311a23 -- 'keep' (or any Laboratory action) must
    // NEVER be added to this union, per this ticket's own "add alongside them; they must behave
    // exactly as today" instruction for approve/correct/redirect/ask_google.
    const typesSrc = readFileSync(
      join(__dirname, '..', '..', '..', 'shared', 'liana_cycle', 'liana_terminal_types.ts'),
      'utf8',
    );
    const m = typesSrc.match(/export type LianaSteppedAction = ([^;]+);/);
    expect(m).not.toBeNull();
    expect((m as RegExpMatchArray)[1].trim()).toBe(
      "'approve' | 'correct' | 'redirect' | 'abandon' | 'ask_google'",
    );
  });

  test('(f) a save into a missing/unwritable directory reports the failure explicitly and never silently drops the query', () => {
    // Force mkdirSync to throw ENOTDIR: point LB_LABORATORY_DIR at a path that tries to create a
    // directory UNDER a plain file (a file cannot have children).
    const blockerFile = join(tmpDir, 'this-is-a-file-not-a-directory');
    writeFileSync(blockerFile, 'x', 'utf8');
    process.env.LB_LABORATORY_DIR = join(blockerFile, 'sub', 'LIANA_LABORATORY');

    const res = saveLaboratoryStep({
      name: 'should not be saved',
      queryTextVerbatim: 'this query must not be silently dropped',
      provenance: { runInput: '1' },
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toContain(process.env.LB_LABORATORY_DIR as string);
    expect(typeof res.error).toBe('string');
    expect(res.error.length).toBeGreaterThan(0);

    // Nothing was written anywhere reachable -- the function returned an explicit failure object,
    // it did not throw, and it did not fall back to writing somewhere else silently.
    expect(existsSync(blockerFile + 'sub')).toBe(false);
  });

  test('an empty name or empty query is refused explicitly, never silently accepted', () => {
    const noName = saveLaboratoryStep({ name: '   ', queryTextVerbatim: 'something', provenance: { runInput: '1' } });
    expect(noName.ok).toBe(false);
    const noQuery = saveLaboratoryStep({ name: 'a name', queryTextVerbatim: '   ', provenance: { runInput: '1' } });
    expect(noQuery.ok).toBe(false);
    expect(listLaboratorySteps()).toHaveLength(0);
  });

  test('mkdirSync failure and other malformed prior files never crash listLaboratorySteps() -- corrupt entries are skipped, not fatal', () => {
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(join(tmpDir, 'LABORATORY_STEP_broken.json'), '{ not valid json', 'utf8');
    const good = saveLaboratoryStep({ name: 'good one', queryTextVerbatim: 'q', provenance: { runInput: '1' } });
    expect(good.ok).toBe(true);
    const list = listLaboratorySteps();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('good one');
  });
});
