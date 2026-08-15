// boundary_step.ts -- D-BP154-053/BISHOP-SEG/S52/seg-wiregate PART 1 CONTINUATION
//
// 'BoundaryStability:1' -- THE COMPARABILITY DISCRIMINATOR THE FOUNDER'S OWN SOURCED PROOF NAMES
// (PROOF_QID98_TEST_AWARE_ELIMINATION_BP154.md, D-BP154-053 dispatch): "the valid discriminator is
// BOUNDARY STABILITY, not compositeness." Central Asia is set aside not because it is a grouping of
// countries (South America and Northern Africa are too, under M49 -- that is the category error
// D-BP154-050 already repaired) but because THE ITEM DOES NOT FIX ITS BOUNDARY and its membership
// is materially variable across world-regional usage (the five post-Soviet republics, or
// Turkestan, or a broader area including Afghanistan) -- while South America's boundary is broadly
// stable and routinely used in density comparisons, and North Africa maps to a named statistical
// aggregate (Northern Africa, UN M49 015).
//
// THIS IS A COMPARABILITY DECISION, NEVER A FACTUAL DENIAL (spec's own words, both files): "not a
// claim that Central Asia is not a region or lacks inhabitants." disposition NOT_COMPARABLE
// (comparability_gate.ts's own exclusion-reason taxonomy), never OUT_OF_FRAME and never a claim
// about population. Justified by the modifiable areal unit problem (MAUP, PMC7151983/Esri, S4 of
// SOURCES_BP154_SPECS.md): spatial aggregates are sensitive to boundary choices, so an option whose
// boundary the ITEM ITSELF never fixes cannot enter a common aggregate-density tiebreak alongside
// options whose boundaries ARE fixed by a stated, consistently-used authority.
//
// BUILT LINE FOR LINE ON unitary_step.ts'S OWN SHAPE (same query-then-verify-then-corroborate
// pipeline, same owned-evidence-first/conversational-answers/document-corroborates ordering,
// FD-BP153-04 + FD-BP154-02) -- a separate, self-contained file, the same "steps stay
// self-contained" convention every sibling Composer step follows. classify_cascade.ts is FORBIDDEN
// and was not read to build this file.
//
// NO RULE HERE MAY SELECT A PARTICULAR LETTER (FD-BP153-06) -- every option is adjudicated
// identically; whether the rule turns out to distinguish Central Asia from its peers is decided by
// terminator_step.ts's own checkBoundaryStabilityUniformity() (checkUniformPredicate(), live),
// never assumed by this file.

import {
  appearsIn, gemmaExtract, list, toLetters,
} from '../methods/comparative_cascade';
import type { MethodQuestionInput, MethodRunContext } from '../method_registry';
import { registerNameNumbered } from './method_registry';
import type { MethodIdentity } from './method_identity';
import type { StepDeclaration } from './step_declaration';
import {
  corroborateClaim, gatherMortgageCandidates, gatherThisRunCandidates,
  spanIsVerbatimInPassage, summarizeCorroboration, tryConversationalAuthority,
} from './composer_step_evidence';
import type { ClaimProvenance, CorroborationResult } from './composer_step_evidence';
import { resolveNameToOption } from './entity_resolution';

// ───────────────────── pure parts (unit-testable without a live Ollama/browser) ─────────────────────

/** THE ONE QUERY, per-option adjudication (same "answer for every one, in order, do not skip any"
 *  shape D-BP154-045 FIX 1 proved on this machine for Unitary:1 -- a "which of these..." phrasing
 *  invites naming just one volunteer and never adjudicating the rest).
 *
 *  D-BP154-055, STRENGTHENED. LIVE-MEASURED this ticket, TWICE (qid 98, two separate live runs):
 *  the conversational authority answered this question as if it were the ORIGINAL MMLU item itself
 *  ("Answer: A ... South America is the only option ...") rather than performing the requested
 *  per-option classification -- a single holistic best-answer paragraph, not nine per-option
 *  statements, so the local extraction model found nothing with a genuine verbatim per-option span
 *  to keep (9 discarded, 0 kept, both runs). Adds an explicit format instruction and an explicit
 *  prohibition on answering the original question -- still never invents a per-option verdict
 *  itself; if the authority still does not comply, the extraction/verification choke point still
 *  correctly discards everything rather than fabricate a span (HARDWIRE-22 unrelaxed). */
export function buildBoundaryQuery(all: string[], OPT: Record<string, string>): string {
  return 'For EACH of the following, state whether it has a STABLE, consistently-used boundary or '
    + 'definition for a population-density comparison -- e.g. it maps to a single named statistical '
    + 'or geographic aggregate that sources consistently agree on -- or a MATERIALLY VARIABLE '
    + 'boundary or membership, where different sources or conventions define its extent '
    + 'differently. Answer for every one, in order, and do not skip any -- classify every option '
    + 'below, not only the ones you are most confident about. Do NOT answer any other question and '
    + 'do NOT give a single overall best-answer paragraph -- give exactly one classification '
    + 'sentence per option, in the format "<letter>) <name>: STABLE/VARIABLE because <reason>", one '
    + `line for each of the nine options in order. ${list(all, OPT)}`;
}

export interface BoundaryUnstableOption {
  letter: string;
  name: string;
  /** Verbatim span proving the source itself stated this option's boundary/membership is
   *  materially variable, not consistently defined. */
  span: string;
}

export function buildBoundaryCorroborationQuery(entry: BoundaryUnstableOption): string {
  return `Does ${entry.name} have a single, stable, consistently-used boundary or definition, or `
    + 'does its extent vary materially depending on the source or convention used? Answer plainly '
    + 'and directly, stating clearly which.';
}

type RawBoundaryClassification = { name?: unknown; classification?: unknown; span?: unknown };

/** Every entry the extraction returns carries its OWN `classification` ("stable" or "variable") --
 *  per-option, mirroring unitary_step.ts's verifyUnitaryClassifications() exactly. An entry
 *  classified "variable" is a candidate for NOT_COMPARABLE (reported, folded into `eliminated`
 *  ONLY if terminator_step.ts's own live uniformity check accepts the rule this run); "stable"
 *  CONFIRMS the option (reported, never eliminates); anything else (missing/garbled, or an option
 *  never addressed) is UNSTATED, never guessed. */
export function verifyBoundaryClassifications(
  raw: unknown,
  passage: string,
  OPT: Record<string, string>,
): { unstable: BoundaryUnstableOption[]; confirmedStable: BoundaryUnstableOption[]; discarded: number } {
  const entries = Array.isArray(raw) ? (raw as RawBoundaryClassification[]) : [];
  const unstable: BoundaryUnstableOption[] = [];
  const confirmedStable: BoundaryUnstableOption[] = [];
  const seenUnstable = new Set<string>();
  const seenStable = new Set<string>();
  let discarded = 0;
  for (const entry of entries) {
    const name = typeof entry?.name === 'string' ? entry.name.trim() : '';
    const classification = typeof entry?.classification === 'string' ? entry.classification.trim().toLowerCase() : '';
    const span = typeof entry?.span === 'string' ? entry.span.trim() : '';
    if (!name) continue; // nothing named -- not a candidate value, not a discard
    if (classification !== 'stable' && classification !== 'variable') continue; // no usable classification -- UNSTATED, not a discard
    // THE ONE SHARED RESOLVER (entity_resolution.ts, D-BP154-052) -- see softballs_step.ts's own
    // header for the full ruling; this file was NEW this ticket, so it is built on the shared
    // resolver from the start, never a local mirror.
    const { letter: L } = resolveNameToOption(name, OPT);
    if (!L) continue; // names no known option -- not a candidate value here
    if (!span || !spanIsVerbatimInPassage(passage, span) || !appearsIn(span, OPT[L])) {
      discarded++;
      continue;
    }
    if (classification === 'variable') {
      if (seenUnstable.has(L)) continue;
      seenUnstable.add(L);
      unstable.push({ letter: L, name: OPT[L], span });
    } else {
      if (seenStable.has(L)) continue;
      seenStable.add(L);
      confirmedStable.push({ letter: L, name: OPT[L], span });
    }
  }
  return { unstable, confirmedStable, discarded };
}

export interface BoundaryResult {
  ok: boolean;
  query: string | null;
  /** Options a source explicitly states have a materially variable boundary/definition -- NOT
   *  automatically eliminated by this file (this step never decides eligibility on its own,
   *  FD-BP153-06); terminator_step.ts's own checkBoundaryStabilityUniformity() decides, live,
   *  whether this rule may fold into `eliminated` this run. */
  unstable: BoundaryUnstableOption[];
  /** Options the source explicitly classified "stable" -- reported for transparency and used as
   *  same-relevant-type peers in the uniformity check, never eliminated or confirmed a member on
   *  their own. */
  confirmedStable: BoundaryUnstableOption[];
  discarded: number;
  /** ABSENCE IS OMISSION -- an option never addressed stays neither unstable nor confirmed. */
  notAddressed: string[];
  via: string;
  answerProvenance?: ClaimProvenance;
  corroboration?: CorroborationResult;
  error?: string;
}

function summaryLine(OPT: Record<string, string>, r: BoundaryResult): string {
  if (!r.ok) return `BOUNDARY STABILITY: FAILED -- ${r.error}`;
  const unstableText = r.unstable.length
    ? r.unstable.map((e) => `${e.letter}) ${e.name} [source: "${e.span}"]`).join('  |  ')
    : '(none stated)';
  const stableText = r.confirmedStable.length
    ? r.confirmedStable.map((e) => `${e.letter}) ${e.name} [source: "${e.span}"]`).join('  |  ')
    : '(none)';
  const notAddressedText = r.notAddressed.length
    ? r.notAddressed.map((L) => `${L}) ${OPT[L]}`).join(', ')
    : '(none)';
  const discardNote = r.discarded ? ` -- discarded ${r.discarded} candidate(s) with no verifiable span` : '';
  const provenanceNote = r.answerProvenance ? `  ||  ANSWERED VIA ${r.answerProvenance.mechanism}: ${r.answerProvenance.detail}` : '';
  const corrobNote = r.corroboration ? `  ||  ${summarizeCorroboration(r.corroboration)}` : '';
  return `BOUNDARY STABILITY -- query: "${r.query}"  ||  MATERIALLY VARIABLE (not a fixed boundary, comparability decision, not a claim of no population): `
    + `${unstableText}${discardNote}  ||  CONFIRMED STABLE (reported only): ${stableText}`
    + `  ||  NOT ADDRESSED: ${notAddressedText}${provenanceNote}${corrobNote}`;
}

// ───────────────── the live step (owned evidence -> conversational -> corroboration) ─────────────────

/**
 * Runs 'BoundaryStability:1'. Same three-stage discipline every sibling step (Unitary:1/
 * Softballs:1/NamedSet:1/Discriminator:1) already uses. Cannot be exercised end to end under
 * vitest (live Ollama/browser needed) -- the pure parts above carry the real unit tests; this
 * function is verified by a live in-app run.
 */
export async function runBoundaryStep(
  input: MethodQuestionInput,
  ctx: MethodRunContext,
): Promise<{ result: BoundaryResult; summary: string }> {
  const OPT = input.options;
  if (!OPT || Object.keys(OPT).length === 0) {
    const result: BoundaryResult = {
      ok: false, query: null, unstable: [], confirmedStable: [], discarded: 0, notAddressed: [], via: 'n/a',
      error: 'this question has no lettered options -- BOUNDARY STABILITY tests boundary-definition '
        + 'consistency among options and cannot run without them',
    };
    return { result, summary: summaryLine({}, result) };
  }
  const all = Object.keys(OPT);
  const query = buildBoundaryQuery(all, OPT);
  const namesAnyOption = (t: string) => all.some((L) => appearsIn(t, OPT[L]));
  const mcOptions = all.map((L) => `${L}) ${OPT[L]}`);

  const ownedCandidates = [
    ...(await gatherMortgageCandidates(input.qid, query)),
    ...gatherThisRunCandidates(ctx),
  ];
  let text = '';
  let via = '';
  let provenance: ClaimProvenance | undefined;
  for (const c of ownedCandidates) {
    if (namesAnyOption(c.text)) { text = c.text; via = c.via; provenance = c.provenance; break; }
  }

  let conversationalError: string | undefined;
  if (!text) {
    const cr = await tryConversationalAuthority(ctx, query, mcOptions);
    if (cr.ok && namesAnyOption(cr.text)) {
      text = cr.text; via = cr.via; provenance = cr.provenance;
    } else {
      conversationalError = cr.error ?? 'conversational authority answered but named none of the options';
    }
  }

  if (!text) {
    const result: BoundaryResult = {
      ok: false, query, unstable: [], confirmedStable: [], discarded: 0, notAddressed: all, via: 'n/a',
      error: `no usable answer from any authority -- owned evidence: ${ownedCandidates.length} candidate(s) tried, none usable; `
        + `conversational authority: ${conversationalError ?? 'not tried'} -- BOUNDARY STABILITY is UNAVAILABLE, not "nothing variable"`,
    };
    return { result, summary: summaryLine(OPT, result) };
  }

  const rawOut: {
    text?: string; truncated?: boolean; failureCause?: 'transport' | 'http-error' | 'parse-error'; failureDetail?: string;
  } = {};
  const instruction = 'From the passage, for EACH option below that the passage classifies, state '
    + 'whether the passage says it has a STABLE, consistently-used boundary/definition, or a '
    + 'MATERIALLY VARIABLE one (different sources or conventions define its extent differently). '
    + 'For each one, copy the exact verbatim sentence or clause from the passage that states its '
    + 'classification. Do not include an option the passage merely does not mention -- an omission '
    + 'is not a statement. Classify every option the passage DOES address, not only the first one. '
    + `Options: ${all.map((L) => `${L}) ${OPT[L]}`).join('; ')}`;
  const shape = '{"classifications":[{"name":"exact option name from the list","classification":"stable or variable","span":"verbatim sentence or clause from the passage stating this classification"}]}';
  const ex = await gemmaExtract(instruction, text, shape, rawOut);
  if (ex === null) {
    const cause = rawOut.truncated
      ? 'the local extraction model truncated its output before finishing'
      : rawOut.failureCause
        ? `the local extraction model failed (${rawOut.failureCause}${rawOut.failureDetail ? `: ${rawOut.failureDetail}` : ''})`
        : 'the local extraction model failed for an unclassified reason';
    const result: BoundaryResult = {
      ok: false, query, unstable: [], confirmedStable: [], discarded: 0, notAddressed: all, via,
      error: `extraction failed -- ${cause} -- reported as a FAILURE, never an empty "nothing variable"`,
    };
    return { result, summary: summaryLine(OPT, result) };
  }
  const { unstable, confirmedStable, discarded } = verifyBoundaryClassifications(ex.classifications, text, OPT);
  const addressedLetters = new Set([...unstable.map((e) => e.letter), ...confirmedStable.map((e) => e.letter)]);
  const notAddressed = all.filter((L) => !addressedLetters.has(L));

  let corroboration: CorroborationResult | undefined;
  if (unstable.length) {
    corroboration = await corroborateClaim(ctx, buildBoundaryCorroborationQuery(unstable[0]), unstable[0].name);
  }

  const result: BoundaryResult = {
    ok: true, query, unstable, confirmedStable, discarded, notAddressed, via, answerProvenance: provenance, corroboration,
  };
  return { result, summary: summaryLine(OPT, result) };
}

// ───────────────────────── registration (inert until stacked and run) ─────────────────────────

const BOUNDARY_DECLARATION: StepDeclaration = {
  id: 'liana_cycle.boundary_step.runBoundaryStep',
  version: '1',
  sourceFile: 'src/main/liana_cycle/library/boundary_step.ts',
  sourceLine: 1,
  exportName: 'runBoundaryStep',
  exportKind: 'function',
  whatItDoes:
    'Asks ONE per-option question -- which options have a STABLE, consistently-used boundary/'
    + 'definition versus a MATERIALLY VARIABLE one across sources/conventions -- tried against owned '
    + 'evidence first, then the conversational authority; a materially-variable finding is reported '
    + 'as a candidate NOT_COMPARABLE disposition, folded into the Terminator\'s eliminations only if '
    + 'terminator_step.ts\'s own checkBoundaryStabilityUniformity() (checkUniformPredicate(), live) '
    + 'accepts the rule as discriminating this run -- never assumed by this file.',
  inputs: 'MethodQuestionInput (question, options, qid) plus MethodRunContext to runBoundaryStep().',
  outputs: 'Promise<{ result: BoundaryResult, summary: string }> -- options with a stated materially-variable boundary and verbatim spans, discard count, confirmed-stable options, mechanism, and a document corroboration attempt.',
  decidesOrReports: 'DECIDES_AND_REFUSES',
  queryText: {
    issuesQuery: true,
    description: 'One primary question per run -- owned evidence tried first, then "which of these have a stable vs materially variable boundary?" put to the conversational authority -- plus at most one corroboration query.',
    loadedFromQueryResource: false,
  },
  attribution: {
    kind: 'ATTRIBUTED',
    founderRuling: 'BP154',
    quote:
      'the valid discriminator is boundary stability, not compositeness... the item does not fix '
      + 'its boundary and its membership is materially variable across world-regional usage.',
    citedAt: 'D-BP154-053 dispatch, PROOF_QID98_TEST_AWARE_ELIMINATION_BP154.md section 4',
  },
  orphanEvidence:
    'N/A -- not an orphan. Live: registered via registerBoundaryStep() (this file), executed by '
    + 'script_bridge.ts\'s runOneStep() for id "BoundaryStability:1".',
};

/** Registers 'BoundaryStability:1'. Called from script_bridge.ts's ensureRegistryPopulated(),
 *  idempotently -- same try/catch shape as every other Composer step registration there. */
export function registerBoundaryStep(): MethodIdentity {
  return registerNameNumbered('BoundaryStability', 1, BOUNDARY_DECLARATION);
}
