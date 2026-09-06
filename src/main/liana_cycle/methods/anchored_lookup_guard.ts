// methods/anchored_lookup_guard.ts -- D-BP213-XO-35/BISHOP-XO/seg-composer-methods, LEG 1 OF 4
//
// FOUNDER ORDER, BP213, 2026-09-03T03:48:43Z, verbatim: "make more methods using didasko, into the
// liana cycle ... then start using the methods on the question sets, ONE LEG AT A TIME, so we can
// make this provable and ship it." This file is LEG 1 ONLY -- the ANCHORED-LOOKUP GUARD, drafted at
// D-BP213-XO-32_FOUR_METHOD_SPECS.md, METHOD 1. Legs 2-4 (SET-EQUIVALENCE MATCH, UMBRELLA-OR-SCHOOL
// CHECK, CONVENTION-LOCKED RECOMPUTE) are NOT built here, per explicit dispatch scope.
//
// THE FAILURE SHAPE THIS CATCHES (not the qid-46 economics content itself -- see TRIGGER below for
// why this generalizes): a solver derives the correct COMPOUND answer internally -- a tuple of two
// or more independently classified sub-parts -- then fails a simple lookup against the option list
// because it is holding a previously-seen or previously-suggested letter in mind, and reports "no
// option matches" when an exact match is sitting in the list. Round 1's own record (D-BP213-XO-32
// spec, METHOD 1) shows the flagship deriving (supply, quantity supplied, quantity supplied)
// internally and then saying, three times, "that combination is not among options A-J" -- when
// option I was an exact match.
//
// WHAT THIS METHOD MECHANICALLY ADDS, PER THE SPEC (steps 1-7 of METHOD 1's PROCEDURE):
//   1. Extract every stem sub-part requiring classification WITHOUT reading the option list at all
//      (mask it out during derivation -- this is native to options-withheld operation, not merely
//      compatible with it, per the spec's own closing note on Method 1).
//   2. Classify each sub-part independently; if a sub-part genuinely supports two legitimate
//      readings, carry BOTH forward as separate candidate tuples rather than collapsing early.
//   3. Only THEN reveal the option list.
//   4. Compare every candidate tuple against EVERY option row by exact, mechanical, token-level
//      match -- never from recall while a letter is already in mind, never stopping at the first
//      plausible row.
//   5. Exactly one match -> that letter.
//   6. More than one match (a genuine fork) -> report every matching letter, do not force a pick.
//   7. Zero matches -> output NONE MATCH and STOP -- never fall back to a letter shown earlier, never
//      infer what the test author probably meant.
//
// THE TRIGGER GENERALIZES -- IT NAMES A SHAPE, NOT qid 46 OR DATASET ID 7260. shapeTest() below
// fires on ANY lettered-MCQ question whose stem carries two or more sub-part labels (the (a)/(b)/(c)
// or (i)/(ii) or numbered-clause convention any compound-classification question uses) AND whose
// option rows are themselves comma/semicolon-separated tuples of matching arity. Nothing in
// shapeTest() names qid 46, dataset id 7260, economics, supply/demand, or any domain-specific
// vocabulary -- the domain classification itself is delegated to the model's own general knowledge
// per sub-part (see run(), step 2), never to a hardcoded fact table scoped to one question. If this
// were only ever going to match the one worked example, it would be a fit, not a method; the
// structural gate (sub-label count + tuple-arity option rows) is what is asserted to generalize, and
// that assertion is the one honest claim this file makes -- it has not been run against a held-out
// set (see the spec's own FALSIFIER 1, which this file inherits unresolved).
//
// WHAT IS NOT ESTABLISHED, CARRIED FORWARD FROM THE SPEC RATHER THAN SILENTLY DROPPED: the spec's
// own TRIGGER section is explicit that "seeing the options first CAUSES the missed lookup" is an
// unproven causal claim (round 1's own proposed re-ask-with-options-withheld test was never shown
// executed with a result). This file therefore treats EVERY compound-tuple question as at-risk and
// always runs the guard, rather than trying to detect when anchoring will specifically occur --
// exactly the spec's own instruction ("treat every compound-tuple question as at-risk, not just ones
// where anchoring has been separately confirmed").
//
// ABSTENTION IS THE DEFAULT, NOT AN EDGE CASE. Per this dispatch's hard rule 1: this method abstains
// whenever its own procedure does not reach a single confident survivor -- zero matches, more than
// one match (an honest fork), a parse failure on the model's per-sub-part classification, more than
// one sub-part forking (see run() for why that specific case abstains rather than enumerating a full
// cross product), or any thrown exception. An abstention here is a defect signal, never smoothed
// into a guess.
//
// NEVER READS input.correctAnswer TO SELECT. Grep this file for "correctAnswer" and confirm the only
// occurrences are in this sentence and this header -- matches every sibling method's hard
// constraint, and matters specifically here because this method's whole point is verifying a lookup
// against the OPTION LIST, not the answer key.
//
// Rule 66: new file, no supersede needed. No em-dashes -- "--" used throughout. American spelling.

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput, MethodRunContext, ShapeTestResult } from '../method_registry';
import type { LianaTerminalOutcome } from '../../../shared/liana_cycle/liana_terminal_types';
import { recordLlmCall } from '../cost_instrument';
import { resolveGemmaModelDigest, GEMMA_NUM_CTX_RUN_CAP } from './comparative_cascade';
import os from 'node:os';

const OLLAMA_API_BASE = process.env.OLLAMA_API_BASE ?? 'http://127.0.0.1:11434';
// Same env-overridable model tag convention every sibling gemma-calling method uses -- no second,
// diverging model-selection mechanism introduced here.
const MODEL = process.env.CASCADE_MODEL ?? 'gemma4:12b';

function nowIso(): string {
  return new Date().toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// SHAPE DETECTION HELPERS -- shared, pure, by shapeTest() and run() so the two never disagree on
// what counts as a sub-part label or a tuple-shaped option row.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** Matches a parenthesized sub-part label: (a), (b), (iii), (2), case-insensitive. This is the
 *  general convention for a labeled sub-part in a compound-classification stem, not a pattern
 *  scoped to any one question's own lettering. */
const SUBPART_LABEL_RE = /\(([a-hA-H]|[ivx]{1,4}|[1-9])\)/g;

interface SubpartLabelMatch {
  label: string;
  index: number;
}

function findSubpartLabels(question: string): SubpartLabelMatch[] {
  const out: SubpartLabelMatch[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  SUBPART_LABEL_RE.lastIndex = 0;
  while ((m = SUBPART_LABEL_RE.exec(question)) !== null) {
    const label = m[1].toLowerCase();
    // Only the FIRST occurrence of a given label marks a sub-part boundary -- a later reuse of
    // "(a)" deeper in the stem (e.g. referring back to sub-part a) is not a new boundary.
    if (!seen.has(label)) {
      seen.add(label);
      out.push({ label, index: m.index });
    }
  }
  return out;
}

/** Slices the stem into one text span per sub-part label, from each label's own position to the
 *  next label's position (or end of string for the last one). Pure string slicing, no I/O. */
function extractSubpartTexts(question: string, labels: SubpartLabelMatch[]): { label: string; text: string }[] {
  const sorted = [...labels].sort((a, b) => a.index - b.index);
  return sorted.map((lbl, i) => {
    const start = lbl.index;
    const end = i + 1 < sorted.length ? sorted[i + 1].index : question.length;
    return { label: lbl.label, text: question.slice(start, end).trim() };
  });
}

/** Splits one option's text into its comma/semicolon-separated clauses, trimmed, empties dropped.
 *  This is the "tuple" a compound option row represents. Pure, no I/O. */
function splitOptionIntoTuple(optionText: string): string[] {
  return optionText
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Normalizes one clause for exact-but-forgiving comparison: lowercase, collapse whitespace, strip
 *  a trailing period, strip surrounding quotes. Still an EXACT comparison after normalization --
 *  never a fuzzy/substring match, per the spec's own step 4 discipline. */
function normalizeClause(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[."'‘’“”]+$/g, '')
    .replace(/^[."'‘’“”]+/g, '');
}

function tuplesExactlyEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (normalizeClause(a[i]) !== normalizeClause(b[i])) return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// shapeTest -- THE TRIGGER. Pure, no I/O, never reads input.correctAnswer.
// ─────────────────────────────────────────────────────────────────────────────────────────────

function shapeTest(input: MethodQuestionInput): ShapeTestResult {
  if (!input.options || Object.keys(input.options).length < 2) {
    return {
      matches: false,
      reason: 'no lettered option list with >=2 rows -- anchored-lookup-guard is a mechanical '
        + 'row-by-row lookup check, it needs option ROWS to guard the lookup against and refuses '
        + 'a free-text question honestly rather than guessing a shape from the stem alone.',
    };
  }

  const question = input.question || '';
  const labels = findSubpartLabels(question);
  if (labels.length < 2) {
    return {
      matches: false,
      reason: `only ${labels.length} distinct sub-part label(s) found in the stem (looked for `
        + '(a)/(b)/(c), (i)/(ii)/(iii), or (1)/(2)/(3) style markers) -- this method targets a '
        + 'COMPOUND stem requiring two or more independently classified sub-parts; a single-part '
        + 'question is out of scope, refused rather than force-fit.',
    };
  }

  const optionValues = Object.values(input.options);
  const tupleShapedCount = optionValues.filter((v) => splitOptionIntoTuple(v).length === labels.length).length;
  const tupleShapedFraction = tupleShapedCount / optionValues.length;
  if (tupleShapedFraction < 0.5) {
    return {
      matches: false,
      reason: `stem has ${labels.length} sub-part labels, but only ${tupleShapedCount} of `
        + `${optionValues.length} option rows split (on commas/semicolons) into exactly `
        + `${labels.length} clauses -- option rows are not consistently tuple-shaped to match the `
        + 'sub-part count, so a mechanical tuple-vs-tuple lookup would not be meaningful here; '
        + 'refuses rather than guessing a false structural match.',
    };
  }

  return {
    matches: true,
    reason: `${labels.length} distinct sub-part labels found in the stem `
      + `(${labels.map((l) => `(${l.label})`).join(', ')}) and ${tupleShapedCount}/`
      + `${optionValues.length} option rows are tuple-shaped with matching arity -- eligible for a `
      + 'masked-derivation-then-mechanical-lookup guard against anchoring on a previously-shown '
      + 'letter.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// The masked classification call -- step 1-2 of the procedure. Asks the model to classify EACH
// sub-part independently, WITHOUT ever showing it the option list, using its own general domain
// knowledge (this file teaches no domain-specific fact table -- see header on why that is a
// deliberate scope choice, not an oversight). Allows a sub-part to report two legitimate readings
// rather than collapsing early, per the spec's own instruction.
// ─────────────────────────────────────────────────────────────────────────────────────────────

interface MaskedClassifyResult {
  ok: boolean;
  text: string | null;
  detail?: string;
}

async function callModelMasked(prompt: string): Promise<MaskedClassifyResult> {
  const tsStart = nowIso();
  const t0 = Date.now();
  const modelDigest = await resolveGemmaModelDigest(MODEL);
  let res: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    res = await fetch(`${OLLAMA_API_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false,
        think: false,
        options: { temperature: 0.3, num_predict: 400, num_ctx: GEMMA_NUM_CTX_RUN_CAP },
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
  } catch (err) {
    const detail = `transport failure, no HTTP response received: ${err instanceof Error ? err.message : String(err)}`;
    recordLlmCall({
      model: MODEL,
      modelDigest,
      machineId: os.hostname(),
      ts_start: tsStart,
      ts_end: nowIso(),
      latency_ms: Date.now() - t0,
      tokens: { measured: false, reason: detail },
    });
    return { ok: false, text: null, detail };
  }
  if (res.ok === false) {
    const detail = `HTTP ${res.status} error response from Ollama`;
    recordLlmCall({
      model: MODEL,
      modelDigest,
      machineId: os.hostname(),
      ts_start: tsStart,
      ts_end: nowIso(),
      latency_ms: Date.now() - t0,
      tokens: { measured: false, reason: detail },
    });
    return { ok: false, text: null, detail };
  }
  try {
    const j = (await res.json()) as { response?: string; prompt_eval_count?: number; eval_count?: number };
    const hasCounts = typeof j.prompt_eval_count === 'number' && typeof j.eval_count === 'number';
    recordLlmCall({
      model: MODEL,
      modelDigest,
      machineId: os.hostname(),
      ts_start: tsStart,
      ts_end: nowIso(),
      latency_ms: Date.now() - t0,
      tokens: hasCounts
        ? { measured: true, input_tokens: j.prompt_eval_count as number, output_tokens: j.eval_count as number }
        : { measured: false, reason: 'Ollama response body did not include prompt_eval_count/eval_count fields' },
    });
    const text = (j.response ?? '').trim();
    if (text.length === 0) {
      return { ok: false, text: null, detail: 'Ollama returned an empty response field' };
    }
    return { ok: true, text };
  } catch (err) {
    const detail = `res.json() itself threw, body was not JSON: ${err instanceof Error ? err.message : String(err)}`;
    recordLlmCall({
      model: MODEL,
      modelDigest,
      machineId: os.hostname(),
      ts_start: tsStart,
      ts_end: nowIso(),
      latency_ms: Date.now() - t0,
      tokens: { measured: false, reason: detail },
    });
    return { ok: false, text: null, detail };
  }
}

function buildMaskedPrompt(subparts: { label: string; text: string }[]): string {
  const lines = subparts
    .map((sp) => `(${sp.label}) ${sp.text}`)
    .join('\n');
  return 'You are classifying each labeled sub-part below using the standard analytical framework '
    + 'implied by its own domain (for example, standard supply/demand shift classification in '
    + 'economics, or the equivalent standard vocabulary for whatever domain the sub-part names). Do '
    + 'NOT look ahead to any answer options -- there are none shown to you, on purpose. Classify each '
    + 'sub-part independently; do not let one sub-part\'s classification influence another\'s.\n\n'
    + 'For EACH sub-part, output exactly one line in the form:\n'
    + '<label>: <classification>\n'
    + 'using the shortest standard term(s) the domain itself uses (e.g. "supply", "demand", '
    + '"quantity supplied", "quantity demanded"), separated by commas if a sub-part\'s answer is '
    + 'itself a short sequence of terms. If, and ONLY if, a sub-part genuinely supports two equally '
    + 'legitimate standard readings, output both on the same line separated by the literal word OR, '
    + 'e.g. "b: supply OR quantity supplied". Do not add any other text, explanation, or preamble.\n\n'
    + `Sub-parts:\n${lines}`;
}

/** Parses lines of the form "<label>: <value>" (value may contain " OR " to mean two candidate
 *  readings) into a map from label to 1-2 candidate reading strings. Returns null on any parse
 *  failure for a required label -- callers treat that as grounds to abstain, never to guess. */
function parseMaskedResponse(
  text: string,
  requiredLabels: string[],
): Map<string, string[]> | null {
  const out = new Map<string, string[]>();
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  for (const line of lines) {
    const m = /^\(?([a-hA-H]|[ivx]{1,4}|[1-9])\)?\s*[:.\)]\s*(.+)$/.exec(line);
    if (!m) continue;
    const label = m[1].toLowerCase();
    if (!requiredLabels.includes(label)) continue;
    const readings = m[2]
      .split(/\bOR\b/i)
      .map((r) => r.trim())
      .filter((r) => r.length > 0);
    if (readings.length > 0) {
      out.set(label, readings);
    }
  }
  for (const lbl of requiredLabels) {
    if (!out.has(lbl)) return null;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// run -- steps 3-7 of the procedure: reveal the options, build every candidate tuple, do the
// mechanical exact-match lookup, and decide winner / fork / none-match. NEVER reads
// input.correctAnswer.
// ─────────────────────────────────────────────────────────────────────────────────────────────

async function run(input: MethodQuestionInput, ctx: MethodRunContext): Promise<LianaTerminalOutcome> {
  const question = input.question || '';
  const options = input.options || {};

  try {
    const labels = findSubpartLabels(question);
    const subparts = extractSubpartTexts(question, labels);
    const requiredLabels = subparts.map((s) => s.label);

    ctx.emit({
      kind: 'stage',
      text: `   anchored-lookup-guard: masking options, deriving ${subparts.length} sub-part `
        + `classification(s) independently (${requiredLabels.map((l) => `(${l})`).join(', ')})`,
      ts: nowIso(),
    });

    const maskedPrompt = buildMaskedPrompt(subparts);
    const modelResp = await callModelMasked(maskedPrompt);
    if (!modelResp.ok || !modelResp.text) {
      return {
        question,
        verdict: null,
        abstain: true,
        freeText: false,
        method: 'anchored-lookup-guard',
        basis: `masked classification call failed before any lookup could run: ${modelResp.detail ?? 'unknown failure'}`,
      };
    }

    ctx.emit({
      kind: 'note',
      text: `   anchored-lookup-guard masked classification raw response: "${modelResp.text}"`,
      ts: nowIso(),
    });

    const perSubpart = parseMaskedResponse(modelResp.text, requiredLabels);
    if (!perSubpart) {
      return {
        question,
        verdict: null,
        abstain: true,
        freeText: false,
        method: 'anchored-lookup-guard',
        basis: 'masked classification response could not be parsed into one reading per required '
          + `sub-part (needed: ${requiredLabels.join(', ')}) -- refuses rather than guessing a `
          + `missing sub-part's classification. Raw response: "${modelResp.text}"`,
      };
    }

    const forkingLabels = requiredLabels.filter((l) => (perSubpart.get(l) as string[]).length > 1);
    if (forkingLabels.length > 1) {
      return {
        question,
        verdict: null,
        abstain: true,
        freeText: false,
        method: 'anchored-lookup-guard',
        basis: `${forkingLabels.length} sub-parts (${forkingLabels.join(', ')}) each reported two `
          + 'legitimate readings -- enumerating the full cross product risks silently guessing among '
          + 'combinations the model never actually endorsed together; abstains rather than picking '
          + 'an unverified combination (this is a deliberate scope limit of this build, not part of '
          + 'the original spec, and is flagged as such).',
      };
    }

    // Build the 1 or 2 candidate tuples, in requiredLabels order.
    const candidateTuples: string[][] = [];
    const maxReadings = forkingLabels.length === 0 ? 1 : 2;
    for (let readingIdx = 0; readingIdx < maxReadings; readingIdx += 1) {
      const tuple = requiredLabels.map((lbl) => {
        const readings = perSubpart.get(lbl) as string[];
        return readings[Math.min(readingIdx, readings.length - 1)];
      });
      candidateTuples.push(tuple);
    }

    ctx.emit({
      kind: 'fact',
      text: '   anchored-lookup-guard candidate tuple(s) derived with options still masked: '
        + candidateTuples.map((t, i) => `reading ${i + 1} = (${t.join(', ')})`).join('; '),
      ts: nowIso(),
    });

    ctx.emit({
      kind: 'stage',
      text: '   anchored-lookup-guard: revealing option list now, running exact row-by-row lookup '
        + '(never from recall, never stopping at the first plausible row)',
      ts: nowIso(),
    });

    const matchTable: { letter: string; candidateIndex: number }[] = [];
    for (const [letter, optionText] of Object.entries(options)) {
      const rowTuple = splitOptionIntoTuple(optionText);
      if (rowTuple.length !== requiredLabels.length) {
        ctx.emit({
          kind: 'note',
          text: `   option ${letter}: "${optionText}" -- ${rowTuple.length} clause(s), does not `
            + `match arity ${requiredLabels.length}, skipped from the lookup table`,
          ts: nowIso(),
        });
        continue;
      }
      let anyMatch = false;
      candidateTuples.forEach((cand, idx) => {
        const isMatch = tuplesExactlyEqual(cand, rowTuple);
        if (isMatch) {
          anyMatch = true;
          matchTable.push({ letter, candidateIndex: idx });
        }
        ctx.emit({
          kind: 'note',
          text: `   option ${letter} vs reading ${idx + 1}: (${rowTuple.join(', ')}) -- `
            + `${isMatch ? 'MATCH' : 'no match'}`,
          ts: nowIso(),
        });
      });
      void anyMatch;
    }

    const matchedLetters = Array.from(new Set(matchTable.map((m) => m.letter)));

    if (matchedLetters.length === 0) {
      return {
        question,
        verdict: null,
        abstain: true,
        freeText: false,
        method: 'anchored-lookup-guard',
        basis: 'NONE MATCH: every option row was compared exactly against every candidate tuple '
          + `derived with the options masked (${candidateTuples.map((t) => `(${t.join(', ')})`).join(' / ')}) `
          + 'and zero rows matched. Per the guard\'s own step 7, this stops here rather than falling '
          + 'back to any letter shown earlier or inferring authorial intent.',
      };
    }

    if (matchedLetters.length > 1) {
      return {
        question,
        verdict: null,
        abstain: true,
        freeText: false,
        method: 'anchored-lookup-guard',
        basis: `genuine fork, not resolved by the option list: letters ${matchedLetters.join(', ')} `
          + `each exactly matched a candidate tuple derived with options masked `
          + `(${candidateTuples.map((t) => `(${t.join(', ')})`).join(' / ')}). Reporting both rather `
          + 'than forcing a single pick, per the guard\'s own step 6.',
      };
    }

    const winner = matchedLetters[0];
    return {
      question,
      verdict: winner,
      abstain: false,
      freeText: false,
      method: 'anchored-lookup-guard',
      basis: `sub-parts (${requiredLabels.join(', ')}) were classified independently with the option `
        + `list masked, yielding candidate tuple ${candidateTuples.length > 1 ? 'set' : ''} `
        + `${candidateTuples.map((t) => `(${t.join(', ')})`).join(' / ')}; option ${winner} was the `
        + 'single exact row-by-row match once the option list was revealed.',
    };
  } catch (e) {
    return {
      question,
      verdict: null,
      abstain: true,
      freeText: false,
      method: 'anchored-lookup-guard',
      basis: `anchored-lookup-guard threw: ${String((e as Error)?.message ?? e)}`,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE LianaMethod OBJECT
// ─────────────────────────────────────────────────────────────────────────────────────────────

export const anchoredLookupGuardMethod: LianaMethod = {
  id: 'anchored-lookup-guard',
  demand: 'CLASSIFY',
  name: 'Anchored-Lookup Guard (masks the option list while deriving a compound classification '
    + 'tuple sub-part by sub-part, then runs an exact, mechanical row-by-row match against every '
    + 'revealed option -- refuses to fall back to a previously-shown letter)',
  taughtBy: 'D-BP213-XO-32_FOUR_METHOD_SPECS.md, METHOD 1, drawn from the Didasko Round 1 record '
    + '(qid 46, dataset id 7260, "the option-I finding") -- a flagship derived the correct compound '
    + 'answer (supply, quantity supplied, quantity supplied) internally and said three times "that '
    + 'combination is not among options A-J" when option I was an exact match. Wired in by '
    + 'D-BP213-XO-35/BISHOP-XO, Founder order 2026-09-03T03:48:43Z ("make more methods using '
    + 'didasko ... one leg at a time"). The trigger for THIS SHAPE being present (compound-tuple '
    + 'stem + tuple options) is solid per the spec; the causal claim that seeing the options first '
    + 'is what CAUSES the miss is explicitly flagged by the spec as unproven and is not re-asserted '
    + 'here -- this method treats every compound-tuple question as at-risk rather than claiming to '
    + 'detect when anchoring will actually occur.',
  shapeDescription: 'a lettered MCQ question whose stem carries two or more labeled sub-parts '
    + '((a)/(b)/(c), (i)/(ii), or (1)/(2) style) and whose option rows are themselves comma- or '
    + 'semicolon-separated tuples of matching arity -- refuses honestly on a single-part stem, a '
    + 'free-text question, non-tuple-shaped options, an unparseable masked classification, more '
    + 'than one simultaneously forking sub-part, or a lookup that resolves to zero or more than one '
    + 'matching option row.',
  shapeTest,
  run,
};

// Registers at import time, same convention as every other method module. The registerMethod()
// call alone is NOT sufficient to make this method reachable -- liana_terminal_engine.ts's own
// side-effect import block (currently ending at './methods/law_of_cosines_cascade') must ALSO
// import this file, which is done in the same dispatch as a separate one-line edit to that file.
registerMethod(anchoredLookupGuardMethod);
