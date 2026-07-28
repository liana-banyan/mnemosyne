/**
 * Giant concordance — BP081 v0.1.59.1 + BP082 v0.2.2
 * 3-voter Ollama dispatch with perspective-diverse prompts.
 *
 * v0.2.2 BP082: Added extractLetterChoice() + runMMLUProConcordance() for
 * sealed-answer MCQ verification. Each voter independently asks Gemma the
 * question with a different prompt framing and extracts the answer letter.
 * Concordance = 2-of-3 voters extract a letter matching the sealed answer.
 *
 * Caithedral spelling preserved per BP081 blood statute.
 */

export interface VoterVote {
  voter: number;
  // 'abstained' BP-timeout-fix: a voter that timed out or errored before returning any
  // content. Additive value -- existing 'verified' | 'rejected' producers (extractLetterChoice
  // callers, runMMLUProConcordance) are unaffected since they never emit it.
  verdict: 'verified' | 'rejected' | 'abstained';
  confidence: number;
  extractedLetter?: string | null;
}

export interface ConcordanceResult {
  // 'inconclusive' BP-timeout-fix: fewer than 2 voters actually responded (the rest
  // timed out/errored), so there isn't a meaningful 2-of-N content vote to report. This is
  // NEITHER 'verified' NOR a hard 'rejected' -- callers that gate storage on
  // `verdict === 'verified'` (runCsiaConcordanceGateAndStore) already treat it as
  // not-concordant-yet, which lets CSIA recursion retry/widen instead of dropping the
  // answer on a false content-reject.
  verdict: 'verified' | 'rejected' | 'split' | 'inconclusive';
  confidence: number;
  votes: VoterVote[];
  error?: string;
}

export interface MMLUProConcordanceResult {
  verdict: 'verified' | 'rejected';
  matchCount: number;        // 0-3 voters that matched sealed answer
  sealedLetter: string;
  voterLetters: (string | null)[];
  votes: VoterVote[];
}

// ─── Letter extraction ────────────────────────────────────────────────────────

/**
 * Extract an MCQ letter choice (A-J) from a free-text model response.
 * Handles: "The answer is B", "(A)", "A.", "Answer: C", "B)", final-line "D", etc.
 * Returns null if no letter can be confidently extracted.
 */
export function extractLetterChoice(text: string): string | null {
  if (!text) return null;

  const patterns: RegExp[] = [
    // "answer is A" / "answer: B" / "choice is C"
    /\b(?:answer|choice|option|select|correct)\s*(?:is|:|=)\s*\(?([A-J])\)?/i,
    // "(A) is correct" / "(B)" at end of line
    /\(([A-J])\)\s*(?:is\s*(?:correct|the\s*(?:right|best))|$)/im,
    // "A." or "A)" at start of a line (common MCQ format in responses)
    /^([A-J])[.)]\s/m,
    // "final answer: A" / "final answer is B"
    /\bfinal\s+answer\s*[:=]?\s*\(?([A-J])\)?/i,
    // standalone letter on its own line
    /^\s*([A-J])\s*$/m,
    // letter right after a newline with optional surrounding whitespace
    /\n\s*([A-J])\s*\n/,
    // last resort: look for "(A)" anywhere
    /\(([A-J])\)/,
    // "B is correct" / "C is the answer"
    /\b([A-J])\s+(?:is|seems|appears)\s+(?:correct|right|the\s*(?:right|best|correct)\s*(?:answer|choice|option))/i,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].toUpperCase();
  }

  return null;
}

// ─── MMLU-Pro concordance ─────────────────────────────────────────────────────

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

function buildMMLUVoterPrompt(
  question: string,
  optionsText: string,
  voterIndex: number,
  substrateContext?: string,
): string {
  const contextPrefix = substrateContext
    ? `Relevant domain knowledge (use as background reasoning only):\n${substrateContext}\n\n`
    : '';
  const base = `${contextPrefix}Question: ${question}\n\n${optionsText}\n\n`;
  switch (voterIndex) {
    case 0:
      return (
        base +
        'Reply with ONLY the letter of the correct answer (e.g. "A"). No explanation.'
      );
    case 1:
      return (
        base +
        'Read each option carefully. Which one is correct? Reply with ONLY the letter (e.g. "B"). No extra text.'
      );
    case 2:
      return (
        base +
        'Eliminate the wrong options one by one. Give ONLY the letter of the remaining correct option.'
      );
    default:
      return base + 'Reply with ONLY the correct answer letter.';
  }
}

/**
 * Run 3 independent MMLU-Pro voters against a question + sealed answer.
 *
 * Each voter asks Gemma the same question with a different prompt framing.
 * extractLetterChoice() extracts the letter from each raw response.
 * Concordance = ≥2 voters extract a letter that matches the sealed answer.
 *
 * Runs voters in parallel for speed.
 */
export async function runMMLUProConcordance(
  question: string,
  options: string[],
  sealedLetter: string,
  opts?: {
    model?: string;
    ollamaBaseUrl?: string;
    temperature?: number;
    /** Per-voter temperatures [voter0, voter1, voter2]. Falls back to temperature if not set. */
    voterTemperatures?: [number, number, number];
    /** Substrate context string to inject into voter prompts as background knowledge. */
    substrateContext?: string;
  },
): Promise<MMLUProConcordanceResult> {
  const model = opts?.model ?? 'gemma4:12b';
  const ollamaBaseUrl = opts?.ollamaBaseUrl ?? 'http://127.0.0.1:11434';
  const temperature = opts?.temperature ?? 0.0;
  const voterTemps: [number, number, number] = opts?.voterTemperatures ?? [temperature, temperature, temperature];
  const substrateContext = opts?.substrateContext;

  const optionsText = options
    .map((o, i) => `${OPTION_LABELS[i] ?? String(i)}. ${o}`)
    .join('\n');

  const sealed = sealedLetter.toUpperCase();

  const voterPrompts = [
    buildMMLUVoterPrompt(question, optionsText, 0, substrateContext),
    buildMMLUVoterPrompt(question, optionsText, 1, substrateContext),
    buildMMLUVoterPrompt(question, optionsText, 2, substrateContext),
  ];

  const voterLetters: (string | null)[] = [];
  const votes: VoterVote[] = [];

  // Run all 3 voters in parallel
  const voterResults = await Promise.all(
    voterPrompts.map(async (prompt, i) => {
      try {
        const response = await fetch(`${ollamaBaseUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            prompt,
            stream: false,
            // num_predict: 256 — gemma4:12b thinking model outputs <think> blocks;
            // 48 tokens (old value) truncated mid-think, breaking letter extraction.
            // think: false — suppresses thinking for MCQ letter-only responses.
            options: { num_predict: 256, temperature: voterTemps[i], think: false },
          }),
          signal: AbortSignal.timeout(45_000),
        });
        if (!response.ok) {
          console.error(`[Concordance] voter=${i + 1} HTTP ${response.status}`);
          return { voter: i + 1, rawText: '', letter: null, confidence: 0 };
        }
        const data = (await response.json()) as { response?: string };
        const rawText = data.response?.trim() ?? '';
        const letter = extractLetterChoice(rawText);
        const confidence = letter !== null ? 0.9 : 0.5;
        console.log(
          `[Concordance] voter=${i + 1} raw="${rawText.slice(0, 60).replace(/\n/g, '↵')}" ` +
          `extracted="${letter ?? 'null'}" sealed="${sealed}"`,
        );
        return { voter: i + 1, rawText, letter, confidence };
      } catch (err) {
        console.error(`[Concordance] voter=${i + 1} error:`, err);
        return { voter: i + 1, rawText: '', letter: null, confidence: 0 };
      }
    }),
  );

  for (const r of voterResults) {
    voterLetters.push(r.letter);
    const matches = r.letter !== null && r.letter === sealed;
    votes.push({
      voter: r.voter,
      verdict: matches ? 'verified' : 'rejected',
      confidence: r.confidence,
      extractedLetter: r.letter,
    });
  }

  const matchCount = votes.filter((v) => v.verdict === 'verified').length;
  const verdict = matchCount >= 2 ? 'verified' : 'rejected';

  console.log(
    `[Concordance] result: matchCount=${matchCount}/3 verdict=${verdict} ` +
    `sealed=${sealed} voterLetters=[${voterLetters.join(',')}]`,
  );

  return { verdict, matchCount, sealedLetter: sealed, voterLetters, votes };
}

// ─── Open-ended concordance (original — for non-MCQ questions) ────────────────

function buildCorrectnessPrompt(question: string, candidateAnswer: string): string {
  return `You are a strict factual verifier. Given a question and a candidate answer, determine if the answer is factually correct.

Question: ${question}
Candidate Answer: ${candidateAnswer}

Respond with ONLY one word: VERIFIED (if the answer is factually correct) or REJECTED (if it is wrong, incomplete, or uncertain).`;
}

function buildConsistencyPrompt(question: string, candidateAnswer: string): string {
  return `You are a logical consistency checker. Given a question and a candidate answer, determine if the answer is internally consistent and logically valid.

Question: ${question}
Candidate Answer: ${candidateAnswer}

Respond with ONLY one word: VERIFIED (if the answer is logically consistent and valid) or REJECTED (if it contains contradictions, logical errors, or is too vague to accept).`;
}

function buildCoveragePrompt(question: string, candidateAnswer: string): string {
  return `You are a completeness evaluator. Given a question and a candidate answer, determine if the answer adequately covers the key points needed to answer the question.

Question: ${question}
Candidate Answer: ${candidateAnswer}

Respond with ONLY one word: VERIFIED (if the answer adequately covers the question) or REJECTED (if it is missing critical information or is too superficial).`;
}

export async function runGiantConcordance(
  question: string,
  candidateAnswer: string,
  opts?: { voters?: number; model?: string; ollamaBaseUrl?: string },
): Promise<ConcordanceResult> {
  const model = opts?.model ?? 'gemma4:12b';
  const ollamaBaseUrl = opts?.ollamaBaseUrl ?? 'http://127.0.0.1:11434';

  const voterPrompts = [
    buildCorrectnessPrompt(question, candidateAnswer),
    buildConsistencyPrompt(question, candidateAnswer),
    buildCoveragePrompt(question, candidateAnswer),
  ];

  const votes = await Promise.all(
    voterPrompts.map(async (prompt, i): Promise<VoterVote> => {
      try {
        const response = await fetch(`${ollamaBaseUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, prompt, stream: false }),
          // Raised 30s -> 45s (secondary mitigation): 6GB-VRAM hardware runs gemma4:12b slowly
          // enough that 30s was itself a source of spurious timeouts. The structural fix below
          // (timeout != reject) is what actually matters; this just reduces how often it fires.
          signal: AbortSignal.timeout(45_000),
        });
        if (!response.ok) {
          // HTTP-level failure (e.g. Ollama up but model not loaded / 5xx) is a transport
          // problem, not a verdict on the candidate answer's content -- abstain, don't reject.
          console.error(`[GiantConcordance] Voter ${i + 1} HTTP ${response.status} -- abstaining`);
          return { voter: i + 1, verdict: 'abstained', confidence: 0 };
        }
        const data = (await response.json()) as { response?: string };
        const text: string = data.response?.trim().toUpperCase() ?? '';
        const verdict: 'verified' | 'rejected' = text.startsWith('VERIFIED') ? 'verified' : 'rejected';
        const confidence = text.startsWith('VERIFIED') || text.startsWith('REJECTED') ? 0.9 : 0.5;
        return { voter: i + 1, verdict, confidence };
      } catch (err) {
        // BP-timeout-fix: this catch fires on AbortSignal.timeout() (name 'TimeoutError' /
        // 'AbortError') just as readily as on a genuine network failure. Either way, the voter
        // never actually evaluated the candidate answer's content, so it must NOT be counted as
        // a content REJECT -- that was the false-reject bug (timeout indistinguishable from a
        // real "no"). Mark it 'abstained' instead; the verdict logic below only counts voters
        // that actually responded.
        const isTimeout = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
        console.error(`[GiantConcordance] Voter ${i + 1} ${isTimeout ? 'TIMEOUT' : 'error'} (abstaining):`, err);
        return { voter: i + 1, verdict: 'abstained', confidence: 0 };
      }
    }),
  );

  const respondedVotes = votes.filter((v) => v.verdict !== 'abstained');
  const abstainedCount = votes.length - respondedVotes.length;

  // Honesty firewall: fewer than 2 real responses means there is no meaningful majority to
  // report either way. Return 'inconclusive' -- never 'verified' (can't fabricate agreement
  // out of abstentions) and never a hard 'rejected' (a timeout-starved round must not read as
  // a confident content rejection; callers/recursion treat non-'verified' as "not concordant
  // yet" and retry/widen instead of dropping the answer).
  if (respondedVotes.length < 2) {
    console.error(
      `[GiantConcordance] inconclusive -- only ${respondedVotes.length}/${votes.length} voter(s) responded ` +
      `(${abstainedCount} abstained/timed out) ` +
      `voters=[${votes.map((v) => `${v.voter}:${v.verdict}(${v.confidence})`).join(',')}]`,
    );
    return {
      verdict: 'inconclusive',
      confidence: 0,
      votes,
      error: respondedVotes.length === 0 ? 'ollama_unreachable' : 'insufficient_voters',
    };
  }

  const verifiedCount = respondedVotes.filter((v) => v.verdict === 'verified').length;
  const avgConfidence = respondedVotes.reduce((sum, v) => sum + v.confidence, 0) / respondedVotes.length;

  // Same 2-of-N-responded shape as before (was 2-of-3-fixed): with all 3 responding this is
  // byte-identical to the prior 2-of-3 logic. With only 2 responding (1 abstained) it requires
  // both to agree -- stricter than 2-of-3's 66%, never looser, so this cannot manufacture a
  // false 'verified' out of a thinned voter pool.
  let verdict: 'verified' | 'rejected' | 'split';
  if (verifiedCount >= 2) {
    verdict = 'verified';
  } else if (verifiedCount === 1) {
    verdict = 'split';
  } else {
    verdict = 'rejected';
  }

  console.log(
    `[GiantConcordance] verdict=${verdict} confidence=${avgConfidence.toFixed(3)} ` +
    `responded=${respondedVotes.length}/${votes.length} (${abstainedCount} abstained) ` +
    `voters=[${votes.map((v) => `${v.voter}:${v.verdict}(${v.confidence})`).join(',')}]`,
  );

  return { verdict, confidence: avgConfidence, votes };
}
