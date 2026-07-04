// domain_classifier.ts -- Mountain 1b · I-A · Domain Classifier
// KNIGHT MARATHON 7 · MOUNTAIN 1b · BP089
//
// Classifies a query into a DomainTag so the PLOW LOOP can pull the correct
// Unfair Advantage bundle. Uses a fast local classifier model (singleton).
//
// Classifier model: qwen2.5:0.5b preferred · gemma2:2b fallback · GENERAL if both unavailable.
// keep_alive: 24h aligned with gemma4:12b Court Package pattern.
// On error: always returns DomainTag.GENERAL · never throws · never blocks dispatch.
//
// §3 Truth-Always: qwen2.5:0.5b may not be pulled on all peers on Day 1.
//   The fallback path is not a failure — it is graceful degradation.
// MOUNTAIN_1b_ADDITION

const OLLAMA_BASE = 'http://127.0.0.1:11434';
const CLASSIFIER_KEEP_ALIVE = '24h';
const CLASSIFIER_PRIMARY = 'qwen2.5:0.5b';
const CLASSIFIER_FALLBACK = 'gemma2:2b';

// ─── DomainTag enum ───────────────────────────────────────────────────────────────

export enum DomainTag {
  // MMLU-Pro academic domains (Tiger Lab corpus coverage)
  BIOLOGY          = 'biology',
  CHEMISTRY        = 'chemistry',
  COMPUTER_SCIENCE = 'computer_science',
  ECONOMICS        = 'economics',
  ENGINEERING      = 'engineering',
  HEALTH           = 'health',
  HISTORY          = 'history',
  LAW              = 'law',
  MATH             = 'math',
  MEDICINE         = 'medicine',
  PHILOSOPHY       = 'philosophy',
  PHYSICS          = 'physics',
  PSYCHOLOGY       = 'psychology',
  BUSINESS         = 'business',
  OTHER_ACADEMIC   = 'other_academic',

  // Cooperative-internal domains
  CANON_INTERNAL       = 'canon_internal',        // eblet canon queries
  COOPERATIVE_STRATEGY = 'cooperative_strategy',  // LB Corp strategy
  RECEIPT_ANCHORED     = 'receipt_anchored',       // verifiable receipt lookup
  NARRATIVE_VOICE      = 'narrative_voice',        // Founder voice / taglines / copy
  SUBSTRATE_TECHNICAL  = 'substrate_technical',    // substrate architecture queries
  PEER_DISPATCH        = 'peer_dispatch',          // routing and fleet queries

  // Fallback
  GENERAL = 'general',
}

// ─── All valid domain tag values (for classifier prompt) ─────────────────────────

const ALL_DOMAIN_TAGS: string[] = Object.values(DomainTag);

// ─── ClassifierModel interface (exported for testing) ────────────────────────────

export interface ClassifierModel {
  model_id: string;
  vendor: 'local';
  classify(query: string): Promise<DomainTag>;
}

// ─── Internal: singleton state ────────────────────────────────────────────────────

interface ClassifierSingleton {
  model: ClassifierModel;
  model_id: string;
}

let _singleton: ClassifierSingleton | null = null;
let _singletonLoading: Promise<ClassifierSingleton | null> | null = null;

// ─── Internal: Ollama classifier attempt ─────────────────────────────────────────

async function attemptOllamaClassifier(modelId: string): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        prompt: 'Reply with: biology',
        stream: false,
        keep_alive: CLASSIFIER_KEEP_ALIVE,
        options: { num_predict: 8 },
      }),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── loadClassifier (exported for testing) ───────────────────────────────────────

export async function loadClassifier(): Promise<ClassifierModel | null> {
  if (_singleton) return _singleton.model;
  if (_singletonLoading) return _singletonLoading.then((s) => s?.model ?? null);

  _singletonLoading = (async (): Promise<ClassifierSingleton | null> => {
    // Try primary
    const primaryOk = await attemptOllamaClassifier(CLASSIFIER_PRIMARY);
    const selectedModelId = primaryOk ? CLASSIFIER_PRIMARY : CLASSIFIER_FALLBACK;

    if (!primaryOk) {
      const fallbackOk = await attemptOllamaClassifier(CLASSIFIER_FALLBACK);
      if (!fallbackOk) {
        _singletonLoading = null;
        return null; // both unavailable — fall back to GENERAL
      }
    }

    const model: ClassifierModel = {
      model_id: selectedModelId,
      vendor: 'local',
      async classify(query: string): Promise<DomainTag> {
        try {
          const classifyPrompt = [
            `Classify the following query into exactly one domain tag.`,
            `Available tags: ${ALL_DOMAIN_TAGS.join(', ')}`,
            `Return ONLY the tag string, nothing else.`,
            ``,
            `Query: ${query}`,
          ].join('\n');

          const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: selectedModelId,
              prompt: classifyPrompt,
              stream: false,
              keep_alive: CLASSIFIER_KEEP_ALIVE,
              options: { num_predict: 16, temperature: 0 },
            }),
            signal: AbortSignal.timeout(15000),
          });

          if (!res.ok) return DomainTag.GENERAL;

          const data = await res.json() as { response?: string };
          const raw = (data.response ?? '').trim().toLowerCase().replace(/[^a-z_]/g, '');

          // Match against known domain tags
          const matched = ALL_DOMAIN_TAGS.find((tag) => tag === raw) as DomainTag | undefined;
          return matched ?? DomainTag.GENERAL;
        } catch {
          return DomainTag.GENERAL;
        }
      },
    };

    const result: ClassifierSingleton = { model, model_id: selectedModelId };
    _singleton = result;
    _singletonLoading = null;
    return result;
  })();

  const result = await _singletonLoading;
  return result?.model ?? null;
}

// ─── classifyQueryDomain (primary entry point) ───────────────────────────────────

export interface ClassifyResult {
  domain: DomainTag;
  model_used: string;
  fallback_reason: string | null;
  latency_ms: number;
}

export async function classifyQueryDomain(query: string): Promise<DomainTag>;
export async function classifyQueryDomain(query: string, detailed: true): Promise<ClassifyResult>;
export async function classifyQueryDomain(
  query: string,
  detailed?: true
): Promise<DomainTag | ClassifyResult> {
  const t0 = Date.now();

  const classifier = await loadClassifier().catch(() => null);

  if (!classifier) {
    const result: ClassifyResult = {
      domain: DomainTag.GENERAL,
      model_used: 'fallback_general',
      fallback_reason: 'classifier_model_unavailable',
      latency_ms: Date.now() - t0,
    };
    return detailed ? result : result.domain;
  }

  const domain = await classifier.classify(query).catch(() => DomainTag.GENERAL);
  const latencyMs = Date.now() - t0;

  const isFallback = domain === DomainTag.GENERAL;
  const result: ClassifyResult = {
    domain,
    model_used: classifier.model_id,
    fallback_reason: isFallback ? 'classifier_returned_general' : null,
    latency_ms: latencyMs,
  };

  return detailed ? result : result.domain;
}
