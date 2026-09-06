#!/usr/bin/env node
// D-BP147-003 / KN-BP147-M1 -- "IS AGREEMENT BETWEEN LLMs EVIDENCE, OR AN ECHO?"
// Pure retro-replay over 8 historical receipts already on disk. NO new inference, NO live
// browser calls, NO network I/O of any kind. Reads only:
//   C:\Users\Administrator\Downloads\038..045mnemo_mesh_test_receipt_*.json
// Writes nothing (stdout only). Does not import, require, or modify any production file --
// the three pure functions replayed below are faithful, line-cited re-implementations of the
// real exported functions in plow_mc_answerer.ts (read-only citation, never executed from that
// file, since M1's OWNS block forbids writing/touching it and importing a .ts file from a
// plain .mjs script would require a build step this ticket is not authorized to run).
//
// SOURCE CITATIONS FOR THE REPLAYED LOGIC (all read-only; exact lines as of this replay):
//   resolveCakeDerivationPath      -- plow_mc_answerer.ts:1488-1511
//   STRUCTURED_AUTHORITIES set     -- plow_mc_answerer.ts:2225-2227
//   hasStructuredCorroborator      -- plow_mc_answerer.ts:2228-2230
//   eliminateDuplicateSwarmDerivationPath -- plow_mc_answerer.ts:2321-2330
//   runCandidateSourceCascadeAdjudicator (RULES 1-5) -- plow_mc_answerer.ts:2367-2451
//     (RULE 2's `isRooted`/`classifyCorroborationTier` dependency on rooting_rule.ts is stubbed
//      here to always return false for any authority !== 'deterministic_compute', which is a
//      structural NO-OP identical to the real function's own documented behavior at this call
//      shape -- plow_mc_answerer.ts:2265-2273 says so explicitly: "a real, honest, structural
//      NO-OP for every one of [this candidate shape] ... none carry that tag at this decision
//      point". A `deterministic_compute` candidate never reaches this replay's adjudicator call
//      at all, because it always short-circuits the shipped code's own earlier compute-override
//      return -- confirmed per-question below, never assumed.)
//
// Founder's Rule 8 (derived-quantity reconciliation), the mechanism axis mandated by
// D-BP147-003 UPDATE-01, is IMPLEMENTED AS A FUNCTION (`reconcileDerivedQuantity`, G1,
// plow_gom_jabbar.ts:150-185) but is UNWIRED -- plow_mc_answerer.ts's own comment at
// lines 1753-1761 states this explicitly: "G1 ... left UNWIRED this pass -- reported honestly
// here as an open gap rather than forced." No receipt candidate below therefore carries a real
// two-independent-search product-reconciliation verdict; Rule 8 cannot be read FROM the receipts
// as a recorded fact. This replay uses the coarser mechanism axis the receipts DO mechanically
// record (STRUCTURED_AUTHORITIES / hasStructuredCorroborator) as an honest, cited PROXY for
// Rule 8's spirit -- "is this backed by more than an assertion" -- and says so at every step,
// per Phase 0's own instruction to report rather than assume.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DOWNLOADS = 'C:\\Users\\Administrator\\Downloads';
const RECEIPT_RE = /^0(3[89]|4[0-5])mnemo_mesh_test_receipt_.*Z\.json$/;

// ---- faithful, cited re-implementations (see header) --------------------------------------

const STRUCTURED_AUTHORITIES = new Set(['wolfram_alpha', 'specialist_swarm', 'deterministic_compute']);
function hasStructuredCorroborator(group) {
  return group.some((c) => STRUCTURED_AUTHORITIES.has(c.authority));
}
function resolveCakeDerivationPath(candidate) {
  switch (candidate.authority) {
    case 'user_perplexity': return 'browser:user_perplexity';
    case 'user_google': return 'browser:user_google';
    case 'user_claude': return 'browser:user_claude';
    case 'user_chatgpt': return 'browser:user_chatgpt';
    case 'user_gemini': return 'browser:user_gemini';
    case 'wolfram_alpha': return 'deterministic_solver:wolfram_compute';
    case 'specialist_swarm': return 'swarm';
    case 'deterministic_compute': return `deterministic_solver:${candidate.method || 'unknown'}`;
    default: return `unknown:${candidate.authority}`;
  }
}
function eliminateDuplicateSwarmDerivationPath(pool) {
  const nonSwarmSurvivorExists = pool.some((c) => resolveCakeDerivationPath(c) !== 'swarm');
  const swarmEntries = pool.filter((c) => resolveCakeDerivationPath(c) === 'swarm');
  if (nonSwarmSurvivorExists && swarmEntries.length > 0) {
    return { survivors: pool.filter((c) => resolveCakeDerivationPath(c) !== 'swarm'), eliminated: swarmEntries };
  }
  return { survivors: [...pool], eliminated: [] };
}
// RULE 2 stub -- see header note. Structural no-op for this replay's candidate shapes.
function isRootedStub(authority) { return authority === 'deterministic_compute'; }

function runCandidateSourceCascadeAdjudicator(candidates) {
  const log = [];
  let pool = [...candidates];
  const describe = (g) => (g.length ? g.map((c) => `${c.authority}:${c.letter}`).join(', ') : 'none');

  const { survivors: poolAfterRule1, eliminated: swarmEntries } = eliminateDuplicateSwarmDerivationPath(pool);
  if (swarmEntries.length > 0) {
    pool = poolAfterRule1;
    log.push(`RULE1 eliminated [${describe(swarmEntries)}] (duplicate 'swarm' path, non-swarm survivor exists: [${describe(pool)}])`);
  } else {
    log.push(`RULE1 no-op (pool=[${describe(pool)}])`);
  }

  const rooted = pool.filter((c) => isRootedStub(c.authority));
  if (rooted.length > 0 && rooted.length < pool.length) {
    const demoted = pool.filter((c) => !rooted.includes(c));
    pool = rooted;
    log.push(`RULE2 eliminated [${describe(demoted)}] (outranked by rooted [${describe(rooted)}])`);
  } else {
    log.push(`RULE2 no-op (pool=[${describe(pool)}])`);
  }

  const structuredSurvivors = pool.filter((c) => hasStructuredCorroborator([c]));
  log.push(structuredSurvivors.length === 0
    ? 'RULE3 no-op (no STRUCTURED_AUTHORITIES survivor)'
    : `RULE3 [${describe(structuredSurvivors)}] structured, logged`);

  const distinctLetters = [...new Set(pool.map((c) => c.letter))];
  if (distinctLetters.length === 1 && pool.length > 0) {
    log.push(`RULE4 one distinct letter survives: ${distinctLetters[0]} backed by [${describe(pool)}]`);
    return { chosenLetter: distinctLetters[0], eliminationLog: log, survivingCandidates: pool };
  }
  log.push(`RULE5 ABSTAIN (${distinctLetters.length === 0 ? 'no survivor' : `${distinctLetters.length} distinct letters [${distinctLetters.join(',')}]`})`);
  return { chosenLetter: null, eliminationLog: log, survivingCandidates: pool };
}

// ---- receipt parsing ------------------------------------------------------------------------

function parseTraceSummary(s) {
  if (!s) return null;
  const get = (re) => (s.match(re) || [])[1] ?? null;
  const corroboration = get(/corroboration=(\S+?)(?:\s|$)/);
  const matchedOption = get(/matchedOption=(\S+?)(?:\s|$)/);
  const adjudicationAttempted = get(/adjudicationAttempted=(true|false)/) === 'true';
  const allCandStr = get(/allCandidates=\[([^\]]*)\]/) ?? '';
  const allCandidates = allCandStr.split(',').map((x) => x.trim()).filter(Boolean).map((pair) => {
    const idx = pair.lastIndexOf(':');
    return { authority: pair.slice(0, idx), letter: pair.slice(idx + 1) };
  });
  return { corroboration, matchedOption, adjudicationAttempted, allCandidates };
}

function loadReceipts() {
  const files = readdirSync(DOWNLOADS).filter((f) => RECEIPT_RE.test(f)).sort();
  if (files.length !== 8) {
    console.error(`FATAL: expected exactly 8 receipts (038-045), found ${files.length}: ${files.join(', ')}`);
    process.exit(1);
  }
  return files.map((f) => ({ file: f, data: JSON.parse(readFileSync(join(DOWNLOADS, f), 'utf8')) }));
}

// ---- classification -------------------------------------------------------------------------

function classifyQuestion(outcome) {
  const t = parseTraceSummary(outcome.plowTrace?.trace_summary);
  const correctLetter = outcome.correctLetter;
  const vendorCorrect = outcome.isCorrect === true;
  const vendorLetter = outcome.parsedLetter ?? outcome.modelRawAnswer ?? null;

  if (!t) {
    return {
      qid: outcome.question_id, correctLetter, vendorLetter, vendorCorrect,
      corroboration: '(no trace_summary)', mechanismLetter: vendorLetter, mechanismCorrect: vendorCorrect,
      mechanismNote: 'no trace_summary parsed -- mechanism verdict defaults to vendor verdict', agreeingGroup: [],
    };
  }

  // Compute-derived acceptance: already grounded, no vendor-echo question applies.
  if (t.corroboration === 'deterministic_compute' || t.corroboration === 'deterministic_compute_override') {
    return {
      qid: outcome.question_id, correctLetter, vendorLetter, vendorCorrect,
      corroboration: t.corroboration, mechanismLetter: vendorLetter, mechanismCorrect: vendorCorrect,
      mechanismNote: 'compute-derived accept -- mechanism verdict = vendor verdict (no bare-LLM-echo question applies)',
      agreeingGroup: t.allCandidates,
    };
  }

  if (t.corroboration === 'agree') {
    const agreeingGroup = t.allCandidates.filter((c) => c.letter === t.matchedOption);
    const structured = hasStructuredCorroborator(agreeingGroup);
    if (structured) {
      return {
        qid: outcome.question_id, correctLetter, vendorLetter, vendorCorrect,
        corroboration: t.corroboration, mechanismLetter: vendorLetter, mechanismCorrect: vendorCorrect,
        mechanismNote: `agree, but structured corroborator present in agreeing group [${agreeingGroup.map(c=>c.authority).join(',')}] -- mechanism gate ALSO accepts`,
        agreeingGroup,
      };
    }
    // Bare-LLM-only agreement: mechanism gate withholds the fast accept, replays the REAL
    // (cited, faithfully reimplemented) cascade adjudicator over the FULL candidate pool.
    const adjResult = runCandidateSourceCascadeAdjudicator(t.allCandidates);
    const mechanismLetter = adjResult.chosenLetter;
    const mechanismCorrect = mechanismLetter !== null && mechanismLetter === correctLetter;
    return {
      qid: outcome.question_id, correctLetter, vendorLetter, vendorCorrect,
      corroboration: t.corroboration, mechanismLetter, mechanismCorrect,
      mechanismAbstain: mechanismLetter === null,
      mechanismNote: `agree, BARE-LLM-ONLY (no STRUCTURED_AUTHORITIES in agreeing group [${agreeingGroup.map(c=>c.authority).join(',')}]) -- mechanism gate withholds fast-accept, cascade replay: ${adjResult.eliminationLog.join(' | ')}`,
      agreeingGroup, fullPool: t.allCandidates,
    };
  }

  // disagree / adjudicated / none / single_authority / lone_rejected_by_strictness / etc --
  // vendor-diversity never used bare-agreement here either; no additional echo risk introduced.
  return {
    qid: outcome.question_id, correctLetter, vendorLetter, vendorCorrect,
    corroboration: t.corroboration, mechanismLetter: vendorLetter, mechanismCorrect: vendorCorrect,
    mechanismNote: `corroboration='${t.corroboration}' -- vendor-diversity itself never fast-accepted on bare agreement here; mechanism verdict = vendor verdict`,
    agreeingGroup: t.allCandidates,
  };
}

// ---- main -------------------------------------------------------------------------------------

const receipts = loadReceipts();
console.log(`Loaded ${receipts.length} receipts: ${receipts.map(r => r.file).join(', ')}`);

const allRows = [];
for (const { file, data } of receipts) {
  for (const outcome of data.outcomes) {
    const c = classifyQuestion(outcome);
    allRows.push({ file, ...c });
  }
}
console.log(`Total (receipt, question) rows: ${allRows.length}`);

// PHASE A -- enumerate the wrong-answer set (vendor-diversity / shipped verdict), walked to the
// end of all 8 receipts, per D-BP146-006 UPDATE-01 ordering (wrong-answer subset first).
const wrongRows = allRows.filter((r) => !r.vendorCorrect);
console.log(`\n=== PHASE A: WRONG-ANSWER SET (vendor/shipped verdict), all 8 receipts, n=${wrongRows.length} ===`);
for (const r of wrongRows) {
  console.log(`${r.file} qid${r.qid}: shipped=${r.vendorLetter} correct=${r.correctLetter} corroboration=${r.corroboration}`);
}

// PHASE B -- mechanism reclassification on the FULL corpus (all 160 rows), building the paired
// table. (Running on the wrong-answer subset alone would hide the "what does it break" question
// D-BP147-003's own Phase 2 explicitly requires -- so this replay computes the full paired table,
// then reports the wrong-answer subset's slice of it separately, satisfying both orderings.)
console.log(`\n=== PHASE B/C: PAIRED TABLE, VENDOR-DIVERSITY vs MECHANISM-DIVERSITY, n=${allRows.length} ===`);

let bothAgree = 0, vendorRightMechWrong = 0, mechRightVendorWrong = 0, bothWrong = 0, mechAbstainVendorRight = 0, mechAbstainVendorWrong = 0;
const flips = { broke: [], fixed: [] };

for (const r of allRows) {
  const mCorrect = r.mechanismCorrect === true;
  const mAbstain = r.mechanismAbstain === true;
  if (mAbstain) {
    if (r.vendorCorrect) { mechAbstainVendorRight++; flips.broke.push(r); }
    else { mechAbstainVendorWrong++; }
    continue;
  }
  if (r.vendorCorrect && mCorrect) bothAgree++;
  else if (r.vendorCorrect && !mCorrect) { vendorRightMechWrong++; flips.broke.push(r); }
  else if (!r.vendorCorrect && mCorrect) { mechRightVendorWrong++; flips.fixed.push(r); }
  else { bothWrong++; }
}
// "both agree" should also count the both-wrong-and-agreeing-it's-wrong case for row1 per the
// ticket's own table shape ("both taxonomies AGREE" = same verdict, not just same on correct)
const bothAgreeOnWrong = allRows.filter((r) => !r.vendorCorrect && r.mechanismCorrect !== true && r.mechanismAbstain !== true).length;

console.log(`n=${allRows.length}`);
console.log(`both taxonomies AGREE (both correct):              n=${bothAgree}`);
console.log(`both taxonomies AGREE (both incorrect/non-accept): n=${bothAgreeOnWrong}`);
console.log(`DIFFER, vendor-verdict was right (mechanism wrong or abstain): n=${vendorRightMechWrong + mechAbstainVendorRight}`);
console.log(`DIFFER, mechanism-verdict was right (vendor was wrong):        n=${mechRightVendorWrong}`);
console.log(`  (of which mechanism ABSTAIN where vendor was correct: n=${mechAbstainVendorRight})`);
console.log(`  (of which mechanism ABSTAIN where vendor was wrong:   n=${mechAbstainVendorWrong}, not counted as a fix)`);
console.log(`DECIDING NUMBER (row3 - row2) = ${mechRightVendorWrong} - ${vendorRightMechWrong + mechAbstainVendorRight} = ${mechRightVendorWrong - (vendorRightMechWrong + mechAbstainVendorRight)}`);

console.log(`\n--- Questions where mechanism-diversity would FIX a vendor-diversity wrong answer (n=${flips.fixed.length}) ---`);
for (const r of flips.fixed) {
  console.log(`${r.file} qid${r.qid}: vendor=${r.vendorLetter}(WRONG) mechanism=${r.mechanismLetter}(CORRECT, =${r.correctLetter}) | ${r.mechanismNote}`);
}

console.log(`\n--- Questions where mechanism-diversity would BREAK a vendor-diversity correct answer (n=${flips.broke.length}) ---`);
for (const r of flips.broke) {
  const mLbl = r.mechanismAbstain ? 'ABSTAIN' : r.mechanismLetter;
  console.log(`${r.file} qid${r.qid}: vendor=${r.vendorLetter}(CORRECT) mechanism=${mLbl} correct=${r.correctLetter} | ${r.mechanismNote}`);
}

// qid 92 WITNESS (never target) -- report its behavior across all 8 receipts explicitly.
console.log(`\n=== qid92 WITNESS (never a target) across all 8 receipts ===`);
for (const r of allRows.filter((r) => r.qid === 92)) {
  const mLbl = r.mechanismAbstain ? 'ABSTAIN' : r.mechanismLetter;
  console.log(`${r.file}: vendor=${r.vendorLetter}(${r.vendorCorrect ? 'right' : 'WRONG'}) corroboration=${r.corroboration} mechanism=${mLbl}(${r.mechanismCorrect ? 'right' : r.mechanismAbstain ? 'abstain' : 'wrong'}) correct=${r.correctLetter}`);
}

// qid85 WITNESS -- abstain behavior across all 8.
console.log(`\n=== qid85 (abstain-fires-3-of-8 per prior return) cross-check across all 8 receipts ===`);
for (const r of allRows.filter((r) => r.qid === 85)) {
  console.log(`${r.file}: vendor=${r.vendorLetter}(${r.vendorCorrect ? 'right' : 'WRONG'}) corroboration=${r.corroboration} correct=${r.correctLetter}`);
}

console.log('\n=== END OF REPLAY ===');
