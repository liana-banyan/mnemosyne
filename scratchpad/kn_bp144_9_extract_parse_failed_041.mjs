// KN-BP144-9 Phase 0, item 0.1: extract every parse_failed entry from the run 041 receipt.
//
// Read-only. Loads the receipt JSON from disk, does not write to it, and does not touch any
// file under src/. Iterates every question's plowTrace.authorityOutcomes for the five BROWSER
// authorities (user_google, user_perplexity, user_claude, user_chatgpt, user_gemini) --
// specialist_swarm is deliberately excluded, per HARDWIRE-01's authority list and the ticket's
// own phrase "browser-authority attempts" -- and prints question id, authority, and the full
// (as-stored, up to 200 chars per truncateAuthorityPreview) rawPreview for every 'parse_failed'
// record found.
//
// NOTE for the Phase 0 report: this script found 32 parse_failed rows, not the 26 the ticket
// narrative asserts. The ticket's own reproduced summary table (google=12, claude=6, gemini=14,
// chatgpt=0, perplexity=0) sums to 32, and this script's direct per-question count matches that
// table exactly and matches the receipt's own top-level authorityOutcomeSummary field exactly.
// The "twenty-six" figure in the ticket prose does not reconcile with any grouping of this
// receipt's data this script could find (not the 5-authority sum, not distinct question count
// (16), not any subset tried). This discrepancy is reported, not silently corrected to match the
// ticket -- see KN-BP144-9_REPORT.md Phase 0 section 0.1.
//
// Run: node scratchpad/kn_bp144_9_extract_parse_failed_041.mjs

import { readFileSync } from 'node:fs';

const RECEIPT_PATH = 'C:\\Users\\Administrator\\Downloads\\041mnemo_mesh_test_receipt_2026-08-04T19-03-05-234Z.json';
const BROWSER_AUTHORITY_KEYS = ['user_google', 'user_perplexity', 'user_claude', 'user_chatgpt', 'user_gemini'];

const rawText = readFileSync(RECEIPT_PATH, 'utf8');
const receipt = JSON.parse(rawText);
const outcomes = receipt.outcomes ?? receipt.results ?? receipt.questions;

if (!Array.isArray(outcomes)) {
  console.error('FATAL: receipt has no outcomes array at the expected shape.');
  process.exit(1);
}

const parseFailedRows = [];
for (const q of outcomes) {
  const authorityOutcomes = q.plowTrace && q.plowTrace.authorityOutcomes;
  if (!authorityOutcomes) continue;
  for (const authority of BROWSER_AUTHORITY_KEYS) {
    const rec = authorityOutcomes[authority];
    if (rec && rec.outcome === 'parse_failed') {
      parseFailedRows.push({
        question_id: q.question_id,
        authority,
        rawPreview: rec.rawPreview ?? '',
        rawPreviewLength: (rec.rawPreview ?? '').length,
      });
    }
  }
}

console.log(`Receipt: ${RECEIPT_PATH}`);
console.log(`Total questions in receipt: ${outcomes.length}`);
console.log(`Total parse_failed rows across the 5 browser authorities: ${parseFailedRows.length}`);
console.log('');

// Cross-check against the receipt's own top-level authorityOutcomeSummary field, if present, so
// any drift between the per-question records and the run-level rollup is visible immediately.
if (receipt.authorityOutcomeSummary) {
  const summaryParseFailedTotal = BROWSER_AUTHORITY_KEYS.reduce(
    (sum, k) => sum + (receipt.authorityOutcomeSummary[k]?.parse_failed ?? 0),
    0,
  );
  console.log(`Cross-check -- receipt.authorityOutcomeSummary parse_failed sum (5 browser authorities): ${summaryParseFailedTotal}`);
  console.log(
    summaryParseFailedTotal === parseFailedRows.length
      ? 'MATCH: per-question count agrees with the run-level summary field.'
      : 'MISMATCH: per-question count does NOT agree with the run-level summary field -- report this, do not silently pick one.',
  );
  console.log('');
}

console.log('--- Every parse_failed row (question_id, authority, rawPreview length, rawPreview) ---');
for (const row of parseFailedRows) {
  console.log(`\nqid ${row.question_id} | ${row.authority} | ${row.rawPreviewLength} chars`);
  console.log(row.rawPreview);
}

console.log(`\n${parseFailedRows.length} row(s) printed.`);
