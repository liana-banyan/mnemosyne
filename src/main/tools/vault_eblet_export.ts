// vault_eblet_export.ts -- standalone, opt-in, DRY-RUN-BY-DEFAULT export tool.
//
// PURPOSE: promote vetted reasoning-TOOL/FACT eblets from the preservation Vault
// (Asteroid-ProofVault\state\eblets\CANON on the Founder's machine, but this file never
// hardcodes that path -- see resolveVaultRoot() below) into the runtime substrate file
// mnem_eblet_store.ts's queryVerifiedEblets()/queryVerifiedEbletsTopical() actually read:
// {userData}/substrate/verified_eblets.jsonl (see mnem_eblet_store.ts ~L844-964 for the
// reader, ~L1390-1484 for the writer shape this tool's --commit path mirrors).
//
// NOT WIRED INTO BOOT: nothing in index.ts / the main-process bootstrap / ai_dispatch_ipc.ts
// imports this file. It is a manually-invoked CLI script only. Grep the repo for
// "vault_eblet_export" before wiring it into anything automatic -- that would defeat the
// opt-in/curated design this tool exists for.
//
// PORTABILITY (mirrors the BP132 Yoke #21 B4 fix already applied to
// resolveEbletStoreRoots() in mnem_eblet_store.ts): this file contains ZERO hardcoded
// C:\Users\Administrator\... (or any other operator-specific) paths. Both the Vault source
// root and the runtime output path are resolved at run time from CLI args / env vars / plain
// OS-standard user-data conventions (APPDATA / XDG_CONFIG_HOME / homedir()) -- never baked
// into shipped code. See resolveVaultRoot() / resolveOutputPath().
//
// STANDALONE BY DESIGN (does not import mnem_eblet_store.ts or 'electron'): mnem_eblet_store.ts
// imports `app` from 'electron' at module load time, which is only a real, usable API inside a
// running Electron process. Requiring that module (transitively pulling in 'electron') from a
// plain `node dist/main/tools/vault_eblet_export.js` invocation is not safe/portable. This tool
// therefore duplicates the small slice of JSONL-write-shape logic it needs (sha256 of
// question+answer, the VerifiedEbletEntry field shape) rather than import that module -- the
// same "duplicate rather than couple to the live Ask/scoring code path" tradeoff
// loadAllVerifiedEblets() documents for its own intra-file duplication in mnem_eblet_store.ts
// (Rule 66 surgical-diff discipline).
//
// CLASS GATE (paramount -- see classifyVaultEblet() below): exports ONLY
//   - Tool eblets: frontmatter `type:` is one of tool | reasoning | methodology | formula
//   - Fact eblets: frontmatter `type: fact`
//   - Component eblets: frontmatter `class: component`
// NEVER exports `type: session-transcript`, NEVER `class: whole_answer`, and NEVER any
// doctrine/governance canon eblet that isn't one of the three allowed shapes above (the
// overwhelming majority of today's Vault: type: canon/reference/feedback/founders-anecdote/
// discovery/index/eblet/chocolate/canon-addendum are all EXCLUDED by this gate as of this
// writing -- confirmed empirically, see the dry-run report). This is a fail-closed ALLOW-LIST,
// not a deny-list: any type/class this tool doesn't recognize is excluded, not exported. When
// in doubt, EXCLUDE.
//
// SCORING GATE: this tool never bypasses the existing readback-off-during-scoring logic.
// Anything it writes under --commit lands as an ordinary verified_eblets.jsonl row -- the same
// file/format every other writer (writeVerifiedEblet in mnem_eblet_store.ts) produces -- so the
// mesh-test/scoring paths that already gate substrate readback off during a scored run
// (queryVerifiedEbletsTopical's exact-match exclusion, and the scoring-mode substrate-off
// switches upstream of it) apply to these rows exactly like any other verified eblet. This tool
// adds no new read path and no bypass.
//
// DRY-RUN BY DEFAULT: printing what WOULD be exported, and WHY every other file was excluded,
// is the only thing this tool does unless --commit is passed explicitly on the command line.
// Without --commit, no write of any kind touches the runtime substrate file or any other file.
//
// USAGE:
//   node dist/main/tools/vault_eblet_export.js --vault <path-to-Vault-CANON-dir> [--out <path>] [--commit]
//   (or set MNEM_VAULT_CANON_ROOT / MNEM_SUBSTRATE_OUTPUT env vars instead of --vault/--out)
//
//   --vault <path>   Required (via flag or MNEM_VAULT_CANON_ROOT env var). Root directory to
//                     scan for *.eblet.md files. No default -- this tool refuses to guess a
//                     Vault location, by design (portability + "never hardcode Administrator").
//   --out <path>     Optional. Path to the runtime verified_eblets.jsonl target. Defaults to
//                     the OS-standard per-user Electron userData location for this app (see
//                     resolveOutputPath()) if omitted. Only read/used when --commit is passed.
//   --commit         Optional. Without it, this tool ONLY prints its dry-run report and exits;
//                     no file is written. With it, qualifying eblets not already present
//                     (by sha256) in the output file are appended.
//   --quiet          Optional. Suppresses the full per-file listing; prints only the summary
//                     table and the qualifying list (if any).

import { readdirSync, statSync, readFileSync, existsSync, appendFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { homedir, platform } from 'os';
import { createHash } from 'crypto';

// ─── CLI / env argument resolution (no hardcoded operator paths anywhere in this file) ───────

interface CliArgs {
  vault: string | null;
  out: string | null;
  commit: boolean;
  quiet: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { vault: null, out: null, commit: false, quiet: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (tok === '--commit') args.commit = true;
    else if (tok === '--quiet') args.quiet = true;
    else if (tok === '--help' || tok === '-h') args.help = true;
    else if (tok === '--vault') args.vault = argv[++i] ?? null;
    else if (tok.startsWith('--vault=')) args.vault = tok.slice('--vault='.length);
    else if (tok === '--out') args.out = argv[++i] ?? null;
    else if (tok.startsWith('--out=')) args.out = tok.slice('--out='.length);
  }
  return args;
}

/** Vault source root: CLI --vault, else MNEM_VAULT_CANON_ROOT env var, else null (no default --
 *  this tool refuses to guess/hardcode a Vault location; see the portability note above). */
function resolveVaultRoot(args: CliArgs): string | null {
  return args.vault ?? process.env.MNEM_VAULT_CANON_ROOT ?? null;
}

/** Runtime output path: CLI --out, else MNEM_SUBSTRATE_OUTPUT env var, else the OS-standard
 *  per-user Electron userData convention for this app ({platform data dir}/amplify-computer/
 *  substrate/verified_eblets.jsonl -- "amplify-computer" is package.json's `name` field, which
 *  is what Electron's app.getPath('userData') derives from absent an explicit app.setName()
 *  override; grepped this repo's main process for app.setName()/setPath('userData', ...) and
 *  found neither, so this mirrors the real runtime path). Built from env vars / homedir() only
 *  -- no operator-specific path segment anywhere in this function. */
function resolveOutputPath(args: CliArgs): string {
  if (args.out) return resolve(args.out);
  if (process.env.MNEM_SUBSTRATE_OUTPUT) return resolve(process.env.MNEM_SUBSTRATE_OUTPUT);

  const appFolderName = 'amplify-computer'; // package.json "name" -- Electron's default app name
  const plat = platform();
  let base: string;
  if (plat === 'win32') {
    base = process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming');
  } else if (plat === 'darwin') {
    base = join(homedir(), 'Library', 'Application Support');
  } else {
    base = process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config');
  }
  return join(base, appFolderName, 'substrate', 'verified_eblets.jsonl');
}

// ─── Recursive *.eblet.md walker (mirrors walkEbletStore() in mnem_eblet_store.ts) ───────────
//
// The Vault contains at least one directory whose NAME itself ends in ".eblet.md" (a nested
// folder wrapping a single file of the same name) -- a flat readdir would silently miss the
// file inside it. Using the same explicit-stack recursive walk as mnem_eblet_store.ts's
// walkEbletStore() handles this correctly and keeps the two walkers' behavior aligned.
function walkVaultEblets(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.name.toLowerCase().endsWith('.eblet.md')) {
        out.push(full);
      }
    }
  }
  return out;
}

// ─── Minimal frontmatter parser ────────────────────────────────────────────────────────────
//
// Vault eblets use a flat `---\nkey: value\n...\n---` YAML frontmatter block (see
// canon_eblets_atomic_knowledge_unit_primitive_bp086.eblet.md's own documented structure).
// Deliberately simple (no YAML library dependency) -- same "explainable over clever" convention
// as the rest of this codebase's hand-rolled parsers (e.g. tokenizeQuestion in
// mnem_eblet_store.ts). Multi-line/nested YAML values are not needed for the fields this tool
// reads (type, class, status, session, description) and are not attempted.
interface VaultFrontmatter {
  raw: Record<string, string>;
  type: string | null;
  klass: string | null; // "class" is a reserved word; stored as `klass`
  status: string | null;
  session: string | null;
  description: string | null;
}

function parseFrontmatter(fileContent: string): VaultFrontmatter | null {
  const lines = fileContent.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return null;
  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { endIdx = i; break; }
  }
  if (endIdx === -1) return null;

  const raw: Record<string, string> = {};
  for (const line of lines.slice(1, endIdx)) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    raw[key] = value;
  }

  return {
    raw,
    type: raw['type'] ?? null,
    klass: raw['class'] ?? null,
    status: raw['status'] ?? null,
    session: raw['session'] ?? null,
    description: raw['description'] ?? null,
  };
}

// ─── Class gate ─────────────────────────────────────────────────────────────────────────────

const TOOL_TYPES = new Set(['tool', 'reasoning', 'methodology', 'formula']);
const FACT_TYPES = new Set(['fact']);
const COMPONENT_CLASSES = new Set(['component']);

// Explicitly-named ban list -- checked FIRST so the report always names these two out loud
// even though they would also fail the allow-list below (belt-and-suspenders + clearer audit
// trail per requirement: "NEVER export whole_answer eblets, NEVER export type:session-transcript").
const BANNED_TYPES = new Set(['session-transcript']);
const BANNED_CLASSES = new Set(['whole_answer']);

type ClassifyResult =
  | { qualifies: true; reason: string; bucket: 'tool' | 'fact' | 'component' }
  | { qualifies: false; reason: string; bucket: 'banned' | 'unparseable' | 'not-allow-listed' };

function classifyVaultEblet(fm: VaultFrontmatter | null): ClassifyResult {
  if (!fm) {
    return { qualifies: false, bucket: 'unparseable', reason: 'no parseable --- YAML frontmatter block found (default-exclude: when in doubt, exclude)' };
  }

  const type = (fm.type ?? '').trim().toLowerCase();
  const klass = (fm.klass ?? '').trim().toLowerCase();

  if (BANNED_TYPES.has(type)) {
    return { qualifies: false, bucket: 'banned', reason: `type:'${fm.type}' is explicitly banned -- never export session-transcript eblets` };
  }
  if (BANNED_CLASSES.has(klass)) {
    return { qualifies: false, bucket: 'banned', reason: `class:'${fm.klass}' is explicitly banned -- never export whole_answer eblets` };
  }

  if (TOOL_TYPES.has(type)) {
    return { qualifies: true, bucket: 'tool', reason: `type:'${fm.type}' is an allow-listed Tool type (Reasoning/Methodology/Formula)` };
  }
  if (FACT_TYPES.has(type)) {
    return { qualifies: true, bucket: 'fact', reason: `type:'${fm.type}' is the allow-listed Fact type` };
  }
  if (COMPONENT_CLASSES.has(klass)) {
    return { qualifies: true, bucket: 'component', reason: `class:'${fm.klass}' is the allow-listed component class` };
  }

  return {
    qualifies: false,
    bucket: 'not-allow-listed',
    reason: `type:'${fm.type ?? '<missing>'}' class:'${fm.klass ?? '<missing>'}' is not a reasoning-tool or fact type -- treated as doctrine/governance/other canon and excluded by default (fail-closed allow-list; when in doubt, exclude)`,
  };
}

// ─── VerifiedEbletEntry-shaped export record (only ever used under --commit) ─────────────────
//
// Mirrors the JSONL shape writeVerifiedEblet() produces in mnem_eblet_store.ts (question /
// answer / provenance / verified / sha256 / timestamp / verdict / class), duplicated here per
// the "standalone, no electron import" note above. Exported rows are stamped class:'component'
// -- these are curated Vault reasoning fragments being surfaced as reusable context, not
// LLM-generated whole-answer Q&A pairs, so they should never win the verbatim-serve exact-match
// race the way a class:'whole_answer' record can (see findNearestBySemanticCode() and the
// component-serve-fix ordering in queryVerifiedEblets(), both in mnem_eblet_store.ts) -- this is
// the same safety property `class:'component'` already provides for every other writer.
//
// NOTE FOR BISHOP: `verified`/`verdict` are stamped true/'verified' directly here rather than
// run through computeHonestVerification() (mnem_eblet_store.ts ~L1351), which this tool
// deliberately does not import (see the "standalone" note above). computeHonestVerification()'s
// three accept classes (concordant / deterministic_compute / coroner_verified) model LLM-answer
// corroboration; a Vault export is a categorically different provenance story -- a human-curated,
// already-ratified (HARD CANON / RATIFIED status in the Vault frontmatter) artifact, not a
// single/ensemble model guess. Flagging this explicitly as a design decision that has not yet
// been exercised against real data (0 eblets qualify today, see the dry-run report) and should
// be reviewed before the first real --commit.
interface ExportRecordPreview {
  question: string;
  answer: string;
  provenance: string;
  verified: true;
  verdict: 'verified';
  class: 'component';
  sha256: string;
  timestamp: number;
  sourcePath: string;
}

function buildExportRecord(fm: VaultFrontmatter, filePath: string, bodyForAnswer: string): ExportRecordPreview {
  const question = fm.description || fm.raw['title'] || filePath;
  const answer = bodyForAnswer;
  const provenance = `vault_export:${fm.type ?? fm.klass ?? 'unknown'}:${fm.session ?? 'unknown-session'}`;
  const sha256 = createHash('sha256').update(question + answer).digest('hex');
  return {
    question,
    answer,
    provenance,
    verified: true,
    verdict: 'verified',
    class: 'component',
    sha256,
    timestamp: Date.now(),
    sourcePath: filePath,
  };
}

// ─── Main ───────────────────────────────────────────────────────────────────────────────────

function printHelp(): void {
  console.log(`
vault_eblet_export.ts -- curated, class-gated export from the preservation Vault into the
runtime substrate. DRY-RUN BY DEFAULT.

Usage:
  node dist/main/tools/vault_eblet_export.js --vault <path> [--out <path>] [--commit] [--quiet]

  --vault <path>   Required (or MNEM_VAULT_CANON_ROOT env var). Vault CANON dir to scan.
  --out <path>     Optional (or MNEM_SUBSTRATE_OUTPUT env var). Defaults to this app's
                    standard {userData}/substrate/verified_eblets.jsonl location.
  --commit         Actually append qualifying eblets to --out. Omit for dry-run (default).
  --quiet          Print only the summary + qualifying list, not every excluded file.
`);
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { printHelp(); return; }

  const vaultRoot = resolveVaultRoot(args);
  if (!vaultRoot) {
    console.error('[vault_eblet_export] ERROR: no Vault root supplied. Pass --vault <path> or set MNEM_VAULT_CANON_ROOT.');
    console.error('[vault_eblet_export] This tool never hardcodes/guesses a Vault location (portability rule).');
    process.exitCode = 1;
    return;
  }
  if (!existsSync(vaultRoot)) {
    console.error(`[vault_eblet_export] ERROR: Vault root does not exist: ${vaultRoot}`);
    process.exitCode = 1;
    return;
  }

  const outPath = resolveOutputPath(args);
  const mode = args.commit ? 'COMMIT (will write)' : 'DRY-RUN (default -- no write)';

  console.log(`[vault_eblet_export] Vault root : ${vaultRoot}`);
  console.log(`[vault_eblet_export] Output file: ${outPath}`);
  console.log(`[vault_eblet_export] Mode       : ${mode}`);
  console.log('');

  const files = walkVaultEblets(vaultRoot);
  console.log(`[vault_eblet_export] Found ${files.length} *.eblet.md file(s) under Vault root.`);
  console.log('');

  const qualifying: Array<{ path: string; fm: VaultFrontmatter; result: ClassifyResult }> = [];
  const excludedByReasonBucket = new Map<string, number>();
  const excludedLines: string[] = [];

  for (const filePath of files) {
    let content: string;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch (e) {
      excludedLines.push(`EXCLUDE  ${filePath}\n         reason: could not read file (${String(e)})`);
      excludedByReasonBucket.set('read-error', (excludedByReasonBucket.get('read-error') ?? 0) + 1);
      continue;
    }
    const fm = parseFrontmatter(content);
    const result = classifyVaultEblet(fm);

    if (result.qualifies) {
      qualifying.push({ path: filePath, fm: fm as VaultFrontmatter, result });
    } else {
      excludedLines.push(`exclude  ${filePath}\n         reason: ${result.reason}`);
      excludedByReasonBucket.set(result.bucket, (excludedByReasonBucket.get(result.bucket) ?? 0) + 1);
    }
  }

  if (!args.quiet) {
    console.log('─── Per-file classification ───────────────────────────────────────────────');
    for (const line of excludedLines) console.log(line);
    for (const q of qualifying) {
      console.log(`QUALIFY  ${q.path}\n         reason: ${q.result.reason}`);
    }
    console.log('');
  }

  console.log('─── Summary ────────────────────────────────────────────────────────────────');
  console.log(`Total *.eblet.md scanned : ${files.length}`);
  console.log(`Qualify for export       : ${qualifying.length}`);
  for (const [bucket, count] of excludedByReasonBucket.entries()) {
    console.log(`Excluded (${bucket})${' '.repeat(Math.max(0, 15 - bucket.length))}: ${count}`);
  }
  console.log('');

  if (qualifying.length === 0) {
    console.log('[vault_eblet_export] Nothing qualifies under the class gate today -- nothing to export.');
    console.log('[vault_eblet_export] (Expected while the Vault holds only doctrine/governance canon +');
    console.log('[vault_eblet_export]  transcripts and no Tool/Fact-typed eblets have been minted yet.)');
    return;
  }

  console.log('─── Qualifying eblets ──────────────────────────────────────────────────────');
  for (const q of qualifying) {
    console.log(`  [${q.result.bucket}] ${q.path}`);
  }
  console.log('');

  if (!args.commit) {
    console.log('[vault_eblet_export] DRY-RUN complete. Re-run with --commit to append the above to the runtime substrate.');
    return;
  }

  // ─── --commit path ──────────────────────────────────────────────────────────────────────
  const outDir = join(outPath, '..');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  let existingShas = new Set<string>();
  if (existsSync(outPath)) {
    try {
      const raw = readFileSync(outPath, 'utf-8');
      for (const line of raw.split('\n')) {
        const t = line.trim();
        if (!t) continue;
        try {
          const parsed = JSON.parse(t) as { sha256?: string };
          if (parsed.sha256) existingShas.add(parsed.sha256);
        } catch { /* skip malformed */ }
      }
    } catch { /* treat as empty */ }
  }

  let written = 0;
  let skippedDuplicate = 0;
  for (const q of qualifying) {
    const record = buildExportRecord(q.fm, q.path, readFileSync(q.path, 'utf-8'));
    if (existingShas.has(record.sha256)) {
      skippedDuplicate++;
      continue;
    }
    const { sourcePath, ...jsonlRecord } = record;
    void sourcePath;
    appendFileSync(outPath, JSON.stringify(jsonlRecord) + '\n', 'utf-8');
    existingShas.add(record.sha256);
    written++;
  }

  console.log(`[vault_eblet_export] COMMIT complete: ${written} written, ${skippedDuplicate} skipped as already-present (sha256 match).`);
}

main();
