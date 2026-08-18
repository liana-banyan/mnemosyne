// ram_detector.vram_detect.test.ts
// SEG: D-BP157-025 / BISHOP / seg-fix-vram-detector
//
// Covers the VRAM DETECTOR itself (resolveVramFromWindowsAdapters and the
// corrected requiredVramGb/MODEL_WEIGHTS_GB), separate from the pre-existing
// gate tests in ram_detector.vram_gate.test.ts (which cover applyVramGate /
// rightSize and are left untouched by this dispatch).
//
// THE MEASURED DEFECT THIS FILE GUARDS AGAINST: Win32_VideoController's
// AdapterRAM is a Windows uint32 field, capped near 4 GiB. MEASURED on M3
// (RTX 3070, real 8192 MiB) and independently on M0 (RX 9070 XT, real ~16
// GB): both reported the IDENTICAL capped value 4,293,918,720 bytes (4095
// MiB) via AdapterRAM. The fix reads the 64-bit registry value
// HardwareInformation.qwMemorySize instead, which MEASURED correctly on M0:
// 17,095,983,104 bytes = 15.92 GB for the RX 9070 XT, and 2,147,483,648
// bytes = 2.00 GB for an integrated GPU (matching that same adapter's own,
// uncapped, below-ceiling AdapterRAM reading exactly).
//
// Tests here inject GpuAdapterReading[] directly into the pure decision
// function resolveVramFromWindowsAdapters() -- no process execution, no
// real hardware query, so the suite stays offline per this dispatch's
// standing rules.
//
// Run: npx vitest run src/main/hardware/ram_detector.vram_detect.test.ts

import { describe, test, expect, vi } from 'vitest';

// ram_detector.ts imports `app` from 'electron' at module scope (used by
// rightSize()/resolveEffectiveModel() for the right-size.json override path).
// Following this tree's existing convention (see ram_detector.vram_gate.test.ts
// and src/main/liana_cycle/liana_terminal_engine.ask_google_this.test.ts):
// mock it so the module loads outside a real Electron process, even though no
// test in this file calls app.getPath directly.
vi.mock('electron', () => ({
  app: {
    getPath: () => '',
  },
}));

import { resolveVramFromWindowsAdapters, requiredVramGb, applyVramGate, type GpuAdapterReading } from './ram_detector';

describe('resolveVramFromWindowsAdapters — the uint32 ceiling defect', () => {
  test('a capped AdapterRAM value (no registry data) is rejected as unknown, not trusted as 4095 MiB', () => {
    // MEASURED, D-BP157-025: this exact byte value (4095 MiB) was returned
    // by AdapterRAM for BOTH an 8192 MiB card (M3) and a ~16 GB card (M0).
    const adapters: GpuAdapterReading[] = [
      { name: 'Some GPU', cimAdapterRamBytes: 4_293_918_720, registryBytes: null },
    ];
    const result = resolveVramFromWindowsAdapters(adapters);
    expect(result.vramGb).toBeNull(); // NOT 4.1 GB, NOT a silent zero -- honestly unknown
    expect(result.confidence).toBe('unknown');
    expect(result.method).toBe('cim-capped-rejected');
    expect(result.note).toBeDefined();
  });

  test('the 64-bit registry value corrects the exact M0 measurement: RX 9070 XT reads 15.92 GB, not 4095 MiB', () => {
    const adapters: GpuAdapterReading[] = [
      { name: 'AMD Radeon RX 9070 XT', registryBytes: 17_095_983_104, cimAdapterRamBytes: 4_293_918_720 },
    ];
    const result = resolveVramFromWindowsAdapters(adapters);
    expect(result.vramGb).toBe(15.9); // 17,095,983,104 / 1024^3, rounded to 1 decimal
    expect(result.method).toBe('registry');
    expect(result.confidence).toBe('measured');
  });

  test('a below-ceiling CIM reading (no registry data) is still trusted — the ceiling only rejects near-4GiB values', () => {
    // MEASURED, D-BP157-025: M0's integrated GPU reports 2,147,483,648 bytes
    // (2.00 GB) via AdapterRAM, which is well below the ceiling and matches
    // its own registry value exactly -- proof CIM is fine strictly below it.
    const adapters: GpuAdapterReading[] = [
      { name: 'AMD Radeon(TM) Graphics', cimAdapterRamBytes: 2_147_483_648, registryBytes: null },
    ];
    const result = resolveVramFromWindowsAdapters(adapters);
    expect(result.vramGb).toBe(2.0);
    expect(result.method).toBe('cim');
    expect(result.confidence).toBe('low'); // usable, but not the 64-bit source
  });
});

describe('resolveVramFromWindowsAdapters — multi-adapter box', () => {
  test('MEASURED M0 shape: dGPU + iGPU both present — uses the largest, never sums', () => {
    const adapters: GpuAdapterReading[] = [
      { name: 'AMD Radeon RX 9070 XT', registryBytes: 17_095_983_104 },
      { name: 'AMD Radeon(TM) Graphics', registryBytes: 2_147_483_648 },
    ];
    const result = resolveVramFromWindowsAdapters(adapters);
    expect(result.vramGb).toBe(15.9); // the dGPU, NOT 15.9 + 2.0 = 17.9 (the old -Sum defect)
    expect(result.method).toBe('registry');
    expect(result.note).toContain('largest single adapter, not summed');
  });

  test('mixed sources: one adapter has registry data, one only has a capped CIM reading — largest known value wins', () => {
    const adapters: GpuAdapterReading[] = [
      { name: 'Discrete GPU', registryBytes: null, cimAdapterRamBytes: 4_293_918_720 }, // capped -> rejected
      { name: 'Integrated GPU', registryBytes: 2_147_483_648 },
    ];
    const result = resolveVramFromWindowsAdapters(adapters);
    expect(result.vramGb).toBe(2.0); // only the iGPU's reading is trustworthy here
    expect(result.confidence).toBe('measured');
  });
});

describe('resolveVramFromWindowsAdapters — no discrete GPU at all', () => {
  test('an empty adapter list (nano-tier box, most cloud VMs) returns unknown, not zero', () => {
    const result = resolveVramFromWindowsAdapters([]);
    expect(result.vramGb).toBeNull();
    expect(result.method).toBe('none');
    expect(result.confidence).toBe('unknown');
    expect(result.note?.toLowerCase()).toContain('no gpu adapters found');
  });

  test('adapters present but neither source has a usable reading — still unknown, not zero', () => {
    const adapters: GpuAdapterReading[] = [{ name: 'Unknown Adapter' }];
    const result = resolveVramFromWindowsAdapters(adapters);
    expect(result.vramGb).toBeNull();
    expect(result.confidence).toBe('unknown');
  });
});

describe('requiredVramGb — D-BP157-031 resident-basis formula, D-BP157-026 measured weights', () => {
  // D-BP157-034/BISHOP/seg-fix-test-failures: this whole describe block encoded the
  // PRE-D-BP157-031 numbers (double-counted overhead on a resident measurement) and was missed
  // when this file's sibling, ram_detector.vram_gate.test.ts, was updated for that fix. Every
  // number below is recomputed from the CURRENT MODEL_WEIGHTS_GB table and requiredVramGb()
  // formula in ram_detector.ts (verified by reading that source directly, not assumed):
  //   gemma2:2b  : basis resident, gb 3.28 -> 3.28 + 0.5 (VRAM_RESIDENT_HEADROOM_GB) = 3.78 -> 3.8
  //   gemma2:9b  : basis resident, gb 7.1  -> 7.1  + 0.5                            = 7.6  -> 7.6
  //   llama3.1:8b: basis resident, gb 8.52 -> 8.52 + 0.5                            = 9.02 -> 9.0
  //   gemma4:12b : basis resident, gb 12.17-> 12.17+ 0.5                            = 12.67-> 12.7
  //   llama3.3:70b: basis disk, gb 39.60 -> 39.60*1.2 (VRAM_OVERHEAD_FACTOR) + 0.5 (FLOOR) = 48.02 -> 48.0
  // All five table entries now carry `measured: true`, so UNMEASURED_WEIGHT_SAFETY_MARGIN (the
  // 1.15x multiplier applied only when `measured: false`) does not fire for any of them --
  // confirmed arithmetically: llama3.3:70b's own required figure, 48.0, is exactly the
  // no-margin disk-basis calculation above; with the margin applied it would be 48.02 * 1.15 =
  // 55.2, not 48.0.

  test('gemma2:9b required VRAM reflects the resident basis (D-BP157-031): 7.1 GB measured + flat headroom, no double-counted overhead', () => {
    // RESOLUTION 2 (D-BP157-031) closed the double-count this test used to encode: a resident
    // measurement (a live `ollama ps`/GET /api/ps reading) already contains the KV-cache and
    // activation overhead a loaded model needs -- applying VRAM_OVERHEAD_FACTOR (1.2x) on top
    // of it a second time, as the old 9.0 GB expectation did, double-counted that overhead.
    // The corrected formula adds only the small flat VRAM_RESIDENT_HEADROOM_GB (0.5 GB) margin
    // for context-growth/sample variance: 7.1 + 0.5 = 7.6.
    expect(requiredVramGb('gemma2:9b')).toBe(7.6);
  });

  test('gemma2:2b is no longer unmeasured -- D-BP157-026 measured it resident at 3.28 GiB, so it now carries the resident-basis headroom, not the unmeasured safety margin', () => {
    // The OLD test's premise ("still unmeasured") is false, not just its number: gemma2:2b was
    // a 1.18 GB scaled disk ESTIMATE (measured: false) before D-BP157-026; it is now a real
    // `GET /api/ps size_vram` resident reading of 3.28 GiB (measured: true, basis: 'resident').
    // 3.28 + 0.5 (VRAM_RESIDENT_HEADROOM_GB) = 3.78 -> rounds to 3.8. No UNMEASURED_WEIGHT_
    // SAFETY_MARGIN applies, because `measured` is true.
    expect(requiredVramGb('gemma2:2b')).toBe(3.8);
  });

  // A genuine "conservative unmeasured margin" test is not included here: as of D-BP157-026/
  // D-BP157-031, every entry in MODEL_WEIGHTS_GB carries `measured: true` (including
  // llama3.3:70b, whose disk-file size is a real confirmed reading even though it has never
  // been loaded/resident-measured), so UNMEASURED_WEIGHT_SAFETY_MARGIN currently has no live
  // exerciser anywhere in the table -- asserting it against llama3.3:70b would be FALSE (see
  // the describe-block comment above: that would require 55.2, not the correct 48.0). Filing
  // this honestly rather than fabricating a passing assertion for a code path nothing currently
  // exercises.

  test('the ladder is monotonic under the corrected resident-basis numbers: 2b < 9b < 8b-class < 12b < 70b', () => {
    // This test previously asserted the OPPOSITE (gemma2:9b required MORE than gemma4:12b) --
    // that was the double-counted-overhead defect itself, encoded as a "FLAGGED" expectation
    // rather than fixed. D-BP157-031 fixed the root cause (see the describe-block comment
    // above), so the correct assertion is that the ladder is monotonic, not inverted.
    const b2 = requiredVramGb('gemma2:2b')!;
    const b9 = requiredVramGb('gemma2:9b')!;
    const l8 = requiredVramGb('llama3.1:8b')!;
    const b12 = requiredVramGb('gemma4:12b')!;
    const b70 = requiredVramGb('llama3.3:70b')!;
    expect(b2).toBeLessThan(b9);
    expect(b9).toBeLessThan(l8);
    expect(l8).toBeLessThan(b12);
    expect(b12).toBeLessThan(b70);
  });

  test('consequence in the gate: gemma2:9b is REACHABLE as a step-down rung now that its required VRAM is corrected to 7.6 GB', () => {
    // At 8.5 GB: gemma4:12b needs 12.7 (does not fit) -> gemma2:9b needs 7.6, and 8.5 >= 7.6, so
    // it FITS -- the gate lands on gemma2:9b directly, never reaching gemma2:2b. This is the
    // mirror image of the old (defective) expectation: that test encoded the same overhead
    // double-count as the FLAGGED test above, which made gemma2:9b's required VRAM (9.0)
    // wrongly exceed 8.5 and unreachable. Verified by hand against MODEL_STEP_DOWN_LADDER =
    // ['gemma4:12b', 'gemma2:9b', 'gemma2:2b'] and requiredVramGb() as read from source above.
    const result = applyVramGate('gemma4:12b', 8.5);
    expect(result.model).toBe('gemma2:9b');
    expect(result.note).toBeDefined();
  });
});
