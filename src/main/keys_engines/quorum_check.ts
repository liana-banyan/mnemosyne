/**
 * quorum_check.ts -- Keys and Engines: 2-of-3 hash quorum before install
 * BP087 Wave 4 · Keys and Engines canon
 *
 * Sources:
 *   1. Circle peer A (from circle_query.ts)
 *   2. Circle peer B (from circle_query.ts)
 *   3. IP Ledger HEAD hash (from ip_ledger_store.ts or REST query)
 *
 * Rule: at least 2 of 3 must agree on the same hash string.
 * If fewer than 2 agree: REFUSE + emit mismatch report.
 */

import { queryCircleHashes } from './circle_query';
import type { PeerHashResponse } from './circle_query';

export interface QuorumResult {
  passed: boolean;
  agreedHash: string | null;
  agreementCount: number;
  peerResponses: PeerHashResponse[];
  ledgerHash: string;
  mismatchDelta?: string; // JSON diff of disagreeing hashes for frontier_reputation_log
}

/**
 * Run 2-of-3 quorum check for a given update version + expected hash.
 * ledgerHash: the hash recorded in IP Ledger HEAD for this version.
 * peerAddresses: array of at least 2 Circle peer address strings (host:port).
 */
export async function runQuorumCheck(
  version: string,
  ledgerHash: string,
  peerAddresses: string[],
): Promise<QuorumResult> {
  const peerResponses = await queryCircleHashes(peerAddresses.slice(0, 2), version);

  const allHashes: string[] = [
    ...peerResponses.map((r) => (r.ok ? r.hash : '')),
    ledgerHash,
  ].filter(Boolean);

  // Count occurrences of each hash
  const counts = new Map<string, number>();
  for (const h of allHashes) {
    counts.set(h, (counts.get(h) ?? 0) + 1);
  }

  // Find hash with highest agreement
  let agreedHash: string | null = null;
  let agreementCount = 0;
  for (const [hash, count] of counts) {
    if (count > agreementCount) {
      agreedHash = hash;
      agreementCount = count;
    }
  }

  const passed = agreementCount >= 2;

  let mismatchDelta: string | undefined;
  if (!passed) {
    mismatchDelta = JSON.stringify({
      peer_a: peerResponses[0]?.hash ?? 'unavailable',
      peer_b: peerResponses[1]?.hash ?? 'unavailable',
      ledger: ledgerHash,
    });
  }

  return {
    passed,
    agreedHash: passed ? agreedHash : null,
    agreementCount,
    peerResponses,
    ledgerHash,
    mismatchDelta,
  };
}
