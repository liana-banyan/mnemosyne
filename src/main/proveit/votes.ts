// votes.ts -- D-BP223-BM04-X033S3-009 STEP 1d
//
// Votes on region D cards (spec Section 9): one vote per card per person; the voter picks ghost
// or real, default ghost. Seed cards accept votes and credit nobody (spec Section 6).
//
// 028/007 DEPENDENCY (DB_GROUND_TRUTH.md, this dispatch's read-only introspection, same finding
// 007's own migration draft already recorded): `user_marks` has no `ghost_marks` column yet and
// `marks_transactions` has no `is_ghost` column yet, so a REAL Mark credit for a member's vote
// would need the app's existing (already-live) award_marks()-style RPC, and a GHOST credit cannot
// be written at all until 028 lands. This module NEVER calls Supabase (rule: "no Supabase
// writes") -- every vote here is recorded to the local card store's voteCount and, for a
// non-seed, non-local-asker card, to the outbox as a deferred credit, mirroring 007's own
// cast_substrate_question_vote()'s "ghost credit deferred pending 028" branch.

import { findCardByAddress, updateCard } from './card_store';
import { appendToOutbox } from './outbox';
import type { ProveItCard } from '../../shared/proveit_contract';

export interface CastVoteResult {
  ok: boolean;
  voteCount?: number;
  credited: boolean;
  creditNote: string;
  error?: string;
}

const votedBy = new Map<string, Set<string>>(); // address -> set of voter keys, in-process guard

function voterKey(voter: { memberId?: string; guestWalletId?: string }): string | null {
  if (voter.memberId) return `member:${voter.memberId}`;
  if (voter.guestWalletId) return `guest:${voter.guestWalletId}`;
  return null;
}

export function castVote(address: string, isGhost: boolean, voter: { memberId?: string; guestWalletId?: string }): CastVoteResult {
  const card = findCardByAddress(address);
  if (!card) return { ok: false, credited: false, creditNote: '', error: `no card at address ${address}` };

  const key = voterKey(voter);
  if (!key) return { ok: false, credited: false, creditNote: '', error: 'a vote needs a member id or a guest wallet id' };

  const already = votedBy.get(address) ?? new Set<string>();
  if (already.has(key)) {
    return { ok: false, credited: false, creditNote: '', error: 'one vote per card per person -- already voted' };
  }
  already.add(key);
  votedBy.set(address, already);

  const updated = updateCard(address, { voteCount: card.voteCount + 1 }) as ProveItCard;

  if (card.isSeed || !card.askedBy.id) {
    return { ok: true, voteCount: updated.voteCount, credited: false, creditNote: 'no poster to credit (seed card or guest-posted question)' };
  }

  // Real credit needs the app's existing Marks RPC (award_marks-equivalent) -- not called here
  // (this module makes no Supabase calls, per the brief's rule); ghost credit needs 028's not-
  // yet-applied ghost_marks column. Both are deferred to the outbox, same shape as 007's own
  // cast_substrate_question_vote() "ghost credit deferred pending 028" branch.
  appendToOutbox({ kind: 'vote', address, queuedAt: new Date().toISOString(), payload: { isGhost, voter, posterId: card.askedBy.id } });
  return {
    ok: true,
    voteCount: updated.voteCount,
    credited: false,
    creditNote: isGhost
      ? 'ghost credit deferred pending 028 (user_marks.ghost_marks / marks_transactions.is_ghost do not exist yet)'
      : 'real Mark credit deferred to the outbox (no Supabase writes in this dispatch)',
  };
}

export function _clearVotesForTests(): void {
  votedBy.clear();
}
