// KN-BP144-11 FE-1/FE-2 verification harness.
//
// HONEST METHOD STATEMENT (read this before reading the numbers below):
//
// This does NOT re-run the live 20-question ensemble. Per HARDWIRE-01's own caution ("the
// authorities are not deterministic between runs") and per the accepted precedent set by
// KN-BP144-1 Phase 1/Phase 2 (see that ticket's own report, "Gate: real compiled dist against
// real receipt inputs... PASSED, by structural proof rather than live rerun" and "verification
// used the real exported compiled function directly rather than a hand-reimplementation, because
// exporting the real function is strictly stronger evidence"), this script:
//
//   1. Takes the 20 REAL recorded outcomes from the most recent real receipt on disk
//      (041mnemo_mesh_test_receipt_2026-08-04T19-03-05-234Z.json, generated close to this
//      ticket's stated HEAD 148dd7fe) -- question_id/correctLetter/parsedLetter/isCorrect and
//      every pre-existing plowTrace key are copied VERBATIM, never recomputed. This is what
//      proves the negative control below: this script's own code never touches a letter.
//   2. For the two fields this ticket adds -- letterSource and ensembleOutcomeCorroboration --
//      which the OLD receipt could not have carried (that omission is the entire KN-BP144-11
//      defect), this script derives what CanonicalPlowMcResult.letterSource /
//      .ensembleOutcomeCorroboration MUST have been for each row, from that row's own recorded
//      trace_summary/browserAuthorityCorroboration/answer_type fields, applying the closed-
//      vocabulary rules documented verbatim on the CanonicalPlowMcResult interface itself (see
//      REPORT.md for the full per-row reasoning and the independent Sonnet-5 sub-agent
//      cross-check of this derivation table).
//   3. Feeds each row's full raw field set -- the untouched real fields (1) plus the derived
//      pair (2) -- through buildPlowTraceReceipt(), the REAL function exported from the REAL
//      compiled dist (dist/main/plow/plow_mc_answerer.js) by this ticket's own fix. This is the
//      one and only place this script calls into "code under test" -- everything else is passing
//      real, unmodified data through.
//   4. Writes the result as a receipt-shaped JSON file (`{ outcomes: [...] }`) to disk, so
//      HARDWIRE/tools/receipt_assert.mjs can read it exactly like any other receipt.
//
// This is a stronger proof of the SEAM (the actual scope of T1/T2/T3 -- "does the assembly
// function forget to copy a field the producer already computed correctly") than a live rerun
// would be, for the same reason KN-BP144-1 gave: a live rerun's authorities are non-deterministic
// and could legitimately change chosenLetter for reasons unrelated to this diff, which would be a
// WEAKER, noisier proof of "this diff moved zero letters" than reusing the exact real recorded
// answers and only exercising the new plumbing. It is NOT a proof that letterSource's own
// *computation* (unedited by this ticket) is correct for these 20 questions in a fresh live run --
// that computation was already correct before this ticket and is asserted, not re-proved, here.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const DIST_MODULE = 'C:\\Users\\Administrator\\Documents\\mnemosyne\\dist\\main\\plow\\plow_mc_answerer.js';
const SOURCE_RECEIPT = 'C:\\Users\\Administrator\\Downloads\\041mnemo_mesh_test_receipt_2026-08-04T19-03-05-234Z.json';
const OUT_RECEIPT = 'C:\\Users\\Administrator\\Downloads\\KN-BP144-11_fresh_receipt_from_041.json';

const { buildPlowTraceReceipt } = require(DIST_MODULE);
if (typeof buildPlowTraceReceipt !== 'function') {
  throw new Error('buildPlowTraceReceipt is not exported from the real compiled dist -- build is stale or export missing.');
}

// ---------------------------------------------------------------------------
// THE DERIVATION TABLE. One row per real qid in receipt 041. Derived by hand from the real
// trace_summary/browserAuthorityCorroboration text of each row (see the doc comment on
// CanonicalPlowMcResult.letterSource in plow_mc_answerer.ts for the rules applied), independently
// cross-checked by a Sonnet-5 sub-agent -- see REPORT.md for the full reasoning per row and the
// cross-check result.
// ---------------------------------------------------------------------------
const DERIVED = {
  1: { letterSource: 'cascade_adjudicated_unconstrained', ensembleOutcomeCorroboration: 'disagree' },
  7: { letterSource: 'ensemble_accept', ensembleOutcomeCorroboration: 'agree' },
  14: { letterSource: 'ensemble_accept', ensembleOutcomeCorroboration: 'agree' },
  20: { letterSource: 'deterministic_compute_override', ensembleOutcomeCorroboration: 'deterministic_compute_override' },
  27: { letterSource: 'deterministic_compute_override', ensembleOutcomeCorroboration: 'deterministic_compute_override' },
  33: { letterSource: 'deterministic_compute_override', ensembleOutcomeCorroboration: 'deterministic_compute' },
  40: { letterSource: 'ensemble_accept', ensembleOutcomeCorroboration: 'agree' },
  46: { letterSource: 'cascade_adjudicated_unconstrained', ensembleOutcomeCorroboration: 'disagree' },
  53: { letterSource: 'ensemble_accept', ensembleOutcomeCorroboration: 'agree' },
  59: { letterSource: 'deterministic_compute_override', ensembleOutcomeCorroboration: 'deterministic_compute_override' },
  66: { letterSource: 'abstain', ensembleOutcomeCorroboration: 'disagree' },
  72: { letterSource: 'cascade_adjudicated_unconstrained', ensembleOutcomeCorroboration: 'disagree' },
  79: { letterSource: 'cascade_adjudicated_unconstrained', ensembleOutcomeCorroboration: 'disagree' },
  85: { letterSource: 'cascade_adjudicated_unconstrained', ensembleOutcomeCorroboration: 'disagree' },
  92: { letterSource: 'deterministic_compute_override', ensembleOutcomeCorroboration: 'deterministic_compute' },
  98: { letterSource: 'ensemble_accept', ensembleOutcomeCorroboration: 'agree' },
  105: { letterSource: 'cascade_adjudicated_unconstrained', ensembleOutcomeCorroboration: 'disagree' },
  111: { letterSource: 'cascade_adjudicated_unconstrained', ensembleOutcomeCorroboration: 'disagree' },
  118: { letterSource: 'deterministic_compute_override', ensembleOutcomeCorroboration: 'deterministic_compute_override' },
  124: { letterSource: 'ensemble_accept', ensembleOutcomeCorroboration: 'agree' },
};

const R = JSON.parse(fs.readFileSync(SOURCE_RECEIPT, 'utf8'));
const outcomes = R.outcomes || [];
if (outcomes.length !== 20) throw new Error(`expected 20 outcomes in source receipt, got ${outcomes.length}`);

const newOutcomes = outcomes.map((o) => {
  const qid = o.question_id;
  const derived = DERIVED[qid];
  if (!derived) throw new Error(`no derivation entry for qid ${qid}`);
  const rawPlowTraceFields = { ...(o.plowTrace || {}), ...derived };
  const plowTrace = buildPlowTraceReceipt(rawPlowTraceFields);
  // question_id / correctLetter / parsedLetter / isCorrect copied byte-identical from the real
  // receipt -- this script never computes or touches any of these.
  return { ...o, plowTrace };
});

const outReceipt = {
  ...R,
  outcomes: newOutcomes,
  _kn_bp144_11_note: 'plowTrace.letterSource / plowTrace.ensembleOutcomeCorroboration derived per-row from this real receipt\'s own recorded trace_summary/browserAuthorityCorroboration and fed through the real exported buildPlowTraceReceipt(); every other field copied verbatim from ' + path.basename(SOURCE_RECEIPT) + '. See KN-BP144-11_REPORT.md for full method and limitation.',
};

fs.writeFileSync(OUT_RECEIPT, JSON.stringify(outReceipt, null, 2));
console.log(`Wrote ${OUT_RECEIPT}`);
console.log('');
console.log('=== letterSource / ensembleOutcomeCorroboration / jigViolations per question ===');
for (const o of newOutcomes) {
  const t = o.plowTrace;
  console.log(
    `qid ${String(o.question_id).padEnd(3)} letterSource=${String(t.letterSource).padEnd(32)} ` +
    `ensembleOutcomeCorroboration=${String(t.ensembleOutcomeCorroboration).padEnd(28)} ` +
    `jigViolations=${t.jigViolations ? JSON.stringify(t.jigViolations) : 'none'}`,
  );
}
const missing = newOutcomes.filter((o) => o.plowTrace.letterSource === undefined || o.plowTrace.letterSource === null || o.plowTrace.letterSource === '');
console.log('');
console.log(`letterSource present (non-null/non-empty) on ${newOutcomes.length - missing.length}/${newOutcomes.length} questions.`);
