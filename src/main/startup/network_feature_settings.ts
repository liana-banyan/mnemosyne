/**
 * network_feature_settings.ts -- D-BP223-BM0-X031-024-INSTALLER-FINAL-PREP.
 *
 * FOUNDER RULING (X031 pane, 2026-09-17T11:20Z, verbatim): "Make the relay poller and startup report OFF until the user
 * turns them on." X031-015 P3 found three features that send data off the machine with no user action; this file holds
 * the one user switch for each. EVERY SWITCH DEFAULTS TO OFF. Only an explicit `true` written by the user turns one on.
 *
 *   answerOtherMembersQuestions  "Answer other members' questions with my local AI"
 *       governs relay_answer/index.ts startRelayAnswerPoller() (the forked worker.ts) AND index.ts's main-process
 *       relay_routes poll (startRelayRoutePoll + its watchdog + the boot zombie flush). Both fetch other peers'
 *       prompts from Supabase relay_routes and post answers back.
 *   sendStatusReport             "Send a status report to Liana Banyan"
 *       governs relay_answer/startup_diagnostic.ts submitStartupDiagnostic() (15 s after boot, then every 10 min;
 *       carries peer id, hostname, LAN IPv4 addresses, Ollama model names, env paths checked).
 *   syncWithLianaBanyan          "Sync my substrate with lianabanyan.com"
 *       governs federation_client.ts's lianabanyan.com traffic: the /api/health check, the push of queued local
 *       substrate records to /api/substrate/write, and the pull from /api/substrate/sync.
 *
 * D-BP223-BM0-X031-027-NETWORK-DEFAULTS-OFF-2 (Founder, X031 pane 2026-09-17, ticked: "Turn those OFF by default first,
 * then post the signing item"). Five more switches, same rule (missing/bad = OFF, next app start):
 *   lanShareListener             "Share my substrate with other MnemosyneC computers on my network"
 *       governs federation_client.ts's TCP listener on 0.0.0.0:11481 (answers sync_request with up to 50 local
 *       substrate records, sid_fetch_request, and pair_/assist_ messages; no authentication).
 *   lanPeerProbe                 "Look for other MnemosyneC computers on my network"
 *       governs federation_client.ts's LAN scan (up to 50 private addresses on :11481, every 30 s).
 *   fleetBroadcastListener       "Accept fleet commands from Liana Banyan"
 *       governs index.ts startMicBroadcastListener() (fleet_broadcast poll every 10 s; auto_update, config_set,
 *       fleet_warmup, health_snapshot, benchmark_run, noop_test).
 *   bishopDispatchListener       "Accept dispatches from my own mesh"
 *       governs federation/bishop_dispatch_relay_listener.ts (relay_routes poll + peer_presence heartbeat PATCH).
 *   diagnosticCheckin            "Allow remote diagnostic mode"
 *       governs diagnostic_mode/index.ts startDiagnosticPoller() (the 60 s timer; it polls Supabase only while a
 *       local permission window is active).
 *
 * The file holds only the user's choices:
 *   %APPDATA%\MnemosyneC\config\network_feature_settings.json
 *   { "answerOtherMembersQuestions": true|false, "sendStatusReport": true|false, "syncWithLianaBanyan": true|false,
 *     "lanShareListener": true|false, "lanPeerProbe": true|false, "fleetBroadcastListener": true|false,
 *     "bishopDispatchListener": true|false, "diagnosticCheckin": true|false }
 * A missing file, a missing key, a non-boolean value, or an unreadable file all mean OFF. The file is never rewritten
 * silently. Changes take effect at the next app start.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type NetworkFeatureKey =
  | 'answerOtherMembersQuestions'
  | 'sendStatusReport'
  | 'syncWithLianaBanyan'
  | 'lanShareListener'
  | 'lanPeerProbe'
  | 'fleetBroadcastListener'
  | 'bishopDispatchListener'
  | 'diagnosticCheckin';

export const NETWORK_FEATURE_KEYS: readonly NetworkFeatureKey[] = [
  'answerOtherMembersQuestions',
  'sendStatusReport',
  'syncWithLianaBanyan',
  'lanShareListener',
  'lanPeerProbe',
  'fleetBroadcastListener',
  'bishopDispatchListener',
  'diagnosticCheckin',
];

export const NETWORK_FEATURE_LABELS: Readonly<Record<NetworkFeatureKey, string>> = {
  answerOtherMembersQuestions: "Answer other members' questions with my local AI",
  sendStatusReport: 'Send a status report to Liana Banyan',
  syncWithLianaBanyan: 'Sync my substrate with lianabanyan.com',
  lanShareListener: 'Share my substrate with other MnemosyneC computers on my network',
  lanPeerProbe: 'Look for other MnemosyneC computers on my network',
  fleetBroadcastListener: 'Accept fleet commands from Liana Banyan',
  bishopDispatchListener: 'Accept dispatches from my own mesh',
  diagnosticCheckin: 'Allow remote diagnostic mode',
};

export function networkFeatureSettingsPath(): string {
  return join(process.env.APPDATA ?? '', 'MnemosyneC', 'config', 'network_feature_settings.json');
}

export interface NetworkFeatureState {
  key: NetworkFeatureKey;
  enabled: boolean;
  source: 'user' | 'default_off';
  label: string;
}

function readChoices(settingsPath: string): Partial<Record<NetworkFeatureKey, boolean>> {
  try {
    if (!existsSync(settingsPath)) return {};
    const j = JSON.parse(readFileSync(settingsPath, 'utf8')) as Record<string, unknown>;
    const out: Partial<Record<NetworkFeatureKey, boolean>> = {};
    for (const k of NETWORK_FEATURE_KEYS) {
      if (typeof j[k] === 'boolean') out[k] = j[k] as boolean;
    }
    return out;
  } catch {
    return {};
  }
}

export function resolveNetworkFeatures(settingsPath: string = networkFeatureSettingsPath()): NetworkFeatureState[] {
  const choices = readChoices(settingsPath);
  return NETWORK_FEATURE_KEYS.map((key) => {
    const c = choices[key];
    return typeof c === 'boolean'
      ? { key, enabled: c, source: 'user' as const, label: NETWORK_FEATURE_LABELS[key] }
      : { key, enabled: false, source: 'default_off' as const, label: NETWORK_FEATURE_LABELS[key] };
  });
}

/** True only when the user has explicitly turned this feature on. Never throws. */
export function isNetworkFeatureOn(key: NetworkFeatureKey, settingsPath: string = networkFeatureSettingsPath()): boolean {
  return readChoices(settingsPath)[key] === true;
}

/** Records one choice, keeping the others. Rule 66: an existing file is copied to a .superseded.<UTC>.json sibling first. */
export function setNetworkFeature(key: NetworkFeatureKey, enabled: boolean, settingsPath: string = networkFeatureSettingsPath()): NetworkFeatureState[] {
  if (!NETWORK_FEATURE_KEYS.includes(key)) throw new Error(`unknown network feature: ${String(key)}`);
  mkdirSync(dirname(settingsPath), { recursive: true });
  const current = readChoices(settingsPath);
  if (existsSync(settingsPath)) {
    const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    copyFileSync(settingsPath, settingsPath.replace(/\.json$/, `.superseded.${ts}.json`));
  }
  writeFileSync(settingsPath, JSON.stringify({
    ...current,
    [key]: enabled,
    set_utc: new Date().toISOString(),
    note: 'D-BP223-BM0-X031-024/X031-027: network features are OFF until the user turns them on. Takes effect at next app start.',
  }, null, 2), 'utf8');
  return resolveNetworkFeatures(settingsPath);
}
