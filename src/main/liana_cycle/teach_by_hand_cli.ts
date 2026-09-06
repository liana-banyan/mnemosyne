// teach_by_hand_cli.ts -- D-BP164-M0-088/BISHOP/M0/seg-hn -- THE HUMAN NUANCE STEP, AS COMPOSER,
// FROM A REAL TERMINAL.
//
// Founder ruling tonight, verbatim: "For human nuance, IMPLEMENT THE LIANA CYCLE for that - with
// Composer. that's the point of it." And, resolving a prior ambiguity: "BP149 - teaching by hand,
// that's what I meant." BP149's own canon
// (canon_the_liana_cycle_is_a_method_registry_taught_by_humans_bp149.eblet.md) quotes the
// Founder's own provenance for this exact shape: "put this engine behind the terminal, so I just
// type the question... I guide, I train, I give the Human Nuance, and you record (through
// MnemosyneC) and learn and apply."
//
// THIS FILE DOES NOT BUILD A NEW CASCADE, A NEW STAGE ORDER, OR A NEW SELECTOR. Everything that
// answers the question is already built and already wired:
//   - The Founder's five-stage order lives in methods/comparative_cascade.ts, unmodified here.
//   - The per-stage pause -- "stop before the next step and show suggestions, for me to respond
//     to or correct" (Founder, BP151) -- already exists: stepped_audible.ts's
//     COMPARATIVE_CASCADE_STEP_DEFS table maps every comparative-cascade stage to the Founder's
//     own step number and his own words (founderStepNumber/founderWords), and
//     runLianaCycleQuestion() already accepts a SteppedAudibleChannel as its 5th argument and
//     already returns outcome.steppedLog: LianaSteppedRecord[] with his verbatim text on every
//     'correct'/'redirect' response. This file supplies ONLY the channel implementation -- a real
//     Node readline prompt reading his real terminal stdin -- because the two CLI drivers that
//     already exist (scripts/liana_run_cli.mjs, scripts/liana_composer_run_cli.mjs) both attach
//     over CDP to a running Electron window and both DELIBERATELY force
//     audible/steppedAudible=false (their own header comments: "a headless script can never
//     answer" a human-only pause). Neither can drive an interactive teaching session from a bare
//     terminal with no Electron app open. That gap -- not the cascade, not the pause mechanism,
//     not the receipt shape -- is what this file closes.
//   - LLM cost capture is already unconditional inside comparative_cascade.ts's gemmaExtract()
//     (every real Ollama round trip calls cost_instrument.ts's recordLlmCall(), digest-pinned).
//     This file only opens the AsyncLocalStorage scope (runWithLlmCostLedger) so those records
//     are collected for THIS run's receipt, and attaches the resulting ledger/summary as two
//     ADDITIVE fields no existing reader depends on.
//
// WHAT THIS FILE DELIBERATELY DOES NOT DO (FD-BP164-08, STEP 4 of this dispatch's own brief):
// it does not call method_registry.ts's selectMethod() itself, does not add a new method-shape
// classifier, and does not decide in advance which recorded method a future question should use.
// The operator names comparative-cascade by typing a qid/free-text question the SAME way
// runLianaCycleQuestion's existing automated path already resolves it (demand -> method), and
// the human intervenes at STAGE boundaries inside whichever method that already picked. No
// selection condition is authored here.
//
// EVIDENCE HONESTY: this driver's askGoogle is a named, disclosed stand-in that returns null on
// every call (no browser automation is wired into a bare-Node CLI process) -- NOT the
// "stub/fake-Google path" REPLICATION_PROTOCOL_BP159.md Part Six forbids, because this run is not
// counted under that protocol and fabricates no evidence; it returns an honest "no result",
// which the existing cascade already treats as insufficient evidence rather than a fake answer.
// A receipt from this driver will therefore tend to abstain on evidence-dependent stages unless
// the operator's own typed 'redirect' text supplies the missing authority by hand -- which is
// exactly BP149's point.
//
// USAGE (compiled to dist/main/liana_cycle/teach_by_hand_cli.js by `npm run build:main`):
//   node --require <electron_shim_preload.cjs> dist/main/liana_cycle/teach_by_hand_cli.js --qid=98

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { runLianaCycleQuestion } from './liana_terminal_engine';
import type { AskGoogleFn, EmitFn } from './method_registry';
import type { SteppedAudibleChannel } from './stepped_audible';
import { runWithLlmCostLedger, summarizeLlmCostLedger } from './cost_instrument';
import type {
  LianaSteppedPause,
  LianaSteppedResponse,
  LianaSteppedAction,
  LianaTerminalEvent,
} from '../../shared/liana_cycle/liana_terminal_types';

const LIANA_RUNS_DIR =
  'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\HARDWIRE\\LEDGER\\LIANA_RUNS';

function nowIso(): string {
  return new Date().toISOString();
}

function eventLine(e: LianaTerminalEvent): string {
  const anyE = e as unknown as Record<string, unknown>;
  const text = typeof anyE.text === 'string' ? anyE.text : JSON.stringify(anyE);
  return `  [${e.kind}] ${text}`;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const qidArg = argv.find((a) => a.startsWith('--qid='));
  const inputArg = argv.find((a) => a.startsWith('--input='));
  const autoApprove = argv.includes('--auto-approve'); // smoke-test path, disclosed in the receipt
  // D-BP164-M0-114/BISHOP/M0/seg-resume -- FIXED: `.split('=')[1]` silently truncated at the FIRST
  // '=' INSIDE the value, not just the flag's own '=' -- so any question containing a literal '='
  // (any equation -- "x = 2k-1", "AB - BD = 7", the entire OlympiadBench/competition-math shape
  // this file's own header names as the point of a bare-terminal teaching session) lost everything
  // from that point on, silently. Measured live this dispatch: qid 2642 (OlympiadBench,
  // "...log_y x^5 & =2k-1...") was cut to "...log_y x^5 & " -- the question fed to the cycle was
  // not the question asked. `.slice(prefix.length)` takes everything after the FIRST '=' only
  // (the flag's own), same as every other `--flag=value` parser in this codebase (grep this repo
  // for `.startsWith('--` and no other site chains `.split('=')[1]` on a value that can itself
  // contain '='). No other behavior of this line changes: a value with no embedded '=' produces
  // the byte-identical result either way.
  const input = qidArg
    ? qidArg.slice('--qid='.length)
    : inputArg ? inputArg.slice('--input='.length) : (argv[0] ?? '98');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('=== LIANA CYCLE -- TEACH BY HAND (D-BP164-M0-088) ===');
  console.log(`Input: ${input}`);
  console.log(
    autoApprove
      ? 'MODE: --auto-approve smoke test (no live typing -- every pause answered "approve" automatically). This is a mechanism proof, NOT a real teaching session.'
      : 'MODE: interactive. At each pause, type approve / correct / redirect / abandon, then Enter.',
  );

  const askGoogle: AskGoogleFn = async (_question: string) => {
    // Disclosed stand-in -- see file header "EVIDENCE HONESTY". Always an honest null, never a
    // fabricated result.
    return null;
  };

  const emit: EmitFn = (event: LianaTerminalEvent) => {
    console.log(eventLine(event));
  };

  const steppedChannel: SteppedAudibleChannel = {
    requestStepPause: async (pause: LianaSteppedPause): Promise<LianaSteppedResponse> => {
      console.log('\n--------------------------------------------------------------');
      console.log(`STEP ${pause.stepIndex} of ${pause.stepTotal}: ${pause.step.codeLabel}`);
      if (pause.step.attribution === 'ATTRIBUTED' && pause.step.founderWords) {
        console.log(`  Founder step ${pause.step.founderStepNumber ?? '?'}, his own words:`);
        console.log(`  "${pause.step.founderWords}"`);
        console.log(`  (source: ${pause.step.founderSource ?? 'unattributed'})`);
      } else {
        console.log('  (TARE -- no Founder-attributed step maps to this stage)');
      }
      console.log('  What just happened:');
      for (const e of pause.events) console.log(eventLine(e));

      if (autoApprove) {
        console.log('  -> auto-approve');
        return { pauseId: pause.pauseId, action: 'approve' };
      }

      const actionRaw = (
        await rl.question('approve / correct / redirect / abandon > ')
      )
        .trim()
        .toLowerCase();
      const action: LianaSteppedAction =
        actionRaw === 'correct' || actionRaw === 'redirect' || actionRaw === 'abandon'
          ? (actionRaw as LianaSteppedAction)
          : 'approve';

      let text: string | undefined;
      if (action === 'correct' || action === 'redirect') {
        text = await rl.question('Type exactly what you did and why (verbatim, recorded) > ');
      }
      return { pauseId: pause.pauseId, action, text };
    },
  };

  const { result: outcome, ledger } = await runWithLlmCostLedger(async () => {
    return runLianaCycleQuestion(input, askGoogle, emit, null, steppedChannel);
  });

  rl.close();

  const llmCostSummary = summarizeLlmCostLedger(ledger);

  const writtenAt = nowIso();
  const safeTs = writtenAt.replace(/[:.]/g, '-');
  const isQid = /^\d+$/.test(input);
  const outName = `LIANA_TEACH_BY_HAND_RUN_${isQid ? `qid${input}` : 'freetext'}_${safeTs}.json`;
  const outPath = path.join(LIANA_RUNS_DIR, outName);

  const receipt = {
    schema: 'liana-teach-by-hand-run-receipt/1',
    dispatch: 'D-BP164-M0-088',
    actor: 'SEG-HN',
    session: 'BP164',
    writtenAt,
    input,
    smokeTest: autoApprove,
    evidenceDisclosure:
      'askGoogle in this driver always returns null (no browser automation wired into this bare-Node CLI). Evidence-dependent stages will honestly report insufficient evidence unless the operator supplies missing authority by hand via a redirect/correct response. Not the forbidden stub/fake-Google path: no fabricated evidence, and this run is not counted under REPLICATION_PROTOCOL_BP159.',
    outcome,
    steppedLog: outcome.steppedLog ?? null,
    llmCostLedger: ledger,
    llmCostSummary,
  };

  fs.mkdirSync(LIANA_RUNS_DIR, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(receipt, null, 2), 'utf-8');
  const bytes = fs.statSync(outPath).size;
  console.log(`\nWROTE ${outPath} (${bytes} bytes)`);
  console.log(`verdict=${outcome.verdict} abstain=${outcome.abstain} method=${outcome.method ?? 'none'}`);
  console.log(`LLM calls this run: ${llmCostSummary.callCount}, total latency ${llmCostSummary.totalLatencyMs}ms`);
}

main().catch((err) => {
  console.error('teach_by_hand_cli FAILED:', err);
  process.exit(1);
});
