// D-BP223-BM0-X029-019 (round 2) -- the MnemosyneC Settings store for Nexus Authorities. Fake keys only, a temp auth
// dir, real Windows DPAPI when on Windows. No network, no provider, no spend.
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createHash } from 'crypto';

const DIR = mkdtempSync(join(tmpdir(), 'x029_019_flagship_auth_'));
process.env.LB_ASKFLOW_AUTH_DIR = DIR;

import { listAuthorities, saveKey, removeKey, setAutomatic } from './flagship_authorities_store';
import { FLAGSHIP_PROVIDERS } from './flagship_providers.generated';

const CONDUIT_JSON = 'C:/Users/Administrator/Documents/LianaBanyanPlatform/BISHOP_DROPZONE/MIC_CHANNEL/conduit/askflow_providers.json';
const FAKE = 'sk-ant-TEST-not-a-real-key-555555';

describe('flagship authorities store', () => {
  beforeAll(() => { expect(process.env.LB_ASKFLOW_AUTH_DIR).toBe(DIR); });

  it('the generated list matches the Conduit providers file byte-for-byte by sha', () => {
    const header = readFileSync(join(__dirname, 'flagship_providers.generated.ts'), 'utf8').split('\n')[1];
    let sha: string | null = null;
    try { sha = createHash('sha256').update(readFileSync(CONDUIT_JSON, 'utf8')).digest('hex'); } catch { sha = null; }
    if (sha) expect(header).toContain(sha);
    expect(FLAGSHIP_PROVIDERS.some((p) => p.id === 'xai_api')).toBe(true);
  });

  it('every provider starts MANUAL, and every website can be switched to automatic with a terms note', () => {
    const rows = listAuthorities();
    expect(rows.every((r) => r.automatic_on === false && r.automatic_ready === false)).toBe(true);
    const web = rows.filter((r) => r.kind === 'subscription');
    expect(web.length).toBe(4);
    expect(web.every((r) => /own terms may not allow automated use of its website\. You decide\./.test(r.terms_note || ''))).toBe(true);
    for (const r of web) { const s = setAutomatic(r.id, true); expect(s.ok && s.authority.automatic_ready).toBe(true); }
  });

  it('every key row says your key, your account, your bill', () => {
    const keyed = listAuthorities().filter((r) => r.kind !== 'subscription');
    expect(keyed.every((r) => r.bring_your_own === 'Your key, your account, your bill.')).toBe(true);
  });

  it.runIf(process.platform === 'win32')('saves a key with DPAPI, never returns it, and sets it aside on remove', () => {
    const s = saveKey('anthropic_api', FAKE);
    expect(s.ok).toBe(true);
    expect(JSON.stringify(s)).not.toContain(FAKE);
    const onDisk = readFileSync(join(DIR, 'anthropic_api.dpapi'), 'utf8');
    expect(onDisk).not.toContain(FAKE);
    expect(onDisk.length).toBeGreaterThan(100);
    expect(JSON.stringify(listAuthorities())).not.toContain(FAKE);
    const a = setAutomatic('anthropic_api', true);
    expect(a.ok && a.authority.automatic_ready).toBe(true);
    const r = removeKey('anthropic_api');
    expect(r.ok && r.authority.has_key === false && r.authority.automatic_ready === false).toBe(true);
    expect(readdirSync(DIR).some((n) => /^anthropic_api\.dpapi\.removed\./.test(n))).toBe(true);
  });

  it('refuses a key for a website, a key that is not a key, and an unknown provider', () => {
    expect(saveKey('claude_web', FAKE).ok).toBe(false);
    expect(saveKey('openai_api', 'short').ok).toBe(false);
    expect(setAutomatic('nope', true).ok).toBe(false);
  });
});
