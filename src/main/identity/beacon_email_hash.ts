/**
 * beacon_email_hash.ts -- D-BP223-BM0-X030-073-STALE-STATE-AND-PRIVACY-FIXES, P1.
 *
 * XO X030 pick on Founder k/0a8d1c96 ("You pick, and tell me what you picked"): the relay beacon's email hash becomes a
 * PER-INSTALL SALTED hash. The salt is made once per install, kept only in a local file, and NEVER sent.
 *
 * THE DEFECT THIS CLOSES (X030-025 threat model, peer_server.ts:559-596): presence sent sha256(email).slice(0,32), UNSALTED,
 * to relay.lianabanyan.com every 60 s. An unsalted email hash is reversible by anyone who can guess candidate emails (hash
 * the guess, compare). With a per-install secret salt, the relay (or anyone reading peer_presence) cannot test a guess, and
 * two installs of the same person no longer publish a linkable value.
 *
 * WHAT IT COSTS, SAID PLAINLY: the relay can no longer group machines by email. Supabase `wan-lookup-by-email` (which
 * queries peer_presence.email_hash) will not find this machine by a plain email hash any more. Same-owner mesh identity does
 * NOT depend on this field: it comes from the TOTP-gated enrollment record's owner_id (X030-067), and the unsalted owner id
 * never leaves the machine in the beacon.
 *
 * FORM: HMAC-SHA256(key = salt, message = trimmed lowercased email), first 32 hex -- the same width as the old field, so the
 * relay schema is unchanged.
 */

import { createHmac, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** %APPDATA%\MnemosyneC\config\beacon_salt.json, beside the other mesh config files. */
export function beaconSaltPath(): string {
  return join(process.env.APPDATA ?? '', 'MnemosyneC', 'config', 'beacon_salt.json');
}

const SALT_RE = /^[0-9a-f]{64}$/;

/**
 * Reads this install's salt, creating it (32 random bytes) on first use. An existing file that does not hold a valid salt is
 * NOT overwritten (unreadable is not absent); it throws, and the caller publishes no email hash at all.
 */
export function getOrCreateBeaconSalt(saltPath: string = beaconSaltPath()): string {
  if (existsSync(saltPath)) {
    const parsed = JSON.parse(readFileSync(saltPath, 'utf8')) as { salt?: unknown };
    if (typeof parsed.salt === 'string' && SALT_RE.test(parsed.salt)) return parsed.salt;
    throw new Error(`[BeaconSalt] ${saltPath} exists but holds no valid salt; refusing to overwrite it`);
  }
  const salt = randomBytes(32).toString('hex');
  mkdirSync(dirname(saltPath), { recursive: true });
  writeFileSync(saltPath, JSON.stringify({
    salt,
    created_utc: new Date().toISOString(),
    note: 'D-BP223-BM0-X030-073 P1: per-install beacon salt. Local only, never sent. Deleting it makes this install publish a new, unlinkable email hash.',
  }, null, 2), 'utf8');
  return salt;
}

/** The beacon email field: HMAC-SHA256(salt, normalized email), 32 hex. null when there is no email. */
export function saltedBeaconEmailHash(email: string | null | undefined, salt: string): string | null {
  if (!email || !email.trim()) return null;
  if (!SALT_RE.test(salt)) throw new Error('[BeaconSalt] salt must be 64 hex characters');
  return createHmac('sha256', Buffer.from(salt, 'hex')).update(email.trim().toLowerCase(), 'utf8').digest('hex').slice(0, 32);
}

/** Convenience for the beacon: never throws; a salt problem publishes no email hash (null), never the unsalted one. */
export function beaconEmailHashOrNull(email: string | null | undefined, saltPath: string = beaconSaltPath()): string | null {
  try {
    if (!email) return null;
    return saltedBeaconEmailHash(email, getOrCreateBeaconSalt(saltPath));
  } catch (err) {
    console.warn('[BeaconSalt] publishing no email hash:', err instanceof Error ? err.message : String(err));
    return null;
  }
}
