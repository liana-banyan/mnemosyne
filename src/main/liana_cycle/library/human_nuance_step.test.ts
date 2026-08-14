// human_nuance_step.test.ts -- D-BP154-030/BISHOP-SEG/S30/seg-humannuance
//
// FAIL-BEFORE / PASS-AFTER for THE HUMAN NUANCE FACTOR as a sixth Composer step. Same boundary as
// magnitude_step.test.ts's own header: the pure parts (category derivation, the cow guard, the
// frame derivation, span verification, query text) are exercised directly; runHumanNuanceStep()
// itself needs a live browser authority and a live Ollama instance for its authority-dependent
// branches (proven by an in-app run instead, this ticket's own return).
//
// FAIL-BEFORE: every test below FAILS on main before this ticket, because human_nuance_step.ts,
// its registration, and its wiring into script_bridge.ts did not exist -- the import at the top of
// this file alone throws "Cannot find module './human_nuance_step'".
//
// MECHANISM TEST THROUGHOUT (FD-BP153-06): every test below that asserts on the MECHANISM uses
// INVENTED vocabulary (Zorblatt/Fignorp/Quexil, made-up categories and option names) rather than
// qid 98's own real words -- proving each rule would survive on a question whose answer is
// unknown, the same standard magnitude_step.test.ts's/terminator_step.test.ts's own tests hold to.
// The one deliberate exception is the registration/wiring smoke test, which needs a real bundled
// qid to exercise listComposerRegistry()/runScratchComposer() end to end the same way every
// sibling step's own registration test does.

import { describe, test, expect } from 'vitest';
import {
  CORPUS_META_TRUTH, buildHumanNuanceExclusionQuery, deriveHumanNuanceCategory,
  deriveHumanNuanceFrame, evaluateCowGuard, registerHumanNuanceStep, verifyHumanNuanceExclusions,
} from './human_nuance_step';
import { listComposerRegistry } from './script_bridge';

// ─────────────────────────── invented vocabulary throughout ───────────────────────────

const INVENTED_QUESTION = 'Which of the following Zorblatt clusters is NOT considered one of the galaxy\'s most populous Zorblatt clusters?';
const INVENTED_OPT: Record<string, string> = {
  A: 'Fignorp Cluster', // origin-frame member
  B: 'Quexil Cluster', // origin-frame member
  C: 'Drenvale Cluster', // origin-frame member
  D: 'Wobsy Nebula', // augmentation addition -- not a Zorblatt cluster at all
  E: 'Yalthorp Void', // augmentation addition -- not a Zorblatt cluster at all
};
const INVENTED_ALL = Object.keys(INVENTED_OPT);

describe('deriveHumanNuanceCategory -- reads the category the question itself names, never guesses (invented vocabulary)', () => {
  test('invented "following X is" shape', () => {
    expect(deriveHumanNuanceCategory(INVENTED_QUESTION)).toBe('Zorblatt clusters');
  });

  test('a question with no "following X is/are" shape returns null, not a fabricated category', () => {
    expect(deriveHumanNuanceCategory('What is the capital of Fignorp?')).toBeNull();
  });
});

describe('evaluateCowGuard -- FD-BP154-07: never applies nuance without an established artifact class', () => {
  test('no originSrc -> does NOT apply, and says why, without touching any option or letter', () => {
    const guard = evaluateCowGuard(undefined);
    expect(guard.applies).toBe(false);
    expect(guard.reason).toMatch(/UNAVAILABLE/);
    expect(guard.reason).toMatch(/does not apply nuance at all/);
  });

  test('an invented, non-real originSrc still PASSES the guard -- the guard reads PRESENCE, never the specific corpus subject, and never selects a letter (FD-BP153-06)', () => {
    const guard = evaluateCowGuard('ori_mmlu-fignorp_studies');
    expect(guard.applies).toBe(true);
    expect(guard.reason).toContain('ori_mmlu-fignorp_studies');
  });

  test('the guard never mentions any specific option letter or name', () => {
    const guard = evaluateCowGuard('ori_mmlu-fignorp_studies');
    for (const L of INVENTED_ALL) expect(guard.reason).not.toContain(INVENTED_OPT[L]);
  });
});

describe('CORPUS_META_TRUTH -- established once, corpus-wide, ATTRIBUTED to the Founder ruling, never re-derived per item', () => {
  test('is a constant, attributed statement, not a function of any question text', () => {
    expect(CORPUS_META_TRUTH.statement).toMatch(/human-authored assessment artifact/);
    expect(CORPUS_META_TRUTH.attribution).toMatch(/FD-BP154-07a/);
  });
});

describe('deriveHumanNuanceFrame -- reads the origin\'s own option set as the frame, structurally, never a guess (invented vocabulary)', () => {
  test('maps the origin\'s (narrower) option set to this run\'s own letters, and everything else is a non-participant', () => {
    const frame = deriveHumanNuanceFrame(
      { options: ['Fignorp Cluster', 'Quexil Cluster', 'Drenvale Cluster'], question: INVENTED_QUESTION },
      INVENTED_OPT,
    );
    expect(frame).not.toBeNull();
    expect(frame!.frameLetters.sort()).toEqual(['A', 'B', 'C']);
    expect(frame!.nonParticipants.sort()).toEqual(['D', 'E']);
    expect(frame!.unmatchedOriginOptions).toBe(0);
  });

  test('null origin -> null frame, never a fabricated one', () => {
    expect(deriveHumanNuanceFrame(null, INVENTED_OPT)).toBeNull();
  });

  test('an origin option whose text does not match anything in this run\'s options is reported as unmatched, never silently dropped', () => {
    const frame = deriveHumanNuanceFrame(
      { options: ['Fignorp Cluster', 'Something Else Entirely'], question: INVENTED_QUESTION },
      INVENTED_OPT,
    );
    expect(frame!.frameLetters).toEqual(['A']);
    expect(frame!.unmatchedOriginOptions).toBe(1);
  });

  test('does not select or favor any particular letter -- symmetric under relabeling (FD-BP153-06)', () => {
    const relabeled: Record<string, string> = { X: 'Fignorp Cluster', Y: 'Quexil Cluster', Z: 'Wobsy Nebula' };
    const frame = deriveHumanNuanceFrame({ options: ['Fignorp Cluster', 'Quexil Cluster'], question: 'q' }, relabeled);
    expect(frame!.frameLetters.sort()).toEqual(['X', 'Y']);
    expect(frame!.nonParticipants).toEqual(['Z']);
  });
});

describe('buildHumanNuanceExclusionQuery -- ONE query, restricted to non-participants only (FD-BP153-01 consequence 4), generic across categories', () => {
  test('never names any frame (participant) option, only non-participants', () => {
    const q = buildHumanNuanceExclusionQuery('Zorblatt clusters', ['D', 'E'], INVENTED_OPT);
    expect(q).toContain('Wobsy Nebula');
    expect(q).toContain('Yalthorp Void');
    expect(q).not.toContain('Fignorp Cluster');
    expect(q).not.toContain('Quexil Cluster');
    expect(q).not.toContain('Drenvale Cluster');
  });

  test('names the category generically -- the query text carries no hardcoded domain vocabulary of its own', () => {
    const q = buildHumanNuanceExclusionQuery('Zorblatt clusters', ['D'], INVENTED_OPT);
    expect(q).toContain('"Zorblatt clusters"');
    expect(q).not.toMatch(/population|settlement|geography/i);
  });
});

describe('verifyHumanNuanceExclusions -- the verify-the-span choke point (HARDWIRE-22): verbatim span or discard-and-count', () => {
  const passage = 'The Wobsy Nebula is not a Zorblatt cluster because it lacks stable star formation. '
    + 'The Yalthorp Void is likewise excluded due to insufficient matter density.';

  test('a well-formed, verbatim-sourced exclusion is kept', () => {
    const raw = [
      { name: 'Wobsy Nebula', reason: 'lacks stable star formation', span: 'The Wobsy Nebula is not a Zorblatt cluster because it lacks stable star formation.' },
    ];
    const { excluded, discarded } = verifyHumanNuanceExclusions(raw, passage, ['D', 'E'], INVENTED_OPT);
    expect(excluded).toHaveLength(1);
    expect(excluded[0].letter).toBe('D');
    expect(discarded).toBe(0);
  });

  test('a span that is not verbatim in the passage is discarded and counted, never kept on trust', () => {
    const raw = [{ name: 'Wobsy Nebula', reason: 'invented reason', span: 'This sentence does not appear anywhere in the passage.' }];
    const { excluded, discarded } = verifyHumanNuanceExclusions(raw, passage, ['D', 'E'], INVENTED_OPT);
    expect(excluded).toHaveLength(0);
    expect(discarded).toBe(1);
  });

  test('a name matching a FRAME (participant) option is never a candidate at all -- not even a discard', () => {
    const raw = [{ name: 'Fignorp Cluster', reason: 'x', span: 'irrelevant' }];
    const { excluded, discarded } = verifyHumanNuanceExclusions(raw, passage, ['D', 'E'], INVENTED_OPT);
    expect(excluded).toHaveLength(0);
    expect(discarded).toBe(0); // not a discard -- it was never eligible in the first place
  });

  test('an omitted option is UNRESOLVED, never fabricated as excluded (absence is omission)', () => {
    const raw = [{ name: 'Wobsy Nebula', reason: 'x', span: 'The Wobsy Nebula is not a Zorblatt cluster because it lacks stable star formation.' }];
    const { excluded } = verifyHumanNuanceExclusions(raw, passage, ['D', 'E'], INVENTED_OPT);
    const resolvedLetters = new Set(excluded.map((e) => e.letter));
    expect(resolvedLetters.has('E')).toBe(false); // Yalthorp Void was never named in `raw` -- stays unresolved by the caller
  });

  test('never selects a particular letter -- symmetric under relabeling (FD-BP153-06)', () => {
    const relabeled: Record<string, string> = { P: 'Wobsy Nebula', Q: 'Yalthorp Void' };
    const raw = [{ name: 'Wobsy Nebula', reason: 'x', span: 'The Wobsy Nebula is not a Zorblatt cluster because it lacks stable star formation.' }];
    const { excluded } = verifyHumanNuanceExclusions(raw, passage, ['P', 'Q'], relabeled);
    expect(excluded[0].letter).toBe('P');
  });
});

// ─────────────────────────── registration / wiring (real bundled qid, like every sibling step's own registration test) ───────────────────────────

describe('registerHumanNuanceStep / listComposerRegistry -- HumanNuance:1 is registered and executable, exactly like Softballs:1/NamedSet:1/Discriminator:1/Magnitude:1/Terminator:1', () => {
  test('HumanNuance:1 appears in the composer registry and is marked executable', () => {
    expect(typeof registerHumanNuanceStep).toBe('function');
    const entries = listComposerRegistry();
    const hn = entries.find((e) => e.id === 'HumanNuance:1');
    expect(hn).toBeDefined();
    expect(hn!.executable).toBe(true);
    expect(hn!.name).toBe('HumanNuance');
    expect(hn!.number).toBe(1);
  });
});
