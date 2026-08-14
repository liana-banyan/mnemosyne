// evidence_authority.ts -- D-BP153-002/BISHOP/evidence-store
//
// THE TWO WRAPPERS. One records every authority query a live run issues; the other replays a
// recorded acquisition back to an identical run with no network at all.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE SEAM, AND THE ONE THAT ALMOST GOT MISSED.
//
// A BP153 mapping pass established that every method run and every Survey call resolves to ONE
// `askGoogle` closure per run (`effectiveAskGoogle`, liana_terminal_engine.ts:474, optionally
// re-wrapped by `wrapAskGoogleWithAudible` for the method's own ctx). Wrapping that one closure
// captures Step 0, Survey, and every method.
//
// BUT `askConversationalAuthority` -- the Gemini path, built as its own closure at index.ts:3855
// -- IS NOT PART OF THAT CHAIN AND IS WRAPPED BY NOTHING. Survey's two meta-questions
// (`askAmbiguity()`, `askOperation()`) try Gemini FIRST and fall back to Google only on
// `ok: false`. A recorder placed only on askGoogle would therefore produce a store that reports
// success, contains no error, and is missing every Gemini answer that shaped the run. The replay
// built from it would diverge and nothing would say why.
//
// That is the estate's signature defect wearing a new coat: a value exists, one hop fails to
// carry it, and the result reads like a decision. So BOTH authorities are wrapped here, and the
// store keeps them distinguishable rather than flattening two genuinely different response
// shapes into one blob it cannot faithfully replay.
//
// OUT OF SCOPE, RULED EXPLICITLY RATHER THAN LEFT AMBIGUOUS: the two local Ollama `fetch()` calls
// (comparative_cascade.ts:443, survey_stage.ts:1546) are NOT recorded. They introduce no new
// external evidence -- they extract or group over text already obtained through askGoogle. They
// are transformations of evidence, not acquisitions of it. DISCLOSED CONSEQUENCE: they run at
// temperature 0 and are deterministic for a fixed model, but a different Ollama version or a
// changed model weight WOULD move a replay's result without the evidence store showing any
// difference. If that ever bites, the fix is to record the local model's identity and digest
// alongside each acquisition, not to record its outputs as evidence.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import type { AskGoogleFn, ConversationalAuthorityFn, ConversationalAuthorityResult } from '../method_registry';
import type { BrowserAuthorityRawExtraction } from '../../../shared/plow/browser_authority_types';
import type { Acquisition, EvidenceAuthority, EvidenceRecord } from './evidence_store';
import { appendEvidence, deriveQueryKey } from './evidence_store';

/** Mutable bookkeeping for one live acquisition. Held by the caller so both wrappers share one
 *  monotonic sequence, which is what lets a replay reproduce issue ORDER and not merely content. */
export interface AcquisitionSession {
  acquisitionId: string;
  qid: number | null;
  /** Test override. Undefined = the real ledger directory. */
  dir?: string;
  /** Incremented across BOTH authorities. Do not reset per authority. */
  seq: number;
  /** Every record written this session, in order. */
  written: EvidenceRecord[];
  /** Ledger writes that FAILED. Recording is non-fatal (see `record()` below), but a failure is
   *  never silent: it lands here, and a caller that finds this non-empty must treat the
   *  acquisition as INCOMPLETE and refuse to replay it as though it were whole. */
  writeFailures: Array<{ query: string; authority: EvidenceAuthority; error: string }>;
  /** Wall-clock supplier, injectable so tests are not clock-dependent. */
  now?: () => string;
}

export function newAcquisitionSession(init: {
  acquisitionId: string;
  qid: number | null;
  dir?: string;
  now?: () => string;
}): AcquisitionSession {
  return { ...init, seq: 0, written: [], writeFailures: [] };
}

/**
 * NON-FATAL BY DESIGN, AND NEVER SILENT. A ledger write must not be able to turn a good run into
 * a failed one -- the same principle the run-receipt writer already uses (index.ts:4089, whose
 * surrounding comment says exactly this). But "non-fatal" must not become "invisible": a failure
 * is pushed onto `session.writeFailures`, and an acquisition with any write failure is INCOMPLETE
 * and must not be replayed as though it were whole.
 *
 * The sequence still advances on failure, deliberately. A gap in `seq` is a visible signal that
 * something was issued and not captured; reusing the number would paper over the hole.
 */
function record(session: AcquisitionSession, authority: EvidenceAuthority, query: string, response: unknown): void {
  const ts = session.now ? session.now() : new Date().toISOString();
  try {
    const written = appendEvidence({
      authority,
      query,
      response,
      acquisitionId: session.acquisitionId,
      qid: session.qid,
      seq: session.seq,
      ts,
      dir: session.dir,
    });
    session.written.push(written);
  } catch (e) {
    session.writeFailures.push({ query, authority, error: e instanceof Error ? e.message : String(e) });
  }
  session.seq += 1;
}

/**
 * Wraps a live `askGoogle`, recording every query and its response.
 *
 * TRANSPARENT BY CONSTRUCTION: it returns exactly what the inner function returned, including
 * null, and it never swallows a throw. A recording layer that could change a run's behavior
 * would corrupt the very evidence it exists to preserve.
 *
 * A RECORDED NULL IS A FACT. "We asked and got nothing back" is real evidence about the world and
 * is stored as such. It is a different thing from an absent record, which means "we never asked".
 * The replay side below keeps that distinction load-bearing.
 */
export function recordingAskGoogle(inner: AskGoogleFn, session: AcquisitionSession): AskGoogleFn {
  return async (question: string): Promise<BrowserAuthorityRawExtraction | null> => {
    const response = await inner(question);
    record(session, 'google', question, response);
    return response;
  };
}

/** Wraps the Gemini path. Same transparency contract as above. See this file's header for why
 *  omitting this wrapper would have produced a silently incomplete store.
 *
 *  D-BP154-019/BISHOP-SEG/S19/seg-secondquery FIX: this wrapper's own inner arrow function used
 *  to accept only `question`, silently dropping whatever `mcOptions` the real caller (
 *  named_set_step.ts, softballs_step.ts, discriminator_step.ts, via tryConversationalAuthority)
 *  passed in -- TypeScript's structural typing allows a narrower function to satisfy
 *  ConversationalAuthorityFn's wider `(question, mcOptions?)` signature, so this compiled clean
 *  while quietly discarding the second argument on every call. LIVE-MEASURED this ticket (qid 98,
 *  embedded_browser_injection.jsonl): `gemini_interactive_query_received` carried
 *  `mcOptionsCount:0` for BOTH Softballs:1's and NamedSet:1's live Gemini queries, through BOTH
 *  the default (`liana-terminal-run`) and Composer (`liana-script-run`) paths -- this wrapper sits
 *  between every one of those callers and the real dispatch (index.ts:4130,4355), so it is the
 *  ONE place responsible for both. The consequence: D-BP154-010/014's own capture-hop gate
 *  (`mentionsAnyOption`, webview_preload.ts) had an empty mcOptions list on every call, and its
 *  own documented contract is "empty mcOptions never rejects" -- so it let Gemini's OWN UI chrome
 *  ("...Thinking Your lianabanyan.com chats aren't used to improve our models...") through as an
 *  accepted candidate answer, exactly the failure that gate was built to close. Fix: forward
 *  `mcOptions` through, unchanged, same transparency contract as recordingAskGoogle above -- this
 *  wrapper still returns exactly what `inner` returns and still never judges the answer itself. */
export function recordingConversationalAuthority(
  inner: ConversationalAuthorityFn,
  session: AcquisitionSession,
): ConversationalAuthorityFn {
  return async (question: string, mcOptions?: string[]): Promise<ConversationalAuthorityResult> => {
    const response = await inner(question, mcOptions);
    record(session, 'conversational', question, response);
    return response;
  };
}

/** Thrown when a replay is asked for evidence the acquisition does not contain. */
export class EvidenceReplayMiss extends Error {
  readonly authority: EvidenceAuthority;

  readonly query: string;

  readonly queryKey: string;

  constructor(authority: EvidenceAuthority, query: string, queryKey: string, detail: string) {
    super(
      `EVIDENCE REPLAY MISS -- this acquisition has no recorded ${authority} answer for a query the `
      + `derivation just issued. ${detail}\n`
      + `  queryKey: ${queryKey}\n`
      + `  query: ${query}\n`
      + 'A replay that cannot find its evidence is not a replay. Refusing loudly rather than '
      + 'returning nothing, because "returned nothing" is a FACT about the world that this store '
      + 'records explicitly, and silently borrowing it here would fabricate that fact.',
    );
    this.name = 'EvidenceReplayMiss';
    this.authority = authority;
    this.query = query;
    this.queryKey = queryKey;
  }
}

export interface ReplayHandle {
  askGoogle: AskGoogleFn;
  askConversationalAuthority: ConversationalAuthorityFn;
  /** Query keys present in the acquisition that no replay consumed. A non-empty list means the
   *  derivation asked FEWER or DIFFERENT questions than the recording did, which is itself a
   *  finding worth surfacing rather than a harmless leftover. */
  unconsumed: () => Array<{ authority: EvidenceAuthority; query: string }>;
  /** Every miss encountered, when `onMiss` is 'collect'. */
  misses: () => Array<{ authority: EvidenceAuthority; query: string }>;
}

/**
 * Builds replay-backed authority functions from a frozen acquisition. No network is reachable
 * from either returned function.
 *
 * REPEATED IDENTICAL QUERIES ARE HANDLED IN ORDER, NOT COLLAPSED. A run that issues the same
 * query twice and receives two different answers is a real thing (a live surface can change
 * between calls, and the Nexus thread state changes what a follow-up returns). So each queryKey
 * holds a QUEUE, consumed in the recorded sequence. Collapsing them to one entry would silently
 * change the run being replayed.
 *
 * `onMiss` defaults to 'throw'. Use 'collect' only when the point of the replay IS to discover
 * which evidence is missing; a collected miss yields null for google and an `ok: false` result
 * for the conversational path, and both are counted so nothing is silent.
 */
export function buildReplay(acquisition: Acquisition, opts?: { onMiss?: 'throw' | 'collect' }): ReplayHandle {
  const onMiss = opts?.onMiss || 'throw';
  const queues = new Map<string, EvidenceRecord[]>();
  for (const r of acquisition.records) {
    const q = queues.get(r.queryKey);
    if (q) q.push(r);
    else queues.set(r.queryKey, [r]);
  }
  for (const q of queues.values()) q.sort((a, b) => a.seq - b.seq);

  const consumed = new Set<string>();
  const misses: Array<{ authority: EvidenceAuthority; query: string }> = [];

  const take = (authority: EvidenceAuthority, query: string): EvidenceRecord | null => {
    const queryKey = deriveQueryKey(authority, query);
    const queue = queues.get(queryKey);
    if (!queue || queue.length === 0) {
      const detail = queue
        ? `The acquisition recorded this query but every recorded answer has already been consumed by an earlier call in this replay (the derivation issued it more times than the recording did).`
        : `The acquisition contains ${acquisition.records.length} record(s), none matching this query.`;
      if (onMiss === 'throw') throw new EvidenceReplayMiss(authority, query, queryKey, detail);
      misses.push({ authority, query });
      return null;
    }
    consumed.add(queryKey);
    return queue.shift() as EvidenceRecord;
  };

  return {
    askGoogle: async (question: string): Promise<BrowserAuthorityRawExtraction | null> => {
      const rec = take('google', question);
      if (!rec) return null;
      return rec.response as BrowserAuthorityRawExtraction | null;
    },
    askConversationalAuthority: async (question: string): Promise<ConversationalAuthorityResult> => {
      const rec = take('conversational', question);
      if (!rec) {
        return {
          ok: false,
          text: '',
          citations: [],
          via: 'evidence-replay',
          authority: 'replay-miss',
        };
      }
      return rec.response as ConversationalAuthorityResult;
    },
    unconsumed: () => {
      const out: Array<{ authority: EvidenceAuthority; query: string }> = [];
      for (const [key, queue] of queues.entries()) {
        if (queue.length > 0 || !consumed.has(key)) {
          for (const r of queue) out.push({ authority: r.authority, query: r.query });
        }
      }
      return out;
    },
    misses: () => [...misses],
  };
}
