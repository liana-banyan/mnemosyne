// SEG-K23-D — Prove It Works: honest poller health check (Truth-Always §2)
// BP136 Yoke: extended with the answer-cache mode toggle + real (restart-surviving) meter
// summary. "Nothing that isn't real" -- every number below comes from
// ai-dispatch:answer-cache-meter-summary, which reads the persisted per-query JSONL log.
// BP139: extended with Authority Proof Panel -- sign-in status + live test query + result.

import React, { useState, useCallback, useEffect, useRef } from 'react';
// BP1xx Browser Authority enable-toggle unification (this build pass): reuse the SAME
// mnem_drt_specialists load/save/persist path SettingsTab.tsx's MnemDrtPanel already uses
// (localStorage 'mnemo_mnem_drt' mirror + amplify.aiDispatch.saveSettings round-trip to
// ai_dispatch_settings.json) rather than inventing a second, possibly-diverging persistence
// path. See SettingsTab.tsx's own export comment above these three for the rationale.
import { loadMnemDrt, saveMnemDrt, persistMnemDrtToBackend } from '../SettingsTab';
// BP140-K5 MOVE 3: "Two Barrels" replaces "The Meter" below -- see TwoBarrelMeter.tsx's header
// for the full boundary-check writeup (getAnswerCacheMeterSummary() is aggregate-only, so
// Barrel 2 renders a single real "aggregate" stratum and Barrel 1 renders an honest "not yet
// tracked" empty state; no per-AI number is fabricated).
import { TwoBarrelMeter } from '../TwoBarrelMeter';
// D-BP223-BM0-X033-022 ("Haystack Needle" test #2): Scavenger Hunt -- zero-model-call substrate
// phrase search + "did you mean" answer-with-sources, mounted below My Savings Receipt.
import { ScavengerHuntPanel } from './ScavengerHuntPanel';
// D-BP223-BM04-X033S3-009 ("Prove It, a question somebody else asked"): the four spec-Section-1
// regions (A ask / B ticker / C the card / D somebody else's question), mounted ABOVE everything
// else in this file -- nothing below this addition is removed; Answer Cache, the Two Barrels
// estimate meter, My Savings Receipt, Scavenger Hunt and the Authority Proof Panel all keep
// working exactly as before, reading the same counters they always have.
import {
  PROVEIT_CATEGORIES,
  PROVEIT_CATEGORY_LABELS,
  PROVEIT_ANSWERED_BY_LABELS,
  isKnownProveItCategory,
  type ProveItCard,
  type ProveItCategory,
  type ProveItAnswerMethod,
  type ProveItTickerEvent,
  type ProveItSource,
  type ProveItPersona,
  PROVEIT_MAKE_PERSONA_URL,
} from '../../../shared/proveit_contract';
import { isRegionDUnlocked, shouldCompleteFromPaste, shouldShowUnlockHighlight } from './proveit_ui_logic';
import { PROVEIT_HOW_IT_WORKS_TITLE, PROVEIT_HOW_IT_WORKS_TEXT } from './proveItHowItWorksText';

export interface ProveItWorksTabProps {
  onFirstComplete?: () => void;
  onSwitchTab?: (tab: string) => void;
}

type CheckState = 'idle' | 'checking' | 'alive' | 'offline';

// BP139 Authority Proof Panel types
type AuthorityCheckState = 'idle' | 'checking' | 'done' | 'error';
type AuthorityTestState = 'idle' | 'running' | 'done' | 'error';

// BP140-K4: widened from 3 to 5 members (chatgpt/gemini added) to match
// checkNexusAuthoritySignInStatus()'s now-shared BrowserAuthorityName-typed response.
interface AuthoritySignInRow {
  authority: 'user_google' | 'user_perplexity' | 'user_claude' | 'user_chatgpt' | 'user_gemini';
  signedIn: boolean;
  reason: string;
  checkedAt: string;
}

interface AuthorityTestResult {
  answerType: 'computable' | 'lookup_fact' | 'reasoning';
  usable: boolean;
  reason?: 'flag_off' | 'not_lookup_fact' | 'authority_empty';
  fact?: string;
  sourceUrl?: string;
  authority?: 'user_google' | 'user_perplexity';
  confidence?: number;
}

const AUTHORITY_LABELS: Record<string, string> = {
  user_google: 'Google',
  user_perplexity: 'Perplexity',
  user_claude: 'Claude',
  user_chatgpt: 'ChatGPT',
  user_gemini: 'Gemini',
};

const REASON_EXPLANATIONS: Record<string, string> = {
  flag_off: 'Research Arm + Browser Authority flags are both OFF in Settings > Authorities. Enable them there, then retry.',
  not_lookup_fact: 'The question was not classified as a lookup-fact (a single verifiable fact). Try a question like "what year did the Berlin Wall fall".',
  authority_empty: 'Both Google and Perplexity were tried but neither returned a usable result. Check that you are signed in to both authorities.',
};

const DEFAULT_TEST_QUESTION = 'what year did the Berlin Wall fall';

interface MeterSummary {
  total_queries: number;
  served_verbatim_count: number;
  rag_count: number;
  local_generate_count: number;
  flagship_count: number;
  cloud_cost_avoided_usd: number;
  avg_latency_ms: number;
  avg_served_verbatim_latency_ms: number;
}

// D-BP223-BM09-ARCHBISHOP-004-016 ("My Savings Receipt", REDO of 004-010): the MEASURED, signed
// counterpart to the estimate meter above -- see amplify.d.ts's savingsReceipt.getSummary for the
// full return shape.
type SavingsWindow = 'all' | 'hour' | 'day' | 'week' | 'fortnight' | 'month' | 'quarter';

const SAVINGS_WINDOW_LABELS: Record<SavingsWindow, string> = {
  all: 'All time',
  hour: 'An hour',
  day: 'A day',
  week: 'A week',
  fortnight: 'A fortnight',
  month: 'A month',
  quarter: 'A quarter',
};

interface SavingsMilestoneFlags {
  hour: boolean;
  day: boolean;
  week: boolean;
  fortnight: boolean;
  month: boolean;
  quarter: boolean;
}

interface SavingsAggregate {
  total_queries: number;
  cost_avoided_usd: number;
  measurement_scope: string;
  records_with_measured_saving: number;
  records_excluded_unmeasured: number;
  confidence: string;
  // D-BP223-BM04-X033S3-009: already present on the real savings-receipt:summary IPC response
  // (amplify.d.ts's SavingsReceipt.getSummary aggregate) but not previously read by this file --
  // added here (additive, matches the real shape) so the Prove It header meter's "model calls
  // avoided" figure reads a real existing counter rather than inventing a new one.
  flagship_calls_avoided: number;
}

interface SavingsReceiptSummary {
  ok: boolean;
  error?: string;
  window?: string;
  empty?: boolean;
  chain_ok?: boolean;
  chain_broken_at_index?: number | null;
  first_record_utc?: string | null;
  days_in_use?: number;
  milestones_reached?: SavingsMilestoneFlags;
  aggregate?: SavingsAggregate | null;
  receipt_block?: string | null;
}

function panelStyle(): React.CSSProperties {
  return {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(148, 163, 184, 0.06)',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    borderRadius: 6,
  };
}

export function ProveItWorksTab(props: ProveItWorksTabProps) {
  const { onFirstComplete, onSwitchTab } = props;
  const [checkState, setCheckState] = useState<CheckState>('idle');
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [hasCompleted, setHasCompleted] = useState(false);

  // BP136: answer-cache mode toggle + meter summary
  const [cacheModeOn, setCacheModeOn] = useState(false);
  const [cacheModeLoaded, setCacheModeLoaded] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [meter, setMeter] = useState<MeterSummary | null>(null);
  const [loadingMeter, setLoadingMeter] = useState(false);

  // D-BP223-BM09-ARCHBISHOP-004-016: My Savings Receipt panel state
  const [savingsWindow, setSavingsWindow] = useState<SavingsWindow>('all');
  const [savingsSummary, setSavingsSummary] = useState<SavingsReceiptSummary | null>(null);
  const [loadingSavings, setLoadingSavings] = useState(false);
  const [savingsCopyState, setSavingsCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  // BP139: Authority Proof Panel
  const [authorityCheckState, setAuthorityCheckState] = useState<AuthorityCheckState>('idle');
  const [flagsEnabled, setFlagsEnabled] = useState<boolean | null>(null);
  const [signInStatuses, setSignInStatuses] = useState<AuthoritySignInRow[] | null>(null);
  const [testQuestion, setTestQuestion] = useState(DEFAULT_TEST_QUESTION);
  const [testState, setTestState] = useState<AuthorityTestState>('idle');
  const [testResult, setTestResult] = useState<AuthorityTestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const testQuestionRef = useRef(testQuestion);

  // BP1xx Browser Authority enable-toggle unification: mirrors the SAME
  // mnem_drt_specialists Record<string, boolean> SettingsTab.tsx's MnemDrtPanel reads/writes,
  // keyed by 'user_google' | 'user_perplexity' | 'user_claude' (BrowserLlmAuthorityName). Loaded
  // once from the localStorage mirror on mount -- same read path loadMnemDrt() always uses, no
  // new source of truth.
  const [authorityEnabled, setAuthorityEnabled] = useState<Record<string, boolean>>(
    () => loadMnemDrt().mnem_drt_specialists,
  );

  // ── D-BP223-BM04-X033S3-009: Prove It, "a question somebody else asked" ──────────────────
  // Region A: ask your own question.
  const [piCategories, setPiCategories] = useState<Array<{ slug: ProveItCategory; label: string }>>(
    PROVEIT_CATEGORIES.map((slug) => ({ slug, label: PROVEIT_CATEGORY_LABELS[slug] })),
  );
  const [piCategory, setPiCategory] = useState<ProveItCategory>('other');
  const [piQuestion, setPiQuestion] = useState('');
  const [piMethod, setPiMethod] = useState<ProveItAnswerMethod>('user_claude');
  const [piAsking, setPiAsking] = useState(false);
  const [piAuthorityFailure, setPiAuthorityFailure] = useState<string | null>(null);
  const [piByHandActive, setPiByHandActive] = useState(false);
  const [piPastedAnswer, setPiPastedAnswer] = useState('');
  const [piSuggestCategoryOpen, setPiSuggestCategoryOpen] = useState(false);
  const [piSuggestCategoryText, setPiSuggestCategoryText] = useState('');

  // Region B: the live ticker.
  const [piTicker, setPiTicker] = useState<ProveItTickerEvent[]>([]);
  const piTickerEndRef = useRef<HTMLDivElement | null>(null);

  // Region C: the card.
  const [piCard, setPiCard] = useState<ProveItCard | null>(null);
  const [piAskError, setPiAskError] = useState<string | null>(null);
  const [piAddingToSubstrate, setPiAddingToSubstrate] = useState(false);
  const [piProvenanceOpen, setPiProvenanceOpen] = useState(false);

  // Region D: "Use a question somebody else asked".
  const [piRegionDCards, setPiRegionDCards] = useState<ProveItCard[]>([]);
  const [piRegionDUnlocked, setPiRegionDUnlocked] = useState(false);
  const [piRegionDCategory, setPiRegionDCategory] = useState<ProveItCategory | 'all'>('all');
  const [piUnlockHighlightShown, setPiUnlockHighlightShown] = useState(false);
  const [piShowUnlockHighlight, setPiShowUnlockHighlight] = useState(false);

  const piAsker = { memberDisplay: undefined as string | undefined, guestDisplay: 'Guest' };

  // X039 (D-BP223-PQ004-006): the persona a card is published under. Cards carry the persona,
  // never the account. Loaded when a card is on screen and not yet published.
  const [piPersonas, setPiPersonas] = useState<ProveItPersona[]>([]);
  const [piPersonaId, setPiPersonaId] = useState<string>('');
  const [piSignedIn, setPiSignedIn] = useState<boolean | null>(null); // null = not checked yet
  const [piPublishNote, setPiPublishNote] = useState<string | null>(null);
  const [piTakingBack, setPiTakingBack] = useState(false);

  const piLoadPersonas = useCallback(async () => {
    try {
      const res = await window.amplify?.proveIt?.listMyPersonas?.();
      if (!res) return;
      setPiSignedIn(res.signedIn);
      setPiPersonas(res.personas);
      setPiPersonaId((cur) => (res.personas.some((p) => p.id === cur) ? cur : res.personas[0]?.id ?? ''));
    } catch {
      // non-fatal: the publish itself still reports the reason if it cannot go live
    }
  }, []);

  const piLoadCategories = useCallback(async () => {
    try {
      const res = await window.amplify?.proveIt?.categories?.();
      if (res?.ok && res.categories.length) setPiCategories(res.categories);
    } catch {
      // non-fatal -- the 14-category default above is already a real, correct list
    }
  }, []);

  const piLoadRegionD = useCallback(async (category: ProveItCategory | 'all') => {
    try {
      const res = await window.amplify?.proveIt?.listSomebodyElse?.({ category, sortBy: 'votes' });
      if (res?.ok) {
        setPiRegionDUnlocked((wasUnlocked) => {
          const nowUnlocked = isRegionDUnlocked(res.unlocked);
          if (shouldShowUnlockHighlight(wasUnlocked, nowUnlocked, piUnlockHighlightShown)) {
            setPiShowUnlockHighlight(true);
            setPiUnlockHighlightShown(true);
          }
          return nowUnlocked;
        });
        setPiRegionDCards(res.cards);
      }
    } catch {
      // non-fatal -- region D just stays empty/locked until the next successful refresh
    }
  }, [piUnlockHighlightShown]);

  useEffect(() => {
    void piLoadCategories();
    void piLoadRegionD(piRegionDCategory);
    const unsubscribe = window.amplify?.proveIt?.onTicker?.((event) => {
      setPiTicker((prev) => [...prev, event].slice(-64));
    });
    return () => unsubscribe?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    piTickerEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [piTicker]);

  const piResetForNewAsk = useCallback(() => {
    setPiTicker([]);
    setPiCard(null);
    setPiAskError(null);
    setPiAuthorityFailure(null);
    setPiByHandActive(false);
    setPiPastedAnswer('');
  }, []);

  // D-BP223-BM04-X033S3-010 Gap 2: a local, client-side ticker line pushed straight into piTicker
  // so region B shows the authority call happening (spec Section 3) even though that call itself
  // runs on the renderer side, ahead of the card-write IPC that emits its own, main-process-
  // sourced ticker sequence (card_writer.ts::buildAndWriteCard). Both streams share the shape
  // ProveItTickerEvent already defines and interleave correctly in piTicker by timestamp -- see
  // ASK_PATH_FINDINGS.md for the full investigation this wiring is based on.
  const piLocalRunIdRef = useRef<string>('');
  const piPushLocalTicker = useCallback((step: ProveItTickerEvent['step'], line: string, error?: ProveItTickerEvent['error']) => {
    if (!piLocalRunIdRef.current) piLocalRunIdRef.current = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setPiTicker((prev) => [...prev, { runId: piLocalRunIdRef.current, step, atMs: Date.now(), line, ...(error ? { error } : {}) }].slice(-64));
  }, []);

  const piSubmitCard = useCallback(async (method: ProveItAnswerMethod, answerText: string, sources?: ProveItSource[]) => {
    setPiAsking(true);
    try {
      const res = await window.amplify?.proveIt?.ask?.({
        question: piQuestion.trim(),
        category: piCategory,
        method,
        answerText: method === 'by_hand' ? undefined : answerText,
        pastedAnswer: method === 'by_hand' ? answerText : undefined,
        sources,
        asker: piAsker,
      });
      if (res?.ok && res.card) {
        setPiCard(res.card);
      } else {
        setPiAskError(res?.error ?? 'Could not write the card.');
      }
    } catch (e) {
      setPiAskError(String(e));
    } finally {
      setPiAsking(false);
    }
  }, [piQuestion, piCategory]);

  // D-BP223-BM04-X033S3-010 Gap 2: "Answer with" now works for every plug, not just google/
  // perplexity lookup-facts. See ASK_PATH_FINDINGS.md -- window.amplify.runBrowserAuthorityQuery
  // is a general, already-built, unrestricted-by-lookup-fact-classification ask path wired for
  // all five authorities (google/perplexity via a static DOM query, claude/chatgpt/gemini via
  // the interactive navigate->type->submit->scrape driver, BP140-K4). ProveItAnswerMethod's five
  // 'user_*' members are byte-identical to BrowserAuthorityName, so no translation is needed.
  const piHandleAsk = useCallback(async () => {
    const q = piQuestion.trim();
    if (!q || !isKnownProveItCategory(piCategory)) return;
    piResetForNewAsk();
    piLocalRunIdRef.current = '';
    if (piMethod === 'by_hand') {
      setPiByHandActive(true);
      return;
    }
    setPiAsking(true);
    try {
      const label = AUTHORITY_LABELS[piMethod] ?? piMethod;
      piPushLocalTicker('brain_selected', `opening ${label} in your own signed-in window ...`);
      const raw = await window.amplify?.runBrowserAuthorityQuery?.({
        question: q,
        authority: piMethod as 'user_google' | 'user_perplexity' | 'user_claude' | 'user_chatgpt' | 'user_gemini',
      });
      if (!raw || !raw.snippet || !raw.snippet.trim()) {
        // Honest, one-line dead-end-avoidance: no plug selection may leave the user stranded
        // (brief's Gap 2 rule) -- the by-hand box is already rendered right below this failure.
        const reason = `${label} did not return an answer (not signed in, the window is unavailable, or the reply was empty) -- try again, or use the by-hand box below.`;
        piPushLocalTicker('error', reason, { atStep: 'brain_selected', reason, byHandOffered: true });
        setPiAuthorityFailure(reason);
        return;
      }
      const sources: ProveItSource[] = (raw.citations && raw.citations.length)
        ? raw.citations.map((c) => ({ label: c.label || c.url, url: c.url }))
        : (raw.sourceUrl ? [{ label: raw.sourceUrl, url: raw.sourceUrl }] : []);
      const wordCount = raw.snippet.trim().split(/\s+/).filter(Boolean).length;
      piPushLocalTicker('answer_received', `answer received (${label}) . ${wordCount} words . ${sources.length} source${sources.length === 1 ? '' : 's'} cited`);
      await piSubmitCard(piMethod, raw.snippet, sources);
    } catch (e) {
      const label = AUTHORITY_LABELS[piMethod] ?? piMethod;
      const reason = `${label} lookup threw an error: ${String(e)} -- try again, or use the by-hand box below.`;
      piPushLocalTicker('error', reason, { atStep: 'brain_selected', reason, byHandOffered: true });
      setPiAuthorityFailure(reason);
    } finally {
      setPiAsking(false);
    }
  }, [piQuestion, piCategory, piMethod, piResetForNewAsk, piSubmitCard, piPushLocalTicker]);

  const piHandlePasteAnswer = useCallback((nextText: string) => {
    const previous = piPastedAnswer;
    setPiPastedAnswer(nextText);
    if (shouldCompleteFromPaste(previous, nextText)) {
      void piSubmitCard('by_hand', nextText);
    }
  }, [piPastedAnswer, piSubmitCard]);

  const piCopyQuestionForByHand = useCallback(() => {
    try {
      void navigator.clipboard.writeText(piQuestion.trim());
    } catch {
      // non-fatal -- the question is still visible on screen to copy by selection
    }
  }, [piQuestion]);

  const piHandleAddToSubstrate = useCallback(async () => {
    if (!piCard) return;
    setPiAddingToSubstrate(true);
    setPiPublishNote(null);
    try {
      const res = await window.amplify?.proveIt?.addToSubstrate?.({ address: piCard.address, asker: piAsker, personaId: piPersonaId || undefined });
      if (res?.ok && res.card) {
        setPiCard(res.card);
        void piLoadRegionD(piRegionDCategory);
      }
      // Say why a card was only queued, in plain words: it is kept, not published yet.
      if (res?.queued && res.error) setPiPublishNote(`Kept on this computer, not published yet: ${res.error.replace(/^[A-Z_]+: /, '')}`);
    } finally {
      setPiAddingToSubstrate(false);
    }
  }, [piCard, piRegionDCategory, piLoadRegionD, piPersonaId]);

  const piHandleTakeBack = useCallback(async () => {
    if (!piCard) return;
    setPiTakingBack(true);
    try {
      const res = await window.amplify?.proveIt?.takeBack?.({ address: piCard.address });
      if (res?.ok && res.card) {
        setPiCard(res.card);
        setPiPublishNote('Taken back. Nobody else can see it now.');
        void piLoadRegionD(piRegionDCategory);
      } else if (res?.error) {
        setPiPublishNote(`Not taken back: ${res.error.replace(/^[A-Z_]+: /, '')}`);
      }
    } finally {
      setPiTakingBack(false);
    }
  }, [piCard, piRegionDCategory, piLoadRegionD]);

  useEffect(() => {
    if (piCard && piCard.publishedAt === null && !piCard.isSeed) void piLoadPersonas();
  }, [piCard?.address, piCard?.publishedAt, piLoadPersonas]);

  const piHandleAskThisOne = useCallback(async (address: string) => {
    piResetForNewAsk();
    setPiAsking(true);
    try {
      const res = await window.amplify?.proveIt?.askThisOne?.({ address });
      if (res?.ok && res.card) setPiCard(res.card);
      else setPiAskError(res?.error ?? 'Could not read that card.');
    } finally {
      setPiAsking(false);
    }
  }, [piResetForNewAsk]);

  const piHandleVote = useCallback(async (address: string) => {
    await window.amplify?.proveIt?.vote?.({ address, isGhost: true, voter: { guestWalletId: 'local-guest' } });
    void piLoadRegionD(piRegionDCategory);
  }, [piRegionDCategory, piLoadRegionD]);

  const piHandleSuggestCategory = useCallback(async () => {
    const text = piSuggestCategoryText.trim();
    if (!text) return;
    await window.amplify?.proveIt?.suggestCategory?.(text);
    setPiSuggestCategoryText('');
    setPiSuggestCategoryOpen(false);
  }, [piSuggestCategoryText]);

  const piChangeRegionDCategory = useCallback((category: ProveItCategory | 'all') => {
    setPiRegionDCategory(category);
    void piLoadRegionD(category);
  }, [piLoadRegionD]);

  const refreshMeter = useCallback(async () => {
    setLoadingMeter(true);
    try {
      const res = await window.amplify?.aiDispatch?.getAnswerCacheMeterSummary?.();
      if (res?.ok && res.summary) setMeter(res.summary);
    } catch {
      // non-fatal — panel just shows the last-known (or empty) state
    }
    setLoadingMeter(false);
  }, []);

  // D-BP223-BM09-ARCHBISHOP-004-016: refreshes the signed, measured "My Savings Receipt" panel
  // for the currently-selected window. Separate IPC call, separate state, from refreshMeter above
  // (which stays the estimate meter, untouched). Param named `win`, not `window` -- shadowing the
  // global `window` object here would silently break the `window.amplify` call below it.
  const refreshSavings = useCallback(async (win: SavingsWindow) => {
    setLoadingSavings(true);
    setSavingsCopyState('idle');
    try {
      const res = await window.amplify?.savingsReceipt?.getSummary?.({ window: win });
      if (res) setSavingsSummary(res as SavingsReceiptSummary);
    } catch {
      // non-fatal — panel just shows the last-known (or empty) state
    }
    setLoadingSavings(false);
  }, []);

  // BP139: check authority sign-in status + flag state
  const refreshAuthorityStatus = useCallback(async () => {
    setAuthorityCheckState('checking');
    try {
      const res = await window.amplify?.checkNexusAuthoritySignInStatus?.();
      if (res) {
        setFlagsEnabled(res.enabled ?? false);
        setSignInStatuses(res.statuses ?? []);
        setAuthorityCheckState('done');
      } else {
        setAuthorityCheckState('error');
      }
    } catch {
      setAuthorityCheckState('error');
    }
  }, []);

  // BP139: run a live test query through the authority chain
  const runAuthorityTest = useCallback(async () => {
    const q = testQuestionRef.current.trim();
    if (!q) return;
    setTestState('running');
    setTestResult(null);
    setTestError(null);
    try {
      const res = await window.amplify?.nexusAskLookupFact?.(q) as AuthorityTestResult | undefined;
      if (res) {
        setTestResult(res);
        setTestState('done');
      } else {
        setTestError('No response from authority IPC');
        setTestState('error');
      }
    } catch (e) {
      setTestError(String(e));
      setTestState('error');
    }
  }, []);

  // BP1xx Browser Authority enable-toggle unification: "the toggle IS the login trigger"
  // (Founder BP1xx). Writes mnem_drt_specialists[authority] through the SAME
  // load-current/merge/save/persist sequence SettingsTab.tsx's updateSpecialist() uses --
  // reading loadMnemDrt() fresh (not the closed-over `drt` this file doesn't have) so this never
  // clobbers other specialist keys (wikipedia/wolfram/etc.) that MnemDrtPanel may have already
  // saved. When switching ON while not currently signed in, also opens the SAME nexus sign-in
  // window NexusAuthoritySignInPanel.tsx's own "Sign in to X" button opens
  // (window.amplify.openNexusAuthoritySignIn) -- toggle-on doubles as the login trigger.
  const toggleAuthorityEnabled = useCallback((authority: AuthoritySignInRow['authority'], nextVal: boolean, signedIn: boolean) => {
    const current = loadMnemDrt();
    const next = { ...current, mnem_drt_specialists: { ...current.mnem_drt_specialists, [authority]: nextVal } };
    saveMnemDrt(next);
    void persistMnemDrtToBackend(next);
    setAuthorityEnabled(next.mnem_drt_specialists);
    if (nextVal && !signedIn) {
      void window.amplify?.openNexusAuthoritySignIn?.(authority);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await window.amplify?.aiDispatch?.getSettings?.();
        if (res?.ok && res.settings) setCacheModeOn(res.settings.answer_cache_mode === true);
      } catch {
        // non-fatal — defaults to OFF, which matches the real default
      }
      setCacheModeLoaded(true);
    })();
    void refreshMeter();
    // BP139: auto-probe authority status on mount so the panel is not cold
    void refreshAuthorityStatus();
    // D-BP223-BM09-ARCHBISHOP-004-016: load the default ('all') savings receipt window on mount
    void refreshSavings('all');
  }, [refreshMeter, refreshAuthorityStatus, refreshSavings]);

  // D-BP223-BM09-ARCHBISHOP-004-016: re-fetch whenever the member picks a different window
  const changeSavingsWindow = useCallback((win: SavingsWindow) => {
    setSavingsWindow(win);
    void refreshSavings(win);
  }, [refreshSavings]);

  const copySavingsReceipt = useCallback(() => {
    const text = savingsSummary?.receipt_block;
    if (!text) return;
    try {
      void navigator.clipboard.writeText(text).then(
        () => setSavingsCopyState('copied'),
        () => setSavingsCopyState('error'),
      );
    } catch {
      setSavingsCopyState('error');
    }
  }, [savingsSummary]);

  // BP139: keep the ref in sync so runAuthorityTest captures the latest question
  useEffect(() => { testQuestionRef.current = testQuestion; }, [testQuestion]);

  const toggleCacheMode = useCallback(async () => {
    const next = !cacheModeOn;
    setToggling(true);
    setCacheModeOn(next);
    try {
      await window.amplify?.aiDispatch?.saveSettings?.({ answer_cache_mode: next });
    } catch {
      // non-fatal — UI stays optimistic; next getSettings() read will reconcile
    }
    setToggling(false);
  }, [cacheModeOn]);

  const runCheck = useCallback(async () => {
    setCheckState('checking');
    setCheckedAt(null);

    try {
      const result = await (window as any).amplify?.pollerHealthQuery?.();
      const timestamp = new Date().toISOString();
      setCheckedAt(timestamp);

      if (result?.alive === true) {
        setCheckState('alive');
      } else {
        setCheckState('offline');
      }

      if (!hasCompleted) {
        setHasCompleted(true);
        onFirstComplete?.();
      }
    } catch {
      setCheckedAt(new Date().toISOString());
      setCheckState('offline');
    }
  }, [hasCompleted, onFirstComplete]);

  return (
    <div style={{ padding: 16, height: '100%', boxSizing: 'border-box', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 4 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>Prove It Works</div>
        {/* Spec Section 1 top-right meter: reads the SAME counters as My Savings Receipt below --
            never a third counting scheme (see proveit_contract.ts's own comment). */}
        {savingsSummary?.aggregate && (
          <div style={{ fontSize: 11, color: '#8bc8a0', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>
            answers {savingsSummary.aggregate.total_queries} . model calls avoided {savingsSummary.aggregate.flagship_calls_avoided} . ${savingsSummary.aggregate.cost_avoided_usd.toFixed(2)}
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: '#707070', marginBottom: 4, lineHeight: 1.5 }}>
        Serve the frontier answer instantly at $0 — real counters only, nothing fabricated.
      </div>

      {/* ── D-BP223-BM04-X033S3-009: Region A -- Ask your own question ─────────────────────── */}
      <div style={panelStyle()}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>A. Ask your own question</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={piCategory}
            onChange={(e) => setPiCategory(e.target.value as ProveItCategory)}
            style={{ padding: '5px 8px', borderRadius: 4, background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(148,163,184,0.3)', color: '#e2e8f0', fontSize: 12 }}
          >
            {piCategories.map((c) => (
              <option key={c.slug} value={c.slug}>{c.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setPiSuggestCategoryOpen((v) => !v)}
            style={{ background: 'none', border: '1px solid rgba(148,163,184,0.3)', borderRadius: 4, color: '#94a3b8', fontSize: 11, padding: '5px 8px', cursor: 'pointer' }}
          >
            Suggest a category
          </button>
        </div>
        {piSuggestCategoryOpen && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input
              type="text"
              value={piSuggestCategoryText}
              onChange={(e) => setPiSuggestCategoryText(e.target.value)}
              placeholder="Suggest a category (goes to the Harper Guild queue)"
              style={{ flex: 1, padding: '5px 8px', borderRadius: 4, background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(148,163,184,0.3)', color: '#e2e8f0', fontSize: 12 }}
            />
            <button type="button" onClick={() => void piHandleSuggestCategory()} style={{ padding: '5px 10px', borderRadius: 4, background: 'rgba(100,200,150,0.15)', border: '1px solid rgba(100,200,150,0.5)', color: '#8bc8a0', fontSize: 11, cursor: 'pointer' }}>
              Submit
            </button>
          </div>
        )}
        <input
          type="text"
          value={piQuestion}
          onChange={(e) => setPiQuestion(e.target.value)}
          placeholder="How many moons does Jupiter have, and what are their names?"
          disabled={piAsking}
          style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 4, background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(148,163,184,0.3)', color: '#e2e8f0', fontSize: 12, marginBottom: 8 }}
        />
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Answer with:</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          {(['user_claude', 'user_chatgpt', 'user_gemini', 'user_perplexity', 'user_google', 'by_hand'] as ProveItAnswerMethod[]).map((m) => (
            <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: piMethod === m ? '#8bc8a0' : '#94a3b8', cursor: 'pointer' }}>
              <input type="radio" name="proveit-answer-method" checked={piMethod === m} onChange={() => setPiMethod(m)} />
              {m === 'by_hand' ? 'By hand' : AUTHORITY_LABELS[m] ?? m}
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void piHandleAsk()}
          disabled={piAsking || !piQuestion.trim()}
          style={{ padding: '8px 18px', borderRadius: 4, background: 'rgba(100,200,150,0.15)', border: '1px solid rgba(100,200,150,0.5)', color: '#8bc8a0', fontSize: 13, fontWeight: 600, cursor: piAsking ? 'wait' : 'pointer', opacity: piAsking || !piQuestion.trim() ? 0.6 : 1 }}
        >
          {piAsking ? 'Asking…' : 'Ask'}
        </button>

        {piAuthorityFailure && (
          <div style={{ marginTop: 10, fontSize: 11, color: '#fca5a5', lineHeight: 1.5 }}>
            {REASON_EXPLANATIONS[piAuthorityFailure] ?? piAuthorityFailure}
            {' '}
            <button type="button" onClick={() => { setPiMethod('by_hand'); setPiByHandActive(true); setPiAuthorityFailure(null); }} style={{ marginLeft: 4, background: 'none', border: '1px solid rgba(200,100,100,0.4)', borderRadius: 4, color: '#fca5a5', fontSize: 11, padding: '2px 8px', cursor: 'pointer' }}>
              Try by hand instead
            </button>
          </div>
        )}

        {piByHandActive && (
          <div style={{ marginTop: 10, padding: 10, borderRadius: 4, background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.2)' }}>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6, lineHeight: 1.5 }}>
              The Liana Cycle Two-Step: copy the question, ask whatever AI you use, wherever you use it, then paste the
              answer below. Pasting completes the card — no second Ask.
            </div>
            <button type="button" onClick={piCopyQuestionForByHand} style={{ marginBottom: 8, background: 'none', border: '1px solid rgba(148,163,184,0.3)', borderRadius: 4, color: '#94a3b8', fontSize: 11, padding: '4px 10px', cursor: 'pointer' }}>
              Copy question
            </button>
            <textarea
              value={piPastedAnswer}
              onChange={(e) => piHandlePasteAnswer(e.target.value)}
              placeholder="Paste the answer here (links are lifted into sources automatically)"
              style={{ width: '100%', boxSizing: 'border-box', minHeight: 90, padding: 8, borderRadius: 4, background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(148,163,184,0.3)', color: '#cbd5e1', fontSize: 12 }}
            />
          </div>
        )}
      </div>

      {/* ── Region B -- Watch it work (the ticker) ──────────────────────────────────────────── */}
      {piTicker.length > 0 && (
        <div style={{ ...panelStyle(), maxHeight: 160, overflowY: 'auto', fontFamily: 'ui-monospace, "SF Mono", Consolas, monospace', fontSize: 11 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 6, fontFamily: 'system-ui, sans-serif' }}>B. Watch it work</div>
          {piTicker.map((event, i) => (
            <div key={`${event.runId}-${i}`} style={{ color: event.step === 'error' ? '#fca5a5' : '#94a3b8', lineHeight: 1.6 }}>
              {new Date(event.atMs).toISOString().slice(11, 23)}  {event.line}
            </div>
          ))}
          <div ref={piTickerEndRef} />
        </div>
      )}

      {/* ── Region C -- The card ─────────────────────────────────────────────────────────────── */}
      {(piCard || piAskError) && (
        <div style={panelStyle()}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>C. The card</div>
          {piAskError && <div style={{ fontSize: 12, color: '#f87171' }}>{piAskError}</div>}
          {piCard && (
            <>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{piCard.question}</div>
              <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.6, marginBottom: 8, whiteSpace: 'pre-wrap' }}>{piCard.answer}</div>
              <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.7 }}>
                asked by {piCard.askedBy.display} ({piCard.askedBy.stamped === true ? 'stamped' : piCard.askedBy.stamped === false ? 'unsealed' : 'seed'}) . answered by {PROVEIT_ANSWERED_BY_LABELS[piCard.answeredBy]} . {piCard.madeAt.slice(0, 10)} . {piCard.validityClass === 'forever' ? 'valid: forever' : `valid until ${piCard.validUntil?.slice(0, 10)}`}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                sources: {piCard.unsourced ? 'no source given' : piCard.sources.map((s) => s.label).join(', ')}
                {'  '}
                <span role="link" tabIndex={0} onClick={() => setPiProvenanceOpen((v) => !v)} style={{ color: '#6ee7b7', textDecoration: 'underline', cursor: 'pointer' }}>
                  provenance chain {piProvenanceOpen ? '▲' : '▼'}
                </span>
              </div>
              {piProvenanceOpen && (
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 6, lineHeight: 1.6 }}>
                  address hex:{piCard.address}{piCard.supersedes ? ` . supersedes hex:${piCard.supersedes}` : ''}{piCard.supersededBy ? ` . superseded by hex:${piCard.supersededBy}` : ''}
                </div>
              )}
              <button
                type="button"
                onClick={() => void piHandleAddToSubstrate()}
                disabled={piAddingToSubstrate || piCard.publishedAt !== null}
                style={{
                  marginTop: 10, padding: '7px 16px', borderRadius: 4,
                  background: piCard.publishedAt !== null ? 'rgba(148,163,184,0.1)' : 'rgba(100,200,150,0.15)',
                  border: `1px solid ${piCard.publishedAt !== null ? 'rgba(148,163,184,0.3)' : 'rgba(100,200,150,0.5)'}`,
                  color: piCard.publishedAt !== null ? '#64748b' : '#8bc8a0', fontSize: 12, fontWeight: 600,
                  cursor: piCard.publishedAt !== null ? 'default' : 'pointer',
                }}
              >
                {piCard.publishedAt !== null ? (piCard.unpublishedAt ? 'Taken back' : piCard.queuedForSubstrate ? 'Queued for the substrate' : 'Published') : (piAddingToSubstrate ? 'Adding…' : 'Add to the Substrate')}
              </button>
              {/* X039: which persona publishes this card (the account behind it is never shown) */}
              {piCard.publishedAt === null && !piCard.isSeed && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
                  {piSignedIn === false && (
                    <span>Sign in to your Liana Banyan account to publish. Until then the card is kept on this computer.</span>
                  )}
                  {piSignedIn && piPersonas.length === 0 && (
                    <span>
                      Cards are published under a persona, never under your account.{' '}
                      <span
                        role="link"
                        tabIndex={0}
                        onClick={() => window.amplify?.openExternal?.(PROVEIT_MAKE_PERSONA_URL)}
                        onKeyDown={(e) => e.key === 'Enter' && window.amplify?.openExternal?.(PROVEIT_MAKE_PERSONA_URL)}
                        style={{ color: '#8bc8a0', textDecoration: 'underline', cursor: 'pointer' }}
                      >
                        Make a persona
                      </span>
                      {' '}then{' '}
                      <span role="button" tabIndex={0} onClick={() => void piLoadPersonas()} onKeyDown={(e) => e.key === 'Enter' && void piLoadPersonas()} style={{ color: '#8bc8a0', textDecoration: 'underline', cursor: 'pointer' }}>
                        check again
                      </span>.
                    </span>
                  )}
                  {piSignedIn && piPersonas.length === 1 && <span>Publishes under {piPersonas[0].displayName}.</span>}
                  {piSignedIn && piPersonas.length > 1 && (
                    <label>
                      Publish under{' '}
                      <select
                        value={piPersonaId}
                        onChange={(e) => setPiPersonaId(e.target.value)}
                        style={{ padding: '3px 6px', borderRadius: 4, background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(148,163,184,0.3)', color: '#e2e8f0', fontSize: 11 }}
                      >
                        {piPersonas.map((p) => <option key={p.id} value={p.id}>{p.displayName} ({p.slug})</option>)}
                      </select>
                    </label>
                  )}
                </div>
              )}
              {/* X039: take a live card back within 10 minutes; the substrate enforces the window */}
              {piCard.publishedAt !== null && !piCard.unpublishedAt && !piCard.isSeed && (
                <button
                  type="button"
                  onClick={() => void piHandleTakeBack()}
                  disabled={piTakingBack}
                  style={{ marginTop: 10, marginLeft: 8, padding: '7px 14px', borderRadius: 4, background: 'transparent', border: '1px solid rgba(148,163,184,0.4)', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}
                  title="You can take a card back for 10 minutes. After that it can only be superseded by a newer card."
                >
                  {piTakingBack ? 'Taking back…' : 'Take it back'}
                </button>
              )}
              {piPublishNote && <div style={{ marginTop: 8, fontSize: 11, color: '#cbd5e1', lineHeight: 1.5 }}>{piPublishNote}</div>}
            </>
          )}
        </div>
      )}

      {/* ── Region D -- Use a question SOMEBODY ELSE asked ──────────────────────────────────── */}
      <div style={{ ...panelStyle(), position: 'relative', opacity: piRegionDUnlocked ? 1 : 0.55 }}>
        {piShowUnlockHighlight && (
          <div style={{ position: 'absolute', inset: -2, border: '2px solid rgba(110,231,183,0.6)', borderRadius: 8, pointerEvents: 'none' }} />
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>D. Use a question somebody else asked</div>
          <select
            value={piRegionDCategory}
            onChange={(e) => piChangeRegionDCategory(e.target.value as ProveItCategory | 'all')}
            style={{ padding: '4px 6px', borderRadius: 4, background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(148,163,184,0.3)', color: '#94a3b8', fontSize: 11 }}
          >
            <option value="all">All categories</option>
            {piCategories.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
          </select>
        </div>
        {!piRegionDUnlocked && (
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8, lineHeight: 1.5 }}>
            Grayed until you Add to the Substrate at least one question of your own — the seed cards below still work.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
          {piRegionDCards.length === 0 && <div style={{ fontSize: 12, color: '#64748b' }}>No cards yet in this category.</div>}
          {piRegionDCards.map((c) => {
            // D-BP223-BM04-X033S3-010 Gap 3 fix: this panel's OWN copy, two lines above
            // ("the seed cards below still work"), and spec Section 6 ("Seed cards make the
            // first visitor's very first 'Ask this one' work in milliseconds... the 30-second
            // version of the whole pitch") both promise seed rows work before Region D unlocks.
            // 009's onClick/disabled wiring gated EVERY row on piRegionDUnlocked regardless of
            // c.isSeed, contradicting its own displayed text -- a brand-new install could never
            // click a seed row's "Ask this one" or vote, since listSomebodyElseCards() never
            // counts a seed card toward unlocking (by design: unlocking still requires a real
            // publish). Per-row unlock is the fix: a seed row is always interactive.
            const rowUnlocked = piRegionDUnlocked || c.isSeed;
            return (
            <div key={c.address} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 4, background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.15)' }}>
              <button type="button" onClick={() => rowUnlocked && void piHandleVote(c.address)} disabled={!rowUnlocked} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: rowUnlocked ? 'pointer' : 'default', fontSize: 12, minWidth: 28 }}>
                {c.voteCount} ▲
              </button>
              <div style={{ flex: 1, fontSize: 12, color: '#e2e8f0' }}>
                {c.question}
                {c.duplicateOfQid !== null && <span style={{ marginLeft: 6, fontSize: 10, color: '#fbbf24' }}>duplicate mint · qid {c.duplicateOfQid}</span>}
                <div style={{ fontSize: 10, color: '#64748b' }}>{c.askedBy.display} . {c.madeAt.slice(0, 10)}</div>
              </div>
              <button
                type="button"
                onClick={() => rowUnlocked && void piHandleAskThisOne(c.address)}
                disabled={!rowUnlocked}
                style={{ padding: '4px 10px', borderRadius: 4, background: 'rgba(100,200,150,0.15)', border: '1px solid rgba(100,200,150,0.5)', color: '#8bc8a0', fontSize: 11, fontWeight: 600, cursor: rowUnlocked ? 'pointer' : 'default', opacity: rowUnlocked ? 1 : 0.6 }}
              >
                Ask this one
              </button>
            </div>
            );
          })}
        </div>
      </div>

      {/* "How this works, in one example" -- spec Section 2 text, VERBATIM, one constant. */}
      <details style={{ ...panelStyle() }}>
        <summary style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', cursor: 'pointer' }}>{PROVEIT_HOW_IT_WORKS_TITLE}</summary>
        <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.7, marginTop: 10, whiteSpace: 'pre-wrap' }}>{PROVEIT_HOW_IT_WORKS_TEXT}</div>
      </details>

      {/* BP136: Answer Cache mode toggle */}
      <div style={panelStyle()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>Answer Cache</div>
            <div style={{ fontSize: 11, color: '#707070', marginTop: 2, lineHeight: 1.5 }}>
              When ON, an exact or near-identical repeat question is served straight from the
              verified answer store — $0, no model call. Default is OFF.
            </div>
          </div>
          <button
            type="button"
            onClick={() => void toggleCacheMode()}
            disabled={toggling || !cacheModeLoaded}
            style={{
              flexShrink: 0,
              padding: '6px 14px',
              backgroundColor: cacheModeOn ? 'rgba(100, 200, 150, 0.15)' : 'rgba(148, 163, 184, 0.1)',
              border: `1px solid ${cacheModeOn ? 'rgba(100, 200, 150, 0.5)' : 'rgba(148, 163, 184, 0.3)'}`,
              borderRadius: 5,
              color: cacheModeOn ? '#8bc8a0' : '#94a3b8',
              fontSize: 12,
              fontWeight: 700,
              cursor: toggling ? 'wait' : 'pointer',
              minWidth: 52,
            }}
          >
            {cacheModeOn ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* BP140-K5 MOVE 3: Two Barrels -- replaces "The Meter". Same meter/loadingMeter state,
          same refreshMeter() IPC call as before; only the visualization changed. */}
      <TwoBarrelMeter meter={meter} loading={loadingMeter} onRefresh={() => void refreshMeter()} />

      {meter && meter.total_queries > 0 && (
        <div style={{ ...panelStyle(), fontSize: 11, color: '#606060', lineHeight: 1.7 }}>
          <div>
            Served free (from substrate): <b style={{ color: '#6ee7b7' }}>{meter.served_verbatim_count}</b> of{' '}
            {meter.total_queries} queries
          </div>
          {meter.avg_served_verbatim_latency_ms > 0 && (
            <div>Avg latency, served free: {meter.avg_served_verbatim_latency_ms}ms</div>
          )}
          <div>
            RAG-assisted: {meter.rag_count} · Local generate: {meter.local_generate_count} · Flagship: {meter.flagship_count}
          </div>
        </div>
      )}

      {/* D-BP223-BM09-ARCHBISHOP-004-016 ("My Savings Receipt", REDO of 004-010): the MEASURED,
          signed counterpart to the Two Barrels estimate above. Separate panel, separate state,
          separate IPC channel (savings-receipt:summary) -- the estimate meter above keeps its own
          "estimate" label and is not touched by this block. */}
      <div style={{ ...panelStyle(), marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>My Savings Receipt</div>
          <button
            type="button"
            onClick={() => void refreshSavings(savingsWindow)}
            disabled={loadingSavings}
            style={{
              background: 'none', border: '1px solid rgba(148,163,184,0.3)', borderRadius: 4,
              color: '#94a3b8', fontSize: 11, padding: '2px 8px',
              cursor: loadingSavings ? 'wait' : 'pointer',
            }}
          >
            {loadingSavings ? '...' : 'Refresh'}
          </button>
        </div>
        <div style={{ fontSize: 11, color: '#707070', marginBottom: 10, lineHeight: 1.5 }}>
          A signed, hash-chained receipt -- MEASURED and verifiable, not an estimate.
        </div>

        {/* Window picker -- unreached milestones disabled with "Not yet: you started <date>" */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {(Object.keys(SAVINGS_WINDOW_LABELS) as SavingsWindow[]).map((w) => {
            const reached = w === 'all' || savingsSummary?.milestones_reached?.[w] === true;
            const startedLabel = savingsSummary?.first_record_utc
              ? new Date(savingsSummary.first_record_utc).toISOString().slice(0, 10)
              : null;
            return (
              <button
                key={w}
                type="button"
                onClick={() => reached && changeSavingsWindow(w)}
                disabled={!reached}
                title={!reached && startedLabel ? `Not yet: you started ${startedLabel}` : undefined}
                style={{
                  padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                  cursor: reached ? 'pointer' : 'not-allowed',
                  background: savingsWindow === w ? 'rgba(100,200,150,0.15)' : 'rgba(148,163,184,0.08)',
                  border: `1px solid ${savingsWindow === w ? 'rgba(100,200,150,0.5)' : 'rgba(148,163,184,0.25)'}`,
                  color: reached ? (savingsWindow === w ? '#8bc8a0' : '#94a3b8') : '#475569',
                  opacity: reached ? 1 : 0.6,
                }}
              >
                {SAVINGS_WINDOW_LABELS[w]}
              </button>
            );
          })}
        </div>

        {(!savingsSummary || savingsSummary.empty) && (
          <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
            Nothing to show yet. Ask something first; MnemosyneC keeps count from your first question.
          </div>
        )}

        {savingsSummary && !savingsSummary.empty && savingsSummary.aggregate && (
          <>
            <div style={{ fontSize: 12, color: '#e2e8f0', lineHeight: 1.9 }}>
              <div>
                Questions answered: <b style={{ color: '#6ee7b7' }}>{savingsSummary.aggregate.total_queries}</b>
              </div>
              <div>
                Cost avoided (measured from real provider prices, against the flagship you would otherwise
                have paid for): <b style={{ color: '#6ee7b7' }}>${savingsSummary.aggregate.cost_avoided_usd.toFixed(2)}</b>
              </div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 2, lineHeight: 1.5 }}>
                {savingsSummary.aggregate.measurement_scope}
              </div>
            </div>

            <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700 }}>
              {savingsSummary.chain_ok ? (
                <span style={{ color: '#6ee7b7' }}>chain verified</span>
              ) : (
                <span style={{ color: '#f87171' }}>chain broken at record {savingsSummary.chain_broken_at_index}</span>
              )}
            </div>

            <textarea
              readOnly
              value={savingsSummary.receipt_block ?? ''}
              style={{
                width: '100%', boxSizing: 'border-box', marginTop: 10,
                minHeight: 190, padding: 8, borderRadius: 4, resize: 'vertical',
                background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(148,163,184,0.3)',
                color: '#cbd5e1', fontSize: 11, fontFamily: 'ui-monospace, "SF Mono", Consolas, monospace',
                lineHeight: 1.5,
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <button
                type="button"
                onClick={copySavingsReceipt}
                style={{
                  padding: '6px 14px', borderRadius: 4,
                  background: 'rgba(100,200,150,0.15)', border: '1px solid rgba(100,200,150,0.5)',
                  color: '#8bc8a0', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Copy receipt
              </button>
              {savingsCopyState === 'copied' && <span style={{ fontSize: 11, color: '#6ee7b7' }}>Copied</span>}
              {savingsCopyState === 'error' && <span style={{ fontSize: 11, color: '#f87171' }}>Could not copy</span>}
            </div>

            <div style={{ fontSize: 11, color: '#707070', marginTop: 10, lineHeight: 1.5 }}>
              Post it anywhere public, then add your link at{' '}
              <span
                role="link"
                tabIndex={0}
                onClick={() => window.amplify?.openExternal?.('https://mnemosynec.org/post-your-receipt/')}
                onKeyDown={(e) => e.key === 'Enter' && window.amplify?.openExternal?.('https://mnemosynec.org/post-your-receipt/')}
                style={{ color: '#6ee7b7', textDecoration: 'underline', cursor: 'pointer' }}
              >
                mnemosynec.org/post-your-receipt/
              </span>
              .
            </div>

            <div style={{ fontSize: 10, color: '#64748b', marginTop: 10, lineHeight: 1.5 }}>
              This receipt is signed by this install and chained to every answer it counted. It proves the
              numbers were not edited after the fact. It cannot prove to a stranger that the questions were
              real work.
            </div>
          </>
        )}
      </div>

      {/* D-BP223-BM0-X033-022 ("Haystack Needle" test #2): Scavenger Hunt -- zero-model-call
          substrate phrase search + "did you mean" answer-with-sources. Separate panel, separate
          IPC channels, from My Savings Receipt above. */}
      <ScavengerHuntPanel />

      <div style={{ fontSize: 11, color: '#707070', margin: '20px 0 4px', lineHeight: 1.5 }}>
        Press the button to confirm your substrate poller is live.
      </div>

      <button
        type="button"
        onClick={() => void runCheck()}
        disabled={checkState === 'checking'}
        style={{
          padding: '10px 20px',
          backgroundColor: 'rgba(100, 200, 150, 0.15)',
          border: '1px solid rgba(100, 200, 150, 0.5)',
          borderRadius: 4,
          color: '#8bc8a0',
          fontSize: 14,
          fontWeight: 600,
          cursor: checkState === 'checking' ? 'wait' : 'pointer',
          opacity: checkState === 'checking' ? 0.7 : 1,
        }}
      >
        Prove It Works ▶
      </button>

      {checkState === 'checking' && (
        <div style={{ marginTop: 16, fontSize: 12, color: '#909090', fontStyle: 'italic' }}>
          Checking poller health…
        </div>
      )}

      {checkState === 'alive' && (
        <div style={{ marginTop: 16, padding: 12, backgroundColor: 'rgba(100, 200, 150, 0.08)', border: '1px solid rgba(100, 200, 150, 0.3)', borderRadius: 4 }}>
          <div style={{ fontSize: 13, color: '#8bc8a0', lineHeight: 1.5 }}>
            Substrate is alive — poller responding. Use the Ask tab to run a live query.
          </div>
          {checkedAt && (
            <div style={{ fontSize: 10, color: '#606060', marginTop: 8 }}>
              Checked at: {checkedAt}
            </div>
          )}
        </div>
      )}

      {checkState === 'offline' && (
        <div style={{ marginTop: 16, padding: 12, backgroundColor: 'rgba(200, 100, 100, 0.08)', border: '1px solid rgba(200, 100, 100, 0.3)', borderRadius: 4 }}>
          <div style={{ fontSize: 13, color: '#c8a0a0', lineHeight: 1.5 }}>
            Substrate poller not responding. Try starting MnemosyneC&apos;s Ollama integration, then return here.
          </div>
          {checkedAt && (
            <div style={{ fontSize: 10, color: '#606060', marginTop: 8 }}>
              Checked at: {checkedAt}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => onSwitchTab?.('ask')}
        style={{
          marginTop: 20,
          padding: '6px 14px',
          backgroundColor: 'transparent',
          border: '1px solid rgba(100, 200, 150, 0.3)',
          borderRadius: 4,
          color: '#8bc8a0',
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        Ask a question and watch the badge → Ask tab
      </button>

      {/* BP139: Authority Proof Panel -- sign-in status + live test query */}
      <div style={{ marginTop: 24, borderTop: '1px solid rgba(148,163,184,0.15)', paddingTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>Browser Authority</div>
          <button
            type="button"
            onClick={() => void refreshAuthorityStatus()}
            disabled={authorityCheckState === 'checking'}
            style={{
              background: 'none', border: '1px solid rgba(148,163,184,0.3)', borderRadius: 4,
              color: '#94a3b8', fontSize: 11, padding: '2px 8px',
              cursor: authorityCheckState === 'checking' ? 'wait' : 'pointer',
            }}
          >
            {authorityCheckState === 'checking' ? '...' : 'Refresh'}
          </button>
        </div>
        <div style={{ fontSize: 11, color: '#707070', marginBottom: 10, lineHeight: 1.5 }}>
          Verify that the browser authority is signed in and can return a sourced fact.
          Flags must be ON in Settings &gt; Authorities.
        </div>

        {/* Flags gate */}
        {flagsEnabled !== null && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '3px 8px', borderRadius: 4, marginBottom: 8,
            background: flagsEnabled ? 'rgba(110,231,183,0.1)' : 'rgba(200,100,100,0.08)',
            border: `1px solid ${flagsEnabled ? 'rgba(110,231,183,0.35)' : 'rgba(200,100,100,0.3)'}`,
            fontSize: 11, color: flagsEnabled ? '#6ee7b7' : '#c87070', fontWeight: 600,
          }}>
            {flagsEnabled ? 'Flags ON' : 'Flags OFF -- enable Research Arm + Browser Authority in Settings'}
          </div>
        )}

        {/* Sign-in status rows -- BP1xx: each row is now also an enable toggle (the toggle IS
            the login trigger: switching ON while not signed in opens the nexus sign-in window). */}
        {signInStatuses && signInStatuses.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
            {signInStatuses.map((s) => {
              const enabled = authorityEnabled[s.authority] ?? false;
              return (
                <div key={s.authority} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '4px 8px', borderRadius: 4,
                  background: s.signedIn ? 'rgba(110,231,183,0.06)' : 'rgba(148,163,184,0.06)',
                  border: `1px solid ${s.signedIn ? 'rgba(110,231,183,0.25)' : 'rgba(148,163,184,0.2)'}`,
                  fontSize: 11,
                }}>
                  <span style={{
                    fontWeight: 700,
                    color: s.signedIn ? '#6ee7b7' : '#94a3b8',
                  }}>
                    {s.signedIn ? 'Signed in' : 'Not signed in'}
                  </span>
                  <span style={{ color: '#64748b' }}>{AUTHORITY_LABELS[s.authority] ?? s.authority}</span>
                  {!s.signedIn && s.reason && (
                    <span style={{ color: '#475569', fontSize: 10 }}>{s.reason}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleAuthorityEnabled(s.authority, !enabled, s.signedIn)}
                    title={
                      enabled
                        ? `Disable ${AUTHORITY_LABELS[s.authority] ?? s.authority} as an authority`
                        : s.signedIn
                          ? `Enable ${AUTHORITY_LABELS[s.authority] ?? s.authority} as an authority`
                          : `Enable ${AUTHORITY_LABELS[s.authority] ?? s.authority} and sign in`
                    }
                    style={{
                      marginLeft: 'auto', flexShrink: 0,
                      padding: '3px 10px', borderRadius: 4,
                      background: enabled ? 'rgba(100,200,150,0.15)' : 'rgba(148,163,184,0.1)',
                      border: `1px solid ${enabled ? 'rgba(100,200,150,0.5)' : 'rgba(148,163,184,0.3)'}`,
                      color: enabled ? '#8bc8a0' : '#94a3b8',
                      fontSize: 10, fontWeight: 700, cursor: 'pointer', minWidth: 40,
                    }}
                  >
                    {enabled ? 'ON' : 'OFF'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ fontSize: 10, color: '#64748b', marginTop: -6, marginBottom: 10, lineHeight: 1.5 }}>
          Off by default. Switching an authority ON while it is not signed in also opens its
          sign-in window.
        </div>
        {authorityCheckState === 'error' && (
          <div style={{ fontSize: 11, color: '#f87171', marginBottom: 8 }}>
            Could not probe authority status -- app may be starting up.
          </div>
        )}

        {/* Live test section */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Test question:</div>
          <input
            type="text"
            value={testQuestion}
            onChange={(e) => setTestQuestion(e.target.value)}
            disabled={testState === 'running'}
            placeholder="e.g. what year did the Berlin Wall fall"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '6px 10px', borderRadius: 4,
              background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(148,163,184,0.3)',
              color: '#e2e8f0', fontSize: 12, fontFamily: 'system-ui, sans-serif',
              outline: 'none',
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => void runAuthorityTest()}
          disabled={testState === 'running' || !testQuestion.trim()}
          style={{
            padding: '7px 16px',
            backgroundColor: 'rgba(100,200,150,0.15)',
            border: '1px solid rgba(100,200,150,0.5)',
            borderRadius: 4, color: '#8bc8a0', fontSize: 12, fontWeight: 600,
            cursor: (testState === 'running' || !testQuestion.trim()) ? 'wait' : 'pointer',
            opacity: (testState === 'running' || !testQuestion.trim()) ? 0.6 : 1,
          }}
        >
          {testState === 'running' ? 'Querying authority...' : 'Test Authority'}
        </button>

        {/* Result display */}
        {testState === 'done' && testResult && (
          <div style={{
            marginTop: 10, padding: 10, borderRadius: 4,
            background: testResult.usable ? 'rgba(110,231,183,0.06)' : 'rgba(148,163,184,0.06)',
            border: `1px solid ${testResult.usable ? 'rgba(110,231,183,0.25)' : 'rgba(148,163,184,0.2)'}`,
          }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{
                padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                background: testResult.usable ? 'rgba(110,231,183,0.15)' : 'rgba(200,100,100,0.15)',
                color: testResult.usable ? '#6ee7b7' : '#f87171',
                border: `1px solid ${testResult.usable ? 'rgba(110,231,183,0.4)' : 'rgba(200,100,100,0.3)'}`,
              }}>
                {testResult.usable ? 'USABLE' : 'NOT USABLE'}
              </span>
              <span style={{
                padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                background: 'rgba(148,163,184,0.1)', color: '#94a3b8',
                border: '1px solid rgba(148,163,184,0.2)',
              }}>
                {testResult.answerType}
              </span>
              {testResult.authority && (
                <span style={{
                  padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                  background: 'rgba(148,163,184,0.1)', color: '#94a3b8',
                  border: '1px solid rgba(148,163,184,0.2)',
                }}>
                  via {AUTHORITY_LABELS[testResult.authority] ?? testResult.authority}
                </span>
              )}
              {testResult.confidence !== undefined && (
                <span style={{
                  padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                  background: 'rgba(148,163,184,0.1)', color: '#94a3b8',
                  border: '1px solid rgba(148,163,184,0.2)',
                }}>
                  confidence {Math.round(testResult.confidence * 100)}%
                </span>
              )}
            </div>
            {testResult.usable && testResult.fact && (
              <div style={{ fontSize: 12, color: '#f0fdf4', fontWeight: 600, marginBottom: 4, lineHeight: 1.5 }}>
                {testResult.fact}
              </div>
            )}
            {testResult.usable && testResult.sourceUrl && (
              <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.4, wordBreak: 'break-all' }}>
                Source:{' '}
                <span
                  role="link"
                  tabIndex={0}
                  onClick={() => window.amplify?.openExternal?.(testResult.sourceUrl!)}
                  onKeyDown={(e) => e.key === 'Enter' && window.amplify?.openExternal?.(testResult.sourceUrl!)}
                  style={{ color: '#6ee7b7', textDecoration: 'underline', cursor: 'pointer' }}
                >
                  {testResult.sourceUrl}
                </span>
              </div>
            )}
            {!testResult.usable && testResult.reason && (
              <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
                <span style={{ fontWeight: 700, color: '#fca5a5' }}>{testResult.reason}</span>
                {' -- '}
                {REASON_EXPLANATIONS[testResult.reason] ?? 'No explanation available.'}
              </div>
            )}
          </div>
        )}
        {testState === 'error' && testError && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#f87171' }}>Error: {testError}</div>
        )}
      </div>
    </div>
  );
}