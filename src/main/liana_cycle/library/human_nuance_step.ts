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
// D-BP154-052/BISHOP-SEG/S52/seg-wiregate, WIRING (see softballs_step.ts's own header for the
// full ruling) -- THE ONE SHARED RESOLVER, replacing this file's own local mirrored copy below.
// toLetters() (comparative_cascade.ts, imported above) stays imported -- this file's own frame
// (line ~172) still uses it directly and unrelated to this fix.
import { resolveNameToOption } from './entity_resolution';
// D-BP154-063/BISHOP-SEG/S52/seg-wiregate, WIRING. THE ONE SHARED CATEGORY-PARSE GATE replaces
// this file's own local "following X is/are" regex (previously duplicated, byte-identical, from
// softballs_step.ts/discriminator_step.ts -- the Founder's own explicit instruction this
// dispatch: "extract it; every step calls the one", superseding the earlier "steps stay
// self-contained" discipline for this ONE mechanical helper). See category_parse_gate.ts's own
// header for the full derivation.
import { parseFollowingCategory } from './category_parse_gate';

// ───────────────────── pure parts (unit-testable without a live Ollama/browser) ─────────────────────

/** Reads the category noun phrase the question itself names. Pure text-structure parsing, never a
 *  judgment -- returns null (never a guess) when parseFollowingCategory() (category_parse_gate.ts,
 *  THE ONE SHARED GATE, D-BP154-063) finds no category. Kept as a named export -- signature
 *  unchanged -- for existing callers/tests. */
export function deriveHumanNuanceCategory(question: string): string | null {
  return parseFollowingCategory(question).category;
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
 *  for every non-participant, what KIND OF THING it is, in the source's OWN short term (never a
 *  free-text justification). Generic across categories -- never names "population", "settlement",
 *  or any of qid 98's own words; those come only from whatever the SOURCE states back.
 *
 *  D-BP154-036/BISHOP-SEG/S36/seg-wireit REWRITE. Founder, FD-BP154-11: "Replace the free-text
 *  reason with a bounded feature extractor... Any prose the step still surfaces must be a verbatim
 *  span, never 'in your own words.'" The PRE-EXISTING query asked for "the reason (if any)... quote
 *  or closely paraphrase" -- `closely paraphrase` was exactly the model-authored-prose defect his
 *  own audit named. This query asks for a KIND (a short, structural noun the source itself uses --
 *  "continent", "desert", "line of latitude") plus its own verbatim span, never a reason in the
 *  model's own words -- see classifyHumanNuanceOntology()/applyHumanNuanceFeatureRules() below for
 *  how a stated kind becomes an exclusion (or does not) through declared, versioned rules, never
 *  through anything the model composed. */
export function buildHumanNuanceExclusionQuery(
  category: string, nonParticipants: string[], OPT: Record<string, string>,
): string {
  const list = nonParticipants.map((L) => `${L}) ${OPT[L]}`).join('; ');
  return `For each of the following, state what KIND OF THING it is, in a few words, using the `
    + `source's own term (for example: continent, subregion, desert, biome, line of latitude) as `
    + `it relates to whether it would usually be considered part of "${category}". Copy the term `
    + `as the source states it -- do not paraphrase, invent, or explain in your own words -- and `
    + `give the exact verbatim sentence or clause that states it. If the passage does not state a `
    + `kind for an option, do not include it. ${list}`;
}

// ───────────────── D-BP154-036/BISHOP-SEG/S36/seg-wireit -- DECLARED FEATURES OVER THE OPTION SET ─────────────────
//
// FD-BP154-11, Founder verbatim: "Your own audit: zero declared features, and the `reason` field
// is instructed to be written 'in your own brief words' -- model-generated paraphrase inside a
// step that presents as extraction-only. Only `span` is verbatim-checked. Replace the free-text
// reason with a bounded feature extractor: declared features over the option set -- geographic
// scale, ontology type, whether the term is a named canonical region, whether it matches the class
// implied by the other options. Rules over those features, versioned as part of R. If a pattern
// cannot be represented in declared features and explicit rules, emit INSUFFICIENT EVIDENCE --
// never a paraphrase."
//
// WHAT CHANGED, PRECISELY. The step no longer asks a source to compose a REASON -- it asks a
// source to STATE THE OPTION'S OWN KIND, a short structural term COPIED from the passage (verbatim
// span required, same choke point every extraction in this estate already uses). That stated kind
// is then run through classifyHumanNuanceOntology() -- a DECLARED, VERSIONED lookup table, pure
// and synchronous, no model, no I/O -- producing four typed features (ontologyType,
// geographicScale, namedCanonicalRegion, matchesClassImpliedByOtherOptions).
// applyHumanNuanceFeatureRules() then decides EXCLUDED / CONSISTENT / INSUFFICIENT_EVIDENCE from
// those features ALONE, through an explicit, in-code branch -- never a model's own judgment. The
// only "reason" text this step emits is a fixed, CODE-TEMPLATED sentence built from the typed
// feature values themselves (see applyHumanNuanceFeatureRules()'s own return below) -- never
// model-authored prose. The verbatim span the source stated is carried alongside it, unchanged.
//
// THE DECLARED TABLE -- ATTRIBUTED WHERE THE FOUNDER NAMED THE TOKEN, TARE WHERE THIS TICKET
// GENERALIZES HIS OWN REASONING STRUCTURALLY. FD-BP154-07a, verbatim: "desert and jungle are not
// considered world regions - because of their lack of usual human settlement and therefore
// population." "desert"/"jungle"/"rainforest" are ATTRIBUTED, his own words. "biome"/"ecosystem"/
// "forest" (the general CLASS his own reasoning names) and "line of latitude"/"circle of
// latitude"/"parallel" (this file's own qid-98 fixture already reads Arctic Circle as "a line of
// latitude", terminator_step.test.ts's own worked example) are TARE per HARDWIRE-23 Law 2/4: no
// direct Founder quote names these specific tokens; they generalize his stated reasoning
// structurally and are disclosed as an extension here, not hidden as though ratified. Extending
// this table further is a decision for its own ruling, not silently grown by a later ticket.

export type HumanNuanceOntologyType =
  | 'macro_region'
  | 'non_region_biome_or_landform'
  | 'non_region_line_or_boundary'
  | 'unclassified';

export type HumanNuanceGeographicScale = 'macro' | 'sub_regional_line' | 'biome_or_ecosystem' | 'unclassified';

interface OntologyTokenRule {
  token: string;
  ontologyType: HumanNuanceOntologyType;
  scale: HumanNuanceGeographicScale;
  attribution: 'ATTRIBUTED' | 'TARE';
}

/** R, versioned (FD-BP154-11: "Rules over those features, versioned as part of R"). Bump this
 *  string in the SAME commit as any change to the token table below or to
 *  applyHumanNuanceFeatureRules()'s own logic -- a feature/decision computed under one version is
 *  never silently compared against one computed under another (same discipline
 *  verdict_evaluator.ts's own RULE_SET_VERSION already established for the Terminator). */
export const HUMAN_NUANCE_FEATURE_RULE_VERSION = 'human_nuance_features@FD-BP154-07a:1';

const NON_REGION_TOKENS: readonly OntologyTokenRule[] = [
  { token: 'desert', ontologyType: 'non_region_biome_or_landform', scale: 'biome_or_ecosystem', attribution: 'ATTRIBUTED' },
  { token: 'jungle', ontologyType: 'non_region_biome_or_landform', scale: 'biome_or_ecosystem', attribution: 'ATTRIBUTED' },
  { token: 'rainforest', ontologyType: 'non_region_biome_or_landform', scale: 'biome_or_ecosystem', attribution: 'ATTRIBUTED' },
  { token: 'biome', ontologyType: 'non_region_biome_or_landform', scale: 'biome_or_ecosystem', attribution: 'TARE' },
  { token: 'ecosystem', ontologyType: 'non_region_biome_or_landform', scale: 'biome_or_ecosystem', attribution: 'TARE' },
  { token: 'forest', ontologyType: 'non_region_biome_or_landform', scale: 'biome_or_ecosystem', attribution: 'TARE' },
  { token: 'line of latitude', ontologyType: 'non_region_line_or_boundary', scale: 'sub_regional_line', attribution: 'TARE' },
  { token: 'circle of latitude', ontologyType: 'non_region_line_or_boundary', scale: 'sub_regional_line', attribution: 'TARE' },
  { token: 'latitude line', ontologyType: 'non_region_line_or_boundary', scale: 'sub_regional_line', attribution: 'TARE' },
  { token: 'parallel', ontologyType: 'non_region_line_or_boundary', scale: 'sub_regional_line', attribution: 'TARE' },
];

const REGION_TOKENS: readonly OntologyTokenRule[] = [
  { token: 'geopolitical macro-region', ontologyType: 'macro_region', scale: 'macro', attribution: 'TARE' },
  { token: 'geographic macro-region', ontologyType: 'macro_region', scale: 'macro', attribution: 'TARE' },
  { token: 'macro-region', ontologyType: 'macro_region', scale: 'macro', attribution: 'TARE' },
  { token: 'macroregion', ontologyType: 'macro_region', scale: 'macro', attribution: 'TARE' },
  { token: 'subcontinent', ontologyType: 'macro_region', scale: 'macro', attribution: 'TARE' },
  { token: 'continent', ontologyType: 'macro_region', scale: 'macro', attribution: 'TARE' },
  { token: 'subregion', ontologyType: 'macro_region', scale: 'macro', attribution: 'TARE' },
  { token: 'geographic region', ontologyType: 'macro_region', scale: 'macro', attribution: 'TARE' },
  { token: 'geopolitical region', ontologyType: 'macro_region', scale: 'macro', attribution: 'TARE' },
  { token: 'world region', ontologyType: 'macro_region', scale: 'macro', attribution: 'TARE' },
  { token: 'region', ontologyType: 'macro_region', scale: 'macro', attribution: 'TARE' },
];

// Longer/more-specific tokens first so e.g. "geopolitical macro-region" matches before the bare
// "region" fallback -- a plain array scan in this fixed, declared order, never a similarity score.
const ALL_TOKENS: readonly OntologyTokenRule[] = [...NON_REGION_TOKENS, ...REGION_TOKENS];

/** Same normalization discipline as terminator_step.ts's own normKindToken() (case/punctuation/
 *  whitespace fold) -- reproduced here, not imported, per this file's own "steps stay
 *  self-contained" convention (every sibling step's own header). */
function normOntologyText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

export interface HumanNuanceOntologyClassification {
  ontologyType: HumanNuanceOntologyType;
  scale: HumanNuanceGeographicScale;
  matchedToken: string | null;
}

/** THE ONE PLACE a stated kind becomes a typed ontology classification -- pure, synchronous, no
 *  I/O, no model. Matches the normalized `statedKind` text against the declared table above by
 *  whole-phrase containment (the same structural containment discipline
 *  terminator_step.ts's own discriminatorKindMatchesCategory() uses -- never a similarity score);
 *  the FIRST matching token wins, in the table's own declared order. Returns 'unclassified' (never
 *  a guess) when nothing in the declared table matches -- this is exactly the case
 *  applyHumanNuanceFeatureRules() below turns into INSUFFICIENT EVIDENCE, never an elimination. */
export function classifyHumanNuanceOntology(statedKind: string): HumanNuanceOntologyClassification {
  const norm = normOntologyText(statedKind);
  for (const rule of ALL_TOKENS) {
    if (norm.includes(rule.token)) {
      return { ontologyType: rule.ontologyType, scale: rule.scale, matchedToken: rule.token };
    }
  }
  return { ontologyType: 'unclassified', scale: 'unclassified', matchedToken: null };
}

export interface HumanNuanceFeatureSet {
  letter: string;
  /** The source's own stated kind, verbatim-span-backed by the caller (not repeated here). */
  statedKind: string;
  ontologyType: HumanNuanceOntologyType;
  geographicScale: HumanNuanceGeographicScale;
  /** DECLARED FEATURE: "whether the term is a named canonical region" (FD-BP154-11, verbatim). */
  namedCanonicalRegion: boolean;
  /** DECLARED FEATURE: "whether it matches the class implied by the other options" (FD-BP154-11,
   *  verbatim). Derived from `ontologyType` alone -- both features read the SAME declared
   *  classification of the stated kind, from two angles ("what kind is this" vs "does that kind
   *  belong to the region class every frame option's own category implies") -- disclosed here as
   *  DERIVED, not independently re-queried, so it is never mistaken for a second, separate signal.
   *  `null` when `ontologyType` is 'unclassified' -- there is nothing to compare. */
  matchesClassImpliedByOtherOptions: boolean | null;
  matchedToken: string | null;
}

/** Pure, synchronous. Combines classifyHumanNuanceOntology()'s own typed classification into the
 *  full declared feature set for one option. */
export function deriveHumanNuanceFeatures(letter: string, statedKind: string): HumanNuanceFeatureSet {
  const { ontologyType, scale, matchedToken } = classifyHumanNuanceOntology(statedKind);
  return {
    letter,
    statedKind,
    ontologyType,
    geographicScale: scale,
    namedCanonicalRegion: ontologyType === 'macro_region',
    matchesClassImpliedByOtherOptions: ontologyType === 'unclassified' ? null : ontologyType === 'macro_region',
    matchedToken,
  };
}

export type HumanNuanceFeatureDecision = 'excluded' | 'consistent' | 'insufficient_evidence';

/** THE RULE SET (R) itself -- an explicit, in-code branch over DECLARED FEATURES ONLY. No model is
 *  consulted here; no free text is read here. `reason` (when non-null) is a fixed, CODE-TEMPLATED
 *  sentence built purely from the typed field values already computed above -- never model-
 *  authored prose (FD-BP154-11: "any prose the step still surfaces must be a verbatim span, never
 *  'in your own words'" -- the verbatim SPAN itself is carried separately by the caller, alongside
 *  this templated sentence, never replaced by it).
 *
 *  - non_region_biome_or_landform / non_region_line_or_boundary -> EXCLUDED (FD-BP154-07a: these
 *    declared classes lack usual human settlement, so a population/settlement region category
 *    excludes them by declared policy, not by this run's own judgment).
 *  - macro_region -> CONSISTENT -- not excluded by this mechanism (may still be governed by other
 *    Composer steps; this step only ever REPORTS this option as consistent with the region class).
 *  - unclassified -> INSUFFICIENT_EVIDENCE -- the source stated *something*, but it does not match
 *    any declared token, region or non-region. Never guessed, never silently dropped; reported by
 *    its own name so a reader can tell "the source was silent" (unresolved, elsewhere in this
 *    file) apart from "the source spoke and the declared rules do not cover it" (this). */
export function applyHumanNuanceFeatureRules(
  features: HumanNuanceFeatureSet,
): { decision: HumanNuanceFeatureDecision; reason: string | null } {
  if (features.ontologyType === 'non_region_biome_or_landform' || features.ontologyType === 'non_region_line_or_boundary') {
    return {
      decision: 'excluded',
      reason: `declared feature match under ${HUMAN_NUANCE_FEATURE_RULE_VERSION}: stated kind `
        + `"${features.statedKind}" matches declared token "${features.matchedToken}" -- `
        + `ontologyType=${features.ontologyType}, geographicScale=${features.geographicScale}, `
        + `namedCanonicalRegion=${features.namedCanonicalRegion}, `
        + `matchesClassImpliedByOtherOptions=${features.matchesClassImpliedByOtherOptions} `
        + '(FD-BP154-07a: excluded from a population/settlement region category by declared, '
        + 'versioned ontology policy, not by this run\'s own judgment)',
    };
  }
  if (features.ontologyType === 'macro_region') {
    return { decision: 'consistent', reason: null };
  }
  return { decision: 'insufficient_evidence', reason: null };
}

export interface HumanNuanceExclusionEntry {
  letter: string;
  name: string;
  /** CODE-TEMPLATED from declared features (applyHumanNuanceFeatureRules(), above) -- never
   *  model-authored prose, never a paraphrase. */
  reason: string;
  /** The verbatim span (sentence or clause) proving the source itself stated the kind this
   *  exclusion was classified from. */
  span: string;
  /** The declared features this exclusion was decided from -- full transparency into R. Optional
   *  only so a hand-built fixture elsewhere in this estate (terminator_step.test.ts's own
   *  `humanNuance()` helper, which predates this ticket and constructs entries directly rather
   *  than through verifyAndClassifyHumanNuanceKinds()) is not forced to fabricate a feature set it
   *  never computed -- every REAL entry this file itself produces always sets it. */
  features?: HumanNuanceFeatureSet;
}

/** DECLARED FEATURE outcome, FD-BP154-11's own required slot: a kind WAS stated (and
 *  verbatim-span-verified) but does not match any declared token, region or non-region. Distinct
 *  from `unresolved` (source never addressed the option at all) -- "the source spoke and the
 *  declared rules do not cover it" is a different fact from "the source was silent", and
 *  conflating them would hide exactly the gap FD-BP154-11 exists to expose. */
export interface HumanNuanceInsufficientEvidenceEntry {
  letter: string;
  name: string;
  statedKind: string;
  span: string;
}

type RawKindEntry = { name?: unknown; kind?: unknown; span?: unknown };

// D-BP154-052, RETIRED (not duplicated): this file's own local stripListLetterPrefix() mirror
// (D-BP154-033, itself ported from softballs_step.ts) is removed -- entity_resolution.ts's
// resolveNameToOption() (imported above) now performs the same list-letter-prefix strip as its
// own step 2, plus two further mechanical steps this file never had (stated annotation,
// singular/plural fold), so nothing that matched before stops matching.

export interface HumanNuanceKindVerificationResult {
  excluded: HumanNuanceExclusionEntry[];
  /** DECLARED FEATURE outcome (FD-BP154-11): a kind was stated and verbatim-verified, but does not
   *  match any declared token. */
  insufficientEvidence: HumanNuanceInsufficientEvidenceEntry[];
  /** Letters whose stated, verified kind classified as 'macro_region' -- addressed by the source,
   *  found consistent with the region class, NOT excluded. Kept separate from `unresolved` (below,
   *  in runHumanNuanceStep()) so "the source said this IS a region" is never conflated with "the
   *  source said nothing at all". */
  consistent: string[];
  discarded: number;
}

/** THE VERIFY-THE-SPAN CHOKE POINT (FD-BP153-07 FIX 2), same four-part discipline every sibling
 *  step's own verify function already applies: (a) non-empty `name`, (b) maps to a KNOWN
 *  non-participant option (an option ALREADY in the frame is never a candidate here -- part 4 only
 *  ever speaks about non-participants), (c) non-empty `kind`, (d) non-empty `span`, (e) span
 *  VERBATIM in `passage`, (f) span itself ABOUT the named option (appearsIn). Any failure of
 *  (c)/(d)/(e)/(f) is a DISCARD and is counted. A `name` mapping to no known option letter, even
 *  after stripListLetterPrefix() (D-BP154-033) is tried, is simply not a match.
 *
 *  D-BP154-036/BISHOP-SEG/S36/seg-wireit REWRITE (was verifyHumanNuanceExclusions(), reading a
 *  free-text `reason` field the model composed). Verifies a `kind` (a short, verbatim-span-backed
 *  term) instead, then runs it through classifyHumanNuanceOntology()/applyHumanNuanceFeatureRules()
 *  -- declared, versioned, in-code rules, never a second pass of model judgment -- to decide
 *  EXCLUDED / CONSISTENT / INSUFFICIENT_EVIDENCE. */
export function verifyAndClassifyHumanNuanceKinds(
  raw: unknown,
  passage: string,
  nonParticipants: string[],
  OPT: Record<string, string>,
): HumanNuanceKindVerificationResult {
  const entries = Array.isArray(raw) ? (raw as RawKindEntry[]) : [];
  const nonParticipantSet = new Set(nonParticipants);
  const excluded: HumanNuanceExclusionEntry[] = [];
  const insufficientEvidence: HumanNuanceInsufficientEvidenceEntry[] = [];
  const consistent: string[] = [];
  const seen = new Set<string>();
  let discarded = 0;
  for (const entry of entries) {
    const name = typeof entry?.name === 'string' ? entry.name.trim() : '';
    const kind = typeof entry?.kind === 'string' ? entry.kind.trim() : '';
    const span = typeof entry?.span === 'string' ? entry.span.trim() : '';
    if (!name) continue; // nothing named -- not a candidate value, not a discard
    // D-BP154-052, WIRED: THE ONE SHARED RESOLVER (entity_resolution.ts).
    const { letter: L } = resolveNameToOption(name, OPT);
    if (!L) continue; // names no known option -- not a candidate value here
    if (!nonParticipantSet.has(L)) continue; // names a FRAME option -- part 4 never speaks about those; not a discard
    if (!kind || !span || !spanIsVerbatimInPassage(passage, span) || !appearsIn(span, OPT[L])) {
      discarded++;
      continue;
    }
    if (seen.has(L)) continue; // one entry per option; a repeat is neither kept nor double-counted
    seen.add(L);
    const features = deriveHumanNuanceFeatures(L, kind);
    const { decision, reason } = applyHumanNuanceFeatureRules(features);
    if (decision === 'excluded') {
      excluded.push({ letter: L, name: OPT[L], reason: reason as string, span, features });
    } else if (decision === 'insufficient_evidence') {
      insufficientEvidence.push({ letter: L, name: OPT[L], statedKind: kind, span });
    } else {
      consistent.push(L);
    }
  }
  return {
    excluded, insufficientEvidence, consistent, discarded,
  };
}

export interface HumanNuanceResult {
  ok: boolean;
  /** D-BP154-063, ADDITIVE. See SoftballsResult's own identical field for the full doc -- same
   *  convention, checked BEFORE `ok` by terminator_step.ts's own stepStatus(). */
  inapplicable?: boolean;
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
  /** D-BP154-036, ADDITIVE. FD-BP154-11's own required slot: a kind was stated and verified but
   *  matches no declared token. Never silently folded into `unresolved` -- see
   *  HumanNuanceInsufficientEvidenceEntry's own header for why the two are different facts. */
  insufficientEvidence: HumanNuanceInsufficientEvidenceEntry[];
  /** D-BP154-036, ADDITIVE. Non-participants whose stated, verified kind classified as
   *  'macro_region' -- addressed, found consistent, not excluded. */
  consistent: string[];
  /** D-BP154-036, ADDITIVE. Which build of the declared token table + rules produced every
   *  `excluded`/`insufficientEvidence` entry in this result -- see
   *  HUMAN_NUANCE_FEATURE_RULE_VERSION's own header. */
  featureRuleVersion: string;
  discarded: number;
  /** Non-participants for which no sourced kind was obtained AT ALL -- ABSENCE IS OMISSION, never
   *  conflated with "confirmed a member after all" and never conflated with `insufficientEvidence`
   *  (which DID get a stated, verified kind -- just one the declared table does not cover). */
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
    query: null, excluded: [], insufficientEvidence: [], consistent: [],
    featureRuleVersion: HUMAN_NUANCE_FEATURE_RULE_VERSION, discarded: 0, unresolved: [], via: 'n/a',
    ...overrides,
  };
}

function summaryLine(OPT: Record<string, string>, r: HumanNuanceResult): string {
  if (!r.ok) return `HUMAN NUANCE: FAILED -- ${r.error}`;
  const guardText = r.cowGuard ? `${r.cowGuard.applies ? 'PASSES' : 'DOES NOT APPLY'} -- ${r.cowGuard.reason}` : '(not evaluated)';
  const frameText = r.frame ? `{${r.frame.join(', ')}}` : '(unavailable -- no origin provenance on file for this item)';
  const npText = r.nonParticipants.length ? r.nonParticipants.map((L) => `${L}) ${OPT[L] ?? '?'}`).join(', ') : '(none)';
  const exText = r.excluded.length
    ? r.excluded.map((e) => `${e.letter}) ${e.name} -- ${e.reason} [source: "${e.span}"]`).join('  |  ')
    : '(none stated)';
  const consistentText = r.consistent.length ? r.consistent.map((L) => `${L}) ${OPT[L] ?? '?'}`).join(', ') : '(none)';
  const insufficientText = r.insufficientEvidence.length
    ? r.insufficientEvidence.map((e) => `${e.letter}) ${e.name} -- stated kind "${e.statedKind}" matches no declared token [source: "${e.span}"]`).join('  |  ')
    : '(none)';
  const unresolvedText = r.unresolved.length ? r.unresolved.map((L) => `${L}) ${OPT[L] ?? '?'}`).join(', ') : '(none)';
  const discardNote = r.discarded ? ` -- discarded ${r.discarded} candidate(s) with no verifiable span` : '';
  const provenanceNote = r.answerProvenance ? `  ||  ANSWERED VIA ${r.answerProvenance.mechanism}: ${r.answerProvenance.detail}` : '';
  const corrobNote = r.corroboration ? `  ||  ${summarizeCorroboration(r.corroboration)}` : '';
  const survivedNote = r.singleAnswerPropertySurvived === null ? '(not determined)' : String(r.singleAnswerPropertySurvived);
  const derivableNote = r.answerDerivableFromQuestionTermsAlone === null ? '(not determined)' : String(r.answerDerivableFromQuestionTermsAlone);
  return `HUMAN NUANCE -- ARTIFACT CLASS: ${r.artifactClassEstablished ? `established (src="${r.src}")` : 'UNESTABLISHED'}  ||  `
    + `CORPUS META-TRUTH: ${r.corpusMetaTruth?.statement ?? '(n/a)'}  ||  COW GUARD: ${guardText}  ||  `
    + `FRAME (origin's own option set): ${frameText}  ||  NON-PARTICIPANTS (augmentation additions): ${npText}  ||  `
    + `R=${r.featureRuleVersion}  ||  `
    + `EXCLUDED (declared feature match, verified): ${exText}${discardNote}  ||  `
    + `CONSISTENT (stated, verified macro_region kind, not excluded): ${consistentText}  ||  `
    + `INSUFFICIENT EVIDENCE (stated kind matches no declared token): ${insufficientText}  ||  `
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
      query: null, excluded: [], insufficientEvidence: [], consistent: [],
      featureRuleVersion: HUMAN_NUANCE_FEATURE_RULE_VERSION, discarded: 0, unresolved: [], via: 'n/a',
    };
    return { result, summary: summaryLine(OPT, result) };
  }

  const categoryParse = parseFollowingCategory(input.question);
  const category = categoryParse.category;
  if (!category) {
    const result = emptyHumanNuanceResult({
      artifactClassEstablished, src, corpusMetaTruth, cowGuard, inapplicable: true,
      error: categoryParse.reason ?? 'could not determine the category this question names -- refusing rather than guessing what to read the option set against',
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
      query: null, excluded: [], insufficientEvidence: [], consistent: [],
      featureRuleVersion: HUMAN_NUANCE_FEATURE_RULE_VERSION, discarded: 0, unresolved: [], via: 'n/a',
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
      query: null, excluded: [], insufficientEvidence: [], consistent: [],
      featureRuleVersion: HUMAN_NUANCE_FEATURE_RULE_VERSION, discarded: 0, unresolved: [], via: 'n/a',
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
  // D-BP154-036/BISHOP-SEG/S36/seg-wireit REWRITE. Asks for a KIND (a short, source-stated term),
  // never a free-text "reason... in your own brief words" -- see buildHumanNuanceExclusionQuery()'s
  // own header for the full ruling this observes. EXPLICITLY forbids paraphrase/invention in the
  // instruction text itself, not merely in a comment.
  const instruction = `From the passage, for each option below, if it explicitly states what KIND `
    + `OF THING it is, copy that kind as the source's own short term (do not paraphrase, invent, `
    + `or explain -- copy the term as stated, e.g. "continent", "desert", "line of latitude") and `
    + `the exact verbatim sentence or clause that states it. Do not include an option the passage `
    + `does not address this way -- an omission is not a statement. `
    + `Options: ${nonParticipants.map((L) => `${L}) ${optSafe[L]}`).join('; ')}`;
  const shape = '{"excluded":[{"name":"exact option name from the list","kind":"short stated kind term, copied not composed","span":"verbatim sentence or clause"}]}';

  async function extractFrom(candidateText: string): Promise<{
    excluded: HumanNuanceExclusionEntry[];
    insufficientEvidence: HumanNuanceInsufficientEvidenceEntry[];
    consistent: string[];
    discarded: number;
    extractionError?: string;
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
      return {
        excluded: [], insufficientEvidence: [], consistent: [], discarded: 0, extractionError: cause,
      };
    }
    const r = ex as { excluded?: unknown };
    const {
      excluded, insufficientEvidence, consistent, discarded,
    } = verifyAndClassifyHumanNuanceKinds(r.excluded, candidateText, nonParticipants, optSafe);
    return {
      excluded, insufficientEvidence, consistent, discarded,
    };
  }

  // STAGE 1: OWNED EVIDENCE FIRST (FD-BP153-04, THE MORTGAGE + this run's own passages).
  const ownedCandidates = [
    ...(await gatherMortgageCandidates(input.qid, query)),
    ...gatherThisRunCandidates(ctx),
  ];
  let text = ''; let via = ''; let provenance: ClaimProvenance | undefined;
  type Extraction = {
    excluded: HumanNuanceExclusionEntry[];
    insufficientEvidence: HumanNuanceInsufficientEvidenceEntry[];
    consistent: string[];
    discarded: number;
    extractionError?: string;
  };
  // D-BP154-036, ADDITIVE: "addressed" now means excluded OR consistent OR insufficientEvidence --
  // any of the three is a genuine, verified fact about a non-participant, not only an exclusion.
  // Treating only `excluded.length > 0` as success (the pre-existing condition) would have thrown
  // away a real "stated, verified, macro_region -- consistent" or "stated, verified, unclassified
  // -- insufficient evidence" finding and kept searching as if nothing had been obtained.
  const addressedCount = (e: Extraction) => e.excluded.length + e.consistent.length + e.insufficientEvidence.length;
  let extraction: Extraction | null = null;
  for (const c of ownedCandidates) {
    if (!namesAnyNonParticipant(c.text)) continue;
    // eslint-disable-next-line no-await-in-loop -- bounded, small candidate list, same idiom every
    // sibling step's own owned-evidence loop already uses.
    const owned = await extractFrom(c.text);
    if (addressedCount(owned) > 0) {
      text = c.text; via = c.via; provenance = c.provenance; extraction = owned;
      break;
    }
  }

  // STAGE 2: THE CONVERSATIONAL AUTHORITY ANSWERS (FD-BP154-02) -- tried when nothing owned worked.
  let conversationalError: string | undefined;
  if (!extraction || addressedCount(extraction) === 0) {
    const cr = await tryConversationalAuthority(ctx, query, mcOptions);
    if (cr.ok && namesAnyNonParticipant(cr.text)) {
      const cExtraction = await extractFrom(cr.text);
      if (addressedCount(cExtraction) > 0 || !text) {
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
      query, excluded: [], insufficientEvidence: [], consistent: [],
      featureRuleVersion: HUMAN_NUANCE_FEATURE_RULE_VERSION, discarded: 0,
      unresolved: frameInfo.nonParticipants, via: 'n/a',
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
      query, excluded: [], insufficientEvidence: [], consistent: [],
      featureRuleVersion: HUMAN_NUANCE_FEATURE_RULE_VERSION, discarded: 0,
      unresolved: frameInfo.nonParticipants, via,
      error: `extraction failed -- ${extraction?.extractionError ?? 'the local extraction model failed for an unclassified reason'}`,
    };
    return { result, summary: summaryLine(OPT, result) };
  }

  // D-BP154-036, ADDITIVE: a letter is "resolved" (not `unresolved`) whenever the source addressed
  // it at all -- excluded, consistent, OR insufficientEvidence all count; only a letter with NO
  // entry of any of the three kinds is unresolved (source silent -- omission, unchanged law).
  const resolvedLetters = new Set([
    ...extraction.excluded.map((e) => e.letter),
    ...extraction.consistent,
    ...extraction.insufficientEvidence.map((e) => e.letter),
  ]);
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
    query, excluded: extraction.excluded, insufficientEvidence: extraction.insufficientEvidence,
    consistent: extraction.consistent, featureRuleVersion: HUMAN_NUANCE_FEATURE_RULE_VERSION,
    discarded: extraction.discarded, unresolved, via,
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
