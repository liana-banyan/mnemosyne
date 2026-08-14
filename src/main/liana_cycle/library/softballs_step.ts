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

/** THE ONE CORROBORATION QUERY (FD-BP154-02): re-asks, about a SINGLE already-excluded option,
 *  whether it is the category -- never re-issued per option, only for the one decisive claim the
 *  caller selects (runSoftballsStep() below picks the first verified excluded entry). Distinct
 *  text from buildSoftballsQuery() -- this is a corroboration of ONE claim, not a repeat of the
 *  membership sweep. */
export function buildSoftballsCorroborationQuery(category: string, entry: ExcludedOption): string {
  return `Is ${entry.name} ${category}? Answer plainly and directly, stating clearly whether it `
    + `is or is not ${category}.`;
}

// spanIsVerbatimInPassage() is now imported from composer_step_evidence.ts (D-BP154-014) --
// identical logic, shared rather than a third local copy; see that file's own header.

/** One raw `{name, span}` entry exactly as gemmaExtract()'s JSON parse may hand it back --
 *  untyped on purpose, nothing here has verified a single field of it yet. */
type RawExcludedEntry = { name?: unknown; span?: unknown };

/** D-BP154-015, ADDITIVE: gemma4:12b's `name` field for an excluded entry sometimes carries the
 *  passage's OWN "L) text" formatting (list()/buildSoftballsQuery() already prefix every option
 *  with its letter before the passage is ever built, and the passage this step reads restates
 *  that same "D) Northeast United States is..." shape) -- MEASURED live, qid 98 Softballs, this
 *  ticket: gemmaExtract() returned `{"name":"D) Northeast United States","span":"D) Northeast
 *  United States is a subnational region..."}`x4, extraction and span both CORRECT, but
 *  toLetters()'s exact-match discipline (HARDWIRE-22, "similarity is not identity") correctly
 *  refused norm("D) Northeast United States") = "d northeast united states" against
 *  norm(OPT.D) = "northeast united states" -- not the same string, so all four verified,
 *  correctly-spanned extractions fell out silently as "names no known option". This strips ONLY
 *  a leading "<single letter>) " token before the match is attempted a second time -- undoing
 *  formatting the PASSAGE (built by this file's own list()-derived buildSoftballsQuery()) put
 *  there, not inventing a new equivalence. The match itself is still exact string identity on
 *  the option's bare text; no letter is special-cased (FD-BP153-06) -- the pattern is generic
 *  over every letter A-Z, and a name that does not carry the prefix is tried unchanged, same as
 *  before this ticket. */
function stripListLetterPrefix(name: string): string {
  return name.replace(/^[A-Za-z]\)\s*/, '');
}

/** THE VERIFY-THE-SPAN CHOKE POINT for this step (FD-BP153-07 FIX 2, mirrored locally -- see
 *  this file's header for why classify_cascade.ts's own extractSpannedLetters() is not
 *  imported). Accepts a raw extraction entry as an excluded option ONLY when ALL of: (a) a
 *  non-empty `name` was given, (b) a non-empty `span` was given, (c) that span is VERBATIM in
 *  `passage` (spanIsVerbatimInPassage(), above -- an unverifiable span is discarded), (d) the
 *  span itself is actually ABOUT the named option (appearsIn(span, OPT[L]) -- presence of the
 *  option's words in the PASSAGE is not enough, the SPAN itself must name it). Every failure of
 *  (b)/(c)/(d) is a DISCARD and is counted, never silently dropped. A `name` that maps to no
 *  known option letter, even after stripListLetterPrefix() (D-BP154-015) is tried
 *  (toLetters()'s own exact-match discipline, HARDWIRE-22: similarity is not identity) is simply
 *  not a match -- nothing here was ever a candidate value, so it is not counted as a discard
 *  either, the same convention classify_cascade.ts's own extractSpannedLetters() documents. */
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
    let matched = toLetters([name], OPT);
    if (matched.length === 0) {
      // D-BP154-015: try again with a leading "L) " token (the passage's own list() formatting,
      // which the model sometimes echoes back into `name`) stripped off.
      const stripped = stripListLetterPrefix(name);
      if (stripped !== name) matched = toLetters([stripped], OPT);
    }
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
  /** D-BP154-014, FD-BP154-03: HOW the passage this extraction ran over was obtained -- one of the
   *  four mechanism classes, with a structural sourceId a later stage can use to detect two claims
   *  sharing one derivation path. Present whenever ok:true (a passage was in hand); absent on a
   *  failure (nothing was obtained to have a mechanism at all). */
  answerProvenance?: ClaimProvenance;
  /** D-BP154-014, FD-BP154-02: ONE Google corroboration attempt against the first verified
   *  excluded entry, when there is one. Additive evidence, never a gate -- ok:true stands whether
   *  or not corroboration succeeded; a failed corroboration is reported, never silently dropped. */
  corroboration?: CorroborationResult;
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
  const provenanceNote = r.answerProvenance ? `  ||  ANSWERED VIA ${r.answerProvenance.mechanism}: ${r.answerProvenance.detail}` : '';
  const corrobNote = r.corroboration ? `  ||  ${summarizeCorroboration(r.corroboration)}` : '';
  return `SOFTBALLS -- query: "${r.query}"  ||  EXCLUDED (source-stated, not members of ${r.category}): `
    + `${excludedText}${discardNote}  ||  NOT EXCLUDED (source silent -- omission, not confirmed membership): ${notExcludedText}`
    + `${provenanceNote}${corrobNote}`;
}

// ───────────────── the live step (owned evidence -> conversational -> corroboration; needs a real run to verify) ─────────────────

/**
 * Runs THE SOFTBALLS as one Composer step: owned evidence tried first (zero new queries), then
 * the conversational authority (Gemini) answers the one Softballs query (FD-BP154-02), then --
 * when there is a verified excluded claim -- ONE Google corroboration pass names a third-party
 * document that independently states the same thing (FD-BP154-02 correction: "what corroborates
 * is the DOCUMENT, not Google"). Every value produced carries its mechanism (FD-BP154-03). Cannot
 * be exercised end to end under vitest -- the live authorities need a live browser/Ollama, the
 * same boundary classify_cascade.frame.test.ts's own header states for establishFrame(). The pure
 * parts above (deriveSoftballsCategory, buildSoftballsQuery, buildSoftballsCorroborationQuery,
 * verifyExcludedEntries) carry the real unit tests; this function is verified by a live in-app
 * run (this ticket's own return).
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
  const namesAnyOption = (t: string) => all.some((L) => appearsIn(t, OPT[L]));
  // D-BP154-014, ADDITIVE: "L) option text" shape, same as comparative_cascade.ts's own list() /
  // browser_authority_types.ts's buildMcAwareQueryText -- lets webview_preload.ts's capture-hop
  // gate (mentionsAnyOption) reject a Gemini UI-chrome capture before it ever reaches this step's
  // own namesAnyOption check. See tryConversationalAuthority()'s own doc comment.
  const mcOptions = all.map((L) => `${L}) ${OPT[L]}`);

  // STAGE 1: OWNED EVIDENCE FIRST (FD-BP153-04/FD-BP153-03, "the mortgage") -- zero new queries
  // when it answers: THE MORTGAGE (this exact query text, any prior acquisition) then THIS RUN'S
  // own already-acquired, non-ambiguity passages. The first candidate that actually NAMES one of
  // this question's options is accepted; one that never mentions any option is not usable
  // evidence for THIS question and is skipped, not force-fit.
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

  // STAGE 2: GEMINI ANSWERS (FD-BP154-02) -- the same query text, no judgment prompt.
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
    const result: SoftballsResult = {
      ok: false, category, query, excluded: [], discarded: 0, notExcluded: all,
      via: 'n/a',
      error: `no usable answer from any authority -- owned evidence: ${ownedCandidates.length} candidate(s) tried, none usable; `
        + `conversational authority: ${conversationalError ?? 'not tried'} -- the frame is UNAVAILABLE, not "nothing excluded"`,
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
  const ex = await gemmaExtract(instruction, text, shape, rawOut);
  if (ex === null) {
    const cause = rawOut.truncated
      ? 'the local extraction model truncated its output before finishing'
      : rawOut.failureCause
        ? `the local extraction model failed (${rawOut.failureCause}${rawOut.failureDetail ? `: ${rawOut.failureDetail}` : ''})`
        : 'the local extraction model failed for an unclassified reason';
    const result: SoftballsResult = {
      ok: false, category, query, excluded: [], discarded: 0, notExcluded: all, via,
      error: `extraction failed -- ${cause} -- reported as a FAILURE, never an empty "nothing excluded"`,
    };
    return { result, summary: summaryLine(OPT, result) };
  }
  const { excluded, discarded } = verifyExcludedEntries(ex.excluded, text, OPT);
  const excludedLetters = new Set(excluded.map((e) => e.letter));
  const notExcluded = all.filter((L) => !excludedLetters.has(L));

  // STAGE 3: GOOGLE CORROBORATES A NAMED CLAIM (FD-BP154-02) -- ONE corroboration query, only for
  // the single decisive claim (the first verified excluded entry), only when there is one.
  // Additive: does not gate ok:true, and a failed corroboration is reported, not hidden.
  let corroboration: CorroborationResult | undefined;
  if (excluded.length) {
    corroboration = await corroborateClaim(ctx, buildSoftballsCorroborationQuery(category, excluded[0]), excluded[0].name);
  }

  const result: SoftballsResult = {
    ok: true, category, query, excluded, discarded, notExcluded, via, answerProvenance: provenance, corroboration,
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
    + 'question names -- tried against owned evidence first, then the conversational authority '
    + '(Gemini), which answers it (FD-BP154-02); shows exactly which options the source '
    + 'explicitly said are not members, each with the verbatim sentence it said so in, plus ONE '
    + 'Google corroboration naming a third-party document for the decisive claim. Never excludes '
    + 'an option the source simply did not mention.',
  inputs: 'MethodQuestionInput (question, options, qid) plus MethodRunContext (askGoogle, askConversationalAuthority, ownedPassages, emit) to runSoftballsStep().',
  outputs: 'Promise<{ result: SoftballsResult, summary: string }> -- excluded options with verbatim spans, discard count, the options the source left unaddressed, the answer mechanism, and a document corroboration attempt.',
  decidesOrReports: 'DECIDES_AND_REFUSES',
  queryText: {
    issuesQuery: true,
    description: 'One primary question per run -- owned evidence tried first, then "Which of the following are NOT <category> at all?" put to the conversational authority (FD-BP153-07 THE SOFTBALLS, FD-BP154-02) -- plus at most one Google corroboration query for a single decisive claim, hardcoded inline in this file.',
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
