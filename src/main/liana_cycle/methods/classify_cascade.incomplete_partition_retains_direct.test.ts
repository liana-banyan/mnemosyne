// classify_cascade.incomplete_partition_retains_direct.test.ts -- D-BP153-029/BISHOP/seg-classify-029
//
// THE MEASURED FAILURE (live run, receipt LIANA_RUN_qid98_2026-08-13T04-29-14-925Z.json).
//   FRAME: answered FROM A NEW QUERY -- direct extraction excludes G) Arctic Circle, H) Amazon
//          Rainforest, I) Sahara Desert, complement states (nothing) IS world regions
//   FRAME FOLLOW-UP RECONCILIATION: INCOMPLETE PARTITION -- members {G,H,I,D) Northeast United
//          States} and non-members {B,C,F} do NOT together account for every option
//   FRAME: 9 of 9 option(s) remain in frame -- A,B,C,D,E,F,G,H,I
// user_gemini EXPLICITLY STATED that the Arctic Circle, the Amazon Rainforest, the Sahara Desert,
// and Northeast United States are NOT world regions -- FOUR directly stated exclusions, each with
// its own verbatim supporting span. Seven of nine options were accounted for (four excluded, three
// included). Because A and E went unmentioned by EITHER side, D-BP153-020's complete-partition gate
// discarded ALL of it, including the four explicit statements -- not just the two options nobody
// addressed.
//
// It also regressed against the PREVIOUS run: there, a complement-silent read used the direct side
// alone and correctly kept {G,H,I} excluded (3 candidates for the terminator). Here the follow-up
// ADDED D, converting a usable one-sided read into a two-sided PARTIAL one, which then failed
// completeness and zeroed everything -- adding evidence made the answer WORSE.
//
// THE RULE (Bishop's own spec error, corrected -- NOT a re-diagnosis): an incomplete partition
// invalidates the COMPLEMENT-DERIVED INFERENCE (the "all minus non-members" arithmetic the COMPLETE
// branch of reconcileNamedSet() performs). It NEVER invalidates the DIRECTLY STATED values. See
// reconcileNamedSet()'s own D-BP153-029 doc comment in classify_cascade.ts for the precise fix.
//
//   INFERENCE (still forbidden, D-BP153-020 unrelaxed): "the source named only B, C, and F as world
//   regions, therefore the other six are NOT." Absence is omission -- this is the ORIGINAL false
//   pass and it stays banned; see classify_cascade.complete_partition_required.test.ts's own
//   coverage, untouched by this file.
//
//   STATEMENT (must be honored, this file's own subject): "the Sahara Desert is a biome, not a
//   world region" -- said explicitly, with a verbatim supporting span. This is evidence, and
//   discarding it because the SAME passage also failed to classify Europe is the
//   gather-it-and-throw-it-away defect this whole session exists to close.
//
// SCOPE: this file exercises establishFrame() end to end, the EXACT live shape (a complement-silent
// first pass whose follow-up, D-BP153-027's own trigger, adds a direct exclusion but still leaves
// two options unaccounted for). classify_cascade.completion_follow_up.test.ts's own TEST 3 and
// classify_cascade.complete_partition_required.test.ts's own TEST 5 cover the same D-BP153-029 fix
// via the D-BP153-026 (fresh-query-incomplete) trigger and the pure reconcileNamedSet() arithmetic,
// respectively -- one mechanism, three angles, never re-implemented three times.

import {
  describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest';
// D-BP153-031, TEST ISOLATION: this file's own fixtures each mock exactly ONE response per base
// question -- pinning LB_DRAW_REPEATS=1 keeps every existing assertion in this file (call counts,
// single-draw extraction) valid. drawWithAgreement()'s own repeats===1 path is a pure pass-through,
// BYTE-IDENTICAL to this file's pre-D-BP153-031 behavior (see classify_cascade.ts's own D-BP153-031
// section header and resolveDrawRepeats()). The channel-variance repeat/disagreement behavior itself
// is covered by classify_cascade.repeated_draws.test.ts, not here.
beforeEach(() => { process.env.LB_DRAW_REPEATS = '1'; });
afterEach(() => { delete process.env.LB_DRAW_REPEATS; });
import { establishFrame, reconcileNamedSet } from './classify_cascade';
import type { MethodRunContext } from '../method_registry';

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

function notes(): { note: (text: string) => void; log: string[] } {
  const log: string[] = [];
  return { note: (text: string) => log.push(text), log };
}

/** Same convention every classify_cascade.*.test.ts sibling already uses -- queues canned Ollama
 *  /api/generate JSON responses, one per gemmaExtract() call, in order. */
function queuedFetch(responses: string[]): typeof fetch {
  let i = 0;
  return vi.fn(async () => {
    if (i >= responses.length) throw new Error(`queuedFetch: no more queued responses (called ${i + 1} times)`);
    const r = responses[i];
    i++;
    return { json: async () => ({ response: r }) };
  }) as unknown as typeof fetch;
}

// THE EXACT LIVE SHAPE (receipt LIANA_RUN_qid98_2026-08-13T04-29-14-925Z.json): direct excludes
// {G, H, I}, complement states nothing at all -- COMPLEMENT-SILENT, six of nine unaccounted for by
// the direct side, triggering D-BP153-027's own follow-up.
const FIRST_PASS_PASSAGE = 'G (Arctic Circle), H (Amazon Rainforest), and I (Sahara Desert) are '
  + 'biomes, not world regions.';
// The follow-up's own returned passage -- adds D as a direct exclusion and B, C, F as included, but
// never mentions A or E at all -- the SAME "adding evidence made it worse" shape the live run hit.
const FOLLOW_UP_PASSAGE = 'D (Northeast United States) is also not a world region. B (South Asia), '
  + 'C (North Africa), and F (Central Asia) are legitimate world regions.';

describe('D-BP153-029 TEST 1 (HEADLINE): the exact live shape -- a follow-up ADDS a direct exclusion but the union is STILL incomplete', () => {
  test('FAIL-BEFORE / PASS-AFTER: the four DIRECTLY STATED exclusions {G,H,I,D} are RETAINED, the complement-derived inference is discarded, A and E are named unaccounted -- never the old zero-credit wipe', async () => {
    const originalFetch = global.fetch;
    global.fetch = queuedFetch([
      // First pass direct (frameExtractionInstruction, NOT category): G, H, I.
      JSON.stringify({
        not_members: ['Arctic Circle', 'Amazon Rainforest', 'Sahara Desert'].map((name) => ({ name, span: FIRST_PASS_PASSAGE })),
        stated_in_passage: true,
      }),
      // First pass complement (frameComplementExtractionInstruction, IS category): COMPLEMENT-SILENT.
      JSON.stringify({ members: [], stated_in_passage: false }),
      // Follow-up direct: adds D.
      JSON.stringify({ not_members: [{ name: 'Northeast United States', span: FOLLOW_UP_PASSAGE }], stated_in_passage: true }),
      // Follow-up complement: names B, C, F -- but the follow-up query only ever asked about the six
      // options the first pass's direct side left uncovered (A,B,C,D,E,F), and this source still
      // never mentions A or E.
      JSON.stringify({
        members: ['South Asia', 'North Africa', 'Central Asia'].map((name) => ({ name, span: FOLLOW_UP_PASSAGE })),
        stated_in_passage: true,
      }),
    ]);
    let call = 0;
    const askGoogle = vi.fn(async () => {
      call += 1;
      return { snippet: call === 1 ? FIRST_PASS_PASSAGE : FOLLOW_UP_PASSAGE };
    });
    try {
      const { note, log } = notes();
      const frame = await establishFrame(askGoogle as unknown as MethodRunContext['askGoogle'], CATEGORY, ALL, OPT, note);

      // The follow-up DID fire (D-BP153-027's own complement-silent-and-partial trigger, not
      // D-BP153-026's incomplete-partition trigger -- the first pass's complement said nothing at
      // all, it was never "incomplete", it was silent) and DID add D.
      expect(askGoogle).toHaveBeenCalledTimes(2);
      expect(log.some((l) => /FRAME FOLLOW-UP \(D-BP153-026\)/.test(l) && /COMPLEMENT-SILENT-AND-PARTIAL/.test(l))).toBe(true);
      expect(log.some((l) => /FRAME FOLLOW-UP RECONCILIATION \(D-BP153-026/.test(l) && /INCOMPLETE PARTITION/.test(l))).toBe(true);

      // THE HEADLINE ASSERTION: the union is STILL incomplete (A, E unaccounted), and the OLD code
      // (before this ticket) wiped `frame.excluded` to `[]` here -- "9 of 9 remain in frame", the
      // exact live bug. The FIX retains the four directly stated exclusions.
      expect(frame.partitionComplete).toBe(false);
      expect(new Set(frame.excluded)).toEqual(new Set(['G', 'H', 'I', 'D']));
      expect(new Set(frame.included)).toEqual(new Set(['B', 'C', 'F']));
      expect(frame.available).toBe(true);
      expect(frame.answeredFrom).toBe('new-query');

      // The note names both sets, says the inference is discarded, says RETAINED, and names the
      // still-unaccounted options (A, E) -- never silently drops any of that detail.
      const reconciliationLine = log.find((l) => l.includes('FRAME RECONCILIATION') && l.includes('INCOMPLETE PARTITION'));
      expect(reconciliationLine).toBeDefined();
      expect(reconciliationLine).toMatch(/RETAINED/);
      expect(reconciliationLine).toContain('A) South America');
      expect(reconciliationLine).toContain('E) Europe');
      for (const optLetter of ['G', 'H', 'I', 'D']) {
        expect(reconciliationLine).toContain(`${optLetter}) ${OPT[optLetter]}`);
      }
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('D-BP153-029 TEST 2 (ANTI-REGRESSION, MANDATORY): the D-BP153-020 case -- direct states NOTHING, complement names ONLY {A, E} -- ZERO exclusions, never restored by this fix', () => {
  test('an inference from absence is still forbidden -- the seven options nobody mentioned stay unexcluded', () => {
    const result = reconcileNamedSet(ALL, [], ['A', 'E'], OPT);
    // The direct side stated NOTHING, so there is nothing to retain -- this must stay `[]`, exactly
    // as D-BP153-020 established. D-BP153-029 retains what was STATED; it invents nothing.
    expect(result.members).toEqual([]);
    expect(result.partitionComplete).toBe(false);
    expect(result.why).toMatch(/INCOMPLETE PARTITION/);
    for (const optLetter of ['B', 'C', 'D', 'F', 'G', 'H', 'I']) {
      expect(result.why).toContain(`${optLetter}) ${OPT[optLetter]}`);
    }
  });
});

describe('D-BP153-029 TEST 3: a COMPLETE partition is unchanged', () => {
  test('direct + complement together cover all nine with zero conflicts -> trusted, reconciled exactly as before', () => {
    const result = reconcileNamedSet(ALL, ['G', 'H', 'I'], ['A', 'B', 'C', 'D', 'E', 'F'], OPT);
    expect(result.partitionComplete).toBe(true);
    expect(result.why).toMatch(/complete partition/);
    expect(new Set(result.members)).toEqual(new Set(['G', 'H', 'I']));
  });
});

describe('D-BP153-029 TEST 4: a CONFLICT is unchanged -- reported as a finding, never silently resolved', () => {
  test('an option on both lists falls back to the direct extraction, unreconciled, and is reported', () => {
    const result = reconcileNamedSet(ALL, ['G', 'H', 'I'], ['A', 'B', 'C', 'D', 'E', 'F', 'G'], OPT);
    expect(result.conflicts).toEqual(['G']);
    expect(result.why).toMatch(/CONFLICT/);
    expect(result.members).toEqual(['G', 'H', 'I']); // the direct extraction, unreconciled
  });
});

describe('D-BP153-029 TEST 5: complement-silent is unchanged, and now CONSISTENT with the incomplete case', () => {
  test('direct alone, complement says nothing -> the direct extraction stands, same outcome the incomplete case now also produces for its own directly stated values', () => {
    const result = reconcileNamedSet(ALL, ['G', 'H', 'I'], [], OPT);
    expect(result.members).toEqual(['G', 'H', 'I']);
    expect(result.incompletePartition).toBe(false);
    expect(result.why).toMatch(/complement extracted nothing/);
  });
});
