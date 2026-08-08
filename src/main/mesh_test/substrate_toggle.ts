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
  /** How many topical eblets were retrieved (0 when substrate is OFF -- the fetch never runs).
   *  D-BP148-045: includes canonEblets.length when the canon-substrate branch also injected
   *  (see canonEblets below) -- this field's pre-existing meaning ("total hits actually
   *  prepended to the prompt") is preserved, just widened to count both sources. */
  ebletCount: number;
  /** D-BP148-045/BISHOP (Wrasse Serving Path), ADDITIVE/OPTIONAL. The structured identity of
   *  every canon-substrate hit (from the 914-record production eblet_index.jsonl corpus, via
   *  queryEbletStoreWithProvenance()) that was actually injected into `prompt` above -- title/
   *  category/path/relevanceScore survive here so a caller can attribute the answer back to a
   *  real doctrine file and, later, root it. Absent (not empty array) when
   *  canon_substrate_serve_mode is off, so an off-run never carries a stray empty-array field a
   *  reader might mistake for "checked, found nothing" -- see canonGateStatus for that
   *  distinction when the mode IS on. */
  canonEblets?: InjectedCanonEblet[];
  /** D-BP148-045/BISHOP, ADDITIVE/OPTIONAL. Present only when canon_substrate_serve_mode was
   *  on for this call, so a caller can tell an honest "checked, zero passed the relevance gate"
   *  or "checked, embeddings were unavailable so BM25 rank was used instead" apart from "never
   *  checked" -- the exact ambiguity this ticket's fail-soft requirement forbids leaving
   *  unresolved. */
  canonGateStatus?: 'relevance_filtered' | 'embeddings_unavailable_bm25_fallback' | 'no_hits' | 'disabled' | 'error';
}

/** D-BP148-045/BISHOP (Wrasse Serving Path): one canon-substrate hit's identity, carried
 *  alongside (never instead of) the content actually injected into the prompt -- this is what
 *  makes an answer attributable back to a real doctrine file in eblet_index.jsonl rather than
 *  an opaque blob of prepended text, the difference between this and a plain RAG bolt-on. */
export interface InjectedCanonEblet {
  title: string;
  category: string;
  path: string;
  /** Cosine relevance score (0-1) against the question, via semantic_relevance_gate.ts's
   *  existing nomic-embed-text machinery (SEMANTIC_RELEVANCE_THRESHOLD = 0.58). null when the
   *  embedding gate was unavailable for this hit (Ollama/embed model unreachable) -- in that
   *  case the hit was kept via its BM25 rank alone, never silently dropped (see
   *  canonGateStatus:'embeddings_unavailable_bm25_fallback' on the result that carries this hit). */
  relevanceScore: number | null;
}

/** D-BP148-045/BISHOP: hard cap on how many canon-substrate eblets can be injected per query --
 *  context spent on retrieval is context not spent on reasoning. Same top-3 shape
 *  queryEbletStoreWithProvenance() already returns (it never returns more than 3), named here
 *  explicitly so the cap is a real, findable constant rather than an incidental consequence of
 *  the retrieval function's own internal slice(0,3). */
export const MAX_INJECTED_CANON_EBLETS = 3;

/** D-BP148-045/BISHOP: retrieves and relevance-gates canon-substrate hits for one question.
 *  Fail-soft at every step, per the ticket's own naming of the exact defect being avoided here:
 *  a retrieval error or an empty BM25 result must never be silently indistinguishable from "the
 *  relevance gate ran and rejected everything" -- gateStatus always says which one happened.
 *
 *  Machinery reused, not duplicated: queryEbletStoreWithProvenance() (mnem_eblet_store.ts, the
 *  914-record eblet_index.jsonl BM25 query queryEbletStore() has always run) for retrieval, and
 *  semanticRelevance()/SEMANTIC_RELEVANCE_THRESHOLD (semantic_relevance_gate.ts, the SAME 0.58-
 *  cosine gate plow_mc_answerer.ts's Stage A.0 already uses for a different candidate set) for
 *  relevance filtering. Both imported lazily, matching this file's own existing convention
 *  (queryVerifiedEbletsTopical above) of staying Electron-agnostic until this code path
 *  actually runs. */
async function retrieveCanonSubstrateHits(
  questionText: string,
): Promise<{ hits: InjectedCanonEblet[]; contents: Map<string, string>; gateStatus: 'relevance_filtered' | 'embeddings_unavailable_bm25_fallback' | 'no_hits' | 'error' }> {
  try {
    const { queryEbletStoreWithProvenance } = await import('../mnem_eblet_store');
    const bm25Hits = await queryEbletStoreWithProvenance(questionText);
    if (bm25Hits.length === 0) {
      return { hits: [], contents: new Map(), gateStatus: 'no_hits' };
    }

    const { semanticRelevance, SEMANTIC_RELEVANCE_THRESHOLD } = await import('../plow/semantic_relevance_gate');
    let anyCosineSucceeded = false;
    const scored = await Promise.all(
      bm25Hits.map(async (h) => {
        const score = await semanticRelevance(questionText, h.content);
        if (score !== null) anyCosineSucceeded = true;
        return { hit: h, score };
      }),
    );

    const contents = new Map(bm25Hits.map((h) => [h.path, h.content]));

    if (!anyCosineSucceeded) {
      // Fail-soft: the embedding gate was unavailable for EVERY candidate (Ollama/embed model
      // unreachable) -- keep the BM25 ranking as-is rather than collapsing to zero. Collapsing
      // here would be indistinguishable from "checked and nothing was relevant", which is
      // exactly the swallow-to-empty shape this ticket forbids.
      return {
        hits: bm25Hits.slice(0, MAX_INJECTED_CANON_EBLETS).map((h) => ({
          title: h.title, category: h.category, path: h.path, relevanceScore: null,
        })),
        contents,
        gateStatus: 'embeddings_unavailable_bm25_fallback',
      };
    }

    const passed = scored
      .filter((s): s is { hit: typeof bm25Hits[number]; score: number } => s.score !== null && s.score >= SEMANTIC_RELEVANCE_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_INJECTED_CANON_EBLETS)
      .map((s) => ({ title: s.hit.title, category: s.hit.category, path: s.hit.path, relevanceScore: s.score }));

    return { hits: passed, contents, gateStatus: passed.length > 0 ? 'relevance_filtered' : 'no_hits' };
  } catch (err) {
    console.warn('[substrate_toggle] canon-substrate retrieval failed (non-fatal, no context injected, question still answered):', err);
    return { hits: [], contents: new Map(), gateStatus: 'error' };
  }
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

  let baseResult: SubstrateInjectionResult;
  if (pooledHits && pooledHits.length > 0) {
    const pooledBlock = pooledHits
      .slice(0, topK)
      .map((e, i) => formatHit(e, i))
      .join('\n');
    const prompt = `Context from federated substrate (related background pooled from mesh peers, not this exact question):\n${pooledBlock}\n\n${basePrompt}`;
    baseResult = { prompt, contextInjected: true, ebletCount: pooledHits.length };
  } else {
    try {
      // Lazy import: keeps this module Electron-agnostic when substrate is OFF (the common
      // case) and matches the existing lazy-import pattern already used for the same function
      // in canonical_pipeline.ts and mesh_comparison_runner.ts.
      const { queryVerifiedEbletsTopical } = await import('../mnem_eblet_store');
      const hits = await queryVerifiedEbletsTopical(questionText, domain, topK);
      if (hits.length === 0) {
        baseResult = { prompt: basePrompt, contextInjected: false, ebletCount: 0 };
      } else {
        // BP135 Yoke #34 (0.9.7) argument-ledger: hits now carry verdict/reasoning (absent =
        // 'unverified', same as pre-0.9.7 eblets) -- see formatHit() above for the KNOWN-WRONG rule.
        const contextBlock = hits
          .map((e, i) => formatHit(e, i))
          .join('\n');
        const prompt = `Context from substrate (related background, not this exact question):\n${contextBlock}\n\n${basePrompt}`;
        baseResult = { prompt, contextInjected: true, ebletCount: hits.length };
      }
    } catch (err) {
      console.warn('[substrate_toggle] topical fetch failed (non-fatal, falling back to no context):', err);
      baseResult = { prompt: basePrompt, contextInjected: false, ebletCount: 0 };
    }
  }

  // ── D-BP148-045/BISHOP (Wrasse Serving Path): canon-substrate injection ──────────────────
  // ADDITIVE, independently gated by canon_substrate_serve_mode (see its own doc comment in
  // ai_dispatch_ipc.ts). Runs AFTER baseResult above is fully settled, and only ever ADDS to
  // it -- when this mode is off, or the retrieval finds nothing, or it errors, `baseResult` is
  // returned completely untouched (byte-identical to pre-D-BP148-045 applySubstrateToggle
  // behavior). This is what makes "the model consults her own substrate" real: the 914-record
  // eblet_index.jsonl production corpus (canon doctrine), not just the self-written
  // verified_eblets.jsonl cache the branch above already reads.
  let canonModeOn = true;
  try {
    // Lazy import, same Electron-agnostic discipline as the queryVerifiedEbletsTopical call
    // above -- this settings read only happens when substrate is already ON.
    const { isCanonSubstrateServeModeEnabledNow } = await import('../ai_dispatch_ipc');
    canonModeOn = isCanonSubstrateServeModeEnabledNow();
  } catch {
    // Fail-soft: settings unreadable -- default ON, same convention as every other mode flag
    // in this codebase (an unreadable settings file resolves every flag to its default, never
    // to off).
    canonModeOn = true;
  }
  if (!canonModeOn) {
    return { ...baseResult, canonGateStatus: 'disabled' };
  }

  const { hits: canonHits, contents, gateStatus } = await retrieveCanonSubstrateHits(questionText);
  if (canonHits.length === 0) {
    return { ...baseResult, canonEblets: [], canonGateStatus: gateStatus };
  }

  const canonBlock = canonHits
    .map((h, i) => `[canon ${i + 1} | category:${h.category} | ${h.title}]\n${(contents.get(h.path) ?? '').slice(0, 500)}`)
    .join('\n\n');
  const prompt = `Context from your own substrate (doctrine/canon corpus, related background, not necessarily this exact question):\n${canonBlock}\n\n${baseResult.prompt}`;

  return {
    prompt,
    contextInjected: true,
    ebletCount: baseResult.ebletCount + canonHits.length,
    canonEblets: canonHits,
    canonGateStatus: gateStatus,
  };
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
