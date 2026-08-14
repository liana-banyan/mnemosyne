// verdict_evaluator.ts -- D-BP154-035/BISHOP-SEG/S35/seg-purefunction
//
// THE VERDICT AS A PURE FUNCTION. Founder ruling, BP154, FD-BP154-11 (RULINGS_BP154.md), verbatim
// formalization: "V = f(A, E, R, Q)" -- A an immutable artifact record (wording, options, metadata,
// source, category, dataset version, content hash), E an immutable evidence snapshot (document
// text, extracted spans, source URL, retrieval timestamp, content hash, admission status), R a
// VERSIONED rule set, Q an ordered acquisition log including failed attempts and their status.
// "During evaluation: no network access, no model generation, no timestamp-dependent logic, no
// random sampling, no mutable external state. Rerun the same evaluator against the same
// content-addressed snapshot and it returns the same verdict AND the same derivation chain."
//
// PHASE A OF THIS TICKET (reported, not repeated here -- see the dispatch's own final report)
// found that softballs_step.ts / named_set_step.ts / discriminator_step.ts / magnitude_step.ts /
// human_nuance_step.ts each INTERLEAVE acquisition (gemmaExtract/googleBlocks/
// askConversationalAuthority, all network+model) with their own local elimination decision, inside
// one async run*Step() function -- and that terminator_step.ts, alone among the six, does NOT:
// its own header states plainly (line 55) "this reducer needs none of its exports -- no
// gemmaExtract call, no googleBlocks call, nothing," its two decision functions
// (deriveTerminatorEliminations, computeFrameMatchBuckets) are literally `pure, synchronous, no
// I/O` per their own doc comments, and runTerminatorStep()'s own `_ctx: MethodRunContext` parameter
// is unused (underscore-prefixed) -- it does not touch even the ONE capability (askGoogle) every
// other step requires. THE SPLIT PHASE B ASKS FOR ALREADY EXISTS AT EXACTLY ONE SEAM: the boundary
// between the five ACQUIRE steps and Terminator:1's own pure reduction over their already-computed
// results (SoftballsResult / NamedSetResult / DiscriminatorResult / MagnitudeResult /
// HumanNuanceResult -- each already a plain, JSON-serializable value, not a live handle).
//
// THIS FILE FORMALIZES THAT EXISTING SEAM, IT DOES NOT INVENT A NEW ONE. It adds: (1) an explicit,
// content-hashed A/E/R/Q snapshot type per FD-BP154-11's own formalization, so "immutable" and
// "content-addressed" are properties the code enforces (an integrity check against the stored hash
// on every evaluate call, not merely a comment saying so); (2) a single evaluateVerdict() entry
// point that calls terminator_step.ts's existing, UNMODIFIED runTerminatorStep() against a
// deliberately-hostile MethodRunContext whose askGoogle/askConversationalAuthority both THROW if
// ever invoked -- proving, per call, that evaluation never reaches for either; (3) a flat,
// deterministic derivation chain projected from TerminatorResult's own eliminated[]/magnitudeBasis/
// contradiction fields, so a caller has one ordered list to display or hash, not five nested
// records to reconcile by hand.
//
// WHAT THIS FILE DOES NOT DO, NAMED SO IT IS NOT MISTAKEN FOR MORE THAN IT IS. It does NOT split
// the five ACQUIRE steps' own interleaved acquire+evaluate passes -- that is a separate, much
// larger piece of work (each of those five files would need its own local elimination logic lifted
// out into a second, pure pass over an already-extracted candidate list) and stays an OPEN
// architecture item, reported honestly in this dispatch's final report rather than claimed done
// here. It does NOT modify terminator_step.ts, softballs_step.ts, named_set_step.ts,
// discriminator_step.ts, magnitude_step.ts, or human_nuance_step.ts -- every import below is
// read-only, exactly the discipline composer_step_evidence.ts's own header already states for its
// own imports of comparative_cascade.ts. classify_cascade.ts is not imported. googleBlocks() is not
// called, directly or indirectly, anywhere in this file.
//
// REUSE, DO NOT REINVENT (FD-BP154-04's own instruction, applied here): the elimination rules
// themselves are NOT re-implemented -- this file calls terminator_step.ts's own
// deriveTerminatorEliminations()/computeFrameMatchBuckets()/runTerminatorStep() unchanged. A third
// implementation of UNIQUE OR ABSTAIN would be exactly the duplication FD-BP154-04 warns against.

import { createHash } from 'node:crypto';
import type { MethodQuestionInput, MethodRunContext } from '../method_registry';
import type { ComposerStepOutcome } from './script_bridge';
import { runTerminatorStep } from './terminator_step';
import type { TerminatorResult } from './terminator_step';

// ───────────────────────────── content addressing (A / E integrity) ─────────────────────────────

/** Deterministic, key-order-independent JSON serialization -- the SAME discipline this estate
 *  already applies to span/claim identity (composer_step_evidence.ts's own contentId()), extended
 *  here to whole objects/arrays so two logically-identical snapshots hash identically regardless of
 *  the order their fields happened to be constructed in. Pure, synchronous, no I/O. */
export function canonicalStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  const walk = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    if (seen.has(v as object)) throw new Error('canonicalStringify: circular reference is not a valid immutable snapshot value');
    seen.add(v as object);
    if (Array.isArray(v)) return v.map(walk);
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      out[k] = walk((v as Record<string, unknown>)[k]);
    }
    return out;
  };
  return JSON.stringify(walk(value));
}

/** Content-addressed identity for any immutable snapshot value -- sha256 of its canonical form,
 *  same primitive composer_step_evidence.ts's own contentId() already uses for live response text,
 *  applied here to whole A/E records per FD-BP154-11's own literal requirement ("content hash"). */
export function contentHash(value: unknown): string {
  return createHash('sha256').update(canonicalStringify(value)).digest('hex');
}

// ─────────────────────────────────── A: the artifact record ───────────────────────────────────

/** FD-BP154-11's own field list, verbatim: "wording, options, metadata, source, category, dataset
 *  version, content hash." `question`/`options`/`qid` are the SAME MethodQuestionInput fields every
 *  Composer step already receives -- this is not a second, competing artifact model, it is that one
 *  named and hashed. `source`/`category`/`datasetVersion` are optional because not every input has
 *  them (a Founder-typed free-text question has no bundled-corpus provenance at all) -- absence is
 *  recorded as `null`, never guessed. */
export interface ArtifactRecord {
  qid: number | null;
  question: string;
  options: Record<string, string>;
  source: string | null;
  category: string | null;
  datasetVersion: string | null;
  /** sha256 of the canonical form of the fields above (this field excluded from its own hash
   *  input). Recomputed and checked on every evaluateVerdict() call -- see verifySnapshotIntegrity()
   *  below; a caller that mutates `options` after freezing (defeating TypeScript's own readonly,
   *  which is compile-time only) is caught here, not trusted. */
  contentHash: string;
}

export function freezeArtifactRecord(
  input: MethodQuestionInput,
  meta: { source?: string | null; category?: string | null; datasetVersion?: string | null } = {},
): ArtifactRecord {
  const base = {
    qid: input.qid ?? null,
    question: input.question,
    options: { ...(input.options ?? {}) },
    source: meta.source ?? null,
    category: meta.category ?? null,
    datasetVersion: meta.datasetVersion ?? null,
  };
  return Object.freeze({ ...base, contentHash: contentHash(base) });
}

// ─────────────────────────────────── E: the evidence snapshot ───────────────────────────────────

/** FD-BP154-11's own field list: "document text, extracted spans, source URL, retrieval timestamp,
 *  content hash, admission status." This estate's ACQUIRE steps already produce exactly this shape
 *  per claim (composer_step_evidence.ts's `StepPassageCandidate`/`ClaimProvenance`, each step's own
 *  `via`/span fields) -- E here is the ALREADY-COMPUTED, already-JSON-serializable output of those
 *  five steps (SoftballsResult / NamedSetResult / DiscriminatorResult / MagnitudeResult /
 *  HumanNuanceResult, each carried as `ComposerStepOutcome.raw`), not a re-extraction. `admitted`
 *  is this file's own reading of each outcome's own `raw.ok` field (a `raw` shape every one of
 *  those five result types already carries) -- true admission bookkeeping, not invented data. */
export interface EvidenceItem {
  stepId: string;
  admitted: boolean;
  /** The step's own raw result, exactly as script_bridge.ts's ComposerState.results already carries
   *  it -- never re-derived, re-summarized, or reshaped here. */
  raw: unknown;
}

export interface EvidenceSnapshot {
  items: EvidenceItem[];
  contentHash: string;
}

function readAdmitted(raw: unknown): boolean {
  return typeof raw === 'object' && raw !== null && 'ok' in raw
    ? Boolean((raw as { ok: unknown }).ok)
    : false;
}

export function freezeEvidenceSnapshot(priorResults: ComposerStepOutcome[]): EvidenceSnapshot {
  const items: EvidenceItem[] = priorResults.map((r) => ({
    stepId: r.id,
    admitted: readAdmitted(r.raw),
    raw: r.raw,
  }));
  return Object.freeze({ items, contentHash: contentHash(items) });
}

// ───────────────────────────────────── R: the rule set version ─────────────────────────────────────

/** FD-BP154-11: R is a VERSIONED rule set -- "artifact-class policy, membership rules, discriminator
 *  rules, conflict rules, abstention conditions." The rules THEMSELVES are not re-declared here
 *  (they live, unmodified, in terminator_step.ts -- deriveTerminatorEliminations()/
 *  computeFrameMatchBuckets()/runTerminatorStep() ARE the rule set); this constant is the version
 *  identifier that names WHICH build of those rules a given verdict was produced under, so a stored
 *  verdict can always be checked against the rule version that made it, per FD-BP154-11's own
 *  requirement that R be versioned. Bump this string, in the SAME commit, whenever
 *  terminator_step.ts's own elimination/abstention logic changes -- a verdict evaluated under one
 *  version is never silently compared against one evaluated under another. */
export const RULE_SET_VERSION = 'terminator_step.ts@FD-BP152-19+FD-BP154-24+FD-BP154-26+FD-BP154-29+FD-BP154-33:1';

// ───────────────────────────────────── Q: the acquisition log ─────────────────────────────────────

/** FD-BP154-11: Q is "an ordered acquisition log including failed attempts and their status." Every
 *  ACQUIRE step already knows this about itself (each of the five steps' own `via`/`error` fields,
 *  composer_step_evidence.ts's own ConversationalAttempt.error / CorroborationResult.error) --
 *  Q here is that same information, named, ordered, and carried alongside the frozen snapshot for
 *  audit, NOT a second computation of it. A caller that has no acquisition log to hand (e.g. a
 *  snapshot rebuilt from disk after the fact) may pass `[]`; crossCheckAcquisitionLog() below then
 *  simply reports zero entries checked, never fabricates any. */
export interface AcquisitionLogEntry {
  seq: number;
  stepId: string;
  mechanism: string;
  status: 'ok' | 'failed' | 'not_attempted';
  detail: string;
}

export interface LogConsistencyReport {
  ok: boolean;
  checked: number;
  mismatches: string[];
}

/** THE ONE PLACE Q is checked against E. A step Q marks 'failed' whose own E entry says `admitted:
 *  true` (or vice versa: Q says 'ok' but E says not admitted) is a genuine disagreement between the
 *  acquisition record and the evidence snapshot -- surfaced, never silently ignored (same
 *  "never absence-read-as-denial" discipline this estate already applies everywhere else). Does NOT
 *  change the verdict either way -- V is still computed from E and R alone, per FD-BP154-11's own
 *  formula; this is an audit report riding alongside it, not a fifth input the reducer branches on. */
export function crossCheckAcquisitionLog(
  evidence: EvidenceSnapshot, log: readonly AcquisitionLogEntry[],
): LogConsistencyReport {
  const byStep = new Map(evidence.items.map((it) => [it.stepId, it]));
  const mismatches: string[] = [];
  for (const entry of log) {
    const item = byStep.get(entry.stepId);
    if (!item) continue; // Q may log a step outside this evidence snapshot's own five feeders; not a mismatch.
    if (entry.status === 'ok' && !item.admitted) {
      mismatches.push(`${entry.stepId}: acquisition log says 'ok' but evidence snapshot shows not admitted`);
    }
    if (entry.status === 'failed' && item.admitted) {
      mismatches.push(`${entry.stepId}: acquisition log says 'failed' but evidence snapshot shows admitted`);
    }
  }
  return { ok: mismatches.length === 0, checked: log.length, mismatches };
}

// ───────────────────────────────────── the frozen snapshot ─────────────────────────────────────

export interface FrozenVerdictSnapshot {
  artifact: ArtifactRecord;
  evidence: EvidenceSnapshot;
  ruleSetVersion: string;
  acquisitionLog: readonly AcquisitionLogEntry[];
}

/** Assembles A + E + R + Q into one frozen, content-addressed record. Pure, synchronous. Call this
 *  ONCE, after acquisition is finished (every ACQUIRE step has already run and produced its
 *  ComposerStepOutcome) -- evaluateVerdict() below never acquires anything itself, so everything it
 *  needs must already be in `priorResults` by the time this function is called. */
export function freezeVerdictSnapshot(
  input: MethodQuestionInput,
  priorResults: ComposerStepOutcome[],
  options: {
    meta?: { source?: string | null; category?: string | null; datasetVersion?: string | null };
    acquisitionLog?: AcquisitionLogEntry[];
  } = {},
): FrozenVerdictSnapshot {
  return Object.freeze({
    artifact: freezeArtifactRecord(input, options.meta ?? {}),
    evidence: freezeEvidenceSnapshot(priorResults),
    ruleSetVersion: RULE_SET_VERSION,
    acquisitionLog: Object.freeze([...(options.acquisitionLog ?? [])]),
  });
}

function verifySnapshotIntegrity(snapshot: FrozenVerdictSnapshot): void {
  const { contentHash: aHash, ...aRest } = snapshot.artifact;
  if (contentHash(aRest) !== aHash) {
    throw new Error(
      'V = f(A, E, R, Q) INTEGRITY FAILURE: the artifact record\'s recomputed content hash does not '
      + 'match its stored hash -- A is no longer the value it was frozen as, refusing to evaluate '
      + 'a verdict against a snapshot that may have been mutated after freezing',
    );
  }
  const eHash = contentHash(snapshot.evidence.items);
  if (eHash !== snapshot.evidence.contentHash) {
    throw new Error(
      'V = f(A, E, R, Q) INTEGRITY FAILURE: the evidence snapshot\'s recomputed content hash does '
      + 'not match its stored hash -- E is no longer the value it was frozen as, refusing to '
      + 'evaluate a verdict against a snapshot that may have been mutated after freezing',
    );
  }
  if (snapshot.ruleSetVersion !== RULE_SET_VERSION) {
    throw new Error(
      `V = f(A, E, R, Q) VERSION MISMATCH: snapshot was frozen under rule set `
      + `"${snapshot.ruleSetVersion}" but this evaluator implements "${RULE_SET_VERSION}" -- `
      + 'refusing to evaluate a snapshot against a different R than the one it names',
    );
  }
}

// ───────────────────────────────────── the derivation chain ─────────────────────────────────────

export interface DerivationChainEntry {
  kind: 'elimination' | 'magnitude' | 'contradiction' | 'verdict' | 'abstain';
  detail: string;
}

/** Flattens TerminatorResult's own eliminated[]/magnitudeBasis/contradiction/verdict/abstainReason
 *  fields into ONE ordered list -- deterministic because every field it reads is itself already
 *  deterministic (eliminated[] is built by deriveTerminatorEliminations() in a fixed iteration
 *  order over plain arrays; nothing here reorders, filters by identity, or consults anything not
 *  already on `result`). Pure, synchronous. */
export function buildDerivationChain(result: TerminatorResult): DerivationChainEntry[] {
  const chain: DerivationChainEntry[] = [];
  for (const e of result.eliminated) {
    chain.push({
      kind: 'elimination',
      detail: `${e.letter}) ${e.name} eliminated by ${e.sourceStep} -- ${e.reason} -- "${e.span}"`,
    });
  }
  if (result.contradiction) {
    chain.push({ kind: 'contradiction', detail: `${result.contradiction.letter}: ${result.contradiction.reason}` });
  }
  if (result.magnitudeBasis) {
    chain.push({
      kind: 'magnitude',
      detail: `ranked by ${result.magnitudeBasis.targetExtreme} of "${result.magnitudeBasis.property}" -- "${result.magnitudeBasis.span}"`,
    });
  }
  if (result.abstain) {
    chain.push({ kind: 'abstain', detail: result.abstainReason ?? '(no reason recorded)' });
  } else if (result.verdict) {
    chain.push({ kind: 'verdict', detail: `${result.verdict}) ${result.verdictName}` });
  }
  return chain;
}

// ───────────────────────────────────── the pure evaluator itself ─────────────────────────────────────

/** A MethodRunContext that throws the moment either capability is touched. Passed to
 *  runTerminatorStep() below -- proving, per call, that evaluation reaches for NEITHER: if
 *  terminator_step.ts's own reducer ever changed to read `_ctx` (today it does not; the parameter is
 *  underscore-prefixed and unused), this stub turns that regression into an immediate, loud test
 *  failure instead of a silent live network call. */
function blindEvaluationContext(): MethodRunContext {
  const refuse = (name: string) => async (): Promise<never> => {
    throw new Error(
      `EVALUATE-PHASE VIOLATION: ${name} was called during pure verdict evaluation. V = f(A, E, R, Q) `
      + 'permits no network access, no model generation, and no mutable external state during '
      + 'evaluation -- acquisition must already be complete, and its results already frozen into E, '
      + 'before evaluateVerdict() is ever called.',
    );
  };
  return {
    askGoogle: refuse('askGoogle') as MethodRunContext['askGoogle'],
    askConversationalAuthority: refuse('askConversationalAuthority') as MethodRunContext['askConversationalAuthority'],
    emit: () => {
      throw new Error('EVALUATE-PHASE VIOLATION: emit() was called during pure verdict evaluation.');
    },
  };
}

export interface VerdictEvaluation {
  verdict: TerminatorResult;
  summary: string;
  derivationChain: DerivationChainEntry[];
  ruleSetVersion: string;
  logConsistency: LogConsistencyReport;
}

/** THE PURE FUNCTION. V = f(A, E, R, Q) -- computed here as f(snapshot) since freezeVerdictSnapshot()
 *  above has already bundled A/E/R/Q into one immutable value. No network, no model generation, no
 *  Date/Math.random, no mutable external state: verified structurally (blindEvaluationContext()
 *  throws if either live capability is touched; nothing in this function or in
 *  terminator_step.ts's own deriveTerminatorEliminations()/computeFrameMatchBuckets() reads the
 *  clock or a random source, per Phase A of this dispatch). Two calls against the SAME snapshot
 *  return byte-identical `verdict` and `derivationChain` -- this is the acceptance test proved in
 *  verdict_evaluator.acceptance.test.ts, with global.fetch itself replaced by a throwing stub so the
 *  network is genuinely unreachable for the duration of the call, not merely unused by coincidence. */
export async function evaluateVerdict(snapshot: FrozenVerdictSnapshot): Promise<VerdictEvaluation> {
  verifySnapshotIntegrity(snapshot);
  const input: MethodQuestionInput = {
    qid: snapshot.artifact.qid ?? undefined,
    question: snapshot.artifact.question,
    options: snapshot.artifact.options,
  };
  const priorResults: ComposerStepOutcome[] = snapshot.evidence.items.map((it) => ({
    id: it.stepId,
    summary: '',
    raw: it.raw,
  }));
  const { result, summary } = await runTerminatorStep(input, blindEvaluationContext(), priorResults);
  return {
    verdict: result,
    summary,
    derivationChain: buildDerivationChain(result),
    ruleSetVersion: snapshot.ruleSetVersion,
    logConsistency: crossCheckAcquisitionLog(snapshot.evidence, snapshot.acquisitionLog),
  };
}
