// KN-BP144-8 Phase 1: attempt to exercise a genuine engine.abstained===true outcome (ticket
// 1.5's honest-abstention render path), which none of this session's other live/probe runs
// happened to produce (every other run's Three Fates voter still returned SOME answer text,
// even an "I don't know" flavored one -- answered-but-uncertain is not the same technical
// state as abstained). Same isolated-userData Electron probe technique as the other scripts
// in this pass. Deliberately asks a nonsense, unanswerable-by-any-real-source question with
// every BASE_OPERATORS specialist disabled, to see whether Andon's own separate fallback
// mechanism (observed adding backup operators regardless of the settings-disable override in
// the sibling FE-1 probe) can be exhausted down to zero real candidates.
'use strict';

const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const TEST_USERDATA = path.join(__dirname, 'kn_bp144_8_abstain_isolated_userdata');
fs.rmSync(TEST_USERDATA, { recursive: true, force: true });
fs.mkdirSync(TEST_USERDATA, { recursive: true });
app.setPath('userData', TEST_USERDATA);

app.whenReady().then(async () => {
  try {
    const DIST_PIPELINE = path.join(__dirname, '..', 'dist', 'main', 'plow', 'canonical_pipeline.js');
    const DIST_STORE = path.join(__dirname, '..', 'dist', 'main', 'mnem_eblet_store.js');
    const { runCanonicalFreeTextQuestion } = require(DIST_PIPELINE);
    const { writeVerifiedEblet } = require(DIST_STORE);
    const writeEbletFn = async (eblet) => { await writeVerifiedEblet(eblet); };

    const settingsPath = path.join(TEST_USERDATA, 'ai_dispatch_settings.json');
    fs.writeFileSync(settingsPath, JSON.stringify({
      mnem_drt_specialists: { wikipedia: false, wikidata: false, openalex: false, commoncrawl: false, crossref: false },
    }, null, 2), 'utf-8');

    const question = 'Zxqvorpblatt fnargle wizzendorf snorlockian gribbleshank -- what is its provenance?';
    const events = [];
    const r = await runCanonicalFreeTextQuestion(
      question, 'general', 'http://127.0.0.1:11434', 'llama3.1:8b', {}, writeEbletFn,
      (ev) => { events.push(ev.type); console.log('progress:', ev.type, ev.specialistName ? `(${ev.specialistName})` : ''); },
    );
    console.log('\nFull result:', JSON.stringify(r, null, 2));
    console.log('\nabstained === true?', r.abstained === true);
    process.exitCode = 0;
  } catch (err) {
    console.error('FATAL:', err);
    process.exitCode = 1;
  } finally {
    app.exit(process.exitCode || 0);
  }
});
