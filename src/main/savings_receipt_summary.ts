// savings_receipt_summary.ts -- D-BP223-BM09-ARCHBISHOP-004-016 (REDO of 004-010)
//
// Pure shape-assembler for the 'savings-receipt:summary' IPC response. No Electron import, no
// file I/O -- ai_dispatch_ipc.ts's handler does all the reading (verifySavingsChain,
// computePeriodAggregate, anchorDigest, getFirstRecordTimestamp, signWithLocalPeerKey) and hands
// the results here to be shaped into the exact object returned to the renderer. Kept separate
// from that handler so the RETURN SHAPE itself -- in particular, that it never carries a file
// path, a hostname, a username, or question text -- is unit-testable without mocking Electron.
//
// Confirmed before writing this file: substrate_savings_receipt.ts's PeriodAggregate and
// ChainVerifyResult types (the two record shapes this module forwards into its return value)
// carry no path/hostname/username/question-text fields -- see that file's own type definitions.
// anchorDigest()'s AnchorDigest DOES carry a `source_log_path` field; this module's
// BuildSummaryArgs deliberately takes only `chainHead`/`totalChainRecords` (two of its four
// fields), never the AnchorDigest object itself, so a future edit cannot accidentally forward
// source_log_path into the summary by widening this module's inputs.

import type { PeriodAggregate, ChainVerifyResult } from './substrate_savings_receipt';
import type { SavingsReceiptWindow, SavingsReceiptTrailingWindow } from './savings_receipt_milestones';
import { milestoneReached } from './savings_receipt_milestones';

export interface SavingsMilestoneFlags {
  hour: boolean;
  day: boolean;
  week: boolean;
  fortnight: boolean;
  month: boolean;
  quarter: boolean;
}

export interface SavingsReceiptSummary {
  ok: true;
  window: SavingsReceiptWindow;
  /** true when the receipts chain has zero records -- nothing measured yet. When true,
   *  `aggregate` and `receipt_block` are both null; the renderer shows the empty-state copy. */
  empty: boolean;
  chain_ok: boolean;
  chain_broken_at_index: number | null;
  chain_head: string;
  chain_records: number;
  first_record_utc: string | null;
  days_in_use: number;
  milestones_reached: SavingsMilestoneFlags;
  aggregate: PeriodAggregate | null;
  receipt_block: string | null;
}

export interface BuildSummaryArgs {
  window: SavingsReceiptWindow;
  chainResult: ChainVerifyResult;
  chainHead: string;
  totalChainRecords: number;
  firstRecordUtc: string | null;
  nowIso: string;
  /** Aggregate for the REQUESTED window -- null exactly when totalChainRecords === 0 (nothing to
   *  aggregate). */
  aggregate: PeriodAggregate | null;
  /** total_queries within each trailing window (for the milestone "actual use in-window" gate) --
   *  every value here should be 0 when firstRecordUtc is null; milestoneReached() also
   *  independently short-circuits to false in that case regardless of what is passed. */
  milestoneQueryCounts: Record<SavingsReceiptTrailingWindow, number>;
  /** The already-signed v1 block text, or null exactly when totalChainRecords === 0. */
  receiptBlock: string | null;
}

const TRAILING_WINDOWS: SavingsReceiptTrailingWindow[] = ['hour', 'day', 'week', 'fortnight', 'month', 'quarter'];

function daysInUseFromMs(nowIso: string, firstRecordIso: string | null): number {
  if (!firstRecordIso) return 0;
  const elapsedMs = new Date(nowIso).getTime() - new Date(firstRecordIso).getTime();
  return Math.max(0, Math.floor(elapsedMs / (24 * 60 * 60 * 1000)));
}

export function buildSavingsReceiptSummary(args: BuildSummaryArgs): SavingsReceiptSummary {
  const empty = args.totalChainRecords === 0;

  const milestones_reached: SavingsMilestoneFlags = {} as SavingsMilestoneFlags;
  for (const w of TRAILING_WINDOWS) {
    milestones_reached[w] = milestoneReached(w, args.nowIso, args.firstRecordUtc, args.milestoneQueryCounts[w]);
  }

  return {
    ok: true,
    window: args.window,
    empty,
    chain_ok: args.chainResult.ok,
    chain_broken_at_index: args.chainResult.broken_at_index,
    chain_head: args.chainHead,
    chain_records: args.totalChainRecords,
    first_record_utc: args.firstRecordUtc,
    days_in_use: daysInUseFromMs(args.nowIso, args.firstRecordUtc),
    milestones_reached,
    aggregate: empty ? null : args.aggregate,
    receipt_block: empty ? null : args.receiptBlock,
  };
}
