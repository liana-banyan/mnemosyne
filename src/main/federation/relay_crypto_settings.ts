/**
 * relay_crypto_settings.ts -- D-BP223-X043-007-RELAY-X25519. Transition switches for the Thorax
 * relay wire format (see relay_x25519.ts for v2, mic_dispatcher.ts's encryptForRelayV1Legacy for v1).
 *
 * EVERY SWITCH DEFAULTS TO OFF. A missing file, a missing key, a non-boolean value or an unreadable
 * file all mean OFF. Same rule and same folder as startup/network_feature_settings.ts, kept in its
 * own file so this fix does not edit that file (it carries other uncommitted 0.9.40 work).
 *
 *   relayV1AcceptInbound   Receive side. Accept an old v1 frame (key derived from the public peer
 *                          id, readable by anyone with presence access). Only for a transition
 *                          window while some machines still run an old build.
 *   relayV1SendFallback    Send side. If the recipient has published no verifiable v2 key, send v1
 *                          instead of refusing. Same weakness as above.
 *   relayAllowPresenceTofu Send side. Trust a recipient's X25519 key when the only Ed25519 key that
 *                          signs it comes from the SAME peer_presence row. peer_presence is
 *                          anon-writable (policy peer_presence_anon_update_own has qual `true`), so
 *                          this lets anyone who edits that row receive the message. With it OFF, a
 *                          recipient must be enrolled (peer_enrollment_registry.json) or already
 *                          known from a signature-verified LAN beacon (saved peers).
 *
 * File: %APPDATA%\MnemosyneC\config\relay_crypto_settings.json
 *   { "relayV1AcceptInbound": false, "relayV1SendFallback": false, "relayAllowPresenceTofu": false }
 * Read on every call (cheap, small file), so a change takes effect without a restart.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type RelayCryptoSettingKey = 'relayV1AcceptInbound' | 'relayV1SendFallback' | 'relayAllowPresenceTofu';

export const RELAY_CRYPTO_SETTING_KEYS: readonly RelayCryptoSettingKey[] = [
  'relayV1AcceptInbound',
  'relayV1SendFallback',
  'relayAllowPresenceTofu',
];

export function relayCryptoSettingsPath(): string {
  return join(process.env.APPDATA ?? '', 'MnemosyneC', 'config', 'relay_crypto_settings.json');
}

/** True only when the user explicitly wrote `true` for this key. Never throws. */
export function isRelayCryptoSettingOn(key: RelayCryptoSettingKey, settingsPath: string = relayCryptoSettingsPath()): boolean {
  try {
    if (!existsSync(settingsPath)) return false;
    const j = JSON.parse(readFileSync(settingsPath, 'utf8')) as Record<string, unknown>;
    return j[key] === true;
  } catch {
    return false;
  }
}
