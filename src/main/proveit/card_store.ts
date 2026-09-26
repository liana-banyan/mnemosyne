// card_store.ts -- D-BP223-BM04-X033S3-009 STEP 1
//
// CONFIRMED NO EXISTING FILE OWNS THIS (D-BP165-M0-026 Law 4 check, this dispatch): card_freshness.ts
// is a pure staleness/reuse-decision function (used below via card_writer.ts), not a store;
// CueDeckCardRenderer.tsx / PeerCueCard.tsx / ShareCard.tsx render unrelated Cue Deck tarot-card
// UI, not a Prove It question/answer card store. None of them read or write proveit_cards.jsonl.
//
// The local Prove It card store: {userData}/substrate/proveit/proveit_cards.jsonl. One JSON
// object per line, append-only (a supersede writes a NEW row and flips the old row's
// supersededBy, per provenance law -- "it never erases it", spec Section 5). This is the "local
// store" the brief's card writer (1a) targets; the outbox (outbox.ts) is a SEPARATE file for
// cards/votes not yet in the substrate, per spec Section 6.c.
//
// ADDRESSING REUSED, NOT INVENTED: soccerballAddress() from
// src/main/federation/hollerith_library_share.ts (sha256 of a sorted JSON array of "pearl"
// strings, sliced to 32 hex chars) is the exact same addressing function the Hollerith card/
// eblet-provenance system already uses (see eblet_provenance_tags.ts's cardRef()). A Prove It
// card's "pearl" is its own content -- question + answer + category + answeredBy + madeAt -- so
// two identical (re-)asks of the same question by the same brain on the same day address to the
// same hex, and a supersede (new answer text or new date) naturally addresses to a new hex.

import { existsSync, mkdirSync, appendFileSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { soccerballAddress } from '../federation/hollerith_library_share';
import type { ProveItCard } from '../../shared/proveit_contract';
import { cardsStorePath } from './userdata_paths';

export function computeCardAddress(input: { question: string; answer: string; category: string; answeredBy: string; madeAt: string }): string {
  const pearl = `proveit_card:${input.category}:${input.answeredBy}:${input.madeAt}:${input.question}:${input.answer}`;
  return soccerballAddress([pearl]);
}

function ensureFile(path: string): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(path)) writeFileSync(path, '', 'utf-8');
}

export function readAllCards(storePath: string = cardsStorePath()): ProveItCard[] {
  if (!existsSync(storePath)) return [];
  try {
    return readFileSync(storePath, 'utf-8')
      .split('\n')
      .filter((l) => l.trim())
      .map((line) => {
        try {
          return JSON.parse(line) as ProveItCard;
        } catch {
          return null;
        }
      })
      .filter((c): c is ProveItCard => c !== null);
  } catch {
    return [];
  }
}

export function findCardByAddress(address: string, storePath: string = cardsStorePath()): ProveItCard | null {
  return readAllCards(storePath).find((c) => c.address === address) ?? null;
}

export function findCardBySeedSource(seedSource: string, storePath: string = cardsStorePath()): ProveItCard | null {
  return readAllCards(storePath).find((c) => c.seedSource === seedSource) ?? null;
}

/** Appends one card row. Never rewrites an existing row in place -- see updateCard() below for
 *  the one exception (flipping supersededBy on the OLD card, and marking published/unpublished/
 *  vote-count changes on a card already in the store), which reads the whole file, replaces the
 *  one matching row, and writes it back -- acceptable at this feature's local, single-machine,
 *  low-volume (hundreds to low thousands of rows) scale; the append-only convention is preserved
 *  for the actual provenance-bearing fields (question/answer/address/askedBy/answeredBy/madeAt
 *  never change once appended). */
export function appendCard(card: ProveItCard, storePath: string = cardsStorePath()): void {
  ensureFile(storePath);
  appendFileSync(storePath, JSON.stringify(card) + '\n', 'utf-8');
}

/** In-place field update for mutable card state (publishedAt/unpublishedAt/voteCount/
 *  supersededBy/queuedForSubstrate). Rewrites the file once with the matching row replaced.
 *  Returns the updated card, or null if no row matched. */
export function updateCard(address: string, patch: Partial<ProveItCard>, storePath: string = cardsStorePath()): ProveItCard | null {
  const all = readAllCards(storePath);
  const idx = all.findIndex((c) => c.address === address);
  if (idx === -1) return null;
  const updated: ProveItCard = { ...all[idx], ...patch };
  all[idx] = updated;
  ensureFile(storePath);
  writeFileSync(storePath, all.map((c) => JSON.stringify(c)).join('\n') + (all.length ? '\n' : ''), 'utf-8');
  return updated;
}
