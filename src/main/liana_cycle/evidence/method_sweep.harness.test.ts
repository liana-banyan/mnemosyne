// method_sweep.harness.test.ts -- D-BP153-005/BISHOP/method-sweep
//
// THE METHOD SWEEP. Take ONE question and run EVERY registered method against it, then report
// what each method WANTED TO KNOW, where it stopped, and why.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE FOUNDER'S ASK, BP153: "take the ones that are abstain or wrong, and make that a subset, and
// then from that subset take one and apply our other methods to it - and find out HOW to answer
// it."
//
// This is the "HOW" half. The subset half is bp153_subset.mjs, run against the plow receipts.
//
// WHAT THIS MEASURES, AND WHY IT IS THE RIGHT FIRST MOVE. A method's queries ARE its theory of
// the question. classify-cascade asks litmus questions to eliminate members of a category.
// comparative-cascade asks for magnitudes to rank. definitional-cascade asks what a term means.
// Run all three against one question with an askGoogle that answers NOTHING, and each method
// still emits its full query plan before it gives up. That plan is a declaration of exactly what
// evidence would be needed to answer the question by that route.
//
// So this costs zero live queries and zero rate limit, and it converts "we abstained" into
// "here are the specific facts each of our three theories of this question would need."
//
// WHY askGoogle RETURNS NULL AND THAT IS NOT CHEATING. A null answer is the honest
// "authority gave us nothing" path these methods already handle. We are not simulating an answer
// (that would fabricate evidence and is forbidden), we are observing what gets ASKED. The
// recording wrapper (evidence_authority.ts) captures every query verbatim on the way past.
//
// THE ANSWER KEY IS NOT IN THE ROOM. Input is built through parseQid() and then BLINDED, matching
// the D-BP153-003 key split: methods receive question and options only. Nothing here can tune
// toward an answer even accidentally.
//
// RUN IT:
//   npx vitest run src/main/liana_cycle/evidence/method_sweep.harness.test.ts
// Target a different question with:
//   LB_SWEEP_QID=85 npx vitest run src/main/liana_cycle/evidence/method_sweep.harness.test.ts
// The report is written to LB_SWEEP_OUT, or to the OS temp dir if unset. It writes nothing into
// the repo and nothing into any live store.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { describe, test, expect, vi } from 'vitest';

// SAME electron stub as this directory's siblings -- parseQid() reads app.isPackaged/getAppPath()
// to locate the bundled corpus, and vitest runs outside Electron.
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => path.resolve(__dirname, '..', '..', '..', '..'),
  },
}));

import { parseQid } from '../liana_terminal_engine';
import { listMethods } from '../method_registry';
import type { MethodQuestionInput, MethodRunContext } from '../method_registry';
import type { LianaTerminalEvent } from '../../../shared/liana_cycle/liana_terminal_types';
import { newAcquisitionSession, recordingAskGoogle } from './evidence_authority';
import { newAcquisitionId } from './evidence_store';
import { deriveRunShape } from './run_shape';

const QID = Number(process.env.LB_SWEEP_QID || '98');

interface MethodSweepResult {
  methodId: string;
  methodName: string;
  demand: string;
  /** Every query this method issued, in order. Its theory of the question, made explicit. */
  queriesAsked: string[];
  queryCount: number;
  shape: ReturnType<typeof deriveRunShape>;
  verdict: string | null;
  abstain: boolean;
  /** Set when the method threw rather than returning an outcome. A throw is a finding. */
  threw: string | null;
}

describe(`METHOD SWEEP -- qid ${QID} against every registered method`, () => {
  test('every method either returns an outcome or names why it could not, and its query plan is captured', async () => {
    const parsed = parseQid(QID);
    expect(parsed.qidNotFound).toBeFalsy();
    expect(parsed.options).toBeTruthy();

    // BLINDED, per D-BP153-003. correctAnswer deliberately absent.
    const blindInput: MethodQuestionInput = {
      qid: parsed.qid,
      question: parsed.question,
      options: parsed.options,
    };

    const dir = mkdtempSync(path.join(tmpdir(), 'lb-sweep-'));
    const results: MethodSweepResult[] = [];

    try {
      for (const method of listMethods()) {
        if (!method.run) continue;

        const events: LianaTerminalEvent[] = [];
        const session = newAcquisitionSession({
          acquisitionId: newAcquisitionId('2026-08-12T04-00-00-000Z', `sweep-${method.id}`),
          qid: parsed.qid ?? null,
          dir,
        });

        // Answers NOTHING. We are observing what gets ASKED, never fabricating what came back.
        const ctx: MethodRunContext = {
          askGoogle: recordingAskGoogle(async () => null, session),
          emit: (e) => events.push(e),
        };

        let verdict: string | null = null;
        let abstain = true;
        let threw: string | null = null;
        let outcome: { qid?: number; verdict: string | null; abstain: boolean; error?: string; method?: string } | null = null;

        try {
          const o = await method.run(blindInput, ctx);
          outcome = o;
          verdict = o.verdict ?? null;
          abstain = Boolean(o.abstain);
        } catch (e) {
          threw = e instanceof Error ? e.message : String(e);
        }

        results.push({
          methodId: method.id,
          methodName: method.name,
          demand: method.demand,
          queriesAsked: session.written.map((r) => r.query),
          queryCount: session.written.length,
          shape: deriveRunShape(events, outcome || { qid: parsed.qid, verdict: null, abstain: true, error: 'threw', method: method.id }),
          verdict,
          abstain,
          threw,
        });
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }

    // ── THE REPORT ────────────────────────────────────────────────────────────────────────────
    const lines: string[] = [];
    lines.push(`METHOD SWEEP -- qid ${QID}`);
    lines.push(parsed.question);
    lines.push(Object.entries(parsed.options || {}).map(([L, v]) => `  ${L}) ${v}`).join('\n'));
    lines.push('');
    lines.push('THE ANSWER KEY IS NOT IN THIS RUN (D-BP153-003 key split). askGoogle answered');
    lines.push('nothing on purpose: this measures WHAT EACH METHOD ASKS, not what it concludes.');
    lines.push('');

    for (const r of results) {
      lines.push('='.repeat(78));
      lines.push(`METHOD: ${r.methodId}  (${r.methodName})   serves demand: ${r.demand}`);
      lines.push(`  stopped at: ${r.shape.stoppedAt || '(no result event)'}`);
      lines.push(`  last stage: ${r.shape.lastStage || '(none)'}`);
      lines.push(`  verdict: ${r.verdict ?? 'none'}   abstain: ${r.abstain}${r.threw ? `   THREW: ${r.threw}` : ''}`);
      const blockedByHarness = /dynamic import callback was not specified|register gate could not execute|register gate unavailable/i
        .test(`${r.threw || ''} ${r.shape.stoppedAt || ''}`);
      if (blockedByHarness) {
        lines.push('  *** BLOCKED BY THE HARNESS, NOT BY THIS QUESTION. Stage 0\'s register gate');
        lines.push('      cannot load under vitest (register_gate_loader.ts hides its dynamic');
        lines.push('      import inside new Function so tsc cannot downlevel it; vitest has no');
        lines.push('      import callback there). This method never got to try. Sweep it again');
        lines.push('      inside the real app before concluding anything about how it would');
        lines.push('      approach this question.');
      }
      const distinct = [...new Set(r.queriesAsked)];
      lines.push(`  queries it wanted answered (${r.queryCount} issued, ${distinct.length} distinct):`);
      if (r.queryCount === 0) {
        lines.push(blockedByHarness
          ? '    (none -- blocked before issuing any query, see above)'
          : '    (none -- it stopped before issuing any query, which is itself the finding)');
      } else {
        distinct.forEach((q, i) => {
          const times = r.queriesAsked.filter((x) => x === q).length;
          lines.push(`    ${String(i + 1).padStart(2)}. [asked ${times}x] ${q.replace(/\s+/g, ' ').trim()}`);
        });
        if (r.queryCount > distinct.length) {
          lines.push('');
          lines.push(`    NOTE: ${r.queryCount} queries for ${distinct.length} distinct questions. Under this harness`);
          lines.push('    askGoogle answers nothing, and the retry convention is 3 attempts, so this');
          lines.push('    multiplier is expected HERE. It is worth measuring in a live run: BP152 saw');
          lines.push('    ~18 queries per run and Google rate-limited this machine, and a retry-on-empty');
          lines.push('    triple is the obvious candidate for where that volume comes from.');
        }
      }
      lines.push('');
    }

    lines.push('='.repeat(78));
    lines.push('HOW TO ANSWER THIS QUESTION: each block above is one theory of the question and');
    lines.push('the exact evidence that theory needs. Answer a method\'s query list and that');
    lines.push('method can run. Two methods converging on the same verdict from DIFFERENT query');
    lines.push('lists is independent corroboration; two agreeing because they asked the same');
    lines.push('question twice is one derivation counted twice.');

    const report = lines.join('\n');
    const outPath = process.env.LB_SWEEP_OUT || path.join(tmpdir(), `bp153_method_sweep_qid${QID}.txt`);
    writeFileSync(outPath, report, 'utf8');
    writeFileSync(`${outPath}.json`, JSON.stringify({ qid: QID, question: parsed.question, options: parsed.options, results }, null, 2), 'utf8');
    // eslint-disable-next-line no-console
    console.log(`\n${report}\n\nwrote ${outPath}`);

    // ── ASSERTIONS ────────────────────────────────────────────────────────────────────────────
    // KNOWN HARNESS LIMITATION, VERIFIED BP153 AND NAMED SO IT IS NEVER MISREAD AS A DEFECT IN A
    // METHOD. Stage 0's register gate loads via register_gate_loader.ts, which deliberately hides
    // its dynamic import inside `new Function('specifier', 'return import(specifier)')` (line 40)
    // so tsc cannot downlevel it back to require() -- required for the packaged Electron app.
    // Under vitest that construction has no dynamic-import callback, so the gate cannot load and
    // any method whose first stage is the register gate dies before issuing a single query.
    //
    // That is the TEST ENVIRONMENT failing, not the method, and not the question. Any report from
    // this harness must say so, or it will read as "comparative-cascade cannot handle qid 98"
    // when the truth is "comparative-cascade never got to try under vitest." A method blocked
    // this way is recorded with zero queries and must be swept again inside the real app before
    // any claim is made about how it approaches a question.
    const REGISTER_GATE_HARNESS_LIMIT = /dynamic import callback was not specified|register gate could not execute|register gate unavailable/i;
    expect(results.length).toBeGreaterThanOrEqual(3);
    for (const r of results) {
      if (r.threw && REGISTER_GATE_HARNESS_LIMIT.test(r.threw)) continue;
      expect(r.threw, `${r.methodId} threw instead of returning an outcome: ${r.threw}`).toBeNull();
    }
    // With an authority that answers nothing, no method may claim a verdict. A verdict here would
    // mean the method concluded something from zero evidence, which is the one result that would
    // genuinely alarm me.
    for (const r of results) {
      expect(r.verdict, `${r.methodId} produced a verdict from an authority that answered nothing`).toBeNull();
    }
  }, 300000);
});
