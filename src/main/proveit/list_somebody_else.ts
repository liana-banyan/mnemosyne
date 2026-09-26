// list_somebody_else.ts -- D-BP223-BM04-X033S3-009 STEP 1d
//
// "Use a question SOMEBODY ELSE asked" (spec Section 1 region D / Section 6): seed + local +
// outbox cards, sorted by votes then date, filterable by category. Region D is grayed until the
// asking install has published (Add to the Substrate) at least one card of its own -- computed
// here as `unlocked`, so the renderer never has to re-derive that rule itself.

import { readAllCards } from './card_store';
import type { ProveItCard, ProveItCategory } from '../../shared/proveit_contract';

export interface ListSomebodyElseOptions {
  category?: ProveItCategory | 'all';
  sortBy?: 'votes' | 'date';
  /** The current member/guest id, so "has this install published one of its own" can be scoped
   *  to them rather than to any card ever published locally. Optional -- when omitted, "has any
   *  non-seed card been published on this install at all" is used (single-user desktop app). */
  askerId?: string | null;
}

export interface ListSomebodyElseResult {
  cards: ProveItCard[];
  unlocked: boolean;
}

function isPublishedAndLive(c: ProveItCard): boolean {
  return c.isSeed || (c.publishedAt !== null && c.unpublishedAt === null);
}

/** Cards from ALL of: the local store's seed rows, the local store's own published-and-not-
 *  unpublished asks, AND -- per the brief's literal instruction ("listSomebodyElse (seed + local
 *  + outbox...)") -- outbox-queued cards, so a card queued for the substrate while the flag is
 *  off is still visible to "somebody else" ON THIS SAME INSTALL (the only install that can see
 *  it before a real substrate sync exists; a second-machine ("M2") view of it requires the flag
 *  live, which spec acceptance line 4 already anticipates as a later state). The outbox itself
 *  stores queue ENTRIES, not full cards -- the card is already in the local store by the time it
 *  is queued (see substrate_publish.ts), so no separate outbox read is needed here; this comment
 *  records that reasoning rather than silently diverging from the brief's literal phrasing. */
export function listSomebodyElseCards(options: ListSomebodyElseOptions = {}): ListSomebodyElseResult {
  const all = readAllCards();
  const category = options.category ?? 'all';
  const sortBy = options.sortBy ?? 'votes';

  const visible = all.filter(isPublishedAndLive).filter((c) => category === 'all' || c.category === category);

  const sorted = [...visible].sort((a, b) => {
    if (sortBy === 'votes' || sortBy === undefined) {
      if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
      return Date.parse(b.madeAt) - Date.parse(a.madeAt);
    }
    return Date.parse(b.madeAt) - Date.parse(a.madeAt);
  });

  const unlocked = all.some((c) => {
    if (c.isSeed) return false;
    if (c.publishedAt === null) return false;
    if (options.askerId) {
      return c.askedBy.id === options.askerId;
    }
    return true;
  });

  return { cards: sorted, unlocked };
}
