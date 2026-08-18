// ai_dispatch_ipc.ts -- BP077 v0.1.27 Mnem-as-interface substrate baked in
// Handles: ai-dispatch:query, list-local-models, test-connection, get-settings, save-settings
// Routes local queries through Ollama /api/chat with r10v3 substrate system-prompt layer.
// SKU gate: nano skips Mnem-DRT pipeline; core/lite use mnem_drt_enabled flag; full always runs.
// Eblet compose: top-3 local eblet snippets prepended to user message when Mnem-DRT active.
// BP087 Brain Swap: brain-registry:list, brain-registry:get-active, brain-registry:set-active,
//   brain-registry:smoke-test -- routing bifurcation for local vs flagship brains.
// BP145-M4: Slice 1, verified-LOCAL answer-cache write-back reachable under answer_cache_mode
//   alone (search "BP145-M4 Slice 1"). Slice 2, the escalation ladder -- substrate hit, local
//   model, deterministic solver (honestly skipped, no free-text-reachable form exists), cheap
//   cloud, flagship -- gated behind escalation_ladder_mode, triggered only by honest abstention
//   (search "BP145-M4 Slice 2"). Canon: canon_escalation_is_triggered_by_honest_abstention_
//   never_scheduled_bp144.
// D-BP148-022: escalation_ladder_mode now DEFAULTS ON (was off) -- local Ollama (TIER 1) is the
//   first MODEL rung after the rooted answer-cache, and an explicit active-flagship brain pick
//   still bypasses the ladder entirely (search "explicitFlagshipPick"). TIER 1 also now prefers
//   the strongest confirmed-installed local model (search "PREFERRED_LOCAL_FIRST_MODEL") unless
//   the user made an explicit model pick.

import { ipcMain } from 'electron';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { app } from 'electron';
import { FLOOR_MODEL } from '../shared/floor-model';
// D-BP157-029/BISHOP/seg-rewire-vram-gate: the VRAM gate (D-BP157-025's detector) previously
// governed only the LEAN installer's first-run pick and the Settings UI display -- it was never
// consulted on this file's two live-answer model-resolution chains (see
// SEG_RETURN_BP157_021_VRAM_GATE.md section 2, chain A). detectVramGbDetailed/applyVramGate/
// requiredVramGb are used below by resolveVramGatedModel(); ram_detector.ts itself is NOT
// modified by this dispatch (D-BP157-026 is concurrently editing it -- coordination note in this
// dispatch's own ticket).
import { applyVramGate, requiredVramGb, detectVramGbDetailed, type VramDetectionResult } from './hardware/ram_detector';
// D-BP151-037/BISHOP/seg-query-capture-archive
import { captureQuery } from './query_capture/query_capture_store';
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
// BP145-M4 Slice 2: additive import of ESTIMATED_CHEAP_CLOUD_QUERY_COST_USD for the escalation
// ladder's TIER 3 (cheap cloud) meter record.
import { recordAnswerCacheEvent, getAnswerCacheMeterSummary, ESTIMATED_QUERY_COST_USD, ESTIMATED_CHEAP_CLOUD_QUERY_COST_USD } from './answer_cache_meter';
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
// KN-BP146-M6: THE NEXUS's own host/port, so the 'ai-dispatch:query-engine' handler's engine
// call below can route through it instead of straight to raw Ollama. This file does not create
// an import cycle with openai_compat_server.ts (only canonical_pipeline.ts <-> that file has one
// -- see canonical_pipeline.ts's own KN-BP146-M6 comment for that fork-in-the-road).
import { OPENAI_COMPAT_SERVER_HOST, OPENAI_COMPAT_SERVER_PORT } from './openai_compat_server';
// D-BP155-029/BISHOP/seg-meter-net-and-auditlist: the substrate savings meter (billing
// instrument, substrate_savings_receipt.ts). Its 'cloud_escalation' tier previously only ever
// received UNMEASURED input from substrate_api.ts's /substrate/query -> SubstrateRouter path,
// whose own cloud_escalation branch is a routing SIGNAL that never itself makes a network call
// (see substrate_router.ts Step 3's comment) -- the survivorship-bias defect the Founder ordered
// closed. THIS file is where the codebase's real cloud spend actually happens (TIER 3 cheap
// cloud, TIER 4 flagship, and the explicit-flagship-brain-pick branch, all via dispatchViaBrain()
// below), and was never wired to the meter at all before this ticket. See
// _emitCloudEscalationSavingsReceipt() and its three call sites (search this file for that name).
import { emitSavingsReceipt } from './substrate_savings_receipt';

const OLLAMA_API_BASE = 'http://127.0.0.1:11434';
// KN-BP146-M6: THE NEXUS's own address. Used ONLY at the 'ai-dispatch:query-engine' handler's
// runCanonicalFreeTextQuestion(...) call site below -- every other OLLAMA_API_BASE call site in
// this file (the /api/ps cold-start liveness check, the now-orphaned 'ai-dispatch:query' handler,
// etc.) is deliberately left untouched and keeps hitting raw Ollama directly; out of this
// ticket's scope per KN-BP146-M6.
const NEXUS_LOCAL_URL = `http://${OPENAI_COMPAT_SERVER_HOST}:${OPENAI_COMPAT_SERVER_PORT}`;

// BP145-M4 Slice 2 (the escalation ladder, TIER 3 cheap cloud): a real, working Anthropic
// model id already used elsewhere in this codebase for a real API call (agent_probe.ts's own
// ping/health-check, model: 'claude-haiku-4-7') -- reused verbatim, not invented for this
// ticket. Declared inline here rather than added to brain_registry.ts's DEFAULT_BRAINS,
// because brain_registry.ts is not among this ticket's owned files. Dispatched through the
// SAME dispatchViaBrain() the existing flagship branch already uses -- kind:'flagship' is
// correct here (dispatchViaBrain's 'flagship' branch is a generic Anthropic Messages API
// caller, not literally restricted to the Opus/Sonnet capability tier).
const CHEAP_CLOUD_BRAIN: BrainEntry = {
  brain_id: 'claude-haiku-4-7',
  vendor: 'anthropic',
  model_id: 'claude-haiku-4-7',
  kind: 'flagship',
  api_endpoint: 'https://api.anthropic.com',
  cost_per_1k_tokens: 0.001,
  capability_tier: 3,
  status: 'available',
};

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

// D-BP155-029/BISHOP/seg-meter-net-and-auditlist: emits one substrate-savings-meter receipt
// (tier: 'cloud_escalation') for a REAL cloud call this file just made via dispatchViaBrain()'s
// flagship branch -- the codebase's actual real-money cloud-call site, previously never wired to
// the meter at all. Carries dispatchViaBrain()'s REAL Anthropic-usage-reported input_tokens/
// output_tokens straight through to emitSavingsReceipt() -- never estimated, never guessed: those
// fields are `number | null` on SEGResultEnvelope, null exactly when the provider did not report
// them (an errored/no-credential call never reached the network, or the response omitted usage)
// or no call was attempted, which correctly resolves the receipt to UNMEASURED rather than a
// fabricated number (see emitSavingsReceipt's cloud_escalation branch in
// substrate_savings_receipt.ts). Called unconditionally after every dispatchViaBrain() call at a
// paid rung (success or failure) so a failed/blocked cloud attempt is itself an honest record,
// not a silent gap -- exactly the "what it could NOT measure as prominently as what it could"
// discipline the meter's own header names. Exported (not private) so a compiled-dist test
// harness (this file's existing convention, see ai_dispatch_ipc_escalation_ladder.test.ts) can
// exercise it directly. Non-fatal by design, mirrors substrate_api.ts's own _emitSavingsReceipt:
// a receipt-write failure must never break the answer the user is waiting on.
export function _emitCloudEscalationSavingsReceipt(
  result: SEGResultEnvelope,
  routingRaw: string,
): void {
  try {
    emitSavingsReceipt({
      tier: 'cloud_escalation',
      routing_raw: routingRaw,
      model_used: result.model_id,
      input_tokens: result.input_tokens,
      output_tokens: result.output_tokens,
      served_text_chars: result.content ? result.content.length : null,
      latency_ms: result.latency_ms,
      // This IPC handler has no notion of substrate_api.ts's global degraded-mode flag (that
      // belongs to the separate HTTP /substrate/query path) -- false here means "not
      // applicable to this pipeline", never a claim that degraded mode was checked and found off.
      degraded: false,
    });
  } catch (err) {
    console.warn('[ai_dispatch_ipc] cloud-escalation savings receipt emit failed (non-fatal):', err);
  }
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
   *  ai-dispatch:query. DEFAULTS ON as of D-BP148-014/BISHOP (Founder BP148 ruling, opening
   *  this gate is what makes the already-ON semantic_soccerball_mode flag reachable) --
   *  undefined resolves true; set explicitly to `false` to opt back out (ANSWER_CACHE_MODE=1
   *  can still force it on over an explicit false, same OR semantics as before). With it off,
   *  ai-dispatch:query behaves byte-for-byte as it did before this Yoke. */
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
   *  path (see semantic_soccerball.ts + the SIMILARITY branch below). DEFAULTS ON as of
   *  D-BP148-003/BISHOP/M4 (Founder BP148 ruling, "it needs to be on by default") -- undefined
   *  resolves true; set explicitly to `false` to opt back out (SEMANTIC_SOCCERBALL_MODE=1 can
   *  still force it on over an explicit false, same OR semantics as before). With it off, or
   *  with it on but ollamaManager.embed() unavailable for a given request, behavior is
   *  byte-identical to the existing token-similarity-only path. INDEPENDENT of answer_cache_mode
   *  and csia_mode as flags/resolvers, but NOT independent in reachability: there are TWO call
   *  sites that consume this flag, and each sits inside a gate that still DEFAULTS OFF -- the
   *  read-side serve-gate below is reached only when answer_cache_mode is also on, and a second,
   *  mandatory "semantic floor" check is reached only when csia_mode is also on. This flag
   *  resolving true is necessary but not sufficient for the semantic path to run in a default
   *  install, since neither of those gates is open by default. */
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
  /** BP145-M4 Slice 2: gates the escalation-ladder dispatch path in ai-dispatch:query (TIER 1
   *  local-model honest-abstention check -> TIER 2 deterministic solver, honestly skipped, no
   *  free-text-reachable form exists -> TIER 3 cheap cloud -> TIER 4 flagship). DEFAULTS ON as
   *  of D-BP148-022/BISHOP (Founder BP148 ruling, "make local Ollama the first rung of
   *  dispatch") -- undefined (every settings file written before this flip) resolves true; an
   *  explicit `false` in settings is the opt-out and resolves false unless the env var forces
   *  it back on. Mirrors isAnswerCacheModeEnabled()/isSemanticSoccerballModeEnabled()'s exact
   *  shape and the same precedent (both flipped ON the same way this campaign). With it on,
   *  ai-dispatch:query tries TIER 1 (100% local/free) FIRST and reaches TIER 3/4 (paid) only on
   *  a real honest abstention signal from the tier below -- never a timer, never a default, never
   *  low confidence (see canon_escalation_is_triggered_by_honest_abstention_never_scheduled_bp144
   *  and the escalationLadderModeOn call site below, which ALSO now defers to an explicit
   *  active-flagship brain pick -- see `explicitFlagshipPick` at that call site: this flag
   *  changes the DEFAULT, never a user's explicit provider ceiling). INDEPENDENT of
   *  answer_cache_mode/csia_mode/semantic_soccerball_mode -- this flag only controls WHICH
   *  routing decision is made, not whether TIER 0 (the answer-cache serve gate + CSIA fast
   *  path, both unconditional/always-checked earlier in the same handler) runs. */
  escalation_ladder_mode?: boolean;
  /** D-BP148-024/BISHOP (Ask Tab Ladder Wiring): money-safety gate for the escalation ladder's
   *  PAID rungs only (TIER 3 cheap cloud, TIER 4 flagship) -- distinct from escalation_ladder_mode
   *  above, which gates the whole ladder including the free TIER 1 rung, and distinct from the
   *  pre-existing explicit-flagship-brain-pick branch below (search "money-safety gate" at that
   *  call site), which this flag ALSO now covers. Founder is out of budget (Cursor allowance
   *  exhausted, does not reset until 2026-09-02); wiring the Ask tab to a ladder (or a live
   *  flagship-brain path) that silently starts spending money the moment TIER 1 abstains, or the
   *  moment a flagship brain is active, would be a serious harm. UNLIKE every other mode flag in
   *  this file, this one DEFAULTS OFF -- undefined resolves false. See isPaidEscalationEnabled()
   *  below: reaching a paid call requires BOTH this flag explicitly true AND a real configured
   *  Anthropic credential (resolveAnthropicApiKey()); either one missing stops at the last free
   *  tier / blocks the flagship dispatch and reports an honest abstain, never a silent paid call.
   *  No settings UI writes this flag yet (out of this ticket's scope, LeanAskTab.tsx + this file
   *  only) -- today it can only be set via a hand-edited settings file or the
   *  PAID_ESCALATION_ENABLED=1 env var (same override convention as every other flag here). */
  paid_escalation_enabled?: boolean;
  /** D-BP148-045/BISHOP (Wrasse Serving Path): gates canon-substrate injection -- the
   *  914-record production doctrine corpus at {userData}/mnemosynec/substrate/eblet_index.jsonl,
   *  queried via queryEbletStoreWithProvenance() (mnem_eblet_store.ts) and relevance-filtered
   *  via semantic_relevance_gate.ts's existing 0.58-cosine gate -- into
   *  mesh_test/substrate_toggle.ts's applySubstrateToggle(), the single authoritative
   *  substrate-injection site for the plow-answering path scripts/mesh-test-cli.mjs exercises.
   *  Distinct from that same function's PRE-EXISTING queryVerifiedEbletsTopical() call (reads
   *  verified_eblets.jsonl, a different, self-written Q&A cache) -- this flag governs ONLY the
   *  NEW canon-corpus query this ticket adds; the old call is unaffected either way. Same
   *  precedent shape as answer_cache_mode/semantic_soccerball_mode/escalation_ladder_mode/
   *  generator_cascade_mode: undefined resolves true; explicit `false` in settings is the
   *  opt-out (CANON_SUBSTRATE_SERVE_MODE=1 env var can still force it back on over an explicit
   *  false, same OR semantics as the other four). See isCanonSubstrateServeModeEnabled() below
   *  and its standalone reader isCanonSubstrateServeModeEnabledNow() (for modules outside this
   *  file, e.g. substrate_toggle.ts, that want this one flag without importing this file's
   *  private loadSettings()/AiDispatchSettings machinery wholesale). */
  canon_substrate_serve_mode?: boolean;
}

/** BP136 Yoke: resolves the answer-cache mode flag from settings, with an env-var override
 *  (ANSWER_CACHE_MODE=1) for quick local testing without touching the settings file. DEFAULTS
 *  ON as of D-BP148-014/BISHOP (Founder BP148 ruling) -- undefined (every settings file written
 *  before this flip) resolves true; an explicit `false` in settings is the opt-out and resolves
 *  false unless the env var forces it back on. Mirrors isSemanticSoccerballModeEnabled()'s
 *  exact shape below. */
function isAnswerCacheModeEnabled(settings: AiDispatchSettings): boolean {
  if (settings.answer_cache_mode === false) {
    return process.env.ANSWER_CACHE_MODE === '1';
  }
  return true;
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
 *  var-override convention as the other resolvers in this file (SEMANTIC_SOCCERBALL_MODE=1
 *  forces it on regardless of the settings value). DEFAULTS ON as of D-BP148-003/BISHOP/M4
 *  (Founder BP148 ruling, "it needs to be on by default") -- undefined (every settings file
 *  written before this flip) resolves true; an explicit `false` in settings is the opt-out and
 *  resolves false unless the env var forces it back on. Does NOT by itself imply embeddings are
 *  actually available -- every call site must still check the per-request ollamaManager.embed()
 *  result (via semantic_soccerball_emit returning non-null) and fall back to the token path on
 *  null. Does NOT by itself imply the semantic path is REACHABLE, either: see the two call
 *  sites below, one nested under answer_cache_mode and one nested under csia_mode, both of
 *  which still default OFF -- this flag flipping true is necessary but not sufficient. */
function isSemanticSoccerballModeEnabled(settings: AiDispatchSettings): boolean {
  // D-BP148-003/BISHOP/M4/seg-m4bishop1: default flipped ON per Founder BP148 direct instruction.
  // undefined -> true (new default); explicit false -> off; explicit true -> true; env var keeps
  // its pre-existing OR-in behavior (can force on even over an explicit false in settings).
  if (settings.semantic_soccerball_mode === false) {
    return process.env.SEMANTIC_SOCCERBALL_MODE === '1';
  }
  return true;
}

/** BP145-M4 Slice 2 / D-BP148-022: resolves the escalation_ladder_mode flag, same env-var-
 *  override convention as every other mode resolver in this file (ESCALATION_LADDER_MODE=1
 *  for quick local testing without touching the settings file). DEFAULTS ON as of
 *  D-BP148-022/BISHOP (Founder BP148 ruling) -- undefined resolves true; an explicit `false`
 *  in settings is the opt-out and resolves false unless the env var forces it back on. Exact
 *  same shape as isAnswerCacheModeEnabled()/isSemanticSoccerballModeEnabled() above. */
export function isEscalationLadderModeEnabled(settings: AiDispatchSettings): boolean {
  if (settings.escalation_ladder_mode === false) {
    return process.env.ESCALATION_LADDER_MODE === '1';
  }
  return true;
}

/** D-BP148-024/BISHOP: resolves whether ai-dispatch:query is allowed to reach a PAID call --
 *  either the escalation ladder's TIER 3/4 rungs, or the pre-existing explicit-flagship-brain-
 *  pick branch (both call sites check this same function -- search "money-safety gate"). See
 *  paid_escalation_enabled's own doc comment above for the full rationale -- in one line:
 *  DEFAULTS OFF (opposite of every other flag in this file), and requires BOTH an explicit
 *  opt-in AND a real configured credential. Deliberately reuses resolveAnthropicApiKey()
 *  (user_anthropic_key.ts) rather than reading process.env.ANTHROPIC_API_KEY directly, so this
 *  checks the EXACT same credential dispatchViaBrain() itself will use, never a stale/different
 *  notion of "configured". */
export function isPaidEscalationEnabled(settings: AiDispatchSettings): boolean {
  const optedIn = settings.paid_escalation_enabled === true || process.env.PAID_ESCALATION_ENABLED === '1';
  return optedIn && Boolean(resolveAnthropicApiKey());
}

/** D-BP148-045/BISHOP: resolves the canon_substrate_serve_mode flag, same env-var-override
 *  convention as every other mode resolver in this file (CANON_SUBSTRATE_SERVE_MODE=1 for
 *  quick local testing without touching the settings file). DEFAULTS ON, same shape as
 *  isAnswerCacheModeEnabled()/isSemanticSoccerballModeEnabled()/isEscalationLadderModeEnabled()
 *  above -- undefined resolves true; an explicit `false` in settings is the opt-out and
 *  resolves false unless the env var forces it back on. */
export function isCanonSubstrateServeModeEnabled(settings: AiDispatchSettings): boolean {
  if (settings.canon_substrate_serve_mode === false) {
    return process.env.CANON_SUBSTRATE_SERVE_MODE === '1';
  }
  return true;
}

/** D-BP148-045/BISHOP: standalone reader for modules outside this file (mesh_test/
 *  substrate_toggle.ts, the caller this ticket adds) that need this ONE flag's resolved value
 *  without importing this file's private loadSettings()/getSettingsPath() or its whole
 *  AiDispatchSettings surface. Reads the exact same settings file loadSettings() below reads;
 *  never throws (loadSettings() itself already fails soft to the default object on any read/
 *  parse error, so this resolves true in that case too, same as every other flag here). */
export function isCanonSubstrateServeModeEnabledNow(): boolean {
  return isCanonSubstrateServeModeEnabled(loadSettings());
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

// D-BP148-022: the escalation ladder's TIER 1 model preference. llama3.3:70b is Founder-
// confirmed live at 127.0.0.1:11434, free, unlimited, no rate window -- a materially stronger
// model than gemma4:12b (the FLOOR_MODEL/selectedGemmaModel default TIER 1 would otherwise
// fall back to). Preferring strength over speed on THIS ONE rung is deliberate: TIER 1's
// answer/abstain decision is the one gate that decides whether a paid tier gets reached at
// all, so a weak model either abstaining when a stronger one wouldn't, or (worse) answering
// wrong with confidence, is exactly the "cheap and wrong" failure this ticket names -- and
// unlike a paid tier, there is no cost reason to save the strong local model for later. A
// two-step size ladder INSIDE Ollama (try gemma4:12b first, escalate to llama3.3:70b only on
// its own abstain) was considered and rejected for this pass: it would add a second full
// specialist-swarm+Furnace+Three-Fates pass (the expensive part, not raw chat completion --
// see KN-BP145-M4_REPORT.md) before ever reaching TIER 1's own abstain signal, likely costing
// MORE wall-clock than going straight to the strong model once, for an unmeasured quality
// gain. Left as a documented option, not implemented, per HARDWIRE-17 (ordinary tier, no
// novel design this pass).
const PREFERRED_LOCAL_FIRST_MODEL = 'llama3.3:70b';

/** D-BP148-022: resolves the model TIER 1 dispatches to. Honors explicit user intent FIRST --
 *  `explicitModel` is the caller's precomputed result of the existing three-level precedence
 *  chain (args.model_override ?? activeBrainLocalModel ?? settings.preferred_model); when any
 *  of those fired, `explicitModel` is non-empty and this function returns `fallbackModel`
 *  (the caller's own fully-resolved `model` variable) completely untouched -- this never
 *  overrides a real user pick, and that returned `fallbackModel` was itself already run through
 *  resolveVramGatedModel() at the call site (D-BP157-029) with wasExplicit=true, so the explicit
 *  branch here needs no gate of its own; the record, if any, was already logged there. Only when
 *  NONE of those three fired (the caller was about to fall through to selectedGemmaModel/
 *  FLOOR_MODEL) does this check whether the stronger PREFERRED_LOCAL_FIRST_MODEL is actually
 *  installed and reachable, and prefer it. Non-fatal on any Ollama-reachability error -- falls
 *  back to `fallbackModel` exactly as before this ticket.
 *
 *  D-BP157-042/BISHOP/seg-close-loose-ends: D-BP157-029 gated the three OTHER answer-time model
 *  chains against detected VRAM and flagged this preference rung as a FOURTH, ungated mechanism
 *  -- PREFERRED_LOCAL_FIRST_MODEL (llama3.3:70b) requires ~48 GB VRAM (measured disk-basis
 *  weight, see ram_detector.ts MODEL_WEIGHTS_GB) and was being selected purely on "is it
 *  installed," never checked against what the machine actually has (M0's real card measures
 *  15.92 GB) -- exactly the hazard the gate exists to prevent. Gated here the same way: the
 *  preference is now validated against detected VRAM before being returned, and steps DOWN to
 *  `fallbackModel` (itself already VRAM-gated by the caller, see above) when it does not fit,
 *  always with a console.warn record, never silent. Unknown VRAM (vramGb === null) PERMITS the
 *  preference through unchanged, with a record, same policy as resolveVramGatedModel's own
 *  vramGb===null branch -- an unmeasured machine is not a small machine. Note: llama3.3:70b has
 *  no entry in ram_detector.ts's MODEL_STEP_DOWN_LADDER, so applyVramGate()/resolveVramGatedModel
 *  would return it unchanged with only an advisory note rather than stepping it down (no smaller
 *  fallback known to the ladder for it) -- `fallbackModel` is used as this rung's step-down
 *  target instead, since it is the caller's own next-best, already-validated choice, not a value
 *  this function invents. `detector` is injectable so tests can exercise both branches without a
 *  real GPU, mirroring resolveVramGatedModel's own injectable-detector pattern; production call
 *  sites rely on the default (cached real detector, shared with the other three chains). */
export async function resolveTier1Model(
  explicitModel: string | undefined,
  fallbackModel: string,
  detector: () => VramDetectionResult = getCachedVramDetectionForAsk,
): Promise<string> {
  if (explicitModel) return fallbackModel;
  try {
    const installed = await getInstalledOllamaModelsSafe();
    if (installed.includes(PREFERRED_LOCAL_FIRST_MODEL)) {
      const detailed = detector();
      if (detailed.vramGb === null) {
        console.warn(`[VramGate] resolveTier1Model: VRAM undetectable (method=${detailed.method}, confidence=${detailed.confidence}) -- permitting preferred local model ${PREFERRED_LOCAL_FIRST_MODEL} without a fit check`);
        return PREFERRED_LOCAL_FIRST_MODEL;
      }
      const required = requiredVramGb(PREFERRED_LOCAL_FIRST_MODEL);
      if (required === null || detailed.vramGb >= required) {
        return PREFERRED_LOCAL_FIRST_MODEL;
      }
      console.warn(`[VramGate] resolveTier1Model: preferred local model ${PREFERRED_LOCAL_FIRST_MODEL} needs ~${required} GB VRAM; detected VRAM ${detailed.vramGb} GB (method=${detailed.method}, confidence=${detailed.confidence}) is insufficient -- stepped down to ${fallbackModel}`);
      return fallbackModel;
    }
  } catch {
    // non-fatal -- fall back to the caller's existing resolution
  }
  return fallbackModel;
}

// ── D-BP157-029/BISHOP/seg-rewire-vram-gate: VRAM gate consultation ───────────────────────────
//
// Precedence (per the dispatch ruling): an EXPLICIT caller-supplied model (args.model_override)
// is authoritative -- a human naming a model in the Ask model picker is an intentional act, and
// is honored as-is even if it does not fit, per task 1's ruling. Everything BELOW that --
// activeBrainLocalModel (a persisted brain_registry.json pick, which may itself just be the
// VRAM-blind "biggest installed gemma wins" first-run heuristic, not a deliberate re-pick --
// see task 4), settings.preferred_model, selectedGemmaModel, and the hardcoded FLOOR_MODEL floor
// -- is machine-made or possibly-stale, so it IS validated against detected VRAM and may be
// stepped down. The persisted-choice bug (task 4): this function NEVER writes back to
// brain_registry.json or settings -- the downgrade applies only to the `model` variable used for
// THIS single answer; the persisted active_brain_id is left exactly as the user (or the
// first-run heuristic) set it, so a later machine with more VRAM (or a corrected persisted pick)
// is never permanently pinned by an in-memory decision made here.
//
// Unknown VRAM (detectVramGbDetailed() confidence: 'unknown', e.g. the Windows CIM uint32
// ~4 GiB ceiling defect D-BP157-025 fixed) is PERMITTED, never silently downgraded and never
// blocked -- applyVramGate's own vramGb===null branch already implements exactly this ("falls
// back to the RAM-tier recommendation with an honest note"), reused here unchanged.
export interface VramGateOutcome {
  /** The model actually to be used for this answer. */
  model: string;
  requestedModel: string;
  wasExplicit: boolean;
  downgraded: boolean;
  vramGb: number | null;
  vramMethod: string;
  vramConfidence: string;
  requiredVramGbForRequested: number | null;
  /** Legible record, present whenever the gate has anything to say (downgrade, insufficient-
   *  but-honored-explicit-pick, or unknown-VRAM permit) -- never silent. */
  note?: string;
}

// VRAM is static per machine/session; detectVramGbDetailed()'s Windows branch execSyncs a
// PowerShell registry query, which is fine as a rare (Settings UI / first-run) cost but would be
// a real per-query latency regression if run synchronously on every single 'ai-dispatch:query'
// call -- this file's two model-resolution chains never touched hardware detection before this
// dispatch. Cached once per process, mirroring ram_detector.ts's own _cachedEffectiveModel
// singleton pattern (ram_detector.ts is not editable by this dispatch, so the cache lives here).
let _cachedVramDetectionForAsk: VramDetectionResult | null = null;
function getCachedVramDetectionForAsk(): VramDetectionResult {
  if (_cachedVramDetectionForAsk === null) {
    _cachedVramDetectionForAsk = detectVramGbDetailed();
  }
  return _cachedVramDetectionForAsk;
}

/** Consults the VRAM gate for a resolved candidate model. `detector` is injectable so the test
 *  suite stays fully offline (see ai_dispatch_ipc_vram_gate.test.ts) -- production call sites
 *  below rely on the default (cached real detector). */
export function resolveVramGatedModel(
  requestedModel: string,
  wasExplicit: boolean,
  detector: () => VramDetectionResult = getCachedVramDetectionForAsk,
): VramGateOutcome {
  const detailed = detector();
  const required = requiredVramGb(requestedModel);

  if (wasExplicit) {
    // Never downgraded -- see the module-level rationale above. Still recorded, never silent.
    let note: string | undefined;
    if (required !== null && detailed.vramGb !== null && detailed.vramGb < required) {
      note = `Explicit model_override "${requestedModel}" needs ~${required} GB VRAM; detected VRAM ${detailed.vramGb} GB (method=${detailed.method}, confidence=${detailed.confidence}) is insufficient -- honoring the explicit pick anyway, expect CPU-split slowdown`;
    }
    return {
      model: requestedModel, requestedModel, wasExplicit: true, downgraded: false,
      vramGb: detailed.vramGb, vramMethod: detailed.method, vramConfidence: detailed.confidence,
      requiredVramGbForRequested: required, note,
    };
  }

  const gated = applyVramGate(requestedModel, detailed.vramGb);
  const chosen = gated.model ?? requestedModel;
  return {
    model: chosen, requestedModel, wasExplicit: false, downgraded: chosen !== requestedModel,
    vramGb: detailed.vramGb, vramMethod: detailed.method, vramConfidence: detailed.confidence,
    requiredVramGbForRequested: required, note: gated.note,
  };
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
      // BP145-M4 Slice 2: additive, mirrors the homework_idle_threshold_seconds line above.
      if (incoming.escalation_ladder_mode !== undefined) updated.escalation_ladder_mode = incoming.escalation_ladder_mode;
      // D-BP148-045/BISHOP: additive, mirrors the escalation_ladder_mode line above.
      if (incoming.canon_substrate_serve_mode !== undefined) updated.canon_substrate_serve_mode = incoming.canon_substrate_serve_mode;
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

      // D-BP151-037/BISHOP/seg-query-capture-archive: capture the query the Founder just
      // composed and sent, so it can be found again without retyping it (the felt problem
      // this ticket exists to fix). Fire-and-forget, non-blocking, never throws into the real
      // Ask flow below: captureQuery() checks the Substrate Processing switch first
      // (query_capture_settings.ts) and writes nothing at all when it is off (the default).
      // Captures the LAST user-role message only -- this handler's `messages` array is a
      // single fresh turn per KN-BP144-8's own scope-limit comment further down this file
      // ("the engine takes a single free-text question, not this tab's multi-turn history"),
      // so the last user message IS this turn's composed query.
      try {
        const lastUserMsg = [...args.messages].reverse().find((m) => m.role === 'user');
        if (lastUserMsg?.content) {
          captureQuery({ question: lastUserMsg.content, source: 'ask_tab' });
        }
      } catch { /* never blocks the real Ask flow */ }
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
      const preGateModel = args.model_override ?? activeBrainLocalModel ?? settings.preferred_model ?? selectedGemmaModel ?? FLOOR_MODEL;
      // D-BP157-029/BISHOP/seg-rewire-vram-gate: consult the VRAM gate. model_override is the
      // only explicit tier here -- args.model_override !== undefined is what resolveVramGatedModel
      // treats as authoritative-never-downgraded; everything else in the chain above is
      // machine-made/persisted and gets validated.
      const vramGate = resolveVramGatedModel(preGateModel, args.model_override !== undefined);
      const model = vramGate.model;
      if (vramGate.note) {
        console.warn(`[VramGate] ai-dispatch:query: ${vramGate.note}`);
      }

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
      // Gated behind ANSWER_CACHE_MODE, DEFAULTS ON as of D-BP148-014/BISHOP -- with it off
      // (explicit `false` in settings) this block is a no-op and ai-dispatch:query behaves
      // byte-for-byte as it did before this Yoke (verified: disabling the flag skips every line
      // below and falls straight through to the existing RAG path).
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

      // ── BP145-M4 Slice 2: the escalation ladder ─────────────────────────────────────────
      // Canon: canon_escalation_is_triggered_by_honest_abstention_never_scheduled_bp144.
      // Ladder per SPEC_THE_COUPON_CLIPPER_PRICE_AWARE_ROUTING_AND_SAVINGS_METER_BP143.md Part
      // Two: TIER 0 substrate hit, TIER 1 local model, TIER 2 deterministic solver, TIER 3
      // cheap cloud, TIER 4 flagship. TIER 0 already ran above (the answer-cache exact/semantic
      // serve gate + the CSIA Psionic fast path) -- if it had hit, this function already
      // returned before reaching this line. This block starts at TIER 1. Gated behind
      // escalation_ladder_mode, DEFAULT ON as of D-BP148-022 -- with it off (explicit opt-out),
      // zero lines below execute and ai-dispatch:query falls through to the pre-existing static
      // flagship/local branch below, byte-identical to before this ticket.
      //
      // D-BP148-022 "preserve explicit user intent" (explicitFlagshipPick below): an active
      // brain the user (or brain-swap UI) EXPLICITLY set to a flagship/paid entry is a real
      // provider choice, not the unset default -- this ticket changes the DEFAULT rung order,
      // never a user's explicit ceiling. When that is the case, the ladder is skipped entirely
      // and the pre-existing static activeBrain.kind==='flagship' branch below runs exactly as
      // it would have with the ladder off, so an explicit flagship pick is honored whether or
      // not escalation_ladder_mode is on. An unset/local active brain (the default, including
      // every fresh install per BP134 Task D) is NOT an explicit paid pick and goes through the
      // ladder, local-first.
      // THE RULE (Founder verbatim, BP144): a paid tier is reachable ONLY through an honest
      // abstention from the tier below it. Never a timer, never a default, never low
      // confidence. "Low confidence but answered" and "honestly abstained" are structurally
      // distinct signals here, never conflated -- see the report (KN-BP145-M4_REPORT.md) for
      // the full writeup; in one line:
      //   TIER 1 (runCanonicalFreeTextQuestion): `abstained` is a REAL field the pipeline
      //     itself computes as `answerText == null` -- no candidate survived Furnace, or every
      //     Three Fates voter call failed. A Tier-3-concordant-but-not-ROOTED answer still sets
      //     abstained:false and IS served here, never escalated.
      //   TIER 3/4 (cheap cloud / flagship): abstention = a STRUCTURAL failure to produce any
      //     content (HTTP error, missing key, empty response) -- never a judgment about how
      //     confident or hedgy the returned text sounds.
      const explicitFlagshipPick = Boolean(activeBrain && activeBrain.kind === 'flagship');
      const escalationLadderModeOn = isEscalationLadderModeEnabled(settings) && !explicitFlagshipPick;
      if (escalationLadderModeOn) {
        if (!event.sender.isDestroyed()) {
          event.sender.send('ask-token-progress', { coldStart: false, delta: '', assembled: '', escalationLadder: true });
        }
        void (async () => {
          const trace: string[] = [];
          try {
            // TIER 1: local model, via the real honest-abstention-aware free-text engine
            // (canonical_pipeline.ts) -- orphaned from the live Ask tab today per HARDWIRE-02,
            // reused here rather than re-implemented, per "orphan check before building."
            // 100% local/free: substrate check, 9-specialist swarm (free public APIs), Saladin,
            // Furnace, Three Fates arbitration -- no flagship call anywhere inside it.
            const { runCanonicalFreeTextQuestion } = await import('./plow/canonical_pipeline');
            const ladderWriteEbletFn = async (eblet: {
              question: string; answer: string; provenance: string;
              verified: true; sha256: string; timestamp: number;
            }) => {
              await writeVerifiedEblet(eblet);
            };
            const onLadderProgress = (progEvent: import('./plow/canonical_pipeline').CanonicalPlowProgressEvent) => {
              if (!event.sender.isDestroyed()) {
                event.sender.send('ask-engine-progress', progEvent);
              }
            };
            // D-BP148-022: prefer the strongest confirmed-live local model on this rung,
            // UNLESS the caller already made an explicit pick (see resolveTier1Model's own
            // doc comment for the precedence and why). `model` (computed above, alongside
            // `activeBrain`) is both the explicit-pick source of truth AND the fallback.
            const explicitModelPick = args.model_override ?? activeBrainLocalModel ?? settings.preferred_model;
            const tier1Model = await resolveTier1Model(explicitModelPick, model);
            trace.push(`tier1-model-selected: ${tier1Model}${explicitModelPick ? ' (explicit pick)' : ''}`);
            const tier1Result = await runCanonicalFreeTextQuestion(
              currentTurnQuestion, 'general', OLLAMA_API_BASE, tier1Model, {}, ladderWriteEbletFn, onLadderProgress,
            );
            trace.push(
              `tier1(local_model:${tier1Model}): abstained=${tier1Result.abstained} servedFromSubstrate=${tier1Result.servedFromSubstrate}` +
              (tier1Result.abstainReason ? ` reason="${tier1Result.abstainReason}"` : ''),
            );
            if (!tier1Result.abstained && tier1Result.answerText) {
              const latency_ms = Date.now() - tQueryStart;
              if (answerCacheModeOn) {
                recordAnswerCacheEvent({ routing: 'local_generate', cost_usd: 0, latency_ms });
              }
              console.log(`[EscalationLadder] SERVED at TIER 1 (local model, honest answer, no abstention). trace=${trace.join(' | ')}`);
              if (!event.sender.isDestroyed()) {
                event.sender.send('ask-token-complete', {
                  content: tier1Result.answerText,
                  hotHits: substrateCounters?.hotHits,
                  selfContextLoaded: memoryMdContent.length > 0,
                  servedFromSubstrate: tier1Result.servedFromSubstrate,
                  provenance: tier1Result.substrateProvenance,
                  verified: tier1Result.servedFromSubstrate,
                  cost_usd: 0,
                  latency_ms,
                  escalationTier: 1,
                  escalationTrace: trace,
                });
              }
              return;
            }

            // TIER 2: deterministic solver. HONESTLY SKIPPED, not faked. Confirmed by direct
            // read this session (KN-BP145-M4_REPORT.md Phase 0, F0.6): resolveDeterministicComputeOverride
            // (plow_mc_answerer.ts) has exactly two callers, both internal to that file, and is
            // scoped to a discrete multiple-choice option set -- it has no free-text-reachable
            // form anywhere in this codebase today, and plow_mc_answerer.ts is off-limits to
            // this ticket regardless. Widening this ladder to fake a Tier 2 hit here would be
            // exactly the "never widen a gate to force a pass" refusal this ticket names.
            trace.push('tier2(deterministic_solver): SKIPPED -- no free-text-reachable implementation exists on this path, not faked');
            console.log('[EscalationLadder] TIER 2 (deterministic solver) has no free-text-reachable implementation on this path -- honestly skipped, proceeding to TIER 3.');

            // D-BP148-024/BISHOP: money-safety gate, checked HERE -- after TIER 1 has honestly
            // abstained and TIER 2 has been honestly skipped, but strictly BEFORE any paid rung
            // is ever dispatched. TIER 3/4 below make real Anthropic API calls that cost real
            // money; the Founder's budget is frozen until 2026-09-02 (see D-BP148-024 ticket).
            // Without an explicit settings opt-in AND a real configured Anthropic credential
            // (isPaidEscalationEnabled -- both required, see its own doc comment), the ladder
            // stops HERE and reports an honest abstain via the SAME engine.abstained surface the
            // renderer already uses for a genuine local abstain -- never a silent paid call.
            if (!isPaidEscalationEnabled(settings)) {
              trace.push('tier3+4(cloud): SKIPPED -- paid escalation disabled (no explicit opt-in and/or no Anthropic API key configured); stopping at the free-tier ceiling');
              console.log(`[EscalationLadder] STOPPED at free-tier ceiling (paid escalation disabled). trace=${trace.join(' | ')}`);
              if (!event.sender.isDestroyed()) {
                event.sender.send('ask-token-complete', {
                  content: '',
                  hotHits: substrateCounters?.hotHits,
                  selfContextLoaded: memoryMdContent.length > 0,
                  escalationTier: 1,
                  escalationTrace: trace,
                  engine: {
                    abstained: true,
                    abstainReason: (tier1Result.abstainReason
                      ? `Local model could not answer this question (${tier1Result.abstainReason}). `
                      : 'Local model could not answer this question. ')
                      + 'Cloud escalation exists but is disabled while paid usage is paused -- enable paid escalation and configure an Anthropic API key to allow it.',
                    servedFromSubstrate: false,
                  },
                });
              }
              return;
            }

            // TIER 3: cheap cloud (Haiku-class). Reuses dispatchViaBrain -- the SAME dispatch
            // function the flagship branch already uses -- with a real, already-used-elsewhere
            // Anthropic model id (see CHEAP_CLOUD_BRAIN's own doc comment). Abstention here
            // means a STRUCTURAL failure to produce content (HTTP error, missing key, empty
            // response) -- never a judgment call on how confident the text sounds.
            const tier3Result = await dispatchViaBrain(CHEAP_CLOUD_BRAIN, chatMessages);
            // D-BP155-029/BISHOP/seg-meter-net-and-auditlist: real cloud call, real usage tokens
            // (when the call succeeded) -- feed the savings meter unconditionally.
            _emitCloudEscalationSavingsReceipt(
              tier3Result,
              `ladder_tier3_cheap_cloud:${CHEAP_CLOUD_BRAIN.model_id}${tier3Result.error ? ':error' : ':ok'}`,
            );
            const tier3Abstained = Boolean(tier3Result.error) || !tier3Result.content;
            trace.push(
              `tier3(cheap_cloud:${CHEAP_CLOUD_BRAIN.model_id}): abstained=${tier3Abstained}` +
              (tier3Result.error ? ` error="${tier3Result.error}"` : ''),
            );
            if (!tier3Abstained) {
              if (answerCacheModeOn) {
                recordAnswerCacheEvent({
                  routing: 'cheap_cloud',
                  cost_usd: ESTIMATED_CHEAP_CLOUD_QUERY_COST_USD,
                  latency_ms: tier3Result.latency_ms,
                });
                if (isQaRelevant(currentTurnQuestion, tier3Result.content)) {
                  try {
                    await writeVerifiedEblet({
                      question: currentTurnQuestion,
                      answer: tier3Result.content,
                      provenance: `cheap_cloud:${tier3Result.brain_id}:${Date.now()}`,
                      verified: true,
                      sha256: '',
                      timestamp: Date.now(),
                      class: 'whole_answer',
                    }, { computeSemanticCode: semanticModeOn });
                  } catch (err) {
                    console.warn('[AnswerCache] writeVerifiedEblet (cheap_cloud, ladder tier3) failed:', err);
                  }
                }
              }
              console.log(`[EscalationLadder] SERVED at TIER 3 (cheap cloud, honest answer, no abstention). trace=${trace.join(' | ')}`);
              if (!event.sender.isDestroyed()) {
                event.sender.send('ask-token-complete', {
                  content: tier3Result.content,
                  hotHits: substrateCounters?.hotHits,
                  selfContextLoaded: memoryMdContent.length > 0,
                  brainId: tier3Result.brain_id,
                  cost_usd: ESTIMATED_CHEAP_CLOUD_QUERY_COST_USD,
                  latency_ms: tier3Result.latency_ms,
                  escalationTier: 3,
                  escalationTrace: trace,
                });
              }
              return;
            }

            // TIER 4: flagship. Last resort -- only reached because TIER 1 honestly abstained
            // AND TIER 3 structurally failed to produce content. Prefers the user's own active
            // flagship brain if one is selected; otherwise falls back to the registry default
            // flagship (claude-sonnet-4-6) rather than inventing a new brain entry.
            const flagshipBrain: BrainEntry =
              (activeBrain && activeBrain.kind === 'flagship' ? activeBrain : undefined) ??
              DEFAULT_BRAINS.find((b) => b.brain_id === 'claude-sonnet-4-6')!;
            const tier4Result = await dispatchViaBrain(flagshipBrain, chatMessages);
            // D-BP155-029/BISHOP/seg-meter-net-and-auditlist: real cloud call, real usage tokens
            // (when the call succeeded) -- feed the savings meter unconditionally.
            _emitCloudEscalationSavingsReceipt(
              tier4Result,
              `ladder_tier4_flagship:${flagshipBrain.model_id}${tier4Result.error ? ':error' : ':ok'}`,
            );
            trace.push(`tier4(flagship:${flagshipBrain.model_id}): error=${tier4Result.error ?? '(none)'}`);
            if (answerCacheModeOn && !tier4Result.error && tier4Result.content && isQaRelevant(currentTurnQuestion, tier4Result.content)) {
              try {
                await writeVerifiedEblet({
                  question: currentTurnQuestion,
                  answer: tier4Result.content,
                  provenance: `flagship:${tier4Result.brain_id}:${Date.now()}`,
                  verified: true,
                  sha256: '',
                  timestamp: Date.now(),
                  class: 'whole_answer',
                }, { computeSemanticCode: semanticModeOn });
              } catch (err) {
                console.warn('[AnswerCache] writeVerifiedEblet (flagship, ladder tier4) failed:', err);
              }
            }
            if (answerCacheModeOn) {
              recordAnswerCacheEvent({
                routing: 'flagship',
                cost_usd: tier4Result.error ? 0 : ESTIMATED_QUERY_COST_USD,
                latency_ms: tier4Result.latency_ms,
              });
            }
            console.log(`[EscalationLadder] reached TIER 4 (flagship, last resort). trace=${trace.join(' | ')}`);
            if (!event.sender.isDestroyed()) {
              event.sender.send('ask-token-complete', {
                content: tier4Result.content,
                error: tier4Result.error ?? undefined,
                hotHits: substrateCounters?.hotHits,
                selfContextLoaded: memoryMdContent.length > 0,
                brainId: tier4Result.brain_id,
                flagship: true,
                cost_usd: tier4Result.error ? 0 : ESTIMATED_QUERY_COST_USD,
                latency_ms: tier4Result.latency_ms,
                escalationTier: 4,
                escalationTrace: trace,
              });
            }
          } catch (err) {
            console.warn('[EscalationLadder] failed unexpectedly:', err);
            if (!event.sender.isDestroyed()) {
              event.sender.send('ask-token-complete', { content: '', error: String(err), escalationTrace: trace });
            }
          }
        })().finally(() => clearAppBusy());
        return { ok: true, streaming: true, escalationLadder: true };
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
        // D-BP148-024/BISHOP: money-safety gate. This branch was DEAD CODE from every UI until
        // the Ask Tab Ladder Wiring ticket (confirmed: no renderer file called ai-dispatch:query
        // before this ticket) -- an explicit flagship brain pick in Brain Swap could never
        // actually trigger a paid call. Wiring the Ask tab to this handler makes it live for the
        // first time, so it gets the SAME paid-escalation check as the ladder's TIER 3/4 (search
        // "money-safety gate" above) before any real Anthropic spend can happen. Without an
        // explicit opt-in AND a real configured credential, this reports an honest abstain
        // instead of dispatching -- never a silent paid call just because a flagship brain
        // happens to be the active pick.
        if (!isPaidEscalationEnabled(settings)) {
          console.log(`[ai-dispatch:query] BLOCKED flagship dispatch (brain=${activeBrain.brain_id}) -- paid escalation disabled (no explicit opt-in and/or no Anthropic API key configured).`);
          if (!event.sender.isDestroyed()) {
            event.sender.send('ask-token-complete', {
              content: '',
              hotHits: substrateCounters?.hotHits,
              selfContextLoaded: memoryMdContent.length > 0,
              engine: {
                abstained: true,
                abstainReason: `The active brain (${activeBrain.brain_id}) is a paid cloud model, but paid escalation is disabled -- enable paid escalation and configure an Anthropic API key to use it, or switch to a local brain in Brain Swap.`,
                servedFromSubstrate: false,
              },
            });
          }
          clearAppBusy();
          return { ok: true, streaming: true, paidEscalationBlocked: true };
        }
        if (!event.sender.isDestroyed()) {
          event.sender.send('ask-token-progress', { coldStart: false, delta: '', assembled: '', flagship: true, brainId: activeBrain.brain_id });
        }
        void (async () => {
          const result = await dispatchViaBrain(activeBrain, chatMessages);
          // D-BP155-029/BISHOP/seg-meter-net-and-auditlist: real cloud call, real usage tokens
          // (when the call succeeded) -- feed the savings meter unconditionally.
          _emitCloudEscalationSavingsReceipt(
            result,
            `explicit_flagship_pick:${activeBrain.brain_id}${result.error ? ':error' : ':ok'}`,
          );
          sessionInferenceCount++;

          // BP136 Yoke: write-back -- "compute once". A real, $-costing flagship/frontier
          // answer becomes a $0 hit next time. Gated by the same mode flag (default OFF);
          // only writes when isQaRelevant clears the existing 0.08 gate, so a junk/error
          // response never enters the verbatim-serve path. Local-Ollama answers were
          // deliberately NOT written back in v1 (scope: keep the cache high-quality) --
          // BP145-M4 Slice 1 closes that gap with the SAME shape of write-back, gated the same
          // way, in the local-generation completion branch further down in this same handler
          // (search this file for "BP145-M4 Slice 1"). That v1 scope note is now historical,
          // not current behavior.
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
                  // BP145-M4 Slice 1 (verified-LOCAL write-back, the actual fix for FIX_LIST.md
                  // F-10 "Answer-cache write-back is flagship-only"): mirrors the flagship
                  // branch's write-back above EXACTLY -- same isQaRelevant gate, same bare
                  // writeVerifiedEblet call shape, no corroboration hint supplied, so `verified`/
                  // `verdict` are decided the SAME honest way (computeHonestVerification/
                  // isRooted inside writeVerifiedEblet itself) as every other direct call site
                  // in this file -- not a new verification standard invented for this one path.
                  // Gated ONLY on answerCacheModeOn -- NOT on csiaModeOn. The pre-existing
                  // v2c-1 "verified LOCAL write-back" block above (csiaLocalVerified) only ever
                  // fires when csia_mode is ALSO on, which is why the free/local tier never
                  // populated under plain answer_cache_mode alone -- that was the actual defect,
                  // confirmed by direct read this session (see KN-BP145-M4_REPORT.md Phase 0,
                  // F0.2/F0.3). Skipped when any CSIA path already stored this exact answer this
                  // request, same dedup discipline BP137 ADDENDUM FIX 4 already established for
                  // the blocks above.
                  if (
                    answerCacheModeOn &&
                    assembled.length > 0 &&
                    !csiaConvergenceStoredLocal &&
                    !csiaResearchResultLocal?.stored &&
                    !csiaLocalVerified?.stored &&
                    isQaRelevant(currentTurnQuestion, assembled)
                  ) {
                    try {
                      await writeVerifiedEblet({
                        // BUG1 FIX: current-turn question only, same discipline as every other
                        // write-back call site in this file.
                        question: currentTurnQuestion,
                        answer: assembled,
                        provenance: `local:${model}:${Date.now()}`,
                        verified: true,
                        sha256: '',
                        timestamp: Date.now(),
                        class: 'whole_answer',
                      }, { computeSemanticCode: semanticModeOn });
                    } catch (err) {
                      console.warn('[AnswerCache] writeVerifiedEblet (local, BP145-M4 Slice 1) failed:', err);
                    }
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

  // ── ai-dispatch:query-engine (KN-BP144-8 Phase 1) ───────────────────────
  // The Ask tab's free-text question calling the actual canonical_pipeline.ts engine
  // (substrate-first ROOTED short-circuit, then specialist swarm + Saladin + Furnace + Three
  // Fates arbitration) -- NOT the plain-Ollama-chat 'ai-dispatch:query' handler above, and NOT
  // plow_mc_answerer.ts's multiple-choice path (off-limits to this ticket).
  //
  // Returns { ok: true, streaming: true } immediately; stage-by-stage progress flows via the
  // 'ask-engine-progress' push event (one per CanonicalPlowProgressEvent, e.g. substrate
  // check, each specialist firing/done, Saladin/Furnace/Three-Fates done); the final receipt
  // flows via 'ask-token-complete', same event name and same badge-relevant fields
  // (content/servedFromSubstrate/provenance/verified/latency_ms/cost_usd) the existing
  // AskEngineView badge system already renders, PLUS a new additive `engine` field carrying
  // this path's own receipt (abstained/concordance/bmvScore/gateOutcomes/specialistOutcomes/
  // substrateTier) that has no equivalent on the plain-chat path.
  //
  // 1.5: an abstention (engine.abstained === true) sends content: '' -- never a plain local-
  // model guess dressed as an engine answer. The renderer must render engine.abstained as an
  // abstention, not silently show an empty bubble.
  ipcMain.handle(
    'ai-dispatch:query-engine',
    async (event, args: { question: string }) => {
      markAppBusy();
      const tStart = Date.now();
      const question = (args?.question ?? '').trim();
      if (!question) {
        clearAppBusy();
        return { ok: false, error: 'Empty question' };
      }

      const reachable = await ollamaManager.isReachable();
      if (!reachable) {
        clearAppBusy();
        return { ok: false, error: 'Local model runtime (Ollama) is not reachable -- the engine needs it for specialist arbitration.' };
      }

      const settings = loadSettings();
      const selectedGemmaModel = ollamaManager.getSelectedModel();
      const activeBrain = getActiveBrain();
      const activeBrainLocalModel = activeBrain && activeBrain.kind === 'local' ? activeBrain.model_id : undefined;
      const preGateModel = activeBrainLocalModel ?? settings.preferred_model ?? selectedGemmaModel ?? FLOOR_MODEL;
      // D-BP157-029/BISHOP/seg-rewire-vram-gate: 'ai-dispatch:query-engine' has no model_override
      // argument at all -- the whole chain is machine-made/persisted, so it is validated.
      const vramGate = resolveVramGatedModel(preGateModel, false);
      const model = vramGate.model;
      if (vramGate.note) {
        console.warn(`[VramGate] ai-dispatch:query-engine: ${vramGate.note}`);
      }
      // KN-BP144-8 Phase 1: no domain classifier exists for free-typed questions yet -- 'general'
      // is not a member of domain_operator_map.ts's Domain union, so getOperatorsForDomain()
      // falls back to BASE_OPERATORS (wikipedia/wikidata/openalex/commoncrawl/crossref, all
      // free/keyless) rather than a topic-tailored roster. Confirmed safe-degradation, not a
      // crash, by SEG-1's Phase 1 research pass -- named honestly here rather than guessed at.
      const domain = 'general';

      (async () => {
        try {
          const { runCanonicalFreeTextQuestion } = await import('./plow/canonical_pipeline');
          const writeEbletFn = async (eblet: {
            question: string; answer: string; provenance: string;
            verified: true; sha256: string; timestamp: number;
          }) => {
            await writeVerifiedEblet(eblet);
          };

          const onProgress = (progEvent: import('./plow/canonical_pipeline').CanonicalPlowProgressEvent) => {
            if (!event.sender.isDestroyed()) {
              event.sender.send('ask-engine-progress', progEvent);
            }
          };

          const result = await runCanonicalFreeTextQuestion(
            question, domain, NEXUS_LOCAL_URL, model, {}, writeEbletFn, onProgress,
          );

          if (!event.sender.isDestroyed()) {
            event.sender.send('ask-token-complete', {
              content: result.abstained ? '' : (result.answerText ?? ''),
              servedFromSubstrate: result.servedFromSubstrate,
              provenance: result.substrateProvenance,
              // Honest, narrow use of `verified`: true only for the substrate-served ROOTED
              // path. An engine-arbitrated answer (concordant or not) is never marked verified
              // here -- that badge means "ROOTED", not "the model tried its best".
              verified: result.servedFromSubstrate,
              cost_usd: 0,
              latency_ms: result.latencyMs,
              engine: {
                abstained: result.abstained,
                abstainReason: result.abstainReason,
                servedFromSubstrate: result.servedFromSubstrate,
                substrateTier: result.substrateTier,
                concordance: result.concordance,
                bmvScore: result.bmvScore,
                gateOutcomes: result.gateOutcomes,
                specialistOutcomes: result.specialistOutcomes,
                andonTriggered: result.andonTriggered,
                andonRetries: result.andonRetries,
                ebletsWritten: result.ebletsWritten,
              },
            });
          }
        } catch (err) {
          if (!event.sender.isDestroyed()) {
            event.sender.send('ask-token-complete', {
              content: '',
              error: String(err),
              engine: { abstained: true, abstainReason: `Engine call failed: ${String(err)}` },
            });
          }
        }
      })().finally(() => {
        clearAppBusy();
        console.log(`[AskEngine] question-engine turn finished in ${Date.now() - tStart}ms`);
      });

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
