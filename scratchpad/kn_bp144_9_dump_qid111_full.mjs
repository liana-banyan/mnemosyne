// KN-BP144-9 Phase 0 follow-up: full ensemble_candidates + outcome dump for qid 111 and the
// other rows this ticket's Phase 0 taxonomy touched (27, 46, 53, 59, 72, 98).
//
// Read-only. Loads the run 041 receipt from disk, does not write to it, and does not touch any
// file under src/. Reuses the exact receipt-shape-navigation logic from
// kn_bp144_9_extract_parse_failed_041.mjs (receipt.outcomes ?? receipt.results ?? receipt.questions,
// per-question plowTrace.authorityOutcomes) plus the qid-lookup pattern from
// kn_bp143_2_dump_qid111_034.mjs / kn_bp143_2_dump_qid66_037_full.mjs
// (arr.find((r) => (r.question_id ?? r.qid ?? r.id) === qid), tried both numeric and string qid).
//
// For each target qid, prints:
//   - the full plowTrace.ensemble_candidates array (every entry, reasoning untruncated)
//   - the full plowTrace.authorityOutcomes object
//   - the plowTrace's own top-level key list (so nothing is missed by guessing field names)
//   - candidate "final chosen/accepted answer" fields found at either the plowTrace level or the
//     row level: plowTrace.concordance, plowTrace.voter_letters, plowTrace.bmv_score,
//     plowTrace.andon_triggered/andon_retries, plowTrace.condition, plowTrace.answer_type, and
//     row-level modelRawAnswer / parsedLetter / correctLetter / isCorrect / answeredBy / isAbstain.
//   - a scan of plowTrace's own keys (and the row's own keys) for any of the candidate field-name
//     guesses from the ticket (corroboration, chosenLetter, finalAnswer, acceptedLetter,
//     swarmResult, adjudicated) so absence is reported explicitly rather than assumed.
//
// Run: node scratchpad/kn_bp144_9_dump_qid111_full.mjs

import { readFileSync, writeFileSync } from 'node:fs';

const RECEIPT_PATH = 'C:\\Users\\Administrator\\Downloads\\041mnemo_mesh_test_receipt_2026-08-04T19-03-05-234Z.json';
const OUTPUT_PATH = 'C:\\Users\\Administrator\\Documents\\mnemosyne\\scratchpad\\kn_bp144_9_dump_qid111_full_output.txt';
const TARGET_QIDS = [111, 27, 46, 53, 59, 72, 98];
const GUESS_FIELD_NAMES = [
  'corroboration',
  'chosenLetter',
  'finalAnswer',
  'acceptedLetter',
  'swarmResult',
  'adjudicated',
];

const lines = [];
function out(str = '') {
  lines.push(str);
  console.log(str);
}

const rawText = readFileSync(RECEIPT_PATH, 'utf8');
const receipt = JSON.parse(rawText);

out(`Receipt: ${RECEIPT_PATH}`);
out(`Top-level receipt keys: ${JSON.stringify(Object.keys(receipt))}`);

const outcomes = receipt.outcomes ?? receipt.results ?? receipt.questions;
if (!Array.isArray(outcomes)) {
  out('FATAL: receipt has no outcomes array at the expected shape (tried .outcomes, .results, .questions).');
  writeFileSync(OUTPUT_PATH, lines.join('\n'), 'utf8');
  process.exit(1);
}
out(`Total questions in receipt: ${outcomes.length}`);
out('');

for (const qid of TARGET_QIDS) {
  out('');
  out(`================================================================================`);
  out(`qid ${qid}`);
  out(`================================================================================`);

  // Match either numeric or string qid, against question_id / qid / id, per the reference
  // scripts' lookup pattern (extended here to also try loose string equality).
  const row = outcomes.find((r) => {
    const candidateId = r.question_id ?? r.qid ?? r.id;
    return candidateId === qid || candidateId === String(qid) || String(candidateId) === String(qid);
  });

  if (!row) {
    out(`NOT FOUND in this receipt (no row with question_id/qid/id matching ${qid} or "${qid}").`);
    continue;
  }

  out(`Row's own top-level keys: ${JSON.stringify(Object.keys(row))}`);
  out(`question: ${row.question ?? '(none)'}`);
  out(`category: ${row.category ?? '(none)'}`);
  out('');
  out(`-- Row-level candidate "final answer" fields --`);
  out(`modelRawAnswer: ${JSON.stringify(row.modelRawAnswer)}`);
  out(`parsedLetter (model's final parsed answer): ${JSON.stringify(row.parsedLetter)}`);
  out(`correctLetter (ground truth): ${JSON.stringify(row.correctLetter)}`);
  out(`isCorrect: ${JSON.stringify(row.isCorrect)}`);
  out(`answeredBy: ${JSON.stringify(row.answeredBy)}`);
  out(`isAbstain: ${JSON.stringify(row.isAbstain)}`);
  out(`latencyMs: ${JSON.stringify(row.latencyMs)}`);
  out(`substrateContextInjected: ${JSON.stringify(row.substrateContextInjected)}`);

  const plowTrace = row.plowTrace;
  if (!plowTrace) {
    out('NO plowTrace field on this row.');
    continue;
  }

  out('');
  out(`-- plowTrace top-level keys (full structure, so no field is missed by guessing) --`);
  out(JSON.stringify(Object.keys(plowTrace)));

  out('');
  out(`-- plowTrace candidate "final chosen/accepted answer" fields --`);
  out(`concordance: ${JSON.stringify(plowTrace.concordance)}`);
  out(`voter_letters: ${JSON.stringify(plowTrace.voter_letters)}`);
  out(`voter_diagnostics: ${JSON.stringify(plowTrace.voter_diagnostics)}`);
  out(`bmv_score: ${JSON.stringify(plowTrace.bmv_score)}`);
  out(`andon_triggered: ${JSON.stringify(plowTrace.andon_triggered)}`);
  out(`andon_retries: ${JSON.stringify(plowTrace.andon_retries)}`);
  out(`condition: ${JSON.stringify(plowTrace.condition)}`);
  out(`reasoning_mode: ${JSON.stringify(plowTrace.reasoning_mode)}`);
  out(`answer_type: ${JSON.stringify(plowTrace.answer_type)}`);
  out(`research_arm_mode: ${JSON.stringify(plowTrace.research_arm_mode)}`);
  out(`specialists_used: ${JSON.stringify(plowTrace.specialists_used)}`);
  out(`candidates_raw: ${JSON.stringify(plowTrace.candidates_raw)}`);
  out(`candidates_post_miner: ${JSON.stringify(plowTrace.candidates_post_miner)}`);
  out(`candidatesPostFurnace: ${JSON.stringify(plowTrace.candidatesPostFurnace)}`);
  out(`gate_outcomes: ${JSON.stringify(plowTrace.gate_outcomes)}`);
  out(`eblets_written: ${JSON.stringify(plowTrace.eblets_written)}`);

  out('');
  out('-- Scan for ticket-guessed field names (reporting presence/absence explicitly) --');
  for (const name of GUESS_FIELD_NAMES) {
    const onRow = Object.prototype.hasOwnProperty.call(row, name);
    const onPlow = Object.prototype.hasOwnProperty.call(plowTrace, name);
    out(
      `  ${name}: on row=${onRow}${onRow ? ` (${JSON.stringify(row[name])})` : ''}, on plowTrace=${onPlow}${onPlow ? ` (${JSON.stringify(plowTrace[name])})` : ''}`,
    );
  }

  out('');
  out(`-- plowTrace.ensemble_candidates (full array, ${Array.isArray(plowTrace.ensemble_candidates) ? plowTrace.ensemble_candidates.length : 'MISSING'} entries) --`);
  out(JSON.stringify(plowTrace.ensemble_candidates, null, 2));

  out('');
  out('-- plowTrace.authorityOutcomes (full object) --');
  out(JSON.stringify(plowTrace.authorityOutcomes, null, 2));
}

out('');
out(`${TARGET_QIDS.length} target qid(s) processed: ${JSON.stringify(TARGET_QIDS)}`);

writeFileSync(OUTPUT_PATH, lines.join('\n'), 'utf8');
console.log(`\nOutput also written to: ${OUTPUT_PATH}`);
