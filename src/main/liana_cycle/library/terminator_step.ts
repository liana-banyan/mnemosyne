// terminator_step.ts -- D-BP154-018/BISHOP-SEG/S18/seg-terminator
//
// THE TERMINATOR AS A COMPOSER STEP. THE_PAIL_BP154.md STAGE 5, Founder verbatim: "NOW make sure
// that you don't throw the milk or spill it or drink it or poison it, as you carry it ALL THE WAY
// BACK TO THE HOUSE." This is the carrying-home step -- a fourth stackable Composer step beside
// Softballs:1/NamedSet:1/Discriminator:1, registered and reorderable exactly like them.
//
// IT ASKS NO NEW QUESTION OF ITS OWN. Every other Composer step issues at least one query
// (owned-evidence-first, then conversational, per composer_step_evidence.ts); this one issues
// none -- it is a pure reducer over the THREE PRECEDING STEPS' ALREADY-COMPUTED results, read from
// script_bridge.ts's own accumulated ComposerState.results (threaded in as `priorResults`, see
// that file's own header for the plumbing). If Softballs/NamedSet/Discriminator have not yet run
// in THIS stack (the operator composes the order himself, FD-BP152-20), the missing step simply
// contributes zero eliminations -- never treated as "confirmed nothing to eliminate", which would
// be exactly the "absence read as denial" error HARDWIRE-22's sibling rule (FD-BP153-07) forbids
// throughout this estate.
//
// THE RULE, ALREADY RATIFIED (FD-BP152-19, verbatim): "UNIQUE OR ABSTAIN. NEVER PICK AMONG
// SURVIVORS."
//   1. Options THE SOFTBALLS states are NOT members of the category are OUT.
//   2. Options THE NAMED SET states ARE members of the superlative property are OUT (the question
//      asks which is NOT the property; a stated member cannot be that answer).
//   3. Options THE DISCRIMINATOR states have a kind DIFFERENT from the category-denoting kind are
//      OUT -- FD-BP153-06's own passing example, verbatim: "Eliminate an option a source STATES is
//      a different kind of thing." Compared by exact normalized-text identity against the
//      category-denoting kind the SAME passage stated (HARDWIRE-22: similarity is not identity --
//      this is whitespace/case-fold identity on two spans the source itself already gave, never a
//      semantic judgment call).
//   4. Exactly one survivor after 1-3 -> VERDICT. More than one -> ABSTAIN, naming which step left
//      it ambiguous (this reducer does not itself re-ask the Discriminator a second time; a stack
//      that wants a second attempt reorders/reruns Discriminator:1 itself). Zero survivors ->
//      ABSTAIN, naming over-elimination (at least one step's basis must be wrong; never published).
//
// THE CONTRADICTION CHECK (BP154 dispatch, verbatim: "if the frame excluded an option that another
// step treats as a member, that is a contradiction and it ABSTAINS rather than publishing" -- the
// five-runs-all-published-A history this ticket exists to stop, one of which "called B and D 'not
// world regions' while the named set simultaneously called them the most densely populated
// regions"). Checked BEFORE the survivor count: any letter BOTH excluded by Softballs (not even in
// the category) AND included by Named Set (a superlative member OF the category) is
// self-contradictory on its face -- Softballs and Named Set cannot both be right about it -- and
// forces an ABSTAIN regardless of what the survivor count would otherwise say.
//
// THE BASIS IS THE PRODUCT, NOT THE LETTER (FD-BP153-06). Every elimination in the published basis
// names WHICH step eliminated the option, on WHAT stated source, with the VERBATIM SPAN -- never
// merely "eliminated". No branch below ever reads which letter is which; every option is treated
// by the same three rules regardless of identity.
//
// HARDWIRE-22 UNRELAXED even though this file asks no query itself: verbatim span or
// discard-and-count is inherited from what Softballs/NamedSet/Discriminator already verified --
// this file trusts their `excluded`/`included`/`kinds` arrays exactly as given (those steps already
// ran the verbatim-span choke point; re-verifying here would be redundant, not safer) and never
// invents a span of its own.
//
// classify_cascade.ts remains FORBIDDEN. comparative_cascade.ts remains untouched by this file
// (this reducer needs none of its exports -- no gemmaExtract call, no googleBlocks call, nothing).
// D-BP153-003: runtime stays structurally blind -- no answer key, no qid-specific branch, anywhere
// in this file.

import type { MethodQuestionInput, MethodRunContext } from '../method_registry';
import { registerNameNumbered } from './method_registry';
import type { MethodIdentity } from './method_identity';
import type { StepDeclaration } from './step_declaration';
import type { ComposerStepOutcome } from './script_bridge';
import { classifyComposerStepResult, type ComposerStepClass } from '../../../shared/composer_step_classification';
import type { SoftballsResult } from './softballs_step';
import type { NamedSetResult } from './named_set_step';
import type { DiscriminatorResult } from './discriminator_step';

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

// D-BP154-020/BISHOP-SEG/S20/seg-discriminator2 -- THE VOCABULARY MISMATCH FIX.
//
// LIVE-MEASURED this ticket (qid 98, run 6): a real Discriminator passage stated the
// category-denoting kind as a COMPOUND LIST -- "Continents and Geographic / Geopolitical
// Subregions" -- while stating each option's OWN kind singularly, with its own parenthetical
// elaboration -- "Continent (a major global landmass)". Byte-for-byte identity (this file's
// pre-existing rule, unchanged in spirit below) failed EVERY ONE of the 9 options against that
// compound string, even the ones the source's own words plainly support (a "Continent" IS one of
// the two kinds the same sentence says denote "world regions") -- producing a spurious
// zero-survivor DEGENERATE FRAME that the zero-survivors safety net below correctly caught and
// abstained on, but which never should have been produced in the first place: the source did not
// say a Continent is a DIFFERENT kind from what denotes the category, it said the OPPOSITE.
//
// Founder's own naming of this exact trap (D-BP154-020 dispatch): "A kind that does not
// string-match is UNSTATED, not denied. Never exclude on a non-match." THE FIX BELOW STAYS
// STRUCTURAL, NEVER SEMANTIC (HARDWIRE-22; BP153 canon "ask a local model to copy, never to
// decide") -- no synonym table, no similarity score, no model consulted about whether two labels
// mean the same thing, anywhere in this function:
//   1. Strip each side's own trailing parenthetical elaboration -- decoration the source itself
//      set off in parentheses, never part of the classification word itself.
//   2. Split the categoryKind's stated text on ITS OWN literal list conjunctions (", " / " and "
//      / " or ") into the list of kind-phrases the source itself enumerated -- reading a list the
//      source wrote as a list, never inventing one that isn't there.
//   3. Fold a single trailing "s" for singular/plural tolerance ONLY -- the same class of
//      mechanical operation norm() above already performs (case/punctuation/whitespace folding),
//      applied identically to every kind pair regardless of the actual words, never conditioned on
//      which option, letter, or category is involved.
// A per-option kind is treated as matching the category iff it equals (after 1-3) the WHOLE
// categoryKind string OR any ONE item the split in step 2 produced -- always an EXACT match
// against a literal phrase the source itself wrote, never a judgment that two different words mean
// the same thing. An option whose kind matches NEITHER is eliminated exactly as before this fix.
function stripParenthetical(s: string): string {
  return s.replace(/\s*\([^)]*\)\s*$/, '').trim();
}
function foldPluralToken(s: string): string {
  return s.endsWith('s') && !s.endsWith('ss') ? s.slice(0, -1) : s;
}
function normKindToken(s: string): string {
  return foldPluralToken(norm(stripParenthetical(s)));
}
function splitCategoryKindList(categoryKindText: string): string[] {
  return stripParenthetical(categoryKindText)
    .split(/\s*,\s*|\s+and\s+|\s+or\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
}
/** Exported for direct unit testing (same discipline as this file's own deriveTerminatorEliminations). */
export function discriminatorKindMatchesCategory(optionKind: string, categoryKindText: string): boolean {
  const optionToken = normKindToken(optionKind);
  if (!optionToken) return false;
  if (normKindToken(categoryKindText) === optionToken) return true;
  return splitCategoryKindList(categoryKindText).some((item) => normKindToken(item) === optionToken);
}

export interface TerminatorEliminationEntry {
  letter: string;
  name: string;
  /** Which Composer step's stated fact eliminated this option. */
  sourceStep: 'Softballs:1' | 'NamedSet:1' | 'Discriminator:1';
  reason: string;
  span: string;
}

export interface TerminatorContradiction {
  letter: string;
  reason: string;
}

export interface TerminatorResult {
  ok: boolean;
  /** Which of the three feeder steps were actually found (already run, earlier in this same
   *  stack) -- a step absent from the stack is reported here as 'not run', distinct from a step
   *  that ran and abstained. */
  stepsConsulted: Record<'Softballs:1' | 'NamedSet:1' | 'Discriminator:1', 'not run' | 'ok' | 'failed'>;
  eliminated: TerminatorEliminationEntry[];
  survivors: string[];
  contradiction: TerminatorContradiction | null;
  verdict: string | null;
  verdictName: string | null;
  abstain: boolean;
  abstainReason: string | null;
  /** D-BP154-018: the classification (017's ratified mapping) of every CONTRIBUTING feeder step --
   *  i.e. every step that eliminated at least one non-survivor -- so the shared classifier can
   *  derive this verdict's own PROVEN/CORROBORATED/ANSWERED tier from how well-evidenced its own
   *  basis actually is, never from which letter it reached. Empty when abstaining. */
  basisStepClasses: ComposerStepClass[];
  error?: string;
}

function summaryLine(OPT: Record<string, string>, r: TerminatorResult): string {
  if (!r.ok) return `TERMINATOR: FAILED -- ${r.error}`;
  const elimText = r.eliminated.length
    ? r.eliminated.map((e) => `${e.letter}) ${e.name} [${e.sourceStep}: ${e.reason} -- "${e.span}"]`).join('  |  ')
    : '(none)';
  if (r.abstain) {
    return `TERMINATOR -- ABSTAIN: ${r.abstainReason}  ||  ELIMINATED: ${elimText}  ||  SURVIVORS: ${r.survivors.join(', ') || '(none)'}`;
  }
  return `TERMINATOR -- VERDICT ${r.verdict}) ${r.verdictName}  ||  ELIMINATED: ${elimText}`;
}

/** THE ONE PLACE the three feeder steps' results become eliminations. Pure, synchronous, no I/O --
 *  unit-testable without a live Ollama/browser (unlike the three feeder steps themselves). */
export function deriveTerminatorEliminations(
  OPT: Record<string, string>,
  softballs: SoftballsResult | null,
  namedSet: NamedSetResult | null,
  discriminator: DiscriminatorResult | null,
): { eliminated: TerminatorEliminationEntry[]; contradiction: TerminatorContradiction | null } {
  const eliminated: TerminatorEliminationEntry[] = [];
  const excludedBySoftballs = new Map<string, { name: string; span: string }>();
  if (softballs?.ok) {
    for (const e of softballs.excluded) {
      excludedBySoftballs.set(e.letter, { name: e.name, span: e.span });
      eliminated.push({
        letter: e.letter, name: e.name, sourceStep: 'Softballs:1',
        reason: `source states this is not the category`, span: e.span,
      });
    }
  }
  const includedByNamedSet = new Map<string, { name: string; span: string }>();
  if (namedSet?.ok) {
    for (const e of namedSet.included) {
      includedByNamedSet.set(e.letter, { name: e.name, span: e.span });
      eliminated.push({
        letter: e.letter, name: e.name, sourceStep: 'NamedSet:1',
        reason: `source states this IS the superlative property (a member, not the odd one out)`, span: e.span,
      });
    }
  }
  if (discriminator?.ok && discriminator.categoryKind) {
    for (const k of discriminator.kinds) {
      // D-BP154-020: discriminatorKindMatchesCategory (this file, above) replaces a naive
      // whole-string identity check -- see that function's own header for why exact identity
      // alone wrongly eliminated every option against a compound category-kind list.
      if (discriminatorKindMatchesCategory(k.kind, discriminator.categoryKind.kind)) continue; // matches the category's own stated kind (or one of its stated list items) -- not an elimination
      eliminated.push({
        letter: k.letter, name: k.name, sourceStep: 'Discriminator:1',
        reason: `source states this is "${k.kind}", a different stated kind from "${discriminator.categoryKind.kind}"`,
        span: k.span,
      });
    }
  }
  let contradiction: TerminatorContradiction | null = null;
  for (const [letter, softballsFact] of excludedBySoftballs) {
    const namedSetFact = includedByNamedSet.get(letter);
    if (namedSetFact) {
      contradiction = {
        letter,
        reason: `SOFTBALLS states "${OPT[letter] ?? letter}" is not the category ("${softballsFact.span}") while `
          + `NAMED SET simultaneously states it IS the superlative property ("${namedSetFact.span}") -- `
          + `self-contradictory, not published`,
      };
      break;
    }
  }
  return { eliminated, contradiction };
}

export async function runTerminatorStep(
  input: MethodQuestionInput,
  _ctx: MethodRunContext,
  priorResults: ComposerStepOutcome[],
): Promise<{ result: TerminatorResult; summary: string }> {
  const OPT = input.options;
  const emptyStepsConsulted: TerminatorResult['stepsConsulted'] = {
    'Softballs:1': 'not run', 'NamedSet:1': 'not run', 'Discriminator:1': 'not run',
  };
  if (!OPT || Object.keys(OPT).length === 0) {
    const result: TerminatorResult = {
      ok: false, stepsConsulted: emptyStepsConsulted, eliminated: [], survivors: [],
      contradiction: null, verdict: null, verdictName: null, abstain: true,
      abstainReason: 'this question has no lettered options', basisStepClasses: [],
      error: 'THE TERMINATOR needs lettered options -- cannot run without them',
    };
    return { result, summary: summaryLine({}, result) };
  }
  const all = Object.keys(OPT);

  const findRaw = (id: string): unknown | null => priorResults.find((r) => r.id === id)?.raw ?? null;
  const softballsRaw = findRaw('Softballs:1') as SoftballsResult | null;
  const namedSetRaw = findRaw('NamedSet:1') as NamedSetResult | null;
  const discriminatorRaw = findRaw('Discriminator:1') as DiscriminatorResult | null;

  const stepsConsulted: TerminatorResult['stepsConsulted'] = {
    'Softballs:1': softballsRaw ? (softballsRaw.ok ? 'ok' : 'failed') : 'not run',
    'NamedSet:1': namedSetRaw ? (namedSetRaw.ok ? 'ok' : 'failed') : 'not run',
    'Discriminator:1': discriminatorRaw ? (discriminatorRaw.ok ? 'ok' : 'failed') : 'not run',
  };

  const { eliminated, contradiction } = deriveTerminatorEliminations(
    OPT,
    softballsRaw?.ok ? softballsRaw : null,
    namedSetRaw?.ok ? namedSetRaw : null,
    discriminatorRaw?.ok ? discriminatorRaw : null,
  );

  if (contradiction) {
    const result: TerminatorResult = {
      ok: true, stepsConsulted, eliminated, survivors: [], contradiction, verdict: null,
      verdictName: null, abstain: true,
      abstainReason: `CONTRADICTION: ${contradiction.reason}`,
      basisStepClasses: [],
    };
    return { result, summary: summaryLine(OPT, result) };
  }

  const eliminatedLetters = new Set(eliminated.map((e) => e.letter));
  const survivors = all.filter((L) => !eliminatedLetters.has(L));

  const contributingSteps = new Set(eliminated.map((e) => e.sourceStep));
  const basisStepClasses: ComposerStepClass[] = [];
  if (contributingSteps.has('Softballs:1') && softballsRaw) basisStepClasses.push(classifyComposerStepResult(softballsRaw).cls);
  if (contributingSteps.has('NamedSet:1') && namedSetRaw) basisStepClasses.push(classifyComposerStepResult(namedSetRaw).cls);
  if (contributingSteps.has('Discriminator:1') && discriminatorRaw) basisStepClasses.push(classifyComposerStepResult(discriminatorRaw).cls);

  if (survivors.length === 0) {
    const result: TerminatorResult = {
      ok: true, stepsConsulted, eliminated, survivors, contradiction: null, verdict: null,
      verdictName: null, abstain: true,
      abstainReason: 'every option was eliminated -- at least one contributing step\'s basis must be wrong; not published',
      basisStepClasses: [],
    };
    return { result, summary: summaryLine(OPT, result) };
  }
  if (survivors.length > 1) {
    const consultedNote = (Object.entries(stepsConsulted) as Array<[string, string]>)
      .map(([id, status]) => `${id}: ${status}`).join(', ');
    const result: TerminatorResult = {
      ok: true, stepsConsulted, eliminated, survivors, contradiction: null, verdict: null,
      verdictName: null, abstain: true,
      abstainReason: `more than one survivor left (${survivors.join(', ')}) -- no stated distinction separated them further. Steps consulted: ${consultedNote}`,
      basisStepClasses: [],
    };
    return { result, summary: summaryLine(OPT, result) };
  }

  const verdict = survivors[0];
  const result: TerminatorResult = {
    ok: true, stepsConsulted, eliminated, survivors, contradiction: null,
    verdict, verdictName: OPT[verdict], abstain: false, abstainReason: null, basisStepClasses,
  };
  return { result, summary: summaryLine(OPT, result) };
}

// ───────────────────────── registration (inert until stacked and run) ─────────────────────────

const TERMINATOR_DECLARATION: StepDeclaration = {
  id: 'liana_cycle.terminator_step.runTerminatorStep',
  version: '1',
  sourceFile: 'src/main/liana_cycle/library/terminator_step.ts',
  sourceLine: 1,
  exportName: 'runTerminatorStep',
  exportKind: 'function',
  whatItDoes:
    'Consumes what Softballs:1/NamedSet:1/Discriminator:1 already established (no new query of '
    + 'its own) and applies UNIQUE OR ABSTAIN (FD-BP152-19): options a source stated are not the '
    + 'category, ARE the superlative property, or are a different stated kind than the category '
    + 'are eliminated; exactly one survivor is the verdict, more than one or zero is an honest '
    + 'ABSTAIN naming the blocker, and a self-contradictory basis (excluded and included by the '
    + 'same letter) ABSTAINS rather than publishing.',
  inputs: 'MethodQuestionInput (question, options, qid) plus the accumulated results of any '
    + 'Softballs:1/NamedSet:1/Discriminator:1 steps already run earlier in the same stack.',
  outputs: 'Promise<{ result: TerminatorResult, summary: string }> -- the verdict or an honest '
    + 'abstain, every elimination with its source step and verbatim span, and any contradiction found.',
  decidesOrReports: 'DECIDES_AND_REFUSES',
  queryText: {
    issuesQuery: false,
    description: 'Issues no query of its own -- a pure reducer over the three feeder steps\' already-acquired results.',
    loadedFromQueryResource: false,
  },
  attribution: {
    kind: 'ATTRIBUTED',
    founderRuling: 'BP152/BP154',
    quote: 'UNIQUE OR ABSTAIN. NEVER PICK AMONG SURVIVORS.',
    citedAt: 'FD-BP152-19; THE_PAIL_BP154.md STAGE 5',
  },
  orphanEvidence:
    'N/A -- not an orphan. Live: registered via registerTerminatorStep() (this file), executed by '
    + 'script_bridge.ts\'s runOneStep() for id "Terminator:1", the same wiring pattern Softballs:1/'
    + 'NamedSet:1/Discriminator:1 already use.',
};

/** Registers 'Terminator:1'. Called from script_bridge.ts's ensureRegistryPopulated(),
 *  idempotently -- same try/catch shape as the other Composer step registrations there. */
export function registerTerminatorStep(): MethodIdentity {
  return registerNameNumbered('Terminator', 1, TERMINATOR_DECLARATION);
}
