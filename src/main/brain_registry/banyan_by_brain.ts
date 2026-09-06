// banyan_by_brain.ts -- D-BP165-M0-036/BISHOP/M0/seg-swappable-brains-slot-registry
//
// BISHOP-M0 CORRECTION HONORED (mid-dispatch, D-BP165-M0-036): there are TWO Banyan Metric sets,
// not one. SET A -- the 10-dim per-ANSWER standard in
// ../liana_cycle/elements/banyan_metric_standard.ts (computeBanyanMetricStandard(), bands
// ABSOLUTE|HIGH|MEDIUM|LOW|INSUFFICIENT) -- is the one this file uses, AS-IS, NEVER RESCALED,
// because "which brain answers well" is an answer-quality question. SET B -- the six-dimension
// per-SESSION ledger row at
// C:\Users\Administrator\Documents\Asteroid-ProofVault\BANYAN_METRIC_LEDGER_BP083.md (Canon
// Density / Work Completion / Ship Class / Rework Rate / Drift Rate / Canon Maintenance, one
// sealed row per session) scores a SEAT OR SESSION, not an answer, and does NOT belong in a
// slot-assignment picker -- it is intentionally NOT read or merged here. LAW 3 ("no delta without
// identity"): a Set A composite and a Set B composite are different identities; comparing or
// averaging them would be meaningless, so this file never imports banyan_metric_standard's
// sibling-in-name-only counterpart and never produces a combined number.
//
// LAW 3 ALSO GOVERNS THE GROUPING KEY: every summary below is keyed by (brain identity, machineId)
// and NEVER averaged across machineId. M0 (16 GB, gemma4:12b) and M3 (8 GB, gemma2:2b) are
// different machines running different models under real hardware constraints -- collapsing them
// into one number would describe no machine that actually exists.
//
// WHAT THIS FILE DELIBERATELY DOES NOT DO, AND WHY (Truth-Always, "a guessed identity is worse
// than a missing one"): the two places in this repo that already compute the ingredients this
// file needs are NOT the same call, and correlating them safely is a real, separate piece of work
// this dispatch does not force:
//   - liana_cycle/cost_instrument.ts's recordLlmCall() already tags every real Ollama call with
//     `model` (pinned by digest) and `machineId` (comparative_cascade.ts's gemmaExtract() is the
//     one wired call site, per that file's own header).
//   - liana_cycle/methods/classify_cascade.ts:1056 already computes a Set A
//     computeBanyanMetricStandard() score for the SAME run's final answer, from loop.bank /
//     loop.survivors -- but nothing in that function's scope names WHICH model produced the
//     passages the score is built from; the brain identity lives one layer away, in whichever
//     comparative_cascade.ts call(s) filled loop.bank.
//   Forcing a call at classify_cascade.ts:1056 to tag its Banyan score with a brain_id guessed
//   from context (rather than read off the actual call that produced it) would be exactly the
//   "no delta without identity" violation LAW 3 forbids -- an unverified identity is worse than no
//   identity. This file is therefore built and ready to record real (brain_id, machineId, score)
//   triples the moment a caller can supply a VERIFIED identity; it does not fabricate one itself,
//   and it is not wired into classify_cascade.ts this dispatch. Flagged here, not silently
//   skipped, per LAW 7 ("an unanswered ask is the answerer's failure") -- the ask (attach Banyan
//   scoring per brain) is answered with a real, working instrument; the LAST MILE (the live call
//   site) needs a follow-up dispatch that traces the identity-correlation gap named above.
//
// Persistence: same fs + app.getPath('userData') convention as brain_registry.ts and
// slot_registry.ts -- an append-only JSONL ledger, one line per recorded answer score, never
// rewritten in place (mirrors this estate's own append-only ledger convention, e.g.
// BANYAN_METRIC_LEDGER_BP083.md's "Append-only" header).
//
// No em-dashes. Additive only.

import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import type { BanyanConfidenceLabel } from '../liana_cycle/elements/banyan_metric_standard';

const LEDGER_FILENAME = 'banyan_by_brain_ledger.jsonl';

/**
 * One VERIFIED (Set A composite, brain, machine) triple. `brain_id` must be a real
 * brain_registry.ts brain_id/model_id or a real BrowserAuthorityName -- this module does not
 * validate that here (it has no dependency on slot_registry.ts's catalog by design, to stay a
 * leaf module cost_instrument.ts-adjacent code can depend on without a cycle); the CALLER is
 * responsible for supplying a real identity, per this file's header.
 */
export interface BrainAnswerScore {
  brain_id: string;
  /** os.hostname() at the machine that actually ran the call -- never a guess, never "the
   *  orchestrator's own hostname" standing in for a remote seat. */
  machineId: string;
  /** Optional: the demand/task type this answer was for, when the caller has one (e.g. a
   *  method_registry.ts method name). Absent, never fabricated, when unknown. */
  demand_type?: string;
  composite: number; // Set A's 0-100 composite, unrescaled, straight from BanyanMetricResult
  band: BanyanConfidenceLabel;
  ts: string; // ISO8601
}

function getLedgerPath(): string {
  return join(app.getPath('userData'), LEDGER_FILENAME);
}

/** Appends one verified score to the ledger. Never overwrites, never rewrites a prior line. */
export function recordBrainAnswerScore(entry: Omit<BrainAnswerScore, 'ts'>): void {
  const userDataDir = app.getPath('userData');
  mkdirSync(userDataDir, { recursive: true });
  const record: BrainAnswerScore = { ...entry, ts: new Date().toISOString() };
  appendFileSync(getLedgerPath(), JSON.stringify(record) + '\n', 'utf8');
}

function readLedger(): BrainAnswerScore[] {
  const filePath = getLedgerPath();
  if (!existsSync(filePath)) return [];
  const raw = readFileSync(filePath, 'utf8');
  const out: BrainAnswerScore[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed) as BrainAnswerScore);
    } catch {
      // Skip a corrupt line rather than aborting the whole read -- never fabricate a
      // replacement for a line that failed to parse.
    }
  }
  return out;
}

export interface BrainNodeSummary {
  brain_id: string;
  machineId: string;
  count: number;
  avgComposite: number;
  /** Band of the AVERAGE composite (bandFor semantics), not a vote across individual bands --
   *  labeled explicitly so a reader never mistakes it for "most common band". */
  bandOfAverage: BanyanConfidenceLabel;
  byDemandType: Record<string, { count: number; avgComposite: number }>;
}

function bandFor(composite: number): BanyanConfidenceLabel {
  if (composite >= 90) return 'ABSOLUTE';
  if (composite >= 75) return 'HIGH';
  if (composite >= 60) return 'MEDIUM';
  if (composite >= 40) return 'LOW';
  return 'INSUFFICIENT';
}

/**
 * Groups every recorded score by (brain_id, machineId) -- PER-NODE COLUMNS, NEVER AVERAGED
 * ACROSS SEATS (LAW 3). Two rows with the same brain_id but different machineId are always two
 * separate summary entries, never merged.
 */
export function summarizeBanyanByBrain(): BrainNodeSummary[] {
  const records = readLedger();
  const groups = new Map<string, BrainAnswerScore[]>();
  for (const r of records) {
    const key = `${r.brain_id}\u0000${r.machineId}`;
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  }

  const summaries: BrainNodeSummary[] = [];
  for (const [key, group] of groups) {
    const [brain_id, machineId] = key.split('\u0000');
    const avgComposite = Math.round((group.reduce((s, r) => s + r.composite, 0) / group.length) * 10) / 10;

    const byDemandType: Record<string, { count: number; avgComposite: number }> = {};
    const byDemandGroups = new Map<string, BrainAnswerScore[]>();
    for (const r of group) {
      if (!r.demand_type) continue;
      const arr = byDemandGroups.get(r.demand_type) ?? [];
      arr.push(r);
      byDemandGroups.set(r.demand_type, arr);
    }
    for (const [dt, dtGroup] of byDemandGroups) {
      byDemandType[dt] = {
        count: dtGroup.length,
        avgComposite: Math.round((dtGroup.reduce((s, r) => s + r.composite, 0) / dtGroup.length) * 10) / 10,
      };
    }

    summaries.push({
      brain_id,
      machineId,
      count: group.length,
      avgComposite,
      bandOfAverage: bandFor(avgComposite),
      byDemandType,
    });
  }
  return summaries;
}
