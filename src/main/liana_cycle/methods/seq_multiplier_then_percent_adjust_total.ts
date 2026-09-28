// D-BP221-BM06-010 -- seq-multiplier-then-percent-adjust-total-v1, ADAPTED TO THE LIVE REGISTRY
// INTERFACE. SIXTH AND LAST of the six the XO handed to BM06 (D-BP221-BM0-118).
//
// SOURCE, unchanged in behavior:
//   BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\harvest_gsm8k_pilot_item10_multi_step_calculation_involving_multipl.candidate.ts
//
// THIS ONE WAS THE CLOSEST TO CONFORMING OF ALL SIX, AND IT IS WORTH SAYING WHY IT STILL DID NOT.
// Its local `LocalRunResult` already had the registry's exact required outcome fields -- question,
// verdict as `string | null`, abstain, freeText, method, basis -- and its `LocalMethodInput.options`
// was already `Record<string, string> | null` rather than an array. Its author knew the contract and
// wrote it down honestly, saying so in the comment this header replaces: the types were local
// "so this candidate has no dependency on the mnemosyne source tree while it sits under review."
// THAT WAS THE RIGHT CALL FOR A FILE UNDER REVIEW AND THE WRONG ONE FOR A FILE THAT SHIPS. A
// hand-copied contract cannot fail when the real one changes; it just quietly stops matching.
//
// The one remaining mismatch was `qid?: string` against the registry's `qid?: number`, and it is
// moot here: this method never reads qid. Measured, not assumed -- zero occurrences in the source.
//
// WHAT CHANGED, AND IT IS SEVEN LINES. The three local type declarations are gone, the inline type
// literal annotating the export is replaced by the real `LianaMethod`, and the two method signatures
// take `MethodQuestionInput`. THE SHAPETEST AND RUN BODIES ARE UNTOUCHED, every gate, every reason
// string, every abstain path, and its own try/catch, which the other five candidates did not have.
// A diff against the candidate shows only interface lines. accept_gates.cjs returned ACCEPT on this
// behavior, and that ACCEPT still describes this file.
//
// It was also renamed: `export const method` is too generic a name to sit in a folder of nineteen
// modules. QUARANTINED, so no live run changes behavior today.
// harvest_gsm8k_pilot_item10_multi_step_calculation_involving_multipl.candidate.ts
//
// Candidate LianaMethod authored under D-BP221-BM0-075/SEG (Founder list item 10), against the
// deposit for gsm8k-test-10. This file is a REVIEW CANDIDATE only -- it lives in
// BISHOP_DROPZONE\D-BP221-BM0-072_CANDIDATES\ and is not wired into liana_terminal_engine.ts.
// No other file was touched to produce it.
//
// The deposit describes ONE walked case: 60 downloads -> second month = 3x first -> third month
// = second month reduced 30% -> sum all three. The method below generalizes that CHAIN SHAPE
// (base, multiplied stage, then percent-adjusted stage, then a request for the grand total) and
// is deliberately narrow: every gate below is written so that an unclear or reordered version of
// the chain produces an honest abstain rather than a guess. Rule 66: new file, no supersede
// needed. American spelling, no em-dashes.


// The registry's REAL types, not a local copy of them. See this file's header.
import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput } from '../method_registry';

/**
 * @generalShape A three-stage arithmetic chain reported as prose: a base quantity for stage 1,
 *   a stage 2 quantity produced by a stated MULTIPLICATIVE relation to stage 1 ("N times as
 *   many/much as", including spelled-out one..twelve, "twice", "double", "triple", "half"),
 *   a stage 3 quantity produced by applying a stated PERCENTAGE increase or decrease to stage 2
 *   ("reduced/decreased/dropped/cut by N%" or "increased/rose/grew by N%"), and a final question
 *   asking for the TOTAL across all three stages (never a single stage's value).
 * @recogniseInStranger Free-text question (no lettered options) containing, in this left-to-right
 *   order: the ordinal words "first", "second", "third" (any noun -- month, day, week, round,
 *   etc.), then a multiplier phrase matching /(one|two|...|twelve|\d+(\.\d+)?)\s+times\s+as\s+
 *   (many|much)/i or a bare twice/double/triple/half cue, then -- appearing textually AFTER that
 *   multiplier phrase -- a percentage-change phrase matching a "<verb> by N%" pattern, and a
 *   closing cue word ("total", "altogether", "in all", "over the three"). Exactly one bare
 *   (non-percentage, non-multiplier) number must remain in the text to serve as the stage-1 base;
 *   if zero or more than one remain, the shape is ambiguous and is refused.
 * @whatBreaksIt (a) only two stages instead of three (no percentage-adjusted third stage);
 *   (b) the percentage phrase textually precedes the multiplier phrase (a different narrative
 *   order than the taught case, so the stage assignment cannot be trusted); (c) an additive
 *   relation disguised as a multiplier ("three more than" / "three fewer than" rather than
 *   "three times as many as"); (d) more than one percentage phrase or more than one multiplier
 *   phrase (a compounding chain this shape was not taught on); (e) the question asks for a single
 *   stage's count rather than the running total; (f) a lettered multiple-choice question, which
 *   this shape never claims; (g) more than one leftover bare number, meaning the base quantity
 *   cannot be picked out unambiguously.
 * @whenRecognitionIsWrong Every gate above is a precondition, not a proof of correctness, so a
 *   stranger question can still coincidentally satisfy all of them while meaning something else
 *   (e.g. the percentage phrase modifies a clause unrelated to stage 2, or "half" is used
 *   idiomatically rather than arithmetically). To keep that failure mode cheap rather than
 *   costly, run() re-validates before answering: it refuses to answer (abstains) if any computed
 *   stage is negative, non-finite, or NaN, since a real download/count/dollar chain of this shape
 *   never produces those. A false positive that clears every gate AND produces a plausible
 *   positive number is not caught here -- that residual risk is why quarantined stays true until
 *   this method is measured against a held-out batch, per the estate's abstain-is-free discipline.
 */
export const seqMultiplierThenPercentAdjustTotalMethod: LianaMethod = {
  id: 'seq-multiplier-then-percent-adjust-total-v1',

  demand: 'COMPUTE',

  name: 'Sequential multiplier-then-percentage three-stage total (parses "N times as many ... '
    + 'but then reduced/increased by M%" chains and sums all three stages)',

  taughtBy: 'D-BP221-BM0-075/SEG',

  shapeDescription: 'Free-text three-stage word problem where stage 2 = stage 1 times a stated '
    + 'multiplier and stage 3 = stage 2 adjusted by a stated percentage, asking for the sum of '
    + 'all three stages; abstains on MCQ, on any ordering/structure it was not taught, or on any '
    + 'ambiguous number extraction.',

  quarantined: false,
  quarantineReason: "RELEASED FROM QUARANTINE 2026-09-09 at grade LOW per k/19e1cf67 item 3 LOW; FD-BP152-19 Terminator, gate-2b litmus (alternate/LOW reading), per D-BP223-BM0-X006-016-RELEASEGATE_REPORT.md sec 3-4. gate-2b ACCEPT (derives, not remembers, under oracle perturbation), zero confidently wrong anywhere on disk (D3 or gate-2b). Source: D-BP223-BM0-X006-016_gate_matrix.csv, D-BP223-BM04-h2cbp9d8-171_245_OF_252_READ_THE_QUESTION_FOR_HIS_EYES.md. NOTE: this release population (236) includes 1 method that neither source document could individually name as the \"1 skipped (no-oracle)\" method from the 252-of-253-tested census; see D-BP223-BM0-X007-013-LOWRELEASE_REPORT.md for the flag.",
  shapeTest(input: MethodQuestionInput) {
    // NEVER reads input.correctAnswer -- shape is decided purely from question text/options.
    const q = input.question || '';

    if (input.options && Object.keys(input.options).length >= 2) {
      return {
        matches: false,
        reason: 'has >=2 lettered options -- this shape only claims free-text three-stage word '
          + 'problems, never a multiple-choice question.',
      };
    }

    if (!q || q.trim().length === 0) {
      return { matches: false, reason: 'empty question text -- nothing to parse.' };
    }

    // Gate 1: the three ordinal stage markers, in left-to-right order.
    const iFirst = q.search(/\bfirst\b/i);
    const iSecond = q.search(/\bsecond\b/i);
    const iThird = q.search(/\bthird\b/i);
    if (iFirst < 0 || iSecond < 0 || iThird < 0) {
      return {
        matches: false,
        reason: 'missing one or more of the ordinal stage markers "first"/"second"/"third" -- '
          + 'this shape only claims explicit three-stage narratives.',
      };
    }
    if (!(iFirst < iSecond && iSecond < iThird)) {
      return {
        matches: false,
        reason: 'ordinal markers "first"/"second"/"third" are present but not in that '
          + 'left-to-right order -- the taught chain always narrates stages in sequence.',
      };
    }

    // Gate 2: exactly one multiplier phrase (word-number or digit form).
    const multiplierRe = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+(?:\.\d+)?)\s+times\s+as\s+(?:many|much)\b|\b(twice|double|doubled|triple|tripled|treble|trebled|quadruple|quadrupled|half)\b\s+as\s+(?:many|much)\b/gi;
    const multiplierMatches = [...q.matchAll(multiplierRe)];
    if (multiplierMatches.length === 0) {
      return {
        matches: false,
        reason: 'no multiplicative relation phrase found (e.g. "three times as many as", '
          + '"twice as much as") -- this shape refuses to infer a multiplier from anything '
          + 'weaker, including additive phrasing like "three more than".',
      };
    }
    if (multiplierMatches.length > 1) {
      return {
        matches: false,
        reason: `found ${multiplierMatches.length} multiplier phrases -- this shape was taught `
          + 'on a single multiplicative step and refuses a stacked/compounding chain.',
      };
    }

    // Gate 3: exactly one percentage-change phrase, textually AFTER the multiplier phrase.
    const decreaseRe = /\b(reduc(?:ed|tion)|decreas(?:ed|e)|dropp?ed|declined|cut|fell)\b[^.]{0,30}?\bby\b[^.]{0,10}?(\d+(?:\.\d+)?)\s*%/i;
    const increaseRe = /\b(increas(?:ed|e)|rose|grew|jumped)\b[^.]{0,30}?\bby\b[^.]{0,10}?(\d+(?:\.\d+)?)\s*%/i;
    const decMatch = q.match(decreaseRe);
    const incMatch = q.match(increaseRe);
    if (decMatch && incMatch) {
      return {
        matches: false,
        reason: 'both an increase-phrase and a decrease-phrase matched -- ambiguous which '
          + 'percentage adjustment applies to stage 3.',
      };
    }
    const pctMatch = decMatch || incMatch;
    if (!pctMatch) {
      return {
        matches: false,
        reason: 'no percentage-change phrase found matching "<verb> by N%" -- this shape refuses '
          + 'to infer a percentage adjustment from weaker or implicit wording.',
      };
    }
    const pctIndex = q.search(pctMatch[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const multIndex = multiplierMatches[0].index ?? -1;
    if (pctIndex >= 0 && multIndex >= 0 && pctIndex < multIndex) {
      return {
        matches: false,
        reason: 'the percentage-change phrase appears BEFORE the multiplier phrase in the text -- '
          + 'the taught chain always states the multiplier step first, then the percentage step; '
          + 'a reversed order is a different narrative this method was not taught.',
      };
    }

    // Gate 4: a closing "total" cue.
    if (!/\btotal\b|\baltogether\b|\bin all\b|\bover the three\b/i.test(q)) {
      return {
        matches: false,
        reason: 'no "total"/"altogether"/"in all"/"over the three" cue found -- this shape only '
          + 'claims questions that ask for the grand total across all three stages.',
      };
    }

    // Gate 5: exactly one bare (non-percentage, non-multiplier-digit) number remains, for the
    // stage-1 base.
    const consumedSpans: Array<[number, number]> = [];
    const pctNumMatch = pctMatch[0].match(/(\d+(?:\.\d+)?)\s*%/);
    if (pctNumMatch && typeof pctNumMatch.index === 'number') {
      const start = q.indexOf(pctMatch[0]);
      if (start >= 0) consumedSpans.push([start, start + pctMatch[0].length]);
    }
    if (multIndex >= 0) {
      consumedSpans.push([multIndex, multIndex + multiplierMatches[0][0].length]);
    }
    const isConsumed = (idx: number, len: number) =>
      consumedSpans.some(([s, e]) => idx >= s && idx < e || (idx + len) > s && idx < e);

    const bareNumRe = /\d+(?:\.\d+)?/g;
    const bareNums: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = bareNumRe.exec(q)) !== null) {
      const idx = m.index;
      const len = m[0].length;
      const followedByPercent = /^\s*%/.test(q.slice(idx + len));
      if (followedByPercent) continue; // it's a percentage number, not a bare base candidate.
      if (isConsumed(idx, len)) continue; // it's inside the multiplier phrase span.
      bareNums.push(m[0]);
    }
    if (bareNums.length !== 1) {
      return {
        matches: false,
        reason: `expected exactly one bare number to serve as the stage-1 base after excluding `
          + `percentage and multiplier numbers, found ${bareNums.length} -- ambiguous base `
          + 'quantity.',
      };
    }

    return {
      matches: true,
      reason: 'ordinal first/second/third markers in order, a single multiplier phrase followed '
        + 'textually by a single percentage-change phrase, a "total" cue, and exactly one bare '
        + 'base number -- matches the taught multiply-then-percent-adjust three-stage chain.',
    };
  },

  async run(input: MethodQuestionInput) {
    const question = input.question || '';
    const freeText = !input.options;
    const methodId = 'seq-multiplier-then-percent-adjust-total-v1';

    try {
      const multiplierRe = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+(?:\.\d+)?)\s+times\s+as\s+(?:many|much)\b|\b(twice|double|doubled|triple|tripled|treble|trebled|quadruple|quadrupled|half)\b\s+as\s+(?:many|much)\b/i;
      const wordToNum: Record<string, number> = {
        one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
        eleven: 11, twelve: 12,
        twice: 2, double: 2, doubled: 2,
        triple: 3, tripled: 3, treble: 3, trebled: 3,
        quadruple: 4, quadrupled: 4,
        half: 0.5,
      };
      const multMatch = question.match(multiplierRe);
      if (!multMatch) {
        return {
          question, verdict: null, abstain: true, freeText, method: methodId,
          basis: 'run() could not re-extract the multiplier phrase that shapeTest found -- '
            + 'refusing rather than guessing.',
        };
      }
      const multToken = (multMatch[1] || multMatch[2] || '').toLowerCase();
      const factor = /^\d+(\.\d+)?$/.test(multToken) ? parseFloat(multToken) : wordToNum[multToken];
      if (factor === undefined || !isFinite(factor)) {
        return {
          question, verdict: null, abstain: true, freeText, method: methodId,
          basis: `could not resolve multiplier token "${multToken}" to a number -- refusing.`,
        };
      }

      const decreaseRe = /\b(reduc(?:ed|tion)|decreas(?:ed|e)|dropp?ed|declined|cut|fell)\b[^.]{0,30}?\bby\b[^.]{0,10}?(\d+(?:\.\d+)?)\s*%/i;
      const increaseRe = /\b(increas(?:ed|e)|rose|grew|jumped)\b[^.]{0,30}?\bby\b[^.]{0,10}?(\d+(?:\.\d+)?)\s*%/i;
      const decMatch = question.match(decreaseRe);
      const incMatch = question.match(increaseRe);
      const pctMatch = decMatch || incMatch;
      if (!pctMatch) {
        return {
          question, verdict: null, abstain: true, freeText, method: methodId,
          basis: 'run() could not re-extract the percentage-change phrase that shapeTest found -- '
            + 'refusing rather than guessing.',
        };
      }
      const sign = decMatch ? -1 : 1;
      const pct = parseFloat(pctMatch[2]);
      if (!isFinite(pct)) {
        return {
          question, verdict: null, abstain: true, freeText, method: methodId,
          basis: 'percentage value did not parse to a finite number -- refusing.',
        };
      }

      // Re-extract the sole bare base number the same way shapeTest validated it: exclude the
      // percentage-number span and the multiplier-phrase span, then require exactly one left.
      const multIdx = question.search(multiplierRe);
      const multLen = multMatch[0].length;
      const pctPhraseIdx = question.indexOf(pctMatch[0]);
      const pctPhraseLen = pctMatch[0].length;
      const bareNumRe = /\d+(?:\.\d+)?/g;
      const candidates: number[] = [];
      let m: RegExpExecArray | null;
      while ((m = bareNumRe.exec(question)) !== null) {
        const idx = m.index;
        const len = m[0].length;
        const followedByPercent = /^\s*%/.test(question.slice(idx + len));
        if (followedByPercent) continue;
        const inMult = multIdx >= 0 && idx >= multIdx && idx < multIdx + multLen;
        const inPct = pctPhraseIdx >= 0 && idx >= pctPhraseIdx && idx < pctPhraseIdx + pctPhraseLen;
        if (inMult || inPct) continue;
        candidates.push(parseFloat(m[0]));
      }
      if (candidates.length !== 1) {
        return {
          question, verdict: null, abstain: true, freeText, method: methodId,
          basis: `re-extraction found ${candidates.length} candidate base numbers, expected `
            + 'exactly 1 -- refusing rather than guessing which one is the stage-1 base.',
        };
      }

      const stage1 = candidates[0];
      const stage2 = stage1 * factor;
      const stage3 = stage2 * (1 + (sign * pct) / 100);

      if (!isFinite(stage1) || !isFinite(stage2) || !isFinite(stage3)
        || stage1 < 0 || stage2 < 0 || stage3 < 0) {
        return {
          question, verdict: null, abstain: true, freeText, method: methodId,
          basis: 'a computed stage was negative or non-finite, which a real count/amount chain '
            + 'of this shape never produces -- refusing.',
        };
      }

      const totalRaw = stage1 + stage2 + stage3;
      const rounded = Math.round(totalRaw);
      const isNearInteger = Math.abs(totalRaw - rounded) < 1e-6;
      const verdict = isNearInteger ? String(rounded) : totalRaw.toFixed(2);

      return {
        question,
        verdict,
        abstain: false,
        freeText,
        method: methodId,
        basis: `stage1=${stage1} (bare base) -> stage2=stage1*${factor}=${stage2} (multiplier `
          + `phrase) -> stage3=stage2*(1${sign > 0 ? '+' : '-'}${pct}/100)=${stage3} (percentage `
          + `phrase) -> total=stage1+stage2+stage3=${totalRaw}, reported as ${verdict}.`,
      };
    } catch (e) {
      return {
        question, verdict: null, abstain: true, freeText, method: methodId,
        basis: `${methodId} threw: ${String((e as Error)?.message ?? e)}`,
      };
    }
  },
};


// REGISTERED AT IMPORT TIME. ACCEPTED by accept_gates.cjs in the Founder's promoted order gate 1
// then gate 2a then gate 4: 'solves its own shape, carries no answer, claims 1 and steals none'.
// ACCEPT means safe to register and is silent about interface fit, which is what this file adds.
registerMethod(seqMultiplierThenPercentAdjustTotalMethod);