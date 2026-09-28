#!/usr/bin/env node
// build_seed_cards.mjs -- D-BP223-BM04-X033S3-010 Gap 1
//
// PRIOR-WORK CHECK (Law 4, this dispatch): build_wave9_cards.js / build_wave_cards.js (under
// several D-BP223-BM0-X033-0* dispatch folders) MINT new Hollerith cards FROM question+answer --
// the inverse operation. D-BP223-BM0-X014-014-EXECUTELEG's maze_compile.cjs/method_execute_leg.cjs
// (1109/1140 lines) compile/execute a maze during minting. None of these read the ALREADY-SHIPPED
// 639-row manifest and extract real question/answer TEXT back out of the card files into a flat
// seed_cards.json for the Prove It tab's region D -- that operation does not exist yet. This file
// fills that gap; it does not duplicate any of the above.
//
// ONE-TIME BUILD-TIME GENERATOR (brief's own words: "a script under scripts/ is fine, or a
// one-time generator you run now"). Not wired into package.json (brief: no package.json edit).
// Reads the shipped manifest (src/main/proveit/seed/seed_cards_manifest.json, 639 rows) plus the
// Hollerith/maze/formula card files it points at (under BISHOP_DROPZONE, read-only, outside this
// repo), verifies each row's own sha256, and produces
// src/main/proveit/seed/seed_cards.json: one real-text record per verified row -- question,
// options, answer (as the card itself records/resolves it), sources, answering model, checked-
// against-key flag, the card's OWN mint date where one can be found on the card (never the
// manifest's generated_utc, per the brief), and the duplicate-pair marker. NEVER FABRICATES: a
// field this script cannot resolve from the card's own content is left null and the loader shows
// "(not recorded on this card)" (brief's own explicit fallback), never invented prose.
//
// FORMAT SURVEY (this dispatch, all 639 rows, 0 missing / 0 hash mismatches):
//   489 rows: maze + question_source           (golden path -- real Q from question_source, real
//                                                A from walking the maze's own decision_table
//                                                against its own already-recorded `givens[].value`)
//   10  rows: maze, no question_source          (A resolved via maze; Q via the qid index below)
//   8   rows: maze + formula, no question_source(A resolved via maze -- formula ignored when maze
//                                                is present, maze is the more literal "answer as
//                                                recorded" since its givens[].value is already
//                                                decided, not re-derived)
//   89  rows: formula.stages only, no maze      (A resolved by chaining each stage's own literal
//                                                `return '...'`/`return "..."` -- these are
//                                                zero-argument, single-return "blind reasoning"
//                                                functions, see qid70 -- through the assemble
//                                                stage's own join pattern when recognizable, else
//                                                the individual blanks are still shown, joined by
//                                                " | ", honestly labeled as unassembled)
//   43  rows: top-level engine:"js" + code, no maze/formula
//                                                (A resolved by RUNNING that code in an empty,
//                                                timeout-bounded vm context -- this IS the card's
//                                                own designed zero-model-call replay mechanism,
//                                                D-BP223-BM0-X023-034-PY2JS: "Founder pick
//                                                JavaScript: in-process js engine replaces a
//                                                fresh python process per item". Every such
//                                                sample's __g() calls carry their real input as a
//                                                baked-in default, so an empty sandbox reproduces
//                                                the same value the original run used.)
// Q for the last two buckets, and A for the 89, is best-effort by design -- the brief's own
// escape hatch ("if a field is truly absent... shows (not recorded on this card)") exists for
// exactly this diversity of card formats. See SEED_GAPS.md (written by this script) for the
// per-row resolution ledger.
//
// D-BP223-BM0-X034-017 FILL THE 138 (Founder 2026-09-20 "fill the 138"): the 138 rows the
// methods above left null were ALL cards that COMPUTE their answer by a path this script does
// not execute -- 93 numeric mazes whose decision rows carry `then.expr` (never `then.label`) and
// need maze_compile + evalExpr + the wave-harness option pick, and 45 JS formula cards whose
// givens are read from the QUESTION TEXT by a stored rule at run time (an empty sandbox throws
// ReferenceError). Rather than re-implement those executors here, that dispatch REPLAYED the
// real recall executor (recall_exec.cjs, sha256 231a0489..., the same file every 700-wave
// run_wave.js invokes) over each source package at zero model calls / zero network attempts,
// reproducing the recorded M0/M2/wave answersSha256 byte for byte, and wrote the result to
// src/main/proveit/seed/recall_replay_answers.json (qid, sourceGroup, cardFilePath, cardSha256,
// letter, answerText = the matched option's text from the package's own key-free question file).
// This script now consumes that ledger as the LAST fallback (only when every method above
// resolved nothing), and only when the ledger row's cardSha256 equals the manifest row's sha256
// (same card, byte for byte). A ledger letter of "no_match" is the card's own recorded outcome
// (its computation matched no option; scored wrong against the key at mint) and is rendered as an
// honest one-line "no option matched" answer, never as an invented option. Methods
// `recall_exec_replay` / `recall_exec_replay_no_match` in the breakdown below.

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const MANIFEST_PATH = join(REPO_ROOT, 'src', 'main', 'proveit', 'seed', 'seed_cards_manifest.json');
const OUT_PATH = join(REPO_ROOT, 'src', 'main', 'proveit', 'seed', 'seed_cards.json');
const DISPATCH_DIR = 'C:/Users/Administrator/Documents/LianaBanyanPlatform/BISHOP_DROPZONE/D-BP223-BM04-X033S3-010-PROVE-IT-SEED-TEXT-ASK-PATH-AND-LIVE-CHECK';
// X034-017: overridable so a later dispatch's rebuild writes its ledger to its OWN folder instead
// of overwriting S3 010's SEED_GAPS.md (never overwrite another dispatch's deliverable).
const GAPS_PATH = process.env.PROVEIT_SEED_GAPS_PATH || join(DISPATCH_DIR, 'SEED_GAPS.md');
const REPLAY_PATH = join(REPO_ROOT, 'src', 'main', 'proveit', 'seed', 'recall_replay_answers.json');
const NO_MATCH_ANSWER_TEXT = 'no option matched: the card\'s own computation matches none of the options (replayed by the recall executor at zero model calls; scored wrong against the key at mint, and a wrong card stays wrong)';
const DROPZONE_ROOT = process.env.PROVEIT_DROPZONE_ROOT
  || 'C:/Users/Administrator/Documents/LianaBanyanPlatform/BISHOP_DROPZONE';

const MMLU_CATEGORIES = new Set([
  'biology', 'business', 'chemistry', 'computer-science', 'economics', 'engineering', 'health',
  'history', 'law', 'math', 'philosophy', 'physics', 'psychology', 'other',
]);
function normalizeCategory(raw) {
  const slug = String(raw ?? '').trim().toLowerCase().replace(/[\s_]+/g, '-');
  if (MMLU_CATEGORIES.has(slug)) return slug;
  const stripped = slug.replace(/^professional-/, '');
  if (MMLU_CATEGORIES.has(stripped)) return stripped;
  return null;
}

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

// ── qid -> {question, options, category, src, file} index, built once from every
//    *optionsfile.json / *blind_questions.json under BISHOP_DROPZONE (fallback for the 150 rows
//    whose card file carries no resolvable question_source). ──────────────────────────────────
function buildQidIndex(root) {
  const index = new Map(); // qid -> array of candidates
  function add(qid, question, options, category, src, file) {
    if (!Number.isFinite(qid) || typeof question !== 'string' || !question.trim()) return;
    if (!index.has(qid)) index.set(qid, []);
    index.get(qid).push({ question, options: Array.isArray(options) ? options : [], category, src, file });
  }
  function walk(dir) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (/optionsfile\.json$/i.test(e.name)) {
        const m = e.name.match(/qid(\d+)/i);
        if (!m) continue;
        try {
          const d = JSON.parse(readFileSync(p, 'utf-8'));
          add(Number(m[1]), d.question, d.options, d.category, d.src, p);
        } catch { /* skip unparsable file, never fabricate */ }
      } else if (/blind_questions\.json$/i.test(e.name)) {
        try {
          const arr = JSON.parse(readFileSync(p, 'utf-8'));
          if (Array.isArray(arr)) {
            for (const item of arr) add(Number(item.qid), item.question, item.options, item.category, item.src, p);
          }
        } catch { /* skip unparsable file */ }
      }
    }
  }
  walk(root);
  return index;
}

/** Resolves {question, options, confidence, note} from the index for one qid. Never invents:
 *  0 candidates -> null fields; >=1 candidate whose question text all agree -> that text,
 *  confidence 'index-agreed'/'index-unique'; disagreeing candidates -> the first one is still
 *  shown (it IS real MMLU-Pro text pulled from a real card-pack file, just not uniquely
 *  resolved) with confidence 'index-ambiguous', logged in the gaps ledger. */
function resolveFromIndex(index, qid) {
  const candidates = index.get(qid);
  if (!candidates || candidates.length === 0) return { question: null, options: [], confidence: 'unresolved' };
  const first = candidates[0];
  const allAgree = candidates.every((c) => c.question === first.question);
  return {
    question: first.question,
    options: first.options,
    confidence: candidates.length === 1 ? 'index-unique' : (allAgree ? 'index-agreed' : 'index-ambiguous'),
  };
}

/** Parses a question_source string. Most are a bare relative path; some (flagship_reasoning
 *  cards) append " (explanation prose)" after the real path -- strip that off. Returns the
 *  resolved {question, options, confidence} or null if the path can't be read/parsed. */
function resolveFromQuestionSource(dropzoneRoot, questionSource, qid) {
  if (typeof questionSource !== 'string' || !questionSource.trim()) return null;
  const pathPart = questionSource.split(' (')[0].trim();
  const abs = join(dropzoneRoot, pathPart.replace(/\//g, '\\'));
  if (!existsSync(abs)) return null;
  let data;
  try { data = JSON.parse(readFileSync(abs, 'utf-8')); } catch { return null; }
  if (Array.isArray(data)) {
    const hit = data.find((item) => Number(item.qid) === qid);
    if (!hit) return null;
    return { question: hit.question ?? null, options: Array.isArray(hit.options) ? hit.options : [], confidence: 'question_source-list' };
  }
  if (data && typeof data === 'object') {
    return { question: data.question ?? null, options: Array.isArray(data.options) ? data.options : [], confidence: 'question_source-direct' };
  }
  return null;
}

// ── maze decision-table evaluator: generic, deterministic, NO code execution. Walks
//    decision_table.rows in "first_match" order against the maze's own already-recorded
//    givens[].value (never re-derived) -- this is literally "the answer as the card records it". ─
/** A `when` condition value is either a bare literal (equality) or `{op, value}` (numeric
 *  comparison, seen on `type:"number"` givens, e.g. qid665's present-worth deltas). Both forms
 *  read the given's own already-recorded `value` -- no derivation, no invention. */
function whenConditionMatches(actual, expected) {
  if (expected !== null && typeof expected === 'object' && 'op' in expected) {
    if (typeof actual !== 'number') return false;
    const v = expected.value;
    switch (expected.op) {
      case '<': return actual < v;
      case '<=': return actual <= v;
      case '>': return actual > v;
      case '>=': return actual >= v;
      case '==': case '===': return actual === v;
      case '!=': case '!==': return actual !== v;
      default: return false; // unknown operator -- never guess a match
    }
  }
  return actual === expected;
}
function evaluateMaze(maze) {
  if (!maze || typeof maze !== 'object' || !Array.isArray(maze.givens) || !maze.decision_table || !Array.isArray(maze.decision_table.rows)) return null;
  const values = {};
  for (const g of maze.givens) {
    if (g && typeof g.name === 'string' && g.value !== undefined) values[g.name] = g.value;
  }
  for (const row of maze.decision_table.rows) {
    if (!row || typeof row.when !== 'object' || row.when === null) continue;
    const allMatch = Object.entries(row.when).every(([k, v]) => whenConditionMatches(values[k], v));
    if (allMatch && row.then && typeof row.then.label === 'string') {
      return { label: row.then.label, matchedRow: row.id ?? null };
    }
  }
  return null;
}

function mazeSources(maze) {
  if (!maze || !Array.isArray(maze.sources)) return [];
  return maze.sources
    .filter((s) => s && (s.citation || s.url))
    .map((s) => ({ label: s.citation || s.url, url: s.url || null }));
}

// ── formula.stages resolver: strips '#' comments, extracts each zero-arg stage's own literal
//    `return '...'` / `return "..."`, then attempts the assemble stage's own join pattern. Never
//    executes code; a stage whose body isn't a plain literal return is left unresolved for that
//    blank (final answer falls back to the ' | '-joined blanks that DID resolve, honestly
//    labeled, per the escape hatch this dispatch is built around). ──────────────────────────────
function stripPyComments(code) {
  return String(code ?? '').split('\n').map((line) => line.replace(/#.*$/, '')).join('\n');
}
function extractLiteralReturn(code) {
  const stripped = stripPyComments(code);
  const matches = [...stripped.matchAll(/return\s+'([^']*)'|return\s+"([^"]*)"/g)];
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  return last[1] !== undefined ? last[1] : last[2];
}
function resolveFormulaStages(formula) {
  if (!formula || !Array.isArray(formula.stages)) return null;
  const blanks = {};
  let finalLabel = null;
  let assembled = false;
  for (const stage of formula.stages) {
    const code = stage?.step?.code;
    if (!code) continue;
    const stripped = stripPyComments(code);
    if (Array.isArray(stage.inputs) && stage.inputs.length) {
      // Assemble-style stage: try the exact "'sep'.join([v1, v2, ...])" pattern this dispatch's
      // own survey found (qid70's assemble stage, copied verbatim in this file's own header).
      const joinMatch = stripped.match(/return\s+'([^']*)'\.join\(\[\s*([\w,\s]+)\]\)/);
      if (joinMatch) {
        const sep = joinMatch[1];
        const vars = joinMatch[2].split(',').map((v) => v.trim()).filter(Boolean);
        if (vars.every((v) => blanks[v] !== undefined)) {
          // Display separator only (" / "), never the literal internal matcher token (e.g. "||")
          // -- same blank values, just readable; not a reinterpretation of their content. `sep`
          // itself (the card's own internal matcher joiner) is intentionally unused for display.
          void sep;
          finalLabel = vars.map((v) => blanks[v]).join(' / ');
          assembled = true;
        }
      }
      continue;
    }
    const literal = extractLiteralReturn(code);
    if (literal !== null && stage.output) blanks[stage.output] = literal;
  }
  const blankValues = Object.values(blanks);
  if (blankValues.length === 0) return null;
  if (assembled && finalLabel !== null) return { label: finalLabel, assembled: true };
  return { label: blankValues.join(' | '), assembled: false };
}
function methodSources(method) {
  if (!method || !Array.isArray(method.sources)) return [];
  return method.sources.filter((s) => typeof s === 'string' && s.trim()).map((s) => ({ label: s, url: null }));
}

// ── top-level engine:"js" + code sandbox runner. This IS the card's own designed
//    zero-model-call replay mechanism (D-BP223-BM0-X023-034-PY2JS, see this file's header) --
//    running it is reading the card's own recorded resolution, not inventing one. Empty, frozen
//    sandbox, no require/fs/process/network reachable from inside it, 200ms timeout. ─────────────
function runJsCodeSandbox(code) {
  try {
    const wrapped = `(function(){ ${code} })()`;
    const script = new vm.Script(wrapped, { timeout: 200 });
    const sandbox = {};
    vm.createContext(sandbox);
    const result = script.runInContext(sandbox, { timeout: 200 });
    return { ok: true, value: result };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}
function formatJsResult(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return { text: value, raw: true };
  if (typeof value === 'number' || typeof value === 'boolean') return { text: String(value), raw: true };
  if (Array.isArray(value)) return { text: `computed value: [${value.map((v) => JSON.stringify(v)).join(', ')}] (not matched to option text)`, raw: false };
  if (typeof value === 'object') {
    const friendly = value.model_name || value.primary_model_name || value.label || value.answer || value.result || value.value;
    if (typeof friendly === 'string') return { text: friendly, raw: true };
    return { text: `computed value: ${JSON.stringify(value)} (not matched to option text)`, raw: false };
  }
  return null;
}

// ── mint date resolution: try several known date-bearing fields on the card itself, in order of
//    specificity; never falls back to the manifest's generated_utc without flagging it. ──────────
function resolveMintDate(cardJson) {
  const candidates = [
    cardJson?.provenance?.derived_utc,
    cardJson?.source?.retrieved_utc,
    cardJson?.x023_034_py2js?.utc,
    typeof cardJson?.provenance === 'string' ? null : cardJson?.provenance?.retrieved_utc,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && /^\d{4}-\d{2}-\d{2}/.test(c)) return { date: c, isManifestFallback: false };
  }
  return { date: null, isManifestFallback: true };
}

// ── recall_exec replay ledger (X034-017): Map keyed on `${qid}|${sourceGroup}` -> ledger row. Absent
//    or unparsable file -> empty map (the fallback simply never fires; nothing is fabricated). ────
function loadReplayLedger(path) {
  const byKey = new Map();
  if (!existsSync(path)) return { byKey, header: null };
  let data;
  try { data = JSON.parse(readFileSync(path, 'utf-8')); } catch { return { byKey, header: null }; }
  if (!data || !Array.isArray(data.rows)) return { byKey, header: null };
  for (const r of data.rows) {
    if (!r || !Number.isFinite(r.qid) || typeof r.sourceGroup !== 'string' || typeof r.cardSha256 !== 'string') continue;
    byKey.set(`${r.qid}|${r.sourceGroup}`, r);
  }
  const { rows: _rows, ...header } = data;
  return { byKey, header };
}
/** Returns {text, method} or null. Fires only when the ledger row is for THIS exact card (sha match)
 *  and the executor made zero model calls for it. A "no_match" letter is the card's own recorded
 *  outcome and gets the honest one-liner; anything else must carry the matched option's text. */
function resolveFromReplayLedger(ledger, row) {
  const r = ledger.byKey.get(`${row.qid}|${row.source_group}`);
  if (!r) return null;
  if (r.cardSha256 !== row.sha256) return null; // different card bytes -> not this card's answer
  if (r.modelCalls !== 0) return null;
  if (r.letter === 'no_match') return { text: NO_MATCH_ANSWER_TEXT, method: 'recall_exec_replay_no_match' };
  if (typeof r.letter === 'string' && /^[A-J]$/.test(r.letter) && typeof r.answerText === 'string' && r.answerText.trim()) {
    return { text: r.answerText, method: 'recall_exec_replay' };
  }
  return null;
}

function main() {
  if (!existsSync(MANIFEST_PATH)) throw new Error(`manifest not found: ${MANIFEST_PATH}`);
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
  const replayLedger = loadReplayLedger(REPLAY_PATH);
  console.log(`recall_exec replay ledger: ${replayLedger.byKey.size} rows (${REPLAY_PATH})`);
  if (!existsSync(DROPZONE_ROOT)) {
    writeFileSync(GAPS_PATH, `# SEED_GAPS.md\n\nDROPZONE_ROOT not found: ${DROPZONE_ROOT}\n0 of ${manifest.rows.length} rows resolved -- refusing to fabricate.\n`, 'utf-8');
    console.log(`DROPZONE_ROOT not found (${DROPZONE_ROOT}); wrote SEED_GAPS.md; 0 cards produced.`);
    return;
  }

  console.log('Building qid -> question/options index from BISHOP_DROPZONE (optionsfile.json + blind_questions.json)...');
  const qidIndex = buildQidIndex(DROPZONE_ROOT);
  console.log(`Index built: ${qidIndex.size} distinct qids found across the dropzone.`);

  const out = [];
  const missingOrHashMismatch = [];
  const questionUnresolved = [];
  const questionAmbiguous = [];
  const answerUnresolved = [];
  const answerByMethod = { maze: 0, formula_stages_assembled: 0, formula_stages_partial: 0, js_sandbox_string: 0, js_sandbox_computed: 0, js_sandbox_error: 0, recall_exec_replay: 0, recall_exec_replay_no_match: 0, none: 0 };
  const mintDateFallback = [];
  const duplicateQidSet = new Set(manifest.summary.duplicate_qids ?? []);

  for (const row of manifest.rows) {
    const abs = join(DROPZONE_ROOT, row.card_file_path.replace(/\//g, '\\'));
    if (!existsSync(abs)) { missingOrHashMismatch.push({ qid: row.qid, reason: 'missing', path: row.card_file_path }); continue; }
    const raw = readFileSync(abs);
    const actualHash = sha256(raw);
    if (actualHash !== row.sha256) { missingOrHashMismatch.push({ qid: row.qid, reason: 'hash_mismatch', path: row.card_file_path, expected: row.sha256, actual: actualHash }); continue; }
    let cardJson;
    try { cardJson = JSON.parse(raw.toString('utf-8')); } catch (e) { missingOrHashMismatch.push({ qid: row.qid, reason: 'json_parse_error', path: row.card_file_path, error: String(e) }); continue; }

    const category = normalizeCategory(row.category);

    // Question + options.
    let q = null;
    if (typeof cardJson.question_source === 'string') {
      q = resolveFromQuestionSource(DROPZONE_ROOT, cardJson.question_source, row.qid);
    }
    if (!q || !q.question) {
      const fromIndex = resolveFromIndex(qidIndex, row.qid);
      if (fromIndex.question) q = fromIndex;
    }
    if (!q || !q.question) {
      questionUnresolved.push(row.qid);
      q = { question: null, options: [], confidence: 'unresolved' };
    } else if (q.confidence === 'index-ambiguous') {
      questionAmbiguous.push(row.qid);
    }

    // Answer + sources, in order of preference: maze (literal, no exec) > formula stages
    // (literal-return extraction) > top-level js code (sandboxed execution of the card's own
    // designed replay mechanism).
    let answer = null;
    let answerMethod = null; // X034-017: per-row resolution method, written as answerResolution
    let sources = [];
    if (cardJson.maze) {
      const mazeResult = evaluateMaze(cardJson.maze);
      sources = mazeSources(cardJson.maze);
      if (mazeResult) { answer = mazeResult.label; answerByMethod.maze += 1; answerMethod = 'maze'; }
    }
    if (answer === null && cardJson.formula && Array.isArray(cardJson.formula.stages)) {
      const formulaResult = resolveFormulaStages(cardJson.formula);
      if (cardJson.method) sources = sources.length ? sources : methodSources(cardJson.method);
      if (formulaResult) {
        answer = formulaResult.assembled ? formulaResult.label : `${formulaResult.label} (blanks resolved individually; card's own assembly step not parsed)`;
        answerMethod = formulaResult.assembled ? 'formula_stages_assembled' : 'formula_stages_partial';
        answerByMethod[answerMethod] += 1;
      }
    }
    if (answer === null && typeof cardJson.engine === 'string' && cardJson.engine === 'js' && typeof cardJson.code === 'string') {
      if (cardJson.method) sources = sources.length ? sources : methodSources(cardJson.method);
      const run = runJsCodeSandbox(cardJson.code);
      if (run.ok) {
        const formatted = formatJsResult(run.value);
        if (formatted) {
          answer = formatted.text;
          answerMethod = formatted.raw ? 'js_sandbox_string' : 'js_sandbox_computed';
          answerByMethod[answerMethod] += 1;
        }
      } else {
        answerByMethod.js_sandbox_error += 1;
      }
    }
    // A later card format nests engine:"js"/code under `formula` itself instead of top-level
    // (e.g. qid1066: `formula.engine === 'js'`, `formula.code` referencing its own `givens[]` by
    // bare name). Those givens carry a `.rule`/`.description` rather than a baked-in `.value`
    // default, so a bare identifier the code references is genuinely undefined in an empty
    // sandbox -- the vm throws a ReferenceError, caught below, correctly counted as unresolved
    // rather than silently fabricated. This fallback only ever HELPS (some such cards' code is
    // self-contained) and never produces a wrong answer (an undefined-reference throw is honest
    // failure, not a guess).
    if (answer === null && cardJson.formula && typeof cardJson.formula === 'object' && cardJson.formula.engine === 'js' && typeof cardJson.formula.code === 'string') {
      if (cardJson.method) sources = sources.length ? sources : methodSources(cardJson.method);
      const run = runJsCodeSandbox(cardJson.formula.code);
      if (run.ok) {
        const formatted = formatJsResult(run.value);
        if (formatted) {
          answer = formatted.text;
          answerMethod = formatted.raw ? 'js_sandbox_string' : 'js_sandbox_computed';
          answerByMethod[answerMethod] += 1;
        }
      } else {
        answerByMethod.js_sandbox_error += 1;
      }
    }
    // X034-017 LAST fallback: the real recall executor's replayed answer for this exact card (sha-
    // matched), see this file's header. Fires only when every method above resolved nothing.
    if (answer === null) {
      const replayed = resolveFromReplayLedger(replayLedger, row);
      if (replayed) {
        answer = replayed.text;
        answerMethod = replayed.method;
        answerByMethod[replayed.method] += 1;
        if (cardJson.maze && !sources.length) sources = mazeSources(cardJson.maze);
        if (cardJson.method && !sources.length) sources = methodSources(cardJson.method);
      }
    }
    if (answer === null) { answerUnresolved.push(row.qid); answerByMethod.none += 1; }

    const mint = resolveMintDate(cardJson);
    if (mint.isManifestFallback) mintDateFallback.push(row.qid);

    out.push({
      qid: row.qid,
      category: category ?? row.category,
      categoryNormalized: category !== null,
      question: q.question,
      questionConfidence: q.confidence,
      options: q.options,
      answer,
      answerResolution: answerMethod, // X034-017: which method produced `answer` (null when unresolved)
      sources,
      answeringModel: row.answering_model,
      answeringKind: row.answering_kind,
      checkedAgainstKey: row.checked_against_key,
      correctAgainstKey: row.correct_against_key,
      mintDate: mint.date ?? manifest.generated_utc,
      mintDateIsManifestFallback: mint.isManifestFallback,
      duplicateOfQid: duplicateQidSet.has(row.qid) ? row.qid : null,
      sourceGroup: row.source_group,
      cardFilePath: row.card_file_path,
      sha256: row.sha256,
    });
  }

  writeFileSync(OUT_PATH, JSON.stringify({
    generatedUtc: new Date().toISOString(),
    generatedBy: 'scripts/build_seed_cards.mjs (D-BP223-BM04-X033S3-010)',
    sourceManifestGeneratedUtc: manifest.generated_utc,
    dropzoneRoot: DROPZONE_ROOT,
    cardCount: out.length,
    cards: out,
  }, null, 2), 'utf-8');

  const gapsLines = [];
  gapsLines.push(`# SEED_GAPS.md -- ${process.env.PROVEIT_SEED_GAPS_TAG || 'D-BP223-BM04-X033S3-010 Gap 1'}`);
  gapsLines.push('');
  gapsLines.push(`Manifest rows: ${manifest.rows.length}. Missing or hash-mismatched (skipped from seed_cards.json entirely, per the brief): ${missingOrHashMismatch.length}.`);
  if (missingOrHashMismatch.length) {
    gapsLines.push('');
    for (const g of missingOrHashMismatch) gapsLines.push(`- qid ${g.qid}: ${g.reason} (${g.path})`);
  } else {
    gapsLines.push('None -- all 639 card files exist at their manifest path and their sha256 matches the manifest exactly (verified this run).');
  }
  gapsLines.push('');
  gapsLines.push(`Rows written to seed_cards.json: ${out.length}.`);
  gapsLines.push('');
  gapsLines.push('## Question text: unresolved (shown as "(not recorded on this card)" by the loader)');
  gapsLines.push(questionUnresolved.length ? `${questionUnresolved.length} qids: ${questionUnresolved.join(', ')}` : 'None.');
  gapsLines.push('');
  gapsLines.push('## Question text: resolved but ambiguous (index had disagreeing candidates; first one shown, real MMLU-Pro text either way, just not uniquely sourced)');
  gapsLines.push(questionAmbiguous.length ? `${questionAmbiguous.length} qids: ${questionAmbiguous.join(', ')}` : 'None.');
  gapsLines.push('');
  gapsLines.push('## Answer: resolution method breakdown');
  gapsLines.push(`(js_sandbox_error counts attempts, not final outcomes -- a card it counts may still resolve by a later method; recall_exec replay ledger loaded: ${replayLedger.byKey.size} rows from ${REPLAY_PATH})`);
  for (const [k, v] of Object.entries(answerByMethod)) gapsLines.push(`- ${k}: ${v}`);
  gapsLines.push('');
  gapsLines.push('## Answer: fully unresolved (shown as "(not recorded on this card)" by the loader)');
  gapsLines.push(answerUnresolved.length ? `${answerUnresolved.length} qids: ${answerUnresolved.join(', ')}` : 'None.');
  gapsLines.push('');
  gapsLines.push('## Mint date: fell back to the manifest\'s own generated_utc (no per-card date field found on the card itself)');
  gapsLines.push(mintDateFallback.length ? `${mintDateFallback.length} qids (mintDateIsManifestFallback: true in seed_cards.json): ${mintDateFallback.slice(0, 60).join(', ')}${mintDateFallback.length > 60 ? ' ...' : ''}` : 'None.');
  writeFileSync(GAPS_PATH, gapsLines.join('\n') + '\n', 'utf-8');

  console.log(`Wrote ${OUT_PATH} (${out.length} cards) and ${GAPS_PATH}.`);
  console.log(`missing/hash-mismatch: ${missingOrHashMismatch.length}, question unresolved: ${questionUnresolved.length}, answer unresolved: ${answerUnresolved.length}`);
  console.log('answerByMethod:', answerByMethod);
}

main();
