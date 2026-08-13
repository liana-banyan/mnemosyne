// classify_cascade.degenerate_frame.test.ts -- D-BP154-005/BISHOP-SEG/S5/seg-degenframe
//
// THE MEASURED FAILURE THIS FILE CLOSES (live run, LIANA_RUN_qid98_2026-08-13T20-06-45-304Z.json,
// build carrying 769e0bd3; NOT the fresh-query path -- the OWNED "operation" passage this receipt
// already had). Quoted verbatim from the receipt's own transcript:
//
//   FRAME: answered FROM OWNED EVIDENCE (passage 1 of 1, already acquired this run -- NO NEW QUERY
//   ISSUED) -- stated category kind "macro-realms" (per the source) excludes {A) South America, B)
//   South Asia, C) North Africa, D) Northeast United States, E) Europe, F) Central Asia, G) Arctic
//   Circle, H) Amazon Rainforest, I) Sahara Desert}, keeps {none}
//
// DIAGNOSIS (TICKET_D-BP154-005_THE_DEGENERATE_FRAME.md Part 2 -- performed BEFORE any fix, per the
// ticket's own ordering; recorded in full in HARDWIRE\LEDGER\RETURNS\D-BP154-005.return.md).
// REPRODUCED DIRECTLY against the real Ollama channel (gemma4:12b, temperature 0, num_predict 1024,
// byte-identical prompt construction to gemmaExtract()/comparative_cascade.ts), fed the REAL
// "operation" passage this receipt's own transcript quotes verbatim (REAL_OPERATION_PASSAGE, below):
// every per-option `kind` comes back copied VERBATIM off its own heading ("Macro-Geographic Regions
// (Realms)", "Physical Biomes / Environmental Zones", "Sub-National Regions"); `category_kind` comes
// back "macro-realms" -- a DIFFERENT, shorter, verbatim string, copied faithfully from a LATER,
// SEPARATE sentence in the SAME passage ("If \"region\" is restricted strictly to macro-realms (e.g.,
// UN world regions), options like the Amazon Rainforest or Sahara Desert cease to qualify..."). Both
// reads are faithful, verbatim, HARDWIRE-22-clean copies -- REAL_DEGENERATE_RESPONSE, below, is that
// ACTUAL captured model output, not a hand-authored fixture. THIS IS CANDIDATE (a), VOCABULARY
// MISMATCH -- ruled out: (b) ABSENCE TREATED AS EXCLUSION (every kind here is non-null and verified,
// nothing is inferred from silence; D-BP153-020's own correction is a wholly separate function,
// TEST 5 below proves it untouched) and (c) WRONG PASSAGE (a human reading REAL_OPERATION_PASSAGE
// identifies exactly which five options are macro-realms; the passage answers the question, the
// STRING comparison against it is what fails).
//
// THE FIX (classify_cascade.ts, establishFrame(), isDegenerateFrameElimination()): a zero-survivor
// read (every stated kind compared as "differs from the category kind", nothing kept) is never
// trusted as an established frame. The owned-passage path falls through to a fresh query exactly as
// an INCOMPLETE read already does (D-BP153-023); if the fresh read ALSO keeps zero, establishFrame()
// returns `degenerate: true` with a DISTINCT reason, never `excluded: ALL, included: []`.
// applyFrameKindElimination()'s own PURE-CODE comparison is UNCHANGED -- a genuine, PARTIAL mismatch
// (some kept, some not) is untouched (TEST 3, this file, and every pre-existing
// classify_cascade.frame_stated_kind.test.ts assertion, unmodified, still passes).
//
// FAIL-BEFORE/PASS-AFTER, PERFORMED (this file's own D-BP154-005.return.md carries the verbatim
// terminal output): `git stash push -- src/main/liana_cycle/methods/classify_cascade.ts`, then
// `npx vitest run` THIS file alone reproduces the measured bug (TEST 1/TEST 2 fail: `frame.excluded`
// is all nine, `frame.included` is empty, `frame.degenerate` is undefined); `git stash pop` restores
// the fix and both pass.
//
// TESTED DIRECTLY AGAINST SOURCE (never dist), same offline convention every classify_cascade.*.
// test.ts sibling uses: askGoogle is a local stub, global.fetch (gemmaExtract()'s own Ollama channel)
// is monkey-patched per test, nothing live anywhere in this file.

import {
  describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest';
// D-BP153-031, TEST ISOLATION: pinning LB_DRAW_REPEATS=1 keeps this file's own fresh-query calls to
// exactly one draw each -- same convention every classify_cascade.*.test.ts sibling uses. The
// channel-variance repeat/disagreement behavior itself is covered by
// classify_cascade.repeated_draws.test.ts, not here.
beforeEach(() => { process.env.LB_DRAW_REPEATS = '1'; });
afterEach(() => { delete process.env.LB_DRAW_REPEATS; });

import { establishFrame, applyFrameKindElimination, reconcileNamedSet } from './classify_cascade';
import type { MethodRunContext, OwnedPassage } from '../method_registry';

// qid 98's option letters, from resources/mmlu_pro_bundled/questions.jsonl -- the SAME mapping every
// classify_cascade.*.test.ts sibling uses.
const OPT: Record<string, string> = {
  A: 'South America',
  B: 'South Asia',
  C: 'North Africa',
  D: 'Northeast United States',
  E: 'Europe',
  F: 'Central Asia',
  G: 'Arctic Circle',
  H: 'Amazon Rainforest',
  I: 'Sahara Desert',
};
const ALL = Object.keys(OPT);
const CATEGORY = 'world regions';

const owned = (text: string): OwnedPassage => ({ text, kind: 'operation' });

function notes(): { note: (text: string) => void; log: string[] } {
  const log: string[] = [];
  return { note: (text: string) => log.push(text), log };
}

// ─────────────────────────── THE REAL EVIDENCE, VERBATIM OFF THE RECEIPT ───────────────────────────
//
// LIANA_RUN_qid98_2026-08-13T20-06-45-304Z.json's own "operation" passage, transcribed verbatim
// (never retyped by hand into shorter form) so spanIsVerbatim()/appearsIn() below check against the
// SAME text the live run actually fed gemmaExtract().
const REAL_OPERATION_PASSAGE = 'The multiple-choice options reveal a deliberate trick: while South Asia, Europe, and the Northeast United States represent major population clusters, choices like the Arctic Circle, Amazon Rainforest, Sahara Desert, Central Asia, North Africa, and South America are generally not classified as high arithmetic population density regions. The presence of multiple seemingly correct options highlights how key words and phrases in this question can be interpreted in ways that fundamentally alter what is being asked. Key Terms That Fundamentally Change the Meaning 1. "Densely Populated" (Type of Population Density) In human geography, "density" is not a single calculation. Depending on which metric you use, the correct answer flips dramatically: Arithmetic Density ( Total Land Area Total Population ​ ): This is the standard assumption. Under this definition, regions like the Sahara Desert, Arctic Circle, and Amazon Rainforest are among the least densely populated places on Earth. Physiological Density ( Arable Land Area Total Population ​ ): This measures population relative to land that can actually grow food. Under this definition, regions like North Africa (e.g., Egypt) or Central Asia suddenly become some of the most densely populated regions on the planet because their farmable land is extremely scarce compared to their population size. Agricultural Density ( Arable Land Area Total Farmers ​ ): Measures technological development in farming rather than general settlement patterns. Impact: Interpreting "densely populated" as physiological density instead of arithmetic density turns non-dense regions (like North Africa) into world leaders in density. 2. "World Region" (Geographic Scale & Classification) The options mix entirely different spatial scales and geographic categories: Macro-Geographic Regions (Realms): South Asia, Europe, South America, Central Asia, North Africa. Physical Biomes / Environmental Zones: Amazon Rainforest, Sahara Desert, Arctic Circle. Sub-National Regions: Northeast United States. Impact: If "region" is restricted strictly to macro-realms (e.g., UN world regions), options like the Amazon Rainforest or Sahara Desert cease to qualify as valid regions, shifting the focus to Central Asia, South America, or North Africa. 3. "World\'s Most" (Threshold of Comparison) "Most" can imply either a strict, elite global tier or a broader relative standard: Primary Global Clusters: Geographers traditionally recognize only three or four primary high-density clusters (East Asia, South Asia, Europe, and Southeast Asia). Secondary Clusters: The Northeast United States (the Megalopolis / BosWash corridor) is often classified as a secondary cluster. Impact: If "world\'s most" strictly means the top-tier primary global clusters, the Northeast United States could be considered NOT one of the top primary regions, despite being locally very dense. 4. "Considered" (Qualitative Consensus vs. Quantitative Metric) Subjective / Textual Consensus: Relies on traditional textbook models (e.g., AP Human Geography regional paradigms). Empirical Metric: Relies purely on a quantitative threshold (e.g., any area exceeding 100 people/km 2 ). Impact: "Considered" leaves room for regional perception rather than strict mathematical boundaries, meaning localized dense pockets within generally empty regions (like the Nile River Valley in North Africa) could either qualify or disqualify the broader region.';

// THE ACTUAL MODEL OUTPUT, captured verbatim (D-BP154-005 Part 2 diagnosis run, this ticket's own
// return, quoted verbatim there) -- reproduced live against gemma4:12b (temperature 0, num_predict
// 1024, done_reason=stop, eval_count=589) fed EXACTLY the discriminatorExtractionInstruction()
// instruction/shape and REAL_OPERATION_PASSAGE above, byte-identical to what gemmaExtract() actually
// posts. Every span here is a real, verbatim substring of REAL_OPERATION_PASSAGE (spanIsVerbatim()
// below is not bypassed, it is satisfied for real, exactly as the live Ollama call proved).
function realDegenerateResponse(): Record<string, unknown> {
  return {
    kinds: [
      { name: 'South America', kind: 'Macro-Geographic Regions (Realms)', span: 'Macro-Geographic Regions (Realms): South Asia, Europe, South America, Central Asia, North Africa.' },
      { name: 'South Asia', kind: 'Macro-Geographic Regions (Realms)', span: 'Macro-Geographic Regions (Realms): South Asia, Europe, South America, Central Asia, North Africa.' },
      { name: 'North Africa', kind: 'Macro-Geographic Regions (Realms)', span: 'Macro-Geographic Regions (Realms): South Asia, Europe, South America, Central Asia, North Africa.' },
      { name: 'Northeast United States', kind: 'Sub-National Regions', span: 'Sub-National Regions: Northeast United States.' },
      { name: 'Europe', kind: 'Macro-Geographic Regions (Realms)', span: 'Macro-Geographic Regions (Realms): South Asia, Europe, South America, Central Asia, North Africa.' },
      { name: 'Central Asia', kind: 'Macro-Geographic Regions (Realms)', span: 'Macro-Geographic Regions (Realms): South Asia, Europe, South America, Central Asia, North Africa.' },
      { name: 'Arctic Circle', kind: 'Physical Biomes / Environmental Zones', span: 'Physical Biomes / Environmental Zones: Amazon Rainforest, Sahara Desert, Arctic Circle.' },
      { name: 'Amazon Rainforest', kind: 'Physical Biomes / Environmental Zones', span: 'Physical Biomes / Environmental Zones: Amazon Rainforest, Sahara Desert, Arctic Circle.' },
      { name: 'Sahara Desert', kind: 'Physical Biomes / Environmental Zones', span: 'Physical Biomes / Environmental Zones: Amazon Rainforest, Sahara Desert, Arctic Circle.' },
    ],
    category_kind: 'macro-realms',
    category_kind_span: 'If "region" is restricted strictly to macro-realms (e.g., UN world regions), options like the Amazon Rainforest or Sahara Desert cease to qualify as valid regions, shifting the focus to Central Asia, South America, or North Africa.',
    stated_in_passage: true,
  };
}

// A self-authored FRESH-QUERY passage where the SAME word is used for the per-option kind and the
// category denotation (no vocabulary gap) -- what a fresh, independent draw recovering from the
// owned passage's degenerate read would look like. Used by TEST 1 (RECOVERY) only.
const FRESH_RECOVERY_PASSAGE = 'A) South America: Macro-Realm. B) South Asia: Macro-Realm. C) North Africa: Macro-Realm. '
  + 'D) Northeast United States: Subnational Region. E) Europe: Macro-Realm. F) Central Asia: Macro-Realm. '
  + 'G) Arctic Circle: Biome. H) Amazon Rainforest: Biome. I) Sahara Desert: Biome. '
  + 'A world region properly denotes a Macro-Realm.';
function freshRecoveryResponse(): Record<string, unknown> {
  const kindFor: Record<string, string> = {
    A: 'Macro-Realm', B: 'Macro-Realm', C: 'Macro-Realm', E: 'Macro-Realm', F: 'Macro-Realm',
    D: 'Subnational Region',
    G: 'Biome', H: 'Biome', I: 'Biome',
  };
  const spanFor: Record<string, string> = {
    A: 'A) South America: Macro-Realm.',
    B: 'B) South Asia: Macro-Realm.',
    C: 'C) North Africa: Macro-Realm.',
    D: 'D) Northeast United States: Subnational Region.',
    E: 'E) Europe: Macro-Realm.',
    F: 'F) Central Asia: Macro-Realm.',
    G: 'G) Arctic Circle: Biome.',
    H: 'H) Amazon Rainforest: Biome.',
    I: 'I) Sahara Desert: Biome.',
  };
  return {
    kinds: ALL.map((L) => ({ name: OPT[L], kind: kindFor[L], span: spanFor[L] })),
    category_kind: 'Macro-Realm',
    category_kind_span: 'A world region properly denotes a Macro-Realm.',
    stated_in_passage: true,
  };
}

/** Same convention every classify_cascade.*.test.ts sibling uses -- queues canned Ollama
 *  /api/generate JSON responses, one per gemmaExtract() call, in order. */
function queuedFetch(responses: Array<Record<string, unknown>>): typeof fetch {
  let i = 0;
  return vi.fn(async () => {
    if (i >= responses.length) throw new Error(`queuedFetch: no more queued responses (called ${i + 1} times)`);
    const r = responses[i];
    i++;
    return { json: async () => ({ response: JSON.stringify(r) }) };
  }) as unknown as typeof fetch;
}

describe('D-BP154-005 TEST 1 (HEADLINE, RECOVERY): the owned-passage DEGENERATE read is never trusted, and a non-degenerate fresh query recovers', () => {
  test('fed the REAL 20:06:45Z owned "operation" passage: the owned-passage read is discarded as a FAILED READ (never excluded=ALL/included=NONE), falls through to a fresh query, and a clean fresh read publishes correctly', async () => {
    const originalFetch = global.fetch;
    // Call 1: extractFrameKinds() over the OWNED passage -> the real, captured degenerate response.
    // Call 2: extractFrameKinds() over the FRESH-QUERY passage (askGoogle, below) -> a clean read.
    global.fetch = queuedFetch([realDegenerateResponse(), freshRecoveryResponse()]);
    const askGoogle = vi.fn(async () => ({ snippet: FRESH_RECOVERY_PASSAGE }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, ALL, OPT, note, () => [owned(REAL_OPERATION_PASSAGE)],
      );

      // THE HEADLINE ASSERTION -- BEFORE this ticket's fix, establishFrame() trusted the owned
      // passage's own zero-survivor read directly: available:true, excluded=ALL NINE, included=NONE
      // (byte-identical to the measured receipt's own "keeps {none}"). AFTER: that read is REFUSED,
      // establishFrame() falls through to a fresh query (askGoogle IS reached -- proof the owned
      // read was not trusted), and the clean fresh read publishes the CORRECT, non-degenerate frame.
      expect(askGoogle).toHaveBeenCalledTimes(1);
      expect(frame.answeredFrom).toBe('new-query');
      expect(frame.available).toBe(true);
      expect(frame.degenerate).toBeFalsy();
      expect(new Set(frame.excluded)).toEqual(new Set(['D', 'G', 'H', 'I']));
      expect(new Set(frame.included)).toEqual(new Set(['A', 'B', 'C', 'E', 'F']));
      // The owned-passage degenerate read is NAMED as a failed read in the transcript, distinctly
      // from "excluded every option" -- never a silent fallthrough.
      expect(log.some((l) => /DEGENERATE READ on owned passage/.test(l) && /D-BP154-005/.test(l) && /kept.*0 of 9/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP154-005 TEST 2: the fresh query ALSO keeping zero abstains as DEGENERATE FRAME, distinctly from "excluded every option"', () => {
  test('the owned-passage read AND the fresh-query read are both the REAL degenerate shape: establishFrame() reports degenerate:true, excluded=[], included=[] -- never excluded=ALL', async () => {
    const originalFetch = global.fetch;
    // Both calls (owned-passage attempt, then the fresh-query attempt) see the SAME real degenerate
    // response -- askGoogle (below) returns the IDENTICAL passage text, so the same captured model
    // output is span-valid against it both times, exactly reproducing "not a one-off" (the ticket's
    // own second receipt, LIANA_RUN_qid98_2026-08-13T12-25-35-888Z.json, draw 1).
    global.fetch = queuedFetch([realDegenerateResponse(), realDegenerateResponse()]);
    const askGoogle = vi.fn(async () => ({ snippet: REAL_OPERATION_PASSAGE }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, ALL, OPT, note, () => [owned(REAL_OPERATION_PASSAGE)],
      );

      expect(askGoogle).toHaveBeenCalledTimes(1); // owned fell through once, fresh query issued once
      expect(frame.degenerate).toBe(true);
      // THE POINT: never the old, false "excluded ALL NINE as not being world regions" shape.
      expect(frame.excluded).toEqual([]);
      expect(frame.included).toEqual([]);
      expect(frame.available).toBe(false);
      expect(frame.via).toBe('degenerate-frame');
      expect(frame.reconciliationWhy).toMatch(/DEGENERATE FRAME/);
      expect(frame.reconciliationWhy).toMatch(/D-BP154-005/);
      expect(frame.reconciliationWhy).toMatch(/kept 0 of 9/);
      // Distinct from the OTHER "frame could not be established" reasons this file's siblings cover
      // (draw-disagreement, draw-capture-failure, no usable answer, empty passage, no option named).
      expect(frame.via).not.toBe('draw-disagreement');
      expect(frame.via).not.toBe('draw-capture-failure');
      expect(log.some((l) => /DEGENERATE READ on the fresh query/.test(l) && /D-BP154-005/.test(l))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP154-005 TEST 3 (SCOPE GUARD): a frame keeping SOME options is UNAFFECTED', () => {
  test('a partial mismatch (excludes {G,H,I}, keeps six) publishes exactly as it did before this ticket -- degenerate:false, no fallthrough', async () => {
    const originalFetch = global.fetch;
    const kindFor: Record<string, string> = {
      A: 'Macro-Realm', B: 'Macro-Realm', C: 'Macro-Realm', D: 'Macro-Realm', E: 'Macro-Realm', F: 'Macro-Realm',
      G: 'Biome', H: 'Biome', I: 'Biome',
    };
    const passage = `${ALL.map((L) => `${L}) ${OPT[L]}: ${kindFor[L]}.`).join(' ')} A world region properly denotes a Macro-Realm.`;
    global.fetch = queuedFetch([{
      kinds: ALL.map((L) => ({ name: OPT[L], kind: kindFor[L], span: `${L}) ${OPT[L]}: ${kindFor[L]}.` })),
      category_kind: 'Macro-Realm',
      category_kind_span: 'A world region properly denotes a Macro-Realm.',
      stated_in_passage: true,
    }]);
    const askGoogle = vi.fn(async () => ({ snippet: 'MUST NEVER BE REACHED -- an owned passage answers this' }));
    try {
      const { note, log } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, ALL, OPT, note, () => [owned(passage)],
      );
      expect(askGoogle).not.toHaveBeenCalled();
      expect(frame.answeredFrom).toBe('owned-passage');
      expect(frame.available).toBe(true);
      expect(frame.degenerate).toBeFalsy();
      expect(new Set(frame.excluded)).toEqual(new Set(['G', 'H', 'I']));
      expect(new Set(frame.included)).toEqual(new Set(['A', 'B', 'C', 'D', 'E', 'F']));
      expect(log.some((l) => /DEGENERATE/.test(l))).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP154-005 TEST 4: a non-match of kind-label alone never produces a TRUSTED exclusion when it is total', () => {
  test('applyFrameKindElimination() itself still computes excluded=ALL/included=NONE (pure arithmetic, unchanged) -- it is establishFrame() that refuses to publish it', () => {
    const kinds: Record<string, string | null> = Object.fromEntries(
      ALL.map((L) => [L, 'Macro-Geographic Regions (Realms)']),
    );
    // applyFrameKindElimination() is untouched by this ticket -- given a categoryKind that matches
    // NONE of the stated kinds, its own pure-code arithmetic still (correctly, mechanically) computes
    // a full exclusion set. This is not a bug in that function -- D-BP153-032's own TEST 4
    // (frame_stated_kind.test.ts, ANTI-TUNING, MANDATORY) already proves it must have no built-in
    // preference for any kind. What D-BP154-005 changes is that establishFrame() (TEST 1/2, above)
    // never PUBLISHES this particular shape (included.length === 0) as an established frame.
    const result = applyFrameKindElimination(ALL, kinds, 'macro-realms', CATEGORY, OPT);
    expect(result.excluded).toEqual(ALL);
    expect(result.included).toEqual([]);
  });
});

describe('D-BP154-005 TEST 5: D-BP153-020\'s own correction (reconcileNamedSet(), a wholly separate function) remains intact', () => {
  // Proves, not asserts: THE NAMED SET's absence-vs-denial distinction is UNTOUCHED by this ticket
  // (this ticket modifies establishFrame()/applyFrameKindElimination() only -- THE SOFTBALLS' own
  // stated-kind read -- never reconcileNamedSet(), which backs THE NAMED SET, extractNamedSetMembers(),
  // below in classify_cascade.ts).
  test('an EXPLICIT, complete non-membership statement still excludes (the 4dc81e00 correction\'s own headline case)', () => {
    const result = reconcileNamedSet(ALL, ['A', 'E'], ['B', 'C', 'D', 'F', 'G', 'H', 'I'], OPT);
    expect(result.partitionComplete).toBe(true);
    expect(new Set(result.nonMembers)).toEqual(new Set(['B', 'C', 'D', 'F', 'G', 'H', 'I']));
  });

  test('an INCOMPLETE partition retains the DIRECTLY STATED non-members rather than discarding everything (D-BP153-029, the 4dc81e00 fix itself)', () => {
    // Mirrors this file's own header quote of D-BP153-029's measured failure: direct excludes
    // {D,G,H,I} explicitly stated, complement names {B,C,F}; A and E are the only two options neither
    // side ever addressed -- an INCOMPLETE union (uncovered = {A, E}), which must retain the four
    // directly-stated non-members, never discard them wholesale.
    const result = reconcileNamedSet(ALL, [], ['D', 'G', 'H', 'I', 'B', 'C', 'F'], OPT);
    expect(result.partitionComplete).toBe(false);
    expect(result.nonMembers).toEqual(['D', 'G', 'H', 'I', 'B', 'C', 'F']);
  });
});
