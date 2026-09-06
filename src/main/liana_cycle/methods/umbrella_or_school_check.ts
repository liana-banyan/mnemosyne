// methods/umbrella_or_school_check.ts -- D-BP213-XO-64/BISHOP-XO/seg-composer-methods, LEG 3
//
// FOUNDER ORDER, session BP213, standing: "make more methods using didasko, into the liana cycle
// ... one leg at a time." LEG 1 is withheld_curve_shift_guard.ts (question_id 46). LEG 2 is
// set_equivalence_match.ts (question_id 6418). This file is LEG 3, aimed at dataset question_id
// 5152 (internal estate qid 92, "REGISTER inside a named school", the Didasko round 3 record).
// Per the Founder's own standing crosswalk rule (D-BP213-XO-49): cite dataset question_id as
// primary, internal qid in parentheses -- "question_id 5152 (internal qid 92)". Resolved and
// confirmed against C:\Users\Administrator\Documents\LianaBanyanPlatform\HARDWIRE\tools\qid\
// qid_crosswalk.mjs (toQuestionId(92) === 5152, toInternalQid(5152) === 92) and read directly off
// C:\Users\Administrator\Documents\DATASETS\MMLU-Pro\mmlu-pro-test.jsonl.
//
// THE SPEC THIS IMPLEMENTS: D-BP213-XO-32_FOUR_METHOD_SPECS.md METHOD 3, "UMBRELLA-OR-SCHOOL
// CHECK". Shape: the stem carries an attribution operator ("Within X,", "According to X,",
// "Under X,", "In the view of X,") naming a doctrine/framework X, and the false-confidence risk is
// treating X as one voice when X is actually a FAMILY of disagreeing sub-schools -- in which case
// an option saying "there is no single position / it depends" is the umbrella's own correct,
// determinate answer, not an abstention decoy to eliminate.
//
// XO-32'S OWN FLAG, AND WHY THIS DISPATCH IS DIFFERENT FROM LEGS 1 AND 2: the umbrella-vs-school
// refinement (the spec's own "surface form check", step 3 below) was derived AFTER the answer key
// was already open, and had never been re-tested blind against a second question. A rule fitted
// to a known answer is a fit, not a method -- it scores perfectly on the question it was carved
// from and buys nothing on the 12k. This dispatch's order is therefore INVERTED from legs 1/2:
// prove the trigger is not degenerate BEFORE writing any resolution logic, then hold the actual
// resolution logic to a genuine, disclosed blind re-test.
//
// STEP 1 RESULT (zero model calls, pure regex over all 12,032 rows of mmlu-pro-test.jsonl),
// tested standalone before any of the code below was written:
//   trigger = /(?:^|[.!?]\s|\n)(Within|According to|Under|In the view of)\s+([A-Z][A-Za-z0-9 '&-]{2,60}?),/
//   MATCHES: 50 / 12032 = 0.4156%. question_id 5152 is among them (operator "Within", label
//   "Critical Security Studies"). This is neither near-zero (leg1's post-axis-gate figure was
//   1/12032) nor near-everything (a wildcard) -- it is the SAME ORDER OF MAGNITUDE as leg1's own
//   healthy PRE-gate figure (1.845%). VERDICT: HEALTHY, not a fit, not a wildcard. Full 10-example
//   printout and the complete 50-id list are in the companion dispatch report,
//   BISHOP_DROPZONE\D-BP213-XO-64_LEG3.md.
//
//   A SECOND, PRE-EXISTING GATE ALSO APPLIES AND WAS MEASURED SEPARATELY, NOT INVENTED FOR THIS
//   METHOD: canon R-6 (method_registry.ts selectMethod()) requires the question's DEMAND to match
//   this method's declared demand BEFORE shapeTest() ever runs. demand_test.ts's own pre-existing
//   LOCATE-IN-FRAMEWORK cue (a BP150-fixed regex, /\b(?:[Ww]ithin|[Ii]n|[Aa]ccording to|[Uu]nder)\s+
//   [A-Z][\w-]*(?:\s+[A-Z][\w-]*)+\s*,/ -- REQUIRES A TWO-OR-MORE-CAPITALIZED-WORD LABEL, so a
//   single bare name like "Erikson" or "Piaget" never matches it) fires on 27/12032 = 0.2244% of
//   rows. INTERSECTING the two gates (this method's own 50-row trigger AND the pre-existing
//   demand cue's 27-row gate) leaves exactly 5 rows that will ever reach this method end to end in
//   the live engine: question_id 2174 (Maslow), 2346 (Sullivan), 2379 (Yalom), 5065 (The
//   Federalist Papers), and 5152 (Critical Security Studies) itself. That is the REAL reachable
//   population, and it is disclosed here rather than left to be discovered later -- this method's
//   own shapeTest() is deliberately built to the WIDER 50-row trigger (see step 3 below for why),
//   knowing the demand gate narrows it further upstream; shapeTest() must not silently duplicate a
//   gate that already exists elsewhere, per the same "each gate owns its own reason" discipline
//   leg1's axis-detection gate and leg2's universe-size gate both already follow.
//
// STEP 2 DESIGN, HARDWIRE-22 COMPLIANCE. Per the Founder's explicit BP213 order (same standing
// rule leg2's header already quotes in full): deciding whether a named doctrine is an umbrella
// over disagreeing sub-schools, and deciding which option encodes which sub-school's position, are
// CLASSIFICATIONS -- HARDWIRE-22 forbids sending a classification to a local model, full stop,
// "THE CODE DECIDES. ALWAYS." Every decision this file makes is therefore CODE-OWNED and LITERAL:
//   (a) label extraction (spec step 2) is a mechanical regex parse, not a judgment call -- the
//       label is, by construction, the capitalized phrase between the operator and the next comma;
//   (b) the UMBRELLA/not-umbrella surface-form check (spec step 3, "does X end in Studies or
//       Approaches") is a literal suffix lookup against the extracted label string, never a
//       semantic read of what X actually means;
//   (c) the founding-move / axis lookup (spec step 5) and the final survivor selection (spec
//       steps 6-9) are BOTH literal, disclosed, per-label lookups against a TAUGHT_FOUNDING_MOVE_MAP
//       that is populated with EXACTLY ONE entry today -- "critical security studies" -- sourced
//       directly, verbatim, from the spec's own WORKED EXAMPLE section (not invented from the
//       answer key: the axis facts, the Buzan-sectors elimination, and the agent/instrument
//       elimination are all stated as taught doctrine in the spec text itself, independent of
//       which letter the key names). No other label has a taught entry. A label with no entry
//       gets CANNOT DECIDE, exactly as spec step 5 prescribes ("If no taught entry exists for X,
//       output CANNOT DECIDE ... rather than improvising a founding move").
//
// WHY THIS FILE MAKES ZERO OLLAMA CALLS, SAME PRECEDENT AS LEG 2 (set_equivalence_match.ts).
// Every sub-decision this shape needs is either (a) a mechanical parse of literal text already
// present in the stem (label extraction), or (b) a literal string lookup that is EXCLUSIVELY a
// classification under HARDWIRE-22 and therefore must be code-owned, never a model call (the
// surface-form check, the founding-move lookup, the survivor-pattern match). There is
// consequently no legitimate site in this method's control flow for a `callModelExtraction`-style
// menu call -- manufacturing one just to match LEG 1's shape would be exactly the "force a fit"
// the Founder's dispatch order forbids (leg2's own header makes the identical point, verbatim,
// about its own file). If a future label's taught founding move genuinely requires disambiguating
// among several LITERAL, code-enumerated candidate option spans (the way leg1's menu-plus-NONE
// machinery disambiguates a literal quote), that is the legitimate future site for a menu call --
// it does not exist yet because the one taught label here resolves by direct literal pattern
// match, with no ambiguity for a menu to resolve.
//
// SURVIVOR SELECTION IS BY DIRECT LITERAL PATTERN MATCH, NOT BY EXCLUSION. The spec's worked
// example states plainly that exactly two options survive for question_id 5152 -- B ("the people
// and their collectives", the Welsh School's own answer) and E ("there is no specific referent
// point", the Copenhagen School's/umbrella's own honest answer) -- after eliminating A/D/F
// (Buzan's sectors, wrong axis) and H/C/G (agents/instrument, wrong part of speech). The spec does
// NOT state a rule for why I ("Political ideologies") and J ("The state and state apparatus", the
// named field-default decoy) are excluded from that final pair beyond "primary decoy, not chosen"
// for J. Rather than invent an unstated elimination rule to reach exactly two survivors by
// process of exclusion (which would be improvising past what the record actually teaches -- the
// same discipline spec step 5 names for the founding move), this file SELECTS the two survivors
// directly, by literal pattern match against the two taught candidate descriptions ("people ...
// collectives" for the named sub-school; "no specific referent" for the umbrella-honest answer).
// This is still 100% code-owned and literal, still scoped to exactly the one taught label, and it
// additionally still computes and reports the axis/part-of-speech eliminations from the worked
// example for audit transparency -- it just does not lean on them to produce the final two-letter
// answer, since the record does not fully specify how I and J are excluded that way.
//
// THE HONEST RESULT ON THE FOUNDING QUESTION ITSELF, PER THE SPEC'S OWN DISCLOSURE (not
// strengthened by this file): step 9 requires outputting BOTH survivor letters at LOW CONFIDENCE
// when they are not cleanly separated by step 8 -- and the spec explicitly disclaims that step 8's
// UMBRELLA branch would have produced E outright. So run() on question_id 5152 returns
// abstain:true, verdict:null, with both letters named in the basis -- NOT a forced single pick of
// E, even though E is the answer key. Forcing E here would be exactly the "post-hoc repair fitted
// to a known key" failure mode this whole dispatch exists to avoid.
//
// STEP 3, BLIND RE-TEST -- THE POINT OF THIS DISPATCH. question_id 5065 ("According to The
// Federalist Papers, federalism has which of the following effects on political factions?") is
// held out: it was never read while writing TAUGHT_FOUNDING_MOVE_MAP, it is in the REAL reachable
// population computed above (passes both the demand cue and this method's own shapeTest), and its
// label ("The Federalist Papers") is neither "critical security studies" nor any other taught
// entry. RESULT, reported honestly: shapeTest() DOES fire on question_id 5065 (matches:true) --
// the structural TRIGGER generalizes correctly to a question this method was never carved from.
// run() ABSTAINS with CANNOT DECIDE on question_id 5065, because TAUGHT_FOUNDING_MOVE_MAP has no
// entry for "the federalist papers" -- the RESOLUTION machinery does NOT yet generalize past its
// one founding label. BOTH FACTS ARE REPORTED, PER THE DISPATCH ORDER: the trigger is a real,
// generalizing method; the verdict-producing half is, today, a fit to its founding question only,
// exactly like leg2's platypus. Populating TAUGHT_FOUNDING_MOVE_MAP with additional real, sourced
// doctrine entries is a Founder/future-dispatch act, same disclosure as leg2's empty map.
//
// Rule 66: new file, no supersede needed. No em-dashes -- "--" used throughout. American spelling.

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput, MethodRunContext, ShapeTestResult } from '../method_registry';
import type { LianaTerminalOutcome } from '../../../shared/liana_cycle/liana_terminal_types';

function nowIso(): string {
  return new Date().toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// TRIGGER -- pure, no I/O, shared by shapeTest() and run() so the two never disagree. This is
// exactly the regex proven over all 12,032 rows in the step-1 scan cited in the header (50
// matches, 0.4156%, question_id 5152 included). Anchored to a sentence/string boundary (start of
// string, or right after ". "/"! "/"? "/newline), same discipline as leg1's SUBPART_LABEL_RE --
// an attribution operator mid-sentence is not the shape the spec targets (a stem OPENING with
// "Within X," / "According to X," / "Under X," / "In the view of X,").
// ─────────────────────────────────────────────────────────────────────────────────────────────

const OPERATOR_RE = /(?:^|[.!?]\s|\n)(Within|According to|Under|In the view of)\s+([A-Z][A-Za-z0-9 '&-]{2,60}?),/;

interface OperatorMatch {
  operator: string;
  label: string;
}

/** Mechanical extraction only -- never a judgment. The label is, by construction, the literal
 *  capitalized phrase between the operator and the terminating comma. */
function findOperatorLabel(question: string): OperatorMatch | null {
  const m = OPERATOR_RE.exec(question);
  if (!m) return null;
  return { operator: m[1], label: m[2].trim() };
}

function normalizeLabel(label: string): string {
  return label.toLowerCase().trim().replace(/\s+/g, ' ');
}

/** Spec step 3, "surface form check": literal suffix lookup against the label string. A lookup
 *  against SURFACE FORM, not a judgment about the field's actual content, per the spec's own
 *  wording. Deliberately narrow (the two suffixes the spec names) -- widening this past what the
 *  record demonstrates would be a new, undemonstrated risk, same discipline as every other
 *  narrowing heuristic in leg1/leg2. */
function isUmbrellaShapedLabel(label: string): boolean {
  const norm = normalizeLabel(label);
  return /\b(studies|approaches)$/.test(norm);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// TAUGHT_FOUNDING_MOVE_MAP -- exactly one entry, sourced verbatim from the spec's WORKED EXAMPLE
// section (D-BP213-XO-32_FOUR_METHOD_SPECS.md METHOD 3), never from the answer key. Every literal
// string below is quoted, disclosed doctrine -- not invented, not fitted post-hoc to E. Populating
// further entries is a Founder/future-dispatch act, same disclosure discipline as leg2's empty
// TAUGHT_ITEM_MEMBERSHIP_MAP.
// ─────────────────────────────────────────────────────────────────────────────────────────────

interface FoundingMoveEntry {
  /** Human-readable citation of the taught founding move, for the transcript only. */
  foundingMove: string;
  /** Literal (normalized, case-insensitive) substrings that mark an option as eliminated on the
   *  WRONG AXIS (Buzan's sectors -- "secured against what", not "who is secured"). Sourced
   *  verbatim from the worked example's own option text. */
  eliminatedAxisSubstrings: string[];
  /** Literal substrings marking an option eliminated on WRONG PART OF SPEECH (an agent or an
   *  instrument offered where a referent/object is asked for). */
  eliminatedPosSubstrings: string[];
  /** The field-default option -- named as the PRIMARY DECOY (spec step 4), not eliminated by an
   *  axis or POS rule, but excluded from the final survivor pair because the taught founding move
   *  is precisely a departure from this default. */
  fieldDefaultSubstring: string;
  /** The two taught survivor descriptions, matched by literal substring against option text.
   *  survivorA = the named sub-school's own answer; survivorB = the umbrella's own honest ("no
   *  consensus" / "no specific referent") answer. */
  survivorASubstring: string;
  survivorBSubstring: string;
}

const TAUGHT_FOUNDING_MOVE_MAP: Record<string, FoundingMoveEntry> = {
  'critical security studies': {
    foundingMove: 'deepening the referent object from the state to the human being (the referent-' +
      'object axis), per the spec\'s WORKED EXAMPLE for question_id 5152 (internal qid 92)',
    eliminatedAxisSubstrings: ['technological systems', 'economic structures', 'the environment'],
    eliminatedPosSubstrings: ['non-state actors', 'international organizations', 'military power'],
    fieldDefaultSubstring: 'the state and state apparatus',
    survivorASubstring: 'people and their collectives',
    survivorBSubstring: 'no specific referent',
  },
  // No other label has a taught founding move today. See header: populating one is a
  // Founder/future-dispatch act, sourced from a real reference, never from a single worked
  // example's answer key.
};

function lookupFoundingMove(label: string): FoundingMoveEntry | null {
  return TAUGHT_FOUNDING_MOVE_MAP[normalizeLabel(label)] ?? null;
}

function normalizeOptionText(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[."'\u2018\u2019\u201c\u201d]+$/g, '');
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// shapeTest -- THE TRIGGER. Pure, no I/O, never reads input.correctAnswer. Matches the WIDER
// 50-row population proven in the step-1 scan (header), knowing the pre-existing demand-cue gate
// (method_registry.ts / demand_test.ts, canon R-6) narrows the real reachable population further,
// upstream of this method entirely -- this file does not duplicate that gate.
// ─────────────────────────────────────────────────────────────────────────────────────────────

function shapeTest(input: MethodQuestionInput): ShapeTestResult {
  if (!input.options || Object.keys(input.options).length < 2) {
    return {
      matches: false,
      reason: 'no lettered option list with >=2 rows -- this method needs the option list to ' +
        'select the taught survivor pair against; it does not work stem-only.',
    };
  }

  const question = input.question || '';
  const found = findOperatorLabel(question);
  if (!found) {
    return {
      matches: false,
      reason: 'no attribution operator ("Within X,", "According to X,", "Under X,", "In the view ' +
        'of X,") found at a sentence/string boundary in the stem -- this method targets a question ' +
        'that opens by attributing its answer to a named doctrine, not a general stem.',
    };
  }

  const umbrella = isUmbrellaShapedLabel(found.label);
  const surfaceFormNote = umbrella
    ? 'ends in Studies/Approaches -> UMBRELLA=true'
    : 'does not end in Studies/Approaches -> UMBRELLA=false';
  return {
    matches: true,
    reason: `attribution operator "${found.operator}" found, label "${found.label}" extracted ` +
      `(surface-form check: ${surfaceFormNote}) -- eligible for the taught founding-move lookup ` +
      'in run(), which abstains honestly with CANNOT DECIDE whenever this label has no taught entry.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// run -- CODE decides everything. NEVER calls a model (see header for why that is correct for
// this shape). NEVER reads input.correctAnswer.
// ─────────────────────────────────────────────────────────────────────────────────────────────

async function run(input: MethodQuestionInput, ctx: MethodRunContext): Promise<LianaTerminalOutcome> {
  const question = input.question || '';
  const options = input.options || {};

  try {
    const found = findOperatorLabel(question);
    if (!found) {
      // shapeTest should have refused before run() was ever called; defensive re-check.
      return {
        question,
        verdict: null,
        abstain: true,
        freeText: false,
        method: 'umbrella-or-school-check',
        basis: 'attribution-operator re-check inside run() failed even though shapeTest passed -- ' +
          'refuses rather than assuming the earlier gate; should not happen, flagged if seen.',
      };
    }

    const umbrella = isUmbrellaShapedLabel(found.label);
    ctx.emit({
      kind: 'stage',
      text: `   umbrella-or-school-check: operator "${found.operator}", label "${found.label}", ` +
        `surface-form UMBRELLA = ${umbrella} (code-only lookup, never sent to a model)`,
      ts: nowIso(),
    });

    const entry = lookupFoundingMove(found.label);
    if (!entry) {
      return {
        question,
        verdict: null,
        abstain: true,
        freeText: false,
        method: 'umbrella-or-school-check',
        basis: `CANNOT DECIDE (spec step 5): label "${found.label}" (UMBRELLA=${umbrella}) has no ` +
          'entry in the taught founding-move map. Per the Founder\'s explicit BP213 order, this ' +
          'method NEVER asks a local model to supply an unmapped founding move or axis -- deciding ' +
          'whether a doctrine is internally contested, and which option encodes which sub-school\'s ' +
          'position, are CLASSIFICATIONS under HARDWIRE-22 ("THE CODE DECIDES. ALWAYS."), and the ' +
          'only sourced taught entry in this codebase today is "critical security studies" ' +
          '(question_id 5152 / internal qid 92). DECLARED PLATYPUS for this label: the attribution' +
          '-operator shape is correctly detected (shapeTest matched), but deriving a verdict needs ' +
          'a real, sourced founding-move map this dispatch does not have for this label and will ' +
          'not fabricate. See D-BP213-XO-32_FOUR_METHOD_SPECS.md Method 3 falsifier #1, which ' +
          'predicted exactly this kind of unmapped-label gap.',
      };
    }

    // From here on, entry is populated ONLY for "critical security studies" today -- this branch
    // is exercised exclusively by question_id 5152 (internal qid 92) in the current map.
    const letters = Object.keys(options);
    const norm = (letter: string): string => normalizeOptionText(options[letter] ?? '');

    const axisEliminated = letters.filter((l) => entry.eliminatedAxisSubstrings.some((s) => norm(l).includes(s)));
    const posEliminated = letters.filter((l) => entry.eliminatedPosSubstrings.some((s) => norm(l).includes(s)));
    const fieldDefaultLetters = letters.filter((l) => norm(l).includes(entry.fieldDefaultSubstring));
    const survivorALetters = letters.filter((l) => norm(l).includes(entry.survivorASubstring));
    const survivorBLetters = letters.filter((l) => norm(l).includes(entry.survivorBSubstring));

    ctx.emit({
      kind: 'fact',
      text: `   umbrella-or-school-check founding move: ${entry.foundingMove}. Wrong-axis eliminated: ` +
        `${axisEliminated.join(', ') || '(none matched)'}. Wrong-part-of-speech eliminated: ` +
        `${posEliminated.join(', ') || '(none matched)'}. Field-default primary decoy (marked, not ` +
        `chosen): ${fieldDefaultLetters.join(', ') || '(none matched)'}.`,
      ts: nowIso(),
    });

    if (survivorALetters.length !== 1 || survivorBLetters.length !== 1) {
      return {
        question,
        verdict: null,
        abstain: true,
        freeText: false,
        method: 'umbrella-or-school-check',
        basis: `unscoreable: taught survivor patterns did not literally match this question's ` +
          `option text exactly once each (survivor-A "${entry.survivorASubstring}" matched ` +
          `[${survivorALetters.join(', ')}], survivor-B "${entry.survivorBSubstring}" matched ` +
          `[${survivorBLetters.join(', ')}]) -- this question's option wording differs from the ` +
          'taught worked example; refuses rather than guessing which option is which.',
      };
    }

    const survivorA = survivorALetters[0];
    const survivorB = survivorBLetters[0];

    if (!umbrella) {
      // Spec step 8, UMBRELLA=false branch: X's own named-school position (survivorA, by this
      // map's own convention) wins outright over a neighboring school's position. Not exercised
      // by the one taught entry today (critical security studies IS umbrella-shaped), kept for
      // when a non-umbrella taught entry exists.
      return {
        question,
        verdict: survivorA,
        abstain: false,
        freeText: false,
        method: 'umbrella-or-school-check',
        basis: `UMBRELLA=false: option ${survivorA} ("${entry.survivorASubstring}") encodes X's ` +
          `own taught position and wins over the neighboring-school option ${survivorB} ` +
          `("${entry.survivorBSubstring}"), per spec step 8.`,
      };
    }

    // Spec step 8/9, UMBRELLA=true branch: BOTH survivors stay live, not cleanly separated -- the
    // spec's own worked example explicitly disclaims that this step would have produced the key
    // letter (E) outright. Reporting both, low confidence, is the honest output, not a forced pick.
    return {
      question,
      verdict: null,
      abstain: true,
      freeText: false,
      method: 'umbrella-or-school-check',
      basis: `UMBRELLA=true, spec step 9: options ${survivorA} ("${entry.survivorASubstring}") and ` +
        `${survivorB} ("${entry.survivorBSubstring}") are BOTH LIVE CANDIDATES, not cleanly ` +
        'separated by step 8 -- the "no consensus/no specific referent" option is carried forward ' +
        'as a genuine candidate, not eliminated as a sophistication trap, per the umbrella branch. ' +
        'Per spec: "does not claim step 8\'s UMBRELLA branch would have produced [the key] outright" ' +
        '-- this is strictly better than the false confidence the old (pre-repair) rule produced, ' +
        'but is reported honestly as low-confidence, two-letter, not a single forced verdict.',
    };
  } catch (e) {
    return {
      question,
      verdict: null,
      abstain: true,
      freeText: false,
      method: 'umbrella-or-school-check',
      basis: `umbrella-or-school-check threw: ${String((e as Error)?.message ?? e)}`,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE LianaMethod OBJECT
// ─────────────────────────────────────────────────────────────────────────────────────────────

export const umbrellaOrSchoolCheckMethod: LianaMethod = {
  id: 'umbrella-or-school-check',
  // LOCATE-IN-FRAMEWORK: qid 92 is the demand table's own named example for this demand
  // (demand_test.ts LianaDemand doc comment, "the answer is a term's role inside a named theory
  // (qid 92)") -- this method's own answer is exactly that: a term's role (referent object)
  // inside a named theory (Critical Security Studies).
  demand: 'LOCATE-IN-FRAMEWORK',
  name: 'Umbrella-or-School Check (detects a stem attributing its answer to a named doctrine via ' +
    'an operator like "Within X," / "According to X,", classifies X as an umbrella family or a ' +
    'single school by literal surface form, then looks up X\'s taught founding move to select the ' +
    'survivor pair -- abstains with CANNOT DECIDE, never asks a local model, whenever X has no ' +
    'taught entry)',
  taughtBy: 'D-BP213-XO-32_FOUR_METHOD_SPECS.md METHOD 3 (Didasko Round 3, dataset question_id ' +
    '5152, internal estate qid 92, "REGISTER inside a named school"), built per Founder standing ' +
    'order (BP213, "make more methods using didasko, into the liana cycle ... one leg at a time") ' +
    'and the explicit BP213 dispatch instruction that the umbrella-vs-school refinement, derived ' +
    'post-hoc after the key was seen, must be re-tested blind before being trusted (D-BP213-XO-64 ' +
    'dispatch order).',
  shapeDescription: 'a lettered MCQ stem opening with an attribution operator ("Within X,", ' +
    '"According to X,", "Under X,", "In the view of X,") naming a doctrine X, with >=2 options -- ' +
    'refuses honestly on fewer than 2 options or no attribution operator found. Verdict derivation ' +
    'additionally requires a taught, sourced founding-move entry for X; today that map holds ' +
    'exactly one entry ("critical security studies", sourced from the spec\'s own worked example, ' +
    'never from the answer key), so run() abstains with CANNOT DECIDE for every other label. This ' +
    'is a declared, disclosed platypus on the resolution half for unmapped labels, not a silent ' +
    'gap -- see the file header, including the STEP 3 blind re-test against question_id 5065 ' +
    '("The Federalist Papers"), which fires (shapeTest matches) but abstains (no taught entry).',
  shapeTest,
  run,
};

// Registers at import time, same convention as every other method module. The registerMethod()
// call alone is NOT sufficient to make this method reachable -- liana_terminal_engine.ts's own
// side-effect import block must ALSO import this file (done in the same dispatch, added directly
// after the set_equivalence_match.ts import).
registerMethod(umbrellaOrSchoolCheckMethod);

// D-BP213-XO-64 TEST HOOKS, ADDITIVE ONLY, NO BEHAVIOR CHANGE. Exposes the real primitives so a
// standalone vitest suite exercises the actual production code, never a reimplementation of it.
export const __xo64TestHooks = {
  findOperatorLabel,
  normalizeLabel,
  isUmbrellaShapedLabel,
  lookupFoundingMove,
  OPERATOR_RE,
};
