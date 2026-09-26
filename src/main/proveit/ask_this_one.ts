// ask_this_one.ts -- D-BP223-BM04-X033S3-009 STEP 1d
//
// "Ask this one" (spec Section 1 region D, Section 2's second-ask, acceptance line 1): address
// lookup -> card, 0 model calls, ticker. This is the whole cross-person demonstration -- no
// question text is typed, no brain is opened, the answer comes back from the address alone.

import { findCardByAddress } from './card_store';
import { emitTicker, emitTickerError, newRunId } from './ticker';
import type { ProveItCard } from '../../shared/proveit_contract';

export interface AskThisOneResult {
  runId: string;
  card: ProveItCard | null;
  stale: boolean;
  staleLabel?: string;
}

export function askThisOne(address: string): AskThisOneResult {
  const runId = newRunId();
  emitTicker(runId, 'substrate_lookup', `checking the substrate for an existing card ... looking up address hex:${address}`);
  const card = findCardByAddress(address);
  if (!card) {
    emitTickerError(runId, 'substrate_lookup', `no card found at address hex:${address}`);
    return { runId, card: null, stale: false };
  }
  emitTicker(runId, 'substrate_lookup', `card found . address hex:${address} . hit`);
  emitTicker(runId, 'card_written', `card read . address hex:${address} . dated ${card.madeAt.slice(0, 10)}`);
  emitTicker(runId, 'meter_delta', 'THIS ask: 0 model calls . our cost $0.00');

  const stale = card.validUntil !== null && Date.parse(card.validUntil) < Date.now();
  return {
    runId,
    card,
    stale,
    staleLabel: stale ? `Prior record, re-verify -- valid until ${card.validUntil}` : undefined,
  };
}
