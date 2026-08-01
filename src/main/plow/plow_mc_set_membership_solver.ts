// plow_mc_set_membership_solver.ts -- deterministic "which of the following IS/IS NOT a member of
// a named canonical set" solver, an EIGHTH independent compute tier alongside computeUnitAwareMatch,
// computeAnswer+matchValueToOption, solveScheduleProblem, solveDensityProblem,
// solvePhysicsRelationProblem, solveAircraftLiftDragProblem, and solvePseudocodeTraceProblem (see
// plow_mc_answerer.ts's resolveDeterministicComputeOverride).
//
// WHY THIS EXISTS: run 029, question_id 98 --
//   "Which of the following world regions is NOT considered one of the world's most densely
//    populated regions?"
// answered G (Arctic Circle), correct A (South America), corroboration=single_perplexity,
// candidatesPostFurnace=0. This is a SET-MEMBERSHIP question -- there is no arithmetic, no formula,
// and no code to trace; the only honest way to answer it is to already KNOW the canonical
// enumerated set ("the world's most densely populated regions") and check each option against it.
// None of the seven prior tiers even attempt this question SHAPE, and a lone unverified authority
// vote has no business deciding a knowledge question like this at full confidence either (see
// plow_mc_answerer.ts's Task 3 single-source-no-grounding fix, same Yoke, a separate concern from
// this file).
//
// THE CENTRAL DISCIPLINE (never soften this under any circumstance): the named set MUST be
// established from a GROUNDED Fact eblet already present in the live substrate -- never from a
// search-result echo (a Perplexity/Google snippet), never from an authority's own reasoning text,
// and never invented/hardcoded by this module. If no grounded Fact eblet establishes the exact set
// the question asks about, this returns null -- an HONEST ABSTAIN, not a soft guess. This is the
// entire point of the solver: it does not know general-knowledge trivia any better than an LLM
// does; it only knows how to do exact set arithmetic once a curated fact makes the set explicit.
//
// As of this Yoke, vault_eblet_export.ts's own dry-run report shows ZERO Fact-typed eblets qualify
// for export from the Vault into the live substrate -- so on TODAY's real substrate this solver
// abstains on every real question, including run 029's own question_id 98. That is the CORRECT,
// honest behavior: there is no grounded fact for "the world's most densely populated regions" in
// the substrate today, so nothing should claim to know it either. See this Yoke's own proof script
// for a synthetic grounded fact demonstrating the mechanism resolves membership correctly once a
// real curated Fact eblet exists.
//
// Pure/synchronous, no I/O of its own -- `groundedFacts` is CALLER-SUPPLIED. The caller
// (plow_mc_answerer.ts) is the one place that reads the live substrate (via loadAllVerifiedEblets())
// and filters to genuinely Fact-typed entries; this module never touches the filesystem itself,
// matching every other solver's own "derives strictly from its arguments" discipline.
//
// Rule 66: version, never overwrite -- this is a new file, no supersede needed.

import type { McOption } from './compute_sidecar';

/** A single Fact eblet already present in the live substrate, exactly as read back by the caller.
 *  `title` is the eblet's own description/title (vault_eblet_export.ts's `fm.description` field,
 *  stored as VerifiedEbletEntry.question); `body` is its full text (VerifiedEbletEntry.answer). The
 *  caller is responsible for filtering to GENUINE Fact-typed, already-written substrate entries
 *  (provenance prefix `vault_export:fact:`, per vault_eblet_export.ts's buildExportRecord) -- this
 *  module trusts nothing about WHERE a GroundedFactEblet came from beyond its own two fields, so an
 *  honest caller filter is load-bearing for the "never from a search-result echo" guarantee
 *  documented above. */
export interface GroundedFactEblet {
  title: string;
  body: string;
}

export interface SetMembershipSolverResult {
  letter: string;
  /** JSON-stringified {status, entity} -- the matched option's resolved membership status
   *  ('member' | 'non_member') and its own option text. Directly comparable to `optionValue`
   *  (the asked polarity), mirroring the computed-value-vs-option-value distinction every other
   *  tier in this repo surfaces (kept as JSON, not a bare number, since this solver's "value" is a
   *  membership verdict, not a scalar). */
  value: string;
  /** The polarity actually asked for ('member' | 'non_member') -- what the matched option's status
   *  above was required to equal for this to accept. Equal to `value`'s status by construction
   *  (that equality is exactly what "matched" means here). */
  optionValue: string;
  provenance: string;
  trace: string;
}

// --- GATE 1: the question must ask membership/non-membership against a named set -----------------
//
// Pattern: "which of the following [<TYPE>] is [NOT] [considered] (a member of|one of|included in|
// part of) <SET_DESCRIPTION>[?]" -- a deliberately narrow connector list, matched case-insensitively.
// Named capture groups: `neg` (the optional "not", i.e. the polarity) and `setDesc` (the raw tail
// text naming the set -- still containing filler words like "one of the"/"the", stripped by
// normalizeSetDescriptor() below, never assumed here).
const ASK_RE =
  /\bwhich of the following\b[\s\S]*?\bis\s+(?<neg>not\s+)?(?:considered\s+)?(?:a member of|one of|included in|part of)\b\s*(?<setDesc>[\s\S]+?)\s*\??\s*$/i;

// --- Normalization helpers -------------------------------------------------------------------------

/** Strips leading connector/filler phrases from a set descriptor, repeatedly, so
 *  "one of the world's most densely populated regions" and "the world's most densely populated
 *  regions" and "world's most densely populated regions" all normalize to the SAME key. Never
 *  strips anything from the middle or end of the string -- purely a leading-phrase peel, applied
 *  until no further filler phrase matches (a descriptor with no leading filler is left unaffected
 *  after the loop exits on its first no-match pass). */
const LEADING_FILLER_PHRASES = [
  'one of the', 'one of', 'a member of the', 'a member of',
  'included in the', 'included in', 'part of the', 'part of',
  'the', 'a', 'an',
];

function stripLeadingFiller(input: string): string {
  let out = input.trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const phrase of LEADING_FILLER_PHRASES) {
      const re = new RegExp('^' + phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+', 'i');
      if (re.test(out)) {
        out = out.replace(re, '');
        changed = true;
        break; // restart the phrase list against the newly-shortened string
      }
    }
  }
  return out;
}

/** Lowercase, drop apostrophes (so "world's" / "worlds" collapse to the same key), collapse every
 *  remaining non-alphanumeric run to a single space, trim. Used identically on both the question's
 *  own extracted set descriptor and every candidate Fact eblet's title, so the two are compared on
 *  the exact same normalized key -- never a looser comparison on one side than the other. */
function normalizeKey(input: string): string {
  return input
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeSetDescriptor(rawTail: string): string {
  return normalizeKey(stripLeadingFiller(rawTail));
}

/** Same normalization used for comparing an MC option's text against a Fact eblet's own member
 *  list entries -- deliberately the SAME function as normalizeKey (not a separate, looser
 *  comparison), so two entities are only ever treated as equal when they are equal after the exact
 *  same canonicalization, never a fuzzier one. */
const normalizeEntity = normalizeKey;

// --- GATE 2: the set must be established by a GROUNDED Fact eblet already in the live substrate ---
//
// Exact-match ONLY (after normalizeSetDescriptor -- stripLeadingFiller THEN normalizeKey -- applied
// IDENTICALLY to both sides) -- deliberately NOT a fuzzy/substring/embedding match. A human curator
// naturally titles a Fact eblet "The World's Most Densely Populated Regions" (with a leading
// article), while the question's own extracted tail is "the world's most densely populated
// regions" (same leading article, different casing) -- both sides MUST run through the same
// leading-filler peel before comparison, or a plainly-identical set description would spuriously
// fail to match solely because one side kept its leading "the"/"a"/"one of the" and the other did
// not. This is symmetry, not softening: the comparison is still a full, exact string-equality check
// on the normalized key -- it does not become fuzzy, substring, or partial in any way, and a Fact
// eblet titled after a genuinely DIFFERENT set still cannot match. Widening this to a fuzzy/partial
// match would risk pairing the question with a Fact eblet that merely LOOKS similar (a different,
// wrong set) -- see this file's header: "never soften this gate under any circumstance." No match
// among `groundedFacts` is an honest null.
function findGroundedSetFact(setDescriptorKey: string, groundedFacts: GroundedFactEblet[]): GroundedFactEblet | null {
  for (const fact of groundedFacts) {
    if (normalizeSetDescriptor(fact.title) === setDescriptorKey) return fact;
  }
  return null;
}

// --- Member-list extraction from a Fact eblet's body -----------------------------------------------
//
// Only ever reads an explicit bulleted/numbered list ("- Foo", "* Foo", "1. Foo", "2) Foo") out of
// the eblet's own body text -- never free-text prose scanning, which could silently misread which
// nouns are members vs. incidental mentions. A Fact eblet with no such list does not establish an
// ENUMERABLE set as far as this solver is concerned -- honest null, the same "when in doubt,
// exclude" convention vault_eblet_export.ts's own class gate already uses.
function extractMemberList(body: string): string[] {
  const members: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    const m = /^\s*(?:[-*\u2022]|\d+[.)])\s+(.+?)\s*$/.exec(line);
    if (!m || !m[1]) continue;
    const cleaned = m[1].replace(/[*_`]/g, '').trim();
    if (cleaned.length > 0) members.push(cleaned);
  }
  return members;
}

// --- GATE 3: every MC option must resolve to a set-comparable entity ------------------------------
//
// "Resolves" means: the option's text, once trimmed, is non-empty AND looks like a plain named
// entity (letters/digits/spaces/hyphens/apostrophes/basic punctuation only -- no stray fragment
// this module cannot confidently treat as a single noun phrase). Membership itself then follows
// DEFINITIONALLY from the Fact eblet's own enumerated list: exact-normalized-match against a member
// -> 'member'; a resolved entity absent from the list -> 'non_member' (sound ONLY because the Fact
// eblet's list is being treated as the CLOSED, authoritative enumeration the question is asking
// about -- exactly what "grounded" means here). An option whose text does not even resolve to a
// plausible entity aborts the WHOLE question -- the same "one unresolved option kills the whole
// attempt, no partial credit" discipline plow_mc_aircraft_solver.ts and
// plow_mc_pseudocode_trace_solver.ts both already use for their own per-option parses.
const ENTITY_SHAPE_RE = /^[A-Za-z0-9][A-Za-z0-9\s\-'.,()]*$/;

type MembershipStatus = 'member' | 'non_member';

function resolveOptionMembership(optionText: string, memberKeys: Set<string>): MembershipStatus | null {
  const trimmed = optionText.trim();
  if (trimmed.length === 0) return null;
  if (!ENTITY_SHAPE_RE.test(trimmed)) return null;
  const key = normalizeEntity(trimmed);
  if (key.length === 0) return null;
  return memberKeys.has(key) ? 'member' : 'non_member';
}

/** Top-level entry point. Pure, synchronous, no I/O of its own (see this file's header for why
 *  `groundedFacts` is caller-supplied rather than read here). Returns null (never guesses) the
 *  moment any required piece is not confidently present:
 *    (1) the question does not match the membership/non-membership ASK_RE shape at all;
 *    (2) no GROUNDED Fact eblet in `groundedFacts` establishes the exact named set (normalized
 *        exact-title-match) -- THE central abstain, never softened;
 *    (3) that Fact eblet's own body does not contain an explicit bulleted/numbered member list;
 *    (4) any single MC option fails to resolve to a set-comparable entity -- aborts the WHOLE
 *        question, no partial credit;
 *    (5) the resolved options do not satisfy the asked polarity in EXACTLY ONE case (zero or 2+
 *        qualifying options is an honest null).
 *  Derives strictly from `questionText` + `options` + the caller-supplied `groundedFacts` -- never
 *  from an authority's/model's reasoning text, and never invents a set of its own. */
export function solveSetMembershipProblem(
  questionText: string,
  options: McOption[],
  groundedFacts: GroundedFactEblet[],
): SetMembershipSolverResult | null {
  const askMatch = ASK_RE.exec(questionText);
  if (!askMatch || !askMatch.groups) return null;
  const rawSetDesc = askMatch.groups['setDesc'];
  if (!rawSetDesc) return null;

  // Explicit NOT-polarity handling, in its own if/else -- a solver that silently inverts the
  // polarity is worse than one that abstains. isNotPolarity is derived ONLY from the presence of
  // the `neg` capture group; there is no second, implicit path anywhere else in this function that
  // could re-derive or override this value.
  const isNotPolarity: boolean = !!askMatch.groups['neg'];
  let desiredStatus: MembershipStatus;
  if (isNotPolarity) {
    desiredStatus = 'non_member';
  } else {
    desiredStatus = 'member';
  }

  if (options.length === 0) return null;

  const setDescriptorKey = normalizeSetDescriptor(rawSetDesc);
  if (setDescriptorKey.length === 0) return null;

  // GATE 2 -- THE central abstain. Never widen this to a fuzzy/partial match.
  const groundedFact = findGroundedSetFact(setDescriptorKey, groundedFacts);
  if (!groundedFact) return null;

  const memberList = extractMemberList(groundedFact.body);
  if (memberList.length === 0) return null;
  const memberKeys = new Set(memberList.map((m) => normalizeEntity(m)));

  // GATE 3 -- every option must resolve, else abort the whole question.
  const resolved: Array<{ letter: string; status: MembershipStatus; text: string }> = [];
  for (const opt of options) {
    const status = resolveOptionMembership(opt.text, memberKeys);
    if (!status) return null; // one unresolved option kills the whole attempt, no partial credit
    resolved.push({ letter: opt.letter, status, text: opt.text });
  }

  // GATE 4 -- exactly one option may satisfy the asked polarity.
  const qualifying = resolved.filter((r) => r.status === desiredStatus);
  if (qualifying.length !== 1) return null;
  const matched = qualifying[0] as { letter: string; status: MembershipStatus; text: string };

  const trace =
    `set_membership: set="${groundedFact.title}" polarity=${isNotPolarity ? 'NOT' : 'IS'} ` +
    `members=${JSON.stringify(memberList)} ` +
    `resolvedOptions=[${resolved.map((r) => `${r.letter}:${r.status}`).join(', ')}] ` +
    `matchedOption=${matched.letter}(${matched.status})`;

  return {
    letter: matched.letter,
    value: JSON.stringify({ status: matched.status, entity: matched.text }),
    optionValue: desiredStatus,
    provenance: 'deterministic_compute:set_membership',
    trace,
  };
}
