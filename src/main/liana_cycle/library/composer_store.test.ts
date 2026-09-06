// composer_store.test.ts -- D-BP167-M0-049/BISHOP/seg-composer-persistence
//
// Verifies the L5 proof this ticket requires: compose (an ordered id list), save, reload in a
// fresh module-level call, structure identical -- byte-for-byte, id-for-id, in order. Mirrors
// laboratory_store.test.ts's own shape and discipline (same env-override sandboxing, same Rule 66
// versioning assertions), applied to a saved STACK instead of a saved QUERY.
//
// NEVER TOUCHES THE REAL COMPOSER STACK DIRECTORY. Every test below points LB_COMPOSER_DIR at a
// fresh temp directory under os.tmpdir() and deletes it afterward -- same discipline
// laboratory_store.test.ts already established, for the same reason (BP148: unguarded tests have
// contaminated live stores before).
//
// No electron mock needed -- composer_store.ts imports nothing from 'electron'.

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { saveComposerStack, listComposerStacks, composerStackDirForDisplay } from './composer_store';

let tmpDir: string;
const savedEnv = process.env.LB_COMPOSER_DIR;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'lb-composer-test-'));
  process.env.LB_COMPOSER_DIR = tmpDir;
});

afterEach(() => {
  if (savedEnv === undefined) delete process.env.LB_COMPOSER_DIR;
  else process.env.LB_COMPOSER_DIR = savedEnv;
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best effort */ }
});

describe('THE COMPOSER, PERSISTED (D-BP167-M0-049)', () => {

  test('the env override actually redirects the store (sanity check the harness never touches the real path)', () => {
    expect(composerStackDirForDisplay()).toBe(tmpDir);
    expect(composerStackDirForDisplay()).not.toContain('LianaBanyanPlatform');
  });

  test('L5 PROOF: a composed stack round-trips IDENTICAL from save to reload -- same ids, same order, count preserved', () => {
    // A composed chain, exactly the shape the renderer's composerStack holds: ordered
    // NameNumbered ids, duplicates allowed on purpose ("iterations galore").
    const composed = ['StateTheQuestion:1', 'Softballs:1', 'NamedSet:1', 'Discriminator:1', 'HumanNuance:1', 'Softballs:1', 'Terminator:1'];

    const res = saveComposerStack({
      name: 'qid98 hard-number chain',
      steps: composed,
      provenance: { runInput: '98' },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.version).toBe('1');

    // Reload via a FRESH call to listComposerStacks() -- proves the reload path, not just that
    // the in-memory `composed` array still exists.
    const reloaded = listComposerStacks();
    expect(reloaded).toHaveLength(1);
    const record = reloaded[0];

    // IDENTICAL: same length, same ids, same order -- BP150's ordered-elements structure
    // preserved exactly, not flattened, not deduplicated, not resorted.
    expect(record.steps).toEqual(composed);
    expect(record.steps.length).toBe(composed.length);
    expect(record.steps).not.toBe(composed); // a genuine reload, not the same array reference

    // Provenance is recorded: who, when, against which question.
    expect(record.name).toBe('qid98 hard-number chain');
    expect(record.savedBy).toBe('Founder');
    expect(typeof record.savedAt).toBe('string');
    expect(record.provenance).toEqual({ runInput: '98' });

    // Saving never promotes.
    expect(record.promoted).toBe(false);

    // The file on disk itself carries the identical steps array -- proves the persistence layer,
    // not only the reader.
    const onDisk = JSON.parse(readFileSync(res.path, 'utf8'));
    expect(onDisk.steps).toEqual(composed);
  });

  test('(b) saving an existing name VERSIONS rather than overwrites; the prior stack survives untouched in a .superseded sibling', () => {
    const first = saveComposerStack({
      name: 'Comparative Draft',
      steps: ['StateTheQuestion:1', 'Softballs:1'],
      provenance: { runInput: '7' },
      now: () => '2026-08-25T10:00:00.000Z',
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.version).toBe('1');
    expect(first.supersededPath).toBeNull();

    const second = saveComposerStack({
      name: 'Comparative Draft',
      steps: ['StateTheQuestion:1', 'Softballs:1', 'Discriminator:1', 'Terminator:1'],
      provenance: { runInput: '14' },
      now: () => '2026-08-25T10:05:00.000Z',
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.version).toBe('2');
    expect(second.supersededPath).not.toBeNull();

    // Nothing was deleted -- Rule 66. The prior file exists, renamed, byte-identical in content.
    expect(existsSync(second.supersededPath as string)).toBe(true);
    const priorContent = JSON.parse(readFileSync(second.supersededPath as string, 'utf8'));
    expect(priorContent.steps).toEqual(['StateTheQuestion:1', 'Softballs:1']);
    expect(priorContent.version).toBe('1');
    expect(priorContent.provenance).toEqual({ runInput: '7' });

    // The canonical path now holds ONLY the new content.
    const currentContent = JSON.parse(readFileSync(second.path, 'utf8'));
    expect(currentContent.steps).toEqual(['StateTheQuestion:1', 'Softballs:1', 'Discriminator:1', 'Terminator:1']);
    expect(currentContent.version).toBe('2');

    // list() surfaces exactly ONE current entry -- the superseded sibling is excluded, never
    // double-counted or silently dropped.
    const current = listComposerStacks();
    expect(current).toHaveLength(1);
    expect(current[0].steps).toEqual(['StateTheQuestion:1', 'Softballs:1', 'Discriminator:1', 'Terminator:1']);
    expect(current[0].version).toBe('2');
  });

  test('saving never promotes -- structural regression guard: this module never writes `promoted: true` anywhere, and method_registry.ts is never imported', () => {
    const src = readFileSync(join(__dirname, 'composer_store.ts'), 'utf8');
    expect(src).not.toMatch(/promoted:\s*true/);
    expect(src).not.toMatch(/registerMethod/);
    expect(src).not.toMatch(/from\s+['"].*\/method_registry['"]/);

    // The renderer's Load handler (LianaCycleTab.tsx) must call ONLY setComposerStack (and the
    // save-name convenience field) -- never runComposerStack() or lianaScriptRun -- inside its
    // own function body, so pressing Load can never run anything by itself.
    const tabSrcPath = join(__dirname, '..', '..', '..', 'renderer', 'components', 'compass', 'LianaCycleTab.tsx');
    const tabSrc = readFileSync(tabSrcPath, 'utf8');
    const handlerMatch = tabSrc.match(
      /const loadComposerStackFromSaved = useCallback\(\(stack: LianaComposerStackSummary\) => \{([\s\S]*?)\}, \[\]\);/,
    );
    expect(handlerMatch).not.toBeNull();
    const body = handlerMatch ? handlerMatch[1] : '';
    expect(body).toMatch(/setComposerStack\(/);
    expect(body).not.toMatch(/runComposerStack/);
    expect(body).not.toMatch(/lianaScriptRun/);
  });

  test('an empty name or empty stack is refused explicitly, never silently accepted', () => {
    const noName = saveComposerStack({ name: '   ', steps: ['StateTheQuestion:1'], provenance: { runInput: '1' } });
    expect(noName.ok).toBe(false);
    const noSteps = saveComposerStack({ name: 'a name', steps: [], provenance: { runInput: '1' } });
    expect(noSteps.ok).toBe(false);
    expect(listComposerStacks()).toHaveLength(0);
  });

  test('a save into a missing/unwritable directory reports the failure explicitly and never silently drops the stack', () => {
    const blockerFile = join(tmpDir, 'this-is-a-file-not-a-directory');
    writeFileSync(blockerFile, 'x', 'utf8');
    process.env.LB_COMPOSER_DIR = join(blockerFile, 'sub', 'LIANA_COMPOSER_STACKS');

    const res = saveComposerStack({
      name: 'should not be saved',
      steps: ['StateTheQuestion:1'],
      provenance: { runInput: '1' },
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toContain(process.env.LB_COMPOSER_DIR as string);
    expect(typeof res.error).toBe('string');
    expect(res.error.length).toBeGreaterThan(0);
    expect(existsSync(blockerFile + 'sub')).toBe(false);
  });

  test('mkdirSync failure and other malformed prior files never crash listComposerStacks() -- corrupt entries are skipped, not fatal', () => {
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(join(tmpDir, 'COMPOSER_STACK_broken.json'), '{ not valid json', 'utf8');
    const good = saveComposerStack({ name: 'good one', steps: ['StateTheQuestion:1'], provenance: { runInput: '1' } });
    expect(good.ok).toBe(true);
    const list = listComposerStacks();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('good one');
  });

  test('duplicates in the composed stack survive intact -- "iterations galore" is not deduplicated by this module', () => {
    const withDupes = ['Softballs:1', 'Softballs:1', 'Softballs:1'];
    const res = saveComposerStack({ name: 'triple softball', steps: withDupes, provenance: { runInput: '1' } });
    expect(res.ok).toBe(true);
    const list = listComposerStacks();
    expect(list[0].steps).toEqual(withDupes);
    expect(list[0].steps).toHaveLength(3);
  });
});
