// boundary_step.ts -- D-BP154-053/BISHOP-SEG/S52/seg-wiregate PART 1 CONTINUATION, REWRITTEN D-BP154-058
//
// 'BoundaryStability:1' -- THE COMPARABILITY DISCRIMINATOR THE FOUNDER'S OWN SOURCED PROOF NAMES
// (PROOF_QID98_TEST_AWARE_ELIMINATION_BP154.md section 4). Founder, D-BP154-058, verbatim: "M49 has
// different standards for the borders for central asia but not for south america, then what i put
// in that last proof paper IS the standard." The discriminator is NOT "does an M49 code exist" (all
// three -- South America 005, Northern Africa 015, Central Asia 143 -- have one). THE DISCRIMINATOR
// IS: how many MATERIALLY DIFFERENT definitions does this label carry in actual world-regional
// usage, and does the item specify which one?
//
//   South America  -- one meaning; no competing memberships. Boundary effectively settled by usage.
//   North Africa   -- maps to one named statistical aggregate, Northern Africa (M49 015). A name
//                     variant, not a rival membership.
//   Central Asia   -- materially variable: the five former Soviet republics, OR Turkestan, OR a
//                     broader area including Afghanistan, OR other historical/cultural definitions.
//                     M49 supplies ONE of several, and the item does not invoke it, so it cannot be
//                     silently imposed.
//
// D-BP154-055's original "is the boundary STABLE or VARIABLE" question was a JUDGEMENT -- loose
// enough that a live run called 6 of 9 options variable (Europe's eastern edge, North Africa's
// Sudan/Western-Sahara question, etc. all read as "vary" under a bare stability judgement), which
// correctly tripped checkUniformPredicate() as non-discriminating. THE FIX, D-BP154-058: ask an
// ENUMERABLE question, not a judgement -- does the term carry TWO OR MORE NAMED, materially
// different definitions in standard usage? THE DISPOSITION RULE: an option is a NOT_COMPARABLE
// candidate ONLY when the source ENUMERATES two or more materially different definitions for it AND
// the item does not specify which one. A bare "it varies" (classification stated, but no named
// rival definitions) is UNSTATED on this factor, never eliminated -- exactly the "our own matcher
// failing to find it is not a stated exclusion" law this whole file's sibling steps already apply,
// generalized here to "a claim of variability without named rivals is not evidence of variability."
//
// THIS IS A COMPARABILITY DECISION, NEVER A FACTUAL DENIAL (spec's own words): "not a claim that
// Central Asia is not a region or lacks inhabitants." disposition NOT_COMPARABLE
// (comparability_gate.ts's own exclusion-reason taxonomy), never OUT_OF_FRAME and never a claim
// about population. Justified by the modifiable areal unit problem (MAUP, PMC7151983/Esri, S4 of
// SOURCES_BP154_SPECS.md).
//
// BUILT LINE FOR LINE ON unitary_step.ts'S OWN SHAPE (same query-then-verify-then-corroborate
// pipeline, same owned-evidence-first/conversational-answers/document-corroborates ordering,
// FD-BP153-04 + FD-BP154-02) -- a separate, self-contained file, the same "steps stay
// self-contained" convention every sibling Composer step follows. classify_cascade.ts is FORBIDDEN
// and was not read to build this file.
//
// NO RULE HERE MAY SELECT A PARTICULAR LETTER (FD-BP153-06) -- every option is adjudicated
// identically; whether the rule turns out to distinguish Central Asia from its peers is decided by
// terminator_step.ts's own checkBoundaryStabilityUniformity() (checkUniformPredicate(), live),
// never assumed by this file. `BoundaryResult.unstable`/`confirmedStable`'s own SHAPE
// ({letter,name,span}) is UNCHANGED from D-BP154-053/055/057 -- terminator_step.ts's own
// buildBoundaryCandidates()/checkBoundaryStabilityUniformity() read only those three fields and
// need no changes for this rewrite; only the EVIDENCE REQUIRED to populate `unstable` changed (an
// enumerated rival-definitions list, not a bare adjective).

import {
  appearsIn, gemmaExtract, list, toLetters,
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
import { resolveNameToOption } from './entity_resolution';
// D-BP154-058 PART 5, ADDITIVE, TYPE + VALUE. targetClassFrameContext() reads only
// TargetClass:1's own already-verified `members`/`targetClass` -- never invents a frame.
import { targetClassFrameContext } from './target_class_step';
import type { TargetClassResult } from './target_class_step';

// ───────────────────── pure parts (unit-testable without a live Ollama/browser) ─────────────────────

/** THE ONE QUERY, per-option adjudication (same "answer for every one, in order, do not skip any"
 *  shape D-BP154-045 FIX 1 proved on this machine for Unitary:1). D-BP154-058, REWRITTEN: asks
 *  whether the term carries MORE THAN ONE materially different definition -- an ENUMERABLE
 *  question -- rather than D-BP154-055's own "is the boundary stable" JUDGEMENT, which a live run
 *  answered loosely enough to call 6 of 9 options variable. Keeps D-BP154-055's own format
 *  compliance guard (explicit prohibition on a single best-answer paragraph, explicit line format)
 *  -- that fix is unrelated to the judgement-vs-enumeration defect and remains necessary on its own
 *  merits. */
export function buildBoundaryQuery(all: string[], OPT: Record<string, string>, frameContext = ''): string {
  return `${frameContext}For EACH of the following, state whether the term has MORE THAN ONE materially different `
    + 'definition in standard world-regional usage -- competing definitions that name different, '
    + 'non-overlapping sets of members or a different geographic extent for the SAME term -- and if '
    + 'so, LIST the competing definitions by name. If the term has ONE settled, consistently-used '
    + 'meaning instead, say so. Answer for every one, in order, and do not skip any -- classify '
    + 'every option below, not only the ones you are most confident about. Do NOT answer any other '
    + 'question and do NOT give a single overall best-answer paragraph -- give exactly one '
    + 'classification per option, in the format "<letter>) <name>: SINGLE DEFINITION because '
    + '<reason>" or "<letter>) <name>: MULTIPLE DEFINITIONS -- 1) <definition one>; 2) <definition '
    + `two>; ...", one line for each of the nine options in order. ${list(all, OPT)}`;
}

export interface BoundaryUnstableOption {
  letter: string;
  name: string;
  /** Verbatim span proving the source itself stated this option's classification (single meaning,
   *  or multiple materially different definitions), including the option's own label (D-BP154-057
   *  Blocker 1 fix). */
  span: string;
  /** D-BP154-058, ADDITIVE/OPTIONAL. Populated ONLY on entries in `unstable` (never on
   *  `confirmedStable`): the named rival definitions the source itself enumerated (e.g. "the five
   *  former Soviet republics", "Turkestan", "a broader area including Afghanistan") -- never
   *  invented by this file. Undefined on every pre-existing consumer that does not read it
   *  (terminator_step.ts's own buildBoundaryCandidates() needs only letter/name/span). */
  definitions?: string[];
}

export function buildBoundaryCorroborationQuery(entry: BoundaryUnstableOption): string {
  return `Does ${entry.name} have one settled, consistently-used definition in standard `
    + 'world-regional usage, or does it carry more than one materially different, named '
    + 'definition? If more than one, name them. Answer plainly and directly.';
}

type RawBoundaryClassification = { name?: unknown; classification?: unknown; span?: unknown; definitions?: unknown };

/** THE VERIFY-THE-SPAN CHOKE POINT (FD-BP153-07 FIX 2), same four-part discipline every sibling
 *  step's own verify function applies, PLUS a fifth, D-BP154-058's own rule: a "multiple" claim is
 *  kept as a NOT_COMPARABLE candidate (`unstable`) ONLY when the source itself named at least TWO
 *  distinct rival definitions -- Founder's own words, this dispatch: "A bare 'it varies' is NOT
 *  sufficient -- that is the judgement that produced 6 of 9. The source must name the rival
 *  definitions. If it cannot enumerate them, the option is UNSTATED on this factor, not
 *  eliminated." A "multiple" claim with fewer than two named definitions lands in
 *  `insufficientEnumeration` -- reported for transparency, never folded into `unstable`, never
 *  treated as UNSTATED-and-silent either (the source DID say something, just not enough of it). */
export function verifyBoundaryClassifications(
  raw: unknown,
  passage: string,
  OPT: Record<string, string>,
): {
  unstable: BoundaryUnstableOption[]; confirmedStable: BoundaryUnstableOption[];
  insufficientEnumeration: BoundaryUnstableOption[]; discarded: number;
} {
  const entries = Array.isArray(raw) ? (raw as RawBoundaryClassification[]) : [];
  const unstable: BoundaryUnstableOption[] = [];
  const confirmedStable: BoundaryUnstableOption[] = [];
  const insufficientEnumeration: BoundaryUnstableOption[] = [];
  const seenUnstable = new Set<string>();
  const seenStable = new Set<string>();
  const seenInsufficient = new Set<string>();
  let discarded = 0;
  for (const entry of entries) {
    const name = typeof entry?.name === 'string' ? entry.name.trim() : '';
    const classification = typeof entry?.classification === 'string' ? entry.classification.trim().toLowerCase() : '';
    const span = typeof entry?.span === 'string' ? entry.span.trim() : '';
    if (!name) continue; // nothing named -- not a candidate value, not a discard
    if (classification !== 'single' && classification !== 'multiple') continue; // no usable classification -- UNSTATED, not a discard
    // THE ONE SHARED RESOLVER (entity_resolution.ts, D-BP154-052).
    const { letter: L } = resolveNameToOption(name, OPT);
    if (!L) continue; // names no known option -- not a candidate value here
    if (!span || !spanIsVerbatimInPassage(passage, span) || !appearsIn(span, OPT[L])) {
      discarded++;
      continue;
    }
    if (classification === 'multiple') {
      const rawDefs = Array.isArray(entry.definitions) ? entry.definitions : [];
      const namedDefs = rawDefs.filter((d): d is string => typeof d === 'string' && d.trim().length > 0).map((d) => d.trim());
      // Deduplicate case/whitespace-insensitively -- a source that names the same rival twice under
      // slightly different wording is not naming a SECOND rival (mechanical fold only, HARDWIRE-22).
      const uniqueDefs: string[] = [];
      const seenDef = new Set<string>();
      for (const d of namedDefs) {
        const key = d.toLowerCase().replace(/\s+/g, ' ').trim();
        if (seenDef.has(key)) continue;
        seenDef.add(key);
        uniqueDefs.push(d);
      }
      if (uniqueDefs.length < 2) {
        if (seenInsufficient.has(L)) continue;
        seenInsufficient.add(L);
        insufficientEnumeration.push({ letter: L, name: OPT[L], span });
        continue;
      }
      if (seenUnstable.has(L)) continue;
      seenUnstable.add(L);
      unstable.push({
        letter: L, name: OPT[L], span, definitions: uniqueDefs,
      });
    } else {
      if (seenStable.has(L)) continue;
      seenStable.add(L);
      confirmedStable.push({ letter: L, name: OPT[L], span });
    }
  }
  return {
    unstable, confirmedStable, insufficientEnumeration, discarded,
  };
}

export interface BoundaryResult {
  ok: boolean;
  query: string | null;
  /** Options a source explicitly enumerated TWO OR MORE named, materially different definitions
   *  for -- NOT automatically eliminated by this file (this step never decides eligibility on its
   *  own, FD-BP153-06); terminator_step.ts's own checkBoundaryStabilityUniformity() decides, live,
   *  whether this rule may fold into `eliminated` this run. */
  unstable: BoundaryUnstableOption[];
  /** Options the source explicitly classified as having ONE settled definition -- reported for
   *  transparency and used as same-relevant-type peers in the uniformity check, never eliminated or
   *  confirmed a member on their own. */
  confirmedStable: BoundaryUnstableOption[];
  /** D-BP154-058, ADDITIVE. Options a source classified "multiple" but named FEWER THAN TWO rival
   *  definitions for -- a bare "it varies" claim. Reported, never eliminates, never confirms;
   *  distinct from both `unstable` (enumerated, sufficient) and silence (never addressed at all). */
  insufficientEnumeration: BoundaryUnstableOption[];
  discarded: number;
  /** ABSENCE IS OMISSION -- an option never addressed stays in none of the four buckets above. */
  notAddressed: string[];
  via: string;
  answerProvenance?: ClaimProvenance;
  corroboration?: CorroborationResult;
  error?: string;
}

function summaryLine(OPT: Record<string, string>, r: BoundaryResult): string {
  if (!r.ok) return `BOUNDARY STABILITY: FAILED -- ${r.error}`;
  const unstableText = r.unstable.length
    ? r.unstable.map((e) => `${e.letter}) ${e.name} [${(e.definitions ?? []).length} named rival definitions: ${(e.definitions ?? []).join(' | ')} -- source: "${e.span}"]`).join('  |  ')
    : '(none stated)';
  const stableText = r.confirmedStable.length
    ? r.confirmedStable.map((e) => `${e.letter}) ${e.name} [source: "${e.span}"]`).join('  |  ')
    : '(none)';
  const insufficientText = r.insufficientEnumeration.length
    ? r.insufficientEnumeration.map((e) => `${e.letter}) ${e.name} [claimed "varies" but named fewer than 2 rivals -- source: "${e.span}"]`).join('  |  ')
    : '(none)';
  const notAddressedText = r.notAddressed.length
    ? r.notAddressed.map((L) => `${L}) ${OPT[L]}`).join(', ')
    : '(none)';
  const discardNote = r.discarded ? ` -- discarded ${r.discarded} candidate(s) with no verifiable span` : '';
  const provenanceNote = r.answerProvenance ? `  ||  ANSWERED VIA ${r.answerProvenance.mechanism}: ${r.answerProvenance.detail}` : '';
  const corrobNote = r.corroboration ? `  ||  ${summarizeCorroboration(r.corroboration)}` : '';
  return `BOUNDARY STABILITY -- query: "${r.query}"  ||  MULTIPLE NAMED DEFINITIONS (>=2 rivals enumerated, a comparability decision, not a claim of no population): `
    + `${unstableText}${discardNote}  ||  ONE SETTLED DEFINITION (reported only): ${stableText}`
    + `  ||  INSUFFICIENT ENUMERATION ("varies" claimed, fewer than 2 rivals named -- NOT eliminated): ${insufficientText}`
    + `  ||  NOT ADDRESSED: ${notAddressedText}${provenanceNote}${corrobNote}`;
}

// ───────────────── the live step (owned evidence -> conversational -> corroboration) ─────────────────

/**
 * Runs 'BoundaryStability:1'. Same three-stage discipline every sibling step (Unitary:1/
 * Softballs:1/NamedSet:1/Discriminator:1) already uses. Cannot be exercised end to end under
 * vitest (live Ollama/browser needed) -- the pure parts above carry the real unit tests; this
 * function is verified by a live in-app run.
 */
export async function runBoundaryStep(
  input: MethodQuestionInput,
  ctx: MethodRunContext,
  // D-BP154-058 PART 5, ADDITIVE/OPTIONAL -- undefined on every pre-existing call site (this
  // file's own tests), so every existing caller keeps compiling and behaving identically. When
  // supplied (script_bridge.ts's own runOneStep(), same priorResults every Terminator:1/
  // Magnitude:1/OriginFrame:1 call already receives), TargetClass:1's own established result (if
  // it ran earlier in the SAME stack) frames this step's own query -- Founder's own diagnosis of
  // why the bare stability judgement came back loose: "the boundary question is asked in context
  // rather than in a vacuum."
  priorResults?: Array<{ id: string; raw: unknown }>,
): Promise<{ result: BoundaryResult; summary: string }> {
  const OPT = input.options;
  if (!OPT || Object.keys(OPT).length === 0) {
    const result: BoundaryResult = {
      ok: false, query: null, unstable: [], confirmedStable: [], insufficientEnumeration: [], discarded: 0, notAddressed: [], via: 'n/a',
      error: 'this question has no lettered options -- BOUNDARY STABILITY tests boundary-definition '
        + 'consistency among options and cannot run without them',
    };
    return { result, summary: summaryLine({}, result) };
  }
  const all = Object.keys(OPT);
  const targetClassRaw = (priorResults?.find((r) => r.id === 'TargetClass:1')?.raw ?? null) as TargetClassResult | null;
  const frameContext = targetClassFrameContext(targetClassRaw?.ok ? targetClassRaw : null);
  const query = buildBoundaryQuery(all, OPT, frameContext);
  const namesAnyOption = (t: string) => all.some((L) => appearsIn(t, OPT[L]));
  const mcOptions = all.map((L) => `${L}) ${OPT[L]}`);

  const ownedCandidates = [
    ...(await gatherMortgageCandidates(input.qid, query)),
    ...gatherThisRunCandidates(ctx),
  ];
  let text = '';
  let via = '';
  let provenance: ClaimProvenance | undefined;
  for (const c of ownedCandidates) {
    if (namesAnyOption(c.text)) { text = c.text; via = c.via; provenance = c.provenance; break; }
  }

  let conversationalError: string | undefined;
  if (!text) {
    const cr = await tryConversationalAuthority(ctx, query, mcOptions);
    if (cr.ok && namesAnyOption(cr.text)) {
      text = cr.text; via = cr.via; provenance = cr.provenance;
    } else {
      conversationalError = cr.error ?? 'conversational authority answered but named none of the options';
    }
  }

  if (!text) {
    const result: BoundaryResult = {
      ok: false, query, unstable: [], confirmedStable: [], insufficientEnumeration: [], discarded: 0, notAddressed: all, via: 'n/a',
      error: `no usable answer from any authority -- owned evidence: ${ownedCandidates.length} candidate(s) tried, none usable; `
        + `conversational authority: ${conversationalError ?? 'not tried'} -- BOUNDARY STABILITY is UNAVAILABLE, not "nothing variable"`,
    };
    return { result, summary: summaryLine(OPT, result) };
  }

  const rawOut: {
    text?: string; truncated?: boolean; failureCause?: 'transport' | 'http-error' | 'parse-error'; failureDetail?: string;
  } = {};
  // D-BP154-058, REWRITTEN. Asks for an ENUMERATION (named rival definitions), not a bare
  // adjective -- and keeps D-BP154-057's own "span must carry the option's own label" fix.
  const instruction = 'From the passage, for EACH option below that the passage classifies, state '
    + 'whether the passage says it has ONE settled definition, or MORE THAN ONE materially '
    + 'different definition. If the passage states multiple definitions, list every named rival '
    + 'definition the passage itself gives, as separate short strings copied or closely summarized '
    + 'from the passage -- never invented; leave the list empty if the passage says "single" or '
    + 'names no rivals. For each option, copy the exact verbatim sentence or clause from the '
    + 'passage that states its classification, AND make sure the copied span itself includes the '
    + 'option\'s own name or letter label exactly as the passage states it (e.g. copy "F) Central '
    + 'Asia: MULTIPLE DEFINITIONS..." in full, not just the reason with the label cut off). Do not '
    + 'include an option the passage merely does not mention -- an omission is not a statement. '
    + 'Classify every option the passage DOES address, not only the first one. '
    + `Options: ${all.map((L) => `${L}) ${OPT[L]}`).join('; ')}`;
  const shape = '{"classifications":[{"name":"exact option name from the list","classification":"single or multiple","definitions":["each named rival definition the passage states, as a short string; empty array if classification is single or none were named"],"span":"verbatim sentence or clause from the passage stating this classification, including the option\'s own label"}]}';
  const ex = await gemmaExtract(instruction, text, shape, rawOut);
  if (ex === null) {
    const cause = rawOut.truncated
      ? 'the local extraction model truncated its output before finishing'
      : rawOut.failureCause
        ? `the local extraction model failed (${rawOut.failureCause}${rawOut.failureDetail ? `: ${rawOut.failureDetail}` : ''})`
        : 'the local extraction model failed for an unclassified reason';
    const result: BoundaryResult = {
      ok: false, query, unstable: [], confirmedStable: [], insufficientEnumeration: [], discarded: 0, notAddressed: all, via,
      error: `extraction failed -- ${cause} -- reported as a FAILURE, never an empty "nothing variable"`,
    };
    return { result, summary: summaryLine(OPT, result) };
  }
  const {
    unstable, confirmedStable, insufficientEnumeration, discarded,
  } = verifyBoundaryClassifications(ex.classifications, text, OPT);
  const addressedLetters = new Set([
    ...unstable.map((e) => e.letter),
    ...confirmedStable.map((e) => e.letter),
    ...insufficientEnumeration.map((e) => e.letter),
  ]);
  const notAddressed = all.filter((L) => !addressedLetters.has(L));

  let corroboration: CorroborationResult | undefined;
  if (unstable.length) {
    corroboration = await corroborateClaim(ctx, buildBoundaryCorroborationQuery(unstable[0]), unstable[0].name);
  }

  const result: BoundaryResult = {
    ok: true,
    query,
    unstable,
    confirmedStable,
    insufficientEnumeration,
    discarded,
    notAddressed,
    via,
    answerProvenance: provenance,
    corroboration,
  };
  return { result, summary: summaryLine(OPT, result) };
}

// ───────────────────────── registration (inert until stacked and run) ─────────────────────────

const BOUNDARY_DECLARATION: StepDeclaration = {
  id: 'liana_cycle.boundary_step.runBoundaryStep',
  version: '2',
  sourceFile: 'src/main/liana_cycle/library/boundary_step.ts',
  sourceLine: 1,
  exportName: 'runBoundaryStep',
  exportKind: 'function',
  whatItDoes:
    'Asks ONE per-option question -- which options carry TWO OR MORE named, materially different '
    + 'definitions in standard world-regional usage (an enumeration, not a stability judgement) -- '
    + 'tried against owned evidence first, then the conversational authority; an option with >=2 '
    + 'named rival definitions is reported as a candidate NOT_COMPARABLE disposition, folded into '
    + 'the Terminator\'s eliminations only if terminator_step.ts\'s own '
    + 'checkBoundaryStabilityUniformity() (checkUniformPredicate(), live) accepts the rule as '
    + 'discriminating this run; a bare "it varies" with fewer than 2 named rivals is reported '
    + 'separately and never eliminates.',
  inputs: 'MethodQuestionInput (question, options, qid) plus MethodRunContext to runBoundaryStep().',
  outputs: 'Promise<{ result: BoundaryResult, summary: string }> -- options with >=2 enumerated rival definitions and verbatim spans, options with one settled definition, options with an insufficient "it varies" claim, discard count, mechanism, and a document corroboration attempt.',
  decidesOrReports: 'DECIDES_AND_REFUSES',
  queryText: {
    issuesQuery: true,
    description: 'One primary question per run -- owned evidence tried first, then "does this term carry more than one named, materially different definition?" put to the conversational authority -- plus at most one corroboration query.',
    loadedFromQueryResource: false,
  },
  attribution: {
    kind: 'ATTRIBUTED',
    founderRuling: 'BP154',
    quote:
      'M49 has different standards for the borders for central asia but not for south america, '
      + 'then what i put in that last proof paper IS the standard... the source must name the rival '
      + 'definitions. If it cannot enumerate them, the option is UNSTATED on this factor, not '
      + 'eliminated.',
    citedAt: 'D-BP154-058 dispatch, PROOF_QID98_TEST_AWARE_ELIMINATION_BP154.md section 4',
  },
  orphanEvidence:
    'N/A -- not an orphan. Live: registered via registerBoundaryStep() (this file), executed by '
    + 'script_bridge.ts\'s runOneStep() for id "BoundaryStability:1".',
};

/** Registers 'BoundaryStability:1'. Called from script_bridge.ts's ensureRegistryPopulated(),
 *  idempotently -- same try/catch shape as every other Composer step registration there. */
export function registerBoundaryStep(): MethodIdentity {
  return registerNameNumbered('BoundaryStability', 1, BOUNDARY_DECLARATION);
}
