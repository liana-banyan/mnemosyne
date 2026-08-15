// target_class_step.ts -- D-BP154-058/BISHOP-SEG/S52/seg-wiregate PART 5
//
// 'TargetClass:1' -- THE TARGET-CLASS GATE (SPEC_COMPARABILITY_GATE_BP154.md, spec part 2's own
// FrameContract.targetClass; original dispatch's own PART 5: "the target class from curriculum
// authorities... has never once succeeded"). Founder, D-BP154-058: "the boundary question is asked
// in context rather than in a vacuum, which is likely why it came back loose."
//
// ONE QUESTION: what does the curriculum/instructional literature (sources 11-20,
// SOURCES_BP154_SPECS.md/sources_automated_reasoning_category_errors.md -- AP Human Geography and
// world-regional-geography course materials) name as the conventional "major world human population
// concentrations"? Answered THROUGH THE MACHINE ONLY -- ctx.askConversationalAuthorityAs('user_perplexity', ...)
// (D-BP154-044, FD-BP154-19: "you can use claude or perplexity as facts gathering -- perplexity is
// excellent for such"), never an out-of-band fetch; falls back to ctx.askConversationalAuthority
// (Gemini) only if Perplexity is not wired for this run. A query issued through either field lands
// in the evidence store exactly like every other Composer-step query (THE PAIL's own recording
// wrap) -- this is acquisition, never corroboration (FD-BP154-02/03 keeps those separate).
//
// THIS STEP ESTABLISHES A FRAME, IT DOES NOT RANK OR ELIMINATE. Its own `members` are reported,
// span-verified; downstream steps decide what to do with them (this file makes no elimination
// decision itself, FD-BP153-06 -- no rule here may select a letter). The one integration THIS
// ticket wires: boundary_step.ts's own buildBoundaryQuery() accepts an OPTIONAL frame-context
// string built from this step's own established target class, so the boundary question is asked
// INSIDE the stated curriculum frame rather than in a vacuum (Founder's own diagnosis of why the
// bare judgement came back loose, 6 of 9).
//
// classify_cascade.ts is FORBIDDEN and was not read to build this file.

import {
  appearsIn, gemmaExtract,
} from '../methods/comparative_cascade';
import type { MethodQuestionInput, MethodRunContext } from '../method_registry';
import { registerNameNumbered } from './method_registry';
import type { MethodIdentity } from './method_identity';
import type { StepDeclaration } from './step_declaration';
import { spanIsVerbatimInPassage } from './composer_step_evidence';

// ───────────────────── pure parts (unit-testable without a live Ollama/browser) ─────────────────────

/** THE ONE QUERY. Names the target construct directly and asks for an enumerated, named answer --
 *  never a synonym table, never this file inventing which regions belong; the source states its
 *  own list. */
export function buildTargetClassQuery(): string {
  return 'According to standard human/world-regional geography curriculum and instructional '
    + 'materials (for example, AP Human Geography course content or world regional geography '
    + 'textbooks), what are the major world human population concentrations or clusters '
    + 'conventionally identified and named? List them by name, in the order the source states '
    + 'them, and do not omit any it names.';
}

export interface TargetClassMember {
  name: string;
  /** Verbatim span from the passage naming this member as part of the target class. */
  span: string;
}

type RawTargetClassMember = { name?: unknown; span?: unknown };

/** THE VERIFY-THE-SPAN CHOKE POINT (FD-BP153-07 FIX 2), same discipline every sibling step's own
 *  verify function applies: a non-empty name, a non-empty span, and the span VERBATIM in the
 *  passage. Never requires the span to resolve to a lettered option (this step runs independently
 *  of any one question's own option set) -- `appearsIn` here checks only that the span is
 *  genuinely ABOUT the named member (the member's own text appears within its own span), the same
 *  "about-ness" discipline every sibling verify function already applies to option letters. */
export function verifyTargetClassMembers(
  raw: unknown,
  passage: string,
): { members: TargetClassMember[]; discarded: number } {
  const entries = Array.isArray(raw) ? (raw as RawTargetClassMember[]) : [];
  const members: TargetClassMember[] = [];
  const seen = new Set<string>();
  let discarded = 0;
  for (const entry of entries) {
    const name = typeof entry?.name === 'string' ? entry.name.trim() : '';
    const span = typeof entry?.span === 'string' ? entry.span.trim() : '';
    if (!name) continue; // nothing named -- not a candidate value, not a discard
    if (!span || !spanIsVerbatimInPassage(passage, span) || !appearsIn(span, name)) {
      discarded++;
      continue;
    }
    const key = name.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(key)) continue; // one entry per named member; a repeat is neither kept nor double-counted
    seen.add(key);
    members.push({ name, span });
  }
  return { members, discarded };
}

export interface TargetClassResult {
  ok: boolean;
  query: string | null;
  /** Fixed label for what this gate establishes -- the FrameContract.targetClass this run's own
   *  members were sourced against. Never varies per-run (the QUESTION varies; the CONSTRUCT this
   *  step asks about does not). */
  targetClass: string;
  /** True only when at least one member was verified with a genuine verbatim span -- a frame with
   *  zero verified members is NOT established, reported honestly as such, never silently treated
   *  as "the class is empty". */
  established: boolean;
  members: TargetClassMember[];
  discarded: number;
  /** The authority's own structured citations (ConversationalAuthorityResult.citations), if any --
   *  reported alongside, never required for `established` (a genuine curriculum source may answer
   *  without the transport surfacing a separate citations list; the verbatim span IS the evidence
   *  either way). */
  citations: string[];
  via: string;
  error?: string;
}

/** Builds an optional frame-context clause for another step's own query text -- e.g.
 *  boundary_step.ts's buildBoundaryQuery(). Returns '' (never a fabricated frame) when this gate
 *  did not establish anything. Reads only this step's own already-verified `members`/`targetClass`
 *  -- never invents a frame the source did not state. */
export function targetClassFrameContext(result: TargetClassResult | null): string {
  if (!result?.ok || !result.established || result.members.length === 0) return '';
  const names = result.members.map((m) => m.name).join(', ');
  return `Within the stated curriculum frame of "${result.targetClass}" -- conventionally identified `
    + `instructional sources name ${names} as members of that class -- `;
}

function summaryLine(r: TargetClassResult): string {
  if (!r.ok) return `TARGET CLASS: FAILED -- ${r.error}`;
  const membersText = r.members.length
    ? r.members.map((m) => `${m.name} [source: "${m.span}"]`).join('  |  ')
    : '(none verified)';
  const citationsText = r.citations.length ? r.citations.join(', ') : '(none returned)';
  const discardNote = r.discarded ? ` -- discarded ${r.discarded} candidate(s) with no verifiable span` : '';
  return `TARGET CLASS -- query: "${r.query}"  ||  TARGET CLASS: "${r.targetClass}"  ||  `
    + `ESTABLISHED: ${r.established}  ||  MEMBERS: ${membersText}${discardNote}  ||  CITATIONS: ${citationsText}  ||  VIA: ${r.via}`;
}

// ───────────────── the live step (Perplexity preferred, Gemini fallback, no owned-evidence stage) ─────────────────

const TARGET_CLASS_LABEL = "major world human population concentrations";

/**
 * Runs 'TargetClass:1'. Unlike every option-classifying sibling step, this one asks a GENERAL
 * curriculum question independent of any one question's own option set -- no owned-evidence-first
 * stage (gatherMortgageCandidates() is keyed to option-mentioning passages, which this query is not
 * about) and no per-option corroboration; the source's own citations (ConversationalAuthorityResult.citations)
 * are the corroboration. Cannot be exercised end to end under vitest (live network needed) -- the
 * pure parts above carry the real unit tests; this function is verified by a live in-app run.
 */
export async function runTargetClassStep(
  _input: MethodQuestionInput,
  ctx: MethodRunContext,
): Promise<{ result: TargetClassResult; summary: string }> {
  const query = buildTargetClassQuery();

  // D-BP154-044/FD-BP154-19: Perplexity preferred for facts-gathering (citations arrive WITH the
  // answer) -- tried first, THROUGH THE MACHINE ONLY. Falls back to the default conversational
  // authority (Gemini) only if Perplexity is not wired for this run; never an out-of-band fetch
  // either way.
  let text = '';
  let via = '';
  let citations: string[] = [];
  let usedError: string | undefined;
  if (ctx.askConversationalAuthorityAs) {
    const pr = await ctx.askConversationalAuthorityAs('user_perplexity', query);
    if (pr.ok && pr.text.trim()) {
      text = pr.text; via = `conversational:${pr.authority}`; citations = pr.citations ?? [];
    } else {
      usedError = `perplexity: ${pr.via || pr.authority || 'no usable answer'}`;
    }
  }
  if (!text && ctx.askConversationalAuthority) {
    const gr = await ctx.askConversationalAuthority(query);
    if (gr.ok && gr.text.trim()) {
      text = gr.text; via = `conversational:${gr.authority}`; citations = gr.citations ?? [];
    } else {
      usedError = [usedError, `gemini: ${gr.via || gr.authority || 'no usable answer'}`].filter(Boolean).join('; ');
    }
  }

  if (!text) {
    const result: TargetClassResult = {
      ok: false, query, targetClass: TARGET_CLASS_LABEL, established: false, members: [], discarded: 0,
      citations: [], via: 'n/a',
      error: `no usable answer from any conversational authority -- ${usedError ?? 'neither Perplexity nor the default authority is wired for this run'} `
        + '-- TARGET CLASS is UNAVAILABLE, not "the class has no members"',
    };
    return { result, summary: summaryLine(result) };
  }

  const rawOut: {
    text?: string; truncated?: boolean; failureCause?: 'transport' | 'http-error' | 'parse-error'; failureDetail?: string;
  } = {};
  const instruction = 'From the passage, list every named major world human population '
    + 'concentration/cluster it states, in the order stated. For each one, copy the exact verbatim '
    + 'sentence or clause from the passage that names it. Do not include a region the passage does '
    + 'not actually name as one of these concentrations.';
  const shape = '{"members":[{"name":"the region\'s own name as the passage states it","span":"verbatim sentence or clause from the passage naming it"}]}';
  const ex = await gemmaExtract(instruction, text, shape, rawOut);
  if (ex === null) {
    const cause = rawOut.truncated
      ? 'the local extraction model truncated its output before finishing'
      : rawOut.failureCause
        ? `the local extraction model failed (${rawOut.failureCause}${rawOut.failureDetail ? `: ${rawOut.failureDetail}` : ''})`
        : 'the local extraction model failed for an unclassified reason';
    const result: TargetClassResult = {
      ok: false, query, targetClass: TARGET_CLASS_LABEL, established: false, members: [], discarded: 0,
      citations, via,
      error: `extraction failed -- ${cause} -- reported as a FAILURE, never an empty "no members"`,
    };
    return { result, summary: summaryLine(result) };
  }
  const { members, discarded } = verifyTargetClassMembers(ex.members, text);

  const result: TargetClassResult = {
    ok: true, query, targetClass: TARGET_CLASS_LABEL, established: members.length > 0, members, discarded, citations, via,
  };
  return { result, summary: summaryLine(result) };
}

// ───────────────────────── registration (inert until stacked and run) ─────────────────────────

const TARGET_CLASS_DECLARATION: StepDeclaration = {
  id: 'liana_cycle.target_class_step.runTargetClassStep',
  version: '1',
  sourceFile: 'src/main/liana_cycle/library/target_class_step.ts',
  sourceLine: 1,
  exportName: 'runTargetClassStep',
  exportKind: 'function',
  whatItDoes:
    'Establishes the TARGET-CLASS GATE (SPEC_COMPARABILITY_GATE_BP154.md part 2\'s FrameContract.targetClass) '
    + 'by asking curriculum/instructional sources, through Perplexity preferred (citations arrive with the '
    + 'answer) then Gemini as fallback, what the conventional "major world human population concentrations" '
    + 'are named as -- span-verified, never invented. Feeds an optional frame-context clause into '
    + 'boundary_step.ts\'s own query via targetClassFrameContext(), so the boundary-definition question is '
    + 'asked inside a stated curriculum frame rather than in a vacuum.',
  inputs: 'MethodQuestionInput plus MethodRunContext to runTargetClassStep() (askConversationalAuthorityAs/askConversationalAuthority).',
  outputs: 'Promise<{ result: TargetClassResult, summary: string }> -- established flag, verified named members with verbatim spans, discard count, the authority\'s own citations, and mechanism.',
  decidesOrReports: 'DECIDES_AND_REFUSES',
  queryText: {
    issuesQuery: true,
    description: 'One primary curriculum question -- Perplexity preferred, Gemini fallback -- asking what standard instructional sources name as the major world human population concentrations.',
    loadedFromQueryResource: false,
  },
  attribution: {
    kind: 'ATTRIBUTED',
    founderRuling: 'BP154',
    quote: 'the target class from the curriculum authorities... has never once succeeded... the boundary '
      + 'question is asked in context rather than in a vacuum, which is likely why it came back loose.',
    citedAt: 'D-BP154-053/057/058 dispatches; original SPEC PART 5, this ticket',
  },
  orphanEvidence:
    'N/A -- not an orphan. Live: registered via registerTargetClassStep() (this file), executed by '
    + 'script_bridge.ts\'s runOneStep() for id "TargetClass:1".',
};

/** Registers 'TargetClass:1'. Called from script_bridge.ts's ensureRegistryPopulated(),
 *  idempotently -- same try/catch shape as every other Composer step registration there. */
export function registerTargetClassStep(): MethodIdentity {
  return registerNameNumbered('TargetClass', 1, TARGET_CLASS_DECLARATION);
}
