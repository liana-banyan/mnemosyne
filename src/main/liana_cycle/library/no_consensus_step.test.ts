// no_consensus_step.test.ts -- D-BP154-065/BISHOP-SEG/S52/seg-wiregate
//
// FAIL-BEFORE / PASS-AFTER for 'NoConsensus:1'. Every test below FAILS on main before this ticket,
// because no_consensus_step.ts (and its export from script_bridge.ts's registration table) did not
// exist -- the import at the top of this file alone throws "Cannot find module './no_consensus_step'".
//
// MECHANISM TEST THROUGHOUT (FD-BP153-06/HARDWIRE-22): every test that exercises the GATE
// ARITHMETIC or the PATTERN CHECK uses INVENTED vocabulary (Zorblatt/Fignorp/Quexil clusters, made
// up authority scatter) rather than qid 92's own real words -- proving each rule would survive on
// a question whose answer is unknown, the same standard every sibling step's own test file holds
// to. ONE deliberate exception (the "reproduces the real qid 92 receipt scatter" block near the
// end): qid 92's own real option text and a real 5-voice scatter taken verbatim from a measured
// production receipt (D-BP154-064's own diagnosis) are used to confirm this step reaches the SAME
// letter the forbidden mechanism reached in its correct branch, for the SAME structural reason --
// this is a validation against reality, never a rule that keys on the letter E by name.
//
// DETERMINISM IS THE POINT: 'NoConsensus:1' is unusual among this file family in that its ONLY
// external dependency is ctx.askConversationalAuthorityAs -- so, unlike every gemmaExtract-based
// sibling, it can be driven fully under vitest with a fake authority function, INCLUDING
// artificially reordering which voice's Promise settles first. The determinism tests below are the
// direct, fast proof that the gate arithmetic never depends on arrival order; the live in-app runs
// (reported separately, at least three, per D-BP154-065's own verification requirement) prove the
// real system honors that same guarantee under real network timing.

import { describe, test, expect } from 'vitest';
import {
  extractVoteLetter, isNoSingleAnswerText, registerNoConsensusStep, runNoConsensusStep,
} from './no_consensus_step';
import { listComposerRegistry } from './script_bridge';
import type { MethodQuestionInput, MethodRunContext } from '../method_registry';
import type { ConversationalAuthorityResult } from '../method_registry';

type Voice = 'user_gemini' | 'user_perplexity' | 'user_claude' | 'user_google' | 'user_chatgpt';

/** Builds a fake ctx.askConversationalAuthorityAs -- one canned response (or a failure) per voice,
 *  with an OPTIONAL artificial delay so tests can force a specific resolution order without any
 *  change to the underlying votes, proving the gate arithmetic is order-independent. */
function fakeCtx(
  responses: Partial<Record<Voice, { text: string; delayMs?: number } | 'fail' | undefined>>,
): MethodRunContext {
  const askConversationalAuthorityAs = async (
    voice: Voice, _question: string, _mcOptions?: string[],
  ): Promise<ConversationalAuthorityResult> => {
    const r = responses[voice];
    if (r === undefined || r === 'fail') {
      return { ok: false, text: '', citations: [], via: 'n/a', authority: voice };
    }
    if (r.delayMs) await new Promise((resolve) => { setTimeout(resolve, r.delayMs); });
    return { ok: true, text: r.text, citations: [], via: `conversational:${voice}`, authority: voice };
  };
  return { askGoogle: async () => null, emit: () => {}, askConversationalAuthorityAs };
}

// ─────────────────────────── invented vocabulary throughout ───────────────────────────

const INVENTED_QUESTION = 'Within Zorblatt Studies, what is the referent object of quexility?';
const INVENTED_OPT: Record<string, string> = {
  A: 'The Fignorp collective.',
  B: 'The individual Wobsy unit.',
  C: 'International Drenvale bodies.',
  D: 'Economic Yalthorp structures.',
  E: 'There is no specific referent point.',
  F: 'The environment.',
};

describe('isNoSingleAnswerText -- extraction, not judgment (invented vocabulary)', () => {
  test('matches an explicit no-single-answer assertion', () => {
    expect(isNoSingleAnswerText('There is no specific referent point.')).toBe(true);
  });
  test('matches "no consensus" phrasing', () => {
    expect(isNoSingleAnswerText('Zorblatt scholars report there is no consensus on this question.')).toBe(true);
  });
  test('does NOT match an ordinary definitional option', () => {
    expect(isNoSingleAnswerText('The individual Wobsy unit.')).toBe(false);
  });
  test('does NOT match a merely-uncertain-sounding option that never denies a single answer exists', () => {
    expect(isNoSingleAnswerText('Some Zorblatt scholars are unsure which unit applies here.')).toBe(false);
  });
});

describe('extractVoteLetter -- extraction only (HARDWIRE-22: verbatim containment, never similarity)', () => {
  test('a unique verbatim match resolves to that letter', () => {
    expect(extractVoteLetter('The correct answer is B) The individual Wobsy unit, per most scholars.', INVENTED_OPT)).toBe('B');
  });

  // D-BP154-065, LIVE-MEASURED FIX (qid 92 run 1): a browser capture routinely echoes the
  // QUESTION+OPTIONS text back ahead of the real reply -- when it does, every option's own text
  // "appears" in the raw response, so a bare appearsIn() check alone always found a 10-way
  // ambiguity and discarded a perfectly clear answer. FAIL-BEFORE: this exact shape (reproduced
  // from the real qid92_noconsensus_run1.log capture) returned null before the "Answer: <letter>"
  // marker check was added. PASS-AFTER: the marker is found and wins even with every option's text
  // sitting right there in the echo.
  test('an echoed question+full option list ahead of the real reply still resolves via the "Answer: <letter>" marker (browser_authority_types.ts\'s own buildMcAwareQueryText contract, independently re-derived here)', () => {
    const text = 'Within Zorblatt Studies, what is the referent object of quexility?\n\nOptions:\n\n'
      + 'A) The Fignorp collective.\n\nB) The individual Wobsy unit.\n\nC) International Drenvale bodies.\n\n'
      + 'D) Economic Yalthorp structures.\n\nE) There is no specific referent point.\n\nF) The environment.\n\n'
      + 'Which option is correct? Reply starting with "Answer: <letter>" then a one-sentence reason.'
      + 'Claude responded: Answer: E) There is no specific referent point, per the scattered scholarship.';
    expect(extractVoteLetter(text, INVENTED_OPT)).toBe('E');
  });

  test('an echo with NO real reply captured at all (pure capture-hop failure) is still an honest null, never a guess', () => {
    const text = 'Within Zorblatt Studies, what is the referent object of quexility?\n\nOptions:\n\n'
      + 'A) The Fignorp collective.\n\nB) The individual Wobsy unit.\n\nC) International Drenvale bodies.\n\n'
      + 'D) Economic Yalthorp structures.\n\nE) There is no specific referent point.\n\nF) The environment.\n\n'
      + 'Which option is correct? Reply starting with "Answer: <letter>" then a one-sentence reason.';
    expect(extractVoteLetter(text, INVENTED_OPT)).toBeNull();
  });

  test('zero matches is an honest null, never a guess', () => {
    expect(extractVoteLetter('This is a completely unrelated sentence about Fignorp weather.', INVENTED_OPT)).toBeNull();
  });
  test('two matching options (ambiguous) is an honest null, never a guess', () => {
    const text = 'It could be The Fignorp collective. or International Drenvale bodies. depending on interpretation.';
    expect(extractVoteLetter(text, INVENTED_OPT)).toBeNull();
  });
});

describe('runNoConsensusStep -- named failures, never a silent empty result', () => {
  test('no options at all -> ok:false with a named reason', async () => {
    const input: MethodQuestionInput = { question: 'free text, no options', options: null };
    const { result } = await runNoConsensusStep(input, fakeCtx({}));
    expect(result.ok).toBe(false);
    expect(result.error).toContain('no lettered options');
  });

  test('no option asserts no-single-answer -> inapplicable:true, never forced', async () => {
    const input: MethodQuestionInput = {
      question: INVENTED_QUESTION,
      options: { A: 'The Fignorp collective.', B: 'The individual Wobsy unit.', C: 'International Drenvale bodies.' },
    };
    const { result } = await runNoConsensusStep(input, fakeCtx({}));
    expect(result.ok).toBe(false);
    expect(result.inapplicable).toBe(true);
    expect(result.error).toContain('INAPPLICABLE');
  });

  test('two options both assert no-single-answer -> NON-DISCRIMINATING, abstains rather than picking (D-BP154-065 CONSTRAINT 4)', async () => {
    const input: MethodQuestionInput = {
      question: INVENTED_QUESTION,
      options: {
        A: 'The Fignorp collective.',
        E: 'There is no specific referent point.',
        F: 'There is no consensus on this question.',
      },
    };
    const { result } = await runNoConsensusStep(input, fakeCtx({}));
    expect(result.ok).toBe(true);
    expect(result.discriminating).toBe(false);
    expect(result.patternMatches.sort()).toEqual(['E', 'F']);
    expect(result.abstain).toBe(true);
    expect(result.abstainReason).toMatch(/NON-DISCRIMINATING/);
  });

  test('no conversational channel wired -> ok:false, named', async () => {
    const input: MethodQuestionInput = { question: INVENTED_QUESTION, options: INVENTED_OPT };
    const ctx: MethodRunContext = { askGoogle: async () => null, emit: () => {} };
    const { result } = await runNoConsensusStep(input, ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('askConversationalAuthorityAs');
  });
});

describe('runNoConsensusStep -- the gate arithmetic (invented vocabulary, own words, not the forbidden file\'s)', () => {
  test('fewer than 3 distinct paths produce a usable vote -> INSUFFICIENT INDEPENDENCE, abstain', async () => {
    const input: MethodQuestionInput = { question: INVENTED_QUESTION, options: INVENTED_OPT };
    const ctx = fakeCtx({
      user_perplexity: { text: 'B) The individual Wobsy unit.' },
      user_google: { text: 'A) The Fignorp collective.' },
      // claude/google/chatgpt/gemini all fail or are ambiguous -- only 2 usable votes
      user_claude: 'fail',
      user_chatgpt: undefined,
      user_gemini: { text: 'this response names no option at all' },
    });
    const { result } = await runNoConsensusStep(input, ctx);
    expect(result.ok).toBe(true);
    expect(result.discriminating).toBe(true);
    expect(result.abstain).toBe(true);
    expect(result.distinctPathCount).toBe(2);
    expect(result.abstainReason).toMatch(/INSUFFICIENT INDEPENDENCE/);
  });

  test('3+ paths but fewer than 3 distinct letters -> INSUFFICIENT SCATTER, abstain', async () => {
    const input: MethodQuestionInput = { question: INVENTED_QUESTION, options: INVENTED_OPT };
    const ctx = fakeCtx({
      user_perplexity: { text: 'B) The individual Wobsy unit.' },
      user_google: { text: 'B) The individual Wobsy unit.' },
      user_claude: { text: 'A) The Fignorp collective.' },
    });
    const { result } = await runNoConsensusStep(input, ctx);
    expect(result.abstain).toBe(true);
    expect(result.distinctPathCount).toBe(3);
    expect(result.distinctLetterCount).toBe(2);
    expect(result.abstainReason).toMatch(/INSUFFICIENT SCATTER/);
  });

  test('a strict majority among independent votes -> abstain, no-consensus does not apply this run', async () => {
    const input: MethodQuestionInput = { question: INVENTED_QUESTION, options: INVENTED_OPT };
    const ctx = fakeCtx({
      user_perplexity: { text: 'B) The individual Wobsy unit.' },
      user_google: { text: 'B) The individual Wobsy unit.' },
      user_claude: { text: 'B) The individual Wobsy unit.' },
      user_chatgpt: { text: 'A) The Fignorp collective.' },
      user_gemini: { text: 'C) International Drenvale bodies.' },
    });
    const { result } = await runNoConsensusStep(input, ctx);
    expect(result.abstain).toBe(true);
    expect(result.hasMajority).toBe(true);
    expect(result.pluralityLeaders).toEqual(['B']);
    expect(result.abstainReason).toMatch(/STRICT MAJORITY/);
  });

  test('the no-consensus option is itself a plurality leader -> abstain, that is corroboration not disagreement', async () => {
    const input: MethodQuestionInput = { question: INVENTED_QUESTION, options: INVENTED_OPT };
    const ctx = fakeCtx({
      user_perplexity: { text: 'E) There is no specific referent point.' },
      user_google: { text: 'E) There is no specific referent point.' },
      user_claude: { text: 'A) The Fignorp collective.' },
      user_chatgpt: { text: 'C) International Drenvale bodies.' },
    });
    const { result } = await runNoConsensusStep(input, ctx);
    expect(result.abstain).toBe(true);
    expect(result.pluralityLeaders).toContain('E');
    expect(result.abstainReason).toMatch(/PLURALITY LEADER/);
  });

  test('ACCEPT: >=3 distinct paths, >=3 distinct letters, no majority, no-consensus letter not a leader -> verdict', async () => {
    const input: MethodQuestionInput = { question: INVENTED_QUESTION, options: INVENTED_OPT };
    const ctx = fakeCtx({
      user_perplexity: { text: 'B) The individual Wobsy unit.' },
      user_google: { text: 'F) The environment.' },
      user_claude: { text: 'A) The Fignorp collective.' },
      user_chatgpt: { text: 'B) The individual Wobsy unit.' },
    });
    const { result } = await runNoConsensusStep(input, ctx);
    expect(result.abstain).toBe(false);
    expect(result.verdictLetter).toBe('E');
    expect(result.distinctPathCount).toBe(4);
    expect(result.distinctLetterCount).toBe(3);
    expect(result.hasMajority).toBe(false);
  });
});

describe('DETERMINISM: the whole point -- same votes, same verdict, regardless of which voice settles first', () => {
  test('reordering which voice resolves first (artificial delay) never changes the verdict', async () => {
    const input: MethodQuestionInput = { question: INVENTED_QUESTION, options: INVENTED_OPT };
    const votes: Partial<Record<Voice, { text: string; delayMs?: number }>> = {
      user_perplexity: { text: 'B) The individual Wobsy unit.' },
      user_google: { text: 'F) The environment.' },
      user_claude: { text: 'A) The Fignorp collective.' },
      user_chatgpt: { text: 'B) The individual Wobsy unit.' },
    };
    // Run A: perplexity slow, google fast.
    const runA = await runNoConsensusStep(input, fakeCtx({
      ...votes, user_perplexity: { ...votes.user_perplexity!, delayMs: 30 }, user_google: { ...votes.user_google!, delayMs: 1 },
    }));
    // Run B: the exact reverse ordering.
    const runB = await runNoConsensusStep(input, fakeCtx({
      ...votes, user_perplexity: { ...votes.user_perplexity!, delayMs: 1 }, user_google: { ...votes.user_google!, delayMs: 30 },
    }));
    expect(runA.result.verdictLetter).toBe('E');
    expect(runB.result.verdictLetter).toBe('E');
    expect(runA.result.verdictLetter).toBe(runB.result.verdictLetter);
    expect(runA.result.distinctPathCount).toBe(runB.result.distinctPathCount);
    expect(runA.result.distinctLetterCount).toBe(runB.result.distinctLetterCount);
    expect(runA.result.abstain).toBe(runB.result.abstain);
  });

  test('a slow dissenting voice is still counted -- the gate never evaluates before every voice settles', async () => {
    const input: MethodQuestionInput = { question: INVENTED_QUESTION, options: INVENTED_OPT };
    // If this step evaluated its gate before every voice resolved (the forbidden mechanism's own
    // bug), the slow dissenter (user_gemini, 'C') would sometimes be missing from the count,
    // occasionally flipping distinctLetterCount from 3 to 2 and the outcome from ACCEPT to abstain.
    // Run it several times; every run must count all 4 usable votes.
    for (let i = 0; i < 5; i++) {
      const ctx = fakeCtx({
        user_perplexity: { text: 'B) The individual Wobsy unit.', delayMs: 1 },
        user_google: { text: 'F) The environment.', delayMs: 1 },
        user_chatgpt: { text: 'B) The individual Wobsy unit.', delayMs: 1 },
        user_gemini: { text: 'A) The Fignorp collective.', delayMs: 40 }, // deliberately the slowest
      });
      const { result } = await runNoConsensusStep(input, ctx);
      expect(result.distinctPathCount).toBe(4);
      expect(result.distinctLetterCount).toBe(3);
      expect(result.verdictLetter).toBe('E');
    }
  });
});

describe('reproduces a real, measured qid 92 receipt scatter (D-BP154-064\'s own diagnosis) -- validation against reality, never a rule keyed on the letter', () => {
  // qid 92's own real options, read from resources/mmlu_pro_bundled/questions.jsonl this session.
  const QID92_OPT: Record<string, string> = {
    A: 'Technological systems',
    B: 'The people and their collectives.',
    C: 'International organizations',
    D: 'Economic structures',
    E: 'There is no specific referent point.',
    F: 'The environment.',
    G: 'Military power',
    H: 'Non-state actors',
    I: 'Political ideologies',
    J: 'The state and state apparatus.',
  };
  const QID92_QUESTION = 'Within Critical Security Studies, what is the referent object of security?';

  test('the real scatter from receipt shape 17 (user_perplexity:E, user_google:F, user_chatgpt:B, user_gemini:B, user_claude:J) reaches E, matching the forbidden mechanism\'s own correct branch, for the same structural reason (no majority, E not a leader)', async () => {
    const ctx = fakeCtx({
      user_perplexity: { text: 'E) There is no specific referent point.' },
      user_google: { text: 'F) The environment.' },
      user_chatgpt: { text: 'B) The people and their collectives.' },
      user_gemini: { text: 'B) The people and their collectives.' },
      user_claude: { text: 'J) The state and state apparatus.' },
    });
    const input: MethodQuestionInput = { question: QID92_QUESTION, options: QID92_OPT, correctAnswer: 'E' };
    const { result } = await runNoConsensusStep(input, ctx);
    expect(result.noConsensusOptionLetter).toBe('E');
    expect(result.distinctPathCount).toBe(5);
    expect(result.distinctLetterCount).toBe(4);
    expect(result.hasMajority).toBe(false);
    expect(result.pluralityLeaders).toEqual(['B']);
    expect(result.abstain).toBe(false);
    expect(result.verdictLetter).toBe('E');
  });

  test('the real "agree" scatter (only user_perplexity:B and specialist_swarm-equivalent unavailable -- fewer than 3 usable voices reachable) correctly abstains rather than reproducing the forbidden mechanism\'s own wrong branch', async () => {
    // The Composer has no swarm concept and cannot reach it -- this reproduces a run where only
    // perplexity answered before the other four voices failed/timed out, mirroring the SHAPE of an
    // under-informed scatter (never engineered to hit any particular letter).
    const ctx = fakeCtx({
      user_perplexity: { text: 'B) The people and their collectives.' },
      user_google: 'fail',
      user_claude: 'fail',
      user_chatgpt: 'fail',
      user_gemini: 'fail',
    });
    const input: MethodQuestionInput = { question: QID92_QUESTION, options: QID92_OPT, correctAnswer: 'E' };
    const { result } = await runNoConsensusStep(input, ctx);
    expect(result.abstain).toBe(true);
    expect(result.distinctPathCount).toBe(1);
    expect(result.abstainReason).toMatch(/INSUFFICIENT INDEPENDENCE/);
  });
});

describe('registration/wiring smoke test', () => {
  test('NoConsensus:1 is registered and executable', () => {
    registerNoConsensusStep();
    const entries = listComposerRegistry();
    const entry = entries.find((e) => e.id === 'NoConsensus:1');
    expect(entry).toBeDefined();
    expect(entry?.executable).toBe(true);
  });
});
