// boundary_step.test.ts -- D-BP154-053/BISHOP-SEG/S52/seg-wiregate PART 1 CONTINUATION, REWRITTEN D-BP154-058
//
// FAIL-BEFORE / PASS-AFTER for 'BoundaryStability:1'. Same boundary as unitary_step.test.ts's own
// header: the pure parts (query text, span verification) are exercised directly; runBoundaryStep()
// itself calls a live conversational authority and a live Ollama extraction, neither available
// under vitest -- proven by an in-app run instead.
//
// D-BP154-058 REWRITE: the question changed from a bare STABLE/VARIABLE judgement (D-BP154-055,
// which a live run answered loosely enough to call 6 of 9 options variable) to an ENUMERABLE
// question -- does the term carry TWO OR MORE NAMED, materially different definitions? The
// disposition rule this file's own verifyBoundaryClassifications() now enforces, Founder verbatim:
// "A bare 'it varies' is NOT sufficient... The source must name the rival definitions. If it cannot
// enumerate them, the option is UNSTATED on this factor, not eliminated." Every test below reflects
// the NEW "single"/"multiple" + `definitions[]` shape; FAIL-BEFORE for this rewrite is the same
// git-stash discipline as every prior wiring proof in this file.

import { describe, test, expect } from 'vitest';
import {
  buildBoundaryCorroborationQuery, buildBoundaryQuery, registerBoundaryStep, runBoundaryStep,
  verifyBoundaryClassifications,
} from './boundary_step';
import { listComposerRegistry } from './script_bridge';
import type { MethodQuestionInput, MethodRunContext } from '../method_registry';

const OPT: Record<string, string> = {
  A: 'South America', B: 'South Asia', C: 'North Africa', D: 'Northeast United States', E: 'Europe',
  F: 'Central Asia', G: 'Arctic Circle', H: 'Amazon Rainforest', I: 'Sahara Desert',
};
const ALL = Object.keys(OPT);

describe('buildBoundaryQuery -- ONE query, per-option adjudication, asking for an ENUMERATION not a judgement', () => {
  test('names every option once, asks for a classification of EVERY one, in order, none skipped, and asks for named rival definitions', () => {
    const q = buildBoundaryQuery(ALL, OPT);
    expect(q).toContain('For EACH of the following');
    expect(q).toContain('every one, in order');
    expect(q).toContain('do not skip any');
    expect(q).toMatch(/MORE THAN ONE materially different/);
    expect(q).toMatch(/LIST the competing definitions/);
    for (const L of ALL) expect(q).toContain(OPT[L]);
  });
});

describe('buildBoundaryCorroborationQuery', () => {
  test('asks about the single named option only', () => {
    const q = buildBoundaryCorroborationQuery({ letter: 'F', name: 'Central Asia', span: 'x' });
    expect(q).toContain('Central Asia');
  });
});

describe('verifyBoundaryClassifications -- per-option, extraction only, verified span or discarded (HARDWIRE-22), ENUMERATION REQUIRED for a "multiple" finding to count', () => {
  const passage = 'Central Asia carries multiple materially different definitions: 1) the five '
    + 'former Soviet republics; 2) Turkestan; 3) a broader area including Afghanistan. South '
    + 'America has one settled definition, routinely used in density comparisons. Europe is said '
    + 'to vary somewhat depending on convention.';

  test('an entry classified "multiple" with >=2 named rival definitions and a verbatim span is unstable, carrying its own definitions[]', () => {
    const raw = [{
      name: 'Central Asia', classification: 'multiple', definitions: ['the five former Soviet republics', 'Turkestan', 'a broader area including Afghanistan'],
      span: 'Central Asia carries multiple materially different definitions: 1) the five former Soviet republics; 2) Turkestan; 3) a broader area including Afghanistan.',
    }];
    const { unstable, confirmedStable, insufficientEnumeration, discarded } = verifyBoundaryClassifications(raw, passage, OPT);
    expect(unstable).toEqual([{
      letter: 'F', name: 'Central Asia', span: raw[0].span,
      definitions: ['the five former Soviet republics', 'Turkestan', 'a broader area including Afghanistan'],
    }]);
    expect(confirmedStable).toEqual([]);
    expect(insufficientEnumeration).toEqual([]);
    expect(discarded).toBe(0);
  });

  test('an entry classified "single" with a verbatim span is CONFIRMED, never eliminated', () => {
    const raw = [{
      name: 'South America', classification: 'single',
      span: 'South America has one settled definition, routinely used in density comparisons.',
    }];
    const { unstable, confirmedStable, discarded } = verifyBoundaryClassifications(raw, passage, OPT);
    expect(unstable).toEqual([]);
    expect(confirmedStable).toEqual([{ letter: 'A', name: 'South America', span: raw[0].span }]);
    expect(discarded).toBe(0);
  });

  // THE CORE DISPOSITION RULE, Founder verbatim: "A bare 'it varies' is NOT sufficient... If it
  // cannot enumerate them, the option is UNSTATED on this factor, not eliminated."
  test('THE DISPOSITION RULE: a "multiple" claim naming ZERO rival definitions is INSUFFICIENT ENUMERATION, never folded into unstable', () => {
    const raw = [{
      name: 'Europe', classification: 'multiple', definitions: [],
      span: 'Europe is said to vary somewhat depending on convention.',
    }];
    const { unstable, insufficientEnumeration, discarded } = verifyBoundaryClassifications(raw, passage, OPT);
    expect(unstable).toEqual([]);
    expect(insufficientEnumeration).toEqual([{ letter: 'E', name: 'Europe', span: raw[0].span }]);
    expect(discarded).toBe(0);
  });

  test('THE DISPOSITION RULE: a "multiple" claim naming exactly ONE rival definition is STILL insufficient (need TWO OR MORE to be a genuine rivalry)', () => {
    const raw = [{
      name: 'Europe', classification: 'multiple', definitions: ['a narrower geopolitical definition'],
      span: 'Europe is said to vary somewhat depending on convention.',
    }];
    const { unstable, insufficientEnumeration } = verifyBoundaryClassifications(raw, passage, OPT);
    expect(unstable).toEqual([]);
    expect(insufficientEnumeration.map((e) => e.letter)).toEqual(['E']);
  });

  test('THE DISPOSITION RULE: two named definitions that are the SAME rival under slightly different wording fold to one -- still insufficient', () => {
    const raw = [{
      name: 'Europe', classification: 'multiple',
      definitions: ['the five former Soviet republics', '  The Five Former Soviet Republics  '],
      span: 'Europe is said to vary somewhat depending on convention.',
    }];
    const { unstable, insufficientEnumeration } = verifyBoundaryClassifications(raw, passage, OPT);
    expect(unstable).toEqual([]);
    expect(insufficientEnumeration.map((e) => e.letter)).toEqual(['E']);
  });

  test('EVERY option the passage addresses is classified in one pass -- Central Asia (multiple, sufficient) and South America (single) together', () => {
    const raw = [
      {
        name: 'Central Asia', classification: 'multiple', definitions: ['the five former Soviet republics', 'Turkestan'],
        span: 'Central Asia carries multiple materially different definitions: 1) the five former Soviet republics; 2) Turkestan; 3) a broader area including Afghanistan.',
      },
      {
        name: 'South America', classification: 'single',
        span: 'South America has one settled definition, routinely used in density comparisons.',
      },
    ];
    const { unstable, confirmedStable } = verifyBoundaryClassifications(raw, passage, OPT);
    expect(unstable.map((e) => e.letter)).toEqual(['F']);
    expect(confirmedStable.map((e) => e.letter)).toEqual(['A']);
  });

  test('discards an entry whose span is not verbatim in the passage', () => {
    const raw = [{ name: 'Central Asia', classification: 'multiple', definitions: ['a', 'b'], span: 'this sentence does not appear anywhere in the passage' }];
    const { unstable, discarded } = verifyBoundaryClassifications(raw, passage, OPT);
    expect(unstable).toEqual([]);
    expect(discarded).toBe(1);
  });

  test('an entry with no recognized classification value is neither unstable nor confirmed -- UNSTATED, not a discard', () => {
    const raw = [{ name: 'Central Asia', classification: 'maybe', span: 'irrelevant' }];
    const { unstable, confirmedStable, discarded } = verifyBoundaryClassifications(raw, passage, OPT);
    expect(unstable).toEqual([]);
    expect(confirmedStable).toEqual([]);
    expect(discarded).toBe(0);
  });

  test('never treats an unmentioned option as unstable -- absence is omission, not a candidate at all', () => {
    const { unstable, confirmedStable, discarded } = verifyBoundaryClassifications([], passage, OPT);
    expect(unstable).toEqual([]);
    expect(confirmedStable).toEqual([]);
    expect(discarded).toBe(0);
  });

  test('a name matching no known option is not a candidate, not a discard', () => {
    const raw = [{ name: 'Atlantis', classification: 'multiple', definitions: ['a', 'b'], span: 'irrelevant' }];
    const { unstable, discarded } = verifyBoundaryClassifications(raw, passage, OPT);
    expect(unstable).toEqual([]);
    expect(discarded).toBe(0);
  });

  // D-BP154-052/BISHOP-SEG/S52/seg-wiregate ACTIVATION PROOF: this file was built from the start
  // on entity_resolution.ts's shared resolver (never a local mirror) -- a stated parenthetical
  // alias resolves via that resolver's third mechanical step.
  test('WIRING PROOF: a stated parenthetical alias resolves through entity_resolution.ts', () => {
    const span = 'Northern Africa (North Africa) has one settled definition.';
    const raw = [{ name: 'Northern Africa (North Africa)', classification: 'single', span }];
    const { confirmedStable, discarded } = verifyBoundaryClassifications(raw, `${passage} ${span}`, OPT);
    expect(confirmedStable.map((e) => e.letter)).toEqual(['C']);
    expect(discarded).toBe(0);
  });
});

describe('runBoundaryStep -- named failures, honest and pure enough to test without a live authority', () => {
  test('fails honestly with no lettered options', async () => {
    const input: MethodQuestionInput = { question: 'q?', options: null };
    const ctx: MethodRunContext = { askGoogle: async () => null, emit: () => {} };
    const { result } = await runBoundaryStep(input, ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no lettered options/);
  });
});

describe('registerBoundaryStep / listComposerRegistry -- BoundaryStability:1 is registered and executable', () => {
  test('BoundaryStability:1 appears in the composer registry and is marked executable', () => {
    registerBoundaryStep();
    const entries = listComposerRegistry();
    const entry = entries.find((e) => e.id === 'BoundaryStability:1');
    expect(entry).toBeDefined();
    expect(entry?.executable).toBe(true);
  });
});
