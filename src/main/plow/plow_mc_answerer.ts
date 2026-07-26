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
  computeArgumentConfidence,
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
  /** BP134 Yoke #32 Phase C: field-sowing-only deep-harvest mode. Undefined/false leaves the
   *  postFurnace cap (6, below) and every adapter cap byte-identical to the live A/B/C button's
   *  measured behavior -- this flag must never be set by that path. Field-sowing (Phase D) is
   *  the only intended caller that ever passes deepHarvest:true. */
  deepHarvest?: boolean;
  /** Cap for the postFurnace slice when deepHarvest is true. Ignored when deepHarvest is falsy. */
  maxEbletsPerQuestion?: number;
  /** BP135 Yoke #34 Phase (0.9.6): OPT-IN, DEFAULT FALSE. Empirically proven this session --
   *  gemma4:12b answers engineering/51 WRONG ("J") under the bare-letter voter prompt (the
   *  entire num_predict budget is spent on the letter itself, no room to reason), but CORRECT
   *  ("Answer: C") when allowed to show its work with a larger token budget. When false/absent,
   *  every voter call is BYTE-IDENTICAL to pre-0.9.6 behavior: same prompt, same num_predict
   *  (256), same parseLetterLocal parsing, no `reasoning` field on voter_diagnostics. When true,
   *  see buildReasoningVoterPrompt()/parseLetterFromReasoning() below for the full opt-in path. */
  reasoningMode?: boolean;
  /** BP135 Yoke #34 (0.9.7) argument-ledger, OPT-IN/OPTIONAL. Ground-truth letter for LOCAL,
   *  POST-HOC verdict tagging ONLY -- never fed into any prompt or voter call, never seen by
   *  the model. The only current caller of this whole MC answerer is the mesh-test relay
   *  responder path (index.ts's startRelayRoutePoll), which already receives
   *  payload.correct_answer_letter unconditionally on every plow-enabled dispatch (both
   *  wan_dispatch.ts and run_mesh_together.mjs send it for their OWN local scoring, per those
   *  files' own doc comments that the responder never previously read it). Presence of this
   *  field is therefore synonymous with "this is a test/eval run", never a production Ask --
   *  undefined/null means verdict is always written as 'unverified' (production default). */
  testModeCorrectAnswerLetter?: string | null;
}

/** BP133 Yoke #27: per-voter diagnostic detail, always computed (cheap: just string lengths
 *  and a status tag) so the trace can always say WHY a voter came back null instead of just
 *  showing "null" -- Truth-Always per Yoke #27's explicit requirement. Raw response TEXT is
 *  only included when MNEMO_DEBUG_LOG_PROMPTS=1 (same debug flag as Task 1's outbound-prompt
 *  logging) to avoid ballooning every persisted receipt with full Ollama output by default. */
export interface VoterDiagnostic {
  temperature: number;
  status: 'empty_response' | 'parsed_ok' | 'parse_failed';
  responseChars: number;
  /** BP134: first ~200 chars of the raw model text, always populated (not gated behind the
   *  debug flag) so future plow traces show WHAT a voter returned instead of just its status
   *  -- this is what let us tell "empty because thinking ate the budget" apart from "empty
   *  because the model was unreachable" apart from "non-empty but unparseable". */
  rawPreview: string;
  rawResponse?: string; // full text, present only when MNEMO_DEBUG_LOG_PROMPTS=1
  /** BP135 Yoke #34 Phase (0.9.6): the voter's FULL working (step-by-step derivation + final
   *  "Answer: X" line), present ONLY when config.reasoningMode is true -- absent (not empty
   *  string) in the default bare-letter path so old receipts and this new field never collide.
   *  Not gated behind MNEMO_DEBUG_LOG_PROMPTS like rawResponse -- reasoning mode is itself an
   *  explicit opt-in, so its own diagnostic payload is always captured when it runs, per the
   *  Yoke's "capture the FULL working string" requirement (this is what lets the mesh/arbiter
   *  and receipts compare reasoning across nodes later). */
  reasoning?: string;
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
  /** BP133 Yoke #27: makes a null voterLetter diagnosable -- was Ollama's response empty (OOM/
   *  concurrency hypothesis) or non-empty-but-unparseable (format-instruction/prompt-length
   *  hypothesis)? See runCanonicalPlowMcAnswer's voter loop. */
  voterDiagnostics: VoterDiagnostic[];
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
// BP135 Yoke #34 Phase (0.9.6): num_predict for a voter call. 256 is the pre-0.9.6 value, used
// on EVERY call unless reasoningMode is true -- discipline requirement: "do NOT add num_predict
// to the non-reasoning path" is satisfied by this being the same literal 256 already hardcoded
// in canonical_pipeline.ts's callOllama default, just named here for the reasoning branch below.
const MC_VOTER_NUM_PREDICT_DEFAULT = 256;
const MC_VOTER_NUM_PREDICT_REASONING = 1024;

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

/** BP135 Yoke #34 Phase (0.9.6): reasoning-mode voter prompt. Deliberately does NOT rebuild the
 *  question/options from scratch (mcPromptWithSubstrate/arbitrationPrompt stay opaque to this
 *  module, per the file's existing substrate-injection-site convention) -- instead it APPENDS an
 *  explicit override after the existing bare-letter-instructed prompt, since models reliably
 *  weight the most recent instruction highest. The override tells the voter to ignore the
 *  earlier "single letter only" instruction, show its work, and end with a fixed "Answer: X"
 *  sentinel line that parseLetterFromReasoning() below can find deterministically even inside a
 *  multi-paragraph derivation. `think` stays false (unchanged in canonical_pipeline.ts's
 *  callOllama) -- this is a bigger VISIBLE completion budget, not internal chain-of-thought. */
function buildReasoningVoterPrompt(basePrompt: string, choiceCount: number): string {
  const lastLetter = letterFromIndexLocal(choiceCount - 1);
  return `${basePrompt}

---
OVERRIDE: ignore the "reply with ONLY the single letter" instruction above. Instead, work through this question step by step, showing your calculation or reasoning explicitly. When you have determined the answer, end your response with one final line, and ONLY that line, written in exactly this format: "Answer: X" (X = the correct option letter, A through ${lastLetter}).`;
}

/** BP135 Yoke #34 Phase (0.9.6): parses the LAST "Answer: X" occurrence in a full reasoning
 *  derivation (a model may say "the answer choices are A, B, C..." mid-derivation before its
 *  real final answer -- the first match would be wrong; the sentinel line requested by
 *  buildReasoningVoterPrompt() is always the LAST one that matters). Falls back to the LAST
 *  bare A-J token anywhere in the text if no "Answer: X" line parses, per the Yoke's explicit
 *  fallback requirement. Never used on the default (non-reasoning) path, which keeps using
 *  parseLetterLocal()'s first-match convention unchanged. */
function parseLetterFromReasoning(text: string, choiceCount: number): string | null {
  const validLetters = Array.from({ length: choiceCount }, (_, i) => letterFromIndexLocal(i));
  const trimmed = text.trim();

  const answerLineRegex = /(?:answer|correct answer)\s*(?:is|:)?\s*\(?([A-J])\)?/gi;
  let match: RegExpExecArray | null;
  let lastAnswerLetter: string | null = null;
  while ((match = answerLineRegex.exec(trimmed)) !== null) {
    const candidate = match[1]!.toUpperCase();
    if (validLetters.includes(candidate)) lastAnswerLetter = candidate;
  }
  if (lastAnswerLetter) return lastAnswerLetter;

  const bareRegex = /\b([A-J])\b/g;
  let lastBare: string | null = null;
  while ((match = bareRegex.exec(trimmed)) !== null) {
    const candidate = match[1]!.toUpperCase();
    if (validLetters.includes(candidate)) lastBare = candidate;
  }
  return lastBare;
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
  const { domain, ollamaBaseUrl, model, choiceCount, andonEnabled, specialistKeys = {}, deepHarvest, maxEbletsPerQuestion, reasoningMode = false, testModeCorrectAnswerLetter = null } = config;
  const questionId = generateQuestionId(researchQuery, domain);

  // BP134 Yoke #32 Phase C: deepHarvest is opt-in per call (field-sowing only, see config
  // JSDoc). When false/undefined, effectiveSpecialistKeys is byte-identical to the caller's
  // specialistKeys object -- no new field is even present -- so the live A/B/C button's
  // adapter behavior is provably unchanged.
  const effectiveSpecialistKeys: SpecialistKeys = deepHarvest
    ? { ...specialistKeys, maxResultsPerAdapter: specialistKeys.maxResultsPerAdapter ?? maxEbletsPerQuestion ?? 8 }
    : specialistKeys;

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
      const candidates = await fn(researchQuery, domain, effectiveSpecialistKeys);
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
  // BP134 Yoke #32 Phase C: postFurnaceCap defaults to the live button's unchanged 6. Only
  // field-sowing's deepHarvest:true raises it (to maxEbletsPerQuestion, default 20 if unset).
  const postFurnaceCap = deepHarvest ? (maxEbletsPerQuestion ?? 20) : 6;
  const { passed: saladinPassed } = await runSaladin(postMiner, ollamaBaseUrl, model);
  const postFurnace = saladinPassed.sort((a, b) => b.weight - a.weight).slice(0, postFurnaceCap);
  onProgress?.('furnace-done');

  // ── MC Three Fates — 3-voter LETTER arbitration (the one stage that cannot be reused
  //    unchanged from the free-text pipeline; everything upstream/downstream of this is
  //    identical machinery to canonical_pipeline.ts) ─────────────────────────
  // BP133 Yoke #27 Task 27.1 secondary mitigation: hard-trimmed from 5 sources x 400 chars to
  // 3 x 300. A long facts block prepended before the question can push gemma4:12b to ignore
  // the trailing "reply with ONLY the single letter" instruction, and every char here adds to
  // per-question latency (Task 27.2). Not the confirmed root cause (that was the concurrency
  // bug above), but a real secondary risk called out in the Yoke, cheap to fix at the same time.
  const factsForArbitration = postFurnace.length > 0 ? postFurnace : postMiner.slice(0, 3);
  const factsContext = factsForArbitration
    .slice(0, 3)
    .map((c, i) => `[Source ${i + 1} -- ${c.source}]: ${c.content.slice(0, 300)}`)
    .join('\n\n');
  const arbitrationPrompt = buildMcArbitrationPrompt(factsContext, mcPromptWithSubstrate);
  const debugPromptLoggingEnabled = process.env.MNEMO_DEBUG_LOG_PROMPTS === '1';

  // BP133 Yoke #27 Task 27.1: SEQUENTIAL, not Promise.all. Root cause confirmed by Bishop's
  // read of the first live A/C/B run's plow_trace: 3 CONCURRENT gemma4:12b generations on a
  // single 6GB-VRAM GPU produced voter_letters:[null,null,null] on every question (specialists
  // upstream already stagger sequentially via FIREGUARD_STAGGER_MS; this was the one stage that
  // did not). One gemma4:12b call at a time is exactly what the single-shot WAN path already
  // proves works on this hardware -- so the 3 voters now run one after another, same as that
  // proven path, just 3 times at different temperatures.
  // BP135 Yoke #34 Phase (0.9.6): opt-in reasoning-mode voter prompt/budget/parse. When
  // reasoningMode is false (the default for every caller that predates this Yoke), voterPrompt
  // === arbitrationPrompt, numPredictForVoter === 256, and letter parsing uses the original
  // parseLetterLocal() -- byte-identical to pre-0.9.6 behavior, per the Yoke's explicit
  // requirement that the default path must be unchanged.
  const voterPrompt = reasoningMode ? buildReasoningVoterPrompt(arbitrationPrompt, choiceCount) : arbitrationPrompt;
  const numPredictForVoter = reasoningMode ? MC_VOTER_NUM_PREDICT_REASONING : MC_VOTER_NUM_PREDICT_DEFAULT;

  const voterLetters: (string | null)[] = [];
  const voterDiagnostics: VoterDiagnostic[] = [];
  for (const temp of MC_VOTER_TEMPERATURES) {
    const raw = await callOllama(voterPrompt, ollamaBaseUrl, model, temp, numPredictForVoter);
    if (raw === null || raw.trim().length === 0) {
      voterLetters.push(null);
      voterDiagnostics.push({
        temperature: temp,
        status: 'empty_response',
        responseChars: raw?.length ?? 0,
        rawPreview: raw ?? '',
        ...(debugPromptLoggingEnabled ? { rawResponse: raw ?? '' } : {}),
        ...(reasoningMode ? { reasoning: raw ?? '' } : {}),
      });
      continue;
    }
    const letter = reasoningMode ? parseLetterFromReasoning(raw, choiceCount) : parseLetterLocal(raw, choiceCount);
    voterLetters.push(letter);
    voterDiagnostics.push({
      temperature: temp,
      status: letter !== null ? 'parsed_ok' : 'parse_failed',
      responseChars: raw.length,
      rawPreview: raw.slice(0, 200),
      ...(debugPromptLoggingEnabled ? { rawResponse: raw } : {}),
      ...(reasoningMode ? { reasoning: raw } : {}),
    });
  }
  const { concordance, chosenLetter } = computeLetterConcordance(voterLetters);
  onProgress?.('three-fates-mc-done');
  if (debugPromptLoggingEnabled) {
    console.log(
      `[plow_mc_answerer] arbitration prompt (${arbitrationPrompt.length} chars): ${arbitrationPrompt}`,
    );
  }

  // ── Gates + BMV (same formula as the free-text pipeline for apples-to-apples receipts) ──
  const latencyMs = Date.now() - startMs;
  const bmvScore = computeBmvScore(
    candidatesRaw, postMiner.length, postFurnace.length,
    postFurnace.length, concordance, specialistsUsed.length, latencyMs,
  );
  const gateOutcomes = evaluateGates(postFurnace.length, bmvScore, concordance, latencyMs);
  // BP133 Yoke #27 Task 27.2: G4_LAT is recorded (still visible in gateOutcomes/the receipt,
  // still contributes to the free-text pipeline's shared evaluateGates() output verbatim) but
  // is advisory-only HERE -- it never by itself triggers an Andon retry. The plow legitimately
  // takes ~150-220s per question; retrying widened-operators solely because a question was
  // slow would only make it slower with zero accuracy benefit, and a correct-but-slow answer
  // must not be treated as a failure to fix. Note: G4_LAT was never the actual cause of
  // abstention (chosenLetter comes only from voter concordance, not from gates) -- this change
  // only stops it from wastefully triggering Andon widening on an otherwise-healthy pass.
  const anyGateFailedExcludingLatency = gateOutcomes.some((g) => g.gate !== 'G4_LAT' && !g.passed);

  // ── Andon retry (Condition C only). Condition A/B pass andonEnabled=false and take
  //    whatever this single pass produced, win, lose, or abstain -- per Task 2.2's Truth-
  //    Always requirement, a loss here must be returned honestly, not silently retried away
  //    under conditions the Founder asked to measure as single-pass. ─────────────────────
  if (anyGateFailedExcludingLatency && andonEnabled && andonRetry < MAX_ANDON_RETRIES) {
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
  // BP135 Yoke #34 (0.9.7) argument-ledger: reasoning is the FULL voter working captured by
  // 0.9.6 reasoning-mode (joined across voters when more than one produced text), NEVER a bare
  // answer-key letter -- this is the METHOD/derivation, per the Yoke's explicit requirement.
  // verdict compares the plow's OWN chosenLetter (already finalized above, by voters that never
  // saw testModeCorrectAnswerLetter) against that local ground truth ONLY when one was supplied
  // -- production Asks (no ground truth) always write 'unverified'.
  const reasoningForLedger = reasoningMode
    ? voterDiagnostics.map((v) => v.reasoning).filter((r): r is string => !!r).join('\n---\n') || undefined
    : undefined;
  const verdictForLedger: 'correct' | 'wrong' | 'unverified' =
    testModeCorrectAnswerLetter && chosenLetter
      ? (chosenLetter.toUpperCase() === testModeCorrectAnswerLetter.toUpperCase() ? 'correct' : 'wrong')
      : 'unverified';
  const { ebletsWritten } = await runScribe(
    domain, researchQuery, questionId, postFurnace, bmvScore, concordance, gateOutcomes,
    andonRetry > 0, andonRetry, writeEbletFn,
    {
      reasoning: reasoningForLedger,
      verdict: verdictForLedger,
      confidence: computeArgumentConfidence(bmvScore, concordance),
    },
  );

  const traceSummary =
    `specialists=[${specialistsUsed.join(',')}] raw=${candidatesRaw} postMiner=${postMiner.length} ` +
    `postFurnace=${postFurnace.length} voters=[${voterLetters.map((l) => l ?? '-').join(',')}] ` +
    `voterStatus=[${voterDiagnostics.map((v) => v.status).join(',')}] ` +
    `concordance=${concordance} bmv=${bmvScore} andonRetries=${andonRetry} latencyGateAdvisoryOnly=true`;

  return {
    questionId,
    domain,
    chosenLetter,
    voterLetters,
    voterDiagnostics,
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
