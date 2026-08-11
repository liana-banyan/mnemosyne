// elements/answer_key_exclusion_reask.ts -- E-ANSWER-KEY-EXCLUSION-REASK --
// D-BP152-032/BISHOP/seg-auto-method-and-key-exclusion, STAGE 2.
//
// Founder, BP152, verbatim, the whole mandate this file answers:
//
//   "we need a way... to eliminate the sources that turn out to be answer keys. Like simply
//   having another query that asks how to ask for the same thing, but removing the particular
//   sources that were the answer key, like 'do the same question again, but this time don't
//   include information from (answer key response source).'"
//
// BISHOP'S FRAMING, AND THE BUILD FOLLOWS IT: asking a source to exclude information is a request
// that may be silently ignored. So this is a DIFFERENTIAL TEST, not a fix. It does not remove
// contamination from anything; it MEASURES whether a re-ask that names the offending source
// changes the answer, and records the comparison. Nothing here promotes, ranks, or replaces a
// prior answer -- FD-BP152-10: "nothing promotes automatically."
//
// DETECTION REUSES elements/answer_key_guard.ts. NO SECOND DETECTOR, NO WORD LIST, NO DOMAIN LIST.
// This ticket's own instruction: "It already discards passages carrying answer-declaring phrases
// (D-BP150-019 FIX 1a, e.g. 'top answer:'). REUSE IT." `findAnswerKeyMarker()` (imported, not
// reimplemented) is called against the captured passage/answer text, exactly the same predicate
// answer_key_guard.ts's own extraction path already uses -- see that file's header for why it
// checks the PASSAGE, not just the extracted sentence. This module adds no marker phrases, no
// domain vocabulary, and no test-bank site list anywhere.
//
// WHAT THIS FILE DOES NOT DO. It does not judge which answer is "better" (HARDWIRE-22: no model
// call here judges anything). It does not touch any method's verdict logic, the plow, or
// src/main/liana_cycle/library/. It does not change askGoogle, googleBlocks(), or gemmaExtract()
// -- it calls them the same way every other "ask*" function in this estate already does
// (survey_stage.ts's askConstraint()/askThreshold() are the closest precedent, mirrored here).

import type { MethodRunContext } from '../method_registry';
import { googleBlocks, gemmaExtract, norm } from '../methods/comparative_cascade';
import { findAnswerKeyMarker } from './answer_key_guard';

function nowIso(): string {
  return new Date().toISOString();
}

/** What the caller hands in -- an already-captured answer this module tests, never re-derives.
 *  `originalQuery` is REQUIRED, verbatim, so the re-ask can say "do the same question again"
 *  against the actual question that was asked, never a paraphrase of it. */
export interface CapturedAnswer {
  /** The exact query text that produced `answerText`, verbatim. */
  originalQuery: string;
  /** The returned/captured answer text itself. */
  answerText: string;
  /** The raw source passage the answer was extracted from (e.g. GoogleAnswer.text). Checked at
   *  the PASSAGE level, same discipline as answer_key_guard.ts's own findAnswerKeyMarker() -- an
   *  answer-key marker can appear in the surrounding passage even when the extracted answer
   *  sentence itself does not carry it (see that file's own header, the homework.study.com case). */
  sourcePassage: string;
  /** Citation URL(s) attached to this answer, unmodified -- same convention as every other
   *  citations field in this estate. */
  citations: string[];
}

/** The three outcomes this ticket's own STAGE 2 spec names, plus the honest "could not test"
 *  states this module never collapses into one of the three (a test that could not run is not a
 *  test that passed). */
export type AnswerKeyExclusionOutcome =
  | 'NOT_RUN_NO_MARKER'            // no answer-key marker found -- nothing to test
  | 'NOT_RUN_NO_CITATION'          // marker found, but no citation URL to name in the exclusion
  | 'NOT_RUN_TRANSPORT_REFUSED'    // 'gemma' transport selected -- HARDWIRE-22 refuses
  | 'NOT_RUN_REASK_UNREACHABLE'    // the exclusion re-ask itself failed/unreachable
  | 'EXCLUSION_NOT_HONORED'        // same answer AND the same source cited again
  | 'ANSWER_CHANGED'               // answer changed -- measured contamination finding
  | 'ANSWER_SURVIVED_WITHOUT_KEY'; // answer unchanged, source gone

export interface AnswerKeyExclusionTestResult {
  /** True once an exclusion re-ask query was actually sent. False for every NOT_RUN_* outcome
   *  except NOT_RUN_REASK_UNREACHABLE (the query WAS sent; it came back empty). */
  ran: boolean;
  outcome: AnswerKeyExclusionOutcome;
  markerFound: { label: string } | null;
  sourceExcluded: string | null;
  exclusionQuery: string | null;
  /** The FIRST answer, verbatim, exactly as captured -- NEVER overwritten or removed by this
   *  function, regardless of outcome. */
  firstAnswer: { text: string; citations: string[] };
  /** The SECOND (re-ask) answer, verbatim -- null only when the re-ask never produced one. Recorded
   *  alongside `firstAnswer`, never in place of it. */
  secondAnswer: { text: string; citations: string[] } | null;
  why: string;
}

/**
 * DETECTION. Reuses elements/answer_key_guard.ts's findAnswerKeyMarker() -- no second detector.
 * Checks the source passage first (same discipline that file's own header requires), falling back
 * to the captured answer text itself (the "returned text" this ticket's own Stage 2 spec names as
 * a detection input alongside citations). Picks the first citation as "the source" to name in the
 * exclusion re-ask -- the Founder's own phrasing names a single "(answer key response source)";
 * inventing a rule to pick among several would be exactly the tare HARDWIRE-23 forbids, so this
 * takes citations[0] (source order, no ranking) and nothing more elaborate.
 */
export function detectAnswerKeySource(
  captured: CapturedAnswer,
): { marker: { label: string }; sourceCitation: string | null } | null {
  const marker = findAnswerKeyMarker(captured.sourcePassage) ?? findAnswerKeyMarker(captured.answerText);
  if (!marker) return null;
  const sourceCitation = captured.citations.length ? captured.citations[0] : null;
  return { marker, sourceCitation };
}

/**
 * Builds the re-ask query in the Founder's OWN phrasing shape, verbatim, term-substituted only
 * with the original query and the source to exclude -- his words, quoted at this file's own
 * header (D-BP152-032's dispatch): "do the same question again, but this time don't include
 * information from (answer key response source)."
 */
export function buildExclusionReaskQuery(originalQuery: string, sourceToExclude: string): string {
  return `${originalQuery}, but this time don't include information from ${sourceToExclude}.`;
}

/**
 * THE DIFFERENTIAL TEST. Detects, re-asks, compares, records -- never silently replaces the first
 * answer with the second (this ticket's own requirement, restated at every return below). No
 * verdict language about quality is produced (FD-BP152-10: nothing promotes automatically) --
 * `outcome` names what DIFFERED, mechanically; the operator judges what it means.
 *
 * 'gemma' REFUSES, same rule and same ATTRIBUTION every other ask*() function in this estate's
 * survey path already follows (FD-BP152, verbatim: "strip out the authorization. Gemma will
 * never be good enough to make decisions, sadly.") -- there is no passage to extract from until
 * Google (or another live source) answers the exclusion query, and reasoning about it directly
 * would be judgment, not extraction.
 */
export async function runAnswerKeyExclusionTest(
  captured: CapturedAnswer,
  ctx: MethodRunContext,
  transport: 'google' | 'gemma' = 'google',
): Promise<AnswerKeyExclusionTestResult> {
  const firstAnswer = { text: captured.answerText, citations: captured.citations };
  const detection = detectAnswerKeySource(captured);

  if (!detection) {
    const why = 'no answer-key marker (elements/answer_key_guard.ts findAnswerKeyMarker(), reused '
      + 'unmodified) was found in the captured source passage or the answer text -- nothing to test; '
      + 'this is a differential test for a DETECTED answer-key-like source, not a general re-ask';
    return {
      ran: false, outcome: 'NOT_RUN_NO_MARKER', markerFound: null, sourceExcluded: null,
      exclusionQuery: null, firstAnswer, secondAnswer: null, why,
    };
  }

  if (!detection.sourceCitation) {
    const why = `an answer-key marker ("${detection.marker.label}") was found, but no citation URL `
      + 'was captured alongside this answer to name in the exclusion re-ask -- refusing rather than '
      + "guessing a source name (the Founder's own phrasing names a specific "
      + '"(answer key response source)")';
    return {
      ran: false, outcome: 'NOT_RUN_NO_CITATION', markerFound: detection.marker, sourceExcluded: null,
      exclusionQuery: null, firstAnswer, secondAnswer: null, why,
    };
  }

  const exclusionQuery = buildExclusionReaskQuery(captured.originalQuery, detection.sourceCitation);

  if (transport === 'gemma') {
    const why = 'REFUSED: HARDWIRE-22 ("a local model may only be asked to COPY OUT what is literally '
      + 'present in a text it was given") forbids this call -- there is no passage yet to extract '
      + 'from, only a re-ask query to issue, which requires a live source to answer. Same rule as '
      + "every other ask*() function in this estate's survey path (FD-BP152, verbatim: \"strip out the "
      + 'authorization. Gemma will never be good enough to make decisions, sadly."). No model call was '
      + 'made, and this does not fall back to Google.';
    ctx.emit({ kind: 'note', text: `   [transport: GEMMA] ${why}`, ts: nowIso() });
    return {
      ran: false, outcome: 'NOT_RUN_TRANSPORT_REFUSED', markerFound: detection.marker,
      sourceExcluded: detection.sourceCitation, exclusionQuery, firstAnswer, secondAnswer: null, why,
    };
  }

  ctx.emit({
    kind: 'note',
    text: `   PARSER INSTRUMENT [answer-key-exclusion-reask] query SENT to Google (untruncated, verbatim)="${exclusionQuery}"`,
    ts: nowIso(),
  });
  const google = await googleBlocks(ctx.askGoogle, exclusionQuery);
  if (!google.ok || !google.text.trim()) {
    // D-BP152-050: "unreachable" removed -- google.via (comparative_cascade.ts's googleBlocks(),
    // same ticket) now names the real reason, which is not always unreachability (a structural
    // verification/rate-limit challenge means Google answered and refused). The
    // NOT_RUN_REASK_UNREACHABLE outcome literal itself is left unchanged (out of this ticket's
    // scope, and other code may switch on it) -- only this human-readable `why` string changed.
    const why = `the exclusion re-ask itself failed (${google.via}) -- the FIRST answer is `
      + 'NOT replaced or treated as clean; nothing can be concluded about contamination from this '
      + 'attempt, an honest inconclusive result, not a fabrication';
    return {
      ran: true, outcome: 'NOT_RUN_REASK_UNREACHABLE', markerFound: detection.marker,
      sourceExcluded: detection.sourceCitation, exclusionQuery, firstAnswer, secondAnswer: null, why,
    };
  }
  const googlePassageForLog = google.text.length > 4000 ? google.text.slice(0, 4000) : google.text;
  ctx.emit({
    kind: 'note',
    text: `   PARSER INSTRUMENT [answer-key-exclusion-reask] Google passage handed to gemmaExtract()`
      + `${google.text.length > 4000 ? ` (TRUNCATED at 4000 chars, full untruncated length was ${google.text.length})` : ' (untruncated, verbatim)'}`
      + `="${googlePassageForLog}"`,
    ts: nowIso(),
  });
  const instruction = 'Report, verbatim, what the passage states as the answer to the question, having '
    + 'excluded the named source. Copy the stated answer exactly as the passage gives it -- do not '
    + 'summarize, infer, or add anything the passage does not state.';
  const shape = '{"answer":"the answer exactly as the passage states it, or empty string if the passage does not state one"}';
  const ex = await gemmaExtract(instruction, google.text, shape);
  const secondText = typeof (ex as { answer?: unknown } | null)?.answer === 'string' ? (ex as { answer: string }).answer.trim() : '';
  const secondAnswer = { text: secondText, citations: google.sources };

  // COMPARISON. Exact normalized equality only (HARDWIRE-22: "similarity is not identity, never
  // fuzzy") -- reuses comparative_cascade.ts's own norm(), the same normalization
  // answer_key_guard.ts's isNearVerbatimOptionMatch() already relies on, not a new comparison rule.
  const sameAnswer = !!secondText && norm(secondText) === norm(firstAnswer.text);
  const sourceStillNamed = google.sources.includes(detection.sourceCitation)
    || !!findAnswerKeyMarker(google.text);

  let outcome: AnswerKeyExclusionOutcome;
  let why: string;
  if (sameAnswer && sourceStillNamed) {
    outcome = 'EXCLUSION_NOT_HONORED';
    why = `the re-ask returned the SAME answer ("${secondText}") and the excluded source `
      + `("${detection.sourceCitation}") was still cited, or the same answer-key marker was still `
      + 'present, in the re-ask response -- the exclusion request was NOT HONORED. Do NOT treat the '
      + 'second answer as clean; it rests on the same source the first answer did';
  } else if (!sameAnswer) {
    outcome = 'ANSWER_CHANGED';
    why = `the re-ask's answer ("${secondText || '(empty)'}") differs from the first `
      + `("${firstAnswer.text}") -- recorded as a MEASURED CONTAMINATION FINDING: the original `
      + 'answer appears to have depended on the excluded source. No quality/correctness verdict is '
      + 'made here (FD-BP152-10: nothing promotes automatically) -- the operator judges which answer, '
      + 'if either, is right';
  } else {
    outcome = 'ANSWER_SURVIVED_WITHOUT_KEY';
    why = `the re-ask returned the SAME answer ("${secondText}") and the excluded source `
      + '(citation and marker) is gone from the re-ask response -- the answer SURVIVES WITHOUT THE '
      + 'KEY. Recorded as a comparison, not a promotion';
  }

  ctx.emit({
    kind: 'note',
    text: `   ANSWER-KEY EXCLUSION TEST: ${outcome} -- excluded source="${detection.sourceCitation}" `
      + `first="${firstAnswer.text}" second="${secondText || '(empty)'}"`,
    ts: nowIso(),
  });

  return {
    ran: true, outcome, markerFound: detection.marker, sourceExcluded: detection.sourceCitation,
    exclusionQuery, firstAnswer, secondAnswer, why,
  };
}
