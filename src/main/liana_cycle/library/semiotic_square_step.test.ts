// semiotic_square_step.test.ts -- D-BP155-004/BISHOP-SEG/S4/seg-semiotic-square
//
// MECHANISM TEST THROUGHOUT (FD-BP153-06/HARDWIRE-22), same discipline borromean_test.test.ts's
// own header states: the invented-vocabulary blocks below prove the AXIS-MINING and SQUARE
// mechanics with words that carry no real-world meaning this file could accidentally lean on --
// "would this rule survive on a question whose answer we do not know?" The qid-85 block afterward
// is a validation against reality (the dispatch's own target), never a rule keyed on the letter E.

import { describe, test, expect } from 'vitest';
import {
  buildSemioticSquareAxisQuery,
  buildSquare,
  deriveSemioticSquareTerm,
  findPredicateStemCandidates,
  selectSemioticAxis,
  verifySemioticSquareAxisPole,
} from './semiotic_square_step';

// ─────────────────────── invented vocabulary throughout this block ───────────────────────

describe('deriveSemioticSquareTerm -- pure text-structure parsing, never a guess', () => {
  test('extracts the term after "explains"', () => {
    expect(deriveSemioticSquareTerm('Which of these statements correctly explains zorblatt?')).toBe('zorblatt');
  });
  test('extracts the term after "defines"', () => {
    expect(deriveSemioticSquareTerm('Which statement best defines quexility?')).toBe('quexility');
  });
  test('returns null when the question does not fit any definitional template', () => {
    expect(deriveSemioticSquareTerm('What is the capital of Zorbland?')).toBeNull();
  });
});

describe('findPredicateStemCandidates + selectSemioticAxis -- invented vocabulary, a genuine two-sided pair mined from option text alone', () => {
  const OPT: Record<string, string> = {
    A: 'It describes a process that results in a glarn that does not fnorb the drennel.',
    B: 'It describes a process that results in a glarn that perfectly fnorbs the drennel.',
    C: 'It describes a process that uses a quexil selection method.',
    D: 'It describes a lack of quexil in the selection process.',
  };
  const ALL = Object.keys(OPT);

  test('finds both "fnorb" (A negated, B affirmed) and "quexil" (C affirmed, D negated) as eligible two-sided candidates', () => {
    const candidates = findPredicateStemCandidates(ALL, OPT);
    const eligible = candidates.filter((c) => c.affirmed.length > 0 && c.negated.length > 0);
    const stems = eligible.map((c) => c.stem).sort();
    expect(stems).toEqual(['fnorb', 'quexil']);
    const fnorb = eligible.find((c) => c.stem === 'fnorb')!;
    expect(fnorb.negated.map((o) => o.letter)).toEqual(['A']);
    expect(fnorb.affirmed.map((o) => o.letter)).toEqual(['B']);
    const quexil = eligible.find((c) => c.stem === 'quexil')!;
    expect(quexil.affirmed.map((o) => o.letter)).toEqual(['C']);
    expect(quexil.negated.map((o) => o.letter)).toEqual(['D']);
  });

  test('selectSemioticAxis breaks a coverage tie (2 vs 2) alphabetically, never by which letter is involved (FD-BP153-06)', () => {
    const candidates = findPredicateStemCandidates(ALL, OPT);
    const axis = selectSemioticAxis(candidates);
    expect(axis).not.toBeNull();
    expect(axis!.stem).toBe('fnorb'); // 'fnorb' < 'quexil' alphabetically -- deterministic, not letter-based
  });

  test('a one-sided-only option set (no negation marker anywhere) yields no eligible axis -- refuses rather than invents one', () => {
    const oneSided: Record<string, string> = {
      A: 'It describes a process that always creates a glarn.',
      B: 'It describes a process that always creates a fnorb.',
    };
    const candidates = findPredicateStemCandidates(Object.keys(oneSided), oneSided);
    expect(selectSemioticAxis(candidates)).toBeNull();
  });
});

describe('buildSquare -- the fixed CONTRADICTION relation, invented vocabulary', () => {
  const OPT: Record<string, string> = {
    A: 'It describes a process that results in a glarn that does not fnorb the drennel.',
    B: 'It describes a process that results in a glarn that perfectly fnorbs the drennel.',
    C: 'It describes a process that uses a quexil selection method.',
    D: 'It describes a lack of quexil in the selection process.',
  };
  const ALL = Object.keys(OPT);
  const axis = selectSemioticAxis(findPredicateStemCandidates(ALL, OPT))!;

  test('confirmedPole=negated: S1=A, S2=B is eliminated by contradiction, C/D are UNSTATED (this axis never mentions "quexil")', () => {
    const square = buildSquare(ALL, OPT, axis, 'negated');
    const byLetter = Object.fromEntries(square.members.map((m) => [m.letter, m.position]));
    expect(byLetter).toEqual({ A: 'S1', B: 'S2', C: 'UNSTATED', D: 'UNSTATED' });
    expect(square.eliminatedByContradiction.map((m) => m.letter)).toEqual(['B']);
  });

  test('confirmedPole=affirmed: the assignment inverts -- B is S1, A is eliminated', () => {
    const square = buildSquare(ALL, OPT, axis, 'affirmed');
    const byLetter = Object.fromEntries(square.members.map((m) => [m.letter, m.position]));
    expect(byLetter).toEqual({ A: 'S2', B: 'S1', C: 'UNSTATED', D: 'UNSTATED' });
    expect(square.eliminatedByContradiction.map((m) => m.letter)).toEqual(['A']);
  });
});

describe('verifySemioticSquareAxisPole -- the verify-the-span choke point', () => {
  const passage = 'A zorblatt does not fnorb the drennel, by definition.';
  test('accepts a pole whose span is verbatim in the passage', () => {
    const { axisPole, discarded } = verifySemioticSquareAxisPole(
      { pole: 'negated', span: 'does not fnorb the drennel' }, passage,
    );
    expect(axisPole).toEqual({ pole: 'negated', span: 'does not fnorb the drennel' });
    expect(discarded).toBe(false);
  });
  test('discards a pole whose span is not actually in the passage -- never trusted on say-so', () => {
    const { axisPole, discarded } = verifySemioticSquareAxisPole(
      { pole: 'affirmed', span: 'perfectly fnorbs the drennel' }, passage,
    );
    expect(axisPole).toBeNull();
    expect(discarded).toBe(true);
  });
  test('an unstated pole (both null) is neither accepted nor a discard', () => {
    const { axisPole, discarded } = verifySemioticSquareAxisPole({ pole: null, span: null }, passage);
    expect(axisPole).toBeNull();
    expect(discarded).toBe(false);
  });
});

// ─────────────────────── qid 85, real corpus text -- a validation against reality ───────────────────────
// Verbatim from scripts/test_survey_wiring_qid85_bp150_016.mjs and the TIGER-Lab MMLU-Pro corpus
// record (scratchpad/kn_bp144_2_run038_full_corpus.json), read this dispatch. Key: E.

describe('qid 85 (real corpus text) -- the axis the mechanism actually mines, traced by hand before this file was written', () => {
  const QUESTION = 'Which of these statements correctly explains bias?';
  const OPT: Record<string, string> = {
    A: 'It describes a process that results in a sample that does not represent the population.',
    B: 'It describes a process that results in a sample that is too large or too small.',
    C: 'It describes a process that uses a random sampling method.',
    D: 'It describes a process that results in a sample that perfectly represents the population.',
    E: 'It describes a sample that is not representative of the population.',
    F: 'It describes a process that always results in accurate estimates.',
    G: "It describes the influence of the researcher's personal beliefs on the outcome of the study.",
    H: 'It describes a lack of randomization in the sampling process.',
    I: 'It describes a process where the sampling method has no influence on the outcome of the study.',
    J: 'It describes a process that creates estimates that are too high on average or too low on average.',
  };
  const ALL = Object.keys(OPT);

  test('the term is "bias"', () => {
    expect(deriveSemioticSquareTerm(QUESTION)).toBe('bias');
  });

  test('three genuine two-sided candidates are mined: represent (3), random (2), influence (2)', () => {
    const candidates = findPredicateStemCandidates(ALL, OPT);
    const eligible = candidates.filter((c) => c.affirmed.length > 0 && c.negated.length > 0);
    const byStem = Object.fromEntries(eligible.map((c) => [c.stem, c]));
    expect(Object.keys(byStem).sort()).toEqual(['influence', 'random', 'represent']);
    expect(byStem.represent.negated.map((o) => o.letter).sort()).toEqual(['A', 'E']);
    expect(byStem.represent.affirmed.map((o) => o.letter)).toEqual(['D']);
    expect(byStem.random.affirmed.map((o) => o.letter)).toEqual(['C']);
    expect(byStem.random.negated.map((o) => o.letter)).toEqual(['H']);
    expect(byStem.influence.affirmed.map((o) => o.letter)).toEqual(['G']);
    expect(byStem.influence.negated.map((o) => o.letter)).toEqual(['I']);
  });

  test('"represent" wins deterministically (coverage 3 beats 2), never chosen by letter', () => {
    const axis = selectSemioticAxis(findPredicateStemCandidates(ALL, OPT));
    expect(axis).not.toBeNull();
    expect(axis!.stem).toBe('represent');
  });

  test('confirmedPole=negated (the sourced, expected outcome -- both real captured qid-85 folds describe bias as a FAILURE to represent, never a success): D is eliminated by contradiction; A and E both remain S1, undistinguished by this axis', () => {
    const axis = selectSemioticAxis(findPredicateStemCandidates(ALL, OPT))!;
    const square = buildSquare(ALL, OPT, axis, 'negated');
    const byLetter = Object.fromEntries(square.members.map((m) => [m.letter, m.position]));
    expect(byLetter.A).toBe('S1');
    expect(byLetter.E).toBe('S1');
    expect(byLetter.D).toBe('S2');
    expect(square.eliminatedByContradiction.map((m) => m.letter)).toEqual(['D']);
    // C, H (random) and G, I (influence) never mention "represent" at all -- UNSTATED, never
    // eliminated by an axis this run did not select. This is the honest, non-forced result: the
    // square narrows to {A, E} on this axis, the SAME non-unique pair this estate's own
    // predicate-reduction diagnostic (scratchpad/kn_bp144_2_gate_qid85_output.txt) independently
    // reached by a differently-built mechanism -- it does NOT resolve qid 85 to a unique verdict.
    expect(byLetter.C).toBe('UNSTATED');
    expect(byLetter.H).toBe('UNSTATED');
    expect(byLetter.G).toBe('UNSTATED');
    expect(byLetter.I).toBe('UNSTATED');
    expect(byLetter.B).toBe('UNSTATED');
    expect(byLetter.F).toBe('UNSTATED');
    expect(byLetter.J).toBe('UNSTATED');
  });

  test('buildSemioticSquareAxisQuery quotes both real poles verbatim, asks about "bias"', () => {
    const axis = selectSemioticAxis(findPredicateStemCandidates(ALL, OPT))!;
    const q = buildSemioticSquareAxisQuery('bias', axis);
    expect(q).toContain('"bias"');
    expect(q).toContain('does not represent the population');
    expect(q).toContain('perfectly represents the population');
  });
});

// ─────────────────────── registration/wiring smoke test ───────────────────────

describe('registration/wiring smoke test', () => {
  // D-BP207-SEG-A, card t-00173320. Same measured contention finding as
  // borromean_test.test.ts's identical smoke test -- see that file's own comment for the full
  // account (D-BP168-M0-114's diagnosis, confirmed again this dispatch on a full-suite run).
  // Per-test timeout raised, code under test unchanged.
  test('SemioticSquare:1 is registered and executable', async () => {
    const { registerSemioticSquareStep } = await import('./semiotic_square_step');
    const { listComposerRegistry } = await import('./script_bridge');
    registerSemioticSquareStep();
    const entries = listComposerRegistry();
    const entry = entries.find((e) => e.id === 'SemioticSquare:1');
    expect(entry).toBeDefined();
    expect(entry?.executable).toBe(true);
  }, 20000);
});
