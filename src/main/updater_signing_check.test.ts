// updater_signing_check.test.ts -- D-BP223-BM0-X030-073 P3: the updater signature check is ON and a build without signing
// config FAILS (never warns and ships unsigned). Exercises scripts/updater_signing_check.cjs and the scripts/sign.cjs hook.
import { describe, test, expect } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const req = createRequire(import.meta.url);
const SCRIPTS = join(__dirname, '..', '..', 'scripts');
const check = req(join(SCRIPTS, 'updater_signing_check.cjs'));
const sign = req(join(SCRIPTS, 'sign.cjs'));

const ENV_OK = { TRUSTED_SIGNING_ENDPOINT: 'https://e', TRUSTED_SIGNING_ACCOUNT: 'a', TRUSTED_SIGNING_PROFILE: 'p' };
const WIN_OK = { verifyUpdateCodeSignature: true, publisherName: ['Jonathan Jones'], sign: './scripts/sign.cjs' };

describe('updater signing config check (X030-073 P3)', () => {
  test('passes only with the check ON, a publisher name, and all three signing variables', () => {
    expect(check.checkUpdaterSigning(WIN_OK, ENV_OK).ok).toBe(true);
    expect(check.checkUpdaterSigning({ ...WIN_OK, verifyUpdateCodeSignature: false }, ENV_OK).problems.join()).toMatch(/verifyUpdateCodeSignature/);
    expect(check.checkUpdaterSigning({ ...WIN_OK, publisherName: undefined }, ENV_OK).problems.join()).toMatch(/publisherName/);
    expect(check.checkUpdaterSigning(WIN_OK, { ...ENV_OK, TRUSTED_SIGNING_PROFILE: '' }).problems.join()).toMatch(/TRUSTED_SIGNING_PROFILE/);
    expect(check.checkUpdaterSigning(WIN_OK, {}).problems.join()).toMatch(/TRUSTED_SIGNING_ENDPOINT, TRUSTED_SIGNING_ACCOUNT, TRUSTED_SIGNING_PROFILE/);
  });

  test('sign.cjs hook THROWS (fails the build) when signing env is absent; it no longer returns quietly', async () => {
    const saved = { ...process.env };
    try {
      for (const k of Object.keys(ENV_OK)) delete process.env[k];
      await expect(sign({ path: 'C:\\nope\\x.exe', options: WIN_OK })).rejects.toThrow(/BUILD REFUSED/);
    } finally { Object.assign(process.env, saved); }
  });

  test('sign.cjs hook THROWS when the updater check is off in the win config electron-builder passes', async () => {
    const saved = { ...process.env };
    try {
      Object.assign(process.env, ENV_OK);
      await expect(sign({ path: 'C:\\nope\\x.exe', options: { ...WIN_OK, verifyUpdateCodeSignature: false } })).rejects.toThrow(/verifyUpdateCodeSignature/);
    } finally { for (const k of Object.keys(ENV_OK)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } }
  });

  test('the fail-soft "Building unsigned" branch is gone from sign.cjs', () => {
    const src = readFileSync(join(SCRIPTS, 'sign.cjs'), 'utf8');
    expect(src).not.toMatch(/is not set. Building unsigned/);
    expect(src).toMatch(/assertUpdaterSigning/);
  });
});
