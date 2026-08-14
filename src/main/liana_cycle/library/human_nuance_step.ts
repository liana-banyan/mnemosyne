// human_nuance_step.ts -- D-BP154-030/BISHOP-SEG/S30/seg-humannuance
//
// THE HUMAN NUANCE FACTOR AS A COMPOSER STEP. FD-BP154-07/07a (RULINGS_BP154.md), Founder,
// verbatim: "We have to apply the Human Nuance Factor - and since you are not a human, you need to
// go find out which human nuance applies to each question." A question is an ARTIFACT made by
// someone, for a purpose, in a form -- the artifact's OWN properties are admissible evidence,
// independent of its content. Runtime, act structure and star billing tell you a movie's hero
// survives minute 17 without reading one line of the script; `src`, curriculum level and assessment
// format tell you what an MMLU-Pro item is asking without settling the geography.
//
// FOUR PARTS, IN ORDER, EXACTLY AS RULED:
//   1. ESTABLISH THE ARTIFACT CLASS FROM STATED METADATA -- never from a feeling about the
//      question. Read here: `input.originSrc` (method_registry.ts), itself backfilled OFFLINE by
//      scripts/backfill_mmlu_pro_origin_src.mjs from TIGER-Lab/MMLU-Pro's own stated `src` column
//      (D-BP154-030 amendment: BACKFILL, not a live fetch -- see that script's header for why).
//      Absent `originSrc` -> artifact class UNESTABLISHED -> this step applies NO nuance at all and
//      changes nothing (the cow guard below, never optional).
//   2. THE CORPUS-WIDE META-TRUTH (FD-BP154-07a) -- "all MMLU-Pro are written for humans, or to
//      tell how well technology can mimic humans." Established ONCE, corpus-wide, as an ATTRIBUTED
//      Founder ruling (the same StepDeclaration.attribution shape terminator_step.ts's UNIQUE OR
//      ABSTAIN and magnitude_step.ts's ranking rule already use) -- NEVER re-derived per item,
//      NEVER extracted from a live source at runtime (there is nothing to extract; it is a ruling,
//      not a fact this file discovers).
//   3. THE COW GUARD -- Founder's own example, verbatim: "white, white, white -- what do cows
//      drink?" Human nuance answers MILK, and milk is WRONG; deterministic analysis answers WATER,
//      and water is right. A curriculum test item REWARDS the convention; a priming demonstration
//      or trick item PUNISHES it. This step never applies nuance blind -- it requires the artifact
//      class from part 1 (a specific `originSrc` for THIS item, confirming it really is a
//      provenanced MMLU-Pro item and not, say, a mislabeled or free-text row) BEFORE invoking the
//      corpus-wide meta-truth from part 2. No stated source anywhere in this corpus's own metadata
//      marks any item as a priming/trick demonstration (checked: MMLU-Pro's own documented purpose,
//      cited in the corpus meta-truth above, is testing curriculum/professional knowledge, not
//      psychology priming) -- so the guard PASSES whenever the artifact class is established, and
//      is reported plainly as UNAVAILABLE, never assumed, when it is not.
//   4. READ THE OPTION SET AS AUTHORED EVIDENCE. Founder's own correction, verbatim: "those three
//      aren't considered at all when defining world regions of population, because desert and
//      jungle are not considered world regions - because of their lack of usual human settlement
//      and therefore population." Generalized (never hardcoded to qid 98, HARDWIRE-22): the
//      ORIGIN's own (pre-augmentation) option set is the frame the item was actually written
//      against (BP154_QID98_RESOLVED_THE_AUGMENTATION_DEFECT.md's own finding, corroborated
//      independently by the Founder's hand-worked frame). Every augmented option OUTSIDE that
//      frame is a candidate for elimination -- ONE query (FD-BP153-01 consequence 4, "one query,
//      not one per option") asks a source to STATE, for each such option, the reason it is not
//      usually considered a member of the category -- e.g. "sparsely settled" for a population
//      category, but the query text itself never names "population" or any specific category; it
//      reads the category the QUESTION itself names (deriveHumanNuanceCategory, below), the same
//      structural read every other Composer step already does. Every value carries a verbatim span
//      or is discarded and counted (HARDWIRE-22). An option the source does not address is
//      UNRESOLVED, never silently eliminated (absence is omission, terminator_step.ts's own
//      D-BP154-024 law, applied identically here).
//
// THE LINE, UNRELAXED:
//   - HARDWIRE-22: extraction only, never judgment. This file never asks a model to decide, judge,
//     or infer intent -- only to copy a stated reason, with its verbatim span.
//   - NO RULE HERE MAY SELECT A PARTICULAR LETTER (FD-BP153-06) -- deriveHumanNuanceCategory(),
//     the frame/nonParticipants split, and the extraction verify-choke-point all treat every option
//     letter identically; nothing branches on option identity.
//   - THE RUNTIME STAYS BLIND (D-BP153-003). This file never reads `answer`/`answer_index` --
//     origin_provenance_store.ts's own reader does not expose those fields even if a foreign eblet
//     somehow carried one (explicit allowlist, not a passthrough spread).
//   - classify_cascade.ts is FORBIDDEN and was not read to build this file. Only the same generic,
//     already-shared primitives comparative_cascade.ts exports (appearsIn/gemmaExtract/list/
//     toLetters), read-only, unmodified, plus composer_step_evidence.ts's own shared
//     "owned evidence -> Gemini answers -> Google corroborates" plumbing (D-BP154-014), identical
//     to softballs_step.ts/named_set_step.ts/discriminator_step.ts/magnitude_step.ts.
//   - `googleBlocks()` is used only via corroborateClaim() (composer_step_evidence.ts), never
//     called directly here -- same boundary every sibling step observes.
//
// OUT OF SCOPE, THIS TICKET: wiring this step's `excluded` output into
// terminator_step.ts's deriveTerminatorEliminations() (the way Softballs:1/NamedSet:1/
// Discriminator:1 already are). That would touch TerminatorResult's stepsConsulted union type and
// every one of its six return sites -- a real, separate piece of work, and terminator_step.ts's
// most recent commit (029f8d58) is inside this ticket's own "locked, unmodified" boundary. This
// step is built and registered standalone, exactly as Softballs:1/NamedSet:1/Discriminator:1 were
// before D-BP154-018 wired the Terminator to consume them -- the same sequencing, not a shortcut.

import {
  appearsIn, gemmaExtract, toLetters,
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
import { loadOriginProvenance } from './origin_provenance_store';
import type { OriginProvenance } from './origin_provenance_store';

// ───────────────────── pure parts (unit-testable without a live Ollama/browser) ─────────────────────

/** Reads the category noun phrase the question itself names -- byte-identical shape to
 *  softballs_step.ts's/discriminator_step.ts's own category parser (duplicated locally, not
 *  imported -- "steps stay self-contained", the same discipline every sibling step's own header
 *  already states). Pure text-structure parsing, never a judgment -- returns null (never a guess)
 *  when the question does not fit this shape. */
export function deriveHumanNuanceCategory(question: string): string | null {
  const m = question.match(/following\s+([a-z][a-z\s]*?)\s+(?:is|are)\b/i);
  const category = m ? m[1].trim() : '';
  return category || null;
}

// D-BP154-030 PART 2 -- THE CORPUS-WIDE META-TRUTH. Founder, FD-BP154-07a, verbatim: "all MMLU-Pro
// are written for humans, or to tell how well technology can mimic humans - which is the meta
// truth to apply." A constant, established ONCE (this module load), never re-derived per item --
// an ATTRIBUTED Founder ruling, not an extraction (there is no source to extract it FROM; the
// Founder ruled it directly, the same status terminator_step.ts's own UNIQUE OR ABSTAIN and
// magnitude_step.ts's own ranking rule already carry).
export const CORPUS_META_TRUTH = {
  statement:
    'Every MMLU-Pro item is a human-authored assessment artifact with exactly one intended '
    + 'answer, or a probe of whether a machine reproduces human answering.',
  attribution: 'Founder ruling, FD-BP154-07a',
  citedAt: 'LianaBanyanPlatform/BISHOP_DROPZONE/RULINGS_BP154.md FD-BP154-07a',
} as const;

export interface CowGuardResult {
  applies: boolean;
  reason: string;
}

/** PART 3 -- THE COW GUARD, never optional, always run BEFORE any convention is applied. Pure,
 *  synchronous, no I/O: everything it needs (whether THIS item's own artifact class is
 *  established) is already in hand from part 1. Returns `applies: false` whenever `originSrc` is
 *  absent -- exactly the Founder's own rule: "If the artifact class cannot be established from
 *  stated metadata, the step does not apply nuance at all." */
export function evaluateCowGuard(originSrc: string | undefined): CowGuardResult {
  if (!originSrc) {
    return {
      applies: false,
      reason: 'artifact class UNAVAILABLE -- this input carries no stated origin_src (free-text '
        + 'question, or a bundled qid the backfill pass has not yet touched). Per FD-BP154-07: '
        + '"if the artifact class cannot be established... the step does not apply nuance at all". '
        + 'Human Nuance Factor NOT applied; nothing changed.',
    };
  }
  return {
    applies: true,
    reason: `artifact class established (src="${originSrc}") -- this item is a confirmed member of `
      + `the MMLU-Pro corpus (${CORPUS_META_TRUTH.attribution}: "${CORPUS_META_TRUTH.statement}"). `
      + 'No stated source in this corpus\'s own metadata marks any item as a priming/trick '
      + 'demonstration (the corpus\'s own documented purpose is testing curriculum/professional '
      + 'knowledge) -- the artifact REWARDS the convention, not punishes it. Human Nuance Factor '
      + 'applies.',
  };
}

export interface HumanNuanceFrame {
  /** The origin's own option letters, mapped into THIS run's own option lettering by exact
   *  normalized-text identity (toLetters) -- never a fresh guess at which options "belong". */
  frameLetters: string[];
  /** Every option letter NOT in frameLetters -- the augmentation's own additions, read structurally
   *  from the option-count delta, never hand-picked. */
  nonParticipants: string[];
  /** How many of the origin's own stated options failed to map to any letter in THIS run's option
   *  set -- reported so a text mismatch (rare: the corpus text should be byte-identical) is visible
   *  rather than silently shrinking the frame. */
  unmatchedOriginOptions: number;
}

/** Reads the option set as authored evidence, STRUCTURALLY (PART 4's own first half -- "the
 *  kind-pattern the option set establishes, which options participate and which do not"). Pure,
 *  synchronous: a straightforward toLetters() lookup, the same primitive every other step already
 *  uses to map a stated name back to a letter. No judgment, no per-question branching. */
export function deriveHumanNuanceFrame(
  origin: OriginProvenance['origin'],
  OPT: Record<string, string>,
): HumanNuanceFrame | null {
  if (!origin || origin.options.length === 0) return null;
  const frameLetters = toLetters(origin.options, OPT);
  const all = Object.keys(OPT);
  const nonParticipants = all.filter((L) => !frameLetters.includes(L));
  return {
    frameLetters,
    nonParticipants,
    unmatchedOriginOptions: origin.options.length - frameLetters.length,
  };
}

/** PART 4's own second half -- ONE query (FD-BP153-01 consequence 4), asking a source to STATE,
 *  for every non-participant, the reason it is not usually considered a member of `category`.
 *  Generic across categories -- never names "population", "settlement", or any of qid 98's own
 *  words; those come only from whatever the SOURCE states back. */
export function buildHumanNuanceExclusionQuery(
  category: string, nonParticipants: string[], OPT: Record<string, string>,
): string {
  const list = nonParticipants.map((L) => `${L}) ${OPT[L]}`).join('; ');
  return `For each of the following, state the reason (if any) it would NOT usually be considered `
    + `part of "${category}" -- quote or closely paraphrase the source's own stated reason. Do not `
    + `guess about ones you are not sure of; simply do not mention those. ${list}`;
}

export interface HumanNuanceExclusionEntry {
  letter: string;
  name: string;
  /** The stated reason, verbatim as the source phrased it. */
  reason: string;
  /** The verbatim span (sentence or clause) proving the source itself stated this. */
  span: string;
}

type RawExclusionEntry = { name?: unknown; reason?: unknown; span?: unknown };

// D-BP154-033/BISHOP-SEG/S30-continuation/seg-namedset-prefix, PORTED. LIVE-MEASURED this same
// ticket: this step's own live run (qid 98) got a real, unambiguous Gemini answer for G) Arctic
// Circle, and the local extraction model echoed the option list's own "G) " letter-prefix back
// into its `name` field -- the SAME defect class softballs_step.ts's own verifyExcludedEntries()
// already fixed (D-BP154-015, stripListLetterPrefix()) and named_set_step.ts was just fixed to
// match (D-BP154-033). Mirrored verbatim here, not imported (each Composer step stays
// self-contained, per every sibling step's own header) -- see softballs_step.ts:131-133's own
// stripListLetterPrefix() for the full original reasoning.
function stripListLetterPrefix(name: string): string {
  return name.replace(/^[A-Za-z]\)\s*/, '');
}

/** THE VERIFY-THE-SPAN CHOKE POINT (FD-BP153-07 FIX 2), same four-part discipline every sibling
 *  step's own verify function already applies: (a) non-empty `name`, (b) maps to a KNOWN
 *  non-participant option (an option ALREADY in the frame is never a candidate here -- part 4 only
 *  ever speaks about non-participants), (c) non-empty `reason`, (d) non-empty `span`, (e) span
 *  VERBATIM in `passage`, (f) span itself ABOUT the named option (appearsIn). Any failure of
 *  (c)/(d)/(e)/(f) is a DISCARD and is counted. A `name` mapping to no known option letter, even
 *  after stripListLetterPrefix() (D-BP154-033) is tried, is simply not a match. */
export function verifyHumanNuanceExclusions(
  raw: unknown,
  passage: string,
  nonParticipants: string[],
  OPT: Record<string, string>,
): { excluded: HumanNuanceExclusionEntry[]; discarded: number } {
  const entries = Array.isArray(raw) ? (raw as RawExclusionEntry[]) : [];
  const nonParticipantSet = new Set(nonParticipants);
  const excluded: HumanNuanceExclusionEntry[] = [];
  const seen = new Set<string>();
  let discarded = 0;
  for (const entry of entries) {
    const name = typeof entry?.name === 'string' ? entry.name.trim() : '';
    const reason = typeof entry?.reason === 'string' ? entry.reason.trim() : '';
    const span = typeof entry?.span === 'string' ? entry.span.trim() : '';
    if (!name) continue; // nothing named -- not a candidate value, not a discard
    let matched = toLetters([name], OPT);
    if (matched.length === 0) {
      const stripped = stripListLetterPrefix(name);
      if (stripped !== name) matched = toLetters([stripped], OPT);
    }
    if (matched.length === 0) continue; // names no known option -- not a candidate value here
    const L = matched[0];
    if (!nonParticipantSet.has(L)) continue; // names a FRAME option -- part 4 never speaks about those; not a discard
    if (!reason || !span || !spanIsVerbatimInPassage(passage, span) || !appearsIn(span, OPT[L])) {
      discarded++;
      continue;
    }
    if (seen.has(L)) continue; // one entry per option; a repeat is neither kept nor double-counted
    seen.add(L);
    excluded.push({ letter: L, name: OPT[L], reason, span });
  }
  return { excluded, discarded };
}

export interface HumanNuanceResult {
  ok: boolean;
  artifactClassEstablished: boolean;
  src: string | null;
  corpusMetaTruth: typeof CORPUS_META_TRUTH | null;
  cowGuard: CowGuardResult | null;
  category: string | null;
  /** The origin's own option letters, mapped into this run's lettering -- null when part 4 could
   *  not run at all (no origin provenance on file for this item). */
  frame: string[] | null;
  nonParticipants: string[];
  originStratum: string | null;
  /** D-BP154-030 amendment 3 fields, surfaced for transparency ONLY -- never read by this file to
   *  decide or eliminate anything (that would be lookup, not derivation). Null except where an
   *  already-obtained, cited finding exists (today: campaign qid 98 only). */
  singleAnswerPropertySurvived: boolean | null;
  answerDerivableFromQuestionTermsAlone: boolean | null;
  query: string | null;
  excluded: HumanNuanceExclusionEntry[];
  discarded: number;
  /** Non-participants for which no sourced reason was obtained -- ABSENCE IS OMISSION, never
   *  conflated with "confirmed a member after all". */
  unresolved: string[];
  via: string;
  answerProvenance?: ClaimProvenance;
  corroboration?: CorroborationResult;
  error?: string;
}

function emptyHumanNuanceResult(overrides: Partial<HumanNuanceResult> & { error: string }): HumanNuanceResult {
  return {
    ok: false, artifactClassEstablished: false, src: null, corpusMetaTruth: null, cowGuard: null,
    category: null, frame: null, nonParticipants: [], originStratum: null,
    singleAnswerPropertySurvived: null, answerDerivableFromQuestionTermsAlone: null,
    query: null, excluded: [], discarded: 0, unresolved: [], via: 'n/a',
    ...overrides,
  };
}

function summaryLine(OPT: Record<string, string>, r: HumanNuanceResult): string {
  if (!r.ok) return `HUMAN NUANCE: FAILED -- ${r.error}`;
  const guardText = r.cowGuard ? `${r.cowGuard.applies ? 'PASSES' : 'DOES NOT APPLY'} -- ${r.cowGuard.reason}` : '(not evaluated)';
  const frameText = r.frame ? `{${r.frame.join(', ')}}` : '(unavailable -- no origin provenance on file for this item)';
  const npText = r.nonParticipants.length ? r.nonParticipants.map((L) => `${L}) ${OPT[L] ?? '?'}`).join(', ') : '(none)';
  const exText = r.excluded.length
    ? r.excluded.map((e) => `${e.letter}) ${e.name} -- "${e.reason}" [source: "${e.span}"]`).join('  |  ')
    : '(none stated)';
  const unresolvedText = r.unresolved.length ? r.unresolved.map((L) => `${L}) ${OPT[L] ?? '?'}`).join(', ') : '(none)';
  const discardNote = r.discarded ? ` -- discarded ${r.discarded} candidate(s) with no verifiable span` : '';
  const provenanceNote = r.answerProvenance ? `  ||  ANSWERED VIA ${r.answerProvenance.mechanism}: ${r.answerProvenance.detail}` : '';
  const corrobNote = r.corroboration ? `  ||  ${summarizeCorroboration(r.corroboration)}` : '';
  const survivedNote = r.singleAnswerPropertySurvived === null ? '(not determined)' : String(r.singleAnswerPropertySurvived);
  const derivableNote = r.answerDerivableFromQuestionTermsAlone === null ? '(not determined)' : String(r.answerDerivableFromQuestionTermsAlone);
  return `HUMAN NUANCE -- ARTIFACT CLASS: ${r.artifactClassEstablished ? `established (src="${r.src}")` : 'UNESTABLISHED'}  ||  `
    + `CORPUS META-TRUTH: ${r.corpusMetaTruth?.statement ?? '(n/a)'}  ||  COW GUARD: ${guardText}  ||  `
    + `FRAME (origin's own option set): ${frameText}  ||  NON-PARTICIPANTS (augmentation additions): ${npText}  ||  `
    + `EXCLUDED (source-stated reasons, verified): ${exText}${discardNote}  ||  `
    + `UNRESOLVED (source silent -- omission, not a member): ${unresolvedText}  ||  `
    + `single-answer property survived augmentation: ${survivedNote}  ||  `
    + `answer derivable from question's own terms alone: ${derivableNote}`
    + `${provenanceNote}${corrobNote}`;
}

// ───────────────── the live step (artifact class -> cow guard -> frame -> owned evidence -> conversational -> corroboration) ─────────────────

export async function runHumanNuanceStep(
  input: MethodQuestionInput,
  ctx: MethodRunContext,
): Promise<{ result: HumanNuanceResult; summary: string }> {
  const OPT = input.options;
  if (!OPT || Object.keys(OPT).length === 0) {
    const result = emptyHumanNuanceResult({
      error: 'this question has no lettered options -- HUMAN NUANCE reads the option set and cannot run without them',
    });
    return { result, summary: summaryLine({}, result) };
  }
  const optSafe: Record<string, string> = OPT;

  // PART 1 -- ARTIFACT CLASS FROM STATED METADATA. Read-only, zero network (Law 9: origin_src is
  // the INDEX, already backfilled offline).
  const src = input.originSrc ?? null;
  const artifactClassEstablished = Boolean(src);

  // PART 2 -- THE CORPUS-WIDE META-TRUTH. Reported whenever the artifact class is established
  // (there is no point stating a corpus fact about an item we cannot even confirm is a member of
  // that corpus).
  const corpusMetaTruth = artifactClassEstablished ? CORPUS_META_TRUTH : null;

  // PART 3 -- THE COW GUARD. Never optional, always evaluated before anything else proceeds.
  const cowGuard = evaluateCowGuard(input.originSrc);
  if (!cowGuard.applies) {
    // ok:true, nothing stated -- classifies as an honest ABSTAIN (statedCount 0 -> "the source was
    // silent"), never an error: the step DID run and DID determine, correctly, that nuance does
    // not apply here. No `error` field -- there was nothing wrong, only nothing to state.
    const result: HumanNuanceResult = {
      ok: true, artifactClassEstablished, src, corpusMetaTruth, cowGuard,
      category: null, frame: null, nonParticipants: [], originStratum: null,
      singleAnswerPropertySurvived: null, answerDerivableFromQuestionTermsAlone: null,
      query: null, excluded: [], discarded: 0, unresolved: [], via: 'n/a',
    };
    return { result, summary: summaryLine(OPT, result) };
  }

  const category = deriveHumanNuanceCategory(input.question);
  if (!category) {
    const result = emptyHumanNuanceResult({
      artifactClassEstablished, src, corpusMetaTruth, cowGuard,
      error: 'could not determine the category this question names (no "following X is/are" phrase found) -- refusing rather than guessing what to read the option set against',
    });
    return { result, summary: summaryLine(OPT, result) };
  }

  // PART 4, FIRST HALF -- THE FRAME. Zero network: reads the already-backfilled origin eblet.
  const originProvenance = input.qid != null ? loadOriginProvenance(input.qid) : null;
  const frameInfo = originProvenance ? deriveHumanNuanceFrame(originProvenance.origin, optSafe) : null;
  const originStratum = originProvenance?.stratum ?? null;
  const singleAnswerPropertySurvived = originProvenance?.singleAnswerPropertySurvived ?? null;
  const answerDerivableFromQuestionTermsAlone = originProvenance?.answerDerivableFromQuestionTermsAlone ?? null;

  if (!frameInfo) {
    const result: HumanNuanceResult = {
      ok: true, artifactClassEstablished, src, corpusMetaTruth, cowGuard, category,
      frame: null, nonParticipants: [], originStratum, singleAnswerPropertySurvived, answerDerivableFromQuestionTermsAlone,
      query: null, excluded: [], discarded: 0, unresolved: [], via: 'n/a',
      error: originProvenance
        ? 'origin provenance is on file for this item but carries no resolved origin option set '
          + `(src="${src}" did not resolve to a known origin family, or the origin lookup failed) -- `
          + 'reading the option set as authored evidence is UNAVAILABLE for this item; nothing changed'
        : 'no origin provenance eblet on file for this item (not yet backfilled -- see '
          + 'scripts/backfill_mmlu_pro_origin_src.mjs) -- reading the option set as authored '
          + 'evidence is UNAVAILABLE for this item; nothing changed',
    };
    return { result, summary: summaryLine(OPT, result) };
  }

  if (frameInfo.nonParticipants.length === 0) {
    const result: HumanNuanceResult = {
      ok: true, artifactClassEstablished, src, corpusMetaTruth, cowGuard, category,
      frame: frameInfo.frameLetters, nonParticipants: [], originStratum, singleAnswerPropertySurvived, answerDerivableFromQuestionTermsAlone,
      query: null, excluded: [], discarded: 0, unresolved: [], via: 'n/a',
      error: 'the origin\'s own option set already covers every option in this run -- no augmentation '
        + 'additions to read a reason for; nothing to eliminate',
    };
    return { result, summary: summaryLine(OPT, result) };
  }

  // PART 4, SECOND HALF -- ONE QUERY, owned evidence first, then the conversational authority
  // (FD-BP153-04 + FD-BP154-02), then Google corroboration for the single most decisive claim.
  // `nonParticipants` captured into its own const (rather than read as `frameInfo.nonParticipants`
  // inside the closures below) so TS can see it is never-null for the rest of this function --
  // `frameInfo` itself is a `HumanNuanceFrame | null`-typed binding and its narrowing does not
  // survive into a nested function body, even though the early return above already guarantees it.
  const { nonParticipants } = frameInfo;
  const query = buildHumanNuanceExclusionQuery(category, nonParticipants, optSafe);
  const namesAnyNonParticipant = (t: string) => nonParticipants.some((L) => appearsIn(t, optSafe[L]));
  const mcOptions = nonParticipants.map((L) => `${L}) ${optSafe[L]}`);
  const instruction = `From the passage, for each option below, if it explicitly states a reason `
    + `this option would NOT usually be considered part of "${category}", copy that reason (in your `
    + `own brief words) and the exact verbatim sentence or clause that states it. Do not include an `
    + `option the passage does not address this way -- an omission is not a statement. `
    + `Options: ${nonParticipants.map((L) => `${L}) ${optSafe[L]}`).join('; ')}`;
  const shape = '{"excluded":[{"name":"exact option name from the list","reason":"brief stated reason","span":"verbatim sentence or clause"}]}';

  async function extractFrom(candidateText: string): Promise<{
    excluded: HumanNuanceExclusionEntry[]; discarded: number; extractionError?: string;
  }> {
    const rawOut: {
      truncated?: boolean; failureCause?: 'transport' | 'http-error' | 'parse-error'; failureDetail?: string;
    } = {};
    const ex = await gemmaExtract(instruction, candidateText, shape, rawOut);
    if (ex === null) {
      const cause = rawOut.truncated
        ? 'the local extraction model truncated its output before finishing'
        : rawOut.failureCause
          ? `the local extraction model failed (${rawOut.failureCause}${rawOut.failureDetail ? `: ${rawOut.failureDetail}` : ''})`
          : 'the local extraction model failed for an unclassified reason';
      return { excluded: [], discarded: 0, extractionError: cause };
    }
    const r = ex as { excluded?: unknown };
    const { excluded, discarded } = verifyHumanNuanceExclusions(r.excluded, candidateText, nonParticipants, optSafe);
    return { excluded, discarded };
  }

  // STAGE 1: OWNED EVIDENCE FIRST (FD-BP153-04, THE MORTGAGE + this run's own passages).
  const ownedCandidates = [
    ...(await gatherMortgageCandidates(input.qid, query)),
    ...gatherThisRunCandidates(ctx),
  ];
  let text = ''; let via = ''; let provenance: ClaimProvenance | undefined;
  let extraction: { excluded: HumanNuanceExclusionEntry[]; discarded: number; extractionError?: string } | null = null;
  for (const c of ownedCandidates) {
    if (!namesAnyNonParticipant(c.text)) continue;
    // eslint-disable-next-line no-await-in-loop -- bounded, small candidate list, same idiom every
    // sibling step's own owned-evidence loop already uses.
    const owned = await extractFrom(c.text);
    if (owned.excluded.length > 0) {
      text = c.text; via = c.via; provenance = c.provenance; extraction = owned;
      break;
    }
  }

  // STAGE 2: THE CONVERSATIONAL AUTHORITY ANSWERS (FD-BP154-02) -- tried when nothing owned worked.
  let conversationalError: string | undefined;
  if (!extraction || extraction.excluded.length === 0) {
    const cr = await tryConversationalAuthority(ctx, query, mcOptions);
    if (cr.ok && namesAnyNonParticipant(cr.text)) {
      const cExtraction = await extractFrom(cr.text);
      if (cExtraction.excluded.length > 0 || !text) {
        text = cr.text; via = cr.via; provenance = cr.provenance; extraction = cExtraction;
      }
    } else {
      conversationalError = cr.error ?? 'conversational authority answered but named no non-participant option';
    }
  }

  if (!text) {
    const result: HumanNuanceResult = {
      ok: true, artifactClassEstablished, src, corpusMetaTruth, cowGuard, category,
      frame: frameInfo.frameLetters, nonParticipants: frameInfo.nonParticipants, originStratum,
      singleAnswerPropertySurvived, answerDerivableFromQuestionTermsAlone,
      query, excluded: [], discarded: 0, unresolved: frameInfo.nonParticipants, via: 'n/a',
      error: `no usable answer from any authority -- owned evidence: ${ownedCandidates.length} candidate(s) `
        + `tried, none usable; conversational authority: ${conversationalError ?? 'not tried'} -- `
        + 'reading the option set as authored evidence is UNAVAILABLE this run, not "nothing to state"',
    };
    return { result, summary: summaryLine(OPT, result) };
  }
  if (!extraction || extraction.extractionError) {
    const result: HumanNuanceResult = {
      ok: true, artifactClassEstablished, src, corpusMetaTruth, cowGuard, category,
      frame: frameInfo.frameLetters, nonParticipants: frameInfo.nonParticipants, originStratum,
      singleAnswerPropertySurvived, answerDerivableFromQuestionTermsAlone,
      query, excluded: [], discarded: 0, unresolved: frameInfo.nonParticipants, via,
      error: `extraction failed -- ${extraction?.extractionError ?? 'the local extraction model failed for an unclassified reason'}`,
    };
    return { result, summary: summaryLine(OPT, result) };
  }

  const resolvedLetters = new Set(extraction.excluded.map((e) => e.letter));
  const unresolved = frameInfo.nonParticipants.filter((L) => !resolvedLetters.has(L));

  // STAGE 3: GOOGLE CORROBORATES A NAMED CLAIM -- ONE query, for the first resolved exclusion only
  // (same "single decisive claim" discipline every sibling step's own STAGE 3 already applies).
  let corroboration: CorroborationResult | undefined;
  const firstExcluded = extraction.excluded[0];
  if (firstExcluded) {
    corroboration = await corroborateClaim(
      ctx,
      `Is ${firstExcluded.name} usually NOT considered part of "${category}"? If so, what is the `
        + 'stated reason? Answer plainly and directly.',
      firstExcluded.name,
      category,
    );
  }

  const result: HumanNuanceResult = {
    ok: true, artifactClassEstablished, src, corpusMetaTruth, cowGuard, category,
    frame: frameInfo.frameLetters, nonParticipants: frameInfo.nonParticipants, originStratum,
    singleAnswerPropertySurvived, answerDerivableFromQuestionTermsAlone,
    query, excluded: extraction.excluded, discarded: extraction.discarded, unresolved, via,
    answerProvenance: provenance, corroboration,
  };
  return { result, summary: summaryLine(OPT, result) };
}

// ───────────────────────── registration (inert until stacked and run) ─────────────────────────

const HUMAN_NUANCE_DECLARATION: StepDeclaration = {
  id: 'liana_cycle.human_nuance_step.runHumanNuanceStep',
  version: '1',
  sourceFile: 'src/main/liana_cycle/library/human_nuance_step.ts',
  sourceLine: 1,
  exportName: 'runHumanNuanceStep',
  exportKind: 'function',
  whatItDoes:
    'Reads the question ITSELF as evidence, independent of its content: confirms the item\'s '
    + 'artifact class from stated corpus metadata (never a feeling about the question), states the '
    + 'corpus-wide meta-truth this class carries, and -- only when a curriculum-test artifact class '
    + 'is confirmed (the cow guard) -- reads the origin\'s own (pre-augmentation) option set as the '
    + 'frame the item was actually written against, then asks a source for the STATED reason each '
    + 'augmentation-added option does not belong. Reports UNAVAILABLE and changes nothing when the '
    + 'artifact class cannot be established.',
  inputs: 'MethodQuestionInput (question, options, qid, originSrc) plus MethodRunContext (askGoogle, askConversationalAuthority, ownedPassages, emit) to runHumanNuanceStep().',
  outputs: 'Promise<{ result: HumanNuanceResult, summary: string }> -- artifact class, the corpus '
    + 'meta-truth, the cow guard verdict, the origin-derived frame, and per-option stated exclusion '
    + 'reasons with verbatim spans, discard counts, the answer mechanism, and a document corroboration attempt.',
  decidesOrReports: 'DECIDES_AND_REFUSES',
  queryText: {
    issuesQuery: true,
    description: 'One primary exclusion-reason question per run, restricted to the augmentation\'s '
      + 'own non-participant options -- owned evidence tried first, then the conversational '
      + 'authority (FD-BP154-07, FD-BP154-02) -- plus at most one Google corroboration query for a '
      + 'single decisive claim, hardcoded inline in this file.',
    loadedFromQueryResource: false,
  },
  attribution: {
    kind: 'ATTRIBUTED',
    founderRuling: 'BP154',
    quote:
      'We have to apply the Human Nuance Factor - and since you are not a human, you need to go '
      + 'find out which human nuance applies to each question... those three aren\'t considered at '
      + 'all when defining world regions of population, because desert and jungle are not '
      + 'considered world regions - because of their lack of usual human settlement and therefore '
      + 'population.',
    citedAt: 'LianaBanyanPlatform/BISHOP_DROPZONE/RULINGS_BP154.md FD-BP154-07/FD-BP154-07a',
  },
  orphanEvidence:
    'N/A -- not an orphan. Live: registered via registerHumanNuanceStep() (this file), executed by '
    + 'script_bridge.ts\'s runOneStep() for id "HumanNuance:1", the same wiring pattern Softballs:1, '
    + 'NamedSet:1, Discriminator:1, Magnitude:1 and Terminator:1 already use.',
};

/** Registers 'HumanNuance:1'. Called from script_bridge.ts's ensureRegistryPopulated(),
 *  idempotently -- same try/catch shape as the other Composer step registrations there. */
export function registerHumanNuanceStep(): MethodIdentity {
  return registerNameNumbered('HumanNuance', 1, HUMAN_NUANCE_DECLARATION);
}
