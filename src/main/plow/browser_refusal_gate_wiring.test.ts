/**
 * D-BP223-M0-BROWSER_REFUSAL_WIRED, extended by D-BP223-M0-BROWSER_GATE_BYPASSES.
 *
 * browser_lookup_refusal_gate.test.ts (sibling file, pre-existing) already proves the CHOKEPOINT
 * itself refuses correctly when handed a BrowserAuthorityAdapterConfig with benchmarkCorpusId set
 * directly. What that file does NOT prove is that anything upstream actually SETS the field for a
 * live run -- and until D-BP223-M0-BROWSER_REFUSAL_WIRED, nothing did: CanonicalPlowMcConfig
 * (plow_mc_answerer.ts) had no benchmarkCorpusId field at all, so every `{ ...config,
 * preferredAuthority: '...' }` spread at plow_mc_answerer.ts's Stage F2/F3/Ensemble call sites
 * could never carry one, and one_click_mmlu_pro.ts's callCanonicalPlowMcAnswererForMeshTest()
 * call never set one either. The gate was compiled, tested, and permanently PERMITTING in
 * production -- built, never fed.
 *
 * The FIRST block below (pre-existing) proves the FEEDING for the Stage F2 perplexity/google
 * spread pattern, not the chokepoint (that is the sibling file's job): it reconstructs the exact
 * object shape and spread pattern plow_mc_answerer.ts's real call sites use, built from a config
 * object carrying the two fields that dispatch added (CanonicalPlowMcConfig.benchmarkCorpusId /
 * PlowMcAnswererCallParams.benchmarkCorpusId), and drives it through the REAL, unmodified
 * runBrowserAuthorityLookup/Observed chokepoint with a spy bridge.
 *
 * D-BP223-M0-BROWSER_GATE_BYPASSES adds the SECOND and THIRD blocks below, closing the two
 * bypasses D-BP223-M0-BROWSER_REFUSAL_WIRED's own report named but did not touch (Tare Rule):
 *   (a) the three queryClaudeBrowserAuthorityObserved/ChatGpt/Gemini helpers and the cake-pick
 *       llmPickerNames loop (plow_mc_answerer.ts) built a FRESH config literal instead of
 *       spreading the caller's `config`, so benchmarkCorpusId never reached them even when set
 *       upstream -- fixed by threading `config` into each and spreading it (SECOND block below,
 *       tested via the same spy-bridge-through-the-real-chokepoint technique as the first block).
 *   (b) the WAN relay-route responder (index.ts's startRelayRoutePoll) never set
 *       benchmarkCorpusId at all -- fixed by extracting deriveBenchmarkCorpusIdForRelayRequest()
 *       as its own exported pure function and calling it at that call site (THIRD block below,
 *       tested via the same slice-and-eval-the-real-source technique index_vram_gate.test.ts
 *       established for testing pure helpers inside index.ts without importing the whole,
 *       Electron-main-process file).
 *
 * A gate that has only ever passed is not known to work -- every test in this file fails loudly
 * if the bridge is touched when it must not be, or if the real function does not behave as
 * documented.
 */
import { describe, it, test, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  runBrowserAuthorityLookup,
  runBrowserAuthorityLookupObserved,
  type BrowserAuthorityAdapterConfig,
} from './browser_authority_adapter';
import {
  queryClaudeBrowserAuthorityObserved,
  queryChatGptBrowserAuthorityObserved,
  queryGeminiBrowserAuthorityObserved,
  type CanonicalPlowMcConfig,
} from './plow_mc_answerer';

function spyBridge() {
  const calls: string[] = [];
  return {
    calls,
    bridge: {
      runQueryInUserBrowser: async () => { calls.push('runQueryInUserBrowser'); return null; },
      runQueryInUserBrowserObserved: async () => {
        calls.push('runQueryInUserBrowserObserved');
        return { raw: null, dispatchOutcome: 'no_result' as const };
      },
    },
  };
}

/** Byte-for-byte the same `plowConfig` shape callCanonicalPlowMcAnswererForMeshTest
 *  (plow_mc_answerer.ts) now builds for a one_click_mmlu_pro.ts-style MMLU-Pro run, after this
 *  dispatch's edits: `domain` plus a conditional `benchmarkCorpusId` spread, researchArmMode true
 *  fanning out researchArmBrowserAuthority true (both required for isBrowserAuthorityEnabled). */
function buildLivePlowConfigLikeMeshTestCall(benchmarkCorpusId: string | undefined) {
  return {
    domain: 'law',
    ...(benchmarkCorpusId ? { benchmarkCorpusId } : {}),
    researchArmMode: true,
    researchArmBrowserAuthority: true,
  };
}

describe('the fix this dispatch makes: benchmarkCorpusId is actually FED to the chokepoint', () => {
  it('ARMED: a one_click_mmlu_pro.ts-shaped config (domain + benchmarkCorpusId: "MMLU-Pro"), '
    + 'spread through plow_mc_answerer.ts\'s own Stage F2 perplexity-call pattern, REFUSES and '
    + 'never touches the bridge', async () => {
    const plowConfig = buildLivePlowConfigLikeMeshTestCall('MMLU-Pro');
    const s = spyBridge();
    // Exact spread pattern from plow_mc_answerer.ts's Stage F2 perplexity call site:
    // `{ ...config, preferredAuthority: 'user_perplexity', mcOptions: mcOptionTextsForQuery }`
    const r = await runBrowserAuthorityLookup(
      'a law question with options',
      { ...plowConfig, preferredAuthority: 'user_perplexity', mcOptions: ['A) x', 'B) y'] } as BrowserAuthorityAdapterConfig,
      s.bridge as never,
    );
    expect(r).toBeNull();
    expect(s.calls).toEqual([]);
  });

  it('ARMED on the Observed sibling too (Authority Ensemble\'s perplexity/google legs use this '
    + 'one) -- reports "disabled", never dispatches', async () => {
    const plowConfig = buildLivePlowConfigLikeMeshTestCall('MMLU-Pro');
    const s = spyBridge();
    const o = await runBrowserAuthorityLookupObserved(
      'a law question',
      { ...plowConfig, preferredAuthority: 'user_google', embedOptionsForGoogle: true } as BrowserAuthorityAdapterConfig,
      s.bridge as never,
    );
    expect(o.result).toBeNull();
    expect(o.dispatchOutcome).toBe('disabled');
    expect(s.calls).toEqual([]);
  });

  it('REGRESSION: the exact SAME spread pattern with benchmarkCorpusId absent (byte-identical to '
    + 'every pre-BP223 caller, since CanonicalPlowMcConfig had no such field before this dispatch) '
    + 'still PERMITS and reaches the bridge -- this dispatch must not change fail-open behavior '
    + 'for callers that do not set the new field', async () => {
    const plowConfig = buildLivePlowConfigLikeMeshTestCall(undefined);
    const s = spyBridge();
    const r = await runBrowserAuthorityLookup(
      'a law question with options',
      { ...plowConfig, preferredAuthority: 'user_perplexity', mcOptions: ['A) x', 'B) y'] } as BrowserAuthorityAdapterConfig,
      s.bridge as never,
    );
    expect(r).toBeNull(); // spy bridge always returns null -- this asserts DISPATCH, not an answer
    expect(s.calls).toEqual(['runQueryInUserBrowser']);
  });

  it('one_click_mmlu_pro.ts\'s actual call site sets the literal string "MMLU-Pro", not a domain '
    + 'category (e.g. "law") -- confirms the two are not confused at the wiring layer', async () => {
    // q.category values look like 'law', 'engineering', etc. (per_domain_q_banks.ts) -- none of
    // those are on KNOWN_BENCHMARK_CORPUS_IDS, so if this dispatch had wired `domain` into
    // benchmarkCorpusId by mistake instead of the literal 'MMLU-Pro', this would wrongly PERMIT.
    const wrongPlowConfig = buildLivePlowConfigLikeMeshTestCall('law');
    const s = spyBridge();
    await runBrowserAuthorityLookup(
      'a law question', { ...wrongPlowConfig, preferredAuthority: 'user_perplexity' } as BrowserAuthorityAdapterConfig, s.bridge as never,
    );
    expect(s.calls.length).toBeGreaterThan(0); // PERMITTED -- proves 'law' alone would not have gated

    const rightPlowConfig = buildLivePlowConfigLikeMeshTestCall('MMLU-Pro');
    const s2 = spyBridge();
    await runBrowserAuthorityLookup(
      'a law question', { ...rightPlowConfig, preferredAuthority: 'user_perplexity' } as BrowserAuthorityAdapterConfig, s2.bridge as never,
    );
    expect(s2.calls).toEqual([]); // REFUSED -- the literal corpus id is what actually gates
  });
});

/** Minimal, valid CanonicalPlowMcConfig for driving the REAL (now-exported)
 *  queryClaudeBrowserAuthorityObserved/ChatGpt/Gemini functions directly -- required fields only
 *  (domain/ollamaBaseUrl/model/choiceCount/andonEnabled), plus the two opt-in flags
 *  isBrowserAuthorityEnabled() needs (researchArmMode/researchArmBrowserAuthority), plus a
 *  conditional benchmarkCorpusId spread -- same omit-when-absent convention as
 *  buildLivePlowConfigLikeMeshTestCall above, so the unarmed case is byte-identical to a config
 *  that never had the field, not a config with it explicitly set to undefined. */
function buildQueryObservedTestConfig(benchmarkCorpusId: string | undefined): CanonicalPlowMcConfig {
  return {
    domain: 'law',
    ollamaBaseUrl: 'http://127.0.0.1:11434',
    model: 'gemma4:12b',
    choiceCount: 4,
    andonEnabled: false,
    researchArmMode: true,
    researchArmBrowserAuthority: true,
    ...(benchmarkCorpusId ? { benchmarkCorpusId } : {}),
  };
}

describe('D-BP223-M0-BROWSER_GATE_BYPASSES, bypass (a): the three queryXBrowserAuthorityObserved '
  + 'helpers and the cake-pick llmPickerNames loop (plow_mc_answerer.ts) now spread the caller\'s '
  + '`config` instead of building a fresh literal, so benchmarkCorpusId actually reaches them', () => {
  it('queryClaudeBrowserAuthorityObserved: the REAL, unmodified function (not a reconstructed '
    + 'pattern) -- config.benchmarkCorpusId="MMLU-Pro" -> refuses, bridge never touched', async () => {
    const s = spyBridge();
    const observed = await queryClaudeBrowserAuthorityObserved(
      'a law question', ['A) x', 'B) y'], s.bridge as never, buildQueryObservedTestConfig('MMLU-Pro'),
    );
    expect(observed.result).toBeNull();
    expect(observed.dispatchOutcome).toBe('disabled');
    expect(s.calls).toEqual([]);
  });

  it('queryChatGptBrowserAuthorityObserved: the REAL, unmodified function -- same wiring, same '
    + 'refusal', async () => {
    const s = spyBridge();
    const observed = await queryChatGptBrowserAuthorityObserved(
      'a law question', [], s.bridge as never, buildQueryObservedTestConfig('MMLU-Pro'),
    );
    expect(observed.result).toBeNull();
    expect(observed.dispatchOutcome).toBe('disabled');
    expect(s.calls).toEqual([]);
  });

  it('queryGeminiBrowserAuthorityObserved: the REAL, unmodified function -- same wiring, same '
    + 'refusal', async () => {
    const s = spyBridge();
    const observed = await queryGeminiBrowserAuthorityObserved(
      'a law question', [], s.bridge as never, buildQueryObservedTestConfig('MMLU-Pro'),
    );
    expect(observed.result).toBeNull();
    expect(observed.dispatchOutcome).toBe('disabled');
    expect(s.calls).toEqual([]);
  });

  it('REGRESSION: the same three REAL functions with benchmarkCorpusId absent from config '
    + '(byte-identical to every pre-fix caller, since these functions took no `config` parameter '
    + 'at all before this dispatch) still PERMIT and reach the bridge -- this dispatch must not '
    + 'change fail-open behavior for a config that never sets the new field', async () => {
    const unarmed = buildQueryObservedTestConfig(undefined);
    for (const fn of [
      queryClaudeBrowserAuthorityObserved,
      queryChatGptBrowserAuthorityObserved,
      queryGeminiBrowserAuthorityObserved,
    ]) {
      const s = spyBridge();
      const observed = await fn('a law question', [], s.bridge as never, unarmed);
      expect(observed.dispatchOutcome).toBe('no_result'); // dispatched, spy bridge found nothing
      expect(s.calls).toEqual(['runQueryInUserBrowserObserved']);
    }
  });

  it('cake-pick llmPickerNames loop (runCakeMethodDisagreementResolution\'s picker.askPick for '
    + 'user_claude/user_chatgpt/user_gemini): reconstructs the exact spread this dispatch changed '
    + 'it to -- `{ ...config, researchArmMode: true, researchArmBrowserAuthority: true, '
    + 'preferredAuthority: llmName }` -- through the REAL, unmodified chokepoint -> REFUSES, never '
    + 'touches the bridge (mirrors the ARMED test above for the user_perplexity picker, which '
    + 'already spread `config` before this dispatch and was never a bypass)', async () => {
    const config = buildQueryObservedTestConfig('MMLU-Pro');
    const s = spyBridge();
    const r = await runBrowserAuthorityLookup(
      'a law question',
      { ...config, researchArmMode: true, researchArmBrowserAuthority: true, preferredAuthority: 'user_claude' } as BrowserAuthorityAdapterConfig,
      s.bridge as never,
    );
    expect(r).toBeNull();
    expect(s.calls).toEqual([]);
  });

  it('REGRESSION: the same cake-pick spread pattern with benchmarkCorpusId absent -- byte-'
    + 'identical to the pre-fix literal (`{ researchArmMode: true, researchArmBrowserAuthority: '
    + 'true, preferredAuthority: llmName }`, since spreading an empty-of-that-field config adds '
    + 'nothing new) -- still PERMITS and reaches the bridge', async () => {
    const config = buildQueryObservedTestConfig(undefined);
    const s = spyBridge();
    const r = await runBrowserAuthorityLookup(
      'a law question',
      { ...config, researchArmMode: true, researchArmBrowserAuthority: true, preferredAuthority: 'user_claude' } as BrowserAuthorityAdapterConfig,
      s.bridge as never,
    );
    expect(r).toBeNull(); // spy bridge always returns null -- this asserts DISPATCH, not an answer
    expect(s.calls).toEqual(['runQueryInUserBrowser']);
  });
});

/**
 * D-BP223-M0-BROWSER_GATE_BYPASSES, bypass (b): the WAN relay-route responder
 * (index.ts's startRelayRoutePoll) never set benchmarkCorpusId at all before this dispatch.
 * Fixed by extracting deriveBenchmarkCorpusIdForRelayRequest() as its own exported, side-effect-
 * free pure function (index.ts) and calling it at that call site.
 *
 * index.ts is a 10,000+ line Electron main-process file that imports 'electron' at module scope
 * (see index_vram_gate.test.ts's own header) -- it cannot be imported directly into a vitest run.
 * Same technique that file already established for resolveVramGatedAnswerModel: slice the exact
 * source text of the pure function out of index.ts, strip TypeScript types via esbuild, and
 * eval it to get a REAL callable function -- never a hand-duplicated reimplementation that could
 * silently drift from what index.ts actually ships.
 */
describe('deriveBenchmarkCorpusIdForRelayRequest (index.ts) -- D-BP223-M0-BROWSER_GATE_BYPASSES', () => {
  let deriveBenchmarkCorpusIdForRelayRequest: (payload: Record<string, unknown>) => string | undefined;
  let indexSrc: string;

  beforeAll(() => {
    const INDEX_TS_PATH = join(__dirname, '..', 'index.ts');
    indexSrc = readFileSync(INDEX_TS_PATH, 'utf8');

    const startMarker = '/** D-BP223-M0-BROWSER_GATE_BYPASSES: pure, side-effect-free derivation';
    const endMarker = '// Same rationale as ai_dispatch_ipc.ts/peer_server.ts\'s caches:';
    const startIdx = indexSrc.indexOf(startMarker);
    const endIdx = indexSrc.indexOf(endMarker);
    expect(startIdx, 'deriveBenchmarkCorpusIdForRelayRequest doc comment not found in index.ts').toBeGreaterThan(-1);
    expect(endIdx, 'boundary marker (_cachedVramDetectionForRelayAnswer comment) not found in index.ts').toBeGreaterThan(startIdx);

    const rawSlice = indexSrc.slice(startIdx, endIdx).replace(/^export /gm, '');

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const esbuild = require('esbuild');
    const { code } = esbuild.transformSync(rawSlice, { loader: 'ts', format: 'cjs' });

    const sandboxModule = { exports: {} as Record<string, unknown> };
    // eslint-disable-next-line no-new-func
    const factory = new Function(
      'module', 'exports',
      code + '\nexports.deriveBenchmarkCorpusIdForRelayRequest = deriveBenchmarkCorpusIdForRelayRequest;',
    );
    factory(sandboxModule, sandboxModule.exports);
    deriveBenchmarkCorpusIdForRelayRequest =
      sandboxModule.exports.deriveBenchmarkCorpusIdForRelayRequest as (payload: Record<string, unknown>) => string | undefined;

    expect(typeof deriveBenchmarkCorpusIdForRelayRequest, 'deriveBenchmarkCorpusIdForRelayRequest did not eval to a function').toBe('function');
  });

  test('an MMLU-Pro WAN question_id (wan_dispatch.ts\'s own `mmlu-pro-wan-${...}` stamp) resolves '
    + 'to the literal corpus id "MMLU-Pro"', () => {
    expect(deriveBenchmarkCorpusIdForRelayRequest({ question_id: 'mmlu-pro-wan-42' })).toBe('MMLU-Pro');
  });

  test('a fan-out question_id (wan_dispatch.ts\'s `mmlu-pro-fanout-${...}-${letter}` stamp) does '
    + 'NOT match the exact wan prefix -- genuinely unknown, resolves to undefined (fail-open, '
    + 'declared)', () => {
    expect(deriveBenchmarkCorpusIdForRelayRequest({ question_id: 'mmlu-pro-fanout-42-A' })).toBeUndefined();
  });

  test('no question_id on the payload -- genuinely unknown, resolves to undefined', () => {
    expect(deriveBenchmarkCorpusIdForRelayRequest({})).toBeUndefined();
  });

  test('a non-string question_id -- treated as absent, resolves to undefined, never throws', () => {
    expect(deriveBenchmarkCorpusIdForRelayRequest({ question_id: 12345 })).toBeUndefined();
  });

  test('an unrelated question_id shape -- genuinely unknown, resolves to undefined, never '
    + 'defaulted to "MMLU-Pro" blind', () => {
    expect(deriveBenchmarkCorpusIdForRelayRequest({ question_id: 'some-other-benchmark-q-1' })).toBeUndefined();
  });

  test('the WAN relay-route responder call site actually calls this function and threads its '
    + 'result into callCanonicalPlowMcAnswererForMeshTest as benchmarkCorpusId', () => {
    expect(indexSrc).toContain('const benchmarkCorpusIdForPlow = deriveBenchmarkCorpusIdForRelayRequest(payload);');
    expect(indexSrc).toContain('...(benchmarkCorpusIdForPlow ? { benchmarkCorpusId: benchmarkCorpusIdForPlow } : {}),');
  });
});
