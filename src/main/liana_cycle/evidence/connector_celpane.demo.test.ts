// connector_celpane.demo.test.ts -- D-BP164-M0-121/BISHOP-SEG-HEX/M0
//
// THE OBSERVABLE, TWO-STEP DEMONSTRATION. Runs connector_celpane.ts's mintConnectorCelpane() and
// fetchConnectorCelpaneFullText() against REAL evidence-store data already on disk (qid 1, two
// genuine acquisitions recorded 2026-08-15 -- NOT qid 98, deliberately: qid 98 is SOLVED, verdict
// A, and this dispatch's own standing orders forbid re-opening it; this demo needed a real
// multi-record acquisition and qid 1 is one, untouched by that ruling). Nothing here is mocked:
// the query text is read live off the real record (never hand-transcribed, so no transcription
// error can silently make a fake match look real), and both steps write their actual result to a
// JSON artifact on disk so BISHOP-M0 can inspect the two-step behavior directly rather than trust
// a pass/fail line.
//
// READ-ONLY AGAINST THE REAL STORE. This file only calls loadAcquisition()/listAcquisitions()
// (both read-only, evidence_store.ts's own header) plus this ticket's own mint/fetch, which are
// themselves read-only. No evidence is appended, no acquisition is modified.

import { describe, expect, it } from 'vitest';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { listAcquisitions, loadAcquisition, resolveEvidenceDir } from './evidence_store';
import { estimateTokens, fetchConnectorCelpaneFullText, mintConnectorCelpane } from './connector_celpane';

const REAL_EVIDENCE_DIR = resolveEvidenceDir();
const DEMO_QID = 1; // real, on-disk, two acquisitions -- see file header for why not qid 98.
const ARTIFACT_DIR = 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\BISHOP_DROPZONE';
const MINT_ARTIFACT = join(ARTIFACT_DIR, 'D-BP164-M0-121_connector_celpane_demo_step1_mint.json');
const FETCH_ARTIFACT = join(ARTIFACT_DIR, 'D-BP164-M0-121_connector_celpane_demo_step2_fetch.json');

describe('D-BP164-M0-121 connector celpane -- real two-step resolution, real evidence-store data', () => {
  it('STEP 1 (mint) never carries the full query or response text; STEP 2 (fetch) does, and only on demand', async () => {
    const ids = listAcquisitions(DEMO_QID, REAL_EVIDENCE_DIR);
    expect(ids.length).toBeGreaterThan(0); // real data must be on disk for this demo to mean anything
    const { acquisition } = loadAcquisition(DEMO_QID, ids[0], REAL_EVIDENCE_DIR);
    expect(acquisition).not.toBeNull();
    expect(acquisition!.records.length).toBeGreaterThan(0);
    const record = acquisition!.records[0]; // real, on-disk, never hand-transcribed
    const fullQueryText = record.query;
    const fullResponseText = record.authority === 'conversational'
      ? String((record.response as { text?: string } | null)?.text ?? '')
      : '';

    // ── STEP 1: MINT ──────────────────────────────────────────────────────────────────────────
    const mintOutcome = mintConnectorCelpane(DEMO_QID, 'demo', fullQueryText, {
      dir: REAL_EVIDENCE_DIR,
      authorities: [record.authority],
    });
    expect(mintOutcome.ok).toBe(true);
    if (!mintOutcome.ok) return; // narrows for TS below
    const { celpane, tokens, withinBudget, provenance } = mintOutcome;

    // The whole claim under test: the celpane is small and structurally cannot carry the content.
    expect(withinBudget).toBe(true);
    expect(tokens).toBeLessThanOrEqual(50);
    const celpaneJson = JSON.stringify(celpane);
    expect(celpaneJson).not.toContain(fullQueryText);
    if (fullResponseText.length > 40) {
      expect(celpaneJson).not.toContain(fullResponseText);
    }
    expect(provenance.acquisitionId).toBe(ids[0]);

    // ── STEP 2: THE SECOND, EXPLICIT FETCH ───────────────────────────────────────────────────────
    const fetchOutcome = await fetchConnectorCelpaneFullText(celpane, { dir: REAL_EVIDENCE_DIR });
    expect(fetchOutcome.ok).toBe(true);
    if (!fetchOutcome.ok) return;
    expect(fetchOutcome.resolvedAcquisitionId).toBe(ids[0]);
    if (record.authority === 'conversational') {
      expect(fetchOutcome.text).toBe(fullResponseText.trim());
    }
    expect(fetchOutcome.bytes).toBeGreaterThan(0);

    // ── ARTIFACTS ON DISK, so this is inspectable, not just asserted ────────────────────────────
    mkdirSync(ARTIFACT_DIR, { recursive: true });
    const mintArtifact = {
      dispatch: 'D-BP164-M0-121',
      step: 1,
      label: 'mint -- connector resolves to a celpane, never the underlying content',
      qid: DEMO_QID,
      sourceAcquisitionId: ids[0],
      evidenceDir: REAL_EVIDENCE_DIR,
      celpane,
      provenance,
      estimatedTokens: tokens,
      withinBudget,
      celpaneBytesOnWire: Buffer.byteLength(celpaneJson, 'utf8'),
      fullQueryTextBytesNotCarried: Buffer.byteLength(fullQueryText, 'utf8'),
      fullResponseTextBytesNotCarried: Buffer.byteLength(fullResponseText, 'utf8'),
      measuredAt: new Date().toISOString(),
    };
    writeFileSync(MINT_ARTIFACT, JSON.stringify(mintArtifact, null, 2), 'utf8');

    const fetchArtifact = {
      dispatch: 'D-BP164-M0-121',
      step: 2,
      label: 'fetch -- the second, explicit fetch, only called after step 1 (mustFetch:true)',
      celpaneQueryKey: celpane.qk,
      ok: fetchOutcome.ok,
      resolvedAcquisitionId: fetchOutcome.resolvedAcquisitionId,
      textBytes: fetchOutcome.bytes,
      textPreview: fetchOutcome.text.slice(0, 240),
      textMatchesRealRecord: record.authority === 'conversational' ? fetchOutcome.text === fullResponseText.trim() : 'not-conversational-authority',
      measuredAt: new Date().toISOString(),
    };
    writeFileSync(FETCH_ARTIFACT, JSON.stringify(fetchArtifact, null, 2), 'utf8');

    // Prove the artifacts actually landed and report real byte sizes (not a harness-reported
    // status -- see this dispatch's own standing orders on that failure mode).
    const mintStat = statSync(MINT_ARTIFACT);
    const fetchStat = statSync(FETCH_ARTIFACT);
    expect(mintStat.size).toBeGreaterThan(0);
    expect(fetchStat.size).toBeGreaterThan(0);
    // eslint-disable-next-line no-console -- deliberate, so `npx vitest run` output itself names
    // the two artifact paths and sizes without a second reporting step.
    console.log(`[D-BP164-M0-121] mint artifact: ${MINT_ARTIFACT} (${mintStat.size} bytes)`);
    console.log(`[D-BP164-M0-121] fetch artifact: ${FETCH_ARTIFACT} (${fetchStat.size} bytes)`);
  });

  it('estimateTokens matches mic_channel_missive.js\'s own formula (ceil(chars/3.5)) on a known string', () => {
    expect(estimateTokens('abcdefg')).toBe(2); // 7 chars / 3.5 = 2
    expect(estimateTokens('a'.repeat(35))).toBe(10);
  });

  it('mint refuses honestly (ok:false, no celpane) when no prior acquisition matches', () => {
    const outcome = mintConnectorCelpane(999999, 'demo', 'a query that has never been asked', {
      dir: REAL_EVIDENCE_DIR,
    });
    expect(outcome.ok).toBe(false);
  });
});
