// free_text_evidence.ts -- D-BP155-007/BISHOP/seg-freetext-reader
//
// THE FREE-TEXT READER -- FD-BP155-01, OPTION B, BUILT.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE RULING. Founder, BP155, verbatim: "B, clearly." Option B, as it was put to him: "build the
// free-text reader so the plow sorts honestly-unlabeled material." Option A -- assigning a capture
// a qid by text-matching it to the benchmark set -- was put to him and REJECTED.
//
// His governing principle, BP154, verbatim: "capture broadly, let the plow reject. Loose about
// what comes in, strict about labelling what came in." Under A the capture would lie about what it
// is so the plow would accept it. Under B (this file) the plow learns to read what the capture
// honestly is: an ambient_capture.ts:167 record with `qid: null`, UNCHANGED by this file.
//
// WHAT THIS FILE IS NOT. It does not invent a qid. It does not loosen the two existing null gates
// that keep free-text OUT of the per-qid mortgage path
// (liana_terminal_engine.ts:899 `parsed.qid != null ? ... : []`, and
// composer_step_evidence.ts:150 `if (qid == null) return [];`) -- both read, unmodified, by this
// ticket, and pinned unmodified by free_text_evidence.test.ts's own "null gates intact" tests.
// Those two gates answer "does this qid own this evidence?" -- correctly "no" for free-text,
// because a shared 'free-text' bucket cannot uniquely address one question (see
// liana_terminal_engine.ts:885-889's own comment). This file answers a DIFFERENT question a
// derivation is allowed to ask instead: "does this UNOWNED passage's own CONTENT answer the
// question I am asking right now?" -- selection by content relevance, never by identity, so the
// mixing risk that comment names never arises: nothing here claims a passage BELONGS to a qid,
// only that its own text overlaps the live question's own terms.
//
// HOW A FREE-TEXT CAPTURE REACHES A DERIVATION WITHOUT BEING ASSIGNED A QID (five lines):
//   1. The capture already sits on disk, honestly labeled qid:null, in the shared 'free-text'
//      bucket -- evidence_store.ts's own slugFor(null)/listAcquisitions(null, dir)/
//      loadAcquisition(null, id, dir), all UNMODIFIED, already support reading that bucket; the
//      barrier was never in evidence_store.ts, only in the two readers upstream of it.
//   2. readFreeTextEvidence(question, opts) below walks EVERY free-text acquisition and puts each
//      record's own answer text through a POSITIVE relevance test against `question`'s own
//      significant terms -- never the mere absence of a rejection (see judgeFreeTextRecord()).
//   3. A record that passes becomes a FreeTextPassage carrying its authority, surface, url,
//      capturedAt, and the STATED positive reason it was judged relevant -- never anonymous text.
//   4. toStepCandidates() adapts those passages to the exact StepPassageCandidate shape
//      composer_step_evidence.ts's own gatherMortgageCandidates()/gatherThisRunCandidates() already
//      produce (mechanism OWNED_EVIDENCE -- this is evidence already in hand, zero new queries,
//      the same honest classification a prior acquisition gets), so a step's owned-evidence stage
//      can consume a free-text passage exactly like it already consumes a prior acquisition.
//   5. No qid is ever written, read as authoritative identity, or inferred for a free-text record
//      anywhere in this file -- selection is 100% by content, the capture's own `qid: null` is
//      carried through untouched, and the two existing null gates keep gating everything else.
//
// REUSES THE EXISTING CAPTURE DISCIPLINE, PER THIS DISPATCH'S OWN INSTRUCTION. The positive test
// below is the SAME rejection rule ambient_capture.ts's own `failsQueryTermOverlap()` already
// applies at write time (itself a server-side re-application of capture_discipline.js's client-side
// gate): a passage naming none of the query's own significant terms cannot source a claim about
// it. `significantTerms()` just below reproduces ambient_capture.ts's own PRIVATE (unexported)
// helper of the same name, character-for-character the same recipe -- reproduced rather than
// imported because ambient_capture.ts is a file this dispatch's own non-negotiables forbid
// modifying even to add an export, and because composer_step_evidence.ts's own resolveMatchText()
// already established the idiom of reproducing a locked/sensitive file's private helper rather
// than touching that file (see that function's own header, citing cross_acquisition.ts's locked
// commit 7d001cff).
//
// WHY THIS IS A POSITIVE TEST, NOT THE ABSENCE OF A REJECTION (this dispatch's own non-negotiable
// 4). ambient_capture.ts's failsQueryTermOverlap() is deliberately lenient in one place: a query
// with zero significant terms is NOT rejected on that ground, because "absence of a signal is not
// evidence of failure" at WRITE time, where refusing too eagerly would silently drop a real capture
// forever. That leniency is correct for a write-time gate but wrong for a READ-time selection gate:
// this file cannot afford to wave a passage through just because it could not check it, so
// judgeFreeTextRecord() below treats a question with no significant terms as UNJUDGEABLE, never as
// a pass -- an honest "cannot verify" outcome, distinguishable from both "relevant" and "rejected".
//
// EVERY OUTCOME IS NAMED (non-negotiable 5). judgeFreeTextRecord() never throws and never returns a
// bare null/undefined for "I could not tell" -- it returns one of exactly three tagged outcomes,
// 'relevant' | 'rejected' | 'unjudgeable', each carrying its own reason. No `catch { return null }`
// exists anywhere in this file.
//
// DOES NOT IMPORT classify_cascade.ts OR plow_mc_answerer.ts (non-negotiable 6, the boundary held
// by D-BP154-072 and D-BP155-004). The only cross-file import here is a TYPE-ONLY import of
// StepPassageCandidate from composer_step_evidence.ts (zero runtime coupling, that file's own
// exported shape, not modified by this file) so toStepCandidates()' output is checked by the
// compiler to match what a Composer step's owned-evidence stage already consumes.

import { listAcquisitions, loadAcquisition } from './evidence_store';
import type { EvidenceRecord } from './evidence_store';
import type { StepPassageCandidate } from '../library/composer_step_evidence';

/** Reproduced from ambient_capture.ts's own PRIVATE significantTerms() -- see this file's header
 *  for why this is a reproduction, not an import. Extraction only (HARDWIRE-22): tokens of length
 *  >= 4, lowercased, no similarity/embedding/model judgment anywhere in this function. */
function significantTerms(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []);
}

/** Every field a passage must carry, inspectably, before it may reach a derivation
 *  (non-negotiable 3): its authority, its surface, its url, its capturedAt -- plus, on the
 *  FreeTextPassage that wraps this, the stated reason it was judged relevant. */
export interface FreeTextProvenance {
  authority: string;
  surface: string;
  url: string;
  capturedAt: string;
  acquisitionId: string;
  /** The text originally captured alongside this answer -- NOT necessarily the derivation's own
   *  question; kept so a reader can see what the capture was ostensibly answering, distinct from
   *  what it is now being used to answer. */
  capturedQuery: string;
  seq: number;
}

export interface FreeTextPassage {
  text: string;
  provenance: FreeTextProvenance;
  /** THE STATED REASON this passage was judged relevant -- positive evidence (which of the
   *  question's own terms it names), never merely "nothing rejected it" (non-negotiable 4). */
  relevanceReason: string;
}

/** Every outcome judgeFreeTextRecord() can return, all three NAMED (non-negotiable 5) --
 *  'rejected' (a positive test ran and failed) is never conflated with 'unjudgeable' (no positive
 *  test could be run at all: missing provenance, a non-free-text record, or a question with
 *  nothing to check against). */
export type FreeTextJudgment =
  | { outcome: 'relevant'; passage: FreeTextPassage }
  | { outcome: 'rejected'; reason: string; acquisitionId: string; seq: number }
  | { outcome: 'unjudgeable'; reason: string; acquisitionId: string; seq: number };

/**
 * Judges ONE evidence record against the question a live derivation is asking. Never throws.
 * Never returns a bare null/plausible-looking empty value for "could not tell" -- every path ends
 * in one of the three tagged FreeTextJudgment outcomes above, each carrying an inspectable reason.
 */
export function judgeFreeTextRecord(
  question: string,
  record: EvidenceRecord,
  acquisitionId: string,
): FreeTextJudgment {
  const { seq } = record;

  if (record.qid !== null) {
    return {
      outcome: 'unjudgeable',
      reason: `record carries qid ${record.qid}, not free-text -- this reader only judges qid:null records`,
      acquisitionId,
      seq,
    };
  }

  const resp = record.response as Record<string, unknown> | null;
  if (!resp || typeof resp !== 'object') {
    return {
      outcome: 'unjudgeable',
      reason: 'record response is empty or not an object -- no text to judge relevance against',
      acquisitionId,
      seq,
    };
  }

  const answer = typeof resp.answer === 'string' ? resp.answer.trim() : '';
  const surface = typeof resp.surface === 'string' ? resp.surface.trim() : '';
  const url = typeof resp.url === 'string' ? resp.url.trim() : '';
  const capturedAt = typeof resp.capturedAt === 'string' ? resp.capturedAt.trim() : '';
  const missing: string[] = [];
  if (!answer) missing.push('answer');
  if (!surface) missing.push('surface');
  if (!url) missing.push('url');
  if (!capturedAt) missing.push('capturedAt');
  if (missing.length > 0) {
    return {
      outcome: 'unjudgeable',
      reason: `record is missing required provenance field(s): ${missing.join(', ')} -- a passage `
        + 'that arrives without full provenance is anonymous text and must not be usable',
      acquisitionId,
      seq,
    };
  }

  // THE POSITIVE TEST. A question with no significant terms cannot be positively checked against
  // -- refusing rather than treating "nothing to check" as "checked and passed" (non-negotiable 4,
  // and this file's header note on why this differs from ambient_capture.ts's write-time leniency).
  const questionTerms = [...new Set(significantTerms(question))];
  if (questionTerms.length === 0) {
    return {
      outcome: 'unjudgeable',
      reason: 'the question being derived has no significant (4+ character alphanumeric) terms to '
        + 'test relevance against -- relevance must be a positive test and none is possible here; '
        + 'refusing rather than assuming a pass',
      acquisitionId,
      seq,
    };
  }

  const answerLower = answer.toLowerCase();
  const matched = questionTerms.filter((t) => answerLower.includes(t));
  if (matched.length === 0) {
    return {
      outcome: 'rejected',
      reason: 'answer text names none of the question\'s own significant terms '
        + `(checked: ${questionTerms.join(', ')}) -- a passage naming none of the question's terms `
        + 'cannot source a claim about it (estate rejection rule, reused from ambient_capture.ts\'s '
        + 'failsQueryTermOverlap)',
      acquisitionId,
      seq,
    };
  }

  const provenance: FreeTextProvenance = {
    authority: record.authority,
    surface,
    url,
    capturedAt,
    acquisitionId,
    capturedQuery: record.query,
    seq,
  };
  return {
    outcome: 'relevant',
    passage: {
      text: answer,
      provenance,
      relevanceReason: `answer text contains ${matched.length} of the question's own significant `
        + `term(s): ${matched.join(', ')}`,
    },
  };
}

export interface FreeTextReadResult {
  relevant: FreeTextPassage[];
  rejected: Array<{ reason: string; acquisitionId: string; seq: number }>;
  unjudgeable: Array<{ reason: string; acquisitionId: string; seq: number }>;
  acquisitionsScanned: number;
  /** Passed straight through from every loadAcquisition() call this function makes -- a malformed
   *  line is counted, never silently absorbed, same discipline evidence_store.ts's own
   *  summarizeEvidenceStore() already holds to. */
  malformedLines: number;
}

/**
 * THE READER. Scans EVERY free-text acquisition on disk -- listAcquisitions(null, dir) and
 * loadAcquisition(null, id, dir), both UNMODIFIED, already-exported evidence_store.ts functions;
 * qid:null already routes to the shared 'free-text' bucket by construction, so no new file-listing
 * logic is needed here -- and judges each record against `question`. No capture is ever assigned a
 * qid by this function: it reads the SAME honestly-labeled qid:null records the write side already
 * produced, and selects by CONTENT relevance to the question at hand, never by identity.
 */
export function readFreeTextEvidence(
  question: string,
  opts?: { dir?: string },
): FreeTextReadResult {
  const dir = opts?.dir;
  const ids = listAcquisitions(null, dir);
  const relevant: FreeTextPassage[] = [];
  const rejected: Array<{ reason: string; acquisitionId: string; seq: number }> = [];
  const unjudgeable: Array<{ reason: string; acquisitionId: string; seq: number }> = [];
  let malformedLines = 0;

  for (const acquisitionId of ids) {
    const { acquisition, malformedLines: m } = loadAcquisition(null, acquisitionId, dir);
    malformedLines += m;
    if (!acquisition) continue;
    for (const record of acquisition.records) {
      const judgment = judgeFreeTextRecord(question, record, acquisitionId);
      if (judgment.outcome === 'relevant') {
        relevant.push(judgment.passage);
      } else if (judgment.outcome === 'rejected') {
        rejected.push({ reason: judgment.reason, acquisitionId: judgment.acquisitionId, seq: judgment.seq });
      } else {
        unjudgeable.push({ reason: judgment.reason, acquisitionId: judgment.acquisitionId, seq: judgment.seq });
      }
    }
  }

  return {
    relevant, rejected, unjudgeable, acquisitionsScanned: ids.length, malformedLines,
  };
}

/**
 * Adapts FreeTextPassage[] to the EXACT StepPassageCandidate shape composer_step_evidence.ts's own
 * gatherMortgageCandidates()/gatherThisRunCandidates() already produce, so a Composer step's
 * owned-evidence stage CAN consume a free-text passage through the identical plumbing it already
 * uses for a prior acquisition or this run's own passages -- without this file importing or
 * modifying that file's null gate at :150, and without any step being wired to call this by this
 * dispatch (that wiring decision, and which step(s) should make it, is not authorized by this
 * ticket -- see this dispatch's own return for the honest statement of what remains).
 *
 * Mechanism is OWNED_EVIDENCE: a free-text passage is evidence already in hand (zero new queries
 * to produce it), the SAME honest classification gatherMortgageCandidates() gives a prior
 * acquisition's reused record. sourceId is structural (acquisitionId + seq), matching
 * sameDerivationPath()'s own (mechanism, sourceId) equality contract in composer_step_evidence.ts.
 */
export function toStepCandidates(passages: FreeTextPassage[]): StepPassageCandidate[] {
  return passages.map((p) => ({
    text: p.text,
    via: `owned:free-text(${p.provenance.authority}, ${p.provenance.surface}, `
      + `captured ${p.provenance.capturedAt}) -- ${p.relevanceReason}`,
    provenance: {
      mechanism: 'OWNED_EVIDENCE' as const,
      sourceId: `free-text:${p.provenance.acquisitionId}:${p.provenance.seq}`,
      detail: `ambient free-text capture, acquisition ${p.provenance.acquisitionId} seq ${p.provenance.seq}, `
        + `authority ${p.provenance.authority}, surface ${p.provenance.surface}, url ${p.provenance.url}, `
        + `captured ${p.provenance.capturedAt} -- ${p.relevanceReason}`,
    },
  }));
}
