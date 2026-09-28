// flagship_authorities_store.ts -- D-BP223-BM0-X029-019-ASK-FLOW-TRANSMISSION (round 2)
//
// NEXUS AUTHORITIES IN MNEMOSYNEC SETTINGS. Founder k/d74e863d ("Automatic can be set whenever you do the Nexus
// Authorities as well - for subscriptions and API ... including those websites that rent out their API's") and
// k/fbce54d5 ("we don't offer any API keys to ANY users. They use whatever they want to use" / "make them
// automatic, as well. so that each user picks").
//
// ONE STORE FOR BOTH SURFACES. The Conduit's Ask pane (BISHOP_DROPZONE/MIC_CHANNEL/conduit/conduit_ask_flow.js)
// already keeps the user's per-provider choice and keys at ~/.lianabanyan/conduit_flagship_keys/. This module reads
// and writes the SAME files in the SAME format, so a key saved in MnemosyneC Settings is the key the Conduit uses and
// the reverse. The provider list is flagship_providers.generated.ts, generated from the Conduit's own
// askflow_providers.json (never hand-copied).
//
// WHAT IS STORED, AND HOW:
//   nexus_authorities_setup.json  { automatic_on: { <providerId>: boolean } }   -- the user's choice, no secrets
//   <providerId>.dpapi            base64 Windows DPAPI (CurrentUser) ciphertext of the user's OWN key
// The key reaches PowerShell on STDIN only (never argv, never a log). Nothing here ever returns a key: callers get
// has_key true/false. A replaced or removed key file is renamed aside (Rule 66: set aside, never deleted) and never
// read again. Off Windows there is no DPAPI, so saving a key is refused honestly rather than stored weaker.
//
// No Electron import: flagship_authorities_ipc.ts registers the IPC; this file stays unit-testable in plain Node.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { FLAGSHIP_PROVIDERS, type FlagshipProvider } from './flagship_providers.generated';

export interface FlagshipAuthorityRow {
  id: string;
  label: string;
  kind: FlagshipProvider['kind'];
  automatic_on: boolean;
  needs_key: boolean;
  has_key: boolean | null;
  automatic_ready: boolean;
  terms_note: string | null;
  bring_your_own: string | null;
  why: string;
  price: string | null;
  key_page: string | null;
  key_hint: string | null;
  open_url: string | null;
  terms_url: string | null;
}

export type FlagshipResult = { ok: true; authority: FlagshipAuthorityRow } | { ok: false; error: string };

export function authDir(): string {
  return process.env.LB_ASKFLOW_AUTH_DIR || join(homedir(), '.lianabanyan', 'conduit_flagship_keys');
}
function keyFile(id: string): string { return join(authDir(), String(id).replace(/[^a-z0-9_]/g, '') + '.dpapi'); }
function setupFile(): string { return join(authDir(), 'nexus_authorities_setup.json'); }
function stamp(): string { return new Date().toISOString().replace(/[:.]/g, '-'); }

function readSetup(): { automatic_on: Record<string, boolean> } {
  try {
    const j = JSON.parse(readFileSync(setupFile(), 'utf8'));
    return { automatic_on: (j && typeof j.automatic_on === 'object' && j.automatic_on) || {} };
  } catch { return { automatic_on: {} }; }
}
function writeSetup(s: { automatic_on: Record<string, boolean> }): void {
  mkdirSync(authDir(), { recursive: true });
  writeFileSync(setupFile(), JSON.stringify(s, null, 2));
}

function providerById(id: string): FlagshipProvider | null { return FLAGSHIP_PROVIDERS.find((p) => p.id === id) || null; }
function takesKey(p: FlagshipProvider): boolean { return (p.kind === 'api' || p.kind === 'aggregator') && p.adapter !== 'mnemosynec_nexus'; }

function dpapiProtect(secret: string): { ok: boolean; out?: string; error?: string } {
  if (process.platform !== 'win32') return { ok: false, error: 'saving a key needs Windows DPAPI on this machine; nothing was saved' };
  const script = '$in=[Console]::In.ReadToEnd();Add-Type -AssemblyName System.Security;'
    + '[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($in),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))';
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], { input: secret, encoding: 'utf8', timeout: 20000, windowsHide: true });
  if (r.status !== 0) return { ok: false, error: 'DPAPI protect failed (exit ' + r.status + '); nothing was saved' };
  const out = String(r.stdout || '').trim();
  return out ? { ok: true, out } : { ok: false, error: 'DPAPI returned nothing; nothing was saved' };
}

export function authorityRow(p: FlagshipProvider, setup = readSetup()): FlagshipAuthorityRow {
  const needsKey = takesKey(p);
  const hasKey = needsKey ? existsSync(keyFile(p.id)) : null;
  const on = setup.automatic_on[p.id] === true;
  return {
    id: p.id, label: p.label, kind: p.kind, automatic_on: on, needs_key: needsKey, has_key: hasKey,
    automatic_ready: !!(p.automatic_allowed && on && (!needsKey || hasKey === true)),
    terms_note: p.terms_note || null, bring_your_own: p.bring_your_own || null, why: p.why, price: p.price || null,
    key_page: p.key_page || null, key_hint: p.key_hint || null, open_url: p.open_url || null, terms_url: p.terms_url || null,
  };
}

export function listAuthorities(): FlagshipAuthorityRow[] {
  const s = readSetup();
  return FLAGSHIP_PROVIDERS.map((p) => authorityRow(p, s));
}

export function setAutomatic(providerId: string, on: boolean): FlagshipResult {
  const p = providerById(providerId);
  if (!p) return { ok: false, error: 'unknown provider' };
  if (on && !p.automatic_allowed) return { ok: false, error: p.label + ' cannot be set to automatic' };
  const s = readSetup(); s.automatic_on[p.id] = on === true; writeSetup(s);
  return { ok: true, authority: authorityRow(p, s) };
}

export function saveKey(providerId: string, rawKey: string): FlagshipResult {
  const p = providerById(providerId);
  const key = String(rawKey || '').trim();
  if (!p || !takesKey(p)) return { ok: false, error: 'that provider does not take a key here' };
  if (key.length < 8 || key.length > 400 || /\s/.test(key)) return { ok: false, error: 'that does not look like an API key' };
  const r = dpapiProtect(key);
  if (!r.ok || !r.out) return { ok: false, error: r.error || 'could not protect the key' };
  mkdirSync(authDir(), { recursive: true });
  if (existsSync(keyFile(p.id))) renameSync(keyFile(p.id), keyFile(p.id) + '.replaced.' + stamp());
  writeFileSync(keyFile(p.id), r.out, 'utf8');
  return { ok: true, authority: authorityRow(p) };
}

export function removeKey(providerId: string): FlagshipResult {
  const p = providerById(providerId);
  if (!p || !existsSync(keyFile(p.id))) return { ok: false, error: 'no key saved for that provider' };
  renameSync(keyFile(p.id), keyFile(p.id) + '.removed.' + stamp());
  return { ok: true, authority: authorityRow(p) };
}
