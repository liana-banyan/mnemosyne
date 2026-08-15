// ambient_capture.ts -- D-BP154-074/BISHOP-SEG/S74/seg-ambient
//
// THE RECORDING LEG FOR AMBIENT BROWSER CAPTURE -- A NEW CALLER, NOT A NEW WRITER.
//
// THE ORDER (D-BP154-074) and the coordinator follow-up, both verbatim in spirit: "into the
// existing evidence/eblet store... a new mechanism value for ambient browser capture, distinct
// from CONVERSATIONAL_ANSWER and DOCUMENT_CORROBORATION so a reader can always tell how a fact
// arrived... Reuse it; do not write a second evidence writer."
//
// BISHOP_DROPZONE\BP154_GOLD_ON_THE_FLOOR.md (D-BP154-071, read before this file was written)
// confirmed the human-driven Nexus capture path (stepped_audible.ts:747-825) is BUILT and ACTIVE,
// with query/span/mechanism-tag/provenance all present -- but that path is wired to the Liana
// Cycle's own paused-run resolve() mechanism (index.ts:5087-5096), which only exists while a run
// is sitting at a Step 0 pause. An ambient capture from a real Chrome tab has no run to resolve
// and no pause to answer -- it needs its OWN caller into the SAME underlying persistence, not a
// reuse of stepped_audible.ts's function signature. That underlying persistence is
// evidence_store.ts's appendEvidence() (append-only, content-addressed, the same store every
// authority query in this codebase already lands in) -- THIS file is that new caller, and
// nothing else in this file duplicates what appendEvidence() already does.
//
// MECHANISM TAG. composer_step_evidence.ts's ClaimMechanism union ('OWNED_EVIDENCE' |
// 'CONVERSATIONAL_ANSWER' | 'DOCUMENT_CORROBORATION' | 'NOT_OBTAINED') is scoped to the
// Composer's in-memory step plumbing, not itself a disk field -- it is not extended here (out of
// scope, would touch a file mid-active-development this ticket does not own). The DISK-LEVEL
// distinguishing tag is evidence_store.ts's own `EvidenceAuthority`, extended additively this
// same dispatch with 'ambient_browser' (see that file's header comment). This file ALSO stamps a
// human-readable `mechanism: 'AMBIENT_BROWSER_CAPTURE'` string inside the record's own response
// payload, in the same UPPER_SNAKE naming convention as ClaimMechanism's members, so a reader
// scanning either the authority field or the response body can tell this apart from
// CONVERSATIONAL_ANSWER/DOCUMENT_CORROBORATION/nexus_capture at a glance.
//
// THE REJECTION RULE, applied a SECOND time server-side (extraction discipline, HARDWIRE-22-safe,
// never a similarity judgment -- plain substring containment, same family as appearsIn() /
// classify_cascade.ts's "a passage naming none of the options cannot source a claim about them",
// independently re-derived here for QUERY TERMS rather than MC OPTIONS since an ambient capture
// has no lettered options). The extension's content script already applies this at the capture
// hop (capture_discipline.js, browser-extension/lib) -- this is DEFENSE IN DEPTH, not the only
// gate, exactly the two-gate shape option_membership.ts documents for the embedded-browser path.
//
// NEVER CREDENTIALS. This module never sees raw page DOM or input values -- it only ever receives
// whatever the content script already extracted as visible turn/result text. The content script's
// own discipline (never touch input[type=password], never touch input/textarea values at all,
// only rendered turn/result nodes) is documented in capture_discipline.js; this file adds one more
// belt-and-suspenders check (rejectIfLooksLikeCredentialField) so a malformed or compromised
// client cannot use this route to smuggle a password-shaped string into the evidence ledger.

import { appendEvidence, type EvidenceRecord } from './evidence_store';

export interface AmbientCapturePayload {
  /** The question/search text exactly as submitted -- untruncated, verbatim. */
  query: string;
  /** The answer/result text exactly as rendered -- untruncated, verbatim. May be a single answer
   *  (chat surfaces) or a newline-joined set of result snippets (search surfaces); the caller
   *  (the /capture route) does not distinguish the two shapes further than this. */
  answer: string;
  /** Which named surface produced this capture -- one of the five the order names. */
  surface: 'claude.ai' | 'chatgpt.com' | 'gemini.google.com' | 'perplexity.ai' | 'google.com';
  /** The page URL captured from, for provenance. */
  url: string;
  /** ISO 8601 UTC, from the content script's own capture moment. */
  capturedAt: string;
}

export interface AmbientCaptureRejection {
  ok: false;
  reason: string;
}

export interface AmbientCaptureAccepted {
  ok: true;
  record: EvidenceRecord;
}

const MIN_QUERY_LEN = 2;
const MIN_ANSWER_LEN = 2;

/** Extraction, not judgment (HARDWIRE-22): tokenizes on non-word boundaries, keeps tokens of
 *  length >= 4 (the same "significant word" threshold this estate's own query-term overlap
 *  checks use elsewhere), lowercases. Pure function, independently authored for this file --
 *  not a port of classify_cascade.ts's own (forbidden) tokenizer. */
function significantTerms(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []);
}

/** THE REJECTION RULE, server-side copy: a passage naming none of the query's own terms cannot
 *  source a claim about it. Extraction-only substring containment, no similarity/embedding/model
 *  judgment anywhere in this function. Returns true (reject) when the query has at least one
 *  significant term and NONE of them appear in the answer text. A query with zero significant
 *  terms (e.g. all short/stop words) cannot be checked this way and is NOT rejected on this
 *  ground -- absence of a signal is not evidence of failure (same discipline as the rest of this
 *  file: an honest "cannot check" never masquerades as "checked and passed" OR "checked and
 *  failed"). */
export function failsQueryTermOverlap(query: string, answer: string): boolean {
  const terms = significantTerms(query);
  if (terms.length === 0) return false;
  const answerLower = answer.toLowerCase();
  return !terms.some((t) => answerLower.includes(t));
}

/** Guards against the exact defect the order names: "a capture must never be an echoed prompt."
 *  Whitespace-normalized exact-equality only -- deliberately narrow (a real answer that happens
 *  to quote the whole question back is rare and this function does not try to detect paraphrase,
 *  which would require judgment this file must not exercise). */
export function looksLikeEchoedPrompt(query: string, answer: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  const q = norm(query);
  const a = norm(answer);
  return q.length > 0 && q === a;
}

/** Belt-and-suspenders, server side: the content script must never send input[type=password]
 *  content, but this checks the payload's own shape for the field names a compromised or buggy
 *  client might mistakenly include, and refuses to persist them. Structural key-name check only
 *  -- never inspects arbitrary payload values beyond the named fields this interface declares. */
function payloadNamesCredentialField(raw: unknown): boolean {
  if (typeof raw !== 'object' || raw === null) return false;
  const keys = Object.keys(raw as Record<string, unknown>).map((k) => k.toLowerCase());
  return keys.some((k) => k.includes('password') || k.includes('credential') || k === 'cc' || k.includes('card_number') || k.includes('cardnumber'));
}

/** Records one ambient browser capture into the SAME append-only evidence ledger every other
 *  authority query in this codebase already lands in -- appendEvidence(), evidence_store.ts,
 *  unmodified in this file. Rule 66 (append-only, no update/delete) is inherited automatically:
 *  this function never reads-then-rewrites, it only ever calls appendEvidence() once per capture.
 *
 *  qid is always null here (an ambient capture is free-text, not tied to an MMLU-Pro question id)
 *  -- consistent with gatherMortgageCandidates()'s own `if (qid == null) return []` handling of
 *  free-text input elsewhere in this codebase; a later mortgage/convergence pass over free-text
 *  acquisitions is a genuinely separate, not-yet-built concern, not silently assumed here. */
export function recordAmbientBrowserCapture(
  payload: AmbientCapturePayload,
  rawPayloadForCredentialCheck: unknown,
  seq: number,
  dir?: string,
): AmbientCaptureAccepted | AmbientCaptureRejection {
  const query = (payload.query ?? '').trim();
  const answer = (payload.answer ?? '').trim();

  if (query.length < MIN_QUERY_LEN) return { ok: false, reason: 'query is empty or too short' };
  if (answer.length < MIN_ANSWER_LEN) return { ok: false, reason: 'answer is empty or too short' };
  if (payloadNamesCredentialField(rawPayloadForCredentialCheck)) {
    return { ok: false, reason: 'payload names a credential-shaped field -- refused, never persisted' };
  }
  if (looksLikeEchoedPrompt(query, answer)) {
    return { ok: false, reason: 'answer is identical to the query (echoed prompt) -- not a real capture' };
  }
  if (failsQueryTermOverlap(query, answer)) {
    return {
      ok: false,
      reason: 'answer text names none of the query\'s own significant terms -- a passage naming '
        + 'none of the query\'s terms cannot source a claim about it (estate rejection rule, '
        + 'applied server-side as a second gate)',
    };
  }

  const record = appendEvidence({
    authority: 'ambient_browser',
    query,
    response: {
      mechanism: 'AMBIENT_BROWSER_CAPTURE',
      answer,
      surface: payload.surface,
      url: payload.url,
      capturedAt: payload.capturedAt,
    },
    acquisitionId: `ambient_${payload.surface}_${payload.capturedAt.replace(/[:.]/g, '-')}`,
    qid: null,
    seq,
    ts: payload.capturedAt,
    dir,
  });

  return { ok: true, record };
}
