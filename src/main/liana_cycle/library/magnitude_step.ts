// magnitude_step.ts -- D-BP154-022/BISHOP-SEG/S22/seg-magnitude
//
// THE FIFTH COMPOSER STEP: MAGNITUDE. FD-BP153-01, ratified, completing FD-BP152-38 ("Yes. that.
// now code it, please"), verbatim:
//
//   "A superlative resolves by magnitude, ranked WITHIN THE FRAME. The frame is established
//   first: which options are legitimate members of the category the question names, and which
//   are not. Non-members are removed and are never ranked. Magnitude decides only among the
//   survivors."
//
// THE FRAME IS NOT RE-DERIVED HERE. terminator_step.ts's own deriveTerminatorEliminations() --
// pure, exported, already unit-tested, already fixed twice this campaign (D-BP154-020's
// vocabulary-mismatch fix, D-BP154-021's middle-parenthetical fix) -- is the ONE place
// Softballs:1/NamedSet:1/Discriminator:1's own stated facts become an elimination set. Imported
// and reused UNCHANGED, never duplicated, so a future fix to that reducer can never silently
// diverge between what THE TERMINATOR uses to abstain and what THE MAGNITUDE uses to rank. This
// is a DIFFERENT discipline from this file's own category/property parsing below (duplicated
// locally, per this codebase's established "steps stay self-contained" convention for SMALL,
// qid-agnostic text parsers, same as discriminator_step.ts's own comment on its twin) --
// deriveTerminatorEliminations() is a substantial, correctness-critical, actively-maintained
// reducer, not a one-line parser; reusing it is the safer engineering choice here, not a breach
// of that convention's intent.
//
// classify_cascade.ts is FORBIDDEN and was NOT read to build this file -- built from FD-BP153-01's
// ruling text alone, never ported from that file's own ranking machinery. Only the same generic,
// already-shared primitives comparative_cascade.ts exports (appearsIn/gemmaExtract/list/toLetters),
// read-only, unmodified, plus composer_step_evidence.ts's own shared evidence-gathering helpers
// (already used identically by softballs_step.ts/named_set_step.ts/discriminator_step.ts).
//
// NEVER ON THE FULL OPTION LIST. If NONE of Softballs:1/NamedSet:1/Discriminator:1 actually ran
// (ok:true) earlier in this same stack, there is no established frame -- "zero eliminations" is
// NOT "the frame is everything"; it is "the frame was never built", and this step refuses to run
// rather than silently ranking every option (FD-BP153-01's own "confident-wrong-answer generator"
// -- an unframed magnitude answer). Same refusal on a self-contradictory frame (the SAME
// contradiction deriveTerminatorEliminations() itself detects) or a frame degenerated to fewer
// than two survivors (nothing left to rank, or already unique without magnitude).
//
// THE ORDERING IS EXTRACTED, NEVER COMPUTED (HARDWIRE-22). The conversational authority (Gemini)
// is asked ONE real question -- the SAME "ask a source, then extract what it stated" pattern
// Softballs/NamedSet/Discriminator already use -- and the LOCAL extraction model (gemmaExtract,
// Ollama) only ever copies what that answer's own text states, with a verbatim span per ranked
// entry, the SAME four-part discipline (name maps to a frame option, span non-empty, span
// verbatim in the passage, span about that option) every other step in this estate already
// applies. Ollama is never asked to compare or rank anything itself -- gemmaExtract's own system
// prompt already enforces "report only what it states... do not choose between options" (that
// instruction is unmodified by this file).
//
// NO NUMBERS FROM THIS FILE'S OWN KNOWLEDGE, EVER. A population-density figure (or any other
// magnitude fact) must come from a source that STATES it, with a verbatim span -- this file
// contains no such figure, anywhere, for any option, and never will. If a stated ordering is
// never obtained, this step ABSTAINS (ok:false) -- it never falls back to a number this file's
// own author happens to know.
//
// DISAGREEMENT ACROSS INDEPENDENT SOURCES IS REPORTED, NEVER RESOLVED BY FORCE. Every owned
// candidate that names a frame option is extracted independently (not just the first match, the
// established pattern the other three steps use); if two or more disagree on the relative order
// of options they both rank, this step reports that disagreement and refuses (ok:false) rather
// than silently picking one.
//
// NO RULE HERE MAY SELECT A PARTICULAR LETTER (FD-BP153-06) -- every option letter is treated
// identically by every function below; which end of a stated ordering is "the answer" is decided
// only by deriveMagnitudeTargetExtreme()'s reading of the QUESTION's own wording (negation +
// stated direction), never by which letter that reading happens to land on.

import {
  appearsIn, gemmaExtract, googleBlocks, list, toLetters,
} from '../methods/comparative_cascade';
import type { MethodQuestionInput, MethodRunContext } from '../method_registry';
import { registerNameNumbered } from './method_registry';
import type { MethodIdentity } from './method_identity';
import type { StepDeclaration } from './step_declaration';
import {
  corroborateClaim, gatherMortgageCandidates, gatherThisRunCandidates,
  spanIsVerbatimInPassage, summarizeCorroboration, tryConversationalAuthority,
} from './composer_step_evidence';
import type { ClaimProvenance, CorroborationResult } from './composer_step_evidence';
import { deriveTerminatorEliminations } from './terminator_step';
import type { SoftballsResult } from './softballs_step';
import type { NamedSetResult } from './named_set_step';
import type { DiscriminatorResult } from './discriminator_step';
import type { ComposerStepOutcome } from './script_bridge';

// ───────────────────── pure parts (unit-testable without a live Ollama/browser) ─────────────────────

/** Reads the FULL superlative property phrase the question itself names -- byte-identical to
 *  named_set_step.ts's own deriveNamedSetProperty() / discriminator_step.ts's own
 *  deriveDiscriminatorSuperlativeProperty(), duplicated (not imported) for the same "steps stay
 *  self-contained" reason those two files' own headers already state. Pure text-structure parsing
 *  of the question's OWN wording, never a judgment -- returns null (never a guess) when the
 *  question does not fit this shape. */
export function deriveMagnitudeSuperlativeProperty(question: string): string | null {
  const m1 = question.match(/\bone of\s+(?:the\s+)?([a-z0-9][^?]*?)\??$/i);
  if (m1 && m1[1].trim()) return m1[1].trim();
  const m2 = question.match(/\bconsidered\s+(?:the\s+)?([a-z0-9][^?]*?)\??$/i);
  if (m2 && m2[1].trim()) return m2[1].trim();
  return null;
}

export type MagnitudeExtreme = 'most' | 'least';

/** Reads which end of the stated property the QUESTION ITSELF demands (FD-BP153-01's own "the
 *  extreme the question demands"). Pure text-structure parsing, nothing else: is the question
 *  negated ("...is NOT..."), and does the property phrase itself say "most" or "least"? A
 *  NOT-question about a "most" property targets the LEAST end (qid 98's own shape: "NOT
 *  considered one of the world's MOST densely populated regions" -> target = least); a direct
 *  question, or a "least" property, targets the opposite way round. Defaults the property's own
 *  direction to 'most' when neither word literally appears (the common unmarked superlative
 *  shape) -- this is a reading of which WORD the question used, never a guess about which OPTION
 *  is extreme, and applies identically regardless of the actual category or options named
 *  (FD-BP153-06). */
export function deriveMagnitudeTargetExtreme(question: string, property: string): MagnitudeExtreme {
  const negated = /\bnot\b/i.test(question);
  const propertyDirection: MagnitudeExtreme = /\bleast\b/i.test(property) ? 'least' : 'most';
  if (!negated) return propertyDirection;
  return propertyDirection === 'most' ? 'least' : 'most';
}

/** THE ONE QUERY -- restricted to `frame`, NEVER the full option list (FD-BP153-01). */
export function buildMagnitudeQuery(property: string, frame: string[], OPT: Record<string, string>): string {
  return `Considering ONLY the following (do not discuss or rank any other option) -- `
    + `${list(frame, OPT)} -- order them from the one that BEST fits "${property}" to the one `
    + `that LEAST fits it. State the full order explicitly, from most to least, and say so for `
    + `every one of them.`;
}

export interface MagnitudeOrderEntry {
  letter: string;
  name: string;
  /** Verbatim span proving the source itself stated this option's relative position. */
  span: string;
}

/** THE ONE CORROBORATION QUERY (FD-BP154-02): re-asks whether the single DECISIVE claim (the
 *  option this step's own targetExtreme reading selects) holds, for a second, independent
 *  document. */
export function buildMagnitudeCorroborationQuery(
  property: string, extremeEntry: MagnitudeOrderEntry, targetExtreme: MagnitudeExtreme,
): string {
  return `Is ${extremeEntry.name} the ${targetExtreme} "${property}"? Answer plainly and `
    + `directly, stating clearly whether it is or is not.`;
}

// spanIsVerbatimInPassage() is imported from composer_step_evidence.ts (D-BP154-014) -- identical
// logic, shared rather than a fourth local copy; see that file's own header.

type RawOrderEntry = { name?: unknown; span?: unknown };

/** THE VERIFY-THE-SPAN CHOKE POINT (FD-BP153-07 FIX 2's own discipline, applied here to an
 *  ordered list instead of a set): (a) non-empty `name`, (b) maps to a KNOWN option, (c) that
 *  option is IN `frame` -- an option outside the frame is never a candidate here at all, not even
 *  a discard (FD-BP153-01: magnitude ranks only survivors), (d) non-empty `span`, (e) span
 *  VERBATIM in `passage`, (f) span itself ABOUT the named option (appearsIn). Any failure of
 *  (d)/(e)/(f) is a DISCARD and is counted. Array ORDER is preserved from the extraction as-given
 *  (most to least) -- trusted from the model's own stated sequence exactly as every other step in
 *  this estate trusts an extracted field's CONTENT once its span is verified, never independently
 *  re-derived from the span text. */
export function verifyMagnitudeOrder(
  raw: unknown,
  passage: string,
  frame: string[],
  OPT: Record<string, string>,
): { order: MagnitudeOrderEntry[]; discarded: number } {
  const entries = Array.isArray(raw) ? (raw as RawOrderEntry[]) : [];
  const frameSet = new Set(frame);
  const order: MagnitudeOrderEntry[] = [];
  const seen = new Set<string>();
  let discarded = 0;
  for (const entry of entries) {
    const name = typeof entry?.name === 'string' ? entry.name.trim() : '';
    const span = typeof entry?.span === 'string' ? entry.span.trim() : '';
    if (!name) continue; // nothing named -- not a candidate value, not a discard
    const matched = toLetters([name], OPT);
    if (matched.length === 0) continue; // names no known option -- not a candidate value here
    const L = matched[0];
    if (!frameSet.has(L)) continue; // names an option OUTSIDE the frame -- never ranked, not a discard
    if (!span || !spanIsVerbatimInPassage(passage, span) || !appearsIn(span, OPT[L])) {
      discarded++;
      continue;
    }
    if (seen.has(L)) continue; // one entry per option; a repeat is neither kept nor double-counted
    seen.add(L);
    order.push({ letter: L, name: OPT[L], span });
  }
  return { order, discarded };
}

/** Two independently-obtained orderings DISAGREE when, restricted to the options BOTH of them
 *  ranked (at least two in common -- a single shared item has no relative order to disagree
 *  about), the relative sequence differs. Pure set/sequence comparison, no interpretation. */
export function magnitudeOrdersDisagree(a: MagnitudeOrderEntry[], b: MagnitudeOrderEntry[]): boolean {
  const bLetters = new Set(b.map((e) => e.letter));
  const aLetters = new Set(a.map((e) => e.letter));
  const aRestricted = a.filter((e) => bLetters.has(e.letter)).map((e) => e.letter);
  const bRestricted = b.filter((e) => aLetters.has(e.letter)).map((e) => e.letter);
  if (aRestricted.length < 2 || bRestricted.length < 2) return false;
  return aRestricted.join(',') !== bRestricted.join(',');
}

export interface MagnitudeResult {
  ok: boolean;
  /** The frame this ranking was restricted to -- the SAME survivor set
   *  deriveTerminatorEliminations() (terminator_step.ts) computes from Softballs:1/NamedSet:1/
   *  Discriminator:1's own stated facts. Never the full option list (FD-BP153-01). Empty when the
   *  frame itself could not be established. */
  frame: string[];
  property: string | null;
  targetExtreme: MagnitudeExtreme | null;
  query: string | null;
  /** MOST to LEAST, as the source stated it -- position 0 is stated most, last is stated least.
   *  Restricted to `frame`; an option outside the frame is never a candidate here at all. */
  order: MagnitudeOrderEntry[];
  discarded: number;
  /** Frame members the credited ordering never mentioned -- ABSENCE IS OMISSION, never
   *  conflated with "confirmed least/most". */
  unranked: string[];
  via: string;
  /** D-BP154-014-shaped, FD-BP154-03: HOW the passage this extraction ran over was obtained. */
  answerProvenance?: ClaimProvenance;
  /** ONE Google corroboration attempt against the single decisive claim (the extreme entry this
   *  step's own targetExtreme reading selects). Additive, never a gate. */
  corroboration?: CorroborationResult;
  /** Non-null only when two or more independently-obtained orderings genuinely disagreed --
   *  reported, never silently resolved by picking one (this step's own dispatch, verbatim: "never
   *  resolve it by force"). */
  disagreement: { detailA: string; detailB: string } | null;
  /** D-BP154-043/BISHOP-SEG/S43/seg-unitary, ADDITIVE. Founder's own correction: a magnitude
   *  tie-break must be grounded in "a single frozen source and year defining boundaries and
   *  densities for ALL surviving regions... Not model recall." Non-null whenever an attempt was
   *  made (attemptFrozenDensitySource(), below); `obtained: true` ONLY when one document's own
   *  text stated a verifiable figure for EVERY frame member -- see that function's own header for
   *  why a partial/mismatched-source reading is never silently used as if it were unified. */
  frozenSource?: FrozenDensitySourceResult;
  error?: string;
}

function emptyMagnitudeResult(overrides: Partial<MagnitudeResult> & { error: string }): MagnitudeResult {
  return {
    ok: false, frame: [], property: null, targetExtreme: null, query: null, order: [], discarded: 0,
    unranked: [], via: 'n/a', disagreement: null,
    ...overrides,
  };
}

function summaryLine(OPT: Record<string, string>, r: MagnitudeResult): string {
  if (!r.ok) return `MAGNITUDE: FAILED -- ${r.error}`;
  const orderText = r.order.length
    ? r.order.map((e, i) => `${i + 1}. ${e.letter}) ${e.name} [source: "${e.span}"]`).join('  |  ')
    : '(none stated)';
  const unrankedText = r.unranked.length
    ? r.unranked.map((L) => `${L}) ${OPT[L]}`).join(', ')
    : '(none)';
  const discardNote = r.discarded ? ` -- discarded ${r.discarded} candidate(s) with no verifiable span` : '';
  const provenanceNote = r.answerProvenance ? `  ||  ANSWERED VIA ${r.answerProvenance.mechanism}: ${r.answerProvenance.detail}` : '';
  const corrobNote = r.corroboration ? `  ||  ${summarizeCorroboration(r.corroboration)}` : '';
  const frozenNote = r.frozenSource
    ? r.frozenSource.obtained
      ? `  ||  FROZEN SOURCE: "${r.frozenSource.sourceTitle}" (${r.frozenSource.sourceUrl}) -- covers every survivor -- `
        + `${r.frozenSource.entries.map((e) => `${e.letter}) ${e.name}: ${e.figureText}`).join('; ')}`
      : `  ||  FROZEN SOURCE: attempted, NOT obtained -- ${r.frozenSource.error} -- ranking below is NOT from a unified dataset`
    : '';
  return `MAGNITUDE -- frame: {${r.frame.join(', ')}}  ||  target: ${r.targetExtreme}  ||  `
    + `query: "${r.query}"  ||  ORDER (source-stated, most to least, verified): ${orderText}`
    + `${discardNote}  ||  UNRANKED (source silent -- omission, not an extreme): ${unrankedText}`
    + `${provenanceNote}${corrobNote}${frozenNote}`;
}

// ───────────────── FD-BP154-043: THE FROZEN-SOURCE DENSITY ATTEMPT ─────────────────

export interface FrozenDensityEntry {
  letter: string;
  name: string;
  /** The stated density figure or explicit density phrase, verbatim from the source. */
  figureText: string;
  /** Verbatim span proving the source itself stated this figure for this option. */
  span: string;
}

export interface FrozenDensitySourceResult {
  attempted: boolean;
  /** true ONLY when ONE document's own text yielded a verified figure+span for EVERY frame
   *  member -- a partial reading (some but not all survivors covered) is never reported as
   *  `obtained`, per the Founder's own "if you cannot obtain one apples-to-apples dataset covering
   *  every survivor, say so and report what you could get." */
  obtained: boolean;
  sourceUrl: string | null;
  sourceTitle: string | null;
  entries: FrozenDensityEntry[];
  /** true only when every entry's figureText parsed to a comparable number -- an obtained-but-
   *  non-numeric reading (e.g. only qualitative density language) is reported honestly and never
   *  used to rank. */
  numericallyRankable: boolean;
  error?: string;
}

/** Extracts a leading numeric magnitude from a density figure's own text (e.g. "150 people per
 *  km2" -> 150; "about 1,200/km2" -> 1200). Pure text parsing, no unit conversion, no judgment --
 *  returns null (never a guess) when no number is present. */
export function parseDensityFigure(figureText: string): number | null {
  const m = figureText.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/** THE ONE ATTEMPT at a single, frozen, apples-to-apples source. Issues ONE Google query, then
 *  requires ONE organic result block's OWN body text to state a verifiable figure for EVERY
 *  option in `frame` before it is accepted -- a document naming only some survivors is skipped in
 *  favor of the next candidate, never patched together with a second document (that would be
 *  exactly the "mismatched-source ranking" the Founder's own dispatch forbids using quietly).
 *  Returns `obtained: false` (never a guess) when no single candidate document covers every
 *  survivor. */
export async function attemptFrozenDensitySource(
  ctx: MethodRunContext,
  frame: string[],
  OPT: Record<string, string>,
  property: string,
): Promise<FrozenDensitySourceResult> {
  const query = `Compare the population density (people per square kilometer) of the following, `
    + `citing a figure for each: ${list(frame, OPT)}`;
  const res = await googleBlocks(ctx.askGoogle, query);
  if (!res.ok) {
    return {
      attempted: true, obtained: false, sourceUrl: null, sourceTitle: null, entries: [],
      numericallyRankable: false, error: `Google returned nothing usable (${res.via})`,
    };
  }
  const candidates = res.blocks.filter((b) => b.kind === 'organic' && b.url && b.url.trim() && b.body && b.body.trim());
  for (const block of candidates) {
    // The document must at least NAME every survivor before it is worth an extraction pass.
    if (!frame.every((L) => appearsIn(block.body, OPT[L]))) continue;
    const instruction = `From the passage, for EACH of the following, copy the exact verbatim `
      + `sentence or clause stating its population density (a figure, or an explicit density `
      + `comparison). If the passage does not state a density figure for one of them, omit it -- `
      + `do not guess. Options: ${frame.map((L) => `${L}) ${OPT[L]}`).join('; ')}`;
    const shape = '{"entries":[{"name":"exact option name from the list","figureText":"the stated density figure or phrase, verbatim","span":"verbatim sentence or clause from the passage"}]}';
    const rawOut: { text?: string } = {};
    // eslint-disable-next-line no-await-in-loop -- stops at the first candidate document that
    // fully covers the frame; not a fan-out worth parallelizing.
    const ex = await gemmaExtract(instruction, block.body, shape, rawOut);
    if (ex === null) continue;
    const rawEntries = Array.isArray((ex as { entries?: unknown }).entries) ? (ex as { entries: unknown[] }).entries : [];
    const verified: FrozenDensityEntry[] = [];
    for (const raw of rawEntries as Array<{ name?: unknown; figureText?: unknown; span?: unknown }>) {
      const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
      const figureText = typeof raw?.figureText === 'string' ? raw.figureText.trim() : '';
      const span = typeof raw?.span === 'string' ? raw.span.trim() : '';
      if (!name || !figureText || !span) continue;
      const matched = toLetters([name], OPT);
      if (matched.length === 0) continue;
      const L = matched[0];
      if (!frame.includes(L)) continue;
      if (!spanIsVerbatimInPassage(block.body, span) || !appearsIn(span, OPT[L])) continue;
      if (verified.some((v) => v.letter === L)) continue;
      verified.push({ letter: L, name: OPT[L], figureText, span });
    }
    const coveredLetters = new Set(verified.map((e) => e.letter));
    if (frame.every((L) => coveredLetters.has(L))) {
      const entries = frame.map((L) => verified.find((e) => e.letter === L)!);
      const numericallyRankable = entries.every((e) => parseDensityFigure(e.figureText) !== null);
      return {
        attempted: true, obtained: true, sourceUrl: block.url, sourceTitle: block.title || null,
        entries, numericallyRankable,
      };
    }
  }
  return {
    attempted: true, obtained: false, sourceUrl: null, sourceTitle: null, entries: [],
    numericallyRankable: false,
    error: `no single candidate document's own text stated a verifiable ${property.includes('densit') ? '' : 'density '}`
      + 'figure for every survivor -- could not obtain one apples-to-apples dataset covering every survivor',
  };
}

// ───────────────── the live step (frame -> owned evidence -> conversational -> corroboration; needs a real run to verify) ─────────────────

/**
 * Runs THE MAGNITUDE as the fifth Composer step: establishes the frame from
 * Softballs:1/NamedSet:1/Discriminator:1's already-computed results (via terminator_step.ts's own
 * deriveTerminatorEliminations(), reused unchanged), then ranks ONLY the survivors -- owned
 * evidence tried first (every candidate, so a genuine cross-source disagreement can be detected),
 * then the conversational authority (Gemini) answers the one ranking question (FD-BP154-02), then
 * -- when there is a decisive claim -- ONE Google corroboration pass names a third-party document
 * that independently states the same thing. Cannot be exercised end to end under vitest -- same
 * boundary softballs_step.ts's/named_set_step.ts's/discriminator_step.ts's own headers state. The
 * pure parts above carry the real unit tests; this function is verified by a live in-app run
 * (this ticket's own return).
 */
export async function runMagnitudeStep(
  input: MethodQuestionInput,
  ctx: MethodRunContext,
  priorResults: ComposerStepOutcome[],
): Promise<{ result: MagnitudeResult; summary: string }> {
  const OPT = input.options;
  if (!OPT || Object.keys(OPT).length === 0) {
    const result = emptyMagnitudeResult({
      error: 'this question has no lettered options -- MAGNITUDE ranks options and cannot run without them',
    });
    return { result, summary: summaryLine({}, result) };
  }
  const optSafe: Record<string, string> = OPT;
  const all = Object.keys(optSafe);

  const findRaw = (id: string): unknown | null => priorResults.find((r) => r.id === id)?.raw ?? null;
  const softballsRaw = findRaw('Softballs:1') as SoftballsResult | null;
  const namedSetRaw = findRaw('NamedSet:1') as NamedSetResult | null;
  const discriminatorRaw = findRaw('Discriminator:1') as DiscriminatorResult | null;

  const anyFrameStepRan = Boolean(softballsRaw?.ok || namedSetRaw?.ok || discriminatorRaw?.ok);
  if (!anyFrameStepRan) {
    const result = emptyMagnitudeResult({
      error: 'no frame was established -- Softballs:1, NamedSet:1, or Discriminator:1 must run '
        + '(and succeed) earlier in this same stack before MAGNITUDE can rank anything; ranking '
        + 'the full option list is exactly the unframed magnitude answer FD-BP153-01 forbids',
    });
    return { result, summary: summaryLine(OPT, result) };
  }

  const { eliminated, contradiction } = deriveTerminatorEliminations(
    optSafe,
    softballsRaw?.ok ? softballsRaw : null,
    namedSetRaw?.ok ? namedSetRaw : null,
    discriminatorRaw?.ok ? discriminatorRaw : null,
  );
  if (contradiction) {
    const result = emptyMagnitudeResult({
      error: `the frame is self-contradictory (${contradiction.reason}) -- MAGNITUDE refuses to rank on a contradictory frame`,
    });
    return { result, summary: summaryLine(OPT, result) };
  }
  const eliminatedLetters = new Set(eliminated.map((e) => e.letter));
  const frame = all.filter((L) => !eliminatedLetters.has(L));
  if (frame.length < 2) {
    const result = emptyMagnitudeResult({
      frame,
      error: `the frame has ${frame.length} survivor(s) -- nothing to rank (a unique or empty frame does not need magnitude)`,
    });
    return { result, summary: summaryLine(OPT, result) };
  }

  const property = deriveMagnitudeSuperlativeProperty(input.question);
  if (!property) {
    const result = emptyMagnitudeResult({
      frame,
      error: 'could not determine the superlative property this question names (no "one of X"/"considered X" phrase found) -- refusing rather than guessing what to rank by',
    });
    return { result, summary: summaryLine(OPT, result) };
  }
  const targetExtreme = deriveMagnitudeTargetExtreme(input.question, property);
  const query = buildMagnitudeQuery(property, frame, optSafe);
  const namesAnyFrameOption = (t: string) => frame.some((L) => appearsIn(t, optSafe[L]));
  const mcOptions = frame.map((L) => `${L}) ${optSafe[L]}`);

  // STAGE 0, D-BP154-043, NEW: THE FROZEN SOURCE. Tried FIRST, before owned evidence/the
  // conversational authority -- Founder's own correction: a magnitude ranking must be grounded in
  // "a single frozen source and year defining boundaries and densities for ALL surviving regions...
  // Not model recall." Only ever taken as the ranking basis when it covers EVERY frame member with
  // a verified, numerically-comparable figure from the SAME document; otherwise this is reported
  // (frozenSource on the result, below) and the pre-existing owned-evidence/conversational/
  // corroboration pipeline runs exactly as it always has.
  const frozenSource = await attemptFrozenDensitySource(ctx, frame, optSafe, property);
  if (frozenSource.obtained && frozenSource.numericallyRankable) {
    const sorted = [...frozenSource.entries].sort(
      (a, b) => (parseDensityFigure(b.figureText) ?? 0) - (parseDensityFigure(a.figureText) ?? 0),
    );
    const order: MagnitudeOrderEntry[] = sorted.map((e) => ({ letter: e.letter, name: e.name, span: e.span }));
    const extremeEntry = targetExtreme === 'least' ? order[order.length - 1] : order[0];
    const corroboration = extremeEntry
      ? await corroborateClaim(ctx, buildMagnitudeCorroborationQuery(property, extremeEntry, targetExtreme), extremeEntry.name)
      : undefined;
    const result: MagnitudeResult = {
      ok: true, frame, property, targetExtreme, query, frozenSource, order, discarded: 0, unranked: [],
      via: `frozen-source: "${frozenSource.sourceTitle}" (${frozenSource.sourceUrl})`,
      answerProvenance: {
        mechanism: 'DOCUMENT_CORROBORATION',
        sourceId: `document:${frozenSource.sourceUrl}`,
        detail: `single frozen source covering every survivor: ${frozenSource.sourceTitle} (${frozenSource.sourceUrl})`,
      },
      corroboration, disagreement: null,
    };
    return { result, summary: summaryLine(OPT, result) };
  }

  // D-BP154-022 FIX, live-measured this ticket: the FIRST live run against a real, clean, fully-
  // stated ordering ("...the full order from most to least ... is C) ... as the most ..., A) ...
  // as the second most ..., and F) ... as the least ...") returned `order: []` -- the local
  // extraction model appears to have looked for a SEPARATE sentence per option and, finding all
  // three named inside ONE compound sentence, extracted nothing rather than guess how to split
  // it. This is an INSTRUCTION-CLARITY fix only, not a relaxation of the verify choke point below
  // (verifyMagnitudeOrder's own verbatim-span + appearsIn checks are UNCHANGED and still both
  // required) -- explicitly permitting the SAME whole sentence to be copied as the span for more
  // than one entry when a single sentence states the whole order, exactly as the passage above
  // does. A span still has to be genuinely present in the passage AND about the named option;
  // this only tells the model that "its own clause" and "its own sentence, shared with others" are
  // both acceptable shapes.
  const instruction = `From the passage, list the options below in the order the passage states `
    + `-- from the one it says is MOST "${property}" to the one it says is LEAST. For each one, `
    + `copy the exact verbatim sentence or clause that states its relative position -- if the `
    + `passage states the WHOLE order in one sentence, copy that SAME whole sentence as the span `
    + `for every option it names, do not leave options out just because they share one sentence. `
    + `Do not include an option the passage does not place in the order -- an omission is not a `
    + `statement. Options: ${frame.map((L) => `${L}) ${optSafe[L]}`).join('; ')}`;
  const shape = '{"order":[{"name":"exact option name from the list, in the stated most-to-least order","span":"verbatim sentence or clause stating its relative position -- may repeat the same sentence across entries if one sentence names them all"}]}';

  async function extractFrom(candidateText: string): Promise<{
    order: MagnitudeOrderEntry[]; discarded: number; extractionError?: string;
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
      return { order: [], discarded: 0, extractionError: cause };
    }
    const { order, discarded } = verifyMagnitudeOrder(ex.order, candidateText, frame, optSafe);
    return { order, discarded };
  }

  // STAGE 1: OWNED EVIDENCE FIRST -- EVERY candidate that names a frame option is extracted
  // independently (not just the first match, unlike the other three steps' simpler loop), so a
  // genuine cross-source DISAGREEMENT can be detected rather than silently picking whichever
  // candidate happened to be gathered first (this step's own dispatch, point 5).
  const ownedCandidates = [
    ...(await gatherMortgageCandidates(input.qid, query)),
    ...gatherThisRunCandidates(ctx),
  ];
  const productiveOwned: Array<{
    text: string; via: string; provenance: ClaimProvenance;
    extraction: { order: MagnitudeOrderEntry[]; discarded: number };
  }> = [];
  for (const c of ownedCandidates) {
    if (!namesAnyFrameOption(c.text)) continue;
    // eslint-disable-next-line no-await-in-loop -- bounded, small candidate list; each must be
    // extracted independently to detect a genuine disagreement, not a fan-out worth parallelizing.
    const extraction = await extractFrom(c.text);
    if (extraction.order.length > 0) {
      productiveOwned.push({ text: c.text, via: c.via, provenance: c.provenance, extraction });
    }
  }
  for (let i = 1; i < productiveOwned.length; i++) {
    if (magnitudeOrdersDisagree(productiveOwned[0].extraction.order, productiveOwned[i].extraction.order)) {
      const result = emptyMagnitudeResult({
        frame, property, targetExtreme, query, frozenSource,
        disagreement: { detailA: productiveOwned[0].via, detailB: productiveOwned[i].via },
        error: `the ordering is CONTRADICTED across independent sources (${productiveOwned[0].via} vs `
          + `${productiveOwned[i].via}) -- reported as a disagreement, never resolved by force`,
      });
      return { result, summary: summaryLine(OPT, result) };
    }
  }

  let text = '';
  let via = '';
  let provenance: ClaimProvenance | undefined;
  let extraction: { order: MagnitudeOrderEntry[]; discarded: number; extractionError?: string } | null = null;
  if (productiveOwned.length > 0) {
    text = productiveOwned[0].text; via = productiveOwned[0].via;
    provenance = productiveOwned[0].provenance; extraction = productiveOwned[0].extraction;
  }

  // STAGE 2: GEMINI ANSWERS (FD-BP154-02) -- tried when nothing owned was productive.
  let conversationalError: string | undefined;
  if (!extraction || extraction.order.length === 0) {
    const cr = await tryConversationalAuthority(ctx, query, mcOptions);
    if (cr.ok && namesAnyFrameOption(cr.text)) {
      const cExtraction = await extractFrom(cr.text);
      if (cExtraction.order.length > 0 || !text) {
        text = cr.text; via = cr.via; provenance = cr.provenance; extraction = cExtraction;
      }
    } else {
      conversationalError = cr.error ?? 'conversational authority answered but named no frame option';
    }
  }

  if (!text) {
    const result = emptyMagnitudeResult({
      frame, property, targetExtreme, query, frozenSource,
      error: `no usable answer from any authority -- owned evidence: ${ownedCandidates.length} candidate(s) tried, none usable; `
        + `conversational authority: ${conversationalError ?? 'not tried'} -- THE MAGNITUDE is UNAVAILABLE, not "no ordering stated"`,
    });
    return { result, summary: summaryLine(OPT, result) };
  }
  if (!extraction || extraction.extractionError) {
    const result = emptyMagnitudeResult({
      frame, property, targetExtreme, query, frozenSource, via,
      error: `extraction failed -- ${extraction?.extractionError ?? 'the local extraction model failed for an unclassified reason'} -- reported as a FAILURE, never an empty "no ordering stated"`,
    });
    return { result, summary: summaryLine(OPT, result) };
  }
  if (extraction.order.length === 0) {
    const result = emptyMagnitudeResult({
      frame, property, targetExtreme, query, frozenSource, via, discarded: extraction.discarded,
      error: `no usable answer from any authority -- the credited passage (${via}) produced zero verified `
        + `ordering entries (${extraction.discarded} candidate(s) discarded for no verifiable span) -- `
        + `THE MAGNITUDE is UNAVAILABLE, not "no ordering stated"`,
    });
    return { result, summary: summaryLine(OPT, result) };
  }

  const orderedLetters = new Set(extraction.order.map((e) => e.letter));
  const unranked = frame.filter((L) => !orderedLetters.has(L));

  // STAGE 3: GOOGLE CORROBORATES A NAMED CLAIM -- ONE query, for the single decisive claim only
  // (the extreme entry this step's own targetExtreme reading selects).
  const extremeEntry = targetExtreme === 'least'
    ? extraction.order[extraction.order.length - 1]
    : extraction.order[0];
  let corroboration: CorroborationResult | undefined;
  if (extremeEntry) {
    corroboration = await corroborateClaim(
      ctx, buildMagnitudeCorroborationQuery(property, extremeEntry, targetExtreme), extremeEntry.name,
    );
  }

  const result: MagnitudeResult = {
    ok: true, frame, property, targetExtreme, query, frozenSource, order: extraction.order, discarded: extraction.discarded,
    unranked, via, answerProvenance: provenance, corroboration, disagreement: null,
  };
  return { result, summary: summaryLine(OPT, result) };
}

// ───────────────────────── registration (inert until stacked and run) ─────────────────────────

const MAGNITUDE_DECLARATION: StepDeclaration = {
  id: 'liana_cycle.magnitude_step.runMagnitudeStep',
  version: '1',
  sourceFile: 'src/main/liana_cycle/library/magnitude_step.ts',
  sourceLine: 1,
  exportName: 'runMagnitudeStep',
  exportKind: 'function',
  whatItDoes:
    'Ranks ONLY the survivors the frame left (Softballs:1/NamedSet:1/Discriminator:1\'s own '
    + 'already-computed eliminations, reused via terminator_step.ts\'s deriveTerminatorEliminations(), '
    + 'never the full option list) by the superlative property the question names -- tried against '
    + 'owned evidence first (every candidate, so a genuine cross-source disagreement can be found), '
    + 'then the conversational authority (Gemini), which answers it (FD-BP154-02); shows exactly '
    + 'what the source stated for the order, with the verbatim sentence it said so in, plus ONE '
    + 'Google corroboration naming a third-party document for the decisive (extreme) claim. Refuses '
    + 'to run at all when no frame was established, the frame is self-contradictory, or the frame '
    + 'has fewer than two survivors. Never guesses an ordering, never supplies a magnitude figure '
    + 'from its own knowledge, and reports a genuine cross-source disagreement rather than '
    + 'resolving it by force.',
  inputs: 'MethodQuestionInput (question, options, qid) plus MethodRunContext (askGoogle, askConversationalAuthority, ownedPassages, emit) '
    + 'plus the accumulated results of any Softballs:1/NamedSet:1/Discriminator:1 steps already run earlier in the same stack, to runMagnitudeStep().',
  outputs: 'Promise<{ result: MagnitudeResult, summary: string }> -- the frame this ranking was restricted to, the target '
    + 'extreme the question demands, the stated order with verbatim spans, discard counts, the answer mechanism, '
    + 'a document corroboration attempt, and any cross-source disagreement found.',
  decidesOrReports: 'DECIDES_AND_REFUSES',
  queryText: {
    issuesQuery: true,
    description: 'One primary ranking question per run, restricted to the frame -- owned evidence tried first (every candidate), '
      + 'then the conversational authority (FD-BP153-01 magnitude-within-the-frame, FD-BP154-02) -- plus at most one Google '
      + 'corroboration query for the single decisive (extreme) claim, hardcoded inline in this file.',
    loadedFromQueryResource: false,
  },
  attribution: {
    kind: 'ATTRIBUTED',
    founderRuling: 'BP153/BP154',
    quote:
      'A superlative resolves by magnitude, ranked WITHIN THE FRAME. The frame is established '
      + 'first: which options are legitimate members of the category the question names, and '
      + 'which are not. Non-members are removed and are never ranked. Magnitude decides only '
      + 'among the survivors.',
    citedAt: 'FD-BP153-01 (completing FD-BP152-38, "Yes. that. now code it, please"), D-BP154-022',
  },
  orphanEvidence:
    'N/A -- not an orphan. Live: registered via registerMagnitudeStep() (this file), executed '
    + 'by script_bridge.ts\'s runOneStep() for id "Magnitude:1", the same wiring pattern '
    + 'Softballs:1, NamedSet:1, Discriminator:1, and Terminator:1 already use.',
};

/** Registers 'Magnitude:1'. Called from script_bridge.ts's ensureRegistryPopulated(),
 *  idempotently -- same try/catch shape as the other Composer step registrations there. */
export function registerMagnitudeStep(): MethodIdentity {
  return registerNameNumbered('Magnitude', 1, MAGNITUDE_DECLARATION);
}
