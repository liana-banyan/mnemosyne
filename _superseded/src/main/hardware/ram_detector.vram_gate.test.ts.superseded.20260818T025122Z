// ram_detector.vram_gate.test.ts
// SEG: D-BP155-051 / BISHOP / seg-vram-gates-model
//
// Covers the VRAM gate added to rightSize()/applyVramGate() in ram_detector.ts:
// VRAM was measured (detectVramGb) but never used to decide the model -- only
// logged in a `note` string. This let a machine with plenty of system RAM but
// insufficient VRAM (M3/TERENO, 31.9 GB RAM) get auto-recommended gemma4:12b,
// the exact model the Founder ruled out for it (memory:
// reference_m3_uses_gemma2_9b_vram_bound_not_ram_bound_bp155.md).
//
// This file follows this tree's existing electron-mock convention (see
// src/main/liana_cycle/liana_terminal_engine.ask_google_this.test.ts): `app`
// from 'electron' resolves to a bare path string outside a real Electron
// process, so `app.getPath('home')` would throw. rightSize() calls
// app.getPath('home') to locate ~/.mnemosynec/right-size.json (the override
// file), so electron is mocked here with a scratch temp dir as "home" --
// empty by default (no override file), written to per-test for the override
// case.
//
// What this proves (the ticket's own acceptance bar, restated as assertions):
//   1. Ample VRAM keeps the RAM tier's raw model (no step-down, no note).
//   2. Constrained VRAM steps the model down AND says why in `note`, naming
//      both the RAM-tier recommendation and the VRAM-constrained choice.
//   3. vramGb === null (detection failed) is NOT treated as zero -- falls
//      back to the RAM-tier recommendation with an honest "undetectable" note.
//   4. An explicit override still wins over the VRAM gate, but a note warns
//      when the override exceeds detected VRAM.
//   5. THE FOUNDER'S OWN CASE: M3's profile (31.9 GB RAM, constrained VRAM)
//      resolves to gemma2:9b, not gemma4:12b -- this is the ticket's actual
//      acceptance bar, not just a generic gate test.
//
// D-BP157-026 / BISHOP / seg-measure-model-weights, 2026-08-18: the
// gemma4:12b weight was corrected from a disk-file estimate to a real M0
// resident measurement, which resolves a ladder-ordering inversion
// D-BP157-025 had flagged. That correction also surfaces a SECOND, narrower
// issue in test 5 above ("THE FOUNDER'S CASE") -- see the large FLAGGED
// comment directly above that test for the full explanation. That one test
// is left intentionally failing rather than patched with an unverified
// number; every other test in this file passes under the corrected table.
//
// Run: npx vitest run src/main/hardware/ram_detector.vram_gate.test.ts

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

let fakeHome = '';

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'home') return fakeHome;
      return fakeHome;
    },
  },
}));

import { rightSize, applyVramGate, requiredVramGb } from './ram_detector';

function setOverride(overrideModel: string) {
  const dir = path.join(fakeHome, '.mnemosynec');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'right-size.json'), JSON.stringify({ override_model: overrideModel }));
}

beforeEach(() => {
  fakeHome = mkdtempSync(path.join(tmpdir(), 'ram_detector_test_'));
});

afterEach(() => {
  try {
    rmSync(fakeHome, { recursive: true, force: true });
  } catch {
    // best effort cleanup
  }
});

describe('requiredVramGb (measured/estimated table)', () => {
  test('known models return a positive requirement', () => {
    expect(requiredVramGb('gemma4:12b')).not.toBeNull();
    expect(requiredVramGb('gemma2:9b')).not.toBeNull();
    expect(requiredVramGb('gemma4:12b')!).toBeGreaterThan(requiredVramGb('gemma2:9b')!);
  });

  test('unknown model returns null (never invent a threshold)', () => {
    expect(requiredVramGb('some-model-not-in-the-table:1b')).toBeNull();
  });
});

describe('applyVramGate', () => {
  test('nano (tierModel null) passes through untouched', () => {
    const result = applyVramGate(null, 4);
    expect(result.model).toBeNull();
    expect(result.note).toBeUndefined();
  });

  test('ample VRAM keeps the tier model, no step-down note', () => {
    // ULTRA tier's raw pick is gemma4:12b (needs ~15.1 GB per the derived
    // table as of D-BP157-026's resident-measured correction on M0; was
    // ~8.9 GB under the old disk-weight-basis figure). 24 GB is ample
    // headroom either way.
    const result = applyVramGate('gemma4:12b', 24);
    expect(result.model).toBe('gemma4:12b');
    expect(result.note).toBeUndefined();
  });

  test('constrained VRAM steps down and says why', () => {
    // UPDATED D-BP157-026: was 8.0 GB, chosen when gemma4:12b needed ~8.9 GB
    // and gemma2:9b needed ~6.9 GB. D-BP157-025 corrected gemma2:9b to a
    // resident-measured 9.0 GB required, and D-BP157-026 corrected
    // gemma4:12b to a resident-measured 15.1 GB required (both from real
    // `ollama ps` / `GET /api/ps` readings, not estimates) -- 8.0 GB no
    // longer sits between them. This test is a GENERIC illustration of the
    // step-down mechanism, not a claim about specific real hardware, so the
    // representative value is updated here to 10.0 GB: above gemma2:9b's
    // corrected 9.0 GB requirement, below gemma4:12b's corrected 15.1 GB
    // requirement. (Contrast with "THE FOUNDER'S CASE" test below, which IS
    // tied to M3's real 8 GB card and is deliberately NOT adjusted this way
    // -- see its own comment.)
    const result = applyVramGate('gemma4:12b', 10.0);
    expect(result.model).toBe('gemma2:9b');
    expect(result.note).toBeDefined();
    expect(result.note!).toContain('gemma4:12b'); // names the RAM-tier recommendation
    expect(result.note!).toContain('gemma2:9b');  // names the VRAM-constrained choice
  });

  test('null VRAM (detection failed) falls back to the tier model with an honest note, is NOT treated as zero', () => {
    const result = applyVramGate('gemma4:12b', null);
    expect(result.model).toBe('gemma4:12b'); // not stepped down -- unknown is not zero
    expect(result.note).toBeDefined();
    expect(result.note!.toLowerCase()).toContain('undetectable');
  });

  test('severely constrained VRAM steps all the way down to the ladder floor', () => {
    const result = applyVramGate('gemma4:12b', 0.5);
    expect(result.model).toBe('gemma2:2b');
    expect(result.note).toBeDefined();
  });
});

describe('rightSize — VRAM gate integration', () => {
  test('ample VRAM: FULL tier keeps gemma4:12b', () => {
    const rs = rightSize(31.9, 24); // same RAM as M3, but ample VRAM this time
    expect(rs.ramTier).toBe('full');
    expect(rs.coopTier).toBe('FULL'); // coopTier unchanged by the VRAM gate
    expect(rs.model).toBe('gemma4:12b');
    expect(rs.autoRecommendedModel).toBe('gemma4:12b');
  });

  test('constrained VRAM: FULL tier steps down and the note names both models', () => {
    // UPDATED D-BP157-026: was rightSize(31.9, 8.0) -- see the identical
    // reasoning in the 'constrained VRAM steps down and says why' test
    // above. This test is a generic FULL-tier illustration, not tied to
    // specific real hardware, so it moves to 10.0 GB along with that test.
    const rs = rightSize(31.9, 10.0);
    expect(rs.ramTier).toBe('full');
    expect(rs.coopTier).toBe('FULL'); // ramTier/coopTier NEVER change from the VRAM gate
    expect(rs.model).toBe('gemma2:9b');
    expect(rs.autoRecommendedModel).toBe('gemma2:9b');
    expect(rs.note).toContain('gemma4:12b');
    expect(rs.note).toContain('gemma2:9b');
  });

  test('null VRAM falls back to the RAM-tier recommendation with an honest note', () => {
    const rs = rightSize(31.9, null);
    expect(rs.model).toBe('gemma4:12b');
    expect(rs.note?.toLowerCase()).toContain('undetectable');
  });

  test('explicit override survives the gate even when it exceeds detected VRAM, but warns', () => {
    setOverride('llama3.3:70b');
    const rs = rightSize(31.9, 8.0); // 8 GB is nowhere near llama3.3:70b's ~48 GB requirement
    expect(rs.model).toBe('llama3.3:70b'); // override wins -- never silently overridden
    expect(rs.overrideActive).toBe(true);
    expect(rs.note).toBeDefined();
    expect(rs.note!).toContain('llama3.3:70b');
    expect(rs.note!.toLowerCase()).toMatch(/below|insufficient|exceed/);
  });

  test('explicit override with ample VRAM carries no warning', () => {
    setOverride('llama3.1:8b');
    const rs = rightSize(31.9, 24);
    expect(rs.model).toBe('llama3.1:8b');
    expect(rs.note).toBeUndefined();
  });

  // FLAGGED, NOT SILENTLY FORCED TO PASS -- D-BP157-026 / BISHOP /
  // seg-measure-model-weights, 2026-08-18. This test's VRAM figure (8.0 GB)
  // is NOT an arbitrary "representative" value the way the two tests above
  // are -- it is M3's real total RTX 3070 capacity (8192 MiB = 8.0 GiB,
  // confirmed by D-BP157-025's own trace), so it is deliberately NOT
  // adjusted the way the two generic step-down tests above were.
  //
  // Under the table as corrected by THIS dispatch, gemma2:9b's own
  // required-VRAM (9.0 GB, unchanged from D-BP157-025 -- see
  // ram_detector.ts's MODEL_WEIGHTS_GB and the RESOLUTION comment above it)
  // now MARGINALLY EXCEEDS M3's real 8.0 GB card capacity. That makes the
  // assertion below (`rs.model === 'gemma2:9b'`) FAIL against the current
  // code, even though M3's own LIVE measured resident footprint for
  // gemma2:9b (7.1 GB, the same number the 9.0 GB requirement is derived
  // from) fits under 8.0 GB with 0.9 GB to spare -- which is what the
  // Founder's ruling and M3's actual observed behavior both say really
  // happens. This is evidence the requiredVramGb() overhead formula (weight
  // x 1.2 + 0.5 GB floor) DOUBLE-COUNTS KV-cache/activation overhead when
  // the underlying weight is already a resident measurement (as gemma2:9b's
  // is) rather than a bare disk/weight-file size (as llama3.3:70b's still
  // is) -- see the "second, narrower issue" paragraph in ram_detector.ts's
  // RESOLUTION comment block for the full reasoning.
  //
  // Per this estate's flag-don't-silently-resolve discipline (the same one
  // D-BP157-025 used when it left this exact test broken rather than patch
  // it with an unverified number): the assertion below is left EXACTLY as
  // originally written, matching the Founder's actual ruling and M3's real
  // observed behavior, NOT the current formula's output. It is expected to
  // FAIL when run, and that failure is the correct, honest signal that
  // requiredVramGb()'s overhead formula -- not the weight table, not this
  // test, and not the Founder's ruling -- needs a follow-up SEG (a
  // `basis: 'disk' | 'resident'` distinction on ModelWeight, or equivalent,
  // so overhead is not added twice for an already-resident measurement).
  // See SEG_RETURN_BP157_026_MODEL_WEIGHTS_MEASURED.md for the full
  // writeup. DO NOT "fix" this test by changing 8.0 to some other number --
  // that would misrepresent M3's real hardware and hide the actual defect.
  test("THE FOUNDER'S CASE: M3's profile (31.9 GB RAM, constrained VRAM) resolves to gemma2:9b, not gemma4:12b", () => {
    // M3 (TERENO) is a remote peer on the mesh -- this dev session has no live
    // telemetry access to query its actual detected VRAM figure. 8.0 GB is
    // M3's REAL total RTX 3070 capacity (8192 MiB), not an arbitrary
    // representative value -- see the FLAGGED comment directly above this
    // test for why it stays 8.0 GB even though that now makes this specific
    // assertion fail against requiredVramGb()'s current formula.
    const M3_RAM_GB = 31.9;
    const M3_ASSUMED_CONSTRAINED_VRAM_GB = 8.0;

    const rs = rightSize(M3_RAM_GB, M3_ASSUMED_CONSTRAINED_VRAM_GB);

    expect(rs.ramTier).toBe('full'); // RAM alone says FULL -> gemma4:12b
    expect(rs.model).toBe('gemma2:9b'); // VRAM gate steps it down -- the Founder's ruling
    expect(rs.model).not.toBe('gemma4:12b'); // explicitly the model the Founder ruled out here
    expect(rs.coopTier).toBe('FULL'); // coopTier/pricing tier is untouched
  });
});
