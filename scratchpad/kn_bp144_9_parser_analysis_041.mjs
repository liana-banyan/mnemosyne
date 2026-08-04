// KN-BP144-9 Phase 0, item 0.4 support script: runs the letter-extraction logic against every
// one of the 32 parse_failed rows from the 041 receipt, against the REAL recovered MC option
// text (see kn_bp144_9_classify_parse_failed_041.mjs), and reports exactly which of
// extractChosenLetterFromAuthorityText's four regexes and matchFreeTextAnswerToOption's
// numeric/token-overlap fallback would fire.
//
// HONESTY NOTE (read before trusting this script's PASS/FAIL-shaped output):
//   - extractNumber() and matchValueToOption() below are REQUIRED DIRECTLY from the real
//     compiled dist (dist/main/plow/compute_sidecar.js) -- both are exported there, so this is a
//     real call into the real compiled artifact, per HARDWIRE's "verify against the real
//     compiled dist" standard.
//   - extractChosenLetterFromAuthorityText / matchFreeTextAnswerToOption / tokenizeForOptionMatch
//     / resolveAuthorityLetterMatch are NOT exported from plow_mc_answerer.ts (module-private) --
//     they are REIMPLEMENTED here verbatim, copied by hand from the source at HEAD 1dcd8f27, NOT
//     loaded from dist. A silent divergence between this copy and the real function is possible;
//     this script's output should be read as "what the documented algorithm does when copied
//     faithfully," not as "a direct execution of the shipped code." Phase 2 (if approved) should
//     re-verify this analysis against the real dist once the ticket's own work makes these
//     functions reachable for direct testing (e.g. a debug export), or by re-running the real
//     pipeline and diffing plowTrace against this script's predictions.
//   - For every row whose rawPreview is exactly 200 characters, the text below is a PREFIX of
//     what the real parser actually received (distillExtraction caps the real `fact` at 320
//     chars; the receipt's own rawPreview caps its logged preview at 200 -- see
//     truncateAuthorityPreview). Because matchFreeTextAnswerToOption's token-overlap score is
//     monotonic non-decreasing as the answer text grows (each option's own token list is fixed;
//     adding more answer-text tokens can only add hits, never remove them), a MATCH found against
//     this truncated prefix is a valid lower bound (the real, longer text would also have
//     matched). A NON-match found here is NOT proof the real parser also failed -- the missing
//     16-120 characters this script cannot see could contain the letter or the missing option
//     tokens. This caveat is reported per-row below, not glossed over.
//
// Run: node scratchpad/kn_bp144_9_parser_analysis_041.mjs

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { extractNumber, matchValueToOption } = require('../dist/main/plow/compute_sidecar.js');

// ─── Verbatim reimplementation of plow_mc_answerer.ts's private parse-level functions ──────────
// (HEAD 1dcd8f27, clean-shell-v0.9; regenerate/diff against source before trusting long-term)

function extractChosenLetterFromAuthorityText(answerText, options) {
  const validLetters = new Set(options.map((o) => o.letter.toUpperCase()));
  const patterns = [
    /\banswer\s*[:\-]?\s*\(?([A-J])\)?\b/i,
    /\bcorrect (?:option|answer|choice) is\s*\(?([A-J])\)?\b/i,
    /^\s*\(?([A-J])\)[\s.:\-]/,
    /\boption\s+\(?([A-J])\)?\s+is (?:correct|right)\b/i,
  ];
  for (const re of patterns) {
    const m = answerText.match(re);
    const letter = m?.[1]?.toUpperCase();
    if (letter && validLetters.has(letter)) {
      return { letter, score: 1, matchedPattern: re.source };
    }
  }
  return null;
}

const PSIONIC_OPTION_MATCH_MIN_SCORE = 0.34;
const PSIONIC_OPTION_MATCH_MIN_MARGIN = 0.08;

function tokenizeForOptionMatch(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
}

function matchFreeTextAnswerToOption(answerText, options) {
  const numeric = extractNumber(answerText);
  if (numeric !== null) {
    const numericMatch = matchValueToOption(numeric, options);
    if (numericMatch) return { letter: numericMatch.letter, score: 1, path: 'numeric' };
    return { blockedByNumeric: numeric };
  }

  const answerTokens = new Set(tokenizeForOptionMatch(answerText));
  if (answerTokens.size === 0 || options.length === 0) return null;

  const scored = options
    .map((opt) => {
      const optTokens = tokenizeForOptionMatch(opt.text);
      if (optTokens.length === 0) return { letter: opt.letter, score: 0, hits: 0, optTokens };
      const hits = optTokens.filter((t) => answerTokens.has(t)).length;
      return { letter: opt.letter, score: hits / optTokens.length, hits, optTokens };
    })
    .sort((a, b) => b.score - a.score);

  const top = scored[0];
  const second = scored[1];
  const diagnostics = { top, second };
  if (!top || top.score < PSIONIC_OPTION_MATCH_MIN_SCORE) return { failReason: 'below_min_score', diagnostics };
  if (second && top.score - second.score < PSIONIC_OPTION_MATCH_MIN_MARGIN) return { failReason: 'below_min_margin', diagnostics };
  return { letter: top.letter, score: top.score, path: 'token_overlap', diagnostics };
}

function resolveAuthorityLetterMatch(answerText, options) {
  const explicit = extractChosenLetterFromAuthorityText(answerText, options);
  if (explicit) return { ...explicit, method: 'explicit_letter' };
  const fallback = matchFreeTextAnswerToOption(answerText, options);
  if (fallback && fallback.letter) return { ...fallback, method: 'token_or_numeric_match' };
  return { failedFallback: fallback };
}

// ─── The 32 rows, joined against real corpus option text (from the classify script's output) ──
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RECEIPT_PATH = 'C:\\Users\\Administrator\\Downloads\\041mnemo_mesh_test_receipt_2026-08-04T19-03-05-234Z.json';
const CORPUS_BASE = 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\lb-reproducibility-pack\\datasets\\mmlu_pro_per_domain';
const BROWSER_AUTHORITY_KEYS = ['user_google', 'user_perplexity', 'user_claude', 'user_chatgpt', 'user_gemini'];

const receipt = JSON.parse(readFileSync(RECEIPT_PATH, 'utf8'));
const lookup = new Map();
for (const d of readdirSync(CORPUS_BASE).filter((x) => statSync(join(CORPUS_BASE, x)).isDirectory()).sort()) {
  const qp = join(CORPUS_BASE, d, 'questions.json');
  if (!existsSync(qp)) continue;
  let arr;
  try { arr = JSON.parse(readFileSync(qp, 'utf8')); } catch { continue; }
  const list = Array.isArray(arr) ? arr : arr.questions;
  if (!Array.isArray(list)) continue;
  for (const q of list) if (typeof q.question === 'string') lookup.set(q.question.trim(), q);
}
function letterFromIndex(i) { return String.fromCharCode(65 + i); }

let printed = 0;
for (const o of receipt.outcomes) {
  const ao = o.plowTrace?.authorityOutcomes;
  if (!ao) continue;
  const corpusQ = lookup.get(o.question.trim());
  const mcOptions = corpusQ ? corpusQ.options.map((text, i) => ({ letter: letterFromIndex(i), text })) : null;
  for (const authority of BROWSER_AUTHORITY_KEYS) {
    const rec = ao[authority];
    if (!rec || rec.outcome !== 'parse_failed') continue;
    printed++;
    const preview = rec.rawPreview ?? '';
    console.log('='.repeat(100));
    console.log(`qid ${o.question_id} | ${authority} | previewLen=${preview.length}${preview.length === 200 ? ' (TRUNCATED -- real fact may extend up to 320 chars; see header caveat)' : ' (COMPLETE -- this is the full fact text the real parser saw)'}`);
    if (!mcOptions) {
      console.log('NO CORPUS MATCH -- cannot re-derive options text for this question, skipping parser replay.');
      continue;
    }
    const result = resolveAuthorityLetterMatch(preview, mcOptions);
    if (result.letter) {
      console.log(`REPLAY RESULT: WOULD EXTRACT '${result.letter}' via ${result.method}/${result.path ?? result.matchedPattern ?? ''} -- this row's parse_failed may be a truncation artifact if previewLen===200, or a genuine parser gap if previewLen<200 (complete text) and this letter is wrong/unsupported.`);
    } else {
      const fb = result.failedFallback;
      if (fb?.blockedByNumeric !== undefined) {
        console.log(`REPLAY RESULT: NO MATCH. Numeric token ${fb.blockedByNumeric} found in text but did not match any option within compute_sidecar's tolerance -- matchFreeTextAnswerToOption's own design deliberately does NOT fall through to token-overlap once a numeric token is found (see its doc comment), so this is an honest, by-design null, not a defect.`);
      } else if (fb?.failReason === 'below_min_score') {
        const t = fb.diagnostics.top;
        console.log(`REPLAY RESULT: NO MATCH. Top-scoring option ${t.letter} scored ${t.score.toFixed(2)} (${t.hits}/${t.optTokens.length} tokens: [${t.optTokens.join(', ')}]) -- below PSIONIC_OPTION_MATCH_MIN_SCORE=0.34.`);
      } else if (fb?.failReason === 'below_min_margin') {
        const t = fb.diagnostics.top, s = fb.diagnostics.second;
        console.log(`REPLAY RESULT: NO MATCH. Top option ${t.letter} scored ${t.score.toFixed(2)}, second option ${s.letter} scored ${s.score.toFixed(2)} -- margin ${(t.score - s.score).toFixed(2)} is below PSIONIC_OPTION_MATCH_MIN_MARGIN=0.08 (ambiguous, correctly refused).`);
      } else {
        console.log('REPLAY RESULT: NO MATCH. No tokens at all in the answer text overlapped any option (or answer/options tokenized to nothing).');
      }
    }
  }
}
console.log(`\n${printed} row(s) replayed against the reimplemented parser + real corpus option text.`);
