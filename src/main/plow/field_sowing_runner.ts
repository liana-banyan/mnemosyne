/**
 * field_sowing_runner.ts — BP134 Yoke #32 Phase D "field-sowing runner"
 *
 * Loops one MMLU-Pro domain/category over N passes through the sealed question bank,
 * reusing loadDomainBank(domain) + runAndonReplowLoop(question, domain) exactly as they exist
 * today (no new grading mechanism is introduced here). Accumulates a per-pass receipt richer
 * than anything currently persisted for this loop, and stores resumability state so a long
 * field-sowing run can be interrupted (app quit, cancel) and picked back up without re-plowing
 * already-verified questions.
 *
 * R-MECHANISM-VERIFY note (2026-07-26, Yoke #32 Phase D): runAndonReplowLoop() returns a
 * PlowResult, not a CanonicalPlowMcResult -- it has no bmvScore field. The BMV-scoring, 9-
 * specialist-swarm concept lives ONLY in the separate plow_mc_answerer.ts/canonical_pipeline.ts
 * pipeline, which this runner does not invoke (per the Yoke's explicit "reusing loadDomainBank +
 * runAndonReplowLoop" instruction). Each per-question receipt row below therefore reports
 * bmvScore: null rather than fabricating a number the real mechanism never computes -- an
 * honest field beats a cosmetic field match to a shape that was never actually reused.
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { loadDomainBank, type Domain } from './per_domain_q_banks';
import { runAndonReplowLoop, type PlowResult } from './andon_replow';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FieldSowingConfig {
  domain: Domain;
  /** Stop after this many full passes through the bank (undefined = time-budget only). */
  maxPasses?: number;
  /** Stop after this many wall-clock ms. Defaults to 30 minutes if maxPasses is also unset,
   *  so a caller that forgets both budgets still gets a bounded run, not an infinite loop. */
  timeBudgetMs?: number;
  /** Resume from the persisted progress file instead of starting the bank at index 0. */
  resume?: boolean;
}

export interface FieldSowingQuestionReceipt {
  passIndex: number;
  bankIndex: number;
  questionId: string;
  verdict: PlowResult['verdict'] | 'error';
  ebletsWritten: number; // 0 or 1 -- runAndonReplowLoop writes at most one eblet per question
  andonRetries: number;  // attempts - 1 (Andon Cord pulls actually taken by the real mechanism)
  concordance: 'CONCORDANT' | 'DISCORDANT'; // derived from verdict; the real mechanism has no PARTIAL state
  bmvScore: null; // see file header R-MECHANISM-VERIFY note -- never fabricated
  latencyMs: number;
  error?: string;
}

export interface FieldSowingPassSummary {
  passIndex: number;
  questionsProcessed: number;
  verifiedCount: number;
  quarantinedCount: number;
  ebletsWrittenThisPass: number;
  accuracyThisPass: number; // verifiedCount / questionsProcessed, 0 if none processed
  avgLatencyMsThisPass: number;
  elapsedMsThisPass: number;
}

export interface FieldSowingResult {
  domain: Domain;
  startedAt: number;
  completedAt: number;
  passesCompleted: number;
  passSummaries: FieldSowingPassSummary[];
  totalEbletsWritten: number;
  totalQuestionsProcessed: number;
  receiptPath: string;
  progressPath: string;
  stoppedReason: 'maxPasses' | 'timeBudget' | 'cancelled';
}

export type FieldSowingProgressEvent =
  | { type: 'pass-start'; domain: Domain; passIndex: number; bankSize: number }
  | { type: 'question-done'; domain: Domain; passIndex: number; bankIndex: number; receipt: FieldSowingQuestionReceipt }
  | { type: 'pass-done'; domain: Domain; summary: FieldSowingPassSummary }
  | { type: 'complete'; result: FieldSowingResult };

interface ProgressState {
  domain: Domain;
  lastBankIndex: number; // index of the last question processed in `passIndex`
  passIndex: number;
  updatedAt: number;
}

// ─── Persistence (userData, same convention as benchmark_runner.ts's receiptsDir) ────────────

function sowingDir(): string {
  const dir = path.join(app.getPath('userData'), 'field_sowing');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function receiptPathFor(domain: Domain): string {
  return path.join(sowingDir(), `${domain}.receipt.jsonl`);
}

function progressPathFor(domain: Domain): string {
  return path.join(sowingDir(), `${domain}.progress.json`);
}

function loadProgress(domain: Domain): ProgressState | null {
  try {
    const p = progressPathFor(domain);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as ProgressState;
  } catch {
    return null;
  }
}

function saveProgress(state: ProgressState): void {
  try {
    fs.writeFileSync(progressPathFor(state.domain), JSON.stringify(state), 'utf-8');
  } catch (err) {
    console.warn('[FieldSowing] progress save failed (non-fatal):', err);
  }
}

function appendReceipt(domain: Domain, row: FieldSowingQuestionReceipt): void {
  try {
    fs.appendFileSync(receiptPathFor(domain), JSON.stringify(row) + '\n', 'utf-8');
  } catch (err) {
    console.warn('[FieldSowing] receipt append failed (non-fatal):', err);
  }
}

export function getFieldSowingReceiptPath(domain: Domain): string {
  return receiptPathFor(domain);
}

export function getFieldSowingProgress(domain: Domain): ProgressState | null {
  return loadProgress(domain);
}

// ─── Main runner ──────────────────────────────────────────────────────────────

const DEFAULT_TIME_BUDGET_MS = 30 * 60 * 1000; // 30 minutes, only applies if maxPasses is also unset

export async function runFieldSowing(
  config: FieldSowingConfig,
  onProgress?: (event: FieldSowingProgressEvent) => void,
  cancelToken: { cancelled: boolean } = { cancelled: false },
): Promise<FieldSowingResult> {
  const startedAt = Date.now();
  const { domain } = config;
  const timeBudgetMs = config.timeBudgetMs ?? (config.maxPasses ? Number.POSITIVE_INFINITY : DEFAULT_TIME_BUDGET_MS);
  const maxPasses = config.maxPasses ?? Number.POSITIVE_INFINITY;

  // Phase B (this Yoke) fixed the sealed-bank data root -- loadDomainBank now genuinely
  // resolves for every domain. Let a load failure propagate rather than silently returning an
  // empty result; the caller should see the real error, not a false "0 questions sown" receipt.
  const bank = loadDomainBank(domain);
  const bankSize = bank.length;

  const resumed = config.resume ? loadProgress(domain) : null;
  let passIndex = resumed?.passIndex ?? 0;
  let startBankIndex = 0;
  if (resumed) {
    if (resumed.lastBankIndex + 1 < bankSize) {
      startBankIndex = resumed.lastBankIndex + 1; // resume mid-pass
    } else {
      passIndex = resumed.passIndex + 1; // prior run finished this pass exactly at the boundary
    }
  }

  const passSummaries: FieldSowingPassSummary[] = [];
  let totalEbletsWritten = 0;
  let totalQuestionsProcessed = 0;
  let stoppedReason: FieldSowingResult['stoppedReason'] = 'maxPasses';

  outer: while (passIndex < maxPasses) {
    if (Date.now() - startedAt >= timeBudgetMs) { stoppedReason = 'timeBudget'; break; }
    if (cancelToken.cancelled) { stoppedReason = 'cancelled'; break; }

    onProgress?.({ type: 'pass-start', domain, passIndex, bankSize });
    const passStartMs = Date.now();
    let verifiedCount = 0;
    let quarantinedCount = 0;
    let ebletsWrittenThisPass = 0;
    let latencySum = 0;
    let questionsThisPass = 0;

    for (let bi = startBankIndex; bi < bankSize; bi++) {
      if (Date.now() - startedAt >= timeBudgetMs) { stoppedReason = 'timeBudget'; break outer; }
      if (cancelToken.cancelled) { stoppedReason = 'cancelled'; break outer; }

      const entry = bank[bi];
      const qStartMs = Date.now();
      let receipt: FieldSowingQuestionReceipt;

      try {
        const result = await runAndonReplowLoop(entry.question, domain);
        const latencyMs = Date.now() - qStartMs;
        const ebletsWritten = result.ebletWritten ? 1 : 0;
        const andonRetries = Math.max(0, (result.attempts ?? 1) - 1);
        const concordance: FieldSowingQuestionReceipt['concordance'] =
          result.verdict === 'verified' ? 'CONCORDANT' : 'DISCORDANT';

        receipt = {
          passIndex, bankIndex: bi,
          questionId: `${domain}:${bi}`,
          verdict: result.verdict,
          ebletsWritten, andonRetries, concordance, bmvScore: null,
          latencyMs,
          ...(result.error ? { error: result.error } : {}),
        };

        if (result.verdict === 'verified') verifiedCount++;
        else quarantinedCount++;
        ebletsWrittenThisPass += ebletsWritten;
        totalEbletsWritten += ebletsWritten;
      } catch (err) {
        receipt = {
          passIndex, bankIndex: bi,
          questionId: `${domain}:${bi}`,
          verdict: 'error',
          ebletsWritten: 0, andonRetries: 0, concordance: 'DISCORDANT', bmvScore: null,
          latencyMs: Date.now() - qStartMs,
          error: String(err),
        };
        quarantinedCount++;
      }

      latencySum += receipt.latencyMs;
      questionsThisPass++;
      totalQuestionsProcessed++;
      appendReceipt(domain, receipt);
      saveProgress({ domain, lastBankIndex: bi, passIndex, updatedAt: Date.now() });
      onProgress?.({ type: 'question-done', domain, passIndex, bankIndex: bi, receipt });
    }

    const summary: FieldSowingPassSummary = {
      passIndex,
      questionsProcessed: questionsThisPass,
      verifiedCount,
      quarantinedCount,
      ebletsWrittenThisPass,
      accuracyThisPass: questionsThisPass > 0 ? verifiedCount / questionsThisPass : 0,
      avgLatencyMsThisPass: questionsThisPass > 0 ? latencySum / questionsThisPass : 0,
      elapsedMsThisPass: Date.now() - passStartMs,
    };
    passSummaries.push(summary);
    onProgress?.({ type: 'pass-done', domain, summary });

    passIndex++;
    startBankIndex = 0; // every subsequent pass restarts from the top of the bank
  }

  const result: FieldSowingResult = {
    domain,
    startedAt,
    completedAt: Date.now(),
    passesCompleted: passSummaries.length,
    passSummaries,
    totalEbletsWritten,
    totalQuestionsProcessed,
    receiptPath: receiptPathFor(domain),
    progressPath: progressPathFor(domain),
    stoppedReason,
  };

  onProgress?.({ type: 'complete', result });
  console.log(
    `[FieldSowing] COMPLETE domain=${domain} passes=${result.passesCompleted} ` +
    `totalEbletsWritten=${totalEbletsWritten} totalQuestionsProcessed=${totalQuestionsProcessed} ` +
    `stoppedReason=${stoppedReason}`,
  );
  return result;
}
