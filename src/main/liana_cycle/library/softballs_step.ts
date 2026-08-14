// softballs_step.ts -- D-BP154-013/BISHOP/S13/seg-composerstep
//
// THE SOFTBALLS AS A COMPOSER STEP. Founder ruling, BP154 (THE_PAIL_BP154.md STAGE 2) and BP153
// (FD-BP153-06, FD-BP153-07): "eliminating biomes? IS THE SOFTBALLS. Easy elimination." and "we
// got rid of four answers with ONE google search."
//
// THIS IS NOT THE PIPELINE. classify_cascade.ts's establishFrame() implements the identical
// Founder's ruling already (FD-BP153-01, "the frame") but that file is FORBIDDEN to edit or
// depend on in this ticket (D-BP154-013 dispatch: "editing the classify cascade is PATCHING THE
// PIPELINE" -- the Founder stopped a prior attempt that edited establishFrame(); that work is
// parked, unrestored, at git stash@{0}). This file is a SEPARATE, SELF-CONTAINED implementation
// built for the Composer, reusing only the generic extraction primitives every cascade already
// shares (googleBlocks/gemmaExtract/appearsIn/list/toLetters, comparative_cascade.ts -- imported
// read-only, unmodified, the SAME precedent classify_cascade.ts's own header already established:
// "Nothing is extracted from comparative_cascade.ts here beyond the same already-exported,
// already-shared helpers... comparative_cascade.ts is not modified by this file"). Nothing here
// imports classify_cascade.ts at all, or comparative_cascade.ts's terminator/register-gate
// machinery -- only four pure string primitives. FD-BP153-02's own sequence still governs: prove
// the Composer end to end on qid 98, THEN strip the pipeline -- this step exists so that proof
// does not run through the very code it is meant to replace.
//
// WHAT IT DOES, EXACTLY THE FOUNDER'S OWN HAND METHOD (FD-BP153-02, verbatim): "all I really did
// was copy the question into the 5 tab browser, and ask the single multipart question, and get
// the answer and say 'ok back to Liana Cycle'." ONE query -- "Which of these are not <category>
// at all?" (FD-BP153-07 THE SOFTBALLS) -- through ctx.askGoogle (THE PAIL's own recording
// wrapper, wired by index.ts's 'liana-script-run' handler, unchanged by this file), then a single
// extraction pass that copies out only what the passage ITSELF states, verified verbatim against
// the passage before anything is trusted (HARDWIRE-22, unrelaxed; FD-BP153-07 FIX 2, "verify the
// span, not the string").
//
// EXTRACTION ONLY, NEVER JUDGMENT. No synonym table, no similarity score, no model asked whether
// two labels mean the same thing (HARDWIRE-22). ABSENCE IS OMISSION: an option the passage simply
// does not mention is never added to `excluded` -- only a name the passage explicitly and
// verifiably states is not a member of the category. Every excluded option carries the verbatim
// span it was read from; anything without one is discarded and the discard is counted, never
// silently dropped (FD-BP153-07 FIX 2). Every failure path below is NAMED in `error` -- an
// unusable read never returns `excluded: []` dressed up as "the source confirmed nothing is
// excluded" (THE_PAIL_BP154.md: "a failure is named, never returned as an empty value that reads
// like an honest 'nothing there'").
//
// NO RULE HERE MAY SELECT A PARTICULAR LETTER (FD-BP153-06). Every function below treats all nine
// option letters identically; nothing in this file's own logic branches on which letter is which.
//
// OUT OF SCOPE (this ticket's dispatch, D-BP154-013): the named set, the discriminator, ranking,
// magnitude, any verdict. This file produces ONLY the exclusion list with its spans -- nothing
// here decides a final answer letter.

import {
  appearsIn, gemmaExtract, googleBlocks, list, toLetters,
} from '../methods/comparative_cascade';
import type { MethodQuestionInput, MethodRunContext } from '../method_registry';
import { registerNameNumbered } from './method_registry';
import type { MethodIdentity } from './method_identity';
import type { StepDeclaration } from './step_declaration';

// ───────────────────── pure parts (unit-testable without a live Ollama/browser) ─────────────────────

/** Reads the category noun phrase the question itself names ("Which of the following world
 *  regions is NOT..." -> "world regions") -- the same SHAPE comparative_cascade.ts's own
 *  module-private deriveCategoryAndProperty() parses for its own superlative property, but a
 *  SEPARATE, smaller extraction (category only -- no property/magnitude parsing, which is out of
 *  this step's scope) written locally so this file depends on nothing module-private in
 *  comparative_cascade.ts. Pure text-structure parsing of the question's OWN wording, never a
 *  judgment about the world -- returns null (never a guess) when the question does not fit the
 *  "following X is/are" shape this step's one query needs to be phrased against. */
export function deriveSoftballsCategory(question: string): string | null {
  const m = question.match(/following\s+([a-z][a-z\s]*?)\s+(?:is|are)\b/i);
  const category = m ? m[1].trim() : '';
  return category || null;
}

/** THE ONE QUERY (FD-BP153-07 point 1; FD-BP153-01 consequence 4, "one query, not one per
 *  option"). */
export function buildSoftballsQuery(category: string, all: string[], OPT: Record<string, string>): string {
  return `Which of the following are NOT ${category} at all? Answer plainly and directly for `
    + `any that are not -- name it explicitly and state clearly that it is not ${category}. Do `
    + `not guess about ones you are not sure of; simply do not mention those. ${list(all, OPT)}`;
}

export interface ExcludedOption {
  letter: string;
  name: string;
  /** The verbatim span (sentence or clause) copied from the source passage, proving the source
   *  itself stated this option is not a member of the category. */
  span: string;
}

/** Whitespace-normalized verbatim containment -- same discipline as FD-BP153-07 FIX 2 ("the span
 *  must appear VERBATIM in the source passage, normalize whitespace only -- do not fuzzy
 *  match"), written locally rather than importing classify_cascade.ts's own spanIsVerbatim()
 *  (that file is FORBIDDEN to depend on in this ticket -- see this file's own header). Three
 *  lines, no fuzzy/similarity logic, the same shape as comparative_cascade.ts's own exported
 *  appearsIn(). */
function spanIsVerbatimInPassage(passage: string, span: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  const s = norm(span);
  if (!s) return false;
  return norm(passage).includes(s);
}

/** One raw `{name, span}` entry exactly as gemmaExtract()'s JSON parse may hand it back --
 *  untyped on purpose, nothing here has verified a single field of it yet. */
type RawExcludedEntry = { name?: unknown; span?: unknown };

/** THE VERIFY-THE-SPAN CHOKE POINT for this step (FD-BP153-07 FIX 2, mirrored locally -- see
 *  this file's header for why classify_cascade.ts's own extractSpannedLetters() is not
 *  imported). Accepts a raw extraction entry as an excluded option ONLY when ALL of: (a) a
 *  non-empty `name` was given, (b) a non-empty `span` was given, (c) that span is VERBATIM in
 *  `passage` (spanIsVerbatimInPassage(), above -- an unverifiable span is discarded), (d) the
 *  span itself is actually ABOUT the named option (appearsIn(span, OPT[L]) -- presence of the
 *  option's words in the PASSAGE is not enough, the SPAN itself must name it). Every failure of
 *  (b)/(c)/(d) is a DISCARD and is counted, never silently dropped. A `name` that maps to no
 *  known option letter (toLetters()'s own exact-match discipline, HARDWIRE-22: similarity is not
 *  identity) is simply not a match -- nothing here was ever a candidate value, so it is not
 *  counted as a discard either, the same convention classify_cascade.ts's own
 *  extractSpannedLetters() documents. */
export function verifyExcludedEntries(
  raw: unknown,
  passage: string,
  OPT: Record<string, string>,
): { excluded: ExcludedOption[]; discarded: number } {
  const entries = Array.isArray(raw) ? (raw as RawExcludedEntry[]) : [];
  const excluded: ExcludedOption[] = [];
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
    excluded.push({ letter: L, name: OPT[L], span });
  }
  return { excluded, discarded };
}

export interface SoftballsResult {
  ok: boolean;
  category: string | null;
  query: string | null;
  excluded: ExcludedOption[];
  discarded: number;
  /** Options the source did NOT state are excluded -- ABSENCE IS OMISSION (ticket rule): this is
   *  never reported as "confirmed members", only as "not denied by this passage". */
  notExcluded: string[];
  via: string;
  error?: string;
}

function summaryLine(OPT: Record<string, string>, r: SoftballsResult): string {
  if (!r.ok) return `SOFTBALLS: FAILED -- ${r.error}`;
  const excludedText = r.excluded.length
    ? r.excluded.map((e) => `${e.letter}) ${e.name} [source: "${e.span}"]`).join('  |  ')
    : '(none stated)';
  const notExcludedText = r.notExcluded.length
    ? r.notExcluded.map((L) => `${L}) ${OPT[L]}`).join(', ')
    : '(none)';
  const discardNote = r.discarded ? ` -- discarded ${r.discarded} candidate(s) with no verifiable span` : '';
  return `SOFTBALLS -- query: "${r.query}"  ||  EXCLUDED (source-stated, not members of ${r.category}): `
    + `${excludedText}${discardNote}  ||  NOT EXCLUDED (source silent -- omission, not confirmed membership): ${notExcludedText}`;
}

// ───────────────── the live step (googleBlocks + gemmaExtract, needs a real run to verify) ─────────────────

/**
 * Runs THE SOFTBALLS as one Composer step: one query, one extraction pass, verified spans.
 * Cannot be exercised end to end under vitest -- googleBlocks() needs the live browser authority
 * and gemmaExtract() needs a live Ollama instance, the same boundary
 * classify_cascade.frame.test.ts's own header states for establishFrame(). The pure parts above
 * (deriveSoftballsCategory, buildSoftballsQuery, verifyExcludedEntries) carry the real unit
 * tests; this function is verified by a live in-app run (this ticket's own return).
 */
export async function runSoftballsStep(
  input: MethodQuestionInput,
  ctx: MethodRunContext,
): Promise<{ result: SoftballsResult; summary: string }> {
  const OPT = input.options;
  if (!OPT || Object.keys(OPT).length === 0) {
    const result: SoftballsResult = {
      ok: false, category: null, query: null, excluded: [], discarded: 0, notExcluded: [],
      via: 'n/a',
      error: 'this question has no lettered options -- THE SOFTBALLS tests membership among options and cannot run without them',
    };
    return { result, summary: summaryLine({}, result) };
  }
  const all = Object.keys(OPT);
  const category = deriveSoftballsCategory(input.question);
  if (!category) {
    const result: SoftballsResult = {
      ok: false, category: null, query: null, excluded: [], discarded: 0, notExcluded: all,
      via: 'n/a',
      error: 'could not determine the category this question names (no "following X is/are" phrase found) -- refusing rather than guessing a category',
    };
    return { result, summary: summaryLine(OPT, result) };
  }
  const query = buildSoftballsQuery(category, all, OPT);
  const res = await googleBlocks(ctx.askGoogle, query);
  if (!res.ok || !res.text || !res.text.trim()) {
    const result: SoftballsResult = {
      ok: false, category, query, excluded: [], discarded: 0, notExcluded: all, via: res.via,
      error: `no usable answer (${res.via}) -- the frame is UNAVAILABLE, not "nothing excluded"`,
    };
    return { result, summary: summaryLine(OPT, result) };
  }
  const namesAnyOption = all.some((L) => appearsIn(res.text, OPT[L]));
  if (!namesAnyOption) {
    const result: SoftballsResult = {
      ok: false, category, query, excluded: [], discarded: 0, notExcluded: all, via: res.via,
      error: `the source's passage (${res.via}) names none of the options -- it cannot state anything about them`,
    };
    return { result, summary: summaryLine(OPT, result) };
  }
  const rawOut: {
    text?: string; truncated?: boolean; failureCause?: 'transport' | 'http-error' | 'parse-error'; failureDetail?: string;
  } = {};
  const instruction = `From the passage, list every option below that the passage explicitly and `
    + `directly states is NOT ${category}. For each one, copy the exact verbatim sentence or `
    + `clause from the passage that states it is not ${category}. Do not include an option the `
    + `passage merely does not mention -- an omission is not a statement. Only include an option `
    + `the passage directly denies membership for. Options: ${all.map((L) => `${L}) ${OPT[L]}`).join('; ')}`;
  const shape = '{"excluded":[{"name":"exact option name from the list","span":"verbatim sentence or clause from the passage stating it is not the category"}]}';
  const ex = await gemmaExtract(instruction, res.text, shape, rawOut);
  if (ex === null) {
    const cause = rawOut.truncated
      ? 'the local extraction model truncated its output before finishing'
      : rawOut.failureCause
        ? `the local extraction model failed (${rawOut.failureCause}${rawOut.failureDetail ? `: ${rawOut.failureDetail}` : ''})`
        : 'the local extraction model failed for an unclassified reason';
    const result: SoftballsResult = {
      ok: false, category, query, excluded: [], discarded: 0, notExcluded: all, via: res.via,
      error: `extraction failed -- ${cause} -- reported as a FAILURE, never an empty "nothing excluded"`,
    };
    return { result, summary: summaryLine(OPT, result) };
  }
  const { excluded, discarded } = verifyExcludedEntries(ex.excluded, res.text, OPT);
  const excludedLetters = new Set(excluded.map((e) => e.letter));
  const notExcluded = all.filter((L) => !excludedLetters.has(L));
  const result: SoftballsResult = {
    ok: true, category, query, excluded, discarded, notExcluded, via: res.via,
  };
  return { result, summary: summaryLine(OPT, result) };
}

// ───────────────────────── registration (inert until stacked and run) ─────────────────────────

const SOFTBALLS_DECLARATION: StepDeclaration = {
  id: 'liana_cycle.softballs_step.runSoftballsStep',
  version: '1',
  sourceFile: 'src/main/liana_cycle/library/softballs_step.ts',
  sourceLine: 1,
  exportName: 'runSoftballsStep',
  exportKind: 'function',
  whatItDoes:
    'Asks ONE question -- which of the answer options are NOT members of the category the '
    + 'question names -- and shows exactly which options the source explicitly said are not '
    + 'members, each with the verbatim sentence it said so in. Never excludes an option the '
    + 'source simply did not mention.',
  inputs: 'MethodQuestionInput (question, options) plus MethodRunContext (askGoogle, emit) to runSoftballsStep().',
  outputs: 'Promise<{ result: SoftballsResult, summary: string }> -- excluded options with verbatim spans, discard count, and the options the source left unaddressed.',
  decidesOrReports: 'DECIDES_AND_REFUSES',
  queryText: {
    issuesQuery: true,
    description: 'One query per run: "Which of the following are NOT <category> at all?" (FD-BP153-07 THE SOFTBALLS), hardcoded inline in this file.',
    loadedFromQueryResource: false,
  },
  attribution: {
    kind: 'ATTRIBUTED',
    founderRuling: 'BP153/BP154',
    quote:
      'eliminating biomes? IS THE SOFTBALLS. Easy elimination... we got rid of four answers with '
      + 'ONE google search.',
    citedAt: 'LianaBanyanPlatform/BISHOP_DROPZONE/RULINGS_BP153.md FD-BP153-06/FD-BP153-07',
  },
  orphanEvidence:
    'N/A -- not an orphan. Live: registered via registerSoftballsStep() (this file), executed by '
    + 'script_bridge.ts\'s runOneStep() for id "Softballs:1", the same wiring pattern '
    + 'StateTheQuestion:1 and Survey:1 already use.',
};

/** Registers 'Softballs:1'. Called from script_bridge.ts's ensureRegistryPopulated(),
 *  idempotently -- same try/catch shape as registerStateTheQuestionStep()/registerSurveyParts()
 *  there. */
export function registerSoftballsStep(): MethodIdentity {
  return registerNameNumbered('Softballs', 1, SOFTBALLS_DECLARATION);
}
