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
  appearsIn, gemmaExtract, list, toLetters,
} from '../methods/comparative_cascade';
import type { MethodQuestionInput, MethodRunContext } from '../method_registry';
import { registerNameNumbered } from './method_registry';
import type { MethodIdentity } from './method_identity';
import type { StepDeclaration } from './step_declaration';
// D-BP154-014/BISHOP/S14/seg-milkthem -- FD-BP154-02 ("use gemini to answer, google to
// corroborate") + FD-BP153-04 ("consult what you already own before you spend a query") +
// FD-BP154-03 (mechanism provenance). See composer_step_evidence.ts's own header for the full
// ruling this shared module implements; softballs_step.ts, named_set_step.ts and
// discriminator_step.ts all use it identically rather than each re-deriving the same ordering.
import {
  corroborateClaim, gatherMortgageCandidates, gatherThisRunCandidates,
  spanIsVerbatimInPassage, summarizeCorroboration, tryConversationalAuthority,
} from './composer_step_evidence';
import type { ClaimProvenance, CorroborationResult } from './composer_step_evidence';

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

/** THE ONE CORROBORATION QUERY (FD-BP154-02): re-asks whether the category is properly denoted by
 *  the single stated category-denoting kind. Preferred corroboration target when the passage
 *  stated one (this is THE decisive discriminator fact -- what breaks the winning option from the
 *  others). */
export function buildDiscriminatorCategoryKindCorroborationQuery(category: string, ck: CategoryKind): string {
  return `Does "${category}" denote ${ck.kind}? Answer plainly and directly, stating clearly `
    + `whether it does or does not.`;
}

/** Fallback corroboration target when no category-denoting kind was stated but at least one
 *  per-option kind was: corroborates the first verified per-option kind instead. */
export function buildDiscriminatorKindCorroborationQuery(entry: DiscriminatorEntry): string {
  return `Is ${entry.name} ${entry.kind}? Answer plainly and directly, stating clearly whether it `
    + `is or is not ${entry.kind}.`;
}

// spanIsVerbatimInPassage() is now imported from composer_step_evidence.ts (D-BP154-014) --
// identical logic, shared rather than a third local copy; see that file's own header.

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
  /** D-BP154-014, FD-BP154-03: HOW the passage this extraction ran over was obtained. */
  answerProvenance?: ClaimProvenance;
  /** D-BP154-014, FD-BP154-02: ONE Google corroboration attempt against the single decisive
   *  claim (the category-denoting kind, or -- when none was stated -- the first per-option kind).
   *  Additive, never a gate. */
  corroboration?: CorroborationResult;
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
  const provenanceNote = r.answerProvenance ? `  ||  ANSWERED VIA ${r.answerProvenance.mechanism}: ${r.answerProvenance.detail}` : '';
  const corrobNote = r.corroboration ? `  ||  ${summarizeCorroboration(r.corroboration)}` : '';
  return `DISCRIMINATOR -- query: "${r.query}"  ||  KINDS (source-stated, verified): ${kindsText}`
    + `${discardNote}  ||  NO KIND STATED (source silent -- omission, not "no kind"): ${noKindText}`
    + `  ||  WHICH KIND DENOTES "${r.category}": ${categoryKindText}${provenanceNote}${corrobNote}`;
}

// ───────────────── the live step (owned evidence -> conversational -> corroboration; needs a real run to verify) ─────────────────

/**
 * Runs THE DISCRIMINATOR as one Composer step: owned evidence tried first (zero new queries),
 * then the conversational authority (Gemini) answers the one Discriminator question -- what kind
 * each option is, AND which stated kind denotes the category -- (FD-BP154-02), then -- when there
 * is a decisive claim -- ONE Google corroboration pass names a third-party document that
 * independently states the same thing. Every value produced carries its mechanism (FD-BP154-03).
 * Cannot be exercised end to end under vitest -- same boundary softballs_step.ts's/
 * named_set_step.ts's own headers state. The pure parts above carry the real unit tests; this
 * function is verified by a live in-app run (this ticket's own return).
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
  const namesAnyOption = (t: string) => all.some((L) => appearsIn(t, OPT[L]));
  // D-BP154-014, ADDITIVE: see softballs_step.ts's identical comment / tryConversationalAuthority().
  const mcOptions = all.map((L) => `${L}) ${OPT[L]}`);

  // STAGE 1: OWNED EVIDENCE FIRST.
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

  // STAGE 2: GEMINI ANSWERS (FD-BP154-02).
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
    const result: DiscriminatorResult = {
      ok: false, category, query, kinds: [], discardedKinds: 0, noKindStated: all,
      categoryKind: null, categoryKindDiscarded: false, via: 'n/a',
      error: `no usable answer from any authority -- owned evidence: ${ownedCandidates.length} candidate(s) tried, none usable; `
        + `conversational authority: ${conversationalError ?? 'not tried'} -- THE DISCRIMINATOR is UNAVAILABLE, not "no kinds stated"`,
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
  const ex = await gemmaExtract(instruction, text, shape, rawOut);
  if (ex === null) {
    const cause = rawOut.truncated
      ? 'the local extraction model truncated its output before finishing'
      : rawOut.failureCause
        ? `the local extraction model failed (${rawOut.failureCause}${rawOut.failureDetail ? `: ${rawOut.failureDetail}` : ''})`
        : 'the local extraction model failed for an unclassified reason';
    const result: DiscriminatorResult = {
      ok: false, category, query, kinds: [], discardedKinds: 0, noKindStated: all,
      categoryKind: null, categoryKindDiscarded: false, via,
      error: `extraction failed -- ${cause} -- reported as a FAILURE, never an empty "no kinds stated"`,
    };
    return { result, summary: summaryLine(OPT, result) };
  }
  const { kinds, discarded } = verifyDiscriminatorKinds(ex.kinds, text, OPT);
  const { categoryKind, discarded: categoryKindDiscarded } = verifyCategoryKind(ex.categoryKind, text);
  const statedLetters = new Set(kinds.map((e) => e.letter));
  const noKindStated = all.filter((L) => !statedLetters.has(L));

  // STAGE 3: GOOGLE CORROBORATES A NAMED CLAIM -- ONE query, for the single decisive claim only.
  // Prefers the category-denoting kind (the decisive discriminator fact); falls back to the first
  // per-option kind when no category-denoting kind was stated.
  let corroboration: CorroborationResult | undefined;
  if (categoryKind) {
    corroboration = await corroborateClaim(
      ctx, buildDiscriminatorCategoryKindCorroborationQuery(category, categoryKind), categoryKind.kind,
    );
  } else if (kinds.length) {
    corroboration = await corroborateClaim(
      ctx, buildDiscriminatorKindCorroborationQuery(kinds[0]), kinds[0].name,
    );
  }

  const result: DiscriminatorResult = {
    ok: true, category, query, kinds, discardedKinds: discarded, noKindStated,
    categoryKind, categoryKindDiscarded, via, answerProvenance: provenance, corroboration,
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
    + 'kinds properly denotes the category the question names -- tried against owned evidence '
    + 'first, then the conversational authority (Gemini), which answers it (FD-BP154-02); shows '
    + 'exactly what the source stated for each, with the verbatim sentence it said so in, plus ONE '
    + 'Google corroboration naming a third-party document for the decisive claim. Never guesses a '
    + 'kind for an option the source did not classify.',
  inputs: 'MethodQuestionInput (question, options, qid) plus MethodRunContext (askGoogle, askConversationalAuthority, ownedPassages, emit) to runDiscriminatorStep().',
  outputs: 'Promise<{ result: DiscriminatorResult, summary: string }> -- per-option stated kinds with verbatim spans, discard counts, the stated category-denoting kind, the answer mechanism, and a document corroboration attempt.',
  decidesOrReports: 'DECIDES_AND_REFUSES',
  queryText: {
    issuesQuery: true,
    description: 'One primary question per run -- owned evidence tried first, then both the per-option kind and the category-denoting kind (FD-BP153-07 THE DISCRIMINATOR, FD-BP154-02) put to the conversational authority -- plus at most one Google corroboration query for a single decisive claim, hardcoded inline in this file.',
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
