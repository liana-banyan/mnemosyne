// query_capture_store.ts -- D-BP151-037/BISHOP/seg-query-capture-archive
//
// ATTRIBUTED: Founder, BP151, verbatim: "can I keep the queries made as entries on an Eblet?
// like we do already in Mnemosynec - that works, but allow me not just to clear, but to
// archive, or delete, so I have ultimate control as a user. Because I had to retype the one I
// did before, since there is no memory of my search that I can access in google.. unless I
// used history, I suppose."
//
// WHAT THIS IS. Every query the Founder composes and sends (Ask tab), and every query
// MnemosyneC issues to Google on his behalf (askGoogle), is minted as one *.eblet.md file --
// same frontmatter+body shape mintForageEblet() (homework_runner.ts:389-467) already uses for
// the one other live "mint an eblet from a background process" path in this repo -- so this is
// a reuse of an established shape, not a new one invented for this ticket.
//
// WHERE IT LIVES, AND WHY NOT THE VAULT. Per FD-BP151-14 (Founder, BP151: "Enable it, but have
// it write to an 'on-Deck' folder that allows me to evaluate value of it before minting. And
// store it on D: so we have room to cut loose or keep as I want and decide, per.") -- the SAME
// ruling that created D:\OnDeck\HOMEWORK_MINTS\ and D:\OnDeck\CELPANES\ (FD-BP151-15). These
// are the Founder's OWN queries, not ratified canon -- LB-GOLD-0399 (Vault sacrosanct) and this
// ticket's own "do not write into Asteroid-ProofVault\state\eblets\CANON\" instruction both
// point the same direction. This store creates a THIRD sibling, D:\OnDeck\QUERY_CAPTURE\,
// deliberately separate from the other two (same reasoning FD-BP151-15 gave for keeping
// CELPANES separate from HOMEWORK_MINTS: different content classes, one folder each).
//
// WHY THIS DIRECTORY IS NEVER INDEXED, AND WHY THAT MATTERS FOR DELETE. mnem_eblet_store.ts's
// resolveEbletStoreRoots() (that file, lines 239-310) only ever walks: an env override, the two
// named Asteroid-ProofVault CANON trees + HARDWIRE/ (estateDoctrineRoots()), the bundled
// default set, and {userData}/eblets. D:\OnDeck\QUERY_CAPTURE\ is NONE of those -- confirmed by
// reading that function directly, not assumed -- so a query-capture eblet is never picked up by
// the substrate's own BM25 index (eblet_index.jsonl) and never surfaces in a normal Ask. That
// is exactly why DELETE here can be a bare unlink with nothing else to clean up: there is no
// shadow index entry to also remove, because none was ever created.
//
// THE THREE ACTS (Founder: "allow me not just to clear, but to archive, or delete, so I have
// ultimate control as a user"):
//   CLEAR   -- status -> 'cleared'.  File untouched otherwise. Hidden from the default
//              ('active') view; still listed when the caller asks for cleared items; still
//              found by findQueries(). The record survives (Founder's own three-way framing).
//   ARCHIVE -- status -> 'archived'. Same mechanism as CLEAR, different bucket, same survival
//              guarantee -- listed under its own filter, still retrievable, still found by
//              findQueries().
//   DELETE  -- unlinkSync() the file. This is the ONLY act of the three that removes anything.
//              Verified in this ticket's test by re-listing and re-searching the store after
//              the delete and asserting the id is absent from both.
//
// CONSENT / THE SUBSTRATE PROCESSING SWITCH. captureQuery() below is the ONLY entry point that
// writes a new record, and its first line is isQueryCaptureEnabled() (query_capture_settings.ts)
// -- when that is false (the default), captureQuery() returns immediately, writes no file, and
// (per that module's own header) logs nothing. This satisfies both this ticket's original
// "default to capturing nothing" hard constraint and the BP151 addition's "OFF must actually
// stop the processing" order with the SAME single gate.
//
// NO QUERY CONTENT EVER GOES THROUGH console.*. Every function below that could touch a
// captured question's text avoids console.log/warn/error/info entirely (electron-log mirrors
// all of those to a persistent rotating file -- see query_capture_settings.ts's header for the
// full finding). A captured question's ONLY copy is the one eblet file this module writes; a
// caller that deletes it removes the only copy that ever existed.

import { existsSync, readdirSync, readFileSync, writeFileSync, unlinkSync, mkdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { isQueryCaptureEnabled } from './query_capture_settings';

export type QueryCaptureSource = 'ask_tab' | 'ask_google';
export type QueryCaptureStatus = 'active' | 'cleared' | 'archived';

export interface QueryCaptureEntry {
  id: string;
  question: string;
  source: QueryCaptureSource;
  /** Only set for source:'ask_google' -- which authority the query was sent to. */
  authority?: string;
  status: QueryCaptureStatus;
  capturedAt: string; // ISO-8601, set once at mint time -- this is content metadata about the
                       // QUERY (when it was asked), not a record of a later privacy toggle, so
                       // it is not covered by the "no history" rule in query_capture_settings.ts.
  /** Absolute path of the *.eblet.md file this entry lives in. */
  filePath: string;
}

function queryCaptureDir(): string {
  // Test-only escape hatch, same convention as HOMEWORK_TEST_CANON_VAULT_DIR.
  const testOverride = process.env.QUERY_CAPTURE_TEST_STORE_DIR;
  if (testOverride && testOverride.trim() !== '') return resolve(testOverride);
  return resolve('D:\\OnDeck\\QUERY_CAPTURE');
}

/** Exported for the SEG-return's own verification step and for tests -- never used to decide
 *  behavior inside this module. */
export function getQueryCaptureDir(): string {
  return queryCaptureDir();
}

function slugify(text: string): string {
  const words = text.trim().split(/\s+/).slice(0, 6).join('_');
  const slug = words.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
  return slug.length > 0 ? slug : 'query';
}

function escapeYamlString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
}

// ─── Frontmatter read/write (hand-rolled, matching mintForageEblet's key:value convention --
// no YAML library dependency, same as homework_runner.ts's own mint writer) ──────────────────

interface ParsedEntry {
  frontmatter: Record<string, string>;
  body: string;
}

function parseFrontmatter(raw: string): ParsedEntry | null {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return null;
  const fmBlock = m[1];
  const body = m[2];
  const frontmatter: Record<string, string> = {};
  for (const line of fmBlock.split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_]+):\s?(.*)$/);
    if (!kv) continue;
    let value = kv[2];
    // Strip one layer of double-quote wrapping + unescape, if present (mirrors how these
    // fields are written below).
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
    frontmatter[kv[1]] = value;
  }
  return { frontmatter, body };
}

function fileToEntry(filePath: string): QueryCaptureEntry | null {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
  const parsed = parseFrontmatter(raw);
  if (!parsed) return null;
  const fm = parsed.frontmatter;
  if (!fm.id || !fm.question || !fm.source || !fm.status || !fm.captured_at) return null;
  const source = fm.source === 'ask_google' ? 'ask_google' : fm.source === 'ask_tab' ? 'ask_tab' : null;
  const status = fm.status === 'cleared' ? 'cleared' : fm.status === 'archived' ? 'archived' : fm.status === 'active' ? 'active' : null;
  if (!source || !status) return null;
  return {
    id: fm.id,
    question: fm.question,
    source,
    authority: fm.authority || undefined,
    status,
    capturedAt: fm.captured_at,
    filePath,
  };
}

function writeEntryFile(entry: QueryCaptureEntry): void {
  const lines = [
    '---',
    `id: ${entry.id}`,
    `name: query-capture-${entry.id}`,
    `description: "Query Capture (D-BP151-037): a query ${entry.source === 'ask_tab' ? 'the Founder composed in the Ask tab' : 'MnemosyneC issued to Google on the Founder'+"'"+'s behalf'}. On-Deck, not Vault canon -- see this module's own header."`,
    'type: query-capture',
    'class: query-capture · unverified · on-deck · not-vault-canon',
    `source: ${entry.source}`,
    ...(entry.authority ? [`authority: ${entry.authority}`] : []),
    `status: ${entry.status}`,
    `captured_at: ${entry.capturedAt}`,
    'verified: false',
    'maturity: Provisional',
    `question: "${escapeYamlString(entry.question)}"`,
    '---',
    '',
    `# Query Capture: ${entry.id}`,
    '',
    `**Source:** \`${entry.source}\`${entry.authority ? ` (authority: \`${entry.authority}\`)` : ''}`,
    `**Captured:** ${entry.capturedAt}`,
    `**Status:** ${entry.status}`,
    '',
    '## Question',
    '',
    entry.question,
    '',
    '---',
    'Minted by Query Capture (D-BP151-037) -- an On-Deck record of a query, kept so it can be ' +
      'found again without retyping it. Not Vault canon; not classified; not ratified. The ' +
      'Founder has ultimate control over this record: clear (hide from the working view, ' +
      'record survives), archive (retain and retrieve), or delete (the only act of the three ' +
      'that actually removes it).',
    '',
  ].join('\n');
  writeFileSync(entry.filePath, lines, 'utf-8');
}

function listAllFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.eblet.md'))
      .map((f) => join(dir, f));
  } catch {
    return [];
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

export type CaptureResult =
  | { ok: true; id: string; path: string }
  | { ok: false; reason: string };

/** Mint a new query-capture eblet. The ONLY write path in this module. First line is the
 *  consent/off-switch gate -- when capture is not enabled, this writes nothing at all (no
 *  file, no partial file, no log line) and returns ok:false with an honest, non-content-
 *  bearing reason string. */
export function captureQuery(params: {
  question: string;
  source: QueryCaptureSource;
  authority?: string;
}): CaptureResult {
  if (!isQueryCaptureEnabled()) {
    return { ok: false, reason: 'query capture is off (Substrate Processing disabled) -- nothing written' };
  }
  const question = params.question?.trim();
  if (!question) {
    return { ok: false, reason: 'empty question -- nothing written' };
  }
  try {
    const dir = queryCaptureDir();
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const timestamp = Date.now();
    const slug = slugify(question);
    const id = `query_${slug}_${timestamp}`;
    const filePath = join(dir, `${id}.eblet.md`);
    const entry: QueryCaptureEntry = {
      id,
      question,
      source: params.source,
      authority: params.authority,
      status: 'active',
      capturedAt: new Date(timestamp).toISOString(),
      filePath,
    };
    writeEntryFile(entry);
    return { ok: true, id, path: filePath };
  } catch (err) {
    // Deliberately: the error message here is a filesystem-error string (ENOENT/EACCES/etc),
    // never the question text itself -- so even a failure path never puts query content
    // anywhere but the one file this function tried to write.
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/** Lists entries. `status` filters to exactly that bucket; omitted returns every status
 *  (a caller building "show cleared too" or a full-text search over everything uses this). */
export function listQueries(status?: QueryCaptureStatus): QueryCaptureEntry[] {
  const dir = queryCaptureDir();
  const entries = listAllFiles(dir)
    .map(fileToEntry)
    .filter((e): e is QueryCaptureEntry => e !== null);
  const filtered = status ? entries.filter((e) => e.status === status) : entries;
  return filtered.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
}

/** Case-insensitive substring match over `question` (and `authority`, when present) across
 *  EVERY status -- clear/archive never remove a record from being found this way, only DELETE
 *  does. This is the direct answer to "I had to retype the one I did before": the query text
 *  is findable regardless of which of the three non-destructive states it is in. */
export function findQueries(searchText: string): QueryCaptureEntry[] {
  const needle = searchText.trim().toLowerCase();
  if (!needle) return [];
  return listQueries().filter(
    (e) => e.question.toLowerCase().includes(needle) || (e.authority ?? '').toLowerCase().includes(needle),
  );
}

export type StatusChangeResult = { ok: true } | { ok: false; reason: string };

function findEntryById(id: string): QueryCaptureEntry | null {
  const dir = queryCaptureDir();
  const filePath = join(dir, `${id}.eblet.md`);
  if (!existsSync(filePath)) return null;
  return fileToEntry(filePath);
}

/** CLEAR or ARCHIVE (or explicitly return to 'active') -- rewrites the status field of the
 *  SAME file in place. Content (question/source/authority/captured_at) is preserved exactly;
 *  only `status` changes. Never deletes, never moves to a different file/directory -- "the
 *  record survives" per the Founder's own three-way framing. */
export function setQueryStatus(id: string, status: QueryCaptureStatus): StatusChangeResult {
  const entry = findEntryById(id);
  if (!entry) return { ok: false, reason: `no query-capture entry with id ${id}` };
  try {
    writeEntryFile({ ...entry, status });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/** DELETE. The only act of the three that removes anything. Unlinks the single file this
 *  entry ever lived in, then verifies the file is actually gone before reporting success --
 *  since this directory is never indexed by mnem_eblet_store.ts (see this module's header),
 *  there is no sidecar/index entry elsewhere to also clean up: this file was the only copy. */
export function deleteQuery(id: string): StatusChangeResult {
  const entry = findEntryById(id);
  if (!entry) return { ok: false, reason: `no query-capture entry with id ${id}` };
  try {
    unlinkSync(entry.filePath);
    if (existsSync(entry.filePath)) {
      return { ok: false, reason: 'unlink reported success but file still exists' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/** Test/diagnostic helper: true iff the store directory currently contains zero files whose
 *  content matches `needle` (case-insensitive) anywhere in the raw file bytes -- used by this
 *  ticket's DELETE-leaves-nothing test to prove the deleted question text is not merely
 *  hidden from listQueries()/findQueries() but genuinely absent from every file on disk in
 *  this store. */
export function _rawGrepStoreForTests(needle: string): string[] {
  const dir = queryCaptureDir();
  const hits: string[] = [];
  for (const f of listAllFiles(dir)) {
    try {
      const raw = readFileSync(f, 'utf-8');
      if (raw.toLowerCase().includes(needle.toLowerCase())) hits.push(f);
    } catch {
      // unreadable file -- cannot contain a match we can confirm; skip
    }
  }
  return hits;
}

/** Test-only: mtime of the store dir itself, used to sanity-check a test actually wrote
 *  something rather than silently no-op'ing. */
export function _storeDirMtimeForTests(): number | null {
  const dir = queryCaptureDir();
  try {
    return existsSync(dir) ? statSync(dir).mtimeMs : null;
  } catch {
    return null;
  }
}
