// orphan_catalog.ts -- D-BP152-018/BISHOP/seg-register-orphan-steps
//
// THE VERIFIED-ORPHAN CATALOG. Registers the elements/ exports that have ZERO live callers --
// direct OR transitive -- as of commit a7b89e84 (branch clean-shell-v0.9, repo
// C:\Users\Administrator\Documents\mnemosyne), per
// LianaBanyanPlatform\BISHOP_DROPZONE\LIANA_CYCLE_BENCH_SPEC.md section 9 item 1: "Register the
// 12 orphaned elements/ exports as invocable steps. Pure registration -- the code already
// exists, correct and tested. No new logic."
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// CORRECTED COUNT: 6 verified orphans, not 12.
//
// The dispatch's source inventory
// (BISHOP_DROPZONE\SEG_RETURN_BP152_010C_VOCAB_ELEMENTS.md) named 12 elements/ exports as
// "zero live callers", using the literal test "no external file imports this symbol by name".
// The dispatch itself flagged one pair (field_gate.ts's `askFields`/`computeThemeCohesion`) as
// possibly mis-scored by that test, since both run every time the LIVE `fieldGate()` executes --
// "reachable transitively" is not the same thing as "never runs". Applying that SAME correction
// consistently to all 12 (not only the pair the dispatch named) using the SEG return's own
// per-entry evidence:
//
//   NOT ORPHANS -- reached by a live caller, just not a DIRECTLY-imported one. These 6 execute
//   on every real question today; they are simply not each independently reusable as a
//   standalone Library step without their wrapping function's context, so they are NOT
//   registered in this catalog:
//     - answer_key_guard.ts: isNearVerbatimOptionMatch, nearVerbatimNeedle,
//       MIN_NEAR_VERBATIM_CHARS, ANSWER_KEY_MARKERS -- all run every time the LIVE
//       findAnswerKeyMarker()/findNearVerbatimOptionMatch() run (survey_ask.ts:203,239, itself
//       live via definitional_cascade.ts/survey_answers.ts/survey_stage.ts).
//     - field_gate.ts: askFields, computeThemeCohesion -- both run every time the LIVE
//       fieldGate() runs (definitional_cascade.ts:274, survey_stage.ts:1375).
//
//   TRUE ORPHANS -- no live path reaches these AT ALL, direct or transitive. These 6 are what
//   this catalog registers:
//     - aspect_tag.ts: eliminateByAspect (zero callers anywhere, external or internal) and
//       partitionByAspect (its ONLY caller is eliminateByAspect, which itself never runs, so
//       partitionByAspect never runs either).
//     - kind_check.ts: checkKindForAllOptions (zero callers anywhere -- unlike its sibling
//       checkKind(), it was never rescued when survey_stage.ts wired this file in).
//     - substitution_search.ts: SERVED_DEMANDS, formSubstitutionQueries,
//       formSubstitutionQueriesForAllOptions -- the entire 403-line file. Zero external callers;
//       survey_stage.ts's own comments (:214, :1621) call it dead in as many words. Registering
//       this dead-but-correct code is the point of this ticket; registration does not make it
//       run, and nothing in this catalog wires it into any run path.
//
// Verification method for every entry below, repeated fresh for this ticket (not copied from
// the prior SEG return without re-checking): `grep -rn "<exportName>" --include="*.ts" src/`
// (node_modules excluded) from the repo root, corroborated by reading the actual
// `import { ... } from` statement of every file the grep surfaced, to confirm by name which
// exports are and are not actually pulled in. Full per-entry search transcript:
//   LianaBanyanPlatform\BISHOP_DROPZONE\SEG_RETURN_BP152_018_ORPHAN_REGISTRY.md
// ─────────────────────────────────────────────────────────────────────────────────────────────
//
// INERT BY DESIGN, PER THIS TICKET'S HARD BOUNDARY ("Nothing is invoked... no wiring into any
// run path"). This module imports NOTHING from elements/. Every field on every entry below is a
// string, number, or plain-object description written by hand from reading the source -- there
// is no live function reference to eliminateByAspect, partitionByAspect,
// checkKindForAllOptions, SERVED_DEMANDS, formSubstitutionQueries, or
// formSubstitutionQueriesForAllOptions anywhere in this file, and importing this module cannot
// execute any of them (see orphan_catalog.test.ts, which asserts exactly that). Making a
// declared step actually callable is spec item 12, BLOCKED on the Founder's HARDWIRE-22
// "typed" ruling, and is not attempted here.
//
// Nothing in src/main/liana_cycle/elements/, src/main/liana_cycle/survey_stage.ts,
// src/main/liana_cycle/demand_test.ts, or src/main/liana_cycle/methods/ is imported, read, or
// modified by this file.

import type { StepDeclaration } from './step_declaration';

export const ORPHAN_STEP_CATALOG: StepDeclaration[] = [
  // ── aspect_tag.ts ──────────────────────────────────────────────────────────────────────────
  {
    id: 'elements.aspect_tag.partitionByAspect',
    version: '1',
    sourceFile: 'src/main/liana_cycle/elements/aspect_tag.ts',
    sourceLine: 100,
    exportName: 'partitionByAspect',
    exportKind: 'function',
    whatItDoes:
      'Runs tagAspect() over every option in a letter-to-text map, groups the letters by the '
      + 'resulting aspect (PROCESS/ATTEMPT/RESULT/NOMINAL), and sets discriminates=true iff more '
      + 'than one aspect group exists.',
    inputs: 'options: Record<string,string> (letter -> option text); sharedFrame?: RegExp (an optional leading-frame stripper, e.g. /^It describes\\s+(.*)$/i).',
    outputs: 'AspectPartition { tags: Record<letter,AspectTag>, groups: Record<aspect,letter[]>, discriminates: boolean }.',
    decidesOrReports: 'REPORTS',
    queryText: { issuesQuery: false, description: null, loadedFromQueryResource: false },
    attribution: {
      kind: 'NO_DECISION_RULE',
      why:
        'Pure partition -- it groups and reports whether the groups differ, but eliminates '
        + 'nothing itself; no branch here changes which answer a caller ends up with. The '
        + 'per-option classification it groups by (tagAspect()) carries its own attribution in '
        + 'aspect_tag.ts:7-10 (Founder, BP150, verbatim, quoted in that file\'s header) -- this '
        + 'function does not re-derive or add to that rule, it only tallies its output.',
    },
    orphanEvidence:
      'grep -rn "partitionByAspect" --include="*.ts" src/ (node_modules excluded) returns exactly '
      + '2 hits, both inside aspect_tag.ts itself: the definition (:100) and one call site (:134), '
      + 'which is inside eliminateByAspect(), itself uncalled from anywhere (see that entry below). '
      + 'Corroborated by reading the import lines of the two files that DO import from '
      + 'aspect_tag.ts (survey_ask.ts:60, survey_answers.ts:48) -- both import only '
      + '{ tagAspect, type AspectTag }, neither imports partitionByAspect.',
  },
  {
    id: 'elements.aspect_tag.eliminateByAspect',
    version: '1',
    sourceFile: 'src/main/liana_cycle/elements/aspect_tag.ts',
    sourceLine: 128,
    exportName: 'eliminateByAspect',
    exportKind: 'function',
    whatItDoes:
      'Calls partitionByAspect(), then narrows the option set to the group matching askAspect '
      + 'only when askAspect is non-null AND the partition discriminates AND that group is '
      + 'non-empty; on any of the three unmet, it returns every option unchanged with a stated '
      + 'refusal reason rather than falling back to a majority vote.',
    inputs: 'options: Record<string,string>; askAspect: LianaAspect | null (the ASK\'s own aspect, sourced from Survey); sharedFrame?: RegExp.',
    outputs: 'AspectElimination { survivors: string[], eliminated: string[], reason: string, eliminated_any: boolean }.',
    decidesOrReports: 'DECIDES_AND_REFUSES',
    queryText: { issuesQuery: false, description: null, loadedFromQueryResource: false },
    attribution: {
      kind: 'ATTRIBUTED',
      founderRuling: 'BP150',
      quote:
        'Saying \'a process that results in\' and \'is a non-representative sample\' is NOT the '
        + 'same thing. Just like synonyms are NOT the same thing - just similar, and it is that '
        + 'quality that makes the difference between \'similar\' and \'same\' that we get '
        + 'granular on, so we can mechanically PROVE a conclusion.',
      citedAt: 'src/main/liana_cycle/elements/aspect_tag.ts:7-10',
    },
    orphanEvidence:
      'grep -rn "eliminateByAspect" --include="*.ts" src/ (node_modules excluded) returns exactly '
      + '3 hits, ALL inside aspect_tag.ts itself: a header-comment mention (:35), the definition '
      + '(:128), and its own internal call to partitionByAspect (:134, a call FROM '
      + 'eliminateByAspect, not TO it). Corroborated by reading the import lines of both files '
      + 'that import anything from aspect_tag.ts (survey_ask.ts:60, survey_answers.ts:48) -- both '
      + 'import only { tagAspect, type AspectTag }; neither imports eliminateByAspect. This is '
      + 'the acting half of the 5K Rule: fully built, safety-reasoned (Canon F-6, measured 15/140 '
      + 'bundled questions where a majority-keep fallback discards the correct answer), and never '
      + 'called by anything.',
  },

  // ── kind_check.ts ──────────────────────────────────────────────────────────────────────────
  {
    id: 'elements.kind_check.checkKindForAllOptions',
    version: '1',
    sourceFile: 'src/main/liana_cycle/elements/kind_check.ts',
    sourceLine: 235,
    exportName: 'checkKindForAllOptions',
    exportKind: 'function',
    whatItDoes:
      'Loops checkKind() once per option in a letter-to-text map and returns the per-letter '
      + 'results; adds no classification logic beyond what checkKind() itself does.',
    inputs: 'options: Record<string,string> (letter -> option text).',
    outputs: 'Record<string, KindCheckResult> (letter -> the six-way kind classification, or a stated refusal, per option).',
    decidesOrReports: 'DECIDES',
    queryText: { issuesQuery: false, description: null, loadedFromQueryResource: false },
    attribution: {
      kind: 'ATTRIBUTED',
      founderRuling: 'BP150',
      quote:
        'We need a test to see if a result from applying a method to a question results in '
        + 'something nonsensical or not. ... yes a kind-check. FIRST, which is the same '
        + 'principle of the Survey steps.',
      citedAt: 'src/main/liana_cycle/elements/kind_check.ts:6-8',
    },
    orphanEvidence:
      'grep -rn "checkKindForAllOptions" --include="*.ts" src/ (node_modules excluded) returns '
      + 'exactly 2 hits: the definition (kind_check.ts:235) and one PAST-TENSE COMMENT in '
      + 'survey_stage.ts:213 explicitly naming it dead ("checkKind/checkKindForAllOptions were '
      + 'dead: only reachable through survey_answers.ts itself and the dead half of '
      + 'substitution_search.ts"). Corroborated by reading survey_answers.ts and '
      + 'substitution_search.ts (the two files the comment names) directly at every checkKind '
      + 'occurrence -- both call the singular checkKind(...) (survey_answers.ts:126, '
      + 'substitution_search.ts:298), neither calls the plural checkKindForAllOptions. Unlike '
      + 'checkKind, which survey_stage.ts rescued into live status, checkKindForAllOptions was '
      + 'not.',
  },

  // ── substitution_search.ts (entire file is dead) ──────────────────────────────────────────
  {
    id: 'elements.substitution_search.SERVED_DEMANDS',
    version: '1',
    sourceFile: 'src/main/liana_cycle/elements/substitution_search.ts',
    sourceLine: 131,
    exportName: 'SERVED_DEMANDS',
    exportKind: 'const',
    whatItDoes:
      'A two-element array declaring the only two LianaDemand values (DEFINE, '
      + 'LOCATE-IN-FRAMEWORK) this file\'s substitution logic is willing to run for; used as the '
      + 'first gate in formSubstitutionQueries().',
    inputs: 'N/A -- module-level constant, not a function.',
    outputs: "LianaDemand[] = ['DEFINE', 'LOCATE-IN-FRAMEWORK'].",
    decidesOrReports: 'DECIDES',
    queryText: { issuesQuery: false, description: null, loadedFromQueryResource: false },
    attribution: {
      kind: 'TARE',
      note:
        'No "Founder, BP<NNN>, verbatim:" quote is recorded at this site. The file\'s own '
        + 'D-BP150-012 FIX 2(b) comment (substitution_search.ts:125-131) explains the reasoning '
        + '("there is no term being defined for RANK/CLASSIFY/IDENTIFY/INFER") as Bishop\'s own '
        + 'engineering derivation from a measured qid-92 defect, not as a Founder instruction '
        + 'restricting substitution to exactly these two demands. Surfaced 2026-08-10, awaiting '
        + 'Founder ruling. This catalog entry does not rely on the rule or change it -- it only '
        + 'reports the attribution gap the source file itself leaves unmarked.',
    },
    orphanEvidence:
      'grep -rn "SERVED_DEMANDS" --include="*.ts" src/ (node_modules excluded) returns hits only '
      + 'inside substitution_search.ts itself (definition :131, three internal uses :227,229,254). '
      + 'A second targeted search for `from [\'"].*substitution_search[\'"]` (any import statement '
      + 'anywhere in the repo referencing this file) returns zero matches -- no file imports from '
      + 'substitution_search.ts at all, so this exported const, like every other export in the '
      + 'file, has zero external callers.',
  },
  {
    id: 'elements.substitution_search.formSubstitutionQueries',
    version: '1',
    sourceFile: 'src/main/liana_cycle/elements/substitution_search.ts',
    sourceLine: 210,
    exportName: 'formSubstitutionQueries',
    exportKind: 'function',
    whatItDoes:
      'For one option, runs a demand gate (SERVED_DEMANDS) then a term-derivation gate '
      + '(findAskCatalyst(), or an explicit override) then checkKind() on the option, and on a '
      + 'THING forms three Google query strings (assertion/inverted/direct) from the Founder\'s '
      + 'own verbatim templates, or one corroboration query for a PROPOSITION/ABSENCE-CLAIM, or '
      + 'refuses (queries: []) for any other kind or gate failure -- never sending anything itself.',
    inputs: 'question: string; demand: LianaDemand | null; option: string; explicitTerm?: string.',
    outputs:
      'SubstitutionResult { term, frame, kind, status: substituted|corroboration|refused, gate: '
      + 'demand|term|kind, formed_any: boolean, queries: SubstitutionQuery[], why, ... } -- always '
      + 'a populated why on every return path.',
    decidesOrReports: 'DECIDES_AND_REFUSES',
    queryText: {
      issuesQuery: true,
      description:
        'Forms, but never sends, up to 3 query strings per option: assertion '
        + '"Within <Frame>, <option> is <term>." (or "<option> is <term>." with no frame), '
        + 'inverted "<option> are <term> within what studies?" (or "<option> are <term>." with no '
        + 'frame), direct "What is <term> within <frame, lowercased>?" (or "What is <term>?" with '
        + 'no frame); or, for a PROPOSITION/ABSENCE-CLAIM option, one corroboration query '
        + '"Within <Frame>, is there <term>?" (or "Is there <term>?" with no frame). Templates are '
        + 'the Founder\'s own verbatim wording, quoted in the file header (substitution_search.ts:6-14).',
      loadedFromQueryResource: false,
    },
    attribution: {
      kind: 'ATTRIBUTED',
      founderRuling: 'BP150',
      quote:
        'Then we\'ll do the substitution of each answer (after each answer\'s survey of their '
        + 'own) and plug in to what the resultant sentence would be, not simply substitution, '
        + 'which wouldn\'t work in the limited way we trade one for one in the current '
        + 'substitution. Instead, new sentences are formed which need to be evaluated based on '
        + 'searches to see if they are true, like this for A: Search google for: "Within Critical '
        + 'Security Studies, Technological systems is the referent object of security." And '
        + '"Technological systems are the referent object of security within what studies?" And '
        + '"What is the referent object of security within critical security studies?" But do '
        + 'that for all of the answers, after the Answers Survey for each.',
      citedAt: 'src/main/liana_cycle/elements/substitution_search.ts:6-14',
    },
    orphanEvidence:
      'A repo-wide text search for the literal string "substitution_search" (covering both '
      + 'identifier calls and any import path) turns up matches only inside '
      + 'substitution_search.ts itself, plus three PAST-TENSE comment references in survey_stage.ts '
      + '(:214, :234, :1621) that explicitly call it dead: "only substitution_search.ts, itself '
      + 'dead, called it" (survey_stage.ts:1621). A second, separate search specifically for '
      + '`from [\'"].*substitution_search[\'"]` (any import statement anywhere in the repo) '
      + 'returns zero matches -- confirmed no file anywhere imports from this file.',
  },
  {
    id: 'elements.substitution_search.formSubstitutionQueriesForAllOptions',
    version: '1',
    sourceFile: 'src/main/liana_cycle/elements/substitution_search.ts',
    sourceLine: 392,
    exportName: 'formSubstitutionQueriesForAllOptions',
    exportKind: 'function',
    whatItDoes:
      'Loops formSubstitutionQueries() once per option in a letter-to-text map; adds no logic '
      + 'of its own beyond the loop.',
    inputs: 'question: string; demand: LianaDemand | null; options: Record<string,string>; explicitTerm?: string.',
    outputs: 'Record<string, SubstitutionResult> (letter -> that option\'s SubstitutionResult).',
    decidesOrReports: 'DECIDES_AND_REFUSES',
    queryText: {
      issuesQuery: true,
      description: 'Same query templates as formSubstitutionQueries(), formed once per option.',
      loadedFromQueryResource: false,
    },
    attribution: {
      kind: 'ATTRIBUTED',
      founderRuling: 'BP150',
      quote:
        'But do that for all of the answers, after the Answers Survey for each.',
      citedAt: 'src/main/liana_cycle/elements/substitution_search.ts:13-14',
    },
    orphanEvidence:
      'grep -rn "formSubstitutionQueriesForAllOptions" --include="*.ts" src/ (node_modules '
      + 'excluded) returns exactly ONE hit: its own definition (:392). Not even '
      + 'substitution_search.ts\'s own dead sibling functions call it -- it is the single most '
      + 'isolated export in the directory. Corroborated by the same whole-file '
      + '"substitution_search" and import-statement searches recorded on the '
      + 'formSubstitutionQueries entry above, which cover this export too.',
  },
];

/** Returns a fresh copy of the catalog -- callers cannot mutate the module-level array by
 *  reference. Reading this list does not invoke, import, or otherwise touch any of the 6
 *  functions/consts it describes. */
export function listOrphanSteps(): StepDeclaration[] {
  return ORPHAN_STEP_CATALOG.slice();
}
