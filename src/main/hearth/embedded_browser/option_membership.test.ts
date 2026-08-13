// option_membership.test.ts -- D-BP154-010/BISHOP/S10/seg-thepail
//
// FAIL-BEFORE/PASS-AFTER for THE HOLE IN THE PAIL. BP154_LOSSY_HOP_AUDIT.md, SILENT #1:
// looksLikeUiChrome() (webview_preload.ts) is a 5-regex DENYLIST, not a chrome detector -- this
// exact string passed it and was recorded as a real answer to an MC question:
//
//   "Thinking Your lianabanyan.com chats aren't used to improve our models. Gemini is AI and can
//    make mistakes. Your privacy & Gemini Opens in a new window"
//
// THE_PAIL_BP154.md's own instruction: apply the estate-ratified predicate (D-BP153-016 FIX 3 --
// "a passage naming none of the question's options cannot source a claim about them") AT THE
// CAPTURE HOP, not three hops downstream. This file is that predicate, extracted into a pure,
// DOM-free/electron-free module so it is unit-testable at all -- webview_preload.ts itself
// imports `electron` at module top level and cannot be imported under vitest (see this file's
// sibling header for why: the real 'electron' package resolves to a path string, not an API,
// outside a running Electron process).
//
// Deliberately the SAME shape as comparative_cascade.ts's own norm()/appearsIn() (that file is
// FORBIDDEN to modify by this ticket, and is a different module graph -- a preload-context file
// pulling in a Node-fetch-using, Ollama-calling module would be a real risk for a four-line
// helper). Reimplemented here, not imported, and pinned by this test file so drift is loud, not
// silent (same discipline evidence_store.ts's own crystal-conformance test already uses).

import { describe, expect, test } from 'vitest';
import { mentionsAnyOption } from './option_membership';

describe('mentionsAnyOption -- THE CAPTURE-HOP GATE', () => {
  test('THE MEASURED DEFECT: the real captured Gemini privacy-banner string names none of a real MC question\'s options -- rejected', () => {
    const capturedChrome =
      "Thinking Your lianabanyan.com chats aren't used to improve our models. Gemini is AI and can "
      + 'make mistakes. Your privacy & Gemini Opens in a new window';
    // qid 98's own option set (biomes/latitude-line distractors + the real macro-regions), per
    // THE_PAIL_BP154.md's own "biomes and the latitude line" framing.
    const mcOptions = [
      'A) Tropical Rainforest Biome', 'B) Sahara Desert Biome', 'C) Southeast Asia',
      'D) Equator', 'E) Sub-Saharan Africa', 'F) Latin America and the Caribbean',
    ];
    expect(mentionsAnyOption(capturedChrome, mcOptions)).toBe(false);
  });

  test('a genuine answer that restates one option verbatim is accepted', () => {
    const genuineAnswer = 'Based on the source, the correct region is C) Southeast Asia, a macro-geographic realm.';
    const mcOptions = ['A) Tropical Rainforest Biome', 'B) Sahara Desert Biome', 'C) Southeast Asia'];
    expect(mentionsAnyOption(genuineAnswer, mcOptions)).toBe(true);
  });

  test('matching is case- and punctuation-insensitive (real DOM text rarely matches byte-for-byte)', () => {
    const genuineAnswer = 'The answer is southeast asia, region C.';
    const mcOptions = ['A) Tropical Rainforest Biome', 'B) Sahara Desert Biome', 'C) Southeast Asia'];
    expect(mentionsAnyOption(genuineAnswer, mcOptions)).toBe(true);
  });

  test('no mcOptions given (free-text query, not an MC question) -- the gate does not apply, never rejects', () => {
    expect(mentionsAnyOption('any text at all, including chrome-shaped text', undefined)).toBe(true);
    expect(mentionsAnyOption('any text at all', [])).toBe(true);
  });

  test('an option text under 3 normalized characters is never used as a match needle (mirrors appearsIn\'s own guard, avoids single-letter false positives)', () => {
    const text = 'a completely unrelated passage about something else entirely';
    const mcOptions = ['A) X', 'B) I'];
    expect(mentionsAnyOption(text, mcOptions)).toBe(false);
  });

  test('empty/whitespace-only text is never a match, regardless of options', () => {
    expect(mentionsAnyOption('   ', ['A) Southeast Asia'])).toBe(false);
    expect(mentionsAnyOption('', ['A) Southeast Asia'])).toBe(false);
  });
});
