#!/usr/bin/env node
// bp153_subset.mjs -- D-BP153-005/BISHOP
//
// Reads a Sourced-Knowledge Benchmark plow-receipt JSONL and emits the ABSTAIN-or-WRONG subset.
//
// WHY THIS EXISTS. The Founder, BP153: "something tells me that the spectre of past issues is
// with us - we gather all the info, and then throw it away, somehow." He is right about this run
// specifically. The per-question receipts DO persist here, but the assembled run result the panel
// shows goes to localStorage under 'mnemo_last_mesh_test_result', which the NEXT run overwrites,
// and the .json download is manual and opt-in. So the durable copy is this JSONL and nothing
// else. This script reads it and never writes to it.
//
// READ-ONLY BY CONSTRUCTION. It opens the receipt file for reading and writes its output
// elsewhere. The Founder's run may still be in flight while this runs; a partially-written final
// line is expected and is counted, not crashed on.
//
// Usage:
//   node bp153_subset.mjs <receipts.jsonl> [--out subset.json]

import { readFileSync, writeFileSync } from 'node:fs';

const [, , receiptPath, ...rest] = process.argv;
if (!receiptPath) {
  console.error('usage: node bp153_subset.mjs <receipts.jsonl> [--out subset.json]');
  process.exit(2);
}
const outIdx = rest.indexOf('--out');
const outPath = outIdx >= 0 ? rest[outIdx + 1] : null;

const raw = readFileSync(receiptPath, 'utf8');
const lines = raw.split('\n').filter((l) => l.trim().length > 0);

const records = [];
let malformed = 0;
for (const line of lines) {
  try {
    records.push(JSON.parse(line));
  } catch {
    // A run still in flight can leave one half-written trailing line. Counted, never silent.
    malformed += 1;
  }
}

// CLASSIFICATION, STATED RATHER THAN ASSUMED.
// The persisted record carries `chosenAnswer`, `correctAnswer`, and `correct`. It does NOT carry
// the renderer's `isAbstain` flag -- that lives on the panel's own QuestionOutcome type and dies
// with localStorage. So abstain is INFERRED here from the absence of a chosen answer, and the
// inference is reported explicitly rather than hidden, so a wrong inference is visible instead of
// silently reshaping the subset.
const isAbstain = (r) => r.chosenAnswer == null
  || String(r.chosenAnswer).trim() === ''
  || String(r.chosenAnswer).trim().toUpperCase() === 'ABSTAIN';

const classified = records.map((r) => ({
  questionId: r.questionId,
  domain: r.domain,
  chosenAnswer: r.chosenAnswer ?? null,
  correctAnswer: r.correctAnswer ?? null,
  correct: r.correct === true,
  abstain: isAbstain(r),
  consensusLetter: r.consensusLetter ?? null,
  consensusCorrect: r.consensusCorrect ?? null,
  andonTriggered: r.andonTriggered ?? null,
  confidenceVariance: r.confidenceVariance ?? null,
  // The plow trace is the "HOW" material. Kept as a summary here; the full trace stays in the
  // receipt file, which is the source of truth this script never mutates.
  traceKeys: r.plowTrace ? Object.keys(r.plowTrace) : [],
  candidatesPostFurnace: r.plowTrace?.candidatesPostFurnace ?? null,
  browserAuthorityCorroboration: r.plowTrace?.browserAuthorityCorroboration ?? null,
  voterLetters: r.plowTrace?.voter_letters ?? null,
}));

const subset = classified.filter((c) => c.abstain || !c.correct);
const rightAnswers = classified.filter((c) => c.correct && !c.abstain);

const report = {
  schema: 'bp153-benchmark-subset/1',
  source: receiptPath,
  readAt: new Date().toISOString(),
  totals: {
    linesRead: lines.length,
    parsed: records.length,
    malformedOrInFlight: malformed,
    correct: rightAnswers.length,
    abstain: classified.filter((c) => c.abstain).length,
    wrongNotAbstain: classified.filter((c) => !c.correct && !c.abstain).length,
    subsetSize: subset.length,
  },
  // The whole point: the ones worth working.
  subset,
};

const summary = [
  `source: ${receiptPath}`,
  `lines: ${lines.length}   parsed: ${records.length}   malformed/in-flight: ${malformed}`,
  `correct: ${report.totals.correct}   abstain: ${report.totals.abstain}   wrong: ${report.totals.wrongNotAbstain}`,
  `SUBSET (abstain or wrong): ${subset.length}`,
  '',
  ...subset.map((s) => {
    const tag = s.abstain ? 'ABSTAIN' : 'WRONG  ';
    return `  ${tag}  qid=${String(s.questionId).padEnd(5)} domain=${String(s.domain || '?').padEnd(18)} chose=${String(s.chosenAnswer ?? '-').padEnd(8)} key=${s.correctAnswer ?? '-'}   postFurnace=${s.candidatesPostFurnace ?? '-'}  corrob=${s.browserAuthorityCorroboration ?? '-'}`;
  }),
].join('\n');

console.log(summary);

if (outPath) {
  writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nwrote ${outPath}`);
}
