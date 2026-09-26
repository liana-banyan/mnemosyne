// seed_loader.ts -- D-BP223-BM04-X033S3-009 STEP 1b
//
// IMPLEMENTS SEED_LOADER.md (BISHOP_DROPZONE\D-BP223-BM04-X033S3-007-PROVE-IT-DATA-LAYER), read
// in full this dispatch -- that file is the design-of-record ("DESIGN ONLY... NOT implemented and
// NOT run" by its own header); this is its first implementation, following its Section 2 exactly.
//
// SHIPPED MANIFEST: src/main/proveit/seed/seed_cards_manifest.json, copied byte-for-byte from
// BISHOP_DROPZONE\D-BP223-BM04-X033S3-007-PROVE-IT-DATA-LAYER\seed_cards_manifest.json.
// sha256 of the shipped copy: 2c318d1949ce21fd471d29b1a6df4c3e61c0558e8cb2d7c8f252ce58e88ebbca
// (computed this dispatch via `sha256sum` on the copy actually written to this path -- verify
// against that command's own output if this file is ever re-copied). 639 rows, 579 distinct qids,
// 60 duplicate-qid rows, per the manifest's own `summary` block (read at load time, never
// hardcoded here beyond this note).
//
// ATTRIBUTION STRING (SEED_LOADER.md Section 2a, spec Section 6): "MnemosyneC seed . MMLU-Pro qid
// N . answered by <model> . checked against the key . <date>". The <model> slot is NEVER a fixed
// "answered by Claude" -- it is derived per row from the manifest's own answering_kind, because
// the manifest itself records that the answering method is not uniform (see the four-row mapping
// in buildAttributionModelSlot() below, copied verbatim from SEED_LOADER.md's own table).
//
// D-BP223-BM04-X033S3-010 Gap 1 UPDATE: the manifest itself still carries no per-row question/
// answer/date text (unchanged, see the paragraph above) -- but `scripts/build_seed_cards.mjs`
// (010) now reads the actual Hollerith card files the manifest's `card_file_path` + `sha256`
// point at (outside this repo, under BISHOP_DROPZONE, read-only), verifies each hash, and
// resolves REAL question/answer/sources/mint-date text into the shipped, static
// `src/main/proveit/seed/seed_cards.json` (639 rows, generated once, committed like the manifest
// -- never regenerated at app-run time, no BISHOP_DROPZONE dependency at runtime). This loader
// now reads THAT file for real content, keyed on the exact same `(qid, source_group)` idempotency
// key as before, and falls back to the pre-010 placeholder behavior (below) ONLY for a row
// seed_cards.json does not cover (e.g. the file is missing/stale) -- never fabricated either way.
// A field seed_cards.json itself could not resolve for a given card (see its own SEED_GAPS.md
// ledger) is null there and rendered as "(not recorded on this card)" here, per the brief's own
// explicit instruction -- "Cards must never show empty question/answer".
//
// DATE (pre-010 fallback path only): the manifest carries NO per-row mint date (verified: its own
// `rows[]` schema has no builtUtc/scoredUtc/date field, only qid/category/card_file_path/sha256/
// answering_model/answering_kind/checked_against_key/correct_against_key/source_group/
// source_dispatch/raw_provenance_tag). Rather than invent a per-row date, the fallback path uses
// the manifest's own `generated_utc` field, clearly labeled as the manifest's generation date
// rather than a per-card mint date. The primary (seed_cards.json) path uses that file's own
// resolved `mintDate` per card instead (see build_seed_cards.mjs's resolveMintDate()).
//
// DUPLICATES (60 of 639 rows, spec/007's own finding): BOTH mints are loaded; neither is picked
// as canonical (007's own [RULING NEEDED], not resolved by any record found). Each duplicate row
// gets its own card, addressed independently (the address includes answeredBy + madeAt +
// category, so the Sonnet and Opus mints of the same qid do not collide), and BOTH cards carry
// `duplicateOfQid = qid` so the renderer can mark the pair visibly (spec Section 6's exact
// instruction). Idempotency key is `(qid, source_group)`, not bare qid, so re-running after a
// duplicate is resolved (007's ruling lands) does not silently re-seed a row already loaded.

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { computeCardAddress, appendCard, readAllCards } from './card_store';
import { seedLoadedMarkerPath } from './userdata_paths';
import { seedAskedBy, isKnownProveItCategory, type ProveItCard, type ProveItCategory } from '../../shared/proveit_contract';

export interface SeedManifestRow {
  qid: number;
  category: string;
  card_file_path: string;
  sha256: string;
  answering_model: string;
  answering_kind: 'flagship_reasoning' | 'code_with_local_model_assist' | 'code_only' | 'code_repaired_from_key' | string;
  checked_against_key: boolean;
  correct_against_key: boolean;
  source_group: string;
  source_dispatch: string;
  raw_provenance_tag: string;
}

export interface SeedManifest {
  generated_utc: string;
  generated_by: string;
  summary: {
    total_rows_in_manifest: number;
    distinct_qids: number;
    duplicate_qid_count: number;
    duplicate_qids: number[];
    [k: string]: unknown;
  };
  rows: SeedManifestRow[];
}

const DEFAULT_MANIFEST_PATH = resolve(__dirname, 'seed', 'seed_cards_manifest.json');
const DEFAULT_SEED_CARDS_PATH = resolve(__dirname, 'seed', 'seed_cards.json');
/** Placeholder shown in place of a truly-absent field -- never an empty string (brief: "Cards
 *  must never show empty question/answer"). */
export const NOT_RECORDED_ON_THIS_CARD = '(not recorded on this card)';

export function loadManifest(path: string = DEFAULT_MANIFEST_PATH): SeedManifest {
  return JSON.parse(readFileSync(path, 'utf-8')) as SeedManifest;
}

/** One row of scripts/build_seed_cards.mjs's output (D-BP223-BM04-X033S3-010 Gap 1). */
export interface SeedCardRecord {
  qid: number;
  category: string;
  categoryNormalized: boolean;
  question: string | null;
  questionConfidence: string;
  options: string[];
  answer: string | null;
  sources: Array<{ label: string; url: string | null }>;
  answeringModel: string;
  answeringKind: string;
  checkedAgainstKey: boolean;
  correctAgainstKey: boolean;
  mintDate: string;
  mintDateIsManifestFallback: boolean;
  duplicateOfQid: number | null;
  sourceGroup: string;
  cardFilePath: string;
  sha256: string;
}

export interface SeedCardsFile {
  generatedUtc: string;
  generatedBy: string;
  sourceManifestGeneratedUtc: string;
  cardCount: number;
  cards: SeedCardRecord[];
}

/** Returns null (never throws) when seed_cards.json hasn't been generated yet -- callers fall
 *  back to the pre-010 placeholder behavior in that case, exactly as before this dispatch. */
export function loadSeedCardsFile(path: string = DEFAULT_SEED_CARDS_PATH): SeedCardsFile | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as SeedCardsFile;
  } catch {
    return null;
  }
}

/** SEED_LOADER.md Section 2b: MMLU-Pro's 14 top-level categories are exactly the seed list;
 *  "computer science" (space) normalizes to the picker's "computer-science" slug, and any
 *  professional_-prefixed sub-category variant normalizes to its parent -- unknown categories
 *  are logged and skipped, never guessed. */
export function normalizeSeedCategory(raw: string): ProveItCategory | null {
  const spaced = String(raw ?? '').trim().toLowerCase();
  const slug = spaced.replace(/[\s_]+/g, '-');
  if (isKnownProveItCategory(slug)) return slug;
  // professional_law / professional-law -> law; any other professional_* -> try the remainder.
  const stripped = slug.replace(/^professional-/, '');
  if (isKnownProveItCategory(stripped)) return stripped;
  return null;
}

/** SEED_LOADER.md Section 2a's four-row table, copied verbatim. */
export function buildAttributionModelSlot(row: SeedManifestRow): string {
  switch (row.answering_kind) {
    case 'flagship_reasoning':
      return row.answering_model; // e.g. "Claude Sonnet 5" / "Claude Opus"
    case 'code_with_local_model_assist':
      return 'a local model architect (card built with model assistance), replayed by code at zero model calls';
    case 'code_only':
      return 'the MnemosyneC card executor (plain code, zero model calls -- not an AI-model answer)';
    case 'code_repaired_from_key':
      return 'the MnemosyneC card executor, repaired against the answer key after an initial miss';
    default:
      // Never seen in the shipped manifest today; fails safe to the row's own literal
      // answering_model string rather than a fabricated label.
      return row.answering_model;
  }
}

export function buildAttributionLine(row: SeedManifestRow, generatedUtc: string): string {
  const modelSlot = buildAttributionModelSlot(row);
  const checkedNote = row.checked_against_key ? 'checked against the key' : 'not checked against the key';
  return `MnemosyneC seed . MMLU-Pro qid ${row.qid} . answered by ${modelSlot} . ${checkedNote} . ${generatedUtc.slice(0, 10)}`;
}

export interface SeedLoadResult {
  attemptedRows: number;
  loadedCards: number;
  alreadyLoaded: number;
  skippedUnknownCategory: Array<{ qid: number; category: string; sourceGroup: string }>;
  duplicateQidsLoaded: number[];
}

function seedSourceKey(row: SeedManifestRow): string {
  return `MMLU-Pro qid ${row.qid} . ${row.source_group}`;
}

/** Idempotent: upserts on (qid, source_group) via each card's own seedSource field -- re-running
 *  after later waves land only inserts rows not already in the store (SEED_LOADER.md Section 2d).
 *  Never seeds a row whose category cannot be normalized to one of the 14 (logged, not guessed). */
export function loadSeedCards(manifestPath: string = DEFAULT_MANIFEST_PATH, seedCardsPath: string = DEFAULT_SEED_CARDS_PATH): SeedLoadResult {
  const manifest = loadManifest(manifestPath);
  const seedCardsFile = loadSeedCardsFile(seedCardsPath);
  const seedRecordsByKey = new Map<string, SeedCardRecord>();
  if (seedCardsFile) {
    for (const rec of seedCardsFile.cards) seedRecordsByKey.set(`MMLU-Pro qid ${rec.qid} . ${rec.sourceGroup}`, rec);
  }
  const existing = readAllCards();
  const existingSeedSources = new Set(existing.filter((c) => c.isSeed && c.seedSource).map((c) => c.seedSource as string));

  const result: SeedLoadResult = { attemptedRows: manifest.rows.length, loadedCards: 0, alreadyLoaded: 0, skippedUnknownCategory: [], duplicateQidsLoaded: [] };
  const duplicateQidSet = new Set(manifest.summary.duplicate_qids ?? []);

  for (const row of manifest.rows) {
    const seedSource = seedSourceKey(row);
    if (existingSeedSources.has(seedSource)) {
      result.alreadyLoaded += 1;
      continue;
    }
    const record = seedRecordsByKey.get(seedSource);
    // D-BP223-BM04-X033S3-010 Gap 1: category prefers the resolved record's own normalized
    // category (categoryNormalized true) -- identical value to normalizeSeedCategory(row.category)
    // whenever both exist, since build_seed_cards.mjs runs the same 14-category mapping; this is
    // just one fewer redundant computation when the record is present.
    const category = (record && record.categoryNormalized) ? (record.category as ProveItCategory) : normalizeSeedCategory(row.category);
    if (!category) {
      result.skippedUnknownCategory.push({ qid: row.qid, category: row.category, sourceGroup: row.source_group });
      continue;
    }
    const madeAt = record?.mintDate ?? manifest.generated_utc;
    const attribution = buildAttributionLine(row, madeAt);
    // Gap 1: real question/answer/sources text when seed_cards.json resolved them; the brief's
    // own explicit fallback ("if a field is truly absent... shows '(not recorded on this card)'")
    // otherwise -- never a fabricated sentence, never a silently empty field.
    const question = record?.question ?? NOT_RECORDED_ON_THIS_CARD;
    const answer = record?.answer ?? NOT_RECORDED_ON_THIS_CARD;
    const sources = (record?.sources && record.sources.length)
      ? record.sources
      : [{ label: `Hollerith card ${row.card_file_path}`, url: null }];
    const card: ProveItCard = {
      address: computeCardAddress({ question: `seed:${row.qid}:${row.source_group}`, answer: attribution, category, answeredBy: 'mnemosynec_seed', madeAt }),
      category,
      question,
      answer,
      askedBy: seedAskedBy(),
      answeredBy: 'mnemosynec_seed',
      madeAt,
      validUntil: null,
      validityClass: 'forever',
      sources,
      supersedes: null,
      supersededBy: null,
      isSeed: true,
      seedSource,
      seedAttribution: attribution,
      duplicateOfQid: record?.duplicateOfQid ?? (duplicateQidSet.has(row.qid) ? row.qid : null),
      publishedAt: madeAt, // seed cards are pre-published (SEED_LOADER.md 2.)
      unpublishedAt: null,
      voteCount: 0,
      queuedForSubstrate: false,
      answerMethod: 'seed',
      unsourced: sources.length === 0,
    };
    appendCard(card);
    existingSeedSources.add(seedSource);
    result.loadedCards += 1;
    if (card.duplicateOfQid !== null) result.duplicateQidsLoaded.push(row.qid);
  }
  return result;
}

/** Materializes seed cards on first run only (spec Section 6's "day one" pre-load), then never
 *  again automatically -- loadSeedCards() itself is idempotent regardless, but this marker avoids
 *  re-scanning the whole card store on every app start once seeding is done. Safe to delete the
 *  marker file to force a re-check (e.g. after a new wave's manifest ships). */
export function ensureSeedCardsLoadedOnce(manifestPath: string = DEFAULT_MANIFEST_PATH): SeedLoadResult | null {
  const marker = seedLoadedMarkerPath();
  if (existsSync(marker)) return null;
  const result = loadSeedCards(manifestPath);
  writeFileSync(marker, JSON.stringify({ loadedAt: new Date().toISOString(), ...result }, null, 2), 'utf-8');
  return result;
}

export { DEFAULT_MANIFEST_PATH, DEFAULT_SEED_CARDS_PATH };
