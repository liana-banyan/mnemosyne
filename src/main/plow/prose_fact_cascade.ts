// prose_fact_cascade.ts -- BP149 D-BP149-027 ("seg-proserecover")
//
// THE DEFECT THIS FILE ADDRESSES: browser_authority_adapter.ts's ensemble callers (inside
// plow_mc_answerer.ts, NEVER edited by this file) mark an authority attempt 'parse_failed'
// whenever extractChosenLetterFromAuthorityText()/matchFreeTextAnswerToOption() (both defined
// in plow_mc_answerer.ts, both untouched here) fail to find an option letter in the authority's
// prose -- even when that prose plainly contains a correct, substantive answer in sentence form
// with no bare letter in it. Measured live BP149 (receipt
// mnemo_mesh_test_receipt_2026-08-08T04-38-35-620Z.json): Google's qid-85 answer IS the textbook
// definition of statistical bias; the literal extractor cannot see it because it never spells
// out "E" or "(E)". Canon `feedback_ask_each_source_the_question_it_can_answer_bp144` already
// names this exact failure mode for Google specifically.
//
// THE FOUNDER'S CORRECTION (D-BP149-027 UPDATE-01, binding, supersedes this ticket's original
// spec): the first draft of this file asked the local model "here are 10 options and a
// paragraph, pick one" -- exactly the black-box judgment the Founder measured, three separate
// ways in one session, that gemma4:12b cannot be trusted to make (qid98 rule inversion, 48/48
// friend-word proposals at false "high" confidence, 794/943 eblet classifications pinned at a
// suspicious exact 1.0). His ruling, verbatim: "The prose is a fact with provenance, not a
// vote... The cascade decides, not the model... The local model's role is MECHANICAL, never
// evaluative." His own worked-by-hand qid-85 walkthrough
// (C:\Users\Administrator\Downloads\FounderCascadeWorkedByHand.txt, Excerpt 7) is the template
// this file follows: look up the fact, keep it as a fact (never paraphrase it into something new
// -- "That doesn't answer my question, it's just a fact to eblet"), then check each option's
// sense against that fact ONE AT A TIME ("I categorize the possible answers... one option at a
// time"), and only accept a letter when exactly one option's sense is entailed by the fact.
//
// WHAT THIS FILE IS NOT: it is not a change to plow_mc_answerer.ts (forbidden this ticket, and
// in general -- an A/B measurement's two arms are defined by that file's git blob) and it is not
// wired into any call site there. Like browser_authority_adapter.ts before it, this is an
// additive, fully-testable, currently-UNWIRED module -- a future ticket's job is to have
// plow_mc_answerer.ts's resolveEnsembleAttemptOutcome() (or a sibling) call this function when
// (and ONLY when) it is about to record 'parse_failed', and to fold a non-null recovery back in
// as a weaker-provenance candidate (see `RECOVERED_LETTER_PROVENANCE` below) -- never as an
// 'explicit_letter'-equivalent vote.
//
// THE LIMITING FACTOR, DISCLOSED HONESTLY (do not skip this in any report of this file): by the
// time an authority attempt is classified 'parse_failed' inside plow_mc_answerer.ts, the fact
// text available at that exact call site is `observed.result.fact` -- ALREADY capped to 320
// characters by browser_authority_types.ts's distillExtraction() (MAX_FACT_CHARS), and the value
// actually PERSISTED into a receipt's `rawPreview` field is that same string truncated AGAIN to
// 200 characters by truncateAuthorityPreview(). The one place a longer string survives in-memory
// is `observed.raw.snippet` (BrowserAuthorityRawExtraction, returned alongside `result` by
// runBrowserAuthorityLookupObserved() in browser_authority_adapter.ts) -- uncapped by
// distillExtraction, but ITS OWN upstream ceiling is whatever webview_preload.ts's DOM scraper
// captured, which this ticket did not audit. This module accepts whatever prose string it is
// given and makes no assumption about its length; a future wiring pass should prefer
// `observed.raw.snippet` over `observed.result.fact` as the input, precisely to minimize
// truncation loss. Every worked example in this file's own test harness uses the SAME
// 200-char-truncated `rawPreview` strings quoted verbatim in the BP149 dispatch ticket (the only
// real captured text this pass had available) -- so a truncation-caused miss in that harness is
// not a bug in this module, it is the disclosed limiting factor operating exactly as described.

/** A single multiple-choice option, letter + text, exactly as plow_mc_answerer.ts's own
 *  (unexported) McOption shape -- redeclared here rather than imported, since nothing in
 *  plow_mc_answerer.ts's option type is exported and this module must not touch that file. */
export interface ProseCascadeOption {
  letter: string;
  text: string;
}

export interface ProseCascadeConfig {
  ollamaBaseUrl?: string;
  /** Default 'gemma4:12b' -- the free local model named in the ticket. */
  model?: string;
  /** Per-call HTTP timeout. Ten-plus sequential/parallel model calls can happen per question
   *  (one per surviving option after the mechanical pre-filter), so this is deliberately shorter
   *  than a single-shot answer call's usual budget. */
  requestTimeoutMs?: number;
}

const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
const DEFAULT_MODEL = 'gemma4:12b';
const DEFAULT_REQUEST_TIMEOUT_MS = 45_000;

/** Estate canon (`feedback_gemma4_thinking_model_num_predict_256_think_false_fix_bp083`, and
 *  giant_concordance.ts's own live use of the identical convention) sets 256 as the FLOOR for
 *  gemma4:12b -- below that, the <think> block eats the entire token budget and the visible
 *  `response` field comes back empty, indistinguishable from the model being unreachable unless
 *  you already know this. Empirically re-measured THIS ticket (D-BP149-027, live curl against
 *  the running server): 256 is NOT sufficient for THIS module's own entailment prompt shape --
 *  even with think:false, a real run against qid-85's fact/option pair consumed 256 tokens with
 *  done_reason:"length" and an EMPTY response field, then produced a real "YES" at eval_count=269
 *  once the ceiling was raised. 512 leaves comfortable headroom above that measured 269 without
 *  materially changing latency. This is an ADDITIVE finding, not a contradiction of the BP083
 *  canon entry -- 256 remains a valid floor for short letter-only prompts (e.g.
 *  giant_concordance.ts's own use); this module's longer, more deliberative YES/NO-with-reasoning
 *  prompt shape simply needs more headroom above that floor. NEVER lower this value without
 *  re-measuring against a live server first -- the entire point of this constant is to not
 *  regress the exact failure this canon entry documents. */
const MIN_NUM_PREDICT = 512;

/** Marks a recovered letter as coming from this cascade, never as an 'explicit_letter'-equivalent
 *  vote -- Founder requirement #5 ("must not be laundered into looking equal"). A future wiring
 *  pass should surface this string (or an equally distinct marker) wherever it threads a
 *  ProseCascadeResult's `letter` into plow_mc_answerer.ts's ensemble_candidates / provenance
 *  records, so downstream corroboration-tier logic (KN-BP144-9, "PROVEN is a substring match")
 *  never conflates it with a literal, model-stated letter. */
export const RECOVERED_LETTER_PROVENANCE = 'prose_fact_cascade_mechanical' as const;

// ─── Pure helpers (no I/O) ────────────────────────────────────────────────────────────────────

/** Small, generic stopword list -- long enough to keep the groundedness/overlap gates from being
 *  fooled by function words, short enough that this stays a mechanical filter, not a linguistic
 *  model. Deliberately conservative (errs toward keeping a word, not dropping it) since this
 *  module's whole design philosophy is "never let a fuzzy heuristic make the actual decision" --
 *  these gates only ever narrow the LLM's workload or trigger an honest abstain, they never by
 *  themselves select a letter. */
const STOPWORDS = new Set([
  'that', 'this', 'these', 'those', 'with', 'from', 'have', 'has', 'had', 'were', 'was', 'are',
  'is', 'be', 'been', 'being', 'the', 'and', 'or', 'but', 'not', 'which', 'what', 'when', 'where',
  'who', 'whom', 'whose', 'why', 'how', 'will', 'would', 'could', 'should', 'shall', 'can', 'may',
  'might', 'must', 'about', 'above', 'after', 'again', 'against', 'all', 'also', 'any', 'because',
  'been', 'before', 'below', 'between', 'both', 'each', 'few', 'for', 'further', 'here', 'into',
  'more', 'most', 'other', 'over', 'own', 'same', 'some', 'such', 'than', 'then', 'there', 'their',
  'them', 'they', 'through', 'under', 'until', 'very', 'while', 'your', 'you', 'our', 'its',
  'itself', 'only', 'once', 'does', 'did', 'doing', 'having', 'like', 'just', 'still', 'even',
]);

/** Lowercased, punctuation-stripped, stopword-filtered, length>=4 word set -- the single
 *  tokenizer every gate in this file shares, so "overlap" always means the same thing. */
export function contentWords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  return new Set(words);
}

/** Empirically forced fix (D-BP149-027 live run): a strict Set-equality overlap check missed
 *  qid-85's own correct option purely on morphology -- the fact says "sampling"/"biased", the
 *  correct option says "sample"/"population" is what's affected by bias, no exact word repeats,
 *  yet the two are obviously the same topic to a human reader. This is still a MECHANICAL,
 *  code-only comparison (no model call) -- it just tolerates simple English inflection (sample/
 *  sampling, bias/biased/biases) via a shared-prefix heuristic instead of demanding byte-for-byte
 *  identical tokens. Two words are "related" when their longest common prefix is at least 4
 *  characters (or the shorter word's full length, if that is under 4) -- crude on purpose, this
 *  is a pre-filter that only ever WIDENS which options reach the real per-option LLM check, it
 *  never by itself decides a letter. */
function longestCommonPrefixLength(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[i] === b[i]) i++;
  return i;
}

function wordsRelated(a: string, b: string): boolean {
  if (a === b) return true;
  const threshold = Math.min(4, Math.min(a.length, b.length));
  return longestCommonPrefixLength(a, b) >= threshold;
}

function overlapWords(a: Set<string>, b: Set<string>): string[] {
  const out: string[] = [];
  for (const wa of a) {
    for (const wb of b) {
      if (wordsRelated(wa, wb)) {
        out.push(wa === wb ? wa : `${wa}~${wb}`);
        break;
      }
    }
  }
  return out;
}

export interface GroundednessCheck {
  passed: boolean;
  overlap: string[];
  reason: string;
}

/** MIN_GROUNDEDNESS_OVERLAP = 1: the coarsest possible "is this prose even about the same topic"
 *  gate -- deliberately weak on its own (see this constant's own doc note below) because it is
 *  only ever a pre-filter, never the decision. It exists to mechanically reject the cheapest,
 *  most common failure mode observed in the live receipt this ticket is built against: vendor-UI
 *  chrome that never touched the question at all (Gemini's "Work Conversation with Gemini Hi J,
 *  let's get into it" boilerplate, captured as parse_failed on every one of 6 questions in that
 *  receipt, 0 content words shared with any of them). A single shared content word is NOT strong
 *  evidence of relevance by itself -- qid 85's own real Google prose shares exactly ONE
 *  four-plus-letter content word with its question ("bias") and must still pass -- so this gate
 *  is intentionally permissive; it is the per-option entailment stage below that carries the
 *  real precision. */
const MIN_GROUNDEDNESS_OVERLAP = 1;

export function checkGroundedness(prose: string, question: string): GroundednessCheck {
  const proseWords = contentWords(prose);
  const questionWords = contentWords(question);
  const overlap = overlapWords(questionWords, proseWords);
  const passed = overlap.length >= MIN_GROUNDEDNESS_OVERLAP;
  return {
    passed,
    overlap,
    reason: passed
      ? `prose shares ${overlap.length} content word(s) with the question ([${overlap.join(', ')}]) -- plausibly on-topic`
      : `prose shares 0 content words with the question -- does not appear to address it (likely UI chrome/off-topic capture, not a real answer)`,
  };
}

// ─── Ollama call (the ONLY I/O in this file) ─────────────────────────────────────────────────

async function callOllamaOnce(
  prompt: string,
  config: ProseCascadeConfig,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const baseUrl = config.ollamaBaseUrl ?? DEFAULT_OLLAMA_BASE_URL;
  const model = config.model ?? DEFAULT_MODEL;
  const timeoutMs = config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        // D-BP200-M0-032: think MUST be top-level. It was previously nested inside `options`
        // here, which this estate has now live-verified (BP134, canonical_pipeline.ts) has NO
        // EFFECT -- the thinking block still ate the budget silently despite looking correct.
        // Moved to top-level below; num_predict floor comment (BP083 canon) is unchanged.
        think: false,
        options: { num_predict: MIN_NUM_PREDICT, temperature: 0 },
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { ok: false, error: `HTTP ${res.status}: ${errText.slice(0, 200)}` };
    }
    const data = (await res.json()) as { response?: string };
    const text = (data.response ?? '').trim();
    if (!text) return { ok: false, error: 'empty response (thinking-budget starvation or model unreachable)' };
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/** D-BP149-027 live proof run (dev machine, shared Ollama server): a fraction of calls come back
 *  with an empty `response` field / AbortError even at num_predict=512, think:false, and even
 *  running strictly sequentially -- almost certainly resource contention on a single-GPU box that
 *  also has llama3.3:70b (42GB) and llama3.1:8b loaded, possibly alongside other concurrent
 *  dispatches against the same local server, not a deterministic property of this module's
 *  prompt. One bounded retry (never more -- this is a fallback path, not a hot loop) after a
 *  short backoff. A retry that ALSO fails still returns the honest 'llm_call_failed' outcome
 *  (never guessed) -- this only reduces false negatives caused by transient contention, it never
 *  changes what counts as a real answer. */
const MAX_OLLAMA_ATTEMPTS = 2;
const RETRY_BACKOFF_MS = 1500;

async function callOllama(
  prompt: string,
  config: ProseCascadeConfig,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  let lastResult: { ok: true; text: string } | { ok: false; error: string } =
    { ok: false, error: 'never attempted' };
  for (let attempt = 1; attempt <= MAX_OLLAMA_ATTEMPTS; attempt++) {
    lastResult = await callOllamaOnce(prompt, config);
    if (lastResult.ok) return lastResult;
    if (attempt < MAX_OLLAMA_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS));
    }
  }
  return lastResult;
}

/** MECHANICAL extraction, never evaluative: parses a strict YES/NO out of a model response.
 *  Deliberately narrow -- does not attempt to salvage a hedge ("probably yes", "not clearly") as
 *  either value; an ambiguous response is treated as NO (conservative: this cascade would rather
 *  under-count entailments and abstain than over-count them and pick wrong). This is a Boolean
 *  word parser, textually independent of plow_mc_answerer.ts's extractChosenLetterFromAuthorityText
 *  (an A-J letter parser) -- it does not replicate, loosen, or share any code path with that
 *  function. */
export function parseYesNo(text: string): boolean | null {
  const hasYes = /\byes\b/i.test(text);
  const hasNo = /\bno\b/i.test(text);
  if (hasYes && !hasNo) return true;
  if (hasNo && !hasYes) return false;
  return null; // both present, or neither -- ambiguous, never guessed
}

// ─── Per-option entailment (the ONE evaluative-shaped LLM use, kept narrow per Founder rule 3) ──

export type EntailmentMethod = 'mechanical_no_overlap' | 'llm_entailment_check' | 'llm_call_failed';

export interface OptionEntailment {
  letter: string;
  text: string;
  entailed: boolean;
  method: EntailmentMethod;
  detail: string;
  /** Present only for method === 'llm_entailment_check' -- the model's raw one-line answer, kept
   *  for inspectability (Founder requirement #5: "it must be possible to read afterward WHICH
   *  fact and WHICH rule selected the letter"). */
  rawModelAnswer?: string;
}

function buildEntailmentPrompt(fact: string, optionText: string): string {
  return (
    `FACT (from an authoritative source, quoted exactly, not to be reinterpreted):\n"${fact}"\n\n` +
    `CANDIDATE STATEMENT:\n"${optionText}"\n\n` +
    `Does the FACT, taken on its own and without adding outside knowledge, support the CANDIDATE ` +
    `STATEMENT as the single most complete and accurate match -- not merely a related idea, not a ` +
    `partial subset of what the FACT says, not a broader claim the FACT does not fully make? ` +
    `Answer with exactly one word: YES or NO.`
  );
}

/** Rule 12 (Founder, Excerpt 7): "categorize the possible answers" -- eliminate what shares
 *  nothing with the fact before ever asking the model. An option with ZERO content words in
 *  common with the fact cannot be the fact's best match by definition; this is decided by code,
 *  not by the model, and every option this gate excludes is recorded as such (never silently
 *  dropped). Options that pass this gate go to the one narrow LLM use this module makes: a
 *  single per-option YES/NO entailment check (Founder rule 3's explicitly sanctioned mechanical
 *  use), never a "here are N options, pick one" call. */
export async function evaluateOptionEntailment(
  fact: string,
  option: ProseCascadeOption,
  config: ProseCascadeConfig,
): Promise<OptionEntailment> {
  const factWords = contentWords(fact);
  const optionWords = contentWords(option.text);
  const overlap = overlapWords(factWords, optionWords);
  if (overlap.length === 0) {
    return {
      letter: option.letter,
      text: option.text,
      entailed: false,
      method: 'mechanical_no_overlap',
      detail: 'option shares 0 content words with the fact -- mechanically excluded, no LLM call made',
    };
  }

  const prompt = buildEntailmentPrompt(fact, option.text);
  const result = await callOllama(prompt, config);
  if (!result.ok) {
    return {
      letter: option.letter,
      text: option.text,
      entailed: false,
      method: 'llm_call_failed',
      detail: `entailment check could not be completed (${result.error}) -- treated as NOT entailed, never guessed`,
    };
  }
  const verdict = parseYesNo(result.text);
  return {
    letter: option.letter,
    text: option.text,
    entailed: verdict === true,
    method: 'llm_entailment_check',
    detail: verdict === null
      ? `model response did not parse to a clean YES/NO ("${result.text.slice(0, 120)}") -- ambiguous, treated as NOT entailed`
      : `model answered ${verdict ? 'YES' : 'NO'}`,
    rawModelAnswer: result.text.slice(0, 300),
  };
}

// ─── Top-level cascade ────────────────────────────────────────────────────────────────────────

export interface ProseCascadeResult {
  /** The recovered letter, or null on an honest abstain -- an abstain is a correct outcome, not
   *  a failure (Founder rule 4: "If the cascade over the fact does not converge on exactly one
   *  option, ABSTAIN. Do not fall back to asking anything to guess."). */
  letter: string | null;
  /** The fact this cascade reasoned over -- the authority's own prose, VERBATIM, never
   *  paraphrased by this module (Founder: "That doesn't answer my question, it's just a fact to
   *  eblet"). Null only when the groundedness gate rejected the prose outright. */
  fact: string | null;
  groundedness: GroundednessCheck;
  /** One entry per option that reached the entailment stage. Empty when the groundedness gate
   *  failed (the cascade never reaches per-option evaluation in that case). */
  perOptionEntailment: OptionEntailment[];
  /** Fixed, code-level rule -- never the model's own summary of what it decided. This is what
   *  makes the decision inspectable per Founder requirement #5. */
  decisionRule: string;
  abstainReason?: string;
  /** Always this module's fixed marker when `letter` is non-null -- see
   *  RECOVERED_LETTER_PROVENANCE's own doc comment for why this must never be dropped by a
   *  future caller. */
  provenance: typeof RECOVERED_LETTER_PROVENANCE;
}

/**
 * Recover an option letter from prose that the LITERAL extractor (extractChosenLetterFromAuthorityText
 * / matchFreeTextAnswerToOption, both in plow_mc_answerer.ts, both untouched by this file) could
 * not parse a letter from. MUST be called only as a fallback, only after the literal extractor
 * has already returned nothing, and only when `prose` is non-empty -- this function does not
 * itself check that precondition (it has no way to invoke the literal extractor without importing
 * from the forbidden file), so the caller is responsible for that ordering. See this file's own
 * header for the exact reason this is not yet wired to any such caller.
 *
 * Never invents a letter: the decision is a fixed rule (exactly one option entailed => that
 * letter; zero or >=2 => abstain), evaluated over per-option judgments that are each independently
 * inspectable via the returned `perOptionEntailment` array. The model is never asked to choose
 * among options -- see evaluateOptionEntailment's own doc comment for the one narrow, per-option,
 * YES/NO use it is allowed.
 */
export async function recoverLetterFromProse(
  prose: string,
  question: string,
  options: ProseCascadeOption[],
  config: ProseCascadeConfig = {},
): Promise<ProseCascadeResult> {
  const trimmedProse = prose.trim();
  const groundedness = checkGroundedness(trimmedProse, question);

  if (!groundedness.passed) {
    return {
      letter: null,
      fact: null,
      groundedness,
      perOptionEntailment: [],
      decisionRule: 'groundedness gate failed -- cascade never reached per-option evaluation',
      abstainReason: groundedness.reason,
      provenance: RECOVERED_LETTER_PROVENANCE,
    };
  }

  // The FACT is the prose itself, unmodified -- per Founder rule 1, this is recorded as a fact
  // with provenance, never re-voted or paraphrased into a new claim.
  const fact = trimmedProse;

  // SEQUENTIAL, not Promise.all: the live proof harness (D-BP149-027) measured spurious empty
  // responses and AbortErrors from the local Ollama server under 10-way concurrent load against
  // a single-GPU dev machine that also has llama3.3:70b and llama3.1:8b loaded. Running one
  // request at a time is slower but honest -- a fallback path only reachable after the literal
  // extractor already failed is not on any hot latency budget, and a spurious 'llm_call_failed'
  // here silently under-counts entailments, which can only ever bias this cascade toward
  // abstaining more, never toward inventing a wrong letter (see evaluateOptionEntailment's own
  // fail-closed handling).
  const perOptionEntailment: OptionEntailment[] = [];
  for (const opt of options) {
    perOptionEntailment.push(await evaluateOptionEntailment(fact, opt, config));
  }

  const entailedOptions = perOptionEntailment.filter((e) => e.entailed);

  if (entailedOptions.length === 1) {
    return {
      letter: entailedOptions[0].letter,
      fact,
      groundedness,
      perOptionEntailment,
      decisionRule: 'exactly one option entailed by the fact -- selected',
      provenance: RECOVERED_LETTER_PROVENANCE,
    };
  }

  const abstainReason = entailedOptions.length === 0
    ? 'zero options were entailed by the fact -- the fact does not clearly denote any listed option (honest abstain, not a guess)'
    : `${entailedOptions.length} options were entailed by the fact ([${entailedOptions.map((e) => e.letter).join(', ')}]) -- ambiguous, cascade did not converge on a single option (honest abstain, not a guess)`;

  return {
    letter: null,
    fact,
    groundedness,
    perOptionEntailment,
    decisionRule: 'decision rule requires EXACTLY one entailed option; abstain otherwise',
    abstainReason,
    provenance: RECOVERED_LETTER_PROVENANCE,
  };
}
