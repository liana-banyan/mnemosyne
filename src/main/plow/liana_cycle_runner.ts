// liana_cycle_runner.ts -- KN-BP142-3 Phase 1: Layer A, the autonomous half of the Liana Cycle
// Engine (canon: canon_liana_cycle_engine_continuous_self_improving_substrate_bp139.eblet.md).
//
// Canon's own five-line LAYER A definition (verbatim from the eblet):
//   - Continuous runner over held-out known-answer banks.
//   - Coroner autopsy + TYPE classification of every miss.
//   - Method bank plus eblet consultation: a verified method (deterministic compute or genuine
//     multi-source concordance) is written once as a method-eblet AND consulted next time, so
//     the Substrate stops re-deriving and permanently grows smarter (the times-tables reuse half).
//   - Ledger honesty: only a genuinely-verified answer flips verdict to verified and mints a
//     mark to the contributing peer, so the Substrate's growing "smartness" is always real,
//     never cosmetic.
//
// WHAT THIS FILE ADDS (does not duplicate): the Answer Coroner (answer_coroner.ts) already
// implements real autopsy + TYPE-adjacent classification (WrongClass/RightClass/AbstainClass);
// formula_eblet_mint.ts already MINTS the method-bank write half (deterministic_compute:formula:*
// component eblets). What did NOT exist before this file is the CONSULT half named explicitly in
// the ticket: before a question is answered, check the method bank for an existing verified
// method-eblet relevant to it, and if found, thread that method into the real answering call
// (real content in the real prompt) instead of the pipeline having to conceptually re-derive it
// from nothing -- plus the outer orchestration loop (runLianaCycleTurn) that ties consult ->
// real-answer -> Coroner-autopsy -> TYPE-classify-the-miss -> ledger-honest-mark-mint together
// into one auditable turn over a held-out known-answer bank.
//
// SCOPE-HONESTY NOTE (stated here so it cannot be missed): this module's consultMethodBank()
// operates one level ABOVE plow_mc_answerer.ts's own internal deterministic-solver-tier dispatch
// (resolveDeterministicComputeOverride's six tiers, e.g. solveDensityProblem). It does not modify,
// gate, or replace that internal dispatch (out of this ticket's scope, and would risk Layer B
// "new solver tier" territory this ticket is explicitly bounded away from touching un-drafted).
// What it DOES do, genuinely: reads the real method-bank eblets already seeded in the store
// (deterministic_compute:formula:*, authority_extracted_compute:formula:*, and the clean
// plow_mc_answerer:compute_method:* rows -- the three prefixes Bishop's ticket names as "seed
// data"), matches them against the held-out question's own text by token overlap, and when a
// real match clears the threshold, prepends that method's general (never question-specific)
// answer/reasoning text to the prompt handed to the REAL runCanonicalPlowMcAnswer call -- an
// honest "look it up and use it" consult, verified end to end in
// scratchpad/verify_kn_bp142_3_phase1_cycle_turn.js against the live store and the real compiled
// dist. See that script's own header for exactly what ran, and this ticket's return document for
// the honest limitation this note describes.
//
// Rule 66: this file writes nothing to verified_eblets.jsonl directly. The one write path it
// owns (mintLedgerMark) appends to a SEPARATE, dedicated ledger file (liana_cycle_marks.jsonl),
// never to the eblet store, and never deletes/overwrites -- append-only, same discipline.

import type { VerifiedEbletEntry } from '../mnem_eblet_store';
import type { CoronerRecord, LocalCoronerOutcomeInput } from './answer_coroner';
import { classifyLocalOutcome } from './answer_coroner';
// KN-BP142-10: the Rooting Rule (canon BP142) made structural. The SAME shared tier
// classification/ROOTED predicate that gates mnem_eblet_store.ts's computeHonestVerification()
// (the verified:true write gate) also gates mintLedgerMark() below (the Mark-mint write gate),
// so neither write path can drift from the other. See rooting_rule.ts's own header for the
// full canon citation.
import type { RootingTier } from '../rooting_rule';
import { isRooted, rootedTraceLabel, TIER_PROVEN, TIER_GROUND_TRUTH_CHECKED } from '../rooting_rule';

// ─── Method bank consultation (the CONSULT half named explicitly by the ticket) ────────────────

/** The three provenance prefixes Bishop's ticket names as the existing, already-healthy method-
 *  bank seed data. Deliberately the same three prefixes mnem_eblet_store.ts's own
 *  isContaminatedComputeMethodEblet / formula_eblet_mint.ts already reason about -- this module
 *  adds no fourth prefix of its own. */
const METHOD_BANK_PROVENANCE_PREFIXES = [
  'deterministic_compute:formula:',
  'authority_extracted_compute:formula:',
  'plow_mc_answerer:compute_method:',
] as const;

/** Minimal shape this module reads off a stored eblet -- structurally compatible with
 *  VerifiedEbletEntry; callers pass real entries directly. */
export type MethodBankEblet = Pick<
  VerifiedEbletEntry,
  'question' | 'answer' | 'reasoning' | 'provenance' | 'class' | 'verified'
>;

export interface MethodBankConsultResult {
  hit: boolean;
  /** The method tag parsed off the matched record's provenance (e.g. "density"), null on a miss. */
  methodTag: string | null;
  matchedQuestion: string | null;
  matchedAnswer: string | null;
  matchedProvenance: string | null;
  /** Token-overlap score (0-1) that won the match, 0 on a miss. */
  score: number;
  /** Plain-English reason, always populated, honest on both HIT and MISS (e.g. "no method-bank
   *  record scored above threshold 0.15" on a genuine miss -- never fabricated). */
  reason: string;
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'has', 'are', 'was', 'were',
  'what', 'which', 'how', 'when', 'does', 'you', 'its', 'their', 'his', 'her', 'a', 'an', 'of',
  'in', 'on', 'at', 'to', 'is', 'it', 'or', 'be', 'as', 'by',
]);

/** Same tokenizer shape as mnem_eblet_store.ts's computeQaRelevance (lowercased, alnum runs,
 *  length>2), plus a small stopword filter on top since method-bank consult matching benefits
 *  from ignoring generic connective words that would otherwise inflate overlap on unrelated
 *  questions. Duplicated rather than imported: computeQaRelevance/its tokenizer are not exported
 *  from mnem_eblet_store.ts, and this module's matching purpose (method relevance) is distinct
 *  enough from that module's Q/A-relevance-gate purpose to warrant its own small, visible copy. */
function tokenize(text: string): string[] {
  const raw = (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter((t) => t.length > 2);
  return raw.filter((t) => !STOPWORDS.has(t));
}

/** Default token-overlap acceptance threshold. Deliberately conservative (never guess a method
 *  match) -- see this module's own verification script for the measured score on a real HIT
 *  (density question vs the real "deterministic_compute:formula:density" eblet) and a real MISS
 *  (a conceptual/authority-type question with no matching method in the store at all). */
export const METHOD_BANK_CONSULT_THRESHOLD = 0.15;

/** Parses the method tag off a method-bank provenance string, honest-null on anything that does
 *  not match one of the three known prefixes (never guessed). */
function parseMethodTag(provenance: string): string | null {
  for (const prefix of METHOD_BANK_PROVENANCE_PREFIXES) {
    if (provenance.startsWith(prefix)) {
      // plow_mc_answerer:compute_method:<method>:<timestamp> carries a trailing :<timestamp>
      // segment the other two prefixes do not -- strip it if present so all three prefixes yield
      // the bare method tag consistently.
      const rest = provenance.slice(prefix.length);
      const firstSegment = rest.split(':')[0];
      return firstSegment || null;
    }
  }
  return null;
}

/**
 * The CONSULT half: given a held-out question's own topic text (domain + question, the caller's
 * choice), searches the caller-supplied method-bank eblets (already loaded from the real store by
 * the caller, e.g. via loadAllVerifiedEblets() inside Electron -- this function stays pure/
 * dependency-free so it is unit-testable standalone against a real JSONL dump with no Electron
 * runtime required, same discipline as this file's own verification script) for the best-scoring
 * genuine method-bank record, and reports a HIT only when that best score clears
 * METHOD_BANK_CONSULT_THRESHOLD.
 *
 * Ledger-honesty-adjacent safety: only considers entries with `verified === true` and
 * `class === 'component'` (the class formula_eblet_mint.ts and the compute_method writer both
 * always set) -- an unverified or wrong-shaped record can never be consulted as if it were a
 * trusted method. Never throws; a caller-supplied empty/malformed array simply yields an honest
 * miss.
 */
export function consultMethodBank(
  topicText: string,
  methodBankEblets: MethodBankEblet[],
): MethodBankConsultResult {
  const topicTokens = new Set(tokenize(topicText));
  if (topicTokens.size === 0) {
    return {
      hit: false, methodTag: null, matchedQuestion: null, matchedAnswer: null,
      matchedProvenance: null, score: 0, reason: 'topic text yielded no tokens to match against',
    };
  }

  let best: { entry: MethodBankEblet; methodTag: string; score: number } | null = null;

  for (const entry of methodBankEblets) {
    if (entry.verified !== true || entry.class !== 'component') continue;
    const provenance = entry.provenance ?? '';
    const methodTag = parseMethodTag(provenance);
    if (!methodTag) continue; // not a method-bank-shaped record at all -- ignored, never guessed

    const candidateTokens = tokenize(entry.question ?? '');
    if (candidateTokens.length === 0) continue;
    const overlap = candidateTokens.filter((t) => topicTokens.has(t)).length;
    const score = overlap / candidateTokens.length;

    if (score > 0 && (!best || score > best.score)) {
      best = { entry, methodTag, score };
    }
  }

  if (!best || best.score < METHOD_BANK_CONSULT_THRESHOLD) {
    return {
      hit: false,
      methodTag: null,
      matchedQuestion: null,
      matchedAnswer: null,
      matchedProvenance: null,
      score: best?.score ?? 0,
      reason: best
        ? `best candidate ("${best.methodTag}") scored ${best.score.toFixed(3)}, below threshold ${METHOD_BANK_CONSULT_THRESHOLD}`
        : 'no method-bank record shared any token with the topic text',
    };
  }

  return {
    hit: true,
    methodTag: best.methodTag,
    matchedQuestion: best.entry.question,
    matchedAnswer: best.entry.answer,
    matchedProvenance: best.entry.provenance,
    score: best.score,
    reason: `matched method "${best.methodTag}" at score ${best.score.toFixed(3)} (threshold ${METHOD_BANK_CONSULT_THRESHOLD})`,
  };
}

/** Builds the augmented prompt text handed to the real answerer on a consult HIT -- the general
 *  method restated as a hint, never the held-out question's own correct letter (structurally
 *  cannot leak one: consultMethodBank only ever returns matchedAnswer from a class:'component'
 *  method-bank record, which per formula_eblet_mint.ts's own governing distinction is a general,
 *  question-independent formula/technique statement, never an answer key). On a MISS, returns the
 *  base prompt byte-for-byte unchanged -- the negative-control path must look identical to a
 *  method-bank-free run. */
export function buildConsultAugmentedPrompt(basePrompt: string, consult: MethodBankConsultResult): string {
  if (!consult.hit || !consult.matchedAnswer) return basePrompt;
  return (
    `${basePrompt}\n\n` +
    `[Liana Cycle method bank consult HIT, method="${consult.methodTag}": ${consult.matchedAnswer}]`
  );
}

// ─── TYPE classification of misses (canon's "Bomb-Squad fill-gap-by-TYPE discipline") ──────────

export type MissType = 'compute-decompose-type' | 'conceptual-authority-type' | 'abstain-or-other-type';

const COMPUTE_DECOMPOSE_MISS_CLASSES = new Set(['compute-wrong', 'bad-decomposition']);
const CONCEPTUAL_AUTHORITY_MISS_CLASSES = new Set([
  'authority-empty', 'coverage-gap', 'ungrounded-adjudication', 'plow-discordant',
  'substrate-gap', 'single-shot-wrong', 'minor-council-wrong',
]);

/**
 * Canon's TYPE split for a miss: compute/physics-decompose-type (a named deterministic solver ran
 * and got it wrong, or the decompose strategy misfired) versus conceptual/authority-type (an
 * authority/voter/substrate mechanism ran and got it wrong). Built ONLY on top of the Answer
 * Coroner's own existing, real CoronerRecord fields (answerClass / deterministicSolverName) --
 * duplicates none of classifyCore's classification logic, just re-groups its already-computed
 * output into canon's two named TYPE buckets (plus an honest third catch-all for anything that is
 * a miss but does not cleanly fall in either, e.g. contested-key or an unmapped future class).
 * Callers MUST only invoke this on a record whose outcome is 'wrong' or 'abstain' (a genuine
 * miss) -- calling it on outcome 'right'/'no-response' is a caller error, not something this pure
 * function silently papers over; see runLianaCycleTurn's own call site for the guard.
 */
export function classifyMissType(record: CoronerRecord): MissType {
  if (record.deterministicSolverName || COMPUTE_DECOMPOSE_MISS_CLASSES.has(record.answerClass)) {
    return 'compute-decompose-type';
  }
  if (CONCEPTUAL_AUTHORITY_MISS_CLASSES.has(record.answerClass)) {
    return 'conceptual-authority-type';
  }
  // Honest catch-all: honest-abstain / over-conservative-abstain / contested-key / no-response /
  // single-shot-wrong / minor-council-wrong (no plow ran at all, so neither TYPE bucket applies)
  // / any future unmapped answerClass. Never forced into one of the two named buckets it does not
  // actually belong to.
  return 'abstain-or-other-type';
}

// ─── Ledger honesty: mint a mark ONLY on a ROOTED (Tier 1/Tier 2) result ────────────────────────
// KN-BP142-10: this section is the second of the two real write paths the Rooting Rule (canon
// BP142) binds. See rooting_rule.ts's header for the full canon citation and the KN-BP142-6
// production finding that motivated making the rule structural instead of merely observed.

/**
 * Classifies a CoronerRecord (this runner's own real ground-truth comparison against the
 * held-out bank's known correctLetter -- never a re-derivation, just a re-grouping of fields
 * classifyLocalOutcome/classifyCore already computed) onto a Rooting Rule tier.
 *
 * A miss (outcome !== 'right', i.e. 'wrong'/'abstain'/'no-response') is NEVER classified into a
 * tier at all (returns null, not Tier 3) -- a wrong or abstained answer was not concordant-ONLY
 * accepted here either, it was simply checked against the answer key and failed; canon's Tier 3
 * describes a DIFFERENT mechanism (independent sources/models agreeing with each other, with no
 * ground truth available to check against at all), which does not arise inside this runner's own
 * loop because this runner always has a known answer key (canon: "The autonomous loop
 * self-scores on KNOWN-answer banks only, which is Tier 2, and never self-declares a benchmark").
 * A correct answer (outcome === 'right') is:
 *   TIER 1 proven               when a named deterministic solver computed it
 *                                (record.deterministicSolverName is set) -- the solver's own
 *                                proof plus the bank's own known-correct check both agree.
 *   TIER 2 ground-truth-checked otherwise -- the bank's own known answer key is exactly what
 *                                ground-truth-checked means (canon Tier 2's own definition).
 */
export function classifyCoronerRecordTier(record: CoronerRecord): RootingTier | null {
  if (record.outcome !== 'right') return null;
  return record.deterministicSolverName ? TIER_PROVEN : TIER_GROUND_TRUTH_CHECKED;
}

export interface LedgerMarkRecord {
  peerId: string;
  questionId: number;
  domain: string;
  answerClass: string;
  answeredLetter: string | null;
  sealedLetter: string | null;
  mechanism: string;
  verifiedAt: number;
  /** KN-BP142-10 (Rooting Rule, canon BP142): REQUIRED, not optional. Every caller of
   *  mintLedgerMark, including one that does not exist yet, must declare which tier justifies
   *  this mint -- there is no default and no way to construct a valid LedgerMarkRecord without
   *  naming one. mintLedgerMark() itself then independently verifies isRooted(rootingTier)
   *  before writing anything; a caller cannot mint by simply passing an arbitrary tier string
   *  that happens to satisfy the type checker's structural check alone -- the runtime gate below
   *  is the actual enforcement, the type merely makes the omission impossible. */
  rootingTier: RootingTier;
}

/**
 * Canon: "only a genuinely-verified answer flips verdict to verified and mints a mark ... so the
 * Substrate's growing smartness is always real, never cosmetic," now read through the BP142
 * Rooting Rule's own vocabulary: "only a ROOTED eblet may mint a Mark to a peer." The ledger-
 * honesty gate lives in this one pure predicate: a mark is earned if and only if
 * classifyCoronerRecordTier(record) yields a tier, AND that tier is ROOTED (Tier 1 proven or
 * Tier 2 ground-truth-checked; never Tier 3 concordant, never null/unclassified). Every other
 * outcome ('wrong', 'abstain', 'no-response') -- including a consult HIT that still led to a
 * wrong answer -- earns nothing. This function cannot be bypassed by a consult HIT alone; a HIT
 * only changes what prompt the real answerer saw, never whether the mark-mint gate itself fires.
 * This predicate is advisory to callers (a convenience pre-check); mintLedgerMark() below is the
 * actual, non-bypassable enforcement, since it re-checks isRooted() itself on whatever
 * rootingTier the caller supplies, independent of whether this predicate was consulted first.
 */
export function shouldMintLedgerMark(record: CoronerRecord): boolean {
  return isRooted(classifyCoronerRecordTier(record));
}

/**
 * Appends one JSONL line to a dedicated ledger file, SEPARATE from verified_eblets.jsonl on
 * purpose: a mark credits a contributing PEER for a real contribution, it is not itself a fact/
 * answer eblet, and mixing the two concepts into one store would blur the retrieval-eligible
 * substrate with a rewards ledger it was never designed to hold.
 *
 * KN-BP142-10 (Rooting Rule, canon BP142) STRUCTURAL GATE: the FIRST thing this function does,
 * before touching Electron, the filesystem, or anything else, is check isRooted(mark.rootingTier)
 * and REFUSE (return false, log the refusal, write nothing) if it is not ROOTED. This is the
 * write path itself refusing, not a caller choosing well -- a caller cannot mint by passing the
 * "right" peerId/questionId/etc, because mintLedgerMark's own body still checks the tier
 * independent of whatever the caller believed or intended. A Tier 3 (concordant) or
 * null/unclassified rootingTier is refused here even if every other field is a perfectly
 * legitimate mark; there is no argument combination that bypasses this check, since it is the
 * very first statement in the function body, before the try block that does any I/O at all.
 *
 * Lazy `require('electron')` inside the try (the ROOTED branch only), same main-process-only
 * convention every other userData-path writer in this codebase already uses (see
 * mnem_eblet_store.ts / specialist_adapters.ts's readConcordanceStrictnessFromSettings) --
 * non-fatal by construction: any failure (no Electron app available, e.g. this module under test
 * in bare Node, or a disk error) is caught, logged, and returns false, never thrown, and never
 * blocks the caller's own turn loop. Rule 66: append-only, never rewrites or deletes an existing
 * mark.
 */
export async function mintLedgerMark(mark: LedgerMarkRecord): Promise<boolean> {
  if (!isRooted(mark.rootingTier)) {
    // KN-BP142-10 verification (c): the refusal, verbatim, at the exact write path where a Mark
    // is actually minted. Grep this file for "ROOTED" to find it. Never throws -- an honest,
    // logged no-op is the real mechanism, matching this function's existing non-fatal contract.
    console.warn(
      `[liana_cycle_runner] mintLedgerMark REFUSED: rootingTier="${mark.rootingTier}" is ` +
      `${rootedTraceLabel(mark.rootingTier)}, not ROOTED. Only Tier 1 (proven) or Tier 2 ` +
      `(ground-truth-checked) may mint a Mark; Tier 3 (concordant) never does, per canon ` +
      `canon_rooting_rule_only_proven_and_ground_truth_checked_root_an_eblet_bp142. Mark for ` +
      `qid=${mark.questionId} domain=${mark.domain} NOT written.`,
    );
    return false;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require('electron') as typeof import('electron');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { appendFileSync, mkdirSync } = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { join } = require('path') as typeof import('path');
    const dir = join(app.getPath('userData'), 'substrate');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'liana_cycle_marks.jsonl');
    appendFileSync(file, `${JSON.stringify(mark)}\n`, 'utf-8');
    console.log(
      `[liana_cycle_runner] mintLedgerMark: rootingTier="${mark.rootingTier}" is ` +
      `${rootedTraceLabel(mark.rootingTier)}, qid=${mark.questionId} mark WRITTEN to ${file}.`,
    );
    return true;
  } catch (err) {
    console.warn('[liana_cycle_runner] mintLedgerMark failed (non-fatal, mark not persisted):', err);
    return false;
  }
}

// ─── The continuous runner: one full Cycle turn over a held-out known-answer bank ───────────────

export interface HeldOutQuestion {
  id: number;
  domain: string;
  /** The bare question stem, WITHOUT lettered options -- this module appends the lettered
   *  options itself so the consult hint (when present) can be inserted between the question and
   *  the options, matching this module's own buildConsultAugmentedPrompt convention. */
  question: string;
  /** Option TEXT only, in order -- this module assigns letters A, B, C... itself. */
  options: string[];
  correctLetter: string;
}

export interface CycleTurnQuestionResult {
  id: number;
  domain: string;
  consult: MethodBankConsultResult;
  chosenLetter: string | null;
  coronerRecord: CoronerRecord;
  missType: MissType | null;
  markMinted: boolean;
}

export interface CycleTurnSummary {
  results: CycleTurnQuestionResult[];
  consultHits: number;
  consultMisses: number;
  marksMinted: number;
  rightTotal: number;
  wrongTotal: number;
  abstainTotal: number;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

/** Structural shape this module needs from the real runCanonicalPlowMcAnswer -- dependency-
 *  injected (opts.answerFn) rather than imported directly, so this module carries zero import-
 *  time dependency on plow_mc_answerer.ts (avoids any import-cycle risk, same reasoning
 *  formula_eblet_mint.ts's own header gives for its own dynamic-import choices) and so a caller
 *  (or this file's own verification script) can pass the REAL compiled function directly without
 *  this file needing to know its full, large parameter/return type. */
export type CanonicalPlowAnswerFn = (
  mcPrompt: string,
  researchQuery: string,
  config: Record<string, unknown>,
  writeEbletFn: (params: Record<string, unknown>) => Promise<void>,
  onProgress?: (stage: string) => void,
) => Promise<{ chosenLetter: string | null; [key: string]: unknown }>;

export interface RunLianaCycleTurnOpts {
  peerId?: string;
  onProgress?: (msg: string) => void;
  writeEbletFn?: (params: Record<string, unknown>) => Promise<void>;
}

/**
 * Runs ONE full Cycle turn (canon's numbered loop, steps 1-3 of the five-step doctrine: RUN,
 * CORONER, CLASSIFY -- steps 4/5, IMPROVE/RE-RUN, are the human-in-the-loop half the canon
 * explicitly reserves for Bishop/Founder, not this autonomous function) over a caller-supplied
 * held-out known-answer bank:
 *
 *   for each question:
 *     1. CONSULT the method bank (real store data, via consultMethodBank) BEFORE answering.
 *     2. Build the prompt (consult-augmented on a HIT, unchanged on a MISS) and call the REAL
 *        answerFn (runCanonicalPlowMcAnswer in production).
 *     3. AUTOPSY the result via the Answer Coroner's own classifyLocalOutcome (real classifier,
 *        not reimplemented here).
 *     4. CLASSIFY the miss by TYPE (classifyMissType) when the outcome was wrong or abstain.
 *     5. LEDGER HONESTY: mint a mark (mintLedgerMark) if and only if shouldMintLedgerMark(record)
 *        -- outcome==='right', real ground-truth comparison, never speculative.
 *
 * Never runs the Founder-reserved scored-20 benchmark itself -- the caller supplies whatever
 * held-out bank it wants; this function has no knowledge of and does not special-case any
 * specific benchmark's question set.
 */
export async function runLianaCycleTurn(
  questions: HeldOutQuestion[],
  config: Record<string, unknown>,
  methodBankEblets: MethodBankEblet[],
  answerFn: CanonicalPlowAnswerFn,
  opts: RunLianaCycleTurnOpts = {},
): Promise<CycleTurnSummary> {
  const peerId = opts.peerId ?? 'liana_cycle_runner';
  const log = (msg: string) => {
    console.log(`[liana_cycle_runner] ${msg}`);
    opts.onProgress?.(msg);
  };

  const results: CycleTurnQuestionResult[] = [];
  let consultHits = 0;
  let consultMisses = 0;
  let marksMinted = 0;

  for (const q of questions) {
    const topicText = `${q.domain} ${q.question}`;
    const consult = consultMethodBank(topicText, methodBankEblets);
    if (consult.hit) consultHits++; else consultMisses++;
    log(
      `qid=${q.id} domain=${q.domain} consult=${consult.hit ? 'HIT' : 'MISS'} ` +
      `(${consult.reason})`,
    );

    const optionLines = q.options.map((opt, i) => `${LETTERS[i]}) ${opt}`).join('\n');
    const basePrompt = `${q.question}\n${optionLines}`;
    const mcPrompt = buildConsultAugmentedPrompt(basePrompt, consult);

    const answer = await answerFn(
      mcPrompt,
      q.question,
      config,
      opts.writeEbletFn ?? (async () => {}),
      (stage) => log(`qid=${q.id} progress: ${stage}`),
    );
    const chosenLetter = answer.chosenLetter ?? null;
    const isCorrect = chosenLetter !== null && chosenLetter.toUpperCase().trim() === q.correctLetter.toUpperCase().trim();

    const outcomeInput: LocalCoronerOutcomeInput = {
      question_id: q.id,
      question: q.question,
      category: q.domain,
      correctLetter: q.correctLetter,
      parsedLetter: chosenLetter,
      isCorrect,
      isAbstain: chosenLetter === null,
      answeredBy: 'liana_cycle_runner',
      peerId,
      plowTrace: answer as unknown as Record<string, unknown>,
    };
    const record = classifyLocalOutcome(outcomeInput);

    const missType = record.outcome === 'wrong' || record.outcome === 'abstain'
      ? classifyMissType(record)
      : null;

    // KN-BP142-10: the tier is computed ONCE here from the real CoronerRecord and threaded
    // through to mintLedgerMark, which independently re-checks isRooted() on it -- this call
    // site cannot make mintLedgerMark trust a tier it does not itself verify.
    const rootingTier = classifyCoronerRecordTier(record);
    let markMinted = false;
    if (shouldMintLedgerMark(record)) {
      markMinted = await mintLedgerMark({
        peerId,
        questionId: q.id,
        domain: q.domain,
        answerClass: record.answerClass,
        answeredLetter: record.answeredLetter,
        sealedLetter: record.sealedLetter,
        mechanism: consult.hit ? `consult_hit:${consult.methodTag}` : 'derived',
        verifiedAt: Date.now(),
        // shouldMintLedgerMark(record) === true guarantees rootingTier is non-null and ROOTED
        // (see that function's own body); the `?? 'concordant'` fallback below is unreachable in
        // practice but keeps this call site type-correct without an `as RootingTier` cast, and
        // if it were EVER reached (a future refactor breaking that guarantee), it would name the
        // one tier mintLedgerMark's own gate is guaranteed to refuse, never silently mint.
        rootingTier: rootingTier ?? 'concordant',
      });
      if (markMinted) marksMinted++;
    }

    log(
      `qid=${q.id} outcome=${record.outcome} answerClass=${record.answerClass} ` +
      `missType=${missType ?? 'n/a'} markMinted=${markMinted}`,
    );

    results.push({ id: q.id, domain: q.domain, consult, chosenLetter, coronerRecord: record, missType, markMinted });
  }

  const rightTotal = results.filter((r) => r.coronerRecord.outcome === 'right').length;
  const wrongTotal = results.filter((r) => r.coronerRecord.outcome === 'wrong').length;
  const abstainTotal = results.filter((r) => r.coronerRecord.outcome === 'abstain').length;

  log(
    `TURN COMPLETE: ${results.length} question(s), right=${rightTotal} wrong=${wrongTotal} ` +
    `abstain=${abstainTotal}, consultHits=${consultHits} consultMisses=${consultMisses} ` +
    `marksMinted=${marksMinted}`,
  );

  return { results, consultHits, consultMisses, marksMinted, rightTotal, wrongTotal, abstainTotal };
}
