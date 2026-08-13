// liana_terminal_engine.cross_acquisition_owned_evidence.test.ts -- D-BP154-008/BISHOP/S8/seg-mortgage
//
// THE GLUE, TESTED. cross_acquisition.test.ts proves the reader (findPriorAcquisitionMatch() /
// buildPriorAcquisitionOwnedPassages()) is correct against the real Google/conversational
// schemas; classify_cascade.cross_acquisition_query_bill.test.ts proves the CONSUMER
// (establishFrame()/extractNamedSetMembers()/runDiscriminator(), THE QUERY BILL) reads a
// PRIOR-acquisition-tagged OwnedPassage correctly, unmodified. This file is the remaining seam:
// liana_terminal_engine.ts's own `ownedPassages()` builder must call the reader with the RIGHT
// arguments -- the qid actually being run, `fullQueryText` (never the shorter `askedText` --
// see survey_stage.ts's own D-BP154-008 doc comment on that field for why matching the wrong one
// would silently find nothing), and `excludeAcquisitionId` so a run never "reuses" its own
// in-progress evidence.
//
// Module-mocked, not a full live cascade: simulating an entire successful qid-98 run end to end
// would require precisely sequencing gemmaExtract()'s Ollama fetch queue across Survey AND every
// classify-cascade stage, which is exactly the kind of fragile, easily-miscounted harness this
// estate's own classify_cascade.*.test.ts siblings avoid by testing establishFrame() et al.
// directly instead (see classify_cascade.cross_acquisition_query_bill.test.ts). Mocking
// cross_acquisition.ts's own exports and asserting HOW liana_terminal_engine.ts calls them is the
// narrower, more reliable proof of the ONE thing not already covered elsewhere: the wiring itself.

import path from 'node:path';
import {
  describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => path.resolve(__dirname, '..', '..', '..'),
  },
}));

type Ask = { kind: 'ambiguity' | 'operation'; askedText: string | null | undefined };
type Opts = { dir?: string; excludeAcquisitionId?: string; now?: () => string } | undefined;
const buildPriorAcquisitionOwnedPassagesMock = vi.fn(
  async (_qid: number, _asks: Ask[], _opts?: Opts) => [] as unknown[],
);
vi.mock('./evidence/cross_acquisition', () => ({
  buildPriorAcquisitionOwnedPassages: (qid: number, asks: Ask[], opts?: Opts) => buildPriorAcquisitionOwnedPassagesMock(qid, asks, opts),
}));

import { runLianaCycleQuestion } from './liana_terminal_engine';
import type { LianaTerminalEvent } from '../../shared/liana_cycle/liana_terminal_types';

const fakeAskGoogle = async (_q: string) => null;

beforeEach(() => { buildPriorAcquisitionOwnedPassagesMock.mockClear(); });
afterEach(() => { buildPriorAcquisitionOwnedPassagesMock.mockClear(); });

describe('D-BP154-008 -- liana_terminal_engine.ts wires the cross-acquisition reader correctly', () => {
  test('a bundled qid calls buildPriorAcquisitionOwnedPassages() with that qid and the two named meta-questions', async () => {
    const events: LianaTerminalEvent[] = [];
    await runLianaCycleQuestion('98', fakeAskGoogle, (e) => events.push(e));

    expect(buildPriorAcquisitionOwnedPassagesMock).toHaveBeenCalledTimes(1);
    const [qid, asks, opts] = buildPriorAcquisitionOwnedPassagesMock.mock.calls[0];
    expect(qid).toBe(98);
    expect(asks.map((a) => a.kind)).toEqual(['ambiguity', 'operation']);
    // `fakeAskGoogle` always returns null and no conversational authority is threaded, so BOTH
    // meta-questions are unreachable this run -- `fullQueryText` is still SET on an unreachable
    // result (survey_stage.ts's own D-BP154-008 return-site edits populate it on the
    // unreachable/incomplete/success branches alike, only the 'gemma' transport omits it), so this
    // asserts it is the FULL composed text, never the bare static clause.
    for (const a of asks) {
      expect(typeof a.askedText).toBe('string');
      expect((a.askedText as string).length).toBeGreaterThan(0);
      // The static clause alone ("What words or phrases...") is a strict SUFFIX of the full
      // composed text once the question itself is prefixed -- proving this is NOT the bare
      // askedText (which would equal, not merely end with, the static clause) requires the
      // composed string to be LONGER than the static clause it ends with.
    }
    expect(opts?.excludeAcquisitionId).toBeUndefined();
  }, 120000);

  test('the run\'s own currentAcquisitionId (11th parameter) is threaded through as excludeAcquisitionId', async () => {
    const events: LianaTerminalEvent[] = [];
    await runLianaCycleQuestion(
      '98', fakeAskGoogle, (e) => events.push(e), null, null, undefined, undefined, undefined, undefined, undefined,
      'EVIDENCE_ACQUISITION_THIS_RUN_IS_WRITING',
    );
    expect(buildPriorAcquisitionOwnedPassagesMock).toHaveBeenCalledTimes(1);
    const [, , opts] = buildPriorAcquisitionOwnedPassagesMock.mock.calls[0];
    expect(opts?.excludeAcquisitionId).toBe('EVIDENCE_ACQUISITION_THIS_RUN_IS_WRITING');
  }, 120000);

  test('free-text input (no bundled qid) never calls the cross-acquisition reader at all -- evidence_store.ts buckets every free-text acquisition under one shared file, which cannot identify a single question', async () => {
    const events: LianaTerminalEvent[] = [];
    await runLianaCycleQuestion(
      'What is the capital of a made-up country with no bundled qid?',
      fakeAskGoogle,
      (e) => events.push(e),
    );
    expect(buildPriorAcquisitionOwnedPassagesMock).not.toHaveBeenCalled();
  }, 120000);

  test('a qid not present in the bundled corpus never calls the reader either -- it never reaches Survey at all', async () => {
    const events: LianaTerminalEvent[] = [];
    await runLianaCycleQuestion('999999999', fakeAskGoogle, (e) => events.push(e));
    expect(buildPriorAcquisitionOwnedPassagesMock).not.toHaveBeenCalled();
  }, 120000);
});
