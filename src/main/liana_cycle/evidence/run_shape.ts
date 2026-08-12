// run_shape.ts -- D-BP153-002/BISHOP/evidence-store
//
// THE SHAPE LEDGER. One compact, diffable record per run: which path produced the demand, which
// method was selected, where the run stopped, and why.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// WHY SHAPE AND NOT SCORE.
//
// The most valuable test in this repo on the night this was written was
// liana_terminal_engine.assisted_mode_round_count.test.ts, and it asserts nothing about whether
// qid 98 is answered correctly. It pins WHERE THE RUN STOPS and HOW MANY ROUNDS IT TOOK. When the
// BP153 demand fix changed the run, that test failed loudly and named the new number. It caught
// the only real regression of the session.
//
// That is the general lesson this file generalizes. A score tells you a number moved. A shape
// tells you WHAT CHANGED, and a shape derived from a frozen acquisition is fully deterministic:
// no network, no clock, no model. So a regression check becomes "replay every acquisition, diff
// the shapes" rather than "run the suite and interpret the wreckage."
//
// PARSING STRINGS IS A KNOWN COMPROMISE, DISCLOSED. LianaTerminalEvent carries only
// { kind, text, ts } -- there is no structured channel alongside `text` (liana_terminal_types
// .ts:19-25). So the extractors below pattern-match the engine's own hand-written conventions.
// THIS IS FRAGILE ON PURPOSE-ADJACENT GROUNDS: making it robust would mean adding a structured
// field to every emit call site across the engine and five methods, which is a far larger change
// than was asked for here. The mitigation is that each extractor returns null rather than
// guessing when its pattern does not match, and `unparsed` counts what it could not read, so a
// shape that silently degrades is visible as a shape with missing fields rather than a shape
// that looks complete and is wrong.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import type { LianaTerminalEvent, LianaTerminalOutcome } from '../../../shared/liana_cycle/liana_terminal_types';

export interface RunShape {
  schema: 'liana-run-shape/1';
  qid: number | null;
  /** 'nested' | 'operation' | 'ambiguity' | 'structural' | 'none', or null if never emitted. */
  demandPath: string | null;
  /** The method id the engine selected, or null if it never got that far. */
  methodSelected: string | null;
  /** The last 'stage' banner reached, verbatim minus its '-> ' prefix. Where the run got to. */
  lastStage: string | null;
  /** The first 'result' event's text. Where the run stopped and, by the engine's own convention,
   *  why. */
  stoppedAt: string | null;
  /** From the outcome, not parsed. */
  verdict: string | null;
  abstain: boolean;
  error: string | null;
  /** Counts, which move for structural reasons and are therefore good regression signals. */
  counts: {
    events: number;
    stages: number;
    results: number;
    errors: number;
  };
  /** Fields the parser could not extract from the transcript. A non-empty list means this shape
   *  is INCOMPLETE and must not be diffed as though it were whole. */
  unparsed: string[];
}

const DEMAND_PATH_RE = /^\s*DEMAND PATH:\s*(\S+)/;
const METHOD_SELECTED_RE = /^METHOD SELECTED:\s*.*\(([^)]+)\)\s*$/;

/**
 * Derives the shape of a run from its event transcript and outcome. Pure: no clock, no fs, no
 * network. Given the same transcript it returns the same shape, which is what makes it diffable.
 */
export function deriveRunShape(
  events: LianaTerminalEvent[],
  outcome: Pick<LianaTerminalOutcome, 'qid' | 'verdict' | 'abstain' | 'error' | 'method'>,
): RunShape {
  let demandPath: string | null = null;
  let methodSelected: string | null = null;
  let lastStage: string | null = null;
  let stoppedAt: string | null = null;
  let stages = 0;
  let results = 0;
  let errors = 0;

  for (const e of events) {
    if (e.kind === 'stage') {
      stages += 1;
      lastStage = e.text.replace(/^->\s*/, '');
    }
    if (e.kind === 'result') {
      results += 1;
      if (stoppedAt === null) stoppedAt = e.text;
      const m = METHOD_SELECTED_RE.exec(e.text);
      if (m && methodSelected === null) [, methodSelected] = m;
    }
    if (e.kind === 'error') errors += 1;
    if (e.kind === 'note' && demandPath === null) {
      const m = DEMAND_PATH_RE.exec(e.text);
      if (m) [, demandPath] = m;
    }
  }

  // The outcome is authoritative for the method when it carries one: parsing the banner is a
  // fallback for transcripts where the engine refused before emitting it.
  if (outcome.method) methodSelected = outcome.method;

  const unparsed: string[] = [];
  if (demandPath === null) unparsed.push('demandPath');
  if (stoppedAt === null) unparsed.push('stoppedAt');

  return {
    schema: 'liana-run-shape/1',
    qid: outcome.qid ?? null,
    demandPath,
    methodSelected,
    lastStage,
    stoppedAt,
    verdict: outcome.verdict ?? null,
    abstain: Boolean(outcome.abstain),
    error: outcome.error ?? null,
    counts: { events: events.length, stages, results, errors },
    unparsed,
  };
}

export interface ShapeDiffEntry {
  field: string;
  before: unknown;
  after: unknown;
}

/**
 * Diffs two shapes field by field. This is the regression check: replay an acquisition through
 * old and new code, diff the shapes, and any non-empty result is a behavior change that must be
 * explained or accepted deliberately.
 *
 * `unparsed` is compared too, because a shape that started failing to parse is itself a change.
 */
export function diffRunShapes(before: RunShape, after: RunShape): ShapeDiffEntry[] {
  const out: ShapeDiffEntry[] = [];
  const push = (field: string, b: unknown, a: unknown) => {
    if (JSON.stringify(b) !== JSON.stringify(a)) out.push({ field, before: b, after: a });
  };
  push('demandPath', before.demandPath, after.demandPath);
  push('methodSelected', before.methodSelected, after.methodSelected);
  push('lastStage', before.lastStage, after.lastStage);
  push('stoppedAt', before.stoppedAt, after.stoppedAt);
  push('verdict', before.verdict, after.verdict);
  push('abstain', before.abstain, after.abstain);
  push('error', before.error, after.error);
  push('counts', before.counts, after.counts);
  push('unparsed', before.unparsed, after.unparsed);
  return out;
}

/**
 * Convergence across INDEPENDENT acquisitions of the same question. This is the Founder's BP153
 * point made mechanical: "if anyone can figure out the answer, then we can too."
 *
 * The channel varies. The answer must not. Replay the derivation over N acquisitions gathered on
 * different days through different surfaces, hand the verdicts here, and this reports whether the
 * framework squeezed the channel's variance out.
 *
 * `stable` means every acquisition that produced a verdict produced the SAME verdict. Abstains
 * are counted separately and do NOT break stability on their own: an abstain is the framework
 * declining to answer on thin evidence, not the framework disagreeing with itself. But an
 * acquisition that answered A while another answered C is a genuine contradiction, and that is
 * what `stable: false` names.
 */
export function measureConvergence(
  verdicts: Array<{ acquisitionId: string; verdict: string | null; abstain: boolean }>,
): {
  stable: boolean;
  answered: number;
  abstained: number;
  distinctVerdicts: string[];
  disagreeing: Array<{ acquisitionId: string; verdict: string }>;
} {
  const answered = verdicts.filter((v) => !v.abstain && v.verdict != null);
  const abstained = verdicts.filter((v) => v.abstain || v.verdict == null);
  const distinct = [...new Set(answered.map((v) => v.verdict as string))].sort();
  return {
    stable: distinct.length <= 1,
    answered: answered.length,
    abstained: abstained.length,
    distinctVerdicts: distinct,
    disagreeing: distinct.length > 1
      ? answered.map((v) => ({ acquisitionId: v.acquisitionId, verdict: v.verdict as string }))
      : [],
  };
}
