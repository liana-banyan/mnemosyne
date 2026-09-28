/**
 * share_receive_consent.ts -- D-BP223-PQ005-012-X041 (Founder 2026-09-26 ~03:35Z: "Make WORK the one-click share-to-a-peer").
 *
 * THE FOURTH CONSENT, and it is the smallest of the four: may a card another node OFFERS me land in my silo without me
 * pressing anything? The three that already exist are named here so nobody re-derives the verdict:
 *   1. AutoUpdateConfig.autoUpdates (auto_update_scheduler.ts): permits a VERSION BUMP.
 *   2. mesh_auto_spawn_consent.ts: permits TOOL EXECUTION inside MnemosyneC, driven by another machine.
 *   3. mesh_remote_admin_consent.ts: permits REMOTE ADMINISTRATION of the whole computer.
 *   4. THIS FILE: permits an OFFERED CARD to land in this node's own Hollerith silo (a plain *.eblet.md, method only,
 *      leak-scanned, source-checked, hash-checked by hollerith_library_share.ts before this rule is even asked).
 *
 * GOVERNING RULING, cited: FD-BP156-04 (Founder, verbatim): "the LAN is a carrier and NEVER a trust boundary. Proximity
 * must never imply consent." So the DEFAULT is the person-level rule the library pull already uses (X030-067 pick B):
 *   - same owner (an enrolled key whose TOTP-gated enrollment record carries this node's owner id): ACCEPT.
 *   - any other enrolled or beacon-known peer: HOLD in the inbox until a person accepts it (the one-click on the receiving
 *     side is that accept). Nothing lands by itself.
 *   - a self-declared key (a stranger): REFUSE, nothing kept.
 * A person may widen this: `acceptFrom: 'enrolled'` (every enrolled peer lands without a press) or name peers in
 * `allowPeers`. Nothing here can widen it to strangers; a self-declared key is always refused.
 *
 * File: %APPDATA%\MnemosyneC\config\share_receive_settings.json. Fails CLOSED: missing, corrupt or unreadable = default.
 * Pure decision + settings I/O here; the IPC registration at the bottom is the only Electron-bound part (same
 * "<domain>:get-settings" / "<domain>:set-..." naming as the three consents above).
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { defaultOfferConsent, type OfferConsentDecision, type OfferConsentInput } from './hollerith_library_share';

export type ShareAcceptFrom = 'same_owner' | 'enrolled';

export interface ShareReceiveSettings {
  /** Default 'same_owner'. 'enrolled' lets every enrolled peer's offer land without a press. Never wider than that. */
  acceptFrom: ShareAcceptFrom;
  /** Peer ids whose offers land without a press even when they are not this owner (they must still be enrolled or known). */
  allowPeers: string[];
}

export const DEFAULT_SHARE_RECEIVE_SETTINGS: ShareReceiveSettings = { acceptFrom: 'same_owner', allowPeers: [] };

export function shareReceiveSettingsPath(): string {
  return join(process.env.APPDATA ?? '', 'MnemosyneC', 'config', 'share_receive_settings.json');
}

function normalize(parsed: Partial<ShareReceiveSettings> | null | undefined): ShareReceiveSettings {
  const acceptFrom: ShareAcceptFrom = parsed?.acceptFrom === 'enrolled' ? 'enrolled' : 'same_owner';
  const allowPeers = Array.isArray(parsed?.allowPeers) ? parsed!.allowPeers.filter((p): p is string => typeof p === 'string' && p.trim().length > 0).map((p) => p.trim()) : [];
  return { acceptFrom, allowPeers };
}

/** Reads the persisted choice; any read or parse error is the closed default, never an open one. */
export function readShareReceiveSettings(settingsPath: string = shareReceiveSettingsPath()): ShareReceiveSettings {
  try {
    if (!existsSync(settingsPath)) return { ...DEFAULT_SHARE_RECEIVE_SETTINGS };
    return normalize(JSON.parse(readFileSync(settingsPath, 'utf8')) as Partial<ShareReceiveSettings>);
  } catch {
    return { ...DEFAULT_SHARE_RECEIVE_SETTINGS };
  }
}

/** Records the person's choice. Rule 66: an existing file is copied to a .superseded.<UTC>.json sibling first. */
export function writeShareReceiveSettings(next: Partial<ShareReceiveSettings>, settingsPath: string = shareReceiveSettingsPath()): ShareReceiveSettings {
  const settings = normalize(next);
  mkdirSync(dirname(settingsPath), { recursive: true });
  if (existsSync(settingsPath)) {
    const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    copyFileSync(settingsPath, settingsPath.replace(/\.json$/, `.superseded.${ts}.json`));
  }
  writeFileSync(settingsPath, JSON.stringify({ ...settings, set_utc: new Date().toISOString(), note: 'D-BP223-PQ005-012-X041: the fourth consent, an offered card landing in this silo.' }, null, 2), 'utf8');
  return settings;
}

/** The decision, pure. The default rule first (same owner accepts, stranger refused), then the person's widening. */
export function decideOfferConsent(settings: ShareReceiveSettings, input: OfferConsentInput): OfferConsentDecision {
  const base = defaultOfferConsent(input);
  if (base.decision !== 'hold') return base;
  if (settings.allowPeers.includes(input.senderPeerId)) return { decision: 'accept', reason: `peer "${input.senderPeerId}" is on this node's allow list` };
  if (settings.acceptFrom === 'enrolled' && input.trust === 'enrolled') return { decision: 'accept', reason: 'this node accepts offers from every enrolled peer (acceptFrom: enrolled)' };
  return base;
}

/** What peer_server.ts injects as LibraryRouteContext.offerConsent: reads the settings file on every offer (no cache to go stale). */
export function offerConsentFromSettings(settingsPath?: string): (input: OfferConsentInput) => OfferConsentDecision {
  return (input) => decideOfferConsent(readShareReceiveSettings(settingsPath), input);
}

/**
 * Electron wiring. Same registration pattern as registerMeshRemoteAdminConsentIpc(): call once at boot from index.ts.
 * The inbox channels are registered beside the settings ones because the accept IS the one-click on the receiving side.
 */
export function registerShareReceiveConsentIpc(deps: {
  inboxDir(): string;
  siloDir(): string;
  tagsDir(): string;
  selfPeerId(): string;
  tagSigner(): import('./eblet_provenance_tags').TagSigner | null;
}): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ipcMain } = require('electron') as typeof import('electron');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const lib = require('./hollerith_library_share') as typeof import('./hollerith_library_share');
  ipcMain.handle('share-receive:get-settings', () => readShareReceiveSettings());
  ipcMain.handle('share-receive:set-settings', (_evt, next: Partial<ShareReceiveSettings>) => writeShareReceiveSettings(next ?? {}));
  ipcMain.handle('share-inbox:list', () => lib.listHeldOffers(deps.inboxDir()));
  ipcMain.handle('share-inbox:accept', (_evt, senderPeerId: string, file: string) => {
    const signer = deps.tagSigner();
    return lib.acceptHeldOffer(deps.inboxDir(), deps.siloDir(), String(senderPeerId), String(file), deps.selfPeerId(), signer ? { tagsDir: deps.tagsDir(), signer } : null);
  });
  ipcMain.handle('share-inbox:reject', (_evt, senderPeerId: string, file: string) => lib.rejectHeldOffer(deps.inboxDir(), String(senderPeerId), String(file)));
  // D-BP223-X043-002-D: READ-ONLY list of this node's own cards that pass the same shareability check the push itself
  // runs (buildSiloIndex -> validateShareableEblet), so the Settings "Share a card" list only ever offers a card the
  // push would send. It reads the silo; it writes nothing and changes no consent. Card bodies never leave main.
  ipcMain.handle('share:list-my-cards', () => listMyShareableCards(deps.siloDir(), lib.buildSiloIndex));
  console.log('[ShareReceiveConsent] IPC handlers registered (D-BP223-PQ005-012-X041)');
}

/** One of this node's own cards as the Settings list shows it: identity and hash only, never the body. */
export interface MyShareableCard {
  connector: string;
  file: string;
  title: string;
  sha256: string;
  qid: number | null;
  sourceStatus: string;
  sourceLabel: string | null;
}

/** Pure (the index builder is injected) so it is testable without Electron. Package support files (not_a_card) are left out. */
export function listMyShareableCards(
  siloDir: string,
  buildIndex: (dir: string) => { connectors: Array<{ connector: string; file: string; title: string; sha256: string; qid: number | null; sourceStatus: string; sourceLabel: string | null }>; skipped: unknown[] },
): { cards: MyShareableCard[]; notShareableCount: number } {
  const idx = buildIndex(siloDir);
  const cards = idx.connectors
    .filter((c) => c.sourceStatus === 'sourced' || c.sourceStatus === 'source_pending')
    .map((c) => ({ connector: c.connector, file: c.file, title: c.title, sha256: c.sha256, qid: c.qid, sourceStatus: c.sourceStatus, sourceLabel: c.sourceLabel }));
  return { cards, notShareableCount: idx.skipped.length };
}
