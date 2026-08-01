// ai_dispatch_ipc.ts -- BP077 v0.1.27 Mnem-as-interface substrate baked in
// Handles: ai-dispatch:query, list-local-models, test-connection, get-settings, save-settings
// Routes local queries through Ollama /api/chat with r10v3 substrate system-prompt layer.
// SKU gate: nano skips Mnem-DRT pipeline; core/lite use mnem_drt_enabled flag; full always runs.
// Eblet compose: top-3 local eblet snippets prepended to user message when Mnem-DRT active.
// BP087 Brain Swap: brain-registry:list, brain-registry:get-active, brain-registry:set-active,
//   brain-registry:smoke-test -- routing bifurcation for local vs flagship brains.

import { ipcMain } from 'electron';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { app } from 'electron';
import { FLOOR_MODEL } from '../shared/floor-model';
import {
  queryEbletStore,
  queryVerifiedEblets,
  writeVerifiedEblet,
  substrateCounters,
  getEbletIndexStats,
  isQaRelevant,
  computeQuestionSimilaritySymmetric,
  SERVE_VERBATIM_THRESHOLD,
  // BP137 Yoke (Semantic Match Durable): additive imports for the embedding-based serve gate.
  loadAllVerifiedEblets,
  findNearestBySemanticCode,
  SEMANTIC_SERVE_THRESHOLD,
} from './mnem_eblet_store';
import { semantic_soccerball_emit, computeSemanticSimilarity } from './semantic_soccerball';
// BP136 Yoke: answer-cache meter (read-through/write-back cost + routing telemetry)
import { recordAnswerCacheEvent, getAnswerCacheMeterSummary, ESTIMATED_QUERY_COST_USD } from './answer_cache_meter';
// BP136 Yoke v2a (CSIA activation): Psionic zero-LLM prediction + convergence-on-match fast
// path, and its own SEPARATE meter (see psionic_predictor.ts / csia_meter.ts headers for the
// honesty-mandate verification that no prior "Psionic" code existed to wire). Independent of
// the answer-cache v1 imports above -- neither of those two files is touched by this Yoke.
import {
  predictViaPsionic,
  computeAnswerConvergence,
  PSIONIC_FAST_PATH_THRESHOLD,
  PSIONIC_MIN_CORROBORATION_FOR_FAST_PATH,
  CSIA_CONVERGENCE_MATCH_THRESHOLD,
  type PsionicPrediction,
} from './psionic_predictor';
import { recordCsiaEvent, getCsiaMeterSummary } from './csia_meter';
// BP136 Yoke v2b (CSIA research arm): Spider swarm + Saladin + concordance write-gate, lifted
// standalone from the benchmark harness (see csia_research.ts header for the fresh file:line
// re-verification, including why runGiantConcordance -- not andon_replow.ts -- is the gate).
import {
  runSpiderSwarmAndSaladin,
  buildCsiaResearchContext,
  runCsiaConcordanceGateAndStore,
  runCsiaRecursionAndContextVerdict,
  type CandidateEblet,
  type CsiaContextVerdict,
} from './csia_research';
import { ollamaManager } from './ollama_manager';
// BP083 SEG-3: MEMORY.md system-prompt injection (amnesia cure)
import { getMemoryMd } from './memory_scaffold';
// BP087 Brain Swap: brain registry for routing bifurcation
import {
  getBrainRegistry,
  getActiveBrainId,
  setActiveBrainId,
  getActiveBrain,
  DEFAULT_BRAINS,
  syncInstalledOllamaModels,
  ensureFreeLocalDefaultOnFirstRun,
  type BrainEntry,
} from './brain_registry/brain_registry';
// BP140-K3: Homework busy-guard — see homework_busy_gate.ts header for why this is a
// self-expiring heartbeat window rather than a plain latched boolean.
import { markAppBusy, clearAppBusy } from './homework/homework_busy_gate';
// BP132 Yoke #21 C7: user-facing Anthropic API key (separate from the unrelated
// ApiKeysSettings.tsx Hearth Conjunction subsystem).
import {
  resolveAnthropicApiKey,
  setUserAnthropicKey,
  hasUserAnthropicKey,
  clearUserAnthropicKey,
} from './user_anthropic_key';

const OLLAMA_API_BASE = 'http://127.0.0.1:11434';

// BP087 SEGResultEnvelope -- unified return type for brain-aware dispatch.
// Existing callers that destructure only `content` are unaffected (content is always present).
export interface SEGResultEnvelope {
  brain_id: string;
  kind: 'flagship' | 'local';
  model_id: string;
  content: string;
  input_tokens: number | null;  // null for local Ollama
  output_tokens: number | null; // null for local Ollama
  latency_ms: number;
  error: string | null;
}

// BP087 Brain Swap: dispatch a single question via the configured brain (local or flagship).
// local path: POST to Ollama /api/chat with stream:false
// flagship path: POST to Anthropic /v1/messages (requires ANTHROPIC_API_KEY in env)
async function dispatchViaBrain(
  brain: BrainEntry,
  messages: Array<{ role: string; content: string }>,
): Promise<SEGResultEnvelope> {
  const t0 = Date.now();
  const envelope: SEGResultEnvelope = {
    brain_id: brain.brain_id,
    kind: brain.kind,
    model_id: brain.model_id,
    content: '',
    input_tokens: null,
    output_tokens: null,
    latency_ms: 0,
    error: null,
  };

  try {
    if (brain.kind === 'local') {
      // Local Ollama path
      const res = await fetch(`${brain.api_endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: brain.model_id, messages, stream: false }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) {
        envelope.error = `Ollama HTTP ${res.status}: ${res.statusText}`;
      } else {
        const data = await res.json() as { message?: { content?: string }; done?: boolean };
        envelope.content = data.message?.content ?? '';
      }
    } else {
      // Flagship (Anthropic) path
      // BP132 Yoke #21 C7: prefer the user's own settings-supplied key over process.env,
      // so a real install (no LockBox vault, no ANTHROPIC_API_KEY in env) can still use a
      // flagship brain once the user pastes in their own key via Settings.
      const apiKey = resolveAnthropicApiKey() ?? '';
      if (!apiKey) {
        envelope.error = 'No Anthropic API key configured -- add your own key in Settings to use this brain';
      } else {
        // Convert messages: Anthropic API expects role "user"/"assistant", system separate
        const systemMsg = messages.find((m) => m.role === 'system');
        const chatMsgs = messages.filter((m) => m.role !== 'system');
        const body: Record<string, unknown> = {
          model: brain.model_id,
          max_tokens: 1024,
          messages: chatMsgs,
        };
        if (systemMsg) body['system'] = systemMsg.content;

        const res = await fetch(`${brain.api_endpoint}/v1/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(60_000),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          envelope.error = `Anthropic HTTP ${res.status}: ${errText.slice(0, 200)}`;
        } else {
          const data = await res.json() as {
            content?: Array<{ type: string; text?: string }>;
            usage?: { input_tokens?: number; output_tokens?: number };
          };
          const textBlock = (data.content ?? []).find((b) => b.type === 'text');
          envelope.content = textBlock?.text ?? '';
          envelope.input_tokens = data.usage?.input_tokens ?? null;
          envelope.output_tokens = data.usage?.output_tokens ?? null;
        }
      }
    }
  } catch (err) {
    envelope.error = String(err);
  }

  envelope.latency_ms = Date.now() - t0;
  return envelope;
}

// v0.1.57.1: module-scope streaming state — AbortController for in-flight stream,
// inference counter for cold-start detection.
let activeQueryController: AbortController | null = null;
let sessionInferenceCount = 0;

type Sku = 'nano' | 'core' | 'lite' | 'full';

interface AiDispatchSettings {
  local_runtime_url: string;
  preferred_model?: string;
  sku?: Sku;
  mnem_drt_enabled?: boolean;
  mnem_drt_specialists?: {
    wikipedia?: boolean;
    wikidata?: boolean;
    arxiv?: boolean;
    wolfram?: boolean;
  };
  filtration_pipeline_enabled?: boolean;
  eblet_store_quota?: '10mb' | '100mb' | '1gb' | 'unlimited';
  federation_exchange_enabled?: boolean;
  /** BP136 Yoke: gates the answer-cache read-through/write-back short-circuit in
   *  ai-dispatch:query. DEFAULTS OFF (undefined === off) -- with it off, ai-dispatch:query
   *  behaves byte-for-byte as it did before this Yoke. */
  answer_cache_mode?: boolean;
  /** BP136 Yoke v2a (CSIA activation): gates the Psionic zero-LLM prediction + convergence-on-
   *  match fast path in ai-dispatch:query. INDEPENDENT of answer_cache_mode above -- the two
   *  flags are read/used separately; v1's cache short-circuit still runs FIRST, unconditionally,
   *  exactly as before, regardless of this flag's value. DEFAULTS OFF (undefined === off) --
   *  with it off, every new code path this Yoke adds is unreachable (see isCsiaModeEnabled()
   *  and its call site in ai-dispatch:query) and the handler behaves byte-for-byte as it did
   *  before this Yoke. */
  csia_mode?: boolean;
  /** BP136 Yoke v2b (CSIA research arm): sub-flag, independent toggle in addition to
   *  csia_mode -- BOTH must be true for the research arm (Spider swarm + Saladin + concordance
   *  write-gate) to fire, since the swarm adds real parallel network latency (~5s) on top of
   *  csia_mode's own (cheap, local) Psionic check. DEFAULTS OFF -- with it off (or with
   *  csia_mode off), every new line this Yoke adds is unreachable. */
  csia_research?: boolean;
  /** BP137 Yoke (Semantic Match Durable): gates the embedding-based semantic serve-gate/read
   *  path (see semantic_soccerball.ts + the SIMILARITY branch below). DEFAULTS OFF -- with it
   *  off, or with it on but ollamaManager.embed() unavailable for a given request, behavior is
   *  byte-identical to the existing token-similarity-only path. INDEPENDENT of answer_cache_mode
   *  and csia_mode -- this flag only ever matters if answer_cache_mode is also on (there is no
   *  serve-gate at all to enhance otherwise). */
  semantic_soccerball_mode?: boolean;
  /** BP139 Concordance Gate, OPT-IN/DEFAULT 'lenient'. Tunable acceptance bar for
   *  runAuthorityEnsemble's lone-candidate accept path (plow_mc_answerer.ts, NO-COMPUTE/
   *  conceptual questions only -- never the deterministic-compute override). Read by
   *  specialist_adapters.ts's readConcordanceStrictnessFromSettings(), the SAME settings-read
   *  hook convention as mnem_drt_specialists above. undefined/'lenient' -> byte-identical to
   *  pre-gate behavior (a single accepted authority is accepted); 'require_two' -> a lone
   *  candidate is rejected (honest abstain) unless >=2 agree; 'require_majority' -> a lone
   *  candidate is rejected unless a strict majority of respondents agree. */
  concordance_strictness?: 'lenient' | 'require_two' | 'require_majority';
  /** BP140-K3 Homework: master on/off for the idle-time, AC-power, $0-Ollama-only background
   *  worker (homework_runner.ts). DEFAULTS OFF (undefined === off) -- with it off, the loop's
   *  sweep is a no-op every tick and no queued job is ever touched. Read directly out of this
   *  same settings file by homework_runner.ts (see that file's own settings-read helper) rather
   *  than via an export from this module, mirroring mesh_diff_loop.ts's self-contained style. */
  homework_enabled?: boolean;
  /** BP140-K3 Homework: seconds of Electron powerMonitor.getSystemIdleTime() required before a
   *  homework job is allowed to start. DEFAULTS to 300 (5 minutes) when unset. */
  homework_idle_threshold_seconds?: number;
}

/** BP136 Yoke: resolves the answer-cache mode flag from settings, with an env-var override
 *  (ANSWER_CACHE_MODE=1) for quick local testing without touching the settings file. Defaults
 *  OFF -- the field is undefined on every settings file written before this Yoke. */
function isAnswerCacheModeEnabled(settings: AiDispatchSettings): boolean {
  return settings.answer_cache_mode === true || process.env.ANSWER_CACHE_MODE === '1';
}

/** BP136 Yoke v2a (CSIA activation): resolves the csia_mode flag, same env-var-override
 *  convention as isAnswerCacheModeEnabled() above (CSIA_MODE=1 for quick local testing without
 *  touching the settings file). Defaults OFF -- undefined on every settings file written
 *  before this Yoke, and independent of answer_cache_mode's own flag/resolver. */
function isCsiaModeEnabled(settings: AiDispatchSettings): boolean {
  return settings.csia_mode === true || process.env.CSIA_MODE === '1';
}

/** BP136 Yoke v2b (CSIA research arm): resolves the csia_research sub-flag, same env-var-
 *  override convention (CSIA_RESEARCH=1). Callers must ALSO check isCsiaModeEnabled() --
 *  this function alone does not imply csia_mode is on (see the `csiaModeOn && ...` call site
 *  in ai-dispatch:query). */
function isCsiaResearchEnabled(settings: AiDispatchSettings): boolean {
  return settings.csia_research === true || process.env.CSIA_RESEARCH === '1';
}

/** BP137 Yoke (Semantic Match Durable): resolves the semantic_soccerball_mode flag, same env-
 *  var-override convention (SEMANTIC_SOCCERBALL_MODE=1). Defaults OFF -- undefined on every
 *  settings file written before this Yoke. Does NOT by itself imply embeddings are actually
 *  available -- every call site must still check the per-request ollamaManager.embed() result
 *  (via semantic_soccerball_emit returning non-null) and fall back to the token path on null. */
function isSemanticSoccerballModeEnabled(settings: AiDispatchSettings): boolean {
  return settings.semantic_soccerball_mode === true || process.env.SEMANTIC_SOCCERBALL_MODE === '1';
}

function getSettingsPath(): string {
  return join(app.getPath('userData'), 'ai_dispatch_settings.json');
}

function loadSettings(): AiDispatchSettings {
  const p = getSettingsPath();
  if (!existsSync(p)) return { local_runtime_url: OLLAMA_API_BASE };
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as AiDispatchSettings;
  } catch {
    return { local_runtime_url: OLLAMA_API_BASE };
  }
}

function saveSettings(settings: AiDispatchSettings): void {
  const p = getSettingsPath();
  const dir = join(p, '..');
  mkdirSync(dir, { recursive: true });
  writeFileSync(p, JSON.stringify(settings, null, 2), 'utf-8');
}

// Read the r10v3 distilled substrate text bundled at build time.
// Graceful degrade: if file is missing, returns null and the query proceeds without it.
function loadSubstrateText(): string | null {
  try {
    const substrateFile = join(__dirname, 'data', 'r10v3_substrate.txt');
    if (!existsSync(substrateFile)) {
      console.warn('[ai_dispatch] r10v3_substrate.txt not found -- proceeding without substrate inject');
      return null;
    }
    return readFileSync(substrateFile, 'utf-8').trim();
  } catch (err) {
    console.warn('[ai_dispatch] Failed to read r10v3_substrate.txt:', err, '-- proceeding without substrate inject');
    return null;
  }
}

// Determine whether Mnem-DRT pipeline (eblet store compose) should run for this SKU + settings.
// r10v3 substrate inject applies to ALL SKUs (spec §3).
// Mnem-DRT pipeline (eblet store) is gated by SKU and mnem_drt_enabled flag.
function shouldRunMnemDrt(settings: AiDispatchSettings): boolean {
  const sku = settings.sku ?? 'core';
  if (sku === 'nano') return false;
  if (sku === 'full') return true;
  // core or lite: opt-in via mnem_drt_enabled
  return settings.mnem_drt_enabled === true;
}

// BP134 Task C/D: shared helper -- Ollama-reachable installed model names, or [] if
// unreachable/errored (non-fatal; callers fall back to the curated registry as-is).
async function getInstalledOllamaModelsSafe(): Promise<string[]> {
  try {
    const status = ollamaManager.getStatus();
    const reachable = status.running || (await ollamaManager.isReachable());
    if (!reachable) return [];
    return await ollamaManager.listModels();
  } catch {
    return [];
  }
}

export function registerAiDispatchIPC(): void {
  // ── ai-dispatch:list-local-models ────────────────────────────────────────
  ipcMain.handle('ai-dispatch:list-local-models', async () => {
    try {
      const status = ollamaManager.getStatus();
      const reachable = status.running || (await ollamaManager.isReachable());
      if (!reachable) {
        return { ok: false, models: [], error: 'Local AI engine not running' };
      }
      const names = await ollamaManager.listModels();
      return { ok: true, models: names.map((name) => ({ name })) };
    } catch (err) {
      return { ok: false, models: [], error: String(err) };
    }
  });

  // ── ai-dispatch:test-connection ──────────────────────────────────────────
  ipcMain.handle('ai-dispatch:test-connection', async () => {
    try {
      const status = ollamaManager.getStatus();
      const reachable = status.running || (await ollamaManager.isReachable());
      if (!reachable) {
        return { ok: false, error: 'Local AI engine not running' };
      }
      const models = await ollamaManager.listModels();
      return { ok: true, model_count: models.length };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  // ── ai-dispatch:get-settings ─────────────────────────────────────────────
  ipcMain.handle('ai-dispatch:get-settings', () => {
    return { ok: true, settings: loadSettings() };
  });

  // ── ai-dispatch:save-settings ────────────────────────────────────────────
  ipcMain.handle(
    'ai-dispatch:save-settings',
    (_event, incoming: Partial<AiDispatchSettings>) => {
      const current = loadSettings();
      const updated: AiDispatchSettings = { ...current };
      if (incoming.local_runtime_url !== undefined) updated.local_runtime_url = incoming.local_runtime_url;
      if (incoming.preferred_model !== undefined) updated.preferred_model = incoming.preferred_model;
      if (incoming.sku !== undefined) updated.sku = incoming.sku;
      if (incoming.mnem_drt_enabled !== undefined) updated.mnem_drt_enabled = incoming.mnem_drt_enabled;
      if (incoming.mnem_drt_specialists !== undefined) updated.mnem_drt_specialists = incoming.mnem_drt_specialists;
      if (incoming.filtration_pipeline_enabled !== undefined) updated.filtration_pipeline_enabled = incoming.filtration_pipeline_enabled;
      if (incoming.eblet_store_quota !== undefined) updated.eblet_store_quota = incoming.eblet_store_quota;
      if (incoming.federation_exchange_enabled !== undefined) updated.federation_exchange_enabled = incoming.federation_exchange_enabled;
      if (incoming.answer_cache_mode !== undefined) updated.answer_cache_mode = incoming.answer_cache_mode;
      // BP136 Yoke v2a (CSIA activation): additive, mirrors the answer_cache_mode line above.
      if (incoming.csia_mode !== undefined) updated.csia_mode = incoming.csia_mode;
      // BP136 Yoke v2b (CSIA research arm): additive, mirrors the csia_mode line above.
      if (incoming.csia_research !== undefined) updated.csia_research = incoming.csia_research;
      // BP139 Concordance Gate: additive, mirrors the csia_research line above.
      if (incoming.concordance_strictness !== undefined) updated.concordance_strictness = incoming.concordance_strictness;
      // BP140-K3 Homework: additive, mirrors the csia_research line above.
      if (incoming.homework_enabled !== undefined) updated.homework_enabled = incoming.homework_enabled;
      if (incoming.homework_idle_threshold_seconds !== undefined) updated.homework_idle_threshold_seconds = incoming.homework_idle_threshold_seconds;
      try {
        saveSettings(updated);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    },
  );

  // ── ai-dispatch:anthropic-key-status / set / clear (BP132 Yoke #21 C7) ───
  // The raw key is NEVER returned to the renderer -- only a boolean presence flag.
  ipcMain.handle('ai-dispatch:anthropic-key-status', () => {
    return { ok: true, hasKey: hasUserAnthropicKey() };
  });

  ipcMain.handle('ai-dispatch:set-anthropic-key', (_event, rawKey: string) => {
    if (typeof rawKey !== 'string') return { ok: false, error: 'Invalid key' };
    return setUserAnthropicKey(rawKey);
  });

  ipcMain.handle('ai-dispatch:clear-anthropic-key', () => {
    clearUserAnthropicKey();
    return { ok: true };
  });

  // ── ai-dispatch:query ────────────────────────────────────────────────────
  // args: { court_member: string; messages: [{role, content}]; model_override?: string }
  // v0.1.57.1: returns { ok: true, streaming: true } immediately; content flows via
  // 'ask-token-progress' and 'ask-token-complete' IPC push events.
  // Pre-flight errors still return { ok: false, error } synchronously.
  ipcMain.handle(
    'ai-dispatch:query',
    async (
      event,
      args: {
        court_member: string;
        messages: Array<{ role: string; content: string }>;
        model_override?: string;
      },
    ) => {
      // BP140-K3: assert app-busy for the Homework background loop's Gate 3 (never contend
      // with the user's live Ask for the shared Ollama daemon). Renewed again at every
      // streamed token below; cleared at each of this handler's completion points.
      markAppBusy();
      // BP136 Yoke: query-start timestamp for the meter's latency_ms across every routing
      // branch (served_verbatim / rag / local_generate / flagship).
      const tQueryStart = Date.now();
      const settings = loadSettings();
      // SEG-1 v0.1.56: prefer family-matched Gemma model over hard-coded FLOOR_MODEL.
      const selectedGemmaModel = ollamaManager.getSelectedModel();
      // BP134 Task C: brain-registry active brain (if 'local') carries the exact installed
      // Ollama tag the user picked in ASK's model selector (e.g. gemma2:9b) -- honor it so
      // selecting a model in the picker actually changes which model answers, not just the
      // label. Computed once here and reused below for the flagship-routing check.
      const activeBrain = args.model_override ? undefined : getActiveBrain();
      const activeBrainLocalModel = activeBrain && activeBrain.kind === 'local' ? activeBrain.model_id : undefined;
      const model = args.model_override ?? activeBrainLocalModel ?? settings.preferred_model ?? selectedGemmaModel ?? FLOOR_MODEL;

      const status = ollamaManager.getStatus();
      const reachable = status.running || (await ollamaManager.isReachable());
      if (!reachable) {
        clearAppBusy();
        return { ok: false, error: 'Local AI engine not running' };
      }

      // SEG-1 v0.1.56: if no override/preference/active-local-brain and no gemma model was
      // found, signal SEG-2. BP134 Task C: activeBrainLocalModel (e.g. a non-gemma installed
      // model explicitly picked in the ASK selector) also counts as "compatible" here --
      // otherwise picking mistral/qwen would still incorrectly trigger the gemma-pull banner.
      if (!args.model_override && !activeBrainLocalModel && !settings.preferred_model && selectedGemmaModel === null) {
        clearAppBusy();
        return { ok: false, error: 'No compatible model — downloading now…' };
      }

      // Extract the user's message text for substrate + eblet lookups.
      const userMessage = args.messages
        .filter((m) => m.role === 'user')
        .map((m) => m.content)
        .join(' ')
        .trim();

      // BUG1 FIX (ship-safety SEG, post-Ayn-Rand/Mark-Twain incident): `userMessage` above is
      // the CONCATENATION of every prior user turn in this conversation (join(' ') over every
      // role:'user' message) -- fine for RAG/context lookups, but WRONG to stamp as the
      // `question` field on a new write-back eblet: a later, unrelated question in the same
      // conversation would inherit earlier turns' subject words baked into the stored question
      // text, inflating token-overlap similarity against completely different future queries.
      // `currentTurnQuestion` is ONLY the single latest user turn -- this is what every
      // writeVerifiedEblet({ question: ... }) call below must use, never `userMessage`.
      const lastUserMessage = args.messages.filter((m) => m.role === 'user').pop();
      const currentTurnQuestion = (lastUserMessage?.content ?? userMessage).trim();

      // Step 1: Load r10v3 substrate (all SKUs).
      const substrateText = loadSubstrateText();

      // BP083 SEG-3: Load MEMORY.md self-context (amnesia cure — prepended before substrate).
      // Cached in-memory, invalidated by fs.watch on edit. Graceful degrade: fallback identity if fails.
      // SEG-2 v0.3.7: diagnostic logging per BP078 every-click-visible-feedback canon.
      // BP-badge-fix: hoisted above the served_verbatim/CSIA fast-path short-circuits below so
      // their ask-token-complete payloads can report the TRUE selfContextLoaded state instead of
      // a hardcoded false. getMemoryMd() is in-memory cached after the first call (see
      // memory_scaffold.ts _memoryMdCache), so hoisting it here costs ~nothing on the $0 serve
      // paths -- it does not reintroduce a disk read on every query.
      let memoryMdContent = '';
      try {
        memoryMdContent = getMemoryMd();
        const memPath = join(app.getPath('appData'), 'MnemosyneC', 'MEMORY.md');
        console.log(`[Ask] MEMORY.md loaded: ${memoryMdContent.length} bytes from ${memPath}`);
      } catch (err) {
        const memPath = join(app.getPath('appData'), 'MnemosyneC', 'MEMORY.md');
        console.warn(`[Ask] MEMORY.md MISSING at ${memPath} — err:`, err);
      }

      // SEG-1 v0.1.57: HOT retrieve — query verified eblet store before LLM inference.
      // Runs unconditionally (not gated by Mnem-DRT). Fresh-install path: store absent → [].
      let verifiedHits: import('./mnem_eblet_store').VerifiedEbletEntry[] = [];
      try {
        verifiedHits = await queryVerifiedEblets(userMessage);
      } catch (err) {
        console.warn('[SubstrateHOT] queryVerifiedEblets failed:', err);
      }

      let verifiedContext = '';
      if (verifiedHits.length > 0) {
        substrateCounters.hotHits++;
        verifiedContext =
          'Based on previously-verified knowledge:\n\n' +
          verifiedHits.map((h) => `Q: ${h.question}\nA: ${h.answer}`).join('\n\n') +
          '\n\nNow answer the following question:\n\n';
      } else {
        substrateCounters.coldCalls++;
      }
      console.log(
        `[SubstrateHOT] hits=${verifiedHits.length} hotTotal=${substrateCounters.hotHits} coldTotal=${substrateCounters.coldCalls}`,
      );

      // BP136 Yoke: answer-cache short-circuit -- serve the top verified hit VERBATIM (no
      // model call) when it is an exact question match, or when it clears
      // SERVE_VERBATIM_THRESHOLD on question<->question similarity (distinct from the 0.08
      // Q/A answer-relevance gate used above/elsewhere in this file for RAG relevance).
      // Gated behind ANSWER_CACHE_MODE, DEFAULT OFF -- with it off this block is a no-op and
      // ai-dispatch:query behaves byte-for-byte as it did before this Yoke (verified: disabling
      // the flag skips every line below and falls straight through to the existing RAG path).
      //
      // BP136 Yoke (hotfix, post-Euler-mismatch incident): the SIMILARITY branch below (the
      // EXACT branch above it is unaffected and stays as-is -- exact match is always safe) now
      // uses computeQuestionSimilaritySymmetric instead of the one-directional
      // computeQuestionSimilarity. Root cause of the incident: "What's the quadratic formula?"
      // was served the Euler's-formula-for-complex-exponentials eblet at one-directional
      // qSim=0.667 (>= 0.6) because 2 of the new question's 3 stopword-filtered tokens ("s" and
      // "formula") happen to also appear in Euler's stored question, even though the
      // discriminating word "quadratic" does not. isQaRelevant(query, storedAnswer) was
      // evaluated as a possible guard and empirically REJECTED: it scores 0.667 (passes, wrong)
      // for the Euler mismatch because the Euler answer literally contains the word "formula",
      // and it scores 0 (fails, wrong) for the correct quadratic-formula answer because that
      // answer never spells out "quadratic" or "formula" in words. Requiring the MIN of both
      // similarity directions instead means the stored question must ALSO be mostly explained
      // by the new question's tokens (near-restatement in both directions), which drops the
      // Euler case to 0.4 (blocked) while the true quadratic-formula match stays at 0.667
      // (served). See computeQuestionSimilaritySymmetric() in mnem_eblet_store.ts for the full
      // measured numbers and why an answer-relevance gate was rejected in favor of this.
      const answerCacheModeOn = isAnswerCacheModeEnabled(settings);
      // BP-component-serve-fix: never verbatim-serve a class:'component' fragment -- it is a
      // supporting fact written alongside its parent whole_answer (csia_research.ts writes
      // both under the same question text), not a standalone answer to the user's question.
      // Select the first NON-component candidate for the serve gate; verifiedHits itself
      // (including any components) is untouched, so verifiedContext (RAG assembly, built
      // above from the full array) still sees every hit. Belt-and-suspenders alongside the
      // ranking fix in queryVerifiedEblets (mnem_eblet_store.ts): even if some future caller
      // or data shape ever put a component back at index 0, it can never reach this gate.
      const topVerifiedHit = verifiedHits.find((h) => h.class !== 'component');
      if (answerCacheModeOn && topVerifiedHit) {
        const isExactQuestionMatch =
          topVerifiedHit.question.trim().toLowerCase() === userMessage.trim().toLowerCase();
        // BUG2 FIX (ship-safety SEG, post-Ayn-Rand/Mark-Twain incident): the FUZZY similarity
        // branch (computeQuestionSimilaritySymmetric(...) >= SERVE_VERBATIM_THRESHOLD) that used
        // to sit here is DISABLED, not merely re-tuned. Root cause of the incident: a "What is
        // Ayn Rand's birthday?" query was served a stored Mark-Twain eblet at qSim=0.82 because
        // the two questions' ENTIRE token overlap was the shared GENERIC frame word ("birthday")
        // -- the discriminating subject tokens ("ayn"/"rand" vs "mark"/"twain") never overlapped
        // at all, but a short question has so few tokens that one shared frame word alone can
        // clear a 0.6 overlap ratio.
        //
        // A "require at least one DISCRIMINATING (non-generic) shared token" guard was evaluated
        // as the preferred fix and REJECTED for this pass because neither way of defining
        // "generic" can be proven to GUARANTEE zero false-serves against future/adversarial data:
        //   - A hand-curated generic-word list (birthday/born/formula/capital/author/...) is
        //     unbounded and silently incomplete the moment a new question template is asked.
        //   - A corpus document-frequency cutoff (token is "generic" if it recurs across many
        //     stored questions) is only as good as today's store: a store that happens to hold
        //     only ONE birthday-shaped question ever written would score "birthday" as maximally
        //     DISCRIMINATING (df=1) -- exactly the failure mode this guard exists to close -- and
        //     that is precisely the situation Bug 3's cleanup leaves this store in.
        // Ship-safety mandate here is "under-serve is fine, false-serve is not," so this v1 keeps
        // ONLY the EXACT (normalized: trim + lowercase) question-match branch below, which is
        // provably safe -- two genuinely different questions can never be byte-identical after
        // normalization, so a cross-subject false-serve via this gate is now structurally
        // impossible. This is a real behavior change (fuzzy hits now fall through to the
        // RAG/regenerate path instead of serving at $0), by design. Semantic (embedding-based,
        // subject-aware) fuzzy matching is a separate future Knight build; do not resurrect
        // computeQuestionSimilaritySymmetric/SERVE_VERBATIM_THRESHOLD as a serve gate here
        // without it -- both remain imported/exported for that future build and for
        // mnem_eblet_store.ts's own ranking use, but are no longer read on this line.
        if (isExactQuestionMatch) {
          const latency_ms = Date.now() - tQueryStart;
          recordAnswerCacheEvent({ routing: 'served_verbatim', cost_usd: 0, latency_ms });
          console.log(
            `[AnswerCache] servedFromSubstrate=true exact=${isExactQuestionMatch} ` +
              `qSim=1.00 (exact-match-only gate) latency_ms=${latency_ms}`,
          );
          if (!event.sender.isDestroyed()) {
            event.sender.send('ask-token-complete', {
              content: topVerifiedHit.answer,
              hotHits: substrateCounters?.hotHits,
              // BP-badge-fix: was hardcoded false; now reports the same true MEMORY.md load
              // state the real generation paths compute (memoryMdContent.length > 0), since
              // memoryMdContent is now hoisted above this short-circuit and is cheap (cached).
              selfContextLoaded: memoryMdContent.length > 0,
              servedFromSubstrate: true,
              cost_usd: 0,
              latency_ms,
              provenance: topVerifiedHit.provenance,
              verified: topVerifiedHit.verified,
            });
          }
          clearAppBusy();
          return { ok: true, streaming: true, servedFromSubstrate: true };
        } else if (isSemanticSoccerballModeEnabled(settings)) {
          // BP137 Yoke (Semantic Match Durable), STEP 2 READ side: additive embedding-based
          // serve gate, only attempted when the exact-match branch above did not fire. Embeds
          // the CURRENT-TURN question only (never the multi-turn-concatenated `userMessage` --
          // same BUG1-FIX discipline as the write side, see currentTurnQuestion's own doc
          // comment above) and searches EVERY entry with a persisted semanticCode (not just
          // the token-ranked top-3 in verifiedHits, since a semantically correct match may
          // share zero discriminating tokens with a token-ranked candidate) for the nearest
          // match by Hamming-distance-approximated cosine similarity. Serves ONLY if that
          // similarity clears SEMANTIC_SERVE_THRESHOLD. BP137 ADDENDUM FIX 5: this used to ALSO
          // require isQaRelevant(query, answer) as a second AND-gate, but that keyword-overlap
          // check wrongly rejects SYMBOLIC answers (e.g. the quadratic formula answer never
          // spells out the words "quadratic"/"formula", so isQaRelevant scored 0 for a genuine
          // paraphrase match, verified empirically in the BP137 main session). Embedding
          // similarity already distinguishes SUBJECTS (that is exactly what fixed the
          // Twain-vs-Rand frame collision, since the two questions' embeddings differ even
          // though isQaRelevant's keyword check cannot tell them apart either way) -- so a
          // semantic score clearing SEMANTIC_SERVE_THRESHOLD is itself sufficient relevance
          // proof on THIS path, without also gating on keyword isQaRelevant. The v1 token-
          // similarity path below (SERVE_VERBATIM_THRESHOLD / computeQuestionSimilaritySymmetric)
          // is NOT touched by this change and keeps its own isQaRelevant gate exactly as-is --
          // only the semantic path's gate is loosened, and only in the direction of the
          // ship-safety mandate ("under-serve is fine, false-serve is not") since embedding
          // similarity is the stronger signal here, not a weaker one. Falls through to the
          // unchanged token-similarity-only path
          // below (which today means: no fuzzy serve at all, per BUG2 FIX) whenever embeddings
          // are unavailable for this specific query (queryCode null) or no stored entry has a
          // semantic code yet (nearest null) or the match doesn't clear the bar.
          const tSemanticStart = Date.now();
          let queryCode: string | null = null;
          try {
            queryCode = await semantic_soccerball_emit(currentTurnQuestion);
          } catch (err) {
            console.warn('[SemanticSoccerball] emit failed for query (fail-soft, falling back to token path):', err);
          }
          if (queryCode) {
            let allEntries: import('./mnem_eblet_store').VerifiedEbletEntry[] = [];
            try {
              allEntries = await loadAllVerifiedEblets();
            } catch (err) {
              console.warn('[SemanticSoccerball] loadAllVerifiedEblets failed (fail-soft):', err);
            }
            const nearest = findNearestBySemanticCode(queryCode, allEntries);
            const semanticLatencyMs = Date.now() - tSemanticStart;
            if (nearest) {
              console.log(
                `[SemanticSoccerball] nearest stored question="${nearest.entry.question.slice(0, 80)}" ` +
                `similarity=${nearest.similarity.toFixed(3)} threshold=${SEMANTIC_SERVE_THRESHOLD} ` +
                `latency_ms=${semanticLatencyMs}`,
              );
            } else {
              console.log(
                `[SemanticSoccerball] no stored entry has a semantic code yet -- falling back to token path. latency_ms=${semanticLatencyMs}`,
              );
            }
            if (
              nearest &&
              nearest.similarity >= SEMANTIC_SERVE_THRESHOLD
            ) {
              const latency_ms = Date.now() - tQueryStart;
              recordAnswerCacheEvent({ routing: 'served_verbatim', cost_usd: 0, latency_ms });
              console.log(
                `[AnswerCache] servedFromSubstrate=true exact=false semantic=true ` +
                  `semanticSim=${nearest.similarity.toFixed(3)} (semantic-gate, isQaRelevant not required per BP137 addendum FIX 5) latency_ms=${latency_ms}`,
              );
              if (!event.sender.isDestroyed()) {
                event.sender.send('ask-token-complete', {
                  content: nearest.entry.answer,
                  hotHits: substrateCounters?.hotHits,
                  selfContextLoaded: memoryMdContent.length > 0,
                  servedFromSubstrate: true,
                  cost_usd: 0,
                  latency_ms,
                  provenance: nearest.entry.provenance,
                  verified: nearest.entry.verified,
                });
              }
              clearAppBusy();
              return { ok: true, streaming: true, servedFromSubstrate: true };
            }
          } else {
            console.log(
              '[SemanticSoccerball] embeddings unavailable for this query -- falling back to token path ' +
              '(byte-identical to mode-off behavior for this specific request).',
            );
          }
        }
      }
      // Lower-confidence-but-relevant hits fall through to the existing RAG path below
      // (inject context + regenerate) -- this is the accuracy path and is unchanged.

      // BP136 Yoke v2a (CSIA activation): Psionic zero-LLM prediction + convergence-on-match
      // fast path. INDEPENDENT flag (csia_mode) -- this entire block only runs AFTER the v1
      // cache block above, so v1's served_verbatim precedence is completely unchanged: if v1
      // already returned above, this code is never reached at all for that query. Gated behind
      // csiaModeOn so the mode-OFF path executes zero new lines below -- see isCsiaModeEnabled().
      const csiaModeOn = isCsiaModeEnabled(settings);
      // BP137 Yoke (Semantic Match Durable): resolved ONCE per request, reused by every
      // writeVerifiedEblet()/runCsiaConcordanceGateAndStore()/runCsiaRecursionAndContextVerdict()
      // write-back call site below so each newly-written eblet's semantic code is computed
      // consistently with the read-side gate's flag. False -> every write below omits
      // opts.computeSemanticCode (defaults false), byte-identical to pre-Yoke behavior.
      const semanticModeOn = isSemanticSoccerballModeEnabled(settings);
      let psionicPrediction: PsionicPrediction | null = null;
      if (csiaModeOn) {
        const tPsionicStart = Date.now();
        try {
          // BP137 ADDENDUM FIX 3: current-turn question only, never the multi-turn-concatenated
          // `userMessage` -- same BUG1-FIX discipline already applied to every write-back call
          // site in this file. Concatenated multi-turn input corrupted Psionic's seed matching
          // (a later turn's question would seed on tokens from EARLIER turns too, widening the
          // seed set with unrelated subjects).
          psionicPrediction = await predictViaPsionic(currentTurnQuestion);
        } catch (err) {
          console.warn('[CSIA] predictViaPsionic failed (non-fatal):', err);
        }
        const psionicLatencyMs = Date.now() - tPsionicStart;
        if (psionicPrediction) {
          console.log(
            `[CSIA] Psionic predicted: confidence=${psionicPrediction.confidence.toFixed(2)} ` +
            `corroborating=${psionicPrediction.corroboratingCount} hops=${psionicPrediction.hops} ` +
            `latency_ms=${psionicLatencyMs} trace="${psionicPrediction.traceSummary}"`,
          );
          // BP137 ADDENDUM FIX 2 (SEMANTIC-FLOOR MANDATE, hardened): discriminating-subject
          // floor. Root cause of the Twain/Rand false-serve was that confidence+corroboratingCount
          // alone can clear the fast-path bar even when the incoming question and bestMember's
          // stored question share ZERO discriminating tokens -- they only shared the FRAME
          // ("What was X's birthday?"), which is exactly the class of collision this floor
          // exists to block. The token check ALONE can never catch this: a shared frame word is
          // BY DEFINITION >0 token overlap for two same-template different-subject questions, so
          // a token-floor-only (or token-floor-as-fallback) gate structurally cannot discriminate
          // subject. Reproduced live pre-fix: "What was Einstein's birthday?" cleared this same
          // floor via the token fallback (bestMemberSemanticCode absent/unavailable) and
          // fast-path-served Mark Twain's birthdate at confidence 0.800.
          //
          // FIX: the semantic check is now MANDATORY, not merely preferred-when-available. The
          // token floor (computeQuestionSimilaritySymmetric(...) > 0) remains as an ADDITIONAL
          // necessary-but-NOT-sufficient pre-filter (AND, never OR/fallback) -- both must pass.
          // Any of {semantic_soccerball_mode off, ollamaManager.embed() unavailable for this
          // query, bestMember has no persisted semanticCode, similarity below
          // SEMANTIC_SERVE_THRESHOLD} now BLOCKS the fast path outright, regardless of how well
          // the token floor passed. This is a deliberate, accepted under-serve trade-off: with a
          // cold/near-empty semanticCode store, Psionic's fast path will mostly fall through to
          // normal generation until the store warms -- ship-safety mandate is "under-serve is
          // fine, false-serve is not."
          const psionicTokenFloorPassed = computeQuestionSimilaritySymmetric(
            currentTurnQuestion,
            psionicPrediction.bestMemberQuestion,
          ) > 0;
          let psionicSemanticFloorPassed = false;
          let psionicFloorMethod = 'semantic-mode-off';
          if (isSemanticSoccerballModeEnabled(settings)) {
            if (psionicPrediction.bestMemberSemanticCode) {
              try {
                const queryCodeForFloor = await semantic_soccerball_emit(currentTurnQuestion);
                if (queryCodeForFloor) {
                  psionicSemanticFloorPassed =
                    computeSemanticSimilarity(queryCodeForFloor, psionicPrediction.bestMemberSemanticCode) >=
                    SEMANTIC_SERVE_THRESHOLD;
                  psionicFloorMethod = 'semantic';
                } else {
                  psionicFloorMethod = 'semantic-embed-unavailable';
                }
              } catch (err) {
                console.warn('[CSIA] Psionic discriminating-floor semantic check failed (fail-soft, BLOCKING fast path):', err);
                psionicFloorMethod = 'semantic-error';
              }
            } else {
              psionicFloorMethod = 'semantic-no-stored-code';
            }
          }
          const psionicDiscriminatingFloorPassed = psionicTokenFloorPassed && psionicSemanticFloorPassed;
          if (!psionicDiscriminatingFloorPassed) {
            console.log(
              `[CSIA] Psionic FAST PATH BLOCKED by discriminating-floor (method=${psionicFloorMethod}, ` +
              `tokenFloor=${psionicTokenFloorPassed}, semanticFloor=${psionicSemanticFloorPassed}): ` +
              `query="${currentTurnQuestion.slice(0, 60)}" bestMemberQuestion="${psionicPrediction.bestMemberQuestion.slice(0, 60)}" ` +
              `confidence=${psionicPrediction.confidence.toFixed(2)} corroborating=${psionicPrediction.corroboratingCount} -- abstaining.`,
            );
          }
          if (
            psionicPrediction.confidence >= PSIONIC_FAST_PATH_THRESHOLD &&
            psionicPrediction.corroboratingCount >= PSIONIC_MIN_CORROBORATION_FOR_FAST_PATH &&
            psionicDiscriminatingFloorPassed
          ) {
            // CONVERGED FAST PATH: Psionic's own zero-LLM graph-walk is confident enough
            // (multi-source corroboration, not just one lucky keyword hit) AND cleared the
            // discriminating-subject floor above, to serve without ever calling a model. This
            // is the "biggest cheap win" fast path from the spec.
            const latency_ms = Date.now() - tQueryStart;
            recordCsiaEvent({
              kind: 'psionic_fast_path',
              confidence: psionicPrediction.confidence,
              corroboratingCount: psionicPrediction.corroboratingCount,
              latency_ms,
              cost_avoided_usd: ESTIMATED_QUERY_COST_USD,
            });
            console.log(`[CSIA] FAST PATH fired -- served without a model call. latency_ms=${latency_ms}`);
            if (!event.sender.isDestroyed()) {
              event.sender.send('ask-token-complete', {
                content: psionicPrediction.answer,
                hotHits: substrateCounters?.hotHits,
                // BP-badge-fix: was hardcoded false; see the served_verbatim short-circuit
                // above for the same reasoning -- memoryMdContent is hoisted and cheap.
                selfContextLoaded: memoryMdContent.length > 0,
                servedFromSubstrate: true,
                csiaFastPath: true,
                csiaConfidence: psionicPrediction.confidence,
                cost_usd: 0,
                latency_ms,
                provenance: `csia:psionic:${psionicPrediction.corroboratingCount}-source-convergence`,
                verified: true,
              });
            }
            clearAppBusy();
            return { ok: true, streaming: true, servedFromSubstrate: true, csiaFastPath: true };
          }
        } else {
          console.log('[CSIA] Psionic: no prediction (insufficient substrate signal for this question)');
          recordCsiaEvent({
            kind: 'psionic_no_prediction',
            confidence: null,
            corroboratingCount: null,
            latency_ms: psionicLatencyMs,
            cost_avoided_usd: 0,
          });
        }
      }
      // psionicPrediction (if any, below fast-path confidence) is carried forward to the
      // flagship and local-generation branches below for the post-hoc convergence-on-match
      // check -- see the `csiaModeOn && psionicPrediction` blocks in each branch.

      // Step 2: SKU gate -- determine if Mnem-DRT eblet compose should run.
      // MEMORY.md is prepended first (self-identity), then r10v3 substrate, then eblet context.
      let systemContent = (memoryMdContent ? memoryMdContent + '\n\n' : '') + verifiedContext + (substrateText ?? '');

      // BP136 Yoke v2b (CSIA research arm): fires ONLY on a genuine miss -- v1 cache missed
      // (already true, or this code would never be reached: the v1 block above returns early
      // on a hit) AND v2a's Psionic fast path did NOT fire this request (also already true, or
      // the v2a block above already returned early). INDEPENDENT sub-flag `csia_research` in
      // ADDITION to `csia_mode` -- both must be true, since the specialist swarm adds real
      // parallel network latency (~5s) on top of csia_mode's own cheap local Psionic check.
      // Entirely gated inside `if (csiaResearchOn)` so with either flag off, zero new lines
      // below execute (no network calls, no Ollama Saladin call, systemContent untouched).
      const csiaResearchOn = csiaModeOn && isCsiaResearchEnabled(settings);
      let csiaResearchSurvivors: CandidateEblet[] = [];
      let csiaResearchSources: string[] = [];
      if (csiaResearchOn && userMessage.length > 0) {
        try {
          const swarmResult = await runSpiderSwarmAndSaladin(userMessage, OLLAMA_API_BASE, model);
          csiaResearchSurvivors = swarmResult.survivors;
          csiaResearchSources = swarmResult.sources;
          if (csiaResearchSurvivors.length > 0) {
            systemContent += buildCsiaResearchContext(csiaResearchSurvivors);
          } else {
            console.log('[CSIA] research: zero survivors -- no context injected, falls through to normal generation');
          }
        } catch (err) {
          console.warn('[CSIA] research arm failed (non-fatal, falls through to normal generation):', err);
        }
      }
      // csiaResearchSurvivors/csiaResearchSources (if any) are carried forward to the flagship
      // and local-generation branches below for the post-hoc concordance gate + TIC writes --
      // see the `csiaResearchOn && csiaResearchSurvivors.length > 0` blocks in each branch.

      if (shouldRunMnemDrt(settings) && userMessage.length > 0) {
        // Step 3: Query local eblet store for context snippets.
        // W1 TODO: stub for DRT bridge (Python subprocess) -- replace this stub when Item 6 lands.
        let ebletSnippets: string[] = [];
        try {
          ebletSnippets = await queryEbletStore(userMessage);
        } catch (err) {
          console.warn('[ai_dispatch] queryEbletStore failed:', err);
        }

        if (ebletSnippets.length > 0) {
          // Compose: MEMORY.md + substrate + eblet context + user message framing.
          const knownContext = ebletSnippets.join('\n\n');
          const substrateLayer = substrateText
            ? `${substrateText}\n\n[Known context from local knowledge base]\n${knownContext}`
            : `[Known context from local knowledge base]\n${knownContext}`;
          systemContent = (memoryMdContent ? memoryMdContent + '\n\n' : '') + substrateLayer;
        }
      }

      // Build the /api/chat messages array.
      // System message carries the substrate layer (r10v3 + optional eblet context).
      // User messages carry the conversation.
      const chatMessages: Array<{ role: string; content: string }> = [];
      if (systemContent) {
        chatMessages.push({ role: 'system', content: systemContent });
      }
      // Append the original messages from the caller (preserves multi-turn history).
      for (const m of args.messages) {
        chatMessages.push(m);
      }

      // BP132 Yoke #21 C5: when the active/selected brain is 'flagship' (e.g. Claude),
      // route through dispatchViaBrain() instead of hardcoding Ollama. This was previously
      // dead plumbing -- ai-dispatch:query ALWAYS hit `${OLLAMA_API_BASE}/api/chat` below,
      // even when brain-registry's active brain was a flagship brain (the default
      // active_brain_id is actually 'claude-sonnet-4-6' -- see brain_registry.ts -- so the
      // brain-swap UI could report "Claude active" while every Ask silently still ran on
      // Gemma). systemContent (MEMORY.md + verified eblets + r10v3 substrate, composed
      // above) is reused as-is so the same eblet context flows into Claude as into Gemma.
      // (activeBrain computed earlier alongside `model` -- reused here, not redeclared.)
      if (activeBrain && activeBrain.kind === 'flagship') {
        if (!event.sender.isDestroyed()) {
          event.sender.send('ask-token-progress', { coldStart: false, delta: '', assembled: '', flagship: true, brainId: activeBrain.brain_id });
        }
        void (async () => {
          const result = await dispatchViaBrain(activeBrain, chatMessages);
          sessionInferenceCount++;

          // BP136 Yoke: write-back -- "compute once". A real, $-costing flagship/frontier
          // answer becomes a $0 hit next time. Gated by the same mode flag (default OFF);
          // only writes when isQaRelevant clears the existing 0.08 gate, so a junk/error
          // response never enters the verbatim-serve path. Local-Ollama answers are
          // deliberately NOT written back in v1 (scope: keep the cache high-quality).
          if (answerCacheModeOn && !result.error && result.content && isQaRelevant(currentTurnQuestion, result.content)) {
            try {
              await writeVerifiedEblet({
                // BUG1 FIX: current-turn question only, never the multi-turn `userMessage`.
                question: currentTurnQuestion,
                answer: result.content,
                provenance: `flagship:${result.brain_id}:${Date.now()}`,
                verified: true,
                sha256: '', // recomputed correctly inside writeVerifiedEblet from question+answer
                timestamp: Date.now(),
                class: 'whole_answer',
              }, { computeSemanticCode: semanticModeOn });
            } catch (err) {
              console.warn('[AnswerCache] writeVerifiedEblet (flagship) failed:', err);
            }
          }
          // BP136 Yoke: meter + servedFromSubstrate field are gated behind the SAME mode flag
          // so the mode-OFF path is byte-for-byte unchanged -- no new file writes, no new
          // fields on the emitted event, when Answer Cache is OFF (the default).
          if (answerCacheModeOn) {
            recordAnswerCacheEvent({
              routing: 'flagship',
              // Real per-vendor pricing isn't wired into this meter yet -- ESTIMATED_QUERY_COST_USD
              // is the same substrate_router.ts convention used everywhere else in this meter,
              // labeled honestly as an estimate in the Prove It panel, not claimed as exact.
              cost_usd: result.error ? 0 : ESTIMATED_QUERY_COST_USD,
              latency_ms: result.latency_ms,
            });
          }

          // BP136 Yoke v2a (CSIA activation): post-hoc convergence-on-match logging. Only runs
          // when csia_mode is ON and Psionic produced a (sub-fast-path-confidence) prediction
          // earlier in this same query -- if the fast path had fired above, this function
          // already returned and this code is unreachable for that query. Never overrides or
          // replaces the flagship answer actually served below.
          let csiaConvergence: { matched: boolean; score: number } | undefined;
          // BP137 ADDENDUM FIX 4: tracks whether the convergence write below actually stored a
          // new record this request, so the research-gate call further down can skip its own
          // write instead of appending a near-duplicate JSONL line for the SAME answer under a
          // different provenance tag (confirmed live in the store: two Mark Twain duplicates,
          // provenance `csia:convergence:...` and `csia:csia_research:...`, ~6s apart).
          let csiaConvergenceStored = false;
          if (csiaModeOn && psionicPrediction && !result.error && result.content) {
            const score = computeAnswerConvergence(psionicPrediction.answer, result.content);
            const matched = score >= CSIA_CONVERGENCE_MATCH_THRESHOLD;
            csiaConvergence = { matched, score };
            recordCsiaEvent({
              kind: matched ? 'psionic_convergence_match' : 'psionic_no_convergence',
              confidence: psionicPrediction.confidence,
              corroboratingCount: psionicPrediction.corroboratingCount,
              latency_ms: result.latency_ms,
              cost_avoided_usd: 0,
            });
            console.log(`[CSIA] convergence check vs flagship answer: matched=${matched} score=${score.toFixed(2)}`);
            if (matched && isQaRelevant(currentTurnQuestion, result.content)) {
              try {
                await writeVerifiedEblet({
                  // BUG1 FIX: current-turn question only, never the multi-turn `userMessage`.
                  question: currentTurnQuestion,
                  answer: result.content,
                  provenance: `csia:convergence:${result.brain_id}:${Date.now()}`,
                  verified: true,
                  sha256: '',
                  timestamp: Date.now(),
                  class: 'whole_answer',
                  tic: {
                    known: [result.content],
                    theories_open: [],
                    eliminated: [],
                    dependencies_upstream: psionicPrediction.sourceQuestions,
                    applications_downstream: [],
                  },
                }, { computeSemanticCode: semanticModeOn });
                csiaConvergenceStored = true;
              } catch (err) {
                console.warn('[CSIA] TIC-tagged writeVerifiedEblet (convergence, flagship) failed:', err);
              }
            }
          }

          // BP136 Yoke v2b (CSIA research arm): concordance gate + TIC writes over the live
          // research context gathered earlier in this same query. Only runs when csia_research
          // fired above AND produced at least one surviving fact. Never overrides or replaces
          // the flagship answer actually served below -- on a non-concordant verdict, nothing
          // is written and the answer below is served exactly as the normal path already
          // produced it.
          let csiaResearchResult: { concordant: boolean; stored: boolean; sources: string[] } | undefined;
          if (csiaResearchOn && csiaResearchSurvivors.length > 0 && !result.error && result.content) {
            const gateResult = await runCsiaConcordanceGateAndStore({
              // BUG1 FIX: current-turn question only -- this flows straight into the eblet's
              // stored `question` field inside runCsiaConcordanceGateAndStore (csia_research.ts).
              userMessage: currentTurnQuestion, finalAnswer: result.content, survivors: csiaResearchSurvivors, sources: csiaResearchSources,
              ollamaBaseUrl: OLLAMA_API_BASE, model, method: 'csia_research', provenanceTag: `flagship:${result.brain_id}`,
              computeSemanticCode: semanticModeOn,
              // BP137 ADDENDUM FIX 4: skip this call's own write if convergence already stored
              // this exact answer above -- see csiaConvergenceStored's doc comment.
              skipWrite: csiaConvergenceStored,
            });
            csiaResearchResult = { concordant: gateResult.concordant, stored: gateResult.stored, sources: csiaResearchSources };
          }

          // BP136 Yoke v2c-2/v2c-3 (escalation recursion + CONTEXT verdict): only evaluated when
          // csia_research is on (recursion needs swarm access to widen authorities -- with it
          // off there is nothing new to fetch, so this whole block is skipped) AND nothing has
          // already converged this request (v2a's Psionic match OR v2b's research write above).
          // Bounded to CSIA_MAX_RECURSION_ROUNDS; on exhaustion returns a csiaContext verdict
          // that is ATTACHED to (never replaces) the flagship answer already computed above.
          let csiaContextVerdict: CsiaContextVerdict | undefined;
          const csiaFlagshipAlreadyConverged = Boolean(csiaConvergence?.matched) || Boolean(csiaResearchResult?.stored);
          if (csiaResearchOn && !csiaFlagshipAlreadyConverged && !result.error && result.content) {
            const recursionResult = await runCsiaRecursionAndContextVerdict(
              // BUG1 FIX: current-turn question only, same reasoning as the gate call above.
              currentTurnQuestion, result.content, OLLAMA_API_BASE, model,
              csiaResearchSurvivors, csiaResearchSources, `flagship:${result.brain_id}`,
              semanticModeOn,
            );
            if (recursionResult.contextVerdict) csiaContextVerdict = recursionResult.contextVerdict;
          }

          if (!event.sender.isDestroyed()) {
            event.sender.send('ask-token-complete', {
              content: result.content,
              error: result.error ?? undefined,
              hotHits: substrateCounters?.hotHits,
              selfContextLoaded: memoryMdContent.length > 0,
              brainId: result.brain_id,
              brainKind: result.kind,
              flagship: true,
              ...(answerCacheModeOn ? { servedFromSubstrate: false } : {}),
              ...(csiaConvergence ? { csiaConvergence } : {}),
              ...(csiaResearchResult?.stored ? { csiaResearch: true, csiaResearchSources: csiaResearchResult.sources } : {}),
              ...(csiaContextVerdict ? { csiaContext: csiaContextVerdict } : {}),
            });
          }
        })().finally(() => clearAppBusy());
        return { ok: true, streaming: true, brainId: activeBrain.brain_id, kind: 'flagship' };
      }

      // v0.1.57.1: Abort any in-flight stream before starting a new one (AbortController discipline)
      if (activeQueryController) {
        activeQueryController.abort();
        activeQueryController = null;
      }
      const queryController = new AbortController();
      activeQueryController = queryController;

      // v0.1.57.1: Cold-start detection — /api/ps check + sessionInferenceCount fallback
      let isColdStart = sessionInferenceCount === 0;
      if (!isColdStart) {
        try {
          const psCtrl = new AbortController();
          const psTmo = setTimeout(() => psCtrl.abort(), 3000);
          const psRes = await fetch(`${OLLAMA_API_BASE}/api/ps`, { signal: psCtrl.signal });
          clearTimeout(psTmo);
          const psData = await psRes.json() as { models?: Array<{ name: string }> };
          isColdStart = !(psData.models ?? []).some((m) => m.name === model);
        } catch {
          // /api/ps unavailable — fallback to sessionInferenceCount (already set above)
        }
      }

      if (isColdStart && !event.sender.isDestroyed()) {
        event.sender.send('ask-token-progress', { coldStart: true, delta: '', assembled: '' });
      }

      // v0.1.57.1: Stream NDJSON response tokens to renderer — fire-and-forget
      void (async () => {
        let assembled = '';
        const streamTimeout = setTimeout(() => queryController.abort(), 120_000);
        try {
          const res = await fetch(`${OLLAMA_API_BASE}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              messages: chatMessages,
              stream: true,
              options: { num_predict: 1024, temperature: 0.7 },
            }),
            signal: queryController.signal,
          });
          clearTimeout(streamTimeout);

          if (!res.ok) {
            if (!event.sender.isDestroyed()) {
              event.sender.send('ask-token-complete', { content: '', error: `Ollama request failed: ${res.statusText}` });
            }
            return;
          }

          const reader = res.body!.getReader();
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            for (const line of chunk.split('\n').filter((l) => l.trim())) {
              try {
                const parsed = JSON.parse(line) as { message?: { content?: string }; done?: boolean };
                if (parsed.message?.content) {
                  assembled += parsed.message.content;
                  markAppBusy(); // BP140-K3: renew the busy window on every streamed token
                  if (!event.sender.isDestroyed()) {
                    event.sender.send('ask-token-progress', { delta: parsed.message.content, assembled });
                  }
                }
                if (parsed.done) {
                  sessionInferenceCount++;
                  if (activeQueryController === queryController) activeQueryController = null;
                  // BP136 Yoke: meter -- local generation, with ('rag') or without
                  // ('local_generate') verified-eblet context injected. Real cost is $0
                  // either way (local compute, no cloud API call). Gated behind the mode flag
                  // so the mode-OFF path writes nothing new and emits no new event field.
                  if (answerCacheModeOn) {
                    recordAnswerCacheEvent({
                      routing: verifiedHits.length > 0 ? 'rag' : 'local_generate',
                      cost_usd: 0,
                      latency_ms: Date.now() - tQueryStart,
                    });
                  }
                  // BP136 Yoke v2a (CSIA activation): post-hoc convergence-on-match logging for
                  // the local-generation path, same convention as the flagship branch above.
                  // Only runs when csia_mode is ON and Psionic produced a (sub-fast-path) local
                  // prediction earlier in this same query. Never overrides the assembled answer
                  // actually served below.
                  let csiaConvergenceLocal: { matched: boolean; score: number } | undefined;
                  // BP137 ADDENDUM FIX 4: same de-dup tracking as the flagship branch above --
                  // see csiaConvergenceStored's doc comment there for the full rationale.
                  let csiaConvergenceStoredLocal = false;
                  if (csiaModeOn && psionicPrediction && assembled.length > 0) {
                    const score = computeAnswerConvergence(psionicPrediction.answer, assembled);
                    const matched = score >= CSIA_CONVERGENCE_MATCH_THRESHOLD;
                    csiaConvergenceLocal = { matched, score };
                    recordCsiaEvent({
                      kind: matched ? 'psionic_convergence_match' : 'psionic_no_convergence',
                      confidence: psionicPrediction.confidence,
                      corroboratingCount: psionicPrediction.corroboratingCount,
                      latency_ms: Date.now() - tQueryStart,
                      cost_avoided_usd: 0,
                    });
                    console.log(`[CSIA] convergence check vs local answer: matched=${matched} score=${score.toFixed(2)}`);
                    if (matched && isQaRelevant(currentTurnQuestion, assembled)) {
                      try {
                        await writeVerifiedEblet({
                          // BUG1 FIX: current-turn question only, never the multi-turn `userMessage`.
                          question: currentTurnQuestion,
                          answer: assembled,
                          provenance: `csia:convergence:local:${model}:${Date.now()}`,
                          verified: true,
                          sha256: '',
                          timestamp: Date.now(),
                          class: 'whole_answer',
                          tic: {
                            known: [assembled],
                            theories_open: [],
                            eliminated: [],
                            dependencies_upstream: psionicPrediction.sourceQuestions,
                            applications_downstream: [],
                          },
                        }, { computeSemanticCode: semanticModeOn });
                        csiaConvergenceStoredLocal = true;
                      } catch (err) {
                        console.warn('[CSIA] TIC-tagged writeVerifiedEblet (convergence, local) failed:', err);
                      }
                    }
                  }
                  // BP136 Yoke v2b (CSIA research arm): concordance gate + TIC writes, local-
                  // generation path, same convention as the flagship branch above. Only runs
                  // when csia_research fired earlier in this same query AND produced at least
                  // one surviving fact. On a non-concordant verdict, nothing is written and the
                  // assembled answer below is served exactly as the normal path already
                  // produced it -- this block never overrides it.
                  let csiaResearchResultLocal: { concordant: boolean; stored: boolean; sources: string[] } | undefined;
                  if (csiaResearchOn && csiaResearchSurvivors.length > 0 && assembled.length > 0) {
                    const gateResult = await runCsiaConcordanceGateAndStore({
                      // BUG1 FIX: current-turn question only.
                      userMessage: currentTurnQuestion, finalAnswer: assembled, survivors: csiaResearchSurvivors, sources: csiaResearchSources,
                      ollamaBaseUrl: OLLAMA_API_BASE, model, method: 'csia_research', provenanceTag: `local:${model}`,
                      computeSemanticCode: semanticModeOn,
                      // BP137 ADDENDUM FIX 4: skip this call's own write if convergence already
                      // stored this exact answer above.
                      skipWrite: csiaConvergenceStoredLocal,
                    });
                    csiaResearchResultLocal = { concordant: gateResult.concordant, stored: gateResult.stored, sources: csiaResearchSources };
                  }
                  // BP136 Yoke v2c-1 (verified LOCAL write-back): closes the Founder-found gap --
                  // v1's own write-back (see the `answerCacheModeOn && !result.error ...` block
                  // in the flagship branch above) is FLAGSHIP-ONLY; a local/free answer was never
                  // cached even when correct, so the same question asked twice on gemma4:12b ran
                  // two fresh $0-but-slow model calls instead of one. Fix: run the SAME sealed-
                  // answer-free concordance gate v2b already wired (runGiantConcordance, via
                  // runCsiaConcordanceGateAndStore) directly against the raw local answer -- no
                  // fetched facts needed, survivors/sources are empty, only the local model's own
                  // answer is being verified. If CONCORDANT, write it back with
                  // method:'local_verified' so the NEXT ask (v1's cache-read at ~line 434 is
                  // unconditional/model-agnostic -- re-verified fresh this session, runs before
                  // the flagship/local branch split) serves it verbatim at $0 regardless of which
                  // model answers next. Skipped if v2b's research arm ALREADY stored an answer
                  // for this exact request (avoids a redundant second concordance call + write).
                  // NEVER writes a non-concordant local answer (honesty firewall, same as v2b).
                  let csiaLocalVerified: { concordant: boolean; stored: boolean } | undefined;
                  // BP137 ADDENDUM FIX 4 (same bug class, found by inspection beyond the spec's
                  // cited line range): this v2c-1 write path was already correctly skipped when
                  // v2b's research arm stored above (!csiaResearchResultLocal?.stored), but was
                  // NOT skipped when v2a's convergence check stored above instead -- a third
                  // instance of the identical convergence-vs-other-write duplicate risk. Added
                  // the same csiaConvergenceStoredLocal guard here for consistency.
                  if (csiaModeOn && assembled.length > 0 && !csiaResearchResultLocal?.stored && !csiaConvergenceStoredLocal) {
                    const gateResult = await runCsiaConcordanceGateAndStore({
                      // BUG1 FIX: current-turn question only.
                      userMessage: currentTurnQuestion, finalAnswer: assembled, survivors: [], sources: [],
                      ollamaBaseUrl: OLLAMA_API_BASE, model, method: 'local_verified', provenanceTag: `local:${model}`,
                      computeSemanticCode: semanticModeOn,
                      skipWrite: csiaConvergenceStoredLocal,
                    });
                    csiaLocalVerified = { concordant: gateResult.concordant, stored: gateResult.stored };
                    console.log(`[CSIA] local write-back: concordant=${gateResult.concordant} stored=${gateResult.stored}`);
                  }
                  // BP136 Yoke v2c-2/v2c-3 (escalation recursion + CONTEXT verdict), local path.
                  // Same precedence as the flagship branch: only evaluated when csia_research is
                  // on (recursion needs swarm access) and nothing has already converged (v2a
                  // Psionic match, v2b research write, or v2c-1 local-verified write).
                  let csiaContextVerdictLocal: CsiaContextVerdict | undefined;
                  const csiaLocalAlreadyConverged =
                    Boolean(csiaConvergenceLocal?.matched) || Boolean(csiaResearchResultLocal?.stored) || Boolean(csiaLocalVerified?.stored);
                  if (csiaResearchOn && !csiaLocalAlreadyConverged && assembled.length > 0) {
                    const recursionResult = await runCsiaRecursionAndContextVerdict(
                      // BUG1 FIX: current-turn question only.
                      currentTurnQuestion, assembled, OLLAMA_API_BASE, model,
                      csiaResearchSurvivors, csiaResearchSources, `local:${model}`,
                      semanticModeOn,
                    );
                    if (recursionResult.contextVerdict) csiaContextVerdictLocal = recursionResult.contextVerdict;
                  }
                  if (!event.sender.isDestroyed()) {
                  // substrate R1: write complete assembled content on done:true
                  // SEG-2 v0.3.7: include selfContextLoaded for renderer feedback badge
                  event.sender.send('ask-token-complete', {
                    content: assembled,
                    hotHits: substrateCounters?.hotHits,
                    selfContextLoaded: memoryMdContent.length > 0,
                    ...(answerCacheModeOn ? { servedFromSubstrate: false } : {}),
                    ...(csiaResearchResultLocal?.stored ? { csiaResearch: true, csiaResearchSources: csiaResearchResultLocal.sources } : {}),
                    ...(csiaConvergenceLocal ? { csiaConvergence: csiaConvergenceLocal } : {}),
                    ...(csiaLocalVerified?.stored ? { csiaLocalVerified: true } : {}),
                    ...(csiaContextVerdictLocal ? { csiaContext: csiaContextVerdictLocal } : {}),
                  });
                  }
                }
              } catch { /* skip malformed NDJSON line */ }
            }
          }
        } catch (err) {
          clearTimeout(streamTimeout);
          const isAbort = (err as Error)?.name === 'AbortError';
          if (!event.sender.isDestroyed()) {
            event.sender.send('ask-token-complete', {
              content: assembled,
              error: isAbort ? 'Stream interrupted' : String(err),
            });
          }
        }
      })().finally(() => clearAppBusy());

      return { ok: true, streaming: true };
    },
  );

  // ── ai-dispatch:eblet-index-stats (SEG-6 / SEG-5) ───────────────────────
  // Returns EbletIndexStats for the substrate counter UI panel.
  ipcMain.handle('ai-dispatch:eblet-index-stats', () => {
    try {
      const stats = getEbletIndexStats();
      const verifiedFile = resolve(app.getPath('userData'), 'substrate', 'verified_eblets.jsonl');
      let verifiedCount = 0;
      if (existsSync(verifiedFile)) {
        try {
          const raw = readFileSync(verifiedFile, 'utf-8');
          verifiedCount = raw.split('\n').filter((l) => l.trim()).length;
        } catch { /* graceful */ }
      }
      return { ok: true, stats, verifiedCount };
    } catch (err) {
      return { ok: false, error: String(err), stats: null, verifiedCount: 0 };
    }
  });

  // ── ai-dispatch:answer-cache-meter-summary (BP136) ──────────────────────
  // Real, restart-surviving counters for the Prove It panel: served-free count, estimated
  // cloud cost avoided, latency. Reads the persisted JSONL log fresh on every call.
  ipcMain.handle('ai-dispatch:answer-cache-meter-summary', () => {
    try {
      return { ok: true, summary: getAnswerCacheMeterSummary() };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  // ── ai-dispatch:csia-meter-summary (BP136 Yoke v2a) ─────────────────────
  // Separate from the answer-cache-meter-summary handler above -- own file, own log, own
  // summary shape. Additive/new IPC channel; does not touch the v1 handler or its return shape.
  ipcMain.handle('ai-dispatch:csia-meter-summary', () => {
    try {
      return { ok: true, summary: getCsiaMeterSummary() };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  // ── BP087 Brain Registry IPC ──────────────────────────────────────────────

  // brain-registry:list -- returns all brains + active brain id
  // BP134 Task C: merges in any ACTUAL installed Ollama models (e.g. gemma2:9b) that
  // aren't already in the curated registry, so the ASK model selector (BrainSwapSelector)
  // never hides a pulled model behind a static allow-list.
  // BP134 Task D: on a genuine first run (no persisted brain_registry.json yet), also
  // corrects the default active brain to a free local model instead of a cloud flagship.
  ipcMain.handle('brain-registry:list', async () => {
    try {
      const installedModels = await getInstalledOllamaModelsSafe();
      if (installedModels.length > 0) {
        ensureFreeLocalDefaultOnFirstRun(installedModels);
      }
      const brains = installedModels.length > 0
        ? syncInstalledOllamaModels(installedModels)
        : getBrainRegistry();
      const active_brain_id = getActiveBrainId();
      return { ok: true, brains, active_brain_id };
    } catch (err) {
      return { ok: false, error: String(err), brains: DEFAULT_BRAINS, active_brain_id: 'gemma4-12b' };
    }
  });

  // brain-registry:get-active -- returns active brain id
  // BP134 Task D: same first-run free-local-default correction as brain-registry:list,
  // guarded so it only ever acts once (no-op once brain_registry.json exists on disk) --
  // needed here too because LeanAskTab calls list() and getActive() concurrently.
  ipcMain.handle('brain-registry:get-active', async () => {
    try {
      const installedModels = await getInstalledOllamaModelsSafe();
      if (installedModels.length > 0) {
        ensureFreeLocalDefaultOnFirstRun(installedModels);
      }
      return { ok: true, brain_id: getActiveBrainId() };
    } catch (err) {
      return { ok: false, error: String(err), brain_id: 'gemma4-12b' };
    }
  });

  // brain-registry:set-active -- sets active brain id, persists to userData
  ipcMain.handle('brain-registry:set-active', (_event, brain_id: string) => {
    try {
      setActiveBrainId(brain_id);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  // brain-registry:smoke-test -- fires one fixed question through the specified brain
  // Hardcoded smoke question: speed of light
  ipcMain.handle('brain-registry:smoke-test', async (_event, brain_id: string) => {
    try {
      const brains = getBrainRegistry();
      const brain: BrainEntry | undefined = brains.find((b) => b.brain_id === brain_id) ?? getActiveBrain();
      if (!brain) {
        return { ok: false, error: `Brain not found: ${brain_id}` };
      }
      const smokeQuestion = [
        {
          role: 'user',
          content:
            'What is the speed of light in a vacuum? ' +
            'A) 3x10^8 m/s B) 3x10^6 m/s C) 3x10^10 m/s D) 3x10^4 m/s. ' +
            'Reply with only the letter.',
        },
      ];
      const result = await dispatchViaBrain(brain, smokeQuestion);
      return {
        ok: result.error === null,
        content: result.content,
        brain_id: result.brain_id,
        kind: result.kind,
        latency_ms: result.latency_ms,
        error: result.error ?? undefined,
      };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
}
