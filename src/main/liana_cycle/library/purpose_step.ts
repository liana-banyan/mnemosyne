// purpose_step.ts -- D-BP154-041/BISHOP-SEG/S41/seg-purpose, PART 1/3
//
// THE QUESTION PURPOSE AS A COMPOSER STEP ('Purpose:1'). FD-BP154-16 (RULINGS_BP154.md), Founder
// verbatim: "I wonder if we would benefit to try and determine what the point of each question is?
// Because then we can record our stated Question Purpose so it can be either refuted or affirmed
// and move up from Sand to Soil and on."
//
// STATED BEFORE ANY OPTION IS EXAMINED, AND RECORDED AT THAT MOMENT. This is why 'Purpose:1' must
// run FIRST in any stack that wants its guarantee: it reads only the question's own stem, the
// artifact's `src`, and its `category` -- never `input.options` -- so a purpose can never be
// retrofitted to a surviving option set (FD-BP154-16's own guard: "may never be adjusted after
// seeing which options survive").
//
// EMITS A SET, NOT ONE. FD-BP154-17: "commit to a SET of candidate purposes up front, then let
// evidence eliminate among them... The guard goes from 'trust the ordering' to 'the ordering is
// checkable.'" Every candidate below carries its own supporting span, sourced from exactly one of
// the three admissible fields (stem / src / category) -- extracted, never invented (HARDWIRE-22).
//
// ELIMINATION IS BY A DECLARED RULE, NEVER BY WHICH YIELDS A NICER ANSWER. eliminatePurposeCandidates()
// below discards a candidate only when its extracted text is empty or matches a small, fixed,
// pre-declared stoplist of non-discriminating placeholder values (e.g. a bare "other" category) --
// the SAME kind of structural, content-blind rule this estate already applies elsewhere
// (discriminatorKindMatchesCategory()'s own exact-phrase matching, terminator_step.ts). The rule
// never inspects `input.options`, so it cannot be steered by which options happen to be present.
// If every candidate is eliminated, this step reports INSUFFICIENT EVIDENCE (never the least-bad
// purpose survives by default) -- see emptyPurposeResult()'s own 'no candidate survived' branch.
//
// PURPOSE IS DERIVED FROM A AND SELECTS FROM R -- NOT A FIFTH ARGUMENT (FD-BP154-11, FD-BP154-16).
// `V = f(A, E, R, Q)` stands unchanged: this step reads only the artifact record (A) and hands its
// result to sufficiency_gate.ts (PART 2, D-BP154-041) and to script_bridge.ts's own upstream skip
// gate (PART 3), both of which SELECT which rule/policy entries in R apply. Nothing here eliminates
// an option or names a verdict letter.
//
// THE PROBE MECHANISM (FD-BP154-17's own forward-looking design: "we can formalize those
// approaches... by making multiple potential purposes and testing with generated questions").
// buildPurposeProbeQuery()/checkPurposeConsistency() below are BUILT (pure, unit-tested) but NOT
// ACTIVE (FD-BP154-08 discipline: state which of the two it is) -- runPurposeStep() does not call
// them. For every campaign qid measured so far the three admissible fields never disagree in a way
// that needs a probe to resolve (qid 98's own stem/src candidates describe compatible topics --
// population distribution and geography -- not contradictory ones), so wiring a live query into
// this step is deferred rather than built speculatively against no live-measured need. The one
// hard rule the mechanism must obey when it IS wired: a model may be asked to produce a probe
// question, and asked whether a returned answer plus the question's OWN stated information satisfy
// the purpose statement WITHOUT CONTRADICTION (mechanical) -- it may NEVER be asked "is this
// purpose right?" (FD-BP154-17's own line that must not move).
//
// classify_cascade.ts is FORBIDDEN and was not read to build this file. comparative_cascade.ts is
// untouched -- this step issues no query at all in its BUILT form, so it needs none of that file's
// exports. D-BP153-003: no answer key is read anywhere below.

import { registerNameNumbered } from './method_registry';
import type { MethodIdentity } from './method_identity';
import type { StepDeclaration } from './step_declaration';
import type { MethodQuestionInput, MethodRunContext } from '../method_registry';
import { mintPurposeReceipt } from './purpose_receipt_store';

// ───────────────────────────── pure parts (unit-testable, no I/O) ─────────────────────────────

export type PurposeSource = 'stem' | 'src' | 'category';

/** FD-BP154-16's own worked shape: a negated question naming a superlative property ("...is NOT
 *  considered one of the world's MOST densely populated regions?"). Reused for the sufficiency
 *  gate (sufficiency_gate.ts, PART 2) -- classification of what KIND of purpose this is, computed
 *  once, from the question's own structure alone. 'UNCLASSIFIED' when no known shape matches;
 *  never a guess, never used to eliminate a candidate itself (only sufficiency_gate.ts's
 *  precondition table reads it). */
export type PurposeType = 'NEGATED_SUPERLATIVE_MEMBERSHIP' | 'UNCLASSIFIED';

export interface PurposeCandidate {
  /** Stable within one run: `${source}:1` (only ever one candidate per source today). */
  id: string;
  source: PurposeSource;
  statement: string;
  /** Verbatim span from the SAME field the statement was read from -- the stem match itself, or
   *  the `src`/`category` value verbatim (the whole stated field IS its own span; nothing here
   *  invents a shorter excerpt). */
  span: string;
}

/** THE SAME "one of X" / "considered X" shape magnitude_step.ts's own
 *  deriveMagnitudeSuperlativeProperty() and named_set_step.ts's own deriveNamedSetProperty()
 *  already parse -- duplicated here (not imported), per this codebase's established "steps stay
 *  self-contained" convention for small, qid-agnostic text parsers (see magnitude_step.ts's own
 *  header for why that convention exists). Pure text-structure parsing of the question's own
 *  wording; returns null (never a guess) when the question does not fit this shape. */
function deriveStemProperty(question: string): string | null {
  const m1 = question.match(/\bone of\s+(?:the\s+)?([a-z0-9][^?]*?)\??$/i);
  if (m1 && m1[1].trim()) return m1[1].trim();
  const m2 = question.match(/\bconsidered\s+(?:the\s+)?([a-z0-9][^?]*?)\??$/i);
  if (m2 && m2[1].trim()) return m2[1].trim();
  return null;
}

/** Reads `originSrc` (e.g. "ori_mmlu-high_school_geography") into a plain subject phrase
 *  ("high school geography") -- purely mechanical: strip the stated "ori_mmlu-" (or "ori_<name>-")
 *  prefix a backfilled row's own field already carries, then fold underscores to spaces. Never
 *  invents a subject when the field carries no recognizable prefix -- the WHOLE field is used
 *  verbatim as the fallback candidate text in that case, still extracted, never guessed. */
function deriveSubjectFromSrc(originSrc: string): string {
  const m = originSrc.match(/^ori_[a-z0-9]+-(.+)$/i);
  const subject = m ? m[1] : originSrc;
  return subject.replace(/[_-]+/g, ' ').trim();
}

/** THE DECLARED STOPLIST (elimination rule, FD-BP154-16: "eliminated by a DECLARED RULE, never by
 *  which yields a nicer answer"). A candidate whose extracted text case-insensitively equals one of
 *  these fixed, content-blind placeholders carries no discriminating information and is discarded
 *  -- never because of which options happen to be present. Versioned so a future widening of the
 *  list is a traceable change, not a silent one. */
export const PURPOSE_STOPLIST_VERSION = '1';
const PURPOSE_STOPLIST: ReadonlySet<string> = new Set(['other', 'misc', 'miscellaneous', 'general', 'unknown', '']);

function isStoplisted(text: string): boolean {
  return PURPOSE_STOPLIST.has(text.trim().toLowerCase());
}

/** ALL THREE ADMISSIBLE SOURCES, READ BEFORE ANY OPTION IS EXAMINED (this function's own
 *  signature takes no `options` parameter at all -- structurally impossible to retrofit). Returns
 *  the RAW candidate set; elimination is a separate, declared step (eliminatePurposeCandidates()
 *  below), so a caller can always see what was extracted before what was discarded. */
export function derivePurposeCandidates(
  question: string,
  originSrc?: string,
  category?: string,
): PurposeCandidate[] {
  const candidates: PurposeCandidate[] = [];
  const stemProperty = deriveStemProperty(question);
  if (stemProperty) {
    candidates.push({
      id: 'stem:1', source: 'stem',
      statement: `this question concerns ${stemProperty}`,
      span: stemProperty,
    });
  }
  if (originSrc && originSrc.trim()) {
    const subject = deriveSubjectFromSrc(originSrc.trim());
    candidates.push({
      id: 'src:1', source: 'src',
      statement: `this question concerns ${subject}`,
      span: originSrc.trim(),
    });
  }
  if (category && category.trim()) {
    candidates.push({
      id: 'category:1', source: 'category',
      statement: `this question concerns ${category.trim()}`,
      span: category.trim(),
    });
  }
  return candidates;
}

export interface EliminatedPurposeCandidate {
  candidate: PurposeCandidate;
  reason: string;
}

/** THE ONE DECLARED ELIMINATION RULE. Pure, content-blind, never reads `options`. */
export function eliminatePurposeCandidates(candidates: PurposeCandidate[]): {
  survivors: PurposeCandidate[];
  eliminated: EliminatedPurposeCandidate[];
} {
  const survivors: PurposeCandidate[] = [];
  const eliminated: EliminatedPurposeCandidate[] = [];
  for (const c of candidates) {
    const extracted = c.statement.replace(/^this question concerns\s*/i, '').trim();
    if (isStoplisted(extracted)) {
      eliminated.push({
        candidate: c,
        reason: `PURPOSE_STOPLIST v${PURPOSE_STOPLIST_VERSION}: "${extracted || '(empty)'}" carries no `
          + 'discriminating information (declared rule, not a preference among answers)',
      });
      continue;
    }
    survivors.push(c);
  }
  return { survivors, eliminated };
}

/** Structural classification of the QUESTION's own shape -- negation + a stated superlative
 *  direction ("most"/"least"), independent of which purpose candidate(s) survived. Same detection
 *  primitives magnitude_step.ts's own deriveMagnitudeTargetExtreme() already uses (negation via
 *  /\bnot\b/i, direction via /\bmost\b|\bleast\b/i on the stem property), duplicated per this
 *  file's own "steps stay self-contained" note above. Read by sufficiency_gate.ts (PART 2) to pick
 *  which declared precondition, if any, applies. */
export function derivePurposeType(question: string): PurposeType {
  const stemProperty = deriveStemProperty(question);
  if (!stemProperty) return 'UNCLASSIFIED';
  const negated = /\bnot\b/i.test(question);
  const superlative = /\bmost\b|\bleast\b/i.test(stemProperty);
  if (negated && superlative) return 'NEGATED_SUPERLATIVE_MEMBERSHIP';
  return 'UNCLASSIFIED';
}

// ───────────────── THE PROBE MECHANISM -- BUILT, NOT ACTIVE (see this file's own header) ─────────────────

/** Builds a probe question for ONE candidate purpose -- asked of a source exactly like every other
 *  Composer query (never "is this purpose right?", FD-BP154-17's own line that must not move). */
export function buildPurposeProbeQuery(candidate: PurposeCandidate, question: string): string {
  return `Considering the question "${question}", is it primarily about ${candidate.statement.replace(/^this question concerns\s*/i, '')}? `
    + 'Answer plainly, stating clearly whether that subject applies.';
}

/** THE MECHANICAL CONSISTENCY CHECK (FD-BP154-17): does the returned answer, combined with the
 *  question's own stated information, satisfy the purpose statement WITHOUT CONTRADICTION? Purely
 *  structural -- a normalized-substring affirmation check plus an explicit-negation check, the same
 *  class of mechanical text-structure operation this estate already applies throughout (norm(),
 *  appearsIn()-style containment). Never asks a model to judge the purpose itself. */
export function checkPurposeConsistency(probeAnswerText: string): boolean {
  const t = probeAnswerText.toLowerCase();
  if (/\b(no|not|does not|isn'?t|doesn'?t)\b/.test(t) && !/\byes\b/.test(t)) return false;
  return /\byes\b|\bcorrect\b|\btrue\b|\bapplies\b/.test(t);
}

// ───────────────────────────────── the result shape ─────────────────────────────────

export interface PurposeResult {
  ok: boolean;
  purposeType: PurposeType;
  candidates: PurposeCandidate[];
  survivors: PurposeCandidate[];
  eliminated: EliminatedPurposeCandidate[];
  via: string;
  error?: string;
}

function emptyPurposeResult(overrides: Partial<PurposeResult> & { error: string }): PurposeResult {
  return {
    ok: false, purposeType: 'UNCLASSIFIED', candidates: [], survivors: [], eliminated: [], via: 'n/a',
    ...overrides,
  };
}

function summaryLine(r: PurposeResult): string {
  if (!r.ok) return `PURPOSE: FAILED -- ${r.error}`;
  const survivorText = r.survivors.length
    ? r.survivors.map((c) => `[${c.source}] "${c.statement}" (span: "${c.span}")`).join('  |  ')
    : '(none)';
  const eliminatedText = r.eliminated.length
    ? r.eliminated.map((e) => `[${e.candidate.source}] "${e.candidate.statement}" -- ${e.reason}`).join('  |  ')
    : '(none)';
  return `PURPOSE -- type: ${r.purposeType}  ||  CANDIDATES (${r.candidates.length}): `
    + `${r.candidates.map((c) => `[${c.source}] "${c.statement}"`).join('  |  ') || '(none)'}`
    + `  ||  SURVIVORS: ${survivorText}  ||  ELIMINATED: ${eliminatedText}`;
}

// ───────────────────────────── the live step (pure/synchronous today) ─────────────────────────────

/**
 * Runs 'Purpose:1' -- the first step FD-BP154-16 requires a stack run BEFORE any option-examining
 * step, so the extraction below never sees `input.options` at all (structurally impossible to
 * retrofit a purpose to a surviving set). Synchronous today (BUILT, not ACTIVE for the probe path,
 * see this file's own header) -- `async` kept on the signature so a future probe wiring needs no
 * change to script_bridge.ts's own call site.
 */
export async function runPurposeStep(
  input: MethodQuestionInput,
  ctx: MethodRunContext,
): Promise<{ result: PurposeResult; summary: string }> {
  if (!input.question || !input.question.trim()) {
    const result = emptyPurposeResult({ error: 'no question text to derive a purpose from' });
    return { result, summary: summaryLine(result) };
  }
  const candidates = derivePurposeCandidates(input.question, input.originSrc, input.category);
  const { survivors, eliminated } = eliminatePurposeCandidates(candidates);
  const purposeType = derivePurposeType(input.question);

  if (survivors.length === 0) {
    const result: PurposeResult = {
      ok: false, purposeType, candidates, survivors, eliminated, via: 'n/a',
      error: `INSUFFICIENT EVIDENCE -- no candidate purpose survived elimination (${candidates.length} `
        + `extracted, ${eliminated.length} discarded by the declared stoplist rule); never the least-bad `
        + 'purpose (FD-BP154-16)',
    };
    if (ctx.acquisitionId) mintPurposeReceipt(input.qid ?? null, ctx.acquisitionId, result);
    return { result, summary: summaryLine(result) };
  }

  const result: PurposeResult = {
    ok: true, purposeType, candidates, survivors, eliminated,
    via: `stated fields: ${survivors.map((c) => c.source).join(', ')}`,
  };
  // FD-BP154-16: "Purpose enters the receipt store at stratum sand... so it can be affirmed or
  // refuted across runs." Same acquisitionId-gated, catch-and-swallow discipline script_bridge.ts's
  // own persistStepClaim() already uses -- instrumentation, never allowed to fail the step itself.
  if (ctx.acquisitionId) mintPurposeReceipt(input.qid ?? null, ctx.acquisitionId, result);
  return { result, summary: summaryLine(result) };
}

// ───────────────────────────── registration (inert until stacked and run) ─────────────────────────

const PURPOSE_DECLARATION: StepDeclaration = {
  id: 'liana_cycle.purpose_step.runPurposeStep',
  version: '1',
  sourceFile: 'src/main/liana_cycle/library/purpose_step.ts',
  sourceLine: 1,
  exportName: 'runPurposeStep',
  exportKind: 'function',
  whatItDoes:
    'Derives a SET of candidate Question Purposes from three stated fields ONLY (the question\'s own '
    + 'stem, the artifact\'s src, and its category) -- BEFORE any option is examined, so a purpose can '
    + 'never be retrofitted to a surviving option set. Each candidate carries its own verbatim span. '
    + 'Eliminates candidates only by a declared, content-blind stoplist rule, never by which yields a '
    + 'nicer answer; reports INSUFFICIENT EVIDENCE if none survive. Classifies the question\'s own '
    + 'structural shape (purposeType) for sufficiency_gate.ts to consult. Issues no query in its BUILT '
    + 'form; a mechanical probe-consistency mechanism exists (buildPurposeProbeQuery/'
    + 'checkPurposeConsistency) but is not yet wired live.',
  inputs: 'MethodQuestionInput (question, originSrc, category, qid) plus MethodRunContext (acquisitionId for the receipt).',
  outputs: 'Promise<{ result: PurposeResult, summary: string }> -- purposeType, every candidate, its '
    + 'survivors after the declared elimination rule, and every elimination with its reason.',
  decidesOrReports: 'DECIDES_AND_REFUSES',
  queryText: {
    issuesQuery: false,
    description: 'Issues no live query in its BUILT form -- every candidate is read from stated fields already on the input.',
    loadedFromQueryResource: false,
  },
  attribution: {
    kind: 'ATTRIBUTED',
    founderRuling: 'BP154',
    quote:
      'I wonder if we would benefit to try and determine what the point of each question is? Because '
      + 'then we can record our stated Question Purpose so it can be either refuted or affirmed and '
      + 'move up from Sand to Soil and on.',
    citedAt: 'FD-BP154-16 (RULINGS_BP154.md)',
  },
  orphanEvidence:
    'N/A -- not an orphan. Live: registered via registerPurposeStep() (this file), executed by '
    + 'script_bridge.ts\'s runOneStep() for id "Purpose:1", the same wiring pattern every other '
    + 'Composer step already uses.',
};

/** Registers 'Purpose:1'. Called from script_bridge.ts's ensureRegistryPopulated(), idempotently --
 *  same try/catch shape as the other Composer step registrations there. */
export function registerPurposeStep(): MethodIdentity {
  return registerNameNumbered('Purpose', 1, PURPOSE_DECLARATION);
}
