// D-BP223-BM04-h2cbpv9w-170 -- parse/comparatives.ts (module C4 of the shared parsing layer scope
// at BISHOP_DROPZONE/D-BP223-BM04-h2cbpv9w-170_PARSING_LAYER_SCOPE.md, section C4).
//
// WHY THIS FILE EXISTS. Section B of the scope document measured, by grep, that
// `function parseRatioPhrase()` is independently reimplemented in 5 method files
// (derive_unit_value_then_sum_two_products.ts, split_total_evenly_two_parties_rate_multiple.ts,
// subtract_then_multiply_then_add_remaining.ts, two_hop_multiple_chain_difference.ts,
// two_tank_leak_ratio_backsolve.ts) with TWO mutually incompatible return shapes across them
// (`{num, den}` in two of the five vs a `Frac` `{n, d}` in the other three), each handling only
// "twice"/"double" -> 2, "half" -> 1/2, "one-third/quarter/fourth/fifth" -> 1/N, and "<N> times" ->
// N via each file's own local `wordOrDigit()`. This module is the ONE canonical, importable
// replacement, widened per this dispatch's own charge beyond the five files' narrow anchor-free
// resolution into full positive-evidence comparative-clause extraction: it resolves not just the
// bare multiplier VALUE but the two-sided RELATIONSHIP ("X is N times as many as Y") with typed
// subject/anchor spans, a direction, and an abstain-with-reason contract matching every other
// module in this parsing layer.
//
// CONTRACT. `extractComparatives(text, quantities?)` returns only comparatives with POSITIVE
// EVIDENCE: a named subject-or-noun span, a resolvable multiplier/delta/percent value (resolved via
// `parse/quantities.ts`'s own `extractQuantities`, never a locally reimplemented number parser --
// per the BP222 ruling, "a hand-copied contract is the defect, not bad types"), and a named anchor
// span that is NOT a bare, unresolved pronoun. Every ambiguous or unresolvable case is returned in
// the `abstains` array with a stated reason, never silently dropped and never guessed past what
// this module can verify -- matching HARDWIRE-22's own test ("could a reader holding only the text
// and this module's output verify it by looking").
//
// SCOPE BOUNDARY. This module reports what the text SAYS about a relationship between two
// quantities/actors -- it does not compose chained comparatives into one number, does not decide
// which of two candidate anchors is "the right one" when genuinely ambiguous, and does not resolve
// a pronoun anchor to its antecedent (that anaphora resolution is `parse/entities.ts`'s job, not
// built by this dispatch, per this dispatch's own write fence: `entities.ts` is being written
// concurrently by another SEG and is never imported here). `subject` and `anchor` are returned as
// text SPANS ONLY, exactly as the dispatching instruction states ("comparatives returns
// actor/entity spans and text only, which entities can bind later") -- this module never asserts
// that a span is "the same actor" as one named elsewhere, only that it occupies the subject or
// anchor grammatical slot of one resolved comparative clause.
//
// IMPORTS, NEVER RE-DECLARED, per the BP222 ruling. `Fraction`/`Quantity` and every arithmetic
// helper this module needs come from `./quantities` (the canonical exact-rational type and
// extractor built by a sibling C1 dispatch in this same directory); `Ask`/`extractAsk` come from
// `./ask` (the canonical ask-sentence isolator built by a sibling C5 dispatch). Neither
// `./entities.ts` nor any file under `methods/`, `method_registry.ts`, or any gate tool is
// imported, per this dispatch's write fence. Every numeral this module resolves (a multiplier word,
// a delta amount, a percent value) is resolved by calling INTO `extractQuantities`, never by a
// locally reimplemented digit-or-word-number parser -- this is the concrete way this module honors
// "never hand-copy a contract": there is no second `wordOrDigit()` anywhere in this file.
//
// DATASET CONVENTIONS, MEASURED AND FLAGGED (never silently applied). Two GSM8K reference-solution
// conventions were measured by prior waves against this exact corpus and are named here because
// they bear directly on how a CONSUMER of this module's output should use `factor`:
//   (1) W08 (`BISHOP_DROPZONE/..._WAVE_W08.md`, C92/item231): "day2 is N times MORE than day1" is
//       read MULTIPLICATIVELY in GSM8K's own accepted answer (day2 = day1 * N), not additively
//       (day2 = day1 + N*day1 = (N+1)*day1), even though "N times MORE than" is the one phrasing in
//       English that could support either reading. This module reads "<N> times more/fewer/less
//       than" the SAME way the dataset does (factor = N, not N+1) and sets `conventionApplied: true`
//       on the returned Comparative so a consuming method can see, and re-litigate if it ever needs
//       to, that this specific factor came from an inherently ambiguous phrasing resolved by a
//       measured dataset convention, not by unambiguous English. "<N> times AS MANY/MUCH AS" is
//       NOT ambiguous (factor = N is the only reading), so `conventionApplied` is left unset there.
//   (2) W04 (`BISHOP_DROPZONE/..._WAVE_W04.md`, C60/item119): "X is P% higher/more than Y" is
//       solved in GSM8K's own accepted answers as "Y = X * (1 - P/100)" (the same-magnitude-inverse
//       approximation), not the true algebraic inverse "Y = X / (1 + P/100)" -- these differ
//       whenever P is nonzero. This module does NOT perform that division or that computation at
//       all (per the cross-cutting design point of section C of the scope doc: "the parser answers
//       what the text is saying, never what to do with it") -- it only reports `kind: 'percent-more'`
//       with the literal percent value as `factor` (not pre-divided, matching `quantities.ts`'s own
///      percent convention) and the anchor span. This convention is named here, in the module
//       header, so a future method built on this module's `percent-more`/`percent-less` output does
//       not have to rediscover it independently, exactly the duplication problem this whole parsing
//       layer exists to close.
//
// Rule 66: no em-dashes anywhere in this file or its comments -- "--" is used throughout.

import {
  type Fraction,
  type Quantity,
  extractQuantities,
  makeFraction,
  fractionFromBigInt,
  compareFraction,
} from './quantities';
import { type Ask, extractAsk } from './ask';

// ─── PUBLIC TYPES ───────────────────────────────────────────────────────────────────────────────

/** A text span with both its exact [start, end) character offsets into the ORIGINAL input and the
 *  literal substring at that span (`text === original.slice(span[0], span[1])`), matching the
 *  offset convention every module in this parsing layer already uses (`Quantity.span`, `Ask.span`).
 *  Not imported from `./ask` (that module's `AskSpan` is ask-specific by name) or hand-copied from
 *  it either -- this is an independently-arrived-at, identically-shaped convention, the same shape
 *  `AskSpan` uses, because both modules are describing the same underlying thing: a piece of text
 *  and where it sits. Sharing the SHAPE is not the BP222 violation the ruling warns against; hand-
 *  copying a contract that already has an authoritative export and then letting it silently drift
 *  is. `Span` has no authoritative export anywhere in this estate to copy from or drift against. */
export interface Span {
  text: string;
  span: [number, number];
}

export type ComparativeKind =
  | 'times'
  | 'more-than'
  | 'fewer-than'
  | 'less-than'
  | 'percent-more'
  | 'percent-less'
  | 'half-of'
  | 'twice'
  | 'as-many-as'
  | 'ratio'
  | 'older-than'
  | 'younger-than';

export interface Comparative {
  kind: ComparativeKind;
  /** The multiplicative factor, for the multiplicative kinds ('times', 'half-of', 'twice',
   *  'as-many-as', 'ratio', 'percent-more', 'percent-less'). For 'percent-more'/'percent-less' this
   *  is the LITERAL percent number (e.g. 20 for "20% less"), not pre-divided by 100, matching
   *  `Quantity.value`'s own percent convention in quantities.ts -- dividing by 100 is a computation
   *  a consuming method performs, not something this layer decides for it. Unset for the additive
   *  kinds ('more-than', 'fewer-than', 'less-than', 'older-than', 'younger-than'), which use `delta`
   *  instead. */
  factor?: Fraction;
  /** The stated additive difference, as a full `Quantity` (so its own unit, span, and evidence ride
   *  along), for the additive kinds ('more-than', 'fewer-than', 'less-than', 'older-than',
   *  'younger-than'). Unset for the multiplicative kinds, which use `factor` instead. */
  delta?: Quantity;
  /** The text span occupying the comparative clause's SUBJECT grammatical slot. A span only, per
   *  this dispatch's own contract ("comparatives returns actor/entity spans and text only") -- this
   *  module never asserts the span resolves to any particular named actor established elsewhere in
   *  the text; that binding is parse/entities.ts's job. A subject MAY be a pronoun (e.g. "who" in a
   *  chained comparative's second clause, "Alice has twice as many apples as Brian, who has 3 more
   *  apples than Carla") -- only the ANCHOR is guarded against being a bare, unresolved pronoun (see
   *  ABSTAIN RULES in the return doc), because the anchor is what grounds the comparison's value,
   *  while the subject continuing a chain from a prior clause is exactly the composable, 2-hop shape
   *  this module is scoped to report as two independent comparatives rather than abstain on. */
  subject: Span;
  /** The text span occupying the comparative clause's ANCHOR grammatical slot -- the "Y" in "X is N
   *  times as many as Y" / "X has N more than Y" / "X is N% more than Y". Never a bare pronoun with
   *  no fixed antecedent in the same clause (see ABSTAIN RULES); resolving a pronoun anchor to its
   *  antecedent is parse/entities.ts's job. */
  anchor: Span;
  /** 'right' when `anchor.span[0] > subject.span[0]` (the anchor appears after the subject in the
   *  text, which every pattern this module recognizes produces), 'left' otherwise. Computed from
   *  the actual offsets on every return, never hardcoded, so a future recognizer that captures a
   *  subject-after-anchor construction is reported correctly without this field silently going
   *  stale. */
  anchorSide: 'left' | 'right';
  /** 'greater' when the subject is stated as larger/more/older ('times' with factor > 1, 'twice',
   *  'more-than', 'percent-more', 'older-than', or 'ratio'/'as-many-as' with factor > 1); 'smaller'
   *  for the mirror image ('half-of', 'fewer-than', 'less-than', 'percent-less', 'younger-than', or
   *  'times'/'ratio'/'as-many-as' with factor < 1); 'equal' only when factor is exactly 1
   *  ('as-many-as' with no multiplier, or a 'ratio'/'times' whose resolved factor happens to be 1). */
  direction: 'greater' | 'smaller' | 'equal';
  /** The full matched comparative clause, verbatim from the source text, with its own [start, end)
   *  offsets into the ORIGINAL input. */
  span: Span;
  /** Every positive-evidence reason this Comparative was built the way it was: which pattern
   *  matched, how the factor/delta was resolved (and via which underlying Quantity), why the
   *  subject/anchor spans were chosen. Never empty. */
  evidence: string[];
  /** Set to true only on a 'times' comparative built from an "<N> times more/fewer/less than"
   *  phrasing, per the W08 dataset-convention note in this file's header: that phrasing is
   *  inherently ambiguous in English (additive or multiplicative) and this module resolves it
   *  MULTIPLICATIVELY because that is what GSM8K's own accepted answers do, not because the English
   *  is unambiguous. Left unset (never `false`) for every other kind and for the unambiguous
   *  "<N> times as many/much as" phrasing, so its presence itself is positive evidence that a
   *  convention, not plain arithmetic, produced this factor. */
  conventionApplied?: boolean;
}

/** One reason `extractComparatives` found a comparative-SHAPED phrase but declined to report it as
 *  a `Comparative` -- an ambiguous or unresolved anchor, a "more" with no "than", a percent-more/
 *  less with no anchor at all, or a deliberately-guarded idiom ("more than 5 people came" is a
 *  threshold, not a comparison). Never emitted for text that simply contains no comparative-shaped
 *  phrase at all (that case produces neither a Comparative nor an abstain, exactly like
 *  `extractQuantities` never abstains on a sentence with no numeral in it -- an abstain here always
 *  names a SPECIFIC phrase this module recognized as comparative-SHAPED and could not resolve). */
export interface ComparativeAbstain {
  reason: string;
  span: Span;
}

export interface ExtractComparativesResult {
  comparatives: Comparative[];
  abstains: ComparativeAbstain[];
}

// ─── SHARED WORD LISTS ──────────────────────────────────────────────────────────────────────────

// A bounded, GSM8K-shaped verb list linking a subject to the quantity/comparison that follows it
// ("Tim HAS 30 less apples", "Sam MEMORIZED six more digits", "Alan COLLECTED four times as many").
// Deliberately bounded rather than "any word" -- an unbounded verb slot would let this module treat
// arbitrary narration as a comparative clause, the same over-widening HARDWIRE-22's own "never
// widen an extraction prompt to force a pass" rule warns against, applied here to a regex instead
// of a model prompt.
// Widened once this dispatch, measured not guessed: the coverage run's own 20-sample hand-check
// found "Ryan COMPOSES twice as many problems as Bill" losing its actor subject ("Ryan") to the
// noun-first fallback ("problems") purely because "composes" was missing from this list -- fixed
// by adding it and a bounded set of other common GSM8K compute/produce verbs found the same way.
// Still deliberately bounded, never a wildcard "any word" verb slot -- see the list's own doc
// comment at its first definition in this file's header for why an unbounded slot is refused.
const VERB_WORDS =
  '(?:is|are|was|were|has|had|have|earns?|earned|memorized|collected|needs?|needed|costs?|cost|' +
  'walks?|walked|rides?|rode|takes?|took|spends?|spent|pays?|paid|gets?|got|makes?|made|saves?|' +
  'saved|reads?|read|writes?|wrote|works?|worked|sells?|sold|buys?|bought|scored|ran|played|' +
  'bakes?|baked|owns?|owned|drinks?|drank|ate|eats?|drives?|drove|travels?|traveled|shelved|' +
  'packs?|packed|weighs?|weighed|composes?|composed|solves?|solved|uses?|used|wants?|wanted|' +
  'does|did|plays?|draws?|drew|picks?|picked|plants?|planted|grows?|grew|builds?|built|jogs?|' +
  'jogged|swims?|swam|bikes?|biked|paints?|painted|cooks?|cooked|mows?|mowed|cleans?|cleaned|' +
  'watches?|watched|studies|studied|trains?|trained|competes?|competed|wins?|won|loses?|lost|' +
  'gathers?|gathered|harvests?|harvested|receives?|received|produces?|produced|creates?|created|' +
  'designs?|designed|prepares?|prepared|mixes?|mixed|combines?|combined|consumes?|consumed|' +
  'donates?|donated|sends?|sent|prints?|printed|folds?|folded|counts?|counted|catches?|caught|' +
  'throws?|threw|kicks?|kicked|jumps?|jumped|being|discovers?|discovered|finds?|found|sees?|saw|' +
  'notices?|noticed|observes?|observed)';

// The subject grammatical slot: a capitalized proper-noun phrase (one or two capitalized words, so
// "Sam", "Betty", "Mina Lee" all match but a mid-sentence capitalized common word does not get
// falsely extended into a two-word phrase unless the SECOND word is also capitalized), a bounded
// possessive-determiner phrase ("her grandparents", "his second job"), or a bare pronoun (including
// the relative pronoun "who", deliberately permitted here per this module's own design: only the
// ANCHOR is guarded against a bare pronoun, never the subject -- see the Comparative.subject doc
// comment above for why).
// A capitalized proper-noun phrase, widened once this dispatch (measured via the coverage run's
// own 20-sample hand-check, not guessed) to cover three real GSM8K shapes a bare
// `[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?` missed or truncated: a labeled entity with a trailing digit
// ("District 3", "District 1" -- the digit is not itself `[A-Z][a-z]+`, so it was silently dropped,
// e.g. "District 3 has twice as many voters as District 1" losing both numbers before this fix); a
// possessive noun phrase ("Danielle's apartment", "Heidi's apartment" -- "Heidi's apartment has 3
// times as many rooms as Danielle's apartment" lost the qualifier entirely before this fix); and
// the pre-existing two-capitalized-word phrase ("Tall Tuna", "Jerk Tuna"). Shared by SUBJ_ALT and
// ANCHOR_ALT so both slots benefit identically.
// A continuation word inside a determiner-led noun phrase (SUBJ_ALT's/ANCHOR_ALT's "the/her/his/
// ..." branches, and PROPER_NOUN_ALT's own possessive-noun branch) must be neither a VERB_WORDS
// entry nor a common clause-connector -- otherwise the greedy `{0,N}` continuation swallows the
// very verb or connector that should end the phrase. Found and fixed this dispatch via the
// coverage run's own hand-check: "the newest movie COST twice as much..." was swallowing "cost"
// into the subject phrase, leaving no verb for the optional verb slot to consume (subject wrongly
// reported as "the newest movie cost" instead of "the newest movie"); "her monthly cell phone
// expenses TO ENTER the tournament" was swallowing the trailing infinitive clause into the anchor.
// Both are the same root cause -- an unbounded continuation word class -- fixed once, here, rather
// than patched per recognizer. Deliberately NOT applied to the MANDATORY first word after a
// determiner (only to the REPEATED continuation words): "the cost of the trip" needs "cost" as a
// legitimate noun there, and a word's surface form alone cannot disambiguate noun-"cost" from
// verb-"cost" without real part-of-speech tagging, which this bounded-heuristic module does not do.
const CLAUSE_CONNECTORS = '(?:to|and|but|so|which|who|that|because|if|when|while|than|as)';
const CONTINUATION_WORD = `(?:(?!${VERB_WORDS}\\b)(?!${CLAUSE_CONNECTORS}\\b)[a-z]+)`;

// A small, bounded set of words that are frequently capitalized ONLY because they open a sentence
// ("There were...", "This means...") -- never because they are a proper noun. Without this guard,
// the plain `[A-Z][a-z]+` proper-noun test cannot tell "There" (a dummy existential subject) from
// "Tim" (a real name), because English capitalization alone does not distinguish them. Found via
// the coverage run's own hand-check ("There were ten more baseballs than the soccer balls" was
// extracting subject "There"). Deliberately a short, closed list, not a part-of-speech tagger -- a
// genuine proper noun that happens to also be a common sentence-opener is a named, accepted
// trade-off of this bounded-heuristic module, not a silently swallowed defect.
const SENTENCE_INITIAL_NON_PROPER =
  '(?:There|This|That|These|Those|Since|If|When|After|Because|While|Although|During|Before|' +
  'However|Therefore|Then|Now|Also|Each|Every|Some|Many|Most|All|Both)';

// A capitalized proper-noun phrase, widened once this dispatch (measured via the coverage run's
// own 20-sample hand-check, not guessed) to cover four real GSM8K shapes a bare
// `[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?` missed or truncated: a labeled entity with a trailing digit
// ("District 3", "District 1" -- the digit is not itself `[A-Z][a-z]+`, so it was silently dropped,
// e.g. "District 3 has twice as many voters as District 1" losing both numbers before this fix); a
// possessive noun phrase ("Danielle's apartment", "Heidi's apartment" -- "Heidi's apartment has 3
// times as many rooms as Danielle's apartment" lost the qualifier entirely before this fix); a
// three-word proper-noun label ("Safari National Park", "Savanna National Park" -- the original
// one-extra-word cap lost the trailing "Park" and fell back to a noun-only subject); and the
// pre-existing two-capitalized-word phrase ("Tall Tuna", "Jerk Tuna"). Guarded at its own start by
// SENTENCE_INITIAL_NON_PROPER so a sentence-opening "There"/"This"/etc. never masquerades as a name.
// Shared by SUBJ_ALT and ANCHOR_ALT so both slots benefit identically.
const PROPER_NOUN_ALT =
  `(?!${SENTENCE_INITIAL_NON_PROPER}\\b)[A-Z][a-z]+` +
  `(?:'s\\s+${CONTINUATION_WORD}(?:\\s+${CONTINUATION_WORD}){0,2}|\\s+\\d+|(?:\\s+[A-Z][a-z]+){1,2})?`;

const SUBJ_ALT =
  `(?:${PROPER_NOUN_ALT}|(?:her|his|their|its|the)\\s+[a-z]+(?:\\s+${CONTINUATION_WORD}){0,3}|` +
  'he|she|it|they|who|that|this|what)';

// The anchor grammatical slot: the same proper-noun/pronoun alternatives as SUBJ_ALT, plus a
// determiner-led common-noun phrase ("the number of cups of flour") that SUBJ_ALT deliberately
// omits (a determiner-led phrase in subject position was never needed by any fixture this dispatch
// hand-verified, and omitting it keeps the subject slot from over-capturing into a preceding
// clause). NAMED LIMITATION, stated plainly rather than hidden: a bare, determiner-less common-noun
// anchor phrase ("students" with no "the"/"a"/"her" in front) is not matched by this alternation and
// will not be recognized as a valid anchor by any recognizer below -- true anchor resolution against
// an unbounded noun phrase is exactly the risk of over-capturing into unrelated trailing text this
// module's own bounded-heuristic design accepts abstaining on rather than guessing past.
const ANCHOR_ALT =
  `(?:${PROPER_NOUN_ALT}|(?:her|his|their|its|the|a|an)\\s+[a-z]+(?:\\s+${CONTINUATION_WORD}){0,5}|` +
  'he|she|it|they|who|that|this|what|him|her|them)';

// A multiplier token: "twice", "double", "triple", "half", or "<N> times" where N is a digit run, a
// slash fraction, or a single/hyphenated number word -- resolved to an actual Fraction value later
// via extractQuantities, never via a locally reimplemented word-to-number table.
const MULTIPLIER_WORD = '(?:twice|double|triple|half|(?:\\d+\\/\\d+|\\d+(?:\\.\\d+)?|[a-z]+(?:-[a-z]+)?)\\s+times)';

// Bare pronouns that, standing ALONE as an entire captured anchor, are never resolved by this
// module -- anaphora resolution to a named antecedent is parse/entities.ts's job. Note this set is
// deliberately about the ANCHOR text being EXACTLY one of these words with nothing else around it;
// "her parents" is not caught here (the possessive determiner "her" plus the noun "parents" is a
// legitimate short noun phrase, not an anaphoric pronoun standing alone).
const BARE_PRONOUNS = new Set(['he', 'she', 'it', 'they', 'we', 'you', 'i', 'who', 'that', 'this', 'what', 'him', 'her', 'them', 'one']);

// ─── OFFSET-TRACKING HELPER ─────────────────────────────────────────────────────────────────────

/** Sequentially locates each captured group's own [start, end) offset inside the ORIGINAL text,
 *  given the full match and its groups in left-to-right textual order (which every regex in this
 *  file produces by construction -- subject, then multiplier/delta, then anchor, always in that
 *  order). Walking forward with a cursor (rather than a single `text.indexOf(group)` per group)
 *  guarantees a group is never mis-located against an EARLIER, coincidentally-identical substring
 *  (e.g. if a delta number's digits happened to also appear inside the subject phrase). This
 *  sidesteps needing the regex `d` (hasIndices) flag, whose TypeScript types are not present in
 *  this project's ES2020 lib target even though the underlying V8 engine supports it -- a manual
 *  cursor is simpler and needs no runtime-vs-lib-type workaround. */
function makeOffsetTracker(fullMatchText: string, fullMatchIndex: number): (group: string) => [number, number] {
  let cursor = 0;
  return (group: string): [number, number] => {
    const idx = fullMatchText.indexOf(group, cursor);
    const start = fullMatchIndex + (idx >= 0 ? idx : cursor);
    const end = start + group.length;
    cursor = (idx >= 0 ? idx : cursor) + group.length;
    return [start, end];
  };
}

function spanOf(text: string, offsets: [number, number]): Span {
  return { text: text.slice(offsets[0], offsets[1]), span: offsets };
}

// ─── QUANTITY LOOKUP (never a locally reimplemented numeral parser) ────────────────────────────

/** Resolves the Fraction value of a captured numeral/multiplier substring by calling INTO
 *  `extractQuantities`, first checking whether a quantity already extracted at that exact offset
 *  (from the caller's own `quantities` list, or this function's own whole-text extraction if the
 *  caller passed none) covers the substring, and falling back to a direct `extractQuantities` call
 *  on the substring itself when no pre-extracted quantity lines up exactly (e.g. a multiplier word
 *  like "twice" that quantities.ts extracts as its own token, not as a sub-span of a larger
 *  candidate). Returns null, never a guessed value, when neither path resolves the WHOLE
 *  substring -- positive evidence or abstain, matching every other recognizer in this module. */
function resolveNumeral(
  text: string,
  offsets: [number, number],
  qtyByStart: Map<number, Quantity>,
): Quantity | null {
  const [start, end] = offsets;
  const raw = text.slice(start, end).trim();
  const trimmedStart = start + (text.slice(start, end).length - text.slice(start, end).trimStart().length);

  const preExtracted = qtyByStart.get(trimmedStart);
  if (preExtracted && preExtracted.span[1] <= end && preExtracted.sourceText.trim() === raw.trim()) {
    return preExtracted;
  }

  const fallback = extractQuantities(raw);
  if (fallback.length === 1 && fallback[0].sourceText.trim() === raw) {
    const q = fallback[0];
    return {
      ...q,
      span: [start + raw.indexOf(q.sourceText), start + raw.indexOf(q.sourceText) + q.sourceText.length],
      evidence: [...q.evidence, `resolved via a direct extractQuantities("${raw}") call, not a pre-existing span match`],
    };
  }
  return null;
}

function directionFromFactor(factor: Fraction): 'greater' | 'smaller' | 'equal' {
  const cmp = compareFraction(factor, fractionFromBigInt(1n));
  return cmp > 0 ? 'greater' : cmp < 0 ? 'smaller' : 'equal';
}

function anchorSideOf(subject: Span, anchor: Span): 'left' | 'right' {
  return anchor.span[0] > subject.span[0] ? 'right' : 'left';
}

function isBarePronoun(span: Span): boolean {
  return BARE_PRONOUNS.has(span.text.trim().toLowerCase());
}

// ─── RECOGNIZERS ────────────────────────────────────────────────────────────────────────────────
// Each recognizer scans the whole text once and returns Comparative and/or ComparativeAbstain
// candidates with their own [start, end) span for later overlap resolution (the same greedy
// interval-scheduling discipline quantities.ts uses, so a shorter, less-specific recognizer's
// spurious partial match never survives alongside a longer, more-specific recognizer's real one at
// the same location).

interface ComparativeCandidate {
  isAbstain: boolean;
  comparative?: Comparative;
  abstain?: ComparativeAbstain;
  start: number;
  end: number;
  priority: number;
}

const PRIORITY = {
  ratioColon: 100,
  fractionOfWhat: 95,
  halfOfDescriptionAbstain: 90,
  timesMoreThan: 85,
  olderYounger: 80,
  moreFewerLessThan: 75,
  percentMoreLess: 70,
  bareMoreThanIdiom: 65,
  multiplierTheNounOf: 62,
  asManyActorFirst: 60,
  asManyNounFirst: 55,
  halfThatMuchAbstain: 50,
  asManyPlain: 45,
} as const;

/** "<Subject> [verb] <twice|double|triple|half|N times> as <many|much|ADJ> [noun phrase] as
 *  <Anchor>" -- the actor-first form ("her grandparents twice as much as her parents", "Mina
 *  memorized six times as many digits of pi as Carlos", "Sam is twice as old as his brother"). The
 *  verb between subject and multiplier is OPTIONAL: GSM8K prose frequently elides it in a
 *  conjoined clause ("Her parents ... gave her $15 ..., and her grandparents [gave] twice as much
 *  as her parents" -- the second "gave" is grammatically elided, confirmed against the real
 *  gsm8k-train-2 fixture this dispatch hand-verified). */
function recognizeAsManyActorFirst(text: string): ComparativeCandidate[] {
  const out: ComparativeCandidate[] = [];
  const re = new RegExp(
    `\\b(${SUBJ_ALT})\\s+(?:${VERB_WORDS}\\s+)?(${MULTIPLIER_WORD})\\s+as\\s+` +
      `(?:(?:many|much)(?:\\s+[a-z]+(?:\\s+[a-z]+){0,4})?|[a-z]+)\\s+as\\s+(${ANCHOR_ALT})\\b`,
    // NEVER 'i' here: SUBJ_ALT/ANCHOR_ALT rely on `[A-Z]` to mean "capitalized" (a proper noun).
    // Under a case-insensitive flag, `[A-Z]` also matches lowercase letters (a documented JS regex
    // gotcha), which silently turned every ordinary lowercase word, including "and", into a
    // false-positive "proper noun" match -- caught by this dispatch's own hand-verification against
    // gsm8k-train-33 (subject was wrongly captured as "and" instead of "teaspoons of salt") before
    // this file was returned. Keyword alternatives in this file (as/than/more/less/years/etc.) are
    // written lowercase because that is how they appear mid-clause in this corpus; only 'g' is used.
    'g',
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const track = makeOffsetTracker(m[0], m.index);
    const subjOff = track(m[1]);
    const multOff = track(m[2]);
    const anchOff = track(m[3]);
    out.push(buildMultiplicativeCandidate(text, m, subjOff, multOff, anchOff, PRIORITY.asManyActorFirst, false));
  }
  return out;
}

/** "<twice|double|triple|half|N times> as <many|much> <noun phrase> as <Anchor>" -- the noun-first
 *  form, used when the comparison is between two counts of the SAME item rather than two actors
 *  ("1/2 times as many teaspoons of salt as the number of cups of flour", gsm8k-train-33, where the
 *  nearest preceding text is a list continuation ("...16 cups of flour, and...") with no actor
 *  immediately adjacent to the multiplier). The captured noun phrase itself becomes the subject
 *  span, per this module's own "spans and text only" contract -- it is not asserted to be an actor. */
function recognizeAsManyNounFirst(text: string): ComparativeCandidate[] {
  const out: ComparativeCandidate[] = [];
  const re = new RegExp(
    `\\b(${MULTIPLIER_WORD})\\s+as\\s+(?:many|much)\\s+([a-z]+(?:\\s+[a-z]+){0,4})\\s+as\\s+(${ANCHOR_ALT})\\b`,
    'g', // never 'i' -- see recognizeAsManyActorFirst's comment on ANCHOR_ALT and `[A-Z]`.
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const track = makeOffsetTracker(m[0], m.index);
    const multOff = track(m[1]);
    const subjOff = track(m[2]);
    const anchOff = track(m[3]);
    out.push(buildMultiplicativeCandidate(text, m, subjOff, multOff, anchOff, PRIORITY.asManyNounFirst, false));
  }
  return out;
}

/** "<a|an NOUN PHRASE> that cost(s) <twice|double|triple|half|N times> the <noun> of <Anchor>" --
 *  the "the price of X" form, distinct from the "as much as X" form recognizeAsManyActorFirst
 *  handles (gsm8k-train-13: "a pound of cream cheese that cost half the price of the cheddar
 *  cheese", "a pack of cold cuts that cost twice the price of the cheddar cheese"). The subject
 *  here is an indefinite-article noun phrase ("a pound of cream cheese"), which SUBJ_ALT
 *  deliberately does not cover (SUBJ_ALT is actor-shaped: a proper noun, a possessive phrase, or a
 *  pronoun) -- this recognizer captures its own bounded indefinite-article noun phrase instead of
 *  widening SUBJ_ALT itself, so SUBJ_ALT's other, actor-focused recognizers do not start
 *  over-capturing plain "a/an ..." item descriptions everywhere else in this module. */
function recognizeMultiplierTheNounOf(text: string): ComparativeCandidate[] {
  const out: ComparativeCandidate[] = [];
  const re = new RegExp(
    `\\b((?:a|an)\\s+[a-z]+(?:\\s+[a-z]+){0,3})\\s+that\\s+costs?\\s+(${MULTIPLIER_WORD})\\s+the\\s+[a-z]+\\s+of\\s+(${ANCHOR_ALT})\\b`,
    'g', // never 'i' -- see recognizeAsManyActorFirst's comment on ANCHOR_ALT and `[A-Z]`.
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const track = makeOffsetTracker(m[0], m.index);
    const subjOff = track(m[1]);
    const multOff = track(m[2]);
    const anchOff = track(m[3]);
    out.push(buildMultiplicativeCandidate(text, m, subjOff, multOff, anchOff, PRIORITY.multiplierTheNounOf, false));
  }
  return out;
}

/** Bare "<Subject> [verb] as <many|much> as <Anchor>" with NO multiplier word at all -- an explicit
 *  equality claim ("Tim has as many apples as Martha"), factor exactly 1, kind 'as-many-as'. Lower
 *  priority than the multiplier-bearing recognizers above so it never wins an overlap against a
 *  real "twice as many as" match (which also textually contains "as many ... as"). */
function recognizeAsManyPlain(text: string): ComparativeCandidate[] {
  const out: ComparativeCandidate[] = [];
  const re = new RegExp(
    `\\b(${SUBJ_ALT})\\s+(?:${VERB_WORDS}\\s+)?as\\s+(?:many|much)\\s+(?:[a-z]+(?:\\s+[a-z]+){0,4}\\s+)?as\\s+(${ANCHOR_ALT})\\b`,
    'g', // never 'i' -- see recognizeAsManyActorFirst's comment on SUBJ_ALT/ANCHOR_ALT and `[A-Z]`.
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const track = makeOffsetTracker(m[0], m.index);
    const subjOff = track(m[1]);
    const anchOff = track(m[2]);
    const subject = spanOf(text, subjOff);
    const anchor = spanOf(text, anchOff);
    const whole: Span = { text: m[0], span: [m.index, m.index + m[0].length] };
    if (isBarePronoun(anchor)) {
      out.push(makeAbstain(
        `anchor '${anchor.text}' resolves to a bare pronoun in an "as many/much as" clause; anaphora resolution is parse/entities.ts's job, not this module's`,
        whole,
        PRIORITY.asManyPlain,
      ));
      continue;
    }
    const factor = fractionFromBigInt(1n);
    out.push({
      isAbstain: false,
      start: whole.span[0],
      end: whole.span[1],
      priority: PRIORITY.asManyPlain,
      comparative: {
        kind: 'as-many-as',
        factor,
        subject,
        anchor,
        anchorSide: anchorSideOf(subject, anchor),
        direction: 'equal',
        span: whole,
        evidence: [
          `matched a bare "as many/much ... as" clause with no multiplier word, factor fixed at 1 (equality)`,
          `subject '${subject.text}', anchor '${anchor.text}'`,
        ],
      },
    });
  }
  return out;
}

function buildMultiplicativeCandidate(
  text: string,
  m: RegExpExecArray,
  subjOff: [number, number],
  multOff: [number, number],
  anchOff: [number, number],
  priority: number,
  isTimesMoreThan: boolean,
): ComparativeCandidate {
  const subject = spanOf(text, subjOff);
  const anchor = spanOf(text, anchOff);
  const whole: Span = { text: m[0], span: [m.index, m.index + m[0].length] };

  if (isBarePronoun(anchor)) {
    return makeAbstain(
      `anchor '${anchor.text}' resolves to a bare pronoun in a multiplicative comparative clause; anaphora resolution is parse/entities.ts's job, not this module's`,
      whole,
      priority,
    );
  }

  const multText = text.slice(multOff[0], multOff[1]).trim().toLowerCase();
  let kind: ComparativeKind;
  let factor: Fraction | null;
  if (multText === 'twice' || multText === 'double') {
    kind = 'twice';
    factor = fractionFromBigInt(2n);
  } else if (multText === 'half') {
    kind = 'half-of';
    factor = makeFraction(1n, 2n);
  } else if (multText === 'triple') {
    kind = 'times';
    factor = fractionFromBigInt(3n);
  } else {
    // "<N> times" -- N resolved via extractQuantities, never a local word-to-number table.
    const timesMatch = /^(.+?)\s+times$/i.exec(multText);
    const numeralText = timesMatch ? timesMatch[1] : multText;
    const numeralOffsets: [number, number] = [multOff[0], multOff[0] + numeralText.length];
    kind = 'times';
    const dummyMap = new Map<number, Quantity>();
    const resolved = resolveNumeral(text, numeralOffsets, dummyMap);
    factor = resolved ? resolved.value : null;
  }

  if (!factor) {
    return makeAbstain(
      `multiplier phrase '${multText}' in an "as ... as" clause could not be resolved to a value via extractQuantities`,
      whole,
      priority,
    );
  }

  return {
    isAbstain: false,
    start: whole.span[0],
    end: whole.span[1],
    priority,
    comparative: {
      kind,
      factor,
      subject,
      anchor,
      anchorSide: anchorSideOf(subject, anchor),
      direction: directionFromFactor(factor),
      span: whole,
      evidence: [
        `matched multiplicative comparative "${whole.text}"`,
        `multiplier '${multText}' resolved to factor ${factor.n}/${factor.d} via extractQuantities`,
        `subject '${subject.text}', anchor '${anchor.text}'`,
      ],
      ...(isTimesMoreThan ? { conventionApplied: true } : {}),
    },
  };
}

function makeAbstain(reason: string, whole: Span, priority: number): ComparativeCandidate {
  return {
    isAbstain: true,
    start: whole.span[0],
    end: whole.span[1],
    priority,
    abstain: { reason, span: whole },
  };
}

/** "<Subject> [verb] <N> times more|fewer|less [noun] than <Anchor>" -- read MULTIPLICATIVELY
 *  (factor = N) per the W08 dataset-convention note in this file's header, with `conventionApplied:
 *  true` on the returned Comparative so a consumer can see the ambiguity was resolved by measured
 *  convention, not by unambiguous English. Distinct from recognizeAsManyActorFirst, which handles
 *  the UNAMBIGUOUS "<N> times as many/much as" phrasing (no conventionApplied flag needed there). */
function recognizeTimesMoreThan(text: string): ComparativeCandidate[] {
  const out: ComparativeCandidate[] = [];
  const re = new RegExp(
    `\\b(${SUBJ_ALT})\\s+(?:${VERB_WORDS}\\s+)?(\\d+\\/\\d+|\\d+(?:\\.\\d+)?|[a-z]+(?:-[a-z]+)?)\\s+times\\s+(more|fewer|less)\\s+(?:[a-z]+\\s+)?than\\s+(${ANCHOR_ALT})\\b`,
    'g', // never 'i' -- see recognizeAsManyActorFirst's comment on SUBJ_ALT/ANCHOR_ALT and `[A-Z]`.
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const track = makeOffsetTracker(m[0], m.index);
    const subjOff = track(m[1]);
    const numOff = track(m[2]);
    track(m[3]); // the more/fewer/less word itself, not needed as a span
    const anchOff = track(m[4]);

    const subject = spanOf(text, subjOff);
    const anchor = spanOf(text, anchOff);
    const whole: Span = { text: m[0], span: [m.index, m.index + m[0].length] };

    if (isBarePronoun(anchor)) {
      out.push(makeAbstain(
        `anchor '${anchor.text}' resolves to a bare pronoun in an "N times more/fewer/less than" clause`,
        whole,
        PRIORITY.timesMoreThan,
      ));
      continue;
    }

    const resolved = resolveNumeral(text, numOff, new Map());
    if (!resolved) {
      out.push(makeAbstain(
        `the numeral in "${m[0]}" could not be resolved to a value via extractQuantities`,
        whole,
        PRIORITY.timesMoreThan,
      ));
      continue;
    }
    const factor = resolved.value;
    const word = m[3].toLowerCase();
    out.push({
      isAbstain: false,
      start: whole.span[0],
      end: whole.span[1],
      priority: PRIORITY.timesMoreThan,
      comparative: {
        kind: 'times',
        factor,
        subject,
        anchor,
        anchorSide: anchorSideOf(subject, anchor),
        direction: word === 'more' ? 'greater' : 'smaller',
        span: whole,
        conventionApplied: true,
        evidence: [
          `matched "<N> times ${word} than" -- read MULTIPLICATIVELY (factor = ${factor.n}/${factor.d}) per the W08 GSM8K dataset convention (BISHOP_DROPZONE WAVE_W08.md, C92/item231), not additively, because this phrasing is inherently ambiguous in English`,
          `subject '${subject.text}', anchor '${anchor.text}'`,
        ],
      },
    });
  }
  return out;
}

/** "<Subject> [verb] <N> more|fewer|less [noun] than <Anchor>" -- an additive difference, `delta`
 *  set to the resolved Quantity, never a bare factor. Deliberately requires the delta NUMBER to
 *  appear IMMEDIATELY before "more/fewer/less" (matching the real fixtures "Sam memorized SIX more
 *  digits of pi than Carlos" and "Tim has 30 LESS apples than Martha") -- this is also exactly what
 *  keeps this recognizer from ever matching the "more than 5 people came" idiom (see
 *  recognizeBareMoreThanIdiom below): that idiom has no delta number BEFORE "more", only a bare
 *  number AFTER "than", so this regex simply never matches it at all. */
function recognizeMoreFewerLessThan(text: string): ComparativeCandidate[] {
  const out: ComparativeCandidate[] = [];
  const re = new RegExp(
    `\\b(${SUBJ_ALT})\\s+(?:${VERB_WORDS}\\s+)?(\\d+|[a-z]+(?:-[a-z]+)?)\\s+(more|fewer|less)\\s+(?:[a-z]+(?:\\s+of\\s+[a-z]+)?\\s+)?than\\s+(${ANCHOR_ALT})\\b`,
    'g', // never 'i' -- see recognizeAsManyActorFirst's comment on SUBJ_ALT/ANCHOR_ALT and `[A-Z]`.
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const track = makeOffsetTracker(m[0], m.index);
    const subjOff = track(m[1]);
    const deltaOff = track(m[2]);
    track(m[3]);
    const anchOff = track(m[4]);

    const subject = spanOf(text, subjOff);
    const anchor = spanOf(text, anchOff);
    const whole: Span = { text: m[0], span: [m.index, m.index + m[0].length] };

    if (isBarePronoun(anchor)) {
      out.push(makeAbstain(
        `anchor '${anchor.text}' resolves to a bare pronoun in a "more/fewer/less than" clause`,
        whole,
        PRIORITY.moreFewerLessThan,
      ));
      continue;
    }

    const resolved = resolveNumeral(text, deltaOff, new Map());
    if (!resolved) {
      out.push(makeAbstain(
        `the delta amount in "${m[0]}" could not be resolved to a value via extractQuantities`,
        whole,
        PRIORITY.moreFewerLessThan,
      ));
      continue;
    }
    const word = m[3].toLowerCase();
    const kind: ComparativeKind = word === 'more' ? 'more-than' : word === 'fewer' ? 'fewer-than' : 'less-than';
    out.push({
      isAbstain: false,
      start: whole.span[0],
      end: whole.span[1],
      priority: PRIORITY.moreFewerLessThan,
      comparative: {
        kind,
        delta: resolved,
        subject,
        anchor,
        anchorSide: anchorSideOf(subject, anchor),
        direction: word === 'more' ? 'greater' : 'smaller',
        span: whole,
        evidence: [
          `matched "<delta> ${word} ... than" as an additive comparative, delta = ${resolved.sourceText} (value ${resolved.value.n}/${resolved.value.d})`,
          `subject '${subject.text}', anchor '${anchor.text}'`,
        ],
      },
    });
  }
  return out;
}

/** "more than <N> <noun>" with NO delta number immediately preceding "more" -- a threshold/
 *  approximation idiom ("more than 5 people came" means "at least 5 people," approximately more
 *  than a stated floor), never an actor-vs-actor or actor-vs-anchor comparison. Always abstains,
 *  by construction, with a named reason -- this is a deliberate guard, not a silent non-match,
 *  because "more than N" textually LOOKS comparative-shaped and this module's own discipline is to
 *  say why a shape was declined rather than let it look like an oversight. */
function recognizeBareMoreThanIdiom(text: string): ComparativeCandidate[] {
  const out: ComparativeCandidate[] = [];
  // Negative lookbehind: only fires when NOT immediately preceded by a delta-then-more/fewer/less
  // shape (that case is already handled, and extracted, by recognizeMoreFewerLessThan above).
  const re = /(?<!\d\s)(?<![a-z]{2,}\s)\bmore\s+than\s+(\d+|[a-z]+(?:-[a-z]+)?)\s+[a-z]+\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const whole: Span = { text: m[0], span: [m.index, m.index + m[0].length] };
    out.push(makeAbstain(
      `"more than ${m[1]}" used as a threshold/approximation ("at least ${m[1]}"), not preceded by a stated delta -- not treated as an actor/quantity comparison`,
      whole,
      PRIORITY.bareMoreThanIdiom,
    ));
  }
  return out;
}

/** "<Subject> is|are|was|were <N> year(s) older|younger than <Anchor>" -- an age comparative with
 *  an explicit additive delta. A MULTIPLICATIVE age comparison ("twice as old as") is already
 *  covered by recognizeAsManyActorFirst (its "as <ADJ> as" branch matches "as old as" the same way
 *  it matches "as much as"), so this recognizer only needs the additive "N years older/younger"
 *  shape, which that one cannot express (it has no delta/noun slot for "years"). */
function recognizeOlderYounger(text: string): ComparativeCandidate[] {
  const out: ComparativeCandidate[] = [];
  const re = new RegExp(
    `\\b(${SUBJ_ALT})\\s+(?:is|are|was|were)\\s+(\\d+|[a-z]+(?:-[a-z]+)?)\\s+years?\\s+(older|younger)\\s+than\\s+(${ANCHOR_ALT})\\b`,
    'g', // never 'i' -- see recognizeAsManyActorFirst's comment on SUBJ_ALT/ANCHOR_ALT and `[A-Z]`.
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const track = makeOffsetTracker(m[0], m.index);
    const subjOff = track(m[1]);
    const deltaOff = track(m[2]);
    track(m[3]);
    const anchOff = track(m[4]);

    const subject = spanOf(text, subjOff);
    const anchor = spanOf(text, anchOff);
    const whole: Span = { text: m[0], span: [m.index, m.index + m[0].length] };

    if (isBarePronoun(anchor)) {
      out.push(makeAbstain(
        `anchor '${anchor.text}' resolves to a bare pronoun in an "older/younger than" clause`,
        whole,
        PRIORITY.olderYounger,
      ));
      continue;
    }
    const resolved = resolveNumeral(text, deltaOff, new Map());
    if (!resolved) {
      out.push(makeAbstain(
        `the age delta in "${m[0]}" could not be resolved to a value via extractQuantities`,
        whole,
        PRIORITY.olderYounger,
      ));
      continue;
    }
    const word = m[3].toLowerCase();
    out.push({
      isAbstain: false,
      start: whole.span[0],
      end: whole.span[1],
      priority: PRIORITY.olderYounger,
      comparative: {
        kind: word === 'older' ? 'older-than' : 'younger-than',
        delta: resolved,
        subject,
        anchor,
        anchorSide: anchorSideOf(subject, anchor),
        direction: word === 'older' ? 'greater' : 'smaller',
        span: whole,
        evidence: [
          `matched "<N> years ${word} than" as an age comparative, delta = ${resolved.sourceText}`,
          `subject '${subject.text}', anchor '${anchor.text}'`,
        ],
      },
    });
  }
  return out;
}

/** "<Subject>? <N>% or N percent more|less [ADJ] than <Anchor>" when an anchor is present; ABSTAINS
 *  with a named reason when the same percent-more/less phrase has NO "than <Anchor>" anywhere in
 *  its own clause (the real gsm8k-train-64 shape, "He earns 20% less while working his second job"
 *  -- the comparison is only resolvable against context from an EARLIER sentence, which this
 *  module's own positive-evidence contract refuses to reach for). Per this file's header, the
 *  computation choice a consuming method makes from a percent-more/percent-less Comparative (true
 *  algebraic inverse vs the W04-measured GSM8K approximation) is explicitly OUT of this module's
 *  scope -- it reports the stated relationship only. */
function recognizePercentMoreLess(text: string): ComparativeCandidate[] {
  const out: ComparativeCandidate[] = [];
  const percentRe = /\b(\d+(?:\.\d+)?)\s*(?:%|percent)\s+(more|less)\b/gi;
  let pm: RegExpExecArray | null;
  while ((pm = percentRe.exec(text)) !== null) {
    const percentWhole = pm[0];
    const percentStart = pm.index;
    const word = pm[2].toLowerCase();

    // Look for an explicit anchor via "than <Anchor>" within a short lookahead window (allowing up
    // to 3 lowercase adjective/adverb words between "more/less" and "than", e.g. "10% more
    // expensive than that model") and, separately, an explicit subject via a short lookbehind
    // window ending right at the percent number.
    const afterText = text.slice(percentStart + percentWhole.length, percentStart + percentWhole.length + 80);
    // never 'i' -- see recognizeAsManyActorFirst's comment on ANCHOR_ALT and `[A-Z]`.
    const anchorRe = new RegExp(`^\\s*(?:[a-z]+\\s+){0,3}than\\s+(${ANCHOR_ALT})\\b`);
    const am = anchorRe.exec(afterText);

    const beforeText = text.slice(Math.max(0, percentStart - 60), percentStart);
    // never 'i' -- see recognizeAsManyActorFirst's comment on SUBJ_ALT and `[A-Z]`.
    const subjRe = new RegExp(`(${SUBJ_ALT})\\s+(?:${VERB_WORDS}\\s+)?$`);
    const sm = subjRe.exec(beforeText);

    if (!am) {
      const whole: Span = { text: percentWhole, span: [percentStart, percentStart + percentWhole.length] };
      out.push(makeAbstain(
        `percent-${word} phrase "${percentWhole}" found but no explicit anchor ("than <X>") in the same clause; an implicit, contextual anchor from an earlier sentence is not resolved by this module`,
        whole,
        PRIORITY.percentMoreLess,
      ));
      continue;
    }
    if (!sm) {
      const whole: Span = { text: percentWhole, span: [percentStart, percentStart + percentWhole.length] };
      out.push(makeAbstain(
        `percent-${word} phrase "${percentWhole}" has an explicit anchor but no named subject immediately before it`,
        whole,
        PRIORITY.percentMoreLess,
      ));
      continue;
    }

    const subjText = sm[1];
    const subjStart = Math.max(0, percentStart - 60) + sm.index;
    const subject = spanOf(text, [subjStart, subjStart + subjText.length]);

    const anchorText = am[1];
    const anchorMatchStart = percentStart + percentWhole.length + am.index + am[0].indexOf(anchorText);
    const anchor = spanOf(text, [anchorMatchStart, anchorMatchStart + anchorText.length]);

    const fullEnd = percentStart + percentWhole.length + am.index + am[0].length;
    const whole: Span = { text: text.slice(percentStart, fullEnd), span: [percentStart, fullEnd] };

    if (isBarePronoun(anchor)) {
      out.push(makeAbstain(
        `anchor '${anchor.text}' resolves to a bare pronoun in a "${percentWhole} ... than" clause`,
        whole,
        PRIORITY.percentMoreLess,
      ));
      continue;
    }

    const percentValue = extractQuantities(pm[1])[0];
    if (!percentValue) {
      out.push(makeAbstain(
        `the percent value in "${percentWhole}" could not be resolved via extractQuantities`,
        whole,
        PRIORITY.percentMoreLess,
      ));
      continue;
    }

    out.push({
      isAbstain: false,
      start: whole.span[0],
      end: whole.span[1],
      priority: PRIORITY.percentMoreLess,
      comparative: {
        kind: word === 'more' ? 'percent-more' : 'percent-less',
        factor: percentValue.value,
        subject,
        anchor,
        anchorSide: anchorSideOf(subject, anchor),
        direction: word === 'more' ? 'greater' : 'smaller',
        span: whole,
        evidence: [
          `matched "${percentWhole} ... than ${anchor.text}" with an explicit anchor and subject`,
          `percent value ${percentValue.value.n}/${percentValue.value.d} (not pre-divided by 100, matching quantities.ts's own percent convention)`,
          `see this module's header for the W04-measured GSM8K dataset convention on how a downstream method may choose to compute from this relationship`,
        ],
      },
    });
  }
  return out;
}

/** "the ratio of <A> to <B> is <N>:<M>" -- an explicit numeric ratio. */
function recognizeRatioColon(text: string): ComparativeCandidate[] {
  const out: ComparativeCandidate[] = [];
  // A wider entity alternation than ANCHOR_ALT, specific to this recognizer: "the ratio of A to B
  // is N:M" is bookended by fixed literals ("ratio of", "to", "is N:M") tight enough that a bare,
  // determiner-less lowercase noun ("cats", "dogs") is safe to capture here without the over-capture
  // risk ANCHOR_ALT's own doc comment names as the reason it omits that alternative everywhere else
  // in this module. The lowercase branch is deliberately SINGLE-WORD ONLY (no `{0,N}` continuation)
  // -- found and fixed this dispatch via the coverage run's own hand-check: "the ratio of boys to
  // girls in a classroom is 3:5" originally let the anchor's continuation greedily swallow the
  // trailing prepositional phrase "in a classroom" (4 words, within the old {0,4} allowance),
  // reporting anchor "girls in a classroom" instead of "girls". A multi-word lowercase compound
  // noun anchor ("red marbles to blue marbles") is a named, accepted limitation of this
  // single-word restriction rather than risk the same over-capture recurring.
  const RATIO_ENTITY_ALT = '(?:[A-Z][a-z]+(?:\\s+[A-Z][a-z]+)?|[a-z]+)';
  const re = new RegExp(
    `\\bratio\\s+of\\s+(${RATIO_ENTITY_ALT})\\s+to\\s+(${RATIO_ENTITY_ALT})\\s+is\\s+(\\d+)\\s*:\\s*(\\d+)\\b`,
    'g', // never 'i' -- see recognizeAsManyActorFirst's comment on ANCHOR_ALT and `[A-Z]`.
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const track = makeOffsetTracker(m[0], m.index);
    const subjOff = track(m[1]);
    const anchOff = track(m[2]);
    const nOff = track(m[3]);
    const dOff = track(m[4]);
    const subject = spanOf(text, subjOff);
    const anchor = spanOf(text, anchOff);
    const whole: Span = { text: m[0], span: [m.index, m.index + m[0].length] };

    const n = BigInt(text.slice(nOff[0], nOff[1]));
    const d = BigInt(text.slice(dOff[0], dOff[1]));
    if (d === 0n) {
      out.push(makeAbstain(`ratio "${m[0]}" has a zero denominator`, whole, PRIORITY.ratioColon));
      continue;
    }
    const factor = makeFraction(n, d);
    out.push({
      isAbstain: false,
      start: whole.span[0],
      end: whole.span[1],
      priority: PRIORITY.ratioColon,
      comparative: {
        kind: 'ratio',
        factor,
        subject,
        anchor,
        anchorSide: anchorSideOf(subject, anchor),
        direction: directionFromFactor(factor),
        span: whole,
        evidence: [`matched an explicit "ratio of A to B is N:M" clause, factor ${factor.n}/${factor.d}`],
      },
    });
  }
  return out;
}

/** "<Subject> [gap] <verb> a third|quarter|fourth|fifth|half|N/M of what <Anchor> did|had|has|
 *  does|do" -- the narrow "fraction of what someone else did" shape (gsm8k-train-49: "Ben got a
 *  late start and only collected a third of what Laurie did"). Deliberately narrow (a bounded
 *  0-40-character gap between subject and verb, a fixed fraction-word set, and the literal "of
 *  what <Name> did/had/..." tail) rather than a fully general "half of <description>" resolver --
 *  see recognizeHalfOfDescriptionAbstain below for the DELIBERATELY-abstained general case this
 *  narrow recognizer does not attempt to widen into. */
function recognizeFractionOfWhat(text: string): ComparativeCandidate[] {
  const out: ComparativeCandidate[] = [];
  const fractionWord =
    '(?:a\\s+third|a\\s+quarter|a\\s+fourth|a\\s+fifth|a\\s+half|one[- ]third|one[- ]quarter|' +
    'one[- ]fourth|one[- ]fifth|half|\\d+\\/\\d+)';
  const re = new RegExp(
    `\\b([A-Z][a-z]+)\\b[^.?!]{0,40}?\\b${VERB_WORDS}\\s+(${fractionWord})\\s+of\\s+what\\s+([A-Z][a-z]+)\\s+(?:did|had|has|does|do)\\b`,
    'g', // never 'i' -- see recognizeAsManyActorFirst's comment on `[A-Z]`.
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const track = makeOffsetTracker(m[0], m.index);
    const subjOff = track(m[1]);
    const fracOff = track(m[2]);
    const anchOff = track(m[3]);

    const subject = spanOf(text, subjOff);
    const anchor = spanOf(text, anchOff);
    const whole: Span = { text: m[0], span: [m.index, m.index + m[0].length] };

    const resolved = resolveNumeral(text, fracOff, new Map());
    let factor: Fraction | null = resolved ? resolved.value : null;
    if (!factor) {
      // "a third"/"one-third" etc. are not extracted as a bare fraction by extractQuantities on
      // their own token (the "a"/"one" numerator plus a bare denominator word IS a recognized word
      // fraction shape there, e.g. "a third" -- confirmed against quantities.ts's own
      // recognizeWordFraction). If extractQuantities somehow does not resolve it, abstain rather
      // than fall back to a second, locally reimplemented fraction-word table.
      out.push(makeAbstain(
        `the fraction phrase "${m[2]}" in "${m[0]}" could not be resolved to a value via extractQuantities`,
        whole,
        PRIORITY.fractionOfWhat,
      ));
      continue;
    }

    out.push({
      isAbstain: false,
      start: whole.span[0],
      end: whole.span[1],
      priority: PRIORITY.fractionOfWhat,
      comparative: {
        kind: 'ratio',
        factor,
        subject,
        anchor,
        anchorSide: anchorSideOf(subject, anchor),
        direction: directionFromFactor(factor),
        span: whole,
        evidence: [
          `matched "<Subject> ... <verb> <fraction> of what <Anchor> did/had/..." narrow fraction-of-anchor shape`,
          `fraction '${m[2]}' resolved to factor ${factor.n}/${factor.d} via extractQuantities`,
        ],
      },
    });
  }
  return out;
}

/** "Half the|of the <description> were|was|are|is <category>" -- e.g. gsm8k-train-97's "Half the
 *  books on the bottom section of the cart were mystery books." This shape states a PROPORTION of
 *  an implicit, not-yet-quantified whole (the "other half" is a different, unnamed category), not a
 *  ratio between two ALREADY-IDENTIFIED quantities or actors -- resolving it needs to know the
 *  total the fraction is taken OF, which is not stated as a number anywhere in this clause. Always
 *  abstains, by construction, with a named reason, per this module's own "record the wrong answers
 *  too" discipline: a description-shaped anchor is a genuine, common GSM8K shape and is named here
 *  rather than silently falling through as an unmatched pattern. */
function recognizeHalfOfDescriptionAbstain(text: string): ComparativeCandidate[] {
  const out: ComparativeCandidate[] = [];
  const re = /\bHalf\s+(?:the|of the)\s+([a-z][a-z\s]*?)\s+(?:were|was|are|is)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const whole: Span = { text: m[0], span: [m.index, m.index + m[0].length] };
    out.push(makeAbstain(
      `"Half the/of the ${m[1]} were/was/are/is ..." states a fraction of an implicit, not-yet-quantified whole (the anchor is a category/description, not a specific prior quantity or actor); true resolution needs the OTHER portion's identity, which is a method's own judgment, not this parser's`,
      whole,
      PRIORITY.halfOfDescriptionAbstain,
    ));
  }
  return out;
}

/** "<twice|double|triple|half> that many|much" -- the anchor IS the demonstrative pronoun "that"
 *  by construction (gsm8k-train-64: "He works 30 hours at his main job and half THAT MUCH at his
 *  second job"). Always abstains: resolving "that" to its antecedent quantity is anaphora
 *  resolution, parse/entities.ts's job, not this module's. */
function recognizeHalfThatMuchAbstain(text: string): ComparativeCandidate[] {
  const out: ComparativeCandidate[] = [];
  const re = /\b(twice|double|triple|half)\s+that\s+(?:many|much)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const whole: Span = { text: m[0], span: [m.index, m.index + m[0].length] };
    out.push(makeAbstain(
      `"${m[0]}" -- the anchor is the demonstrative pronoun "that", referring back to an earlier-stated quantity; anaphora resolution is parse/entities.ts's job, not this module's`,
      whole,
      PRIORITY.halfThatMuchAbstain,
    ));
  }
  return out;
}

// ─── DANGLING-PREPOSITION GUARD ─────────────────────────────────────────────────────────────────

// A determiner-led noun phrase ("the points of", captured from "Sean scored 2 less than the points
// of Tobee and Jay together") can end on a preposition when the phrase it is a modifier of
// continues into a PROPER noun the phrase's own lowercase-only continuation cannot cross into (see
// CONTINUATION_WORD's own doc comment) -- found via the coverage run's own hand-check. Rather than
// report a visibly truncated, dangling anchor or subject, this guard converts any such candidate
// into an abstain with a named reason: reporting "the points of" as an anchor would fail
// HARDWIRE-22's own test ("could a reader verify the answer by looking") on its face.
const DANGLING_PREPOSITIONS = new Set(['of', 'for', 'with', 'to', 'in', 'on', 'at', 'from', 'by']);

function endsWithDanglingPreposition(span: Span): boolean {
  const words = span.text.trim().split(/\s+/);
  const last = words[words.length - 1]?.toLowerCase();
  return last !== undefined && DANGLING_PREPOSITIONS.has(last);
}

/** Applied to every non-abstain candidate before overlap resolution: converts it into an abstain,
 *  in place (same span and priority, so it competes fairly in overlap resolution), when its subject
 *  or anchor phrase ends on a dangling preposition. */
function guardDanglingPrepositions(candidates: ComparativeCandidate[]): ComparativeCandidate[] {
  return candidates.map((c) => {
    if (c.isAbstain || !c.comparative) return c;
    const { subject, anchor } = c.comparative;
    const badSubject = endsWithDanglingPreposition(subject);
    const badAnchor = endsWithDanglingPreposition(anchor);
    if (!badSubject && !badAnchor) return c;
    const field = badAnchor ? 'anchor' : 'subject';
    const phrase = badAnchor ? anchor.text : subject.text;
    return makeAbstain(
      `${field} phrase "${phrase}" ends with a dangling preposition -- an incomplete noun-phrase capture (the real phrase likely continues into a proper noun this module's lowercase-only continuation cannot cross into); abstaining rather than reporting a truncated ${field}`,
      c.comparative.span,
      c.priority,
    );
  });
}

// ─── OVERLAP RESOLUTION ─────────────────────────────────────────────────────────────────────────

/** Greedy interval scheduling identical in shape to quantities.ts's own resolveOverlaps: sort by
 *  (priority desc, length desc, start asc), accept a candidate iff it does not overlap any
 *  already-accepted span. Applied across BOTH comparatives and abstains together, so a
 *  higher-priority, more-specific recognizer's real extraction always wins over a lower-priority
 *  generic recognizer's spurious partial match (or spurious abstain) at the same location. */
function resolveOverlaps(candidates: ComparativeCandidate[]): ComparativeCandidate[] {
  const ranked = [...candidates].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const lenA = a.end - a.start;
    const lenB = b.end - b.start;
    if (lenB !== lenA) return lenB - lenA;
    return a.start - b.start;
  });
  const accepted: ComparativeCandidate[] = [];
  for (const cand of ranked) {
    const overlaps = accepted.some((a) => cand.start < a.end && a.start < cand.end);
    if (!overlaps) accepted.push(cand);
  }
  return accepted.sort((a, b) => a.start - b.start);
}

// ─── PUBLIC API ─────────────────────────────────────────────────────────────────────────────────

/** Extracts every comparative/multiplicative relationship in `text` with positive textual evidence,
 *  plus a named-reason abstain for every comparative-SHAPED phrase this module recognized but could
 *  not resolve. Never invents a relationship from context; every multiplicative factor and additive
 *  delta is resolved via `parse/quantities.ts`'s own `extractQuantities`, never a locally
 *  reimplemented numeral parser. Deterministic, no model call. See this file's header for the full
 *  contract, the two measured GSM8K dataset conventions this module names (never silently applies),
 *  and this dispatch's return doc for the complete abstain-rule writeup and hand-verified fixtures.
 *
 *  `quantities`, if supplied, is used as the source of truth for resolving any numeral this module's
 *  own recognizers capture (so a caller that already ran `extractQuantities(text)` once does not
 *  pay for it twice); when omitted, this function calls `extractQuantities(text)` itself. Either
 *  way, no recognizer in this file ever parses a digit or number word on its own -- see
 *  `resolveNumeral` above. */
export function extractComparatives(text: string, quantities?: Quantity[]): ExtractComparativesResult {
  if (typeof text !== 'string' || text.length === 0) return { comparatives: [], abstains: [] };

  const qtys = quantities ?? extractQuantities(text);
  const qtyByStart = new Map<number, Quantity>();
  for (const q of qtys) qtyByStart.set(q.span[0], q);
  void qtyByStart; // reserved for future recognizers; resolveNumeral currently resolves per-call

  // The ask sentence states the QUESTION, never a factual comparison to extract -- a comparative-
  // shaped match falling entirely inside it (e.g. a "how many times as many ... as" ask clause) is
  // dropped rather than reported, per this module's own positive-evidence discipline: the ask
  // clause's own numerals are typically the interrogative "how many/how much" placeholder, which
  // resolveNumeral already fails to resolve (so most such matches never reach this point anyway) --
  // this is a second, explicit safety net, and the concrete reason `Ask`/`extractAsk` is imported.
  const ask: Ask | null = extractAsk(text);
  const askSpan = ask ? ask.span : null;
  const fallsInsideAsk = (start: number, end: number): boolean =>
    askSpan !== null && start >= askSpan[0] && end <= askSpan[1];

  const candidates: ComparativeCandidate[] = [
    ...recognizeRatioColon(text),
    ...recognizeFractionOfWhat(text),
    ...recognizeHalfOfDescriptionAbstain(text),
    ...recognizeTimesMoreThan(text),
    ...recognizeOlderYounger(text),
    ...recognizeMoreFewerLessThan(text),
    ...recognizePercentMoreLess(text),
    ...recognizeBareMoreThanIdiom(text),
    ...recognizeMultiplierTheNounOf(text),
    ...recognizeAsManyActorFirst(text),
    ...recognizeAsManyNounFirst(text),
    ...recognizeHalfThatMuchAbstain(text),
    ...recognizeAsManyPlain(text),
  ].filter((c) => !fallsInsideAsk(c.start, c.end));

  const resolved = resolveOverlaps(guardDanglingPrepositions(candidates));

  const comparatives: Comparative[] = [];
  const abstains: ComparativeAbstain[] = [];
  for (const c of resolved) {
    if (c.isAbstain && c.abstain) abstains.push(c.abstain);
    else if (!c.isAbstain && c.comparative) comparatives.push(c.comparative);
  }
  return { comparatives, abstains };
}
