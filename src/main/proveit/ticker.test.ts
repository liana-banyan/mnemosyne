// ticker.test.ts -- D-BP223-BM04-X033S3-009 STEP 3
//
// Ticker event order (spec Section 3: "streamed to the renderer as it happens ... in the order it
// happens") -- both the sink broadcast order and the per-run readback order.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { emitTicker, emitTickerError, newRunId, getRunEvents, setTickerSink, _clearTickerLogForTests } from './ticker';
import type { ProveItTickerEvent } from '../../shared/proveit_contract';

beforeEach(() => {
  _clearTickerLogForTests();
  setTickerSink(null);
});

afterEach(() => {
  setTickerSink(null);
});

describe('emitTicker', () => {
  it('records events for one run in the exact order emitted, each with a real ms timestamp', () => {
    const runId = newRunId();
    emitTicker(runId, 'question_received', 'question received . category physics');
    emitTicker(runId, 'category_confirmed', 'category confirmed: physics');
    emitTicker(runId, 'answer_received', 'answer received . 10 words . 1 source cited');

    const events = getRunEvents(runId);
    expect(events.map((e) => e.step)).toEqual(['question_received', 'category_confirmed', 'answer_received']);
    expect(events.every((e) => Number.isFinite(e.atMs) && e.atMs > 0)).toBe(true);
    for (let i = 1; i < events.length; i++) expect(events[i].atMs).toBeGreaterThanOrEqual(events[i - 1].atMs);
  });

  it('keeps separate runs from interleaving', () => {
    const runA = newRunId();
    const runB = newRunId();
    emitTicker(runA, 'question_received', 'a1');
    emitTicker(runB, 'question_received', 'b1');
    emitTicker(runA, 'card_written', 'a2');

    expect(getRunEvents(runA).map((e) => e.line)).toEqual(['a1', 'a2']);
    expect(getRunEvents(runB).map((e) => e.line)).toEqual(['b1']);
  });

  it('broadcasts to the sink in the same order it records locally', () => {
    const received: ProveItTickerEvent[] = [];
    setTickerSink((e) => received.push(e));
    const runId = newRunId();
    emitTicker(runId, 'question_received', '1');
    emitTicker(runId, 'brain_selected', '2');
    emitTickerError(runId, 'answer_received', 'boom');

    expect(received.map((e) => e.step)).toEqual(['question_received', 'brain_selected', 'error']);
    expect(received[2].error).toEqual({ atStep: 'answer_received', reason: 'boom', byHandOffered: true });
  });

  it('a throwing sink never breaks the caller (a dead renderer window must not break the ask flow)', () => {
    setTickerSink(() => { throw new Error('window destroyed'); });
    const runId = newRunId();
    expect(() => emitTicker(runId, 'question_received', 'still recorded')).not.toThrow();
    expect(getRunEvents(runId)).toHaveLength(1);
  });
});
