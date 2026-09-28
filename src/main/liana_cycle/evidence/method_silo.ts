// method_silo.ts -- D-BP164-M0-122/BISHOP-SEG-SILO/M0
//
// THE DATA SILO OF EBLETS. NOT A NEW STORE. Per three successive Founder corrections relayed by
// BISHOP-M0 during this ticket:
//   1. "the silos are part of the entire eblet package store - just organized into data silos
//      based on topic and category and therefore tag."
//   2. "Indeed Silos are DATA - facts, and methods, and algorithms, never answers. Though we do
//      need to record every time a query is run - we decided on different types of eblets a
//      while ago, use those types."
//   3. "We are in fact, populating the silos for those that we will choose what subset to
//      include, by hex connector, to, for people to use as the facts basis of any MMLU-Pro test
//      they run. Not answers. Facts. Data. Methods. etc."
//
// So this file is a TAG-KEYED VIEW over the estate's real, live, already-indexed eblet package
// store at HARDWIRE\LEDGER\EBLETS\ (confirmed on disk this ticket: D-BP146-*.eblet.md,
// TODO\*.eblet.md, DENOTATIONS\*.eblet.md -- the last is a real precedent for a machine-minted,
// Rule-66-versioned, frontmatter+embedded-JSON+markdown eblet, written by
// "D-BP158-M3-005 denotation cache"). mnem_eblet_store.ts's estateDoctrineRoots() already walks
// `HARDWIRE` recursively and indexes every *.eblet.md under it (KN-BP147-M2) -- so a file written
// here is REAL, PERSISTENT, and QUERYABLE by the existing substrate, with zero new index and zero
// second source of truth. This file adds ONLY: a write helper that mints a correctly-shaped
// eblet into the right tag-subfolder, a cheap two-step CONNECTOR read (mint/fetch, the SAME shape
// connector_celpane.ts already proved) that resolves BY TAG rather than by prior-acquisition
// match, a whole-silo summary for BISHOP-M3's Prove It surface, and a mechanical answer-leakage
// auditor.
//
// THE TAG IS `LianaDemand` (demand_test.ts), NOT AN INVENTED STRING. "topic and category and
// therefore tag" already has a real, ratified taxonomy in this codebase for exactly this purpose:
// RANK / DEFINE / IDENTIFY / CLASSIFY / INFER / LOCATE-IN-FRAMEWORK / COMPUTE -- "the six demand
// types read off the BP150 benchmark corpus, plus a seventh added at BP164" (demand_test.ts's own
// header). A silo folder per demand kind is therefore a silo per QUESTION SHAPE, which is exactly
// what canon_the_liana_cycle_is_a_method_registry_taught_by_humans_bp149 describes accumulating:
// "Coverage grows by accumulation ... Each entry is a way of answering a SHAPE of question."
//
// THE ESTABLISHED ELBET TYPE. canon_eblet_taxonomy_tool_fact_wholeanswer_component_rgbyo_
// revisable_context_scoped_bp140.eblet.md (Founder-defined BP140, read this ticket) names four
// eblet KINDS: Tool eblets (Reasoning/Methodology/Formula sub-kinds), Fact eblets, Whole-Answer
// eblets (answer keys, GATED OFF during scoring), Component eblets. What this file deposits is a
// METHODOLOGY eblet -- "a multi-step procedure/route" mapping a demand SHAPE to the registered
// method that resolves it -- never a Whole-Answer eblet. `metadata.type: 'methodology'` is used
// literally below; THIS EXACT YAML STRING WAS NOT FOUND INSTANTIATED ON A LIVE FILE ON DISK
// during this ticket's search (the CANON folder's own top-level `type:` values measured this
// ticket were canon/reference/feedback/project/statute/HARD_CANON_*/founders_anecdote/
// canon_amendment -- no literal "methodology"/"tool"/"fact" instance was found). It is a
// REASONED PROPOSAL applying BP140's own §1 vocabulary verbatim, not a confirmed-on-disk value --
// flagged NOT-VERIFIED in this ticket's return, per BISHOP-M0's own instruction ("if you cannot
// find a definitive type ... propose one with reasoning, do not silently coin a type and let it
// look established").
//
// THE HEX CONNECTOR FIELD. Confirmed REAL and REQUIRED by direct read of a live file this ticket
// (canon_chocolates_candies_package_store_family_and_laws_of_mnemosynec_search_bp164.eblet.md):
// top-level `hex_connector:` + `hex_connector_justification:` fields, one of the twelve MEMORY.md
// keyhole connectors (RULES/STATE/DISCIPLINES/INITIATIVES/ARC/QUEUE/SHELL/TOTEMS/CANONS/HARDWIRE/
// PROOF/SECURITY). Every deposit below REQUIRES one -- see MethodSiloDepositInput.hexConnector.
// This is the field the Founder names as the SELECTOR for shipping a subset to a third party as
// an MMLU-Pro facts basis ("we select what subset to include, by hex connector").
//
// THE NO-ANSWER GUARANTEE IS STRUCTURAL FIRST, MECHANICAL SECOND. Structural: MethodSiloDepositInput
// below has NO field capable of carrying a verdict, a correct answer, or a specific question's
// resolution -- `whatItDoes` describes the METHOD (what kind of question it answers and how),
// `taughtBy` cites WHO taught it and WHERE (a canon slug, a qid used only to point at the teaching
// case, never at a value derived from it), never "the answer to qid N is X." Mechanical, second
// line of defense: depositMethodologyEblet(), depositRejectionEblet(), and
// auditSiloForAnswerLeakage() all scan every free-text field through the SAME scanForAnswerLeakage()
// -- see ANSWER_LEAK_PATTERNS below -- and refuse/flag on a hit. This is a heuristic regex scan,
// NOT a proof of absence -- documented as such, not oversold.
//
// D-BP165-M0-010, FOUNDER ORDER ("Fix this now"): BISHOP-M0's own finding, and D-BP165-M0-007's
// own measured proof (this file's REJECTION-AS-TRAINING-SIGNAL section below), was that the guard
// above is PHRASE-shaped -- it catches "the correct answer is 52500" but NOT "250000 * 0.2" and
// NOT "the reserves come to 50000" -- because the threat is VALUE-shaped, not phrase-shaped. A
// second guard, VALUE_SHAPED_LEAK_PATTERNS (defined beside scanForAnswerLeakage, below), was added
// to close that gap and folded INTO scanForAnswerLeakage itself so every existing caller inherits
// it with no call-site edit -- per the Founder's same-message ruling, "when you build it, you wire
// it. Always." depositMethodologyEblet() in particular had NO structural/value guard at all before
// this dispatch (only depositRejectionEblet() had one, and only for a bare first line, and only
// while gated OFF by env flag) -- an unguarded live write path, a bigger finding than a weak one.
// It is guarded now, via this same shared function, with no changes to its own call site required.
//
// A SEPARATE ARTIFACT CLASS RECORDS EVERY QUERY RUN (Founder's second correction). That is
// method_query_receipt_store.ts, sitting beside this file's sibling `library/` folder, reusing
// purpose_receipt_store.ts's own already-ratified sand-stratum JSONL shape verbatim. This file
// (method_silo.ts) NEVER writes a receipt of an individual query; it only writes durable
// methodology facts, and reads them back.

import {
  existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { contentAddress } from './evidence_store';
import { estimateTokens, CELPANE_MAX_TOKENS } from './connector_celpane';
import type { LianaDemand } from '../demand_test';
// D-BP165-M0-007: the rejection-classification vocabulary a rejection deposit's `rejectionClass`
// field is meant to carry -- type-only import, the STRING VALUES it names are what actually flow
// through (see RejectionDepositInput below), never a runtime dependency on compute_sidecar.ts's
// own logic. RAW_MODEL_OUTPUT_CAP_CHARS is the SAME 2000-char cap compute_sidecar.ts's own
// capRawModelOutput() applies -- reused here as a second, defensive cap (this file re-caps even
// though every real caller is expected to have already capped) rather than a diverging number.
import { RAW_MODEL_OUTPUT_CAP_CHARS, type ModelExpressionRejectionClass } from '../../plow/compute_sidecar';

/** The estate's twelve MEMORY.md keyhole connectors, confirmed current this session (MEMORY.md's
 *  own connector table, read fresh at dispatch start). BISHOP-M0's own order: "confirm the
 *  current list rather than trusting this one" -- this IS that confirmation, not an assumption. */
export type HexConnector =
  | 'RULES' | 'STATE' | 'DISCIPLINES' | 'INITIATIVES' | 'ARC' | 'QUEUE'
  | 'SHELL' | 'TOTEMS' | 'CANONS' | 'HARDWIRE' | 'PROOF' | 'SECURITY';

/** Default root: the REAL, existing eblet ledger, a sibling of DENOTATIONS/ and TODO/ under the
 *  same directory this ticket confirmed on disk. Override via env for test isolation, same
 *  pattern as evidence_store.ts's LB_EVIDENCE_DIR. */
export function resolveMethodSiloDir(): string {
  return process.env.LB_METHOD_SILO_DIR
    || 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\HARDWIRE\\LEDGER\\EBLETS\\METHOD_SILO';
}

/** Heuristic, documented as such (see file header). Refuses/flags on the shape of an ANSWER
 *  statement, not on any specific word alone (so "the answer is a value derived by computation"
 *  -- demand_test.ts's own COMPUTE description -- does not false-positive on "answer" alone). */
const ANSWER_LEAK_PATTERNS: RegExp[] = [
  /\bthe correct answer (is|to (this|qid)\s*\d+\s*is)\b/i,
  /\banswer (to (this )?question|key) (is|:)\s*[^.]{1,80}/i,
  /\bcorrectanswer\s*[:=]/i,
  /\bverdict\s*[:=]\s*['"a-z0-9]/i,
  /\bqid\s*\d+\s*(is|=|:)\s*(option\s*)?[a-eA-E]\b/,
];

// ── D-BP165-M0-010: THE VALUE-SHAPED GUARD ──────────────────────────────────────────────────────
// FOUNDER ORDER, BP165, VERBATIM: "Fix this now," plus "New rule: when you build it, you wire it.
// Always." MEASURED THIS DISPATCH (reproduced from D-BP165-M0-007's own finding before any code
// below was touched, per LAW 2): ANSWER_LEAK_PATTERNS above is PHRASE-shaped -- it matches the
// WORDS an answer statement uses ("the correct answer is", "verdict:"). The measured threat is
// VALUE-shaped: a number that simply EQUALS or EVALUATES TO the answer, with no phrase around it
// at all -- a bare arithmetic expression ("250000 * 0.2", exactly compute_sidecar.ts's own demand-
// COMPUTE shape), or that same value sitting in ordinary prose ("the reserves come to 50000").
// A phrase matcher is structurally blind to both.
//
// THE FOUR PATTERNS BELOW run over a WORKING COPY of each scanned field with
// SAFE_NUMERIC_IDENTIFIER_PATTERNS stripped out first -- so a legitimate citation (a BP session
// number, a dispatch id, an explicit "qid N" teaching-case citation -- all three used by this
// file's OWN real deposit, method_silo.demo.test.ts's "taught by ... qid 85 walkthrough" -- or an
// ISO 8601 timestamp) does not itself trip a guard built to catch VALUES, not identifiers. The
// carve-out list is narrow and ENUMERATED (LAW 1): four patterns, named here, none inferred.
//
// PER THE FOUNDER'S OWN ORDER FOR THIS ONE COMPONENT ("a false positive costs a discarded
// training deposit. A false negative costs the campaign. THOSE ARE NOT COMPARABLE. REFUSE."), the
// four VALUE_SHAPED_LEAK_PATTERNS below are deliberately broad: ANY two-operand arithmetic/
// equation shape at any digit count, ANY decimal number, ANY bare integer of two or more digits
// anywhere in the field (not just a whole bare line), and a LaTeX \frac. This is still a
// heuristic, not a proof -- see this file's own header. What it PROVABLY still does not catch is
// documented at each call site and in this dispatch's return: a single-digit-only arithmetic
// expression embedded in prose (e.g. "4*3" or the fraction "3/4"), and any answer value expressed
// in a form that contains no digit at all (a spelled-out number, a non-numeric option letter not
// already covered by ANSWER_LEAK_PATTERNS, a domain-specific symbol).
// D-BP221-BM0-051, off D-BP221-BM04-032's own measurement: the dispatch-id carve-out below used
// to be /d-bp\d+-m\d+-\d+/gi, which requires the seat segment to be the literal shape "m" + digits
// (matches "M0", "M2", "M3", "M4" -- the machine-slot tokens) and NOTHING ELSE. Any Bishop GLOVE
// seat citing its own dispatch id in provenance -- BM0, BM01..BM09, S3, XO1947, every id this
// estate's own seat_channel.js SEATS roster and glove_roster.js GLOVES roster already know about --
// does not match "m\d+" and fell through uncaught into VALUE_SHAPED_LEAK_PATTERNS below, where it
// was scanned as a bare multi-digit integer and REFUSED. Proven live: D-BP221-BM04-031 deposited
// 1 of 18 methods; the other 17 cited a `BM04`-style id in their own provenance and were refused
// for doing the right thing. This is the same disease named four times in one BP221 night
// (seat_channel.js's stale hand-listed refusal text, its hand-typed refSeatToken alternation,
// controls.py's release-all acceptor) and the same cure applies: STOP ENUMERATING SEAT NAMES.
//
// Founder's own standing ruling on this exact shape (BP213, "a node is a SLOT holding a pointer to
// its identity. CODE READS SLOTS. CODE NEVER READS 'M2'.", sixteen-machines test: if a fix would
// need re-editing when a new seat or machine named Y0..Y14 shows up, it is not the fix): the
// enumeration was wrong because it hardcoded ONE seat family's token shape ("m" + digits) instead
// of the general dispatch-id SHAPE every seat and machine slot in this estate already uses --
// D-BP<session>-<SEAT-OR-SLOT-TOKEN>[-<hand/session-token>]-<sequence>. The pattern below is
// derived from that SHAPE, not from a list of names, so BM0-BM09, S3, M0/M2/M4, a future Y0-Y14,
// or any other letter-led token this estate ever mints matches with zero code changes. A
// cross-package require() of glove_roster.js from this mnemosyne package was deliberately NOT
// used here -- that would trade one hardcode for a fragile build-time dependency on a sibling
// repo's file layout, and the roster only enumerates Bishop GLOVES, not the M0/M2/M4 machine-slot
// tokens this same carve-out must also keep matching. Shape generalizes over both namespaces at
// once; a roster lookup would not.
//
// WHY THIS DOES NOT WIDEN WHAT THE GUARD ACTUALLY CATCHES (this file's own header: the guard
// exists to stop a benchmark ANSWER VALUE -- a number that equals or evaluates to the correct
// answer -- from being scanned as if it were safe, per the Founder's own "a false positive costs a
// discarded training deposit, a false negative costs the campaign" order). MEASURED, NOT ASSUMED
// (D-BP221-BM0-051's own bench, see scratchpad verify_regex.js/verify_regex2.js): a STRICTER draft
// was tried first, requiring the seat/slot token itself to contain a digit (closing a contrived
// "d-bp1-abc-52500-1" smuggle where a bare word poses as the token) -- and REJECTED on measurement,
// because four of the seventeen refused methods (withheld_curve_shift_guard.ts, set_equivalence_
// match.ts, umbrella_or_school_check.ts, convention_locked_recompute.ts) cite their own real
// provenance as "D-BP213-XO-41", "D-BP213-XO-32_FOUR_METHOD_SPECS.md", etc -- a bare ROLE token
// ("XO", no digit) is a real, heavily-used citation shape in this estate (glove_roster.js: BM0's
// role IS "XO"), not a hypothetical. The stricter draft would have REFUSED those real citations
// while trying to catch a smuggle shape ("d-bp<n>-<word>-<value>") that does not match this guard's
// own documented threat model (accidental leakage of a computed value in ORDINARY PROSE, e.g. "the
// reserves come to 50000" -- nobody accidentally types a literal "d-bp<n>-" prefix by coincidence).
// So the final pattern below only requires each segment to START WITH A LETTER -- matching M0, M2,
// M3, M4, BM0..BM09, S3, XO, XO1947, and any future Y0..Y14 token, by shape, never by name.
//
// ONE RESIDUAL PROPERTY, CARRIED OVER UNCHANGED FROM THE ORIGINAL PATTERN, NOT INTRODUCED BY THIS
// WIDENING: the final sequence number, `-\d+` at the very end, was already unbounded digits before
// this dispatch (the OLD pattern already stripped whatever number directly followed "m0-" with no
// magnitude check, e.g. it would already have stripped "d-bp1-m0-52500" clean for an M0 citation).
// Widening the seat-token vocabulary by shape means every seat now shares that SAME pre-existing,
// Founder-shipped property symmetrically -- it is not made any looser than it already was for M0.
// D-BP223-BM0-X009-005-SCOPE, Founder ruling 2026-09-09 15:26 Central (k/cfb481de), verbatim:
// "SCOPE -- narrow the \d{2,} rule (my recommendation; a method that says '1990s' is not a leak)".
// MEASURED THIS DISPATCH (D-BP223-BM0-X009-002-ASK3's own reconstruction against the real function):
// three of `didasko_flagship_ask.js`'s own fixed, tool-authored `taughtBy` boilerplate sentences --
// never anything Gemini said -- tripped the value-shaped guard on every single deposit, unconditionally:
//   1. "stages 2-3" (a stage RANGE, meaning "stages 2 through 3") read by the arithmetic pattern as
//      the subtraction "2 minus 3".
//   2. "gemini-3.1-pro-preview" (the model's OWN version number, written into every deposit's
//      provenance line) read by the decimal pattern as a leaked decimal value.
//   3. "k/265a9815" (a conduit citation of a Founder ruling hash) read by the bare-2-digit-integer
//      pattern as a leaked integer, because no safe-identifier carve-out covered this citation shape.
// Same discipline as the four patterns already above: each new carve-out is SHAPE-derived, narrow,
// and named here, never a blanket loosening of VALUE_SHAPED_LEAK_PATTERNS itself (that array, and
// the arithmetic/decimal/bare-integer/LaTeX rules it runs, are UNCHANGED by this dispatch -- a real
// leak of any of those four shapes is still caught the instant it falls outside all eight carve-outs
// below). Proof both ways -- the three false positives clearing AND a real leak still refused -- is
// in this dispatch's own return, D-BP223-BM0-X009-005-SCOPE_REPORT.md.
const SAFE_NUMERIC_IDENTIFIER_PATTERNS: RegExp[] = [
  /d-bp\d+-[a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*-\d+/gi, // dispatch id, ANY seat/slot token by SHAPE (letter-led), e.g. D-BP165-M0-007, D-BP221-BM04-031, D-BP221-BM0-h2cbpib4-051, D-BP214-XO1947-012, D-BP213-XO-41 -- never an enumerated seat list, see D-BP221-BM0-051 comment above
  /(?<!\d)bp\d+(?!\d)/gi, // bare BP session number, e.g. BP149, bp165, or embedded as ..._bp149
  /qid\s*:?\s*#?\d+(?!\d)/gi, // qid citation, prose ("qid 85") or frontmatter ("qid: 85") -- permitted, see field docs
  /\d{4}-\d{2}-\d{2}t[\d:.]+z/gi, // ISO 8601 timestamp
  // D-BP223-BM0-X009-005-SCOPE, carve-out 5: a conduit citation of a Founder ruling, shape
  // "k/<hex>" (this estate's own established citation gadget signature, e.g. "k/265a9815"). Requires
  // the literal "k/" prefix plus 6+ lowercase-hex characters -- a real answer value has no reason to
  // ever be written in this exact shape, so this cannot swallow a genuine leak by coincidence.
  /\bk\/[0-9a-f]{6,}\b/gi,
  // D-BP223-BM0-X009-005-SCOPE, carve-out 6: a versioned software/model identifier, shape
  // "word-N.N(.N)-word" (e.g. "gemini-3.1-pro-preview", "claude-3.5-sonnet"). Requires a letter-led
  // token, a hyphen-attached decimal version number, AND a trailing letter-led qualifier segment --
  // three structural requirements together, none of which an ordinary bare decimal answer value
  // ("0.2", "52500.75") satisfies, so this narrows the decimal rule's blind spot on model names
  // without narrowing what it catches in ordinary prose.
  /\b[a-z][a-z0-9]*(?:-[a-z0-9]+)*-\d+(?:\.\d+)+-[a-z][a-z0-9-]*\b/gi,
  // D-BP223-BM0-X009-005-SCOPE, carve-out 7: a stage/step/part/etc. RANGE citation, shape
  // "<range-noun> N-M" (e.g. "stages 2-3", "steps 4-5"). Requires one of a small enumerated set of
  // range nouns immediately before a tight digit-hyphen-digit pair -- narrower than loosening the
  // arithmetic pattern's hyphen handling in general, which would also blind it to a real subtraction
  // leak ("the reserves come to 52-30" has no range noun and is still caught).
  /\b(?:stages?|steps?|parts?|sections?|phases?|rounds?)\s+\d{1,3}\s*-\s*\d{1,3}\b/gi,
  // D-BP223-BM0-X009-005-SCOPE, carve-out 8: a bare decade shorthand, Founder's own named example
  // ("1990s" is not a leak) -- shape "<digits ending in 0>s" as a whole word, e.g. "90s", "1990s",
  // "2020s". Requires the literal trailing "s" immediately after a digit run ending in zero; a real
  // answer value coincidentally ending in "0s" with no space is not a shape this campaign's own
  // corpus produces, and the pre-existing bare-2+-digit rule still catches every other multi-digit
  // number (e.g. "1990" alone, with no trailing "s", is unaffected and still flagged).
  /\b\d{1,3}0s\b/gi,
  // D-BP223-BM0-X009-005-SCOPE, carve-out 9: measured live against the real qid 557/1037/1038
  // deposits during this dispatch's own acceptance test, AFTER carve-outs 5-8 above already
  // applied -- a BARE seat/machine-slot token citation with no "D-BP<n>-" dispatch-id prefix at
  // all, e.g. "S3 concurrence Y005/BM04" in didasko_flagship_ask.js's own taughtBy boilerplate.
  // This is the SAME seat-token vocabulary the dispatch-id carve-out above already generalizes
  // over by SHAPE (BM0-BM09, S3, M0/M2/M3/M4, XO, XO1947, Y0-Y14, per this file's own extensive
  // D-BP221-BM0-051 comment on that pattern) -- it was simply never given a carve-out for the case
  // where a seat cites ANOTHER seat bare, outside a "D-BP...-<seat>-<n>" dispatch id shape. Same
  // discipline as that comment's own ruling: SHAPE, never an enumerated name list. Requires 1-3
  // UPPERCASE letters immediately followed by 1-4 digits with no separator -- a real leaked answer
  // value has no reason to be glued directly onto 1-3 uppercase letters with zero characters
  // between them, so this cannot swallow a genuine leak by coincidence; kept uppercase-only
  // (no /i flag) so it does not widen to match ordinary lowercase prose.
  /\b[A-Z]{1,3}\d{1,4}\b/g,
];

const VALUE_SHAPED_LEAK_PATTERNS: RegExp[] = [
  /\d+\s*[+\-*/^%=]\s*\d+/, // arithmetic/equation shape, any digit count: "250000 * 0.2", "x=5", "3/4"
  /\d*\.\d+/, // decimal number, any digit count: "0.2", "3.14"
  /\d{2,}/, // bare multi-digit integer anywhere in prose: "52500", "50000"
  /\\frac\s*\{[^}]*\}\s*\{[^}]*\}/i, // LaTeX fraction
];

function stripSafeNumericIdentifiers(text: string): string {
  let out = text;
  for (const re of SAFE_NUMERIC_IDENTIFIER_PATTERNS) out = out.replace(re, '');
  return out;
}

// ── D-BP165-M0-025: THE NAMED-CONSTANTS CHANNEL ─────────────────────────────────────────────────
// FOUNDER'S OWN COLLISION, NAMED VERBATIM IN THIS DISPATCH'S BRIEF: "A LEGITIMATE METHOD OFTEN
// CONTAINS NUMBERS: g = 9.81 m/s^2, a 360-day year, a^2 + b^2 = c^2. SO THE GUARD WILL LIKELY
// OVER-BLOCK REAL METHODS." Measured true of the D-BP165-M0-010 guard above: `g = 9.81` trips
// `\d*\.\d+` (decimal), and "a 360-day year" trips `\d{2,}` (bare 2+ digit integer) -- both in
// ordinary prose fields (whatItDoes/taughtBy), both refused today with no channel to admit them.
//
// THE FOUNDER'S OWN DISTINCTION, APPLIED LITERALLY: "A CONSTANT OR A FORMULA IS A FACT. A COMPUTED
// RESULT FOR THIS ITEM IS AN ANSWER." This dispatch does NOT loosen VALUE_SHAPED_LEAK_PATTERNS or
// the free-text fields it already guards (whatItDoes/taughtBy/hexConnectorJustification/
// rawOutputText/whatWouldHaveBeenNeeded are UNCHANGED, byte-for-byte, above this comment) -- doing
// that would weaken the guard exactly as the brief forbids. Instead this adds ONE new, narrow,
// STRUCTURED field (`constants` on MethodSiloDepositInput) that is never scanned by the free-text
// regexes at all -- a named constant is not prose, so it does not enter that scan -- but is instead
// validated by validateNamedConstant() below against a stricter, purpose-built set of rules a real
// answer-smuggling attempt is measurably harder to satisfy than an ordinary sentence:
//   1. `symbol` must be a short identifier (<=24 chars, `/^[A-Za-z][A-Za-z0-9_]*$/`), never a
//      sentence -- an answer value has no natural short symbol, a real constant always does (g, pi,
//      n, r, days_per_year).
//   2. `symbol` (case-insensitive) must NOT be one of ITEM_SHAPED_SYMBOL_DENYLIST below -- names an
//      item-specific RESULT would plausibly be called (answer, result, total, balance, verdict,
//      solution, outcome, payoff), refused regardless of value.
//   3. `value` must be a finite number (not NaN/Infinity).
//   4. `source` (the citation) must be a non-trivial string (>=8 chars) AND must contain at least
//      one of SOURCE_AUTHORITY_KEYWORDS below (case-insensitive) -- "standard", "convention",
//      "CODATA", "NIST", "theorem", "formula", "definition", etc. An attacker disguising a
//      per-item computed value as a "constant" would additionally have to fabricate a plausible
//      authority citation, a materially higher bar than typing a bare number.
//   5. `source` and `unit` are still scanned through scanConstantCitationText() below -- the SAME
//      phrase+value guard as everywhere else, with ONE additional narrow carve-out (a bare
//      calendar year, 1900-2099, e.g. "CODATA 2018") so a real citation is not itself refused for
//      naming its own publication year.
//   6. At most MAX_CONSTANTS_PER_DEPOSIT constants per deposit -- an answer-key dump would want many
//      numbers; a real method cites a handful.
//   7. `source` (case-insensitive) must NOT match any phrase in ITEM_SCOPE_PHRASE_DENYLIST below --
//      "for this problem", "in this case", and their near-neighbors are refused REGARDLESS of
//      whether SOURCE_AUTHORITY_KEYWORDS also matched (rule 4 above), the same "refuse regardless"
//      posture rule 2 already applies to symbols. D-BP167-M0-055: this closes the specific gap
//      D-BP167-M0-050 reproduced against the real function -- a source string that names an
//      authority keyword (e.g. "standard convention") AND a per-item-scope phrase (e.g. "for this
//      problem") previously passed on the strength of the keyword alone. It no longer does.
// THIS IS STILL A HEURISTIC, NOT A PROOF -- same honesty this file's own header already applies to
// scanForAnswerLeakage. A sufficiently disguised item-specific value, given an innocuous symbol and
// a fabricated authority-sounding source that avoids every listed phrase, could still pass.
// Documented here, not papered over, per this file's own "heuristic, not a proof" discipline. See
// this dispatch's own return for the proof-by-test cases (a real formula's constants deposit; a
// computed item value refused; the case-5 phrase-disguised value now also refused).

export interface NamedConstant {
  /** Short identifier, e.g. 'g', 'n', 'days_per_year'. Never a sentence. */
  symbol: string;
  value: number;
  /** e.g. 'm/s^2', 'days'. Optional; scanned as free text if present. */
  unit?: string;
  /** Citation of WHY this is a standing constant/convention, never a per-item derivation. Must
   *  contain an authority/convention keyword -- see SOURCE_AUTHORITY_KEYWORDS. */
  source: string;
}

export const MAX_CONSTANTS_PER_DEPOSIT = 6;

const ITEM_SHAPED_SYMBOL_DENYLIST = new Set([
  'answer', 'result', 'total', 'balance', 'verdict', 'solution', 'correctanswer',
  'final', 'outcome', 'payoff', 'amount', 'sum', 'value', 'price', 'cost',
]);

const SOURCE_AUTHORITY_KEYWORDS = [
  'standard', 'convention', 'constant', 'codata', 'nist', 'si unit', 'theorem',
  'formula', 'definition', 'textbook', 'known value', 'physical constant',
  'astronomical', 'universal constant', 'accepted value', 'reference value',
];

/** D-BP167-M0-055: closes the gap D-BP167-M0-050 reproduced against the real function --
 *  `source:'standard convention value for this problem'` passed `SOURCE_AUTHORITY_KEYWORDS`
 *  (it contains "standard" and "convention") even though "for this problem" is itself a strong
 *  signal of a per-item computed value, not a standing constant. Checked against `c.source` in
 *  `validateNamedConstant()` UNCONDITIONALLY -- refused regardless of whether an authority keyword
 *  also matched, the same "refuse regardless" posture ITEM_SHAPED_SYMBOL_DENYLIST already applies
 *  to symbols. This can only make the guard stricter: every existing accept (case 2's CODATA
 *  citation, case 3b's bare Pythagorean relation) contains none of these phrases, so neither is
 *  affected. Each pattern:
 *   - /\bfor this (problem|question|item|qid)\b/i, /\bin this (case|instance)\b/i -- the two
 *     patterns named explicitly in the proposal this dispatch was ordered to implement.
 *   - /\bthis particular (case|instance|item|question|problem)\b/i -- same family as the two
 *     above, catches the "particular" phrasing neither pattern reaches (e.g. "for this particular
 *     question" without the literal word "for this question").
 *   - /\bof the above\b/i -- a standing constant is never described relative to "the above"; that
 *     phrasing names a specific, already-computed value among a set of item-specific options
 *     (e.g. multiple-choice answers), which is exactly the per-item shape this file exists to
 *     refuse.
 *   - /\bas (computed|calculated) here\b/i -- deliberately scoped to "...here" (this session, this
 *     item), NOT bare "as computed"/"as calculated" alone, which a genuine citation can legitimately
 *     use to describe a standing body's methodology (e.g. "as computed by CODATA's least-squares
 *     adjustment") without naming any per-item scope; adding the bare form would risk exactly the
 *     over-block this dispatch was ordered never to introduce, so it was deliberately left out.
 *  Two candidates from the proposal were considered and NOT added, for the same over-block reason:
 *  bare "as computed"/"as calculated" (see above), and bare "the given" (too common in genuine
 *  citations, e.g. "the given SI base-unit definition", to reliably indicate per-item scope on its
 *  own -- narrowing it further was judged out of scope for this dispatch; see this dispatch's
 *  return, section 6, for the Founder to rule on). */
const ITEM_SCOPE_PHRASE_DENYLIST: RegExp[] = [
  /\bfor this (problem|question|item|qid)\b/i,
  /\bin this (case|instance)\b/i,
  /\bthis particular (case|instance|item|question|problem)\b/i,
  /\bof the above\b/i,
  /\bas (computed|calculated) here\b/i,
];

const SYMBOL_FORMAT_RE = /^[A-Za-z][A-Za-z0-9_]{0,23}$/;

/** A bare calendar year, 1900-2099 -- a citation-only carve-out, narrower than and separate from
 *  SAFE_NUMERIC_IDENTIFIER_PATTERNS above (that list is not touched by this dispatch), used ONLY
 *  when scanning a NamedConstant's own source/unit text. */
const CITATION_YEAR_RE = /(?<!\d)(19|20)\d{2}(?!\d)/g;

/** Same phrase+value scan every other free-text field gets, plus TWO narrow, named carve-outs that
 *  apply ONLY here, never to whatItDoes/taughtBy/hexConnectorJustification (those are byte-for-byte
 *  unchanged above this comment):
 *   1. a bare calendar year, 1900-2099 (CITATION_YEAR_RE) -- a citation naming its own publication
 *      year (e.g. "CODATA 2018").
 *   2. `ownValue`, when given -- a citation legitimately RESTATES the constant's own
 *      already-validated numeric value (e.g. source "standard 360-day banking-year convention" for
 *      a constant whose value IS 360). Only the constant's own value is stripped, by exact string
 *      match; any OTHER number appearing in the citation (a different, uncited, possibly smuggled
 *      value) is still caught below. This is not a loosening of the guard on prose fields -- it is
 *      a same-value self-reference exemption scoped to exactly the field that is required (by
 *      validateNamedConstant's format check) to be paired with that one already-validated number. */
function scanConstantCitationText(fieldName: string, value: string, ownValue?: number): string[] {
  const hits: string[] = [];
  for (const re of ANSWER_LEAK_PATTERNS) {
    if (re.test(value)) hits.push(`constant field "${fieldName}" matched answer-leak pattern ${re}`);
  }
  let stripped = stripSafeNumericIdentifiers(value).replace(CITATION_YEAR_RE, '');
  if (ownValue !== undefined && Number.isFinite(ownValue)) {
    const ownValueStr = String(ownValue).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    stripped = stripped.replace(new RegExp(ownValueStr, 'g'), '');
  }
  for (const re of VALUE_SHAPED_LEAK_PATTERNS) {
    if (re.test(stripped)) hits.push(`constant field "${fieldName}" matched value-shaped leak pattern ${re} (D-BP165-M0-025, after citation-year and own-value carve-outs)`);
  }
  return hits;
}

export interface NamedConstantValidation {
  ok: boolean;
  reasons: string[];
}

/** Validates ONE constant. Called for every entry in MethodSiloDepositInput.constants, and again
 *  by auditSiloForAnswerLeakage() (re-parsed off disk) so the check is not a write-time-only
 *  formality -- same discipline the rest of this file already applies. */
export function validateNamedConstant(c: NamedConstant): NamedConstantValidation {
  const reasons: string[] = [];
  if (!SYMBOL_FORMAT_RE.test(c.symbol)) {
    reasons.push(`symbol "${c.symbol}" is not a short identifier (expected /^[A-Za-z][A-Za-z0-9_]{0,23}$/) -- a real constant has a short symbol, prose does not belong here`);
  } else if (ITEM_SHAPED_SYMBOL_DENYLIST.has(c.symbol.toLowerCase())) {
    reasons.push(`symbol "${c.symbol}" is on the item-shaped denylist (answer/result/total/balance/verdict/solution/outcome/payoff/amount/sum/value/price/cost) -- refused regardless of value`);
  }
  if (!Number.isFinite(c.value)) {
    reasons.push(`value for symbol "${c.symbol}" is not a finite number`);
  }
  if (!c.source || c.source.trim().length < 8) {
    reasons.push(`source for symbol "${c.symbol}" is missing or too short (>=8 chars required) -- a real constant is always citable`);
  } else if (!SOURCE_AUTHORITY_KEYWORDS.some((kw) => c.source.toLowerCase().includes(kw))) {
    reasons.push(`source for symbol "${c.symbol}" names no recognized authority/convention keyword (${SOURCE_AUTHORITY_KEYWORDS.join(', ')}) -- refusing rather than trusting an uncited number`);
  }
  if (c.source) {
    for (const re of ITEM_SCOPE_PHRASE_DENYLIST) {
      if (re.test(c.source)) {
        reasons.push(`source for symbol "${c.symbol}" contains a per-item-scope phrase (matched ${re}) -- refused regardless of authority-keyword presence, D-BP167-M0-055`);
      }
    }
  }
  reasons.push(...scanConstantCitationText(`constants.${c.symbol}.source`, c.source ?? '', c.value));
  if (c.unit) reasons.push(...scanConstantCitationText(`constants.${c.symbol}.unit`, c.unit, c.value));
  return { ok: reasons.length === 0, reasons };
}

function renderConstantsSection(constants: NamedConstant[]): string {
  if (constants.length === 0) return '';
  const lines = constants.map((c) => `- **${c.symbol}** = ${c.value}${c.unit ? ` ${c.unit}` : ''} (source: ${c.source})`);
  return [
    '',
    '## NAMED CONSTANTS',
    '',
    '<!-- NAMED-CONSTANTS-BEGIN (D-BP165-M0-025 structured constants channel -- each line is a',
    '     validated NamedConstant, never free prose; see method_silo.ts validateNamedConstant()',
    '     and auditSiloForAnswerLeakage() for how this section is guarded and re-audited) -->',
    ...lines,
    '<!-- NAMED-CONSTANTS-END -->',
    '',
  ].join('\n');
}

/** THE VALUE-SHAPED SCAN (D-BP165-M0-010). Separate from scanForAnswerLeakage's phrase scan so
 *  each guard's own catch/miss set stays independently testable and honestly reportable, but
 *  folded into scanForAnswerLeakage below so every existing caller (depositMethodologyEblet,
 *  depositRejectionEblet) is upgraded by this one change -- no call site needs editing, which IS
 *  the wiring the Founder's new rule requires: the hardened guard sits on both live write paths
 *  because both write paths already call scanForAnswerLeakage(). */
function scanForValueShapedLeakage(fields: Record<string, string>): string[] {
  const hits: string[] = [];
  for (const [field, value] of Object.entries(fields)) {
    const stripped = stripSafeNumericIdentifiers(value);
    for (const re of VALUE_SHAPED_LEAK_PATTERNS) {
      if (re.test(stripped)) hits.push(`field "${field}" matched value-shaped leak pattern ${re} (D-BP165-M0-010)`);
    }
  }
  return hits;
}

/** THE GUARD BOTH WRITE PATHS CALL. Phrase-shaped (ANSWER_LEAK_PATTERNS, pre-existing) AND, as of
 *  D-BP165-M0-010, value-shaped (VALUE_SHAPED_LEAK_PATTERNS, this dispatch). Kept as one function
 *  under the same name deliberately: every existing and future caller of scanForAnswerLeakage gets
 *  both checks with zero call-site changes, which is what makes the hardening apply to the LIVE
 *  path rather than merely existing alongside it. */
function scanForAnswerLeakage(fields: Record<string, string>): string[] {
  const hits: string[] = [];
  for (const [field, value] of Object.entries(fields)) {
    for (const re of ANSWER_LEAK_PATTERNS) {
      if (re.test(value)) hits.push(`field "${field}" matched answer-leak pattern ${re}`);
    }
  }
  hits.push(...scanForValueShapedLeakage(fields));
  return hits;
}

function slugify(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 120);
}

function methodSlug(methodId: string): string {
  // 'methods.definitional_cascade.definitionalCascadeMethod' -> 'definitional_cascade'
  const parts = methodId.split('.');
  return slugify(parts.length >= 2 ? parts[1] : methodId);
}

function yamlQuote(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;
}

export interface MethodSiloDepositInput {
  /** THE SILO PARTITION KEY. Never invented -- one of demand_test.ts's own LianaDemand values. */
  demandKind: LianaDemand;
  /** method_registry.ts's own StepDeclaration.id, e.g.
   *  'methods.definitional_cascade.definitionalCascadeMethod'. */
  methodId: string;
  /** Plain-language description of what the METHOD does and what SHAPE of question it answers.
   *  Never a specific question's resolution. Prefer citing method_registry.ts's own
   *  StepDeclaration.whatItDoes verbatim over authoring new prose per deposit, so this field
   *  cannot drift from the registry's own account of the method. */
  whatItDoes: string;
  /** Citation of the human-taught case (a canon eblet slug, a Founder transcript reference). May
   *  NAME a qid as "the case that taught this method" but must never state that qid's answer. */
  taughtBy: string;
  /** Provenance only -- the qid whose human walkthrough taught this method, or null. */
  qid: number | null;
  runId: string;
  dispatchId: string;
  hexConnector: HexConnector;
  hexConnectorJustification: string;
  sessionLabel: string;
  model: string;
  filedBy: string;
  relatedSlugs?: string[];
  /** D-BP165-M0-025: the named-constants channel. Optional, structured, never free prose -- see
   *  this file's own "THE NAMED-CONSTANTS CHANNEL" section above. Every entry is independently
   *  validated by validateNamedConstant() and the WHOLE deposit is refused (ok:false) if any entry
   *  fails, same "refuse, do not store" contract as the free-text guard. */
  constants?: NamedConstant[];
  dir?: string;
  now?: () => string;
}

export type MethodSiloDepositOutcome =
  | { ok: true; path: string; slug: string; bytes: number; supersededPath?: string }
  | { ok: false; reason: string; leaks?: string[] };

/** WRITE PATH. Mints one Methodology eblet into `<silo>/<demandKind>/<methodSlug>.eblet.md`,
 *  Rule-66 versioned: an existing file at that path is renamed to a `.superseded.<ts>` sibling
 *  (never deleted, never overwritten) before the fresh one is written, mirroring the DENOTATIONS/
 *  precedent's own `supersedes:` convention. */
export function depositMethodologyEblet(input: MethodSiloDepositInput): MethodSiloDepositOutcome {
  const leaks = scanForAnswerLeakage({
    whatItDoes: input.whatItDoes,
    taughtBy: input.taughtBy,
    hexConnectorJustification: input.hexConnectorJustification,
  });
  if (leaks.length > 0) {
    return { ok: false, reason: 'refused: answer-leak pattern matched, see leaks[]', leaks };
  }

  // D-BP165-M0-025: named-constants channel, validated independently of the free-text guard above.
  const constants = input.constants ?? [];
  if (constants.length > MAX_CONSTANTS_PER_DEPOSIT) {
    return {
      ok: false,
      reason: `refused: ${constants.length} constants exceeds MAX_CONSTANTS_PER_DEPOSIT (${MAX_CONSTANTS_PER_DEPOSIT})`,
      leaks: [`too many constants: ${constants.length} > ${MAX_CONSTANTS_PER_DEPOSIT}`],
    };
  }
  const constantLeaks: string[] = [];
  for (const c of constants) {
    const v = validateNamedConstant(c);
    if (!v.ok) constantLeaks.push(...v.reasons);
  }
  if (constantLeaks.length > 0) {
    return { ok: false, reason: 'refused: a named constant failed validation, see leaks[]', leaks: constantLeaks };
  }

  const dir = input.dir || resolveMethodSiloDir();
  const tagDir = join(dir, input.demandKind);
  if (!existsSync(tagDir)) mkdirSync(tagDir, { recursive: true });

  const slug = methodSlug(input.methodId);
  const path = join(tagDir, `${slug}.eblet.md`);
  const nowIso = (input.now ?? (() => new Date().toISOString()))();

  let supersededPath: string | undefined;
  let supersedesLine = '';
  if (existsSync(path)) {
    const stampedName = `${slug}.eblet.md.superseded.${nowIso.replace(/[:.]/g, '-')}`;
    const dest = join(tagDir, stampedName);
    renameSync(path, dest);
    supersededPath = dest;
    supersedesLine = `  supersedes: ${yamlQuote(stampedName)}\n`;
  }

  const name = `method-silo-${input.demandKind.toLowerCase()}-${slug}`;
  const description = `Methodology eblet: demand kind ${input.demandKind} is resolved by ${input.methodId}. `
    + `${input.whatItDoes} Deposited by the Liana Cycle silo write path, dispatch ${input.dispatchId}.`;
  const related = (input.relatedSlugs ?? []).map((s) => `  - ${s}`).join('\n');

  const frontmatter = [
    '---',
    `name: ${name}`,
    `description: ${yamlQuote(description)}`,
    'metadata:',
    '  type: methodology', // BP140 sub-kind literal, PROPOSED not confirmed on disk -- see file header.
    `  session: ${input.sessionLabel}`,
    '  status: "MINTED, machine-authored by the Liana Cycle method-silo write path"',
    `  demand_kind: ${input.demandKind}`,
    `  method_id: ${yamlQuote(input.methodId)}`,
    `  filed_by: ${yamlQuote(input.filedBy)}`,
    `  filed_utc: ${yamlQuote(nowIso)}`,
    supersedesLine.replace(/\n$/, ''),
    `hex_connector: ${input.hexConnector}`,
    `hex_connector_justification: ${yamlQuote(input.hexConnectorJustification)}`,
    'provenance:',
    `  qid: ${input.qid === null ? 'null' : input.qid}`,
    `  run_id: ${yamlQuote(input.runId)}`,
    `  dispatch_id: ${yamlQuote(input.dispatchId)}`,
    `  taught_by: ${yamlQuote(input.taughtBy)}`,
    `  model: ${yamlQuote(input.model)}`,
    ...(related ? ['related:', related] : []),
    'metadata_type: methodology',
    '---',
    '',
  ].filter((l) => l !== '').join('\n');

  const body = [
    `# METHOD SILO -- ${input.demandKind}`,
    `## ${input.methodId}`,
    '',
    `**Demand kind:** ${input.demandKind}`,
    `**Method:** ${input.methodId}`,
    `**Hex connector:** ${input.hexConnector}`,
    '',
    '## WHAT THIS METHOD DOES',
    '',
    input.whatItDoes,
    '',
    '## TAUGHT BY',
    '',
    input.taughtBy,
    renderConstantsSection(constants),
    '## NO-ANSWER ATTESTATION',
    '',
    'This eblet describes a METHOD (how to resolve a SHAPE of question), never the resolution of',
    'any specific question. It carries no verdict, no correct-answer field, and no per-qid result.',
    'It was scanned for answer-shaped phrasing at deposit time (method_silo.ts\'s',
    'scanForAnswerLeakage()) and can be re-scanned at any time via auditSiloForAnswerLeakage().',
    '',
    '---',
    `*Deposited by ${input.filedBy}, dispatch ${input.dispatchId}, ${nowIso}. Machine-authored,`,
    'not Founder-ratified. Nothing declared done.*',
    '',
  ].join('\n');

  const fullText = frontmatter + '\n' + body;
  writeFileSync(path, fullText, 'utf8');
  const bytes = statSync(path).size;
  return { ok: true, path, slug, bytes, ...(supersededPath ? { supersededPath } : {}) };
}

// ─── THE TWO-STEP CONNECTOR, BY TAG ─────────────────────────────────────────────────────────────

export interface SiloCelpane {
  t: 'silo_celpane';
  v: 1;
  tag: LianaDemand;
  hc: HexConnector | 'MIXED' | null;
  n: number;
  methods: string[];
  qk: string;
  mf: true;
}

export type SiloMintOutcome =
  | { ok: true; celpane: SiloCelpane; tokens: number; withinBudget: boolean }
  | { ok: false; reason: string };

function listTagFiles(dir: string, tag: LianaDemand): string[] {
  const tagDir = join(dir, tag);
  if (!existsSync(tagDir)) return [];
  return readdirSync(tagDir)
    .filter((f) => f.endsWith('.eblet.md') && !f.includes('.superseded.'))
    .sort();
}

function extractFrontmatterField(raw: string, field: string): string | null {
  const m = raw.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
  if (!m) return null;
  return m[1].trim().replace(/^"|"$/g, '');
}

/** STEP ONE. Cheap: readdirSync only, no full-file reads of every entry -- the celpane reports
 *  count and method-id list (small strings, never the METHOD DESCRIPTION or TAUGHT-BY text) so
 *  the full record still requires the second, explicit fetch. Honestly reports ok:false, not an
 *  error, when the tag directory does not exist yet -- EMPTY AT COLD START IS CORRECT. */
export function mintSiloCelpane(tag: LianaDemand, opts?: { dir?: string }): SiloMintOutcome {
  const dir = opts?.dir || resolveMethodSiloDir();
  const files = listTagFiles(dir, tag);
  if (files.length === 0) {
    return { ok: false, reason: `no methodology eblets deposited yet for demand kind ${tag} (cold start is correct, not an error)` };
  }
  const methods = files.map((f) => f.replace(/\.eblet\.md$/, ''));
  const hexConnectors = new Set<string>();
  for (const f of files) {
    try {
      const raw = readFileSync(join(dir, tag, f), 'utf8');
      const hc = extractFrontmatterField(raw, 'hex_connector');
      if (hc) hexConnectors.add(hc);
    } catch { /* unreadable file -- excluded from hc set, still counted in files/methods */ }
  }
  const hc: HexConnector | 'MIXED' | null = hexConnectors.size === 1
    ? (Array.from(hexConnectors)[0] as HexConnector)
    : hexConnectors.size > 1 ? 'MIXED' : null;

  const qk = contentAddress([`tag:${tag}`, ...files]);
  // NOTE: no headline field here (unlike connector_celpane.ts's own `h`) -- a headline built
  // from `tag` + method count/names pushed a first version of this object over the 50-token
  // budget once `methods` carries a real slug (measured this ticket: 52 estimated tokens with a
  // headline, 42 without, for one 20-char method slug). Cut, not guessed at: `tag`, `hc`, `n`,
  // and `methods` already let a caller construct the same headline text itself if wanted.
  const celpane: SiloCelpane = {
    t: 'silo_celpane', v: 1, tag, hc, n: files.length, methods, qk, mf: true,
  };
  const tokens = estimateTokens(celpane);
  return { ok: true, celpane, tokens, withinBudget: tokens <= CELPANE_MAX_TOKENS };
}

export type SiloFetchOutcome =
  | { ok: true; text: string; bytes: number; filesRead: string[] }
  | { ok: false; reason: string };

/** STEP TWO, the second explicit fetch. Reads and concatenates the full text of every methodology
 *  eblet the celpane pointed at, by relisting the tag directory (not by trusting file names
 *  carried unchecked from the celpane) so a fetch after a deposit/supersede still resolves
 *  correctly. This full text IS what would ship to a third party -- see file header. */
export async function fetchSiloCelpaneFullText(
  celpane: SiloCelpane,
  opts?: { dir?: string },
): Promise<SiloFetchOutcome> {
  const dir = opts?.dir || resolveMethodSiloDir();
  const files = listTagFiles(dir, celpane.tag);
  if (files.length === 0) {
    return { ok: false, reason: `no methodology eblets found for tag ${celpane.tag} at fetch time (dir=${dir})` };
  }
  const parts: string[] = [];
  const filesRead: string[] = [];
  for (const f of files) {
    try {
      const raw = readFileSync(join(dir, celpane.tag, f), 'utf8');
      parts.push(`\n\n===== ${f} =====\n\n${raw}`);
      filesRead.push(f);
    } catch { /* skip unreadable */ }
  }
  const text = parts.join('');
  return { ok: true, text, bytes: Buffer.byteLength(text, 'utf8'), filesRead };
}

// ─── WHOLE-SILO SUMMARY, READ-ONLY -- for BISHOP-M3's Prove It surface ─────────────────────────

export interface MethodSiloSummary {
  dir: string;
  tags: Array<{ tag: string; files: number; methods: string[] }>;
  totalFiles: number;
  totalBytes: number;
}

export function summarizeMethodSilo(opts?: { dir?: string }): MethodSiloSummary {
  const dir = opts?.dir || resolveMethodSiloDir();
  if (!existsSync(dir)) return { dir, tags: [], totalFiles: 0, totalBytes: 0 };
  const tagDirs = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory());
  const tags: Array<{ tag: string; files: number; methods: string[] }> = [];
  let totalFiles = 0;
  let totalBytes = 0;
  for (const t of tagDirs) {
    const files = readdirSync(join(dir, t.name)).filter((f) => f.endsWith('.eblet.md') && !f.includes('.superseded.'));
    for (const f of files) totalBytes += statSync(join(dir, t.name, f)).size;
    totalFiles += files.length;
    tags.push({ tag: t.name, files: files.length, methods: files.map((f) => f.replace(/\.eblet\.md$/, '')) });
  }
  return { dir, tags, totalFiles, totalBytes };
}

// ─── MECHANICAL ANSWER-LEAKAGE AUDIT ────────────────────────────────────────────────────────────

export interface SiloAuditOutcome {
  dir: string;
  scanned: number;
  flagged: Array<{ path: string; hits: string[] }>;
}

// D-BP165-M0-010: two ADDITIONAL strip patterns, audit-only. auditSiloForAnswerLeakage scans the
// WHOLE raw file (frontmatter + body), unlike the deposit-time guards above which only ever see
// the specific free-text fields (whatItDoes/taughtBy/hexConnectorJustification or
// rawOutputText/whatWouldHaveBeenNeeded). Two frontmatter metadata lines carry legitimate bare
// integers that are provenance, never a value under test -- named here, not silently swallowed
// into the general strip list, because they are audit-only carve-outs: `qid: N` / dispatch ids /
// BP numbers / ISO timestamps already fold in via SAFE_NUMERIC_IDENTIFIER_PATTERNS above.
//
// D-BP165-M0-025 MEASURED, LAW 2 ("check the instrument before the patient"): a THIRD such line
// exists and was NOT covered here before this dispatch -- `supersedes: "<file>.eblet.md.superseded.
// <ts>"`, written by depositMethodologyEblet()/depositRejectionEblet() on a SECOND deposit to the
// same path (see both functions' own Rule-66 supersede block above). The stamped timestamp inside
// that filename replaces `:` and `.` with `-` (`nowIso.replace(/[:.]/g, '-')`), so
// SAFE_NUMERIC_IDENTIFIER_PATTERNS' own ISO-8601 carve-out (which requires literal `:`/`.`) does
// NOT match it -- the hyphen-joined digit groups (e.g. `2026-08-24T15-46-20-280Z`) then trip
// VALUE_SHAPED_LEAK_PATTERNS' arithmetic pattern (`\d+\s*[+\-*/^%=]\s*\d+` -- a hyphen IS an
// operator in that class) and its bare-integer pattern. This bug PRE-DATES this dispatch (present
// in the D-BP165-M0-010 code this dispatch found on disk) but had never been exercised by any
// existing test, because every prior test used a fresh temp dir per deposit and therefore never
// triggered a second (superseding) deposit into the same path before auditing it. Found only
// because this dispatch's own round-trip proof deliberately re-deposits into a PERSISTENT
// directory across two separate process runs -- a real scenario, not a test artifact. Fixed here by
// the same carve-out mechanism this section already established for exactly this problem shape: the
// `supersedes:` value is a machine-generated filename, structurally never an answer, and is
// provenance-only in the same sense `run_id` already is.
const AUDIT_ONLY_SAFE_LINE_PATTERNS: RegExp[] = [
  /^\s*raw_output_original_length:\s*\d+\s*$/gim, // capped-text length, a byte count, never a value
  /^\s*run_id:\s*"[^"]*"\s*$/gim, // opaque run identifier, may be timestamp-derived
  /^\s*supersedes:\s*"[^"]*"\s*$/gim, // D-BP165-M0-025: superseded-sibling filename, timestamp-derived, never a value
];

/** "THE NO-ANSWERS PROPERTY MUST BE MECHANICALLY CHECKABLE, NOT PROMISED." Re-scans every live
 *  (non-superseded) eblet in the silo for BOTH the phrase-shaped ANSWER_LEAK_PATTERNS AND, as of
 *  D-BP165-M0-010, the value-shaped VALUE_SHAPED_LEAK_PATTERNS depositMethodologyEblet() and
 *  depositRejectionEblet() already check at write time (via scanForAnswerLeakage) -- so a subset
 *  can be re-audited immediately before it ships, independent of trusting the write path, and so a
 *  file written by any means OTHER than this file's own deposit functions (a hand-edit, a future
 *  caller that forgets to route through the guard) is still caught here. Heuristic, not a proof;
 *  documented as such. */
export function auditSiloForAnswerLeakage(opts?: { dir?: string }): SiloAuditOutcome {
  const dir = opts?.dir || resolveMethodSiloDir();
  const flagged: Array<{ path: string; hits: string[] }> = [];
  let scanned = 0;
  if (!existsSync(dir)) return { dir, scanned, flagged };
  for (const t of readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    const tagDir = join(dir, t.name);
    for (const f of readdirSync(tagDir).filter((n) => n.endsWith('.eblet.md') && !n.includes('.superseded.'))) {
      scanned += 1;
      const path = join(tagDir, f);
      let raw = '';
      try { raw = readFileSync(path, 'utf8'); } catch { continue; }
      const hits: string[] = [];
      for (const re of ANSWER_LEAK_PATTERNS) {
        if (re.test(raw)) hits.push(re.toString());
      }
      // D-BP165-M0-025: extract and independently re-validate the named-constants block (if any)
      // BEFORE the general value-shaped scan runs -- so a legitimate constant's own digits do not
      // trip the general scan, while the block's own shape and content are still mechanically
      // re-checked here (never trusted merely because it arrived through the write path).
      let strippedForValueScan = raw;
      const constantsBlockMatch = raw.match(/<!-- NAMED-CONSTANTS-BEGIN[\s\S]*?-->\n([\s\S]*?)<!-- NAMED-CONSTANTS-END -->/);
      if (constantsBlockMatch) {
        const constantLines = constantsBlockMatch[1].split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
        if (constantLines.length > MAX_CONSTANTS_PER_DEPOSIT) {
          hits.push(`named-constants block has ${constantLines.length} entries, exceeds MAX_CONSTANTS_PER_DEPOSIT (${MAX_CONSTANTS_PER_DEPOSIT}) (D-BP165-M0-025 audit)`);
        }
        const lineRe = /^-\s+\*\*([A-Za-z][A-Za-z0-9_]{0,23})\*\*\s*=\s*(-?\d+(?:\.\d+)?(?:[eE]-?\d+)?)(?:\s+([^(]+?))?\s*\(source:\s*(.+)\)$/;
        for (const line of constantLines) {
          const m = line.match(lineRe);
          if (!m) {
            hits.push(`named-constants line does not match the expected constant shape, refusing to trust it as safe: "${line}" (D-BP165-M0-025 audit)`);
            continue;
          }
          const [, symbol, valueStr, unit, source] = m;
          const v = validateNamedConstant({ symbol, value: Number(valueStr), unit: unit?.trim(), source: source.trim() });
          if (!v.ok) hits.push(...v.reasons.map((r) => `${r} (D-BP165-M0-025 audit re-validation)`));
        }
        // Remove the whole block (including its digits) from the text handed to the general
        // value-shaped scan below -- a validated constant is a fact, not a leak, and must not be
        // double-flagged by the same scan it was deliberately routed around at write time.
        strippedForValueScan = strippedForValueScan.replace(constantsBlockMatch[0], '');
      }
      for (const re of AUDIT_ONLY_SAFE_LINE_PATTERNS) strippedForValueScan = strippedForValueScan.replace(re, '');
      strippedForValueScan = stripSafeNumericIdentifiers(strippedForValueScan);
      for (const re of VALUE_SHAPED_LEAK_PATTERNS) {
        if (re.test(strippedForValueScan)) hits.push(`${re.toString()} (D-BP165-M0-010 value-shaped)`);
      }
      if (hits.length > 0) flagged.push({ path, hits });
    }
  }
  return { dir, scanned, flagged };
}

// ─── D-BP165-M0-007: REJECTION-AS-TRAINING-SIGNAL DEPOSIT PATH ─────────────────────────────────
// FOUNDER'S BP164 FRAMING, VERBATIM (relayed by this dispatch's own order): "it's only a Silo by
// Tag - so ALL text queries will be allocated and tagged and categorized" and "We are planting the
// seeds here, of the Mighty Banyan to come, which IS the Substrate." canon_the_liana_cycle_is_a_
// method_registry_taught_by_humans_bp149 names an honest refusal as the next teaching opportunity.
// So a rejection (compute_sidecar.ts's own ModelExpressionRejectionClass, or any future method's
// analogous classification) is DEPOSITABLE here, keyed by demand tag exactly like a methodology
// eblet, carrying the demand, the rejection class, the raw completion text, and what would have
// been needed to succeed.
//
// THE ABSOLUTE CONSTRAINT, MEASURED THIS DISPATCH, NOT ASSUMED: NO ANSWER MAY EVER ENTER THE
// SILO. depositMethodologyEblet()'s own scanForAnswerLeakage() guard, reused below, is PHRASE-
// SHAPED -- it matches "the correct answer is X" / "verdict: X" / "qid N is option A", prose
// shapes an ANSWER KEY would use. Measured this dispatch (method_silo.rejection_deposit.test.ts)
// to NOT match a bare numeric or arithmetic-expression completion ("52500", "250000 * 0.2") --
// exactly the shape compute_sidecar.ts's rejected/disagreeing COMPUTE samples most often carry,
// and exactly the shape a genuine leaked answer value would ALSO carry for demand COMPUTE. That
// test file carries the measured proof, both the case the existing guard DOES catch (prose) and
// the case it does NOT (bare arithmetic) -- the second finding is why depositRejectionEblet()
// below adds a SECOND, STRUCTURAL guard (refusing any raw text whose first non-empty line is bare
// digits/operators with no surrounding words) closing that specific gap. The residual risk --
// free-form prose stating a number in a phrasing ANSWER_LEAK_PATTERNS does not happen to match --
// is documented rather than papered over, same "heuristic, not a proof" discipline this file's
// own header already applies to scanForAnswerLeakage. GATED BEHIND AN ENV FLAG, DEFAULT OFF, per
// this dispatch's own order, so no run silently starts writing into the substrate.
//
// D-BP165-M0-010 ADDENDUM (this paragraph is a correction, the paragraph above is left intact per
// LAW 6 -- the record of what was true at D-BP165-M0-007 close stays true, it does not get
// rewritten). The "residual risk" named above -- a number in free-form prose that
// ANSWER_LEAK_PATTERNS does not happen to match -- is CLOSED as of this dispatch:
// scanForAnswerLeakage() (called by both depositMethodologyEblet() AND depositRejectionEblet(),
// unchanged call sites) now also runs VALUE_SHAPED_LEAK_PATTERNS, which catches a bare integer of
// two or more digits ANYWHERE in the field, not only a whole bare line. The env-flag gate on
// depositRejectionEblet() itself is UNCHANGED by this dispatch -- still default OFF, still a
// Founder-review gate on the auto-deposit PATH, orthogonal to the guard's own strength. What the
// hardened guard still provably does not catch: a single-digit-only expression embedded in prose
// ("4*3", the fraction "3/4"), and any answer expressed with no digit at all. See this file's own
// header for the fuller account.

export const REJECTION_SILO_AUTO_DEPOSIT_ENV_FLAG = 'LB_METHOD_SILO_DEPOSIT_REJECTIONS_ENABLED';

export interface RejectionDepositInput {
  demandKind: LianaDemand;
  methodId: string;
  /** compute_sidecar.ts's ModelExpressionRejectionClass today; typed loosely (union with `string`)
   *  so a future method's OWN rejection taxonomy can deposit here too without this file importing
   *  every method's classification type. */
  rejectionClass: ModelExpressionRejectionClass | string;
  /** The raw model completion. NEVER pre-scanned as safe by the caller -- this function is the
   *  enforcement point, not a formality. Should already be capped (compute_sidecar.ts's
   *  capRawModelOutput()) but this function re-caps defensively regardless. */
  rawOutputText: string;
  rawOutputOriginalLength: number;
  rawOutputTruncated: boolean;
  /** Plain-language description of what WOULD have let this sample succeed (e.g. "a component
   *  fact giving the reserve-ratio formula") -- never a specific numeric value. Scanned for
   *  answer-leak phrasing exactly like rawOutputText. */
  whatWouldHaveBeenNeeded: string;
  qid: number | null;
  runId: string;
  dispatchId: string;
  hexConnector: HexConnector;
  hexConnectorJustification: string;
  sessionLabel: string;
  model: string;
  filedBy: string;
  dir?: string;
  now?: () => string;
}

export type RejectionDepositOutcome =
  | { ok: true; path: string; slug: string; bytes: number }
  | { ok: false; reason: string; leaks?: string[] };

/** Refuses categorically when the raw completion's first non-empty line is nothing but digits,
 *  arithmetic operators, and whitespace -- see this section's own header for why: for demand
 *  COMPUTE that shape is structurally indistinguishable from a leaked answer value, and
 *  ANSWER_LEAK_PATTERNS (phrase-shaped) does not catch it. */
const BARE_NUMERIC_OR_EXPRESSION_RE = /^[\d+\-*/^().%\s=]+$/;

/** WRITE PATH for a rejection-as-training-signal deposit. OFF BY DEFAULT (checked first, before
 *  any guard below even runs) -- set `LB_METHOD_SILO_DEPOSIT_REJECTIONS_ENABLED=true` to enable.
 *  Even when enabled, still passes through the bare-numeric-FIRST-LINE structural guard above,
 *  THEN scanForAnswerLeakage() -- which as of D-BP165-M0-010 is BOTH phrase-shaped
 *  (ANSWER_LEAK_PATTERNS) AND value-shaped (VALUE_SHAPED_LEAK_PATTERNS, catching a bare integer or
 *  arithmetic/equation shape ANYWHERE in the field, not only a whole bare line) -- before a single
 *  byte is written, refusing on any hit, same "refuse, do not store" contract
 *  depositMethodologyEblet() already has. These guards TOGETHER still do not amount to a proof
 *  that free-form prose can never leak an answer (a single-digit-only value, or a non-numeric
 *  answer with no digit at all, still passes -- see this file's own header) -- this is documented,
 *  not oversold, and is why the Founder's ruling gates this whole auto-deposit PATH behind an env
 *  flag default OFF regardless of how strong the content guard becomes. */
export function depositRejectionEblet(input: RejectionDepositInput): RejectionDepositOutcome {
  if (process.env[REJECTION_SILO_AUTO_DEPOSIT_ENV_FLAG] !== 'true') {
    return {
      ok: false,
      reason: `refused: auto-deposit is gated behind ${REJECTION_SILO_AUTO_DEPOSIT_ENV_FLAG}, default OFF, and it is not set to 'true' in this process (Founder order, D-BP165-M0-007: no run silently starts writing into the substrate)`,
    };
  }

  const cappedText = input.rawOutputText.length > RAW_MODEL_OUTPUT_CAP_CHARS
    ? input.rawOutputText.slice(0, RAW_MODEL_OUTPUT_CAP_CHARS)
    : input.rawOutputText;

  const firstLine = cappedText.split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? '';
  if (firstLine.length > 0 && BARE_NUMERIC_OR_EXPRESSION_RE.test(firstLine)) {
    return {
      ok: false,
      reason: 'refused: raw output\'s first non-empty line is bare digits/arithmetic-operators '
        + 'with no surrounding words -- structurally indistinguishable from a leaked answer value '
        + 'for a COMPUTE-shaped rejection, refused regardless of ANSWER_LEAK_PATTERNS result '
        + '(D-BP165-M0-007 structural guard)',
    };
  }

  const leaks = scanForAnswerLeakage({
    rawOutputText: cappedText,
    whatWouldHaveBeenNeeded: input.whatWouldHaveBeenNeeded,
  });
  if (leaks.length > 0) {
    return { ok: false, reason: 'refused: answer-leak pattern matched, see leaks[]', leaks };
  }

  const dir = input.dir || resolveMethodSiloDir();
  const tagDir = join(dir, input.demandKind);
  if (!existsSync(tagDir)) mkdirSync(tagDir, { recursive: true });

  const slug = `rejection-${methodSlug(input.methodId)}-${slugify(input.rejectionClass)}-${contentAddress([
    input.demandKind, input.methodId, input.rejectionClass, input.runId, input.dispatchId, String(input.qid), cappedText,
  ]).slice(0, 16)}`;
  const path = join(tagDir, `${slug}.eblet.md`);
  const nowIso = (input.now ?? (() => new Date().toISOString()))();

  // Rule 66: version, never overwrite -- same convention depositMethodologyEblet() uses, even
  // though the content-addressed slug above makes a real collision unlikely.
  let supersedesLine = '';
  if (existsSync(path)) {
    const stampedName = `${slug}.eblet.md.superseded.${nowIso.replace(/[:.]/g, '-')}`;
    renameSync(path, join(tagDir, stampedName));
    supersedesLine = `  supersedes: ${yamlQuote(stampedName)}\n`;
  }

  const name = `method-silo-rejection-${input.demandKind.toLowerCase()}-${methodSlug(input.methodId)}`;
  const description = `Rejection eblet: demand kind ${input.demandKind}, method ${input.methodId} `
    + `abstained (${input.rejectionClass}). Deposited as training signal by the Liana Cycle silo `
    + `write path, dispatch ${input.dispatchId}.`;

  const frontmatter = [
    '---',
    `name: ${name}`,
    `description: ${yamlQuote(description)}`,
    'metadata:',
    '  type: rejection', // sibling of BP140's 'methodology' -- an honest-refusal fact, never a Tool/Fact/Whole-Answer eblet.
    `  session: ${input.sessionLabel}`,
    '  status: "MINTED, machine-authored by the Liana Cycle rejection silo write path"',
    `  demand_kind: ${input.demandKind}`,
    `  method_id: ${yamlQuote(input.methodId)}`,
    `  rejection_class: ${yamlQuote(input.rejectionClass)}`,
    `  filed_by: ${yamlQuote(input.filedBy)}`,
    `  filed_utc: ${yamlQuote(nowIso)}`,
    supersedesLine.replace(/\n$/, ''),
    `hex_connector: ${input.hexConnector}`,
    `hex_connector_justification: ${yamlQuote(input.hexConnectorJustification)}`,
    'provenance:',
    `  qid: ${input.qid === null ? 'null' : input.qid}`,
    `  run_id: ${yamlQuote(input.runId)}`,
    `  dispatch_id: ${yamlQuote(input.dispatchId)}`,
    `  model: ${yamlQuote(input.model)}`,
    `  raw_output_original_length: ${input.rawOutputOriginalLength}`,
    `  raw_output_truncated: ${input.rawOutputTruncated}`,
    'metadata_type: rejection',
    '---',
    '',
  ].filter((l) => l !== '').join('\n');

  const body = [
    `# METHOD SILO REJECTION -- ${input.demandKind}`,
    `## ${input.methodId}`,
    '',
    `**Demand kind:** ${input.demandKind}`,
    `**Method:** ${input.methodId}`,
    `**Rejection class:** ${input.rejectionClass}`,
    `**Hex connector:** ${input.hexConnector}`,
    '',
    '## RAW MODEL COMPLETION (capped; this dispatch\'s guards run over this text before deposit)',
    '',
    '```',
    cappedText,
    '```',
    '',
    '## WHAT WOULD HAVE BEEN NEEDED',
    '',
    input.whatWouldHaveBeenNeeded,
    '',
    '## NO-ANSWER ATTESTATION',
    '',
    'This eblet describes a REJECTED sample -- an honest abstention, never a resolved answer to any',
    'specific question. It was scanned for answer-shaped phrasing (scanForAnswerLeakage()) AND for',
    'a bare-numeric/arithmetic-expression shape (this file\'s own structural guard) at deposit time,',
    'and can be re-scanned via auditSiloForAnswerLeakage(). Per D-BP165-M0-007\'s own finding, this',
    'is a heuristic, not a proof -- see method_silo.ts\'s own header on this deposit path.',
    '',
    '---',
    `*Deposited by ${input.filedBy}, dispatch ${input.dispatchId}, ${nowIso}. Machine-authored,`,
    'not Founder-ratified. Nothing declared done.*',
    '',
  ].join('\n');

  const fullText = frontmatter + '\n' + body;
  writeFileSync(path, fullText, 'utf8');
  const bytes = statSync(path).size;
  return { ok: true, path, slug, bytes };
}
