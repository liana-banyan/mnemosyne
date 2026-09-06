// connector_celpane.ts -- D-BP164-M0-121/BISHOP-SEG-HEX/M0
//
// THE HEX CONNECTOR, WIRED FOR REAL, SCOPED TO THE ONE SEAM THAT EXISTS TODAY. Founder, BP164
// tonight, verbatim: "AND FIRST before any testing, I wanted the Hex Connectors wired in. We need
// them for everything. ALL of it."
//
// D-BP164-M0-116 measured, and this dispatch (D-BP164-M0-121) independently re-verified with a
// fresh Grep of src/main/liana_cycle/ for connector|celpane|keyhole|silo|eblet|substrate: there is
// NO runtime connector resolution anywhere in this directory. Every match was one of a doc comment
// citing a canon eblet, a write-only receipt/telemetry sink (purpose_receipt_store.ts and
// similar), or buildPriorAcquisitionOwnedPassages() (evidence/cross_acquisition.ts) -- which is
// DIRECT evidence reuse: it returns OwnedPassage.text, the full response text, with no
// indirection. That function is the closest existing thing to a connector, and it is exactly the
// mechanism this file offers a celpane-style alternative to, at ONE identified seam. See "THE SEAM"
// below.
//
// WHAT A HEX CONNECTOR IS IN THIS ESTATE, REUSED HERE, NOT REINVENTED. Per MEMORY.md's own
// RESOLUTION INSTRUCTIONS step 1 and BISHOP_DROPZONE\MIC_CHANNEL\mic_channel_missive.js's header:
// "a connector resolves to a celpane, not full content... A SECOND, EXPLICIT FETCH is required" to
// get the underlying detail, only if it is actually needed. mic_channel_missive.js implements this
// two-step shape for the cross-machine WIRE (a signed 10-50 token payload, buildMissive/
// validateMissive). This file implements the SAME two-step shape for the Liana Cycle's own
// evidence reuse, in-process, no wire, no signing:
//   STEP 1 -- mintConnectorCelpane(): finds the match (findPriorAcquisitionMatch(), already
//     exported by cross_acquisition.ts, reads NO response text) and builds a small typed pointer.
//     The pointer carries a content-addressed `queryKey` (evidence_store.ts's own
//     deriveQueryKey()), never the query text and never the response text.
//   STEP 2 -- fetchConnectorCelpaneFullText(): the ONLY function in this file that reads
//     response text, via cross_acquisition.ts's own resolveReusedText() (exported by this ticket,
//     see that file's own D-BP164-M0-121 comment -- not reimplemented, not forked).
// Both steps are separately callable and separately observable (each returns its own result;
// connector_celpane.demo.test.ts writes both results to disk as artifacts).
//
// MEASURED, NOT ASSUMED: resolveReusedText()'s own `askedText` parameter has ZERO effect on its
// return value. Read its body (cross_acquisition.ts): the 'conversational' branch never touches
// `askedText`, and the 'google' branch's one-shot stub askGoogle ignores the query it is called
// with and always returns `m.record.response`. So the second fetch below never needs the real
// query text at all -- confirmed here, not guessed, before relying on it -- and passes `''`.
// This is WHY the celpane can omit the query text entirely and still support a correct second
// fetch: the estate's own extraction path already does not depend on it downstream of the match.
//
// TOKEN BUDGET, SAME CONVENTION AS mic_channel_missive.js (MAX 50, hard refusal; MIN 10,
// advisory only here -- see below), SAME CONSERVATIVE ESTIMATOR (ceil(chars/3.5), documented
// over-count). mic_channel_missive.js is a CommonJS file outside this repo's TS build path
// (BISHOP_DROPZONE\MIC_CHANNEL, no import graph in common with mnemosyne/src/main), so the
// constant and the formula are reused VERBATIM and cited, not imported and not re-derived
// independently -- this is the same "one definition, cited, not diverged" discipline
// cross_acquisition.ts's own header applies to googleBlocks().
//
// THE SEAM (report before build, per this dispatch's own order). liana_terminal_engine.ts's
// `ownedPassages()` builder is the exact point a connector lookup belongs -- measured this
// dispatch, current line numbers ~1056-1106:
//   - lines 1056-1065: `const priorAcquisitionPassages = ... await buildPriorAcquisitionOwnedPassages(...)`
//   - lines 1088-1106: the `ownedPassages: (): OwnedPassage[] => { ... out.push(...priorAcquisitionPassages); return out; }`
//     closure on `baseCtx`, consumed synchronously by classify_cascade.ts's establishFrame()/
//     extractNamedSetMembers()/runDiscriminator().
// Today, full response text is computed BEFORE any method runs and pushed onto every method's
// context whether or not that method ever needed it. The connector-shaped alternative: mint a
// celpane there instead (cheap, ~10-50 tokens, computed with the SAME findPriorAcquisitionMatch()
// call already made), hand the celpane to the method, and let the method call
// fetchConnectorCelpaneFullText() itself only if its own logic decides the detail is needed.
//
// THIS DISPATCH DOES NOT EDIT liana_terminal_engine.ts. MEASURED, this dispatch: a concurrent
// dispatch (D-BP164-M0-119, SEG-COMPUTE) produced a live edit to that exact file roughly two
// minutes before this module was written (`liana_terminal_engine.ts.superseded.20260823T220757Z`,
// mtime 17:07:57Z, twelve seconds behind the live file's 17:08:09Z mtime, re-checked immediately
// before this file was authored, current time then 17:10:05Z). Splicing the seam in the same
// window this dispatch's own standing orders name as collision risk is exactly the failure mode
// those orders exist to prevent. This module is therefore built and proven STANDALONE, against
// real evidence-store data on disk, so the two-step mechanism is demonstrably real before the
// splice into the hot file is attempted by a future, uncontested dispatch. See
// HEX_CONNECTORS_WIRED_BP164.md's own NOT-VERIFIED list.
//
// NO SECOND COST PATH. This file prices nothing and ledgers nothing of its own. Token counts are
// reported on the celpane and on the fetch result so a caller CAN feed them into
// cost_instrument.ts's existing LlmCostSummary/GoogleCostSummary machinery; no new
// AsyncLocalStorage store, no new price table, and no new sink are created here.

import type { Acquisition, EvidenceAuthority, EvidenceRecord } from './evidence_store';
import { deriveQueryKey, listAcquisitions, loadAcquisition } from './evidence_store';
import {
  describePriorAcquisitionProvenance,
  findPriorAcquisitionMatch,
  resolveReusedText,
} from './cross_acquisition';
import type { PriorAcquisitionMatch } from './cross_acquisition';

/** Same hard-refusal convention as mic_channel_missive.js's MAX_TOKENS. */
export const CELPANE_MAX_TOKENS = 50;
/** mic_channel_missive.js's MIN_TOKENS is a wire-protocol floor ("under it, a message is almost
 *  certainly missing its ref or its headline"). This connector is not a signed wire payload, so
 *  the floor is reported for parity but NOT enforced as a refusal here -- a correctly minimal
 *  local pointer may legitimately land under 10 estimated tokens. */
export const CELPANE_MIN_TOKENS_ADVISORY = 10;

/** Same conservative estimator as mic_channel_missive.js's estimateTokens() (ceil(chars/3.5),
 *  deliberately over-counts typical English at ~4 chars/token -- see that file's header). Reused
 *  verbatim, not re-derived. */
export function estimateTokens(obj: unknown): number {
  const s = typeof obj === 'string' ? obj : JSON.stringify(obj);
  return Math.ceil(s.length / 3.5);
}

/** STEP ONE'S RESOLUTION TARGET. A small, typed pointer at a prior-acquisition evidence record --
 *  DELIBERATELY NOT the record's response text, NOT the raw query text, and (measured, see below)
 *  not even the acquisitionId/timestamp -- those are real fields (evidence_store.ts's own
 *  EvidenceRecord/Acquisition) but MEASURED to cost ~30-40 estimated tokens on their own, which
 *  pushed a first version of this object to 118 estimated tokens, more than double the 50-token
 *  budget. Cut, not guessed at: `queryKey` (evidence_store.ts's own content address,
 *  `deriveQueryKey(authority, query)` -- the SAME key EvidenceRecord.queryKey already carries) is
 *  enough on its own to relocate the record at fetch time (see fetchConnectorCelpaneFullText()),
 *  so acquisitionId/acquiredAt/ageMs are reported separately, on `MintOutcome.provenance` --
 *  OUTSIDE the celpane object itself, exactly as they would be outside anything actually handed
 *  to a model. `headline` is a short, fixed-shape string built from `kind`/`authority` only --
 *  never from `match.record.response` -- so a caller holding only this object can never recover
 *  the underlying passage. That is the property this module exists to demonstrate. */
export interface ConnectorCelpane {
  t: 'connector_celpane';
  v: 1;
  q: number;
  k: string;
  a: EvidenceAuthority;
  qk: string;
  h: string;
  mf: true;
}

/** Provenance sits OUTSIDE the token-budgeted celpane (see ConnectorCelpane's own doc comment) --
 *  it is for a transcript/receipt line (describePriorAcquisitionProvenance()'s own existing
 *  format, unchanged), never for a model's context window. */
export interface ConnectorProvenance {
  acquisitionId: string;
  acquiredAt: string;
  ageMsAtUse: number;
  describe: string;
}

export type MintOutcome =
  | { ok: true; celpane: ConnectorCelpane; tokens: number; withinBudget: boolean; provenance: ConnectorProvenance }
  | { ok: false; reason: string };

/** STEP ONE. Tries each authority in `opts.authorities` (default ['conversational', 'google'],
 *  the SAME order buildPriorAcquisitionOwnedPassages() already uses), first match wins. Uses
 *  findPriorAcquisitionMatch() (cross_acquisition.ts, already exported, unmodified) -- the exact
 *  same lookup buildPriorAcquisitionOwnedPassages() performs -- so a caller who mints a celpane
 *  here and a caller who calls the older full-text function are guaranteed to find the SAME
 *  record, not two independently-derived answers. Reads no response text: `match.record.response`
 *  is never touched by this function. `askedText` is REQUIRED here (findPriorAcquisitionMatch()
 *  needs it to derive the queryKey) but is NOT stored on the returned celpane -- see this file's
 *  header for why the second fetch does not need it back. */
export function mintConnectorCelpane(
  qid: number,
  kind: string,
  askedText: string,
  opts?: {
    dir?: string;
    excludeAcquisitionId?: string;
    now?: () => string;
    authorities?: EvidenceAuthority[];
  },
): MintOutcome {
  if (!askedText || !askedText.trim()) {
    return { ok: false, reason: 'askedText is empty -- nothing to mint a connector for' };
  }
  const authorities = opts?.authorities ?? (['conversational', 'google'] as EvidenceAuthority[]);
  for (const authority of authorities) {
    const match = findPriorAcquisitionMatch(qid, authority, askedText, opts);
    if (!match) continue;
    const queryKey = deriveQueryKey(authority, askedText);
    const celpane: ConnectorCelpane = {
      t: 'connector_celpane',
      v: 1,
      q: qid,
      k: kind,
      a: authority,
      qk: queryKey,
      h: `qid${qid} ${kind} via ${authority} (reused)`.slice(0, 60),
      mf: true,
    };
    const tokens = estimateTokens(celpane);
    return {
      ok: true,
      celpane,
      tokens,
      withinBudget: tokens <= CELPANE_MAX_TOKENS,
      provenance: {
        acquisitionId: match.acquisitionId,
        acquiredAt: match.ts,
        ageMsAtUse: match.ageMs,
        describe: describePriorAcquisitionProvenance(match),
      },
    };
  }
  return {
    ok: false,
    reason: `no prior-acquisition match for qid ${qid} kind ${kind} across authorities [${authorities.join(', ')}]`,
  };
}

export type FetchOutcome =
  | {
    ok: true;
    text: string;
    bytes: number;
    /** Which acquisition the record was actually found in at fetch time -- reported, not
     *  compared to anything, because the celpane itself no longer pins one (see
     *  ConnectorCelpane's own doc comment). */
    resolvedAcquisitionId: string;
  }
  | { ok: false; reason: string };

/** STEP TWO, THE SECOND EXPLICIT FETCH. Only call this when the detail behind a celpane is
 *  actually needed. Relocates the record by walking every acquisition on disk for `celpane.q`
 *  (listAcquisitions(), oldest-id-first -- the SAME deterministic order findPriorAcquisitionMatch()
 *  itself uses, so a fetch immediately after a mint finds the identical record) looking for a
 *  (queryKey, authority) match -- NOT by re-running findPriorAcquisitionMatch() with reconstructed
 *  query text, so this function never has to guess or carry the original question string. Then
 *  reads response text through cross_acquisition.ts's own resolveReusedText() -- the ONE
 *  known-correct extraction path, reused, not forked. */
export function fetchConnectorCelpaneFullText(
  celpane: ConnectorCelpane,
  opts?: { dir?: string },
): Promise<FetchOutcome> {
  return (async () => {
    const ids = listAcquisitions(celpane.q, opts?.dir);
    for (const acquisitionId of ids) {
      const { acquisition } = loadAcquisition(celpane.q, acquisitionId, opts?.dir);
      if (!acquisition) continue;
      const record: EvidenceRecord | undefined = acquisition.records.find(
        (r) => r.queryKey === celpane.qk && r.authority === celpane.a,
      );
      if (!record) continue;
      const match: PriorAcquisitionMatch = {
        record,
        acquisitionId,
        ts: record.ts,
        ageMs: 0, // not carried on the celpane by design; a fresh caller can recompute from record.ts if needed
      };
      // MEASURED, this file's header: resolveReusedText()'s askedText argument has zero effect on
      // its return value for either authority branch. Passed as '' deliberately, not omitted, so a
      // future reader sees this is a considered choice, not a missing value.
      // eslint-disable-next-line no-await-in-loop -- mirrors findPriorAcquisitionMatch()'s own
      // sequential, first-match-wins walk over listAcquisitions(); stops at the first hit.
      const text = await resolveReusedText(match, '');
      return { ok: true, text, bytes: Buffer.byteLength(text, 'utf8'), resolvedAcquisitionId: acquisitionId };
    }
    return {
      ok: false,
      reason: `queryKey ${celpane.qk} (authority ${celpane.a}) not found in any qid ${celpane.q} acquisition on disk (${ids.length} acquisitions searched, dir=${opts?.dir ?? 'default'})`,
    };
  })();
}

/** Convenience type export so a caller (or a future splice into liana_terminal_engine.ts) can
 *  reference the acquisition shape without a second import path. Not otherwise used in this file. */
export type { Acquisition };
