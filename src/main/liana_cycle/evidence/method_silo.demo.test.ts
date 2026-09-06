// method_silo.demo.test.ts -- D-BP164-M0-122/BISHOP-SEG-SILO/M0
//
// THE OBSERVABLE, TWO-STEP DEMONSTRATION, matching connector_celpane.demo.test.ts's own
// convention exactly (D-BP164-M0-121): deposit ONE real methodology eblet, mint a silo celpane
// for its demand kind, fetch the full text back, and write both step artifacts to disk with real
// byte sizes so BISHOP-M0 can inspect the round trip directly.
//
// WHAT IS DEPOSITED IS A REAL, ALREADY-DOCUMENTED FACT, NOT AN INVENTED ONE:
// canon_the_liana_cycle_is_a_method_registry_taught_by_humans_bp149.eblet.md records that METHOD
// 2, the Definitional Cascade (`methods.definitional_cascade.definitionalCascadeMethod`,
// method_registry.ts), was "Taught by the Founder's qid 85 walkthrough" and resolves demand kind
// DEFINE ("the answer is a meaning" -- demand_test.ts's own LianaDemand comment for qid 85). This
// test deposits exactly that mapping -- demand kind, method id, what the method does (quoted
// verbatim from method_registry.ts's own DEFINITIONAL_CASCADE_DECLARATION.whatItDoes), and who
// taught it (a canon citation) -- and NEVER qid 85's actual answer option. See method_silo.ts's
// own header for why that is a structural guarantee, not a promise.
//
// ISOLATED: uses a temp dir (LB_METHOD_SILO_DIR override), never touches the real
// HARDWIRE\LEDGER\EBLETS\METHOD_SILO on disk -- same isolation discipline every other store test
// in this estate (evidence_store.test.ts, purpose_receipt_store's own siblings) already applies.

import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  auditSiloForAnswerLeakage,
  depositMethodologyEblet,
  fetchSiloCelpaneFullText,
  mintSiloCelpane,
  summarizeMethodSilo,
} from './method_silo';
import { mintMethodQueryReceipt } from '../library/method_query_receipt_store';

const ARTIFACT_DIR = 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\BISHOP_DROPZONE';
const DEPOSIT_ARTIFACT = join(ARTIFACT_DIR, 'D-BP164-M0-122_method_silo_demo_step1_deposit.json');
const MINT_ARTIFACT = join(ARTIFACT_DIR, 'D-BP164-M0-122_method_silo_demo_step2_mint.json');
const FETCH_ARTIFACT = join(ARTIFACT_DIR, 'D-BP164-M0-122_method_silo_demo_step3_fetch.json');

describe('D-BP164-M0-122 method silo -- real deposit, real two-step connector resolution, isolated dir', () => {
  it('deposit -> mint (small, no method-description text) -> fetch (full text, byte-verified) -> mechanical audit clean', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'method-silo-demo-'));
    try {
      const receiptsDir = mkdtempSync(join(tmpdir(), 'method-silo-receipts-'));

      // ── STEP 0: RECORD THE QUERY (separate artifact class, Founder's second correction) ──────
      const queryReceipt = mintMethodQueryReceipt({
        kind: 'silo_mint',
        qid: 85,
        demandKind: 'DEFINE',
        methodId: 'methods.definitional_cascade.definitionalCascadeMethod',
        runId: 'D-BP164-M0-122-demo-run',
        dispatchId: 'D-BP164-M0-122',
        ok: true,
      }, receiptsDir);
      expect(queryReceipt.schema).toBe('liana-method-query-receipt/1');
      expect(queryReceipt.stratum).toBe('sand');

      // ── STEP 1: DEPOSIT (write path) ──────────────────────────────────────────────────────────
      const whatItDoes = 'Answers questions that ask what a term means, where the options are '
        + 'competing definitions -- it looks up every verified meaning of the term, but honestly '
        + 'says it does not know rather than guessing when it cannot match a meaning to one of the '
        + 'options.'; // quoted verbatim from method_registry.ts's own
                        // DEFINITIONAL_CASCADE_DECLARATION.whatItDoes -- never authored fresh here.
      const deposit = depositMethodologyEblet({
        demandKind: 'DEFINE',
        methodId: 'methods.definitional_cascade.definitionalCascadeMethod',
        whatItDoes,
        taughtBy: 'canon_the_liana_cycle_is_a_method_registry_taught_by_humans_bp149 -- '
          + '"METHOD 2 -- THE DEFINITIONAL CASCADE ... Taught by the Founder\'s qid 85 walkthrough."',
        qid: 85,
        runId: 'D-BP164-M0-122-demo-run',
        dispatchId: 'D-BP164-M0-122',
        hexConnector: 'PROOF',
        hexConnectorJustification: 'PROOF\'s keeper (keeper_proof_and_measurement.md, cited from '
          + 'MEMORY.md) holds "Cascade/plow measurement discipline, MMLU-Pro receipt locations ... '
          + 'Rooting Rule" -- a demand-kind-to-method mapping produced by the Liana Cycle\'s method '
          + 'registry is exactly cascade/method measurement discipline, not a standing RULE '
          + '(RULES), not campaign STATE, and not HARDWIRE ledger/mesh protocol.',
        sessionLabel: 'BP164',
        model: 'claude-sonnet-5',
        filedBy: 'D-BP164-M0-122/SEG-SILO, model claude-sonnet-5',
        relatedSlugs: ['canon-the-liana-cycle-is-a-method-registry-taught-by-humans-bp149'],
        dir,
      });
      expect(deposit.ok).toBe(true);
      if (!deposit.ok) return;
      expect(deposit.bytes).toBeGreaterThan(0);

      // ── STEP 2: MINT (read path, step one -- small pointer) ──────────────────────────────────
      const mintOutcome = mintSiloCelpane('DEFINE', { dir });
      expect(mintOutcome.ok).toBe(true);
      if (!mintOutcome.ok) return;
      const { celpane, tokens, withinBudget } = mintOutcome;
      expect(withinBudget).toBe(true);
      expect(celpane.n).toBe(1);
      expect(celpane.methods).toEqual(['definitional_cascade']);
      // THE WHOLE CLAIM UNDER TEST: the celpane cannot carry the method description or the
      // taught-by citation -- only counts and ids.
      const celpaneJson = JSON.stringify(celpane);
      expect(celpaneJson).not.toContain('competing definitions');
      expect(celpaneJson).not.toContain('qid 85 walkthrough');

      mintMethodQueryReceipt({
        kind: 'silo_mint', qid: 85, demandKind: 'DEFINE',
        methodId: 'methods.definitional_cascade.definitionalCascadeMethod',
        runId: 'D-BP164-M0-122-demo-run', dispatchId: 'D-BP164-M0-122',
        ok: true, tokensEstimated: tokens, withinBudget,
      }, receiptsDir);

      // ── STEP 3: FETCH (read path, step two -- the full text, only on demand) ─────────────────
      const fetchOutcome = await fetchSiloCelpaneFullText(celpane, { dir });
      expect(fetchOutcome.ok).toBe(true);
      if (!fetchOutcome.ok) return;
      expect(fetchOutcome.text).toContain('competing definitions');
      expect(fetchOutcome.text).toContain('qid 85 walkthrough');
      expect(fetchOutcome.bytes).toBeGreaterThan(0);

      mintMethodQueryReceipt({
        kind: 'silo_fetch', qid: 85, demandKind: 'DEFINE',
        methodId: 'methods.definitional_cascade.definitionalCascadeMethod',
        runId: 'D-BP164-M0-122-demo-run', dispatchId: 'D-BP164-M0-122',
        ok: true, bytesFetched: fetchOutcome.bytes,
      }, receiptsDir);

      // ── STEP 4: WHOLE-SILO SUMMARY (the read interface BISHOP-M3 binds to) ───────────────────
      const summary = summarizeMethodSilo({ dir });
      expect(summary.totalFiles).toBe(1);
      expect(summary.tags).toEqual([{ tag: 'DEFINE', files: 1, methods: ['definitional_cascade'] }]);

      // ── STEP 5: MECHANICAL ANSWER-LEAKAGE AUDIT -- must scan clean ───────────────────────────
      const audit = auditSiloForAnswerLeakage({ dir });
      expect(audit.scanned).toBe(1);
      expect(audit.flagged).toEqual([]);

      // ── ARTIFACTS ON DISK ──────────────────────────────────────────────────────────────────────
      mkdirSync(ARTIFACT_DIR, { recursive: true });
      writeFileSync(DEPOSIT_ARTIFACT, JSON.stringify({
        dispatch: 'D-BP164-M0-122', step: 1, label: 'deposit -- write path, real methodology eblet',
        deposit, queryReceipt, measuredAt: new Date().toISOString(),
      }, null, 2), 'utf8');
      writeFileSync(MINT_ARTIFACT, JSON.stringify({
        dispatch: 'D-BP164-M0-122', step: 2, label: 'mint -- connector resolves to a celpane, never the method description',
        celpane, tokens, withinBudget, celpaneBytesOnWire: Buffer.byteLength(celpaneJson, 'utf8'),
        measuredAt: new Date().toISOString(),
      }, null, 2), 'utf8');
      writeFileSync(FETCH_ARTIFACT, JSON.stringify({
        dispatch: 'D-BP164-M0-122', step: 3, label: 'fetch -- the second, explicit fetch',
        resolvedFiles: fetchOutcome.filesRead, textBytes: fetchOutcome.bytes,
        textPreview: fetchOutcome.text.slice(0, 300), summary, audit,
        measuredAt: new Date().toISOString(),
      }, null, 2), 'utf8');

      const depositStat = statSync(DEPOSIT_ARTIFACT);
      const mintStat = statSync(MINT_ARTIFACT);
      const fetchStat = statSync(FETCH_ARTIFACT);
      expect(depositStat.size).toBeGreaterThan(0);
      expect(mintStat.size).toBeGreaterThan(0);
      expect(fetchStat.size).toBeGreaterThan(0);
      // eslint-disable-next-line no-console -- deliberate, matches connector_celpane.demo.test.ts's
      // own convention: the artifact paths and sizes are named in vitest's own output, not a
      // second reporting step.
      console.log(`[D-BP164-M0-122] deposit artifact: ${DEPOSIT_ARTIFACT} (${depositStat.size} bytes)`);
      console.log(`[D-BP164-M0-122] mint artifact: ${MINT_ARTIFACT} (${mintStat.size} bytes)`);
      console.log(`[D-BP164-M0-122] fetch artifact: ${FETCH_ARTIFACT} (${fetchStat.size} bytes)`);
      console.log(`[D-BP164-M0-122] silo eblet on disk: ${deposit.path} (${deposit.bytes} bytes)`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('mintSiloCelpane refuses honestly (ok:false) on a cold-start, empty silo -- not an error', () => {
    const emptyDir = mkdtempSync(join(tmpdir(), 'method-silo-empty-'));
    try {
      const outcome = mintSiloCelpane('RANK', { dir: emptyDir });
      expect(outcome.ok).toBe(false);
      if (outcome.ok) return;
      expect(outcome.reason).toContain('cold start is correct');
    } finally {
      rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  it('depositMethodologyEblet refuses an answer-shaped write rather than storing it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'method-silo-leak-'));
    try {
      const outcome = depositMethodologyEblet({
        demandKind: 'RANK',
        methodId: 'methods.comparative_cascade.comparativeCascadeMethod',
        whatItDoes: 'The correct answer is option C.', // deliberately answer-shaped -- must be refused
        taughtBy: 'test fixture',
        qid: 1,
        runId: 'test', dispatchId: 'test',
        hexConnector: 'PROOF', hexConnectorJustification: 'test',
        sessionLabel: 'TEST', model: 'test', filedBy: 'test',
        dir,
      });
      expect(outcome.ok).toBe(false);
      if (outcome.ok) return;
      expect(outcome.leaks && outcome.leaks.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
