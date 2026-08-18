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

describe('requiredVramGb — corrected gemma2:9b weight and conservative-unmeasured margin', () => {
  test('gemma2:9b required VRAM reflects M3\'s measured 7.1 GB resident size (~9.0 GB with overhead)', () => {
    // 7.1 * 1.2 (overhead) + 0.5 (floor) = 9.02 -> rounds to 9.0. Matches the
    // dispatch's own stated "true requirement about 9.02 GB" almost exactly.
    expect(requiredVramGb('gemma2:9b')).toBe(9.0);
  });

  test('gemma2:2b (still unmeasured) carries the extra conservative safety margin', () => {
    // 1.18 * 1.2 + 0.5 = 1.916; * 1.15 conservative margin = 2.2034 -> 2.2.
    expect(requiredVramGb('gemma2:2b')).toBe(2.2);
  });

  test('FLAGGED consequence, asserted honestly rather than hidden: gemma2:9b now requires MORE than gemma4:12b', () => {
    // See the FLAGGED comment block in ram_detector.ts above MODEL_WEIGHTS_GB:
    // gemma4:12b's "measured: true" entry is a disk/weight size, not a
    // resident size, so the two "measured: true" values are not on the same
    // basis. This is a known, filed, NOT-silently-resolved data-quality gap.
    expect(requiredVramGb('gemma2:9b')!).toBeGreaterThan(requiredVramGb('gemma4:12b')!);
  });

  test('consequence in the gate: gemma2:9b is unreachable as a step-down rung — the ladder safely skips it and lands on gemma2:2b', () => {
    // At 8.5 GB: gemma4:12b needs 8.9 (does not fit) -> gemma2:9b needs 9.0
    // (does not fit either, per the flagged finding above) -> gemma2:2b
    // needs 2.2 (fits). The gate degrades safely rather than crashing or
    // recommending a model that needs MORE VRAM than what was rejected.
    const result = applyVramGate('gemma4:12b', 8.5);
    expect(result.model).toBe('gemma2:2b');
    expect(result.note).toBeDefined();
  });
});
