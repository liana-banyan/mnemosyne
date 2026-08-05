// plow_mc_elimination_cascade.ts -- KN-BP141-3 Stage 2: Elimination Cascade with Bidirectional
// Consistency.
//
// Founder-directed, BP141. Encodes the Founder's five-stage elimination procedure (C1-C5). Stage 2
// of four (Stage 0: plow_mc_question_vetting.ts, Stage 1: plow_mc_elimination_chart.ts, Stage 3:
// plow_gom_jabbar.ts).
//
// EVERY function in this file is pure and synchronous -- it never queries a model, a browser, or
// any external source itself. The actual "asking" (querying a source for its most-to-least/
// least-to-most ranking, or for its cut/pick vote) is the CALLER's job, exactly like
// runCakeMethodDisagreementResolution's own CakeCutCandidate convention in plow_mc_answerer.ts and
// solveNoConsensusFromScatter's own IndependentSourceVote convention in
// plow_mc_no_consensus_solver.ts -- this module only ever consumes caller-supplied rankings/votes
// and applies the Founder's own consistency/acceptance math to them.
//
// HONEST GAP, CLOSED THIS TICKET FOR resolveDeterministicComputeOverride (KN-BP141-10, Founder-
// directed BP141): KN-BP141-3's own note above ("no harness in this repo actually dispatches a
// most-to-least AND a least-to-most ranking QUERY... inside the answering pipeline itself") and
// KN-BP141-7's own wiring note (the SAME dispatch, but only as a Cake Method candidate producer,
// reached only when authorities already disagree) are both superseded for the NEW call site added
// this ticket: plow_mc_answerer.ts's resolveDeterministicComputeOverride now dispatches this exact
// C1/C4/C5 mechanism as a format-independent FALLBACK tier, positioned AFTER every named parsing
// solver and BEFORE the generic reasoning-text extraction tier -- see that file's
// runEliminationCascadeFormatIndependentFallback for the live dispatch harness (still the caller's
// job, per this file's own contract above; this file remains pure). The gate/helper functions below
// (evaluateFormatIndependentFallbackGate, extractLetterRankingSequence, extractNumericOptionValues,
// CascadeSourceCapture/buildCascadeSourceCapture) are additive to this file specifically to support
// that new call site without requiring the caller to reimplement pure logic that belongs here.
//
// Rule 66: version, never overwrite -- new file, no supersede needed. No em-dashes anywhere in
// this file (or its comments) -- "--" used throughout per Rule 66.

import { extractNumber } from './compute_sidecar';
import { extractStemConcept, determineStemPolarity } from './plow_mc_elimination_chart';

// ─── C1: ASK THE INVERSE ────────────────────────────────────────────────────────────────────────
//
// Querying the complement sidesteps the negation that trips models on NOT/EXCEPT questions: asking
// "which of these IS X" and inverting the result is often more reliable than asking "which of
// these is NOT X" directly, because the negation itself is what a model's own attention mechanism
// tends to drop. This is a pure TEXT-TRANSFORM helper -- it does not decide whether inversion
// actually improves accuracy on any given question (that would require live A/B evidence this repo
// does not have); it only provides the mechanical, reversible transform a caller can use to build
// the inverse query.

export interface NegationDetection {
  isNegated: boolean;
  negationType: 'NOT' | 'EXCEPT' | null;
}

const NOT_QUALIFIER_RE = /\b(is|are|would be|does|do|can|could|should)\s+not\b/i;
const EXCEPT_QUALIFIER_RE = /\bexcept\b/i;

/** Detects whether a question stem carries an explicit NOT or EXCEPT polarity qualifier (the shape
 *  that trips models via negation-blindness). Deliberately narrow: NOT_QUALIFIER_RE requires the
 *  negation to sit directly on a copula/modal verb ("is not", "would not be", etc.), not a bare
 *  "not" occurring anywhere in the stem's prose (which would over-fire on ordinary sentences that
 *  happen to contain the word "not" for an unrelated reason). */
export function detectNegationQuestion(stemText: string): NegationDetection {
  if (EXCEPT_QUALIFIER_RE.test(stemText)) return { isNegated: true, negationType: 'EXCEPT' };
  if (NOT_QUALIFIER_RE.test(stemText)) return { isNegated: true, negationType: 'NOT' };
  return { isNegated: false, negationType: null };
}

/** Builds the COMPLEMENT framing of a negated stem -- "which... is NOT X" -> "which... IS X" -- so
 *  a caller can query a source for the affirmative set and invert the result itself. Returns null
 *  when the stem is not detected as negated (nothing to invert) or when the specific negation
 *  qualifier matched could not be mechanically stripped (an honest null, never a mangled string). */
export function buildInverseQueryFraming(stemText: string): string | null {
  const detection = detectNegationQuestion(stemText);
  if (!detection.isNegated) return null;

  if (detection.negationType === 'EXCEPT') {
    // "...are true EXCEPT for X" / "...following, EXCEPT..." -- EXCEPT constructions vary too much
    // to safely rewrite word-for-word; the mechanically SAFE inversion here is simply flagging that
    // the caller should query "which of the following IS true" (drop the "except" clause) and treat
    // every option the source affirms as a member of the affirmative set, with the true answer
    // being whichever option is NOT affirmed. No text mutation beyond removing the literal
    // "except"-led clause boundary marker itself is attempted, to avoid inventing wording the
    // question never had.
    return stemText.replace(/,?\s*except\b[\s\S]*$/i, '').trim();
  }

  // NOT-qualifier: strip the "not" directly, inverting is/are/would-be/does/do/can/could/should NOT
  // -> the same verb without "not". This is a mechanical, reversible transform (re-inserting "not"
  // after the same verb recovers the original stem byte-for-byte), never a paraphrase.
  return stemText.replace(NOT_QUALIFIER_RE, (_m, verb: string) => verb).trim();
}

// ─── C2: JAR METHOD ─────────────────────────────────────────────────────────────────────────────
//
// "Remove the largest-certainty blocks first, then the next size down. Softballs out before
// marbles." Given a set of candidate elimination BLOCKS (each block a group of option letters this
// stage is confident about removing together, e.g. Stage 1's own R1/R2/R3 outputs, or a source's
// own grouped ranking bands), this orders them for application: highest certainty first, ties
// broken by larger block size first (a big, easy, obvious block is a "softball" -- dispatch it
// before the smaller, harder-to-be-sure-about "marbles").

export interface EliminationBlock {
  letters: string[];
  certainty: number;
  label: string;
}

/** Pure sort -- does not itself decide whether to apply any block, only the ORDER a caller should
 *  consider/apply them in. Descending certainty first, descending block size as the tiebreaker. */
export function orderEliminationBlocksByCertainty(blocks: EliminationBlock[]): EliminationBlock[] {
  return [...blocks].sort((a, b) => {
    if (b.certainty !== a.certainty) return b.certainty - a.certainty;
    return b.letters.length - a.letters.length;
  });
}

// ─── C3: CAKE CUT HALF, ALTERNATING ─────────────────────────────────────────────────────────────
//
// Binary split, inverting direction each pass, re-including just-eliminated options as a control.
// Pass 1 asks about the FIRST half of the remaining set; pass 2 (after pass 1's half is
// provisionally set aside) asks about the SECOND half of what remains, inverting which end of the
// list gets asked about first; a final CONTROL pass re-includes the most-recently-set-aside half
// alongside a small sample of the currently-surviving set, to catch a source that would flip its
// answer back onto an option it had just claimed was eliminable (a bidirectional-consistency check
// at the OPTION-SET level, complementing C4's per-source RANKING-level check below).

export interface CakeCutPass {
  passNumber: number;
  direction: 'forward' | 'reverse' | 'control';
  askAbout: string[];
}

/** Pure sequence generator -- produces the split plan only, does not itself query anything or
 *  apply any result. `letters` should be the CURRENTLY SURVIVING option letters (e.g. Stage 1's
 *  own `survivors`), in their original left-to-right order. Returns [] for 0 or 1 surviving
 *  options (nothing left to split). */
export function generateCakeCutAlternatingSplits(letters: string[]): CakeCutPass[] {
  if (letters.length < 2) return [];
  const passes: CakeCutPass[] = [];
  const mid = Math.ceil(letters.length / 2);
  const firstHalf = letters.slice(0, mid);
  const secondHalf = letters.slice(mid);

  passes.push({ passNumber: 1, direction: 'forward', askAbout: firstHalf });
  if (secondHalf.length > 0) {
    passes.push({ passNumber: 2, direction: 'reverse', askAbout: secondHalf });
  }
  // Control: re-include the FIRST half (the one asked about first, and therefore the one whose
  // provisional elimination is oldest and most due for a consistency re-check) alongside the
  // second half, so a source that would now claim a member of the "control" first half is actually
  // still in play reveals an inconsistency with its own pass-1 answer.
  if (secondHalf.length > 0) {
    passes.push({ passNumber: 3, direction: 'control', askAbout: [...firstHalf, ...secondHalf] });
  }
  return passes;
}

// ─── C4: BIDIRECTIONAL CONSISTENCY (the strongest gate here) ────────────────────────────────────
//
// Ask most-to-least AND least-to-most. Require the two orderings to be EXACT reverses. A source
// that cannot reverse its own ranking does not know. Needs no ground truth and no second model --
// this is entirely a self-consistency check on ONE source's own two answers.

export interface BidirectionalConsistencyResult {
  source: string;
  consistent: boolean;
  mostToLeast: string[];
  leastToMost: string[];
  expectedLeastToMost: string[];
  trace: string;
  /** BP142: true when the source returned no ranking at all on one or both directions, so there
   *  was nothing to check. Distinct from `consistent: false`, which means the source DID answer
   *  twice and contradicted itself. Both are inadmissible; only this one is "never asked/never
   *  answered". Callers reporting a C5 pass rate must exclude these from the denominator rather
   *  than counting them as failures, or the rate describes transport health, not source quality. */
  noData: boolean;
}

/** Pure comparison: `leastToMost` must be the EXACT element-wise reverse of `mostToLeast` (same
 *  letters, same count, reversed order) -- not merely the same SET. A source that reverses its own
 *  ranking cleanly produces byte-identical arrays under this check; anything else (a dropped
 *  letter, a duplicated letter, a genuinely different internal ordering) is inadmissible, and this
 *  function reports exactly which positions disagree rather than only a bare true/false, so the
 *  failure is inspectable, never smoothed over. */
export function checkBidirectionalConsistency(
  source: string,
  mostToLeast: string[],
  leastToMost: string[],
): BidirectionalConsistencyResult {
  const expectedLeastToMost = [...mostToLeast].reverse();

  // BP142: an empty ranking must never read as a PASS. Without this guard, mostToLeast=[] and
  // leastToMost=[] satisfy the length check (0 === 0) and `.every()` on an empty array is
  // vacuously true, so a source that returned NOTHING was reported as having "reversed cleanly".
  // That is a gate lying about its own inputs. Timeouts are the common cause: at BP141 five of
  // fifteen real ranking calls exceeded even a 120s window and came back empty. Report what was
  // RECEIVED before reporting a verdict about it. Never widen a gate to force a pass.
  const noData = mostToLeast.length === 0 || leastToMost.length === 0;

  const consistent =
    !noData &&
    leastToMost.length === expectedLeastToMost.length &&
    leastToMost.every((letter, i) => letter === expectedLeastToMost[i]);

  let trace: string;
  if (noData) {
    const which =
      mostToLeast.length === 0 && leastToMost.length === 0
        ? 'both directions'
        : mostToLeast.length === 0
          ? 'the most-to-least direction'
          : 'the least-to-most direction';
    trace =
      `C4 NO DATA: source="${source}" returned no ranking on ${which} ` +
      `(mostToLeast=[${mostToLeast.join(',')}], leastToMost=[${leastToMost.join(',')}]). ` +
      `Inadmissible for this question. This is NOT a pass and NOT a self-contradiction; ` +
      `the source was never heard from.`;
  } else if (consistent) {
    trace = `C4 PASS: source="${source}" mostToLeast=[${mostToLeast.join(',')}] reverses cleanly to leastToMost=[${leastToMost.join(',')}]`;
  } else {
    const mismatches: string[] = [];
    const maxLen = Math.max(leastToMost.length, expectedLeastToMost.length);
    for (let i = 0; i < maxLen; i++) {
      const got = leastToMost[i] ?? '(missing)';
      const want = expectedLeastToMost[i] ?? '(missing)';
      if (got !== want) mismatches.push(`position ${i}: expected ${want}, got ${got}`);
    }
    trace =
      `C4 FAIL: source="${source}" mostToLeast=[${mostToLeast.join(',')}] does NOT reverse cleanly ` +
      `to the source's own leastToMost=[${leastToMost.join(',')}] -- expected=[${expectedLeastToMost.join(',')}], ` +
      `mismatches: ${mismatches.join('; ')}`;
  }

  return { source, consistent, mostToLeast, leastToMost, expectedLeastToMost, trace, noData };
}

/** Applies checkBidirectionalConsistency across every caller-supplied source ranking pair and
 *  partitions sources into admissible (consistent, its ranking may be used) vs inadmissible
 *  (FAILURE = that source's ranking is inadmissible, per the Founder's own framing -- this
 *  function never "averages away" or discounts a failure, it excludes that source's ranking
 *  entirely from the admissible set). Reports every source's real result, including a universal
 *  fail across all sources, without smoothing. */
export function runBidirectionalConsistencyGate(
  sourceRankings: Array<{ source: string; mostToLeast: string[]; leastToMost: string[] }>,
): { admissible: BidirectionalConsistencyResult[]; inadmissible: BidirectionalConsistencyResult[] } {
  const admissible: BidirectionalConsistencyResult[] = [];
  const inadmissible: BidirectionalConsistencyResult[] = [];
  for (const sr of sourceRankings) {
    const result = checkBidirectionalConsistency(sr.source, sr.mostToLeast, sr.leastToMost);
    if (result.consistent) admissible.push(result);
    else inadmissible.push(result);
  }
  return { admissible, inadmissible };
}

// ─── C5: TERMINATE ON THE NUMBER ────────────────────────────────────────────────────────────────
//
// Every stage above exists only to identify WHICH QUANTITY decides the question. Once the quantity
// is in hand it is arithmetic. If the deciding quantity is identifiable at the start, SKIP C1-C4
// and go straight here.
//
// ACCEPT CONDITION (Founder, significant-figures principle): the required precision is set by THE
// QUESTION, not by the instrument. A ruler wrong by a 64th still settles whether the foot fits the
// shoe. Accept when the winning margin exceeds the precision the question actually needs; abstain
// otherwise -- never demand more digits than the discrimination requires.
//
// MECHANISM: "the precision the question actually needs" is derived from the OPTION SET's own
// spacing, not from an arbitrary fixed tolerance -- half the smallest gap between any two distinct
// option values is the finest distinction the question's own answer choices actually require a
// computed value to resolve. A computed value need only land closer to one option than to every
// other option by at least that margin to be decisively attributable -- extra decimal digits of
// precision beyond that margin decide nothing the question is actually asking.

export interface OptionValue {
  letter: string;
  value: number;
}

/** The finest distinction the option set's OWN spacing requires: half the smallest gap between any
 *  two distinct sorted option values. Returns null when fewer than 2 distinct values exist (no
 *  discrimination is possible at all -- an honest null, not a fabricated zero). */
export function determineRequiredPrecision(options: OptionValue[]): number | null {
  const sortedValues = [...new Set(options.map((o) => o.value))].sort((a, b) => a - b);
  if (sortedValues.length < 2) return null;
  let minGap = Infinity;
  for (let i = 1; i < sortedValues.length; i++) {
    const gap = (sortedValues[i] as number) - (sortedValues[i - 1] as number);
    if (gap < minGap) minGap = gap;
  }
  return minGap / 2;
}

export interface SignificantFigureAcceptResult {
  accept: boolean;
  letter: string | null;
  requiredPrecision: number | null;
  winningMargin: number | null;
  trace: string;
}

/** Terminal C5 accept/abstain decision. Finds the option nearest to `computedValue`; accepts ONLY
 *  when that option is closer than the required precision AND strictly closer than every other
 *  option by at least the required-precision margin (never forced when the computed value sits
 *  ambiguously between two options, and never demanding more precision than the option set's own
 *  spacing needs -- see determineRequiredPrecision above). Returns accept=false (never guesses)
 *  when fewer than 2 distinct option values exist, or when the nearest option's margin does not
 *  clear the required precision. */
export function evaluateSignificantFigureAccept(
  computedValue: number,
  options: OptionValue[],
): SignificantFigureAcceptResult {
  const requiredPrecision = determineRequiredPrecision(options);
  if (requiredPrecision === null || options.length === 0) {
    return {
      accept: false,
      letter: null,
      requiredPrecision,
      winningMargin: null,
      trace: 'C5 ABSTAIN: fewer than 2 distinct option values -- no discrimination possible.',
    };
  }

  const withDistance = options
    .map((o) => ({ ...o, distance: Math.abs(o.value - computedValue) }))
    .sort((a, b) => a.distance - b.distance);
  const nearest = withDistance[0] as OptionValue & { distance: number };
  const secondNearest = withDistance[1] as (OptionValue & { distance: number }) | undefined;

  if (nearest.distance > requiredPrecision) {
    return {
      accept: false,
      letter: null,
      requiredPrecision,
      winningMargin: null,
      trace:
        `C5 ABSTAIN: nearest option ${nearest.letter} is ${nearest.distance} away from the computed ` +
        `value, exceeding the question's own required precision (${requiredPrecision}) -- the ` +
        `computed value does not land decisively on any option.`,
    };
  }

  const winningMargin = secondNearest ? secondNearest.distance - nearest.distance : Infinity;
  if (winningMargin < requiredPrecision) {
    return {
      accept: false,
      letter: null,
      requiredPrecision,
      winningMargin,
      trace:
        `C5 ABSTAIN: nearest option ${nearest.letter} and second-nearest option ${secondNearest?.letter ?? '(none)'} ` +
        `are within ${winningMargin} of each other, below the required precision (${requiredPrecision}) -- ` +
        `ambiguous, not forced.`,
    };
  }

  return {
    accept: true,
    letter: nearest.letter,
    requiredPrecision,
    winningMargin,
    trace:
      `C5 ACCEPT: nearest option ${nearest.letter} (distance ${nearest.distance}) clears the required ` +
      `precision (${requiredPrecision}) with a winning margin of ${winningMargin} over the next-nearest option.`,
  };
}

// ─── KN-BP141-10 C2: THE FORMAT-INDEPENDENT FALLBACK'S OWN GATE ────────────────────────────────
//
// "Trigger when every named parsing solver returned null AND the question offers a decidable
// quantity." The "every named parsing solver returned null" half is enforced structurally by this
// tier's POSITION in resolveDeterministicComputeOverride (C1 -- after every named solver, before
// the generic reasoning-text tier), never by anything in this file. This section is the OTHER
// half: does the question, on its own, offer a decidable quantity this fallback could go find --
// evaluated WITHOUT parsing this question's own specific prompt shape (that would just be another
// named parser). Two independent, mutually exclusive-or signals:
//
//   (1) NUMERIC OPTIONS -- at least 2 of the option texts carry distinct extractable numeric
//       values (extractNumber, reused from compute_sidecar.ts rather than re-implemented). This is
//       exactly the shape C5 (evaluateSignificantFigureAccept, above) already knows how to accept/
//       abstain against once a computed value is in hand.
//   (2) SUPERLATIVE/RANKING LANGUAGE, OR a NOT/EXCEPT qualifier (detectNegationQuestion, C1 above)
//       -- both stem shapes admit a RANKING of the options by some real-world quantity even when
//       that quantity is never spelled out as a number anywhere in the prompt. Worked example
//       (verification (b) below): "which world region is the most densely populated" -- population
//       density is the deciding quantity, but no option text states a number; the only way to
//       decide is to rank the options by it.
//
// HONEST LIMITATION (measured, not claimed complete -- Rule 66): this is a real heuristic gate, not
// a classifier proven to cover every one of the 10,956 corpus questions. A question with neither
// signal (no superlative/ranking language, no numeric options, no NOT/EXCEPT qualifier -- e.g. a
// bare factual-identification question like "what is the powerhouse of the cell") correctly does
// NOT fire this gate -- see this ticket's own verification (e) negative control. See verification
// (d) for the measured ceiling this gate produces on the full real corpus, reported honestly
// whatever it is.

const SUPERLATIVE_RE =
  /\b(most|least|highest|lowest|greatest|smallest|largest|biggest|densest|fastest|slowest|closest|nearest|farthest|furthest|warmest|coldest|oldest|newest|youngest|longest|shortest|heaviest|lightest|strongest|weakest|best|worst|maximum|minimum)\b/gi;

export interface OptionLike {
  letter: string;
  text: string;
}

/** Pulls every option whose text carries an extractable numeric value (extractNumber, reused
 *  verbatim from compute_sidecar.ts -- never re-implemented here). Options with no parseable
 *  number are silently skipped (not an error -- a mixed numeric/non-numeric option set is legal,
 *  e.g. one distractor phrased as prose); the returned list may therefore be shorter than
 *  `options`. */
export function extractNumericOptionValues(options: OptionLike[]): OptionValue[] {
  const out: OptionValue[] = [];
  for (const o of options) {
    const v = extractNumber(o.text);
    if (v !== null) out.push({ letter: o.letter, value: v });
  }
  return out;
}

export interface FormatIndependentFallbackGate {
  fires: boolean;
  numericOptionValues: OptionValue[];
  superlativeSignal: boolean;
  matchedSuperlativeTerms: string[];
  negationSignal: boolean;
  trace: string;
}

/** The gate itself -- pure, synchronous, no I/O. See this section's own header above for the full
 *  rationale on both signals and the honest-limitation note. `stemText` should be the bare
 *  question text (the SAME researchQueryForTiers convention every other tier/stage in this engine
 *  already uses, e.g. vetQuestion/runEliminationChart's own first parameter), never the options
 *  block appended to it. */
export function evaluateFormatIndependentFallbackGate(
  stemText: string,
  options: OptionLike[],
): FormatIndependentFallbackGate {
  const numericOptionValues = extractNumericOptionValues(options);
  const distinctNumericValues = new Set(numericOptionValues.map((o) => o.value)).size;
  const matchedSuperlativeTerms = [
    ...new Set([...stemText.matchAll(SUPERLATIVE_RE)].map((m) => (m[0] as string).toLowerCase())),
  ];
  const superlativeSignal = matchedSuperlativeTerms.length > 0;
  const negationSignal = detectNegationQuestion(stemText).isNegated;

  if (distinctNumericValues >= 2) {
    return {
      fires: true,
      numericOptionValues,
      superlativeSignal,
      matchedSuperlativeTerms,
      negationSignal,
      trace:
        `GATE FIRES (numeric options): ${distinctNumericValues} distinct numeric option values ` +
        `present -- a decidable quantity is directly evaluable via C5 significant-figure accept.`,
    };
  }
  if (superlativeSignal || negationSignal) {
    const parts: string[] = [];
    if (superlativeSignal) parts.push(`superlative language [${matchedSuperlativeTerms.join(',')}]`);
    if (negationSignal) parts.push('a NOT/EXCEPT qualifier');
    return {
      fires: true,
      numericOptionValues,
      superlativeSignal,
      matchedSuperlativeTerms,
      negationSignal,
      trace:
        `GATE FIRES (ranking signal): question stem carries ${parts.join(' and ')} -- options are ` +
        `rankable by a real-world quantity even though no option states one numerically.`,
    };
  }
  return {
    fires: false,
    numericOptionValues,
    superlativeSignal,
    matchedSuperlativeTerms,
    negationSignal,
    trace:
      'GATE ABSTAINS: fewer than 2 distinct numeric option values, no superlative/ranking ' +
      'language, no NOT/EXCEPT qualifier -- this question does not offer a decidable quantity ' +
      'this fallback can identify without parsing its own specific prompt shape.',
  };
}

// ─── KN-BP141-10: ranking-response parsing, extracted as a pure, general, EXPORTED helper ──────
//
// A deliberately simple first-appearance-order letter extraction (same convention and same
// documented edge case as plow_mc_answerer.ts's own KN-BP141-7 P6 local `extractLetterSequence`,
// which stays private to that file's Cake Method candidate producer and is NOT modified or reused
// here per the KN-BP141-10 ticket's own "do not clobber" instruction on that already-landed code)
// -- factored out here, as a NEW exported function, so this ticket's own format-independent
// fallback call site does not have to duplicate the regex inline. Honest limitation, recorded
// rather than hidden: a source that mentions the same letter early in unrelated prose before
// actually starting its ranking could pollute the sequence -- callers should compose their own
// prompt to ask for one letter per line, nothing else, specifically to keep this heuristic
// reliable in practice. */
export function extractLetterRankingSequence(raw: string | null, validLetters: Set<string>): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  const re = /\b([A-Z])\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const letter = m[1] as string;
    if (validLetters.has(letter) && !seen.has(letter)) {
      seen.add(letter);
      out.push(letter);
    }
  }
  return out;
}

// ─── C7: SOURCE CAPTURE IS MANDATORY ────────────────────────────────────────────────────────────
//
// "Every cascade query that returns a cited source records that URL with the claim it supported...
// Emit them in a shape the Liana Cycle can absorb as Fact eblets later. Do NOT build the absorption
// here; that is the next ticket. Just stop losing them." This section is that shape ONLY -- a plain
// data record and a pure constructor, no persistence, no substrate write, no eblet minting. The
// caller (plow_mc_answerer.ts) is responsible for actually dispatching a source capable of citing a
// URL (e.g. the browser-authority bridge's Perplexity lookup) and for not discarding the resulting
// CascadeSourceCapture[] once produced -- this file cannot enforce either of those on its own,
// exactly like every other "the asking is the caller's job" boundary in this file.

export interface CascadeSourceCapture {
  url: string;
  claim: string;
  query: string;
  source: string;
  capturedAt: string;
}

/** Pure constructor -- stamps `capturedAt` as an ISO timestamp at call time (the one small
 *  exception to this file's "pure" contract: a wall-clock read, never randomness, never I/O, never
 *  a decision that changes based on it). Returns null (never a fabricated capture) when `url` is
 *  empty/whitespace -- a caller must not manufacture a source capture for a source that returned
 *  no citation at all. */
export function buildCascadeSourceCapture(
  url: string,
  claim: string,
  query: string,
  source: string,
): CascadeSourceCapture | null {
  if (!url || url.trim().length === 0) return null;
  return { url, claim, query, source, capturedAt: new Date().toISOString() };
}

// ─── STAGE R: REGISTER RESOLUTION (KN-BP144-2) ──────────────────────────────────────────────────
//
// Founder-directed, BP144, Excerpt 7 (BP141 transcript, recovered BP144, session
// C:\Users\Administrator\.claude\projects\C--Users-Administrator-Documents\e68c0fd2-b6d7-49c5-8428-
// b874c5baf4ca.jsonl). Encodes steps 2-6 of the Founder's qid-85 hand walkthrough -- the step AFTER
// categorization (step 1, already covered by plow_mc_elimination_chart.ts's R1/R2/R3, Stage 1) and
// the step this engine's own six-of-six run-038 hand-application never reached: determine what
// REGISTER the stem's concept noun is being used in ("bias" means something different in statistics,
// sewing, electronics, and K-pop -- no definition eliminates anything until the register is known),
// infer that register from the OPTION TEXT (not the stem alone -- that is what he did: "I would
// guess from 'sample' being used in A, B, C, D, E, H, I..."), ADMIT the guess and VERIFY it with one
// targeted lookup (mandatory, never optional -- "How do I know that? I don't, I'm guessing. So I'll
// check." -- an unverified register guess is exactly the class of confident-wrong-answer this whole
// engine exists to eliminate), reduce the verified definition to a core predicate, and match
// surviving options against that predicate, logging every option's own match/fail reason (a bare
// "eliminated" fails this ticket).
//
// SAME CONTRACT AS EVERY OTHER STAGE IN THIS FILE: pure, synchronous, no I/O -- see this file's own
// header, lines 8-14. The actual lookup dispatch ("what is bias in statistics") is the CALLER's job,
// exactly like C4 consumes caller-supplied rankings and C5 consumes caller-supplied computed values.
// If the caller has no verification lookup to supply, this stage ABSTAINS -- it never proceeds on an
// unverified guess. That is a defect, not a fallback path, per the ticket's own instruction. This is
// also why this stage is buildable without touching plow_mc_answerer.ts (KN-BP144-2 Phase 1 finding):
// the mandatory-verification-or-abstain contract lives entirely inside this pure function's own
// gating, not in any live dispatch this file would otherwise need to reach out and perform itself.
//
// SCOPE, DELIBERATELY NARROW (Rule-66-style honesty, matching plow_mc_elimination_chart.ts's own
// CONCEPT_TARGET_PROPERTIES table): register signal words are curated per CONCEPT, keyed by the same
// stem concept noun plow_mc_elimination_chart.ts's own extractStemConcept already extracts
// (re-imported here, never reimplemented). A concept with no curated register table is an honest
// no-op, never a guess. The predicate-referent extraction (step 5) is, by contrast, deliberately
// GENERAL and register-agnostic -- it looks for "differs from / deviates from / relative to /
// compared with / difference between" clause shapes in whatever definitionText the caller's real
// lookup actually returned, and extracts the referent fresh each time. It does not hardcode
// "population," "bias," or anything specific to qid 85 anywhere in its pattern set (see KN-BP144-2
// Phase 0 report, item 3, for why this specific generality is the ticket's actual deliverable).

export interface RegisterCandidate {
  register: string;
  matchedSignalWords: string[];
  optionsCarryingSignal: string[];
}

export interface RegisterVerificationLookup {
  /** The exact query issued, e.g. "what is bias in statistics" -- should name both the concept and
   *  the guessed register, mirroring the Founder's own step 4 query shape. Never constructed by this
   *  file; the caller must have actually issued it. */
  query: string;
  /** The verbatim (or lightly excerpted) text returned by the lookup. Never fabricated by this file
   *  -- the caller must have actually issued the query and captured a real response. */
  definitionText: string;
  /** Optional: the register this verification was FOR, so this stage can confirm the caller's
   *  lookup actually targeted the register THIS stage guessed, not a stale or mismatched one. */
  registerClaimed?: string;
  source?: string;
}

export interface PredicateMatchDetail {
  letter: string;
  matched: boolean;
  reason: string;
}

// ─── KN-BP144-15 Phase 1: CAPTURE-ONLY structured elimination records ──────────────────────────
//
// "Eliminations are facts and we throw them away." Step 6 above (evaluateOptionAgainstPredicate)
// already produces the richest, most specific reason string this file produces (Phase 0 report
// 0.2/0.3) -- but that reason lives only as prose inside PredicateMatchDetail.reason, with its
// rule identity implicit (the caller has to already know "this came from Step 6") and its
// evidence (the option's own text the rule actually read) folded into the SAME prose string
// rather than held as its own field. `EliminationRecord` below does not change what Step 6
// decides or what any pre-existing field (`matches`, `trace`, `survivorsOut`) reports -- it is a
// pure, additive re-shaping of information already computed, captured together the way a durable
// fact should be: which rule, what it concluded, and the exact evidence that fired it, as three
// separate fields a caller can read without re-parsing prose.
//
// SCOPE, DELIBERATELY NARROW (KN-BP144-15 ticket refusal: do not change any elimination rule,
// threshold, or gate; capture only): this file has exactly ONE mechanism that eliminates
// individual OPTIONS with a substantive per-option reason -- Step 6's literal-referent predicate
// match. The other reason-bearing functions in this file report on a different kind of subject
// entirely: checkBidirectionalConsistency judges a SOURCE's ranking (admissible/inadmissible),
// not an option; evaluateSignificantFigureAccept and evaluateFormatIndependentFallbackGate judge
// whether the WHOLE question is decidable this way at all, not any one option. Force-fitting
// those into an "eliminated option" record would fabricate a subject the rule never actually
// had an opinion about -- exactly the kind of dishonest generalization this codebase's Rule 66
// discipline forbids. If a future rule in this file ever DOES eliminate individual options with
// its own reason (a second arm alongside Step 6), `ruleId` below already gives it a place to
// identify itself distinctly, without needing this type to change.
export interface EliminationRecord {
  /** Identifies WHICH rule/arm produced this record, distinct from `reason` (the full prose
   *  rationale) -- so a caller (or a future second per-option elimination arm in this file) never
   *  has to parse `reason`'s prose to know which mechanism fired. Today always
   *  'STAGE_R_STEP6_LITERAL_REFERENT_PREDICATE' (see the constant of the same value, below). */
  ruleId: string;
  /** The option letter this record concerns. Only ELIMINATED options are represented here (see
   *  this interface's own header) -- never a survivor, never a winner. */
  letter: string;
  /** The full rationale, verbatim from the corresponding PredicateMatchDetail.reason -- not
   *  re-derived, not paraphrased. */
  reason: string;
  /** The evidence that fired this rule: the option's OWN text, quoted verbatim, exactly as Step 6
   *  itself read it via evaluateOptionAgainstPredicate's literal substring check -- never a
   *  summary, never fabricated. */
  evidence: string;
}

/** KN-BP144-15 Phase 1: stable identifier for this file's one per-option elimination arm (Step 6,
 *  literal-referent predicate match inside runRegisterResolutionStage). A module-level constant,
 *  not inlined at each use, so every EliminationRecord this arm ever produces carries the exact
 *  same string -- a caller can group/filter on it without a typo risk. */
const STAGE_R_STEP6_LITERAL_REFERENT_PREDICATE_RULE_ID = 'STAGE_R_STEP6_LITERAL_REFERENT_PREDICATE';

export interface RegisterResolutionStageResult {
  /** false = the stage did not run its inference logic at all (guard condition not met -- fewer
   *  than 2 survivors, or no definitional concept detected in the stem). true = the stage actually
   *  attempted register inference, whether or not it ultimately abstained past that point. */
  applied: boolean;
  /** true = the stage ran but could not safely resolve (no curated register table, ambiguous
   *  register, no verification supplied, mismatched verification, predicate could not be reduced, or
   *  the predicate would have discarded every survivor) -- `survivorsOut` equals `survivorsIn`
   *  unchanged. Distinct from `applied: false` (never got that far at all). */
  abstained: boolean;
  survivorsIn: string[];
  survivorsOut: string[];
  concept: string | null;
  registerCandidate: RegisterCandidate | null;
  registerCounts: Record<string, number>;
  verification: RegisterVerificationLookup | null;
  derivedPredicateReferentTerms: string[];
  matches: PredicateMatchDetail[];
  trace: string[];
  /** KN-BP144-15 Phase 1: structured elimination records, one per option this stage actually
   *  ELIMINATED (matched: false in `matches`) -- see EliminationRecord's own doc comment above.
   *  Purely additive: [] on every return path that never reaches Step 6 (no-op / abstain before
   *  matching), and derived from `matches` (never a second source of truth) on the two return
   *  paths that do. Zero behavior change -- `survivorsOut`/`matches`/`trace` are computed exactly
   *  as before this ticket; this field only re-shapes information already present into a
   *  structured record a caller can read without parsing `reason`'s prose. */
  eliminationRecords: EliminationRecord[];
}

// Curated per-concept register signal tables. Deliberately narrow -- see section header above. Each
// register carries the substrings this stage looks for in OPTION TEXT (not the stem) to infer which
// register the stem's concept noun is being used in. "bias" is the anchor case (qid 85, measured
// against the real corpus in KN-BP144-2 Phase 0/2); other concepts are added here only once measured
// against a real question, never guessed in bulk ahead of evidence.
const CONCEPT_REGISTER_SIGNALS: Record<string, Array<{ register: string; signalWords: string[] }>> = {
  bias: [
    { register: 'statistics', signalWords: ['sample', 'sampling', 'population', 'estimate', 'estimates', 'average', 'random', 'represent'] },
    { register: 'sewing', signalWords: ['fabric', 'cloth', 'thread', 'diagonal', 'stretch', 'seam', 'grain', 'weave'] },
    { register: 'electronics', signalWords: ['voltage', 'current', 'circuit', 'transistor', 'resistor', 'diode', 'amplifier'] },
    { register: 'pop_culture', signalWords: ['member', 'fan', 'favorite', 'idol', 'k-pop', 'kpop', 'group'] },
  ],
};

export interface RegisterInferenceOutcome {
  candidate: RegisterCandidate | null;
  counts: Record<string, number>;
  trace: string;
}

/** Steps 2-3: infer the register from the OPTION TEXT (every option, not just survivors -- this is
 *  deliberately the FULL set, matching the Founder's own step 3, which counted "sample" across A-I
 *  before any elimination had happened). Returns candidate=null when the concept has no curated
 *  table, when no register's signal words appear in any option, or when two or more registers are
 *  tied for the most option-coverage (an honest abstain -- ambiguous is not evidence, the same
 *  standard R1 in plow_mc_elimination_chart.ts already holds itself to). */
export function inferRegisterFromOptionText(
  concept: string,
  options: OptionLike[],
): RegisterInferenceOutcome {
  const table = CONCEPT_REGISTER_SIGNALS[concept];
  if (!table) {
    return {
      candidate: null,
      counts: {},
      trace: `REGISTER ABSTAIN: concept="${concept}" has no curated register table -- honest abstain, not a guess.`,
    };
  }

  const counts: Record<string, number> = {};
  const carriers: Record<string, string[]> = {};
  const matchedWords: Record<string, string[]> = {};
  for (const entry of table) {
    const carrierLetters: string[] = [];
    const words = new Set<string>();
    for (const opt of options) {
      const lower = opt.text.toLowerCase();
      const hit = entry.signalWords.filter((w) => lower.includes(w));
      if (hit.length > 0) {
        carrierLetters.push(opt.letter);
        for (const w of hit) words.add(w);
      }
    }
    counts[entry.register] = carrierLetters.length;
    carriers[entry.register] = carrierLetters;
    matchedWords[entry.register] = [...words].sort();
  }

  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  if (!top || top[1] === 0) {
    return {
      candidate: null,
      counts,
      trace: `REGISTER ABSTAIN: concept="${concept}" -- no register's signal words appeared in any option text. counts=${JSON.stringify(counts)}`,
    };
  }
  const topRegister = top[0];
  const topCount = top[1];
  const second = ranked[1];
  const secondCount = second ? second[1] : 0;
  if (topCount === secondCount) {
    return {
      candidate: null,
      counts,
      trace: `REGISTER ABSTAIN: concept="${concept}" -- register inference ambiguous, top registers tied at ${topCount} options. counts=${JSON.stringify(counts)} -- ambiguous is not evidence.`,
    };
  }

  const candidate: RegisterCandidate = {
    register: topRegister,
    matchedSignalWords: matchedWords[topRegister] ?? [],
    optionsCarryingSignal: carriers[topRegister] ?? [],
  };
  return {
    candidate,
    counts,
    trace:
      `REGISTER GUESS: concept="${concept}" -> register="${topRegister}" (signal words ` +
      `[${candidate.matchedSignalWords.join(',')}] found in options [${candidate.optionsCarryingSignal.join(',')}], ` +
      `beating next-best by ${topCount - secondCount}). This is a GUESS -- admitted as such, not proceeded on until verified.`,
  };
}

// Step 4-5: reduce a verified definition to a predicate. General, register-agnostic anchor patterns
// for "X differs/deviates from/relative to/compared with Y" -- Y is captured as the predicate's
// required referent. Deliberately does NOT hardcode "population" or "bias" anywhere in this pattern
// set; the referent is extracted fresh from whatever definitionText the caller's real lookup actually
// returned, for whatever concept/register this stage is running against.
const REFERENT_ANCHOR_PATTERNS: RegExp[] = [
  /\bdiffer(?:s|ing)?\s+from\s+(?:the\s+)?(?:true\s+)?([a-z][a-z\s]{2,60}?)(?=[.,;]|\s+(?:and|which|that)\b|$)/i,
  /\bdeviat(?:e|es|ing|ion)\s+from\s+(?:the\s+)?(?:true\s+)?([a-z][a-z\s]{2,60}?)(?=[.,;]|\s+(?:and|which|that)\b|$)/i,
  /\brelative\s+to\s+(?:the\s+)?(?:true\s+)?([a-z][a-z\s]{2,60}?)(?=[.,;]|\s+(?:and|which|that)\b|$)/i,
  /\bcompared?\s+(?:to|with)\s+(?:the\s+)?(?:true\s+)?([a-z][a-z\s]{2,60}?)(?=[.,;]|\s+(?:and|which|that)\b|$)/i,
  /\bdifference\s+between\s+(?:the\s+)?[a-z][a-z\s]{2,60}?\s+and\s+(?:the\s+)?([a-z][a-z\s]{2,60}?)(?=[.,;]|$)/i,
];

const REFERENT_STOPWORDS = new Set([
  'a', 'an', 'the', 'of', 'its', 'is', 'are', 'being', 'that', 'which', 'to', 'for', 'and', 'or', 'this',
  'these', 'those', 'it', 'in', 'on', 'at', 'by', 'with', 'from', 'value', 'values',
]);

/** Step 5: pull the required comparison REFERENT out of a verified definition's own text, and reduce
 *  it to a small set of content-noun terms (stopwords dropped). Returns [] (never a fabricated
 *  referent) when none of the general anchor patterns match the text at all -- an honest signal that
 *  this definition could not be mechanically reduced to a checkable predicate. */
export function extractPredicateReferentTerms(definitionText: string): string[] {
  for (const pattern of REFERENT_ANCHOR_PATTERNS) {
    const m = pattern.exec(definitionText);
    if (m && m[1]) {
      const phrase = m[1].toLowerCase();
      const terms = phrase
        .split(/\s+/)
        .map((w) => w.replace(/[^a-z]/g, ''))
        .filter((w) => w.length > 2 && !REFERENT_STOPWORDS.has(w));
      if (terms.length > 0) return [...new Set(terms)];
    }
  }
  return [];
}

/** Step 6, per option: does this ONE surviving option's own text literally contain at least one of
 *  the predicate's required referent terms? Literal substring match only -- this is the whole point
 *  (the Founder's rule 11, "if they WERE the same, they would use the same words. And they don't."):
 *  an option is credited with a referent only if its OWN text states it, never because an external
 *  reasoner could plausibly complete it with an unstated referent (see KN-BP144-2 Phase 0 report,
 *  item 2, for the qid-85 E-vs-J case this directly operationalizes). */
export function evaluateOptionAgainstPredicate(
  option: OptionLike,
  referentTerms: string[],
): PredicateMatchDetail {
  const lower = option.text.toLowerCase();
  const hit = referentTerms.filter((t) => lower.includes(t));
  if (hit.length > 0) {
    return {
      letter: option.letter,
      matched: true,
      reason: `contains required referent term(s) [${hit.join(',')}] in its own text: "${option.text}"`,
    };
  }
  return {
    letter: option.letter,
    matched: false,
    reason:
      `does not contain any required referent term [${referentTerms.join(',')}] in its own text -- ` +
      `an external reasoner could complete this option with the missing referent, but this stage only ` +
      `credits what the option's own text actually states: "${option.text}"`,
  };
}

/** The full stage: Founder's steps 2-6, gated exactly as the ticket requires.
 *
 *  - Runs only when >= 2 survivors are supplied (no-op on 0 or 1 -- `applied: false`).
 *  - Register inference (steps 2-3) is derived from the FULL option set's text, never the stem alone.
 *  - Verification (step 4) is MANDATORY: a null `verification`, or one whose `registerClaimed`
 *    mismatches the inferred register, always abstains -- never proceeds on an unverified guess.
 *  - Predicate reduction (step 5) is general and register-agnostic; an unreducible definition
 *    abstains rather than forcing a predicate that was never actually derived.
 *  - Predicate matching (step 6) is per-option and logged with the specific reason each survivor
 *    matched or failed -- never a bare "eliminated".
 *  - Never discards the last survivor: if the predicate would eliminate every remaining survivor,
 *    the stage abstains and returns the survivor set unchanged instead of forcing a result.
 *  - Never widens any of the above gates to force a pass (BP141, standing). */
export function runRegisterResolutionStage(
  stemText: string,
  options: OptionLike[],
  survivors: string[],
  verification: RegisterVerificationLookup | null,
): RegisterResolutionStageResult {
  const trace: string[] = [];

  if (survivors.length < 2) {
    trace.push(
      `NO-OP: ${survivors.length} survivor(s) supplied -- this stage only runs on 2+ survivors, per ` +
      `the ticket's own requirement. Returning survivors unchanged.`,
    );
    return {
      applied: false,
      abstained: false,
      survivorsIn: survivors,
      survivorsOut: survivors,
      concept: null,
      registerCandidate: null,
      registerCounts: {},
      verification,
      derivedPredicateReferentTerms: [],
      matches: [],
      trace,
      eliminationRecords: [],
    };
  }

  // Gate matches plow_mc_elimination_chart.ts's own R1/R2/R3 gate exactly (determineStemPolarity
  // MUST be determinate, i.e. the stem itself uses a definitional verb per DEFINITIONAL_STEM_RE, not
  // merely contain a defect/virtue noun anywhere). Without the polarity check, a computational stem
  // that happens to mention "error" in a non-definitional sense (e.g. "calculate... the probability
  // of error" -- measured on run 038's qid 53 during this ticket's own false-negative sweep) would
  // extract a spurious concept and attempt register inference on a question this stage was never
  // meant to touch. It would still abstain safely (no curated register table for "error"), but the
  // gate should not let it get that far in the first place -- caught and fixed this ticket.
  const stemPolarity = determineStemPolarity(stemText);
  const concept = stemPolarity !== 'indeterminate' ? extractStemConcept(stemText) : null;
  if (!concept) {
    trace.push(
      `NO-OP: no defect/virtue definitional concept noun detected in a determinately-definitional stem ` +
      `("${stemText}") -- this stage only applies to definitional questions (the same ` +
      `DEFINITIONAL_STEM_RE + determineStemPolarity + extractStemConcept gate ` +
      `plow_mc_elimination_chart.ts's own R1/R2/R3 already use). Returning survivors unchanged.`,
    );
    return {
      applied: false,
      abstained: false,
      survivorsIn: survivors,
      survivorsOut: survivors,
      concept: null,
      registerCandidate: null,
      registerCounts: {},
      verification,
      derivedPredicateReferentTerms: [],
      matches: [],
      trace,
      eliminationRecords: [],
    };
  }

  const { candidate, counts, trace: registerTrace } = inferRegisterFromOptionText(concept, options);
  trace.push(registerTrace);
  if (!candidate) {
    trace.push('ABSTAIN: register could not be confidently inferred (see above) -- survivors unchanged.');
    return {
      applied: true,
      abstained: true,
      survivorsIn: survivors,
      survivorsOut: survivors,
      concept,
      registerCandidate: null,
      registerCounts: counts,
      verification,
      derivedPredicateReferentTerms: [],
      matches: [],
      trace,
      eliminationRecords: [],
    };
  }

  // Step 4: mandatory verification. Never proceed on an unverified guess -- a defect, not a fallback.
  if (!verification) {
    trace.push(
      `ABSTAIN: register guessed as "${candidate.register}" but NO verification lookup was supplied by ` +
      `the caller. Per the ticket, mandatory verification with no lookup available means this stage ` +
      `must abstain -- it never proceeds on an unverified register guess. Survivors unchanged.`,
    );
    return {
      applied: true,
      abstained: true,
      survivorsIn: survivors,
      survivorsOut: survivors,
      concept,
      registerCandidate: candidate,
      registerCounts: counts,
      verification: null,
      derivedPredicateReferentTerms: [],
      matches: [],
      trace,
      eliminationRecords: [],
    };
  }
  if (verification.registerClaimed && verification.registerClaimed !== candidate.register) {
    trace.push(
      `ABSTAIN: register guessed as "${candidate.register}" but the supplied verification was for ` +
      `registerClaimed="${verification.registerClaimed}" -- mismatched verification is treated the same ` +
      `as no verification. Survivors unchanged.`,
    );
    return {
      applied: true,
      abstained: true,
      survivorsIn: survivors,
      survivorsOut: survivors,
      concept,
      registerCandidate: candidate,
      registerCounts: counts,
      verification,
      derivedPredicateReferentTerms: [],
      matches: [],
      trace,
      eliminationRecords: [],
    };
  }
  trace.push(
    `VERIFIED: query="${verification.query}" returned definitionText (first 200 chars)="` +
    `${verification.definitionText.slice(0, 200)}${verification.definitionText.length > 200 ? '...' : ''}"` +
    `${verification.source ? ` source=${verification.source}` : ''}`,
  );

  // Step 5: reduce to a predicate.
  const referentTerms = extractPredicateReferentTerms(verification.definitionText);
  if (referentTerms.length === 0) {
    trace.push(
      'ABSTAIN: the verified definition could not be mechanically reduced to a checkable predicate ' +
      '(no "differs from / deviates from / relative to / compared with / difference between" referent ' +
      'clause found in the returned text). Survivors unchanged -- never force a predicate that is not ' +
      'actually there.',
    );
    return {
      applied: true,
      abstained: true,
      survivorsIn: survivors,
      survivorsOut: survivors,
      concept,
      registerCandidate: candidate,
      registerCounts: counts,
      verification,
      derivedPredicateReferentTerms: [],
      matches: [],
      trace,
      eliminationRecords: [],
    };
  }
  trace.push(`PREDICATE: required referent terms derived from the verified definition: [${referentTerms.join(',')}]`);

  // Step 6: match every survivor against the predicate, logging each one's own reason.
  const survivorOptions = options.filter((o) => survivors.includes(o.letter));
  const matches = survivorOptions.map((o) => evaluateOptionAgainstPredicate(o, referentTerms));
  for (const m of matches) trace.push(`MATCH ${m.letter}: matched=${m.matched} -- ${m.reason}`);

  const matchedLetters = matches.filter((m) => m.matched).map((m) => m.letter);
  if (matchedLetters.length === 0) {
    trace.push(
      'ABSTAIN: the predicate would eliminate every remaining survivor -- this stage never discards ' +
      'the last survivor(s). Returning the full survivor set unchanged instead of forcing a result.',
    );
    // KN-BP144-15 Phase 1: eliminationRecords is [] here, DELIBERATELY, even though `matches`
    // reports every option as matched:false -- this branch is the "never discard the last
    // survivor(s)" safety override: nothing was ACTUALLY eliminated (survivorsOut === survivors,
    // unchanged, same as before this ticket). A capture record must describe what really
    // happened, not what the predicate would have said before the override reverted it -- an
    // eliminationRecords array here would misreport an override-preserved survivor as rejected.
    return {
      applied: true,
      abstained: true,
      survivorsIn: survivors,
      survivorsOut: survivors,
      concept,
      registerCandidate: candidate,
      registerCounts: counts,
      verification,
      derivedPredicateReferentTerms: referentTerms,
      matches,
      trace,
      eliminationRecords: [],
    };
  }

  trace.push(
    `RESULT: survivors narrowed from [${survivors.join(',')}] to [${matchedLetters.join(',')}] by ` +
    `literal-referent predicate match under register="${candidate.register}".`,
  );
  // KN-BP144-15 Phase 1: structured elimination records, built FROM `matches` (never a second
  // source of truth) -- one per option `matches` reports as NOT matched, i.e. genuinely eliminated
  // on THIS branch (the override above did not fire; at least one option survived). Indexed
  // against `survivorOptions` (same order, same length, `matches` was built via a 1:1 .map over
  // it) purely to attach the option's own text as `evidence` -- never changes which options are
  // considered eliminated, which remains decided entirely by `matches[i].matched` /
  // `survivorsOut`, exactly as before this ticket.
  const eliminationRecords: EliminationRecord[] = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    if (m && !m.matched) {
      eliminationRecords.push({
        ruleId: STAGE_R_STEP6_LITERAL_REFERENT_PREDICATE_RULE_ID,
        letter: m.letter,
        reason: m.reason,
        evidence: survivorOptions[i]?.text ?? '',
      });
    }
  }
  return {
    applied: true,
    abstained: false,
    survivorsIn: survivors,
    survivorsOut: matchedLetters,
    concept,
    registerCandidate: candidate,
    registerCounts: counts,
    verification,
    derivedPredicateReferentTerms: referentTerms,
    matches,
    trace,
    eliminationRecords,
  };
}
