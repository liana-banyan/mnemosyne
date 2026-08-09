// stepped_audible.test.ts -- D-BP151-023/BISHOP/seg-stepped-audible
//
// Manual assert() + console output + process.exit(1) on failure, no test-framework dependency --
// same prior-art convention as comparative_cascade.test.ts (this file's own sibling), which this
// test copies verbatim: requires the COMPILED dist/main/liana_cycle/stepped_audible.js, same
// extensionless-import deviation, same "run after npm run build:main" instruction.
//
// Run (after `npm run build:main`):
//   node src\main\liana_cycle\stepped_audible.test.ts
//
// WHAT THIS TESTS, per this ticket's VERIFICATION section:
//   1. audible OFF (no channel, or an out-of-scope method) returns the SAME MethodRunContext
//      object by reference -- the identity assertion requirement F asks for, mirroring
//      audible.ts's own off-identity guarantee.
//   2. A stage with no Founder counterpart (STAGE 5b) is labeled TARE and carries no
//      founderStepNumber/founderWords/founderSource -- HARDWIRE-23 Law 4.
//   3. Every ATTRIBUTED entry in the live map DOES carry a founderStepNumber, founderWords and
//      founderSource -- the complement of (2), so an ATTRIBUTED entry can never silently be
//      missing its citation.
//   4. classifyStageText() correctly reads the exact prefixes comparative_cascade.ts's own
//      step()/say() calls produce (STAGE 0, Q1..Q10, STAGE 5b) and returns null for text this
//      table does not recognize, rather than guessing.
//   5. A full run through wrapForSteppedAudible() -- a fake MethodRunContext standing in for
//      comparative-cascade's own emit/askGoogle calls -- produces exactly one pause per stage
//      boundary, records the operator's response into the log (including the pauseId, the step
//      key, the attribution, and the action), and an 'abandon' response THROWS
//      SteppedAudibleAbandoned so the caller can convert it into an honest abstain.
//   6. finish() flushes the trailing (STAGE 5b) buffer even though no askGoogle call follows it --
//      the one structural gap this file's own header names and works around.
//
// No network, no model, no Electron API touched anywhere in this file.

(async function main(): Promise<void> {

const path = require('path');

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    console.log(`  [PASS] ${label}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${label}${detail ? ` -- ${detail}` : ''}`);
    failed++;
  }
}

const distPath = path.join(
  __dirname, '..', '..', '..', 'dist', 'main', 'liana_cycle', 'stepped_audible.js',
);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mod = require(distPath) as typeof import('./stepped_audible');
const {
  COMPARATIVE_CASCADE_STEP_DEFS,
  SteppedAudibleAbandoned,
  SteppedAudibleLog,
  buildUpfrontStepList,
  classifyStageText,
  wrapForSteppedAudible,
} = mod;

type TerminalEvent = { kind: string; text: string; ts: string };

function nowIso(): string {
  return new Date().toISOString();
}

console.log('stepped_audible.test.ts -- D-BP151-023 requirement F: OFF stays identical\n');

// ── 1. OFF (no channel) RETURNS THE SAME MethodRunContext OBJECT, BY REFERENCE ──────────────────
{
  const baseCtx = {
    askGoogle: async () => null,
    emit: (_e: TerminalEvent) => {},
  };
  const log = new SteppedAudibleLog();
  const wrap = wrapForSteppedAudible('comparative-cascade', baseCtx as any, null, log);
  assert(wrap.ctx === baseCtx, 'channel=null: wrapForSteppedAudible() returns the SAME ctx object by reference (identity assertion)');
}

// ── 1b. OFF (method out of scope, channel present) ALSO RETURNS THE SAME OBJECT ─────────────────
{
  const baseCtx = {
    askGoogle: async () => null,
    emit: (_e: TerminalEvent) => {},
  };
  const log = new SteppedAudibleLog();
  const channel = { requestStepPause: async () => ({ pauseId: 'x', action: 'approve' as const }) };
  const wrap = wrapForSteppedAudible('definitional-cascade', baseCtx as any, channel, log);
  assert(wrap.ctx === baseCtx, 'method out of scope (definitional-cascade): wrapForSteppedAudible() STILL returns the SAME ctx object by reference, even though a channel was supplied -- see this file\'s header on why an out-of-scope method must not be force-mapped');
}

console.log('\nstepped_audible.test.ts -- HARDWIRE-23 Law 4: ATTRIBUTED carries its citation, TARE carries none\n');

// ── 2/3. EVERY ENTRY IS EXACTLY ONE OF ATTRIBUTED (with citation) OR TARE (without) ─────────────
{
  let anyTare = false;
  for (const def of COMPARATIVE_CASCADE_STEP_DEFS) {
    if (def.attribution === 'ATTRIBUTED') {
      assert(
        typeof def.founderStepNumber === 'number' && !!def.founderWords && !!def.founderSource,
        `${def.key}: ATTRIBUTED entry carries founderStepNumber + founderWords + founderSource`,
        JSON.stringify(def),
      );
    } else {
      anyTare = true;
      assert(
        def.founderStepNumber === undefined && def.founderWords === undefined && def.founderSource === undefined,
        `${def.key}: TARE entry carries NO founderStepNumber/founderWords/founderSource (HARDWIRE-23 Law 4)`,
        JSON.stringify(def),
      );
    }
  }
  assert(anyTare, 'at least one TARE entry exists in the live map (STAGE 5b, per comparative_cascade.ts:748-754)');
  const stage5b = COMPARATIVE_CASCADE_STEP_DEFS.find((d: any) => d.key === 'stage5b');
  assert(!!stage5b && stage5b.attribution === 'TARE', 'STAGE 5b specifically is labeled TARE, not mapped to a Founder step it does not fit');
}

// ── 4. classifyStageText() reads the live code's own prefixes, and refuses to guess ─────────────
{
  assert(classifyStageText('-> STAGE 0  register gate -- is each option a member of the category at all?') === 'stage0', 'classifyStageText: "STAGE 0 ..." -> stage0');
  assert(classifyStageText('-> Q1  stage 1 -- the inverse') === 'q1', 'classifyStageText: "Q1  stage 1 ..." -> q1');
  assert(classifyStageText('-> Q6  stage 4 -- Cake Cut Half, remove the half that are least populated: A) x') === 'q6', 'classifyStageText: "Q6  stage 4 ..." -> q6');
  assert(classifyStageText('-> Q10  stage 5 -- sort by exact order...') === 'q10', 'classifyStageText: "Q10  stage 5 ..." -> q10 (two-digit number)');
  assert(classifyStageText('-> STAGE 5b  one option per question -- 2 surviving option(s)') === 'stage5b', 'classifyStageText: "STAGE 5b ..." -> stage5b');
  assert(classifyStageText('-> DEMAND TEST -- what operation must this answer perform?') === null, 'classifyStageText: an engine-level stage (DEMAND TEST) it does not cover -> null, not a guess');
  assert(classifyStageText('-> Q99  stage 9 -- nonsense') === null, 'classifyStageText: an unrecognized Q-number -> null, not a guess');
}

// ── buildUpfrontStepList() scoping ───────────────────────────────────────────────────────────
{
  const list = buildUpfrontStepList('comparative-cascade');
  assert(Array.isArray(list) && list.length === COMPARATIVE_CASCADE_STEP_DEFS.length, 'buildUpfrontStepList("comparative-cascade") returns the full static list');
  assert(buildUpfrontStepList('definitional-cascade') === null, 'buildUpfrontStepList("definitional-cascade") returns null -- this ticket did not map that method, and does not invent a list for it');
}

console.log('\nstepped_audible.test.ts -- a live-shaped run through wrapForSteppedAudible()\n');

// ── 5/6. A FAKE comparative-cascade-shaped RUN: STAGE 0 -> Q1 -> STAGE 5b -> (TERMINATOR, no
// further stage) -> finish(). Exercises pausing, response recording, abandon, and the trailing
// flush -- without any network, model, or Electron dependency. ──────────────────────────────────
async function runFakeCascade(actionsByStepKey: Record<string, 'approve' | 'correct' | 'redirect' | 'abandon'>) {
  const forwarded: TerminalEvent[] = [];
  const pausesSeen: Array<{ stepKey: string; stepIndex: number; stepTotal: number; eventCount: number; suggestionCount: number }> = [];
  const log = new SteppedAudibleLog();

  const baseCtx = {
    askGoogle: async (_q: string) => null,
    emit: (e: TerminalEvent) => { forwarded.push(e); },
  };

  const channel = {
    requestStepPause: async (pause: any) => {
      pausesSeen.push({
        stepKey: pause.step.key ?? '(unknown)',
        stepIndex: pause.stepIndex,
        stepTotal: pause.stepTotal,
        eventCount: pause.events.length,
        suggestionCount: pause.suggestions.length,
      });
      const key: string = pause.step.key;
      const action = actionsByStepKey[key] ?? 'approve';
      return { pauseId: pause.pauseId, action, text: `auto-response for ${key}` };
    },
  };

  const wrap = wrapForSteppedAudible('comparative-cascade', baseCtx as any, channel, log);
  assert(wrap.ctx !== baseCtx, 'channel armed + method in scope: wrapForSteppedAudible() returns a DIFFERENT ctx object (the wrapped one), not the same reference');

  const emit = wrap.ctx.emit;
  const ask = wrap.ctx.askGoogle;

  // STAGE 0 -- no askGoogle call of its own, same as the real register gate.
  emit({ kind: 'stage', text: '-> STAGE 0  register gate -- is each option a member of the category at all?', ts: nowIso() });
  emit({ kind: 'note', text: '   A) South America: region  [about=region]', ts: nowIso() });
  emit({ kind: 'fact', text: '+ register gate removed nothing', ts: nowIso() });

  // Q1 -- its own stage event, then a query note, then the FIRST askGoogle call. The pause for
  // STAGE 0 must fire HERE, before this call goes out (requirement C: after the previous step
  // completes, before the next begins).
  emit({ kind: 'stage', text: '-> Q1  stage 1 -- the inverse', ts: nowIso() });
  emit({ kind: 'note', text: '   Which of the following is most densely populated? A) ... B) ...', ts: nowIso() });
  await ask('Which of the following is most densely populated? A) ... B) ...');
  emit({ kind: 'fact', text: '+ Google [box+organic(3)]: South Asia and East Asia are the most densely populated', ts: nowIso() });
  emit({ kind: 'note', text: '   >> high-densely populated votes: {"B":1}   low-densely populated votes: {}', ts: nowIso() });

  // STAGE 5b -- skip straight here (Q2-Q10 omitted; this is a synthetic shape test, not a full
  // cascade replay). The pause for Q1 must fire before STAGE 5b's own first askGoogle call.
  emit({ kind: 'stage', text: '-> STAGE 5b  one option per question -- 1 surviving option(s)', ts: nowIso() });
  emit({ kind: 'note', text: '   What is the numeric value or rate associated with "densely populated" for South America? Report the number and its unit.', ts: nowIso() });
  await ask('What is the numeric value or rate associated with "densely populated" for South America? Report the number and its unit.');
  emit({ kind: 'fact', text: '+ Google [box+organic(2)]: 52.9 persons per square kilometer', ts: nowIso() });

  // TERMINATOR -- kind:'header', no more 'stage' events, no more askGoogle calls.
  emit({ kind: 'header', text: 'TERMINATOR', ts: nowIso() });
  emit({ kind: 'note', text: '   ascending: A=52.9', ts: nowIso() });
  emit({ kind: 'result', text: 'CORRECT  A (South America)  key=A', ts: nowIso() });

  // Flushes STAGE 5b + the TERMINATOR content that followed it with no further stage boundary.
  await wrap.finish();

  return { forwarded, pausesSeen, log };
}

{
  const { forwarded, pausesSeen, log } = await runFakeCascade({});
  assert(pausesSeen.length === 3, `exactly 3 pauses fired for a 3-stage-boundary fake run (STAGE 0, Q1, STAGE 5b)`, JSON.stringify(pausesSeen));
  assert(pausesSeen[0]?.stepKey === 'stage0', 'pause 1 is for stage0 (fired before Q1\'s first askGoogle call)', JSON.stringify(pausesSeen[0]));
  assert(pausesSeen[1]?.stepKey === 'q1', 'pause 2 is for q1 (fired before STAGE 5b\'s first askGoogle call)', JSON.stringify(pausesSeen[1]));
  assert(pausesSeen[2]?.stepKey === 'stage5b', 'pause 3 is for stage5b, flushed by finish() -- fires with no following askGoogle call at all', JSON.stringify(pausesSeen[2]));
  assert(pausesSeen[0]!.stepIndex === 1 && pausesSeen[0]!.stepTotal === COMPARATIVE_CASCADE_STEP_DEFS.length, 'pause 1 carries stepIndex=1 and the full stepTotal');
  assert(pausesSeen[1]!.eventCount >= 3, 'pause 2 (q1) carries every event buffered since the previous stage boundary (the stage line, the query note, the fact), not just the boundary line itself', JSON.stringify(pausesSeen[1]));
  assert(pausesSeen[2]!.eventCount >= 4, 'pause 3 (stage5b) carries STAGE 5b\'s own events PLUS the trailing TERMINATOR header/notes/result -- the disclosed "one gap" behavior', JSON.stringify(pausesSeen[2]));
  assert(pausesSeen[0]!.suggestionCount >= 2, 'pause 1 (stage0, ATTRIBUTED) carries its process-document lettered suggestions (1.a, 1.b)');
  assert(pausesSeen[2]!.suggestionCount >= 1, 'pause 3 (stage5b, TARE) still carries a suggestion list (its own TARE disclosure text)');

  // Every emitted event was forwarded to the real transcript, unsuppressed, in order.
  assert(forwarded.length === 13, 'every emit() call was forwarded to the real transcript unsuppressed (this decorator only observes)', String(forwarded.length));

  // Requirement E: every response recorded, with pauseId, step, attribution, and action.
  const recs = log.all();
  assert(recs.length === 3, 'the log holds exactly 3 records, one per pause');
  assert(recs[0]!.stepKey === 'stage0' && recs[0]!.attribution === 'ATTRIBUTED' && recs[0]!.founderStepNumber === 1, 'record 1: stage0, ATTRIBUTED, Founder step 1', JSON.stringify(recs[0]));
  assert(recs[1]!.stepKey === 'q1' && recs[1]!.attribution === 'ATTRIBUTED' && recs[1]!.founderStepNumber === 5, 'record 2: q1, ATTRIBUTED, Founder step 5', JSON.stringify(recs[1]));
  assert(recs[2]!.stepKey === 'stage5b' && recs[2]!.attribution === 'TARE' && recs[2]!.founderStepNumber === undefined, 'record 3: stage5b, TARE, no founderStepNumber', JSON.stringify(recs[2]));
  assert(recs.every((r: any) => r.action === 'approve' && typeof r.text === 'string' && r.text.length > 0), 'every record carries the operator\'s verbatim action + text (the auto-responder\'s "approve")');
  assert(new Set(recs.map((r: any) => r.pauseId)).size === 3, 'every record carries a distinct pauseId');
}

// ── ABANDON at an EARLY pause throws SteppedAudibleAbandoned, and STOPS the run right there ─────
{
  let threw: unknown = null;
  try {
    await runFakeCascade({ stage0: 'abandon' });
  } catch (e) {
    threw = e;
  }
  assert(threw instanceof SteppedAudibleAbandoned, 'abandoning at the FIRST pause (stage0) throws SteppedAudibleAbandoned, propagating past the point of the pause', String(threw));
}

// ── ABANDON at the FINAL (finish()) pause also throws, distinguishing "abandoned mid-run" from
// "abandoned reviewing an already-complete run" is the caller's job (liana_terminal_engine.ts),
// not this file's -- this file only needs to prove the throw happens at the right pause. ────────
{
  let threw: unknown = null;
  try {
    await runFakeCascade({ stage5b: 'abandon' });
  } catch (e) {
    threw = e;
  }
  assert(threw instanceof SteppedAudibleAbandoned, 'abandoning at the LAST pause (stage5b, via finish()) also throws SteppedAudibleAbandoned', String(threw));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

})();
