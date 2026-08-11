// assisted_mode.ts -- D-BP152-051/BISHOP/seg-assisted-mode
//
// ASSISTED MODE. Founder ruling, BP152, verbatim: "Yes make it a mode. But also, can we not
// automate WHILE using that mode?" And the reasoning behind it, verbatim: "if they can just turn
// off the spigot, then nothing works. It is better for us to put the browser that I actually use,
// and then take my actual question, and put it in the actual box I would actually type it in, and
// then get the answer and copy it to the right place."
//
// MEASURED CAUSE (RULINGS_BP152.md, "MEASURED CONSTRAINT"): Google rate-limited this machine at
// BP152 after dozens of automated queries in one evening -- the block reached the Founder's own
// ordinary browsing, not only the app. Assisted mode exists so a run can proceed entirely on HIS
// browser, HIS signed-in session, with this app never issuing a request of its own -- "the
// operator IS the network, not the analyst."
//
// THE DESIGN: the SAME decorator shape audible.ts already established -- AskGoogleFn is injected
// on MethodRunContext (D-BP149-041), so this is a decorator around that ONE parameter, not a
// rewrite of any method, Survey stage, or Step 0 loop. UNLIKE Call an Audible (which pauses on
// both sides of a real Google call this app still makes), assisted mode's pause STANDS IN for the
// call: this app never issues the request in assisted mode. The composed query is shown, verbatim
// and untruncated -- no paraphrase, no "helpful" rewrite -- and the only way this function's
// returned promise ever resolves is the operator's own capture (or abandon). There is no `rewrite`
// action here (unlike audible.ts's per-call pause) -- that would let the SYSTEM change the query
// text, which is not what was ordered; the operator drives his own browser and types whatever he
// wants there, outside this app entirely.
//
// OFF-STAYS-IDENTICAL: with `channel` null (mode !== 'assisted', or no channel supplied) this
// returns `askGoogle` ITSELF, by reference -- the same identity trick audible.ts and
// stepped_audible.ts already use, so automated mode is provably byte-identical (see this ticket's
// own deliverable for the diff proof against every cascade file).
//
// REUSES THE EXISTING CAPTURE PATH (D-BP152-025, commit f34eed60), NOT A SECOND INTAKE: the pause
// this file raises is a LianaSteppedPause, answered with a LianaSteppedResponse -- the SAME shape
// and the SAME 'liana-stepped-pause' / 'liana-stepped-respond' IPC round trip Stepped Audible and
// the Step 0 "ask Google this" loop already use, and resolved by the SAME index.ts
// 'nexus-authority-capture' handler that already reads the Nexus window's visible text on the
// operator's own "Capture -> Liana Cycle" press (captureNexusAuthorityVisibleText() -- provenance,
// citations, and the FD-BP152-15 contamination flag are all unchanged). This file does not open a
// new IPC channel, a new capture mechanism, or a new DOM reader. index.ts's own change for this
// ticket is one filter, widened to also match this file's own pauseId prefix (`am-google<N>`), so
// the SAME button resolves whichever pause -- Step 0's or this one's -- is currently pending.
// detectOptionContamination() is IMPORTED from stepped_audible.ts (exported there for this reason,
// not duplicated here) so the contamination flag is the same function, not a rewritten copy of it.

import type { LianaAssistedRecord, LianaSteppedPause, LianaSteppedResponse, LianaSteppedStepDef, LianaTerminalEvent, RunMode } from '../../shared/liana_cycle/liana_terminal_types';
import type { BrowserAuthorityName, BrowserAuthorityRawExtraction, CitationRecord } from '../../shared/plow/browser_authority_types';
import type { AskGoogleFn, EmitFn } from './method_registry';
import type { SteppedAudibleChannel } from './stepped_audible';
import { detectOptionContamination } from './stepped_audible';
import { recordSourceAppearance } from '../plow/specialist_adapters';

// RunMode itself lives in the SHARED type file (liana_terminal_types.ts), not here -- same
// cross-boundary convention as LianaAudibleAction/LianaSteppedAction (a shared type file must
// never import a main-only module; this main-only file imports FROM shared instead). Re-exported
// here so every caller in this directory can `import type { RunMode } from './assisted_mode'`
// without needing to know it physically lives one level up.
export type { RunMode };

/** Normalizes an optional mode value to the two-value label recorded in the transcript/receipt
 *  (FD-BP152-07's own requirement, restated by this ticket's requirement 2: "a run whose
 *  governing setting leaves no trace makes the receipt a lie"). Never a third value. */
export function normalizeRunMode(mode: RunMode | undefined | null): RunMode {
  return mode === 'assisted' ? 'assisted' : 'automated';
}

/** Thrown when the operator abandons an assisted-mode pause. Same convention as
 *  audible.ts's AudibleAbandoned / stepped_audible.ts's SteppedAudibleAbandoned -- caught in
 *  liana_terminal_engine.ts and converted into an honest abstained outcome that KEEPS this log. */
export class AssistedModeAbandoned extends Error {
  constructor() {
    super('assisted_mode_abandoned');
    this.name = 'AssistedModeAbandoned';
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Collects every assisted-mode round for the receipt -- HARDWIRE-23 LAW 5: the receipt shows
 *  which rule fired. Present on the outcome only when at least one round happened; a normal
 *  automated run omits it entirely (same convention as AudibleLog/SteppedAudibleLog). Records are
 *  LianaAssistedRecord (shared/liana_cycle/liana_terminal_types.ts), the same shared shape
 *  LianaTerminalOutcome.assistedLog carries -- not a second, main-only record type. */
export class AssistedModeLog {
  private readonly records: LianaAssistedRecord[] = [];
  add(rec: LianaAssistedRecord): void { this.records.push(rec); }
  all(): LianaAssistedRecord[] { return this.records.slice(); }
  get length(): number { return this.records.length; }
}

/** Not tied to a numbered Founder process step (0-18) -- this is the ruling that authorizes the
 *  MODE itself, not one step of a walked method. founderStepNumber is left undefined rather than
 *  invented; LianaSteppedStepDef declares it optional for exactly this reason. */
const ASSISTED_QUERY_STEP_DEF: LianaSteppedStepDef = {
  key: 'assisted_query',
  attribution: 'ATTRIBUTED',
  founderWords:
    'It is better for us to put the browser that I actually use, and then take my actual '
    + 'question, and put it in the actual box I would actually type it in, and then get the '
    + 'answer and copy it to the right place.',
  founderSource: 'RULINGS_BP152.md, D-BP152-051 ruling',
  codeLabel: 'ASSISTED MODE -- query composed; waiting for you to issue it on your own browser and capture the answer',
};

const NEXUS_SURFACE_TO_AUTHORITY: Record<string, BrowserAuthorityName> = {
  google: 'user_google',
  perplexity: 'user_perplexity',
  claude: 'user_claude',
  chatgpt: 'user_chatgpt',
  gemini: 'user_gemini',
};

/** This wrapper is built ONLY around the Liana Cycle's own Google-specific askGoogle closure
 *  (index.ts's buildLianaAskGoogle, authority: 'user_google') -- so "which surface to use"
 *  (requirement 3) is named as Google, matching what automated mode itself would have queried.
 *  If the operator captures from a DIFFERENT Nexus surface anyway (his browser, his choice), the
 *  actual surface is still recorded verbatim in the transcript's capture-context line and in
 *  AssistedModeRecord.capturedSurface -- never lost -- but the BrowserAuthorityRawExtraction
 *  handed back to the cascade uses the recognized authority for the surface actually captured
 *  from when it is one of the five known ones, falling back to 'user_google' (this wrapper's own
 *  named surface) only when the embedder could not determine one. */
function resolveAuthority(nexusSurface: string | null | undefined): BrowserAuthorityName {
  if (nexusSurface && NEXUS_SURFACE_TO_AUTHORITY[nexusSurface]) return NEXUS_SURFACE_TO_AUTHORITY[nexusSurface];
  return 'user_google';
}

function mapCitations(citations: { href: string; text: string; domain: string | null }[]): CitationRecord[] {
  return citations.map((c) => ({ url: c.href, label: c.text, category: c.domain ?? 'unknown' }));
}

/**
 * Wraps an AskGoogleFn so that, in assisted mode, this app never issues the request itself.
 *
 * Returns `askGoogle` ITSELF when `channel` is null -- see this file's header.
 *
 * On each call: composes nothing new (the `question` argument IS the exact query automated mode
 * would have sent -- this function never rewrites it), pauses presenting that query verbatim, and
 * waits -- no timeout, ever, same discipline as every other pause on this estate -- for either an
 * `abandon` or a `nexus_capture` response (the existing capture path, see header). Any other
 * action arriving at this pause (the shared pause panel also offers 'approve'/'correct'/
 * 'redirect'/'ask_google', which have no ordered meaning here) is logged and the pause fires
 * again -- never silently reinterpreted, never advances the run on its own.
 *
 * On a genuine capture, returns a BrowserAuthorityRawExtraction built from the captured text,
 * exactly the same shape automated mode's own extraction returns -- so the calling method parses,
 * stores, applies criteria, eliminates, scores and terminates exactly as it would on a real
 * automated answer. On an empty capture, the pause fires again rather than returning early --
 * mirroring Step 0's own nexus_capture loop (stepped_audible.ts).
 */
export function wrapAskGoogleWithAssistedMode(
  askGoogle: AskGoogleFn,
  channel: SteppedAudibleChannel | null,
  emit: EmitFn,
  log: AssistedModeLog,
  options: Record<string, string> | null,
): AskGoogleFn {
  if (!channel) return askGoogle;

  let callIndex = 0;
  let pauseSeq = 0;
  const nextPauseId = () => `am-google${++pauseSeq}`;

  const say = (text: string) => emit({ kind: 'note', text, ts: nowIso() });

  return async (question: string): Promise<BrowserAuthorityRawExtraction | null> => {
    callIndex += 1;
    let stateEvents: LianaTerminalEvent[] = [];

    const queryEvent: LianaTerminalEvent = {
      kind: 'note',
      text: `   PARSER INSTRUMENT [assisted-mode, D-BP152-051] query for you to issue (verbatim, untruncated, exactly what automated mode would send)="${question}"`,
      ts: nowIso(),
    };
    emit(queryEvent);
    stateEvents = [queryEvent];

    for (;;) {
      const pause: LianaSteppedPause = {
        pauseId: nextPauseId(),
        stepIndex: 0,
        stepTotal: 0,
        step: ASSISTED_QUERY_STEP_DEF,
        events: stateEvents.slice(),
        suggestions: [],
        ts: nowIso(),
      };
      emit({
        kind: 'stage',
        text: `-- ASSISTED MODE, call ${callIndex}: waiting on you to issue this query on your own browser (Google) and capture the answer. There is no timer.`,
        ts: nowIso(),
      });
      const response: LianaSteppedResponse = await channel.requestStepPause(pause);

      log.add({
        pauseId: pause.pauseId,
        callIndex,
        query: question,
        action: response.action,
        capturedSurface: response.nexusSurface,
        capturedUrl: response.nexusUrl,
        ts: nowIso(),
      });

      if (response.action === 'abandon') throw new AssistedModeAbandoned();

      if (response.action !== 'nexus_capture') {
        // TARE, Bishop's own, disclosed rather than installed silently (HARDWIRE-23 LAW 2): no
        // Founder order gives meaning to 'approve'/'correct'/'redirect'/'ask_google' at an
        // assisted-mode pause -- the shared pause panel offers them only because it is the SAME
        // component every other stepped pause already uses (reused, not forked, per this
        // ticket's own "avoid renderer files" instruction). Logged above; the run never
        // auto-navigates, auto-types, or advances on its own -- it just keeps waiting.
        say(`   ASSISTED MODE: call ${callIndex} -- '${response.action}' has no effect at an assisted-mode pause; still waiting on your capture (or abandon).`);
        continue;
      }

      const capturedText = (response.nexusCapturedText ?? '').trim();
      const surface = response.nexusSurface ?? 'unknown';
      const url = response.nexusUrl ?? '';
      const containerUsed = response.nexusContainerUsed ?? 'unknown';

      // Provenance FIRST, unconditionally -- same discipline as Step 0's own nexus_capture
      // handling (stepped_audible.ts), recorded even on an empty capture.
      const contextEvent: LianaTerminalEvent = {
        kind: 'note',
        text: `   PARSER INSTRUMENT [assisted-mode-capture, D-BP152-051] capture context: surface="${surface}" url="${url}" container="${containerUsed}"`,
        ts: nowIso(),
      };
      emit(contextEvent);
      stateEvents = [...stateEvents, contextEvent];

      if (!capturedText) {
        const emptyEvent: LianaTerminalEvent = {
          kind: 'note',
          text: '   ASSISTED MODE CAPTURE: no visible text found on the page at capture time -- nothing recorded as an answer. Waiting again.',
          ts: nowIso(),
        };
        emit(emptyEvent);
        stateEvents = [...stateEvents, emptyEvent];
        continue;
      }

      // FD-BP152-15's same guard, imported not duplicated (see this file's header).
      const contamination = detectOptionContamination(capturedText, options);
      if (contamination.length) {
        const contamEvent: LianaTerminalEvent = {
          kind: 'note',
          text: `   CONTAMINATION FLAG (FD-BP152-15): the captured text contains option string(s) verbatim: ${contamination.join('; ')} -- flagged, never blocked or edited; recorded so a later reader can see contamination was possible on this run.`,
          ts: nowIso(),
        };
        emit(contamEvent);
        stateEvents = [...stateEvents, contamEvent];
      }

      const capturedEvent: LianaTerminalEvent = {
        kind: 'note',
        text: `   PARSER INSTRUMENT [assisted-mode-capture, D-BP152-051] CAPTURED TEXT from ${surface} (untruncated, verbatim, no length cap)="${capturedText}"`,
        ts: nowIso(),
      };
      emit(capturedEvent);
      stateEvents = [...stateEvents, capturedEvent];

      const nexusCitations = response.nexusCitations ?? [];
      let citationRecords: CitationRecord[] = [];
      if (nexusCitations.length > 0) {
        citationRecords = mapCitations(nexusCitations);
        let newDomains = 0;
        let existingDomains = 0;
        const skipped: string[] = [];
        const capturedAt = nowIso();
        for (const c of nexusCitations) {
          if (!c.domain) { skipped.push(c.href); continue; }
          const { isNewDomain } = recordSourceAppearance({
            sourceDomain: c.domain,
            url: c.href,
            linkText: c.text,
            surface: response.nexusSurface ?? null,
            runContext: question,
            capturedAt,
          });
          if (isNewDomain) newDomains += 1; else existingDomains += 1;
        }
        const citationsEvent: LianaTerminalEvent = {
          kind: 'note',
          text:
            `   PARSER INSTRUMENT [assisted-mode-capture, D-BP152-051] CITATIONS captured from ${surface} `
            + `(${nexusCitations.length} found, untruncated, verbatim) = ${JSON.stringify(nexusCitations)} -- `
            + `${newDomains} new source domain(s), ${existingDomains} existing-source appearance(s)`
            + `${skipped.length ? `, ${skipped.length} skipped (unparseable domain)` : ''}. `
            + 'NO correctness score moved -- same appearance-only write D-BP152-025 already established.',
          ts: nowIso(),
        };
        emit(citationsEvent);
        stateEvents = [...stateEvents, citationsEvent];
      }

      // THE ANSWER GOES BACK IN THE SAME SHAPE AUTOMATED MODE'S OWN EXTRACTION RETURNS -- so the
      // calling method parses, stores, applies criteria, eliminates, scores and terminates
      // exactly as it would on a real automated answer. No summarizing, no re-templating: the
      // snippet is the captured text, verbatim.
      const raw: BrowserAuthorityRawExtraction = {
        snippet: capturedText,
        sourceUrl: url || null,
        authority: resolveAuthority(response.nexusSurface),
        selectorUsed: null,
        citations: citationRecords,
        results: [],
      };
      return raw;
    }
  };
}
