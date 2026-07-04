/**
 * andon_replow.ts — Andon Re-Plow loop for per-domain MMLU-Pro Q banks.
 * BP081 v0.1.59 SEG-4 "Plow the Field"
 * BP082 v0.2.1 SEG-2 diagnostic logging + DATA_ROOT fix
 * BP082 v0.2.2 SEG-1 wire 3-voter concordance (runMMLUProConcordance)
 *              SEG-2 extractLetterChoice (via giant_concordance)
 *              Andon Cord retry loop MAX_ATTEMPTS=3
 *
 * Andon discipline: ONLY verified answers (2-of-3 concordance) are written
 * to substrate. Wrong answers are never written.
 */

import { loadDomainBank, type Domain } from './per_domain_q_banks';
import { runMMLUProConcordance } from './giant_concordance';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';

// ─── Constants ────────────────────────────────────────────────────────────────

const OLLAMA_URL = 'http://127.0.0.1:11434';
const DEFAULT_MODEL = 'gemma4:12b';
const MAX_ATTEMPTS = 3;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveModel(): string {
  try {
    const home = process.env.USERPROFILE || process.env.HOME || homedir();
    const p = path.join(home, '.lb_substrate', 'sku_tier.json');
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf-8')) as { model?: string };
      if (data.model) return data.model;
    }
  } catch { /* noop */ }
  return DEFAULT_MODEL;
}

function promptHash(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 12);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlowResult {
  ok: boolean;
  verdict: 'verified' | 'rejected' | 'quarantined';
  ebletWritten: boolean;
  question?: string;
  answer?: string;
  modelAnswer?: string;
  attempts?: number;
  error?: string;
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Run one Andon Re-Plow iteration for a given question text + domain.
 *
 * v0.2.2 flow:
 *   1. Look up the correct answer from the sealed domain bank.
 *   2. Run runMMLUProConcordance() — 3 voters, each independently asks Gemma,
 *      extracts the answer letter, votes if it matches sealed answer.
 *   3. 2-of-3 match → write verified eblet (Andon discipline).
 *   4. If 0-1 match → Andon Cord: retry up to MAX_ATTEMPTS with higher temperature.
 *   5. After MAX_ATTEMPTS without concordance → quarantine (Andon discipline).
 */
export async function runAndonReplowLoop(question: string, domain: string): Promise<PlowResult> {
  const qId = promptHash(question);
  console.log(`[PlowLoop] Q ${qId} domain=${domain} attempt=1/${MAX_ATTEMPTS}`);

  // ── Step 1: load domain bank + find entry ──────────────────────────────────
  let bank;
  try {
    bank = loadDomainBank(domain as Domain);
    console.log(`[PlowLoop] Q ${qId} bank loaded count=${bank.length}`);
  } catch (err) {
    const errMsg = `Bank load failed: ${(err as Error).message}`;
    console.error(`[PlowLoop] Q ${qId} QUARANTINE bank-load-error: ${errMsg}`);
    return {
      ok: false,
      verdict: 'quarantined',
      ebletWritten: false,
      error: errMsg,
    };
  }

  const entry = bank.find((q) => q.question.trim() === question.trim());
  if (!entry) {
    console.error(
      `[PlowLoop] Q ${qId} QUARANTINE not-found — ` +
      `question length=${question.length} bank sample[0] length=${bank[0]?.question?.length ?? 'N/A'}`,
    );
    return {
      ok: false,
      verdict: 'quarantined',
      ebletWritten: false,
      error: 'Question not found in domain bank',
    };
  }

  const model = resolveModel();
  const correctLetter = entry.correct_answer.trim().toUpperCase().replace(/[^A-J]/g, '').charAt(0);

  console.log(`[PlowLoop] Q ${qId} sealed answer="${correctLetter}" model="${model}" options count=${entry.options.length}`);

  // ── Step 2-3: 3-voter concordance with Andon Cord retry ───────────────────
  let attempt = 0;

  while (attempt < MAX_ATTEMPTS) {
    attempt++;

    // Slightly raise temperature on retries to get different responses
    const temperature = attempt === 1 ? 0.0 : (attempt - 1) * 0.1;

    console.log(`[PlowLoop] Q ${qId} attempt=${attempt}/${MAX_ATTEMPTS} temperature=${temperature}`);

    const concordance = await runMMLUProConcordance(
      entry.question,
      entry.options,
      correctLetter,
      { model, temperature },
    );

    console.log(
      `[PlowLoop] concordance result: { ` +
      `verified: ${concordance.verdict === 'verified'}, ` +
      `matchCount: ${concordance.matchCount}, ` +
      `sealed: "${concordance.sealedLetter}", ` +
      `voterLetters: [${concordance.voterLetters.join(',')}], ` +
      `attempts: ${attempt} }`,
    );

    if (concordance.verdict === 'verified') {
      // ── Write verified eblet (Andon discipline) ────────────────────────────
      let ebletWritten = false;
      try {
        const { writeVerifiedEblet } = await import('../mnem_eblet_store');
        const sha256 = createHash('sha256')
          .update(entry.question + entry.correct_answer)
          .digest('hex');
        await writeVerifiedEblet({
          question: entry.question,
          answer: entry.correct_answer,
          provenance: `plow-field:${domain}`,
          verified: true,
          sha256,
          timestamp: Date.now(),
        });
        ebletWritten = true;
        console.log(`[PlowLoop] eblet written sha256=${sha256.slice(0, 12)}`);
      } catch (err) {
        console.warn('[PlowLoop] eblet write failed (non-fatal):', err);
      }

      console.log(
        `[PlowLoop] disposition: { questionId: "${qId}", verified: true, ` +
        `verdict: "verified", ebletWritten: ${ebletWritten}, attempts: ${attempt}, ` +
        `totalLensCalls: ${attempt * 3} }`,
      );

      return {
        ok: true,
        verdict: 'verified',
        ebletWritten,
        question: entry.question,
        answer: entry.correct_answer,
        attempts: attempt,
      };
    }

    // Concordance failed — Andon Cord pull
    if (attempt < MAX_ATTEMPTS) {
      console.log(
        `[PlowLoop] Andon Cord pulled — retrying with ` +
        `{ newContext: temperature=${(attempt) * 0.1}, attempt: ${attempt + 1} }`,
      );
    }
  }

  // ── Exhausted all attempts — quarantine ───────────────────────────────────
  console.log(
    `[PlowLoop] disposition: { questionId: "${qId}", verified: false, ` +
    `verdict: "quarantined", ebletWritten: false, attempts: ${attempt}, ` +
    `totalLensCalls: ${attempt * 3} }`,
  );

  return {
    ok: true,
    verdict: 'quarantined',
    ebletWritten: false,
    question: entry.question,
    answer: entry.correct_answer,
    attempts: attempt,
    error: `Andon: concordance not reached after ${attempt} attempt(s)`,
  };
}
