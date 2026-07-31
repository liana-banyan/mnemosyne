// substrate_toggle.ts — BP133 Yoke #24 Task 1: the single authoritative substrate on/off
// switch for the one-click MMLU-Pro test (local_ollama AND wan_mesh dispatch paths alike).
//
// WHY THIS FILE EXISTS (R-MECHANISM-VERIFY, 2026-07-24): before this file existed, the
// one-click MMLU-Pro test had NO substrate concept on either side, verified by direct
// source read:
//   - wan_dispatch.ts's buildMcPrompt() sends the raw MC question with no context.
//   - one_click_mmlu_pro.ts's dispatchQuestionLocally() sends the raw MC question with
//     no context.
//   - index.ts's startRelayRoutePoll() (the WAN responder) sends `payload.prompt` verbatim
//     to Ollama in BOTH the Minor Council branch and the single-shot branch -- no substrate
//     query anywhere in that function.
// So there was nothing to build an on/off toggle FOR yet. This file is the ON path (it did
// not exist before) plus the authoritative flag that gates it, so "substrate off" is true by
// construction (no function call happens at all) rather than true by convention.
//
// SINGLE AUTHORITATIVE INJECTION SITE: every caller in this test (local dispatch in
// one_click_mmlu_pro.ts, WAN responder in index.ts's startRelayRoutePoll) MUST route
// substrate injection through applySubstrateToggle() below. There is no other function in
// this codebase that this test calls to build its outbound prompt text.
//
// CACHE-TRAP FINDING (Task 1 requirement 3): {userData}/substrate/verified_eblets.jsonl is
// a SHARED file also written by the unrelated "Test It Out" onboarding flow
// (run-test-it-out in index.ts), which writes the EXACT question text + EXACT canonical
// answer whenever the model gets a Test-It-Out question right. That is a real answer-key
// cache for the R11/per_domain_q_banks corpus Test It Out draws from. This function
// deliberately calls queryVerifiedEbletsTopical() -- which explicitly filters out any
// entry whose stored question text exactly matches the question being asked -- and NEVER
// queryVerifiedEblets() (the exact-match function). As long as (a) this rule holds and
// (b) no MMLU-Pro answer is ever written back into verified_eblets.jsonl by this test (it
// is not, anywhere in this codebase as of this Yoke), the shared store cannot serve a
// memorized answer for the literal question under test, even though it is the same
// physical file used by a different feature.
//
// Rule 66: version, never overwrite -- this is a new file, no supersede needed.

export interface SubstrateInjectionResult {
  /** The prompt to actually send to Ollama. Identical to basePrompt when substrate is OFF
   *  or when substrate is ON but the topical query returned zero hits. */
  prompt: string;
  /** True only when context was actually prepended to basePrompt. */
  contextInjected: boolean;
  /** How many topical eblets were retrieved (0 when substrate is OFF -- the fetch never runs). */
  ebletCount: number;
}

/** BP135 Phase 3 (Layer B: federated substrate). A topical eblet hit already pooled from one
 *  or more mesh peers (see wan_dispatch.ts's queryTopicalEbletsFromPeers()), structurally
 *  compatible with -- but deliberately not importing -- that module's PooledSubstrateHit, so
 *  this file stays Electron-agnostic and decoupled from the asker-side WAN module. */
export interface PooledSubstrateHit {
  question: string;
  answer: string;
  provenance: string;
  /** Which peer this hit came from, for cross-peer provenance in the injected prompt. */
  peerId?: string;
  /** BP135 Yoke #34 (0.9.7) argument-ledger: additive, optional -- absent on hits pooled from a
   *  peer running a pre-0.9.7 build, or on eblets written before this Yoke existed. Absent is
   *  treated identically to 'unverified' (see formatHit() below), never inferred as 'wrong'. */
  verdict?: 'correct' | 'wrong' | 'verified' | 'unverified';
  reasoning?: string;
}

/** BP135 Yoke #34 (0.9.7): shared hit-formatting for both the pooled (federated) and local-only
 *  substrate branches below. A verdict of 'wrong' is injected ONLY as an explicit avoid-marker
 *  with its captured reasoning (the METHOD that went wrong, never a bare answer-key letter) --
 *  never as ordinary authoritative context a voter might mistake for a fact to rely on. Every
 *  other verdict (including absent/'unverified'/'correct'/'verified' -- 'verified' added BP131
 *  honesty fix, when writeVerifiedEblet's own verified/verdict pair is honestly synthesized
 *  rather than a ground-truth grade) keeps the pre-0.9.7 plain format. */
function formatHit(e: { question: string; answer: string; verdict?: 'correct' | 'wrong' | 'verified' | 'unverified'; reasoning?: string; peerId?: string }, i: number): string {
  const peerTag = e.peerId ? ` (peer ${e.peerId.slice(0, 8)})` : '';
  if (e.verdict === 'wrong') {
    const why = e.reasoning ? e.reasoning.slice(0, 300) : e.answer.slice(0, 200);
    return `[${i + 1}]${peerTag} KNOWN-WRONG (avoid): ${e.question.slice(0, 160)} -- ${why}`;
  }
  return `[${i + 1}]${peerTag} ${e.question.slice(0, 160)} -- ${e.answer.slice(0, 200)}`;
}

/**
 * The ONLY substrate-injection entry point for the one-click MMLU-Pro test.
 *
 * When substrateEnabled is false, this function returns immediately and makes ZERO calls
 * into the eblet store. This is deliberate: "substrate off" must be true because the
 * retrieval call never executes, not merely because its result is discarded downstream.
 * A flag that still queries the store and just declines to use the result is not an
 * authoritative gate -- it is one that could be broken by a future refactor that forgets
 * to check it before using the fetched context.
 *
 * BP135 Phase 3 (Layer B: federated substrate): `pooledHits`, when provided non-empty, is
 * used INSTEAD OF this machine's own local-only queryVerifiedEbletsTopical() call -- this is
 * what lets a WAN responder's prompt carry eblets pooled from ALL live mesh peers (see
 * index.ts's startRelayRoutePoll, which threads payload.pooled_substrate_eblets through here)
 * rather than just this one peer's own substrate. Still the SAME single injection site and
 * SAME contextBlock shape -- only the source of the hits differs.
 */
export async function applySubstrateToggle(
  basePrompt: string,
  questionText: string,
  domain: string,
  substrateEnabled: boolean,
  topK = 3,
  pooledHits?: PooledSubstrateHit[],
): Promise<SubstrateInjectionResult> {
  if (!substrateEnabled) {
    return { prompt: basePrompt, contextInjected: false, ebletCount: 0 };
  }
  if (pooledHits && pooledHits.length > 0) {
    const pooledBlock = pooledHits
      .slice(0, topK)
      .map((e, i) => formatHit(e, i))
      .join('\n');
    const prompt = `Context from federated substrate (related background pooled from mesh peers, not this exact question):\n${pooledBlock}\n\n${basePrompt}`;
    return { prompt, contextInjected: true, ebletCount: pooledHits.length };
  }
  try {
    // Lazy import: keeps this module Electron-agnostic when substrate is OFF (the common
    // case) and matches the existing lazy-import pattern already used for the same function
    // in canonical_pipeline.ts and mesh_comparison_runner.ts.
    const { queryVerifiedEbletsTopical } = await import('../mnem_eblet_store');
    const hits = await queryVerifiedEbletsTopical(questionText, domain, topK);
    if (hits.length === 0) {
      return { prompt: basePrompt, contextInjected: false, ebletCount: 0 };
    }
    // BP135 Yoke #34 (0.9.7) argument-ledger: hits now carry verdict/reasoning (absent =
    // 'unverified', same as pre-0.9.7 eblets) -- see formatHit() above for the KNOWN-WRONG rule.
    const contextBlock = hits
      .map((e, i) => formatHit(e, i))
      .join('\n');
    const prompt = `Context from substrate (related background, not this exact question):\n${contextBlock}\n\n${basePrompt}`;
    return { prompt, contextInjected: true, ebletCount: hits.length };
  } catch (err) {
    console.warn('[substrate_toggle] topical fetch failed (non-fatal, falling back to no context):', err);
    return { prompt: basePrompt, contextInjected: false, ebletCount: 0 };
  }
}

/** Gate for Task 1 requirement 4: never logs by default; opt-in only, and never logs
 *  anything but question/prompt text (no keys ever pass through this test's prompts). */
export function isDebugPromptLoggingEnabled(): boolean {
  return process.env.MNEMO_DEBUG_LOG_PROMPTS === '1';
}

export interface OutboundPromptLogEntry {
  ts: string;
  source: 'local_dispatch' | 'wan_responder';
  routeId?: string;
  sessionId?: string;
  mode: string; // 'single_shot' | 'minor_council' | etc.
  model: string;
  substrateEnabled: boolean;
  contextInjected: boolean;
  ebletCount: number;
  questionId?: string | number;
  domain?: string;
  promptChars: number;
  prompt: string;
}

export function buildOutboundPromptLogLine(entry: OutboundPromptLogEntry): string {
  return JSON.stringify(entry);
}
