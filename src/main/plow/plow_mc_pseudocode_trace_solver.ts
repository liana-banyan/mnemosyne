// plow_mc_pseudocode_trace_solver.ts -- deterministic "which code segment produces this output"
// pseudocode-execution solver, a SEVENTH independent compute tier alongside computeUnitAwareMatch,
// computeAnswer+matchValueToOption, solveScheduleProblem, solveDensityProblem,
// solvePhysicsRelationProblem, and solveAircraftLiftDragProblem (see plow_mc_answerer.ts's
// resolveDeterministicComputeOverride).
//
// WHY THIS EXISTS: this question class (AP-CSP-style "the following procedures are available ...
// which of the following code segments will correctly create newList?") is currently decided by an
// ensemble vote and an adjudicator that is itself one of the disputants. Live receipt (run 026):
// sources voted user_perplexity:G, user_claude:A, specialist_swarm:C -- the correct answer was C,
// but the adjudicator picked A. None of the six existing tiers can reach this question: there is no
// unit-bearing chain (tier i), no bare arithmetic expression (tier ii), no loan schedule (tier iii),
// no mass/dimensions density (tier iv), no Kepler relation (tier v), no lift/drag relation (tier
// vi) -- the question instead defines three named list procedures (Sort/Combine/RemoveDuplicates)
// by their EXPLANATIONS and gives a worked example; the only way to know which code segment is
// correct is to actually RUN each candidate segment against the worked example's own inputs and
// compare to its own stated output. This module does exactly that: it is a tiny interpreter for a
// narrow 3-primitive pseudocode language, gated so tightly it only ever fires on this question
// shape, and it proves its answer by execution rather than by any authority's reasoning.
//
// REAL DATASET ARTIFACT handled (verified against the exact question string this Yoke, OCR-damaged):
//   "if 1istl contains [...] and 1ist2 contains [...] Dracula, "Macbeth" ..." -- "list1"/"list2" are
//   corrupted inconsistently (sometimes "1istl", sometimes "listl", sometimes correct "list1"/
//   "list2"), and the list2 example literal is missing ONE closing quote after "Dracula,". Both are
//   repaired without inventing or discarding any actual data -- see normalizeListRefs() and
//   extractBracketedItems() below.
//
// HAND-VERIFIED (this Yoke) against the real question text, tolerating the corruption verbatim:
//   normalizeListRefs turns "if 1istl contains" -> "if list1 contains" and "and 1ist2 contains" ->
//   "and list2 contains" (both "1istl"/"listl"/"1ist2" forms map onto "list1"/"list2" -- see that
//   function's own header for the exact character-level reasoning).
//   extractBracketedItems on list1's bracket content `"Macbeth", "Frankenstein", "Jane Eyre"` splits
//   on the top-level commas FIRST, then strips quote/whitespace characters off each piece
//   independently -- so it never depends on quotes being balanced -- giving
//   list1 = [Macbeth, Frankenstein, Jane Eyre].
//   The SAME split-then-strip approach applied to list2's damaged content
//   `"Frankenstein", "Dracula, "Macbeth", "Hamlet"` (note: NO closing quote after "Dracula,") splits
//   on commas into [`"Frankenstein"`, ` "Dracula`, ` "Macbeth"`, ` "Hamlet"`] and strips leading/
//   trailing quote+whitespace from EACH piece independently -- piece 2 (` "Dracula`, missing its
//   own closing quote) still strips cleanly to `Dracula` because the strip only needs a quote on
//   the side that HAS one; the missing side is simply absent whitespace/quote to strip, a no-op.
//   Result: list2 = [Frankenstein, Dracula, Macbeth, Hamlet] -- the corruption is fully survived.
//   expected (from "then newList will contain [...]") = [Dracula, Frankenstein, Hamlet, Jane Eyre,
//   Macbeth].
//   Executing the correct option's code, `newList <- Sort(RemoveDuplicates(Combine(list1, list2)))`:
//     Combine(list1, list2)        = [Macbeth, Frankenstein, Jane Eyre, Frankenstein, Dracula,
//                                      Macbeth, Hamlet]                          (7 entries, concat)
//     RemoveDuplicates(that)       = [Macbeth, Frankenstein, Jane Eyre, Dracula, Hamlet]
//                                      (keeps each entry's FIRST occurrence, per the question's own
//                                       "duplicate entries are removed so that any entry appears at
//                                       most once" explanation)
//     Sort(that)                   = [Dracula, Frankenstein, Hamlet, Jane Eyre, Macbeth]
//   -- byte-for-byte equal to `expected`. A plausible wrong option, e.g.
//   `newList <- Sort(Combine(list1, list2))` (no dedup), evaluates to a 7-entry list with duplicates
//   and correctly fails to match; `newList <- RemoveDuplicates(Combine(list1, list2))` (no sort)
//   evaluates to the 5-entry list ABOVE BEFORE the Sort step, in insertion order (not alphabetical),
//   and correctly fails to match `expected` too. See the proof script for the full option set.
//
// CONSERVATISM (never guess), same bar as every other tier in this repo:
//   (1) GATE -- fires ONLY when ALL of the following are confidently, independently parsed straight
//       out of the question text: an explicit "which of the following code segments" ask; a
//       Procedure/Explanation table; a "for example" worked instance; the worked example's list1
//       array, list2 array, AND expected-output array all extract to at least one item each; and
//       the procedure-table section names EXACTLY the three procedures this module implements
//       (Sort, Combine, RemoveDuplicates) -- an unrecognized procedure name in that section is an
//       honest null rather than a silent under-implementation. Any missing/ambiguous piece returns
//       null immediately.
//   (2) OPTION EXECUTION -- every MC option's code segment must PARSE and EVALUATE cleanly against
//       the worked-example inputs (a single expression OR a multi-statement `var <- expr` sequence,
//       using only Sort/Combine/RemoveDuplicates and list1/list2/intermediate-variable references)
//       -- mirrors plow_mc_aircraft_solver.ts's own "every option must parse cleanly, else abstain"
//       discipline exactly. A single unparseable option (e.g. one calling a procedure this module
//       does not implement) aborts the WHOLE question rather than silently treating that option as
//       "doesn't match" -- that silent assumption would itself be an unproven guess.
//   (3) MATCH -- the option's evaluated result is compared to `expected` order-sensitively, exact
//       string match after trimming. Accept ONLY when EXACTLY ONE option's result equals `expected`
//       -- zero or 2+ qualifying options is an honest null, same "exactly one option" gate every
//       other tier here uses. (Note for whoever reviews a live run: some semantically-equivalent
//       distractor pairs -- e.g. Sort-then-RemoveDuplicates vs RemoveDuplicates-then-Sort -- always
//       produce byte-identical output under these primitive definitions; if the real MC option set
//       ever contains such a pair, this solver correctly and honestly abstains rather than picking
//       one arbitrarily.)
// Pure/synchronous, no I/O, no model call -- derives strictly from `questionText` + `options`.
//
// Rule 66: version, never overwrite -- this is a new file, no supersede needed.

import type { McOption } from './compute_sidecar';

export interface PseudocodeTraceSolverResult {
  letter: string;
  /** JSON-stringified array -- our computed result of executing the matched option's code against
   *  the worked example's inputs. Directly comparable to `optionValue`, same computed-value-vs-
   *  option-value distinction every other tier in this repo surfaces (here both are lists, not
   *  scalars, so both are carried as JSON text rather than `number`). */
  value: string;
  /** JSON-stringified array -- the worked example's OWN stated expected output (from "then newList
   *  will contain [...]" in the question text). Equal to `value` by construction (that equality is
   *  exactly what "matched" means here). */
  optionValue: string;
  provenance: string;
  trace: string;
}

// --- Gate: the three primitives this module implements ------------------------------------------

const KNOWN_PROCEDURES = new Set(['Sort', 'Combine', 'RemoveDuplicates']);

// --- Context gate: must ask "which of the following code segments", show a Procedure/Explanation
// table, and give a "for example" worked instance ------------------------------------------------

const ASK_RE = /\bwhich of the following code segments\b/i;
const PROCEDURE_TABLE_RE = /\bProcedure\b[\s\S]{0,60}?\bExplanation\b/i;
const WORKED_EXAMPLE_RE = /\bfor example\b/i;
const PROCEDURES_AVAILABLE_RE = /following procedures are available/i;

// --- OCR-corruption repair: "list1"/"list2" arrive as any of "list1"/"listl"/"1istl"/"1ist1" (for
// list1) or "list2"/"1ist2" (for list2) -- the OCR pipeline flips 'l' <-> '1' independently at
// EITHER end of the word, inconsistently across the same document. A JS `\b[1l]ist([1l]|2)\b` match
// covers every combination actually observed (and every other combination this same flip could
// produce) without ever inventing a number: the leading `[1l]` accepts either character for the
// "l" that starts "list", and the trailing `([1l]|2)` accepts either character for a trailing "1"
// (list1) or the literal, un-confusable digit "2" (list2, which OCR has no reason to flip since
// there is no "list2"/"listZ" letter-confusion in play). A clean, uncorrupted question is byte-for-
// byte unaffected (every branch just re-normalizes to its own already-correct spelling). ---------

function normalizeListRefs(text: string): string {
  return text.replace(/\b[1l]ist([1l]|2)\b/gi, (_m, last: string) => (last === '2' ? 'list2' : 'list1'));
}

// --- Worked-example array extraction: split on top-level commas FIRST, then strip quote/whitespace
// characters off each piece INDEPENDENTLY -- this is what survives the missing-closing-quote
// corruption (see this file's header for the full character-level walkthrough). Never requires
// balanced quotes anywhere in the bracket content. -------------------------------------------------

function extractBracketedItems(text: string, fromIndex: number): string[] | null {
  const openIdx = text.indexOf('[', fromIndex);
  if (openIdx === -1) return null;
  const closeIdx = text.indexOf(']', openIdx);
  if (closeIdx === -1) return null;
  const inner = text.slice(openIdx + 1, closeIdx);
  const items = inner
    .split(',')
    .map((piece) => piece.replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, ''))
    .filter((piece) => piece.length > 0);
  return items;
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// --- Tiny recursive-descent parser for the narrow expression grammar this question class uses:
// IDENT | IDENT "(" EXPR ("," EXPR)* ")" -- e.g. "Sort(RemoveDuplicates(Combine(list1, list2)))".
// Deliberately minimal: no operators, no literals, nothing beyond identifiers and nested calls,
// because that is the ENTIRE grammar this question's own procedures use. Throws (never silently
// mis-parses) on anything outside that grammar -- the caller treats a throw as "this option cannot
// be verified" and abstains the whole question (see this file's header, conservatism point 2). ----

type Expr = { kind: 'call'; name: string; args: Expr[] } | { kind: 'ident'; name: string };

function splitTopLevelCommas(s: string): string[] {
  if (s.trim().length === 0) return [];
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  parts.push(cur);
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

function parseExpression(input: string): Expr {
  const trimmed = input.trim();
  const identMatch = /^([A-Za-z_]\w*)/.exec(trimmed);
  if (!identMatch || !identMatch[1]) throw new Error('pseudocode_trace: expected identifier in "' + input + '"');
  const name = identMatch[1];
  const rest = trimmed.slice(name.length).trimStart();
  if (rest.length === 0) {
    return { kind: 'ident', name };
  }
  if (rest[0] !== '(') {
    throw new Error('pseudocode_trace: unexpected trailing content after "' + name + '": "' + rest + '"');
  }
  let depth = 0;
  let closeIdx = -1;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '(') depth++;
    else if (rest[i] === ')') {
      depth--;
      if (depth === 0) {
        closeIdx = i;
        break;
      }
    }
  }
  if (closeIdx === -1) throw new Error('pseudocode_trace: unbalanced parentheses in "' + input + '"');
  const inner = rest.slice(1, closeIdx);
  const trailing = rest.slice(closeIdx + 1).trim();
  if (trailing.length > 0) throw new Error('pseudocode_trace: unexpected trailing content after call: "' + trailing + '"');
  const args = splitTopLevelCommas(inner).map((a) => parseExpression(a));
  return { kind: 'call', name, args };
}

// --- Procedure-name confusion-class normalization: the SAME digit/letter confusion class already
// handled for list names (list1/list2, see normalizeListRefs above) also corrupts procedure names
// in some real option code -- e.g. the real dataset's correct option spells the procedure
// "RemoveDup1icates" (DIGIT ONE substituted for the letter "l"). Canonicalize by folding the
// confusable characters '1'<->'l' and '0'<->'O' to a single spelling each, then require an EXACT
// match (after canonicalization) against a procedure name already proven present in THIS question's
// own procedure table (the `knownProcedures` set, built by the gate above from the question text
// itself, never from a hardcoded guess). This is deliberately narrow: it can only ever resolve a
// candidate identifier onto a name this exact question already declared, and only when the
// canonicalized spellings are byte-identical -- there is no loose/edit-distance matching that could
// silently map an unrelated identifier onto a known procedure. If no known name canonicalizes to the
// same form, resolution fails and the caller aborts the whole question (honest abstain), exactly as
// before this fix for a genuinely unimplemented procedure (e.g. "Shuffle"). ------------------------

function canonicalizeConfusables(name: string): string {
  return name.replace(/1/g, 'l').replace(/0/g, 'O');
}

function resolveProcedureName(rawName: string, knownProcedures: Set<string>): string | null {
  if (knownProcedures.has(rawName)) return rawName;
  const canonicalRaw = canonicalizeConfusables(rawName);
  for (const known of knownProcedures) {
    if (canonicalizeConfusables(known) === canonicalRaw) return known;
  }
  return null;
}

// --- Evaluator: the three primitives, derived directly from the question's own stated
// explanations (Sort/Combine/RemoveDuplicates). Any OTHER procedure name -- including one that fails
// confusion-class resolution against `knownProcedures` above -- throws: "if a procedure name appears
// that you do not implement (or cannot confidently resolve to one you do), ABSTAIN rather than
// guess" -- which propagates up through evaluateOption() to the per-option try/catch in
// solvePseudocodeTraceProblem(), aborting the whole question rather than guessing that option
// "doesn't match." -------------------------------------------------------------------------------

function evalExpr(e: Expr, env: Record<string, string[]>, knownProcedures: Set<string>): string[] {
  if (e.kind === 'ident') {
    if (Object.prototype.hasOwnProperty.call(env, e.name)) return env[e.name] as string[];
    throw new Error('pseudocode_trace: unknown identifier "' + e.name + '"');
  }
  const argVals = e.args.map((a) => evalExpr(a, env, knownProcedures));
  const resolvedName = resolveProcedureName(e.name, knownProcedures);
  if (!resolvedName) throw new Error('pseudocode_trace: unimplemented procedure "' + e.name + '"');
  switch (resolvedName) {
    case 'Sort': {
      // "Sorts list in alphabetical order and returns the resulting list."
      if (argVals.length !== 1) throw new Error('pseudocode_trace: Sort expects 1 argument, got ' + argVals.length);
      return [...(argVals[0] as string[])].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    }
    case 'Combine': {
      // "Creates a new list consisting of the entries from list1 followed by the entries from
      // list2. The resulting list is returned."
      if (argVals.length !== 2) throw new Error('pseudocode_trace: Combine expects 2 arguments, got ' + argVals.length);
      return [...(argVals[0] as string[]), ...(argVals[1] as string[])];
    }
    case 'RemoveDuplicates': {
      // "Iterates through list. If any two or more entries have the same value, the duplicate
      // entries are removed so that any entry appears at most once. The resulting list is
      // returned." -- keeps each value's FIRST occurrence, preserving relative order.
      if (argVals.length !== 1) throw new Error('pseudocode_trace: RemoveDuplicates expects 1 argument, got ' + argVals.length);
      const seen = new Set<string>();
      const out: string[] = [];
      for (const v of argVals[0] as string[]) {
        if (!seen.has(v)) {
          seen.add(v);
          out.push(v);
        }
      }
      return out;
    }
    default:
      throw new Error('pseudocode_trace: unimplemented procedure "' + e.name + '"');
  }
}

// --- Statement-sequence evaluation: handles BOTH a single expression (e.g.
// "Sort(RemoveDuplicates(Combine(list1, list2)))" or "newList <- Sort(...)") AND a multi-statement
// sequence ("temp <- Combine(list1, list2)\ntemp <- RemoveDuplicates(temp)\nnewList <- Sort(temp)"),
// separated by newlines and/or semicolons. The final statement's computed value is the option's
// result, regardless of what variable name it was assigned to (or whether it was assigned at all).

const ASSIGN_RE = /^([A-Za-z_]\w*)\s*(?:<-|:=|←|=)\s*(.+)$/;

function evaluateOption(code: string, env0: Record<string, string[]>, knownProcedures: Set<string>): string[] {
  const statements = code
    .split(/[\n;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (statements.length === 0) throw new Error('pseudocode_trace: empty code segment');

  const env: Record<string, string[]> = { ...env0 };
  let lastResult: string[] | null = null;
  for (const stmt of statements) {
    const m = ASSIGN_RE.exec(stmt);
    if (m && m[1] && m[2]) {
      const varName = m[1];
      const expr = parseExpression(m[2]);
      const val = evalExpr(expr, env, knownProcedures);
      env[varName] = val;
      lastResult = val;
    } else {
      const expr = parseExpression(stmt);
      lastResult = evalExpr(expr, env, knownProcedures);
    }
  }
  if (!lastResult) throw new Error('pseudocode_trace: no statement produced a result');
  return lastResult;
}

/** Top-level entry point. Pure, synchronous, no I/O. Returns null (never guesses) the moment any
 *  required piece (the code-segment ask, a Procedure/Explanation table naming ONLY procedures this
 *  module implements, a worked example whose list1/list2/expected-output all extract cleanly, or a
 *  clean parse+evaluate of EVERY MC option) is not confidently present, or the executed options do
 *  not match `expected` in EXACTLY ONE case. Derives strictly from `questionText` + `options` --
 *  never from an authority's/model's reasoning text. */
export function solvePseudocodeTraceProblem(
  questionText: string,
  options: McOption[],
): PseudocodeTraceSolverResult | null {
  if (!ASK_RE.test(questionText)) return null;
  if (!PROCEDURE_TABLE_RE.test(questionText)) return null;
  if (!WORKED_EXAMPLE_RE.test(questionText)) return null;

  const normalized = normalizeListRefs(questionText);

  // Belt: the procedure-table section must name EXACTLY the three procedures this module
  // implements -- an unrecognized name there is an honest null (never a silent under-
  // implementation), and a question defining fewer than all three is equally out of scope (this
  // module's three primitives are the whole point of the gate).
  const availIdx = normalized.search(PROCEDURES_AVAILABLE_RE);
  const askIdx = normalized.search(ASK_RE);
  if (availIdx === -1 || askIdx === -1 || askIdx <= availIdx) return null;
  const procSection = normalized.slice(availIdx, askIdx);
  const declared = new Set<string>();
  const declRe = /\b([A-Z][A-Za-z]*)\s*\(/g;
  let dm: RegExpExecArray | null;
  while ((dm = declRe.exec(procSection)) !== null) {
    if (dm[1]) declared.add(dm[1]);
  }
  for (const name of declared) {
    if (!KNOWN_PROCEDURES.has(name)) return null; // unimplemented procedure named -- abstain
  }
  for (const name of KNOWN_PROCEDURES) {
    if (!declared.has(name)) return null; // question doesn't define all three primitives we implement
  }

  const list1Idx = normalized.search(/\blist1\s+contains\b/i);
  if (list1Idx === -1) return null;
  const list1 = extractBracketedItems(normalized, list1Idx);
  if (!list1 || list1.length === 0) return null;

  const list2Idx = normalized.search(/\blist2\s+contains\b/i);
  if (list2Idx === -1) return null;
  const list2 = extractBracketedItems(normalized, list2Idx);
  if (!list2 || list2.length === 0) return null;

  const expectedIdx = normalized.search(/\bnewList\s+will\s+contain\b/i);
  if (expectedIdx === -1) return null;
  const expected = extractBracketedItems(normalized, expectedIdx);
  if (!expected || expected.length === 0) return null;

  if (options.length === 0) return null;

  const env0: Record<string, string[]> = { list1, list2 };
  const evaluated: Array<{ letter: string; result: string[] }> = [];
  for (const opt of options) {
    const code = normalizeListRefs(opt.text);
    let result: string[];
    try {
      result = evaluateOption(code, env0, declared);
    } catch {
      return null; // every option must parse+evaluate cleanly, else abstain (mirrors the aircraft solver)
    }
    evaluated.push({ letter: opt.letter, result });
  }

  const matches = evaluated.filter((e) => arraysEqual(e.result, expected));
  if (matches.length !== 1) return null;
  const matched = matches[0] as { letter: string; result: string[] };

  const trace =
    `pseudocode_trace: list1=${JSON.stringify(list1)} list2=${JSON.stringify(list2)} ` +
    `expected=${JSON.stringify(expected)} matchedOption=${matched.letter}=${JSON.stringify(matched.result)} ` +
    `evaluatedOptions=[${evaluated.map((e) => `${e.letter}:${JSON.stringify(e.result)}`).join(', ')}]`;

  return {
    letter: matched.letter,
    value: JSON.stringify(matched.result),
    optionValue: JSON.stringify(expected),
    provenance: 'deterministic_compute:pseudocode_trace',
    trace,
  };
}
