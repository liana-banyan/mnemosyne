// outbox.ts -- D-BP223-BM04-X033S3-009 STEP 1
//
// CONFIRMED NO EXISTING FILE OWNS THIS (D-BP165-M0-026 Law 4 check, this dispatch): the "outbox"
// name matches only unrelated LianaBanyanPlatform\HARDWIRE ledger/receipt tooling outside
// mnemosyne\src entirely -- nothing in this app's own tree implements a Prove-It-shaped outbox.
//
// ~/.mnemosynec/proveit_outbox.jsonl -- cards and votes waiting for a real substrate_questions
// insert once proveit.substrateLive flips true (spec Section 6.c). Written to by
// substrate_publish.ts (addToSubstrate when the flag is off) and by the vote handler (ghost-
// credit-deferred votes, same "no Supabase writes while the flag is off" rule). One JSON object
// per line, append-only; never applied to Supabase by this dispatch (Rule: "no Supabase writes").

import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'fs';
import { dirname } from 'path';
import { outboxPath } from './userdata_paths';

export type OutboxEntryKind = 'add_to_substrate' | 'vote';

export interface OutboxEntry {
  kind: OutboxEntryKind;
  address: string; // the substrate_questions.address (add_to_substrate) or voted-on card (vote)
  queuedAt: string; // ISO-8601 UTC
  payload: Record<string, unknown>;
}

function ensureFile(path: string): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function appendToOutbox(entry: OutboxEntry, path: string = outboxPath()): void {
  ensureFile(path);
  appendFileSync(path, JSON.stringify(entry) + '\n', 'utf-8');
}

export function readOutbox(path: string = outboxPath()): OutboxEntry[] {
  if (!existsSync(path)) return [];
  try {
    return readFileSync(path, 'utf-8')
      .split('\n')
      .filter((l) => l.trim())
      .map((line) => {
        try {
          return JSON.parse(line) as OutboxEntry;
        } catch {
          return null;
        }
      })
      .filter((e): e is OutboxEntry => e !== null);
  } catch {
    return [];
  }
}
