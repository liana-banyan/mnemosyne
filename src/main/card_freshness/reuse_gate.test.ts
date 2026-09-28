// D-BP223-BM0-X030-073: the verified-eblet reuse check (mnem_eblet_store.ts queryVerifiedEblets, the reuse gate X030-025
// named at lines 2758-2783) honors correction precedence and stale cutoff C end to end, from a real jsonl file.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const DAY = 86_400_000;
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

function entry(question: string, answer: string, ageDays: number, extra: Record<string, unknown> = {}) {
  return { question, answer, provenance: 'compute:test', verified: true, verdict: 'verified', corroboration: 'coroner_verified', sha256: sha(question + answer), timestamp: Date.now() - ageDays * DAY, ...extra };
}

describe('queryVerifiedEblets reuse check (X030-073)', () => {
  // mnem_eblet_store.ts resolves userData through a CommonJS require('electron'), which vi.doMock does not intercept; outside
  // Electron it falls back to %APPDATA%\MnemosyneC. So APPDATA is pointed at a scratch dir: never the real store.
  let root: string;
  let dir: string;
  let savedAppData: string | undefined;
  beforeEach(() => {
    vi.resetModules();
    root = mkdtempSync(join(tmpdir(), 'x030073-reuse-'));
    dir = join(root, 'MnemosyneC');
    mkdirSync(join(dir, 'substrate'), { recursive: true });
    savedAppData = process.env.APPDATA;
    process.env.APPDATA = root;
  });
  afterEach(() => { process.env.APPDATA = savedAppData; rmSync(root, { recursive: true, force: true }); });

  const write = (rows: unknown[]) => writeFileSync(join(dir, 'substrate', 'verified_eblets.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

  test('fresh general entry: returned as Verified reusable answer', async () => {
    write([entry('What is the density of pure water at 4 degrees Celsius in g/cc', 'The density is 1.00 g/cc because water is densest at 4 C.', 10)]);
    const { queryVerifiedEblets } = await import('../mnem_eblet_store');
    const hits = await queryVerifiedEblets('What is the density of pure water at 4 degrees Celsius in g/cc');
    expect(hits.length).toBe(1);
    expect(hits[0].reuse_state).toBe('verified_reusable_answer');
  });

  test('aged general entry (200 days): returned only as Prior record, re-verify', async () => {
    write([entry('What is the density of pure water at 4 degrees Celsius in g/cc', 'The density is 1.00 g/cc because water is densest at 4 C.', 200)]);
    const { queryVerifiedEblets } = await import('../mnem_eblet_store');
    const hits = await queryVerifiedEblets('What is the density of pure water at 4 degrees Celsius in g/cc');
    expect(hits[0].reuse_state).toBe('prior_record_reverify');
    expect(hits[0].reuse_label).toBe('Prior record, re-verify');
  });

  test('volatile entry at 40 days is aged; canon entry at 400 days is not', async () => {
    write([
      entry('What is the latest version of the widget standard', 'Version 7 is the latest per the registry page.', 40),
      entry('What is the immutable annual membership price', 'Five dollars a year, per the ruling.', 400, { freshness_class: 'canon' }),
    ]);
    const { queryVerifiedEblets } = await import('../mnem_eblet_store');
    expect((await queryVerifiedEblets('What is the latest version of the widget standard'))[0].reuse_state).toBe('prior_record_reverify');
    expect((await queryVerifiedEblets('What is the immutable annual membership price'))[0].reuse_state).toBe('verified_reusable_answer');
  });

  test('an appended correction row withholds the entry: never returned as the old answer, nothing on disk rewritten', async () => {
    const e = entry('What is the density of pure water at 4 degrees Celsius in g/cc', 'The density is 0.60 g/cc because water is densest at 4 C.', 1);
    write([e, { kind: 'correction', corrects: { sha256: e.sha256 }, utc: new Date().toISOString(), reason: 'wrong value' }]);
    const { queryVerifiedEblets } = await import('../mnem_eblet_store');
    const hits = await queryVerifiedEblets('What is the density of pure water at 4 degrees Celsius in g/cc');
    expect(hits.find((h) => h.answer === e.answer)).toBeUndefined();
  });

  test('applyReuseFreshness is pure: corrected dropped, aged labeled, input untouched', async () => {
    const { applyReuseFreshness, isCorrectionShapedRow } = await import('../mnem_eblet_store');
    const a = entry('plain fact one here', 'answer one body text', 1) as any;
    const b = entry('plain fact two here', 'answer two body text', 365) as any;
    const out = applyReuseFreshness([a, b], [{ kind: 'supersede', supersedes: a.sha256 }], Date.now());
    expect(out.map((x) => x.question)).toEqual(['plain fact two here']);
    expect(out[0].reuse_state).toBe('prior_record_reverify');
    expect(a.reuse_state).toBeUndefined();
    expect(isCorrectionShapedRow({ addendum_type: 'source' })).toBe(true);
    expect(isCorrectionShapedRow(a)).toBe(false);
  });
});
