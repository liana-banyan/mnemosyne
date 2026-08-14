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

/** D-BP154-021/BISHOP-SEG/S21/seg-mortgagetrap, ADDITIVE. Founder's own correction (D-BP154-021
 *  dispatch): FD-BP153-07 point 3 is about the SUPERLATIVE PROPERTY, not only the bare category --
 *  for qid 98 the phrase that decides the answer is "the world's most densely populated regions",
 *  not merely "world regions". Byte-identical logic to named_set_step.ts's own
 *  deriveNamedSetProperty() -- DUPLICATED, not imported, same "no Composer step depends on another
 *  step's internals" discipline this file's own deriveDiscriminatorCategory() above already
 *  states (drift between the two copies is a real cost accepted for that discipline, same as
 *  named_set_step.ts's own comment on its twin). Pure text-structure parsing of the question's OWN
 *  wording, never a judgment -- returns null (never a guess) when the question does not fit this
 *  shape (many questions have a bare category with no superlative phrase at all). */
export function deriveDiscriminatorSuperlativeProperty(question: string): string | null {
  const m1 = question.match(/\bone of\s+(?:the\s+)?([a-z0-9][^?]*?)\??$/i);
  if (m1 && m1[1].trim()) return m1[1].trim();
  const m2 = question.match(/\bconsidered\s+(?:the\s+)?([a-z0-9][^?]*?)\??$/i);
  if (m2 && m2[1].trim()) return m2[1].trim();
  return null;
}

/** THE ONE QUERY, asking FD-BP153-07 point 3's things in a single round trip: what kind each
 *  option is, what kind denotes the bare category, AND (D-BP154-021, ADDITIVE) -- when the
 *  question names one -- which options the source explicitly states ARE the superlative property
 *  itself (e.g. "the world's most densely populated regions", not merely "world regions"). All
 *  asked in the SAME query text, never as separate round trips (FD-BP153-01 consequence 4).
 *
 *  D-BP154-020/BISHOP-SEG/S20/seg-discriminator2: the trailing "-- rather than merely whether it
 *  is or is not `<category>`" clause is added here to match the KNOWN-WORKING phrasing on record
 *  in LIANA_RUN_qid98_2026-08-13T19-24-50-420Z.json (draw 2, all nine options correctly classified
 *  live) -- classify_cascade.ts's own establishFrame() needed the identical clause for the
 *  identical reason (commit 5781c477, FORBIDDEN file, read only for its OWN measured finding, not
 *  imported): without it, this exact "state what it is" wording still invites the model to answer
 *  the CATEGORY-MEMBERSHIP question ("is/is not `<category>`") instead of stating an actual
 *  classification, which extraction then reads as no stated kind at all -- a comparison essay, not
 *  a taxonomy answer. Plain wording, applies identically regardless of which category, property, or
 *  option is named -- never a letter-specific or answer-specific change (FD-BP153-06). */
export function buildDiscriminatorQuery(
  category: string, property: string | null, all: string[], OPT: Record<string, string>,
): string {
  const base = `For EACH of the following, state exactly what it is -- its actual classification or `
    + `type -- rather than merely whether it is or is not ${category}. Answer for every one, in `
    + `order, and do not skip any. ${list(all, OPT)} Then, separately and last, state which one `
    + `of those classifications properly denotes "${category}".`;
  // D-BP154-023/BISHOP-SEG/S23/seg-enumerate, ADDITIVE. FD-BP154-06, Founder verbatim: "the
  // narrow reading is obtainable from a source we can cite." The fourth ask -- ALWAYS included
  // (the bare category is always present, unlike `property`): does the source enumerate what the
  // category ITSELF consists of, as a stated, exhaustive list -- the Jar Method applied to the
  // CATEGORY rather than the property. Phrased to explicitly demand exhaustiveness ("the complete
  // list... do not give examples") so a source that merely illustrates with "such as" is not
  // mistaken for one that is defining the category by enumeration.
  const withEnumeration = `${base} Then, separately, does "${category}" refer to a specific, `
    + `enumerable, closed set of things (not an open-ended kind)? If so, state the complete list `
    + `of what it consists of, exhaustively -- do not give examples, give the actual list -- and `
    + `then state explicitly which of the options above are named members of that list.`;
  const withProperty = property
    ? `${withEnumeration} Then, separately, state explicitly which of the following, if any, `
      + `ARE ${property} -- name each one explicitly and state clearly that it is ${property}. Do `
      + `not guess about ones you are not sure of; simply do not mention those.`
    : withEnumeration;
  // D-BP154-026/BISHOP-SEG/S26/seg-subregion, ADDITIVE. Founder's own hand-worked frame (recovered
  // BP144) drew a line the machine's obtained enumerations have not yet been asked to draw: some of
  // the enumeration's own named members are themselves REGIONS (e.g. a continent), and some are
  // SUBDIVISIONS listed one level inside a region -- the enumeration text obtained twice this
  // session (D-BP154-023, D-BP154-026) nests "Northern Africa" and "Central Asia" one level under
  // "Africa"/"Asia" rather than at the top level "South America"/"Europe" sit at. Rather than
  // reading that nesting ourselves (which would be exactly the forbidden move -- deciding a
  // narrower reading because it yields a particular letter), this asks the SOURCE to state the
  // distinction explicitly, symmetrically, for every option whose own stated kind is itself a
  // "subregion"/"subdivision" (never singling out any one option by name or letter -- FD-BP153-06).
  // A source that says nothing here leaves those options exactly where they already stood
  // (UNSTATED, per D-BP154-024) -- this can only ever ADD an affirmative non-member fact, the same
  // legitimate elimination basis Softballs' own `excluded` already carries; it can never remove one.
  return `${withProperty} Then, separately, for each option above whose own stated classification `
    + `is itself described as a SUBREGION, SUBDIVISION, or PART of a larger region (rather than a `
    + `region in its own right), state explicitly whether that option is, itself, properly `
    + `considered one of "${category}" -- or whether it is instead a part WITHIN a larger world `
    + `region rather than a world region on its own. For each option the passage explicitly states `
    + `is NOT a world region in its own right (only a subdivision within one), copy the exact `
    + `verbatim sentence or clause that says so. Do not include an option the passage does not `
    + `address this way -- an omission is not a statement.`;
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

export interface CategoryEnumeration {
  /** Verbatim span proving the source itself gave an enumerated list for the category. */
  span: string;
}

/** D-BP154-023/BISHOP-SEG/S23/seg-enumerate. THE ONE CORROBORATION QUERY for the decisive
 *  enumeration-absence fact (FD-BP154-06's own decisive claim, when present): re-asks whether the
 *  named option is genuinely absent from -- i.e. not a member of -- the category's own stated
 *  enumeration. Preferred over the categoryKind corroboration target when a productive
 *  enumeration exists (this IS the ruling's own decisive fact, the same priority categoryKind
 *  already held for the kind-mismatch rule). */
export function buildDiscriminatorEnumerationCorroborationQuery(category: string, name: string): string {
  return `Is ${name} one of the things that "${category}" enumerates or consists of? Answer `
    + `plainly and directly, stating clearly whether it is or is not.`;
}

// spanIsVerbatimInPassage() is now imported from composer_step_evidence.ts (D-BP154-014) --
// identical logic, shared rather than a third local copy; see that file's own header.

/** D-BP154-021/BISHOP-SEG/S21/seg-mortgagetrap, ADDITIVE. Which options the source EXPLICITLY
 *  states ARE the superlative property (e.g. "the world's most densely populated regions") --
 *  same shape and same verbatim-span discipline as named_set_step.ts's own IncludedOption,
 *  duplicated locally (not imported) for the same "steps stay self-contained" reason
 *  deriveDiscriminatorSuperlativeProperty() above states. */
export interface DiscriminatorPropertyMemberEntry {
  letter: string;
  name: string;
  /** Verbatim span proving the source itself stated this option IS the superlative property. */
  span: string;
}

type RawKindEntry = { name?: unknown; kind?: unknown; span?: unknown };
type RawCategoryKind = { kind?: unknown; span?: unknown };
type RawPropertyMemberEntry = { name?: unknown; span?: unknown };

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

type RawCategoryEnumeration = { span?: unknown };

/** D-BP154-023/BISHOP-SEG/S23/seg-enumerate. THE VERIFY-THE-SPAN CHOKE POINT for the category's
 *  own stated enumeration (FD-BP154-06). Only verbatim-span verification applies here (there is
 *  no option name to cross-check against -- this is a statement about the CATEGORY as a whole,
 *  mirroring verifyCategoryKind()'s own identical discipline immediately above). A missing or
 *  unverifiable span discards the candidate; the caller treats a discard here as "no enumeration
 *  stated", never a guess. */
export function verifyCategoryEnumeration(raw: unknown, passage: string): { categoryEnumeration: CategoryEnumeration | null; discarded: boolean } {
  const entry = raw as RawCategoryEnumeration | undefined;
  const span = typeof entry?.span === 'string' ? entry.span.trim() : '';
  if (!span || !spanIsVerbatimInPassage(passage, span)) {
    return { categoryEnumeration: null, discarded: Boolean(span) };
  }
  return { categoryEnumeration: { span }, discarded: false };
}

/** THE VERIFY-THE-SPAN CHOKE POINT for the superlative-property membership list (D-BP154-021,
 *  ADDITIVE), mirrored exactly from named_set_step.ts's own verifyIncludedEntries() four-part
 *  discipline: (a) non-empty `name`, (b) non-empty `span`, (c) span VERBATIM in `passage`, (d)
 *  span itself ABOUT the named option (appearsIn(span, OPT[L])). Any failure of (b)/(c)/(d) is a
 *  DISCARD and is counted. A `name` mapping to no known option letter is simply not a match -- not
 *  a candidate value, not a discard. */
export function verifyDiscriminatorPropertyMembers(
  raw: unknown,
  passage: string,
  OPT: Record<string, string>,
): { propertyMembers: DiscriminatorPropertyMemberEntry[]; discarded: number } {
  const entries = Array.isArray(raw) ? (raw as RawPropertyMemberEntry[]) : [];
  const propertyMembers: DiscriminatorPropertyMemberEntry[] = [];
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
    propertyMembers.push({ letter: L, name: OPT[L], span });
  }
  return { propertyMembers, discarded };
}

export interface DiscriminatorResult {
  ok: boolean;
  category: string | null;
  /** D-BP154-021, ADDITIVE: the superlative property phrase (e.g. "the world's most densely
   *  populated regions"), when the question names one -- null when the question has only a bare
   *  category with no superlative phrase (FD-BP153-07 point 3 is about the SUPERLATIVE PROPERTY,
   *  not only the bare category). */
  property: string | null;
  query: string | null;
  kinds: DiscriminatorEntry[];
  discardedKinds: number;
  /** Options the source never stated a kind for -- ABSENCE IS OMISSION: never guessed, never
   *  conflated with "the source said this has no kind". */
  noKindStated: string[];
  categoryKind: CategoryKind | null;
  categoryKindDiscarded: boolean;
  /** D-BP154-021, ADDITIVE: options the source EXPLICITLY states ARE the superlative property
   *  itself (not merely the bare category) -- ABSENCE IS OMISSION, same discipline as `kinds`.
   *  Empty (never null) when `property` is null or the source states no members. */
  propertyMembers: DiscriminatorPropertyMemberEntry[];
  discardedPropertyMembers: number;
  /** D-BP154-023/BISHOP-SEG/S23/seg-enumerate, ADDITIVE (FD-BP154-06, "the narrow reading is
   *  obtainable from a source we can cite"). The source's own stated, exhaustive enumeration of
   *  what the CATEGORY consists of -- null when no source ever gave one (never guessed, never
   *  supplied by this file). */
  categoryEnumeration: CategoryEnumeration | null;
  categoryEnumerationDiscarded: boolean;
  /** D-BP154-023, ADDITIVE: options the source's own enumeration names as members -- verified
   *  with the SAME four-part discipline as `propertyMembers`. ABSENCE IS OMISSION *unless*
   *  `categoryEnumeration` is non-null AND this array is non-empty (proof the enumeration
   *  genuinely engaged this option set) -- only then does terminator_step.ts treat an option NOT
   *  in this list as excluded from the frame; see that file's own header for the full rule and
   *  why an empty list here is never trusted to mean "everyone is excluded". */
  categoryEnumerationMembers: DiscriminatorPropertyMemberEntry[];
  discardedCategoryEnumerationMembers: number;
  /** D-BP154-026/BISHOP-SEG/S26/seg-subregion, ADDITIVE. Options the source EXPLICITLY states are
   *  NOT `category` in their own right -- only a subdivision/part WITHIN a larger region. A
   *  legitimate AFFIRMATIVE denial (same status as Softballs' own `excluded`), never inferred from
   *  a kind label or an enumeration's own nesting -- ABSENCE IS OMISSION, same discipline as every
   *  other field here. Asked symmetrically of every option (FD-BP153-06); never singles one out. */
  subregionNonMembers: DiscriminatorPropertyMemberEntry[];
  discardedSubregionNonMembers: number;
  via: string;
  /** D-BP154-014, FD-BP154-03: HOW the passage this extraction ran over was obtained. */
  answerProvenance?: ClaimProvenance;
  /** D-BP154-014, FD-BP154-02: ONE Google corroboration attempt against the single decisive
   *  claim (the category's own enumeration when productive, else the category-denoting kind, or
   *  -- when neither was stated -- the first per-option kind). Additive, never a gate. */
  corroboration?: CorroborationResult;
  /** D-BP154-023, ADDITIVE: non-null ONLY when Stage 1 (owned) and Stage 2 (a fresh live query)
   *  each independently produced a PRODUCTIVE enumeration-membership set that DISAGREES --
   *  reported, never resolved by picking the convenient one (FD-BP154-06's own explicit rule). */
  enumerationDisagreement: { detailA: string; detailB: string } | null;
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
  const propertyMembersNote = r.property
    ? `  ||  MEMBERS OF "${r.property}" (source-stated, verified): ${
      r.propertyMembers.length
        ? r.propertyMembers.map((e) => `${e.letter}) ${e.name} [source: "${e.span}"]`).join('  |  ')
        : '(none stated)'
    }${r.discardedPropertyMembers ? ` -- discarded ${r.discardedPropertyMembers} candidate(s) with no verifiable span` : ''}`
    : '';
  // D-BP154-023/BISHOP-SEG/S23/seg-enumerate.
  const enumerationText = r.categoryEnumeration
    ? `stated -- "${r.categoryEnumeration.span}"`
    : r.categoryEnumerationDiscarded
      ? '(source attempted an answer but it had no verifiable span -- discarded)'
      : '(not stated)';
  const enumerationMembersText = r.categoryEnumerationMembers.length
    ? r.categoryEnumerationMembers.map((e) => `${e.letter}) ${e.name} [source: "${e.span}"]`).join('  |  ')
    : '(none stated)';
  const enumerationNote = `  ||  ENUMERATION OF "${r.category}": ${enumerationText}  ||  `
    + `NAMED MEMBERS OF THAT ENUMERATION: ${enumerationMembersText}`
    + `${r.discardedCategoryEnumerationMembers ? ` -- discarded ${r.discardedCategoryEnumerationMembers} candidate(s) with no verifiable span` : ''}`;
  const enumerationDisagreementNote = r.enumerationDisagreement
    ? `  ||  ENUMERATION DISAGREEMENT: ${r.enumerationDisagreement.detailA} vs ${r.enumerationDisagreement.detailB}`
    : '';
  // D-BP154-026/BISHOP-SEG/S26/seg-subregion.
  const subregionNonMembersNote = `  ||  STATED NOT "${r.category}" IN ITS OWN RIGHT (subdivision within a larger region): ${
    r.subregionNonMembers.length
      ? r.subregionNonMembers.map((e) => `${e.letter}) ${e.name} [source: "${e.span}"]`).join('  |  ')
      : '(none stated)'
  }${r.discardedSubregionNonMembers ? ` -- discarded ${r.discardedSubregionNonMembers} candidate(s) with no verifiable span` : ''}`;
  return `DISCRIMINATOR -- query: "${r.query}"  ||  KINDS (source-stated, verified): ${kindsText}`
    + `${discardNote}  ||  NO KIND STATED (source silent -- omission, not "no kind"): ${noKindText}`
    + `  ||  WHICH KIND DENOTES "${r.category}": ${categoryKindText}${enumerationNote}${enumerationDisagreementNote}${subregionNonMembersNote}${propertyMembersNote}${provenanceNote}${corrobNote}`;
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
/** D-BP154-023, ADDITIVE: the fields common to every early/failure DiscriminatorResult return
 *  below -- factored out so the growing field list (now 4 extraction asks) does not have to be
 *  hand-copied at each of the six return sites, a real drift risk this ticket's own predecessors
 *  (D-BP154-020/021) already hand-copied through twice. */
function emptyDiscriminatorFields(): Pick<
  DiscriminatorResult,
  'kinds' | 'discardedKinds' | 'categoryKind' | 'categoryKindDiscarded'
  | 'propertyMembers' | 'discardedPropertyMembers'
  | 'categoryEnumeration' | 'categoryEnumerationDiscarded' | 'categoryEnumerationMembers' | 'discardedCategoryEnumerationMembers'
  | 'subregionNonMembers' | 'discardedSubregionNonMembers'
  | 'enumerationDisagreement'
> {
  return {
    kinds: [], discardedKinds: 0, categoryKind: null, categoryKindDiscarded: false,
    propertyMembers: [], discardedPropertyMembers: 0,
    categoryEnumeration: null, categoryEnumerationDiscarded: false,
    categoryEnumerationMembers: [], discardedCategoryEnumerationMembers: 0,
    subregionNonMembers: [], discardedSubregionNonMembers: 0,
    enumerationDisagreement: null,
  };
}

export async function runDiscriminatorStep(
  input: MethodQuestionInput,
  ctx: MethodRunContext,
): Promise<{ result: DiscriminatorResult; summary: string }> {
  const OPT = input.options;
  if (!OPT || Object.keys(OPT).length === 0) {
    const result: DiscriminatorResult = {
      ok: false, category: null, property: null, query: null, noKindStated: [], via: 'n/a',
      ...emptyDiscriminatorFields(),
      error: 'this question has no lettered options -- THE DISCRIMINATOR classifies options and cannot run without them',
    };
    return { result, summary: summaryLine({}, result) };
  }
  // D-BP154-020: narrowed once, by value, so the nested extractFrom() closure below (which TS
  // does not retain the outer `!OPT` narrowing into) has a definitely-non-null Record to use --
  // same fix named_set_step.ts's own optSafe already applies for the identical closure shape.
  const optSafe: Record<string, string> = OPT;
  const all = Object.keys(optSafe);
  const category = deriveDiscriminatorCategory(input.question);
  if (!category) {
    const result: DiscriminatorResult = {
      ok: false, category: null, property: null, query: null, noKindStated: all, via: 'n/a',
      ...emptyDiscriminatorFields(),
      error: 'could not determine the category this question names (no "following X is/are" phrase found) -- refusing rather than guessing a category',
    };
    return { result, summary: summaryLine(OPT, result) };
  }
  // D-BP154-021, ADDITIVE: null when the question has only a bare category with no superlative
  // phrase -- buildDiscriminatorQuery()/the instruction below both handle null by simply not
  // asking the third thing, never a guess.
  const property = deriveDiscriminatorSuperlativeProperty(input.question);
  const query = buildDiscriminatorQuery(category, property, all, OPT);
  const namesAnyOption = (t: string) => all.some((L) => appearsIn(t, OPT[L]));
  // D-BP154-014, ADDITIVE: see softballs_step.ts's identical comment / tryConversationalAuthority().
  const mcOptions = all.map((L) => `${L}) ${OPT[L]}`);

  // D-BP154-020/BISHOP-SEG/S20/seg-discriminator2: factored out of the old single inline
  // gemmaExtract call so BOTH Stage 1 (owned evidence) and Stage 2 (a fresh live query) can run
  // it and be COMPARED -- named_set_step.ts's own extractFrom()/"try-harder-before-abstain"
  // pattern (D-BP154-018), mirrored here for THE DISCRIMINATOR's two outputs instead of one.
  const instructionBase = `From the passage, for EACH option below, copy its stated classification `
    + `or kind (exactly what the passage says it is), and the exact verbatim sentence or clause `
    + `that states it. Do not include an option the passage does not classify -- an omission is `
    + `not a statement. Then, separately, copy which ONE classification the passage states `
    + `properly denotes "${category}", and the verbatim sentence or clause that states so. `
    + `Options: ${all.map((L) => `${L}) ${OPT[L]}`).join('; ')}`;
  // D-BP154-023/BISHOP-SEG/S23/seg-enumerate, ADDITIVE (FD-BP154-06). The fourth extraction ask,
  // ALWAYS included: does the passage give an exhaustive enumeration of what the CATEGORY
  // consists of, and which options does that enumeration name. Mirrored from propertyMembers'
  // own instruction shape (D-BP154-021).
  const instructionWithEnumeration = `${instructionBase} Then, separately, if the passage gives `
    + `an exhaustive enumerated list of what "${category}" consists of, copy the exact verbatim `
    + `sentence or clause that gives that list. Then, separately, list every option above that `
    + `the passage's own enumeration explicitly names as a member of it. For each one, copy the `
    + `exact verbatim sentence or clause that names it (this may be the same sentence as the `
    + `enumeration itself, if it names the option directly). Do not include an option the `
    + `enumeration does not name -- an omission is not a statement. If the passage gives no such `
    + `enumeration, state null for it.`;
  // D-BP154-021, ADDITIVE: the fifth extraction ask, mirrored from named_set_step.ts's own
  // verifyIncludedEntries() instruction shape -- only added when the question names a superlative
  // property distinct from the bare category.
  const instructionWithProperty = property
    ? `${instructionWithEnumeration} Then, separately, list every option that the passage `
      + `explicitly and directly states IS ${property}. For each one, copy the exact verbatim `
      + `sentence or clause from the passage that states it is ${property}. Do not include an `
      + `option the passage merely does not mention -- an omission is not a statement.`
    : instructionWithEnumeration;
  // D-BP154-026, ADDITIVE -- mirrors buildDiscriminatorQuery()'s own new closing clause (see that
  // function's own header comment for the full ruling). ALWAYS included, symmetric across every
  // option, never picks a letter.
  const instruction = `${instructionWithProperty} Then, separately, for each option above the `
    + `passage explicitly states is NOT "${category}" in its own right -- because it is instead a `
    + `subdivision or part WITHIN a larger region -- copy the exact verbatim sentence or clause `
    + `that says so. Do not include an option the passage does not address this way -- an omission `
    + `is not a statement.`;
  const enumerationShapeFields = '"categoryEnumeration":{"span":"verbatim sentence or clause giving the enumerated list, or null"},'
    + '"categoryEnumerationMembers":[{"name":"exact option name from the list","span":"verbatim sentence or clause naming it as a member of the enumeration"}],';
  // D-BP154-026, ADDITIVE.
  const subregionShapeField = '"subregionNonMembers":[{"name":"exact option name from the list","span":"verbatim sentence or clause stating it is a subdivision within a larger region, not a region in its own right"}]';
  const shape = property
    ? `{"kinds":[{"name":"exact option name from the list","kind":"the stated classification","span":"verbatim sentence or clause"}],"categoryKind":{"kind":"the classification that denotes the category, or null","span":"verbatim sentence or clause, or null"},${enumerationShapeFields}"propertyMembers":[{"name":"exact option name from the list","span":"verbatim sentence or clause stating it is the superlative property"}],${subregionShapeField}}`
    : `{"kinds":[{"name":"exact option name from the list","kind":"the stated classification","span":"verbatim sentence or clause"}],"categoryKind":{"kind":"the classification that denotes the category, or null","span":"verbatim sentence or clause, or null"},${enumerationShapeFields}${subregionShapeField}}`;
  async function extractFrom(candidateText: string): Promise<{
    kinds: DiscriminatorEntry[]; discardedKinds: number;
    categoryKind: CategoryKind | null; categoryKindDiscarded: boolean;
    propertyMembers: DiscriminatorPropertyMemberEntry[]; discardedPropertyMembers: number;
    categoryEnumeration: CategoryEnumeration | null; categoryEnumerationDiscarded: boolean;
    categoryEnumerationMembers: DiscriminatorPropertyMemberEntry[]; discardedCategoryEnumerationMembers: number;
    subregionNonMembers: DiscriminatorPropertyMemberEntry[]; discardedSubregionNonMembers: number;
    extractionError?: string;
  }> {
    const rawOut: {
      text?: string; truncated?: boolean; failureCause?: 'transport' | 'http-error' | 'parse-error'; failureDetail?: string;
    } = {};
    const ex = await gemmaExtract(instruction, candidateText, shape, rawOut);
    if (ex === null) {
      const cause = rawOut.truncated
        ? 'the local extraction model truncated its output before finishing'
        : rawOut.failureCause
          ? `the local extraction model failed (${rawOut.failureCause}${rawOut.failureDetail ? `: ${rawOut.failureDetail}` : ''})`
          : 'the local extraction model failed for an unclassified reason';
      return {
        kinds: [], discardedKinds: 0, categoryKind: null, categoryKindDiscarded: false,
        propertyMembers: [], discardedPropertyMembers: 0,
        categoryEnumeration: null, categoryEnumerationDiscarded: false,
        categoryEnumerationMembers: [], discardedCategoryEnumerationMembers: 0,
        subregionNonMembers: [], discardedSubregionNonMembers: 0,
        extractionError: cause,
      };
    }
    const { kinds, discarded } = verifyDiscriminatorKinds(ex.kinds, candidateText, optSafe);
    const { categoryKind, discarded: categoryKindDiscarded } = verifyCategoryKind(ex.categoryKind, candidateText);
    const { propertyMembers, discarded: discardedPropertyMembers } = property
      ? verifyDiscriminatorPropertyMembers(ex.propertyMembers, candidateText, optSafe)
      : { propertyMembers: [], discarded: 0 };
    const { categoryEnumeration, discarded: categoryEnumerationDiscarded } = verifyCategoryEnumeration(ex.categoryEnumeration, candidateText);
    // D-BP154-026: same generic verifyDiscriminatorPropertyMembers() choke point, reused a third
    // time (see D-BP154-023's own comment at categoryEnumerationMembers for why this is preferred
    // over a near-duplicate fourth function).
    const { propertyMembers: subregionNonMembers, discarded: discardedSubregionNonMembers } = verifyDiscriminatorPropertyMembers(
      ex.subregionNonMembers, candidateText, optSafe,
    );
    // D-BP154-023: verifyDiscriminatorPropertyMembers() is fully generic (name/span verification
    // against a passage + option map, nothing property-specific inside it) -- reused unmodified
    // for the enumeration's own membership list rather than a near-duplicate fourth function.
    const { propertyMembers: categoryEnumerationMembers, discarded: discardedCategoryEnumerationMembers } = verifyDiscriminatorPropertyMembers(
      ex.categoryEnumerationMembers, candidateText, optSafe,
    );
    return {
      kinds, discardedKinds: discarded, categoryKind, categoryKindDiscarded, propertyMembers, discardedPropertyMembers,
      categoryEnumeration, categoryEnumerationDiscarded, categoryEnumerationMembers, discardedCategoryEnumerationMembers,
      subregionNonMembers, discardedSubregionNonMembers,
    };
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
  // D-BP154-023, ADDITIVE: STAGE 1's own extraction, captured BEFORE Stage 2 can overwrite
  // `extraction` -- kept only to detect a genuine cross-source ENUMERATION disagreement below
  // (FD-BP154-06: "if two sources state different denotations, that is a disagreement -- report
  // it, and abstain rather than picking the convenient one"). Never used for anything else.
  const stage1ExtractionForDisagreementCheck = extraction;

  // STAGE 2: GEMINI ANSWERS (FD-BP154-02) -- tried when STAGE 1 found nothing at all, OR (mirrors
  // D-BP154-018's named_set_step.ts fix) when STAGE 1 found a passage but it verifiably
  // established NONE of THE DISCRIMINATOR's four required outputs and extraction itself did not
  // fail. LIVE-MEASURED this ticket (D-BP154-020, qid 98): the pre-fix behavior accepted a stale
  // ~2.5-hour-old owned passage (`gatherMortgageCandidates`) that merely happened to mention an
  // option name somewhere, extracted ZERO per-option kinds (9 of 9 discarded) and a near-empty
  // categoryKind whose own span was just an echo of the query text ("Which of the following
  // regions") -- not a real denotation statement -- and reported `ok:true` anyway, leaving THE
  // TERMINATOR's own already-correct rule 3 (deriveTerminatorEliminations, this file's sibling
  // terminator_step.ts) with nothing usable to eliminate on. A passage that produced NONE of the
  // outputs is exactly as unproductive as one that produced zero memberships in
  // named_set_step.ts's own sense -- worth a second, independent, FRESH source before this step
  // accepts a near-empty result.
  const isProductive = (
    e: {
      kinds: DiscriminatorEntry[]; categoryKind: CategoryKind | null;
      propertyMembers: DiscriminatorPropertyMemberEntry[]; categoryEnumerationMembers: DiscriminatorPropertyMemberEntry[];
      subregionNonMembers?: DiscriminatorPropertyMemberEntry[];
    } | null,
  ): boolean => !!e && (e.kinds.length > 0 || !!e.categoryKind || e.propertyMembers.length > 0 || e.categoryEnumerationMembers.length > 0 || !!e.subregionNonMembers?.length);

  let conversationalError: string | undefined;
  const stage1WasUnproductive = !text || (!isProductive(extraction) && !extractionFailedOnStage1Text);
  if (stage1WasUnproductive) {
    const cr = await tryConversationalAuthority(ctx, query, mcOptions);
    if (cr.ok && namesAnyOption(cr.text)) {
      const cExtraction = await extractFrom(cr.text);
      // D-BP154-023, ADDITIVE (FD-BP154-06): a genuine cross-source ENUMERATION disagreement --
      // both Stage 1's own (otherwise-unproductive) extraction AND Stage 2's fresh one produced a
      // NON-EMPTY, DIFFERING category-enumeration membership set -- is reported and refused
      // outright, never silently resolved by preferring either one (explicitly, never the one
      // that "happens to yield A"). Pure set-equality comparison, no interpretation.
      const stage1Members = stage1ExtractionForDisagreementCheck?.categoryEnumerationMembers ?? [];
      const stage2Members = cExtraction.categoryEnumerationMembers;
      if (stage1Members.length > 0 && stage2Members.length > 0) {
        const stage1Letters = new Set(stage1Members.map((e) => e.letter));
        const stage2Letters = new Set(stage2Members.map((e) => e.letter));
        const disagree = stage1Letters.size !== stage2Letters.size
          || [...stage1Letters].some((L) => !stage2Letters.has(L));
        if (disagree) {
          const result: DiscriminatorResult = {
            ok: false, category, property, query, noKindStated: all, via,
            ...emptyDiscriminatorFields(),
            enumerationDisagreement: { detailA: via, detailB: cr.via },
            error: `the category's own enumeration is CONTRADICTED across independent sources (${via}: `
              + `{${[...stage1Letters].join(', ')}} vs ${cr.via}: {${[...stage2Letters].join(', ')}}) -- `
              + `reported as a disagreement, never resolved by force (FD-BP154-06)`,
          };
          return { result, summary: summaryLine(OPT, result) };
        }
      }
      // Prefer STAGE 2 only when it actually found something STAGE 1 did not (any of the four
      // outputs) -- STAGE 1's own (possibly partial) result is never discarded in favour of an
      // equally-empty STAGE 2 result; "tried harder, still nothing" stays an honest zero, not
      // silently swapped.
      if (isProductive(cExtraction) || !text) {
        text = cr.text; via = cr.via; provenance = cr.provenance; extraction = cExtraction;
        extractionFailedOnStage1Text = false;
      }
    } else {
      conversationalError = cr.error ?? 'conversational authority answered but named none of the options';
    }
  }

  if (!text) {
    const result: DiscriminatorResult = {
      ok: false, category, property, query, noKindStated: all, via: 'n/a',
      ...emptyDiscriminatorFields(),
      error: `no usable answer from any authority -- owned evidence: ${ownedCandidates.length} candidate(s) tried, none usable; `
        + `conversational authority: ${conversationalError ?? 'not tried'} -- THE DISCRIMINATOR is UNAVAILABLE, not "no kinds stated"`,
    };
    return { result, summary: summaryLine(OPT, result) };
  }
  if (!extraction || extractionFailedOnStage1Text) {
    const result: DiscriminatorResult = {
      ok: false, category, property, query, noKindStated: all, via,
      ...emptyDiscriminatorFields(),
      error: `extraction failed -- ${extraction?.extractionError ?? 'the local extraction model failed for an unclassified reason'} -- reported as a FAILURE, never an empty "no kinds stated"`,
    };
    return { result, summary: summaryLine(OPT, result) };
  }
  // D-BP154-021/BISHOP-SEG/S21/seg-mortgagetrap FIX -- same law, same session, applied here too:
  // "an owned passage that produces NO usable value has not answered the question." If BOTH
  // stages (owned evidence, then a fresh live query when Stage 1 was unproductive) still leave
  // NONE of THE DISCRIMINATOR's four outputs (no per-option kinds, no category-denoting kind, no
  // category-enumeration members, no property members), that is not a successful "no kinds
  // stated" finding -- it is THE DISCRIMINATOR failing to answer, and must be reported as an
  // honest failure, never credited as ok:true. (Kept ok:true when ANY output came through -- a
  // real, useful partial result, same "absence is omission for the others" reading this file's
  // own header already establishes.)
  if (!isProductive(extraction)) {
    const result: DiscriminatorResult = {
      ok: false, category, property, query, noKindStated: all, via,
      ...emptyDiscriminatorFields(),
      discardedKinds: extraction.discardedKinds, categoryKindDiscarded: extraction.categoryKindDiscarded,
      discardedPropertyMembers: extraction.discardedPropertyMembers,
      categoryEnumerationDiscarded: extraction.categoryEnumerationDiscarded,
      discardedCategoryEnumerationMembers: extraction.discardedCategoryEnumerationMembers,
      discardedSubregionNonMembers: extraction.discardedSubregionNonMembers,
      error: `no usable answer from any authority -- the credited passage (${via}) produced zero verified `
        + `kinds, no category-denoting kind, no category-enumeration members, no subregion-non-member `
        + `facts, and no property members (${extraction.discardedKinds + extraction.discardedPropertyMembers
        + extraction.discardedCategoryEnumerationMembers + extraction.discardedSubregionNonMembers} `
        + `candidate(s) discarded for no verifiable span) -- THE DISCRIMINATOR is UNAVAILABLE, not "no kinds stated"`,
    };
    return { result, summary: summaryLine(OPT, result) };
  }
  const {
    kinds, discardedKinds: discarded, categoryKind, categoryKindDiscarded, propertyMembers, discardedPropertyMembers,
    categoryEnumeration, categoryEnumerationDiscarded, categoryEnumerationMembers, discardedCategoryEnumerationMembers,
    subregionNonMembers, discardedSubregionNonMembers,
  } = extraction;
  const statedLetters = new Set(kinds.map((e) => e.letter));
  const noKindStated = all.filter((L) => !statedLetters.has(L));

  // STAGE 3: GOOGLE CORROBORATES A NAMED CLAIM -- ONE query, for the single decisive claim only.
  // D-BP154-023: prefers the category's own enumeration (the FD-BP154-06 decisive fact, when
  // productive -- corroborates the first option the enumeration excludes, the actual claim the
  // Terminator's own new elimination rule below will use); falls back to the category-denoting
  // kind, then the first per-option kind, when no productive enumeration was obtained.
  const enumeratedLetters = new Set(categoryEnumerationMembers.map((e) => e.letter));
  const firstEnumerationExcluded = categoryEnumerationMembers.length > 0
    ? all.find((L) => !enumeratedLetters.has(L))
    : undefined;
  let corroboration: CorroborationResult | undefined;
  // D-BP154-024/BISHOP-SEG/S24/seg-unstated FIX: the zoology-text false positive (Gutenberg
  // "Geographical Distribution of Animals" accepted as corroborating a world-regions enumeration
  // claim, purely for containing the substring "South America") happened on THIS branch --
  // `mustAppear` was a bare option name with no bearing on subject matter. `alsoMustAppear:
  // category` is a second, independent, mechanical (not similarity-scored) substring check: the
  // extracted span must ALSO contain the category string itself, or the candidate is rejected.
  // Also note (D-BP154-024): `firstEnumerationExcluded` no longer drives any Terminator
  // elimination -- deriveTerminatorEliminations() treats enumeration-absence as UNSTATED, never
  // DENIED (see terminator_step.ts). This corroboration call is retained as additive evidence
  // toward the "is this option a stated non-member" question ONLY; it is never wired to eliminate.
  if (firstEnumerationExcluded) {
    corroboration = await corroborateClaim(
      ctx,
      buildDiscriminatorEnumerationCorroborationQuery(category, optSafe[firstEnumerationExcluded]),
      optSafe[firstEnumerationExcluded],
      category,
    );
  } else if (categoryKind) {
    corroboration = await corroborateClaim(
      ctx, buildDiscriminatorCategoryKindCorroborationQuery(category, categoryKind), categoryKind.kind,
      category,
    );
  } else if (kinds.length) {
    corroboration = await corroborateClaim(
      ctx, buildDiscriminatorKindCorroborationQuery(kinds[0]), kinds[0].name,
      category,
    );
  }

  const result: DiscriminatorResult = {
    ok: true, category, property, query, kinds, discardedKinds: discarded, noKindStated,
    categoryKind, categoryKindDiscarded, propertyMembers, discardedPropertyMembers,
    categoryEnumeration, categoryEnumerationDiscarded, categoryEnumerationMembers, discardedCategoryEnumerationMembers,
    subregionNonMembers, discardedSubregionNonMembers,
    enumerationDisagreement: null,
    via, answerProvenance: provenance, corroboration,
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
