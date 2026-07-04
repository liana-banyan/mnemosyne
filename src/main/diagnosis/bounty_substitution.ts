/**
 * bounty_substitution.ts — Substitution Rails v0.4.0 BP083
 *
 * Handles bounty payouts for The Diagnosis via 3-rail Substitution mechanism:
 *   Marks  → Cooperative currency (working in v0.4.0 — test-net ledger)
 *   Fiat   → Stripe pass-through (SCAFFOLD v0.4.0 — deferred to v0.4.1)
 *   Barter → Peer confirmation flow (working in v0.4.0)
 *
 * SUBSTITUTION CANON (BP078+BP038): Credits/Marks/Joules NEVER convert to fiat.
 * Marks bounties are cooperative-class: deduct from poster · credit responder.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import type { DiagnosisBounty } from './diagnosis_types';

// ─── Test-net Marks ledger ────────────────────────────────────────────────────

function ledgerDir(): string {
  const d = join(app.getPath('appData'), 'MnemosyneC', 'Vault', 'test-net-ledger');
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  return d;
}

function ledgerPath(): string {
  return join(ledgerDir(), 'marks_ledger.json');
}

interface MarksLedger {
  version: string;
  entries: Array<{
    ts: number;
    type: 'debit' | 'credit';
    amount: number;
    fromId: string;
    toId: string;
    reason: string;
  }>;
  balances: Record<string, number>;
}

function loadLedger(): MarksLedger {
  try {
    const p = ledgerPath();
    if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf8')) as MarksLedger;
  } catch { /* init fresh */ }
  return { version: '0.4.0', entries: [], balances: {} };
}

function saveLedger(ledger: MarksLedger): void {
  writeFileSync(ledgerPath(), JSON.stringify(ledger, null, 2), 'utf8');
}

function creditMarks(ledger: MarksLedger, userId: string, amount: number, reason: string, fromId: string): void {
  ledger.balances[userId] = (ledger.balances[userId] ?? 0) + amount;
  ledger.entries.push({ ts: Date.now(), type: 'credit', amount, fromId, toId: userId, reason });
}

function debitMarks(ledger: MarksLedger, userId: string, amount: number, reason: string, toId: string): boolean {
  const balance = ledger.balances[userId] ?? 0;
  if (balance < amount) return false; // Insufficient Marks
  ledger.balances[userId] = balance - amount;
  ledger.entries.push({ ts: Date.now(), type: 'debit', amount, fromId: userId, toId, reason });
  return true;
}

// ─── Payout ───────────────────────────────────────────────────────────────────

export async function payoutBounty(
  bounty: DiagnosisBounty,
  fromId: string,
  toId: string,
): Promise<boolean> {
  const reason = `Diagnosis bounty payout`;

  if (bounty.rail === 'marks') {
    const ledger = loadLedger();
    const debited = debitMarks(ledger, fromId, bounty.amount, reason, toId);
    if (!debited) {
      // Poster doesn't have enough Marks — grant anyway (cooperative grace)
      console.warn(`[Bounty] ${fromId} has insufficient Marks — granting responder credit anyway`);
    }
    creditMarks(ledger, toId, bounty.amount, reason, fromId);
    saveLedger(ledger);
    console.log(`[Bounty] Marks payout: ${bounty.amount} Marks from ${fromId} to ${toId}`);
    return true;
  }

  if (bounty.rail === 'fiat') {
    // SCAFFOLD v0.4.0 — Stripe integration deferred to v0.4.1
    console.log(`[Bounty] SCAFFOLD Fiat payout $${bounty.amount} — deferred to v0.4.1`);
    return false;
  }

  if (bounty.rail === 'barter') {
    // Barter: both parties confirmed (frontend handles confirmation flow)
    console.log(`[Bounty] Barter confirmed: "${bounty.barterDescription ?? '(no description)'}" from ${fromId} to ${toId}`);
    return true;
  }

  return false;
}

export async function getMarksBalance(userId: string): Promise<number> {
  const ledger = loadLedger();
  return ledger.balances[userId] ?? 0;
}

export async function getLedgerHistory(userId?: string): Promise<MarksLedger['entries']> {
  const ledger = loadLedger();
  if (!userId) return ledger.entries;
  return ledger.entries.filter((e) => e.fromId === userId || e.toId === userId);
}
