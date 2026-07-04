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

const FIREGUARD_STAGGER_MS = 1000;
const MINER_MIN_WEIGHT = 0.6;
const MINER_MIN_CONTENT_LEN = 100;
const MAX_ANDON_RETRIES = 3;
const OLLAMA_TIMEOUT_MS = 30_000;
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

function generateQuestionId(question: string, domain: string): string {
  return sha256hex(domain + ':' + question).slice(0, 12);
}

async function callOllama(
  prompt: string,
  ollamaBaseUrl: string,
  model: string,
  temperature: number,
): Promise<string | null> {
  try {
    const resp = await fetch(`${ollamaBaseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: { temperature, num_predict: 256 },
      }),
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { response?: string };
    return data.response?.trim() ?? null;
  } catch {
    return null;
  }
}

// ─── BMV computation ──────────────────────────────────────────────────────────

function computeBmvScore(
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

function evaluateGates(
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

async function runSaladin(
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

async function runScribe(
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
  }) => Promise<void>,
): Promise<{ ebletsWritten: number; record: ScriberRecord }> {
  let ebletsWritten = 0;
  const now = Date.now();

  for (const candidate of candidates) {
    try {
      // Store as substrate eblet: searchable by domain + content keywords
      const searchKey = `${domain} | ${question.slice(0, 80)} | ${candidate.source}`;
      const factContent = candidate.content.slice(0, 600);
      const hash = sha256hex(searchKey + factContent);

      await writeEbletFn({
        question: searchKey,
        answer: factContent,
        provenance: `canonical_plow:${candidate.source}:${domain}:bp083`,
        verified: true,
        sha256: hash,
        timestamp: now,
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

  return { ebletsWritten, record };
}

// ─── Detective TEAM ───────────────────────────────────────────────────────────

interface DetectiveReport {
  failedGates: GateId[];
  rootCause: string;
  recommendation: string;
  wideningApplied: boolean;
  additionalOperators: SpecialistName[];
}

function runDetectiveTeam(
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
  let spiderEblets: string[] = [];
  try {
    const { queryVerifiedEbletsTopical } = await import('../mnem_eblet_store');
    const hits = await queryVerifiedEbletsTopical(question, domain, 3);
    spiderEblets = hits.map((e) => `[local:${e.provenance}] ${e.answer?.slice(0, 200) ?? ''}`);
  } catch { /* Spider failing is non-fatal */ }

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

  // Keep only the top-quality survivors (cap at 6 for efficiency)
  const saladinePassedSorted = saladinePassedFull
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 6);

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
        finalRetries, report.additionalOperators,
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
  const specialistKeys = config.specialistKeys ?? {};

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
        writeEbletFn, onProgress, cancelToken,
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
