// BP067 v0.1.24 — bundled floor model constants (shared main + renderer)
// Founder-locked: default = Gemma (Google), not Meta/Llama.

/** Shipped default tiny floor model (Ollama tag). */
export const FLOOR_MODEL = 'gemma2:2b';

/** Tags treated as satisfying the floor-model requirement. */
export const FLOOR_MODEL_ALIASES = [
  'gemma2:2b',
  'gemma2:2b-instruct',
  'gemma2:2b-instruct-q4_0',
  'gemma:2b',
] as const;

/** Optional upgrades — offered only AFTER first answer (Section 1). */
export const UPGRADE_MODELS = {
  good: { id: 'gemma2:9b', label: 'Good (~2 GB)', sizeGB: 2 },
  great: { id: 'llama3.1:8b-instruct-q4_K_M', label: 'Great (~5 GB)', sizeGB: 5 },
} as const;

/** Benchmark options for Founder final pick (Yoke return). */
export const BENCHMARK_OPTIONS = [
  {
    id: 'gemma2:2b',
    sizeGB: 1.6,
    speedNote: '~2–4s first token on typical laptop CPU',
    qualityNote: 'Short Q&A, greetings, simple how-to — adequate for family-install proof',
  },
  {
    id: 'gemma2:2b-instruct-q4_0',
    sizeGB: 1.4,
    speedNote: '~2–3s first token · slightly smaller quant',
    qualityNote: 'Similar to gemma2:2b · marginally faster load',
  },
  {
    id: 'phi3:mini',
    sizeGB: 2.3,
    speedNote: '~3–5s first token',
    qualityNote: 'Microsoft Phi-3 · non-Meta alternative floor candidate',
  },
] as const;

/** Model picker entries (hidden by default in UI; discoverable in Settings). */
export const PICKER_MODELS = [
  FLOOR_MODEL,
  UPGRADE_MODELS.good.id,
  UPGRADE_MODELS.great.id,
  'qwen2.5:3b',
  'phi3:mini',
  'mistral:7b-instruct-q4_0',
] as const;

export function isFloorModel(name: string): boolean {
  const base = name.split(':')[0];
  return FLOOR_MODEL_ALIASES.some(
    (a) => a === name || a.startsWith(base) || name.startsWith(a.split(':')[0]),
  );
}
