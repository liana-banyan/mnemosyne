/**
 * canonical_pipeline.ts — BP083 v0.4.0 Canonical Plow Pipeline (Federated Andon)
 *
 * Implements the Founder-Invented 14-Domain Looping Methodology per §0 of
 * KNIGHT_YOKE_v0_3_4_CANONICAL_PLOW_PIPELINE_BP083.md
 *
 * Per-domain pipeline (isolated, no cross-domain shared mutable state):
 *
 *   1. Spider      → locate topic-relevant eblets in substrate index
 *   2. Sprite      → retrieve located eblets from storage
 *   3. 9 SPECIALISTS in PARALLEL STAGGERED SWARM (FireGuard 1.0s stagger):
 *        Wikipedia · Wikidata · StackExchange · arXiv · Wolfram · OpenAlex
 *        NIST · PubMed · Common Crawl
 *   4. Miner       → anti-popularity filter (weight >= 0.6 AND content >= 100 chars)
 *   5. Saladin     → Adversarial Fence (challenge candidates for weaknesses)
 *   6. Furnace     → Angel of Death (burn challenged/discordant candidates)
 *   7. Three Fates → final answer arbitration (3-voter, temps [0.0, 0.2, 0.4])
 *   8. Scribe      → record result + BMV score + concordance + gate outcomes
 *   9. Detective TEAM → root-cause on gate fail + Federated Andon cord (v0.4.0):
 *                       Tier 1: widen local specialist roster (backup adapters)
 *                       Tier 2: cross-machine Constellation query
 *                       Tier 3: The Diagnosis (human broadcast — ESCALATE not quarantine)
 *
 * v0.4.0 change: ESCALATE not quarantine. Founder direct: "the goal is the right answer."
 * Truth-Always: if Sharp 7 shows zero growth, the caller must file YELLOW.
 * Caithedral™ spelling per BP081 blood statute.
 */

import { createHash } from 'crypto';
import { type CandidateEblet, type SpecialistKeys, SPECIALIST_REGISTRY, type SpecialistName } from './specialist_adapters';
import { getOperatorsForDomain } from './domain_operator_map';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConcordanceClass = 'CONCORDANT' | 'PARTIAL' | 'DISCORDANT';

export type GateId = 'G1_FACT' | 'G2_CONC' | 'G3_BMV' | 'G4_LAT';

export interface GateOutcome {
  gate: GateId;
  passed: boolean;
  detail: string;
}

export interface ScriberRecord {
  questionId: string;
  domain: string;
  question: string;
  ebletCount: number;
  bmvScore: number;
  concordance: ConcordanceClass;
  gateOutcomes: GateOutcome[];
  ebletsWritten: number;
  andonTriggered: boolean;
  andonRetries: number;
  timestamp: number;
}

export interface CanonicalPlowQuestionResult {
  questionId: string;
  domain: string;
  ebletsWritten: number;
  bmvScore: number;
  concordance: ConcordanceClass;
  gateOutcomes: GateOutcome[];
  andonTriggered: boolean;
  andonRetries: number;
  andonTierResolved?: 1 | 2 | 3 | null; // v0.4.0: which tier resolved (null = unresolved)
  diagnosisId?: string | null;           // v0.4.0: Tier 3 Diagnosis ID if escalated
  pendingHuman?: boolean;                // v0.4.0: true if awaiting human Diagnosis answer
  specialistsUsed: string[];
  candidatesRaw: number;
  candidatesPostMiner: number;
  candidatesPostFurnace: number;
  scribes: ScriberRecord[];
}

export interface CanonicalPlowDomainResult {
  domain: string;
  questionResults: CanonicalPlowQuestionResult[];
  totalEbletsWritten: number;
  avgBmvScore: number;
  verifiedCount: number;
  quarantinedCount: number;
  pendingHumanCount: number;   // v0.4.0: Tier 3 Diagnosis escalations (not quarantined)
  andonEvents: number;
  status: 'GREEN' | 'YELLOW' | 'RED';
}

export interface CanonicalPlowProgressEvent {
  type:
    | 'domain-start'
    | 'question-start'
    | 'specialist-fire'
    | 'specialist-done'
    | 'miner-done'
    | 'saladin-done'
    | 'furnace-done'
    | 'three-fates-done'
    | 'scribe-done'
    | 'andon-trigger'
    | 'andon-tier1'
    | 'andon-tier2'
    | 'andon-tier3-diagnosis'
    | 'andon-recovered'
    | 'andon-exhausted'
    | 'question-done'
    | 'domain-done'
    | 'complete';
  domain?: string;
  domainIndex?: number;
  totalDomains?: number;
  questionIndex?: number;
  totalQuestions?: number;
  specialistName?: SpecialistName;
  specialistCandidates?: number;
  minerPassed?: number;
  furnacePassed?: number;
  ebletsWrittenThisQuestion?: number;
  totalEbletsWritten?: number;
  totalQuarantined?: number;
  andonRetry?: number;
  domainResult?: CanonicalPlowDomainResult;
  domainStatus?: string;
}

export interface CanonicalPlowConfig {
  domains: string[];
  questionsPerDomain: number;
  ollamaBaseUrl?: string;
  model?: string;
  specialistKeys?: SpecialistKeys;
  /** BP134 Yoke #32 Phase C: field-sowing-only deep-harvest mode -- see the identical field on
   *  plow_mc_answerer.ts's CanonicalPlowMcConfig for the full rationale. Undefined/false leaves
   *  the postFurnace cap (6) and every adapter cap byte-identical to today's behavior. */
  deepHarvest?: boolean;
  maxEbletsPerQuestion?: number;
}

export interface CanonicalPlowResult {
  config: CanonicalPlowConfig;
  startedAt: number;
  completedAt: number;
  domainResults: CanonicalPlowDomainResult[];
  totalEbletsWritten: number;
  totalQuarantined: number;
  overallStatus: 'GREEN' | 'YELLOW';
}

// ─── Constants ────────────────────────────────────────────────────────────────

// BP133 Yoke #24 Task 2: exported (not just module-local) so plow_mc_answerer.ts can reuse
// the exact same tuning constants for the MC-answering variant of this pipeline instead of
// drifting a second copy out of sync.
export const FIREGUARD_STAGGER_MS = 1000;
export const MINER_MIN_WEIGHT = 0.6;
export const MINER_MIN_CONTENT_LEN = 100;
export const MAX_ANDON_RETRIES = 3;
export const OLLAMA_TIMEOUT_MS = 30_000;
const GREEN_EBLET_THRESHOLD = 5;

const SALADIN_CHALLENGE_PROMPT = (fact: string) =>
  `You are an adversarial fact-checker. Evaluate this claim:

"${fact}"

Is this claim factually accurate, consistent, and well-supported?
Respond with exactly one word: PASS (if the claim is solid) or CHALLENGE (if it is dubious, vague, or contradicts known facts).`;

const THREE_FATES_PROMPT = (question: string, facts: string, voterIdx: number) => {
  const instructions = [
    'Based ONLY on the provided sources, give a precise, factual answer to the question. Be concise.',
    'Carefully review the sources below. What does the evidence say about the question? Answer directly.',
    'Synthesize the key factual content from the sources to answer the question. Focus on specifics.',
  ];
  return `${instructions[voterIdx] ?? instructions[0]}

Sources:
${facts}

Question: ${question}

Answer:`;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sha256hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

// BP133 Yoke #24 Task 2: exported so plow_mc_answerer.ts's questionId matches this
// pipeline's own convention (used consistently in Scribe writes and receipts).
export function generateQuestionId(question: string, domain: string): string {
  return sha256hex(domain + ':' + question).slice(0, 12);
}

// BP133 Yoke #24 Task 2: exported for plow_mc_answerer.ts's MC-arbitration voter calls.
//
// BP134 Deep RCA (live-verified, local smoke test against gemma4:12b via /api/generate):
// this function was missing `think: false`, and gemma4:12b is a thinking-capable model
// (Ollama /api/tags reports "capabilities":["completion","tools","thinking","vision"] for
// it). Without think disabled, the ENTIRE num_predict budget (256) is consumed by internal
// reasoning tokens and `response` comes back "" with done_reason:"length" -- exactly the
// voter_diagnostics {status:"empty_response", responseChars:0} signature from the BP134
// plow trace, after real GPU compute time (matches the reported 60-223s window once
// downstream requests queue behind an earlier hung generation on a single-GPU host).
//
// IMPORTANT: `think` must be a TOP-LEVEL request field, not nested inside `options`.
// Two sibling files (giant_concordance.ts, diamond_runner.ts) nest `think: false` inside
// `options` under a v0.3.6 comment claiming it fixes this -- live-verified locally that the
// nested form is silently ignored by this Ollama server (still empty response,
// done_reason:"length", eval_count:256); only the top-level field actually works (verified
// non-empty "B" response, eval_count:2, done_reason:"stop", ~400ms instead of ~17s).
//
// A THIRD sibling file (mesh_comparison_runner.ts, BP083) deliberately REMOVED `think` because
// it "caused HTTP 400 on some Ollama versions" -- that BP083 finding is real and is preserved
// here as a one-shot fallback: if the top-level `think` field 400s (older Ollama server that
// predates the think param), retry once without it rather than hard-failing every voter call
// on that peer.
//
// BP135 Yoke #34 Phase (0.9.6): optional `numPredict` param, DEFAULT 256 -- byte-identical to
// every existing call site that does not pass a 5th argument. The only caller that ever passes
// a non-default value is plow_mc_answerer.ts's reasoning-mode voter path (raised to ~1024 so a
// step-by-step derivation fits in the budget instead of being truncated before the model reaches
// its own "Answer: X" line). The bare-letter default path is untouched.
//
// KN-BP142-7 (Founder-directed BP142): optional `timeoutMs` param, DEFAULT OLLAMA_TIMEOUT_MS
// (30_000) -- byte-identical to every existing call site that does not pass a 6th argument. This
// is a transport budget, not an acceptance threshold: it only controls how long this function
// waits for Ollama to respond before giving up, never what counts as a correct or admissible
// answer once a response arrives. The only callers that ever pass a non-default value are
// plow_mc_answerer.ts's two elimination-cascade bidirectional ranking calls inside
// runEliminationCascadeFormatIndependentFallback (see ELIMINATION_CASCADE_RANKING_TIMEOUT_MS in
// that file for the measured rationale). Every other call site in the codebase (Saladin adversarial
// challenge, Three Fates voters, the Cake Method cascade-candidate-producer, plow_mc_decompose.ts's
// decompose/verdict calls, compute_sidecar.ts's expression-sampling call, and the C3 shortcut's
// single-quantity query inside the same fallback function) is unaffected and keeps the original
// 30_000ms budget exactly as before, since none of them pass a 6th argument.
//
// KN-BP142-8 (Founder-directed BP142): a SECOND non-default value now exists --
// plow_mc_answerer.ts's Cake Method CUT (local_orchestrator, 2 routes) and PICK
// (local_orchestrator) call sites inside runCakeMethodDisagreementResolution now pass
// CAKE_METHOD_TIMEOUT_MS (270_000, see that constant's own doc comment in plow_mc_answerer.ts for
// the measured rationale) -- live-verified this ticket that both were aborting on the 30_000ms
// default every single time on real qid 105/98 traffic, a transport starvation that had been
// misread as a cut-stage reasoning gap. The Cake Method's OWN elimination-cascade candidate
// producer (runEliminationCascadeCandidateProducer, a DIFFERENT function from
// runEliminationCascadeFormatIndependentFallback above) still keeps the original 30_000ms default
// -- it is a related but distinct call site this ticket deliberately left unchanged, out of its
// own strictly-scoped "cut and pick call sites only" boundary; see KN-BP142-8's own YOKE_RETURN
// for why that is reported as an open gap rather than silently fixed alongside it.
export async function callOllama(
  prompt: string,
  ollamaBaseUrl: string,
  model: string,
  temperature: number,
  numPredict: number = 256,
  timeoutMs: number = OLLAMA_TIMEOUT_MS,
): Promise<string | null> {
  const buildBody = (includeThink: boolean) => ({
    model,
    prompt,
    stream: false,
    ...(includeThink ? { think: false } : {}),
    options: { temperature, num_predict: numPredict },
  });

  try {
    let resp = await fetch(`${ollamaBaseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildBody(true)),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (resp.status === 400) {
      // BP083 fallback: this peer's Ollama version rejects the `think` field outright.
      resp = await fetch(`${ollamaBaseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBody(false)),
        signal: AbortSignal.timeout(timeoutMs),
      });
    }
    if (!resp.ok) return null;
    const data = (await resp.json()) as { response?: string };
    return data.response?.trim() ?? null;
  } catch {
    return null;
  }
}

// ─── BMV computation ──────────────────────────────────────────────────────────

// BP133 Yoke #24 Task 2: exported for plow_mc_answerer.ts's MC-answering BMV computation.
export function computeBmvScore(
  candidatesRaw: number,
  candidatesPostMiner: number,
  candidatesPostFurnace: number,
  ebletsWritten: number,
  concordance: ConcordanceClass,
  specialistCount: number,
  latencyMs: number,
): number {
  // 10 dimensions (simplified): specialists, miner pass-rate, furnace pass-rate,
  // eblets written, concordance, latency, source diversity, completeness,
  // content quality estimate, Andon-free run.
  const specialistScore = Math.min(100, (specialistCount / 5) * 100);
  const minerRate = candidatesRaw > 0 ? (candidatesPostMiner / candidatesRaw) * 100 : 0;
  const furnaceRate = candidatesPostMiner > 0 ? (candidatesPostFurnace / candidatesPostMiner) * 100 : 0;
  const ebletScore = Math.min(100, (ebletsWritten / 5) * 100);
  const concordanceScore = concordance === 'CONCORDANT' ? 100 : concordance === 'PARTIAL' ? 60 : 0;
  const latencyScore = Math.min(100, Math.max(0, 100 - (latencyMs / 60_000) * 100));
  const diversityScore = Math.min(100, (specialistCount / 9) * 100);
  const completenessScore = ebletsWritten > 0 ? 80 : 0;
  const qualityScore = candidatesPostFurnace > 0 ? 75 : 0;
  const andonFreeScore = 85; // default; reduced if Andon triggered

  const bmv = (
    specialistScore * 0.12 +
    minerRate * 0.10 +
    furnaceRate * 0.10 +
    ebletScore * 0.12 +
    concordanceScore * 0.14 +
    latencyScore * 0.08 +
    diversityScore * 0.10 +
    completenessScore * 0.10 +
    qualityScore * 0.09 +
    andonFreeScore * 0.05
  );

  return Math.round(Math.min(100, Math.max(0, bmv)) * 10) / 10;
}

// ─── Argument-ledger confidence ───────────────────────────────────────────────

// BP135 Yoke #34 (0.9.7): derives a 0-1 confidence signal for a written eblet from the SAME
// bmvScore/concordance the writing pipeline already computed for gating -- no new inputs
// required. CONCORDANT gets full weight; PARTIAL/DISCORDANT are scaled down since those runs
// themselves reflect the voters/specialists disagreeing, independent of any one fact's own
// merit. Exported so both canonical_pipeline.ts's own Scribe default and plow_mc_answerer.ts's
// explicit ledgerContext use the identical formula.
export function computeArgumentConfidence(bmvScore: number, concordance: ConcordanceClass): number {
  const concordanceWeight = concordance === 'CONCORDANT' ? 1.0 : concordance === 'PARTIAL' ? 0.6 : 0.3;
  const raw = (bmvScore / 100) * concordanceWeight;
  return Math.round(Math.min(1, Math.max(0, raw)) * 100) / 100;
}

// ─── Concordance computation ──────────────────────────────────────────────────

function computeConcordance(answers: (string | null)[]): ConcordanceClass {
  const valid = answers.filter((a): a is string => a !== null && a.length > 10);
  if (valid.length < 2) return 'DISCORDANT';
  if (valid.length < 3) return 'PARTIAL';

  // Check for term overlap between all 3 answers
  const tokenize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3);

  const sets = valid.map((a) => new Set(tokenize(a)));
  const [s0, s1, s2] = [sets[0] ?? new Set(), sets[1] ?? new Set(), sets[2] ?? new Set()];

  // Common terms across at least 2 of 3 answers
  const all = new Set([...s0, ...s1, ...s2]);
  let sharedCount = 0;
  for (const term of all) {
    const inSets = [s0.has(term), s1.has(term), s2.has(term)].filter(Boolean).length;
    if (inSets >= 2) sharedCount++;
  }

  const ratio = all.size > 0 ? sharedCount / all.size : 0;
  if (ratio >= 0.15) return 'CONCORDANT';
  if (ratio >= 0.05) return 'PARTIAL';
  return 'DISCORDANT';
}

// ─── Gate evaluator ───────────────────────────────────────────────────────────

// BP133 Yoke #24 Task 2: exported for plow_mc_answerer.ts's MC-answering gate evaluation
// (same 4 gates apply; the free-text and MC variants must stay comparable).
export function evaluateGates(
  candidatesPostFurnace: number,
  bmvScore: number,
  concordance: ConcordanceClass,
  latencyMs: number,
): GateOutcome[] {
  return [
    {
      gate: 'G1_FACT',
      passed: candidatesPostFurnace > 0,
      detail: candidatesPostFurnace > 0
        ? `${candidatesPostFurnace} candidates survived Furnace`
        : 'No candidates survived Furnace — no verified facts',
    },
    {
      gate: 'G2_CONC',
      passed: concordance !== 'DISCORDANT',
      detail: `Concordance: ${concordance}`,
    },
    {
      gate: 'G3_BMV',
      passed: bmvScore >= 40,
      detail: `BMV: ${bmvScore}`,
    },
    {
      gate: 'G4_LAT',
      passed: latencyMs < 120_000,
      detail: `Latency: ${(latencyMs / 1000).toFixed(1)}s`,
    },
  ];
}

// ─── Saladin (adversarial fence) ──────────────────────────────────────────────

// BP133 Yoke #24 Task 2: exported so plow_mc_answerer.ts reuses the exact same Adversarial
// Fence stage rather than a second, potentially-drifting copy.
export async function runSaladin(
  candidates: CandidateEblet[],
  ollamaBaseUrl: string,
  model: string,
): Promise<{ passed: CandidateEblet[]; challenged: CandidateEblet[] }> {
  const passed: CandidateEblet[] = [];
  const challenged: CandidateEblet[] = [];

  for (const candidate of candidates) {
    try {
      const prompt = SALADIN_CHALLENGE_PROMPT(candidate.content.slice(0, 400));
      const response = await callOllama(prompt, ollamaBaseUrl, model, 0.2);

      if (response === null) {
        // Ollama unavailable — heuristic fallback: pass if content is substantial
        if (candidate.content.length >= 150 && candidate.weight >= 0.7) {
          passed.push(candidate);
        } else {
          // Heuristic: flag short/low-weight content as challenged
          challenged.push(candidate);
        }
        continue;
      }

      const upperResp = response.toUpperCase().trim();
      const isChallenged = upperResp.startsWith('CHALLENGE') ||
        upperResp.includes('CHALLENGE') && !upperResp.includes('PASS');

      if (isChallenged) {
        challenged.push(candidate);
      } else {
        passed.push(candidate);
      }
    } catch {
      // On error, apply heuristic
      if (candidate.weight >= 0.75) {
        passed.push(candidate);
      } else {
        challenged.push(candidate);
      }
    }
  }

  return { passed, challenged };
}

// ─── Three Fates (3-voter arbitration) ───────────────────────────────────────

async function runThreeFates(
  question: string,
  candidates: CandidateEblet[],
  ollamaBaseUrl: string,
  model: string,
): Promise<{ answers: (string | null)[]; concordance: ConcordanceClass }> {
  const factsContext = candidates
    .slice(0, 5)
    .map((c, i) => `[Source ${i + 1} — ${c.source}]: ${c.content.slice(0, 400)}`)
    .join('\n\n');

  const temperatures = [0.0, 0.2, 0.4];
  const answers = await Promise.all(
    temperatures.map((temp, idx) =>
      callOllama(THREE_FATES_PROMPT(question, factsContext, idx), ollamaBaseUrl, model, temp),
    ),
  );

  const concordance = computeConcordance(answers);
  return { answers, concordance };
}

// ─── Scribe ────────────────────────────────────────────────────────────────────

// BP133 Yoke #24 Task 2: exported so plow_mc_answerer.ts writes eblets through the exact
// same Scribe convention (search-key format, provenance tag, sha256) as the free-text pipeline.
export async function runScribe(
  domain: string,
  question: string,
  questionId: string,
  candidates: CandidateEblet[],
  bmvScore: number,
  concordance: ConcordanceClass,
  gateOutcomes: GateOutcome[],
  andonTriggered: boolean,
  andonRetries: number,
  writeEbletFn: (eblet: {
    question: string;
    answer: string;
    provenance: string;
    verified: true;
    sha256: string;
    timestamp: number;
    reasoning?: string;
    verdict?: 'correct' | 'wrong' | 'unverified';
    confidence?: number;
  }) => Promise<void>,
  // BP135 Yoke #34 (0.9.7) argument-ledger, OPTIONAL. When omitted (every pre-0.9.7 call site,
  // and the free-text pipeline's own two call sites below), verdict defaults to 'unverified'
  // (no ground-truth letter was ever available to this pipeline) and confidence is auto-derived
  // from bmvScore/concordance via computeArgumentConfidence() -- still additive vs pre-0.9.7
  // (which wrote no ledger fields at all), just without an explicit override. Only
  // plow_mc_answerer.ts's MC answerer currently supplies an explicit ledgerContext (captured
  // voter reasoning + test-mode verdict against payload.correct_answer_letter).
  ledgerContext?: { reasoning?: string; verdict?: 'correct' | 'wrong' | 'unverified'; confidence?: number },
): Promise<{ ebletsWritten: number; ebletsSkippedIrrelevant: number; record: ScriberRecord }> {
  let ebletsWritten = 0;
  let ebletsSkippedIrrelevant = 0;
  const now = Date.now();

  const effectiveReasoning = ledgerContext?.reasoning;
  const effectiveVerdict = ledgerContext?.verdict ?? 'unverified';
  const effectiveConfidence = ledgerContext?.confidence ?? computeArgumentConfidence(bmvScore, concordance);

  // BP135 Yoke #34 (0.9.7): lazy import matches the existing pattern already used for this
  // module elsewhere (Spider stage below, plow_mc_answerer.ts's own dynamic imports) -- keeps
  // canonical_pipeline.ts decoupled from mnem_eblet_store.ts at module-load time.
  const { isQaRelevant } = await import('../mnem_eblet_store');

  for (const candidate of candidates) {
    try {
      // Store as substrate eblet: searchable by domain + content keywords
      const searchKey = `${domain} | ${question.slice(0, 80)} | ${candidate.source}`;
      const factContent = candidate.content.slice(0, 600);

      // BP135 Yoke #34 (0.9.7) RELEVANCE GATE AT WRITE: BP135 audit found ~47% of existing
      // canonical_plow eblets are Q/A-mismatched junk. Skip the write entirely rather than
      // stamping a mismatched fact as verified=true -- Rule 66 (never rewrite/delete existing
      // eblets) means correctness has to be enforced going forward at the write gate, not by
      // cleaning up what is already on disk.
      if (!isQaRelevant(question, factContent)) {
        ebletsSkippedIrrelevant++;
        continue;
      }

      const hash = sha256hex(searchKey + factContent);

      await writeEbletFn({
        question: searchKey,
        answer: factContent,
        provenance: `canonical_plow:${candidate.source}:${domain}:bp083`,
        verified: true,
        sha256: hash,
        timestamp: now,
        ...(effectiveReasoning !== undefined ? { reasoning: effectiveReasoning } : {}),
        verdict: effectiveVerdict,
        confidence: effectiveConfidence,
      });

      ebletsWritten++;
    } catch {
      // Non-fatal — skip this candidate
    }
  }

  const record: ScriberRecord = {
    questionId,
    domain,
    question: question.slice(0, 120),
    ebletCount: candidates.length,
    bmvScore,
    concordance,
    gateOutcomes,
    ebletsWritten,
    andonTriggered,
    andonRetries,
    timestamp: now,
  };

  return { ebletsWritten, ebletsSkippedIrrelevant, record };
}

// ─── Detective TEAM ───────────────────────────────────────────────────────────

// BP133 Yoke #24 Task 2: exported so plow_mc_answerer.ts's Andon retry loop (Condition C)
// reuses the exact same root-cause/widening logic as the free-text pipeline's Andon cord.
export interface DetectiveReport {
  failedGates: GateId[];
  rootCause: string;
  recommendation: string;
  wideningApplied: boolean;
  additionalOperators: SpecialistName[];
}

export function runDetectiveTeam(
  gateOutcomes: GateOutcome[],
  candidatesRaw: number,
  candidatesPostMiner: number,
  candidatesPostFurnace: number,
  currentOperators: SpecialistName[],
): DetectiveReport {
  const failedGates = gateOutcomes.filter((g) => !g.passed).map((g) => g.gate);
  let rootCause = 'Unknown failure';
  let recommendation = 'Retry with same operators';
  let additionalOperators: SpecialistName[] = [];

  if (candidatesRaw === 0) {
    rootCause = 'Spider/Specialists returned 0 candidates — all external API calls failed or timed out';
    recommendation = 'Widen operators: add commoncrawl + wikipedia fallback';
    additionalOperators = ['wikipedia', 'commoncrawl'].filter((o) => !currentOperators.includes(o as SpecialistName)) as SpecialistName[];
  } else if (candidatesPostMiner === 0) {
    rootCause = `Miner filtered ALL ${candidatesRaw} candidates — weight < 0.6 or content < 100 chars`;
    recommendation = 'Widen operators to sources with higher content density (arxiv, openalex)';
    additionalOperators = ['arxiv', 'openalex'].filter((o) => !currentOperators.includes(o as SpecialistName)) as SpecialistName[];
  } else if (candidatesPostFurnace === 0) {
    rootCause = `Furnace burned ALL ${candidatesPostMiner} candidates — Saladin challenged all`;
    recommendation = 'Lower Saladin challenge threshold OR widen to authoritative sources (nist, pubmed)';
    additionalOperators = ['nist', 'pubmed'].filter((o) => !currentOperators.includes(o as SpecialistName)) as SpecialistName[];
  } else if (failedGates.includes('G2_CONC')) {
    rootCause = 'Three Fates DISCORDANT — surviving facts contradict each other';
    recommendation = 'Increase source count with wikipedia + openalex for cross-validation';
    additionalOperators = ['wikipedia', 'openalex'].filter((o) => !currentOperators.includes(o as SpecialistName)) as SpecialistName[];
  } else if (failedGates.includes('G3_BMV')) {
    rootCause = 'BMV below threshold — low source diversity or quality';
    recommendation = 'Add higher-weight sources: wolfram, nist, arxiv';
    additionalOperators = ['wolfram', 'arxiv'].filter((o) => !currentOperators.includes(o as SpecialistName)) as SpecialistName[];
  }

  const wideningApplied = additionalOperators.length > 0;

  return { failedGates, rootCause, recommendation, wideningApplied, additionalOperators };
}

// ─── Single-question canonical pipeline ──────────────────────────────────────

async function runCanonicalQuestion(
  domain: string,
  question: string,
  questionId: string,
  operatorList: SpecialistName[],
  ollamaBaseUrl: string,
  model: string,
  specialistKeys: SpecialistKeys,
  writeEbletFn: (eblet: {
    question: string; answer: string; provenance: string;
    verified: true; sha256: string; timestamp: number;
  }) => Promise<void>,
  onProgress: (event: CanonicalPlowProgressEvent) => void,
  domainIndex: number,
  totalDomains: number,
  questionIndex: number,
  totalQuestions: number,
  andonRetry = 0,
  widenerOperators: SpecialistName[] = [],
  postFurnaceCap = 6,
): Promise<CanonicalPlowQuestionResult> {

  const startMs = Date.now();
  const effectiveOperators = [...new Set([...operatorList, ...widenerOperators])];

  onProgress({
    type: 'question-start',
    domain,
    domainIndex,
    totalDomains,
    questionIndex,
    totalQuestions,
  });

  // ── Stage 1: Spider — locate topical eblets in local substrate ────────────
  // BP133 Yoke #24 finding (R-MECHANISM-VERIFY, 2026-07-24): spiderEblets IS correctly
  // fetched here, but is never consumed anywhere below -- factsForArbitration (used by Three
  // Fates in Stage 7) is built ONLY from specialist-sourced CandidateEblet[] (postFurnace /
  // postMiner). Local substrate therefore has ZERO effect on this free-text pipeline's answer
  // today, regardless of what verified_eblets.jsonl contains. Not changed here (out of scope:
  // this Yoke's substrate-toggle correctness gate targets the NEW MC-answering path in
  // plow_mc_answerer.ts, which wires substrate correctly and explicitly via the same
  // applySubstrateToggle() used everywhere else in this Yoke) -- flagged to Bishop in the
  // Yoke-return rather than left for someone to discover as a surprise later.
  let spiderEblets: string[] = [];
  try {
    const { queryVerifiedEbletsTopical } = await import('../mnem_eblet_store');
    const hits = await queryVerifiedEbletsTopical(question, domain, 3);
    spiderEblets = hits.map((e) => `[local:${e.provenance}] ${e.answer?.slice(0, 200) ?? ''}`);
  } catch { /* Spider failing is non-fatal */ }
  void spiderEblets;

  // ── Stage 2: Sprite — retrieve eblets (already done in Spider step) ───────
  // spiderEblets is the Sprite output (already retrieved)

  // ── Stage 3: 9 Specialists in PARALLEL STAGGERED SWARM ───────────────────
  const allCandidates: CandidateEblet[] = [];
  const specialistsUsed: string[] = [];

  for (let i = 0; i < effectiveOperators.length; i++) {
    const specialistName = effectiveOperators[i];
    if (!specialistName) continue;

    // FireGuard 1.0s stagger between dispatches
    if (i > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, FIREGUARD_STAGGER_MS));
    }

    onProgress({
      type: 'specialist-fire',
      domain,
      specialistName,
      questionIndex,
      totalQuestions,
    });

    try {
      const fn = SPECIALIST_REGISTRY[specialistName];
      const candidates = await fn(question, domain, specialistKeys);
      allCandidates.push(...candidates);
      specialistsUsed.push(specialistName);

      onProgress({
        type: 'specialist-done',
        domain,
        specialistName,
        specialistCandidates: candidates.length,
        questionIndex,
        totalQuestions,
      });
    } catch {
      // Adapter error — non-fatal, continue
    }
  }

  const candidatesRaw = allCandidates.length;

  // ── Stage 4: Miner — anti-popularity filter ───────────────────────────────
  const postMiner = allCandidates.filter(
    (c) => c.weight >= MINER_MIN_WEIGHT && c.content.length >= MINER_MIN_CONTENT_LEN,
  );

  onProgress({
    type: 'miner-done',
    domain,
    minerPassed: postMiner.length,
    questionIndex,
    totalQuestions,
  });

  // ── Stage 5: Saladin — Adversarial Fence ──────────────────────────────────
  const { passed: saladinePassedFull, challenged: saladineChallengd } = await runSaladin(
    postMiner, ollamaBaseUrl, model,
  );

  // Keep only the top-quality survivors (cap at 6 for efficiency; BP134 Yoke #32 Phase C
  // raises this to postFurnaceCap only when field-sowing's deepHarvest passed a higher value --
  // the live A/B/C button always calls with the default 6, unchanged).
  const saladinePassedSorted = saladinePassedFull
    .sort((a, b) => b.weight - a.weight)
    .slice(0, postFurnaceCap);

  void saladineChallengd; // used only for logging; not needed downstream

  onProgress({
    type: 'saladin-done',
    domain,
    questionIndex,
    totalQuestions,
  });

  // ── Stage 6: Furnace — Angel of Death ────────────────────────────────────
  // Furnace = Saladin's output (candidates Saladin didn't challenge)
  const postFurnace = saladinePassedSorted;

  onProgress({
    type: 'furnace-done',
    domain,
    furnacePassed: postFurnace.length,
    questionIndex,
    totalQuestions,
  });

  // ── Stage 7: Three Fates — 3-voter arbitration ────────────────────────────
  const factsForArbitration = postFurnace.length > 0
    ? postFurnace
    : postMiner.slice(0, 3); // fallback: use pre-Saladin candidates if Furnace burned all

  let concordance: ConcordanceClass = 'DISCORDANT';

  if (factsForArbitration.length > 0) {
    const result = await runThreeFates(question, factsForArbitration, ollamaBaseUrl, model);
    concordance = result.concordance;
  }

  onProgress({
    type: 'three-fates-done',
    domain,
    questionIndex,
    totalQuestions,
  });

  // ── Stage 8: Scribe — record result ──────────────────────────────────────
  const latencyMs = Date.now() - startMs;
  const bmvScore = computeBmvScore(
    candidatesRaw, postMiner.length, postFurnace.length,
    postFurnace.length, concordance, specialistsUsed.length, latencyMs,
  );

  const gateOutcomes = evaluateGates(postFurnace.length, bmvScore, concordance, latencyMs);
  const anyGateFailed = gateOutcomes.some((g) => !g.passed);

  // ── Stage 9: Detective TEAM + Federated Andon cord (v0.4.0) ─────────────
  let andonTriggered = false;
  let finalRetries = andonRetry;
  let andonTierResolved: 1 | 2 | 3 | null = null;
  let diagnosisId: string | null = null;
  let pendingHuman = false;
  let finalResult: CanonicalPlowQuestionResult;

  if (anyGateFailed && andonRetry < MAX_ANDON_RETRIES) {
    andonTriggered = true;
    finalRetries = andonRetry + 1;

    const report = runDetectiveTeam(
      gateOutcomes, candidatesRaw, postMiner.length,
      postFurnace.length, effectiveOperators,
    );

    onProgress({
      type: 'andon-trigger',
      domain,
      questionIndex,
      totalQuestions,
      andonRetry: finalRetries,
    });

    console.log(
      `[CanonicalPipeline] ANDON domain=${domain} Q[${questionIndex}] ` +
      `retry=${finalRetries}/${MAX_ANDON_RETRIES} rootCause="${report.rootCause}" ` +
      `addingOperators=${JSON.stringify(report.additionalOperators)}`,
    );

    if (report.wideningApplied && report.additionalOperators.length > 0) {
      // Restart from Q1 for this question with widened operators
      const retryResult = await runCanonicalQuestion(
        domain, question, questionId,
        operatorList, ollamaBaseUrl, model, specialistKeys,
        writeEbletFn, onProgress,
        domainIndex, totalDomains, questionIndex, totalQuestions,
        finalRetries, report.additionalOperators, postFurnaceCap,
      );

      onProgress({ type: 'andon-recovered', domain, questionIndex, totalQuestions, andonRetry: finalRetries });
      return retryResult;
    }

    // v0.4.0: Cannot widen via Detective — escalate via Federated Andon (ESCALATE not quarantine)
    onProgress({ type: 'andon-exhausted', domain, questionIndex, totalQuestions, andonRetry: finalRetries });
  }

  // v0.4.0: If all gates failed AND all retries exhausted AND no candidates → Federated Andon
  const allGatesFailed = gateOutcomes.every((g) => !g.passed);
  const noSurvivors = postFurnace.length === 0 && postMiner.length === 0;

  if (allGatesFailed && noSurvivors && andonRetry >= MAX_ANDON_RETRIES) {
    // Federated Andon 3-tier escalation
    try {
      const { escalateAndon } = await import('../federation/federated_andon');
      const resolution = await escalateAndon(
        domain,
        question,
        (msg) => {
          console.log(msg);
          if (msg.includes('Tier 1')) onProgress({ type: 'andon-tier1', domain, questionIndex, totalQuestions });
          else if (msg.includes('Tier 2')) onProgress({ type: 'andon-tier2', domain, questionIndex, totalQuestions });
          else if (msg.includes('Tier 3')) onProgress({ type: 'andon-tier3-diagnosis', domain, questionIndex, totalQuestions });
        },
      );

      if (resolution.status === 'resolved') {
        andonTierResolved = resolution.tier;
        // Use the escalation-recovered candidates
        const recoveredCandidates = resolution.candidates;
        const { ebletsWritten: recoveredEblets, record: recoveredRecord } = await runScribe(
          domain, question, questionId, recoveredCandidates,
          bmvScore, concordance, gateOutcomes, andonTriggered, finalRetries, writeEbletFn,
        );
        return {
          questionId, domain,
          ebletsWritten: recoveredEblets,
          bmvScore, concordance, gateOutcomes,
          andonTriggered: true, andonRetries: finalRetries,
          andonTierResolved, diagnosisId: null, pendingHuman: false,
          specialistsUsed, candidatesRaw,
          candidatesPostMiner: postMiner.length, candidatesPostFurnace: postFurnace.length,
          scribes: [recoveredRecord],
        };
      } else if (resolution.status === 'pending_human') {
        andonTierResolved = 3;
        diagnosisId = resolution.diagnosisId;
        pendingHuman = true;
        console.log(`[CanonicalPipeline] Tier 3 Diagnosis posted id=${diagnosisId} for Q "${question.slice(0, 60)}"`);
      }
      // status === 'no_answer': fall through to write zero eblets
    } catch (escalateErr) {
      console.error('[CanonicalPipeline] Federated Andon escalation error:', escalateErr);
    }
  }

  // Write surviving facts to substrate
  const writeCandidates = postFurnace.length > 0 ? postFurnace : [];
  const { ebletsWritten, record } = await runScribe(
    domain, question, questionId,
    writeCandidates, bmvScore, concordance, gateOutcomes,
    andonTriggered, finalRetries, writeEbletFn,
  );

  onProgress({
    type: 'scribe-done',
    domain,
    questionIndex,
    totalQuestions,
    ebletsWrittenThisQuestion: ebletsWritten,
  });

  finalResult = {
    questionId,
    domain,
    ebletsWritten,
    bmvScore,
    concordance,
    gateOutcomes,
    andonTriggered,
    andonRetries: finalRetries,
    andonTierResolved: andonTierResolved ?? null,
    diagnosisId: diagnosisId ?? null,
    pendingHuman,
    specialistsUsed,
    candidatesRaw,
    candidatesPostMiner: postMiner.length,
    candidatesPostFurnace: postFurnace.length,
    scribes: [record],
  };

  return finalResult;
}

// ─── Domain pipeline ──────────────────────────────────────────────────────────

async function runDomainPipeline(
  domain: string,
  domainIndex: number,
  totalDomains: number,
  questions: string[],
  ollamaBaseUrl: string,
  model: string,
  specialistKeys: SpecialistKeys,
  writeEbletFn: (eblet: {
    question: string; answer: string; provenance: string;
    verified: true; sha256: string; timestamp: number;
  }) => Promise<void>,
  onProgress: (event: CanonicalPlowProgressEvent) => void,
  cancelToken: { cancelled: boolean },
  postFurnaceCap = 6,
): Promise<CanonicalPlowDomainResult> {

  const operators = getOperatorsForDomain(domain);
  const questionResults: CanonicalPlowQuestionResult[] = [];
  let domainEblets = 0;
  let domainAndonEvents = 0;
  let domainPendingHuman = 0;

  onProgress({
    type: 'domain-start',
    domain,
    domainIndex,
    totalDomains,
    totalQuestions: questions.length,
  });

  for (let qi = 0; qi < questions.length; qi++) {
    if (cancelToken.cancelled) break;

    const question = questions[qi];
    if (!question) continue;

    const questionId = generateQuestionId(question, domain);

    try {
      const result = await runCanonicalQuestion(
        domain, question, questionId,
        operators, ollamaBaseUrl, model, specialistKeys,
        writeEbletFn, onProgress,
        domainIndex, totalDomains, qi, questions.length,
        0, [], postFurnaceCap,
      );

      questionResults.push(result);
      domainEblets += result.ebletsWritten;
      if (result.andonTriggered) domainAndonEvents++;
      if (result.pendingHuman) domainPendingHuman++;

      onProgress({
        type: 'question-done',
        domain,
        domainIndex,
        totalDomains,
        questionIndex: qi,
        totalQuestions: questions.length,
        ebletsWrittenThisQuestion: result.ebletsWritten,
        totalEbletsWritten: domainEblets,
      });

    } catch (err) {
      console.error(`[CanonicalPipeline] domain=${domain} Q[${qi}] error:`, err);
      // Record a zero-result for this question but continue domain
      questionResults.push({
        questionId,
        domain,
        ebletsWritten: 0,
        bmvScore: 0,
        concordance: 'DISCORDANT',
        gateOutcomes: [
          { gate: 'G1_FACT', passed: false, detail: 'Pipeline error' },
          { gate: 'G2_CONC', passed: false, detail: 'Pipeline error' },
          { gate: 'G3_BMV', passed: false, detail: 'Pipeline error' },
          { gate: 'G4_LAT', passed: false, detail: 'Pipeline error' },
        ],
        andonTriggered: true,
        andonRetries: 0,
        specialistsUsed: [],
        candidatesRaw: 0,
        candidatesPostMiner: 0,
        candidatesPostFurnace: 0,
        scribes: [],
      });
    }
  }

  const verifiedCount = questionResults.filter((r) => r.ebletsWritten > 0).length;
  const quarantinedCount = questionResults.filter((r) => r.ebletsWritten === 0 && !r.pendingHuman).length;
  const pendingHumanCount = domainPendingHuman;
  const avgBmv = questionResults.length > 0
    ? questionResults.reduce((s, r) => s + r.bmvScore, 0) / questionResults.length
    : 0;

  const status: CanonicalPlowDomainResult['status'] =
    domainEblets >= 3 ? 'GREEN' : domainEblets >= 1 ? 'YELLOW' : 'RED';

  const domainResult: CanonicalPlowDomainResult = {
    domain,
    questionResults,
    totalEbletsWritten: domainEblets,
    avgBmvScore: Math.round(avgBmv * 10) / 10,
    verifiedCount,
    quarantinedCount,
    pendingHumanCount,
    andonEvents: domainAndonEvents,
    status,
  };

  onProgress({
    type: 'domain-done',
    domain,
    domainIndex,
    totalDomains,
    totalEbletsWritten: domainEblets,
    totalQuarantined: quarantinedCount,
    domainResult,
    domainStatus: status,
  });

  return domainResult;
}

// ─── Top-level canonical Plow runner ─────────────────────────────────────────

export async function runCanonicalPlow(
  config: CanonicalPlowConfig,
  writeEbletFn: (eblet: {
    question: string; answer: string; provenance: string;
    verified: true; sha256: string; timestamp: number;
  }) => Promise<void>,
  onProgress: (event: CanonicalPlowProgressEvent) => void,
  cancelToken: { cancelled: boolean },
  sampleQuestionsForDomain: (domain: string, n: number) => string[],
): Promise<CanonicalPlowResult> {

  const ollamaBaseUrl = config.ollamaBaseUrl ?? 'http://127.0.0.1:11434';
  const model = config.model ?? 'gemma4:12b';
  const rawSpecialistKeys = config.specialistKeys ?? {};

  // BP134 Yoke #32 Phase C: deepHarvest is opt-in per config (field-sowing only). When
  // false/undefined, specialistKeys/postFurnaceCap are byte-identical to today's live A/B/C
  // button behavior -- effectiveSpecialistKeys === rawSpecialistKeys object shape, cap stays 6.
  const specialistKeys: SpecialistKeys = config.deepHarvest
    ? { ...rawSpecialistKeys, maxResultsPerAdapter: rawSpecialistKeys.maxResultsPerAdapter ?? config.maxEbletsPerQuestion ?? 8 }
    : rawSpecialistKeys;
  const postFurnaceCap = config.deepHarvest ? (config.maxEbletsPerQuestion ?? 20) : 6;

  const startedAt = Date.now();
  const domainResults: CanonicalPlowDomainResult[] = [];
  let totalEbletsWritten = 0;
  let totalQuarantined = 0;

  for (let di = 0; di < config.domains.length; di++) {
    if (cancelToken.cancelled) break;

    const domain = config.domains[di];
    if (!domain) continue;

    // Per-domain isolation: get questions independently
    const questions = sampleQuestionsForDomain(domain, config.questionsPerDomain);
    if (questions.length === 0) {
      console.warn(`[CanonicalPipeline] No questions available for domain=${domain}`);
      continue;
    }

    // Isolated domain pipeline — any error here does NOT affect other domains
    try {
      const result = await runDomainPipeline(
        domain, di, config.domains.length,
        questions, ollamaBaseUrl, model, specialistKeys,
        writeEbletFn, onProgress, cancelToken, postFurnaceCap,
      );
      domainResults.push(result);
      totalEbletsWritten += result.totalEbletsWritten;
      totalQuarantined += result.quarantinedCount;
    } catch (domainErr) {
      console.error(`[CanonicalPipeline] Domain pipeline crash domain=${domain}:`, domainErr);
      // Record a failed domain result but continue to next domain
      domainResults.push({
        domain,
        questionResults: [],
        totalEbletsWritten: 0,
        avgBmvScore: 0,
        verifiedCount: 0,
        quarantinedCount: questions.length,
        pendingHumanCount: 0,
        andonEvents: 0,
        status: 'RED',
      });
    }
  }

  const overallStatus: CanonicalPlowResult['overallStatus'] =
    totalEbletsWritten >= GREEN_EBLET_THRESHOLD ? 'GREEN' : 'YELLOW';

  const result: CanonicalPlowResult = {
    config,
    startedAt,
    completedAt: Date.now(),
    domainResults,
    totalEbletsWritten,
    totalQuarantined,
    overallStatus,
  };

  onProgress({
    type: 'complete',
    totalEbletsWritten,
    totalQuarantined,
  });

  console.log(
    `[CanonicalPipeline] COMPLETE totalEbletsWritten=${totalEbletsWritten} ` +
    `totalQuarantined=${totalQuarantined} status=${overallStatus}`,
  );

  return result;
}
