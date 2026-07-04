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
 * Right-size lookup — BP091 canon §3.1 + Amendment (5-tier user-facing).
 * Maps RAM + VRAM to hardware tier + recommended model.
 *
 * 5-tier system: NANO → LITE → CORE → FULL → ULTRA
 *
 * Thresholds:
 *   ramGb < 8        → nano  · null        · NANO (read-only)
 *   8 <= ramGb < 12  → lite  · gemma2:2b   · LITE
 *   12 <= ramGb < 24 → core  · gemma2:9b   · CORE
 *   24 <= ramGb < 48 → full  · gemma4:12b  · FULL  (VRAM-aware sub-routing for logs)
 *   ramGb >= 48      → ultra · gemma4:12b  · ULTRA
 *
 * Example: Son's machine (15.8 GB RAM) → CORE → gemma2:9b.
 * Example: Founder's machine (31.9 GB RAM) → FULL → gemma4:12b.
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
  let autoModel: string | null;
  let coopTier: CoopTier;
  let note: string | undefined;

  if (ramGb < 8) {
    ramTier = 'nano';
    autoModel = null;
    coopTier = 'NANO';
    note = 'Mesh participation only';
  } else if (ramGb < 12) {
    ramTier = 'lite';
    autoModel = 'gemma2:2b';
    coopTier = 'LITE';
  } else if (ramGb < 24) {
    ramTier = 'core';
    autoModel = 'gemma2:9b';
    coopTier = 'CORE';
    // VRAM detection still useful for logging — may influence inference speed
    if (vramGb !== null && vramGb < 6) {
      note = 'CPU inference (slower but stable)';
    }
  } else if (ramGb < 48) {
    ramTier = 'full';
    autoModel = 'gemma4:12b';
    coopTier = 'FULL';
    // VRAM detection for sub-tier logging
    if (vramGb !== null && vramGb < 8) {
      note = 'CPU inference (slower, 24+ GB RAM compensates)';
    }
  } else {
    ramTier = 'ultra';
    autoModel = 'gemma4:12b';
    coopTier = 'ULTRA';
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
