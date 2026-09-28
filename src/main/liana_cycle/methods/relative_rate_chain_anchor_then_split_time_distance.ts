// D-BP223-BM04-h2cbpv9w-170 -- relative-rate-chain-anchor-then-split-time-distance-v1, ADAPTED TO THE LIVE REGISTRY INTERFACE, REGISTRAR RUN R03
// (registration batch drawn from generation waves W11-W15).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\relative-rate-chain-anchor-then-split-time-distance-v1.candidate.ts
// Merged into the shared manifest and run through the full gate chain by REGISTRAR RUN R03
// (BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R03.md): gate 1 (positive yield), gate 2a (answer
// carry), gate 4 (interception against the live registry), gate 5 (sibling interception
// against the real ASDiv-150 + GSM8K-1319 corpora), and the perturbation gate 2b
// (HARDWIRE\tools\controls\perturbation_gate.mjs, baseline + 3 perturbations, oracle
// hand-derived from the English of the representative GSM8K question, never from this
// candidate's own source) -- ACCEPT on all of gate 1/2a/4/5 and TRACK on all of gate 2b's
// trials.
//
// WHY THIS FILE EXISTS RATHER THAN THE CANDIDATE ITSELF. The candidate declared its OWN
// local LianaQuestionInput, ShapeTestResult and RunResult interfaces and left the exported
// object unannotated, so nothing was ever checked against the real registry contract. Those
// three local interfaces are DELETED here; LianaMethod and MethodQuestionInput are imported
// from '../method_registry' and the exported object is annotated against the real
// LianaMethod type, per the estate's standing order NEVER CAST, ANNOTATE.
//
// THE BEHAVIOR CORE IS COPIED BYTE-FOR-BYTE AND DELIBERATELY NOT IMPROVED: every constant,
// every helper function and analyze() itself below are the candidate's own bytes -- proved
// by a programmatic byte-containment check (extract, splice, re-read, includes()), not
// merely asserted. See BISHOP_DROPZONE\D-BP223-BM04-h2cbpv9w-170_REGISTRAR_R03.md for the exact
// core-bytes/core-lines/CONTAINED table.
//
// TRY/CATCH, matching the Founder-approved pass across earlier batches (D-BP223-BM0-005,
// 2026-09-07T01:25:41Z ruling) -- this candidate had none of its own, so one was ADDED here, same treatment R02 gave its own W06 sub-family.
// run() aborts to an honest abstain on any thrown error rather than ending the engine's
// fall-through chain.
//
// REGISTERED QUARANTINED (quarantined: true), so selectMethod() and selectEligibleMethods()
// will never choose it. Registering changes NO live run; it makes the method visible to
// listMethods() and measurable. Un-quarantining is a separate, later Founder decision made
// per batch after held-out measurement, not this dispatch's.

/**
 * D-BP223-BM04-h2cbpv9w-170 WAVE W12, CLUSTER C120 (1 silo member, high confidence, singleton).
 * Representative teaching case: GSM8K test.jsonl line 39 (harvest_gsm8k_pilot_item39), "Dana can
 * run at a rate of speed four times faster than she can walk, but she can skip at a rate of speed
 * that is half as fast as she can run. If she can skip at 3 miles per hour, how many miles can she
 * travel in six hours if she spends one-third of the time running and two-thirds of the time
 * walking?"
 *
 * @generalShape RELATIVE-RATE CHAIN THROUGH A GIVEN ANCHOR RATE, THEN SPLIT-TIME WEIGHTED
 *   DISTANCE SUM: three named activities for one actor are related pairwise ("A is M times as
 *   fast/faster than B", "C is a fraction F as fast as A"); ONE of the three activities has its
 *   absolute rate stated directly (the anchor); the other two rates are recovered by walking the
 *   relation chain from the anchor; a total time is split between exactly two of the three
 *   activities via two stated fractions of that total time; the answer is the sum of each
 *   activity's own rate times its own share of the time. Silo cluster label:
 *   "rate_of_speed_multi_step_problem -- distance = rate_times_time; relative_rates".
 *
 * @recogniseInStranger Exactly two relation clauses of the form "<ActivityX> ... <multiplier>
 *   times as fast as/faster than <ActivityY>" or "<ActivityX> ... <fraction-word> as fast as
 *   <ActivityY>" (fraction words: half, third, quarter, two-thirds, three-quarters, or a bare
 *   "N/M" numeral fraction), chained through a shared activity name so all three rates resolve to
 *   one unknown; one clause "can <AnchorActivity> at <V> miles per hour" giving the anchor's
 *   absolute rate directly; a total-time clause "in <H> hours"; and a split-time clause "spends
 *   <fraction1> of the time <verb1>ing and <fraction2> of the time <verb2>ing" naming exactly the
 *   two NON-anchor activities. All five pieces must resolve without ambiguity.
 *
 * @whatBreaksIt (a) more or fewer than exactly two relation clauses, or a relation chain that does
 *   not connect all three activities to the anchor -- abstains rather than guess a missing link;
 *   (b) the split-time fractions naming an activity other than the two non-anchor activities, or
 *   naming the anchor activity itself (a different split, not this shape); (c) a fraction word or
 *   "N times" phrasing this candidate's small fixed vocabulary does not cover (e.g. "60% as fast")
 *   -- this candidate only recognises the literal fraction words and "N times" numerals listed
 *   above, a named and deliberate limitation, not a silent guess; (d) the two split-time fractions
 *   not covering the whole time (their sum not close to 1) -- flagged as inconsistent with the
 *   text's own "spends ... and ..." framing and abstained rather than silently renormalized.
 *
 * @whenRecognitionIsWrong shapeTest and run() both call the identical analyze() pass. Any missing
 *   relation, ambiguous activity binding, unrecognised fraction/multiplier vocabulary, or a
 *   split-time pair not summing near 1 makes analyze() return null and both abstain -- never a
 *   guessed verdict. Measured against its own (sole) cluster member: skip(anchor)=3, run =
 *   2*skip = 6 (skip is "half as fast as" run, so run = skip/0.5 = 6), walk = run/4 = 1.5 (run is
 *   "four times faster" than walk), time=6h split 1/3 running (2h) and 2/3 walking (4h),
 *   distance = 6*2 + 1.5*4 = 12 + 6 = 18, matching the ground truth exactly.
 */

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

const METHOD_ID = 'relative-rate-chain-anchor-then-split-time-distance-v1';


interface Analyzed {
  distance: number;
  rates: Record<string, number>;
}

const FRACTION_WORDS: Record<string, number> = {
  half: 0.5,
  third: 1 / 3,
  quarter: 0.25,
  'two-thirds': 2 / 3,
  'two thirds': 2 / 3,
  'three-quarters': 0.75,
  'three quarters': 0.75,
};

const MULTIPLIER_NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

/** "N times as fast as" / "N times faster than" -> multiplier N (X is N times Y's rate), N as
 *  either a digit or a spelled-out number word ("four times faster"). "<fraction-word> as fast
 *  as" -> multiplier F (X is F times Y's rate). Returns null if neither vocabulary matches -- a
 *  deliberate, named limitation (see @whatBreaksIt). */
function parseMultiplier(fragment: string): number | null {
  const numTimes = /(\d+(?:\.\d+)?|[a-zA-Z]+)\s+times\s+(?:as\s+fast\s+as|faster\s+than)/i.exec(fragment);
  if (numTimes) {
    const raw = numTimes[1].toLowerCase();
    const val = MULTIPLIER_NUMBER_WORDS[raw] ?? parseFloat(raw);
    if (Number.isFinite(val)) return val;
  }
  const fracMatch = /\b(half|third|quarter|two-thirds|two thirds|three-quarters|three quarters)\b\s+as\s+fast\s+as/i.exec(fragment);
  if (fracMatch) return FRACTION_WORDS[fracMatch[1].toLowerCase()] ?? null;
  const bareFrac = /(\d+)\/(\d+)\s+as\s+fast\s+as/i.exec(fragment);
  if (bareFrac) {
    const num = parseFloat(bareFrac[1]);
    const den = parseFloat(bareFrac[2]);
    if (den !== 0) return num / den;
  }
  return null;
}

function fractionOfTime(word: string): number | null {
  const lower = word.toLowerCase().trim();
  if (FRACTION_WORDS[lower] != null) return FRACTION_WORDS[lower];
  const one = /^one[- ](half|third|quarter)$/.exec(lower);
  if (one) return FRACTION_WORDS[one[1]] ?? null;
  const bareFrac = /^(\d+)\/(\d+)$/.exec(lower);
  if (bareFrac) {
    const num = parseFloat(bareFrac[1]);
    const den = parseFloat(bareFrac[2]);
    if (den !== 0) return num / den;
  }
  return null;
}

/** Relation clause: "<ActivityX> ... <multiplier-phrase> <ActivityY>" where ActivityX/Y are one
 *  of a small closed vocabulary of locomotion verbs turned into gerunds/nouns by the text itself.
 *  We anchor on verb stems appearing as bare words near "can <verb>". */
const ACTIVITY_RE = /\bcan\s+([a-zA-Z]+)\b/gi;

function analyze(rawQuestion: unknown): Analyzed | null {
  if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) return null;
  const q = rawQuestion.trim();

  // Collect the distinct activity verbs mentioned via "can <verb>", excluding pronouns/stopwords
  // that "can <pronoun> <verb>" phrasing (e.g. "can she walk") would otherwise capture as if the
  // pronoun itself were an activity.
  const PRONOUN_STOPWORDS = ['she', 'he', 'it', 'they', 'i', 'we', 'you', 'the', 'a', 'an'];
  const activities: string[] = [];
  let am: RegExpExecArray | null;
  const actRe = new RegExp(ACTIVITY_RE.source, 'gi');
  while ((am = actRe.exec(q)) !== null) {
    const v = am[1].toLowerCase();
    if (PRONOUN_STOPWORDS.includes(v)) continue;
    if (!activities.includes(v)) activities.push(v);
  }
  if (activities.length !== 3) return null; // exactly three named activities required

  // Split into sentences, then further split each sentence on "but"/"while"/"whereas" so two
  // relation clauses joined by a conjunction inside ONE sentence (as in the representative case)
  // are still examined separately rather than as one over-crowded clause.
  const sentences = q.split(/(?<=[.!?])\s+/).filter((s) => s.trim());
  const clauses: string[] = [];
  for (const s of sentences) {
    for (const part of s.split(/,?\s*\b(?:but|while|whereas)\b\s*/i)) {
      if (part.trim()) clauses.push(part.trim());
    }
  }

  // Find, for each pair of activities mentioned together in one clause, a multiplier relation:
  // "<activityX> ... <mult-phrase> ... <activityY>" or reversed for fraction-of.
  type Relation = { x: string; y: string; xEqualsMultOfY: number };
  const relations: Relation[] = [];
  for (const c of clauses) {
    const lower = c.toLowerCase();
    const mentioned = activities.filter((a) => lower.includes(a));
    if (mentioned.length !== 2) continue;
    const mult = parseMultiplier(c);
    if (mult === null || !Number.isFinite(mult) || mult <= 0) continue;
    // Determine order: the FIRST-mentioned activity in the clause is X, whose rate = mult * Y.
    const idxA = lower.indexOf(mentioned[0]);
    const idxB = lower.indexOf(mentioned[1]);
    const x = idxA < idxB ? mentioned[0] : mentioned[1];
    const y = idxA < idxB ? mentioned[1] : mentioned[0];
    relations.push({ x, y, xEqualsMultOfY: mult });
  }
  if (relations.length !== 2) return null; // exactly two relation clauses required

  // Anchor: "can <anchorVerb> at <V> miles per hour" (or "mph").
  const anchorRe = /\bcan\s+([a-zA-Z]+)\s+at\s+(\d+(?:\.\d+)?)\s+miles?\s+per\s+hour\b/i;
  const anchorM = anchorRe.exec(q);
  if (!anchorM) return null;
  const anchorActivity = anchorM[1].toLowerCase();
  const anchorRate = parseFloat(anchorM[2]);
  if (!activities.includes(anchorActivity) || !Number.isFinite(anchorRate) || anchorRate <= 0) return null;

  // Resolve all three rates from the anchor by walking the relation graph (at most 2 hops needed).
  const rates: Record<string, number> = { [anchorActivity]: anchorRate };
  let progressed = true;
  let iterations = 0;
  while (progressed && Object.keys(rates).length < 3 && iterations < 5) {
    progressed = false;
    iterations += 1;
    for (const r of relations) {
      if (rates[r.y] != null && rates[r.x] == null) {
        rates[r.x] = r.xEqualsMultOfY * rates[r.y];
        progressed = true;
      } else if (rates[r.x] != null && rates[r.y] == null) {
        rates[r.y] = rates[r.x] / r.xEqualsMultOfY;
        progressed = true;
      }
    }
  }
  if (Object.keys(rates).length !== 3) return null; // could not resolve all three, ambiguous chain

  // Total time.
  const timeRe = /\bin\s+([a-zA-Z0-9.]+)\s+hours?\b/i;
  const timeM = timeRe.exec(q);
  if (!timeM) return null;
  const NUMBER_WORDS: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  };
  const totalTimeRaw = timeM[1].toLowerCase();
  const totalTime = NUMBER_WORDS[totalTimeRaw] ?? parseFloat(totalTimeRaw);
  if (!Number.isFinite(totalTime) || totalTime <= 0) return null;

  // Split-time clause: "spends <frac1> of the time <gerund1> and <frac2> of the time <gerund2>".
  // The gerund is captured whole (not by stripping a suffix with a fragile regex) and matched
  // back to an activity by startsWith, since "running".startsWith("run") etc. always holds for
  // the plain "verb+ing" gerunds this shape's vocabulary uses.
  // WIDENING ROUND 1 (D-BP223-BM04-h2cbpv9w-170 TUNING_RESERVE_MODE, structural evidence: the
  // single teaching item happens to phrase this as "of the time", but "of his/her time" is an
  // equally common possessive variant -- widened on phrasing generality alone, no tuning-reserve
  // item text was read to make this change.
  const splitRe = /spends?\s+([a-zA-Z0-9\/\- ]+?)\s+of\s+(?:the|his|her|their)\s+time\s+([a-zA-Z]+)\s+and\s+([a-zA-Z0-9\/\- ]+?)\s+of\s+(?:the|his|her|their)\s+time\s+([a-zA-Z]+)\b/i;
  const splitM = splitRe.exec(q);
  if (!splitM) return null;
  const frac1 = fractionOfTime(splitM[1]);
  const gerund1 = splitM[2].toLowerCase();
  const frac2 = fractionOfTime(splitM[3]);
  const gerund2 = splitM[4].toLowerCase();
  if (frac1 === null || frac2 === null) return null;
  if (Math.abs(frac1 + frac2 - 1) > 0.01) return null; // must cover the whole time, honestly checked

  const nonAnchor = activities.filter((a) => a !== anchorActivity);
  const verb1 = nonAnchor.find((a) => gerund1.startsWith(a)) ?? null;
  const verb2 = nonAnchor.find((a) => gerund2.startsWith(a)) ?? null;
  if (!verb1 || !verb2 || verb1 === verb2) return null;
  if (rates[verb1] == null || rates[verb2] == null) return null;

  const distance = rates[verb1] * (frac1 * totalTime) + rates[verb2] * (frac2 * totalTime);
  if (!Number.isFinite(distance) || distance < 0) return null;

  const rounded = Math.round(distance * 1e6) / 1e6;
  return { distance: rounded, rates };
}

export const relativeRateChainAnchorThenSplitTimeDistance: LianaMethod = {
  id: 'relative-rate-chain-anchor-then-split-time-distance-v1',
  demand: 'COMPUTE',
  name: 'Relative-rate chain through a stated anchor rate, then split-time weighted distance sum',
  taughtBy: 'D-BP223-BM04-h2cbpv9w-170/SEG (cluster C120, sole member harvest_gsm8k_pilot_item39)',
  shapeDescription:
    'Three activities are pairwise related by multiplier/fraction phrases; one activity has its ' +
    'absolute rate stated directly; a total time is split by two stated fractions between the two ' +
    'non-anchor activities; answer is the sum of each rate times its own time share.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    const result = analyze(input && input.question);
    if (!result) {
      return {
        matches: false,
        reason:
          'did not find exactly three named activities, exactly two multiplier/fraction relation ' +
          'clauses connecting them, one absolute anchor rate, a total-time clause, and a matching ' +
          'two-way split-time clause summing to the whole time; abstaining rather than guessing',
      };
    }
    return {
      matches: true,
      reason: `rates=${JSON.stringify(result.rates)}, distance=${result.distance}`,
    };
  },

  async run(input: MethodQuestionInput) {
    const question = (input && input.question) || '';
    const freeText = !input || input.options === null || input.options === undefined;
    try {
      const result = analyze(input && input.question);
      if (!result) {
        return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: 'shape did not hold at run time' };
      }
      return {
        question,
        verdict: String(result.distance),
        abstain: false,
        freeText,
        method: METHOD_ID,
        basis: `resolved rates ${JSON.stringify(result.rates)}, weighted-time distance sum = ${result.distance}`,
      };
    } catch (e) {
      return { question, verdict: null, abstain: true, freeText, method: METHOD_ID, basis: METHOD_ID + ' threw: ' + String((e as Error)?.message ?? e) };
    }
  },
};

registerMethod(relativeRateChainAnchorThenSplitTimeDistance);
