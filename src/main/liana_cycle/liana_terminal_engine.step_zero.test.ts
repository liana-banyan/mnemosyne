// liana_terminal_engine.step_zero.test.ts -- D-BP152-019/BISHOP/seg-step-zero
//
// Verifies FD-BP152-14 (STEP 0: state the question, fully -- Founder, BP152, verbatim: "Remember.
// the FIRST thing to do is to state the question, fully.") lands as a real STEP, not preamble:
//
//   (a) exactly one kind:'stage' STEP 0 event fires, and it is the FIRST event of the run --
//       before any other 'stage'/'header'/'note'/etc.
//   (b) Step 0's state (carried via emit()/note() -- the SAME mechanism every other transcript
//       fact already uses; no new receipt field) states the question verbatim and complete, the
//       option list verbatim and complete, an explicit options-exist boolean, and the source.
//   (c) a question with NO option list produces a valid Step 0 with the flag FALSE -- not a
//       throw, not a silently empty list.
//   (d) REGRESSION -- outcome.verdict/abstain/error are byte-identical to the values this engine
//       produced for these exact two inputs BEFORE this ticket's edit (captured by running this
//       same test against the pre-edit liana_terminal_engine.ts, D-BP152-019's own verification
//       step, and hardcoded below) -- proving Step 0 becoming a real step changed nothing about
//       what the run DOES.
//
// Uses vitest directly against SOURCE (not dist -- see this ticket's PROCESS SAFETY constraint:
// no build step may write into dist\ while the Founder's own `npm run dev` is running). electron
// is mocked because loadQuestion()'s qid branch touches `app.isPackaged`/`app.getAppPath()`,
// which only resolves inside a real Electron process; every OTHER existing test in this
// directory (contingency_operator, sc01_crash_safety) dodges this by using free-text-only input.
// This test instead mocks 'electron' so the qid branch can be exercised too, for full coverage of
// the SOURCE field's qid+corpus format.

import { describe, test, expect, vi } from 'vitest';
import path from 'node:path';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => path.resolve(__dirname, '..', '..', '..'),
  },
}));

import { runLianaCycleQuestion } from './liana_terminal_engine';

type TerminalEvent = { kind: string; text: string; ts: string };

const fakeAskGoogle = async (_q: string) => null;

async function run(input: string): Promise<{ events: TerminalEvent[]; outcome: Awaited<ReturnType<typeof runLianaCycleQuestion>> }> {
  const events: TerminalEvent[] = [];
  const outcome = await runLianaCycleQuestion(input, fakeAskGoogle, (e: TerminalEvent) => events.push(e));
  return { events, outcome };
}

describe('STEP 0 -- state the question, fully (FD-BP152-14)', () => {

  test('qid input: Step 0 is the FIRST STEP of the run, fires exactly once, and carries qid+corpus as source, verbatim question, verbatim options, optionsExist=true', async () => {
    const { events, outcome } = await run('1');

    const stageEvents = events.filter((e) => e.kind === 'stage' && /STEP 0/.test(e.text));
    expect(stageEvents.length, 'exactly one STEP 0 stage event').toBe(1);

    // Step 0 is the FIRST kind:'stage' event of the run -- every other step boundary this run
    // emits (DEMAND TEST, METHOD SELECTION, etc.) comes after it, by construction (it is the
    // minimum index of that filter). The only thing this run emits before Step 0 is the
    // pre-existing GATES receipt line (note(), not a step) -- unaffected by, and out of scope
    // for, this ticket; asserted explicitly here so a regression that puts something ELSE ahead
    // of Step 0 is caught.
    const step0Idx = events.findIndex((e) => e.kind === 'stage');
    expect(step0Idx, 'a stage event exists at all').toBeGreaterThanOrEqual(0);
    expect(events[step0Idx].text, 'the first stage event IS Step 0').toMatch(/STEP 0/);
    const preceding = events.slice(0, step0Idx);
    expect(
      preceding.every((e) => e.kind === 'note' && /GATES/.test(e.text)),
      'nothing precedes Step 0 except the pre-existing GATES receipt note',
    ).toBe(true);

    const noteTexts = events.filter((e) => e.kind === 'note').map((e) => e.text).join('\n');
    expect(noteTexts, 'source names the bundled corpus for a qid run').toMatch(/qid 1.*bundled MMLU-Pro corpus/);
    expect(noteTexts, 'question text is present verbatim').toContain('Which of the following would most likely provide examples of mitotic cell divisions?');
    expect(noteTexts, 'options-exist flag is explicitly true').toMatch(/OPTIONS EXIST: true/);
    expect(noteTexts, 'option A is present verbatim').toContain('cross section of muscle tissue');

    // (d) REGRESSION -- values captured from the PRE-edit engine for qid 1 with fakeAskGoogle
    // (D-BP152-019 VERIFY step, run before the production edit landed): verdict=null,
    // abstain=true, error='no_method_matched', correct='B'.
    expect(outcome.verdict).toBe(null);
    expect(outcome.abstain).toBe(true);
    expect(outcome.error).toBe('no_method_matched');
    expect(outcome.qid).toBe(1);
    expect(outcome.correct).toBe('B');
  });

  test('free-text input WITH inline lettered options: Step 0 carries them verbatim, optionsExist=true', async () => {
    const input = 'What is the capital of France? A) London B) Paris C) Berlin';
    const { events, outcome } = await run(input);

    const stageEvents = events.filter((e) => e.kind === 'stage' && /STEP 0/.test(e.text));
    expect(stageEvents.length).toBe(1);
    const step0Idx = events.findIndex((e) => e.kind === 'stage');
    expect(events[step0Idx].text).toMatch(/STEP 0/);
    expect(
      events.slice(0, step0Idx).every((e) => e.kind === 'note' && /GATES/.test(e.text)),
      'nothing precedes Step 0 except the pre-existing GATES receipt note',
    ).toBe(true);

    const noteTexts = events.filter((e) => e.kind === 'note').map((e) => e.text).join('\n');
    expect(noteTexts).toMatch(/free text/);
    expect(noteTexts).toContain('What is the capital of France?');
    expect(noteTexts).toMatch(/OPTIONS EXIST: true/);
    expect(noteTexts).toContain('Paris');

    // (d) REGRESSION, same input, pre-edit engine: verdict=null, abstain=true,
    // error='demand_unknown'.
    expect(outcome.verdict).toBe(null);
    expect(outcome.abstain).toBe(true);
    expect(outcome.freeText).toBe(true);
    expect(outcome.error).toBe('demand_unknown');
  });

  test('(c) free-text input with NO option list: Step 0 handles the no-options case as first-class -- flag false, no throw, no silently empty list', async () => {
    const input = 'A plain declarative sentence with nothing quoted and no defines-cue in it at all.';
    let threw = false;
    let events: TerminalEvent[] = [];
    let outcome: Awaited<ReturnType<typeof runLianaCycleQuestion>> | null = null;
    try {
      const result = await run(input);
      events = result.events;
      outcome = result.outcome;
    } catch {
      threw = true;
    }

    expect(threw, 'a question with no options must not throw at Step 0').toBe(false);

    const stageEvents = events.filter((e) => e.kind === 'stage' && /STEP 0/.test(e.text));
    expect(stageEvents.length).toBe(1);
    const step0Idx = events.findIndex((e) => e.kind === 'stage');
    expect(events[step0Idx].text).toMatch(/STEP 0/);
    expect(
      events.slice(0, step0Idx).every((e) => e.kind === 'note' && /GATES/.test(e.text)),
      'nothing precedes Step 0 except the pre-existing GATES receipt note',
    ).toBe(true);

    const noteTexts = events.filter((e) => e.kind === 'note').map((e) => e.text).join('\n');
    expect(noteTexts, 'options-exist flag is explicitly FALSE, not omitted').toMatch(/OPTIONS EXIST: false/);
    expect(noteTexts, 'the no-options case says so plainly rather than emitting an empty list').toMatch(/no lettered option list/);
    expect(outcome?.options ?? null, 'outcome.options stays null for a bare question, unaffected by this ticket').toBe(null);

    // (d) REGRESSION, same input, pre-edit engine (matches the shape
    // liana_terminal_engine.sc01_crash_safety.test.ts already exercises with this identical
    // input string): verdict=null, abstain=true, error='demand_unknown'.
    expect(outcome?.verdict).toBe(null);
    expect(outcome?.abstain).toBe(true);
    expect(outcome?.error).toBe('demand_unknown');
  });
});
