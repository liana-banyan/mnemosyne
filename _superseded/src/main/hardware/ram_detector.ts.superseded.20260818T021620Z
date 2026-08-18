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
 * Detects VRAM in GB (rounded to 1 decimal). Returns null on error or unsupported platform.
 *
 * Windows: Get-CimInstance Win32_VideoController (wmic removed in Win11 24H2/WS2025)
 * macOS: system_profiler SPDisplaysDataType -json → parse spdisplays_vram
 * Linux: nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits
 */
export function detectVramGb(): number | null {
  try {
    const plat = platform();

    if (plat === 'win32') {
      // Win11 24H2 / WS2025: wmic removed. Use Get-CimInstance (works all Windows versions).
      try {
        const psOutput = execSync(
          'powershell -NoProfile -Command "Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty AdapterRAM | Measure-Object -Sum | Select-Object -ExpandProperty Sum"',
          { encoding: 'utf8', timeout: 8000, windowsHide: true }
        );
        const totalBytes = parseInt(psOutput.trim(), 10);
        if (!isNaN(totalBytes) && totalBytes > 0) {
          const gb = totalBytes / (1024 * 1024 * 1024);
          const result = Math.round(gb * 10) / 10;
          console.log(`[ram_detector] VRAM detected via CIM: ${result} GB`);
          return result;
        }
      } catch (err) {
        console.warn('[ram_detector] CIM VRAM detection failed:', err instanceof Error ? err.message : String(err));
      }
      return null;
    } else if (plat === 'darwin') {
      // macOS: system_profiler SPDisplaysDataType -json
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
          // Parse "8192 MB" or "8 GB"
          const match = vramStr.match(/(\d+)\s*(MB|GB)/i);
          if (match) {
            const val = parseInt(match[1], 10);
            const unit = match[2].toUpperCase();
            const gb = unit === 'GB' ? val : val / 1024;
            vrams.push(gb);
          }
        }
      }
      if (vrams.length === 0) return null;
      const maxGb = Math.max(...vrams);
      return Math.round(maxGb * 10) / 10;
    } else if (plat === 'linux') {
      // Linux: nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits
      try {
        const output = execSync('nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits', {
          encoding: 'utf8',
          timeout: 5000,
        });
        const lines = output.split('\n').map(l => l.trim()).filter(Boolean);
        const values = lines.map(v => parseInt(v, 10)).filter(n => !isNaN(n) && n > 0);
        if (values.length === 0) return null;
        const maxMb = Math.max(...values);
        const gb = maxMb / 1024;
        return Math.round(gb * 10) / 10;
      } catch {
        // nvidia-smi not available — return null
        return null;
      }
    }
    return null;
  } catch (err) {
    console.warn('[ram_detector] VRAM detection failed:', err);
    return null;
  }
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
 */
interface ModelWeight {
  gb: number;
  measured: boolean; // false = scaled estimate, not read from a live source
}

const MODEL_WEIGHTS_GB: Record<string, ModelWeight> = {
  'gemma2:2b': { gb: 1.18, measured: false },   // scaled estimate (not pulled on M0)
  'gemma2:9b': { gb: 5.32, measured: false },   // scaled estimate (not pulled on M0)
  'gemma4:12b': { gb: 7.04, measured: true },   // live /api/tags size, 2026-08-16
  'llama3.1:8b': { gb: 4.58, measured: true },  // live /api/tags size, 2026-08-16
  'llama3.3:70b': { gb: 39.60, measured: true }, // live /api/tags size, 2026-08-16
};

const VRAM_OVERHEAD_FACTOR = 1.2;
const VRAM_OVERHEAD_FLOOR_GB = 0.5;

/** Required VRAM (GB) for a model, or null if the model isn't in the measured/estimated table. */
export function requiredVramGb(model: string): number | null {
  const w = MODEL_WEIGHTS_GB[model];
  if (!w) return null;
  return Math.round((w.gb * VRAM_OVERHEAD_FACTOR + VRAM_OVERHEAD_FLOOR_GB) * 10) / 10;
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
