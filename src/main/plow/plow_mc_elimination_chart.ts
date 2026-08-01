// plow_mc_elimination_chart.ts -- KN-BP141-3 Stage 1: the Semantic Elimination Chart (the Jar
// Method, run on MEANING rather than on retrieval).
//
// Founder-directed, BP141. Stage 1 of four (Stage 0: plow_mc_question_vetting.ts, Stage 2:
// plow_mc_elimination_cascade.ts, Stage 3: plow_gom_jabbar.ts).
//
// MEASURED CONSTRAINT this file must never re-derive around: naive "eliminate absolute-quantifier
// options" discards the KEY in 61 of 497 questions carrying such an option (12.3%). NO eliminator
// in this file ships as a HARD gate (able to unilaterally decide a letter) until its own false-
// negative rate is measured on the full 10,956-question dataset and reported. See
// scratchpad/measure_kn_bp141_3_stage1_fnrates.js for that measurement and the KN-BP141-3 final
// report for the resulting per-rule verdicts (hard-eligible vs advisory-only, >= ~2% FN demoted).
//
// DECOMPOSITION. Every option is decomposed into {subject, claimType, polarity}:
//   subject   := process | state | person | quantity | entity
//   claimType := a short descriptive tag for WHAT property/claim-shape is asserted (e.g.
//                'representativeness', 'sample-size', 'estimation-bias', 'cause:influence') --
//                deliberately a small, curated, documented vocabulary, not open-ended free text,
//                so a caller can pattern-match on it without guessing at synonyms.
//   polarity  := defect | virtue | neutral
// This is a HEURISTIC, KEYWORD/PATTERN-based decomposition, not general NLU -- it is honest about
// firing only on option shapes it recognizes, and returns the neutral/unclassified default
// otherwise rather than ever forcing a guess. Every rule below (R1/R2/R3) is built entirely out of
// this decomposition plus the stem's own determinate polarity/concept, and is independently
// falsifiable: each can be disabled without changing what the other two do.
//
// R1/R2/R3 JURISDICTION (deliberately non-overlapping, so "which rule removed which letter" is a
// clean, unambiguous partition on the anchor case, math/source_id 8230, rather than three rules
// all independently re-discovering the same elimination and inflating each other's measured
// firing/false-negative counts):
//   R1 (polarity mismatch)      -- applies to the FULL option set.
//   R2 (cause-is-not-the-thing) -- applies to the FULL option set (a cause-shaped option is
//                                  disqualified regardless of whether it also happens to be
//                                  polarity-consistent).
//   R3 (wrong property)        -- applies ONLY to options that (a) were not already eliminated by
//                                  R1 (polarity-consistent with the stem) and (b) are not
//                                  cause-shaped per R2's own check. R3's whole point is "the right
//                                  KIND of claim (a definition, not a cause), the right POLARITY,
//                                  but about the wrong MEASURABLE PROPERTY" -- an option R1 or R2
//                                  already disqualified for a different, more specific reason is
//                                  not this rule's to also claim credit for.
//
// Rule 66: version, never overwrite -- new file, no supersede needed. No em-dashes anywhere in
// this file (or its comments) -- "--" used throughout per Rule 66.

import type { McOption } from './compute_sidecar';

export type OptionSubject = 'process' | 'state' | 'person' | 'quantity' | 'entity';
export type OptionPolarity = 'defect' | 'virtue' | 'neutral';

export interface DecomposedOption {
  letter: string;
  subject: OptionSubject;
  claimType: string;
  polarity: OptionPolarity;
}

// ─── Subject classification ─────────────────────────────────────────────────────────────────────

const HEAD_NOUN_RE = /^(?:it |this )?(?:describes?|is|refers? to)\s+(?:a|an|the)\s+([a-z]+)/i;
const PERSON_WORDS = new Set(['researcher', 'researchers', 'participant', 'participants', 'subject', 'subjects', 'individual', 'individuals', 'person', 'expert', 'experts']);
const QUANTITY_WORDS = new Set(['size', 'amount', 'number', 'value', 'estimate', 'estimates', 'quantity', 'proportion']);
const STATE_WORDS = new Set(['sample', 'state', 'condition']);

function classifySubject(text: string): OptionSubject {
  const m = HEAD_NOUN_RE.exec(text.trim());
  const head = m ? (m[1] as string).toLowerCase() : '';
  if (head === 'process') return 'process';
  if (STATE_WORDS.has(head)) return 'state';
  if (PERSON_WORDS.has(head)) return 'person';
  if (QUANTITY_WORDS.has(head)) return 'quantity';
  // Head noun not recognized (or lead-in didn't match at all) -- fall back to scanning the whole
  // option for a person/quantity signal before defaulting to 'entity', so an option phrased without
  // the "It describes a ___" lead-in (e.g. a bare noun-phrase option in a different question) is
  // not automatically misclassified.
  const lower = text.toLowerCase();
  for (const w of PERSON_WORDS) if (new RegExp(`\\b${w}\\b`).test(lower)) return 'person';
  for (const w of QUANTITY_WORDS) if (new RegExp(`\\b${w}\\b`).test(lower)) return 'quantity';
  return 'entity';
}

// ─── Polarity classification ────────────────────────────────────────────────────────────────────

const DEFECT_OPTION_RE =
  /\b(not represent|not representative|too (?:high|low|large|small)\b.*\btoo (?:high|low|large|small)\b|inaccurate|\berror\b|\bflaw|bias(?:ed)?|lack of|fails? to|incorrect|misleading|unrepresentative|no single|no specific)\b/i;
const VIRTUE_OPTION_RE =
  /\b(perfectly represents?|always (?:results? in )?accurate|accurate estimates?|random sampling method|no influence|represents? the population (?:accurately|well)|unbiased|\bvalid\b|\bappropriate\b|correctly)\b/i;

function classifyOptionPolarity(text: string): OptionPolarity {
  const isDefect = DEFECT_OPTION_RE.test(text);
  const isVirtue = VIRTUE_OPTION_RE.test(text);
  if (isDefect && !isVirtue) return 'defect';
  if (isVirtue && !isDefect) return 'virtue';
  return 'neutral';
}

// ─── Stem polarity (determinate defect/virtue vs indeterminate) ────────────────────────────────

const DEFINITIONAL_STEM_RE =
  /\b(explain|explains|describe|describes|define|defines|characterize|characterizes|refers? to|mean|means)\b/i;
const DEFECT_NOUN_RE =
  /\b(bias(?:es)?|flaw(?:s)?|error(?:s)?|mistake(?:s)?|weakness(?:es)?|disadvantage(?:s)?|limitation(?:s)?|drawback(?:s)?|shortcoming(?:s)?|deficienc(?:y|ies)|fault(?:s)?)\b/i;
const VIRTUE_NOUN_RE = /\b(advantage(?:s)?|benefit(?:s)?|strength(?:s)?|virtue(?:s)?|merit(?:s)?)\b/i;

export type StemPolarity = 'defect' | 'virtue' | 'indeterminate';

/** The stem's own polarity is DETERMINATE only when it is a definitional stem ("explains"/
 *  "describes"/etc.) AND names a defect or virtue concept. Every other stem shape (computational,
 *  factual-recall, no definitional verb, no defect/virtue noun) is indeterminate -- R1 must abstain
 *  on those, never guess. */
export function determineStemPolarity(stemText: string): StemPolarity {
  if (!DEFINITIONAL_STEM_RE.test(stemText)) return 'indeterminate';
  if (DEFECT_NOUN_RE.test(stemText)) return 'defect';
  if (VIRTUE_NOUN_RE.test(stemText)) return 'virtue';
  return 'indeterminate';
}

// Words that are already singular despite ending in "s" (a naive trailing-s strip would corrupt
// them, e.g. "bias" -> "bia") -- an explicit exception list, not a smarter general singularizer,
// so this stays honest about being narrow rather than pretending to solve English morphology.
const ALREADY_SINGULAR_S_WORDS = new Set(['bias']);

function normalizeConceptNoun(raw: string): string {
  const lower = raw.toLowerCase();
  if (ALREADY_SINGULAR_S_WORDS.has(lower)) return lower;
  if (lower.endsWith('biases')) return 'bias';
  return lower.replace(/e?s$/, '');
}

/** Extracts the specific defect/virtue concept noun the stem names (lowercased, singular-ish),
 *  e.g. "bias" out of "Which of these statements correctly explains bias?" -- used by R3 to look
 *  up the concept's own target-property set. Returns null when the stem is not determinate. */
export function extractStemConcept(stemText: string): string | null {
  const defectMatch = DEFECT_NOUN_RE.exec(stemText);
  if (defectMatch) return normalizeConceptNoun(defectMatch[1] as string);
  const virtueMatch = VIRTUE_NOUN_RE.exec(stemText);
  if (virtueMatch) return normalizeConceptNoun(virtueMatch[1] as string);
  return null;
}

// ─── Property-tag / claimType classification ────────────────────────────────────────────────────
//
// A small, curated, documented tag vocabulary -- checked in this specific order (most specific
// first) so e.g. an option mentioning both "estimate" and "on average" resolves to
// 'estimation-bias' rather than a more generic tag. Options matching none of these resolve to
// 'unclassified' -- R3 never eliminates an 'unclassified' option (see runR3WrongProperty below).

const CAUSE_PATTERN_RE =
  /\b(lack of|absence of|presence of|influence of\b[\s\S]*?\bon\b|due to|caused by|resulting from|because of)\b/i;

function classifyClaimType(text: string): string {
  if (CAUSE_PATTERN_RE.test(text)) {
    const m = CAUSE_PATTERN_RE.exec(text);
    const lead = (m ? m[0] : 'cause').toLowerCase().split(/\s+/).slice(0, 2).join('-');
    return `cause:${lead}`;
  }
  if (/\btoo (?:large|small)\b/i.test(text) || /\bsample size\b/i.test(text)) return 'sample-size';
  if (/\bon average\b/i.test(text) && /\bestimat/i.test(text)) return 'estimation-bias';
  if (/\balways\b[\s\S]*\baccurate\b/i.test(text) || /\baccurate estimates?\b/i.test(text)) return 'estimation-accuracy';
  if (/\brandom(?:iz(?:e|ation))?\b/i.test(text)) return 'randomness-method';
  if (/\brepresent(?:s|ative)?\b/i.test(text)) return 'representativeness';
  return 'unclassified';
}

/** Pure, synchronous decomposition of one option into {subject, claimType, polarity}. Does not
 *  consider the stem at all (subject/claimType/polarity are properties of the OPTION text alone;
 *  the stem's own polarity/concept are separate, computed once per question by
 *  determineStemPolarity/extractStemConcept above, and compared against each option's own
 *  polarity/claimType by the R1/R3 rule functions below). */
export function decomposeOption(option: McOption): DecomposedOption {
  return {
    letter: option.letter,
    subject: classifySubject(option.text),
    claimType: classifyClaimType(option.text),
    polarity: classifyOptionPolarity(option.text),
  };
}

// ─── R1: POLARITY MISMATCH ───────────────────────────────────────────────────────────────────────
//
// Applies ONLY when the stem's own polarity is DETERMINATE (asks for a flaw, or asks for a virtue)
// -- abstains from the rule entirely otherwise. Eliminates every option whose classified polarity
// is the OPPOSITE of the stem's determinate polarity. An option classified 'neutral' (polarity not
// confidently determined) is never eliminated by this rule -- ambiguous is not evidence.

export interface RuleEliminationResult {
  rule: 'R1' | 'R2' | 'R3';
  eliminated: string[];
  trace: string;
}

export function runR1PolarityMismatch(stemText: string, options: McOption[]): RuleEliminationResult | null {
  const stemPolarity = determineStemPolarity(stemText);
  if (stemPolarity === 'indeterminate') return null;
  const opposite: OptionPolarity = stemPolarity === 'defect' ? 'virtue' : 'defect';
  const eliminated = options.filter((o) => classifyOptionPolarity(o.text) === opposite);
  if (eliminated.length === 0) return null;
  return {
    rule: 'R1',
    eliminated: eliminated.map((o) => o.letter),
    trace:
      `R1 polarity_mismatch: stem polarity=${stemPolarity} (determinate), eliminated ${opposite}-polarity ` +
      `options [${eliminated.map((o) => o.letter).join(',')}]`,
  };
}

// ─── R2: CAUSE-IS-NOT-THE-THING ─────────────────────────────────────────────────────────────────
//
// Applies ONLY when the stem is definitional (the same DEFINITIONAL_STEM_RE gate R1/determinate-
// polarity uses -- a cause-vs-definition distinction only makes sense when the stem is asking FOR
// a definition in the first place). Eliminates any option whose claim is CAUSE-shaped (per
// CAUSE_PATTERN_RE above) -- an option naming a cause of the stem's concept cannot itself define
// that concept, regardless of its polarity.

export function runR2CauseIsNotTheThing(stemText: string, options: McOption[]): RuleEliminationResult | null {
  if (!DEFINITIONAL_STEM_RE.test(stemText)) return null;
  const eliminated = options.filter((o) => CAUSE_PATTERN_RE.test(o.text));
  if (eliminated.length === 0) return null;
  return {
    rule: 'R2',
    eliminated: eliminated.map((o) => o.letter),
    trace:
      `R2 cause_is_not_the_thing: stem is definitional, eliminated cause-shaped options ` +
      `[${eliminated.map((o) => `${o.letter}:${classifyClaimType(o.text)}`).join(',')}]`,
  };
}

// ─── R3: WRONG PROPERTY ─────────────────────────────────────────────────────────────────────────
//
// Curated concept -> acceptable-property-tag table. DELIBERATELY NARROW and small: this rule only
// ever fires when the stem's own concept noun (extractStemConcept) is a KEY in this table -- an
// unrecognized concept is an honest abstain, never a guess at what properties might be "wrong" for
// a concept this module has no curated basis to judge.
const CONCEPT_TARGET_PROPERTIES: Record<string, string[]> = {
  bias: ['representativeness', 'estimation-bias'],
};

/** Applies ONLY to options that are NOT already claimed by R1 (polarity-consistent with the stem)
 *  or R2 (not cause-shaped) -- see this file's header for why these jurisdictions are kept
 *  non-overlapping. Eliminates an option only when its claimType is CONFIDENTLY classified (not
 *  'unclassified') AND is not among the stem concept's own target-property set. */
export function runR3WrongProperty(stemText: string, options: McOption[]): RuleEliminationResult | null {
  const stemPolarity = determineStemPolarity(stemText);
  if (stemPolarity === 'indeterminate') return null;
  const concept = extractStemConcept(stemText);
  if (!concept) return null;
  const targetProperties = CONCEPT_TARGET_PROPERTIES[concept];
  if (!targetProperties) return null; // concept not in the curated table -- honest abstain

  const opposite: OptionPolarity = stemPolarity === 'defect' ? 'virtue' : 'defect';
  const eliminated: McOption[] = [];
  for (const o of options) {
    if (classifyOptionPolarity(o.text) === opposite) continue; // R1's jurisdiction, not R3's
    if (CAUSE_PATTERN_RE.test(o.text)) continue; // R2's jurisdiction, not R3's
    const tag = classifyClaimType(o.text);
    if (tag === 'unclassified') continue; // never eliminate on an unconfident classification
    if (targetProperties.includes(tag)) continue; // property matches the stem's own concept -- kept
    eliminated.push(o);
  }
  if (eliminated.length === 0) return null;
  return {
    rule: 'R3',
    eliminated: eliminated.map((o) => o.letter),
    trace:
      `R3 wrong_property: stem concept="${concept}" target properties=[${targetProperties.join(',')}], ` +
      `eliminated wrong-property options [${eliminated.map((o) => `${o.letter}:${classifyClaimType(o.text)}`).join(',')}]`,
  };
}

// ─── Top-level: run all three rules and combine ─────────────────────────────────────────────────

export interface EliminationChartResult {
  survivors: string[];
  eliminationsByRule: {
    R1: string[];
    R2: string[];
    R3: string[];
  };
  decomposed: DecomposedOption[];
  trace: string[];
}

/** Pure, synchronous, no I/O, no model call. Runs R1/R2/R3 (each independently gated -- see each
 *  rule's own header for its own abstain condition) against the FULL option set, unions their
 *  eliminations, and returns the survivors plus a per-rule breakdown of what each rule removed.
 *  Never eliminates every option (if the union would remove all options, that is a signal the
 *  decomposition mis-fired on this question -- this function returns the pre-elimination full
 *  option set as `survivors` in that case, logged in `trace`, rather than ever returning an empty
 *  survivor set). */
export function runEliminationChart(stemText: string, options: McOption[]): EliminationChartResult {
  const decomposed = options.map((o) => decomposeOption(o));
  const r1 = runR1PolarityMismatch(stemText, options);
  const r2 = runR2CauseIsNotTheThing(stemText, options);
  const r3 = runR3WrongProperty(stemText, options);

  const eliminationsByRule = {
    R1: r1?.eliminated ?? [],
    R2: r2?.eliminated ?? [],
    R3: r3?.eliminated ?? [],
  };
  const eliminatedSet = new Set<string>([...eliminationsByRule.R1, ...eliminationsByRule.R2, ...eliminationsByRule.R3]);
  let survivors = options.filter((o) => !eliminatedSet.has(o.letter)).map((o) => o.letter);

  const trace: string[] = [r1?.trace, r2?.trace, r3?.trace].filter((t): t is string => !!t);
  if (survivors.length === 0) {
    survivors = options.map((o) => o.letter);
    trace.push('SAFETY: combined eliminations would have removed every option -- discarded, full option set kept as survivors (decomposition mis-fire, never force a zero-survivor result).');
  }

  return { survivors, eliminationsByRule, decomposed, trace };
}
