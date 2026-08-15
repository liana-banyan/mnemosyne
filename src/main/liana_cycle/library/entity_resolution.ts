// entity_resolution.ts -- D-BP154-047/BISHOP-SEG/S47/seg-lawten
//
// THE ONE SHARED ENTITY-RESOLUTION FUNCTION. Founder: "fix law 10 across every step." This defect
// class has fired FIVE times in one session: macro-realms vs "Macro-Geographic Regions (Realms)",
// compound kind phrasing, the "B) " list prefix, "Northern Africa" vs "North Africa", and frame
// mismatches between steps. ONE function, called by every step that matches an extracted name to
// a lettered option -- not six copies (this estate already has duplicate-implementation problems
// and must not gain another, per this ticket's own dispatch).
//
// RESOLVES BY STATED IDENTIFIER, NEVER BY SIMILARITY (HARDWIRE-22; canon BP153: "ask a local model
// to copy, never to decide"). Four mechanical steps, tried in order, EVERY ONE OF THEM reading
// only what the passage/name itself already states -- never a synonym table, never a similarity
// score, never a model asked whether two labels mean the same thing:
//
//   1. EXACT match -- comparative_cascade.ts's own toLetters(), case/whitespace-fold only.
//   2. LIST-LETTER PREFIX STRIP -- a leading "<letter>) " token the SOURCE'S OWN list()-formatting
//      put there (D-BP154-015), never a new equivalence.
//   3. STATED PARENTHETICAL/BRACKETED ANNOTATION -- the source's OWN annotation ("Northern Africa
//      (M49 015)", "Central Asia [a grouping]") is stripped and the BASE name retried. If the
//      caller supplies `knownCodes` (a letter->code map ESTABLISHED THIS RUN from the caller's own
//      stated evidence -- e.g. a density fact's own "(M49 015)" span -- never invented here), a
//      code found inside the annotation is matched against it: copying a bridge the source itself
//      supplied is extraction; inventing one is judgment. Failing that, the ANNOTATION's own text
//      is tried as an alternate name (a source stating "Northern Africa (also called North
//      Africa)" is providing the alias itself, not this function inventing one).
//   4. SINGULAR/PLURAL FOLD -- a single trailing "s", the same class of mechanical case/whitespace
//      operation toLetters() itself already performs, applied identically regardless of which word
//      is involved, tried on both the extracted name and each option's own text.
//
// A name that resolves via NONE of the above is UNSTATED -- never a match, never a denial (absence
// is omission, FD-BP153-07). Every call is counted by its caller (resolved/unresolved), so a
// matcher failing silently shows up as a pile of UNSTATED, not as confident eliminations.
//
// classify_cascade.ts is FORBIDDEN and was not read to build this file.

import { appearsIn, toLetters } from '../methods/comparative_cascade';

export type EntityResolutionMethod = 'exact' | 'list-prefix-stripped' | 'stated-code' | 'stated-alias' | 'plural-fold';

export interface EntityResolutionResult {
  letter: string | null;
  method: EntityResolutionMethod | 'unstated';
}

/** D-BP154-015's own fix, centralized here (was duplicated per-file; law 11's own sweep finding). */
function stripListLetterPrefix(name: string): string {
  return name.replace(/^[A-Za-z]\)\s*/, '');
}

/** Splits a trailing "(...)" or "[...]" annotation off a name -- the source's OWN punctuation,
 *  never invented. Returns the base with the annotation removed, and the annotation's own inner
 *  text (or null when there is none). */
function splitTrailingAnnotation(name: string): { base: string; annotation: string | null } {
  const m = name.match(/^(.*?)\s*[([]([^)\]]*)[)\]]\s*$/);
  if (!m) return { base: name, annotation: null };
  return { base: m[1].trim(), annotation: m[2].trim() };
}

function foldTrailingS(s: string): string {
  return s.endsWith('s') && !s.endsWith('ss') ? s.slice(0, -1) : s;
}

/** THE ONE SHARED RESOLVER. `knownCodes`, optional: a letter->code map the CALLER already
 *  established this run from its OWN stated evidence (never invented here) -- e.g. a density
 *  eblet's own recorded "M49 015" per option. When the name's own annotation contains a token
 *  matching one of those codes, that IS a stated bridge (generalizes FD-BP154-044/045's own
 *  "match on the M49 code"). */
export function resolveNameToOption(
  name: unknown,
  OPT: Record<string, string>,
  knownCodes?: Record<string, string>,
): EntityResolutionResult {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) return { letter: null, method: 'unstated' };

  // 1. EXACT.
  let m = toLetters([trimmed], OPT);
  if (m.length > 0) return { letter: m[0], method: 'exact' };

  // 2. LIST-LETTER PREFIX STRIP.
  const stripped = stripListLetterPrefix(trimmed);
  if (stripped !== trimmed) {
    m = toLetters([stripped], OPT);
    if (m.length > 0) return { letter: m[0], method: 'list-prefix-stripped' };
  }

  // 3. STATED PARENTHETICAL/BRACKETED ANNOTATION -- code, then alias.
  const { base, annotation } = splitTrailingAnnotation(stripped);
  if (annotation !== null) {
    if (knownCodes) {
      for (const [L, code] of Object.entries(knownCodes)) {
        if (code && code.trim() && annotation.includes(code.trim())) return { letter: L, method: 'stated-code' };
      }
    }
    if (base && base !== stripped) {
      m = toLetters([base], OPT);
      if (m.length > 0) return { letter: m[0], method: 'stated-alias' };
    }
    // The annotation is often a PHRASE ("officially Zorvexia"), not a bare name -- appearsIn()
    // (comparative_cascade.ts, already established throughout this estate) is literal, mechanical
    // substring containment, never a similarity score. Each option's own text is checked in turn;
    // an annotation containing more than one option's name is never a candidate (ambiguous is not
    // a stated bridge).
    const containedIn = Object.entries(OPT).filter(([, optText]) => appearsIn(annotation, optText));
    if (containedIn.length === 1) return { letter: containedIn[0][0], method: 'stated-alias' };
  }

  // 4. SINGULAR/PLURAL FOLD -- tried on the (annotation-stripped) name, and symmetrically on each
  //    option's own text, so either side carrying the trailing "s" resolves the same way.
  const core = base || stripped;
  const foldedCore = foldTrailingS(core);
  m = toLetters([foldedCore], OPT);
  if (m.length > 0) return { letter: m[0], method: 'plural-fold' };
  const normCore = core.toLowerCase().trim();
  for (const [L, optName] of Object.entries(OPT)) {
    if (foldTrailingS(optName.toLowerCase().trim()) === foldTrailingS(normCore)) {
      return { letter: L, method: 'plural-fold' };
    }
  }

  return { letter: null, method: 'unstated' };
}
