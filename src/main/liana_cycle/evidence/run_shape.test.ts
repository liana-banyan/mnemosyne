// run_shape.test.ts -- D-BP153-002/BISHOP/evidence-store
//
// The shape ledger, its diff, and the convergence measure.
//
// Fully pure: no fs, no network, no clock. Every input below is a hand-built transcript using the
// engine's own emit conventions, quoted from liana_terminal_engine.ts so the extractors are
// tested against the real string shapes rather than against strings invented for the test.

import { describe, test, expect } from 'vitest';
import type { LianaTerminalEvent } from '../../../shared/liana_cycle/liana_terminal_types';
import { deriveRunShape, diffRunShapes, measureConvergence } from './run_shape';

const ev = (kind: LianaTerminalEvent['kind'], text: string): LianaTerminalEvent => ({ kind, text, ts: '2026-08-12T03:00:00.000Z' });

// Mirrors the real engine output: a DEMAND PATH note (liana_terminal_engine.ts:706), a METHOD
// SELECTED result (line 757, emitted via say()), and stage banners prefixed '-> '.
const HEALTHY: LianaTerminalEvent[] = [
  ev('stage', '-> SURVEY -- the Founder\'s own steps'),
  ev('note', '   DEMAND PATH: structural (Law 5, HARDWIRE-23 -- names which SURVEY STEP 2 result produced the demand below)'),
  ev('stage', '-> DEMAND TEST (SURVEYED ASK) -- what operation must this answer perform?'),
  ev('stage', '-> METHOD SELECTION -- checking every method on file'),
  ev('result', 'METHOD SELECTED: The Classify Cascade (classify-cascade)'),
  ev('result', 'ABSTAIN (2 survivors, loop stopped: terms-exhausted)   survivors: A,C'),
];

describe('deriveRunShape reads the engine\'s own conventions', () => {
  test('it extracts the demand path, the method, the last stage, and where it stopped', () => {
    const shape = deriveRunShape(HEALTHY, { qid: 98, verdict: null, abstain: true, error: undefined, method: 'classify-cascade' });
    expect(shape.demandPath).toBe('structural');
    expect(shape.methodSelected).toBe('classify-cascade');
    expect(shape.lastStage).toBe('METHOD SELECTION -- checking every method on file');
    expect(shape.stoppedAt).toBe('METHOD SELECTED: The Classify Cascade (classify-cascade)');
    expect(shape.counts).toEqual({ events: 6, stages: 3, results: 2, errors: 0 });
    expect(shape.unparsed).toEqual([]);
  });

  test('the pre-BP153 dead run is a DIFFERENT shape, which is the point', () => {
    // This is qid 98 as it behaved before D-BP153-001: demand path 'none', no method, stopped at
    // the gate. The shape ledger's whole job is that this is mechanically distinguishable from
    // the healthy transcript above.
    const dead: LianaTerminalEvent[] = [
      ev('stage', '-> SURVEY -- the Founder\'s own steps'),
      ev('note', '   DEMAND PATH: none (Law 5, HARDWIRE-23 -- names which SURVEY STEP 2 result produced the demand below)'),
      ev('stage', '-> METHOD SELECTION -- checking every method on file'),
      ev('result', 'DEMAND UNKNOWN -- the operation this answer must perform could not be determined, so no method may run.'),
    ];
    const before = deriveRunShape(dead, { qid: 98, verdict: null, abstain: true, error: 'demand_unknown', method: undefined });
    const after = deriveRunShape(HEALTHY, { qid: 98, verdict: null, abstain: true, error: undefined, method: 'classify-cascade' });

    expect(before.demandPath).toBe('none');
    expect(before.methodSelected).toBeNull();
    expect(before.error).toBe('demand_unknown');

    const diff = diffRunShapes(before, after);
    const changed = diff.map((d) => d.field).sort();
    expect(changed).toContain('demandPath');
    expect(changed).toContain('methodSelected');
    expect(changed).toContain('error');
  });

  test('an unreadable field is named in `unparsed`, never quietly defaulted', () => {
    const noDemand: LianaTerminalEvent[] = [ev('stage', '-> SURVEY')];
    const shape = deriveRunShape(noDemand, { qid: 98, verdict: null, abstain: true, error: undefined, method: undefined });
    expect(shape.demandPath).toBeNull();
    expect(shape.unparsed).toContain('demandPath');
    expect(shape.unparsed).toContain('stoppedAt');
  });

  test('deriving the same transcript twice gives an identical shape', () => {
    const a = deriveRunShape(HEALTHY, { qid: 98, verdict: null, abstain: true, error: undefined, method: 'classify-cascade' });
    const b = deriveRunShape(HEALTHY, { qid: 98, verdict: null, abstain: true, error: undefined, method: 'classify-cascade' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(diffRunShapes(a, b)).toEqual([]);
  });
});

describe('measureConvergence: the Founder\'s adage, made mechanical', () => {
  // "if anyone can figure out the answer, then we can too" -- the channel varies, the answer must
  // not. These are verdicts from INDEPENDENT acquisitions of the same question.
  test('same verdict across independent acquisitions is stable', () => {
    const c = measureConvergence([
      { acquisitionId: 'mon', verdict: 'A', abstain: false },
      { acquisitionId: 'tue', verdict: 'A', abstain: false },
      { acquisitionId: 'wed', verdict: 'A', abstain: false },
    ]);
    expect(c.stable).toBe(true);
    expect(c.answered).toBe(3);
    expect(c.distinctVerdicts).toEqual(['A']);
  });

  test('two acquisitions answering differently is a contradiction and is named', () => {
    const c = measureConvergence([
      { acquisitionId: 'mon', verdict: 'A', abstain: false },
      { acquisitionId: 'tue', verdict: 'C', abstain: false },
    ]);
    expect(c.stable).toBe(false);
    expect(c.distinctVerdicts).toEqual(['A', 'C']);
    expect(c.disagreeing).toHaveLength(2);
  });

  test('an abstain does not break stability on its own', () => {
    // An abstain is the framework declining on thin evidence, not the framework contradicting
    // itself. It is counted separately so a run of abstains is visible as incompleteness rather
    // than being laundered into apparent agreement.
    const c = measureConvergence([
      { acquisitionId: 'mon', verdict: 'A', abstain: false },
      { acquisitionId: 'tue', verdict: null, abstain: true },
    ]);
    expect(c.stable).toBe(true);
    expect(c.answered).toBe(1);
    expect(c.abstained).toBe(1);
  });

  test('all abstains is stable but answered=0, which must not read as success', () => {
    const c = measureConvergence([
      { acquisitionId: 'mon', verdict: null, abstain: true },
      { acquisitionId: 'tue', verdict: null, abstain: true },
    ]);
    expect(c.stable).toBe(true);
    expect(c.answered).toBe(0);
    expect(c.abstained).toBe(2);
  });
});
