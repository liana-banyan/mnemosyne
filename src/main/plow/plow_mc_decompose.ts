// plow_mc_decompose.ts -- BP138 Yoke Phase 2: Deterministic Decompose-and-Eliminate engine.
//
// WHY THIS FILE EXISTS: the existing plow (plow_mc_answerer.ts) assigns one authority to the
// whole question and runs a full specialist swarm. This module implements the Founder's
// "game of minesweeper" alternative: break the question into per-option FOUNDATION FACTS
// (atomic, verifiable yes/no claims), verify each against the browser authority, and
// ELIMINATE options whose foundation fact is falsified by a real source. Land on exactly
// 1 survivor = deterministic answer + full provenance receipt (sole survivor reached by
// sourced elimination). >1 survivors = pick ONLY if exactly one of them carries its own
// independently verified-true foundation fact -- never a bare keyword-overlap guess.
// 0 survivors, authority-empty, or >1 survivors with no verified-true fact among them =
// honest ABSTAIN (NEVER guess).
//
// GATING (byte-unchanged when the flag is off): the exported runDecomposeAndEliminate()
// function checks researchArmDecompose as its FIRST guard and returns null (not an answer)
// when off -- the caller (plow_mc_answerer.ts) falls through to the existing plow unchanged.
//
// BR-007 (empirical ground truth, no circular validation): this engine NEVER reads the
// sealed answer letter. It verifies foundation facts against external sources only.
//
// Rule 66: version, never overwrite -- this is a new file, no supersede needed.

import { createHash } from 'crypto';
import { callOllama } from './canonical_pipeline';
import { getRawBrowserAuthorityFact } from './browser_authority_adapter';
import type { BrowserAuthorityBridge } from './browser_authority_adapter';
import type { BrowserAuthorityAdapterConfig } from '../../shared/plow/browser_authority_types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FoundationQuery {
  option: string;       // 'A', 'B', 'C', ...
  optionText: string;   // verbatim option text from the question
  query: string;        // crisp yes/no fact query
}

export type OptionVerdict = 'kill' | 'keep' | 'unresolved';

export interface OptionEliminationReceipt {
  option: string;
  optionText: string;
  foundationQuery: string;
  verdict: OptionVerdict;
  /** Tactic 2 = direct sourced-fact refutation; Tactic 1 = assembled fit; unresolved = neither */
  tactic: 'tactic2_sourced' | 'tactic1_assembled' | 'unresolved';
  /** Present only when Tactic 2 killed this option (the kill receipt, BR-007 provenance). */
  sourceUrl?: string;
  /** The raw fact returned by the browser authority. */
  fact?: string;
  killReason?: string;
}

export interface DecomposeElimResult {
  questionId: string;
  strategy: 'decompose-and-eliminate';
  survivorCount: number;
  /** null = honest ABSTAIN (0 survivors, all-unresolved, or authority-empty). Never a guess. */
  chosenLetter: string | null;
  abstainReason?: 'no-survivors' | 'all-unresolved' | 'authority-empty' | 'decompose-failed';
  /**
   * WHY chosenLetter was picked -- both non-null values are genuinely sourced. Callers (e.g.
   * plow_mc_answerer.ts) must check this before labeling a result CONCORDANT rather than
   * trusting a bare non-null chosenLetter: null/absent alongside a non-null chosenLetter would
   * mean an undisclosed basis and must NOT be treated as full confidence.
   *  - 'sole-survivor-elimination': every other option was killed by a real sourced fact.
   *  - 'verified-true-fact': exactly one surviving option's own foundation fact was
   *    independently verified-true (Tactic 2 SUPPORT from a sourced fact).
   */
  basis?: 'sole-survivor-elimination' | 'verified-true-fact' | null;
  receipts: OptionEliminationReceipt[];
  traceSummary: string;
  latencyMs: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Maximum tokens for the decompose local model call (keep it cheap + fast)
const DECOMPOSE_NUM_PREDICT = 400;
// Maximum tokens for the verdict local model call (binary: SUPPORT or REFUTE)
const VERDICT_NUM_PREDICT = 32;

// ─── Step 1: DECOMPOSE -- generate per-option foundation-fact queries ─────────

const DECOMPOSE_PROMPT_TEMPLATE = (question: string, optionLines: string): string =>
`You are a FACT-CHECKER generating one crisp yes/no VERIFIABLE QUERY per answer option.

QUESTION: ${question}

OPTIONS:
${optionLines}

For EACH option, output EXACTLY ONE LINE in this format:
OPTION: <letter> QUERY: <a short yes/no question that verifies whether that option is correct>

Rules:
- Each query must be checkable against a real source (encyclopedia, textbook, etc.)
- Do NOT include the word "correct" in any query
- Do NOT indicate which option you think is right
- Do NOT explain, just output the lines

EXAMPLE FORMAT:
OPTION: A QUERY: Is the speed of light approximately 3 x 10^8 meters per second?
OPTION: B QUERY: Was the Battle of Hastings fought in 1066?`;

function parseFoundationQueries(raw: string, options: string[]): FoundationQuery[] {
  const results: FoundationQuery[] = [];
  const lines = raw.split('\n');
  for (const line of lines) {
    const m = line.match(/OPTION:\s*([A-J])\s+QUERY:\s*(.+)/i);
    if (!m) continue;
    const letter = m[1].toUpperCase();
    const query = m[2].trim();
    if (!query || query.length < 5) continue;
    const idx = letter.charCodeAt(0) - 'A'.charCodeAt(0);
    if (idx < 0 || idx >= options.length) continue;
    results.push({
      option: letter,
      optionText: options[idx] ?? '',
      query,
    });
  }
  return results;
}

async function decomposeToFoundationQueries(
  question: string,
  options: string[],
  ollamaBaseUrl: string,
  model: string,
): Promise<FoundationQuery[] | null> {
  const lastLetter = String.fromCharCode('A'.charCodeAt(0) + options.length - 1);
  const optionLines = options
    .map((opt, i) => `${String.fromCharCode('A'.charCodeAt(0) + i)}) ${opt}`)
    .join('\n');
  const prompt = DECOMPOSE_PROMPT_TEMPLATE(question, optionLines);
  const raw = await callOllama(prompt, ollamaBaseUrl, model, 0.0, DECOMPOSE_NUM_PREDICT);
  if (!raw) return null;
  const queries = parseFoundationQueries(raw, options);
  // Need at least 2 queries to attempt elimination (1 query would be trivially insufficient)
  return queries.length >= 2 ? queries : null;
}

// ─── Step 2: ELIMINATE -- Tactic 2 (sourced fact refutation) ─────────────────

const VERDICT_PROMPT = (fact: string, optionText: string): string =>
`Given this FACT retrieved from a real source:
"${fact.slice(0, 500)}"

Does this fact SUPPORT or REFUTE the following claim?
Claim: "${optionText.slice(0, 300)}"

Answer with exactly one word: SUPPORT or REFUTE`;

async function getVerdictFromLocalModel(
  fact: string,
  optionText: string,
  ollamaBaseUrl: string,
  model: string,
): Promise<'SUPPORT' | 'REFUTE' | null> {
  const prompt = VERDICT_PROMPT(fact, optionText);
  const raw = await callOllama(prompt, ollamaBaseUrl, model, 0.0, VERDICT_NUM_PREDICT);
  if (!raw) return null;
  const upper = raw.trim().toUpperCase();
  if (upper.includes('REFUTE')) return 'REFUTE';
  if (upper.includes('SUPPORT')) return 'SUPPORT';
  return null;
}

// ─── Step 3: fact-based distinction (NOT a keyword-overlap guess) ───────────

// When Tactic 2 leaves >1 survivor, the ONLY honest way to pick one is a genuine fact-based
// distinction: exactly one survivor whose own foundation fact was independently verified-true
// (a real Tactic 2 SUPPORT verdict backed by a sourced fact). This is deliberately NOT a
// keyword-overlap "tie-break" -- the previous implementation scored bare keyword overlap and
// initialized bestScore to -1, so the FIRST survivor's score of 0 already beat -1 and always
// won, even with zero sourced basis. That was a disguised full-confidence guess. Now: if there
// is no unique verified-true survivor, this returns null so the caller honestly
// abstains/escalates instead of guessing.
function tactic1TieBreak(
  survivors: FoundationQuery[],
  verifiedTrueOptions: Set<string>,
): string | null {
  if (survivors.length === 0) return null;
  if (survivors.length === 1) return survivors[0].option;

  const verifiedSurvivors = survivors.filter((s) => verifiedTrueOptions.has(s.option));
  if (verifiedSurvivors.length === 1) return verifiedSurvivors[0].option;

  // Zero verified-true survivors, or more than one (contradictory sourced signals) -- no
  // honest fact-based distinction exists. Abstain/escalate rather than guess.
  return null;
}

// ─── Main exported function ────────────────────────────────────────────────────

export interface DecomposeConfig {
  researchArmMode: boolean;
  researchArmDecompose: boolean;
  researchArmBrowserAuthority: boolean;
  preferredAuthority?: 'user_google' | 'user_perplexity';
}

export async function runDecomposeAndEliminate(opts: {
  questionId: string;
  question: string;
  options: string[];
  ollamaBaseUrl: string;
  model: string;
  bridge: BrowserAuthorityBridge;
  config: DecomposeConfig;
  onProgress?: (msg: string) => void;
}): Promise<DecomposeElimResult | null> {
  const { questionId, question, options, ollamaBaseUrl, model, bridge, config, onProgress } = opts;

  // HARD GATE: flag must be on
  if (!config.researchArmMode || !config.researchArmDecompose) return null;

  const startMs = Date.now();
  const log = (msg: string) => {
    console.log(`[decompose-elim] ${msg}`);
    onProgress?.(msg);
  };

  log(`q=${questionId.slice(0, 12)} options=${options.length} -- starting decompose`);

  // ── Step 1: DECOMPOSE ────────────────────────────────────────────────────────
  const foundationQueries = await decomposeToFoundationQueries(question, options, ollamaBaseUrl, model);
  if (!foundationQueries) {
    log('decompose-failed: local model returned no usable foundation queries');
    return {
      questionId,
      strategy: 'decompose-and-eliminate',
      survivorCount: options.length,
      chosenLetter: null,
      abstainReason: 'decompose-failed',
      receipts: options.map((opt, i) => ({
        option: String.fromCharCode('A'.charCodeAt(0) + i),
        optionText: opt,
        foundationQuery: '',
        verdict: 'unresolved' as OptionVerdict,
        tactic: 'unresolved' as const,
        killReason: 'decompose-failed',
      })),
      traceSummary: 'strategy=decompose-and-eliminate decomposeFailed=true',
      latencyMs: Date.now() - startMs,
    };
  }

  log(`decomposed: ${foundationQueries.map((q) => `${q.option}="${q.query.slice(0, 40)}"`).join(', ')}`);

  // ── Step 2: ELIMINATE via Tactic 2 (browser authority) ──────────────────────
  const browserConfig: BrowserAuthorityAdapterConfig = {
    researchArmMode: true,
    researchArmBrowserAuthority: true,
    ...(config.preferredAuthority ? { preferredAuthority: config.preferredAuthority } : {}),
  };

  const receipts: OptionEliminationReceipt[] = [];
  const survivors: FoundationQuery[] = [];
  const killedOptions = new Set<string>();
  const factsByOption = new Map<string, string>();
  // Options whose OWN foundation fact was independently verified-true (Tactic 2 SUPPORT from a
  // sourced fact) -- the only honest basis for picking among >1 survivors. Populated below.
  const verifiedTrueOptions = new Set<string>();
  let anyAuthorityHit = false;

  for (const fq of foundationQueries) {
    log(`eliminate: option=${fq.option} query="${fq.query.slice(0, 60)}"`);
    onProgress?.(`decompose:option-${fq.option}`);

    let verdict: OptionVerdict = 'unresolved';
    let tactic: OptionEliminationReceipt['tactic'] = 'unresolved';
    let sourceUrl: string | undefined;
    let fact: string | undefined;
    let killReason: string | undefined;

    try {
      const rawFact = await getRawBrowserAuthorityFact(fq.query, browserConfig, bridge);

      if (rawFact && rawFact.fact) {
        anyAuthorityHit = true;
        fact = rawFact.fact;
        sourceUrl = rawFact.sourceUrl ?? undefined;
        factsByOption.set(fq.option, rawFact.fact);

        // Adjudicate: does this fact support or refute the option?
        const localVerdict = await getVerdictFromLocalModel(rawFact.fact, fq.optionText, ollamaBaseUrl, model);
        log(`  verdict=${localVerdict ?? 'null'} source=${rawFact.sourceUrl?.slice(0, 60) ?? 'none'}`);

        if (localVerdict === 'REFUTE') {
          verdict = 'kill';
          tactic = 'tactic2_sourced';
          killReason = `fact_refutes_option sourceUrl=${rawFact.sourceUrl ?? 'none'}`;
          killedOptions.add(fq.option);
        } else if (localVerdict === 'SUPPORT') {
          verdict = 'keep';
          tactic = 'tactic2_sourced';
          survivors.push(fq);
          verifiedTrueOptions.add(fq.option);
        } else {
          // Null verdict from local model -- leave as unresolved
          verdict = 'unresolved';
          tactic = 'unresolved';
          survivors.push(fq);
        }
      } else {
        // No fact from browser authority -- unresolved
        verdict = 'unresolved';
        tactic = 'unresolved';
        survivors.push(fq);
      }
    } catch (err) {
      log(`  authority error (non-fatal, unresolved): ${err}`);
      verdict = 'unresolved';
      tactic = 'unresolved';
      survivors.push(fq);
    }

    receipts.push({
      option: fq.option,
      optionText: fq.optionText,
      foundationQuery: fq.query,
      verdict,
      tactic,
      ...(sourceUrl ? { sourceUrl } : {}),
      ...(fact ? { fact: fact.slice(0, 500) } : {}),
      ...(killReason ? { killReason } : {}),
    });
  }

  // Options not covered by foundation queries remain as survivors (unresolved)
  const coveredOptions = new Set(foundationQueries.map((q) => q.option));
  for (let i = 0; i < options.length; i++) {
    const letter = String.fromCharCode('A'.charCodeAt(0) + i);
    if (!coveredOptions.has(letter) && !killedOptions.has(letter)) {
      survivors.push({ option: letter, optionText: options[i], query: '' });
      receipts.push({
        option: letter,
        optionText: options[i],
        foundationQuery: '',
        verdict: 'unresolved',
        tactic: 'unresolved',
        killReason: 'not-covered-by-decompose',
      });
    }
  }

  log(`after tactic2: ${survivors.length} survivors, ${killedOptions.size} killed`);

  // ── Step 3: CONCLUDE ─────────────────────────────────────────────────────────
  let chosenLetter: string | null = null;
  let abstainReason: DecomposeElimResult['abstainReason'];
  let basis: DecomposeElimResult['basis'] = null;

  if (!anyAuthorityHit) {
    // Browser authority returned nothing at all -- honest ABSTAIN, fall through to plow
    abstainReason = 'authority-empty';
    log('authority-empty: no browser authority hits -- honest ABSTAIN, fall through to plow');
  } else if (survivors.length === 0) {
    // All options killed -- impossible (means the question's premises are false or our
    // queries were all wrong). Honest ABSTAIN.
    abstainReason = 'no-survivors';
    log('no-survivors: all options were killed -- honest ABSTAIN');
  } else if (survivors.every((s) => !factsByOption.has(s.option))) {
    // Every survivor is unresolved (no fact, no verdict) -- can't conclude deterministically
    if (survivors.length === 1) {
      // Only one option was NOT killed (even without a fact for it) -- elimination narrowed it.
      // Legitimate: every other option was falsified by a real sourced fact (tactic2_sourced).
      chosenLetter = survivors[0].option;
      basis = 'sole-survivor-elimination';
      log(`1-survivor-by-elimination: ${chosenLetter} (no direct fact, but all others killed)`);
    } else {
      // No survivor in this branch has ANY fact (that's the branch guard above), so no
      // verified-true survivor can exist here -- this will always return null. Kept as a
      // single code path (rather than skipping the call) so the honesty check lives in one
      // place; if it were ever non-null it would still be a genuine verified-true pick.
      const tactic1Letter = tactic1TieBreak(survivors, verifiedTrueOptions);
      if (tactic1Letter) {
        chosenLetter = tactic1Letter;
        basis = 'verified-true-fact';
        log(`fact-verified-pick: ${chosenLetter} (${survivors.length} otherwise-unresolved survivors)`);
      } else {
        abstainReason = 'all-unresolved';
        log('all-unresolved: no deterministic conclusion -- honest ABSTAIN');
      }
    }
  } else if (survivors.length === 1) {
    // Sole survivor -- every other option was falsified by a real sourced fact.
    chosenLetter = survivors[0].option;
    basis = 'sole-survivor-elimination';
    log(`deterministic: 1 survivor = ${chosenLetter} (source-verified elimination)`);
  } else {
    // Multiple survivors, at least one carries a fact -- pick ONLY if exactly one survivor's
    // own foundation fact was independently verified-true. No keyword guessing.
    const tactic1Letter = tactic1TieBreak(survivors, verifiedTrueOptions);
    if (tactic1Letter) {
      chosenLetter = tactic1Letter;
      basis = 'verified-true-fact';
      log(`fact-verified-pick: ${chosenLetter} (${survivors.length} survivors, 1 verified-true)`);
    } else {
      // No unique verified-true survivor -- escalate to plow (return null so caller falls
      // through) rather than guess from keyword overlap.
      abstainReason = 'all-unresolved';
      log('no unique verified-true survivor -- honest escalation to plow');
    }
  }

  const latencyMs = Date.now() - startMs;
  const killedSummary = receipts
    .filter((r) => r.verdict === 'kill')
    .map((r) => `${r.option}(${r.sourceUrl?.slice(0, 30) ?? 'no-url'})`)
    .join(', ');
  const traceSummary =
    `strategy=decompose-and-eliminate` +
    ` survivors=${survivors.length}` +
    ` killed=${killedOptions.size}` +
    ` authorityHit=${anyAuthorityHit}` +
    ` chosenLetter=${chosenLetter ?? 'ABSTAIN'}` +
    (abstainReason ? ` abstainReason=${abstainReason}` : '') +
    (killedSummary ? ` killed=[${killedSummary}]` : '');

  log(traceSummary);

  return {
    questionId,
    strategy: 'decompose-and-eliminate',
    survivorCount: survivors.length,
    chosenLetter,
    ...(abstainReason ? { abstainReason } : {}),
    basis,
    receipts,
    traceSummary,
    latencyMs,
  };
}

// ─── Option-verification mode (Phase 3 peer side) ────────────────────────────
// When a WAN peer receives `assigned_option` in its relay route payload, it uses
// this lightweight function to verify ONLY that option's foundation fact.
// Returns a structured verdict that the asker can pool for elimination.

export interface OptionVerdictResult {
  option: string;
  optionText: string;
  verdict: OptionVerdict;
  fact?: string;
  sourceUrl?: string;
  killReason?: string;
  latencyMs: number;
}

export async function verifyAssignedOption(opts: {
  question: string;
  assignedOption: string;    // e.g. 'C'
  optionText: string;
  ollamaBaseUrl: string;
  model: string;
  bridge: BrowserAuthorityBridge;
  config: BrowserAuthorityAdapterConfig;
  onProgress?: (msg: string) => void;
}): Promise<OptionVerdictResult> {
  const { question, assignedOption, optionText, ollamaBaseUrl, model, bridge, config } = opts;
  const startMs = Date.now();

  // Generate a foundation query for this specific option
  const optionLines = `${assignedOption}) ${optionText}`;
  const decomposedRaw = await callOllama(
    DECOMPOSE_PROMPT_TEMPLATE(question, optionLines),
    ollamaBaseUrl,
    model,
    0.0,
    DECOMPOSE_NUM_PREDICT,
  );

  const foundationQuery = decomposedRaw
    ? parseFoundationQueries(decomposedRaw, [optionText])
      .find((q) => q.option === assignedOption)?.query ?? `Is the following true: ${optionText}?`
    : `Is the following true: ${optionText}?`;

  let verdict: OptionVerdict = 'unresolved';
  let fact: string | undefined;
  let sourceUrl: string | undefined;
  let killReason: string | undefined;

  try {
    const rawFact = await getRawBrowserAuthorityFact(foundationQuery, config, bridge);
    if (rawFact && rawFact.fact) {
      fact = rawFact.fact;
      sourceUrl = rawFact.sourceUrl ?? undefined;
      const localVerdict = await getVerdictFromLocalModel(rawFact.fact, optionText, ollamaBaseUrl, model);
      if (localVerdict === 'REFUTE') {
        verdict = 'kill';
        killReason = `fact_refutes_option sourceUrl=${rawFact.sourceUrl ?? 'none'}`;
      } else if (localVerdict === 'SUPPORT') {
        verdict = 'keep';
      }
    }
  } catch {
    // Non-fatal -- unresolved
  }

  return {
    option: assignedOption,
    optionText,
    verdict,
    ...(fact ? { fact: fact.slice(0, 500) } : {}),
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(killReason ? { killReason } : {}),
    latencyMs: Date.now() - startMs,
  };
}
