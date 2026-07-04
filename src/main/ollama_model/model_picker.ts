/**
 * model_picker.ts — v0.4.2 BP083 SEG-3
 *
 * Persists and retrieves the user's chosen Ollama model tier.
 * Replaces hardcoded 'gemma4:12b' everywhere with hardware-aware selection.
 *
 * Storage: %APPDATA%\MnemosyneC\config.json
 *   { "selectedModel": "gemma4:12b", "hardwareTierOverride": false }
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import { detectHardwareTier, getRecommendedModel } from '../hardware/ram_detector';
import type { HardwareTier } from '../hardware/ram_detector';

const CONFIG_FILE = () => join(app.getPath('appData'), 'MnemosyneC', 'config.json');

interface AppConfig {
  selectedModel: string;
  hardwareTierOverride: boolean;
  selectedTier: HardwareTier;
  configVersion: number;
}

function ensureConfigDir(): void {
  const dir = join(app.getPath('appData'), 'MnemosyneC');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function readConfig(): AppConfig | null {
  try {
    const p = CONFIG_FILE();
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, 'utf8')) as AppConfig;
  } catch {
    return null;
  }
}

function writeConfig(cfg: AppConfig): void {
  try {
    ensureConfigDir();
    writeFileSync(CONFIG_FILE(), JSON.stringify(cfg, null, 2), 'utf8');
  } catch (err) {
    console.error('[ModelPicker] Failed to write config:', err);
  }
}

/**
 * Returns the model the user has configured (or auto-detected default).
 * On first run: auto-detect from RAM and persist.
 */
export function getActiveModel(): string {
  const cfg = readConfig();
  if (cfg?.selectedModel) {
    return cfg.selectedModel;
  }
  // First run: auto-detect and persist
  const recommended = getRecommendedModel() ?? 'llama3.3:70b';
  const tier = detectHardwareTier();
  writeConfig({
    selectedModel: recommended,
    hardwareTierOverride: false,
    selectedTier: tier.tier,
    configVersion: 1,
  });
  console.log(`[ModelPicker] First-run auto-detect: ${tier.ramGb}GB RAM → tier=${tier.tier} model=${recommended}`);
  return recommended;
}

/**
 * Sets a user-chosen model (override).
 */
export function setActiveModel(model: string, tier: HardwareTier): void {
  const recommended = getRecommendedModel() ?? 'llama3.3:70b';
  writeConfig({
    selectedModel: model,
    hardwareTierOverride: model !== recommended,
    selectedTier: tier,
    configVersion: 1,
  });
  console.log(`[ModelPicker] User set model=${model} tier=${tier} override=${model !== recommended}`);
}

/**
 * Resets to hardware-detected default.
 */
export function resetToDetectedModel(): string {
  const recommended = getRecommendedModel() ?? 'llama3.3:70b';
  const tier = detectHardwareTier();
  writeConfig({
    selectedModel: recommended,
    hardwareTierOverride: false,
    selectedTier: tier.tier,
    configVersion: 1,
  });
  return recommended;
}
