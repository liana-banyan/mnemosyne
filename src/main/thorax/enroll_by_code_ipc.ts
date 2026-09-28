/**
 * enroll_by_code_ipc.ts -- D-BP223-X043-007 follow-on (c). The Settings "Enroll my machines"
 * screen's main-process side. All crypto and every refusal rule live in enroll_by_code.ts; this
 * file only wires real keys, the real registry path and the real authenticator check into it.
 *
 * IPC channels (preload.ts exposes them as window.amplify.enroll*):
 *   enroll:get-my-code   -> { ok, code, peerId, label } | { ok:false, error }
 *   enroll:preview       (code) -> { ok, peerId, label, thoraxFingerprint, identityFingerprint } | { ok:false, error }
 *   enroll:submit        ({ code, authCode }) -> { ok, peerId, label } | { ok:false, error }
 *   enroll:list          -> { ok, peers: [{ peerId, keyId, enrolledAt, label }] }
 *
 * The ONE network call: enroll:submit POSTs { order_hash, code, issuer, subject, scope, nonce } to
 * the `founder-code-verify` edge function (the seed lives there, never on a machine). That call
 * burns the authenticator code server-side (one code, one enrollment). Nothing else leaves the
 * machine; the enrollment code itself is copied and pasted by the person.
 */

import { createHash, createPrivateKey, sign as edSign } from 'node:crypto';
import { hostname } from 'node:os';
import { join } from 'node:path';
import {
  applyEnrollmentByCode,
  buildEnrollmentCode,
  makeEnrollOrder,
  parseAndVerifyEnrollmentCode,
} from './enroll_by_code';
import { loadPeerEnrollmentRegistry } from './peer_enrollment_registry';

export interface EnrollByCodeDeps {
  selfPeerId: () => string;
  label: () => string;
  identityPublicSpkiHex: () => string;
  signWithIdentity: (message: string) => string;
  thoraxPublicSpkiHex: () => string;
  signWithThorax: (message: string) => string;
  registryPath: () => string;
  attestPublicKeySpkiHex: () => string;
  /** POSTs to founder-code-verify and returns the parsed JSON receipt. */
  requestFounderReceipt: (body: { order_hash: string; code: string; issuer: string; subject: string; scope: string; nonce: string }) => Promise<unknown>;
  now?: () => Date;
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function fingerprint(spkiHex: string): string {
  return createHash('sha256').update(spkiHex, 'utf8').digest('hex').slice(0, 16).replace(/(.{4})(?!$)/g, '$1 ');
}

export function createEnrollByCodeService(deps: EnrollByCodeDeps) {
  const nowDate = (): Date => (deps.now ? deps.now() : new Date());
  const nowUnix = (): number => Math.floor(nowDate().getTime() / 1000);

  return {
    getMyCode(): { ok: true; code: string; peerId: string; label: string } | { ok: false; error: string } {
      try {
        const peerId = deps.selfPeerId();
        const label = deps.label();
        const code = buildEnrollmentCode({
          peerId,
          label,
          identitySpkiHex: deps.identityPublicSpkiHex(),
          thoraxSpkiHex: deps.thoraxPublicSpkiHex(),
          signWithIdentity: deps.signWithIdentity,
          signWithThorax: deps.signWithThorax,
          nowUnixSeconds: nowUnix(),
        });
        return { ok: true, code, peerId, label };
      } catch (err) {
        return { ok: false, error: `could not make this machine's enrollment code: ${errText(err)}` };
      }
    },

    preview(code: unknown): { ok: true; peerId: string; label: string; thoraxFingerprint: string; identityFingerprint: string; alreadyEnrolled: boolean } | { ok: false; error: string } {
      const parsed = parseAndVerifyEnrollmentCode(String(code ?? ''), nowUnix());
      if (!parsed.ok) return { ok: false, error: parsed.reason };
      if (parsed.code.peerId === deps.selfPeerId()) return { ok: false, error: 'that is this machine\'s own code; paste the code shown on the OTHER machine' };
      const reg = loadPeerEnrollmentRegistry(deps.registryPath());
      return {
        ok: true,
        peerId: parsed.code.peerId,
        label: parsed.code.label,
        thoraxFingerprint: fingerprint(parsed.code.thoraxSpkiHex),
        identityFingerprint: fingerprint(parsed.code.identitySpkiHex),
        alreadyEnrolled: reg[parsed.code.peerId]?.public_key_hex === parsed.code.thoraxSpkiHex,
      };
    },

    async submit(req: unknown): Promise<{ ok: true; peerId: string; label: string } | { ok: false; error: string }> {
      const r = (req && typeof req === 'object') ? req as { code?: unknown; authCode?: unknown } : {};
      const authCode = String(r.authCode ?? '').replace(/\s+/g, '');
      if (!/^\d{6}$/.test(authCode)) return { ok: false, error: 'type the 6-digit code from your authenticator app' };
      const parsed = parseAndVerifyEnrollmentCode(String(r.code ?? ''), nowUnix());
      if (!parsed.ok) return { ok: false, error: parsed.reason };
      const selfPeerId = deps.selfPeerId();
      if (parsed.code.peerId === selfPeerId) return { ok: false, error: 'that is this machine\'s own code; paste the code shown on the OTHER machine' };

      const order = makeEnrollOrder(selfPeerId, parsed.code, nowDate());
      let receipt: unknown;
      try {
        receipt = await deps.requestFounderReceipt({
          order_hash: order.order_hash, code: authCode, issuer: order.issuer,
          subject: order.subject, scope: order.scope, nonce: order.nonce,
        });
      } catch (err) {
        return { ok: false, error: `could not reach the authenticator check: ${errText(err)}` };
      }
      try {
        const applied = applyEnrollmentByCode({
          selfPeerId, code: parsed.code, order, receipt,
          attestPublicKeySpkiHex: deps.attestPublicKeySpkiHex(),
          registryPath: deps.registryPath(),
          nowUnixSeconds: nowUnix(),
        });
        return applied.applied
          ? { ok: true, peerId: applied.peerId, label: applied.label }
          : { ok: false, error: applied.reason };
      } catch (err) {
        return { ok: false, error: `enrollment could not be written: ${errText(err)}` };
      }
    },

    list(): { ok: true; peers: Array<{ peerId: string; keyId: string; enrolledAt: string; label: string }> } {
      const reg = loadPeerEnrollmentRegistry(deps.registryPath());
      const peers = Object.values(reg).map((rec) => {
        const m = /label=([^;]*);/.exec(rec.source ?? '');
        return { peerId: rec.peer_id, keyId: rec.key_id, enrolledAt: rec.enrolled_at, label: m ? m[1] : '' };
      });
      return { ok: true, peers };
    },
  };
}

/** Real dependencies, resolved lazily so importing this file has no side effects. */
export function realEnrollByCodeDeps(): EnrollByCodeDeps {
  /* eslint-disable @typescript-eslint/no-var-requires */
  const { app } = require('electron') as typeof import('electron');
  const { ensureLocalPeerKeypair, signWithLocalPeerKey } = require('../identity/localPeerKeypair') as typeof import('../identity/localPeerKeypair');
  const { getOrCreateKeypair } = require('./ed25519_keypair') as typeof import('./ed25519_keypair');
  const { getSupabaseUrl, getAnonKey } = require('../shared/anon_key') as typeof import('../shared/anon_key');
  /* eslint-enable @typescript-eslint/no-var-requires */
  return {
    // The identity key IS the peer id source (peer id = sha256(identity public hex)[0:16]).
    selfPeerId: () => ensureLocalPeerKeypair().peerId,
    label: () => hostname(),
    identityPublicSpkiHex: () => ensureLocalPeerKeypair().publicKeyHex,
    signWithIdentity: (message) => signWithLocalPeerKey(message).signatureHex,
    thoraxPublicSpkiHex: () => getOrCreateKeypair().public_key_hex,
    signWithThorax: (message) => {
      const { private_key_hex } = getOrCreateKeypair();
      const key = createPrivateKey({ key: Buffer.from(private_key_hex, 'hex'), format: 'der', type: 'pkcs8' });
      return edSign(null, Buffer.from(message, 'utf8'), key).toString('hex');
    },
    registryPath: () => join(app.getPath('userData'), 'peer_enrollment_registry.json'),
    attestPublicKeySpkiHex: () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { getEffectiveKeyRegistry } = require('../auto_update_scheduler') as typeof import('../auto_update_scheduler');
      const entry = getEffectiveKeyRegistry()['lb-attest-2026-01'];
      if (!entry || entry.status !== 'active') throw new Error('lb-attest-2026-01 is not an active key in the trust registry');
      return entry.publicKeyHex;
    },
    requestFounderReceipt: async (body) => {
      const anonKey = getAnonKey();
      const res = await fetch(`${getSupabaseUrl()}/functions/v1/founder-code-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`HTTP ${res.status}, not JSON`);
      }
    },
  };
}

let _registered = false;

export function registerEnrollByCodeIpc(): void {
  if (_registered) return;
  _registered = true;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ipcMain } = require('electron') as typeof import('electron');
  const svc = createEnrollByCodeService(realEnrollByCodeDeps());
  ipcMain.handle('enroll:get-my-code', () => svc.getMyCode());
  ipcMain.handle('enroll:preview', (_e, code: unknown) => svc.preview(code));
  ipcMain.handle('enroll:submit', (_e, req: unknown) => svc.submit(req));
  ipcMain.handle('enroll:list', () => svc.list());
}
