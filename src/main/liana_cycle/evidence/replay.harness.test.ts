// replay.harness.test.ts -- D-BP153-009/BISHOP/replay-runner
//
// REPLAYS A STORED ACQUISITION THROUGH THE LIVE DERIVATION, OFFLINE, WITH NO NETWORK.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// FD-BP153-03, Founder verbatim: "we don't pay rent on answers, we pay the mortgage to own them."
// This file is where owning them pays. An acquisition was bought once, with real queries against
// real authorities. From here on, every derivation over it is free, repeatable, and reaches no
// network at all.
//
// WHAT IT IS FOR, IN ORDER OF VALUE:
//   1. DETERMINISM, MEASURED NOT ASSERTED. Run the same acquisition twice and diff the shapes. A
//      non-empty diff means the derivation is not a pure function of its evidence, which is a
//      defect in us, not in Google.
//   2. REGRESSION AS A DIFF, NOT AN EXPEDITION. Change the code, replay every stored acquisition,
//      diff the shapes against the receipts they came from. That is the promotion gate's
//      primitive.
//   3. NO RATE LIMIT CAN STOP THE WORK. BP152's block halted the whole campaign. With evidence
//      owned, a block costs new questions, never the ability to work the ones already bought.
//
// HONEST LIMITS, STATED RATHER THAN DISCOVERED LATER:
//   - `gemmaExtract()` still calls the LOCAL model (Ollama). That is a transformation over stored
//     evidence, not an acquisition of new evidence, so it is deliberately outside the store's
//     charter (see evidence_authority.ts's header). Consequence: a replay is deterministic FOR A
//     FIXED local model. Change the Ollama version or the weights and a replay can move without
//     the evidence changing. If that ever bites, record the model identity per acquisition.
//   - A MISS is not silently tolerated. Replay runs with onMiss:'collect', so a query the
//     derivation issues that the acquisition never recorded is REPORTED as a miss rather than
//     answered with a fabricated null. Misses are the finding: they name what the code now asks
//     that it did not ask when the evidence was bought.
//
// RUN IT:
//   npx vitest run src/main/liana_cycle/evidence/replay.harness.test.ts
//   LB_REPLAY_QID=85 npx vitest run src/main/liana_cycle/evidence/replay.harness.test.ts
// Report goes to LB_REPLAY_OUT, else the OS temp dir. Writes nothing into the ledger.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { describe, test, expect, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => path.resolve(__dirname, '..', '..', '..', '..'),
  },
}));

import { runLianaCycleQuestion } from '../liana_terminal_engine';
import type { LianaTerminalEvent } from '../../../shared/liana_cycle/liana_terminal_types';
import { listAcquisitions, loadAcquisition } from './evidence_store';
import { buildReplay } from './evidence_authority';
import { deriveRunShape, diffRunShapes } from './run_shape';

const QID = Number(process.env.LB_REPLAY_QID || '98');

describe(`REPLAY -- qid ${QID} derived from frozen evidence, no network`, () => {
  test('replays a stored acquisition and reports the shape, the misses, and the unconsumed evidence', async () => {
    const acquisitionIds = listAcquisitions(QID);
    if (!acquisitionIds.length) {
      // NOT a silent skip. If there is no evidence, say so loudly and say what would produce it.
      // eslint-disable-next-line no-console
      console.log(
        `\nNO ACQUISITION ON DISK FOR qid ${QID}.\n`
        + 'Nothing to replay. An acquisition is created by running this qid through the Liana Cycle\n'
        + 'tab in the app (the "liana-terminal-run" path, which is the one wired to the store).\n',
      );
      expect(acquisitionIds).toEqual([]);
      return;
    }

    const chosen = process.env.LB_REPLAY_ACQUISITION || acquisitionIds[acquisitionIds.length - 1];
    const { acquisition, malformedLines } = loadAcquisition(QID, chosen);
    expect(acquisition, `acquisition ${chosen} did not load`).not.toBeNull();
    // A partially readable acquisition must never be replayed as though it were whole.
    expect(malformedLines, 'acquisition has malformed lines and is INCOMPLETE').toBe(0);

    const runOnce = async () => {
      const events: LianaTerminalEvent[] = [];
      const replay = buildReplay(acquisition!, { onMiss: 'collect' });
      const outcome = await runLianaCycleQuestion(
        String(QID),
        replay.askGoogle,
        (e) => events.push(e),
        null,
        null,
        undefined,
        undefined,
        replay.askConversationalAuthority,
      );
      return { outcome, shape: deriveRunShape(events, outcome), replay, events };
    };

    const first = await runOnce();
    const second = await runOnce();

    const lines: string[] = [];
    lines.push(`REPLAY -- qid ${QID}`);
    lines.push(`acquisition: ${chosen}   records: ${acquisition!.records.length}   acquired: ${acquisition!.acquiredAt}`);
    lines.push(`available acquisitions for this qid: ${acquisitionIds.length}`);
    lines.push('');
    lines.push('DERIVED SHAPE:');
    lines.push(JSON.stringify(first.shape, null, 2));
    lines.push('');
    lines.push(`verdict=${first.outcome.verdict}  abstain=${first.outcome.abstain}  method=${first.outcome.method}  error=${first.outcome.error || 'none'}`);
    lines.push('');
    const misses = first.replay.misses();
    lines.push(`MISSES (${misses.length}) -- queries the derivation issued that this acquisition never recorded:`);
    misses.forEach((m, i) => lines.push(`  ${i + 1}. [${m.authority}] ${m.query.replace(/\s+/g, ' ').slice(0, 160)}`));
    if (!misses.length) lines.push('  (none -- the derivation asked exactly what was bought)');
    lines.push('');
    const unconsumed = first.replay.unconsumed();
    lines.push(`UNCONSUMED (${unconsumed.length}) -- evidence bought that this derivation never asked for:`);
    unconsumed.forEach((u, i) => lines.push(`  ${i + 1}. [${u.authority}] ${u.query.replace(/\s+/g, ' ').slice(0, 160)}`));
    if (!unconsumed.length) lines.push('  (none)');
    lines.push('');

    const selfDiff = diffRunShapes(first.shape, second.shape);
    lines.push(`DETERMINISM CHECK -- same evidence, two runs, shape diff: ${selfDiff.length === 0 ? 'IDENTICAL' : `${selfDiff.length} FIELD(S) MOVED`}`);
    selfDiff.forEach((d) => lines.push(`  ${d.field}: ${JSON.stringify(d.before)} -> ${JSON.stringify(d.after)}`));

    const report = lines.join('\n');
    const outPath = process.env.LB_REPLAY_OUT || path.join(tmpdir(), `bp153_replay_qid${QID}.txt`);
    writeFileSync(outPath, report, 'utf8');
    // eslint-disable-next-line no-console
    console.log(`\n${report}\n\nwrote ${outPath}`);

    // THE ASSERTION THAT MATTERS. The derivation must be a pure function of the frozen evidence.
    // If this fails, the run depends on something outside the evidence -- a clock, ambient state,
    // or the local model drifting -- and that is a defect in us, not in the authority.
    expect(selfDiff, `derivation is NOT deterministic over frozen evidence: ${JSON.stringify(selfDiff)}`).toEqual([]);
  }, 600000);
});
