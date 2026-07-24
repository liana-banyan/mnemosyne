// bp133_prove_substrate_toggle.cjs — BP133 Yoke #24 Task 1 empirical proof harness.
//
// Run with: node_modules\.bin\electron.cmd scripts\bp133_prove_substrate_toggle.cjs
//
// Boots Electron headless (no window) with an ISOLATED --user-data-dir (never touches the
// Founder's real profile/substrate), seeds a small verified_eblets.jsonl with (a) one
// TOPICAL entry (related to the question but not the same question) and (b) one EXACT-MATCH
// entry sharing the literal question text with a fabricated wrong-looking answer, then calls
// the actual applySubstrateToggle() function that is wired into every Ollama call in this
// test (local dispatch + WAN responder, both branches) with substrateEnabled=true and false
// for the SAME question. Writes both outbound prompts to a proof file so a byte-for-byte
// diff is possible, and asserts the exact-match entry never leaks into the ON prompt.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { app } = require('electron');

const isolatedUserData = path.join(os.tmpdir(), 'mnemosynec_bp133_proof_' + Date.now());
app.setPath('userData', isolatedUserData);

app.whenReady().then(async () => {
  try {
    const substrateDir = path.join(isolatedUserData, 'substrate');
    fs.mkdirSync(substrateDir, { recursive: true });
    const ebletFile = path.join(substrateDir, 'verified_eblets.jsonl');

    // Real bundled MMLU-Pro question (resources/mmlu_pro_bundled/questions.jsonl, id 1).
    const domain = 'biology';
    const questionText = 'Which of the following would most likely provide examples of mitotic cell divisions?';
    const optionsBlock = [
      'A. cross section of muscle tissue',
      'B. longitudinal section of a shoot tip',
      'C. longitudinal section of a leaf vein',
      'D. cross section of a fruit',
    ].join('\n');
    const basePrompt = `Answer the following multiple-choice question. Respond with ONLY the letter of the correct option, nothing else.\n\nQuestion: ${questionText}\n\n${optionsBlock}\n\nAnswer:`;

    // (a) TOPICAL entry -- a DIFFERENT question, same domain, should be eligible for
    // injection under queryVerifiedEbletsTopical (keyword overlap, exact-match excluded).
    // NOTE (BP133 finding, see Yoke-return): queryVerifiedEbletsTopical's own inline comment
    // says it scores "question text + answer", but the actual code tokenizes
    // `e.question + ' ' + e.provenance` -- e.answer is NEVER part of the score. This seed's
    // `question` and `provenance` fields deliberately share literal tokens ("mitotic",
    // "cell", "biology") with the real question below so the keyword-overlap scorer (exact
    // token match, no stemming -- "cell" and "cells" do NOT match each other) actually fires.
    const topicalEntry = {
      question: 'In biology, how does mitotic cell division in plant meristem tissue compare to animal cell division?',
      answer: 'Mitosis occurs in the meristematic (actively dividing) zone of plant root and shoot tips, producing two genetically identical diploid daughter cells.',
      provenance: 'biology mitotic cell division reference bp133-proof-seed-topical',
      verified: true,
      sha256: require('crypto').createHash('sha256').update('topical-seed-1').digest('hex'),
      timestamp: Date.now(),
    };

    // (b) EXACT-MATCH entry -- simulates the "Test It Out" cache-trap scenario: the LITERAL
    // question text, with an obviously-injected marker answer. If this ever leaked into the
    // substrate-ON prompt, it would prove the cache-trap is real and unguarded. It must NOT
    // appear in the ON output below, because applySubstrateToggle uses
    // queryVerifiedEbletsTopical (exact-match EXCLUDED), never queryVerifiedEblets.
    const exactMatchEntry = {
      question: questionText,
      answer: 'CACHE_TRAP_MARKER_SHOULD_NEVER_APPEAR_IN_OUTPUT: the answer is B, cross section of a shoot tip.',
      provenance: 'bp133-proof-seed-exact-match-simulating-test-it-out',
      verified: true,
      sha256: require('crypto').createHash('sha256').update('exact-match-seed-1').digest('hex'),
      timestamp: Date.now(),
    };

    fs.writeFileSync(
      ebletFile,
      JSON.stringify(topicalEntry) + '\n' + JSON.stringify(exactMatchEntry) + '\n',
      'utf8',
    );

    const { applySubstrateToggle } = require('../dist/main/mesh_test/substrate_toggle.js');

    const onResult = await applySubstrateToggle(basePrompt, questionText, domain, true);
    const offResult = await applySubstrateToggle(basePrompt, questionText, domain, false);

    const proof = {
      generatedAt: new Date().toISOString(),
      isolatedUserData,
      question: questionText,
      domain,
      ON: {
        substrateEnabled: true,
        contextInjected: onResult.contextInjected,
        ebletCount: onResult.ebletCount,
        promptChars: onResult.prompt.length,
        prompt: onResult.prompt,
        containsCacheTrapMarker: onResult.prompt.includes('CACHE_TRAP_MARKER'),
      },
      OFF: {
        substrateEnabled: false,
        contextInjected: offResult.contextInjected,
        ebletCount: offResult.ebletCount,
        promptChars: offResult.prompt.length,
        prompt: offResult.prompt,
        containsCacheTrapMarker: offResult.prompt.includes('CACHE_TRAP_MARKER'),
      },
      assertions: {
        onDiffersFromOff: onResult.prompt !== offResult.prompt,
        offEqualsBasePrompt: offResult.prompt === basePrompt,
        onContainsTopicalContext: onResult.prompt.includes('meristem'),
        onDoesNotContainExactMatchMarker: !onResult.prompt.includes('CACHE_TRAP_MARKER'),
        offMadeNoEbletCall: offResult.ebletCount === 0 && offResult.contextInjected === false,
      },
    };

    const outPath = path.join(process.cwd(), 'BP133_TASK1_SUBSTRATE_PROMPT_PROOF.json');
    fs.writeFileSync(outPath, JSON.stringify(proof, null, 2), 'utf8');

    console.log('=== BP133 Yoke #24 Task 1 PROOF ===');
    console.log('Wrote:', outPath);
    console.log(JSON.stringify(proof.assertions, null, 2));

    const allPass = Object.values(proof.assertions).every(Boolean);
    console.log(allPass ? '\nALL ASSERTIONS PASSED' : '\nASSERTION FAILURE -- SEE ABOVE');
    process.exitCode = allPass ? 0 : 1;
  } catch (err) {
    console.error('PROOF SCRIPT ERROR:', err);
    process.exitCode = 1;
  } finally {
    app.quit();
  }
});
