// liana_terminal_engine.nexus_capture.test.ts -- D-BP152-025/BISHOP/seg-nexus-returns-answer
//
// Verifies the Founder's BP152 ruling on the SEG_RETURN_BP152_024_GOOGLE_SURFACE_GAP.md diagnosis
// -- "do the second one, make the nexus surface return what I type." A new 'nexus_capture' action
// at the STEP 0 pause (requestStepZeroPause(), stepped_audible.ts): the operator types and submits
// his own query directly on the visible Nexus surface (nexus_authority_persistent_session.ts's
// 5-button chrome bar), then presses "Capture -> Liana Cycle" on THAT window. Main
// (captureNexusAuthorityVisibleText(), same file) reads the page's generic visible text and hands
// it to index.ts's 'nexus-authority-capture' handler, which resolves the currently-pending Step 0
// pause with a synthetic LianaSteppedResponse carrying the captured text/surface/URL/citations --
// this file exercises requestStepZeroPause()'s handling of that response directly, the same way
// this file's sibling (liana_terminal_engine.ask_google_this.test.ts) exercises 'ask_google'.
//
// THE SIX ASSERTIONS THIS TICKET'S VERIFY SECTION NAMES:
//   (a) captured text round-trips byte-identical from page to run state.
//   (b) the surface identity and URL are recorded with every capture.
//   (c) capture fires ONLY on the explicit operator action, never automatically.
//   (d) the existing askGoogle path is byte-unchanged in behavior.
//   (e) the run pauses again after a capture rather than advancing.
//   (f) the contamination flag fires on option strings and never blocks.
//
// Live-window mechanics (the actual <webview> DOM extraction, the "Capture -> Liana Cycle" button,
// the 'nexus-authority-capture' IPC round trip in index.ts) are UNVERIFIED here on purpose -- they
// require a real Electron BrowserWindow/webview, which this vitest-against-source suite (same
// convention as every other liana_terminal_engine.*.test.ts sibling) does not spin up. See this
// ticket's own deliverable for the exact post-restart manual check.

import { describe, test, expect, vi } from 'vitest';
import path from 'node:path';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => path.resolve(__dirname, '..', '..', '..'),
  },
}));

import { runLianaCycleQuestion } from './liana_terminal_engine';
import { requestStepZeroPause, SteppedAudibleLog } from './stepped_audible';
import type { SteppedAudibleChannel } from './stepped_audible';
import {
  getSourceAppearances,
  getSourceCredibilityRecord,
  recordSourceAppearance,
} from '../plow/specialist_adapters';

type TerminalEvent = { kind: string; text: string; ts: string };
type SteppedAction = 'approve' | 'correct' | 'redirect' | 'abandon' | 'ask_google' | 'nexus_capture';
type NexusCitation = { href: string; text: string; domain: string | null };
type SteppedResponse = {
  pauseId: string;
  action: SteppedAction;
  text?: string;
  nexusCapturedText?: string;
  nexusSurface?: string | null;
  nexusUrl?: string;
  nexusContainerUsed?: string;
  nexusCitations?: NexusCitation[];
  nexusRunContext?: string;
};
type SteppedPause = { pauseId: string; stepIndex: number; stepTotal: number; step: { key: string; codeLabel: string }; events: TerminalEvent[]; suggestions: string[]; ts: string };

// qid 1's real bundled option B, used for the contamination assertion (f) -- same literal as this
// file's ask_google_this sibling, read from resources/mmlu_pro_bundled/questions.jsonl via
// loadQuestion(), not re-typed from memory beyond this one copy for the assertion string.
const QID1_OPTION_B = 'longitudinal section of a shoot tip';

describe('NEXUS CAPTURE RETURNS WHAT HE TYPED (D-BP152-025)', () => {

  test('(a) captured text round-trips byte-identical from page to run state -- no length cap, no truncation', async () => {
    const askGoogle = async (_q: string) => null;
    const longAnswer = 'Y'.repeat(6000) + '-NEXUS-END-MARKER-6000';

    let round = 0;
    const channel: SteppedAudibleChannel = {
      requestStepPause: async (pause) => {
        round += 1;
        if (round === 1) {
          return {
            pauseId: pause.pauseId,
            action: 'nexus_capture',
            nexusCapturedText: longAnswer,
            nexusSurface: 'google',
            nexusUrl: 'https://www.google.com/search?q=test',
            nexusContainerUsed: 'main',
          } satisfies SteppedResponse;
        }
        return { pauseId: pause.pauseId, action: 'approve' } satisfies SteppedResponse;
      },
    };

    const events: TerminalEvent[] = [];
    await runLianaCycleQuestion('1', askGoogle, (e: TerminalEvent) => events.push(e), null, channel);

    const carrier = events.find((e) => e.text.includes('-NEXUS-END-MARKER-6000'));
    expect(carrier, 'the full 6000+ char captured text reached the live transcript').toBeDefined();
    expect(carrier!.text).toContain(longAnswer);
    expect(carrier!.text, 'no truncation disclosure text is present -- nothing was cut').not.toMatch(/TRUNCATED/);
  });

  test('(b) surface identity and URL are recorded with EVERY capture, including an empty one', async () => {
    const askGoogle = async (_q: string) => null;

    // Sub-case 1: a normal, non-empty capture.
    {
      let round = 0;
      const channel: SteppedAudibleChannel = {
        requestStepPause: async (pause) => {
          round += 1;
          if (round === 1) {
            return {
              pauseId: pause.pauseId,
              action: 'nexus_capture',
              nexusCapturedText: 'a real captured answer',
              nexusSurface: 'perplexity',
              nexusUrl: 'https://www.perplexity.ai/search/abc123',
              nexusContainerUsed: 'article',
            } satisfies SteppedResponse;
          }
          return { pauseId: pause.pauseId, action: 'approve' } satisfies SteppedResponse;
        },
      };
      const events: TerminalEvent[] = [];
      await runLianaCycleQuestion('1', askGoogle, (e: TerminalEvent) => events.push(e), null, channel);
      const provenance = events.find((e) => /capture context:/.test(e.text));
      expect(provenance, 'a provenance line is emitted').toBeDefined();
      expect(provenance!.text).toContain('surface="perplexity"');
      expect(provenance!.text).toContain('url="https://www.perplexity.ai/search/abc123"');
    }

    // Sub-case 2: an EMPTY capture (nothing visible on the page) -- provenance must still be
    // recorded even though there is no answer text to carry (requirement 4: "an answer whose
    // source is unrecorded is worthless").
    {
      let round = 0;
      const channel: SteppedAudibleChannel = {
        requestStepPause: async (pause) => {
          round += 1;
          if (round === 1) {
            return {
              pauseId: pause.pauseId,
              action: 'nexus_capture',
              nexusCapturedText: '',
              nexusSurface: 'claude',
              nexusUrl: 'https://claude.ai/new',
              nexusContainerUsed: 'body',
            } satisfies SteppedResponse;
          }
          return { pauseId: pause.pauseId, action: 'approve' } satisfies SteppedResponse;
        },
      };
      const events: TerminalEvent[] = [];
      await runLianaCycleQuestion('1', askGoogle, (e: TerminalEvent) => events.push(e), null, channel);
      const provenance = events.find((e) => /capture context:/.test(e.text));
      expect(provenance, 'provenance is recorded even on an empty capture').toBeDefined();
      expect(provenance!.text).toContain('surface="claude"');
      expect(provenance!.text).toContain('url="https://claude.ai/new"');
      const emptyNote = events.find((e) => /no visible text found/.test(e.text));
      expect(emptyNote, 'the empty capture is reported honestly, not silently dropped').toBeDefined();
    }
  });

  test('(c) capture only ever fires on the explicit nexus_capture action -- approve/ask_google never produce a capture line', async () => {
    const askGoogleCalls: string[] = [];
    const askGoogle = async (q: string) => { askGoogleCalls.push(q); return { snippet: 'ack', sourceUrl: null, authority: 'user_google' as const, selectorUsed: null }; };

    let round = 0;
    const channel: SteppedAudibleChannel = {
      requestStepPause: async (pause) => {
        round += 1;
        if (round === 1) return { pauseId: pause.pauseId, action: 'ask_google', text: 'a normal typed query' } satisfies SteppedResponse;
        return { pauseId: pause.pauseId, action: 'approve' } satisfies SteppedResponse;
      },
    };
    const events: TerminalEvent[] = [];
    await runLianaCycleQuestion('1', askGoogle, (e: TerminalEvent) => events.push(e), null, channel);

    expect(events.some((e) => /nexus-capture/.test(e.text)), 'no nexus-capture line appears on a run that never sent the nexus_capture action').toBe(false);
    expect(askGoogleCalls.length).toBe(1); // ask_google path fired exactly as before, untouched
  });

  test('(d) the existing askGoogle path is byte-unchanged: ask_google and nexus_capture can interleave in the same run without affecting each other', async () => {
    const askGoogleCalls: string[] = [];
    const askGoogle = async (q: string) => { askGoogleCalls.push(q); return { snippet: 'the google answer', sourceUrl: null, authority: 'user_google' as const, selectorUsed: null }; };

    let round = 0;
    const channel: SteppedAudibleChannel = {
      requestStepPause: async (pause) => {
        round += 1;
        if (round === 1) return { pauseId: pause.pauseId, action: 'ask_google', text: 'first, via the box' } satisfies SteppedResponse;
        if (round === 2) {
          return {
            pauseId: pause.pauseId,
            action: 'nexus_capture',
            nexusCapturedText: 'second, via the nexus surface',
            nexusSurface: 'gemini',
            nexusUrl: 'https://gemini.google.com/app',
            nexusContainerUsed: 'main',
          } satisfies SteppedResponse;
        }
        return { pauseId: pause.pauseId, action: 'approve' } satisfies SteppedResponse;
      },
    };
    const events: TerminalEvent[] = [];
    await runLianaCycleQuestion('1', askGoogle, (e: TerminalEvent) => events.push(e), null, channel);

    // askGoogle was called EXACTLY once -- for the ask_google round only; the nexus_capture round
    // never touches askGoogle at all (requirement: "does not change askGoogle... byte-unchanged").
    expect(askGoogleCalls).toEqual(['first, via the box']);
    expect(events.some((e) => e.text.includes('the google answer'))).toBe(true);
    expect(events.some((e) => e.text.includes('second, via the nexus surface'))).toBe(true);
  });

  test('(e) the run pauses again after a capture rather than advancing', async () => {
    const askGoogle = async (_q: string) => null;
    const seenPauses: SteppedPause[] = [];
    let round = 0;
    const channel: SteppedAudibleChannel = {
      requestStepPause: async (pause) => {
        seenPauses.push(pause as unknown as SteppedPause);
        round += 1;
        if (round === 1) {
          return {
            pauseId: pause.pauseId,
            action: 'nexus_capture',
            nexusCapturedText: 'first capture',
            nexusSurface: 'google',
            nexusUrl: 'https://www.google.com/search?q=x',
            nexusContainerUsed: 'main',
          } satisfies SteppedResponse;
        }
        if (round === 2) {
          return {
            pauseId: pause.pauseId,
            action: 'nexus_capture',
            nexusCapturedText: 'second capture',
            nexusSurface: 'chatgpt',
            nexusUrl: 'https://chatgpt.com/',
            nexusContainerUsed: 'main',
          } satisfies SteppedResponse;
        }
        return { pauseId: pause.pauseId, action: 'approve' } satisfies SteppedResponse;
      },
    };
    const events: TerminalEvent[] = [];
    await runLianaCycleQuestion('1', askGoogle, (e: TerminalEvent) => events.push(e), null, channel);

    // Two capture rounds -> THREE pauses total (initial + one follow-up per round), same loop
    // shape as ask_google's own regression test.
    expect(seenPauses.length).toBe(3);
    expect(seenPauses.every((p) => p.step.key === 'step0')).toBe(true);
    const secondPauseText = seenPauses[1].events.map((e) => e.text).join('\n');
    expect(secondPauseText).toContain('first capture');
    const demandIdx = events.findIndex((e) => /DEMAND TEST/.test(e.text));
    const secondCaptureIdx = events.findIndex((e) => e.text.includes('second capture'));
    expect(demandIdx, 'the run does not advance to DEMAND TEST while still cycling through captures').toBeGreaterThan(secondCaptureIdx);
  });

  test('(f) the contamination flag fires when captured text contains an option string, and does not fire when it does not -- never blocks', async () => {
    const askGoogle = async (_q: string) => null;

    // (f.1) CONTAMINATED
    {
      const contaminatedCapture = `The page said the answer is ${QID1_OPTION_B}, among other things.`;
      let round = 0;
      const channel: SteppedAudibleChannel = {
        requestStepPause: async (pause) => {
          round += 1;
          if (round === 1) {
            return {
              pauseId: pause.pauseId,
              action: 'nexus_capture',
              nexusCapturedText: contaminatedCapture,
              nexusSurface: 'google',
              nexusUrl: 'https://www.google.com/search?q=x',
              nexusContainerUsed: 'main',
            } satisfies SteppedResponse;
          }
          return { pauseId: pause.pauseId, action: 'approve' } satisfies SteppedResponse;
        },
      };
      const events: TerminalEvent[] = [];
      await runLianaCycleQuestion('1', askGoogle, (e: TerminalEvent) => events.push(e), null, channel);

      // NEVER BLOCKED: the full captured text still reaches the transcript, verbatim.
      expect(events.some((e) => e.text.includes(contaminatedCapture))).toBe(true);
      const flagged = events.some((e) => /CONTAMINATION FLAG/.test(e.text) && e.text.includes(QID1_OPTION_B));
      expect(flagged, 'contamination flag fires and names the matched option string').toBe(true);
    }

    // (f.2) CLEAN
    {
      const cleanCapture = 'The page described general cell biology with no option text at all.';
      let round = 0;
      const channel: SteppedAudibleChannel = {
        requestStepPause: async (pause) => {
          round += 1;
          if (round === 1) {
            return {
              pauseId: pause.pauseId,
              action: 'nexus_capture',
              nexusCapturedText: cleanCapture,
              nexusSurface: 'google',
              nexusUrl: 'https://www.google.com/search?q=x',
              nexusContainerUsed: 'main',
            } satisfies SteppedResponse;
          }
          return { pauseId: pause.pauseId, action: 'approve' } satisfies SteppedResponse;
        },
      };
      const events: TerminalEvent[] = [];
      await runLianaCycleQuestion('1', askGoogle, (e: TerminalEvent) => events.push(e), null, channel);

      expect(events.some((e) => e.text.includes(cleanCapture))).toBe(true);
      const flagged = events.some((e) => /CONTAMINATION FLAG/.test(e.text));
      expect(flagged, 'no contamination flag when no option string is present').toBe(false);
    }
  });

  test('DIRECT: requestStepZeroPause() records a nexus_capture round in the log, same trace convention as ask_google', async () => {
    const log = new SteppedAudibleLog();
    const askGoogle = async (_q: string) => null;
    let round = 0;
    const channel: SteppedAudibleChannel = {
      requestStepPause: async (pause) => {
        round += 1;
        if (round === 1) {
          return {
            pauseId: pause.pauseId,
            action: 'nexus_capture',
            nexusCapturedText: 'the raw captured answer',
            nexusSurface: 'google',
            nexusUrl: 'https://www.google.com/search?q=x',
            nexusContainerUsed: 'main',
          } satisfies SteppedResponse;
        }
        return { pauseId: pause.pauseId, action: 'correct', text: 'a correction' } satisfies SteppedResponse;
      },
    };
    const emitted: TerminalEvent[] = [];
    await requestStepZeroPause(channel, log, [], askGoogle, (e) => emitted.push(e as TerminalEvent), null);

    const records = log.all();
    expect(records.length).toBe(2);
    expect(records[0]).toMatchObject({ stepKey: 'step0', action: 'nexus_capture' });
    expect(records[1]).toMatchObject({ stepKey: 'step0', action: 'correct', text: 'a correction' });
    expect(emitted.some((e) => e.text.includes('the raw captured answer'))).toBe(true);
  });

  // ── D-BP152-025 scope addition: appearance-only source logging ──────────────────────────────
  //
  // Founder, BP152: "sources just make an appearance ... correctness score gets moved only from
  // the correct answer traced back to the provenance sources." recordSourceAppearance()
  // (specialist_adapters.ts) must create-or-append by domain and NEVER touch
  // sourceCredibilityLedger's scoreValue/observedN.

  test('citations captured alongside a Nexus answer are recorded as APPEARANCES: new domain on first sight, appended on the next', async () => {
    const askGoogle = async (_q: string) => null;
    const domain = `d-bp152-025-test-${Date.now()}.example.com`;

    let round = 0;
    const channel: SteppedAudibleChannel = {
      requestStepPause: async (pause) => {
        round += 1;
        if (round === 1) {
          return {
            pauseId: pause.pauseId,
            action: 'nexus_capture',
            nexusCapturedText: 'an answer with a cited source',
            nexusSurface: 'google',
            nexusUrl: 'https://www.google.com/search?q=x',
            nexusContainerUsed: 'main',
            nexusRunContext: '1',
            nexusCitations: [
              { href: `https://${domain}/page-one`, text: 'Page One', domain },
            ],
          } satisfies SteppedResponse;
        }
        if (round === 2) {
          return {
            pauseId: pause.pauseId,
            action: 'nexus_capture',
            nexusCapturedText: 'a second answer citing the same domain',
            nexusSurface: 'perplexity',
            nexusUrl: 'https://www.perplexity.ai/search/y',
            nexusContainerUsed: 'main',
            nexusRunContext: '1',
            nexusCitations: [
              { href: `https://${domain}/page-two`, text: 'Page Two', domain },
            ],
          } satisfies SteppedResponse;
        }
        return { pauseId: pause.pauseId, action: 'approve' } satisfies SteppedResponse;
      },
    };
    const events: TerminalEvent[] = [];
    await runLianaCycleQuestion('1', askGoogle, (e: TerminalEvent) => events.push(e), null, channel);

    const appearances = getSourceAppearances(domain);
    expect(appearances.length, 'both citations landed as appearances under the same domain').toBe(2);
    expect(appearances[0].url).toBe(`https://${domain}/page-one`);
    expect(appearances[0].linkText).toBe('Page One');
    expect(appearances[0].surface).toBe('google');
    expect(appearances[0].runContext).toBe('1');
    expect(appearances[1].url).toBe(`https://${domain}/page-two`);
    expect(appearances[1].surface).toBe('perplexity');

    // The ledger report line names 1 new domain (first capture) and 1 existing-domain appearance
    // (second capture) -- "N new vs M existing", per the Founder's own ticket wording.
    const firstReport = events.find((e) => /SOURCE APPEARANCE LOG/.test(e.text) && /1 new source domain/.test(e.text));
    const secondReport = events.find((e) => /SOURCE APPEARANCE LOG/.test(e.text) && /1 existing-source appearance/.test(e.text) && /0 new source domain/.test(e.text));
    expect(firstReport, 'first capture reports a new domain').toBeDefined();
    expect(secondReport, 'second capture reports an existing-domain appearance, not a new one').toBeDefined();

    // THE TRAP, verified directly: no correctness score exists for this domain anywhere in
    // sourceCredibilityLedger -- an appearance NEVER creates or moves a SourceCredibilityRecord.
    expect(getSourceCredibilityRecord(`citation:${domain}`, '1')).toBeUndefined();
    expect(getSourceCredibilityRecord(domain, '1')).toBeUndefined();
    expect(events.some((e) => /NO correctness score moved/.test(e.text))).toBe(true);
  });

  test('recordSourceAppearance() never touches sourceCredibilityLedger (pure unit check, no engine involved)', () => {
    const domain = `d-bp152-025-pure-test-${Date.now()}.example.org`;
    const first = recordSourceAppearance({
      sourceDomain: domain,
      url: `https://${domain}/a`,
      linkText: 'A',
      surface: 'claude',
      runContext: 'free-text question',
      capturedAt: new Date().toISOString(),
    });
    expect(first.isNewDomain).toBe(true);
    expect(first.appearanceCountForDomain).toBe(1);

    const second = recordSourceAppearance({
      sourceDomain: domain,
      url: `https://${domain}/b`,
      linkText: 'B',
      surface: 'chatgpt',
      runContext: 'free-text question',
      capturedAt: new Date().toISOString(),
    });
    expect(second.isNewDomain).toBe(false);
    expect(second.appearanceCountForDomain).toBe(2);

    expect(getSourceAppearances(domain).length).toBe(2);
    // No (sourceId, domainId) pair touched in the correctness ledger by either call, under any
    // key shape a caller might guess.
    expect(getSourceCredibilityRecord(domain, 'any-domain-id')).toBeUndefined();
    expect(getSourceCredibilityRecord(`citation:${domain}`, 'any-domain-id')).toBeUndefined();
  });
});
