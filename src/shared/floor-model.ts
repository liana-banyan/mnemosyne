// BP067 v0.1.24 -- bundled floor model constants (shared main + renderer)
// Founder-locked: default = Gemma (Google), not Meta/Llama.
// BP078 NANO SKU: floor model corrected to qwen2.5:0.5b (NANO bundled installer).

/** Shipped default NANO SKU floor model (Ollama tag). Corrected to qwen2.5:0.5b per BP078 build fix. */
export const FLOOR_MODEL = 'qwen2.5:0.5b';

/** Tags treated as satisfying the floor-model requirement. */
export const FLOOR_MODEL_ALIASES = [
  'gemma4:12b',
  'gemma4:12b-instruct',
  'qwen2.5:0.5b',
  'qwen2.5:0.5b-instruct',
  'qwen2.5:0.5b-instruct-q4_0',
  'qwen2.5:1.5b',
  'qwen2.5:1.5b-instruct',
  'gemma2:2b',
  'gemma2:2b-instruct',
  'gemma2:2b-instruct-q4_0',
  'gemma:2b',
] as const;

/** Optional upgrades -- offered only AFTER first answer (Section 1). */
export const UPGRADE_MODELS = {
  good: { id: 'gemma2:9b', label: 'Good (~2 GB)', sizeGB: 2 },
  great: { id: 'llama3.1:8b-instruct-q4_K_M', label: 'Great (~5 GB)', sizeGB: 5 },
} as const;

/** Benchmark options for Founder final pick (Yoke return). */
export const BENCHMARK_OPTIONS = [
  {
    id: 'qwen2.5:0.5b',
    sizeGB: 0.4,
    speedNote: '~1-2s first token on typical laptop CPU',
    qualityNote: 'Alibaba Qwen2.5 0.5B -- tiny, fast, bundled installer ~700MB. Answers short Q&A.',
  },
  {
    id: 'qwen2.5:1.5b',
    sizeGB: 1.0,
    speedNote: '~2-3s first token',
    qualityNote: 'Better factual recall than 0.5b -- installer ~1.1GB',
  },
  {
    id: 'gemma2:2b',
    sizeGB: 1.6,
    speedNote: '~2-4s first token on typical laptop CPU',
    qualityNote: 'Original floor model -- strong Q&A quality but installer ~2GB',
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
