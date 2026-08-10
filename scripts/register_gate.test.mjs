#!/usr/bin/env node
// register_gate.test.mjs -- D-BP151-041/BISHOP/seg-register-gate-inprocess
//
// Manual assert() + console output, same no-framework convention as this tree's other
// *.test.ts files (comparative_cascade.test.ts, cdp_guard.test.ts, mnem_eblet_store.test.ts).
// register_gate.mjs is already plain ESM (no tsc step needed) -- run directly:
//
//   node scripts\register_gate.test.mjs
//
// WHAT THIS TESTS, and why it replaces the old standalone-CLI self-test:
//   1. classifyOption()/isAssertion()/mentions()/headTokenFor() -- the pure classification core,
//      UNCHANGED by this ticket. Fixtures copied verbatim from the removed CLI self-test block
//      (the real Sahara/South America blocks that defeated the previous gate, register_gate.mjs's
//      own former lines 221-235) so that coverage is not lost, only relocated.
//   2. THE WIRING THIS TICKET ADDS: runRegisterGate()/defineContinents()/resolveScope() now take
//      an INJECTED askGoogle -- never dial CDP themselves. Proven two ways: (a) calling
//      runRegisterGate() with no askGoogle throws a clear, honest error rather than silently
//      falling back to a network dial that no longer exists; (b) calling it WITH a mock askGoogle
//      (no network, no Electron, no CDP) reproduces the same notRegions/CONFLICT/scope-resolution
//      behavior the old CDP-backed self-test proved live, using a fake in-memory Google.

import {
  classifyOption,
  isAssertion,
  mentions,
  headTokenFor,
  runRegisterGate,
  defineContinents,
  resolveScope,
} from './register_gate.mjs';

let passed = 0;
let failed = 0;

function assert(condition, label, detail) {
  if (condition) {
    console.log(`  [PASS] ${label}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${label}${detail ? ` -- ${detail}` : ''}`);
    failed++;
  }
}

console.log('register_gate.test.mjs -- D-BP151-041: injected-askGoogle wiring + pure-function coverage\n');

// ── 1. PURE-FUNCTION CORE, UNCHANGED -- fixtures relocated from the removed CLI self-test ──────
console.log('[1] classifyOption() -- the real blocks that broke the previous gate');
{
  const OPT = { A: 'South America', B: 'South Asia', C: 'North Africa', D: 'Northeast United States',
    E: 'Europe', F: 'Central Asia', G: 'Arctic Circle', H: 'Amazon Rainforest', I: 'Sahara Desert' };
  const all = Object.values(OPT);

  const saharaBlocks = [
    { title: '', body: 'The core desert biome encompasses about half that area, while the greater Sahara includes a full range of semiarid and related ecosystems.' },
    { title: 'Sahara -- Web results Sahara Wikipedia', body: 'a desert spanning North Africa. it is the largest hot desert in the world. The desert covers much of North Africa, excluding the fertile region' },
    { title: 'Sahara | Geography and Cartography', body: 'People also ask What is the Sahara Desert classified as? Is the Sahara Desert a biome or ecosystem?' },
  ];
  const samBlocks = [
    { title: '', body: "South America, fourth largest of the world's continents. It is the southern portion of the landmass generally referred to as the New World." },
    { title: 'Climate and Biomes in South America', body: 'South America features tropical, subtropical, temperate, and polar climate zones.' },
  ];

  for (const [name, blocks, expect] of [
    ['Sahara Desert', saharaBlocks, 'not_a_world_region'],
    ['South America', samBlocks, 'world_region'],
  ]) {
    const { verdict, evidence } = classifyOption(name, blocks, all);
    assert(verdict === expect, `${name}: classifyOption -> ${expect}`, `got ${verdict} [about=${evidence.about} feature=${evidence.featureHits.length} region=${evidence.regionHits.length}]`);
  }
}

console.log('\n[2] isAssertion() / mentions() / headTokenFor()');
{
  assert(isAssertion('The Sahara is a desert.') === true, 'isAssertion: a plain statement is an assertion');
  assert(isAssertion('Is the Sahara Desert a biome or ecosystem?') === false, 'isAssertion: a question is not an assertion');
  assert(isAssertion('People also ask What is the Sahara Desert classified as?') === false, 'isAssertion: "People also ask" is not an assertion');
  assert(isAssertion('A) Africa B) Antarctica C) Asia') === false, 'isAssertion: someone else\'s answer-option list is not an assertion');

  const allOpts = ['South America', 'South Asia'];
  assert(headTokenFor('South America', allOpts) === 'South America', 'headTokenFor: "South" collides between South America/South Asia, so it keeps the full text');
  assert(headTokenFor('Sahara Desert', ['Sahara Desert', 'Europe']) === 'Sahara', 'headTokenFor: "Sahara" is a unique leading token, so it reduces');
  assert(mentions('the Sahara is dry', 'Sahara Desert', ['Sahara Desert', 'Europe']) === true, 'mentions: matches via the unique head token');
  assert(mentions('Europe is temperate', 'Sahara Desert', ['Sahara Desert', 'Europe']) === false, 'mentions: does not match an unrelated option');
}

// ── 2. THE WIRING THIS TICKET ADDS ──────────────────────────────────────────────────────────────
console.log('\n[3] runRegisterGate() REQUIRES an injected askGoogle -- no CDP fallback exists');
{
  let threw = null;
  try {
    await runRegisterGate({ A: 'South America' }, { verbose: false });
  } catch (e) {
    threw = e;
  }
  assert(threw instanceof Error, 'runRegisterGate() with no askGoogle throws');
  assert(!!threw && /injected askGoogle/i.test(threw.message), 'thrown message names the injected-askGoogle requirement, not a CDP timeout/connection error', threw && threw.message);
  assert(!!threw && !/WebSocket|9333|fetch failed|ECONNREFUSED|CDP timeout|CDP socket/i.test(threw.message), 'thrown message is an honest "you must inject askGoogle" error, not a disguised CDP connection/timeout failure', threw && threw.message);

  let threwNoOpts = null;
  try {
    await runRegisterGate({ A: 'South America' });
  } catch (e) {
    threwNoOpts = e;
  }
  assert(threwNoOpts instanceof Error, 'runRegisterGate() called with opts omitted entirely also throws the same honest error (default {} has no askGoogle)');
}

console.log('\n[4] runRegisterGate() with a mock injected askGoogle -- no network, no CDP, no Electron');
{
  // A fake in-memory Google. Keyed on the EXACT question text register_gate.mjs sends, so this
  // also documents (and would break loudly if this ticket's edit changed) the question wording
  // runRegisterGate()/defineContinents()/resolveScope() actually send.
  const OPT = { A: 'South America', B: 'Sahara Desert', C: 'Europe' };
  const calls = [];
  const mockAskGoogle = async (question) => {
    calls.push(question);
    if (question === 'In geography, is South America classified as a world region, or as a desert, rainforest, biome or climate zone?') {
      return { ok: true, blocks: [{ title: '', body: "South America, fourth largest of the world's continents.", url: '', kind: 'answer_box' }] };
    }
    if (question === 'In geography, is Sahara Desert classified as a world region, or as a desert, rainforest, biome or climate zone?') {
      return { ok: true, blocks: [{ title: 'Sahara Wikipedia', body: 'a desert spanning North Africa, the largest hot desert in the world.', url: '', kind: 'organic' }] };
    }
    if (question === 'In geography, is Europe classified as a world region, or as a desert, rainforest, biome or climate zone?') {
      // BOTH a feature word (biome) and a region word (continent) -- forces CONFLICT -> resolveScope.
      return { ok: true, blocks: [{ title: 'Europe', body: 'Europe is a continent with many climate zones and biomes.', url: '', kind: 'organic' }] };
    }
    if (question === 'What are the seven continents of the world?') {
      return { ok: true, blocks: [{ title: '', body: 'The seven continents are Africa, Antarctica, Asia, Australia, Europe, North America and South America.', url: '', kind: 'answer_box' }] };
    }
    throw new Error(`mockAskGoogle: unexpected question -- ${question}`);
  };

  const { notRegions, report } = await runRegisterGate(OPT, { verbose: false, askGoogle: mockAskGoogle });

  assert(notRegions.includes('B') && notRegions.length === 1, 'notRegions is exactly [B] (Sahara Desert) -- South America and Europe both resolve as world regions', JSON.stringify(notRegions));
  assert(report.A.verdict === 'world_region', 'A (South America): world_region on the first pass, no conflict', report.A.verdict);
  assert(report.B.verdict === 'not_a_world_region', 'B (Sahara Desert): not_a_world_region', report.B.verdict);
  assert(report.C.verdict === 'world_region' && !!report.C.scope, 'C (Europe): CONFLICT resolved via scope to world_region (member of the sourced continent set)', JSON.stringify(report.C));
  assert(calls.includes('What are the seven continents of the world?'), 'the CONFLICT case actually invoked the scope-resolution question through the SAME injected askGoogle, not a second channel');
}

console.log('\n[5] defineContinents() / resolveScope() take askGoogle as their first argument');
{
  // continentSetCache (register_gate.mjs) is module-scoped and was already warmed by section
  // [4]'s Europe CONFLICT (its own mockAskGoogle answered "what are the seven continents").
  // defineContinents() below therefore returns that CACHED set without re-invoking THIS
  // section's mock for the continents question (by design -- see the module's own doc comment
  // on continentSetCache) -- the assertion still holds because both mocks source the same
  // seven-continent text. What this section genuinely exercises fresh is resolveScope()'s
  // SECOND call (the per-option containment question), which is never cached.
  const mockAskGoogle = async (question) => {
    if (question === 'What are the seven continents of the world?') {
      return { ok: true, blocks: [{ title: '', body: 'Africa, Antarctica, Asia, Australia, Europe, North America, South America.', url: '', kind: 'answer_box' }] };
    }
    if (question === 'What continent is Sahara Desert located in?') {
      return { ok: true, blocks: [{ title: '', body: 'The Sahara Desert lies within Africa.', url: '', kind: 'organic' }] };
    }
    throw new Error(`unexpected question: ${question}`);
  };
  const cont = await defineContinents(mockAskGoogle, false);
  assert(cont.names.includes('Africa') && cont.names.includes('South America'), 'defineContinents(askGoogle): continent set sourced via the injected function (possibly cached from section [4], same content)', JSON.stringify(cont.names));

  const scoped = await resolveScope(mockAskGoogle, 'Sahara Desert', ['Sahara Desert', 'Africa'], false);
  assert(scoped.verdict === 'not_a_world_region', 'resolveScope(askGoogle, "Sahara Desert", ...): not a continent, and is contained BY one -> not_a_world_region (this call is fresh, never cached)', JSON.stringify(scoped));
}

console.log(`\n${passed} passed, ${failed} failed`);
console.log(`EXIT:${failed > 0 ? 1 : 0}`);
process.exit(failed > 0 ? 1 : 0);
