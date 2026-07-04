/**
 * ip_ledger.ts -- Scribe identity ledger stub
 *
 * BP089 · Mountain 2 · §16 BLOOD
 * Each persistent SEG scribe registers its identity row here before entering
 * its scan loop. Full wire-up persists to Supabase ip_ledger table.
 * Until then, registrations are held in memory for the process lifetime.
 *
 * Statute §16: scribe identity rows MUST be registered before any dispatch.
 */

import type { ScribeIdentityRow } from '../scribes/types';

const _registry: Map<string, ScribeIdentityRow & { registeredAt: number }> = new Map();

export class IpLedger {
  /**
   * Register a scribe in the identity ledger.
   * Idempotent -- re-registration updates the existing row.
   */
  async registerScribe(row: ScribeIdentityRow): Promise<void> {
    _registry.set(row.key, { ...row, registeredAt: Date.now() });
  }

  /** Check if a scribe key is registered. */
  async isRegistered(key: string): Promise<boolean> {
    return _registry.has(key);
  }

  /** Retrieve a registered scribe row. Returns undefined if not found. */
  async getRow(key: string): Promise<(ScribeIdentityRow & { registeredAt: number }) | undefined> {
    return _registry.get(key);
  }

  /** Return all registered scribe rows (for heartbeat diagnostics). */
  async listAll(): Promise<Array<ScribeIdentityRow & { registeredAt: number }>> {
    return Array.from(_registry.values());
  }
}
