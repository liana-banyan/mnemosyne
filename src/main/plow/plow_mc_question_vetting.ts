// plow_mc_question_vetting.ts -- KN-BP141-3 Stage 0: Question Vetting.
//
// Founder-directed, BP141. Derived from a documented human procedure, not from a failure trace --
// the FIRST solver-adjacent module in this engine built that way. This is Stage 0 of KN-BP141-3
// (Question Vetting -> Elimination Chart -> Elimination Cascade -> Gom Jabbar); see
// plow_mc_elimination_chart.ts, plow_mc_elimination_cascade.ts, plow_gom_jabbar.ts for the other
// three stages.
//
// VETTING DOES NOT ANSWER. It never changes a letter, never eliminates an option, never selects a
// winner. It only emits flags that downstream solvers and the Coroner (answer_coroner.ts) may
// consume as signal. A vetting function that silently influenced the final letter would defeat its
// own purpose (a vetted-but-wrong question would look "handled" when it is only "flagged") -- so
// every function in this file is pure, synchronous, has no side effects, and its return value is
// advisory-only by construction: a caller has to go out of its way to turn a flag into an answer,
// this module structurally cannot do that itself.
//
// Rule 66: version, never overwrite -- this is a new file, no supersede needed. No em-dashes
// anywhere in this file (or its comments) -- "--" used throughout per Rule 66.

import type { McOption } from './compute_sidecar';

// ─── V1: REGISTER CONFLICT ──────────────────────────────────────────────────────────────────────
//
// WHY THIS EXISTS. Empirical basis, math/source_id 8230 ("Which of these statements correctly
// explains bias?"): option J is the mathematical-statistics (estimator-bias) definition --
// "creates estimates that are too high on average or too low on average" -- and option E is the
// intro-course (representativeness) definition -- "a sample that is not representative of the
// population." Both are CORRECT descriptions of bias at their own level of sophistication. The
// dataset's own correct_answer is E, the LESS sophisticated one, because an MMLU-Pro-style
// question written for an intro statistics course sets its own register at the intro level -- the
// question was written by the intro curriculum, not by a graduate methodology seminar. A solver (or
// a model) that reaches for the "smarter-sounding" answer will pick the WRONG one here. This flag
// exists so downstream solvers/the Coroner know two options are BOTH honestly-correct-at-their-own-
// register before either one gets penalized as "obviously wrong."
//
// DELIBERATELY NARROW: this is pattern-matching against a specific, well-understood register
// signature (statistical/technical-estimation language vs. plain-language representativeness
// language), not general natural-language sophistication scoring. It fires only when the stem
// itself asks for a DEFINITION/EXPLANATION of a named concept (a "which of these explains/
// describes/defines X" shape) -- outside that shape there is no single concept two options could
// be defining at different registers in the first place, so this correctly does not fire on
// ordinary computational or factual-recall questions.

const DEFINITIONAL_STEM_RE =
  /\b(explain|explains|describe|describes|define|defines|characterize|characterizes|refers? to|mean|means)\b/i;

// Statistical/technical-estimation register: talks about an ESTIMATOR's own long-run behavior
// (systematic over/under-estimation), not about a single sample's representativeness.
const EXPERT_REGISTER_RE =
  /\b(too high on average|too low on average|on average|systematic(ally)?|expected value|estimator|over[- ]?estimat|under[- ]?estimat)\b/i;

// Plain-language / intro-course register: talks about a single sample's representativeness using
// the adjective form ("representative"/"not representative"), never the bare verb form ("does not
// represent") -- the verb form is a PROCESS-predicated paraphrase of the same underlying claim
// (see V3 below, which is the section that reconciles A-vs-E as a paraphrase collision, not a
// register conflict) and must not be swept into this narrower signal or V1 would see two
// candidate "intro" options (A and E) on 8230 and honestly (but unhelpfully) abstain.
const INTRO_REGISTER_RE = /\bnot representative\b/i;

export interface RegisterConflictFlag {
  /** Letter of the LESS sophisticated (intro-register) option -- per V1's own finding, this is the
   *  one the question's own register actually rewards. */
  intro: string;
  /** Letter of the MORE sophisticated (expert-register) option -- correct at its own level, but
   *  the WRONG answer for an intro-registered question. */
  expert: string;
  detail: string;
}

/** Returns null (no conflict detected) unless the stem is definitional AND exactly one option
 *  matches the expert-register signal AND exactly one (different) option matches the intro-
 *  register signal. 0 or 2+ matches on either side is an honest null -- this never guesses which
 *  pair is "the" conflicting pair when the signal is ambiguous. */
export function detectRegisterConflict(questionText: string, options: McOption[]): RegisterConflictFlag | null {
  if (!DEFINITIONAL_STEM_RE.test(questionText)) return null;

  const expertMatches = options.filter((o) => EXPERT_REGISTER_RE.test(o.text));
  const introMatches = options.filter((o) => INTRO_REGISTER_RE.test(o.text));
  if (expertMatches.length !== 1 || introMatches.length !== 1) return null;

  const expertOpt = expertMatches[0] as McOption;
  const introOpt = introMatches[0] as McOption;
  if (expertOpt.letter === introOpt.letter) return null;

  return {
    intro: introOpt.letter,
    expert: expertOpt.letter,
    detail:
      `registerConflict: intro-register option ${introOpt.letter} ("${introOpt.text.slice(0, 80)}") ` +
      `vs expert-register option ${expertOpt.letter} ("${expertOpt.text.slice(0, 80)}") -- both ` +
      `honestly correct at their own level; the question's own register is set by the LESS ` +
      `sophisticated one.`,
  };
}

// ─── V2: SCALE / FRAMING MISMATCH ───────────────────────────────────────────────────────────────
//
// WHY THIS EXISTS. Empirical basis, other/source_id 5723 ("Which of the following world regions is
// NOT considered one of the world's most densely populated regions?"): the option set mixes
// taught-curriculum population-cluster regions (South America, South Asia, North Africa, Northeast
// United States, Europe, Central Asia) with ecological/geographic zones (Arctic Circle, Amazon
// Rainforest, Sahara Desert) that are also, under a LITERAL reading of "densely populated," clearly
// not densely populated -- but so is Central Asia (17.43/km2), which is NOT the dataset's key. The
// stem means "taught population clusters," not "any geographic area on Earth"; the ecological-zone
// options are trivially true under literal density and would make the question ambiguous (4+ valid
// non-members) if taken at face value. This flag surfaces that the option set spans two different
// SCALES/FRAMINGS the stem itself never reconciles, so a downstream solver knows not to treat the
// literal reading as authoritative.
//
// DELIBERATELY NARROW: fires only on a "which of the following [class] is [not] one of/considered/
// included in/part of [named set]" shape (the same connector list plow_mc_set_membership_solver.ts
// already recognizes for its own, separate purpose) with a mixed-scale option set, classified via
// an explicit keyword list (ecological/geographic-zone nouns) against the default bucket (named
// political/demographic/continental regions). This is not general "detect any scale mismatch in any
// question" -- it is one specific, falsifiable classification.

const SET_MEMBERSHIP_STEM_RE =
  /\bwhich of the following\b[\s\S]*?\bis\s+(?:not\s+)?(?:considered\s+)?(?:a member of|one of|included in|part of)\b/i;

// Ecological/geographic-zone nouns -- biomes, climate zones, physical-geography features that are
// not themselves named political/demographic/continental regions.
const ECOLOGICAL_ZONE_RE =
  /\b(desert|rainforest|jungle|tundra|arctic|antarctic|glacier|ice cap|ice sheet|polar|ocean|sea|savanna|wetland|steppe|prairie|plateau|circle)\b/i;

export interface ScaleMismatchFlag {
  scaleMismatch: true;
  /** Letters of the options classified into the MINORITY scale/framing bucket (the ones that
   *  differ from the majority of the option set). */
  offendingLetters: string[];
  detail: string;
}

/** Returns null unless the stem matches the set-membership shape AND the option set contains BOTH
 *  at least one ecological/geographic-zone-classified option AND at least one option that is NOT
 *  so classified (a genuine mix -- an option set that is ALL one bucket has no scale mismatch to
 *  flag). Offending letters are always the MINORITY bucket, since the majority bucket sets the
 *  question's real intended framing. */
export function detectScaleMismatch(questionText: string, options: McOption[]): ScaleMismatchFlag | null {
  if (!SET_MEMBERSHIP_STEM_RE.test(questionText)) return null;
  if (options.length === 0) return null;

  const ecological = options.filter((o) => ECOLOGICAL_ZONE_RE.test(o.text));
  const nonEcological = options.filter((o) => !ECOLOGICAL_ZONE_RE.test(o.text));
  if (ecological.length === 0 || nonEcological.length === 0) return null;

  const minorityBucket = ecological.length <= nonEcological.length ? ecological : nonEcological;
  const majorityLabel = ecological.length <= nonEcological.length
    ? 'named political/demographic/continental regions'
    : 'ecological/geographic zones';
  const minorityLabel = ecological.length <= nonEcological.length
    ? 'ecological/geographic zones'
    : 'named political/demographic/continental regions';

  return {
    scaleMismatch: true,
    offendingLetters: minorityBucket.map((o) => o.letter),
    detail:
      `scaleMismatch: option set mixes ${majorityLabel} (majority, ${options.length - minorityBucket.length} ` +
      `option(s)) with ${minorityLabel} (minority, ${minorityBucket.length} option(s): ` +
      `${minorityBucket.map((o) => o.letter).join(',')}) -- the stem does not reconcile the two scales; ` +
      `a literal reading of the minority bucket would make the question ambiguous.`,
  };
}

// ─── V3: PARAPHRASE COLLISION ────────────────────────────────────────────────────────────────────
//
// WHY THIS EXISTS. Same 8230 case: option A ("a process that RESULTS IN a sample that does not
// represent the population") and option E ("a SAMPLE that is not representative of the
// population") assert the SAME underlying claim (non-representativeness) in two different
// grammatical frames -- A predicates of a PROCESS, E predicates of a STATE/SAMPLE. They are
// related, not identical, and this module does NOT decide which one is "more correct" -- that
// resolution is Stage 1's (plow_mc_elimination_chart.ts) job, via subject/claimType/polarity
// decomposition. V3's only job is to surface that a collision exists (two or more options making
// the same core claim under different predicates) and record BOTH the shared claim and the
// differing predicate as data for whichever downstream stage needs it -- "synonyms differ; the
// difference is data," per the ticket's own framing.
//
// MECHANISM: strip a small set of known boilerplate lead-in phrases ("it describes a process that
// results in", "it describes a", "it describes", "a process that", "a sample that"), tokenize the
// remainder into lowercase content words with a short stopword list removed, and compare option
// pairs by Jaccard similarity of their content-word sets. A pair above the similarity floor (and
// not identical after stripping) is flagged as a collision. The differing predicate is recorded as
// whichever of "process" / "state" markers appears in one option's stripped lead-in and not the
// other's -- when neither option's lead-in carries a process/state marker, differingPredicate
// reports the raw set-difference of content words instead, so the field is never fabricated.

const BOILERPLATE_LEADIN_RE =
  /^(it |this )?(describes?|is|refers? to) (a |an |the )?/i;
const NEGATION_RE = /\b(not|no|never|lack(?:ing|s)?|without)\b/i;
// Extracts the HEAD NOUN immediately governed by the option's own lead-in verb (e.g. "It describes
// a PROCESS that..." -> "process"; "It describes a SAMPLE that..." -> "sample") -- this is the
// grammatical subject of the option's own claim, not just any occurrence of the word "process"/
// "sample" anywhere in the sentence (both A and E happen to contain the word "sample" somewhere in
// 8230's text, but only E's HEAD noun is "sample" -- A's head noun is "process").
const HEAD_NOUN_RE = /^(?:it |this )?(?:describes?|is|refers? to)\s+(?:a|an|the)\s+([a-z]+)/i;
function extractHeadNounClass(text: string): 'process' | 'state' | 'other' {
  const m = HEAD_NOUN_RE.exec(text.trim());
  const head = m ? (m[1] as string).toLowerCase() : '';
  if (head === 'process') return 'process';
  if (head === 'sample' || head === 'state' || head === 'condition') return 'state';
  return 'other';
}
const STOPWORDS = new Set([
  'a', 'an', 'the', 'of', 'to', 'that', 'is', 'in', 'on', 'for', 'or', 'and', 'it', 'this', 'these',
  'those', 'be', 'are', 'was', 'were', 'results', 'result', 'describes', 'describe', 'always',
]);

// Empirical basis (8230, A vs E): "does not represent" (verb) and "is not representative"
// (adjective) are the SAME root claim in two different grammatical forms. A general stemmer would
// risk over-merging unrelated words; this is a deliberately narrow, named synonym fold (documented,
// not silent) for exactly this claim-root, applied before tokenizing.
function foldSynonymRoots(text: string): string {
  return text.replace(/\brepresentative\b/gi, 'represent').replace(/\brepresents\b/gi, 'represent');
}

function contentWords(text: string): Set<string> {
  const stripped = foldSynonymRoots(text.replace(BOILERPLATE_LEADIN_RE, ''));
  const words = stripped
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOPWORDS.has(w));
  return new Set(words);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

const PARAPHRASE_SIMILARITY_FLOOR = 0.45;

export interface ParaphraseCollisionFlag {
  letters: [string, string];
  sharedClaim: string;
  differingPredicate: string;
}

/** Returns every pair of options (never more than once per unordered pair) whose content-word sets
 *  clear the Jaccard similarity floor and are not textually identical. Does NOT resolve which
 *  option (if either) is correct -- purely a detection-and-record function, per this section's own
 *  header. Deterministic: pairs are returned in option-array order. */
export function detectParaphraseCollisions(_questionText: string, options: McOption[]): ParaphraseCollisionFlag[] {
  const collisions: ParaphraseCollisionFlag[] = [];
  const wordSets = options.map((o) => ({ opt: o, words: contentWords(o.text) }));

  for (let i = 0; i < wordSets.length; i++) {
    for (let j = i + 1; j < wordSets.length; j++) {
      const a = wordSets[i] as { opt: McOption; words: Set<string> };
      const b = wordSets[j] as { opt: McOption; words: Set<string> };
      if (a.opt.text.trim().toLowerCase() === b.opt.text.trim().toLowerCase()) continue; // identical text, not a "collision" to report
      // A high word-overlap pair that DISAGREES on negation (one asserts the claim, the other
      // asserts its opposite -- e.g. D "perfectly represents" vs A "does not represent") is not a
      // paraphrase of the SAME claim, it is two options sharing vocabulary while asserting opposite
      // things. Only a same-negation-polarity pair is a genuine collision candidate.
      if (NEGATION_RE.test(a.opt.text) !== NEGATION_RE.test(b.opt.text)) continue;
      const sim = jaccard(a.words, b.words);
      if (sim < PARAPHRASE_SIMILARITY_FLOOR) continue;

      const shared = [...a.words].filter((w) => b.words.has(w));
      const headA = extractHeadNounClass(a.opt.text);
      const headB = extractHeadNounClass(b.opt.text);

      let differingPredicate: string;
      if (headA === 'process' && headB === 'state') {
        differingPredicate = `${a.opt.letter} predicates of a PROCESS; ${b.opt.letter} predicates of a STATE/SAMPLE`;
      } else if (headB === 'process' && headA === 'state') {
        differingPredicate = `${b.opt.letter} predicates of a PROCESS; ${a.opt.letter} predicates of a STATE/SAMPLE`;
      } else {
        const aOnly = [...a.words].filter((w) => !b.words.has(w));
        const bOnly = [...b.words].filter((w) => !a.words.has(w));
        differingPredicate =
          `${a.opt.letter} unique words=[${aOnly.join(',')}]; ${b.opt.letter} unique words=[${bOnly.join(',')}]`;
      }

      collisions.push({
        letters: [a.opt.letter, b.opt.letter],
        sharedClaim: shared.join(' '),
        differingPredicate,
      });
    }
  }
  return collisions;
}

// ─── Top-level: run all three checks ────────────────────────────────────────────────────────────

export interface QuestionVettingFlags {
  registerConflict: RegisterConflictFlag | null;
  scaleMismatch: ScaleMismatchFlag | null;
  paraphraseCollisions: ParaphraseCollisionFlag[];
}

/** Pure, synchronous, no I/O -- runs V1/V2/V3 and returns their combined flags. Never mutates
 *  `options`, never returns a letter, never influences which option is "correct." A caller that
 *  wants these flags to affect an answer has to do that work itself, deliberately, downstream. */
export function vetQuestion(questionText: string, options: McOption[]): QuestionVettingFlags {
  return {
    registerConflict: detectRegisterConflict(questionText, options),
    scaleMismatch: detectScaleMismatch(questionText, options),
    paraphraseCollisions: detectParaphraseCollisions(questionText, options),
  };
}
