// user_anthropic_key.ts -- BP132 Yoke #21 C7: user-facing Anthropic API key storage.
//
// Prior state: ai_dispatch_ipc.ts's dispatchViaBrain() only ever read
// process.env.ANTHROPIC_API_KEY -- fine on the Founder's own dev machine (loaded via
// env_loader.ts from the LockBox vault) but silently absent on any real install, so the
// flagship brain path always failed with "ANTHROPIC_API_KEY not set". This is a SEPARATE
// concern from ApiKeysSettings.tsx, which belongs to the unrelated Hearth Conjunction
// subsystem -- do not conflate the two.
//
// Storage: same pattern as lb_auth.ts (BLOOD RULE R16 discipline) -- Electron safeStorage
// (OS-level DPAPI / Keychain / libsecret encryption) at {userData}/anthropic_user_key.enc.
// The raw key is NEVER logged, NEVER returned to the renderer, and NEVER written in
// plaintext. If safeStorage is unavailable (headless/CI), the key is kept in-memory only
// for the current process lifetime and NOT persisted to disk.

import { safeStorage } from 'electron';
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';

function getKeyFilePath(): string {
  return join(app.getPath('userData'), 'anthropic_user_key.enc');
}

let _inMemoryFallbackKey: string | null = null;

/** Persist the user's own Anthropic API key, encrypted at rest. Never logs the value. */
export function setUserAnthropicKey(rawKey: string): { ok: boolean; error?: string } {
  const trimmed = rawKey.trim();
  if (!trimmed) return { ok: false, error: 'Key is empty' };
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(trimmed);
      const filePath = getKeyFilePath();
      mkdirSync(join(filePath, '..'), { recursive: true });
      writeFileSync(filePath, encrypted);
      _inMemoryFallbackKey = null;
      console.log('[user_anthropic_key] key saved (encrypted at rest)');
      return { ok: true };
    }
    // Fallback: no OS-level encryption available -- keep in-memory only, never plaintext on disk.
    _inMemoryFallbackKey = trimmed;
    console.warn('[user_anthropic_key] safeStorage unavailable -- key held in-memory only, not persisted');
    return { ok: true };
  } catch (err: unknown) {
    console.error('[user_anthropic_key] save failed:', err instanceof Error ? err.message : String(err));
    return { ok: false, error: 'Failed to save key securely' };
  }
}

/** Returns the decrypted key, or null if none is set. Only ever called main-side. */
export function getUserAnthropicKey(): string | null {
  if (_inMemoryFallbackKey) return _inMemoryFallbackKey;
  try {
    const filePath = getKeyFilePath();
    if (!existsSync(filePath)) return null;
    if (!safeStorage.isEncryptionAvailable()) return null;
    const encrypted = readFileSync(filePath);
    return safeStorage.decryptString(encrypted);
  } catch (err: unknown) {
    console.error('[user_anthropic_key] read failed:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

/** UI-safe status check -- never exposes the raw key to the renderer. */
export function hasUserAnthropicKey(): boolean {
  return _inMemoryFallbackKey !== null || existsSync(getKeyFilePath());
}

export function clearUserAnthropicKey(): void {
  _inMemoryFallbackKey = null;
  try {
    const filePath = getKeyFilePath();
    if (existsSync(filePath)) unlinkSync(filePath);
  } catch (err: unknown) {
    console.error('[user_anthropic_key] clear failed:', err instanceof Error ? err.message : String(err));
  }
}

/**
 * Resolution order for the flagship dispatch path:
 *   1. User-supplied key (this module) -- what a real stranger-install user sets.
 *   2. process.env.ANTHROPIC_API_KEY -- Founder's dev-machine LockBox vault convenience.
 */
export function resolveAnthropicApiKey(): string | null {
  return getUserAnthropicKey() ?? process.env.ANTHROPIC_API_KEY ?? null;
}
