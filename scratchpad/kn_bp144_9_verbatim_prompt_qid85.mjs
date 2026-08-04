// KN-BP144-9 Phase 0, item 0.3 support script: generates the REAL, exact composer/query text
// every browser authority receives for question 85 (the ticket's own worked example), using the
// REAL compiled buildMcAwareQueryText from dist/shared/plow/browser_authority_types.js -- not a
// hand-typed approximation. Read-only: does not touch the receipt or any src/ file.
//
// Purpose: prove/refute the ticket's 0.3 hypothesis ("if Gemini and ChatGPT receive different
// prompts, that difference is the defect") with the literal string each one is given.
//
// Run: node scratchpad/kn_bp144_9_verbatim_prompt_qid85.mjs

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { buildMcAwareQueryText } = require('../dist/shared/plow/browser_authority_types.js');

const question = 'Which of these statements correctly explains bias?';
const options = [
  "A) It describes a process that results in a sample that does not represent the population.",
  "B) It describes a process that results in a sample that is too large or too small.",
  "C) It describes a process that uses a random sampling method.",
  "D) It describes a process that results in a sample that perfectly represents the population.",
  "E) It describes a sample that is not representative of the population.",
  "F) It describes a process that always results in accurate estimates.",
  "G) It describes the influence of the researcher's personal beliefs on the outcome of the study.",
  "H) It describes a lack of randomization in the sampling process.",
  "I) It describes a process where the sampling method has no influence on the outcome of the study.",
  "J) It describes a process that creates estimates that are too high on average or too low on average.",
];

const text = buildMcAwareQueryText(question, options);
console.log('Real compiled buildMcAwareQueryText(question, options) output for qid 85:');
console.log('='.repeat(100));
console.log(text);
console.log('='.repeat(100));
console.log(`Length: ${text.length} chars`);
console.log(
  '\nPer plow_mc_answerer.ts (queryClaudeBrowserAuthorityObserved / queryChatGptBrowserAuthorityObserved / ' +
  'queryGeminiBrowserAuthorityObserved, all three call runBrowserAuthorityLookupObserved with the SAME ' +
  'mcOptionTexts array) and index.ts (runInteractiveBrowserAuthorityQueryObserved: ' +
  '"promptText = query.mcOptions ... ? buildMcAwareQueryText(...) : query.question"), this EXACT string ' +
  'is what setComposerText() types into user_claude, user_chatgpt, AND user_gemini\'s composer alike -- ' +
  'byte-for-byte identical for all three. There is no per-vendor branch anywhere in the prompt-' +
  'construction code path that would make Gemini\'s text differ from ChatGPT\'s.',
);
