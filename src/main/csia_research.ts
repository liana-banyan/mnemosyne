// csia_research.ts -- BP136 Yoke v2b: CSIA research arm.
//
// Lifts the ALREADY-BUILT specialist swarm (specialist_adapters.ts) and Saladin adversarial
// fence (canonical_pipeline.ts's runSaladin) out of the benchmark harness and runs them
// standalone against a live Ask-path miss. Neither of those two files is modified by this
// Yoke -- both are imported and called exactly as they already exist.
//
// HONESTY MANDATE re-verification (BP136 v2b): freshly re-read this session (not relying on
// the v2a session's memory) --
//   - specialist_adapters.ts: 9 real HTTP adapters (Wikipedia/Wikidata/StackExchange/arXiv/
//     Wolfram/OpenAlex/NIST/PubMed/CommonCrawl), SPECIALIST_REGISTRY export, 5000ms per-adapter
//     timeout baked into fetchWithTimeout()/ADAPTER_TIMEOUT_MS. Zero imports of its own (fully
//     self-contained, uses only the global fetch/AbortController). Confirmed BUILT + callable
//     standalone -- exactly as the v2a session found it, re-verified fresh.
//   - canonical_pipeline.ts's runSaladin() (line ~390): takes ONLY (candidates: CandidateEblet[],
//     ollamaBaseUrl: string, model: string) and returns { passed, challenged } -- no dependency
//     on the MC/domain-bank machinery, the Three Fates stage, or any Ask-path-incompatible
//     state. Confirmed standalone-callable with zero changes needed to that file.
//   - The spec suggested extracting the concordance gate from andon_replow.ts. Fresh read this
//     session confirms (same finding as v2a): andon_replow.ts's 2-of-3 gate
//     (runMMLUProConcordance in giant_concordance.ts) requires a SEALED CORRECT ANSWER to
//     compare voters against -- inapplicable to a live research question with no known answer.
//     giant_concordance.ts ALSO exports runGiantConcordance() (line ~240): a SEPARATE,
//     general-purpose, sealed-answer-FREE 3-voter (correctness/consistency/coverage) 2-of-3
//     concordance function that takes only (question, candidateAnswer) -- a perfect fit for
//     v2b's use case, and confirmed to have ZERO existing callers anywhere in the codebase
//     (100% STRANDED, never wired to anything). ai_dispatch_ipc.ts's v2b block imports and
//     calls THIS function directly (not andon_replow.ts) -- see this session's report for the
//     full explanation of this deviation from the spec's suggested extraction path.

// BP136 Yoke v2c: recursion (v2c-2) reuses computeAnswerConvergence()/CSIA_CONVERGENCE_MATCH_
// THRESHOLD, already built + exported by the v2a session -- re-verified fresh this session at
// psionic_predictor.ts:69-80/282 (no import cycle: psionic_predictor.ts itself only imports
// from mnem_eblet_store.ts, never from this file).
import { SPECIALIST_REGISTRY, toDurableWritable, type CandidateEblet, type SpecialistName } from './plow/specialist_adapters';
import { runSaladin, MINER_MIN_WEIGHT, MINER_MIN_CONTENT_LEN } from './plow/canonical_pipeline';
import { runGiantConcordance } from './plow/giant_concordance';
import { writeVerifiedEblet, isQaRelevant } from './mnem_eblet_store';
import { computeAnswerConvergence, CSIA_CONVERGENCE_MATCH_THRESHOLD } from './psionic_predictor';

export type { CandidateEblet };

/** All 9 specialists, fired in PARALLEL (not the benchmark harness's 1.0s FireGuard stagger --
 *  the Ask path cares about total wall-clock latency, and each adapter already has its own
 *  independent 5000ms timeout, so parallel fan-out is safe and is what the v2b spec asks for). */
const RESEARCH_SPECIALISTS: SpecialistName[] = [
  'wikipedia', 'wikidata', 'stackexchange', 'arxiv', 'wolfram', 'openalex', 'nist', 'pubmed', 'commoncrawl',
];

export interface SpiderSwarmResult {
  survivors: CandidateEblet[];
  challenged: CandidateEblet[];
  sources: string[];
  candidatesRaw: number;
  postMinerCount: number;
}

/**
 * Fires every specialist adapter in parallel via Promise.allSettled -- fail-soft by
 * construction: a rejected/timed-out adapter never throws out of this function or blocks the
 * others, it is simply logged and excluded from the results. No new paid API calls -- every
 * adapter in SPECIALIST_REGISTRY hits a free/public endpoint (Wolfram Alpha's adapter degrades
 * gracefully to [] when no API key is configured, same as the benchmark harness).
 */
export async function fetchSpiderSwarmFacts(question: string, domain = 'general'): Promise<CandidateEblet[]> {
  console.log(`[CSIA] Spider swarm: attempting ${RESEARCH_SPECIALISTS.length} sources -- ${RESEARCH_SPECIALISTS.join(', ')}`);
  const settled = await Promise.allSettled(
    RESEARCH_SPECIALISTS.map((name) => SPECIALIST_REGISTRY[name](question, domain)),
  );
  const allCandidates: CandidateEblet[] = [];
  settled.forEach((result, i) => {
    const name = RESEARCH_SPECIALISTS[i]!;
    if (result.status === 'fulfilled') {
      console.log(`[CSIA] Spider swarm: source=${name} facts=${result.value.length}`);
      allCandidates.push(...result.value);
    } else {
      console.log(`[CSIA] Spider swarm: source=${name} FAILED (fail-soft, ignored) -- ${String(result.reason).slice(0, 120)}`);
    }
  });
  return allCandidates;
}

/**
 * Full research-arm pipeline for one question: Spider swarm fetch -> Miner filter (same
 * thresholds the benchmark harness uses, imported not duplicated) -> Saladin adversarial
 * fence. Returns the surviving facts + their distinct source list.
 */
export async function runSpiderSwarmAndSaladin(
  question: string,
  ollamaBaseUrl: string,
  model: string,
  domain = 'general',
): Promise<SpiderSwarmResult> {
  const allCandidates = await fetchSpiderSwarmFacts(question, domain);
  const candidatesRaw = allCandidates.length;
  const postMiner = allCandidates.filter(
    // D-BP220-BM0-016: internal length-gate check, never displayed/persisted/prompted on its own
    // -- matches the LOG sink precedent already used for the same Miner-gate pattern in
    // canonical_pipeline.ts:913 and plow_mc_answerer.ts:3433/8481/9762 (via c.content.unwrap('LOG')).
    (c) => c.weight >= MINER_MIN_WEIGHT && c.content.unwrap('LOG').length >= MINER_MIN_CONTENT_LEN,
  );
  console.log(`[CSIA] Spider swarm: raw=${candidatesRaw} postMiner=${postMiner.length}`);

  const { passed, challenged } = await runSaladin(postMiner, ollamaBaseUrl, model);
  const sources = Array.from(new Set(passed.map((c) => c.source)));
  console.log(`[CSIA] Saladin: survivors=${passed.length} challenged=${challenged.length} sources=[${sources.join(',')}]`);

  return { survivors: passed, challenged, sources, candidatesRaw, postMinerCount: postMiner.length };
}

/**
 * Builds the CSIA-labeled RAG injection block from survivor facts, for appending into
 * ai_dispatch_ipc.ts's existing systemContent -- mirrors the shape of that file's existing
 * verifiedContext/eblet-snippet injection blocks, but clearly labeled as LIVE, unverified-
 * until-concordance research content (never silently indistinguishable from the pre-existing
 * substrate context the user already had before this Yoke).
 */
export function buildCsiaResearchContext(survivors: CandidateEblet[]): string {
  if (survivors.length === 0) return '';
  const block = survivors
    .slice(0, 5)
    // D-BP220-BM0-016: this block is appended straight into ai_dispatch_ipc.ts's systemContent --
    // a real model prompt -- so PROMPT is the honest sink (same shape as
    // plow_mc_answerer.ts's renderFactForPrompt, which uses the same sink for the same pattern).
    .map((c, i) => `[CSIA Source ${i + 1} -- ${c.source}]: ${c.content.unwrap('PROMPT').slice(0, 400)}`)
    .join('\n\n');
  return `Live research gathered this turn by the CSIA specialist swarm (unverified until the concordance gate; treat as supporting context, not settled fact):\n${block}\n\n`;
}

export interface CsiaConcordanceGateResult {
  concordant: boolean;
  stored: boolean;
  matchCount: number;
  sources: string[];
}

/** BP136 Yoke v2c: options-object form (was 7 positional args in v2b) so the same gate serves
 *  three distinct callers (v2b research, v2c-1 local write-back, v2c-2 recursion) with
 *  different `method` tags and an optional `eliminatedFacts` MINUS-side payload -- purely
 *  additive widening of this session's own v2b function signature, both existing v2b call
 *  sites in ai_dispatch_ipc.ts are updated in the same commit to the new shape (there are no
 *  other callers anywhere -- this file is new this Yoke). */
export interface CsiaConcordanceGateOptions {
  /** BUG1 FIX (ship-safety SEG): callers MUST pass the single CURRENT-TURN user question here,
   *  never a multi-turn-concatenated string -- this value is stamped verbatim as the
   *  class:'whole_answer' eblet's `question` field below. All three call sites in
   *  ai_dispatch_ipc.ts were updated in the same pass to pass `currentTurnQuestion`, not the
   *  conversation-concatenated `userMessage` variable it's still named after for minimal diff. */
  userMessage: string;
  finalAnswer: string;
  /** Fetched facts to write as class:'component' eblets on a CONCORDANT verdict. Empty for
   *  v2c-1's local write-back (there are no fetched facts there, only the local model's own
   *  answer being verified). */
  survivors: CandidateEblet[];
  sources: string[];
  ollamaBaseUrl: string;
  model: string;
  /** provenanceDetail.method + provenanceDetail.source tag -- distinguishes v2b's research-
   *  sourced writes from v2c-1's local-verified writes and v2c-2's recursion writes in the
   *  substrate, per the spec's explicit `method:'local_verified'` requirement for v2c-1. */
  method: 'csia_research' | 'local_verified' | 'csia_recursion';
  provenanceTag: string;
  /** BP136 Yoke v2c-2 MINUS side: facts Saladin challenged/rejected across recursion rounds,
   *  written into tic.eliminated on the eventual verified whole_answer eblet so a human (or a
   *  future Blade 11/Auditor, not built) can see what was tried and refuted, not just what was
   *  kept. Empty/omitted for v2b and v2c-1 (no recursion, nothing to report as eliminated). */
  eliminatedFacts?: string[];
  /** BP137 Yoke (Semantic Match Durable): forwarded verbatim to writeVerifiedEblet()'s own
   *  opts.computeSemanticCode for the class:'whole_answer' write only (component fragments use
   *  a non-servable placeholder question and are never served verbatim, so computing their
   *  semantic code would be wasted work). Defaults false/omitted -- byte-identical unless the
   *  caller (ai_dispatch_ipc.ts) explicitly passes true because semantic_soccerball_mode is on. */
  computeSemanticCode?: boolean;
  /** BP137 ADDENDUM FIX 4: when true, still RUNS the concordance verdict (so the caller gets an
   *  honest concordant/matchCount/sources result for its own UI badge) but SKIPS both
   *  writeVerifiedEblet() calls below (the whole_answer write AND every per-fact component
   *  write). Confirmed live in the store (verified_eblets.jsonl lines 500-501 and 502-503,
   *  BP137 addendum session): the SAME answer was written twice -- once via the convergence
   *  write (ai_dispatch_ipc.ts, provenance `csia:convergence:...`) and once via THIS function
   *  (provenance `csia:${method}:...`, method='csia_research') -- for the same request, because
   *  the two write conditions (jaccard-convergence-match vs. swarm-concordance-verdict) are
   *  independent and can both be true simultaneously. Callers pass `skipWrite: true` here when
   *  they already know the convergence write fired for this same request, so this function's
   *  independently-true concordance verdict does not ALSO append a near-duplicate JSONL record.
   *  Defaults false/omitted -- byte-identical to pre-fix behavior for every existing caller
   *  (the recursion call site in runCsiaRecursionAndContextVerdict below never passes this,
   *  since recursion only runs when nothing has already converged this request). */
  skipWrite?: boolean;
}

/**
 * Post-generation concordance gate + TIC writes, shared across all three v2b/v2c writer call
 * sites in ai_dispatch_ipc.ts (kept here as one function so the write logic is defined once).
 *
 * Uses runGiantConcordance() -- the general-purpose, sealed-answer-FREE 3-voter concordance
 * function (correctness/consistency/coverage), confirmed 100% STRANDED before v2b (zero prior
 * callers anywhere in the codebase) -- as the 2-of-3 gate. Only on CONCORDANT ('verified') does
 * this write anything: one class:'whole_answer' eblet for the combined answer (tic.eliminated
 * populated from `eliminatedFacts` when supplied), plus one class:'component' eblet per
 * surviving fact (dependencies_upstream = that fact's own source). On a non-concordant verdict,
 * this writes NOTHING and returns { concordant:false, stored:false, ... } -- the caller's
 * already-served answer is left completely alone; this function never touches what was already
 * sent to the user.
 */
export async function runCsiaConcordanceGateAndStore(
  opts: CsiaConcordanceGateOptions,
): Promise<CsiaConcordanceGateResult> {
  const { userMessage, finalAnswer, survivors, sources, ollamaBaseUrl, model, method, provenanceTag, eliminatedFacts = [], computeSemanticCode = false, skipWrite = false } = opts;
  const concordance = await runGiantConcordance(userMessage, finalAnswer, { ollamaBaseUrl, model });
  const matchCount = concordance.votes.filter((v) => v.verdict === 'verified').length;
  const concordant = concordance.verdict === 'verified';
  console.log(
    `[CSIA] concordance gate (${method}, ${provenanceTag}): verdict=${concordance.verdict} ` +
    `matchCount=${matchCount}/3 sources=[${sources.join(',')}]`,
  );

  if (!concordant) {
    console.log(`[CSIA] ${method}: NOT concordant -- nothing stored, existing answer already served unchanged`);
    return { concordant: false, stored: false, matchCount, sources };
  }

  if (!isQaRelevant(userMessage, finalAnswer)) {
    console.log(`[CSIA] ${method}: concordant but failed isQaRelevant gate -- nothing stored (defense-in-depth)`);
    return { concordant: true, stored: false, matchCount, sources };
  }

  // BP137 ADDENDUM FIX 4: honest concordant verdict, but the caller already stored this exact
  // answer via a different write path this same request (see skipWrite's doc comment above) --
  // do not append a near-duplicate JSONL record.
  if (skipWrite) {
    console.log(`[CSIA] ${method}: concordant, but skipWrite=true (already stored by another path this request) -- nothing NEW stored`);
    return { concordant: true, stored: false, matchCount, sources };
  }

  try {
    await writeVerifiedEblet({
      question: userMessage,
      answer: finalAnswer,
      provenance: `csia:${method}:${provenanceTag}:${Date.now()}`,
      verified: true,
      sha256: '',
      timestamp: Date.now(),
      class: 'whole_answer',
      provenanceDetail: {
        source: method,
        method,
        corroboration_sources: sources,
        hash: '',
        ts: new Date().toISOString(),
      },
      tic: {
        known: [finalAnswer],
        theories_open: [],
        eliminated: eliminatedFacts,
        dependencies_upstream: survivors.map((s) => s.source),
        applications_downstream: [],
      },
    }, { computeSemanticCode });

    // D-BP220-BM0-016 Part 3: this is a DURABLE, verified:true write of raw candidate content --
    // the same shape as writeRoundEblets' pre-fix hole in plow_mc_answerer.ts. Route it through
    // toDurableWritable() (specialist_adapters.ts), the ALREADY-BUILT guard the sibling dispatch
    // wrote for exactly this: it refuses (omits, does not throw) any candidate carrying
    // `trust === 'UNTRUSTED'` and unwraps the rest with `.unwrap('DURABLE_STORE')` internally, so
    // `fact.content` below is already a plain string, safe-by-construction, never a bare
    // `.content` read of an untrusted candidate.
    //
    // REACHABILITY, VERIFIED BEFORE WRITING THIS (per BM0's brief, honest-smaller-answer
    // instruction): today this is a LATENT FRAGILITY, NOT A LIVE HOLE. Trace: `survivors` here
    // is `opts.survivors`, and every one of the (five, ai_dispatch_ipc.ts) call sites into
    // `runCsiaConcordanceGateAndStore` passes either `[]` or `csiaResearchSurvivors` verbatim;
    // `csiaResearchSurvivors` is assigned exactly once in that file (`= swarmResult.survivors`,
    // from `await runSpiderSwarmAndSaladin(...)`), which in turn only ever pulls from
    // `fetchSpiderSwarmFacts` -> `SPECIALIST_REGISTRY[name]` for the 9 RESEARCH_SPECIALISTS names
    // (wikipedia/wikidata/stackexchange/arxiv/wolfram/openalex/nist/pubmed/commoncrawl) -- none of
    // which ever sets `.trust` (specialist_adapters.ts's own header comment confirms: only the one
    // browser-authority construction site in plow_mc_answerer.ts ever sets `trust: 'UNTRUSTED'`,
    // and this file never imports from or is called by plow_mc_answerer.ts). So no UNTRUSTED
    // candidate can reach this write today. Fixed anyway, safe-by-construction, so a future call
    // site that starts threading browser-authority candidates through this function cannot
    // silently reopen the hole.
    const durableSurvivors = toDurableWritable(survivors);
    for (const fact of durableSurvivors) {
      await writeVerifiedEblet({
        // BUG1 FIX (ship-safety SEG): a class:'component' fact is a supporting fragment, not a
        // standalone answer to the user's question -- it must NEVER be stamped with the real
        // question text (even the correct current-turn-only text), because that previously let
        // component fragments collide with unrelated future queries during ranking/exact-match
        // (see the BP-component-serve-fix comments in mnem_eblet_store.ts). Structurally
        // non-servable placeholder instead: it tokenizes to words no real factual question would
        // plausibly restate, so it can never win an exact-match or meaningful qSim comparison,
        // and it stays a truthy non-empty string so every reader's `parsed.question &&` load
        // filter still accepts the record (Bug 3 cleanup can still find/audit it by class).
        question: '[component:non-servable]',
        answer: fact.content,
        provenance: `csia:${method}:component:${fact.source}:${Date.now()}`,
        verified: true,
        sha256: '',
        timestamp: Date.now(),
        class: 'component',
        provenanceDetail: {
          source: fact.source,
          method: 'spider',
          corroboration_sources: [],
          hash: '',
          ts: new Date().toISOString(),
        },
        tic: {
          known: [fact.content],
          theories_open: [],
          eliminated: [],
          dependencies_upstream: [fact.provenance_url ?? fact.source],
          applications_downstream: [],
        },
      });
    }

    console.log(`[CSIA] ${method}: STORED 1 whole_answer + ${durableSurvivors.length} component eblet(s)` +
      (durableSurvivors.length !== survivors.length
        ? ` (${survivors.length - durableSurvivors.length} UNTRUSTED candidate(s) refused by toDurableWritable)`
        : ''));
    return { concordant: true, stored: true, matchCount, sources };
  } catch (err) {
    console.warn(`[CSIA] ${method}: writeVerifiedEblet (whole_answer/component) failed:`, err);
    return { concordant: true, stored: false, matchCount, sources };
  }
}

// ─── BP136 Yoke v2c-3: CONTEXT verdict (honest don't-know) ───────────────────────────────────

export interface CsiaContextVerdict {
  verdict: 'CONTEXT';
  summary: string;
  candidates: Array<{ text: string; source: string }>;
  recursionRounds: number;
}

/**
 * HONESTY MANDATE re-verification (BP136 v2c): fresh grep this session for a CONTEXT verdict
 * type/enum/class anywhere in this repo (canon doc reference `canon_csia_context_verdict_
 * class...bp128`) returned zero matches -- same finding as the v2a session, re-confirmed fresh,
 * not assumed. PAPERED-ONLY: no prior code exists. This is a minimal, honest, clearly-labeled
 * abstain shape (not a new subsystem) -- attached as an ADDITIONAL field alongside the model's
 * own `content` in the IPC response (never replaces or fabricates over it): the user still sees
 * the model's real answer, plus an honest disclosure that CSIA's own verification loop could
 * not reach 2-of-3 agreement, with the raw candidates (model answer + fetched facts) attached
 * so a future UI (v2e's Prove It receipt) can render "sources say X, sources say Y."
 */
export function buildCsiaContextVerdict(
  modelAnswer: string,
  survivors: CandidateEblet[],
  recursionRounds: number,
): CsiaContextVerdict {
  // D-BP220-BM0-016: sink choice DISCLOSED, not forced to fit cleanly. `candidates` here is
  // returned inside CsiaContextVerdict, which ai_dispatch_ipc.ts attaches verbatim to its
  // `event.sender.send(...)` IPC payload for the renderer (per this function's own doc comment,
  // "so a future UI (v2e's Prove It receipt) can render" it) -- confirmed by grep that NO
  // renderer component reads `csiaContext` today, so as of this dispatch it is forwarded but not
  // yet actually displayed by anything. None of the four ContentSinkKind values name this
  // destination precisely: it is not fed to a model (not PROMPT), not written to the eblet store
  // (not DURABLE_STORE), and does not leave this machine (not NETWORK, which the header comment
  // ties to peer-node/embedding calls specifically). 'LOG' is the least-wrong fit -- internal,
  // not persisted, not model-facing -- even though its own doc comment says "never displayed";
  // flagged here rather than silently picked, for whoever owns specialist_adapters.ts to
  // consider a fifth ContentSinkKind (e.g. 'DISPLAY') once the Prove It UI actually lands.
  const candidates: Array<{ text: string; source: string }> = [
    { text: modelAnswer, source: 'model_generated' },
    ...survivors.slice(0, 5).map((s) => ({ text: s.content.unwrap('LOG').slice(0, 400), source: s.source })),
  ];
  return {
    verdict: 'CONTEXT',
    summary:
      `No single authoritative answer was found after ${recursionRounds} research round(s). ` +
      `The model's own answer and ${survivors.length} independently-fetched source(s) are shown ` +
      'below without a confident merge -- treat this as honest disagreement, not a settled fact.',
    candidates,
    recursionRounds,
  };
}

// ─── BP136 Yoke v2c-2: escalation recursion ──────────────────────────────────────────────────

/** Bounds recursion to protect wall-clock, per the spec's explicit "max 3 rounds" instruction. */
export const CSIA_MAX_RECURSION_ROUNDS = 3;

export interface CsiaRecursionResult {
  roundsRun: number;
  converged: boolean;
  stored: boolean;
  contextVerdict?: CsiaContextVerdict;
}

/**
 * BP136 Yoke v2c-2: escalation recursion. `wan_dispatch.ts`'s computeConsensus().andonTriggered
 * (lines 466-490, re-verified fresh this session -- exact match to the spec's claimed range) is
 * confirmed STRANDED: it is peer-mesh-consensus-specific (requires WanPeerAnswer[] from a
 * multi-peer MMLU-Pro run) and structurally cannot apply to a single-user live Ask-path
 * question, so it is not reused here; recursion is instead built fresh in this Ask-path-shaped
 * function, honestly reusing only the primitives that DO fit (Spider swarm, Saladin,
 * computeAnswerConvergence, runGiantConcordance).
 *
 * Each round: re-fires the Spider swarm (this self-heals transient per-source timeouts/failures
 * from earlier rounds -- specialist_adapters.ts has no "N distinct extra authorities" beyond the
 * 9 it already has, so "widen" here means "retry + pool cumulatively," not "call new sources";
 * documented explicitly rather than silently implying a wider authority set doesn't exist),
 * pools NEW survivors cumulatively (deduped by `sid`) alongside whatever the initial v2b pass
 * (if any) already found, and tracks newly-CHALLENGED facts as the MINUS side (`eliminatedFacts`,
 * deduped by `sid`, capped in length per entry) for eventual attachment to tic.eliminated on a
 * successful write -- so a round-3 Saladin pass does not have to re-litigate a fact round 1
 * already rejected within THIS request's own recursion loop.
 *
 * A round only pays for the (Ollama-local, free) runGiantConcordance() call once the CHEAP
 * computeAnswerConvergence() check (pooled survivor text vs. the model's own answer) clears
 * CSIA_CONVERGENCE_MATCH_THRESHOLD -- avoiding 3 wasted local-LLM concordance calls when the
 * pooled evidence has not moved at all round over round.
 *
 * Bounded to CSIA_MAX_RECURSION_ROUNDS. On exhaustion with no convergence, returns a
 * `contextVerdict` (v2c-3) instead of ever fabricating or forcing a confident write.
 */
export async function runCsiaRecursionAndContextVerdict(
  userMessage: string,
  finalAnswer: string,
  ollamaBaseUrl: string,
  model: string,
  initialSurvivors: CandidateEblet[],
  initialSources: string[],
  provenanceTag: string,
  // BP137 Yoke (Semantic Match Durable): additive 8th param, forwarded to the internal
  // runCsiaConcordanceGateAndStore call below. Defaults false -- the existing call site in
  // ai_dispatch_ipc.ts is byte-identical unless it explicitly passes true.
  computeSemanticCode = false,
): Promise<CsiaRecursionResult> {
  const seenSids = new Set(initialSurvivors.map((s) => s.sid));
  const cumulativeSurvivors: CandidateEblet[] = [...initialSurvivors];
  let cumulativeSources = [...initialSources];
  const eliminatedSids = new Set<string>();
  const eliminatedFacts: string[] = [];

  let roundsRun = 0;
  let converged = false;
  let stored = false;

  for (let round = 1; round <= CSIA_MAX_RECURSION_ROUNDS && !converged; round++) {
    roundsRun = round;
    console.log(`[CSIA] recursion round ${round}/${CSIA_MAX_RECURSION_ROUNDS}: widening authorities (retry swarm, pool cumulative survivors) for ${provenanceTag}...`);
    try {
      const swarmResult = await runSpiderSwarmAndSaladin(userMessage, ollamaBaseUrl, model);
      for (const s of swarmResult.survivors) {
        if (!seenSids.has(s.sid)) { cumulativeSurvivors.push(s); seenSids.add(s.sid); }
      }
      for (const c of swarmResult.challenged) {
        if (!eliminatedSids.has(c.sid)) {
          // D-BP220-BM0-016: DURABLE_STORE -- `eliminatedFacts` is threaded straight into
          // `tic.eliminated` on the whole_answer eblet write in
          // runCsiaConcordanceGateAndStore()'s writeVerifiedEblet() call below, so this is a
          // durable-store-bound read, not a log-only one.
          eliminatedFacts.push(`[${c.source}] ${c.content.unwrap('DURABLE_STORE').slice(0, 200)}`);
          eliminatedSids.add(c.sid);
        }
      }
      cumulativeSources = Array.from(new Set([...cumulativeSources, ...swarmResult.sources]));

      // D-BP220-BM0-016 Part 2 (the silent-runtime-bug fix): `.map((s) => s.content)` used to
      // hand `Array.prototype.join` a plain string per element; now that `.content` is a
      // `CandidateContent` class, `join` would stringify each one via implicit `toString()`,
      // producing "[object Object] [object Object] ..." with zero compile error -- confirmed
      // by a sibling dispatch's standalone repro. `pooledText` here feeds ONLY
      // computeAnswerConvergence() (psionic_predictor.ts) immediately below, which does a pure
      // Jaccard token-overlap similarity computation -- no model call, no persistence, no
      // network egress, exactly the "relevance gate" case ContentSinkKind's own doc comment
      // names for LOG. Sink chosen accordingly.
      const pooledText = cumulativeSurvivors.map((s) => s.content.unwrap('LOG')).join(' ');
      const roundScore = pooledText.length > 0 ? computeAnswerConvergence(finalAnswer, pooledText) : 0;
      console.log(
        `[CSIA] recursion round ${round}: cumulative survivors=${cumulativeSurvivors.length} ` +
        `eliminated=${eliminatedFacts.length} roundConvergenceScore=${roundScore.toFixed(2)}`,
      );

      if (roundScore >= CSIA_CONVERGENCE_MATCH_THRESHOLD) {
        const gateResult = await runCsiaConcordanceGateAndStore({
          userMessage, finalAnswer, survivors: cumulativeSurvivors, sources: cumulativeSources,
          ollamaBaseUrl, model, method: 'csia_recursion',
          provenanceTag: `${provenanceTag}:round${round}`, eliminatedFacts, computeSemanticCode,
        });
        converged = gateResult.concordant;
        stored = gateResult.stored;
        console.log(
          converged
            ? `[CSIA] recursion round ${round}: CONVERGED and CONCORDANT -- stored=${stored}`
            : `[CSIA] recursion round ${round}: pooled evidence looked convergent but the concordance gate rejected it -- continuing`,
        );
      }
    } catch (err) {
      console.warn(`[CSIA] recursion round ${round} failed (fail-soft, continuing to next round):`, err);
    }
  }

  if (converged) {
    return { roundsRun, converged: true, stored };
  }

  console.log(
    `[CSIA] CONTEXT verdict: exhausted ${roundsRun} recursion round(s) for ${provenanceTag}, ` +
    'no convergence -- returning honest abstain (candidates attached, nothing fabricated, nothing stored)',
  );
  const contextVerdict = buildCsiaContextVerdict(finalAnswer, cumulativeSurvivors, roundsRun);
  return { roundsRun, converged: false, stored: false, contextVerdict };
}
