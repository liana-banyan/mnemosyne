// discriminator_step.ts -- D-BP154-013/BISHOP/S13/seg-composerstep, STEP 3/3
//
// THE DISCRIMINATOR AS A COMPOSER STEP. FD-BP153-07's canonical shape of a run, ratified "YES
// THIS": "3. THE DISCRIMINATOR. What kind is each survivor, and what kind does `<category>`
// denote? Breaks A from C and F on a STATED distinction."
//
// SAME BOUNDARY AS softballs_step.ts / named_set_step.ts (see those files' own headers, not
// repeated in full here): classify_cascade.ts is FORBIDDEN to edit or depend on in this ticket.
// This file imports nothing from it -- only the same generic, already-shared primitives
// comparative_cascade.ts exports (googleBlocks/gemmaExtract/appearsIn/list/toLetters), read-only,
// unmodified. classify_cascade.ts's own establishFrame()/extractDiscriminatorKinds() ask a
// SIMILAR question in service of the pipeline's own terminator machinery; this file is a
// separate, self-contained implementation for the Composer, built fresh rather than reused, per
// the ticket's own instruction that this ticket's steps must not depend on the pipeline they are
// meant to eventually replace.
//
// ONE QUERY, TWO THINGS ASKED IN IT (FD-BP153-07 point 3, and FD-BP153-01 consequence 4, "one
// query, not one per option"): what kind/classification each option is, AND which one of those
// kinds properly denotes the category the question names. Both are asked in the SAME query text,
// never as two separate round trips.
//
// EXTRACTION ONLY, NEVER JUDGMENT (HARDWIRE-22). Absence is omission: an option the passage does
// not classify is left with no stated kind -- never guessed, never left silently indistinguishable
// from "the source said it has no kind". Every stated kind carries the verbatim span it was read
// from; anything without one is discarded and the discard is counted. Every failure path is
// NAMED, never a silent empty result.
//
// NO RULE HERE MAY SELECT A PARTICULAR LETTER (FD-BP153-06) -- every option letter is treated
// identically by every function below; which kind properly denotes the category is read from the
// source's own words, never decided by this file.
//
// OUT OF SCOPE (this ticket's dispatch, D-BP154-013): ranking, magnitude, any verdict, and the
// doublecheck. This file reports ONLY the stated kinds and the stated category-denoting kind,
// each with its span -- it does NOT eliminate, rank, or answer the question.

import {
  appearsIn, gemmaExtract, googleBlocks, list, toLetters,
} from '../methods/comparative_cascade';
import type { MethodQuestionInput, MethodRunContext } from '../method_registry';
import { registerNameNumbered } from './method_registry';
import type { MethodIdentity } from './method_identity';
import type { StepDeclaration } from './step_declaration';

// ───────────────────── pure parts (unit-testable without a live Ollama/browser) ─────────────────────

/** Reads the category noun phrase the question itself names ("Which of the following world
 *  regions is NOT..." -> "world regions") -- the SAME shape softballs_step.ts's own
 *  deriveSoftballsCategory() parses, duplicated locally rather than imported so this file stays
 *  self-contained (no Composer step depends on another step's internals -- each depends only on
 *  the shared, generic comparative_cascade.ts primitives every cascade already reuses). Pure
 *  text-structure parsing of the question's OWN wording, never a judgment -- returns null (never
 *  a guess) when the question does not fit this shape. */
export function deriveDiscriminatorCategory(question: string): string | null {
  const m = question.match(/following\s+([a-z][a-z\s]*?)\s+(?:is|are)\b/i);
  const category = m ? m[1].trim() : '';
  return category || null;
}

/** THE ONE QUERY, asking BOTH things FD-BP153-07 point 3 names in a single round trip. */
export function buildDiscriminatorQuery(category: string, all: string[], OPT: Record<string, string>): string {
  return `For EACH of the following, state exactly what it is -- its actual classification or `
    + `type. Answer for every one, in order, and do not skip any. ${list(all, OPT)} Then, `
    + `separately and last, state which one of those classifications properly denotes "${category}".`;
}

export interface DiscriminatorEntry {
  letter: string;
  name: string;
  /** The stated classification/kind, verbatim as the source phrased it (not normalized or
   *  paraphrased). */
  kind: string;
  /** The verbatim span (sentence or clause) copied from the source passage, proving the source
   *  itself stated this option's kind. */
  span: string;
}

export interface CategoryKind {
  kind: string;
  span: string;
}

/** Whitespace-normalized verbatim containment -- same discipline as softballs_step.ts's own
 *  spanIsVerbatimInPassage() / named_set_step.ts's own copy (FD-BP153-07 FIX 2). Duplicated
 *  locally for the same self-containment reason stated above deriveDiscriminatorCategory(). */
function spanIsVerbatimInPassage(passage: string, span: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  const s = norm(span);
  if (!s) return false;
  return norm(passage).includes(s);
}

type RawKindEntry = { name?: unknown; kind?: unknown; span?: unknown };
type RawCategoryKind = { kind?: unknown; span?: unknown };

/** THE VERIFY-THE-SPAN CHOKE POINT for the per-option kinds (FD-BP153-07 FIX 2), same four-part
 *  discipline as softballs_step.ts's verifyExcludedEntries()/named_set_step.ts's
 *  verifyIncludedEntries(): (a) non-empty `name`, (b) non-empty `kind`, (c) non-empty `span`, (d)
 *  span VERBATIM in `passage`, (e) span itself ABOUT the named option (appearsIn(span, OPT[L])).
 *  Any failure of (b)/(c)/(d)/(e) is a DISCARD and is counted. A `name` mapping to no known
 *  option letter is simply not a match -- not a candidate value, not a discard. */
export function verifyDiscriminatorKinds(
  raw: unknown,
  passage: string,
  OPT: Record<string, string>,
): { kinds: DiscriminatorEntry[]; discarded: number } {
  const entries = Array.isArray(raw) ? (raw as RawKindEntry[]) : [];
  const kinds: DiscriminatorEntry[] = [];
  const seen = new Set<string>();
  let discarded = 0;
  for (const entry of entries) {
    const name = typeof entry?.name === 'string' ? entry.name.trim() : '';
    const kind = typeof entry?.kind === 'string' ? entry.kind.trim() : '';
    const span = typeof entry?.span === 'string' ? entry.span.trim() : '';
    if (!name) continue; // nothing named -- not a candidate value, not a discard
    const matched = toLetters([name], OPT);
    if (matched.length === 0) continue; // names no known option -- not a candidate value here
    const L = matched[0];
    if (!kind || !span || !spanIsVerbatimInPassage(passage, span) || !appearsIn(span, OPT[L])) {
      discarded++;
      continue;
    }
    if (seen.has(L)) continue; // one entry per option; a repeat is neither kept nor double-counted
    seen.add(L);
    kinds.push({ letter: L, name: OPT[L], kind, span });
  }
  return { kinds, discarded };
}

/** THE VERIFY-THE-SPAN CHOKE POINT for the category-denoting kind. Only verbatim-span
 *  verification applies here (there is no option name to cross-check against -- this is a
 *  statement about the CATEGORY, not about any one option). A missing or unverifiable span
 *  discards the candidate; the caller treats a discard here as "not stated", never a guess. */
export function verifyCategoryKind(raw: unknown, passage: string): { categoryKind: CategoryKind | null; discarded: boolean } {
  const entry = raw as RawCategoryKind | undefined;
  const kind = typeof entry?.kind === 'string' ? entry.kind.trim() : '';
  const span = typeof entry?.span === 'string' ? entry.span.trim() : '';
  if (!kind || !span || !spanIsVerbatimInPassage(passage, span)) {
    return { categoryKind: null, discarded: Boolean(kind || span) };
  }
  return { categoryKind: { kind, span }, discarded: false };
}

export interface DiscriminatorResult {
  ok: boolean;
  category: string | null;
  query: string | null;
  kinds: DiscriminatorEntry[];
  discardedKinds: number;
  /** Options the source never stated a kind for -- ABSENCE IS OMISSION: never guessed, never
   *  conflated with "the source said this has no kind". */
  noKindStated: string[];
  categoryKind: CategoryKind | null;
  categoryKindDiscarded: boolean;
  via: string;
  error?: string;
}

function summaryLine(OPT: Record<string, string>, r: DiscriminatorResult): string {
  if (!r.ok) return `DISCRIMINATOR: FAILED -- ${r.error}`;
  const kindsText = r.kinds.length
    ? r.kinds.map((e) => `${e.letter}) ${e.name} = "${e.kind}" [source: "${e.span}"]`).join('  |  ')
    : '(none stated)';
  const noKindText = r.noKindStated.length
    ? r.noKindStated.map((L) => `${L}) ${OPT[L]}`).join(', ')
    : '(none)';
  const categoryKindText = r.categoryKind
    ? `"${r.categoryKind.kind}" [source: "${r.categoryKind.span}"]`
    : r.categoryKindDiscarded
      ? '(source attempted an answer but it had no verifiable span -- discarded)'
      : '(not stated)';
  const discardNote = r.discardedKinds ? ` -- discarded ${r.discardedKinds} candidate(s) with no verifiable span` : '';
  return `DISCRIMINATOR -- query: "${r.query}"  ||  KINDS (source-stated, verified): ${kindsText}`
    + `${discardNote}  ||  NO KIND STATED (source silent -- omission, not "no kind"): ${noKindText}`
    + `  ||  WHICH KIND DENOTES "${r.category}": ${categoryKindText}`;
}

// ───────────────── the live step (googleBlocks + gemmaExtract, needs a real run to verify) ─────────────────

/**
 * Runs THE DISCRIMINATOR as one Composer step: one query asking both what each option is AND
 * which stated kind denotes the category, one extraction pass, verified spans. Cannot be
 * exercised end to end under vitest -- same boundary softballs_step.ts's/named_set_step.ts's own
 * headers state. The pure parts above carry the real unit tests; this function is verified by a
 * live in-app run (this ticket's own return).
 */
export async function runDiscriminatorStep(
  input: MethodQuestionInput,
  ctx: MethodRunContext,
): Promise<{ result: DiscriminatorResult; summary: string }> {
  const OPT = input.options;
  if (!OPT || Object.keys(OPT).length === 0) {
    const result: DiscriminatorResult = {
      ok: false, category: null, query: null, kinds: [], discardedKinds: 0, noKindStated: [],
      categoryKind: null, categoryKindDiscarded: false, via: 'n/a',
      error: 'this question has no lettered options -- THE DISCRIMINATOR classifies options and cannot run without them',
    };
    return { result, summary: summaryLine({}, result) };
  }
  const all = Object.keys(OPT);
  const category = deriveDiscriminatorCategory(input.question);
  if (!category) {
    const result: DiscriminatorResult = {
      ok: false, category: null, query: null, kinds: [], discardedKinds: 0, noKindStated: all,
      categoryKind: null, categoryKindDiscarded: false, via: 'n/a',
      error: 'could not determine the category this question names (no "following X is/are" phrase found) -- refusing rather than guessing a category',
    };
    return { result, summary: summaryLine(OPT, result) };
  }
  const query = buildDiscriminatorQuery(category, all, OPT);
  const res = await googleBlocks(ctx.askGoogle, query);
  if (!res.ok || !res.text || !res.text.trim()) {
    const result: DiscriminatorResult = {
      ok: false, category, query, kinds: [], discardedKinds: 0, noKindStated: all,
      categoryKind: null, categoryKindDiscarded: false, via: res.via,
      error: `no usable answer (${res.via}) -- THE DISCRIMINATOR is UNAVAILABLE, not "no kinds stated"`,
    };
    return { result, summary: summaryLine(OPT, result) };
  }
  const namesAnyOption = all.some((L) => appearsIn(res.text, OPT[L]));
  if (!namesAnyOption) {
    const result: DiscriminatorResult = {
      ok: false, category, query, kinds: [], discardedKinds: 0, noKindStated: all,
      categoryKind: null, categoryKindDiscarded: false, via: res.via,
      error: `the source's passage (${res.via}) names none of the options -- it cannot state anything about them`,
    };
    return { result, summary: summaryLine(OPT, result) };
  }
  const rawOut: {
    text?: string; truncated?: boolean; failureCause?: 'transport' | 'http-error' | 'parse-error'; failureDetail?: string;
  } = {};
  const instruction = `From the passage, for EACH option below, copy its stated classification `
    + `or kind (exactly what the passage says it is), and the exact verbatim sentence or clause `
    + `that states it. Do not include an option the passage does not classify -- an omission is `
    + `not a statement. Then, separately, copy which ONE classification the passage states `
    + `properly denotes "${category}", and the verbatim sentence or clause that states so. `
    + `Options: ${all.map((L) => `${L}) ${OPT[L]}`).join('; ')}`;
  const shape = '{"kinds":[{"name":"exact option name from the list","kind":"the stated classification","span":"verbatim sentence or clause"}],"categoryKind":{"kind":"the classification that denotes the category, or null","span":"verbatim sentence or clause, or null"}}';
  const ex = await gemmaExtract(instruction, res.text, shape, rawOut);
  if (ex === null) {
    const cause = rawOut.truncated
      ? 'the local extraction model truncated its output before finishing'
      : rawOut.failureCause
        ? `the local extraction model failed (${rawOut.failureCause}${rawOut.failureDetail ? `: ${rawOut.failureDetail}` : ''})`
        : 'the local extraction model failed for an unclassified reason';
    const result: DiscriminatorResult = {
      ok: false, category, query, kinds: [], discardedKinds: 0, noKindStated: all,
      categoryKind: null, categoryKindDiscarded: false, via: res.via,
      error: `extraction failed -- ${cause} -- reported as a FAILURE, never an empty "no kinds stated"`,
    };
    return { result, summary: summaryLine(OPT, result) };
  }
  const { kinds, discarded } = verifyDiscriminatorKinds(ex.kinds, res.text, OPT);
  const { categoryKind, discarded: categoryKindDiscarded } = verifyCategoryKind(ex.categoryKind, res.text);
  const statedLetters = new Set(kinds.map((e) => e.letter));
  const noKindStated = all.filter((L) => !statedLetters.has(L));
  const result: DiscriminatorResult = {
    ok: true, category, query, kinds, discardedKinds: discarded, noKindStated,
    categoryKind, categoryKindDiscarded, via: res.via,
  };
  return { result, summary: summaryLine(OPT, result) };
}

// ───────────────────────── registration (inert until stacked and run) ─────────────────────────

const DISCRIMINATOR_DECLARATION: StepDeclaration = {
  id: 'liana_cycle.discriminator_step.runDiscriminatorStep',
  version: '1',
  sourceFile: 'src/main/liana_cycle/library/discriminator_step.ts',
  sourceLine: 1,
  exportName: 'runDiscriminatorStep',
  exportKind: 'function',
  whatItDoes:
    'Asks ONE question -- what kind or classification each option is, and which one of those '
    + 'kinds properly denotes the category the question names -- and shows exactly what the '
    + 'source stated for each, with the verbatim sentence it said so in. Never guesses a kind for '
    + 'an option the source did not classify.',
  inputs: 'MethodQuestionInput (question, options) plus MethodRunContext (askGoogle, emit) to runDiscriminatorStep().',
  outputs: 'Promise<{ result: DiscriminatorResult, summary: string }> -- per-option stated kinds with verbatim spans, discard counts, and the stated category-denoting kind.',
  decidesOrReports: 'DECIDES_AND_REFUSES',
  queryText: {
    issuesQuery: true,
    description: 'One query per run, asking both the per-option kind and the category-denoting kind (FD-BP153-07 THE DISCRIMINATOR), hardcoded inline in this file.',
    loadedFromQueryResource: false,
  },
  attribution: {
    kind: 'ATTRIBUTED',
    founderRuling: 'BP153',
    quote:
      'THE DISCRIMINATOR. What kind is each survivor, and what kind does `<category>` denote? '
      + 'Breaks A from C and F on a STATED distinction.',
    citedAt: 'LianaBanyanPlatform/BISHOP_DROPZONE/RULINGS_BP153.md FD-BP153-07',
  },
  orphanEvidence:
    'N/A -- not an orphan. Live: registered via registerDiscriminatorStep() (this file), executed '
    + 'by script_bridge.ts\'s runOneStep() for id "Discriminator:1", the same wiring pattern '
    + 'Softballs:1, NamedSet:1, Survey:1 and StateTheQuestion:1 already use.',
};

/** Registers 'Discriminator:1'. Called from script_bridge.ts's ensureRegistryPopulated(),
 *  idempotently -- same try/catch shape as the other Composer step registrations there. */
export function registerDiscriminatorStep(): MethodIdentity {
  return registerNameNumbered('Discriminator', 1, DISCRIMINATOR_DECLARATION);
}
