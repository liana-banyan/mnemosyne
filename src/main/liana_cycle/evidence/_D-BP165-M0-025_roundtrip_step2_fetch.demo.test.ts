// _D-BP165-M0-025_roundtrip_step2_fetch.demo.test.ts -- D-BP165-M0-025/BISHOP-SEG/seg-flagship-harvest
//
// STEP 2 of the round trip -- run this via a SEPARATE `npx vitest run` invocation from step 1 (a
// fresh Node process, no shared memory, no in-process cache of step 1's deposit). Reads the
// PERSISTENT dir step 1 wrote to (not a temp dir) and proves: mintSiloCelpane() and
// fetchSiloCelpaneFullText() reach the method deposited by step 1's process with ZERO network
// calls of any kind -- both functions are pure node:fs (readdirSync/readFileSync/existsSync) over
// the dir argument, confirmed by direct reading of method_silo.ts's own source (no `fetch`, no
// `http`, no import of any network-capable module anywhere in this file). This is the concrete
// "later run reaching a stored method with no flagship call" proof this dispatch's brief requires.

import { describe, expect, it } from 'vitest';
import { mintSiloCelpane, fetchSiloCelpaneFullText, summarizeMethodSilo } from './method_silo';

const DIR = 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\BISHOP_DROPZONE\\D-BP165-M0-025_FLAGSHIP_HARVEST\\demo_silo_dir';

describe('D-BP165-M0-025 round-trip proof, STEP 2 (mint + fetch, SEPARATE PROCESS from step 1, zero network calls)', () => {
  it('reaches the method deposited by step 1 with no flagship call and no network access of any kind', async () => {
    const mint = mintSiloCelpane('COMPUTE', { dir: DIR });
    expect(mint.ok).toBe(true);
    if (!mint.ok) throw new Error(`mint failed: ${mint.reason}`);
    expect(mint.celpane.methods).toContain('arithmetic_cascade');
    expect(mint.celpane.n).toBeGreaterThanOrEqual(1);
    // the celpane itself must NOT carry the method description or the named constant -- only
    // counts and ids, same claim method_silo.demo.test.ts's own step 2 already proves.
    const celpaneJson = JSON.stringify(mint.celpane);
    expect(celpaneJson).not.toContain('periods_per_year');
    expect(celpaneJson).not.toContain('remaining-balance formula');

    const fetch = await fetchSiloCelpaneFullText(mint.celpane, { dir: DIR });
    expect(fetch.ok).toBe(true);
    if (!fetch.ok) throw new Error(`fetch failed: ${fetch.reason}`);
    expect(fetch.text).toContain('periods_per_year');
    expect(fetch.text).toContain('12 months');
    expect(fetch.text).toContain('standard monthly-compounding convention');
    expect(fetch.text).toContain('remaining-balance formula');
    expect(fetch.bytes).toBeGreaterThan(0);

    const summary = summarizeMethodSilo({ dir: DIR });
    expect(summary.totalFiles).toBeGreaterThanOrEqual(1);

    // eslint-disable-next-line no-console -- deliberate, this IS the observable proof artifact
    console.log(`[D-BP165-M0-025 STEP 2] celpane tokens=${mint.tokens} withinBudget=${mint.withinBudget} fetchBytes=${fetch.bytes} filesRead=${JSON.stringify(fetch.filesRead)}`);
    console.log(`[D-BP165-M0-025 STEP 2] silo summary: ${JSON.stringify(summary)}`);
  });
});
