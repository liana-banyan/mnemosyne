// plow_mc_answerer.ts — BP133 Yoke #24 Task 2: the 12-Blade Column Plow, adapted to answer a
// single graded multiple-choice question instead of doing open-ended knowledge-building.
//
// WHY THIS FILE EXISTS (R-MECHANISM-VERIFY, 2026-07-24): canonical_pipeline.ts's exported
// runCanonicalPlow() operates on free-text research QUESTIONS per domain and never returns a
// letter answer anywhere in CanonicalPlowQuestionResult -- confirmed by direct read of every
// stage. Its Three Fates arbitration (runThreeFates) asks 3 voters to "give a precise, factual
// answer" in prose; there is no MC-option-aware prompt anywhere in that file. So there was no
// existing function to call for "make the plow answer an MMLU-Pro letter" -- this file is that
// function, built by REUSING (not duplicating) every stage of the real pipeline: the same
// SPECIALIST_REGISTRY 9-specialist staggered swarm, the same Miner/Saladin/Furnace filters, the
// same Andon/Detective-Team widening-and-retry cord, and the same Scribe eblet-writing
// convention -- all imported directly from canonical_pipeline.ts (see the exports added there
// for this Yoke). Only the FINAL arbitration stage differs: instead of 3 free-text voters, this
// runs 3 MC-letter voters and takes a plurality vote, because that is the one stage that
// fundamentally cannot be reused unchanged (free text has no "correct letter" to grade).
//
// SUBSTRATE TOGGLE REUSE (Task 1 continuity): this file does NOT implement its own local-store
// gating. The caller (index.ts's startRelayRoutePoll) already computes `effectivePrompt` via
// substrate_toggle.ts's applySubstrateToggle() ONCE, before branching into single-shot / Minor
// Council / plow -- see that file's own comment for why that is the single authoritative
// injection site for this whole Yoke. This function receives that already-gated prompt and
// treats it as opaque; when substrate is OFF, mcPromptWithSubstrate is byte-identical to the
// raw MC prompt (zero eblet-store calls happened upstream), and this file makes no additional
// eblet-store read of its own for the final-answer prompt. This is what makes Condition A
// (plow, substrate OFF) genuinely cold: the ONLY substrate-shaped input this function ever sees
// is whatever applySubstrateToggle already decided to inject, never more.
//
// Rule 66: version, never overwrite -- this is a new file, no supersede needed.

import type { CandidateEblet, SpecialistKeys, SpecialistName } from './specialist_adapters';
import { SPECIALIST_REGISTRY } from './specialist_adapters';
import { getOperatorsForDomain } from './domain_operator_map';
import {
  callOllama,
  computeBmvScore,
  evaluateGates,
  generateQuestionId,
  runDetectiveTeam,
  runSaladin,
  runScribe,
  FIREGUARD_STAGGER_MS,
  MAX_ANDON_RETRIES,
  MINER_MIN_CONTENT_LEN,
  MINER_MIN_WEIGHT,
  type ConcordanceClass,
  type GateOutcome,
} from './canonical_pipeline';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlowMcCondition = 'A_cold' | 'B_warm_single_pass' | 'C_warm_andon';

export interface CanonicalPlowMcConfig {
  domain: string;
  ollamaBaseUrl: string;
  model: string;
  choiceCount: number;
  /** Condition C only. Condition A/B both pass false -- a single pass, win or lose. */
  andonEnabled: boolean;
  specialistKeys?: SpecialistKeys;
}

export interface CanonicalPlowMcResult {
  questionId: string;
  domain: string;
  /** null = the plow reached no majority letter (DISCORDANT or all-voters-empty). This is a
   *  NO-ANSWER, per the K32-mesh provenance finding (BP103) that a blank must be scored as its
   *  own category, never folded into "wrong" -- the caller (index.ts) must preserve that
   *  distinction rather than coercing null to a random/default letter. */
  chosenLetter: string | null;
  voterLetters: (string | null)[];
  concordance: ConcordanceClass;
  bmvScore: number;
  gateOutcomes: GateOutcome[];
  specialistsUsed: string[];
  candidatesRaw: number;
  candidatesPostMiner: number;
  candidatesPostFurnace: number;
  andonTriggered: boolean;
  andonRetries: number;
  ebletsWritten: number;
  latencyMs: number;
  /** Human-readable one-line trace for the persisted receipt (Task 2.3) -- audits HOW the
   *  answer was reached without dumping the full candidate corpus into every receipt row. */
  traceSummary: string;
}

// ─── MC-specific final-arbitration prompt ────────────────────────────────────

const MC_VOTER_TEMPERATURES = [0.0, 0.2, 0.4];

function buildMcArbitrationPrompt(factsContext: string, mcPromptWithSubstrate: string): string {
  if (factsContext.length === 0) return mcPromptWithSubstrate;
  return `Additional research context gathered by independent specialists (Wikipedia, Wikidata, arXiv, etc. -- may or may not be directly relevant, use judgment):\n${factsContext}\n\n${mcPromptWithSubstrate}`;
}

function letterFromIndexLocal(i: number): string {
  return String.fromCharCode(65 + i);
}

/** Same parsing convention as one_click_mmlu_pro.ts's parseLetterFromModelText, duplicated
 *  (not imported) to keep this plow module import-graph-independent of the mesh_test/ folder --
 *  canonical_pipeline.ts and its siblings never import from mesh_test/ today, and this file
 *  should not be the first to create that cross-dependency for a one-line regex. */
function parseLetterLocal(text: string, choiceCount: number): string | null {
  const validLetters = Array.from({ length: choiceCount }, (_, i) => letterFromIndexLocal(i));
  const trimmed = text.trim();
  if (validLetters.includes(trimmed.toUpperCase()) && trimmed.length <= 2) return trimmed.toUpperCase();
  const labeled = trimmed.match(/(?:answer|correct answer)\s*(?:is|:)?\s*\(?([A-J])\)?/i);
  if (labeled && validLetters.includes(labeled[1].toUpperCase())) return labeled[1].toUpperCase();
  const paren = trimmed.match(/\(([A-J])\)/);
  if (paren && validLetters.includes(paren[1].toUpperCase())) return paren[1].toUpperCase();
  const bare = trimmed.match(/\b([A-J])\b/);
  if (bare && validLetters.includes(bare[1].toUpperCase())) return bare[1].toUpperCase();
  return null;
}

function computeLetterConcordance(letters: (string | null)[]): { concordance: ConcordanceClass; chosenLetter: string | null } {
  const valid = letters.filter((l): l is string => l !== null);
  if (valid.length === 0) return { concordance: 'DISCORDANT', chosenLetter: null };

  const counts: Record<string, number> = {};
  for (const l of valid) counts[l] = (counts[l] ?? 0) + 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [topLetter, topCount] = sorted[0]!;

  // 3-voter semantics: 3/3 or 2/3 agreement on a letter = usable answer. 1/3 or a 3-way split
  // (topCount === 1 with 3 valid voters) is genuinely discordant -- no real majority exists.
  if (topCount >= 2) {
    return { concordance: topCount === valid.length ? 'CONCORDANT' : 'PARTIAL', chosenLetter: topLetter };
  }
  return { concordance: 'DISCORDANT', chosenLetter: null };
}

// ─── Top-level MC answerer (single question, opt-in Andon retry) ────────────

export async function runCanonicalPlowMcAnswer(
  mcPromptWithSubstrate: string,
  researchQuery: string,
  config: CanonicalPlowMcConfig,
  writeEbletFn: (eblet: {
    question: string; answer: string; provenance: string;
    verified: true; sha256: string; timestamp: number;
  }) => Promise<void>,
  onProgress?: (stage: string) => void,
  andonRetry = 0,
  widenerOperators: SpecialistName[] = [],
): Promise<CanonicalPlowMcResult> {
  const startMs = Date.now();
  const { domain, ollamaBaseUrl, model, choiceCount, andonEnabled, specialistKeys = {} } = config;
  const questionId = generateQuestionId(researchQuery, domain);

  const baseOperators = getOperatorsForDomain(domain);
  const effectiveOperators = [...new Set([...baseOperators, ...widenerOperators])];

  // ── 9 Specialists in parallel staggered swarm (FireGuard 1.0s stagger) ────
  const allCandidates: CandidateEblet[] = [];
  const specialistsUsed: string[] = [];
  for (let i = 0; i < effectiveOperators.length; i++) {
    const specialistName = effectiveOperators[i];
    if (!specialistName) continue;
    if (i > 0) await new Promise<void>((resolve) => setTimeout(resolve, FIREGUARD_STAGGER_MS));
    onProgress?.(`specialist-fire:${specialistName}`);
    try {
      const fn = SPECIALIST_REGISTRY[specialistName];
      const candidates = await fn(researchQuery, domain, specialistKeys);
      allCandidates.push(...candidates);
      specialistsUsed.push(specialistName);
    } catch { /* adapter error -- non-fatal, continue */ }
  }
  const candidatesRaw = allCandidates.length;

  // ── Miner — anti-popularity filter ────────────────────────────────────────
  const postMiner = allCandidates.filter(
    (c) => c.weight >= MINER_MIN_WEIGHT && c.content.length >= MINER_MIN_CONTENT_LEN,
  );
  onProgress?.('miner-done');

  // ── Saladin — Adversarial Fence ────────────────────────────────────────────
  const { passed: saladinPassed } = await runSaladin(postMiner, ollamaBaseUrl, model);
  const postFurnace = saladinPassed.sort((a, b) => b.weight - a.weight).slice(0, 6);
  onProgress?.('furnace-done');

  // ── MC Three Fates — 3-voter LETTER arbitration (the one stage that cannot be reused
  //    unchanged from the free-text pipeline; everything upstream/downstream of this is
  //    identical machinery to canonical_pipeline.ts) ─────────────────────────
  const factsForArbitration = postFurnace.length > 0 ? postFurnace : postMiner.slice(0, 3);
  const factsContext = factsForArbitration
    .slice(0, 5)
    .map((c, i) => `[Source ${i + 1} -- ${c.source}]: ${c.content.slice(0, 400)}`)
    .join('\n\n');
  const arbitrationPrompt = buildMcArbitrationPrompt(factsContext, mcPromptWithSubstrate);

  const voterResponses = await Promise.all(
    MC_VOTER_TEMPERATURES.map((temp) => callOllama(arbitrationPrompt, ollamaBaseUrl, model, temp)),
  );
  const voterLetters = voterResponses.map((r) => (r ? parseLetterLocal(r, choiceCount) : null));
  const { concordance, chosenLetter } = computeLetterConcordance(voterLetters);
  onProgress?.('three-fates-mc-done');

  // ── Gates + BMV (same formula as the free-text pipeline for apples-to-apples receipts) ──
  const latencyMs = Date.now() - startMs;
  const bmvScore = computeBmvScore(
    candidatesRaw, postMiner.length, postFurnace.length,
    postFurnace.length, concordance, specialistsUsed.length, latencyMs,
  );
  const gateOutcomes = evaluateGates(postFurnace.length, bmvScore, concordance, latencyMs);
  const anyGateFailed = gateOutcomes.some((g) => !g.passed);

  // ── Andon retry (Condition C only). Condition A/B pass andonEnabled=false and take
  //    whatever this single pass produced, win, lose, or abstain -- per Task 2.2's Truth-
  //    Always requirement, a loss here must be returned honestly, not silently retried away
  //    under conditions the Founder asked to measure as single-pass. ─────────────────────
  if (anyGateFailed && andonEnabled && andonRetry < MAX_ANDON_RETRIES) {
    const report = runDetectiveTeam(gateOutcomes, candidatesRaw, postMiner.length, postFurnace.length, effectiveOperators);
    onProgress?.(`andon-trigger:${andonRetry + 1}`);
    if (report.wideningApplied && report.additionalOperators.length > 0) {
      return runCanonicalPlowMcAnswer(
        mcPromptWithSubstrate, researchQuery, config, writeEbletFn, onProgress,
        andonRetry + 1, report.additionalOperators,
      );
    }
    onProgress?.('andon-exhausted');
  }

  // ── Scribe — write surviving facts to substrate (knowledge growth side-effect; this is
  //    externally-researched FACT content, never the MC answer/letter itself, so it carries
  //    none of Task 1's answer-key-cache risk regardless of substrate on/off for this run) ──
  const { ebletsWritten } = await runScribe(
    domain, researchQuery, questionId, postFurnace, bmvScore, concordance, gateOutcomes,
    andonRetry > 0, andonRetry, writeEbletFn,
  );

  const traceSummary =
    `specialists=[${specialistsUsed.join(',')}] raw=${candidatesRaw} postMiner=${postMiner.length} ` +
    `postFurnace=${postFurnace.length} voters=[${voterLetters.map((l) => l ?? '-').join(',')}] ` +
    `concordance=${concordance} bmv=${bmvScore} andonRetries=${andonRetry}`;

  return {
    questionId,
    domain,
    chosenLetter,
    voterLetters,
    concordance,
    bmvScore,
    gateOutcomes,
    specialistsUsed,
    candidatesRaw,
    candidatesPostMiner: postMiner.length,
    candidatesPostFurnace: postFurnace.length,
    andonTriggered: andonRetry > 0,
    andonRetries: andonRetry,
    ebletsWritten,
    latencyMs: Date.now() - startMs,
    traceSummary,
  };
}
