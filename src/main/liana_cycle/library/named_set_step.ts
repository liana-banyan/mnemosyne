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

/** THE ONE CORROBORATION QUERY (FD-BP154-02): re-asks, about a SINGLE already-included option,
 *  whether it is the property -- never re-issued per option, only for the one decisive claim the
 *  caller selects (runNamedSetStep() below picks the first verified included entry). */
export function buildNamedSetCorroborationQuery(property: string, entry: IncludedOption): string {
  return `Is ${entry.name} ${property}? Answer plainly and directly, stating clearly whether it `
    + `is or is not ${property}.`;
}

// spanIsVerbatimInPassage() is now imported from composer_step_evidence.ts (D-BP154-014) --
// identical logic, shared rather than a third local copy; see that file's own header.

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
  /** D-BP154-014, FD-BP154-03: HOW the passage this extraction ran over was obtained. */
  answerProvenance?: ClaimProvenance;
  /** D-BP154-014, FD-BP154-02: ONE Google corroboration attempt against the first verified
   *  included entry, when there is one. Additive, never a gate. */
  corroboration?: CorroborationResult;
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
  const provenanceNote = r.answerProvenance ? `  ||  ANSWERED VIA ${r.answerProvenance.mechanism}: ${r.answerProvenance.detail}` : '';
  const corrobNote = r.corroboration ? `  ||  ${summarizeCorroboration(r.corroboration)}` : '';
  return `NAMED SET -- query: "${r.query}"  ||  INCLUDED (source-stated members of ${r.property}): `
    + `${includedText}${discardNote}  ||  NOT INCLUDED (source silent -- omission, not confirmed non-membership): ${notIncludedText}`
    + `${provenanceNote}${corrobNote}`;
}

// ───────────────── the live step (owned evidence -> conversational -> corroboration; needs a real run to verify) ─────────────────

/**
 * Runs THE NAMED SET as one Composer step: owned evidence tried first (zero new queries), then
 * the conversational authority (Gemini) answers the one Named Set query (FD-BP154-02), then --
 * when there is a verified included claim -- ONE Google corroboration pass names a third-party
 * document that independently states the same thing. Every value produced carries its mechanism
 * (FD-BP154-03). Cannot be exercised end to end under vitest -- the live authorities need a live
 * browser/Ollama, the same boundary softballs_step.ts's own header states. The pure parts above
 * (deriveNamedSetProperty, buildNamedSetQuery, buildNamedSetCorroborationQuery,
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
  // Rebound to a fresh, definitely-non-null const: TS's control-flow narrowing of the early-return
  // check above does not propagate into the nested `extractFrom` function declaration below (a
  // known TS closure-narrowing limitation for function declarations, not this file's own logic).
  const optSafe: Record<string, string> = OPT;
  const all = Object.keys(optSafe);
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
  const namesAnyOption = (t: string) => all.some((L) => appearsIn(t, OPT[L]));
  // D-BP154-014, ADDITIVE: see softballs_step.ts's identical comment / tryConversationalAuthority().
  const mcOptions = all.map((L) => `${L}) ${OPT[L]}`);

  // D-BP154-018/BISHOP-SEG/S18/seg-terminator -- TRY-HARDER-BEFORE-ABSTAIN. MEASURED live, qid 98,
  // this ticket: STAGE 1 (owned evidence / THE MORTGAGE) reused a real prior Google acquisition
  // that merely NAMED an option (`namesAnyOption` only checks the option's own words appear
  // somewhere in the passage) without ever verifying the passage actually STATED membership --
  // extraction from it then correctly found zero verified inclusions, and the pre-this-ticket code
  // stopped there (STAGE 2 only ran `if (!text)`, and `text` was already set by STAGE 1's weaker
  // bar). The real prior passage DID contain a usable fact ("South Asia is the most densely
  // populated region in the world", Quizlet, inside a noisy multi-snippet Google blob) that this
  // extraction pass could not cleanly pull a verbatim span from -- a genuinely different failure
  // from "no source exists". This helper runs extraction+verification against ONE candidate text
  // and reports whether it actually produced a verified claim, so the caller below can try a
  // SECOND source when the first, despite being found, produced nothing -- never widening what
  // counts as a match (verifyIncludedEntries()'s own four-part span discipline is untouched), only
  // trying a second independent source before concluding the step has nothing. This is a
  // structural retry, not a letter preference (FD-BP153-06): it runs identically regardless of
  // which options are in play, and a second source that ALSO yields nothing still abstains
  // honestly, naming both attempts. */
  async function extractFrom(candidateText: string): Promise<{
    included: IncludedOption[]; discarded: number;
    extractionError?: string;
  }> {
    const rawOut: {
      text?: string; truncated?: boolean; failureCause?: 'transport' | 'http-error' | 'parse-error'; failureDetail?: string;
    } = {};
    const instruction = `From the passage, list every option below that the passage explicitly and `
      + `directly states IS ${property}. For each one, copy the exact verbatim sentence or clause `
      + `from the passage that states it is ${property}. Do not include an option the passage `
      + `merely does not mention -- an omission is not a statement. Only include an option the `
      + `passage directly affirms membership for. Options: ${all.map((L) => `${L}) ${optSafe[L]}`).join('; ')}`;
    const shape = '{"included":[{"name":"exact option name from the list","span":"verbatim sentence or clause from the passage stating it is the property"}]}';
    const ex = await gemmaExtract(instruction, candidateText, shape, rawOut);
    if (ex === null) {
      const cause = rawOut.truncated
        ? 'the local extraction model truncated its output before finishing'
        : rawOut.failureCause
          ? `the local extraction model failed (${rawOut.failureCause}${rawOut.failureDetail ? `: ${rawOut.failureDetail}` : ''})`
          : 'the local extraction model failed for an unclassified reason';
      return { included: [], discarded: 0, extractionError: cause };
    }
    const { included, discarded } = verifyIncludedEntries(ex.included, candidateText, optSafe);
    return { included, discarded };
  }

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

  let extraction = text ? await extractFrom(text) : null;
  let extractionFailedOnStage1Text = Boolean(extraction?.extractionError);

  // STAGE 2: GEMINI ANSWERS (FD-BP154-02) -- tried when STAGE 1 found nothing at all, OR (D-
  // BP154-018) when STAGE 1 found a passage but it verifiably established zero memberships and
  // extraction itself did not fail (a genuine "tried and got zero" is still worth a second,
  // independent source before the step abstains).
  let conversationalError: string | undefined;
  const stage1WasUnproductive = !text || (extraction !== null && extraction.included.length === 0 && !extractionFailedOnStage1Text);
  if (stage1WasUnproductive) {
    const cr = await tryConversationalAuthority(ctx, query, mcOptions);
    if (cr.ok && namesAnyOption(cr.text)) {
      const cExtraction = await extractFrom(cr.text);
      // Prefer STAGE 2 only when it actually found something STAGE 1 did not -- STAGE 1's own
      // (possibly empty) result is never discarded in favour of an equally-empty STAGE 2 result;
      // "tried harder, still nothing" stays an honest zero, not silently swapped for a different
      // empty source.
      if (cExtraction.included.length > 0 || !text) {
        text = cr.text; via = cr.via; provenance = cr.provenance; extraction = cExtraction;
        extractionFailedOnStage1Text = false;
      }
    } else {
      conversationalError = cr.error ?? 'conversational authority answered but named none of the options';
    }
  }

  if (!text) {
    const result: NamedSetResult = {
      ok: false, property, query, included: [], discarded: 0, notIncluded: all,
      via: 'n/a',
      error: `no usable answer from any authority -- owned evidence: ${ownedCandidates.length} candidate(s) tried, none usable; `
        + `conversational authority: ${conversationalError ?? 'not tried'} -- THE NAMED SET is UNAVAILABLE, not "nothing included"`,
    };
    return { result, summary: summaryLine(OPT, result) };
  }
  if (!extraction || extractionFailedOnStage1Text) {
    const result: NamedSetResult = {
      ok: false, property, query, included: [], discarded: 0, notIncluded: all, via,
      error: `extraction failed -- ${extraction?.extractionError ?? 'the local extraction model failed for an unclassified reason'} -- reported as a FAILURE, never an empty "nothing included"`,
    };
    return { result, summary: summaryLine(OPT, result) };
  }
  // D-BP154-021/BISHOP-SEG/S21/seg-mortgagetrap FIX -- THE MORTGAGE trap. Restores THIS FILE'S OWN
  // ALREADY-STATED intent (its own header, above: "never a silent empty result standing in for
  // 'the source confirmed nothing qualifies'") which the code below it did not actually enforce --
  // a passage that produced NO usable value after BOTH Stage 1 (owned evidence) AND Stage 2 (a
  // fresh live query, tried above whenever Stage 1 was unproductive) is credited as "answered" is
  // exactly the false credit found elsewhere this session (classify_cascade.ts's own transcript
  // line "answered FROM OWNED EVIDENCE ... FRAME UNAVAILABLE" in the SAME sentence -- read only for
  // the pattern, that file stays FORBIDDEN). LIVE-MEASURED this ticket (qid 98, two consecutive
  // runs): the SAME ~3-hour-old owned Google-search passage never once yielded a usable membership
  // ("discarded 1 candidate(s) with no verifiable span" both times), yet was reported ok:true,
  // "ANSWERED VIA OWNED_EVIDENCE" -- the exact trap. Keyed on UNPRODUCTIVE (a fact this function
  // already observes -- `included.length === 0`), never on the passage's AGE (a staleness cutoff/
  // TTL is a Founder ruling, not authorized here). A genuinely zero-member finding is, in THIS
  // codebase's own design (every sibling step's header says the same), never distinguishable from
  // "nothing usable was found" -- HARDWIRE-22's own absence-is-omission law applies here exactly as
  // it already does to every per-option inclusion decision above.
  if (extraction.included.length === 0) {
    const result: NamedSetResult = {
      ok: false, property, query, included: [], discarded: extraction.discarded, notIncluded: all, via,
      error: `no usable answer from any authority -- the credited passage (${via}) produced zero verified `
        + `memberships (${extraction.discarded} candidate(s) discarded for no verifiable span) -- `
        + `THE NAMED SET is UNAVAILABLE, not "nothing included"`,
    };
    return { result, summary: summaryLine(OPT, result) };
  }
  const { included, discarded } = extraction;
  const includedLetters = new Set(included.map((e) => e.letter));
  const notIncluded = all.filter((L) => !includedLetters.has(L));

  // STAGE 3: GOOGLE CORROBORATES A NAMED CLAIM -- ONE query, for the single decisive claim only.
  let corroboration: CorroborationResult | undefined;
  if (included.length) {
    corroboration = await corroborateClaim(ctx, buildNamedSetCorroborationQuery(property, included[0]), included[0].name);
  }

  const result: NamedSetResult = {
    ok: true, property, query, included, discarded, notIncluded, via, answerProvenance: provenance, corroboration,
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
    + 'question names (e.g. "the world\'s most densely populated regions") -- tried against owned '
    + 'evidence first, then the conversational authority (Gemini), which answers it (FD-BP154-02); '
    + 'shows exactly which options the source explicitly said qualify, each with the verbatim '
    + 'sentence it said so in, plus ONE Google corroboration naming a third-party document for the '
    + 'decisive claim. Never includes an option the source simply did not mention.',
  inputs: 'MethodQuestionInput (question, options, qid) plus MethodRunContext (askGoogle, askConversationalAuthority, ownedPassages, emit) to runNamedSetStep().',
  outputs: 'Promise<{ result: NamedSetResult, summary: string }> -- included options with verbatim spans, discard count, the options the source left unaddressed, the answer mechanism, and a document corroboration attempt.',
  decidesOrReports: 'DECIDES_AND_REFUSES',
  queryText: {
    issuesQuery: true,
    description: 'One primary question per run -- owned evidence tried first, then "Which of the following ARE <property>?" put to the conversational authority (FD-BP153-07 THE NAMED SET, FD-BP154-02) -- plus at most one Google corroboration query for a single decisive claim, hardcoded inline in this file.',
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
