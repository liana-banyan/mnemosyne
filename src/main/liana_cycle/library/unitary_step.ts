// unitary_step.ts -- D-BP154-043/BISHOP-SEG/S43/seg-unitary
//
// 'Unitary:1' -- THE UNITARY-VS-CONGLOMERATE MEMBERSHIP FACTOR. One of FD-BP154-16's own SIX
// RATIFIED MEMBERSHIP FACTORS ("unitary vs conglomerate (one region, or a grouping of several)"),
// never before built as its own step. Founder, D-BP154-043, verbatim, giving the worked instance
// that names this factor: "remove choices that are not human-population-world-region candidates...
// AND Central Asia, on the ground that Central Asia is not considered a single world region, but a
// conglomerate of multiple regions." **This elimination must be SOURCED with a verbatim span, like
// every other -- a source stating [an option] denotes a group of countries rather than a single
// world region. If no source states it, it stays in and you say so.**
//
// GENERAL-PURPOSE, NOT CENTRAL-ASIA-SPECIFIC (FD-BP153-06: no rule may select a letter). This file
// asks ONE question about EVERY option in the frame -- "which of these are a conglomerate/grouping
// of multiple separate regions or countries, rather than one single unitary region?" -- and
// eliminates only what a source explicitly, verifiably states. Central Asia (or any other option)
// is eliminated only if the live passage actually says so, with a verbatim span; an UNSTATED
// option is never eliminated on this basis (same "absence is omission" discipline every sibling
// step in this estate already applies).
//
// BUILT LINE FOR LINE ON softballs_step.ts's OWN SHAPE (same query-then-verify-then-corroborate
// pipeline, same owned-evidence-first/conversational-answers/document-corroborates ordering,
// FD-BP153-04 + FD-BP154-02) -- deliberately a SEPARATE, self-contained file, the SAME "steps stay
// self-contained" convention every other Composer step in this estate already follows (see
// magnitude_step.ts's own header for why). classify_cascade.ts is FORBIDDEN and was not read to
// build this file; comparative_cascade.ts is imported only for the same four already-shared
// primitives softballs_step.ts already uses (googleBlocks/gemmaExtract/appearsIn/list/toLetters).
//
// NO RULE HERE MAY SELECT A PARTICULAR LETTER (FD-BP153-06) -- every option is treated identically.

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

// ───────────────────── pure parts (unit-testable without a live Ollama/browser) ─────────────────────

/** THE ONE QUERY. Restricted to the FRAME the caller hands in (runUnitaryStep() below always
 *  passes ALL of `input.options` -- this step, like Softballs:1, runs over the full option set it
 *  is handed; a stack that wants it scoped to a narrower frame passes a narrower `options` object
 *  itself, the same discipline every other step in this estate leaves to the caller). */
export function buildUnitaryQuery(all: string[], OPT: Record<string, string>): string {
  return 'Which of the following are considered a CONGLOMERATE or GROUPING of multiple separate '
    + 'countries or sub-regions, rather than a single unitary region in its own right? Answer '
    + 'plainly and directly for any that are -- name it explicitly and state clearly that it is a '
    + 'conglomerate or grouping of multiple regions, not one single region. Do not guess about ones '
    + `you are not sure of; simply do not mention those. ${list(all, OPT)}`;
}

export interface UnitaryExcludedOption {
  letter: string;
  name: string;
  /** Verbatim span proving the source itself stated this option is a conglomerate/grouping, not a
   *  single unitary region. */
  span: string;
}

export function buildUnitaryCorroborationQuery(entry: UnitaryExcludedOption): string {
  return `Is ${entry.name} a single unitary region, or a conglomerate/grouping of multiple `
    + 'separate countries or sub-regions? Answer plainly and directly, stating clearly which.';
}

type RawUnitaryEntry = { name?: unknown; span?: unknown };

function stripListLetterPrefix(name: string): string {
  return name.replace(/^[A-Za-z]\)\s*/, '');
}

/** THE VERIFY-THE-SPAN CHOKE POINT -- identical discipline to softballs_step.ts's own
 *  verifyExcludedEntries() (FD-BP153-07 FIX 2), mirrored locally per this file's own "steps stay
 *  self-contained" note above. */
export function verifyUnitaryExcludedEntries(
  raw: unknown,
  passage: string,
  OPT: Record<string, string>,
): { excluded: UnitaryExcludedOption[]; discarded: number } {
  const entries = Array.isArray(raw) ? (raw as RawUnitaryEntry[]) : [];
  const excluded: UnitaryExcludedOption[] = [];
  const seen = new Set<string>();
  let discarded = 0;
  for (const entry of entries) {
    const name = typeof entry?.name === 'string' ? entry.name.trim() : '';
    const span = typeof entry?.span === 'string' ? entry.span.trim() : '';
    if (!name) continue;
    let matched = toLetters([name], OPT);
    if (matched.length === 0) {
      const stripped = stripListLetterPrefix(name);
      if (stripped !== name) matched = toLetters([stripped], OPT);
    }
    if (matched.length === 0) continue;
    const L = matched[0];
    if (!span || !spanIsVerbatimInPassage(passage, span) || !appearsIn(span, OPT[L])) {
      discarded++;
      continue;
    }
    if (seen.has(L)) continue;
    seen.add(L);
    excluded.push({ letter: L, name: OPT[L], span });
  }
  return { excluded, discarded };
}

export interface UnitaryResult {
  ok: boolean;
  query: string | null;
  /** Options a source explicitly states ARE a conglomerate/grouping -- these are eliminated
   *  (FD-BP154-16's own "unitary vs conglomerate" factor: a conglomerate is not a member of a
   *  "single world region" category). */
  excluded: UnitaryExcludedOption[];
  discarded: number;
  /** ABSENCE IS OMISSION -- an option never stated to be a conglomerate stays in the frame; this
   *  is reported, never conflated with "confirmed unitary". */
  notExcluded: string[];
  via: string;
  answerProvenance?: ClaimProvenance;
  corroboration?: CorroborationResult;
  error?: string;
}

function summaryLine(OPT: Record<string, string>, r: UnitaryResult): string {
  if (!r.ok) return `UNITARY: FAILED -- ${r.error}`;
  const excludedText = r.excluded.length
    ? r.excluded.map((e) => `${e.letter}) ${e.name} [source: "${e.span}"]`).join('  |  ')
    : '(none stated)';
  const notExcludedText = r.notExcluded.length
    ? r.notExcluded.map((L) => `${L}) ${OPT[L]}`).join(', ')
    : '(none)';
  const discardNote = r.discarded ? ` -- discarded ${r.discarded} candidate(s) with no verifiable span` : '';
  const provenanceNote = r.answerProvenance ? `  ||  ANSWERED VIA ${r.answerProvenance.mechanism}: ${r.answerProvenance.detail}` : '';
  const corrobNote = r.corroboration ? `  ||  ${summarizeCorroboration(r.corroboration)}` : '';
  return `UNITARY -- query: "${r.query}"  ||  EXCLUDED (source-stated conglomerate/grouping, not a single unitary region): `
    + `${excludedText}${discardNote}  ||  NOT EXCLUDED (source silent -- stays in the frame, omission is not confirmed unitary): ${notExcludedText}`
    + `${provenanceNote}${corrobNote}`;
}

// ───────────────── the live step (owned evidence -> conversational -> corroboration) ─────────────────

/**
 * Runs 'Unitary:1' -- FD-BP154-16's "unitary vs conglomerate" factor, as its own Composer step.
 * Same three-stage discipline every sibling step (Softballs:1/NamedSet:1/Discriminator:1) already
 * uses. Cannot be exercised end to end under vitest (live Ollama/browser needed) -- the pure parts
 * above carry the real unit tests; this function is verified by a live in-app run.
 */
export async function runUnitaryStep(
  input: MethodQuestionInput,
  ctx: MethodRunContext,
): Promise<{ result: UnitaryResult; summary: string }> {
  const OPT = input.options;
  if (!OPT || Object.keys(OPT).length === 0) {
    const result: UnitaryResult = {
      ok: false, query: null, excluded: [], discarded: 0, notExcluded: [], via: 'n/a',
      error: 'this question has no lettered options -- UNITARY tests unitary-vs-conglomerate among options and cannot run without them',
    };
    return { result, summary: summaryLine({}, result) };
  }
  const all = Object.keys(OPT);
  const query = buildUnitaryQuery(all, OPT);
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
    const result: UnitaryResult = {
      ok: false, query, excluded: [], discarded: 0, notExcluded: all, via: 'n/a',
      error: `no usable answer from any authority -- owned evidence: ${ownedCandidates.length} candidate(s) tried, none usable; `
        + `conversational authority: ${conversationalError ?? 'not tried'} -- UNITARY is UNAVAILABLE, not "nothing excluded"`,
    };
    return { result, summary: summaryLine(OPT, result) };
  }

  const rawOut: {
    text?: string; truncated?: boolean; failureCause?: 'transport' | 'http-error' | 'parse-error'; failureDetail?: string;
  } = {};
  const instruction = 'From the passage, list every option below that the passage explicitly and '
    + 'directly states is a CONGLOMERATE or GROUPING of multiple separate countries/sub-regions, '
    + 'not a single unitary region. For each one, copy the exact verbatim sentence or clause from '
    + 'the passage that states this. Do not include an option the passage merely does not mention '
    + `-- an omission is not a statement. Options: ${all.map((L) => `${L}) ${OPT[L]}`).join('; ')}`;
  const shape = '{"excluded":[{"name":"exact option name from the list","span":"verbatim sentence or clause from the passage stating it is a conglomerate/grouping, not one region"}]}';
  const ex = await gemmaExtract(instruction, text, shape, rawOut);
  if (ex === null) {
    const cause = rawOut.truncated
      ? 'the local extraction model truncated its output before finishing'
      : rawOut.failureCause
        ? `the local extraction model failed (${rawOut.failureCause}${rawOut.failureDetail ? `: ${rawOut.failureDetail}` : ''})`
        : 'the local extraction model failed for an unclassified reason';
    const result: UnitaryResult = {
      ok: false, query, excluded: [], discarded: 0, notExcluded: all, via,
      error: `extraction failed -- ${cause} -- reported as a FAILURE, never an empty "nothing excluded"`,
    };
    return { result, summary: summaryLine(OPT, result) };
  }
  const { excluded, discarded } = verifyUnitaryExcludedEntries(ex.excluded, text, OPT);
  const excludedLetters = new Set(excluded.map((e) => e.letter));
  const notExcluded = all.filter((L) => !excludedLetters.has(L));

  let corroboration: CorroborationResult | undefined;
  if (excluded.length) {
    corroboration = await corroborateClaim(ctx, buildUnitaryCorroborationQuery(excluded[0]), excluded[0].name);
  }

  const result: UnitaryResult = {
    ok: true, query, excluded, discarded, notExcluded, via, answerProvenance: provenance, corroboration,
  };
  return { result, summary: summaryLine(OPT, result) };
}

// ───────────────────────── registration (inert until stacked and run) ─────────────────────────

const UNITARY_DECLARATION: StepDeclaration = {
  id: 'liana_cycle.unitary_step.runUnitaryStep',
  version: '1',
  sourceFile: 'src/main/liana_cycle/library/unitary_step.ts',
  sourceLine: 1,
  exportName: 'runUnitaryStep',
  exportKind: 'function',
  whatItDoes:
    'Asks ONE question -- which of the answer options are a CONGLOMERATE/GROUPING of multiple '
    + 'separate regions or countries rather than a single unitary region (FD-BP154-16\'s '
    + '"unitary vs conglomerate" membership factor) -- tried against owned evidence first, then the '
    + 'conversational authority; shows exactly which options the source explicitly said are a '
    + 'conglomerate, each with a verbatim span, plus ONE Google corroboration for the decisive '
    + 'claim. Never excludes an option the source simply did not mention.',
  inputs: 'MethodQuestionInput (question, options, qid) plus MethodRunContext to runUnitaryStep().',
  outputs: 'Promise<{ result: UnitaryResult, summary: string }> -- excluded (conglomerate) options with verbatim spans, discard count, options the source left unaddressed, mechanism, and a document corroboration attempt.',
  decidesOrReports: 'DECIDES_AND_REFUSES',
  queryText: {
    issuesQuery: true,
    description: 'One primary question per run -- owned evidence tried first, then "which of these are a conglomerate/grouping, not a single unitary region?" put to the conversational authority -- plus at most one Google corroboration query.',
    loadedFromQueryResource: false,
  },
  attribution: {
    kind: 'ATTRIBUTED',
    founderRuling: 'BP154',
    quote:
      'Central Asia is not considered a single world region, but a conglomerate of multiple regions... '
      + 'This elimination must be SOURCED with a verbatim span, like every other.',
    citedAt: 'D-BP154-043 dispatch (this ticket); the general factor itself is FD-BP154-16\'s ratified '
      + '"unitary vs conglomerate" membership factor',
  },
  orphanEvidence:
    'N/A -- not an orphan. Live: registered via registerUnitaryStep() (this file), executed by '
    + 'script_bridge.ts\'s runOneStep() for id "Unitary:1".',
};

/** Registers 'Unitary:1'. Called from script_bridge.ts's ensureRegistryPopulated(), idempotently
 *  -- same try/catch shape as every other Composer step registration there. */
export function registerUnitaryStep(): MethodIdentity {
  return registerNameNumbered('Unitary', 1, UNITARY_DECLARATION);
}
