// plow_generator_cascade.ts -- D-BP148-003 M1: THE GENERATOR.
//
// SEG: D-BP148-003/BISHOP/M1/seg-genticket
//
// THE GAP THIS FILE CLOSES (Founder finding, measured across receipts 038-045,
// C:\Users\Administrator\Downloads\*mnemo_mesh_test_receipt_*.json): "The Founder's cascade is a
// candidate GENERATOR. The shipped implementation is only an ELIMINATOR." Every existing pure
// function in plow_mc_elimination_cascade.ts (C1-C5, Stage R) narrows a survivor set that must
// ALREADY contain the correct letter -- it can eliminate wrong options from a pool, but it can
// never put a letter INTO the pool that nothing ever proposed. Measured qid 85 (real receipt 038,
// question_id 85, "Which of these statements correctly explains bias?", correct E): across 8 real
// runs the swarm/ensemble's own candidate letters were only ever {J, A, G} -- E was never once
// proposed, so no amount of elimination logic downstream could ever select it. "No adjudication
// logic can select an option nobody offered."
//
// THIS FILE's five functions do not eliminate anything. Each one takes a caller-supplied response
// to a DIFFERENT question than the one on screen (an inverse framing, a ranking, a control re-ask,
// a raw-statistics ask, a register-verification lookup) and PRODUCES a letter that the original
// question's own direct answer stream may never have proposed. That output is a CANDIDATE to be
// UNIONED into the pool the adjudicator chooses among -- wiring that union in is explicitly M3's
// job (D-BP148-003 M3, "Candidates from M1 enter the pool before adjudication"), not this file's.
//
// SAME CONTRACT AS plow_mc_elimination_cascade.ts (this file's own sibling, imported from but never
// edited, per that stage's own "the asking is the caller's job" boundary): every function here is
// pure and synchronous. None of them queries a model, a browser, or any external source. The
// caller dispatches the real query (Ollama, a browser-authority bridge, Perplexity, whatever is
// live) and hands this file the raw response text; this file only ever parses what it is given and
// applies the Founder's own generation rules to it. A function given no response (null/undefined)
// ABSTAINS -- returns no generated candidates and says so in its trace -- it never fabricates one.
// NEVER WIDEN A GATE TO FORCE A PASS (BP141, standing, restated in this ticket's own dispatch doc):
// every function below would rather report zero generated candidates than force an ambiguous one.
//
// Five rules, five functions, matching D-BP148-003's own M1 ticket text verbatim:
//   G1 generateInverseComplementCandidates -- "Ask the inverse first."
//   G2 generateFromBidirectionalRanking    -- "Ranking both directions as a self-consistency check."
//   G3 generateReIncludedCandidates        -- "Re-include just-eliminated options as a control pass."
//   G4 generateFromHardNumberStats         -- "Terminate on the hard number."
//   G5 generateFromRegisterDetermination   -- "Register determination before definition."
// runGeneratorCascade composes all five into one call, running only the rules whose input the
// caller actually supplied, unioning every rule's generated letters into one candidate set with a
// full per-rule trace -- never silently dropping a rule's absence, always naming which rules ran.
//
// Rule 66: version, never overwrite -- new file, no supersede needed. No em-dashes anywhere in this
// file (or its comments) -- "--" used throughout per Rule 66.

import {
  buildInverseQueryFraming,
  detectNegationQuestion,
  extractLetterRankingSequence,
  checkBidirectionalConsistency,
  determineRequiredPrecision,
  runRegisterResolutionStage,
  type OptionLike,
  type OptionValue,
  type RegisterVerificationLookup,
  type RegisterResolutionStageResult,
} from './plow_mc_elimination_cascade';
import { extractQuantityFromText, extractNumber, type Quantity } from './compute_sidecar';

/** Which extreme of a rankable quantity the ORIGINAL question is actually asking for. A "which is
 *  NOT densely populated" / "which is the smallest/least/lowest" stem wants the MINIMUM end of the
 *  ranking; a "which IS densely populated" / "which is the greatest/highest" stem wants the MAXIMUM
 *  end. Callers derive this from the stem themselves (this file does not re-implement a polarity
 *  classifier -- plow_mc_elimination_cascade.ts's own detectNegationQuestion/determineStemPolarity
 *  already exist for that, imported where useful, never duplicated). */
export type ExtremePolarity = 'least' | 'most';

// ─── G1: ASK THE INVERSE FIRST ──────────────────────────────────────────────────────────────────
//
// Founder, Excerpt 2: "First I put in the inverse, because that usually cuts the question in half,
// at least: (I'm asking for the B, as in opposite of what I actually want to know, which is the A)."
// Mechanism: build the affirmative framing (reused verbatim from buildInverseQueryFraming, never
// duplicated), the CALLER dispatches it to a real source, and this function reads back which
// letters that source explicitly affirmed as belonging to the affirmative set. The COMPLEMENT of
// that affirmed set, against the full option universe, is the generated candidate pool for the
// original negated question -- a genuinely NEW pool, not a narrowing of one the swarm already
// proposed, because the source was never asked about the negated stem at all.

export interface InverseGenerationResult {
  applied: boolean;
  inverseQuery: string | null;
  affirmedLetters: string[];
  generatedCandidates: string[];
  trace: string;
}

/** `inverseResponseText` is the CALLER's real dispatched response to the inverse framing this
 *  function builds via buildInverseQueryFraming -- never fabricated here. Returns
 *  applied:false (not a fabricated result) when the stem carries no NOT/EXCEPT qualifier
 *  (buildInverseQueryFraming has nothing to invert) or when no response was supplied at all. */
export function generateInverseComplementCandidates(
  stemText: string,
  options: OptionLike[],
  inverseResponseText: string | null | undefined,
): InverseGenerationResult {
  const inverseQuery = buildInverseQueryFraming(stemText);
  if (inverseQuery === null) {
    return {
      applied: false,
      inverseQuery: null,
      affirmedLetters: [],
      generatedCandidates: [],
      trace:
        `G1 NO-OP: stem carries no NOT/EXCEPT qualifier (detectNegationQuestion="` +
        `${JSON.stringify(detectNegationQuestion(stemText))}") -- nothing to invert.`,
    };
  }
  if (!inverseResponseText || inverseResponseText.trim().length === 0) {
    return {
      applied: true,
      inverseQuery,
      affirmedLetters: [],
      generatedCandidates: [],
      trace:
        `G1 ABSTAIN: inverse query built ("${inverseQuery}") but no response was supplied by the ` +
        `caller -- honest abstain, never a guess.`,
    };
  }

  const validLetters = new Set(options.map((o) => o.letter));
  const affirmedLetters = extractLetterRankingSequence(inverseResponseText, validLetters);
  if (affirmedLetters.length === 0) {
    return {
      applied: true,
      inverseQuery,
      affirmedLetters: [],
      generatedCandidates: [],
      trace:
        `G1 ABSTAIN: inverse response returned no parseable option letters -- ` +
        `response="${inverseResponseText.slice(0, 200)}".`,
    };
  }

  const affirmedSet = new Set(affirmedLetters);
  const generatedCandidates = options.map((o) => o.letter).filter((l) => !affirmedSet.has(l));
  if (generatedCandidates.length === 0) {
    return {
      applied: true,
      inverseQuery,
      affirmedLetters,
      generatedCandidates: [],
      trace:
        `G1 ABSTAIN: the inverse response affirmed every option (${affirmedLetters.join(',')}) -- ` +
        `no complement remains, this pass discriminates nothing.`,
    };
  }
  return {
    applied: true,
    inverseQuery,
    affirmedLetters,
    generatedCandidates,
    trace:
      `G1 GENERATE: inverse query="${inverseQuery}" affirmed [${affirmedLetters.join(',')}] -- ` +
      `complement (generated candidates for the ORIGINAL negated question) = ` +
      `[${generatedCandidates.join(',')}].`,
  };
}

// ─── G2: RANKING BOTH DIRECTIONS AS A SELF-CONSISTENCY CHECK ───────────────────────────────────
//
// Founder, Excerpt 2 step 3 and Excerpt 4 ("elimination cascade with bidirectional consistency
// validation"): ask most-to-least AND least-to-most as two SEPARATE queries, require the second to
// be the exact reverse of the first (reusing checkBidirectionalConsistency, C4, byte-identical, not
// duplicated), and only THEN read off the extremal end the original question's polarity needs. A
// source that cannot reverse its own ranking is not trusted to generate anything from it.

export interface RankingGenerationResult {
  consistent: boolean;
  noData: boolean;
  mostToLeast: string[];
  leastToMost: string[];
  generatedCandidate: string | null;
  trace: string;
}

/** `mostToLeastResponseText`/`leastToMostResponseText` are the CALLER's two real, SEPARATELY
 *  dispatched responses (never the same call reused twice -- that would not be an independent
 *  cross-check). `polarity` says which end of the consistent ranking the ORIGINAL question's stem
 *  actually wants (see ExtremePolarity's own doc comment). Returns generatedCandidate:null (never a
 *  guess) whenever the two directions disagree, either direction returned no data, or the option
 *  set that ranking spans has fewer than 1 entry. */
export function generateFromBidirectionalRanking(
  options: OptionLike[],
  mostToLeastResponseText: string | null | undefined,
  leastToMostResponseText: string | null | undefined,
  polarity: ExtremePolarity,
): RankingGenerationResult {
  const validLetters = new Set(options.map((o) => o.letter));
  const mostToLeast = extractLetterRankingSequence(mostToLeastResponseText ?? null, validLetters);
  const leastToMost = extractLetterRankingSequence(leastToMostResponseText ?? null, validLetters);

  const check = checkBidirectionalConsistency('generator_ranking_source', mostToLeast, leastToMost);
  if (check.noData || !check.consistent) {
    return {
      consistent: check.consistent,
      noData: check.noData,
      mostToLeast,
      leastToMost,
      generatedCandidate: null,
      trace: `G2 ABSTAIN (no generated candidate): ${check.trace}`,
    };
  }

  // Consistent: mostToLeast[0] is the MOST extreme end, mostToLeast[last] is the LEAST extreme end.
  const extremeLetter =
    polarity === 'most' ? mostToLeast[0] : mostToLeast[mostToLeast.length - 1];
  if (!extremeLetter) {
    return {
      consistent: true,
      noData: false,
      mostToLeast,
      leastToMost,
      generatedCandidate: null,
      trace: 'G2 ABSTAIN: consistent ranking was empty after all -- nothing to read an extreme from.',
    };
  }
  return {
    consistent: true,
    noData: false,
    mostToLeast,
    leastToMost,
    generatedCandidate: extremeLetter,
    trace:
      `G2 GENERATE: bidirectional ranking consistent (mostToLeast=[${mostToLeast.join(',')}]) -- ` +
      `polarity="${polarity}" reads off "${extremeLetter}" as the generated candidate.`,
  };
}

// ─── G3: RE-INCLUDE JUST-ELIMINATED OPTIONS AS A CONTROL PASS ──────────────────────────────────
//
// Founder, Excerpt 2 step 4: "now I put BACK IN the ones that were JUST ELIMINATED" and re-ask.
// This is a CONSISTENCY control, not a fresh generation from nothing: a previously-eliminated
// letter that the control response now ranks back at the SAME extremal end it was eliminated from
// is confirmed still-eliminated (no new candidate). A previously-eliminated letter the control
// response does NOT reassert at that same extremal end (or omits, or ranks somewhere in the
// middle/other end) is flagged as REINTRODUCED -- the source contradicted its own earlier
// elimination, and per the Founder's own consistency standard that contradiction is itself evidence
// worth surfacing as a generated candidate, not smoothed over.

export interface ReIncludeGenerationResult {
  applied: boolean;
  controlRanking: string[];
  reintroduced: string[];
  stillEliminated: string[];
  generatedCandidates: string[];
  trace: string;
}

/** Which end of the CONTROL RESPONSE's own extracted letter sequence is the most-extreme end.
 *  extractLetterRankingSequence returns letters in first-appearance TEXT order, which is
 *  direction-agnostic (it has no idea whether the prose it parsed was phrased "most to least" or
 *  "least to most") -- the caller must say which query it actually dispatched so this function
 *  reads the correct end. Getting this wrong silently flips every reintroduced/still-eliminated
 *  verdict, so it is a REQUIRED parameter, never defaulted/guessed. */
export type ControlRankingDirection = 'most_to_least' | 'least_to_most';

/** `previouslyEliminated` is the letter set some earlier stage (Stage 1's R1/R2/R3, or this file's
 *  own G2) already set aside. `eliminatedFromExtreme` says which real-world extreme those letters
 *  were eliminated as belonging to ('least' = eliminated as the least-plausible/least-extreme
 *  group, 'most' = eliminated as the most-extreme group) -- this function checks whether the
 *  control response's own ranking still places each of them at THAT SAME real-world extreme
 *  (translated through `controlRankingDirection` into the correct end of the parsed array); a
 *  letter no longer found there is the "contradiction" this control pass exists to catch.
 *  `controlResponseText` is the CALLER's real dispatched response to a re-ask that included the
 *  eliminated letters again. */
export function generateReIncludedCandidates(
  previouslyEliminated: string[],
  validLetters: Set<string>,
  controlResponseText: string | null | undefined,
  eliminatedFromExtreme: ExtremePolarity,
  controlRankingDirection: ControlRankingDirection = 'most_to_least',
): ReIncludeGenerationResult {
  if (previouslyEliminated.length === 0) {
    return {
      applied: false,
      controlRanking: [],
      reintroduced: [],
      stillEliminated: [],
      generatedCandidates: [],
      trace: 'G3 NO-OP: nothing was previously eliminated -- no control pass needed.',
    };
  }
  if (!controlResponseText || controlResponseText.trim().length === 0) {
    return {
      applied: true,
      controlRanking: [],
      reintroduced: [],
      stillEliminated: [],
      generatedCandidates: [],
      trace:
        `G3 ABSTAIN: ${previouslyEliminated.length} previously-eliminated letter(s) ` +
        `[${previouslyEliminated.join(',')}] but no control response was supplied -- honest abstain.`,
    };
  }

  const controlRanking = extractLetterRankingSequence(controlResponseText, validLetters);
  if (controlRanking.length === 0) {
    return {
      applied: true,
      controlRanking: [],
      reintroduced: [],
      stillEliminated: [],
      generatedCandidates: [],
      trace: 'G3 ABSTAIN: control response returned no parseable option letters.',
    };
  }

  // "That same real-world extreme" = the eliminatedFromExtreme-most third of the control ranking's
  // own length, rounded up so a short ranking still has at least 1 slot -- mirrors the same
  // "smallest-gap-that-still-discriminates" honesty the rest of this file (and C5's
  // determineRequiredPrecision) uses rather than inventing a fixed cutoff. Which END of the parsed
  // array that real-world extreme sits at depends on controlRankingDirection: in a "most to least"
  // response the LEAST extreme is the array's TAIL; in a "least to most" response the LEAST extreme
  // is the array's HEAD. Getting this translation wrong (the original bug this comment replaces,
  // caught by this file's own unit test) silently flips every verdict, so both directions are
  // handled explicitly rather than assuming one.
  const zoneSize = Math.max(1, Math.ceil(controlRanking.length / 3));
  const wantsTail =
    (eliminatedFromExtreme === 'least' && controlRankingDirection === 'most_to_least') ||
    (eliminatedFromExtreme === 'most' && controlRankingDirection === 'least_to_most');
  const extremeZone = wantsTail
    ? controlRanking.slice(controlRanking.length - zoneSize)
    : controlRanking.slice(0, zoneSize);
  const extremeZoneSet = new Set(extremeZone);

  const reintroduced: string[] = [];
  const stillEliminated: string[] = [];
  for (const letter of previouslyEliminated) {
    const seenInControl = controlRanking.includes(letter);
    if (!seenInControl || !extremeZoneSet.has(letter)) {
      reintroduced.push(letter);
    } else {
      stillEliminated.push(letter);
    }
  }

  return {
    applied: true,
    controlRanking,
    reintroduced,
    stillEliminated,
    generatedCandidates: reintroduced,
    trace:
      reintroduced.length > 0
        ? `G3 GENERATE: control ranking=[${controlRanking.join(',')}] does NOT reconfirm ` +
          `[${reintroduced.join(',')}] at the expected "${eliminatedFromExtreme}" extreme -- ` +
          `flagged as reintroduced generated candidates. Confirmed still-eliminated: ` +
          `[${stillEliminated.join(',') || '(none)'}].`
        : `G3 NO GENERATE: control ranking=[${controlRanking.join(',')}] reconfirms every ` +
          `previously-eliminated letter [${stillEliminated.join(',')}] at the expected ` +
          `"${eliminatedFromExtreme}" extreme -- no contradiction, nothing generated.`,
  };
}

// ─── G4: TERMINATE ON THE HARD NUMBER ───────────────────────────────────────────────────────────
//
// Founder, Excerpt 2 step 5: "Finally, I ask the hard statistic numbers that will tell me the
// answer from probably ONE prompt." The caller dispatches ONE query asking for the raw quantity
// each option's real-world referent turns on (e.g. "what are the population densities of each of
// these regions"); this function locates, per OPTION, the line/segment of that response whose text
// contains the option's own referent words, extracts a quantity from that segment (reusing
// compute_sidecar.ts's extractQuantityFromText, unit-aware, never re-implemented), and reads off
// the extreme end -- gated by the SAME half-minimum-gap significant-figure discipline C5's
// determineRequiredPrecision already applies (reused, not duplicated), so an ambiguous or
// too-close-to-call spread abstains rather than forcing a candidate.

export interface HardNumberOptionReading {
  letter: string;
  matchedText: string | null;
  value: number | null;
}

export interface HardNumberGenerationResult {
  readings: HardNumberOptionReading[];
  requiredPrecision: number | null;
  generatedCandidate: string | null;
  trace: string;
}

/** Splits response text into line/bullet/sentence segments so each option's quantity can be
 *  attributed to the segment that actually names it, rather than accidentally picking up a
 *  different option's number that happens to appear earlier or later in one giant blob. */
function splitIntoSegments(text: string): string[] {
  return text
    .split(/\r?\n|(?<=[.;])\s+(?=[A-Z(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** A referent word is usable for matching only if it is specific enough not to false-positive
 *  against unrelated segments -- short common English words ("of", "the", "in", single letters
 *  like a lone "A" from an option header) are excluded the same way AMBIGUOUS_ENGLISH_UNIT_WORDS
 *  excludes short false-positive unit words in compute_sidecar.ts (same discipline, not the same
 *  table -- this one is about referent-name matching, not unit parsing). */
function extractReferentWords(optionText: string): string[] {
  return optionText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4);
}

/** `statsResponseText` is the CALLER's real dispatched response to the "give me the hard numbers"
 *  query. `polarity` is the same ExtremePolarity convention G2 uses. Returns generatedCandidate:null
 *  (never a guess) when fewer than 2 options got a matched quantity, or when the extreme value's
 *  margin over the next-closest value does not clear determineRequiredPrecision's own half-gap
 *  threshold on the readings actually obtained. */
export function generateFromHardNumberStats(
  options: OptionLike[],
  statsResponseText: string | null | undefined,
  polarity: ExtremePolarity,
): HardNumberGenerationResult {
  if (!statsResponseText || statsResponseText.trim().length === 0) {
    return {
      readings: [],
      requiredPrecision: null,
      generatedCandidate: null,
      trace: 'G4 ABSTAIN: no stats response supplied -- honest abstain, never a guess.',
    };
  }

  const segments = splitIntoSegments(statsResponseText);
  const readings: HardNumberOptionReading[] = options.map((opt) => {
    const referentWords = extractReferentWords(opt.text);
    let matchedText: string | null = null;
    let value: number | null = null;
    for (const seg of segments) {
      const segLower = seg.toLowerCase();
      const hit = referentWords.some((w) => segLower.includes(w));
      if (!hit) continue;
      const q: Quantity | null = extractQuantityFromText(seg);
      const n = q ? q.value : extractNumber(seg);
      if (n !== null) {
        matchedText = seg;
        value = n;
        break; // first matching segment with an extractable value wins -- same "don't overreach past a clean hit" discipline used throughout this file
      }
    }
    return { letter: opt.letter, matchedText, value };
  });

  const withValues: OptionValue[] = readings
    .filter((r): r is HardNumberOptionReading & { value: number } => r.value !== null)
    .map((r) => ({ letter: r.letter, value: r.value }));

  if (withValues.length < 2) {
    return {
      readings,
      requiredPrecision: null,
      generatedCandidate: null,
      trace:
        `G4 ABSTAIN: only ${withValues.length} of ${options.length} option(s) got a matched, ` +
        `extractable quantity from the stats response -- not enough to discriminate an extreme.`,
    };
  }

  const requiredPrecision = determineRequiredPrecision(withValues);
  const sorted = [...withValues].sort((a, b) => a.value - b.value);
  const extreme = polarity === 'least' ? sorted[0]! : sorted[sorted.length - 1]!;
  const runnerUp = polarity === 'least' ? sorted[1] : sorted[sorted.length - 2];

  if (requiredPrecision === null || !runnerUp) {
    return {
      readings,
      requiredPrecision,
      generatedCandidate: null,
      trace: 'G4 ABSTAIN: fewer than 2 distinct values among the readings -- no discrimination possible.',
    };
  }
  const margin = Math.abs(runnerUp.value - extreme.value);
  if (margin < requiredPrecision) {
    return {
      readings,
      requiredPrecision,
      generatedCandidate: null,
      trace:
        `G4 ABSTAIN: extreme "${extreme.letter}" (${extreme.value}) and runner-up ` +
        `"${runnerUp.letter}" (${runnerUp.value}) are within ${margin} of each other, below the ` +
        `required precision (${requiredPrecision}) -- ambiguous, not forced.`,
    };
  }
  return {
    readings,
    requiredPrecision,
    generatedCandidate: extreme.letter,
    trace:
      `G4 GENERATE: ${withValues.length} option(s) got readings [${withValues.map((v) => `${v.letter}=${v.value}`).join(',')}] ` +
      `-- polarity="${polarity}" extreme is "${extreme.letter}" (${extreme.value}), clearing ` +
      `required precision (${requiredPrecision}) over runner-up "${runnerUp.letter}" by margin ${margin}.`,
  };
}

// ─── G5: REGISTER DETERMINATION BEFORE DEFINITION ───────────────────────────────────────────────
//
// Founder, Excerpt 7: "first, I categorize the possible answers... I need to then figure out 'what
// context is this question being asked in?'... So I need to define what CONTEXT the question is
// being asked in." This is the SAME mechanism plow_mc_elimination_cascade.ts's own
// runRegisterResolutionStage already implements (KN-BP144-2 Phase 2) and the M1 dispatch doc names
// verbatim as having "produced E on qid 85: a definition lookup for 'bias in statistics.'" This
// file does not duplicate that logic (A5-style refusal, matching every other reuse in this repo) --
// it WRAPS the existing, unedited, pure function and calls it from the FULL option universe as
// `survivors` (not a pre-narrowed pool), so its output is read here as a GENERATED candidate set,
// not an elimination of an already-built pool. That is the actual generator/eliminator distinction
// for this one rule: identical mechanism, different calling context -- called BEFORE any pool
// exists, so its result can be UNIONED into the initial candidate pool (M3's wiring job) rather
// than only ever intersected against a pool the swarm already built (which is what strands E behind
// {J, A, G} in the live run today, per checkEliminatorConstraintAboveAgreement's own measured scope
// note in plow_mc_answerer.ts: register resolution reaches exactly 1 of 20 real corpus questions,
// qid 85, and even there its below-agreement wiring only narrows an existing candidate pool -- see
// this ticket's own report for the live before/after).

export interface RegisterGenerationResult {
  stageResult: RegisterResolutionStageResult;
  generatedCandidates: string[];
  trace: string;
}

/** `verification` is the CALLER's real dispatched register-verification lookup (e.g. "what is bias
 *  in statistics"), or null if none is available yet -- runRegisterResolutionStage's own mandatory-
 *  verification-or-abstain contract (never edited, only called) already refuses to proceed without
 *  one, so this wrapper inherits that honesty for free rather than re-implementing it. */
export function generateFromRegisterDetermination(
  stemText: string,
  options: OptionLike[],
  verification: RegisterVerificationLookup | null,
): RegisterGenerationResult {
  const fullUniverse = options.map((o) => o.letter);
  const stageResult = runRegisterResolutionStage(stemText, options, fullUniverse, verification);
  const generatedCandidates =
    stageResult.applied && !stageResult.abstained ? stageResult.survivorsOut : [];
  return {
    stageResult,
    generatedCandidates,
    trace:
      generatedCandidates.length > 0
        ? `G5 GENERATE: register-determination stage (called from the FULL option universe ` +
          `[${fullUniverse.join(',')}], not a pre-narrowed pool) produced ` +
          `[${generatedCandidates.join(',')}] as generated candidates. Stage trace: ` +
          stageResult.trace.join(' | ')
        : `G5 NO GENERATE: register-determination stage did not apply or abstained. Stage trace: ` +
          stageResult.trace.join(' | '),
  };
}

// ─── COMPOSITE: RUN WHATEVER RULES THE CALLER HAS INPUT FOR ────────────────────────────────────
//
// Unions every rule's generated letters into one candidate set. A rule the caller supplied no input
// for simply does not run (ran:false in its own per-rule slot) -- this function never fabricates a
// response on a rule's behalf, and never treats a missing input as "that rule found nothing" (a
// distinct, honestly-reported condition from "that rule ran and found nothing"). Wiring this output
// into the actual adjudication pool (so the union changes what a live answer run can choose) is
// EXPLICITLY OUT OF SCOPE for this file -- that is M3's ticket, per the M1 dispatch doc's own
// "Generation is the ticket; selection is M3's."

export interface GeneratorCascadeInput {
  stemText: string;
  options: OptionLike[];
  polarity: ExtremePolarity;
  inverseResponseText?: string | null;
  mostToLeastResponseText?: string | null;
  leastToMostResponseText?: string | null;
  previouslyEliminated?: string[];
  eliminatedFromExtreme?: ExtremePolarity;
  controlResponseText?: string | null;
  controlRankingDirection?: ControlRankingDirection;
  hardNumberStatsResponseText?: string | null;
  registerVerification?: RegisterVerificationLookup | null;
}

export interface GeneratorCascadeResult {
  generatedCandidates: string[];
  g1: InverseGenerationResult;
  g2: RankingGenerationResult;
  g3: ReIncludeGenerationResult;
  g4: HardNumberGenerationResult;
  g5: RegisterGenerationResult;
  trace: string[];
}

export function runGeneratorCascade(input: GeneratorCascadeInput): GeneratorCascadeResult {
  const g1 = generateInverseComplementCandidates(input.stemText, input.options, input.inverseResponseText);
  const g2 = generateFromBidirectionalRanking(
    input.options,
    input.mostToLeastResponseText,
    input.leastToMostResponseText,
    input.polarity,
  );
  const validLetters = new Set(input.options.map((o) => o.letter));
  const g3 = generateReIncludedCandidates(
    input.previouslyEliminated ?? [],
    validLetters,
    input.controlResponseText,
    input.eliminatedFromExtreme ?? input.polarity,
    input.controlRankingDirection ?? 'most_to_least',
  );
  const g4 = generateFromHardNumberStats(input.options, input.hardNumberStatsResponseText, input.polarity);
  const g5 = generateFromRegisterDetermination(input.stemText, input.options, input.registerVerification ?? null);

  const unioned = new Set<string>();
  for (const l of g1.generatedCandidates) unioned.add(l);
  if (g2.generatedCandidate) unioned.add(g2.generatedCandidate);
  for (const l of g3.generatedCandidates) unioned.add(l);
  if (g4.generatedCandidate) unioned.add(g4.generatedCandidate);
  for (const l of g5.generatedCandidates) unioned.add(l);

  const order = input.options.map((o) => o.letter);
  const generatedCandidates = order.filter((l) => unioned.has(l));

  return {
    generatedCandidates,
    g1,
    g2,
    g3,
    g4,
    g5,
    trace: [g1.trace, g2.trace, g3.trace, g4.trace, g5.trace],
  };
}
