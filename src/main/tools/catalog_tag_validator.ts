// catalog_tag_validator.ts -- standalone HARDWIRE-19 catalog-tag validator for MnemosyneC.
//
// BP148, D-BP148-041/BISHOP/tag-enforcement. Founder: "build it in, both for you and for
// Mnemosynec." HARDWIRE-19 (LianaBanyanPlatform\HARDWIRE\HARDWIRE-19_THE_CATALOG_TAGS.md)
// defines three required catalog-tag fields on YAML-frontmatter markdown artifacts:
// metadata.type, catalog.subject (16-value controlled list), catalog.bp -- plus `handle`
// once minted and three optional fields. This module is the MnemosyneC-side sibling of
// LianaBanyanPlatform\tools\catalog_tag_validator.py (the Bishop-side hook uses that one).
// The two cannot literally be one file (different runtimes), so BOTH load the SAME extracted
// vocabulary JSON at runtime -- HARDWIRE\catalog_tags_vocabulary.json -- rather than each
// hardcoding an independent copy that could drift from HARDWIRE-19's own tables (Part 4:
// "this file is the single source of truth... not mirrored, copied into a second registry").
//
// STANDALONE BY DESIGN (mirrors tools/vault_eblet_export.ts in this same directory): does
// NOT import 'electron', does NOT import mnem_eblet_store.ts (currently being edited by
// another SEG per this ticket's own constraint), does NOT import rooting_rule.ts. Zero
// hardcoded C:\Users\Administrator\... path is FORCED -- the vocabulary path is resolved
// from an env var first, falling back to the one concrete location this estate's law
// actually lives at today (see resolveVocabPath()), exactly like vault_eblet_export.ts's
// own resolveVaultRoot()/resolveOutputPath() do for their inputs.
//
// FAIL-OPEN CONTRACT (paramount -- same constraint the Python sibling and the Bishop hook
// both prove): every exported function here returns a result object, NEVER throws past its
// own boundary. A caller that does `const r = validateFile(path); if (r.status !== 'valid')
// console.warn(...)` can never have this module cause an unhandled rejection or a hard crash
// that blocks whatever write triggered the check. See validateFile()'s own try/catch for the
// belt-and-suspenders guarantee.
//
// NOT WIRED INTO ANY WRITE PATH TODAY. Per this ticket's own scope: mnem_eblet_store.ts
// (writeVerifiedEblet() ~L2564, writeRejectedOptionEblet() ~L1039) is off-limits (another SEG
// is editing it) AND, on inspection, does not write YAML-frontmatter markdown at all -- both
// functions append JSONL rows to verified_eblets.jsonl / a rejected-option ledger. There is
// today no MnemosyneC code path that MINTS a new *.eblet.md or memory-topic .md file with a
// --- frontmatter block (vault_eblet_export.ts reads/classifies existing Vault frontmatter
// but its own --commit path also only appends JSONL, never writes markdown). See this
// ticket's return doc (BISHOP_DROPZONE\TAG_ENFORCEMENT_BP148.md) for the precise wiring
// instructions to use WHEN/IF such a write path is added.

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ─── Vocabulary loading ─────────────────────────────────────────────────────

export interface CatalogVocabulary {
  required_fields: string[];
  required_once_minted_fields: string[];
  optional_fields: string[];
  metadata_type: { values: string[] };
  catalog_subject: { values: string[]; definitions?: Record<string, string> };
  catalog_confidence: { values: string[] };
  catalog_status: { values: string[] };
  catalog_bp: { type: string };
  handle: { pattern: string };
}

/** Resolve the vocabulary JSON path: MNEM_CATALOG_VOCAB_PATH env override first (same
 *  override-then-fallback convention vault_eblet_export.ts uses), else the one concrete
 *  location HARDWIRE-19's extraction lives at on this estate today. */
function resolveVocabPath(): string {
  if (process.env.MNEM_CATALOG_VOCAB_PATH) return resolve(process.env.MNEM_CATALOG_VOCAB_PATH);
  return 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\HARDWIRE\\catalog_tags_vocabulary.json';
}

/** Fail-open vocabulary loader. Returns null (never throws) on any failure -- missing file,
 *  malformed JSON, or a deliberately truncated/broken vocabulary source. Callers must treat
 *  null as "cannot validate right now", never as "nothing is tagged." */
export function loadVocabularySafe(): CatalogVocabulary | null {
  try {
    const p = resolveVocabPath();
    if (!existsSync(p)) return null;
    const raw = readFileSync(p, 'utf-8');
    const data = JSON.parse(raw) as CatalogVocabulary;
    if (!data.catalog_subject || !Array.isArray(data.catalog_subject.values)) return null;
    return data;
  } catch {
    return null;
  }
}

// ─── Minimal frontmatter parser (mirrors vault_eblet_export.ts's parseFrontmatter(), extended
//     with nested-block support for metadata:/catalog: two-space-indented children -- the
//     shape HARDWIRE-19-tagged memory files actually use, which vault_eblet_export.ts's flat
//     parser (built for simpler eblet frontmatter) does not need to handle) ─────────────────

type FrontmatterNode = string | Record<string, string>;
export type ParsedFrontmatter = Record<string, FrontmatterNode>;

export function parseFrontmatter(fileContent: string): ParsedFrontmatter | null {
  const lines = fileContent.replace(/\r\n/g, '\n').split('\n');
  if (lines[0]?.trim() !== '---') return null;
  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { endIdx = i; break; }
  }
  if (endIdx === -1) return null;

  const result: ParsedFrontmatter = {};
  let currentParent: string | null = null;
  for (const rawLine of lines.slice(1, endIdx)) {
    if (!rawLine.trim()) continue;
    const indent = rawLine.length - rawLine.trimStart().length;
    const line = rawLine.trim();
    const m = line.match(/^([A-Za-z0-9_.-]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (indent === 0) {
      if (value === '') {
        currentParent = key;
        result[key] = {};
      } else {
        currentParent = null;
        result[key] = value;
      }
    } else if (currentParent && typeof result[currentParent] === 'object') {
      (result[currentParent] as Record<string, string>)[key] = value;
    }
  }
  return result;
}

function getType(fm: ParsedFrontmatter): string | null {
  const metadata = fm['metadata'];
  if (metadata && typeof metadata === 'object' && metadata['type']) return metadata['type'];
  if (typeof fm['type'] === 'string') return fm['type'] as string;
  return null;
}

function getCatalogField(fm: ParsedFrontmatter, name: string): string | null {
  const catalog = fm['catalog'];
  if (catalog && typeof catalog === 'object' && catalog[name]) return catalog[name];
  return null;
}

// ─── Public validator ────────────────────────────────────────────────────────

export type ValidationStatus = 'valid' | 'missing_required_field' | 'invalid_vocabulary_value' | 'error';

export interface ValidationResult {
  status: ValidationStatus;
  field: string | null;
  message: string;
  warnings: string[];
}

const HANDLE_PATTERN = /^sb:[0-9a-f]{32}$/;

export function validateFrontmatter(fm: ParsedFrontmatter, vocab: CatalogVocabulary): ValidationResult {
  const warnings: string[] = [];

  const mdType = getType(fm);
  if (!mdType) {
    return { status: 'missing_required_field', field: 'metadata.type', warnings,
      message: `metadata.type is missing (expected one of ${vocab.metadata_type?.values ?? []})` };
  }
  const allowedTypes = vocab.metadata_type?.values ?? [];
  if (allowedTypes.length && !allowedTypes.includes(mdType)) {
    return { status: 'invalid_vocabulary_value', field: 'metadata.type', warnings,
      message: `metadata.type='${mdType}' is not in ${JSON.stringify(allowedTypes)}` };
  }

  const subjectRaw = getCatalogField(fm, 'subject');
  if (!subjectRaw) {
    return { status: 'missing_required_field', field: 'catalog.subject', warnings,
      message: 'catalog.subject is missing (required, controlled 16-value vocabulary -- see HARDWIRE-19 Part 1)' };
  }
  const allowedSubjects = new Set(vocab.catalog_subject?.values ?? []);
  const subjects = subjectRaw.split(/[,+]/).map((s) => s.trim()).filter(Boolean);
  const badSubjects = subjects.filter((s) => !allowedSubjects.has(s));
  if (badSubjects.length) {
    return { status: 'invalid_vocabulary_value', field: 'catalog.subject', warnings,
      message: `catalog.subject value(s) ${JSON.stringify(badSubjects)} not in the controlled 16-value list` };
  }

  const bpRaw = getCatalogField(fm, 'bp');
  if (!bpRaw) {
    return { status: 'missing_required_field', field: 'catalog.bp', warnings,
      message: 'catalog.bp is missing (required, integer BP number)' };
  }
  if (!/^\d+$/.test(bpRaw)) {
    return { status: 'invalid_vocabulary_value', field: 'catalog.bp', warnings,
      message: `catalog.bp='${bpRaw}' is not an integer` };
  }

  // Optional fields -- validated only when present, never block.
  const confidence = getCatalogField(fm, 'confidence');
  if (confidence && vocab.catalog_confidence?.values?.length && !vocab.catalog_confidence.values.includes(confidence)) {
    warnings.push(`catalog.confidence='${confidence}' not in ${JSON.stringify(vocab.catalog_confidence.values)}`);
  }
  const status = getCatalogField(fm, 'status');
  if (status && vocab.catalog_status?.values?.length && !vocab.catalog_status.values.includes(status)) {
    warnings.push(`catalog.status='${status}' not in ${JSON.stringify(vocab.catalog_status.values)}`);
  }
  const handle = fm['handle'];
  if (typeof handle === 'string' && !HANDLE_PATTERN.test(handle)) {
    warnings.push(`handle='${handle}' does not match sb:<32-hex> shape`);
  }

  return { status: 'valid', field: null, message: 'all required fields present and in vocabulary', warnings };
}

/** Fail-open, top-level entry point: validate a single file on disk by path. NEVER THROWS.
 *  Any failure (unreadable path, malformed content, missing/broken vocabulary source) returns
 *  status:'error' with a human-readable `.message` -- callers must warn and continue, exactly
 *  like the Bishop-side hook does, never block a write on this function's outcome. */
export function validateFile(path: string): ValidationResult {
  try {
    const vocab = loadVocabularySafe();
    if (!vocab) {
      return { status: 'error', field: null, warnings: [],
        message: `vocabulary source unavailable/broken at ${resolveVocabPath()} -- cannot validate, failing open (no block)` };
    }
    let text: string;
    try {
      text = readFileSync(path, 'utf-8');
    } catch (e) {
      return { status: 'error', field: null, warnings: [], message: `could not read file: ${String(e)}` };
    }
    const fm = parseFrontmatter(text);
    if (!fm) {
      return { status: 'missing_required_field', field: 'frontmatter', warnings: [],
        message: 'no parseable --- YAML frontmatter block found (file predates HARDWIRE-19 or is not a tagged artifact)' };
    }
    return validateFrontmatter(fm, vocab);
  } catch (e) {
    return { status: 'error', field: null, warnings: [], message: `unexpected validator error (fail-open): ${String(e)}` };
  }
}

// ─── CLI smoke-test entry point (mirrors vault_eblet_export.ts's own `main()` convention) ────
// Only runs when this file is invoked directly (node dist/main/tools/catalog_tag_validator.js
// <file> [...]), never when imported as a module -- so importing this from a future call site
// never triggers a stray CLI run.
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('usage: node catalog_tag_validator.js <file> [...]');
  } else {
    for (const p of args) {
      const r = validateFile(p);
      console.log(`${r.status.padEnd(26)} ${(r.field ?? '-').padEnd(20)} ${p}`);
      for (const w of r.warnings) console.log(`  (warning) ${w}`);
    }
  }
}
