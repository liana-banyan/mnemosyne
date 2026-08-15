// semiotic_square_step.ts -- D-BP155-004/BISHOP-SEG/S4/seg-semiotic-square, RE-DISPATCH OF
// D-BP154-069.
//
// Founder, BP154, verbatim: "yes, I like Greimas, keep it, and use the semiotic square (build it)
// and apply to 85." D-BP154-069 named this build, queued third behind D-BP154-068 (the meaning
// matrix / hex connector). D-BP154-068 was abandoned -- its own subject (the meaning matrix, the
// hex connector) does not exist anywhere in THIS repo; the only hits for either term on disk are
// tagged BP021/BP148, a materially different, earlier substrate (librarian-mcp), not this estate's
// Composer. 069's blocker was therefore REFUTED, not ruled -- it has no conceptual dependency on
// 068, and P12 (borromean_test.ts, D-BP154-072) already established the precedent of building past
// a refuted-not-ruled predecessor in this exact chain. BP155 verified before writing a line of
// code: no `*semiotic*` or `*greimas*` file exists anywhere in `mnemosyne`, tracked or untracked,
// and no commit between `0d3f7bce` and HEAD builds it.
//
// WAS "SemioticSquare" ALREADY SPECCED? NO -- checked directly against both BP154 principles files
// before writing anything, per this dispatch's own instruction to quote their words rather than
// assume. `PRINCIPLES_LIBRARY_BP154.md` section 1.3 specs "The semiotic triangle and its inverse"
// (a TRIANGLE, already built as "Principle 11" -- referent resolution, "never compare two symbols
// directly, resolve each to its referent by a stated part, then compare referents") -- a different
// shape from a Greimas SQUARE (S1/S2/not-S1/not-S2 with contrary/contradiction/implication
// relations) and already active under a different name. Section 4's own qid-85 entry names the
// PRIMARY tool as "genus and differentia" (1.1), with the semiotic triangle's FORWARD direction and
// the use-mention distinction (1.6) as secondary tools -- it does not name a semiotic SQUARE for
// qid 85 anywhere. `PRINCIPLES_ADDENDUM_BP154_FOUR.md`'s own four Founder-named additions (P12
// Borromean, P13 Descartes' Square, P14 Rumsfeld Matrix, P15 Gordian Knot) likewise do not include
// a semiotic square under any name. Conclusion, stated plainly per the dispatch's own instruction:
// SemioticSquare was NOT specced in either BP154 principles file. This file is built to the
// Founder's own direct words this dispatch quotes ("use the semiotic square (build it)"), informed
// by -- but not identical to -- the closest owned/specced material (genus/differentia 1.1, the
// semiotic triangle 1.3, the use-mention distinction 1.6), because none of those IS a semiotic
// square and the Founder asked for that specific classical tool by name.
//
// THE MECHANICAL FORM OF A GREIMAS SEMIOTIC SQUARE, HARDWIRE-22-LEGAL (extraction only, never
// judgment -- the same bar every entry in PRINCIPLES_LIBRARY_BP154.md is held to). Four positions
// over one binary opposition: S1, S2 (contraries -- cannot both hold), not-S1, not-S2
// (contradictories of S1/S2 respectively). This file builds the axis MECHANICALLY, never inventing
// an opposition by hand for qid 85 specifically:
//   1. THE AXIS IS MINED FROM THE OPTIONS' OWN STATED TEXT, not chosen by this file. Every option's
//      own wording is scanned (pure text-structure parsing, no live query, no similarity score) for
//      a content-word STEM that recurs across multiple options in BOTH an AFFIRMED form and a
//      NEGATED form (a small, named list of negation markers: "not", "no", "never", "without",
//      "lack of" -- structural detection, never a synonym table). A stem attested on only one side
//      is not an opposition and is never promoted into one. Among every genuinely two-sided stem
//      found, the one with the largest combined attestation wins, ties broken alphabetically by
//      stem -- fully deterministic, no judgment.
//   2. WHICH POLE IS S1 is then put to the source -- owned evidence first, then the conversational
//      authority (FD-BP154-02), exactly the same "owned -> Gemini -> Google corroborates" order and
//      shared plumbing (composer_step_evidence.ts) as Discriminator:1/NamedSet:1 -- never guessed
//      by this file, never inferred from which pole "sounds more likely."
//   3. THE SQUARE'S OWN FIXED RELATIONS, computed, not asserted: the pole the source did NOT confirm
//      is S2, the CONTRARY -- and by the square's CONTRADICTION relation, every option whose own
//      stated text occupies S2 is eliminated (an option cannot state the confirmed pole's opposite
//      and also be consistent with it). Options attesting neither pole for the winning stem are
//      UNSTATED -- never placed in either bucket, never eliminated (absence is omission, the same
//      discipline every sibling step in this file's own idiom already holds to; Descartes' Square,
//      PRINCIPLES_ADDENDUM_BP154_FOUR.md P13: "UNSTATED must remain a legal entry in every
//      quadrant").
//
// WHAT THIS GENERATES THAT NO EXISTING STEP DOES. Discriminator:1 asks "what kind is each option,
// and which kind denotes the category" and eliminates on EXACT-STRING mismatch against one
// extracted `categoryKind` -- a single classification, not an opposition. THE SEMIOTIC SQUARE
// instead mines a genuine two-sided ANTONYM PAIR straight from the options' own text (never a
// free-form "what kind is this") and applies the square's CONTRADICTION relation across the WHOLE
// bucket on each side -- a structurally different elimination path from Discriminator's single-kind
// match, one this estate did not previously have.
//
// SAME BOUNDARY AS EVERY SIBLING STEP IN THIS DIRECTORY: classify_cascade.ts and
// plow_mc_answerer.ts are FORBIDDEN and are not imported anywhere in this file (that boundary was
// held by D-BP154-072 and holds here, per this dispatch's own NON-NEGOTIABLE CONSTRAINTS).
//
// APPLIED TO QID 85 (the dispatch's own target -- "Which of these statements correctly explains
// bias?", ten options, key E, per `scripts/test_survey_wiring_qid85_bp150_016.mjs` and the
// TIGER-Lab MMLU-Pro corpus record read this dispatch). Traced by hand against the real option text
// before writing the live step (see semiotic_square_step.test.ts's own qid-85 describe block for
// the mechanical proof): the winning stem is "represent" (coverage 3 -- A and E state the NEGATED
// form "does not represent"/"not representative", D states the AFFIRMED form "perfectly
// represents"; the next-best stems, "random" [C/H] and "influence" [G/I], each score only 2 and
// lose deterministically). If the source confirms the NEGATED pole denotes bias (the expected,
// sourced outcome -- both real captured folds in the qid-85 evidence, the SAMPLING fold and the
// ESTIMATOR fold, independently describe bias as a FAILURE to represent/estimate correctly, never
// as success), THE SQUARE eliminates D by contradiction and leaves A and E both in S1 -- the SAME
// {A, E} narrowing this estate's own predicate-reduction diagnostic
// (`scratchpad/kn_bp144_2_gate_qid85_output.txt`) already reached by a differently-built mechanism.
// THIS IS AN HONEST CROSS-CHECK, NOT A COINCIDENCE MANUFACTURED TO PASS: two independently designed
// mechanisms landing on the same non-unique {A, E} narrowing is evidence the narrowing is real, and
// evidence that THE SQUARE, on this one axis, does NOT resolve qid 85 to a unique verdict -- A and
// E share the same stated genus on the winning axis, and nothing in this file invents a second axis
// to break the tie (that would be widening a gate to force a pass, forbidden by this dispatch in
// so many words). This is reported as a RESULT in this dispatch's own return, not softened.

import {
  appearsIn, gemmaExtract,
} from '../methods/comparative_cascade';
import type { MethodQuestionInput, MethodRunContext } from '../method_registry';
import { registerNameNumbered } from './method_registry';
import type { MethodIdentity } from './method_identity';
import type { StepDeclaration } from './step_declaration';
// D-BP154-014's shared "owned evidence -> Gemini answers -> Google corroborates" plumbing --
// identical priority order and provenance discipline as Discriminator:1/NamedSet:1, see that
// file's own header for the full ruling (FD-BP153-04 + FD-BP154-02 + FD-BP154-03).
import {
  corroborateClaim, gatherMortgageCandidates, gatherThisRunCandidates,
  spanIsVerbatimInPassage, summarizeCorroboration, tryConversationalAuthority,
} from './composer_step_evidence';
import type { ClaimProvenance, CorroborationResult } from './composer_step_evidence';

// ───────────────────── pure parts (unit-testable without a live Ollama/browser) ─────────────────────

// STEP 1/3: WHICH TERM DOES THE QUESTION ASK TO BE EXPLAINED/DEFINED? Pure text-structure parsing
// of the question's OWN wording, never a judgment -- returns null (never a guess) when the
// question does not fit one of these common definitional-item templates.
const DEFINITIONAL_TERM_RE = /\b(?:explains?|defines?|describes?|means?)\s+([a-z][a-z '-]*?)\??$/i;

export function deriveSemioticSquareTerm(question: string): string | null {
  const m = question.match(DEFINITIONAL_TERM_RE);
  if (m && m[1] && m[1].trim()) return m[1].trim().replace(/\.$/, '');
  return null;
}

// STEP 2/3: MINE A SOURCE-ATTESTED CONTRARY PAIR STRAIGHT FROM THE OPTIONS' OWN TEXT. Pure,
// structural, no live query -- the option text IS its own verbatim source, so no span-verification
// choke point is needed here (unlike every OTHER extraction in this estate, which reads a FETCHED
// passage and must prove a span is really in it -- an option's own stated text needs no such
// proof against itself).
// Single-token markers checked against the WORD IMMEDIATELY BEFORE a candidate stem; "lack of" is
// the one two-token marker (checked separately, below) since "lack" alone is under the 5-character
// stem-candidate floor and would never itself reach this list otherwise.
const SINGLE_TOKEN_NEGATION_MARKERS = new Set(['not', 'no', 'never', 'without', 'lacking', 'lacks']);

// A short, named stoplist of structural/boilerplate words this qid-shape's own option template
// repeats in nearly every option ("It describes a process that results in..."); excluding them
// stops a purely grammatical scaffolding word from being mistaken for a semantic opposition.
// Anything NOT on this list is a candidate -- the list narrows false positives, it never hand-picks
// the winning stem (that is selectSemioticAxis()'s own job, by coverage, below).
const STEM_STOPWORDS = new Set([
  'describes', 'process', 'results', 'sample', 'population', 'sampling', 'method', 'study',
  'outcome', 'always', 'estimates', 'average', 'which', 'their', 'there', 'about', 'these',
  'those', 'where', 'whose', 'because', 'simply',
]);

/** Every alpha token in the text, lowercased, in order -- includes SHORT words ("not", "of",
 *  "lack") deliberately, so the negation-adjacency check just below can see them; the length/
 *  stopword filters that decide whether a token is a STEM CANDIDATE are applied separately, only
 *  to the token being classified, never to its neighbors. */
function tokenizeAll(text: string): string[] {
  return (text.match(/[a-zA-Z]+/g) ?? []).map((w) => w.toLowerCase());
}

/** Is the token at `i` immediately preceded by a stated negation marker? TOKEN-ADJACENT only
 *  (lookback of exactly one token, or the two-token "lack of" span) -- deliberately NOT a
 *  character-width window, which was measured (this ticket's own unit test) to falsely flag a
 *  word TWO tokens downstream of an unrelated marker ("does not fnorb THE DRENNEL" -- a character
 *  window wide enough to reach "fnorb" also reached "drennel", which the marker never governs).
 *  Adjacency is the mechanical, structural stand-in for "which word does this marker negate" --
 *  not a syntax parse, so a marker separated by more than the modeled span (an intervening
 *  adjective, say) will be missed; that is an honest limitation of a HARDWIRE-22-legal, judgment-
 *  free rule, not a defect to be patched with a bigger window. */
function precededByNegation(tokens: string[], i: number): boolean {
  if (i >= 1 && SINGLE_TOKEN_NEGATION_MARKERS.has(tokens[i - 1])) return true;
  if (i >= 2 && tokens[i - 2] === 'lack' && tokens[i - 1] === 'of') return true;
  return false;
}

// A small, fixed suffix-stripping table -- NOT a stemmer that guesses meaning, purely a mechanical
// surface-form fold so "represents"/"representative" collapse to the same stem as the same
// predicate stated in a different grammatical form. Order matters (longer suffixes checked first)
// so "representative" folds via "ative", not the shorter "s"/"ive" alternatives.
function stem(word: string): string {
  return word.toLowerCase().replace(/(ization|ative|ation|ingly|ations|ing|ers|ive|er|ed|s)$/, '');
}

export interface PredicateOccurrence {
  letter: string;
  name: string;
  polarity: 'affirmed' | 'negated';
  /** The option's own full stated text -- already verbatim by construction (it IS the source),
   *  never a fetched passage requiring separate span verification. */
  span: string;
}

export interface PredicateStemCandidate {
  stem: string;
  affirmed: PredicateOccurrence[];
  negated: PredicateOccurrence[];
}

/** Scans every option's OWN text (pure, structural, HARDWIRE-22-legal) for content-word stems
 *  shared across the option set in BOTH an affirmed and a negated form -- a genuine,
 *  source-attested antonym pair, never invented and never looked up in a synonym table. Returns
 *  every candidate found, including one-sided (not-yet-a-pair) stems; selectSemioticAxis() below
 *  is the ONE place a candidate is actually chosen. */
export function findPredicateStemCandidates(
  all: string[],
  OPT: Record<string, string>,
): PredicateStemCandidate[] {
  const byStem = new Map<string, PredicateStemCandidate>();
  for (const L of all) {
    const text = OPT[L];
    if (!text) continue;
    const tokens = tokenizeAll(text);
    const seenStemsThisOption = new Set<string>();
    for (let i = 0; i < tokens.length; i += 1) {
      const word = tokens[i];
      if (word.length < 5 || STEM_STOPWORDS.has(word)) continue;
      const s = stem(word);
      if (!s || s.length < 4) continue;
      if (seenStemsThisOption.has(s)) continue; // one occurrence credited per option per stem
      seenStemsThisOption.add(s);
      const negated = precededByNegation(tokens, i);
      const entry = byStem.get(s) ?? { stem: s, affirmed: [], negated: [] };
      const occ: PredicateOccurrence = {
        letter: L, name: OPT[L], polarity: negated ? 'negated' : 'affirmed', span: text.trim(),
      };
      (negated ? entry.negated : entry.affirmed).push(occ);
      byStem.set(s, entry);
    }
  }
  return [...byStem.values()];
}

/** THE ONE PLACE an axis is chosen -- purely mechanical: eligible candidates must have at least one
 *  occurrence on EACH side (a one-sided stem is not an opposition), then the largest combined
 *  attestation wins; ties broken alphabetically by stem text, never by which letter is involved
 *  (FD-BP153-06 -- no rule here may select a particular letter). Returns null (never a guess) when
 *  no candidate is genuinely two-sided. */
export function selectSemioticAxis(candidates: PredicateStemCandidate[]): PredicateStemCandidate | null {
  const eligible = candidates.filter((c) => c.affirmed.length > 0 && c.negated.length > 0);
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => {
    const covB = b.affirmed.length + b.negated.length;
    const covA = a.affirmed.length + a.negated.length;
    if (covB !== covA) return covB - covA;
    return a.stem.localeCompare(b.stem);
  });
  return eligible[0];
}

/** STEP 3/3, THE ONE QUERY: which pole does the term properly denote? Mirrors Discriminator:1's/
 *  NamedSet:1's own single-job query shape. */
export function buildSemioticSquareAxisQuery(term: string, axis: PredicateStemCandidate): string {
  const negatedExample = axis.negated[0]?.span ?? `does not ${axis.stem}`;
  const affirmedExample = axis.affirmed[0]?.span ?? `does ${axis.stem}`;
  return `Does "${term}" properly denote the state described by "${negatedExample}", or does it `
    + `properly denote the state described by "${affirmedExample}"? Answer plainly and directly, `
    + `stating clearly which ONE of the two it denotes.`;
}

export interface AxisPole {
  pole: 'negated' | 'affirmed';
  span: string;
}

/** THE VERIFY-THE-SPAN CHOKE POINT for the confirmed pole -- same discipline as
 *  discriminator_step.ts's verifyCategoryKind(): a missing or unverifiable span discards the
 *  candidate; the caller treats a discard here as "not stated", never a guess. */
export function verifySemioticSquareAxisPole(
  raw: unknown,
  passage: string,
): { axisPole: AxisPole | null; discarded: boolean } {
  const entry = raw as { pole?: unknown; span?: unknown } | undefined;
  const poleRaw = typeof entry?.pole === 'string' ? entry.pole.trim().toLowerCase() : '';
  const span = typeof entry?.span === 'string' ? entry.span.trim() : '';
  const pole = poleRaw === 'negated' ? 'negated' : poleRaw === 'affirmed' ? 'affirmed' : null;
  if (!pole || !span || !spanIsVerbatimInPassage(passage, span)) {
    return { axisPole: null, discarded: Boolean(poleRaw || span) };
  }
  return { axisPole: { pole, span }, discarded: false };
}

export type SquarePosition = 'S1' | 'S2' | 'UNSTATED';

export interface SemioticSquareMember {
  letter: string;
  name: string;
  /** S1 = occupies the pole the source confirmed; S2 = occupies the CONTRARY pole (the square's
   *  CONTRADICTION relation eliminates these); UNSTATED = the option's own text attests neither
   *  pole of the winning axis at all -- never placed in either bucket, absence is omission. */
  position: SquarePosition;
  /** The option's own stated text for S1/S2 members; empty for UNSTATED (nothing to cite). */
  span: string;
}

export interface SemioticSquareBuild {
  s1Label: string;
  s2Label: string;
  members: SemioticSquareMember[];
  eliminatedByContradiction: SemioticSquareMember[];
}

/** THE SQUARE ITSELF -- pure computation over an already-mined axis and an already-confirmed pole.
 *  No new extraction, no new query: given WHICH pole the source confirmed, the CONTRADICTION
 *  relation (S1 and S2 cannot both hold) mechanically eliminates every option in the OTHER bucket.
 *  Options that mention neither bucket for this stem are UNSTATED, never eliminated. */
export function buildSquare(
  all: string[],
  OPT: Record<string, string>,
  axis: PredicateStemCandidate,
  confirmedPole: 'negated' | 'affirmed',
): SemioticSquareBuild {
  const s1Bucket = confirmedPole === 'negated' ? axis.negated : axis.affirmed;
  const s2Bucket = confirmedPole === 'negated' ? axis.affirmed : axis.negated;
  const s1Letters = new Set(s1Bucket.map((o) => o.letter));
  const s2Letters = new Set(s2Bucket.map((o) => o.letter));
  const members: SemioticSquareMember[] = all.map((L) => {
    if (s1Letters.has(L)) return { letter: L, name: OPT[L], position: 'S1' as const, span: OPT[L] };
    if (s2Letters.has(L)) return { letter: L, name: OPT[L], position: 'S2' as const, span: OPT[L] };
    return { letter: L, name: OPT[L], position: 'UNSTATED' as const, span: '' };
  });
  return {
    s1Label: s1Bucket[0]?.span ?? axis.stem,
    s2Label: s2Bucket[0]?.span ?? axis.stem,
    members,
    eliminatedByContradiction: members.filter((m) => m.position === 'S2'),
  };
}

export interface SemioticSquareResult {
  ok: boolean;
  /** D-BP154-063 convention, ADDITIVE: true when the question does not fit this step's own shape
   *  (no definitional term found) -- checked BEFORE `ok` by terminator_step.ts's own stepStatus()
   *  convention, same as SoftballsResult's/DiscriminatorResult's own identical field. */
  inapplicable?: boolean;
  term: string | null;
  axisStem: string | null;
  s1Label: string | null;
  s2Label: string | null;
  query: string | null;
  confirmedPole: 'negated' | 'affirmed' | null;
  axisSpan: string | null;
  members: SemioticSquareMember[];
  eliminatedByContradiction: SemioticSquareMember[];
  via: string;
  answerProvenance?: ClaimProvenance;
  corroboration?: CorroborationResult;
  error?: string;
}

function summaryLine(r: SemioticSquareResult): string {
  if (!r.ok) return `SEMIOTIC SQUARE: FAILED -- ${r.error}`;
  const membersText = r.members.map((m) => `${m.letter}) ${m.position}`).join('  |  ');
  const eliminatedText = r.eliminatedByContradiction.length
    ? r.eliminatedByContradiction.map((m) => `${m.letter}) ${m.name}`).join(', ')
    : '(none)';
  const corrobNote = r.corroboration ? `  ||  ${summarizeCorroboration(r.corroboration)}` : '';
  return `SEMIOTIC SQUARE -- term: "${r.term}"  ||  axis stem: "${r.axisStem}"  ||  query: "${r.query}"  `
    + `||  S1 (confirmed pole, "${r.confirmedPole}"): "${r.s1Label}" [source: "${r.axisSpan}"]  `
    + `||  S2 (contrary, contradicted): "${r.s2Label}"  ||  MEMBERS: ${membersText}  `
    + `||  ELIMINATED BY CONTRADICTION (occupy S2, the pole the source did NOT confirm): ${eliminatedText}${corrobNote}`;
}

// ───────────────── the live step (owned evidence -> conversational -> corroboration; needs a real run to verify) ─────────────────

/**
 * Runs THE SEMIOTIC SQUARE as one Composer step: mines a source-attested contrary pair from the
 * options' own text (pure, no query), asks owned evidence then the conversational authority which
 * pole the question's own term denotes (FD-BP154-02), then applies the square's fixed CONTRADICTION
 * relation to eliminate every option occupying the unconfirmed pole, plus ONE Google corroboration
 * pass on the confirmed pole. Cannot be exercised end to end under vitest -- same boundary
 * Discriminator:1's/NamedSet:1's own headers state. The pure parts above carry the real unit tests
 * (including a full trace against the real qid-85 option text); this function is verified by a live
 * in-app run (this dispatch's own return).
 */
export async function runSemioticSquareStep(
  input: MethodQuestionInput,
  ctx: MethodRunContext,
): Promise<{ result: SemioticSquareResult; summary: string }> {
  const OPT = input.options;
  if (!OPT || Object.keys(OPT).length === 0) {
    const result: SemioticSquareResult = {
      ok: false, term: null, axisStem: null, s1Label: null, s2Label: null, query: null,
      confirmedPole: null, axisSpan: null, members: [], eliminatedByContradiction: [], via: 'n/a',
      error: 'this question has no lettered options -- THE SEMIOTIC SQUARE needs at least two source-attested positions to build',
    };
    return { result, summary: summaryLine(result) };
  }
  const optSafe: Record<string, string> = OPT;
  const all = Object.keys(optSafe);

  const term = deriveSemioticSquareTerm(input.question);
  if (!term) {
    const result: SemioticSquareResult = {
      ok: false, inapplicable: true, term: null, axisStem: null, s1Label: null, s2Label: null,
      query: null, confirmedPole: null, axisSpan: null, members: [], eliminatedByContradiction: [],
      via: 'n/a',
      error: 'could not determine which term the question asks to be explained/defined (no "explains/defines/describes/means <term>?" phrase found) -- refusing rather than guessing',
    };
    return { result, summary: summaryLine(result) };
  }

  const candidates = findPredicateStemCandidates(all, optSafe);
  const axis = selectSemioticAxis(candidates);
  if (!axis) {
    const result: SemioticSquareResult = {
      ok: false, inapplicable: true, term, axisStem: null, s1Label: null, s2Label: null, query: null,
      confirmedPole: null, axisSpan: null, members: [], eliminatedByContradiction: [], via: 'n/a',
      error: `no source-attested antonym-style predicate pair exists among the options' own stated `
        + `text -- THE SEMIOTIC SQUARE requires a genuine contrary pair (an affirmed AND a negated `
        + `form of the SAME stated predicate stem) and refuses to invent one. `
        + `${candidates.length} one-sided candidate stem(s) found, none with both sides attested.`,
    };
    return { result, summary: summaryLine(result) };
  }

  const query = buildSemioticSquareAxisQuery(term, axis);
  const mentionsAxis = (t: string) => appearsIn(t, term) || appearsIn(t, axis.stem);
  const mcOptions = all.map((L) => `${L}) ${optSafe[L]}`);
  const negatedExample = axis.negated[0]?.span ?? '';
  const affirmedExample = axis.affirmed[0]?.span ?? '';
  const instruction = `Read the passage and determine whether it states that "${term}" properly `
    + `denotes the FIRST description below, or the SECOND. FIRST: "${negatedExample}" SECOND: `
    + `"${affirmedExample}" State plainly which ONE ("negated" for the FIRST, "affirmed" for the `
    + `SECOND), and copy the exact verbatim sentence or clause from the passage that states it. If `
    + `the passage does not address this at all, state null for both.`;
  const shape = '{"pole":"negated or affirmed or null","span":"verbatim sentence or clause, or null"}';

  // STAGE 1: OWNED EVIDENCE FIRST (FD-BP153-04).
  const owned = [...(await gatherMortgageCandidates(input.qid, query)), ...gatherThisRunCandidates(ctx)];
  let text = ''; let via = ''; let provenance: ClaimProvenance | undefined;
  for (const c of owned) { if (mentionsAxis(c.text)) { text = c.text; via = c.via; provenance = c.provenance; break; } }

  let axisPole: AxisPole | null = null;
  let extractionError: string | undefined;
  const describeFailure = (rawOut: { truncated?: boolean; failureCause?: 'transport' | 'http-error' | 'parse-error'; failureDetail?: string }) => (
    rawOut.truncated
      ? 'the local extraction model truncated its output before finishing'
      : rawOut.failureCause
        ? `the local extraction model failed (${rawOut.failureCause}${rawOut.failureDetail ? `: ${rawOut.failureDetail}` : ''})`
        : 'the local extraction model failed for an unclassified reason'
  );
  if (text) {
    const rawOut: { truncated?: boolean; failureCause?: 'transport' | 'http-error' | 'parse-error'; failureDetail?: string } = {};
    const ex = await gemmaExtract(instruction, text, shape, rawOut);
    if (ex === null) extractionError = describeFailure(rawOut);
    else axisPole = verifySemioticSquareAxisPole(ex, text).axisPole;
  }

  // STAGE 2: GEMINI ANSWERS (FD-BP154-02) -- tried when STAGE 1 found nothing at all, or found a
  // passage that yielded no verified pole.
  if (!text || !axisPole) {
    const cr = await tryConversationalAuthority(ctx, query, mcOptions);
    if (cr.ok && mentionsAxis(cr.text)) {
      const rawOut2: { truncated?: boolean; failureCause?: 'transport' | 'http-error' | 'parse-error'; failureDetail?: string } = {};
      const ex2 = await gemmaExtract(instruction, cr.text, shape, rawOut2);
      if (ex2 !== null) {
        const { axisPole: pole2 } = verifySemioticSquareAxisPole(ex2, cr.text);
        if (pole2 || !text) {
          text = cr.text; via = cr.via; provenance = cr.provenance; axisPole = pole2;
          if (pole2) extractionError = undefined;
        }
      } else if (!text) {
        extractionError = describeFailure(rawOut2);
      }
    } else if (!text) {
      const result: SemioticSquareResult = {
        ok: false, term, axisStem: axis.stem, s1Label: null, s2Label: null, query, confirmedPole: null,
        axisSpan: null, members: [], eliminatedByContradiction: [], via: 'n/a',
        error: `no usable answer from any authority -- owned evidence: ${owned.length} candidate(s) `
          + `tried, none usable; conversational authority: `
          + `${cr.error ?? 'answered but did not address the term or the axis'} -- THE SEMIOTIC `
          + `SQUARE is UNAVAILABLE, not neutral`,
      };
      return { result, summary: summaryLine(result) };
    }
  }

  if (!axisPole) {
    const result: SemioticSquareResult = {
      ok: false, term, axisStem: axis.stem, s1Label: null, s2Label: null, query, confirmedPole: null,
      axisSpan: null, members: [], eliminatedByContradiction: [], via: via || 'n/a',
      error: `the credited passage (${via || 'n/a'}) produced no verifiable pole -- `
        + `${extractionError ?? 'no verifiable span for either pole'} -- THE SEMIOTIC SQUARE is `
        + `UNAVAILABLE, not neutral`,
    };
    return { result, summary: summaryLine(result) };
  }

  const square = buildSquare(all, optSafe, axis, axisPole.pole);

  // STAGE 3: GOOGLE CORROBORATES THE CONFIRMED POLE -- ONE query (FD-BP154-02).
  const corrobTarget = axisPole.pole === 'negated' ? negatedExample : affirmedExample;
  const corroboration = await corroborateClaim(ctx, `Does "${term}" denote ${corrobTarget}`, term);

  const result: SemioticSquareResult = {
    ok: true, term, axisStem: axis.stem, s1Label: square.s1Label, s2Label: square.s2Label, query,
    confirmedPole: axisPole.pole, axisSpan: axisPole.span, members: square.members,
    eliminatedByContradiction: square.eliminatedByContradiction, via, answerProvenance: provenance,
    corroboration,
  };
  return { result, summary: summaryLine(result) };
}

// ───────────────────────── registration (inert until stacked and run) ─────────────────────────

const SEMIOTIC_SQUARE_DECLARATION: StepDeclaration = {
  id: 'liana_cycle.semiotic_square_step.runSemioticSquareStep',
  version: '1',
  sourceFile: 'src/main/liana_cycle/library/semiotic_square_step.ts',
  sourceLine: 1,
  exportName: 'runSemioticSquareStep',
  exportKind: 'function',
  whatItDoes:
    'Builds a Greimas semiotic square over a source-attested contrary predicate pair mined from '
    + 'the options\' own stated text (an affirmed form and a negated form of the SAME stated '
    + 'predicate stem, chosen by largest attestation), asks which pole the question\'s own term '
    + 'properly denotes -- owned evidence first, then the conversational authority (FD-BP154-02) -- '
    + 'then applies the square\'s fixed CONTRADICTION relation: every option occupying the pole the '
    + 'source did NOT confirm is eliminated. Refuses to run when no genuine two-sided contrary pair '
    + 'is attested among the options, or when the question names no definitional term.',
  inputs: 'MethodQuestionInput (question, options, qid) plus MethodRunContext (askGoogle, askConversationalAuthority, ownedPassages, emit) to runSemioticSquareStep().',
  outputs: 'Promise<{ result: SemioticSquareResult, summary: string }> -- the axis stem, both poles\' labels, the confirmed pole with its verbatim span, every option\'s square position (S1/S2/UNSTATED), the options eliminated by contradiction, the answer mechanism, and a document corroboration attempt.',
  decidesOrReports: 'DECIDES_AND_REFUSES',
  queryText: {
    issuesQuery: true,
    description: 'One primary question per run -- owned evidence tried first, then "Does <term> properly denote <negated pole>, or <affirmed pole>?" put to the conversational authority (FD-BP154-02) -- plus at most one Google corroboration query for the confirmed pole, hardcoded inline in this file.',
    loadedFromQueryResource: false,
  },
  attribution: {
    kind: 'ATTRIBUTED',
    founderRuling: 'BP154',
    quote: 'yes, I like Greimas, keep it, and use the semiotic square (build it) and apply to 85.',
    citedAt: 'D-BP154-069, re-dispatched D-BP155-004, this dispatch\'s own quoted order',
  },
  orphanEvidence:
    'N/A -- not an orphan. Live: registered via registerSemioticSquareStep() (this file), executed '
    + 'by script_bridge.ts\'s runOneStep() for id "SemioticSquare:1", the same wiring pattern '
    + 'Discriminator:1/NamedSet:1 already use.',
};

/** Registers 'SemioticSquare:1'. Called from script_bridge.ts's ensureRegistryPopulated(),
 *  idempotently -- same try/catch shape as every other Composer step registration there. */
export function registerSemioticSquareStep(): MethodIdentity {
  return registerNameNumbered('SemioticSquare', 1, SEMIOTIC_SQUARE_DECLARATION);
}
