// methods/set_equivalence_match.ts -- D-BP213-XO-57/BISHOP-XO/seg-composer-methods, LEG 2
//
// FOUNDER ORDER, session BP213, standing: "make more methods using didasko, into the liana cycle
// ... one leg at a time, so we can make this provable and ship it." LEG 1 IS
// withheld_curve_shift_guard.ts (dataset question_id 46, key G) -- this file is LEG 2, aimed at
// dataset question_id 6418 (internal estate qid 66, "the Oxford comma / grouping" round of the
// Didasko record). Per the Founder's own standing crosswalk rule (D-BP213-XO-49): cite dataset
// question_id as primary, internal qid in parentheses -- "question_id 6418 (internal qid 66)".
//
// THE SPEC THIS IMPLEMENTS: D-BP213-XO-32_FOUR_METHOD_SPECS.md METHOD 2, "SET-EQUIVALENCE MATCH".
// Shape: every option is a comma-separated SUBSET of a small, bounded universe of named items
// (the spec's own framing: "Not labels -- SETS. Ten options, each a subset of {hard palate, upper
// lip, upper central incisor, lower first molar}."). The spec's own procedure has two genuinely
// separate halves:
//   HALF A (pure code, zero domain knowledge, zero model calls): parse each option into its item
//     set, compute a canonical (order-independent, punctuation-independent) signature per option,
//     and flag any two options sharing a signature as a PARAPHRASE COLLISION -- the spec's own
//     worked example is exactly this method's founding question, where options B and F differ
//     only by an Oxford comma and denote the IDENTICAL three-item set.
//   HALF B (the actual verdict): for each item in the universe, decide whether it belongs to the
//     set the question stem is actually asking about (spec step 4: "look up its membership fact
//     against a pre-taught, sourced map"). THIS IS A CLASSIFICATION, NOT AN EXTRACTION -- see next
//     section for why that distinction is the entire design of this file.
//
// THE KNOWN BLOCKER, DECIDED HERE PER EXPLICIT FOUNDER INSTRUCTION (BP213 dispatch order,
// verbatim): "IF MEMBERSHIP CANNOT BE DECIDED BY CODE OR EXTRACTED LITERALLY, THE METHOD MUST
// ABSTAIN, NOT ASK GEMMA TO JUDGE. Deciding whether item X belongs to set Y is a CLASSIFICATION,
// and HARDWIRE-22 forbids sending classifications to a local model: 'THE CODE DECIDES. ALWAYS.'"
//
// VERIFIED BEFORE WRITING ANY CODE, NOT ASSUMED: (1) grepped mnemosyne/src for
// submandibular|lymph|item.?membership|taught.?map -- zero hits naming a taught anatomical
// item-membership map anywhere in this codebase. (2) Read the real stem off the dataset
// (mmlu-pro-test.jsonl, question_id 6418): "You notice that your patient's submandibular lymph
// nodes are enlarged. You would look for potential infection sites in the ___." The stem contains
// NO literal mention of "hard palate", "upper lip", "upper central incisor", or "lower first
// molar" anywhere -- those item names exist ONLY inside the option text. Unlike LEG 1 (whose
// founding example states its own price/cost facts inside the question text, so masking-then-
// extracting a literal quote is a real, honest operation), this shape's membership fact is
// EXTERNAL anatomical knowledge that is not present in the text at all, in any form, for a
// menu-of-literal-candidates extraction to point at. There is no "clue in the stem" for a
// menu-plus-NONE index pick to honestly recover -- so copying LEG 1's mask-then-extract machinery
// here would not be an extraction, it would be dressing up a guess as one.
//
// THE DECISION: HALF A is real, is buildable without the missing map, is buildable without a
// single model call, and is wired into the registry below. HALF B genuinely needs a taught,
// sourced item-membership map that does not exist in this codebase today. Per the Founder's own
// order above, that gap is not patched by inventing a fake map scoped to only this one founding
// question (that would be memorizing this question's answer key, not teaching a generalizable
// method -- and Method 2's own falsifier #2 in the spec names exactly this failure: "wiring this
// method in without first building the taught map ... will convert a correct abstain into a
// confident guess on unmapped items"), and it is not patched by asking gemma2:2b to supply the
// missing anatomical fact (a HARDWIRE-22 violation, full stop, regardless of how the prompt is
// worded). So run() below performs HALF A unconditionally (every real question of this shape gets
// its paraphrase collisions reported, always, whether or not HALF B can complete), then attempts
// HALF B against a TAUGHT_ITEM_MEMBERSHIP_MAP that is, by design and by disclosure, EMPTY today --
// every item comes back UNKNOWN, and the method abstains with CANNOT DECIDE, exactly as the
// spec's own step 4b prescribes ("If the taught map has NO entry for an item ... output CANNOT
// DECIDE for the whole set. Do not guess an unmapped item's membership").
//
// **DECLARED PLATYPUS, per the Founder's own naming convention for this exact situation**: HALF B
// (deriving a single verdict letter for a set-equivalence question) cannot be completed today
// without either violating HARDWIRE-22 or memorizing this one question's key. It is filed here,
// openly, for the Didasko pile, rather than forced. Populating TAUGHT_ITEM_MEMBERSHIP_MAP with a
// real, sourced domain fact table is a Founder/future-dispatch act -- this file only builds the
// (real, generalizable, already-useful) machinery that will consult it once it exists.
//
// WHY THIS FILE MAKES ZERO OLLAMA CALLS, AND WHY THAT IS NOT A GAP. Every sub-decision this shape
// needs is either (a) fully code-decidable from the option text alone (item parsing, signature
// canonicalization, collision detection -- all pure string operations, no ambiguity, no judgment)
// or (b) the one genuine judgment call (item-set membership), which is EXCLUSIVELY a classification
// under HARDWIRE-22 and therefore MUST be a code-owned lookup against a sourced map, never a model
// call, EVEN ONCE A TAUGHT MAP EXISTS -- the model's role in that future state, if any, is in
// CURATING the map offline (a flagship task, not a gemma2:2b runtime task), not in answering this
// method's per-question lookups. There is consequently no legitimate site in this method's control
// flow for a `callModelExtraction`-style menu call, unlike LEG 1 where three such sites existed
// because LEG 1's facts are IN the text. Manufacturing a model call here just to match LEG 1's
// shape would be exactly the "force a fit" the Founder's dispatch order explicitly forbade.
//
// Rule 66: new file, no supersede needed. No em-dashes -- "--" used throughout. American spelling.

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput, MethodRunContext, ShapeTestResult } from '../method_registry';
import type { LianaTerminalOutcome } from '../../../shared/liana_cycle/liana_terminal_types';

function nowIso(): string {
  return new Date().toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// QUARANTINE -- added 2026-09-05, D-BP220-BM0-006/BISHOP-SEG. DO NOT REMOVE WITHOUT A FOUNDER
// RULING. This block is the ENFORCEMENT mechanism; the file header above already carries the full
// method design and is unmodified by this fence -- this method's HALF A/HALF B split, its honest
// empty-map abstain, and its shapeTest()/run() bodies are NOT changed, per explicit instruction
// not to delete or "fix" this method's logic.
//
// MEASURED FACTS, DATED 2026-09-05 (do not re-derive; cite these):
//   - Free shapeTest() coverage sweep, 12,032 MMLU-Pro questions, 283ms wall clock, ZERO model
//     calls, ZERO dollars (BISHOP_DROPZONE\D-BP219-BM0-015_SHAPETEST_COVERAGE\
//     shapetest_coverage_sweep.cjs and its shapetest_coverage_report.json): four Didasko-derived
//     methods hit 1 / 273 / 50 / 3 questions respectively. This method, set-equivalence-match, is
//     the 273 (2.269 percent of the corpus, spanning all 14 MMLU-Pro categories).
//   - shapeTest() above is the ONLY one of the four that NEVER READS THE QUESTION STEM -- verified
//     by direct source read: it takes only `input.options` (parseOptions/buildUniverse/
//     findCollisions all operate on option text alone) and never touches `input.question`
//     anywhere in its own body or the pure helpers it calls. It matches on option-list
//     punctuation/shape alone, never on what the question is actually asking.
//   - Roughly 34 percent of its 273 shapeTest matches produce a paraphrase collision (two or more
//     options sharing a canonical item-set signature) -- a surface-punctuation artifact of the
//     option list, not evidence this method understood the question.
//   - 50 of its 273 matches would SUPPRESS THE KEYED CORRECT ANSWER if TAUGHT_ITEM_MEMBERSHIP_MAP
//     were ever populated (taught) and run() allowed to derive a real verdict from it, per BM0's
//     own self-correction (HARDWIRE\LEDGER\CANOE\D-BP219-BM0-040.canoe.md: "the 273 is ACCIDENTAL
//     BREADTH, proven: that method never reads the question stem, and 50 of its 273 would
//     suppress the correct answer once taught").
//   - CONCLUSION: this method's 273-question shapeTest breadth is ACCIDENTAL, not real
//     discrimination. A method that never reads the question stem cannot be discriminating ON the
//     question. It must not be taught (its item-membership map populated) or applied (its run()
//     allowed to produce a real, non-quarantined verdict) until a Founder ruling lifts this.
//
// WHAT THIS FENCE DOES, AND DOES NOT DO:
//   1. Marks this method QUARANTINED via two machine-readable exports (SET_EQUIVALENCE_MATCH_
//      QUARANTINED, and the `quarantined`/`quarantineReason` fields on the exported LianaMethod
//      object below) so ANY registry or teaching path can check it programmatically, not by
//      convention or comment alone. method_registry.ts's selectMethod()/selectEligibleMethods()
//      read `quarantined` and skip this method during real selection (see that file's own
//      changes, same dispatch) -- so a normal production run never reaches run() for this method
//      at all, and the other ~97.7% of the corpus is completely unaffected by this fence.
//   2. Makes run() (the APPLY path) FAIL LOUDLY -- it emits a named error event, then throws
//      SetEquivalenceMatchQuarantineError -- instead of silently computing (or silently
//      abstaining). A silent abstain is how a quarantine gets forgotten and quietly re-taught;
//      a thrown, named error is not. Any caller that reaches run() directly (bypassing the
//      registry's own skip, e.g. a future teaching tool or a direct method.run() call) still
//      cannot get a verdict out of this method without first tripping the fence and reading why.
//   3. Leaves shapeTest() and every existing pure HALF A helper (parseOptions, buildUniverse,
//      findCollisions, canonicalSignature, etc., all exported via __xo57TestHooks below)
//      COMPLETELY UNCHANGED and callable -- coverage sweeps, fixture harnesses, and any other
//      pure measurement/inspection caller keep working exactly as before. This fence stops
//      TRUST, never VISIBILITY. The original run() logic (HALF A report + HALF B empty-map
//      abstain) is preserved verbatim as runUnguarded(), below, reachable only through
//      __xo57TestHooks for inspection -- never through the registered method's own `run`.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** Machine-readable quarantine flag. Check this before trusting anything this method's `run`
 *  would report, or before wiring any teaching path at TAUGHT_ITEM_MEMBERSHIP_MAP. See the
 *  QUARANTINE block above for the measured reason. */
export const SET_EQUIVALENCE_MATCH_QUARANTINED = true as const;

/** The exact, full reason text every fenced caller sees. Kept as one exported string (rather than
 *  only living in a comment) so a refusal message, a log line, and this file's own header always
 *  say the identical thing -- see the QUARANTINE block above for the measured facts this quotes. */
export const SET_EQUIVALENCE_MATCH_QUARANTINE_REASON =
  'set-equivalence-match is QUARANTINED (measured 2026-09-05, D-BP219 coverage sweep + BM0 ' +
  'self-correction, D-BP219-BM0-040 canoe): shapeTest() never reads the question stem -- it ' +
  'matches on option-list punctuation/shape alone -- so its 273/12,032 shapeTest coverage ' +
  '(2.269 percent of MMLU-Pro) is ACCIDENTAL BREADTH, not real discrimination. Roughly 34 ' +
  'percent of those 273 matches are paraphrase collisions (surface-shape duplicates, not ' +
  'understood questions), and 50 of the 273 would SUPPRESS THE KEYED CORRECT ANSWER if this ' +
  'method were taught (TAUGHT_ITEM_MEMBERSHIP_MAP populated with real entries) and its run() ' +
  'allowed to apply that table as-is. This method must not be taught or applied until a Founder ' +
  'ruling explicitly lifts this quarantine. shapeTest() itself remains fully callable for ' +
  'measurement, coverage sweeps, and inspection -- only run() (the APPLY path) is fenced.';

/** Thrown by the registered `run` below on every call, naming the quarantine reason. A distinct
 *  class (not a bare Error) so any caller that wants to distinguish "this method is quarantined"
 *  from an ordinary bug can do so with `instanceof`, without string-matching the message. */
export class SetEquivalenceMatchQuarantineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SetEquivalenceMatchQuarantineError';
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// HALF A HELPERS -- pure, no I/O, shared by shapeTest() and run() so the two never disagree.
// ─────────────────────────────────────────────────────────────────────────────────────────────

// This method's own scope, per the spec's own framing ("roughly 3-6 distinct items"). The
// founding example (question_id 6418) has exactly 4 -- comfortably inside this band. A universe
// outside this band is refused rather than force-fit (too small = not a real combinatorial set
// question; too large = likely a different shape entirely, e.g. a plain single-choice list).
const MIN_UNIVERSE_SIZE = 3;
const MAX_UNIVERSE_SIZE = 6;

// The minimum fraction of an option's alphanumeric content that must be accounted for by its
// parsed items, for that option to count as "cleanly" item-list-shaped. A narrowing heuristic,
// disclosed here rather than silently assumed: connector words ("and", "or") and punctuation are
// expected to be discarded by the split below, but a genuinely different shape (a sentence-style
// option, a numeric option, free prose) would leave much more unparsed residue than that.
const CLEAN_PARSE_MIN_FRACTION = 0.75;

/** Splits one option's text into its item phrases. Handles both "X, Y, and Z" (Oxford comma) and
 *  "X, Y and Z" (no Oxford comma) and the two-item "X and Y" form identically -- collapsing that
 *  distinction into the SAME split behavior is deliberate: it is exactly what makes options B and
 *  F of the founding example produce the identical parsed item list, which is the paraphrase
 *  collision this method exists to catch. Never invents an item that is not a literal substring
 *  of the option text; only slices on commas and the connector words "and"/"or". */
function splitOptionIntoItems(optionText: string): string[] {
  let t = optionText.trim().replace(/\.\s*$/, '');
  // Collapse an optional comma plus a serial "and"/"or" into a plain comma so a single
  // comma-split handles "X, Y, and Z", "X, Y and Z", and "X and Y" uniformly.
  t = t.replace(/,?\s+\b(and|or)\b\s+/gi, ', ');
  return t
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Normalizes one item phrase for set-membership comparison: lowercase, collapsed whitespace,
 *  stripped of leading/trailing punctuation. NOT a semantic normalization (no synonym folding) --
 *  a literal, disclosed, punctuation-only canonicalization, same discipline as LEG 1's
 *  normalizeClause(). */
function canonicalItem(item: string): string {
  return item
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^[."'‘’“”(]+|[.,;:"'‘’“”)]+$/g, '')
    .trim();
}

/** Order-independent, duplicate-collapsing signature for one option's parsed item set. Two
 *  options with the identical signature denote the identical set regardless of wording -- this is
 *  the mechanical detector for the "Oxford comma" paraphrase collision (spec Method 2, step 1). */
function canonicalSignature(items: string[]): string {
  return [...new Set(items.map(canonicalItem))].sort().join('|');
}

/** Loose sanity check: does this option's parsed item list account for most of its alphanumeric
 *  content? Guards shapeTest against false-positiving on an unrelated small-vocabulary free-text
 *  option that happens to contain a comma or the word "and" but is not actually an item-list. */
function optionParsesCleanly(original: string, items: string[]): boolean {
  const alnumOnly = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const originalLen = alnumOnly(original).length;
  if (originalLen === 0) return false;
  const itemsLen = alnumOnly(items.join('')).length;
  return itemsLen / originalLen >= CLEAN_PARSE_MIN_FRACTION;
}

interface ParsedOption {
  letter: string;
  text: string;
  items: string[];
  signature: string;
}

function parseOptions(options: Record<string, string>): ParsedOption[] {
  return Object.entries(options).map(([letter, text]) => {
    const items = splitOptionIntoItems(text);
    return { letter, text, items, signature: canonicalSignature(items) };
  });
}

function buildUniverse(parsed: ParsedOption[]): string[] {
  const set = new Set<string>();
  for (const p of parsed) for (const it of p.items) set.add(canonicalItem(it));
  return [...set].sort();
}

function findCollisions(parsed: ParsedOption[]): { signature: string; letters: string[] }[] {
  const bySig = new Map<string, string[]>();
  for (const p of parsed) {
    const arr = bySig.get(p.signature) ?? [];
    arr.push(p.letter);
    bySig.set(p.signature, arr);
  }
  return [...bySig.entries()]
    .filter(([, letters]) => letters.length > 1)
    .map(([signature, letters]) => ({ signature, letters: letters.sort() }));
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// HALF B -- the taught item-membership map. EMPTY BY DESIGN. See header comment: populating this
// is a Founder/future-dispatch act, sourced from a real reference, never inferred from a single
// worked example. `relationKey` is a provisional keying scheme (the normalized full stem text) --
// deliberately not designed further than that, since zero entries exist yet to design a better
// key FROM. CODE ONLY consults this table; it is never sent to, and never filled in by, gemma.
// ─────────────────────────────────────────────────────────────────────────────────────────────

type MembershipVerdict = 'YES' | 'NO';

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- deliberately empty, see header.
const TAUGHT_ITEM_MEMBERSHIP_MAP: Record<string, Record<string, MembershipVerdict>> = {
  // No domain has been taught to this method yet. Do not add a speculative or single-example
  // entry here -- see the header comment's falsifier discussion (D-BP213-XO-32 Method 2,
  // falsifier #2) for exactly why that would convert an honest abstain into a disguised guess.
};

function normalizeRelationKey(question: string): string {
  return question.toLowerCase().trim().replace(/\s+/g, ' ');
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// shapeTest -- THE TRIGGER. Pure, no I/O, never reads input.correctAnswer.
// ─────────────────────────────────────────────────────────────────────────────────────────────

function shapeTest(input: MethodQuestionInput): ShapeTestResult {
  if (!input.options || Object.keys(input.options).length < 2) {
    return {
      matches: false,
      reason: 'no lettered option list with >=2 rows -- this method needs the option list to ' +
        'supply the item universe (spec: "options are each a subset of a small bounded universe ' +
        'of named items"); it does not work stem-only.',
    };
  }

  const parsed = parseOptions(input.options);
  const emptyOptions = parsed.filter((p) => p.items.length === 0);
  if (emptyOptions.length > 0) {
    return {
      matches: false,
      reason: `${emptyOptions.length} of ${parsed.length} option(s) produced zero parsed items ` +
        `(letters: ${emptyOptions.map((p) => p.letter).join(', ')}) -- not a clean item-list shape.`,
    };
  }

  const uncleanOptions = parsed.filter((p) => !optionParsesCleanly(p.text, p.items));
  if (uncleanOptions.length > parsed.length * 0.25) {
    return {
      matches: false,
      reason: `${uncleanOptions.length} of ${parsed.length} options did not parse cleanly into an ` +
        `item list (>25% residue after comma/and/or splitting) -- option text does not read as a ` +
        'comma-separated set of named items.',
    };
  }

  const universe = buildUniverse(parsed);
  if (universe.length < MIN_UNIVERSE_SIZE || universe.length > MAX_UNIVERSE_SIZE) {
    return {
      matches: false,
      reason: `item universe size ${universe.length} (${universe.join(', ')}) is outside the ` +
        `bounded range [${MIN_UNIVERSE_SIZE}, ${MAX_UNIVERSE_SIZE}] this method targets (spec: ` +
        '"roughly 3-6 distinct items") -- refuses rather than force-fitting a different shape.',
    };
  }

  const multiItemOptions = parsed.filter((p) => p.items.length >= 2);
  if (multiItemOptions.length === 0) {
    return {
      matches: false,
      reason: 'every option names exactly one item -- this is a plain single-choice list, not a ' +
        'set-equivalence question over combinations of a shared item universe.',
    };
  }

  return {
    matches: true,
    reason: `${parsed.length} options parse into a bounded item universe of ${universe.length} ` +
      `(${universe.join(', ')}); ${multiItemOptions.length} option(s) are genuine multi-item ` +
      'combinations -- eligible for set-equivalence signature analysis and paraphrase-collision ' +
      'detection (HALF A), and for a taught-map membership lookup (HALF B) that abstains honestly ' +
      'when the map has no entry, never asking a local model to supply the missing fact.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// runUnguarded -- CODE decides everything. NEVER calls a model (see header comment for why that
// is correct for this shape, not an omission). NEVER reads input.correctAnswer.
//
// RENAMED FROM `run` BY THE 2026-09-05 QUARANTINE FENCE (see the QUARANTINE block above the
// HALF A helpers). THIS FUNCTION'S BODY IS UNCHANGED, BYTE-FOR-BYTE, FROM BEFORE THE FENCE -- the
// fence does not touch this method's logic, per explicit instruction. It is no longer registered
// as this method's `run` (see `run`, just below this function, and setEquivalenceMatchMethod at
// the bottom of this file); it is reachable only via __xo57TestHooks.runUnguarded, for
// measurement/inspection of what HALF A + the (empty, by-design) HALF B lookup would have
// produced, without going through the registered method's own fenced entry point.
// ─────────────────────────────────────────────────────────────────────────────────────────────

async function runUnguarded(input: MethodQuestionInput, ctx: MethodRunContext): Promise<LianaTerminalOutcome> {
  const question = input.question || '';
  const options = input.options || {};

  try {
    const parsed = parseOptions(options);
    const universe = buildUniverse(parsed);

    ctx.emit({
      kind: 'stage',
      text: `   set-equivalence-match: parsed ${parsed.length} options into an item universe of ` +
        `${universe.length}: {${universe.join(', ')}} (HALF A, code only, no model call)`,
      ts: nowIso(),
    });
    for (const p of parsed) {
      ctx.emit({
        kind: 'note',
        text: `   option ${p.letter}: "${p.text}" -> items [${p.items.join('; ')}] -> signature "${p.signature}"`,
        ts: nowIso(),
      });
    }

    // HALF A: paraphrase-collision detection. Always computed, always reported, per spec step 2
    // ("record both letters now, before deriving an answer, so the finding cannot be read as an
    // excuse after the fact").
    const collisions = findCollisions(parsed);
    if (collisions.length > 0) {
      for (const c of collisions) {
        ctx.emit({
          kind: 'fact',
          text: `   PARAPHRASE COLLISION: option(s) ${c.letters.join(', ')} share the identical ` +
            `signature "${c.signature}" -- these letters denote the SAME set in different words ` +
            '(e.g. an Oxford-comma difference); recorded now, before any membership judgment.',
          ts: nowIso(),
        });
      }
    } else {
      ctx.emit({
        kind: 'fact',
        text: '   no paraphrase collisions found: every option has a distinct item-set signature.',
        ts: nowIso(),
      });
    }

    // HALF B: per-item taught-map lookup. CODE ONLY -- see header comment. If the map has no
    // entry for an item, that item is UNKNOWN and the whole question is CANNOT DECIDE (spec step
    // 4b). This method never asks gemma to supply the missing fact, regardless of how confident a
    // free-text answer "sounds" -- HARDWIRE-22 forbids sending a classification to a local model,
    // and item-set membership from general knowledge is exactly that.
    const relationKey = normalizeRelationKey(question);
    // Typed with an explicit `| undefined` on the value so an indexed lookup for a key this table
    // does not have is not silently assumed present by TS's default (non-noUncheckedIndexedAccess)
    // indexing behavior -- this is the type-level expression of "an unmapped item is a real,
    // expected possibility, not an invariant violation."
    const table: Record<string, MembershipVerdict | undefined> = TAUGHT_ITEM_MEMBERSHIP_MAP[relationKey] ?? {};
    const lookups = universe.map((item) => ({ item, verdict: table[item] ?? ('UNKNOWN' as const) }));
    for (const l of lookups) {
      ctx.emit({
        kind: 'note',
        text: `   item "${l.item}": taught-map lookup (relation key "${relationKey.slice(0, 60)}${relationKey.length > 60 ? '...' : ''}") = ${l.verdict}`,
        ts: nowIso(),
      });
    }

    const unknownItems = lookups.filter((l) => l.verdict === 'UNKNOWN').map((l) => l.item);
    if (unknownItems.length > 0) {
      const collisionNote = collisions.length > 0
        ? `Paraphrase collision(s) found regardless, and reported above: ${collisions.map((c) => c.letters.join('/')).join(', ')}.`
        : 'No paraphrase collisions found among this option set.';
      return {
        question,
        verdict: null,
        abstain: true,
        freeText: false,
        method: 'set-equivalence-match',
        basis: `CANNOT DECIDE (spec step 4b): ${unknownItems.length}/${universe.length} item(s) in ` +
          `the universe (${unknownItems.join('; ')}) have no entry in the taught item-membership ` +
          'map for this question\'s relation key. Per the Founder\'s explicit BP213 order, this ' +
          'method NEVER asks a local model to supply an unmapped membership fact -- deciding ' +
          'whether an item belongs to the set is a CLASSIFICATION under HARDWIRE-22 ("THE CODE ' +
          'DECIDES. ALWAYS."), and no sourced taught map for this domain exists in this codebase ' +
          `today (verified by grep before this method was written). ${collisionNote} DECLARED ` +
          'PLATYPUS for the Didasko pile: this question\'s shape (set-equivalence over a bounded ' +
          'item universe) is correctly detected and its paraphrase-collision structure is fully ' +
          'analyzed, but deriving a final verdict needs a real, sourced item-membership map this ' +
          'dispatch does not have and will not fabricate. See D-BP213-XO-32_FOUR_METHOD_SPECS.md ' +
          'Method 2 falsifier #2, which predicted exactly this gap.',
      };
    }

    // Unreachable today (the map above is empty), kept for when a taught map is populated:
    // pure code, no model, exact set-equality lookup against the ALREADY-DECIDED derived set.
    const yesItems = lookups.filter((l) => l.verdict === 'YES').map((l) => l.item).sort();
    const derivedSignature = yesItems.join('|');
    const matchedLetters = parsed.filter((p) => p.signature === derivedSignature).map((p) => p.letter);

    if (matchedLetters.length === 0) {
      return {
        question,
        verdict: null,
        abstain: true,
        freeText: false,
        method: 'set-equivalence-match',
        basis: `NONE MATCH: derived set {${yesItems.join(', ')}} (signature "${derivedSignature}") ` +
          'from the fully-mapped taught table matches zero option rows. Stops here rather than ' +
          'falling back to any letter.',
      };
    }
    const collisionLetters = new Set(collisions.flatMap((c) => c.letters));
    if (matchedLetters.length > 1 || matchedLetters.some((l) => collisionLetters.has(l))) {
      return {
        question,
        verdict: null,
        abstain: true,
        freeText: false,
        method: 'set-equivalence-match',
        basis: `unscoreable: letter(s) ${matchedLetters.join(', ')} all match the derived set ` +
          `{${yesItems.join(', ')}}, and at least one is part of a paraphrase collision -- ` +
          'reporting all rather than arbitrarily choosing one (spec step 8).',
      };
    }

    return {
      question,
      verdict: matchedLetters[0],
      abstain: false,
      freeText: false,
      method: 'set-equivalence-match',
      basis: `derived set {${yesItems.join(', ')}} from a fully-mapped taught item-membership ` +
        `table (code lookup, never a model call) matched option ${matchedLetters[0]} exactly, ` +
        `with no paraphrase collision on the matched letter. Full item lookups: ` +
        `${lookups.map((l) => `${l.item}=${l.verdict}`).join('; ')}.`,
    };
  } catch (e) {
    return {
      question,
      verdict: null,
      abstain: true,
      freeText: false,
      method: 'set-equivalence-match',
      basis: `set-equivalence-match threw: ${String((e as Error)?.message ?? e)}`,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// run -- THE FENCED ENTRY POINT, added by the 2026-09-05 quarantine fence. THIS is what
// setEquivalenceMatchMethod.run points at (see the LianaMethod object, below) -- NOT
// runUnguarded, above. Every call FAILS LOUDLY: it emits a named 'error' event (so the refusal is
// visible in any transcript/log even though the caller also gets a thrown exception) and then
// throws SetEquivalenceMatchQuarantineError, unconditionally, regardless of input, regardless of
// whether TAUGHT_ITEM_MEMBERSHIP_MAP has ever been populated. See the QUARANTINE block above the
// HALF A helpers for the full measured reason this cites.
// ─────────────────────────────────────────────────────────────────────────────────────────────

async function run(_input: MethodQuestionInput, ctx: MethodRunContext): Promise<LianaTerminalOutcome> {
  ctx.emit({
    kind: 'error',
    text: `   QUARANTINED, REFUSING TO RUN: ${SET_EQUIVALENCE_MATCH_QUARANTINE_REASON}`,
    ts: nowIso(),
  });
  throw new SetEquivalenceMatchQuarantineError(SET_EQUIVALENCE_MATCH_QUARANTINE_REASON);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE LianaMethod OBJECT
// ─────────────────────────────────────────────────────────────────────────────────────────────

export const setEquivalenceMatchMethod: LianaMethod = {
  id: 'set-equivalence-match',
  demand: 'IDENTIFY',
  name: 'Set-Equivalence Match (QUARANTINED 2026-09-05 -- parses each option into a ' +
    'comma-separated item set and detects paraphrase-collision duplicate options via a ' +
    'canonical signature, but its run() now REFUSES rather than deriving a verdict, because ' +
    'shapeTest() never reads the question stem and 50 of its 273 measured matches would ' +
    'suppress the keyed correct answer if taught; see quarantineReason)',
  taughtBy: 'D-BP213-XO-32_FOUR_METHOD_SPECS.md METHOD 2 (Didasko Round 2, dataset question_id ' +
    '6418, internal estate qid 66, "grouping, an Oxford comma"), built per Founder standing order ' +
    '(BP213, "make more methods using didasko, into the liana cycle ... one leg at a time") and ' +
    'the explicit BP213 dispatch instruction that membership which cannot be decided by code or ' +
    'extracted literally must abstain rather than be sent to gemma as a classification ' +
    '(HARDWIRE-22, "THE CODE DECIDES. ALWAYS."). QUARANTINED 2026-09-05 by ' +
    'D-BP220-BM0-006/BISHOP-SEG per the measured shapeTest coverage sweep -- see ' +
    'quarantineReason for the full citation.',
  shapeDescription: 'a lettered MCQ question whose option rows are each a comma/and/or-separated ' +
    'subset of a small bounded universe of named items (roughly 3-6 distinct items across all ' +
    'options, at least one option naming 2+ items) -- refuses honestly on fewer than 2 options, ' +
    'options that do not parse cleanly into an item list, a universe outside the bounded range, ' +
    'or an all-single-item option set. shapeTest() itself is UNCHANGED and still fires on 273 of ' +
    '12,032 MMLU-Pro questions (measured) -- but that breadth is ACCIDENTAL (shapeTest never ' +
    'reads the question stem), so run() is now QUARANTINED and refuses to derive a verdict at ' +
    'all, rather than the honest CANNOT DECIDE abstain it produced before this fence. See ' +
    'quarantineReason, and the QUARANTINE block in this file\'s own source, for the measured ' +
    'numbers this refusal is based on.',
  shapeTest,
  run,
  /** Machine-readable quarantine flag -- see LianaMethod['quarantined'] (method_registry.ts) and
   *  the QUARANTINE block near the top of this file for what reading this true means. */
  quarantined: SET_EQUIVALENCE_MATCH_QUARANTINED,
  /** The full measured reason, verbatim -- see LianaMethod['quarantineReason'] (method_registry.ts). */
  quarantineReason: SET_EQUIVALENCE_MATCH_QUARANTINE_REASON,
};

// Registers at import time, same convention as every other method module. The registerMethod()
// call alone is NOT sufficient to make this method reachable -- liana_terminal_engine.ts's own
// side-effect import block must ALSO import this file (done in the same dispatch as a separate
// one-line edit to that file, added directly after the withheld_curve_shift_guard.ts import).
// Registering a QUARANTINED method is deliberate: method_registry.ts's selectMethod()/
// selectEligibleMethods() check `quarantined` and skip it during real selection (same dispatch),
// so registration only makes this method visible to listMethods()/explainSelection() (for
// transcript honesty -- "quarantined, not run" rather than silently vanishing) and to any direct
// caller of shapeTest(), never to the production fallthrough loop.
registerMethod(setEquivalenceMatchMethod);

// D-BP213-XO-57 TEST HOOKS, ADDITIVE ONLY, NO BEHAVIOR CHANGE TO shapeTest() OR THE HALF A
// PRIMITIVES. Exposes the real HALF A primitives so a standalone proof/vitest harness exercises
// the actual production parsing/signature code, never a reimplementation of it.
//
// `runUnguarded` added by the 2026-09-05 quarantine fence: the ORIGINAL run() body (byte-for-byte
// unchanged, HALF A report + HALF B empty-map abstain), kept reachable here ONLY for measurement/
// inspection of what it would have produced -- never wired to setEquivalenceMatchMethod.run,
// which is now the fenced `run` above.
export const __xo57TestHooks = {
  splitOptionIntoItems,
  canonicalItem,
  canonicalSignature,
  parseOptions,
  buildUniverse,
  findCollisions,
  normalizeRelationKey,
  runUnguarded,
};
