// verify_kn_bp141_3_stage2_c4_bidirectional.js -- KN-BP141-3 Stage 2, verification requirement (d).
//
// "Stage 2 C4 on the real qid 98 option set: does any source reverse its own ranking cleanly?
// Report pass/fail per source, no tidying." qid 98 (per KN-BP141-1/BP141-2's own convention) is
// other/source_id 5723, the world's-most-densely-populated-regions question. Each "source" here is
// one local Ollama model on this machine, queried TWICE with FRESH, INDEPENDENT /api/generate calls
// (no conversation history carried between the two calls) -- once for a most-to-least ranking, once
// for a least-to-most ranking of the SAME 9 real dataset options. Real model output, real
// arithmetic (string reversal + exact positional comparison via the real compiled
// checkBidirectionalConsistency), never scripted/faked.
'use strict';

const path = require('path');
const fs = require('fs');

const DIST_CASCADE = path.join(__dirname, '..', 'dist', 'main', 'plow', 'plow_mc_elimination_cascade.js');
const { checkBidirectionalConsistency } = require(DIST_CASCADE);

const DATASET_ROOT = 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\lb-reproducibility-pack\\datasets\\mmlu_pro_per_domain';
const OLLAMA_BASE_URL = 'http://localhost:11434';
const MODELS = ['llama3.3:70b', 'llama3.1:8b', 'gemma4:12b'];

function letterFromIndex(i) {
  return String.fromCharCode(65 + i);
}

async function callOllamaFresh(prompt, model) {
  const resp = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      think: false,
      options: { temperature: 0.0, num_predict: 120 },
    }),
  });
  if (!resp.ok) {
    // Some models reject the `think` field outright -- retry without it, same fallback
    // canonical_pipeline.ts's own callOllama uses.
    const resp2 = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false, options: { temperature: 0.0, num_predict: 120 } }),
    });
    if (!resp2.ok) throw new Error('Ollama HTTP ' + resp2.status + ' for model ' + model);
    const data2 = await resp2.json();
    return data2.response ?? '';
  }
  const data = await resp.json();
  return data.response ?? '';
}

/** Parses a comma/space-separated sequence of single letters A-I out of a raw model completion,
 *  preserving first-occurrence order and deduplicating repeats -- a model that repeats a letter or
 *  adds prose around the list should still yield SOME letter sequence for the bidirectional check
 *  to compare, rather than crashing the script; the raw completion is always also printed and
 *  passed through for inspection so nothing is hidden. */
function parseLetterSequence(raw, validLetters) {
  const found = [];
  const seen = new Set();
  const re = /\b([A-I])\b/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const letter = m[1];
    if (!validLetters.includes(letter)) continue;
    if (seen.has(letter)) continue;
    seen.add(letter);
    found.push(letter);
  }
  return found;
}

function divider(title) {
  console.log('\n' + '='.repeat(78));
  console.log(title);
  console.log('='.repeat(78));
}

async function main() {
  divider('LOADING REAL DATASET RECORD: other/source_id 5723 (qid 98)');
  const arr = JSON.parse(fs.readFileSync(path.join(DATASET_ROOT, 'other', 'questions.json'), 'utf8'));
  const rec = arr.find((q) => q.source_id === '5723');
  if (!rec) {
    console.error('FATAL: could not find source_id 5723 in other/questions.json');
    process.exit(1);
  }
  console.log('Question:', rec.question);
  const letters = rec.options.map((_, i) => letterFromIndex(i));
  const optionsBlock = rec.options.map((opt, i) => `${letterFromIndex(i)}) ${opt}`).join('\n');
  console.log('Options:\n' + optionsBlock);
  console.log('Real correct_answer:', rec.correct_answer, '(letter', letterFromIndex(rec.options.indexOf(rec.correct_answer)) + ')');

  const mostToLeastPrompt =
    `Rank the following ${rec.options.length} items from MOST densely populated to LEAST densely ` +
    `populated. Reply with ONLY the letters in order, comma-separated, nothing else -- no ` +
    `explanation, no reasoning.\n\n${optionsBlock}\n\nYour ranking (letters only, most to least, comma-separated):`;
  const leastToMostPrompt =
    `Rank the following ${rec.options.length} items from LEAST densely populated to MOST densely ` +
    `populated. Reply with ONLY the letters in order, comma-separated, nothing else -- no ` +
    `explanation, no reasoning.\n\n${optionsBlock}\n\nYour ranking (letters only, least to most, comma-separated):`;

  const results = [];
  for (const model of MODELS) {
    divider('SOURCE: ' + model);
    let mostToLeastRaw, leastToMostRaw;
    try {
      console.log('Querying (fresh call 1/2, most-to-least)...');
      mostToLeastRaw = await callOllamaFresh(mostToLeastPrompt, model);
      console.log('Raw response (most-to-least):', JSON.stringify(mostToLeastRaw));
    } catch (e) {
      console.error('  FAILED to query ' + model + ' for most-to-least: ' + e);
      results.push({ source: model, error: String(e) });
      continue;
    }
    try {
      console.log('Querying (fresh call 2/2, least-to-most)...');
      leastToMostRaw = await callOllamaFresh(leastToMostPrompt, model);
      console.log('Raw response (least-to-most):', JSON.stringify(leastToMostRaw));
    } catch (e) {
      console.error('  FAILED to query ' + model + ' for least-to-most: ' + e);
      results.push({ source: model, error: String(e) });
      continue;
    }

    const mostToLeast = parseLetterSequence(mostToLeastRaw, letters);
    const leastToMost = parseLetterSequence(leastToMostRaw, letters);
    console.log('Parsed most-to-least:', mostToLeast.join(','), '(' + mostToLeast.length + '/' + letters.length + ' letters found)');
    console.log('Parsed least-to-most:', leastToMost.join(','), '(' + leastToMost.length + '/' + letters.length + ' letters found)');

    const check = checkBidirectionalConsistency(model, mostToLeast, leastToMost);
    console.log('\n' + check.trace);
    results.push({ source: model, ...check });
  }

  divider('SUMMARY (real result, no tidying)');
  for (const r of results) {
    if (r.error) {
      console.log(r.source + ': ERROR -- ' + r.error);
    } else {
      console.log(r.source + ': ' + (r.consistent ? 'PASS (reversed its own ranking cleanly)' : 'FAIL (did NOT reverse its own ranking cleanly)'));
    }
  }
  const passCount = results.filter((r) => r.consistent === true).length;
  const failCount = results.filter((r) => r.consistent === false).length;
  const errorCount = results.filter((r) => r.error).length;
  console.log('\nTotals: ' + passCount + ' PASS / ' + failCount + ' FAIL / ' + errorCount + ' ERROR out of ' + results.length + ' sources queried.');
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
