// harvest_gsm8k_pilot_item103_rate_and_distance_problem.candidate.ts
// D-BP221-BM0-075/SEG, item 10 of the Founder's list. Harvested from a Liana Cycle silo deposit
// (dispatch D-BP221-BM0-049) describing GSM8K test.jsonl line 103 as a "rate and distance problem"
// solved by time = distance / rate. The deposit describes ONE question; everything below is this
// worker's own generalisation of that deposit into a shape a stranger question can trigger.
//
// Registered quarantined: true. Never selected until measured (per the prompt's hard constraint).

/**
 * @generalShape A COMPOUND UNIT-RATE problem stated as "it takes T time-units to cover/travel
 *   every D distance-units" (a pace given as time-per-distance, not distance-per-time), paired
 *   with a separately-stated TOTAL distance of the SAME unit, where the question asks for the
 *   total time to cover that whole/entire total. The arithmetic is
 *   answer = (T / D) * totalDistance, algebraically identical to time = distance / rate with
 *   rate = D / T, but recognised here from the time-per-distance phrasing directly rather than by
 *   first computing a speed.
 *
 * @recogniseInStranger Free text only (no lettered options). The question text must contain, in
 *   one clause, a time quantity plus a time-unit word ("minutes"/"hours"/"seconds"/"days") bound
 *   by a covering/traveling verb and a per/every/each cue to a distance quantity plus a
 *   recognised LENGTH unit word (miles/km/kilometers/feet/meters/metres/yards) -- exactly ONE such
 *   rate clause, not two or more (two would mean a changing pace, a different, harder shape). The
 *   text must ALSO contain, elsewhere, a second distance quantity in the SAME length unit word
 *   attached to a "the whole/total quantity" cue (across/wide/long/in total/altogether/in all).
 *   The question itself must ask for the same time unit the rate clause used, and must NOT
 *   contain any elapsed/remaining/partial cue word (already/so far/ago/elapsed/remaining/left/
 *   halfway/half). All of these gates must hold at once; any one failing is an abstain, not a
 *   softer match.
 *
 * @whatBreaksIt (1) A UNIT MISMATCH -- the rate clause stated in one length unit and the total
 *   stated in a different one (e.g. rate in miles, total in kilometers): the method has no unit
 *   conversion table, so it deliberately requires the literal unit words to match rather than
 *   silently mixing them. (2) A CHANGING OR MULTI-STAGE RATE -- "the first 10 miles at one pace,
 *   the rest at another" -- more than one rate-shaped clause is found, which is ambiguous about
 *   which pace answers the question, so the method refuses rather than picking one arbitrarily.
 *   (3) AN ELAPSED/REMAINING-TIME QUESTION -- "how many minutes had already passed", "how much
 *   further/longer" -- superficially the same nouns and numbers but asking for a different
 *   quantity than total-time-from-zero; the cue-word gate exists specifically to catch this.
 *   (4) A NON-DISTANCE "per" PHRASE THAT LOOKS LIKE A RATE -- "$5 per box", "3 apples per basket"
 *   -- excluded by restricting the unit word list to recognised units of length only. (5) A RATE
 *   THAT MUST FIRST BE DERIVED rather than read off directly (e.g. two movers whose combined
 *   speed answers the question) -- there is no single time-per-distance clause to extract, so the
 *   rate-clause regex simply fails to find one and the method abstains.
 *
 * @whenRecognitionIsWrong This method's run() is a single deterministic arithmetic step with no
 *   internal cross-check or second derivation to catch a bad match -- if shapeTest fires on a
 *   look-alike, run() will still confidently compute and return a concrete number, ending the
 *   engine's fall-through loop with a wrong final verdict instead of the honest abstain a harder
 *   method further down the chain might have produced. That is exactly why shapeTest stacks
 *   several independent, literal gates (single rate clause, matching unit word, no elapsed/partial
 *   cue) instead of one loose keyword check: each gate is cheap and each is a chance to abstain
 *   for free rather than risk ending the loop on a guess.
 */
import { registerMethod } from '../method_registry';
import type { LianaMethod } from '../method_registry';

export const rateAndDistanceUnitPaceMethod: LianaMethod = {
  id: 'rate-distance-time-per-unit-pace-v1',
  demand: 'COMPUTE',
  name: 'Rate-and-distance: time-per-unit pace scaled to a stated total distance',
  taughtBy: 'D-BP221-BM0-075/SEG',
  shapeDescription:
    'Free-text question stating a pace as "T time-units per D length-units" plus a separately '
    + 'stated total in the same length unit, asking for the total time to cover the whole thing; '
    + 'abstains on unit mismatch, multi-stage rates, or elapsed/remaining-time phrasing.',
  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: { question?: string; options?: Record<string, string> | null }) {
    const question = input?.question || '';

    if (input && input.options && Object.keys(input.options).length >= 2) {
      return {
        matches: false,
        reason: 'has >=2 lettered options -- this method only matches free-text rate/distance '
          + 'narratives, never a lettered choice list.',
      };
    }

    const TIME_UNIT = '(minute|minutes|hour|hours|second|seconds|day|days)';
    const LEN_UNIT = '(mile|miles|kilometer|kilometers|kilometre|kilometres|km|foot|feet|meter|meters|metre|metres|yard|yards)';

    const rateClauseRe = new RegExp(
      `(\\d+(?:\\.\\d+)?)\\s*${TIME_UNIT}\\b[^.?!]{0,40}?\\b(?:every|per|each)\\s+(\\d+(?:\\.\\d+)?)\\s*${LEN_UNIT}\\b`,
      'gi',
    );
    const rateMatches = [...question.matchAll(rateClauseRe)];

    if (rateMatches.length === 0) {
      return {
        matches: false,
        reason: 'no "<time> <time-unit> ... every/per/each <distance> <length-unit>" pace clause '
          + 'found -- refuses rather than guessing this shape from a weaker rate-ish signal.',
      };
    }
    if (rateMatches.length > 1) {
      return {
        matches: false,
        reason: 'found ' + rateMatches.length + ' separate pace clauses -- reads as a changing or '
          + 'multi-stage rate, which this method does not know which pace to apply, so it abstains '
          + 'rather than pick one arbitrarily.',
      };
    }

    const rateMatch = rateMatches[0];
    const rateTimeUnit = normalizeUnit(rateMatch[2]);
    const rateLenUnit = normalizeUnit(rateMatch[4]);

    const totalClauseRe = new RegExp(
      `(\\d+(?:\\.\\d+)?)\\s*${LEN_UNIT}\\b[^.?!]{0,40}?\\b(across|wide|long|in total|altogether|in all)\\b`,
      'gi',
    );
    const totalMatches = [...question.matchAll(totalClauseRe)];

    if (totalMatches.length === 0) {
      return {
        matches: false,
        reason: 'no separately-stated "<total distance> <length-unit> across/wide/long/in total" '
          + 'clause found -- refuses rather than assuming which number is the total.',
      };
    }
    if (totalMatches.length > 1) {
      return {
        matches: false,
        reason: 'found ' + totalMatches.length + ' candidate total-distance clauses -- ambiguous '
          + 'which one is the whole quantity, so it abstains rather than guessing.',
      };
    }

    const totalMatch = totalMatches[0];
    const totalLenUnit = normalizeUnit(totalMatch[2]);

    if (totalLenUnit !== rateLenUnit) {
      return {
        matches: false,
        reason: 'pace clause uses unit "' + rateMatch[4] + '" but the total-distance clause uses '
          + 'unit "' + totalMatch[2] + '" -- this method has no unit conversion table and refuses '
          + 'rather than silently mixing units.',
      };
    }

    const badCueRe = /\b(already|so far|ago|elapsed|remaining|left|halfway|half)\b/i;
    if (badCueRe.test(question)) {
      return {
        matches: false,
        reason: 'question contains an elapsed/remaining/partial-progress cue word -- this asks '
          + 'for a different quantity than total time from zero, so it abstains.',
      };
    }

    const askRe = new RegExp(`how\\s+(?:many|much)\\s+${rateTimeUnit}`, 'i');
    if (!askRe.test(question)) {
      return {
        matches: false,
        reason: 'question does not ask "how many/much ' + rateTimeUnit + '" -- the asked unit '
          + 'does not visibly match the pace clause\'s own time unit, so it abstains rather than '
          + 'assume they agree.',
      };
    }

    return {
      matches: true,
      reason: 'found one pace clause ("' + rateMatch[0].trim() + '") and one matching-unit total '
        + 'distance clause ("' + totalMatch[0].trim() + '"), with no elapsed/partial cue, asking '
        + 'for the pace\'s own time unit.',
    };
  },

  async run(input: { question?: string; options?: Record<string, string> | null }) {
    const question = input?.question || '';
    const freeText = !input || input.options === null || input.options === undefined;

    try {
      const TIME_UNIT = '(minute|minutes|hour|hours|second|seconds|day|days)';
      const LEN_UNIT = '(mile|miles|kilometer|kilometers|kilometre|kilometres|km|foot|feet|meter|meters|metre|metres|yard|yards)';

      const rateClauseRe = new RegExp(
        `(\\d+(?:\\.\\d+)?)\\s*${TIME_UNIT}\\b[^.?!]{0,40}?\\b(?:every|per|each)\\s+(\\d+(?:\\.\\d+)?)\\s*${LEN_UNIT}\\b`,
        'i',
      );
      const rateMatch = question.match(rateClauseRe);

      const totalClauseRe = new RegExp(
        `(\\d+(?:\\.\\d+)?)\\s*${LEN_UNIT}\\b[^.?!]{0,40}?\\b(across|wide|long|in total|altogether|in all)\\b`,
        'i',
      );
      const totalMatch = question.match(totalClauseRe);

      if (!rateMatch || !totalMatch) {
        return {
          question,
          verdict: null,
          abstain: true,
          freeText,
          method: 'rate-distance-time-per-unit-pace-v1',
          basis: 'shapeTest gates passed but run() could not independently re-extract both the '
            + 'pace clause and the total-distance clause on re-parse -- abstains rather than guess.',
        };
      }

      const rateLenUnit = normalizeUnit(rateMatch[4]);
      const totalLenUnit = normalizeUnit(totalMatch[2]);
      if (rateLenUnit !== totalLenUnit) {
        return {
          question,
          verdict: null,
          abstain: true,
          freeText,
          method: 'rate-distance-time-per-unit-pace-v1',
          basis: 'unit mismatch detected on re-parse between the pace clause and the total-'
            + 'distance clause -- abstains rather than mix units.',
        };
      }

      const paceTime = Number(rateMatch[1]);
      const paceDistance = Number(rateMatch[3]);
      const totalDistance = Number(totalMatch[1]);

      if (!Number.isFinite(paceTime) || !Number.isFinite(paceDistance)
        || !Number.isFinite(totalDistance) || paceDistance === 0) {
        return {
          question,
          verdict: null,
          abstain: true,
          freeText,
          method: 'rate-distance-time-per-unit-pace-v1',
          basis: 'one of the three extracted numbers was not a usable finite value, or the pace '
            + 'distance was zero (division by zero) -- abstains rather than guess.',
        };
      }

      const rawAnswer = (paceTime / paceDistance) * totalDistance;
      if (!Number.isFinite(rawAnswer) || rawAnswer < 0) {
        return {
          question,
          verdict: null,
          abstain: true,
          freeText,
          method: 'rate-distance-time-per-unit-pace-v1',
          basis: 'the computed time was not a finite, non-negative value -- abstains rather than '
            + 'return a nonsensical result.',
        };
      }

      const rounded = Math.round(rawAnswer * 1e6) / 1e6;
      const verdict = String(rounded);

      return {
        question,
        verdict,
        abstain: false,
        freeText,
        method: 'rate-distance-time-per-unit-pace-v1',
        basis: 'derived time = (pace time ' + paceTime + ' / pace distance ' + paceDistance
          + ') * total distance ' + totalDistance + ' = ' + rounded + ', using the single pace '
          + 'clause and single matching-unit total-distance clause shapeTest already isolated.',
      };
    } catch (e) {
      return {
        question,
        verdict: null,
        abstain: true,
        freeText,
        method: 'rate-distance-time-per-unit-pace-v1',
        basis: 'rate-distance-time-per-unit-pace-v1 threw: ' + String((e as Error)?.message ?? e),
      };
    }
  },
};

/** Normalizes a matched unit word so plural/singular and km/kilometer/kilometre spellings compare
 *  equal. Deliberately narrow (no locale/imperial-metric conversion) -- a unit this function does
 *  not recognise is left as its own lowercase form, which will simply fail to equal any other
 *  recognised unit, the safe (abstain-favoring) direction. */
function normalizeUnit(raw: string): string {
  const u = (raw || '').trim().toLowerCase();
  const table: Record<string, string> = {
    mile: 'mile', miles: 'mile',
    kilometer: 'km', kilometers: 'km', kilometre: 'km', kilometres: 'km', km: 'km',
    foot: 'foot', feet: 'foot',
    meter: 'meter', meters: 'meter', metre: 'meter', metres: 'meter',
    yard: 'yard', yards: 'yard',
    minute: 'minute', minutes: 'minute',
    hour: 'hour', hours: 'hour',
    second: 'second', seconds: 'second',
    day: 'day', days: 'day',
  };
  return table[u] || u;
}

// REGISTERED AT IMPORT TIME, the same convention as every other method module in this folder
// (see set_equivalence_match.ts:580). D-BP221-BM0-106, on the Founder's order to get the methods
// filed and working. It arrives QUARANTINED -- `quarantined: true` above -- so selectMethod() and
// selectEligibleMethods() will not choose it. Registering it changes NO live run; it makes the
// method visible to listMethods() and measurable, which is the whole point of filing it.
//
// ACCEPTED by accept_gates.cjs (BISHOP_DROPZONE\D-BP221-BM04-TOOLS), re-run 2026-09-06T22:0xZ,
// in the Founder's promoted order gate 1 then gate 2a then gate 4: 'solves its own shape, carries
// no answer, claims 1 and steals none'. That runner's own words: ACCEPT means safe to register.
registerMethod(rateAndDistanceUnitPaceMethod);
