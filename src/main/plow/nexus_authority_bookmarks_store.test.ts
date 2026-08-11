// nexus_authority_bookmarks_store.test.ts -- D-BP152-028/BISHOP/seg-nexus-browser-bar
//
// Covers VERIFY item (d): "bookmarks add/list/navigate/remove and survive a restart
// (persistence read back from disk)." add/list/remove are exercised directly against real disk
// I/O (this module has zero Electron import, same electron-agnostic discipline
// laboratory_store.ts/query_text_loader.ts already document, for the same reason: a plain-node
// test runner must be able to exercise it). "navigate" (a bookmark click calling
// wv.loadURL(bm.url)) is DOM wiring inside the embedder's inline script and is covered instead by
// nexus_authority_persistent_session.browser_bar.test.ts's source-level assertions, per this
// ticket's own "source-level tests" instruction.
//
// NEVER TOUCHES THE REAL BOOKMARKS FILE. Every test below points LB_NEXUS_BOOKMARKS_PATH at a
// fresh temp file under os.tmpdir() (never under the repo, never under
// C:\Users\Administrator\Documents\LianaBanyanPlatform) and deletes it afterward -- per this
// estate's own standing finding that unguarded tests have contaminated live stores before
// (BP148: "49 of 123 test files writing synthetic records into real stores with no cleanup").

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  listNexusAuthorityBookmarks,
  addNexusAuthorityBookmark,
  removeNexusAuthorityBookmark,
  nexusBookmarksPathForDisplay,
} from './nexus_authority_bookmarks_store';

let tmpDir: string;
let tmpFile: string;
const savedEnv = process.env.LB_NEXUS_BOOKMARKS_PATH;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'lb-nexus-bookmarks-test-'));
  tmpFile = join(tmpDir, 'NEXUS_AUTHORITY_BOOKMARKS.json');
  process.env.LB_NEXUS_BOOKMARKS_PATH = tmpFile;
});

afterEach(() => {
  if (savedEnv === undefined) delete process.env.LB_NEXUS_BOOKMARKS_PATH;
  else process.env.LB_NEXUS_BOOKMARKS_PATH = savedEnv;
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best effort */ }
});

describe('D-BP152-028 -- Nexus Authority bookmarks store (VERIFY (d))', () => {
  test('the env override actually redirects the store (sanity check the harness never touches the real path)', () => {
    expect(nexusBookmarksPathForDisplay()).toBe(tmpFile);
    expect(nexusBookmarksPathForDisplay()).not.toContain('LianaBanyanPlatform');
  });

  test('a fresh/missing store lists empty, never throws', () => {
    expect(existsSync(tmpFile)).toBe(false);
    expect(listNexusAuthorityBookmarks()).toEqual([]);
  });

  test('add: a bookmark round-trips through list with the exact url and title', () => {
    const res = addNexusAuthorityBookmark('https://www.google.com/search?q=foo', 'foo - Google Search');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.bookmarks).toHaveLength(1);
    expect(res.bookmarks[0].url).toBe('https://www.google.com/search?q=foo');
    expect(res.bookmarks[0].title).toBe('foo - Google Search');
    expect(typeof res.bookmarks[0].id).toBe('string');
    expect(res.bookmarks[0].id.length).toBeGreaterThan(0);
    expect(listNexusAuthorityBookmarks()).toEqual(res.bookmarks);
  });

  test('add: a blank url is refused and nothing is written', () => {
    const res = addNexusAuthorityBookmark('   ', 'no url');
    expect(res.ok).toBe(false);
    expect(listNexusAuthorityBookmarks()).toEqual([]);
  });

  test('add: an empty/blank title falls back to the url itself', () => {
    const res = addNexusAuthorityBookmark('https://claude.ai/new', '   ');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.bookmarks[0].title).toBe('https://claude.ai/new');
  });

  test('add: does NOT de-duplicate -- the same url can be bookmarked twice (no unordered decision rule)', () => {
    addNexusAuthorityBookmark('https://www.perplexity.ai/', 'Perplexity A');
    const res = addNexusAuthorityBookmark('https://www.perplexity.ai/', 'Perplexity B');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.bookmarks).toHaveLength(2);
  });

  test('remove: removes exactly the matching id and leaves the rest untouched', () => {
    const first = addNexusAuthorityBookmark('https://a.example.com/', 'A');
    const second = addNexusAuthorityBookmark('https://b.example.com/', 'B');
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    const removed = removeNexusAuthorityBookmark(first.bookmarks[0].id);
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.bookmarks).toHaveLength(1);
    expect(removed.bookmarks[0].url).toBe('https://b.example.com/');
  });

  test('remove: an id that does not exist is an idempotent success, not an error', () => {
    addNexusAuthorityBookmark('https://a.example.com/', 'A');
    const removed = removeNexusAuthorityBookmark('does-not-exist');
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.bookmarks).toHaveLength(1);
  });

  test('SURVIVES A RESTART: bookmarks persist to disk and are read back fresh with no reliance on in-memory state', async () => {
    addNexusAuthorityBookmark('https://www.google.com', 'Google');
    addNexusAuthorityBookmark('https://chatgpt.com/', 'ChatGPT');

    // Prove it is actually on disk, not merely held in a module-level variable.
    expect(existsSync(tmpFile)).toBe(true);
    const raw = readFileSync(tmpFile, 'utf-8');
    const onDisk = JSON.parse(raw) as Array<{ url: string }>;
    expect(onDisk).toHaveLength(2);

    // Simulate "restart" by editing the on-disk file DIRECTLY (bypassing this module's own
    // add/remove functions entirely) and then reading through listNexusAuthorityBookmarks()
    // again -- proves the read path has no module-level cache to go stale: a real app restart
    // re-imports this module fresh and its FIRST call to listNexusAuthorityBookmarks() must see
    // whatever is on disk at that moment, exactly what this direct-file-edit-then-read proves.
    const direct = JSON.parse(readFileSync(tmpFile, 'utf-8')) as Array<Record<string, unknown>>;
    direct.push({ id: 'external-edit', url: 'https://www.perplexity.ai/', title: 'Perplexity', addedAt: new Date().toISOString() });
    writeFileSync(tmpFile, JSON.stringify(direct, null, 2), 'utf-8');

    const listed = listNexusAuthorityBookmarks();
    expect(listed).toHaveLength(3);
    expect(listed.map((b) => b.url).sort()).toEqual(
      ['https://chatgpt.com/', 'https://www.google.com', 'https://www.perplexity.ai/'].sort(),
    );
  });

  test('a corrupt store file reads as empty rather than throwing', () => {
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(tmpFile, '{ not valid json', 'utf-8');
    expect(() => listNexusAuthorityBookmarks()).not.toThrow();
    expect(listNexusAuthorityBookmarks()).toEqual([]);
  });

  test('a store file that is valid JSON but not an array reads as empty', () => {
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(tmpFile, JSON.stringify({ not: 'an array' }), 'utf-8');
    expect(listNexusAuthorityBookmarks()).toEqual([]);
  });
});
