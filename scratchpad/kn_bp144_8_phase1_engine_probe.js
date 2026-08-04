// KN-BP144-8 Phase 1 engine-level far-end proof (FE-1, FE-2, FE-3, end-to-end substrate proof).
//
// Runs INSIDE a real Electron main process (`electron scratchpad\...\this_file.js`, the same
// technique KN-BP142-10's probe already used -- no BrowserWindow, just `app` so
// app.getPath('userData')/app.setPath resolve), against an ISOLATED userData dir so this run
// never touches the Founder's real live substrate or real settings file. Calls the REAL
// compiled dist function (runCanonicalFreeTextQuestion, dist/main/plow/canonical_pipeline.js)
// directly -- the exact function ai_dispatch_ipc.ts's new 'ai-dispatch:query-engine' handler
// calls, same call signature, same arguments shape, real Ollama, real Wikipedia/Wikidata network
// calls. This is the engine's own far end, not a re-implementation.
'use strict';

const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const TEST_USERDATA = path.join(__dirname, 'kn_bp144_8_isolated_userdata');
fs.rmSync(TEST_USERDATA, { recursive: true, force: true });
fs.mkdirSync(TEST_USERDATA, { recursive: true });
app.setPath('userData', TEST_USERDATA);

function section(title) {
  console.log('\n' + '='.repeat(90));
  console.log(title);
  console.log('='.repeat(90));
}

function writeSettings(mnem_drt_specialists) {
  const settingsPath = path.join(TEST_USERDATA, 'ai_dispatch_settings.json');
  fs.writeFileSync(settingsPath, JSON.stringify({ mnem_drt_specialists }, null, 2), 'utf-8');
}

app.whenReady().then(async () => {
  let allPass = true;
  const check = (label, cond) => {
    console.log(`${cond ? 'PASS' : 'FAIL'} -- ${label}`);
    if (!cond) allPass = false;
    return cond;
  };

  try {
    const DIST_PIPELINE = path.join(__dirname, '..', 'dist', 'main', 'plow', 'canonical_pipeline.js');
    const DIST_STORE = path.join(__dirname, '..', 'dist', 'main', 'mnem_eblet_store.js');
    const { runCanonicalFreeTextQuestion } = require(DIST_PIPELINE);
    const { writeVerifiedEblet } = require(DIST_STORE);

    const OLLAMA_BASE = 'http://127.0.0.1:11434';
    const MODEL = 'llama3.1:8b';
    const writeEbletFn = async (eblet) => { await writeVerifiedEblet(eblet); };

    // ── FE-3 + end-to-end substrate-hit half: seed one Tier-1 (proven) fact, then ask exactly
    //    that question and show the substrate hit short-circuits BEFORE any specialist fires ──
    section('SETUP: seed one Tier 1 (proven) fact into the isolated substrate');
    const substrateQuestion = 'What is 17 times 23, per KN-BP144-8 Phase 1 probe?';
    const substrateAnswer = '391';
    const seedSha = await writeVerifiedEblet({
      question: substrateQuestion,
      answer: substrateAnswer,
      provenance: 'deterministic_compute:formula:arithmetic:kn_bp144_8_probe',
      verified: true,
      sha256: '',
      timestamp: Date.now(),
      corroboration: 'deterministic_compute',
      class: 'component',
    });
    check('seed write returned a real sha256 confirmation', typeof seedSha === 'string' && seedSha.length === 64);

    section('FE-3 / END-TO-END (substrate-hit half): ask the exact seeded question');
    const substrateEvents = [];
    const r1 = await runCanonicalFreeTextQuestion(
      substrateQuestion, 'general', OLLAMA_BASE, MODEL, {}, writeEbletFn,
      (ev) => substrateEvents.push(ev.type),
    );
    console.log('Progress event sequence:', substrateEvents.join(' -> '));
    console.log('Result:', JSON.stringify(r1, null, 2));
    check('servedFromSubstrate === true (substrate read actually occurred and hit)', r1.servedFromSubstrate === true);
    check('substrateTier === "proven" (Tier 1, isRooted() said yes)', r1.substrateTier === 'proven');
    check('answerText is the exact seeded answer, byte-identical', r1.answerText === substrateAnswer);
    check(
      'event sequence starts substrate-check-start -> substrate-hit-rooted -> question-done, with ZERO specialist-related events (short-circuited before any authority queried)',
      substrateEvents[0] === 'substrate-check-start'
        && substrateEvents.includes('substrate-hit-rooted')
        && !substrateEvents.some((t) => t.startsWith('specialist-'))
        && !substrateEvents.includes('substrate-miss'),
    );
    check('specialistOutcomes is empty (nothing fired, honestly)', Array.isArray(r1.specialistOutcomes) && r1.specialistOutcomes.length === 0);
    check('abstained === false', r1.abstained === false);

    // ── END-TO-END (authority-path half) + FE-2: a DIFFERENT question, not in the substrate,
    //    with the real free/keyless specialists left at their tier-default (enabled) ──────────
    section('END-TO-END (authority-path half) + FE-2: a question NOT in the substrate, specialists ON (default)');
    const liveQuestion = 'What is the capital city of France?';
    writeSettings({}); // no overrides -> tier-default -> BASE_OPERATORS all enabled
    const onEvents = [];
    const r2 = await runCanonicalFreeTextQuestion(
      liveQuestion, 'general', OLLAMA_BASE, MODEL, {}, writeEbletFn,
      (ev) => onEvents.push(ev),
    );
    console.log('Progress event types:', onEvents.map((e) => e.type).join(' -> '));
    console.log('Result (authorities ON):', JSON.stringify(r2, null, 2));
    check('servedFromSubstrate === false (this question is genuinely not in the substrate)', r2.servedFromSubstrate === false);
    check('substrate-miss event fired before any specialist event', onEvents.findIndex((e) => e.type === 'substrate-miss') < onEvents.findIndex((e) => e.type === 'specialist-done'));
    check('specialistOutcomes is non-empty (at least one authority actually fired)', Array.isArray(r2.specialistOutcomes) && r2.specialistOutcomes.length > 0);
    const firedCountOn = r2.specialistOutcomes.filter((s) => s.fired).length;
    check(`at least one specialist reports fired:true (got ${firedCountOn} of ${r2.specialistOutcomes.length})`, firedCountOn > 0);
    check('FE-2: gateOutcomes populated by the engine (not synthesized by the Ask surface)', Array.isArray(r2.gateOutcomes) && r2.gateOutcomes.length > 0);
    check('FE-2: concordance populated by the engine', typeof r2.concordance === 'string' && r2.concordance.length > 0);
    check('FE-2: bmvScore populated by the engine (a real number)', typeof r2.bmvScore === 'number');

    // ── FE-1: the SAME liveQuestion, but now disable every BASE_OPERATORS specialist via the
    //    real settings-override mechanism (the same file the Settings tab UI writes to) ───────
    section('FE-1: the SAME question, all BASE_OPERATORS specialists explicitly disabled via settings');
    writeSettings({ wikipedia: false, wikidata: false, openalex: false, commoncrawl: false, crossref: false });
    const offEvents = [];
    const r3 = await runCanonicalFreeTextQuestion(
      liveQuestion, 'general', OLLAMA_BASE, MODEL, {}, writeEbletFn,
      (ev) => offEvents.push(ev),
    );
    console.log('Progress event types (authorities OFF):', offEvents.map((e) => e.type).join(' -> '));
    console.log('Result (authorities OFF):', JSON.stringify(r3, null, 2));
    check('specialistOutcomes is EMPTY when every authority is disabled (roster filtered to nothing)', Array.isArray(r3.specialistOutcomes) && r3.specialistOutcomes.length === 0);
    check(
      'FE-1 core claim: the answer DEPENDS on the toggle -- either the answerText differs, or the run abstains, versus the authorities-ON run',
      r3.abstained === true || r3.answerText !== r2.answerText,
    );

    section('FE-1 VERBATIM BEFORE/AFTER (required by the gate to be reported verbatim)');
    console.log('Question asked (identical both runs):', JSON.stringify(liveQuestion));
    console.log('Authorities ON  -> answerText:', JSON.stringify(r2.answerText), ' abstained:', r2.abstained, ' concordance:', r2.concordance, ' specialists fired:', r2.specialistOutcomes.filter((s) => s.fired).map((s) => s.name));
    console.log('Authorities OFF -> answerText:', JSON.stringify(r3.answerText), ' abstained:', r3.abstained, ' concordance:', r3.concordance, ' specialists fired:', r3.specialistOutcomes.filter((s) => s.fired).map((s) => s.name));

    section('OVERALL');
    console.log(allPass ? 'OVERALL: PASS' : 'OVERALL: FAIL -- see individual checks above.');
    process.exitCode = allPass ? 0 : 1;
  } catch (err) {
    console.error('FATAL:', err);
    process.exitCode = 1;
  } finally {
    app.exit(process.exitCode || 0);
  }
});
