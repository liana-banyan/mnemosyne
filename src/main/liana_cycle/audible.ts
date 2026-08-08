// audible.ts -- D-BP150-001/BISHOP/S01/seg-audible
//
// CALL AN AUDIBLE. Founder, BP149, verbatim: "a button or toggle to 'let me redirect it before
// the next Google Call'." Named by him; recorded as BP150's first build in
// bishop_coffee.BP149_close_BP150_open.md.
//
// WHY THIS FILE IS TWENTY LINES OF MECHANISM AND NOT A CASCADE REWRITE. The BP149 estimate for
// this feature was "restructure comparative_cascade.ts and definitional_cascade.ts into
// genuinely pausable steps" -- the work LianaCycleTab.tsx's Audit the Run header explicitly
// declined to do. That estimate is wrong, and the reason is the architecture D-BP149-041 built:
// every method receives its Google access as an INJECTED function on MethodRunContext
// (`askGoogle: AskGoogleFn`). There is exactly one channel to Google and it is already a
// parameter. So the audible is a decorator around that parameter. No method changes. No stage
// restructuring. And it works for METHOD 2 the moment the Founder teaches it, and for every
// method taught after that, with no further work -- which is the method registry paying for
// itself.
//
// THE CONSTRAINT THAT SHAPES EVERYTHING BELOW: with audible mode OFF this module returns the
// caller's own function, unwrapped, by reference. Not a pass-through wrapper -- the SAME
// function object. The Founder's standing requirement is that this must not change what the
// methods do (same queries, same order, same terminator), and identity is a structural proof of
// that rather than a claim to be re-tested each time a method changes.
//
// NO TIMEOUT ON A PAUSE, EVER, AND THIS IS NOT AN OVERSIGHT. Founder, BP149, on the Audit box
// that preceded this: "it stops and lets me start typing, but then it assumes I abandoned, so I
// need it to stop UNTIL I SAY GO." A pause waits indefinitely. The only ways out are an explicit
// operator action or the window going away (see the destroyed-sender rejection in index.ts's
// channel implementation). An elapsed-time abandon would reintroduce the exact defect he
// reported.

import type { LianaAudiblePause, LianaAudibleRecord, LianaAudibleResponse } from '../../shared/liana_cycle/liana_terminal_types';
import type { BrowserAuthorityRawExtraction } from '../../shared/plow/browser_authority_types';
import type { AskGoogleFn, EmitFn } from './method_registry';

/** How the engine reaches the operator. Implemented in index.ts over IPC; kept as an interface
 *  here so this module has no Electron dependency and can be exercised without a window. */
export interface AudibleChannel {
  /** Shows one pause and resolves with the operator's answer. MUST NOT resolve on its own --
   *  see this file's header on why there is no timeout. May REJECT if the operator's window is
   *  destroyed, which is the one non-operator way a pause ends. */
  requestPause: (pause: LianaAudiblePause) => Promise<LianaAudibleResponse>;
}

/** Thrown when the operator ends the run from inside a pause. Caught in liana_terminal_engine.ts
 *  and converted into an honest abstained outcome that KEEPS the audible log -- Founder, BP149:
 *  "a walk that throws away your annotations because you quit early is worse than no walk." */
export class AudibleAbandoned extends Error {
  constructor() {
    super('audible_abandoned');
    this.name = 'AudibleAbandoned';
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Collects what actually happened, written by the engine rather than reconstructed by the UI,
 *  so the record reflects the calls that were really made. */
export class AudibleLog {
  private readonly records: LianaAudibleRecord[] = [];
  add(rec: LianaAudibleRecord): void { this.records.push(rec); }
  all(): LianaAudibleRecord[] { return this.records.slice(); }
  get length(): number { return this.records.length; }
}

/**
 * Wraps an AskGoogleFn so the operator is stopped on both sides of every Google call.
 *
 * Returns `askGoogle` ITSELF when `channel` is null -- see this file's header.
 */
export function wrapAskGoogleWithAudible(
  askGoogle: AskGoogleFn,
  channel: AudibleChannel | null,
  emit: EmitFn,
  log: AudibleLog,
): AskGoogleFn {
  if (!channel) return askGoogle;

  let callIndex = 0;
  let pauseSeq = 0;
  const nextPauseId = () => `p${++pauseSeq}`;

  const say = (text: string) => emit({ kind: 'note', text, ts: nowIso() });

  return async (question: string): Promise<BrowserAuthorityRawExtraction | null> => {
    callIndex += 1;

    // ── Side 1: going out. The query is still changeable. ────────────────────────────────
    const outPause: LianaAudiblePause = {
      pauseId: nextPauseId(),
      phase: 'before_query',
      callIndex,
      query: question,
      ts: nowIso(),
    };
    emit({ kind: 'stage', text: `-- AUDIBLE, call ${callIndex}: waiting on you before this query goes out`, ts: nowIso() });
    const outAnswer = await channel.requestPause(outPause);

    // The operator's own text is used VERBATIM. It is never parsed, normalized, re-templated, or
    // merged with the method's derived wording. Auto-interpreting free text would be the failure
    // the registry exists to prevent: we could no longer tell whether a method worked or whether
    // the system had quietly rewritten itself.
    const effectiveQuery = outAnswer.action === 'rewrite' && outAnswer.replacementQuery?.trim()
      ? outAnswer.replacementQuery
      : question;

    log.add({
      pauseId: outPause.pauseId,
      phase: 'before_query',
      callIndex,
      originalQuery: question,
      effectiveQuery,
      action: outAnswer.action,
      note: outAnswer.note,
      ts: nowIso(),
    });

    if (outAnswer.action === 'abandon') throw new AudibleAbandoned();
    if (outAnswer.action === 'skip') {
      // Returning null is not a new code path for the methods -- it is the same value Google
      // already returns on a genuine miss, which every method already handles.
      say(`   AUDIBLE: call ${callIndex} skipped by operator -- treated as no result`);
      return null;
    }
    if (effectiveQuery !== question) {
      say(`   AUDIBLE: query ${callIndex} rewritten by operator`);
      say(`     was: ${question}`);
      say(`     now: ${effectiveQuery}`);
    }

    const raw = await askGoogle(effectiveQuery);

    // ── Side 2: coming back. RAW, before Gemma, before any parse decision. ───────────────
    // This is the side that would have caught the four-session defect: real scraped results
    // existed and were discarded before anything looked at them.
    const backPause: LianaAudiblePause = {
      pauseId: nextPauseId(),
      phase: 'after_return',
      callIndex,
      query: effectiveQuery,
      rawSnippet: raw?.snippet ?? '',
      blocks: (raw?.results ?? []).map((r) => ({
        title: r.title ?? '',
        body: r.snippet ?? '',
        url: r.url ?? '',
      })),
      sourceUrl: raw?.sourceUrl ?? null,
      ts: nowIso(),
    };
    const blockCount = backPause.blocks?.length ?? 0;
    emit({
      kind: 'stage',
      text: `-- AUDIBLE, call ${callIndex} returned: ${backPause.rawSnippet ? 'answer box' : 'no answer box'}, ${blockCount} organic result(s). Waiting on you.`,
      ts: nowIso(),
    });
    const backAnswer = await channel.requestPause(backPause);

    log.add({
      pauseId: backPause.pauseId,
      phase: 'after_return',
      callIndex,
      originalQuery: question,
      effectiveQuery,
      action: backAnswer.action,
      note: backAnswer.note,
      ts: nowIso(),
    });

    if (backAnswer.action === 'abandon') throw new AudibleAbandoned();
    if (backAnswer.action === 'skip') {
      say(`   AUDIBLE: call ${callIndex} result discarded by operator -- treated as no result`);
      return null;
    }
    // 'rewrite' is meaningless on the return side and is deliberately NOT honored here: letting
    // the operator hand-write a fact would put unsourced text into the evidence chain, which is
    // the estate's "nothing that isn't real" rule. To supply a fact, rewrite the QUERY that
    // fetches it. The UI does not offer the control at this phase.
    return raw;
  };
}
