// named_set_step.ts -- D-BP154-013/BISHOP/S13/seg-composerstep, STEP 2/3
//
// THE NAMED SET AS A COMPOSER STEP. FD-BP153-07's canonical shape of a run, ratified "YES THIS":
// "2. THE NAMED SET. Which of these ARE `<the superlative property>`? The membership test. On the
// real BP153 passage it returned B, D, E unprompted."
//
// SAME BOUNDARY AS softballs_step.ts (see that file's own header, not repeated in full here):
// classify_cascade.ts is FORBIDDEN to edit or depend on in this ticket. This file imports nothing
// from it -- only the same generic, already-shared primitives comparative_cascade.ts exports
// (googleBlocks/gemmaExtract/appearsIn/list/toLetters), read-only, unmodified.
//
// THE DIRECTION, MIRRORED FROM softballs_step.ts. THE SOFTBALLS asks which options are NOT the
// CATEGORY at all (the frame). THE NAMED SET asks which options ARE the full SUPERLATIVE PROPERTY
// the question names (e.g. "the world's most densely populated regions", not merely "world
// regions") -- a stricter, positive membership test over the survivors THE SOFTBALLS leaves in
// frame. This step does not read THE SOFTBALLS' own output or narrow its own option list by it --
// each step in the Composer runs over the SAME full option set it is handed (FD-BP152-09,
// "everything is a step, sequences nest") and the Founder orders and reads them himself; the
// stack is his to compose, not this file's to pre-chain.
//
// EXTRACTION ONLY, NEVER JUDGMENT (HARDWIRE-22). Absence is omission: an option the passage does
// not mention is never added to `included` -- only a name the passage explicitly and verifiably
// states IS a member. Every included option carries the verbatim span it was read from; anything
// without one is discarded and the discard is counted, never silently dropped. Every failure path
// is NAMED, never a silent empty result standing in for "the source confirmed nothing qualifies".
//
// NO RULE HERE MAY SELECT A PARTICULAR LETTER (FD-BP153-06) -- every option letter is treated
// identically by every function below.
//
// OUT OF SCOPE (this ticket's dispatch, D-BP154-013): ranking, magnitude, any verdict, and the
// doublecheck. This file produces ONLY the inclusion list with its spans.

import {
  appearsIn, gemmaExtract, googleBlocks, list, toLetters,
} from '../methods/comparative_cascade';
import type { MethodQuestionInput, MethodRunContext } from '../method_registry';
import { registerNameNumbered } from './method_registry';
import type { MethodIdentity } from './method_identity';
import type { StepDeclaration } from './step_declaration';

// ───────────────────── pure parts (unit-testable without a live Ollama/browser) ─────────────────────

/** Reads the FULL superlative property phrase the question itself names -- for qid 98,
 *  "Which of the following world regions is NOT considered one of the world's most densely
 *  populated regions?" -> "world's most densely populated regions". Deliberately the WHOLE
 *  phrase (not comparative_cascade.ts's own shorter "densely populated" property extraction,
 *  which serves its own ranking-vocabulary purpose) -- FD-BP153-07's NAMED SET question is "which
 *  of these ARE <the superlative property>", and the property that answers it is what the
 *  question calls membership IN, i.e. everything after "one of"/"considered". Pure text-structure
 *  parsing of the question's OWN wording, never a judgment -- returns null (never a guess) when
 *  the question does not fit this shape. */
export function deriveNamedSetProperty(question: string): string | null {
  const m1 = question.match(/\bone of\s+(?:the\s+)?([a-z0-9][^?]*?)\??$/i);
  if (m1 && m1[1].trim()) return m1[1].trim();
  const m2 = question.match(/\bconsidered\s+(?:the\s+)?([a-z0-9][^?]*?)\??$/i);
  if (m2 && m2[1].trim()) return m2[1].trim();
  return null;
}

/** THE ONE QUERY (FD-BP153-07 point 2; FD-BP153-01 consequence 4, "one query, not one per
 *  option"). */
export function buildNamedSetQuery(property: string, all: string[], OPT: Record<string, string>): string {
  return `Which of the following ARE ${property}? Answer plainly and directly for any that are `
    + `-- name it explicitly and state clearly that it is ${property}. Do not guess about ones `
    + `you are not sure of; simply do not mention those. ${list(all, OPT)}`;
}

export interface IncludedOption {
  letter: string;
  name: string;
  /** The verbatim span (sentence or clause) copied from the source passage, proving the source
   *  itself stated this option IS a member of the named property. */
  span: string;
}

/** Whitespace-normalized verbatim containment -- same discipline as softballs_step.ts's own
 *  spanIsVerbatimInPassage() (FD-BP153-07 FIX 2: "the span must appear VERBATIM in the source
 *  passage, normalize whitespace only -- do not fuzzy match"), duplicated locally rather than
 *  imported from either forbidden file or from softballs_step.ts (each Composer step stays
 *  self-contained -- no step depends on another step's internals, only on the shared, generic
 *  comparative_cascade.ts primitives every cascade already reuses). */
function spanIsVerbatimInPassage(passage: string, span: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  const s = norm(span);
  if (!s) return false;
  return norm(passage).includes(s);
}

/** One raw `{name, span}` entry exactly as gemmaExtract()'s JSON parse may hand it back --
 *  untyped on purpose, nothing here has verified a single field of it yet. */
type RawIncludedEntry = { name?: unknown; span?: unknown };

/** THE VERIFY-THE-SPAN CHOKE POINT for this step (FD-BP153-07 FIX 2), mirrored from
 *  softballs_step.ts's verifyExcludedEntries() with the same four-part discipline: (a) non-empty
 *  `name`, (b) non-empty `span`, (c) span VERBATIM in `passage`, (d) span itself ABOUT the named
 *  option (appearsIn(span, OPT[L])). Every failure of (b)/(c)/(d) is a DISCARD and is counted,
 *  never silently dropped. A `name` mapping to no known option letter is simply not a match --
 *  not a candidate value, so not a discard either (same convention as every other extractor in
 *  this estate). */
export function verifyIncludedEntries(
  raw: unknown,
  passage: string,
  OPT: Record<string, string>,
): { included: IncludedOption[]; discarded: number } {
  const entries = Array.isArray(raw) ? (raw as RawIncludedEntry[]) : [];
  const included: IncludedOption[] = [];
  const seen = new Set<string>();
  let discarded = 0;
  for (const entry of entries) {
    const name = typeof entry?.name === 'string' ? entry.name.trim() : '';
    const span = typeof entry?.span === 'string' ? entry.span.trim() : '';
    if (!name) continue; // nothing named -- not a candidate value, not a discard
    const matched = toLetters([name], OPT);
    if (matched.length === 0) continue; // names no known option -- not a candidate value here
    const L = matched[0];
    if (!span || !spanIsVerbatimInPassage(passage, span) || !appearsIn(span, OPT[L])) {
      discarded++;
      continue;
    }
    if (seen.has(L)) continue; // one entry per option; a repeat is neither kept nor double-counted
    seen.add(L);
    included.push({ letter: L, name: OPT[L], span });
  }
  return { included, discarded };
}

export interface NamedSetResult {
  ok: boolean;
  property: string | null;
  query: string | null;
  included: IncludedOption[];
  discarded: number;
  /** Options the source did NOT state are members -- ABSENCE IS OMISSION (ticket rule): this is
   *  never reported as "confirmed non-members", only as "not affirmed by this passage". */
  notIncluded: string[];
  via: string;
  error?: string;
}

function summaryLine(OPT: Record<string, string>, r: NamedSetResult): string {
  if (!r.ok) return `NAMED SET: FAILED -- ${r.error}`;
  const includedText = r.included.length
    ? r.included.map((e) => `${e.letter}) ${e.name} [source: "${e.span}"]`).join('  |  ')
    : '(none stated)';
  const notIncludedText = r.notIncluded.length
    ? r.notIncluded.map((L) => `${L}) ${OPT[L]}`).join(', ')
    : '(none)';
  const discardNote = r.discarded ? ` -- discarded ${r.discarded} candidate(s) with no verifiable span` : '';
  return `NAMED SET -- query: "${r.query}"  ||  INCLUDED (source-stated members of ${r.property}): `
    + `${includedText}${discardNote}  ||  NOT INCLUDED (source silent -- omission, not confirmed non-membership): ${notIncludedText}`;
}

// ───────────────── the live step (googleBlocks + gemmaExtract, needs a real run to verify) ─────────────────

/**
 * Runs THE NAMED SET as one Composer step: one query, one extraction pass, verified spans.
 * Cannot be exercised end to end under vitest -- googleBlocks() needs the live browser authority
 * and gemmaExtract() needs a live Ollama instance, the same boundary softballs_step.ts's own
 * header states. The pure parts above (deriveNamedSetProperty, buildNamedSetQuery,
 * verifyIncludedEntries) carry the real unit tests; this function is verified by a live in-app
 * run (this ticket's own return).
 */
export async function runNamedSetStep(
  input: MethodQuestionInput,
  ctx: MethodRunContext,
): Promise<{ result: NamedSetResult; summary: string }> {
  const OPT = input.options;
  if (!OPT || Object.keys(OPT).length === 0) {
    const result: NamedSetResult = {
      ok: false, property: null, query: null, included: [], discarded: 0, notIncluded: [],
      via: 'n/a',
      error: 'this question has no lettered options -- THE NAMED SET tests membership among options and cannot run without them',
    };
    return { result, summary: summaryLine({}, result) };
  }
  const all = Object.keys(OPT);
  const property = deriveNamedSetProperty(input.question);
  if (!property) {
    const result: NamedSetResult = {
      ok: false, property: null, query: null, included: [], discarded: 0, notIncluded: all,
      via: 'n/a',
      error: 'could not determine the superlative property this question names (no "one of/considered ... ?" phrase found) -- refusing rather than guessing',
    };
    return { result, summary: summaryLine(OPT, result) };
  }
  const query = buildNamedSetQuery(property, all, OPT);
  const res = await googleBlocks(ctx.askGoogle, query);
  if (!res.ok || !res.text || !res.text.trim()) {
    const result: NamedSetResult = {
      ok: false, property, query, included: [], discarded: 0, notIncluded: all, via: res.via,
      error: `no usable answer (${res.via}) -- THE NAMED SET is UNAVAILABLE, not "nothing included"`,
    };
    return { result, summary: summaryLine(OPT, result) };
  }
  const namesAnyOption = all.some((L) => appearsIn(res.text, OPT[L]));
  if (!namesAnyOption) {
    const result: NamedSetResult = {
      ok: false, property, query, included: [], discarded: 0, notIncluded: all, via: res.via,
      error: `the source's passage (${res.via}) names none of the options -- it cannot state anything about them`,
    };
    return { result, summary: summaryLine(OPT, result) };
  }
  const rawOut: {
    text?: string; truncated?: boolean; failureCause?: 'transport' | 'http-error' | 'parse-error'; failureDetail?: string;
  } = {};
  const instruction = `From the passage, list every option below that the passage explicitly and `
    + `directly states IS ${property}. For each one, copy the exact verbatim sentence or clause `
    + `from the passage that states it is ${property}. Do not include an option the passage `
    + `merely does not mention -- an omission is not a statement. Only include an option the `
    + `passage directly affirms membership for. Options: ${all.map((L) => `${L}) ${OPT[L]}`).join('; ')}`;
  const shape = '{"included":[{"name":"exact option name from the list","span":"verbatim sentence or clause from the passage stating it is the property"}]}';
  const ex = await gemmaExtract(instruction, res.text, shape, rawOut);
  if (ex === null) {
    const cause = rawOut.truncated
      ? 'the local extraction model truncated its output before finishing'
      : rawOut.failureCause
        ? `the local extraction model failed (${rawOut.failureCause}${rawOut.failureDetail ? `: ${rawOut.failureDetail}` : ''})`
        : 'the local extraction model failed for an unclassified reason';
    const result: NamedSetResult = {
      ok: false, property, query, included: [], discarded: 0, notIncluded: all, via: res.via,
      error: `extraction failed -- ${cause} -- reported as a FAILURE, never an empty "nothing included"`,
    };
    return { result, summary: summaryLine(OPT, result) };
  }
  const { included, discarded } = verifyIncludedEntries(ex.included, res.text, OPT);
  const includedLetters = new Set(included.map((e) => e.letter));
  const notIncluded = all.filter((L) => !includedLetters.has(L));
  const result: NamedSetResult = {
    ok: true, property, query, included, discarded, notIncluded, via: res.via,
  };
  return { result, summary: summaryLine(OPT, result) };
}

// ───────────────────────── registration (inert until stacked and run) ─────────────────────────

const NAMED_SET_DECLARATION: StepDeclaration = {
  id: 'liana_cycle.named_set_step.runNamedSetStep',
  version: '1',
  sourceFile: 'src/main/liana_cycle/library/named_set_step.ts',
  sourceLine: 1,
  exportName: 'runNamedSetStep',
  exportKind: 'function',
  whatItDoes:
    'Asks ONE question -- which of the answer options ARE the specific superlative property the '
    + 'question names (e.g. "the world\'s most densely populated regions") -- and shows exactly '
    + 'which options the source explicitly said qualify, each with the verbatim sentence it said '
    + 'so in. Never includes an option the source simply did not mention.',
  inputs: 'MethodQuestionInput (question, options) plus MethodRunContext (askGoogle, emit) to runNamedSetStep().',
  outputs: 'Promise<{ result: NamedSetResult, summary: string }> -- included options with verbatim spans, discard count, and the options the source left unaddressed.',
  decidesOrReports: 'DECIDES_AND_REFUSES',
  queryText: {
    issuesQuery: true,
    description: 'One query per run: "Which of the following ARE <property>?" (FD-BP153-07 THE NAMED SET), hardcoded inline in this file.',
    loadedFromQueryResource: false,
  },
  attribution: {
    kind: 'ATTRIBUTED',
    founderRuling: 'BP153',
    quote:
      'THE NAMED SET. Which of these ARE `<the superlative property>`? The membership test. On the '
      + 'real BP153 passage it returned B, D, E unprompted.',
    citedAt: 'LianaBanyanPlatform/BISHOP_DROPZONE/RULINGS_BP153.md FD-BP153-07',
  },
  orphanEvidence:
    'N/A -- not an orphan. Live: registered via registerNamedSetStep() (this file), executed by '
    + 'script_bridge.ts\'s runOneStep() for id "NamedSet:1", the same wiring pattern Softballs:1, '
    + 'Survey:1 and StateTheQuestion:1 already use.',
};

/** Registers 'NamedSet:1'. Called from script_bridge.ts's ensureRegistryPopulated(), idempotently
 *  -- same try/catch shape as the other Composer step registrations there. */
export function registerNamedSetStep(): MethodIdentity {
  return registerNameNumbered('NamedSet', 1, NAMED_SET_DECLARATION);
}
