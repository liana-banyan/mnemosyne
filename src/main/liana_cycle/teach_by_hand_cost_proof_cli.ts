// teach_by_hand_cost_proof_cli.ts -- D-BP164-M0-088/BISHOP/M0/seg-hn -- COST INSTRUMENT PROOF.
//
// teach_by_hand_cli.ts's own end-to-end pass (qid 1, this dispatch) abstained before reaching any
// Ollama round trip -- askGoogle is honestly null in that driver (see its header), so
// comparative_cascade.ts's/classify_cascade.ts's gemmaExtract() call sites, which extract FROM
// fetched evidence, were never reached. That is an honest abstain, not a defect, but it means the
// mission's "carry the cost column" requirement (input tokens, output tokens, latency, model
// DIGEST, pinned never by name) needs its own, separate, real proof against the SAME cost
// instrument (cost_instrument.ts, no second path), rather than asserting it works from reading
// the source. This file calls gemmaExtract() DIRECTLY -- the one real Ollama call site
// runLianaCycleQuestion() itself goes through -- with a small synthetic passage, disclosed as
// synthetic below, purely to exercise recordLlmCall() against a genuinely running local model.
import { runWithLlmCostLedger, summarizeLlmCostLedger, type LlmCallCostRecord } from './cost_instrument';
import { gemmaExtract, resolveGemmaModelDigest } from './methods/comparative_cascade';
import fs from 'node:fs';
import path from 'node:path';

const LIANA_RUNS_DIR =
  'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\HARDWIRE\\LEDGER\\LIANA_RUNS';

async function main(): Promise<void> {
  const digest = await resolveGemmaModelDigest('gemma4:12b');
  console.log('resolveGemmaModelDigest(gemma4:12b) =', digest);

  const rawOut: { text?: string; costRecord?: LlmCallCostRecord } = {};

  const { result: extracted, ledger } = await runWithLlmCostLedger(async () => {
    return gemmaExtract(
      'State the single number of legs mentioned in the passage, as an integer.',
      'A synthetic proof passage for D-BP164-M0-088 (SEG-HN, cost instrument proof, not real MMLU-Pro evidence): a standard dog has four legs.',
      '{"legs": <integer or null>}',
      rawOut,
    );
  });

  console.log('gemmaExtract result:', JSON.stringify(extracted));
  console.log('rawOut.costRecord:', JSON.stringify(rawOut.costRecord, null, 2));
  console.log('ledger length (via AsyncLocalStorage scope):', ledger.length);

  const summary = summarizeLlmCostLedger(ledger);
  console.log('summary:', JSON.stringify(summary, null, 2));

  const writtenAt = new Date().toISOString();
  const safeTs = writtenAt.replace(/[:.]/g, '-');
  const outPath = path.join(LIANA_RUNS_DIR, `LIANA_TEACH_BY_HAND_COST_PROOF_${safeTs}.json`);
  const receipt = {
    schema: 'liana-teach-by-hand-cost-proof/1',
    dispatch: 'D-BP164-M0-088',
    actor: 'SEG-HN',
    session: 'BP164',
    writtenAt,
    disclosure:
      'Synthetic passage, not real MMLU-Pro evidence -- this file exists only to prove cost_instrument.ts real Ollama round-trip capture (digest pin, true token counts, latency, dollars) against the SAME gemmaExtract() call site runLianaCycleQuestion() itself uses. Not a benchmark measurement, not qid 98, not counted under REPLICATION_PROTOCOL_BP159.',
    requestedModel: 'gemma4:12b',
    resolvedDigest: digest,
    extracted,
    costRecordFromRawOut: rawOut.costRecord ?? null,
    ledger,
    summary,
  };
  fs.mkdirSync(LIANA_RUNS_DIR, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(receipt, null, 2), 'utf-8');
  const bytes = fs.statSync(outPath).size;
  console.log(`\nWROTE ${outPath} (${bytes} bytes)`);
}

main().catch((err) => {
  console.error('teach_by_hand_cost_proof_cli FAILED:', err);
  process.exit(1);
});
