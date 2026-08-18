/**
 * ram_detector.ts — v0.5.18 M18b
 *
 * Detects available system RAM + VRAM and returns the hardware tier for model selection.
 * Cooperative-class onboarding: auto-detect and recommend — never guess, never fail silently.
 * Right-sized per 1 Cor 12 — each peer contributes what its hardware can carry.
 */

import { totalmem, platform } from 'os';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';

// New tier system — BP091 canon §3.1 + Amendment (5-tier user-facing)
export type HardwareTier = 'nano' | 'lite' | 'core' | 'full' | 'ultra';
export type CoopTier = 'NANO' | 'LITE' | 'CORE' | 'FULL' | 'ULTRA';

export interface RightSize {
  ramTier: HardwareTier;
  model: string | null;       // null = nano (no local model, read-only)
  coopTier: CoopTier;
  readOnly?: boolean;
  note?: string;
  overrideActive?: boolean;   // true if config override is active
  autoRecommendedModel?: string | null; // what auto-detect would have chosen (null for nano)
}

export interface HardwareTierInfo {
  tier: HardwareTier;
  ramGb: number;
  vramGb: number | null;
  recommendedModel: string | null;  // null for nano tier
  coopTier: CoopTier;
  displayName: string;
  description: string;
  mmluProExpected: string;
}

// New tier definitions — BP091 canon §3.1 + Amendment (5-tier user-facing)
const TIER_DEFS: Record<HardwareTier, Omit<HardwareTierInfo, 'tier' | 'ramGb' | 'vramGb'>> = {
  'nano': {
    recommendedModel: null,
    coopTier: 'NANO',
    displayName: 'NANO',
    description: 'Mesh participation only · no local model',
    mmluProExpected: 'N/A (read-only)',
  },
  'lite': {
    recommendedModel: 'gemma2:2b',
    coopTier: 'LITE',
    displayName: 'LITE',
    description: 'Lightweight · fleet ready · gemma2:2b',
    mmluProExpected: '~50-70% MMLU-Pro (substrate-compensated)',
  },
  'core': {
    recommendedModel: 'gemma2:9b',
    coopTier: 'CORE',
    displayName: 'CORE',
    description: 'Right-sized for your hardware · gemma2:9b',
    mmluProExpected: '~85-92% MMLU-Pro',
  },
  'full': {
    recommendedModel: 'gemma4:12b',
    coopTier: 'FULL',
    displayName: 'FULL',
    description: 'Flagship model · gemma4:12b · 97.1% MMLU-Pro',
    mmluProExpected: '97.1% MMLU-Pro (Founder M0 canonical)',
  },
  'ultra': {
    recommendedModel: 'gemma4:12b',
    coopTier: 'ULTRA',
    displayName: 'ULTRA',
    description: 'Maximum cooperative reasoning · 48+ GB',
    mmluProExpected: '97.1% MMLU-Pro (research-grade capacity)',
  },
};

/**
 * Returns total system RAM in GB (rounded to 1 decimal).
 */
export function getTotalRamGb(): number {
  return Math.round((totalmem() / (1024 * 1024 * 1024)) * 10) / 10;
}

/**
 * ── VRAM detector rewrite ──────────────────────────────────────────────
 * D-BP157-025 / BISHOP / seg-fix-vram-detector
 *
 * MEASURED DEFECT (see BISHOP_DROPZONE/SEG_RETURN_BP157_021_VRAM_GATE.md and
 * this dispatch's own return, SEG_RETURN_BP157_025_VRAM_DETECTOR_FIX.md):
 * Win32_VideoController.AdapterRAM is a 32-bit (uint32) CIM field. Any card
 * with real VRAM above ~4 GiB reports a wrapped/capped value near the
 * ceiling instead of its true size. MEASURED on M3 (RTX 3070, real 8192
 * MiB -> reported 4095 MiB) and independently MEASURED on M0 (RX 9070 XT,
 * real ~16 GB -> reported 4095 MiB, the SAME byte value 4,293,918,720 as
 * M3's card) -- two different vendors, two different real capacities, the
 * identical wrong number. This is a Windows CIM platform defect, not an
 * NVIDIA-specific or card-specific one. M0 also has NO nvidia-smi on PATH
 * at all (verified: not on PATH, direct invocation fails), so any fix
 * relying on nvidia-smi as ground truth is wrong for this estate.
 *
 * FIX: primary source is the 64-bit registry value
 * HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-
 * 08002be10318}\<NNNN>\HardwareInformation.qwMemorySize, per adapter
 * subkey. MEASURED on M0 (D-BP157-025): RX 9070 XT registry value =
 * 17,095,983,104 bytes = 15.92 GB (correct, vs. AdapterRAM's wrong 4095
 * MiB); integrated AMD GPU registry value = 2,147,483,648 bytes = 2.00 GB,
 * which EXACTLY MATCHES its own (uncapped, below-ceiling) AdapterRAM
 * reading -- proof the CIM field is accurate only strictly below the
 * ceiling, and proof the registry field is the trustworthy 64-bit
 * superset. No new dependency, no new shipped binary: this is a stock
 * Windows registry value read via the same execSync+powershell mechanism
 * already used here. A GPU perf-counter path (`Get-Counter 'GPU Adapter
 * Memory'`) was also tried and MEASURED to expose current *usage* in
 * bytes (e.g. a live "Dedicated Usage" instance reading 4,344,918,016
 * bytes at the moment queried), not total *capacity* -- unusable for this
 * purpose, ruled out. CIM AdapterRAM is kept only as a last-resort
 * fallback (registry key missing/inaccessible), with any reading at or
 * above the measured ceiling zone treated as unreliable and rejected
 * rather than trusted -- see CIM_ADAPTERRAM_SUSPECT_CEILING_BYTES below.
 * nvidia-smi, when present, is consulted ONLY as an optional corroborator
 * (logged, never assigned as the returned value) -- required because M0
 * has none at all and an NVIDIA-only method is not vendor-agnostic.
 */

/** One GPU adapter's raw readings, gathered from whichever Windows sources succeeded. */
export interface GpuAdapterReading {
  name: string;
  /** HardwareInformation.qwMemorySize — 64-bit, trustworthy, no known ceiling. */
  registryBytes?: number | null;
  /** Win32_VideoController.AdapterRAM — 32-bit (uint32), capped near 4 GiB. */
  cimAdapterRamBytes?: number | null;
}

export type VramDetectionMethod =
  | 'registry'
  | 'cim'
  | 'cim-capped-rejected'
  | 'macos-system-profiler'
  | 'linux-nvidia-smi'
  | 'none';

export interface VramDetectionResult {
  vramGb: number | null;
  method: VramDetectionMethod;
  /** 'measured' = trustworthy source (registry, or a below-ceiling CIM reading on its own).
   *  'low' = a usable but less-trusted source. 'unknown' = genuinely could not tell —
   *  never a plausible-looking wrong number, never a silent zero. */
  confidence: 'measured' | 'low' | 'unknown';
  note?: string;
  adapters?: Array<{ name: string; gb: number | null; source: string }>;
}

// MEASURED, D-BP157-025: two different real cards (RTX 3070 8192 MiB on M3;
// RX 9070 XT ~16 GB on M0) both report the identical capped AdapterRAM value
// 4,293,918,720 bytes (4095 MiB) — the Windows uint32 ceiling. A correctly
// reporting adapter well below the ceiling (M0's integrated GPU, 2 GiB) is
// NOT affected: its AdapterRAM matches its own registry value exactly. Any
// AdapterRAM reading at or above this threshold is therefore treated as
// unreliable and rejected rather than trusted as a real number.
const CIM_ADAPTERRAM_SUSPECT_CEILING_BYTES = 4_000_000_000; // ~3.73 GiB

function bytesToGbRounded(bytes: number): number {
  return Math.round((bytes / (1024 * 1024 * 1024)) * 10) / 10;
}

/**
 * Pure decision function — takes already-gathered adapter readings (real or
 * injected for tests) and decides the VRAM figure. No process execution
 * here, which is what makes this unit-testable offline (see
 * ram_detector.vram_detect.test.ts).
 *
 * Multi-adapter policy: uses the LARGEST single adapter's VRAM, never a sum.
 * MEASURED, D-BP157-021/025: this machine has a dGPU + an iGPU; summing
 * their capacities (the OLD code's `Measure-Object -Sum`) both compounds the
 * uint32 undercount AND is conceptually wrong — a model runs on one adapter,
 * not the total of all adapters in the box.
 */
export function resolveVramFromWindowsAdapters(adapters: GpuAdapterReading[]): VramDetectionResult {
  if (!adapters || adapters.length === 0) {
    return {
      vramGb: null,
      method: 'none',
      confidence: 'unknown',
      note: 'No GPU adapters found on this machine (no discrete or integrated GPU detected) — not zero, genuinely unknown/absent',
      adapters: [],
    };
  }

  const perAdapter = adapters.map((a) => {
    if (typeof a.registryBytes === 'number' && a.registryBytes > 0) {
      return { name: a.name, gb: bytesToGbRounded(a.registryBytes), source: 'registry' };
    }
    if (typeof a.cimAdapterRamBytes === 'number' && a.cimAdapterRamBytes > 0) {
      if (a.cimAdapterRamBytes >= CIM_ADAPTERRAM_SUSPECT_CEILING_BYTES) {
        return { name: a.name, gb: null, source: 'cim-capped-rejected' };
      }
      return { name: a.name, gb: bytesToGbRounded(a.cimAdapterRamBytes), source: 'cim' };
    }
    return { name: a.name, gb: null, source: 'none' };
  });

  const known = perAdapter.filter((a) => a.gb !== null) as Array<{ name: string; gb: number; source: string }>;

  if (known.length === 0) {
    const anyCapped = perAdapter.some((a) => a.source === 'cim-capped-rejected');
    return {
      vramGb: null,
      method: anyCapped ? 'cim-capped-rejected' : 'none',
      confidence: 'unknown',
      note: anyCapped
        ? 'Every adapter\'s AdapterRAM reading sits at/above the Windows uint32 ~4 GiB ceiling and no 64-bit registry value was available — reporting unknown rather than the capped, likely-wrong number'
        : 'No usable VRAM reading from any detected adapter',
      adapters: perAdapter,
    };
  }

  const best = known.reduce((a, b) => (b.gb > a.gb ? b : a));
  const usedRegistryOnly = known.every((a) => a.source === 'registry');

  return {
    vramGb: best.gb,
    method: usedRegistryOnly ? 'registry' : 'cim',
    confidence: usedRegistryOnly ? 'measured' : 'low',
    note:
      known.length > 1
        ? `Multiple adapters detected (${known.map((a) => `${a.name}: ${a.gb} GB via ${a.source}`).join(', ')}); using the largest single adapter, not summed`
        : undefined,
    adapters: perAdapter,
  };
}

/** Impure: gathers real adapter data via the 64-bit registry value. Returns null on any failure. */
function queryWindowsAdaptersViaRegistry(): GpuAdapterReading[] | null {
  try {
    const script = [
      "$base = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'",
      '$results = @()',
      'Get-ChildItem $base -ErrorAction SilentlyContinue | ForEach-Object {',
      '  $p = Get-ItemProperty -Path $_.PSPath -ErrorAction SilentlyContinue',
      "  $qw = $p.'HardwareInformation.qwMemorySize'",
      '  if ($qw -and $p.DriverDesc) {',
      '    $results += [PSCustomObject]@{ Name = $p.DriverDesc; Bytes = [int64]$qw }',
      '  }',
      '}',
      "if ($results.Count -eq 0) { Write-Output '[]' } else { $results | ConvertTo-Json -Compress }",
    ].join('\n');
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    const out = execSync(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`, {
      encoding: 'utf8',
      timeout: 8000,
      windowsHide: true,
    });
    const trimmed = out.trim();
    if (!trimmed) return null;
    const parsed = JSON.parse(trimmed);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    return arr.map((x: { Name?: unknown; Bytes?: unknown }) => ({
      name: String(x.Name),
      registryBytes: Number(x.Bytes),
    }));
  } catch (err) {
    console.warn('[ram_detector] Registry VRAM query failed:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

/** Impure: gathers real adapter data via CIM AdapterRAM (last-resort fallback only). */
function queryWindowsAdaptersViaCim(): GpuAdapterReading[] | null {
  try {
    const out = execSync(
      'powershell -NoProfile -Command "Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM | ConvertTo-Json -Compress"',
      { encoding: 'utf8', timeout: 8000, windowsHide: true }
    );
    const trimmed = out.trim();
    if (!trimmed) return null;
    const parsed = JSON.parse(trimmed);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    return arr.map((x: { Name?: unknown; AdapterRAM?: unknown }) => ({
      name: String(x.Name),
      cimAdapterRamBytes: typeof x.AdapterRAM === 'number' ? x.AdapterRAM : null,
    }));
  } catch (err) {
    console.warn('[ram_detector] CIM VRAM query failed:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

/** Impure: nvidia-smi, corroboration only — never the primary source, never the returned value. */
function queryNvidiaSmiTotalGb(): number | null {
  try {
    const out = execSync('nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits', {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
    });
    const lines = out.split('\n').map((l) => l.trim()).filter(Boolean);
    const values = lines.map((v) => parseInt(v, 10)).filter((n) => !isNaN(n) && n > 0);
    if (values.length === 0) return null;
    return Math.round((Math.max(...values) / 1024) * 10) / 10;
  } catch {
    // Not present or not an NVIDIA box — expected and normal on much of this
    // estate's hardware (M0 has none at all). Not an error condition.
    return null;
  }
}

/**
 * Full detection result: method used, confidence, and an honest note.
 * See detectVramGb() below for the backward-compatible number|null wrapper
 * every existing caller in this file uses.
 */
export function detectVramGbDetailed(): VramDetectionResult {
  try {
    const plat = platform();

    if (plat === 'win32') {
      const registryAdapters = queryWindowsAdaptersViaRegistry();
      let result: VramDetectionResult;

      if (registryAdapters && registryAdapters.length > 0) {
        result = resolveVramFromWindowsAdapters(registryAdapters);
      } else {
        const cimAdapters = queryWindowsAdaptersViaCim();
        result =
          cimAdapters && cimAdapters.length > 0
            ? resolveVramFromWindowsAdapters(cimAdapters)
            : {
                vramGb: null,
                method: 'none',
                confidence: 'unknown',
                note: 'No GPU adapter data available from either the registry or CIM',
                adapters: [],
              };
      }

      // Corroboration only — logged, never assigned to result.vramGb.
      const nvidiaGb = queryNvidiaSmiTotalGb();
      if (nvidiaGb !== null) {
        if (result.vramGb === null) {
          console.log(
            `[ram_detector] nvidia-smi reports ${nvidiaGb} GB, but primary detection found no usable reading; nvidia-smi is corroboration-only and is not substituted in as the value`
          );
        } else if (Math.abs(result.vramGb - nvidiaGb) > 0.5) {
          console.warn(
            `[ram_detector] nvidia-smi (${nvidiaGb} GB) disagrees with ${result.method} (${result.vramGb} GB) by more than 0.5 GB`
          );
        } else {
          console.log(`[ram_detector] nvidia-smi corroborates ${result.method}: ${nvidiaGb} GB vs ${result.vramGb} GB`);
        }
      }

      console.log(
        `[ram_detector] VRAM detected via ${result.method} (confidence: ${result.confidence}): ${result.vramGb ?? 'unknown'} GB`
      );
      return result;
    } else if (plat === 'darwin') {
      // macOS: system_profiler SPDisplaysDataType -json — unaffected by the
      // Windows uint32 defect this dispatch targets; left as-is, not
      // empirically retested this session (no macOS box available).
      try {
        const output = execSync('system_profiler SPDisplaysDataType -json', {
          encoding: 'utf8',
          timeout: 5000,
        });
        const data = JSON.parse(output);
        const displays = data?.SPDisplaysDataType || [];
        const vrams: number[] = [];
        for (const display of displays) {
          const vramStr = display?.spdisplays_vram || display?.spdisplays_vram_shared;
          if (vramStr) {
            const match = vramStr.match(/(\d+)\s*(MB|GB)/i);
            if (match) {
              const val = parseInt(match[1], 10);
              const unit = match[2].toUpperCase();
              const gb = unit === 'GB' ? val : val / 1024;
              vrams.push(gb);
            }
          }
        }
        if (vrams.length === 0) {
          return { vramGb: null, method: 'macos-system-profiler', confidence: 'unknown', note: 'No display VRAM entries parsed from system_profiler output' };
        }
        const maxGb = Math.round(Math.max(...vrams) * 10) / 10;
        return { vramGb: maxGb, method: 'macos-system-profiler', confidence: 'measured' };
      } catch (err) {
        return { vramGb: null, method: 'macos-system-profiler', confidence: 'unknown', note: `system_profiler failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    } else if (plat === 'linux') {
      // Linux: nvidia-smi is the only source here (unchanged) — left as-is,
      // out of this dispatch's scope (Windows CIM defect only). A non-NVIDIA
      // Linux box degrades honestly to unknown, same as before.
      try {
        const output = execSync('nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits', {
          encoding: 'utf8',
          timeout: 5000,
        });
        const lines = output.split('\n').map((l) => l.trim()).filter(Boolean);
        const values = lines.map((v) => parseInt(v, 10)).filter((n) => !isNaN(n) && n > 0);
        if (values.length === 0) {
          return { vramGb: null, method: 'linux-nvidia-smi', confidence: 'unknown', note: 'nvidia-smi returned no parseable values' };
        }
        const maxMb = Math.max(...values);
        const gb = Math.round((maxMb / 1024) * 10) / 10;
        return { vramGb: gb, method: 'linux-nvidia-smi', confidence: 'measured' };
      } catch {
        return { vramGb: null, method: 'linux-nvidia-smi', confidence: 'unknown', note: 'nvidia-smi not available (not present, or no NVIDIA GPU) — not zero, genuinely unknown' };
      }
    }
    return { vramGb: null, method: 'none', confidence: 'unknown', note: `Unsupported platform: ${plat}` };
  } catch (err) {
    console.warn('[ram_detector] VRAM detection failed:', err);
    return { vramGb: null, method: 'none', confidence: 'unknown', note: `Detection threw: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Detects VRAM in GB (rounded to 1 decimal). Returns null on error, unsupported
 * platform, or when detection genuinely cannot tell — NEVER a plausible-looking
 * wrong number, NEVER a silent zero. Backward-compatible number|null surface
 * for every existing caller in this file (rightSize, detectHardwareTierFull,
 * resolveEffectiveModel, getAllTiers). Use detectVramGbDetailed() for the full
 * method/confidence/note breakdown.
 */
export function detectVramGb(): number | null {
  return detectVramGbDetailed().vramGb;
}

/**
 * ── VRAM gate ──────────────────────────────────────────────────────────
 * D-BP155-051 / BISHOP / seg-vram-gates-model
 *
 * The Founder's ruling (memory: reference_m3_uses_gemma2_9b_vram_bound_not_
 * ram_bound_bp155.md): model capacity is governed by VRAM, not system RAM.
 * M3 (TERENO, 31.9 GB system RAM -> 'full' RAM tier) has gemma4:12b PULLED
 * but must never run it there -- insufficient VRAM forces Ollama into a
 * ~70/30 GPU/CPU split that is unusably slow. M3 runs gemma2:9b instead.
 * RAM alone said "full tier -> gemma4:12b"; VRAM is what actually gates it.
 *
 * Measured model weight sizes -- live GET http://127.0.0.1:11434/api/tags
 * on M0 (LIANABANYAN), 2026-08-16, "size" field (bytes on disk):
 *   llama3.3:70b   42,520,413,916 B = 39.60 GB  (measured, Q4_K_M, 70.6B params)
 *   gemma4:12b      7,556,508,396 B =  7.04 GB  (measured, Q4_K_M, 11.9B params)
 *   llama3.1:8b     4,920,753,328 B =  4.58 GB  (measured, Q4_K_M, 8.0B params)
 * gemma2:9b and gemma2:2b are NOT pulled on M0 (confirmed via `ollama list`
 * and a live /api/show 404 "model not found"), so their weight size could
 * NOT be measured in this environment. Their figures below are ESTIMATES,
 * not measurements: scaled from gemma4:12b's measured Q4_K_M density
 * (7.04 GB / 11.9B params = 0.591 GB/B) applied to each model's nominal
 * parameter count (9B, 2B). Named explicitly rather than presented as a
 * measurement -- see MODEL_WEIGHTS_GB.measured below.
 *
 * Overhead allowance (a stated allowance, not a measurement -- this
 * environment has no GPU memory profiler to observe live inference VRAM
 * use): weight size x 1.2 (20% for KV-cache + activation buffer at
 * moderate context) + a flat 0.5 GB floor for driver/runtime overhead.
 * Deliberately conservative: this gate only needs to tell "fits" from
 * "doesn't fit", not predict an exact byte count.
 *
 * Check against the Founder's own datapoint: required(gemma4:12b) = 8.9 GB,
 * required(gemma2:9b) = 6.9 GB. M3's VRAM sits between those two figures
 * (constrained dedicated GPU, well short of the 8.9 GB gemma4:12b needs,
 * comfortably above the 6.9 GB gemma2:9b needs) -- so the gate steps
 * gemma4:12b down to gemma2:9b there, matching the ruling. See the M3 test
 * case for the exact assumed VRAM figure used and why it is not a live
 * measurement of that remote machine.
 *
 * FLAGGED, NOT RESOLVED -- D-BP157-025 / BISHOP / seg-fix-vram-detector,
 * task 4: gemma2:9b's weight below was corrected from a scaled estimate
 * (5.32 GB) to M3's MEASURED live resident size (7.1 GB, via `ollama ps`),
 * which the task specified directly and which was 33.5% above the old
 * estimate. Running 7.1 GB through the SAME overhead formula below yields
 * required(gemma2:9b) = 9.0 GB -- which now slightly EXCEEDS
 * required(gemma4:12b) = 8.9 GB, inverting the "Check against..." paragraph
 * above. Root cause: gemma4:12b/llama3.1:8b/llama3.3:70b's `measured: true`
 * entries are disk/weight file sizes (live GET /api/tags "size" field), NOT
 * resident runtime VRAM; gemma2:9b's corrected entry is now the ONLY one
 * measured on a resident-memory basis. The two kinds of "measured: true"
 * are not on the same basis, and the apparent inversion may be partly (or
 * wholly) an artifact of that units mismatch rather than gemma2:9b
 * genuinely needing more headroom than gemma4:12b. PRACTICAL CONSEQUENCE:
 * with the corrected numbers, there is no VRAM value where gemma4:12b
 * fails to fit (needs less than 8.9 GB) while gemma2:9b fits (needs at
 * least 9.0 GB) -- the gate's step-down loop, unchanged, still degrades
 * safely by skipping the non-fitting gemma2:9b rung and landing on
 * gemma2:2b instead (see ram_detector.vram_detect.test.ts for this exact
 * scenario asserted). This SEG's scope is the detector + honest weights,
 * NOT redesigning the tier ladder or re-measuring gemma4:12b's resident
 * VRAM the same way -- both are explicitly OUT OF SCOPE here and are filed
 * for a follow-up SEG rather than silently patched. Left un-silently: this
 * comment, plus SEG_RETURN_BP157_025_VRAM_DETECTOR_FIX.md.
 */
interface ModelWeight {
  gb: number;
  measured: boolean; // false = scaled estimate, not read from a live source
}

const MODEL_WEIGHTS_GB: Record<string, ModelWeight> = {
  'gemma2:2b': { gb: 1.18, measured: false },   // scaled estimate (not pulled on M0) -- unmeasured, gets the conservative margin below
  // CORRECTED D-BP157-025: was 5.32 GB (scaled disk-weight estimate). MEASURED
  // by M3 via live `ollama ps` resident size = 7.1 GB, 33.5% above the old
  // estimate. See the FLAGGED comment above this table for the consequence
  // (gemma4:12b's own entry is disk-weight, not resident, so the two
  // "measured: true" values are not on the same basis -- not resolved here).
  'gemma2:9b': { gb: 7.1, measured: true },     // measured: M3 `ollama ps` resident size, D-BP157-025
  'gemma4:12b': { gb: 7.04, measured: true },   // live /api/tags size, 2026-08-16
  'llama3.1:8b': { gb: 4.58, measured: true },  // live /api/tags size, 2026-08-16
  'llama3.3:70b': { gb: 39.60, measured: true }, // live /api/tags size, 2026-08-16
};

const VRAM_OVERHEAD_FACTOR = 1.2;
const VRAM_OVERHEAD_FLOOR_GB = 0.5;
// D-BP157-025 task 4: an unmeasured weight must be treated conservatively,
// not optimistically -- a wrong-low estimate would let the gate say a model
// "fits" when it might not, the exact failure class this gate exists to
// prevent. Applied as an extra multiplier on TOP of the standard overhead
// factor, only when the weight itself is a scaled estimate (measured: false).
const UNMEASURED_WEIGHT_SAFETY_MARGIN = 1.15;

/** Required VRAM (GB) for a model, or null if the model isn't in the measured/estimated table. */
export function requiredVramGb(model: string): number | null {
  const w = MODEL_WEIGHTS_GB[model];
  if (!w) return null;
  const base = w.gb * VRAM_OVERHEAD_FACTOR + VRAM_OVERHEAD_FLOOR_GB;
  const withMargin = w.measured ? base : base * UNMEASURED_WEIGHT_SAFETY_MARGIN;
  return Math.round(withMargin * 10) / 10;
}

// Largest-to-smallest step-down ladder used when detected VRAM can't hold
// the RAM tier's raw recommendation. applyVramGate walks DOWN this list
// from whatever model the RAM tier picked, looking for the first one that fits.
const MODEL_STEP_DOWN_LADDER = ['gemma4:12b', 'gemma2:9b', 'gemma2:2b'];

export interface VramGateResult {
  model: string | null;
  note?: string;
}

/**
 * Gates a RAM-tier's raw model recommendation against detected VRAM.
 * - tierModel === null (nano) passes through untouched -- nothing to gate.
 * - vramGb === null (detection failed or unsupported platform) is UNKNOWN,
 *   NOT zero -- falls back to the RAM-tier recommendation with an honest
 *   note so a human can tell "no GPU" from "couldn't measure".
 * - Otherwise steps down the ladder until a model whose required VRAM
 *   fits, naming both the RAM-tier recommendation and the VRAM-constrained
 *   choice in the note. A silent downgrade is the defect this exists to prevent.
 */
export function applyVramGate(tierModel: string | null, vramGb: number | null): VramGateResult {
  if (tierModel === null) return { model: null };

  if (vramGb === null) {
    return {
      model: tierModel,
      note: 'VRAM undetectable (no GPU or detection failed) -- using RAM-tier recommendation',
    };
  }

  const required = requiredVramGb(tierModel);
  if (required === null || vramGb >= required) {
    return { model: tierModel };
  }

  const ladderIdx = MODEL_STEP_DOWN_LADDER.indexOf(tierModel);
  if (ladderIdx === -1) {
    return {
      model: tierModel,
      note: `VRAM (${vramGb} GB) may be insufficient for ${tierModel} (needs ~${required} GB); no smaller fallback known for this model`,
    };
  }

  for (let i = ladderIdx + 1; i < MODEL_STEP_DOWN_LADDER.length; i++) {
    const candidate = MODEL_STEP_DOWN_LADDER[i];
    const candRequired = requiredVramGb(candidate);
    if (candRequired !== null && vramGb >= candRequired) {
      return {
        model: candidate,
        note: `RAM tier recommends ${tierModel} (needs ~${required} GB VRAM); detected VRAM ${vramGb} GB is insufficient -- stepped down to ${candidate}`,
      };
    }
  }

  const floor = MODEL_STEP_DOWN_LADDER[MODEL_STEP_DOWN_LADDER.length - 1];
  return {
    model: floor,
    note: `RAM tier recommends ${tierModel} (needs ~${required} GB VRAM); detected VRAM ${vramGb} GB is insufficient even for the smallest fallback ${floor} -- expect CPU-split slowdown`,
  };
}

/**
 * Right-size lookup — BP091 canon §3.1 + Amendment (5-tier user-facing).
 * Maps RAM + VRAM to hardware tier + recommended model. RAM decides the
 * TIER (and coopTier, unchanged by this gate — those feed membership and
 * pricing elsewhere); VRAM now gates the MODEL selection within that tier
 * via applyVramGate, stepping down when detected VRAM can't hold the
 * tier's raw pick. See the VRAM gate block above for the full rationale.
 *
 * 5-tier system: NANO → LITE → CORE → FULL → ULTRA
 *
 * RAM thresholds (unchanged):
 *   ramGb < 8        → nano  · null        · NANO (read-only)
 *   8 <= ramGb < 12  → lite  · gemma2:2b   · LITE
 *   12 <= ramGb < 24 → core  · gemma2:9b   · CORE
 *   24 <= ramGb < 48 → full  · gemma4:12b  · FULL  (VRAM-gated, may step down)
 *   ramGb >= 48      → ultra · gemma4:12b  · ULTRA (VRAM-gated, may step down)
 *
 * Example: Son's machine (15.8 GB RAM) → CORE → gemma2:9b.
 * Example: M3/TERENO (31.9 GB RAM) → FULL tier's raw pick is gemma4:12b,
 * but M3's constrained VRAM steps the model down to gemma2:9b — see the
 * VRAM gate block above and the M3 test case.
 * Example: M0/LIANABANYAN (61.6 GB RAM) → ULTRA → gemma4:12b (ample VRAM).
 */
export function rightSize(ramGb: number, vramGb: number | null): RightSize {
  // Check for config override first — key is "override_model" (not "model")
  const overrideFile = join(app.getPath('home'), '.mnemosynec', 'right-size.json');
  let overrideModel: string | null = null;
  if (existsSync(overrideFile)) {
    try {
      const cfg = JSON.parse(readFileSync(overrideFile, 'utf8'));
      if (cfg?.override_model && typeof cfg.override_model === 'string') {
        overrideModel = cfg.override_model;
      }
    } catch {
      // ignore
    }
  }

  let ramTier: HardwareTier;
  let tierModel: string | null; // RAM tier's raw recommendation, BEFORE the VRAM gate
  let coopTier: CoopTier;

  if (ramGb < 8) {
    ramTier = 'nano';
    tierModel = null;
    coopTier = 'NANO';
  } else if (ramGb < 12) {
    ramTier = 'lite';
    tierModel = 'gemma2:2b';
    coopTier = 'LITE';
  } else if (ramGb < 24) {
    ramTier = 'core';
    tierModel = 'gemma2:9b';
    coopTier = 'CORE';
  } else if (ramGb < 48) {
    ramTier = 'full';
    tierModel = 'gemma4:12b';
    coopTier = 'FULL';
  } else {
    ramTier = 'ultra';
    tierModel = 'gemma4:12b';
    coopTier = 'ULTRA';
  }

  let autoModel: string | null;
  let note: string | undefined;

  if (ramTier === 'nano') {
    autoModel = null;
    note = 'Mesh participation only';
  } else {
    const gated = applyVramGate(tierModel, vramGb);
    autoModel = gated.model;
    note = gated.note;
  }

  // An explicit override always wins over the VRAM gate — a human's
  // deliberate choice is never silently overridden — but if the override
  // exceeds detected VRAM, surface a warning instead of downgrading it.
  if (overrideModel && vramGb !== null) {
    const overrideRequired = requiredVramGb(overrideModel);
    if (overrideRequired !== null && vramGb < overrideRequired) {
      note = `Override "${overrideModel}" needs ~${overrideRequired} GB VRAM; detected VRAM ${vramGb} GB is below that — expect CPU-split slowdown`;
    }
  }

  return {
    ramTier,
    model: overrideModel || autoModel,
    coopTier,
    readOnly: ramTier === 'nano',
    note,
    overrideActive: overrideModel !== null,
    autoRecommendedModel: autoModel,
  };
}

/**
 * Returns the full tier info for the current machine (with VRAM detection).
 */
export function detectHardwareTierFull(): HardwareTierInfo {
  const ramGb = getTotalRamGb();
  const vramGb = detectVramGb();
  const rs = rightSize(ramGb, vramGb);
  const tierDef = TIER_DEFS[rs.ramTier];
  return {
    tier: rs.ramTier,
    ramGb,
    vramGb,
    recommendedModel: rs.autoRecommendedModel ?? null,
    coopTier: rs.coopTier,
    displayName: tierDef.displayName,
    description: tierDef.description,
    mmluProExpected: tierDef.mmluProExpected,
  };
}

/**
 * Backward-compat: returns the full tier info (old API — now includes VRAM).
 */
export function detectHardwareTier(): HardwareTierInfo {
  return detectHardwareTierFull();
}

/**
 * Backward-compat: returns just the recommended model name for the current machine.
 */
export function getRecommendedModel(): string | null {
  return detectHardwareTierFull().recommendedModel;
}

// ── resolveEffectiveModel — async, validates override against ollama ──────────

export interface EffectiveModelResult {
  model: string | null;
  tier: CoopTier;
  overrideActive: boolean;
  overrideReason?: string;
  autoDetectedModel: string | null;
  warning?: string;
}

async function validateModelExists(modelName: string): Promise<boolean> {
  try {
    const resp = await fetch('http://localhost:11434/api/tags');
    if (!resp.ok) return false;
    const data = await resp.json() as { models: Array<{ name: string }> };
    return data.models.some(
      (m) => m.name === modelName || m.name.startsWith(modelName + ':')
    );
  } catch {
    return false;
  }
}

function resolveOverrideTier(model: string, ramGb: number, vramGb: number | null): CoopTier {
  if (model.includes('70b')) return 'ULTRA';
  if (model.includes('12b')) return 'FULL';
  if (model.includes('9b')) return 'CORE';
  if (model.includes('2b')) return 'LITE';
  return rightSize(ramGb, vramGb).coopTier;
}

/**
 * Resolves the effective model to use, honoring right-size.json override if valid.
 * Returns full context for IPC + peer_presence wiring.
 */
export async function resolveEffectiveModel(): Promise<EffectiveModelResult> {
  const ramGb = getTotalRamGb();
  const vramGb = detectVramGb();
  const auto = rightSize(ramGb, vramGb);
  const autoModel = auto.autoRecommendedModel ?? null;
  const autoTier = auto.coopTier;

  const overrideFile = join(app.getPath('home'), '.mnemosynec', 'right-size.json');
  let overrideData: { override_model?: string; override_reason?: string } | null = null;
  if (existsSync(overrideFile)) {
    try {
      overrideData = JSON.parse(readFileSync(overrideFile, 'utf8'));
    } catch {
      overrideData = null;
    }
  }

  const overrideModel = overrideData?.override_model?.trim() || null;
  if (!overrideModel) {
    return { model: autoModel, tier: autoTier, overrideActive: false, autoDetectedModel: autoModel };
  }

  const exists = await validateModelExists(overrideModel);
  if (!exists) {
    const warning = `Override model "${overrideModel}" not found in ollama. Auto-selecting "${autoModel ?? 'none'}". Run: ollama pull ${overrideModel}`;
    console.warn('[right-size]', warning);
    return { model: autoModel, tier: autoTier, overrideActive: false, autoDetectedModel: autoModel, warning };
  }

  return {
    model: overrideModel,
    tier: resolveOverrideTier(overrideModel, ramGb, vramGb),
    overrideActive: true,
    overrideReason: overrideData?.override_reason,
    autoDetectedModel: autoModel,
  };
}

// Module-level cache — set once at app startup by main process
let _cachedEffectiveModel: EffectiveModelResult | null = null;

export function setCachedEffectiveModel(result: EffectiveModelResult): void {
  _cachedEffectiveModel = result;
}

export function getCachedEffectiveModel(): EffectiveModelResult | null {
  return _cachedEffectiveModel;
}

/**
 * All tier definitions — for Settings UI display (5-tier ascending order).
 */
export function getAllTiers(): HardwareTierInfo[] {
  const ramGb = getTotalRamGb();
  const vramGb = detectVramGb();
  return (['nano', 'lite', 'core', 'full', 'ultra'] as HardwareTier[]).map((tier) => {
    const def = TIER_DEFS[tier];
    return {
      tier,
      ramGb,
      vramGb,
      recommendedModel: def.recommendedModel,
      coopTier: def.coopTier,
      displayName: def.displayName,
      description: def.description,
      mmluProExpected: def.mmluProExpected,
    };
  });
}
