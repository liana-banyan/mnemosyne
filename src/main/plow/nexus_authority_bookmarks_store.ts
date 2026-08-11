// nexus_authority_bookmarks_store.ts -- D-BP152-028/BISHOP/seg-nexus-browser-bar
//
// Persists bookmarks for the Nexus Authority 5-surface browser window's new address bar
// (nexus_authority_persistent_session.ts's buildEmbedderHtml()). Founder, BP152, verbatim: "it
// would be most useful ... if we put in the browser Bar and bookmarks ... in other words, just
// run the Google Chrome Browser." This module is the on-disk store for the "bookmarks" half of
// that ask -- item 3 of D-BP152-028's scope: "Add the current page, list them, click to
// navigate, remove one. Persist them."
//
// WHERE THIS LIVES, AND WHY -- read D-BP152-022's own laboratory_store.ts FIRST (per this
// ticket's own instruction), then applied the SAME three criteria that file's header justifies
// its path against:
//
//   C:\Users\Administrator\Documents\LianaBanyanPlatform\NEXUS_AUTHORITY_BOOKMARKS.json
//   (overridable via the LB_NEXUS_BOOKMARKS_PATH env var -- the same override convention
//   laboratory_store.ts's LB_LABORATORY_DIR and query_text_loader.ts's LB_SURVEY_QUERIES_PATH
//   already established, so a test can point this at a throwaway file and never touch the real
//   one).
//
//   1. HE CAN FIND AND READ IT WITHOUT THE APP. Plain, human-readable JSON in the SAME
//      C:\Users\Administrator\Documents\LianaBanyanPlatform tree BISHOP_DROPZONE and
//      LIANA_LABORATORY already live in, which he already opens directly with a text editor.
//   2. A PACKAGED BUILD CAN WRITE TO IT. Not under app.asar (read-only at runtime), not even
//      under the install directory's own extraResources 'resources/' folder -- a plain, absolute
//      path in the operator's own Documents tree, identical in shape to laboratory_store.ts's own
//      chosen path and to index.ts's pre-existing 'liana-teach-submit' DROPZONE_DIR precedent.
//      Written with a plain fs call, same as both of those.
//   3. IT SURVIVES AN APP UPDATE. Entirely outside mnemosyne's install directory, so a fresh
//      install or update (which touches only the install directory) never reaches this path --
//      same reasoning laboratory_store.ts's header gives for rejecting the resources/
//      extraResources precedent.
//
//   ONE DELIBERATE DIFFERENCE FROM THE LABORATORY: NOT RULE-66-VERSIONED. Every Laboratory step
//   is a named, one-shot, Founder-authored artifact (FD-BP152-10), so Rule 66 (never overwrite,
//   always leave a ".superseded.<ts>.json" sibling) is the right shape for it. A bookmark list is
//   a single MUTABLE collection the operator adds to and removes from interactively, one click at
//   a time -- the same "single JSON file, read fresh every time, overwritten in place" shape this
//   file's sibling nexus_authority_persistent_session.ts already uses for its OWN mutable mirror
//   file (nexus_authority_flags.json, same directory). Applying Rule 66 here would leave a new
//   ".superseded" file on every single add/remove click, which is not what that rule is for and
//   was not asked for -- HARDWIRE-23 names exactly this shape of unordered elaboration as a tare.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { randomUUID } from 'crypto';

export interface NexusAuthorityBookmark {
  id: string;
  url: string;
  title: string;
  /** ISO 8601 UTC, the moment this bookmark was added. */
  addedAt: string;
}

function resolveNexusBookmarksPath(): string {
  return process.env.LB_NEXUS_BOOKMARKS_PATH
    || 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\NEXUS_AUTHORITY_BOOKMARKS.json';
}

/** Read-only accessor for tests/diagnostics -- lets a test assert the env override actually
 *  redirected the store, same sanity-check convention laboratory_store.ts's own
 *  laboratoryDirForDisplay() already established. */
export function nexusBookmarksPathForDisplay(): string {
  return resolveNexusBookmarksPath();
}

/** Never throws. A missing file, a corrupt file, or a non-array JSON body all read as an empty
 *  list -- the same honest-empty convention this directory's own
 *  readNexusAuthorityFlagsFile()/isNexusAuthorityFlagEnabled() (nexus_authority_persistent_
 *  session.ts) already uses for its own mirror file. Always re-reads from disk -- no in-memory
 *  cache -- so this function IS "read back from disk," including across a simulated restart
 *  (a fresh call, or a fresh module instance, both re-read the same file). */
export function listNexusAuthorityBookmarks(): NexusAuthorityBookmark[] {
  try {
    const p = resolveNexusBookmarksPath();
    if (!existsSync(p)) return [];
    const parsed: unknown = JSON.parse(readFileSync(p, 'utf-8'));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((b): b is NexusAuthorityBookmark => (
      !!b
      && typeof (b as NexusAuthorityBookmark).id === 'string'
      && typeof (b as NexusAuthorityBookmark).url === 'string'
      && typeof (b as NexusAuthorityBookmark).title === 'string'
    ));
  } catch {
    return [];
  }
}

function writeNexusAuthorityBookmarks(list: NexusAuthorityBookmark[]): { ok: true } | { ok: false; error: string } {
  const p = resolveNexusBookmarksPath();
  try {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(list, null, 2), 'utf-8');
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: `Nexus bookmarks file "${p}" could not be written: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export type NexusAuthorityBookmarksMutationResult =
  | { ok: true; bookmarks: NexusAuthorityBookmark[] }
  | { ok: false; error: string; bookmarks: NexusAuthorityBookmark[] };

/**
 * Adds one bookmark for the current page. Refuses a blank/whitespace-only url (never writes a
 * useless entry) -- everything else is accepted verbatim. Does NOT de-duplicate by url: the
 * operator may bookmark the same page twice under different titles, and silently merging them
 * would be a decision rule nobody ordered (HARDWIRE-23) -- not built.
 */
export function addNexusAuthorityBookmark(url: string, title: string): NexusAuthorityBookmarksMutationResult {
  const trimmedUrl = (url ?? '').trim();
  const existing = listNexusAuthorityBookmarks();
  if (!trimmedUrl) {
    return { ok: false, error: 'Bookmark refused: no URL to save.', bookmarks: existing };
  }
  const bookmark: NexusAuthorityBookmark = {
    id: randomUUID(),
    url: trimmedUrl,
    title: (title ?? '').trim() || trimmedUrl,
    addedAt: new Date().toISOString(),
  };
  const next = existing.concat([bookmark]);
  const wrote = writeNexusAuthorityBookmarks(next);
  if (!wrote.ok) {
    return { ok: false, error: wrote.error, bookmarks: existing };
  }
  return { ok: true, bookmarks: next };
}

/**
 * Removes one bookmark by id. Removing an id that is not present is an idempotent success (the
 * end state the operator wants -- "that bookmark is gone" -- is already true), not an error.
 */
export function removeNexusAuthorityBookmark(id: string): NexusAuthorityBookmarksMutationResult {
  const existing = listNexusAuthorityBookmarks();
  const next = existing.filter((b) => b.id !== id);
  const wrote = writeNexusAuthorityBookmarks(next);
  if (!wrote.ok) {
    return { ok: false, error: wrote.error, bookmarks: existing };
  }
  return { ok: true, bookmarks: next };
}
