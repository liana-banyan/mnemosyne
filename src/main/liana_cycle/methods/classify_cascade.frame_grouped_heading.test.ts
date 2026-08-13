// classify_cascade.frame_grouped_heading.test.ts -- D-BP153-033/BISHOP/seg-classify-033 FIX 2
//
// THE MEASURED FAILURE THIS FILE CLOSES (Bishop's own diagnosis, NOT re-diagnosed here; run
// LIANA_RUN_qid98_2026-08-13T16-29-46-988Z.json, acquisition
// EVIDENCE_qid98_2026-08-13T16-27-05-170Z_27064.jsonl, records read verbatim off disk for this
// file's own fixtures, below): draw 1 result -- "kinds {A:null, B:null, C:null, D:null, E:null,
// F:null, G:null, H:null, I:null}, categoryKind=null". The real Gemini passage stated every
// option's kind, plainly -- it just GROUPED the options under four category headings ("Category 1:
// Macro-Geographic / Socio-Political Regions  A) South America (Continent) B) South Asia
// (Sub-continental realm) ...") instead of stating a kind directly on each option's own line.
// extractDiscriminatorKinds() (classify_cascade.ts, shared byte-identical by STAGE D and THE
// SOFTBALLS/establishFrame()) expected the per-item shape only, and read every one of these as
// null even though nothing here required a judgment call -- the heading names the kind as plainly
// as a per-item line does; reading it and attributing it to the names listed beneath it is PURE
// COPYING (HARDWIRE-22 is not relaxed by this ticket).
//
// THE FIX (classify_cascade.ts, discriminatorExtractionInstruction()): the extraction INSTRUCTION
// sent to the local model now describes BOTH shapes -- the existing per-item line, and this
// grouped-heading shape -- and tells the model that a name listed under a heading takes that
// heading's own stated kind, with the supporting span being the text that ties the name to its
// heading. The per-item shape, and the JSON contract / verification pipeline
// (spanIsVerbatim()/appearsIn(), D-BP153-016), are UNCHANGED -- this file's own TEST 2 proves no
// regression there.
//
// TESTED DIRECTLY AGAINST SOURCE (never dist), same offline convention every classify_cascade.*.
// test.ts sibling uses: askGoogle is a local stub (never reached -- every establishFrame() call
// below answers from an OWNED PASSAGE), global.fetch (gemmaExtract()'s own Ollama channel) is
// monkey-patched per test, nothing live anywhere in this file.
//
// TEST 1 (HEADLINE) is written so THIS SAME test file runs unmodified against BOTH the pre-fix
// source (reproducing the measured "all nulls" failure -- the fetch mock detects the ABSENCE of
// this ticket's own grouping-guidance wording in the instruction sent to gemma and returns exactly
// that failure shape) and the post-fix source (the mock detects the guidance and returns a
// correctly-attributed read) -- this is the fail-before/pass-after mechanism this ticket's own
// dispatch requires, performed by stashing ONLY classify_cascade.ts (never this test file).

import {
  describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest';
// D-BP153-031, TEST ISOLATION: pinning LB_DRAW_REPEATS=1 keeps every assertion in this file simple
// -- every establishFrame() call below answers from a single owned passage, never reaching the
// repeated-draw wrapper's own fresh-query path. The channel-variance repeat/disagreement behavior
// itself is covered by classify_cascade.repeated_draws.test.ts, not here.
beforeEach(() => { process.env.LB_DRAW_REPEATS = '1'; });
afterEach(() => { delete process.env.LB_DRAW_REPEATS; });

import { establishFrame } from './classify_cascade';
import type { MethodRunContext, OwnedPassage } from '../method_registry';

// qid 98's option letters, from resources/mmlu_pro_bundled/questions.jsonl -- the SAME mapping
// every classify_cascade.*.test.ts sibling uses.
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

// ─────────────────────────── THE REAL EVIDENCE, VERBATIM OFF DISK ───────────────────────────
//
// Read directly from EVIDENCE_qid98_2026-08-13T16-27-05-170Z_27064.jsonl (this file's own header,
// above), untruncated. DRAW1_GROUPED and DRAW2_GROUPED are seq 2 and seq 3 -- THE SOFTBALLS' base
// query, asked twice (D-BP153-031), both GROUPED under the same four category headings with
// slightly different option-level wording (the "~0% source variance" this repo's own
// D-BP153-032/D-BP153-033 tickets already document). DRAW3_ITEM_BY_ITEM is seq 4 -- the D-BP153-026
// completion follow-up's own reply, which happened to answer ITEM BY ITEM instead ("A) South
// America: Macro-Geographic / Socio-Political Region Type: ...").
const DRAW1_GROUPED = 'To make sense of this list, we have to look at geography through different lenses. The items span four distinct types of geographic regions, ranging from human-political groupings to environmental biomes. 1. Categorization of Each Option Category 1: Macro-Geographic / Socio-Political Regions A) South America (Continent) B) South Asia (Sub-continental realm) C) North Africa (Sub-continental / Cultural realm) E) Europe (Continent) F) Central Asia (Sub-continental realm) Category 2: Sub-National / Socio-Economic Region D) Northeast United States (A sub-national regional corridor / megalopolis within a single country) Category 3: Biogeographic / Environmental Regions (Biomes) H) Amazon Rainforest (Tropical rainforest biome / river basin) I) Sahara Desert (Hyper-arid desert biome) Category 4: Latitudinal / Astronomical Region G) Arctic Circle (A parallel of latitude—66.5° N—defining a polar climate zone based on Earth-Sun geometry) 2. How These Types Differ From One Another Region Type Defining Criteria Boundary Type Example from List Socio-Political / Continental Shared human history, culture, language, political structures, and macro-landmasses. Often aligns with clusters of international nation-state borders. South Asia, Europe Sub-National Shared economic, cultural, or administrative ties within a single sovereign state. Bound strictly inside one country\'s national borders. Northeast United States Biogeographic (Biome) Shared physical characteristics: climate, rainfall, vegetation, soil, and wildlife. Continuous natural zones that completely ignore political borders. Amazon Rainforest, Sahara Desert Latitudinal / Astronomical Mathematical grid coordinates on Earth based on solar angle and axial tilt. Fixed lines of latitude around the globe. Arctic Circle 3. Which Kind Properly Denotes "World Regions"? In formal geography, Category 1 (Macro-Geographic / Socio-Political Regions) is the only category that properly denotes "World Regions." Why? In geographic methodology, a World Region is defined as a large-scale spatial unit that groups multiple neighboring countries together based on a combination of shared cultural, historical, economic, and physical characteristics. Options A, B, C, E, and F fit this definition. They represent standard spatial units used by the United Nations, academic textbooks, and international bodies to divide the globe into manageable realms of human activity. Option D (Northeast US) fails the scale test—it is a sub-national region, not a global one. Options H and I (Amazon, Sahara) are biophysical regions/biomes, defined purely by ecology and climate rather than human geography. Option G (Arctic Circle) is a';

const DRAW2_GROUPED = 'Here is the breakdown of how these nine areas are classified, how the categories differ from one another, and which ones officially qualify as "world regions." 1. Classification of Each Region The items on this list fall into four distinct geographic categories: Category 1: Macro-Geographic / Socio-Political Regions A) South America (Continent) B) South Asia (Sub-continental realm) C) North Africa (Sub-continental / Cultural realm) E) Europe (Continent) F) Central Asia (Sub-continental realm) Category 2: Sub-National / Socio-Economic Region D) Northeast United States (A regional corridor / megalopolis inside a single sovereign nation) Category 3: Biogeographic / Environmental Regions (Biomes) H) Amazon Rainforest (Tropical rainforest biome / river basin) I) Sahara Desert (Hyper-arid desert biome) Category 4: Latitudinal / Astronomical Region G) Arctic Circle (A parallel of latitude at ~66.5° N defining a polar solar/climatic boundary) 2. How These Categories Differ They differ primarily across three axes: Defining Criteria, Spatial Scale, and Boundary Types. Category Type Primary Criteria Spatial Scale Type of Boundaries Example Macro-Geographic / Socio-Political Shared culture, history, economic ties, and landmasses Multi-national / Global Clusters of international borders South Asia, Central Asia Sub-National Shared regional economy or urbanization within one state Intra-national Contained inside one country\'s borders Northeast United States Biogeographic (Biome) Shared climate, vegetation, wildlife, and ecosystems Cross-continental physical zones Gradual ecological transition zones Amazon Rainforest, Sahara Desert Latitudinal / Astronomical Mathematical solar angles and Earth-Sun geometry Global circumference Fixed lines of latitude Arctic Circle 3. Which Category Properly Denotes "World Regions"? Only Category 1 (Macro-Geographic / Socio-Political Regions) properly denotes "World Regions" in formal geography and academic contexts (such as AP Human Geography or UN regional groupings). Why? A World Region is formally defined as a large-scale spatial division of the Earth that groups multiple neighboring countries based on a shared combination of cultural, historical, economic, and physical traits. Options A, B, C, E, and F fit this definition cleanly. They represent the standard realms used to divide human civilization on a global scale. Option D (Northeast US) operates at a sub-national scale, not a global one. Options H and I (Amazon, Sahara) are biomes/physical zones defined strictly by nature rather than socio-political geography. Option G (Arctic Circle) is an astronomical grid coordinate, not a human-geographic realm.';

const DRAW3_ITEM_BY_ITEM = 'Here is the explicit item-by-item breakdown in order from A through I, followed by how these types differ and which ones properly denote "world regions." 1. Classification of Each Region (In Order) A) South America: Macro-Geographic / Socio-Political Region Type: A major continent containing multiple sovereign nations bound by shared geographic, historical, and cultural characteristics. B) South Asia: Macro-Geographic / Socio-Political Region Type: A sub-continental realm defined by shared physical geography, cultural traditions, and history across multiple sovereign states (e.g., India, Pakistan, Bangladesh). C) North Africa: Macro-Geographic / Socio-Political Region Type: A cultural and geographic sub-continental realm grouping multiple nations bound by shared arid geography, language, and cultural ties (often linked with Southwest Asia). D) Northeast United States: Sub-National / Socio-Economic Region Type: A localized regional corridor (megalopolis) defined by high urbanization and economic integration, located entirely within a single country. E) Europe: Macro-Geographic / Socio-Political Region Type: A distinct continent and geopolitical realm comprising dozens of independent, interconnected sovereign nations. F) Central Asia: Macro-Geographic / Socio-Political Region Type: A landlocked sub-continental realm defined by shared historical, economic, and geopolitical ties among a specific group of sovereign nations. G) Arctic Circle: Latitudinal / Astronomical Region Type: A mathematical boundary (a line of latitude at ~66.5° N) that marks a polar climate/solar zone based strictly on Earth-Sun geometry. H) Amazon Rainforest: Biogeographic / Environmental Region (Biome) Type: A physical biome and drainage basin defined strictly by natural characteristics (tropical climate, rainforest ecosystem, and river systems) crossing multiple national borders. I) Sahara Desert: Biogeographic / Environmental Region (Biome) Type: A physical biome defined strictly by climate and ecology (hyper-arid desert environment) that stretches across the northern portion of the African continent regardless of political borders. 2. How These Kinds of Regions Differ From One Another These four region types differ fundamentally in their defining traits, spatial scale, and boundary types: Region Type Primary Criteria Spatial Scale Type of Boundaries Macro-Geographic / Socio-Political Human culture, history, language, political structures, and landmasses Multi-national / Global Defined by clusters of international borders Sub-National / Socio-Economic Economic integration, urban development, and regional identity inside one nation Intra-national Contained strictly within one nation\'s borders Biogeographic / Environmental Ecosystems, climate, vegetation, soil, and wildlife patterns Cross-continental physical zones Natural, gradual ecological transition zones Latitudinal / Astronomical Solar angles and mathematical Earth-Sun axial geometry Global parallel coordinate Precise, fixed mathematical lines 3. Which Kind Properly Denotes "World Regions"? Only Macro-Geographic / Socio-Political Regions (Options A, B, C, E, and F) properly denote "World Regions" in academic geography and global frameworks (such as the United Nations, AP Human Geography, or international relations). Why? A formal World Region must satisfy three criteria: Multi-National Scale: It encompasses multiple sovereign countries, excluding sub-national areas like the Northeast United States. Human-Environment Integration: It incorporates human geography (culture, economy, history) alongside physical geography, excluding purely environmental biomes like the Amazon Rainforest or Sahara Desert.';

// Ground truth read off DRAW1_GROUPED/DRAW2_GROUPED by a human, once: every option's kind is the
// CATEGORY HEADING it is grouped under (singular head-noun form -- a literal, verbatim-verifiable
// substring of both the plural heading text, e.g. "Region" in "Regions", AND of DRAW3_ITEM_BY_ITEM's
// own per-item kind, e.g. "A) South America: Macro-Geographic / Socio-Political Region Type: ..." --
// this is what TEST 3 (DETERMINISM) exploits: the SAME kind text is independently verifiable,
// verbatim, against BOTH real passages, despite their different shapes).
const GROUPED_KINDS: Record<string, string> = {
  A: 'Macro-Geographic / Socio-Political Region',
  B: 'Macro-Geographic / Socio-Political Region',
  C: 'Macro-Geographic / Socio-Political Region',
  D: 'Sub-National / Socio-Economic Region',
  E: 'Macro-Geographic / Socio-Political Region',
  F: 'Macro-Geographic / Socio-Political Region',
  G: 'Latitudinal / Astronomical Region',
  H: 'Biogeographic / Environmental Region',
  I: 'Biogeographic / Environmental Region',
};
const GROUPED_CATEGORY_KIND = 'Macro-Geographic / Socio-Political Region';

// The heading-plus-every-option-underneath-it segment, for each of the four DRAW1_GROUPED headings
// -- exactly the ticket's own "the heading line together with the option's own line(s)" shape,
// spliced verbatim out of DRAW1_GROUPED/DRAW2_GROUPED above (never retyped by hand, so
// spanIsVerbatim() cannot fail on a transcription slip).
function headingSpan(passage: string, startMarker: string, endMarker: string): string {
  const s = passage.indexOf(startMarker);
  const e = passage.indexOf(endMarker, s);
  if (s < 0 || e < 0) throw new Error(`headingSpan: marker not found (${startMarker} / ${endMarker})`);
  return passage.slice(s, e).trim();
}
function draw1Spans() {
  return {
    cat1: headingSpan(DRAW1_GROUPED, 'Category 1:', 'Category 2:'),
    cat2: headingSpan(DRAW1_GROUPED, 'Category 2:', 'Category 3:'),
    cat3: headingSpan(DRAW1_GROUPED, 'Category 3:', 'Category 4:'),
    cat4: headingSpan(DRAW1_GROUPED, 'Category 4:', '2. How These Types Differ'),
    categoryKindSpan: headingSpan(DRAW1_GROUPED, 'In formal geography, Category 1', 'Why?'),
  };
}
function draw2Spans() {
  return {
    cat1: headingSpan(DRAW2_GROUPED, 'Category 1:', 'Category 2:'),
    cat2: headingSpan(DRAW2_GROUPED, 'Category 2:', 'Category 3:'),
    cat3: headingSpan(DRAW2_GROUPED, 'Category 3:', 'Category 4:'),
    cat4: headingSpan(DRAW2_GROUPED, 'Category 4:', '2. How These Categories Differ'),
    categoryKindSpan: headingSpan(DRAW2_GROUPED, 'Only Category 1', 'Why?'),
  };
}
function draw3PerOptionSpan(letter: string): string {
  const letters = ALL;
  const idx = letters.indexOf(letter);
  const nextMarker = idx + 1 < letters.length ? `${letters[idx + 1]})` : '2. How These Kinds';
  return headingSpan(DRAW3_ITEM_BY_ITEM, `${letter})`, nextMarker);
}
const DRAW3_CATEGORY_KIND_SPAN = headingSpan(DRAW3_ITEM_BY_ITEM, 'Only Macro-Geographic', 'Why?');

/** THE NEW SHAPE's own canned reply for a GROUPED passage -- a faithful, verbatim-span-checkable
 *  attribution of each option to its heading's own stated kind, exactly what a correctly-instructed,
 *  judgment-free extractor produces (span-verified for REAL by the SUT's own
 *  spanIsVerbatim()/appearsIn() -- this mock does not bypass that check, it satisfies it). */
function groupedKindsResponse(spans: ReturnType<typeof draw1Spans>): Record<string, unknown> {
  const spanFor: Record<string, string> = {
    A: spans.cat1, B: spans.cat1, C: spans.cat1, E: spans.cat1, F: spans.cat1,
    D: spans.cat2,
    H: spans.cat3, I: spans.cat3,
    G: spans.cat4,
  };
  return {
    kinds: ALL.map((L) => ({ name: OPT[L], kind: GROUPED_KINDS[L], span: spanFor[L] })),
    category_kind: GROUPED_CATEGORY_KIND,
    category_kind_span: spans.categoryKindSpan,
    stated_in_passage: true,
  };
}

/** THE MEASURED FAILURE, reproduced exactly -- draw 1's real recorded result
 *  (LIANA_RUN_qid98_2026-08-13T16-29-46-988Z.json): "kinds {A:null, ..., I:null}, categoryKind=null".
 *  What a per-item-only extractor (no grouping guidance in its instruction) actually returns when
 *  handed a GROUPED passage: nothing to copy onto any individual option's own line, so nothing is
 *  returned for any of them. */
function allNullResponse(): Record<string, unknown> {
  return {
    kinds: ALL.map((L) => ({ name: OPT[L], kind: null, span: '' })),
    category_kind: null,
    category_kind_span: '',
    stated_in_passage: false,
  };
}

/** THE NEW SHAPE's own canned reply for the ITEM-BY-ITEM passage (DRAW3) -- unchanged in kind from
 *  what this shape already produced before this ticket (this file's own TEST 2, NO REGRESSION). */
function itemByItemKindsResponse(): Record<string, unknown> {
  return {
    kinds: ALL.map((L) => ({ name: OPT[L], kind: GROUPED_KINDS[L], span: draw3PerOptionSpan(L) })),
    category_kind: GROUPED_CATEGORY_KIND,
    category_kind_span: DRAW3_CATEGORY_KIND_SPAN,
    stated_in_passage: true,
  };
}

/** D-BP153-033 FIX 2's own instruction addition (classify_cascade.ts,
 *  discriminatorExtractionInstruction()) tells the model about the grouped-heading shape using this
 *  exact phrase. A fetch mock that dispatches on ITS PRESENCE in the prompt sent to gemma is exactly
 *  what lets THIS test file run unmodified against both the pre-fix source (the phrase is absent --
 *  reproduces the measured "all nulls" failure) and the post-fix source (the phrase is present --
 *  reproduces the correct grouped-attribution read), the fail-before/pass-after mechanism this
 *  ticket's own dispatch requires. */
const GROUPING_GUIDANCE_MARKER = 'GROUPING several names under a category heading';

/** Inspects the REAL instruction+passage text gemmaExtract() actually sends (parsed out of the
 *  mocked /api/generate request body, the same body shape gemmaExtract() -- comparative_cascade.ts
 *  -- actually posts) and routes to the appropriate canned reply BY CONTENT (which real passage was
 *  sent, and whether this ticket's own grouping-guidance wording is present in the instruction),
 *  never by call order or count -- same discipline classify_cascade.frame_stated_kind.test.ts's own
 *  contentDispatchedFetch() already uses. Throws loudly on any passage/instruction this file did not
 *  anticipate -- a silent wrong-shape reply would make a false pass indistinguishable from a real
 *  one. */
function contentDispatchedFetch(): typeof fetch {
  return vi.fn(async (_url: unknown, init: { body?: string }) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as { prompt?: string };
    const prompt = body.prompt ?? '';
    const hasGroupingGuidance = prompt.includes(GROUPING_GUIDANCE_MARKER);
    if (prompt.includes(DRAW1_GROUPED)) {
      const reply = hasGroupingGuidance ? groupedKindsResponse(draw1Spans()) : allNullResponse();
      return { json: async () => ({ response: JSON.stringify(reply) }) };
    }
    if (prompt.includes(DRAW2_GROUPED)) {
      const reply = hasGroupingGuidance ? groupedKindsResponse(draw2Spans()) : allNullResponse();
      return { json: async () => ({ response: JSON.stringify(reply) }) };
    }
    if (prompt.includes(DRAW3_ITEM_BY_ITEM)) {
      // The per-item shape works identically regardless of whether this ticket's own
      // grouping-guidance addition is present -- that addition only ADDS a second recognized shape,
      // it never disturbs the first (this file's own TEST 2, NO REGRESSION).
      return { json: async () => ({ response: JSON.stringify(itemByItemKindsResponse()) }) };
    }
    throw new Error(`contentDispatchedFetch: unrecognized passage in prompt -- prompt="${prompt.slice(0, 200)}"`);
  }) as unknown as typeof fetch;
}

describe('D-BP153-033 TEST 1 (HEADLINE): a REAL GROUPED passage yields a stated kind for every option it covers, never all nulls', () => {
  test('fed the REAL draw-1 GROUPED passage: every option under every heading gets that heading\'s own stated kind, and the category denotation resolves', async () => {
    const originalFetch = global.fetch;
    global.fetch = contentDispatchedFetch();
    const askGoogle = vi.fn(async () => ({ snippet: 'MUST NEVER BE REACHED -- an owned passage answers this' }));
    try {
      const { note } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, ALL, OPT, note, () => [owned(DRAW1_GROUPED)],
      );
      expect(askGoogle).not.toHaveBeenCalled();

      // THE HEADLINE ASSERTION. Before this ticket's Fix 2, every one of these is null (the
      // measured failure, LIANA_RUN_qid98_2026-08-13T16-29-46-988Z.json's own draw 1 result);
      // after, every option this passage covers (all nine, across its four headings) has a stated
      // kind, and a category denotation is resolved.
      expect(frame.available).toBe(true);
      expect(frame.partitionComplete).toBe(true);
      expect(new Set(frame.included)).toEqual(new Set(['A', 'B', 'C', 'E', 'F']));
      expect(new Set(frame.excluded)).toEqual(new Set(['D', 'G', 'H', 'I']));
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-033 TEST 2 (NO REGRESSION): the REAL ITEM-BY-ITEM passage (draw 3) still extracts exactly as it does today', () => {
  test('fed the REAL draw-3 item-by-item passage: the per-item shape is unaffected by this ticket\'s grouped-heading addition', async () => {
    const originalFetch = global.fetch;
    global.fetch = contentDispatchedFetch();
    const askGoogle = vi.fn(async () => ({ snippet: 'MUST NEVER BE REACHED -- an owned passage answers this' }));
    try {
      const { note } = notes();
      const frame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, ALL, OPT, note, () => [owned(DRAW3_ITEM_BY_ITEM)],
      );
      expect(askGoogle).not.toHaveBeenCalled();
      expect(frame.available).toBe(true);
      expect(frame.partitionComplete).toBe(true);
      expect(new Set(frame.included)).toEqual(new Set(['A', 'B', 'C', 'E', 'F']));
      expect(new Set(frame.excluded)).toEqual(new Set(['D', 'G', 'H', 'I']));
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-033 TEST 3 (DETERMINISM): the GROUPED and ITEM-BY-ITEM passages yield the SAME kinds for the options they share', () => {
  test('draw 1 (grouped) and draw 3 (item-by-item), fed separately, land on the SAME excluded/included sets', async () => {
    const originalFetch = global.fetch;
    const askGoogle = vi.fn(async () => ({ snippet: 'MUST NEVER BE REACHED -- an owned passage answers this' }));
    let groupedFrame;
    let itemByItemFrame;
    try {
      global.fetch = contentDispatchedFetch();
      const { note: note1 } = notes();
      groupedFrame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, ALL, OPT, note1, () => [owned(DRAW1_GROUPED)],
      );
      const { note: note2 } = notes();
      itemByItemFrame = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, ALL, OPT, note2, () => [owned(DRAW3_ITEM_BY_ITEM)],
      );
    } finally {
      global.fetch = originalFetch;
    }
    expect(askGoogle).not.toHaveBeenCalled();
    expect(groupedFrame.available).toBe(true);
    expect(itemByItemFrame.available).toBe(true);
    expect(new Set(groupedFrame.excluded)).toEqual(new Set(itemByItemFrame.excluded));
    expect(new Set(groupedFrame.included)).toEqual(new Set(itemByItemFrame.included));
  });

  test('draw 1 and draw 2 (both grouped, different wording drift) land on the SAME excluded/included sets too', async () => {
    const originalFetch = global.fetch;
    const askGoogle = vi.fn(async () => ({ snippet: 'MUST NEVER BE REACHED -- an owned passage answers this' }));
    let frame1;
    let frame2;
    try {
      global.fetch = contentDispatchedFetch();
      const { note: note1 } = notes();
      frame1 = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, ALL, OPT, note1, () => [owned(DRAW1_GROUPED)],
      );
      const { note: note2 } = notes();
      frame2 = await establishFrame(
        askGoogle as unknown as MethodRunContext['askGoogle'],
        CATEGORY, ALL, OPT, note2, () => [owned(DRAW2_GROUPED)],
      );
    } finally {
      global.fetch = originalFetch;
    }
    expect(new Set(frame1.excluded)).toEqual(new Set(frame2.excluded));
    expect(new Set(frame1.included)).toEqual(new Set(frame2.included));
  });
});

describe('D-BP153-033 TEST 4: a grouped-heading kind is still discarded when its span does not appear verbatim in the passage (HARDWIRE-22/D-BP153-016 unrelaxed)', () => {
  test('a fabricated span that never occurs in the passage is rejected, leaving that option unaccounted rather than guessed -- FRESH-QUERY path (owned-passage would only retry, D-BP153-023; the TERMINAL safety net that actually keeps a partial result is exercised here, same as this file\'s siblings)', async () => {
    const originalFetch = global.fetch;
    // No owned passage: D-BP153-023's owned-passage retry heuristic requires COMPLETE coverage to
    // trust an owned passage at all, so a corrupted span there would only cause a fall-through, never
    // exercise the discard itself. The fresh-query path's own TERMINAL safety net
    // (applyFrameKindElimination(), classify_cascade.ts) is what actually publishes a result with one
    // option left unaccounted -- this test goes there directly, same convention
    // classify_cascade.frame_query_full_accounting.test.ts's own TEST 3 already uses (askGoogle
    // returns the SAME passage regardless of query text, so the D-BP153-026 completion follow-up
    // learns nothing new).
    const askGoogle = vi.fn(async () => ({ snippet: DRAW1_GROUPED }));
    global.fetch = vi.fn(async (_url: unknown, init: { body?: string }) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { prompt?: string };
      const prompt = body.prompt ?? '';
      if (!prompt.includes(DRAW1_GROUPED)) {
        throw new Error(`unexpected prompt: ${prompt.slice(0, 200)}`);
      }
      const reply = groupedKindsResponse(draw1Spans());
      // Corrupt ONLY option A's span so it is no longer a verbatim substring of DRAW1_GROUPED --
      // spanIsVerbatim() (classify_cascade.ts) must reject it regardless of the grouped-heading
      // guidance this ticket adds. Rebuilt fresh on every call (main query AND the D-BP153-026
      // completion follow-up both reach this mock) so both see the same corruption.
      const kindsArr = reply.kinds as Array<{ name: string; kind: string | null; span: string }>;
      const aEntry = kindsArr.find((k) => k.name === 'South America')!;
      aEntry.span = 'This sentence about a fabricated kind never appears anywhere in DRAW1_GROUPED verbatim.';
      return { json: async () => ({ response: JSON.stringify(reply) }) };
    }) as unknown as typeof fetch;
    try {
      const { note, log } = notes();
      const frame = await establishFrame(askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note);

      // ONE fresh query, PLUS D-BP153-026's own ONE completion follow-up (naming only A, the option
      // left unaccounted) -- never a loop.
      expect(askGoogle).toHaveBeenCalledTimes(2);
      // A's kind was discarded (unverifiable span) on both attempts -- A is neither excluded nor
      // included, and the discard is counted and noted, never silently dropped.
      expect(frame.excluded).not.toContain('A');
      expect(frame.included).not.toContain('A');
      expect(frame.partitionComplete).toBe(false);
      expect(frame.available).toBe(true); // the category kind WAS stated and verified -- answered, with A left unaccounted
      expect(log.some((l) => /discarded 1 value\(s\) with no verbatim supporting span/.test(l))).toBe(true);
      // Every OTHER option, whose span was untouched, still resolves correctly.
      expect(new Set(frame.included)).toEqual(new Set(['B', 'C', 'E', 'F']));
      expect(new Set(frame.excluded)).toEqual(new Set(['D', 'G', 'H', 'I']));
    } finally {
      global.fetch = originalFetch;
    }
  });
});
