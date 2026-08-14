#!/usr/bin/env node
// backfill_mmlu_pro_origin_src.mjs -- D-BP154-030 AMENDMENT/BISHOP-SEG/S30/seg-humannuance
//
// FOUNDER, THIS TURN, VERBATIM: "make the src field this step would need., and YES we need to
// enrich the corpus with origin metadata... which is what eblets ARE." Two artifacts, not one:
//
//   1. THE INDEX -- `origin_src` backfilled onto the bundled corpus record itself (resources/
//      mmlu_pro_bundled/questions.jsonl). Fast, local, deterministic, zero network at Composer
//      run time. This is what HumanNuance:1 (src/main/liana_cycle/library/human_nuance_step.ts)
//      actually reads.
//   2. THE THING -- a provenance "origin eblet" per question, written to a DEDICATED store (this
//      script proposes and uses resources/mmlu_pro_bundled/origin_provenance/, NOT
//      Asteroid-ProofVault/state/eblets/CANON/ -- that tree is sacrosanct, LB-GOLD-0399, and holds
//      RATIFIED canon; these are machine-minted data records and must never be mixed in).
//
// LAW 9, cited by the Founder this turn: THE INDEX IS NOT THE THING IT INDEXES
// (WALL_SHEET_CELPANE_AND_AUTOPILOT.html). The index alone is not built to stand in for the eblet;
// both are written, separately, by this one script (one script, two outputs, still ONE commit for
// "corpus/eblet enrichment" per the Founder's own commit split -- the HumanNuance:1 step itself is
// a SEPARATE commit).
//
// SCOPE, PER THE FOUNDER'S OWN AMENDMENT -- DO NOT FETCH 12,000 ITEMS ON THE FIRST PASS:
//   1. Prove the mechanism on qid 98 (campaign question_id 98, MMLU-Pro question_id/source_id
//      5723, src ori_mmlu-high_school_geography, origin cais/mmlu high_school_geography test
//      offset 100).
//   2. Then the standing 20: HARDWIRE-01_ANSWERING_PIPELINE.md line 242,
//      "1 7 14 20 27 33 40 46 53 59 66 72 79 85 92 98 105 111 118 124" -- CAMPAIGN question_ids,
//      not MMLU-Pro's own. The mapping IS already on disk: every row in questions.jsonl already
//      carries `source_id`, which IS the MMLU-Pro `question_id` (verified live this ticket for all
//      20 -- e.g. campaign qid 98 -> source_id "5723"). No guessing required.
//   3. A full-corpus cost estimate is reported by this script's own summary (requests/time
//      actually measured on these 20, extrapolated), never run at scale by this script.
//
// NEVER THE ANSWER KEY (D-BP153-003, runtime stays blind). Every fetched row's `answer` and
// `answer_index` field is read ONLY to confirm it is present-and-then-discarded -- never copied
// into either output artifact. Grep both output files after this script runs; neither may contain
// an `answer` or `answer_index` key. This is enforced in code below (deleteAnswerFields()), not
// merely promised in a comment.
//
// OFFSET IS AN OBSERVATION, NOT A LAW (Founder, this amendment: "verify that offset relation per
// block rather than trusting it"). `question_id - 155` is used only as a STARTING GUESS for the
// MMLU-Pro fetch; every result is verified by checking the returned row's own `question_id` field
// matches what was asked for, and the search window expands outward (in whole 100-row blocks) if
// the guess misses, rather than ever trusting the arithmetic blindly.
//
// ORIGIN LOOKUP (cais/mmlu) is attempted only when `src` states the `ori_mmlu-<subject>` shape
// (a literal, stated prefix -- mechanical string-split, HARDWIRE-22 safe, no inference). The
// origin row is matched by EXACT (whitespace-normalized) question-text identity against the
// MMLU-Pro row's own `question` field -- both texts are already in hand from stated fields; no
// judgment call, no fuzzy matching.
//
// "WHETHER THE SINGLE-ANSWER PROPERTY SURVIVED AUGMENTATION" is NOT computed by this script for
// every item. Determining it (whether each ADDED distractor is also wrong for the ORIGIN's own
// stated reason) is a content judgment requiring its own sourced extraction per item -- exactly
// the kind of act HARDWIRE-22 reserves for a live "ask a source" step, not a batch script with no
// query budget. For campaign qid 98 alone, this field is filled from the ALREADY-OBTAINED, cited
// finding on disk (BISHOP_DROPZONE/BP154_QID98_RESOLVED_THE_AUGMENTATION_DEFECT.md -- itself
// sourced to a live authority quote, not this script's own claim). Every other item in the standing
// 20 is written with `singleAnswerPropertySurvived: null` and an honest `note` naming why -- never
// guessed, never silently defaulted to true or false.

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const REPO_ROOT = process.cwd();
const BUNDLE_PATH = join(REPO_ROOT, 'resources', 'mmlu_pro_bundled', 'questions.jsonl');
const PROVENANCE_DIR = join(REPO_ROOT, 'resources', 'mmlu_pro_bundled', 'origin_provenance');
const HF_BASE = 'https://datasets-server.huggingface.co/rows';
const BLOCK_LEN = 100;
const MAX_BLOCKS_TRIED = 8; // 8 x 100 = 800 rows scanned outward before giving up on one lookup

// Founder's own standing question set, HARDWIRE-01_ANSWERING_PIPELINE.md line 242, verbatim.
const STANDING_20 = [1, 7, 14, 20, 27, 33, 40, 46, 53, 59, 66, 72, 79, 85, 92, 98, 105, 111, 118, 124];

function sha256File(path) {
  if (!existsSync(path)) return null;
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function utcStamp() {
  return new Date().toISOString().replace(/[:.]/g, '').replace('Z', 'Z');
}

/** Mutates nothing -- returns a NEW object with `answer`/`answer_index` removed, and reports
 *  whether either was present, so the caller can log "discarded" honestly rather than silently. */
function deleteAnswerFields(row) {
  const {
    answer, answer_index: answerIndex, _row_idx: rowIdx, ...rest
  } = row;
  return {
    clean: rest, hadAnswer: answer !== undefined, hadAnswerIndex: answerIndex !== undefined, rowIdx,
  };
}

/** Rule 66 ("version, never overwrite") applied to the eblet store itself -- the Founder's own
 *  amendment this ticket: "a corrected origin eblet is a NEW record that supersedes, never an edit
 *  over the old one. That property is the whole reason the store stays trustworthy while remaining
 *  malleable." If a file already exists at `path`, it is copied to a `.superseded.<UTC-ts>` sibling
 *  BEFORE the new content is written -- so a later reader can always find every prior version, and
 *  no eblet is ever silently replaced in place. */
function writeVersioned(path, content) {
  if (existsSync(path)) {
    const supersededPath = `${path}.superseded.${utcStamp()}`;
    copyFileSync(path, supersededPath);
    console.log(`  (superseded prior version -> ${supersededPath})`);
  }
  writeFileSync(path, content, 'utf8');
}

let requestCount = 0;
let totalRequestMs = 0;

async function fetchBlock(dataset, config, split, offset, attempt = 0) {
  const url = `${HF_BASE}?dataset=${encodeURIComponent(dataset)}&config=${encodeURIComponent(config)}&split=${encodeURIComponent(split)}&offset=${offset}&length=${BLOCK_LEN}`;
  const t0 = Date.now();
  requestCount += 1;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  totalRequestMs += Date.now() - t0;
  // D-BP154-030 AMENDMENT bugfix: the public datasets-server rate-limits this script's own
  // back-to-back requests (measured live this ticket, HTTP 429 mid-run) -- a 429 is a transient
  // capacity signal, not "this row does not exist"; retried with a short backoff (bounded, never
  // infinite) rather than silently reported as "not found", which would have been exactly the
  // "absence read as denial" error this estate's own HARDWIRE-22 sibling rule forbids elsewhere.
  if (res.status === 429 && attempt < 4) {
    const waitMs = 2000 * (attempt + 1);
    console.log(`    (429 rate-limited, waiting ${waitMs}ms before retry ${attempt + 1}/4...)`);
    await new Promise((r) => { setTimeout(r, waitMs); });
    return fetchBlock(dataset, config, split, offset, attempt + 1);
  }
  if (!res.ok) {
    return { ok: false, status: res.status, rows: [] };
  }
  const body = await res.json();
  // D-BP154-030 AMENDMENT 2 bugfix: cais/mmlu's own column for the option list is named `choices`,
  // NOT `options` (TIGER-Lab/MMLU-Pro's own column name) -- a real, stated schema difference between
  // the two datasets, verified live this ticket via each dataset's own `features` array. Normalized
  // here, at the one fetch boundary, to `options` for every downstream consumer -- never silently
  // dropped. `row_idx` (the row's own literal position) is preserved per-row for exact citability,
  // not just the block's start offset.
  const rows = Array.isArray(body.rows) ? body.rows.map((r) => {
    const row = { ...r.row };
    if (row.choices !== undefined && row.options === undefined) {
      row.options = row.choices;
      delete row.choices;
    }
    return { ...row, _row_idx: r.row_idx };
  }) : [];
  return { ok: true, status: res.status, rows, numRowsTotal: body.num_rows_total };
}

/** Verified, block-expanding lookup by MMLU-Pro's own `question_id` field -- the offset guess is a
 *  STARTING POINT only (Founder's own instruction this amendment: never trust it blindly). Tries
 *  the guessed block, then alternates outward by whole blocks until found or MAX_BLOCKS_TRIED is
 *  exhausted. */
async function findMmluProRowById(targetQuestionId, guessedOffset) {
  const tried = new Set();
  const offsets = [];
  const base = Math.max(0, Math.floor(guessedOffset / BLOCK_LEN) * BLOCK_LEN);
  for (let i = 0; i < MAX_BLOCKS_TRIED; i++) {
    const fwd = base + i * BLOCK_LEN;
    const back = base - i * BLOCK_LEN;
    if (i === 0) { offsets.push(fwd); } else { offsets.push(fwd, back); }
  }
  for (const off of offsets) {
    if (off < 0 || tried.has(off)) continue;
    tried.add(off);
    // eslint-disable-next-line no-await-in-loop -- sequential, bounded (<=8 blocks), a scan not a fan-out.
    const block = await fetchBlock('TIGER-Lab/MMLU-Pro', 'default', 'test', off);
    if (!block.ok) continue;
    const hit = block.rows.find((r) => r.question_id === targetQuestionId);
    if (hit) return { row: hit, offsetUsed: off, rowIdx: hit._row_idx, blocksScanned: tried.size };
  }
  return { row: null, offsetUsed: null, rowIdx: null, blocksScanned: tried.size };
}

const normText = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** Origin lookup for an `ori_mmlu-<subject>` src -- scans cais/mmlu's own `<subject>` test split
 *  in whole blocks, matching by EXACT normalized question text (a stated field already in hand,
 *  no judgment). Bounded scan (MAX_BLOCKS_TRIED blocks = up to 800 rows); most MMLU per-subject
 *  test splits are well under that. */
async function findOriginRow(subject, questionText) {
  const target = normText(questionText);
  let offset = 0;
  let blocksScanned = 0;
  for (let i = 0; i < MAX_BLOCKS_TRIED; i++) {
    // eslint-disable-next-line no-await-in-loop -- sequential bounded scan, same discipline as findMmluProRowById.
    const block = await fetchBlock('cais/mmlu', subject, 'test', offset);
    blocksScanned += 1;
    if (!block.ok) return { row: null, offsetUsed: null, blocksScanned, error: `HTTP ${block.status}` };
    const hit = block.rows.find((r) => normText(r.question) === target);
    if (hit) return { row: hit, offsetUsed: offset, rowIdx: hit._row_idx, blocksScanned };
    if (block.rows.length < BLOCK_LEN) break; // reached end of split, nothing left to scan
    offset += BLOCK_LEN;
  }
  return { row: null, offsetUsed: null, rowIdx: null, blocksScanned, error: 'not found within scanned window' };
}

/** Pure structural diff -- no judgment. Compared by normalized-text identity, the same mechanical
 *  discipline HARDWIRE-22 already requires of every span/kind comparison in this estate. */
function diffOptionSets(originOptions, augmentedOptions) {
  const originNorm = originOptions.map(normText);
  const augNorm = augmentedOptions.map(normText);
  const addedIdx = [];
  augNorm.forEach((a, i) => { if (!originNorm.includes(a)) addedIdx.push(i); });
  const removedIdx = [];
  originNorm.forEach((o, i) => { if (!augNorm.includes(o)) removedIdx.push(i); });
  return {
    added: addedIdx.map((i) => augmentedOptions[i]),
    removedFromOrigin: removedIdx.map((i) => originOptions[i]),
    originCount: originOptions.length,
    augmentedCount: augmentedOptions.length,
    countChange: augmentedOptions.length - originOptions.length,
  };
}

// The one already-obtained, cited finding this script is allowed to encode directly (never
// re-derives it) -- BISHOP_DROPZONE/BP154_QID98_RESOLVED_THE_AUGMENTATION_DEFECT.md, itself sourced
// to a live authority quote obtained 2026-08-12, not this script's own claim.
const QID98_SURVIVED_FINDING = {
  campaignQuestionId: 98,
  survived: false,
  citedAt: 'LianaBanyanPlatform/BISHOP_DROPZONE/BP154_QID98_RESOLVED_THE_AUGMENTATION_DEFECT.md',
  quote:
    'Options A (South America), C (North Africa), F (Central Asia), G (Arctic Circle), H (Amazon '
    + 'Rainforest), and I (Sahara Desert) are all NOT considered among the world\'s most densely '
    + 'populated regions.',
  quoteObtainedAt: '2026-08-12 (operation query, recorded before the augmentation defect was known)',
};

async function main() {
  if (!existsSync(BUNDLE_PATH)) {
    console.error(`Bundle not found: ${BUNDLE_PATH}`);
    process.exit(1);
  }
  mkdirSync(PROVENANCE_DIR, { recursive: true });

  const beforeHash = sha256File(BUNDLE_PATH);
  console.log(`BEFORE hash (questions.jsonl): ${beforeHash}`);

  const lines = readFileSync(BUNDLE_PATH, 'utf8').split(/\r?\n/).filter(Boolean);
  const rows = lines.map((l) => JSON.parse(l));
  const byId = new Map(rows.map((r) => [r.question_id, r]));

  const results = [];
  for (const campaignId of STANDING_20) {
    const bundleRow = byId.get(campaignId);
    if (!bundleRow) {
      results.push({ campaignQuestionId: campaignId, ok: false, error: 'not present in bundled corpus' });
      continue;
    }
    const mmluProId = Number(bundleRow.source_id);
    console.log(`[${campaignId}] source_id=${mmluProId} category=${bundleRow.category} -- fetching MMLU-Pro row...`);
    const guess = mmluProId - 155;
    // eslint-disable-next-line no-await-in-loop -- 20 items, sequential, polite to the free public API.
    const {
      row: mpRow, offsetUsed, rowIdx: mpRowIdx, blocksScanned,
    } = await findMmluProRowById(mmluProId, guess);
    if (!mpRow) {
      results.push({
        campaignQuestionId: campaignId, mmluProQuestionId: mmluProId, ok: false,
        error: `MMLU-Pro row not found after scanning ${blocksScanned} block(s) around guessed offset ${guess}`,
      });
      continue;
    }
    const { clean: mpClean, hadAnswer, hadAnswerIndex } = deleteAnswerFields(mpRow);
    const src = typeof mpClean.src === 'string' ? mpClean.src : null;
    console.log(`  -> found at offset ${offsetUsed} (guess was ${guess}, ${blocksScanned} block(s) scanned). src=${src}. answer field discarded=${hadAnswer}, answer_index discarded=${hadAnswerIndex}`);

    let originRecord = null;
    if (src && src.startsWith('ori_mmlu-')) {
      const subject = src.slice('ori_mmlu-'.length);
      console.log(`  -> src is ori_mmlu-* -- looking up origin cais/mmlu config=${subject}...`);
      // eslint-disable-next-line no-await-in-loop -- see above.
      const originLookup = await findOriginRow(subject, mpClean.question);
      if (originLookup.row) {
        const { clean: originClean, hadAnswer: originHadAnswer, hadAnswerIndex: originHadAnswerIndex } = deleteAnswerFields(originLookup.row);
        console.log(`  -> origin found at cais/mmlu/${subject} row_idx=${originLookup.rowIdx} (block offset ${originLookup.offsetUsed}, ${originLookup.blocksScanned} block(s) scanned). options=[${(originClean.options || []).length}]. answer discarded=${originHadAnswer}, answer_index discarded=${originHadAnswerIndex}`);
        originRecord = {
          dataset: 'cais/mmlu', config: subject, split: 'test',
          rowIdx: originLookup.rowIdx, blockOffsetUsed: originLookup.offsetUsed, blocksScanned: originLookup.blocksScanned,
          question: originClean.question, options: originClean.options,
          answerFieldsDiscarded: originHadAnswer || originHadAnswerIndex,
        };
      } else {
        console.log(`  -> origin lookup FAILED: ${originLookup.error}`);
        originRecord = { dataset: 'cais/mmlu', config: subject, split: 'test', found: false, error: originLookup.error };
      }
    } else {
      console.log(`  -> src does not start with "ori_mmlu-" -- origin dataset for this src family not resolved in this pass`);
    }

    const delta = originRecord && originRecord.options
      ? diffOptionSets(originRecord.options, mpClean.options)
      : null;

    const survived = campaignId === QID98_SURVIVED_FINDING.campaignQuestionId
      ? {
        singleAnswerPropertySurvived: QID98_SURVIVED_FINDING.survived,
        citedAt: QID98_SURVIVED_FINDING.citedAt,
        quote: QID98_SURVIVED_FINDING.quote,
        quoteObtainedAt: QID98_SURVIVED_FINDING.quoteObtainedAt,
      }
      : {
        singleAnswerPropertySurvived: null,
        note: 'not determined this pass -- requires a per-item sourced query (whether each ADDED '
          + 'distractor is also wrong for the origin\'s own stated reason), a content judgment '
          + 'this batch script does not make; only campaign qid 98 has an already-obtained, cited '
          + 'answer (see BP154_QID98_RESOLVED_THE_AUGMENTATION_DEFECT.md).',
      };

    // D-BP154-030 AMENDMENT 3, NEW. Founder: "whether the answer was derivable from the question's
    // own terms, or only via provenance... those must be scored separately and never allowed to
    // inflate an accuracy figure -- agreeing with a key by lookup is not correctness." Same
    // treatment as `singleAnswerPropertySurvived`: only qid 98 has an already-obtained, cited
    // answer (BP154_QID98_RESOLVED_THE_AUGMENTATION_DEFECT.md's own finding -- the Founder's
    // hand-worked frame used the ORIGIN's four-option set, not the augmented nine; the machine
    // could not reach A from the question's own terms and the augmented option list alone, only by
    // reading the origin's own narrower frame). Every other item: null/pending, same honesty
    // discipline -- never guessed.
    const derivable = campaignId === QID98_SURVIVED_FINDING.campaignQuestionId
      ? {
        answerDerivableFromQuestionTermsAlone: false,
        derivableNote: 'the augmented (9-option) question genuinely has multiple defensible answers '
          + 'from its own terms alone (see singleAnswerPropertySurvived above) -- the unique answer '
          + 'is reachable only via the ORIGIN\'s own narrower option set (provenance), not from the '
          + 'question and its stated options in isolation.',
        derivableCitedAt: QID98_SURVIVED_FINDING.citedAt,
      }
      : {
        answerDerivableFromQuestionTermsAlone: null,
        derivableNote: 'not determined this pass -- same content-judgment boundary as '
          + 'singleAnswerPropertySurvived above; requires a per-item sourced determination.',
      };

    const eblet = {
      eblet_kind: 'mmlu_pro_origin_provenance',
      // D-BP154-030 AMENDMENT 2 -- Founder, this turn: "we do have multiple TYPES of eblets? With
      // graduation and matriculation into other more permanent forms of eblet... as we only
      // append, not destroy, so refinement is welcome." The live strata ladder (librarian MCP:
      // strata_ascend/strata_descend/strata_promote/strata_by_stratum/strata_audit) is
      // sand -> soil -> sediment -> sandstone -> limestone -> granite -> bedrock. This record is
      // machine-minted, single-pass, and verified by only ONE fetch per fact -- exactly what
      // `sand` means: real, on the record, not yet corroborated a second way. PROPOSED (not
      // decreed -- ratifying the ladder's rules is a Founder decision) matriculation criteria,
      // stated plainly so a reader knows what would move this record up a stratum:
      //   sand -> soil:      the origin option set reconfirmed by a SECOND independent fetch
      //                       (a different request, same dataset/config/offset, same result).
      //   soil -> sediment:  the augmentation delta cross-checked -- every ADDED option verified
      //                       absent from the origin set by a human or a second script pass, not
      //                       just this run's own single diff.
      //   sediment -> sandstone: the `src` value itself corroborated -- the origin dataset
      //                       confirmed to actually CONTAIN this item (this record's own
      //                       question-text match verified independently, e.g. by a second
      //                       matching strategy or a human read of both texts side by side).
      //   sandstone and above: not proposed here -- those strata (limestone/granite/bedrock) read,
      //                       in the ladder's own naming, as increasingly durable/consensus forms;
      //                       assigning this record's own path into them is a Founder ruling this
      //                       ticket does not make.
      stratum: 'sand',
      matriculationCriteria: {
        proposedNotRatified: true,
        'sand->soil': 'origin option set reconfirmed by a second, independent fetch',
        'soil->sediment': 'augmentation delta cross-checked (every added option independently verified absent from the origin set)',
        'sediment->sandstone': "the src value's own claim corroborated -- the origin dataset confirmed to actually contain this item, by a second, independent matching method",
      },
      campaignQuestionId: campaignId,
      mmluProQuestionId: mmluProId,
      // D-BP154-030 AMENDMENT 4 (FD-BP154-08b) -- Founder: "tags... are inclusive and not mutually
      // exclusive, so no loss if we make a new category of the same type of thing accidentally."
      // `category` (single string) is kept for human-readable continuity with the bundled corpus's
      // own field, but is no longer the record's only home for this fact -- `categoryTags` is a
      // LIST from the start, even though every item today carries exactly one tag (the corpus's own
      // `category` field has only ever had one value per row). A future pass that wants to tag this
      // item into a SECOND category can append to the list losslessly; no migration of THIS record
      // is required to do that. Does not migrate LianaBanyanPlatform/eval/mmlu_pro/
      // substrate_domain_ref_cache.jsonl's own single-valued `domain` field (out of this ticket's
      // scope -- that store is a sibling, read-only reference here, never written by this script).
      category: bundleRow.category,
      categoryTags: [bundleRow.category],
      src,
      mmluProFetch: {
        dataset: 'TIGER-Lab/MMLU-Pro', config: 'default', split: 'test',
        rowIdx: mpRowIdx, blockOffsetUsed: offsetUsed, blocksScanned, offsetGuessUsed: guess,
        offsetGuessWasCorrect: offsetUsed === Math.floor(guess / BLOCK_LEN) * BLOCK_LEN,
        question: mpClean.question, augmentedOptions: mpClean.options,
        answerFieldsDiscarded: hadAnswer || hadAnswerIndex,
      },
      origin: originRecord,
      augmentationDelta: delta,
      ...survived,
      ...derivable,
      builtAt: new Date().toISOString(),
      builtBy: 'scripts/backfill_mmlu_pro_origin_src.mjs (D-BP154-030 amendment 3)',
    };
    // Rule 66 applied to the eblet store itself (Founder, this amendment: "append, not destroy" --
    // a correction is a NEW record superseding the old one, never an in-place edit).
    const outPath = join(PROVENANCE_DIR, `origin_eblet_qid${campaignId}.json`);
    writeVersioned(outPath, JSON.stringify(eblet, null, 2) + '\n');
    results.push({ campaignQuestionId: campaignId, ok: true, src, eblet: outPath });

    // Backfill the INDEX field onto the in-memory bundle row -- the eblet is the THING; this is
    // only the fast pointer to it (Law 9: the index is not the thing it indexes).
    if (src) bundleRow.origin_src = src;
  }

  // Versioned sibling BEFORE the in-place rewrite (Rule 66: version, never overwrite).
  const backupPath = `${BUNDLE_PATH}.superseded.${utcStamp()}`;
  copyFileSync(BUNDLE_PATH, backupPath);
  console.log(`Backup written: ${backupPath}`);

  writeFileSync(BUNDLE_PATH, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
  const afterHash = sha256File(BUNDLE_PATH);
  console.log(`AFTER hash (questions.jsonl): ${afterHash}`);

  // MANIFEST INTEGRITY FIX (found while building this ticket, not asked for but real): manifest.json
  // stamps the bundle's sha256 onto every receipt "so a receipt can be verified against the exact
  // corpus version it was scored against" (one_click_mmlu_pro.ts's own doc comment,
  // `corpusManifestSha256`). Backfilling `origin_src` changes questions.jsonl's own bytes -- leaving
  // the manifest's sha256 stale would make every future receipt's own self-check silently wrong.
  // Content (totalQuestions/categories/domainsSkippedFromLiveCorpus) is UNCHANGED (no re-sampling,
  // no regeneration via generate_mmlu_pro_bundle.mjs, which would have destroyed this backfill) --
  // only the sha256 is refreshed to match the file it actually now describes, plus an additive
  // enrichment note. Rule 66: the old manifest is versioned aside, never overwritten blind.
  const manifestPath = join(REPO_ROOT, 'resources', 'mmlu_pro_bundled', 'manifest.json');
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const staleSha = manifest.sha256;
    manifest.sha256 = afterHash;
    manifest.originSrcEnrichment = {
      enrichedAt: new Date().toISOString(),
      enrichedBy: 'scripts/backfill_mmlu_pro_origin_src.mjs (D-BP154-030 amendment 2)',
      campaignQuestionIdsEnriched: STANDING_20,
      fieldAdded: 'origin_src (per-row, only on the enriched rows above)',
      priorSha256: staleSha,
    };
    writeVersioned(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`Manifest sha256 refreshed: ${staleSha} -> ${afterHash}`);
  }

  // D-BP154-030 AMENDMENT 3 -- Founder: "we only need to pull data and create eblets for each of
  // the actual questions we are asking (and more to the point ONE TIME) so that we simply add to
  // the Package Store inventory of Eblets gradually, accreting as we go." This is the accretion
  // inventory -- BY CATEGORY, the same grain the Founder named ("Category Columns... for each of
  // the 14 MMLU-Pro categories"). NOT a fork of substrate_domain_ref_cache.jsonl (LianaBanyanPlatform/
  // eval/mmlu_pro/, read this ticket): that store holds CURATED, general per-domain STUDY-GUIDE
  // content (four domains only -- chemistry/law/math/physics -- built from Asteroid-ProofVault
  // REFERENCE eblets, explicitly "never the bridged corpus that contains verbatim test questions").
  // This store holds per-QUESTION provenance (this item's own origin/augmentation facts) -- a
  // different grain, cross-referenced by the SAME category taxonomy (both use the plain domain
  // name string, e.g. "chemistry"), never merged into one schema. ACCRETES: reads whatever index
  // already exists on disk and ADDS this pass's entries rather than overwriting the whole file, so
  // a later pass touching different qids in the same category grows the list instead of erasing it.
  const categoryIndexPath = join(PROVENANCE_DIR, 'BY_CATEGORY_INDEX.json');
  const existingCategoryIndex = existsSync(categoryIndexPath)
    ? JSON.parse(readFileSync(categoryIndexPath, 'utf8'))
    : { byCategory: {} };
  for (const r of results) {
    if (!r.ok) continue;
    const bundleRow = byId.get(r.campaignQuestionId);
    // FD-BP154-08b: loop over the TAG LIST (today always length 1, from the corpus's own
    // single-valued `category` field) rather than a single field -- an item tagged into MULTIPLE
    // categories in a future pass is added to every one of its buckets, losslessly, with no
    // migration of this index's own shape (already a multi-map: {category: [ids]}, which already
    // tolerates one id appearing under more than one key).
    const tags = bundleRow ? [bundleRow.category] : ['unknown'];
    for (const cat of tags) {
      if (!existingCategoryIndex.byCategory[cat]) existingCategoryIndex.byCategory[cat] = [];
      if (!existingCategoryIndex.byCategory[cat].includes(r.campaignQuestionId)) {
        existingCategoryIndex.byCategory[cat].push(r.campaignQuestionId);
      }
    }
  }
  existingCategoryIndex.updatedAt = new Date().toISOString();
  existingCategoryIndex.note = 'Accretion inventory of origin eblets BY CATEGORY (14 MMLU-Pro '
    + 'domains). Sibling to, never a fork of, LianaBanyanPlatform/eval/mmlu_pro/'
    + 'substrate_domain_ref_cache.jsonl (per-domain curated study-guide content) -- this indexes '
    + 'per-QUESTION provenance records instead, cross-referenced by the same category/domain name.';
  writeVersioned(categoryIndexPath, `${JSON.stringify(existingCategoryIndex, null, 2)}\n`);
  const categoryCoverage = Object.fromEntries(
    Object.entries(existingCategoryIndex.byCategory).map(([cat, ids]) => [cat, ids.length]),
  );
  console.log(`By-category accretion index updated: ${categoryIndexPath}`);
  console.log(`Coverage by category (this store, all passes to date): ${JSON.stringify(categoryCoverage)}`);

  const indexPath = join(PROVENANCE_DIR, 'INDEX.json');
  writeVersioned(indexPath, JSON.stringify({
    builtAt: new Date().toISOString(),
    standingSet: STANDING_20,
    results,
    requestsIssued: requestCount,
    totalRequestMs,
    beforeHash,
    afterHash,
    backupPath,
  }, null, 2) + '\n');

  const okCount = results.filter((r) => r.ok).length;
  const avgMsPerRequest = requestCount ? Math.round(totalRequestMs / requestCount) : 0;
  console.log(`\nDone. ${okCount}/${STANDING_20.length} items enriched. ${requestCount} HTTP requests, ${totalRequestMs}ms total (${avgMsPerRequest}ms/request avg).`);
  console.log(`Index written: ${indexPath}`);

  // COVERAGE, AS A NUMBER (Founder, this amendment: "Coverage is the metric this architecture
  // lives or dies by"). This pass is the FIRST acquisition for all 20 -- so coverage before this
  // pass was 0/20 owned (every item required a fresh network acquisition); after this pass, all
  // ok:true items are OWNED and every future HumanNuance:1 run against one of these 20 campaign
  // qids answers its artifact-class question with ZERO queries (FD-BP153-05, the zero-query
  // derivation) -- it reads `origin_src` straight off the bundled corpus row. The number that
  // matters for THIS run: how many needed a fresh acquisition (all of them, by construction of a
  // first pass) vs how many were already owned (none, by construction) -- reported honestly rather
  // than implied.
  console.log(`\nCOVERAGE (this pass): ${okCount}/${STANDING_20.length} answered via a FRESH acquisition (this is pass 1 -- 0 were already owned). `
    + `After this pass: ${okCount}/${STANDING_20.length} are now OWNED and answerable OFFLINE (zero queries) by any future HumanNuance:1 run against these campaign qids.`);
  console.log(`GUARD CHECK: acquisition was driven by each item's own question_id/source_id/question TEXT only -- `
    + `never by its answer. Every fetched row's own answer/answer_index field was discarded on receipt `
    + `(see per-item "answer field discarded" lines above); neither output artifact (questions.jsonl's `
    + `origin_src, nor any origin_provenance/*.json eblet) contains an answer or answer_index key.`);

  // Full-corpus cost PROJECTION ONLY -- not run.
  const totalMmluProItems = 12032; // num_rows_total observed live this ticket
  const projectedRequestsPerItem = requestCount / STANDING_20.length;
  const projectedTotalRequests = Math.round(projectedRequestsPerItem * totalMmluProItems);
  const projectedTotalMs = Math.round((totalRequestMs / STANDING_20.length) * totalMmluProItems);
  console.log(`\nFULL-CORPUS PROJECTION (NOT RUN -- extrapolated from this pass's own measurement):`);
  console.log(`  MMLU-Pro test split size: ${totalMmluProItems} items`);
  console.log(`  Measured this pass: ${requestCount} requests / ${STANDING_20.length} items = ${projectedRequestsPerItem.toFixed(1)} requests/item`);
  console.log(`  Projected requests for full corpus: ~${projectedTotalRequests}`);
  console.log(`  Projected wall time (sequential, this pass's own rate): ~${Math.round(projectedTotalMs / 1000 / 60)} minutes`);
  console.log(`  Projected eblet storage: ~${totalMmluProItems} files x (this pass's own avg file size)`);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
